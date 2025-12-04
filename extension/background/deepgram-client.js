/**
 * Deepgram WebSocket 客戶端
 *
 * 負責與 Deepgram API 建立 WebSocket 連接並處理即時語音辨識
 *
 * @class DeepgramClient
 * @version MVP 0.1
 */

class DeepgramClient {
  constructor(apiKey, config = {}) {
    this.apiKey = apiKey;
    this.ws = null;
    this.isConnected = false;
    this.isReconnecting = false;

    // 配置（可覆寫）
    this.config = {
      language: config.language || 'zh-TW',
      punctuate: config.punctuate !== undefined ? config.punctuate : true,
      interimResults: config.interimResults !== undefined ? config.interimResults : true,
      encoding: config.encoding || 'linear16',
      sampleRate: config.sampleRate || 16000,
      model: config.model || 'general', // general, phonecall, etc.
      ...config
    };

    // 回調函數
    this.onResult = null;
    this.onError = null;
    this.onOpen = null;
    this.onClose = null;

    // 統計
    this.stats = {
      startTime: null,
      messagesReceived: 0,
      bytesSent: 0
    };
  }

  /**
   * 建立 WebSocket 連接到 Deepgram
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.ws && this.isConnected) {
      console.warn('[Deepgram] 已經連接，跳過重複連接');
      return;
    }

    const url = this._buildWebSocketUrl();
    console.log('[Deepgram] 連接到:', url);

    try {
      this.ws = new WebSocket(url, ['token', this.apiKey]);

      this.ws.onopen = () => this._handleOpen();
      this.ws.onmessage = (event) => this._handleMessage(event);
      this.ws.onerror = (error) => this._handleError(error);
      this.ws.onclose = (event) => this._handleClose(event);

      // 等待連接建立（最多 5 秒）
      await this._waitForConnection(5000);

    } catch (error) {
      console.error('[Deepgram] 連接失敗:', error);
      throw error;
    }
  }

  /**
   * 建構 WebSocket URL
   * @private
   */
  _buildWebSocketUrl() {
    const params = new URLSearchParams({
      encoding: this.config.encoding,
      sample_rate: this.config.sampleRate,
      language: this.config.language,
      punctuate: this.config.punctuate,
      interim_results: this.config.interimResults,
      model: this.config.model
    });

    return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
  }

  /**
   * 等待 WebSocket 連接建立
   * @private
   */
  _waitForConnection(timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('連接超時'));
      }, timeout);

      const checkConnection = () => {
        if (this.isConnected) {
          clearTimeout(timer);
          resolve();
        } else if (this.ws.readyState === WebSocket.CLOSED) {
          clearTimeout(timer);
          reject(new Error('連接失敗'));
        } else {
          setTimeout(checkConnection, 100);
        }
      };

      checkConnection();
    });
  }

  /**
   * 處理 WebSocket 開啟事件
   * @private
   */
  _handleOpen() {
    console.log('[Deepgram] WebSocket 連接已建立');
    this.isConnected = true;
    this.isReconnecting = false;
    this.stats.startTime = Date.now();

    if (this.onOpen) {
      this.onOpen();
    }
  }

  /**
   * 處理來自 Deepgram 的訊息
   * @private
   */
  _handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      this.stats.messagesReceived++;

      // 處理不同類型的訊息
      if (data.type === 'Results') {
        this._processTranscript(data);
      } else if (data.type === 'Metadata') {
        console.log('[Deepgram] Metadata:', data);
      } else {
        console.log('[Deepgram] 未知訊息類型:', data.type);
      }

    } catch (error) {
      console.error('[Deepgram] 解析訊息失敗:', error);
    }
  }

  /**
   * 處理語音辨識結果
   * @private
   */
  _processTranscript(data) {
    // Deepgram 結果結構
    const channel = data.channel;
    if (!channel || !channel.alternatives || channel.alternatives.length === 0) {
      return;
    }

    const alternative = channel.alternatives[0];
    const transcript = alternative.transcript;

    // 忽略空結果
    if (!transcript || transcript.trim().length === 0) {
      return;
    }

    // 轉換為統一格式
    const result = {
      text: transcript.trim(),
      isFinal: data.is_final || false,
      confidence: alternative.confidence || 0,
      timestamp: Date.now()
    };

    console.log('[Deepgram] 辨識結果:', result);

    // 呼叫回調函數
    if (this.onResult) {
      this.onResult(result);
    }
  }

  /**
   * 處理 WebSocket 錯誤
   * @private
   */
  _handleError(error) {
    console.error('[Deepgram] WebSocket 錯誤:', error);

    if (this.onError) {
      this.onError({
        type: 'websocket_error',
        message: '連接錯誤',
        error
      });
    }
  }

  /**
   * 處理 WebSocket 關閉事件
   * @private
   */
  _handleClose(event) {
    console.log('[Deepgram] WebSocket 已關閉', {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean
    });

    this.isConnected = false;

    if (this.onClose) {
      this.onClose({
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      });
    }

    // MVP: 不自動重連，由外部控制
  }

  /**
   * 發送音訊數據到 Deepgram
   * @param {ArrayBuffer|Blob} audioData - 音訊數據
   */
  sendAudio(audioData) {
    if (!this.ws || !this.isConnected) {
      console.warn('[Deepgram] 未連接，無法發送音訊');
      return false;
    }

    try {
      this.ws.send(audioData);
      this.stats.bytesSent += audioData.byteLength || audioData.size || 0;
      return true;
    } catch (error) {
      console.error('[Deepgram] 發送音訊失敗:', error);
      return false;
    }
  }

  /**
   * 斷開連接
   */
  disconnect() {
    console.log('[Deepgram] 斷開連接');

    if (this.ws) {
      this.isConnected = false;

      try {
        // 發送關閉信號（Deepgram 建議）
        this.ws.send(JSON.stringify({ type: 'CloseStream' }));
      } catch (error) {
        console.warn('[Deepgram] 發送關閉信號失敗:', error);
      }

      setTimeout(() => {
        if (this.ws) {
          this.ws.close();
          this.ws = null;
        }
      }, 100);
    }
  }

  /**
   * 取得連接狀態
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      readyState: this.ws ? this.ws.readyState : null,
      stats: { ...this.stats },
      duration: this.stats.startTime ? Date.now() - this.stats.startTime : 0
    };
  }

  /**
   * 驗證 API Key 是否有效
   * @static
   * @param {string} apiKey - Deepgram API Key
   * @returns {Promise<boolean>}
   */
  static async validateApiKey(apiKey) {
    if (!apiKey || apiKey.trim().length === 0) {
      return false;
    }

    try {
      // 測試連接（不發送音訊）
      const testUrl = `wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000`;
      const ws = new WebSocket(testUrl, ['token', apiKey]);

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          ws.close();
          resolve(false);
        }, 5000);

        ws.onopen = () => {
          clearTimeout(timeout);
          ws.close();
          resolve(true);
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          resolve(false);
        };
      });

    } catch (error) {
      console.error('[Deepgram] API Key 驗證失敗:', error);
      return false;
    }
  }
}

// For Chrome Extension environment
// Service Worker: 使用 self.DeepgramClient
// Popup/Content: 使用 window.DeepgramClient
if (typeof self !== 'undefined') {
  self.DeepgramClient = DeepgramClient;
}

if (typeof window !== 'undefined') {
  window.DeepgramClient = DeepgramClient;
}
