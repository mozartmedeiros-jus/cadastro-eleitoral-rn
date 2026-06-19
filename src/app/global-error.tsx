'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import './globals.css';

// Chunk JS obsoleto pós-deploy: numa aba com build antigo, navegar para uma rota
// tenta buscar o chunk pelo hash anterior (404 → ChunkLoadError). O reload baixa o
// HTML novo com os hashes atuais. Aqui isso é feito sozinho (auto-cura).
const CHUNK_ERROR_RE = /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported/i;
const RELOAD_KEY = 'chunkReloadAt';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // O boundary raiz substitui o root layout (sem ThemeProvider); honra o tema salvo.
    try {
      const stored = localStorage.getItem('theme');
      const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
      if (stored === 'dark' || ((stored === 'system' || !stored) && prefersDark)) {
        document.documentElement.classList.add('dark');
      }
    } catch {
      /* localStorage indisponível — segue no tema claro padrão */
    }

    // Auto-reload único em erro de chunk, com guarda anti-loop de 10s.
    if (!CHUNK_ERROR_RE.test(`${error?.name} ${error?.message}`)) return;
    try {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
      if (Date.now() - last > 10_000) {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="bg-bg text-ink antialiased">
        <main className="min-h-screen grid place-items-center p-6">
          <div className="ds-card w-full max-w-md p-8 text-center">
            <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-[8px] border border-warn-border bg-warn-soft">
              <AlertTriangle size={22} className="text-warn" aria-hidden />
            </div>
            <h1 className="text-[18px] font-bold tracking-[-0.01em] text-ink">
              Não foi possível carregar a página
            </h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">
              Isso costuma acontecer logo após uma atualização do sistema.
              Recarregue a página para continuar.
            </p>
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => {
                  reset();
                  window.location.reload();
                }}
                className="h-10 rounded-[6px] border border-accent bg-accent px-5 text-[13px] font-semibold text-accent-on transition-colors hover:bg-accent-strong active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                Recarregar
              </button>
              <button
                onClick={() => {
                  if (window.history.length > 1) window.history.back();
                  else window.location.href = '/';
                }}
                className="h-[38px] rounded-[6px] border border-border-strong bg-surface px-3 text-[13px] font-semibold text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink motion-reduce:transition-none"
              >
                Voltar
              </button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
