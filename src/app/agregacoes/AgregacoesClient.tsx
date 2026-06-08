'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Database,
  Check, MapPin, SlidersHorizontal, X,
  Save, AlertTriangle, Plus, History, RotateCcw
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { auth, db, makeRowId } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { doc, setDoc, serverTimestamp, collection, onSnapshot, writeBatch, getDoc, Timestamp } from 'firebase/firestore';

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

interface CicloMeta {
  id: string;
  capitalLimit: number;
  interiorLimit: number;
  savedAt: Date | null;
}

function formatNumber(val: number) {
  return new Intl.NumberFormat('pt-BR').format(val || 0);
}

function padSecao(secao: string) {
  return secao.padStart(4, '0');
}

export default function AgregacoesClient({ initialData }: { initialData: LocationData[] }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { user, canEdit } = useAuth();

  // Ciclos
  const [cicloAtivo, setCicloAtivo] = useState<{ id: string; capitalLimit: number; interiorLimit: number } | null>(null);
  const [ciclosList, setCiclosList] = useState<CicloMeta[]>([]);
  const [cicloSelectValue, setCicloSelectValue] = useState('');
  const [showLoadWarning, setShowLoadWarning] = useState<{ id: string; capitalLimit: number; interiorLimit: number } | null>(null);
  const [loadingCiclo, setLoadingCiclo] = useState(false);
  const [savingCiclo, setSavingCiclo] = useState(false);
  const [clearingCiclo, setClearingCiclo] = useState(false);
  const [showClearWarning, setShowClearWarning] = useState(false);
  const [agregacoesData, setAgregacoesData] = useState<Record<string, AgregacaoFields>>({});
  // Drafts locais do campo TOTAL enquanto edita (valores não confirmados)
  const [totalDrafts, setTotalDrafts] = useState<Record<string, string>>({});
  // Linhas onde TOTAL ficou obrigatório (recém-marcadas como AGREGAR sem total salvo)
  const [totalRequired, setTotalRequired] = useState<Set<string>>(new Set());
  // Refs dos inputs TOTAL para foco programático
  const totalInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [sortField, setSortField] = useState<string>('zona');
  const [sortAsc, setSortAsc] = useState(true);

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

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'ciclos'), snap => {
      const list: CicloMeta[] = snap.docs.map(d => ({
        id: d.id,
        capitalLimit: d.data().capitalLimit ?? 200,
        interiorLimit: d.data().interiorLimit ?? 160,
        savedAt: d.data().savedAt instanceof Timestamp ? d.data().savedAt.toDate() : null,
      })).sort((a, b) => a.id.localeCompare(b.id));
      setCiclosList(list);
    });
    return () => unsub();
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
      setTotalRequired(s => { const ns = new Set(s); ns.delete(rowId); return ns; });
    }
    setTotalDrafts(d => {
      const nd = { ...d };
      delete nd[rowId];
      return nd;
    });
  };

  // Filtros de Limite
  const [capitalInput, setCapitalInput] = useState('');
  const [interiorInput, setInteriorInput] = useState('');
  const [capitalLimit, setCapitalLimit] = useState(0);
  const [interiorLimit, setInteriorLimit] = useState(0);
  const [showCalcParams, setShowCalcParams] = useState(true);

  // Filtros adicionais
  const [zonaFilter, setZonaFilter] = useState('');
  const [municipioFilter, setMunicipioFilter] = useState('');
  const [localFilter, setLocalFilter] = useState('');
  const [showOnlyAggregated, setShowOnlyAggregated] = useState(false);

  // Opções para os Selects (Filtragem em cadeia + respeita toggle "Marcados")
  const uniqueZonas = useMemo(() => {
    let data = initialData;
    if (showOnlyAggregated) {
      data = data.filter(item =>
        agregacoesData[makeRowId(item.zona, item.municipio, item.local)]?.agregar === true
      );
    }
    return Array.from(new Set(data.map(item => String(item.zona))))
      .sort((a, b) => Number(a) - Number(b));
  }, [initialData, showOnlyAggregated, agregacoesData]);

  const uniqueMunicipios = useMemo(() => {
    let data = initialData;
    if (showOnlyAggregated) {
      data = data.filter(item =>
        agregacoesData[makeRowId(item.zona, item.municipio, item.local)]?.agregar === true
      );
    }
    if (zonaFilter !== '') {
      data = data.filter(item => String(item.zona) === zonaFilter);
    }
    return Array.from(new Set(data.map(item => item.municipio)))
      .sort((a, b) => a.localeCompare(b));
  }, [initialData, zonaFilter, showOnlyAggregated, agregacoesData]);

  const uniqueLocais = useMemo(() => {
    let data = initialData;
    if (showOnlyAggregated) {
      data = data.filter(item =>
        agregacoesData[makeRowId(item.zona, item.municipio, item.local)]?.agregar === true
      );
    }
    if (zonaFilter !== '') {
      data = data.filter(item => String(item.zona) === zonaFilter);
    }
    if (municipioFilter !== '') {
      data = data.filter(item => item.municipio === municipioFilter);
    }
    return Array.from(new Set(data.map(item => item.local)))
      .sort((a, b) => a.localeCompare(b));
  }, [initialData, zonaFilter, municipioFilter, showOnlyAggregated, agregacoesData]);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    setMounted(true);
  }, []);


  // Salvar ciclo atual
  const saveCiclo = useCallback(async () => {
    const cicloId = `${capitalLimit}-${interiorLimit}`;
    const rows: Record<string, object> = {};
    initialData.forEach(item => {
      const rowId = makeRowId(item.zona, item.municipio, item.local);
      const fields = agregacoesData[rowId];
      if (fields?.agregar === true || fields?.total !== undefined) {
        rows[rowId] = {
          zona: item.zona,
          municipio: item.municipio,
          local: item.local,
          ...(fields.agregar !== undefined && { agregar: fields.agregar }),
          ...(fields.total !== undefined && { total: fields.total }),
        };
      }
    });
    setSavingCiclo(true);
    try {
      await setDoc(doc(db, 'ciclos', cicloId), {
        capitalLimit,
        interiorLimit,
        savedAt: serverTimestamp(),
        savedBy: auth.currentUser?.email ?? null,
        rows,
      });
      // Apagar dados da tela após salvar — consulta fica disponível no painel Agregações
      const cleanBatch = writeBatch(db);
      Object.keys(agregacoesData).forEach(rowId => {
        cleanBatch.delete(doc(db, 'agregacoes', rowId));
      });
      await cleanBatch.commit();
      setCicloAtivo(null);
      setCapitalInput('');
      setInteriorInput('');
      setCapitalLimit(0);
      setInteriorLimit(0);
    } catch (err) {
      console.error('Save ciclo failed:', err);
    } finally {
      setSavingCiclo(false);
    }
  }, [capitalLimit, interiorLimit, agregacoesData, initialData, router]);

  const loadCiclo = useCallback(async (cicloId: string, cap: number, int: number) => {
    setLoadingCiclo(true);
    try {
      const snap = await getDoc(doc(db, 'ciclos', cicloId));
      if (!snap.exists()) return;
      const cicloRows = (snap.data().rows ?? {}) as Record<string, { agregar?: boolean; total?: number }>;
      const batch = writeBatch(db);
      Object.keys(agregacoesData).forEach(rowId => {
        if (!cicloRows[rowId]) batch.delete(doc(db, 'agregacoes', rowId));
      });
      Object.entries(cicloRows).forEach(([rowId, fields]) => {
        batch.set(doc(db, 'agregacoes', rowId), {
          ...(fields.agregar !== undefined && { agregar: fields.agregar }),
          ...(fields.total !== undefined && { total: fields.total }),
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser?.email ?? null,
        });
      });
      await batch.commit();
      setCapitalInput(String(cap)); setCapitalLimit(cap);
      setInteriorInput(String(int)); setInteriorLimit(int);
      setCicloAtivo({ id: cicloId, capitalLimit: cap, interiorLimit: int });
      setShowLoadWarning(null);
    } catch (err) {
      console.error('Load ciclo failed:', err);
    } finally {
      setLoadingCiclo(false);
    }
  }, [agregacoesData]);

  // Apagar todos os dados de agregacoes para iniciar novo ciclo
  const novoCiclo = useCallback(async () => {
    setClearingCiclo(true);
    try {
      const batch = writeBatch(db);
      Object.keys(agregacoesData).forEach(rowId => {
        batch.delete(doc(db, 'agregacoes', rowId));
      });
      await batch.commit();
      setCicloAtivo(null);
      setShowClearWarning(false);
      setCapitalInput('');
      setInteriorInput('');
      setCapitalLimit(0);
      setInteriorLimit(0);
      router.replace('/agregacoes/analise');
    } catch (err) {
      console.error('Novo ciclo failed:', err);
    } finally {
      setClearingCiclo(false);
    }
  }, [agregacoesData, router]);

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

  // Determina a cor do badge de uma seção — sutil: cor só na borda/texto, fundo neutro
  const getBadgeClasses = (aptos: number, limit: number) => {
    if (aptos <= 50) {
      // ≤ 50 eleitores — fundo vermelho suave
      return 'bg-danger-soft border-danger-border text-danger';
    }
    if (aptos <= limit) {
      // Atende ao parâmetro — fundo verde suave
      return 'bg-accent-soft border-accent-soft-border text-accent';
    }
    // Acima do parâmetro — neutro
    return 'bg-surface border-border-strong text-ink-3';
  };

  // Resumo da agregação — somente linhas com AGREGAR marcado
  const summary = useMemo(() => {
    const agregadoRows = filteredData.filter(d =>
      agregacoesData[makeRowId(d.zona, d.municipio, d.local)]?.agregar === true
    );
    return {
      locais: agregadoRows.length,
      secoes: agregadoRows.reduce((s, d) => s + (d.secoes_detalhes || []).length, 0),
      secoesAgregadas: agregadoRows.reduce((s, d) => {
        const rid = makeRowId(d.zona, d.municipio, d.local);
        return s + (agregacoesData[rid]?.total ?? 0);
      }, 0),
      totalEleitores: agregadoRows.reduce((s, d) =>
        s + (d.secoes_detalhes || []).reduce((ss, sec) => ss + sec.aptos, 0), 0),
    };
  }, [filteredData, agregacoesData]);

  const hasFilter = zonaFilter || municipioFilter || localFilter || showOnlyAggregated;

  // Cabeçalho de coluna ordenável
  const SortHead = ({ field, children }: { field: string; children: React.ReactNode }) => {
    const active = sortField === field;
    return (
      <button
        onClick={() => handleSort(field)}
        className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.07em] transition-colors ${active ? 'text-accent' : 'text-ink-3 hover:text-ink'}`}
      >
        {children}
        {active ? (sortAsc ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : null}
      </button>
    );
  };

  return (
    <div className="min-h-full bg-bg text-ink pb-14">

      {/* ── Modal de carregar ciclo ──────────────────────────────── */}
      {showLoadWarning && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-[8px] shadow-lg max-w-md w-full mx-4 p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle size={20} className="text-warn shrink-0 mt-0.5" />
              <div>
                <h2 className="text-[15px] font-bold text-[var(--ink)] mb-1">
                  Carregar Ciclo {showLoadWarning.id}
                </h2>
                <p className="text-[13px] text-[var(--ink-2)] leading-relaxed">
                  Os dados atuais de <strong>AGREGAR</strong> e <strong>TOTAL</strong> serão
                  substituídos pelos valores salvos neste ciclo. Linhas que não fazem parte
                  do ciclo serão removidas. Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowLoadWarning(null)}
                className="h-9 px-4 rounded-[6px] border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--ink-2)] text-[13px] font-semibold hover:bg-[var(--surface-3)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => loadCiclo(showLoadWarning.id, showLoadWarning.capitalLimit, showLoadWarning.interiorLimit)}
                disabled={loadingCiclo}
                className="h-9 px-4 rounded-[6px] bg-warn border border-warn text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50 transition-colors"
              >
                {loadingCiclo ? 'Carregando…' : 'Confirmar carregamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de novo ciclo ─────────────────────────────────── */}
      {showClearWarning && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-[8px] shadow-lg max-w-md w-full mx-4 p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle size={20} className="text-danger shrink-0 mt-0.5" />
              <div>
                <h2 className="text-[15px] font-bold text-[var(--ink)] mb-1">
                  Iniciar novo ciclo
                </h2>
                <p className="text-[13px] text-[var(--ink-2)] leading-relaxed">
                  Todos os dados de <strong>AGREGAR</strong> e <strong>TOTAL</strong> serão
                  apagados permanentemente da tela. Os ciclos já salvos não são afetados.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowClearWarning(false)}
                className="h-9 px-4 rounded-[6px] border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--ink-2)] text-[13px] font-semibold hover:bg-[var(--surface-3)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={novoCiclo}
                disabled={clearingCiclo}
                className="h-9 px-4 rounded-[6px] bg-danger border border-danger text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50 transition-colors"
              >
                {clearingCiclo ? 'Apagando…' : 'Confirmar — apagar tudo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-surface border-b border-border">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] text-ink-3">
              <span className="whitespace-nowrap">Tribunal Regional Eleitoral</span>
              <span className="w-[3px] h-[3px] rounded-full bg-ink-4" />
              <span className="text-accent font-semibold whitespace-nowrap">Cadastro Eleitoral</span>
            </div>
            <h1 className="mt-0.5 text-[20px] md:text-[22px] font-bold tracking-[-0.02em] text-ink flex items-center gap-2 leading-tight">
              <Database size={20} className="text-accent shrink-0" /> Agregações
            </h1>
          </div>

        </div>
      </header>

      {/* ── Banner de ciclo ativo ────────────────────────────────── */}
      {cicloAtivo && (
        <div className="border-b border-[var(--warn-border,#f0c14b)] bg-[var(--warn-soft,#fffbeb)]">
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center gap-3 flex-wrap">
            <AlertTriangle size={15} className="text-warn shrink-0" />
            <span className="text-[13px] font-semibold text-[var(--ink)]">
              Ciclo {cicloAtivo.id} ativo
            </span>
            <span className="text-[12.5px] text-[var(--ink-2)]">
              — Os dados de AGREGAR e TOTAL foram carregados deste ciclo.
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => {
                  setCicloAtivo(null);
                  router.replace('/agregacoes');
                }}
                className="ds-tap-icon h-7 w-7 grid place-items-center rounded-[4px] text-[var(--ink-3)] hover:bg-[var(--surface-3)] hover:text-[var(--ink)] transition-colors"
                aria-label="Fechar aviso de ciclo ativo"
                title="Fechar"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* ── Resumo da agregação ───────────────────────────────── */}
        <div className="flex items-baseline gap-3 mt-1 mb-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.06em] text-ink-2 whitespace-nowrap">Resumo da agregação</h2>
          <span className="text-[11.5px] text-ink-4 whitespace-nowrap">atualiza conforme filtros e marcações</span>
          <span className="flex-1 h-px bg-border" />
        </div>
        <section className="ds-card overflow-hidden mb-[22px]">
          <div className="grid grid-cols-2 md:grid-cols-4">
            {[
              { label: 'Locais',             value: summary.locais },
              { label: 'Seções',             value: summary.secoes },
              { label: 'Seções agregadas',   value: summary.secoesAgregadas },
              { label: 'Total de eleitores', value: summary.totalEleitores },
            ].map((k, i) => (
              <div
                key={k.label}
                className={`p-4 border-border-faint ${i % 4 !== 3 ? 'md:border-r' : ''} max-md:[&:nth-child(odd)]:border-r max-md:[&:nth-child(n+3)]:border-t`}
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.05em] text-ink-3 leading-[1.3]">{k.label}</div>
                <div className="num mt-1.5 text-[21px] font-bold tracking-[-0.02em] leading-none text-ink">{formatNumber(k.value)}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Barra de filtros ──────────────────────────────────── */}
        <section className="ds-card p-3.5 mb-[18px] flex flex-col gap-3.5">
          <div className="flex flex-col md:flex-row gap-3 flex-wrap items-stretch md:items-center">
            {/* Zona */}
            <div className="relative min-w-[150px]">
              <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4 pointer-events-none" />
              <select
                aria-label="Filtrar por zona"
                value={zonaFilter}
                onChange={e => {
                  setZonaFilter(e.target.value);
                  setMunicipioFilter('');
                  setLocalFilter('');
                  setCurrentPage(1);
                }}
                className="ds-select w-full pl-9 pr-9"
              >
                <option value="">Todas as zonas</option>
                {uniqueZonas.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
              <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
            </div>
            {/* Município */}
            <div className="relative min-w-[180px]">
              <select
                aria-label="Filtrar por município"
                value={municipioFilter}
                onChange={e => {
                  setMunicipioFilter(e.target.value);
                  setLocalFilter('');
                  setCurrentPage(1);
                }}
                className="ds-select w-full pl-3 pr-9"
              >
                <option value="">Todos os municípios</option>
                {uniqueMunicipios.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
            </div>
            {/* Local */}
            <div className="relative flex-1 min-w-[200px]">
              <select
                aria-label="Filtrar por local"
                value={localFilter}
                onChange={e => { setLocalFilter(e.target.value); setCurrentPage(1); }}
                className="ds-select w-full pl-3 pr-9"
              >
                <option value="">Todos os locais</option>
                {uniqueLocais.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
            </div>

            {/* Mostrar: Todos / Marcados */}
            <div className="inline-flex p-[3px] gap-0.5 bg-surface-3 border border-border rounded-[6px]">
              <button
                onClick={() => { setShowOnlyAggregated(false); setCurrentPage(1); }}
                className={`px-3.5 py-1.5 rounded-[4px] text-[12.5px] font-semibold transition-colors ${!showOnlyAggregated ? 'bg-surface text-accent' : 'text-ink-3 hover:text-ink'}`}
              >
                Todos
              </button>
              <button
                onClick={() => { setShowOnlyAggregated(true); setCurrentPage(1); }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[4px] text-[12.5px] font-semibold transition-colors ${showOnlyAggregated ? 'bg-surface text-accent' : 'text-ink-3 hover:text-ink'}`}
              >
                <Check size={13} /> Marcados
              </button>
            </div>

            {hasFilter && (
              <button
                onClick={() => { setZonaFilter(''); setMunicipioFilter(''); setLocalFilter(''); setShowOnlyAggregated(false); setCurrentPage(1); }}
                className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-[6px] border border-border-strong bg-surface text-ink-2 text-[13px] font-semibold hover:text-danger hover:border-danger-border hover:bg-danger-soft transition-colors"
              >
                <X size={14} /> Limpar
              </button>
            )}
          </div>

          {/* Linha de ciclos */}
          {canEdit && (
            <div className="flex items-center gap-2 flex-wrap border-t border-border-faint pt-3.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3 whitespace-nowrap">
                <History size={14} /> Ciclos
              </span>
              <div className="relative">
                <select
                  aria-label="Carregar ciclo"
                  value={cicloSelectValue}
                  onChange={e => {
                    const id = e.target.value;
                    if (!id) return;
                    const c = ciclosList.find(x => x.id === id);
                    if (!c) return;
                    setCicloSelectValue('');
                    setShowLoadWarning({ id: c.id, capitalLimit: c.capitalLimit, interiorLimit: c.interiorLimit });
                  }}
                  className="ds-select h-9 pl-3 pr-9 min-w-[160px] text-[13px]"
                >
                  <option value="">Carregar ciclo…</option>
                  {ciclosList.map(c => <option key={c.id} value={c.id}>{c.id}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
              </div>
              <button
                onClick={() => { setCicloAtivo(null); setCapitalInput(''); setInteriorInput(''); setCapitalLimit(0); setInteriorLimit(0); }}
                disabled={!cicloAtivo}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[6px] border border-border-strong bg-surface text-ink-2 text-[13px] font-semibold hover:text-danger hover:border-danger-border hover:bg-danger-soft disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <RotateCcw size={13} /> Limpar
              </button>
              <span className="flex-1" />
              <button
                onClick={saveCiclo}
                disabled={savingCiclo || !capitalInput.trim() || !interiorInput.trim()}
                className="h-9 px-4 rounded-[6px] border border-border-strong bg-surface text-ink-2 text-[13px] font-semibold hover:bg-surface-3 hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
              >
                <Save size={14} />
                {savingCiclo ? 'Salvando…' : capitalLimit > 0 || interiorLimit > 0 ? `Salvar ciclo ${capitalLimit}-${interiorLimit}` : 'Salvar ciclo'}
              </button>
              <button
                onClick={() => setShowClearWarning(true)}
                className="h-9 px-4 rounded-[6px] border border-border-strong bg-surface text-ink-2 text-[13px] font-semibold hover:bg-surface-3 hover:text-ink transition-colors inline-flex items-center gap-2"
              >
                <Plus size={14} />
                Novo ciclo
              </button>
            </div>
          )}

          {/* Parâmetros de cálculo */}
          <div className="flex items-center gap-3 flex-wrap border-t border-border-faint pt-3.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3 whitespace-nowrap">
                <SlidersHorizontal size={14} /> Parâmetros de cálculo
              </span>
              <div className="inline-flex p-[3px] gap-0.5 bg-surface-3 border border-border rounded-[6px]">
                <button
                  onClick={() => { setShowCalcParams(true); setCurrentPage(1); }}
                  className={`px-3.5 py-1.5 rounded-[4px] text-[12.5px] font-semibold transition-colors ${showCalcParams ? 'bg-surface text-accent' : 'text-ink-3 hover:text-ink'}`}
                >
                  Aplicar (Capital / Interior)
                </button>
                <button
                  onClick={() => { setShowCalcParams(false); setCurrentPage(1); }}
                  className={`px-3.5 py-1.5 rounded-[4px] text-[12.5px] font-semibold transition-colors ${!showCalcParams ? 'bg-surface text-accent' : 'text-ink-3 hover:text-ink'}`}
                >
                  Ocultar
                </button>
              </div>

              {showCalcParams && (
                <div className="flex flex-row items-center gap-3">
                  <div className="inline-flex items-center gap-2.5 h-10 px-3 bg-surface border border-border-strong rounded-[6px]">
                    <label className="text-[11px] font-bold tracking-[0.04em] text-ink-3">CAPITAL</label>
                    <input
                      type="number"
                      aria-label="Limite Capital"
                      value={capitalInput}
                      onChange={(e) => { if (!cicloAtivo) setCapitalInput(e.target.value); }}
                      readOnly={!!cicloAtivo}
                      className={`ds-num w-14 h-7 bg-surface-3 border border-border rounded-[4px] text-center text-sm font-bold text-ink num focus:outline-none focus:border-accent focus:text-accent transition-colors ${cicloAtivo ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                  </div>
                  <div className="inline-flex items-center gap-2.5 h-10 px-3 bg-surface border border-border-strong rounded-[6px]">
                    <label className="text-[11px] font-bold tracking-[0.04em] text-ink-3">INTERIOR</label>
                    <input
                      type="number"
                      aria-label="Limite Interior"
                      value={interiorInput}
                      onChange={(e) => { if (!cicloAtivo) setInteriorInput(e.target.value); }}
                      readOnly={!!cicloAtivo}
                      className={`ds-num w-14 h-7 bg-surface-3 border border-border rounded-[4px] text-center text-sm font-bold text-ink num focus:outline-none focus:border-accent focus:text-accent transition-colors ${cicloAtivo ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                  </div>
                  <button
                    onClick={handleCalculate}
                    disabled={!capitalInput.trim() || !interiorInput.trim() || !!cicloAtivo}
                    className="h-10 px-5 rounded-[6px] bg-accent border border-accent text-accent-on text-[13px] font-semibold hover:bg-accent-strong hover:border-accent-strong disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-95"
                  >
                    Calcular
                  </button>
                </div>
              )}
          </div>
        </section>

        {/* ── Cabeçalho da tabela + legenda ─────────────────────── */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <h2 className="text-xs font-bold uppercase tracking-[0.06em] text-ink-2 whitespace-nowrap">
            Locais de votação
          </h2>
          <span className="text-[11.5px] text-ink-4 whitespace-nowrap">
            {formatNumber(sortedData.length)} locais
          </span>
          <span className="flex-1 h-px bg-border" />
          {(capitalLimit > 0 || interiorLimit > 0) && (
            <div className="flex items-center gap-4 flex-wrap text-[12px] text-ink-3">
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
            </div>
          )}
        </div>

        {/* ── Tabela ────────────────────────────────────────────── */}
        <section className="ds-card overflow-hidden">
          <div className="overflow-x-auto scroll-x">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-surface-2 border-b border-border-strong [&>th]:sticky [&>th]:top-0 [&>th]:bg-surface-2 [&>th]:px-4 [&>th]:py-3 [&>th]:whitespace-nowrap [&>th]:align-middle">
                  <th className="text-center"><SortHead field="zona">Zona</SortHead></th>
                  <th><SortHead field="municipio">Município</SortHead></th>
                  <th><SortHead field="local">Local de Votação</SortHead></th>
                  <th className="text-[10px] font-bold uppercase tracking-[0.07em] text-ink-3">
                    Seções <span className="text-ink-4 font-medium normal-case tracking-normal">(seção · eleitorado)</span>
                  </th>
                  <th className="text-center text-[10px] font-bold uppercase tracking-[0.07em] text-ink-3">Agregar</th>
                  <th className="text-center text-[10px] font-bold uppercase tracking-[0.07em] text-ink-3">Total</th>
                </tr>
              </thead>
              <tbody className="text-sm text-ink-2">
                {paginatedData.map((row) => {
                  const rowId = makeRowId(row.zona, row.municipio, row.local);
                  const isCapital = row.municipio.trim().toUpperCase() === 'NATAL';
                  const limit = isCapital ? capitalLimit : interiorLimit;

                  return (
                    <tr key={rowId} className="row-hover border-b border-border-faint transition-colors group">
                      <td className="px-4 py-3 text-center font-semibold text-ink-2 num">
                        {row.zona}
                      </td>
                      <td className="px-4 py-3 font-semibold text-ink whitespace-nowrap">
                        {row.municipio}
                        <div className="text-[10px] font-medium text-ink-4">{isCapital ? 'capital' : 'interior'}</div>
                      </td>
                      <td className="px-4 py-3 font-medium text-ink">
                        {row.local}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="grid grid-cols-[repeat(auto-fill,94px)] gap-[5px] max-w-[600px]">
                          {(row.secoes_detalhes || []).map((s) => (
                            <span
                              key={`${rowId}-${s.secao}`}
                              className={`flex items-center justify-between gap-1.5 px-2 py-[3px] rounded-[4px] border text-[11.5px] font-mono num whitespace-nowrap transition-colors ${getBadgeClasses(s.aptos, limit)}`}
                              title={`Seção ${padSecao(s.secao)} · ${formatNumber(s.aptos)} eleitores`}
                            >
                              <span className="font-bold">{padSecao(s.secao)}</span>
                              <span className="opacity-40">·</span>
                              <span className="font-semibold">{formatNumber(s.aptos)}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                      {/* AGREGAR */}
                      <td className="px-4 py-3 text-center">
                        {canEdit ? (
                          <input
                            type="checkbox"
                            aria-label="Agregar local"
                            checked={agregacoesData[rowId]?.agregar ?? false}
                            onChange={() => {
                              const newVal = !(agregacoesData[rowId]?.agregar ?? false);
                              saveAgregacaoField(rowId, 'agregar', newVal);
                              if (newVal) {
                                const hasTotal = (agregacoesData[rowId]?.total ?? '') !== '';
                                if (!hasTotal) {
                                  setTotalRequired(s => { const ns = new Set(s); ns.add(rowId); return ns; });
                                }
                                setTimeout(() => totalInputRefs.current[rowId]?.focus(), 0);
                              } else {
                                setTotalRequired(s => { const ns = new Set(s); ns.delete(rowId); return ns; });
                              }
                            }}
                            className="h-[18px] w-[18px] rounded cursor-pointer align-middle"
                            style={{ accentColor: 'var(--accent)' }}
                          />
                        ) : agregacoesData[rowId]?.agregar ? (
                          <Check size={16} className="inline text-accent" />
                        ) : (
                          <span className="text-ink-4">—</span>
                        )}
                      </td>
                      {/* TOTAL */}
                      <td className="px-4 py-3 text-center">
                        {canEdit ? (
                          <input
                            ref={(el) => { totalInputRefs.current[rowId] = el; }}
                            type="number"
                            aria-label="Total de eleitores"
                            min={0}
                            max={9999}
                            step={1}
                            value={totalDrafts[rowId] ?? (agregacoesData[rowId]?.total ?? '')}
                            onChange={(e) => {
                              setTotalDrafts(d => ({ ...d, [rowId]: e.target.value }));
                            }}
                            onBlur={() => {
                              const required = totalRequired.has(rowId);
                              const draft = totalDrafts[rowId];
                              const effectiveValue = draft !== undefined
                                ? draft
                                : String(agregacoesData[rowId]?.total ?? '');
                              if (required && effectiveValue === '') {
                                setTimeout(() => totalInputRefs.current[rowId]?.focus(), 0);
                                return;
                              }
                              commitTotal(rowId);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              if (e.key === 'Escape') {
                                const required = totalRequired.has(rowId);
                                const draft = totalDrafts[rowId];
                                const effectiveValue = draft !== undefined
                                  ? draft
                                  : String(agregacoesData[rowId]?.total ?? '');
                                if (required && effectiveValue === '') {
                                  setTotalDrafts(d => { const nd = { ...d }; delete nd[rowId]; return nd; });
                                  return;
                                }
                                setTotalDrafts(d => { const nd = { ...d }; delete nd[rowId]; return nd; });
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            className={`ds-num w-16 h-8 px-2 text-center rounded-[4px] bg-surface border text-sm font-bold num outline-none transition-colors ${
                              totalRequired.has(rowId) && (totalDrafts[rowId] ?? String(agregacoesData[rowId]?.total ?? '')) === ''
                                ? 'border-warn text-warn'
                                : 'border-border-strong text-ink hover:border-accent focus:border-accent'
                            }`}
                          />
                        ) : (
                          <span className="font-bold text-ink num">{getTotal(rowId)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {paginatedData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-14 text-center text-ink-3 text-[13.5px]">
                      Nenhum resultado encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-4 py-3 bg-surface-2 border-t border-border flex items-center justify-between gap-4 flex-wrap">
              <span className="text-[12.5px] text-ink-3">
                Página <span className="text-ink font-bold">{currentPage}</span> de <span className="text-ink font-bold">{totalPages}</span> — <span className="text-ink font-bold num">{sortedData.length}</span> locais
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
