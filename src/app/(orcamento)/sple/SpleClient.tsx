'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ClipboardList,
  Search,
  Filter,
  Check,
  Minus,
  AlertCircle,
  AlertTriangle,
  Upload,
  Loader2,
  X,
} from 'lucide-react';
import {
  collection,
  onSnapshot,
  getDocs,
  writeBatch,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { parseItens, SETOR_SHEETS } from '@/lib/sple-xlsx';

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

// Tamanho máximo por lote do Firestore client SDK
const BATCH_LIMIT = 500;

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

  // Import de novo .xlsx (substitui todos os dados)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importDone, setImportDone] = useState(false);

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
      const sheets = SETOR_SHEETS
        .filter(s => wb.Sheets[s])
        .map(s => ({ setor: s, rows: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[s], { header: 1 }) }));
      const novos = parseItens(sheets);

      if (novos.length === 0) {
        throw new Error(
          'Nenhum item válido encontrado. Confira se o arquivo segue o layout da planilha do SPLE (abas por setor).',
        );
      }

      const col = collection(db, 'opl_itens');
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

      setImportStatus(`${novos.length} itens importados com sucesso.`);
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
                  <ClipboardList size={20} className="text-accent shrink-0 mt-0.5" />
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
                      Todos os itens atuais serão <strong>apagados</strong> e substituídos pelos dados de{' '}
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
