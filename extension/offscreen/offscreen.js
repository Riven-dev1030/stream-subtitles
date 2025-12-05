/**
 * Offscreen Document for Audio Capture
 *
 * 此文件在 offscreen document 環境中運行，
 * 負責使用 getUserMedia 捕獲 Tab 音訊並處理
 */

console.log('[Offscreen] Offscreen document 已載入');

let audioContext = null;
let sourceNode = null;
let workletNode = null;
let mediaStream = null;
let audioElement = null;
let isCapturing = false;

// 監聽來自 Service Worker 的訊息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Offscreen] 收到訊息:', message.action);

  switch (message.action) {
    case 'startAudioCapture':
      handleStartAudioCapture(message.streamId)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // 保持異步回應

    case 'stopAudioCapture':
      handleStopAudioCapture()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

/**
 * 開始音訊捕獲
 */
async function handleStartAudioCapture(streamId) {
  if (isCapturing) {
    console.warn('[Offscreen] 已經在捕獲音訊中');
    return;
  }

  console.log('[Offscreen] 開始音訊捕獲，streamId:', streamId);

  try {
    // 使用 streamId 獲取 MediaStream
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      },
      video: false
    });

    console.log('[Offscreen] MediaStream 已獲取');

    // **關鍵修復：將音訊流播放出來，讓用戶能聽到聲音**
    audioElement = document.getElementById('audio-playback');
    if (audioElement) {
      audioElement.srcObject = mediaStream;
      audioElement.volume = 1.0; // 確保音量正常
      console.log('[Offscreen] 音訊已設置到 <audio> 元素，用戶可以聽到聲音');
    } else {
      console.warn('[Offscreen] 未找到 audio 元素');
    }

    // 設定音訊處理管道（用於發送到 Deepgram）
    await setupAudioProcessing(mediaStream);

    isCapturing = true;
    console.log('[Offscreen] 音訊捕獲已啟動');

    // 通知 Service Worker 啟動成功
    chrome.runtime.sendMessage({
      action: 'audioCaptureStarted'
    });

  } catch (error) {
    console.error('[Offscreen] 音訊捕獲失敗:', error);
    await handleStopAudioCapture();
    throw error;
  }
}

/**
 * 停止音訊捕獲
 */
async function handleStopAudioCapture() {
  console.log('[Offscreen] 停止音訊捕獲');

  isCapturing = false;

  // 停止音訊播放
  if (audioElement) {
    audioElement.srcObject = null;
    audioElement = null;
  }

  // 停止 Worklet 節點
  if (workletNode) {
    // 通知 worklet 停止處理
    workletNode.port.postMessage({ command: 'stop' });
    workletNode.disconnect();
    workletNode = null;
  }

  // 停止源節點
  if (sourceNode) {
    sourceNode.disconnect();
    sourceNode = null;
  }

  // 關閉 AudioContext
  if (audioContext && audioContext.state !== 'closed') {
    await audioContext.close();
    audioContext = null;
  }

  // 停止 MediaStream
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }

  console.log('[Offscreen] 音訊捕獲已停止');

  // 通知 Service Worker 停止成功
  chrome.runtime.sendMessage({
    action: 'audioCaptureStopped'
  });
}

/**
 * 設定音訊處理管道（使用 AudioWorkletNode）
 */
async function setupAudioProcessing(stream) {
  const targetSampleRate = 16000; // Deepgram 要求 16kHz

  try {
    // 創建 AudioContext
    audioContext = new AudioContext({
      sampleRate: targetSampleRate
    });

    console.log(`[Offscreen] AudioContext 創建，採樣率: ${audioContext.sampleRate}Hz`);

    // 載入 AudioWorklet 模組
    const processorUrl = chrome.runtime.getURL('offscreen/audio-processor.js');
    await audioContext.audioWorklet.addModule(processorUrl);
    console.log('[Offscreen] AudioWorklet 模組已載入');

    // 創建音訊源節點
    sourceNode = audioContext.createMediaStreamSource(stream);

    // 創建 AudioWorkletNode
    workletNode = new AudioWorkletNode(audioContext, 'audio-capture-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1 // 單聲道
    });

    // 監聽來自 Worklet 的音訊數據
    workletNode.port.onmessage = (event) => {
      if (event.data.type === 'audioData') {
        // 接收 transferable object（ArrayBuffer）
        const int16Data = new Int16Array(event.data.data);

        // 發送音訊數據到 Service Worker
        chrome.runtime.sendMessage({
          action: 'audioData',
          data: Array.from(int16Data) // 轉換為普通陣列以便傳輸
        }).catch(err => {
          // 忽略發送失敗（可能是 Service Worker 重啟）
          if (!err.message.includes('Extension context invalidated')) {
            console.error('[Offscreen] 發送音訊數據失敗:', err);
          }
        });
      }
    };

    // 連接節點
    // 注意：不連接到 destination，音訊播放由 <audio> 元素處理
    sourceNode.connect(workletNode);
    // workletNode 不需要連接到 destination，因為只用於數據處理

    console.log('[Offscreen] AudioWorklet 音訊處理管道已建立');
  } catch (error) {
    console.error('[Offscreen] 設定音訊處理管道失敗:', error);
    throw error;
  }
}

console.log('[Offscreen] 音訊捕獲模組已就緒');
