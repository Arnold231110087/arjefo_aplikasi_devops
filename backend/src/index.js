const path = require('path');
require('dotenv').config({ 
  path: path.resolve(__dirname, '../../.env')
});
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { pool, waitForDb } = require('./db');

const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const loanRoutes = require('./routes/loans');
const reservationRoutes = require('./routes/reservations');
const { expireReservations } = require('./utils/reservationQueue');
const reviewRoutes = require('./routes/reviews');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'up', version: process.env.APP_VERSION});
  } catch {
    res.status(503).json({ status: 'error', database: 'down' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use((req, res) => res.status(404).json({ message: 'Endpoint tidak ditemukan' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Terjadi kesalahan pada server' });
});

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (rows.length === 0) {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO users (name, email, password, role) VALUES ('Administrator', ?, ?, 'admin')",
      [email, hash]
    );
    console.log(`Akun admin dibuat: ${email}`);
  }
}

const PORT = Number(process.env.PORT);

async function start() {
  await waitForDb();
  await seedAdmin();
  const runExpiry = () => expireReservations(pool)
    .then((n) => n && console.log(`${n} reservasi kedaluwarsa diproses`))
    .catch((e) => console.error('Gagal memproses reservasi:', e.message));
  runExpiry();
  setInterval(runExpiry, 60 * 60 * 1000);
  app.listen(PORT, () => console.log(`Backend PustakaKu berjalan di port ${PORT}`));
}

if (require.main === module) {
  start().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = app;
