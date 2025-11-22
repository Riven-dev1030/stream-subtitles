# 字幕處理邏輯說明

本文檔詳細說明 `stream-subtitles` Chrome 擴充功能中 **Final（最終）** 和 **Interim（臨時）** 字幕的處理邏輯差異。

**文件版本**: 2025-11-22 (更新)
**相關代碼**: `extension/content/content.js`

---

## 📋 目錄

1. [核心設計理念](#核心設計理念)
2. [處理邏輯對比表](#處理邏輯對比表)
3. [Final 結果處理流程](#final-結果處理流程)
4. [Interim 結果處理流程](#interim-結果處理流程)
5. [定時清理機制](#定時清理機制)
6. [字數額度共享機制](#字數額度共享機制)
7. [時間參數配置](#時間參數配置)
8. [版本演進歷史](#版本演進歷史)

---

## 💡 核心設計理念

### 🎯 最新架構（2025-11-22 v4 - Interim 主導模式）

```
字幕顯示架構：
┌─────────────────────────────┐
│ displayBuffer (混合存儲)     │
│   ├─ Final 句子 1 (已校正)   │
│   ├─ Final 句子 2 (已校正)   │
│   └─ Interim 句子 3 (即時)   │ ← 主要字幕來源
└─────────────────────────────┘
     ↓
Interim 立即顯示（0 延遲）
Final 靜默校正（背景更新）
總字數 ≤ 50 字
```

**關鍵原則（Interim 主導）**：
1. ✅ **Interim 主導**：立即加入 displayBuffer，幾乎 0 延遲
2. ✅ **Final 靜默校正**：找到對應的 interim 並靜默更新為 final
3. ✅ **字數限制**：Interim 和 Final 都要檢查字數限制（最多 50 字）
4. ✅ **定時自動清理**：每 1 秒清理，不依賴 Final
5. ✅ **單一 Interim 規則**：Buffer 中最多只有 1 個 interim（同一句話不斷更新）

---

## 📊 處理邏輯對比表

| 特性 | **Final 結果** | **Interim 結果** |
|-----|--------------|----------------|
| **觸發條件** | `isFinal === true` | `isFinal === false` |
| **角色定位** | 靜默校正（背景工作） | 主要字幕來源（即時顯示） |
| **延遲** | 7-12 秒 | ~0 秒 |
| **存儲位置** | `displayBuffer` 陣列 | `displayBuffer` 陣列 |
| **是否加入 Buffer** | ✅ 是（校正現有 interim） | ✅ 是（立即加入） |
| **來源標記** | `source: 'final'` | `source: 'interim'` |
| **處理邏輯** | 找到對應 interim 靜默更新 | 檢測更新或新增句子 |
| **字數限制檢查** | ✅ 必須檢查（避免 170+ 字） | ✅ 必須檢查（避免 170+ 字） |
| **清理舊 interim** | ❌ 不清理（只負責校正） | ✅ 新增前清理所有舊 interim |
| **單一 Interim 規則** | N/A | ✅ Buffer 中最多只有 1 個 interim |
| **相似度計算** | ✅ 計算與 interim 的相似度 | ❌ 無 |
| **加入歷史記錄** | ✅ 保存到 `subtitleHistory` | ❌ 不保存 |
| **最小顯示時間** | 1.5 秒（定時清理保護） | 無（被下一個 Interim 覆蓋） |
| **清除時機** | 定時清理（每 1 秒） | 新 interim 到來時清理舊的 |

---

## 🎯 Final 結果處理流程（靜默校正模式）

**位置**: `content.js:489-562`
**觸發**: `displaySubtitle(text, isFinal=true)`

**核心理念**: Final 不再加入新句子，而是**找到對應的 interim 並靜默更新為 final**

### 處理步驟

```
Final 結果到來
│
├─ 步驟 1: 重複檢測
│  ├─ 檢查是否和上次 final 完全相同
│  │  └─ 相同 → ❌ 跳過處理
│  └─ 更新 lastFinalTranscript
│
├─ 步驟 2: 尋找對應的 Interim 項目
│  └─ 從後往前搜尋 displayBuffer
│     ├─ 找到 source === 'interim' 的項目
│     └─ targetIndex = 該項目的索引
│
├─ 步驟 3: 如果找到對應的 Interim
│  │
│  ├─ 3.1: 計算相似度
│  │  └─ similarity = calculateSimilarity(interimText, finalText)
│  │
│  ├─ 3.2: 字數限制檢查 ⚠️ 重要！
│  │  ├─ 計算其他項目字數（排除被校正項目）
│  │  ├─ maxAllowed = 50 - otherItemsChars
│  │  └─ 如果 finalText 超長 → 截斷保留最後的字
│  │
│  ├─ 3.3: 靜默更新（不重新顯示）
│  │  └─ displayBuffer[targetIndex] = {
│  │       text: finalText,
│  │       timestamp: interimItem.timestamp, ← 保留原時間戳
│  │       source: 'final',
│  │       corrected: similarity < 0.9
│  │     }
│  │
│  └─ 3.4: 更新顯示
│     └─ updateSubtitleDisplay()
│
├─ 步驟 4: 保存到歷史記錄
│  └─ subtitleHistory.push({ text, timestamp, language })
│
└─ 完成（不調用 cleanupBuffer，由定時器負責）
```

### 關鍵代碼片段

```javascript
if (isFinal) {
  // 1. 重複檢測
  const normalized = normalizeText(text);
  if (normalized === lastFinalTranscript) return;
  lastFinalTranscript = normalized;

  // 2. 找到對應的 interim
  let targetIndex = -1;
  for (let i = displayBuffer.length - 1; i >= 0; i--) {
    if (displayBuffer[i].source === 'interim') {
      targetIndex = i;
      break;
    }
  }

  if (targetIndex >= 0) {
    const interimItem = displayBuffer[targetIndex];
    const similarity = calculateSimilarity(interimItem.text, normalized);

    // 3. 字數限制檢查（避免 170+ 字 bug）
    const otherItemsChars = displayBuffer
      .filter((_, i) => i !== targetIndex)
      .reduce((sum, item) => sum + item.text.length, 0);
    const maxAllowed = MAX_TOTAL_CHARS - otherItemsChars;

    let finalText = normalized;
    if (normalized.length > maxAllowed) {
      finalText = normalized.slice(-maxAllowed);
    }

    // 4. 靜默更新
    displayBuffer[targetIndex] = {
      text: finalText,
      timestamp: interimItem.timestamp, // 保留原時間戳
      source: 'final',
      corrected: similarity < 0.9
    };
    updateSubtitleDisplay();
  }

  // 5. 保存到歷史
  subtitleHistory.push({ text: normalized, timestamp: Date.now(), language });
}
```

---

## ⚡ Interim 結果處理流程（主要字幕來源）

**位置**: `content.js:564-610`
**觸發**: `displaySubtitle(text, isFinal=false)`

**核心理念**: Interim 立即加入 displayBuffer，成為**主要字幕來源**（幾乎 0 延遲）

### 處理步驟

```
Interim 結果到來
│
├─ 步驟 1: 檢測是否更新現有句子
│  ├─ 檢查最後一項是否為 interim
│  ├─ 判斷新文字是否包含舊文字（同一句話在變化）
│  └─ shouldUpdate = true/false
│
├─ 情況 A: 更新現有 Interim（shouldUpdate === true）
│  │
│  ├─ 1.1: 字數限制檢查 ⚠️ 重要！
│  │  ├─ 計算其他項目字數（不含最後一項）
│  │  ├─ maxAllowed = 50 - otherItemsChars
│  │  └─ 如果超長 → 截斷保留最後的字
│  │
│  └─ 1.2: 更新最後一項
│     └─ displayBuffer[last] = {
│          text: finalText,
│          timestamp: Date.now(),
│          source: 'interim'
│        }
│
└─ 情況 B: 新增 Interim 句子（shouldUpdate === false）
   │
   ├─ 2.1: 清理舊 Interim ⚠️ 重要！
   │  ├─ 確保 Buffer 中最多只有 1 個 interim
   │  └─ displayBuffer.filter(item => item.source === 'final')
   │
   ├─ 2.2: 檢查是否需要清理（分層清理）
   │  └─ 如果總字數 + 新字數 > 50
   │     └─ cleanupBeforeAdd([normalized])
   │
   └─ 2.3: 加入 Buffer
      └─ displayBuffer.push({
           text: normalized,
           timestamp: Date.now(),
           source: 'interim'
         })
```

### 關鍵代碼片段

```javascript
else { // isFinal === false
  const normalized = normalizeText(text);

  // 1. 檢測是否更新現有句子
  let shouldUpdate = false;
  if (displayBuffer.length > 0) {
    const lastItem = displayBuffer[displayBuffer.length - 1];
    if (lastItem.source === 'interim') {
      if (normalized.includes(lastItem.text) || lastItem.text.includes(normalized)) {
        shouldUpdate = true;
      }
    }
  }

  if (shouldUpdate) {
    // 情況 A: 更新現有 interim
    // 字數限制檢查（避免 170+ 字 bug）
    const otherItemsChars = displayBuffer
      .slice(0, -1)
      .reduce((sum, item) => sum + item.text.length, 0);
    const maxAllowed = MAX_TOTAL_CHARS - otherItemsChars;

    let finalText = normalized;
    if (normalized.length > maxAllowed) {
      finalText = normalized.slice(-maxAllowed);
    }

    displayBuffer[displayBuffer.length - 1] = {
      text: finalText,
      timestamp: Date.now(),
      source: 'interim'
    };
  } else {
    // 情況 B: 新增 interim 句子
    // 清理舊 interim（確保最多只有 1 個）
    const oldInterimCount = displayBuffer.filter(item => item.source === 'interim').length;
    if (oldInterimCount > 0) {
      displayBuffer = displayBuffer.filter(item => item.source === 'final');
    }

    // 檢查是否需要清理
    const totalChars = displayBuffer.reduce((sum, item) => sum + item.text.length, 0);
    if (totalChars + normalized.length > MAX_TOTAL_CHARS) {
      cleanupBeforeAdd([normalized]);
    }

    // 加入 Buffer
    displayBuffer.push({
      text: normalized,
      timestamp: Date.now(),
      source: 'interim'
    });
  }

  updateSubtitleDisplay();
}
```

---

## 🔄 定時清理機制

**位置**: `content.js:350-392` (cleanupBuffer 函數)
**觸發**: 每 1 秒自動執行（`setInterval`）

### 清理邏輯

```
定時清理器（每 1 秒）
│
├─ 檢查 Buffer 是否為空
│  └─ 空 → 跳過
│
├─ 清理策略 1: 按句子數
│  └─ while (displayBuffer.length > 3)
│     ├─ 檢查最舊句子顯示時間 >= 1.5 秒
│     ├─ 符合 → shift() 移除最舊句子
│     └─ 不符合 → break (暫停清理)
│
├─ 清理策略 2: 按總字符數
│  └─ while (totalChars > 50)
│     ├─ 檢查最舊句子顯示時間 >= 1.5 秒
│     ├─ 符合 → shift() 移除最舊句子
│     └─ 不符合 → break (暫停清理)
│
└─ 如果有清理，更新顯示
   └─ updateSubtitleDisplay(interimSubtitle)
```

### 關鍵代碼

```javascript
// 啟動定時清理器（在 init() 函數中）
setInterval(() => {
  cleanupBuffer();
}, 1000);

// cleanupBuffer() 函數
function cleanupBuffer() {
  if (displayBuffer.length === 0) return;

  const currentTime = Date.now();
  let cleaned = false;

  // 1. 按句子數清理
  while (displayBuffer.length > MAX_DISPLAY_SENTENCES) { // > 3
    const oldest = displayBuffer[0];
    const displayDuration = currentTime - oldest.timestamp;

    if (displayDuration >= MIN_DISPLAY_TIME) { // >= 1500ms
      const removed = displayBuffer.shift();
      cleaned = true;
      console.log('🗑️ 定時清理（超過句數）');
    } else {
      break;
    }
  }

  // 2. 按總字符數清理
  let totalChars = displayBuffer.reduce((sum, item) => sum + item.text.length, 0);
  while (totalChars > MAX_TOTAL_CHARS && displayBuffer.length > 1) {
    const oldest = displayBuffer[0];
    const displayDuration = currentTime - oldest.timestamp;

    if (displayDuration >= MIN_DISPLAY_TIME) {
      const removed = displayBuffer.shift();
      totalChars -= removed.text.length;
      cleaned = true;
      console.log('🗑️ 定時清理（超過字符）');
    } else {
      break;
    }
  }

  // 如果清理了內容，更新顯示
  if (cleaned) {
    updateSubtitleDisplay(interimSubtitle);
  }
}
```

### 優勢

| 特性 | 舊機制（只在 Final 時清理） | 新機制（定時清理） |
|-----|------------------------|----------------|
| **清理觸發** | 只在 Final 結果時 | 每 1 秒自動檢查 |
| **最大延遲** | 可能 30+ 秒 | 最多 1.5 + 1 = 2.5 秒 |
| **Buffer 累積** | 可能 10+ 項 | 最多 3-4 項 |
| **依賴性** | 依賴 Final 結果 | 完全獨立 |

---

## 💰 字數額度共享機制

### 設計原則

**總額度**: 50 字（Final + Interim 共享）
**動態分配**: 根據 Buffer 使用情況動態調整 Interim 可用額度

### 分配邏輯

```
總額度 = 50 字
Buffer 使用 = X 字
剩餘額度 = 50 - X
Interim 可顯示 = min(剩餘額度, 35)
```

### 實際案例

| Buffer 字數 | 剩餘額度 | Interim 可顯示 | 總字數 |
|-----------|---------|--------------|-------|
| 0 字 | 50 字 | 35 字 (min(50, 35)) | 35 字 |
| 10 字 | 40 字 | 35 字 (min(40, 35)) | 45 字 |
| 20 字 | 30 字 | 30 字 (min(30, 35)) | 50 字 |
| 30 字 | 20 字 | 20 字 (min(20, 35)) | 50 字 |
| 40 字 | 10 字 | 10 字 (min(10, 35)) | 50 字 |
| 50 字 | 0 字 | 0 字 (min(0, 35)) | 50 字 |
| 60 字 | -10 字 | 0 字 (max(0, -10)) | 60 字* |

*註：Buffer 超過 50 字時會觸發清理，實際不會到 60 字

### 視覺效果

```
場景 1：Buffer 較少 (20 字)
┌─────────────────────────┐
│ Final 句子 (20字)        │ ← Buffer: 20 字
│ ...Interim 30 字內容     │ ← Interim: 30 字
└─────────────────────────┘
總計：50 字 ✅

場景 2：Buffer 中等 (35 字)
┌─────────────────────────┐
│ Final 句子 1 (15字)      │
│ Final 句子 2 (20字)      │ ← Buffer: 35 字
│ ...Interim 15字          │ ← Interim: 15 字
└─────────────────────────┘
總計：50 字 ✅

場景 3：Buffer 已滿 (50 字)
┌─────────────────────────┐
│ Final 句子 1 (15字)      │
│ Final 句子 2 (20字)      │
│ Final 句子 3 (15字)      │ ← Buffer: 50 字
│ (Interim 無法顯示)       │ ← Interim: 0 字
└─────────────────────────┘
總計：50 字 ✅
```

---

## ⚙️ 時間參數配置

**位置**: `content.js:13-19`

```javascript
const MAX_DISPLAY_SENTENCES = 3;      // 最多顯示 3 句
const MAX_CHARS_PER_LINE = 15;        // 每行最多 15 字元
const MAX_TOTAL_CHARS = 50;           // 總共最多 50 字元（Final + Interim 共享）
const MIN_DISPLAY_TIME = 1500;        // Final 句子至少顯示 1.5 秒
const MIN_INTERIM_DISPLAY_TIME = 2000;// 已棄用（Interim 不加入 Buffer）

// 其他時間參數
const HEARTBEAT_INTERVAL = 1000;      // 心跳檢測間隔 1 秒
const HEARTBEAT_TIMEOUT = 6000;       // 心跳超時 6 秒（從3秒放寬以減少誤判）
const CLEANUP_INTERVAL = 1000;        // 清理檢查間隔 1 秒

// 硬編碼的時間閾值
const STALE_INTERIM_THRESHOLD = 5000; // 清理過舊 interim 的閾值 5 秒
```

### 時間參數用途

| 參數 | 值 | 用途 |
|-----|---|------|
| `MIN_DISPLAY_TIME` | 1500ms (1.5秒) | Final 句子的最小顯示時間 |
| `HEARTBEAT_TIMEOUT` | 6000ms (6秒) | 語音識別卡住超時時間 |
| `CLEANUP_INTERVAL` | 1000ms (1秒) | 定時清理檢查間隔 |
| `STALE_INTERIM_THRESHOLD` | 5000ms (5秒) | Final 出現時清理 interim 的年齡閾值 |

### 心跳超時調整說明

**調整歷史**：
- v3: 3000ms (3秒) - 初始設定
- v5: **6000ms (6秒)** - 當前設定（2025-11-22）

**調整原因**：
- 用戶測試發現 3 秒超時導致每 50 秒重啟一次
- Web Speech API 可能有 3-5 秒的正常處理延遲
- 3 秒設定過於激進，將正常延遲誤判為卡住
- 調整到 6 秒大幅減少誤判，提升穩定性

---

## 📈 版本演進歷史

### 版本 5 (2025-11-22 最新)
**心跳超時優化**

✅ **改進**：
- HEARTBEAT_TIMEOUT: 3 秒 → 6 秒
- 給予 Web Speech API 更多處理緩衝時間
- 減少誤判導致的不必要重啟

✅ **效果**：
- 重啟頻率從 ~50 秒一次降低到預期 >100 秒一次
- 提升整體穩定性

📝 **相關提交**: `ca9a07b` - perf: 放寬心跳超時到 6 秒以減少誤判重啟

---

### 版本 4 (2025-11-22)
**Interim 主導模式重大重構** 🎯

✅ **核心變更**：
- **Interim 成為主要字幕來源**：立即加入 displayBuffer（~0 秒延遲）
- **Final 改為靜默校正**：找到對應 interim 並背景更新（不影響顯示）
- **單一 Interim 規則**：Buffer 中最多只有 1 個 interim
- **字數限制強化**：Interim 和 Final 都要檢查字數限制

✅ **新增功能**：
- `calculateSimilarity()` 函數：計算 interim 和 final 的相似度
- 清理舊 interim：新增 interim 前先清理所有舊的
- 分層清理：`cleanupBeforeAdd()` 三層漸進式清理邏輯

✅ **Bug 修復**：
- 修復字數限制失效（170+ 字 bug）
- 修復日誌負數顯示（雙重減法）
- 修復多個 interim 累積（343 字 bug）

✅ **監控功能**：
- 添加存活計時器監控重啟頻率
- 詳細的心跳檢查日誌
- 會話統計（時長、重啟次數、平均間隔）

✅ **效果**：
- 延遲從 7-12 秒降低到 ~0 秒
- 總字數嚴格控制在 50 字以內
- 即時性大幅提升，準確性不受影響

📝 **相關提交**:
- `81d86d0` - feat: 改為 Interim 主導解決 Final 延遲問題
- `a4ad0fe` - fix: 修復字數限制失效和重複顯示問題
- `5aaef33` - fix: 修復日誌負數顯示和多 Interim 累積問題
- `782e3ef` - feat: 添加存活計時器監控心跳檢測重啟

---

### 版本 3 (2025-11-22)
**定時清理 + 字數共享**

✅ **新增功能**：
- 定時清理器（每 1 秒自動清理 Buffer）
- Final + Interim 共享 50 字額度（動態分配）
- Interim 完全不加入 Buffer，只臨時顯示

✅ **參數調整**：
- MIN_DISPLAY_TIME: 3 秒 → 1.5 秒
- HEARTBEAT_TIMEOUT: 5 秒 → 3 秒

✅ **效果**：
- 句子最多顯示 2.5 秒（1.5s + 1s 延遲）
- Buffer 不會累積超過 3-4 項
- 總字數嚴格控制在 50 字以內

❌ **問題**：
- Final 延遲太久（7-12 秒），字幕落後影片
- 導致 v4 重構為 Interim 主導模式

---

### 版本 2 (2025-11-21)
**Interim 簡化處理**

✅ **改進**：
- Interim 不再加入 Buffer
- 移除 Interim 複雜的斷句和清理邏輯
- Interim 只做臨時顯示

❌ **問題**：
- 清理只在 Final 時觸發
- 句子可能顯示 30+ 秒
- Buffer 可能累積 10+ 項

---

### 版本 1 (2025-11-21 初始)
**Interim 加入 Buffer + 完整清理**

✅ **功能**：
- Interim 斷句並加入 Buffer
- Interim 有完整清理邏輯
- MIN_INTERIM_DISPLAY_TIME = 2 秒

❌ **問題**：
- Interim 快速累積（每 0.1 秒一個）
- 去重檢查不足
- 清理邏輯與累積衝突

---

## 🔧 故障排除

### 問題 1: 字幕累積過多
**檢查**:
- Console 是否有 "🗑️ 定時清理" 日誌？
- Buffer 項目數是否超過 3-4 項？

**解決**:
- 確認定時清理器已啟動
- 檢查 MIN_DISPLAY_TIME 是否太長

### 問題 2: 字幕消失太快
**調整參數**:
```javascript
const MIN_DISPLAY_TIME = 2000; // 從 1500ms 改為 2000ms
```

### 問題 3: Interim 不顯示
**檢查**:
- Console 是否顯示 "Buffer 已滿額"？
- Buffer 總字數是否 >= 50？

**原因**: Buffer 已用完 50 字額度，Interim 無剩餘空間

### 問題 4: 總字數超過 50
**檢查**:
- 是否暫時超過（清理延遲 1 秒）？
- 定時清理器是否正常運作？

---

## 🔗 相關文件

- **主程式**: `extension/content/content.js`
- **開發日誌**: `DEVLOG.md`
- **AI 助手指南**: `CLAUDE.md`

---

**最後更新**: 2025-11-22
**維護者**: Claude (AI Assistant)
**當前版本**: v5 (Interim 主導 + 心跳優化)
