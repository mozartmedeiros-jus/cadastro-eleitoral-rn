# Product

## Register

product

## Users

Gestores e tomadores de decisão ligados à administração eleitoral do Rio Grande do Norte (coordenadores, analistas seniores, equipe de planejamento do TRE-RN). Usam o sistema em ambiente de escritório, em desktop, para consultar e cruzar estatísticas de locais de votação, seções eleitorais e mesários, montar agregações e apoiar decisões de planejamento eleitoral. O contexto é de trabalho focado com dados densos, não de navegação casual.

## Product Purpose

Dashboard interativo de cadastro e estatística eleitoral do RN. Centraliza dados de locais de votação, seções e mesários, permitindo cadastro, agregações, análises e ciclos de trabalho salvos. Sucesso é o gestor conseguir extrair uma leitura confiável e acionável dos dados com o mínimo de atrito, e confiar que os números estão corretos e atualizados.

## Brand Personality

Institucional, confiável, eficiente e claro. Voz sóbria e oficial, alinhada ao padrão gov.br/DSGov: transmite autoridade do TRE sem rigidez burocrática. A interface serve a tarefa, prioriza densidade de informação para usuários experientes, mas mantém legibilidade e clareza acima de tudo. Três palavras: **institucional, direto, legível**.

## Anti-references

- Estética "SaaS genérico de IA": glassmorphism, blur decorativo, gradientes, texto com gradiente, neon, sombras exageradas. (O CSS atual já bane isso explicitamente — manter.)
- Dashboards "bonitinhos" que sacrificam densidade e precisão por enfeite.
- Cards idênticos repetidos como muleta de layout; hero-metric template de SaaS.
- Cores fora da identidade institucional (o verde eleitoral é o âncora; nada de paletas decorativas).
- Tom de marketing: buzzwords, copy aspiracional. Aqui a copy é factual e operacional.

## Design Principles

- **Dado em primeiro lugar.** Cada elemento de UI existe para tornar um número mais legível ou uma ação mais rápida. Decoração que não serve ao dado sai.
- **Confiança institucional.** Consistência com gov.br/DSGov, contraste alto, superfícies planas e bordas de 1px. A seriedade visual é parte da credibilidade do dado.
- **Densidade sem ruído.** Otimizar para usuários experientes que querem ver muito de uma vez, usando hierarquia (escala, peso, espaçamento) em vez de molduras e caixas para organizar.
- **Legibilidade inegociável.** Numerais tabulares, contraste AA, foco visível. Se está difícil de ler, está errado, por mais elegante que pareça.
- **Tema é função, não enfeite.** Claro/escuro existem para conforto de leitura em diferentes ambientes; os tokens trocam de forma previsível.

## Accessibility & Inclusion

Meta: **WCAG 2.1 AA** (alinhado ao eMAG / padrão de sistemas governamentais brasileiros). Texto de corpo ≥4.5:1, texto grande ≥3:1, foco sempre visível (anel verde acessível já implementado), navegação completa por teclado. Suporte a `prefers-reduced-motion` em qualquer animação introduzida. Numerais tabulares para leitura de tabelas. Não depender só de cor para transmitir estado (usar ícone/rótulo junto).
