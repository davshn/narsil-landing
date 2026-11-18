---
title: Um branch atrás do seu remoto
description: 'Como o Narsil Check faz fetch, conta os commits que faltam no seu branch, avisa no topo do painel e os traz com um botão de git pull -r.'
route: check
order: 6
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/words.ts
  - repo: check
    path: hooks/git.ts
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/session.test.tsx
---

## O que faz

Quando você trabalha num branch em que outra pessoa também faz push, é fácil começar uma mudança em cima de um estado antigo e só descobrir isso no próximo push. O Narsil Check avisa antes que isso aconteça.

Toda vez que o painel revisa as bibliotecas do projeto, ele também pergunta ao git se o seu branch está atrás do remoto. Se estiver, um painel vermelho aparece no topo do painel, acima de tudo, em negrito:

> ⚠ La rama feat/login está 3 commits detrás de su remota: actualízala antes de seguir.

Tradução para o português: "O branch feat/login está 3 commits atrás do seu remoto: atualize-o antes de continuar." Logo abaixo há um botão, **Actualizar rama** ("Atualizar branch").

O mesmo botão também fica no fim do painel, centralizado abaixo da última seção, para que você possa fazer pull a qualquer momento, com ou sem aviso. Um clique executa `git pull -r` no branch em uso. Enquanto ele roda, o botão vira o texto esmaecido "Actualizando la rama…" ("Atualizando o branch…"). Quando termina, uma linha acima do botão de baixo diz como foi:

| Linha                                           | Significado                                                |
| ----------------------------------------------- | ---------------------------------------------------------- |
| `Rama feat/login actualizada: rebase hecho`     | Os seus commits locais foram reaplicados sobre os novos.   |
| `Rama feat/login actualizada: ya estaba al día` | Nada a trazer: ele já estava atualizado.                   |
| `Rama feat/login actualizada: Fast-forward`     | Nenhum commit local: o branch só avançou.                  |
| `No pude actualizar la rama: …` (vermelho)      | O git recusou ou falhou; o motivo dado por ele vem depois. |

Depois de um pull bem-sucedido, o painel revisa as bibliotecas de novo, e o aviso some.

Quando não há nada a dizer, nada aparece: sem branch remoto, sem resposta da rede ou com um `HEAD` destacado, o aviso fica oculto, como diz o README.

## Como funciona por dentro

### Onde o código fica

A especificação deste percurso aponta para `hooks/git.ts`, mas esse arquivo não executa o git. Ele contém os helpers puros do pull request de atualização de um guia posterior (`isMainBranch`, `branchName`, `commitTitle`, `prBody`). O fetch, a contagem e o pull estão em `hooks/register.tsx`, e as suas palavras em `hooks/words.ts` (`behindNote`, `pullSummary`, `tail`).

### Dois valores pequenos

O módulo de hooks mantém dois atoms, ambos tipados em `types/index.d.ts`:

- `behind`: `{ status: 'unknown' }` ou `{ status: 'checked', branch, count }`. O que a última revisão encontrou.
- `pull`: `idle`, `running`, `done` com um texto, ou `failed` com uma mensagem. Como terminou o último clique no botão.

O painel desenha a partir desses dois valores e de nada mais. Essa separação é a de sempre no Narsil Check: as funções que fazem o trabalho escrevem um atom, e o hook `ui.render` só lê.

### Contar o que falta

`checkBehind` faz três perguntas ao git, cada uma por meio de `$.process.run` com um tempo limite de dois minutos (`GIT_MS`):

1. `git branch --show-current`. Uma resposta vazia significa um `HEAD` destacado: não há branch para comparar, então o valor fica `unknown`.
2. `git fetch --quiet`. Isso atualiza os branches de rastreamento remoto, para que a contagem seguinte trate do remoto como ele está agora, não como estava no último fetch.
3. `git rev-list --count HEAD..@{upstream}`. `HEAD..@{upstream}` significa "os commits que o upstream tem e que `HEAD` não tem". `--count` transforma isso num único número.

Só um código de saída 0 e um número que pode ser interpretado dão `{ status: 'checked', branch, count }`. Um branch sem upstream faz o `rev-list` falhar, o que deixa `unknown`. Qualquer rejeição (git ausente, um tempo esgotado) é capturada e também deixa `unknown`. O aviso só aparece para `checked` com `count > 0`.

Um detalhe que o README não menciona: o código não confere o código de saída do fetch. Se o fetch falha por falta de rede, mas o branch tem upstream, o `rev-list` ainda conta contra o branch de rastreamento remoto do último fetch bem-sucedido. A contagem pode então estar desatualizada, e pode ser maior que zero. O "sin red … no se muestra nada" ("sem rede … nada aparece") do README vale quando nunca houve um fetch com que comparar, não em todos os casos.

### Quando é verificado

`checkBehind` nunca é aguardado. `scanProject` o inicia com `void checkBehind($).catch(() => undefined)` na sua primeira linha, então a contagem roda junto com a revisão das bibliotecas. Essa revisão roda no início da sessão, em **Revisar de nuevo**, em `/narsil-check upgrade`, depois do botão de atualização, depois do botão de pull request e depois de um pull bem-sucedido. Um projeto sem manifesto para varrer ainda recebe a verificação no início da sessão, por meio de um `else void checkBehind($)` separado: o comentário diz "with nothing to scan, that check still runs" (sem nada para varrer, essa verificação ainda roda).

Não há temporizador. O painel não consulta o remoto periodicamente; ele olha de novo quando você ou o painel fazem algo que revisa o projeto.

### Fazer pull

`pullBranch` é o que os dois botões chamam:

```tsx
async function pullBranch($: EngineInterface): Promise<void> {
  if ((await read($, pull)).status === 'running') return
  await update($, pull, () => ({ status: 'running' }) as Pull)
  const branch = (await read($, session)).branch
  try {
    const ran = await runCommand($, ['git', 'pull', '-r'], PULL_MS)
    const value: Pull =
      ran.exitCode === 0
        ? {
            status: 'done',
            text: `Rama ${branch || 'actual'} actualizada: ${pullSummary(ran.stdout)}`,
          }
        : {
            status: 'failed',
            message:
              tail(ran.stderr || ran.stdout) || `git pull terminó con código ${ran.exitCode}`,
          }
    await update($, pull, () => value)
  } catch (err) {
    await update($, pull, () => ({ status: 'failed', message: errorText(err) }) as Pull)
  }
  void loadSession($, true, false).catch(() => undefined)
  if ((await read($, pull)).status === 'done') void runScan($, true).catch(() => undefined)
}
```

Ele é citado do [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Cada linha é uma decisão:

- **Um pull por vez.** Um segundo clique enquanto um roda não faz nada, e o botão não é desenhado nesse meio-tempo.
- **Dois minutos no máximo** (`PULL_MS = 120_000`). Um pull que baixa muita coisa pode levar mais que os 30 segundos padrão de `$.process.run`.
- **Uma saída diferente de zero é uma resposta.** Os tipos da 2.1.325 dizem que `$.process.run` resolve "once it exits, any exit code" (quando ele termina, com qualquer código de saída) e só rejeita "when the command cannot start or is still running then" (quando o comando não consegue iniciar ou ainda está rodando nesse momento). Então uma recusa é lida de `exitCode`, e o `catch` é para git ausente ou um tempo esgotado.
- **O motivo é o do próprio git.** `tail` mantém as últimas quatro linhas de stderr (ou de stdout quando stderr está vazio), juntas e cortadas em 400 caracteres: onde o git escreve o seu "porquê". Sem nenhuma saída, o texto é "git pull terminó con código N" ("git pull terminou com código N").
- **Depois, ler tudo de novo.** `loadSession` lê de novo o branch e a pasta da sessão. Só um pull bem-sucedido também varre de novo as bibliotecas com `isFresh` ativado, porque o pull pode ter trazido outras versões nos manifestos. Essa nova varredura executa `checkBehind` de novo, que é o que oculta o aviso.

`runCommand` é um pequeno wrapper que o botão de atualização também usa: sem shell, o Windows só inicia algumas ferramentas pelo seu shim `.cmd`, então um comando que não consegue iniciar é tentado de novo como `<command>.cmd`.

`pullSummary` transforma a saída do git em poucas palavras: "up to date" vira `ya estaba al día`, "Successfully rebased" vira `rebase hecho`, "Fast-forward" fica `Fast-forward`, e qualquer outra coisa é a última linha do git.

### Por que `-r`

O histórico mostra que a escolha foi feita duas vezes. A primeira versão do botão, em `b3ad055`, executava `git pull --ff-only`. No mesmo dia, `7b864b6` a trocou por `git pull -r`, "replaying local commits over the remote's" (reaplicando os commits locais sobre os do remoto).

Os commits não dizem por quê. Lendo as duas opções lado a lado: `--ff-only` recusa assim que você tem um único commit local que o remoto não tem, que é o caso comum quando você está atrás num branch compartilhado, então o botão falharia justamente quando é necessário. Um `git pull` simples criaria um commit de merge a cada atualização. Um rebase mantém o histórico numa linha só e mantém os seus commits no topo, o que combina com o que o aviso pede: "atualize-o antes de continuar". Esse raciocínio é uma interpretação da mudança, não uma decisão registrada.

### Por que o mod executa o git por conta própria

Um comentário em `hooks/register.tsx` diz isso: "The mod runs git itself, so the app asks no permission." (o mod executa o git por conta própria, então o app não pede permissão). Um clique num botão do painel já é a decisão da pessoa; passá-lo pela ferramenta Bash do Claude pediria de novo. O README diz o mesmo: "Lo ejecuta el mod directamente, sin pasar por los permisos de la app" ("O mod o executa diretamente, sem passar pelas permissões do app").

Duas coisas vêm junto com isso, ambas dos tipos da 2.1.325. `$.process.run` está marcado como "CLI only" (só na CLI), como o resto do substantivo `process`. E "Git runs with repo hooks off" (o git roda com os hooks do repositório desligados), então os hooks do repositório (um hook `post-merge` ou `post-rewrite`, por exemplo) não rodam neste pull.

### Quando o botão é oferecido, e quando não

O botão de baixo é sempre desenhado, exceto enquanto um pull roda. O botão do painel vermelho só é desenhado junto com o aviso. O código não olha a árvore de trabalho antes de oferecê-lo: ele não confere se há mudanças sem commit nem um rebase em andamento.

Isso é deliberado no sentido de que o git já conhece essas regras. Um pull com rebase e mudanças sem commit em arquivos rastreados é recusado pelo git (a menos que a própria configuração do repositório, como `rebase.autoStash`, diga outra coisa), e o painel mostra o motivo do git em vermelho. O README o descreve assim: "Si git no puede hacerlo (un conflicto o cambios sin commit), lo dice y muestra el motivo" ("Se o git não consegue fazê-lo, um conflito ou mudanças sem commit, ele diz isso e mostra o motivo").

Um conflito é o caso que vale conhecer. Quando o rebase para num conflito, o git sai com erro e deixa o repositório no meio do rebase. O painel mostra o fim da saída do git, e é só isso que ele faz: não executa `git rebase --abort` nem nada mais. Você mesmo resolve o conflito e continua, ou aborta. Como um pull que falhou não faz nova varredura, o aviso fica com a contagem anterior até a próxima revisão.

## Construa com o Claude

Peça ao Claude um aviso que conte os commits que faltam ao seu branch, e um botão que os traga. A única ideia que ele precisa acertar é que "sem resposta" não é zero: um `HEAD` destacado, a falta de upstream ou um comando que falhou mantêm o estado `unknown`, e nada aparece.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No meu mod do Claude Code `my-panel`, adicione ao meu painel um aviso de "atrás do seu remoto". Numa função que nenhum hook aguarda, execute com `$.process.run` (tempo limite de dois minutos) `git branch --show-current`, depois `git fetch --quiet`, depois `git rev-list --count HEAD..@{upstream}`. Guarde o resultado num atom tipado em `types/index.d.ts`: `unknown` para um HEAD destacado, ausência de upstream, uma saída diferente de zero ou uma rejeição; caso contrário, o branch e a contagem. Execute-a no início da sessão. Quando a contagem for maior que zero, desenhe uma caixa com borda vermelha no topo do painel dizendo "O branch X está N commits atrás do seu remoto", com um botão que executa `git pull -r` (tempo limite de dois minutos). Guarde o estado do pull num segundo atom: rodando, concluído com um resumo curto da saída do git, ou falho com as últimas linhas de stderr. Ignore um segundo clique enquanto um roda. Depois de um pull bem-sucedido, execute a verificação de novo. Confira cada API com os tipos do plugin-authoring e teste com `claude-code/testing`, respondendo ao git por meio de um hook `on('process.run', ...)`.

### O que conferir na resposta do Claude

1. A verificação roda `git fetch --quiet` antes de `git rev-list --count HEAD..@{upstream}`, então a contagem fala do remoto como ele está agora.
2. Um `HEAD` destacado, um branch sem upstream, uma saída diferente de zero ou uma rejeição deixam o estado `unknown`. O aviso só aparece com uma contagem acima de zero.
3. A verificação começa com `void` a partir de `session.start` e nunca é aguardada, então um fetch lento não retém a sessão.
4. O botão roda `git pull -r`, não `--ff-only`, com um timeout de dois minutos, e um segundo clique enquanto um pull roda não faz nada.
5. Um pull que falhou mostra as últimas linhas do stderr do git em vermelho. Só um pull bem-sucedido roda a verificação de novo, o que esconde o aviso.

Se uma verificação falhar, diga ao Claude o que você vê: "o pull falhou e o painel não diz por quê".

### Como a pessoa autora pediu

O pedido original do aviso e do botão não foi registrado. Nenhum dos registros de tarefas públicos do narsil-check (`odd/tasks/*.md`) cobre essa funcionalidade.

#### Reconstrução a partir do histórico de commits

A partir de `git log -S checkBehind`, `git log -S pullBranch` e `git log -S "pull -r"` no narsil-check:

- `b3ad055` (2026-11-06) "feat: fold upgrade and vulnerability groups, copy a row on click, show baby Narsil and pull the branch" (recolher os grupos de atualizações e de vulnerabilidades, copiar uma linha com um clique, mostrar a Narsil bebê e fazer pull do branch). A sua mensagem: "Actualizar rama, last in the pane, runs git pull --ff-only through the mod, with no permission prompt." (Actualizar rama, por último no painel, executa git pull --ff-only por meio do mod, sem pedido de permissão). O botão chega, no fim, só com fast-forward.
- `7b864b6` (2026-11-06) "feat: pull the branch with a rebase" (fazer pull do branch com um rebase). A sua mensagem: "Actualizar rama now runs git pull -r, replaying local commits over the remote's, and names a rebase, an up-to-date branch or a fast-forward in its result." (Actualizar rama agora executa git pull -r, reaplicando os commits locais sobre os do remoto, e nomeia no seu resultado um rebase, um branch atualizado ou um fast-forward). A correção pelo caminho: de `--ff-only` para `-r`, e `pullSummary` com os seus três resultados.
- `2b91c7d` (2026-11-13) "feat: return to the default branch after the PR and warn when the branch is behind" (voltar ao branch padrão depois do PR e avisar quando o branch está atrás). A sua mensagem: "Each review fetches and counts the commits the upstream has that HEAD lacks, and shows a red warning at the top of the pane with its own pull button." (cada revisão faz fetch e conta os commits que o upstream tem e que faltam em HEAD, e mostra um aviso vermelho no topo do painel com o seu próprio botão de pull).

O padrão: primeiro um botão manual, o seu comportamento corrigido no mesmo dia e, uma semana depois, o painel aprendendo a dizer quando o botão é necessário, colocando uma segunda cópia dele onde o olhar cai primeiro.

## Código de referência

Esta é uma resposta correta, escrita para este guia. Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

Esta é uma versão reduzida da ideia, escrita para este guia e conferida com os tipos do Claude Code 2.1.325. Foi adaptada de `hooks/register.tsx` do [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Ela deixa de fora a leitura da sessão e a varredura das bibliotecas.

O tipo do estado, em `types/index.d.ts`:

```ts
export type Behind = { status: 'unknown' } | { status: 'checked'; branch: string; count: number }
export type Pull =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; text: string }
  | { status: 'failed'; message: string }

declare module 'claude-code' {
  interface PluginState {
    'my-panel': { behind: Behind; pull: Pull }
  }
}
```

A parte do módulo de hooks, `hooks/register.tsx`:

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'
import type { Behind, Pull } from '../types'

const behind = atom({ plugin: 'my-panel', key: 'behind' } as const, { status: 'unknown' } as Behind)
const pull = atom({ plugin: 'my-panel', key: 'pull' } as const, { status: 'idle' } as Pull)
const GIT_MS = 120_000

export async function checkBehind($: EngineInterface): Promise<void> {
  let value: Behind = { status: 'unknown' }
  try {
    const run = (argv: string[]) => $.process.run(argv, { timeoutMs: GIT_MS })
    const branch = (await run(['git', 'branch', '--show-current'])).stdout.trim()
    if (branch) {
      await run(['git', 'fetch', '--quiet'])
      const counted = await run(['git', 'rev-list', '--count', 'HEAD..@{upstream}'])
      const count = Number.parseInt(counted.stdout.trim(), 10)
      if (counted.exitCode === 0 && Number.isFinite(count))
        value = { status: 'checked', branch, count }
    }
  } catch {
    // Unknown: nothing shows.
  }
  await update($, behind, () => value)
}

const tail = (text: string) => text.trim().split(/\r?\n/).slice(-4).join(' ').slice(0, 400)

export async function pullBranch($: EngineInterface): Promise<void> {
  if ((await read($, pull)).status === 'running') return
  await update($, pull, () => ({ status: 'running' }) as Pull)
  try {
    const ran = await $.process.run(['git', 'pull', '-r'], { timeoutMs: GIT_MS })
    await update($, pull, () =>
      ran.exitCode === 0
        ? { status: 'done', text: tail(ran.stdout) || 'done' }
        : {
            status: 'failed',
            message: tail(ran.stderr || ran.stdout) || `exit code ${ran.exitCode}`,
          },
    )
  } catch (err) {
    await update($, pull, () => ({ status: 'failed', message: String(err) }) as Pull)
  }
  if ((await read($, pull)).status === 'done') void checkBehind($).catch(() => undefined)
}
```

Tradução do comentário para o português: desconhecido, nada aparece.

Inicie a verificação a partir de `session.start` com `void checkBehind($).catch(() => undefined)` antes de `return next(e)`. No hook `ui.render` do painel, leia os dois atoms com `read($, behind)` e `read($, pull)`. Quando `behind` for `checked` com uma contagem maior que zero, desenhe um `Box` com `borderColor` vermelho, um `Text` em negrito com o aviso e um `Button` cujo `onPress` é `() => pullBranch($)`; enquanto `pull` estiver `running`, desenhe um `Text` esmaecido no lugar dele. Desenhe o texto de `pull` em verde quando `done` e a sua mensagem em vermelho quando `failed`.

## Erros comuns e como testar

Estes vêm do código e dos commits do Narsil Check:

- **Contar antes de fazer fetch.** Sem `git fetch`, `HEAD..@{upstream}` compara com o que você buscou por último, talvez há dias. Faça o fetch primeiro.
- **Confiar num fetch que falhou.** Se o fetch falha e você não confere o seu código de saída, a contagem pode estar desatualizada. O Narsil Check aceita isso; uma versão mais rigorosa mantém `unknown` quando o fetch não sai com 0.
- **Tratar "sem resposta" como zero.** Um `HEAD` destacado, a ausência de upstream ou de git não são "atualizado". Mantenha um `unknown` separado e não mostre nada para ele.
- **Aguardar o git num hook.** Um fetch pode levar segundos. Inicie-o com `void`, nunca o aguarde com `await` em `session.start`.
- **`--ff-only` num branch compartilhado.** Ele recusa assim que você tem um único commit local, que é justamente o caso para o qual o aviso existe. Essa é a correção que `7b864b6` fez.
- **Esconder o motivo do git.** Um pull que falha sem dizer por quê deixa a pessoa adivinhando. Mantenha as últimas linhas de stderr, onde o git o escreve.
- **Esquecer o rebase em andamento.** Depois de um conflito, o repositório está no meio de um rebase. Diga isso na mensagem ou, pelo menos, não faça nova varredura como se o pull tivesse funcionado.
- **Dois pulls ao mesmo tempo.** Proteja a função com o estado `running` e oculte o botão nesse meio-tempo.

Para testar, `tests/session.test.tsx` responde ao git por meio de um hook `on('process.run', ...)` indexado pelo vetor de argumentos unido. "a review that finds the branch behind its remote shows a big warning at the top, with the pull at hand" (uma revisão que encontra o branch atrás do seu remoto mostra um aviso grande no topo, com o pull à mão) responde a `git rev-list --count HEAD..@{upstream}` com `3` e espera a caixa vermelha `behind`, o texto exato do aviso e o botão `behind-pull`. "a branch up to date with its remote, or with none, shows no warning" (um branch atualizado com o seu remoto, ou sem nenhum, não mostra aviso) responde `0`. "\"Actualizar rama\", last in the pane, pulls the checked-out branch with a rebase and says how it went" ("Actualizar rama", por último no painel, faz pull do branch em uso com um rebase e diz como foi) confere que `branch-pull` é o último botão, centralizado, e que um clique deixa "Rama feat/login actualizada: rebase hecho". "a pull that fails says why" (um pull que falha diz por quê) espera uma linha que começa com "No pude actualizar la rama: ". "the words of each pull that went well" (as palavras de cada pull que deu certo) testa `pullSummary` com as frases reais do git.

## Para ir além

- O nome do branch na seção **Entorno** abre uma aba de terminal na pasta da sessão (veja o guia do ambiente da sessão), que é onde você resolve um conflito que o pull deixou.
- `@{upstream}` pode ser trocado por `origin/main` para mostrar a que distância um branch de funcionalidade está do branch padrão, uma pergunta diferente com os mesmos três comandos.
- O mesmo `checkBehind` também poderia contar `@{upstream}..HEAD`, os commits que você ainda não enviou, e avisar sobre eles também.
