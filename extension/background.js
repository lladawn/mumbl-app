// Toolbar click toggles the transform on the active tab. Kept in the service
// worker so the content script owns no UI of its own — the page is the UI.
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "mumbl-pixel-toggle" });
  } catch {
    // No content script on this page (chrome://, the web store, a PDF).
    // Nothing to do — silently ignoring is correct here; there is no page to skin.
  }
});
