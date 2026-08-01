// A static route, so `revalidate` would make Next prerender it at build time,
// where there is no database. Rendered per request instead; the detail routes
// that carry the real DB load are the ones cached.
export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/db";
import { unstable_cache } from "next/cache";

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
      ) t
      ORDER BY lower(t."originalUsername") ASC`,
  ["top-brewers"],
  { revalidate: 3600 }
);

export default async function BrewersPage() {
  const brewers = await getTopBrewers();

  return (
    <div>
      <h1>Brewers</h1>
      <p style={{ color: "var(--wh-text-light)" }}>
        The archive&apos;s 200 most prolific brewers, listed A–Z. Every recipe stays attributed to the
        person who wrote it.
      </p>
      <table>
        <thead>
          <tr>
            <th>Brewer</th>
            <th>Recipes</th>
          </tr>
        </thead>
        <tbody>
          {brewers.map((b) => (
            <tr key={b.id}>
              <td>
                <Link href={`/brewers/${b.id}`}>{b.originalUsername}</Link>
              </td>
              <td>{b.recipes.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
