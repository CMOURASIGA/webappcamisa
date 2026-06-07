import { useEffect, useMemo, useState } from 'react';
import { MOCK_STOCK } from '../data/mockData';
import { fetchDashboardData, isMockApiEnabled, markOrderDelivered, markOrderStockSettled, settleReplenishment } from '../services/api';
import type { DashboardData, DashboardOrder } from '../types/api';

function buildMockDashboardData(): DashboardData {
  const totalFisico = MOCK_STOCK.reduce((acc, curr) => acc + curr.quantidade, 0);
  const totalDisponivel = MOCK_STOCK.reduce((acc, curr) => acc + curr.disponivel, 0);
  const totalReservados = MOCK_STOCK.reduce((acc, curr) => acc + curr.reservados, 0);
  const totalReposicao = MOCK_STOCK.reduce((acc, curr) => acc + curr.reposicoes, 0);

  return {
    logoUrl: '',
    instagramUrl: 'https://www.instagram.com/eacporciunculadesantana/',
    atualizadoEm: 'Mock local',
    indicadores: {
      totalFisico,
      totalReserva: 0,
      totalDisponivel,
      totalDisponivelReal: totalDisponivel,
      totalDisponivelGap: 0,
      totalBrancaDisponivel: MOCK_STOCK.filter((row) => row.cor === 'Branca').reduce((acc, curr) => acc + curr.disponivel, 0),
      totalPretaDisponivel: MOCK_STOCK.filter((row) => row.cor === 'Preta').reduce((acc, curr) => acc + curr.disponivel, 0),
      totalAzulDisponivel: MOCK_STOCK.filter((row) => row.cor === 'Azul').reduce((acc, curr) => acc + curr.disponivel, 0),
      totalReservados,
      totalAlternativa: 0,
      totalReposicao,
      totalCamisasAEntregar: MOCK_STOCK.reduce((acc, curr) => acc + curr.solicitacoes, 0),
      totalCamisasEntregues: 0,
      totalCamisasPendentesEntrega: MOCK_STOCK.reduce((acc, curr) => acc + curr.solicitacoes, 0),
    },
    tabelaGerencial: MOCK_STOCK.map((row) => ({ ...row, controlaSaldo: true })),
    pedidos: [],
  };
}

const normalizeText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
const isReplenishmentStatus = (status: string) => normalizeText(status).includes('REPOSI');

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-[16px] border border-border-color p-4">
      <div className="text-[12px] text-text-muted uppercase font-semibold">{label}</div>
      <div className="mt-2 text-[28px] font-black text-primary">{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchName, setSearchName] = useState('');
  const [orderSort, setOrderSort] = useState<'oldest' | 'newest'>('newest');
  const [deliveringId, setDeliveringId] = useState<string | null>(null);
  const [stockSettlingId, setStockSettlingId] = useState<string | null>(null);
  const [settlingKey, setSettlingKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isMockApiEnabled()) {
        setData(buildMockDashboardData());
        return;
      }
      setData(await fetchDashboardData());
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

  const filteredOrders = useMemo(() => {
    const rows = data?.pedidos ?? [];
    const needle = normalizeText(searchName);
    const filtered = needle ? rows.filter((order) => normalizeText(order.nomeCompleto).includes(needle)) : rows;
    return [...filtered].sort((a, b) => (orderSort === 'oldest' ? a.dataHora.localeCompare(b.dataHora) : b.dataHora.localeCompare(a.dataHora)));
  }, [data, searchName, orderSort]);

  const handleMarkAsDelivered = async (order: DashboardOrder) => {
    setDeliveringId(order.requestId);
    try {
      if (isMockApiEnabled()) return;
      await markOrderDelivered(order.requestId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao marcar pedido como entregue.');
    } finally {
      setDeliveringId(null);
    }
  };

  const handleMarkStockSettled = async (order: DashboardOrder) => {
    setStockSettlingId(order.requestId);
    try {
      if (isMockApiEnabled()) return;
      await markOrderStockSettled(order.requestId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao confirmar a baixa de estoque.');
    } finally {
      setStockSettlingId(null);
    }
  };

  const handleSettleReplenishment = async (order: DashboardOrder, ordemItem: number) => {
    const key = `${order.requestId}-${ordemItem}`;
    setSettlingKey(key);
    try {
      if (isMockApiEnabled()) return;
      await settleReplenishment(order.requestId, ordemItem);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao quitar reposicao.');
    } finally {
      setSettlingKey(null);
    }
  };

  if (loading && !data) {
    return <div className="min-h-screen bg-background p-8 text-text-main">Carregando dashboard...</div>;
  }

  if (!data) {
    return <div className="min-h-screen bg-background p-8 text-text-main">Nao foi possivel carregar o dashboard.</div>;
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-[28px] font-black text-text-main m-0">Dashboard de estoque</h1>
          <p className="mt-2 mb-0 text-text-muted text-[14px]">Estoque inicial por cor e tamanho com reposicao automatica quando faltar saldo.</p>
          <p className="mt-1 mb-0 text-text-muted text-[12px]">Atualizado em: {data.atualizadoEm}</p>
        </div>

        {error && <div className="rounded-xl p-3 mb-4 font-bold text-[13px] bg-[#fff1f1] text-[#9b1c1c] border border-[#fecaca]">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <MetricCard label="Estoque Atual" value={data.indicadores.totalFisico} />
          <MetricCard label="Disponivel" value={data.indicadores.totalDisponivel} />
          <MetricCard label="Atendidos do Estoque" value={data.indicadores.totalReservados} />
          <MetricCard label="Reposicao Pendente" value={data.indicadores.totalReposicao} />
        </div>

        <div className="bg-white border border-border-color rounded-[16px] overflow-hidden mb-6">
          <div className="p-4 border-b border-border-color">
            <h2 className="m-0 text-[18px] font-bold text-text-main">Detalhamento por tamanho e cor</h2>
            <p className="mt-1.5 mb-0 text-text-muted text-[13px]">A coluna de reposicao mostra a demanda que nao foi coberta pelo saldo controlado.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-[14px]">
              <thead>
                <tr>
                  <th className="bg-[#F8F9FA] p-4 text-left">Tamanho</th>
                  <th className="bg-[#F8F9FA] p-4 text-left">Cor</th>
                  <th className="bg-[#F8F9FA] p-4 text-left">Qtd Atual</th>
                  <th className="bg-[#F8F9FA] p-4 text-left">Disponivel</th>
                  <th className="bg-[#F8F9FA] p-4 text-left">Solicitacoes</th>
                  <th className="bg-[#F8F9FA] p-4 text-left">Atendidos</th>
                  <th className="bg-[#F8F9FA] p-4 text-left">Reposicao</th>
                </tr>
              </thead>
              <tbody>
                {data.tabelaGerencial.map((row, idx) => (
                  <tr key={`${row.tamanho}-${row.cor}-${idx}`} className="border-b border-border-color last:border-0">
                    <td className="p-4 font-medium">{row.tamanho}</td>
                    <td className="p-4">{row.cor}</td>
                    <td className="p-4">{row.quantidade}</td>
                    <td className="p-4">{row.disponivel}</td>
                    <td className="p-4">{row.solicitacoes}</td>
                    <td className="p-4">{row.reservados}</td>
                    <td className="p-4">{row.reposicoes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-border-color rounded-[16px] overflow-hidden">
          <div className="p-4 border-b border-border-color">
            <h2 className="m-0 text-[18px] font-bold text-text-main">Pedidos por solicitante</h2>
            <p className="mt-1.5 mb-0 text-text-muted text-[13px]">Use os botoes para confirmar baixa de estoque, entrega e quitar itens em reposicao.</p>
          </div>
          <div className="p-4 border-b border-border-color bg-[#FCFCFC] flex flex-col md:flex-row gap-3">
            <input type="text" value={searchName} onChange={(e) => setSearchName(e.target.value)} placeholder="Buscar por nome do solicitante..." className="w-full md:max-w-[420px] p-3 rounded-[10px] border border-border-color bg-white text-[14px]" />
            <select value={orderSort} onChange={(e) => setOrderSort(e.target.value as 'oldest' | 'newest')} className="w-full md:w-[240px] p-3 rounded-[10px] border border-border-color bg-white text-[14px]">
              <option value="newest">Mais novo primeiro</option>
              <option value="oldest">Mais antigo primeiro</option>
            </select>
          </div>
          <div className="p-4 flex flex-col gap-3">
            {filteredOrders.length === 0 && <div className="text-[14px] text-text-muted">Nenhum pedido encontrado.</div>}
            {filteredOrders.map((order) => (
              <div key={order.requestId} className="border border-border-color rounded-[12px] p-4 bg-white">
                <div className="flex flex-col lg:flex-row lg:justify-between gap-3">
                  <div>
                    <div className="text-[16px] font-bold text-text-main">{order.nomeCompleto}</div>
                    <div className="text-[12px] text-text-muted mt-1">{order.equipe} | {order.email}</div>
                    <div className="text-[12px] text-text-muted mt-1">ID: {order.requestId} | Solicitado em: {order.dataHora}</div>
                    <div className="mt-2 text-[13px] text-text-main"><strong>Status:</strong> {order.statusGeral}</div>
                    <div className="mt-1 text-[13px] text-text-main"><strong>Resumo:</strong> {order.resumoPedido}</div>
                  </div>
                  <div className="flex flex-col items-start lg:items-end gap-2">
                    <button type="button" onClick={() => handleMarkStockSettled(order)} disabled={stockSettlingId === order.requestId} className="border border-[#1d4ed8] bg-white text-[#1d4ed8] px-4 py-2 rounded-[8px] font-bold text-[12px] disabled:opacity-50">{stockSettlingId === order.requestId ? 'Salvando...' : 'Confirmar baixa estoque'}</button>
                    <button type="button" onClick={() => handleMarkAsDelivered(order)} disabled={deliveringId === order.requestId} className="border-none bg-primary text-white px-4 py-2 rounded-[8px] font-bold text-[12px] disabled:opacity-50">{deliveringId === order.requestId ? 'Salvando...' : 'Marcar como entregue'}</button>
                  </div>
                </div>

                {order.items.length > 0 && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[680px] border-collapse text-[12px]">
                      <thead>
                        <tr>
                          <th className="bg-[#F8F9FA] p-2 text-left border border-border-color">Item</th>
                          <th className="bg-[#F8F9FA] p-2 text-left border border-border-color">Qtd Sol.</th>
                          <th className="bg-[#F8F9FA] p-2 text-left border border-border-color">Qtd Atend.</th>
                          <th className="bg-[#F8F9FA] p-2 text-left border border-border-color">Status</th>
                          <th className="bg-[#F8F9FA] p-2 text-left border border-border-color">Acao</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item, idx) => {
                          const key = `${order.requestId}-${item.ordemItem || idx + 1}`;
                          return (
                            <tr key={key}>
                              <td className="p-2 border border-border-color">{item.tamanho} | {item.cor}</td>
                              <td className="p-2 border border-border-color">{item.quantidadeSolicitada}</td>
                              <td className="p-2 border border-border-color">{item.quantidadeAtendida}</td>
                              <td className="p-2 border border-border-color">{item.statusItem}</td>
                              <td className="p-2 border border-border-color">
                                {isReplenishmentStatus(item.statusItem) ? (
                                  <button type="button" onClick={() => handleSettleReplenishment(order, item.ordemItem || idx + 1)} disabled={settlingKey === key} className="border-none bg-[#1d4ed8] text-white px-2.5 py-1.5 rounded-[6px] font-bold text-[11px] disabled:opacity-50">{settlingKey === key ? 'Quitando...' : 'Quitar reposicao'}</button>
                                ) : (
                                  <span className="text-text-muted">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
