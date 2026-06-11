---
score: 6
counts: [object Object]
target: src/app/(cadastro)/agregacoes/AgregacoesOverview.tsx
timestamp: 2026-06-11T15-52-27Z
slug: src-app-cadastro-agregacoes-agregacoesoverview-tsx
---
# Critique — AgregacoesOverview.tsx (expand de estatísticas por seção)

Score: 6/10 | P0: 2 | P1: 4 | P2: 2

## P0
- [P0.1] Separador decimal errado: toFixed(1) → "22.6%" em vez de "22,6%". Afeta AgregacoesOverview e CiclosClient.
- [P0.2] Coluna Aptos duplicada na tabela expandida — dado já visível nos badges acima. Dilui protagonismo dos demográficos.

## P1
- [P1.1] aria-expanded ausente no botão de expand (WCAG 4.1.2).
- [P1.2] Linha-pai sem sinal visual quando expandida — só chevron rotaciona.
- [P1.3] <td colSpan={4} p-0> herda bg-surface-2 do <tr> — faixa colorida vazia nas colunas de identidade.
- [P1.4] ChevronDown transition-transform sem guard prefers-reduced-motion.

## P2
- [P2.1] Botão de expand usa rounded (full circular) em vez de rounded-[4px] do sistema.
- [P2.2] Nenhum indício na interface de que as linhas são expansíveis.
