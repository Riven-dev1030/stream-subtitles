# 開發日誌 (Development Log)

本文件記錄開發過程中發現的問題、解決方案和重要決策。

---

## 2025-11-21 - 字幕凍結和重複問題修復

### 🐛 問題描述

用戶報告了以下核心問題：

1. **字幕重複顯示問題**
   - 症狀：相同的字幕內容會重複出現在螢幕上
   - 原因：Web Speech API 有時會以累積方式發送 final 結果

2. **舊內容殘留問題**
   - 症狀：舊字幕在螢幕上停留過久，不會自動清除
   - 原因：清理機制設定太寬鬆（`MAX_CHARS_PER_LINE = 50` 太大）

3. **字幕生成卡住問題** ⚠️ **尚未完全解決**
   - 症狀：字幕會突然停止更新，但中止再開始後又能正常運作
   - 可能原因：Web Speech API 停止觸發事件，但 recognition 物件狀態未改變

### 🔧 已實施的修復方案

#### 1. 縮短每行字符限制
```javascript
const MAX_CHARS_PER_LINE = 15;  // 從 50 改為 15
const MAX_TOTAL_CHARS = 50;     // 新增：總字符數限制
```
- 按照用戶建議：一行15字 × 3行 = 50字就清理

#### 2. 改進重複檢測邏輯
```javascript
// 檢測累積文本
if (normalized.includes(lastFinalTranscript) || lastFinalTranscript.includes(normalized)) {
  // 只處理新增的部分
  if (normalized.length <= lastFinalTranscript.length) {
    return; // 跳過重複
  }
  const newPart = normalized.replace(lastFinalTranscript, '').trim();
  // 處理新增部分...
}
```
- 智能檢測文本包含關係
- 過濾重複和累積發送的內容

#### 3. 雙重 Buffer 清理策略
```javascript
// 1. 按句子數清理
while (displayBuffer.length > MAX_DISPLAY_SENTENCES) {
  displayBuffer.shift();
}

// 2. 按總字符數清理
let totalChars = displayBuffer.reduce((sum, item) => sum + item.text.length, 0);
while (totalChars > MAX_TOTAL_CHARS && displayBuffer.length > 1) {
  const removed = displayBuffer.shift();
  totalChars -= removed.text.length;
}
```

#### 4. 心跳檢測機制（持續調整中）
```javascript
const HEARTBEAT_INTERVAL = 1000; // 1秒檢測一次
const HEARTBEAT_TIMEOUT = 5000;  // 5秒無結果就重啟
```

**調整歷史：**
- v1：5秒檢測一次，10秒超時
- v2：2秒檢測一次，5秒超時
- v3：1秒檢測一次，3秒超時
- v4（當前）：**1秒檢測一次，5秒超時**
  - 移除 interim 顯示後，3秒可能誤判自然停頓
  - 調整到 5秒平衡檢測速度和誤判風險

### ⚠️ 當前狀態

**字幕卡住問題尚未完全解決**

儘管已經實施了心跳檢測機制並提高了檢測頻率，用戶反饋問題依然存在。

**可能的原因：**
1. Web Speech API 的 `onend` 事件可能未正確觸發
2. 心跳檢測的超時時間可能仍不夠激進
3. 可能需要更主動的重啟策略
4. 瀏覽器的 Speech Recognition 實作可能有 bug

**待嘗試的解決方案：**
- [ ] 進一步縮短超時時間（例如：1秒檢測，3秒超時）
- [ ] 在 `onend` 事件中添加額外的日誌，追蹤重啟行為
- [ ] 考慮定期強制重啟（例如每 30 秒）
- [ ] 研究 Web Speech API 的已知問題和限制
- [ ] 考慮替代方案（WebSocket + 服務器端 STT）

### 📝 相關文件

- 修復提交: `83d4054` - 解決字幕凍結、重複和累積問題
- 優化提交: `250f296` - 大幅提高心跳檢測頻率
- 實作文件: `extension/content/content.js:726-762` (心跳檢測函數)

---

### 🔄 2025-11-21 下午 - 修復混亂的清除邏輯

#### 新發現的問題

用戶反映：**字幕清除順序混亂**
- 症狀：字幕跑了4行，清除的不是第1行（最舊），而是第2、4行
- 影響：用戶還沒看清字幕就被移除了

#### 根本原因分析

1. **濫用 filter() 移除 interim**
```javascript
// 錯誤的做法（舊代碼）
displayBuffer = displayBuffer.filter(item => item.source === 'final');
// 這會移除所有 interim，無論位置在哪！
```

2. **過度激進的重疊檢測**
```javascript
// 太寬鬆（舊代碼）
if (existing.includes(sentence) || sentence.includes(existing)) {
  // "Hello world" 會包含 "Hello"，但它們可能是不同的句子
}
```

3. **缺少最小顯示時間**
- 字幕可能剛出現就被移除
- 用戶根本來不及閱讀

#### 修復方案

1. **改進 interim 清理** (extension/content/content.js:393-413)
   - 只清理超過 5 秒的舊 interim
   - 保留最近的 interim 讓用戶看到

2. **優化重疊檢測** (extension/content/content.js:429-440)
   - 只有當長度差距 ≤ 3 字時才認為重疊
   - 減少誤判

3. **添加最小顯示時間** (extension/content/content.js:466-500)
   - 每個句子至少顯示 **3 秒**
   - 即使超限，也要等顯示夠久才清除

4. **確保 FIFO 順序**
   - 永遠使用 `shift()` 移除最舊的（第一個）
   - 清理順序可預測

---

### 🎯 2025-11-21 傍晚 - 移除 Interim 顯示，大幅簡化邏輯

#### 用戶洞察

用戶提出關鍵問題：**「還是不要顯示臨時句子，這會增加多少延遲？」**

分析發現：
- Interim（臨時）延遲：~0 秒，但不斷變化、不準確
- Final（最終）延遲：~1-2 秒，但準確穩定
- **結論：1-2 秒延遲對字幕來說完全可接受**

#### 重構決策

**完全移除 interim 顯示，只保留 final 結果**

**刪除的代碼：**
- 所有 interim 處理邏輯（~100 行）
- source 標記（'final' vs 'interim'）
- interim 清理邏輯
- 臨時字幕相關變數

**簡化後的邏輯：**
```javascript
function displaySubtitle(text, isFinal) {
  if (!isFinal) {
    return; // 直接跳過所有 interim
  }
  // 只處理 final 結果...
}
```

**displayBuffer 簡化為：**
```javascript
{
  text: "字幕內容",
  timestamp: 時間戳
  // 不再需要 source 欄位
}
```

#### 優點

1. **代碼量減少**: 210 行 → 113 行（減少約 46%）
2. **邏輯清晰**: 不再有 final/interim 混合處理
3. **沒有閃爍**: 字幕不會不斷變化
4. **減少 bug**: 移除了大量潛在錯誤來源
5. **更易維護**: 單一路徑，更容易理解

#### 權衡

- **延遲增加**: 約 1-2 秒
- **用戶體驗**: 對字幕來說可接受（觀眾習慣字幕延遲）

#### ⚠️ 實際測試結果

**用戶反饋：延遲太久！**
- 預期延遲：1-2 秒
- 實際延遲：遠超過預期（可能 5-10 秒）
- 影響：嚴重影響使用體驗

**決定：回退此更改**
- 恢復 interim 顯示功能（commit 2b3e25a）
- 保留所有其他改進（清理邏輯、心跳檢測等）
- 結論：**即時反饋比準確性更重要**

---

### 🔧 2025-11-21 深夜 - 為 Interim 添加完整清理邏輯

#### 用戶關鍵發現

通過 Console 日誌分析，用戶發現：

**只顯示 Final 時：**
- ✅ 延遲正常
- ✅ 清理邏輯正常運作
- ❌ 但延遲太高（5-10秒）

**加入 Interim 後：**
- ✅ 延遲低（即時）
- ❌ 所有問題回來了：累積、不清除、超長句子
- **根本原因：全部都是 Interim，沒有 Final！**

#### Console 日誌證據

```
[Content] Interim 過長 ( 32 字)，自動斷句
[Content] ⭕ 心跳檢測：距離上次結果 0 秒
```

沒有看到 `[Content] === Final 結果 ===` 或 `[Content] Buffer 清理前`

**結論：Final 的清理邏輯從未被觸發！**

#### 修復方案

**為 Interim 添加完整的清理邏輯：**

1. **新增 Interim 專屬最小顯示時間** (extension/content/content.js:19)
```javascript
const MIN_DISPLAY_TIME = 3000;        // Final: 3秒
const MIN_INTERIM_DISPLAY_TIME = 2000; // Interim: 2秒（更快清除）
```

2. **Interim 斷句時的完整清理** (extension/content/content.js:546-581)
   - 按句子數清理（帶最小顯示時間保護）
   - 按總字符數清理（帶最小顯示時間保護）
   - 自動判斷 final/interim 使用不同的最小顯示時間
   - 詳細的調試日誌

3. **清理邏輯觸發時機**
   - **Final 處理時**：清理過舊的 interim + 按限制清理 final
   - **Interim 斷句時**：立即按限制清理（現在有保護機制）

#### 預期效果

- ✅ Interim 即時顯示（低延遲）
- ✅ 不會無限累積（有清理機制）
- ✅ 用戶有足夠時間閱讀（最小顯示 2 秒）
- ✅ Final/Interim 混合時清理邏輯正確

---

## 2025-11-22 - 定時清理機制 + 字數額度共享

### 🐛 發現的新問題

#### 問題 1：Interim 快速累積導致 Buffer 爆滿

**症狀**：
- Console 顯示 `Buffer 最終狀態: 10 項`（應該最多 3 項）
- Interim 每 0.1 秒就加入一個新項目到 Buffer
- 內容快速累積，無法控制

**日誌證據**：
```
Interim 過長 ( 72 字)，自動斷句
Interim 過長 ( 73 字)，自動斷句
Interim 過長 ( 74 字)，自動斷句
...
Buffer 最終狀態: 10 項  ← 異常！
```

**根本原因**：
1. Interim 每次都會變化（72→73→74 字），內容不斷累積
2. 去重檢查只有「完全匹配」，無法防止相似句子
3. Interim 每 0.1 秒觸發，但需要 2 秒才能清理 → 累積速度 > 清理速度

---

#### 問題 2：清理邏輯只在 Final 時觸發

**症狀**：
- 句子顯示了 32 秒才被清理（應該 3 秒）
- Buffer 累積到 10 項才開始清理

**日誌證據**：
```
移除舊句子（已顯示 32 秒）× 5 次
❌ 最舊句子還不能移除（僅顯示 0 秒）
Buffer 最終狀態: 10 項
```

**根本原因**：
- 清理邏輯寫在 `if (isFinal)` 區塊內
- 如果長時間沒有 Final 結果 → 不清理
- 句子可能累積 30+ 秒才被清理

**時間軸分析**：
```
0秒  → Final 結果，加入 3 句
5秒  → Interim...（無 Final，不清理）
10秒 → Interim...（無 Final，不清理）
15秒 → Interim...（無 Final，不清理）
...
32秒 → Final 結果 → 才發現 Buffer 有 10 項！
```

---

### 🔧 解決方案

#### 方案 1：Interim 完全不加入 Buffer（重構）

**設計理念**：
- Buffer = Final 專用（最準確的內容）
- Interim = 臨時預覽（不污染 Buffer）

**實現** (commit: c9fb4ac):
```javascript
// 移除 75 行複雜的 Interim 斷句和清理邏輯
// 新增 4 行簡潔邏輯
else { // isFinal === false
  console.log('[Content] Interim 結果');

  // 直接顯示在臨時區域，不加入 displayBuffer
  interimSubtitle = text;
  lastTranscript = text;
  updateSubtitleDisplay(text);
}
```

**效果**：
- ✅ Interim 不再累積到 Buffer
- ✅ 邏輯更清晰（Buffer 只有 Final）
- ✅ 避免 Interim 快速累積問題

---

#### 方案 2：定時清理器（核心改進）

**問題分析**：
- 舊機制：只在 Final 時清理 → 可能 30+ 秒才清理
- 新機制：每 1 秒自動檢查 → 最多 2.5 秒就清理

**實現** (commit: d364624):

1. **創建獨立的清理函數** (content.js:350-392)
```javascript
function cleanupBuffer() {
  if (displayBuffer.length === 0) return;

  const currentTime = Date.now();
  let cleaned = false;

  // 1. 按句子數清理
  while (displayBuffer.length > MAX_DISPLAY_SENTENCES) {
    const oldest = displayBuffer[0];
    const displayDuration = currentTime - oldest.timestamp;

    if (displayDuration >= MIN_DISPLAY_TIME) { // 1500ms
      displayBuffer.shift();
      cleaned = true;
    } else {
      break; // 顯示時間不夠，暫停清理
    }
  }

  // 2. 按總字符數清理
  let totalChars = displayBuffer.reduce((sum, item) => sum + item.text.length, 0);
  while (totalChars > MAX_TOTAL_CHARS && displayBuffer.length > 1) {
    const oldest = displayBuffer[0];
    const displayDuration = currentTime - oldest.timestamp;

    if (displayDuration >= MIN_DISPLAY_TIME) {
      displayBuffer.shift();
      totalChars -= removed.text.length;
      cleaned = true;
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

2. **啟動定時清理器** (content.js:102-105)
```javascript
// 在 init() 函數中
setInterval(() => {
  cleanupBuffer();
}, 1000);
console.log('[Content] ✅ 定時清理器已啟動（每 1 秒檢查一次）');
```

3. **Final 處理時調用清理**
```javascript
// Final 處理邏輯簡化
cleanupBuffer(); // 調用統一的清理函數
```

**效果**：
- ✅ 句子最多顯示 1.5 秒 + 1 秒延遲 = **2.5 秒**
- ✅ Buffer 不會累積超過 3-4 項
- ✅ 不依賴 Final 結果，完全獨立運作

---

#### 方案 3：Final + Interim 共享 50 字額度（優化）

**設計目標**：
- 總字數嚴格控制在 50 字以內
- 版面更乾淨、更穩定
- 動態分配 Interim 可用額度

**實現** (commit: e092cac):

```javascript
// Interim 處理邏輯
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

  // 5. 直接顯示在臨時區域
  interimSubtitle = displayText;
  updateSubtitleDisplay(displayText);
}
```

**動態分配示例**：

| Buffer 字數 | 剩餘額度 | Interim 可顯示 | 總字數 |
|-----------|---------|--------------|-------|
| 10 字 | 40 字 | 35 字 | 45 字 |
| 20 字 | 30 字 | 30 字 | 50 字 |
| 40 字 | 10 字 | 10 字 | 50 字 |
| 50 字 | 0 字 | 0 字 | 50 字 |

**效果**：
- ✅ 總字數嚴格 ≤ 50 字
- ✅ Buffer 多時 Interim 少，Buffer 少時 Interim 多
- ✅ 版面乾淨、穩定

---

### 📊 參數調整

```javascript
// 時間參數
const MIN_DISPLAY_TIME = 1500;        // 3秒 → 1.5秒
const HEARTBEAT_TIMEOUT = 3000;       // 5秒 → 3秒

// 字數限制
const MAX_TOTAL_CHARS = 50;           // Final + Interim 共享
const MAX_INTERIM_DISPLAY_CHARS = 35; // Interim 最多 35 字
```

---

### ✅ 改進效果對比

| 項目 | 舊版本（v1-v2） | 新版本 v3 |
|-----|--------------|----------|
| **句子顯示時間** | 可能 30+ 秒 | 最多 2.5 秒 |
| **Buffer 累積** | 可能 10+ 項 | 最多 3-4 項 |
| **總字數控制** | 無限制 | 嚴格 ≤ 50 字 |
| **Interim 處理** | 加入 Buffer，累積 | 臨時顯示，不累積 |
| **清理機制** | 只在 Final 時 | 每 1 秒自動清理 |
| **清理依賴性** | 依賴 Final 結果 | 完全獨立 |
| **版面穩定性** | 混亂、不穩定 | 乾淨、穩定 |

---

### 📝 相關文檔

- **詳細邏輯說明**: `docs/SUBTITLE_PROCESSING_LOGIC.md` (v3)
- **Commits**:
  - `c9fb4ac`: Interim 不再加入 Buffer
  - `d364624`: 加入定時清理器
  - `e092cac`: Final + Interim 共享額度
  - `355a336`: 更新文檔至 v3

---

## 待辦事項

- [ ] 深入調查字幕卡住的根本原因
- [ ] 考慮添加更詳細的除錯日誌
- [ ] 研究 Chrome 和 Edge 的 Speech Recognition 行為差異
- [ ] 測試在不同網站和環境下的穩定性
- [x] 修復混亂的清除邏輯
- [x] 確保字幕至少顯示 3 秒（已調整為 1.5 秒）
- [x] 移除 interim 顯示，簡化邏輯
- [x] 解決 Buffer 累積過多問題（定時清理器）
- [x] 解決句子顯示時間過長問題（30+ 秒 → 2.5 秒）
- [x] 實現 Final + Interim 字數額度共享（總字數 ≤ 50）
- [x] 優化 Interim 處理邏輯（不加入 Buffer）

---

*最後更新: 2025-11-22*
