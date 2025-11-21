# 🚀 快速開始指南

這是一個 5 分鐘快速設定指南，讓你立即開始使用 Stream Subtitles。

## 📋 前置準備

- ✅ Chrome 或 Edge 瀏覽器
- ✅ Deepgram 帳號（免費註冊）
- ✅ 網路連線

## 🎯 三步驟快速設定

### 步驟 1：取得 Deepgram API Key（2 分鐘）

1. 前往 https://deepgram.com
2. 點擊「Sign Up」註冊（可用 Google 帳號快速註冊）
3. 註冊完成後，前往 Dashboard
4. 點擊「API Keys」→「Create a New API Key」
5. 複製你的 API Key（類似 `abc123def456...`）

### 步驟 2：設定 API Key（1 分鐘）

1. 開啟檔案：`extension/background/service-worker.js`
2. 找到第 10 行：
   ```javascript
   const DEEPGRAM_API_KEY = '';
   ```
3. 貼上你的 API Key：
   ```javascript
   const DEEPGRAM_API_KEY = 'abc123def456...';
   ```
4. 儲存檔案

### 步驟 3：安裝擴充功能（2 分鐘）

1. 開啟 Chrome 瀏覽器
2. 在網址列輸入：`chrome://extensions/`
3. 開啟右上角的「開發人員模式」開關
4. 點擊「載入未封裝項目」
5. 選擇這個專案的 `extension` 資料夾
6. 完成！🎉

## 🎬 立即測試

1. **開啟 YouTube**（或任何有影片的網站）
2. **點擊工具列的擴充功能圖示**
3. **點擊「開始錄音」**
4. **播放影片**
5. **看到字幕了！** ✨

## ⚡ 快捷操作

- `Alt + 1` - 切換英文
- `Alt + 2` - 切換日文
- `Alt + 3` - 切換中文
- `Alt + S` - 開始/停止

## ⚠️ 關於圖示

如果載入擴充功能時出現圖示錯誤，有兩種解決方案：

### 方案一：使用線上工具快速建立

1. 前往 https://www.favicon-generator.org/
2. 上傳任何圖片（或用 emoji 截圖）
3. 產生各種尺寸
4. 下載後放入 `extension/icons/` 資料夾
5. 重新命名為：`icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`

### 方案二：暫時註解掉圖示（最快）

編輯 `extension/manifest.json`，將圖示相關的行註解掉：

```json
{
  "manifest_version": 3,
  "name": "Stream Subtitles",
  ...
  // "action": {
  //   "default_popup": "popup/popup.html",
  //   "default_icon": { ... }
  // },
  // "icons": { ... }
}
```

> 注意：註解掉後工具列不會有圖示，但功能正常。

## 🐛 遇到問題？

### 沒有字幕顯示

**檢查清單：**
- [ ] API Key 是否正確填入？
- [ ] 網頁是否有播放音訊？
- [ ] 按 F12 檢查 Console 是否有錯誤訊息？

### API Key 無效

- 確認複製完整的 Key（通常很長）
- 確認 Key 前後沒有多餘的空白
- 確認使用單引號包住：`'your_key_here'`

### 擴充功能載入失敗

- 確認選擇的是 `extension` 資料夾（不是專案根目錄）
- 確認 `manifest.json` 格式正確（JSON 不允許註解，如果用方案二要正確註解）

## 📚 更多資訊

- 完整文件：[README.md](README.md)
- 專案結構：[CLAUDE.md](CLAUDE.md)
- 圖示說明：[extension/icons/README.md](extension/icons/README.md)

---

**準備好了嗎？開始享受你的即時字幕吧！** 🚀
