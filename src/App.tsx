import { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard';
import Form from './components/Form';
import { supabaseConfigError } from './lib/supabase';

function resolveView(pathname: string, hash: string) {
  if (pathname === '/dashboard' || hash === '#/dashboard') {
    return 'dashboard';
  }

  return 'form';
}

export default function App() {
  if (supabaseConfigError) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f4f7fa', padding: 24, fontFamily: 'Arial, sans-serif' }}>
        <div style={{ width: '100%', maxWidth: 560, background: '#fff', border: '1px solid #d9e2ec', borderRadius: 20, padding: 28, boxShadow: '0 8px 30px rgba(15, 76, 129, 0.08)' }}>
          <h1 style={{ margin: 0, color: '#0f4c81', fontSize: 24 }}>Configuração local incompleta</h1>
          <p style={{ color: '#475569', lineHeight: 1.6 }}>O sistema abriu corretamente, mas falta uma variável necessária para conectar ao Supabase.</p>
          <div style={{ background: '#f8fafc', borderRadius: 12, padding: 14, fontFamily: 'monospace', color: '#b42318' }}>{supabaseConfigError}</div>
          <p style={{ color: '#475569', lineHeight: 1.6, marginBottom: 0 }}>Crie ou ajuste o arquivo <strong>.env.local</strong> e reinicie o comando <strong>npm run dev</strong>.</p>
        </div>
      </div>
    );
  }

  // BLOQUEIO DO SITE
  if (import.meta.env.VITE_SITE_BLOCKED === 'true') {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#111',
          color: '#fff',
          fontFamily: 'Arial, sans-serif',
          textAlign: 'center',
          padding: '24px'
        }}
      >
        <h1
          style={{
            fontSize: '32px',
            marginBottom: '16px'
          }}
        >
          Sistema temporariamente indisponível
        </h1>

        <p
          style={{
            fontSize: '18px',
            opacity: 0.8
          }}
        >
          Voltaremos em breve.
        </p>
      </div>
    );
  }

  const [view, setView] = useState(() =>
    resolveView(window.location.pathname, window.location.hash)
  );

  useEffect(() => {
    const updateView = () => {
      setView(
        resolveView(
          window.location.pathname,
          window.location.hash
        )
      );
    };

    window.addEventListener('popstate', updateView);
    window.addEventListener('hashchange', updateView);

    return () => {
      window.removeEventListener('popstate', updateView);
      window.removeEventListener('hashchange', updateView);
    };
  }, []);

  return view === 'dashboard'
    ? <Dashboard />
    : <Form />;
}