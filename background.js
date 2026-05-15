// 工具栏图标点击 → 切换工具栏可见
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'wh-toggle-toolbar' });
  } catch (e) {
    // content script 未注入（特殊页面），忽略
  }
});

// 快捷键
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    if (command === 'toggle-toolbar') {
      await chrome.tabs.sendMessage(tab.id, { type: 'wh-toggle-toolbar' });
    } else if (command === 'undo-highlight') {
      await chrome.tabs.sendMessage(tab.id, { type: 'wh-undo' });
    }
  } catch (e) {}
});
