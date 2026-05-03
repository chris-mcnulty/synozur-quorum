export type GroundingProvider = "linear" | "notion" | "google-docs" | "github";

export interface FetchInput {
  provider: GroundingProvider;
  query: Record<string, unknown>;
  tokenBudget: number;
}

export interface FetchOutput {
  contentText: string;
  tokenEstimate: number;
  truncated: boolean;
  status: "ok" | "empty" | "error" | "not_connected";
  errorDetail?: string;
}

// Approx 4 chars per token; conservative.
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function clipToTokenBudget(
  text: string,
  tokenBudget: number,
): { text: string; truncated: boolean; tokenEstimate: number } {
  const maxChars = tokenBudget * 4;
  if (text.length <= maxChars) {
    return {
      text,
      truncated: false,
      tokenEstimate: estimateTokens(text),
    };
  }
  const clipped = text.slice(0, maxChars);
  const truncationNote =
    "\n\n[…snapshot truncated to fit token budget. Increase the selector budget to see more.]";
  const truncatedText =
    clipped.slice(0, Math.max(0, maxChars - truncationNote.length)) +
    truncationNote;
  return {
    text: truncatedText,
    truncated: true,
    tokenEstimate: estimateTokens(truncatedText),
  };
}
