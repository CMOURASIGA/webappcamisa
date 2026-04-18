import { useEffect, useMemo, useRef, useState } from 'react';
import { MOCK_STOCK } from '../data/mockData';
import { fetchDashboardData, isMockApiEnabled, markOrderDelivered } from '../services/api';
import type { DashboardData, DashboardOrder } from '../types/api';

function buildMockDashboardData(): DashboardData {
  const totalFisico = MOCK_STOCK.reduce((acc, curr) => acc + curr.quantidade, 0);
  const totalReserva = MOCK_STOCK.reduce((acc, curr) => acc + curr.reserva, 0);
  const totalDisponivel = MOCK_STOCK.reduce((acc, curr) => acc + curr.disponivel, 0);
  const totalReservados = MOCK_STOCK.reduce((acc, curr) => acc + curr.reservados, 0);

  const totalBrancaDisponivel = MOCK_STOCK.filter((s) => s.cor === 'Branca').reduce((acc, curr) => acc + curr.disponivel, 0);
  const totalPretaDisponivel = MOCK_STOCK.filter((s) => s.cor === 'Preta').reduce((acc, curr) => acc + curr.disponivel, 0);
  const totalAzulDisponivel = MOCK_STOCK.filter((s) => s.cor === 'Azul').reduce((acc, curr) => acc + curr.disponivel, 0);

  const totalAlternativa = MOCK_STOCK.reduce((acc, curr) => acc + curr.alternativas, 0);
  const totalReposicao = MOCK_STOCK.reduce((acc, curr) => acc + curr.reposicoes, 0);

  return {
    logoUrl: '',
    instagramUrl: 'https://www.instagram.com/eacporciunculadesantana/',
    atualizadoEm: 'Mock local',
    indicadores: {
      totalFisico,
      totalReserva,
      totalDisponivel,
      totalBrancaDisponivel,
      totalPretaDisponivel,
      totalAzulDisponivel,
      totalReservados,
      totalAlternativa,
      totalReposicao,
    },
    tabelaGerencial: MOCK_STOCK.map((row) => ({
      tamanho: row.tamanho,
      cor: row.cor,
      quantidade: row.quantidade,
      reserva: row.reserva,
      disponivel: row.disponivel,
      solicitacoes: row.solicitacoes,
      reservados: row.reservados,
      alternativas: row.alternativas,
      reposicoes: row.reposicoes,
    })),
    pedidos: [
      {
        requestId: 'SOL-20260416-101000',
        dataHora: '16/04/2026 10:10:00',
        nomeCompleto: 'Maria Souza',
        email: 'maria@email.com',
        equipe: 'Banda',
        resumoPedido: '1x P | Branca [RESERVADO] ; 1x M | Azul [RESERVADO]',
        statusGeral: 'RESERVADO',
        statusEntrega: 'PENDENTE',
        entregueEm: '',
        items: [
          { tamanho: 'P', cor: 'Branca', quantidadeSolicitada: 1, quantidadeAtendida: 1, statusItem: 'RESERVADO', alternativaSugerida: '' },
          { tamanho: 'M', cor: 'Azul', quantidadeSolicitada: 1, quantidadeAtendida: 1, statusItem: 'RESERVADO', alternativaSugerida: '' },
        ],
      },
      {
        requestId: 'SOL-20260416-111500',
        dataHora: '16/04/2026 11:15:00',
        nomeCompleto: 'Joao Lima',
        email: 'joao@email.com',
        equipe: 'Sala',
        resumoPedido: '2x GG | Preta [SUGERIR ALTERNATIVA]',
        statusGeral: 'SUGERIR ALTERNATIVA',
        statusEntrega: 'ENTREGUE',
        entregueEm: '16/04/2026 18:42:00',
        items: [
          { tamanho: 'GG', cor: 'Preta', quantidadeSolicitada: 2, quantidadeAtendida: 0, statusItem: 'SUGERIR ALTERNATIVA', alternativaSugerida: 'XG | Preta' },
        ],
      },
    ],
  };
}

type FilterIndicator = 
  | 'totalFisico'
  | 'totalReserva'
  | 'totalDisponivel'
  | 'totalBrancaDisponivel'
  | 'totalPretaDisponivel'
  | 'totalAzulDisponivel'
  | 'totalReservados'
  | 'totalAlternativa'
  | 'totalReposicao'
  | null;

type IndicatorKey = Exclude<FilterIndicator, null>;

type IndicatorConfig = {
  label: string;
  title: string;
  description: string;
  filterRows: (rows: DashboardData['tabelaGerencial']) => DashboardData['tabelaGerencial'];
  getValue: (rows: DashboardData['tabelaGerencial']) => number;
};

const sumBy = (rows: DashboardData['tabelaGerencial'], selector: (row: DashboardData['tabelaGerencial'][number]) => number) =>
  rows.reduce((acc, row) => acc + selector(row), 0);

const normalizeColor = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const isWhiteColor = (value: string) => {
  const normalized = normalizeColor(value);
  return normalized === 'branca' || normalized === 'branco' || normalized === 'white';
};

const INDICATOR_ORDER: IndicatorKey[] = [
  'totalFisico',
  'totalReserva',
  'totalDisponivel',
  'totalReservados',
  'totalBrancaDisponivel',
  'totalPretaDisponivel',
  'totalAzulDisponivel',
  'totalAlternativa',
  'totalReposicao',
];

const INDICATOR_CONFIG: Record<IndicatorKey, IndicatorConfig> = {
  totalFisico: {
    label: 'Estoque Fisico Total',
    title: 'Estoque Fisico Total',
    description: 'Mostrando tamanhos/cores com estoque fisico acima de zero.',
    filterRows: (rows) => rows.filter((row) => row.quantidade > 0),
    getValue: (rows) => sumBy(rows, (row) => row.quantidade),
  },
  totalReserva: {
    label: 'Reserva Brinde Total',
    title: 'Reserva Brinde Total',
    description: 'Filtrando apenas os tamanhos/cores que possuem camisas reservadas como brinde.',
    filterRows: (rows) => rows.filter((row) => row.reserva > 0),
    getValue: (rows) => sumBy(rows, (row) => row.reserva),
  },
  totalDisponivel: {
    label: 'Disponivel Total',
    title: 'Disponivel Total',
    description: 'Filtrando apenas os tamanhos/cores que possuem camisas disponiveis para venda.',
    filterRows: (rows) => rows.filter((row) => row.disponivel > 0),
    getValue: (rows) => sumBy(rows, (row) => row.disponivel),
  },
  totalBrancaDisponivel: {
    label: 'Disponivel Branca',
    title: 'Disponivel Brancas',
    description: 'Filtrando apenas camisas BRANCAS que estao disponiveis para venda.',
    filterRows: (rows) => rows.filter((row) => isWhiteColor(row.cor) && row.disponivel > 0),
    getValue: (rows) => sumBy(rows.filter((row) => isWhiteColor(row.cor)), (row) => row.disponivel),
  },
  totalPretaDisponivel: {
    label: 'Disponivel Preta',
    title: 'Disponivel Pretas',
    description: 'Filtrando apenas camisas PRETAS que estao disponiveis para venda.',
    filterRows: (rows) => rows.filter((row) => row.cor === 'Preta' && row.disponivel > 0),
    getValue: (rows) => sumBy(rows.filter((row) => row.cor === 'Preta'), (row) => row.disponivel),
  },
  totalAzulDisponivel: {
    label: 'Disponivel Azul',
    title: 'Disponivel Azuis',
    description: 'Filtrando apenas camisas AZUIS que estao disponiveis para venda.',
    filterRows: (rows) => rows.filter((row) => row.cor === 'Azul' && row.disponivel > 0),
    getValue: (rows) => sumBy(rows.filter((row) => row.cor === 'Azul'), (row) => row.disponivel),
  },
  totalReservados: {
    label: 'Pedidos Reservados',
    title: 'Pedidos Reservados',
    description: 'Filtrando apenas os tamanhos/cores que possuem pedidos em status RESERVADO.',
    filterRows: (rows) => rows.filter((row) => row.reservados > 0),
    getValue: (rows) => sumBy(rows, (row) => row.reservados),
  },
  totalAlternativa: {
    label: 'Pedidos c/ Alternativa',
    title: 'Pedidos c/ Alternativa',
    description: 'Filtrando apenas os tamanhos/cores com pedidos aguardando resposta sobre alternativa.',
    filterRows: (rows) => rows.filter((row) => row.alternativas > 0),
    getValue: (rows) => sumBy(rows, (row) => row.alternativas),
  },
  totalReposicao: {
    label: 'Pedidos em Reposicao',
    title: 'Pedidos em Reposicao',
    description: 'Filtrando apenas os tamanhos/cores com pedidos em status de REPOSICAO.',
    filterRows: (rows) => rows.filter((row) => row.reposicoes > 0),
    getValue: (rows) => sumBy(rows, (row) => row.reposicoes),
  },
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'detalhamento' | 'pedidos'>('detalhamento');
  const [searchName, setSearchName] = useState('');
  const [deliveringId, setDeliveringId] = useState<string | null>(null);
  const [filterIndicator, setFilterIndicator] = useState<FilterIndicator>(null);
  const lastPointerToggleAtRef = useRef(0);
  const LOGO_URL = 'https://i.imgur.com/c5XQ7TW.jpg';

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      if (isMockApiEnabled()) {
        setData(buildMockDashboardData());
        return;
      }

      const result = await fetchDashboardData();
      setData(result);
    } catch (err) {
      setData(buildMockDashboardData());
      setError(err instanceof Error ? `${err.message} Exibindo dados mock.` : 'Falha no dashboard. Exibindo dados mock.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const getStockClass = (value: number) => {
    if (value <= 2) return 'text-danger font-bold';
    if (value <= 5) return 'text-[#b45309] font-bold';
    return 'text-success font-bold';
  };

  const normalizeText = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const filteredTable = useMemo(() => {
    if (!data) return [];
    if (!filterIndicator) return data.tabelaGerencial;
    return INDICATOR_CONFIG[filterIndicator].filterRows(data.tabelaGerencial);
  }, [data, filterIndicator]);

  const indicatorValues = useMemo(() => {
    const rows = data?.tabelaGerencial ?? [];
    return INDICATOR_ORDER.reduce((acc, indicator) => {
      acc[indicator] = INDICATOR_CONFIG[indicator].getValue(rows);
      return acc;
    }, {} as Record<IndicatorKey, number>);
  }, [data]);

  const activeFilterInfo = filterIndicator ? INDICATOR_CONFIG[filterIndicator] : null;
  const activeIndicatorValue = filterIndicator ? INDICATOR_CONFIG[filterIndicator].getValue(filteredTable) : null;

  const toggleIndicatorFilter = (indicator: IndicatorKey) => {
    setFilterIndicator((prev) => (prev === indicator ? null : indicator));
  };

  const triggerIndicatorFilter = (source: 'pointer' | 'click', indicator: IndicatorKey) => {
    const now = Date.now();

    // Pointer up is often followed by click, so ignore the duplicated click toggle.
    if (source === 'click' && now - lastPointerToggleAtRef.current < 250) {
      return;
    }

    if (source === 'pointer') {
      lastPointerToggleAtRef.current = now;
    }

    toggleIndicatorFilter(indicator);
  };

  const filteredOrders = useMemo(() => {
    if (!data) return [];
    const orders = Array.isArray(data.pedidos) ? data.pedidos : [];
    const needle = normalizeText(searchName);
    if (!needle) return orders;

    return orders.filter((order) => normalizeText(order.nomeCompleto).includes(needle));
  }, [data, searchName]);

  const handleMarkAsDelivered = async (order: DashboardOrder) => {
    setError(null);
    setDeliveringId(order.requestId);

    try {
      if (isMockApiEnabled()) {
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            pedidos: prev.pedidos.map((item) =>
              item.requestId === order.requestId
                ? {
                    ...item,
                    statusEntrega: 'ENTREGUE',
                    entregueEm: new Date().toLocaleString('pt-BR'),
                  }
                : item,
            ),
          };
        });
        return;
      }

      const result = await markOrderDelivered(order.requestId);
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          pedidos: prev.pedidos.map((item) =>
            item.requestId === result.requestId
              ? {
                  ...item,
                  statusEntrega: 'ENTREGUE',
                  entregueEm: result.deliveredAt,
                }
              : item,
          ),
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao marcar pedido como entregue.');
    } finally {
      setDeliveringId(null);
    }
  };

  const MetricCard = ({
    indicator,
    label,
    value,
    isActive,
    onClick,
  }: {
    indicator: IndicatorKey;
    label: string;
    value: number;
    isActive: boolean;
    onClick: (source: 'pointer' | 'click', indicator: IndicatorKey) => void;
  }) => (
    <button
      type="button"
      onPointerUp={(event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        onClick('pointer', indicator);
      }}
      onClick={() => onClick('click', indicator)}
      aria-pressed={isActive}
      className={`relative z-10 pointer-events-auto border-none cursor-pointer rounded-[16px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)] transition-all ${
        isActive
          ? 'bg-primary text-white ring-2 ring-primary ring-offset-2'
          : 'bg-white text-text-main hover:shadow-[0_6px_24px_rgba(0,0,0,0.08)]'
      }`}
    >
      <div className={`text-[14px] mb-2 font-medium ${isActive ? 'text-white/80' : 'text-text-muted'}`}>{label}</div>
      <div className={`text-[28px] font-extrabold ${isActive ? 'text-white' : 'text-primary'}`}>{value}</div>
      {isActive && (
        <div className="mt-3 text-[11px] font-semibold text-white bg-white/20 px-2 py-1 rounded inline-block">
          ✓ Filtro ativo
        </div>
      )}
    </button>
  );

  if (loading) {
    return <div className="max-w-[1280px] mx-auto p-6">Carregando dashboard...</div>;
  }

  if (!data) {
    return <div className="max-w-[1280px] mx-auto p-6">Nao foi possivel carregar os dados.</div>;
  }

  return (
    <div className="max-w-[1280px] mx-auto p-4 md:p-6 lg:p-10 pb-10">
      <div className="bg-primary rounded-t-[16px] p-7 text-center shadow-[0_4px_20px_rgba(0,0,0,0.05)] border-b border-white/10">
        <img
          src={data.logoUrl || LOGO_URL}
          alt="Logo EAC"
          className="w-20 h-20 object-cover rounded-full border-2 border-white/30 mx-auto mb-2"
        />
        <div className="text-white/80 text-sm">Dashboard de Estoque</div>
      </div>

      <div className="bg-white border border-border-color rounded-b-[16px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)] mb-8 border-t-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-[28px] font-bold text-text-main m-0 mb-2 leading-tight">Controle de Camisas</h1>
            <p className="text-text-muted text-sm m-0">Atualizado em: {data.atualizadoEm}</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button
              onClick={load}
              className="flex-1 md:flex-none border-none cursor-pointer bg-primary-light text-primary px-5 py-3 rounded-[8px] font-bold text-[14px] hover:bg-opacity-80 transition-opacity"
            >
              Atualizar dados
            </button>
            <a
              href={data.instagramUrl || 'https://www.instagram.com/eacporciunculadesantana/'}
              target="_blank"
              rel="noreferrer"
              className="flex-1 md:flex-none text-center bg-primary text-white px-5 py-3 rounded-[8px] font-bold text-[14px] no-underline hover:bg-primary-dark transition-colors"
            >
              Instagram do EAC
            </a>
          </div>
        </div>

        {error && <div className="rounded-xl p-3 mb-4 font-bold text-[13px] bg-[#fff1f1] text-[#9b1c1c] border border-[#fecaca]">{error}</div>}

        <div className="mb-6">
          <div className="grid grid-cols-2 gap-2 bg-[#F8F9FA] border border-border-color rounded-[12px] p-1">
            <button
              type="button"
              onClick={() => setActiveTab('detalhamento')}
              className={`rounded-[8px] px-3 py-2.5 text-[13px] md:text-[14px] font-bold border-none cursor-pointer transition-colors ${
                activeTab === 'detalhamento' ? 'bg-primary text-white' : 'bg-transparent text-text-main'
              }`}
            >
              Detalhamento
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pedidos')}
              className={`rounded-[8px] px-3 py-2.5 text-[13px] md:text-[14px] font-bold border-none cursor-pointer transition-colors ${
                activeTab === 'pedidos' ? 'bg-primary text-white' : 'bg-transparent text-text-main'
              }`}
            >
              Pedidos por Solicitante
            </button>
          </div>
        </div>

        {activeTab === 'detalhamento' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {INDICATOR_ORDER.map((indicator) => (
                <div key={indicator}>
                  <MetricCard
                    indicator={indicator}
                    label={INDICATOR_CONFIG[indicator].label}
                    value={indicatorValues[indicator]}
                    isActive={filterIndicator === indicator}
                    onClick={triggerIndicatorFilter}
                  />
                </div>
              ))}
            </div>

            {activeFilterInfo && (
              <div className="bg-[#e8f5e9] border border-[#4caf50] rounded-[12px] p-4 mb-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-bold text-[#1b5e20]">{activeFilterInfo.title}</div>
                    <div className="text-[13px] text-[#2e7d32] mt-1">{activeFilterInfo.description}</div>
                    <div className="text-[12px] text-[#1b5e20] mt-1.5">
                      Quantidade do indicador: {activeIndicatorValue}
                    </div>
                    <div className="text-[12px] text-[#1b5e20] mt-1.5">
                      Exibindo {filteredTable.length} de {data.tabelaGerencial.length} linha(s).
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFilterIndicator(null)}
                    className="border-none cursor-pointer bg-[#4caf50] text-white px-3 py-1.5 rounded-[6px] font-bold text-[12px] hover:bg-[#45a049] transition-colors flex-shrink-0"
                  >
                    Limpar
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white border border-border-color rounded-[16px] overflow-hidden">
              <div className="p-4 md:p-[20px] pb-3 border-b border-border-color">
                <h2 className="m-0 text-[18px] font-bold text-text-main">Detalhamento por tamanho e cor</h2>
                <p className="mt-1.5 mb-0 text-text-muted text-[13px]">Resumo consolidado do estoque e das solicitacoes registradas.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse text-[14px]">
                  <thead>
                    <tr>
                      <th className="bg-[#F8F9FA] text-text-muted p-4 text-left font-semibold sticky top-0 border-b border-border-color">Tamanho</th>
                      <th className="bg-[#F8F9FA] text-text-muted p-4 text-left font-semibold sticky top-0 border-b border-border-color">Cor</th>
                      <th className="bg-[#F8F9FA] text-text-muted p-4 text-left font-semibold sticky top-0 border-b border-border-color">Quantidade</th>
                      <th className="bg-[#F8F9FA] text-text-muted p-4 text-left font-semibold sticky top-0 border-b border-border-color">Reserva</th>
                      <th className="bg-[#F8F9FA] text-text-muted p-4 text-left font-semibold sticky top-0 border-b border-border-color">Disponivel</th>
                      <th className="bg-[#F8F9FA] text-text-muted p-4 text-left font-semibold sticky top-0 border-b border-border-color">Solicitacoes</th>
                      <th className="bg-[#F8F9FA] text-text-muted p-4 text-left font-semibold sticky top-0 border-b border-border-color">Reservados</th>
                      <th className="bg-[#F8F9FA] text-text-muted p-4 text-left font-semibold sticky top-0 border-b border-border-color">Alternativas</th>
                      <th className="bg-[#F8F9FA] text-text-muted p-4 text-left font-semibold sticky top-0 border-b border-border-color">Reposicoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTable.map((row, idx) => (
                      <tr key={`${row.tamanho}-${row.cor}-${idx}`} className="hover:bg-[#FAFAFA] transition-colors border-b border-border-color last:border-0">
                        <td className="p-4 font-medium">{row.tamanho}</td>
                        <td className="p-4">{row.cor}</td>
                        <td className="p-4">{row.quantidade}</td>
                        <td className="p-4">{row.reserva}</td>
                        <td className={`p-4 ${getStockClass(row.disponivel)}`}>{row.disponivel}</td>
                        <td className="p-4">{row.solicitacoes}</td>
                        <td className="p-4">{row.reservados}</td>
                        <td className="p-4 text-text-muted">{row.alternativas}</td>
                        <td className="p-4 text-text-muted">{row.reposicoes}</td>
                      </tr>
                    ))}
                    {filteredTable.length === 0 && (
                      <tr>
                        <td colSpan={9} className="p-6 text-center text-text-muted">
                          Nenhum registro encontrado para o filtro selecionado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'pedidos' && (
          <div className="bg-white border border-border-color rounded-[16px] overflow-hidden">
            <div className="p-4 md:p-[20px] pb-3 border-b border-border-color">
              <h2 className="m-0 text-[18px] font-bold text-text-main">Pedidos por solicitante</h2>
              <p className="mt-1.5 mb-0 text-text-muted text-[13px]">Busque pelo nome para localizar o pedido e marque como entregue.</p>
            </div>

            <div className="p-4 md:p-5 border-b border-border-color bg-[#FCFCFC]">
              <input
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="Buscar por nome do solicitante..."
                className="w-full md:max-w-[420px] p-3 rounded-[10px] border border-border-color bg-white text-[14px] focus:outline-none focus:border-primary"
              />
            </div>

            <div className="p-4 md:p-5 flex flex-col gap-3">
              {filteredOrders.length === 0 && (
                <div className="text-[14px] text-text-muted">Nenhum pedido encontrado para esse nome.</div>
              )}

              {filteredOrders.map((order) => {
                const isDelivered = order.statusEntrega === 'ENTREGUE';
                const isDelivering = deliveringId === order.requestId;

                return (
                  <div key={order.requestId} className="border border-border-color rounded-[12px] p-4 bg-white">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                      <div>
                        <div className="text-[16px] font-bold text-text-main">{order.nomeCompleto}</div>
                        <div className="text-[12px] text-text-muted mt-1">
                          {order.equipe} | {order.email}
                        </div>
                        <div className="text-[12px] text-text-muted mt-1">
                          ID: {order.requestId} | Solicitado em: {order.dataHora}
                        </div>
                      </div>

                      <div className="flex flex-col items-start lg:items-end gap-2">
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${isDelivered ? 'bg-[#e4f5ed] text-[#065f46]' : 'bg-[#fff7ed] text-[#9a3412]'}`}>
                          Entrega: {order.statusEntrega}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleMarkAsDelivered(order)}
                          disabled={isDelivered || isDelivering}
                          className="border-none cursor-pointer bg-primary text-white px-4 py-2 rounded-[8px] font-bold text-[12px] disabled:bg-[#cbd5e1] disabled:cursor-not-allowed"
                        >
                          {isDelivered ? 'Ja entregue' : isDelivering ? 'Salvando...' : 'Marcar como entregue'}
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 text-[13px] text-text-main">
                      <strong>Status do estoque:</strong> {order.statusGeral}
                    </div>
                    <div className="mt-1 text-[13px] text-text-main">
                      <strong>Resumo:</strong> {order.resumoPedido}
                    </div>
                    {order.entregueEm && (
                      <div className="mt-1 text-[12px] text-text-muted">
                        Entregue em: {order.entregueEm}
                      </div>
                    )}

                    {order.items.length > 0 && (
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full min-w-[680px] border-collapse text-[12px]">
                          <thead>
                            <tr>
                              <th className="bg-[#F8F9FA] text-text-muted p-2 text-left font-semibold border border-border-color">Item</th>
                              <th className="bg-[#F8F9FA] text-text-muted p-2 text-left font-semibold border border-border-color">Qtd Sol.</th>
                              <th className="bg-[#F8F9FA] text-text-muted p-2 text-left font-semibold border border-border-color">Qtd Atend.</th>
                              <th className="bg-[#F8F9FA] text-text-muted p-2 text-left font-semibold border border-border-color">Status</th>
                              <th className="bg-[#F8F9FA] text-text-muted p-2 text-left font-semibold border border-border-color">Alternativa</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.items.map((item, idx) => (
                              <tr key={`${order.requestId}-${idx}`}>
                                <td className="p-2 border border-border-color">{item.tamanho} | {item.cor}</td>
                                <td className="p-2 border border-border-color">{item.quantidadeSolicitada}</td>
                                <td className="p-2 border border-border-color">{item.quantidadeAtendida}</td>
                                <td className="p-2 border border-border-color">{item.statusItem}</td>
                                <td className="p-2 border border-border-color">{item.alternativaSugerida || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
