import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // PGlite (tests de bout en bout) charge des fichiers WebAssembly : ne pas l'empaqueter.
  serverExternalPackages: ["@electric-sql/pglite"],
  partialPrefetching: true,
  // Les stats sont désormais la page d'accueil : les anciens liens vers /stats y mènent.
  async redirects() {
    return [{ source: "/stats", destination: "/", permanent: true }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
