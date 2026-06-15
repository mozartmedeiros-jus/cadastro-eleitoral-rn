'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ClipboardList,
  Search,
  Filter,
  Check,
  Minus,
  AlertCircle,
  X,
} from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';

interface Item {
  id: string;
  setor: string;
  ua: string;
  pi: string;
  despesaAgregada: string;
  itemDespesa: string;
  naturezaDespesa: string;
  vlrPropostaRef: number;
  vlrUnidade: number;
  memoriaCalculo: string;
  vlrAjusteStie: number;
  vlrAprovacaoCogel: number;
  vlrAprovado: number;
  seiNe: string;
  vlrEstimado: number;
  vlrEmpenhado: number;
  vlrPago: number;
  justificativa: string;
  status: 'lancamento' | 'aprovacao' | 'execucao';
  ano: number;
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
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

type StatusFilter = 'all' | 'comNe' | 'semNe';

// Cabeçalho de seção (mesmo padrão da tela de Execução Orçamentária).
function SectionHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-3 mt-1 mb-3">
      <h2 className="text-xs font-bold uppercase tracking-[0.06em] text-ink-2 whitespace-nowrap">{title}</h2>
      {hint && <span className="text-[11.5px] text-ink-4 whitespace-nowrap">{hint}</span>}
      <span className="flex-1 h-px bg-border" />
    </div>
  );
}

export default function SpleClient() {
  const { user, authReady, canEdit } = useAuth();
  const [data, setData] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [uaFilter, setUaFilter] = useState<string>('all');
  const [piFilter, setPiFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!canEdit) return;

    const unsub = onSnapshot(collection(db, 'opl_itens'), (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Item[];
      setData(docs);
      setLoading(false);
    });

    return () => unsub();
  }, [canEdit]);

  // Opções dos filtros
  const uniqueUas = useMemo(() => Array.from(new Set(data.map(d => d.ua))).sort(), [data]);
  const uniquePis = useMemo(() => {
    const base = uaFilter === 'all' ? data : data.filter(d => d.ua === uaFilter);
    return Array.from(new Set(base.map(d => d.pi))).sort();
  }, [data, uaFilter]);

  // Indicadores sobre todo o conjunto (posição geral do exercício)
  const kpis = useMemo(() => {
    const comNe = data.filter(d => d.seiNe !== '').length;
    const aprovado = data.reduce((a, c) => a + c.vlrAprovado, 0);
    const empenhado = data.reduce((a, c) => a + c.vlrEmpenhado, 0);
    return {
      total: data.length,
      comNe,
      aprovado,
      pctEmpenhado: aprovado ? empenhado / aprovado : 0,
    };
  }, [data]);

  // Linhas filtradas, ordenadas UA → PI
  const matchesText = useMemo(() => {
    const term = search.toLowerCase();
    return (d: Item) =>
      !term ||
      d.ua.toLowerCase().includes(term) ||
      d.pi.toLowerCase().includes(term) ||
      d.itemDespesa.toLowerCase().includes(term) ||
      d.seiNe.toLowerCase().includes(term);
  }, [search]);

  const tableRows = useMemo(() => {
    return data
      .filter(d => {
        const matchUa = uaFilter === 'all' || d.ua === uaFilter;
        const matchPi = piFilter === 'all' || d.pi === piFilter;
        const matchStatus =
          statusFilter === 'all' ||
          (statusFilter === 'comNe' ? d.seiNe !== '' : d.seiNe === '');
        return matchUa && matchPi && matchStatus && matchesText(d);
      })
      .sort((a, b) => a.ua.localeCompare(b.ua) || a.pi.localeCompare(b.pi));
  }, [data, uaFilter, piFilter, statusFilter, matchesText]);

  // Reseta PI quando troca a UA (o PI pode não existir na nova UA).
  useEffect(() => {
    setPiFilter('all');
  }, [uaFilter]);

  const isDefaultView =
    uaFilter === 'all' && piFilter === 'all' && statusFilter === 'all' && search.trim() === '';
  const clearFilters = () => {
    setUaFilter('all');
    setPiFilter('all');
    setStatusFilter('all');
    setSearch('');
  };

  const indicadores = [
    { label: 'Itens', value: String(kpis.total), title: `${kpis.total} itens de despesa`, sub: 'total de lançamentos', accent: false },
    { label: 'Com NE emitida', value: String(kpis.comNe), title: `${kpis.comNe} itens com SEI/NE`, sub: 'em execução', accent: false },
    { label: 'Aprovado', value: formatCompactCurrency(kpis.aprovado), title: formatCurrency(kpis.aprovado), sub: 'valor aprovado total', accent: false },
    { label: 'Empenhado', value: formatPercent(kpis.pctEmpenhado), title: 'empenhado / aprovado', sub: 'do valor aprovado', accent: true },
  ];

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
        <p className="text-ink-2 mb-6">Você precisa estar logado para visualizar a Gestão SPLE.</p>
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
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-surface border-b border-border">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] text-ink-3">
              <span className="whitespace-nowrap">Tribunal Regional Eleitoral</span>
              <span className="w-[3px] h-[3px] rounded-full bg-ink-4" />
              <span className="text-accent font-semibold whitespace-nowrap">Gestão SPLE</span>
            </div>
            <h1 className="mt-0.5 text-[20px] md:text-[22px] font-bold tracking-[-0.02em] text-ink flex items-center gap-2 leading-tight">
              <ClipboardList size={20} className="text-accent shrink-0" />
              Gestão SPLE · Exercício 2026
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* Indicadores */}
        <SectionHead title="Indicadores" hint="posição geral do exercício" />
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

        {/* Filtros */}
        <SectionHead
          title="Itens"
          hint={`${tableRows.length} ${tableRows.length === 1 ? 'item' : 'itens'}`}
        />
        <section className="ds-card p-4 mb-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-ink-3 mb-1.5 block">Buscar</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" />
                <input
                  type="text"
                  placeholder="UA, PI, item ou SEI…"
                  className="ds-input w-full pl-10"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-ink-3 mb-1.5 block">Unidade (UA)</label>
              <div className="relative">
                <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4 pointer-events-none" />
                <select className="ds-select w-full pl-10 pr-10" value={uaFilter} onChange={e => setUaFilter(e.target.value)}>
                  <option value="all">Todas as UA</option>
                  {uniqueUas.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-ink-3 mb-1.5 block">Plano (PI)</label>
              <div className="relative">
                <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4 pointer-events-none" />
                <select className="ds-select w-full pl-10 pr-10" value={piFilter} onChange={e => setPiFilter(e.target.value)}>
                  <option value="all">Todos os PI</option>
                  {uniquePis.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-ink-3 mb-1.5 block">Status</label>
              <div className="relative">
                <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4 pointer-events-none" />
                <select className="ds-select w-full pl-10 pr-10" value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}>
                  <option value="all">Todos</option>
                  <option value="comNe">Com NE</option>
                  <option value="semNe">Sem NE</option>
                </select>
              </div>
            </div>
          </div>

          {!isDefaultView && (
            <div className="flex justify-end mt-4 pt-3 border-t border-border">
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-2 h-[34px] px-3 rounded-[6px] border border-danger-border bg-danger-soft text-danger text-[12.5px] font-medium hover:brightness-95 transition"
              >
                <X size={14} /> Limpar filtros
              </button>
            </div>
          )}
        </section>

        {/* Tabela */}
        <section className="ds-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-2 border-b border-border-strong [&>th]:px-4 [&>th]:py-3 [&>th]:text-[10px] [&>th]:font-bold [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-ink-3">
                  <th>UA</th>
                  <th>PI</th>
                  <th>Item da Despesa</th>
                  <th className="text-right">Aprovado</th>
                  <th className="text-right">Estimado</th>
                  <th className="text-right">Empenhado</th>
                  <th className="text-right">Pago</th>
                  <th className="text-center">SEI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-faint text-sm">
                {tableRows.map((d) => {
                  const temSei = d.seiNe !== '';
                  return (
                    <tr key={d.id} className="row-hover">
                      <td className="px-4 py-4 whitespace-nowrap font-bold text-ink num">{d.ua}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-ink-2 num">{d.pi}</td>
                      <td className="px-4 py-4 max-w-xs md:max-w-md">
                        <div className="font-medium text-ink line-clamp-1">{d.itemDespesa || '—'}</div>
                        <div className="text-[11px] text-ink-4 mt-0.5 num">{d.naturezaDespesa}</div>
                      </td>
                      <td className="px-4 py-4 text-right num font-bold text-ink">{formatCurrency(d.vlrAprovado)}</td>
                      <td className="px-4 py-4 text-right num text-ink-2">{formatCurrency(d.vlrEstimado)}</td>
                      <td className="px-4 py-4 text-right num text-ink-2">{formatCurrency(d.vlrEmpenhado)}</td>
                      <td className="px-4 py-4 text-right num text-ink-2">{formatCurrency(d.vlrPago)}</td>
                      <td className="px-4 py-4 text-center">
                        {temSei ? (
                          <span className="inline-flex" title={d.seiNe}>
                            <Check size={16} className="text-accent" aria-label="NE emitida" />
                          </span>
                        ) : (
                          <Minus size={16} className="text-ink-4 inline-block" aria-label="sem NE" />
                        )}
                      </td>
                    </tr>
                  );
                })}
                {tableRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-ink-4 italic">
                      Nenhum item encontrado para os filtros aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
