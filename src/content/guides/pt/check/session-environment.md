---
title: O ambiente da sessão
description: 'Como o Narsil Check mostra o repositório, a pasta, o branch, o Remote Control e o Auto-fix, lidos do git e dos servidores do app de desktop, e por que os consulta tão pouco.'
route: check
order: 2
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/session.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/session.test.tsx
---

## O que faz

A primeira seção do painel, **Entorno** ("ambiente"), mostra o que a barra de sessão do app de desktop mostra, para que você possa ocultar essa barra e manter um único painel. Ela tem uma linha por informação, e a maioria das linhas faz algo quando você clica nelas:

| Linha                               | O que mostra                                                                                        | Num clique                                                       |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Repositorio** (repositório)       | O endereço web do remoto `origin`, como `github.com/acme/shop`.                                     | Abre-o no navegador.                                             |
| **Carpeta** (pasta)                 | A pasta de trabalho da sessão.                                                                      | Abre o seletor de pastas e move a sessão para a pasta escolhida. |
| **Rama** (branch)                   | O branch atual do git.                                                                              | Abre uma aba de terminal na pasta de trabalho.                   |
| `worktree …`                        | O worktree da sessão, quando ela tem um.                                                            | Nada.                                                            |
| **Control remoto** (Remote Control) | Um interruptor: `●━━ desactivado` em cinza, `━━● activado` em verde.                                | Liga ou desliga.                                                 |
| **Auto-fix**                        | O mesmo interruptor para o pull request aberto da sessão, ou `sin PR abierto` ("nenhum PR aberto"). | Liga ou desliga.                                                 |

Com um pull request aberto, um recolhimento **CI** aparece entre os dois interruptores; o quarto guia deste percurso trata dele.

Quando algo não pode ser lido, a seção diz isso em vermelho abaixo da sua linha, como "No pude leer o cambiar el control remoto: …" ("não consegui ler nem mudar o Remote Control: …"), em vez de ficar vazia.

## Como funciona por dentro

### De onde vem cada informação

O README diz que a seção é lida dos próprios servidores MCP do app de desktop. O código é mais preciso, e a diferença importa em outras superfícies: três informações vêm do motor e do git, o resto vem dos servidores do app. Tudo isso acontece em `loadSession`, em `hooks/register.tsx`.

| Informação               | Origem                                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| Pasta                    | `$.session.cwd()`                                                                                     |
| Branch                   | `$.process.run(['git', 'branch', '--show-current'])`                                                  |
| Repositório              | `$.process.run(['git', 'remote', 'get-url', 'origin'])`, transformado num endereço web por `webUrlOf` |
| Remote Control, worktree | `$.mcp.call('ccd_session_mgmt', 'get_session', { session_id: 'self' })`                               |
| Pull request, Auto-fix   | `$.mcp.call('ccd_pr', 'get_status', { session_id: 'self' })`                                          |
| Conectores               | `$.mcp.call('ccd_connectors', 'session_connectors_status')` (próximo guia)                            |

Os nomes dos servidores e das ferramentas são constantes no topo de `hooks/session.ts` (`SESSIONS_SERVER`, `SESSION_TOOL`, `PR_SERVER`, `PR_TOOL` e as demais), então o módulo de hooks nunca os escreve duas vezes.

`webUrlOf` aceita remotos SSH (`git@github.com:acme/shop.git`, `ssh://git@host:22/acme/shop`) e HTTPS, com ou sem usuário ou `.git`, e devolve `https://host/owner/repo`. Qualquer outra coisa, um caminho local entre elas, não gera link, e a linha diz "sin repositorio remoto" ("nenhum repositório remoto").

### `$.mcp.call`, como o código o usa

Os tipos da 2.1.325 descrevem `$.mcp.call(server, tool, args)` como uma chamada a uma ferramenta "on one of the engine's connected MCP servers with the engine's own connection and credentials" (num dos servidores MCP conectados ao motor, com a própria conexão e as próprias credenciais do motor). Ela é posicional (servidor, ferramenta, argumentos), e não o nome `mcp__server__tool` que um hook `tool.call` vê. Ela resolve o resultado como o MCP o devolve: blocos `content`, `isError` e `structuredContent` quando a ferramenta declara um esquema de saída.

O Narsil Check lê cada resposta da mesma forma:

```tsx
const result = await $.mcp.call(SESSIONS_SERVER, SESSION_TOOL, { session_id: 'self' })
const read = result.isError
  ? undefined
  : parseSession(result.structuredContent ?? jsonOf(result.content))
where = read ?? { remote: 'unknown', remoteError: textOf(result.content) || 'respuesta sin sesión' }
```

Tradução da mensagem para o português: "respuesta sin sesión" (resposta sem sessão).

Ele prefere `structuredContent` e recorre ao JSON dentro dos blocos de texto (`jsonOf` em `hooks/session.ts`). Cada chamada fica no seu próprio `try`, e uma falha vira um campo de erro só daquela parte (`remoteError`, `fixError`, `connectorsError`): um servidor que não responde não apaga a seção inteira.

Os parsers são defensivos de propósito. `parseSession` usa `remoteControlState` quando ele é `on`, `off`, `connecting` ou `unavailable` e, caso contrário, recorre ao booleano `remoteControlActive`. `parsePr` informa o Auto-fix só para um pull request vinculado e `open`, porque só esse pode ser alternado e o interruptor precisa da sua url; ele também guarda o repositório e o branch de origem do pull request para o recolhimento de CI.

### Por que ele consulta tão pouco

A seção poderia simplesmente consultar os servidores a cada poucos segundos. Ela não faz isso, e o código e os commits dão dois motivos.

**Cada chamada é visível para todos os outros mods.** Um comentário em `hooks/register.tsx` diz "each call to them reaches every other mod as a tool call" (cada chamada a eles chega a todos os outros mods como uma chamada de ferramenta). Os tipos concordam com as suas próprias palavras: a chamada do plugin é "seen by the hooks above it" (vista pelos hooks acima dele). O commit `55fe118` registra a consequência: "seven retries tripped Narsil's loop alert" (sete novas tentativas dispararam o alerta de loop da Narsil). Um mod que observa as chamadas de ferramentas vê as chamadas do painel ao lado do próprio trabalho do Claude; hoje, a Narsil ignora as chamadas que não são do Claude (`isClaudesCall`, tratado no primeiro guia do percurso 1), e o comentário ali cita como exemplo o narsil-check lendo a sua sessão no início.

**Uma chamada cedo demais pode abrir um pedido de permissão.** O comentário acima de `SESSION_DELAY_MS` diz que os servidores do app se conectam depois que a sessão começa, e que "a call that comes while the app has not yet confirmed which server serves the tool makes the app ask the person for permission, whatever the permission mode" (uma chamada que chega enquanto o app ainda não confirmou qual servidor atende a ferramenta faz o app pedir permissão à pessoa, qualquer que seja o modo de permissões). O commit `4770a49` "fix: ask the app's session servers once, ten seconds after start" (consultar os servidores de sessão do app uma vez, dez segundos depois do início) é essa correção.

Aqui o código e os tipos discordam. Os tipos da 2.1.325 dizem sobre `$.mcp.call`: "No permission prompt: the plugin's call, seen by the hooks above it, is the grant." (nenhum pedido de permissão: a chamada do plugin, vista pelos hooks acima dele, é a autorização). O README e o commit descrevem um pedido que o app de desktop abriu mesmo assim. Trate os tipos como o contrato do motor e o commit como o que a pessoa autora observou no app de desktop, e projete para o caso mais estrito.

Então o calendário é este:

1. **No início da sessão**, `loadSessionAtStart` espera dez segundos com `$.clock.sleep(SESSION_DELAY_MS)` e lê uma vez. Ele roda com `void`, então o início da sessão não fica retido. Até lá, a seção diz "Leyendo la sesión…" ("lendo a sessão…").
2. **Se essa leitura falhar**, ela é feita de novo quando o seu primeiro turno começa, "when the servers are surely confirmed" (quando os servidores com certeza já estão confirmados), sem novas tentativas rápidas no meio. A primeira leitura é feita com `isFinal: false`: uma leitura que falha não escreve nada, então a seção continua lendo em vez de mostrar um erro que a nova tentativa pode resolver.
3. **Quando cada turno principal termina**, a pasta, o branch e o repositório são lidos de novo do git. Os servidores só são consultados de novo quando o turno usou uma ferramenta que muda a resposta deles (`SESSION_TOOLS`: as ferramentas `mcp__ccd_session_mgmt__`, `mcp__ccd_connectors__`, `mcp__ccd_directory__` e `mcp__ccd_pr__`, `EnterWorktree`, `ExitWorktree`, ou um comando de shell com `gh pr` ou `git push`), ou quando a última leitura falhou.
4. **Depois de um turno que abriu um pull request ou fez push dele**, o app pode vinculá-lo só depois que o turno termina. `retryPr` consulta só o `ccd_pr` de novo depois de esperas de 5, 10 e 15 segundos (5, 15 e 30 segundos depois do turno, como diz o README), para assim que o pull request aparece, e para quando a sessão termina, incluindo um `/clear`.
5. **Quando você abre o recolhimento Entorno ou Conectores**, e depois de você alternar um interruptor, tudo é lido de novo.

O formato desse calendário é o ponto: as leituras baratas (o git, a pasta) acontecem com frequência, e as leituras que outros mods conseguem ver só acontecem quando algo pode ter mudado.

### Os interruptores

Os dois interruptores chamam os servidores do app para mudar algo e depois leem de volta:

- **Remote Control**: `$.mcp.call('ccd_session_mgmt', 'set_remote_control', { session_id: 'self', enabled })`. A resposta pode ser JSON ou texto, então `parseRemote` procura o estado nos dois.
- **Auto-fix**: `$.mcp.call('ccd_pr', 'set_monitor', { auto_fix: enabled, address_comments: enabled, url })`. Um comentário diz que `address_comments` precisa ser igual a `auto_fix` do lado do app. O README diz que o app pode pedir a sua permissão antes.

Enquanto um interruptor muda, `isSwitching` (ou `isFixSwitching`) desenha o botão no meio e em amarelo (`━●━`, "cambiando…", "mudando…"), e o botão não é desenhado, então um segundo clique não pode concorrer com o primeiro. `switchGlyph` e `fixGlyph` em `hooks/session.ts` desenham os dois interruptores com a mesma função.

Os cliques na pasta e no branch usam mais dois servidores do app: `ccd_directory` (`request_directory` abre o seletor nativo, `change_directory` move a sessão) e `terminal` (`open_terminal_tab`, com o nome do branch).

### Em superfícies sem esses servidores

O terminal, o VS Code e as outras superfícies não têm os servidores do app de desktop. Ali, cada `$.mcp.call` falha, e o código transforma cada falha no erro da sua parte.

O que você vê decorre do calendário acima. A leitura dos dez segundos falha e não escreve nada, então a seção continua dizendo "Leyendo la sesión…". Quando o seu primeiro turno começa, a leitura é feita de novo como final: o repositório, a pasta e o branch aparecem (vêm do git e do motor), e as linhas de Remote Control e Auto-fix dizem em vermelho que não puderam ser lidas. O teste "a server the mod cannot reach says why once the first turn has tried it too" (um servidor que o mod não alcança diz por quê depois que o primeiro turno também tentou) confere exatamente isso: duas leituras no total, cada uma consultando cada servidor uma vez, e depois as linhas de erro.

A tabela de superfícies do README diz que Entorno não funciona fora do app de desktop e que "la sección dice por qué no pudo leerlos" ("a seção diz por que não conseguiu lê-los"). O código é um pouco mais gentil que isso: as linhas do git continuam aparecendo. Os cliques na pasta e no branch precisam dos servidores do app, então, fora do desktop, eles respondem com um toast dizendo que não conseguiram.

## Construa com o Claude

Peça ao Claude uma seção de ambiente lida do git e dos servidores do app de desktop. A única ideia que ele precisa acertar é com que pouca frequência perguntar a esses servidores: cada chamada é vista por outros mods, e uma chamada cedo demais pode abrir um pedido de permissão.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No meu mod do Claude Code `my-panel`, adicione ao painel uma seção "Environment". Leia a pasta com `$.session.cwd()`, o branch com `$.process.run(['git', 'branch', '--show-current'])` e o remoto com `git remote get-url origin`, transformado num link https para remotos SSH e HTTPS. Leia o Remote Control do app de desktop com `$.mcp.call('ccd_session_mgmt', 'get_session', { session_id: 'self' })`, preferindo `structuredContent` e recorrendo ao JSON no conteúdo de texto. Cada chamada aos servidores do app é vista por outros mods, e uma chamada cedo demais pode abrir um pedido de permissão, então leia uma vez, dez segundos depois de `session.start`, com `$.clock.sleep`, sem aguardá-la no hook; se falhar, mostre "Reading…" e tente mais uma vez no primeiro `turn.start` principal. Depois de cada turno principal, leia de novo só o git. Guarde o erro de cada parte separadamente e mostre-o em vermelho. Teste com `mock.clock` que nenhum servidor é chamado antes de dez segundos e que é chamado só uma vez depois.

### O que conferir na resposta do Claude

1. Nenhuma chamada aos servidores do app acontece nos primeiros dez segundos depois de `session.start`, e a leitura adiada roda com `void`, então o hook retorna na hora.
2. Se essa primeira leitura falhar, ela não escreve nada, a seção diz que está lendo, e ela tenta mais uma vez no primeiro `turn.start` principal, sem loop de novas tentativas.
3. Depois de cada turno principal, só o git é lido de novo (pasta, branch e remoto), não os servidores do app.
4. Cada resposta é lida primeiro de `structuredContent` e, como alternativa, do JSON nos blocos de texto, e cada parte guarda o seu próprio erro, mostrado em vermelho.
5. O remoto vira um link https tanto para remotos SSH quanto HTTPS, e qualquer outra coisa não gera link.

Se uma verificação falhar, diga ao Claude o que você vê: "fora do app de desktop, a seção diz "Reading…" para sempre e o branch nunca aparece".

### Como a pessoa autora pediu

O pedido original desta seção não foi registrado. Nenhum dos registros de tarefas públicos do narsil-check (`odd/tasks/*.md`) trata dela; eles são sobre ecossistemas, idade das versões e vulnerabilidades.

#### Reconstrução a partir do histórico de commits

A partir de `git log -- hooks/session.ts`, com os commits relacionados em `hooks/register.tsx`:

- `be8eac0` (2026-11-05) "feat: show the session bar's environment, connectors and Remote Control in the pane" (mostrar no painel o ambiente, os conectores e o Remote Control da barra de sessão). A sua mensagem dá o motivo: a seção é "read from the desktop app's own MCP servers, so the app's session bar can be hidden" (lida dos próprios servidores MCP do app de desktop, para que a barra de sessão do app possa ser ocultada).
- `2bd1919` (2026-11-05) "feat: repository link, Remote Control switch in Entorno and /mcp from connectors" (link do repositório, interruptor de Remote Control em Entorno e /mcp a partir dos conectores). Entorno perde uma linha Local/Nube ("local/nuvem") e ganha o link do repositório.
- `c07f5e9` (2026-11-05) "feat: Entorno starts open, other sections fold until they have something" (Entorno começa aberta, as outras seções ficam recolhidas até terem algo).
- `d8c664e` (2026-11-05) "fix: retry the first session read until the app's servers answer" (tentar de novo a primeira leitura da sessão até os servidores do app responderem). A primeira resposta a servidores que ainda não estavam conectados: tentar de novo durante cerca de um minuto.
- `55fe118` (2026-11-06) "fix: ask the app's session servers less often" (consultar os servidores de sessão do app com menos frequência). No máximo quatro leituras no início, e servidores consultados depois de um turno só quando necessário, porque as novas tentativas "tripped Narsil's loop alert" (dispararam o alerta de loop da Narsil).
- `4770a49` (2026-11-06) "fix: ask the app's session servers once, ten seconds after start" (consultar os servidores de sessão do app uma vez, dez segundos depois do início). As novas tentativas são substituídas por uma única leitura adiada, por causa do pedido de permissão.
- `7d91264` (2026-11-07) "feat: add an Auto-fix switch to Entorno for the session's open pull request" (adicionar a Entorno um interruptor de Auto-fix para o pull request aberto da sessão).
- `90c40f9` (2026-11-07) "fix: read the session's pull request again when the app binds it after the turn ends" (ler de novo o pull request da sessão quando o app o vincula depois que o turno termina).
- `f091e0b` (2026-11-07) "fix: retry only the pull request read and stop the retries when the session ends" (tentar de novo só a leitura do pull request e parar as novas tentativas quando a sessão termina). A sua mensagem: cada nova tentativa tinha consultado de novo os conectores e a sessão, "three calls that reach every other mod" (três chamadas que chegam a todos os outros mods).

Vale a pena notar o padrão: três correções seguidas (`d8c664e`, `55fe118`, `4770a49`), cada uma consultando menos os servidores. A primeira versão se esforçava mais quando os servidores não estavam prontos; a última espera, consulta uma vez e só consulta de novo quando há um motivo.

## Código de referência

Esta é uma resposta correta, escrita para este guia. Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

Esta é uma versão reduzida da ideia, escrita para este guia e conferida com os tipos do Claude Code 2.1.325. Foi adaptada de `hooks/register.tsx` e `hooks/session.ts` do [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later).

O tipo do estado, em `types/index.d.ts`:

```ts
export type Env = { isLoaded: boolean; cwd: string; branch: string; remote: string; error?: string }

declare module 'claude-code' {
  interface PluginState {
    'my-panel': { env: Env }
  }
}
```

O módulo de hooks, `hooks/register.tsx`:

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import type { Env } from '../types'

const PANE = 'my-panel'
const env = atom(
  { plugin: 'my-panel', key: 'env' } as const,
  { isLoaded: false, cwd: '', branch: '', remote: '' } as Env,
)

const git = ($: EngineInterface, argv: string[]) =>
  $.process
    .run(argv, { timeoutMs: 15_000 })
    .then((r) => (r.exitCode === 0 ? r.stdout.trim() : ''))
    .catch(() => '')

// One read; `isFinal: false` writes nothing when the app's server fails.
async function load($: EngineInterface, isFinal: boolean): Promise<boolean> {
  const cwd = await $.session.cwd().catch(() => '')
  const branch = await git($, ['git', 'branch', '--show-current'])
  let remote = 'unknown'
  let error: string | undefined
  try {
    const result = await $.mcp.call('ccd_session_mgmt', 'get_session', { session_id: 'self' })
    const value = (result.structuredContent ?? {}) as { remoteControlState?: unknown }
    if (result.isError || typeof value.remoteControlState !== 'string') error = 'no answer'
    else remote = value.remoteControlState
  } catch (err) {
    error = err instanceof Error ? err.message : String(err)
  }
  if (!error || isFinal)
    await update($, env, () => ({ isLoaded: true, cwd, branch, remote, error }))
  return !error
}

let isRetryPending = false

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    void $.clock
      .sleep(10_000)
      .then(async () => {
        isRetryPending = !(await load($, false))
      })
      .catch(() => undefined)
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined && isRetryPending) {
      isRetryPending = false
      void load($, true).catch(() => undefined)
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const view = await read($, env)
    if (!view.isLoaded) return <Text dimColor>Reading the session…</Text>
    return (
      <Box flexDirection="column">
        <Text>{`Folder ${view.cwd || '?'}`}</Text>
        <Text>{`Branch ${view.branch || 'no git'}`}</Text>
        <Text>{`Remote Control ${view.remote}`}</Text>
        {view.error && (
          <Text color="#F0435A">{`Could not read Remote Control: ${view.error}`}</Text>
        )}
      </Box>
    )
  })
}
```

Tradução do comentário para o português: uma leitura; `isFinal: false` não escreve nada quando o servidor do app falha.

O painel é aberto como no primeiro guia. Três detalhes sustentam o design. A leitura adiada roda com `void`, então `session.start` retorna na hora. Uma primeira leitura que falha não escreve nada, então a seção diz que está lendo em vez de mostrar um erro que a próxima tentativa pode resolver. E a nova tentativa espera um evento real, o primeiro turno, em vez de um loop com timer que outros mods veriam como chamadas de ferramenta repetidas.

## Erros comuns e como testar

Estes vêm do código e dos commits do Narsil Check:

- **Chamar os servidores do app logo no `session.start`.** Eles podem ainda não estar conectados, e a pessoa autora viu o app de desktop pedir permissão mesmo com as permissões ignoradas (`4770a49`). Espere e então consulte uma vez.
- **Tentar de novo num loop.** Cada chamada é vista por outros mods como uma chamada de ferramenta; as novas tentativas do Narsil Check dispararam o alerta de loop da Narsil (`55fe118`).
- **Aguardar a leitura lenta dentro do hook.** `$.clock.sleep` gasta o próprio orçamento do hook, como dizem os tipos. Inicie-a com `void` e deixe o hook retornar.
- **Ler só `content`.** Prefira `structuredContent` quando a ferramenta declara um, e interprete os blocos de texto só como alternativa.
- **Um único erro para tudo.** Guarde um erro por parte, para que um servidor ausente não esconda o branch que você consegue ler do git.
- **Supor que toda superfície tem os servidores do desktop.** No terminal, as chamadas falham; projete a seção para mostrar o que o git consegue dizer e para explicar por que o resto está faltando.
- **Consultar os servidores depois de cada turno.** O Narsil Check só os consulta de novo quando o turno usou uma ferramenta que muda a resposta deles (`SESSION_TOOLS`) ou quando a última leitura falhou.

Para testar, `tests/session.test.tsx` no narsil-check responde aos servidores do app com um hook `on('mcp.call', ...)`, ao git com `on('process.run', ...)` e à pasta com `on('session.cwd', ...)`, e avança o tempo com `mock.clock(on)` e `clock.advance`. Testes que vale a pena copiar pelo nome incluem "the app's servers are first asked ten seconds after the session starts, once; a failed read is tried again as the first turn starts" (os servidores do app são consultados pela primeira vez dez segundos depois do início da sessão, uma vez; uma leitura que falhou é tentada de novo quando o primeiro turno começa), "a turn that touched no session tool reads only git again, not the app's servers" (um turno que não tocou em nenhuma ferramenta de sessão lê de novo só o git, não os servidores do app) e "a server the mod cannot reach says why once the first turn has tried it too" (um servidor que o mod não alcança diz por quê depois que o primeiro turno também tentou). Use valores sintéticos nas suas fixtures, como um remoto `git@github.com:acme/shop.git`.

## Para ir além

A seção completa do narsil-check acrescenta:

- O recolhimento **CI** do pull request da sessão, lido com `gh` (o quarto guia).
- A seção **Conectores**, lida dos mesmos servidores no mesmo `loadSession` (o próximo guia).
- `pathOf` em `hooks/session.ts`, que encontra a pasta com que o seletor respondeu, como um campo `path` ou como o primeiro caminho absoluto no seu texto.
- Essa mesma seção é o que permite ocultar a própria barra de sessão do app de desktop: tudo o que ela mostrava está aqui, com os mesmos cliques.
