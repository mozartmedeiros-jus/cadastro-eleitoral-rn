'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, Timestamp } from 'firebase/firestore';
import { db, makeRowId } from '@/lib/firebase';
import { BarChart2, ChevronDown, ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import meta from '@data/meta.json';

// Data de referência dos dados (YYYY-MM-DD → dd/mm/yyyy)
const DATA_REFERENCIA = meta.dataReferencia ? meta.dataReferencia.split('-').reverse().join('/') : null;

interface SecaoDetalhe {
  secao: string;
  aptos: number;
  situacao?: string;
  qde_idosos?: number;
  perc_idosos?: number;
  qde_eleit_c_defic?: number;
  perc_eleit_c_defic?: number;
  qde_analfabetos?: number;
  perc_analfabetos?: number;
}
interface LocationData {
  zona: number | string;
  municipio: string;
  local: string;
  total_secoes: number;
  secoes_detalhes: SecaoDetalhe[];
  tem_secao_aguardando?: boolean;
}

const AGUARDANDO_HINT = 'Cadastro aguardando processamento no TSE';
interface CicloDoc {
  id: string;
  capitalLimit: number;
  interiorLimit: number;
  savedAt: Date | null;
  rows: Record<string, { agregar?: boolean; total?: number }>;
}

function formatNumber(n: number) {
  return new Intl.NumberFormat('pt-BR').format(n || 0);
}
function formatPerc(n: number | undefined): string {
  if (n == null) return '';
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}
function padSecao(s: string) { return s.padStart(4, '0'); }

const PAGE_SIZE = 50;

export default function AgregacoesOverview({ initialData }: { initialData: LocationData[] }) {
  const [ciclos, setCiclos] = useState<CicloDoc[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loadingCiclos, setLoadingCiclos] = useState(true);
  const [zonaFilter, setZonaFilter] = useState('');
  const [municipioFilter, setMunicipioFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'ciclos'), snap => {
      const list: CicloDoc[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          capitalLimit: data.capitalLimit ?? 200,
          interiorLimit: data.interiorLimit ?? 160,
          savedAt: data.savedAt instanceof Timestamp ? data.savedAt.toDate() : null,
          rows: data.rows ?? {},
        };
      }).sort((a, b) => a.id.localeCompare(b.id));
      setCiclos(list);
      setLoadingCiclos(false);
    });
    return () => unsub();
  }, []);

  const ciclo = ciclos.find(c => c.id === selectedId) ?? null;

  // Filtros — quando ciclo selecionado, restringe às zonas/municípios do ciclo
  const uniqueZonas = useMemo(() => {
    const src = ciclo
      ? initialData.filter(r => makeRowId(r.zona, r.municipio, r.local) in ciclo.rows)
      : initialData;
    return Array.from(new Set(src.map(r => String(r.zona))))
      .sort((a, b) => Number(a) - Number(b));
  }, [initialData, ciclo]);

  const uniqueMunicipios = useMemo(() => {
    const src = ciclo
      ? initialData.filter(r => makeRowId(r.zona, r.municipio, r.local) in ciclo.rows)
      : initialData;
    const filtered = zonaFilter ? src.filter(r => String(r.zona) === zonaFilter) : src;
    return Array.from(new Set(filtered.map(r => r.municipio))).sort((a, b) => a.localeCompare(b));
  }, [initialData, zonaFilter, ciclo]);

  // Dataset filtrado — quando ciclo selecionado, exibe só as linhas do ciclo
  const filteredData = useMemo(() => {
    let data = initialData;
    if (ciclo) {
      data = data.filter(r => makeRowId(r.zona, r.municipio, r.local) in ciclo.rows);
    }
    if (zonaFilter) data = data.filter(r => String(r.zona) === zonaFilter);
    if (municipioFilter) data = data.filter(r => r.municipio === municipioFilter);
    return data;
  }, [initialData, zonaFilter, municipioFilter, ciclo]);

  // Mapa rowId → campos do ciclo selecionado
  const cicloMap = useMemo(() => {
    if (!ciclo) return {} as Record<string, { agregar?: boolean; total?: number }>;
    return ciclo.rows;
  }, [ciclo]);

  // KPIs — somente das linhas com agregar=true no ciclo, dentro do filtro aplicado
  const kpis = useMemo(() => {
    if (!ciclo) return null;
    const agregadoRows = filteredData.filter(r =>
      cicloMap[makeRowId(r.zona, r.municipio, r.local)]?.agregar === true
    );
    return {
      locais: agregadoRows.length,
      secoes: agregadoRows.reduce((s, r) => s + (r.secoes_detalhes?.length ?? 0), 0),
      secoesAgregadas: agregadoRows.reduce((s, r) => {
        const rid = makeRowId(r.zona, r.municipio, r.local);
        return s + (cicloMap[rid]?.total ?? 0);
      }, 0),
      totalEleitores: agregadoRows.reduce((s, r) =>
        s + (r.secoes_detalhes ?? []).reduce((ss, sec) => ss + sec.aptos, 0), 0),
    };
  }, [ciclo, filteredData, cicloMap]);

  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredData.slice(start, start + PAGE_SIZE);
  }, [filteredData, currentPage]);

  const getBadgeClass = (aptos: number, limit: number | null) => {
    if (limit === null) return 'bg-surface border-border-strong text-ink-3';
    if (aptos <= 50) return 'bg-danger-soft border-danger-border text-danger';
    if (aptos <= limit) return 'bg-accent-soft border-accent-soft-border text-accent';
    return 'bg-surface border-border-strong text-ink-3';
  };

  return (
    <div className="min-h-full bg-bg text-ink pb-14">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-surface border-b border-border">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] text-ink-3">
              <span className="whitespace-nowrap">Tribunal Regional Eleitoral</span>
              <span className="w-[3px] h-[3px] rounded-full bg-ink-4" />
              <span className="text-accent font-semibold whitespace-nowrap">Cadastro Eleitoral</span>
              {DATA_REFERENCIA && (
                <>
                  <span className="w-[3px] h-[3px] rounded-full bg-ink-4" />
                  <span className="whitespace-nowrap">Dados de {DATA_REFERENCIA}</span>
                </>
              )}
            </div>
            <h1 className="mt-0.5 text-[20px] md:text-[22px] font-bold tracking-[-0.02em] text-ink flex items-center gap-2 leading-tight">
              <BarChart2 size={20} className="text-accent shrink-0" /> Mapeamento de seções e agregações
            </h1>
          </div>

          {/* Filtros — LIMPAR · ZONA · MUNICÍPIO · CICLO */}
          <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
            {(zonaFilter || municipioFilter || selectedId) && (
              <button
                onClick={() => { setZonaFilter(''); setMunicipioFilter(''); setSelectedId(''); setCurrentPage(1); }}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[6px] border border-danger-border bg-danger-soft text-danger text-[13px] font-semibold hover:opacity-80 transition-colors"
              >
                <X size={13} /> Limpar
              </button>
            )}
            <div className="relative">
              <select
                aria-label="Filtrar por zona"
                value={zonaFilter}
                onChange={e => { setZonaFilter(e.target.value); setMunicipioFilter(''); setCurrentPage(1); }}
                className="ds-select h-9 pl-3 pr-8 min-w-[120px] text-[13px]"
              >
                <option value="">Todas as zonas</option>
                {uniqueZonas.map(z => <option key={z} value={z}>Zona {z}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                aria-label="Filtrar por município"
                value={municipioFilter}
                onChange={e => { setMunicipioFilter(e.target.value); setCurrentPage(1); }}
                className="ds-select h-9 pl-3 pr-8 min-w-[170px] text-[13px]"
              >
                <option value="">Todos os municípios</option>
                {uniqueMunicipios.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
            </div>
            <div className="w-px h-6 bg-border" />
            <div className="relative">
              <select
                aria-label="Selecionar ciclo"
                value={selectedId}
                onChange={e => { setSelectedId(e.target.value); setZonaFilter(''); setMunicipioFilter(''); setCurrentPage(1); }}
                disabled={loadingCiclos}
                className="ds-select h-9 pl-3 pr-9 min-w-[140px] text-[13px] font-semibold"
              >
                <option value="">Ciclo…</option>
                {ciclos.map(c => <option key={c.id} value={c.id}>{c.id}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">

        {/* KPIs — só quando ciclo selecionado */}
        {kpis && (
          <>
            <div className="flex items-baseline gap-3 mb-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.06em] text-ink-2 whitespace-nowrap">
                Resumo do ciclo {selectedId}
              </h2>
              {ciclo?.savedAt && (
                <span className="text-[11px] text-ink-4">
                  salvo em {ciclo.savedAt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  {' · '}Capital {ciclo.capitalLimit} · Interior {ciclo.interiorLimit}
                </span>
              )}
              <span className="flex-1 h-px bg-border" />
            </div>
            <section className="ds-card overflow-hidden mb-6">
              <div className="grid grid-cols-2 md:grid-cols-4">
                {[
                  { label: 'Locais',             value: kpis.locais },
                  { label: 'Seções',             value: kpis.secoes },
                  { label: 'Seções agregadas',   value: kpis.secoesAgregadas },
                  { label: 'Total de eleitores', value: kpis.totalEleitores },
                ].map((k, i) => (
                  <div key={k.label} className={`p-4 border-border-faint ${i % 4 !== 3 ? 'md:border-r' : ''} max-md:[&:nth-child(odd)]:border-r max-md:[&:nth-child(n+3)]:border-t`}>
                    <div className="text-[10px] font-bold uppercase tracking-[0.05em] text-ink-3 leading-[1.3]">{k.label}</div>
                    <div className="num mt-1.5 text-[21px] font-bold tracking-[-0.02em] leading-none text-ink">{formatNumber(k.value)}</div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* Tabela */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <h2 className="text-xs font-bold uppercase tracking-[0.06em] text-ink-2 whitespace-nowrap">
            Locais de votação
          </h2>
          <span className="text-[11.5px] text-ink-4 whitespace-nowrap">
            {formatNumber(filteredData.length)} locais
            {ciclo ? ` · ciclo ${selectedId} aplicado` : ''}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-ink-4 whitespace-nowrap">
            <ChevronDown size={11} /> expande estatísticas por seção
          </span>
          <span className="text-[11.5px] text-ink-3 whitespace-nowrap">
            <span className="text-warn font-bold">*</span> {AGUARDANDO_HINT}
          </span>
          <span className="flex-1 h-px bg-border" />
          {/* Legenda — só com ciclo selecionado */}
          {ciclo && <div className="flex items-center gap-4 flex-wrap text-[12px] text-ink-3">
            <div className="flex items-center gap-1.5">
              <span className="w-[22px] h-[14px] rounded-[3px] bg-danger-soft border border-danger-border" />
              <span>≤ 50 eleitores</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-[22px] h-[14px] rounded-[3px] bg-accent-soft border border-accent-soft-border" />
              <span>dentro do limite</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-[22px] h-[14px] rounded-[3px] bg-surface border border-border-strong" />
              <span>acima do limite</span>
            </div>
          </div>}
        </div>

        <section className="ds-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-surface-2 border-b border-border-strong [&>th]:px-4 [&>th]:py-3 [&>th]:text-[10px] [&>th]:font-bold [&>th]:uppercase [&>th]:tracking-[0.07em] [&>th]:text-ink-3 [&>th]:whitespace-nowrap">
                  <th className="!px-2 w-8" />
                  <th className="text-center">Zona</th>
                  <th>Município</th>
                  <th>Local de Votação</th>
                  <th>Seções <span className="text-ink-4 font-medium normal-case tracking-normal">(seção · eleitores)</span></th>
                  {ciclo && <th className="text-center">Agregar</th>}
                  {ciclo && <th className="text-center">Total</th>}
                </tr>
              </thead>
              <tbody className="text-sm text-ink-2">
                {paginatedData.map(row => {
                  const rowId = makeRowId(row.zona, row.municipio, row.local);
                  const cicloFields = cicloMap[rowId];
                  const isCapital = row.municipio.trim().toUpperCase() === 'NATAL';
                  const limit = ciclo
                    ? (isCapital ? ciclo.capitalLimit : ciclo.interiorLimit)
                    : null;
                  const isExpanded = expandedRowId === rowId;
                  return (
                    <>
                      <tr key={rowId} className={`border-b border-border-faint transition-colors ${isExpanded ? 'bg-accent-soft' : 'hover:bg-surface-2'}`}>
                        <td className="px-2 py-3 text-center">
                          <button
                            onClick={() => setExpandedRowId(isExpanded ? null : rowId)}
                            className="flex items-center justify-center w-6 h-6 mx-auto rounded-[4px] hover:bg-surface-3 transition-colors"
                            aria-label={isExpanded ? 'Recolher seções' : 'Expandir seções'}
                            aria-expanded={isExpanded}
                          >
                            <ChevronDown
                              size={13}
                              className={`text-ink-4 transition-transform duration-150 motion-reduce:transition-none ${isExpanded ? 'rotate-180' : ''}`}
                            />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-ink-2 num">{row.zona}</td>
                        <td className="px-4 py-3 font-semibold text-ink whitespace-nowrap">
                          {row.municipio}
                          <div className="text-[10px] font-medium text-ink-4">{isCapital ? 'capital' : 'interior'}</div>
                        </td>
                        <td className="px-4 py-3 font-medium text-ink">
                          {row.local}
                          {row.tem_secao_aguardando && <span className="text-warn font-bold" title={AGUARDANDO_HINT} aria-label={AGUARDANDO_HINT}>*</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="grid grid-cols-[repeat(auto-fill,94px)] gap-[5px] max-w-[600px]">
                            {(row.secoes_detalhes ?? []).map(s => (
                              <span
                                key={s.secao}
                                className={`flex items-center justify-between gap-1.5 px-2 py-[3px] rounded-[4px] border text-[11.5px] font-mono num whitespace-nowrap ${getBadgeClass(s.aptos, limit)}`}
                                title={s.situacao ? `Seção ${padSecao(s.secao)} · ${AGUARDANDO_HINT}` : undefined}
                              >
                                <span className="font-bold">{padSecao(s.secao)}{s.situacao && <span className="text-warn">*</span>}</span>
                                <span className="opacity-40">·</span>
                                <span className="font-semibold">{formatNumber(s.aptos)}</span>
                              </span>
                            ))}
                          </div>
                        </td>
                        {ciclo && (
                          <td className="px-4 py-3 text-center">
                            {cicloFields?.agregar
                              ? <Check size={15} className="text-accent inline" />
                              : <span className="text-ink-4">—</span>}
                          </td>
                        )}
                        {ciclo && (
                          <td className="px-4 py-3 text-center font-bold num text-ink">
                            {cicloFields?.total !== undefined ? cicloFields.total : <span className="text-ink-4">—</span>}
                          </td>
                        )}
                      </tr>
                      {isExpanded && (
                        <tr key={`${rowId}-secoes`} className="border-b border-border-faint">
                          <td colSpan={4} className="p-0" />
                          <td className="px-4 py-3">
                            <div className="border border-border rounded-[6px] overflow-hidden">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="bg-surface-3 border-b border-border">
                                    {['Seção', 'Idosos', 'C/ Deficiência', 'Analfabetos'].map(col => (
                                      <th key={col} className="px-3 py-1.5 text-[9.5px] font-bold uppercase tracking-[0.07em] text-ink-3 whitespace-nowrap">
                                        {col}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {(row.secoes_detalhes ?? []).map(s => (
                                    <tr key={s.secao} className="border-b border-border-faint last:border-0 bg-surface-2">
                                      <td className="px-3 py-1.5 num text-[12px] font-semibold text-ink-2">{padSecao(s.secao)}</td>
                                      <td className="px-3 py-1.5 num text-[12px] text-ink">
                                        {s.qde_idosos != null ? `${s.qde_idosos} (${formatPerc(s.perc_idosos)}%)` : '—'}
                                      </td>
                                      <td className="px-3 py-1.5 num text-[12px] text-ink">
                                        {s.qde_eleit_c_defic != null ? `${s.qde_eleit_c_defic} (${formatPerc(s.perc_eleit_c_defic)}%)` : '—'}
                                      </td>
                                      <td className="px-3 py-1.5 num text-[12px] text-ink">
                                        {s.qde_analfabetos != null ? `${s.qde_analfabetos} (${formatPerc(s.perc_analfabetos)}%)` : '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                          {ciclo && <td colSpan={2} className="p-0" />}
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-4 py-3 bg-surface-2 border-t border-border flex items-center justify-between gap-4 flex-wrap">
              <span className="text-[12.5px] text-ink-3">
                Página <strong className="text-ink">{currentPage}</strong> de <strong className="text-ink">{totalPages}</strong>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 h-8 px-3 rounded-[4px] bg-surface border border-border-strong text-[12.5px] font-semibold text-ink-2 hover:bg-surface-3 hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={14} /> Anterior
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 h-8 px-3 rounded-[4px] bg-surface border border-border-strong text-[12.5px] font-semibold text-ink-2 hover:bg-surface-3 hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Próxima <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
