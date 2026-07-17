// Load recipes into Neon over HTTPS (port 5432 is blocked in this sandbox).
// Resumable: skips recipes already present (by slug), so container restarts
// just continue. Loads a curated set of complete recipes for the test drive.
import { neon } from "@neondatabase/serverless";
import { createReadStream, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";

const URL_ = process.env.NEON_URL;
const DATA = process.env.DATA_PATH || "../data/parsed/recipes_full.jsonl";
const CAP = parseInt(process.env.CAP || "40000", 10);
const sql = neon(URL_);

const NUM = /-?\d+\.?\d*/;
const num = (s) => { if (s==null) return null; const m=String(s).match(NUM); return m?parseFloat(m[0]):null; };
const KG=2.20462, G=0.035274;
const wlb = (s)=>{ const v=num(s); if(v==null)return null; return s&&/kg/i.test(s)?v*KG:v; };
const woz = (s)=>{ const v=num(s); if(v==null)return null; return s&&/\bg\b/i.test(s)?v*G:v; };
const lit = (v)=>{ if(v==null) return "NULL"; if(typeof v==="number") return Number.isFinite(v)?String(v):"NULL"; if(typeof v==="boolean") return v?"TRUE":"FALSE"; return "'"+String(v).replace(/'/g,"''")+"'"; };

async function ensureSchema() {
  const ddl = readFileSync("prisma/migrations/20260708010426_init/migration.sql","utf8");
  for (let stmt of ddl.split(";")) {
    stmt = stmt.trim();
    if (!stmt) continue;
    try { await sql.query(stmt); }
    catch (e) { if(!/already exists/i.test(e.message)) console.error("DDL warn:", e.message.slice(0,80)); }
  }
  console.log("schema ready");
}

async function doneSlugs() {
  try { const rows = await sql.query('SELECT slug FROM "Recipe"'); return new Set(rows.map(r=>r.slug)); }
  catch { return new Set(); }
}

async function run() {
  await ensureSchema();
  const done = await doneSlugs();
  console.log(`${done.size} recipes already in Neon`);
  const brewerId = new Map();
  try {
    const brows = await sql.query('SELECT id, "originalUsername" FROM "Brewer"');
    for (const b of brows) brewerId.set(b.originalUsername, b.id);
    console.log(`${brewerId.size} existing brewers loaded`);
  } catch {}

  let loaded = 0, considered = 0;
  let batch = [];
  const rl = createInterface({ input: createReadStream(DATA), crlfDelay: Infinity });

  async function flush() {
    if (!batch.length) return;
    // brewers
    const newBrewers = [];
    for (const r of batch) {
      if (r.brewer && !brewerId.has(r.brewer)) {
        const id = "b"+randomUUID().replace(/-/g,"");
        brewerId.set(r.brewer, id);
        newBrewers.push(`(${lit(id)}, ${lit(r.brewer)})`);
      }
    }
    if (newBrewers.length)
      await sql.query(`INSERT INTO "Brewer" ("id","originalUsername") VALUES ${newBrewers.join(",")} ON CONFLICT ("originalUsername") DO NOTHING`);
    // recipes
    const rvals = batch.map(r=>`(${lit(r.id)},${lit(r.slug)},${lit(r.title)},${lit(r.style)},${lit(r.og)},${lit(r.fg)},${lit(r.ibu)},${lit(r.srm)},${lit(r.abv)},${lit(r.ibuFormula)},${lit(r.batch)},${lit(r.boil)},${lit(r.eff)},${lit(r.notes)},${lit(r.brewer?brewerId.get(r.brewer):null)},${lit(r.sourceUrl)},${lit(r.sourceTs)},${lit(r.parseSource)},${lit(r.conf)})`);
    await sql.query(`INSERT INTO "Recipe" ("id","slug","title","styleName","og","fg","ibu","srm","abv","ibuFormula","batchSizeDisplay","boilTimeDisplay","efficiencyDisplay","notesText","brewerId","sourceUrl","sourceTimestamp","parseSource","parseConfidence") VALUES ${rvals.join(",")} ON CONFLICT ("slug") DO NOTHING`);
    // children
    const ferm=[], hop=[], yst=[], com=[];
    for (const r of batch) {
      r.ferms.forEach((f,i)=>ferm.push(`(${lit("f"+randomUUID().replace(/-/g,""))},${lit(r.id)},${lit(f.name)},${lit(f.amount_display)},${lit(wlb(f.amount_display))},${lit(f.percent)},${lit(f.maltster)},${lit(f.use)},${lit(num(f.ppg))},${lit(num(f.color_lovibond))},${lit(f.ref_url)},${i})`));
      r.hops.forEach((h,i)=>hop.push(`(${lit("h"+randomUUID().replace(/-/g,""))},${lit(r.id)},${lit(h.name)},${lit(h.amount_display)},${lit(woz(h.amount_display))},${lit(h.time_display)},${lit(num(h.time_display))},${lit(h.use)},${lit(h.form)},${lit(num(h.alpha_acid))},${lit(h.ref_url)},${i})`));
      r.ysts.forEach((y)=>yst.push(`(${lit("y"+randomUUID().replace(/-/g,""))},${lit(r.id)},${lit(y.name)},${lit(y.lab_product)},${lit(num(y.attenuation))},${lit(y.ref_url)})`));
      r.coms.forEach((c)=>com.push(`(${lit("c"+randomUUID().replace(/-/g,""))},${lit(r.id)},${lit(c.comment_id)},${lit(c.commenter)},${lit(c.commenter_profile_url)},${lit(c.timestamp_display)},${lit(c.text)},${lit(c.parent_comment_id)})`));
    }
    if (ferm.length) await sql.query(`INSERT INTO "RecipeFermentable" ("id","recipeId","name","amountDisplay","amountLb","percent","maltster","use","ppg","colorLovibond","refUrl","sortOrder") VALUES ${ferm.join(",")}`);
    if (hop.length) await sql.query(`INSERT INTO "RecipeHop" ("id","recipeId","name","amountDisplay","amountOz","timeDisplay","timeMinutes","use","form","alphaAcidPct","refUrl","sortOrder") VALUES ${hop.join(",")}`);
    if (yst.length) await sql.query(`INSERT INTO "RecipeYeast" ("id","recipeId","name","labProduct","attenuationPct","refUrl") VALUES ${yst.join(",")}`);
    if (com.length) await sql.query(`INSERT INTO "RecipeComment" ("id","recipeId","originalCommentId","commenter","commenterProfileUrl","timestampDisplay","text","parentCommentId") VALUES ${com.join(",")}`);
    loaded += batch.length;
    batch = [];
    if (loaded % 2000 === 0) console.log(`  loaded ${loaded} (considered ${considered})`);
  }

  for await (const line of rl) {
    if (loaded + batch.length >= CAP) break;
    const t = line.trim(); if(!t) continue;
    let rec; try { rec = JSON.parse(t); } catch { continue; }
    if (rec.status !== "ok") continue;
    const h = rec.html;
    // "complete" recipes for a rich test drive
    if (h.og==null || h.abv==null || !(h.fermentables?.length) || !(h.hops?.length)) continue;
    considered++;
    if (done.has(rec.slug)) continue;
    batch.push({
      id: "r"+randomUUID().replace(/-/g,""),
      slug: rec.slug, title: h.title, style: h.style,
      og:num(h.og), fg:num(h.fg), ibu:num(h.ibu), srm:num(h.srm), abv:num(h.abv),
      ibuFormula:h.ibu_formula, batch:h.batch_size_display, boil:h.boil_time_display, eff:h.efficiency_display,
      notes:h.notes_text, brewer: rec.xml?.brewer ?? null,
      sourceUrl: rec.source.html_url, sourceTs: rec.source.html_timestamp,
      parseSource: rec.source.xml_url ? "html+xml_crossvalidated":"html", conf: rec.parse_confidence,
      ferms:h.fermentables, hops:h.hops, ysts:h.yeasts||[], coms:h.comments||[],
    });
    if (batch.length >= 100) await flush();
  }
  await flush();
  const [{count}] = await sql.query('SELECT count(*)::int AS count FROM "Recipe"');
  console.log(`DONE. loaded this run: ${loaded}. total recipes in Neon: ${count}`);
}
run().catch(e=>{ console.error("FATAL:", e.message); process.exit(1); });
