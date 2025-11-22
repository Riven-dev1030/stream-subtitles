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

### 🎯 最新架構（2025-11-22）

```
字幕顯示架構：
┌─────────────────────────────┐
│ displayBuffer (只存 Final)   │
│   ├─ Final 句子 1 (淡化)     │
│   ├─ Final 句子 2 (淡化)     │
│   └─ Final 句子 3 (最新)     │
├─────────────────────────────┤
│ interimSubtitle (臨時變量)   │
│   └─ Interim 臨時文字...     │
└─────────────────────────────┘
     ↓
總字數 = Buffer 字數 + Interim 字數 ≤ 50
```

**關鍵原則**：
1. ✅ **Buffer 只存 Final**：最準確的內容
2. ✅ **Interim 只臨時顯示**：不污染 Buffer
3. ✅ **共享 50 字額度**：動態分配，版面乾淨
4. ✅ **定時自動清理**：每 1 秒清理，不依賴 Final

---

## 📊 處理邏輯對比表

| 特性 | **Final 結果** | **Interim 結果** |
|-----|--------------|----------------|
| **觸發條件** | `isFinal === true` | `isFinal === false` |
| **存儲位置** | `displayBuffer` 陣列 | `interimSubtitle` 變量 |
| **是否加入 Buffer** | ✅ 是 | ❌ 否 |
| **重複檢測** | ✅ 複雜（累積文字檢測） | ❌ 無 |
| **智能斷句** | ✅ `smartSplit()` | ❌ 無（直接顯示） |
| **來源標記** | `source: 'final'` | 不加入 Buffer，無標記 |
| **最小顯示時間** | 1.5 秒 | 無（被下一個 Interim 覆蓋） |
| **清理舊 interim** | ✅ 清理年齡 > 5 秒的 interim | N/A（不在 Buffer 中） |
| **加入歷史記錄** | ✅ 保存到 `subtitleHistory` | ❌ 不保存 |
| **顯示長度限制** | 每句最多 15 字，總共 50 字 | 動態分配（最多 35 字） |
| **清除時機** | 定時清理（每 1 秒） | 被覆蓋或 Final 清空 |

---

## 🎯 Final 結果處理流程

**位置**: `content.js:395-527`
**觸發**: `displaySubtitle(text, isFinal=true)`

### 處理步驟

```
Final 結果到來
│
├─ 步驟 1: 重複檢測
│  ├─ 檢查是否和上次 final 完全相同
│  │  └─ 相同 → ❌ 跳過處理
│  │
│  ├─ 檢測累積文字（includes 關係）
│  │  ├─ 新文字較短或相同 → ❌ 跳過
│  │  └─ 新文字較長 → ✅ 提取新增部分
│  │
│  └─ 更新 lastFinalTranscript
│
├─ 步驟 2: 清理過舊的 interim
│  ├─ filter() 保留所有 final
│  └─ filter() 只保留年齡 < 5 秒的 interim
│     └─ 清理年齡 >= 5 秒的 interim
│
├─ 步驟 3: 智能斷句
│  └─ smartSplit(normalized) → 分割成多個句子
│
├─ 步驟 4: 去重過濾
│  ├─ 完全匹配檢查（exact match）
│  └─ 高度重疊檢測（長度差距 <= 3）
│
├─ 步驟 5: 加入 Buffer
│  └─ 每個新句子:
│     ├─ displayBuffer.push({ text, timestamp, source: 'final' })
│     └─ subtitleHistory.push({ text, timestamp, language })
│
├─ 步驟 6: 調用清理函數
│  └─ cleanupBuffer() 清理過期句子
│
├─ 步驟 7: 清空 Interim
│  └─ interimSubtitle = '' （Final 出現，清空臨時文字）
│
└─ 步驟 8: 更新顯示
   └─ updateSubtitleDisplay()
```

### 關鍵代碼片段

```javascript
if (isFinal) {
  // 1. 重複檢測
  if (normalized === lastFinalTranscript) {
    return; // 跳過相同結果
  }

  // 2. 累積文字檢測
  if (lastFinalTranscript && normalized.includes(lastFinalTranscript)) {
    // 提取新增部分...
  }

  // 3. 清理過舊的 interim (年齡 > 5 秒)
  displayBuffer = displayBuffer.filter(item => {
    if (item.source === 'final') return true;
    const age = Date.now() - item.timestamp;
    return age < 5000;
  });

  // 4. 智能斷句
  const sentences = smartSplit(normalized);

  // 5. 去重過濾
  const newSentences = sentences.filter(sentence => {
    // 檢查重複...
  });

  // 6. 加入 Buffer
  newSentences.forEach(sentence => {
    displayBuffer.push({
      text: sentence,
      timestamp: Date.now(),
      source: 'final'
    });
    subtitleHistory.push({ text: sentence, ... });
  });

  // 7. 調用清理函數
  cleanupBuffer();

  // 8. 清空 Interim
  interimSubtitle = '';

  // 9. 更新顯示
  updateSubtitleDisplay();
}
```

---

## ⚡ Interim 結果處理流程

**位置**: `content.js:563-601`
**觸發**: `displaySubtitle(text, isFinal=false)`

### 處理步驟（簡化版）

```
Interim 結果到來
│
├─ 步驟 1: 計算 Buffer 總字數
│  └─ bufferTotalChars = Σ(displayBuffer[i].text.length)
│
├─ 步驟 2: 計算剩餘額度
│  └─ remainingQuota = 50 - bufferTotalChars
│
├─ 步驟 3: 確定 Interim 可顯示字數
│  └─ interimMaxChars = max(0, min(remainingQuota, 35))
│
├─ 步驟 4: 截取 Interim 文字
│  ├─ 如果 interimMaxChars > 0:
│  │  ├─ text.length <= interimMaxChars → 完整顯示
│  │  └─ text.length > interimMaxChars → 顯示 "...（最後 N 字）"
│  └─ 如果 interimMaxChars = 0:
│     └─ displayText = '' （Buffer 已滿，不顯示）
│
└─ 步驟 5: 更新臨時顯示（不加入 Buffer）
   ├─ interimSubtitle = displayText
   └─ updateSubtitleDisplay(displayText)
```

### 關鍵代碼片段

```javascript
else { // isFinal === false
  // 1. 計算 Buffer (Final) 的總字數
  const bufferTotalChars = displayBuffer.reduce((sum, item) =>
    sum + item.text.length, 0
  );

  // 2. 計算剩餘額度
  const remainingQuota = MAX_TOTAL_CHARS - bufferTotalChars; // 50 - Buffer

  // 3. Interim 可顯示字數 = min(剩餘額度, 35)
  const MAX_INTERIM_DISPLAY_CHARS = 35;
  const interimMaxChars = Math.max(0, Math.min(remainingQuota, MAX_INTERIM_DISPLAY_CHARS));

  // 4. 根據可用額度截取 Interim 文字
  let displayText = '';
  if (interimMaxChars > 0) {
    if (text.length > interimMaxChars) {
      displayText = '...' + text.slice(-interimMaxChars);
    } else {
      displayText = text;
    }
  } else {
    // Buffer 已滿額，Interim 無法顯示
    displayText = '';
  }

  // 5. 直接顯示在臨時區域，不加入 displayBuffer
  interimSubtitle = displayText;
  updateSubtitleDisplay(displayText);
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
const HEARTBEAT_TIMEOUT = 3000;       // 心跳超時 3 秒
const CLEANUP_INTERVAL = 1000;        // 清理檢查間隔 1 秒

// 硬編碼的時間閾值
const STALE_INTERIM_THRESHOLD = 5000; // 清理過舊 interim 的閾值 5 秒
```

### 時間參數用途

| 參數 | 值 | 用途 |
|-----|---|------|
| `MIN_DISPLAY_TIME` | 1500ms (1.5秒) | Final 句子的最小顯示時間 |
| `HEARTBEAT_TIMEOUT` | 3000ms (3秒) | 語音識別卡住超時時間 |
| `CLEANUP_INTERVAL` | 1000ms (1秒) | 定時清理檢查間隔 |
| `STALE_INTERIM_THRESHOLD` | 5000ms (5秒) | Final 出現時清理 interim 的年齡閾值 |

---

## 📈 版本演進歷史

### 版本 3 (2025-11-22 最新)
**重大改進：定時清理 + 字數共享**

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
- 版面更乾淨、更穩定

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
**當前版本**: v3 (定時清理 + 字數共享)
