import pool from './db.js';
import fs from 'fs';

async function runMigrations() {
  const sql = fs.readFileSync('./migrations.sql', 'utf8');
  try {
    await pool.query(sql);
    console.log('Migrations applied successfully.');
  } catch (err) {
    console.error('Migration error:', err.message);
  } finally {
    pool.end();
  }
}

runMigrations();
