// A static route, so `revalidate` would make Next prerender it at build time,
// where there is no database. Rendered per request instead; the detail routes
// that carry the real DB load are the ones cached.
export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/db";
import { unstable_cache } from "next/cache";
import { compareNames, indexLetter, langProps, detectScript } from "@/lib/script";

export const metadata = { title: "Brewers - WortHogg" };

const getTopBrewers = unstable_cache(
  async () =>
    prisma.$queryRaw<{ id: string; originalUsername: string; recipes: number }[]>`
      SELECT t."id", t."originalUsername", t.recipes FROM (
        SELECT b."id", b."originalUsername", count(r."id")::int AS recipes
        FROM "Brewer" b JOIN "Recipe" r ON r."brewerId" = b."id" AND r."isHidden" = false
        GROUP BY b."id", b."originalUsername"
        ORDER BY count(r."id") DESC
        LIMIT 200
      ) t`,
  ["top-brewers"],
  { revalidate: 3600 }
);

export default async function BrewersPage() {
  const brewers = await getTopBrewers();

  // Sorted with Intl.Collator rather than in SQL. Postgres's lower() does not
  // fold accents to a base letter, and JavaScript's default sort is worse still
  // — it compares UTF-16 code units, which files every accented and non-Latin
  // name after every ASCII one. These are people's names; they belong in the
  // alphabet, not in a pile at the end.
  const sorted = [...brewers].sort((a, b) =>
    compareNames(a.originalUsername, b.originalUsername)
  );

  // Grouped into an A–Z index, with each non-Latin script as its own heading
  // rather than a "#" catch-all.
  const groups: { letter: string; items: typeof sorted }[] = [];
  for (const b of sorted) {
    const letter = indexLetter(b.originalUsername);
    const last = groups[groups.length - 1];
    if (last && last.letter === letter) last.items.push(b);
    else groups.push({ letter, items: [b] });
  }

  return (
    <div>
      <h1>Brewers</h1>
      <p style={{ color: "var(--wh-text-light)", maxWidth: 720 }}>
        The archive&apos;s 200 most prolific brewers, listed A–Z. Every recipe stays attributed to
        the person who wrote it. Names are sorted the way their own alphabet sorts them, and names
        in other writing systems are grouped under their script rather than dumped at the end.
      </p>

      <nav style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", margin: "1rem 0" }}>
        {groups.map((g) => (
          <a
            key={g.letter}
            href={`#g-${encodeURIComponent(g.letter)}`}
            style={{
              fontSize: "0.85rem", padding: "0.15rem 0.5rem",
              border: "1px solid var(--wh-border)", borderRadius: 6, textDecoration: "none",
            }}
          >
            {g.letter}
          </a>
        ))}
      </nav>

      {groups.map((g) => (
        <section key={g.letter} id={`g-${encodeURIComponent(g.letter)}`}>
          <h2 style={{ fontSize: "1rem", marginBottom: "0.3rem" }}>{g.letter}</h2>
          <table>
            <thead>
              <tr>
                <th>Brewer</th>
                <th>Recipes</th>
              </tr>
            </thead>
            <tbody>
              {g.items.map((b) => {
                const script = detectScript(b.originalUsername);
                return (
                  <tr key={b.id}>
                    <td>
                      {/* lang/dir so a screen reader uses the right phonetics and
                          the browser picks the right font for Han glyphs. */}
                      <Link href={`/brewers/${b.id}`} {...langProps(b.originalUsername)}>
                        {b.originalUsername}
                      </Link>
                      {script.id !== "latin" && script.id !== "latin-ext" && (
                        <span style={{ fontSize: "0.72rem", color: "var(--wh-text-light)", marginLeft: "0.4rem" }}>
                          {script.label}
                        </span>
                      )}
                    </td>
                    <td>{b.recipes.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
