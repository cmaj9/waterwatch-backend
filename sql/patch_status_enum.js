const db = require('../src/config/database');

async function run() {
  try {
    console.log('[Migration] Updating StationStatus enum...');
    await db.query(`ALTER TYPE "StationStatus" ADD VALUE IF NOT EXISTS 'offline'`);
    console.log('[Migration] Added offline to StationStatus enum successfully!');
    process.exit(0);
  } catch (err) {
    console.error('[Migration] Error:', err.message);
    process.exit(1);
  }
}

run();
