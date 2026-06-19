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
- Console: https://console.firebase.google.com/project/eleicoes2026-dadoszonas
  (Firestore: …/eleicoes2026-dadoszonas/firestore).
- Config web em `.env.local` (NEXT_PUBLIC_FIREBASE_*); **não** commitado (`.gitignore` cobre `.env*`).
- Hosting: export estático Next.js (`next.config.ts` → `output: "export"`; `firebase.json` →
  `public: "out"`, `cleanUrls`, `trailingSlash:false`).
- Produção: **https://eleicoes2026-dadoszonas.web.app**
- Deploy: `firebase deploy --only firestore:rules` e `firebase deploy --only hosting`
  (conta ativa correta: `mozart.medeiros@tre-rn.jus.br` — ver `/iniciar`).
- **Nota operacional (chunk obsoleto pós-deploy):** sendo export estático, navegar client-side por
  link **logo após um deploy** pode mostrar **"This page couldn't load / Reload"** numa aba que já
  estava aberta — o JS antigo pede um chunk com hash que o deploy novo substituiu (404). **Reload
  resolve** e **não afeta sessões novas**; não é bug de código/dados/credenciais (confirmado
  2026-06-18 em `/agregacoes/ciclos`, que retornava HTTP 200). Mitigação: agrupar deploys (publicar
  1× ao fim de um lote) em vez de a cada ajuste.
- Stack: Next.js 16.2.6 (Turbopack) · React 19 · Tailwind v4 (`@theme inline`) · `firebase ^12`
  (Auth + Firestore; `firebase-admin` na ingestão). Libs: `chart.js`/`react-chartjs-2` (gráficos),
  `lucide-react` (ícones), `next-themes` (tema), `xlsx` (ingestão `.xlsx`). Dev: http://localhost:3000.

**GitHub**
- Repositório: `mozartmedeiros-jus/cadastro-eleitoral-rn`
  (https://github.com/mozartmedeiros-jus/cadastro-eleitoral-rn; conta de push/PR
  `mozartmedeiros-jus` — ver `/iniciar`).

**Auth e autorização**
- Login Google via `src/lib/AuthContext.tsx` (`useAuth()`), botão `src/components/AuthButton.tsx`.
- Allow-list em `src/lib/firebase.ts` (`ADMIN_EMAILS` / `isAdmin()`) e espelhada em `firestore.rules`
  (`isAuthorizedAdmin()`): **karina.pedrosa, monica.paim, mozart.medeiros @tre-rn.jus.br** (email_verified).

**Firestore — convenção de coleções** (`<domínio>_<entidade>`, minúsculo)
- `cad_` → Cadastro Eleitoral (prefixo **futuro**; hoje as coleções são `mrj`, `agregacoes`, `ciclos`).
- `opl_` → Orçamento de **Pleitos** eleitorais.
- `oor_` → Orçamento **Ordinário** (futuro).

**Estrutura de rotas**
- Route groups `src/app/(cadastro)/` (→ `/`, `/agregacoes/*`) e
  `src/app/(orcamento)/gestao-orcamentaria/` (→ `/gestao-orcamentaria/dados-serpro` [SERPRO] e
  `/gestao-orcamentaria/execucao` [SPLE]). Os grupos não entram na URL.
- Núcleo compartilhado: `src/lib/`, `src/components/`, `src/app/layout.tsx`, `src/app/globals.css`.

**Padrão visual obrigatório** — `DESIGN.md` + `PRODUCT.md` (raiz; DSGov / "Cartório Digital"):
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

- **2026-06-19 (boundary de erro raiz — auto-cura de chunk obsoleto pós-deploy)**: a tela
  **"This page couldn't load / Reload to try again, or go back."** (relatada em `/agregacoes/ciclos`)
  foi diagnosticada como o **`DefaultGlobalError` embutido do Next** (ramo de erro de cliente: sem
  `digest`, com botão Back), não um componente nosso. Causa-raiz: sendo **export estático**, navegar
  client-side numa **aba com build antigo** após um deploy busca o chunk pelo hash anterior (404 →
  **ChunkLoadError**) e, como o app **não tinha nenhum boundary de erro**, isso escalava para o
  fallback de tela cheia do Next (derrubando a shell). Reload sempre resolvia (confirmado) — bate com
  a nota "chunk obsoleto pós-deploy" do Preâmbulo.
  - **Correção (1 arquivo novo):** `src/app/global-error.tsx` substitui o `DefaultGlobalError`.
    **Auto-cura** — detecta `ChunkLoadError` (regex sobre `name`/`message`) e faz **um**
    `location.reload()`, com guarda anti-loop de 10s via `sessionStorage`; abas antigas se recuperam
    sozinhas. Para os demais erros, **card DSGov/PT-BR** (`.ds-card`, ícone `AlertTriangle` em `warn`,
    botões **Recarregar**/**Voltar**) — só tokens, sem hex, com `motion-reduce`. Como o boundary raiz
    substitui o `ThemeProvider`, lê `localStorage.theme` + `prefers-color-scheme` e aplica `.dark`
    (senão, claro padrão). Lembrete: boundaries de erro **só atuam em build de produção**.
  - `npm run build` OK (TypeScript sem erros); `firebase deploy --only hosting` (120 arquivos) em
    produção (`https://eleicoes2026-dadoszonas.web.app`).
  - **Git:** **PR #19** (`feat/global-error-boundary`) — **aberto** (não mergeado); confirmar
    `state: MERGED` via `gh` antes de apagar a branch.
- **2026-06-18 (barra de controle na Estatística + 3ª visão "MRJ"; barra de navegação nas Agregações)**:
  trabalho de padronização das barras horizontais segmentadas (padrão único: `inline-grid`, botão
  `h-[34px] px-3 rounded-[4px] text-center text-[12.5px] font-semibold`, ativo `bg-accent-soft`/
  `text-accent-ink`/`border-accent-soft-border`).
  - **Estatística (`/`, `CadastroClient.tsx`):** o seletor de visão e o `Exportar CSV` saíram do
    canto direito do cabeçalho fixo para uma **barra de controle abaixo do cabeçalho**. Esquerda:
    seletor `grid-cols-3` (itens de mesma largura) `Pessoal de apoio | Pontos de Apoio | MRJ`.
    Direita (mesma linha): `Atualizar` (só na visão Pontos de Apoio) + `Exportar CSV`, com carimbo
    "atualizado às HH:MM". O **Atualizar** foi elevado do `PontosApoioPanel` para a barra via novo
    prop `onControlsChange` (`{ lastUpdated, refreshing, refresh }`; `refresh: () => load()` p/ não
    passar o evento como `initial`); a lógica de fetch segue no painel e a barra interna foi
    removida. Visão **MRJ** = placeholder DSGov (`.ds-card` "MRJ" + "Visão em desenvolvimento."),
    só o nome — conteúdo a definir; `Atualizar`/`Exportar CSV` ocultos nessa visão.
  - **Agregações (`/agregacoes`, `/agregacoes/ciclos`, `/agregacoes/analise`):** novo
    `src/components/AgregacoesNav.tsx` — barra `[ Ciclos | Análise ]` (links, ativo por
    `usePathname`), **só para usuário logado** (Ciclos/Análise são SPLE-only), adicionada abaixo do
    cabeçalho nas 3 rotas (na Análise, antes do banner de ciclo ativo).
  - **Sidebar (`src/components/Sidebar.tsx`):** removidos os sub-itens **Ciclos** e **Análise**;
    **"Agregações"** virou link simples para `/agregacoes` (fim do accordion). Removida toda a
    máquina de accordion órfã (`agregOpen` + `useEffect` + `openByParent` + guard de sub-itens +
    botão-toggle + chevron) e os campos não usados da interface (`sub`/`parent`/`disabled`/
    `dividerBefore`) com seus blocos (badge "em dev"/divider). Imports órfãos limpos
    (`Fragment`, `BarChart2`, `History`, `ChevronRight`). **Estado ativo** redefinido para o URL
    compartilhado: "Eleitores por seção" (público) ativo em `/agregacoes` exato; "Agregações"
    (SPLE) ativo nas sub-rotas `/agregacoes/...`.
  - Só tokens DSGov, sem hex. `npm run build` OK; deploys `firebase deploy --only hosting` em
    produção ao longo da sessão (Estatística e Agregações). Sidebar também passou a ter "Gestão
    Orçamentária" como link único — ver Log da Frente C (mesma data).
  - **Ajuste de navegação (mesmo dia):** "Agregações" (sidebar) passou a apontar para
    **`/agregacoes/ciclos`** (não mais `/agregacoes`); a barra `[ Ciclos | Análise ]` foi **removida
    da overview `/agregacoes`** (Eleitores por seção) e fica **só** em `/agregacoes/ciclos` e
    `/agregacoes/analise`. `isAgregSple` redefinido para `group==='sple' &&
    href.startsWith('/agregacoes')` (ativo em qualquer sub-rota); "Eleitores por seção" segue ativo
    no `/agregacoes` exato, sem barra.
- **2026-06-17 (visão "Pontos de Apoio" na Estatística — CSV público ao vivo)**: a página `/`
  (`CadastroClient.tsx`) ganhou um **seletor segmentado** de 2 opções no topo da área de dados que
  alterna **toda a área** (título H1, botão Exportar e conteúdo):
  - **"Pessoal de apoio"** (default) = a tela de hoje, intocada (envolvida em `{view==='pessoal' && …}`);
    H1 segue "Estatísticas de Locais de Votação".
  - **"Pontos de Apoio"** = nova visão alimentada por **CSV público de planilha Google buscado AO VIVO**
    via `fetch` no cliente (sem Firestore, sem ingestão, sem rota, sem item de Sidebar). Compatível com o
    export estático. H1 → "Locais de Ponto de Apoio e Transmissão descentralizada"; Exportar baixa o CSV
    dessa visão.
  - **Lib** `src/lib/pontos-apoio-csv.ts`: `interface PontoApoio`, `PONTOS_CSV_URL` e `fetchPontos(url)`
    (dynamic import do `xlsx` no padrão `XLSXmod.default ?? XLSXmod`, cache-busting `&_t=Date.now()`,
    parse por índice com `sheet_to_json {header:1}` — o CSV tem cabeçalho com `PONTO DE APOIO` duplicado).
  - **Painel** `src/app/(cadastro)/PontosApoioPanel.tsx` (público, sem auth gate): loading/erro com card
    DSGov, KPIs (locais · transmissão · apoio), filtros (Zona, Município, característica, busca), tabela
    com paginação reusando o padrão da página.
  - **Schema final do CSV (7 colunas):** `ZONA · MUNICÍPIO · PONTO DE APOIO (local) · ENDEREÇO ·
    FUNCIONAMENTO · PONTO DE TRANSMISSÃO · PONTO DE APOIO (apoio)`. **Zona** vira filtro + 1ª coluna; a 7ª
    coluna **Apoio** é badge por marcador (helper `ApoioBadge` + mapa): `APOIO`→"Sim" (verde),
    `INCLUIR`→"Incluir" (neutro), `ALTERAR`→"Alterar" (âmbar), `EXCLUIR`→"Excluir" (vermelho), vazio→"—".
    (À época, a 7ª coluna ainda não tinha propagado no CSV publicado — código já pronto para quando aparecer.)
  - **Botão "Atualizar" + carimbo "atualizado às HH:MM"** no painel: re-busca sob demanda (fetch extraído
    para `load(initial)`; 1ª carga usa loader de painel, recarga usa `refreshing` mantendo a tabela).
    Resolve o fato de o `fetch` rodar só na montagem; permanece o atraso de cache (~até 5 min) do CSV
    publicado do Google.
  - Só tokens DSGov, sem hex no JSX. Build OK; **4 deploys** `firebase deploy --only hosting` em produção
    ao longo da sessão (base → adequação ZONA/Apoio → botão Atualizar → badges da coluna Apoio). Material
    de origem em `_arquivos/pontos-apoio/` (local, gitignored).
  - **Git:** integrado à `main` via **PR #17** (`feat/pontos-apoio-csv`), merge `0e0ad07`
    (state MERGED); branch de feature removida (local e remota).
- **2026-06-16 (limiar do badge de seção: ≤50 → <50)**: o chip de seção das telas de agregação
  ficava vermelho (`bg-danger-soft`) para `aptos <= 50`; passou a ser **só para `aptos < 50`** — uma
  seção com exatamente 50 aptos deixa de ser sinalizada (vira verde se dentro do limite, ou neutra).
  Trocado `<= 50` por `< 50` em `getBadgeClass` de `AgregacoesOverview.tsx` (Eleitores por seção) e
  `getBadgeClasses` de `AgregacoesClient.tsx` (Análise; comentário ajustado). Build OK; `firebase
  deploy --only hosting` (108 arquivos) em produção (`https://eleicoes2026-dadoszonas.web.app`).
- **2026-06-12 (expand por local na Análise)**: portada para `AgregacoesClient.tsx`
  (`/agregacoes/analise`) a funcionalidade de expandir por local já existente em `AgregacoesOverview`
  (Eleitores por seção). Coluna líder com chevron abre mini-tabela Seção · Idosos · C/ Deficiência ·
  Analfabetos (qtd e %), via campos demográficos já presentes no `cadastro_eleitoral.json`. Estendida
  a interface `SecaoDetalhe`, reusado helper `formatPerc`, linha expandida alinhada à coluna SEÇÕES
  por `colSpan` (4/conteúdo/2); hint "expande estatísticas por seção" na barra. Convive com a
  calculadora (chips) e o visor. Build OK; deploy em produção.
  - **Git:** integrado à `main` via **PR #9** (`feat/analise-expand-por-local`), merge `b087061`
    (state MERGED); branch de feature removida (local e remota).
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
  - **Git:** as três entregas de 2026-06-12 (calculadora + cor `warn` + KPI extras) foram
    integradas à `main` via **PR #7** (`feat/calculadora-secoes-kpi-extras`), merge `f6b81c0`
    (state MERGED); branch de feature removida (local e remota).
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

- **2026-06-18 (barra de navegação `GestaoNav` na página Dados SERPRO)**: a rota
  `/gestao-orcamentaria/dados-serpro` recebeu, abaixo do cabeçalho, a nova barra de links
  `<GestaoNav>` (com `Dados SERPRO` em estado ativo). Detalhe completo da barra e do fim do submenu
  no Log da Frente C (mesma data). Sem mudança de dados/coleção/rules. `npm run build` OK; deploy
  de hosting em produção.
- **2026-06-16 (botão "Atualizar dados" equiparado ao CLI + filtro exclusivo)**: três correções na
  página **Dados SERPRO** (`/gestao-orcamentaria/dados-serpro`, `OrcamentoClient.tsx`).
  - **Import por UI agora equivale ao `upload:opl-serpro`:** o `confirmImport` passou a (1) ler o
    estado atual e gravar `prev{Empenhadas,Liquidadas,Pagas}` + `*At` com **guarda por valor**
    (variação semana-a-semana), (2) gravar com **`set(..., { merge: true })`** e (3) **deixar de
    apagar** NEs ausentes (upsert puro). Antes o botão sobrescrevia sem merge (apagava `prev*`) e
    fazia substituição total — quebrava/zerava a variação semanal. Modal deixou de ser destrutivo.
  - **Bug de carregamento do `xlsx`:** `(await import('xlsx')).default` vinha `undefined` (xlsx@0.18
    não tem default export sob Turbopack) → `Cannot read properties of undefined (reading 'read')`.
    Trocado por `XLSXmod.default ?? XLSXmod`. Import por UI nunca tinha funcionado de fato.
  - **Filtro "Somente empenho sem entrada":** o toggle deixou de **adicionar** os sem-entrada à
    lista e passou a mostrar **exclusivamente** os sem entrada (`showSemEntrada ? semEntrada(d) :
    !semEntrada(d)`), alinhado ao padrão "Apenas com alteração na semana".
  - **Verificação:** import real executado pela UI (938 docs); checagem read-only no Firestore
    confirmou `prev*` gravado em Liquidado (70) e Pago (42); Empenhado 0 = nenhum valor empenhado
    mudou nesta carga (esperado). `npm run build` OK; deploys de hosting em produção.
- **2026-06-15 (reorganização "Gestão Orçamentária")**: o módulo de orçamento foi reorganizado em
  torno de um item-pai **Gestão Orçamentária** na sidebar, alinhando rotas, lib e scripts ao
  vocabulário do banco (`opl-serpro` = SERPRO/empenhos, `opl-sple` = SPLE/itens). **Sem mudar
  conteúdo/H1/`metadata` das páginas** — só organização/navegação.
  - **Rotas:** `/orcamento` → **`/gestao-orcamentaria/dados-serpro`**; `/sple` →
    **`/gestao-orcamentaria/execucao`** (`git mv` dos pares page+client). URLs antigas agora **404**
    (sem stubs) — confirmado em produção.
  - **Lib:** `orcamento-xlsx.ts` → `opl-serpro-xlsx.ts`; `sple-xlsx.ts` → `opl-sple-xlsx.ts` (import
    do OrcamentoClient atualizado; `opl-sple-xlsx.ts` mantida mesmo sem importador no app — espelha
    o parser do CLI).
  - **Scripts:** `scripts/orcamento` → `scripts/opl-serpro`; `scripts/sple` → `scripts/opl-sple`;
    credencial unificada em **`scripts/serviceAccountKey.json`** (gitignored; default
    `join(__dirname,'../serviceAccountKey.json')`). npm scripts → `upload:opl-serpro`,
    `validar:opl-serpro`, `upload:opl-sple`, `validar:opl-sple`.
  - **Sidebar:** removidos os 2 itens soltos; nova sanfona **Gestão Orçamentária** com filhos
    Lançamento (em dev) · Aprovação (em dev) · Execução do orçamento (`/gestao-orcamentaria/execucao`)
    · Dados SERPRO (`/gestao-orcamentaria/dados-serpro`, com divider). Gating de accordion
    generalizado por `parent` (`agreg`/`gestao`); só tokens DSGov, sem hex.
  - **SPLE somente-leitura:** a página de Execução (ex-`/sple`) perdeu o botão "Atualizar dados" +
    import `.xlsx` pela UI (atualização só via CLI). O import permanece **só** em Dados SERPRO.
  - **Verificação:** `validar:opl-sple` (130=130) e `validar:opl-serpro` (82 NEs) OK com a credencial
    no novo caminho; `npm run build` lista as 2 rotas novas e omite `/orcamento`/`/sple`.
    `firebase deploy --only hosting` (108 arquivos) em produção; HTTP 200 nas novas, 404 nas antigas.
    `firestore.rules` **não** foi tocado. (Branch `refactor/gestao-orcamentaria`.)
- **2026-06-12 (coluna NE / SEI)**: a coluna **NE** da tabela de empenhos (`/orcamento`) passou a
  exibir também o **Processo SEI**, no formato empilhado de duas linhas (NE em cima, negrito; SEI
  embaixo, secundário) — mesmo padrão de DESCRIÇÃO / FORNECEDOR. Cabeçalho `NE` → `NE / SEI`.
  - **Dado já existente:** `processoSei` é ingerido de `row[10]` (coluna K) no parser
    (`src/lib/orcamento-xlsx.ts`) e no script de upload; já estava na interface `Empenho`. Mudança
    **puramente de apresentação** — sem re-ingestão, schema ou rules.
  - **Busca:** `processoSei` adicionado ao predicado `matchesText` (busca também por SEI);
    placeholder atualizado para "Empenho, SEI, descrição ou fornecedor…".
  - Alterações restritas a `OrcamentoClient.tsx` (cabeçalho, célula, busca, placeholder). Reuso dos
    tokens/classes existentes (`num`, `text-ink-4`, `text-[11px]`). Build OK; `firebase deploy
    --only hosting` (96 arquivos em `out`) em produção (`https://eleicoes2026-dadoszonas.web.app`).
- **2026-06-12**: Variação **semana-a-semana** na tabela (`/orcamento`), incluindo EMPENHADO.
  - **Motivo:** o `.xlsx` é atualizado semanalmente, mas o modelo guardava só snapshot mensal e
    comparava mês-a-mês — as setas (em especial no Empenhado) não refletiam as mudanças semanais.
  - **Ingestão (`scripts/orcamento/upload.mjs`):** antes de gravar, lê os docs existentes
    (`collectionRef.get()`) e, **com guarda por valor**, registra `prev<Col>` + `prev<Col>At`
    (Empenhadas/Liquidadas/Pagas) só quando o valor da coluna muda; se igual, omite (merge preserva
    o anterior — re-rodar no mesmo período não zera a base). `runAt` = data do upload.
  - **UI (`OrcamentoClient.tsx`):** setas das 3 colunas passam a comparar `despesas*` vs `prev*`
    (semana-a-semana); removido o `prevByDocId` mês-a-mês; `hasAnyChange`/filtro "apenas com
    alteração na semana" reescritos com `varDir(prev*)`. Tooltip por célula com data e valor
    anterior (`Empenhado alterado em dd/mm/aaaa · anterior R$ …`); helper `formatDate`; `aria-label`
    e textos "mês" → "semana". Novos campos opcionais na interface `Empenho`.
  - **Semântica:** `prev*` guarda o último valor distinto; a seta mostra a direção da última
    variação registrada e permanece até nova variação (decorre da guarda por valor).
  - **Ordem de implantação:** deploy da UI + rodar o novo `upload:orcamento` para popular `prev*`;
    setas reaparecem a partir da 1ª semana com valor alterado. Build OK.
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

> Fases 0–3 concluídas. Em produção: `https://eleicoes2026-dadoszonas.web.app/gestao-orcamentaria/execucao`.

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
| 0 | Decisão do modelo Firestore (embedding vs. coleções) | `[x]` |
| 1 | Script de ingestão da planilha → Firestore | `[x]` |
| 2 | Página de acompanhamento no app (filtros por UA, PI, fase, exercício) | `[x]` |
| 3 | Deploy (rules + hosting) | `[x]` |

### Log de execução (Gestão SPLE)

- **2026-06-18 (navegação da Gestão Orçamentária em barra horizontal; fim do submenu)**: novo
  `src/components/GestaoNav.tsx` substitui o submenu da sidebar por uma **barra de links** no topo
  das 3 rotas de `/gestao-orcamentaria` (overview, execução, dados-serpro), no mesmo padrão
  segmentado da Estatística. Três grupos, ativo por `usePathname`:
  - `[ Por Setor | Por PI ]` — na própria Visão consolidada funciona como toggle de estado
    (`grupoView`, via prop `onGrupoChange`); nas outras rotas vira link para `/gestao-orcamentaria`.
  - `[ Lançamento das unidades · em dev | Aprovação do orçamento · em dev | Execução do orçamento ]`
    — fases em dev são spans não-clicáveis com badge; Execução é link p/ `/gestao-orcamentaria/execucao`.
  - `[ Dados SERPRO ]` — link p/ `/gestao-orcamentaria/dados-serpro` (Frente B).
  - **Decisão fechada:** manter rotas (barra é navegação por links, URLs preservadas) — não houve
    merge em página única. A barra anterior dentro do `<main>` da overview (toggle Por Setor/Por PI)
    foi substituída pelo `<GestaoNav>`; também troquei os valores arbitrários `bg-[var(--accent-soft)]`
    pelos tokens DSGov.
  - **Sidebar:** "Gestão Orçamentária" virou **link único** para `/gestao-orcamentaria` (sub-itens
    Visão geral/Lançamento/Aprovação/Execução/Dados SERPRO removidos; accordion `gestao` e imports
    de ícone órfãos limpos — detalhe completo no Log da Frente A, mesma data).
  - Só tokens DSGov, sem hex. `npm run build` OK; `firebase deploy --only hosting` em produção
    (`https://eleicoes2026-dadoszonas.web.app/gestao-orcamentaria`).
- **2026-06-16 (coluna ITEM DA DESPESA: descrição + código/SEI)**: na tabela da Execução
  (`/gestao-orcamentaria/execucao`, `SpleClient.tsx`), a coluna **Item da Despesa** passou a exibir
  a **descrição** (sem o código de natureza, que aparece embaixo) na 1ª linha, quebrando linha
  (removido o `line-clamp-1`); na 2ª linha, o **código** (`naturezaDespesa`) e, quando houver SEI
  (`seiNe`), `" - " + SEI`. Novo helper `descricaoItem(itemDespesa, codigo)` remove o código e os
  separadores soltos das pontas (quando `codigo === 'OUTROS'`, mantém o texto inteiro). Só
  apresentação — sem mudança de dados/coleção/rules. Build OK; deploy de hosting em produção.
- **2026-06-16 (página índice "Visão consolidada" — Por Setor / Por PI)**: nova **página índice**
  `/gestao-orcamentaria/` (antes 404) com a **Visão consolidada** do orçamento: toggle segmentado
  de 2 botões (Por Setor / Por PI, `aria-pressed`/`motion-reduce`) alterna **um painel por vez**,
  agregando o `opl_itens` (sem re-ingestão, coleção ou rules). Helper `agrupar(data, keyOf)` soma
  `vlrAprovado/Estimado/Empenhado/Pago` por chave (`setor` ou `pi`), ordem A→Z; memos
  `dadosPorSetor`/`dadosPorPI`/`grupoRows`/`grupoTotais`. Colunas: chave · Aprovado · Estimado ·
  Δ Aprov.−Estim. · Empenhado · A empenhar · Pago · A pagar (deltas só contam a linha quando a base
  existe). Coluna-chave traz barra de progresso fina (empenhado/aprovado, `bg-accent` sobre
  `bg-surface-3`, `aria-label` do %); vazios → "—"; deltas `<0` em `text-danger`; `tfoot` de Totais.
  Só tokens DSGov (paleta multicolorida do projeto antigo é anti-referência), sem hex no JSX; gate
  `canEdit` read-only e mesmo cabeçalho/loading da Execução. **Criados:**
  `gestao-orcamentaria/{page,GestaoOrcamentariaClient}.tsx`. **Sidebar:** item-pai "Gestão
  Orçamentária" virou toggle puro (`href '#gestao'`) e ganhou 1º filho **"Visão geral"** →
  `/gestao-orcamentaria` (active por match exato, `isGestaoOverview`). A página de **Execução**
  (`/gestao-orcamentaria/execucao`) **permanece como antes** (revertida — os painéis não ficam mais
  lá). Prompt-fonte: `_arquivos/ERD-pleitos/implementar-paineis-setor-pi.md`. `npm run build` OK
  (rota `/gestao-orcamentaria` no output); `firestore.rules` não tocado.
  `firebase deploy --only hosting` (118 arquivos) em produção
  (`https://eleicoes2026-dadoszonas.web.app/gestao-orcamentaria/`).
  - **Git:** integrado à `main` via **PR #14** (`feat/paineis-setor-pi`), merge `aea1e0e`
    (state MERGED); branch de feature removida (local e remota).
  - **Nota:** um deploy intermediário (108 arquivos) chegou a publicar os painéis **dentro** da
    Execução; corrigido nesta entrada (movidos para a índice + execução revertida).
- **2026-06-15 (reorganização "Gestão Orçamentária")**: a página de Gestão SPLE migrou de `/sple`
  para **`/gestao-orcamentaria/execucao`** (sub-item "Execução do orçamento" da nova sanfona) e
  virou **somente-leitura** — removido o import `.xlsx` pela UI; atualização só via
  `npm run upload:opl-sple`. Lib `sple-xlsx.ts` → `opl-sple-xlsx.ts`; scripts `scripts/sple` →
  `scripts/opl-sple`. Detalhes completos no Log da Frente B (entrada de 2026-06-15). Em produção.
- **2026-06-11**: Estudo preliminar de modelagem concluído (`_arquivos/ERD-pleitos/`). Frente
  registrada no ROADMAP. Nenhuma fase implementada.
- **2026-06-15**: Fases 0–2 implementadas seguindo o prompt de retomada v2
  (`_arquivos/ERD-pleitos/retomar-frente-c-v2.md`). Modelo fechado: coleção `opl_itens`,
  embedding total, **1 documento por linha** (130 docs) com sufixo `__NN` no doc ID para
  desambiguar a chave natural repetida (UA, PI, naturezaDespesa) — resolve a colisão de ~25%
  da v1. Criados: `src/lib/sple-xlsx.ts` (parser por header→índice, robusto a coluna
  faltante/reordenada), `scripts/sple/upload.mjs` (+ `--csv`), `scripts/sple/validar.mjs`,
  `src/app/(orcamento)/sple/{page,SpleClient}.tsx`. Alterados: `firestore.rules` (bloco
  `opl_itens` read+write só admin, antes do catch-all), `package.json` (`upload:sple`,
  `validar:sple`), `src/components/Sidebar.tsx` (item "Gestão SPLE" → `/sple`, grupo `sple`).
  UI sem gráficos: KPIs (itens, com NE, aprovado, % empenhado), filtros UA/PI/Status + busca,
  tabela UA·PI·Item·Aprovado·Estimado·Empenhado·Pago·SEI, e import de `.xlsx` pela UI
  (substituição completa, idêntico à Frente B). Ingestão executada: 130 docs em `opl_itens`;
  `validar:sple` confere 130 = 130 em todos os 22 setores, sem colisão. `npm run build` ok,
  rota `/sple` no output.
- **2026-06-15**: Fase 3 concluída — `firebase deploy --only firestore:rules,hosting` em
  `eleicoes2026-dadoszonas` (regra `opl_itens` admin-only ativa; 106 arquivos no hosting).
  Frente C completa e em produção: `https://eleicoes2026-dadoszonas.web.app/sple`.
