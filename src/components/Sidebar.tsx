'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, BarChart2, Map, LayoutDashboard, Menu, X, History } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  sub: boolean;
  authRequired: boolean;
}

const navigation: NavItem[] = [
  { name: 'Estatística',  href: '/',                    icon: BarChart3, sub: false, authRequired: false },
  { name: 'Agregações',   href: '/agregacoes',           icon: Map,       sub: false, authRequired: false },
  { name: 'Ciclos',       href: '/agregacoes/ciclos',    icon: History,   sub: true,  authRequired: true  },
  { name: 'Análise',      href: '/agregacoes/analise',   icon: BarChart2, sub: true,  authRequired: true  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const visibleNav = navigation.filter(item => !item.authRequired || !!user);

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/45 z-[55] lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 z-[60] h-screen w-[248px] flex-shrink-0 flex flex-col
          bg-[var(--surface)] border-r border-[var(--border)]
          transition-transform duration-200 ease-in-out
          lg:static lg:translate-x-0 lg:z-auto
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Brand */}
        <div className="h-16 flex items-center gap-[11px] px-5 border-b border-[var(--border)] shrink-0">
          <div className="w-[34px] h-[34px] rounded-[var(--r-md)] grid place-items-center shrink-0 bg-[var(--accent-soft-bg)] text-[var(--accent-text)] border border-[var(--accent-soft-bd)]">
            <LayoutDashboard size={16} />
          </div>
          <div>
            <div className="font-bold text-sm tracking-tight text-[var(--ink)]">TRE-RN</div>
            <div className="text-[11px] text-[var(--ink-3)] mt-px">Cadastro Eleitoral</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-[14px] py-[18px] overflow-y-auto">
          <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--ink-4)] px-[10px] pb-[10px]">
            Navegação
          </div>

          {visibleNav.map((item) => {
            const active = item.href === '/'
              ? pathname === '/'
              : item.href === '/agregacoes'
                ? pathname === '/agregacoes'
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`
                  relative flex items-center gap-[11px]
                  ${item.sub ? 'pl-[32px] py-[7px] text-[12.5px]' : 'px-3 py-[9px] text-[13.5px]'}
                  rounded-[var(--r-md)] mb-[3px]
                  font-medium border transition-colors duration-[120ms]
                  ${active
                    ? 'bg-[var(--accent-soft-bg)] text-[var(--accent-text)] border-[var(--accent-soft-bd)] font-semibold'
                    : 'text-[var(--ink-2)] border-transparent hover:bg-[var(--surface-3)] hover:text-[var(--ink)]'
                  }
                `}
              >
                <Icon
                  size={item.sub ? 15 : 18}
                  className={active ? 'text-[var(--accent-text)] shrink-0' : 'text-[var(--ink-4)] shrink-0'}
                />
                <span>{item.name}</span>
                {active && (
                  <span className="absolute left-[-14px] top-[7px] bottom-[7px] w-[3px] bg-[var(--accent-fill)] rounded-r-[3px]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-[22px] py-4 border-t border-[var(--border)] shrink-0">
          <p className="text-[11.5px] font-semibold text-[var(--ink-3)] m-0">Cadastro Eleitoral</p>
          <p className="text-[10.5px] text-[var(--ink-4)] mt-[3px] m-0">Estatísticas e Locais · 2026</p>
        </div>
      </aside>

      {/* Mobile hamburger */}
      <div className="lg:hidden fixed top-4 left-4 z-[70]">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-[38px] h-[38px] grid place-items-center rounded-[var(--r-md)] bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--ink-2)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--ink)]"
          aria-label="Menu"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
    </>
  );
}
