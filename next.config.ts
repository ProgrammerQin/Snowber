import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components (Next.js 16): data is dynamic by default; pages stream their
  // request-time parts (session, database) behind <Suspense> boundaries.
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Native/server-only packages loaded from node_modules at runtime.
  serverExternalPackages: ["@prisma/adapter-pg", "pg", "sharp"],
  poweredByHeader: false,
};

export default nextConfig;
