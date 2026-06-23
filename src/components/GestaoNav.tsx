'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Grupo = 'setor' | 'pi';

// Estilos do controle segmentado (mesmo padrão da barra de Estatística / home).
const SEG = 'h-[34px] px-3 rounded-[4px] text-center text-[12.5px] font-semibold whitespace-nowrap transition-colors motion-reduce:transition-none inline-flex items-center justify-center gap-1.5';
const SEG_ON = 'bg-accent-soft text-accent-ink border border-accent-soft-border';
const SEG_OFF = 'text-ink-2 hover:text-ink hover:bg-surface-3 border border-transparent';
const GROUP = 'inline-grid rounded-[6px] border border-border-strong bg-surface p-0.5';

function DevBadge() {
  return (
    <span className="rounded-[4px] bg-surface-3 text-ink-3 border border-border px-1 py-px text-[9px] font-bold uppercase tracking-[0.06em]">
      em dev
    </span>
  );
}

/**
 * Barra de navegação da Gestão Orçamentária (substitui o submenu da sidebar).
 * Visão consolidada (Por Setor | Por PI) é toggle de estado quando há `onGrupoChange`
 * (na própria visão); nas demais rotas vira link para a visão. Fases SPLE e Dados SERPRO
 * são sempre links para suas rotas; item ativo segue o pathname.
 */
export default function GestaoNav({
  grupoView,
  onGrupoChange,
  rightSlot,
}: {
  grupoView?: Grupo;
  onGrupoChange?: (v: Grupo) => void;
  rightSlot?: ReactNode;
}) {
  const pathname = usePathname();
  const onOverview = pathname === '/gestao-orcamentaria';
  const onExecucao = pathname.startsWith('/gestao-orcamentaria/execucao');
  const onSerpro = pathname.startsWith('/gestao-orcamentaria/dados-serpro');

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 mt-5 flex flex-wrap items-center gap-2.5">
      {/* Grupo 1 — Visão consolidada */}
      <div role="group" aria-label="Agrupamento da visão consolidada" className={`${GROUP} grid-cols-[repeat(2,minmax(var(--seg-w),1fr))]`}>
        {(['setor', 'pi'] as const).map((g) => {
          const label = g === 'setor' ? 'Por Setor' : 'Por PI';
          const active = onOverview && grupoView === g;
          return onGrupoChange ? (
            <button
              key={g}
              type="button"
              aria-pressed={active}
              onClick={() => onGrupoChange(g)}
              className={`${SEG} ${active ? SEG_ON : SEG_OFF}`}
            >
              {label}
            </button>
          ) : (
            <Link key={g} href="/gestao-orcamentaria" className={`${SEG} ${active ? SEG_ON : SEG_OFF}`}>
              {label}
            </Link>
          );
        })}
      </div>

      {/* Grupo 2 — Fases do processo SPLE */}
      <div role="group" aria-label="Fases do processo SPLE" className={`${GROUP} grid-cols-[repeat(3,minmax(var(--seg-w),1fr))]`}>
        <span title="Em desenvolvimento" aria-disabled="true" className={`${SEG} text-ink-4 border border-transparent cursor-default`}>
          Lançamento das unidades <DevBadge />
        </span>
        <span title="Em desenvolvimento" aria-disabled="true" className={`${SEG} text-ink-4 border border-transparent cursor-default`}>
          Aprovação do orçamento <DevBadge />
        </span>
        <Link href="/gestao-orcamentaria/execucao" className={`${SEG} ${onExecucao ? SEG_ON : SEG_OFF}`}>
          Execução do orçamento
        </Link>
      </div>

      {/* Grupo 3 — Dados SERPRO */}
      <div role="group" aria-label="Dados SERPRO" className={`${GROUP} grid-cols-[repeat(1,minmax(var(--seg-w),1fr))]`}>
        <Link href="/gestao-orcamentaria/dados-serpro" className={`${SEG} ${onSerpro ? SEG_ON : SEG_OFF}`}>
          Dados SERPRO
        </Link>
      </div>

      {rightSlot && <div className="ml-auto flex items-center gap-2.5">{rightSlot}</div>}
    </div>
  );
}
