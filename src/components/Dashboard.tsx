import { useEffect, useState } from 'react';
import { MOCK_STOCK } from '../data/mockData';
import { fetchDashboardData, isMockApiEnabled } from '../services/api';
import type { DashboardData } from '../types/api';

function buildMockDashboardData(): DashboardData {
  const totalFisico = MOCK_STOCK.reduce((acc, curr) => acc + curr.quantidade, 0);
  const totalReserva = MOCK_STOCK.reduce((acc, curr) => acc + curr.reserva, 0);
  const totalDisponivel = MOCK_STOCK.reduce((acc, curr) => acc + curr.disponivel, 0);
  const totalReservados = MOCK_STOCK.reduce((acc, curr) => acc + curr.reservados, 0);

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
  };
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  const MetricCard = ({ label, value }: { label: string; value: number }) => (
    <div className="bg-white border border-border-color rounded-[16px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
      <div className="text-text-muted text-[14px] mb-2 font-medium">{label}</div>
      <div className="text-primary text-[28px] font-extrabold">{value}</div>
    </div>
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
        <div className="text-white text-3xl font-black mb-2 tracking-widest uppercase">EAC</div>
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard label="Estoque Fisico Total" value={data.indicadores.totalFisico} />
          <MetricCard label="Reserva Brinde Total" value={data.indicadores.totalReserva} />
          <MetricCard label="Disponivel Total" value={data.indicadores.totalDisponivel} />
          <MetricCard label="Pedidos Reservados" value={data.indicadores.totalReservados} />

          <MetricCard label="Disponivel Preta" value={data.indicadores.totalPretaDisponivel} />
          <MetricCard label="Disponivel Azul" value={data.indicadores.totalAzulDisponivel} />
          <MetricCard label="Pedidos c/ Alternativa" value={data.indicadores.totalAlternativa} />
          <MetricCard label="Pedidos em Reposicao" value={data.indicadores.totalReposicao} />
        </div>

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
                {data.tabelaGerencial.map((row, idx) => (
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
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
