export const SIZES = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'];
export const COLORS = ['Branca', 'Azul', 'Preta'];

export const TEAMS = [
  'Banda',
  'Visitação',
  'Meditação',
  'Ordem e Limpeza/Montagem',
  'Garçom',
  'Cozinha',
  'Sala',
  'Compras',
  'Minibar',
  'Liturgia/Vigília',
  'Portaria',
  'Outro'
];

export const MOCK_STOCK = [
  { tamanho: 'P', cor: 'Branca', quantidade: 10, reserva: 2, disponivel: 8, solicitacoes: 1, reservados: 1, alternativas: 0, reposicoes: 0 },
  { tamanho: 'M', cor: 'Branca', quantidade: 12, reserva: 2, disponivel: 10, solicitacoes: 0, reservados: 0, alternativas: 0, reposicoes: 0 },
  { tamanho: 'G', cor: 'Branca', quantidade: 5, reserva: 1, disponivel: 4, solicitacoes: 2, reservados: 2, alternativas: 1, reposicoes: 0 },
  { tamanho: 'M', cor: 'Azul', quantidade: 5, reserva: 0, disponivel: 5, solicitacoes: 0, reservados: 0, alternativas: 0, reposicoes: 0 },
  { tamanho: 'G', cor: 'Azul', quantidade: 4, reserva: 0, disponivel: 4, solicitacoes: 3, reservados: 3, alternativas: 0, reposicoes: 0 },
  { tamanho: 'GG', cor: 'Preta', quantidade: 3, reserva: 3, disponivel: 0, solicitacoes: 5, reservados: 0, alternativas: 2, reposicoes: 3 }
];

export interface ShirtItem {
  id: string;
  color: string;
  size: string;
  quantity: number;
  acceptAlternativeSize: boolean;
  acceptAlternativeColor: boolean;
}
