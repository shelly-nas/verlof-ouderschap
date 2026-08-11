import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Slanke productie-image: alleen de benodigde node_modules worden meegekopieerd.
  output: "standalone",
  // Zonder dit zoekt Turbopack naar een lockfile buiten de repo.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
