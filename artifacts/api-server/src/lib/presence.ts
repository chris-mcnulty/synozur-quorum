export interface PresenceUser {
  userId: string;
  email: string | null;
  displayName: string | null;
}

interface PresenceEntry {
  user: PresenceUser;
  lastSeen: number;
}

const PRESENCE_TTL_MS = 30_000;
const presenceBySession = new Map<string, Map<string, PresenceEntry>>();

function pruneSession(sessionId: string): Map<string, PresenceEntry> {
  let bucket = presenceBySession.get(sessionId);
  if (!bucket) {
    bucket = new Map();
    presenceBySession.set(sessionId, bucket);
    return bucket;
  }
  const now = Date.now();
  for (const [uid, entry] of bucket) {
    if (now - entry.lastSeen > PRESENCE_TTL_MS) bucket.delete(uid);
  }
  return bucket;
}

export function pingPresence(sessionId: string, user: PresenceUser): void {
  const bucket = pruneSession(sessionId);
  bucket.set(user.userId, { user, lastSeen: Date.now() });
}

export function dropPresence(sessionId: string, userId: string): void {
  const bucket = presenceBySession.get(sessionId);
  if (bucket) bucket.delete(userId);
}

export function listPresence(sessionId: string): PresenceUser[] {
  const bucket = pruneSession(sessionId);
  return Array.from(bucket.values()).map((e) => e.user);
}
