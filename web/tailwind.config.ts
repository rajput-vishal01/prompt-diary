import type { Config } from "tailwindcss";

// ElevenLabs-style editorial system: off-white canvas, warm near-black ink,
// no saturated accent — the ink pill IS the CTA. Pastel orb tokens are
// atmosphere on the landing page only, never component fills.
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#f5f5f5", // canvas
        raised: "#ffffff", // surface-card
        hover: "#efedec",
        line: "#e7e5e4", // hairline
        "line-strong": "#d6d3d1",
        ink: "#0c0a09",
        body: "#4e4e4e",
        dim: "#57534e", // muted — ≥4.5:1 on canvas
        accent: "#292524", // ink primary: CTAs, selection
        "accent-deep": "#0c0a09", // press state
        tint: "#f0efed", // surface-strong: selected bg, badges
        amber: "#8a5a06", // team visibility (semantic)
        danger: "#dc2626",
        success: "#16a34a",
        "orb-mint": "#a7e5d3",
        "orb-peach": "#f4c5a8",
        "orb-lavender": "#c8b8e0",
        "orb-sky": "#a8c8e8",
        "orb-rose": "#e8b8c4",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        display: ["var(--font-display)", "Times New Roman", "serif"],
      },
      boxShadow: {
        soft: "0 4px 16px rgba(0, 0, 0, 0.04)", // the single shadow tier
      },
    },
  },
  plugins: [],
} satisfies Config;
