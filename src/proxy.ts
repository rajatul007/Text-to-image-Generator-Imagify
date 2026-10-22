import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge-level gate for protected pages: redirects visitors without a session cookie to /login.
 * Real session validation (expiry, suspension, roles) happens server-side in layouts and API routes.
 */
const PROTECTED = ["/dashboard", "/generate", "/creations", "/history", "/favorites", "/editor", "/credits", "/transactions", "/profile", "/settings", "/notifications", "/checkout", "/admin", "/help"];

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  const hasSession = req.cookies.has("pf_session") || req.cookies.has("__Host-pf_session");
  if (hasSession) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.svg).*)"],
};
