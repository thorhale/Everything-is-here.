import type { DefaultSession } from "next-auth";

// Expose the database user id on the session, set from the JWT in the session
// callback (see auth.ts). Lets server code read session.user.id without a query.
declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
  }
}
