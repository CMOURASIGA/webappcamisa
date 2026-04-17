import type {
  BootstrapData,
  DashboardData,
  SubmitOrderPayload,
  SubmitOrderResult,
} from '../types/api';

const MOCK_MODE = import.meta.env.VITE_USE_MOCK_API === 'true';
const GAS_URL = (import.meta.env.VITE_GAS_WEB_APP_URL || '').trim();

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

function ensureApiEnabled() {
  if (MOCK_MODE) {
    throw new Error('API em modo mock (VITE_USE_MOCK_API=true).');
  }

  if (!GAS_URL) {
    throw new Error('Defina VITE_GAS_WEB_APP_URL no .env.local');
  }
}

async function callGas<T>(action: string, payload?: unknown): Promise<T> {
  ensureApiEnabled();

  const response = await fetch(GAS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({ action, payload }),
  });

  let parsed: ApiEnvelope<T> | null = null;
  try {
    parsed = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new Error('Resposta invalida do Apps Script.');
  }

  if (!response.ok || !parsed || !parsed.ok) {
    throw new Error(parsed?.error || 'Falha ao consultar Apps Script.');
  }

  if (typeof parsed.data === 'undefined') {
    throw new Error('Resposta sem dados do Apps Script.');
  }

  return parsed.data;
}

export function isMockApiEnabled() {
  return MOCK_MODE;
}

export async function fetchBootstrapData(): Promise<BootstrapData> {
  return callGas<BootstrapData>('getBootstrapData');
}

export async function submitOrder(payload: SubmitOrderPayload): Promise<SubmitOrderResult> {
  return callGas<SubmitOrderResult>('submitOrder', payload);
}

export async function fetchDashboardData(): Promise<DashboardData> {
  return callGas<DashboardData>('getDashboardData');
}

export async function markOrderDelivered(requestId: string): Promise<{ success: boolean; requestId: string; deliveredAt: string }> {
  return callGas<{ success: boolean; requestId: string; deliveredAt: string }>('markOrderDelivered', { requestId });
}
