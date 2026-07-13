import { addPrompt } from "./lib/vault";

const MENU_ID = "save-to-prompt-diary";
const TITLE_MAX = 60;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Save to Prompt Diary",
    contexts: ["selection"],
  });
});

function flashBadge() {
  chrome.action.setBadgeText({ text: "+1" });
  chrome.action.setBadgeBackgroundColor({ color: "#1c6b4a" });
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 2000);
}

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== MENU_ID || !info.selectionText) return;
  const text = info.selectionText.trim();
  if (!text) return;

  const title =
    text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX).trimEnd()}…` : text;

  void addPrompt({ title, body: text }).then(flashBadge);
});

// one-click saves from the content script (selection bubble / composer button)
chrome.runtime.onMessage.addListener(
  (msg: { type?: string; title?: string; body?: string }, _sender, sendResponse) => {
    if (msg?.type !== "save-prompt" || !msg.body) return;
    void addPrompt({ title: msg.title ?? msg.body.slice(0, TITLE_MAX), body: msg.body })
      .then(() => {
        flashBadge();
        sendResponse({ ok: true });
      })
      .catch(() => sendResponse({ ok: false }));
    return true; // keep the message channel open for the async response
  },
);
