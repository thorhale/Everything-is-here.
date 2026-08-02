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
      "/data-download": ["../data/reference-export.json"],
      "/data": ["../data/reference-export.json"],
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
