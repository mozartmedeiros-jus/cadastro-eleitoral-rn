'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

// Estilos do controle segmentado (mesmo padrão da barra de Estatística / Gestão Orçamentária).
const SEG = 'h-[34px] px-3 rounded-[4px] text-center text-[12.5px] font-semibold whitespace-nowrap transition-colors motion-reduce:transition-none inline-flex items-center justify-center';
const SEG_ON = 'bg-accent-soft text-accent-ink border border-accent-soft-border';
const SEG_OFF = 'text-ink-2 hover:text-ink hover:bg-surface-3 border border-transparent';
const GROUP = 'inline-grid rounded-[6px] border border-border-strong bg-surface p-0.5';

/**
 * Barra de navegação das Agregações (substitui o submenu da sidebar).
 * Ciclos e Análise são exclusivos do SPLE — barra só aparece para usuário logado.
 */
export default function AgregacoesNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  if (!user) return null;

  const onCiclos = pathname.startsWith('/agregacoes/ciclos');
  const onAnalise = pathname.startsWith('/agregacoes/analise');

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 mt-5 flex flex-wrap items-center gap-2.5">
      <div role="group" aria-label="Seções de agregações" className={`${GROUP} grid-cols-[repeat(2,minmax(var(--seg-w),1fr))]`}>
        <Link href="/agregacoes/ciclos" className={`${SEG} ${onCiclos ? SEG_ON : SEG_OFF}`}>
          Ciclos
        </Link>
        <Link href="/agregacoes/analise" className={`${SEG} ${onAnalise ? SEG_ON : SEG_OFF}`}>
          Análise
        </Link>
      </div>
    </div>
  );
}
