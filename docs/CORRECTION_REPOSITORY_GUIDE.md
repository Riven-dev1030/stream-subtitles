# 📚 Correction Repository 使用指南

## 🎯 概述

`CorrectionRepository` 是一個**資料抽象層（Data Abstraction Layer）**，實現了 **Repository Pattern（倉儲模式）**，讓底層儲存技術可以隨時替換，而業務邏輯完全不受影響。

---

## 🏗️ 架構設計

```
業務邏輯層（popup.js, content.js）
         ↓
  CorrectionRepository（統一介面）
         ↓
    Adapter（可替換）
         ↓
├─ ChromeStorageAdapter（當前）
├─ IndexedDBAdapter（未來）
└─ FirebaseAdapter（未來）
```

---

## 📝 基本使用

### 1. 載入 Repository

在 `manifest.json` 中引入：

```json
{
  "background": {
    "service_worker": "background/service-worker.js",
    "type": "module"
  },
  "content_scripts": [{
    "js": [
      "utils/correction-repository.js",
      "content/content.js"
    ]
  }]
}
```

在 `popup.html` 中引入：

```html
<script src="../utils/correction-repository.js"></script>
<script src="popup.js"></script>
```

### 2. 儲存修正記錄

**舊代碼**（直接操作 chrome.storage）：

```javascript
// ❌ 舊方式：直接操作 chrome.storage
chrome.storage.sync.get(['corrections'], (result) => {
  let corrections = result.corrections || [];
  corrections.push({
    wrong: wrongText,
    correct: correctText,
    count: 1,
    language: currentLanguage,
    createdAt: new Date().toISOString()
  });
  chrome.storage.sync.set({ corrections });
});
```

**新代碼**（使用 Repository）：

```javascript
// ✅ 新方式：使用 Repository
const repo = window.correctionRepository;

await repo.save({
  wrong: wrongText,
  correct: correctText,
  language: currentLanguage
});

// 自動處理：
// - ID 生成
// - 時間戳
// - 去重（相同 wrong 會更新 count）
// - 版本控制
```

### 3. 查詢記錄

**取得所有記錄**：

```javascript
const all = await repo.getAll();
console.log('總共', all.length, '筆記錄');
```

**條件查詢**：

```javascript
// 查詢特定語言
const zhCorrections = await repo.query({
  language: 'zh-TW'
});

// 查詢高頻錯誤（count >= 5）
const frequentErrors = await repo.query({
  count: { $gte: 5 }
});

// 查詢包含特定文字
const related = await repo.query({
  wrong: { $contains: '人事' }
});

// 複合查詢
const recent = await repo.query({
  language: 'zh-TW',
  count: { $gte: 3 }
});
```

**支援的查詢操作符**：

| 操作符 | 說明 | 範例 |
|--------|------|------|
| `$gte` | 大於等於 | `{ count: { $gte: 5 } }` |
| `$lte` | 小於等於 | `{ count: { $lte: 10 } }` |
| `$gt` | 大於 | `{ count: { $gt: 3 } }` |
| `$lt` | 小於 | `{ count: { $lt: 20 } }` |
| `$contains` | 包含 | `{ wrong: { $contains: '人' } }` |
| `$in` | 在陣列中 | `{ language: { $in: ['zh-TW', 'ja'] } }` |

### 4. 更新記錄

```javascript
// 根據 ID 更新
await repo.update('corr_123456', {
  correct: '新的正確文字',
  count: 10
});
```

### 5. 刪除記錄

```javascript
// 刪除單筆
await repo.delete('corr_123456');

// 清除所有
await repo.clear();
```

### 6. 統計資訊

```javascript
const stats = await repo.getStats();

console.log(stats);
// {
//   total: 150,
//   totalCorrections: 850,
//   languageDistribution: {
//     'zh-TW': 80,
//     'en': 50,
//     'ja': 20
//   },
//   topErrors: [
//     { wrong: '認是', correct: '人事', count: 25 },
//     { wrong: '會一', correct: '會議', count: 18 }
//   ],
//   storage: {
//     used: 35000,
//     limit: 102400,
//     percent: '34.18',
//     available: 67400
//   },
//   oldestRecord: '2025-01-01T00:00:00.000Z',
//   newestRecord: '2025-12-21T10:00:00.000Z'
// }
```

### 7. 匯出/匯入

**匯出資料**：

```javascript
const exportData = await repo.export();

// 下載為 JSON 檔案
const blob = new Blob([JSON.stringify(exportData, null, 2)], {
  type: 'application/json'
});
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `corrections_backup_${Date.now()}.json`;
a.click();
```

**匯入資料**：

```javascript
// 從檔案讀取
const fileInput = document.getElementById('import-file');
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const text = await file.text();
  const data = JSON.parse(text);

  const result = await repo.import(data);
  console.log('匯入結果:', result);
  // { imported: 100, merged: 150, new: 50 }
});
```

---

## 🔄 遷移到新 Repository

### 步驟 1：更新 popup.js

**修改前**：

```javascript
// popup.js 舊代碼
function saveCorrection() {
  const wrongText = editModal.querySelector('#wrong-text').value.trim();
  const correctText = editModal.querySelector('#correct-text').value.trim();

  chrome.storage.sync.get(['corrections'], (result) => {
    let corrections = result.corrections || [];
    const existingIndex = corrections.findIndex(c => c.wrong === wrongText);

    if (existingIndex >= 0) {
      corrections[existingIndex].correct = correctText;
      corrections[existingIndex].count += 1;
      corrections[existingIndex].lastSeen = new Date().toISOString();
    } else {
      corrections.push({
        wrong: wrongText,
        correct: correctText,
        count: 1,
        language: currentLanguage,
        createdAt: new Date().toISOString(),
        lastSeen: new Date().toISOString()
      });
    }

    chrome.storage.sync.set({ corrections }, () => {
      console.log('修正已儲存');
      showToast('✅ 修正已儲存');
      closeEditModal();
    });
  });
}
```

**修改後**：

```javascript
// popup.js 新代碼
async function saveCorrection() {
  const wrongText = editModal.querySelector('#wrong-text').value.trim();
  const correctText = editModal.querySelector('#correct-text').value.trim();

  if (!correctText) {
    showToast('請輸入正確的文字');
    return;
  }

  try {
    const repo = window.correctionRepository;

    await repo.save({
      wrong: wrongText,
      correct: correctText,
      language: currentLanguage
    });

    console.log('修正已儲存');
    showToast('✅ 修正已儲存');
    closeEditModal();

    // 重新載入顯示
    await loadCorrections();
  } catch (error) {
    console.error('儲存失敗:', error);
    showToast('❌ 儲存失敗');
  }
}
```

### 步驟 2：更新 content.js

**修改前**：

```javascript
// content.js 舊代碼
function saveCorrection() {
  chrome.storage.sync.get(['corrections'], (result) => {
    let corrections = result.corrections || [];
    // ... 處理邏輯
    chrome.storage.sync.set({ corrections }, () => {
      // ...
    });
  });
}
```

**修改後**：

```javascript
// content.js 新代碼
async function saveCorrection() {
  const repo = window.correctionRepository;

  await repo.save({
    wrong: wrongText,
    correct: correctText,
    language: currentLanguage
  });

  showToast('✅ 修正已儲存');
  closeEditModal();
}
```

### 步驟 3：更新載入邏輯

**修改前**：

```javascript
function loadCorrections() {
  chrome.storage.sync.get(['corrections'], (result) => {
    const corrections = result.corrections || [];
    displayCorrections(corrections);
  });
}
```

**修改後**：

```javascript
async function loadCorrections() {
  const repo = window.correctionRepository;
  const corrections = await repo.getAll();
  displayCorrections(corrections);
}
```

---

## 🚀 未來遷移到 IndexedDB

當資料量超過 500 筆時，可以無縫切換到 IndexedDB：

```javascript
// 檢查資料量
const stats = await repo.getStats();

if (stats.storage.percent > 80) {
  // 警告使用者即將滿
  console.warn('⚠️ 儲存空間使用率:', stats.storage.percent, '%');

  // 建議切換到 IndexedDB
  if (confirm('儲存空間即將用盡，是否切換到本地資料庫？')) {
    await repo.switchAdapter('indexeddb');
    console.log('✅ 已切換到 IndexedDB');
  }
}
```

**切換過程完全自動**：
1. ✅ 匯出舊資料
2. ✅ 切換適配器
3. ✅ 匯入資料
4. ✅ 業務邏輯**零改動**

---

## 📊 API 完整列表

| 方法 | 說明 | 範例 |
|------|------|------|
| `save(correction)` | 儲存單筆記錄 | `await repo.save({ wrong, correct, language })` |
| `saveBatch(corrections)` | 批次儲存 | `await repo.saveBatch([...])` |
| `getAll()` | 取得所有記錄 | `const all = await repo.getAll()` |
| `query(query)` | 條件查詢 | `await repo.query({ language: 'zh-TW' })` |
| `getById(id)` | 根據 ID 取得 | `await repo.getById('corr_123')` |
| `update(id, updates)` | 更新記錄 | `await repo.update('corr_123', { count: 10 })` |
| `delete(id)` | 刪除記錄 | `await repo.delete('corr_123')` |
| `clear()` | 清除所有 | `await repo.clear()` |
| `getStats()` | 取得統計 | `const stats = await repo.getStats()` |
| `export()` | 匯出資料 | `const data = await repo.export()` |
| `import(data)` | 匯入資料 | `await repo.import(data)` |
| `switchAdapter(type)` | 切換適配器 | `await repo.switchAdapter('indexeddb')` |
| `getAdapterInfo()` | 取得適配器資訊 | `const info = repo.getAdapterInfo()` |

---

## 🎯 優勢總結

### ✅ 當前優勢

1. **統一介面**：所有代碼使用相同 API
2. **自動化處理**：ID、時間戳、去重自動處理
3. **查詢增強**：支援複雜查詢（$gte, $contains 等）
4. **統計功能**：內建統計資訊
5. **匯出/匯入**：方便備份與遷移

### 🚀 未來優勢

1. **無縫遷移**：切換儲存技術**零代碼改動**
2. **擴展性**：輕鬆新增適配器（Firebase、自建 API）
3. **測試友善**：可替換為 Mock Adapter
4. **版本控制**：內建數據版本管理
5. **向下兼容**：舊資料自動遷移

---

## 🔧 故障排除

### Q1: 為什麼我的代碼還在使用 `chrome.storage.sync`？

**A**: 需要手動遷移。參考「遷移到新 Repository」章節。

### Q2: 如何檢查當前使用的適配器？

```javascript
const info = repo.getAdapterInfo();
console.log(info);
// { type: 'chrome-storage', adapter: 'ChromeStorageAdapter' }
```

### Q3: 切換適配器會丟失資料嗎？

**A**: 不會！`switchAdapter()` 會自動匯出舊資料並匯入新適配器。

### Q4: 如何回滾到舊的儲存方式？

```javascript
await repo.switchAdapter('chrome-storage');
```

---

## 📚 延伸閱讀

- [Repository Pattern 設計模式](https://martinfowler.com/eaaCatalog/repository.html)
- [Chrome Extension Storage API](https://developer.chrome.com/docs/extensions/reference/storage/)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

---

**作者**: Claude AI
**版本**: 1.0.0
**最後更新**: 2025-12-21
