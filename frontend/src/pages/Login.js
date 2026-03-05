import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../components/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async () => {
    try {
      const endpoint = isSignup ? '/auth/signup' : '/auth/login';
      const res = await api.post(endpoint, { email, password });
      localStorage.setItem('token', res.data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>🔐 NovaSec</h1>
        <p style={styles.subtitle}>Questionnaire Answering Tool</p>
        <h2 style={styles.formTitle}>{isSignup ? 'Create Account' : 'Sign In'}</h2>
        {error && <div style={styles.error}>{error}</div>}
        <input style={styles.input} placeholder="Email" value={email}
          onChange={e => setEmail(e.target.value)} type="email" />
        <input style={styles.input} placeholder="Password" value={password}
          onChange={e => setPassword(e.target.value)} type="password" />
        <button style={styles.button} onClick={handleSubmit}>
          {isSignup ? 'Sign Up' : 'Login'}
        </button>
        <p style={styles.toggle} onClick={() => setIsSignup(!isSignup)}>
          {isSignup ? 'Already have an account? Login' : "Don't have an account? Sign Up"}
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#0f0f1a', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  card: { background: '#1a1a2e', padding: 40, borderRadius: 12, width: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' },
  title: { color: '#4f8ef7', margin: 0, fontSize: 28, textAlign: 'center' },
  subtitle: { color: '#888', textAlign: 'center', marginBottom: 24 },
  formTitle: { color: '#fff', marginBottom: 20 },
  input: { width: '100%', padding: '12px', marginBottom: 12, borderRadius: 8, border: '1px solid #333', background: '#0f0f1a', color: '#fff', fontSize: 14, boxSizing: 'border-box' },
  button: { width: '100%', padding: 12, background: '#4f8ef7', color: '#fff', border: 'none', borderRadius: 8, fontSize: 16, cursor: 'pointer', fontWeight: 'bold' },
  toggle: { color: '#4f8ef7', textAlign: 'center', marginTop: 16, cursor: 'pointer', fontSize: 13 },
  error: { background: '#ff000022', color: '#ff6666', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 13 }
};