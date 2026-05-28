# BLUEORION QMS Deployment Guide (GitHub -> Render)

This guide deploys the current repository to Render as a Node.js web service with automatic deploys from GitHub.

## 1. Prerequisites

- A GitHub repository containing this project
- A Render account connected to your GitHub account
- Node.js app files already present (this repo includes `render.yaml`)

## 2. Push Latest Changes to GitHub

From your project root:

```bash
git add .
git commit -m "chore: prepare Render deployment"
git push origin main
```

If your default branch is not `main`, push to your active branch and use that branch on Render.

## 3. Deploy on Render (Blueprint Method)

1. Open Render dashboard.
2. Click New + -> Blueprint.
3. Select your GitHub repository.
4. Render will detect `render.yaml` and show service `blueorion-qms`.
5. Confirm and create the service.

Current blueprint settings from `render.yaml`:
- Runtime: `node`
- Build command: `npm ci`
- Start command: `npm start`
- Health check: `/api/health`
- Auto deploy: enabled

## 4. Environment Variables

Set these in Render service settings if needed:

- `NODE_ENV=production`
- `API_RATE_LIMIT_MAX=600`
- `AUTH_RATE_LIMIT_MAX=20`

If your app uses database or external APIs, add those secrets in Render Environment and do not commit them to Git.

## 5. Verify Deployment

After first successful deploy:

- App URL: `https://<your-service>.onrender.com`
- Health URL: `https://<your-service>.onrender.com/api/health`
- API info URL: `https://<your-service>.onrender.com/api/info`

Expected health response should include status fields and return HTTP 200.

## 6. Continuous Deployment

With `autoDeploy: true`, every push to the connected branch triggers a new Render deploy.

Recommended workflow:

```bash
git add .
git commit -m "feat: your change"
git push origin main
```

## 7. Troubleshooting

- Build fails on dependencies:
  - Confirm `package-lock.json` is committed (required for `npm ci`).
- Health check fails:
  - Verify `/api/health` responds locally with `npm start`.
- App does not bind to port:
  - Ensure app reads `process.env.PORT` (already implemented in this repo).
- Slow first request:
  - Render free instances may cold-start after idle periods.

## 8. Optional: Local Smoke Test Before Push

```bash
npm ci
npm start
```

Then open:
- `http://localhost:3000/api/health`
- `http://localhost:3000/login.html`

If both load, push to GitHub and let Render auto-deploy.
