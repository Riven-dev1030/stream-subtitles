# 🔑 API Key 設定指南

本指南將帶你完成 Stream Subtitles 的 API Key 設定流程。

## 📋 目錄

- [為什麼需要 API Key？](#為什麼需要-api-key)
- [取得免費 Deepgram API Key](#取得免費-deepgram-api-key)
- [設定 API Key](#設定-api-key)
- [管理 API Key](#管理-api-key)
- [安全性說明](#安全性說明)
- [常見問題](#常見問題)

---

## 為什麼需要 API Key？

Stream Subtitles 使用 **Deepgram** 的語音辨識服務來產生即時字幕。為了確保安全性和成本控制，每個用戶需要使用自己的 API Key。

### 優點：
- ✅ **個人控制** - 你可以完全掌控自己的 API 用量和費用
- ✅ **更安全** - API Key 只儲存在你的本地端，不會上傳到任何地方
- ✅ **免費額度** - Deepgram 提供 $200 免費額度（約 775 小時使用）
- ✅ **可隨時更換** - 如果 Key 洩漏，可以立即刪除並建立新的

---

## 取得免費 Deepgram API Key

### 步驟 1: 註冊 Deepgram 帳號

1. 開啟 Chrome，點擊工具列的 **Stream Subtitles** 圖示
2. 點擊「**🎁 取得免費 API Key（$200 額度）**」連結
3. 或直接前往：https://console.deepgram.com/signup

### 步驟 2: 填寫註冊資訊

- **Email**：你的電子郵件
- **Full Name**：你的姓名
- **Password**：設定密碼
- 勾選同意服務條款
- 點擊「Sign Up」

### 步驟 3: 驗證 Email

1. 檢查你的信箱
2. 點擊 Deepgram 寄來的驗證連結
3. 完成 Email 驗證

### 步驟 4: 取得 API Key

1. 登入 [Deepgram Console](https://console.deepgram.com/)
2. 在左側選單點擊「**API Keys**」
3. 你會看到預設的 API Key（或點擊「Create a New API Key」建立新的）
4. 點擊 **「Copy」** 按鈕複製 API Key

> 💡 **提示**：API Key 格式通常是 `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`（一長串英數字）

---

## 設定 API Key

### 方法 1: 首次設定

第一次使用時，擴充功能會自動顯示設定界面：

1. 點擊工具列的 **Stream Subtitles** 圖示
2. 看到「🔑 API 設定」區域
3. 在輸入框中**貼上**你剛才複製的 API Key
4. 點擊「**💾 儲存**」按鈕
5. 看到「✅ API key 已儲存成功！」提示訊息

**完成！** 現在可以開始使用字幕功能了。

### 方法 2: 使用鍵盤快捷鍵

在 API Key 輸入框中貼上 Key 後，也可以直接按 **Enter 鍵** 儲存。

---

## 管理 API Key

### 查看已設定的 Key

點擊擴充功能圖示後，如果已設定 API Key，會顯示：

```
┌────────────────────────────────┐
│ ✅ sk-abc...xyz1234            │
│    ✏️ 編輯  🗑️ 刪除            │
└────────────────────────────────┘
API key 已設定
```

> 🔒 **隱私保護**：完整的 Key 不會顯示，只顯示開頭和結尾（如 `sk-abc...xyz1234`）

### 修改 API Key

如果需要更換新的 API Key：

1. 點擊工具列的擴充功能圖示
2. 點擊 **✏️ 編輯** 按鈕
3. 輸入框會顯示目前的 Key（已自動選取）
4. 貼上新的 API Key
5. 點擊「**💾 儲存**」

### 刪除 API Key

如果要移除 API Key（例如 Key 洩漏或不再使用）：

1. 點擊工具列的擴充功能圖示
2. 點擊 **🗑️ 刪除** 按鈕
3. 確認刪除
4. 如果正在錄音，會自動停止

> ⚠️ **注意**：刪除後需要重新設定 API Key 才能使用字幕功能。

---

## 安全性說明

### 資料儲存位置

你的 API Key 儲存在：
- **Chrome 本地儲存**（`chrome.storage.local`）
- **不會同步** 到其他裝置或 Google 帳號
- **只有這個擴充功能** 可以讀取

### 安全機制

| 安全特性 | 說明 |
|---------|------|
| 🔒 **本地加密** | Chrome 自動加密本地儲存的資料 |
| 🚫 **不會上傳** | API Key 不會傳送到任何第三方伺服器 |
| 🛡️ **隔離保護** | 其他擴充功能或網頁無法讀取 |
| 👁️ **遮罩顯示** | UI 中只顯示部分 Key（如 `sk-****...****1234`） |
| 🔑 **隨時刪除** | 可以立即刪除並更換新的 Key |

### 最佳實踐

✅ **建議做法**：
- 使用個人 Deepgram 帳號的 API Key
- 定期檢查 API 用量（在 Deepgram Console）
- 如果 Key 疑似洩漏，立即刪除並建立新的
- 不要在截圖或影片中顯示完整的 Key

❌ **避免做法**：
- 不要使用公司或團隊共用的 API Key
- 不要把 API Key 分享給其他人
- 不要在公開的程式碼或文件中包含 API Key

---

## 常見問題

### Q1: 忘記我的 API Key 了怎麼辦？

**A**:
- 如果已經設定過，不需要記住 Key，擴充功能會自動使用
- 如果需要查看完整的 Key：
  1. 前往 [Deepgram Console](https://console.deepgram.com/)
  2. 點擊「API Keys」
  3. 複製現有的 Key 或建立新的

### Q2: 可以在多個瀏覽器使用同一個 API Key 嗎？

**A**: 可以！你可以在不同瀏覽器或電腦上使用同一個 Deepgram API Key。只需要在每個地方分別設定一次即可。

### Q3: API Key 有使用期限嗎？

**A**:
- Deepgram API Key **沒有使用期限**
- 免費額度 $200 也**沒有時間限制**
- 可以一直使用到額度用完為止

### Q4: 如何知道我還剩多少免費額度？

**A**:
1. 登入 [Deepgram Console](https://console.deepgram.com/)
2. 在 Dashboard 查看「Usage」或「Balance」
3. 可以看到已使用的金額和剩餘額度

### Q5: $200 額度用完後怎麼辦？

**A**:
- 可以在 Deepgram Console 綁定信用卡繼續使用
- Deepgram 串流辨識價格：約 **$0.0043/分鐘**
- 或者建立新的 Deepgram 帳號（每個 Email 都有 $200 免費額度）

### Q6: 擴充功能會偷偷使用我的 API Key 嗎？

**A**: **不會**！
- 這是 **開源專案**，所有程式碼都公開透明
- API Key **只在你點擊「開始錄音」時使用**
- 可以在瀏覽器開發者工具（F12）查看所有網路請求
- 所有音訊只傳送到 Deepgram 官方伺服器

### Q7: API Key 設定後，重新開機還會存在嗎？

**A**: **會**！API Key 儲存在 Chrome 的永久儲存空間，即使：
- 重新啟動 Chrome
- 重新開機電腦
- 更新擴充功能

API Key 都會保留，不需要重新設定。

### Q8: 可以同時設定多個 API Key 嗎？

**A**: 目前只支援一個 API Key。如果需要切換：
1. 點擊 ✏️ 編輯按鈕
2. 貼上新的 API Key
3. 點擊儲存

---

## 🆘 需要幫助？

如果設定過程中遇到問題：

1. **檢查 API Key 格式** - 確認複製時沒有多餘的空格
2. **重新載入擴充功能** - 前往 `chrome://extensions/` 點擊重新整理 🔄
3. **查看錯誤訊息** - 按 F12 開啟開發者工具，查看 Console 是否有錯誤
4. **回報問題** - 在 GitHub 上開 Issue，附上錯誤訊息（**不要包含你的 API Key**）

---

**🎉 恭喜！你已經完成 API Key 設定，現在可以盡情使用即時字幕功能了！**
