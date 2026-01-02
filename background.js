/**
 * Background Service Worker
 * Handles API calls and communication between content script and popup
 */

// Import storage and Claude client helpers
importScripts('lib/storage.js', 'lib/claude-client.js');

console.log('Job Hunt Assistant: Background service worker loaded');

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
  
  // Handle different message types
  switch (request.action) {
    case 'analyzeJob':
      handleAnalyzeJob(request.data)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep channel open for async response
      
    case 'getJobs':
      Storage.getAllJobs()
        .then(jobs => sendResponse({ success: true, jobs }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'deleteJob':
      Storage.deleteJob(request.jobId)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'saveApiKey':
      Storage.saveApiKey(request.apiKey)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'getApiKey':
      Storage.getApiKey()
        .then(apiKey => sendResponse({ success: true, apiKey }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'testApiKey':
      ClaudeClient.testApiKey(request.apiKey)
        .then(isValid => sendResponse({ success: true, isValid }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'getSettings':
      Storage.getSettings()
        .then(settings => sendResponse({ success: true, settings }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'saveSettings':
      Storage.saveSettings(request.settings)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
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
        analysisError: error.message
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
