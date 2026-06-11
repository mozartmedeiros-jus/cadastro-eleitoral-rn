# Serviços do Projeto — cadastro-eleitoral-rn

Projeto **institucional** TRE-RN (Pleitos Eleitorais 2026). As contas corretas são as
**institucionais** (ver `/iniciar` para o protocolo de verificação de início de sessão).

## Firebase / Firestore
- Projeto: `eleicoes2026-dadoszonas` (`.firebaserc`)
- Console: https://console.firebase.google.com/project/eleicoes2026-dadoszonas
- Firestore: https://console.firebase.google.com/project/eleicoes2026-dadoszonas/firestore
- **Conta de deploy (ativa correta):** `mozart.medeiros@tre-rn.jus.br`
- Regras: **restritas** — `firestore.rules` (`isAuthorizedAdmin()`); leitura do orçamento só para os
  3 admins `@tre-rn.jus.br` (karina.pedrosa, monica.paim, mozart.medeiros).
- Hosting: export estático Next.js (`next.config.ts` → `output: "export"`; `firebase.json` →
  `public: "out"`, `cleanUrls`, `trailingSlash:false`).
- Produção: https://eleicoes2026-dadoszonas.web.app
- Deploy: `firebase deploy --only firestore:rules` e `firebase deploy --only hosting`.

### Coleções (convenção `<domínio>_<entidade>`)
- `opl_empenhos` — Orçamento de **Pleitos** (foco atual). Doc ID `${mesCode}__${notaEmpenho}`.
- `mrj`, `agregacoes`, `ciclos` — Cadastro Eleitoral (migração futura para prefixo `cad_`).
- Prefixos: `cad_` (Cadastro), `opl_` (Orçamento Pleitos), `oor_` (Orçamento Ordinário, futuro).

## GitHub
- Repositório: `mozartmedeiros-jus/cadastro-eleitoral-rn`
- URL: https://github.com/mozartmedeiros-jus/cadastro-eleitoral-rn
- **Conta ativa correta:** `mozartmedeiros-jus` (push/PR).

## Next.js
- Versão: 16.2.6 (Turbopack) · React 19
- Dev server: http://localhost:3000
- Rotas organizadas em route groups: `src/app/(cadastro)/` (→ `/`, `/agregacoes/*`) e
  `src/app/(orcamento)/orcamento/` (→ `/orcamento`). Os route groups não entram na URL.

## Pacotes principais
- `firebase` (^12) — SDK Web (Auth + Firestore); `firebase-admin` para ingestão via script.
- `chart.js` / `react-chartjs-2` — gráficos do painel de orçamento.
- `lucide-react` — ícones · `next-themes` — tema claro/escuro/sistema.
- `tailwindcss` v4 (`@theme inline`, design tokens em `globals.css`).
- `xlsx` — ingestão da planilha de execução orçamentária (`scripts/orcamento/upload.mjs`).

---

> Última verificação de conexões: 11/06/2026 — Firebase (`eleicoes2026-dadoszonas`) e GitHub
> (`mozartmedeiros-jus`) OK; hosting publicado e verificado em produção.
