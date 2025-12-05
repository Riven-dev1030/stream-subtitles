// Stream Subtitles - Popup Script

let currentLanguage = 'en';
let autoDetect = false;
let isRecording = false;
let currentEngine = 'webspeech'; // 'webspeech' 或 'deepgram'
let hasDeepgramApiKey = false;

// DOM 元素
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const langButtons = document.querySelectorAll('.lang-btn');
const engineButtons = document.querySelectorAll('.engine-btn');
const engineStatus = document.getElementById('engine-status');
const deepgramEngineBtn = document.getElementById('deepgram-engine-btn');
const correctionsList = document.getElementById('corrections-list');
const clearCorrectionsBtn = document.getElementById('clear-corrections-btn');

// API 設定相關元素已移除（不再需要 API key）

// 初始化
document.addEventListener('DOMContentLoaded', init);

async function init() {
  console.log('[Popup] 初始化');

  // 載入當前狀態
  loadStatus();

  // 載入修正記錄
  loadCorrections();

  // 載入引擎設定
  await loadEngineSettings();

  // 綁定事件
  bindEvents();

  // 初始化 Deepgram UI
  await initDeepgramUI();

  // 開始狀態輪詢
  startStatusPolling();
}

// 當 popup 關閉時清理資源
window.addEventListener('unload', () => {
  stopStatusPolling();
});

// 載入狀態
function loadStatus() {
  // 從 background 取得狀態
  chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
    if (response) {
      const oldIsRecording = isRecording;
      isRecording = response.isRecording;
      currentLanguage = response.currentLanguage;
      autoDetect = response.autoDetect;

      // 同步引擎狀態
      if (response.currentEngine) {
        currentEngine = response.currentEngine;
      }

      // 添加日誌以診斷狀態同步問題
      console.log('[Popup] loadStatus:', {
        isRecording: response.isRecording,
        isDeepgramActive: response.isDeepgramActive,
        currentEngine: response.currentEngine,
        changed: oldIsRecording !== isRecording
      });

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

// 定期更新狀態（每秒檢查一次）
let statusUpdateInterval = null;

function startStatusPolling() {
  // 清除舊的定時器
  if (statusUpdateInterval) {
    clearInterval(statusUpdateInterval);
  }

  // 每秒更新一次狀態
  statusUpdateInterval = setInterval(() => {
    chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
      if (response) {
        const oldIsRecording = isRecording;
        const oldEngine = currentEngine;
        isRecording = response.isRecording;

        // 同步引擎狀態
        if (response.currentEngine) {
          currentEngine = response.currentEngine;
        }

        // 在狀態或引擎改變時更新 UI
        if (oldIsRecording !== isRecording || oldEngine !== currentEngine) {
          console.log('[Popup] 狀態改變:', {
            錄音: isRecording ? '錄音中' : '已停止',
            引擎: currentEngine
          });
          updateUI();
        }
      }
    });
  }, 1000);
}

function stopStatusPolling() {
  if (statusUpdateInterval) {
    clearInterval(statusUpdateInterval);
    statusUpdateInterval = null;
  }
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

  // 引擎選擇按鈕
  engineButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const engine = btn.dataset.engine;

      // 如果選擇 Deepgram 但沒有 API Key，提示用戶
      if (engine === 'deepgram' && !hasDeepgramApiKey) {
        alert('⚠️ 請先設定 Deepgram API Key\n\n請在下方「⚡ Deepgram」區塊中輸入您的 API Key');
        // 展開 Deepgram 設定區塊
        const deepgramToggle = document.getElementById('deepgram-toggle');
        if (deepgramToggle) {
          deepgramToggle.click();
        }
        return;
      }

      currentEngine = engine;

      // 儲存設定
      chrome.storage.sync.set({
        recognitionEngine: currentEngine
      });

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
  console.log('[Popup] 開始錄音，引擎:', currentEngine);

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

    // 根據引擎類型選擇不同的啟動方式
    if (currentEngine === 'deepgram') {
      // 使用 Deepgram：發送訊息到 Service Worker
      chrome.runtime.sendMessage({
        action: 'startDeepgramRecognition',
        tabId: tab.id,
        language: currentLanguage
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[Popup] 啟動 Deepgram 失敗:', chrome.runtime.lastError);
          alert('❌ 啟動 Deepgram 失敗\n\n' + chrome.runtime.lastError.message);
          return;
        }

        if (response && response.success) {
          isRecording = true;
          updateUI();
          console.log('[Popup] ✅ Deepgram 已啟動，字幕將會顯示在頁面上');
        } else {
          console.error('[Popup] ❌ Deepgram 啟動失敗:', response?.error || '未知錯誤');
          alert('❌ 啟動失敗\n\n' + (response?.error || '未知錯誤'));
        }
      });
    } else {
      // 使用 Web Speech API：發送訊息給 Content Script
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
          console.log('[Popup] Web Speech API 已啟動');
        } else {
          alert('❌ 啟動失敗\n\n請確認麥克風權限已開啟。');
        }
      });
    }
  });
}

// 停止錄音
function stopRecording() {
  console.log('[Popup] 停止錄音，引擎:', currentEngine);

  if (currentEngine === 'deepgram') {
    // 停止 Deepgram：發送訊息到 Service Worker
    chrome.runtime.sendMessage({
      action: 'stopDeepgramRecognition'
    }, (response) => {
      if (response && response.success) {
        isRecording = false;
        updateUI();
        console.log('[Popup] Deepgram 已停止');
      }
    });
  } else {
    // 停止 Web Speech API：發送訊息給 Content Script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'stopRecording'
        }, (response) => {
          if (!chrome.runtime.lastError) {
            isRecording = false;
            updateUI();
            console.log('[Popup] Web Speech API 已停止');
          }
        });
      }
    });
  }
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

  // 更新引擎按鈕
  engineButtons.forEach(btn => {
    btn.classList.remove('active');
  });
  const activeEngineBtn = document.querySelector(`[data-engine="${currentEngine}"]`);
  if (activeEngineBtn) {
    activeEngineBtn.classList.add('active');
  }

  // 更新引擎狀態文字
  const engineNames = {
    'webspeech': 'Web Speech API',
    'deepgram': 'Deepgram'
  };
  if (engineStatus) {
    engineStatus.textContent = `目前使用：${engineNames[currentEngine] || currentEngine}`;
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
// 引擎設定
// ============================================

/**
 * 載入引擎設定
 */
async function loadEngineSettings() {
  // 從 storage 載入引擎設定（使用 Promise 以正確等待）
  const result = await new Promise((resolve) => {
    chrome.storage.sync.get(['recognitionEngine'], resolve);
  });

  if (result.recognitionEngine) {
    currentEngine = result.recognitionEngine;
    console.log('[Popup] 從 storage 載入引擎:', currentEngine);
  }

  // 檢查是否有 Deepgram API Key
  try {
    const crypto = window.cryptoManager;
    await crypto.initialize();
    const apiKey = await crypto.getApiKey();
    hasDeepgramApiKey = !!apiKey;

    // 更新 Deepgram 按鈕狀態
    if (!hasDeepgramApiKey) {
      deepgramEngineBtn.classList.add('disabled');
      deepgramEngineBtn.title = '需要設定 API Key';
    } else {
      deepgramEngineBtn.classList.remove('disabled');
      deepgramEngineBtn.title = 'Deepgram - 更高精度';
    }
  } catch (error) {
    console.error('[Popup] 檢查 Deepgram API Key 失敗:', error);
    hasDeepgramApiKey = false;
  }

  // 在所有設定載入完成後更新 UI
  updateUI();
}

// ============================================
// Deepgram MVP 功能
// ============================================

// 初始化 Deepgram UI（使用加密）
async function initDeepgramUI() {
  const toggleBtn = document.getElementById('deepgram-toggle');
  const content = document.querySelector('.deepgram-content');
  const saveKeyBtn = document.getElementById('save-deepgram-key');
  const apiKeyInput = document.getElementById('deepgram-api-key');
  const testBtn = document.getElementById('test-deepgram-btn');
  const keyStatus = document.getElementById('key-status');
  const clearKeyBtn = document.createElement('button');

  // 初始化加密管理器
  const crypto = window.cryptoManager;
  await crypto.initialize();

  // 可折疊區域
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const isHidden = content.style.display === 'none';
      content.style.display = isHidden ? 'block' : 'none';
      toggleBtn.querySelector('.toggle-icon').textContent = isHidden ? '▲' : '▼';
    });
  }

  // 載入已儲存的 API Key（加密版本）
  try {
    const apiKey = await crypto.getApiKey();

    if (apiKey) {
      // 顯示遮罩版本
      apiKeyInput.value = crypto.maskApiKey(apiKey);
      apiKeyInput.setAttribute('data-masked', 'true');
      apiKeyInput.type = 'text';

      keyStatus.textContent = '✅ API Key 已設定（🔒加密）';
      keyStatus.style.color = '#28a745';
      testBtn.disabled = false;

      // 添加清除按鈕
      clearKeyBtn.textContent = '🗑️ 清除';
      clearKeyBtn.className = 'small-btn';
      clearKeyBtn.style.marginLeft = '5px';
      saveKeyBtn.parentElement.appendChild(clearKeyBtn);
    }
  } catch (error) {
    console.error('[Popup] 載入 API Key 失敗:', error);
  }

  // 輸入框獲得焦點時清除遮罩
  apiKeyInput.addEventListener('focus', () => {
    if (apiKeyInput.getAttribute('data-masked') === 'true') {
      apiKeyInput.value = '';
      apiKeyInput.type = 'password';
      apiKeyInput.removeAttribute('data-masked');
      apiKeyInput.placeholder = '輸入新的 API Key 或留空保留現有';
    }
  });

  // 儲存 API Key（加密）
  saveKeyBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      alert('請輸入 API Key');
      return;
    }

    // 驗證格式
    if (!crypto.validateApiKeyFormat(apiKey)) {
      alert('API Key 格式無效，請檢查');
      return;
    }

    try {
      saveKeyBtn.disabled = true;
      saveKeyBtn.textContent = '💾 儲存中...';

      // 使用加密管理器儲存
      await crypto.saveApiKey(apiKey);

      // 更新 UI
      apiKeyInput.value = crypto.maskApiKey(apiKey);
      apiKeyInput.setAttribute('data-masked', 'true');
      apiKeyInput.type = 'text';

      keyStatus.textContent = '✅ API Key 已加密儲存';
      keyStatus.style.color = '#28a745';
      testBtn.disabled = false;

      // 添加清除按鈕
      if (!clearKeyBtn.parentElement) {
        saveKeyBtn.parentElement.appendChild(clearKeyBtn);
      }

      chrome.runtime.sendMessage({ action: 'updateDeepgramKey' });

      alert('API Key 已加密儲存！\n\n🔒 使用 AES-GCM-256 加密');

      // 重新載入引擎設定（更新 Deepgram 按鈕狀態）
      await loadEngineSettings();

    } catch (error) {
      alert(`儲存失敗：${error.message}`);
    } finally {
      saveKeyBtn.disabled = false;
      saveKeyBtn.textContent = '💾 儲存';
    }
  });

  // 清除 API Key
  clearKeyBtn.addEventListener('click', async () => {
    if (!confirm('確定要清除 API Key 嗎？')) {
      return;
    }

    try {
      await crypto.clearApiKey();

      apiKeyInput.value = '';
      apiKeyInput.type = 'password';
      apiKeyInput.placeholder = '輸入 Deepgram API Key';
      apiKeyInput.removeAttribute('data-masked');

      keyStatus.textContent = '未設定 API Key';
      keyStatus.style.color = '#666';
      testBtn.disabled = true;

      clearKeyBtn.remove();
      alert('API Key 已清除');
    } catch (error) {
      alert(`清除失敗：${error.message}`);
    }
  });

  // 測試連接
  testBtn.addEventListener('click', async () => {
    try {
      const apiKey = await crypto.getApiKey();

      if (!apiKey) {
        alert('請先儲存 API Key');
        return;
      }

      testBtn.disabled = true;
      testBtn.textContent = '🔄 測試中...';
      keyStatus.textContent = '測試連接中...';
      keyStatus.style.color = '#ffc107';

      chrome.runtime.sendMessage({
        action: 'testDeepgramConnection'
      }, (response) => {
        testBtn.disabled = false;
        testBtn.textContent = '🧪 測試 Deepgram 連接';

        if (response && response.success) {
          keyStatus.textContent = '✅ 連接成功！';
          keyStatus.style.color = '#28a745';
          alert('Deepgram 連接測試成功！✅');
        } else {
          keyStatus.textContent = '❌ 連接失敗';
          keyStatus.style.color = '#dc3545';
          alert(`連接失敗：${response?.error || '未知錯誤'}`);
        }
      });
    } catch (error) {
      testBtn.disabled = false;
      testBtn.textContent = '🧪 測試 Deepgram 連接';
      alert(`測試失敗：${error.message}`);
    }
  });

  // 監聽輸入變化
  apiKeyInput.addEventListener('input', () => {
    const hasValue = apiKeyInput.value.trim().length > 0;
    const isMasked = apiKeyInput.getAttribute('data-masked') === 'true';
    testBtn.disabled = !(hasValue || isMasked);
  });
}

console.log('[Popup] Popup script 載入完成');
