const express = require('express');
const { pool } = require('../db');
const { authRequired, adminOnly } = require('../middleware/auth');
const { fillQueue } = require('../utils/reservationQueue');

const router = express.Router();

const BOOK_SELECT = `
  SELECT b.*, c.name AS category_name,
         ROUND(AVG(r.rating), 1) AS avg_rating,
         COUNT(r.id) AS review_count,
         (SELECT COUNT(*) FROM reservations q WHERE q.book_id = b.id AND q.status = 'waiting') AS queue_count
  FROM books b
  LEFT JOIN categories c ON c.id = b.category_id
  LEFT JOIN reviews r ON r.book_id = b.id`;

// GET /api/books?q=&category=
router.get('/', async (req, res, next) => {
  try {
    const { q = '', category = '' } = req.query;
    const where = [];
    const params = [];
    if (q) {
      where.push('(b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (category) {
      where.push('b.category_id = ?');
      params.push(category);
    }
    const sql = `${BOOK_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 GROUP BY b.id ORDER BY b.title`;
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/books/categories
router.get('/categories', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.id, c.name, COUNT(b.id) AS book_count
      FROM categories c LEFT JOIN books b ON b.category_id = c.id
      GROUP BY c.id ORDER BY c.name`);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/books/categories (admin)
router.post('/categories', authRequired, adminOnly, async (req, res, next) => {
  try {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ message: 'Nama kategori wajib diisi' });
    const [r] = await pool.query('INSERT INTO categories (name) VALUES (?)', [name.trim()]);
    res.status(201).json({ id: r.insertId, name: name.trim() });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Kategori sudah ada' });
    next(err);
  }
});

// GET /api/books/:id
router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`${BOOK_SELECT} WHERE b.id = ? GROUP BY b.id`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Buku tidak ditemukan' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

function validateBook(body) {
  const { title, author, stock } = body || {};
  if (!title || !author) return 'Judul dan penulis wajib diisi';
  if (stock === undefined || Number(stock) < 0 || !Number.isInteger(Number(stock))) {
    return 'Stok harus bilangan bulat >= 0';
  }
  return null;
}

// POST /api/books (admin)
router.post('/', authRequired, adminOnly, async (req, res, next) => {
  try {
    const error = validateBook(req.body);
    if (error) return res.status(400).json({ message: error });
    const { title, author, isbn, category_id, year, stock, description, cover_url } = req.body;
    const [r] = await pool.query(
      `INSERT INTO books (title, author, isbn, category_id, year, stock, available, description, cover_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, author, isbn || null, category_id || null, year || null,
        Number(stock), Number(stock), description || null, cover_url || null]
    );
    res.status(201).json({ id: r.insertId, message: 'Buku ditambahkan' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'ISBN sudah terdaftar' });
    next(err);
  }
});

// PUT /api/books/:id (admin) - stok tersedia menyesuaikan jumlah buku yang sedang dipinjam
router.put('/:id', authRequired, adminOnly, async (req, res, next) => {
  try {
    const error = validateBook(req.body);
    if (error) return res.status(400).json({ message: error });
    const [rows] = await pool.query('SELECT stock, available FROM books WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Buku tidak ditemukan' });

    //  dipinjam + yang ditahan untuk reservasi
    const borrowed = rows[0].stock - rows[0].available;
    const newStock = Number(req.body.stock);
    if (newStock < borrowed) {
      return res.status(400).json({ message: `Stok tidak boleh kurang dari ${borrowed} (sedang dipinjam/ditahan)` });
    }
    const { title, author, isbn, category_id, year, description, cover_url } = req.body;
    await pool.query(
      `UPDATE books SET title=?, author=?, isbn=?, category_id=?, year=?, stock=?, available=?,
       description=?, cover_url=? WHERE id=?`,
      [title, author, isbn || null, category_id || null, year || null, newStock,
        newStock - borrowed, description || null, cover_url || null, req.params.id]
    );
     
    const conn = await pool.getConnection();
    let given = 0;
    try {
      await conn.beginTransaction();
      given = await fillQueue(conn, req.params.id);
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
    res.json({ message: given ? `Buku diperbarui, ${given} eksemplar diberikan ke antrean reservasi` : 'Buku diperbarui' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'ISBN sudah terdaftar' });
    next(err);
  }
});

// DELETE /api/books/:id (admin)
router.delete('/:id', authRequired, adminOnly, async (req, res, next) => {
  try {
    const [active] = await pool.query(
      "SELECT COUNT(*) AS n FROM loans WHERE book_id = ? AND status = 'borrowed'", [req.params.id]);
    if (active[0].n > 0) {
      return res.status(400).json({ message: 'Buku masih dipinjam, tidak bisa dihapus' });
    }
    const [r] = await pool.query('DELETE FROM books WHERE id = ?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ message: 'Buku tidak ditemukan' });
    res.json({ message: 'Buku dihapus' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
