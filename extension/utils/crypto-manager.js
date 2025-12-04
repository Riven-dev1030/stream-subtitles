/**
 * API Key 加密管理模組
 *
 * 使用 Web Crypto API 提供安全的 API Key 儲存
 * 密鑰從 Chrome Extension ID 派生，確保唯一性
 *
 * @module crypto-manager
 * @version 1.0.0
 */

class CryptoManager {
  constructor() {
    this.algorithm = 'AES-GCM';
    this.keyLength = 256;
    this.ivLength = 12;

    // 從 Extension ID 派生的 salt
    this.salt = null;
    this.cryptoKey = null;
  }

  /**
   * 初始化加密管理器
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // 使用 Extension ID 作為 salt 的一部分
      const extensionId = chrome.runtime.id;
      const encoder = new TextEncoder();

      // 創建唯一的 salt
      this.salt = encoder.encode(`stream-subtitles-${extensionId}-v1`);

      // 派生加密密鑰
      await this._deriveKey();

      console.log('[CryptoManager] 初始化完成');
    } catch (error) {
      console.error('[CryptoManager] 初始化失敗:', error);
      throw error;
    }
  }

  /**
   * 從 Extension ID 派生加密密鑰
   * @private
   */
  async _deriveKey() {
    const encoder = new TextEncoder();

    // 使用固定密碼 + Extension ID 作為密鑰材料
    const password = `stream-subtitles-master-key-${chrome.runtime.id}`;
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    // 使用 PBKDF2 派生密鑰
    this.cryptoKey = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: this.salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      {
        name: this.algorithm,
        length: this.keyLength
      },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * 加密 API Key
   * @param {string} apiKey - 明文 API Key
   * @returns {Promise<string>} Base64 編碼的加密資料
   */
  async encrypt(apiKey) {
    if (!this.cryptoKey) {
      await this.initialize();
    }

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(apiKey);

      // 生成隨機 IV
      const iv = window.crypto.getRandomValues(new Uint8Array(this.ivLength));

      // 加密
      const encrypted = await window.crypto.subtle.encrypt(
        {
          name: this.algorithm,
          iv: iv
        },
        this.cryptoKey,
        data
      );

      // 組合 IV + 加密資料
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(encrypted), iv.length);

      // 轉換為 Base64
      return this._arrayBufferToBase64(combined);
    } catch (error) {
      console.error('[CryptoManager] 加密失敗:', error);
      throw new Error('加密失敗');
    }
  }

  /**
   * 解密 API Key
   * @param {string} encryptedData - Base64 編碼的加密資料
   * @returns {Promise<string>} 明文 API Key
   */
  async decrypt(encryptedData) {
    if (!this.cryptoKey) {
      await this.initialize();
    }

    try {
      // 從 Base64 解碼
      const combined = this._base64ToArrayBuffer(encryptedData);

      // 分離 IV 和加密資料
      const iv = combined.slice(0, this.ivLength);
      const encrypted = combined.slice(this.ivLength);

      // 解密
      const decrypted = await window.crypto.subtle.decrypt(
        {
          name: this.algorithm,
          iv: iv
        },
        this.cryptoKey,
        encrypted
      );

      // 轉換為字串
      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('[CryptoManager] 解密失敗:', error);
      throw new Error('解密失敗（可能是 API Key 已損壞）');
    }
  }

  /**
   * ArrayBuffer 轉 Base64
   * @private
   */
  _arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Base64 轉 ArrayBuffer
   * @private
   */
  _base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * 儲存加密的 API Key
   * @param {string} apiKey - 明文 API Key
   * @returns {Promise<void>}
   */
  async saveApiKey(apiKey) {
    try {
      const encrypted = await this.encrypt(apiKey);

      await chrome.storage.local.set({
        deepgramApiKey: encrypted,
        apiKeyEncrypted: true,
        apiKeySetAt: Date.now()
      });

      console.log('[CryptoManager] API Key 已加密並儲存');
    } catch (error) {
      console.error('[CryptoManager] 儲存失敗:', error);
      throw error;
    }
  }

  /**
   * 讀取並解密 API Key
   * @returns {Promise<string|null>} 明文 API Key，如果不存在則返回 null
   */
  async getApiKey() {
    try {
      const result = await chrome.storage.local.get([
        'deepgramApiKey',
        'apiKeyEncrypted'
      ]);

      if (!result.deepgramApiKey) {
        return null;
      }

      // 檢查是否為加密資料
      if (result.apiKeyEncrypted) {
        // 解密
        return await this.decrypt(result.deepgramApiKey);
      } else {
        // 舊版明文資料，重新加密
        console.warn('[CryptoManager] 偵測到明文 API Key，正在重新加密...');
        await this.saveApiKey(result.deepgramApiKey);
        return result.deepgramApiKey;
      }
    } catch (error) {
      console.error('[CryptoManager] 讀取失敗:', error);
      throw error;
    }
  }

  /**
   * 刪除 API Key
   * @returns {Promise<void>}
   */
  async clearApiKey() {
    await chrome.storage.local.remove([
      'deepgramApiKey',
      'apiKeyEncrypted',
      'apiKeySetAt'
    ]);
    console.log('[CryptoManager] API Key 已清除');
  }

  /**
   * 遮罩顯示 API Key（用於 UI）
   * @param {string} apiKey - 明文 API Key
   * @returns {string} 遮罩後的 API Key
   */
  maskApiKey(apiKey) {
    if (!apiKey || apiKey.length < 12) {
      return '••••••••';
    }

    const start = apiKey.substring(0, 4);
    const end = apiKey.substring(apiKey.length - 4);
    return `${start}••••••••${end}`;
  }

  /**
   * 驗證 API Key 格式
   * @param {string} apiKey - API Key
   * @returns {boolean} 是否有效
   */
  validateApiKeyFormat(apiKey) {
    // Deepgram API Key 通常是 40 個字元的英數字串
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    // 基本長度檢查
    if (apiKey.length < 20) {
      return false;
    }

    // 檢查是否包含不合法字元
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    return validPattern.test(apiKey);
  }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CryptoManager;
}

// For Chrome Extension environment
// Service Worker: 使用 self.CryptoManager
// Popup/Content: 使用 window.CryptoManager
if (typeof self !== 'undefined') {
  self.CryptoManager = CryptoManager;
}

if (typeof window !== 'undefined') {
  window.CryptoManager = CryptoManager;
  // 在 Popup/Content Script 中創建全域實例
  window.cryptoManager = new CryptoManager();
}
