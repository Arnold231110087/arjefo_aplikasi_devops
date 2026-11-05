const express = require('express');
const { pool } = require('../db');
const { authRequired, adminOnly } = require('../middleware/auth');
const {
  MAX_ACTIVE_RESERVATIONS, HOLD_DAYS, queuePosition, releaseCopy, expireReservations,
} = require('../utils/reservationQueue');

const router = express.Router();
router.use(authRequired);

// Bersihkan reservasi kedaluwarsa sebelum setiap request
router.use(async (req, res, next) => {
  try {
    await expireReservations(pool);
    next();
  } catch (err) {
    next(err);
  }
});

const RES_SELECT = `
  SELECT r.*, b.title, b.author, b.cover_url, b.available, u.name AS user_name, u.email AS user_email
  FROM reservations r
  JOIN books b ON b.id = r.book_id
  JOIN users u ON u.id = r.user_id`;

// Tambahkan posisi antrean untuk reservasi yang masih menunggu
async function withPositions(rows) {
  const bookIds = [...new Set(rows.filter((r) => r.status === 'waiting').map((r) => r.book_id))];
  if (!bookIds.length) return rows.map((r) => ({ ...r, position: null }));
  const [waiting] = await pool.query(
    `SELECT id, book_id FROM reservations WHERE status = 'waiting' AND book_id IN (?)
     ORDER BY created_at, id`, [bookIds]);
  const byBook = {};
  for (const w of waiting) (byBook[w.book_id] ||= []).push(w.id);
  return rows.map((r) => ({
    ...r,
    position: r.status === 'waiting' ? queuePosition(byBook[r.book_id] || [], r.id) : null,
  }));
}

// POST /api/reservations { book_id } 
router.post('/', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const bookId = Number(req.body?.book_id);
    if (!bookId) return res.status(400).json({ message: 'book_id wajib diisi' });

    await conn.beginTransaction();
    const [[book]] = await conn.query('SELECT id, title, available FROM books WHERE id = ? FOR UPDATE', [bookId]);
    if (!book) {
      await conn.rollback();
      return res.status(404).json({ message: 'Buku tidak ditemukan' });
    }
    if (book.available > 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'Buku masih tersedia, silakan langsung pinjam' });
    }
    const [[borrowing]] = await conn.query(
      "SELECT COUNT(*) AS n FROM loans WHERE user_id = ? AND book_id = ? AND status = 'borrowed'",
      [req.user.id, bookId]);
    if (borrowing.n > 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'Anda sedang meminjam buku ini' });
    }
    const [active] = await conn.query(
      "SELECT book_id FROM reservations WHERE user_id = ? AND status IN ('waiting','ready')",
      [req.user.id]);
    if (active.some((r) => r.book_id === bookId)) {
      await conn.rollback();
      return res.status(400).json({ message: 'Anda sudah ada di antrean buku ini' });
    }
    if (active.length >= MAX_ACTIVE_RESERVATIONS) {
      await conn.rollback();
      return res.status(400).json({ message: `Maksimal ${MAX_ACTIVE_RESERVATIONS} reservasi aktif` });
    }

    const [r] = await conn.query(
      "INSERT INTO reservations (user_id, book_id, status) VALUES (?, ?, 'waiting')",
      [req.user.id, bookId]);
    const [[pos]] = await conn.query(
      "SELECT COUNT(*) AS n FROM reservations WHERE book_id = ? AND status = 'waiting' AND id <= ?",
      [bookId, r.insertId]);
    await conn.commit();
    res.status(201).json({
      id: r.insertId,
      position: pos.n,
      message: `Anda masuk antrean "${book.title}" di posisi ${pos.n}. Buku akan ditahan ${HOLD_DAYS} hari saat giliran Anda.`,
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// GET /api/reservations/my
router.get('/my', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `${RES_SELECT} WHERE r.user_id = ?
       ORDER BY FIELD(r.status,'ready','waiting','fulfilled','expired','cancelled'), r.created_at DESC`,
      [req.user.id]);
    res.json(await withPositions(rows));
  } catch (err) {
    next(err);
  }
});

// GET /api/reservations/book/:bookId - info antrean satu buku
router.get('/book/:bookId', async (req, res, next) => {
  try {
    const [waiting] = await pool.query(
      `SELECT id, user_id FROM reservations WHERE book_id = ? AND status = 'waiting'
       ORDER BY created_at, id`, [req.params.bookId]);
    const [mine] = await pool.query(
      `SELECT id, status, expires_at FROM reservations
       WHERE book_id = ? AND user_id = ? AND status IN ('waiting','ready')`,
      [req.params.bookId, req.user.id]);
    const my = mine[0] || null;
    res.json({
      queue_length: waiting.length,
      my_reservation: my && {
        ...my,
        position: my.status === 'waiting' ? queuePosition(waiting.map((w) => w.id), my.id) : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reservations?status= (admin)
router.get('/', adminOnly, async (req, res, next) => {
  try {
    const allowed = ['waiting', 'ready', 'fulfilled', 'cancelled', 'expired'];
    const { status } = req.query;
    const where = allowed.includes(status) ? 'WHERE r.status = ?' : '';
    const [rows] = await pool.query(
      `${RES_SELECT} ${where} ORDER BY r.created_at DESC`, where ? [status] : []);
    res.json(await withPositions(rows));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/reservations/:id
router.delete('/:id', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[r]] = await conn.query('SELECT * FROM reservations WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!r) {
      await conn.rollback();
      return res.status(404).json({ message: 'Reservasi tidak ditemukan' });
    }
    if (r.user_id !== req.user.id && req.user.role !== 'admin') {
      await conn.rollback();
      return res.status(403).json({ message: 'Bukan reservasi Anda' });
    }
    if (!['waiting', 'ready'].includes(r.status)) {
      await conn.rollback();
      return res.status(400).json({ message: 'Reservasi sudah tidak aktif' });
    }
    await conn.query("UPDATE reservations SET status = 'cancelled' WHERE id = ?", [r.id]);
    // Jika buku sedang ditahan untuk reservasi ini, berikan ke antrean berikutnya
    if (r.status === 'ready') await releaseCopy(conn, r.book_id);
    await conn.commit();
    res.json({ message: 'Reservasi dibatalkan' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

module.exports = router;
