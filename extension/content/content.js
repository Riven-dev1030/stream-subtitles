// Stream Subtitles - Content Script
// 在網頁上顯示字幕覆蓋層

let subtitleContainer = null;
let subtitleText = null;
let controlPanel = null;
let isVisible = false;
let currentSubtitle = '';
let interimSubtitle = '';
let subtitleHistory = []; // 儲存字幕歷史
let editModal = null; // 編輯視窗

// 安全的訊息發送函數（處理 Extension context invalidated 錯誤）
function safeSendMessage(message, callback) {
  try {
    chrome.runtime.sendMessage(message, (response) => {
      // 檢查是否有 runtime 錯誤
      if (chrome.runtime.lastError) {
        console.warn('[Content] 訊息發送失敗:', chrome.runtime.lastError.message);
        // 如果是 context invalidated，表示擴充功能已重新載入
        if (chrome.runtime.lastError.message.includes('Extension context invalidated')) {
          console.log('[Content] 擴充功能已重新載入，請重新整理頁面');
        }
        if (callback) callback({ success: false, error: chrome.runtime.lastError.message });
        return;
      }
      if (callback) callback(response);
    });
  } catch (error) {
    console.error('[Content] 發送訊息時發生錯誤:', error);
    if (callback) callback({ success: false, error: error.message });
  }
}

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
      safeSendMessage({
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

    // 儲存到歷史記錄
    const subtitleEntry = {
      id: Date.now(),
      text: text,
      timestamp: new Date().toISOString(),
      language: currentLanguage
    };
    subtitleHistory.push(subtitleEntry);

    // 只保留最近 50 條
    if (subtitleHistory.length > 50) {
      subtitleHistory.shift();
    }

    // 儲存到 storage
    saveSubtitleHistory();
  } else {
    // 暫時結果
    interimSubtitle = text;
  }

  // 組合顯示
  const displayText = currentSubtitle + (interimSubtitle ? ' ' + interimSubtitle : '');

  // 更新字幕並加入編輯按鈕
  if (isFinal && currentSubtitle) {
    subtitleText.innerHTML = `
      <span class="subtitle-content">${escapeHtml(displayText)}</span>
      <button class="edit-subtitle-btn" title="修正字幕">✏️</button>
    `;

    // 綁定編輯按鈕事件
    const editBtn = subtitleText.querySelector('.edit-subtitle-btn');
    editBtn.addEventListener('click', () => openEditModal(currentSubtitle, subtitleHistory[subtitleHistory.length - 1].id));
  } else {
    subtitleText.textContent = displayText;
  }

  // 顯示字幕容器
  showSubtitleUI();

  // 如果是最終結果，5 秒後清除舊字幕
  if (isFinal) {
    setTimeout(() => {
      if (subtitleText.querySelector('.subtitle-content')?.textContent === displayText) {
        currentSubtitle = '';
        if (!interimSubtitle) {
          subtitleText.textContent = '';
        }
      }
    }, 5000);
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
  safeSendMessage({
    action: 'startCapture',
    language: currentLanguage,
    autoDetect: autoDetect
  }, (response) => {
    if (response && response.success) {
      console.log('[Content] 開始錄音');
    } else {
      alert('錄音失敗: ' + (response?.error || '未知錯誤'));
    }
  });
}

// 停止錄音
function stopRecording() {
  safeSendMessage({
    action: 'stopCapture'
  }, (response) => {
    if (response && response.success) {
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
  safeSendMessage({
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

// HTML 轉義
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 開啟編輯視窗
function openEditModal(originalText, subtitleId) {
  // 如果視窗不存在，先建立
  if (!editModal) {
    createEditModal();
  }

  // 填入原始文字
  const textarea = editModal.querySelector('#edit-subtitle-input');
  textarea.value = originalText;
  textarea.dataset.subtitleId = subtitleId;
  textarea.dataset.originalText = originalText;

  // 顯示視窗
  editModal.style.display = 'flex';
  textarea.focus();
  textarea.select();
}

// 建立編輯視窗
function createEditModal() {
  editModal = document.createElement('div');
  editModal.id = 'stream-subtitle-edit-modal';
  editModal.innerHTML = `
    <div class="edit-modal-content">
      <h3>✏️ 修正字幕</h3>
      <div class="edit-form">
        <label>原始文字：</label>
        <div id="edit-original-text" class="original-text"></div>

        <label>修正為：</label>
        <textarea id="edit-subtitle-input" rows="3" placeholder="輸入正確的文字..."></textarea>

        <div class="edit-buttons">
          <button id="save-correction-btn" class="primary">💾 儲存修正</button>
          <button id="cancel-edit-btn" class="secondary">取消</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(editModal);

  // 綁定按鈕事件
  editModal.querySelector('#save-correction-btn').addEventListener('click', saveCorrection);
  editModal.querySelector('#cancel-edit-btn').addEventListener('click', () => {
    editModal.style.display = 'none';
  });

  // 點擊背景關閉
  editModal.addEventListener('click', (e) => {
    if (e.target === editModal) {
      editModal.style.display = 'none';
    }
  });

  // ESC 關閉
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && editModal.style.display === 'flex') {
      editModal.style.display = 'none';
    }
  });
}

// 儲存修正
function saveCorrection() {
  const textarea = editModal.querySelector('#edit-subtitle-input');
  const subtitleId = parseInt(textarea.dataset.subtitleId);
  const originalText = textarea.dataset.originalText;
  const correctedText = textarea.value.trim();

  if (!correctedText || correctedText === originalText) {
    editModal.style.display = 'none';
    return;
  }

  // 更新字幕歷史
  const subtitle = subtitleHistory.find(s => s.id === subtitleId);
  if (subtitle) {
    subtitle.corrected = correctedText;
    subtitle.original = originalText;
  }

  // 儲存修正記錄
  chrome.storage.sync.get(['corrections'], (result) => {
    const corrections = result.corrections || [];

    // 查找是否已有相同的修正
    const existingIndex = corrections.findIndex(c => c.wrong === originalText);

    if (existingIndex >= 0) {
      // 更新現有記錄
      corrections[existingIndex].correct = correctedText;
      corrections[existingIndex].count++;
      corrections[existingIndex].lastSeen = new Date().toISOString();
    } else {
      // 新增修正記錄
      corrections.push({
        wrong: originalText,
        correct: correctedText,
        count: 1,
        language: currentLanguage,
        createdAt: new Date().toISOString(),
        lastSeen: new Date().toISOString()
      });
    }

    // 儲存
    chrome.storage.sync.set({ corrections }, () => {
      console.log('[Content] 修正已儲存:', originalText, '→', correctedText);

      // 通知 background 更新 keywords
      safeSendMessage({
        action: 'updateCorrections',
        corrections
      });

      // 顯示成功提示
      showToast('✅ 修正已儲存！');
    });
  });

  // 儲存歷史
  saveSubtitleHistory();

  // 關閉視窗
  editModal.style.display = 'none';
}

// 儲存字幕歷史
function saveSubtitleHistory() {
  chrome.storage.local.set({ subtitleHistory }, () => {
    console.log('[Content] 字幕歷史已儲存');
  });
}

// 顯示提示訊息
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'subtitle-toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// 載入字幕歷史
function loadSubtitleHistory() {
  chrome.storage.local.get(['subtitleHistory'], (result) => {
    if (result.subtitleHistory) {
      subtitleHistory = result.subtitleHistory;
    }
  });
}

// 初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// 載入歷史記錄
loadSubtitleHistory();

console.log('[Content] Content script 載入完成');
