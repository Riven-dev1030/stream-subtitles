// Stream Subtitles - Background Service Worker
// 處理音訊擷取、Deepgram 連線、和訊息傳遞

let audioStream = null;
let deepgramSocket = null;
let mediaRecorder = null;
let isRecording = false;
let currentLanguage = 'en'; // 預設英文
let autoDetect = false;
let cachedApiKey = null; // 快取 API key

// Deepgram API 設定
const DEEPGRAM_URL = 'wss://api.deepgram.com/v1/listen';

// 載入 API key
async function loadApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['deepgramApiKey'], (result) => {
      cachedApiKey = result.deepgramApiKey || null;
      resolve(cachedApiKey);
    });
  });
}

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
        hasApiKey: !!cachedApiKey
      });
      break;

    case 'reloadApiKey':
      loadApiKey().then((key) => {
        console.log('[Background] API key 已重新載入:', key ? '有 key' : '無 key');
        sendResponse({ success: true, hasApiKey: !!key });
      });
      return true; // 保持訊息通道開啟

    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// 開始擷取音訊
async function startCapture(tabId, language = 'en', autoDetectMode = false) {
  console.log('[Background] 開始擷取音訊...');

  // 載入 API key
  const apiKey = await loadApiKey();

  // 檢查 API key
  if (!apiKey) {
    throw new Error('請先設定 Deepgram API key！請到擴充功能設定中輸入你的 API key。');
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

    // 連線到 Deepgram（傳入 API key）
    await connectToDeepgram(apiKey);

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
async function connectToDeepgram(apiKey) {
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

    // 使用傳入的 API key
    deepgramSocket = new WebSocket(url, ['token', apiKey]);

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

  // 載入 API key（如果存在）
  loadApiKey().then((key) => {
    if (key) {
      console.log('[Background] 已找到儲存的 API key');
    } else {
      console.log('[Background] 未找到 API key，請到設定中輸入');
    }
  });
});

// Service worker 啟動時載入 API key
loadApiKey().then((key) => {
  console.log('[Background] Service worker 已載入', key ? '(有 API key)' : '(無 API key)');
});
