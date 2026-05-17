import { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard';
import Form from './components/Form';

function resolveView(pathname: string, hash: string) {
  if (pathname === '/dashboard' || hash === '#/dashboard') {
    return 'dashboard';
  }

  return 'form';
}

export default function App() {

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