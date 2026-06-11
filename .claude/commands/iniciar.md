# Protocolo de início de sessão — cadastro-eleitoral-rn

Trabalho em computadores diferentes; estes checks garantem que a máquina atual está sincronizada e
com as **contas certas** antes de qualquer build/deploy/push. Este é o projeto **institucional**
(TRE-RN / `eleicoes2026`), então as contas corretas são as **institucionais** (atenção: nesta
máquina há outras contas Google e GitHub logadas). Execute em sequência e reporte cada resultado.

## 1. Estado do git + sincronizar
```bash
git status --short
git fetch && git pull --ff-only
```
- Mostre a branch atual.
- Se houver mudanças locais não commitadas, **avise** antes (não faça stash/commit automático).
- Informe se já estava atualizado ou quais commits novos vieram.

## 2. Dependências
- Se `node_modules/` não existir → avise e sugira `npm install`.
- Se o `git pull` trouxe mudanças em `package-lock.json` → sugira `npm install` antes de buildar.

## 3. Verificar `.env.local`
Verifique se `.env.local` existe na **raiz** do projeto e se os valores **não** são placeholders
(`your-...`, `xxx`, vazio). Liste as chaves presentes **sem exibir os valores** — esperadas:
`NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_STORAGE_BUCKET`,
`_MESSAGING_SENDER_ID`, `_APP_ID`.

Se faltar ou tiver placeholder: aponte `.env.local.example` como referência da estrutura e avise que
os `.env*` são git-ignored (não vêm no clone) — as credenciais precisam ser providas manualmente.
🔴 **BLOQUEADOR (build/deploy)** — sem `.env.local` válido, `src/lib/firebase.ts` sobe com
`NEXT_PUBLIC_FIREBASE_*` indefinidos (Auth/Firestore quebrados). Proíba build/deploy até resolver.

## 4. Verificar Firebase CLI
```bash
firebase login:list
firebase use
```
- Confirme que **`mozart.medeiros@tre-rn.jus.br`** é a conta **ativa** (`Logged in as ...`).
- Confirme que o projeto ativo é **`eleicoes2026-dadoszonas`**.
- 🔴 **BLOQUEADOR (build/deploy)** — se a conta ativa **não for** `mozart.medeiros@tre-rn.jus.br`
  (ex.: as pessoais `mozartdm@gmail.com` / `mozartdm.sistemas@gmail.com`), ou se o projeto ativo não
  for `eleicoes2026-dadoszonas`, um `firebase deploy` falha ou publica no lugar errado. A CLI não
  troca sozinha (é interativo); instrua o usuário a rodar com prefixo `!`:
  `! firebase login:use mozart.medeiros@tre-rn.jus.br` (ou `! firebase login --reauth`) e, se
  preciso, `! firebase use eleicoes2026-dadoszonas`. Proíba build/deploy até a conta/projeto certos.

## 5. Verificar conta GitHub (`gh`)
```bash
gh auth status
git remote -v
```
- Confirme que a conta com `Active account: true` é **`mozartmedeiros-jus`** e que o `origin` aponta
  para `github.com/mozartmedeiros-jus/cadastro-eleitoral-rn`.
- 🔴 **BLOQUEADOR (git push/PR)** — se a conta ativa **não for** `mozartmedeiros-jus` (ex.: a pessoal
  `mozdam-cdd`), `git push`/`gh pr` vão para a conta errada. A troca é interativa; instrua o usuário
  a rodar com prefixo `!`: `! gh auth switch --hostname github.com --user mozartmedeiros-jus`.
  Proíba push/PR até a conta certa estar ativa. **Não** bloqueia build/deploy.

## 6. Carregar contexto do projeto
- Leia `docs/orcamento/ROADMAP.md` — documento **canônico**: **Preâmbulo** (todo o ambiente),
  **Tabela de fases** (o que já foi feito) e o final do **Log de execução**.
- **Não** use o `README.md` como contexto: é o boilerplate do create-next-app (não reflete o projeto).
- Reporte em 2-3 linhas: estado de produção (`https://eleicoes2026-dadoszonas.web.app`) + qual a
  próxima frente/pendência sugerida para esta sessão.

---

## Veredito final

Rode **todos** os 6 checks (são read-only e informativos) e só então conclua, separando os dois
eixos de bloqueio (eles são independentes):

- **build/deploy** — se conta Firebase != `mozart.medeiros@tre-rn.jus.br`, projeto !=
  `eleicoes2026-dadoszonas`, **ou** `.env.local` ausente/placeholder →
  `🔴 PARE build/deploy até resolver: <bloqueadores ativos>`.
- **git push/PR** — se a conta ativa do `gh` != `mozartmedeiros-jus` →
  `🔴 PARE git push/PR até resolver: trocar conta gh`.
- Se nenhum bloqueador ativo, resuma em uma linha: `✓ tudo ok` ou `⚠️ <atenção não-bloqueante>`
  (ex.: `package-lock` mudou → sugerir `npm install`).

> **Nota (fim de sessão):** ao encerrar, atualize o **Log de execução** de `docs/orcamento/ROADMAP.md`
> com o que foi feito. Material de desenvolvimento/arquivado fica em `_arquivos/` (local). Ao mergear
> PRs, só apague a branch depois de confirmar `state: MERGED` via `gh` (apagar a branch de um PR
> aberto o fecha sem merge).
