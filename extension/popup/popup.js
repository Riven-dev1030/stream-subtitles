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

// API 設定相關元素
const apiSetup = document.getElementById('api-setup');
const apiStatus = document.getElementById('api-status');
const apiKeyInput = document.getElementById('api-key-input');
const saveApiKeyBtn = document.getElementById('save-api-key-btn');
const editApiKeyBtn = document.getElementById('edit-api-key-btn');
const deleteApiKeyBtn = document.getElementById('delete-api-key-btn');
const apiKeyMasked = document.getElementById('api-key-masked');

// 初始化
document.addEventListener('DOMContentLoaded', init);

function init() {
  console.log('[Popup] 初始化');

  // 載入 API key
  loadApiKey();

  // 載入當前狀態
  loadStatus();

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
  // API key 相關按鈕
  saveApiKeyBtn.addEventListener('click', saveApiKey);
  editApiKeyBtn.addEventListener('click', editApiKey);
  deleteApiKeyBtn.addEventListener('click', deleteApiKey);

  // API key 輸入框按 Enter 也可以儲存
  apiKeyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveApiKey();
    }
  });

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
}

// 開始錄音
function startRecording() {
  console.log('[Popup] 開始錄音');

  // 取得當前分頁
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.runtime.sendMessage({
        action: 'startCapture',
        tabId: tabs[0].id,
        language: currentLanguage,
        autoDetect: autoDetect
      }, (response) => {
        if (response.success) {
          isRecording = true;
          updateUI();
        } else {
          alert('啟動失敗: ' + response.error);
        }
      });
    }
  });
}

// 停止錄音
function stopRecording() {
  console.log('[Popup] 停止錄音');

  chrome.runtime.sendMessage({
    action: 'stopCapture'
  }, (response) => {
    if (response.success) {
      isRecording = false;
      updateUI();
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
// API Key 管理功能
// ============================================

// 載入 API key
function loadApiKey() {
  chrome.storage.local.get(['deepgramApiKey'], (result) => {
    if (result.deepgramApiKey) {
      // 已設定 API key
      displayApiKeyStatus(result.deepgramApiKey);
    } else {
      // 未設定 API key
      showApiKeySetup();
    }
  });
}

// 顯示 API key 設定界面
function showApiKeySetup() {
  apiSetup.classList.remove('hidden');
  apiStatus.classList.add('hidden');
  apiKeyInput.value = '';
}

// 顯示 API key 已設定狀態
function displayApiKeyStatus(apiKey) {
  apiSetup.classList.add('hidden');
  apiStatus.classList.remove('hidden');

  // 遮罩顯示 API key（只顯示開頭和結尾）
  const masked = maskApiKey(apiKey);
  apiKeyMasked.textContent = masked;
}

// 遮罩 API key
function maskApiKey(key) {
  if (!key || key.length < 8) {
    return '****';
  }

  const start = key.substring(0, 6);
  const end = key.substring(key.length - 4);
  return `${start}...${end}`;
}

// 儲存 API key
function saveApiKey() {
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    alert('請輸入 API key');
    return;
  }

  // 基本驗證（Deepgram API key 通常以特定格式開頭）
  if (apiKey.length < 20) {
    alert('API key 格式似乎不正確，請確認後再試');
    return;
  }

  // 儲存到 local storage（更安全，不會同步）
  chrome.storage.local.set({ deepgramApiKey: apiKey }, () => {
    console.log('[Popup] API key 已儲存');

    // 顯示成功訊息
    showToast('✅ API key 已儲存成功！');

    // 更新顯示
    displayApiKeyStatus(apiKey);

    // 通知 background script 重新載入 API key
    chrome.runtime.sendMessage({ action: 'reloadApiKey' });
  });
}

// 編輯 API key
function editApiKey() {
  chrome.storage.local.get(['deepgramApiKey'], (result) => {
    showApiKeySetup();

    // 顯示目前的 key（讓用戶可以修改）
    if (result.deepgramApiKey) {
      apiKeyInput.value = result.deepgramApiKey;
    }

    // 自動聚焦到輸入框
    apiKeyInput.focus();
    apiKeyInput.select();
  });
}

// 刪除 API key
function deleteApiKey() {
  if (!confirm('確定要刪除 API key 嗎？刪除後需要重新輸入才能使用字幕功能。')) {
    return;
  }

  chrome.storage.local.remove('deepgramApiKey', () => {
    console.log('[Popup] API key 已刪除');

    // 顯示提示訊息
    showToast('🗑️ API key 已刪除');

    // 顯示設定界面
    showApiKeySetup();

    // 如果正在錄音，停止錄音
    if (isRecording) {
      stopRecording();
    }

    // 通知 background script
    chrome.runtime.sendMessage({ action: 'reloadApiKey' });
  });
}

// 顯示 Toast 提示訊息
function showToast(message) {
  // 建立 toast 元素
  const toast = document.createElement('div');
  toast.className = 'toast-message';
  toast.textContent = message;
  document.body.appendChild(toast);

  // 顯示動畫
  setTimeout(() => {
    toast.classList.add('show');
  }, 100);

  // 3 秒後移除
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}

console.log('[Popup] Popup script 載入完成');
