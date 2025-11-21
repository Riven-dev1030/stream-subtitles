// Stream Subtitles - Background Service Worker (Manifest V3)
// 簡化版本 - 主要功能已移至 content script

console.log('[Background] Service worker 已載入（使用 Web Speech API）');

// 擴充功能安裝或更新時
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Background] 擴充功能已安裝/更新:', details.reason);

  // 設定預設值
  chrome.storage.sync.set({
    language: 'en',
    autoDetect: false,
    subtitleStyle: {
      fontSize: '24px',
      fontFamily: 'Arial, sans-serif',
      color: '#FFFFFF',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      position: 'bottom'
    }
  });

  console.log('[Background] 使用 Web Speech API（瀏覽器內建，直接在頁面中運作）');
});

// 監聽訊息（保留以備將來擴展）
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] 收到訊息:', message.action);

  switch (message.action) {
    case 'updateCorrections':
      // 處理修正記錄更新
      console.log('[Background] 更新修正記錄，共', message.corrections?.length || 0, '筆');
      sendResponse({ success: true });
      break;

    default:
      // 其他訊息直接回傳成功
      sendResponse({ success: true });
  }

  return true; // 保持訊息通道開啟
});
