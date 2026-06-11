'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { collection, onSnapshot, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { History, RotateCcw, Trash2, ChevronDown, Check } from 'lucide-react';
import meta from '@data/meta.json';
import cadastroRaw from '@data/cadastro_eleitoral.json';

// Data de referência dos dados (YYYY-MM-DD → dd/mm/yyyy)
const DATA_REFERENCIA = meta.dataReferencia ? meta.dataReferencia.split('-').reverse().join('/') : null;

type SecaoEstat = {
  secao: string;
  aptos: number;
  qde_idosos?: number;
  perc_idosos?: number;
  qde_eleit_c_defic?: number;
  perc_eleit_c_defic?: number;
  qde_analfabetos?: number;
  perc_analfabetos?: number;
};
type LocalData = {
  zona: number | string;
  municipio: string;
  local: string;
  secoes_detalhes: SecaoEstat[];
};
const cadastroData = cadastroRaw as unknown as LocalData[];

interface CicloRowItem {
  rowId: string;
  zona: number | string;
  municipio: string;
  local: string;
  agregar?: boolean;
  total?: number;
}

interface CicloRow {
  id: string;
  capitalLimit: number;
  interiorLimit: number;
  locais: number;
  agregacoes: number;
  savedAt: Date | null;
  savedBy: string | null;
  rows: CicloRowItem[];
}

function formatDate(date: Date | null): string {
  if (!date) return '—';
  return date.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function parseRows(rawRows: Record<string, { agregar?: boolean; total?: number; zona?: number | string; municipio?: string; local?: string }> | undefined) {
  if (!rawRows) return { locais: 0, agregacoes: 0, rows: [] };
  const entries = Object.entries(rawRows);
  const rows: CicloRowItem[] = entries
    .map(([rowId, r]) => ({
      rowId,
      zona: r.zona ?? '',
      municipio: r.municipio ?? '',
      local: r.local ?? '',
      agregar: r.agregar,
      total: r.total,
    }))
    .sort((a, b) => {
      const za = Number(a.zona) || 0;
      const zb = Number(b.zona) || 0;
      if (za !== zb) return za - zb;
      const mc = a.municipio.localeCompare(b.municipio);
      if (mc !== 0) return mc;
      return a.local.localeCompare(b.local);
    });
  return {
    locais: rows.length,
    agregacoes: entries.reduce((sum, [, r]) => sum + (r.total ?? 0), 0),
    rows,
  };
}

export default function CiclosClient() {
  const { user, canEdit } = useAuth();
  const [ciclos, setCiclos] = useState<CicloRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedLocalId, setExpandedLocalId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const localMap = useMemo(() => {
    const m = new Map<string, LocalData>();
    for (const item of cadastroData) {
      m.set(`${item.zona}__${item.municipio}__${item.local}`, item);
    }
    return m;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'ciclos'), (snap) => {
      const list: CicloRow[] = snap.docs.map(d => {
        const data = d.data();
        const { locais, agregacoes, rows } = parseRows(data.rows);
        const savedAt = data.savedAt instanceof Timestamp ? data.savedAt.toDate() : null;
        return {
          id: d.id,
          capitalLimit: data.capitalLimit ?? 0,
          interiorLimit: data.interiorLimit ?? 0,
          locais,
          agregacoes,
          savedAt,
          savedBy: data.savedBy ?? null,
          rows,
        };
      });
      list.sort((a, b) => a.id.localeCompare(b.id));
      setCiclos(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'ciclos', id));
      setConfirmDelete(null);
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      console.error('Delete ciclo failed:', err);
    } finally {
      setDeleting(false);
    }
  }, [expandedId]);

  return (
    <div className="min-h-full bg-bg text-ink pb-14">

      {/* Modal de confirmação de exclusão */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-surface border border-border-strong rounded-[8px] shadow-lg max-w-sm w-full mx-4 p-6">
            <h2 className="text-[15px] font-bold text-ink mb-2">
              Apagar Ciclo {confirmDelete}
            </h2>
            <p className="text-[13px] text-ink-2 leading-relaxed mb-5">
              O ciclo será removido permanentemente. Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="h-9 px-4 rounded-[6px] border border-border-strong bg-surface text-ink-2 text-[13px] font-semibold hover:bg-surface-3 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={deleting}
                className="h-9 px-4 rounded-[6px] bg-danger border border-danger text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Apagando…' : 'Confirmar exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-surface border-b border-border">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
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
            <History size={20} className="text-accent shrink-0" />
            Ciclos Guardados
          </h1>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="flex items-baseline gap-3 mt-1 mb-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.06em] text-ink-2 whitespace-nowrap">
            Ciclos salvos
          </h2>
          <span className="text-[11.5px] text-ink-4 whitespace-nowrap">
            clique no código para ver o conteúdo · clique em Recuperar para restaurar
          </span>
          <span className="flex-1 h-px bg-border" />
        </div>

        <section className="ds-card overflow-hidden">
          {loading ? (
            <div className="p-14 text-center text-ink-3 text-[13.5px]">
              Carregando ciclos…
            </div>
          ) : ciclos.length === 0 ? (
            <div className="p-14 text-center text-ink-3 text-[13.5px]">
              Nenhum ciclo salvo ainda. Vá para{' '}
              <Link href="/agregacoes" className="text-accent underline underline-offset-2">
                Agregações
              </Link>{' '}
              e clique em “Salvar ciclo”.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-surface-2 border-b border-border-strong">
                    {['Ciclo', 'Capital', 'Interior', 'Locais', 'Agregações', 'Salvo em', 'Salvo por', ''].map((col) => (
                      <th key={col} className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.07em] text-ink-3 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ciclos.map((c) => (
                    <>
                      <tr key={c.id} className="border-b border-border-faint hover:bg-surface-2 transition-colors">
                        {/* Ciclo ID — clicável para expandir */}
                        <td className="px-4 py-3">
                          <button
                            onClick={() => {
                              const closing = expandedId === c.id;
                              if (closing) setExpandedLocalId(null);
                              setExpandedId(closing ? null : c.id);
                            }}
                            className="flex items-center gap-1.5 font-bold text-ink font-mono text-[13.5px] hover:text-accent transition-colors"
                          >
                            <ChevronDown
                              size={14}
                              className={`text-ink-4 transition-transform duration-150 ${expandedId === c.id ? 'rotate-180' : ''}`}
                            />
                            {c.id}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center text-ink-2 num font-semibold">{c.capitalLimit}</td>
                        <td className="px-4 py-3 text-center text-ink-2 num font-semibold">{c.interiorLimit}</td>
                        <td className="px-4 py-3 text-center text-ink num font-bold">{c.locais}</td>
                        <td className="px-4 py-3 text-center text-accent num font-bold">{c.agregacoes}</td>
                        <td className="px-4 py-3 text-[13px] text-ink-3 whitespace-nowrap">{formatDate(c.savedAt)}</td>
                        <td className="px-4 py-3 text-[12.5px] text-ink-3 max-w-[180px] truncate">{c.savedBy ?? '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {user && (
                              <Link
                                href={`/agregacoes?ciclo=${c.id}`}
                                className="ds-tap inline-flex items-center gap-1.5 h-8 px-3 rounded-[4px] bg-surface border border-border-strong text-[12.5px] font-semibold text-ink-2 hover:bg-accent-soft hover:text-accent-ink hover:border-accent-soft-border transition-colors"
                              >
                                <RotateCcw size={12} />
                                Recuperar
                              </Link>
                            )}
                            {canEdit && (
                              <button
                                onClick={() => setConfirmDelete(c.id)}
                                className="ds-tap-icon h-8 w-8 grid place-items-center rounded-[4px] border border-border-strong bg-surface text-ink-3 hover:bg-danger-soft hover:text-danger hover:border-danger-border transition-colors"
                                aria-label={`Apagar ciclo ${c.id}`}
                                title={`Apagar ciclo ${c.id}`}
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Linha expandida com conteúdo do ciclo */}
                      {expandedId === c.id && (
                        <tr key={`${c.id}-expanded`}>
                          <td colSpan={8} className="px-0 py-0 bg-surface-2 border-b border-border">
                            <div className="px-6 py-4">
                              {c.rows.length === 0 ? (
                                <p className="text-[12.5px] text-ink-4 italic">Nenhum local salvo neste ciclo.</p>
                              ) : (
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="border-b border-border-strong">
                                      <th className="pb-2 pr-2 w-6" />
                                      {['Zona', 'Município', 'Local de Votação', 'Agregar', 'Total'].map(col => (
                                        <th key={col} className="pb-2 pr-4 text-[10px] font-bold uppercase tracking-[0.07em] text-ink-3 whitespace-nowrap">
                                          {col}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {c.rows.map(r => {
                                      const localData = localMap.get(`${r.zona}__${r.municipio}__${r.local}`);
                                      const isLocalExpanded = expandedLocalId === r.rowId;
                                      return (
                                        <>
                                          <tr key={r.rowId} className="border-b border-border-faint">
                                            <td className="py-2 pr-2">
                                              {localData && (
                                                <button
                                                  onClick={() => setExpandedLocalId(isLocalExpanded ? null : r.rowId)}
                                                  className="flex items-center justify-center w-5 h-5 rounded hover:bg-surface-3 transition-colors"
                                                  aria-label={isLocalExpanded ? 'Recolher seções' : 'Expandir seções'}
                                                >
                                                  <ChevronDown
                                                    size={12}
                                                    className={`text-ink-4 transition-transform duration-150 ${isLocalExpanded ? 'rotate-180' : ''}`}
                                                  />
                                                </button>
                                              )}
                                            </td>
                                            <td className="py-2 pr-4 text-[12.5px] font-semibold text-ink-2 num">{r.zona}</td>
                                            <td className="py-2 pr-4 text-[12.5px] font-semibold text-ink whitespace-nowrap">{r.municipio}</td>
                                            <td className="py-2 pr-4 text-[12.5px] text-ink">{r.local}</td>
                                            <td className="py-2 pr-4 text-center">
                                              {r.agregar
                                                ? <Check size={14} className="text-accent inline" />
                                                : <span className="text-ink-4">—</span>
                                              }
                                            </td>
                                            <td className="py-2 text-[12.5px] font-semibold text-ink num">
                                              {r.total !== undefined ? r.total : <span className="text-ink-4">—</span>}
                                            </td>
                                          </tr>
                                          {isLocalExpanded && localData && (
                                            <tr key={`${r.rowId}-secoes`}>
                                              <td colSpan={6} className="px-0 pb-2 pt-0">
                                                <div className="ml-7 mr-2 mb-1 border border-border rounded-[6px] overflow-hidden">
                                                  <table className="w-full text-left border-collapse">
                                                    <thead>
                                                      <tr className="bg-surface-3 border-b border-border">
                                                        {['Seção', 'Aptos', 'Idosos', 'C/ Defic.', 'Analfabetos'].map(col => (
                                                          <th key={col} className="px-3 py-1.5 text-[9.5px] font-bold uppercase tracking-[0.07em] text-ink-3 whitespace-nowrap">
                                                            {col}
                                                          </th>
                                                        ))}
                                                      </tr>
                                                    </thead>
                                                    <tbody>
                                                      {localData.secoes_detalhes.map(s => (
                                                        <tr key={s.secao} className="border-b border-border-faint last:border-0">
                                                          <td className="px-3 py-1.5 num text-[12px] font-semibold text-ink-2">{s.secao}</td>
                                                          <td className="px-3 py-1.5 num text-[12px] text-ink">{s.aptos}</td>
                                                          <td className="px-3 py-1.5 num text-[12px] text-ink">
                                                            {s.qde_idosos != null ? `${s.qde_idosos} (${s.perc_idosos?.toFixed(1)}%)` : '—'}
                                                          </td>
                                                          <td className="px-3 py-1.5 num text-[12px] text-ink">
                                                            {s.qde_eleit_c_defic != null ? `${s.qde_eleit_c_defic} (${s.perc_eleit_c_defic?.toFixed(1)}%)` : '—'}
                                                          </td>
                                                          <td className="px-3 py-1.5 num text-[12px] text-ink">
                                                            {s.qde_analfabetos != null ? `${s.qde_analfabetos} (${s.perc_analfabetos?.toFixed(1)}%)` : '—'}
                                                          </td>
                                                        </tr>
                                                      ))}
                                                    </tbody>
                                                  </table>
                                                </div>
                                              </td>
                                            </tr>
                                          )}
                                        </>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
