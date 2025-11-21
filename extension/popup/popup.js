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
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (!tabs || tabs.length === 0) {
      alert('❌ 無法找到當前分頁');
      return;
    }

    const tab = tabs[0];
    console.log('[Popup] 當前分頁 ID:', tab.id, 'URL:', tab.url);

    // 檢查是否為 Chrome 內部頁面
    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://'))) {
      alert('❌ 無法擷取 Chrome 內部頁面\n\n請在一般網頁（如 YouTube、Netflix）上使用此功能。');
      return;
    }

    try {
      // 在 popup 中獲取 stream ID（需要用戶手勢上下文）
      console.log('[Popup] 獲取 stream ID，targetTabId:', tab.id);

      const streamId = await chrome.tabCapture.getMediaStreamId({
        targetTabId: tab.id
      });

      console.log('[Popup] 已獲取 stream ID:', streamId);

      if (!streamId || streamId === '') {
        console.error('[Popup] stream ID 為空');
        alert('❌ 無法獲取音訊權限\n\n可能原因：\n1. 分頁沒有正在播放音訊\n2. 瀏覽器已阻止權限請求\n3. 請重新整理分頁後再試\n\n提示：請確保分頁有音訊正在播放。');
        return;
      }

        // 將 stream ID 傳給 background
        chrome.runtime.sendMessage({
          action: 'startCapture',
          streamId: streamId,
          language: currentLanguage,
          autoDetect: autoDetect
        }, (response) => {
          if (response && response.success) {
            isRecording = true;
            updateUI();
          } else {
            const errorMsg = response?.error || '未知錯誤';
            console.error('[Popup] 啟動失敗:', errorMsg);

            // 根據錯誤類型提供不同的提示
            if (errorMsg.includes('Permission') || errorMsg.includes('NotAllowed')) {
              alert('❌ 權限被拒絕\n\n請在彈出的對話框中點擊「允許」來授予音訊擷取權限。\n\n如果沒有看到對話框，請檢查瀏覽器的權限設定。');
            } else if (errorMsg.includes('API key')) {
              alert('❌ ' + errorMsg);
            } else {
              alert('❌ 啟動失敗: ' + errorMsg);
            }
          }
        });
      } catch (error) {
        console.error('[Popup] 獲取 stream ID 失敗:', error);
        console.error('[Popup] 錯誤詳情 - name:', error.name, 'message:', error.message);

        // 根據錯誤類型提供友善的提示訊息
        if (error.name === 'NotAllowedError' || error.message.includes('dismissed') || error.message.includes('denied')) {
          alert('❌ 您拒絕了音訊擷取權限\n\n要使用即時字幕功能，請：\n1. 重新點擊「開始」按鈕\n2. 在彈出的對話框中點擊「允許」\n\n這個擴充功能需要擷取分頁音訊才能產生字幕。');
        } else if (error.name === 'NotFoundError') {
          alert('❌ 找不到音訊源\n\n請確認：\n1. 分頁有正在播放音訊\n2. 音訊未被靜音');
        } else {
          alert('❌ 無法啟動錄音\n\n錯誤: ' + error.message + '\n\n請重新整理分頁後再試一次。');
        }
      }
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

console.log('[Popup] Popup script 載入完成');
