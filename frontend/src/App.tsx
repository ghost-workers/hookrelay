// ABOUTME: Root React component for HookRelay SPA.
// ABOUTME: Handles auth state and renders login or dashboard view.

import { useState, useEffect } from 'react';
import { getMe, clearToken } from './lib/api.ts';
import { Login } from './components/Login.tsx';
import { Dashboard } from './components/Dashboard.tsx';

export function App() {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    clearToken();
    setUser(null);
  };

  if (loading) {
    return <div style={styles.loading}>Loading...</div>;
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return <Dashboard user={user} onLogout={handleLogout} />;
}

const styles = {
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '1.2rem',
    color: '#94a3b8',
  } as React.CSSProperties,
};
