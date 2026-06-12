# Roadmap — cadastro-eleitoral-rn

> **Documento de acompanhamento canônico (versionado no git).**
> Em uma sessão nova, leia o **Preâmbulo Compartilhado** (infra comum) e depois a seção da frente
> em que vai trabalhar. Atualize o **Log de execução** da frente correspondente ao concluir.
>
> Legenda de status: `[ ]` pendente · `[~]` em andamento · `[x]` concluída · `[!]` bloqueada.

---

## PREÂMBULO COMPARTILHADO — Ambiente (ler primeiro numa sessão nova)

**Caminhos no disco**
- App (Next.js + Firebase): `/home/mozdam/Documents/AppsScript_Projeto/Empresa/ELO/cadastro-eleitoral-rn`
- Este roadmap: `docs/ROADMAP.md`

**Firebase / GCP**
- Projeto: **`eleicoes2026-dadoszonas`** (`.firebaserc`).
- Config web em `.env.local` (NEXT_PUBLIC_FIREBASE_*); **não** commitado (`.gitignore` cobre `.env*`).
- Hosting: export estático Next.js (`next.config.ts` → `output: "export"`; `firebase.json` → `public: out`).
- Produção: **https://eleicoes2026-dadoszonas.web.app**
- Stack: Next.js 16, React 19, Tailwind v4 (`@theme inline`), `firebase ^12`.

**Auth e autorização**
- Login Google via `src/lib/AuthContext.tsx` (`useAuth()`), botão `src/components/AuthButton.tsx`.
- Allow-list em `src/lib/firebase.ts` (`ADMIN_EMAILS` / `isAdmin()`) e espelhada em `firestore.rules`
  (`isAuthorizedAdmin()`): **karina.pedrosa, monica.paim, mozart.medeiros @tre-rn.jus.br** (email_verified).

**Firestore — convenção de coleções** (`<domínio>_<entidade>`, minúsculo)
- `cad_` → Cadastro Eleitoral (prefixo **futuro**; hoje as coleções são `mrj`, `agregacoes`, `ciclos`).
- `opl_` → Orçamento de **Pleitos** eleitorais.
- `oor_` → Orçamento **Ordinário** (futuro).

**Estrutura de rotas**
- Route groups `src/app/(cadastro)/` (→ `/`, `/agregacoes/*`) e `src/app/(orcamento)/orcamento/`
  (→ `/orcamento`). Os grupos não entram na URL.
- Núcleo compartilhado: `src/lib/`, `src/components/`, `src/app/layout.tsx`, `src/app/globals.css`.

**Padrão visual obrigatório** — `_arquivos/DESIGN.md` + `_arquivos/PRODUCT.md` (DSGov / "Cartório Digital"):
superfícies planas, bordas 1px, **verde eleitoral `#1a7a48` em ≤10% da tela** (só ação/estado), zero
gradiente/sombra/glow, numerais tabulares (`.num`), contraste AA, tema claro/escuro por **tokens**
(`bg-surface`, `text-ink-2`, `border-border`, `accent-*`) — nunca hex no JSX. Classes prontas no
`globals.css`: `.ds-card`, `.ds-input`, `.ds-select`, `.ds-num`, `.num`, `.row-hover`.

---

## FRENTE A — Cadastro Eleitoral

> Esta frente não teve roadmap formal. O estado abaixo é documentado a partir do código atual.

### Estado atual

| Rota | Componente principal | Acesso |
|---|---|---|
| `/` | `(cadastro)/page.tsx` → `CadastroClient.tsx` | público |
| `/agregacoes` | `AgregacoesOverview.tsx` / `AgregacoesClient.tsx` | público (eleitores por seção); SPLE (agregações) |
| `/agregacoes/ciclos` | `CiclosClient.tsx` | SPLE |
| `/agregacoes/analise` | `analise/page.tsx` | SPLE |

**Dados**
- Firestore: coleções `mrj`, `agregacoes`, `ciclos` (prefixo `cad_` planejado para migração futura).
- JSON estático: `data/cadastro_eleitoral.json`, `data/meta.json` — importados via alias `@data/*`
  (`tsconfig.json`).

**Pendências conhecidas**
- `[ ]` Migração das coleções para prefixo `cad_` (futura, sem prazo).
- `[x]` Critique de UI em `src/app/(cadastro)/agregacoes/analise/page.tsx` (`/impeccable critique` — resolvido).

### Log de execução (Cadastro)

- **2026-06-12 (KPI extras + ajuste de cor da calculadora)**: dois fixes nas telas de agregação.
  - KPI "Seções agregadas" ganhou contagem de **extras** = nº de linhas com `agregar===true &&
    total===0` (mesma condição da linha vermelha). Com extras > 0 o card vira
    `SEÇÕES AGREGADAS/EXTRAS` e o valor `285 / 3` com o extra em `text-danger`; sem extras, fica
    como antes. Aplicado nos dois componentes: `AgregacoesOverview.tsx` (Eleitores por seção,
    `kpis`) e `AgregacoesClient.tsx` (Análise, `summary`). Linha vermelha da Análise fora do escopo.
  - Calculadora de seções (`AgregacoesClient.tsx`): cor do chip **selecionado** trocada de accent
    sólido (`bg-accent`/`text-accent-on`) para amarelo claro `warn` (`bg-warn-soft`/
    `border-warn-border`/`text-warn`), casando com a tarja de ciclo ativo.
  - Build OK; deploy `firebase deploy --only hosting` em produção.
- **2026-06-12**: Calculadora efêmera de seções na tela de Análise (`/agregacoes/analise`).
  - `AgregacoesClient.tsx` (importado só por `analise/page.tsx`): chips da coluna SEÇÕES viraram
    `<button>` clicáveis (`aria-pressed`, `motion-reduce`); clicar inclui/exclui a seção de uma
    soma. Estado "selecionado" usa accent sólido (`bg-accent`/`text-accent-on`) para distinguir do
    verde-soft "dentro do limite" (DESIGN.md §5 aponta o conflito de cor).
  - Visor abaixo da célula TOTAL (aparece só com ≥1 seção selecionada na linha): soma do eleitorado
    em PT-BR (`.num`) + contagem + botão × para limpar. Visível também para não-editores.
  - Seleção é **efêmera** (`useState` por linha, `secoesSelecionadas`) — não grava no Firestore;
    o campo TOTAL continua 100% manual e intocado (sem relação com o visor).
  - Build OK; deploy `firebase deploy --only hosting` (95 arquivos) em produção
    (`https://eleicoes2026-dadoszonas.web.app`).
- **2026-06-11**: Expand por local com estatísticas por seção — Frente A.
  - Fonte de dados enriquecida: `data/cadastro_eleitoral.json` recebeu 6 novos campos em cada
    item de `secoes_detalhes`: `qde_idosos`, `perc_idosos`, `qde_eleit_c_defic`,
    `perc_eleit_c_defic`, `qde_analfabetos`, `perc_analfabetos` (8.337 seções, 0 perdas).
    Script de enriquecimento: `scripts/cadastro/enriquecer-secoes.mjs` (npm run enriquecer:secoes);
    fonte: `_arquivos/ESTATISTICA_SECAO_ELEITORAL_08-06-2026.xlsx`.
  - `CiclosClient.tsx` (`/agregacoes/ciclos`): novo expand por local dentro do ciclo expandido —
    ChevronDown por linha abre mini-tabela com Seção · Aptos · Idosos · C/ Defic. · Analfabetos
    (quantidade e %). Lookup por `zona__municipio__local` contra os dados estáticos do JSON.
  - `AgregacoesOverview.tsx` (`/agregacoes`): mesma dinâmica de expand aplicada à tabela principal —
    ChevronDown em todas as linhas, disponível com ou sem ciclo selecionado.
  - Build e deploy em produção validados (`https://eleicoes2026-dadoszonas.web.app`).
- **2026-06-11 (refinamentos visuais — tabela de estatísticas)**: ajustes pós-critique e iterações
  de layout na linha expandida de `AgregacoesOverview.tsx`.
  - Tabela alinhada à coluna SEÇÕES: estrutura `<td colSpan={4} p-0>` + `<td>` conteúdo +
    `<td colSpan={2} p-0>` (sem ciclo: omite trailing), width=`w-full`.
  - Formatação PT-BR: `toLocaleString('pt-BR')` nos percentuais (vírgula decimal).
  - `aria-expanded`, `motion-reduce:transition-none` adicionados aos botões de expand.
  - Separador da linha restaurado (`border-b border-border-faint` na `<tr>` expandida).
  - Fundo da área ao redor da tabela: branco (removido `bg-surface-2` do `<td>` externo);
    linhas internas da tabela: `bg-surface-2`; cabeçalho interno: `bg-surface-3` (mantido).
  - Mesmos ajustes (PT-BR, aria, motion-reduce, w-fit) replicados em `CiclosClient.tsx`.
- **2026-06-11 (correções de interação e alerta visual)**: dois fixes na `/agregacoes`.
  - `AgregacoesOverview`: linha fica `bg-danger-soft` (vermelho) quando ciclo marca
    `agregar=true` e `total=0`; linha expandida de estatísticas mantém fundo branco.
  - `Sidebar`: item "Agregações" (grupo SPLE) convertido de `<Link>` para `<button>` de
    toggle — impedia abrir o submenu ao clicar estando já em `/agregacoes` (navegação
    para mesma URL resetava o estado React do accordion).
- **2026-06-11 (validação de gravação de ciclo)**: fixes em `AgregacoesClient.tsx`.
  - Campo Total vazio agora apaga o valor no Firestore (`deleteField()`) em vez de gravar 0.
  - Modal de alerta ao salvar ciclo quando Agregar está desmarcado mas Total tem valor:
    lista Zona · Local de cada linha afetada, com opção de corrigir ou gravar mesmo assim.
  - Linhas sem `agregar=true` excluídas do ciclo salvo (condição de inclusão endurecida).

---

## FRENTE B — Orçamento Pleitos - Dados SERPRO

### Objetivo

Migrar o acompanhamento de execução orçamentária de "Pleitos Eleitorais 2026" do antigo pipeline
(planilha Google + Apps Script + Looker + CSV publicado) para o **Firebase já existente** do app de
cadastro eleitoral. O projeto antigo está **abandonado**.

**Caminhos específicos desta frente**
- Fonte de dados: `/home/mozdam/Documents/AppsScript_Projeto/Empresa/Orçamento2026/TRE - RN - EXECUÇÃO (EMP_LIQ_PAGO) - por NE - PLEITOS ELEITORAIS - 2026.xlsx`
- Projeto antigo (só referência): `/home/mozdam/Documents/AppsScript_Projeto/Empresa/Orçamento2026/`
  (Apps Script: `ProcessadorDeDados.js`, `novoDanboard.html`)

**Coleção `opl_empenhos`** (formato long, 1 doc por NE × mês). Doc ID `${mesCode}__${notaEmpenho}`
(ex.: `2026-01__070008000012026NE000061`). Campos espelham o cabeçalho do CSV publicado:
`REFERÊNCIA, PTRES, PLANO ORÇAMENTÁRIO, NOTA DE EMPENHO, PLANO INTEGRADO, DESCRIÇÃO, NATUREZA DESPESA,
PROCESSO SEI, FORNECEDORES, DESPESAS EMPENHADAS, DESPESAS LIQUIDADAS, DESPESAS PAGAS`.
- Campos: `referencia` (Timestamp, 1º dia do mês), `ptres` (number), `planoOrcamentario`, `notaEmpenho`,
  `planoIntegrado`, `descricao`, `naturezaDespesa`, `processoSei`, `fornecedores` (strings),
  `despesasEmpenhadas/Liquidadas/Pagas` (number; vazio → 0).
- Auxiliares (não-CSV): `ano` (number), `mesCode` (`"2026-01"`), `updatedAt`. Multi-ano por campo `ano`.

**`novoDanboard.html` é anti-referência visual** (azul, gradientes, pills): reusar só a *lógica*
(filtros, variação mês-a-mês via `prevData`, gráficos).

**Decisões fechadas** (não reabrir sem motivo)
1. Painel vira rota `/orcamento` **dentro** do app existente (não site separado).
2. Ingestão por **script Node** lendo o `.xlsx` (não Apps Script, não manual).
3. Leitura restrita aos **3 admins** atuais.
4. Coleção `opl_empenhos`, campos pelo cabeçalho do CSV, multi-ano por campo `ano`.
5. Projeto Sheets/Apps Script/Looker **abandonado**.

### Tabela de fases

| Fase | Descrição | Status |
|---|---|---|
| 0 | Pré-requisitos (service account, dependências) | `[x]` |
| 1 | Banco: regras `opl_empenhos` + script de ingestão `.xlsx` → Firestore | `[x]` |
| 2 | Página `/orcamento` (Next.js, padrão DSGov) | `[x]` |
| 3 | Deploy (firestore rules + hosting) | `[x]` |

> **Fase 3 concluída:** `firestore:rules` e **hosting** deployados em produção
> (`https://eleicoes2026-dadoszonas.web.app`).

### Fase 0 — Pré-requisitos `[x]`

1. **Service account** do projeto `eleicoes2026-dadoszonas` (Console GCP/Firebase → IAM → Contas de
   serviço → gerar chave JSON), salva como `scripts/orcamento/serviceAccountKey.json` (**gitignored**).
2. Confirmar que os e-mails que vão **ver** o painel estão na allow-list (`ADMIN_EMAILS`).
3. Instalar deps: `firebase-admin`, `xlsx` (ingestão) e `chart.js` (página) — `npm install`.

### Fase 1 — Banco de dados `[x]`

#### 1a. Regras — `firestore.rules`
Adicionado antes do catch-all `match /{document=**}`, reusando `isAuthorizedAdmin()`:
```
match /opl_empenhos/{docId} {
  allow read:  if isAuthorizedAdmin();   // só os 3 admins
  allow write: if false;                 // escrita só via Admin SDK (ignora rules)
}
```

#### 1b. Script de ingestão — `scripts/orcamento/upload.mjs`
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

**Etapa 3 — Envio** a `opl_empenhos` (mapeamento de campos acima). Doc ID `${mesCode}__${notaEmpenho}`;
gravar com `writeBatch` (lotes ≤500), `set` merge.

**Operação**: credencial via `GOOGLE_APPLICATION_CREDENTIALS` ou `scripts/orcamento/serviceAccountKey.json`;
caminho do `.xlsx` e `ano` parametrizáveis; flag `--csv` opcional emite o CSV consolidado p/ conferir
contra o publicado. npm scripts: `upload:orcamento` e `validar:orcamento`.

### Fase 2 — Página `/orcamento` (DSGov) `[x]`

- `src/app/(orcamento)/orcamento/page.tsx` — server component mínimo → `<OrcamentoClient />`.
- `src/app/(orcamento)/orcamento/OrcamentoClient.tsx` — `'use client'`:
  - **Auth gate**: `useAuth()`; `!user` → CTA login; logado não-admin (`isAdmin`) → "Acesso restrito";
    só consulta Firestore quando admin.
  - **Dados**: `getDocs(collection(db, 'opl_empenhos'))`; filtro/ordenação client-side.
  - **Filtros**: Referência (mês) e "Empenho e Natureza" em `.ds-select`.
  - **Tabela**: `.ds-card` + `<table>` com `.num`/`.row-hover`; variação mês-a-mês (`prevData`) sinalizada
    por **ícone Lucide ↑/↓ + cor** (não só cor): alta em `accent`/`accent-ink`, baixa na família `danger`.
  - **Gráficos**: `chart.js` em `useEffect`; barras **sólidas chapadas** (`--accent` + neutros), sem
    fills `rgba`/gradiente/glow; cores lidas dos tokens via `getComputedStyle` (acompanha tema);
    respeitar `prefers-reduced-motion`. **Sem hero-metric** de KPI gigante — indicadores compactos.
- `src/components/Sidebar.tsx`: item `Execução Orçamentária` → `/orcamento`, grupo `sple`, `authRequired: true`.

### Fase 3 — Deploy `[x]`

- `firebase deploy --only firestore:rules` (validado no simulador: read só admin).
- `npm run build` (export estático) → `firebase deploy --only hosting`.

### Arquivos criados/alterados

| Ação | Arquivo | Fase |
|---|---|---|
| criado | `docs/ROADMAP.md` (este documento) | — |
| criado | `scripts/orcamento/upload.mjs` | 1 |
| criado | `scripts/orcamento/validar.mjs` | 1 |
| editado | `firestore.rules` (bloco `opl_empenhos`) | 1 |
| editado | `.gitignore` (`scripts/orcamento/serviceAccountKey.json`) | 1 |
| editado | `package.json` (deps + scripts `upload:orcamento`, `validar:orcamento`) | 0/1 |
| criado | `src/app/(orcamento)/orcamento/page.tsx` | 2 |
| criado | `src/app/(orcamento)/orcamento/OrcamentoClient.tsx` | 2 |
| editado | `src/components/Sidebar.tsx` (item de nav) | 2 |

Reuso sem mudança: `src/lib/firebase.ts`, `src/lib/AuthContext.tsx`, `src/components/AuthButton.tsx`,
`firebase.json`, `globals.css` (tokens/classes).

### Verificação (end-to-end)

1. `npm install` (firebase-admin, xlsx, chart.js).
2. `npm run upload:orcamento` → 666 docs em `opl_empenhos` no console do Firestore (conferir com `--csv`).
3. `firebase deploy --only firestore:rules` → simulador: leitura só admin.
4. `npm run dev` → logar como admin → `/orcamento`: filtros, tabela com setas, gráficos OK.
5. Não-admin / deslogado → bloqueado (e leitura negada pelas rules).
6. `npm run build` sem erros → `firebase deploy --only hosting`.

### Log de execução (Orçamento)

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
- **2026-06-11 (reorganização cadastro × orçamento)**: estrutura separada em duas frentes, **sem
  alterar URLs nem comportamento**.
  - **App:** route groups `src/app/(cadastro)/` (→ `/`, `/agregacoes/*`) e
    `src/app/(orcamento)/orcamento/` (→ `/orcamento`); não entram na URL. `layout.tsx`/`globals.css`/
    `favicon.ico` permanecem no topo (root layout único).
  - **Imports de dados:** alias `@data/*` no `tsconfig.json`; os 7 imports de `data/*.json` migrados
    de caminho relativo (quebrava com a profundidade do route group) para `@data/`.
  - **Scripts:** movidos para `scripts/orcamento/{upload,validar}.mjs` + chave gitignored junto
    (`join(__dirname,...)` resolve sem mudar código); `.gitignore` e `package.json` atualizados;
    novo npm script `validar:orcamento`.
  - **Docs:** roadmap movido de `ROADMAP_ORCAMENTO.md` (raiz) → `docs/orcamento/ROADMAP.md`.
  - **Núcleo compartilhado** (`src/lib`, `src/components`) inalterado.
  - **Verificação:** `npm run build` OK (rotas e `out/` idênticos; route groups não vazam para o
    output). Redeploy `firebase deploy --only hosting` (94 arquivos) e verificação em produção
    logado como admin — **funcionando**.
  - **Git:** integrado à `main` via PR #4 (merge `654be52`); branches de feature removidas.
- **2026-06-11 (reorganização do roadmap)**: `docs/orcamento/ROADMAP.md` movido para `docs/ROADMAP.md`
  e reestruturado em **Preâmbulo Compartilhado + Frente A (Cadastro) + Frente B (Orçamento)**.
  Conteúdo de orçamento preservado integralmente. Frente Cadastro documentada pela primeira vez
  (factual, a partir do código). Comando `/iniciar` atualizado para o novo caminho.
- **2026-06-11 (renomeação + nova frente)**: Frente B renomeada para "Orçamento Pleitos - Dados
  SERPRO". Nova frente "Orçamento Pleitos - Gestão SPLE" registrada com estudo preliminar de
  modelagem a partir de `_arquivos/ERD-pleitos/`.

---

## FRENTE C — Orçamento Pleitos - Gestão SPLE

> Estudo preliminar concluído. Nenhuma fase implementada.

### Processo

Acompanhamento orçamentário interno do SPLE (processo distinto da Frente B - Dados SERPRO):
um item de despesa percorre três fases progressivas —

1. **Lançamento das unidades** — a UA propõe valores, memória de cálculo e justificativa.
2. **Aprovação do orçamento** — ajustes STIE, aprovação COGEL/SIGEPRO e valor aprovado.
3. **Execução do orçamento** — SEI + NE emitida, valores estimado/empenhado/pago, datas de envio (DOD, ETP, TR/PB, Entrega/Serviço).

**Fonte de dados atual:** planilha Excel/Sheets do SPLE — estrutura plana com grupos repetidos
de valores por exercício (2022, 2024, proposta 2026) e colunas acumuladas por fase.
Referência: `_arquivos/ERD-pleitos/` (estudo de modelagem, schema SQL, CSV de estrutura).

**Diferença em relação à Frente B - Dados SERPRO:** `opl_empenhos` ingere NEs já efetivadas
do CSV público (fase de execução contábil). Esta frente rastreia o **processo de planejamento**
que antecede e acompanha a execução: UA propõe → STIE/COGEL aprova → NE emitida. As duas são
complementares e podem ser exibidas juntas, mas têm fontes e fluxos distintos.

### Estudo de modelagem (`_arquivos/ERD-pleitos/`)

Modelo relacional normalizado até 3FN (`estudo_modelagem.md` + `schema.sql`):

| Camada | Tabelas |
|---|---|
| Dimensões | `unidade_administrativa`, `plano_integrado`, `despesa_agregada`, `item_despesa`, `exercicio` |
| Fato central | `item_orcamentario` (exercicio × UA × PI × item_despesa; `status`: lancamento/aprovacao/execucao) |
| Grupo repetido (1FN) | `valor_referencia` (1:N — histórico de exercícios anteriores) |
| Fases (1:1) | `lancamento_unidade`, `aprovacao`, `execucao` |

**Pontos fortes:** 3FN correta, grupos repetidos resolvidos sem alterar schema, fases em tabelas
separadas evitam NULLs, `status` enum viabiliza filtros por fase.

**Questões em aberto para Firestore** (decidir antes de implementar):

| Entidade relacional | Embedding (1 leitura, simpler) | Coleção separada (mais flexível) |
|---|---|---|
| Fases 1:1 (`lancamento`, `aprovacao`, `execucao`) | Mapas dentro do doc `opl_itens` | Subcoleções por fase |
| `valor_referencia` (1:N, crescimento limitado) | Array de objetos no doc | Subcoleção |
| Dimensões (UA, PI, etc.) | Desnormalizar nome/código no doc | Coleções `opl_unidades`, `opl_planos` |

Para dashboard read-only: embedding das fases + desnormalização parcial das dimensões é a
abordagem mais pragmática. **Prefixo de coleção sugerido:** `opl_` (ex.: `opl_itens`,
`opl_exercicios`).

### Tabela de fases

| Fase | Descrição | Status |
|---|---|---|
| 0 | Decisão do modelo Firestore (embedding vs. coleções) | `[ ]` |
| 1 | Script de ingestão da planilha → Firestore | `[ ]` |
| 2 | Página de acompanhamento no app (filtros por UA, PI, fase, exercício) | `[ ]` |
| 3 | Deploy (rules + hosting) | `[ ]` |

### Log de execução (Gestão SPLE)

- **2026-06-11**: Estudo preliminar de modelagem concluído (`_arquivos/ERD-pleitos/`). Frente
  registrada no ROADMAP. Nenhuma fase implementada.
