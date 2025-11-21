# 圖示說明

這個資料夾包含 Chrome Extension 所需的圖示檔案：

- `icon16.png` - 16x16 像素（工具列小圖示）
- `icon32.png` - 32x32 像素（Retina 顯示）
- `icon48.png` - 48x48 像素（擴充功能管理頁面）
- `icon128.png` - 128x128 像素（Chrome Web Store）

## 預設圖示

專案已包含預設圖示（漸層紫色背景 + 白色字幕圖案）。這些圖示由 `generate_icons.py` 腳本自動生成。

## 重新生成圖示

如果需要重新生成圖示，在專案根目錄執行：

```bash
python3 generate_icons.py
```

這會生成所有所需尺寸的圖示檔案。

## 自訂圖示的方法

### 方法一：使用線上工具

1. 前往 https://www.canva.com 或 https://www.figma.com
2. 建立一個 128x128 的設計
3. 使用字幕相關的圖示（例如：💬、🎬、📝）
4. 匯出為 PNG，然後調整大小到各種尺寸

### 方法二：使用 Emoji

1. 截圖一個 emoji（🎬 或 💬）
2. 使用線上工具調整大小：https://www.iloveimg.com/resize-image
3. 產生 16x16, 32x32, 48x48, 128x128 四種尺寸

### 方法三：使用簡單的設計工具

使用任何圖片編輯軟體建立簡單的圖示：
- 背景色：漸層紫色 (#667eea 到 #764ba2)
- 前景：白色的 "字" 字或 "CC" (Closed Caption)

## 臨時解決方案

在開發期間，你可以使用純色方塊作為臨時圖示。Chrome 會接受任何 PNG 檔案。
