import { logger } from "./logger";

export interface ConnectorCredential {
  provider: string;
  accessToken: string;
  accountLabel: string | null;
  expiresAt: number | null;
  raw: Record<string, unknown>;
}

interface ConnectorApiItem {
  connector_name?: string;
  account_id?: string;
  account_name?: string;
  display_name?: string;
  metadata?: Record<string, unknown> & { display_name?: string };
  settings?: Record<string, unknown> & {
    access_token?: string;
    expires_at?: string | number;
    api_key?: string;
    oauth?: { credentials?: { access_token?: string; expires_at?: number } };
  };
}

const CONNECTOR_NAME_MAP: Record<string, string> = {
  linear: "linear",
  notion: "notion",
  "google-docs": "google-docs",
  github: "github",
  slack: "slack",
  jira: "jira",
  hubspot: "hubspot",
};

export async function fetchConnectorCredential(
  provider: string,
): Promise<ConnectorCredential | null> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const token =
    process.env.REPL_IDENTITY ||
    process.env.WEB_REPL_RENEWAL ||
    process.env.REPL_IDENTITY_KEY;
  if (!hostname || !token) {
    logger.warn(
      { hasHostname: Boolean(hostname), hasToken: Boolean(token) },
      "Replit connectors env vars not set; cannot fetch credentials",
    );
    return null;
  }
  const connectorName = CONNECTOR_NAME_MAP[provider] ?? provider;
  const url = `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=${encodeURIComponent(
    connectorName,
  )}`;

  const xToken = process.env.REPL_IDENTITY
    ? `repl ${process.env.REPL_IDENTITY}`
    : `depl ${process.env.WEB_REPL_RENEWAL ?? token}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Accept: "application/json",
        X_REPLIT_TOKEN: xToken,
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    logger.warn({ err, provider }, "Connector fetch failed");
    return null;
  }
  if (!res.ok) {
    logger.warn(
      { status: res.status, provider },
      "Connector endpoint returned non-OK",
    );
    return null;
  }
  const json = (await res.json()) as { items?: ConnectorApiItem[] };
  const items = json.items ?? [];
  if (items.length === 0) return null;
  const item = items[0];
  const settings = item.settings ?? {};
  const accessToken =
    settings.access_token ||
    settings.oauth?.credentials?.access_token ||
    settings.api_key;
  if (!accessToken) {
    logger.warn({ provider }, "Connector returned no access_token");
    return null;
  }

  let expiresAt: number | null = null;
  const rawExpires =
    settings.expires_at ?? settings.oauth?.credentials?.expires_at ?? null;
  if (typeof rawExpires === "number") expiresAt = rawExpires;
  else if (typeof rawExpires === "string")
    expiresAt = Date.parse(rawExpires) || null;

  return {
    provider,
    accessToken: String(accessToken),
    accountLabel:
      item.metadata?.display_name ||
      item.display_name ||
      item.account_name ||
      null,
    expiresAt,
    raw: settings,
  };
}
