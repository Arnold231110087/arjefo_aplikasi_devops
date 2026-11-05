const express = require('express');
const { pool } = require('../db');
const { authRequired, adminOnly } = require('../middleware/auth');
const { LOAN_DAYS, MAX_ACTIVE_LOANS, calculateFine, daysLate } = require('../utils/fine');
const { releaseCopy, expireReservations } = require('../utils/reservationQueue');

const router = express.Router();
router.use(authRequired);

const LOAN_SELECT = `
  SELECT l.*, b.title, b.author, b.cover_url, u.name AS user_name, u.email AS user_email
  FROM loans l
  JOIN books b ON b.id = l.book_id
  JOIN users u ON u.id = l.user_id`;

// Menambahkan informasi keterlambatan & estimasi denda untuk pinjaman aktif
function withStatus(loan) {
  if (loan.status === 'borrowed') {
    const late = daysLate(loan.due_date);
    return { ...loan, is_overdue: late > 0, days_late: late, estimated_fine: calculateFine(loan.due_date) };
  }
  return { ...loan, is_overdue: false, days_late: 0, estimated_fine: 0 };
}

// POST /api/loans  { book_id }  - pinjam buku 
router.post('/', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const bookId = Number(req.body?.book_id);
    if (!bookId) return res.status(400).json({ message: 'book_id wajib diisi' });

    await expireReservations(pool);
    await conn.beginTransaction();
    const [books] = await conn.query('SELECT id, title, available FROM books WHERE id = ? FOR UPDATE', [bookId]);
    if (!books.length) {
      await conn.rollback();
      return res.status(404).json({ message: 'Buku tidak ditemukan' });
    }
    // Jumlah yang ditahan untuk reservasi anggota ini
    const [held] = await conn.query(
      "SELECT id FROM reservations WHERE user_id = ? AND book_id = ? AND status = 'ready' FOR UPDATE",
      [req.user.id, bookId]);
    const fromReservation = held.length > 0;
    if (!fromReservation && books[0].available <= 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'Stok buku sedang habis, silakan reservasi untuk masuk antrean' });
    }

    const [active] = await conn.query(
      "SELECT book_id FROM loans WHERE user_id = ? AND status = 'borrowed'", [req.user.id]);
    if (active.some((l) => l.book_id === bookId)) {
      await conn.rollback();
      return res.status(400).json({ message: 'Anda sedang meminjam buku ini' });
    }
    if (active.length >= MAX_ACTIVE_LOANS) {
      await conn.rollback();
      return res.status(400).json({ message: `Maksimal ${MAX_ACTIVE_LOANS} buku dipinjam bersamaan` });
    }

    const [r] = await conn.query(
      `INSERT INTO loans (user_id, book_id, loan_date, due_date, status)
       VALUES (?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL ? DAY), 'borrowed')`,
      [req.user.id, bookId, LOAN_DAYS]
    );
    if (fromReservation) {
      await conn.query("UPDATE reservations SET status = 'fulfilled' WHERE id = ?", [held[0].id]);
    } else {
      await conn.query('UPDATE books SET available = available - 1 WHERE id = ?', [bookId]);
    }
    await conn.commit();
    res.status(201).json({
      id: r.insertId,
      message: `Berhasil meminjam "${books[0].title}". Kembalikan dalam ${LOAN_DAYS} hari.`,
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// GET /api/loans/my - riwayat pinjaman milik pengguna login
router.get('/my', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`${LOAN_SELECT} WHERE l.user_id = ? ORDER BY l.created_at DESC`, [req.user.id]);
    res.json(rows.map(withStatus));
  } catch (err) {
    next(err);
  }
});

// GET /api/loans?status=borrowed|returned|overdue (admin)
router.get('/', adminOnly, async (req, res, next) => {
  try {
    const { status } = req.query;
    let where = '';
    if (status === 'borrowed' || status === 'returned') where = `WHERE l.status = '${status}'`;
    if (status === 'overdue') where = "WHERE l.status = 'borrowed' AND l.due_date < CURDATE()";
    const [rows] = await pool.query(`${LOAN_SELECT} ${where} ORDER BY l.created_at DESC`);
    res.json(rows.map(withStatus));
  } catch (err) {
    next(err);
  }
});

// PUT /api/loans/:id/return - kembalikan buku & hitung denda
router.put('/:id/return', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM loans WHERE id = ? FOR UPDATE', [req.params.id]);
    const loan = rows[0];
    if (!loan) {
      await conn.rollback();
      return res.status(404).json({ message: 'Data pinjaman tidak ditemukan' });
    }
    if (loan.user_id !== req.user.id && req.user.role !== 'admin') {
      await conn.rollback();
      return res.status(403).json({ message: 'Bukan pinjaman Anda' });
    }
    if (loan.status !== 'borrowed') {
      await conn.rollback();
      return res.status(400).json({ message: 'Buku sudah dikembalikan' });
    }

    const fine = calculateFine(loan.due_date);
    await conn.query(
      "UPDATE loans SET status = 'returned', return_date = CURDATE(), fine = ? WHERE id = ?",
      [fine, loan.id]
    );
    // jika ada antrean reservasi langsung ditahan untuk antrean terdepan
    const promoted = await releaseCopy(conn, loan.book_id);
    await conn.commit();
    let message = fine > 0 ? `Buku dikembalikan. Denda: Rp${fine.toLocaleString('id-ID')}` : 'Buku dikembalikan tepat waktu';
    if (promoted) message += '. Buku langsung ditahan untuk anggota antrean berikutnya.';
    res.json({ message, fine, reserved_for_next: Boolean(promoted) });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

module.exports = router;
