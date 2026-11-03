import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() { return [{ source: "/sw.js", headers: [
    { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
    { key: "Service-Worker-Allowed", value: "/" },
    { key: "Content-Type", value: "application/javascript; charset=utf-8" },
    { key: "Content-Security-Policy", value: "default-src 'self'; connect-src 'self'" },
  ] }]; },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
