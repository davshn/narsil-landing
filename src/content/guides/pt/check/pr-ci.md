---
title: O CI do seu PR
description: 'Como o Narsil Check acompanha os passos do GitHub Actions do pull request da sessão com a CLI gh, a cada 10 segundos enquanto uma execução roda, e para quando ela termina.'
route: check
order: 4
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/ci.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/session.ts
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/ci.test.tsx
  - repo: check
    path: tests/session.test.tsx
---

## O que faz

Quando a sessão tem um pull request aberto, a seção **Entorno** mostra um recolhimento **CI** abaixo do interruptor de Remote Control. Ele acompanha a execução do GitHub Actions do commit mais novo do pull request, passo a passo, para que você possa observar as verificações sem abrir o navegador.

O cabeçalho do recolhimento diz de relance em que ponto o CI está:

| Cabeçalho                              | Significado                                                             |
| -------------------------------------- | ----------------------------------------------------------------------- |
| `CI · 2/4 · Typecheck`                 | Rodando: dois de quatro passos feitos, `Typecheck` rodando agora.       |
| `CI · pasó`                            | Passou.                                                                 |
| `CI · falló`                           | Falhou.                                                                 |
| `CI · esperando el CI del último push` | Esperando: o seu branch tem um commit que nenhuma execução pegou ainda. |
| `CI · sin ejecuciones`                 | Nenhuma execução para este branch.                                      |
| `CI · sin leer`                        | Não lido: o `gh` não conseguiu responder, e o motivo aparece abaixo.    |

Aberto, ele lista os passos com uma marca nas cores da Narsil:

- `✓` verde: feito.
- `✗` vermelho: falhou, foi cancelado, esgotou o tempo, está esperando uma ação ou não conseguiu começar.
- `◐` amarelo: rodando.
- `○` cinza: na fila ou esperando.
- `–` cinza: ignorado ou neutro.

Os passos de controle do próprio GitHub (`Set up job`, `Complete job`, `Post …`) ficam de fora, já que não dizem nada sobre o projeto. Com vários workflows, o nome de cada execução encabeça os seus passos; com vários jobs, cada job aparece com a sua própria marca.

Enquanto uma execução roda, o recolhimento pergunta de novo a cada 10 segundos, e para de perguntar assim que o CI termina. O recolhimento fica como você o deixou: o início da sessão não o redefine, e o comentário do código diz que ele mantém como você o deixou entre sessões (o primeiro guia explica o que os tipos dizem sobre isso). Enquanto ele está recolhido, nada é perguntado.

## Como funciona por dentro

### Qual pull request, qual repositório

O recolhimento de CI não procura um pull request por conta própria. Ele usa aquele que o app de desktop vinculou à sessão, lido nos guias anteriores por meio de `$.mcp.call('ccd_pr', 'get_status', { session_id: 'self' })`. `parsePr` em `hooks/session.ts` guarda, para um pull request aberto, a sua url, o seu repositório (`prRepo`, dono e nome, como `acme/shop`) e o seu branch de origem (`prHead`).

O recolhimento só é desenhado quando `view.prUrl` está definido. Então ele só existe no app de desktop, onde `ccd_pr` existe; a tabela de superfícies do README diz o mesmo.

### Perguntar ao `gh`

A parte pura fica em `hooks/ci.ts`: ela monta os comandos e lê a saída deles. O módulo de hooks os executa em `readCi`, em `hooks/register.tsx`.

Primeiro, as execuções do branch:

```ts
export function runListArgv(repo: string, branch: string): string[] {
  return [
    'gh',
    'run',
    'list',
    '--repo',
    repo,
    '--branch',
    branch,
    '--json',
    RUN_FIELDS,
    '--limit',
    '20',
  ]
}
```

`RUN_FIELDS` é `'databaseId,headSha,workflowName,status,conclusion'`. O `gh` lista as mais novas primeiro, então `latestRuns` toma o commit da primeira execução (`headSha`) como o mais novo, mantém só as execuções desse commit e mantém uma por nome de workflow. As execuções de commits mais antigos nunca se misturam com a atual.

Depois, para cada uma dessas execuções, os seus jobs e passos:

```ts
export function runViewArgv(repo: string, id: number): string[] {
  return ['gh', 'run', 'view', String(id), '--repo', repo, '--json', 'jobs']
}
```

`jobsOf` lê o nome, o estado, a conclusão e os passos de cada job, e descarta os passos de controle com uma única expressão regular, `NOISE = /^(Set up job|Complete job|Post .+)$/`.

Os estados do CI são os do GitHub: um `status` (`queued`, `in_progress`, `completed`) e, depois de concluído, uma `conclusion`. `markOf` transforma esse par numa marca e numa cor, e a lista de conclusões de falha (`FAILED`) é a mesma em todo lugar: na marca de um passo, no cabeçalho (`ciLabel`) e na própria marca do recolhimento (`ciMark`).

### `$.process.run`, como o código o usa

Os tipos da 2.1.325 descrevem `$.process.run(argv, init)` como a execução de "a command on the host by its argument vector (no shell)" (um comando no host pelo seu vetor de argumentos, sem shell), que resolve `{ exitCode, stdout, stderr }` "once it exits, any exit code" (assim que ele termina, com qualquer código de saída). O tempo limite é de 30 segundos por padrão e de dez minutos no máximo; o Narsil Check passa `GH_MS`, 30 segundos. Ela é rejeitada quando o comando não consegue começar ou ainda está rodando quando o tempo limite chega. Os tipos também marcam o substantivo `process` inteiro como "CLI only" (só na CLI).

Duas coisas decorrem disso, e o código trata as duas:

- **Uma saída diferente de zero é uma resposta, não uma exceção.** `readCi` confere `list.exitCode !== 0` e guarda o stderr do `gh` como o erro, ou "gh terminó con el código N" ("o gh terminou com o código N") quando o stderr está vazio.
- **Um `gh` ausente é uma exceção.** A chamada é rejeitada, o `catch` em torno de `readCi` guarda a mensagem, e o recolhimento a mostra.

Como o vetor de argumentos não tem shell, os nomes do repositório e do branch vão para o `gh` como argumentos simples: não há nada para pôr entre aspas nem escapar.

Há um motivo para executar o `gh` em vez de chamar a API HTTP do GitHub a partir do mod: o `gh` traz o próprio login da pessoa, então o mod nunca guarda um token do GitHub. Um comentário em `hooks/register.tsx` dá um motivo relacionado para executar o próprio git em "Actualizar rama" (atualizar branch): "The mod runs git itself, so the app asks no permission." (o mod executa o próprio git, então o app não pede nenhuma permissão).

### Esperar por um push

Logo depois de um `git push`, o GitHub pode ainda não ter iniciado uma execução para o novo commit, e a lista ainda mostra a execução do commit anterior, talvez já verde. Mostrar "passou" nesse momento estaria errado.

Por isso, quando o branch em uso é o branch de origem do pull request, `readCi` também executa `git rev-parse @{upstream}`. Se o commit do upstream não é o commit das execuções listadas, um push mais novo ainda não tem execução, e a visão é marcada como `isWaiting`: o cabeçalho diz "esperando el CI del último push" ("esperando o CI do último push") e a marca fica amarela.

### A cada 10 segundos, e depois não mais

A consulta periódica é `watchCi`, um loop:

```tsx
let ciWatch = 0
async function watchCi($: EngineInterface): Promise<void> {
  const id = ++ciWatch
  let waits = 0
  for (;;) {
    const view = await read($, session)
    if (!view.prUrl || !(await read($, isCiOpen))) return
    await update($, ci, (current) =>
      current.status === 'ready' ? current : { ...current, status: 'loading' },
    )
    let next = await readCi($, view)
    if (id !== ciWatch) return
    // A push no workflow answers (a repository with no CI for it) stops waiting.
    if (next.isWaiting && ++waits > CI_WAIT_POLLS) next = { ...next, isWaiting: false }
    await update($, ci, () => next)
    if (next.error || !(next.isWaiting || isGoing(next.runs))) return
    await $.clock.sleep(CI_POLL_MS)
    if (id !== ciWatch) return
  }
}
```

Tradução do comentário para o português: um push ao qual nenhum workflow responde (um repositório sem CI para ele) para de esperar.

Ele é citado do [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Cada linha é uma regra:

- **Sem pull request, ou com o recolhimento fechado: parar.** Nada é perguntado enquanto você não está olhando.
- **Manter a última resposta enquanto recarrega.** Uma visão que já está `ready` fica como está durante a próxima leitura, para que os passos não pisquem.
- **Uma observação de cada vez.** Cada chamada recebe um novo `id`. Uma observação mais nova (da próxima leitura da sessão, de um pull request encontrado tarde ou da abertura do recolhimento) faz a antiga parar na sua próxima conferência.
- **Um push ao qual ninguém responde encerra a espera.** `CI_WAIT_POLLS` é 12, então, depois de cerca de dois minutos, um repositório sem workflow para aquele push para de esperar.
- **Parar num erro, ou quando nada está rodando e nada é esperado.** `isGoing` é verdadeiro enquanto o estado de alguma execução não é `completed`.
- **Caso contrário, esperar `CI_POLL_MS`, 10 segundos, com `$.clock.sleep`.** Os tipos o descrevem como algo que resolve "after `ms` milliseconds" (depois de `ms` milissegundos).

Os tipos também oferecem `$.clock.every(ms, fn)`, que chama `fn` a cada período até ser cancelado. O loop com `sleep` tem uma propriedade que se encaixa neste caso: a próxima leitura só começa depois que a anterior terminou, então chamadas lentas ao `gh` nunca se sobrepõem, e o loop termina sozinho na condição que acabou de ler.

A observação é iniciada com `void watchCi($)` depois de uma leitura completa da sessão, depois de um pull request encontrado tarde, e quando você abre o recolhimento. Ela nunca é aguardada por um hook.

### Quando o `gh` falta ou não tem login

Os dois casos terminam da mesma forma. A visão recebe um `error`, o cabeçalho diz `CI · sin leer`, a marca é um `○` cinza, e o recolhimento aberto mostra em vermelho "No pude leer el CI con gh: …" ("não consegui ler o CI com o gh: …") seguido do motivo: a mensagem do motor quando o `gh` não conseguiu começar, ou o próprio stderr do `gh` quando ele rodou e recusou, como faz quando não tem login. O loop para no erro; a próxima leitura da sessão ou a abertura do recolhimento tentam de novo.

Sobre permissões, o README diz apenas que o `gh` precisa estar instalado e com login feito ("con `gh` instalado y con sesión iniciada", "com o `gh` instalado e com sessão iniciada"). Nem o README nem o código listam escopos para ler o CI. A nota do README sobre a permissão `workflow` trata de fazer push de mudanças em `.github/workflows` por HTTPS, uma funcionalidade diferente.

## Como foi pedido à IA

O pedido original do recolhimento de CI não foi registrado. Nenhum dos registros de tarefas públicos do narsil-check (`odd/tasks/*.md`) trata dele.

### Reconstrução a partir do histórico de commits

A partir de `git log -- hooks/ci.ts`, com os commits relacionados em `hooks/register.tsx` e `hooks/session.ts`:

- `7d91264` (2026-11-07) "feat: add an Auto-fix switch to Entorno for the session's open pull request" (adicionar a Entorno um interruptor de Auto-fix para o pull request aberto da sessão). É aqui que a sessão fica sabendo pela primeira vez do seu pull request, por meio de `ccd_pr`.
- `8af1f0e` (2026-11-07) "feat: show the PR's CI step by step in a collapsible fold under Remote Control" (mostrar o CI do PR passo a passo num recolhimento abaixo de Remote Control). Todo o `hooks/ci.ts` chega neste único commit. A sua mensagem: ele "Reads the newest commit's GitHub Actions runs on the PR's head branch with gh, lists each job's steps without GitHub's bookkeeping ones, and polls every 10 seconds while a run goes or a push waits for one. The fold keeps its open state across sessions." (lê com o gh as execuções do GitHub Actions do commit mais novo no branch de origem do PR, lista os passos de cada job sem os de controle do GitHub, e consulta a cada 10 segundos enquanto uma execução roda ou um push espera por uma. O recolhimento mantém o seu estado aberto entre sessões.). Ele também muda o `shape` do atom da sessão para os novos campos do pull request.
- `90c40f9` (2026-11-07) "fix: read the session's pull request again when the app binds it after the turn ends" (ler de novo o pull request da sessão quando o app o vincula depois que o turno termina). Sem isso, um pull request aberto num turno não mostrava nenhum CI até a próxima leitura.
- `f091e0b` (2026-11-07) "fix: retry only the pull request read and stop the retries when the session ends" (tentar de novo só a leitura do pull request e parar as novas tentativas quando a sessão termina).

O padrão é diferente dos guias anteriores: o recolhimento de CI chegou completo num único commit, sobre a estrutura de pull request do dia anterior, e as correções que vieram depois foram sobre encontrar o pull request, não sobre o CI em si.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No meu mod do Claude Code `my-panel`, adicione um recolhimento "CI" para o pull request aberto da sessão, cujo repositório (`acme/shop`) e branch de origem eu já tenho. Execute `gh run list --repo <repo> --branch <branch> --json databaseId,headSha,workflowName,status,conclusion --limit 20` com `$.process.run` (tempo limite de 30 s), mantenha só as execuções do `headSha` da primeira linha, uma por workflow, e depois `gh run view <id> --repo <repo> --json jobs` para cada uma. Oculte os passos `Set up job`, `Complete job` e `Post …`. Mostre cada passo com ✓ verde, ✗ vermelho, ◐ amarelo para em andamento, ○ cinza para na fila e – cinza para ignorado. Trate uma saída diferente de zero como um erro com o stderr do gh, e uma rejeição (gh ausente) também como um erro; mostre-o no recolhimento. Consulte num loop com `$.clock.sleep(10_000)` só enquanto o recolhimento estiver aberto e uma execução não estiver concluída, e pare nos demais casos; dê a cada observação um id para que uma mais nova a substitua. Teste os parsers como funções puras com JSON sintético do gh, e o loop com `mock.clock`.

## O código mínimo

Esta é uma versão reduzida da ideia, escrita para este guia e conferida com os tipos do Claude Code 2.1.325. Foi adaptada de `hooks/ci.ts` e `hooks/register.tsx` do [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Ela acompanha um único workflow e deixa de fora a espera por um push.

O tipo do estado, em `types/index.d.ts`:

```ts
export type Step = { name: string; status: string; conclusion: string }
export type Ci = { steps: Step[]; isGoing: boolean; error?: string }

declare module 'claude-code' {
  interface PluginState {
    'my-panel': { ci: Ci }
  }
}
```

A parte do módulo de hooks, `hooks/register.tsx`:

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'
import type { Ci, Step } from '../types'

const ci = atom({ plugin: 'my-panel', key: 'ci' } as const, { steps: [], isGoing: false } as Ci)
const NOISE = /^(Set up job|Complete job|Post .+)$/

async function gh($: EngineInterface, argv: string[]): Promise<string> {
  const ran = await $.process.run(['gh', ...argv], { timeoutMs: 30_000 })
  if (ran.exitCode !== 0) throw new Error(ran.stderr.trim() || `gh ended with code ${ran.exitCode}`)
  return ran.stdout
}

async function readCi($: EngineInterface, repo: string, branch: string): Promise<Ci> {
  try {
    const fields = 'databaseId,headSha,status,conclusion'
    const runs = JSON.parse(
      await gh($, [
        'run',
        'list',
        '--repo',
        repo,
        '--branch',
        branch,
        '--json',
        fields,
        '--limit',
        '1',
      ]),
    )
    if (!Array.isArray(runs) || runs.length === 0) return { steps: [], isGoing: false }
    const run = runs[0] as { databaseId: number; status: string }
    const viewed = JSON.parse(
      await gh($, ['run', 'view', String(run.databaseId), '--repo', repo, '--json', 'jobs']),
    )
    const steps: Step[] = (viewed.jobs ?? [])
      .flatMap((job: { steps?: Step[] }) => job.steps ?? [])
      .filter((step: Step) => !NOISE.test(step.name))
    return { steps, isGoing: run.status !== 'completed' }
  } catch (err) {
    return { steps: [], isGoing: false, error: err instanceof Error ? err.message : String(err) }
  }
}

let watch = 0
export async function watchCi($: EngineInterface, repo: string, branch: string): Promise<void> {
  const id = ++watch
  for (;;) {
    const next = await readCi($, repo, branch)
    if (id !== watch) return
    await update($, ci, () => next)
    if (next.error || !next.isGoing) return
    await $.clock.sleep(10_000)
    if (id !== watch) return
  }
}

export const MARK = (s: Step) =>
  s.status !== 'completed'
    ? s.status === 'in_progress'
      ? { mark: '◐', color: '#F5B400' }
      : { mark: '○', color: '#8A90A6' }
    : s.conclusion === 'success'
      ? { mark: '✓', color: '#22B573' }
      : s.conclusion === 'skipped'
        ? { mark: '–', color: '#8A90A6' }
        : { mark: '✗', color: '#F0435A' }
```

Inicie-o com `void watchCi($, 'acme/shop', 'feat/login').catch(() => undefined)` a partir de um hook, nunca aguardado, e desenhe os passos no hook `ui.render` do painel com `read($, ci)`, um `Text` por passo na cor do seu `MARK`, e o erro em vermelho quando houver um. O `MARK` reduzido trata qualquer conclusão concluída que não seja success ou skipped como uma falha; o `markOf` do Narsil Check nomeia as de falha (`FAILED`) e também mostra `neutral` em cinza.

## Erros comuns e como testar

Estes vêm do código e dos commits do Narsil Check:

- **Misturar commits.** `gh run list` devolve execuções de vários commits. Mantenha só as execuções do commit mais novo, uma por workflow, como `latestRuns` faz.
- **Anunciar que passou logo depois de um push.** A lista pode ainda mostrar a execução verde do commit anterior. Compare o commit do upstream com o `headSha` das execuções, e desista de esperar depois de um limite (`CI_WAIT_POLLS`), senão um repositório sem CI para aquele push espera para sempre.
- **Tratar o código de saída como uma exceção.** `$.process.run` resolve com qualquer código de saída. Confira `exitCode`, e guarde o stderr como o motivo.
- **Consultar para sempre.** Pare quando nada roda, quando o recolhimento está fechado e num erro. O loop do Narsil Check retorna em cada um desses casos.
- **Duas observações ao mesmo tempo.** Cada leitura da sessão pode iniciar uma observação. Dê a cada uma um id e deixe a mais nova vencer.
- **Aguardar a observação num hook.** O `$.clock.sleep` de um hook gasta o orçamento desse hook, como dizem os tipos; inicie a observação com `void`.
- **Mostrar o controle do GitHub.** Os passos `Set up job` e `Post …` escondem os que importam.

Para testar, `tests/ci.test.tsx` confere as funções puras com JSON sintético do `gh`: "the newest commit's runs, one per workflow, newest first" (as execuções do commit mais novo, uma por workflow, as mais novas primeiro), "a run's steps leave out GitHub's own bookkeeping" (os passos de uma execução deixam de fora o controle do próprio GitHub), "each step shows as done, failed, going, waiting or skipped" (cada passo aparece como feito, falhou, em andamento, esperando ou ignorado) e "the fold's line says how far the CI is" (a linha do recolhimento diz em que ponto o CI está). `tests/session.test.tsx` testa o recolhimento no painel: ele responde ao `gh` por meio de um hook `on('process.run', ...)` indexado pelo vetor de argumentos unido, e avança o tempo com `mock.clock` e `clock.advance(10_000)` em "the CI fold, under Remote Control, shows the PR's run step by step and follows it until it ends" (o recolhimento de CI, abaixo de Remote Control, mostra a execução do PR passo a passo e a acompanha até ela terminar). "a CI gh cannot read says why in its fold" (um CI que o gh não consegue ler diz por quê no seu recolhimento) responde a todos os comandos com o código de saída 1 e espera `CI · sin leer` e a linha vermelha.

## Para ir além

- O interruptor **Auto-fix** logo abaixo do recolhimento (guias anteriores) liga o próprio monitor de CI do app de desktop para o mesmo pull request, que acorda a sessão quando o CI falha; o recolhimento mostra o CI, o interruptor age sobre ele.
- `ciLabel` conta os passos feitos em todos os jobs e execuções, e nomeia o passo que está rodando agora, então muitas vezes o cabeçalho sozinho basta enquanto o recolhimento fica recolhido.
- O recolhimento lê os campos JSON do `gh`, não a sua saída de texto, então uma mudança na redação do `gh` não o quebra.
