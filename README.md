# Guitar Practice Routine Assistant

An web app to manage practice routines, for beginner and intermidiate guitar players. 
Includes a chord chart generator with thousands of chords, and an import/autocreate feature for alternate tunings and voicings. You can edit the chord charts and/or create your own from scratch

## Features

- **Practice Session Management**: Create and manage practice routines
- **Chord Charts**: Visual chord charts (courtesy [SVGuitar](https://github.com/omnibrain/svguitar))
- **Huge List of Chords**: Type a chord name to have the chart created for you (thanks to [David Rupert](https://github.com/tombatossals/chords-db) via [Zoltán Szabó](https://github.com/szaza/guitar-chords-db-json))
- **Autocreate from Files**: Upload PDFs/images to get automatically generate chord charts
- **Google Sheets Integration**: Data stored in Google Sheets for easy access, revision history (PostgreSQL version on the way)
- **Guitar-Specific**: I mean, you can use it for other instruments, but I'm just a guitar hobbyist, so don't expect future features for other instruments.

## Setup

### Prerequisites

- A bash shell and some basic CLI know-how
- Python 3.10+
- Node.js and npm
- Google Cloud Project with Sheets API enabled
- Anthropic API key (for autocreate feature)
- Access to the interwebtubes

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd gpr
   ```

2. **Set up Python environment**
   ```bash
   pip install -e .
   ```

3. **Install frontend dependencies**
   ```bash
   npm install
   ```

4. **Set up Google Cloud and Sheets API**
   
   a) **Create Google Cloud Project and enable Sheets API**
   - Follow the [Google Cloud Console guide](https://developers.google.com/sheets/api/quickstart/python#step_1_turn_on_the) to:
     - Create a new project
     - Enable the Google Sheets API
   
   b) **Set up OAuth2 credentials**
   - In [Google Cloud Console](https://console.cloud.google.com/), go to APIs & Services → Credentials
   - Create OAuth 2.0 Client ID credentials (Desktop application type)
   - Download the JSON file and save as `client_secret.json` in the project root
   
   c) **Create your practice spreadsheet**
   - Create a new Google Sheets document
   - Copy the spreadsheet ID from the URL (the long string between `/d/` and `/edit`)
   - Ensure the spreadsheet is accessible by your Google account

5. **Set up Anthropic API (for autocreate feature)**
   - Get your API key from the [Anthropic Console](https://console.anthropic.com/)

6. **Configure environment variables**
   ```bash
   cp .env.template .env
   ```
   
   Edit `.env` and fill in your values:
   - `GOOGLE_CLIENT_ID`: From your downloaded `client_secret.json`
   - `GOOGLE_CLIENT_SECRET`: From your downloaded `client_secret.json` 
   - `GOOGLE_PROJECT_ID`: Your Google Cloud project ID
   - `GOOGLE_SPREADSHEET_ID`: The ID from your Google Sheets URL
   - `ANTHROPIC_API_KEY`: From Anthropic Console (optional - needed for autocreate feature)
   - `SECRET_KEY`: Generate a secure random key
   - `PYTHONPATH`: Update to your project directory path

### Running the Application

1. **Start the development server**
   ```bash
   ./gpr.sh
   ```
   This runs both the Flask backend and Vite frontend watcher.

2. **First-time setup**
   - Navigate to `http://localhost:5000`
   - Click "Authorize with Google" to complete OAuth flow
   - Grant permission to access your Google Sheets
   - The app will create the necessary sheets in your spreadsheet automatically

### Quick start after setup
   - Start on the `Items` page to create items (e.g. excercies, songs, etc.)
   - Go to the `Routines` page to create routines and add items 
   - Go to the practice page, click on an item/song, then expand the `Chord Charts` section to build or autocreate chord charts 

## Features

### Autocreate Chord Charts
(Anthropic API key required)

Upload PDF files or images containing chord charts, and Claude will automatically:
- Extract song sections (Verse, Chorus, etc.)
- Identify chord names and fingerings
- Create interactive chord charts
- Organize by song structure

Supported file types: PDF, PNG, JPG (max 10MB)

### Manual Chord Chart Creation (SVGuitar)

- Interactive fretboard editor
- Support for custom tunings, capo positions, starting fret etc.
- Section organization with repeat counts
- Copy chord charts between songs (for when you have multiple practice items for the same song)

## Architecture

- **Backend**: Flask with Google Sheets as database
- **Frontend**: React + Vite + Tailwind CSS
- **Data Storage**: Google Sheets (PostgreSQL version on the way)
- **AI Integration**: Anthropic Claude Opus 4.1 for visual analysis of uploaded files, other tasks handled by Sonnet 4)

## Troubleshooting

### Common Setup Issues

**"No valid credentials" error**
- Ensure `client_secret.json` is in the project root directory
- Check that your Google Cloud project has the [Google Sheets API enabled](https://developers.google.com/sheets/api/quickstart/python#step_1_turn_on_the)
- Verify OAuth 2.0 credentials are configured as "Desktop application" type ([Google OAuth setup guide](https://developers.google.com/workspace/guides/create-credentials#oauth-client-id))

**"GOOGLE_SPREADSHEET_ID not set" error**
- Make sure your `.env` file contains `GOOGLE_SPREADSHEET_ID=your_actual_spreadsheet_id`
- The spreadsheet ID is the long string in your Google Sheets URL between `/d/` and `/edit` ([Google's guide to finding spreadsheet IDs](https://developers.google.com/sheets/api/guides/concepts#spreadsheet_id))

**Autocreate feature not working**
- Verify `ANTHROPIC_API_KEY` is set in your `.env` file
- Check you have [API credits available](https://console.anthropic.com/settings/usage) in your Anthropic account
- Ensure your API key has the correct permissions ([Anthropic API keys documentation](https://docs.anthropic.com/en/api/getting-started))

**Python/Node.js version issues**
- Ensure Python 3.10+ is installed ([Python installation guide](https://www.python.org/downloads/))
- Ensure Node.js 16+ is installed ([Node.js installation guide](https://nodejs.org/en/download/package-manager))
- Consider using `python3` instead of `python` on some systems

**OAuth redirect URI errors**
- Ensure your OAuth credentials include `http://localhost:5000/oauth2callback` in the authorized redirect URIs
- See [Google's redirect URI documentation](https://developers.google.com/identity/protocols/oauth2/web-server#creatingcred) for details

**Google Sheets permissions errors**
- Make sure the Google account you're authenticating with has edit access to your practice spreadsheet
- If sharing the spreadsheet, ensure it's shared with your OAuth client email ([Google Sheets sharing guide](https://support.google.com/docs/answer/2494822))

## Security

- Environment variables are used for all sensitive data
- `.env` file is gitignored
- Use `.env.template` as a reference for required variables
- Never commit API keys or secrets to version control
- Caution: I relied heavily on vibe-coding to build this

## Support

- LOL, no. I do support for a living. This is just a side-project / hobby app with no revenue. [Claude Code](https://www.anthropic.com/claude-code) can help you fix or change stuff, the included `CLAUDE.md` file will help a lot.

## Development

The app uses a multi-process development setup:
- Flask server with auto-reload (port 5000)
- Vite build watcher for frontend assets
- Hot reloading for both frontend and backend

### Key Files

- `app/routes.py`: API endpoints
- `app/sheets.py`: Google Sheets data layer
- `app/static/js/components/`: React components
- `app/static/js/components/PracticePage.jsx`: Main practice interface
- `app/static/js/components/ChordChartEditor.jsx`: Chord chart creation

## Contributing

### Branch Naming Convention

Please name your branches using this pattern:
```
(fix|enhancement)-(component-or-function)-(your-username)
```

**Examples:**
- `fix-chord-editor-john123`
- `enhancement-practice-timer-sarah_dev` 
- `fix-authentication-mike`

**Components:**
- `fix` - Bug fixes and corrections
- `enhancement` - New features or improvements
- `component-or-function` - What you're working on (e.g., chord-editor, practice-timer, authentication)
- `your-username` - Your GitHub username

### Guidelines

When contributing:
1. Never commit sensitive data (API keys, credentials)
2. Use environment variables for configuration
3. Test both manual and autocreate chord chart features
4. Follow the existing code style and patterns
5. Submit pull requests for review before merging

Open source for now, but I may monetize it if it gets popular, so keep that in mind before contributing.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments & Attribution

This project builds upon the excellent work of many open source projects and services:

### Core Technologies
- **[Flask](https://flask.palletsprojects.com/)** - Python web framework
- **[React](https://reactjs.org/)** - Frontend JavaScript library
- **[Vite](https://vitejs.dev/)** - Build tool and development server
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework

### Guitar-Specific Libraries
- **[SVGuitar](https://github.com/omnibrain/svguitar)** - SVG guitar chord chart rendering
- **[Guitar Chords DB](https://github.com/tombatossals/chords-db)** by David Rupert - Chord database
- **[Guitar Chords DB JSON](https://github.com/szaza/guitar-chords-db-json)** by Zoltán Szabó - JSON formatted chord data

### APIs & Services
- **[Google Sheets API](https://developers.google.com/sheets/api)** - Cloud-based data storage
- **[Anthropic Claude](https://www.anthropic.com/)** - AI-powered chord chart analysis and generation
- **[Google Cloud Platform](https://cloud.google.com/)** - OAuth2 authentication services

### Development Tools
- **[Python](https://www.python.org/)** - Backend programming language
- **[Node.js](https://nodejs.org/)** - JavaScript runtime for build tools
- **[npm](https://www.npmjs.com/)** - Package manager

Thank you to all the maintainers and contributors of these projects! 🎸