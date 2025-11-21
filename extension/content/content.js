// Stream Subtitles - Content Script
// 直接在網頁上使用 Web Speech API 進行語音辨識和字幕顯示

let subtitleContainer = null;
let subtitleText = null;
let controlPanel = null;
let isVisible = false;
let currentSubtitle = '';
let interimSubtitle = '';
let subtitleHistory = []; // 儲存字幕歷史
let editModal = null; // 編輯視窗

// 顯示緩衝區 - 保存最近的句子用於滾動顯示
let displayBuffer = []; // 最多保存 3 句
const MAX_DISPLAY_SENTENCES = 3;
const MAX_CHARS_PER_LINE = 15; // 每行最多 15 字元（依用戶建議調整）
const MAX_TOTAL_CHARS = 50; // 總共最多 50 字元，超過就清理

// 上一次的辨識文字（用於檢測增量）
let lastTranscript = '';
let lastFinalTranscript = ''; // 上一次的 final 結果，用於避免重複
let lastResultTimestamp = Date.now(); // 上次收到結果的時間，用於檢測卡住

// Web Speech API
let recognition = null;
let isRecording = false;
let currentLanguage = 'en';
let autoDetect = false;
let heartbeatTimer = null; // 心跳檢測計時器
const HEARTBEAT_INTERVAL = 2000; // 2秒檢測一次（從5秒提高頻率）
const HEARTBEAT_TIMEOUT = 5000; // 5秒無結果就重啟（從10秒縮短）

// 檢查瀏覽器支援
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const isSpeechRecognitionSupported = !!SpeechRecognition;

// 語言設定
const languages = {
  en: { code: 'en-US', name: 'English', flag: '🇬🇧' },
  ja: { code: 'ja-JP', name: '日本語', flag: '🇯🇵' },
  'zh-TW': { code: 'zh-TW', name: '繁體中文', flag: '🇹🇼' }
};

// 初始化
function init() {
  console.log('[Content] 字幕腳本已載入');

  // 檢查瀏覽器支援
  if (!isSpeechRecognitionSupported) {
    console.error('[Content] 瀏覽器不支援 Web Speech API');
    return;
  }

  // 建立 UI
  createSubtitleUI();

  // 從 storage 載入設定
  loadSettings();

  // 監聽來自 popup 的訊息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Content] 收到訊息:', message.action);

    switch (message.action) {
      case 'startRecording':
        startRecording(message.language, message.autoDetect);
        sendResponse({ success: true });
        break;

      case 'stopRecording':
        stopRecording();
        sendResponse({ success: true });
        break;

      case 'changeLanguage':
        changeLanguage(message.language, message.autoDetect);
        sendResponse({ success: true });
        break;

      case 'getStatus':
        sendResponse({
          isRecording,
          currentLanguage,
          autoDetect
        });
        break;

      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }

    return true; // 保持訊息通道開啟
  });

  // 鍵盤快捷鍵
  document.addEventListener('keydown', handleKeyboardShortcut);
}

// 開始錄音
function startRecording(language = 'en', autoDetectMode = false) {
  console.log('[Content] 開始語音辨識，語言:', language);

  // 如果已經在錄音，先停止
  if (isRecording) {
    stopRecording();
  }

  try {
    currentLanguage = language;
    autoDetect = autoDetectMode;

    // 初始化 SpeechRecognition
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = languages[language]?.code || 'en-US';
    recognition.maxAlternatives = 1;

    console.log('[Content] 使用語言代碼:', recognition.lang);

    // 當有辨識結果時
    recognition.onresult = (event) => {
      handleSpeechResult(event);
    };

    // 開始時
    recognition.onstart = () => {
      console.log('[Content] 語音辨識已啟動');
      isRecording = true;
      updateControlPanel();
      showSubtitleUI();
    };

    // 結束時自動重啟（保持持續辨識）
    recognition.onend = () => {
      console.log('[Content] 語音辨識結束');
      if (isRecording) {
        console.log('[Content] 自動重啟語音辨識');
        try {
          recognition.start();
        } catch (err) {
          console.error('[Content] 無法重啟語音辨識:', err);
        }
      }
    };

    // 錯誤處理
    recognition.onerror = (event) => {
      console.error('[Content] 語音辨識錯誤:', event.error);

      // 處理特定錯誤
      if (event.error === 'not-allowed') {
        showToast('❌ 麥克風權限被拒絕，請允許使用麥克風');
        stopRecording();
      } else if (event.error === 'no-speech') {
        console.log('[Content] 未偵測到語音，繼續監聽...');
      } else if (event.error === 'network') {
        showToast('❌ 網路錯誤，請檢查網路連線');
      } else {
        showToast(`❌ 辨識錯誤: ${event.error}`);
      }
    };

    // 開始語音辨識
    recognition.start();
    console.log('[Content] 語音辨識啟動中...');

    // 啟動心跳檢測
    startHeartbeat();

  } catch (error) {
    console.error('[Content] 啟動失敗:', error);
    showToast('❌ 啟動失敗: ' + error.message);
  }
}

// 停止錄音
function stopRecording() {
  console.log('[Content] 停止語音辨識');

  if (recognition) {
    try {
      recognition.stop();
    } catch (err) {
      console.error('[Content] 停止語音辨識失敗:', err);
    }
    recognition = null;
  }

  isRecording = false;
  stopHeartbeat(); // 停止心跳檢測
  updateControlPanel();
}

// 切換語言
function changeLanguage(language, autoDetectMode) {
  console.log('[Content] 切換語言:', language);

  currentLanguage = language;
  autoDetect = autoDetectMode;

  // 如果正在錄音，重新啟動
  if (isRecording) {
    stopRecording();
    setTimeout(() => {
      startRecording(language, autoDetectMode);
    }, 500);
  } else {
    updateControlPanel();
  }
}

// 處理語音辨識結果
function handleSpeechResult(event) {
  try {
    // 更新最後收到結果的時間（用於心跳檢測）
    lastResultTimestamp = Date.now();

    // 取得最新的辨識結果
    const lastResultIndex = event.results.length - 1;
    const result = event.results[lastResultIndex];

    if (result && result[0]) {
      const transcript = result[0].transcript;
      const isFinal = result.isFinal;
      const confidence = result[0].confidence;

      console.log('[Content] 辨識結果:', transcript, isFinal ? '(final)' : '(interim)', 'confidence:', confidence);

      // 顯示字幕
      displaySubtitle(transcript, isFinal);
    }
  } catch (error) {
    console.error('[Content] 處理語音辨識結果失敗:', error);
  }
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
      <button id="toggle-subtitle" class="toggle-btn" title="顯示/隱藏字幕">👁️</button>
      <button id="start-recording" class="start-btn" title="開始/停止錄音">▶️</button>
    </div>
    <div class="status-indicator">
      <span class="status-dot"></span>
      <span class="status-text">未啟動</span>
    </div>
  `;
  document.body.appendChild(controlPanel);

  // 字幕容器
  subtitleContainer = document.createElement('div');
  subtitleContainer.id = 'stream-subtitle-container';
  subtitleContainer.innerHTML = `
    <div class="subtitle-content">
      <div class="subtitle-text"></div>
      <button class="edit-btn" title="修正字幕">✏️</button>
    </div>
  `;
  document.body.appendChild(subtitleContainer);

  subtitleText = subtitleContainer.querySelector('.subtitle-text');

  // 綁定事件
  bindControlEvents();
}

// 綁定控制面板事件
function bindControlEvents() {
  // 語言按鈕
  const langButtons = controlPanel.querySelectorAll('.lang-btn');
  langButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      changeLanguage(lang, false);

      // 更新按鈕狀態
      langButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // 儲存設定
      chrome.storage.sync.set({ language: lang, autoDetect: false });
    });
  });

  // 開始/停止按鈕
  const startBtn = controlPanel.querySelector('#start-recording');
  startBtn.addEventListener('click', () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording(currentLanguage, autoDetect);
    }
  });

  // 顯示/隱藏按鈕
  const toggleBtn = controlPanel.querySelector('#toggle-subtitle');
  toggleBtn.addEventListener('click', () => {
    if (isVisible) {
      hideSubtitleUI();
    } else {
      showSubtitleUI();
    }
  });

  // 編輯按鈕 - 編輯最新的一句話
  const editBtn = subtitleContainer.querySelector('.edit-btn');
  editBtn.addEventListener('click', () => {
    // 取得最新的句子
    if (displayBuffer.length > 0) {
      const latestSentence = displayBuffer[displayBuffer.length - 1].text;
      showEditModal(latestSentence);
    }
  });
}

// 更新控制面板狀態
function updateControlPanel() {
  const statusDot = controlPanel.querySelector('.status-dot');
  const statusText = controlPanel.querySelector('.status-text');
  const startBtn = controlPanel.querySelector('#start-recording');

  if (isRecording) {
    statusDot.classList.add('recording');
    statusText.textContent = '錄音中';
    startBtn.textContent = '⏹️';
    startBtn.classList.add('recording');
  } else {
    statusDot.classList.remove('recording');
    statusText.textContent = '未啟動';
    startBtn.textContent = '▶️';
    startBtn.classList.remove('recording');
  }
}

// 規範化文字用於比對（去除空白、統一格式）
function normalizeText(text) {
  return text.trim().replace(/\s+/g, ' ');
}

// 顯示字幕
function displaySubtitle(text, isFinal) {
  if (!text) return;

  if (isFinal) {
    console.log('[Content] === Final 結果 ===');
    console.log('[Content] 原始文字 (', text.length, '字):', text);

    const normalized = normalizeText(text);

    // 改進的重複檢測：檢查是否和上一次的 final 完全相同
    if (normalized === lastFinalTranscript) {
      console.log('[Content] ❌ 和上一次 final 結果相同，跳過');
      return;
    }

    // 額外檢查：如果新文字包含在上一次的文字中，或上一次的文字包含在新文字中
    // 這可能是 API 的累積發送，取較長的那個
    if (lastFinalTranscript && (normalized.includes(lastFinalTranscript) || lastFinalTranscript.includes(normalized))) {
      console.log('[Content] ⚠️ 偵測到累積文字');
      console.log('[Content] 上次:', lastFinalTranscript.substring(0, 30) + '...');
      console.log('[Content] 本次:', normalized.substring(0, 30) + '...');

      // 如果新文字更短或相同，跳過（可能是重複）
      if (normalized.length <= lastFinalTranscript.length) {
        console.log('[Content] ❌ 新文字較短或相同，跳過');
        return;
      }

      // 如果新文字更長，提取新增的部分
      const newPart = normalized.replace(lastFinalTranscript, '').trim();
      if (newPart.length < 2) {
        console.log('[Content] ❌ 新增部分太短，跳過');
        return;
      }
      console.log('[Content] ✅ 提取新增部分:', newPart);
    }

    // 更新最後的 final 結果
    lastFinalTranscript = normalized;
    currentSubtitle = text;
    interimSubtitle = '';

    console.log('[Content] Buffer 清理前:', displayBuffer.length, '項');

    // 清理所有 interim 來源的項目（這些是臨時的）
    const beforeCleanup = displayBuffer.length;
    displayBuffer = displayBuffer.filter(item => item.source === 'final');
    const afterCleanup = displayBuffer.length;

    if (beforeCleanup !== afterCleanup) {
      console.log('[Content] 已清理', beforeCleanup - afterCleanup, '個 interim 項目');
    }

    // 智能斷句 - 將長文字切分成多句
    const sentences = smartSplit(normalized);
    console.log('[Content] 斷句結果:', sentences.length, '句');

    // 檢查每個句子是否已經在 buffer 中（只檢查 final 來源的）
    const finalTexts = displayBuffer.map(item => item.text);
    const newSentences = sentences.filter(sentence => {
      // 完全匹配檢查
      if (finalTexts.includes(sentence)) {
        console.log('[Content] 句子已存在（完全匹配）:', sentence.substring(0, 20) + '...');
        return false;
      }

      // 檢查是否有任何現有句子包含這個新句子（或反過來）
      const hasOverlap = finalTexts.some(existing => {
        if (existing.includes(sentence) || sentence.includes(existing)) {
          console.log('[Content] 句子有重疊:', sentence.substring(0, 20) + '...');
          return true;
        }
        return false;
      });

      return !hasOverlap;
    });

    console.log('[Content] 新增', newSentences.length, '個新句子');

    // 加入新句子
    newSentences.forEach(sentence => {
      displayBuffer.push({
        text: sentence,
        timestamp: Date.now(),
        source: 'final'
      });

      // 加入歷史記錄
      subtitleHistory.push({
        text: sentence,
        timestamp: Date.now(),
        language: currentLanguage
      });

      console.log('[Content] ✅ 新增:', sentence.substring(0, 30) + (sentence.length > 30 ? '...' : ''));
    });

    // ========== 改進的 Buffer 清理策略 ==========
    // 1. 先按句子數清理
    while (displayBuffer.length > MAX_DISPLAY_SENTENCES) {
      const removed = displayBuffer.shift();
      console.log('[Content] 移除舊句子（超過句數限制）:', removed.text.substring(0, 20) + '...');
    }

    // 2. 再按總字符數清理
    let totalChars = displayBuffer.reduce((sum, item) => sum + item.text.length, 0);
    console.log('[Content] 當前總字符數:', totalChars);

    while (totalChars > MAX_TOTAL_CHARS && displayBuffer.length > 1) {
      const removed = displayBuffer.shift();
      totalChars -= removed.text.length;
      console.log('[Content] 移除舊句子（超過字符限制）:', removed.text.substring(0, 20) + '...', '剩餘:', totalChars, '字');
    }

    // 限制歷史記錄長度
    if (subtitleHistory.length > 50) {
      subtitleHistory.shift();
    }

    // 儲存到 storage
    chrome.storage.local.set({ subtitleHistory });

    // 更新顯示
    updateSubtitleDisplay();

    console.log('[Content] Buffer 最終狀態:', displayBuffer.length, '項');

    // 重置
    lastTranscript = '';

  } else {
    // ========== Interim 結果處理 ==========

    // 如果臨時文字太長，自動創建新句（標記為 interim）
    if (text.length > MAX_CHARS_PER_LINE) {
      console.log('[Content] Interim 過長 (', text.length, '字)，自動斷句');

      // 找到適合的斷句點
      const splitPoint = findSplitPoint(text, MAX_CHARS_PER_LINE);

      if (splitPoint > 0) {
        // 前半部分作為完整句子（interim 來源）
        const completedPart = normalizeText(text.slice(0, splitPoint));

        // 檢查是否已存在（檢查所有來源）
        const exists = displayBuffer.some(item => item.text === completedPart);

        if (!exists && completedPart) {
          displayBuffer.push({
            text: completedPart,
            timestamp: Date.now(),
            source: 'interim'  // 標記為臨時來源
          });

          console.log('[Content] ✅ Interim 斷句:', completedPart.substring(0, 30) + '...');

          // 按句子數和字符數雙重限制清理
          while (displayBuffer.length > MAX_DISPLAY_SENTENCES) {
            displayBuffer.shift();
          }

          let totalChars = displayBuffer.reduce((sum, item) => sum + item.text.length, 0);
          while (totalChars > MAX_TOTAL_CHARS && displayBuffer.length > 1) {
            const removed = displayBuffer.shift();
            totalChars -= removed.text.length;
            console.log('[Content] Interim 清理（字符限制）:', removed.text.substring(0, 20) + '...');
          }
        }

        // 後半部分作為臨時文字顯示
        const remainingPart = text.slice(splitPoint).trim();
        interimSubtitle = remainingPart;
        lastTranscript = text;
        updateSubtitleDisplay(remainingPart);

        // 自動顯示字幕
        if (!isVisible) {
          showSubtitleUI();
        }
        return;
      }
    }

    // 文字不長或找不到斷點，直接顯示（不加入 buffer）
    interimSubtitle = text;
    lastTranscript = text;
    updateSubtitleDisplay(text);
  }

  // 自動顯示字幕
  if (!isVisible) {
    showSubtitleUI();
  }
}

// 智能斷句 - 將長文字切分成多個短句
function smartSplit(text) {
  const sentences = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= MAX_CHARS_PER_LINE) {
      // 剩餘文字不長，直接加入
      sentences.push(remaining.trim());
      break;
    }

    // 找到斷句點
    const splitPoint = findSplitPoint(remaining, MAX_CHARS_PER_LINE);

    if (splitPoint > 0) {
      // 切分
      sentences.push(remaining.slice(0, splitPoint).trim());
      remaining = remaining.slice(splitPoint).trim();
    } else {
      // 找不到合適的斷點，強制切分
      sentences.push(remaining.slice(0, MAX_CHARS_PER_LINE).trim());
      remaining = remaining.slice(MAX_CHARS_PER_LINE).trim();
    }
  }

  return sentences.filter(s => s.length > 0);
}

// 尋找最佳斷句點
function findSplitPoint(text, maxLength) {
  // 優先在標點符號處斷句
  const punctuations = ['。', '！', '？', '、', '，', '.', '!', '?', ',', ' '];

  // 在 maxLength 範圍內尋找最後一個標點符號
  for (let i = Math.min(maxLength, text.length - 1); i > maxLength * 0.5; i--) {
    if (punctuations.includes(text[i])) {
      return i + 1; // 包含標點符號
    }
  }

  // 找不到標點，在空格處斷句（英文）
  for (let i = Math.min(maxLength, text.length - 1); i > maxLength * 0.5; i--) {
    if (text[i] === ' ') {
      return i + 1;
    }
  }

  // 都找不到，就直接在 maxLength 處切
  return maxLength;
}

// 更新字幕顯示
function updateSubtitleDisplay(interimText = '') {
  // 清空現有內容
  subtitleText.innerHTML = '';

  // 顯示緩衝區中的句子（每句一個 span）
  displayBuffer.forEach((item, index) => {
    const span = document.createElement('span');
    span.className = 'subtitle-line';

    // 舊的句子加上淡化效果
    if (index < displayBuffer.length - 1) {
      span.classList.add('old');
    }

    span.textContent = item.text;
    subtitleText.appendChild(span);

    // 在句子之間加上分隔（換行）
    if (index < displayBuffer.length - 1 || interimText) {
      subtitleText.appendChild(document.createElement('br'));
    }
  });

  // 如果有臨時文字，顯示在最後
  if (interimText) {
    const span = document.createElement('span');
    span.className = 'subtitle-line interim';
    span.textContent = interimText;
    subtitleText.appendChild(span);
  }
}

// 顯示字幕 UI
function showSubtitleUI() {
  subtitleContainer.classList.add('visible');
  isVisible = true;
}

// 隱藏字幕 UI
function hideSubtitleUI() {
  subtitleContainer.classList.remove('visible');
  isVisible = false;
}

// 顯示編輯視窗
function showEditModal(text) {
  // 建立 modal（如果不存在）
  if (!editModal) {
    editModal = document.createElement('div');
    editModal.id = 'stream-subtitle-edit-modal';
    editModal.innerHTML = `
      <div class="modal-content">
        <h3>修正字幕</h3>
        <div class="form-group">
          <label>錯誤的文字：</label>
          <input type="text" id="wrong-text" readonly>
        </div>
        <div class="form-group">
          <label>正確的文字：</label>
          <input type="text" id="correct-text" placeholder="輸入正確的文字">
        </div>
        <div class="modal-buttons">
          <button id="save-correction" class="primary-btn">儲存</button>
          <button id="cancel-correction" class="secondary-btn">取消</button>
        </div>
      </div>
    `;
    document.body.appendChild(editModal);

    // 綁定事件
    editModal.querySelector('#save-correction').addEventListener('click', saveCorrection);
    editModal.querySelector('#cancel-correction').addEventListener('click', closeEditModal);
  }

  // 填入文字
  editModal.querySelector('#wrong-text').value = text;
  editModal.querySelector('#correct-text').value = '';
  editModal.classList.add('visible');

  // 聚焦到輸入框
  editModal.querySelector('#correct-text').focus();
}

// 關閉編輯視窗
function closeEditModal() {
  if (editModal) {
    editModal.classList.remove('visible');
  }
}

// 儲存修正
function saveCorrection() {
  const wrongText = editModal.querySelector('#wrong-text').value.trim();
  const correctText = editModal.querySelector('#correct-text').value.trim();

  if (!correctText) {
    showToast('請輸入正確的文字');
    return;
  }

  // 讀取現有的修正記錄
  chrome.storage.sync.get(['corrections'], (result) => {
    let corrections = result.corrections || [];

    // 檢查是否已存在
    const existingIndex = corrections.findIndex(c => c.wrong === wrongText);

    if (existingIndex >= 0) {
      // 更新現有記錄
      corrections[existingIndex].correct = correctText;
      corrections[existingIndex].count += 1;
      corrections[existingIndex].lastSeen = new Date().toISOString();
    } else {
      // 新增記錄
      corrections.push({
        wrong: wrongText,
        correct: correctText,
        count: 1,
        language: currentLanguage,
        createdAt: new Date().toISOString(),
        lastSeen: new Date().toISOString()
      });
    }

    // 儲存
    chrome.storage.sync.set({ corrections }, () => {
      console.log('[Content] 修正已儲存:', wrongText, '→', correctText);
      showToast('✅ 修正已儲存');
      closeEditModal();
    });
  });
}

// 顯示 Toast 提示
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'stream-subtitle-toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 100);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}

// 載入設定
function loadSettings() {
  chrome.storage.sync.get(['language', 'autoDetect'], (result) => {
    if (result.language) {
      currentLanguage = result.language;
    }
    if (result.autoDetect !== undefined) {
      autoDetect = result.autoDetect;
    }
    updateControlPanel();
  });
}

// 鍵盤快捷鍵
function handleKeyboardShortcut(e) {
  // Alt + 1/2/3 切換語言
  if (e.altKey && !e.ctrlKey && !e.shiftKey) {
    switch (e.key) {
      case '1':
        changeLanguage('en', false);
        break;
      case '2':
        changeLanguage('ja', false);
        break;
      case '3':
        changeLanguage('zh-TW', false);
        break;
      case 's':
      case 'S':
        if (isRecording) {
          stopRecording();
        } else {
          startRecording(currentLanguage, autoDetect);
        }
        break;
    }
  }
}

// 啟動心跳檢測
function startHeartbeat() {
  console.log('[Content] 啟動心跳檢測');
  stopHeartbeat(); // 先清除舊的計時器

  lastResultTimestamp = Date.now(); // 重置時間戳

  heartbeatTimer = setInterval(() => {
    const now = Date.now();
    const timeSinceLastResult = now - lastResultTimestamp;

    console.log('[Content] ⏱️ 心跳檢查：距離上次結果', Math.round(timeSinceLastResult / 1000), '秒');

    // 如果超過指定時間沒有收到任何結果（包括 interim），可能卡住了
    if (timeSinceLastResult > HEARTBEAT_TIMEOUT && isRecording) {
      console.warn('[Content] ⚠️ 偵測到可能卡住（' + (HEARTBEAT_TIMEOUT/1000) + '秒無結果），嘗試重啟...');
      showToast('⚠️ 偵測到異常，正在重啟語音辨識...');

      // 重啟語音辨識
      const lang = currentLanguage;
      const auto = autoDetect;
      stopRecording();
      setTimeout(() => {
        startRecording(lang, auto);
      }, 500);
    }
  }, HEARTBEAT_INTERVAL);
}

// 停止心跳檢測
function stopHeartbeat() {
  if (heartbeatTimer) {
    console.log('[Content] 停止心跳檢測');
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// 初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

console.log('[Content] Content script 載入完成');
