// FITUR 5 - Dashboard Statistik & Laporan (Anggota 5)
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, rupiah, tanggal } from '../api';

function AdminDashboard() {
  const [s, setS] = useState(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

  const load = () => {
    Promise.all([api('/dashboard/stats'), api('/auth/users')])
      .then(([stats, u]) => { setS(stats); setUsers(u); })
      .catch((e) => setError(e.message));
  };
  useEffect(load, []);

  const changeRole = async (u) => {
    const role = u.role === 'admin' ? 'member' : 'admin';
    if (!confirm(`Ubah ${u.name} menjadi ${role}?`)) return;
    try { await api(`/auth/users/${u.id}/role`, { method: 'PUT', body: { role } }); load(); }
    catch (e) { alert(e.message); }
  };

  if (error) return <div className="alert error">{error}</div>;
  if (!s) return <p className="empty-state">Memuat statistik...</p>;

  const max = Math.max(1, ...s.daily_loans.map((d) => d.count));

  return (
    <>
      <div className="stat-row four">
        <div className="stat"><b>{s.books.titles}</b><span>Judul buku ({s.books.copies} eksemplar)</span></div>
        <div className="stat"><b>{s.members}</b><span>Anggota terdaftar</span></div>
        <div className="stat"><b>{s.loans.active}</b><span>Pinjaman aktif</span></div>
        <div className="stat warn"><b>{s.loans.overdue}</b><span>Terlambat</span></div>
        <div className="stat"><b>{s.loans.total}</b><span>Total transaksi</span></div>
        <div className="stat"><b>{rupiah(s.loans.fines_collected)}</b><span>Denda terkumpul</span></div>
        <div className="stat"><b>{s.reviews.total}</b><span>Ulasan</span></div>
        <div className="stat"><b>★ {s.reviews.average || '-'}</b><span>Rata-rata rating</span></div>
        <div className="stat"><b>{s.reservations.waiting}</b><span>Antrean reservasi</span></div>
        <div className="stat"><b>{s.reservations.ready}</b><span>Buku ditahan (siap diambil)</span></div>
      </div>

      <div className="card">
        <h3>Buku paling diantre</h3>
        <p className="muted">Kandidat penambahan stok.</p>
        {s.most_wanted.length === 0 ? <p className="muted">Tidak ada antrean saat ini.</p> : (
          <ol className="rank">
            {s.most_wanted.map((b) => (
              <li key={b.id}><Link to={`/books/${b.id}`}>{b.title}</Link><span>{b.queue} antre · stok {b.stock}</span></li>
            ))}
          </ol>
        )}
      </div>

      <div className="two-col">
        <div className="card">
          <h3>Peminjaman 7 hari terakhir</h3>
          <div className="chart">
            {s.daily_loans.map((d) => (
              <div key={d.date} className="chart-col">
                <span className="chart-val">{d.count}</span>
                <div className="chart-bar" style={{ height: `${(d.count / max) * 100}%` }} />
                <span className="chart-label">{new Date(d.date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short' })}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>Buku terpopuler</h3>
          {s.top_books.length === 0 && <p className="muted">Belum ada peminjaman.</p>}
          <ol className="rank">
            {s.top_books.map((b) => (
              <li key={b.id}><Link to={`/books/${b.id}`}>{b.title}</Link><span>{b.times_borrowed}× dipinjam</span></li>
            ))}
          </ol>
        </div>
      </div>

      <div className="card table-wrap">
        <h3>Daftar keterlambatan</h3>
        {s.overdue.length === 0 ? <p className="muted">Tidak ada keterlambatan 🎉</p> : (
          <table>
            <thead><tr><th>Anggota</th><th>Buku</th><th>Jatuh tempo</th><th>Estimasi denda</th></tr></thead>
            <tbody>
              {s.overdue.map((o) => (
                <tr key={o.id}><td>{o.user_name}<div className="muted">{o.email}</div></td><td>{o.title}</td><td>{tanggal(o.due_date)}</td><td>{rupiah(o.estimated_fine)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card table-wrap">
        <h3>Manajemen pengguna</h3>
        <table>
          <thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Pinjaman aktif</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td><td>{u.email}</td>
                <td><small className={`role ${u.role}`}>{u.role}</small></td>
                <td>{u.active_loans}</td>
                <td><button className="btn sm ghost" onClick={() => changeRole(u)}>Jadikan {u.role === 'admin' ? 'member' : 'admin'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function MemberDashboard({ user }) {
  const [s, setS] = useState(null);
  useEffect(() => { api('/dashboard/me').then(setS).catch(() => {}); }, []);
  if (!s) return <p className="empty-state">Memuat...</p>;
  return (
    <>
      <div className="card welcome">
        <h3>Halo, {user.name}! 👋</h3>
        <p className="muted">Berikut ringkasan aktivitas perpustakaan Anda.</p>
      </div>
      <div className="stat-row four">
        <div className="stat"><b>{s.loans.active}</b><span>Sedang dipinjam</span></div>
        <div className="stat warn"><b>{s.loans.overdue}</b><span>Terlambat</span></div>
        <div className="stat"><b>{s.loans.total}</b><span>Total pinjaman</span></div>
        <div className="stat"><b>{s.reviews}</b><span>Ulasan ditulis</span></div>
        <div className="stat"><b>{s.reservations.waiting}</b><span>Reservasi menunggu</span></div>
      </div>
      {s.reservations.ready.map((r) => (
        <div key={r.id} className="card ready-card">
          <div><b>Giliran Anda!</b> "{r.title}" ditahan sampai <b>{tanggal(r.expires_at)}</b>.</div>
          <Link to="/reservations" className="btn primary sm">Ambil sekarang</Link>
        </div>
      ))}
      <div className="two-col">
        <div className="card">
          <h3>Segera dikembalikan</h3>
          {s.due_soon.length === 0 ? <p className="muted">Tidak ada pinjaman aktif.</p> : (
            <ul className="rank">{s.due_soon.map((d) => <li key={d.id}>{d.title}<span>{tanggal(d.due_date)}</span></li>)}</ul>
          )}
          <Link to="/loans" className="btn sm">Lihat semua pinjaman</Link>
        </div>
        <div className="card">
          <h3>Rekomendasi (rating tertinggi)</h3>
          {s.recommended.length === 0 ? <p className="muted">Belum ada rekomendasi.</p> : (
            <ul className="rank">{s.recommended.map((b) => <li key={b.id}><Link to={`/books/${b.id}`}>{b.title}</Link><span>★ {b.avg_rating}</span></li>)}</ul>
          )}
        </div>
      </div>
    </>
  );
}

export default function Dashboard({ user }) {
  return (
    <section>
      <div className="page-head">
        <div>
          <h2>Dashboard</h2>
          <p className="muted">{user.role === 'admin' ? 'Laporan & statistik perpustakaan' : 'Aktivitas Anda'}</p>
        </div>
      </div>
      {user.role === 'admin' ? <AdminDashboard /> : <MemberDashboard user={user} />}
    </section>
  );
}
