import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Prompt Diary",
  version: "0.1.0",
  description:
    "A password-manager-style vault for your best AI prompts. Save, organize, and reuse prompts from ChatGPT, Claude, and anywhere else.",
  action: {
    default_popup: "index.html",
    default_title: "Prompt Diary",
  },
  background: {
    service_worker: "src/background.ts",
    type: "module",
  },
  permissions: ["storage", "contextMenus", "clipboardWrite", "identity"],
  // VITE_API_URL=https://your-app.vercel.app bun run build  → store build
  host_permissions: [`${process.env.VITE_API_URL ?? "http://localhost:3000"}/*`],
  icons: {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png",
  },
});
