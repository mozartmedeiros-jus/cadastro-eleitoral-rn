'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Database, LayoutDashboard, Menu, X, ChevronDown, History } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const navigation = [
  { name: 'Estatística', href: '/', icon: BarChart3 },
  { name: 'Agregações', href: '/agregacoes', icon: Database },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [ciclos, setCiclos] = useState<Array<{ id: string }>>([]);
  const [ciclosOpen, setCiclosOpen] = useState(false);

  useEffect(() => {
    if (pathname === '/agregacoes') {
      getDocs(collection(db, 'ciclos')).then(snap => {
        const list = snap.docs
          .map(d => ({ id: d.id }))
          .sort((a, b) => a.id.localeCompare(b.id));
        setCiclos(list);
        if (list.length > 0) setCiclosOpen(true);
      }).catch(() => {});
    }
  }, [pathname]);

  const isAgregacoes = pathname === '/agregacoes';

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
              <div key={item.href}>
                <Link
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

                {/* Ciclos submenu — só em /agregacoes */}
                {item.href === '/agregacoes' && isAgregacoes && ciclos.length > 0 && (
                  <div className="mb-[3px]">
                    <button
                      onClick={() => setCiclosOpen(v => !v)}
                      className="w-full flex items-center gap-[11px] px-3 py-[7px] rounded-[var(--r-md)] text-[12.5px] font-medium text-[var(--ink-3)] hover:bg-[var(--surface-3)] hover:text-[var(--ink)] border border-transparent transition-colors duration-[120ms]"
                    >
                      <History size={15} className="text-[var(--ink-4)] shrink-0" />
                      <span className="flex-1 text-left">Ciclos guardados</span>
                      <ChevronDown
                        size={13}
                        className={`text-[var(--ink-4)] transition-transform duration-150 ${ciclosOpen ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {ciclosOpen && (
                      <div className="mt-[2px] ml-[14px] border-l border-[var(--border)] pl-[10px] space-y-[2px]">
                        {ciclos.map(c => {
                          const cicloActive = pathname === '/agregacoes' &&
                            typeof window !== 'undefined' &&
                            new URLSearchParams(window.location.search).get('ciclo') === c.id;
                          return (
                            <Link
                              key={c.id}
                              href={`/agregacoes?ciclo=${c.id}`}
                              onClick={() => setOpen(false)}
                              className={`
                                flex items-center gap-2 px-2.5 py-[6px] rounded-[var(--r-sm)]
                                text-[12.5px] font-medium border transition-colors duration-[120ms]
                                ${cicloActive
                                  ? 'bg-[var(--accent-soft-bg)] text-[var(--accent-text)] border-[var(--accent-soft-bd)]'
                                  : 'text-[var(--ink-3)] border-transparent hover:bg-[var(--surface-3)] hover:text-[var(--ink)]'
                                }
                              `}
                            >
                              <span className="font-mono text-[11px]">{c.id}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
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
