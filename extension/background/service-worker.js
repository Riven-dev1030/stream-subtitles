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
        // 取得狀態 - 從 storage 讀取用戶選擇的引擎
        chrome.storage.sync.get(['recognitionEngine'], (result) => {
          const selectedEngine = result.recognitionEngine || 'webspeech';
          sendResponse({
            isRecording: isDeepgramActive, // Deepgram 運行狀態
            currentLanguage: 'zh-TW',
            autoDetect: false,
            isDeepgramActive: isDeepgramActive,
            currentEngine: selectedEngine // 使用用戶選擇的引擎，而不是根據運行狀態判斷
          });
        });
        return true; // 保持消息通道開啟以支持異步響應

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

/**
 * 確保 Content Script 已注入並就緒
 */
async function ensureContentScriptReady(tabId, maxRetries = 5) {
  // 首先嘗試 ping，檢查 Content Script 是否已存在
  try {
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
    console.log('[Background] Content Script 已就緒');
    return true;
  } catch (error) {
    console.log('[Background] Content Script 不存在，開始注入...');
  }

  // Content Script 不存在，需要注入
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content/content.js']
    });

    // 注入 CSS
    await chrome.scripting.insertCSS({
      target: { tabId: tabId },
      files: ['styles/content.css']
    });

    console.log('[Background] Content Script 注入成功');
  } catch (injectError) {
    console.error('[Background] 注入 Content Script 失敗:', injectError);
    throw new Error('無法注入 Content Script，請確認頁面權限');
  }

  // 注入後，重試 ping 直到成功或達到最大重試次數
  for (let i = 0; i < maxRetries; i++) {
    try {
      // 每次重試前等待一段時間（遞增等待時間）
      const waitTime = 200 * (i + 1); // 200ms, 400ms, 600ms, 800ms, 1000ms
      await new Promise(resolve => setTimeout(resolve, waitTime));

      console.log(`[Background] 嘗試 ping Content Script (${i + 1}/${maxRetries})...`);
      await chrome.tabs.sendMessage(tabId, { action: 'ping' });

      console.log('[Background] Content Script 初始化完成');
      return true;
    } catch (pingError) {
      console.warn(`[Background] Ping 失敗 (${i + 1}/${maxRetries}):`, pingError.message);

      // 如果是最後一次重試，拋出錯誤
      if (i === maxRetries - 1) {
        throw new Error(`Content Script 注入後無法連接（已重試 ${maxRetries} 次）`);
      }
    }
  }
}

async function handleStartDeepgramRecognition(tabId, language = 'zh-TW', sendResponse) {
  try {
    console.log(`[Background] 開始 Deepgram 語音辨識，Tab: ${tabId}, 語言: ${language}`);

    // 如果已經在運行，先停止
    if (isDeepgramActive) {
      console.warn('[Background] Deepgram 已在運行，先停止...');
      await handleStopDeepgramRecognition(() => {});
    }

    // **關鍵修復：確保 Content Script 已就緒**
    await ensureContentScriptReady(tabId);

    // 1. 初始化加密管理器並取得 API Key
    const crypto = await initCryptoManager();
    const apiKey = await crypto.getApiKey();

    if (!apiKey) {
      throw new Error('未設定 Deepgram API Key');
    }

    // 2. 初始化 DeepgramClient
    console.log('[Background] 初始化 Deepgram Client，語言:', language);
    console.log('[Background] API Key 前綴:', apiKey ? apiKey.substring(0, 10) + '...' : 'null');

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

      // 提取錯誤訊息
      let errorMsg = 'Deepgram 連接錯誤';
      if (error && typeof error === 'object') {
        errorMsg = error.message || error.type || errorMsg;
      } else if (typeof error === 'string') {
        errorMsg = error;
      }

      // 通知 Content Script 發生錯誤
      chrome.tabs.sendMessage(tabId, {
        action: 'deepgramError',
        error: errorMsg
      }).catch(err => {
        console.error('[Background] 轉發錯誤到 Content Script 失敗:', err);
      });

      // 只在已經連接後才自動停止（避免在連接過程中的錯誤循環）
      if (isDeepgramActive && deepgramClient.isConnected) {
        console.log('[Background] Deepgram 已連接但發生錯誤，自動停止');
        handleStopDeepgramRecognition(() => {});
      }
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
