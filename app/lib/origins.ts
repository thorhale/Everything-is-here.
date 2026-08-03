import { prisma } from "@/lib/db";
import { unstable_cache } from "next/cache";
import { compareNames } from "@/lib/script";

// The reference library organised by where things come from.
//
// Brewing is regional before it is anything else — a Saaz hop, Pilsen water and
// a Czech lager yeast are the same fact told three ways. The datasets each
// carry an origin already; this joins them so a country can be read as a whole
// rather than looked up four times.
//
// Country strings are normalised on the way in, because the datasets were
// curated separately and drifted: "USA", "US" and "United States" all appear.
// Everything is sorted with Intl.Collator so accented country and product names
// file under their base letter instead of after Z.

const CANONICAL: Record<string, string> = {
  usa: "United States",
  us: "United States",
  "u.s.": "United States",
  uk: "United Kingdom",
  "u.k.": "United Kingdom",
  britain: "United Kingdom",
  england: "United Kingdom",
  czechia: "Czech Republic",
  holland: "Netherlands",
};

/** Trim, collapse whitespace, and fold the known aliases onto one spelling. */
export function canonicalCountry(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!s || s === "—" || /^varies$/i.test(s) || /^worldwide$/i.test(s)) return null;
  return CANONICAL[s.toLowerCase()] ?? s;
}

export interface OriginItem {
  name: string;
  href: string;
  detail?: string | null;
}

export interface OriginCountry {
  country: string;
  hops: OriginItem[];
  water: OriginItem[];
  yeastLabs: OriginItem[];
  fermentables: OriginItem[];
  total: number;
}

export const getOrigins = unstable_cache(
  async (): Promise<OriginCountry[]> => {
    const [hops, water, labs, ferms] = await Promise.all([
      prisma.hop.findMany({ select: { id: true, name: true, country: true, purpose: true } }),
      prisma.waterProfile.findMany({ select: { id: true, name: true, country: true, region: true } }),
      prisma.yeastLab.findMany({ select: { id: true, name: true, country: true, region: true } }),
      prisma.fermentable.findMany({ select: { id: true, name: true, origin: true, category: true } }),
    ]);

    const by = new Map<string, OriginCountry>();
    const bucket = (raw: string | null | undefined): OriginCountry | null => {
      const c = canonicalCountry(raw);
      if (!c) return null;
      let e = by.get(c);
      if (!e) by.set(c, (e = { country: c, hops: [], water: [], yeastLabs: [], fermentables: [], total: 0 }));
      return e;
    };

    for (const h of hops) {
      const e = bucket(h.country);
      if (e) e.hops.push({ name: h.name, href: `/hops/db/${encodeURIComponent(h.id)}`, detail: h.purpose });
    }
    for (const w of water) {
      const e = bucket(w.country);
      if (e) e.water.push({ name: w.name, href: `/water/${encodeURIComponent(w.id)}`, detail: w.region });
    }
    for (const l of labs) {
      const e = bucket(l.country);
      if (e) e.yeastLabs.push({ name: l.name, href: `/yeasts/db?lab=${encodeURIComponent(l.id)}`, detail: l.region });
    }
    for (const f of ferms) {
      // Fermentable.origin mixes maltster countries with wine-grape growing
      // regions, and multi-region entries ("Loire, Marlborough, Bordeaux")
      // describe a grape rather than a place of manufacture. Only single-value
      // origins are filed by country; the rest stay on their own pages.
      if (!f.origin || f.origin.includes(",")) continue;
      const e = bucket(f.origin);
      if (e) e.fermentables.push({ name: f.name, href: `/fermentables/db/${encodeURIComponent(f.id)}`, detail: f.category });
    }

    const byName = (a: OriginItem, b: OriginItem) => compareNames(a.name, b.name);
    const out = [...by.values()];
    for (const e of out) {
      e.hops.sort(byName);
      e.water.sort(byName);
      e.yeastLabs.sort(byName);
      e.fermentables.sort(byName);
      e.total = e.hops.length + e.water.length + e.yeastLabs.length + e.fermentables.length;
    }
    return out.sort((a, b) => compareNames(a.country, b.country));
  },
  ["origins-v1"],
  { revalidate: 3600 }
);
