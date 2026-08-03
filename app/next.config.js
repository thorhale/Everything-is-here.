/** @type {import('next').NextConfig} */
const nextConfig = {
  // The data/ directory sits OUTSIDE this Next app (it is a sibling, at the
  // repo root), and pages that read it at request time — /sources reading the
  // source registry — get a bare ENOENT on Vercel unless the files are traced
  // into the serverless bundle. Next cannot infer this: the paths are built
  // with join(process.cwd(), "..", ...), so there is no static import to follow.
  //
  // This failure mode is quiet, which is the dangerous part: the pages catch
  // the read error and degrade, so the deployment looks healthy while showing
  // nothing. Declaring the includes is what actually ships the files.
  // Next 14 keeps this under `experimental`; it only moved to the top level in
  // Next 15. Setting it top-level here is silently ignored apart from an
  // "Unrecognized key" warning, which is exactly the sort of quiet miss this
  // block is meant to prevent.
  experimental: {
    outputFileTracingIncludes: {
      "/sources": ["../data/sources/registry.json"],
      "/fermentation": ["../data/fermentation/archetypes.json"],
      // Tier 3 of docs/storage-efficiency.md: the archive's ingredients are
      // gzipped static shards, not Postgres rows. They are read with
      // join(process.cwd(), "..", ...), so no static import points at them and
      // Next cannot infer the dependency — without these entries the pages
      // deploy and quietly render no ingredients at all.
      "/recipes/[slug]": [
        "../data/recipes/ingredients/**",
        "../data/recipes/archive-rollups.json.gz",
      ],
      "/recipes/[slug]/beerxml": ["../data/recipes/ingredients/**"],
      "/hops/[name]": ["../data/recipes/archive-rollups.json.gz"],
      "/yeasts/[name]": ["../data/recipes/archive-rollups.json.gz"],
      "/yeasts/db/[id]": ["../data/yeasts/lineages.json"],
      "/fermentables/[name]": ["../data/recipes/archive-rollups.json.gz"],
      "/ingredients": ["../data/recipes/archive-rollups.json.gz"],
      "/guidelines/[edition]/[code]": ["../data/recipes/archive-rollups.json.gz"],
      "/data-download": ["../data/reference-export.json"],
      "/data": ["../data/reference-export.json"],
      // Prices are read from disk at request time like the source registry, so
      // they need tracing in or the column silently renders empty on Vercel.
      "/water": ["../data/water/prices.json"],
      "/water/[id]": ["../data/water/prices.json"],
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
