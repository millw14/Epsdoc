# Railway Deployment Guide for Webstein

## Quick Deploy Steps

1. **Create Railway Account**
   - Go to [Railway.app](https://railway.app)
   - Sign up / Login with GitHub

2. **New Project from GitHub**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose the `Epsdoc` repository

3. **Set Environment Variables**
   In Railway dashboard, go to Variables and add:

   ```
   PORT=3001
   VITE_GROQ_API_KEY=your_groq_api_key_here
   ```

   > Get your Groq API key from [console.groq.com](https://console.groq.com)

4. **Deploy**
   Railway will automatically:
   - Install root dependencies
   - Install frontend dependencies (`network-ui/`)
   - Build the React frontend
   - Start the Express server

5. **Custom Domain (Optional)**
   - Go to Settings > Domains
   - Add a custom domain or use the generated `*.up.railway.app` URL

## Important Notes

### Database
- The `document_analysis.db` SQLite file must be in the repo
- Railway uses ephemeral storage - database changes won't persist across deploys
- For production, consider moving to PostgreSQL

### Environment Variables Needed

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (Railway sets this automatically) |
| `VITE_GROQ_API_KEY` | Yes | Groq API key for AI features |
| `DB_PATH` | No | Database path (defaults to `document_analysis.db`) |
| `ALLOWED_ORIGINS` | No | CORS origins (Railway domains auto-allowed) |

### Build Process
The deployment uses these scripts in order:
1. `npm install` - Install root dependencies
2. `postinstall` script - Installs and builds the frontend
3. `npm start` - Runs the Express server with tsx

### Files Created for Railway

- `railway.json` - Railway-specific configuration
- `nixpacks.toml` - Nixpacks build configuration
- `Procfile` - Alternative process definition
- `.env.example` - Environment variable template

## Troubleshooting

### Build Fails
- Check that `document_analysis.db` is in the repo
- Ensure all dependencies are listed in package.json

### Frontend Not Loading
- Check that the build completed (look for `network-ui/dist/` in logs)
- Verify CORS is allowing your Railway domain

### API Errors
- Check the Logs tab in Railway dashboard
- Verify database file exists and has data

### AI Not Working
- Make sure `VITE_GROQ_API_KEY` is set in Railway Variables
- Note: Frontend env vars need a redeploy to take effect

## Local Testing (before deploy)

```bash
# Install all dependencies
npm install
cd network-ui && npm install && cd ..

# Build frontend
npm run build

# Start server (serves both API and frontend)
npm start

# Access at http://localhost:3001
```
