import { supabase } from "../lib/supabase";
import type {
  DashboardOrder,
  DashboardSummaryRow,
  EncontreiroOption,
  Replenishment,
  StockRow,
  SubmitOrderPayload,
  SubmitOrderResult,
} from "../types/api";

const BUCKET = "camisas-comprovantes";

export async function searchEncontreiros(
  term: string,
): Promise<EncontreiroOption[]> {
  const clean = term.trim();
  if (clean.length < 3) return [];

  const { data, error } = await supabase.rpc(
    "camisa_buscar_encontreiros_publico",
    {
      p_termo: clean,
    },
  );
  if (error) throw new Error(error.message);
  return (data || []) as EncontreiroOption[];
}

export async function uploadProof(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `public/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw new Error(`Falha ao enviar comprovante: ${error.message}`);
  return path;
}

export async function submitOrder(
  payload: SubmitOrderPayload,
): Promise<SubmitOrderResult> {
  const { data, error } = await supabase.rpc(
    "camisa_registrar_solicitacao_publica",
    {
      p_encontro_id: payload.encontroId,
      p_eh_encontreiro: payload.ehEncontreiro,
      p_solicitante_pessoa_id: payload.solicitantePessoaId,
      p_nome_solicitante: payload.nomeSolicitante,
      p_telefone_solicitante: payload.telefoneSolicitante,
      p_email_solicitante: payload.emailSolicitante,
      p_equipe: payload.equipe,
      p_beneficiario_pessoa_id: payload.beneficiarioPessoaId,
      p_nome_beneficiario: payload.nomeBeneficiario,
      p_observacoes: payload.observacoes,
      p_comprovante_path: payload.comprovantePath,
      p_comprovante_nome: payload.comprovanteNome,
      p_comprovante_tipo: payload.comprovanteTipo,
      p_comprovante_tamanho: payload.comprovanteTamanho,
      p_valor_total: payload.valorTotal,
      p_itens: payload.items,
    },
  );
  if (error) throw new Error(error.message);
  return data as SubmitOrderResult;
}

export async function sendConfirmationEmail(
  requestId: string,
  dispatchToken: string,
) {
  const { data, error } = await supabase.functions.invoke("camisa-email", {
    body: { request_id: requestId, dispatch_token: dispatchToken },
  });
  if (error) throw new Error(error.message);
  if (data?.success === false)
    throw new Error(data.error || "Falha ao enviar e-mail.");
  return data;
}

// Gera um novo token de disparo (o anterior é de uso único) e reenvia a confirmação por e-mail.
// Usado pelo dashboard quando a solicitação ficou com "E-mail com falha" ou "E-mail pendente".
export async function resendConfirmationEmail(requestId: string) {
  const { data, error } = await supabase.rpc(
    "camisa_gerar_token_reenvio_email",
    {
      p_solicitacao_id: requestId,
    },
  );
  if (error) throw new Error(error.message);
  const dispatchToken = data?.dispatch_token;
  if (!dispatchToken)
    throw new Error("Não foi possível gerar o token de reenvio.");
  return sendConfirmationEmail(requestId, dispatchToken);
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function fetchDashboardSummary(
  encontroId: string,
): Promise<DashboardSummaryRow[]> {
  const { data, error } = await supabase
    .from("vw_camisa_dashboard")
    .select("*")
    .eq("encontro_id", encontroId)
    .order("cor")
    .order("tamanho");
  if (error) throw new Error(error.message);
  return (data || []) as DashboardSummaryRow[];
}

export async function fetchOrders(
  encontroId: string,
): Promise<DashboardOrder[]> {
  const { data, error } = await supabase
    .from("vw_camisa_solicitacoes_detalhes")
    .select("*")
    .eq("encontro_id", encontroId)
    .order("criado_em", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as DashboardOrder[];
}

export async function fetchReplenishments(
  encontroId: string,
): Promise<Replenishment[]> {
  const { data, error } = await supabase
    .from("vw_camisa_reposicoes_detalhes")
    .select("*")
    .eq("encontro_id", encontroId)
    .order("criado_em", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as Replenishment[];
}

export async function fetchStock(): Promise<StockRow[]> {
  const { data, error } = await supabase
    .from("camisa_estoque")
    .select("*")
    .eq("ativo", true)
    .order("cor")
    .order("tamanho");
  if (error) throw new Error(error.message);
  return (data || []) as StockRow[];
}

export async function createReplenishment(
  encontroId: string,
  items: Array<{ cor: string; tamanho: string; quantidade: number }>,
) {
  const { data, error } = await supabase.rpc("camisa_criar_reposicao", {
    p_encontro_id: encontroId,
    p_itens: items,
    p_observacoes: "Criada pelo dashboard",
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function receiveReplenishment(itemId: string, quantity: number) {
  const { data, error } = await supabase.rpc("camisa_receber_reposicao", {
    p_reposicao_item_id: itemId,
    p_quantidade: quantity,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function deliverItem(itemId: string, quantity: number) {
  const { data, error } = await supabase.rpc("camisa_entregar_item", {
    p_solicitacao_item_id: itemId,
    p_quantidade: quantity,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function updateOrderItem(
  itemId: string,
  cor: string,
  tamanho: string,
  reason: string,
) {
  const { data, error } = await supabase.rpc(
    "camisa_alterar_item_solicitacao",
    {
      p_solicitacao_item_id: itemId,
      p_cor: cor,
      p_tamanho: tamanho,
      p_motivo: reason,
    },
  );
  if (error) throw new Error(error.message);
  return data;
}

export async function updateOrderStatus(
  requestId: string,
  status: "ABERTA" | "CONCLUIDA" | "CANCELADA",
) {
  const { data, error } = await supabase.rpc(
    "camisa_alterar_status_solicitacao",
    {
      p_solicitacao_id: requestId,
      p_status: status,
    },
  );
  if (error) throw new Error(error.message);
  return data;
}

export async function registerStockReceipt(
  cor: string,
  tamanho: string,
  quantity: number,
  note: string,
) {
  const { data, error } = await supabase.rpc("camisa_ajustar_estoque", {
    p_cor: cor,
    p_tamanho: tamanho,
    p_quantidade: quantity,
    p_tipo: "ENTRADA",
    p_observacoes: note,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function adjustStock(
  cor: string,
  tamanho: string,
  quantity: number,
  kind: "ENTRADA" | "SAIDA",
  note: string,
) {
  const { data, error } = await supabase.rpc("camisa_ajustar_estoque", {
    p_cor: cor,
    p_tamanho: tamanho,
    p_quantidade: quantity,
    p_tipo: kind,
    p_observacoes: note,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function setStockBalance(
  stockId: string,
  quantity: number,
  note: string,
) {
  const { data, error } = await supabase.rpc("camisa_definir_estoque", {
    p_estoque_id: stockId,
    p_quantidade: quantity,
    p_observacoes: note,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteStockBalance(stockId: string, note: string) {
  const { data, error } = await supabase.rpc("camisa_excluir_estoque", {
    p_estoque_id: stockId,
    p_observacoes: note,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function getProofSignedUrl(path: string) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 300);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
