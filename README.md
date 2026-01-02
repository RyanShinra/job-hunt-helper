# Job Hunt Assistant

A browser extension for Edge/Chrome that analyzes job postings using Claude AI to help with your job search.

## Features

- **Automatic Job Detection**: Detects when you're viewing a job posting on supported platforms
- **One-Click Analysis**: Click the "Analyze with Claude" button to get AI-powered insights
- **Smart Extraction**: Automatically extracts job title, company, description, location, and tech stack
- **AI-Powered Insights**: Uses Claude AI to provide:
  - Role summary and key responsibilities
  - Required skills and tech stack analysis
  - Experience level estimation
  - Red flags and green flags
  - Interview questions to ask
  - Match score and career fit analysis
- **Job History**: Saves all analyzed jobs locally for easy reference
- **Multi-Platform Support**: Works with LinkedIn, Greenhouse, and Lever job boards

## Supported Platforms

- LinkedIn Jobs (`linkedin.com/jobs/*`)
- Greenhouse (`boards.greenhouse.io/*`)
- Lever (`jobs.lever.co/*`)

## Installation

### Prerequisites

- Microsoft Edge or Google Chrome browser
- Claude API key from Anthropic ([Get one here](https://console.anthropic.com/))

### Install the Extension

1. **Clone or download this repository**
   ```bash
   git clone https://github.com/yourusername/job-hunt-assistant.git
   cd job-hunt-assistant
   ```

2. **Load the extension in Edge/Chrome**

   For **Microsoft Edge**:
   - Open Edge and go to `edge://extensions/`
   - Enable "Developer mode" (toggle in bottom-left corner)
   - Click "Load unpacked"
   - Select the `job-hunt-assistant` folder

   For **Google Chrome**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked"
   - Select the `job-hunt-assistant` folder

3. **Configure your API key**
   - Click the extension icon in your browser toolbar
   - Go to the "Settings" tab
   - Enter your Claude API key
   - Click "Save API Key"
   - Click "Test Key" to verify it works

## Usage

### Analyzing a Job Posting

1. Navigate to a job posting on LinkedIn, Greenhouse, or Lever
2. Wait for the page to load completely
3. Look for the purple "Analyze with Claude" floating button (bottom-right corner)
4. Click the button to analyze the job
5. Wait for the analysis to complete (usually 5-10 seconds)
6. Click the extension icon to view the full analysis

### Viewing Past Analyses

1. Click the extension icon in your toolbar
2. The "Jobs" tab shows all previously analyzed jobs
3. Click "View Analysis" to see the full AI analysis
4. Click "Open Job" to return to the original posting
5. Click "Delete" to remove a job from history

### Managing Your Data

- **Clear All Jobs**: Settings tab → "Clear All Jobs" button
- **Change API Key**: Settings tab → Enter new key → "Save API Key"
- The extension stores data locally in your browser (not on any server)

## Development

### Project Structure

```
job-hunt-assistant/
├── manifest.json           # Extension configuration
├── background.js           # Service worker for API calls
├── content.js             # Content script injected into job pages
├── content.css            # Styles for injected UI elements
├── popup.html             # Extension popup interface
├── popup.js               # Popup UI logic
├── lib/
│   ├── extractor.js       # Job data extraction logic
│   ├── claude-client.js   # Claude API wrapper
│   └── storage.js         # Local storage helpers
├── icons/
│   ├── icon16.png         # 16x16 icon
│   ├── icon48.png         # 48x48 icon
│   └── icon128.png        # 128x128 icon
├── test-job-page.html     # Local test page for development
└── README.md              # This file
```

### Key Components

#### Content Script (`content.js`)
- Runs on job posting pages
- Creates the floating "Analyze with Claude" button
- Extracts job data using the JobExtractor
- Sends data to background script for processing

#### Job Extractor (`lib/extractor.js`)
- Platform detection (LinkedIn, Greenhouse, Lever)
- DOM parsing to extract job information
- Tech stack keyword detection
- Modular and extensible for adding new platforms

#### Background Service Worker (`background.js`)
- Handles messages from content script and popup
- Makes API calls to Claude
- Manages storage operations
- Updates extension badge with job count

#### Claude Client (`lib/claude-client.js`)
- Wrapper for Claude API
- Builds analysis prompts
- Handles API errors
- API key validation

#### Storage Helper (`lib/storage.js`)
- Chrome storage API wrapper
- Job data management (save, get, delete)
- Settings management
- API key storage

### Local Testing

1. **Open the test page**
   ```bash
   # From the project directory
   open test-job-page.html
   # or
   firefox test-job-page.html
   ```

2. **Test the extension**
   - The test page mimics LinkedIn's job posting structure
   - The extension should detect it and show the analyze button
   - Use this for testing without visiting real job sites

### Adding Support for New Platforms

To add support for a new job board:

1. **Update `manifest.json`**
   ```json
   "content_scripts": [{
     "matches": [
       "*://newplatform.com/jobs/*"
     ]
   }],
   "host_permissions": [
     "*://newplatform.com/*"
   ]
   ```

2. **Add platform detector in `lib/extractor.js`**
   ```javascript
   detectPlatform() {
     if (url.includes('newplatform.com')) {
       return 'newplatform';
     }
   }
   ```

3. **Add extraction method**
   ```javascript
   extractNewPlatform() {
     // DOM selectors specific to the platform
     const jobTitle = document.querySelector('.job-title')?.textContent;
     // ... extract other fields
     return { platform: 'newplatform', jobTitle, ... };
   }
   ```

4. **Update the main extract method**
   ```javascript
   extract() {
     switch (platform) {
       case 'newplatform':
         return this.extractNewPlatform();
     }
   }
   ```

## Technical Details

### Manifest V3
This extension uses Manifest V3, the latest Chrome extension platform:
- Service workers instead of background pages
- Improved security and performance
- Future-proof for Chrome/Edge updates

### Privacy & Security
- All data stored locally in your browser
- No data sent to external servers (except Claude API)
- API key stored securely in Chrome's local storage
- No tracking or analytics

### API Usage
- Uses Claude 3.5 Sonnet model
- Typically 1,000-3,000 tokens per analysis
- Costs approximately $0.01-0.03 per job analysis
- API key required (get one at console.anthropic.com)

## Troubleshooting

### Extension not loading
- Ensure Developer mode is enabled
- Check for errors in `edge://extensions/` or `chrome://extensions/`
- Try removing and re-adding the extension

### Button not appearing on job pages
- Ensure you're on a supported platform (LinkedIn, Greenhouse, Lever)
- Wait for the page to fully load
- Check the browser console for errors (F12)
- The button appears in the bottom-right corner

### Analysis fails
- Verify your API key is correct (Settings → Test Key)
- Check your internet connection
- Ensure you have API credits remaining
- Check the browser console for detailed error messages

### Jobs not saving
- Check browser storage isn't full
- Try clearing some old jobs
- Check the browser console for errors

## Future Enhancements

Potential features for future versions:
- [ ] Support for more job platforms (Indeed, Glassdoor, etc.)
- [ ] Custom analysis prompts
- [ ] Job comparison feature
- [ ] Export analyses to PDF/Markdown
- [ ] Integration with job tracking tools
- [ ] Salary estimation and negotiation tips
- [ ] Resume matching and gap analysis
- [ ] Interview preparation suggestions

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

MIT License - feel free to use and modify as needed.

## Credits

Built with:
- [Claude AI](https://www.anthropic.com/claude) by Anthropic
- Chrome Extension APIs
- Modern JavaScript (ES6+)

## Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Check the browser console for error messages
- Ensure you're using the latest version

## Changelog

### Version 1.0.0 (Initial Release)
- Basic job extraction for LinkedIn, Greenhouse, and Lever
- Claude AI integration for job analysis
- Local storage for job history
- Extension popup interface
- API key management
- Multi-platform support

---

**Happy job hunting! 🎯**
