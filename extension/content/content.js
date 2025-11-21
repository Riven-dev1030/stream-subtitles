// Stream Subtitles - Content Script
// 在網頁上顯示字幕覆蓋層

let subtitleContainer = null;
let subtitleText = null;
let controlPanel = null;
let isVisible = false;
let currentSubtitle = '';
let interimSubtitle = '';

// 語言設定
const languages = {
  en: { code: 'en', name: 'English', flag: '🇬🇧' },
  ja: { code: 'ja', name: '日本語', flag: '🇯🇵' },
  zh: { code: 'zh-TW', name: '繁體中文', flag: '🇹🇼' }
};

let currentLanguage = 'en';
let autoDetect = false;
let isRecording = false;

// 初始化
function init() {
  console.log('[Content] 字幕腳本已載入');

  // 建立 UI
  createSubtitleUI();

  // 從 storage 載入設定
  loadSettings();

  // 監聽來自 background 的訊息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Content] 收到訊息:', message);

    switch (message.action) {
      case 'subtitle':
        displaySubtitle(message.text, message.isFinal);
        break;

      case 'recordingStarted':
        isRecording = true;
        updateControlPanel();
        showSubtitleUI();
        break;

      case 'recordingStopped':
        isRecording = false;
        updateControlPanel();
        break;

      case 'languageChanged':
        currentLanguage = message.language;
        autoDetect = message.autoDetect;
        updateControlPanel();
        break;
    }

    sendResponse({ success: true });
  });

  // 鍵盤快捷鍵
  document.addEventListener('keydown', handleKeyboardShortcut);
}

// 建立字幕 UI
function createSubtitleUI() {
  // 控制面板
  controlPanel = document.createElement('div');
  controlPanel.id = 'stream-subtitle-control';
  controlPanel.innerHTML = `
    <div class="control-buttons">
      <button id="lang-en" class="lang-btn active" data-lang="en" title="English">EN</button>
      <button id="lang-ja" class="lang-btn" data-lang="ja" title="日本語">JP</button>
      <button id="lang-zh" class="lang-btn" data-lang="zh-TW" title="繁體中文">ZH</button>
      <button id="lang-auto" class="lang-btn" data-lang="auto" title="自動偵測">AUTO</button>
      <span class="separator">|</span>
      <button id="toggle-recording" class="action-btn" title="開始/停止">⏺️</button>
      <button id="settings-btn" class="action-btn" title="設定">⚙️</button>
    </div>
  `;

  // 字幕容器
  subtitleContainer = document.createElement('div');
  subtitleContainer.id = 'stream-subtitle-container';

  subtitleText = document.createElement('div');
  subtitleText.id = 'stream-subtitle-text';
  subtitleText.textContent = '';

  subtitleContainer.appendChild(subtitleText);

  // 加入到頁面
  document.body.appendChild(controlPanel);
  document.body.appendChild(subtitleContainer);

  // 綁定事件
  bindControlEvents();

  console.log('[Content] UI 已建立');
}

// 綁定控制面板事件
function bindControlEvents() {
  // 語言切換按鈕
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      const isAuto = lang === 'auto';

      // 傳送訊息到 background
      chrome.runtime.sendMessage({
        action: 'changeLanguage',
        language: isAuto ? currentLanguage : lang,
        autoDetect: isAuto
      });

      // 更新 UI
      if (!isAuto) {
        currentLanguage = lang;
      }
      autoDetect = isAuto;
      updateControlPanel();
    });
  });

  // 開始/停止按鈕
  document.getElementById('toggle-recording').addEventListener('click', () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  });

  // 設定按鈕
  document.getElementById('settings-btn').addEventListener('click', () => {
    // TODO: 開啟設定面板
    alert('設定功能開發中...\n\n目前支援:\n- 語言切換 (EN/JP/ZH/AUTO)\n- 鍵盤快捷鍵 (1/2/3/4)');
  });
}

// 更新控制面板
function updateControlPanel() {
  // 更新語言按鈕狀態
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  if (autoDetect) {
    document.getElementById('lang-auto').classList.add('active');
  } else {
    const activeLang = currentLanguage === 'zh-TW' ? 'zh' : currentLanguage;
    document.getElementById(`lang-${activeLang}`)?.classList.add('active');
  }

  // 更新錄音按鈕
  const recordBtn = document.getElementById('toggle-recording');
  recordBtn.textContent = isRecording ? '⏹️' : '⏺️';
  recordBtn.classList.toggle('recording', isRecording);
}

// 顯示字幕
function displaySubtitle(text, isFinal) {
  if (isFinal) {
    // 最終結果
    currentSubtitle = text;
    interimSubtitle = '';
  } else {
    // 暫時結果
    interimSubtitle = text;
  }

  // 組合顯示
  const displayText = currentSubtitle + (interimSubtitle ? ' ' + interimSubtitle : '');
  subtitleText.textContent = displayText;

  // 顯示字幕容器
  showSubtitleUI();

  // 如果是最終結果，3 秒後清除舊字幕（保留最新的）
  if (isFinal) {
    setTimeout(() => {
      if (subtitleText.textContent === displayText) {
        currentSubtitle = '';
        if (!interimSubtitle) {
          subtitleText.textContent = '';
        }
      }
    }, 3000);
  }
}

// 顯示字幕 UI
function showSubtitleUI() {
  if (!isVisible) {
    subtitleContainer.style.display = 'block';
    controlPanel.style.display = 'block';
    isVisible = true;
  }
}

// 隱藏字幕 UI
function hideSubtitleUI() {
  subtitleContainer.style.display = 'none';
  controlPanel.style.display = 'none';
  isVisible = false;
}

// 開始錄音
function startRecording() {
  chrome.runtime.sendMessage({
    action: 'startCapture',
    language: currentLanguage,
    autoDetect: autoDetect
  }, (response) => {
    if (response.success) {
      console.log('[Content] 開始錄音');
    } else {
      alert('錄音失敗: ' + response.error);
    }
  });
}

// 停止錄音
function stopRecording() {
  chrome.runtime.sendMessage({
    action: 'stopCapture'
  }, (response) => {
    if (response.success) {
      console.log('[Content] 停止錄音');
      subtitleText.textContent = '';
      currentSubtitle = '';
      interimSubtitle = '';
    }
  });
}

// 鍵盤快捷鍵
function handleKeyboardShortcut(event) {
  // Alt + 數字鍵切換語言
  if (event.altKey) {
    switch (event.key) {
      case '1':
        event.preventDefault();
        changeLanguage('en', false);
        break;
      case '2':
        event.preventDefault();
        changeLanguage('ja', false);
        break;
      case '3':
        event.preventDefault();
        changeLanguage('zh-TW', false);
        break;
      case '4':
        event.preventDefault();
        changeLanguage(currentLanguage, true); // AUTO
        break;
      case 's':
      case 'S':
        event.preventDefault();
        document.getElementById('toggle-recording').click();
        break;
    }
  }
}

// 切換語言
function changeLanguage(lang, auto) {
  chrome.runtime.sendMessage({
    action: 'changeLanguage',
    language: lang,
    autoDetect: auto
  });

  currentLanguage = lang;
  autoDetect = auto;
  updateControlPanel();
}

// 載入設定
function loadSettings() {
  chrome.storage.sync.get(['language', 'autoDetect', 'subtitleStyle'], (result) => {
    if (result.language) {
      currentLanguage = result.language;
    }
    if (result.autoDetect !== undefined) {
      autoDetect = result.autoDetect;
    }
    if (result.subtitleStyle) {
      applySubtitleStyle(result.subtitleStyle);
    }

    updateControlPanel();
  });
}

// 套用字幕樣式
function applySubtitleStyle(style) {
  if (style.fontSize) {
    subtitleText.style.fontSize = style.fontSize;
  }
  if (style.fontFamily) {
    subtitleText.style.fontFamily = style.fontFamily;
  }
  if (style.color) {
    subtitleText.style.color = style.color;
  }
  if (style.backgroundColor) {
    subtitleText.style.backgroundColor = style.backgroundColor;
  }
  // TODO: 處理 position
}

// 初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

console.log('[Content] Content script 載入完成');
