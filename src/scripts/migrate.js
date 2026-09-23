/**
 * Migration runner script
 * Run: node src/scripts/migrate.js
 *
 * Runs add_users.sql and add_alert_types.sql
 */
require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
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

    const addUsersSqlPath = path.join(__dirname, '../../sql/add_users.sql');
    if (fs.existsSync(addUsersSqlPath)) {
      console.log('Running sql/add_users.sql...');
      const sql = fs.readFileSync(addUsersSqlPath, 'utf8');
      await client.query(sql);
      console.log('[OK] sql/add_users.sql applied successfully!');
    }

    const addAlertTypesSqlPath = path.join(__dirname, '../../sql/add_alert_types.sql');
    if (fs.existsSync(addAlertTypesSqlPath)) {
      console.log('Running sql/add_alert_types.sql...');
      const sql = fs.readFileSync(addAlertTypesSqlPath, 'utf8');
      await client.query(sql);
      console.log('[OK] sql/add_alert_types.sql applied successfully!');
    }

    console.log('[OK] All migrations applied!');
  } catch (err) {
    console.error('[ERROR] Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
