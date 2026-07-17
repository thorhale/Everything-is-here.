export const dynamic = "force-dynamic";

import Link from "next/link";
import { getStyles } from "@/lib/ingredients";

export const metadata = { title: "Styles - WortHogg" };

export default async function StylesPage() {
  const styles = await getStyles();

  return (
    <div>
      <h1>Styles</h1>
      <p style={{ color: "var(--wh-text-light)" }}>
        Every beer style represented in the archive, by number of recipes.
      </p>
      <table>
        <thead>
          <tr>
            <th>Style</th>
            <th>Recipes</th>
          </tr>
        </thead>
        <tbody>
          {styles.map((s) => (
            <tr key={s.styleName}>
              <td>
                <Link href={`/recipes?style=${encodeURIComponent(s.styleName ?? "")}`}>
                  {s.styleName}
                </Link>
              </td>
              <td>{s._count.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
