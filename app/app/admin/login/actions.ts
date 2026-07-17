"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, tokenMatches } from "@/lib/admin-auth";

export async function adminLogin(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");

  if (!token || !tokenMatches(token)) {
    redirect("/admin/login?error=1");
  }

  cookies().set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  redirect("/admin/takedowns");
}
