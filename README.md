# Guitar Practice Assistant

A web application that helps musicians manage practice routines, exercises, and guitar-specific content like chord charts.

## Features

- **Practice Session Management**: Create and manage practice routines with timing
- **Interactive Chord Charts**: Visual chord diagrams with SVGuitar integration
- **Autocreate from Files**: Upload PDFs/images and automatically generate chord charts using AI
- **Google Sheets Integration**: Data stored in Google Sheets for easy mobile access
- **Guitar-Specific**: Tuning tracking, capo support, chord chart editing

## Setup

### Prerequisites

- Python 3.10+
- Node.js and npm
- Google Cloud Project with Sheets API enabled
- Anthropic API key (for autocreate feature)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd guitar-practice-assistant
   ```

2. **Set up Python environment**
   ```bash
   pip install -e .
   ```

3. **Install frontend dependencies**
   ```bash
   npm install
   ```

4. **Configure environment variables**
   ```bash
   cp .env.template .env
   ```
   
   Edit `.env` and fill in your values:
   - `ANTHROPIC_API_KEY`: Get from [Anthropic Console](https://console.anthropic.com/)
   - `SECRET_KEY`: Generate a secure random key
   - Update `PYTHONPATH` to your project directory

5. **Set up Google Sheets API**
   - Create a Google Cloud Project
   - Enable the Google Sheets API
   - Create OAuth2 credentials
   - Download and save as `client_secret.json` in the project root

### Running the Application

Start the development server:
```bash
./gpr.sh
```

This runs both the Flask backend and Vite frontend watcher.

Navigate to `http://localhost:5000` to use the app.

## Features

### Autocreate Chord Charts

Upload PDF files or images containing chord charts, and the AI will automatically:
- Extract song sections (Verse, Chorus, etc.)
- Identify chord names and fingerings
- Create interactive chord charts
- Organize by song structure

Supported file types: PDF, PNG, JPG, JPEG (max 10MB)

### Manual Chord Chart Creation

- Interactive fretboard editor
- Support for custom tunings and capo positions
- Section organization with repeat counts
- Copy chord charts between songs

## Architecture

- **Backend**: Flask with Google Sheets as database
- **Frontend**: React + Vite + Tailwind CSS
- **Data Storage**: Google Sheets (travel-friendly!)
- **AI Integration**: Anthropic Claude for file analysis

## Security

- Environment variables are used for all sensitive data
- `.env` file is gitignored
- Use `.env.template` as a reference for required variables
- Never commit API keys or secrets to version control

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

When contributing:
1. Never commit sensitive data (API keys, credentials)
2. Use environment variables for configuration
3. Test both manual and autocreate chord chart features
4. Follow the existing code style and patterns