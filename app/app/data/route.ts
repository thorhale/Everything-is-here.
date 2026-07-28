import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-static";

// GET /data — the curated reference databases as one JSON file.
//
// Served from the committed export in data/reference-export.json rather than
// queried live, so it is cache-friendly, costs nothing per request, and stays
// byte-identical to what is in the repo. Regenerate with
// `node app/export-reference.mjs`.
export async function GET() {
  try {
    const path = join(process.cwd(), "..", "data", "reference-export.json");
    const body = await readFile(path, "utf8");
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'inline; filename="worthogg-reference.json"',
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Reference export not available. Run `node app/export-reference.mjs` to generate it." },
      { status: 503 }
    );
  }
}
