/**
 * Upload local database data to Cloud (Railway)
 * Run: node src/scripts/uploadLocalDataToCloud.js
 */
const { Pool } = require('pg');

const CLOUD_URL = process.env.CLOUD_BACKEND_URL || 'https://waterwatch-backend-production.up.railway.app';
const SYNC_SECRET = process.env.SYNC_SECRET || 'waterwatch_sync_secret_2026';

const localPool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'water_monitor',
  user: 'postgres',
  password: '1234',
});

async function main() {
  console.log('=============================================');
  console.log(' WaterWatch — Local to Cloud Data Migrator');
  console.log('=============================================');

  try {
    console.log('[1/4] Reading data from local database (localhost:5432)...');
    const [stationsRes, readingsRes, alertsRes, usersRes] = await Promise.all([
      localPool.query('SELECT * FROM station'),
      localPool.query('SELECT * FROM readings ORDER BY timestamp ASC'),
      localPool.query('SELECT * FROM alerts ORDER BY timestamp ASC'),
      localPool.query('SELECT * FROM users'),
    ]);

    const payload = {
      stations: stationsRes.rows,
      readings: readingsRes.rows,
      alerts: alertsRes.rows,
      users: usersRes.rows,
    };

    console.log(`[OK] Found local data:`);
    console.log(`   • Stations: ${payload.stations.length}`);
    console.log(`   • Readings: ${payload.readings.length}`);
    console.log(`   • Alerts:   ${payload.alerts.length}`);
    console.log(`   • Users:    ${payload.users.length}`);

    console.log(`\n[2/4] Uploading to ${CLOUD_URL}/api/internal/sync-backup...`);

    const res = await fetch(`${CLOUD_URL}/api/internal/sync-backup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sync-secret': SYNC_SECRET,
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    if (!res.ok || !result.success) {
      console.error('[ERROR] Cloud rejected sync:', result);
      process.exit(1);
    }

    console.log('\n[3/4] [SUCCESS] All data migrated to Railway Cloud Postgres!');
    console.log('Stats from Cloud:', result.stats);
    console.log('\n[4/4] Done! You can now refresh the Web Dashboard.');
    process.exit(0);
  } catch (err) {
    console.error('[ERROR]', err.message);
    process.exit(1);
  } finally {
    await localPool.end();
  }
}

main();
