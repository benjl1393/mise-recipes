const MENU_ID = "mise-fire-selection";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Fire selected text to Mise",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id || !info.selectionText) return;
  // Stash the selection so the popup extracts from it instead of the whole page.
  await chrome.storage.local.set({
    "mise:selection": {
      text: info.selectionText,
      source: tab.url ?? "",
      tabId: tab.id,
      at: Date.now(),
    },
  });
  await chrome.action.openPopup();
});
