# 🎬 Stream Subtitles

即時字幕產生器 - Chrome 擴充功能

為任何網頁影片、音訊內容產生即時字幕，支援英文、日文、繁體中文。

## ✨ 功能特色

- 🎯 **即時語音辨識** - 延遲低於 2 秒
- 🌍 **多語言支援** - 英文、日文、繁體中文
- 🤖 **自動語言偵測** - 智慧判斷當前語言
- ⌨️ **鍵盤快捷鍵** - 快速切換語言和控制
- 🎨 **美觀的字幕顯示** - 覆蓋在影片上方
- 🔑 **簡易 API Key 管理** - 圖形界面設定，無需編輯程式碼
- ✏️ **智慧字幕修正** - 可編輯錯誤字幕，自動學習正確用詞
- 🔒 **隱私保護** - API Key 本地儲存，音訊直接傳送到 Deepgram

## 🚀 安裝步驟

### 1. 載入擴充功能到 Chrome

1. 開啟 Chrome 瀏覽器
2. 前往 `chrome://extensions/`
3. 開啟右上角的「開發人員模式」
4. 點擊「載入未封裝項目」
5. 選擇專案中的 `extension` 資料夾
6. 完成！擴充功能圖示會出現在工具列 ✅

> 💡 **圖示已內建**：專案已包含自動生成的漸層紫色圖示，無需手動建立。

### 2. 取得免費 Deepgram API Key

1. 點擊工具列的 Stream Subtitles 圖示
2. 點擊「🎁 取得免費 API Key（$200 額度）」連結
3. 在 [Deepgram 官網](https://console.deepgram.com/signup) 註冊帳號（免費）
4. 註冊完成後會自動取得 $200 免費額度（約 775 小時使用）
5. 在 Dashboard 中複製你的 API Key

### 3. 設定 API Key

1. **點擊工具列的擴充功能圖示**
2. 在「🔑 API 設定」區域貼上你的 API Key
3. **點擊「💾 儲存」**
4. 看到「✅ API key 已儲存成功！」表示設定完成
5. 完成！現在可以開始使用字幕功能了 🎉

> 🔒 **安全說明**：你的 API Key 只會儲存在本地端（Chrome 本地儲存），不會上傳到任何伺服器。每個用戶使用自己的 API Key，費用由各自的 Deepgram 帳號承擔。

## 📖 使用方法

### 基本使用

1. **開啟任何包含影片或音訊的網頁**（YouTube, Netflix, Twitch 等）
2. **點擊工具列的擴充功能圖示**
3. **選擇語言**（英文/日文/中文/自動偵測）
4. **點擊「開始錄音」**
5. **字幕會自動顯示在畫面上** ✨

### 控制面板

字幕啟動後，畫面右上角會出現控制面板：

```
┌─────────────────────────────────┐
│ [EN] [JP] [ZH] [AUTO]  ⚙️  ⏺️   │
└─────────────────────────────────┘
```

- **EN / JP / ZH** - 快速切換語言
- **AUTO** - 自動語言偵測模式
- **⚙️** - 設定（開發中）
- **⏺️ / ⏹️** - 開始/停止錄音

### 鍵盤快捷鍵

| 快捷鍵 | 功能 |
|--------|------|
| `Alt + 1` | 切換到英文 |
| `Alt + 2` | 切換到日文 |
| `Alt + 3` | 切換到繁體中文 |
| `Alt + 4` | 自動語言偵測 |
| `Alt + S` | 開始/停止錄音 |

## 🎯 使用情境

### 看 YouTube 影片
- 自動產生即時字幕
- 支援多語言切換

### 看 Netflix / Disney+
- 為沒有字幕的內容產生字幕
- 即時翻譯理解

### 線上會議 / 直播
- 即時記錄會議內容
- 方便聽力不佳的使用者

### 語言學習
- 練習聽力時顯示字幕
- 對照發音和文字

## ⚙️ 技術細節

### 架構

```
extension/
├── manifest.json           # 擴充功能設定 (Manifest V3)
├── background/
│   └── service-worker.js  # 背景服務 (狀態管理、訊息轉發)
├── offscreen/             # Offscreen Documents (Manifest V3)
│   ├── offscreen.html     # Offscreen 頁面
│   └── offscreen.js       # 音訊擷取、Deepgram WebSocket 連線
├── content/
│   └── content.js         # 內容腳本（字幕顯示、編輯 UI）
├── popup/
│   ├── popup.html         # 彈出視窗 UI
│   ├── popup.css          # 彈出視窗樣式
│   └── popup.js           # 彈出視窗邏輯（獲取 streamID、設定）
├── styles/
│   └── content.css        # 字幕樣式
└── icons/                 # 圖示 (程式化生成)
```

### 技術棧

- **Chrome Extension Manifest V3** - 最新的擴充功能規範
- **Offscreen Documents API** - 在背景處理音訊（Manifest V3 最佳實踐）
- **chrome.tabCapture API** - 擷取分頁音訊 (`getMediaStreamId`)
- **Deepgram WebSocket API** - 即時語音辨識（支援 keywords boost）
- **MediaRecorder API** - 音訊串流處理
- **Web Audio API** - 音訊播放（避免錄音時靜音）

### 延遲分析

- **音訊擷取**: ~10ms
- **網路傳輸**: ~50-100ms
- **Deepgram 辨識**: ~100-200ms
- **UI 渲染**: ~10ms
- **總延遲**: **約 200-400ms** ⚡

（自動語言偵測模式首次偵測需要 1-3 秒）

## 🔧 常見問題

### Q: 為什麼沒有字幕顯示？

**A**: 檢查以下項目：
1. **確認已設定 API Key** - 點擊擴充功能圖示，確認「🔑 API 設定」區域顯示「✅ API key 已設定」
2. 確認網頁有播放音訊
3. 檢查瀏覽器控制台（F12）是否有錯誤訊息
4. 嘗試重新載入擴充功能（`chrome://extensions/` → 重新整理圖示 🔄）

### Q: 如何修改或刪除 API Key？

**A**:
1. 點擊工具列的擴充功能圖示
2. 在「🔑 API 設定」區域：
   - **修改**：點擊 ✏️ 按鈕，修改後點擊「💾 儲存」
   - **刪除**：點擊 🗑️ 按鈕，確認後刪除
3. API Key 儲存在本地端，隨時可以修改或刪除

### Q: API Key 安全嗎？

**A**:
- ✅ **本地儲存**：API Key 只儲存在你的瀏覽器本地端（`chrome.storage.local`）
- ✅ **加密保護**：Chrome 會自動加密本地儲存的資料
- ✅ **不會同步**：使用 `local` 而非 `sync`，不會上傳到 Google 帳號
- ✅ **隔離保護**：其他擴充功能或網頁無法讀取你的 API Key
- ⚠️ **建議**：使用個人帳號的 API Key，不要使用公司或團隊的 Key

### Q: 字幕準確度不高怎麼辦？

**A**:
1. 切換到手動語言模式（不使用自動偵測）
2. 確保音訊清晰，避免背景噪音
3. 英文辨識準確度最高，其次是日文和中文

### Q: 可以用在所有網站嗎？

**A**: 可以！這個擴充功能可以在任何網頁上使用，包括：
- YouTube
- Netflix
- Twitch
- Discord
- Zoom (網頁版)
- 任何包含音訊的網站

### Q: 會消耗很多 Deepgram 額度嗎？

**A**:
- 串流辨識：約 $0.0043/分鐘
- $200 免費額度 ≈ 46,500 分鐘 ≈ 775 小時
- 個人娛樂使用非常充裕

### Q: 支援離線使用嗎？

**A**: 不支援。Deepgram 需要網路連線。

### Q: 可以匯出字幕嗎？

**A**: 目前還不支援，但已列入開發計畫。

## 🛠️ 開發

### 偵錯

1. 前往 `chrome://extensions/`
2. 找到 Stream Subtitles
3. 點擊「檢查視圖」→「service worker」查看背景腳本日誌
4. 在任何網頁按 F12 查看 content script 日誌

### 修改程式碼

修改後需要重新載入擴充功能：
1. 前往 `chrome://extensions/`
2. 點擊擴充功能的重新整理圖示 🔄

## 📝 開發進度

### ✅ 已完成
- [x] **即時語音辨識**（延遲 < 2 秒）
- [x] **多語言支援**（英文、日文、繁體中文）
- [x] **自動語言偵測**
- [x] **鍵盤快捷鍵**
- [x] **字幕編輯與修正**（點擊 ✏️ 修正錯誤）
- [x] **關鍵字自動學習**（修正後自動加入 Deepgram keywords）
- [x] **API Key 圖形化管理**（無需編輯程式碼）
- [x] **程式化圖示生成**（自動生成擴充功能圖示）

### 🚧 待開發功能
- [ ] 字幕歷史記錄
- [ ] 匯出字幕為 SRT/VTT 格式
- [ ] 自訂字幕樣式（顏色、大小、位置）
- [ ] 字幕翻譯功能
- [ ] 關鍵字高亮顯示
- [ ] 語音指令控制
- [ ] 多說話者識別

## 📖 開發記錄

### 2025-11-21 - Manifest V3 遷移與核心修復

#### 重大架構變更

**問題：Manifest V3 不兼容**
- ❌ 原始實作使用 `chrome.tabCapture.capture()` 在 background service worker 中
- ❌ Manifest V3 中 `tabCapture.capture()` 只能在 foreground pages 使用
- ❌ 導致 "chrome.tabCapture.capture is not a function" 錯誤

**解決方案：Offscreen Documents API**
- ✅ 採用 Chrome 官方推薦的 Offscreen Documents API
- ✅ 創建 `offscreen/offscreen.html` 和 `offscreen/offscreen.js`
- ✅ 在 offscreen document 中處理音訊擷取和 Deepgram 連線
- ✅ 新增 `offscreen` 權限到 manifest.json

**架構流程：**
```
Popup (獲取 streamId)
  → Background Service Worker (管理狀態)
    → Offscreen Document (音訊處理 + Deepgram)
      → Background (轉發字幕)
        → Content Script (顯示字幕)
```

#### 技術修復

**1. getUserMedia API 格式修正**
- ❌ 錯誤：使用過時的 `mandatory` 屬性
- ✅ 修正：使用標準 constraints 格式
```javascript
// Before (錯誤)
getUserMedia({ audio: { mandatory: { ... } } })

// After (正確)
getUserMedia({ audio: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } })
```

**2. 音訊播放問題**
- ❌ 問題：tabCapture 會自動靜音原始頁面
- ✅ 解決：使用 AudioContext 重新播放音訊
```javascript
audioContext = new AudioContext();
audioSource = audioContext.createMediaStreamSource(audioStream);
audioSource.connect(audioContext.destination);
```

**3. Permission Dismissed 錯誤**
- ❌ 問題：在 background 中調用 `getMediaStreamId()` 失去用戶手勢上下文
- ✅ 解決：移至 popup.js 在用戶點擊按鈕時調用
- ✅ 確保所有權限請求都在有用戶手勢的上下文中執行

**4. Extension Context Invalidated 錯誤**
- ❌ 問題：content script 在擴充功能重新載入後嘗試發送訊息
- ✅ 解決：新增 `safeSendMessage()` 函數檢查 `chrome.runtime.lastError`
- ✅ 優雅處理擴充功能重新載入情況

#### 錯誤處理改善

**詳細錯誤日誌：**
- 顯示完整的 DOMException 錯誤（name + message）
- 針對常見錯誤提供具體說明（NotAllowedError, NotFoundError, AbortError）
- 在每個關鍵步驟添加狀態日誌
- 改善 Deepgram 連線錯誤提示（API key 驗證）

**調試體驗提升：**
```javascript
console.log('[Offscreen] 嘗試獲取音訊流，stream ID:', streamId);
console.log('[Offscreen] 音訊流已建立，tracks:', audioStream.getTracks().length);
console.log('[Offscreen] MediaRecorder 已建立，state:', mediaRecorder.state);
console.log('[Offscreen] Deepgram 連線成功');
```

#### Commits

1. **cedb4f7** - `fix: migrate to Manifest V3 Offscreen Document API for audio capture`
   - 新增 offscreen document 架構
   - 移除 background 中的直接音訊處理

2. **0891722** - `fix: correct getUserMedia constraints and add audio playback`
   - 修正 getUserMedia API 調用格式
   - 添加 AudioContext 音訊播放功能

3. **4a1bad8** - `fix: improve error handling and add detailed logging`
   - 改善錯誤處理和日誌輸出
   - 新增 safeSendMessage 函數

4. **e367e1c** - `fix: resolve Permission dismissed error by moving getMediaStreamId to popup`
   - 將 getMediaStreamId 移至 popup 確保用戶手勢上下文
   - 簡化語言切換邏輯

#### 測試建議

**重新載入擴充功能後測試：**
1. 打開有音訊的網頁（YouTube, Netflix）
2. 點擊擴充功能圖示
3. 選擇語言
4. 點擊「開始錄音」
5. 驗證：
   - ✅ 影片聲音正常播放
   - ✅ 字幕正確顯示
   - ✅ 沒有控制台錯誤
   - ✅ 錄音/停止功能正常

**已知限制：**
- 錄音時切換語言會自動停止錄音（需要重新啟動以獲取新的用戶手勢）

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

## 📄 授權

MIT License

## 🙏 致謝

- [Deepgram](https://deepgram.com) - 提供優秀的語音辨識 API
- Chrome Extension 文件和社群

## 📮 聯絡

如有問題或建議，請開 Issue 討論。

---

**享受你的即時字幕體驗！** 🎉
