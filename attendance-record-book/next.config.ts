import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: false, // 개발 중에는 비활성화 (성능 개선)
  // Ensure Turbopack uses this project as the root to avoid scanning outside
  turbopack: {
    root: __dirname,
  },
  typescript: {
    tsconfigPath: "./tsconfig.json",
  },
};

export default nextConfig;
