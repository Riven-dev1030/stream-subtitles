# 字幕處理邏輯說明

本文檔詳細說明 `stream-subtitles` Chrome 擴充功能中 **Final（最終）** 和 **Interim（臨時）** 字幕的處理邏輯差異。

**文件版本**: 2025-11-22
**相關代碼**: `extension/content/content.js` (lines 351-596)

---

## 📋 目錄

1. [處理邏輯對比表](#處理邏輯對比表)
2. [Final 結果處理流程](#final-結果處理流程)
3. [Interim 結果處理流程](#interim-結果處理流程)
4. [關鍵差異總結](#關鍵差異總結)
5. [時間參數配置](#時間參數配置)
6. [設計理念](#設計理念)

---

## 📊 處理邏輯對比表

| 特性 | **Final 結果** | **Interim 結果** |
|-----|--------------|----------------|
| **觸發條件** | `isFinal === true` | `isFinal === false` |
| **代碼位置** | content.js:354-518 | content.js:519-596 |
| **重複檢測** | ✅ 複雜（累積文字檢測） | ❌ 無 |
| **智能斷句** | ✅ `smartSplit()` | ✅ `findSplitPoint()` |
| **Buffer 來源標記** | `source: 'final'` | `source: 'interim'` |
| **最小顯示時間** | 3 秒 (`MIN_DISPLAY_TIME`) | 2 秒 (`MIN_INTERIM_DISPLAY_TIME`) |
| **清理舊 interim** | ✅ 清理年齡 > 5 秒的 interim | ❌ 不清理 |
| **加入歷史記錄** | ✅ 保存到 `subtitleHistory` | ❌ 不保存 |
| **清理觸發時機** | Final 結果到來時 | Interim 斷句時 |
| **去重過濾** | ✅ 完全匹配 + 高度重疊檢測 | ✅ 僅完全匹配 |

---

## 🎯 Final 結果處理流程

**位置**: `content.js:354-518`
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
├─ 步驟 6: Final 清理策略
│  ├─ 清理策略 1: 按句子數
│  │  └─ while (displayBuffer.length > MAX_DISPLAY_SENTENCES)
│  │     ├─ 檢查最舊句子顯示時間 >= MIN_DISPLAY_TIME (3秒)
│  │     ├─ 符合 → shift() 移除最舊句子
│  │     └─ 不符合 → break (暫停清理)
│  │
│  └─ 清理策略 2: 按總字符數
│     └─ while (totalChars > MAX_TOTAL_CHARS)
│        ├─ 檢查最舊句子顯示時間 >= MIN_DISPLAY_TIME (3秒)
│        ├─ 符合 → shift() 移除最舊句子
│        └─ 不符合 → break (暫停清理)
│
└─ 步驟 7: 更新顯示
   └─ updateSubtitleDisplay()
```

### 關鍵代碼片段

```javascript
// 1. 重複檢測
if (normalized === lastFinalTranscript) {
  return; // 跳過相同結果
}

// 2. 累積文字檢測
if (lastFinalTranscript && (normalized.includes(lastFinalTranscript) ||
    lastFinalTranscript.includes(normalized))) {
  if (normalized.length <= lastFinalTranscript.length) {
    return; // 新文字較短，跳過
  }
  const newPart = normalized.replace(lastFinalTranscript, '').trim();
  // 使用 newPart...
}

// 3. 清理過舊的 interim (年齡 > 5 秒)
displayBuffer = displayBuffer.filter(item => {
  if (item.source === 'final') return true; // 保留所有 final

  const age = Date.now() - item.timestamp;
  if (age < 5000) {
    return true;  // 保留年齡 < 5 秒的 interim
  } else {
    console.log('[Content] 清理過舊的 interim');
    return false; // 移除年齡 >= 5 秒的 interim
  }
});

// 4. Final 清理策略（帶最小顯示時間保護）
while (displayBuffer.length > MAX_DISPLAY_SENTENCES) {
  const oldest = displayBuffer[0];
  const displayDuration = Date.now() - oldest.timestamp;

  if (displayDuration >= MIN_DISPLAY_TIME) { // 3000ms
    displayBuffer.shift(); // 移除最舊句子
  } else {
    break; // 顯示時間不夠，暫停清理
  }
}
```

---

## ⚡ Interim 結果處理流程

**位置**: `content.js:519-596`
**觸發**: `displaySubtitle(text, isFinal=false)`

### 處理步驟

```
Interim 結果到來
│
├─ 步驟 1: 長度檢查
│  └─ if (text.length > MAX_CHARS_PER_LINE) // > 15 字元
│     └─ ✅ 需要斷句
│        │
│        ├─ 步驟 2: 尋找斷句點
│        │  └─ findSplitPoint(text, MAX_CHARS_PER_LINE)
│        │
│        ├─ 步驟 3: 分割文字
│        │  ├─ 前半部分 → 完整句子（加入 Buffer）
│        │  │  ├─ normalizeText(text.slice(0, splitPoint))
│        │  │  ├─ 檢查是否已存在於 displayBuffer
│        │  │  └─ 不存在 → displayBuffer.push({
│        │  │                  text,
│        │  │                  timestamp: Date.now(),
│        │  │                  source: 'interim'
│        │  │                })
│        │  │
│        │  └─ 後半部分 → 臨時顯示（不加入 Buffer）
│        │     └─ interimSubtitle = remainingPart
│        │        updateSubtitleDisplay(remainingPart)
│        │
│        └─ 步驟 4: Interim 清理策略
│           ├─ 清理策略 1: 按句子數
│           │  └─ while (displayBuffer.length > MAX_DISPLAY_SENTENCES)
│           │     ├─ 檢查最舊句子的最小顯示時間:
│           │     │  ├─ Final → MIN_DISPLAY_TIME (3秒)
│           │     │  └─ Interim → MIN_INTERIM_DISPLAY_TIME (2秒)
│           │     ├─ 符合 → shift() 移除最舊句子
│           │     └─ 不符合 → break (暫停清理)
│           │
│           └─ 清理策略 2: 按總字符數
│              └─ while (totalChars > MAX_TOTAL_CHARS)
│                 ├─ 檢查最舊句子的最小顯示時間
│                 ├─ 符合 → shift() 移除最舊句子
│                 └─ 不符合 → break (暫停清理)
│
└─ 步驟 5: 更新顯示
   └─ updateSubtitleDisplay(remainingPart)
```

### 關鍵代碼片段

```javascript
// 1. 長度檢查並斷句
if (text.length > MAX_CHARS_PER_LINE) {
  const splitPoint = findSplitPoint(text, MAX_CHARS_PER_LINE);

  if (splitPoint > 0) {
    // 2. 前半部分加入 Buffer
    const completedPart = normalizeText(text.slice(0, splitPoint));
    const exists = displayBuffer.some(item => item.text === completedPart);

    if (!exists && completedPart) {
      displayBuffer.push({
        text: completedPart,
        timestamp: Date.now(),
        source: 'interim' // 標記為臨時來源
      });

      // 3. Interim 清理策略（根據來源使用不同最小顯示時間）
      while (displayBuffer.length > MAX_DISPLAY_SENTENCES) {
        const oldest = displayBuffer[0];
        const displayDuration = Date.now() - oldest.timestamp;

        // ⭐ 關鍵：根據來源決定最小顯示時間
        const minTime = oldest.source === 'final'
          ? MIN_DISPLAY_TIME          // 3000ms (Final)
          : MIN_INTERIM_DISPLAY_TIME; // 2000ms (Interim)

        if (displayDuration >= minTime) {
          displayBuffer.shift(); // 移除最舊句子
        } else {
          break; // 顯示時間不夠，暫停清理
        }
      }

      // 按總字符數清理（同樣邏輯）
      let totalChars = displayBuffer.reduce((sum, item) => sum + item.text.length, 0);
      while (totalChars > MAX_TOTAL_CHARS && displayBuffer.length > 1) {
        const oldest = displayBuffer[0];
        const displayDuration = Date.now() - oldest.timestamp;
        const minTime = oldest.source === 'final'
          ? MIN_DISPLAY_TIME
          : MIN_INTERIM_DISPLAY_TIME;

        if (displayDuration >= minTime) {
          const removed = displayBuffer.shift();
          totalChars -= removed.text.length;
        } else {
          break;
        }
      }
    }

    // 4. 後半部分臨時顯示
    const remainingPart = text.slice(splitPoint).trim();
    interimSubtitle = remainingPart;
    updateSubtitleDisplay(remainingPart);
  }
}
```

---

## 🔑 關鍵差異總結

### 1. 重複檢測策略

#### Final
- ✅ **完全相同檢測**: `normalized === lastFinalTranscript`
- ✅ **累積文字檢測**: 檢查 includes 關係，提取新增部分
- ✅ **高度重疊檢測**: 長度差距 <= 3 的句子視為重複

#### Interim
- ✅ **僅完全匹配**: 只檢查 `displayBuffer.some(item => item.text === completedPart)`
- ❌ 無累積檢測（Interim 變化太快，無需複雜檢測）

---

### 2. 清理觸發時機

#### Final 清理時機
```javascript
// 當 Final 結果到來時執行兩種清理:

// 清理 1: 移除過舊的 interim (年齡 > 5 秒)
displayBuffer = displayBuffer.filter(item => {
  if (item.source === 'final') return true;
  return (Date.now() - item.timestamp) < 5000;
});

// 清理 2: 按限制清理所有項目（FIFO，3 秒保護）
while (displayBuffer.length > MAX_DISPLAY_SENTENCES) {
  if (displayDuration >= MIN_DISPLAY_TIME) { // 3000ms
    displayBuffer.shift();
  }
}
```

#### Interim 清理時機
```javascript
// 當 Interim 斷句時執行清理:

// 只按限制清理（FIFO，根據來源使用不同時間保護）
while (displayBuffer.length > MAX_DISPLAY_SENTENCES) {
  const minTime = oldest.source === 'final'
    ? MIN_DISPLAY_TIME          // 3000ms
    : MIN_INTERIM_DISPLAY_TIME; // 2000ms

  if (displayDuration >= minTime) {
    displayBuffer.shift();
  }
}
```

**差異說明：**
- Final 清理會先移除「過舊的 interim」(> 5 秒)，因為 Final 已經來了，舊的 Interim 沒用了
- Interim 清理只按限制清理，且根據項目來源使用不同的最小顯示時間

---

### 3. 最小顯示時間保護

```javascript
// Final 清理時 (content.js:476)
if (displayDuration >= MIN_DISPLAY_TIME) { // 固定 3000ms
  displayBuffer.shift();
}

// Interim 清理時 (content.js:552, 570)
const minTime = oldest.source === 'final'
  ? MIN_DISPLAY_TIME          // 3000ms
  : MIN_INTERIM_DISPLAY_TIME; // 2000ms

if (displayDuration >= minTime) {
  displayBuffer.shift();
}
```

**設計理念：**
- Final 句子需要較長的顯示時間（3 秒），因為更準確，用戶需要時間閱讀
- Interim 句子可以較快移除（2 秒），因為可能不準確，需要快速更新

---

### 4. 斷句策略差異

#### Final: `smartSplit()` - 智能斷句
- 按標點符號分割（。！？等）
- 按空格分割
- 支援多種斷句規則
- 返回多個句子的陣列

#### Interim: `findSplitPoint()` - 簡單斷點
- 尋找適合的斷句位置
- 基於 `MAX_CHARS_PER_LINE` (15 字)
- 只切一次（前半 + 後半）
- 前半加入 Buffer，後半臨時顯示

---

### 5. 歷史記錄處理

#### Final
```javascript
// 每個新句子都加入歷史記錄
subtitleHistory.push({
  text: sentence,
  timestamp: Date.now(),
  language: currentLanguage
});

// 保存到 Chrome Storage
chrome.storage.local.set({ subtitleHistory });
```

#### Interim
```javascript
// ❌ 不加入歷史記錄
// 原因：Interim 可能不準確，不應該保存
```

---

## ⚙️ 時間參數配置

**位置**: `content.js:13-19`

```javascript
const MAX_DISPLAY_SENTENCES = 3;      // 最多顯示 3 句
const MAX_CHARS_PER_LINE = 15;        // 每行最多 15 字元
const MAX_TOTAL_CHARS = 50;           // 總共最多 50 字元
const MIN_DISPLAY_TIME = 3000;        // Final 句子至少顯示 3 秒
const MIN_INTERIM_DISPLAY_TIME = 2000;// Interim 句子至少顯示 2 秒

// 清理過舊 interim 的時間閾值
const STALE_INTERIM_THRESHOLD = 5000; // 5 秒（代碼中寫死，未定義常數）
```

### 時間參數用途

| 參數 | 值 | 用途 |
|-----|---|------|
| `MIN_DISPLAY_TIME` | 3000ms | Final 句子的最小顯示時間 |
| `MIN_INTERIM_DISPLAY_TIME` | 2000ms | Interim 句子的最小顯示時間 |
| `STALE_INTERIM_THRESHOLD` | 5000ms | Final 出現時清理 interim 的年齡閾值 |

### 清理邏輯中的時間判斷

```javascript
// 場景 1: Final 清理時，固定使用 MIN_DISPLAY_TIME (3秒)
if (displayDuration >= MIN_DISPLAY_TIME) { ... }

// 場景 2: Interim 清理時，根據來源動態選擇
const minTime = oldest.source === 'final'
  ? MIN_DISPLAY_TIME          // 3秒
  : MIN_INTERIM_DISPLAY_TIME; // 2秒

// 場景 3: Final 出現時清理過舊 interim，固定閾值 5 秒
const age = now - item.timestamp;
if (age < 5000) { return true; } // 保留
else { return false; }           // 移除
```

---

## 💡 設計理念

### 1. Final 是權威來源
- **高準確度**: Web Speech API 的最終識別結果
- **需要去重**: 避免重複顯示相同內容
- **保存歷史**: 作為準確的字幕記錄
- **顯示時間長**: 3 秒，確保用戶有足夠時間閱讀

### 2. Interim 是即時預覽
- **低延遲**: 快速顯示，提升用戶體驗
- **可能不準確**: 識別過程中的臨時結果
- **不保存歷史**: 避免不準確的內容污染記錄
- **顯示時間短**: 2 秒，快速更新

### 3. 混合策略的優勢
- **Buffer 可混合**: 同時包含 Final 和 Interim 項目
- **來源標記**: 通過 `source` 欄位區分來源
- **差異化處理**: 清理時根據來源使用不同的最小顯示時間
- **自動清理**: Final 出現時清理過舊的 Interim（> 5 秒）

### 4. FIFO (First In First Out) 清理順序
```javascript
// 總是移除最舊的項目（displayBuffer[0]）
displayBuffer.shift();
```
- 確保字幕按時間順序清理
- 避免中間或末尾的句子突然消失
- 符合用戶閱讀習慣

---

## 🔧 故障排除

### 問題 1: 字幕累積過多
**可能原因**: 清理邏輯未觸發
**檢查點**:
- 是否有 Final 或 Interim 斷句事件？
- 最小顯示時間是否太長？
- Console 是否有清理相關 log？

### 問題 2: 字幕消失太快
**可能原因**: 最小顯示時間太短
**調整參數**:
```javascript
const MIN_DISPLAY_TIME = 3000;        // 調高此值（如 5000）
const MIN_INTERIM_DISPLAY_TIME = 2000;// 調高此值（如 3000）
```

### 問題 3: 中間的句子突然消失
**可能原因**: 清理邏輯錯誤（已修復）
**已修復**: 使用 `shift()` 確保 FIFO 順序

### 問題 4: Interim 字幕一直不清理
**可能原因**: 缺少 Final 結果觸發清理
**解決方案**: 已在 Interim 斷句時加入完整清理邏輯

---

## 📝 版本歷史

### 2025-11-22 (當前版本)
- ✅ Interim 加入完整清理邏輯（按句數 + 按字符數）
- ✅ Interim 清理時根據來源使用不同最小顯示時間
- ✅ Final 清理時移除年齡 > 5 秒的 interim
- ✅ 使用 FIFO (`shift()`) 確保清理順序

### 2025-11-21
- ✅ 恢復 Interim 顯示功能
- ✅ 調整心跳檢測參數（5 秒超時）

---

## 🔗 相關文件

- **主程式**: `extension/content/content.js`
- **開發日誌**: `DEVLOG.md`
- **AI 助手指南**: `CLAUDE.md`

---

**最後更新**: 2025-11-22
**維護者**: Claude (AI Assistant)
