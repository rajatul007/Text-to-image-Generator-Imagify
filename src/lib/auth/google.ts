import { env } from "../env";
import { AppError } from "../errors";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export function googleConfigured() {
  const e = env();
  return Boolean(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET);
}

export function googleRedirectUri() {
  return `${env().APP_URL}/api/auth/google/callback`;
}

export function googleAuthUrl(state: string, codeChallenge: string) {
  const e = env();
  const params = new URLSearchParams({
    client_id: e.GOOGLE_CLIENT_ID!,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `${AUTH_URL}?${params}`;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

export async function exchangeGoogleCode(code: string, codeVerifier: string): Promise<GoogleProfile> {
  const e = env();
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: e.GOOGLE_CLIENT_ID!,
      client_secret: e.GOOGLE_CLIENT_SECRET!,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!tokenRes.ok) throw new AppError("BAD_REQUEST", "Google sign-in failed. Please try again.");
  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) throw new AppError("BAD_REQUEST", "Google sign-in failed. Please try again.");
  const infoRes = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${tokens.access_token}` }, signal: AbortSignal.timeout(15_000) });
  if (!infoRes.ok) throw new AppError("BAD_REQUEST", "Could not read your Google profile.");
  const profile = (await infoRes.json()) as GoogleProfile;
  if (!profile.sub || !profile.email) throw new AppError("BAD_REQUEST", "Google did not return an email address.");
  return profile;
}
