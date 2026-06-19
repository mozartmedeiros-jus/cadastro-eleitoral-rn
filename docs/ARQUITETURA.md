# Arquitetura — cadastro-eleitoral-rn

> Visão em camadas da stack e dos métodos de modelagem de dados. Referência rápida;
> o documento de acompanhamento canônico continua sendo `docs/ROADMAP.md`.

## Camada 1 — Apresentação (UI)
- **Next.js 16.2.6** (App Router) com **Turbopack** — renderização e roteamento
- **React 19.2.4** + **React DOM** — componentes
- **Tailwind CSS v4** (`@tailwindcss/postcss`) — estilo via tokens `@theme inline` (design system DSGov)
- **next-themes** — tema claro/escuro por classe
- **lucide-react** — ícones
- **chart.js** + **react-chartjs-2** — gráficos (Orçamento)
- **Geist Sans / Geist Mono** (`next/font`) — tipografia
- **Boundary de erro** (`src/app/global-error.tsx`) — auto-reload em ChunkLoadError (chunk obsoleto pós-deploy)

## Camada 2 — Aplicação (lógica de cliente)
- **TypeScript ^5** — tipagem
- **Auth** — Firebase Auth (login Google) + allow-list de admins (`isAdmin()` em `src/lib/firebase.ts`)
- **Acesso a dados em tempo real** — Firestore client SDK (`onSnapshot`, `getDocs`, `writeBatch`, `deleteField`…)
- **Export estático** (`output: "export"`) — SPA que conversa com o Firestore direto do browser

## Camada 3 — Dados: modelagem & persistência
Desdobrada em sub-camadas de modelagem, do abstrato ao concreto.

### 3a. Conceitual / análise
- Análise da forma **não normalizada (UNF)**: grupos repetidos, redundância, dimensão × fato
- Análise de **grão (grain)** pós-ingestão (1 linha da planilha = 1 lançamento)

### 3b. Lógico relacional (normalização)
- **1FN** — atomicidade, remover grupos repetidos → `valor_referencia`
- **2FN** — remover dependências parciais → dimensões UA/PI/item
- **3FN** — remover dependências transitivas → FK `item_despesa → despesa_agregada`
- **Modelagem dimensional** — dimensões + fato `item_orcamentario`
- **Relacionamentos** — 1:N e 1:1 (partição vertical das fases)
- **Chaves/integridade** — PK surrogate, naturais `UNIQUE`, FK, `CHECK` (enum de status)

### 3c. Físico relacional (artefatos de projeto — `_arquivos/ERD-pleitos/`)
- **ERD em Mermaid** (notação crow's-foot)
- **DDL SQL** genérico (Postgres/SQLite/MySQL), `NUMERIC(15,2)` / `DATE`

### 3d. Físico NoSQL (implementação real — Firestore)
- **Desnormalização** deliberada (leitura eficiente, dashboard read-only)
- **Embedding** das fases 1:1 (mapas) + **array** para 1:N limitado
- **Desnormalização parcial** das dimensões (nome/código no doc)
- **Convenção de coleções** `<domínio>_<entidade>` (`cad_`, `opl_`, `oor_`)
- **Doc ID = chave natural composta sanitizada + sufixo de sequência** (`2026__{UA}__{PI}__{naturezaDespesa}__{NN}`)
- **Formato long** (`opl_empenhos`: 1 doc por NE × mês) + **snapshot cumulativo com guarda por valor** (campos `prev*`)
- **Firestore Security Rules** (`firestore.rules`) — allow-list de admins

## Camada 4 — Ingestão / pipeline de dados
- **Node.js** (scripts `.mjs` em `scripts/`)
- **firebase-admin** — escrita server-side (ignora as rules), `writeBatch` / `FieldValue`
- **xlsx (SheetJS)** — parse de `.xlsx` (SERPRO, SPLE) e CSV (Pontos de Apoio)
- **JSON estático** (`data/*.json`) via alias `@data/*`

## Camada 5 — Infraestrutura, build & tooling
- **Firebase Hosting** — produção (`https://eleicoes2026-dadoszonas.web.app`)
- **GCP / Firebase** — projeto `eleicoes2026-dadoszonas`
- **Firebase CLI** — deploy (`firestore:rules`, `hosting`)
- **Git / GitHub** + **`gh` CLI** — versionamento e PRs
- **ESLint ^9** + **eslint-config-next** — lint
- **@types/** (node, react, react-dom) — definições de tipo
