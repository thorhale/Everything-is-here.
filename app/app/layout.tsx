import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "BrewToad Archive",
  description:
    "An unofficial, community-recovered archive of BrewToad's homebrew recipes and calculator, recovered from the Internet Archive Wayback Machine.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", color: "#1a1a1a" }}>
        <div
          style={{
            background: "#3a2a1a",
            color: "#f5e9d8",
            padding: "0.5rem 1rem",
            fontSize: "0.85rem",
            textAlign: "center",
          }}
        >
          Unofficial, unaffiliated historical archive. Recipes were recovered from the
          Internet Archive after the original BrewToad site shut down in 2018.{" "}
          <Link href="/takedown" style={{ color: "#f5e9d8", textDecoration: "underline" }}>
            Request removal
          </Link>
        </div>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1.5rem",
            padding: "1rem 1.5rem",
            borderBottom: "1px solid #ddd",
          }}
        >
          <Link href="/" style={{ fontWeight: 700, fontSize: "1.25rem", color: "#1a1a1a", textDecoration: "none" }}>
            🐸 BrewToad Archive
          </Link>
          <nav style={{ display: "flex", gap: "1rem" }}>
            <Link href="/recipes">Recipes</Link>
            <Link href="/calculator">Calculator</Link>
          </nav>
        </header>
        <main style={{ padding: "1.5rem", maxWidth: 960, margin: "0 auto" }}>{children}</main>
      </body>
    </html>
  );
}
