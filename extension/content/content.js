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
const MAX_TOTAL_CHARS = 50; // 總共最多 50 字元，Final + Interim 共享此額度
const MIN_DISPLAY_TIME = 1500; // Final 句子至少顯示 1.5 秒
const MIN_INTERIM_DISPLAY_TIME = 2000; // Interim 句子至少顯示 2 秒（已棄用，Interim 不加入 Buffer）

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
const HEARTBEAT_INTERVAL = 1000; // 1秒檢測一次
const HEARTBEAT_TIMEOUT = 3000; // 3秒無結果就重啟

// 存活監控變數
let sessionStartTime = null; // 會話開始時間
let restartCount = 0; // 重啟次數
let lastRestartTime = null; // 上次重啟時間

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

  // ========== 啟動定時清理器 ==========
  // 每 1 秒檢查一次 Buffer，自動清理已顯示超過最小時間的句子
  setInterval(() => {
    cleanupBuffer();
  }, 1000);
  console.log('[Content] ✅ 定時清理器已啟動（每 1 秒檢查一次）');
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

    // 初始化會話開始時間（如果是第一次啟動）
    if (!sessionStartTime) {
      sessionStartTime = Date.now();
      restartCount = 0;
      console.log('[Content] 📊 會話開始，時間:', new Date(sessionStartTime).toLocaleTimeString());
    }

    // 啟動心跳檢測
    startHeartbeat();

  } catch (error) {
    console.error('[Content] 啟動失敗:', error);
    showToast('❌ 啟動失敗: ' + error.message);
  }
}

// 停止錄音
function stopRecording(skipSessionReset = false) {
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

  // 重置會話監控變數（除非是重啟時的停止）
  if (!skipSessionReset && sessionStartTime) {
    const sessionDuration = Date.now() - sessionStartTime;
    console.log('[Content] 📊 會話結束，總時長:', Math.round(sessionDuration / 1000), '秒，重啟次數:', restartCount);
    sessionStartTime = null;
    restartCount = 0;
    lastRestartTime = null;
  }

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

// Buffer 清理函數 - 定期清理已顯示超過最小時間的句子
function cleanupBuffer() {
  if (displayBuffer.length === 0) return;

  const currentTime = Date.now();
  let cleaned = false;

  // 1. 按句子數清理（確保最舊的句子已經顯示夠久）
  while (displayBuffer.length > MAX_DISPLAY_SENTENCES) {
    const oldest = displayBuffer[0];
    const displayDuration = currentTime - oldest.timestamp;

    if (displayDuration >= MIN_DISPLAY_TIME) {
      const removed = displayBuffer.shift();
      cleaned = true;
      console.log('[Content] 🗑️ 定時清理（超過句數，已顯示', Math.round(displayDuration / 1000), '秒）:', removed.text.substring(0, 20) + '...');
    } else {
      break;
    }
  }

  // 2. 按總字符數清理（確保顯示時間夠久）
  let totalChars = displayBuffer.reduce((sum, item) => sum + item.text.length, 0);

  while (totalChars > MAX_TOTAL_CHARS && displayBuffer.length > 1) {
    const oldest = displayBuffer[0];
    const displayDuration = currentTime - oldest.timestamp;

    if (displayDuration >= MIN_DISPLAY_TIME) {
      const removed = displayBuffer.shift();
      totalChars -= removed.text.length;
      cleaned = true;
      console.log('[Content] 🗑️ 定時清理（超過字符，已顯示', Math.round(displayDuration / 1000), '秒）:', removed.text.substring(0, 20) + '...', '剩餘:', totalChars, '字');
    } else {
      break;
    }
  }

  // 如果清理了內容，更新顯示
  if (cleaned) {
    updateSubtitleDisplay();
  }
}

// 分層清理函數 - 在加入新句子前確保有足夠空間
// 這個函數會分三層漸進式清理，確保總字數限制一定生效
function cleanupBeforeAdd(newSentences) {
  // 計算新句子需要的字符數
  const newCharsNeeded = newSentences.reduce((sum, s) => sum + s.length, 0);
  let currentChars = displayBuffer.reduce((sum, item) => sum + item.text.length, 0);
  const totalAfterAdd = currentChars + newCharsNeeded;

  // 如果加入後不會超過限制，不需要清理
  if (totalAfterAdd <= MAX_TOTAL_CHARS) {
    return;
  }

  const needToRemove = totalAfterAdd - MAX_TOTAL_CHARS;
  let removed = 0;
  let layer = 0; // 記錄使用了哪一層清理
  const now = Date.now();

  // 第1層：優先清理顯示時間 ≥ 1.5秒 的句子
  while (removed < needToRemove && displayBuffer.length > 0) {
    const oldest = displayBuffer[0];
    const displayDuration = now - oldest.timestamp;

    if (displayDuration >= MIN_DISPLAY_TIME) {
      removed += oldest.text.length;
      displayBuffer.shift();
      currentChars -= oldest.text.length;
      layer = 1;
    } else {
      break;
    }
  }

  // 第2層：如果還不夠，清理顯示時間 ≥ 0.5秒 的句子
  if (removed < needToRemove) {
    while (removed < needToRemove && displayBuffer.length > 0) {
      const oldest = displayBuffer[0];
      const displayDuration = now - oldest.timestamp;

      if (displayDuration >= 500) {
        removed += oldest.text.length;
        displayBuffer.shift();
        currentChars -= oldest.text.length;
        layer = 2;
      } else {
        break;
      }
    }
  }

  // 第3層：如果還是不夠，強制清理（無視時間），但至少保留1句
  if (removed < needToRemove) {
    while (removed < needToRemove && displayBuffer.length > 1) {
      removed += displayBuffer[0].text.length;
      displayBuffer.shift();
      layer = 3;
    }
  }

  // 只在有清理時才輸出日誌（減少 console 輸出）
  if (layer > 0) {
    // currentChars 已經是清理後的值，不需要再減
    console.log(`[Content] 🗑️ 分層清理(L${layer})：清理 ${removed} 字，剩餘 ${currentChars} 字`);
  }
}

// 顯示字幕
function displaySubtitle(text, isFinal) {
  if (!text) return;

  if (isFinal) {
    // ========== Final 結果處理：靜默校正 ==========
    console.log('[Content] Final (', text.length, '字):', text.substring(0, 30) + '...');

    const normalized = normalizeText(text);

    // 避免重複處理相同的 Final
    if (normalized === lastFinalTranscript) {
      console.log('[Content] ❌ 重複的 Final，跳過');
      return;
    }

    lastFinalTranscript = normalized;

    // 尋找 displayBuffer 中最後一個 interim 項目（最可能對應的）
    let targetIndex = -1;
    for (let i = displayBuffer.length - 1; i >= 0; i--) {
      if (displayBuffer[i].source === 'interim') {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex >= 0) {
      // 找到對應的 interim，進行校正
      const interimItem = displayBuffer[targetIndex];
      const similarity = calculateSimilarity(interimItem.text, normalized);

      // ⚠️ 重要：Final 也要檢查字數限制
      const otherItemsChars = displayBuffer.filter((_, i) => i !== targetIndex).reduce((sum, item) => sum + item.text.length, 0);
      const maxAllowed = MAX_TOTAL_CHARS - otherItemsChars;

      let finalText = normalized;
      if (normalized.length > maxAllowed) {
        console.log('[Content] ⚠️ Final 超過字數限制，截斷：', normalized.length, '→', maxAllowed);
        finalText = normalized.slice(-maxAllowed); // 保留最後的字
      }

      console.log('[Content] 📝 校正 Interim:', interimItem.text.substring(0, 20), '→', finalText.substring(0, 20), '相似度:', similarity.toFixed(2));

      // 靜默更新為 Final 內容
      displayBuffer[targetIndex] = {
        text: finalText,
        timestamp: interimItem.timestamp, // 保留原始時間戳
        source: 'final', // 標記為已校正
        corrected: similarity < 0.9 // 如果相似度低，標記為有校正
      };

      updateSubtitleDisplay();
    } else {
      console.log('[Content] ⚠️ 找不到對應的 Interim，Final 可能太晚到達');
    }

    // 存入歷史記錄
    subtitleHistory.push({
      text: normalized,
      timestamp: Date.now(),
      language: currentLanguage
    });

    if (subtitleHistory.length > 50) {
      subtitleHistory.shift();
    }

    chrome.storage.local.set({ subtitleHistory });

  } else {
    // ========== Interim 結果處理：立即顯示 ==========
    console.log('[Content] Interim (', text.length, '字):', text.substring(0, 30) + '...');

    const normalized = normalizeText(text);

    // 檢查是否需要更新最後一個 interim（同一句話的持續更新）
    let shouldUpdate = false;
    if (displayBuffer.length > 0) {
      const lastItem = displayBuffer[displayBuffer.length - 1];
      if (lastItem.source === 'interim') {
        // 如果新的 Interim 包含舊的，或者很相似，就是同一句話的更新
        if (normalized.includes(lastItem.text) || lastItem.text.includes(normalized)) {
          shouldUpdate = true;
        }
      }
    }

    if (shouldUpdate) {
      // 更新最後一個 interim
      // ⚠️ 重要：更新時也要檢查字數限制
      const otherItemsChars = displayBuffer.slice(0, -1).reduce((sum, item) => sum + item.text.length, 0);
      const maxAllowed = MAX_TOTAL_CHARS - otherItemsChars;

      let finalText = normalized;
      if (normalized.length > maxAllowed) {
        console.log('[Content] ⚠️ Interim 更新超過字數限制，截斷：', normalized.length, '→', maxAllowed);
        finalText = normalized.slice(-maxAllowed); // 保留最後的字
      }

      displayBuffer[displayBuffer.length - 1] = {
        text: finalText,
        timestamp: Date.now(),
        source: 'interim'
      };
      console.log('[Content] 🔄 更新 Interim (', finalText.length, '字)');
    } else {
      // 新增一個 interim 項目
      // ⚠️ 重要：先清理所有舊的 interim，確保最多只有 1 個 interim
      const oldInterimCount = displayBuffer.filter(item => item.source === 'interim').length;
      if (oldInterimCount > 0) {
        console.log('[Content] 🧹 清理', oldInterimCount, '個舊的 interim');
        displayBuffer = displayBuffer.filter(item => item.source === 'final');
      }

      // 檢查是否需要清理 final 項目以騰出空間
      const totalChars = displayBuffer.reduce((sum, item) => sum + item.text.length, 0);
      const afterAddChars = totalChars + normalized.length;

      if (afterAddChars > MAX_TOTAL_CHARS) {
        // 需要清理，呼叫分層清理
        cleanupBeforeAdd([normalized]);
      }

      displayBuffer.push({
        text: normalized,
        timestamp: Date.now(),
        source: 'interim'
      });

      console.log('[Content] ➕ 新增 Interim');
    }

    updateSubtitleDisplay();
  }

  // 自動顯示字幕
  if (!isVisible) {
    showSubtitleUI();
  }
}

// 計算兩個字串的相似度（簡單版本：基於最長公共子序列）
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;

  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  // 簡單的相似度計算：看短的字串有多少比例包含在長的字串中
  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) {
      matches++;
    }
  }

  return matches / longer.length;
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
function updateSubtitleDisplay() {
  // 清空現有內容
  subtitleText.innerHTML = '';

  // 顯示緩衝區中的句子（每句一個 span）
  displayBuffer.forEach((item, index) => {
    const span = document.createElement('span');
    span.className = 'subtitle-line';

    // 根據來源添加樣式
    if (item.source === 'interim') {
      span.classList.add('interim'); // Interim 字幕樣式（可能會變動）
    } else if (item.source === 'final') {
      if (item.corrected) {
        span.classList.add('corrected'); // Final 校正過的字幕（可加閃爍效果）
      }
    }

    // 舊的句子加上淡化效果
    if (index < displayBuffer.length - 1) {
      span.classList.add('old');
    }

    span.textContent = item.text;
    subtitleText.appendChild(span);

    // 在句子之間加上分隔（換行）
    if (index < displayBuffer.length - 1) {
      subtitleText.appendChild(document.createElement('br'));
    }
  });
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
    const sessionDuration = sessionStartTime ? Math.round((now - sessionStartTime) / 1000) : 0;
    const timeSinceLastRestart = lastRestartTime ? Math.round((now - lastRestartTime) / 1000) : 0;

    // 顯示詳細的心跳資訊
    console.log(
      `[Content] ⏱️ 心跳檢查：` +
      `距上次結果 ${Math.round(timeSinceLastResult / 1000)}秒 | ` +
      `會話時長 ${sessionDuration}秒 | ` +
      `重啟次數 ${restartCount}次` +
      (lastRestartTime ? ` | 距上次重啟 ${timeSinceLastRestart}秒` : '')
    );

    // 如果超過指定時間沒有收到任何結果（包括 interim），可能卡住了
    if (timeSinceLastResult > HEARTBEAT_TIMEOUT && isRecording) {
      restartCount++;
      lastRestartTime = now;

      console.warn(
        `[Content] ⚠️ 偵測到可能卡住（${HEARTBEAT_TIMEOUT/1000}秒無結果），第 ${restartCount} 次重啟...` +
        `\n📊 會話時長：${sessionDuration}秒` +
        `\n📊 平均重啟間隔：${Math.round(sessionDuration / restartCount)}秒`
      );
      showToast(`⚠️ 偵測到異常，正在重啟語音辨識... (第 ${restartCount} 次)`);

      // 重啟語音辨識
      const lang = currentLanguage;
      const auto = autoDetect;
      stopRecording(true); // 傳入 true 以保留會話資訊
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
