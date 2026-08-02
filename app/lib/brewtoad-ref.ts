// Reconstructing BrewToad ingredient reference URLs from a stored integer.
//
// The archive originally stored, on every ingredient row, a full Wayback URL of
// the form:
//
//   /web/<timestamp>/https://www.brewtoad.com/generic-fermentables/52
//
// That is 55-68 bytes per row carrying about two bytes of information. Checked
// across every ref_url in the parse sample (2,323 of them):
//
//   * 100% match that exact shape;
//   * the <timestamp> equals the parent recipe's own sourceTimestamp in 100% of
//     cases, and that is already stored on Recipe;
//   * the path segment takes exactly three values, each one implied by which
//     table the row lives in.
//
// So the column was pure redundancy. Rows now store `refId` (an int), and the
// URL is rebuilt here when it is actually needed. See docs/storage-efficiency.md.

/** The three BrewToad reference paths, one per ingredient table. */
export type RefKind = "fermentable" | "hop" | "yeast";

const PATH: Record<RefKind, string> = {
  fermentable: "generic-fermentables",
  hop: "hops",
  yeast: "yeasts",
};

const BASE = "https://www.brewtoad.com";

/** The original brewtoad.com URL for an ingredient reference. */
export function brewtoadRefUrl(kind: RefKind, refId: number | null | undefined): string | null {
  if (refId == null) return null;
  return `${BASE}/${PATH[kind]}/${refId}`;
}

/**
 * The archived Wayback URL, exactly as the scrape recorded it. `timestamp` is
 * the parent recipe's sourceTimestamp — the same value the original string
 * embedded.
 */
export function waybackRefUrl(
  kind: RefKind,
  refId: number | null | undefined,
  timestamp: string | null | undefined
): string | null {
  if (refId == null) return null;
  const target = `${BASE}/${PATH[kind]}/${refId}`;
  if (!timestamp) return target;
  return `/web/${timestamp}/${target}`;
}

/**
 * Pull the integer out of a scraped ref_url. Returns null for anything that
 * does not match the expected shape, so a surprise in the source data becomes a
 * null rather than a silently wrong id.
 */
const REF_URL = /^\/web\/\d+\/https:\/\/www\.brewtoad\.com\/(generic-fermentables|hops|yeasts)\/(\d+)$/;

export function parseRefId(refUrl: string | null | undefined): number | null {
  if (!refUrl) return null;
  const m = REF_URL.exec(refUrl);
  if (!m) return null;
  const n = Number(m[2]);
  return Number.isSafeInteger(n) ? n : null;
}
