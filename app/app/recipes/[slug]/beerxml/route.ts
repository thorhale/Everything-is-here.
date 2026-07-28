import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toBeerXml, scaleRecipe, xmlFilename, type XmlRecipe } from "@/lib/beerxml";

export const dynamic = "force-dynamic";

// Parse a free-text batch size ("5 gal", "20 L") into gallons.
function batchGal(display: string | null): number {
  if (display) {
    const m = display.match(/([\d.]+)\s*(l\b|liter|litre|gal|gallon)/i);
    if (m) {
      const v = parseFloat(m[1]);
      if (Number.isFinite(v)) return /^(l|liter|litre)/i.test(m[2]) ? v / 3.785411784 : v;
    }
  }
  return 5;
}
function num(display: string | null): number | null {
  if (!display) return null;
  const m = display.match(/-?\d+\.?\d*/);
  return m ? parseFloat(m[0]) : null;
}

// GET /recipes/<slug>/beerxml            -> original size
// GET /recipes/<slug>/beerxml?gal=10     -> scaled to 10 gallons
// GET /recipes/<slug>/beerxml?litres=20  -> scaled to 20 L
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const recipe = await prisma.recipe.findUnique({
    where: { slug },
    include: {
      brewer: true,
      fermentables: { orderBy: { sortOrder: "asc" } },
      hops: { orderBy: { sortOrder: "asc" } },
      yeasts: true,
    },
  });
  if (!recipe || recipe.isHidden) {
    return new NextResponse("Recipe not found", { status: 404 });
  }

  const originalGal = batchGal(recipe.batchSizeDisplay);
  const url = new URL(request.url);
  const wantGal = parseFloat(url.searchParams.get("gal") ?? "");
  const wantL = parseFloat(url.searchParams.get("litres") ?? url.searchParams.get("liters") ?? "");
  const targetGal = Number.isFinite(wantGal) && wantGal > 0
    ? wantGal
    : Number.isFinite(wantL) && wantL > 0
      ? wantL / 3.785411784
      : originalGal;

  const base: XmlRecipe = {
    name: recipe.title ?? recipe.slug,
    brewer: recipe.brewer?.originalUsername ?? null,
    styleName: recipe.styleName,
    batchSizeGal: originalGal,
    boilTimeMin: num(recipe.boilTimeDisplay) ?? 60,
    efficiencyPct: num(recipe.efficiencyDisplay) ?? 72,
    og: recipe.og,
    fg: recipe.fg,
    ibu: recipe.ibu,
    colorSrm: recipe.srm,
    abv: recipe.abv,
    notes:
      `Recovered from the BrewToad archive by WortHogg. Original source: ${recipe.sourceUrl} ` +
      `(Wayback snapshot ${recipe.sourceTimestamp}).` +
      (recipe.notesText ? `\n\n${recipe.notesText}` : ""),
    fermentables: recipe.fermentables.map((f) => ({
      name: f.name,
      amountLb: f.amountLb,
      ppg: f.ppg,
      colorLovibond: f.colorLovibond,
      type: f.use,
    })),
    hops: recipe.hops.map((h) => ({
      name: h.name,
      amountOz: h.amountOz,
      alphaPct: h.alphaAcidPct,
      timeMin: h.timeMinutes,
      use: h.use,
    })),
    yeasts: recipe.yeasts.map((y) => ({
      name: y.name,
      labProduct: y.labProduct,
      attenuationPct: y.attenuationPct,
    })),
  };

  const factor = originalGal > 0 ? targetGal / originalGal : 1;
  const out = scaleRecipe(base, factor);
  const xml = toBeerXml(out);

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${xmlFilename(out.name)}"`,
    },
  });
}
