import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "WortHogg",
  description:
    "WortHogg is an unofficial, community-recovered archive of BrewToad's homebrew recipes and calculator, recovered from the Internet Archive Wayback Machine.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="wh-disclaimer">
          WortHogg is an unofficial, unaffiliated historical archive. Recipes were recovered
          from the Internet Archive after the original BrewToad site shut down in 2018.{" "}
          <Link href="/takedown">Request removal</Link>
        </div>
        <header className="wh-header">
          <Link href="/" className="wh-logo">
            🐗 WortHogg
          </Link>
          <nav>
            <Link href="/recipes">Recipes</Link>
            <Link href="/calculator">Calculator</Link>
          </nav>
        </header>
        <main className="wh-main">{children}</main>
      </body>
    </html>
  );
}
