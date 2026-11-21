const MENU_ID = 'vocab-bubble-lookup';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Tra từ "%s"',
      contexts: ['selection']
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;

  const message = { type: 'VB_LOOKUP', text: (info.selectionText || '').trim() };
  const options = { frameId: info.frameId ?? 0 };

  try {
    await chrome.tabs.sendMessage(tab.id, message, options);
  } catch {
    // Content script chưa có trong tab (tab mở trước khi cài/reload extension) -> inject rồi gửi lại
    try {
      const target = { tabId: tab.id, frameIds: [options.frameId] };
      await chrome.scripting.insertCSS({ target, files: ['content.css'] });
      await chrome.scripting.executeScript({ target, files: ['content.js'] });
      await chrome.tabs.sendMessage(tab.id, message, options);
    } catch (err) {
      console.warn('[Vocab Bubble] Không thể tra từ trên trang này:', err);
    }
  }
});
