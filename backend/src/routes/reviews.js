// FITUR 4 - Ulasan & Rating Buku
const express = require('express');
const { pool } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// GET /api/reviews/book/:bookId - semua ulasan untuk satu buku
router.get('/book/:bookId', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.id, r.rating, r.comment, r.created_at, r.user_id, u.name AS user_name
      FROM reviews r JOIN users u ON u.id = r.user_id
      WHERE r.book_id = ? ORDER BY r.created_at DESC`, [req.params.bookId]);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/reviews/my - ulasan milik pengguna login
router.get('/my', authRequired, async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.*, b.title FROM reviews r JOIN books b ON b.id = r.book_id
      WHERE r.user_id = ? ORDER BY r.created_at DESC`, [req.user.id]);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/reviews { book_id, rating, comment }
router.post('/', authRequired, async (req, res, next) => {
  try {
    const { book_id, rating, comment } = req.body || {};
    const value = Number(rating);
    if (!book_id || !Number.isInteger(value) || value < 1 || value > 5) {
      return res.status(400).json({ message: 'Rating harus angka 1 sampai 5' });
    }
    const [borrowed] = await pool.query(
      'SELECT COUNT(*) AS n FROM loans WHERE user_id = ? AND book_id = ?', [req.user.id, book_id]);
    if (borrowed[0].n === 0) {
      return res.status(403).json({ message: 'Anda harus meminjam buku ini sebelum memberi ulasan' });
    }
    // satu pengguna satu ulasan per buku; jika sudah ada maka diperbarui
    await pool.query(
      `INSERT INTO reviews (user_id, book_id, rating, comment) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), created_at = CURRENT_TIMESTAMP`,
      [req.user.id, book_id, value, (comment || '').trim() || null]
    );
    res.status(201).json({ message: 'Ulasan tersimpan' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/reviews/:id - pemilik ulasan atau admin
router.delete('/:id', authRequired, async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT user_id FROM reviews WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Ulasan tidak ditemukan' });
    if (rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Tidak boleh menghapus ulasan orang lain' });
    }
    await pool.query('DELETE FROM reviews WHERE id = ?', [req.params.id]);
    res.json({ message: 'Ulasan dihapus' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
