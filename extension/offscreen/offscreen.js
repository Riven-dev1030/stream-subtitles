// Stream Subtitles - Offscreen Document
// 在 Manifest V3 中處理音訊擷取和語音辨識（使用 Web Speech API）

let audioStream = null;
let recognition = null;
let isRecording = false;
let audioContext = null;
let audioSource = null;
let currentLanguage = 'en-US';

console.log('[Offscreen] Offscreen document 已載入');

// 檢查瀏覽器支援 Web Speech API
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SpeechRecognition) {
  console.error('[Offscreen] 瀏覽器不支援 Web Speech API');
}

// 監聽來自 background 的訊息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Offscreen] 收到訊息:', message.action);

  switch (message.action) {
    case 'startCapture':
      console.log('[Offscreen] 收到 startCapture 請求，streamId:', message.streamId);
      startCapture(message.streamId, message.language, message.autoDetect)
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
async function startCapture(streamId, language, autoDetect) {
  console.log('[Offscreen] 開始擷取音訊...');

  // 如果已經在錄音，先停止
  if (isRecording) {
    stopCapture();
  }

  try {
    // 設定語言
    currentLanguage = convertLanguageCode(language);
    console.log('[Offscreen] 使用語言:', currentLanguage);

    // 使用 getUserMedia 搭配 chromeMediaSourceId 獲取音訊流
    console.log('[Offscreen] 嘗試獲取音訊流，stream ID:', streamId);

    // 嘗試兩種格式：先嘗試標準格式，失敗則嘗試 mandatory 格式
    try {
      // 方法 1: 標準格式（Chrome 新版本）
      audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      });
      console.log('[Offscreen] 使用標準格式成功獲取音訊流');
    } catch (err) {
      console.log('[Offscreen] 標準格式失敗，嘗試 mandatory 格式...', err.message);
      // 方法 2: Mandatory 格式（Chrome 舊版本/相容性）
      audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: 'tab',
            chromeMediaSourceId: streamId
          }
        }
      });
      console.log('[Offscreen] 使用 mandatory 格式成功獲取音訊流');
    }

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

    // 初始化 Web Speech API
    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = currentLanguage;
      recognition.maxAlternatives = 1;

      // 當有辨識結果時
      recognition.onresult = (event) => {
        handleSpeechResult(event);
      };

      // 錯誤處理
      recognition.onerror = (event) => {
        console.error('[Offscreen] Speech Recognition 錯誤:', event.error);

        // 發送錯誤訊息到 background
        chrome.runtime.sendMessage({
          action: 'recognitionError',
          error: event.error
        }).catch(err => {
          console.error('[Offscreen] 無法發送錯誤訊息:', err);
        });
      };

      // 結束時自動重啟（保持持續辨識）
      recognition.onend = () => {
        console.log('[Offscreen] Speech Recognition 結束');
        if (isRecording) {
          console.log('[Offscreen] 自動重啟 Speech Recognition');
          try {
            recognition.start();
          } catch (err) {
            console.error('[Offscreen] 無法重啟 Speech Recognition:', err);
          }
        }
      };

      // 開始語音辨識
      console.log('[Offscreen] 啟動 Speech Recognition');
      recognition.start();
      isRecording = true;
    } else {
      throw new Error('瀏覽器不支援 Web Speech API。請使用 Chrome 瀏覽器。');
    }

    console.log('[Offscreen] 語音辨識已啟動');

  } catch (error) {
    console.error('[Offscreen] 擷取失敗:', error);
    console.error('[Offscreen] 錯誤詳情 - name:', error.name, 'message:', error.message);

    // 根據錯誤類型提供友善的錯誤訊息
    let friendlyError;
    if (error.name === 'NotAllowedError') {
      console.error('[Offscreen] 權限被拒絕，可能需要用戶授權');
      friendlyError = new Error('權限被拒絕。請在彈出的對話框中點擊「允許」來授予音訊擷取權限。');
      friendlyError.name = 'NotAllowedError';
    } else if (error.name === 'NotFoundError') {
      console.error('[Offscreen] 找不到音訊源，streamId 可能無效:', streamId);
      friendlyError = new Error('找不到音訊源。請確認分頁正在播放音訊且音訊未被靜音。');
      friendlyError.name = 'NotFoundError';
    } else if (error.name === 'AbortError') {
      console.error('[Offscreen] 操作被中止');
      friendlyError = new Error('操作被中止。請重試。');
      friendlyError.name = 'AbortError';
    } else if (error.name === 'InvalidStateError') {
      console.error('[Offscreen] 無效的狀態');
      friendlyError = new Error('音訊擷取狀態異常。請重新整理分頁後再試。');
      friendlyError.name = 'InvalidStateError';
    } else {
      // 其他未知錯誤
      friendlyError = new Error(`音訊擷取失敗: ${error.message || '未知錯誤'}`);
      friendlyError.name = error.name;
    }

    throw friendlyError;
  }
}

// 停止擷取
function stopCapture() {
  console.log('[Offscreen] 停止擷取');

  // 停止語音辨識
  if (recognition) {
    try {
      recognition.stop();
    } catch (err) {
      console.error('[Offscreen] 停止 Speech Recognition 失敗:', err);
    }
    recognition = null;
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

  isRecording = false;
  console.log('[Offscreen] 已停止擷取');
}

// 處理語音辨識結果
function handleSpeechResult(event) {
  try {
    // 取得最新的辨識結果
    const lastResultIndex = event.results.length - 1;
    const result = event.results[lastResultIndex];

    if (result && result[0]) {
      const transcript = result[0].transcript;
      const isFinal = result.isFinal;
      const confidence = result[0].confidence;

      console.log('[Offscreen] 辨識結果:', transcript, isFinal ? '(final)' : '(interim)', 'confidence:', confidence);

      // 發送字幕到 content script（透過 background）
      chrome.runtime.sendMessage({
        action: 'subtitle',
        text: transcript,
        isFinal: isFinal,
        confidence: confidence
      }).catch(err => {
        console.error('[Offscreen] 無法發送字幕到 background:', err);
      });
    }
  } catch (error) {
    console.error('[Offscreen] 處理語音辨識結果失敗:', error);
  }
}

// 轉換語言代碼（從簡短格式到 BCP 47 格式）
function convertLanguageCode(langCode) {
  const languageMap = {
    'en': 'en-US',
    'ja': 'ja-JP',
    'zh-TW': 'zh-TW',
    'zh': 'zh-CN',
    'ko': 'ko-KR',
    'es': 'es-ES',
    'fr': 'fr-FR',
    'de': 'de-DE',
    'it': 'it-IT',
    'pt': 'pt-BR',
    'ru': 'ru-RU'
  };

  return languageMap[langCode] || 'en-US';
}
