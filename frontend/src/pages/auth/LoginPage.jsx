import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import logo from '../../assets/tedlinx-logo.png';
import wordmark from '../../assets/tedlinx-wordmark.png';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ marginBottom: 8 }}>
          <img src={wordmark} alt="TEDLinx" style={{ width: 180, height: 'auto', objectFit: 'contain' }} />
        </div>
        <div className="auth-tagline">Sign in to the employee portal</div>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label className="form-label">Work email</label>
            <input
              className="form-input"
              type="email"
              placeholder="you@tedlinx.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
              autoFocus
            />
          </div>
          <div className="form-row">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
            />
          </div>
          <div className="form-actions" style={{ marginTop: 24 }}>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </form>

        <p style={{ marginTop: 24, fontSize: 13, color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
          Forgot your password? Contact HR.
        </p>
      </div>
    </div>
  );
}
