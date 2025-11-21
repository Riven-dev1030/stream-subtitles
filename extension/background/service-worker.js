// Stream Subtitles - Background Service Worker
// 處理音訊擷取、Deepgram 連線、和訊息傳遞

let audioStream = null;
let deepgramSocket = null;
let mediaRecorder = null;
let isRecording = false;
let currentLanguage = 'en'; // 預設英文
let autoDetect = false;
let customKeywords = []; // 自訂 keywords

// Deepgram API 設定
const DEEPGRAM_API_KEY = ''; // 使用者需要填入 API key
const DEEPGRAM_URL = 'wss://api.deepgram.com/v1/listen';

// 監聽來自 popup 和 content script 的訊息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] 收到訊息:', message);

  switch (message.action) {
    case 'startCapture':
      startCapture(message.tabId, message.language, message.autoDetect)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // 保持訊息通道開啟

    case 'stopCapture':
      stopCapture();
      sendResponse({ success: true });
      break;

    case 'changeLanguage':
      changeLanguage(message.language, message.autoDetect);
      sendResponse({ success: true });
      break;

    case 'getStatus':
      sendResponse({
        isRecording,
        currentLanguage,
        autoDetect,
        hasApiKey: !!DEEPGRAM_API_KEY
      });
      break;

    case 'updateCorrections':
      updateKeywordsFromCorrections(message.corrections);
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// 開始擷取音訊
async function startCapture(tabId, language = 'en', autoDetectMode = false) {
  console.log('[Background] 開始擷取音訊...');

  // 檢查 API key
  if (!DEEPGRAM_API_KEY) {
    throw new Error('請先設定 Deepgram API key！');
  }

  // 如果已經在錄音，先停止
  if (isRecording) {
    stopCapture();
  }

  try {
    // 設定語言
    currentLanguage = language;
    autoDetect = autoDetectMode;

    // 使用 chrome.tabCapture API 擷取分頁音訊
    audioStream = await chrome.tabCapture.capture({
      audio: true,
      video: false
    });

    if (!audioStream) {
      throw new Error('無法擷取音訊');
    }

    console.log('[Background] 音訊擷取成功');

    // 連線到 Deepgram
    await connectToDeepgram();

    // 開始處理音訊串流
    startAudioProcessing();

    isRecording = true;
    notifyContentScript('recordingStarted', { language: currentLanguage, autoDetect });

  } catch (error) {
    console.error('[Background] 擷取失敗:', error);
    stopCapture();
    throw error;
  }
}

// 停止擷取
function stopCapture() {
  console.log('[Background] 停止擷取');

  isRecording = false;

  // 停止 MediaRecorder
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }

  // 關閉 Deepgram 連線
  if (deepgramSocket && deepgramSocket.readyState === WebSocket.OPEN) {
    deepgramSocket.close();
  }

  // 停止音訊串流
  if (audioStream) {
    audioStream.getTracks().forEach(track => track.stop());
    audioStream = null;
  }

  notifyContentScript('recordingStopped');
}

// 連線到 Deepgram
async function connectToDeepgram() {
  return new Promise((resolve, reject) => {
    console.log('[Background] 連線到 Deepgram...');

    // 建立 WebSocket URL
    let url = `${DEEPGRAM_URL}?encoding=linear16&sample_rate=16000`;

    if (autoDetect) {
      url += '&detect_language=true';
    } else {
      url += `&language=${currentLanguage}`;
    }

    // 加入其他設定
    url += '&punctuate=true'; // 加入標點符號
    url += '&interim_results=true'; // 即時結果
    url += '&endpointing=300'; // 靜音偵測（300ms）

    // 加入自訂 keywords
    if (customKeywords.length > 0) {
      customKeywords.forEach(keyword => {
        url += `&keywords=${encodeURIComponent(keyword)}`;
      });
      console.log('[Background] 已加入', customKeywords.length, '個 keywords');
    }

    deepgramSocket = new WebSocket(url, ['token', DEEPGRAM_API_KEY]);

    deepgramSocket.onopen = () => {
      console.log('[Background] Deepgram 連線成功');
      resolve();
    };

    deepgramSocket.onmessage = (event) => {
      handleDeepgramMessage(event.data);
    };

    deepgramSocket.onerror = (error) => {
      console.error('[Background] Deepgram 錯誤:', error);
      reject(error);
    };

    deepgramSocket.onclose = () => {
      console.log('[Background] Deepgram 連線關閉');
    };
  });
}

// 處理 Deepgram 回傳的訊息
function handleDeepgramMessage(data) {
  try {
    const response = JSON.parse(data);

    // 檢查是否有轉錄結果
    if (response.channel?.alternatives?.[0]?.transcript) {
      const transcript = response.channel.alternatives[0].transcript;
      const isFinal = response.is_final;

      // 只處理有內容的結果
      if (transcript.trim()) {
        console.log('[Background] 字幕:', transcript, isFinal ? '(final)' : '(interim)');

        // 傳送字幕到 content script
        notifyContentScript('subtitle', {
          text: transcript,
          isFinal: isFinal,
          language: currentLanguage
        });
      }
    }
  } catch (error) {
    console.error('[Background] 解析 Deepgram 回應失敗:', error);
  }
}

// 開始音訊處理
function startAudioProcessing() {
  console.log('[Background] 開始音訊處理');

  // 使用 MediaRecorder 將音訊編碼為 Deepgram 可接受的格式
  const options = {
    mimeType: 'audio/webm;codecs=opus',
    audioBitsPerSecond: 16000
  };

  mediaRecorder = new MediaRecorder(audioStream, options);

  mediaRecorder.ondataavailable = async (event) => {
    if (event.data.size > 0 && deepgramSocket?.readyState === WebSocket.OPEN) {
      // 將音訊資料傳送到 Deepgram
      deepgramSocket.send(event.data);
    }
  };

  mediaRecorder.onerror = (error) => {
    console.error('[Background] MediaRecorder 錯誤:', error);
  };

  // 每 250ms 傳送一次資料（低延遲）
  mediaRecorder.start(250);
}

// 切換語言
function changeLanguage(language, autoDetectMode) {
  console.log('[Background] 切換語言:', language, '自動偵測:', autoDetectMode);

  const wasRecording = isRecording;
  const tabId = null; // 會從目前的 tab 取得

  // 如果正在錄音，需要重新連線
  if (wasRecording) {
    stopCapture();

    // 延遲一下再重新開始，確保資源釋放
    setTimeout(() => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          startCapture(tabs[0].id, language, autoDetectMode);
        }
      });
    }, 500);
  } else {
    currentLanguage = language;
    autoDetect = autoDetectMode;
  }

  notifyContentScript('languageChanged', { language, autoDetect });
}

// 通知 content script
function notifyContentScript(action, data = {}) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action,
        ...data
      }).catch(err => {
        // 忽略錯誤（content script 可能還沒載入）
        console.log('[Background] 無法傳送訊息到 content script:', err.message);
      });
    }
  });
}

// 從修正記錄更新 keywords
function updateKeywordsFromCorrections(corrections) {
  console.log('[Background] 更新 keywords，共', corrections.length, '筆修正');

  // 轉換為 Deepgram keywords 格式
  // 格式：word:boost_value（boost 值 1-10，建議 2-3）
  customKeywords = corrections
    .filter(c => c.count >= 1) // 至少出現 1 次
    .map(c => {
      // 根據出現次數決定 boost 值
      const boost = Math.min(3, 1 + Math.floor(c.count / 2));
      return `${c.correct}:${boost}`;
    });

  console.log('[Background] 已產生', customKeywords.length, '個 keywords:', customKeywords);

  // 如果正在錄音，需要重新連線才能套用新的 keywords
  if (isRecording) {
    console.log('[Background] 偵測到正在錄音，重新連線以套用 keywords...');
    const wasRecording = isRecording;
    stopCapture();

    setTimeout(() => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && wasRecording) {
          startCapture(tabs[0].id, currentLanguage, autoDetect);
        }
      });
    }, 500);
  }
}

// 載入自訂 keywords
function loadCustomKeywords() {
  chrome.storage.sync.get(['corrections'], (result) => {
    if (result.corrections && result.corrections.length > 0) {
      updateKeywordsFromCorrections(result.corrections);
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
});

// 啟動時載入 keywords
loadCustomKeywords();

console.log('[Background] Service worker 已載入');
