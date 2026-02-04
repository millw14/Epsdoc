# Railway Deployment Guide for Webstein

## Quick Deploy Steps

1. **Host the Database File**
   The database (266MB) is too large for GitHub. You need to host it externally:
   
   **Option A: GitHub Releases (Recommended)**
   - Go to your repo on GitHub
   - Click "Releases" → "Create a new release"
   - Upload `document_analysis.db` as a release asset
   - Copy the direct download URL (right-click the file → Copy link address)
   
   **Option B: Google Drive**
   - Upload `document_analysis.db` to Google Drive
   - Right-click → Share → Anyone with link
   - Convert share link to direct download:
     `https://drive.google.com/uc?export=download&id=YOUR_FILE_ID`

2. **Create Railway Account**
   - Go to [Railway.app](https://railway.app)
   - Sign up / Login with GitHub

3. **New Project from GitHub**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose the `Epsdoc` repository

4. **Set Environment Variables**
   In Railway dashboard, go to Variables and add:

   ```
   DB_URL=https://github.com/millw14/Epsdoc/releases/download/v1.0/document_analysis.db
   VITE_GROQ_API_KEY=your_groq_api_key_here
   ```

   > **DB_URL** - Direct download URL to your hosted database file
   > **VITE_GROQ_API_KEY** - Get from [console.groq.com](https://console.groq.com)

5. **Deploy**
   Railway will automatically:
   - Download the database from DB_URL
   - Install dependencies
   - Build the React frontend
   - Start the Express server

6. **Custom Domain (Optional)**
   - Go to Settings > Domains
   - Add a custom domain or use the generated `*.up.railway.app` URL

## Important Notes

### Database Hosting
- The database (266MB) exceeds GitHub's 100MB file limit
- It's stored in Git LFS for local development
- For Railway, you must host it externally and provide DB_URL

### Environment Variables Needed

| Variable | Required | Description |
|----------|----------|-------------|
| `DB_URL` | **Yes** | Direct download URL to database file |
| `VITE_GROQ_API_KEY` | Yes | Groq API key for AI features |
| `PORT` | No | Server port (Railway sets automatically) |
| `DB_PATH` | No | Database path (defaults to `document_analysis.db`) |
| `ALLOWED_ORIGINS` | No | CORS origins (Railway domains auto-allowed) |

### Build Process
1. Download database from `DB_URL`
2. `npm install` - Install dependencies
3. Build frontend (`network-ui/`)
4. Start Express server

### Files for Railway

- `railway.json` - Railway configuration
- `nixpacks.toml` - Build configuration (includes curl for downloads)
- `Procfile` - Process definition
- `build.sh` - Build script with database download

## Troubleshooting

### "Database file missing" Error
- Make sure `DB_URL` environment variable is set in Railway
- Verify the URL is a direct download link (not a preview page)
- Test the URL: `curl -I YOUR_DB_URL` should return 200 OK

### Build Fails
- Check Railway logs for download errors
- Verify database URL is accessible

### Frontend Not Loading
- Check that build completed in logs
- Verify CORS is allowing your Railway domain

### AI Not Working
- Make sure `VITE_GROQ_API_KEY` is set
- Frontend env vars need a redeploy to take effect

## Local Development

```bash
# Install dependencies
npm install
cd network-ui && npm install && cd ..

# Build frontend
npm run build

# Start server (serves both API and frontend)
npm start

# Access at http://localhost:3001
```
