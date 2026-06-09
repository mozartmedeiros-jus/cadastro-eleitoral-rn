# Handoff para claude.design — Redesign das páginas

Pasta com os arquivos a enviar para o **claude.design** redesenhar as duas telas do dashboard
(**Estatística** `/` e **Agregações** `/agregacoes`), mantendo a lógica atual.

## Conteúdo
| Arquivo | Papel |
|---|---|
| `src/app/CadastroClient.tsx` | Tela **Estatística** (KPIs, filtros, tabela expansível, CSV, edição admin) |
| `src/app/agregacoes/AgregacoesClient.tsx` | Tela **Agregações** (filtros, badges de seção, AGREGAR/TOTAL) |
| `src/app/globals.css` | Sistema de design atual: tokens claro/escuro, `.app-bg`, `.glass`, scrollbars |
| `src/components/Sidebar.tsx` | Shell de navegação |
| `src/app/layout.tsx` | Shell geral (sidebar + conteúdo + ThemeProvider) |
| `src/components/ThemeProvider.tsx` | Abordagem de tema (next-themes) |
| `src/app/page.tsx`, `src/app/agregacoes/page.tsx` | Wrappers que injetam os dados (mostram o shape das props) |
| `package.json`, `postcss.config.mjs` | Stack: Next 16, React 19, Tailwind v4, lucide-react |
| `data/cadastro_eleitoral.sample.json` | **Sample com 3 registros** (formato real, sem subir o arquivo de 1,1 MB) |

> Falta só uma coisa: capturar **screenshots** das duas páginas em claro e escuro de
> `https://eleicoes2026-dadoszonas.web.app` e anexar junto — referência visual ajuda muito.

## Prompt para colar no claude.design

> Antes de colar: anexe os arquivos desta pasta + screenshots das duas telas (claro e escuro).
> Edite o placeholder `[DIREÇÃO ESTÉTICA]` com o visual desejado.

```
Você é designer de produto e front-end sênior. Redesenhe a interface de DUAS telas de um dashboard existente, mantendo TODA a lógica intacta — altere apenas a camada visual (markup + estilo).

<stack>
- Next.js (App Router) + React 19; componentes 'use client'.
- Tailwind CSS v4 — classes utilitárias no JSX; tokens de design em CSS (globals.css), SEM tailwind.config.
- Ícones: lucide-react. Tema claro e escuro via classe .dark (next-themes).
</stack>

<telas>
1. Estatística (CadastroClient.tsx): faixa de KPIs (zonas, municípios, locais, seções, eleitores aptos + métricas calculadas), barra de filtros (busca + selects em cascata zona/município), tabela paginada com linhas expansíveis (detalhe das seções) e botão Exportar CSV. Admins editam inline os campos MESA MRJ e Ponto de Apoio.
2. Agregações (AgregacoesClient.tsx): filtros em cascata (zona/município/local) + toggle "Marcados", parâmetros de cálculo capital/interior, tabela com badges de seção coloridos por faixa de eleitorado e colunas editáveis AGREGAR (checkbox) e TOTAL (numérico).
Ambas compartilham um shell: Sidebar de navegação à esquerda + seletor de tema.
</telas>

<referencia_visual>
Screenshots do estado ATUAL (anexados na pasta paginas/) — use como referência de conteúdo e paridade entre temas, o objetivo é EVOLUIR o visual, não copiar:
- estatistica-claro.png / estatistica-escuro.png — tela Estatística (claro / escuro)
- agregacoes-claro.png / agregacoes-escuro.png — tela Agregações (claro / escuro)
Todo elemento visível nesses prints deve continuar existindo no redesenho.
</referencia_visual>

<preservar>
- NÃO altere props, nomes de estado, hooks, handlers nem a integração Firebase (auth/Firestore).
- Mantenha comportamento: filtros em cascata, ordenação por coluna, paginação, export CSV, edição admin com draft + commit no blur/Enter.
- Mantenha os mesmos dados e campos exibidos.
</preservar>

<objetivo_visual>
[DIREÇÃO ESTÉTICA — ex.: "dashboard institucional limpo, mais respiro entre blocos, tipografia forte, menos efeito glass"]
Obrigatório: tema claro E escuro, alta densidade de dados mantendo legibilidade, contraste acessível (AA).
</objetivo_visual>

<restricoes>
- Faça SOMENTE o redesenho solicitado. NÃO adicione autenticação nova, novas telas, novas features nem bibliotecas além das já usadas.
- Use apenas lucide-react para ícones e Tailwind v4 para estilo.
- Entregue os componentes redesenhados prontos para colar, preservando as assinaturas de props.
</restricoes>

Anexos: código atual das telas + shell + globals.css, sample de dados (3 registros) e os 4 screenshots da pasta paginas/.
```
