import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import InstallPrompt from "@/components/InstallPrompt";

export const metadata: Metadata = {
  title: "WortHogg",
  description:
    "WortHogg is an unofficial, community-recovered archive of BrewToad's homebrew recipes and calculator, recovered from the Internet Archive Wayback Machine.",
  applicationName: "WortHogg",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "WortHogg",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/brand/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#b55002",
  // The calculators have wide tables; let people zoom rather than trapping
  // them at 1x on a phone.
  width: "device-width",
  initialScale: 1,
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

        {/* Site header: logo + search, mirroring the original's site-header */}
        <header className="wh-header">
          <Link href="/" className="wh-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/mascot-64.png" alt="" className="wh-logo-mark" />
            WortHogg
          </Link>
          <form action="/recipes" method="get" className="wh-search">
            <input type="text" name="q" placeholder="Search recipes..." aria-label="Search recipes" />
            <button type="submit">Search</button>
          </form>
          {/* A plain link, deliberately: reading the session here would opt
              every page out of static rendering. /account handles auth state. */}
          <Link href="/account" className="wh-account-link">Account</Link>
        </header>

        {/* Site nav: the original's dropdown menu structure */}
        <nav className="site-nav">
          <ul>
            <li>
              <Link href="/recipes">Recipes</Link>
              <ul>
                <li><Link href="/recipes">All Recipes</Link></li>
                <li><Link href="/archive">Archive Insights</Link></li>
              </ul>
            </li>
            <li>
              <Link href="/brewers">Community</Link>
              <ul>
                <li><Link href="/brewers">Brewers</Link></li>
              </ul>
            </li>
            <li>
              <Link href="/ingredients">Styles &amp; Ingredients</Link>
              <ul>
                <li><Link href="/ingredients">All Ingredients</Link></li>
                <li><Link href="/styles">Styles</Link></li>
                <li><Link href="/guidelines">Style Guidelines</Link></li>
                <li><Link href="/fermentables/db">Fermentable Database</Link></li>
                <li><Link href="/hops/db">Hop Database</Link></li>
                <li><Link href="/yeasts/db">Yeast Database</Link></li>
                <li><Link href="/additives">Additives</Link></li>
                <li><Link href="/water">Water Profiles</Link></li>
                <li><Link href="/sources">Sources &amp; Provenance</Link></li>
              </ul>
            </li>
            <li>
              <Link href="/build">Tools &amp; Calculators</Link>
              <ul>
                <li><Link href="/build">Recipe Builder (all drinks)</Link></li>
                <li><Link href="/calculator">Beer Recipe Calculator</Link></li>
                <li><Link href="/tools">Brewer&apos;s Toolbox</Link></li>
                <li><Link href="/pitching">Yeast Pitching Rate</Link></li>
                <li><Link href="/water/builder">Water / Salt Calculator</Link></li>
                <li><Link href="/yeasts/propagation">Propagation Guide</Link></li>
                <li><Link href="/troubleshooting">Troubleshooting</Link></li>
              </ul>
            </li>
          </ul>
        </nav>

        <main className="wh-main">{children}</main>

        {/* Site footer, mirroring the original's column layout */}
        <footer className="site-footer">
          <div className="footer-col">
            <ul>
              <li>Home</li>
              <li><Link href="/recipes">All Recipes</Link></li>
              <li><Link href="/brewers">Brewers</Link></li>
              <li><Link href="/styles">Styles</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <ul>
              <li>Styles &amp; Ingredients</li>
              <li><Link href="/ingredients">All Ingredients</Link></li>
              <li><Link href="/guidelines">Style Guidelines</Link></li>
              <li><Link href="/fermentables/db">Fermentable Database</Link></li>
              <li><Link href="/hops/db">Hop Database</Link></li>
              <li><Link href="/yeasts/db">Yeast Database</Link></li>
              <li><Link href="/additives">Additives</Link></li>
              <li><Link href="/water">Water Profiles</Link></li>
              <li><Link href="/sources">Sources &amp; Provenance</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <ul>
              <li>Tools &amp; Calculators</li>
              <li><Link href="/build">Recipe Builder (all drinks)</Link></li>
              <li><Link href="/calculator">Beer Recipe Calculator</Link></li>
              <li><Link href="/tools">Brewer&apos;s Toolbox</Link></li>
              <li><Link href="/pitching">Yeast Pitching Rate</Link></li>
              <li><Link href="/water/builder">Water / Salt Calculator</Link></li>
              <li><Link href="/yeasts/propagation">Propagation Guide</Link></li>
              <li><Link href="/troubleshooting">Troubleshooting</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <ul>
              <li>Archive</li>
              <li><Link href="/archive">Archive Insights</Link></li>
              <li><Link href="/data-download">Download the data</Link></li>
              <li><Link href="/takedown">Request removal</Link></li>
              <li>
                <a href="https://web.archive.org" target="_blank" rel="noreferrer">
                  Data via the Wayback Machine
                </a>
              </li>
            </ul>
          </div>
        </footer>

        <InstallPrompt />
      </body>
    </html>
  );
}
