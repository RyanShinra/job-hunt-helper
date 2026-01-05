/**
 * Content Script
 * Runs on job posting pages and handles UI injection and data extraction
 */

// Check if we're on a job posting page
(function() {
  'use strict';

  // Constants
  const BUTTON_CREATE_DELAY = 100; // ms - delay before creating analyze button
  const BUTTON_RESET_DELAY = 3000; // ms - delay before resetting button state
  const NOTIFICATION_SHOW_DELAY = 10; // ms - delay before showing notification
  const NOTIFICATION_HIDE_DELAY = 4000; // ms - how long notification stays visible
  const NOTIFICATION_FADE_DELAY = 300; // ms - fade out animation duration
  const MESSAGE_TIMEOUT = 30000; // ms - max wait time for background script response
  const RATE_LIMIT_COOLDOWN = 2000; // ms - minimum time between analyze requests

  console.log('Job Hunt Assistant: Content script loaded');

  let analyzeButton = null;
  let isProcessing = false;
  let lastAnalyzeTime = 0;
  let isInitialized = false; // Prevent init race condition

  /**
   * Sends message to background script with timeout protection
   * @param {Object} message - Message to send
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Object>} Response from background script
   */
  function sendMessageWithTimeout(message, timeout = MESSAGE_TIMEOUT) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Background script communication timeout'));
      }, timeout);

      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timeoutId);

        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }
  
  /**
   * Creates and injects the "Analyze with Claude" button
   */
  function createAnalyzeButton() {
    // Don't create button if it already exists
    if (document.getElementById('jh-analyze-button')) {
      return;
    }
    
    // Create button container
    const button = document.createElement('div');
    button.id = 'jh-analyze-button';
    button.className = 'jh-floating-button';
    button.innerHTML = `
      <div class="jh-button-content">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z" fill="currentColor"/>
          <path d="M10 7c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1s1-.45 1-1V8c0-.55-.45-1-1-1zm0 6c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z" fill="currentColor"/>
        </svg>
        <span>Analyze with Claude</span>
      </div>
    `;
    
    button.addEventListener('click', handleAnalyzeClick);
    
    document.body.appendChild(button);
    analyzeButton = button;
    
    console.log('Job Hunt Assistant: Analyze button created');
  }
  
  /**
   * Handles click on the analyze button
   */
  async function handleAnalyzeClick() {
    if (isProcessing) {
      console.log('Job Hunt Assistant: Already processing...');
      return;
    }

    // Rate limiting: prevent spamming API requests
    const now = Date.now();
    const timeSinceLastAnalyze = now - lastAnalyzeTime;
    if (timeSinceLastAnalyze < RATE_LIMIT_COOLDOWN) {
      const remainingTime = Math.ceil((RATE_LIMIT_COOLDOWN - timeSinceLastAnalyze) / 1000);
      showNotification(`Please wait ${remainingTime} second${remainingTime > 1 ? 's' : ''} before analyzing again`, 'error');
      return;
    }

    lastAnalyzeTime = now;
    isProcessing = true;
    updateButtonState('processing');
    
    try {
      // Extract job data using the JobExtractor
      const jobData = window.JobExtractor?.extract();
      
      if (!jobData) {
        console.error('Job Hunt Assistant: Failed to extract job data');
        showNotification('Could not extract job data. Make sure you\'re on a job posting page.', 'error');
        updateButtonState('error');
        return;
      }
      
      console.log('Job Hunt Assistant: Extracted job data:', jobData);

      // Send data to background script for processing with timeout protection
      try {
        const response = await sendMessageWithTimeout({
          action: 'analyzeJob',
          data: jobData
        });

        if (response && response.success) {
          console.log('Job Hunt Assistant: Analysis complete');
          showNotification('Job analyzed successfully! Check the extension popup.', 'success');
          updateButtonState('success');
        } else {
          console.error('Job Hunt Assistant: Analysis failed:', response?.error);
          showNotification(response?.error || 'Analysis failed', 'error');
          updateButtonState('error');
        }
      } catch (commError) {
        console.error('Job Hunt Assistant: Communication error:', commError);
        showNotification('Error communicating with extension. Please try again.', 'error');
        updateButtonState('error');
      }
      
    } catch (error) {
      console.error('Job Hunt Assistant: Error during analysis:', error);
      showNotification('An error occurred during analysis', 'error');
      updateButtonState('error');
    } finally {
      // Reset button state after delay
      setTimeout(() => {
        isProcessing = false;
        updateButtonState('default');
      }, BUTTON_RESET_DELAY);
    }
  }
  
  /**
   * Updates the button visual state
   * @param {string} state - 'default', 'processing', 'success', or 'error'
   */
  function updateButtonState(state) {
    if (!analyzeButton) return;
    
    const button = analyzeButton;
    
    // Remove all state classes
    button.classList.remove('jh-processing', 'jh-success', 'jh-error');
    
    switch (state) {
      case 'processing':
        button.classList.add('jh-processing');
        button.querySelector('span').textContent = 'Analyzing...';
        break;
      case 'success':
        button.classList.add('jh-success');
        button.querySelector('span').textContent = 'Analyzed!';
        break;
      case 'error':
        button.classList.add('jh-error');
        button.querySelector('span').textContent = 'Error';
        break;
      default:
        button.querySelector('span').textContent = 'Analyze with Claude';
    }
  }
  
  /**
   * Shows a temporary notification
   * @param {string} message - Notification message
   * @param {string} type - 'success' or 'error'
   */
  function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `jh-notification jh-notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);

    // Trigger animation
    setTimeout(() => notification.classList.add('jh-notification-show'), NOTIFICATION_SHOW_DELAY);

    // Remove after delay
    setTimeout(() => {
      notification.classList.remove('jh-notification-show');
      setTimeout(() => notification.remove(), NOTIFICATION_FADE_DELAY);
    }, NOTIFICATION_HIDE_DELAY);
  }
  
  /**
   * Initialize the content script
   */
  function init() {
    // Prevent multiple initializations (race condition protection)
    if (isInitialized) {
      console.log('Job Hunt Assistant: Already initialized, skipping');
      return;
    }

    // Wait for page to be fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }

    isInitialized = true;

    // Check if we're on a supported platform
    const platform = window.JobExtractor?.detectPlatform();

    if (platform) {
      console.log(`Job Hunt Assistant: Detected ${platform} job page`);

      // Create the analyze button after a short delay to ensure DOM is ready
      setTimeout(createAnalyzeButton, BUTTON_CREATE_DELAY);
    } else {
      console.log('Job Hunt Assistant: Not on a supported job platform');
    }
  }
  
  // Start initialization
  init();
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
      sendResponse({ status: 'ready' });
    }
    return true;
  });
  
})();
