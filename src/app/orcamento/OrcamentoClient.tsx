'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  ArrowRight, 
  Search, 
  Filter,
  Download,
  Calendar,
  Wallet,
  AlertCircle
} from 'lucide-react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';
import { db, isAdmin } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend,
  type ChartOptions
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

// Registro do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface Empenho {
  id: string;
  referencia: any; // Timestamp
  ptres: number;
  planoOrcamentario: string;
  notaEmpenho: string;
  planoIntegrado: string;
  descricao: string;
  naturezaDespesa: string;
  processoSei: string;
  fornecedores: string;
  despesasEmpenhadas: number;
  despesasLiquidadas: number;
  despesasPagas: number;
  ano: number;
  mesCode: string;
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}

function formatNumber(val: number) {
  return new Intl.NumberFormat('pt-BR').format(val || 0);
}

export default function OrcamentoClient() {
  const { user, authReady, canEdit } = useAuth();
  const [data, setData] = useState<Empenho[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [mesFilter, setMesFilter] = useState<string>('all');
  const [natFilter, setNatFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!canEdit) return;

    const q = query(collection(db, 'opl_empenhos'), orderBy('mesCode', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Empenho[];
      setData(docs);
      setLoading(false);
    });

    return () => unsub();
  }, [canEdit]);

  // Opções para os filtros
  const uniqueMeses = useMemo(() => {
    return Array.from(new Set(data.map(d => d.mesCode))).sort();
  }, [data]);

  const uniqueNats = useMemo(() => {
    return Array.from(new Set(data.map(d => d.naturezaDespesa))).sort();
  }, [data]);

  // Dados filtrados
  const filteredData = useMemo(() => {
    return data.filter(d => {
      const matchMes = mesFilter === 'all' || d.mesCode === mesFilter;
      const matchNat = natFilter === 'all' || d.naturezaDespesa === natFilter;
      const matchSearch = !search || 
        d.notaEmpenho.toLowerCase().includes(search.toLowerCase()) ||
        d.descricao.toLowerCase().includes(search.toLowerCase()) ||
        d.fornecedores.toLowerCase().includes(search.toLowerCase());
      return matchMes && matchNat && matchSearch;
    });
  }, [data, mesFilter, natFilter, search]);

  // Agrupamento para Gráfico (Mês a Mês)
  const chartData = useMemo(() => {
    const labels = uniqueMeses;
    const empenhado = labels.map(mes => 
      data.filter(d => d.mesCode === mes).reduce((acc, curr) => acc + curr.despesasEmpenhadas, 0)
    );
    const liquidado = labels.map(mes => 
      data.filter(d => d.mesCode === mes).reduce((acc, curr) => acc + curr.despesasLiquidadas, 0)
    );
    const pago = labels.map(mes => 
      data.filter(d => d.mesCode === mes).reduce((acc, curr) => acc + curr.despesasPagas, 0)
    );

    // Cores dos tokens (serão lidas dinamicamente se possível, ou aproximadas)
    // No Roadmap pede-se para ler via getComputedStyle, mas aqui vamos usar as classes ou variáveis CSS
    return {
      labels: labels.map(m => m.split('-').reverse().join('/')),
      datasets: [
        {
          label: 'Empenhado',
          data: empenhado,
          backgroundColor: '#1a7a48', // --accent
        },
        {
          label: 'Liquidado',
          data: liquidado,
          backgroundColor: '#46535f', // --ink-2
        },
        {
          label: 'Pago',
          data: pago,
          backgroundColor: '#97a2ae', // --ink-4
        }
      ]
    };
  }, [data, uniqueMeses]);

  const chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const, labels: { boxWidth: 12, font: { size: 11 } } },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: ${formatCurrency(context.parsed.y ?? 0)}`
        }
      }
    },
    scales: {
      x: { grid: { display: false } },
      y: { ticks: { callback: (val) => formatNumber(Number(val)) } }
    }
  };

  if (!authReady || (canEdit && loading)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 ds-card text-center">
        <AlertCircle size={40} className="mx-auto text-warn mb-4" />
        <h2 className="text-lg font-bold mb-2">Acesso Restrito</h2>
        <p className="text-ink-2 mb-6">Você precisa estar logado para visualizar o orçamento.</p>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 ds-card text-center">
        <AlertCircle size={40} className="mx-auto text-danger mb-4" />
        <h2 className="text-lg font-bold mb-2">Acesso Negado</h2>
        <p className="text-ink-2">Apenas administradores autorizados podem visualizar estes dados.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <header className="mb-8">
        <div className="flex items-center gap-2 text-ink-3 text-sm mb-1">
          <Wallet size={14} />
          <span>Gestão Orçamentária</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Execução Orçamentária — Pleitos 2026</h1>
      </header>

      {/* Gráfico */}
      <section className="ds-card p-4 md:p-6 mb-8 h-[350px]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-3">Evolução Mensal (R$)</h2>
          <BarChart3 size={16} className="text-ink-4" />
        </div>
        <div className="h-[280px]">
          <Bar data={chartData} options={chartOptions} />
        </div>
      </section>

      {/* Filtros */}
      <section className="ds-card p-4 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-ink-3 mb-1.5 block">Buscar</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" />
              <input 
                type="text" 
                placeholder="Empenho, descrição ou fornecedor..."
                className="ds-input w-full pl-10"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-ink-3 mb-1.5 block">Referência</label>
            <div className="relative">
              <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4 pointer-events-none" />
              <select 
                className="ds-select w-full pl-10 pr-10"
                value={mesFilter}
                onChange={e => setMesFilter(e.target.value)}
              >
                <option value="all">Todos os meses</option>
                {uniqueMeses.map(m => (
                  <option key={m} value={m}>{m.split('-').reverse().join('/')}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-ink-3 mb-1.5 block">Natureza</label>
            <div className="relative">
              <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4 pointer-events-none" />
              <select 
                className="ds-select w-full pl-10 pr-10"
                value={natFilter}
                onChange={e => setNatFilter(e.target.value)}
              >
                <option value="all">Todas as naturezas</option>
                {uniqueNats.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Tabela */}
      <section className="ds-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-2 border-b border-border-strong [&>th]:px-4 [&>th]:py-3 [&>th]:text-[10px] [&>th]:font-bold [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-ink-3">
                <th>Mês</th>
                <th>NE</th>
                <th>Descrição / Fornecedor</th>
                <th>Natureza</th>
                <th className="text-right">Empenhado</th>
                <th className="text-right">Liquidado</th>
                <th className="text-right">Pago</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-faint text-sm">
              {filteredData.map((d, index) => {
                // Cálculo de variação simples (exemplo: se for NE igual no mês anterior)
                const prev = data.find(p => p.notaEmpenho === d.notaEmpenho && p.mesCode < d.mesCode);
                const hasVariation = prev && (d.despesasEmpenhadas !== prev.despesasEmpenhadas);
                const increased = prev && d.despesasEmpenhadas > prev.despesasEmpenhadas;

                return (
                  <tr key={d.id} className="row-hover">
                    <td className="px-4 py-4 whitespace-nowrap text-ink-3 num font-medium">
                      {d.mesCode.split('-').reverse().join('/')}
                    </td>
                    <td className="px-4 py-4 font-bold text-ink num">
                      {d.notaEmpenho.slice(-10)}
                    </td>
                    <td className="px-4 py-4 max-w-xs md:max-w-md">
                      <div className="font-medium text-ink line-clamp-1">{d.descricao}</div>
                      <div className="text-[11px] text-ink-4 mt-0.5 line-clamp-1">{d.fornecedores}</div>
                    </td>
                    <td className="px-4 py-4 text-xs font-medium text-ink-2">
                      {d.naturezaDespesa}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="font-bold text-ink num">{formatCurrency(d.despesasEmpenhadas)}</span>
                        {hasVariation && (
                          increased ? 
                            <TrendingUp size={14} className="text-accent" /> : 
                            <TrendingDown size={14} className="text-danger" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right num text-ink-2">
                      {formatCurrency(d.despesasLiquidadas)}
                    </td>
                    <td className="px-4 py-4 text-right num text-ink-2">
                      {formatCurrency(d.despesasPagas)}
                    </td>
                  </tr>
                );
              })}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-ink-4 italic">
                    Nenhum empenho encontrado para os filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
