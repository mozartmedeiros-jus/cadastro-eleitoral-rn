'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  Calendar,
  AlertCircle,
  AlertTriangle,
  Upload,
  Loader2,
  X,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  getDocs,
  writeBatch,
  doc,
  serverTimestamp,
  type Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from 'next-themes';
import { parseEmpenhos } from '@/lib/orcamento-xlsx';
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

const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// "2026-06" → "jun/2026"
function formatMonth(mesCode: string) {
  const [ano, mes] = mesCode.split('-');
  return `${MESES_ABREV[Number(mes) - 1] ?? mes}/${ano}`;
}

// Tamanho máximo por lote do Firestore client SDK
const BATCH_LIMIT = 500;

// Direção da variação de um valor em relação ao mês anterior da mesma NE.
type VarDir = 'up' | 'down' | null;
function varDir(curr: number, prev?: number): VarDir {
  if (prev === undefined || curr === prev) return null;
  return curr > prev ? 'up' : 'down';
}
// Empenhos de Eleição Suplementar (descrição inicia com "ELEICAO SUPLEMENTAR",
// comparando sem acento e sem caixa).
function isSuplementar(descricao: string) {
  return (descricao || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .startsWith('ELEICAO SUPLEMENTAR');
}

function VarArrow({ dir }: { dir: VarDir }) {
  if (dir === 'up') return <TrendingUp size={14} className="text-accent shrink-0" aria-label="aumentou em relação ao mês anterior" />;
  if (dir === 'down') return <TrendingDown size={14} className="text-danger shrink-0" aria-label="diminuiu em relação ao mês anterior" />;
  return null;
}

// Cabeçalho de seção (mesmo padrão da tela de Estatística).
function SectionHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-3 mt-1 mb-3">
      <h2 className="text-xs font-bold uppercase tracking-[0.06em] text-ink-2 whitespace-nowrap">{title}</h2>
      {hint && <span className="text-[11.5px] text-ink-4 whitespace-nowrap">{hint}</span>}
      <span className="flex-1 h-px bg-border" />
    </div>
  );
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
  const [changedFilter, setChangedFilter] = useState(false);
  const [showSuplementar, setShowSuplementar] = useState(false); // default: ocultar
  const defaultSelectedRef = useRef(false);

  // Import de novo .xlsx (substitui todos os dados)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importDone, setImportDone] = useState(false);

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

  // Pré-seleciona o mês de referência na primeira carga (uma única vez).
  useEffect(() => {
    if (!defaultSelectedRef.current && refMonth) {
      setMesFilter(refMonth);
      defaultSelectedRef.current = true;
    }
  }, [refMonth]);

  // Predicado de busca compartilhado (tabela, gráfico e totais).
  const matchesText = useMemo(() => {
    const term = search.toLowerCase();
    return (d: Empenho) =>
      !term ||
      d.notaEmpenho.toLowerCase().includes(term) ||
      d.descricao.toLowerCase().includes(term) ||
      d.fornecedores.toLowerCase().includes(term);
  }, [search]);

  // Dados filtrados (gráfico e base da tabela)
  const filteredData = useMemo(() => {
    return data.filter(d => {
      const matchMes = mesFilter === 'all' || d.mesCode === mesFilter;
      const matchNat = natFilter === 'all' || d.naturezaDespesa === natFilter;
      const matchSup = showSuplementar || !isSuplementar(d.descricao);
      return matchMes && matchNat && matchSup && matchesText(d);
    });
  }, [data, mesFilter, natFilter, showSuplementar, matchesText]);

  // Mês imediatamente anterior de cada NE (base da sinalização de variação).
  const prevByDocId = useMemo(() => {
    const groups = new Map<string, Empenho[]>();
    for (const d of data) {
      const arr = groups.get(d.notaEmpenho);
      if (arr) arr.push(d);
      else groups.set(d.notaEmpenho, [d]);
    }
    const map = new Map<string, Empenho | undefined>();
    for (const arr of groups.values()) {
      arr.sort((a, b) => a.mesCode.localeCompare(b.mesCode));
      arr.forEach((d, i) => map.set(d.id, i > 0 ? arr[i - 1] : undefined));
    }
    return map;
  }, [data]);

  const hasAnyChange = useMemo(
    () => (d: Empenho) => {
      const p = prevByDocId.get(d.id);
      return (
        !!p &&
        (d.despesasEmpenhadas !== p.despesasEmpenhadas ||
          d.despesasLiquidadas !== p.despesasLiquidadas ||
          d.despesasPagas !== p.despesasPagas)
      );
    },
    [prevByDocId],
  );

  // Linhas da tabela: aplica o filtro "apenas com alteração" (não afeta gráfico/indicadores).
  const tableRows = useMemo(
    () => (changedFilter ? filteredData.filter(hasAnyChange) : filteredData),
    [filteredData, changedFilter, hasAnyChange],
  );

  // Indicadores-âncora: posição de UM mês (o filtrado, ou a referência quando "todos"),
  // respeitando natureza e busca. Nunca somar entre meses — os snapshots são cumulativos.
  const summaryMonth = mesFilter !== 'all' ? mesFilter : refMonth;
  const summary = useMemo(() => {
    const rows = data.filter(
      d =>
        d.mesCode === summaryMonth &&
        (natFilter === 'all' || d.naturezaDespesa === natFilter) &&
        (showSuplementar || !isSuplementar(d.descricao)) &&
        matchesText(d)
    );
    const emp = rows.reduce((a, c) => a + c.despesasEmpenhadas, 0);
    const liq = rows.reduce((a, c) => a + c.despesasLiquidadas, 0);
    const pag = rows.reduce((a, c) => a + c.despesasPagas, 0);
    return { emp, liq, pag, count: rows.length, execLiq: emp ? liq / emp : 0, execPag: emp ? pag / emp : 0 };
  }, [data, summaryMonth, natFilter, showSuplementar, matchesText]);

  const summaryFiltered = natFilter !== 'all' || search.trim() !== '';

  // Estado "padrão" da tela (mês de referência, sem filtros secundários) → controla o botão Limpar.
  const defaultMonth = refMonth ?? 'all';
  const isDefaultView =
    mesFilter === defaultMonth &&
    natFilter === 'all' &&
    search.trim() === '' &&
    !changedFilter &&
    !showSuplementar;
  const clearFilters = () => {
    setMesFilter(defaultMonth);
    setNatFilter('all');
    setSearch('');
    setChangedFilter(false);
    setShowSuplementar(false);
  };

  const indicadoresHint = summaryMonth
    ? `posição de ${formatMonth(summaryMonth)} · ${summary.count} ${summary.count === 1 ? 'empenho' : 'empenhos'}${summaryFiltered ? ' · filtros aplicados' : ''}`
    : 'sem dados';
  const indicadores = [
    { label: 'Empenhado', value: formatCompactCurrency(summary.emp), title: formatCurrency(summary.emp), sub: 'valor empenhado', accent: false },
    { label: 'Liquidado', value: formatCompactCurrency(summary.liq), title: formatCurrency(summary.liq), sub: `${formatPercent(summary.execLiq)} do empenhado`, accent: false },
    { label: 'Pago', value: formatCompactCurrency(summary.pag), title: formatCurrency(summary.pag), sub: `${formatPercent(summary.execPag)} do empenhado`, accent: false },
    { label: 'Execução (pago)', value: formatPercent(summary.execPag), title: `${formatCurrency(summary.pag)} de ${formatCurrency(summary.emp)}`, sub: 'pago / empenhado', accent: true },
  ];

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

  // --- Import de novo .xlsx (substitui todos os dados) ---
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = ''; // permite reescolher o mesmo arquivo
    if (file) {
      setImportError(null);
      setImportStatus(null);
      setImportDone(false);
      setPendingFile(file);
    }
  };

  const closeImport = () => {
    if (importing) return;
    setPendingFile(null);
    setImportError(null);
    setImportStatus(null);
    setImportDone(false);
  };

  const commitInBatches = async (
    ops: ((b: ReturnType<typeof writeBatch>) => void)[],
    onProgress: (done: number, total: number) => void,
  ) => {
    for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      ops.slice(i, i + BATCH_LIMIT).forEach(op => op(batch));
      await batch.commit();
      onProgress(Math.min(i + BATCH_LIMIT, ops.length), ops.length);
    }
  };

  const confirmImport = async () => {
    if (!pendingFile) return;
    setImporting(true);
    setImportError(null);
    try {
      setImportStatus('Lendo planilha…');
      const XLSX = (await import('xlsx')).default;
      const wb = XLSX.read(await pendingFile.arrayBuffer(), { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
      const novos = parseEmpenhos(rows);

      if (novos.length === 0) {
        throw new Error(
          'Nenhum empenho válido encontrado. Confira se o arquivo segue o layout da planilha de execução.',
        );
      }

      const col = collection(db, 'opl_empenhos');
      const novosIds = new Set(novos.map(n => n.docId));

      // 1) grava/atualiza todos os novos
      await commitInBatches(
        novos.map(n => (b: ReturnType<typeof writeBatch>) =>
          b.set(doc(col, n.docId), { ...n.data, updatedAt: serverTimestamp() }),
        ),
        (done, total) => setImportStatus(`Gravando ${done}/${total}…`),
      );

      // 2) remove os antigos que não estão no novo arquivo (substituição completa)
      setImportStatus('Removendo registros antigos…');
      const snap = await getDocs(col);
      const staleIds = snap.docs.map(d => d.id).filter(id => !novosIds.has(id));
      if (staleIds.length > 0) {
        await commitInBatches(
          staleIds.map(id => (b: ReturnType<typeof writeBatch>) => b.delete(doc(col, id))),
          (done, total) => setImportStatus(`Removendo ${done}/${total}…`),
        );
      }

      setImportStatus(`${novos.length} empenhos importados com sucesso.`);
      setImportDone(true);
    } catch (err) {
      console.error('Falha ao importar .xlsx:', err);
      setImportError(err instanceof Error ? err.message : 'Falha ao importar o arquivo.');
    } finally {
      setImporting(false);
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
    <div className="min-h-full bg-bg text-ink pb-14">
      {/* Top bar — mesmo padrão da tela de Estatística */}
      <header className="sticky top-0 z-30 bg-surface border-b border-border">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
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
            <h1 className="mt-0.5 text-[20px] md:text-[22px] font-bold tracking-[-0.02em] text-ink flex items-center gap-2 leading-tight">
              <BarChart3 size={20} className="text-accent shrink-0" />
              Execução Orçamentária — Pleitos 2026
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <input ref={fileInputRef} type="file" accept=".xlsx" hidden onChange={onFileChange} />
            <button
              onClick={() => fileInputRef.current?.click()}
              aria-label="Atualizar dados a partir de uma nova planilha"
              className="inline-flex items-center gap-2 h-[38px] px-4 rounded-[6px] bg-accent border border-accent text-accent-on text-[13px] font-semibold hover:bg-accent-strong hover:border-accent-strong transition-colors"
            >
              <Upload size={14} /> <span className="hidden sm:inline">Atualizar dados</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* Indicadores */}
        <SectionHead title="Indicadores" hint={indicadoresHint} />
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-7">
          {indicadores.map((k) => (
            <div key={k.label} className="relative ds-card p-[18px] overflow-hidden" title={k.title}>
              <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent" />
              <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-3">{k.label}</div>
              <div className={`num mt-2 text-[30px] font-bold tracking-[-0.025em] leading-none ${k.accent ? 'text-accent' : 'text-ink'}`}>{k.value}</div>
              <div className="mt-[7px] text-[11px] text-ink-4">{k.sub}</div>
            </div>
          ))}
        </section>

        {/* Evolução mensal */}
        <SectionHead title="Evolução mensal" hint="empenhado, liquidado e pago (R$)" />
        <section className="ds-card p-4 md:p-6 mb-7">
          <div className="h-[300px]">
            <Bar data={chartData} options={chartOptions} />
          </div>
        </section>

        {/* Empenhos */}
        <SectionHead
          title="Empenhos"
          hint={`${tableRows.length} ${tableRows.length === 1 ? 'registro' : 'registros'}`}
        />
        <section className="ds-card p-4 mb-3">
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

        <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-border">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setChangedFilter(v => !v)}
              aria-pressed={changedFilter}
              className={`inline-flex items-center gap-2 h-[34px] px-3 rounded-[6px] border text-[12.5px] font-medium transition-colors ${
                changedFilter
                  ? 'bg-accent-soft border-accent-soft-border text-accent'
                  : 'bg-surface border-border-strong text-ink-2 hover:bg-surface-3 hover:text-ink'
              }`}
            >
              <Filter size={14} /> Apenas com alteração no mês
            </button>
            <button
              type="button"
              onClick={() => setShowSuplementar(v => !v)}
              aria-pressed={showSuplementar}
              title="Empenhos cuja descrição começa com ELEIÇÃO SUPLEMENTAR"
              className={`inline-flex items-center gap-2 h-[34px] px-3 rounded-[6px] border text-[12.5px] font-medium transition-colors ${
                showSuplementar
                  ? 'bg-accent-soft border-accent-soft-border text-accent'
                  : 'bg-surface border-border-strong text-ink-2 hover:bg-surface-3 hover:text-ink'
              }`}
            >
              {showSuplementar ? <EyeOff size={14} /> : <Eye size={14} />}
              {showSuplementar ? 'Ocultar eleição suplementar' : 'Mostrar eleição suplementar'}
            </button>
          </div>
          {!isDefaultView && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-2 h-[34px] px-3 rounded-[6px] border border-border-strong bg-surface text-ink-2 text-[12.5px] font-medium hover:bg-surface-3 hover:text-ink transition-colors"
            >
              <X size={14} /> Limpar filtros
            </button>
          )}
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
              {tableRows.map((d) => {
                // Variação vs. mês imediatamente anterior da mesma NE, por coluna.
                const prev = prevByDocId.get(d.id);
                const empDir = varDir(d.despesasEmpenhadas, prev?.despesasEmpenhadas);
                const liqDir = varDir(d.despesasLiquidadas, prev?.despesasLiquidadas);
                const pagDir = varDir(d.despesasPagas, prev?.despesasPagas);

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
                        <VarArrow dir={empDir} />
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="num text-ink-2">{formatCurrency(d.despesasLiquidadas)}</span>
                        <VarArrow dir={liqDir} />
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="num text-ink-2">{formatCurrency(d.despesasPagas)}</span>
                        <VarArrow dir={pagDir} />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {tableRows.length === 0 && (
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
      </main>

      {/* Modal: importar/substituir dados */}
      {pendingFile && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
          <div
            className="bg-surface border border-border-strong rounded-[8px] max-w-md w-full p-6"
            style={{ boxShadow: 'var(--shadow-menu)' }}
          >
            {importError ? (
              <>
                <div className="flex items-start gap-3 mb-4">
                  <AlertCircle size={20} className="text-danger shrink-0 mt-0.5" />
                  <div>
                    <h2 className="text-[15px] font-bold text-ink mb-1">Falha na importação</h2>
                    <p className="text-[13px] text-ink-2 leading-relaxed">{importError}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={closeImport}
                    className="h-[38px] px-4 rounded-[6px] border border-border-strong bg-surface text-ink-2 text-[13px] font-medium hover:bg-surface-3 hover:text-ink transition-colors"
                  >
                    Fechar
                  </button>
                  <button
                    onClick={confirmImport}
                    className="h-[38px] px-4 rounded-[6px] bg-accent border border-accent text-accent-on text-[13px] font-semibold hover:bg-accent-strong transition-colors"
                  >
                    Tentar novamente
                  </button>
                </div>
              </>
            ) : importDone ? (
              <>
                <div className="flex items-start gap-3 mb-4">
                  <BarChart3 size={20} className="text-accent shrink-0 mt-0.5" />
                  <div>
                    <h2 className="text-[15px] font-bold text-ink mb-1">Dados atualizados</h2>
                    <p className="text-[13px] text-ink-2 leading-relaxed">{importStatus}</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={closeImport}
                    className="h-[38px] px-4 rounded-[6px] bg-accent border border-accent text-accent-on text-[13px] font-semibold hover:bg-accent-strong transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3 mb-4">
                  <AlertTriangle size={20} className="text-warn shrink-0 mt-0.5" />
                  <div>
                    <h2 className="text-[15px] font-bold text-ink mb-1">Substituir todos os dados</h2>
                    <p className="text-[13px] text-ink-2 leading-relaxed">
                      Todos os empenhos atuais serão <strong>apagados</strong> e substituídos pelos dados de{' '}
                      <strong className="break-all">{pendingFile.name}</strong>. Esta ação não pode ser desfeita.
                    </p>
                    {importing && importStatus && (
                      <p className="mt-3 text-[12px] text-ink-3 flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" /> {importStatus}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={closeImport}
                    disabled={importing}
                    className="h-[38px] px-4 rounded-[6px] border border-border-strong bg-surface text-ink-2 text-[13px] font-medium hover:bg-surface-3 hover:text-ink transition-colors disabled:opacity-40"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmImport}
                    disabled={importing}
                    className="h-[38px] px-4 rounded-[6px] bg-danger border border-danger text-white text-[13px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
                  >
                    {importing ? 'Substituindo…' : 'Confirmar — substituir tudo'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
