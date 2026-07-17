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
  experimental: {
    // react-icons/si is one giant module (every simple-icons glyph) — without
    // this the landing page compiles and ships the whole set for 12 logos
    optimizePackageImports: ["react-icons/si"],
  },
  // Isolate the production build's output dir so a running `next dev` (which
  // owns `.next`) can't corrupt it and vice-versa — the two share `.next` by
  // default and clobber each other, producing phantom PageNotFoundError /
  // routes-manifest.json ENOENT failures. NEXT_BUILD_DIR is unset on Vercel,
  // so deploys keep using `.next` exactly as before.
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  async headers() {
    // CSP/HSTS only in prod: next dev needs unsafe-eval for source maps, and
    // HSTS on localhost is meaningless. 'unsafe-inline' script stays until a
    // nonce pipeline exists — the CSP still blocks every EXTERNAL script,
    // object/embed, and framing.
    const prodOnly =
      process.env.NODE_ENV === "production"
        ? [
            {
              key: "Content-Security-Policy",
              value: [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline'",
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data: blob: https://res.cloudinary.com https://lh3.googleusercontent.com",
                "connect-src 'self' https://api.cloudinary.com",
                "font-src 'self' data:",
                "object-src 'none'",
                "frame-ancestors 'none'",
                "base-uri 'self'",
                "form-action 'self'",
              ].join("; "),
            },
            {
              key: "Strict-Transport-Security",
              value: "max-age=31536000; includeSubDomains",
            },
          ]
        : [];
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
          ...prodOnly,
        ],
      },
    ];
  },
};

export default nextConfig;
