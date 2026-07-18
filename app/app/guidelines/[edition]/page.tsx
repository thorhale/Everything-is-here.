export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { getEdition, getEditions, styleHref } from "@/lib/guidelines";

interface Props {
  params: Promise<{ edition: string }>;
}

export default async function EditionPage({ params }: Props) {
  const { edition: editionId } = await params;
  const edition = await getEdition(editionId);
  if (!edition) notFound();

  const siblings = (await getEditions()).filter((e) => e.system === edition.system);

  return (
    <div>
      <h1>{edition.title}</h1>
      <p style={{ color: "var(--wh-text-light)", fontSize: "0.9rem" }}>
        {edition.attribution}{" "}
        <a href={edition.sourceUrl} target="_blank" rel="noreferrer">
          Source
        </a>
      </p>
      {siblings.length > 1 && (
        <p>
          Other editions:{" "}
          <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "0.3rem" }}>
            {siblings.map((e) =>
              e.id === edition.id ? (
                <span key={e.id} className="wh-style-chip active">{e.year}</span>
              ) : (
                <Link key={e.id} href={`/guidelines/${e.id}`} className="wh-style-chip">
                  {e.year}
                </Link>
              )
            )}
          </span>
        </p>
      )}

      {edition.categories.map((cat) => (
        <section key={cat.id} style={{ marginBottom: "1rem" }}>
          <h3>
            {cat.code ? `${cat.code}. ` : ""}
            {cat.name}
          </h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {cat.styles.map((s) => (
              <li key={s.id} style={{ padding: "0.3rem 0", borderBottom: "1px solid #eee" }}>
                <Link href={styleHref(edition.id, s)} style={{ fontWeight: 600 }}>
                  {s.code ? `${s.code}. ` : ""}
                  {s.name}
                </Link>
                <span style={{ color: "var(--wh-text-light)", fontSize: "0.85rem", marginLeft: 8 }}>
                  {s.abvMin != null && s.abvMax != null && `${s.abvMin}-${s.abvMax}% ABV`}
                  {s.ibuMin != null && s.ibuMax != null && ` · ${s.ibuMin}-${s.ibuMax} IBU`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p>
        <Link href="/guidelines">← All guideline systems</Link>
      </p>
    </div>
  );
}
