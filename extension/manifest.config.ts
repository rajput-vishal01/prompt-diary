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
  content_scripts: [
    {
      // save surfaces + the usage-limit tracker on every major AI chat site.
      // Tracking is send-event based (no per-site selectors), so a new model
      // site only needs a match here + an entry in lib/limits.ts SITES.
      matches: [
        "https://chatgpt.com/*",
        "https://chat.openai.com/*",
        "https://claude.ai/*",
        "https://gemini.google.com/*",
        "https://www.perplexity.ai/*",
        "https://poe.com/*",
        "https://chat.deepseek.com/*",
        "https://grok.com/*",
        "https://copilot.microsoft.com/*",
        "https://chat.mistral.ai/*",
        "https://kimi.com/*",
        "https://www.kimi.com/*",
        "https://chat.qwen.ai/*",
        "https://www.meta.ai/*",
        "https://meta.ai/*",
      ],
      js: ["src/content.ts"],
      run_at: "document_idle",
    },
  ],
  commands: {
    _execute_action: {
      suggested_key: { default: "Alt+P" },
      description: "Open Prompt Diary",
    },
  },
  // activeTab + scripting: opening the popup counts as invoking the action,
  // which grants temporary access to the current tab — that's what lets
  // Enter insert into the focused field on ANY site, not just the AI chat
  // sites with a content script
  permissions: ["storage", "contextMenus", "clipboardWrite", "identity", "activeTab", "scripting"],
  // VITE_API_URL=https://your-app.vercel.app bun run build  → store build
  host_permissions: [`${process.env.VITE_API_URL ?? "http://localhost:3000"}/*`],
  icons: {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png",
  },
});
