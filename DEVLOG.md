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
const HEARTBEAT_TIMEOUT = 3000;  // 3秒無結果就重啟
```

**調整歷史：**
- v1：5秒檢測一次，10秒超時
- v2：2秒檢測一次，5秒超時
- v3（當前）：**1秒檢測一次，3秒超時**
- 用戶反饋：**問題仍然存在，持續測試中**

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

## 待辦事項

- [ ] 深入調查字幕卡住的根本原因
- [ ] 考慮添加更詳細的除錯日誌
- [ ] 研究 Chrome 和 Edge 的 Speech Recognition 行為差異
- [ ] 測試在不同網站和環境下的穩定性

---

*最後更新: 2025-11-21*
