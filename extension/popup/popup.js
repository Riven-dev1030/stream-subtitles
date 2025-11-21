// Stream Subtitles - Popup Script

let currentLanguage = 'en';
let autoDetect = false;
let isRecording = false;

// DOM 元素
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const apiNotice = document.getElementById('api-notice');
const langButtons = document.querySelectorAll('.lang-btn');

// 初始化
document.addEventListener('DOMContentLoaded', init);

function init() {
  console.log('[Popup] 初始化');

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

      // 檢查 API key
      if (!response.hasApiKey) {
        apiNotice.classList.remove('hidden');
      } else {
        apiNotice.classList.add('hidden');
      }
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

console.log('[Popup] Popup script 載入完成');
