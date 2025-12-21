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
The `stream-subtitles` project handles real-time subtitle generation, processing, and/or streaming for video content.

### Tech Stack

**Architecture:**
- **Platform**: Chrome Extension (Manifest V3)
- **Language/Runtime**: JavaScript (ES6+)
- **Audio Input**: Web Audio API + Tab Capture API

**Recognition Engines:**
- **Web Speech API**: Built-in browser recognition (free)
- **Deepgram API**: Cloud-based recognition via WebSocket (high accuracy)
- **Claude API**: Real-time translation (Anthropic Claude 4.5 Haiku)

**Key Components:**
- Service Worker (background processing and message routing)
- Content Script (subtitle display and DOM injection)
- Offscreen Document (audio processing)
- Popup UI (user controls and configuration)
- CryptoManager (AES-GCM-256 encryption for API keys)

**APIs Used:**
- Deepgram WebSocket API (`wss://api.deepgram.com/v1/listen`)
- Anthropic Claude API (`https://api.anthropic.com/v1/messages`)

### Project Goals
- **Real-time Subtitles**: Provide low-latency, streaming subtitles for video content
- **Multi-Engine Support**: Support both Web Speech API and Deepgram with easy switching
- **Bilingual Output**: Real-time translation with Claude API for Chinese, English, Japanese, etc.
- **User-Friendly**: Simple, intuitive UI with one-click activation
- **Security**: Encrypted API key storage with PBKDF2 + AES-GCM-256
- **Performance**: Minimal browser performance impact, efficient caching
- **Accessibility**: Support for hearing-impaired users and language learners

---

## Repository Structure

```
stream-subtitles/
├── extension/                        # Chrome Extension source code
│   ├── background/                  # Service Worker and background tasks
│   │   ├── service-worker.js        # Main extension controller
│   │   ├── claude-translator.js     # Claude API translation client (Phase 3.1)
│   │   ├── deepgram-client.js       # Deepgram WebSocket client
│   │   ├── audio-capture-manager.js # Tab audio capture
│   │   └── crypto-manager.js        # API key encryption/decryption
│   ├── content/                     # Content Script (injected into web pages)
│   │   └── content.js               # Subtitle display and management
│   ├── offscreen/                   # Offscreen Document (Manifest V3)
│   │   ├── offscreen.js             # Offscreen document controller
│   │   └── audio-processor.js       # Web Audio API processing
│   ├── popup/                       # Extension popup UI
│   │   ├── popup.html               # UI markup
│   │   ├── popup.js                 # UI controller and settings
│   │   └── popup.css                # UI styling
│   ├── utils/                       # Shared utilities
│   │   └── crypto-manager.js        # Encryption utilities
│   ├── manifest.json                # Extension manifest (Manifest V3)
│   ├── icon.png                     # Extension icon
│   └── offscreen.html               # Offscreen document HTML
├── docs/                            # Documentation
│   └── [architecture docs, guides]
├── README.md                        # Project overview and usage guide
├── DEVLOG.md                        # Development log and progress tracking
├── SDD.md                          # Software Design Document (detailed architecture)
├── CLAUDE.md                       # This file - AI assistant guide
├── package.json                    # Project metadata and dependencies
└── test-api-key.html              # API key testing utility
```

### Key Directories

**`extension/background/`**
- Service Worker: Main controller for extension lifecycle, message routing, API calls
- ClaudeTranslator: Handles real-time translation via Anthropic Claude API
- DeepgramClient: Manages WebSocket connection to Deepgram for speech recognition
- AudioCaptureManager: Captures audio from browser tabs
- CryptoManager: Encrypts/decrypts API keys using AES-GCM-256

**`extension/content/`**
- Injected into web pages
- Manages subtitle display and DOM injection
- Communicates with Service Worker via message passing

**`extension/offscreen/`**
- Isolated document for audio processing (required by Manifest V3)
- Web Audio API processing and format conversion

**`extension/popup/`**
- User-facing controls: engine selection, API key input, settings
- Real-time status display and configuration management

**`docs/`**
- Architecture diagrams and technical specifications

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

### Implementing Claude API Translation (Phase 3.1)

**Setup:**
1. Get API key from Anthropic console (https://console.anthropic.com/)
2. Save the key via the extension popup (encrypted with AES-GCM-256)
3. Verify key with built-in validator in popup

**Implementation Steps:**
1. ClaudeTranslator class is in `extension/background/claude-translator.js`
2. Translation is triggered from Content Script via `chrome.runtime.sendMessage()`
3. Service Worker routes messages to ClaudeTranslator instance
4. Results are sent back to Content Script for display

**Key Code Locations:**
- Translation API calls: `extension/background/claude-translator.js:85` (_callClaudeAPI method)
- API validation: `extension/background/claude-translator.js:265` (validateApiKey static method)
- Message handling: `extension/background/service-worker.js` (search for TRANSLATE_TEXT handler)
- Display integration: `extension/content/content.js` (displayBilingualSubtitle function)

**Critical CORS Header:**
All Claude API requests MUST include the header:
```javascript
'anthropic-dangerous-direct-browser-access': 'true'
```
This is Anthropic's security mechanism for browser-based API access. Without it, requests fail with HTTP 401.

**Cost Monitoring:**
- ClaudeTranslator tracks tokens and costs automatically
- Call `translator.getStats()` to get current usage
- Pricing: $0.80 per 1M input tokens, $4.00 per 1M output tokens (Haiku 4.5)
- Set reasonable `maxTokens` limits to control costs

### Debugging Speech Recognition Issues

1. Check which engine is selected (Web Speech API vs Deepgram)
2. Verify browser microphone permissions
3. Monitor Service Worker console for audio capture errors
4. Check for heartbeat timeout messages (speech API crashes)
5. Test with different languages and audio quality

### Debugging Subtitle Display Issues

1. Verify Content Script is injected (check console on target page)
2. Check subtitle container z-index conflicts
3. Verify language codes (zh-TW, en, ja, etc.)
4. Monitor translation cache hit rate
5. Check for DOM manipulation interference by other scripts

### Performance Optimization

1. Monitor translation cache efficiency (should be 80%+ hit rate for repeated text)
2. Use interim results from Speech API for responsiveness
3. Limit subtitle buffer size to prevent memory bloat
4. Batch API requests when possible (not applicable for real-time)
5. Profile extension resource usage via DevTools

---

## Troubleshooting

### Claude API Issues

**Problem: HTTP 401 Unauthorized Error**
- Cause: Usually missing the critical CORS header `'anthropic-dangerous-direct-browser-access': 'true'`
- Solution: Verify this header is present in all fetch requests to Claude API
- Alternative: Verify API key is valid by testing with curl:
  ```bash
  curl -X POST https://api.anthropic.com/v1/messages \
    -H "x-api-key: YOUR_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "content-type: application/json" \
    -d '{"model":"claude-haiku-4-5-20251001","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
  ```

**Problem: API Key validation fails in popup**
- Check API key format (should start with `sk-ant-`)
- Verify key hasn't been rotated or revoked
- Check network connectivity
- Review Service Worker console for detailed error messages
- Note: Validator automatically tries Claude 3.5 Haiku as fallback if 4.5 fails

**Problem: Translation returns empty results**
- Check text length (very short texts may fail)
- Verify target language code is valid (zh-TW, en, ja, etc.)
- Check max_tokens setting (should be at least 100 for short texts)
- Verify API key has sufficient balance/quota
- Check token usage in translator.getStats()

**Problem: High translation costs**
- Monitor translation cache hit rate (should be 80%+)
- Check for excessive unique translations (poor cache efficiency)
- Consider using Claude 3.5 Haiku instead of 4.5 for cost savings
- Implement text deduplication to improve cache hits
- Set reasonable maxTokens limits

### Speech Recognition Issues

**Problem: No subtitles appearing**
1. Check if correct engine is selected (Web Speech API vs Deepgram)
2. Verify microphone/tab audio is working
3. Check browser console for Content Script errors
4. Verify Service Worker is running (check DevTools background page)

**Problem: Frequent speech API crashes**
- Monitor heartbeat timeout messages
- Check for insufficient memory
- Test with different browsers/versions
- Consider restarting recognition periodically

**Problem: Deepgram WebSocket connection fails**
- Verify Deepgram API key is valid
- Check network connectivity
- Verify wss:// protocol is supported
- Review Service Worker console for detailed error logs

### Subtitle Display Issues

**Problem: Subtitles not showing on page**
- Verify Content Script is injected (check console on page)
- Check for CSP (Content Security Policy) violations
- Verify subtitle container z-index is high enough
- Check for DOM manipulation by other scripts
- Ensure language code is set correctly

**Problem: Subtitle text is cut off**
- Increase maxChars setting in subtitle buffer
- Adjust CSS font-size or container width
- Check for CSS conflicts with page styles
- Reduce word count per subtitle

### Debugging & Logging

**Enable Debug Logging:**
- Open Service Worker console: Extension Details → Background page
- Open Content Script console: Right-click page → Inspect → Console
- Check for `[Background]`, `[Claude Translator]`, `[Content]` prefixed messages

**Monitor API Usage:**
```javascript
// In Service Worker console
claudeTranslator.getStats()
// Returns: { totalTranslations, cacheHits, apiCalls, totalInputTokens,
//           totalOutputTokens, estimatedCost, cacheHitRate, etc. }
```

**Test API Key:**
1. Open extension popup
2. Paste API key in "Claude API Key" field
3. Click "Test" button
4. Check console for validation result

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

**Start here (in order):**
1. Read this CLAUDE.md file (overview and conventions)
2. Review README.md for project overview and setup
3. Review SDD.md for detailed architecture (sections 2-4 are most important)
4. Check extension/manifest.json for permissions and structure
5. Examine extension/background/service-worker.js for message routing
6. Review extension/background/claude-translator.js for translation implementation
7. Check recent commits in DEVLOG.md for latest changes

**Key questions to answer:**
- How do the Web Speech API, Deepgram, and Claude API integrate?
- What does the ClaudeTranslator class do? (encryption, caching, cost tracking)
- How does message passing work between popup, service worker, and content script?
- How are API keys encrypted and stored?
- What is the critical CORS header and why is it needed?
- How does the translation cache work and what's the expected hit rate?

**Chrome Extension Manifest V3 specifics:**
- Service Worker replaces Background Page
- Offscreen Document required for audio processing (no background page)
- Message passing: chrome.runtime.sendMessage() for cross-component communication
- Permissions: tabCapture, tabs, activeTab, host_permissions for APIs
- Storage: chrome.storage.local for user settings and encrypted API keys

---

## Additional Resources

### Subtitle Format Specifications

- **SRT (SubRip)**: [Link to specification]
- **WebVTT**: https://w3c.github.io/webvtt/
- **ASS/SSA**: [Link to specification]
- **TTML**: https://www.w3.org/TR/ttml/

### Related Projects

*[Add links to related projects, libraries, or tools]*

### Documentation

*[Add links to additional documentation]*

---

## Maintenance Notes

**Last Updated**: 2025-12-22
**Phase**: 3.1 (Claude AI Translation Implementation Complete)
**Maintainer**: Claude AI Assistant

### Recent Updates (2025-12-22)
- Updated Tech Stack to reflect Chrome Extension architecture with Web Speech API, Deepgram, and Claude API
- Updated Repository Structure with actual file/directory organization
- Added Claude API implementation guide (setup, critical CORS header, cost monitoring)
- Added comprehensive troubleshooting for Claude API errors, speech recognition, and subtitle display
- Enhanced "Understanding the Codebase" with Chrome Extension Manifest V3 specifics

### Update Checklist

This document should be updated when:
- [ ] New features are added (e.g., Phase 4 model improvements)
- [ ] Development workflow changes
- [ ] New conventions are established
- [ ] Dependencies change significantly (e.g., Claude API version update)
- [ ] Deployment process changes
- [ ] New common issues are discovered and resolved

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
