# Changelog

All notable changes to Stream Subtitles will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2025-11-21

### Fixed
- **CRITICAL**: Fixed getUserMedia constraints format in offscreen.js
  - Changed to use `mandatory` wrapper for chromeMediaSource and chromeMediaSourceId
  - This is the correct format according to Chrome official documentation
  - Fixes "Permission dismissed" errors in offscreen document
- **CRITICAL**: Fixed `chrome.tabCapture.getMediaStreamId()` failing silently due to missing "tabs" permission
  - Added "tabs" permission to manifest.json
  - This permission is required for tabCapture API to work properly in Manifest V3
  - Without it, the API fails with "Permission dismissed" error
- Improved error handling when permission is denied or unavailable
- Added validation to prevent usage on Chrome internal pages (chrome://, chrome-extension://)
- Enhanced error messages to provide clearer guidance to users

### Changed
- Updated version from 1.0.0 to 1.0.1
- Improved popup.js error handling with detailed logging
  - Now logs tab ID and URL for debugging
  - Provides user-friendly error messages for different failure scenarios
- Enhanced offscreen.js error messages for better troubleshooting
- Improved service-worker.js error reporting to content script

### Technical Details

**Understanding Manifest V3 tabCapture Behavior:**

In Manifest V3, the `chrome.tabCapture.getMediaStreamId()` API behaves differently from traditional permission APIs:

1. **No Permission Dialog**: Unlike camera/microphone permissions, tabCapture does NOT show a user-facing permission dialog
2. **Auto-grant/Deny**: Chrome automatically grants or denies based on:
   - Manifest configuration (must have: tabCapture, activeTab, **tabs**)
   - User gesture context (must be triggered from popup click)
   - Page restrictions (cannot capture chrome:// pages)
3. **Silent Failure**: If the "tabs" permission is missing, the API fails silently without clear error messages

**Why "tabs" permission is required:**

The Chrome documentation states that `getMediaStreamId()` requires the "tabs" permission to access tab information, even though it's not immediately obvious from the API name. This was discovered through web research and community reports.

**Files Changed:**
- `extension/manifest.json` - Added "tabs" to permissions array
- `extension/popup/popup.js` - Enhanced error handling and validation
- `extension/offscreen/offscreen.js` - Improved error messages
- `extension/background/service-worker.js` - Better error reporting

**Migration Guide:**

If upgrading from v1.0.0 to v1.0.1:
1. Reload the extension in chrome://extensions/
2. The new "tabs" permission will be automatically granted (it's not a user-facing permission)
3. No user action required

## [1.0.0] - 2025-11-21

### Added
- Initial release with Keywords Learning Feature
- Real-time subtitle generation using Deepgram API
- Support for multiple languages (English, Japanese, Traditional Chinese)
- Automatic language detection
- Keywords learning system for improved accuracy
- User-friendly overlay interface
- Correction management system
- Chrome Extension Manifest V3 implementation

### Features
- Audio capture from browser tabs using chrome.tabCapture API
- Real-time speech recognition via Deepgram WebSocket
- Subtitle overlay with edit capability
- Persistent corrections storage using chrome.storage
- Automatic keyword generation from corrections
- Offscreen document for audio processing

### Known Issues
- tabCapture requires specific permissions (fixed in v1.0.1)
- Cannot capture audio from Chrome internal pages (by design)
