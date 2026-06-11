# Roadmap — Dashboard de Execução Orçamentária (Pleitos) no Firebase

> **Documento de acompanhamento canônico (versionado no git).**
> Em uma sessão nova, leia o **Preâmbulo** (todo o ambiente) e a **Tabela de fases** (o que já foi
> feito) antes de continuar. Atualize o status e o **Log de execução** ao concluir cada etapa.
>
> Legenda de status: `[ ]` pendente · `[~]` em andamento · `[x]` concluída · `[!]` bloqueada.

---

## PREÂMBULO — Ambiente (ler primeiro numa sessão nova)

**Objetivo do projeto.** Migrar o acompanhamento de execução orçamentária de "Pleitos Eleitorais 2026"
do antigo pipeline (planilha Google + Apps Script + Looker + CSV publicado) para o **Firebase já
existente** do app de cadastro eleitoral. O projeto antigo está **abandonado**.

**Caminhos no disco**
- App alvo (Next.js + Firebase): `/home/mozdam/Documents/AppsScript_Projeto/Empresa/ELO/cadastro-eleitoral-rn`
- Fonte de dados (planilha exportada): `/home/mozdam/Documents/AppsScript_Projeto/Empresa/Orçamento2026/TRE - RN - EXECUÇÃO (EMP_LIQ_PAGO) - por NE - PLEITOS ELEITORAIS - 2026.xlsx`
- Projeto antigo (abandonado, só referência): `/home/mozdam/Documents/AppsScript_Projeto/Empresa/Orçamento2026/` (Apps Script: `ProcessadorDeDados.js`, `novoDanboard.html`)

**Firebase / GCP**
- Projeto: **`eleicoes2026-dadoszonas`** (`.firebaserc`).
- Config web em `.env.local` (NEXT_PUBLIC_FIREBASE_*); **não** commitado (`.gitignore` cobre `.env*`).
- Hosting: export estático Next.js (`next.config.ts` → `output: "export"`; `firebase.json` → `public: out`).
- Stack: Next.js 16, React 19, Tailwind v4 (`@theme inline`), `firebase ^12`.

**Auth e autorização (reuso)**
- Login Google via `src/lib/AuthContext.tsx` (`useAuth()`), botão `src/components/AuthButton.tsx`.
- Allow-list em `src/lib/firebase.ts` (`ADMIN_EMAILS` / `isAdmin()`) e espelhada em `firestore.rules`
  (`isAuthorizedAdmin()`): **karina.pedrosa, monica.paim, mozart.medeiros @tre-rn.jus.br** (email_verified).
- Leitura do orçamento é **restrita a esses 3 admins**.

**Firestore — convenção de coleções** (`<domínio>_<entidade>`, minúsculo)
- `cad_` → Cadastro Eleitoral (migração **futura**; hoje as coleções são `mrj`, `agregacoes`, `ciclos`).
- `opl_` → Orçamento de **Pleitos** eleitorais (**foco atual**).
- `oor_` → Orçamento **Ordinário** (futuro).

**Coleção atual: `opl_empenhos`** (formato long, 1 doc por NE × mês). Doc ID `${mesCode}__${notaEmpenho}`
(ex.: `2026-01__070008000012026NE000061`). Campos espelham o cabeçalho do CSV publicado, confirmado:
`REFERÊNCIA, PTRES, PLANO ORÇAMENTÁRIO, NOTA DE EMPENHO, PLANO INTEGRADO, DESCRIÇÃO, NATUREZA DESPESA,
PROCESSO SEI, FORNECEDORES, DESPESAS EMPENHADAS, DESPESAS LIQUIDADAS, DESPESAS PAGAS`.
- Campos: `referencia` (Timestamp, 1º dia do mês), `ptres` (number), `planoOrcamentario`, `notaEmpenho`,
  `planoIntegrado`, `descricao`, `naturezaDespesa`, `processoSei`, `fornecedores` (strings),
  `despesasEmpenhadas/Liquidadas/Pagas` (number; vazio → 0).
- Auxiliares (não-CSV): `ano` (number), `mesCode` (`"2026-01"`), `updatedAt`. Multi-ano por campo `ano`.

**Padrão visual obrigatório** — `_arquivos/DESIGN.md` + `_arquivos/PRODUCT.md` (DSGov / "Cartório Digital"):
superfícies planas, bordas 1px, **verde eleitoral `#1a7a48` em ≤10% da tela** (só ação/estado), zero
gradiente/sombra/glow, numerais tabulares (`.num`), contraste AA, tema claro/escuro por **tokens**
(`bg-surface`, `text-ink-2`, `border-border`, `accent-*`) — nunca hex no JSX. Classes prontas no
`globals.css`: `.ds-card`, `.ds-input`, `.ds-select`, `.ds-num`, `.num`, `.row-hover`.
**`novoDanboard.html` é anti-referência visual** (azul, gradientes, pills): reusar só a *lógica*
(filtros, variação mês-a-mês via `prevData`, gráficos).

**Decisões fechadas** (não reabrir sem motivo)
1. Painel vira rota `/orcamento` **dentro** do app existente (não site separado).
2. Ingestão por **script Node** lendo o `.xlsx` (não Apps Script, não manual).
3. Leitura restrita aos **3 admins** atuais.
4. Coleção `opl_empenhos`, campos pelo cabeçalho do CSV, multi-ano por campo `ano`.
5. Projeto Sheets/Apps Script/Looker **abandonado**.

---

## TABELA DE FASES (status)

| Fase | Descrição | Status |
|---|---|---|
| 0 | Pré-requisitos (service account, dependências) | `[x]` |
| 1 | Banco: regras `opl_empenhos` + script de ingestão `.xlsx` → Firestore | `[x]` |
| 2 | Página `/orcamento` (Next.js, padrão DSGov) | `[x]` |
| 3 | Deploy (firestore rules + hosting) | `[x]` |

> **Fase 3 concluída:** `firestore:rules` e **hosting** deployados em produção
> (`https://eleicoes2026-dadoszonas.web.app`).

---

## FASE 0 — Pré-requisitos `[ ]`

1. **Service account** do projeto `eleicoes2026-dadoszonas` (Console GCP/Firebase → IAM → Contas de
   serviço → gerar chave JSON), salva como `scripts/serviceAccountKey.json` (**gitignored**).
2. Confirmar que os e-mails que vão **ver** o painel estão na allow-list (`ADMIN_EMAILS`).
3. Instalar deps: `firebase-admin`, `xlsx` (ingestão) e `chart.js` (página) — `npm install`.

## FASE 1 — Banco de dados `[ ]`

### 1a. Regras — `firestore.rules`
Adicionar antes do catch-all `match /{document=**}`, reusando `isAuthorizedAdmin()`:
```
match /opl_empenhos/{docId} {
  allow read:  if isAuthorizedAdmin();   // só os 3 admins
  allow write: if false;                 // escrita só via Admin SDK (ignora rules)
}
```

### 1b. Script de ingestão — `scripts/upload-orcamento.mjs`
Replica fielmente o pipeline Apps Script de **duas etapas** e envia ao Firestore.

**Etapa 1 — Extração mensal** (= `extrairDadosComMesclados`). Aba 0, dados a partir da **linha 11**
(1-based). Para cada mês `i=0..11`, monta colunas A:L:
- A = referência (`new Date(2026, i, 1)`); B = PTRES = fonte **A(1)** *(mesclada → forward-fill)*;
  C = Plano Orç. = fonte **B(2)** *(mesclada → forward-fill)*.
- D = Nota de Empenho = fonte **E(5)** → **pular linha se vazia**.
- E = PI **F(6)**; F = Descrição **G(7)**; G = Natureza **J(10)**; H = Processo SEI **K(11)**;
  I = Fornecedor **N(14)**.
- J/K/L = Emp/Liq/Pago = colunas `17 + 3*i` / `+1` / `+2`. Já **numéricas** no `.xlsx`; vazio → 0.

**Etapa 2 — Consolidação** (= `=QUERY({...12 abas A2:L}; "SELECT * WHERE Col2 IS NOT NULL ORDER BY Col1 ASC")`):
une os 12 blocos, descarta linhas com **PTRES (Col2) vazio**, ordena por **referência (Col1) ASC**.

**Etapa 3 — Envio** a `opl_empenhos` (mapeamento de campos do Preâmbulo). Doc ID `${mesCode}__${notaEmpenho}`;
gravar com `writeBatch` (lotes ≤500), `set` merge.

**Operação**: credencial via `GOOGLE_APPLICATION_CREDENTIALS` ou `scripts/serviceAccountKey.json`;
caminho do `.xlsx` e `ano` parametrizáveis; flag `--csv` opcional emite o CSV consolidado p/ conferir
contra o publicado. npm script: `"upload:orcamento": "node scripts/upload-orcamento.mjs"`.
Adicionar `scripts/serviceAccountKey.json` ao `.gitignore`.

## FASE 2 — Página `/orcamento` (DSGov) `[ ]`

> Reaproveita só a **lógica** do `novoDanboard.html`; **visual reconstruído** nos tokens de `globals.css`,
> espelhando `/` e `/agregacoes`. Hex no JSX é proibido.

- `src/app/orcamento/page.tsx` — server component mínimo → `<OrcamentoClient />`.
- `src/app/orcamento/OrcamentoClient.tsx` — `'use client'`:
  - **Auth gate**: `useAuth()`; `!user` → CTA login; logado não-admin (`isAdmin`) → "Acesso restrito";
    só consulta Firestore quando admin.
  - **Dados**: `getDocs(collection(db, 'opl_empenhos'))`; filtro/ordenação client-side.
  - **Filtros**: Referência (mês) e "Empenho e Natureza" em `.ds-select`.
  - **Tabela**: `.ds-card` + `<table>` com `.num`/`.row-hover`; variação mês-a-mês (`prevData`) sinalizada
    por **ícone Lucide ↑/↓ + cor** (não só cor): alta em `accent`/`accent-ink`, baixa na família `danger`.
  - **Gráficos**: `chart.js` em `useEffect`; barras **sólidas chapadas** (`--accent` + neutros), sem
    fills `rgba`/gradiente/glow; cores lidas dos tokens via `getComputedStyle` (acompanha tema);
    respeitar `prefers-reduced-motion`. **Sem hero-metric** de KPI gigante — indicadores compactos.
- `src/components/Sidebar.tsx`: item `{ name: 'Execução Orçamentária', href: '/orcamento', icon: <Lucide>, sub: false, authRequired: true }`.

## FASE 3 — Deploy `[ ]`

- `firebase deploy --only firestore:rules` (validar no simulador: read só admin).
- `npm run build` (export estático) → `firebase deploy --only hosting`.

---

## Arquivos a criar/alterar (todos em `cadastro-eleitoral-rn`)

| Ação | Arquivo | Fase |
|---|---|---|
| criar | `docs/orcamento/ROADMAP.md` (este documento) | 0 |
| criar | `scripts/orcamento/upload.mjs` | 1 |
| editar | `firestore.rules` (bloco `opl_empenhos`) | 1 |
| editar | `.gitignore` (`scripts/orcamento/serviceAccountKey.json`) | 1 |
| editar | `package.json` (deps + script `upload:orcamento`) | 0/1 |
| criar | `src/app/(orcamento)/orcamento/page.tsx` | 2 |
| criar | `src/app/(orcamento)/orcamento/OrcamentoClient.tsx` | 2 |
| editar | `src/components/Sidebar.tsx` (item de nav) | 2 |

Reuso sem mudança: `src/lib/firebase.ts`, `src/lib/AuthContext.tsx`, `src/components/AuthButton.tsx`,
`firebase.json`, `globals.css` (tokens/classes).

## Verificação (end-to-end)

1. `npm install` (firebase-admin, xlsx, chart.js).
2. `npm run upload:orcamento` → ~960 docs em `opl_empenhos` no console do Firestore (conferir com `--csv`).
3. `firebase deploy --only firestore:rules` → simulador: leitura só admin.
4. `npm run dev` → logar como admin → `/orcamento`: filtros, tabela com setas, gráficos OK.
5. Não-admin / deslogado → bloqueado (e leitura negada pelas rules).
6. `npm run build` sem erros → `firebase deploy --only hosting`.

---

## LOG DE EXECUÇÃO (anote ao concluir cada etapa)

- **2026-06-10**: Fase 0 e 1 concluídas.
  - Dependências instaladas (`firebase-admin`, `xlsx`, `chart.js`, `react-chartjs-2`).
  - `.gitignore` atualizado para ignorar chaves de serviço.
  - `package.json` atualizado com script `upload:orcamento`.
  - `firestore.rules` configurado para a coleção `opl_empenhos`.
  - Script `scripts/upload-orcamento.mjs` criado e validado estruturalmente.
- **2026-06-10**: Fase 2 concluída.
  - Rota `/orcamento` criada.
  - Componente `OrcamentoClient` implementado com autenticação admin, filtros, tabela de execução e gráficos evolutivos.
  - Sidebar atualizada com o novo link.
  - Estilização seguindo estritamente os tokens DSGov do projeto.
- **2026-06-10**: Fase 3 concluída.
  - Build de produção (`npm run build`) validado com sucesso.
  - Todas as dependências de interface e tipos Next.js 16/React 19 resolvidas.
  - Sistema pronto para deploy via Firebase CLI.
- **2026-06-10 (go-live, execução real)**: dados carregados e parcialmente publicado.
  - Dry-run (`--csv`) conferido: **666 documentos** (não os ~960 teóricos). O número correto reflete
    o modelo de **snapshot cumulativo** da planilha — cada mês carrega o estado acumulado das NEs;
    distribuição: Jan 17, Fev 21, Mar 28, Abr 42, Mai 68, Jun–Dez 70. 5 PTRES, 72 NEs distintas.
  - **Atenção:** meses Jul–Dez/2026 carregam o snapshot de Junho (último mês com dado real em
    10/jun); no filtro de mês esses meses repetem Junho. Fiel ao pipeline antigo; revisar se quiser
    limitar a ingestão ao mês corrente.
  - Correção de spec: `ptres` passou a ser gravado como **number** (`Number()`), e a interface
    `Empenho` em `OrcamentoClient.tsx` atualizada para `ptres: number`.
  - **Upload real executado**: 666 docs em `opl_empenhos` (`npm run upload:orcamento`).
  - **`firebase deploy --only firestore:rules`** executado com sucesso (projeto `eleicoes2026-dadoszonas`).
  - `npm run build` revalidado após as mudanças (rota `/orcamento` presente, TypeScript OK).
  - **Pendente:** `firebase deploy --only hosting` (deploy de produção, a rodar manualmente) e
    verificação no browser logado como admin (local e produção).
- **2026-06-11**: Fase 3 concluída (hosting em produção).
  - `firebase deploy --only hosting` executado com sucesso (89 arquivos em `out`).
  - Produção: **https://eleicoes2026-dadoszonas.web.app**.
  - **Verificação manual OK**: browser logado como admin em produção — filtros funcionando.
  - **Projeto concluído** — todas as 4 fases (`[x]`).
