// Create the Auth.js tables in Neon over HTTPS (port 5432 is blocked in this
// sandbox, so this follows the same idempotent-DDL pattern as the data
// loaders rather than `prisma migrate`). Safe to re-run: every statement is
// CREATE ... IF NOT EXISTS. Column names and types match prisma/schema.prisma
// so Prisma reads these tables without an introspection mismatch.
//
//   node --env-file=.neon.env create-auth-tables.mjs
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.NEON_URL);
if (!process.env.NEON_URL) {
  console.error("create-auth-tables: NEON_URL is not set. Pass --env-file=.neon.env");
  process.exit(2);
}

const DDL = [
  `CREATE TABLE IF NOT EXISTS "User" (
     "id" TEXT PRIMARY KEY,
     "name" TEXT,
     "email" TEXT UNIQUE,
     "emailVerified" TIMESTAMP(3),
     "image" TEXT,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`,

  `CREATE TABLE IF NOT EXISTS "Account" (
     "id" TEXT PRIMARY KEY,
     "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
     "type" TEXT NOT NULL,
     "provider" TEXT NOT NULL,
     "providerAccountId" TEXT NOT NULL,
     "refresh_token" TEXT,
     "access_token" TEXT,
     "expires_at" INTEGER,
     "token_type" TEXT,
     "scope" TEXT,
     "id_token" TEXT,
     "session_state" TEXT)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId")`,
  `CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account"("userId")`,

  `CREATE TABLE IF NOT EXISTS "Session" (
     "id" TEXT PRIMARY KEY,
     "sessionToken" TEXT NOT NULL UNIQUE,
     "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
     "expires" TIMESTAMP(3) NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId")`,

  `CREATE TABLE IF NOT EXISTS "VerificationToken" (
     "identifier" TEXT NOT NULL,
     "token" TEXT NOT NULL,
     "expires" TIMESTAMP(3) NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token")`,
];

for (const stmt of DDL) {
  await sql.query(stmt);
}
console.log(`create-auth-tables: applied ${DDL.length} statements (User, Account, Session, VerificationToken).`);
