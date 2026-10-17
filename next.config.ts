import type { NextConfig } from "next";

const config: NextConfig = { reactStrictMode: true, devIndicators: false, allowedDevOrigins: ["127.0.0.1", "localhost"],
  distDir: process.env.PAIN_JOURNAL_DIST_DIR ?? ".next" };
export default config;
