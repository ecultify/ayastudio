import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Next 16 has no built-in lint step; ESLint runs separately via `npm run lint`. */

  /*
   * Keep lightningcss + the Tailwind v4 node packages out of the Turbopack
   * bundle. lightningcss loads its native .node binary via a dynamic
   * `require(`lightningcss-${platform}-${arch}`)`, which Turbopack can't
   * statically resolve — bundling it makes that require throw and fall back to
   * a non-existent path ("Cannot find module '../lightningcss.darwin-arm64.node'").
   * Externalizing forces native Node require, which resolves the binary fine.
   */
  serverExternalPackages: [
    "lightningcss",
    "@tailwindcss/node",
    "@tailwindcss/postcss",
  ],
};

export default nextConfig;
