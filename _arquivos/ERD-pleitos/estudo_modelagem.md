# Estudo: Estrutura de Banco de Dados Relacional — Acompanhamento Orçamentário

## Contexto

O arquivo `estruturaAcompanhamento.csv` descreve uma planilha de acompanhamento
orçamentário (SPLE) em que **um item de despesa** percorre três fases progressivas:

1. **Lançamento das unidades** → a unidade propõe valores
2. **Aprovação do orçamento** → ajustes STIE, COGEL/SIGEPRO e valor aprovado
3. **Execução do orçamento** → SEI/NE, valores estimado/empenhado/pago e datas de envio

A planilha hoje é "plana": cada linha repete os textos de UA, PI, despesa agregada e
item, e carrega **grupos repetidos** de valores por exercício (PIELEI 2022, 2024,
proposta 2026). Isso gera redundância, risco de inconsistência e dificuldade para
adicionar novos exercícios. Este estudo propõe uma **estrutura relacional normalizada
(até 3FN)** com o respectivo **ERD**.

---

## 1. Análise da estrutura atual (forma não normalizada — UNF)

Campos do CSV agrupados por natureza:

| Grupo | Campos |
|-------|--------|
| Classificação | `setor_origem` (UA), `plano_integrado` (PI), `despesa_agregada`, `item_despesa` |
| Referência (repetido por exercício) | `vlr_proposta_n0`+`memoria_calc_n0` (PIELEI 2022), `vlr_proposta_n1`+`memoria_calc_n1` (PIELEI 2024) |
| Proposta alvo | `vlr_proposta_ref` (PROPOSTA TSE 2026) |
| Lançamento | `vlr_unidade`, `memoria_calculo`, `justificativa` |
| Aprovação | `vlr_ajuste_stie`, `vlr_aprovacao_cogel`, `vlr_aprovado` |
| Execução | `nro_sei`, `vlr_estimado`, `vlr_empenhado`, `vlr_pago`, `memoria_calculo_exec`, `justificativa_exec` |
| Datas de envio | `data_envio_dod`, `data_envio_etp`, `data_envio_trpb`, `data_envio_ent_ser` |

**Problemas:** grupos repetidos (`n0`/`n1`/`ref`); textos de classificação repetidos em
cada linha (redundância → anomalias de atualização); mistura de dimensões e fatos na
mesma tabela.

---

## 2. Processo de normalização

### 1FN — eliminar grupos repetidos / valores atômicos
- Os valores por exercício (`n0`, `n1`, `ref`) são um **grupo repetido**. Removê-los para
  uma tabela própria `valor_referencia` (uma linha por exercício de referência).
- Cada coluna passa a conter um único valor atômico (ex.: separar `item` de
  `despesa_agregada`).

### 2FN — eliminar dependências parciais
- Em uma linha de orçamento identificada pela combinação
  (exercício, UA, PI, item de despesa), atributos como o **nome da UA** ou a
  **descrição do item** dependem só de parte da chave → extrair para tabelas de dimensão
  (`unidade_administrativa`, `plano_integrado`, `item_despesa`).

### 3FN — eliminar dependências transitivas
- `item_despesa` depende de `despesa_agregada` (não do item de orçamento) → relacionar
  `item_despesa` → `despesa_agregada` por chave estrangeira, sem repetir a descrição
  agregada nas linhas de orçamento.
- Descrições de exercício (“PIELEI 2022”) ficam só em `exercicio`.

Resultado: **3FN**, sem redundância textual e extensível a novos exercícios sem alterar o
esquema.

---

## 3. Modelo lógico proposto

### Tabelas de dimensão (cadastros)
- **`unidade_administrativa`** — UA / `setor_origem` (`id_ua`, `codigo`, `nome`)
- **`plano_integrado`** — PI (`id_pi`, `codigo`, `descricao`)
- **`despesa_agregada`** (`id_despesa_agregada`, `codigo`, `descricao`)
- **`item_despesa`** (`id_item_despesa`, `id_despesa_agregada` FK, `codigo`, `descricao`)
- **`exercicio`** — ciclo/ano orçamentário (`id_exercicio`, `ano`, `descricao`)

### Tabela núcleo (fato)
- **`item_orcamentario`** — a linha orçamentária de um exercício-alvo.
  PK `id_item_orcamentario`; FKs `id_exercicio`, `id_ua`, `id_pi`, `id_item_despesa`;
  `vlr_proposta_ref` (baseline da proposta); `status` (lançamento/aprovação/execução).
  Chave única: (`id_exercicio`, `id_ua`, `id_pi`, `id_item_despesa`).
  > ⚠️ **Revisado após inspeção dos dados reais 2026 — esta chave NÃO é única na planilha.**
  > Ver a seção *"6. Revisão pós-ingestão"* ao final.

### Resolução do grupo repetido
- **`valor_referencia`** (1:N com `item_orcamentario`) — resolve `n0`/`n1`:
  `id_item_orcamentario` FK, `id_exercicio_ref` FK, `valor_executado`, `memoria_calculo`.

### Tabelas de fase (1:1 com `item_orcamentario`)
- **`lancamento_unidade`** — `vlr_unidade`, `memoria_calculo`, `justificativa`
- **`aprovacao`** — `vlr_ajuste_stie`, `vlr_aprovacao_cogel`, `vlr_aprovado`
- **`execucao`** — `nro_sei`, `vlr_estimado`, `vlr_empenhado`, `vlr_pago`,
  `memoria_calculo_exec`, `justificativa_exec`, `data_envio_dod`, `data_envio_etp`,
  `data_envio_trpb`, `data_envio_ent_ser`

> As fases ficam em tabelas 1:1 separadas (em vez de muitas colunas anuláveis em uma só)
> para refletir o fluxo progressivo e manter cada linha preenchida só quando a fase ocorre.

---

## 4. ERD (Mermaid)

```mermaid
erDiagram
    UNIDADE_ADMINISTRATIVA ||--o{ ITEM_ORCAMENTARIO : "origina"
    PLANO_INTEGRADO        ||--o{ ITEM_ORCAMENTARIO : "classifica"
    ITEM_DESPESA           ||--o{ ITEM_ORCAMENTARIO : "detalha"
    DESPESA_AGREGADA       ||--o{ ITEM_DESPESA       : "agrupa"
    EXERCICIO              ||--o{ ITEM_ORCAMENTARIO : "pertence_a"

    ITEM_ORCAMENTARIO ||--o{ VALOR_REFERENCIA    : "tem_referencias"
    EXERCICIO         ||--o{ VALOR_REFERENCIA    : "referencia"
    ITEM_ORCAMENTARIO ||--|| LANCAMENTO_UNIDADE  : "fase_lancamento"
    ITEM_ORCAMENTARIO ||--|| APROVACAO           : "fase_aprovacao"
    ITEM_ORCAMENTARIO ||--|| EXECUCAO            : "fase_execucao"

    UNIDADE_ADMINISTRATIVA {
        int     id_ua PK
        varchar codigo
        varchar nome
    }
    PLANO_INTEGRADO {
        int     id_pi PK
        varchar codigo
        varchar descricao
    }
    DESPESA_AGREGADA {
        int     id_despesa_agregada PK
        varchar codigo
        varchar descricao
    }
    ITEM_DESPESA {
        int     id_item_despesa PK
        int     id_despesa_agregada FK
        varchar codigo
        varchar descricao
    }
    EXERCICIO {
        int     id_exercicio PK
        int     ano
        varchar descricao
    }
    ITEM_ORCAMENTARIO {
        int     id_item_orcamentario PK
        int     id_exercicio FK
        int     id_ua FK
        int     id_pi FK
        int     id_item_despesa FK
        numeric vlr_proposta_ref
        varchar status
    }
    VALOR_REFERENCIA {
        int     id_valor_referencia PK
        int     id_item_orcamentario FK
        int     id_exercicio_ref FK
        numeric valor_executado
        text    memoria_calculo
    }
    LANCAMENTO_UNIDADE {
        int     id_item_orcamentario PK_FK
        numeric vlr_unidade
        text    memoria_calculo
        text    justificativa
    }
    APROVACAO {
        int     id_item_orcamentario PK_FK
        numeric vlr_ajuste_stie
        numeric vlr_aprovacao_cogel
        numeric vlr_aprovado
    }
    EXECUCAO {
        int     id_item_orcamentario PK_FK
        varchar nro_sei
        numeric vlr_estimado
        numeric vlr_empenhado
        numeric vlr_pago
        text    memoria_calculo_exec
        text    justificativa_exec
        date    data_envio_dod
        date    data_envio_etp
        date    data_envio_trpb
        date    data_envio_ent_ser
    }
```

---

## 5. Notas / próximos passos (fora do escopo atual)
- Os "valores executados" de 2022/2024 idealmente são os próprios `item_orcamentario`
  daqueles exercícios na fase de execução; `valor_referencia` é a forma simples para já.
- Auditoria (usuários, log de alterações, transições de status com data/autor) — fase 2.

---

## 6. Revisão pós-ingestão (dados reais 2026) — o grão real é a linha da planilha

> Adicionado em 2026-06-15, após inspecionar
> `Orçamento Pleitos 2026 - Versão atual (Execução).xlsx` (22 abas de setor, ASCOM→SUE) para a
> implementação da ingestão `.xlsx → Firestore` (coleção `opl_itens`).

**Achado:** a chave que o modelo (seção 3) tratou como única —
`(exercício, UA, PI, item_despesa)` — **não é única na planilha 2026**. Há múltiplas linhas
legítimas com a mesma combinação dos quatro campos:

- 130 linhas de dados → apenas ~100 combinações distintas de `(UA, PI, item_despesa)`
  → **~30 colisões**. Usar a `naturezaDespesa` (código `33.90…` extraído do item) como grão é
  ainda mais grosso (~98 distintos / 32 colisões).
- Exemplo: aba **NFA**, PI `TRE TREINA`, item `33.90.36.28.0069 - INSTRUTORES INTERNOS` aparece
  em **11 linhas**, cada uma um lançamento distinto — memória de cálculo própria ("16 h/a × R$
  565,45", "18 h/a × R$ 505,93", "Treinamento como disseminação", "Conteudistas Res. 23.545"…) e
  valores de lançamento diferentes. **Não são duplicatas nem sub-totais a somar.**

**Interpretação:** a planilha registra propostas/itens no nível de **lançamento individual**, um
grão mais fino que o `item_orcamentario` da seção 3. O que o modelo chamou de "um item" é, na
prática, um **agrupamento** de várias linhas que compartilham `(exercício, UA, PI, item_despesa)`.

**Decisão para a ingestão (Frente C):** preservar **1 documento por linha da planilha** (fidelidade
total = 130 docs). O doc ID em `opl_itens` é a chave natural acrescida de um **sufixo de sequência**
para desambiguar repetições:
`2026__{UA}__{PI}__{naturezaDespesa}__{NN}` (sanitizado).

**Implicações para uma futura normalização relacional (se um dia for feita):**
- A chave única de `item_orcamentario` precisaria de um discriminador adicional (nº de lançamento /
  ordem na planilha), OU
- introduzir uma entidade `lancamento` 1:N abaixo de `item_orcamentario` (cada linha da planilha = um
  `lancamento`, com sua própria memória/valores), mantendo `item_orcamentario` como o agrupamento.

A implementação atual (Firestore, embedding) adota a primeira via (1 doc por linha), que é suficiente
para o dashboard read-only e não exige reabrir o ERD.
