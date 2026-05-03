import { fetchConnectorCredential } from "../replitConnectors";
import { clipToTokenBudget, type FetchInput, type FetchOutput } from "./types";

type HubspotObjectType = "deals" | "contacts" | "companies" | "tickets";

interface HubspotQuery {
  objectType?: HubspotObjectType | null;
  properties?: string[] | null;
  limit?: number | null;
  search?: string | null;
  filterGroups?: unknown;
}

interface HubspotRecord {
  id: string;
  properties?: Record<string, string | null>;
  updatedAt?: string;
}

const DEFAULT_PROPERTIES: Record<HubspotObjectType, string[]> = {
  deals: [
    "dealname",
    "amount",
    "dealstage",
    "pipeline",
    "closedate",
    "hubspot_owner_id",
  ],
  contacts: ["firstname", "lastname", "email", "company", "jobtitle"],
  companies: ["name", "domain", "industry", "numberofemployees", "lifecyclestage"],
  tickets: ["subject", "content", "hs_pipeline_stage", "hs_ticket_priority"],
};

const TITLE_KEY: Record<HubspotObjectType, string> = {
  deals: "dealname",
  contacts: "email",
  companies: "name",
  tickets: "subject",
};

export async function fetchHubspot(input: FetchInput): Promise<FetchOutput> {
  const cred = await fetchConnectorCredential("hubspot");
  if (!cred) {
    return {
      contentText: "",
      tokenEstimate: 0,
      truncated: false,
      status: "not_connected",
      errorDetail: "HubSpot connection not authorized for this workspace.",
    };
  }
  const q = (input.query ?? {}) as HubspotQuery;
  const objectType: HubspotObjectType = q.objectType ?? "deals";
  if (!["deals", "contacts", "companies", "tickets"].includes(objectType)) {
    return {
      contentText: "",
      tokenEstimate: 0,
      truncated: false,
      status: "error",
      errorDetail: `Unsupported HubSpot objectType: ${objectType}`,
    };
  }
  const limit = Math.max(1, Math.min(100, q.limit ?? 25));
  const properties = q.properties?.length
    ? q.properties
    : DEFAULT_PROPERTIES[objectType];

  const useSearch =
    Boolean(q.search && q.search.trim().length > 0) ||
    Boolean(q.filterGroups);

  let records: HubspotRecord[] = [];
  try {
    let res: Response;
    if (useSearch) {
      res = await fetch(
        `https://api.hubapi.com/crm/v3/objects/${objectType}/search`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cred.accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            query: q.search ?? undefined,
            filterGroups: q.filterGroups ?? undefined,
            properties,
            limit,
            sorts: [{ propertyName: "hs_lastmodifieddate", direction: "DESCENDING" }],
          }),
          signal: AbortSignal.timeout(15_000),
        },
      );
    } else {
      const qs = new URLSearchParams({
        limit: String(limit),
        properties: properties.join(","),
      });
      res = await fetch(
        `https://api.hubapi.com/crm/v3/objects/${objectType}?${qs.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${cred.accessToken}`,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(15_000),
        },
      );
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        contentText: "",
        tokenEstimate: 0,
        truncated: false,
        status: "error",
        errorDetail: `HubSpot HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
      };
    }
    const data = (await res.json()) as { results?: HubspotRecord[] };
    records = data.results ?? [];
  } catch (err) {
    const e = err as { message?: string };
    return {
      contentText: "",
      tokenEstimate: 0,
      truncated: false,
      status: "error",
      errorDetail: e?.message ?? "HubSpot request failed",
    };
  }

  if (records.length === 0) {
    return {
      contentText: `(No HubSpot ${objectType} matched this selector.)`,
      tokenEstimate: 0,
      truncated: false,
      status: "empty",
    };
  }

  const titleKey = TITLE_KEY[objectType];
  const lines: string[] = [
    `# HubSpot ${objectType} (${records.length})`,
    "",
  ];
  for (const r of records) {
    const props = r.properties ?? {};
    const title = props[titleKey] || `(no ${titleKey})`;
    lines.push(`## ${title} — id ${r.id}`);
    for (const p of properties) {
      if (p === titleKey) continue;
      const v = props[p];
      if (v !== null && v !== undefined && v !== "") {
        lines.push(`- ${p}: ${v}`);
      }
    }
    if (r.updatedAt) lines.push(`- updatedAt: ${r.updatedAt}`);
    lines.push("");
  }

  const clipped = clipToTokenBudget(lines.join("\n"), input.tokenBudget);
  return {
    contentText: clipped.text,
    tokenEstimate: clipped.tokenEstimate,
    truncated: clipped.truncated,
    status: "ok",
  };
}
