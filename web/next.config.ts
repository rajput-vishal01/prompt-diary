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
