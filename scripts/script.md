# Scripts Library

This directory contains utility scripts for the StudyBuddy project.

## Available Scripts

### Check Available Models

Lists all Gemini models that support `generateContent`:

```bash
npx tsx scripts/check-models.ts
```

This script:
- Fetches all available models from Google Generative AI API
- Filters models that support `generateContent`
- Displays model names, descriptions, token limits, and supported methods
- Shows which models are currently used in the application

**Requirements:**
- `GEMINI_API_KEY` must be set in `.env.local`
- Dependencies: `dotenv`, `tsx` (installed as dev dependencies)

---

## Development Server Commands

### Start Development Server

```bash
npm run dev
```

Starts the Next.js development server. The server will:
- Run on `http://localhost:3000` (or next available port if 3000 is in use)
- Enable hot-reloading for development
- Load environment variables from `.env.local`

### Stop Development Server

**If running in the current terminal:**
- Press `Ctrl + C` (Windows/Linux) or `Cmd + C` (Mac)

**If running in background or another terminal:**

**PowerShell:**
```powershell
# Find and kill by port (if running on port 3000)
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

# Or kill by process ID
taskkill /PID <PID_NUMBER> /F

# Or kill all Node processes (use with caution)
taskkill /F /IM node.exe
```

**Find the process:**
```powershell
# List Node processes
Get-Process -Name node

# Find process using port 3000
netstat -ano | findstr ":3000"
```

---

## Notes

- All scripts should be run from the project root directory
- Environment variables are loaded from `.env.local` (not committed to git)
- TypeScript scripts require `tsx` to run directly without compilation
