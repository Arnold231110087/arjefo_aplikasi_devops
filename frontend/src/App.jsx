import { useState } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { clearSession, getUser } from './api';
import AuthPage from './pages/AuthPage.jsx'; 
import Books from './pages/Books.jsx';       
import Loans from './pages/Loans.jsx';       
import Reservations from './pages/Reservations.jsx';
import BookDetail from './pages/BookDetail.jsx';
import Dashboard from './pages/Dashboard.jsx';

export default function App() {
  const [user, setUser] = useState(getUser());
  const navigate = useNavigate();

  if (!user) return <AuthPage onLogin={(u) => { setUser(u); navigate('/'); }} />;

  const logout = () => {
    clearSession();
    setUser(null);
  };

  return (
    <div className="layout">
      <header className="topbar">
        <div className="brand">📚 PustakaKu</div>
        <nav>
          <NavLink to="/" end>Katalog</NavLink>
          <NavLink to="/loans">Peminjaman</NavLink>
          <NavLink to="/reservations">Reservasi</NavLink>
          <NavLink to="/dashboard">Dashboard</NavLink>
        </nav>
        <div className="user-box">
          <span>{user.name} <small className={`role ${user.role}`}>{user.role}</small></span>
          <button className="btn ghost" onClick={logout}>Keluar</button>
        </div>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<Books user={user} />} />
          <Route path="/books/:id" element={<BookDetail user={user} />} />
          <Route path="/loans" element={<Loans user={user} />} />
          <Route path="/reservations" element={<Reservations user={user} />} />
          <Route path="/dashboard" element={<Dashboard user={user} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      <footer className="footer">PustakaKu © 2026 · Dideploy dengan Docker & GitHub Actions</footer>
    </div>
  );
}
