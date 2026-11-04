import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

const EMPTY = { title: '', author: '', isbn: '', category_id: '', year: '', stock: 1, description: '', cover_url: '' };

export default function Books({ user }) {
  const isAdmin = user.role === 'admin';
  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    try {
      setBooks(await api(`/books?q=${encodeURIComponent(q)}&category=${category}`));
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  useEffect(() => { api('/books/categories').then(setCategories).catch(() => {}); }, []);
  useEffect(() => { load(); }, [category]);

  // Fitur pinjam
  const borrow = async (book) => {
    try {
      const r = await api('/loans', { method: 'POST', body: { book_id: book.id } });
      setMsg({ type: 'success', text: r.message });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  // Fitur Reservasi
  const reserve = async (book) => {
    try {
      const r = await api('/reservations', { method: 'POST', body: { book_id: book.id } });
      setMsg({ type: 'success', text: r.message });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  const openForm = (book) => {
    setEditingId(book ? book.id : null);
    setForm(book ? { ...EMPTY, ...book, category_id: book.category_id || '', year: book.year || '' } : EMPTY);
    setShowForm(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      const body = { ...form, stock: Number(form.stock), year: form.year ? Number(form.year) : null };
      if (editingId) await api(`/books/${editingId}`, { method: 'PUT', body });
      else await api('/books', { method: 'POST', body });
      setMsg({ type: 'success', text: editingId ? 'Buku diperbarui' : 'Buku ditambahkan' });
      setShowForm(false);
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  const remove = async (book) => {
    if (!confirm(`Hapus buku "${book.title}"?`)) return;
    try {
      await api(`/books/${book.id}`, { method: 'DELETE' });
      setMsg({ type: 'success', text: 'Buku dihapus' });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  const f = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <section>
      <div className="page-head">
        <div>
          <h2>Katalog Buku</h2>
          <p className="muted">{books.length} judul ditemukan</p>
        </div>
        {isAdmin && <button className="btn primary" onClick={() => openForm(null)}>+ Tambah Buku</button>}
      </div>

      <form className="toolbar" onSubmit={(e) => { e.preventDefault(); load(); }}>
        <input placeholder="Cari judul, penulis, atau ISBN..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Semua kategori</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.book_count})</option>)}
        </select>
        <button className="btn">Cari</button>
      </form>

      {msg && <div className={`alert ${msg.type}`} onClick={() => setMsg(null)}>{msg.text}</div>}

      {showForm && (
        <form className="card form-grid" onSubmit={save}>
          <h3>{editingId ? 'Edit Buku' : 'Tambah Buku'}</h3>
          <label>Judul<input value={form.title} onChange={f('title')} required /></label>
          <label>Penulis<input value={form.author} onChange={f('author')} required /></label>
          <label>ISBN<input value={form.isbn || ''} onChange={f('isbn')} /></label>
          <label>Kategori
            <select value={form.category_id} onChange={f('category_id')}>
              <option value="">-</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>Tahun<input type="number" value={form.year} onChange={f('year')} /></label>
          <label>Stok<input type="number" min="0" value={form.stock} onChange={f('stock')} required /></label>
          <label className="full">URL Sampul<input value={form.cover_url || ''} onChange={f('cover_url')} /></label>
          <label className="full">Deskripsi<textarea rows="3" value={form.description || ''} onChange={f('description')} /></label>
          <div className="full actions">
            <button type="button" className="btn ghost" onClick={() => setShowForm(false)}>Batal</button>
            <button className="btn primary">Simpan</button>
          </div>
        </form>
      )}

      <div className="book-grid">
        {books.map((b) => (
          <article key={b.id} className="card book">
            <Link to={`/books/${b.id}`} className="cover">
              {b.cover_url ? <img src={b.cover_url} alt={b.title} /> : <span>{b.title.slice(0, 1)}</span>}
            </Link>
            <div className="book-body">
              {b.category_name && <span className="tag">{b.category_name}</span>}
              <Link to={`/books/${b.id}`} className="book-title">{b.title}</Link>
              <div className="muted">{b.author}{b.year ? ` · ${b.year}` : ''}</div>
              <div className="rating">★ {b.avg_rating || '-'} <span className="muted">({b.review_count} ulasan)</span></div>
              <div className={`stock ${b.available > 0 ? 'ok' : 'empty'}`}>
                Tersedia {b.available}/{b.stock}
                {b.queue_count > 0 && <span className="queue-pill">{b.queue_count} antre</span>}
              </div>
              <div className="book-actions">
                {b.available > 0
                  ? <button className="btn primary sm" onClick={() => borrow(b)}>Pinjam</button>
                  : <button className="btn accent sm" onClick={() => reserve(b)}>Reservasi</button>}
                {isAdmin && (
                  <>
                    <button className="btn sm" onClick={() => openForm(b)}>Edit</button>
                    <button className="btn danger sm" onClick={() => remove(b)}>Hapus</button>
                  </>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {books.length === 0 && <p className="empty-state">Tidak ada buku yang cocok.</p>}
    </section>
  );
}
