# Redesign institucional — componentes prontos para colar

Redesenho **somente da camada visual** (markup + classes Tailwind + tokens em CSS) das telas
**Estatística** e **Agregações**. Toda a lógica — props, estado, hooks, handlers, ordenação,
filtros em cascata, paginação, export CSV, edição com draft + commit e a integração
**Firebase (auth/Firestore)** — foi preservada **verbatim**.

## Arquivos

| Arquivo | Cola em | Observação |
|---|---|---|
| `globals.css` | `src/app/globals.css` | Substitui o atual. Sistema de tokens DSGov (claro/escuro). |
| `CadastroClient.tsx` | `src/app/CadastroClient.tsx` | Tela Estatística. Assinatura `{ initialData }` inalterada. |
| `AgregacoesClient.tsx` | `src/app/agregacoes/AgregacoesClient.tsx` | Tela Agregações. Assinatura `{ initialData }` inalterada. |

`page.tsx`, `agregacoes/page.tsx`, `layout.tsx`, `Sidebar.tsx` e `ThemeProvider.tsx`
**não precisam mudar**. Os imports `@/lib/firebase` (`auth, db, googleProvider, isAdmin, makeRowId`)
continuam idênticos.

## Como funciona o tema (importante)

O `globals.css` usa **Tailwind v4 com tokens em CSS variáveis**:

```css
@custom-variant dark (&:where(.dark, .dark *));   /* habilita o dark: pela classe .dark */
:root { --surface: #fff; --ink: #14181d; --accent: #1a7a48; … }   /* claro */
.dark { --surface: #161b21; --ink: #e8edf2; --accent: #3fae72; … }  /* escuro */
@theme inline { --color-surface: var(--surface); --color-ink: var(--ink); … }
```

`@theme inline` gera utilitários (`bg-surface`, `text-ink`, `text-ink-3`, `border-border`,
`text-accent`, `bg-accent`, `bg-accent-soft`, `text-danger`…) que **trocam sozinhos** quando o
`next-themes` põe/retira a classe `.dark` no `<html>` — exatamente a configuração já existente
(`<ThemeProvider attribute="class" defaultTheme="light" enableSystem>`). Não há `tailwind.config`.

A fonte continua a **Geist** já carregada no `layout.tsx` (grotesca neutra/técnica) — nada a fazer.

## Tokens (paleta institucional)

- **Verde eleitoral** é o único destaque: `--accent` (`#1a7a48` claro / `#3fae72` escuro).
- Superfícies planas em camadas: `bg`, `surface`, `surface-2`, `surface-3`.
- Hairlines: `border`, `border-strong`, `border-faint`.
- Texto em 4 níveis: `ink` › `ink-2` › `ink-3` › `ink-4`.
- Semânticos dessaturados para alerta: `warn`, `danger` (usados só em estados de “limpar” e badge ≤50).

Sem glass, blur, gradiente, neon ou sombra pesada. Cantos discretos (4–8px). Contraste mirando AA.

## O que mudou visualmente (sem mexer em dados)

**Estatística**
- KPIs separados em **Indicadores-base** (5, com barra verde) e **Valores calculados** (8, painel
  secundário). Mesmos rótulos e valores de antes (Zonas, Municípios, Locais, Total de Seções,
  Eleitores Aptos · Mesários MRV, ADM Prédio, Coord. Acess., Aux. Serv., Mesa MRJ, Mesários MRJ,
  Ponto de Apoio, ADM Prédio Extra).
- Mesmas 13 colunas, ordenação, linha expansível, edição inline de **Mesa MRJ** / **Ponto de Apoio**,
  paginação e **Exportar CSV** (cabeçalhos e ordem de colunas do CSV idênticos).

**Agregações**
- Filtros em cascata, toggle **Todos/Marcados**, **Parâmetros de Cálculo (Capital/Interior)** com
  botão **Calcular**, badges por faixa e colunas editáveis **AGREGAR**/**TOTAL** — tudo preservado.
- Badges agora são **sutis**: cor só na borda/texto sobre fundo neutro (faixas: ≤50 vermelho,
  ≤limite verde, acima neutro).

### Únicas adições — puramente apresentacionais (sem props/estado/Firebase novos)
1. Cabeçalhos de seção “Indicadores-base / Valores calculados” (Estatística).
2. Tira **Resumo da agregação** (Locais / Seções / Seções agregadas / Total) derivada apenas dos
   dados já filtrados em memória (Agregações).
3. Ícones extras do `lucide-react` (todos já da mesma lib): `ChevronLeft/Right`, `ArrowUpDown`,
   `X`, `SlidersHorizontal`, `MapPin`, `BarChart3`.

Se preferir não exibir os itens 1–2, basta remover os blocos `SectionHead` / “Resumo da agregação”.

## Checklist de verificação
- [ ] `npm run dev` — alternar tema Claro/Escuro/Sistema nas duas telas.
- [ ] Login admin → editar Mesa MRJ / Ponto de Apoio / AGREGAR / TOTAL (blur e Enter persistem).
- [ ] Filtros em cascata, ordenação por coluna e paginação.
- [ ] Exportar CSV abre com os mesmos campos de antes.
