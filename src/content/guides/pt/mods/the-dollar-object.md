---
title: O objeto $
description: As áreas da interface do motor que todo hook recebe, com suas assinaturas reais e onde o narsil-pet e o narsil-check usam cada uma.
route: mods
order: 2
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: types/index.d.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: types/index.d.ts
---

## O que faz

Todo hook recebe `$`, a interface do motor. Um mod não tem Node nem DOM, então é por meio de `$` que ele acessa a tela, seus dados salvos, o relógio, a rede, os processos, os arquivos, a sessão, o modelo, as ferramentas e os comandos. Este guia percorre as áreas que os dois mods do Narsil usam, com a assinatura de cada método tal como o Claude Code 2.1.325 a declara.

`$` tem mais do que o que está aqui (temas, configurações, agentes, telemetria e outros). O arquivo de declarações, `claude-code.d.ts`, documenta cada substantivo e cada método com seu comentário de documentação e um exemplo.

## Como funciona por dentro

Cada método de `$` é uma chamada que passa pelo host: ela é emitida como um evento, então os hooks de outros plugins podem vê-la, reescrevê-la ou recusá-la, e quase todos os métodos retornam uma promise. Os tipos vêm do módulo `claude-code`:

```ts
import type { EngineInterface } from 'claude-code'
```

Uma função auxiliar que recebe `$: EngineInterface` pode usar as mesmas chamadas que um hook.

| Área        | Para que serve                                                                                                 | Usado em                                    |
| ----------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `$.ui`      | Toasts, notificações, linhas de log, a linha de status, painéis, a área de transferência, tabelas de elementos | ambos                                       |
| `$.store`   | Dados JSON mantidos entre sessões                                                                              | ambos                                       |
| `$.state`   | Valores nomeados para a sessão, lidos durante o desenho                                                        | ambos, por meio de `atom`, `read`, `update` |
| `$.clock`   | A hora e os temporizadores                                                                                     | ambos                                       |
| `$.process` | Comandos no host                                                                                               | ambos                                       |
| `$.http`    | Requisições de rede pelo host                                                                                  | ambos                                       |
| `$.fs`      | Arquivos                                                                                                       | ambos                                       |
| `$.session` | O diretório, o id, o uso e as superfícies da sessão                                                            | ambos                                       |
| `$.model`   | Completions avulsas                                                                                            | ambos                                       |
| `$.tool`    | Ferramentas que o modelo pode chamar                                                                           | narsil-check                                |
| `$.command` | Comandos de barra                                                                                              | ambos                                       |
| `$.mcp`     | Chamar as ferramentas de um servidor MCP conectado                                                             | narsil-check                                |
| `$.prompt`  | A caixa de prompt e o envio de prompts                                                                         | ambos                                       |
| `$.audio`   | Fala e som                                                                                                     | narsil-pet                                  |
| `$.env`     | Variáveis de ambiente                                                                                          | narsil-pet                                  |
| `$.plugin`  | O nome e a pasta do próprio plugin                                                                             | narsil-pet                                  |

## Passo a passo

### $.ui: o que a pessoa vê

```ts
$.ui.toast('Saved 3 notes')
$.ui.log('greeter: cache warmed', { to: 'debug' })
$.ui.status('greeter: 2 tool calls')
$.ui.status(undefined)

const sent = await $.ui.notify('Tests passed', { title: 'greeter' })
if (!sent.isSent) $.ui.log(`no notification: ${sent.reason}`)

const opened = await $.ui.open({ id: 'notes', title: 'Notes' })
if (!opened.isPlaced) $.ui.log(`pane waits: ${opened.reason}`)
```

- `toast(text, options?)` mostra uma pequena caixa por alguns segundos (`timeoutMs`, padrão 4000). Não afeta a transcrição nem o modelo.
- `log(text, options?)` acrescenta à transcrição uma linha esmaecida que o modelo não lê ou, com `{ to: 'debug' }`, escreve apenas no log de depuração.
- `status(text | undefined)` fixa uma linha para este plugin sob o prompt; `undefined` a remove.
- `notify(text, options?)` dispara uma notificação nativa pelo canal da própria pessoa e resolve `{ isSent: true, channel }` ou `{ isSent: false, reason }`.
- `open(pane)` abre um painel que o plugin então desenha com um hook `ui.render` em `{ component: 'Pane' }`. Resolve `{ isPlaced: true }` ou `{ isPlaced: false, reason }`.
- `copy({ text, surface })` coloca o texto na área de transferência da superfície indicada e resolve `{ isCopied: true }` ou `{ isCopied: false, reason }`. Um tratador de toque passa `e.surface`.
- `resolve(e)` retorna a tabela de elementos (`Box`, `Text`, `Button` e outros) da superfície em que um hook `ui.render` desenha. O guia "Superfícies" trata disso.

O `hooks/register.tsx` do narsil-check usa `$.ui.copy` e `$.ui.toast` juntos em `copyRow`, e abre seu painel com `$.ui.open({ id: PANE, title: TITLE })` em `session.start`. O `hooks/register.tsx` do narsil-pet tenta `$.ui.notify` antes do seu próprio script de notificação. Nenhum dos dois mods chama `$.ui.status`; a linha acima segue o exemplo do arquivo de declarações.

### $.store: dados entre sessões

```ts
const runs = Number((await $.store.get('runs')) ?? 0) + 1
await $.store.set('runs', runs)

const old = (await $.store.keys()).filter((key) => key.startsWith('day:'))
for (const key of old) await $.store.delete(key)
```

- `get(key)` resolve o valor ou `undefined`. O tipo é `unknown`, então verifique ou converta.
- `set(key, value)` armazena dados JSON. Um `Date` volta como sua string ISO, e um campo `undefined` é descartado. Rejeita uma função, uma referência circular ou um armazenamento com mais de 4 MiB de JSON no total.
- `keys()` resolve todas as chaves na ordem de inserção; `delete(key)` remove uma.

O armazenamento é um arquivo JSON próprio do plugin, no diretório de configuração do Claude Code do usuário. O narsil-pet restaura suas preferências com `$.store.get(PREFS_KEY)` em `session.start` e apaga estatísticas antigas por sessão com `$.store.keys()` e `$.store.delete(key)`.

### $.state: valores para desenhar

`$.state` guarda valores nomeados para a sessão. Eles sobrevivem a uma recarga a quente do código do mod, e um hook `ui.render` que lê um deles é desenhado de novo quando ele muda, sem chamar `$.ui.invalidate`. Cada valor é declarado no contrato do mod (`types/index.d.ts`) em `PluginState`.

As chamadas diretas recebem uma referência cujos `plugin` e `key` são literais:

```ts
const ref = { plugin: 'greeter', key: 'calls' } as const

const held = await $.state.get(ref)
await $.state.set(ref, (held.value ?? 0) + 1, { ifVersion: held.version })
```

`get` resolve `{ value, version }` (`undefined` na versão 0 quando nunca foi gravado). `set` com `ifVersion` só grava enquanto o valor estiver nessa versão. Os dois mods do Narsil usam, em vez disso, os auxiliares de `claude-code`, que fazem isso por você:

```ts
import { atom, read, update } from 'claude-code'

const calls = atom({ plugin: 'greeter', key: 'calls' } as const, 0)

const now = await read($, calls)
await update($, calls, (n) => n + 1)
```

A diferença que importa: `$.state` dura a sessão e `$.store` dura entre sessões. Para manter um valor de estado depois que a sessão termina, grave-o também em `$.store`. Um hook de desenho nunca grava estado (`$.state.set` durante o desenho é recusado); grave a partir de um tratador de toque ou de outro evento. O narsil-pet declara todo o seu estado em `types/index.d.ts` em `PluginState['narsil-pet']` e cria cada valor com `atom` no topo de `hooks/register.tsx`.

### $.clock: hora e temporizadores

```ts
const startedAt = await $.clock.now()
await $.clock.sleep(500)

const once = $.clock.after(10_000, () => $.ui.toast('Ten seconds in'))
const tick = $.clock.every(2000, () => $.ui.status('still here'))
once.cancel()
tick.cancel()
```

`now()` resolve os milissegundos desde a época Unix. `sleep(ms, options?)` espera e aceita um `signal`. `after(ms, fn)` e `every(ms, fn)` retornam um temporizador com `cancel()`. Uma recarga a quente cancela os temporizadores pendentes. O narsil-pet abre sua janela com `$.clock.after(10, ...)` e inicia um pulso com `$.clock.every(2000, ...)` em `session.start`.

### $.process, $.http, $.env, $.plugin: o host

```ts
const { exitCode, stdout } = await $.process.run(['git', 'status', '--short'], { timeoutMs: 5000 })
const { ok, status, text } = await $.http.fetch('https://example.com/status')
const home = await $.env.get('HOME')
const script = `${$.plugin.root}/scripts/hello.sh`
```

- `process.run(argv, init?)` executa um comando pelo seu vetor de argumentos, sem shell, e resolve `{ exitCode, stdout, stderr }` para qualquer código de saída. `init` aceita `cwd`, `env`, `stdin` e `timeoutMs` (30 s por padrão).
- `http.fetch(url, init?)` passa pelo host e resolve `{ status, ok, headers, text }`. `init` aceita `method`, `headers`, `body`, `auth` e `socketPath`.
- `env.get(name)` resolve a variável ou `undefined`. O nome precisa ser um literal de string, para que o validate possa listar o que o módulo lê.
- `plugin.root` é a pasta do plugin (absoluta) e `plugin.name`, o nome no manifesto. Os dois são strings simples, não chamadas.

O narsil-check executa gerenciadores de pacotes e o `gh` com `$.process.run` e consulta registros e o OSV.dev com `$.http.fetch`. O narsil-pet lê `OS` com `$.env.get` e monta caminhos de scripts a partir de `$.plugin.root`.

### $.fs: arquivos

```ts
const path = `${await $.session.cwd()}/notes.json`
if (await $.fs.exists(path)) {
  const notes = JSON.parse(await $.fs.read(path)) as unknown
  await $.fs.write(path, JSON.stringify(notes, null, 2))
}
const entries = await $.fs.list(await $.session.cwd())
```

`read(path)` resolve o texto (ou os bytes, com `{ as: 'bytes' }`) e rejeita quando o arquivo não existe ou tem mais de 4 MiB. `write(path, text)` cria o arquivo e seus diretórios. `exists(path)` e `list(path?)` fazem o que o nome diz; cada entrada de `list` tem `name`, `kind`, `size`, `mtimeMs` e `isLink`. O auxiliar `readJson` do narsil-check é `$.fs.exists` seguido de `$.fs.read`.

### $.session: a própria sessão

```ts
const cwd = await $.session.cwd()
const id = await $.session.id()
const usage = await $.session.usage()
const inApp = (await $.session.surfaces()).some((s) => s !== 'terminal')
```

`cwd()` é o diretório em que a sessão roda, `id()` é o seu id, `usage()` informa quando ela começou e o quanto a janela de contexto está cheia, e `surfaces()` lista todas as superfícies em que ela desenha. O narsil-pet lê os quatro; o narsil-check lê `cwd()`.

### $.model: completions

```ts
const reply = await $.model.complete({
  model: 'haiku',
  system: 'Answer in one line.',
  prompt: 'Name a color.',
  maxTokens: 50,
})
const color = reply.isAnswered ? reply.text : `no answer: ${reply.reason}`

const forked = await $.model.fork({ prompt: 'Summarize this session in one sentence.' })
```

`complete` executa uma completion sem ferramentas e sem histórico e sempre resolve um resultado: `isAnswered` com `text`, ou `isAnswered: false` com um `reason`. `fork` executa uma completion sem ferramentas sobre a própria transcrição da sessão. As duas contam para o custo da sessão. O narsil-pet escreve suas dicas com `$.model.complete({ model: 'haiku', ... })` e suas dicas mais aprofundadas com `$.model.fork`; o narsil-check pergunta ao Haiku por que uma atualização é arriscada.

### $.tool e $.command: o que o modelo e a pessoa podem chamar

```tsx
on('session.start', async ($, e, next) => {
  await $.command.register({
    name: 'notes',
    description: 'Show the notes count',
    argumentHint: 'clear',
  })
  await $.tool.register({
    name: 'add_note',
    description: 'Add a note to the list.',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  })
  return next(e)
})

on('command.run', { command: 'notes' }, async ($, e) => {
  const count = Number((await $.store.get('count')) ?? 0)
  return { text: e.args.trim() === 'clear' ? 'Cleared.' : `${count} notes` }
})

on('tool.call', { tool: 'mcp__greeter__add_note' }, async ($, e) => {
  const text = (e as unknown as { text?: unknown }).text
  if (typeof text !== 'string') return { deny: 'A note needs text.' }
  return { result: `Added: ${text}` }
})
```

`command.register` declara `/<name>`; um hook `command.run` em `{ command: '<name>' }` responde a ele com `{ text }`. `tool.register` declara uma ferramenta chamada `mcp__<plugin>__<name>`; um hook `tool.call` com esse nome responde a ela. Os dois registram a partir de `session.start`. Este padrão foi adaptado do `hooks/register.tsx` do narsil-check, que registra suas quatro ferramentas de lista de tarefas em `registerTools` e responde a cada uma com `{ result }` ou `{ deny }`.

### $.mcp, $.prompt, $.audio

```ts
const result = await $.mcp.call('example-server', 'list_items', { limit: 5 })
await $.prompt.fill({ text: 'Run the tests again' })
await $.prompt.submit({ text: 'List the files changed today' })
await $.audio.speak('Done')
```

- `mcp.call(server, tool, args?)` chama uma ferramenta em um servidor MCP conectado usando a própria conexão do motor e resolve blocos `content` e `isError`. O narsil-check lê assim os servidores de sessão do app desktop.
- `prompt.fill({ text })` coloca texto na caixa de prompt como rascunho. O narsil-pet usa isso quando você escolhe um próximo passo sugerido.
- `prompt.submit({ text })` enfileira um prompt que inicia seu próprio turno assim que a sessão fica ociosa. O narsil-check usa isso para passar uma tarefa ao Claude.
- `audio.speak(text)` fala com o sintetizador da plataforma. O narsil-pet recorre a ele quando seu próprio script de voz não está disponível.

## Erros comuns e como testar

- **Tratar `$.state` como permanente.** Ele termina com a sessão. Persista por meio de `$.store`.
- **Gravar estado durante o desenho.** `$.state.set` dentro de um hook `ui.render` é recusado. Grave a partir de `onPress` ou de outro evento.
- **Chaves de estado ou nomes de variáveis calculados.** `plugin` e `key` em uma referência de estado, e o nome passado para `$.env.get`, precisam ser literais no código-fonte.
- **Ignorar as formas dos resultados.** `$.model.complete`, `$.ui.notify`, `$.ui.open` e `$.ui.copy` resolvem um resultado que diz se funcionou, em vez de rejeitar. Verifique `isAnswered`, `isSent`, `isPlaced` ou `isCopied`.
- **Esquecer que as chamadas podem falhar.** Os dois mods envolvem as chamadas opcionais em `.catch(() => undefined)` para que uma falha não interrompa um hook.

`claude plugin validate` lista todas as chamadas a `$` que o módulo faz (`calls: $.state.get, $.ui.toast, ...`), as chaves de estado que ele lê e grava e os nomes de variáveis de ambiente que usa. A verificação de tipos com o arquivo de declarações detecta um nome de método ou um argumento errado antes que uma sessão carregue o mod.

## Para ir além

- `hooks/register.tsx` do narsil-pet: `session.start` usa `$.command.register`, `$.store.get`, `$.env.get`, `$.session.usage`, `$.session.cwd`, `$.clock.after` e `$.clock.every` em um único hook.
- `hooks/register.tsx` do narsil-check: `registerTools` para `$.tool.register`, os hooks `tool.call` em `mcp__narsil-check__...` que respondem a elas e `copyRow` para `$.ui.copy`.
- Os dois arquivos `types/index.d.ts`: as declarações de `PluginState` por trás de cada `atom`.
