export interface StockOptionRow {
  tamanho: string;
  cor: string;
  quantidade: number;
  reserva: number;
  disponivel: number;
}

export interface BootstrapData {
  logoUrl: string;
  instagramUrl: string;
  allowedExtensions: string[];
  stockOptions: {
    colors: string[];
    specificReserveColors?: string[];
    rows: StockOptionRow[];
  };
}

export interface SubmitOrderItem {
  tamanho: string;
  cor: string;
  quantidade: number;
  aceitaTamanhoAlternativo: boolean;
  aceitaOutraCor: boolean;
}

export interface SubmitOrderPayload {
  nomeCompleto: string;
  email: string;
  equipe: string;
  clienteEspecificoReserva?: boolean;
  motivoExcecaoReserva?: string;
  items: SubmitOrderItem[];
  proofFile: {
    name: string;
    type: string;
    size: number;
    base64: string;
  };
}

export interface SubmitOrderResult {
  success: boolean;
  requestId: string;
  statusGeral: string;
  observacaoGeral: string;
  proofUrl: string;
  message: string;
}

export interface DashboardRow {
  tamanho: string;
  cor: string;
  quantidade: number;
  reserva: number;
  disponivel: number;
  solicitacoes: number;
  reservados: number;
  alternativas: number;
  reposicoes: number;
}

export interface DashboardOrderItem {
  ordemItem: number;
  tamanho: string;
  cor: string;
  quantidadeSolicitada: number;
  quantidadeAtendida: number;
  statusItem: string;
  alternativaSugerida: string;
  statusEntregaItem?: string;
  entregueItemEm?: string;
}

export interface SettleReplenishmentResult {
  success: boolean;
  requestId: string;
  ordemItem: number;
  statusItem: string;
  quantidadeRecebida: number;
  estoqueAtualizado: {
    tamanho: string;
    cor: string;
    quantidade: number;
    disponivel: number;
  };
  updatedAt: string;
}

export interface DashboardOrder {
  requestId: string;
  dataHora: string;
  nomeCompleto: string;
  email: string;
  equipe: string;
  resumoPedido: string;
  statusGeral: string;
  statusEntrega: string;
  entregueEm: string;
  items: DashboardOrderItem[];
}

export interface DashboardData {
  logoUrl: string;
  instagramUrl: string;
  atualizadoEm: string;
  indicadores: {
    totalFisico: number;
    totalReserva: number;
    totalDisponivel: number;
    totalDisponivelReal: number;
    totalDisponivelGap: number;
    totalBrancaDisponivel: number;
    totalPretaDisponivel: number;
    totalAzulDisponivel: number;
    totalReservados: number;
    totalAlternativa: number;
    totalReposicao: number;
    totalCamisasAEntregar: number;
    totalCamisasEntregues: number;
    totalCamisasPendentesEntrega: number;
  };
  tabelaGerencial: DashboardRow[];
  pedidos: DashboardOrder[];
}
