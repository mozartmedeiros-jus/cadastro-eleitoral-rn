---
target: src/app/orcamento/OrcamentoClient.tsx
total_score: 22
p0_count: 0
p1_count: 3
timestamp: 2026-06-10T14-46-51Z
slug: src-app-orcamento-orcamentoclient-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Sem contagem de resultados, sem "data de referência", gráfico não reflete filtros |
| 2 | Match System / Real World | 3 | Linguagem de domínio correta (Empenhado/Liquidado/Pago, NE, Natureza) |
| 3 | User Control and Freedom | 3 | Filtros reversíveis, mas sem "limpar tudo" nem botão de limpar busca |
| 4 | Consistency and Standards | 2 | Hex fixo no JSX quebra tema escuro; falta "Dados de {data}" presente nas irmãs |
| 5 | Error Prevention | 3 | Read-only, baixo risco; gates de acesso presentes |
| 6 | Recognition Rather Than Recall | 3 | Filtros visíveis e rotulados |
| 7 | Flexibility and Efficiency | 1 | Sem atalhos, sem export (ícone importado e não usado), sem ordenação, 666 linhas sem paginação |
| 8 | Aesthetic and Minimalist Design | 3 | Plano e limpo, mas sem indicadores-âncora e "R$" repetido 3×/linha |
| 9 | Error Recovery | 1 | onSnapshot sem callback de erro → spinner infinito em falha |
| 10 | Help and Documentation | 1 | Nenhuma ajuda; caveat do snapshot cumulativo (meses futuros = Junho) invisível |
| **Total** | | **22/40** | **Aceitável — precisa de melhorias antes de servir bem o gestor** |

## Anti-Patterns Verdict

**LLM assessment:** Não grita "IA fez isto" — segue honestamente os tokens DSGov (`ds-card`, `ds-input`, `ds-select`, superfícies planas, borda 1px). O problema não é slop estético, é **subaproveitamento**: a página entrega um gráfico e uma tabela densa, mas falta a leitura-âncora (totais e % de execução) que é o motivo de o gestor abrir a tela. E há violações concretas da própria doutrina do projeto (hex no JSX).

**Deterministic scan:** detector retornou 1 warning — `border-accent-on-rounded` na linha 177 (`border-b-2 border-accent` do spinner). É falso-positivo como "borda de card", mas aponta para algo real: o **spinner** contraria o register `product` ("skeleton, não spinner no meio do conteúdo") e não tem alternativa para `prefers-reduced-motion`.

**Visual overlays:** indisponível — nenhuma automação de browser nesta sessão. Sem overlay ao vivo; revisão feita por código + detector.

## Overall Impression

A página é sólida na base (tokens corretos, gates de acesso, dados ao vivo via `onSnapshot`) mas para na metade do caminho. O maior problema: **não existe a leitura de cima** — total Empenhado/Liquidado/Pago e o % de execução. O gestor precisa rolar e ler a tabela para formar um número que deveria estar pronto no topo. Em segundo lugar, o **hex fixo no gráfico** quebra o tema escuro, violando "A Regra do Espelho" do próprio DESIGN.md. A maior oportunidade é adicionar uma faixa compacta de indicadores (não hero-metric) que responda aos filtros.

## What's Working

1. **Fidelidade ao sistema de design** — usa `.ds-card`, `.ds-input`, `.ds-select`, `.num`, `.row-hover`, tokens semânticos. Borda 1px, sem sombra, sem gradiente. A doutrina foi seguida na estrutura.
2. **Sinalização de estado por ícone + cor** — as setas de variação usam `TrendingUp/Down` junto da cor (accent/danger), respeitando "não depender só de cor" do PRODUCT.md.
3. **Gates de acesso claros** — deslogado, não-admin e carregando têm estados próprios e mensagens factuais.

## Priority Issues

- **[P1] Sem indicadores-âncora (totais + % execução).** A tela não mostra o total Empenhado, Liquidado, Pago nem a taxa de execução (Liquidado/Empenhado, Pago/Empenhado). O DESIGN.md *permite* indicadores compactos ("Sem hero-metric gigante — indicadores compactos"); hoje não há nenhum. **Fix:** faixa de 4 indicadores compactos no topo, respeitando os filtros ativos. **Comando:** /impeccable craft (ou layout).

- **[P1] Hex fixo no JSX quebra o tema escuro.** O gráfico usa `#1a7a48`, `#46535f`, `#97a2ae`; no escuro o accent vira `#3fae72` e as tintas mudam, então as barras e o texto do Chart.js ficam fora do tema. Viola "A Regra do Espelho". **Fix:** ler tokens via `getComputedStyle` e re-renderizar ao trocar tema; estilizar legenda/ticks/grid com as cores do tema. **Comando:** /impeccable colorize.

- **[P1] Falta "Dados de {data de referência}" no cabeçalho.** Todas as páginas-irmãs (`/agregacoes`, Ciclos, Análise) exibem "Dados de {DATA_REFERENCIA}". A `/orcamento` não — e o caveat do snapshot cumulativo (Jul–Dez repetem Junho) fica invisível e potencialmente enganoso. **Fix:** adicionar o selo de data no header, espelhando o padrão das irmãs. **Comando:** /impeccable clarify.

- **[P2] Setas de variação comparam o mês errado.** `data.find(p => p.notaEmpenho === d.notaEmpenho && p.mesCode < d.mesCode)` retorna o **primeiro** mês anterior (Janeiro), não o mês imediatamente anterior — e só na coluna Empenhado, que quase nunca muda (empenho é fixado uma vez). A variação significativa está em Liquidado/Pago. **Fix:** comparar com o mês imediatamente anterior e sinalizar Liquidado/Pago. **Comando:** /impeccable craft.

- **[P2] Sem tratamento de erro nem feedback de resultado.** `onSnapshot` não tem callback de erro → falha de leitura deixa spinner infinito. E não há contagem "X de Y empenhos" ao filtrar. **Fix:** callback de erro com estado de falha; contador de resultados na tabela. **Comando:** /impeccable harden.

## Persona Red Flags

**Alex (Power User):** Sem atalhos de teclado. Sem export (o ícone `Download` está importado mas nunca renderizado). Sem ordenação de coluna. 666 linhas renderizadas de uma vez, sem paginação/virtualização — trava em filtro amplo. Sem leitura-âncora para decisão rápida.

**Sam (Acessibilidade):** O gráfico não tem alternativa textual nem `aria` — leitor de tela não recebe nada. O spinner não tem `role="status"`/`aria-live`. Contraste do texto do Chart.js (cinza padrão) provavelmente falha AA no tema escuro. Foco visível existe (anel global), bom.

## Minor Observations

- `Download` importado e nunca usado (lint/dead code + afordância de export faltando).
- Eixo Y mostra o número cheio (ex.: 30.000.000) — abreviar (mi / mil) reduz ruído.
- "R$" repetido 3× por linha × 666 linhas é ruído visual; valores de tabela poderiam usar a fonte de dados mono (`Geist Mono`/`.num`) com o símbolo implícito no cabeçalho.
- Eyebrow "Gestão Orçamentária" + título "Execução Orçamentária" é quase redundante.
- `referencia: any` — tipar como `Timestamp`.
- Busca sem botão de limpar (x).

## Questions to Consider

- O gráfico e os (futuros) totais devem **responder aos filtros**, ou permanecer como visão global do exercício?
- Vale exibir os meses futuros (Jul–Dez, que repetem Junho) ou limitar ao mês corrente para não confundir a leitura?
- Os indicadores de topo devem incluir **% de execução** (Liquidado/Empenhado e Pago/Empenhado), que é a métrica de gestão mais pedida?
