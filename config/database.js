/**
 * Database Configuration for BLUEORION QMS
 * PostgreSQL connection pool setup with optimized settings
 * Phase 2: Database Enhancement
 */

const { Pool } = require('pg');
require('dotenv').config();

// Database pool configuration
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'blueorion_qms',
  
  // Connection pooling settings
  max: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  
  // Query timeout
  statement_timeout: 30000,
  
  // SSL settings (optional, for production)
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false
});

// Error handling
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

/**
 * Execute query with optional caching
 * @param {string} query - SQL query
 * @param {array} values - Query parameters
 * @param {object} options - Query options { timeout: ms, cache: boolean }
 * @returns {Promise} Query result
 */
async function query(sql, values = [], options = {}) {
  const startTime = Date.now();
  try {
    const result = await pool.query(sql, values);
    const duration = Date.now() - startTime;
    
    if (process.env.NODE_ENV === 'development' && duration > 1000) {
      console.warn(`⚠️  Slow query (${duration}ms):`, sql.substring(0, 50));
    }
    
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

/**
 * Get connection for transaction
 * @returns {Promise<PoolClient>}
 */
async function getClient() {
  return pool.connect();
}

/**
 * Get database connection statistics
 * @returns {object} Pool stats
 */
function getPoolStats() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    activeConnections: pool.totalCount - pool.idleCount
  };
}

/**
 * Health check - verify database connectivity
 * @returns {Promise<boolean>}
 */
async function healthCheck() {
  try {
    const result = await query('SELECT 1');
    return result.rows.length > 0;
  } catch (error) {
    console.error('Database health check failed:', error.message);
    return false;
  }
}

/**
 * Close pool (graceful shutdown)
 * @returns {Promise}
 */
async function closePool() {
  return pool.end();
}

module.exports = {
  pool,
  query,
  getClient,
  getPoolStats,
  healthCheck,
  closePool
};
