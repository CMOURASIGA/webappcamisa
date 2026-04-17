import { useState, useEffect } from 'react';
import Form from './components/Form';
import Dashboard from './components/Dashboard';

export default function App() {
  const [view, setView] = useState<'form' | 'dashboard'>('form');

  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#dashboard') {
        setView('dashboard');
      } else {
        setView('form');
      }
    };
    
    // Check initial hash
    handleHashChange();
    
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <>
      {/* Dev Navigation (only visible in dev mode or top corner, but for now we put it out of the way) */}
      <div className="fixed top-2 right-2 z-50 flex gap-2">
        <button 
          onClick={() => window.location.hash = ''} 
          className="text-[10px] bg-white/50 hover:bg-white px-2 py-1 rounded shadow"
        >
          Form
        </button>
        <button 
          onClick={() => window.location.hash = 'dashboard'} 
          className="text-[10px] bg-white/50 hover:bg-white px-2 py-1 rounded shadow"
        >
          Dashboard
        </button>
      </div>
      
      {view === 'form' ? <Form /> : <Dashboard />}
    </>
  );
}
