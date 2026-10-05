import { generatePixCopyPaste } from './pix';

export type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'TELEFONE' | 'ALEATORIA';

export type SandboxSettings = {
  pixKeyType: PixKeyType;
  pixKey: string;
  receiverName: string;
  receiverCity: string;
  shirtUnitPrice: number;
  expirationHours: number;
};

export type PreRequestStatus =
  | 'AGUARDANDO_PAGAMENTO'
  | 'PAGAMENTO_INFORMADO'
  | 'AGUARDANDO_VALIDACAO_FINANCEIRA'
  | 'CONFIRMADA'
  | 'CANCELAMENTO_SOLICITADO'
  | 'CANCELADA'
  | 'EXPIRADA';

export type PaymentStatus =
  | 'NAO_INFORMADO'
  | 'AGUARDANDO_VALIDACAO'
  | 'CONFIRMADO'
  | 'NAO_LOCALIZADO'
  | 'ESTORNO_PENDENTE'
  | 'ESTORNADO';

export type PreRequestItem = {
  id: string;
  color: string;
  size: string;
  quantity: number;
};

export type StatusHistory = {
  id: string;
  at: string;
  actor: 'CLIENTE' | 'FINANCEIRO' | 'SISTEMA';
  event: string;
  note?: string | null;
};

export type PreRequest = {
  id: string;
  protocol: string;
  officialCode: string | null;
  requesterName: string;
  beneficiaryName: string;
  email: string | null;
  phone: string | null;
  items: PreRequestItem[];
  unitPrice: number;
  totalAmount: number;
  status: PreRequestStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  expiresAt: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
  paymentInformedAt: string | null;
  paymentDate: string | null;
  proofName: string | null;
  proofType: string | null;
  proofSize: number | null;
  pixPayload: string;
  emailEventsSent: string[];
  pixSnapshot: {
    keyType: PixKeyType;
    key: string;
    receiverName: string;
    receiverCity: string;
  };
  history: StatusHistory[];
};

const SETTINGS_KEY = 'webappcamisa_sandbox_settings_v1';
const REQUESTS_KEY = 'webappcamisa_sandbox_requests_v1';
const COUNTER_KEY = 'webappcamisa_sandbox_counter_v1';

export const DEFAULT_SETTINGS: SandboxSettings = {
  pixKeyType: 'TELEFONE',
  pixKey: '21980342025',
  receiverName: 'EAC Porciuncula de Santana',
  receiverCity: 'NITEROI',
  shirtUnitPrice: 40,
  expirationHours: 72,
};

function now() {
  return new Date().toISOString();
}

function history(actor: StatusHistory['actor'], event: string, note?: string | null): StatusHistory {
  return { id: crypto.randomUUID(), at: now(), actor, event, note: note || null };
}

export function loadSettings(): SandboxSettings {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: SandboxSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function listPreRequests(): PreRequest[] {
  const raw = localStorage.getItem(REQUESTS_KEY);
  if (!raw) return [];
  try {
    const rows = (JSON.parse(raw) as PreRequest[]).map((row) => ({
      ...row,
      emailEventsSent: Array.isArray(row.emailEventsSent) ? row.emailEventsSent : [],
    }));
    return expireRows(rows).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

function persist(rows: PreRequest[]) {
  localStorage.setItem(REQUESTS_KEY, JSON.stringify(rows));
}

function expireRows(rows: PreRequest[]) {
  let changed = false;
  const current = Date.now();
  const next = rows.map((row) => {
    if (
      row.status === 'AGUARDANDO_PAGAMENTO' &&
      new Date(row.expiresAt).getTime() <= current
    ) {
      changed = true;
      return {
        ...row,
        status: 'EXPIRADA' as const,
        history: [...row.history, history('SISTEMA', 'PRE_SOLICITACAO_EXPIRADA', 'Prazo de pagamento encerrado.')],
      };
    }
    return row;
  });
  if (changed) persist(next);
  return next;
}

function nextProtocol() {
  const current = Number(localStorage.getItem(COUNTER_KEY) || '0') + 1;
  localStorage.setItem(COUNTER_KEY, String(current));
  return `REC-${new Date().getFullYear()}-${String(current).padStart(6, '0')}`;
}

export function createPreRequest(input: {
  requesterName: string;
  beneficiaryName: string;
  email?: string | null;
  phone?: string | null;
  items: PreRequestItem[];
}): PreRequest {
  const settings = loadSettings();
  const protocol = nextProtocol();
  const createdAt = now();
  const expiresAt = new Date(Date.now() + settings.expirationHours * 60 * 60 * 1000).toISOString();
  const quantity = input.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = quantity * settings.shirtUnitPrice;

  const row: PreRequest = {
    id: crypto.randomUUID(),
    protocol,
    officialCode: null,
    requesterName: input.requesterName.trim(),
    beneficiaryName: input.beneficiaryName.trim(),
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    items: input.items,
    unitPrice: settings.shirtUnitPrice,
    totalAmount,
    status: 'AGUARDANDO_PAGAMENTO',
    paymentStatus: 'NAO_INFORMADO',
    createdAt,
    expiresAt,
    cancelledAt: null,
    cancellationReason: null,
    paymentInformedAt: null,
    paymentDate: null,
    proofName: null,
    proofType: null,
    proofSize: null,
    emailEventsSent: [],
    pixPayload: generatePixCopyPaste({
      key: settings.pixKey,
      receiverName: settings.receiverName,
      receiverCity: settings.receiverCity,
      amount: totalAmount,
      txid: protocol.replace(/[^A-Za-z0-9]/g, '').slice(0, 25),
    }),
    pixSnapshot: {
      keyType: settings.pixKeyType,
      key: settings.pixKey,
      receiverName: settings.receiverName,
      receiverCity: settings.receiverCity,
    },
    history: [history('CLIENTE', 'PRE_SOLICITACAO_CRIADA', 'Sem reserva de estoque e sem pedido oficial.')],
  };

  persist([row, ...listPreRequests()]);
  return row;
}

function mutate(id: string, updater: (row: PreRequest) => PreRequest) {
  const rows = listPreRequests();
  const next = rows.map((row) => (row.id === id ? updater(row) : row));
  persist(next);
  return next.find((row) => row.id === id) || null;
}

export function findByProtocol(protocol: string) {
  return listPreRequests().find((row) => row.protocol.toUpperCase() === protocol.trim().toUpperCase()) || null;
}

export function informPayment(id: string, input: {
  paymentDate: string;
  proofName: string;
  proofType: string;
  proofSize: number;
}) {
  return mutate(id, (row) => ({
    ...row,
    status: 'AGUARDANDO_VALIDACAO_FINANCEIRA',
    paymentStatus: 'AGUARDANDO_VALIDACAO',
    paymentInformedAt: now(),
    paymentDate: input.paymentDate,
    proofName: input.proofName,
    proofType: input.proofType,
    proofSize: input.proofSize,
    history: [...row.history, history('CLIENTE', 'PAGAMENTO_INFORMADO', `Comprovante: ${input.proofName}`)],
  }));
}

export function cancelPreRequest(id: string, reason: string) {
  return mutate(id, (row) => {
    const paidOrInValidation = row.paymentStatus !== 'NAO_INFORMADO';
    return {
      ...row,
      status: paidOrInValidation ? 'CANCELAMENTO_SOLICITADO' : 'CANCELADA',
      cancelledAt: paidOrInValidation ? null : now(),
      cancellationReason: reason,
      history: [...row.history, history('CLIENTE', paidOrInValidation ? 'CANCELAMENTO_SOLICITADO' : 'PRE_SOLICITACAO_CANCELADA', reason)],
    };
  });
}

export function confirmPayment(id: string) {
  return mutate(id, (row) => ({
    ...row,
    status: 'CONFIRMADA',
    paymentStatus: 'CONFIRMADO',
    officialCode: row.officialCode || row.protocol.replace('REC-', 'PED-'),
    history: [...row.history, history('FINANCEIRO', 'PAGAMENTO_CONFIRMADO', 'Pedido oficial gerado.')],
  }));
}

export function paymentNotFound(id: string, note: string) {
  return mutate(id, (row) => ({
    ...row,
    status: 'PAGAMENTO_INFORMADO',
    paymentStatus: 'NAO_LOCALIZADO',
    history: [...row.history, history('FINANCEIRO', 'PAGAMENTO_NAO_LOCALIZADO', note)],
  }));
}

export function markRefundPending(id: string) {
  return mutate(id, (row) => ({
    ...row,
    status: 'CANCELAMENTO_SOLICITADO',
    paymentStatus: 'ESTORNO_PENDENTE',
    history: [...row.history, history('FINANCEIRO', 'ESTORNO_PENDENTE')],
  }));
}

export function markRefunded(id: string, note: string) {
  return mutate(id, (row) => ({
    ...row,
    status: 'CANCELADA',
    paymentStatus: 'ESTORNADO',
    cancelledAt: now(),
    history: [...row.history, history('FINANCEIRO', 'ESTORNO_REGISTRADO', note)],
  }));
}

export function clearSandbox() {
  localStorage.removeItem(REQUESTS_KEY);
  localStorage.removeItem(COUNTER_KEY);
}


export function markEmailEventSent(id: string, event: string) {
  return mutate(id, (row) => ({
    ...row,
    emailEventsSent: Array.from(new Set([...(row.emailEventsSent || []), event])),
    history: [...row.history, history('SISTEMA', 'EMAIL_ENVIADO', event)],
  }));
}


export function cancelWithoutRefund(id: string, note: string) {
  return mutate(id, (row) => ({
    ...row,
    status: 'CANCELADA',
    paymentStatus: 'NAO_LOCALIZADO',
    cancelledAt: now(),
    history: [...row.history, history('FINANCEIRO', 'CANCELADA_SEM_ESTORNO', note)],
  }));
}
