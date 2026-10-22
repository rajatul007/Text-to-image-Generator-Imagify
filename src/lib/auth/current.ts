import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "./session";
import { AppError } from "../errors";

/** Request-scoped cached session lookup for server components. */
export const currentUser = cache(async (): Promise<SessionUser | null> => getSessionUser());

/** For pages: redirect to /login when unauthenticated. */
export async function requirePageUser(nextPath?: string): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect(`/login${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`);
  return user;
}

/** For pages: only administrators. Non-admins get a 404-like redirect to the dashboard. */
export async function requirePageAdmin(): Promise<SessionUser> {
  const user = await requirePageUser("/admin");
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}

export function assertAdmin(user: SessionUser | null): asserts user is SessionUser {
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in");
  if (user.role !== "ADMIN") throw new AppError("FORBIDDEN", "Administrator access required");
}
