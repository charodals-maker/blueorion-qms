# Blueorion QMS Server Quick Start

- **Login page:** http://localhost:3000/login.html
- **Dashboard:** http://localhost:3000/admin

## How to Start the Server
1. Open your terminal in the project folder.
2. Install dependencies once: `npm install`
3. Run: `npm start`
4. Wait for: `Server running on http://localhost:3000`
5. Do not close the terminal while using the site.

## Troubleshooting
- If you see `EADDRINUSE`, set a different port (PowerShell): `$env:PORT=3001; npm start`
- If you see a Windows Firewall popup, click "Allow Access."
- If you see red error text, copy it and ask for help.

## Render Deployment Startup
- Build command: `npm ci`
- Start command: `npm start`
- Health check path: `/api/health`

## Useful Links
- [Login](http://localhost:3000/login.html)
- [Dashboard](http://localhost:3000/admin)

---

**Tip:** Use `npm run dev` for auto-restart during development.