/**
 * Offscreen Document - 音訊捕獲處理
 *
 * 在 Manifest V3 中，Service Worker 無法使用 MediaStream API
 * 因此需要使用 Offscreen Document 來處理音訊捕獲和處理
 */

console.log('[Offscreen] Offscreen document 已載入');

let mediaStream = null;
let audioContext = null;
let sourceNode = null;
let processorNode = null;
let isCapturing = false;
const targetSampleRate = 16000;

// 監聽來自 Service Worker 的訊息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Offscreen] 收到訊息:', message.action);

  handleMessage(message, sender, sendResponse);
  return true; // 保持訊息通道開啟
});

async function handleMessage(message, sender, sendResponse) {
  try {
    switch (message.action) {
      case 'startAudioCapture':
        await startAudioCapture(message.streamId, sendResponse);
        break;

      case 'stopAudioCapture':
        await stopAudioCapture(sendResponse);
        break;

      default:
        sendResponse({ success: false, error: '未知的操作' });
    }
  } catch (error) {
    console.error('[Offscreen] 處理訊息失敗:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * 開始音訊捕獲
 */
async function startAudioCapture(streamId, sendResponse) {
  try {
    console.log('[Offscreen] 開始音訊捕獲，StreamID:', streamId);

    if (isCapturing) {
      console.warn('[Offscreen] 已經在捕獲音訊中');
      sendResponse({ success: true, message: '已在捕獲中' });
      return;
    }

    // 使用 streamId 取得 MediaStream
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      }
    });

    console.log('[Offscreen] MediaStream 已取得');

    // 設定音訊處理管道
    await setupAudioProcessing();

    isCapturing = true;
    sendResponse({ success: true, message: '音訊捕獲已啟動' });
    console.log('[Offscreen] 音訊捕獲已啟動');

  } catch (error) {
    console.error('[Offscreen] 音訊捕獲失敗:', error);
    await stopAudioCapture(() => {});
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * 停止音訊捕獲
 */
async function stopAudioCapture(sendResponse) {
  console.log('[Offscreen] 停止音訊捕獲');

  isCapturing = false;

  // 停止處理節點
  if (processorNode) {
    processorNode.disconnect();
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

  sendResponse({ success: true, message: '音訊捕獲已停止' });
  console.log('[Offscreen] 音訊捕獲已停止');
}

/**
 * 設定音訊處理管道
 */
async function setupAudioProcessing() {
  // 創建 AudioContext
  audioContext = new AudioContext({
    sampleRate: targetSampleRate
  });

  console.log(`[Offscreen] AudioContext 創建，採樣率: ${audioContext.sampleRate}Hz`);

  // 創建音訊源節點
  sourceNode = audioContext.createMediaStreamSource(mediaStream);

  // 創建 ScriptProcessorNode
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
    const audioData = inputBuffer.getChannelData(0); // 取得單聲道數據

    // 轉換為 Int16（Linear16 PCM）
    const int16Data = floatTo16BitPCM(audioData);

    // 發送音訊數據到 Service Worker
    chrome.runtime.sendMessage({
      action: 'audioData',
      data: Array.from(int16Data) // 轉換為 Array 以便傳輸
    }).catch(err => {
      // 忽略錯誤（Service Worker 可能尚未準備好）
      if (err.message !== 'The message port closed before a response was received.') {
        console.error('[Offscreen] 發送音訊數據失敗:', err);
      }
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

console.log('[Offscreen] 初始化完成');
