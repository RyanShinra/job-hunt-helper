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
    
    // Get API key from storage
    const apiKey = await Storage.getApiKey();
    
    if (!apiKey) {
      throw new Error('No API key configured. Please set your Claude API key in the extension popup.');
    }
    
    // Validate API key format
    if (!ClaudeClient.validateApiKey(apiKey)) {
      throw new Error('Invalid API key format. Please check your Claude API key.');
    }
    
    // Call Claude API for analysis
    console.log('Background: Calling Claude API...');
    const analysisResult = await ClaudeClient.analyzeJob(apiKey, jobData);
    
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
