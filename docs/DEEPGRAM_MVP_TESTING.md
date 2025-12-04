# Deepgram MVP 測試指南

**版本**: MVP v0.1
**分支**: claude/deepgram-mvp-01FPubgvGt79o7MfWbjQuxNk
**日期**: 2025-12-04
**狀態**: 基礎功能完成，可進行初步測試

---

## ✅ 已完成功能

### 1. 核心模組

- ✅ **CryptoManager** (300+ 行)
  - AES-GCM-256 加密
  - 從 Extension ID 派生唯一密鑰
  - API Key 加密儲存與讀取
  - 遮罩顯示功能

- ✅ **DeepgramClient** (428 行)
  - WebSocket 連接管理
  - 訊息處理與格式轉換
  - API Key 驗證（靜態方法）
  - 完整的錯誤處理

### 2. Popup UI

- ✅ Deepgram 設定區域（可折疊）
- ✅ API Key 輸入與加密儲存
- ✅ 遮罩顯示：`abcd••••••xyz9`
- ✅ 連接測試按鈕
- ✅ 清除 API Key 功能
- ✅ 狀態提示與錯誤顯示

### 3. Service Worker

- ✅ 模組動態載入
- ✅ 加密管理器初始化
- ✅ `testDeepgramConnection` 訊息處理
- ✅ `updateDeepgramKey` 訊息處理
- ✅ 錯誤處理與日誌

---

## 📋 測試步驟

### 準備工作

1. **取得 Deepgram API Key**
   ```
   1. 前往 https://console.deepgram.com/signup
   2. 註冊帳號（免費額度 200 美金）
   3. 建立 API Key
   4. 複製 API Key
   ```

2. **載入 Extension**
   ```
   1. 開啟 Chrome 瀏覽器
   2. 前往 chrome://extensions/
   3. 啟用「開發人員模式」
   4. 點擊「載入未封裝項目」
   5. 選擇 extension/ 資料夾
   ```

### 測試 1：API Key 加密儲存

**目標**：驗證 API Key 正確加密並儲存

**步驟**：
1. 點擊 Extension 圖示開啟 Popup
2. 展開「⚡ Deepgram (實驗性 MVP)」區域
3. 在 API Key 輸入框輸入您的 API Key
4. 點擊「💾 儲存」按鈕

**預期結果**：
- ✅ 顯示成功訊息：「API Key 已加密儲存！🔒 使用 AES-GCM-256 加密」
- ✅ 輸入框顯示遮罩版本：`abcd••••••xyz9`
- ✅ 狀態顯示：「✅ API Key 已加密儲存」
- ✅ 出現「🗑️ 清除」按鈕
- ✅ 測試按鈕變為可點擊

**驗證加密**：
```javascript
// 開啟開發者工具 > Application > Storage > Local Storage
// 查看 deepgramApiKey 的值應該是加密的 Base64 字串
// 例如：「wK7Jx9Y8...」而不是明文
```

### 測試 2：API Key 持久化

**目標**：驗證 API Key 重啟後仍然存在

**步驟**：
1. 關閉 Popup
2. 重新開啟 Popup
3. 展開 Deepgram 區域

**預期結果**：
- ✅ 輸入框顯示遮罩：`abcd••••••xyz9`
- ✅ 狀態顯示：「✅ API Key 已設定（🔒加密）」
- ✅ 清除按鈕存在
- ✅ 測試按鈕可點擊

### 測試 3：連接測試

**目標**：驗證 Deepgram API Key 有效性

**步驟**：
1. 開啟 Popup
2. 展開 Deepgram 區域
3. 點擊「🧪 測試 Deepgram 連接」按鈕

**預期結果（成功）**：
- ✅ 按鈕顯示：「🔄 測試中...」（測試期間）
- ✅ 狀態變為：「測試連接中...」（黃色）
- ✅ 成功後彈出：「Deepgram 連接測試成功！✅」
- ✅ 狀態變為：「✅ 連接成功！」（綠色）

**預期結果（失敗）**：
- ❌ 彈出：「連接失敗：API Key 無效或連接失敗」
- ❌ 狀態變為：「❌ 連接失敗」（紅色）

**查看日誌**：
```
開啟 Extension 的 Service Worker 日誌：
1. chrome://extensions/
2. 找到 Stream Subtitles
3. 點擊「Service Worker」連結
4. 查看 Console 輸出

應該看到：
[Background] 測試 Deepgram 連接...
[Deepgram] 連接到: wss://api.deepgram.com/v1/listen?...
[Background] Deepgram 連接測試成功
```

### 測試 4：清除 API Key

**目標**：驗證清除功能正常運作

**步驟**：
1. 點擊「🗑️ 清除」按鈕
2. 確認對話框點擊「確定」

**預期結果**：
- ✅ 輸入框清空
- ✅ 輸入框類型變為 password
- ✅ 狀態顯示：「未設定 API Key」
- ✅ 清除按鈕消失
- ✅ 測試按鈕變為不可點擊
- ✅ 彈出：「API Key 已清除」

**驗證清除**：
```javascript
// 查看 Local Storage
// deepgramApiKey, apiKeyEncrypted, apiKeySetAt 應該都被刪除
```

### 測試 5：格式驗證

**目標**：驗證 API Key 格式檢查

**步驟**：
1. 輸入無效的 API Key：`123`
2. 點擊儲存

**預期結果**：
- ❌ 彈出：「API Key 格式無效，請檢查」
- ❌ 不會儲存

**測試有效格式**：
```
✅ 40 字元以上的英數字組合
✅ 可包含 - 和 _
❌ 少於 20 字元
❌ 包含特殊字元（除了 - 和 _）
```

### 測試 6：更新 API Key

**目標**：驗證可以更新已存在的 API Key

**步驟**：
1. 已有 API Key 的狀態下
2. 點擊輸入框（獲得焦點）
3. 輸入新的 API Key
4. 點擊儲存

**預期結果**：
- ✅ 點擊輸入框時，遮罩清除
- ✅ 輸入框類型變為 password
- ✅ Placeholder 變為：「輸入新的 API Key 或留空保留現有」
- ✅ 儲存後顯示新的遮罩
- ✅ 測試連接使用新的 API Key

---

## 🔍 除錯指南

### 問題 1：Service Worker 無法載入模組

**症狀**：
```
Failed to load resource: net::ERR_FILE_NOT_FOUND
```

**檢查**：
1. 確認文件結構正確：
   ```
   extension/
   ├── background/
   │   ├── service-worker.js
   │   └── deepgram-client.js
   └── utils/
       └── crypto-manager.js
   ```

2. 檢查 importScripts 路徑：
   ```javascript
   importScripts(
     '../utils/crypto-manager.js',  // 相對於 background/
     './deepgram-client.js'         // 同層級
   );
   ```

### 問題 2：CryptoManager 未定義

**症狀**：
```
ReferenceError: CryptoManager is not defined
```

**解決**：
1. 確認 crypto-manager.js 有導出：
   ```javascript
   if (typeof window !== 'undefined') {
     window.CryptoManager = CryptoManager;
     window.cryptoManager = cryptoManager;
   }
   ```

2. 確認 popup.html 有載入：
   ```html
   <script src="../utils/crypto-manager.js"></script>
   ```

### 問題 3：API Key 測試一直失敗

**可能原因**：
1. **網路問題**
   - 確認可以訪問 api.deepgram.com
   - 檢查防火牆設定

2. **API Key 無效**
   - 確認 API Key 從 Deepgram Console 複製正確
   - 確認沒有多餘的空格

3. **超時設定**
   - DeepgramClient.validateApiKey 有 5 秒超時
   - 網路較慢可能需要增加

### 問題 4：加密/解密失敗

**症狀**：
```
Error: 解密失敗（可能是 API Key 已損壞）
```

**解決**：
1. 清除 Storage 重新儲存：
   ```javascript
   // 開發者工具 Console
   chrome.storage.local.clear()
   ```

2. 重新載入 Extension

3. 重新輸入 API Key

### 問題 5：遮罩顯示不正確

**檢查**：
```javascript
// 確認 API Key 長度 >= 12
// maskApiKey 邏輯：
// 顯示前 4 字元 + ••••••••+ 後 4 字元
```

---

## 📊 當前限制（MVP）

### ⚠️ 尚未實作的功能

1. **音訊捕獲** ❌
   - 尚未實作 chrome.tabCapture
   - 無法實際串流音訊到 Deepgram

2. **實際語音辨識** ❌
   - 只能測試連接
   - 無法取得辨識結果

3. **字幕顯示** ❌
   - Deepgram 結果尚未整合到 Content Script

4. **引擎切換** ❌
   - 無法在 Web Speech API 和 Deepgram 之間切換
   - 目前 Web Speech API 仍然是主要引擎

### ✅ 已驗證的功能

1. **API Key 管理** ✅
   - 加密儲存
   - 遮罩顯示
   - 持久化
   - 清除

2. **連接測試** ✅
   - WebSocket 連接驗證
   - API Key 有效性檢查

3. **UI/UX** ✅
   - 友善的錯誤提示
   - Loading 狀態
   - 狀態顏色標示

---

## 🎯 下一步工作

### 階段 2：音訊整合（預計 2-3 天）

1. **音訊捕獲**
   ```javascript
   // 實作 chrome.tabCapture
   // 處理 MediaStream
   ```

2. **格式轉換**
   ```javascript
   // 將 Web Audio API 輸出轉換為 Deepgram 需要的格式
   // Linear16 PCM, 16kHz
   ```

3. **WebSocket 串流**
   ```javascript
   // 連接 Deepgram WebSocket
   // 持續發送音訊數據
   ```

4. **結果處理**
   ```javascript
   // 接收 Deepgram 結果
   // 轉換為統一格式
   // 發送到 Content Script
   ```

### 階段 3：對比測試（預計 1 天）

1. 使用相同影片測試
2. 對比 Web Speech API vs Deepgram
3. 記錄精度、延遲、穩定性

---

## 💡 測試建議

### 順序建議

1. ✅ **先測試加密功能**（測試 1-5）
   - 確保 API Key 管理正常

2. ✅ **再測試連接**（測試 3）
   - 確保可以連上 Deepgram

3. ⏳ **等待音訊整合完成後**
   - 測試實際語音辨識

### 常見問題自查

在報告問題前，請先：
1. ✅ 查看 Service Worker Console 日誌
2. ✅ 查看 Popup Console 日誌
3. ✅ 檢查 chrome.storage.local 內容
4. ✅ 確認 Deepgram API Key 有效
5. ✅ 重新載入 Extension 嘗試

---

## 📝 測試報告模板

```markdown
### 測試環境
- Chrome 版本：
- 作業系統：
- Extension 版本：MVP v0.1

### 測試項目
- [ ] API Key 加密儲存
- [ ] API Key 持久化
- [ ] 連接測試
- [ ] 清除 API Key
- [ ] 格式驗證
- [ ] 更新 API Key

### 測試結果
- 成功：X 項
- 失敗：X 項

### 問題記錄
1. [問題描述]
   - 重現步驟：
   - 預期結果：
   - 實際結果：
   - Console 日誌：
```

---

**測試愉快！如有問題請查看除錯指南或提供詳細的測試報告。** ✅
