/**
 * AudioWorkletProcessor for Audio Capture
 *
 * 此處理器運行在獨立的音訊線程中，不會阻塞主線程
 * 負責將 Float32 音訊數據轉換為 Int16 Linear PCM 並發送
 */

class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.isCapturing = true;

    // 監聽來自主線程的訊息
    this.port.onmessage = (event) => {
      if (event.data.command === 'stop') {
        this.isCapturing = false;
      }
    };
  }

  /**
   * 處理音訊數據
   * @param {Float32Array[][]} inputs - 輸入音訊數據
   * @param {Float32Array[][]} outputs - 輸出音訊數據
   * @param {Object} parameters - 參數
   * @returns {boolean} - 是否繼續處理
   */
  process(inputs, outputs, parameters) {
    if (!this.isCapturing) {
      return false; // 停止處理
    }

    const input = inputs[0];
    if (!input || !input[0]) {
      return true; // 繼續等待輸入
    }

    const channelData = input[0]; // 取第一個聲道

    // 轉換 Float32 到 Int16
    const int16Data = this.floatTo16BitPCM(channelData);

    // 發送數據到主線程
    this.port.postMessage({
      type: 'audioData',
      data: int16Data.buffer
    }, [int16Data.buffer]); // 使用 transferable objects 提升性能

    return true; // 繼續處理
  }

  /**
   * 將 Float32Array 轉換為 Int16Array (Linear16 PCM)
   */
  floatTo16BitPCM(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
  }
}

// 註冊處理器
registerProcessor('audio-capture-processor', AudioCaptureProcessor);
