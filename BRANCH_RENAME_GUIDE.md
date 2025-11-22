# 分支重命名對照表

**目的**: 將所有分支名稱改為更清晰、更符合 Git Flow 慣例的命名

**操作方式**: 在 GitHub 網頁上手動重命名（保留 session ID 不變）

---

## 📋 重命名對照表

### ✅ 已完成

| # | 原名稱 | 新名稱 | 狀態 |
|---|--------|--------|------|
| 8 | `claude/list-branches-018VWsAqep5AhsMd5W84PnN7` | `claude/doc-branches-018VWsAqep5AhsMd5W84PnN7` | ✅ 完成並測試 |

---

### 🔄 待重命名

| # | 原名稱 | 新名稱 | 類型 | 說明 |
|---|--------|--------|------|------|
| 1 | `claude/review-subtitle-fix-01RUHWyAVU9uG3UWWHVzcdKx` | `claude/feat-interim-engine-01RUHWyAVU9uG3UWWHVzcdKx` | feat | Interim 主導架構、心跳檢測 |
| 2 | `claude/fix-subtitle-freezing-015YM8sVPEGvjWpKa4iEEE1d` | `claude/fix-buffer-freeze-015YM8sVPEGvjWpKa4iEEE1d` | fix | 修復字幕凍結與緩衝區管理 |
| 3 | `claude/use-web-speech-api-01GXd6k5i1J8Ei4vKaATJ6YE` | `claude/feat-web-speech-01GXd6k5i1J8Ei4vKaATJ6YE` | feat | Web Speech API 整合 |
| 4 | `claude/fix-service-worker-extension-01QBn5raB23aQ4ZC3NY67DRC` | `claude/fix-mv3-worker-01QBn5raB23aQ4ZC3NY67DRC` | fix | Manifest V3 Service Worker 修復 |
| 5 | `claude/subtitle-api-discussion-01Jz5QCAxUGZLpx1m1mLAQuc` | `claude/feat-mv3-migration-01Jz5QCAxUGZLpx1m1mLAQuc` | feat | Manifest V3 完整遷移 |
| 6 | `claude/merge-to-main-01Jz5QCAxUGZLpx1m1mLAQuc` | `claude/release-v1-01Jz5QCAxUGZLpx1m1mLAQuc` | release | 整合分支準備合併 |
| 7 | `claude/claude-md-mi8x1eg710srxso1-01GX7TfFGvr4SdTis9LxLxRW` | `claude/doc-ai-guide-01GX7TfFGvr4SdTis9LxLxRW` | docs | AI 助手指導文檔 |

---

## 🎯 命名規範說明

### 格式
```
claude/<type>-<short-description>-<session-id>
```

### 類型 (type)
- **feat**: 新功能開發
- **fix**: 錯誤修復
- **docs**: 文檔相關
- **refactor**: 重構代碼
- **release**: 發布/整合分支

### 描述 (short-description)
- 使用簡短、清晰的英文描述
- 使用連字符 `-` 連接單詞
- 避免過長的名稱（建議 2-4 個單詞）

### Session ID
- **必須保持原樣不變**
- 這是權限控制的關鍵

---

## 📝 重命名詳細說明

### 1. feat-interim-engine (原: review-subtitle-fix)
**改名原因**:
- "review-subtitle-fix" 聽起來像審查修復，不符合實際內容
- 實際上是全新的 Interim 主導架構

**核心功能**:
- Interim 主導的字幕處理邏輯
- 心跳檢測機制
- 性能優化與字數限制

---

### 2. fix-buffer-freeze (原: fix-subtitle-freezing)
**改名原因**:
- 更精確地指出問題所在（Buffer 管理）
- 更簡潔

**核心功能**:
- 修復字幕凍結問題
- Buffer 定時清理機制
- Final + Interim 動態字數分配

---

### 3. feat-web-speech (原: use-web-speech-api)
**改名原因**:
- 從 "use" 改為 "feat"，更符合 Git Flow 慣例
- 更簡潔（省略 "-api"）

**核心功能**:
- 從 Deepgram 遷移到 Web Speech API
- 簡化架構
- 智能斷句功能

---

### 4. fix-mv3-worker (原: fix-service-worker-extension)
**改名原因**:
- 突出 Manifest V3（mv3）
- 更簡潔（worker 替代 service-worker-extension）

**核心功能**:
- Service Worker 相關修復
- Offscreen document 時序問題
- getUserMedia 約束修正

---

### 5. feat-mv3-migration (原: subtitle-api-discussion)
**改名原因**:
- "discussion" 聽起來只是討論，實際是完整實現
- 突出是 Manifest V3 遷移工作

**核心功能**:
- Manifest V3 完整遷移
- Offscreen Document API
- 關鍵字學習功能
- API Key 管理

---

### 6. release-v1 (原: merge-to-main)
**改名原因**:
- 使用標準的 release 類型
- 添加版本號（v1）

**核心功能**:
- 整合多個功能分支
- 準備合併到主分支
- 第一個發布版本

---

### 7. doc-ai-guide (原: claude-md)
**改名原因**:
- "claude-md" 太模糊
- 明確指出是 AI 助手指導文檔

**核心功能**:
- CLAUDE.md 文檔
- AI 助手工作指南

---

### 8. doc-branches (原: list-branches) ✅
**改名原因**:
- 更簡潔直接
- doc 類型更明確

**核心功能**:
- 分支統整報告
- BRANCHES_SUMMARY.md

---

## 🚀 執行步驟

### 在 GitHub 上重命名分支：

1. 前往 GitHub 倉庫
2. 點擊 "Branches" 查看所有分支
3. 找到要重命名的分支
4. 點擊分支右側的鉛筆圖標（編輯）
5. 輸入新名稱（**確保 session ID 完全一致**）
6. 保存

### 重命名後通知 AI 助手：

完成重命名後，AI 助手會：
1. `git fetch origin` - 獲取更新
2. 重命名本地分支對應遠程
3. 測試推送（確認權限）
4. 更新 BRANCHES_SUMMARY.md

---

## ⚠️ 注意事項

### ✅ 必須保留
- Session ID 必須**完全一致**
- `claude/` 前綴必須保留

### ❌ 避免
- 不要刪除或修改 session ID
- 不要移除 `claude/` 前綴
- 重命名後不要立即刪除舊分支（確認成功後再刪）

### 💡 建議順序
1. 先重命名 1-2 個分支測試
2. 確認 AI 助手能正常推送後
3. 批量重命名其他分支

---

## 📊 重命名前後對比

### 重命名前的問題：
- ❌ 命名不一致（fix-, use-, 描述性混雜）
- ❌ 語意不清（discussion, review, claude-md）
- ❌ 不符合 Git Flow 慣例
- ❌ 難以快速理解分支用途

### 重命名後的優勢：
- ✅ 統一的命名規範（feat-, fix-, docs-, release-）
- ✅ 清晰的語意（能快速理解分支內容）
- ✅ 符合業界標準（Git Flow）
- ✅ 更專業的項目管理

---

**準備好了嗎？開始重命名吧！** 🎯

完成重命名後，請告訴我，我會立即更新文檔並測試！
