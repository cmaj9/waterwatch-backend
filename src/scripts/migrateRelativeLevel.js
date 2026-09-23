/**
 * Migration script: Migrate database to support Relative Water Level & Reference Point Calibration
 * Run: node src/scripts/migrateRelativeLevel.js
 */
require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
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

    const sqlPath = path.join(__dirname, '../../sql/migrate_relative_level.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Running migration script...');
    await client.query(sql);
    console.log('[OK] Migration applied successfully!');

    // Verify results
    const stations = await client.query(
      `SELECT station_id, station_name, sensor_to_ref_distance, reference_point_name, warning_level, critical_level FROM station`
    );
    console.log('\n[Stations updated]:');
    console.table(stations.rows);

    const countRes = await client.query(
      `SELECT COUNT(*) AS total_readings, COUNT(raw_distance) AS migrated_readings FROM readings`
    );
    console.log(`\n[Readings migrated]: ${countRes.rows[0].migrated_readings} / ${countRes.rows[0].total_readings}`);

  } catch (err) {
    console.error('[ERROR] Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
