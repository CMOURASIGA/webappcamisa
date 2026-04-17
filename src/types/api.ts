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

export interface DashboardData {
  logoUrl: string;
  instagramUrl: string;
  atualizadoEm: string;
  indicadores: {
    totalFisico: number;
    totalReserva: number;
    totalDisponivel: number;
    totalPretaDisponivel: number;
    totalAzulDisponivel: number;
    totalReservados: number;
    totalAlternativa: number;
    totalReposicao: number;
  };
  tabelaGerencial: DashboardRow[];
}
