import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Dashboard from './Dashboard.jsx';
import MindMap from './MindMap.jsx';
import './App.css';

// === GİRİŞ FORMU BİLEŞENİ ===
function LoginForm({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    setError('');
    fetch('http://localhost/api/v1/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
      .then(response => {
        if (!response.ok) {
          return response.json().then(err => { throw err; });
        }
        return response.json();
      })
      .then(data => onLoginSuccess(data.token))
      .catch(err => setError(err.message || 'Giriş bilgileriniz hatalı.'));
  };

  return (
    <div className="card">
      <h1>Giriş Yap</h1>
      <form onSubmit={handleSubmit}>
        <div><label>Email:</label> <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div><label>Şifre:</label> <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        <button type="submit">Giriş Yap</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}

// === ANA UYGULAMA YÖNLENDİRİCİSİ ===
export default function App() {
  const [token, setToken] = useState(localStorage.getItem('api_token'));

  // Giriş başarılı olduğunda token'ı state'e ve localStorage'a kaydeder.
  const handleLoginSuccess = (newToken) => {
    localStorage.setItem('api_token', newToken);
    setToken(newToken);
  };

  // Eğer token yoksa, sadece LoginForm'u göster.
  if (!token) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  // Eğer token varsa, sayfa yönlendiricisini göster.
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/project/:projectId" element={<MindMap />} />
    </Routes>
  );
}