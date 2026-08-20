import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse must run in the Node runtime, not be bundled by Turbopack/webpack.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
