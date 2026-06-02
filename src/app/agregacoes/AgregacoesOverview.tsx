'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, Timestamp } from 'firebase/firestore';
import { db, makeRowId } from '@/lib/firebase';
import { BarChart2, ChevronDown } from 'lucide-react';

interface SecaoDetalhe { secao: string; aptos: number; }
interface LocationData {
  zona: number | string;
  municipio: string;
  local: string;
  total_secoes: number;
  secoes_detalhes: SecaoDetalhe[];
}

interface CicloDoc {
  id: string;
  capitalLimit: number;
  interiorLimit: number;
  savedAt: Date | null;
  rows: Record<string, { zona?: number | string; municipio?: string; local?: string; agregar?: boolean; total?: number }>;
}

function formatNumber(n: number) {
  return new Intl.NumberFormat('pt-BR').format(n || 0);
}

function padSecao(s: string) { return s.padStart(4, '0'); }

export default function AgregacoesOverview({ initialData }: { initialData: LocationData[] }) {
  const [ciclos, setCiclos] = useState<CicloDoc[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loadingCiclos, setLoadingCiclos] = useState(true);

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

  // Mapa rowId → item do JSON estático para join
  const rowMap = useMemo(() =>
    Object.fromEntries(
      initialData.map(item => [makeRowId(item.zona, item.municipio, item.local), item])
    )
  , [initialData]);

  const ciclo = ciclos.find(c => c.id === selectedId) ?? null;

  // Linhas com AGREGAR marcado, enriquecidas com secoes_detalhes do JSON
  const agregadoRows = useMemo(() => {
    if (!ciclo) return [];
    return Object.entries(ciclo.rows)
      .filter(([, r]) => r.agregar === true)
      .map(([rowId, r]) => ({
        rowId,
        zona: r.zona ?? '',
        municipio: r.municipio ?? '',
        local: r.local ?? '',
        total: r.total,
        secoes_detalhes: rowMap[rowId]?.secoes_detalhes ?? [],
      }))
      .sort((a, b) => {
        const za = Number(a.zona) || 0, zb = Number(b.zona) || 0;
        if (za !== zb) return za - zb;
        return a.municipio.localeCompare(b.municipio) || a.local.localeCompare(b.local);
      });
  }, [ciclo, rowMap]);

  const kpis = useMemo(() => {
    const secoes = agregadoRows.reduce((s, r) => s + r.secoes_detalhes.length, 0);
    const secoesAgregadas = agregadoRows.reduce((s, r) => s + (r.total ?? 0), 0);
    const totalEleitores = agregadoRows.reduce((s, r) =>
      s + r.secoes_detalhes.reduce((ss, sec) => ss + sec.aptos, 0), 0);
    return { locais: agregadoRows.length, secoes, secoesAgregadas, totalEleitores };
  }, [agregadoRows]);

  const getBadgeClass = (aptos: number, limit: number) => {
    if (aptos <= 50) return 'bg-danger-soft border-danger-border text-danger';
    if (aptos <= limit) return 'bg-accent-soft border-accent-soft-border text-accent';
    return 'bg-surface border-border-strong text-ink-3';
  };

  return (
    <div className="min-h-full bg-bg text-ink pb-14">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-surface border-b border-border">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] text-ink-3">
              <span className="whitespace-nowrap">Tribunal Regional Eleitoral</span>
              <span className="w-[3px] h-[3px] rounded-full bg-ink-4" />
              <span className="text-accent font-semibold whitespace-nowrap">Cadastro Eleitoral</span>
            </div>
            <h1 className="mt-0.5 text-[20px] md:text-[22px] font-bold tracking-[-0.02em] text-ink flex items-center gap-2 leading-tight">
              <BarChart2 size={20} className="text-accent shrink-0" /> Agregações
            </h1>
          </div>

          {/* Seletor de ciclo */}
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3 whitespace-nowrap">
              Ciclo
            </label>
            <div className="relative">
              <select
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
                disabled={loadingCiclos}
                className="ds-select h-9 pl-3 pr-9 min-w-[140px] text-[13px] font-semibold"
              >
                <option value="">Selecionar…</option>
                {ciclos.map(c => (
                  <option key={c.id} value={c.id}>{c.id}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {!ciclo ? (
          <div className="ds-card p-14 text-center text-ink-3 text-[13.5px]">
            Selecione um ciclo no cabeçalho para visualizar os dados de agregação.
          </div>
        ) : (
          <>
            {/* Parâmetros do ciclo */}
            <div className="flex items-center gap-4 mb-4 text-[12.5px] text-ink-3">
              <span className="font-bold uppercase tracking-[0.05em]">Parâmetros:</span>
              <span>Capital <strong className="text-ink">{ciclo.capitalLimit}</strong></span>
              <span>Interior <strong className="text-ink">{ciclo.interiorLimit}</strong></span>
              {ciclo.savedAt && (
                <span className="ml-auto">
                  Salvo em <strong className="text-ink">
                    {ciclo.savedAt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </strong>
                </span>
              )}
            </div>

            {/* KPIs */}
            <div className="flex items-baseline gap-3 mb-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.06em] text-ink-2 whitespace-nowrap">Resumo do ciclo</h2>
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

            {/* Tabela de locais com seções */}
            <div className="flex items-baseline gap-3 mb-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.06em] text-ink-2 whitespace-nowrap">Locais e seções</h2>
              <span className="flex-1 h-px bg-border" />
            </div>

            {agregadoRows.length === 0 ? (
              <div className="ds-card p-10 text-center text-ink-3 text-[13.5px]">
                Nenhum local marcado como AGREGAR neste ciclo.
              </div>
            ) : (
              <section className="ds-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-surface-2 border-b border-border-strong [&>th]:px-4 [&>th]:py-3 [&>th]:text-[10px] [&>th]:font-bold [&>th]:uppercase [&>th]:tracking-[0.07em] [&>th]:text-ink-3 [&>th]:whitespace-nowrap">
                        <th className="text-center">Zona</th>
                        <th>Município</th>
                        <th>Local de Votação</th>
                        <th>Seções <span className="text-ink-4 font-medium normal-case tracking-normal">(seção · eleitores)</span></th>
                        <th className="text-center">Total</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm text-ink-2">
                      {agregadoRows.map(row => {
                        const isCapital = row.municipio.trim().toUpperCase() === 'NATAL';
                        const limit = isCapital ? ciclo.capitalLimit : ciclo.interiorLimit;
                        return (
                          <tr key={row.rowId} className="border-b border-border-faint">
                            <td className="px-4 py-3 text-center font-semibold text-ink-2 num">{row.zona}</td>
                            <td className="px-4 py-3 font-semibold text-ink whitespace-nowrap">
                              {row.municipio}
                              <div className="text-[10px] font-medium text-ink-4">{isCapital ? 'capital' : 'interior'}</div>
                            </td>
                            <td className="px-4 py-3 font-medium text-ink">{row.local}</td>
                            <td className="px-4 py-2.5">
                              <div className="grid grid-cols-[repeat(auto-fill,94px)] gap-[5px] max-w-[600px]">
                                {row.secoes_detalhes.map(s => (
                                  <span
                                    key={s.secao}
                                    className={`flex items-center justify-between gap-1.5 px-2 py-[3px] rounded-[4px] border text-[11.5px] font-mono num whitespace-nowrap ${getBadgeClass(s.aptos, limit)}`}
                                    title={`Seção ${padSecao(s.secao)} · ${formatNumber(s.aptos)} eleitores`}
                                  >
                                    <span className="font-bold">{padSecao(s.secao)}</span>
                                    <span className="opacity-40">·</span>
                                    <span className="font-semibold">{formatNumber(s.aptos)}</span>
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-ink num">
                              {row.total !== undefined ? row.total : <span className="text-ink-4">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
