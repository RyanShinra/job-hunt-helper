/**
 * Background Service Worker
 * Handles API calls and communication between content script and popup
 */

// Import storage and Claude client helpers
importScripts('lib/storage.js', 'lib/claude-client.js');

console.log('Job Hunt Assistant: Background service worker loaded');

/**
 * Sanitizes error messages before sending to user
 * Prevents exposing sensitive system information or stack traces
 * @param {Error|string} error - Error object or message
 * @returns {string} Safe error message for display
 */
function sanitizeErrorMessage(error) {
  const message = error?.message || error || 'An unknown error occurred';

  // List of sensitive patterns to filter out
  const sensitivePatterns = [
    /at\s+[\w\.]+\s+\(/gi, // Stack trace patterns
    /file:\/\//gi, // File paths
    /chrome-extension:\/\//gi, // Extension paths
    /\s+at\s+/gi, // Stack trace "at" keywords
  ];

  let sanitized = message;
  sensitivePatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  // Truncate very long error messages
  if (sanitized.length > 200) {
    sanitized = sanitized.substring(0, 197) + '...';
  }

  // Provide user-friendly fallbacks for common errors
  if (sanitized.toLowerCase().includes('failed to fetch')) {
    return 'Network error. Please check your internet connection.';
  }

  if (sanitized.toLowerCase().includes('unauthorized') || sanitized.toLowerCase().includes('401')) {
    return 'Invalid API key. Please check your Claude API key in settings.';
  }

  if (sanitized.toLowerCase().includes('rate limit')) {
    return 'Rate limit exceeded. Please try again in a few moments.';
  }

  return sanitized.trim() || 'An error occurred. Please try again.';
}

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Job Hunt Assistant: Extension installed');
    
    // Set default settings
    Storage.saveSettings({
      autoAnalyze: false,
      showNotifications: true,
      analysisDepth: 'detailed'
    });
  } else if (details.reason === 'update') {
    console.log('Job Hunt Assistant: Extension updated');
  }
});

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.action);

  // Security: Validate message sender to prevent external attacks
  // Messages should only come from our own extension
  if (sender.id !== chrome.runtime.id) {
    console.error('Rejected message from unauthorized sender:', sender.id);
    sendResponse({ success: false, error: 'Unauthorized sender' });
    return false;
  }

  // Handle different message types
  switch (request.action) {
    case 'analyzeJob':
      handleAnalyzeJob(request.data)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: sanitizeErrorMessage(error) }));
      return true; // Keep channel open for async response

    case 'getJobs':
      Storage.getAllJobs()
        .then(jobs => sendResponse({ success: true, jobs }))
        .catch(error => sendResponse({ success: false, error: sanitizeErrorMessage(error) }));
      return true;

    case 'deleteJob':
      Storage.deleteJob(request.jobId)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: sanitizeErrorMessage(error) }));
      return true;

    case 'saveApiKey':
      Storage.saveApiKey(request.apiKey)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: sanitizeErrorMessage(error) }));
      return true;

    case 'getApiKey':
      Storage.getApiKey()
        .then(apiKey => sendResponse({ success: true, apiKey }))
        .catch(error => sendResponse({ success: false, error: sanitizeErrorMessage(error) }));
      return true;

    case 'testApiKey':
      ClaudeClient.testApiKey(request.apiKey)
        .then(result => sendResponse({ success: true, isValid: result.isValid, details: result.details }))
        .catch(error => sendResponse({ success: false, error: sanitizeErrorMessage(error) }));
      return true;

    case 'getSettings':
      Storage.getSettings()
        .then(settings => sendResponse({ success: true, settings }))
        .catch(error => sendResponse({ success: false, error: sanitizeErrorMessage(error) }));
      return true;

    case 'saveSettings':
      Storage.saveSettings(request.settings)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: sanitizeErrorMessage(error) }));
      return true;

    case 'saveResume':
      Storage.saveResume(request.resumeText)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: sanitizeErrorMessage(error) }));
      return true;

    case 'getResume':
      Storage.getResume()
        .then(resume => sendResponse({ success: true, resume }))
        .catch(error => sendResponse({ success: false, error: sanitizeErrorMessage(error) }));
      return true;

    case 'deleteResume':
      Storage.deleteResume()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: sanitizeErrorMessage(error) }));
      return true;

    case 'savePreferences':
      Storage.savePreferences(request.preferences)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: sanitizeErrorMessage(error) }));
      return true;

    case 'getPreferences':
      Storage.getPreferences()
        .then(preferences => sendResponse({ success: true, preferences }))
        .catch(error => sendResponse({ success: false, error: sanitizeErrorMessage(error) }));
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
  
  return false;
});

/**
 * Handles job analysis request
 * @param {Object} jobData - Extracted job data
 * @returns {Promise<Object>} Analysis result
 */
async function handleAnalyzeJob(jobData) {
  try {
    console.log('Background: Starting job analysis');
    console.log('Background: Received job data:', {
      hasData: !!jobData,
      hasDescription: !!jobData?.description,
      descriptionLength: jobData?.description?.length,
      jobTitle: jobData?.jobTitle,
      company: jobData?.company,
      platform: jobData?.platform,
      url: jobData?.url
    });

    // Get API key from storage
    const apiKey = await Storage.getApiKey();

    if (!apiKey) {
      throw new Error('No API key configured. Please set your Claude API key in the extension popup.');
    }

    // Validate API key format
    if (!ClaudeClient.validateApiKey(apiKey)) {
      throw new Error('Invalid API key format. Please check your Claude API key.');
    }

    // Get resume from storage (optional)
    const resumeText = await Storage.getResume();
    if (resumeText) {
      console.log('Background: Using resume for personalized analysis');
    }

    // Get preferences from storage (optional)
    const preferences = await Storage.getPreferences();
    if (preferences) {
      console.log('Background: Using preferences for context');
    }

    // Call Claude API for analysis (with optional resume and preferences)
    console.log('Background: Calling Claude API...');
    const analysisResult = await ClaudeClient.analyzeJob(apiKey, jobData, resumeText, preferences);

    // Save the analyzed job to storage
    const jobToSave = {
      ...jobData,
      analysis: analysisResult.analysis,
      analyzedAt: analysisResult.analyzedAt
    };

    await Storage.saveJob(jobToSave);

    console.log('Background: Job analysis complete and saved');

    // Update badge to show new analysis
    updateBadge();

    return {
      success: true,
      analysis: analysisResult.analysis,
      jobId: jobToSave.id
    };

  } catch (error) {
    console.error('Background: Error analyzing job:', error);

    // Still save the job data even if analysis fails
    try {
      await Storage.saveJob({
        ...jobData,
        analysisError: sanitizeErrorMessage(error) // Sanitize before storing
      });
    } catch (saveError) {
      console.error('Background: Error saving job after failed analysis:', saveError);
    }

    throw error;
  }
}

/**
 * Updates the extension badge with job count
 */
async function updateBadge() {
  try {
    const jobs = await Storage.getAllJobs();
    const count = jobs.length;
    
    if (count > 0) {
      chrome.action.setBadgeText({ text: count.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#667eea' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  } catch (error) {
    console.error('Error updating badge:', error);
  }
}

// Update badge when extension loads
updateBadge();

// Listen for storage changes to update badge
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.jobs) {
    updateBadge();
  }
});

/**
 * Check if URL is a supported job posting
 * @param {string} url - URL to check
 * @returns {boolean} Whether URL is a job posting
 */
function isJobPostingUrl(url) {
  if (!url) return false;

  const jobPatterns = [
    /linkedin\.com\/jobs\//i,
    /boards\.greenhouse\.io\//i,
    /jobs\.lever\.co\//i
  ];

  return jobPatterns.some(pattern => pattern.test(url));
}

/**
 * Track analyzed tabs to prevent duplicate analysis
 */
const analyzedTabs = new Set();

/**
 * Listen for tab updates to trigger auto-analysis
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only proceed when page has fully loaded
  if (changeInfo.status !== 'complete') return;

  // Check if URL is a job posting
  if (!tab.url || !isJobPostingUrl(tab.url)) return;

  // Check if already analyzed this tab
  if (analyzedTabs.has(tabId)) {
    console.log('Background: Tab already analyzed, skipping:', tabId);
    return;
  }

  try {
    // Get settings to check if auto-analyze is enabled
    const settings = await Storage.getSettings();

    if (!settings.autoAnalyze) {
      console.log('Background: Auto-analyze disabled');
      return;
    }

    // Check if API key is configured
    const apiKey = await Storage.getApiKey();
    if (!apiKey) {
      console.log('Background: No API key configured, skipping auto-analysis');
      return;
    }

    // Check if this job has already been analyzed (by URL)
    const jobs = await Storage.getAllJobs();
    const existingJob = jobs.find(job => job.url === tab.url && job.analysis);

    if (existingJob) {
      console.log('Background: Job already analyzed:', tab.url);
      analyzedTabs.add(tabId);
      return;
    }

    console.log('Background: Triggering auto-analysis for tab:', tabId, tab.url);

    // Mark as analyzed to prevent duplicate triggers
    analyzedTabs.add(tabId);

    // Send message to content script to trigger analysis
    // Give the content script a moment to initialize
    setTimeout(async () => {
      try {
        await chrome.tabs.sendMessage(tabId, { action: 'autoAnalyze' });
        console.log('Background: Auto-analyze message sent to tab:', tabId);
      } catch (error) {
        console.error('Background: Error sending auto-analyze message:', error);
        // Remove from analyzed set so it can be retried
        analyzedTabs.delete(tabId);
      }
    }, 1000); // 1 second delay to ensure content script is ready

  } catch (error) {
    console.error('Background: Error in auto-analyze listener:', error);
  }
});

/**
 * Clean up analyzed tabs when they're closed
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  analyzedTabs.delete(tabId);
});
