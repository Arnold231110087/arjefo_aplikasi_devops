// FITUR 5 - Dashboard & Laporan Statistik (Anggota 5)
// Menggabungkan data dari semua fitur: users, books, loans, reviews.
const express = require('express');
const { pool } = require('../db');
const { authRequired, adminOnly } = require('../middleware/auth');
const { calculateFine } = require('../utils/fine');

const router = express.Router();
router.use(authRequired);

// GET /api/dashboard/stats (admin)
router.get('/stats', adminOnly, async (req, res, next) => {
  try {
    const [[books]] = await pool.query(
      'SELECT COUNT(*) AS titles, COALESCE(SUM(stock),0) AS copies, COALESCE(SUM(available),0) AS available FROM books');
    const [[members]] = await pool.query("SELECT COUNT(*) AS n FROM users WHERE role = 'member'");
    const [[loans]] = await pool.query(`
      SELECT COUNT(CASE WHEN status='borrowed' THEN 1 END) AS active,
             COUNT(CASE WHEN status='borrowed' AND due_date < CURDATE() THEN 1 END) AS overdue,
             COUNT(*) AS total,
             COALESCE(SUM(fine),0) AS fines_collected
      FROM loans`);
    const [[reviews]] = await pool.query('SELECT COUNT(*) AS n, ROUND(AVG(rating),1) AS avg FROM reviews');
    const [[reservations]] = await pool.query(`
      SELECT COUNT(CASE WHEN status='waiting' THEN 1 END) AS waiting,
             COUNT(CASE WHEN status='ready' THEN 1 END) AS ready,
             COUNT(CASE WHEN status='fulfilled' THEN 1 END) AS fulfilled
      FROM reservations`);
    // Buku dengan antrean terpanjang = kandidat penambahan stok
    const [mostWanted] = await pool.query(`
      SELECT b.id, b.title, b.stock, COUNT(q.id) AS queue
      FROM reservations q JOIN books b ON b.id = q.book_id
      WHERE q.status = 'waiting'
      GROUP BY b.id ORDER BY queue DESC, b.title LIMIT 5`);

    const [topBooks] = await pool.query(`
      SELECT b.id, b.title, b.author, COUNT(l.id) AS times_borrowed
      FROM books b JOIN loans l ON l.book_id = b.id
      GROUP BY b.id ORDER BY times_borrowed DESC, b.title LIMIT 5`);

    const [daily] = await pool.query(`
      SELECT loan_date AS date, COUNT(*) AS count FROM loans
      WHERE loan_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
      GROUP BY loan_date ORDER BY loan_date`);

    const [overdueRows] = await pool.query(`
      SELECT l.id, l.due_date, b.title, u.name AS user_name, u.email
      FROM loans l JOIN books b ON b.id = l.book_id JOIN users u ON u.id = l.user_id
      WHERE l.status = 'borrowed' AND l.due_date < CURDATE() ORDER BY l.due_date`);

    // lengkapi 7 hari terakhir supaya grafik tidak bolong
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const found = daily.find((r) => String(r.date).slice(0, 10) === key);
      last7.push({ date: key, count: found ? Number(found.count) : 0 });
    }

    res.json({
      books: { titles: books.titles, copies: Number(books.copies), available: Number(books.available) },
      members: members.n,
      loans: { active: loans.active, overdue: loans.overdue, total: loans.total, fines_collected: Number(loans.fines_collected) },
      reviews: { total: reviews.n, average: reviews.avg },
      reservations,
      most_wanted: mostWanted,
      top_books: topBooks,
      daily_loans: last7,
      overdue: overdueRows.map((o) => ({ ...o, estimated_fine: calculateFine(o.due_date) })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/me - ringkasan untuk anggota
router.get('/me', async (req, res, next) => {
  try {
    const [[loans]] = await pool.query(`
      SELECT COUNT(CASE WHEN status='borrowed' THEN 1 END) AS active,
             COUNT(CASE WHEN status='borrowed' AND due_date < CURDATE() THEN 1 END) AS overdue,
             COUNT(*) AS total, COALESCE(SUM(fine),0) AS fines_paid
      FROM loans WHERE user_id = ?`, [req.user.id]);
    const [[reviews]] = await pool.query('SELECT COUNT(*) AS n FROM reviews WHERE user_id = ?', [req.user.id]);
    const [dueSoon] = await pool.query(`
      SELECT l.id, l.due_date, b.title FROM loans l JOIN books b ON b.id = l.book_id
      WHERE l.user_id = ? AND l.status = 'borrowed' ORDER BY l.due_date LIMIT 5`, [req.user.id]);
    const [readyRes] = await pool.query(`
      SELECT r.id, r.book_id, r.expires_at, b.title FROM reservations r JOIN books b ON b.id = r.book_id
      WHERE r.user_id = ? AND r.status = 'ready' ORDER BY r.expires_at`, [req.user.id]);
    const [[waitingRes]] = await pool.query(
      "SELECT COUNT(*) AS n FROM reservations WHERE user_id = ? AND status = 'waiting'", [req.user.id]);
    const [recommended] = await pool.query(`
      SELECT b.id, b.title, b.author, ROUND(AVG(r.rating),1) AS avg_rating
      FROM books b JOIN reviews r ON r.book_id = b.id
      WHERE b.available > 0
      GROUP BY b.id ORDER BY avg_rating DESC, COUNT(r.id) DESC LIMIT 3`);

    res.json({
      loans: { active: loans.active, overdue: loans.overdue, total: loans.total, fines_paid: Number(loans.fines_paid) },
      reviews: reviews.n,
      due_soon: dueSoon,
      reservations: { ready: readyRes, waiting: waitingRes.n },
      recommended,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
