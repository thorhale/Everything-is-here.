import type { MetadataRoute } from "next";

// PWA manifest. Chrome's install criteria are: a manifest with name,
// short_name, start_url, a standalone display mode, and icons at 192 and 512
// px — plus a service worker with a fetch handler (see public/sw.js, registered
// by components/ServiceWorker.tsx). The maskable variants keep the hog inside a
// safe zone so Android can crop the icon to a circle or squircle without
// lopping his snout off.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WortHogg — Homebrew Archive & Calculators",
    short_name: "WortHogg",
    description:
      "117,000 recovered homebrew recipes, a recipe builder for beer, cider, wine, mead and spirits, and sourced databases of yeast, malt, hops, water and world style guidelines.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f5f5f0",
    theme_color: "#b55002",
    categories: ["food", "utilities", "productivity"],
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Recipe builder", short_name: "Build", url: "/build" },
      { name: "Browse recipes", short_name: "Recipes", url: "/recipes" },
      { name: "Ingredients", short_name: "Ingredients", url: "/ingredients" },
      { name: "Style guidelines", short_name: "Styles", url: "/guidelines" },
    ],
  };
}
