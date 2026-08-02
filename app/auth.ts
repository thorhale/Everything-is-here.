import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import { prisma } from "@/lib/db";

// App sign-in (Google, Apple, …). Distinct from the admin-token gate in
// lib/admin-auth.ts and from the scraped-archive `Brewer` rows.
//
// Two deliberate choices:
//   1. Sessions are JWT (a signed cookie), not database-backed. An
//      authenticated request therefore costs no query — the same reason the
//      calculators were moved off the database. The Prisma adapter still
//      persists the user + linked provider account, but only at sign-in.
//   2. Providers are only enabled when their credentials are present in the
//      environment, so the app builds and runs before any OAuth client
//      exists. Add credentials (see docs/accounts.md) and the button appears.

const providers = [];
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET })
  );
}
if (process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET) {
  providers.push(
    Apple({ clientId: process.env.AUTH_APPLE_ID, clientSecret: process.env.AUTH_APPLE_SECRET })
  );
}

/** Names of the providers that are actually configured, for the sign-in UI. */
export const enabledProviders: string[] = providers.map((p) =>
  typeof p === "function" ? (p as { id?: string }).id ?? "" : (p as { id?: string }).id ?? ""
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers,
  // The app runs behind a proxy in the hosted/native setup; without this,
  // Auth.js rejects the forwarded host.
  trustHost: true,
  pages: { signIn: "/account" },
  callbacks: {
    // JWT strategy: carry the database user id on the token at sign-in, then
    // expose it on the session so the rest of the app has a stable user id
    // without a database read.
    async jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.uid === "string") session.user.id = token.uid;
      return session;
    },
  },
});
