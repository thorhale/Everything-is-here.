"use client";

// "Shop this recipe": one row per ingredient, with a buy link at each enabled
// retailer. Renders NOTHING while the affiliate scaffold is dormant (no retailer
// enabled), so it is inert until a real tag is added in lib/retailers.ts.
import { enabledRetailers, buyQuery, buyUrl, type BuyItem, type BuyQueryOpts } from "@/lib/buy-links";
import AffiliateDisclosure from "@/components/AffiliateDisclosure";

export default function ShopThisRecipe({ items, opts }: { items: BuyItem[]; opts?: BuyQueryOpts }) {
  const retailers = enabledRetailers();
  if (retailers.length === 0 || items.length === 0) return null;

  return (
    <fieldset style={{ border: "1px solid var(--wh-border)", borderRadius: 8, padding: "0.75rem 1rem", marginTop: "1rem" }}>
      <legend style={{ fontWeight: 600, padding: "0 0.4rem" }}>Shop this recipe</legend>
      <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
        <tbody>
          {items.map((item, i) => {
            const q = buyQuery(item, opts);
            return (
              <tr key={`${item.cls}-${item.name}-${i}`} style={{ borderBottom: "1px solid var(--wh-border)" }}>
                <td style={{ padding: "0.35rem 0.4rem" }}>
                  {item.brand ? `${item.brand} ` : ""}
                  {item.name}
                  {item.cls === "hop" && item.country ? ` (${item.country})` : ""}
                  {item.cls === "yeast" && item.lab ? ` — ${item.lab}` : ""}
                </td>
                <td style={{ padding: "0.35rem 0.4rem", textAlign: "right", whiteSpace: "nowrap" }}>
                  {retailers.map((r) => (
                    <a
                      key={r.id}
                      href={buyUrl(r, q)}
                      target="_blank"
                      rel="nofollow sponsored noreferrer"
                      style={{ marginLeft: "0.6rem" }}
                    >
                      {r.name}
                    </a>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <AffiliateDisclosure />
    </fieldset>
  );
}
