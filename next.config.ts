import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // API routes require server-side rendering — do NOT use output: 'export'
  images: {
    unoptimized: true,
  },
  // GitHub Pages base path (remove if deploying to Vercel)
  basePath: '/lead-to-site',
  assetPrefix: '/lead-to-site/',
};

export default nextConfig;
