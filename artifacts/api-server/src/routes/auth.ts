import * as oidc from "openid-client";
import { Router, type IRouter, type Request, type Response } from "express";
import { apiOps } from "@workspace/api-zod";
import { db, usersTable, tenantMembersTable, tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  clearSession,
  getOidcConfig,
  getEntraOidcConfig,
  getEntraConfig,
  getSessionId,
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_TTL,
  ISSUER_URL,
  type SessionData,
} from "../lib/auth";
import {
  hashPassword,
  verifyPassword,
  localUserId,
  anonUserId,
} from "../lib/localAuth";

const OIDC_COOKIE_TTL = 10 * 60 * 1000;

const router: IRouter = Router();

function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host =
    req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}`;
}

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function setOidcCookie(res: Response, name: string, value: string) {
  res.cookie(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: OIDC_COOKIE_TTL,
  });
}

function getSafeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

async function upsertReplitUser(claims: Record<string, unknown>) {
  const userData = {
    id: claims.sub as string,
    email: (claims.email as string) || null,
    firstName: (claims.first_name as string) || null,
    lastName: (claims.last_name as string) || null,
    profileImageUrl: (claims.profile_image_url || claims.picture) as string | null,
    authProvider: "replit",
  };

  const [user] = await db
    .insert(usersTable)
    .values(userData)
    .onConflictDoUpdate({
      target: usersTable.id,
      set: { ...userData, updatedAt: new Date() },
    })
    .returning();
  return user!;
}

// ─── Config endpoint (lets frontend know what auth methods are available) ────

router.get("/auth/config", (_req: Request, res: Response) => {
  res.json({
    entraEnabled: getEntraConfig() !== null,
    localEnabled: true,
    anonymousEnabled: true,
  });
});

// ─── Current user ─────────────────────────────────────────────────────────────

router.get("/auth/user", (req: Request, res: Response) => {
  res.json(
    apiOps.GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

// ─── Replit OIDC login (existing flow, unchanged) ─────────────────────────────

router.get("/login", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;
  const returnTo = getSafeReturnTo(req.query.returnTo);

  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

  const redirectTo = oidc.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl,
    scope: "openid email profile offline_access",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "login consent",
    state,
    nonce,
  });

  setOidcCookie(res, "code_verifier", codeVerifier);
  setOidcCookie(res, "nonce", nonce);
  setOidcCookie(res, "state", state);
  setOidcCookie(res, "return_to", returnTo);

  res.redirect(redirectTo.href);
});

router.get("/callback", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;

  const codeVerifier = req.cookies?.code_verifier;
  const nonce = req.cookies?.nonce;
  const expectedState = req.cookies?.state;

  if (!codeVerifier || !expectedState) {
    res.redirect("/api/login");
    return;
  }

  const currentUrl = new URL(
    `${callbackUrl}?${new URL(req.url, `http://${req.headers.host}`).searchParams}`,
  );

  let tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
  try {
    tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedNonce: nonce,
      expectedState,
      idTokenExpected: true,
    });
  } catch {
    res.redirect("/api/login");
    return;
  }

  const returnTo = getSafeReturnTo(req.cookies?.return_to);

  res.clearCookie("code_verifier", { path: "/" });
  res.clearCookie("nonce", { path: "/" });
  res.clearCookie("state", { path: "/" });
  res.clearCookie("return_to", { path: "/" });

  const claims = tokens.claims();
  if (!claims) {
    res.redirect("/api/login");
    return;
  }

  const dbUser = await upsertReplitUser(claims as unknown as Record<string, unknown>);

  const now = Math.floor(Date.now() / 1000);
  const sessionData: SessionData = {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      profileImageUrl: dbUser.profileImageUrl,
    },
    auth_method: "replit",
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  res.redirect(returnTo);
});

// ─── Local password login ─────────────────────────────────────────────────────

router.post("/login/password", async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const id = localUserId(normalizedEmail);

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id));

  if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const sessionData: SessionData = {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
    },
    auth_method: "local",
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  res.json({ success: true });
});

// ─── Anonymous login ──────────────────────────────────────────────────────────

router.post("/login/anonymous", async (req: Request, res: Response) => {
  const id = anonUserId();

  const [user] = await db
    .insert(usersTable)
    .values({
      id,
      displayName: "Guest",
      authProvider: "anonymous",
    })
    .returning();

  if (!user) {
    res.status(500).json({ error: "Failed to create anonymous session" });
    return;
  }

  // Give guest access to the first tenant as VIEWER
  const [tenant] = await db.select().from(tenantsTable).limit(1);
  if (tenant) {
    await db
      .insert(tenantMembersTable)
      .values({ tenantId: tenant.id, userId: id, role: "VIEWER" })
      .onConflictDoNothing();
  }

  const sessionData: SessionData = {
    user: {
      id: user.id,
      email: null,
      firstName: "Guest",
      lastName: null,
      profileImageUrl: null,
    },
    auth_method: "anonymous",
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  res.json({ success: true });
});

// ─── Microsoft Entra SSO ──────────────────────────────────────────────────────

router.get("/login/entra", async (req: Request, res: Response) => {
  const entraConfig = await getEntraOidcConfig();
  if (!entraConfig) {
    res.status(404).json({ error: "Entra SSO is not configured" });
    return;
  }

  const callbackUrl = `${getOrigin(req)}/api/callback/entra`;
  const returnTo = getSafeReturnTo(req.query.returnTo as string | undefined);

  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

  const redirectTo = oidc.buildAuthorizationUrl(entraConfig, {
    redirect_uri: callbackUrl,
    scope: "openid email profile offline_access",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    nonce,
  });

  setOidcCookie(res, "entra_code_verifier", codeVerifier);
  setOidcCookie(res, "entra_nonce", nonce);
  setOidcCookie(res, "entra_state", state);
  setOidcCookie(res, "entra_return_to", returnTo);

  res.redirect(redirectTo.href);
});

router.get("/callback/entra", async (req: Request, res: Response) => {
  const entraConfig = await getEntraOidcConfig();
  if (!entraConfig) {
    res.redirect("/");
    return;
  }

  const callbackUrl = `${getOrigin(req)}/api/callback/entra`;
  const codeVerifier = req.cookies?.entra_code_verifier;
  const nonce = req.cookies?.entra_nonce;
  const expectedState = req.cookies?.entra_state;

  if (!codeVerifier || !expectedState) {
    res.redirect("/");
    return;
  }

  const currentUrl = new URL(
    `${callbackUrl}?${new URL(req.url, `http://${req.headers.host}`).searchParams}`,
  );

  let tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
  try {
    tokens = await oidc.authorizationCodeGrant(entraConfig, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedNonce: nonce,
      expectedState,
      idTokenExpected: true,
    });
  } catch {
    res.redirect("/");
    return;
  }

  const returnTo = getSafeReturnTo(req.cookies?.entra_return_to);

  res.clearCookie("entra_code_verifier", { path: "/" });
  res.clearCookie("entra_nonce", { path: "/" });
  res.clearCookie("entra_state", { path: "/" });
  res.clearCookie("entra_return_to", { path: "/" });

  const claims = tokens.claims();
  if (!claims) {
    res.redirect("/");
    return;
  }

  // Upsert Entra user — use "entra:{oid}" as stable ID
  const entraId = `entra:${claims.sub}`;
  const userData = {
    id: entraId,
    email: (claims.email as string) || null,
    firstName: (claims.given_name as string) || null,
    lastName: (claims.family_name as string) || null,
    profileImageUrl: null,
    authProvider: "entra",
  };

  const [dbUser] = await db
    .insert(usersTable)
    .values(userData)
    .onConflictDoUpdate({
      target: usersTable.id,
      set: { ...userData, updatedAt: new Date() },
    })
    .returning();

  if (!dbUser) {
    res.redirect("/");
    return;
  }

  // Give Entra user access to the first tenant as VIEWER if not already a member
  const [tenant] = await db.select().from(tenantsTable).limit(1);
  if (tenant) {
    await db
      .insert(tenantMembersTable)
      .values({ tenantId: tenant.id, userId: dbUser.id, role: "VIEWER" })
      .onConflictDoNothing();
  }

  const now = Math.floor(Date.now() / 1000);
  const sessionData: SessionData = {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      profileImageUrl: dbUser.profileImageUrl,
    },
    auth_method: "entra",
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  res.redirect(returnTo);
});

// ─── Logout ───────────────────────────────────────────────────────────────────

router.get("/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);

  // Determine auth method before clearing session
  const session = sid ? await import("../lib/auth").then(m => m.getSession(sid)) : null;
  const authMethod = session?.auth_method ?? "replit";

  await clearSession(res, sid);

  if (authMethod === "replit") {
    try {
      const config = await getOidcConfig();
      const origin = getOrigin(req);
      const endSessionUrl = oidc.buildEndSessionUrl(config, {
        client_id: process.env.REPL_ID!,
        post_logout_redirect_uri: origin,
      });
      res.redirect(endSessionUrl.href);
      return;
    } catch {
      // Fall through to plain redirect if OIDC is unavailable
    }
  }

  res.redirect("/");
});

// Also support POST logout (for fetch-based logout)
router.post("/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.json({ success: true });
});

// ─── Mobile auth (unchanged) ──────────────────────────────────────────────────

router.post(
  "/mobile-auth/token-exchange",
  async (req: Request, res: Response) => {
    const parsed = apiOps.ExchangeMobileAuthorizationCodeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required parameters" });
      return;
    }

    const { code, code_verifier, redirect_uri, state, nonce } = parsed.data;

    try {
      const config = await getOidcConfig();

      const callbackUrl = new URL(redirect_uri);
      callbackUrl.searchParams.set("code", code);
      callbackUrl.searchParams.set("state", state);
      callbackUrl.searchParams.set("iss", ISSUER_URL);

      const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
        pkceCodeVerifier: code_verifier,
        expectedNonce: nonce ?? undefined,
        expectedState: state,
        idTokenExpected: true,
      });

      const claims = tokens.claims();
      if (!claims) {
        res.status(401).json({ error: "No claims in ID token" });
        return;
      }

      const dbUser = await upsertReplitUser(claims as unknown as Record<string, unknown>);

      const now = Math.floor(Date.now() / 1000);
      const sessionData: SessionData = {
        user: {
          id: dbUser.id,
          email: dbUser.email,
          firstName: dbUser.firstName,
          lastName: dbUser.lastName,
          profileImageUrl: dbUser.profileImageUrl,
        },
        auth_method: "replit",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
      };

      const sid = await createSession(sessionData);
      res.json(apiOps.ExchangeMobileAuthorizationCodeResponse.parse({ token: sid }));
    } catch (err) {
      req.log.error({ err }, "Mobile token exchange error");
      res.status(500).json({ error: "Token exchange failed" });
    }
  },
);

router.post("/mobile-auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  if (sid) {
    await deleteSession(sid);
  }
  res.json(apiOps.LogoutMobileSessionResponse.parse({ success: true }));
});

export default router;
