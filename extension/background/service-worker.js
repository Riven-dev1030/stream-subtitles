// Stream Subtitles - Background Service Worker (Manifest V3)
// 使用 Offscreen Document API 處理音訊擷取和語音辨識

let isRecording = false;
let currentLanguage = 'en'; // 預設英文
let autoDetect = false;
let customKeywords = []; // 自訂 keywords（保留以供未來使用）

const OFFSCREEN_DOCUMENT_PATH = 'offscreen/offscreen.html';

// 確保 offscreen document 存在
async function setupOffscreenDocument() {
  // 檢查是否已經有 offscreen document
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)]
  });

  if (existingContexts.length > 0) {
    console.log('[Background] Offscreen document 已存在');
    return; // 已經存在
  }

  // 創建 offscreen document
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: ['USER_MEDIA'], // 用於 getUserMedia
    justification: 'Recording audio from tab for real-time transcription'
  });

  console.log('[Background] Offscreen document 已創建');

  // 等待 offscreen document 完全載入
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log('[Background] Offscreen document 已就緒');
}

// 監聽來自 popup、content script 和 offscreen 的訊息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] 收到訊息:', message.action);

  switch (message.action) {
    case 'startCapture':
      startCapture(message.streamId, message.language, message.autoDetect)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // 保持訊息通道開啟

    case 'stopCapture':
      stopCapture()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // 保持訊息通道開啟

    case 'changeLanguage':
      changeLanguage(message.language, message.autoDetect)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // 保持訊息通道開啟

    case 'getStatus':
      sendResponse({
        isRecording,
        currentLanguage,
        autoDetect
      });
      break;

    case 'updateCorrections':
      updateKeywordsFromCorrections(message.corrections);
      sendResponse({ success: true });
      break;

    // 從 offscreen document 轉發字幕到 content script
    case 'subtitle':
      notifyContentScript('subtitle', {
        text: message.text,
        isFinal: message.isFinal,
        confidence: message.confidence,
        language: currentLanguage
      });
      break;

    // 從 offscreen document 轉發語言檢測結果
    case 'languageDetected':
      console.log('[Background] 偵測到語言:', message.language);
      notifyContentScript('languageDetected', {
        language: message.language
      });
      break;

    // 處理語音辨識錯誤
    case 'recognitionError':
      console.error('[Background] Speech Recognition 錯誤:', message.error);
      notifyContentScript('recognitionError', {
        error: message.error
      });
      break;

    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// 開始擷取音訊
async function startCapture(streamId, language = 'en', autoDetectMode = false) {
  console.log('[Background] 開始擷取音訊，stream ID:', streamId);

  // 檢查 stream ID
  if (!streamId) {
    throw new Error('無效的 stream ID');
  }

  // 如果已經在錄音，先停止並等待清理完成
  if (isRecording) {
    console.log('[Background] 偵測到正在錄音，先停止舊的錄音...');
    await stopCapture();
    // 等待一下確保資源完全釋放
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('[Background] 舊的錄音已停止，資源已清理');
  }

  try {
    // 設定語言
    currentLanguage = language;
    autoDetect = autoDetectMode;

    // 確保 offscreen document 存在
    await setupOffscreenDocument();

    // 發送訊息到 offscreen document 開始錄音
    console.log('[Background] 發送訊息到 offscreen document...');
    const response = await chrome.runtime.sendMessage({
      action: 'startCapture',
      streamId: streamId,
      language: currentLanguage,
      autoDetect: autoDetect,
      keywords: customKeywords
    });

    console.log('[Background] Offscreen 回應:', response);

    if (!response || !response.success) {
      throw new Error(response?.error || '啟動 offscreen document 失敗');
    }

    isRecording = true;
    notifyContentScript('recordingStarted', { language: currentLanguage, autoDetect });

    console.log('[Background] 錄音已開始');

  } catch (error) {
    console.error('[Background] 擷取失敗:', error);
    console.error('[Background] 錯誤類型:', error.name, '錯誤訊息:', error.message);
    isRecording = false;

    // 通知 content script 錄音失敗
    notifyContentScript('recordingError', {
      error: error.message || '啟動失敗'
    });

    // 拋出錯誤，讓 popup 可以處理
    throw error;
  }
}

// 停止擷取
async function stopCapture() {
  console.log('[Background] 停止擷取');

  isRecording = false;

  // 發送訊息到 offscreen document 停止錄音並等待完成
  try {
    await chrome.runtime.sendMessage({
      action: 'stopCapture'
    });
    console.log('[Background] Offscreen document 已確認停止');
  } catch (err) {
    console.log('[Background] 無法傳送停止訊息到 offscreen:', err.message);
  }

  notifyContentScript('recordingStopped');
}

// 切換語言
async function changeLanguage(language, autoDetectMode) {
  console.log('[Background] 切換語言:', language, '自動偵測:', autoDetectMode);

  // 更新語言設定
  currentLanguage = language;
  autoDetect = autoDetectMode;

  // 如果正在錄音，提示用戶需要重新啟動
  if (isRecording) {
    console.log('[Background] 錄音中切換語言，需要用戶重新啟動錄音');
    await stopCapture();
    notifyContentScript('languageChanged', {
      language,
      autoDetect,
      needRestart: true
    });
  } else {
    notifyContentScript('languageChanged', { language, autoDetect });
  }
}

// 通知 content script（帶重試機制）
function notifyContentScript(action, data = {}, retries = 3) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action,
        ...data
      }).then(() => {
        console.log('[Background] 已通知 content script:', action);
      }).catch(err => {
        // Content script 可能還沒載入，這不是嚴重錯誤
        if (retries > 0) {
          console.log(`[Background] Content script 暫時無法連接，將重試... (剩餘 ${retries} 次)`);
          // 500ms 後重試
          setTimeout(() => {
            notifyContentScript(action, data, retries - 1);
          }, 500);
        } else {
          console.log('[Background] Content script 無法連接（這不影響字幕功能）:', err.message);
        }
      });
    }
  });
}

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

  console.log('[Background] 使用 Web Speech API（瀏覽器內建）');
});

// 從修正記錄更新 keywords（保留以供未來使用）
function updateKeywordsFromCorrections(corrections) {
  console.log('[Background] 更新 keywords，共', corrections.length, '筆修正');

  // 暫時保存，未來可用於改進辨識
  customKeywords = corrections.map(c => c.correct);

  console.log('[Background] 已儲存', customKeywords.length, '個關鍵字');
}

// 載入自訂 keywords
function loadCustomKeywords() {
  chrome.storage.sync.get(['corrections'], (result) => {
    if (result.corrections && result.corrections.length > 0) {
      updateKeywordsFromCorrections(result.corrections);
    }
  });
}

// Service worker 啟動時載入 keywords
console.log('[Background] Service worker 已載入（使用 Web Speech API）');

// 啟動時載入 keywords
loadCustomKeywords();
