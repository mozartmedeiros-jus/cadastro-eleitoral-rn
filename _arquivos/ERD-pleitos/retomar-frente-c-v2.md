# Prompt de retomada (v2) — Frente C: Gestão SPLE

> **v2 substitui o `retomar-frente-c.md`.** Corrige o que a inspeção dos dados reais do `.xlsx`
> invalidou na v1: o doc ID colidia em ~25% das linhas, a regra de escrita estava defasada, e o
> layout/contagem das abas estavam imprecisos. Cole o bloco abaixo como **primeira mensagem de uma
> nova sessão** do Claude Code no projeto `cadastro-eleitoral-rn`. Tudo o que é preciso saber está no
> prompt — não é necessário explorar antes.

```
## Objective
Implementar a Frente C (Gestão SPLE) no app `cadastro-eleitoral-rn`: ingestão xlsx → Firestore
(coleção `opl_itens`) + página `/sple` de acompanhamento da execução orçamentária 2026. Completa o
módulo de orçamento ao lado da Frente B (`opl_empenhos`), já em produção. Replicar o padrão exato da
Frente B.

## Context (carry forward — decisões e achados já fechados, não reabrir)

**App:** Next.js 16.2.6 (Turbopack), React 19, Tailwind v4 (@theme inline), Firebase ^12,
firebase-admin ^14. Deps `xlsx`, `firebase-admin`, `lucide-react` já instaladas — NÃO adicionar deps.
Rota nova em `src/app/(orcamento)/sple/` (mesmo route group da Frente B; o grupo não entra na URL).

**Sistema de design (obrigatório ler ANTES de criar UI):** `DESIGN.md` e `PRODUCT.md` na raiz.
Usar só tokens/classes (`.ds-card`, `.ds-input`, `.ds-select`, `.num`, `.row-hover`, `bg-surface`,
`text-ink-2`, `border-border`, `accent-*`). NUNCA hex no JSX. Verde eleitoral `accent` em ≤10% da tela.

**Auth:** `const { user, authReady, canEdit } = useAuth()` de `src/lib/AuthContext.tsx`. Página é
admin-only (`canEdit` = um dos 3 admins @tre-rn.jus.br). Padrão de gate: `!authReady`→spinner;
`!user`→"Acesso Restrito"; `!canEdit`→"Acesso Negado".

**Referência exata da Frente B (ler e espelhar):**
- `src/app/(orcamento)/orcamento/OrcamentoClient.tsx` (~822 linhas) — auth gate, `onSnapshot`,
  filtros/busca, tabela `.row-hover`/`.num`, KPIs `.ds-card`, e o FLUXO DE IMPORT NO NAVEGADOR
  (botão "Atualizar dados" → file input → modal de confirmação → `import('xlsx')` dinâmico →
  parser compartilhado → `commitInBatches` que grava todos + apaga os ausentes). Replicar SEM gráficos.
- `scripts/orcamento/upload.mjs` e `scripts/orcamento/validar.mjs` — padrão de script Node ESM.
- `src/lib/orcamento-xlsx.ts` — padrão do parser compartilhado (interface + função `parse*`).

**Fonte de dados:** `_arquivos/ERD-pleitos/Orçamento Pleitos 2026 - Versão atual (Execução).xlsx`.
- 22 abas de setor a processar (índices 5–26): ASCOM, CGI, COELE, NBE, NFA, NSI, SAMS, SDP, SECOP,
  SEGEAT, SENGE, SEMAN, SEMAT, SEPAT, SETRAN, SGAE, SMI, SNT, SPLE, SSI, SRI, SUE. IGNORAR as demais
  abas (Por setor, PI, Compilação, *(mozart)*, Eventos, Ajustes…). Definir como const `SETOR_SHEETS`.
- Layout (validado): header na LINHA 0; dados da LINHA 1 em diante; 17 colunas POSICIONAIS; TODAS as
  22 abas têm as colunas de execução no header. As linhas são "ragged" (10/15/17 colunas) quando a
  execução está vazia — acesso fora do range vira ''/0. PULAR linha com PI (col 1) vazio.

Mapa de colunas (índice → campo):
  0 UA · 1 PI · 2 Despesa Agregada · 3 Item da Despesa ·
  4 PROPOSTA… (o header varia: "PROPOSTA TSE 2026 (20,67%)" OU "PROPOSTA ORÇAMENTÁRIA 2026\nParâmetro
    Eleições 2022" → casar por PREFIXO "PROPOSTA") ·
  5 LANÇAMENTO DAS UNIDADES · 6 Memória de [Cc]álculo (PRIMEIRA ocorrência) · 7 Ajustes STIE ·
  8 Aprovação COGEL/Lançamento SIGEPRO · 9 Aprovação do Orçamento · 10 SEI Execução e NE ·
  11 Valor estimado · 12 Valor empenhado · 13 Valor pago ·
  14 Resumo despesa/ajuste → IGNORAR (calculado) · 15 Memória de cálculo (2ª) → IGNORAR ·
  16 Justificativa.
  Implementar o parser montando um mapa header→índice POR ABA (robusto a coluna faltante/reordenada),
  com os matches acima; cair para a posição quando o header bater.

**Service account:** já existe em `scripts/orcamento/serviceAccountKey.json` (gitignored). O novo
script deve usá-la via `GOOGLE_APPLICATION_CREDENTIALS` ou esse caminho. NÃO criar nova chave.

**ACHADO QUE DEFINE O MODELO (decisão fechada):** o doc ID da v1
(`2026__ua__pi__naturezaDespesa`) COLIDE: 130 linhas reais → só 98 IDs distintos (32 linhas perdidas).
Mesmo usando o Item da Despesa completo restam 30 colisões. Causa: a planilha tem MÚLTIPLAS LINHAS
LEGÍTIMAS por (UA, PI, item) — cada uma um lançamento distinto com memória/valores próprios (ex.:
NFA/TRE TREINA/INSTRUTORES INTERNOS = 11 lançamentos diferentes). Documentado em
`_arquivos/ERD-pleitos/estudo_modelagem.md` §6. → A ingestão grava **1 documento por linha** (130
docs), com sufixo de sequência no ID para desambiguar repetições.

**Decisões fechadas:** coleção `opl_itens` (prefixo `opl_`); embedding total (3 fases no mesmo doc);
rota `/sple` dentro de `(orcamento)`; SEM gráficos na v1; ingestão por script Node + import via UI.

## Starting State
Frente B em produção e intocada. Coleção `opl_itens` ainda não existe. `firestore.rules` tem o bloco
`opl_empenhos` (com `allow write: if isAuthorizedAdmin()` — a Frente B grava pela UI) antes do
catch-all `match /{document=**} { allow read, write: if false; }`.

## Target State (arquivos existem e funcionam)
Criados:
- `src/lib/sple-xlsx.ts` — parser lib-agnóstico. Exporta `interface ItemOplData`, `interface
  ParsedItem { docId: string; data: ItemOplData }`, `const SETOR_SHEETS: string[]`, e
  `parseItens(sheets: { setor: string; rows: unknown[][] }[]): ParsedItem[]`.
- `scripts/sple/upload.mjs` — lê o xlsx (readFile), monta as abas de `SETOR_SHEETS`, parseia com a
  MESMA lógica do `sple-xlsx.ts`, grava em `opl_itens` com `writeBatch` (lotes ≤500), `set` merge.
  Flag `--csv` opcional p/ conferência.
- `scripts/sple/validar.mjs` — conta linhas da planilha (PI não-vazio nas 22 abas) vs docs em
  `opl_itens`; reporta por setor e divergências.
- `src/app/(orcamento)/sple/page.tsx` — server wrapper com `metadata`.
- `src/app/(orcamento)/sple/SpleClient.tsx` — componente cliente principal.
Modificados:
- `firestore.rules` — regra `opl_itens` (read+write só admin), inserida ANTES do catch-all.
- `package.json` — scripts `upload:sple` e `validar:sple` (mesmo formato dos `*:orcamento`).
- `src/components/Sidebar.tsx` — item `Gestão SPLE` → `/sple`, grupo `sple`, `authRequired: true`
  (sem ele a rota fica órfã; espelhar o item da Frente B).
- `_arquivos/ERD-pleitos/estudo_modelagem.md` — JÁ atualizado com o achado (§6); não mexer.

## Scope
Trabalhar SOMENTE em: `scripts/sple/`, `src/app/(orcamento)/sple/`, `src/lib/sple-xlsx.ts`,
`firestore.rules` (só o bloco `opl_itens`), `package.json` (só os 2 scripts), `src/components/Sidebar.tsx`
(só o novo item).
NÃO TOCAR: `scripts/orcamento/`, `src/app/(orcamento)/orcamento/`, `src/lib/orcamento-xlsx.ts`,
`.env.local`, `next.config.ts`, `src/lib/firebase.ts`, `src/lib/AuthContext.tsx`, `estudo_modelagem.md`.

## Schema Firestore — `opl_itens` (embedding total)
Doc ID: `2026__{UA}__{PI}__{naturezaDespesa}__{NN}` — sanitizar (maiúsculo, espaços→_, remover / e .,
truncar ~150 chars). `NN` = sequência de 2 dígitos por ordem de aparição DENTRO do grupo de mesmo
prefixo (garante unicidade quando a chave natural repete). 1 doc por linha = 130 docs.
naturezaDespesa: regex /\d{2}\.\d{2}\.\d{2}\.\d{2}\.\d{4}/ extraída de itemDespesa, ou "OUTROS".

interface ItemOplData {
  setor: string;            // nome da aba
  ua: string;               // col 0 || nome da aba
  pi: string;
  despesaAgregada: string;
  itemDespesa: string;      // string completa
  naturezaDespesa: string;  // código extraído
  vlrPropostaRef: number;   // col 4 (match prefixo PROPOSTA)
  vlrUnidade: number;       // LANÇAMENTO DAS UNIDADES
  memoriaCalculo: string;   // 1ª "Memória de cálculo"
  vlrAjusteStie: number;
  vlrAprovacaoCogel: number;
  vlrAprovado: number;
  seiNe: string;            // '' se ausente
  vlrEstimado: number;
  vlrEmpenhado: number;
  vlrPago: number;
  justificativa: string;
  status: 'lancamento' | 'aprovacao' | 'execucao';
  // 'execucao' se seiNe !== ''; senão 'aprovacao' se vlrAprovado > 0; senão 'lancamento'
  ano: number;              // 2026
  updatedAt;                // serverTimestamp()
}

## Constraints
- ESM (.mjs) nos scripts — mesmo padrão de `scripts/orcamento/upload.mjs`.
- toNum robusto: `const toNum = v => typeof v === 'number' ? v : parseFloat(String(v ?? '0').replace(/\./g,'').replace(',','.')) || 0`
- `set()` com merge para upsert seguro em re-ingestões.
- Import via UI = substituição completa (grava todos + apaga os ausentes), idêntico à Frente B.
- NUNCA hex no JSX — só tokens. Ler DESIGN.md e PRODUCT.md antes de criar qualquer componente.
- Apenas o que foi pedido. NÃO adicionar features, abstrações, arquivos ou refactors além do escopo.

## UI — SpleClient.tsx (foco: execução em andamento; SEM gráficos)
1. Header: "Gestão SPLE · Exercício 2026" + botão "Atualizar dados" (abre o import xlsx).
2. KPI cards (.ds-card, sem hero gigante): Total de itens | Com NE emitida (seiNe !== '') |
   Valor aprovado total | % empenhado (= Σ vlrEmpenhado / Σ vlrAprovado).
3. Filtros: UA (.ds-select), PI (.ds-select), Status (Todos / Com NE / Sem NE), busca livre
   (UA, PI, itemDespesa, seiNe).
4. Tabela (.ds-card + .row-hover + .num nos monetários): UA · PI · Item da Despesa · Aprovado ·
   Estimado · Empenhado · Pago · SEI (✓ verde se tem / — cinza se pendente, tooltip com texto
   completo). Ordenação padrão UA → PI.
Import flow idêntico Frente B: botão → file input (.xlsx) → modal de confirmação → parseItens →
gravação em lote + remoção de stale, com progresso.

## Acceptance Criteria
- [ ] `npm run upload:sple` roda sem erro e cria ~130 docs em `opl_itens` (conferir com --csv).
- [ ] `npm run validar:sple` → contagem planilha (130) == docs (130), sem divergência (prova de que
      não há colisão de ID).
- [ ] `npm run build` sem erro de TS; rota `/sple` aparece no output.
- [ ] `firestore.rules`: `opl_itens` leitura+escrita só admin; catch-all preservado.
- [ ] `/sple` acessível logado como admin; bloqueada p/ não-admin/deslogado.
- [ ] Filtros UA/PI/Status funcionam; coluna SEI mostra ✓/— corretamente; busca funciona.
- [ ] KPI "Com NE" bate com contagem manual da planilha.
- [ ] Item "Gestão SPLE" aparece no Sidebar (grupo sple, só logado).

## Stop Conditions — PARAR e perguntar antes de:
- Adicionar qualquer dependência npm.
- Modificar `firestore.rules` além do bloco `opl_itens`.
- Tocar qualquer arquivo fora do Scope.
- Rodar QUALQUER comando de deploy (`firebase deploy`) — o deploy fica para o usuário autorizar.

## Progress
Após cada passo concluído, emitir: ✅ [o que foi feito] — [arquivo(s) afetado(s)].

## Session Strategy
Sessão nova, sem contexto anterior. Não fixar effort/thinking budget (o harness do Claude Code
gerencia). Ordem sugerida: (1) src/lib/sple-xlsx.ts → (2) scripts/sple/upload.mjs →
(3) scripts/sple/validar.mjs → (4) firestore.rules + package.json →
(5) src/app/(orcamento)/sple/page.tsx + SpleClient.tsx + item no Sidebar.tsx.
Rodar upload:sple e validar:sple para validar a ingestão antes de finalizar. NÃO deployar.
```

---

> ⚠️ Este prompt é para um agente com acesso real ao sistema (Claude Code). Revise os scope locks, as
> ações proibidas e as stop conditions antes de colar. Confirme que os paths,
> `scripts/orcamento/serviceAccountKey.json` e `.env.local` estão corretos antes de rodar o upload.
