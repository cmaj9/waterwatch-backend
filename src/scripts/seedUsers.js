/**
 * Seed Users Script
 * ------------------
 * Inserts initial user accounts into the users table with bcrypt-hashed passwords.
 * All accounts use password: demo1234
 *
 * Run: node src/scripts/seedUsers.js
 *
 * Prerequisites:
 *   1. Run sql/add_users.sql first to create the users table
 *   2. npm install bcrypt (already in package.json if added)
 */

require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../config/database');

const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = 'demo1234';

const usersToSeed = [
  {
    name: 'สมชาย ใจดี',
    email: 'somchai@example.com',
    phone: '0812345678',
    role: 'citizen',
    district: 'คลองหก ปทุมธานี',
    station_ids: ['ST-001', 'ST-002'],
    line_user_id: null,
  },
  {
    name: 'สมหญิง รักไทย',
    email: 'somying@example.com',
    phone: '0823456789',
    role: 'citizen',
    district: 'เมือง เชียงใหม่',
    station_ids: [],
    line_user_id: null,
  },
  {
    name: 'นายวิชัย เจ้าหน้าที่',
    email: 'wichai.staff@dwr.go.th',
    phone: '0834567890',
    role: 'staff',
    district: 'ธัญบุรี ปทุมธานี',
    station_ids: [],
    line_user_id: null,
  },
  {
    name: 'นางสาวมาลี เจ้าหน้าที่',
    email: 'malee.staff@dwr.go.th',
    phone: '0845678901',
    role: 'staff',
    district: 'พระนครศรีอยุธยา',
    station_ids: [],
    line_user_id: null,
  },
  {
    name: 'ผู้ดูแลระบบ',
    email: 'admin@dwr.go.th',
    phone: '0856789012',
    role: 'admin',
    district: 'ส่วนกลาง',
    station_ids: [],
    line_user_id: null,
  },
];

async function seedUsers() {
  console.log('===========================================');
  console.log('  Seed Users Script');
  console.log('===========================================');
  console.log(`  Default password: ${DEFAULT_PASSWORD}`);
  console.log(`  Hashing with bcrypt (${SALT_ROUNDS} rounds)...\n`);

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);
  console.log(`  Password hash generated.\n`);

  let inserted = 0;
  let skipped = 0;

  for (const u of usersToSeed) {
    try {
      const res = await db.query(
        `INSERT INTO users (name, email, password_hash, phone, role, district, station_ids, line_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (email) DO NOTHING
         RETURNING user_id, email`,
        [u.name, u.email, passwordHash, u.phone, u.role, u.district, u.station_ids, u.line_user_id]
      );

      if (res.rows.length > 0) {
        console.log(`  [OK] Inserted: ${u.email} (${u.role}) → user_id: ${res.rows[0].user_id}`);
        inserted++;
      } else {
        console.log(`  [SKIP] Skipped (already exists): ${u.email}`);
        skipped++;
      }
    } catch (err) {
      console.error(`  [ERROR] Failed to insert ${u.email}:`, err.message);
    }
  }

  console.log(`\n  Done. Inserted: ${inserted}, Skipped: ${skipped}`);
  console.log('═══════════════════════════════════════════');
  process.exit(0);
}

seedUsers().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
