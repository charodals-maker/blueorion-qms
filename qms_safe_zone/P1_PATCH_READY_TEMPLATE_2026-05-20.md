# Blueorion QMS P1 Patch-Ready Template
Date: 2026-05-20
Status: Ready to apply once backend repo is mounted

## Target 1: Backup Path Hardening

Use this in the lifecycle backup module (scheduler/service/helper) where backup files are written.

```js
const path = require('path');
const fs = require('fs');

const isProduction = process.env.NODE_ENV === 'production';

const BACKUP_DIR = isProduction
  ? path.join(process.cwd(), 'data', 'backups')
  : 'C:\\Users\\a\\Desktop\\QMS-BLUEORION 2026\\data\\backups';

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}
```

Recommended write log line:

```js
console.log(`[lifecycle-backup] Daily backup written to secure persistent storage: ${fullBackupPath}`);
```

## Target 2: Strict Production CORS

Use this in the main server bootstrap (server.js/app.js/index.js).

```js
const express = require('express');
const cors = require('cors');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

const rawOrigins = process.env.CORS_ORIGINS || '';
const allowedOrigins = rawOrigins
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    if (!isProduction || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Blocked by Production CORS Policy (CORS_ORIGINS not matched)'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
```

Optional startup visibility:

```js
if (isProduction) {
  if (allowedOrigins.length === 0) {
    console.warn('[CORS Security] Production mode detected but CORS_ORIGINS env not set. Defaulting to deny-all.');
  } else {
    console.log(`[startup] CORS Policy: Active (Origins: ${allowedOrigins.join(', ')})`);
  }
}
```

## Target 3: PostgreSQL Guardrail

In DB init/store module, enforce env-based connection and explicit warning fallback:

```js
const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!dbUrl) {
  console.warn('[pg-store] DATABASE_URL/POSTGRES_URL not set — running in local JSON-file mode.');
  console.warn('[startup] PostgreSQL not connected — running in file-based mode. Data will NOT persist across Render restarts.');
} else {
  console.log('[pg-store] Connected to PostgreSQL instance via DATABASE_URL');
}
```

## Pass-Criteria Log Signature

Expected healthy startup sequence after patch + env fix:

- Environment: production
- CORS Policy: Active (Origins: ...)
- Connected to PostgreSQL instance via DATABASE_URL
- lifecycle-backup path resolves to runtime Linux/project path
- Health endpoint returns 200

## Immediate Apply Plan Once Repo Is Mounted

1. Locate backup writer module and replace hardcoded path logic.
2. Locate server bootstrap and replace CORS middleware setup.
3. Locate db/store bootstrap and enforce DATABASE_URL guardrail logs.
4. Run startup smoke test and verify pass-criteria lines.
5. Produce commit-ready diff with only P1-scoped changes.
