import type { NextConfig } from "next";

/**
 * NEXT_DIST_DIR lets a second Next instance (the API/E2E test server) run in
 * this same project directory without clashing with the dev server's
 * `.next/dev/lock` — tests pass NEXT_DIST_DIR=.next-test.
 */
const nextConfig: NextConfig = {
  output: "standalone",
  // Hide the Next.js Dev Tools button (dev overlay) — dev builds stay clean.
  devIndicators: false,
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
