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

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== MENU_ID || !info.selectionText) return;
  const text = info.selectionText.trim();
  if (!text) return;

  const title =
    text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX).trimEnd()}…` : text;

  void addPrompt({ title, body: text }).then(() => {
    chrome.action.setBadgeText({ text: "+1" });
    chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), 2000);
  });
});
