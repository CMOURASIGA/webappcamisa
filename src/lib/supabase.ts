import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const supabaseConfigError = !supabaseUrl
  ? 'VITE_SUPABASE_URL não configurada no arquivo .env.local.'
  : !supabaseKey
    ? 'VITE_SUPABASE_ANON_KEY não configurada no arquivo .env.local.'
    : null;

// Mantém a aplicação renderizável mesmo se faltar configuração.
// O App exibirá uma mensagem clara em vez de uma tela branca.
export const supabase = createClient(
  supabaseUrl || 'https://invalid.supabase.co',
  supabaseKey || 'configuracao-ausente',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
