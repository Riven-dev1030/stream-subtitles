# Deepgram MVP 整合計劃

**版本**: MVP v0.1
**日期**: 2025-12-04
**目標**: 快速驗證 Deepgram 是否能解決精度問題

---

## 🎯 MVP 目標

**核心問題**: Web Speech API 精度不足
**驗證目標**: Deepgram 是否能提供更好的辨識精度和穩定性
**時間框架**: 1-2 天完成可測試版本

---

## 📋 MVP 範圍

### ✅ 包含功能（最小必要）

1. **Deepgram API 整合**
   - WebSocket 即時連接
   - 基本音訊串流
   - 接收辨識結果

2. **UI 設定**
   - API Key 輸入框（在 Popup）
   - 簡單的啟動/停止按鈕
   - 狀態顯示

3. **字幕顯示**
   - 直接使用現有的 Content Script
   - 將 Deepgram 結果轉換為統一格式

4. **基本錯誤處理**
   - 連線失敗提示
   - API Key 驗證

### ❌ 暫不包含（Phase 2）

- 引擎切換 UI（先硬編碼測試）
- 複雜的抽象層設計
- 進階設定選項（語言、模型等）
- 心跳檢測（Deepgram 較穩定）
- 完整的錯誤恢復機制
- 使用統計

---

## 🏗️ 技術架構（MVP）

### 整體架構

```
┌─────────────┐
│   Popup UI  │ ← 使用者輸入 API Key
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Service   │ ← 管理 WebSocket 連接
│   Worker    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Deepgram   │ ← WebSocket 串流
│  WebSocket  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Content   │ ← 顯示字幕（重用現有代碼）
│   Script    │
└─────────────┘
```

### 簡化決策

1. **不使用 Offscreen Document**
   - Deepgram 使用 WebSocket，不需要捕獲音訊
   - 直接在 Service Worker 處理 WebSocket

2. **保留現有字幕顯示邏輯**
   - Interim 主導架構仍然適用
   - 只需要格式轉換

3. **最小化配置**
   - 只要求 API Key
   - 其他參數使用預設值

---

## 📝 實作步驟

### Step 1: Deepgram WebSocket 整合（核心）

**檔案**: `extension/background/deepgram-client.js`（新建）

```javascript
class DeepgramClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.ws = null;
    this.isConnected = false;
  }

  async connect(config = {}) {
    const url = `wss://api.deepgram.com/v1/listen?` +
                `encoding=linear16&` +
                `sample_rate=16000&` +
                `language=zh-TW&` +
                `punctuate=true&` +
                `interim_results=true`;

    this.ws = new WebSocket(url, ['token', this.apiKey]);

    this.ws.onopen = () => this.handleOpen();
    this.ws.onmessage = (msg) => this.handleMessage(msg);
    this.ws.onerror = (err) => this.handleError(err);
    this.ws.onclose = () => this.handleClose();
  }

  handleMessage(event) {
    const data = JSON.parse(event.data);

    // 轉換為統一格式
    if (data.channel) {
      const transcript = data.channel.alternatives[0].transcript;
      const isFinal = data.is_final;

      // 發送到 Content Script
      this.onResult({ text: transcript, isFinal });
    }
  }

  sendAudio(audioData) {
    if (this.ws && this.isConnected) {
      this.ws.send(audioData);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}
```

### Step 2: 修改 Popup UI

**檔案**: `extension/popup/popup.html`

添加 API Key 輸入：

```html
<div class="api-key-section">
  <label for="deepgram-api-key">Deepgram API Key:</label>
  <input type="password" id="deepgram-api-key" placeholder="輸入 API Key">
  <button id="save-api-key">儲存</button>
</div>
```

**檔案**: `extension/popup/popup.js`

添加 API Key 儲存邏輯：

```javascript
document.getElementById('save-api-key').addEventListener('click', async () => {
  const apiKey = document.getElementById('deepgram-api-key').value;
  await chrome.storage.local.set({ deepgramApiKey: apiKey });
  alert('API Key 已儲存');
});
```

### Step 3: Service Worker 整合

**檔案**: `extension/background/service-worker.js`

```javascript
import DeepgramClient from './deepgram-client.js';

let deepgramClient = null;
let mediaRecorder = null;

// 啟動 Deepgram
async function startDeepgram(tabId) {
  // 取得 API Key
  const { deepgramApiKey } = await chrome.storage.local.get('deepgramApiKey');

  if (!deepgramApiKey) {
    throw new Error('請先設定 Deepgram API Key');
  }

  // 建立客戶端
  deepgramClient = new DeepgramClient(deepgramApiKey);

  // 設定結果處理
  deepgramClient.onResult = (result) => {
    // 發送到 Content Script
    chrome.tabs.sendMessage(tabId, {
      type: 'subtitle_update',
      data: result
    });
  };

  // 連接 Deepgram
  await deepgramClient.connect();

  // 捕獲音訊
  await startAudioCapture(tabId);
}

async function startAudioCapture(tabId) {
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    }
  });

  // 使用 MediaRecorder 捕獲音訊
  mediaRecorder = new MediaRecorder(stream, {
    mimeType: 'audio/webm;codecs=opus'
  });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0 && deepgramClient) {
      // 轉換並發送到 Deepgram
      event.data.arrayBuffer().then(buffer => {
        deepgramClient.sendAudio(buffer);
      });
    }
  };

  mediaRecorder.start(100); // 每 100ms 發送一次
}
```

### Step 4: 格式轉換

Deepgram 結果格式：
```json
{
  "channel": {
    "alternatives": [{
      "transcript": "字幕內容",
      "confidence": 0.95
    }]
  },
  "is_final": true,
  "speech_final": true
}
```

轉換為統一格式：
```javascript
{
  text: "字幕內容",
  isFinal: true,
  timestamp: Date.now()
}
```

Content Script 無需修改，因為它已經接收這個格式。

---

## ⚡ 快速測試計劃

### 測試場景

1. **基本功能測試**
   ```
   1. 載入 Extension
   2. 輸入 Deepgram API Key
   3. 開啟 YouTube 影片
   4. 點擊啟動
   5. 觀察字幕是否顯示
   ```

2. **精度對比**
   ```
   使用相同影片測試：
   - Web Speech API 辨識結果
   - Deepgram 辨識結果

   對比指標：
   - 準確度（錯字率）
   - 延遲時間
   - 穩定性（是否卡住）
   ```

3. **錯誤處理**
   ```
   - 不輸入 API Key 啟動
   - 輸入錯誤的 API Key
   - 網路斷線
   ```

---

## 🚧 已知限制（MVP）

1. **音訊格式**
   - MediaRecorder 輸出的格式可能需要轉換
   - 可能需要使用 Web Audio API 進行處理

2. **無心跳檢測**
   - MVP 假設 Deepgram 連線穩定
   - 如有問題，Phase 2 添加

3. **單引擎模式**
   - MVP 只測試 Deepgram
   - 不做引擎切換（硬編碼）

4. **最小化 UI**
   - 只有最基本的設定
   - 無進階選項

---

## 📊 成功標準

MVP 被認為成功，如果：

- ✅ Deepgram 可以正常連接
- ✅ 字幕可以正常顯示
- ✅ 精度明顯優於 Web Speech API
- ✅ 延遲可接受（< 1 秒）
- ✅ 連線穩定（不會頻繁斷線）

如果以上都滿足 → 進入 Phase 2（雙引擎架構）

---

## 🔄 Phase 2 規劃（如 MVP 成功）

1. **引擎抽象層**
   ```javascript
   interface SpeechEngine {
     start()
     stop()
     onResult(callback)
   }
   ```

2. **引擎切換 UI**
   - Radio buttons: Web Speech API / Deepgram
   - 儲存使用者偏好

3. **進階設定**
   - 語言選擇
   - Deepgram 模型選擇
   - 標點符號開關

4. **使用統計**
   - 計算 Deepgram 使用時間
   - 提醒用戶剩餘額度

---

## 💡 開發注意事項

### Deepgram API 配置

**推薦設定**（繁體中文）:
```
language: zh-TW
punctuate: true
interim_results: true
encoding: linear16
sample_rate: 16000
```

### API Key 管理

```javascript
// 儲存（加密？）
chrome.storage.local.set({ deepgramApiKey: apiKey });

// 讀取
const { deepgramApiKey } = await chrome.storage.local.get('deepgramApiKey');

// 驗證（測試連接）
async function validateApiKey(apiKey) {
  try {
    const ws = new WebSocket(url, ['token', apiKey]);
    // ... 測試連接
    return true;
  } catch (err) {
    return false;
  }
}
```

### 錯誤處理

```javascript
// API Key 錯誤
if (error.code === 401) {
  alert('API Key 無效，請檢查');
}

// 網路錯誤
if (error.type === 'network') {
  alert('網路連線失敗');
}

// 超過額度
if (error.code === 429) {
  alert('Deepgram 額度已用完');
}
```

---

## 📚 參考資料

### Deepgram 文檔
- [Streaming API](https://developers.deepgram.com/docs/streaming)
- [語言支援](https://developers.deepgram.com/docs/languages)
- [WebSocket 範例](https://github.com/deepgram/deepgram-js-sdk)

### 現有代碼
- `extension/content/content.js` - 字幕顯示邏輯（重用）
- `docs/SUBTITLE_PROCESSING_LOGIC.md` - Interim 主導架構說明

---

## ✅ 下一步行動

1. **立即開始**：實作 `deepgram-client.js`
2. **接著**：修改 Popup UI 添加 API Key 輸入
3. **然後**：整合到 Service Worker
4. **最後**：本地測試

**預計完成時間**: 今天晚上或明天

---

**文檔版本**: MVP v0.1
**最後更新**: 2025-12-04
