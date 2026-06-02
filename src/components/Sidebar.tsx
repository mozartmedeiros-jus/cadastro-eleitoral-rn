'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Database, LayoutDashboard, Menu, X } from 'lucide-react';

const navigation = [
  { name: 'Estatística', href: '/', icon: BarChart3 },
  { name: 'Agregações', href: '/agregacoes', icon: Database },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
          {navigation.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`
                  relative flex items-center gap-[11px]
                  px-3 py-[9px] rounded-[var(--r-md)] mb-[3px]
                  text-[13.5px] font-medium border transition-colors duration-[120ms]
                  ${active
                    ? 'bg-[var(--accent-soft-bg)] text-[var(--accent-text)] border-[var(--accent-soft-bd)] font-semibold'
                    : 'text-[var(--ink-2)] border-transparent hover:bg-[var(--surface-3)] hover:text-[var(--ink)]'
                  }
                `}
              >
                <Icon
                  size={18}
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
