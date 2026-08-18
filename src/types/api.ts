export type ShirtItemInput = {
  cor: string;
  tamanho: string;
  quantidade: number;
};

export type EncontreiroOption = {
  pessoa_id: string;
  nome_completo: string;
};

export type SubmitOrderPayload = {
  encontroId: string;
  ehEncontreiro: boolean;
  solicitantePessoaId: string | null;
  nomeSolicitante: string;
  telefoneSolicitante: string | null;
  emailSolicitante: string | null;
  equipe: string | null;
  beneficiarioPessoaId: string | null;
  nomeBeneficiario: string;
  observacoes: string | null;
  comprovantePath: string;
  comprovanteNome: string;
  comprovanteTipo: string;
  comprovanteTamanho: number;
  valorTotal: number;
  items: ShirtItemInput[];
};

export type SubmitOrderResult = {
  success: boolean;
  request_id: string;
  codigo: string;
  status: string;
  email_dispatch_token: string | null;
  email_solicitante: string | null;
};

export type DashboardSummaryRow = {
  encontro_id: string;
  encontro_nome: string;
  cor: string;
  tamanho: string;
  estoque_fisico: number;
  estoque_comprometido: number;
  estoque_disponivel: number;
  quantidade_solicitada: number;
  quantidade_entregue: number;
  demanda_aberta: number;
  em_reposicao: number;
  pronto_para_entrega: number;
  solicitar_reposicao: number;
};

export type DashboardOrder = {
  solicitacao_id: string;
  codigo: string | null;
  criado_em: string;
  encontro_id: string;
  encontro_nome: string;
  eh_encontreiro: boolean;
  nome_solicitante: string;
  telefone_solicitante: string | null;
  email_solicitante: string | null;
  equipe: string | null;
  nome_beneficiario: string;
  status_solicitacao: string;
  comprovante_path: string | null;
  email_confirmacao_enviada_em: string | null;
  email_confirmacao_erro: string | null;
  item_id: string;
  cor: string;
  tamanho: string;
  quantidade_solicitada: number;
  quantidade_entregue: number;
  quantidade_reservada: number;
  quantidade_pendente: number;
  quantidade_sem_cobertura: number;
  status_item: string;
};

export type Replenishment = {
  reposicao_id: string;
  encontro_id: string | null;
  encontro_nome: string | null;
  criado_em: string;
  status_reposicao: string;
  fornecedor: string | null;
  item_id: string;
  cor: string;
  tamanho: string;
  quantidade_pedida: number;
  quantidade_recebida: number;
  quantidade_pendente: number;
};

export type StockRow = {
  id: string;
  cor: string;
  tamanho: string;
  quantidade_fisica: number;
  estoque_minimo: number;
  ativo: boolean;
};
