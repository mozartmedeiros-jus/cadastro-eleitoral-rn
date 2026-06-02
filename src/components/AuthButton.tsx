'use client';

import { LogIn, LogOut, Pencil } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export default function AuthButton() {
  const { user, authReady, canEdit, signIn, signOut } = useAuth();

  if (!authReady) return null;

  if (user) {
    return (
      <button
        onClick={signOut}
        className="inline-flex items-center gap-2 h-[38px] px-3 rounded-[6px] bg-surface border border-border-strong text-ink-2 text-[13px] font-medium hover:bg-surface-3 hover:text-ink transition-colors"
        title={user.email ?? undefined}
      >
        {canEdit && <Pencil size={12} className="text-accent" />}
        <span className="hidden md:inline truncate max-w-[140px]">
          {user.displayName?.split(' ')[0] ?? user.email}
        </span>
        <LogOut size={14} />
      </button>
    );
  }

  return (
    <button
      onClick={signIn}
      className="inline-flex items-center gap-2 h-[38px] px-3 rounded-[6px] bg-surface border border-border-strong text-ink-2 text-[13px] font-medium hover:bg-surface-3 hover:text-ink transition-colors"
    >
      <LogIn size={14} /> <span className="hidden sm:inline">Entrar</span>
    </button>
  );
}
