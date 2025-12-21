/**
 * Correction Repository - 修正記錄的數據抽象層
 *
 * 這個 Repository Pattern 允許底層儲存技術隨時替換，
 * 而業務邏輯完全不受影響。
 *
 * @version 1.0.0
 * @author Claude AI
 */

// ============================================
// 1. 抽象介面定義
// ============================================

/**
 * 修正記錄儲存介面（抽象類）
 * 所有 Adapter 都必須實現這些方法
 */
class ICorrectionStorage {
  /**
   * 儲存單筆修正記錄
   * @param {Object} correction - 修正記錄
   * @returns {Promise<Object>} - 儲存後的記錄（含 id）
   */
  async save(correction) {
    throw new Error('Method not implemented');
  }

  /**
   * 批次儲存多筆記錄
   * @param {Array<Object>} corrections - 修正記錄陣列
   * @returns {Promise<Array<Object>>}
   */
  async saveBatch(corrections) {
    throw new Error('Method not implemented');
  }

  /**
   * 取得所有修正記錄
   * @returns {Promise<Array<Object>>}
   */
  async getAll() {
    throw new Error('Method not implemented');
  }

  /**
   * 根據條件查詢
   * @param {Object} query - 查詢條件
   * @returns {Promise<Array<Object>>}
   */
  async query(query) {
    throw new Error('Method not implemented');
  }

  /**
   * 根據 ID 取得單筆記錄
   * @param {string|number} id
   * @returns {Promise<Object|null>}
   */
  async getById(id) {
    throw new Error('Method not implemented');
  }

  /**
   * 更新記錄
   * @param {string|number} id
   * @param {Object} updates - 要更新的欄位
   * @returns {Promise<Object>}
   */
  async update(id, updates) {
    throw new Error('Method not implemented');
  }

  /**
   * 刪除單筆記錄
   * @param {string|number} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    throw new Error('Method not implemented');
  }

  /**
   * 清除所有記錄
   * @returns {Promise<void>}
   */
  async clear() {
    throw new Error('Method not implemented');
  }

  /**
   * 取得統計資訊
   * @returns {Promise<Object>}
   */
  async getStats() {
    throw new Error('Method not implemented');
  }

  /**
   * 匯出所有資料
   * @returns {Promise<Object>}
   */
  async export() {
    throw new Error('Method not implemented');
  }

  /**
   * 匯入資料
   * @param {Object} data
   * @returns {Promise<void>}
   */
  async import(data) {
    throw new Error('Method not implemented');
  }
}

// ============================================
// 2. Chrome Storage Adapter（當前實現）
// ============================================

/**
 * Chrome Storage 適配器
 * 使用 chrome.storage.sync 作為底層儲存
 */
class ChromeStorageAdapter extends ICorrectionStorage {
  constructor() {
    super();
    this.STORAGE_KEY = 'corrections';
    this.VERSION_KEY = 'corrections_version';
    this.CURRENT_VERSION = '1.0';
  }

  /**
   * 儲存單筆修正記錄
   */
  async save(correction) {
    const corrections = await this.getAll();

    // 檢查是否已存在（根據 wrong 欄位）
    const existingIndex = corrections.findIndex(c => c.wrong === correction.wrong);

    if (existingIndex >= 0) {
      // 更新現有記錄
      corrections[existingIndex] = {
        ...corrections[existingIndex],
        ...correction,
        count: corrections[existingIndex].count + 1,
        lastSeen: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    } else {
      // 新增記錄
      const newCorrection = {
        id: this._generateId(),
        ...correction,
        count: correction.count || 1,
        createdAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        version: this.CURRENT_VERSION
      };
      corrections.push(newCorrection);
    }

    await this._saveToStorage(corrections);
    return existingIndex >= 0 ? corrections[existingIndex] : corrections[corrections.length - 1];
  }

  /**
   * 批次儲存
   */
  async saveBatch(newCorrections) {
    const existing = await this.getAll();
    const merged = [...existing];

    for (const correction of newCorrections) {
      const index = merged.findIndex(c => c.wrong === correction.wrong);
      if (index >= 0) {
        merged[index] = {
          ...merged[index],
          ...correction,
          count: merged[index].count + (correction.count || 1),
          lastSeen: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      } else {
        merged.push({
          id: this._generateId(),
          ...correction,
          count: correction.count || 1,
          createdAt: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
          version: this.CURRENT_VERSION
        });
      }
    }

    await this._saveToStorage(merged);
    return merged;
  }

  /**
   * 取得所有記錄
   */
  async getAll() {
    return new Promise((resolve) => {
      chrome.storage.sync.get([this.STORAGE_KEY], (result) => {
        resolve(result[this.STORAGE_KEY] || []);
      });
    });
  }

  /**
   * 查詢記錄
   * @param {Object} query - 查詢條件
   * @example
   * query({ language: 'zh-TW' })
   * query({ count: { $gte: 5 } })
   * query({ wrong: { $contains: '人事' } })
   */
  async query(query) {
    const all = await this.getAll();

    return all.filter(item => {
      return Object.entries(query).every(([key, value]) => {
        // 簡單相等
        if (typeof value !== 'object') {
          return item[key] === value;
        }

        // 操作符查詢
        if (value.$gte !== undefined) return item[key] >= value.$gte;
        if (value.$lte !== undefined) return item[key] <= value.$lte;
        if (value.$gt !== undefined) return item[key] > value.$gt;
        if (value.$lt !== undefined) return item[key] < value.$lt;
        if (value.$contains !== undefined) return String(item[key]).includes(value.$contains);
        if (value.$in !== undefined) return value.$in.includes(item[key]);

        return true;
      });
    });
  }

  /**
   * 根據 ID 取得記錄
   */
  async getById(id) {
    const all = await this.getAll();
    return all.find(c => c.id === id) || null;
  }

  /**
   * 更新記錄
   */
  async update(id, updates) {
    const corrections = await this.getAll();
    const index = corrections.findIndex(c => c.id === id);

    if (index === -1) {
      throw new Error(`Correction with id ${id} not found`);
    }

    corrections[index] = {
      ...corrections[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await this._saveToStorage(corrections);
    return corrections[index];
  }

  /**
   * 刪除記錄
   */
  async delete(id) {
    const corrections = await this.getAll();
    const filtered = corrections.filter(c => c.id !== id);

    if (filtered.length === corrections.length) {
      return false; // 沒有刪除任何記錄
    }

    await this._saveToStorage(filtered);
    return true;
  }

  /**
   * 清除所有記錄
   */
  async clear() {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ [this.STORAGE_KEY]: [] }, resolve);
    });
  }

  /**
   * 取得統計資訊
   */
  async getStats() {
    const corrections = await this.getAll();

    // 語言分布
    const languageDistribution = corrections.reduce((acc, c) => {
      acc[c.language] = (acc[c.language] || 0) + 1;
      return acc;
    }, {});

    // 總修正次數
    const totalCorrections = corrections.reduce((sum, c) => sum + c.count, 0);

    // 最常見的錯誤
    const topErrors = corrections
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(c => ({ wrong: c.wrong, correct: c.correct, count: c.count }));

    // 儲存使用量
    const storageUsed = JSON.stringify(corrections).length;
    const storageLimit = 102400; // 100 KB
    const storagePercent = (storageUsed / storageLimit * 100).toFixed(2);

    return {
      total: corrections.length,
      totalCorrections,
      languageDistribution,
      topErrors,
      storage: {
        used: storageUsed,
        limit: storageLimit,
        percent: storagePercent,
        available: storageLimit - storageUsed
      },
      oldestRecord: corrections.length > 0 ? corrections.reduce((a, b) =>
        new Date(a.createdAt) < new Date(b.createdAt) ? a : b
      ).createdAt : null,
      newestRecord: corrections.length > 0 ? corrections.reduce((a, b) =>
        new Date(a.createdAt) > new Date(b.createdAt) ? a : b
      ).createdAt : null
    };
  }

  /**
   * 匯出資料
   */
  async export() {
    const corrections = await this.getAll();
    return {
      version: this.CURRENT_VERSION,
      exportDate: new Date().toISOString(),
      storageType: 'chrome.storage.sync',
      dataCount: corrections.length,
      data: corrections
    };
  }

  /**
   * 匯入資料
   */
  async import(exportData) {
    if (!exportData.data || !Array.isArray(exportData.data)) {
      throw new Error('Invalid import data format');
    }

    // 合併現有資料
    const existing = await this.getAll();
    const imported = exportData.data;

    const merged = [...existing];

    for (const item of imported) {
      const index = merged.findIndex(c => c.wrong === item.wrong);
      if (index >= 0) {
        // 保留較高的 count
        merged[index].count = Math.max(merged[index].count, item.count);
        merged[index].lastSeen = new Date().toISOString();
      } else {
        merged.push({
          ...item,
          id: this._generateId(), // 重新生成 ID
          importedAt: new Date().toISOString()
        });
      }
    }

    await this._saveToStorage(merged);
    return {
      imported: imported.length,
      merged: merged.length,
      new: merged.length - existing.length
    };
  }

  /**
   * 私有方法：儲存到 Storage
   */
  async _saveToStorage(corrections) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.set({
        [this.STORAGE_KEY]: corrections,
        [this.VERSION_KEY]: this.CURRENT_VERSION
      }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 私有方法：生成唯一 ID
   */
  _generateId() {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================
// 3. IndexedDB Adapter（未來實現）
// ============================================

/**
 * IndexedDB 適配器（預留）
 * 未來當資料量超過 chrome.storage 限制時使用
 */
class IndexedDBAdapter extends ICorrectionStorage {
  constructor() {
    super();
    this.dbName = 'StreamSubtitlesDB';
    this.dbVersion = 1;
    this.storeName = 'corrections';
    this.db = null;
  }

  async _initDB() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 建立 object store
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, {
            keyPath: 'id',
            autoIncrement: true
          });

          // 建立索引
          store.createIndex('wrong', 'wrong', { unique: false });
          store.createIndex('correct', 'correct', { unique: false });
          store.createIndex('language', 'language', { unique: false });
          store.createIndex('count', 'count', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('lastSeen', 'lastSeen', { unique: false });
        }
      };
    });
  }

  // TODO: 實現其他方法
  async save(correction) {
    // 實現細節...
    throw new Error('IndexedDB adapter not yet implemented');
  }

  async getAll() {
    // 實現細節...
    throw new Error('IndexedDB adapter not yet implemented');
  }

  // ... 其他方法
}

// ============================================
// 4. Repository 管理器（單例）
// ============================================

/**
 * CorrectionRepository - 統一的資料存取介面
 * 使用單例模式，全域只有一個實例
 */
class CorrectionRepository {
  constructor() {
    if (CorrectionRepository.instance) {
      return CorrectionRepository.instance;
    }

    // 預設使用 Chrome Storage
    this.adapter = new ChromeStorageAdapter();
    this.adapterType = 'chrome-storage';

    CorrectionRepository.instance = this;
  }

  /**
   * 切換儲存適配器
   * @param {string} type - 'chrome-storage' | 'indexeddb' | 'firebase'
   */
  async switchAdapter(type) {
    console.log(`[Repository] 切換適配器: ${this.adapterType} -> ${type}`);

    // 匯出舊資料
    const oldData = await this.adapter.export();

    // 切換適配器
    switch (type) {
      case 'chrome-storage':
        this.adapter = new ChromeStorageAdapter();
        break;
      case 'indexeddb':
        this.adapter = new IndexedDBAdapter();
        await this.adapter._initDB();
        break;
      default:
        throw new Error(`Unknown adapter type: ${type}`);
    }

    this.adapterType = type;

    // 匯入舊資料
    await this.adapter.import(oldData);

    console.log(`[Repository] ✅ 適配器切換完成，資料已遷移`);
  }

  // 代理所有方法到當前 adapter
  async save(correction) {
    return this.adapter.save(correction);
  }

  async saveBatch(corrections) {
    return this.adapter.saveBatch(corrections);
  }

  async getAll() {
    return this.adapter.getAll();
  }

  async query(query) {
    return this.adapter.query(query);
  }

  async getById(id) {
    return this.adapter.getById(id);
  }

  async update(id, updates) {
    return this.adapter.update(id, updates);
  }

  async delete(id) {
    return this.adapter.delete(id);
  }

  async clear() {
    return this.adapter.clear();
  }

  async getStats() {
    return this.adapter.getStats();
  }

  async export() {
    return this.adapter.export();
  }

  async import(data) {
    return this.adapter.import(data);
  }

  /**
   * 取得當前適配器資訊
   */
  getAdapterInfo() {
    return {
      type: this.adapterType,
      adapter: this.adapter.constructor.name
    };
  }
}

// ============================================
// 5. 導出
// ============================================

// 建立全域單例
const correctionRepository = new CorrectionRepository();

// Chrome Extension 環境
if (typeof self !== 'undefined') {
  self.correctionRepository = correctionRepository;
}

if (typeof window !== 'undefined') {
  window.correctionRepository = correctionRepository;
}

// 也導出類別供測試使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CorrectionRepository,
    ChromeStorageAdapter,
    IndexedDBAdapter,
    correctionRepository
  };
}

console.log('[CorrectionRepository] 資料抽象層已載入');
