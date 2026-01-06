# Job Hunt Assistant - Project Summary

## Overview

**Job Hunt Assistant** is a Chrome/Edge browser extension that helps job seekers analyze job postings using Claude AI. The extension automatically detects job postings on supported platforms, extracts relevant information, and provides AI-powered insights to help users make informed decisions about job opportunities.

**Repository**: https://github.com/RyanShinra/job-hunt-helper
**Current Version**: 1.0.0
**Tech Stack**: JavaScript (ES6+), Chrome Extension APIs, Claude AI API
**Manifest Version**: 3 (latest Chrome extension platform)

---

## Project Status (as of January 6, 2026)

### ✅ Completed Features

1. **Multi-Platform Job Detection**
   - LinkedIn Jobs (`*.linkedin.com/jobs/*`)
   - Greenhouse (`boards.greenhouse.io/*`)
   - Lever (`jobs.lever.co/*`)

2. **Automated Data Extraction**
   - Job title
   - Company name
   - Job description
   - Location
   - Tech stack detection (30+ technologies)

3. **Claude AI Integration**
   - Uses Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`)
   - Comprehensive job analysis with 9 sections:
     - Summary
     - Key Responsibilities
     - Required Skills
     - Tech Stack
     - Experience Level
     - Red Flags
     - Green Flags
     - Interview Questions
     - Match Score (1-10)

4. **User Interface**
   - Floating "Analyze with Claude" button on job pages
   - Extension popup with Jobs and Settings tabs
   - Job history management
   - API key configuration and testing

5. **Security Features**
   - Prompt injection sanitization
   - Sender validation for message passing
   - Secure local storage for API keys
   - Error message sanitization

6. **Developer Experience**
   - Comprehensive logging for debugging
   - Test page for local development
   - Modular code architecture
   - Detailed comments and documentation

---

## Recent Development Work

### Branch: `claude/job-hunt-assistant-extension-EGTOU`

**Commits**: 10+ commits focused on core functionality and reliability

**Key Achievements**:
1. Initial extension scaffold with Manifest V3
2. Job extraction logic for LinkedIn, Greenhouse, Lever
3. Claude API integration
4. Security hardening (prompt injection prevention, input sanitization)
5. API key management and validation
6. Upgraded to Claude Sonnet 4.5 (Oct 2025 - previous model retired)
7. Enhanced error handling and user feedback
8. Added detailed debugging logs

### Branch: `claude/fix-job-data-extraction-fzagO`

**Purpose**: Fix critical LinkedIn data extraction failures
**Status**: ✅ Complete and ready for merge
**Test Results**: Verified working on production LinkedIn URLs

**Key Achievements**:

#### 1. LinkedIn Selector Robustness (`lib/extractor.js`)
- **Problem**: LinkedIn frequently changes CSS class names, breaking static selectors
- **Solution**: Implemented fallback selector system
  - Added `_trySelectors()` helper that tries multiple selectors in priority order
  - Job title: 12 selector variants
  - Company name: 10 selector variants
  - Description: 10 selector variants
  - Location: 7 selector variants
- **Added Support**: LinkedIn jobs collection/sidebar view (previously unsupported URL pattern)
- **Debug Output**: Logs which selector succeeds for each field

#### 2. Timeout Fix (`content.js`)
- **Problem**: Content script timeout (30s) shorter than API timeout (60s)
- **Symptom**: "Background script communication timeout" errors
- **Solution**: Increased MESSAGE_TIMEOUT from 30s to 90s
- **Result**: Reliable analysis completion

#### 3. Merged Latest Improvements
- Integrated all work from `claude/job-hunt-assistant-extension-EGTOU`
- Claude Sonnet 4.5 upgrade
- Enhanced logging
- Better error messaging

**Commits**:
1. `c01cdf1` - Fix LinkedIn job data extraction with robust selector fallbacks
2. `6b6ce2b` - Merge latest changes from claude/job-hunt-assistant-extension-EGTOU
3. `bde6840` - Add selector debugging and jobs collection view support
4. `3cce2b9` - Fix timeout mismatch between content script and API calls

---

## Architecture

### File Structure

```
job-hunt-assistant/
├── manifest.json              # Extension configuration (Manifest V3)
├── background.js             # Service worker - handles API calls, storage
├── content.js                # Content script - injected into job pages
├── content.css               # Styles for floating button and notifications
├── popup.html                # Extension popup UI
├── popup.js                  # Popup logic and event handling
├── lib/
│   ├── extractor.js          # Job data extraction (LinkedIn, Greenhouse, Lever)
│   ├── claude-client.js      # Claude API wrapper with security features
│   └── storage.js            # Chrome storage API wrapper
├── icons/                    # Extension icons (16x16, 48x48, 128x128)
├── test-job-page.html        # Local test page mimicking LinkedIn
├── README.md                 # User documentation
└── PROJECT_SUMMARY.md        # This file
```

### Key Components

#### **Content Script** (`content.js`)
- Runs on job posting pages
- Platform detection via `JobExtractor.detectPlatform()`
- Creates floating "Analyze with Claude" button
- Extracts job data and sends to background script
- Shows notifications and button state feedback
- Rate limiting (2s between requests)

#### **Job Extractor** (`lib/extractor.js`)
- Platform-specific extraction methods
- `extractLinkedIn()` - 40+ selector variants with fallbacks
- `extractGreenhouse()` - Greenhouse-specific selectors
- `extractLever()` - Lever-specific selectors
- `extractTechStack()` - Keyword matching for 30+ technologies
- **New**: `_trySelectors()` helper for robust selector fallback

#### **Background Service Worker** (`background.js`)
- Message handler for content script and popup
- API call orchestration via `ClaudeClient`
- Storage operations via `Storage` helper
- Badge counter (shows # of analyzed jobs)
- Security: sender validation, error sanitization

#### **Claude Client** (`lib/claude-client.js`)
- API endpoint: `https://api.anthropic.com/v1/messages`
- Model: `claude-sonnet-4-5-20250929`
- Max tokens: 4096
- Timeout: 60s with retry logic
- **Security Features**:
  - Prompt injection detection and sanitization
  - Input length limiting (50,000 chars)
  - API key format validation
  - Error message sanitization
- `buildAnalysisPrompt()` - Constructs structured prompt for Claude

#### **Storage Helper** (`lib/storage.js`)
- Wrapper for Chrome Storage API
- Job CRUD operations
- Settings management
- API key storage (encrypted by Chrome)

---

## Technical Highlights

### Security Measures

1. **Prompt Injection Prevention**
   - Detects and sanitizes 10+ injection patterns
   - Replaces suspicious patterns with `[REDACTED]`
   - Examples blocked: "ignore previous instructions", "you are now", etc.

2. **Message Passing Security**
   - Validates sender ID matches extension ID
   - Rejects messages from external sources

3. **Error Sanitization**
   - Removes stack traces and file paths from user-facing errors
   - Provides user-friendly error messages

4. **Input Validation**
   - API key format validation (`sk-ant-` prefix)
   - Length limiting to prevent context overflow

### Reliability Features

1. **Timeout Protection**
   - 60s timeout on API calls with AbortController
   - 90s timeout on message passing
   - Proper cleanup on timeout

2. **Rate Limiting**
   - 2s cooldown between analyze requests
   - Prevents API quota exhaustion

3. **Graceful Degradation**
   - Saves job data even if analysis fails
   - Continues operation with empty API key (shows helpful error)

4. **Debugging Support**
   - Comprehensive console logging
   - Selector success/failure tracking
   - Request/response logging

---

## Known Issues & Maintenance

### Ongoing Challenges

1. **LinkedIn DOM Changes**
   - LinkedIn frequently updates CSS class names (monthly)
   - Requires periodic selector updates
   - **Current Solution**: Fallback selector system reduces maintenance burden
   - **Monitoring**: Debug logs show which selectors are being used

2. **API Costs**
   - Each analysis costs ~1,000-3,000 tokens
   - Users need their own API key
   - No built-in usage tracking

3. **Platform Coverage**
   - Only 3 platforms supported (LinkedIn, Greenhouse, Lever)
   - Popular platforms like Indeed, Glassdoor not yet supported

### Testing Strategy

1. **Manual Testing**
   - `test-job-page.html` - Local test page
   - Live testing on actual job platforms
   - Console log verification

2. **No Automated Tests**
   - Currently no unit tests or integration tests
   - Relies on manual QA

---

## Development Timeline

### Phase 1: Initial Development (Branch: `claude/job-hunt-assistant-extension-EGTOU`)
- ✅ Extension scaffolding
- ✅ Basic extraction logic
- ✅ Claude API integration
- ✅ Security hardening
- ✅ UI polish
- ✅ Model upgrade to Claude Sonnet 4.5

### Phase 2: Bug Fixes (Branch: `claude/fix-job-data-extraction-fzagO`)
- ✅ LinkedIn selector failures fixed
- ✅ Jobs collection view support added
- ✅ Timeout mismatch resolved
- ✅ Debug logging enhanced

### Phase 3: Future Work (Not Started)
See "Future Enhancements" section below

---

## Pull Request Ready

**Branch**: `claude/fix-job-data-extraction-fzagO`
**Target**: `claude/job-hunt-assistant-extension-EGTOU`
**Status**: Ready to merge

**To create PR**, visit:
```
https://github.com/RyanShinra/job-hunt-helper/compare/claude/job-hunt-assistant-extension-EGTOU...claude/fix-job-data-extraction-fzagO
```

**PR Summary**:
- Fixes critical LinkedIn data extraction failures
- Adds support for LinkedIn jobs collection view
- Resolves timeout errors during API calls
- Adds comprehensive debugging output
- Verified working on production URLs

---

## Future Enhancements

### High Priority
- [ ] Add support for Indeed, Glassdoor, ZipRecruiter
- [ ] Implement usage tracking (token counter)
- [ ] Add automated tests (unit + integration)
- [ ] Chrome Web Store publication

### Medium Priority
- [ ] Job comparison feature (side-by-side analysis)
- [ ] Export to PDF/Markdown
- [ ] Custom analysis prompts (user-configurable)
- [ ] Resume matching and gap analysis

### Low Priority
- [ ] Salary estimation using Claude
- [ ] Interview prep suggestions
- [ ] Integration with Notion/Airtable
- [ ] Browser notifications for saved jobs

### Maintenance
- [ ] Set up automated selector monitoring
- [ ] Create selector update workflow
- [ ] Add telemetry for extraction failures
- [ ] Build automated test suite

---

## Development Guidelines

### Adding New Platforms

1. **Update `manifest.json`**: Add URL patterns to `content_scripts.matches` and `host_permissions`
2. **Add detector**: Update `JobExtractor.detectPlatform()`
3. **Create extractor**: Add `extractNewPlatform()` method
4. **Test locally**: Use DevTools to find correct selectors
5. **Document**: Update README with new platform

### Updating Selectors

1. **Identify failing platform**: Check console logs
2. **Inspect DOM**: Use browser DevTools (F12)
3. **Find stable selectors**: Prefer `data-*` attributes over classes
4. **Update extractor**: Add new selectors to array in priority order
5. **Test thoroughly**: Verify on multiple job postings
6. **Document changes**: Update comments explaining selector purpose

### Best Practices

1. **Always use fallback selectors** (array of options)
2. **Add debug logging** for troubleshooting
3. **Sanitize user inputs** to prevent injection attacks
4. **Handle errors gracefully** with user-friendly messages
5. **Test on real job pages** before committing

---

## Dependencies

### Runtime
- Chrome Extension APIs (built-in)
- Claude API (external, requires API key)

### Development
- No build tools required
- No npm packages
- Pure JavaScript (ES6+)
- No transpilation needed

### Browser Requirements
- Chrome 88+ or Edge 88+ (Manifest V3 support)
- Modern JavaScript support (ES6+)

---

## API Usage & Costs

**Model**: Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`)
**Typical Token Usage**: 1,000-3,000 tokens per analysis
**Pricing**: See [Anthropic Pricing](https://www.anthropic.com/pricing)

**Example Cost** (as of Jan 2026):
- Input: ~500 tokens (job description)
- Output: ~1,500 tokens (analysis)
- Cost: ~$0.015-0.045 per analysis (varies by model pricing)

---

## Contributing

### Current Contributors
- Development by Claude AI (Anthropic)
- Repository owner: @RyanShinra

### How to Contribute
1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## License

**MIT License** - See LICENSE file for details

---

## Contact & Support

- **Issues**: https://github.com/RyanShinra/job-hunt-helper/issues
- **Documentation**: See README.md
- **API Key**: https://console.anthropic.com/

---

## Changelog

### v1.0.0 (In Progress)
- Initial release
- LinkedIn, Greenhouse, Lever support
- Claude Sonnet 4.5 integration
- Local job history
- API key management
- Security features

### Recent Updates (Branch: `claude/fix-job-data-extraction-fzagO`)
- **Fixed**: LinkedIn data extraction failures
- **Added**: Jobs collection view support
- **Fixed**: Timeout errors during API calls
- **Enhanced**: Debug logging output

---

**Last Updated**: January 6, 2026
**Document Version**: 1.0
**Next Review**: When adding new features or platforms
