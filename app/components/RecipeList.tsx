import Link from "next/link";
import { srmClass } from "@/components/StatBars";

interface RecipeRow {
  id: string;
  slug: string;
  title: string | null;
  styleName: string | null;
  abv: number | null;
  ibu: number | null;
  srm: number | null;
  brewer: { originalUsername: string } | null;
}

export function RecipeList({ recipes }: { recipes: RecipeRow[] }) {
  return (
    <ul style={{ listStyle: "none", padding: 0 }}>
      {recipes.map((r) => (
        <li key={r.id} style={{ padding: "0.75rem 0", borderBottom: "1px solid #eee" }}>
          <span className={`swatch ${srmClass(r.srm)}`} />
          <Link href={`/recipes/${r.slug}`} style={{ fontWeight: 600 }}>
            {r.title ?? r.slug}
          </Link>
          <div style={{ fontSize: "0.85rem", color: "var(--wh-text-light)", marginLeft: 20 }}>
            {r.styleName ?? "Unknown style"}
            {r.abv ? ` · ${r.abv}% ABV` : ""}
            {r.ibu ? ` · ${r.ibu} IBU` : ""}
            {r.brewer ? ` · by ${r.brewer.originalUsername}` : ""}
          </div>
        </li>
      ))}
    </ul>
  );
}
