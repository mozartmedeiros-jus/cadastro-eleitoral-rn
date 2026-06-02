'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Database, LayoutDashboard, Menu, X } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const navigation = [
    {
      name: 'Estatística',
      href: '/',
      icon: BarChart3,
      disabled: false,
    },
    {
      name: 'Agregações',
      href: '/agregacoes',
      icon: Database,
      disabled: false,
    },
  ];

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2 rounded-xl bg-zinc-950/80 backdrop-blur-md border border-white/[0.08] text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-all"
        >
          {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-zinc-950/70 backdrop-blur-xl border-r border-white/[0.06] flex flex-col
          transition-transform duration-300 ease-in-out lg:static lg:translate-x-0
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="h-16 flex items-center px-6 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400/20 to-sky-500/10 border border-sky-400/20 grid place-items-center">
              <LayoutDashboard size={16} className="text-sky-400" />
            </div>
            <span className="font-semibold text-zinc-100 tracking-tight">TRE-RN</span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname === item.href && !item.disabled;
            const Icon = item.icon;

            return item.disabled ? (
              <div
                key={item.name}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.02] border border-transparent opacity-60 cursor-not-allowed group"
              >
                <div className="flex items-center gap-3 text-zinc-500">
                  <Icon size={18} />
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
              </div>
            ) : (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                className={`
                  flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all duration-200 group
                  ${isActive 
                    ? 'bg-sky-400/10 border-sky-400/20 text-sky-300' 
                    : 'bg-transparent border-transparent text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'}
                `}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={isActive ? 'text-sky-400' : 'text-zinc-500 group-hover:text-zinc-300'} />
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/[0.06] shrink-0">
          <div className="px-3 py-2">
            <p className="text-xs text-zinc-500 font-medium">Cadastro Eleitoral</p>
            <p className="text-[10px] text-zinc-600 mt-1">Estatísticas e Locais</p>
          </div>
        </div>
      </aside>
    </>
  );
}
