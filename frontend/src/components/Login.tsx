// ABOUTME: Login component with magic link auth flow.
// ABOUTME: Handles email submission, token verification, and session creation.

import { useState } from 'react';
import { login, verifyToken, setToken } from '../lib/api.ts';

interface LoginProps {
  onLogin: (user: { id: string; email: string }) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [magicToken, setMagicToken] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestLink = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await login(email);
      // For MVP, the token is returned directly
      setPendingEmail(email);
      setMagicToken(result.token);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!magicToken) return;
    setError('');
    setLoading(true);
    try {
      const result = await verifyToken(pendingEmail, magicToken);
      setToken(result.sessionToken);
      onLogin(result.user);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>HookRelay</h1>
        <p style={styles.subtitle}>Webhook debugging & relay tool</p>

        {!magicToken ? (
          <>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRequestLink()}
              style={styles.input}
            />
            <button onClick={handleRequestLink} disabled={loading || !email} style={styles.button}>
              {loading ? 'Sending...' : 'Get Magic Link'}
            </button>
          </>
        ) : (
          <>
            <p style={styles.info}>Magic token generated for {pendingEmail}</p>
            <button onClick={handleVerify} disabled={loading} style={styles.button}>
              {loading ? 'Verifying...' : 'Sign In'}
            </button>
          </>
        )}

        {error && <p style={styles.error}>{error}</p>}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    background: '#0f172a',
  } as React.CSSProperties,
  card: {
    background: '#1e293b',
    borderRadius: '12px',
    padding: '2.5rem',
    width: '100%',
    maxWidth: '400px',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  title: {
    fontSize: '2rem',
    fontWeight: 700,
    color: '#f1f5f9',
    marginBottom: '0.25rem',
  } as React.CSSProperties,
  subtitle: {
    color: '#94a3b8',
    marginBottom: '2rem',
    fontSize: '0.9rem',
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    border: '1px solid #334155',
    background: '#0f172a',
    color: '#e2e8f0',
    fontSize: '1rem',
    marginBottom: '1rem',
    outline: 'none',
  } as React.CSSProperties,
  button: {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '8px',
    border: 'none',
    background: '#6366f1',
    color: '#fff',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,
  info: {
    color: '#94a3b8',
    marginBottom: '1rem',
    fontSize: '0.85rem',
  } as React.CSSProperties,
  error: {
    color: '#f87171',
    marginTop: '1rem',
    fontSize: '0.85rem',
  } as React.CSSProperties,
};
