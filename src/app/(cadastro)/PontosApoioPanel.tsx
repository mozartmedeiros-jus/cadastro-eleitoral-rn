'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search, ChevronDown, ChevronLeft, ChevronRight, MapPin, X, Radio, Check, Plus, Pencil, AlertCircle, Loader2,
} from 'lucide-react';
import { PontoApoio, fetchPontos } from '@/lib/pontos-apoio-csv';

function SectionHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-3 mt-1 mb-3">
      <h2 className="text-xs font-bold uppercase tracking-[0.06em] text-ink-2 whitespace-nowrap">{title}</h2>
      {hint && <span className="text-[11.5px] text-ink-4 whitespace-nowrap">{hint}</span>}
      <span className="flex-1 h-px bg-border" />
    </div>
  );
}

// Coluna "PONTO DE APOIO" (apoio): APOIO mostra "Sim"; os demais marcadores de ação
// (INCLUIR/ALTERAR/EXCLUIR) viram badges próprios. Valor vazio/desconhecido → "—".
const APOIO_BADGES: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
  APOIO:   { label: 'Sim',     cls: 'text-accent bg-accent-soft border-accent-soft-border', Icon: Check },
  INCLUIR: { label: 'Incluir', cls: 'text-ink-2 bg-surface-3 border-border-strong',         Icon: Plus },
  ALTERAR: { label: 'Alterar', cls: 'text-warn bg-warn-soft border-warn-border',            Icon: Pencil },
  EXCLUIR: { label: 'Excluir', cls: 'text-danger bg-danger-soft border-danger-border',      Icon: X },
};

function ApoioBadge({ value }: { value: string }) {
  const badge = APOIO_BADGES[value.trim().toUpperCase()];
  if (!badge) return <span className="text-ink-4">—</span>;
  const { label, cls, Icon } = badge;
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-[11px] font-semibold rounded-[4px] px-2 py-0.5 border ${cls}`}>
      <Icon size={11} /> {label}
    </span>
  );
}

export default function PontosApoioPanel({
  url,
  onFilteredChange,
  onControlsChange,
}: {
  url: string;
  onFilteredChange: (rows: PontoApoio[]) => void;
  onControlsChange?: (c: { lastUpdated: Date | null; refreshing: boolean; refresh: () => void }) => void;
}) {
  const [pontos, setPontos] = useState<PontoApoio[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [selectedZona, setSelectedZona] = useState('');
  const [selectedMuni, setSelectedMuni] = useState('');
  const [selectedFlag, setSelectedFlag] = useState<'' | 'transmissao' | 'demaisTransmissao' | 'apoio' | 'apoioTransmissao' | 'demais'>('');

  // Paginação (mesmo padrão de CadastroClient)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // initial=true usa o loader de painel inteiro (1ª carga); recargas (botão) usam `refreshing`,
  // mantendo a tabela visível.
  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true); else setRefreshing(true);
    setError(null);
    try {
      const rows = await fetchPontos(url);
      setPontos(rows);
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

  // Filtragem facetada: as opções de cada filtro respeitam a seleção de todos os outros
  const facetOptions = useMemo(() => {
    const zonas = new Set<string>();
    const munis = new Set<string>();
    const flags = { transmissao: false, demaisTransmissao: false, apoio: false, apoioTransmissao: false, demais: false };

    pontos.forEach((p) => {
      const apoioUp = p.apoio.trim().toUpperCase();
      const isApoio = apoioUp === 'APOIO';
      const isDemais = apoioUp === 'INCLUIR' || apoioUp === 'ALTERAR' || apoioUp === 'EXCLUIR';
      const isTransmissao = p.transmissaoRaw.toUpperCase() === 'TRANSMISSÃO';
      const isDemaisTransm = p.transmissao && !isTransmissao;
      const matchZona = selectedZona === '' || p.zona === selectedZona;
      const matchMuni = selectedMuni === '' || p.municipio === selectedMuni;
      const matchFlag =
        selectedFlag === '' ? true
        : selectedFlag === 'transmissao' ? isTransmissao
        : selectedFlag === 'demaisTransmissao' ? isDemaisTransm
        : selectedFlag === 'apoio' ? isApoio
        : selectedFlag === 'apoioTransmissao' ? isApoio && isTransmissao
        : isDemais;

      if (p.zona && matchMuni && matchFlag) zonas.add(p.zona);
      if (p.municipio && matchZona && matchFlag) munis.add(p.municipio);
      if (matchZona && matchMuni) {
        if (isTransmissao) flags.transmissao = true;
        if (isDemaisTransm) flags.demaisTransmissao = true;
        if (isApoio) flags.apoio = true;
        if (isApoio && isTransmissao) flags.apoioTransmissao = true;
        if (isDemais) flags.demais = true;
      }
    });

    return {
      zonas: Array.from(zonas).sort((a, b) => {
        const na = parseInt(a, 10);
        const nb = parseInt(b, 10);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return a.localeCompare(b);
      }),
      municipios: Array.from(munis).sort((a, b) => a.localeCompare(b)),
      flags,
    };
  }, [pontos, selectedZona, selectedMuni, selectedFlag]);

  // Auto-clear: se a seleção atual deixou de ser válida após o cruzamento, limpa
  useEffect(() => {
    if (selectedZona && !facetOptions.zonas.includes(selectedZona)) setSelectedZona('');
    if (selectedMuni && !facetOptions.municipios.includes(selectedMuni)) setSelectedMuni('');
    if (selectedFlag && !facetOptions.flags[selectedFlag]) setSelectedFlag('');
  }, [facetOptions, selectedZona, selectedMuni, selectedFlag]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pontos.filter((p) => {
      const matchSearch = q === '' ||
        p.local.toLowerCase().includes(q) ||
        p.endereco.toLowerCase().includes(q);
      const matchZona = selectedZona === '' || p.zona === selectedZona;
      const matchMuni = selectedMuni === '' || p.municipio === selectedMuni;
      const apoioUp = p.apoio.trim().toUpperCase();
      const isTransmissao = p.transmissaoRaw.toUpperCase() === 'TRANSMISSÃO';
      const matchFlag =
        selectedFlag === '' ? true
        : selectedFlag === 'transmissao' ? isTransmissao
        : selectedFlag === 'demaisTransmissao' ? p.transmissao && !isTransmissao
        : selectedFlag === 'apoio' ? apoioUp === 'APOIO'
        : selectedFlag === 'apoioTransmissao' ? apoioUp === 'APOIO' && isTransmissao
        : apoioUp === 'INCLUIR' || apoioUp === 'ALTERAR' || apoioUp === 'EXCLUIR';
      return matchSearch && matchZona && matchMuni && matchFlag;
    });
  }, [pontos, search, selectedZona, selectedMuni, selectedFlag]);

  useEffect(() => {
    onFilteredChange(filtered);
  }, [filtered, onFilteredChange]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedZona, selectedMuni, selectedFlag, pageSize]);

  const kpis = useMemo(() => ({
    totalLocais: filtered.length,
    totalZonas: new Set(filtered.map((p) => p.zona).filter(Boolean)).size,
    totalTransmissao: filtered.filter((p) => p.transmissaoRaw.toUpperCase() === 'TRANSMISSÃO').length,
    totalApoio: filtered.filter((p) => p.apoio === 'APOIO').length,
  }), [filtered]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const hasFilter = search || selectedZona || selectedMuni || selectedFlag;
  const handleClearFilters = () => {
    setSearch('');
    setSelectedZona('');
    setSelectedMuni('');
    setSelectedFlag('');
  };

  if (loading) {
    return (
      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="ds-card p-14 flex flex-col items-center justify-center gap-3 text-ink-3">
          <Loader2 size={24} className="animate-spin motion-reduce:animate-none text-accent" />
          <span className="text-[13.5px]">Carregando pontos de apoio…</span>
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
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-7">
        <div className="relative ds-card p-[18px] overflow-hidden">
          <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent" />
          <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-3">Zonas</div>
          <div className="num mt-2 text-[30px] font-bold tracking-[-0.025em] leading-none text-ink">{kpis.totalZonas}</div>
          <div className="mt-[7px] text-[11px] text-ink-4">zonas distintas</div>
        </div>
        <div className="relative ds-card p-[18px] overflow-hidden">
          <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent" />
          <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-3">Locais</div>
          <div className="num mt-2 text-[30px] font-bold tracking-[-0.025em] leading-none text-ink">{kpis.totalLocais}</div>
          <div className="mt-[7px] text-[11px] text-ink-4">locais de votação</div>
        </div>
        <div className="relative ds-card p-[18px] overflow-hidden">
          <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent" />
          <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-3">Apoio</div>
          <div className="num mt-2 text-[30px] font-bold tracking-[-0.025em] leading-none text-accent">{kpis.totalApoio}</div>
          <div className="mt-[7px] text-[11px] text-ink-4">pontos de apoio</div>
        </div>
        <div className="relative ds-card p-[18px] overflow-hidden">
          <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent" />
          <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-3">Transmissão</div>
          <div className="num mt-2 text-[30px] font-bold tracking-[-0.025em] leading-none text-ink">{kpis.totalTransmissao}</div>
          <div className="mt-[7px] text-[11px] text-ink-4">pontos de transmissão</div>
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
              {facetOptions.zonas.map((z) => (
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
              {facetOptions.municipios.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
          </div>

          <div className="relative min-w-[180px] w-full sm:w-auto">
            <select
              aria-label="Filtrar por característica"
              value={selectedFlag}
              onChange={(e) => setSelectedFlag(e.target.value as '' | 'transmissao' | 'demaisTransmissao' | 'apoio' | 'apoioTransmissao' | 'demais')}
              className="ds-select w-full pl-3 pr-9"
            >
              <option value="">Todas as características</option>
              {(facetOptions.flags.transmissao || facetOptions.flags.demaisTransmissao) && (
                <optgroup label="Transmissão">
                  {facetOptions.flags.transmissao && <option value="transmissao">Com transmissão</option>}
                  {facetOptions.flags.demaisTransmissao && <option value="demaisTransmissao">Demais status</option>}
                </optgroup>
              )}
              {(facetOptions.flags.apoio || facetOptions.flags.demais) && (
                <optgroup label="Apoio">
                  {facetOptions.flags.apoio && <option value="apoio">É ponto de apoio</option>}
                  {facetOptions.flags.demais && <option value="demais">Demais status</option>}
                </optgroup>
              )}
              {facetOptions.flags.apoioTransmissao && (
                <optgroup label="Apoio + transmissão">
                  <option value="apoioTransmissao">Apoio e transmissão</option>
                </optgroup>
              )}
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
                <th>Funcionamento</th>
                <th className="text-center">Apoio</th>
                <th className="text-center">Transmissão</th>
              </tr>
            </thead>
            <tbody className="text-sm text-ink-2">
              {paginated.map((p, i) => (
                <tr key={`${p.municipio}-${p.local}-${i}`} className="row-hover border-b border-border-faint transition-colors">
                  <td className="px-4 py-[11px] text-center font-semibold text-ink-2 num">{p.zona || '—'}</td>
                  <td className="px-4 py-[11px] font-semibold text-ink whitespace-nowrap">{p.municipio || '—'}</td>
                  <td className="px-4 py-[11px] text-ink min-w-[240px]">
                    <span className="whitespace-normal break-words leading-snug font-medium">{p.local || '—'}</span>
                  </td>
                  <td className="px-4 py-[11px] text-ink-2 min-w-[260px]">
                    <span className="whitespace-normal break-words leading-snug">{p.endereco || '—'}</span>
                  </td>
                  <td className="px-4 py-[11px] text-ink-2 whitespace-nowrap">{p.funcionamento || '—'}</td>
                  <td className="px-4 py-[11px] text-center">
                    <ApoioBadge value={p.apoio} />
                  </td>
                  <td className="px-4 py-[11px] text-center">
                    {!p.transmissao ? (
                      <span className="text-ink-4">—</span>
                    ) : p.transmissaoRaw.toUpperCase() === 'TRANSMISSÃO' ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold rounded-[4px] px-2 py-0.5 text-accent bg-accent-soft border border-accent-soft-border">
                        <Radio size={11} /> Sim
                      </span>
                    ) : p.transmissaoRaw.toUpperCase() === 'REMOVER' ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold rounded-[4px] px-2 py-0.5 text-danger bg-danger-soft border border-danger-border">
                        <X size={11} /> Remover
                      </span>
                    ) : (
                      <span className="whitespace-normal break-words leading-snug text-ink-2">{p.transmissaoRaw}</span>
                    )}
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-14 text-center text-ink-3 text-[13.5px]">
                    Nenhum ponto de apoio corresponde aos filtros informados.
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
