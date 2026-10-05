import { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard';
import Form from './components/Form';
import Sandbox from './sandbox/Sandbox';
import { supabaseConfigError } from './lib/supabase';

type View = 'form' | 'dashboard' | 'sandbox';

function resolveView(pathname: string, hash: string): View {
  if (pathname.startsWith('/sandbox') || hash.startsWith('#/sandbox')) return 'sandbox';
  if (pathname === '/dashboard' || hash === '#/dashboard') return 'dashboard';
  return 'form';
}

export default function App() {
  const requestedView = resolveView(window.location.pathname, window.location.hash);

  // O sandbox é propositalmente local-first e deve abrir mesmo sem Supabase.
  if (requestedView === 'sandbox') {
    return <Sandbox />;
  }

  // Nesta branch de homologação, ausência de Supabase não bloqueia o app:
  // o preview cai no sandbox local-first para permitir a validação operacional.
  if (supabaseConfigError) {
    return <Sandbox />;
  }

  const [view, setView] = useState<View>(() =>
    resolveView(window.location.pathname, window.location.hash)
  );

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
  if (view === 'sandbox') return <Sandbox />;
  return <Form />;
}
