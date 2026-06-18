'use client';

import { useState, useEffect, useMemo } from 'react';
import { BarChart3, AlertCircle } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import GestaoNav from '@/components/GestaoNav';

interface Item {
  id: string;
  setor: string;
  pi: string;
  vlrAprovado: number;
  vlrEstimado: number;
  vlrEmpenhado: number;
  vlrPago: number;
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}

function formatPercent(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 }).format(val || 0);
}

type GrupoRow = {
  chave: string;
  aprovado: number;
  estimado: number;
  empenhado: number;
  pago: number;
};

// Agrega os itens por uma chave (setor ou PI), somando os valores das fases.
function agrupar(data: Item[], keyOf: (d: Item) => string): GrupoRow[] {
  const map = new Map<string, GrupoRow>();
  for (const d of data) {
    const chave = keyOf(d) || '—';
    const row = map.get(chave) ?? { chave, aprovado: 0, estimado: 0, empenhado: 0, pago: 0 };
    row.aprovado += d.vlrAprovado || 0;
    row.estimado += d.vlrEstimado || 0;
    row.empenhado += d.vlrEmpenhado || 0;
    row.pago += d.vlrPago || 0;
    map.set(chave, row);
  }
  return Array.from(map.values()).sort((a, b) => a.chave.localeCompare(b.chave));
}

// Cabeçalho de seção (mesmo padrão da tela de Execução do Orçamento).
function SectionHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-3 mt-1 mb-3">
      <h2 className="text-xs font-bold uppercase tracking-[0.06em] text-ink-2 whitespace-nowrap">{title}</h2>
      {hint && <span className="text-[11.5px] text-ink-4 whitespace-nowrap">{hint}</span>}
      <span className="flex-1 h-px bg-border" />
    </div>
  );
}

export default function GestaoOrcamentariaClient() {
  const { user, authReady, canEdit } = useAuth();
  const [data, setData] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [grupoView, setGrupoView] = useState<'setor' | 'pi'>('setor');

  useEffect(() => {
    if (!canEdit) return;

    const unsub = onSnapshot(collection(db, 'opl_itens'), (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Item[];
      setData(docs);
      setLoading(false);
    });

    return () => unsub();
  }, [canEdit]);

  const dadosPorSetor = useMemo(() => agrupar(data, d => d.setor), [data]);
  const dadosPorPI = useMemo(() => agrupar(data, d => d.pi), [data]);
  const grupoRows = grupoView === 'setor' ? dadosPorSetor : dadosPorPI;

  const grupoTotais = useMemo(() => {
    return grupoRows.reduce(
      (acc, r) => {
        acc.aprovado += r.aprovado;
        acc.estimado += r.estimado;
        acc.diffEst += r.estimado ? r.aprovado - r.estimado : 0;
        acc.empenhado += r.empenhado;
        acc.aEmpenhar += r.empenhado ? r.aprovado - r.empenhado : 0;
        acc.pago += r.pago;
        acc.aPagar += r.pago ? r.aprovado - r.pago : 0;
        return acc;
      },
      { aprovado: 0, estimado: 0, diffEst: 0, empenhado: 0, aEmpenhar: 0, pago: 0, aPagar: 0 },
    );
  }, [grupoRows]);

  if (!authReady || (canEdit && loading)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 ds-card text-center">
        <AlertCircle size={40} className="mx-auto text-warn mb-4" />
        <h2 className="text-lg font-bold mb-2">Acesso Restrito</h2>
        <p className="text-ink-2 mb-6">Você precisa estar logado para visualizar a Gestão Orçamentária.</p>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 ds-card text-center">
        <AlertCircle size={40} className="mx-auto text-danger mb-4" />
        <h2 className="text-lg font-bold mb-2">Acesso Negado</h2>
        <p className="text-ink-2">Apenas administradores autorizados podem visualizar estes dados.</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-bg text-ink pb-14">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-surface border-b border-border">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] text-ink-3">
              <span className="whitespace-nowrap">Tribunal Regional Eleitoral</span>
              <span className="w-[3px] h-[3px] rounded-full bg-ink-4" />
              <span className="text-accent font-semibold whitespace-nowrap">Gestão SPLE</span>
            </div>
            <h1 className="mt-0.5 text-[20px] md:text-[22px] font-bold tracking-[-0.02em] text-ink flex items-center gap-2 leading-tight">
              <BarChart3 size={20} className="text-accent shrink-0" />
              Gestão Orçamentária · Exercício 2026
            </h1>
          </div>
        </div>
      </header>

      <GestaoNav grupoView={grupoView} onGrupoChange={setGrupoView} />

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* Visão consolidada */}
        <SectionHead
          title="Visão consolidada"
          hint={
            grupoView === 'setor'
              ? `${grupoRows.length} ${grupoRows.length === 1 ? 'setor' : 'setores'}`
              : `${grupoRows.length} ${grupoRows.length === 1 ? 'PI' : 'PIs'}`
          }
        />
        <section className="ds-card overflow-hidden mb-7">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-2 border-b border-border-strong [&>th]:px-4 [&>th]:py-3 [&>th]:text-[10px] [&>th]:font-bold [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-ink-3">
                  <th>{grupoView === 'setor' ? 'Setor' : 'Plano Integrado (PI)'}</th>
                  <th className="text-right">Orçamento Aprovado</th>
                  <th className="text-right">Estimado / Pré-empenho</th>
                  <th className="text-right">Δ Aprov. − Estim.</th>
                  <th className="text-right">Empenhado</th>
                  <th className="text-right">A empenhar</th>
                  <th className="text-right">Pago</th>
                  <th className="text-right">A pagar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-faint text-sm">
                {grupoRows.map((r) => {
                  const diffEst = r.estimado ? r.aprovado - r.estimado : null;
                  const aEmpenhar = r.empenhado ? r.aprovado - r.empenhado : null;
                  const aPagar = r.pago ? r.aprovado - r.pago : null;
                  const progress = r.aprovado > 0 ? Math.min(100, (r.empenhado / r.aprovado) * 100) : 0;
                  const deltaCell = (val: number | null) =>
                    val === null ? (
                      <span className="text-ink-4">—</span>
                    ) : (
                      <span className={val < 0 ? 'text-danger' : 'text-ink-2'}>{formatCurrency(val)}</span>
                    );
                  const moneyCell = (val: number) =>
                    val ? formatCurrency(val) : <span className="text-ink-4">—</span>;
                  return (
                    <tr key={r.chave} className="row-hover">
                      <td className="px-4 py-3.5 min-w-[180px]">
                        <div className="font-bold text-ink num">{r.chave}</div>
                        <div
                          className="mt-1.5 h-1 rounded-full bg-surface-3 overflow-hidden"
                          role="img"
                          aria-label={`Empenhado ${formatPercent(progress / 100)} do aprovado`}
                        >
                          <div className="h-full bg-accent rounded-full" style={{ width: `${progress}%` }} />
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right num font-bold text-ink">{moneyCell(r.aprovado)}</td>
                      <td className="px-4 py-3.5 text-right num text-ink-2">{moneyCell(r.estimado)}</td>
                      <td className="px-4 py-3.5 text-right num">{deltaCell(diffEst)}</td>
                      <td className="px-4 py-3.5 text-right num text-ink-2">{moneyCell(r.empenhado)}</td>
                      <td className="px-4 py-3.5 text-right num">{deltaCell(aEmpenhar)}</td>
                      <td className="px-4 py-3.5 text-right num text-ink-2">{moneyCell(r.pago)}</td>
                      <td className="px-4 py-3.5 text-right num">{deltaCell(aPagar)}</td>
                    </tr>
                  );
                })}
                {grupoRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-ink-4 italic">
                      Nenhum dado para consolidar.
                    </td>
                  </tr>
                )}
              </tbody>
              {grupoRows.length > 0 && (
                <tfoot>
                  <tr className="border-t border-border-strong font-bold [&>td]:px-4 [&>td]:py-3.5 [&>td]:text-right [&>td]:num bg-surface-2">
                    <td className="!text-left text-ink-3 text-[10px] uppercase tracking-wider">Totais</td>
                    <td className="text-ink">{formatCurrency(grupoTotais.aprovado)}</td>
                    <td className="text-ink-2">{formatCurrency(grupoTotais.estimado)}</td>
                    <td className={grupoTotais.diffEst < 0 ? 'text-danger' : 'text-ink-2'}>{formatCurrency(grupoTotais.diffEst)}</td>
                    <td className="text-ink-2">{formatCurrency(grupoTotais.empenhado)}</td>
                    <td className={grupoTotais.aEmpenhar < 0 ? 'text-danger' : 'text-ink-2'}>{formatCurrency(grupoTotais.aEmpenhar)}</td>
                    <td className="text-ink-2">{formatCurrency(grupoTotais.pago)}</td>
                    <td className={grupoTotais.aPagar < 0 ? 'text-danger' : 'text-ink-2'}>{formatCurrency(grupoTotais.aPagar)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
