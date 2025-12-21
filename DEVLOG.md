# 開發日誌 (Development Log)

本文件記錄開發過程中發現的問題、解決方案和重要決策。

---

## 2025-12-05 - Deepgram MVP 穩定性修復（Phase 2 完成）

### 🎯 Phase 2 目標達成

完成 Deepgram 雙引擎整合並修復所有關鍵 bug，系統達到生產就緒狀態。

---

### 🐛 問題 1: chrome.tabCapture API 棄用警告

**症狀**:
- Console 顯示 `TypeError: chrome.tabCapture.capture is not a function`
- Deepgram 無法啟動音訊捕獲

**根本原因**:
- `chrome.tabCapture.capture()` 在 Manifest V3 中已棄用
- 需要使用新的 `chrome.tabCapture.getMediaStreamId()` + Offscreen Document 架構

**解決方案** (Commit: `8a29859`):
1. 創建 Offscreen Document (`extension/offscreen/offscreen.html`, `offscreen.js`)
2. 修改 `manifest.json` 添加 `offscreen` 權限
3. Service Worker 使用 `chrome.tabCapture.getMediaStreamId()` 獲取 streamId
4. Offscreen Document 使用 `getUserMedia({ chromeMediaSource: 'tab' })` 捕獲音訊

---

### 🐛 問題 2: 音訊捕獲導致影片靜音

**症狀**:
- 啟動 Deepgram 後，影片聲音消失
- 音訊被捕獲但沒有播放給用戶

**根本原因**:
- MediaStream 被捕獲用於語音辨識，但沒有連接到播放設備

**解決方案** (Commit: `0c66db0`):
```html
<!-- offscreen.html -->
<audio id="audio-playback" autoplay></audio>
```

```javascript
// offscreen.js
audioElement = document.getElementById('audio-playback');
audioElement.srcObject = mediaStream;
audioElement.volume = 1.0;
```

---

### 🐛 問題 3: ScriptProcessorNode 已棄用警告 + 性能問題

**症狀**:
- Console 警告: `The ScriptProcessorNode is deprecated. Use AudioWorkletNode instead.`
- 啟動時瀏覽器和頁面卡頓數秒

**根本原因**:
- ScriptProcessorNode 在主線程運行，阻塞 UI
- 已被 AudioWorkletNode 取代（運行在獨立音訊線程）

**解決方案** (Commit: `195a74f`):
1. 創建 `extension/offscreen/audio-processor.js` (AudioWorklet 處理器)
2. 使用 Transferable Objects 傳輸音訊數據，提升性能
3. 音訊處理完全在獨立線程，不再阻塞主線程

**性能對比**:
| 項目 | ScriptProcessorNode | AudioWorkletNode |
|-----|-------------------|------------------|
| 運行線程 | 主線程（阻塞 UI） | 音訊線程（獨立） |
| 啟動卡頓 | 明顯卡頓 2-3 秒 | 流暢無卡頓 |
| 數據傳輸 | 普通陣列 | Transferable Objects |

---

### 🐛 問題 4: 停止按鈕無法停止 Deepgram

**症狀**:
- 小介面停止按鈕點擊後，字幕繼續顯示
- 頁面刷新後，Deepgram 仍在背景運行

**根本原因**:
1. **停止按鈕問題**: Content Script 的 `stopRecording()` 只停止 Web Speech API，沒有通知 Service Worker 停止 Deepgram
2. **頁面刷新問題**: Tab 更新監聽器條件錯誤（`changeInfo.url` 在刷新時不存在）

**解決方案** (Commit: `3e4621c`):

**1. 停止按鈕修復**:
```javascript
// content.js
function stopRecording() {
  // 檢測是否使用 Deepgram（isRecording 為 true 但沒有 recognition 對象）
  const isUsingDeepgram = isRecording && !recognition;

  if (isUsingDeepgram) {
    chrome.runtime.sendMessage({ action: 'stopDeepgramRecognition' });
  }

  if (recognition) {
    recognition.stop();
  }
}
```

**2. 頁面刷新修復**:
```javascript
// service-worker.js
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 修改前: if (changeInfo.status === 'loading' && changeInfo.url)
  // 修改後: 移除 changeInfo.url 條件
  if (changeInfo.status === 'loading') {
    if (isDeepgramActive && tabId === currentTabId) {
      // 自動清理 Deepgram 資源
    }
  }
});
```

---

### 🐛 問題 5: 停止後重新啟動導致頁面當掉

**症狀**:
- 停止 Deepgram 後立即重新啟動，頁面完全卡死
- 需要刷新頁面才能恢復

**根本原因**: **競態條件（Race Condition）**
```
停止流程（異步）        啟動流程（開始太早）
     ↓                      ↓
WebSocket 關閉中      創建新 WebSocket ❌ 衝突
     ↓                      ↓
Offscreen 關閉中      創建新 Offscreen ❌ 衝突
     ↓                      ↓
AudioContext 關閉中   創建新 AudioContext ❌ 衝突
     ↓
資源完全釋放（太晚了！）
```

**解決方案** (Commit: `9f6b47e`):

**1. 啟動前等待資源完全釋放**:
```javascript
// service-worker.js
async function handleStartDeepgramRecognition(tabId, language) {
  if (isDeepgramActive) {
    await handleStopDeepgramRecognition(() => {});

    // 等待 500ms 確保所有資源完全釋放
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // 開始創建新資源...
}
```

**2. WebSocket 立即關閉（移除延遲）**:
```javascript
// deepgram-client.js
disconnect() {
  // 修改前: setTimeout(() => { this.ws.close(); }, 100);
  // 修改後: 立即關閉
  this.ws.close();
  this.ws = null;
}
```

**3. Offscreen Document 強制重新創建**:
```javascript
// service-worker.js
async function createOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });

  if (existingContexts.length > 0) {
    // 先關閉舊的，再創建新的
    await closeOffscreenDocument();
  }

  // 創建新的...
}
```

**4. 總是創建全新的 DeepgramClient**:
```javascript
// service-worker.js
if (deepgramClient) {
  deepgramClient.disconnect();  // 先清理舊的
}

deepgramClient = new DeepgramClient(apiKey, { language });  // 創建新的
```

---

### 🐛 問題 6: UI 狀態不同步

**症狀**:
- 主介面（Popup）顯示"未啟動"，但小介面（Content UI）顯示"錄音中"
- 反之亦然
- 停止按鈕有時無法點擊

**根本原因**:
1. **缺少啟動通知**: Service Worker 啟動 Deepgram 後，沒有通知 Content Script
2. **狀態來源錯誤**: `getStatus` 根據運行狀態判斷引擎，而非用戶選擇

**解決方案**:

**1. 添加啟動/停止通知** (Commit: `2e5cc52`):
```javascript
// service-worker.js - 啟動成功後
chrome.tabs.sendMessage(tabId, { action: 'deepgramStarted' });

// 停止後
chrome.tabs.sendMessage(tabId, { action: 'deepgramStopped' });

// content.js - 處理通知
case 'deepgramStarted':
  isRecording = true;
  updateControlPanel();  // 更新小介面
  showSubtitleUI();
  break;

case 'deepgramStopped':
  isRecording = false;
  updateControlPanel();
  hideSubtitleUI();
  break;
```

**2. 修復引擎狀態判斷** (Commit: `9d0be30`):
```javascript
// service-worker.js
case 'getStatus':
  chrome.storage.sync.get(['recognitionEngine'], (result) => {
    const selectedEngine = result.recognitionEngine || 'webspeech';
    sendResponse({
      isRecording: isDeepgramActive,
      currentEngine: selectedEngine  // 使用用戶選擇，不是運行狀態
    });
  });
```

---

### 📊 詳細日誌系統

為了便於診斷問題，添加了詳細的清理日誌：

```javascript
// service-worker.js
console.log('[Background] 🧹 開始清理 Deepgram 資源...');
console.log('[Background] 📡 關閉 Deepgram WebSocket 連接...');
console.log('[Background] ✅ Deepgram WebSocket 已關閉');
console.log('[Background] 🎤 通知 Offscreen Document 停止音訊捕獲...');

// offscreen.js
console.log('[Offscreen] 🛑 停止音訊捕獲...');
console.log('[Offscreen] 🎛️ 停止 AudioWorklet 節點...');
console.log('[Offscreen] 📹 停止 MediaStream 軌道...');
console.log('[Offscreen]   - 停止軌道: audio (tab)');
console.log('[Offscreen] ✅ 音訊捕獲完全停止');
```

---

### ✅ Phase 2 完成狀態

**已修復的關鍵 Bug**:
- ✅ chrome.tabCapture API 遷移至 Manifest V3
- ✅ 音訊捕獲時影片靜音
- ✅ ScriptProcessorNode 棄用警告 + 性能卡頓
- ✅ 停止按鈕無法停止 Deepgram
- ✅ 頁面刷新後 Deepgram 繼續運行
- ✅ 停止後重新啟動導致頁面當掉
- ✅ 主介面與小介面狀態不同步
- ✅ 引擎選擇不生效

**Deepgram MVP 功能清單**:
- ✅ 雙引擎架構（Web Speech API + Deepgram）
- ✅ API Key 加密儲存（AES-GCM-256）
- ✅ Offscreen Document 音訊捕獲
- ✅ AudioWorklet 音訊處理（無卡頓）
- ✅ Tab 生命週期管理（自動清理）
- ✅ 狀態同步機制
- ✅ 詳細日誌系統

**相關 Commits** (按時間順序):
1. `8a29859` - 初始 Deepgram MVP
2. `0c66db0` - 修復音訊播放
3. `bb69517` - 修復 WebSocket 連接
4. `8199267` - 修復 Content Script 連接
5. `62fce37` - 修復 UI 狀態同步
6. `d127db3` - 移除重複事件監聽器
7. `9d0be30` - 修復引擎選擇
8. `195a74f` - AudioWorkletNode 遷移
9. `a8bf2ed` - Tab 生命週期管理
10. `2e5cc52` - UI 狀態同步改進
11. `3e4621c` - 修復停止功能
12. `9f6b47e` - 修復競態條件（Phase 2 完成）

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
const HEARTBEAT_TIMEOUT = 6000;  // 6秒無結果就重啟
```

**調整歷史：**
- v1：5秒檢測一次，10秒超時
- v2：2秒檢測一次，5秒超時
- v3：1秒檢測一次，3秒超時
- v4：1秒檢測一次，5秒超時（移除 interim 顯示後）
- v5（當前）：**1秒檢測一次，6秒超時**
  - 用戶測試發現移除廣告攔截器後，每 50 秒仍會重啟
  - 3 秒超時太激進，可能誤判 Web Speech API 的正常處理延遲
  - 調整到 6 秒給予 API 更多緩衝空間，減少不必要的重啟

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
- [x] 考慮替代方案（WebSocket + 服務器端 STT）→ 已完成 Deepgram 整合

### 📝 相關文件

- 修復提交: `83d4054` - 解決字幕凍結、重複和累積問題
- 優化提交: `250f296` - 大幅提高心跳檢測頻率
- 實作文件: `extension/content/content.js:726-762` (心跳檢測函數)

---

## 待辦事項

### Deepgram MVP (Phase 2) ✅ 已完成
- [x] chrome.tabCapture API 遷移
- [x] Offscreen Document 架構
- [x] AudioWorkletNode 遷移
- [x] Tab 生命週期管理
- [x] 狀態同步機制
- [x] 停止功能修復
- [x] 競態條件修復

### Web Speech API 優化
- [ ] 深入調查字幕卡住的根本原因
- [ ] 考慮添加更詳細的除錯日誌
- [ ] 研究 Chrome 和 Edge 的 Speech Recognition 行為差異
- [ ] 測試在不同網站和環境下的穩定性

### 已完成的優化
- [x] 修復混亂的清除邏輯
- [x] 確保字幕至少顯示 3 秒（已調整為 1.5 秒）
- [x] 解決 Buffer 累積過多問題（定時清理器）
- [x] 解決句子顯示時間過長問題（30+ 秒 → 2.5 秒）
- [x] 實現 Final + Interim 字數額度共享（總字數 ≤ 50）
- [x] 優化 Interim 處理邏輯（不加入 Buffer）

---

*最後更新: 2025-12-05*
