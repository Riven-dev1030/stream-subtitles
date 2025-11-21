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
*[To be updated as project develops]*

**Expected components:**
- Language/Runtime: [e.g., Node.js, Python, Go]
- Frameworks: [e.g., Express, FastAPI, etc.]
- Subtitle formats: [e.g., SRT, WebVTT, ASS]
- Streaming protocols: [e.g., WebSocket, HLS, RTMP]
- Dependencies: [List major dependencies]

### Project Goals
- Real-time subtitle generation and/or processing
- Support for multiple subtitle formats
- Stream integration capabilities
- [Add specific goals as they become clear]

---

## Repository Structure

```
stream-subtitles/
├── src/                    # Source code
│   ├── core/              # Core subtitle processing logic
│   ├── stream/            # Streaming integration
│   ├── formats/           # Subtitle format parsers/generators
│   ├── utils/             # Utility functions
│   └── api/               # API endpoints (if applicable)
├── tests/                 # Test files
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── fixtures/          # Test data and fixtures
├── docs/                  # Documentation
├── scripts/               # Build and deployment scripts
├── config/                # Configuration files
└── examples/              # Usage examples

*[Update this structure as the actual codebase develops]*
```

### Key Directories

**`src/`**
- Main application source code
- Organized by feature/domain

**`tests/`**
- All test files mirror the `src/` structure
- Use descriptive test names that explain the behavior being tested

**`docs/`**
- API documentation
- Architecture diagrams
- Setup guides

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

### Adding a New Subtitle Format

1. Create parser in `src/formats/<format-name>-parser.js`
2. Create generator in `src/formats/<format-name>-generator.js`
3. Implement format validation
4. Add comprehensive tests with sample files
5. Update documentation
6. Register format in the main format registry

### Debugging Subtitle Sync Issues

1. Check timestamp parsing logic
2. Verify timestamp calculations
3. Test with various video frame rates
4. Check for rounding errors in time conversions
5. Validate against reference implementations

### Performance Optimization

1. Profile the application to identify bottlenecks
2. Consider streaming/chunking for large subtitle files
3. Cache parsed subtitles when appropriate
4. Optimize regex patterns in parsers
5. Use efficient data structures

---

## Troubleshooting

### Common Issues

**Problem: Timestamps are off-sync**
- Check video frame rate assumptions
- Verify timestamp format parsing
- Look for rounding errors in conversions

**Problem: Special characters not displaying correctly**
- Verify UTF-8 encoding is being used
- Check BOM handling
- Validate character encoding in subtitle files

**Problem: Parser failing on valid files**
- Check for format variations (e.g., different line endings)
- Validate against format specifications
- Add more lenient parsing where appropriate

### Debug Mode

*[Add instructions for enabling debug mode]*

### Logging

*[Add information about logging configuration and levels]*

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
- What subtitle formats are currently supported?
- How are timestamps represented internally?
- What are the main APIs/interfaces?
- How is error handling done?
- What are the performance characteristics?

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

**Last Updated**: 2025-11-21
**Maintainer**: [To be assigned]

### Update Checklist

This document should be updated when:
- [ ] New features are added
- [ ] Development workflow changes
- [ ] New conventions are established
- [ ] Dependencies change significantly
- [ ] Deployment process changes

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
