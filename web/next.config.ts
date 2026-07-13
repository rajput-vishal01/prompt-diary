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
};

export default nextConfig;
