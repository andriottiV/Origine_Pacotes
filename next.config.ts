import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Freeze absence too: runtime-only values must not masquerade as build-time
  // public configuration. Never add private variables to this public bundle map.
  env: { NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "" },
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
