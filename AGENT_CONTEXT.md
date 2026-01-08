# Agent Context & Session History

**Last Updated:** January 8, 2026
**Branch:** `claude/improve-plugin-ux-Jd1qa`
**Status:** Active Development - Auto-Analysis Feature

---

## Project Overview

**Job Hunt Assistant** is a Chrome/Edge extension that analyzes job postings using Claude AI. The extension automatically detects job postings on LinkedIn, Greenhouse, and Lever, extracts job data, and provides AI-powered analysis with personalized recommendations.

**Tech Stack:** Vanilla JavaScript (ES6+), Chrome Extension Manifest V3, Claude Sonnet 4.5 API

---

## Session Objectives Completed

### ✅ 1. UX Improvements (Original Request)
**User's Top 3 Priorities:**

1. **Resume Upload** - Allow users to upload resumes for personalized analysis
   - Status: ✅ DONE
   - Implementation: .txt file upload in Settings tab
   - Storage: chrome.storage.local (30KB limit)
   - Integration: Passed to Claude API with job description

2. **Wider Popup** - Increase popup width from 450px to 750px
   - Status: ✅ DONE
   - popup width: 450px → 750px
   - modal width: 600px → 900px
   - Makes analysis much more readable on laptops

3. **Bottom Line Up Front (BLUF)** - Lead with verdict, not job description
   - Status: ✅ DONE
   - New format: 🎯 VERDICT (2-3 sentences) at top
   - Removed job description echo from response
   - Clear sections: Key Responsibilities, Skills, Tech Stack, Red/Green Flags, Match Score
   - Job description explicitly excluded: "CRITICAL: Do NOT repeat or echo the job description"

### ✅ 2. Auto-Analysis on Tab Open (User Follow-up Request)

**User Request:** "The analysis takes a while. Can we run analysis on tab-open so I can open multiple jobs and have analyses waiting?"

**Implementation:**
- Settings toggle: "Enable auto-analysis on tab open"
- Background script monitors `chrome.tabs.onUpdated`
- Detects job posting URLs via regex patterns
- Sends `autoAnalyze` message to content script
- Tracks analyzed URLs (not tab IDs) to prevent duplicates
- 2-second delay before triggering to let LinkedIn settle
- Works across LinkedIn, Greenhouse, Lever

**Key Technical Details:**
- Changed from tracking tab IDs → tracking URLs (LinkedIn reuses tabs)
- LinkedIn fires multiple 'complete' events per page load
- Content script waits up to 10 seconds for DOM to render (20 attempts × 500ms)

### ✅ 3. Career Preferences Field (User Follow-up Request)

**User Request:** Add context about user's career situation (seniority, preferences, constraints)

**Implementation:**
- New textarea in Settings: "Career Preferences & Context"
- 1000 character limit with live counter
- Stored in chrome.storage.local
- Passed to Claude API alongside resume and job description
- Examples: "Looking for mid-level, not staff" or "Remote-first only" or "Strong at Python, learning Go"

---

## Major Bugs Fixed

### 🐛 Bug #1: Syntax Error - Missing Comma
**Issue:** `Uncaught SyntaxError: Unexpected token 'async'`
**Root Cause:** Missing comma between `waitForLinkedInRender` and `extractLinkedIn` methods in JobExtractor object literal
**Fix:** Added comma after `waitForLinkedInRender` method
**Commit:** `b3a2ce1`

### 🐛 Bug #2: Auto-Analysis Marking Tabs Too Early
**Issue:** Tab marked as "analyzed" immediately, but LinkedIn fires multiple "complete" events. Second event gets skipped even though page isn't ready yet.
**Root Cause:** Tracking by tab ID instead of URL
**Fix:** Changed `analyzedTabs` (Set of tab IDs) → `analyzedUrls` (Set of URLs)
**Result:** Each unique job URL can trigger analysis independently
**Commit:** `f54fd60`

### 🐛 Bug #3: LinkedIn Rendering Too Slow
**Issue:** Extension gave up waiting after 5 seconds (10 attempts × 500ms), but LinkedIn takes longer
**Symptoms:** "Gave up waiting after 10 attempts", "Found 0 h1 elements"
**Fix:**
- Increased attempts: 10 → 20 (5s → 10s total wait)
- Increased background delay: 1s → 2s before sending message
**Commit:** `f54fd60`

### 🐛 Bug #4: Content Script Not Loading
**Issue:** `window.JobExtractor` returning `undefined`
**Root Cause:** Extension reloaded but old tabs don't get new content scripts
**Fix:** User must close and reopen tabs after extension reload
**Note:** This is a Chrome limitation, not a bug we can fix

---

## Known Issues & Current Challenges

### ⚠️ CRITICAL: LinkedIn Selector Failures

**Symptoms:**
```
🔍 DEBUG: Found 0 h1 elements on page
Could not find job title. Tried 12 selectors.
Could not find company. Tried 10 selectors.
Could not find description. Tried 10 selectors.
Job description is empty
```

**Root Cause:** LinkedIn's Single Page App (SPA) architecture
- React components render dynamically after page "complete" event
- Class names change frequently (obfuscated webpack builds)
- Different layouts for: direct job view vs. collection view
- Some pages take 10+ seconds to fully render

**Current Status:**
- Working on SOME LinkedIn pages (verified with "C++ Engineer" job)
- Failing on OTHERS (collection view URLs like `/jobs/collections/top-applicant/`)
- Inconsistent success rate

**Attempted Fixes:**
1. ✅ Added `waitForLinkedInRender()` - polls up to 20 times (10 seconds)
2. ✅ Multiple selector fallbacks (12 for title, 10 for company, 10 for description)
3. ✅ Debug logging to identify actual DOM structure
4. ⏳ Need more selectors based on current LinkedIn structure

**Next Steps:**
1. Test on actual LinkedIn job page
2. Copy exact console output showing all h1 elements and container checks
3. Inspect DOM to find current class names
4. Add new selectors to arrays in `lib/extractor.js`

---

## Technical Architecture

### Key Files Modified

**Core Extension Files:**
- `manifest.json` - Added "tabs" permission for auto-analysis
- `popup.html` - Wider layout (750px), new UI sections (auto-analyze, resume, preferences)
- `popup.js` - Event handlers for new features, resume upload, preferences save
- `content.js` - Auto-analyze message listener, async extraction
- `background.js` - Tab monitoring, URL tracking, auto-analysis trigger
- `lib/extractor.js` - Async LinkedIn extraction, intelligent page waiting
- `lib/claude-client.js` - Updated prompt with BLUF, resume, and preferences
- `lib/storage.js` - Resume and preferences storage methods

### Data Flow (Auto-Analysis)

```
1. User opens LinkedIn job in new tab
   ↓
2. chrome.tabs.onUpdated fires (status: 'complete')
   ↓
3. background.js checks:
   - Is this a job posting URL? (regex match)
   - Auto-analyze enabled in settings?
   - API key configured?
   - URL already analyzed?
   ↓
4. Background sends message after 2s delay
   ↓
5. content.js receives 'autoAnalyze' message
   ↓
6. content.js calls handleAnalyzeClick()
   ↓
7. JobExtractor.extract() waits for LinkedIn render
   - Polls 20 times (500ms intervals)
   - Checks for h1 elements, job cards, description containers
   ↓
8. Extraction completes (or fails after 10s)
   ↓
9. background.js sends to Claude API
   - Includes: job data + resume + preferences
   ↓
10. Analysis saved to chrome.storage.local
    ↓
11. Badge updated, popup shows "View Analysis" button
```

### Storage Schema

```javascript
chrome.storage.local = {
  claudeApiKey: "sk-ant-...",           // User's Claude API key
  resume: "text content...",             // Resume text (max 30KB)
  resumeUploadedAt: "2026-01-08T...",   // ISO timestamp
  preferences: "text content...",        // Career preferences (max 1000 chars)
  settings: {
    autoAnalyze: true/false,             // Auto-analyze on tab open
    showNotifications: true,             // Show toast notifications
    analysisDepth: 'detailed'            // Analysis verbosity
  },
  jobs: [                                // Array of analyzed jobs
    {
      id: "job_abc123_1234567890",      // Generated hash
      platform: "linkedin",              // linkedin|greenhouse|lever
      jobTitle: "Senior Engineer",
      company: "TwentyAI",
      description: "Long text...",
      location: "NYC",
      techStack: ["Python", "Go"],       // Extracted keywords
      url: "https://...",
      analysis: "Claude's response...",  // Full analysis text
      analyzedAt: "2026-01-08T...",     // ISO timestamp
      extractedAt: "2026-01-08T..."     // ISO timestamp
    }
  ]
}
```

---

## Important Code Patterns

### Adding New Selectors to LinkedIn Extractor

When LinkedIn changes their DOM:

```javascript
// lib/extractor.js - line ~100
const jobTitleSelectors = [
  // Add new selectors at TOP of array (tried first)
  '.new-class-name h1',
  '.another-new-class',
  // Existing selectors below...
  '.job-details-jobs-unified-top-card__job-title h1',
  // ...
];
```

### Tracking Analyzed Items

```javascript
// ❌ WRONG - Don't track by tab ID
const analyzedTabs = new Set([1234, 5678]);

// ✅ CORRECT - Track by URL
const analyzedUrls = new Set([
  'https://linkedin.com/jobs/view/4330596291/',
  'https://linkedin.com/jobs/view/4345950348/'
]);
```

### Async Extraction Pattern

```javascript
// content.js - handleAnalyzeClick()
const jobData = await window.JobExtractor?.extract();  // Now async!

// lib/extractor.js
async extract() {
  // ...
  return await this.extractLinkedIn();  // LinkedIn needs waiting
}

async extractLinkedIn() {
  await this.waitForLinkedInRender();  // Wait up to 10 seconds
  // Now extract...
}
```

---

## Testing Checklist

**Before committing selector changes:**

1. ✅ Extension reloaded in `chrome://extensions`
2. ✅ All LinkedIn tabs closed
3. ✅ Fresh LinkedIn job opened
4. ✅ Console shows: "✅ LinkedIn page is ready!"
5. ✅ Console shows: "Found X h1 elements" (X > 0)
6. ✅ Console shows: "Found job title using selector: ..."
7. ✅ Console shows: "Found description using selector: ..."
8. ✅ Notification appears: "🤖 Auto-analyzing this job..."
9. ✅ Analysis completes within 60 seconds
10. ✅ Popup shows job with "View Analysis" button
11. ✅ Analysis displays with BLUF verdict at top

**Test on multiple URLs:**
- Direct job view: `linkedin.com/jobs/view/[ID]/`
- Collection view: `linkedin.com/jobs/collections/top-applicant/?currentJobId=[ID]`
- Search results: `linkedin.com/jobs/search/?keywords=engineer`

---

## Development Tips for Next Agent

### If Auto-Analysis Isn't Working:

1. **Check background console:**
   ```
   chrome://extensions → "service worker" → Console
   Look for: 🔴 "Auto-analyze is DISABLED"
   ```

2. **Check page console:**
   ```
   F12 on LinkedIn tab → Console
   Look for: "Found 0 h1 elements" or "Could not find job title"
   ```

3. **Verify settings:**
   - Extension popup → Settings tab
   - "Enable auto-analysis on tab open" checkbox MUST be checked
   - API key must be configured

4. **Hard reset:**
   - Reload extension
   - Close ALL LinkedIn tabs
   - Open fresh job in new tab
   - Wait 15 seconds

### If Selectors Are Failing:

1. **Get current DOM structure:**
   ```javascript
   // In LinkedIn page console:
   document.querySelectorAll('h1')  // Find job title element
   document.querySelector('.jobs-description')  // Find description
   ```

2. **Inspect element:**
   - Right-click job title → Inspect
   - Look for stable class names (avoid randomized hashes)
   - Look for `data-*` attributes (more stable than classes)

3. **Add to selector arrays:**
   ```javascript
   // lib/extractor.js
   const jobTitleSelectors = [
     '.new-stable-class',  // Add at TOP
     // existing selectors...
   ];
   ```

### If LinkedIn Times Out:

- Increase wait attempts in `lib/extractor.js:76`
- Current: `maxAttempts = 20` (10 seconds)
- Try: `maxAttempts = 30` (15 seconds)
- Or increase delay: `delay = 1000` (30 seconds total)

---

## Git Commits Summary

| Commit | Summary |
|--------|---------|
| `0024b84` | Improve plugin UX: wider popup, BLUF, resume upload |
| `5728b08` | Add auto-analysis on tab open and career preferences |
| `ec8975d` | Add comprehensive logging for auto-analysis debugging |
| `a5fca4d` | Add extensive debugging for LinkedIn selector detection |
| `b629000` | Fix auto-analysis timing with intelligent page waiting |
| `b3a2ce1` | Fix syntax error: missing comma after waitForLinkedInRender |
| `f54fd60` | Fix auto-analysis timing: track URLs not tabs, increase wait time |

---

## Quick Reference Commands

```bash
# Reload and test
git add -A
git commit -m "Description"
git push origin claude/improve-plugin-ux-Jd1qa

# Check logs in background console
chrome://extensions → Job Hunt Assistant → "service worker"

# Check logs on page
F12 on LinkedIn tab → Console → Filter: "Job Hunt Assistant"

# Test extraction manually
window.JobExtractor.detectPlatform()  // Should return "linkedin"
await window.JobExtractor.extract()   // Should return job data object
```

---

## Recent Improvements (January 8, 2026 - Continued Session)

### ✅ Enhanced LinkedIn Selector Robustness
**Changes Made:**
1. **Expanded Page Readiness Detection** (lib/extractor.js:76-102)
   - Added `.scaffold-layout__detail` and `.scaffold-layout--reflow` checks
   - Added `[data-job-id]` attribute check
   - Added `.jobs-details__main-content` container check
   - More comprehensive description selector checks
   - Now detects 5 different page layout indicators instead of 3

2. **Expanded Job Title Selectors** (12 → 23 selectors)
   - Added scaffold layout variations
   - Added inline class variations (h1.t-24.t-bold.inline, h1.t-20)
   - Added data attribute fallbacks
   - Added main/job-view-layout container targeting

3. **Expanded Description Selectors** (10 → 21 selectors)
   - Added show-more-less variations
   - Added scaffold layout targeting
   - Added data attribute selectors
   - Added generic fallbacks within job containers

4. **Intelligent Fallback Logic** (lib/extractor.js:228-282)
   - Job title fallback: Scans ALL h1 elements, filters by length/content
   - Description fallback: Now USES best text-heavy candidate instead of just logging
   - Smart filtering: Excludes navigation text ("sign in", "join now", "messaging")
   - Sorts candidates by text length to find main content

**Expected Impact:**
- Should detect and extract from more LinkedIn page layouts
- More resilient to LinkedIn UI changes
- Better chance of extracting job data even when primary selectors fail

## Next Session TODO

### High Priority
1. **Test Enhanced Selectors** - Verify improvements work on failing pages
   - Test on collection view URLs that previously failed
   - Test on direct job view to ensure no regression
   - Monitor console for fallback activation

2. **Add company/location extraction** - Currently returning empty strings
   - These fields are nice-to-have but not critical
   - Job title + description are sufficient for analysis

### Medium Priority
3. **Increase wait time if needed** - Some pages take 10+ seconds
4. **Add MutationObserver** - Detect when LinkedIn finishes rendering instead of polling
5. **Better error messages** - Tell user when selectors fail vs. when page times out

### Low Priority
6. **Support PDF/DOCX resumes** - Currently only .txt supported
7. **Add match score badges** - Show score on job cards in popup
8. **Search/filter jobs** - Filter by platform, sort by score

---

## Contact & Resources

- **Repository:** https://github.com/RyanShinra/job-hunt-helper
- **Branch:** `claude/improve-plugin-ux-Jd1qa`
- **Claude Model:** Sonnet 4.5 (`claude-sonnet-4-5-20250929`)
- **Chrome Extension Docs:** https://developer.chrome.com/docs/extensions/mv3/

---

**End of Context Document**
