import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, tanggal } from '../api';

const STATUS = {
  ready: { label: 'Siap diambil', cls: 'green' },
  waiting: { label: 'Menunggu', cls: 'blue' },
  fulfilled: { label: 'Sudah dipinjam', cls: 'gray' },
  expired: { label: 'Kedaluwarsa', cls: 'red' },
  cancelled: { label: 'Dibatalkan', cls: 'gray' },
};

export default function Reservations({ user }) {
  const isAdmin = user.role === 'admin';
  const [scope, setScope] = useState('my');
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    try {
      setRows(await api(scope === 'all' ? `/reservations?status=${status}` : '/reservations/my'));
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  useEffect(() => { load(); }, [scope, status]);

  const cancel = async (r) => {
    if (!confirm(`Batalkan reservasi "${r.title}"?`)) return;
    try {
      const res = await api(`/reservations/${r.id}`, { method: 'DELETE' });
      setMsg({ type: 'success', text: res.message });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  // Meminjam buku yang ditahan untuk reservasi ini
  const borrow = async (r) => {
    try {
      const res = await api('/loans', { method: 'POST', body: { book_id: r.book_id } });
      setMsg({ type: 'success', text: res.message });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  const ready = rows.filter((r) => r.status === 'ready');
  const waiting = rows.filter((r) => r.status === 'waiting');

  return (
    <section>
      <div className="page-head">
        <div>
          <h2>Reservasi</h2>
          <p className="muted">Antre buku yang stoknya habis · buku ditahan 2 hari saat giliran Anda · maksimal 3 reservasi aktif</p>
        </div>
        {isAdmin && (
          <div className="seg">
            <button className={scope === 'my' ? 'active' : ''} onClick={() => setScope('my')}>Reservasi saya</button>
            <button className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>Semua anggota</button>
          </div>
        )}
      </div>

      <div className="stat-row">
        <div className="stat"><b>{ready.length}</b><span>Siap diambil</span></div>
        <div className="stat"><b>{waiting.length}</b><span>Masih menunggu</span></div>
        <div className="stat"><b>{rows.length}</b><span>Total reservasi</span></div>
      </div>

      {msg && <div className={`alert ${msg.type}`} onClick={() => setMsg(null)}>{msg.text}</div>}

      {scope === 'my' && ready.map((r) => (
        <div key={r.id} className="card ready-card">
          <div>
            <b>Giliran Anda!</b> "{r.title}" ditahan untuk Anda sampai <b>{tanggal(r.expires_at)}</b>.
          </div>
          <button className="btn primary sm" onClick={() => borrow(r)}>Pinjam sekarang</button>
        </div>
      ))}

      {scope === 'all' && (
        <div className="toolbar">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Semua status</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      )}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Buku</th>
              {scope === 'all' && <th>Anggota</th>}
              <th>Tgl reservasi</th>
              <th>Status</th>
              <th>Keterangan</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link to={`/books/${r.book_id}`}><b>{r.title}</b></Link><div className="muted">{r.author}</div></td>
                {scope === 'all' && <td>{r.user_name}<div className="muted">{r.user_email}</div></td>}
                <td>{tanggal(r.created_at)}</td>
                <td><span className={`badge ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span></td>
                <td>
                  {r.status === 'waiting' && <>Antrean ke-<b>{r.position}</b></>}
                  {r.status === 'ready' && <>Ambil sebelum {tanggal(r.expires_at)}</>}
                  {r.status === 'expired' && <>Tidak diambil sampai {tanggal(r.expires_at)}</>}
                </td>
                <td>
                  {['waiting', 'ready'].includes(r.status) && (
                    <button className="btn sm danger" onClick={() => cancel(r)}>Batalkan</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="empty-state">Belum ada reservasi. Buku yang stoknya habis bisa direservasi dari <Link to="/">katalog</Link>.</p>
        )}
      </div>
    </section>
  );
}
