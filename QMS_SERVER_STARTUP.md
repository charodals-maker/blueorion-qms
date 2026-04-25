# Blueorion QMS Server Quick Start

- **Login page:** http://localhost:3000/login.html
- **Dashboard:** http://localhost:3000/admin

## How to Start the Server
1. Open your terminal in the project folder.
2. Run: `node server.js` (or `nodemon server.js` if you have nodemon installed).
3. Wait for: `Server running on http://localhost:3000`
4. Do not close the terminal while using the site.

## Troubleshooting
- If you see `EADDRINUSE`, change the port in `server.js` (default is 3000).
- If you see a Windows Firewall popup, click "Allow Access."
- If you see red error text, copy it and ask for help.

## Useful Links
- [Login](http://localhost:3000/login.html)
- [Dashboard](http://localhost:3000/admin)

---

**Tip:** Use `nodemon` for auto-restart on code changes: `npm install -g nodemon`