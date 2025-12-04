// Stream Subtitles - Popup Script

let currentLanguage = 'en';
let autoDetect = false;
let isRecording = false;

// DOM 元素
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const langButtons = document.querySelectorAll('.lang-btn');
const correctionsList = document.getElementById('corrections-list');
const clearCorrectionsBtn = document.getElementById('clear-corrections-btn');

// API 設定相關元素已移除（不再需要 API key）

// 初始化
document.addEventListener('DOMContentLoaded', init);

function init() {
  console.log('[Popup] 初始化');

  // 載入當前狀態
  loadStatus();

  // 載入修正記錄
  loadCorrections();

  // 綁定事件
  bindEvents();
}

// 載入狀態
function loadStatus() {
  // 從 background 取得狀態
  chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
    if (response) {
      isRecording = response.isRecording;
      currentLanguage = response.currentLanguage;
      autoDetect = response.autoDetect;

      // 更新 UI
      updateUI();
    }
  });

  // 從 storage 載入設定
  chrome.storage.sync.get(['language', 'autoDetect'], (result) => {
    if (result.language) {
      currentLanguage = result.language;
    }
    if (result.autoDetect !== undefined) {
      autoDetect = result.autoDetect;
    }
    updateUI();
  });
}

// 綁定事件
function bindEvents() {
  // 語言按鈕
  langButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      const isAuto = lang === 'auto';

      if (!isAuto) {
        currentLanguage = lang;
      }
      autoDetect = isAuto;

      // 儲存設定
      chrome.storage.sync.set({
        language: currentLanguage,
        autoDetect: autoDetect
      });

      // 如果正在錄音，通知 background 切換語言
      if (isRecording) {
        chrome.runtime.sendMessage({
          action: 'changeLanguage',
          language: currentLanguage,
          autoDetect: autoDetect
        });
      }

      updateUI();
    });
  });

  // 開始按鈕
  startBtn.addEventListener('click', startRecording);

  // 停止按鈕
  stopBtn.addEventListener('click', stopRecording);

  // 清除修正記錄按鈕
  clearCorrectionsBtn.addEventListener('click', clearCorrections);

  // 快捷鍵區塊折疊
  const shortcutsHeader = document.querySelector('.shortcuts-section .collapsible-header');
  if (shortcutsHeader) {
    shortcutsHeader.addEventListener('click', () => {
      const section = document.querySelector('.shortcuts-section');
      section.classList.toggle('collapsed');
    });
  }
}

// 開始錄音
function startRecording() {
  console.log('[Popup] 開始錄音');

  // 取得當前分頁
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) {
      alert('❌ 無法找到當前分頁');
      return;
    }

    const tab = tabs[0];
    console.log('[Popup] 當前分頁 ID:', tab.id, 'URL:', tab.url);

    // 檢查是否為 Chrome 內部頁面
    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://'))) {
      alert('❌ 無法在 Chrome 內部頁面使用\n\n請在一般網頁（如 YouTube、Netflix）上使用此功能。');
      return;
    }

    // 直接發送訊息給 content script 開始錄音
    chrome.tabs.sendMessage(tab.id, {
      action: 'startRecording',
      language: currentLanguage,
      autoDetect: autoDetect
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[Popup] 發送訊息失敗:', chrome.runtime.lastError);
        alert('❌ 無法連接到頁面\n\n請重新整理頁面後再試。');
        return;
      }

      if (response && response.success) {
        isRecording = true;
        updateUI();
        console.log('[Popup] 錄音已啟動');
      } else {
        alert('❌ 啟動失敗\n\n請確認麥克風權限已開啟。');
      }
    });
  });
}

// 停止錄音
function stopRecording() {
  console.log('[Popup] 停止錄音');

  // 取得當前分頁
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'stopRecording'
      }, (response) => {
        if (!chrome.runtime.lastError) {
          isRecording = false;
          updateUI();
        }
      });
    }
  });
}

// 更新 UI
function updateUI() {
  // 更新狀態指示器
  if (isRecording) {
    statusIndicator.classList.add('recording');
    statusText.textContent = '錄音中...';
    startBtn.disabled = true;
    stopBtn.disabled = false;
  } else {
    statusIndicator.classList.remove('recording');
    statusText.textContent = '未啟動';
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }

  // 更新語言按鈕
  langButtons.forEach(btn => {
    btn.classList.remove('active');
  });

  if (autoDetect) {
    document.querySelector('[data-lang="auto"]').classList.add('active');
  } else {
    const activeLang = currentLanguage;
    const activeBtn = document.querySelector(`[data-lang="${activeLang}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
    }
  }
}

// ============================================
// API Key 管理功能已移除（使用 Web Speech API，無需 API key）
// ============================================
// 修正記錄管理功能
// ============================================

// 載入修正記錄
function loadCorrections() {
  chrome.storage.sync.get(['corrections'], (result) => {
    const corrections = result.corrections || [];
    displayCorrections(corrections);
  });
}

// 顯示修正記錄
function displayCorrections(corrections) {
  if (corrections.length === 0) {
    correctionsList.innerHTML = `
      <div class="empty-state">
        <p>還沒有修正記錄</p>
        <p class="small">點擊字幕旁的 ✏️ 按鈕來修正錯誤</p>
      </div>
    `;
    return;
  }

  // 按出現次數排序
  corrections.sort((a, b) => b.count - a.count);

  correctionsList.innerHTML = corrections.map(correction => `
    <div class="correction-item">
      <div class="correction-header">
        <span class="correction-wrong">${escapeHtml(correction.wrong)}</span>
        <span class="arrow">→</span>
        <span class="correction-correct">${escapeHtml(correction.correct)}</span>
      </div>
      <div class="correction-meta">
        <span class="count-badge">出現 ${correction.count} 次</span>
        <span class="lang-badge">${getLanguageName(correction.language)}</span>
        <button class="delete-correction-btn" data-wrong="${escapeHtml(correction.wrong)}">🗑️</button>
      </div>
    </div>
  `).join('');

  // 綁定刪除按鈕事件
  document.querySelectorAll('.delete-correction-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const wrong = e.target.dataset.wrong;
      deleteCorrection(wrong);
    });
  });
}

// 刪除單個修正
function deleteCorrection(wrongText) {
  chrome.storage.sync.get(['corrections'], (result) => {
    let corrections = result.corrections || [];
    corrections = corrections.filter(c => c.wrong !== wrongText);

    chrome.storage.sync.set({ corrections }, () => {
      console.log('[Popup] 已刪除修正:', wrongText);
      displayCorrections(corrections);

      // 通知 background 更新 keywords
      chrome.runtime.sendMessage({
        action: 'updateCorrections',
        corrections
      });
    });
  });
}

// 清除全部修正
function clearCorrections() {
  if (!confirm('確定要清除所有修正記錄嗎？')) {
    return;
  }

  chrome.storage.sync.set({ corrections: [] }, () => {
    console.log('[Popup] 已清除所有修正');
    displayCorrections([]);

    // 通知 background 更新 keywords
    chrome.runtime.sendMessage({
      action: 'updateCorrections',
      corrections: []
    });
  });
}

// HTML 轉義
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 取得語言名稱
function getLanguageName(langCode) {
  const names = {
    'en': 'EN',
    'ja': 'JP',
    'zh-TW': 'ZH',
    'zh': 'ZH'
  };
  return names[langCode] || langCode;
}

// ============================================
// Deepgram MVP 功能
// ============================================

// 初始化 Deepgram UI
function initDeepgramUI() {
  const toggleBtn = document.getElementById('deepgram-toggle');
  const content = document.querySelector('.deepgram-content');
  const saveKeyBtn = document.getElementById('save-deepgram-key');
  const apiKeyInput = document.getElementById('deepgram-api-key');
  const testBtn = document.getElementById('test-deepgram-btn');
  const keyStatus = document.getElementById('key-status');

  // 可折疊區域
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const isHidden = content.style.display === 'none';
      content.style.display = isHidden ? 'block' : 'none';
      toggleBtn.querySelector('.toggle-icon').textContent = isHidden ? '▲' : '▼';
    });
  }

  // 載入已儲存的 API Key
  chrome.storage.local.get(['deepgramApiKey'], (result) => {
    if (result.deepgramApiKey) {
      apiKeyInput.value = result.deepgramApiKey;
      keyStatus.textContent = '✅ API Key 已設定';
      keyStatus.style.color = '#28a745';
      testBtn.disabled = false;
    }
  });

  // 儲存 API Key
  if (saveKeyBtn) {
    saveKeyBtn.addEventListener('click', async () => {
      const apiKey = apiKeyInput.value.trim();

      if (!apiKey) {
        alert('請輸入 API Key');
        return;
      }

      // 儲存到 storage
      await chrome.storage.local.set({ deepgramApiKey: apiKey });

      keyStatus.textContent = '✅ API Key 已儲存';
      keyStatus.style.color = '#28a745';
      testBtn.disabled = false;

      // 通知 background script
      chrome.runtime.sendMessage({
        action: 'updateDeepgramKey',
        apiKey: apiKey
      });

      alert('API Key 已儲存成功！');
    });
  }

  // 測試連接
  if (testBtn) {
    testBtn.addEventListener('click', async () => {
      const apiKey = apiKeyInput.value.trim();

      if (!apiKey) {
        alert('請先輸入 API Key');
        return;
      }

      // 顯示測試中
      testBtn.disabled = true;
      testBtn.textContent = '🔄 測試中...';
      keyStatus.textContent = '測試連接中...';
      keyStatus.style.color = '#ffc107';

      // 請求 background script 測試
      chrome.runtime.sendMessage({
        action: 'testDeepgramConnection',
        apiKey: apiKey
      }, (response) => {
        testBtn.disabled = false;
        testBtn.textContent = '🧪 測試 Deepgram 連接';

        if (response && response.success) {
          keyStatus.textContent = '✅ 連接成功！';
          keyStatus.style.color = '#28a745';
          alert('Deepgram 連接測試成功！');
        } else {
          keyStatus.textContent = '❌ 連接失敗';
          keyStatus.style.color = '#dc3545';
          alert(`連接失敗：${response?.error || '未知錯誤'}`);
        }
      });
    });
  }

  // 監聽輸入變化
  if (apiKeyInput) {
    apiKeyInput.addEventListener('input', () => {
      const hasValue = apiKeyInput.value.trim().length > 0;
      testBtn.disabled = !hasValue;
    });
  }
}

// 在 init 函數中添加
document.addEventListener('DOMContentLoaded', () => {
  init();
  initDeepgramUI();
});
console.log('[Popup] Popup script 載入完成');
