const path = require('path');
require('dotenv').config({ 
  path: path.resolve(__dirname, '../../.env')
});
const mysql = require('mysql2/promise');
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
});


async function waitForDb(retries = 30, delayMs = 2000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('Database terhubung');
      return;
    } catch (err) {
      console.log(`Menunggu database... (${i}/${retries}) ${err.code || err.message}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('Database tidak dapat dihubungi');
}

module.exports = { pool, waitForDb };