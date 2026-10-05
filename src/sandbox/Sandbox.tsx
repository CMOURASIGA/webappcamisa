import { useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Clipboard, Clock3, CreditCard, Settings2, ShieldCheck, Shirt, XCircle } from 'lucide-react';
import { COLORS, SIZES } from '../data/mockData';
import {
  DEFAULT_SETTINGS,
  cancelPreRequest,
  clearSandbox,
  confirmPayment,
  createPreRequest,
  findByProtocol,
  informPayment,
  listPreRequests,
  loadSettings,
  markRefundPending,
  markRefunded,
  paymentNotFound,
  saveSettings,
  type PreRequest,
  type PreRequestItem,
  type SandboxSettings,
} from './storage';

type Tab = 'nova' | 'acompanhar' | 'financeiro' | 'configuracoes';

const statusLabel: Record<string, string> = {
  AGUARDANDO_PAGAMENTO: 'Aguardando pagamento',
  PAGAMENTO_INFORMADO: 'Pagamento informado',
  AGUARDANDO_VALIDACAO_FINANCEIRA: 'Aguardando validação financeira',
  CONFIRMADA: 'Pedido confirmado',
  CANCELAMENTO_SOLICITADO: 'Cancelamento solicitado',
  CANCELADA: 'Cancelada',
  EXPIRADA: 'Expirada',
};

const paymentLabel: Record<string, string> = {
  NAO_INFORMADO: 'Não informado',
  AGUARDANDO_VALIDACAO: 'Aguardando validação',
  CONFIRMADO: 'Confirmado',
  NAO_LOCALIZADO: 'Não localizado',
  ESTORNO_PENDENTE: 'Estorno pendente',
  ESTORNADO: 'Estornado',
};

function money(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR');
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black text-primary">{children}</span>;
}

function RequestCard({ row, refresh }: { row: PreRequest; refresh: () => void }) {
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [proof, setProof] = useState<File | null>(null);
  const [cancelReason, setCancelReason] = useState('Desistência da compra');
  const [message, setMessage] = useState('');

  const canInformPayment = row.status === 'AGUARDANDO_PAGAMENTO' || row.paymentStatus === 'NAO_LOCALIZADO';
  const canCancel = !['CANCELADA', 'EXPIRADA'].includes(row.status);

  const doInformPayment = () => {
    if (!proof) {
      setMessage('Selecione o comprovante para informar o pagamento.');
      return;
    }
    informPayment(row.id, {
      paymentDate,
      proofName: proof.name,
      proofType: proof.type || 'application/octet-stream',
      proofSize: proof.size,
    });
    setMessage('Pagamento informado. Agora depende da validação do Financeiro.');
    refresh();
  };

  const doCancel = () => {
    cancelPreRequest(row.id, cancelReason);
    setMessage(row.paymentStatus === 'NAO_INFORMADO'
      ? 'Pré-solicitação cancelada.'
      : 'Cancelamento solicitado. O Financeiro precisa verificar o PIX.');
    refresh();
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border-color bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase text-text-muted">Protocolo</div>
          <div className="text-xl font-black text-primary">{row.protocol}</div>
          {row.officialCode && <div className="mt-1 text-[12px] font-bold text-success">Pedido oficial: {row.officialCode}</div>}
        </div>
        <div className="text-right">
          <Badge>{statusLabel[row.status] || row.status}</Badge>
          <div className="mt-2 text-[11px] text-text-muted">Financeiro: {paymentLabel[row.paymentStatus] || row.paymentStatus}</div>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] font-semibold text-amber-900">
        Enquanto o Financeiro não confirmar o PIX, isto é apenas uma pré-solicitação. Não há pedido oficial nem reserva de camisa.
      </div>

      <div className="grid gap-3 text-[13px] md:grid-cols-2">
        <div><span className="text-text-muted">Solicitante:</span> <strong>{row.requesterName}</strong></div>
        <div><span className="text-text-muted">Beneficiário:</span> <strong>{row.beneficiaryName}</strong></div>
        <div><span className="text-text-muted">Valor:</span> <strong>{money(row.totalAmount)}</strong></div>
        <div><span className="text-text-muted">Prazo:</span> <strong>{dateTime(row.expiresAt)}</strong></div>
      </div>

      <div>
        <div className="mb-2 text-[12px] font-black">Itens</div>
        <div className="space-y-1 text-[12px]">
          {row.items.map((item) => (
            <div key={item.id} className="flex justify-between rounded-lg bg-[#F7F9FB] px-3 py-2">
              <span>{item.color} / {item.size}</span>
              <strong>{item.quantity} un.</strong>
            </div>
          ))}
        </div>
      </div>

      {row.status === 'AGUARDANDO_PAGAMENTO' && (
        <div className="rounded-2xl bg-primary p-4 text-white">
          <div className="text-[11px] font-bold uppercase opacity-70">PIX Copia e Cola</div>
          <div className="mt-2 break-all rounded-xl bg-white/10 p-3 font-mono text-[10px] leading-5">{row.pixPayload}</div>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(row.pixPayload);
              setMessage('PIX copiado.');
            }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-[12px] font-black text-primary"
          >
            <Clipboard size={15} /> Copiar PIX
          </button>
          <div className="mt-2 text-[10px] opacity-80">
            {row.pixSnapshot.keyType}: {row.pixSnapshot.key} · {row.pixSnapshot.receiverName}
          </div>
        </div>
      )}

      {canInformPayment && (
        <div className="rounded-xl border border-border-color p-4">
          <div className="mb-3 text-[13px] font-black">Já realizou o PIX?</div>
          <div className="grid gap-3 md:grid-cols-2">
            <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="rounded-xl border border-border-color p-3 text-[13px]" />
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setProof(e.target.files?.[0] || null)} className="rounded-xl border border-border-color p-2 text-[12px]" />
          </div>
          <div className="mt-2 text-[10px] text-text-muted">No sandbox, o arquivo não é enviado para o Storage. Guardamos somente os metadados para validar o fluxo.</div>
          <button type="button" onClick={doInformPayment} className="mt-3 w-full rounded-xl bg-success px-4 py-3 text-[12px] font-black text-white">Informar pagamento</button>
        </div>
      )}

      {canCancel && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4">
          <div className="text-[12px] font-black text-red-800">Cancelar pré-solicitação</div>
          <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="mt-2 w-full rounded-xl border border-red-200 bg-white p-3 text-[12px]" />
          <button type="button" onClick={doCancel} className="mt-2 w-full rounded-xl border border-red-300 bg-white px-4 py-2.5 text-[12px] font-black text-red-700">Solicitar cancelamento</button>
        </div>
      )}

      {message && <div className="rounded-xl bg-blue-50 p-3 text-[12px] font-semibold text-primary">{message}</div>}

      <details className="rounded-xl border border-border-color bg-[#FAFBFC] p-3">
        <summary className="cursor-pointer text-[12px] font-black">Histórico</summary>
        <div className="mt-3 space-y-2">
          {row.history.slice().reverse().map((event) => (
            <div key={event.id} className="border-l-2 border-primary/20 pl-3 text-[11px]">
              <strong>{event.event}</strong> · {event.actor}<br />
              <span className="text-text-muted">{dateTime(event.at)}{event.note ? ` · ${event.note}` : ''}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

export default function Sandbox() {
  const [tab, setTab] = useState<Tab>('nova');
  const [version, setVersion] = useState(0);
  const [settings, setSettings] = useState<SandboxSettings>(() => loadSettings());
  const [created, setCreated] = useState<PreRequest | null>(null);
  const [protocolSearch, setProtocolSearch] = useState('');
  const [found, setFound] = useState<PreRequest | null>(null);
  const [requesterName, setRequesterName] = useState('');
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [items, setItems] = useState<PreRequestItem[]>([{ id: crypto.randomUUID(), color: '', size: '', quantity: 1 }]);
  const [formMessage, setFormMessage] = useState('');

  const requests = useMemo(() => {
    void version;
    return listPreRequests();
  }, [version]);

  const refresh = () => {
    setVersion((value) => value + 1);
    if (created) setCreated(findByProtocol(created.protocol));
    if (found) setFound(findByProtocol(found.protocol));
  };

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const previewTotal = totalQuantity * settings.shirtUnitPrice;

  const create = () => {
    if (!requesterName.trim() || !beneficiaryName.trim()) {
      setFormMessage('Informe solicitante e beneficiário.');
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setFormMessage('Informe ao menos e-mail ou telefone.');
      return;
    }
    if (items.some((item) => !item.color || !item.size || item.quantity <= 0)) {
      setFormMessage('Preencha cor, tamanho e quantidade de todos os itens.');
      return;
    }
    const row = createPreRequest({ requesterName, beneficiaryName, email, phone, items });
    setCreated(row);
    setFormMessage('');
    refresh();
  };

  const updateItem = (id: string, patch: Partial<PreRequestItem>) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const financialQueue = requests.filter((row) =>
    ['AGUARDANDO_VALIDACAO', 'NAO_LOCALIZADO', 'ESTORNO_PENDENTE'].includes(row.paymentStatus) ||
    row.status === 'CANCELAMENTO_SOLICITADO'
  );

  return (
    <div className="min-h-screen bg-[#F4F7FA]">
      <header className="border-b border-border-color bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-wider text-primary">webappcamisa · homologação local</div>
            <h1 className="m-0 mt-1 text-2xl font-black">Pré-solicitação + PIX manual</h1>
            <p className="m-0 mt-1 text-[12px] text-text-muted">Sem alteração no Supabase. Persistência exclusivamente em localStorage.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-black text-amber-800">
            <ShieldCheck size={15} /> SANDBOX
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl p-4">
        <nav className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-4">
          {([
            ['nova', 'Nova pré-solicitação', Shirt],
            ['acompanhar', 'Acompanhar', Clock3],
            ['financeiro', 'Financeiro', CreditCard],
            ['configuracoes', 'Configurações', Settings2],
          ] as const).map(([key, label, Icon]) => (
            <button key={key} onClick={() => setTab(key)} className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-[12px] font-black ${tab === key ? 'border-primary bg-primary text-white' : 'border-border-color bg-white text-text-main'}`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </nav>

        {tab === 'nova' && (
          <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
            <div className="space-y-4 rounded-2xl border border-border-color bg-white p-5">
              <div>
                <h2 className="m-0 text-lg font-black">Criar pré-solicitação</h2>
                <p className="mt-1 text-[12px] text-text-muted">O PIX não é obrigatório nesta etapa.</p>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] font-semibold text-amber-900">
                Ao concluir, será criado apenas um protocolo de intenção. A compra só será confirmada após o PIX ser informado e validado pelo Financeiro.
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <input value={requesterName} onChange={(e) => setRequesterName(e.target.value)} placeholder="Nome do solicitante" className="rounded-xl border border-border-color p-3 text-[13px]" />
                <input value={beneficiaryName} onChange={(e) => setBeneficiaryName(e.target.value)} placeholder="Beneficiário" className="rounded-xl border border-border-color p-3 text-[13px]" />
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" className="rounded-xl border border-border-color p-3 text-[13px]" />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefone" className="rounded-xl border border-border-color p-3 text-[13px]" />
              </div>

              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={item.id} className="grid gap-2 rounded-xl bg-[#F7F9FB] p-3 md:grid-cols-[1fr_1fr_100px_auto]">
                    <select value={item.color} onChange={(e) => updateItem(item.id, { color: e.target.value })} className="rounded-xl border border-border-color bg-white p-3 text-[12px]">
                      <option value="">Cor</option>
                      {COLORS.map((color) => <option key={color}>{color}</option>)}
                    </select>
                    <select value={item.size} onChange={(e) => updateItem(item.id, { size: e.target.value })} className="rounded-xl border border-border-color bg-white p-3 text-[12px]">
                      <option value="">Tamanho</option>
                      {SIZES.map((size) => <option key={size}>{size}</option>)}
                    </select>
                    <input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(item.id, { quantity: Math.max(1, Number(e.target.value)) })} className="rounded-xl border border-border-color p-3 text-[12px]" />
                    <button type="button" onClick={() => setItems((current) => current.length === 1 ? current : current.filter((row) => row.id !== item.id))} className="rounded-xl border border-red-100 px-3 text-red-600" aria-label={`Remover item ${index + 1}`}>×</button>
                  </div>
                ))}
                <button type="button" onClick={() => setItems((current) => [...current, { id: crypto.randomUUID(), color: '', size: '', quantity: 1 }])} className="rounded-xl border border-primary/20 px-4 py-2 text-[12px] font-black text-primary">+ Adicionar camisa</button>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-primary-light p-4">
                <span className="text-[12px] font-bold">Total previsto</span>
                <strong className="text-xl text-primary">{money(previewTotal)}</strong>
              </div>

              {formMessage && <div className="rounded-xl bg-red-50 p-3 text-[12px] font-semibold text-red-700">{formMessage}</div>}
              <button type="button" onClick={create} className="w-full rounded-xl bg-primary px-4 py-3.5 text-[13px] font-black text-white">Criar pré-solicitação</button>
            </div>

            <div>
              {created ? <RequestCard row={created} refresh={refresh} /> : (
                <div className="rounded-2xl border border-dashed border-border-color bg-white p-8 text-center">
                  <Shirt className="mx-auto text-text-muted" />
                  <div className="mt-3 text-[13px] font-black">A pré-solicitação criada aparecerá aqui</div>
                  <div className="mt-1 text-[11px] text-text-muted">Com protocolo, prazo e PIX Copia e Cola.</div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'acompanhar' && (
          <div className="mx-auto max-w-2xl">
            <div className="mb-4 rounded-2xl border border-border-color bg-white p-4">
              <div className="text-[13px] font-black">Consultar protocolo</div>
              <div className="mt-3 flex gap-2">
                <input value={protocolSearch} onChange={(e) => setProtocolSearch(e.target.value)} placeholder="REC-2026-000001" className="min-w-0 flex-1 rounded-xl border border-border-color p-3 text-[13px]" />
                <button onClick={() => setFound(findByProtocol(protocolSearch))} className="rounded-xl bg-primary px-4 text-[12px] font-black text-white">Buscar</button>
              </div>
            </div>
            {found ? <RequestCard row={found} refresh={refresh} /> : protocolSearch && <div className="rounded-xl bg-white p-5 text-center text-[12px] text-text-muted">Informe o protocolo e clique em buscar.</div>}
          </div>
        )}

        {tab === 'financeiro' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border-color bg-white p-5">
              <h2 className="m-0 text-lg font-black">Fila do Financeiro</h2>
              <p className="mt-1 text-[12px] text-text-muted">Toda confirmação continua sendo humana.</p>
            </div>
            {!financialQueue.length && <div className="rounded-2xl border border-border-color bg-white p-8 text-center text-[12px] text-text-muted">Nenhuma pendência financeira.</div>}
            {financialQueue.map((row) => (
              <div key={row.id} className="rounded-2xl border border-border-color bg-white p-5">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <div className="font-black text-primary">{row.protocol}</div>
                    <div className="text-[12px]">{row.requesterName} · {row.beneficiaryName}</div>
                    <div className="mt-1 text-[11px] text-text-muted">{money(row.totalAmount)} · {paymentLabel[row.paymentStatus]}</div>
                    {row.proofName && <div className="mt-1 text-[11px]">Comprovante informado: <strong>{row.proofName}</strong></div>}
                  </div>
                  <Badge>{statusLabel[row.status]}</Badge>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {row.paymentStatus === 'AGUARDANDO_VALIDACAO' && (
                    <>
                      <button onClick={() => { confirmPayment(row.id); refresh(); }} className="flex items-center gap-2 rounded-xl bg-success px-3 py-2 text-[11px] font-black text-white"><CheckCircle2 size={14} /> Confirmar PIX</button>
                      <button onClick={() => { paymentNotFound(row.id, 'PIX não localizado pelo Financeiro.'); refresh(); }} className="flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-[11px] font-black text-red-700"><XCircle size={14} /> Não localizado</button>
                    </>
                  )}
                  {row.status === 'CANCELAMENTO_SOLICITADO' && row.paymentStatus !== 'ESTORNO_PENDENTE' && row.paymentStatus !== 'ESTORNADO' && (
                    <button onClick={() => { markRefundPending(row.id); refresh(); }} className="rounded-xl bg-amber-500 px-3 py-2 text-[11px] font-black text-white">PIX entrou · exigir estorno</button>
                  )}
                  {row.paymentStatus === 'ESTORNO_PENDENTE' && (
                    <button onClick={() => { markRefunded(row.id, 'Estorno registrado pelo Financeiro no sandbox.'); refresh(); }} className="rounded-xl bg-primary px-3 py-2 text-[11px] font-black text-white">Registrar estorno</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'configuracoes' && (
          <div className="mx-auto max-w-2xl rounded-2xl border border-border-color bg-white p-5">
            <h2 className="m-0 text-lg font-black">Configurações do PIX</h2>
            <p className="mt-1 text-[12px] text-text-muted">As mudanças valem somente para novas pré-solicitações.</p>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <label className="text-[11px] font-black">Tipo da chave
                <select value={settings.pixKeyType} onChange={(e) => setSettings({ ...settings, pixKeyType: e.target.value as SandboxSettings['pixKeyType'] })} className="mt-1 w-full rounded-xl border border-border-color bg-white p-3 text-[13px]">
                  <option>CPF</option><option>CNPJ</option><option>EMAIL</option><option>TELEFONE</option><option>ALEATORIA</option>
                </select>
              </label>
              <label className="text-[11px] font-black">Chave PIX
                <input value={settings.pixKey} onChange={(e) => setSettings({ ...settings, pixKey: e.target.value })} className="mt-1 w-full rounded-xl border border-border-color p-3 text-[13px]" />
              </label>
              <label className="text-[11px] font-black">Nome do recebedor
                <input value={settings.receiverName} onChange={(e) => setSettings({ ...settings, receiverName: e.target.value })} className="mt-1 w-full rounded-xl border border-border-color p-3 text-[13px]" />
              </label>
              <label className="text-[11px] font-black">Cidade
                <input value={settings.receiverCity} onChange={(e) => setSettings({ ...settings, receiverCity: e.target.value })} className="mt-1 w-full rounded-xl border border-border-color p-3 text-[13px]" />
              </label>
              <label className="text-[11px] font-black">Valor por camisa
                <input type="number" min={0.01} step="0.01" value={settings.shirtUnitPrice} onChange={(e) => setSettings({ ...settings, shirtUnitPrice: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-border-color p-3 text-[13px]" />
              </label>
              <label className="text-[11px] font-black">Validade da pré-solicitação, horas
                <input type="number" min={1} value={settings.expirationHours} onChange={(e) => setSettings({ ...settings, expirationHours: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-border-color p-3 text-[13px]" />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button onClick={() => { saveSettings(settings); setSettings(loadSettings()); }} className="rounded-xl bg-primary px-4 py-3 text-[12px] font-black text-white">Salvar configurações</button>
              <button onClick={() => { saveSettings(DEFAULT_SETTINGS); setSettings(DEFAULT_SETTINGS); }} className="rounded-xl border border-border-color px-4 py-3 text-[12px] font-black">Restaurar padrão</button>
              <button onClick={() => { if (window.confirm('Limpar todas as pré-solicitações do sandbox?')) { clearSandbox(); setCreated(null); setFound(null); refresh(); } }} className="rounded-xl border border-red-200 px-4 py-3 text-[12px] font-black text-red-700">Limpar dados de teste</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
