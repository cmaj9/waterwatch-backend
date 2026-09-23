/**
 * Database initialization script
 * Run: node src/scripts/initDb.js
 *
 * This will create all tables defined in sql/init.sql
 */
require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function initDb() {
  const client = new Client({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME     || 'water_monitor',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || '',
  });

  try {
    await client.connect();
    console.log('[OK] Connected to PostgreSQL');

    const sqlPath = path.join(__dirname, '../../sql/init.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    await client.query(sql);
    console.log('[OK] Database initialized successfully!');
    console.log('   Tables created: gateway, station, mcu, readings, alerts');
  } catch (err) {
    console.error('[ERROR] Failed to initialize database:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

initDb();
