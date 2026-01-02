/**
 * Claude API Client
 * Handles communication with the Claude API for job analysis
 */

const ClaudeClient = {
  
  API_URL: 'https://api.anthropic.com/v1/messages',
  MODEL: 'claude-3-5-sonnet-20241022',
  MAX_TOKENS: 4096,
  
  /**
   * Analyzes a job posting using Claude API
   * @param {string} apiKey - Claude API key
   * @param {Object} jobData - Extracted job data
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeJob(apiKey, jobData) {
    if (!apiKey) {
      throw new Error('API key is required');
    }
    
    if (!jobData || !jobData.description) {
      throw new Error('Invalid job data provided');
    }
    
    try {
      const prompt = this.buildAnalysisPrompt(jobData);
      
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
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
   * Builds the analysis prompt for Claude
   * @param {Object} jobData - Extracted job data
   * @returns {string} Formatted prompt
   */
  buildAnalysisPrompt(jobData) {
    return `You are a career advisor helping someone analyze a job posting. Please provide a comprehensive analysis of the following job posting:

**Job Title:** ${jobData.jobTitle || 'Not specified'}
**Company:** ${jobData.company || 'Not specified'}
**Location:** ${jobData.location || 'Not specified'}
**Platform:** ${jobData.platform || 'Unknown'}

**Job Description:**
${jobData.description}

${jobData.techStack && jobData.techStack.length > 0 ? `**Detected Tech Stack:** ${jobData.techStack.join(', ')}` : ''}

Please provide:

1. **Summary:** A brief 2-3 sentence overview of the role
2. **Key Responsibilities:** List the main responsibilities mentioned
3. **Required Skills:** List hard and soft skills required
4. **Tech Stack:** Technologies mentioned (programming languages, frameworks, tools)
5. **Experience Level:** Estimate the experience level (entry, mid, senior, etc.)
6. **Red Flags:** Any concerning aspects (if any)
7. **Green Flags:** Positive aspects of the role
8. **Questions to Ask:** 3-5 important questions to ask during the interview
9. **Match Score:** On a scale of 1-10, how well does this align with typical career progression (provide reasoning)

Format your response in clear sections with headers.`;
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
   * @returns {Promise<boolean>} Whether the key is valid
   */
  async testApiKey(apiKey) {
    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.MODEL,
          max_tokens: 10,
          messages: [
            {
              role: 'user',
              content: 'Say "OK" if you can read this.'
            }
          ]
        })
      });
      
      return response.ok;
    } catch (error) {
      console.error('Error testing API key:', error);
      return false;
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
