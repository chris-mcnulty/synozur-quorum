import type { FetchInput, FetchOutput, GroundingProvider } from "./types";
import { fetchLinear } from "./linear";
import { fetchNotion } from "./notion";
import { fetchGoogleDocs } from "./googleDocs";
import { fetchGithub } from "./github";

export type { FetchInput, FetchOutput, GroundingProvider } from "./types";

export const SUPPORTED_PROVIDERS: GroundingProvider[] = [
  "linear",
  "notion",
  "google-docs",
  "github",
];

export async function fetchSnapshot(input: FetchInput): Promise<FetchOutput> {
  switch (input.provider) {
    case "linear":
      return fetchLinear(input);
    case "notion":
      return fetchNotion(input);
    case "google-docs":
      return fetchGoogleDocs(input);
    case "github":
      return fetchGithub(input);
    default:
      return {
        contentText: "",
        tokenEstimate: 0,
        truncated: false,
        status: "error",
        errorDetail: `Unknown provider: ${input.provider}`,
      };
  }
}

export function providerDisplay(p: GroundingProvider): string {
  switch (p) {
    case "linear":
      return "Linear";
    case "notion":
      return "Notion";
    case "google-docs":
      return "Google Docs";
    case "github":
      return "GitHub";
  }
}
