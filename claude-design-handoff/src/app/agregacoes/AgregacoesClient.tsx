'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Database, Moon, Sun, Monitor, Check } from 'lucide-react';
import { useTheme } from 'next-themes';
import { auth, db, googleProvider, isAdmin, makeRowId } from '@/lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, collection, onSnapshot } from 'firebase/firestore';

interface SecaoDetalhe {
  secao: string;
  aptos: number;
}

interface LocationData {
  zona: number | string;
  municipio: string;
  local: string;
  total_secoes: number;
  secoes_detalhes: SecaoDetalhe[];
}

interface AgregacaoFields {
  agregar?: boolean;
  total?: number;
}

function formatNumber(val: number) {
  return new Intl.NumberFormat('pt-BR').format(val || 0);
}

function padSecao(secao: string) {
  return secao.padStart(4, '0');
}

export default function AgregacoesClient({ initialData }: { initialData: LocationData[] }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [agregacoesData, setAgregacoesData] = useState<Record<string, AgregacaoFields>>({});
  // Drafts locais do campo TOTAL enquanto edita (valores não confirmados)
  const [totalDrafts, setTotalDrafts] = useState<Record<string, string>>({});

  const [sortField, setSortField] = useState<string>('zona');
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setCanEdit(u ? isAdmin(u.email || '') : false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'agregacoes'), (snapshot) => {
      const data: Record<string, AgregacaoFields> = {};
      snapshot.forEach((docSnap) => {
        const d = docSnap.data() as AgregacaoFields;
        data[docSnap.id] = {
          agregar: typeof d.agregar === 'boolean' ? d.agregar : undefined,
          total: typeof d.total === 'number' ? d.total : undefined,
        };
      });
      setAgregacoesData(data);
    });
    return unsub;
  }, []);

  const saveAgregacaoField = useCallback(async (
    rowId: string,
    field: 'agregar' | 'total',
    value: boolean | number,
  ) => {
    try {
      await setDoc(doc(db, 'agregacoes', rowId), {
        [field]: value,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email ?? null,
      }, { merge: true });
    } catch (err) {
      console.error(`Save ${field} failed:`, err);
    }
  }, []);

  // Valor exibido no campo TOTAL: draft em edição tem prioridade sobre o salvo
  const getTotal = (rowId: string): number => {
    const draft = totalDrafts[rowId];
    if (draft !== undefined) {
      const n = Number(draft);
      return Number.isFinite(n) ? n : 0;
    }
    return agregacoesData[rowId]?.total ?? 0;
  };

  // Commit do draft de TOTAL com clamp/sanitização (mesma lógica de MESA MRJ)
  const commitTotal = (rowId: string) => {
    const raw = totalDrafts[rowId];
    if (raw === undefined) return;
    const n = raw === '' ? 0 : Math.max(0, Math.min(9999, Math.floor(Number(raw))));
    if (Number.isFinite(n)) {
      saveAgregacaoField(rowId, 'total', n);
    }
    setTotalDrafts(d => {
      const nd = { ...d };
      delete nd[rowId];
      return nd;
    });
  };

  // Filtros de Limite
  const [capitalInput, setCapitalInput] = useState('200');
  const [interiorInput, setInteriorInput] = useState('160');
  const [capitalLimit, setCapitalLimit] = useState(200);
  const [interiorLimit, setInteriorLimit] = useState(160);
  const [showCalcParams, setShowCalcParams] = useState(false);

  // Filtros adicionais
  const [zonaFilter, setZonaFilter] = useState('');
  const [municipioFilter, setMunicipioFilter] = useState('');
  const [localFilter, setLocalFilter] = useState('');
  const [showOnlyAggregated, setShowOnlyAggregated] = useState(false);

  // Opções para os Selects (Filtragem em cadeia)
  const uniqueZonas = useMemo(() => {
    return Array.from(new Set(initialData.map(item => String(item.zona))))
      .sort((a, b) => Number(a) - Number(b));
  }, [initialData]);

  const uniqueMunicipios = useMemo(() => {
    let data = initialData;
    if (zonaFilter !== '') {
      data = data.filter(item => String(item.zona) === zonaFilter);
    }
    return Array.from(new Set(data.map(item => item.municipio)))
      .sort((a, b) => a.localeCompare(b));
  }, [initialData, zonaFilter]);

  const uniqueLocais = useMemo(() => {
    let data = initialData;
    if (zonaFilter !== '') {
      data = data.filter(item => String(item.zona) === zonaFilter);
    }
    if (municipioFilter !== '') {
      data = data.filter(item => item.municipio === municipioFilter);
    }
    return Array.from(new Set(data.map(item => item.local)))
      .sort((a, b) => a.localeCompare(b));
  }, [initialData, zonaFilter, municipioFilter]);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCalculate = () => {
    setCapitalLimit(Number(capitalInput) || 0);
    setInteriorLimit(Number(interiorInput) || 0);
    setCurrentPage(1);
  };

  // Filtro: se QUALQUER seção atender ao parâmetro, mostra o local inteiro
  const filteredData = useMemo(() => {
    return initialData.filter(item => {
      const rowId = makeRowId(item.zona, item.municipio, item.local);
      // Filtro por zona
      if (zonaFilter !== '') {
        if (String(item.zona) !== zonaFilter) return false;
      }
      // Filtro por município
      if (municipioFilter !== '') {
        if (item.municipio !== municipioFilter) return false;
      }
      // Filtro por local de votação
      if (localFilter !== '') {
        if (item.local !== localFilter) return false;
      }
      // Filtro por marcados com AGREGAR
      if (showOnlyAggregated) {
        if (!agregacoesData[rowId]?.agregar) return false;
      }

      // Se showCalcParams estiver desligado, não aplicamos o filtro de limite, apenas exibe todos
      if (!showCalcParams) return true;

      // Determina o limite para este local
      const isCapital = item.municipio.trim().toUpperCase() === 'NATAL';
      const limit = isCapital ? capitalLimit : interiorLimit;

      // Se QUALQUER seção atender ao parâmetro (≤ limit), mostra o local
      const hasMatch = item.secoes_detalhes?.some(s => s.aptos <= limit);
      return hasMatch;
    });
  }, [initialData, capitalLimit, interiorLimit, zonaFilter, municipioFilter, localFilter, showOnlyAggregated, agregacoesData, showCalcParams]);

  const sortedData = useMemo(() => {
    const dataCopy = [...filteredData];
    dataCopy.sort((a, b) => {
      const valA = a[sortField as keyof LocationData] as string | number;
      const valB = b[sortField as keyof LocationData] as string | number;

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

      const numA = Number(valA) || 0;
      const numB = Number(valB) || 0;
      return sortAsc ? numA - numB : numB - numA;
    });
    return dataCopy;
  }, [filteredData, sortField, sortAsc]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage]);

  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const getThemeIcon = () => {
    if (!mounted) return <Moon size={16} />;
    if (theme === 'light') return <Sun size={16} />;
    if (theme === 'dark') return <Moon size={16} />;
    return <Monitor size={16} />;
  };

  // Determina a cor do badge de uma seção
  const getBadgeClasses = (aptos: number, limit: number) => {
    if (aptos <= 50) {
      // Vermelho suave
      return 'bg-red-500/15 border-red-400/30 text-red-300';
    }
    if (aptos <= limit) {
      // Azul suave — atende ao parâmetro
      return 'bg-sky-500/15 border-sky-400/30 text-sky-300';
    }
    // Padrão — não atende: borda cinza, sem fundo
    return 'bg-transparent border-zinc-600/40 text-zinc-500';
  };

  return (
    <div className="app-bg min-h-full text-zinc-100 antialiased pb-12">
      <header className="sticky top-0 z-30 px-4 sm:px-6 lg:px-8 py-4 bg-gradient-to-b from-slate-950/85 to-slate-950/20 backdrop-blur-xl border-b border-white/[0.05]">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                <span>Tribunal Regional Eleitoral</span>
                <span className="w-1 h-1 rounded-full bg-zinc-600" />
                <span className="text-sky-300">Cadastro Eleitoral</span>
              </div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-50 flex items-center gap-2">
                <Database size={24} className="text-sky-400" /> Agregações
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
            {!user ? (
              <button
                onClick={() => signInWithPopup(auth, googleProvider)}
                className="ml-4 px-4 py-2 rounded-xl bg-sky-500 text-white hover:bg-sky-400 text-sm font-semibold"
              >
                Entrar
              </button>
            ) : (
              <div className="flex items-center gap-2 ml-4">
                <span className="text-xs text-zinc-400">{user.email}</span>
                <button
                  onClick={() => signOut(auth)}
                  className="px-2 py-1 rounded text-xs bg-white/[0.1] text-zinc-200 hover:bg-white/[0.2]"
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* Barra de filtros */}
        <section className="glass rounded-2xl p-4 lg:p-5 mb-6 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-2 flex-wrap items-center">
            {/* Filtros por zona, município e local */}
            <select
              value={zonaFilter}
              onChange={e => { 
                setZonaFilter(e.target.value); 
                setMunicipioFilter(''); 
                setLocalFilter(''); 
                setCurrentPage(1); 
              }}
              className="h-11 px-4 rounded-xl bg-white/[0.04] border border-white/[0.10] text-sm text-zinc-100 focus:bg-white/[0.06] focus:border-sky-400/40 outline-none transition-all appearance-none pr-8 relative"
              style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%208l5%205%205-5%22%20stroke%3D%22%239CA3AF%22%20stroke-width%3D%221.5%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
            >
              <option value="" className="bg-zinc-900">Zonas: Todas</option>
              {uniqueZonas.map(z => <option key={z} value={z} className="bg-zinc-900">{z}</option>)}
            </select>
            <select
              value={municipioFilter}
              onChange={e => { 
                setMunicipioFilter(e.target.value); 
                setLocalFilter(''); 
                setCurrentPage(1); 
              }}
              className="h-11 px-4 rounded-xl bg-white/[0.04] border border-white/[0.10] text-sm text-zinc-100 focus:bg-white/[0.06] focus:border-sky-400/40 outline-none transition-all appearance-none pr-8 relative"
              style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%208l5%205%205-5%22%20stroke%3D%22%239CA3AF%22%20stroke-width%3D%221.5%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
            >
              <option value="" className="bg-zinc-900">Municípios: Todos</option>
              {uniqueMunicipios.map(m => <option key={m} value={m} className="bg-zinc-900">{m}</option>)}
            </select>
            <select
              value={localFilter}
              onChange={e => { setLocalFilter(e.target.value); setCurrentPage(1); }}
              className="h-11 px-4 rounded-xl bg-white/[0.04] border border-white/[0.10] text-sm text-zinc-100 focus:bg-white/[0.06] focus:border-sky-400/40 outline-none transition-all flex-1 appearance-none pr-8 relative"
              style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%208l5%205%205-5%22%20stroke%3D%22%239CA3AF%22%20stroke-width%3D%221.5%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
            >
              <option value="" className="bg-zinc-900">Locais de Votação: Todos</option>
              {uniqueLocais.map(l => <option key={l} value={l} className="bg-zinc-900">{l}</option>)}
            </select>
            
            {/* Toggle de Agregar */}
            <div className="flex items-center gap-3 px-3 h-11 bg-white/[0.04] border border-white/[0.10] rounded-xl whitespace-nowrap">
              <span className="text-sm font-medium text-zinc-300">Mostrar:</span>
              <div className="flex items-center p-0.5 bg-black/40 border border-white/5 rounded-full">
                <button
                  onClick={() => { setShowOnlyAggregated(false); setCurrentPage(1); }}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${!showOnlyAggregated ? 'bg-white/20 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  Todos
                </button>
                <button
                  onClick={() => { setShowOnlyAggregated(true); setCurrentPage(1); }}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${showOnlyAggregated ? 'bg-sky-500 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  Marcados
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-t border-white/[0.05] pt-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-zinc-300">Parâmetros de Cálculo:</span>
              <div className="flex items-center p-0.5 bg-black/40 border border-white/5 rounded-full">
                <button
                  onClick={() => { setShowCalcParams(false); setCurrentPage(1); }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${!showCalcParams ? 'bg-white/20 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  Ocultar
                </button>
                <button
                  onClick={() => { setShowCalcParams(true); setCurrentPage(1); }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${showCalcParams ? 'bg-sky-500 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  Aplicar (Capital / Interior)
                </button>
              </div>
            </div>

            {showCalcParams && (
              <div className="flex flex-row items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2 bg-white/[0.02] border border-white/[0.08] rounded-xl px-3 h-11">
                  <label className="text-xs font-semibold text-zinc-400 tracking-wider">CAPITAL</label>
                  <input
                    type="number"
                    value={capitalInput}
                    onChange={(e) => setCapitalInput(e.target.value)}
                    className="w-16 h-8 bg-transparent text-sm text-zinc-100 text-center font-bold focus:outline-none focus:text-sky-400 transition-colors"
                  />
                </div>
                <div className="flex items-center gap-2 bg-white/[0.02] border border-white/[0.08] rounded-xl px-3 h-11">
                  <label className="text-xs font-semibold text-zinc-400 tracking-wider">INTERIOR</label>
                  <input
                    type="number"
                    value={interiorInput}
                    onChange={(e) => setInteriorInput(e.target.value)}
                    className="w-16 h-8 bg-transparent text-sm text-zinc-100 text-center font-bold focus:outline-none focus:text-sky-400 transition-colors"
                  />
                </div>
                <button
                  onClick={handleCalculate}
                  className="h-11 px-6 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-semibold tracking-wide shadow-lg shadow-sky-500/20 transition-all duration-200 active:scale-95"
                >
                  Calcular
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Legenda */}
        <div className="flex items-center gap-4 mb-4 text-xs text-zinc-500">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-sky-500/15 border border-sky-400/30"></span>
            <span>Atende ao parâmetro (≤ limite)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-500/15 border border-red-400/30"></span>
            <span>Eleitorado ≤ 50</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-transparent border border-zinc-600/40"></span>
            <span>Acima do parâmetro</span>
          </div>
        </div>

        <section className="glass rounded-2xl overflow-hidden rise">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-zinc-950/80 backdrop-blur-md border-b border-white/[0.08] text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                  <th onClick={() => handleSort('zona')} className="px-4 py-3.5 text-center cursor-pointer hover:bg-white/[0.02] hover:text-zinc-200 transition-colors w-20 border-r border-white/[0.04]">
                    <div className="flex items-center justify-center gap-1">
                      Zona {sortField === 'zona' && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </div>
                  </th>
                  <th onClick={() => handleSort('municipio')} className="px-4 py-3.5 cursor-pointer hover:bg-white/[0.02] hover:text-zinc-200 transition-colors w-40 border-r border-white/[0.04]">
                    <div className="flex items-center gap-1">
                      Município {sortField === 'municipio' && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </div>
                  </th>
                  <th onClick={() => handleSort('local')} className="px-4 py-3.5 cursor-pointer hover:bg-white/[0.02] hover:text-zinc-200 transition-colors w-64 border-r border-white/[0.04]">
                    <div className="flex items-center gap-1">
                      Local de Votação {sortField === 'local' && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </div>
                  </th>
                  <th className="px-4 py-3.5 text-left">
                    <div className="flex items-center gap-1">
                      Seções <span className="text-zinc-600 font-normal normal-case tracking-normal">(seção | eleitorado)</span>
                    </div>
                  </th>
                  <th className="px-4 py-3.5 text-center w-20 border-r border-white/[0.04]">AGREGAR</th>
                  <th className="px-4 py-3.5 text-center w-20 border-r border-white/[0.04]">TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] text-sm text-zinc-300">
                {paginatedData.map((row) => {
                  const rowId = makeRowId(row.zona, row.municipio, row.local);
                  const isCapital = row.municipio.trim().toUpperCase() === 'NATAL';
                  const limit = isCapital ? capitalLimit : interiorLimit;

                  return (
                    <tr key={rowId} className="row-hover transition-colors group">
                      <td className="px-4 py-3 text-center font-medium text-zinc-400 group-hover:text-zinc-200 border-r border-white/[0.04]">
                        {row.zona}
                      </td>
                      <td className="px-4 py-3 font-semibold text-zinc-300 group-hover:text-zinc-100 border-r border-white/[0.04]">
                        {row.municipio}
                      </td>
                      <td className="px-4 py-3 font-normal text-zinc-100 group-hover:text-white border-r border-white/[0.04]">
                        {row.local}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          {(row.secoes_detalhes || []).map((s) => (
                            <span
                              key={`${rowId}-${s.secao}`}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-mono transition-colors ${getBadgeClasses(s.aptos, limit)}`}
                            >
                              <span className="font-bold">{padSecao(s.secao)}</span>
                              <span className="opacity-40">|</span>
                              <span className="font-semibold">{formatNumber(s.aptos)}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                      {/* AGREGAR */}
                      <td className="px-4 py-3.5 text-center">
                        {canEdit ? (
                          <input
                            type="checkbox"
                            checked={agregacoesData[rowId]?.agregar ?? false}
                            onChange={() => {
                              const newVal = !(agregacoesData[rowId]?.agregar ?? false);
                              saveAgregacaoField(rowId, 'agregar', newVal);
                            }}
                            className="form-checkbox h-4 w-4 text-sky-500 rounded cursor-pointer"
                          />
                        ) : agregacoesData[rowId]?.agregar ? (
                          <Check size={16} className="inline text-sky-400" />
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      {/* TOTAL */}
                      <td className="px-4 py-3.5 text-center">
                        {canEdit ? (
                          <input
                            type="number"
                            min={0}
                            max={9999}
                            step={1}
                            value={totalDrafts[rowId] ?? (agregacoesData[rowId]?.total ?? '')}
                            onChange={(e) => {
                              setTotalDrafts(d => ({ ...d, [rowId]: e.target.value }));
                            }}
                            onBlur={() => commitTotal(rowId)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              if (e.key === 'Escape') {
                                setTotalDrafts(d => {
                                  const nd = { ...d };
                                  delete nd[rowId];
                                  return nd;
                                });
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            className="w-16 h-8 px-2 text-center rounded-lg bg-white/[0.04] border border-white/[0.12] text-sm font-bold text-zinc-100 focus:border-sky-400/60 focus:bg-white/[0.06] outline-none transition-all"
                          />
                        ) : (
                          <span className="font-bold text-zinc-100">{getTotal(rowId)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {paginatedData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                      Nenhum resultado encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-4 py-4 border-t border-white/[0.05] flex items-center justify-between text-sm">
              <span className="text-zinc-500">Página {currentPage} de {totalPages} — {sortedData.length} locais</span>
              <div className="flex gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-zinc-300 hover:bg-white/[0.08] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Anterior
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-zinc-300 hover:bg-white/[0.08] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
