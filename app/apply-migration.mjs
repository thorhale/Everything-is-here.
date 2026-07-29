// Apply a migration .sql file to Neon over HTTPS. Reads NEON_URL.
// Usage: node apply-migration.mjs prisma/migrations/<name>/migration.sql
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

const sql = neon(process.env.NEON_URL);
const file = process.argv[2];
if (!file) { console.error("usage: node apply-migration.mjs <path/to/migration.sql>"); process.exit(1); }

const mb = (b) => (Number(b) / 1048576).toFixed(1);
const size = async () => (await sql.query(`SELECT pg_database_size(current_database()) AS s`))[0].s;

async function retry(fn, label) {
  for (let i = 1; i <= 4; i++) {
    try { return await fn(); }
    catch (e) {
      if (i === 4) throw e;
      console.log(`  ${label}: retry ${i} (${e.message})`);
      await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
}

const before = await retry(size, "size");
console.log(`database before: ${mb(before)} MB`);

const body = readFileSync(file, "utf8");
await retry(() => sql.query(body), "migration");
console.log(`applied ${file}`);

const after = await retry(size, "size");
console.log(`database after:  ${mb(after)} MB   (freed ${mb(before - after)} MB)`);
