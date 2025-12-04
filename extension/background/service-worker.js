// Stream Subtitles - Background Service Worker (Manifest V3)
// 支援 Web Speech API 與 Deepgram 雙引擎

console.log('[Background] Service worker 已載入');

// 動態導入模組
importScripts(
  '../utils/crypto-manager.js',
  './deepgram-client.js'
);

console.log('[Background] Deepgram 模組已載入');

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

// ============================================
// Deepgram 相關變數
// ============================================

let deepgramClient = null;
let cryptoManager = null;
let isDeepgramActive = false;

// 初始化加密管理器
async function initCryptoManager() {
  if (!cryptoManager) {
    cryptoManager = new CryptoManager();
    await cryptoManager.initialize();
    console.log('[Background] CryptoManager 已初始化');
  }
  return cryptoManager;
}

// ============================================
// 訊息處理
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] 收到訊息:', message.action);

  // 處理非同步訊息
  handleMessage(message, sender, sendResponse);

  return true; // 保持訊息通道開啟（非同步回應）
});

async function handleMessage(message, sender, sendResponse) {
  try {
    switch (message.action) {
      case 'updateCorrections':
        // 處理修正記錄更新
        console.log('[Background] 更新修正記錄，共', message.corrections?.length || 0, '筆');
        sendResponse({ success: true });
        break;

      case 'testDeepgramConnection':
        // 測試 Deepgram 連接
        await handleTestDeepgram(sendResponse);
        break;

      case 'updateDeepgramKey':
        // API Key 已更新，清除當前客戶端
        handleUpdateDeepgramKey(sendResponse);
        break;

      case 'getStatus':
        // 取得狀態
        sendResponse({
          isRecording: false,
          currentLanguage: 'en',
          autoDetect: false,
          isDeepgramActive: isDeepgramActive
        });
        break;

      default:
        sendResponse({ success: true });
    }
  } catch (error) {
    console.error('[Background] 處理訊息失敗:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// ============================================
// Deepgram 測試連接
// ============================================

async function handleTestDeepgram(sendResponse) {
  try {
    console.log('[Background] 測試 Deepgram 連接...');

    // 初始化加密管理器
    const crypto = await initCryptoManager();

    // 取得解密的 API Key
    const apiKey = await crypto.getApiKey();

    if (!apiKey) {
      sendResponse({
        success: false,
        error: '未找到 API Key'
      });
      return;
    }

    // 使用靜態方法驗證 API Key
    const isValid = await DeepgramClient.validateApiKey(apiKey);

    if (isValid) {
      console.log('[Background] Deepgram 連接測試成功');
      sendResponse({
        success: true,
        message: '連接成功'
      });
    } else {
      console.error('[Background] Deepgram API Key 無效');
      sendResponse({
        success: false,
        error: 'API Key 無效或連接失敗'
      });
    }
  } catch (error) {
    console.error('[Background] 測試 Deepgram 失敗:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// ============================================
// 更新 Deepgram Key
// ============================================

function handleUpdateDeepgramKey(sendResponse) {
  console.log('[Background] API Key 已更新，重置 Deepgram 客戶端');

  // 如果有正在運行的客戶端，斷開連接
  if (deepgramClient) {
    deepgramClient.disconnect();
    deepgramClient = null;
  }

  isDeepgramActive = false;

  sendResponse({ success: true });
}

// ============================================
// Deepgram 啟動邏輯 (MVP - 待實作)
// ============================================

// TODO: 實作完整的 Deepgram 音訊捕獲與串流
// 這部分需要更複雜的實作，包括：
// 1. 使用 chrome.tabCapture 捕獲音訊
// 2. 處理音訊格式轉換
// 3. 串流到 Deepgram WebSocket
// 4. 接收結果並發送到 Content Script

console.log('[Background] Service Worker 初始化完成（Deepgram MVP）');
