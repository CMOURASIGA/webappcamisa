import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  ClipboardCopy,
  Download,
  LogOut,
  PackagePlus,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { COLORS, SIZES } from "../data/mockData";
import {
  deleteStockBalance,
  deliverItem,
  fetchDashboardSummary,
  fetchOrders,
  fetchStock,
  getProofSignedUrl,
  getSession,
  registerStockReceipt,
  resendConfirmationEmail,
  setStockBalance,
  signIn,
  signOut,
  updateOrderStatus,
  updateOrderItem,
} from "../services/api";
import type {
  DashboardOrder,
  DashboardSummaryRow,
  StockRow,
} from "../types/api";

const ENCONTRO_ID =
  import.meta.env.VITE_EAC_ENCONTRO_ID ||
  "57a08fa1-29e9-4c35-ab34-eb187f79b13a";
const ENCONTRO_NOME = import.meta.env.VITE_EAC_ENCONTRO_NOME || "EAC 37";

type Tab = "visao" | "solicitacoes" | "reposicao" | "estoque";
type StatusFilter =
  | "TODOS"
  | "PENDENTE_REPOSICAO"
  | "PARCIALMENTE_COBERTO"
  | "PRONTO_ENTREGA"
  | "PARCIALMENTE_ENTREGUE"
  | "ENTREGUE"
  | "CANCELADO";
type ColorFilter = "TODAS" | string;
type SizeFilter = "TODOS" | string;

type ReceiptForm = {
  cor: string;
  tamanho: string;
  quantidade: number;
  observacao: string;
};

const STATUS_LABELS: Record<string, string> = {
  PENDENTE_REPOSICAO: "Sem estoque - solicitar reposição",
  PARCIALMENTE_COBERTO: "Estoque parcial",
  PRONTO_ENTREGA: "Com estoque - pronto para entregar",
  PARCIALMENTE_ENTREGUE: "Parcialmente entregue",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
};

function Card({
  label,
  value,
  helper,
}: {
  label: string;
  value: number;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-border-color bg-white p-4">
      <div className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
        {label}
      </div>
      <div className="mt-2 text-[28px] font-black text-primary">{value}</div>
      {helper && (
        <div className="mt-1 text-[11px] text-text-muted">{helper}</div>
      )}
    </div>
  );
}

function Login({ onLogged }: { onLogged: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signIn(email, password);
      onLogged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-[380px] rounded-2xl border border-border-color bg-white p-6 shadow-sm"
      >
        <div className="mb-5">
          <div className="text-[12px] font-bold uppercase text-primary">
            Gestão de Camisas
          </div>
          <h1 className="m-0 mt-1 text-[24px] font-black">
            Dashboard {ENCONTRO_NOME}
          </h1>
          <p className="mt-2 text-[13px] text-text-muted">
            Entre com um usuário autorizado do sistema EAC.
          </p>
        </div>
        {error && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] font-semibold text-red-700">
            {error}
          </div>
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail"
          className="mb-3 w-full rounded-xl border border-border-color p-3"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha"
          className="mb-4 w-full rounded-xl border border-border-color p-3"
        />
        <button
          disabled={loading}
          className="w-full rounded-xl bg-primary p-3 font-bold text-white"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

function StockDrawer({
  open,
  stock,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  stock: StockRow[];
  editing: StockRow | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<ReceiptForm>({
    cor: "",
    tamanho: "",
    quantidade: 1,
    observacao: "Recebimento da confecção",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        cor: editing.cor,
        tamanho: editing.tamanho,
        quantidade: Number(editing.quantidade_fisica || 0),
        observacao: "Correção manual de saldo",
      });
    } else {
      setForm({
        cor: "",
        tamanho: "",
        quantidade: 1,
        observacao: "Recebimento da confecção",
      });
    }
    setError("");
  }, [open, editing]);

  if (!open) return null;

  const current = editing
    ? Number(editing.quantidade_fisica || 0)
    : Number(
        stock.find((s) => s.cor === form.cor && s.tamanho === form.tamanho)
          ?.quantidade_fisica || 0,
      );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.cor || !form.tamanho) return setError("Selecione cor e tamanho.");
    if (
      !Number.isInteger(form.quantidade) ||
      form.quantidade < (editing ? 0 : 1)
    )
      return setError("Informe uma quantidade válida.");
    setSaving(true);
    try {
      if (editing) {
        await setStockBalance(
          editing.id,
          form.quantidade,
          form.observacao.trim() || "Correção manual de saldo",
        );
      } else {
        await registerStockReceipt(
          form.cor,
          form.tamanho,
          form.quantidade,
          form.observacao.trim() || "Recebimento da confecção",
        );
      }
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar estoque.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30" onMouseDown={onClose}>
      <aside
        className="absolute right-0 top-0 h-full w-full max-w-[430px] overflow-y-auto bg-white p-5 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase text-primary">
              Estoque recebido
            </div>
            <h2 className="m-0 mt-1 text-[22px] font-black">
              {editing ? "Editar saldo" : "Registrar recebimento"}
            </h2>
            <p className="m-0 mt-1 text-[12px] text-text-muted">
              {editing
                ? "Corrija o saldo físico quando um recebimento tiver sido registrado com quantidade errada."
                : "Registre somente as camisas que chegaram fisicamente da confecção."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-border-color p-2"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] font-semibold text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-[12px] font-bold">Cor</label>
            <select
              disabled={Boolean(editing)}
              value={form.cor}
              onChange={(e) => setForm((v) => ({ ...v, cor: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-border-color bg-white p-3 text-[13px] disabled:bg-gray-50"
            >
              <option value="">Selecione a cor</option>
              {COLORS.map((cor) => (
                <option key={cor} value={cor}>
                  {cor}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[12px] font-bold">Tamanho</label>
            <select
              disabled={Boolean(editing)}
              value={form.tamanho}
              onChange={(e) =>
                setForm((v) => ({ ...v, tamanho: e.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-border-color bg-white p-3 text-[13px] disabled:bg-gray-50"
            >
              <option value="">Selecione o tamanho</option>
              {SIZES.map((tamanho) => (
                <option key={tamanho} value={tamanho}>
                  {tamanho}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-xl bg-[#F7F9FB] p-3 text-[12px]">
            Saldo atual da combinação: <strong>{current}</strong>
          </div>
          <div>
            <label className="text-[12px] font-bold">
              {editing ? "Novo saldo físico" : "Quantidade recebida"}
            </label>
            <input
              type="number"
              min={editing ? 0 : 1}
              step={1}
              value={form.quantidade}
              onChange={(e) =>
                setForm((v) => ({ ...v, quantidade: Number(e.target.value) }))
              }
              className="mt-1 w-full rounded-xl border border-border-color p-3 text-[13px]"
            />
          </div>
          <div>
            <label className="text-[12px] font-bold">Observação</label>
            <textarea
              value={form.observacao}
              onChange={(e) =>
                setForm((v) => ({ ...v, observacao: e.target.value }))
              }
              rows={3}
              className="mt-1 w-full rounded-xl border border-border-color p-3 text-[13px]"
            />
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-[12px] text-blue-900">
            O saldo recebido é automaticamente direcionado às solicitações
            pendentes mais antigas da mesma cor e tamanho. A solicitação
            continua sempre livre para novos pedidos.
          </div>
          <button
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary p-3 font-bold text-white"
          >
            {editing ? <Pencil size={17} /> : <PackagePlus size={17} />}{" "}
            {saving
              ? "Salvando..."
              : editing
                ? "Salvar correção"
                : "Confirmar recebimento"}
          </button>
        </form>
      </aside>
    </div>
  );
}

function StatusDrawer({
  open,
  order,
  onClose,
  onSaved,
}: {
  open: boolean;
  order: DashboardOrder | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [status, setStatus] = useState<"ABERTA" | "CONCLUIDA" | "CANCELADA">(
    "ABERTA",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !order) return;
    const current = order.status_solicitacao;
    setStatus(
      current === "CONCLUIDA" || current === "CANCELADA" ? current : "ABERTA",
    );
    setError("");
  }, [open, order]);

  if (!open || !order) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await updateOrderStatus(order.solicitacao_id, status);
      await onSaved();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Falha ao alterar status da solicitação.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30" onMouseDown={onClose}>
      <aside
        className="absolute right-0 top-0 h-full w-full max-w-[430px] overflow-y-auto bg-white p-5 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase text-primary">
              Solicitação {order.codigo || order.solicitacao_id.slice(0, 8)}
            </div>
            <h2 className="m-0 mt-1 text-[22px] font-black">Alterar status</h2>
            <p className="m-0 mt-1 text-[12px] text-text-muted">
              {order.nome_solicitante} - {order.nome_beneficiario}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-border-color p-2"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] font-semibold text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-[12px] font-bold">
              Status da solicitação
            </label>
            <select
              value={status}
              onChange={(e) =>
                setStatus(
                  e.target.value as "ABERTA" | "CONCLUIDA" | "CANCELADA",
                )
              }
              className="mt-1 w-full rounded-xl border border-border-color bg-white p-3 text-[13px]"
            >
              <option value="ABERTA">Aberta</option>
              <option value="CONCLUIDA">Concluída</option>
              <option value="CANCELADA">Cancelada</option>
            </select>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-[12px] text-blue-900">
            <strong>Aberta</strong> representa uma solicitação ainda pendente.
            Se houver entrega registrada, reabrir desfaz a entrega, devolve a
            quantidade ao estoque e recalcula a cobertura.{" "}
            <strong>Cancelada</strong> remove o saldo pendente do cálculo.{" "}
            <strong>Concluída</strong> só é aceita quando todos os itens já
            estiverem entregues ou cancelados.
          </div>

          <button
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary p-3 font-bold text-white"
          >
            <Pencil size={17} /> {saving ? "Salvando..." : "Salvar status"}
          </button>
        </form>
      </aside>
    </div>
  );
}

function ItemDrawer({
  open,
  order,
  onClose,
  onSaved,
}: {
  open: boolean;
  order: DashboardOrder | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [cor, setCor] = useState("");
  const [tamanho, setTamanho] = useState("");
  const [motivo, setMotivo] = useState("Correção solicitada pelo responsável");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !order) return;
    setCor(order.cor);
    setTamanho(order.tamanho);
    setMotivo("Correção solicitada pelo responsável");
    setError("");
  }, [open, order]);

  if (!open || !order) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (cor === order.cor && tamanho === order.tamanho)
      return setError("Altere a cor ou o tamanho antes de salvar.");
    if (motivo.trim().length < 5)
      return setError("Informe o motivo da alteração.");
    setSaving(true);
    try {
      await updateOrderItem(order.item_id, cor, tamanho, motivo.trim());
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao alterar o item.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30" onMouseDown={onClose}>
      <aside
        className="absolute right-0 top-0 h-full w-full max-w-[430px] overflow-y-auto bg-white p-5 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase text-primary">
              Solicitação {order.codigo || order.solicitacao_id.slice(0, 8)}
            </div>
            <h2 className="m-0 mt-1 text-[22px] font-black">
              Alterar camisa solicitada
            </h2>
            <p className="m-0 mt-1 text-[12px] text-text-muted">
              {order.nome_beneficiario} - atual: {order.cor} / {order.tamanho}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-border-color p-2"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] font-semibold text-red-700">
            {error}
          </div>
        )}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-[12px] font-bold">Cor</label>
            <select
              value={cor}
              onChange={(e) => setCor(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border-color bg-white p-3 text-[13px]"
            >
              {COLORS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[12px] font-bold">Tamanho</label>
            <select
              value={tamanho}
              onChange={(e) => setTamanho(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border-color bg-white p-3 text-[13px]"
            >
              {SIZES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[12px] font-bold">Motivo da alteração</label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-border-color p-3 text-[13px]"
            />
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-[12px] text-blue-900">
            Ao salvar, a base será atualizada e o estoque reservado será
            recalculado para a combinação anterior e para a nova.
          </div>
          <button
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary p-3 font-bold text-white disabled:opacity-50"
          >
            <Pencil size={17} />{" "}
            {saving ? "Salvando..." : "Salvar nova cor e tamanho"}
          </button>
        </form>
      </aside>
    </div>
  );
}

export default function Dashboard() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("visao");
  const [summary, setSummary] = useState<DashboardSummaryRow[]>([]);
  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("TODOS");
  const [colorFilter, setColorFilter] = useState<ColorFilter>("TODAS");
  const [sizeFilter, setSizeFilter] = useState<SizeFilter>("TODOS");
  const [stockDrawerOpen, setStockDrawerOpen] = useState(false);
  const [editingStock, setEditingStock] = useState<StockRow | null>(null);
  const [copied, setCopied] = useState(false);
  const [statusDrawerOpen, setStatusDrawerOpen] = useState(false);
  const [statusOrder, setStatusOrder] = useState<DashboardOrder | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [itemDrawerOpen, setItemDrawerOpen] = useState(false);
  const [editingOrderItem, setEditingOrderItem] =
    useState<DashboardOrder | null>(null);

  useEffect(() => {
    getSession().then((session) => setAuthenticated(Boolean(session)));
  }, []);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [s, o, st] = await Promise.all([
        fetchDashboardSummary(ENCONTRO_ID),
        fetchOrders(ENCONTRO_ID),
        fetchStock(),
      ]);
      setSummary(s);
      setOrders(o);
      setStock(st);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Falha ao carregar dashboard.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authenticated) load();
  }, [authenticated]);

  const totals = useMemo(
    () =>
      summary.reduce(
        (acc, row) => ({
          estoque: acc.estoque + Number(row.estoque_fisico || 0),
          comprometido:
            acc.comprometido + Number(row.estoque_comprometido || 0),
          disponivel: acc.disponivel + Number(row.estoque_disponivel || 0),
          demanda: acc.demanda + Number(row.quantidade_solicitada || 0),
          entregue: acc.entregue + Number(row.quantidade_entregue || 0),
          aberto: acc.aberto + Number(row.demanda_aberta || 0),
          comprar: acc.comprar + Number(row.solicitar_reposicao || 0),
          pronto: acc.pronto + Number(row.pronto_para_entrega || 0),
        }),
        {
          estoque: 0,
          comprometido: 0,
          disponivel: 0,
          demanda: 0,
          entregue: 0,
          aberto: 0,
          comprar: 0,
          pronto: 0,
        },
      ),
    [summary],
  );

  const replenishmentRows = useMemo(
    () => summary.filter((r) => Number(r.solicitar_reposicao) > 0),
    [summary],
  );

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      const matchesSearch =
        !q ||
        [
          o.nome_solicitante,
          o.nome_beneficiario,
          o.cor,
          o.tamanho,
          o.codigo,
        ].some((x) =>
          String(x || "")
            .toLowerCase()
            .includes(q),
        );
      const matchesStatus =
        statusFilter === "TODOS" || o.status_item === statusFilter;
      const matchesColor = colorFilter === "TODAS" || o.cor === colorFilter;
      const matchesSize = sizeFilter === "TODOS" || o.tamanho === sizeFilter;
      return matchesSearch && matchesStatus && matchesColor && matchesSize;
    });
  }, [orders, search, statusFilter, colorFilter, sizeFilter]);

  const filteredSummary = useMemo(
    () =>
      summary.filter(
        (r) =>
          (colorFilter === "TODAS" || r.cor === colorFilter) &&
          (sizeFilter === "TODOS" || r.tamanho === sizeFilter),
      ),
    [summary, colorFilter, sizeFilter],
  );

  const filteredStock = useMemo(
    () =>
      stock.filter(
        (s) =>
          (colorFilter === "TODAS" || s.cor === colorFilter) &&
          (sizeFilter === "TODOS" || s.tamanho === sizeFilter),
      ),
    [stock, colorFilter, sizeFilter],
  );

  const exportOrdersCsv = () => {
    if (!filteredOrders.length) return;

    const escapeCsv = (value: unknown) => {
      const text = String(value ?? "")
        .replace(/\r?\n/g, " ")
        .trim();
      return `"${text.replace(/"/g, '""')}"`;
    };

    const statusEmail = (o: DashboardOrder) => {
      if (!o.email_solicitante) return "Sem e-mail informado";
      if (o.email_confirmacao_enviada_em) return "E-mail enviado";
      if (o.email_confirmacao_erro) return "E-mail com falha";
      return "E-mail pendente";
    };

    const headers = [
      "Código",
      "Data/Hora",
      "Solicitante",
      "Beneficiário",
      "E-mail",
      "Telefone",
      "Tipo solicitante",
      "Equipe",
      "Cor",
      "Tamanho",
      "Quantidade solicitada",
      "Quantidade coberta",
      "Quantidade entregue",
      "Quantidade sem cobertura",
      "Situação do item",
      "Status da solicitação",
      "Status do e-mail",
    ];

    const rows = filteredOrders.map((o) => [
      o.codigo || o.solicitacao_id,
      new Date(o.criado_em).toLocaleString("pt-BR"),
      o.nome_solicitante,
      o.nome_beneficiario,
      o.email_solicitante || "",
      o.telefone_solicitante || "",
      o.eh_encontreiro ? "Encontreiro" : "Externo",
      o.equipe || "",
      o.cor,
      o.tamanho,
      o.quantidade_solicitada,
      o.quantidade_reservada,
      o.quantidade_entregue,
      o.quantidade_sem_cobertura,
      STATUS_LABELS[o.status_item] || o.status_item,
      o.status_solicitacao === "CONCLUIDA"
        ? "Concluída"
        : o.status_solicitacao === "CANCELADA"
          ? "Cancelada"
          : "Aberta",
      statusEmail(o),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(";"))
      .join("\r\n");

    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `solicitacoes-${ENCONTRO_NOME.toLowerCase().replace(/\s+/g, "-")}-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const stockCoverage = (row: StockRow) =>
    summary.find((s) => s.cor === row.cor && s.tamanho === row.tamanho);

  const handleDeliver = async (order: DashboardOrder) => {
    const pending = Number(order.quantidade_pendente || 0);
    const reserved = Number(order.quantidade_reservada || 0);
    if (reserved <= 0)
      return alert(
        `Esta solicitação ainda não possui camisa recebida/reservada para ${order.cor} / ${order.tamanho}.`,
      );
    const max = Math.min(pending, reserved);
    const raw = window.prompt(
      `Quantidade a entregar para ${order.nome_beneficiario} (${order.cor} ${order.tamanho}). Pendente: ${pending}. Coberto: ${reserved}`,
      String(max),
    );
    if (!raw) return;
    const qty = Number(raw);
    if (!Number.isInteger(qty) || qty <= 0 || qty > pending || qty > reserved)
      return alert(
        "Quantidade inválida ou superior à quantidade coberta para esta solicitação.",
      );
    try {
      await deliverItem(order.item_id, qty);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao entregar.");
    }
  };

  const handleResendEmail = async (order: DashboardOrder) => {
    setResendingId(order.solicitacao_id);
    setError("");
    try {
      await resendConfirmationEmail(order.solicitacao_id);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Falha ao reenviar e-mail.",
      );
    } finally {
      setResendingId(null);
    }
  };

  const handleProof = async (path: string | null) => {
    if (!path) return alert("Solicitação sem comprovante associado.");
    if (/^https?:\/\//i.test(path)) {
      window.open(path, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      window.open(
        await getProofSignedUrl(path),
        "_blank",
        "noopener,noreferrer",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Falha ao abrir comprovante.",
      );
    }
  };

  const handleDeleteStock = async (row: StockRow) => {
    if (
      !window.confirm(
        `Excluir o registro ${row.cor} / ${row.tamanho}? O saldo será zerado e as solicitações cobertas voltarão para reposição.`,
      )
    )
      return;
    try {
      await deleteStockBalance(row.id, "Exclusão/correção pelo dashboard");
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Falha ao excluir estoque.",
      );
    }
  };

  const copyReplenishmentList = async () => {
    if (!replenishmentRows.length) return;
    const lines = [
      `LISTA PARA CONFECÇÃO - ${ENCONTRO_NOME}`,
      "",
      ...replenishmentRows.map(
        (r) => `${r.cor} | ${r.tamanho} | ${r.solicitar_reposicao}`,
      ),
      "",
      `TOTAL: ${totals.comprar} camisa(s)`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      alert(lines.join("\n"));
    }
  };

  if (authenticated === null)
    return <div className="min-h-screen bg-background p-8">Carregando...</div>;
  if (!authenticated) return <Login onLogged={() => setAuthenticated(true)} />;

  return (
    <div className="min-h-screen bg-background p-4 md:p-7">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase text-primary">
              Gestão de Camisas
            </div>
            <h1 className="m-0 mt-1 text-[28px] font-black">
              Dashboard {ENCONTRO_NOME}
            </h1>
            <p className="m-0 mt-1 text-[13px] text-text-muted">
              Solicitação sempre livre. O estoque recebido é direcionado às
              entregas e o que ficar sem cobertura aparece em reposição.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={load}
              className="flex items-center gap-2 rounded-xl border border-border-color bg-white px-3 py-2 text-[12px] font-bold"
            >
              <RefreshCw size={15} /> Atualizar
            </button>
            <button
              onClick={async () => {
                await signOut();
                setAuthenticated(false);
              }}
              className="flex items-center gap-2 rounded-xl border border-border-color bg-white px-3 py-2 text-[12px] font-bold"
            >
              <LogOut size={15} /> Sair
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] font-semibold text-red-700">
            {error}
          </div>
        )}

        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card
            label="Camisas solicitadas"
            value={totals.demanda}
            helper={`${totals.aberto} ainda pendentes de entrega`}
          />
          <Card
            label="Já entregues"
            value={totals.entregue}
            helper="Solicitações já quitadas"
          />
          <Card
            label="Com estoque"
            value={totals.comprometido}
            helper="Pendentes já cobertas e prontas para entrega"
          />
          <Card
            label="Sem estoque / reposição"
            value={totals.comprar}
            helper="Quantidade que precisa ir para confecção"
          />
        </div>

        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {(
            [
              ["visao", "Visão geral"],
              ["solicitacoes", "Solicitações"],
              ["reposicao", "Reposição"],
              ["estoque", "Estoque"],
            ] as Array<[Tab, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-[13px] font-bold ${tab === key ? "bg-primary text-white" : "border border-border-color bg-white text-text-main"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <label className="text-[12px] font-bold text-text-muted">Cor</label>
            <select
              value={colorFilter}
              onChange={(e) => setColorFilter(e.target.value)}
              className="rounded-xl border border-border-color bg-white p-2.5 text-[13px] font-semibold"
            >
              <option value="TODAS">Todas as cores</option>
              {COLORS.map((cor) => (
                <option key={cor} value={cor}>
                  {cor}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[12px] font-bold text-text-muted">
              Tamanho
            </label>
            <select
              value={sizeFilter}
              onChange={(e) => setSizeFilter(e.target.value)}
              className="rounded-xl border border-border-color bg-white p-2.5 text-[13px] font-semibold"
            >
              <option value="TODOS">Todos os tamanhos</option>
              {SIZES.map((tamanho) => (
                <option key={tamanho} value={tamanho}>
                  {tamanho}
                </option>
              ))}
            </select>
          </div>
          {(colorFilter !== "TODAS" || sizeFilter !== "TODOS") && (
            <button
              onClick={() => {
                setColorFilter("TODAS");
                setSizeFilter("TODOS");
              }}
              className="flex w-fit items-center gap-1 rounded-xl border border-border-color bg-white px-3 py-2 text-[12px] font-bold text-text-muted"
            >
              <X size={13} /> Limpar filtro
            </button>
          )}
        </div>

        {loading && (
          <div className="mb-4 rounded-xl border border-border-color bg-white p-3 text-[12px]">
            Atualizando dados...
          </div>
        )}

        {tab === "visao" && (
          <div className="rounded-2xl border border-border-color bg-white overflow-hidden">
            <div className="border-b border-border-color p-4">
              <h2 className="m-0 text-[18px] font-black">
                Situação das solicitações por cor e tamanho
              </h2>
              <p className="m-0 mt-1 text-[12px] text-text-muted">
                Verde representa solicitação coberta por estoque. Laranja
                representa solicitação sem estoque e que deve seguir para
                confecção.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-[12px]">
                <thead>
                  <tr className="bg-[#F7F9FB]">
                    <th className="p-3 text-left">Cor</th>
                    <th className="p-3 text-left">Tamanho</th>
                    <th className="p-3 text-right">Solicitadas</th>
                    <th className="p-3 text-right">Entregues</th>
                    <th className="p-3 text-right">Pendentes</th>
                    <th className="p-3 text-right">Com estoque</th>
                    <th className="p-3 text-right">Sem estoque / reposição</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSummary.map((r) => (
                    <tr
                      key={`${r.cor}-${r.tamanho}`}
                      className="border-t border-border-color"
                    >
                      <td className="p-3 font-bold">{r.cor}</td>
                      <td className="p-3">{r.tamanho}</td>
                      <td className="p-3 text-right">
                        {r.quantidade_solicitada}
                      </td>
                      <td className="p-3 text-right">
                        {r.quantidade_entregue}
                      </td>
                      <td className="p-3 text-right font-bold">
                        {r.demanda_aberta}
                      </td>
                      <td className="p-3 text-right text-[15px] font-black text-success">
                        {r.estoque_comprometido}
                      </td>
                      <td className="p-3 text-right text-[15px] font-black text-[#D97706]">
                        {r.solicitar_reposicao}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredSummary.length && (
                <div className="p-6 text-center text-[13px] text-text-muted">
                  Nenhum item encontrado para os filtros informados.
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "solicitacoes" && (
          <div className="rounded-2xl border border-border-color bg-white overflow-hidden">
            <div className="border-b border-border-color p-4">
              <h2 className="m-0 text-[18px] font-black">
                Solicitações e entregas
              </h2>
              <p className="m-0 mt-1 text-[12px] text-text-muted">
                Toda solicitação é registrada sem consultar estoque. A cobertura
                é feita depois, conforme o recebimento.
              </p>
              <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
                <div className="relative w-full max-w-[520px]">
                  <Search
                    size={15}
                    className="absolute left-3 top-3.5 text-text-muted"
                  />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar solicitante, beneficiário, código, cor ou tamanho"
                    className="w-full rounded-xl border border-border-color p-3 pl-9 text-[13px]"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as StatusFilter)
                  }
                  className="rounded-xl border border-border-color bg-white p-3 text-[13px] font-semibold"
                >
                  <option value="TODOS">Todos os status</option>
                  <option value="PENDENTE_REPOSICAO">
                    Sem estoque - solicitar reposição
                  </option>
                  <option value="PARCIALMENTE_COBERTO">Estoque parcial</option>
                  <option value="PRONTO_ENTREGA">
                    Com estoque - pronto para entregar
                  </option>
                  <option value="PARCIALMENTE_ENTREGUE">
                    Parcialmente entregue
                  </option>
                  <option value="ENTREGUE">Entregue</option>
                  <option value="CANCELADO">Cancelado</option>
                </select>
                <button
                  onClick={exportOrdersCsv}
                  disabled={!filteredOrders.length}
                  className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-[12px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Download size={15} /> Exportar CSV ({filteredOrders.length})
                </button>
              </div>
              <div className="mt-2 text-[11px] text-text-muted">
                A exportação respeita a busca e o filtro de status atualmente
                selecionados.
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1240px] border-collapse text-[12px]">
                <thead>
                  <tr className="bg-[#F7F9FB]">
                    <th className="p-3 text-left">Solicitante</th>
                    <th className="p-3 text-left">Beneficiário</th>
                    <th className="p-3 text-left">Item</th>
                    <th className="p-3 text-right">Solicitado</th>
                    <th className="p-3 text-right">Coberto</th>
                    <th className="p-3 text-right">Entregue</th>
                    <th className="p-3 text-right">Sem cobertura</th>
                    <th className="p-3 text-left">Situação do item</th>
                    <th className="p-3 text-left">Status solicitação</th>
                    <th className="p-3 text-left">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((o) => {
                    const rowClass =
                      o.status_item === "PENDENTE_REPOSICAO"
                        ? "border-t border-border-color bg-orange-50"
                        : o.status_item === "PRONTO_ENTREGA" ||
                            o.status_item === "PARCIALMENTE_COBERTO"
                          ? "border-t border-border-color bg-green-50"
                          : "border-t border-border-color";
                    const statusClass =
                      o.status_item === "PENDENTE_REPOSICAO"
                        ? "inline-flex rounded-full bg-orange-100 px-2 py-1 text-[11px] font-black text-orange-800"
                        : o.status_item === "PRONTO_ENTREGA" ||
                            o.status_item === "PARCIALMENTE_COBERTO"
                          ? "inline-flex rounded-full bg-green-100 px-2 py-1 text-[11px] font-black text-green-800"
                          : "inline-flex rounded-full bg-gray-100 px-2 py-1 text-[11px] font-bold text-gray-700";
                    return (
                      <tr key={o.item_id} className={rowClass}>
                        <td className="p-3">
                          <div className="font-bold">{o.nome_solicitante}</div>
                          <div className="text-[10px] font-bold text-primary">
                            {o.codigo || o.solicitacao_id.slice(0, 8)}
                          </div>
                          <div className="text-[10px] text-text-muted">
                            {o.eh_encontreiro ? "Encontreiro" : "Externo"}{" "}
                            {o.equipe ? `• ${o.equipe}` : ""}
                          </div>
                          <div
                            className={`mt-1 text-[10px] font-bold ${o.email_confirmacao_enviada_em ? "text-success" : o.email_confirmacao_erro ? "text-danger" : "text-text-muted"}`}
                          >
                            {o.email_solicitante
                              ? o.email_confirmacao_enviada_em
                                ? "E-mail enviado"
                                : o.email_confirmacao_erro
                                  ? "E-mail com falha"
                                  : "E-mail pendente"
                              : "Sem e-mail informado"}
                          </div>
                        </td>
                        <td className="p-3 font-semibold">
                          {o.nome_beneficiario}
                        </td>
                        <td className="p-3">
                          {o.cor} / {o.tamanho}
                        </td>
                        <td className="p-3 text-right">
                          {o.quantidade_solicitada}
                        </td>
                        <td className="p-3 text-right font-bold text-success">
                          {o.quantidade_reservada}
                        </td>
                        <td className="p-3 text-right">
                          {o.quantidade_entregue}
                        </td>
                        <td className="p-3 text-right font-bold text-[#D97706]">
                          {o.quantidade_sem_cobertura}
                        </td>
                        <td className="p-3">
                          <span className={statusClass}>
                            {STATUS_LABELS[o.status_item] || o.status_item}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-[11px] font-bold ${o.status_solicitacao === "CANCELADA" ? "bg-red-100 text-red-700" : o.status_solicitacao === "CONCLUIDA" ? "bg-green-100 text-green-800" : "bg-blue-50 text-primary"}`}
                          >
                            {o.status_solicitacao === "CONCLUIDA"
                              ? "Concluída"
                              : o.status_solicitacao === "CANCELADA"
                                ? "Cancelada"
                                : "Aberta"}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => handleProof(o.comprovante_path)}
                              className="rounded-lg border border-border-color bg-white px-2 py-1.5 font-bold"
                            >
                              Comprovante
                            </button>
                            <button
                              onClick={() => {
                                setEditingOrderItem(o);
                                setItemDrawerOpen(true);
                              }}
                              className="rounded-lg border border-border-color bg-white px-2 py-1.5 font-bold"
                            >
                              Alterar camisa
                            </button>
                            <button
                              onClick={() => {
                                setStatusOrder(o);
                                setStatusDrawerOpen(true);
                              }}
                              className="rounded-lg border border-border-color bg-white px-2 py-1.5 font-bold"
                            >
                              Alterar status
                            </button>
                            {Number(o.quantidade_pendente) > 0 &&
                              Number(o.quantidade_reservada) > 0 &&
                              o.status_solicitacao !== "CANCELADA" && (
                                <button
                                  onClick={() => handleDeliver(o)}
                                  className="rounded-lg bg-primary px-2 py-1.5 font-bold text-white"
                                >
                                  Entregar
                                </button>
                              )}
                            {o.email_solicitante &&
                              !o.email_confirmacao_enviada_em && (
                                <button
                                  onClick={() => handleResendEmail(o)}
                                  disabled={resendingId === o.solicitacao_id}
                                  className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 font-bold text-primary disabled:opacity-50"
                                >
                                  {resendingId === o.solicitacao_id
                                    ? "Reenviando..."
                                    : "Reenviar e-mail"}
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!filteredOrders.length && (
                <div className="p-6 text-center text-[13px] text-text-muted">
                  Nenhuma solicitação encontrada para os filtros informados.
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "reposicao" && (
          <div className="rounded-2xl border border-border-color bg-white overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-border-color p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="m-0 text-[18px] font-black">
                  Lista para confecção
                </h2>
                <p className="m-0 mt-1 text-[12px] text-text-muted">
                  Mostra somente as solicitações que ainda não possuem cobertura
                  no estoque recebido.
                </p>
              </div>
              <button
                onClick={copyReplenishmentList}
                disabled={!replenishmentRows.length}
                className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-[12px] font-bold text-white disabled:opacity-40"
              >
                <ClipboardCopy size={15} />{" "}
                {copied ? "Lista copiada" : "Copiar lista"}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-[13px]">
                <thead>
                  <tr className="bg-[#F7F9FB]">
                    <th className="p-3 text-left">Cor</th>
                    <th className="p-3 text-left">Tamanho</th>
                    <th className="p-3 text-right">Qtd para confecção</th>
                  </tr>
                </thead>
                <tbody>
                  {replenishmentRows.map((r) => (
                    <tr
                      key={`${r.cor}-${r.tamanho}`}
                      className="border-t border-border-color bg-orange-50"
                    >
                      <td className="p-3 font-bold">{r.cor}</td>
                      <td className="p-3 font-bold">{r.tamanho}</td>
                      <td className="p-3 text-right text-[18px] font-black text-[#D97706]">
                        {r.solicitar_reposicao}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!replenishmentRows.length && (
                <div className="p-6 text-center text-[13px] text-text-muted">
                  Nenhuma reposição necessária neste momento.
                </div>
              )}
            </div>
            <div className="border-t border-border-color bg-[#F7F9FB] p-4 text-right text-[14px] font-black">
              Total para confecção: {totals.comprar}
            </div>
          </div>
        )}

        {tab === "estoque" && (
          <div className="rounded-2xl border border-border-color bg-white overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-border-color p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="m-0 text-[18px] font-black">Estoque recebido</h2>
                <p className="m-0 mt-1 text-[12px] text-text-muted">
                  Saldo físico atual. O sistema separa o que já está
                  comprometido com solicitações e o que ainda está livre.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingStock(null);
                  setStockDrawerOpen(true);
                }}
                className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-[12px] font-bold text-white"
              >
                <PackagePlus size={15} /> Registrar recebimento
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-[13px]">
                <thead>
                  <tr className="bg-[#F7F9FB]">
                    <th className="p-3 text-left">Cor</th>
                    <th className="p-3 text-left">Tamanho</th>
                    <th className="p-3 text-right">Saldo físico</th>
                    <th className="p-3 text-right">
                      Direcionado às solicitações
                    </th>
                    <th className="p-3 text-right">Livre</th>
                    <th className="p-3 text-left">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStock.map((s) => {
                    const c = stockCoverage(s);
                    return (
                      <tr key={s.id} className="border-t border-border-color">
                        <td className="p-3 font-bold">{s.cor}</td>
                        <td className="p-3">{s.tamanho}</td>
                        <td className="p-3 text-right text-[17px] font-black">
                          {s.quantidade_fisica}
                        </td>
                        <td className="p-3 text-right font-bold text-success">
                          {c?.estoque_comprometido || 0}
                        </td>
                        <td className="p-3 text-right">
                          {c?.estoque_disponivel || 0}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingStock(s);
                                setStockDrawerOpen(true);
                              }}
                              className="flex items-center gap-1 rounded-lg border border-border-color px-2 py-1.5 font-bold"
                            >
                              <Pencil size={13} /> Editar
                            </button>
                            <button
                              onClick={() => handleDeleteStock(s)}
                              className="flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1.5 font-bold text-danger"
                            >
                              <Trash2 size={13} /> Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!filteredStock.length && (
                <div className="p-6 text-center text-[13px] text-text-muted">
                  Nenhum recebimento de estoque encontrado para os filtros
                  informados.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <StockDrawer
        open={stockDrawerOpen}
        stock={stock}
        editing={editingStock}
        onClose={() => {
          setStockDrawerOpen(false);
          setEditingStock(null);
        }}
        onSaved={load}
      />
      <StatusDrawer
        open={statusDrawerOpen}
        order={statusOrder}
        onClose={() => {
          setStatusDrawerOpen(false);
          setStatusOrder(null);
        }}
        onSaved={load}
      />
      <ItemDrawer
        open={itemDrawerOpen}
        order={editingOrderItem}
        onClose={() => {
          setItemDrawerOpen(false);
          setEditingOrderItem(null);
        }}
        onSaved={load}
      />
    </div>
  );
}
