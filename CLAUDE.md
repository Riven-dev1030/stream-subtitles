# CLAUDE.md - AI Assistant Guide for stream-subtitles

This document provides comprehensive guidance for AI assistants working with the `stream-subtitles` codebase. It explains the project structure, development workflows, and key conventions to follow.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Repository Structure](#repository-structure)
3. [Development Workflows](#development-workflows)
4. [Key Conventions](#key-conventions)
5. [Testing Guidelines](#testing-guidelines)
6. [Deployment](#deployment)
7. [Common Tasks](#common-tasks)
8. [Troubleshooting](#troubleshooting)

---

## Project Overview

### Purpose
The `stream-subtitles` project is a **Chrome Extension** that provides real-time subtitle generation for web-based video and audio content using voice recognition.

### Tech Stack

**Platform:**
- Chrome Extension (Manifest V3)
- Vanilla JavaScript (no build tools)

**APIs & Services:**
- **Deepgram API** - Real-time speech recognition via WebSocket
- **Chrome Extensions APIs:**
  - `chrome.tabCapture` - Audio capture from browser tabs
  - `chrome.storage` - Settings and learning data persistence
  - `chrome.runtime` - Message passing between components

**Web APIs:**
- MediaRecorder API - Audio stream processing
- WebSocket - Real-time communication with Deepgram

### Project Goals
- ✅ Real-time subtitle generation with <400ms latency
- ✅ Multi-language support (English, Japanese, Traditional Chinese)
- ✅ Automatic language detection
- ✅ Keywords learning system for improved accuracy on proper nouns
- ✅ User-friendly overlay interface
- 🚧 Subtitle export (planned)
- 🚧 Advanced learning features (planned)

---

## Repository Structure

```
stream-subtitles/
├── extension/                     # Chrome Extension source code
│   ├── manifest.json             # Extension configuration (Manifest V3)
│   ├── background/
│   │   └── service-worker.js    # Background service worker
│   │                             # - Audio capture (tabCapture API)
│   │                             # - Deepgram WebSocket connection
│   │                             # - Keywords management
│   ├── content/
│   │   └── content.js           # Content script injected into pages
│   │                             # - Subtitle overlay UI
│   │                             # - Edit modal for corrections
│   │                             # - Toast notifications
│   ├── popup/
│   │   ├── popup.html           # Extension popup UI
│   │   ├── popup.css            # Popup styles
│   │   └── popup.js             # Popup logic
│   │                             # - Language selection
│   │                             # - Corrections management
│   │                             # - Settings interface
│   ├── styles/
│   │   └── content.css          # Content script styles
│   │                             # - Subtitle overlay styles
│   │                             # - Edit modal styles
│   │                             # - Toast styles
│   ├── icons/                   # Extension icons (16, 32, 48, 128)
│   │   └── README.md            # Icon generation guide
│   └── utils/                   # Utility modules (future)
│
├── tools/
│   └── generate-icons.html      # Icon generator tool
│
├── README.md                     # User-facing documentation
├── QUICKSTART.md                 # Quick start guide
├── CLAUDE.md                     # This file - AI assistant guide
└── .gitignore                    # Git ignore rules
```

### Key Components

**`extension/background/service-worker.js`**
- Manages audio capture from browser tabs
- Establishes and maintains WebSocket connection to Deepgram
- Converts corrections into Deepgram keywords
- Handles inter-component messaging

**`extension/content/content.js`**
- Injects subtitle overlay UI into web pages
- Displays real-time subtitles with edit capability
- Manages correction modal and user interactions
- Stores subtitle history and corrections

**`extension/popup/`**
- User interface for extension settings
- Displays and manages correction history
- Language selection and status display
- Keyboard shortcuts reference

**`extension/styles/content.css`**
- Styles for subtitle overlay (z-index: 999998)
- Edit modal styles (z-index: 9999999)
- Toast notification animations
- Responsive design for mobile

**`extension/manifest.json`**
- Manifest V3 configuration file
- **Critical Permissions** (as of v1.0.1):
  - `tabCapture` - Required for capturing tab audio
  - `activeTab` - Required for user gesture context
  - **`tabs`** - **REQUIRED** for `chrome.tabCapture.getMediaStreamId()` to work
  - `storage` - For settings and corrections
  - `scripting` - For content script injection
  - `offscreen` - For offscreen document (audio processing)
- **Important**: In Manifest V3, `tabCapture` does NOT show a traditional permission dialog. It auto-grants/denies based on manifest config and user gesture context.

---

## Development Workflows

### Setting Up the Development Environment

```bash
# Clone the repository
git clone <repository-url>
cd stream-subtitles

# Install dependencies
# [Add package manager commands: npm install, pip install -r requirements.txt, etc.]

# Set up environment variables
cp .env.example .env
# Edit .env with your local configuration

# Run tests to verify setup
# [Add test command]
```

### Branch Strategy

- **Main branch**: `main` or `master` - production-ready code
- **Feature branches**: `feature/<feature-name>` - new features
- **Bug fixes**: `fix/<bug-description>` - bug fixes
- **AI assistant branches**: `claude/<session-id>` - AI-generated changes

### Commit Message Conventions

Follow conventional commit format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(parser): add support for WebVTT format
fix(stream): correct timestamp synchronization issue
docs(api): update endpoint documentation
```

### Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with clear, atomic commits
3. Write/update tests for your changes
4. Update documentation as needed
5. Ensure all tests pass
6. Create a PR with a descriptive title and body
7. Address review feedback
8. Squash commits if requested

---

## Key Conventions

### Code Style

**General Principles:**
- Write clear, self-documenting code
- Prefer readability over cleverness
- Keep functions small and focused (single responsibility)
- Use meaningful variable and function names
- Add comments for complex logic, not obvious code

**File Naming:**
- Use kebab-case for file names: `subtitle-parser.js`
- Test files: `subtitle-parser.test.js` or `subtitle-parser.spec.js`
- Use descriptive names that indicate file purpose

**Function/Variable Naming:**
- Use camelCase for functions and variables (JavaScript/TypeScript)
- Use PascalCase for classes and components
- Use UPPER_SNAKE_CASE for constants
- Boolean variables: prefix with `is`, `has`, `should`

**Error Handling:**
- Always handle errors explicitly
- Use custom error types for domain-specific errors
- Log errors with context
- Never swallow errors silently

**Security:**
- Never commit sensitive data (API keys, passwords, tokens)
- Validate all user input
- Sanitize data before processing
- Use environment variables for configuration
- Be cautious with subtitle file parsing (potential injection attacks)

### Subtitle Processing Conventions

**Timestamp Format:**
- Store timestamps in milliseconds internally
- Convert to format-specific representations on output
- Always validate timestamp ordering

**Text Encoding:**
- Default to UTF-8
- Support BOM detection for compatibility
- Handle various line endings (CRLF, LF)

**Format Support:**
- Each format should have its own parser and generator
- Maintain format specifications in comments/docs
- Include validation for format-specific rules

---

## Testing Guidelines

### Testing Principles

1. **Write tests first** (TDD) when possible
2. **Test behavior, not implementation** - tests should verify what the code does, not how it does it
3. **Keep tests independent** - each test should run in isolation
4. **Use descriptive test names** - test names should explain the scenario and expected outcome

### Test Structure

```javascript
// Use the Arrange-Act-Assert pattern
describe('SubtitleParser', () => {
  describe('parse()', () => {
    it('should correctly parse SRT format with multiple entries', () => {
      // Arrange
      const srtContent = '...';
      const parser = new SubtitleParser();

      // Act
      const result = parser.parse(srtContent, 'srt');

      // Assert
      expect(result.length).toBe(2);
      expect(result[0].text).toBe('Hello world');
    });
  });
});
```

### Test Coverage Goals

- **Unit tests**: 80%+ coverage for core logic
- **Integration tests**: Critical paths and workflows
- **Edge cases**: Malformed input, boundary conditions, error scenarios

### Running Tests

```bash
# Run all tests
# [Add command: npm test, pytest, go test, etc.]

# Run specific test file
# [Add command]

# Run tests with coverage
# [Add command]

# Run tests in watch mode
# [Add command]
```

---

## Deployment

### Environment Configuration

**Development:**
- Local configuration
- Debug logging enabled
- Hot reloading (if applicable)

**Staging:**
- Production-like environment
- Limited access
- Used for final testing

**Production:**
- Optimized builds
- Error logging only
- Monitoring and alerting enabled

### Deployment Steps

*[To be updated based on deployment strategy]*

1. Ensure all tests pass
2. Update version number
3. Build production bundle
4. Deploy to staging
5. Run smoke tests
6. Deploy to production
7. Monitor for errors

---

## Common Tasks

### Adding Support for a New Language

1. **Update language constants** in `content.js`:
   ```javascript
   const languages = {
     // ... existing
     de: { code: 'de', name: 'Deutsch', flag: '🇩🇪' }
   };
   ```

2. **Add language button** in `popup.html`:
   ```html
   <button class="lang-btn" data-lang="de">
     <span class="flag">🇩🇪</span>
     <span class="lang-name">Deutsch</span>
   </button>
   ```

3. **Update language mapping** in `popup.js`:
   ```javascript
   function getLanguageName(langCode) {
     const names = {
       // ... existing
       'de': 'DE'
     };
   }
   ```

4. Test with German audio content

### Working with Keywords Learning Feature

**Architecture Overview:**
```
User corrects subtitle → Storage → Background generates keywords → Deepgram
    (content.js)      (Chrome API)  (service-worker.js)        (WebSocket)
```

**Storage Format:**
```javascript
{
  corrections: [
    {
      wrong: "communities",     // What Deepgram said
      correct: "Kubernetes",    // What it should be
      count: 3,                 // Times this correction appeared
      language: "en",           // Language code
      createdAt: "2025-11-21T...",
      lastSeen: "2025-11-21T..."
    }
  ]
}
```

**Keywords Generation Logic:**
- Corrections are converted to Deepgram keywords format
- Boost value ranges from 1-3 based on occurrence count
- Formula: `boost = min(3, 1 + floor(count / 2))`
- Example: `"Kubernetes:2"` (appears 1-3 times, boost=2)

**Adding New Learning Features:**

1. **Auto-apply threshold**: Modify `service-worker.js`
   ```javascript
   customKeywords = corrections
     .filter(c => c.count >= 3)  // Change threshold here
     .map(c => `${c.correct}:${calculateBoost(c.count)}`);
   ```

2. **Custom boost logic**: Update boost calculation
   ```javascript
   function calculateBoost(count) {
     if (count >= 10) return 5;  // Very frequent
     if (count >= 5) return 3;
     return 2;
   }
   ```

3. **Context-aware keywords**: Add context analysis
   ```javascript
   corrections.push({
     wrong: "communities",
     correct: "Kubernetes",
     context: "I love",  // Words before/after
     count: 1
   });
   ```

### Debugging Speech Recognition Issues

**Problem: Low accuracy for specific terms**

1. Check if terms are in correction history:
   ```javascript
   chrome.storage.sync.get(['corrections'], result => {
     console.log(result.corrections);
   });
   ```

2. Verify keywords are being sent to Deepgram:
   - Open background service worker console
   - Check for log: `[Background] 已加入 X 個 keywords`

3. Monitor WebSocket URL:
   ```javascript
   // In service-worker.js, add logging
   console.log('[Background] WebSocket URL:', url);
   // Should see: &keywords=Kubernetes:2&keywords=...
   ```

**Problem: Keywords not updating**

1. Check if `updateCorrections` message handler is working:
   ```javascript
   // In service-worker.js
   case 'updateCorrections':
     console.log('[Background] Updating keywords...');
     updateKeywordsFromCorrections(message.corrections);
     break;
   ```

2. Verify auto-reconnect is triggered:
   - Keywords only apply on new connection
   - Stop and restart recording to apply changes

### Performance Optimization

**Current Performance:**
- Audio capture: ~10ms
- Network latency: ~50-100ms
- Deepgram recognition: ~100-200ms
- UI rendering: ~10ms
- **Total latency: ~200-400ms**

**Optimization Strategies:**

1. **Reduce WebSocket overhead**:
   ```javascript
   // In service-worker.js
   mediaRecorder.start(250);  // Adjust chunk size (default: 250ms)
   ```

2. **Optimize subtitle display**:
   ```javascript
   // Use requestAnimationFrame for smooth updates
   function displaySubtitle(text, isFinal) {
     requestAnimationFrame(() => {
       subtitleText.textContent = text;
     });
   }
   ```

3. **Limit correction history**:
   ```javascript
   // In content.js
   if (subtitleHistory.length > 50) {  // Adjust limit
     subtitleHistory.shift();
   }
   ```

### Testing the Extension

**Manual Testing Checklist:**

1. **Basic Functionality:**
   - [ ] Extension loads without errors
   - [ ] Popup opens and displays correctly
   - [ ] Can start/stop recording
   - [ ] Subtitles appear on page
   - [ ] Language switching works

2. **Keywords Learning:**
   - [ ] Edit button appears on subtitles
   - [ ] Edit modal opens and saves
   - [ ] Corrections appear in popup
   - [ ] Keywords are applied on restart
   - [ ] Accuracy improves after corrections

3. **Edge Cases:**
   - [ ] Empty subtitle handling
   - [ ] Very long subtitles (>200 chars)
   - [ ] Rapid language switching
   - [ ] Multiple tabs with extension active
   - [ ] Page refresh during recording

**Console Logging:**
```javascript
// Check these logs in order
[Content] Content script 載入完成
[Background] Service worker 已載入
[Background] 開始擷取音訊...
[Background] Deepgram 連線成功
[Background] 已加入 N 個 keywords
[Content] 收到訊息: subtitle
```

---

## Troubleshooting

### Common Issues

**Problem: "Permission dismissed" error or no permission dialog shows**

**Symptoms:** Error message "Permission dismissed" in console, or no permission dialog appears when clicking Start

**Root Cause:** In Manifest V3, `chrome.tabCapture` does NOT show a traditional permission dialog. It auto-grants/denies based on manifest configuration.

**Solutions:**
1. **Verify manifest.json has all required permissions:**
   - ✅ `tabCapture` - Must be present
   - ✅ `activeTab` - Must be present
   - ✅ **`tabs`** - **CRITICAL**: Without this, `getMediaStreamId()` fails silently
   - ✅ `offscreen` - Required for audio processing
2. **Check if on restricted page:**
   - ❌ Cannot capture `chrome://` pages
   - ❌ Cannot capture `chrome-extension://` pages
   - ✅ Use on normal websites (YouTube, Netflix, etc.)
3. **Ensure user gesture context:**
   - Must click Start button in popup (not via keyboard shortcut)
   - Must be called from popup.js, not background script
4. **Check console logs:**
   ```
   [Popup] 當前分頁 ID: xxx, URL: https://...
   [Popup] 獲取 stream ID，targetTabId: xxx
   [Popup] 已獲取 stream ID: {stream-id}
   ```
5. **If still failing:**
   - Reload extension: chrome://extensions/ → reload button
   - Restart Chrome
   - Check Chrome version (requires Chrome 116+)

**Important Implementation Details:**

1. **getUserMedia Constraints Format:**

   Different Chrome versions may require different constraint formats. Use a fallback approach:

   ```javascript
   // Method 1: Try standard format first (newer Chrome)
   try {
     const stream = await navigator.mediaDevices.getUserMedia({
       audio: {
         chromeMediaSource: 'tab',
         chromeMediaSourceId: streamId
       }
     });
   } catch (err) {
     // Method 2: Fall back to mandatory format (older Chrome)
     const stream = await navigator.mediaDevices.getUserMedia({
       audio: {
         mandatory: {
           chromeMediaSource: 'tab',
           chromeMediaSourceId: streamId
         }
       }
     });
   }
   ```

2. **Offscreen Document Loading Timing:**

   After creating an offscreen document, wait for it to fully load before sending messages:

   ```javascript
   await chrome.offscreen.createDocument({...});
   // Wait 500ms for document to fully load
   await new Promise(resolve => setTimeout(resolve, 500));
   // Now safe to send messages
   ```

   Without this delay, you may encounter "Could not establish connection. Receiving end does not exist" errors.

**Problem: No subtitles appearing**

**Symptoms:** Extension loaded, recording started, but no subtitles show

**Solutions:**
1. Check Deepgram API key is set in `service-worker.js`
2. Open browser console (F12) and check for errors
3. Verify audio is playing (check system sound mixer)
4. Check browser permissions for the extension
5. Try reloading the extension: chrome://extensions/ → reload button

**Problem: Subtitles are very inaccurate**

**Symptoms:** Getting wrong words consistently

**Solutions:**
1. Select correct language (not AUTO mode)
2. Use keywords learning feature:
   - Click ✏️ on wrong subtitles
   - Correct them 2-3 times
   - Restart recording to apply keywords
3. Check audio quality (reduce background noise)
4. Verify language selection matches audio content

**Problem: High latency (>2 seconds)**

**Symptoms:** Subtitles appear long after speech

**Solutions:**
1. Check network connection speed
2. Disable AUTO language detection (use specific language)
3. Clear browser cache and cookies
4. Reduce number of active keywords (<50 recommended)
5. Check Deepgram API status

**Problem: Extension crashes or freezes**

**Symptoms:** UI unresponsive, no new subtitles

**Solutions:**
1. Check browser console for JavaScript errors
2. Verify Chrome is updated to latest version
3. Disable other extensions that modify pages
4. Clear extension storage:
   ```javascript
   chrome.storage.sync.clear();
   chrome.storage.local.clear();
   ```
5. Reload the extension

**Problem: Keywords not improving accuracy**

**Symptoms:** Corrected terms still recognized incorrectly

**Solutions:**
1. Verify corrections are saved (check popup → 學習記錄)
2. **IMPORTANT:** Stop and restart recording after corrections
3. Check background console logs for keyword loading
4. Ensure at least 1-2 corrections for the term
5. Try increasing boost value manually in `service-worker.js`

**Problem: Edit modal doesn't appear**

**Symptoms:** Clicking ✏️ button does nothing

**Solutions:**
1. Check browser console for errors
2. Verify `content.css` is loaded
3. Check z-index conflicts with page styles
4. Try on different website
5. Reload extension and page

### Debug Mode

**Enable verbose logging:**

1. **Background Service Worker:**
   ```javascript
   // Add at top of service-worker.js
   const DEBUG = true;

   function log(...args) {
     if (DEBUG) console.log('[Background-DEBUG]', ...args);
   }
   ```

2. **Content Script:**
   ```javascript
   // Add at top of content.js
   const DEBUG = true;

   function log(...args) {
     if (DEBUG) console.log('[Content-DEBUG]', ...args);
   }
   ```

3. **Monitor all events:**
   - Open chrome://extensions/
   - Find Stream Subtitles
   - Click "service worker" link (background console)
   - Open page console (F12) for content script logs

### Performance Monitoring

**Check latency:**
```javascript
// Add to service-worker.js
deepgramSocket.onmessage = (event) => {
  const receiveTime = Date.now();
  const response = JSON.parse(event.data);
  const latency = receiveTime - lastSentTime;
  console.log('[Latency]', latency, 'ms');
  handleDeepgramMessage(event.data);
};
```

**Monitor memory usage:**
```javascript
// In content.js
setInterval(() => {
  console.log('[Memory] Subtitle history:', subtitleHistory.length);
  console.log('[Memory] Corrections:', corrections.length);
}, 10000);
```

---

## AI Assistant Guidelines

### When Working on This Codebase

**DO:**
- ✅ Read relevant code before making changes
- ✅ Follow existing code style and patterns
- ✅ Write tests for new functionality
- ✅ Update documentation when changing behavior
- ✅ Use descriptive commit messages
- ✅ Ask for clarification when requirements are unclear
- ✅ Consider edge cases and error scenarios
- ✅ Look for security implications (especially with file parsing)

**DON'T:**
- ❌ Make assumptions about subtitle format specifications
- ❌ Skip writing tests
- ❌ Introduce breaking changes without discussion
- ❌ Ignore existing patterns and conventions
- ❌ Commit commented-out code
- ❌ Leave TODO comments without creating issues
- ❌ Optimize prematurely without profiling

### Code Review Checklist

Before committing changes, verify:

- [ ] Code follows project conventions
- [ ] Tests are written and passing
- [ ] Documentation is updated
- [ ] No security vulnerabilities introduced
- [ ] Error handling is comprehensive
- [ ] Edge cases are handled
- [ ] Performance is acceptable
- [ ] No sensitive data in commits
- [ ] Commit messages are descriptive

### Understanding the Codebase

**Start here:**
1. Read this CLAUDE.md file
2. Review the README.md for project overview
3. Check package.json/requirements.txt for dependencies
4. Look at the main entry point
5. Examine test files to understand expected behavior
6. Review recent commits and PRs for context

**Key questions to answer:**
- How does audio capture work? (chrome.tabCapture API)
- How is the WebSocket connection managed? (Background service worker)
- How are subtitles displayed? (Content script injection)
- How does keywords learning work? (Chrome storage + Deepgram keywords parameter)
- What is the message flow? (Background ↔ Content ↔ Popup)
- How are corrections persisted? (chrome.storage.sync for corrections, .local for history)

---

## Additional Resources

### API Documentation

- **Deepgram API**: https://developers.deepgram.com/
  - Real-time streaming: https://developers.deepgram.com/docs/streaming
  - Keywords feature: https://developers.deepgram.com/docs/keywords
  - Language codes: https://developers.deepgram.com/docs/language

- **Chrome Extensions APIs**:
  - Manifest V3: https://developer.chrome.com/docs/extensions/mv3/
  - chrome.tabCapture: https://developer.chrome.com/docs/extensions/reference/tabCapture/
  - chrome.storage: https://developer.chrome.com/docs/extensions/reference/storage/
  - Service Workers: https://developer.chrome.com/docs/extensions/mv3/service_workers/

### Related Projects

- **Web Speech API** (alternative): https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
- **MediaRecorder API**: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder

### Learning Resources

- Chrome Extension development: https://developer.chrome.com/docs/extensions/
- WebSocket programming: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
- Real-time audio processing: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API

---

## Maintenance Notes

**Last Updated**: 2025-11-21
**Current Version**: 1.0.1 (with Keywords Learning Feature + Permission Fixes)

### Recent Updates

**2025-11-21 (v1.0.1):**
- 🔧 **CRITICAL FIX**: Added "tabs" permission to manifest.json
  - Fixed `chrome.tabCapture.getMediaStreamId()` failing silently
  - Resolved "Permission dismissed" errors
  - Improved error handling in popup.js for better user feedback
- 🔧 **CRITICAL FIX**: Fixed offscreen document loading timing issue
  - Added 500ms delay after creating offscreen document
  - Prevents "Could not establish connection" errors
  - Resolves double-initialization and repeated startup attempts
- 🔧 **CRITICAL FIX**: Implemented getUserMedia constraints format fallback
  - Tries standard format first, falls back to mandatory format
  - Provides compatibility across different Chrome versions
  - Fixes "Permission dismissed" errors in offscreen document
- 🔧 **CRITICAL FIX**: Added automatic retry mechanism for content script communication
  - Retries up to 3 times with 500ms intervals
  - Ensures subtitle messages reach the page even if content script is still loading
  - Critical for subtitle display functionality
- 🔧 **CRITICAL FIX**: Fixed "Cannot capture a tab with an active stream" error
  - Changed stopCapture() to async function with proper resource cleanup
  - Added 500ms delay to ensure stream resources are fully released
  - Prevents conflicts when starting new recording while old stream is active
- ✅ Enhanced error messages for Chrome internal pages
- ✅ Added detailed logging for debugging permission issues
- 📝 **Important**: In Manifest V3, tabCapture does NOT show traditional permission dialog - it auto-grants/denies based on manifest config

**2025-11-21 (v1.0.0):**
- ✅ Added Keywords Learning Feature (basic version)
- ✅ Updated project structure documentation
- ✅ Added troubleshooting guide for actual issues
- ✅ Documented keywords generation logic
- ✅ Added testing checklist

### Update Checklist

This document should be updated when:
- [x] New features are added → Keywords Learning Feature documented
- [x] Development workflow changes → Updated for Chrome Extension workflow
- [x] New conventions are established → Added keywords boost logic
- [ ] Dependencies change significantly
- [ ] New languages are supported
- [ ] Performance optimizations are implemented

---

## Contributing

For external contributors:
1. Fork the repository
2. Create a feature branch
3. Make your changes following this guide
4. Submit a pull request with a clear description
5. Be responsive to review feedback

---

*This document is a living guide. As the codebase evolves, update this file to reflect the current state of the project. AI assistants should treat this as the authoritative source for understanding the codebase conventions and workflows.*
