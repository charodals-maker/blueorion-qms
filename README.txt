BLUEORION QMS FILE MAP

Root Folder:
BLUEORION_QMS/

Folders:
assets/               Shared CSS, logo, branding assets.
templates/            Frontend HTML templates.
uploads/              Medical Report PDF storage.

Templates:
templates/login.html           Secure entry portal.
templates/dashboard.html       Executive command center.
templates/selection_live.html  Live sourcing and status tracker.

Backend:
app.py                         Python server entrypoint.
sourcing_engine.py             Yahoo/Gmail polling stub using app passwords.

Live Workspace Equivalents:
server.js                      Existing Node.js main server in current workspace.
views/contact_us.html          Current public contact page.
views/sourcing_dashboard.html  Current live selection implementation.
assets/blueorion_config.js     Shared Blueorion contact and routing config.
users_database.py              Existing Python-backed login source.

Credentials Added:
Username: blueorion_staff01
Staff ID: BOR-2026-001
Role: Staff Level 3
Modules: Sourcing (#2), Profiles (#10), Selection (#11)
Temporary Password: BlueorionStart2026!

Security Notes:
1. Do not place normal Yahoo or Gmail passwords in source code.
2. Use app passwords via environment variables:
   BLUEORION_YAHOO_APP_PASSWORD
   BLUEORION_GMAIL_APP_PASSWORD
3. Require password change after first login.
4. Keep finance modules hidden from staff accounts.

End-to-End Test:
1. Send a test email to Blueorionapply@yahoo.com.
2. Confirm a new lead appears in the live selection table.
3. Add interview notes and change status to Interview Scheduled.
4. Upload a sample PDF into uploads/.
5. Change status to Fit to Work.
6. Confirm WhatsApp and partner notification triggers.
7. Print Bio-Data and verify Atlantis Beacon Tower branding.
