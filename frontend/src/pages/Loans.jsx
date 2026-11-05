import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, rupiah, tanggal } from '../api';

export default function Loans({ user }) {
  const isAdmin = user.role === 'admin';
  const [scope, setScope] = useState(isAdmin ? 'all' : 'my');
  const [status, setStatus] = useState('');
  const [loans, setLoans] = useState([]);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    try {
      const path = scope === 'all' ? `/loans?status=${status}` : '/loans/my';
      setLoans(await api(path));
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  useEffect(() => { load(); }, [scope, status]);

  const giveBack = async (loan) => {
    if (!confirm(`Kembalikan "${loan.title}"?`)) return;
    try {
      const r = await api(`/loans/${loan.id}/return`, { method: 'PUT' });
      setMsg({ type: r.fine > 0 ? 'warning' : 'success', text: r.message });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  };

  const active = loans.filter((l) => l.status === 'borrowed');
  const estFine = active.reduce((s, l) => s + l.estimated_fine, 0);

  const badge = (l) => {
    if (l.status === 'returned') return <span className="badge green">Dikembalikan</span>;
    if (l.is_overdue) return <span className="badge red">Terlambat {l.days_late} hari</span>;
    return <span className="badge blue">Dipinjam</span>;
  };

  return (
    <section>
      <div className="page-head">
        <div>
          <h2>Peminjaman</h2>
          <p className="muted">Masa pinjam 7 hari · denda Rp1.000/hari · maksimal 3 buku aktif</p>
        </div>
        {isAdmin && (
          <div className="seg">
            <button className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>Semua anggota</button>
            <button className={scope === 'my' ? 'active' : ''} onClick={() => setScope('my')}>Pinjaman saya</button>
          </div>
        )}
      </div>

      <div className="stat-row">
        <div className="stat"><b>{active.length}</b><span>Sedang dipinjam</span></div>
        <div className="stat"><b>{active.filter((l) => l.is_overdue).length}</b><span>Terlambat</span></div>
        <div className="stat"><b>{rupiah(estFine)}</b><span>Estimasi denda berjalan</span></div>
      </div>

      {scope === 'all' && (
        <div className="toolbar">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Semua status</option>
            <option value="borrowed">Dipinjam</option>
            <option value="overdue">Terlambat</option>
            <option value="returned">Dikembalikan</option>
          </select>
        </div>
      )}

      {msg && <div className={`alert ${msg.type}`} onClick={() => setMsg(null)}>{msg.text}</div>}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Buku</th>
              {scope === 'all' && <th>Peminjam</th>}
              <th>Tgl Pinjam</th>
              <th>Jatuh Tempo</th>
              <th>Status</th>
              <th>Denda</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loans.map((l) => (
              <tr key={l.id}>
                <td><Link to={`/books/${l.book_id}`}><b>{l.title}</b></Link><div className="muted">{l.author}</div></td>
                {scope === 'all' && <td>{l.user_name}<div className="muted">{l.user_email}</div></td>}
                <td>{tanggal(l.loan_date)}</td>
                <td>{tanggal(l.due_date)}</td>
                <td>{badge(l)}</td>
                <td>{l.status === 'returned' ? rupiah(l.fine) : l.estimated_fine ? `~${rupiah(l.estimated_fine)}` : '-'}</td>
                <td>
                  {l.status === 'borrowed' && <button className="btn sm" onClick={() => giveBack(l)}>Kembalikan</button>}
                  {l.status === 'returned' && <Link className="btn sm ghost" to={`/books/${l.book_id}`}>Beri ulasan</Link>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loans.length === 0 && <p className="empty-state">Belum ada data peminjaman.</p>}
      </div>
    </section>
  );
}
