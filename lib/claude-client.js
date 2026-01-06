/**
 * Claude API Client
 * Handles communication with the Claude API for job analysis
 */

const ClaudeClient = {

  API_URL: 'https://api.anthropic.com/v1/messages',
  MODEL: 'claude-sonnet-4-5-20250929', // Claude Sonnet 4.5 (active until Sept 2026+)
  MAX_TOKENS: 4096,
  FETCH_TIMEOUT: 60000, // 60 seconds timeout for API calls

  /**
   * Fetches with timeout protection
   * @param {string} url - URL to fetch
   * @param {Object} options - Fetch options
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Response>} Fetch response
   */
  async fetchWithTimeout(url, options, timeout = this.FETCH_TIMEOUT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - Claude API took too long to respond');
      }
      throw error;
    }
  },

  /**
   * Analyzes a job posting using Claude API
   * @param {string} apiKey - Claude API key
   * @param {Object} jobData - Extracted job data
   * @param {string} resumeText - Optional resume text for context
   * @param {string} preferences - Optional user preferences and career context
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeJob(apiKey, jobData, resumeText = null, preferences = null) {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    if (!jobData || !jobData.description) {
      throw new Error('Invalid job data provided');
    }

    try {
      const prompt = this.buildAnalysisPrompt(jobData, resumeText, preferences);

      const response = await this.fetchWithTimeout(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: this.MODEL,
          max_tokens: this.MAX_TOKENS,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
      }

      const data = await response.json();

      // Extract the analysis from Claude's response
      const analysisText = data.content?.[0]?.text || '';

      return {
        success: true,
        analysis: analysisText,
        jobData: jobData,
        analyzedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error calling Claude API:', error);
      throw error;
    }
  },
  
  /**
   * Sanitizes user input to prevent prompt injection attacks
   * @param {string} text - User-provided text
   * @returns {string} Sanitized text
   */
  sanitizeUserInput(text) {
    if (!text) return '';

    // Detect common prompt injection patterns
    const injectionPatterns = [
      /ignore\s+(previous|all|above|prior)\s+(instructions?|commands?|prompts?)/gi,
      /disregard\s+(previous|all|above|prior)\s+(instructions?|commands?)/gi,
      /forget\s+(previous|all|above|prior)\s+(instructions?|commands?)/gi,
      /new\s+(instructions?|task|role|system)/gi,
      /you\s+are\s+now/gi,
      /act\s+as\s+(a|an)\s+\w+/gi,
      /system\s*:/gi,
      /assistant\s*:/gi,
      /\[SYSTEM\]/gi,
      /\[INST\]/gi
    ];

    let sanitized = text;
    let detectedInjection = false;

    // Check for injection patterns and sanitize if detected
    for (const pattern of injectionPatterns) {
      if (pattern.test(sanitized)) {
        detectedInjection = true;
        // Replace suspicious patterns with benign text
        sanitized = sanitized.replace(pattern, '[REDACTED]');
      }
    }

    if (detectedInjection) {
      console.warn('Potential prompt injection detected and sanitized');
    }

    // Limit length to prevent overwhelming the context
    const MAX_INPUT_LENGTH = 50000;
    if (sanitized.length > MAX_INPUT_LENGTH) {
      sanitized = sanitized.substring(0, MAX_INPUT_LENGTH) + '\n[Content truncated due to length]';
    }

    return sanitized;
  },

  /**
   * Builds the analysis prompt for Claude
   * @param {Object} jobData - Extracted job data
   * @param {string} resumeText - Optional resume text for context
   * @param {string} preferences - Optional user preferences and career context
   * @returns {string} Formatted prompt
   */
  buildAnalysisPrompt(jobData, resumeText = null, preferences = null) {
    // Sanitize all user-provided inputs to prevent prompt injection
    const safeJobTitle = this.sanitizeUserInput(jobData.jobTitle || 'Not specified');
    const safeCompany = this.sanitizeUserInput(jobData.company || 'Not specified');
    const safeLocation = this.sanitizeUserInput(jobData.location || 'Not specified');
    const safeDescription = this.sanitizeUserInput(jobData.description);
    const safeResume = resumeText ? this.sanitizeUserInput(resumeText) : null;
    const safePreferences = preferences ? this.sanitizeUserInput(preferences) : null;

    return `You are a career advisor helping someone analyze a job posting. Provide a concise, actionable analysis.

**Job Title:** ${safeJobTitle}
**Company:** ${safeCompany}
**Location:** ${safeLocation}
**Platform:** ${jobData.platform || 'Unknown'}

**Job Description:**
${safeDescription}

${jobData.techStack && jobData.techStack.length > 0 ? `**Detected Tech Stack:** ${jobData.techStack.join(', ')}` : ''}

${safeResume ? `**Candidate Resume:**\n${safeResume}\n` : ''}

${safePreferences ? `**Candidate Preferences & Context:**\n${safePreferences}\n` : ''}

CRITICAL: Do NOT repeat or echo the job description in your response. The user already has it.

Please structure your response as follows:

**🎯 VERDICT** (2-3 sentences max)
Provide a bottom-line-up-front assessment: Is this a good match? Key strengths or concerns? Clear recommendation (Strong Yes/Maybe/Pass).

**📋 ANALYSIS DETAILS**
The following sections explain my reasoning:

**Key Responsibilities**
Main duties and expectations for this role.

**Required Skills**
Hard and soft skills needed (list format preferred).

**Tech Stack**
Technologies, languages, frameworks, and tools mentioned.

**Experience Level**
Entry/Mid/Senior level and years typically required.

**🚩 Red Flags**
Concerning aspects, if any (be honest - write "None identified" if genuinely none).

**✅ Green Flags**
Positive aspects and opportunities.

**Interview Questions**
3-5 specific questions to ask based on this role.

**Match Score**
Rate 1-10 with clear reasoning${safeResume || safePreferences ? ' based on the candidate\'s background and preferences' : ' for a typical candidate at this level'}.

Format with clear headers and concise bullet points where appropriate.`;
  },
  
  /**
   * Validates API key format
   * @param {string} apiKey - API key to validate
   * @returns {boolean} Whether the key appears valid
   */
  validateApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }
    
    // Claude API keys start with 'sk-ant-'
    return apiKey.trim().startsWith('sk-ant-') && apiKey.length > 20;
  },
  
  /**
   * Tests API key by making a simple request
   * @param {string} apiKey - API key to test
   * @returns {Promise<Object>} Object with isValid and details
   */
  async testApiKey(apiKey) {
    try {
      const response = await this.fetchWithTimeout(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: this.MODEL,
          max_tokens: 100,
          messages: [
            {
              role: 'user',
              content: 'Say "OK" if you can read this.'
            }
          ]
        })
      });

      // Always consume the response body to properly close the connection
      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Log detailed error information
        console.error('API key test failed:', {
          status: response.status,
          statusText: response.statusText,
          error: responseData
        });

        // Return detailed error for user display
        const errorMsg = responseData.error?.message || `Error ${response.status}: ${response.statusText || 'Unknown error'}`;
        return { isValid: false, details: errorMsg };
      } else {
        console.log('API key test successful');
        return { isValid: true, details: 'API key is valid and working!' };
      }
    } catch (error) {
      console.error('Error testing API key:', error);
      return { isValid: false, details: error.message || 'Network error - could not reach API' };
    }
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.ClaudeClient = ClaudeClient;
}

// For service worker
if (typeof self !== 'undefined') {
  self.ClaudeClient = ClaudeClient;
}
