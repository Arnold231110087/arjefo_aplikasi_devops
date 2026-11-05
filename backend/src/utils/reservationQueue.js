const HOLD_DAYS = 2;
const MAX_ACTIVE_RESERVATIONS = 3;

function addDays(date, days) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Batas pengambilan buku yang ditahan
function holdUntil(fromDate = new Date()) {
  return toISODate(addDays(fromDate, HOLD_DAYS));
}

function queuePosition(waitingIdsInOrder, reservationId) {
  const idx = waitingIdsInOrder.indexOf(reservationId);
  return idx === -1 ? null : idx + 1;
}

async function releaseCopy(conn, bookId) {
  const [next] = await conn.query(
    `SELECT id, user_id FROM reservations
     WHERE book_id = ? AND status = 'waiting'
     ORDER BY created_at, id LIMIT 1 FOR UPDATE`,
    [bookId]
  );
  if (next.length) {
    await conn.query(
      "UPDATE reservations SET status = 'ready', ready_at = CURDATE(), expires_at = ? WHERE id = ?",
      [holdUntil(), next[0].id]
    );
    return next[0];
  }
  await conn.query('UPDATE books SET available = available + 1 WHERE id = ?', [bookId]);
  return null;
}

// Jika stok tersedia > 0 tetapi masih ada antrean
async function fillQueue(conn, bookId) {
  const [[book]] = await conn.query('SELECT available FROM books WHERE id = ? FOR UPDATE', [bookId]);
  if (!book) return 0;
  let given = 0;
  for (let i = 0; i < book.available; i++) {
    const [next] = await conn.query(
      `SELECT id FROM reservations WHERE book_id = ? AND status = 'waiting'
       ORDER BY created_at, id LIMIT 1 FOR UPDATE`,
      [bookId]
    );
    if (!next.length) break;
    await conn.query(
      "UPDATE reservations SET status = 'ready', ready_at = CURDATE(), expires_at = ? WHERE id = ?",
      [holdUntil(), next[0].id]
    );
    await conn.query('UPDATE books SET available = available - 1 WHERE id = ?', [bookId]);
    given++;
  }
  return given;
}

async function expireReservations(pool) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      "SELECT id, book_id FROM reservations WHERE status = 'ready' AND expires_at < CURDATE() FOR UPDATE"
    );
    for (const r of rows) {
      await conn.query("UPDATE reservations SET status = 'expired' WHERE id = ?", [r.id]);
      await releaseCopy(conn, r.book_id);
    }
    await conn.commit();
    return rows.length;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  HOLD_DAYS,
  MAX_ACTIVE_RESERVATIONS,
  holdUntil,
  queuePosition,
  releaseCopy,
  fillQueue,
  expireReservations,
};
