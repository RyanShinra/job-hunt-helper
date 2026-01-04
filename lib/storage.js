/**
 * Storage Helper
 * Manages local storage for job data, settings, and API keys
 */

const Storage = {
  
  /**
   * Saves analyzed job data to storage
   * @param {Object} jobData - Job data to save
   * @returns {Promise<boolean>} Success status
   */
  async saveJob(jobData) {
    try {
      const jobs = await this.getAllJobs();
      
      // Add unique ID if not present
      if (!jobData.id) {
        jobData.id = this.generateJobId(jobData);
      }
      
      // Check if job already exists (update if so)
      const existingIndex = jobs.findIndex(job => job.id === jobData.id);
      
      if (existingIndex >= 0) {
        jobs[existingIndex] = { ...jobs[existingIndex], ...jobData, updatedAt: new Date().toISOString() };
      } else {
        jobs.unshift(jobData); // Add to beginning of array
      }
      
      // Keep only last 100 jobs to avoid storage limits
      const trimmedJobs = jobs.slice(0, 100);
      
      await chrome.storage.local.set({ jobs: trimmedJobs });
      
      console.log('Job saved to storage:', jobData.id);
      return true;
    } catch (error) {
      console.error('Error saving job to storage:', error);
      return false;
    }
  },
  
  /**
   * Retrieves all saved jobs
   * @returns {Promise<Array>} Array of job objects
   */
  async getAllJobs() {
    try {
      const result = await chrome.storage.local.get('jobs');
      return result.jobs || [];
    } catch (error) {
      console.error('Error retrieving jobs from storage:', error);
      return [];
    }
  },
  
  /**
   * Gets a specific job by ID
   * @param {string} jobId - Job ID to retrieve
   * @returns {Promise<Object|null>} Job object or null
   */
  async getJob(jobId) {
    try {
      const jobs = await this.getAllJobs();
      return jobs.find(job => job.id === jobId) || null;
    } catch (error) {
      console.error('Error retrieving job from storage:', error);
      return null;
    }
  },
  
  /**
   * Deletes a job from storage
   * @param {string} jobId - Job ID to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteJob(jobId) {
    try {
      const jobs = await this.getAllJobs();

      // Check if job exists before attempting delete
      const jobExists = jobs.some(job => job.id === jobId);
      if (!jobExists) {
        console.warn('Job not found for deletion:', jobId);
        return false;
      }

      const filteredJobs = jobs.filter(job => job.id !== jobId);

      await chrome.storage.local.set({ jobs: filteredJobs });

      // Verify deletion was successful
      const verifyJobs = await this.getAllJobs();
      const stillExists = verifyJobs.some(job => job.id === jobId);

      if (stillExists) {
        console.error('Job deletion failed - job still exists:', jobId);
        return false;
      }

      console.log('Job deleted from storage:', jobId);
      return true;
    } catch (error) {
      console.error('Error deleting job from storage:', error);
      return false;
    }
  },
  
  /**
   * Clears all saved jobs
   * @returns {Promise<boolean>} Success status
   */
  async clearAllJobs() {
    try {
      await chrome.storage.local.set({ jobs: [] });
      console.log('All jobs cleared from storage');
      return true;
    } catch (error) {
      console.error('Error clearing jobs from storage:', error);
      return false;
    }
  },
  
  /**
   * Saves Claude API key
   * @param {string} apiKey - Claude API key
   * @returns {Promise<boolean>} Success status
   */
  async saveApiKey(apiKey) {
    try {
      await chrome.storage.local.set({ claudeApiKey: apiKey });
      console.log('API key saved');
      return true;
    } catch (error) {
      console.error('Error saving API key:', error);
      return false;
    }
  },
  
  /**
   * Retrieves Claude API key
   * @returns {Promise<string|null>} API key or null
   */
  async getApiKey() {
    try {
      const result = await chrome.storage.local.get('claudeApiKey');
      return result.claudeApiKey || null;
    } catch (error) {
      console.error('Error retrieving API key:', error);
      return null;
    }
  },
  
  /**
   * Saves extension settings
   * @param {Object} settings - Settings object
   * @returns {Promise<boolean>} Success status
   */
  async saveSettings(settings) {
    try {
      const currentSettings = await this.getSettings();
      const updatedSettings = { ...currentSettings, ...settings };
      
      await chrome.storage.local.set({ settings: updatedSettings });
      console.log('Settings saved');
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      return false;
    }
  },
  
  /**
   * Retrieves extension settings
   * @returns {Promise<Object>} Settings object
   */
  async getSettings() {
    try {
      const result = await chrome.storage.local.get('settings');
      return result.settings || {
        autoAnalyze: false,
        showNotifications: true,
        analysisDepth: 'detailed'
      };
    } catch (error) {
      console.error('Error retrieving settings:', error);
      return {};
    }
  },
  
  /**
   * Generates a unique ID for a job based on URL and timestamp
   * @param {Object} jobData - Job data object
   * @returns {string} Generated job ID
   */
  generateJobId(jobData) {
    const urlHash = this.simpleHash(jobData.url || '');
    const timestamp = Date.now();
    return `job_${urlHash}_${timestamp}`;
  },
  
  /**
   * Simple hash function for generating IDs
   * @param {string} str - String to hash
   * @returns {string} Hash string
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
};

// Make available for both service worker and popup
if (typeof window !== 'undefined') {
  window.Storage = Storage;
}

// For service worker
if (typeof self !== 'undefined' && typeof chrome !== 'undefined') {
  self.Storage = Storage;
}
