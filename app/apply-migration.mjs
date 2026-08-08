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

// Neon's HTTP endpoint runs one prepared statement per request, so a migration
// file with two statements in it fails with "cannot insert multiple commands
// into a prepared statement" — and then gets retried three times, because the
// retry wrapper cannot tell a syntax error from a flaky connection. Every
// migration written so far happened to be a single statement, which is the only
// reason this never came up.
//
// Splitting has to respect the things a semicolon can legally sit inside:
// string literals, dollar-quoted function bodies, and comments. Anything less
// careful will cut a CREATE FUNCTION in half.
function statements(text) {
  const out = [];
  let buf = "", i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "'" || c === '"') {
      const q = c;
      buf += c; i++;
      while (i < text.length) {
        buf += text[i];
        if (text[i] === q && text[i + 1] === q) { buf += text[++i]; i++; continue; }
        if (text[i] === q) { i++; break; }
        i++;
      }
      continue;
    }
    if (c === "-" && text[i + 1] === "-") {
      const nl = text.indexOf("\n", i);
      const end = nl === -1 ? text.length : nl;
      buf += text.slice(i, end); i = end;
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end === -1 ? text.length : end + 2;
      buf += text.slice(i, stop); i = stop;
      continue;
    }
    const dollar = /^\$[A-Za-z_]*\$/.exec(text.slice(i));
    if (dollar) {
      const tag = dollar[0];
      const end = text.indexOf(tag, i + tag.length);
      const stop = end === -1 ? text.length : end + tag.length;
      buf += text.slice(i, stop); i = stop;
      continue;
    }
    if (c === ";") { out.push(buf); buf = ""; i++; continue; }
    buf += c; i++;
  }
  out.push(buf);
  // A "statement" of nothing but comments and whitespace is the file's header,
  // not something to send.
  return out.filter((s) => s.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "").trim());
}

const before = await retry(size, "size");
console.log(`database before: ${mb(before)} MB`);

const body = readFileSync(file, "utf8");
const parts = statements(body);
console.log(`${file}: ${parts.length} statement(s)`);
for (const [n, stmt] of parts.entries()) {
  const first = stmt.replace(/--[^\n]*/g, "").trim().split(/\s+/).slice(0, 4).join(" ");
  await retry(() => sql.query(stmt), `statement ${n + 1} (${first})`);
  console.log(`  ${n + 1}/${parts.length}  ${first}...`);
}
console.log(`applied ${file}`);

const after = await retry(size, "size");
console.log(`database after:  ${mb(after)} MB   (freed ${mb(before - after)} MB)`);
