export const SIZES = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'];
export const COLOR_OPTIONS = [
  { value: 'Branca', label: 'Branca - Oficial' },
  { value: 'Azul', label: 'Azul - Oficial' },
  { value: 'Preta', label: 'Preta - 36º EAC' },
  { value: 'Marrom', label: 'Marrom - 37º EAC' },
];

export const COLORS = COLOR_OPTIONS.map((option) => option.value);

export const getColorLabel = (color: string) =>
  COLOR_OPTIONS.find((option) => option.value === color)?.label ||
  (color === 'Preta - EAC 36' ? 'Preta - 36º EAC' : color);

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
  { tamanho: 'P', cor: 'Branca', quantidade: 10, reserva: 0, disponivel: 10, solicitacoes: 1, reservados: 1, alternativas: 0, reposicoes: 0 },
  { tamanho: 'M', cor: 'Branca', quantidade: 0, reserva: 0, disponivel: 0, solicitacoes: 2, reservados: 0, alternativas: 0, reposicoes: 2 },
  { tamanho: 'G', cor: 'Branca', quantidade: 5, reserva: 0, disponivel: 5, solicitacoes: 2, reservados: 2, alternativas: 0, reposicoes: 0 },
  { tamanho: 'M', cor: 'Azul', quantidade: 5, reserva: 0, disponivel: 5, solicitacoes: 0, reservados: 0, alternativas: 0, reposicoes: 0 },
  { tamanho: 'G', cor: 'Azul', quantidade: 1, reserva: 0, disponivel: 1, solicitacoes: 3, reservados: 1, alternativas: 0, reposicoes: 2 },
  { tamanho: 'GG', cor: 'Marrom', quantidade: 0, reserva: 0, disponivel: 0, solicitacoes: 5, reservados: 0, alternativas: 0, reposicoes: 5 }
];

export interface ShirtItem {
  id: string;
  color: string;
  size: string;
  quantity: number;
  acceptAlternativeSize: boolean;
  acceptAlternativeColor: boolean;
}
