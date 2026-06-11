---
name: Cadastro Eleitoral RN
description: Sistema de design institucional TRE-RN — DSGov, verde eleitoral, superfícies planas, alto contraste AA.
colors:
  accent: "#1a7a48"
  accent-strong: "#15633a"
  accent-ink: "#0e4f2d"
  accent-soft: "#e8f3ec"
  accent-soft-border: "#bfe0cc"
  accent-on: "#ffffff"
  bg: "#f4f6f8"
  surface: "#ffffff"
  surface-2: "#f7f9fb"
  surface-3: "#eef2f6"
  border: "#dde3ea"
  border-strong: "#c7d0da"
  border-faint: "#e8edf2"
  ink: "#14181d"
  ink-2: "#46535f"
  ink-3: "#6b7785"
  ink-4: "#97a2ae"
  warn: "#b54708"
  warn-soft: "#fdf3ea"
  warn-border: "#ecc7a8"
  danger: "#b42318"
  danger-soft: "#fdecea"
  danger-border: "#efc4bf"
typography:
  title:
    fontFamily: "Geist Sans, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist Sans, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Geist Sans, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.1em"
  data:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "11.5px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
    fontFeature: "tnum 1"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-on}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.accent-strong}"
    textColor: "{colors.accent-on}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "38px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.ink}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "40px"
  chip-accent:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    rounded: "{rounded.sm}"
---

# Design System: Cadastro Eleitoral RN

## 1. Overview

**Creative North Star: "O Cartório Digital"**

A sobriedade do registro público levada à tela. Este é o sistema de uma repartição eleitoral, não de um produto de consumo: cada número tem fé pública e a interface existe para que um gestor confie nele à primeira leitura. A linguagem visual é a do padrão gov.br / DSGov — superfícies rigorosamente planas, bordas de 1px, verde eleitoral institucional, contraste AA tratado como assinatura e não como acessório. A densidade é alta porque o usuário é experiente e quer ver muito de uma vez; a calma vem da disciplina, não do vazio.

O sistema rejeita ativamente toda a gramática do "SaaS genérico de IA": glassmorphism, blur decorativo, gradientes (inclusive texto com gradiente), neon, sombras dramáticas e hero-metrics de marketing. Onde um produto comercial colocaria brilho, aqui há borda fina e tipografia. A cor é reservada à ação e ao estado; o resto é tinta sobre papel institucional. O `globals.css` já carrega essa doutrina por escrito — este documento a torna citável.

A personalidade dos componentes é **mínima e silenciosa**: hierarquia construída por espaçamento, peso de texto e a presença pontual do verde, não por molduras empilhadas. Nada chama atenção sem motivo funcional.

**Key Characteristics:**
- Superfícies planas, bordas de 1px, zero sombra ambiente.
- Verde eleitoral institucional (#1a7a48) reservado a ação e estado.
- Contraste AA inegociável, foco sempre visível (anel verde).
- Densidade de dado alta, ruído visual baixo.
- Tema claro/escuro espelhado por tokens, troca previsível.

## 2. Colors

Uma paleta institucional de neutros frios levemente azulados, ancorada por um único verde eleitoral que carrega toda a identidade e toda a ação.

### Primary
- **Verde Eleitoral** (#1a7a48): a cor da marca e a única cor de ação. Botões primários, links ativos, item de navegação selecionado, valores em destaque. Sua raridade na tela é o que a torna legível como "isto importa / isto é acionável".
- **Verde Profundo** (#15633a): estado hover/pressionado do verde eleitoral em superfícies preenchidas.
- **Verde Tinta** (#0e4f2d): texto verde sobre fundo `accent-soft`, quando se precisa de contraste AA máximo.
- **Verde Névoa** (#e8f3ec) + **borda Verde Névoa** (#bfe0cc): preenchimento suave para chips, badges e estado selecionado. Nunca como decoração de fundo de página.

### Neutral
- **Tinta** (#14181d): texto primário, títulos. O extremo escuro do ramp.
- **Tinta 2** (#46535f): texto secundário, rótulos de campo, ícones em estado de repouso ativo.
- **Tinta 3** (#6b7785): texto terciário, metadados, legendas.
- **Tinta 4** (#97a2ae): texto desabilitado, placeholders, eyebrows discretos. Nunca para texto de corpo.
- **Papel Institucional** — fundo (#f4f6f8), superfície (#ffffff), superfície-2 (#f7f9fb), superfície-3 (#eef2f6): camadas tonais frias que substituem a sombra para criar profundidade.
- **Bordas** — padrão (#dde3ea), forte (#c7d0da), tênue (#e8edf2): a moldura de 1px que organiza a tela no lugar de cards e sombras.

### Tertiary (estado, não decoração)
- **Alerta** (#b54708) sobre **Alerta Névoa** (#fdf3ea) / borda (#ecc7a8): avisos, atenção.
- **Perigo** (#b42318) sobre **Perigo Névoa** (#fdecea) / borda (#efc4bf): erros, ações destrutivas.

### Named Rules
**A Regra da Voz Única.** O verde eleitoral aparece em ≤10% de qualquer tela. É a cor da ação e do estado, nunca preenchimento de página ou enfeite. Sua escassez é o ponto: quando tudo é verde, nada é acionável.

**A Regra do Espelho.** Todo token tem par claro/escuro. Nunca escreva uma cor hex direto no JSX; use o token (`bg-surface`, `text-ink-2`, `border-border`) para que o tema troque sozinho.

## 3. Typography

**Display / Body Font:** Geist Sans (com fallback system-ui, sans-serif)
**Data / Mono Font:** Geist Mono (com fallback ui-monospace, monospace)

**Character:** Uma única família sans geométrica neutra, trabalhada por peso e escala em vez de contraste de fontes. O monoespaçado entra só onde número é protagonista (códigos, valores tabulares), com numerais tabulares para colunas que alinham. Sem fonte display decorativa: a seriedade é a fonte do sistema operacional levada a sério.

### Hierarchy
- **Title** (700, ~14px, tracking -0.01em): títulos de seção, nome da marca na sidebar. Negrito carrega o peso; o tamanho permanece contido.
- **Body** (500, ~13.5px, line-height 1.5): texto de interface, rótulos de linha, conteúdo padrão. Medium é o peso de repouso, não regular.
- **Label** (700, 10px, tracking 0.1em, UPPERCASE): eyebrows de navegação e cabeçalhos de grupo curtos (≤4 palavras). Uso reservado; nunca frase de corpo em caixa alta.
- **Data** (600, ~11.5px, Geist Mono, `tnum`): códigos, IDs e valores numéricos que precisam alinhar verticalmente em tabelas.

### Named Rules
**A Regra dos Numerais Tabulares.** Todo número que aparece em coluna ou que muda no tempo usa `.num` (font-variant-numeric: tabular-nums). Dígitos que dançam ao atualizar são proibidos.

**A Regra da Caixa Alta Curta.** Maiúsculas só em rótulos de ≤4 palavras com tracking. Sentença em ALL CAPS é ilegível e está banida.

## 4. Elevation

Sistema **plano por padrão**. A profundidade vem de camadas tonais frias (bg → surface → surface-2 → surface-3) e de bordas de 1px, não de sombra. Não há sombra ambiente em cards, painéis ou inputs. A única sombra do sistema é estrutural e pontual: o flutuante de menus/dropdowns, que precisa se descolar do conteúdo abaixo.

### Shadow Vocabulary
- **Sombra de Menu** (`box-shadow: 0 6px 20px -6px rgba(20, 30, 45, 0.18)` no claro; `0 8px 26px -8px rgba(0,0,0,0.6)` no escuro): exclusiva de elementos sobrepostos (menu de tema, dropdowns, popovers). Token `--shadow-menu`.

### Named Rules
**A Regra do Plano-por-Padrão.** Superfícies são planas em repouso. Sombra só aparece como resposta a sobreposição (um elemento flutua acima de outro), nunca como brilho decorativo. Se um card tem sombra, está errado: use borda.

## 5. Components

Componentes mínimos e silenciosos: a estrutura é borda de 1px e camada tonal; a cor entra só na ação e no estado.

### Buttons
- **Shape:** cantos discretos (6px, `rounded.md`); botões compactos de tabela usam 4px (`rounded.sm`).
- **Primário:** preenchido em Verde Eleitoral (#1a7a48) com borda da mesma cor, texto branco (`accent-on`), altura 40px, padding lateral 20px, peso semibold. Reservado à ação principal da tela.
- **Hover / Active:** fundo e borda vão para Verde Profundo (#15633a); `active:scale-95` opcional como feedback tátil. Desabilitado: opacity 40%, cursor not-allowed.
- **Secundário / Ghost:** fundo `surface`, borda `border-strong`, texto `ink-2`, altura 38px. Hover: fundo `surface-3`, texto `ink`. É o botão padrão para ações não-destrutivas; o primário é exceção, não regra.

### Chips / Badges
- **Style:** fundo `accent-soft` (#e8f3ec), borda `accent-soft-border` (#bfe0cc), texto `accent` (#1a7a48), cantos 4px. Para badges numéricos usa Geist Mono.
- **State:** o mesmo padrão verde-névoa marca "selecionado" e "dentro do limite"; estado de aviso/erro troca para a família warn/danger.

### Cards / Containers
- **Corner Style:** 6px (`.ds-card`).
- **Background:** `surface` (#ffffff claro), separado do `bg` da página por contraste tonal.
- **Shadow Strategy:** nenhuma. Ver Elevation — a borda faz o trabalho.
- **Border:** 1px `border` (#dde3ea). Nunca borda colorida lateral como acento.
- **Internal Padding:** múltiplos da escala (8/16px).

### Inputs / Fields
- **Style:** altura 40px, fundo `surface`, borda 1px `border-strong` (#c7d0da), cantos 6px, texto 13–14px, placeholder `ink-4`. (`.ds-input`, `.ds-select`.)
- **Focus:** borda vira Verde Eleitoral + anel de 2px `accent-soft` (`box-shadow: 0 0 0 2px var(--accent-soft)`). Select também ganha borda verde no hover.
- **Disabled / spinners:** editor numérico inline esconde os spinners (`.ds-num`).

### Navigation (Sidebar)
- **Style:** sidebar fixa de 248px, fundo `surface`, borda direita 1px. Itens com cantos 6px e borda transparente em repouso.
- **States:** repouso `ink-2` / borda transparente; hover `surface-3` + `ink`; **ativo** fundo `accent-soft`, texto `accent-ink`, borda `accent-soft-border`, semibold, com uma faixa vertical de 3px em Verde Eleitoral marcando a posição. Ícones Lucide acompanham a cor do estado.
- **Mobile:** vira off-canvas (translate-x) com backdrop preto 45% e hambúrguer fixo no topo-esquerdo.

### Focus Ring (componente de assinatura)
Anel de foco global: `outline: 2px solid var(--accent)` com `outline-offset: 1px` em todo elemento interativo. Visível, verde, AA. Nunca remover sem substituir por um equivalente igualmente visível.

## 6. Do's and Don'ts

### Do:
- **Do** usar tokens semânticos sempre (`bg-surface`, `text-ink-2`, `border-border`); eles trocam claro/escuro automaticamente.
- **Do** manter o Verde Eleitoral (#1a7a48) em ≤10% da tela, reservado a ação e estado (A Regra da Voz Única).
- **Do** construir profundidade com camadas tonais (bg → surface → surface-2 → surface-3) e bordas de 1px, não com sombra.
- **Do** aplicar `.num` / numerais tabulares em todo número que alinha em coluna ou muda no tempo.
- **Do** garantir contraste AA (corpo ≥4.5:1, texto grande ≥3:1) e foco visível verde em tudo que é interativo.
- **Do** usar uppercase só em rótulos de ≤4 palavras com tracking.

### Don't:
- **Don't** usar glassmorphism, blur decorativo, gradientes ou texto com gradiente. Banidos pelo sistema (anti-referência do PRODUCT.md).
- **Don't** usar neon, sombras dramáticas ou o template hero-metric de SaaS.
- **Don't** colocar sombra em card, painel ou input; sombra é só para flutuantes sobrepostos (`--shadow-menu`).
- **Don't** usar borda colorida lateral (border-left/right >1px) como acento em cards, listas ou alertas.
- **Don't** repetir grids de cards idênticos como muleta de layout; organize por hierarquia (espaçamento + peso).
- **Don't** introduzir cor fora da identidade institucional; o verde é a âncora, warn/danger são só estado.
- **Don't** escrever cor hex direto no JSX; quebra o espelhamento de tema.
