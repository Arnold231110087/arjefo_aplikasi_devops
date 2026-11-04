// FITUR 1 - Autentikasi & Manajemen Pengguna
const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { signToken, authRequired, adminOnly } = require('../middleware/auth');

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Nama, email, dan password wajib diisi' });
    }
    if (!EMAIL_RE.test(email)) return res.status(400).json({ message: 'Format email tidak valid' });
    if (password.length < 6) return res.status(400).json({ message: 'Password minimal 6 karakter' });

    const [exist] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (exist.length) return res.status(409).json({ message: 'Email sudah terdaftar' });

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'member')",
      [name.trim(), email.toLowerCase(), hash]
    );
    const user = { id: result.insertId, name: name.trim(), email: email.toLowerCase(), role: 'member' };
    res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: 'Email dan password wajib diisi' });

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Email atau password salah' });
    }
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', authRequired, async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, name, email, role FROM users WHERE id = ?', [req.user.id]);
    if (!rows.length) return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/users (admin) - daftar anggota + jumlah pinjaman aktif
router.get('/users', authRequired, adminOnly, async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.id, u.name, u.email, u.role, u.created_at,
             COUNT(CASE WHEN l.status = 'borrowed' THEN 1 END) AS active_loans
      FROM users u
      LEFT JOIN loans l ON l.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC`);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/users/:id/role (admin) - ubah peran pengguna
router.put('/users/:id/role', authRequired, adminOnly, async (req, res, next) => {
  try {
    const { role } = req.body || {};
    if (!['admin', 'member'].includes(role)) return res.status(400).json({ message: 'Role tidak valid' });
    if (Number(req.params.id) === req.user.id) {
      return res.status(400).json({ message: 'Tidak bisa mengubah role akun sendiri' });
    }
    await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
    res.json({ message: 'Role diperbarui' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
