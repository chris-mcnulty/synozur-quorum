import crypto from "node:crypto";

function feedSecret(): string {
  return (
    process.env.FEED_SECRET ||
    process.env.SESSION_SECRET ||
    "quorum-feed-default-rotate-me"
  );
}

/**
 * Deterministic HMAC-based token for public podcast feed access.
 * Lets podcast apps (Apple Podcasts, Overcast, Spotify) fetch the RSS feed and
 * MP3 enclosures without an authenticated browser session, while still scoping
 * access to a single board and being revocable by rotating FEED_SECRET.
 */
export function signBoardFeedToken(boardId: string): string {
  const h = crypto.createHmac("sha256", feedSecret()).update(`board:${boardId}`).digest();
  return h.toString("base64url").slice(0, 32);
}

export function verifyBoardFeedToken(boardId: string, token: string): boolean {
  if (!token) return false;
  const expected = signBoardFeedToken(boardId);
  if (token.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}
