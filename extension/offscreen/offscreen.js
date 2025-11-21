// Stream Subtitles - Offscreen Document
// 在 Manifest V3 中處理音訊擷取和 Deepgram 連線

let audioStream = null;
let deepgramSocket = null;
let mediaRecorder = null;
let isRecording = false;
let audioContext = null;
let audioSource = null;

const DEEPGRAM_URL = 'wss://api.deepgram.com/v1/listen';

console.log('[Offscreen] Offscreen document 已載入');

// 監聽來自 background 的訊息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Offscreen] 收到訊息:', message.action);

  switch (message.action) {
    case 'startCapture':
      console.log('[Offscreen] 收到 startCapture 請求，streamId:', message.streamId);
      startCapture(message.streamId, message.apiKey, message.language, message.autoDetect, message.keywords)
        .then(() => {
          console.log('[Offscreen] startCapture 成功完成');
          sendResponse({ success: true });
        })
        .catch(error => {
          console.error('[Offscreen] 啟動失敗 - name:', error.name, 'message:', error.message);
          console.error('[Offscreen] 完整錯誤:', error);
          sendResponse({ success: false, error: error.message || String(error) });
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
    console.log('[Offscreen] 嘗試獲取音訊流，stream ID:', streamId);

    audioStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    });

    console.log('[Offscreen] 音訊流已建立，tracks:', audioStream.getTracks().length);

    // 創建 AudioContext 來播放音訊（否則用戶會聽不到聲音）
    try {
      audioContext = new AudioContext();
      audioSource = audioContext.createMediaStreamSource(audioStream);
      audioSource.connect(audioContext.destination);
      console.log('[Offscreen] 音訊播放已啟用');
    } catch (err) {
      console.warn('[Offscreen] 無法啟用音訊播放:', err);
    }

    // 建立 MediaRecorder 來處理音訊資料
    mediaRecorder = new MediaRecorder(audioStream, {
      mimeType: 'audio/webm;codecs=opus'
    });

    console.log('[Offscreen] MediaRecorder 已建立，state:', mediaRecorder.state);

    // 連接到 Deepgram
    await connectToDeepgram(apiKey, language, autoDetect, keywords);

    // 當有音訊資料時，發送到 Deepgram
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && deepgramSocket && deepgramSocket.readyState === WebSocket.OPEN) {
        deepgramSocket.send(event.data);
      }
    };

    mediaRecorder.onerror = (event) => {
      console.error('[Offscreen] MediaRecorder 錯誤:', event.error);
    };

    // 開始錄音（每 250ms 產生一塊資料）
    mediaRecorder.start(250);
    isRecording = true;

    console.log('[Offscreen] 開始錄音，MediaRecorder state:', mediaRecorder.state);

  } catch (error) {
    console.error('[Offscreen] 擷取失敗:', error);
    console.error('[Offscreen] 錯誤詳情 - name:', error.name, 'message:', error.message);
    if (error.name === 'NotAllowedError') {
      console.error('[Offscreen] 權限被拒絕，可能需要用戶授權');
    } else if (error.name === 'NotFoundError') {
      console.error('[Offscreen] 找不到音訊源，streamId 可能無效:', streamId);
    } else if (error.name === 'AbortError') {
      console.error('[Offscreen] 操作被中止');
    }
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

  // 停止音訊播放
  if (audioSource) {
    audioSource.disconnect();
    audioSource = null;
  }

  if (audioContext && audioContext.state !== 'closed') {
    audioContext.close();
    audioContext = null;
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
  console.log('[Offscreen] 已停止擷取');
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
      reject(new Error('Deepgram 連線失敗，請檢查 API key 是否正確'));
    };

    deepgramSocket.onclose = (event) => {
      console.log('[Offscreen] Deepgram 連線關閉 - code:', event.code, 'reason:', event.reason);
      if (event.code === 1008) {
        console.error('[Offscreen] API key 可能無效或已過期');
      }
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
        console.log('[Offscreen] 收到字幕:', transcript, isFinal ? '(final)' : '(interim)');

        // 發送字幕到 content script（透過 background）
        chrome.runtime.sendMessage({
          action: 'subtitle',
          text: transcript,
          isFinal: isFinal
        }).catch(err => {
          console.error('[Offscreen] 無法發送字幕到 background:', err);
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
      }).catch(err => {
        console.error('[Offscreen] 無法發送語言檢測結果:', err);
      });
    }

  } catch (error) {
    console.error('[Offscreen] 解析 Deepgram 回應失敗:', error, 'data:', data);
  }
}
