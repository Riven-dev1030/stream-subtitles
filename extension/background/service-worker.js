// Stream Subtitles - Background Service Worker (Manifest V3)
// 支援 Web Speech API 與 Deepgram 雙引擎

console.log('[Background] Service worker 已載入');

// 動態導入模組（路徑相對於 service-worker.js 所在目錄）
importScripts(
  '../utils/crypto-manager.js',      // 回到上層目錄，再進入 utils/
  './deepgram-client.js'             // 同目錄下的 deepgram-client.js
);

console.log('[Background] Deepgram 模組已載入（使用 Offscreen Document 處理音訊）');

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
let currentTabId = null;
let offscreenDocumentCreated = false;

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
// Offscreen Document 管理
// ============================================

/**
 * 創建 Offscreen Document
 */
async function createOffscreenDocument() {
  // 檢查是否已經存在
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });

  if (existingContexts.length > 0) {
    console.log('[Background] Offscreen Document 已存在');
    offscreenDocumentCreated = true;
    return;
  }

  // 創建新的 Offscreen Document
  await chrome.offscreen.createDocument({
    url: chrome.runtime.getURL('offscreen/offscreen.html'),
    reasons: ['USER_MEDIA'], // 用於音訊捕獲
    justification: 'Capture tab audio for speech recognition with Deepgram'
  });

  offscreenDocumentCreated = true;
  console.log('[Background] Offscreen Document 已創建');
}

/**
 * 關閉 Offscreen Document
 */
async function closeOffscreenDocument() {
  if (!offscreenDocumentCreated) {
    return;
  }

  try {
    await chrome.offscreen.closeDocument();
    offscreenDocumentCreated = false;
    console.log('[Background] Offscreen Document 已關閉');
  } catch (error) {
    console.error('[Background] 關閉 Offscreen Document 失敗:', error);
  }
}

/**
 * 處理來自 Offscreen Document 的音訊數據
 */
function handleAudioData(audioDataArray) {
  if (!deepgramClient || !deepgramClient.isConnected) {
    return;
  }

  // 將陣列轉換回 Int16Array
  const int16Data = new Int16Array(audioDataArray);

  // 發送到 Deepgram
  deepgramClient.sendAudio(int16Data.buffer);
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

      case 'startDeepgramRecognition':
        // 開始 Deepgram 語音辨識
        await handleStartDeepgramRecognition(message.tabId, message.language, sendResponse);
        break;

      case 'stopDeepgramRecognition':
        // 停止 Deepgram 語音辨識
        await handleStopDeepgramRecognition(sendResponse);
        break;

      case 'audioData':
        // 來自 Offscreen Document 的音訊數據
        handleAudioData(message.data);
        sendResponse({ success: true });
        break;

      case 'audioCaptureStarted':
        // Offscreen Document 音訊捕獲已啟動
        console.log('[Background] Offscreen Document 音訊捕獲已啟動');
        sendResponse({ success: true });
        break;

      case 'audioCaptureStopped':
        // Offscreen Document 音訊捕獲已停止
        console.log('[Background] Offscreen Document 音訊捕獲已停止');
        sendResponse({ success: true });
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
// Deepgram 語音辨識 - 開始
// ============================================

async function handleStartDeepgramRecognition(tabId, language = 'zh-TW', sendResponse) {
  try {
    console.log(`[Background] 開始 Deepgram 語音辨識，Tab: ${tabId}, 語言: ${language}`);

    // 如果已經在運行，先停止
    if (isDeepgramActive) {
      console.warn('[Background] Deepgram 已在運行，先停止...');
      await handleStopDeepgramRecognition(() => {});
    }

    // 1. 初始化加密管理器並取得 API Key
    const crypto = await initCryptoManager();
    const apiKey = await crypto.getApiKey();

    if (!apiKey) {
      throw new Error('未設定 Deepgram API Key');
    }

    // 2. 初始化 DeepgramClient
    if (!deepgramClient) {
      deepgramClient = new DeepgramClient(apiKey, { language });
    }

    // 3. 設定 Deepgram 結果回調
    deepgramClient.onResult = (result) => {
      console.log('[Background] Deepgram 結果:', result.isFinal ? 'Final' : 'Interim', result.text);

      // 轉發結果到 Content Script
      chrome.tabs.sendMessage(tabId, {
        action: 'deepgramResult',
        result: {
          text: result.text,
          isFinal: result.isFinal,
          confidence: result.confidence,
          timestamp: result.timestamp
        }
      }).catch(err => {
        console.error('[Background] 轉發結果到 Content Script 失敗:', err);
      });
    };

    // 4. 設定 Deepgram 錯誤回調
    deepgramClient.onError = (error) => {
      console.error('[Background] Deepgram 錯誤:', error);

      // 通知 Content Script 發生錯誤
      chrome.tabs.sendMessage(tabId, {
        action: 'deepgramError',
        error: error.message || 'Deepgram 連接錯誤'
      }).catch(err => {
        console.error('[Background] 轉發錯誤到 Content Script 失敗:', err);
      });

      // 停止辨識
      handleStopDeepgramRecognition(() => {});
    };

    // 5. 連接到 Deepgram
    await deepgramClient.connect();
    console.log('[Background] Deepgram WebSocket 已連接');

    // 6. 創建 Offscreen Document
    await createOffscreenDocument();

    // 7. 取得 Tab 的 MediaStream ID
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tabId
    });

    console.log('[Background] 已取得 streamId:', streamId);

    // 8. 通知 Offscreen Document 開始音訊捕獲
    await chrome.runtime.sendMessage({
      action: 'startAudioCapture',
      streamId: streamId
    });

    console.log('[Background] 已通知 Offscreen Document 開始音訊捕獲');

    // 9. 更新狀態
    isDeepgramActive = true;
    currentTabId = tabId;

    sendResponse({
      success: true,
      message: 'Deepgram 語音辨識已啟動'
    });
  } catch (error) {
    console.error('[Background] 啟動 Deepgram 失敗:', error);

    // 清理資源
    await cleanupDeepgramResources();

    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// ============================================
// Deepgram 語音辨識 - 停止
// ============================================

async function handleStopDeepgramRecognition(sendResponse) {
  try {
    console.log('[Background] 停止 Deepgram 語音辨識');

    await cleanupDeepgramResources();

    sendResponse({
      success: true,
      message: 'Deepgram 語音辨識已停止'
    });
  } catch (error) {
    console.error('[Background] 停止 Deepgram 失敗:', error);

    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// ============================================
// Deepgram 資源清理
// ============================================

async function cleanupDeepgramResources() {
  console.log('[Background] 清理 Deepgram 資源');

  // 通知 Offscreen Document 停止音訊捕獲
  if (offscreenDocumentCreated) {
    try {
      await chrome.runtime.sendMessage({
        action: 'stopAudioCapture'
      });
    } catch (error) {
      console.error('[Background] 通知 Offscreen 停止失敗:', error);
    }
  }

  // 斷開 Deepgram 連接
  if (deepgramClient) {
    deepgramClient.disconnect();
  }

  // 關閉 Offscreen Document
  await closeOffscreenDocument();

  // 重置狀態
  isDeepgramActive = false;
  currentTabId = null;

  console.log('[Background] Deepgram 資源已清理');
}

console.log('[Background] Service Worker 初始化完成（Deepgram Phase 2）');
