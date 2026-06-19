# Conhecendo o projeto — material de apresentação para estagiários

> **Como usar este documento:** cada título `##` é **um slide**. Os bullets são o que vai
> projetado; o bloco **🗣️ Notas do apresentador** é o que você fala em voz alta (não precisa
> aparecer no slide). A linguagem é propositalmente leve — toda palavra técnica é explicada na
> primeira vez que aparece. O documento tem **duas partes**:
> **Parte 1** — uma visão geral do projeto inteiro · **Parte 2** — o passo a passo de como uma
> funcionalidade ("Pontos de Apoio") é construída do zero.

---

## Slide 1 — Capa

- **Sistema de Cadastro e Estatística Eleitoral — TRE-RN**
- Uma conversa para quem está começando
- Hoje vamos ver: **(1)** o projeto por cima e **(2)** como se constrói uma tela nova

🗣️ **Notas do apresentador:** "A ideia de hoje não é decorar tecnologia, é entender *como as peças
se encaixam*. Primeiro vou mostrar o sistema de longe, depois a gente desce e constrói uma
funcionalidade real, passo a passo. Pode perguntar a qualquer momento."

---

## Slide 2 — Roteiro

- **Parte 1:** o que é o sistema, quem usa, e de que ele é feito
- **Parte 2:** receita de construção da tela "Pontos de Apoio"
- No fim: glossário e "agora é a sua vez"

🗣️ **Notas:** "São dois blocos. O primeiro é panorâmico — sem código. O segundo é mão na massa, mas
explicado devagar. Se algum termo soar estranho, anota que tem um glossário no final."

---

# PARTE 1 — O projeto por cima

## Slide 3 — O que é o sistema (em uma frase)

- Um **painel web** (site) do TRE-RN para **consultar estatísticas eleitorais** e **acompanhar o
  orçamento**
- Quem usa: **gestores e analistas do Tribunal** — pessoas que tomam decisões com base em números
- Roda no navegador, no computador do trabalho

🗣️ **Notas:** "Pensa num painel de controle: a pessoa abre o site e vê números organizados —
quantos eleitores tem em cada local de votação, como está o orçamento das eleições. Não é um app de
celular para o público; é uma ferramenta de trabalho interna."

---

## Slide 4 — O problema que ele resolve

- Antes: dados espalhados em **planilhas** e ferramentas separadas
- Agora: tudo num lugar só, **confiável** e **atualizado**
- Objetivo: o gestor olhar e **confiar no número** sem retrabalho

🗣️ **Notas:** "O grande valor aqui é confiança. Quando um número aparece na tela, ele precisa estar
certo e atual — porque alguém vai tomar decisão em cima dele. Por isso o projeto é caprichado em
organização e em deixar claro de onde cada dado veio."

---

## Slide 5 — As três frentes do sistema

- **Cadastro / Estatística** — eleitores, seções e locais de votação
- **Orçamento SERPRO** — empenhos (gastos já registrados oficialmente)
- **Gestão SPLE** — o planejamento orçamentário interno (proposta → aprovação → execução)
- São três "áreas" dentro do **mesmo** site

🗣️ **Notas:** "O sistema cresceu em três frentes. A primeira é estatística eleitoral. As outras duas
são sobre dinheiro: uma mostra os gastos já oficializados, a outra acompanha o planejamento desde a
proposta. Não precisa decorar — só saber que convivem no mesmo lugar."

---

## Slide 6 — Como um site funciona (bem por cima)

- **Navegador** (Chrome, Firefox): mostra a tela e responde aos cliques
- **Dados**: de onde vêm os números (banco de dados, planilhas)
- **Hospedagem**: o "endereço" onde o site mora na internet
- Esses três conversam o tempo todo

🗣️ **Notas:** "Todo site tem essas três peças. A tela que você vê, os dados que aparecem nela, e o
lugar onde o site fica guardado para qualquer um acessar. O resto da apresentação é só dar nome a
cada uma dessas peças no nosso projeto."

---

## Slide 7 — A tela (o "frontend")

- **Next.js** — a "estrutura" que organiza as páginas do site
- **React** — monta a tela em **componentes** (pecinhas reutilizáveis, tipo Lego)
- **Tailwind** — o jeito de **estilizar** (cores, espaços, tamanhos)

🗣️ **Notas:** "Frontend é tudo que o usuário vê. React é a estrela: a gente quebra a tela em
pecinhas — um botão, uma tabela, um cartão — e monta como Lego. Next.js é a caixa que organiza essas
pecinhas em páginas. Tailwind é a maquiagem: cor, tamanho, espaçamento."

---

## Slide 8 — De onde vêm os dados

- **Firebase Authentication** — o **login** (entra com a conta Google do Tribunal)
- **Firestore** — o **banco de dados** (onde os números ficam guardados)
- **Planilhas / CSV** — algumas telas leem direto de uma planilha Google

🗣️ **Notas:** "Os dados têm três origens. O login controla *quem* pode ver o quê. O Firestore é o
banco onde a maior parte mora. E, curiosidade: tem tela que lê direto de uma planilha publicada —
isso vai ser o foco da Parte 2."

---

## Slide 9 — Onde o site mora

- **Firebase Hosting** — o servidor que entrega o site na internet
- Endereço de produção: **eleicoes2026-dadoszonas.web.app**
- **Deploy** = o ato de **publicar** uma versão nova lá

🗣️ **Notas:** "Quando terminamos uma mudança, fazemos o *deploy*: subimos a versão nova para o
Firebase Hosting, e aí qualquer pessoa com o link já vê. Antes do deploy, a mudança só existe no
nosso computador."

---

## Slide 10 — Um detalhe importante: site "estático"

- O nosso site é **estático** (também chamado **SPA**, *Single Page Application*)
- Significa: o site é um **pacote pronto** de arquivos; o navegador é que monta tudo
- Vantagem: **rápido e barato** de hospedar
- Os dados continuam vindo "ao vivo" do Firestore/planilhas

🗣️ **Notas:** "Estático aqui não quer dizer 'sem dados ao vivo'. Quer dizer que o site é um pacote
de arquivos prontos, sem um servidor processando a cada acesso. O navegador baixa o pacote e busca
os dados sozinho. É leve e confiável — só tem um detalhe sobre atualizações que vou comentar no
glossário (a palavra 'chunk')."

---

## Slide 11 — Por que tudo parece tão padronizado (Design System)

- Seguimos o padrão visual do **gov.br / DSGov** — sóbrio e institucional
- **Verde eleitoral** aparece em **no máximo ~10%** da tela (só ação e destaque)
- Usamos **tokens** (nomes de cor, não código de cor) → o tema claro/escuro troca sozinho
- Regra de ouro: **nunca** escrever a cor "na mão" no código

🗣️ **Notas:** "Reparem que todas as telas têm a mesma cara. Isso é de propósito: é um sistema de
governo, tem que passar seriedade. A gente não escolhe cor por gosto — usa uma paleta fixa com
nomes ('tinta', 'superfície', 'verde'). Assim o modo escuro funciona de graça e ninguém inventa
moda."

---

## Slide 12 — Como a gente trabalha (o fluxo)

- **git** — guarda o histórico de todas as mudanças (uma "máquina do tempo" do código)
- **branch** — uma cópia paralela para mexer sem quebrar o que está no ar
- **PR (Pull Request)** — pedir para juntar a sua mudança à versão principal (com revisão)
- **deploy** — publicar em produção

🗣️ **Notas:** "Ninguém mexe direto na versão principal. A gente cria uma *branch* (um galho), faz a
mudança lá, abre um *PR* para alguém revisar, e só depois junta tudo e publica. É como rascunhar num
caderno separado antes de passar a limpo no documento oficial."

---

## Slide 13 — Glossário amigável

- **Componente**: uma pecinha de tela reutilizável (botão, tabela…)
- **Build**: "montar o pacote" final do site a partir do código
- **Deploy**: publicar esse pacote em produção
- **Chunk**: um pedacinho do site que o navegador baixa sob demanda
- **Token**: um nome para uma cor/medida (em vez do código dela)
- **CSV**: arquivo de tabela simples, separado por vírgulas

🗣️ **Notas:** "Esse slide fica de referência. O único 'pega' é *chunk*: como o site é dividido em
pedacinhos, logo depois de um deploy uma aba antiga pode pedir um pedaço que mudou de nome — a gente
já tratou isso para a página se recarregar sozinha. Detalhe de bastidor, mas bom saber."

---

# PARTE 2 — Construindo a tela "Pontos de Apoio"

## Slide 14 — O que vamos construir

- Uma **nova visão** dentro da página de Estatística (a página inicial, `/`)
- Mostra os **locais de ponto de apoio** e **pontos de transmissão** das eleições
- É um ótimo exemplo porque é **autocontido**: não precisa de banco nem de login

🗣️ **Notas:** "Escolhi essa feature de propósito: ela é pequena e completa. Tem fonte de dados,
tela, filtros, tabela — o ciclo inteiro de construir algo — mas sem as partes mais complexas de
banco e permissão. Perfeita para entender o caminho de ponta a ponta."

---

## Slide 15 — Passo 0: entender o objetivo

- Pergunta de partida: **o que o usuário precisa ver?**
- Resposta: uma lista pesquisável de locais, com **zona, município, endereço, funcionamento**
- E sinalizar quais são **ponto de transmissão** e quais são **ponto de apoio**

🗣️ **Notas:** "Antes de qualquer código, a primeira pergunta é sempre 'o que a pessoa precisa ver e
fazer aqui?'. Sem isso, a gente constrói a coisa errada com capricho. Aqui o objetivo é: listar
locais e deixar filtrar/buscar."

---

## Slide 16 — Passo 1: escolher a fonte de dados

- A lista mora numa **planilha Google**, publicada como **CSV** (link público)
- A tela **busca esse CSV ao vivo** toda vez que abre
- **Por que assim?** Sem banco, sem importação manual, e combina com o site estático
- Bônus: quem mantém a planilha **não precisa saber programar**

🗣️ **Notas:** "Decisão de arquitetura importante e simples: em vez de colocar isso no banco, a gente
lê direto de uma planilha publicada. A equipe atualiza a planilha como sempre fez, e o site reflete.
Menos peças, menos erro. Essa é a mentalidade do projeto: a solução mais simples que resolve."

---

## Slide 17 — Passo 2: desenhar o formato do dado

- Definimos um "molde" do que é **um** ponto de apoio (`interface PontoApoio`)
- 7 campos: **zona, município, local, endereço, funcionamento, transmissão, apoio**
- Lemos a planilha **por posição da coluna** (1ª, 2ª, 3ª…), não pelo nome
- *Por quê?* O cabeçalho da planilha tem nomes repetidos — posição é mais seguro

🗣️ **Notas:** "Antes de buscar, a gente combina o formato: quais campos existem e de que tipo. Aqui
teve um detalhe real — a planilha tem duas colunas chamadas 'PONTO DE APOIO'. Se a gente lesse pelo
nome, daria confusão. Então lemos pela posição. É o tipo de decisão pequena que evita bug chato."

---

## Slide 18 — Passo 3: a "biblioteca" que busca os dados

- Arquivo `src/lib/pontos-apoio-csv.ts` — separa a **lógica de dados** da tela
- Função `fetchPontos()`: baixa o CSV, lê linha por linha, devolve a lista pronta
- **Cache-busting**: adiciona a hora atual no link para **sempre pegar a versão mais nova**
- Se a busca falhar, **avisa com um erro claro** (não quebra calado)

🗣️ **Notas:** "Boa prática: a parte que *busca e entende* o dado fica num arquivo só dela, separada
da tela. Assim a tela só se preocupa em mostrar. O 'cache-busting' é um truquezinho: o navegador
adora reaproveitar arquivos antigos, então a gente força ele a buscar o atual colocando a hora no
endereço."

---

## Slide 19 — Passo 4: construir a tela (estados)

- Componente `PontosApoioPanel.tsx` — a tela em si
- Toda tela que busca dado tem **três momentos**:
  - **Carregando** → mostra um spinner ("Carregando pontos de apoio…")
  - **Erro** → mostra um cartão explicando o que houve
  - **Pronto** → mostra os dados
- Cuidar dos três é o que separa amador de profissional

🗣️ **Notas:** "Esse é um dos aprendizados mais importantes da apresentação. Buscar dado leva tempo e
pode falhar. Se você só programa o 'deu certo', a tela fica em branco ou trava quando algo dá
errado. A gente sempre trata os três estados: carregando, erro e sucesso."

---

## Slide 20 — Passo 5: indicadores, filtros e busca

- **KPIs** (cartões de número): total de locais, de transmissão, de apoio
- **Filtros**: por **zona**, por **município**, por **característica**
- **Busca**: digitar parte do local ou do endereço
- Tudo recalcula **na hora**, conforme o usuário mexe

🗣️ **Notas:** "Em cima, três cartões com os números que importam. Embaixo, os controles para a
pessoa fatiar os dados do jeito dela. O segredo é que isso tudo é recalculado instantaneamente —
mudou o filtro, a lista e os números se ajustam sozinhos."

---

## Slide 21 — Passo 6: tabela, paginação e badges

- A **tabela** lista os locais com colunas organizadas
- **Paginação**: mostra de 50 em 50 (dá para escolher) — não trava com lista grande
- **Badges** (etiquetas): "Sim / Incluir / Alterar / Excluir"
- Usamos **ícone + cor** juntos (nunca só cor) → **acessibilidade**

🗣️ **Notas:** "Listas grandes a gente nunca mostra de uma vez — pagina. E reparem nas etiquetas
coloridas: cada situação tem uma cor *e* um ícone. Isso não é enfeite: quem não distingue bem cores
precisa do ícone para entender. É regra de acessibilidade, e a gente leva a sério."

---

## Slide 22 — Passo 7: encaixar na página de Estatística

- A página `/` tem um **seletor de visão**: "Pessoal de apoio | Pontos de Apoio | MRJ"
- Escolher "Pontos de Apoio" troca a área inteira para a nossa tela nova
- Ganha dois botões: **Atualizar** (rebusca o CSV) e **Exportar CSV** (baixa a lista)

🗣️ **Notas:** "A tela nova não vira uma página separada — ela entra como uma 'aba' dentro da
Estatística. O usuário clica em 'Pontos de Apoio' e pronto. O botão Atualizar existe porque o dado
vem ao vivo: se a planilha mudou, a pessoa atualiza sem recarregar o site."

---

## Slide 23 — Passo 8: seguir o design system

- Reusamos os mesmos **tokens** de cor e os componentes-padrão (`.ds-card`, `.ds-input`…)
- **Zero** cor escrita "na mão" → tema claro/escuro funciona de graça
- Resultado: a tela nova **já nasce** com a cara do sistema

🗣️ **Notas:** "Aqui fecha o ciclo com a Parte 1: como a gente usou os tokens e os componentes
prontos, a tela nova ficou idêntica ao resto sem esforço extra. Padronização não é burocracia — é o
que faz uma pessoa sozinha entregar algo consistente."

---

## Slide 24 — Passo 9: testar e publicar

- **Testar**: rodar o `build` (montar o pacote) e conferir que não quebrou nada
- **Publicar**: `deploy` para o Firebase Hosting
- Antes disso: **branch → PR → revisão** (como vimos no fluxo)

🗣️ **Notas:** "Por último, o caminho que toda mudança percorre: testa localmente, abre o PR para
revisão, e só então publica. Nada vai para produção sem passar por aqui. É o que mantém o site no ar
funcionando enquanto a gente evolui."

---

## Slide 25 — Recapitulando o fluxo

1. **Objetivo** — o que o usuário precisa
2. **Dado** — de onde vem (planilha → CSV)
3. **Lib** — o arquivo que busca e entende o dado
4. **Tela** — carregando / erro / pronto + filtros + tabela
5. **Integrar** — encaixar na página
6. **Publicar** — build → PR → deploy

🗣️ **Notas:** "Se vocês levarem só uma coisa de hoje, que seja essa sequência. Praticamente toda
funcionalidade nasce assim: entender, achar o dado, separar a lógica, montar a tela tratando os
estados, encaixar e publicar. Muda o assunto, o caminho é o mesmo."

---

## Slide 26 — Agora é a sua vez

- Explore o site em produção: **eleicoes2026-dadoszonas.web.app**
- Abra o código da feature: `src/lib/pontos-apoio-csv.ts` e `PontosApoioPanel.tsx`
- Sugestão de exercício: **adicionar um novo filtro** seguindo o mesmo padrão
- Dúvida é bem-vinda — ninguém começou sabendo

🗣️ **Notas:** "Tarefa para fixar: peguem o filtro de zona como modelo e tentem imaginar como
adicionariam um filtro novo. Não precisa acertar de primeira — a ideia é reconhecer o padrão. E
perguntem à vontade."
