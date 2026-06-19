'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search, ChevronDown, ChevronLeft, ChevronRight, MapPin, X, Check, AlertCircle, Loader2,
} from 'lucide-react';
import { MesaMrj, fetchMrj, temMrj } from '@/lib/mrj-csv';

function SectionHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-3 mt-1 mb-3">
      <h2 className="text-xs font-bold uppercase tracking-[0.06em] text-ink-2 whitespace-nowrap">{title}</h2>
      {hint && <span className="text-[11.5px] text-ink-4 whitespace-nowrap">{hint}</span>}
      <span className="flex-1 h-px bg-border" />
    </div>
  );
}

// Badge booleano "Sim/—" (mesmo padrão da coluna Transmissão de PontosApoioPanel).
function SimBadge({ on }: { on: boolean }) {
  if (!on) return <span className="text-ink-4">—</span>;
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold rounded-[4px] px-2 py-0.5 text-accent bg-accent-soft border border-accent-soft-border">
      <Check size={11} /> Sim
    </span>
  );
}

export default function MrjPanel({
  url,
  onFilteredChange,
  onControlsChange,
}: {
  url: string;
  onFilteredChange: (rows: MesaMrj[]) => void;
  onControlsChange?: (c: { lastUpdated: Date | null; refreshing: boolean; refresh: () => void }) => void;
}) {
  const [mrj, setMrj] = useState<MesaMrj[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [selectedZona, setSelectedZona] = useState('');
  const [selectedMuni, setSelectedMuni] = useState('');
  const [selectedTurno, setSelectedTurno] = useState<'' | '1' | '2' | '2sv'>('');

  // Paginação (mesmo padrão de CadastroClient / PontosApoioPanel)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // initial=true usa o loader de painel inteiro (1ª carga); recargas (botão) usam `refreshing`,
  // mantendo a tabela visível.
  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true); else setRefreshing(true);
    setError(null);
    try {
      const rows = await fetchMrj(url);
      setMrj(rows);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar os dados.');
    } finally {
      if (initial) setLoading(false); else setRefreshing(false);
    }
  }, [url]);

  useEffect(() => {
    load(true);
  }, [load]);

  // Eleva os controles (Atualizar + carimbo) para a barra de controle do CadastroClient
  useEffect(() => {
    onControlsChange?.({ lastUpdated, refreshing, refresh: () => load() });
  }, [lastUpdated, refreshing, load, onControlsChange]);

  const zonas = useMemo(
    () => Array.from(new Set(mrj.map((m) => m.zona).filter(Boolean)))
      .sort((a, b) => {
        const na = parseInt(a, 10);
        const nb = parseInt(b, 10);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return a.localeCompare(b);
      }),
    [mrj],
  );

  const municipios = useMemo(
    () => Array.from(new Set(mrj.map((m) => m.municipio).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [mrj],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mrj.filter((m) => {
      const matchSearch = q === '' ||
        m.local.toLowerCase().includes(q) ||
        m.endereco.toLowerCase().includes(q);
      const matchZona = selectedZona === '' || m.zona === selectedZona;
      const matchMuni = selectedMuni === '' || m.municipio === selectedMuni;
      const matchTurno = selectedTurno === '' ||
        (selectedTurno === '1' ? m.primeiroTurno
          : selectedTurno === '2' ? m.segundoTurno
            : m.segundoTurnoSemVotacao);
      return matchSearch && matchZona && matchMuni && matchTurno;
    });
  }, [mrj, search, selectedZona, selectedMuni, selectedTurno]);

  useEffect(() => {
    onFilteredChange(filtered);
  }, [filtered, onFilteredChange]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedZona, selectedMuni, selectedTurno, pageSize]);

  const kpis = useMemo(() => ({
    totalLocais: filtered.length,
    totalZonas: new Set(filtered.map((m) => m.zona).filter(Boolean)).size,
    totalPrimeiro: filtered.filter((m) => m.primeiroTurno).length,
    totalSegundo: filtered.filter((m) => m.segundoTurno).length,
    totalSegundoSemVotacao: filtered.filter((m) => m.segundoTurnoSemVotacao).length,
  }), [filtered]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const hasFilter = search || selectedZona || selectedMuni || selectedTurno;
  const handleClearFilters = () => {
    setSearch('');
    setSelectedZona('');
    setSelectedMuni('');
    setSelectedTurno('');
  };

  if (loading) {
    return (
      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="ds-card p-14 flex flex-col items-center justify-center gap-3 text-ink-3">
          <Loader2 size={24} className="animate-spin motion-reduce:animate-none text-accent" />
          <span className="text-[13.5px]">Carregando mesas receptoras de justificativa…</span>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="ds-card p-8 flex flex-col items-center justify-center gap-3 text-center">
          <AlertCircle size={26} className="text-danger" />
          <div className="text-[14px] font-bold text-ink">Não foi possível carregar os dados</div>
          <p className="text-[12.5px] text-ink-3 max-w-md leading-relaxed">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
      {/* ── KPIs ────────────────────────────────────────────────── */}
      <SectionHead title="Indicadores" hint="conforme filtros aplicados" />
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 mb-7">
        <div className="relative ds-card p-[18px] overflow-hidden">
          <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent" />
          <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-3">Zonas</div>
          <div className="num mt-2 text-[30px] font-bold tracking-[-0.025em] leading-none text-accent">{kpis.totalZonas}</div>
          <div className="mt-[7px] text-[11px] text-ink-4">zonas distintas</div>
        </div>
        <div className="relative ds-card p-[18px] overflow-hidden">
          <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent" />
          <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-3">Total de locais</div>
          <div className="num mt-2 text-[30px] font-bold tracking-[-0.025em] leading-none text-ink">{kpis.totalLocais}</div>
          <div className="mt-[7px] text-[11px] text-ink-4">locais listados</div>
        </div>
        <div className="relative ds-card p-[18px] overflow-hidden">
          <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent" />
          <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-3">1º Turno</div>
          <div className="num mt-2 text-[30px] font-bold tracking-[-0.025em] leading-none text-ink">{kpis.totalPrimeiro}</div>
          <div className="mt-[7px] text-[11px] text-ink-4">locais no 1º turno</div>
        </div>
        <div className="relative ds-card p-[18px] overflow-hidden">
          <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent" />
          <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-3">2º Turno</div>
          <div className="num mt-2 text-[30px] font-bold tracking-[-0.025em] leading-none text-ink">{kpis.totalSegundo}</div>
          <div className="mt-[7px] text-[11px] text-ink-4">locais no 2º turno</div>
        </div>
        <div className="relative ds-card p-[18px] overflow-hidden">
          <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent" />
          <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-3">2º Turno (s/ votação)</div>
          <div className="num mt-2 text-[30px] font-bold tracking-[-0.025em] leading-none text-ink">{kpis.totalSegundoSemVotacao}</div>
          <div className="mt-[7px] text-[11px] text-ink-4">sem votação no RN</div>
        </div>
      </section>

      {/* ── Barra de filtros ──────────────────────────────────────── */}
      <section className="ds-card p-3.5 mb-[18px] flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        <div className="flex-1 relative min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4 pointer-events-none" size={16} />
          <input
            type="text"
            aria-label="Buscar local ou endereço"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar local ou endereço…"
            className="ds-input w-full pl-9 pr-4"
          />
        </div>

        <div className="flex flex-wrap sm:flex-nowrap gap-3">
          <div className="relative min-w-[140px] w-full sm:w-auto">
            <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4 pointer-events-none" />
            <select
              aria-label="Filtrar por zona"
              value={selectedZona}
              onChange={(e) => setSelectedZona(e.target.value)}
              className="ds-select w-full pl-9 pr-9"
            >
              <option value="">Todas as zonas</option>
              {zonas.map((z) => (
                <option key={z} value={z}>Zona {z}</option>
              ))}
            </select>
            <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
          </div>

          <div className="relative min-w-[180px] w-full sm:w-auto">
            <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4 pointer-events-none" />
            <select
              aria-label="Filtrar por município"
              value={selectedMuni}
              onChange={(e) => setSelectedMuni(e.target.value)}
              className="ds-select w-full pl-9 pr-9"
            >
              <option value="">Todos os municípios</option>
              {municipios.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
          </div>

          <div className="relative min-w-[180px] w-full sm:w-auto">
            <select
              aria-label="Filtrar por turno"
              value={selectedTurno}
              onChange={(e) => setSelectedTurno(e.target.value as '' | '1' | '2' | '2sv')}
              className="ds-select w-full pl-3 pr-9"
            >
              <option value="">Todos os turnos</option>
              <option value="1">1º turno</option>
              <option value="2">2º turno</option>
              <option value="2sv">2º turno (sem votação)</option>
            </select>
            <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
          </div>

          {hasFilter && (
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-[6px] border border-border-strong bg-surface text-ink-2 text-[13px] font-semibold hover:text-danger hover:border-danger-border hover:bg-danger-soft transition-colors"
            >
              <X size={14} /> Limpar
            </button>
          )}
        </div>
      </section>

      {/* ── Tabela ────────────────────────────────────────────────── */}
      <section className="ds-card overflow-hidden">
        <div className="overflow-x-auto scroll-x">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-surface-2 border-b border-border-strong [&>th]:sticky [&>th]:top-0 [&>th]:bg-surface-2 [&>th]:whitespace-nowrap [&>th]:align-middle [&>th]:px-4 [&>th]:py-3 [&>th]:text-[10px] [&>th]:font-bold [&>th]:uppercase [&>th]:tracking-[0.07em] [&>th]:text-ink-3">
                <th className="text-center">Zona</th>
                <th>Município</th>
                <th>Local</th>
                <th>Endereço</th>
                <th className="text-center">1º Turno</th>
                <th className="text-center">2º Turno</th>
                <th className="text-center">2º Turno (s/ votação)</th>
              </tr>
            </thead>
            <tbody className="text-sm text-ink-2">
              {paginated.map((m, i) => {
                const semMrj = !temMrj(m);
                return (
                  <tr key={`${m.municipio}-${m.local}-${i}`} className="row-hover border-b border-border-faint transition-colors">
                    <td className="px-4 py-[11px] text-center font-semibold num text-ink-2">{m.zona || '—'}</td>
                    <td className="px-4 py-[11px] font-semibold whitespace-nowrap text-ink">{m.municipio || '—'}</td>
                    <td className="px-4 py-[11px] min-w-[240px]">
                      {semMrj ? (
                        <span className="inline-flex items-center font-mono text-[11px] font-semibold uppercase tracking-[0.04em] rounded-[4px] px-2 py-0.5 text-ink-3 bg-surface-3 border border-border-strong">
                          Não haverá MRJ
                        </span>
                      ) : (
                        <span className="whitespace-normal break-words leading-snug font-medium text-ink">{m.local || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-[11px] text-ink-2 min-w-[260px]">
                      {semMrj ? <span className="text-ink-4">—</span> : (
                        <span className="whitespace-normal break-words leading-snug">{m.endereco || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-[11px] text-center"><SimBadge on={m.primeiroTurno} /></td>
                    <td className="px-4 py-[11px] text-center"><SimBadge on={m.segundoTurno} /></td>
                    <td className="px-4 py-[11px] text-center"><SimBadge on={m.segundoTurnoSemVotacao} /></td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-14 text-center text-ink-3 text-[13.5px]">
                    Nenhuma mesa receptora de justificativa corresponde aos filtros informados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé de paginação */}
        {filtered.length > 0 && (
          <div className="px-4 py-3 bg-surface-2 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-[12.5px] text-ink-3">
              Exibindo <span className="text-ink font-bold num">{(currentPage - 1) * pageSize + 1}</span>–
              <span className="text-ink font-bold num">{Math.min(currentPage * pageSize, filtered.length)}</span> de{' '}
              <span className="text-ink font-bold num">{filtered.length}</span> locais
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-[12.5px] text-ink-3">Por página:</span>
                <div className="relative">
                  <select
                    aria-label="Itens por página"
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="h-8 pl-2.5 pr-7 appearance-none rounded-[4px] bg-surface border border-border-strong text-[12.5px] text-ink cursor-pointer outline-none focus:border-accent"
                  >
                    {[10, 25, 50, 100, 250].map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex items-center gap-1 h-8 px-3 rounded-[4px] bg-surface border border-border-strong text-[12.5px] font-semibold text-ink-2 hover:bg-surface-3 hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={14} /> Anterior
                </button>

                <span className="text-[12.5px] text-ink-3 px-1.5">
                  Pág. <span className="text-ink font-bold">{currentPage}</span> de <span className="text-ink font-bold">{totalPages}</span>
                </span>

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="inline-flex items-center gap-1 h-8 px-3 rounded-[4px] bg-surface border border-border-strong text-[12.5px] font-semibold text-ink-2 hover:bg-surface-3 hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Próxima <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
