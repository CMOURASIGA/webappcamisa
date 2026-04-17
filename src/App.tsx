import { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard';
import Form from './components/Form';

function resolveView(pathname: string, hash: string) {
  if (pathname === '/dashboard' || hash === '#/dashboard') return 'dashboard';
  return 'form';
}

export default function App() {
  const [view, setView] = useState(() => resolveView(window.location.pathname, window.location.hash));

  useEffect(() => {
    const updateView = () => {
      setView(resolveView(window.location.pathname, window.location.hash));
    };

    window.addEventListener('popstate', updateView);
    window.addEventListener('hashchange', updateView);

    return () => {
      window.removeEventListener('popstate', updateView);
      window.removeEventListener('hashchange', updateView);
    };
  }, []);

  if (view === 'dashboard') return <Dashboard />;

  return <Form />;
}
