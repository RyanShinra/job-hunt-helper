/**
 * Popup Script
 * Handles the extension popup UI and interactions
 */

// Constants
const STATUS_MESSAGE_DURATION = 5000; // ms - how long status messages stay visible

/**
 * Escapes HTML special characters to prevent XSS
 * @param {string} unsafe - Unsafe string that may contain HTML
 * @returns {string} - HTML-safe string
 */
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Validates URL to prevent javascript: and data: URLs
 * @param {string} url - URL to validate
 * @returns {boolean} - Whether URL is safe
 */
function isSafeUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase().trim();
  return lower.startsWith('http://') || lower.startsWith('https://');
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup loaded');

  // Initialize
  await loadJobs();
  await loadApiKey();
  setupEventListeners();
});

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  // Tab switching
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;
      switchTab(tabName);
    });
  });

  // Save API key
  document.getElementById('save-api-key').addEventListener('click', saveApiKey);

  // Test API key
  document.getElementById('test-api-key').addEventListener('click', testApiKey);

  // Clear all jobs
  document.getElementById('clear-jobs').addEventListener('click', clearAllJobs);

  // Event delegation for job card buttons (prevents memory leaks)
  document.getElementById('jobs-list').addEventListener('click', (e) => {
    const target = e.target;

    // Find the job card parent
    const jobCard = target.closest('.job-card');
    if (!jobCard) return;

    const jobId = jobCard.dataset.jobId;
    const job = currentJobs.find(j => escapeHtml(j.id) === jobId);

    if (!job) return;

    // Handle different button clicks
    if (target.classList.contains('view-analysis')) {
      showAnalysis(job);
    } else if (target.classList.contains('open-job')) {
      openJob(job);
    } else if (target.classList.contains('delete-job')) {
      deleteJob(job.id);
    }
  });

  // Close modal
  document.querySelector('.close-btn').addEventListener('click', closeModal);

  // Close modal on background click
  document.getElementById('analysis-modal').addEventListener('click', (e) => {
    if (e.target.id === 'analysis-modal') {
      closeModal();
    }
  });
}

/**
 * Switch between tabs
 */
function switchTab(tabName) {
  // Update button states
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.tab === tabName) {
      btn.classList.add('active');
    }
  });

  // Update content visibility
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(tabName + '-tab').classList.add('active');
}

/**
 * Load and display jobs
 */
async function loadJobs() {
  const jobsList = document.getElementById('jobs-list');

  try {
    const response = await chrome.runtime.sendMessage({ action: 'getJobs' });

    if (response.success && response.jobs.length > 0) {
      displayJobs(response.jobs);
    } else {
      showEmptyState();
    }
  } catch (error) {
    console.error('Error loading jobs:', error);
    jobsList.innerHTML = '<p class="status-error">Error loading jobs</p>';
  }
}

// Store jobs globally for event delegation
let currentJobs = [];

/**
 * Display jobs in the list
 */
function displayJobs(jobs) {
  const jobsList = document.getElementById('jobs-list');

  // Store jobs for event delegation
  currentJobs = jobs;

  const jobsHtml = jobs.map(job => {
    // Escape all user-controlled data to prevent XSS
    const title = escapeHtml(job.jobTitle || 'Untitled Job');
    const company = escapeHtml(job.company || 'Unknown Company');
    const platform = escapeHtml(job.platform || 'Unknown');
    const date = escapeHtml(formatDate(job.analyzedAt || job.extractedAt));
    const jobId = escapeHtml(job.id);
    const hasAnalysis = job.analysis;
    const hasError = job.analysisError;

    let statusHtml;
    if (hasAnalysis) {
      statusHtml = '<button class="btn btn-primary view-analysis">View Analysis</button>';
    } else if (hasError) {
      // Escape error message for XSS protection
      const errorMsg = escapeHtml(job.analysisError || '');
      statusHtml = '<span style="font-size: 12px; color: #ff4d4f;" title="' + errorMsg + '">Analysis failed</span>';
    } else {
      statusHtml = '<span style="font-size: 12px; color: #888;">No analysis available</span>';
    }

    return `
      <div class="job-card" data-job-id="${jobId}">
        <h4>${title}</h4>
        <div class="company">${company}</div>
        <div class="meta">${platform} • ${date}</div>
        <div class="actions">
          ${statusHtml}
          <button class="btn btn-secondary open-job">Open Job</button>
          <button class="btn btn-danger delete-job">Delete</button>
        </div>
      </div>
    `;
  }).join('');

  jobsList.innerHTML = jobsHtml;

  // Event delegation is set up once in setupEventListeners()
  // No need to add listeners here - prevents memory leaks
}

/**
 * Show empty state
 */
function showEmptyState() {
  const jobsList = document.getElementById('jobs-list');
  jobsList.innerHTML = `
    <div class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
      <h3>No jobs analyzed yet</h3>
      <p>Visit a job posting on LinkedIn, Greenhouse, or Lever and click "Analyze with Claude"</p>
    </div>
  `;
}

/**
 * Show analysis in modal
 */
function showAnalysis(job) {
  const modal = document.getElementById('analysis-modal');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');

  title.textContent = job.jobTitle || 'Job Analysis';
  body.textContent = job.analysis || 'No analysis available';

  modal.classList.add('active');
}

/**
 * Close modal
 */
function closeModal() {
  document.getElementById('analysis-modal').classList.remove('active');
}

/**
 * Open job in new tab
 */
function openJob(job) {
  // Validate URL to prevent XSS via javascript: or data: URLs
  if (job.url && isSafeUrl(job.url)) {
    chrome.tabs.create({ url: job.url });
  } else if (job.url) {
    console.error('Blocked unsafe URL:', job.url);
    alert('Cannot open job: invalid or unsafe URL');
  }
}

/**
 * Delete a job
 */
async function deleteJob(jobId) {
  if (!confirm('Are you sure you want to delete this job?')) {
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'deleteJob',
      jobId
    });

    if (response.success) {
      await loadJobs();
    } else {
      alert('Failed to delete job');
    }
  } catch (error) {
    console.error('Error deleting job:', error);
    alert('Error deleting job');
  }
}

/**
 * Load API key from storage
 */
async function loadApiKey() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getApiKey' });

    if (response.success && response.apiKey) {
      document.getElementById('api-key').value = response.apiKey;
    }
  } catch (error) {
    console.error('Error loading API key:', error);
  }
}

/**
 * Save API key
 */
async function saveApiKey() {
  const apiKey = document.getElementById('api-key').value.trim();
  const statusDiv = document.getElementById('api-status');

  if (!apiKey) {
    showStatus(statusDiv, 'Please enter an API key', 'error');
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'saveApiKey',
      apiKey
    });

    if (response.success) {
      showStatus(statusDiv, 'API key saved successfully!', 'success');
    } else {
      showStatus(statusDiv, 'Failed to save API key', 'error');
    }
  } catch (error) {
    console.error('Error saving API key:', error);
    showStatus(statusDiv, 'Error saving API key', 'error');
  }
}

/**
 * Test API key
 */
async function testApiKey() {
  const apiKey = document.getElementById('api-key').value.trim();
  const statusDiv = document.getElementById('api-status');

  if (!apiKey) {
    showStatus(statusDiv, 'Please enter an API key', 'error');
    return;
  }

  showStatus(statusDiv, 'Testing API key...', 'success');

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'testApiKey',
      apiKey
    });

    if (response.success && response.isValid) {
      showStatus(statusDiv, 'API key is valid!', 'success');
    } else {
      showStatus(statusDiv, 'API key is invalid or expired', 'error');
    }
  } catch (error) {
    console.error('Error testing API key:', error);
    showStatus(statusDiv, 'Error testing API key', 'error');
  }
}

/**
 * Clear all jobs
 */
async function clearAllJobs() {
  if (!confirm('Are you sure you want to delete all analyzed jobs? This cannot be undone.')) {
    return;
  }

  try {
    await Storage.clearAllJobs();
    await loadJobs();
  } catch (error) {
    console.error('Error clearing jobs:', error);
    alert('Error clearing jobs');
  }
}

/**
 * Show status message
 */
function showStatus(element, message, type) {
  // Validate type parameter to prevent CSS class injection
  const validTypes = ['success', 'error', 'info'];
  if (!validTypes.includes(type)) {
    console.error('Invalid status type:', type);
    type = 'info'; // Fallback to safe default
  }

  // Create status message element safely to prevent XSS
  const statusDiv = document.createElement('div');
  statusDiv.className = 'status-message status-' + type;
  statusDiv.textContent = message; // Use textContent to prevent XSS

  element.innerHTML = '';
  element.appendChild(statusDiv);

  setTimeout(() => {
    element.innerHTML = '';
  }, STATUS_MESSAGE_DURATION);
}

/**
 * Format date for display
 */
function formatDate(dateString) {
  if (!dateString) return 'Unknown date';

  const date = new Date(dateString);

  // Validate date
  if (isNaN(date.getTime())) {
    return 'Invalid date';
  }

  const now = new Date();
  const diffMs = now - date;

  // Handle future dates
  if (diffMs < 0) {
    return date.toLocaleDateString();
  }

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return diffMins + 'm ago';
  if (diffHours < 24) return diffHours + 'h ago';
  if (diffDays < 7) return diffDays + 'd ago';

  return date.toLocaleDateString();
}
