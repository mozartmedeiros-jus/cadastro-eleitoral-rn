'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  Calendar,
  AlertCircle
} from 'lucide-react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  type Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from 'next-themes';
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
  referencia: Timestamp;
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

function formatCompactCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(val || 0);
}

function formatPercent(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 }).format(val || 0);
}

// "2026-06" → "06/2026"
function formatMonth(mesCode: string) {
  return mesCode.split('-').reverse().join('/');
}

// Cores do tema lidas dos tokens CSS (acompanham claro/escuro). Defaults = tema claro.
const FALLBACK_COLORS = {
  accent: '#1a7a48',
  ink2: '#46535f',
  ink3: '#6b7785',
  ink4: '#97a2ae',
  border: '#dde3ea',
};

export default function OrcamentoClient() {
  const { user, authReady, canEdit } = useAuth();
  const { resolvedTheme } = useTheme();
  const [data, setData] = useState<Empenho[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [mesFilter, setMesFilter] = useState<string>('all');
  const [natFilter, setNatFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Cores do tema, relidas dos tokens quando o tema troca (A Regra do Espelho).
  const [themeColors, setThemeColors] = useState(FALLBACK_COLORS);
  useEffect(() => {
    const root = getComputedStyle(document.documentElement);
    const read = (v: string, fallback: string) => root.getPropertyValue(v).trim() || fallback;
    setThemeColors({
      accent: read('--accent', FALLBACK_COLORS.accent),
      ink2: read('--ink-2', FALLBACK_COLORS.ink2),
      ink3: read('--ink-3', FALLBACK_COLORS.ink3),
      ink4: read('--ink-4', FALLBACK_COLORS.ink4),
      border: read('--border', FALLBACK_COLORS.border),
    });
  }, [resolvedTheme]);

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

  // Mês de referência = último mês com movimento real. Como os dados são snapshots
  // cumulativos, os meses futuros repetem o último mês fechado; este cálculo encontra
  // o ponto onde os valores pararam de mudar (ex.: Junho/2026).
  const refMonth = useMemo(() => {
    if (uniqueMeses.length === 0) return null;
    const totalDoMes = (mes: string) =>
      data
        .filter(d => d.mesCode === mes)
        .reduce((acc, c) => acc + c.despesasEmpenhadas + c.despesasLiquidadas + c.despesasPagas, 0);
    let i = uniqueMeses.length - 1;
    while (i > 0 && totalDoMes(uniqueMeses[i]) === totalDoMes(uniqueMeses[i - 1])) i--;
    return uniqueMeses[i];
  }, [data, uniqueMeses]);

  // Predicado de busca compartilhado (tabela, gráfico e totais).
  const matchesText = useMemo(() => {
    const term = search.toLowerCase();
    return (d: Empenho) =>
      !term ||
      d.notaEmpenho.toLowerCase().includes(term) ||
      d.descricao.toLowerCase().includes(term) ||
      d.fornecedores.toLowerCase().includes(term);
  }, [search]);

  // Dados filtrados (tabela e gráfico)
  const filteredData = useMemo(() => {
    return data.filter(d => {
      const matchMes = mesFilter === 'all' || d.mesCode === mesFilter;
      const matchNat = natFilter === 'all' || d.naturezaDespesa === natFilter;
      return matchMes && matchNat && matchesText(d);
    });
  }, [data, mesFilter, natFilter, matchesText]);

  // Indicadores-âncora: posição de UM mês (o filtrado, ou a referência quando "todos"),
  // respeitando natureza e busca. Nunca somar entre meses — os snapshots são cumulativos.
  const summaryMonth = mesFilter !== 'all' ? mesFilter : refMonth;
  const summary = useMemo(() => {
    const rows = data.filter(
      d =>
        d.mesCode === summaryMonth &&
        (natFilter === 'all' || d.naturezaDespesa === natFilter) &&
        matchesText(d)
    );
    const emp = rows.reduce((a, c) => a + c.despesasEmpenhadas, 0);
    const liq = rows.reduce((a, c) => a + c.despesasLiquidadas, 0);
    const pag = rows.reduce((a, c) => a + c.despesasPagas, 0);
    return { emp, liq, pag, count: rows.length, execLiq: emp ? liq / emp : 0, execPag: emp ? pag / emp : 0 };
  }, [data, summaryMonth, natFilter, matchesText]);

  const isFiltered = mesFilter !== 'all' || natFilter !== 'all' || search.trim() !== '';

  // Gráfico (evolução mensal) — respeita os filtros ativos e lê as cores dos tokens.
  const chartData = useMemo(() => {
    const labels = Array.from(new Set(filteredData.map(d => d.mesCode))).sort();
    const sumBy = (
      mes: string,
      key: keyof Pick<Empenho, 'despesasEmpenhadas' | 'despesasLiquidadas' | 'despesasPagas'>
    ) => filteredData.filter(d => d.mesCode === mes).reduce((acc, c) => acc + c[key], 0);

    return {
      labels: labels.map(formatMonth),
      datasets: [
        { label: 'Empenhado', data: labels.map(m => sumBy(m, 'despesasEmpenhadas')), backgroundColor: themeColors.accent },
        { label: 'Liquidado', data: labels.map(m => sumBy(m, 'despesasLiquidadas')), backgroundColor: themeColors.ink2 },
        { label: 'Pago', data: labels.map(m => sumBy(m, 'despesasPagas')), backgroundColor: themeColors.ink4 },
      ],
    };
  }, [filteredData, themeColors]);

  const chartOptions: ChartOptions<'bar'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 }, color: themeColors.ink2 } },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: ${formatCurrency(context.parsed.y ?? 0)}`,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: themeColors.ink3 } },
      y: {
        grid: { color: themeColors.border },
        ticks: { color: themeColors.ink3, callback: (val) => formatNumber(Number(val)) },
      },
    },
  }), [themeColors]);

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
        <div className="flex items-center gap-2 text-[11px] text-ink-3">
          <span className="whitespace-nowrap">Tribunal Regional Eleitoral</span>
          <span className="w-[3px] h-[3px] rounded-full bg-ink-4" />
          <span className="text-accent font-semibold whitespace-nowrap">Execução Orçamentária</span>
          {refMonth && (
            <>
              <span className="w-[3px] h-[3px] rounded-full bg-ink-4" />
              <span className="whitespace-nowrap">Dados de {formatMonth(refMonth)}</span>
            </>
          )}
        </div>
        <h1 className="mt-0.5 text-2xl md:text-3xl font-bold tracking-tight">Execução Orçamentária — Pleitos 2026</h1>
      </header>

      {/* Indicadores-âncora — posição de um mês, respeitando os filtros */}
      <section className="ds-card mb-8 overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-4">
          <div className="px-4 py-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-3">Empenhado</div>
            <div className="mt-1 num text-lg font-bold text-ink" title={formatCurrency(summary.emp)}>
              {formatCompactCurrency(summary.emp)}
            </div>
          </div>
          <div className="px-4 py-4 border-l border-border">
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-3">Liquidado</div>
            <div className="mt-1 num text-lg font-bold text-ink-2" title={formatCurrency(summary.liq)}>
              {formatCompactCurrency(summary.liq)}
            </div>
            <div className="mt-0.5 text-[11px] text-ink-4 num">{formatPercent(summary.execLiq)} do empenhado</div>
          </div>
          <div className="px-4 py-4 border-t border-border md:border-t-0 md:border-l md:border-border">
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-3">Pago</div>
            <div className="mt-1 num text-lg font-bold text-ink-2" title={formatCurrency(summary.pag)}>
              {formatCompactCurrency(summary.pag)}
            </div>
            <div className="mt-0.5 text-[11px] text-ink-4 num">{formatPercent(summary.execPag)} do empenhado</div>
          </div>
          <div className="px-4 py-4 border-l border-t border-border md:border-t-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-3">Execução (Pago)</div>
            <div
              className="mt-1 num text-lg font-bold text-accent"
              title={`${formatCurrency(summary.pag)} de ${formatCurrency(summary.emp)}`}
            >
              {formatPercent(summary.execPag)}
            </div>
          </div>
        </div>
        <div className="px-4 py-2 border-t border-border text-[11px] text-ink-3">
          {summaryMonth ? <>Posição de <span className="num">{formatMonth(summaryMonth)}</span></> : 'Sem dados'}
          {' · '}
          <span className="num">{summary.count}</span> {summary.count === 1 ? 'empenho' : 'empenhos'}
          {isFiltered && ' · filtros aplicados'}
        </div>
      </section>

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
                  <option key={m} value={m}>{formatMonth(m)}</option>
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
              {filteredData.map((d) => {
                // Cálculo de variação simples (exemplo: se for NE igual no mês anterior)
                const prev = data.find(p => p.notaEmpenho === d.notaEmpenho && p.mesCode < d.mesCode);
                const hasVariation = prev && (d.despesasEmpenhadas !== prev.despesasEmpenhadas);
                const increased = prev && d.despesasEmpenhadas > prev.despesasEmpenhadas;

                return (
                  <tr key={d.id} className="row-hover">
                    <td className="px-4 py-4 whitespace-nowrap text-ink-3 num font-medium">
                      {formatMonth(d.mesCode)}
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
