import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "wh_admin";

export function tokenMatches(candidate: string): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false; // no token configured -> admin disabled entirely
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function isAdmin(): Promise<boolean> {
  const jar = cookies();
  const cookie = jar.get(ADMIN_COOKIE)?.value ?? "";
  return cookie.length > 0 && tokenMatches(cookie);
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    throw new Error("Unauthorized");
  }
}
