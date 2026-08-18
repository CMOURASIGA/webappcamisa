/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_EAC_ENCONTRO_ID?: string;
  readonly VITE_EAC_ENCONTRO_NOME?: string;
  readonly VITE_SHIRT_PRICE?: string;
  readonly VITE_PIX_KEY?: string;
  readonly VITE_EAC_LOGO_URL?: string;
  readonly VITE_SITE_BLOCKED?: string;
  readonly VITE_GAS_WEB_APP_URL?: string;
  readonly VITE_USE_MOCK_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
