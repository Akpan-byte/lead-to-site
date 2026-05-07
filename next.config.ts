import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // GitHub Pages requires static export — no server-side features
  output: 'export',
  images: {
    unoptimized: true,
  },
  // GitHub Pages base path
  basePath: '/lead-to-site',
  assetPrefix: '/lead-to-site/',
};

export default nextConfig;
