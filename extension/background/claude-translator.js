/**
 * Claude Translator Client
 *
 * 使用 Claude 4.5 Haiku API 進行即時翻譯
 *
 * @class ClaudeTranslator
 * @version 1.1.0
 */

class ClaudeTranslator {
  constructor(apiKey, config = {}) {
    this.apiKey = apiKey;
    this.config = {
      model: config.model || 'claude-haiku-4-5-20251001',
      maxTokens: config.maxTokens || 1024,
      temperature: config.temperature || 0.3, // 較低溫度以獲得更一致的翻譯
      ...config
    };

    // 翻譯快取（避免重複翻譯相同文字）
    this.cache = new Map();
    this.cacheMaxSize = 500; // 最多快取 500 個翻譯

    // API endpoint
    this.apiEndpoint = 'https://api.anthropic.com/v1/messages';
    this.apiVersion = '2023-06-01';

    // 統計
    this.stats = {
      totalTranslations: 0,
      cacheHits: 0,
      apiCalls: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      estimatedCost: 0 // USD
    };
  }

  /**
   * 翻譯文字
   * @param {string} text - 要翻譯的文字
   * @param {string} targetLang - 目標語言（zh-TW, en, ja 等）
   * @param {string} sourceLang - 來源語言（可選）
   * @returns {Promise<Object>} 翻譯結果
   */
  async translate(text, targetLang, sourceLang = null) {
    if (!text || text.trim().length === 0) {
      return { translatedText: '', cached: false };
    }

    this.stats.totalTranslations++;

    // 檢查快取
    const cacheKey = this._getCacheKey(text, targetLang);
    if (this.cache.has(cacheKey)) {
      console.log('[Claude Translator] 快取命中:', text.substring(0, 30) + '...');
      this.stats.cacheHits++;
      return {
        translatedText: this.cache.get(cacheKey),
        cached: true
      };
    }

    // 呼叫 Claude API
    try {
      const translatedText = await this._callClaudeAPI(text, targetLang, sourceLang);

      // 儲存到快取
      this._addToCache(cacheKey, translatedText);

      return {
        translatedText,
        cached: false
      };
    } catch (error) {
      console.error('[Claude Translator] 翻譯失敗:', error);
      throw error;
    }
  }

  /**
   * 呼叫 Claude API
   * @private
   */
  async _callClaudeAPI(text, targetLang, sourceLang) {
    const targetLangName = this._getLanguageName(targetLang);
    const sourceLangHint = sourceLang ? `（原文語言：${this._getLanguageName(sourceLang)}）` : '';

    // 建構提示詞
    const prompt = `請將以下文字翻譯成${targetLangName}${sourceLangHint}。
要求：
1. 保持原文的語氣和風格（如果是口語就保持口語化）
2. 只回傳翻譯結果，不要有任何額外說明
3. 如果原文有專業術語，請保留或用括號註解

原文：
${text}`;

    const requestBody = {
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    };

    console.log('[Claude Translator] 呼叫 API，文字長度:', text.length);

    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': this.apiVersion,
        'content-type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Claude API 錯誤: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();

    // 更新統計
    this.stats.apiCalls++;
    this.stats.totalInputTokens += data.usage?.input_tokens || 0;
    this.stats.totalOutputTokens += data.usage?.output_tokens || 0;
    this._updateEstimatedCost();

    console.log('[Claude Translator] API 回應:', {
      inputTokens: data.usage?.input_tokens,
      outputTokens: data.usage?.output_tokens,
      cost: `$${this._calculateRequestCost(data.usage).toFixed(6)}`
    });

    // 提取翻譯結果
    const translatedText = data.content?.[0]?.text?.trim() || '';

    return translatedText;
  }

  /**
   * 取得快取鍵
   * @private
   */
  _getCacheKey(text, targetLang) {
    return `${targetLang}:${text}`;
  }

  /**
   * 新增到快取
   * @private
   */
  _addToCache(key, value) {
    // 如果快取已滿，刪除最舊的項目（FIFO）
    if (this.cache.size >= this.cacheMaxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, value);
  }

  /**
   * 取得語言名稱
   * @private
   */
  _getLanguageName(langCode) {
    const languageNames = {
      'zh-TW': '繁體中文',
      'zh-CN': '簡體中文',
      'zh': '中文',
      'en': '英文',
      'ja': '日文',
      'ko': '韓文',
      'es': '西班牙文',
      'fr': '法文',
      'de': '德文',
      'it': '義大利文',
      'pt': '葡萄牙文',
      'ru': '俄文'
    };

    return languageNames[langCode] || langCode;
  }

  /**
   * 計算單次請求成本
   * @private
   */
  _calculateRequestCost(usage) {
    if (!usage) return 0;

    // Claude 4.5 Haiku 定價（2025）
    const inputCostPerMToken = 0.8;  // $0.80 per MTok
    const outputCostPerMToken = 4.0; // $4.00 per MTok

    const inputCost = (usage.input_tokens / 1000000) * inputCostPerMToken;
    const outputCost = (usage.output_tokens / 1000000) * outputCostPerMToken;

    return inputCost + outputCost;
  }

  /**
   * 更新總成本估計
   * @private
   */
  _updateEstimatedCost() {
    const usage = {
      input_tokens: this.stats.totalInputTokens,
      output_tokens: this.stats.totalOutputTokens
    };

    this.stats.estimatedCost = this._calculateRequestCost(usage);
  }

  /**
   * 取得統計資訊
   */
  getStats() {
    return {
      ...this.stats,
      cacheHitRate: this.stats.totalTranslations > 0
        ? (this.stats.cacheHits / this.stats.totalTranslations * 100).toFixed(1) + '%'
        : '0%',
      cacheSize: this.cache.size,
      estimatedCostFormatted: `$${this.stats.estimatedCost.toFixed(4)} USD`
    };
  }

  /**
   * 清除快取
   */
  clearCache() {
    this.cache.clear();
    console.log('[Claude Translator] 快取已清除');
  }

  /**
   * 重設統計
   */
  resetStats() {
    this.stats = {
      totalTranslations: 0,
      cacheHits: 0,
      apiCalls: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      estimatedCost: 0
    };
    console.log('[Claude Translator] 統計已重設');
  }

  /**
   * 驗證 API Key 是否有效
   * @static
   */
  static async validateApiKey(apiKey) {
    if (!apiKey || apiKey.trim().length === 0) {
      return false;
    }

    try {
      // 發送一個簡單的測試請求
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 10,
          messages: [
            {
              role: 'user',
              content: 'Hi'
            }
          ]
        })
      });

      return response.ok;
    } catch (error) {
      console.error('[Claude Translator] API Key 驗證失敗:', error);
      return false;
    }
  }
}

// For Chrome Extension environment
if (typeof self !== 'undefined') {
  self.ClaudeTranslator = ClaudeTranslator;
}

if (typeof window !== 'undefined') {
  window.ClaudeTranslator = ClaudeTranslator;
}
