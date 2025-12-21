// Stream Subtitles - Background Service Worker (Manifest V3)
// 支援 Web Speech API 與 Deepgram 雙引擎

console.log('[Background] Service worker 已載入');

// 動態導入模組（路徑相對於 service-worker.js 所在目錄）
importScripts(
  '../utils/crypto-manager.js',      // 回到上層目錄，再進入 utils/
  './deepgram-client.js',            // 同目錄下的 deepgram-client.js
  './claude-translator.js'           // Claude 翻譯客戶端
);

console.log('[Background] Deepgram 與 Claude 翻譯模組已載入');

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
// Deepgram 與翻譯相關變數
// ============================================

let deepgramClient = null;
let claudeTranslator = null;
let cryptoManager = null;
let isDeepgramActive = false;
let currentTabId = null;
let offscreenDocumentCreated = false;

// 翻譯設定
let translationEnabled = false;
let targetLanguage = 'zh-TW'; // 預設翻譯目標語言

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
  console.log('[Background] 🏗️ 準備創建 Offscreen Document...');

  // 檢查是否已經存在
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });

  if (existingContexts.length > 0) {
    console.log('[Background] ℹ️ Offscreen Document 已存在，先關閉舊的');
    // 如果已存在，先關閉再重新創建（確保乾淨狀態）
    await closeOffscreenDocument();
  }

  // 創建新的 Offscreen Document
  try {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('offscreen/offscreen.html'),
      reasons: ['USER_MEDIA'], // 用於音訊捕獲
      justification: 'Capture tab audio for speech recognition with Deepgram'
    });

    offscreenDocumentCreated = true;
    console.log('[Background] ✅ Offscreen Document 已創建');
  } catch (error) {
    console.error('[Background] ❌ 創建 Offscreen Document 失敗:', error);
    throw error;
  }
}

/**
 * 關閉 Offscreen Document
 */
async function closeOffscreenDocument() {
  if (!offscreenDocumentCreated) {
    console.log('[Background] ℹ️ Offscreen Document 未創建，無需關閉');
    return;
  }

  try {
    console.log('[Background] 🗑️ 正在關閉 Offscreen Document...');
    await chrome.offscreen.closeDocument();
    offscreenDocumentCreated = false;
    console.log('[Background] ✅ Offscreen Document 已關閉');

    // **新增：等待一小段時間確保 Offscreen Document 完全關閉**
    await new Promise(resolve => setTimeout(resolve, 100));
  } catch (error) {
    console.error('[Background] ❌ 關閉 Offscreen Document 失敗:', error);
    // 即使失敗也要重置標誌，避免狀態不一致
    offscreenDocumentCreated = false;
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

      case 'testClaudeConnection':
        // 測試 Claude API 連接
        await handleTestClaude(sendResponse);
        break;

      case 'getTranslationStats':
        // 取得翻譯統計
        handleGetTranslationStats(sendResponse);
        break;

      case 'clearTranslationCache':
        // 清除翻譯快取
        handleClearTranslationCache(sendResponse);
        break;

      case 'updateDeepgramKey':
        // API Key 已更新，清除當前客戶端
        handleUpdateDeepgramKey(sendResponse);
        break;

      case 'startDeepgramRecognition':
        // 開始 Deepgram 語音辨識
        await handleStartDeepgramRecognition(message.tabId, message.language, message.autoDetect, sendResponse);
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
          const statusResponse = {
            isRecording: isDeepgramActive, // Deepgram 運行狀態
            currentLanguage: 'zh-TW',
            autoDetect: false,
            isDeepgramActive: isDeepgramActive,
            currentEngine: selectedEngine // 使用用戶選擇的引擎，而不是根據運行狀態判斷
          };

          // 添加日誌以診斷狀態同步問題
          console.log('[Background] getStatus 返回:', statusResponse);

          sendResponse(statusResponse);
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

async function handleStartDeepgramRecognition(tabId, language = 'zh-TW', autoDetect = false, sendResponse) {
  try {
    console.log(`[Background] 開始 Deepgram 語音辨識，Tab: ${tabId}, 語言: ${language}, 自動檢測: ${autoDetect}`);

    // **關鍵修復：如果已在運行，先完全停止並等待清理完成**
    if (isDeepgramActive) {
      console.warn('[Background] Deepgram 已在運行，先完全停止...');
      await handleStopDeepgramRecognition(() => {});

      // **新增：等待一小段時間確保所有資源完全釋放**
      console.log('[Background] 等待資源完全釋放...');
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('[Background] ✅ 資源已釋放，可以重新啟動');
    }

    // **關鍵修復：確保 Content Script 已就緒**
    await ensureContentScriptReady(tabId);

    // 1. 初始化加密管理器並取得 Deepgram API Key
    const crypto = await initCryptoManager();
    const apiKey = await crypto.getApiKey();

    if (!apiKey) {
      throw new Error('未設定 Deepgram API Key');
    }

    // 1.5 讀取翻譯設定並初始化 Claude 翻譯器（如果啟用）
    const settings = await chrome.storage.sync.get(['translationEnabled', 'targetLanguage']);
    translationEnabled = settings.translationEnabled || false;
    targetLanguage = settings.targetLanguage || 'zh-TW';

    if (translationEnabled) {
      console.log('[Background] 翻譯已啟用，目標語言:', targetLanguage);

      // 取得 Claude API Key
      const claudeApiKey = await crypto.getClaudeApiKey();

      if (claudeApiKey) {
        // 初始化 Claude 翻譯器
        claudeTranslator = new ClaudeTranslator(claudeApiKey, {
          model: 'claude-3-5-haiku-20241022'
        });
        console.log('[Background] ✅ Claude 翻譯器已初始化');
      } else {
        console.warn('[Background] ⚠️ 翻譯已啟用但未設定 Claude API Key，將不進行翻譯');
        translationEnabled = false;
      }
    } else {
      console.log('[Background] 翻譯未啟用');
      claudeTranslator = null;
    }

    // 2. 初始化 DeepgramClient
    // 如果啟用自動檢測，使用 'multi' 語言模式（支援多語言 code-switching）
    const actualLanguage = autoDetect ? 'multi' : language;
    console.log('[Background] 初始化 Deepgram Client，語言:', actualLanguage, autoDetect ? '(多語言自動檢測)' : '');
    console.log('[Background] API Key 前綴:', apiKey ? apiKey.substring(0, 10) + '...' : 'null');

    // **關鍵修復：總是創建新的 DeepgramClient，確保乾淨狀態**
    if (deepgramClient) {
      console.log('[Background] 舊的 Deepgram Client 存在，先清理');
      try {
        deepgramClient.disconnect();
      } catch (error) {
        console.warn('[Background] 清理舊 Client 失敗:', error);
      }
    }

    deepgramClient = new DeepgramClient(apiKey, { language: actualLanguage });
    console.log('[Background] ✅ 新的 Deepgram Client 已創建');

    // 3. 設定 Deepgram 結果回調
    deepgramClient.onResult = async (result) => {
      console.log('[Background] Deepgram 結果:', result.isFinal ? 'Final' : 'Interim', result.text);
      if (result.language) {
        console.log('[Background] 檢測到語言:', result.language, '信心度:', result.languageConfidence);
      }

      // 準備要轉發的結果
      const resultToSend = {
        text: result.text,
        isFinal: result.isFinal,
        confidence: result.confidence,
        timestamp: result.timestamp,
        language: result.language,
        languageConfidence: result.languageConfidence,
        translatedText: null  // 翻譯文字（如果有）
      };

      // 如果啟用翻譯且有 Claude 翻譯器，則進行翻譯
      if (translationEnabled && claudeTranslator && result.text) {
        try {
          console.log('[Background] 開始翻譯:', result.text.substring(0, 30) + '...');
          const sourceLang = result.language || null;
          const translationResult = await claudeTranslator.translate(
            result.text,
            targetLanguage,
            sourceLang
          );

          resultToSend.translatedText = translationResult.translatedText;

          console.log('[Background] 翻譯完成:', translationResult.cached ? '(快取)' : '(API)',
                      translationResult.translatedText.substring(0, 30) + '...');
        } catch (error) {
          console.error('[Background] 翻譯失敗:', error);
          // 翻譯失敗不影響原文顯示
        }
      }

      // 轉發結果到 Content Script（包含翻譯）
      chrome.tabs.sendMessage(tabId, {
        action: 'deepgramResult',
        result: resultToSend
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

    // **關鍵修復：通知 Content Script Deepgram 已啟動**
    chrome.tabs.sendMessage(tabId, {
      action: 'deepgramStarted'
    }).catch(err => {
      console.warn('[Background] 通知 Content Script Deepgram 已啟動失敗:', err.message);
    });

    console.log('[Background] ✅ Deepgram 已完全啟動');

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

    // **關鍵修復：立即更新狀態，避免狀態不一致**
    isDeepgramActive = false;
    const stoppedTabId = currentTabId;
    currentTabId = null;

    // 通知頁面 Deepgram 已停止
    if (stoppedTabId) {
      chrome.tabs.sendMessage(stoppedTabId, {
        action: 'deepgramStopped'
      }).catch(err => {
        // 忽略錯誤（頁面可能已關閉）
        console.log('[Background] 通知頁面停止失敗（頁面可能已關閉）:', err.message);
      });
    }

    // 清理資源（在狀態更新後執行，避免阻塞）
    await cleanupDeepgramResources();

    sendResponse({
      success: true,
      message: 'Deepgram 語音辨識已停止'
    });
  } catch (error) {
    console.error('[Background] 停止 Deepgram 失敗:', error);

    // 確保狀態被重置，即使清理失敗
    isDeepgramActive = false;
    currentTabId = null;

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
  console.log('[Background] 🧹 開始清理 Deepgram 資源...');

  // 1. 斷開 Deepgram WebSocket 連接（先斷開，避免繼續接收數據）
  if (deepgramClient) {
    try {
      console.log('[Background] 📡 關閉 Deepgram WebSocket 連接...');
      deepgramClient.disconnect();
      deepgramClient = null;
      console.log('[Background] ✅ Deepgram WebSocket 已關閉');
    } catch (error) {
      console.error('[Background] ❌ 斷開 Deepgram 連接失敗:', error);
    }
  } else {
    console.log('[Background] ℹ️ 無需關閉 Deepgram（客戶端不存在）');
  }

  // 2. 通知 Offscreen Document 停止音訊捕獲
  if (offscreenDocumentCreated) {
    try {
      console.log('[Background] 🎤 通知 Offscreen Document 停止音訊捕獲...');
      await chrome.runtime.sendMessage({
        action: 'stopAudioCapture'
      });
      console.log('[Background] ✅ Offscreen Document 音訊捕獲已停止');
    } catch (error) {
      console.error('[Background] ❌ 通知 Offscreen 停止失敗:', error);
    }
  } else {
    console.log('[Background] ℹ️ 無需停止音訊捕獲（Offscreen Document 未創建）');
  }

  // 3. 關閉 Offscreen Document
  console.log('[Background] 🗑️ 關閉 Offscreen Document...');
  await closeOffscreenDocument();
  console.log('[Background] ✅ Offscreen Document 已關閉');

  // 注意：不再在這裡重置 isDeepgramActive 和 currentTabId
  // 這些狀態應該由調用者在清理前就設置好，以確保狀態立即更新

  console.log('[Background] ✅ Deepgram 資源清理完成');
}

console.log('[Background] Service Worker 初始化完成（Deepgram Phase 2）');

// ============================================
// Tab 生命週期監聽 - 自動清理資源
// ============================================

/**
 * 監聽 Tab 移除事件
 * 當用戶關閉正在錄音的 Tab 時，自動停止 Deepgram 並清理資源
 */
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (isDeepgramActive && tabId === currentTabId) {
    console.log(`[Background] Tab ${tabId} 已關閉，自動停止 Deepgram`);

    // 立即重置狀態
    isDeepgramActive = false;
    currentTabId = null;

    // 清理資源
    cleanupDeepgramResources().catch(err => {
      console.error('[Background] 自動清理失敗:', err);
    });
  }
});

/**
 * 監聽 Tab 更新事件
 * 當用戶刷新正在錄音的 Tab 時，自動停止 Deepgram 並清理資源
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // **關鍵修復：處理頁面刷新（loading）或導航（url 改變）**
  // 刷新時 changeInfo.url 可能不存在，但 status 會變成 'loading'
  if (changeInfo.status === 'loading') {
    if (isDeepgramActive && tabId === currentTabId) {
      console.log(`[Background] Tab ${tabId} 正在刷新/導航（status: loading），自動停止 Deepgram`);

      // 立即重置狀態
      isDeepgramActive = false;
      currentTabId = null;

      // 清理資源
      cleanupDeepgramResources().catch(err => {
        console.error('[Background] 自動清理失敗:', err);
      });
    }
  }
});

console.log('[Background] Tab 生命週期監聽器已設置');


// ============================================
// Claude 翻譯相關函數
// ============================================

/**
 * 測試 Claude API 連接
 */
async function handleTestClaude(sendResponse) {
  try {
    console.log('[Background] 測試 Claude API 連接');

    const crypto = await initCryptoManager();
    const apiKey = await crypto.getClaudeApiKey();

    if (!apiKey) {
      sendResponse({
        success: false,
        error: '未找到 Claude API Key'
      });
      return;
    }

    // 使用靜態方法驗證 API Key
    const isValid = await ClaudeTranslator.validateApiKey(apiKey);

    if (isValid) {
      console.log('[Background] Claude API 連接測試成功');
      sendResponse({
        success: true,
        message: '連接成功'
      });
    } else {
      console.error('[Background] Claude API Key 無效');
      sendResponse({
        success: false,
        error: 'API Key 無效或連接失敗'
      });
    }
  } catch (error) {
    console.error('[Background] Claude 測試失敗:', error);
    sendResponse({
      success: false,
      error: error.message || '測試失敗'
    });
  }
}

/**
 * 取得翻譯統計
 */
function handleGetTranslationStats(sendResponse) {
  if (claudeTranslator) {
    const stats = claudeTranslator.getStats();
    console.log('[Background] 翻譯統計:', stats);
    sendResponse({
      success: true,
      stats: stats
    });
  } else {
    sendResponse({
      success: false,
      error: '翻譯器未初始化'
    });
  }
}

/**
 * 清除翻譯快取
 */
function handleClearTranslationCache(sendResponse) {
  if (claudeTranslator) {
    claudeTranslator.clearCache();
    console.log('[Background] 翻譯快取已清除');
    sendResponse({
      success: true,
      message: '快取已清除'
    });
  } else {
    sendResponse({
      success: false,
      error: '翻譯器未初始化'
    });
  }
}

console.log('[Background] Claude 翻譯功能已載入');
