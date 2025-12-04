/**
 * 音訊捕獲管理模組
 *
 * 負責使用 chrome.tabCapture API 捕獲 Tab 音訊，
 * 並轉換為 Deepgram 所需的格式（Linear16 PCM, 16kHz）
 *
 * @module audio-capture-manager
 * @version 1.0.0
 */

class AudioCaptureManager {
  constructor() {
    this.mediaStream = null;
    this.audioContext = null;
    this.sourceNode = null;
    this.processorNode = null;
    this.isCapturing = false;
    this.onAudioData = null; // 音訊數據回調
    this.targetSampleRate = 16000; // Deepgram 要求 16kHz
    this.tabId = null;
  }

  /**
   * 開始捕獲指定 Tab 的音訊
   * @param {number} tabId - Chrome Tab ID
   * @returns {Promise<void>}
   */
  async startCapture(tabId) {
    if (this.isCapturing) {
      console.warn('[AudioCapture] 已經在捕獲音訊中');
      return;
    }

    try {
      console.log(`[AudioCapture] 開始捕獲 Tab ${tabId} 的音訊`);
      this.tabId = tabId;

      // 使用 chrome.tabCapture 捕獲 Tab 音訊
      const streamId = await this._requestTabCapture(tabId);

      // 透過 streamId 取得 MediaStream
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: 'tab',
            chromeMediaSourceId: streamId
          }
        }
      });

      console.log('[AudioCapture] MediaStream 已取得');

      // 設定音訊處理管道
      await this._setupAudioProcessing();

      this.isCapturing = true;
      console.log('[AudioCapture] 音訊捕獲已啟動');
    } catch (error) {
      console.error('[AudioCapture] 捕獲失敗:', error);
      await this.stopCapture();
      throw error;
    }
  }

  /**
   * 停止音訊捕獲
   * @returns {Promise<void>}
   */
  async stopCapture() {
    console.log('[AudioCapture] 停止音訊捕獲');

    this.isCapturing = false;

    // 停止處理節點
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }

    // 停止源節點
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    // 關閉 AudioContext
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      this.audioContext = null;
    }

    // 停止 MediaStream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    this.tabId = null;
    console.log('[AudioCapture] 音訊捕獲已停止');
  }

  /**
   * 請求 Tab 捕獲權限
   * @param {number} tabId
   * @returns {Promise<string>} streamId
   * @private
   */
  _requestTabCapture(tabId) {
    return new Promise((resolve, reject) => {
      chrome.tabCapture.capture(
        {
          audio: true,
          video: false
        },
        (stream) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!stream) {
            reject(new Error('無法取得音訊串流'));
            return;
          }

          // 從 MediaStream 中提取 streamId（用於後續處理）
          const audioTrack = stream.getAudioTracks()[0];
          if (!audioTrack) {
            reject(new Error('音訊軌道不存在'));
            return;
          }

          // 停止這個臨時的 stream（我們會用 getUserMedia 重新取得）
          stream.getTracks().forEach(track => track.stop());

          // 提取 streamId
          const streamId = audioTrack.id;
          resolve(streamId);
        }
      );
    });
  }

  /**
   * 設定音訊處理管道
   * @private
   */
  async _setupAudioProcessing() {
    // 創建 AudioContext
    this.audioContext = new AudioContext({
      sampleRate: this.targetSampleRate
    });

    console.log(`[AudioCapture] AudioContext 創建，採樣率: ${this.audioContext.sampleRate}Hz`);

    // 創建音訊源節點
    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

    // 創建 ScriptProcessorNode 或使用 AudioWorklet
    // 注意：ScriptProcessorNode 已被棄用，但在 Service Worker 中 AudioWorklet 可能不可用
    // 我們先使用 ScriptProcessorNode，如果需要可以改用 Offscreen Document
    const bufferSize = 4096; // 緩衝區大小
    this.processorNode = this.audioContext.createScriptProcessor(
      bufferSize,
      1, // 單聲道
      1
    );

    // 音訊處理回調
    this.processorNode.onaudioprocess = (event) => {
      if (!this.isCapturing || !this.onAudioData) {
        return;
      }

      const inputBuffer = event.inputBuffer;
      const audioData = inputBuffer.getChannelData(0); // 取得單聲道數據

      // 轉換為 Int16（Linear16 PCM）
      const int16Data = this._floatTo16BitPCM(audioData);

      // 發送音訊數據
      this.onAudioData(int16Data);
    };

    // 連接節點
    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.audioContext.destination);

    console.log('[AudioCapture] 音訊處理管道已建立');
  }

  /**
   * 將 Float32Array 轉換為 Int16Array (Linear16 PCM)
   * @param {Float32Array} float32Array
   * @returns {Int16Array}
   * @private
   */
  _floatTo16BitPCM(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      // Float32 範圍是 [-1, 1]，轉換為 Int16 範圍 [-32768, 32767]
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
  }

  /**
   * 設定音訊數據回調
   * @param {Function} callback - 回調函數，接收 Int16Array
   */
  setAudioDataCallback(callback) {
    this.onAudioData = callback;
  }

  /**
   * 檢查是否正在捕獲
   * @returns {boolean}
   */
  isCaptureActive() {
    return this.isCapturing;
  }

  /**
   * 取得當前捕獲的 Tab ID
   * @returns {number|null}
   */
  getCurrentTabId() {
    return this.tabId;
  }
}

// For Chrome Extension environment
if (typeof self !== 'undefined') {
  self.AudioCaptureManager = AudioCaptureManager;
}

if (typeof window !== 'undefined') {
  window.AudioCaptureManager = AudioCaptureManager;
}
