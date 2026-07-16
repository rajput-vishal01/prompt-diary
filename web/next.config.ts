import type { NextConfig } from "next";
import path from "node:path";

// single .env at the repo root feeds everything
try {
  process.loadEnvFile(path.join(__dirname, "..", ".env"));
} catch {
  // no root .env (e.g. Vercel, where env comes from the dashboard)
}

const nextConfig: NextConfig = {
  transpilePackages: ["shared"],
  // Isolate the production build's output dir so a running `next dev` (which
  // owns `.next`) can't corrupt it and vice-versa — the two share `.next` by
  // default and clobber each other, producing phantom PageNotFoundError /
  // routes-manifest.json ENOENT failures. NEXT_BUILD_DIR is unset on Vercel,
  // so deploys keep using `.next` exactly as before.
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
