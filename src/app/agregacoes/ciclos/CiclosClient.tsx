'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { collection, onSnapshot, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { History, RotateCcw, Trash2 } from 'lucide-react';

interface CicloRow {
  id: string;
  capitalLimit: number;
  interiorLimit: number;
  locais: number;
  agregacoes: number;
  savedAt: Date | null;
  savedBy: string | null;
}

function formatDate(date: Date | null): string {
  if (!date) return '—';
  return date.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function parseRows(rows: Record<string, { agregar?: boolean; total?: number }> | undefined) {
  if (!rows) return { locais: 0, agregacoes: 0 };
  const entries = Object.values(rows);
  return {
    locais: entries.length,
    agregacoes: entries.reduce((sum, r) => sum + (r.total ?? 0), 0),
  };
}

export default function CiclosClient() {
  const { canEdit } = useAuth();
  const [ciclos, setCiclos] = useState<CicloRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'ciclos'), (snap) => {
      const list: CicloRow[] = snap.docs.map(d => {
        const data = d.data();
        const { locais, agregacoes } = parseRows(data.rows);
        const savedAt = data.savedAt instanceof Timestamp ? data.savedAt.toDate() : null;
        return {
          id: d.id,
          capitalLimit: data.capitalLimit ?? 0,
          interiorLimit: data.interiorLimit ?? 0,
          locais,
          agregacoes,
          savedAt,
          savedBy: data.savedBy ?? null,
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
    } catch (err) {
      console.error('Delete ciclo failed:', err);
    } finally {
      setDeleting(false);
    }
  }, []);

  return (
    <div className="min-h-full bg-[var(--bg)] text-[var(--ink)] pb-14">

      {/* Modal de confirmação de exclusão */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-[8px] shadow-lg max-w-sm w-full mx-4 p-6">
            <h2 className="text-[15px] font-bold text-[var(--ink)] mb-2">
              Apagar Ciclo {confirmDelete}
            </h2>
            <p className="text-[13px] text-[var(--ink-2)] leading-relaxed mb-5">
              O ciclo será removido permanentemente. Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="h-9 px-4 rounded-[6px] border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--ink-2)] text-[13px] font-semibold hover:bg-[var(--surface-3)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={deleting}
                className="h-9 px-4 rounded-[6px] bg-[var(--danger)] border border-[var(--danger)] text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Apagando…' : 'Confirmar exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-[var(--surface)] border-b border-[var(--border)]">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-2 text-[11px] text-[var(--ink-3)]">
            <span className="whitespace-nowrap">Tribunal Regional Eleitoral</span>
            <span className="w-[3px] h-[3px] rounded-full bg-[var(--ink-4)]" />
            <span className="text-[var(--accent-text)] font-semibold whitespace-nowrap">Cadastro Eleitoral</span>
          </div>
          <h1 className="mt-0.5 text-[20px] md:text-[22px] font-bold tracking-[-0.02em] text-[var(--ink)] flex items-center gap-2 leading-tight">
            <History size={20} className="text-[var(--accent-text)] shrink-0" />
            Ciclos Guardados
          </h1>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="flex items-baseline gap-3 mt-1 mb-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--ink-2)] whitespace-nowrap">
            Ciclos salvos
          </h2>
          <span className="text-[11.5px] text-[var(--ink-4)] whitespace-nowrap">
            clique em Recuperar para restaurar um ciclo
          </span>
          <span className="flex-1 h-px bg-[var(--border)]" />
        </div>

        <section className="ds-card overflow-hidden">
          {loading ? (
            <div className="p-14 text-center text-[var(--ink-3)] text-[13.5px]">
              Carregando ciclos…
            </div>
          ) : ciclos.length === 0 ? (
            <div className="p-14 text-center text-[var(--ink-3)] text-[13.5px]">
              Nenhum ciclo salvo ainda. Vá para{' '}
              <Link href="/agregacoes" className="text-[var(--accent-text)] underline underline-offset-2">
                Agregações
              </Link>{' '}
              e clique em "Salvar ciclo".
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-[var(--surface-2)] border-b border-[var(--border-strong)]">
                    {['Ciclo', 'Capital', 'Interior', 'Locais', 'Agregações', 'Salvo em', 'Salvo por', ''].map((col) => (
                      <th key={col} className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.07em] text-[var(--ink-3)] whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ciclos.map((c) => (
                    <tr key={c.id} className="border-b border-[var(--border-faint)] hover:bg-[var(--surface-2)] transition-colors">
                      <td className="px-4 py-3 font-bold text-[var(--ink)] font-mono text-[13.5px]">{c.id}</td>
                      <td className="px-4 py-3 text-center text-[var(--ink-2)] num font-semibold">{c.capitalLimit}</td>
                      <td className="px-4 py-3 text-center text-[var(--ink-2)] num font-semibold">{c.interiorLimit}</td>
                      <td className="px-4 py-3 text-center text-[var(--ink)] num font-bold">{c.locais}</td>
                      <td className="px-4 py-3 text-center text-[var(--accent-text)] num font-bold">{c.agregacoes}</td>
                      <td className="px-4 py-3 text-[13px] text-[var(--ink-3)] whitespace-nowrap">{formatDate(c.savedAt)}</td>
                      <td className="px-4 py-3 text-[12.5px] text-[var(--ink-3)] max-w-[180px] truncate">{c.savedBy ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/agregacoes?ciclo=${c.id}`}
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[4px] bg-[var(--surface)] border border-[var(--border-strong)] text-[12.5px] font-semibold text-[var(--ink-2)] hover:bg-[var(--accent-soft-bg)] hover:text-[var(--accent-text)] hover:border-[var(--accent-soft-bd)] transition-colors"
                          >
                            <RotateCcw size={12} />
                            Recuperar
                          </Link>
                          {canEdit && (
                            <button
                              onClick={() => setConfirmDelete(c.id)}
                              className="h-8 w-8 grid place-items-center rounded-[4px] border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--ink-3)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger-text)] hover:border-[var(--danger-bd)] transition-colors"
                              title={`Apagar ciclo ${c.id}`}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
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
