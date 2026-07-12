import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0f1117",
        raised: "#171a23",
        hover: "#1e2230",
        line: "#262b3b",
        dim: "#8b91a7",
        accent: "#6366f1",
      },
    },
  },
  plugins: [],
} satisfies Config;
