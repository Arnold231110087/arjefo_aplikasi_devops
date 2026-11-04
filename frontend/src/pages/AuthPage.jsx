// FITUR 1 - Halaman Login & Registrasi
import { useState } from 'react';
import { api, setSession } from '../api';

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api(`/auth/${mode}`, { method: 'POST', body: form });
      setSession(data.token, data.user);
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={submit}>
        <div className="auth-logo">📚</div>
        <h1>PustakaKu</h1>
        <p className="muted">{mode === 'login' ? 'Masuk untuk meminjam buku' : 'Daftar sebagai anggota perpustakaan'}</p>

        {mode === 'register' && (
          <label>Nama lengkap
            <input value={form.name} onChange={update('name')} required />
          </label>
        )}
        <label>Email
          <input type="email" value={form.email} onChange={update('email')} required />
        </label>
        <label>Password
          <input type="password" minLength={6} value={form.password} onChange={update('password')} required />
        </label>

        {error && <div className="alert error">{error}</div>}

        <button className="btn primary block" disabled={loading}>
          {loading ? 'Memproses...' : mode === 'login' ? 'Masuk' : 'Daftar'}
        </button>

        <p className="switch">
          {mode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}{' '}
          <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
            {mode === 'login' ? 'Daftar di sini' : 'Masuk'}
          </button>
        </p>
        {mode === 'login' && <p className="hint">Demo admin: admin@pustakaku.id / admin123</p>}
      </form>
    </div>
  );
}
