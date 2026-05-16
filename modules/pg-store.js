/**
 * pg-store.js — PostgreSQL persistence adapter for Blueorion QMS
 *
 * Provides a transparent write-through mirror of the JSON flat-file stores
 * to a PostgreSQL database (e.g. Render Postgres).
 *
 * How it works:
 *   1. On `connect()`, creates the `kv_stores` table if it does not exist.
 *   2. `loadAll()` returns every store row as a { filename → parsed data } map.
 *   3. `save(filename, data)` upserts one row — called automatically from
 *      saveStore() in server-enhanced.js whenever data changes.
 *
 * The server falls back gracefully to JSON files when DATABASE_URL is absent.
 */

'use strict';

const { Pool } = require('pg');
const DbSchema = require('./db-schema');

class PgStore {
  constructor() {
    this.pool = null;
    this.ready = false;
    this.schema = null;
  }

  /**
   * Attempt to connect and set up the tables.
   * Returns true on success, false if DATABASE_URL is not configured or
   * the connection fails.
   */
  async connect() {
    const connStr = process.env.DATABASE_URL;
    if (!connStr) {
      console.log('[pg-store] DATABASE_URL not set — running in local JSON-file mode.');
      return false;
    }
    try {
      this.pool = new Pool({
        connectionString: connStr,
        // Render Postgres requires SSL in production
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      // Verify connection
      const client = await this.pool.connect();
      
      // Create kv_stores table for legacy JSON data
      await client.query(`
        CREATE TABLE IF NOT EXISTS kv_stores (
          key        TEXT PRIMARY KEY,
          value      JSONB        NOT NULL DEFAULT '[]',
          updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
      `);
      
      client.release();

      // Initialize relational schema
      this.schema = new DbSchema(this.pool);
      await this.schema.init();
      
      // Start automated alert checking every 1 hour
      setInterval(() => {
        this.schema.checkAndTriggerAlerts().catch(e => 
          console.error('[pg-store] Alert check error:', e.message)
        );
      }, 60 * 60 * 1000);

      this.ready = true;
      console.log('[pg-store] Connected to PostgreSQL — data will persist across restarts.');
      console.log('[pg-store] Relational schema initialized — applicant lifecycle tracking ready.');
      return true;
    } catch (err) {
      console.error('[pg-store] Connection failed:', err.message);
      console.error('[pg-store] Falling back to local JSON file storage.');
      this.pool = null;
      this.ready = false;
      return false;
    }
  }

  /**
   * Load all store rows from the database.
   * Returns a plain object: { 'sourcing_leads.json': [...], ... }
   */
  async loadAll() {
    if (!this.ready) return {};
    try {
      const { rows } = await this.pool.query('SELECT key, value FROM kv_stores');
      const result = {};
      for (const row of rows) {
        result[row.key] = row.value;
      }
      return result;
    } catch (err) {
      console.error('[pg-store] loadAll error:', err.message);
      return {};
    }
  }

  /**
   * Upsert a single store to the database.
   * Fire-and-forget — caller does not need to await.
   */
  async save(filename, data) {
    if (!this.ready) return;
    try {
      await this.pool.query(
        `INSERT INTO kv_stores (key, value, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (key) DO UPDATE
           SET value = EXCLUDED.value,
               updated_at = EXCLUDED.updated_at`,
        [filename, JSON.stringify(data)]
      );
    } catch (err) {
      console.error('[pg-store] save error for', filename, ':', err.message);
    }
  }

  /**
   * Load a single store by key.
   */
  async load(filename) {
    if (!this.ready) return null;
    try {
      const { rows } = await this.pool.query(
        'SELECT value FROM kv_stores WHERE key = $1',
        [filename]
      );
      return rows.length ? rows[0].value : null;
    } catch (err) {
      console.error('[pg-store] load error for', filename, ':', err.message);
      return null;
    }
  }

  /**
   * Query relational data (applicants, records, etc).
   */
  async query(sql, params) {
    if (!this.ready) return { rows: [] };
    try {
      const result = await this.pool.query(sql, params);
      return result;
    } catch (err) {
      console.error('[pg-store] query error:', err.message);
      return { rows: [] };
    }
  }

  /**
   * Get schema instance for access to audit logging and alert management.
   */
  getSchema() {
    return this.schema;
  }
}

module.exports = new PgStore();
