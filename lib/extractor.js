/**
 * Job Data Extractor
 * Extracts job posting information from various job platforms
 */

const JobExtractor = {

  // Cache tech keywords to avoid recreating array on every extraction
  _techKeywords: [
    // Languages
    'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Ruby', 'Go', 'Rust', 'PHP', 'Swift', 'Kotlin',
    // Frontend
    'React', 'Vue', 'Angular', 'Svelte', 'Next.js', 'Nuxt', 'HTML', 'CSS', 'Tailwind', 'Bootstrap',
    // Backend
    'Node.js', 'Express', 'Django', 'Flask', 'FastAPI', 'Spring', 'Rails', 'ASP.NET',
    // Databases
    'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'DynamoDB', 'Cassandra',
    // Cloud/DevOps
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'Jenkins', 'GitHub Actions',
    // Other
    'GraphQL', 'REST', 'API', 'Git', 'Linux', 'CI/CD', 'Microservices', 'Agile', 'Scrum'
  ],

  // Cache lowercase versions for faster matching
  _techKeywordsLower: null,

  _getTechKeywordsLower() {
    if (!this._techKeywordsLower) {
      this._techKeywordsLower = this._techKeywords.map(tech => tech.toLowerCase());
    }
    return this._techKeywordsLower;
  },

  /**
   * Detects which job platform we're currently on
   * @returns {string|null} Platform identifier or null if not on a supported platform
   */
  detectPlatform() {
    const url = window.location.href;
    
    if (url.includes('linkedin.com/jobs')) {
      return 'linkedin';
    } else if (url.includes('boards.greenhouse.io')) {
      return 'greenhouse';
    } else if (url.includes('jobs.lever.co')) {
      return 'lever';
    }
    
    return null;
  },
  
  /**
   * Helper function to try multiple selectors and return the first match
   * @param {Array<string>} selectors - Array of CSS selectors to try
   * @param {string} fieldName - Name of field being extracted (for debugging)
   * @returns {string} Text content of first matching element or empty string
   */
  _trySelectors(selectors, fieldName = '') {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent?.trim()) {
        console.log(`Job Hunt Assistant: Found ${fieldName} using selector: ${selector}`);
        return element.textContent.trim();
      }
    }
    console.warn(`Job Hunt Assistant: Could not find ${fieldName}. Tried ${selectors.length} selectors.`);
    return '';
  },

  /**
   * Waits for LinkedIn page to finish rendering
   * @param {number} maxAttempts - Maximum number of retry attempts
   * @param {number} delay - Delay between attempts in ms
   * @returns {Promise<boolean>} Whether page is ready
   */
  async waitForLinkedInRender(maxAttempts = 10, delay = 500) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`🔄 Attempt ${attempt}/${maxAttempts}: Checking if LinkedIn has rendered...`);

      // Check for key indicators that page is ready
      const hasH1 = document.querySelectorAll('h1').length > 0;
      const hasJobCard = !!document.querySelector('.jobs-unified-top-card, .job-details-jobs-unified-top-card');
      const hasDescription = !!document.querySelector('.jobs-description, .jobs-box__html-content');

      console.log('  Page readiness:', { hasH1, hasJobCard, hasDescription });

      if (hasH1 || hasJobCard || hasDescription) {
        console.log('✅ LinkedIn page is ready!');
        return true;
      }

      if (attempt < maxAttempts) {
        console.log(`⏳ Page not ready, waiting ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    console.log('⚠️ Gave up waiting for LinkedIn to render after', maxAttempts, 'attempts');
    return false;
  },

  /**
   * Extracts job data from LinkedIn
   * @returns {Object} Extracted job data
   */
  async extractLinkedIn() {
    try {
      console.log('Job Hunt Assistant: Starting LinkedIn extraction, URL:', window.location.href);

      // Wait for LinkedIn to finish rendering
      await this.waitForLinkedInRender();

      // DEBUG: Log all h1 elements on the page
      const allH1s = document.querySelectorAll('h1');
      console.log('🔍 DEBUG: Found', allH1s.length, 'h1 elements on page');
      allH1s.forEach((h1, index) => {
        console.log(`  H1 #${index}:`, {
          text: h1.textContent?.substring(0, 50),
          classes: h1.className,
          id: h1.id
        });
      });

      // DEBUG: Log some common containers
      console.log('🔍 DEBUG: Checking for common containers:', {
        'jobs-unified-top-card': !!document.querySelector('.jobs-unified-top-card'),
        'job-details-jobs-unified-top-card': !!document.querySelector('.job-details-jobs-unified-top-card'),
        'jobs-details': !!document.querySelector('.jobs-details'),
        'jobs-description': !!document.querySelector('.jobs-description'),
        'scaffold-layout__detail': !!document.querySelector('.scaffold-layout__detail')
      });

      // LinkedIn frequently changes class names, so we try multiple selectors
      // Includes selectors for both direct job view and jobs collection sidebar
      const jobTitleSelectors = [
        // Jobs collection/sidebar view
        '.job-details-jobs-unified-top-card__job-title h1',
        '.jobs-unified-top-card__job-title h1',
        'h1.job-details-jobs-unified-top-card__job-title',
        'h1.jobs-unified-top-card__job-title',
        // Direct job view
        'h1.top-card-layout__title',
        'h1.topcard__title',
        '.jobs-unified-top-card__job-title',
        '.job-details-jobs-unified-top-card__job-title',
        'h1.t-24.t-bold',
        'h1[class*="job-title"]',
        // Generic fallbacks
        '.jobs-details h1',
        'h1'  // Last resort
      ];

      const companySelectors = [
        // Jobs collection/sidebar view
        '.job-details-jobs-unified-top-card__company-name a',
        '.jobs-unified-top-card__company-name a',
        'a.app-aware-link[href*="/company/"]',
        // Direct job view
        '.topcard__org-name-link',
        '.topcard__flavor-row a',
        '.jobs-unified-top-card__company-name',
        '.job-details-jobs-unified-top-card__company-name',
        'a[data-tracking-control-name="public_jobs_topcard-org-name"]',
        '.jobs-unified-top-card__subtitle-primary-grouping a',
        'a[class*="company-name"]'
      ];

      const descriptionSelectors = [
        // Jobs collection/sidebar view
        '.jobs-description-content__text',
        '.jobs-box__html-content',
        'div[class*="jobs-description"] .jobs-box__html-content',
        // Common selectors
        '.show-more-less-html__markup',
        '.jobs-description__content',
        '#job-details',
        '.jobs-description',
        '.description__text',
        'article[class*="jobs-description"]',
        'div[class*="job-description"]'
      ];

      const locationSelectors = [
        // Jobs collection/sidebar view
        '.job-details-jobs-unified-top-card__primary-description-container span',
        '.jobs-unified-top-card__workplace-type',
        '.jobs-unified-top-card__bullet',
        // Direct job view
        '.topcard__flavor-row .topcard__flavor--bullet',
        '.job-details-jobs-unified-top-card__primary-description-container',
        '.jobs-unified-top-card__primary-description',
        'span[class*="job-location"]'
      ];

      const jobTitle = this._trySelectors(jobTitleSelectors, 'job title');
      const company = this._trySelectors(companySelectors, 'company');
      const description = this._trySelectors(descriptionSelectors, 'description');
      const location = this._trySelectors(locationSelectors, 'location');

      // DEBUG: If description is empty, look for ANY element with substantial text
      if (!description || description.trim().length === 0) {
        console.log('🔍 DEBUG: Description empty, scanning for text-heavy elements...');
        const textElements = Array.from(document.querySelectorAll('div, article, section'))
          .filter(el => {
            const text = el.textContent?.trim() || '';
            return text.length > 200 && text.length < 20000; // Likely description range
          })
          .slice(0, 5); // Top 5 candidates

        textElements.forEach((el, i) => {
          console.log(`  Candidate #${i}:`, {
            tag: el.tagName,
            classes: el.className.substring(0, 80),
            textLength: el.textContent?.length,
            preview: el.textContent?.substring(0, 100)
          });
        });
      }

      // Extract tech stack from description (simple keyword matching)
      const techStack = this.extractTechStack(description);

      return {
        platform: 'linkedin',
        jobTitle,
        company,
        description,
        location,
        techStack,
        url: window.location.href,
        extractedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error extracting LinkedIn job data:', error);
      return null;
    }
  },
  
  /**
   * Extracts job data from Greenhouse
   * @returns {Object} Extracted job data
   */
  extractGreenhouse() {
    try {
      const jobTitle = document.querySelector('h1.app-title')?.textContent?.trim() || '';
      const company = document.querySelector('.company-name')?.textContent?.trim() || '';
      const description = document.querySelector('#content, .content')?.textContent?.trim() || '';
      const location = document.querySelector('.location')?.textContent?.trim() || '';
      
      const techStack = this.extractTechStack(description);
      
      return {
        platform: 'greenhouse',
        jobTitle,
        company,
        description,
        location,
        techStack,
        url: window.location.href,
        extractedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error extracting Greenhouse job data:', error);
      return null;
    }
  },
  
  /**
   * Extracts job data from Lever
   * @returns {Object} Extracted job data
   */
  extractLever() {
    try {
      const jobTitle = document.querySelector('.posting-headline h2')?.textContent?.trim() || '';
      const company = document.querySelector('.main-header-text-item-1')?.textContent?.trim() || '';
      const description = document.querySelector('.content, .section-wrapper')?.textContent?.trim() || '';
      const location = document.querySelector('.location, .posting-categories .location')?.textContent?.trim() || '';
      
      const techStack = this.extractTechStack(description);
      
      return {
        platform: 'lever',
        jobTitle,
        company,
        description,
        location,
        techStack,
        url: window.location.href,
        extractedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error extracting Lever job data:', error);
      return null;
    }
  },
  
  /**
   * Extracts tech stack keywords from job description
   * Note: Returns standardized/canonical technology names (e.g., "Node.js")
   * even if job description uses variations (e.g., "NodeJS", "nodejs")
   * @param {string} text - Job description text
   * @returns {Array<string>} Array of detected technologies
   */
  extractTechStack(text) {
    if (!text) return [];

    const foundTech = [];
    const lowerText = text.toLowerCase();
    const lowerKeywords = this._getTechKeywordsLower();

    // Use cached keywords for better performance
    for (let i = 0; i < this._techKeywords.length; i++) {
      if (lowerText.includes(lowerKeywords[i])) {
        foundTech.push(this._techKeywords[i]);
      }
    }

    return [...new Set(foundTech)]; // Remove duplicates
  },
  
  /**
   * Main extraction method - detects platform and extracts appropriate data
   * @returns {Promise<Object|null>} Extracted job data or null if extraction fails
   */
  async extract() {
    const platform = this.detectPlatform();

    if (!platform) {
      console.log('Job Hunt Assistant: Not on a supported job platform');
      return null;
    }

    console.log(`Job Hunt Assistant: Detected platform - ${platform}`);

    switch (platform) {
      case 'linkedin':
        return await this.extractLinkedIn();
      case 'greenhouse':
        return this.extractGreenhouse();
      case 'lever':
        return this.extractLever();
      default:
        return null;
    }
  }
};

// Make available globally for content script
if (typeof window !== 'undefined') {
  window.JobExtractor = JobExtractor;
}
