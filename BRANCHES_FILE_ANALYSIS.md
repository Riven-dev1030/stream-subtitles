# 分支文件結構分析報告

**生成時間**: 2025-11-22
**分析分支數**: 10 個

---

## 📊 總覽統計

### 分支類型分類

| 類型 | 分支數 | 特徵 |
|------|-------|------|
| 📝 純文檔分支 | 2 | 只包含 Markdown 文檔 |
| 🔧 完整功能分支 | 6 | 包含完整的 Extension 代碼 |
| 📦 部分功能分支 | 2 | 包含部分功能代碼 |

---

## 🌿 分支詳細分析

### 1️⃣ 純文檔分支（Documentation Only）

#### `claude-md`
```
總文件數: 1
```
**文件列表**:
- CLAUDE.md

**特徵**:
- ✅ 只有 AI 助手指南文檔
- 🎯 用途: 提供 AI 工作指南
- 💡 狀態: 可合併到其他分支後刪除

---

#### `list-branches`
```
總文件數: 2
```
**文件列表**:
- BRANCHES_SUMMARY.md
- CLAUDE.md

**特徵**:
- ✅ 分支統整報告
- ✅ AI 助手指南
- 🎯 用途: 文檔管理
- 💡 狀態: 已被 `doc-branches` 取代，可刪除

---

#### `doc-branches` ⭐ (當前分支)
```
總文件數: 3
```
**文件列表**:
- BRANCHES_SUMMARY.md
- BRANCH_RENAME_GUIDE.md
- CLAUDE.md

**特徵**:
- ✅ 最完整的文檔分支
- ✅ 包含分支統整報告
- ✅ 包含重命名指南
- 🎯 用途: 項目文檔中心
- 💡 狀態: 活躍維護中

---

### 2️⃣ 完整功能分支（Full Extension Code）

#### `feat-mv3-migration` (原: subtitle-api-discussion)
```
總文件數: 21
文件類型: JS(4), HTML(3), CSS(2), MD(5), PNG(4), Python(1), JSON(1), 其他(1)
```

**目錄結構**:
```
├── .gitignore
├── CLAUDE.md
├── QUICKSTART.md
├── README.md
├── docs/
│   └── API_KEY_SETUP.md
├── extension/
│   ├── background/
│   │   └── service-worker.js
│   ├── content/
│   │   └── content.js
│   ├── icons/ (4 PNG files)
│   ├── manifest.json
│   ├── offscreen/
│   │   ├── offscreen.html
│   │   └── offscreen.js
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   └── styles/
│       └── content.css
├── generate_icons.py
└── tools/
    └── generate-icons.html
```

**核心功能**:
- ✅ Manifest V3 完整實現
- ✅ Offscreen Document API
- ✅ 用戶自定義 API Key
- ✅ 圖標生成工具
- ✅ 完整文檔（README, QUICKSTART, API_KEY_SETUP）

**獨有文件**:
- `offscreen.html` / `offscreen.js` (Offscreen API)
- `generate_icons.py` (圖標生成)
- `tools/generate-icons.html`
- `docs/API_KEY_SETUP.md`

---

#### `fix-service-worker`
```
總文件數: 22
文件類型: JS(4), HTML(3), CSS(2), MD(6), PNG(4), Python(1), JSON(1), 其他(1)
```

**與 feat-mv3-migration 的差異**:
- ✅ 額外包含 `docs/CHANGELOG.md`
- ✅ 其他結構相同

**核心功能**:
- ✅ Service Worker 修復
- ✅ Manifest V3
- ✅ 完整的變更日誌

---

#### `use-web-speech`
```
總文件數: 21
文件類型: JS(3), HTML(2), CSS(2), MD(6), PNG(4), Python(1), JSON(1), 其他(1)
```

**與其他分支的差異**:
- ❌ **沒有** `offscreen.html` / `offscreen.js`
- ✅ 包含 `docs/CHANGELOG.md`
- ✅ 使用 Web Speech API（不需要 offscreen document）

**核心功能**:
- ✅ Web Speech API 整合
- ✅ 簡化架構（移除 offscreen document）
- ✅ 圖標生成工具

---

#### `subtitle-api-discussion`
```
總文件數: 21
文件類型: 與 feat-mv3-migration 完全相同
```

**特徵**:
- ⚠️ 與 `feat-mv3-migration` 內容完全一致
- 💡 狀態: 重複分支，可能是重命名前的版本

---

#### `merge-to-main`
```
總文件數: 14
文件類型: JS(3), HTML(2), CSS(2), MD(4), JSON(1), 其他(1)
```

**目錄結構**:
```
├── .gitignore
├── CLAUDE.md
├── QUICKSTART.md
├── README.md
├── extension/
│   ├── background/
│   │   └── service-worker.js
│   ├── content/
│   │   └── content.js
│   ├── icons/
│   │   └── README.md (只有 README，沒有實際圖標文件)
│   ├── manifest.json
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   └── styles/
│       └── content.css
└── tools/
    └── generate-icons.html
```

**特徵**:
- ❌ **缺少圖標文件**（只有 README）
- ❌ **沒有** offscreen document
- ❌ **沒有** Python 圖標生成腳本
- ✅ 基礎功能完整

---

### 3️⃣ 部分功能分支（Partial Implementation）

#### `fix-subtitle-freezing`
```
總文件數: 15
文件類型: JS(3), HTML(1), CSS(2), MD(4), PNG(4), JSON(1)
```

**目錄結構**:
```
├── CLAUDE.md
├── DEVLOG.md ⭐
├── docs/
│   └── SUBTITLE_PROCESSING_LOGIC.md ⭐
├── extension/
│   ├── background/
│   │   └── service-worker.js
│   ├── content/
│   │   └── content.js
│   ├── icons/ (4 PNG files)
│   ├── manifest.json
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   └── styles/
│       └── content.css
```

**特徵**:
- ✅ 包含詳細的開發日誌（DEVLOG.md）
- ✅ 包含字幕處理邏輯文檔（SUBTITLE_PROCESSING_LOGIC.md）
- ❌ **沒有** README.md
- ❌ **沒有** QUICKSTART.md
- ❌ **沒有** .gitignore
- ✅ 有圖標文件

**獨有文件**:
- `DEVLOG.md` - 開發日誌
- `docs/SUBTITLE_PROCESSING_LOGIC.md` - 字幕處理邏輯詳解

---

#### `review-subtitle-fix`
```
總文件數: 15
文件類型: 與 fix-subtitle-freezing 完全相同
```

**特徵**:
- ⚠️ 與 `fix-subtitle-freezing` 結構完全相同
- ✅ 同樣包含 DEVLOG.md 和 SUBTITLE_PROCESSING_LOGIC.md
- 💡 可能是同一功能的不同版本

---

## 📂 文件類型統計

### 所有分支的文件類型分布

| 文件類型 | 數量 | 用途 |
|---------|------|------|
| **Markdown (.md)** | 40+ | 文檔、README、指南 |
| **JavaScript (.js)** | 30+ | 核心邏輯代碼 |
| **PNG (.png)** | 24+ | 擴展圖標 |
| **HTML (.html)** | 15+ | UI 頁面 |
| **CSS (.css)** | 12+ | 樣式文件 |
| **JSON (.json)** | 8+ | 配置文件 (manifest.json) |
| **Python (.py)** | 4 | 圖標生成工具 |
| **其他** | 7 | .gitignore 等 |

---

## 🔍 文件內容分類

### 📝 文檔文件 (Markdown)

| 文件名 | 出現次數 | 包含分支 |
|--------|---------|---------|
| `CLAUDE.md` | 10 | 所有分支 ✅ |
| `README.md` | 6 | 完整功能分支 |
| `QUICKSTART.md` | 5 | 完整功能分支 |
| `DEVLOG.md` | 2 | fix-subtitle-freezing, review-subtitle-fix |
| `BRANCHES_SUMMARY.md` | 2 | doc-branches, list-branches |
| `docs/SUBTITLE_PROCESSING_LOGIC.md` | 2 | fix-subtitle-freezing, review-subtitle-fix |
| `docs/CHANGELOG.md` | 2 | fix-service-worker, use-web-speech |
| `docs/API_KEY_SETUP.md` | 4 | feat-mv3-migration, fix-service-worker, subtitle-api-discussion, use-web-speech |
| `BRANCH_RENAME_GUIDE.md` | 1 | doc-branches |
| `extension/icons/README.md` | 8 | 大部分功能分支 |

---

### 💻 代碼文件 (JavaScript)

| 文件路徑 | 出現次數 | 說明 |
|---------|---------|------|
| `extension/background/service-worker.js` | 8 | Service Worker（Manifest V3） |
| `extension/content/content.js` | 8 | Content Script（注入頁面） |
| `extension/popup/popup.js` | 8 | Popup UI 邏輯 |
| `extension/offscreen/offscreen.js` | 3 | Offscreen Document API |

**核心功能代碼**:
- **service-worker.js**: 背景服務、事件監聽、通信管理
- **content.js**: 頁面注入、字幕顯示、DOM 操作
- **popup.js**: 擴展彈窗、用戶設置、控制面板
- **offscreen.js**: 音頻捕獲、語音識別（某些分支）

---

### 🎨 UI 文件 (HTML/CSS)

| 文件路徑 | 出現次數 | 說明 |
|---------|---------|------|
| `extension/popup/popup.html` | 8 | 彈窗 UI |
| `extension/styles/content.css` | 8 | 字幕樣式 |
| `extension/popup/popup.css` | 8 | 彈窗樣式 |
| `extension/offscreen/offscreen.html` | 3 | Offscreen 頁面 |
| `tools/generate-icons.html` | 4 | 圖標生成工具 |

---

### 🖼️ 資源文件 (Images)

| 文件路徑 | 出現次數 | 尺寸 |
|---------|---------|------|
| `extension/icons/icon16.png` | 6 | 16x16 |
| `extension/icons/icon32.png` | 6 | 32x32 |
| `extension/icons/icon48.png` | 6 | 48x48 |
| `extension/icons/icon128.png` | 6 | 128x128 |

**缺少圖標的分支**:
- ❌ `merge-to-main` (只有 README)
- ❌ 純文檔分支

---

### ⚙️ 配置文件

| 文件名 | 出現次數 | 說明 |
|--------|---------|------|
| `extension/manifest.json` | 8 | Chrome Extension 配置 |
| `.gitignore` | 5 | Git 忽略規則 |

---

### 🔧 工具文件

| 文件名 | 出現次數 | 說明 |
|--------|---------|------|
| `generate_icons.py` | 4 | Python 圖標生成腳本 |
| `tools/generate-icons.html` | 5 | HTML 圖標生成工具 |

---

## 🔄 分支間的差異對比

### 完整功能分支對比

| 特性 | feat-mv3 | fix-worker | use-speech | subtitle-api | merge-main |
|------|---------|-----------|-----------|-------------|-----------|
| **README** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **QUICKSTART** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **CHANGELOG** | ❌ | ✅ | ✅ | ❌ | ❌ |
| **API_KEY_SETUP** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Offscreen API** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **圖標文件** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **圖標生成工具** | ✅ | ✅ | ✅ | ✅ | ✅ |

### 字幕處理分支對比

| 特性 | fix-freezing | review-fix |
|------|-------------|-----------|
| **DEVLOG** | ✅ | ✅ |
| **SUBTITLE_LOGIC** | ✅ | ✅ |
| **README** | ❌ | ❌ |
| **圖標文件** | ✅ | ✅ |

---

## 🎯 分支分類總結

### 📦 按功能完整度分類

#### 🌟 **最完整的分支**（推薦保留）
1. **feat-mv3-migration**
   - 包含所有核心功能
   - Offscreen API 支持
   - 完整文檔

2. **fix-service-worker**
   - 所有功能 + CHANGELOG
   - Service Worker 修復

3. **use-web-speech**
   - Web Speech API 實現
   - 簡化架構
   - 完整文檔

---

#### 📝 **文檔專用分支**
1. **doc-branches** ⭐
   - 最完整的文檔集合
   - 建議保留作為文檔中心

2. **fix-subtitle-freezing / review-subtitle-fix**
   - 包含重要的開發日誌和邏輯文檔
   - 建議提取文檔後合併

---

#### ⚠️ **重複或過時分支**（建議處理）
1. **list-branches**
   - 被 doc-branches 取代
   - 建議刪除 🗑️

2. **claude-md**
   - 單一文檔，已在其他分支存在
   - 建議刪除 🗑️

3. **subtitle-api-discussion**
   - 與 feat-mv3-migration 完全相同
   - 建議刪除（已重命名）🗑️

4. **merge-to-main**
   - 缺少圖標文件
   - 功能不完整
   - 建議審查後決定 ⚠️

---

## 📊 按文件類型的分支分組

### 純代碼分支（適合合併到 main）
- feat-mv3-migration
- fix-service-worker
- use-web-speech

### 代碼 + 文檔分支（需要整理）
- fix-subtitle-freezing
- review-subtitle-fix

### 純文檔分支（文檔管理）
- doc-branches ⭐
- list-branches (可刪除)
- claude-md (可刪除)

---

## 💡 建議的分支整理策略

### 第一步：刪除重複分支
```bash
可安全刪除:
- list-branches (被 doc-branches 取代)
- claude-md (單一文檔)
- subtitle-api-discussion (與 feat-mv3-migration 重複)
```

### 第二步：合併重要分支到 main
```bash
建議合併順序:
1. feat-mv3-migration (最完整的功能)
2. fix-service-worker (重要修復)
3. use-web-speech (架構改進)
```

### 第三步：提取文檔
```bash
從以下分支提取文檔到 main:
- fix-subtitle-freezing (DEVLOG.md, SUBTITLE_PROCESSING_LOGIC.md)
- doc-branches (BRANCHES_SUMMARY.md, BRANCH_RENAME_GUIDE.md)
```

### 第四步：審查剩餘分支
```bash
需要審查:
- merge-to-main (缺少圖標，功能不完整)
- review-subtitle-fix (與 fix-subtitle-freezing 重複？)
```

---

## 📈 統計摘要

- **總分支數**: 10
- **總文件數**: 約 150+
- **純文檔分支**: 3 (可精簡為 1)
- **完整功能分支**: 6 (有重複)
- **部分功能分支**: 2
- **建議刪除**: 3 個分支
- **建議合併**: 3-5 個分支
- **建議保留**: 1-2 個活躍開發分支

---

**報告完成** ✅

建議下一步：根據此報告制定具體的分支整理計劃。
