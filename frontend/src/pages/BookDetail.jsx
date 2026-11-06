// FITUR 4 - Detail Buku, Ulasan & Rating
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, tanggal } from '../api';

function Stars({ value, onChange }) {
  return (
    <div className="stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <button type="button" key={n} className={n <= value ? 'on' : ''} onClick={() => onChange && onChange(n)}>★</button>
      ))}
    </div>
  );
}

export default function BookDetail({ user }) {
  const { id } = useParams();
  const [book, setBook] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [msg, setMsg] = useState(null);
  const [queue, setQueue] = useState(null);

  const load = async () => {
    try {
      const [b, r, q] = await Promise.all([
        api(`/books/${id}`), api(`/reviews/book/${id}`), api(`/reservations/book/${id}`),
      ]);
      setBook(b);
      setReviews(r);
      setQueue(q);
      const mine = r.find((x) => x.user_id === user.id);
      if (mine) { setRating(mine.rating); setComment(mine.comment || ''); }
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [id]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api('/reviews', { method: 'POST', body: { book_id: Number(id), rating, comment } });
      setMsg({ type: 'success', text: 'Terima kasih atas ulasannya!' });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  const remove = async (r) => {
    if (!confirm('Hapus ulasan ini?')) return;
    await api(`/reviews/${r.id}`, { method: 'DELETE' });
    load();
  };

  const borrow = async () => {
    try {
      const r = await api('/loans', { method: 'POST', body: { book_id: Number(id) } });
      setMsg({ type: 'success', text: r.message });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  // Terhubung ke Fitur Reservasi
  const reserve = async () => {
    try {
      const r = await api('/reservations', { method: 'POST', body: { book_id: Number(id) } });
      setMsg({ type: 'success', text: r.message });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  const myRes = queue?.my_reservation;

  if (!book) return <p className="empty-state">{msg ? msg.text : 'Memuat...'}</p>;

  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, count: reviews.filter((r) => r.rating === n).length }));

  return (
    <section>
      <Link to="/" className="back">← Kembali ke katalog</Link>
      <div className="detail card">
        <div className="cover big">{book.cover_url ? <img src={book.cover_url} alt={book.title} /> : <span>{book.title.slice(0, 1)}</span>}</div>
        <div className="detail-body">
          {book.category_name && <span className="tag">{book.category_name}</span>}
          <h2>{book.title}</h2>
          <p className="muted">{book.author}{book.year ? ` · ${book.year}` : ''}{book.isbn ? ` · ISBN ${book.isbn}` : ''}</p>
          <p>{book.description}</p>
          <div className="rating big">★ {book.avg_rating || '-'} <span className="muted">dari {book.review_count} ulasan</span></div>
          <div className={`stock ${book.available > 0 ? 'ok' : 'empty'}`}>Tersedia {book.available}/{book.stock}</div>
          {queue && queue.queue_length > 0 && (
            <p className="muted">{queue.queue_length} anggota sedang mengantre buku ini.</p>
          )}
          {myRes?.status === 'ready' && (
            <div className="alert success">Giliran Anda! Buku ditahan sampai {tanggal(myRes.expires_at)}.</div>
          )}
          {myRes?.status === 'waiting' && (
            <div className="alert warning">Anda di antrean ke-{myRes.position}. <Link to="/reservations">Lihat reservasi</Link></div>
          )}
          {book.available > 0 || myRes?.status === 'ready'
            ? <button className="btn primary" onClick={borrow}>Pinjam buku ini</button>
            : !myRes && <button className="btn accent" onClick={reserve}>Reservasi (masuk antrean)</button>}
        </div>
      </div>

      {msg && <div className={`alert ${msg.type}`} onClick={() => setMsg(null)}>{msg.text}</div>}

      <div className="two-col">
        <form className="card" onSubmit={submit}>
          <h3>Tulis ulasan</h3>
          <p className="muted">Hanya anggota yang pernah meminjam buku ini yang bisa memberi ulasan.</p>
          <Stars value={rating} onChange={setRating} />
          <textarea rows="4" placeholder="Bagaimana pendapat Anda tentang buku ini?" value={comment} onChange={(e) => setComment(e.target.value)} />
          <button className="btn primary">Kirim ulasan</button>
          <div className="dist">
            {dist.map((d) => (
              <div key={d.n} className="dist-row">
                <span>{d.n}★</span>
                <div className="bar"><i style={{ width: reviews.length ? `${(d.count / reviews.length) * 100}%` : 0 }} /></div>
                <span>{d.count}</span>
              </div>
            ))}
          </div>
        </form>

        <div className="card">
          <h3>Ulasan pembaca ({reviews.length})</h3>
          {reviews.length === 0 && <p className="muted">Belum ada ulasan.</p>}
          {reviews.map((r) => (
            <div key={r.id} className="review">
              <div className="review-head">
                <b>{r.user_name}</b>
                <span className="stars-static">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
              </div>
              {r.comment && <p>{r.comment}</p>}
              <div className="muted small">
                {tanggal(r.created_at)}
                {(r.user_id === user.id || user.role === 'admin') && (
                  <button className="link danger" onClick={() => remove(r)}>hapus</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
