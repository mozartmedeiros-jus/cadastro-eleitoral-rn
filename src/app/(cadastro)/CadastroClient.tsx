'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Download,
  MapPin, Eye, EyeOff, ArrowUpDown,
  X, BarChart3, RefreshCw
} from 'lucide-react';
import {
  collection, doc, onSnapshot, setDoc, serverTimestamp
} from 'firebase/firestore';
import { auth, db, makeRowId } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import meta from '@data/meta.json';
import { PontoApoio, PONTOS_CSV_URL } from '@/lib/pontos-apoio-csv';
import PontosApoioPanel from './PontosApoioPanel';
import { MesaMrj, MRJ_CSV_URL, localComCodigo } from '@/lib/mrj-csv';
import MrjPanel from './MrjPanel';

// Data de referência dos dados (YYYY-MM-DD → dd/mm/yyyy)
const DATA_REFERENCIA = meta.dataReferencia ? meta.dataReferencia.split('-').reverse().join('/') : null;

interface SecaoDetalhe {
  secao: string;
  aptos: number;
  situacao?: string;
}

interface LocationData {
  zona: number | string;
  municipio: string;
  local: string;
  total_secoes: number;
  secoes: string[];
  secoes_detalhes?: SecaoDetalhe[];
  tem_secao_aguardando?: boolean;
  qtd_aptos: number;
  qde_analfabetos: number;
  qde_idosos: number;
  qde_le_escreve: number;
  qde_eleit_c_defic: number;
}

/* Marcador de seção/local com cadastro aguardando processamento no TSE. */
const AGUARDANDO_HINT = 'Cadastro aguardando processamento no TSE';
function AguardandoMark() {
  return (
    <span className="text-warn font-bold" title={AGUARDANDO_HINT} aria-label={AGUARDANDO_HINT}>*</span>
  );
}

function formatNumber(val: number) {
  return new Intl.NumberFormat('pt-BR').format(val || 0);
}

function formatPercent(val: number, total: number) {
  if (!total) return '0,00%';
  const pct = (val / total) * 100;
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(pct) + '%';
}

function getAdministrador(totalSecoes: number) {
  if (totalSecoes <= 4) return 1;
  if (totalSecoes <= 8) return 2;
  if (totalSecoes <= 16) return 3;
  return 4;
}

function getCoordAcess(totalSecoes: number) {
  if (totalSecoes <= 2) return 0;
  if (totalSecoes <= 7) return 1;
  if (totalSecoes <= 14) return 2;
  return 3;
}

const AUX_SERV_POR_LOCAL = 3;

/* ── Cabeçalho de seção (rótulo + dica + régua) ─────────────────── */
function SectionHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-3 mt-1 mb-3">
      <h2 className="text-xs font-bold uppercase tracking-[0.06em] text-ink-2 whitespace-nowrap">{title}</h2>
      {hint && <span className="text-[11.5px] text-ink-4 whitespace-nowrap">{hint}</span>}
      <span className="flex-1 h-px bg-border" />
    </div>
  );
}

export default function CadastroClient({ initialData }: { initialData: LocationData[] }) {

  // View toggle: visão "Pessoal de apoio" (default) vs. "Pontos de Apoio" (CSV)
  const [view, setView] = useState<'pessoal' | 'pontos' | 'mrj'>('pessoal');
  const [pontosFiltered, setPontosFiltered] = useState<PontoApoio[]>([]);
  // Controles do painel de Pontos de Apoio elevados para a barra de controle (Atualizar + carimbo)
  const [pontosControls, setPontosControls] = useState<{
    lastUpdated: Date | null; refreshing: boolean; refresh: () => void;
  } | null>(null);
  // Idem para a visão MRJ (CSV de Mesas Receptoras de Justificativa)
  const [mrjFiltered, setMrjFiltered] = useState<MesaMrj[]>([]);
  const [mrjControls, setMrjControls] = useState<{
    lastUpdated: Date | null; refreshing: boolean; refresh: () => void;
  } | null>(null);

  // Filter States
  const [searchLocal, setSearchLocal] = useState('');
  const [selectedZona, setSelectedZona] = useState<string>('');
  const [selectedMuni, setSelectedMuni] = useState<string>('');
  const [selectedSituacao, setSelectedSituacao] = useState<string>('');

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Sorting States
  const [sortField, setSortField] = useState<keyof LocationData>('zona');
  const [sortAsc, setSortAsc] = useState(true);

  // Expanded Row IDs (key is zona-muni-local)
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Auth state
  const { user, authReady, canEdit } = useAuth();

  // Editable per-location data from Firestore (keyed by Firestore doc id)
  type LocalFields = { mesaMrj?: number; pontoApoio?: number; totalAgregacoes?: number };
  const [localData, setLocalData] = useState<Record<string, LocalFields>>({});
  // Local drafts while editing (uncommitted input values)
  const [mrjDrafts, setMrjDrafts] = useState<Record<string, string>>({});
  const [pontoDrafts, setPontoDrafts] = useState<Record<string, string>>({});
  const [agregDrafts, setAgregDrafts] = useState<Record<string, string>>({});


  // Subscribe to per-location editable data (all users, public read)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'mrj'), (snap) => {
      const next: Record<string, LocalFields> = {};
      snap.forEach((d) => {
        const data = d.data() as LocalFields;
        next[d.id] = {
          mesaMrj: typeof data.mesaMrj === 'number' ? data.mesaMrj : undefined,
          pontoApoio: typeof data.pontoApoio === 'number' ? data.pontoApoio : undefined,
          totalAgregacoes: typeof data.totalAgregacoes === 'number' ? data.totalAgregacoes : undefined,
        };
      });
      setLocalData(next);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveField = useCallback(async (
    firestoreId: string,
    field: 'mesaMrj' | 'pontoApoio' | 'totalAgregacoes',
    value: number,
  ) => {
    try {
      await setDoc(doc(db, 'mrj', firestoreId), {
        [field]: value,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email ?? null,
      }, { merge: true });
    } catch (err) {
      console.error(`Save ${field} failed:`, err);
    }
  }, []);

  const getMesaMrj = (firestoreId: string): number => {
    const draft = mrjDrafts[firestoreId];
    if (draft !== undefined) {
      const n = Number(draft);
      return Number.isFinite(n) ? n : 0;
    }
    return localData[firestoreId]?.mesaMrj ?? 0;
  };

  const getPontoApoio = (firestoreId: string): number => {
    const draft = pontoDrafts[firestoreId];
    if (draft !== undefined) {
      const n = Number(draft);
      return Number.isFinite(n) ? n : 0;
    }
    return localData[firestoreId]?.pontoApoio ?? 0;
  };

  const getTotalAgregacoes = (firestoreId: string): number => {
    const draft = agregDrafts[firestoreId];
    if (draft !== undefined) {
      const n = Number(draft);
      return Number.isFinite(n) ? n : 0;
    }
    return localData[firestoreId]?.totalAgregacoes ?? 0;
  };

  // MRV = Total Seções − Total Agregações (piso 0). Base dos cálculos de dimensionamento.
  const getMrv = (totalSecoes: number, firestoreId: string): number =>
    Math.max(0, totalSecoes - getTotalAgregacoes(firestoreId));

  // Cascading filter options: cada select respeita a seleção do outro
  const filterOptions = useMemo(() => {
    const zonas = new Set<string>();
    const munis = new Set<string>();

    initialData.forEach(d => {
      const zonaStr = d.zona ? String(d.zona) : '';
      if (zonaStr && (selectedMuni === '' || d.municipio === selectedMuni)) {
        zonas.add(zonaStr);
      }
      if (d.municipio && (selectedZona === '' || zonaStr === selectedZona)) {
        munis.add(d.municipio);
      }
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
  }, [initialData, selectedZona, selectedMuni]);

  // Auto-clear: se a seleção atual deixou de ser válida após o cruzamento, limpa
  useEffect(() => {
    if (selectedZona && !filterOptions.zonas.includes(selectedZona)) {
      setSelectedZona('');
    }
    if (selectedMuni && !filterOptions.municipios.includes(selectedMuni)) {
      setSelectedMuni('');
    }
  }, [filterOptions, selectedZona, selectedMuni]);

  // Filter & Search Logic
  const filteredData = useMemo(() => {
    return initialData.filter(item => {
      const matchLocal = searchLocal === '' ||
        item.local.toLowerCase().includes(searchLocal.toLowerCase());

      const matchZona = selectedZona === '' ||
        String(item.zona) === selectedZona;

      const matchMuni = selectedMuni === '' ||
        item.municipio === selectedMuni;

      const matchSituacao = selectedSituacao === '' ||
        (selectedSituacao === 'aguardando'
          ? !!item.tem_secao_aguardando
          : !item.tem_secao_aguardando);

      return matchLocal && matchZona && matchMuni && matchSituacao;
    });
  }, [initialData, searchLocal, selectedZona, selectedMuni, selectedSituacao]);

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
    let totalAdministradores = 0;
    let totalCoordAcess = 0;
    let totalMesaMrj = 0;
    let totalPontoApoio = 0;
    let totalAgregacoes = 0;
    let totalMrv = 0;

    filteredData.forEach(d => {
      const fid = makeRowId(d.zona, d.municipio, d.local);
      const mrv = getMrv(d.total_secoes, fid);
      totalSecoes += d.total_secoes;
      totalMrv += mrv;
      totalAptos += d.qtd_aptos;
      totalIdosos += d.qde_idosos;
      totalDefic += d.qde_eleit_c_defic;
      totalAnalfabetos += d.qde_analfabetos;
      totalAdministradores += getAdministrador(mrv);
      totalCoordAcess += getCoordAcess(mrv);
      totalMesaMrj += getMesaMrj(fid);
      totalPontoApoio += getPontoApoio(fid);
      totalAgregacoes += getTotalAgregacoes(fid);
    });

    const uniqueZonas = new Set(filteredData.map(d => String(d.zona))).size;
    const uniqueMunis = new Set(filteredData.map(d => d.municipio)).size;

    return {
      totalLocais: filteredData.length,
      totalSecoes,
      totalMesarios: totalMrv * 4,
      totalAdministradores,
      totalCoordAcess,
      totalAuxServ: filteredData.length * AUX_SERV_POR_LOCAL,
      totalMesaMrj,
      totalMesariosMrj: totalMesaMrj * 2,
      totalPontoApoio,
      totalAdmPredioExtra: totalPontoApoio * 2,
      totalAgregacoes,
      totalAptos,
      totalIdosos,
      totalDefic,
      totalAnalfabetos,
      uniqueZonas,
      uniqueMunis
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredData, localData, mrjDrafts, pontoDrafts, agregDrafts]);

  // Reset page when filters or page size change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchLocal, selectedZona, selectedMuni, selectedSituacao, pageSize]);

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
    setSelectedSituacao('');
  };

  const exportCSV = () => {
    // Generate CSV contents
    const headers = ['Mesarios (MRV)', 'Administrador de Predio', 'Coord. Acess.', 'Aux. Serv. Eleitorais', 'Total Agregacoes', 'MRV', 'Mesa MRJ', 'Mesarios MRJ', 'Ponto de Apoio', 'ADM Predio Extra', 'Zona', 'Municipio', 'Local', 'Total Secoes', 'Secoes', 'Qtd Aptos', 'Idosos', 'Analfabetos', 'Deficientes'];
    const csvRows = [headers.join(';')];

    sortedData.forEach(d => {
      const fid = makeRowId(d.zona, d.municipio, d.local);
      const mesaMrj = getMesaMrj(fid);
      const pontoApoio = getPontoApoio(fid);
      const mrv = getMrv(d.total_secoes, fid);
      const row = [
        mrv * 4,
        getAdministrador(mrv),
        getCoordAcess(mrv),
        AUX_SERV_POR_LOCAL,
        getTotalAgregacoes(fid),
        mrv,
        mesaMrj,
        mesaMrj * 2,
        pontoApoio,
        pontoApoio * 2,
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

  const exportPontosCSV = () => {
    const headers = ['Zona', 'Municipio', 'Local', 'Endereco', 'Funcionamento', 'Transmissao', 'Apoio'];
    const csvRows = [headers.join(';')];

    pontosFiltered.forEach(p => {
      const row = [
        `"${p.zona.replace(/"/g, '""')}"`,
        `"${p.municipio.replace(/"/g, '""')}"`,
        `"${p.local.replace(/"/g, '""')}"`,
        `"${p.endereco.replace(/"/g, '""')}"`,
        `"${p.funcionamento.replace(/"/g, '""')}"`,
        p.transmissao ? 'Sim' : '',
        `"${p.apoio.replace(/"/g, '""')}"`,
      ];
      csvRows.push(row.join(';'));
    });

    const csvContent = '﻿' + csvRows.join('\n'); // BOM para Excel (UTF-8)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `pontos_apoio_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportMrjCSV = () => {
    const headers = ['Zona', 'Municipio', 'Local', 'Endereco', '1o Turno', '2o Turno', '2o Turno (sem votacao)'];
    const csvRows = [headers.join(';')];

    mrjFiltered.forEach(m => {
      const row = [
        `"${m.zona.replace(/"/g, '""')}"`,
        `"${m.municipio.replace(/"/g, '""')}"`,
        `"${localComCodigo(m).replace(/"/g, '""')}"`,
        `"${m.endereco.replace(/"/g, '""')}"`,
        m.primeiroTurno ? 'Sim' : '',
        m.segundoTurno ? 'Sim' : '',
        m.segundoTurnoSemVotacao ? 'Sim' : '',
      ];
      csvRows.push(row.join(';'));
    });

    const csvContent = '﻿' + csvRows.join('\n'); // BOM para Excel (UTF-8)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `mrj_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;

  // KPIs base (5 destaque) e calculados (8 secundários) — só apresentação
  const baseKpis = [
    { label: 'Zonas', value: kpis.uniqueZonas, sub: 'com seções ativas', accent: false },
    { label: 'Municípios', value: kpis.uniqueMunis, sub: 'com seções ativas', accent: false },
    { label: 'Locais de Votação', value: formatNumber(kpis.totalLocais), sub: 'colégios / prédios', accent: false },
    { label: 'Total de Seções', value: formatNumber(kpis.totalSecoes), sub: 'seções eleitorais', accent: false },
    { label: 'Eleitores Aptos', value: formatNumber(kpis.totalAptos), sub: 'total de cidadãos', accent: true },
  ];
  const calcKpis = [
    { label: 'Mesários (MRV)', value: formatNumber(kpis.totalMesarios), sub: 'MRV × 4' },
    { label: 'ADM Prédio', value: formatNumber(kpis.totalAdministradores), sub: 'conforme MRV' },
    { label: 'Coord. Acess.', value: formatNumber(kpis.totalCoordAcess), sub: 'conforme MRV' },
    { label: 'Aux. Serv. Eleitorais', value: formatNumber(kpis.totalAuxServ), sub: 'locais × 3' },
    { label: 'Total Agregações', value: formatNumber(kpis.totalAgregacoes), sub: 'informado por admin' },
    { label: 'Mesa MRJ', value: formatNumber(kpis.totalMesaMrj), sub: 'informado por admin' },
    { label: 'Mesários MRJ', value: formatNumber(kpis.totalMesariosMrj), sub: 'Mesa MRJ × 2' },
    { label: 'Ponto de Apoio', value: formatNumber(kpis.totalPontoApoio), sub: 'informado por admin' },
    { label: 'ADM Prédio Extra', value: formatNumber(kpis.totalAdmPredioExtra), sub: 'Ponto Apoio × 2' },
  ];

  // Cabeçalho de coluna ordenável
  const SortHead = ({ field, children, center, stacked }: {
    field: keyof LocationData; children: React.ReactNode; center?: boolean; stacked?: boolean;
  }) => {
    const active = sortField === field;
    return (
      <th className={`px-4 py-3 ${center ? 'text-center' : ''}`}>
        <button
          onClick={() => handleSort(field)}
          className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.07em] transition-colors
            ${center ? 'justify-center w-full' : ''} ${active ? 'text-accent' : 'text-ink-3 hover:text-ink'}`}
        >
          <span className={stacked ? 'flex flex-col leading-[1.15] items-center' : ''}>{children}</span>
          {active
            ? (sortAsc ? <ChevronUp size={13} /> : <ChevronDown size={13} />)
            : <ArrowUpDown size={12} className="opacity-45" />}
        </button>
      </th>
    );
  };

  const hasFilter = searchLocal || selectedZona || selectedMuni || selectedSituacao;

  // Controles "Atualizar" (carimbo + refresh) elevados pelo painel da visão ativa (Pontos/MRJ).
  const viewControls = view === 'pontos' ? pontosControls : view === 'mrj' ? mrjControls : null;

  return (
    <div className="min-h-full bg-bg text-ink pb-14">
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-surface border-b border-border">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
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
              <BarChart3 size={20} className="text-accent shrink-0" />
              {view === 'pessoal'
                ? 'Estatísticas de Locais de Votação'
                : view === 'pontos'
                  ? 'Locais de Ponto de Apoio e Transmissão descentralizada'
                  : 'MRJ — Mesas Receptoras de Justificativa por Zona'}
            </h1>
          </div>
        </div>
      </header>

      {/* ── Barra de controle: seletor (esq.) + ações (dir.) ─────────── */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 mt-5 flex flex-wrap items-center justify-between gap-2.5">
        {/* Seletor segmentado de visão (3 itens de mesma largura) */}
        <div role="group" aria-label="Selecionar visão" className="inline-grid grid-cols-[repeat(3,minmax(var(--seg-w),1fr))] rounded-[6px] border border-border-strong bg-surface p-0.5">
          <button
            type="button"
            aria-pressed={view === 'pessoal'}
            onClick={() => setView('pessoal')}
            className={`h-[34px] px-3 rounded-[4px] text-center text-[12.5px] font-semibold whitespace-nowrap transition-colors motion-reduce:transition-none ${
              view === 'pessoal'
                ? 'bg-accent-soft text-accent-ink border border-accent-soft-border'
                : 'text-ink-2 hover:text-ink hover:bg-surface-3 border border-transparent'
            }`}
          >
            Pessoal de apoio
          </button>
          <button
            type="button"
            aria-pressed={view === 'pontos'}
            onClick={() => setView('pontos')}
            className={`h-[34px] px-3 rounded-[4px] text-center text-[12.5px] font-semibold whitespace-nowrap transition-colors motion-reduce:transition-none ${
              view === 'pontos'
                ? 'bg-accent-soft text-accent-ink border border-accent-soft-border'
                : 'text-ink-2 hover:text-ink hover:bg-surface-3 border border-transparent'
            }`}
          >
            Pontos de Apoio
          </button>
          <button
            type="button"
            aria-pressed={view === 'mrj'}
            onClick={() => setView('mrj')}
            className={`h-[34px] px-3 rounded-[4px] text-center text-[12.5px] font-semibold whitespace-nowrap transition-colors motion-reduce:transition-none ${
              view === 'mrj'
                ? 'bg-accent-soft text-accent-ink border border-accent-soft-border'
                : 'text-ink-2 hover:text-ink hover:bg-surface-3 border border-transparent'
            }`}
          >
            MRJ
          </button>
        </div>

        {/* Ações à direita: Atualizar (visões alimentadas por CSV: Pontos de Apoio e MRJ) + Exportar CSV */}
        <div className="flex flex-wrap items-center gap-2.5">
          {viewControls && (
            <>
              {viewControls.lastUpdated && (
                <span className="text-[12px] text-ink-4">
                  atualizado às{' '}
                  <span className="num">{viewControls.lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                </span>
              )}
              <button
                onClick={viewControls.refresh}
                disabled={viewControls.refreshing}
                className="inline-flex items-center gap-1.5 h-[38px] px-3.5 rounded-[6px] border border-border-strong bg-surface text-ink-2 text-[13px] font-semibold hover:bg-surface-3 hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw size={14} className={viewControls.refreshing ? 'animate-spin motion-reduce:animate-none' : ''} />
                Atualizar
              </button>
            </>
          )}

          {/* Exportar CSV — handler por visão */}
          <button
            onClick={view === 'pessoal' ? exportCSV : view === 'pontos' ? exportPontosCSV : exportMrjCSV}
            aria-label="Exportar CSV"
            className="inline-flex items-center gap-2 h-[38px] px-4 rounded-[6px] bg-accent border border-accent text-accent-on text-[13px] font-semibold hover:bg-accent-strong hover:border-accent-strong transition-colors"
          >
            <Download size={14} /> <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {view === 'pessoal' && (
      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* ── Indicadores-base (5 destaque) ─────────────────────── */}
        <SectionHead title="Indicadores-base" hint="extraídos diretamente do cadastro" />
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-7">
          {baseKpis.map((k) => (
            <div key={k.label} className="relative ds-card p-[18px] overflow-hidden">
              <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent" />
              <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-3">{k.label}</div>
              <div className={`num mt-2 text-[30px] font-bold tracking-[-0.025em] leading-none ${k.accent ? 'text-accent' : 'text-ink'}`}>{k.value}</div>
              <div className="mt-[7px] text-[11px] text-ink-4">{k.sub}</div>
            </div>
          ))}
        </section>

        {/* ── Valores calculados (9 secundários) ────────────────── */}
        <SectionHead title="Valores calculados" hint="derivados de regras de dimensionamento" />
        <section className="ds-card overflow-hidden mb-7">
          {/* Linha 1 — 4 valores derivados de seções/locais */}
          <div className="grid grid-cols-2 md:grid-cols-4">
            {calcKpis.slice(0, 4).map((k, i) => (
              <div
                key={k.label}
                className={`p-4 border-border-faint
                  ${i % 4 !== 3 ? 'border-r' : ''}
                  max-md:[&:nth-child(odd)]:border-r max-md:[&:nth-child(n+3)]:border-t`}
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.05em] text-ink-3 leading-[1.3] min-h-[26px]">{k.label}</div>
                <div className="num mt-1.5 text-[21px] font-bold tracking-[-0.02em] leading-none text-ink">{k.value}</div>
                <div className="mt-1 text-[10px] text-ink-4">{k.sub}</div>
              </div>
            ))}
          </div>
          {/* Linha 2 — 5 valores informados por admin (e derivados) */}
          <div className="grid grid-cols-2 md:grid-cols-5 border-t border-border-faint">
            {calcKpis.slice(4).map((k, i) => (
              <div
                key={k.label}
                className={`p-4 border-border-faint
                  ${i % 5 !== 4 ? 'border-r' : ''}
                  max-md:[&:nth-child(odd)]:border-r max-md:[&:nth-child(n+3)]:border-t`}
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.05em] text-ink-3 leading-[1.3] min-h-[26px]">{k.label}</div>
                <div className="num mt-1.5 text-[21px] font-bold tracking-[-0.02em] leading-none text-ink">{k.value}</div>
                <div className="mt-1 text-[10px] text-ink-4">{k.sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Barra de filtros ──────────────────────────────────── */}
        <section className="ds-card p-3.5 mb-[18px] flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <div className="flex-1 relative min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4 pointer-events-none" size={16} />
            <input
              type="text"
              aria-label="Buscar local ou município"
              value={searchLocal}
              onChange={(e) => setSearchLocal(e.target.value)}
              placeholder="Buscar local ou município…"
              className="ds-input w-full pl-9 pr-4"
            />
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-3">
            <div className="relative min-w-[150px] w-full sm:w-auto">
              <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4 pointer-events-none" />
              <select
                aria-label="Filtrar por zona"
                value={selectedZona}
                onChange={(e) => setSelectedZona(e.target.value)}
                className="ds-select w-full pl-9 pr-9"
              >
                <option value="">Todas as zonas</option>
                {filterOptions.zonas.map(z => (
                  <option key={z} value={z}>Zona {z}</option>
                ))}
              </select>
              <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
            </div>

            <div className="relative min-w-[180px] w-full sm:w-auto">
              <select
                aria-label="Filtrar por município"
                value={selectedMuni}
                onChange={(e) => setSelectedMuni(e.target.value)}
                className="ds-select w-full pl-3 pr-9"
              >
                <option value="">Todos os municípios</option>
                {filterOptions.municipios.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
            </div>

            <div className="relative min-w-[180px] w-full sm:w-auto">
              <select
                aria-label="Filtrar por situação da seção"
                value={selectedSituacao}
                onChange={(e) => setSelectedSituacao(e.target.value)}
                className="ds-select w-full pl-3 pr-9"
              >
                <option value="">Todas as situações</option>
                <option value="aguardando">Com seção aguardando processamento</option>
                <option value="ativo">Todas as seções ativas</option>
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

        {/* ── Legenda do marcador ───────────────────────────────── */}
        <p className="text-[11.5px] text-ink-3 mb-2 px-0.5">
          <span className="text-warn font-bold">*</span> {AGUARDANDO_HINT} — a seção/local segue ativa e conta no eleitorado.
        </p>

        {/* ── Tabela ────────────────────────────────────────────── */}
        <section className="ds-card overflow-hidden">
          <div className="overflow-x-auto scroll-x">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-surface-2 border-b border-border-strong [&>th]:sticky [&>th]:top-0 [&>th]:bg-surface-2 [&>th]:whitespace-nowrap [&>th]:align-middle">
                  <SortHead field="zona" center>Zona</SortHead>
                  <SortHead field="municipio">Município</SortHead>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.07em] text-ink-3">Local de Votação</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-[0.07em] text-ink-3">
                    <span className="flex flex-col leading-[1.15] items-center"><span>Total</span><span>Seções</span></span>
                  </th>
                  <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-[0.07em] text-ink-3">
                    <span className="flex flex-col leading-[1.15] items-center"><span>Total</span><span>Agregações</span></span>
                  </th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-[0.07em] text-ink-3" title="Total Seções − Total Agregações">
                    MRV
                  </th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-[0.07em] text-ink-3">
                    <span className="flex flex-col leading-[1.15] items-center"><span>Mesários</span><span>(MRV)</span></span>
                  </th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-[0.07em] text-ink-3">
                    <span className="flex flex-col leading-[1.15] items-center"><span>ADM</span><span>Prédio</span></span>
                  </th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-[0.07em] text-ink-3">
                    <span className="flex flex-col leading-[1.15] items-center"><span>Coord.</span><span>Acess.</span></span>
                  </th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-[0.07em] text-ink-3">
                    <span className="flex flex-col leading-[1.15] items-center"><span>Aux. Serv.</span><span>Eleitorais</span></span>
                  </th>
                  <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-[0.07em] text-ink-3">
                    <span className="flex flex-col leading-[1.15] items-center"><span>Mesa</span><span>MRJ</span></span>
                  </th>
                  <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-[0.07em] text-ink-3">
                    <span className="flex flex-col leading-[1.15] items-center"><span>Mesários</span><span>MRJ</span></span>
                  </th>
                  <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-[0.07em] text-ink-3">
                    <span className="flex flex-col leading-[1.15] items-center"><span>Ponto</span><span>Apoio</span></span>
                  </th>
                  <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-[0.07em] text-ink-3">
                    <span className="flex flex-col leading-[1.15] items-center"><span>ADM Prédio</span><span>Extra</span></span>
                  </th>
                </tr>
              </thead>
              <tbody className="text-sm text-ink-2">
                {paginatedData.map((row) => {
                  const rowId = `${row.zona}-${row.municipio}-${row.local}`;
                  const firestoreId = makeRowId(row.zona, row.municipio, row.local);
                  const isExpanded = expandedRows[rowId] || false;
                  const mrv = getMrv(row.total_secoes, firestoreId);

                  return (
                    <React.Fragment key={rowId}>
                      <tr
                        onClick={() => toggleRow(rowId)}
                        className="row-hover border-b border-border-faint transition-colors cursor-pointer group"
                      >
                        {/* Zona */}
                        <td className="px-4 py-[11px] text-center font-semibold text-ink-2 num">
                          {row.zona}
                        </td>
                        {/* Municipio */}
                        <td className="px-4 py-[11px] font-semibold text-ink whitespace-nowrap">
                          {row.municipio}
                        </td>
                        {/* Local Name */}
                        <td className="px-4 py-[11px] text-ink align-top min-w-[260px]">
                          <div className="flex items-start gap-2">
                            {isExpanded
                              ? <EyeOff size={15} className="text-accent shrink-0 mt-0.5" />
                              : <Eye size={15} className="text-ink-4 group-hover:text-accent shrink-0 mt-0.5 transition-colors" />}
                            <span className="whitespace-normal break-words leading-snug font-medium" title={row.local}>{row.local}{row.tem_secao_aguardando && <AguardandoMark />}</span>
                          </div>
                        </td>
                        {/* Total de secoes */}
                        <td className="px-4 py-[11px] text-center font-bold text-ink num">{row.total_secoes}</td>
                        {/* Total Agregações */}
                        <td className="px-2 py-[11px] text-center"
                            onClick={(e) => { if (canEdit) e.stopPropagation(); }}>
                          {canEdit ? (
                            <input
                              type="number"
                              min={0}
                              max={9999}
                              step={1}
                              aria-label="Total de agregações"
                              value={agregDrafts[firestoreId] ?? (localData[firestoreId]?.totalAgregacoes ?? '')}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                e.stopPropagation();
                                setAgregDrafts(d => ({ ...d, [firestoreId]: e.target.value }));
                              }}
                              onBlur={(e) => {
                                e.stopPropagation();
                                const raw = agregDrafts[firestoreId];
                                if (raw === undefined) return;
                                const n = raw === '' ? 0 : Math.max(0, Math.min(9999, Math.floor(Number(raw))));
                                if (!Number.isFinite(n)) return;
                                saveField(firestoreId, 'totalAgregacoes', n);
                                setAgregDrafts(d => {
                                  const nd = { ...d };
                                  delete nd[firestoreId];
                                  return nd;
                                });
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                if (e.key === 'Escape') {
                                  setAgregDrafts(d => {
                                    const nd = { ...d };
                                    delete nd[firestoreId];
                                    return nd;
                                  });
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              className="ds-num w-16 h-8 px-2 text-center rounded-[4px] bg-surface border border-border-strong text-sm font-bold text-ink num hover:border-accent focus:border-accent outline-none transition-colors"
                            />
                          ) : (
                            <span className="font-bold text-ink num">
                              {localData[firestoreId]?.totalAgregacoes ?? 0}
                            </span>
                          )}
                        </td>
                        {/* MRV = Total Seções − Total Agregações */}
                        <td className="px-4 py-[11px] text-center font-bold text-ink num">{mrv}</td>
                        {/* Mesários (MRV) */}
                        <td className="px-4 py-[11px] text-center font-semibold text-ink-2 num">{mrv * 4}</td>
                        {/* Administrador de Prédio */}
                        <td className="px-4 py-[11px] text-center font-semibold text-ink-2 num">{getAdministrador(mrv)}</td>
                        {/* Coord. Acess. */}
                        <td className="px-4 py-[11px] text-center font-semibold text-ink-2 num">{getCoordAcess(mrv)}</td>
                        {/* Aux. Serv. Eleitorais */}
                        <td className="px-4 py-[11px] text-center font-semibold text-ink-2 num">{AUX_SERV_POR_LOCAL}</td>
                        {/* Mesa MRJ */}
                        <td className="px-2 py-[11px] text-center"
                            onClick={(e) => { if (canEdit) e.stopPropagation(); }}>
                          {canEdit ? (
                            <input
                              type="number"
                              min={0}
                              max={9999}
                              step={1}
                              aria-label="Mesas (MRJ)"
                              value={mrjDrafts[firestoreId] ?? (localData[firestoreId]?.mesaMrj ?? '')}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                e.stopPropagation();
                                setMrjDrafts(d => ({ ...d, [firestoreId]: e.target.value }));
                              }}
                              onBlur={(e) => {
                                e.stopPropagation();
                                const raw = mrjDrafts[firestoreId];
                                if (raw === undefined) return;
                                const n = raw === '' ? 0 : Math.max(0, Math.min(9999, Math.floor(Number(raw))));
                                if (!Number.isFinite(n)) return;
                                saveField(firestoreId, 'mesaMrj', n);
                                setMrjDrafts(d => {
                                  const nd = { ...d };
                                  delete nd[firestoreId];
                                  return nd;
                                });
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                if (e.key === 'Escape') {
                                  setMrjDrafts(d => {
                                    const nd = { ...d };
                                    delete nd[firestoreId];
                                    return nd;
                                  });
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              className="ds-num w-16 h-8 px-2 text-center rounded-[4px] bg-surface border border-border-strong text-sm font-bold text-ink num hover:border-accent focus:border-accent outline-none transition-colors"
                            />
                          ) : (
                            <span className="font-bold text-ink num">
                              {localData[firestoreId]?.mesaMrj ?? 0}
                            </span>
                          )}
                        </td>
                        {/* Mesários MRJ */}
                        <td className="px-2 py-[11px] text-center font-semibold text-ink-2 num">
                          {getMesaMrj(firestoreId) * 2}
                        </td>
                        {/* Ponto de Apoio */}
                        <td className="px-2 py-[11px] text-center"
                            onClick={(e) => { if (canEdit) e.stopPropagation(); }}>
                          {canEdit ? (
                            <input
                              type="number"
                              min={0}
                              max={9999}
                              step={1}
                              aria-label="Ponto de apoio"
                              value={pontoDrafts[firestoreId] ?? (localData[firestoreId]?.pontoApoio ?? '')}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                e.stopPropagation();
                                setPontoDrafts(d => ({ ...d, [firestoreId]: e.target.value }));
                              }}
                              onBlur={(e) => {
                                e.stopPropagation();
                                const raw = pontoDrafts[firestoreId];
                                if (raw === undefined) return;
                                const n = raw === '' ? 0 : Math.max(0, Math.min(9999, Math.floor(Number(raw))));
                                if (!Number.isFinite(n)) return;
                                saveField(firestoreId, 'pontoApoio', n);
                                setPontoDrafts(d => {
                                  const nd = { ...d };
                                  delete nd[firestoreId];
                                  return nd;
                                });
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                if (e.key === 'Escape') {
                                  setPontoDrafts(d => {
                                    const nd = { ...d };
                                    delete nd[firestoreId];
                                    return nd;
                                  });
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              className="ds-num w-16 h-8 px-2 text-center rounded-[4px] bg-surface border border-border-strong text-sm font-bold text-ink num hover:border-accent focus:border-accent outline-none transition-colors"
                            />
                          ) : (
                            <span className="font-bold text-ink num">
                              {localData[firestoreId]?.pontoApoio ?? 0}
                            </span>
                          )}
                        </td>
                        {/* ADM Prédio Extra */}
                        <td className="px-2 py-[11px] text-center font-semibold text-ink-2 num">
                          {getPontoApoio(firestoreId) * 2}
                        </td>
                      </tr>

                      {/* Linha expandida */}
                      {isExpanded && (
                        <tr className="bg-surface-2">
                          <td colSpan={14} className="px-0 py-0 border-t border-b border-accent-soft-border">
                            <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-3 gap-6">
                              {/* Painel esquerdo: estatísticas */}
                              <div className="md:col-span-2 space-y-3.5">
                                <h4 className="text-[11px] font-bold uppercase tracking-[0.09em] text-accent flex items-center gap-2">
                                  <MapPin size={13} /> Composição do eleitorado
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                  <div className="ds-card rounded-[4px] p-3">
                                    <div className="text-[10.5px] text-ink-3 font-semibold">Eleitores aptos</div>
                                    <div className="num text-[17px] font-bold text-ink mt-1">{formatNumber(row.qtd_aptos)}</div>
                                  </div>
                                  <div className="ds-card rounded-[4px] p-3">
                                    <div className="text-[10.5px] text-ink-3 font-semibold">Idosos</div>
                                    <div className="num text-[17px] font-bold text-ink mt-1">{formatNumber(row.qde_idosos)}</div>
                                    <div className="text-[10px] text-ink-4 mt-0.5">{formatPercent(row.qde_idosos, row.qtd_aptos)}</div>
                                  </div>
                                  <div className="ds-card rounded-[4px] p-3">
                                    <div className="text-[10.5px] text-ink-3 font-semibold">Com deficiência</div>
                                    <div className="num text-[17px] font-bold text-ink mt-1">{formatNumber(row.qde_eleit_c_defic)}</div>
                                    <div className="text-[10px] text-ink-4 mt-0.5">{formatPercent(row.qde_eleit_c_defic, row.qtd_aptos)}</div>
                                  </div>
                                  <div className="ds-card rounded-[4px] p-3">
                                    <div className="text-[10.5px] text-ink-3 font-semibold">Não alfabetizados</div>
                                    <div className="num text-[17px] font-bold text-ink mt-1">{formatNumber(row.qde_analfabetos)}</div>
                                    <div className="text-[10px] text-ink-4 mt-0.5">{formatPercent(row.qde_analfabetos, row.qtd_aptos)}</div>
                                  </div>
                                </div>
                              </div>

                              {/* Painel direito: seções */}
                              <div className="space-y-2">
                                <h4 className="text-[11px] font-bold uppercase tracking-[0.09em] text-ink-3">
                                  Seções vinculadas ({row.total_secoes})
                                </h4>
                                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-2 scroll-y">
                                  {row.secoes.map(sec => {
                                    const aguardando = (row.secoes_detalhes ?? []).some(s => s.secao === sec && s.situacao);
                                    return (
                                      <span
                                        key={sec}
                                        className={`font-mono text-[11.5px] font-semibold rounded-[4px] px-2 py-0.5 num border ${aguardando ? 'text-warn bg-warn-soft border-warn-border' : 'text-accent bg-accent-soft border-accent-soft-border'}`}
                                      >
                                        {sec}{aguardando && <AguardandoMark />}
                                      </span>
                                    );
                                  })}
                                </div>
                                {row.tem_secao_aguardando && (
                                  <p className="text-[10.5px] text-ink-4 leading-snug pt-1">
                                    <span className="text-warn font-bold">*</span> {AGUARDANDO_HINT}
                                  </p>
                                )}
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
                    <td colSpan={14} className="p-14 text-center text-ink-3 text-[13.5px]">
                      Nenhum local de votação corresponde aos filtros informados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Rodapé de paginação */}
          {sortedData.length > 0 && (
            <div className="px-4 py-3 bg-surface-2 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-[12.5px] text-ink-3">
                Exibindo <span className="text-ink font-bold num">{(currentPage - 1) * pageSize + 1}</span>–
                <span className="text-ink font-bold num">{Math.min(currentPage * pageSize, sortedData.length)}</span> de{' '}
                <span className="text-ink font-bold num">{sortedData.length}</span> locais
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
                      {[10, 25, 50, 100, 250].map(size => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex items-center gap-1 h-8 px-3 rounded-[4px] bg-surface border border-border-strong text-[12.5px] font-semibold text-ink-2 hover:bg-surface-3 hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={14} /> Anterior
                  </button>

                  <span className="text-[12.5px] text-ink-3 px-1.5">
                    Pág. <span className="text-ink font-bold">{currentPage}</span> de <span className="text-ink font-bold">{totalPages}</span>
                  </span>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
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
      )}

      {view === 'pontos' && (
        <PontosApoioPanel url={PONTOS_CSV_URL} onFilteredChange={setPontosFiltered} onControlsChange={setPontosControls} />
      )}

      {view === 'mrj' && (
        <MrjPanel url={MRJ_CSV_URL} onFilteredChange={setMrjFiltered} onControlsChange={setMrjControls} />
      )}
    </div>
  );
}
