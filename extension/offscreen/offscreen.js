/**
 * Offscreen Document for Audio Capture
 *
 * 此文件在 offscreen document 環境中運行，
 * 負責使用 getUserMedia 捕獲 Tab 音訊並處理
 */

console.log('[Offscreen] Offscreen document 已載入');

let audioContext = null;
let sourceNode = null;
let processorNode = null;
let mediaStream = null;
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

    // 設定音訊處理管道
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

  // 停止處理節點
  if (processorNode) {
    processorNode.disconnect();
    processorNode.onaudioprocess = null;
    processorNode = null;
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
 * 設定音訊處理管道
 */
async function setupAudioProcessing(stream) {
  const targetSampleRate = 16000; // Deepgram 要求 16kHz

  // 創建 AudioContext
  audioContext = new AudioContext({
    sampleRate: targetSampleRate
  });

  console.log(`[Offscreen] AudioContext 創建，採樣率: ${audioContext.sampleRate}Hz`);

  // 創建音訊源節點
  sourceNode = audioContext.createMediaStreamSource(stream);

  // 創建 ScriptProcessorNode
  // 注意：雖然已棄用，但在 Extension 環境中仍是最穩定的選擇
  const bufferSize = 4096;
  processorNode = audioContext.createScriptProcessor(
    bufferSize,
    1, // 單聲道
    1
  );

  // 音訊處理回調
  processorNode.onaudioprocess = (event) => {
    if (!isCapturing) {
      return;
    }

    const inputBuffer = event.inputBuffer;
    const audioData = inputBuffer.getChannelData(0);

    // 轉換為 Int16 Linear PCM
    const int16Data = floatTo16BitPCM(audioData);

    // 發送音訊數據到 Service Worker
    chrome.runtime.sendMessage({
      action: 'audioData',
      data: Array.from(int16Data) // 轉換為普通陣列以便傳輸
    });
  };

  // 連接節點
  sourceNode.connect(processorNode);
  processorNode.connect(audioContext.destination);

  console.log('[Offscreen] 音訊處理管道已建立');
}

/**
 * 將 Float32Array 轉換為 Int16Array (Linear16 PCM)
 */
function floatTo16BitPCM(float32Array) {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return int16Array;
}

console.log('[Offscreen] 音訊捕獲模組已就緒');
