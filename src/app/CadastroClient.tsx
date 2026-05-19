'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, ChevronDown, ChevronUp, Download, 
  MapPin, Sun, Moon, Monitor, Eye, EyeOff
} from 'lucide-react';
import { useTheme } from 'next-themes';

interface LocationData {
  zona: number | string;
  municipio: string;
  local: string;
  total_secoes: number;
  secoes: string[];
  qtd_aptos: number;
  qde_analfabetos: number;
  qde_idosos: number;
  qde_le_escreve: number;
  qde_eleit_c_defic: number;
}

function formatNumber(val: number) {
  return new Intl.NumberFormat('pt-BR').format(val || 0);
}

function formatPercent(val: number, total: number) {
  if (!total) return '0,00%';
  const pct = (val / total) * 100;
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(pct) + '%';
}

export default function CadastroClient({ initialData }: { initialData: LocationData[] }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  // Filter States
  const [searchLocal, setSearchLocal] = useState('');
  const [selectedZona, setSelectedZona] = useState<string>('');
  const [selectedMuni, setSelectedMuni] = useState<string>('');

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Sorting States
  const [sortField, setSortField] = useState<keyof LocationData>('zona');
  const [sortAsc, setSortAsc] = useState(true);

  // Expanded Row IDs (key is zona-muni-local)
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  // Unique filter values list
  const filterOptions = useMemo(() => {
    const zonas = new Set<string>();
    const munis = new Set<string>();
    
    initialData.forEach(d => {
      if (d.zona) zonas.add(String(d.zona));
      if (d.municipio) munis.add(d.municipio);
    });

    return {
      zonas: Array.from(zonas).sort((a, b) => {
        const numA = parseInt(a, 10);
        const numB = parseInt(b, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
      }),
      municipios: Array.from(munis).sort((a, b) => a.localeCompare(b))
    };
  }, [initialData]);

  // Filter & Search Logic
  const filteredData = useMemo(() => {
    return initialData.filter(item => {
      const matchLocal = searchLocal === '' || 
        item.local.toLowerCase().includes(searchLocal.toLowerCase());
      
      const matchZona = selectedZona === '' || 
        String(item.zona) === selectedZona;
      
      const matchMuni = selectedMuni === '' || 
        item.municipio === selectedMuni;

      return matchLocal && matchZona && matchMuni;
    });
  }, [initialData, searchLocal, selectedZona, selectedMuni]);

  // Sorting Logic
  const sortedData = useMemo(() => {
    const dataCopy = [...filteredData];
    dataCopy.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      // Handle custom sorting cases (e.g. string comparison vs number)
      if (sortField === 'zona') {
        const numA = typeof valA === 'number' ? valA : parseInt(String(valA), 10);
        const numB = typeof valB === 'number' ? valB : parseInt(String(valB), 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          return sortAsc ? numA - numB : numB - numA;
        }
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      
      // Default numeric comparison
      const numA = Number(valA) || 0;
      const numB = Number(valB) || 0;
      return sortAsc ? numA - numB : numB - numA;
    });
    return dataCopy;
  }, [filteredData, sortField, sortAsc]);

  // Paginated Data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize]);

  // Calculate totals for KPIs based on currently FILTERED data
  const kpis = useMemo(() => {
    let totalSecoes = 0;
    let totalAptos = 0;
    let totalIdosos = 0;
    let totalDefic = 0;
    let totalAnalfabetos = 0;

    filteredData.forEach(d => {
      totalSecoes += d.total_secoes;
      totalAptos += d.qtd_aptos;
      totalIdosos += d.qde_idosos;
      totalDefic += d.qde_eleit_c_defic;
      totalAnalfabetos += d.qde_analfabetos;
    });

    const uniqueZonas = new Set(filteredData.map(d => String(d.zona))).size;
    const uniqueMunis = new Set(filteredData.map(d => d.municipio)).size;

    return {
      totalLocais: filteredData.length,
      totalSecoes,
      totalMesarios: totalSecoes * 4,
      totalAptos,
      totalIdosos,
      totalDefic,
      totalAnalfabetos,
      uniqueZonas,
      uniqueMunis
    };
  }, [filteredData]);

  // Reset page when filters or page size change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchLocal, selectedZona, selectedMuni, pageSize]);

  const handleSort = (field: keyof LocationData) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const toggleRow = (rowId: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [rowId]: !prev[rowId]
    }));
  };

  const handleClearFilters = () => {
    setSearchLocal('');
    setSelectedZona('');
    setSelectedMuni('');
  };

  const exportCSV = () => {
    // Generate CSV contents
    const headers = ['Mesarios (MRV)', 'Zona', 'Municipio', 'Local', 'Total Secoes', 'Secoes', 'Qtd Aptos', 'Idosos', 'Analfabetos', 'Deficientes'];
    const csvRows = [headers.join(';')];
    
    sortedData.forEach(d => {
      const row = [
        d.total_secoes * 4,
        d.zona,
        d.municipio,
        `"${d.local.replace(/"/g, '""')}"`,
        d.total_secoes,
        `"${d.secoes.join(', ')}"`,
        d.qtd_aptos,
        d.qde_idosos,
        d.qde_analfabetos,
        d.qde_eleit_c_defic
      ];
      csvRows.push(row.join(';'));
    });
    
    const csvContent = '\uFEFF' + csvRows.join('\n'); // Add BOM for Excel compatibility in UTF-8
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `locais_votacao_estatisticas_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getThemeIcon = () => {
    if (!mounted) return <Moon size={16} />;
    if (theme === 'light') return <Sun size={16} />;
    if (theme === 'dark') return <Moon size={16} />;
    return <Monitor size={16} />;
  };

  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;

  return (
    <div className="app-bg min-h-screen text-zinc-100 antialiased pb-12">
      {/* Top Banner/Header */}
      <header className="sticky top-0 z-30 px-4 sm:px-6 lg:px-8 py-4 bg-gradient-to-b from-slate-950/85 to-slate-950/20 backdrop-blur-xl border-b border-white/[0.05]">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                <span>Tribunal Regional Eleitoral</span>
                <span className="w-1 h-1 rounded-full bg-zinc-600" />
                <span className="text-sky-300">Cadastro Eleitoral</span>
              </div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-50 flex items-center gap-2">
                Estatísticas de Locais de Votação
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme Selector */}
            <div className="relative">
              <button 
                onClick={() => setShowThemeMenu(!showThemeMenu)}
                className="grid place-items-center w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] text-zinc-300 hover:bg-white/[0.06] hover:border-white/[0.12] transition-all"
                aria-label="Mudar tema"
              >
                {getThemeIcon()}
              </button>
              {showThemeMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowThemeMenu(false)} />
                  <div className="absolute right-0 mt-2 w-36 rounded-xl glass-strong border border-white/[0.10] p-1 shadow-2xl z-50 backdrop-blur-xl animate-rise">
                    {[
                      { id: 'light', label: 'Claro', icon: Sun },
                      { id: 'dark', label: 'Escuro', icon: Moon },
                      { id: 'system', label: 'Sistema', icon: Monitor },
                    ].map(t => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setTheme(t.id);
                          setShowThemeMenu(false);
                        }}
                        className={
                          'w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-left transition-colors ' +
                          (theme === t.id ? 'bg-white/[0.08] text-zinc-50' : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]')
                        }
                      >
                        <t.icon size={14} />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button 
              onClick={exportCSV} 
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-sky-400/15 border border-sky-300/25 text-sky-100 text-sm font-medium hover:bg-sky-400/20 transition-all shadow-[0_0_15px_-3px_rgba(56,189,248,0.2)]"
            >
              <Download size={14} /> <span className="hidden sm:inline">Exportar CSV</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* KPI Panel */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className="relative glass rounded-2xl p-5 overflow-hidden">
            <span className="orb opacity-50" />
            <div className="relative flex flex-col justify-between h-full">
              <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500 font-semibold">Mesários (MRV)</span>
              <div className="num text-2xl font-bold text-violet-400 mt-2">{formatNumber(kpis.totalMesarios)}</div>
              <span className="text-[10px] text-zinc-500 mt-1">seções × 4</span>
            </div>
          </div>

          <div className="relative glass rounded-2xl p-5 overflow-hidden">
            <div className="relative flex flex-col justify-between h-full">
              <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500 font-semibold">Zonas</span>
              <div className="num text-2xl font-bold text-zinc-50 mt-2">{kpis.uniqueZonas}</div>
              <span className="text-[10px] text-zinc-500 mt-1">com seções ativas</span>
            </div>
          </div>
          
          <div className="relative glass rounded-2xl p-5 overflow-hidden">
            <div className="relative flex flex-col justify-between h-full">
              <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500 font-semibold">Municípios</span>
              <div className="num text-2xl font-bold text-zinc-50 mt-2">{kpis.uniqueMunis}</div>
              <span className="text-[10px] text-zinc-500 mt-1">com seções ativas</span>
            </div>
          </div>

          <div className="relative glass rounded-2xl p-5 overflow-hidden">
            <div className="relative flex flex-col justify-between h-full">
              <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500 font-semibold">Locais de Votação</span>
              <div className="num text-2xl font-bold text-sky-400 mt-2">{formatNumber(kpis.totalLocais)}</div>
              <span className="text-[10px] text-zinc-500 mt-1">colégio / prédios</span>
            </div>
          </div>

          <div className="relative glass rounded-2xl p-5 overflow-hidden">
            <div className="relative flex flex-col justify-between h-full">
              <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500 font-semibold">Total de Seções</span>
              <div className="num text-2xl font-bold text-emerald-400 mt-2">{formatNumber(kpis.totalSecoes)}</div>
              <span className="text-[10px] text-zinc-500 mt-1">seções eleitorais</span>
            </div>
          </div>

          <div className="relative glass rounded-2xl p-5 overflow-hidden">
            <div className="relative flex flex-col justify-between h-full">
              <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500 font-semibold">Eleitores Aptos</span>
              <div className="num text-2xl font-bold text-amber-400 mt-2">{formatNumber(kpis.totalAptos)}</div>
              <span className="text-[10px] text-zinc-500 mt-1">total de cidadãos</span>
            </div>
          </div>
        </section>

        {/* Filter bar */}
        <section className="glass rounded-2xl p-4 lg:p-5 mb-6 flex flex-col md:flex-row gap-4 items-stretch md:items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <input
              type="text"
              value={searchLocal}
              onChange={(e) => setSearchLocal(e.target.value)}
              placeholder="Pesquisar por nome do local de votação…"
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/[0.04] border border-white/[0.10] text-sm text-zinc-100 placeholder:text-zinc-500
                         focus:bg-white/[0.06] focus:border-sky-400/40 outline-none transition-all duration-200"
            />
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-3">
            <div className="relative min-w-[120px] w-full sm:w-auto">
              <select
                value={selectedZona}
                onChange={(e) => setSelectedZona(e.target.value)}
                className="w-full h-11 pl-4 pr-10 appearance-none rounded-xl bg-white/[0.04] border border-white/[0.10] text-sm text-zinc-100 font-medium
                           hover:bg-white/[0.06] hover:border-white/[0.18] focus:border-sky-400/40 transition-all cursor-pointer"
              >
                <option value="" className="bg-slate-900">Todas Zonas</option>
                {filterOptions.zonas.map(z => (
                  <option key={z} value={z} className="bg-slate-900">Zona {z}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            </div>

            <div className="relative min-w-[180px] w-full sm:w-auto">
              <select
                value={selectedMuni}
                onChange={(e) => setSelectedMuni(e.target.value)}
                className="w-full h-11 pl-4 pr-10 appearance-none rounded-xl bg-white/[0.04] border border-white/[0.10] text-sm text-zinc-100 font-medium
                           hover:bg-white/[0.06] hover:border-white/[0.18] focus:border-sky-400/40 transition-all cursor-pointer"
              >
                <option value="" className="bg-slate-900">Todos Municípios</option>
                {filterOptions.municipios.map(m => (
                  <option key={m} value={m} className="bg-slate-900">{m}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            </div>

            {(searchLocal || selectedZona || selectedMuni) && (
              <button
                onClick={handleClearFilters}
                className="h-11 px-4 rounded-xl border border-rose-500/20 text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 text-sm font-medium transition-all"
              >
                Limpar
              </button>
            )}
          </div>
        </section>

        {/* Tabular Dashboard Grid */}
        <section className="glass rounded-2xl overflow-hidden rise">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-zinc-950/80 backdrop-blur-md border-b border-white/[0.08] text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                  <th 
                    onClick={() => handleSort('zona')}
                    className="px-4 py-3.5 text-center cursor-pointer hover:bg-white/[0.02] hover:text-zinc-200 transition-colors w-24 border-r border-white/[0.04]"
                  >
                    <div className="flex items-center justify-center gap-1">
                      Zona
                      {sortField === 'zona' && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('municipio')}
                    className="px-4 py-3.5 cursor-pointer hover:bg-white/[0.02] hover:text-zinc-200 transition-colors w-40 border-r border-white/[0.04]"
                  >
                    <div className="flex items-center gap-1">
                      Município
                      {sortField === 'municipio' && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('local')}
                    className="px-6 py-3.5 cursor-pointer hover:bg-white/[0.02] hover:text-zinc-200 transition-colors border-r border-white/[0.04]"
                  >
                    <div className="flex items-center gap-1">
                      Local
                      {sortField === 'local' && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </div>
                  </th>
                  <th className="px-4 py-3.5 text-center w-28 border-r border-white/[0.04]">
                    Local
                  </th>
                  <th 
                    onClick={() => handleSort('total_secoes')}
                    className="px-4 py-3.5 text-center cursor-pointer hover:bg-white/[0.02] hover:text-zinc-200 transition-colors w-36 border-r border-white/[0.04]"
                  >
                    <div className="flex items-center justify-center gap-1">
                      Total de seções
                      {sortField === 'total_secoes' && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('total_secoes')}
                    className="px-4 py-3.5 text-center cursor-pointer hover:bg-white/[0.02] hover:text-zinc-200 transition-colors w-36"
                  >
                    <div className="flex items-center justify-center gap-1">
                      Mesários (MRV)
                      {sortField === 'total_secoes' && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] text-sm text-zinc-300">
                {paginatedData.map((row, idx) => {
                  const rowId = `${row.zona}-${row.municipio}-${row.local}`;
                  const isExpanded = expandedRows[rowId] || false;

                  return (
                    <React.Fragment key={rowId}>
                      <tr 
                        onClick={() => toggleRow(rowId)}
                        className="row-hover transition-colors cursor-pointer group"
                      >
                        {/* Zona */}
                        <td className="px-4 py-3.5 text-center font-medium text-zinc-400 group-hover:text-zinc-200 border-r border-white/[0.04]">
                          {row.zona}
                        </td>
                        {/* Municipio */}
                        <td className="px-4 py-3.5 font-semibold text-zinc-300 group-hover:text-zinc-100 border-r border-white/[0.04]">
                          {row.municipio}
                        </td>
                        {/* Local Name */}
                        <td className="px-6 py-3.5 font-normal text-zinc-100 group-hover:text-white border-r border-white/[0.04]">
                          <div className="flex items-center gap-2">
                            {isExpanded ? <EyeOff size={14} className="text-sky-400 shrink-0" /> : <Eye size={14} className="text-zinc-500 group-hover:text-sky-300 shrink-0" />}
                            <span className="truncate max-w-[450px] lg:max-w-xl" title={row.local}>{row.local}</span>
                          </div>
                        </td>
                        {/* Local (Count) */}
                        <td className="px-4 py-3.5 text-center text-zinc-400 border-r border-white/[0.04]">
                          1
                        </td>
                        {/* Total de secoes */}
                        <td className="px-4 py-3.5 text-center font-bold text-zinc-100 border-r border-white/[0.04]">
                          {row.total_secoes}
                        </td>
                        {/* Mesários (MRV) */}
                        <td className="px-4 py-3.5 text-center font-bold text-violet-300 group-hover:text-violet-200">
                          {row.total_secoes * 4}
                        </td>
                      </tr>
                      
                      {/* Expanded View */}
                      {isExpanded && (
                        <tr className="bg-white/[0.015]">
                          <td colSpan={6} className="px-6 py-5 border-t border-b border-sky-500/10">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              {/* Left Panel: Statistics */}
                              <div className="md:col-span-2 space-y-4">
                                <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-400 flex items-center gap-2">
                                  <MapPin size={12} /> Detalhes do Local de Votação
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                  <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-3.5">
                                    <div className="text-[10px] text-zinc-500 font-medium">Eleitores Aptos</div>
                                    <div className="text-base font-bold text-zinc-100 mt-1">{formatNumber(row.qtd_aptos)}</div>
                                  </div>
                                  <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-3.5">
                                    <div className="text-[10px] text-zinc-500 font-medium">Idosos</div>
                                    <div className="text-base font-bold text-zinc-100 mt-1">{formatNumber(row.qde_idosos)}</div>
                                    <div className="text-[9px] text-zinc-500 mt-0.5">{formatPercent(row.qde_idosos, row.qtd_aptos)}</div>
                                  </div>
                                  <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-3.5">
                                    <div className="text-[10px] text-zinc-500 font-medium">Com Deficiência</div>
                                    <div className="text-base font-bold text-zinc-100 mt-1">{formatNumber(row.qde_eleit_c_defic)}</div>
                                    <div className="text-[9px] text-zinc-500 mt-0.5">{formatPercent(row.qde_eleit_c_defic, row.qtd_aptos)}</div>
                                  </div>
                                  <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-3.5">
                                    <div className="text-[10px] text-zinc-500 font-medium">Analfabetos</div>
                                    <div className="text-base font-bold text-zinc-100 mt-1">{formatNumber(row.qde_analfabetos)}</div>
                                    <div className="text-[9px] text-zinc-500 mt-0.5">{formatPercent(row.qde_analfabetos, row.qtd_aptos)}</div>
                                  </div>
                                </div>
                              </div>

                              {/* Right Panel: Sections List */}
                              <div className="space-y-2">
                                <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
                                  Seções Vinculadas ({row.total_secoes})
                                </h4>
                                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-2 scroll-y">
                                  {row.secoes.map(sec => (
                                    <span 
                                      key={sec} 
                                      className="font-mono text-xs font-semibold text-sky-300 bg-sky-400/10 border border-sky-400/20 rounded-md px-2 py-0.5"
                                    >
                                      {sec}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}

                {sortedData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-zinc-500 text-sm">
                      Nenhum local de votação corresponde aos filtros informados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {sortedData.length > 0 && (
            <div className="p-4 bg-zinc-950/40 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-zinc-500">
                Mostrando <span className="text-zinc-300">{(currentPage - 1) * pageSize + 1}</span> a{' '}
                <span className="text-zinc-300">{Math.min(currentPage * pageSize, sortedData.length)}</span> de{' '}
                <span className="text-zinc-300">{sortedData.length}</span> locais
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">Por página:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="h-8 px-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-zinc-300 cursor-pointer outline-none focus:border-sky-400/40"
                  >
                    {[10, 25, 50, 100, 250].map(size => (
                      <option key={size} value={size} className="bg-slate-900">{size}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 h-8 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-zinc-300 hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    Anterior
                  </button>
                  
                  <span className="text-xs text-zinc-500 px-2">
                    Pág. <span className="text-zinc-300">{currentPage}</span> de <span className="text-zinc-300">{totalPages}</span>
                  </span>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 h-8 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-zinc-300 hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
