import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#f4f6f4",
        raised: "#ffffff",
        hover: "#ecf1ed",
        line: "#dde4de",
        ink: "#13271e",
        dim: "#5f6f65",
        accent: "#1c6b4a",
        "accent-deep": "#14523a",
        tint: "#e7f0ea",
        amber: "#8a5a06",
        danger: "#9f2d20",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
