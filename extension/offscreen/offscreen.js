// Stream Subtitles - Offscreen Document
// 在 Manifest V3 中處理音訊擷取和 Deepgram 連線

let audioStream = null;
let deepgramSocket = null;
let mediaRecorder = null;
let isRecording = false;

const DEEPGRAM_URL = 'wss://api.deepgram.com/v1/listen';

console.log('[Offscreen] Offscreen document 已載入');

// 監聽來自 background 的訊息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Offscreen] 收到訊息:', message.action);

  switch (message.action) {
    case 'startCapture':
      startCapture(message.streamId, message.apiKey, message.language, message.autoDetect, message.keywords)
        .then(() => sendResponse({ success: true }))
        .catch(error => {
          console.error('[Offscreen] 啟動失敗:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // 保持訊息通道開啟

    case 'stopCapture':
      stopCapture();
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// 開始擷取音訊
async function startCapture(streamId, apiKey, language, autoDetect, keywords) {
  console.log('[Offscreen] 開始擷取音訊...');

  // 如果已經在錄音，先停止
  if (isRecording) {
    stopCapture();
  }

  try {
    // 使用 getUserMedia 搭配 chromeMediaSourceId 獲取音訊流
    audioStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      }
    });

    console.log('[Offscreen] 音訊流已建立');

    // 建立 MediaRecorder 來處理音訊資料
    mediaRecorder = new MediaRecorder(audioStream, {
      mimeType: 'audio/webm;codecs=opus'
    });

    // 連接到 Deepgram
    await connectToDeepgram(apiKey, language, autoDetect, keywords);

    // 當有音訊資料時，發送到 Deepgram
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && deepgramSocket && deepgramSocket.readyState === WebSocket.OPEN) {
        deepgramSocket.send(event.data);
      }
    };

    // 開始錄音（每 250ms 產生一塊資料）
    mediaRecorder.start(250);
    isRecording = true;

    console.log('[Offscreen] 開始錄音');

  } catch (error) {
    console.error('[Offscreen] 擷取失敗:', error);
    throw error;
  }
}

// 停止擷取
function stopCapture() {
  console.log('[Offscreen] 停止擷取');

  // 停止錄音
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }

  // 關閉音訊流
  if (audioStream) {
    audioStream.getTracks().forEach(track => track.stop());
    audioStream = null;
  }

  // 關閉 Deepgram 連線
  if (deepgramSocket) {
    deepgramSocket.close();
    deepgramSocket = null;
  }

  isRecording = false;
}

// 連接到 Deepgram
async function connectToDeepgram(apiKey, language, autoDetect, keywords) {
  return new Promise((resolve, reject) => {
    // 建構 WebSocket URL
    let url = `${DEEPGRAM_URL}?encoding=opus&sample_rate=48000&channels=1`;

    // 語言設定
    if (autoDetect) {
      url += '&detect_language=true';
    } else {
      url += `&language=${language}`;
    }

    // 其他參數
    url += '&punctuate=true';
    url += '&interim_results=true';
    url += '&endpointing=300';

    // 加入 keywords
    if (keywords && keywords.length > 0) {
      keywords.forEach(keyword => {
        url += `&keywords=${encodeURIComponent(keyword)}`;
      });
      console.log('[Offscreen] 已加入', keywords.length, '個 keywords');
    }

    // 建立 WebSocket 連線
    deepgramSocket = new WebSocket(url, ['token', apiKey]);

    deepgramSocket.onopen = () => {
      console.log('[Offscreen] Deepgram 連線成功');
      resolve();
    };

    deepgramSocket.onerror = (error) => {
      console.error('[Offscreen] Deepgram 錯誤:', error);
      reject(new Error('Deepgram 連線失敗'));
    };

    deepgramSocket.onclose = (event) => {
      console.log('[Offscreen] Deepgram 連線關閉:', event.code, event.reason);
    };

    deepgramSocket.onmessage = (event) => {
      handleDeepgramMessage(event.data);
    };
  });
}

// 處理 Deepgram 回應
function handleDeepgramMessage(data) {
  try {
    const response = JSON.parse(data);

    // 檢查是否有轉錄結果
    if (response.channel && response.channel.alternatives && response.channel.alternatives.length > 0) {
      const transcript = response.channel.alternatives[0].transcript;
      const isFinal = response.is_final;

      if (transcript) {
        // 發送字幕到 content script（透過 background）
        chrome.runtime.sendMessage({
          action: 'subtitle',
          text: transcript,
          isFinal: isFinal
        });
      }
    }

    // 處理語言檢測結果
    if (response.channel && response.channel.detected_language) {
      const detectedLang = response.channel.detected_language;
      console.log('[Offscreen] 偵測到語言:', detectedLang);

      chrome.runtime.sendMessage({
        action: 'languageDetected',
        language: detectedLang
      });
    }

  } catch (error) {
    console.error('[Offscreen] 解析 Deepgram 回應失敗:', error);
  }
}
