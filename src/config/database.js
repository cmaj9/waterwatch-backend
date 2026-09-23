const { Pool } = require('pg');
require('dotenv').config();

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost')
        ? false
        : { rejectUnauthorized: false },
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'water_monitor',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };

const pool = new Pool({
  ...poolConfig,
  // Connection pool settings
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Test connection on startup
pool.on('connect', () => {
  console.log('[DB] Connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client:', err.message);
});

/**
 * Execute a query with optional parameters
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DB] Query executed in ${duration}ms | rows: ${res.rowCount}`);
    }
    return res;
  } catch (err) {
    console.error('[DB] Query error:', err.message);
    throw err;
  }
}

/**
 * Get a client from the pool (for transactions)
 */
async function getClient() {
  return pool.connect();
}

/**
 * Test the database connection
 */
async function testConnection() {
  try {
    const res = await pool.query('SELECT NOW() as now');
    console.log('[DB] Connection test OK - Server time:', res.rows[0].now);
    return true;
  } catch (err) {
    console.error('[DB] Connection test FAILED:', err.message);
    return false;
  }
}

module.exports = { query, getClient, pool, testConnection };
