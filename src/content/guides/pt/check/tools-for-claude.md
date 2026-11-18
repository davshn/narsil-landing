---
title: Ferramentas para o Claude
description: 'Como o Narsil Check dá ao Claude quatro ferramentas sobre a lista de pendências com $.tool.register, as atende a partir de hooks tool.call, e como o modelo decide quando usá-las.'
route: check
order: 16
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/todos.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/todos.test.tsx
---

## O que faz

A lista de pendências do último guia é útil a partir do painel. Ela é mais útil se você também puder dizer ao Claude "anote nas pendências que o teste de login é instável" no meio de uma tarefa, ou "faça a tarefa do README", e o Claude a encontrar, fizer e riscar.

O Narsil Check dá ao Claude quatro ferramentas para isso:

| Ferramenta             | O que faz                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `todo_list`            | Lista as tarefas deste projeto: id, nome e conteúdo de cada uma.                     |
| `todo_add`             | Adiciona uma tarefa com um nome e um conteúdo opcional.                              |
| `todo_done`            | Remove uma tarefa concluída, nomeada pelo seu id ou pelo seu nome exato.             |
| `todo_add_to_template` | Adiciona uma tarefa à lista de outro projeto, geralmente o modelo de onde este veio. |

O Claude as vê como `mcp__narsil-check__todo_list` e assim por diante. Uma tarefa que o Claude adiciona aparece no painel na hora, e uma tarefa que você adiciona no painel está no próximo `todo_list`. Eles compartilham uma lista e um escritor.

A quarta ferramenta tem o seu próprio comando. Quando você faz algo num projeto que o modelo de onde ele veio também deveria receber, como uma atualização complicada, você diz:

```text
/narsil-check template "in acme-template create the task of raising TypeScript to the next major, explain what we had to do"
```

O Claude encontra a pasta do modelo ao lado deste projeto, escreve a explicação (ele sabe como o trabalho foi feito; o painel não sabe) e adiciona a tarefa ali. Se ele não encontrar nenhuma pasta, ou encontrar várias parecidas, ele pergunta a você qual é.

## Como funciona por dentro

### Duas metades: declarar e atender

A ferramenta de um mod tem duas partes, e os tipos da 2.1.325 descrevem as duas sob `$.tool.register`:

- **Declará-la**: `$.tool.register({ name, description, inputSchema })` "Declares a tool the model can call from the next prompt on" (declara uma ferramenta que o modelo pode chamar a partir do próximo prompt). Ele retorna o nome completo, `mcp__<plugin>__<name>`.
- **Atendê-la**: "Serve it with a `tool.call` hook on `{ tool: "mcp__<plugin>__<name>" }` that returns the result (a call no hook answers fails)" (atenda-a com um hook `tool.call` em `{ tool: "mcp__<plugin>__<name>" }` que retorna o resultado; uma chamada que nenhum hook responde falha).

Então o mod declara quatro ferramentas em `registerTools` e adiciona quatro hooks `on('tool.call', { tool: … }, …)` que as respondem. Os tipos acrescentam que o registro "Rejects until the session binds, at `session.start`" (é rejeitado até a sessão se vincular, em `session.start`), e é por isso que `registerTools` é chamada a partir do hook `session.start`. Ela não é aguardada ali, e a sua falha é capturada: se as ferramentas não puderem ser registradas, o resto do painel continua funcionando.

### As declarações

Os nomes vêm de constantes em `hooks/todos.ts`. As descrições e os schemas estão em `hooks/register.tsx`, citados aqui do [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later):

```ts
await $.tool.register({
  name: TOOL_LIST,
  description:
    "List this project's pending tasks (the Narsil Check pane's Pendientes): id, name and content of each.",
})
await $.tool.register({
  name: TOOL_ADD,
  description:
    "Add a task to this project's Pendientes list in the Narsil Check pane. Use it when the user asks to note something to do later.",
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Short task name' },
      content: { type: 'string', description: 'Optional details' },
    },
    required: ['name'],
  },
})
await $.tool.register({
  name: TOOL_DONE,
  description:
    "Remove a finished task from this project's Pendientes list. Call it when you complete a task that is on the list.",
  inputSchema: {
    type: 'object',
    properties: { task: { type: 'string', description: 'The task id, or its exact name' } },
    required: ['task'],
  },
})
```

Com outra formatação. Tradução para o português das descrições: `todo_list` "lista as tarefas pendentes deste projeto (as Pendientes do painel do Narsil Check): id, nome e conteúdo de cada uma"; `todo_add` "adiciona uma tarefa à lista Pendientes deste projeto no painel do Narsil Check; use-a quando o usuário pedir para anotar algo para fazer depois", com `name` "nome curto da tarefa" e `content` "detalhes opcionais"; `todo_done` "remove uma tarefa concluída da lista Pendientes deste projeto; chame-a quando concluir uma tarefa que está na lista", com `task` "o id da tarefa, ou o seu nome exato".

`todo_list` não tem `inputSchema`; os tipos dizem que o padrão é `{ type: "object" }`, uma chamada sem argumentos. `todo_add_to_template` recebe `template` ("Folder name beside this project, or absolute path", nome de uma pasta ao lado deste projeto, ou caminho absoluto), `name` e `content` ("What to do and how it was done here: changes, files, problems and fixes", o que fazer e como foi feito aqui: mudanças, arquivos, problemas e correções), com `template` e `name` obrigatórios. A sua descrição nomeia uma pasta de modelo de exemplo, `backendTemplate`.

### Atender uma chamada

Cada hook lê os argumentos do próprio evento: os tipos descrevem a entrada de `tool.call` como portando as suas próprias chaves "beside the tool's own arguments" (ao lado dos argumentos da própria ferramenta), então o `name` de `todo_add` é `e.name`. O hook os confere, faz o trabalho pelas mesmas funções que o painel usa (`addTodo`, `finishTodo`, `readTodoFile`) e responde com uma de duas formas:

- `{ result: text }`: a saída da ferramenta, que o modelo lê.
- `{ deny: text }`: nas palavras dos tipos, "Refuses the call: the model receives the text as an error result" (recusa a chamada: o modelo recebe o texto como um resultado de erro).

O comentário do mod registra uma armadilha: "An MCP-style { content, isError } object is refused by the engine." (um objeto { content, isError } no estilo MCP é recusado pelo motor). A resposta é `result` ou `deny`, e nada mais.

As respostas são frases curtas em inglês com as quais o modelo pode agir:

- `todo_add`: `Added [mh3k2a1b4c9z] Review the README.` (tarefa adicionada).
- `todo_done` com uma tarefa desconhecida: `No pending task "readme". Call todo_list to see them.` (nenhuma tarefa pendente "readme"; chame todo_list para vê-las), como erro.
- `todo_list` numa lista vazia: `No pending tasks.` (nenhuma tarefa pendente).

Cada hook roda dentro de `answered`, que transforma qualquer erro lançado (um arquivo que não pode ser lido ou escrito) em `{ deny: 'The Pendientes list could not be changed: …' }` (a lista Pendientes não pôde ser alterada). Sem isso, uma escrita que falhou seria uma chamada de ferramenta falha sem explicação. Com isso, o Claude lê o motivo e pode contar a você.

Quando a mudança encontrou uma lista danificada (o guia anterior), a resposta traz a nota do painel depois de `Note for the user:` (nota para o usuário), para que o Claude a repasse. `todo_list` sobre um arquivo danificado recusa com "cannot be read (…). Tell the user; a change will keep a copy of it and start a new list." (não pode ser lido (…); avise o usuário; uma mudança vai guardar uma cópia dele e começar uma lista nova).

### Por que dar ferramentas ao modelo

O Claude já poderia editar `.atl/narsil-check/pendientes.json` com as suas ferramentas de arquivo. Geralmente funcionaria, e pularia tudo o que o último guia construiu: a cadeia que serializa as mudanças, a releitura antes de escrever, a cópia de um arquivo danificado, a linha de exclusão. Ele também poderia escrever uma forma que o leitor rejeita.

Uma ferramenta torna as regras da lista a única porta de entrada. O Claude não precisa conhecer o formato, o caminho nem as regras de segurança; ele diz "adicione isto" e o mod faz da mesma forma que o painel. O resultado também é verificável: o texto da ferramenta diz o que mudou, com o id.

Há uma segunda razão, específica da ferramenta de modelo: ela alcança outra pasta. `templateDir` resolve um nome para uma pasta ao lado deste projeto, comparando sem considerar maiúsculas, hifens, sublinhados ou espaços, primeiro de forma exata e, senão, por inclusão. Ela recusa com uma pergunta quando não há nenhuma ou há várias: "Several folders in … match "…": a, b. Ask the user which one." (várias pastas em … correspondem a "…": a, b; pergunte ao usuário qual). Uma regra assim é muito mais fácil de manter em código do que num prompt.

### Como o Claude decide usá-las

O modelo escolhe uma ferramenta pelo que lê sobre ela. Três coisas dão forma a essa escolha aqui.

**A descrição diz quando, não só o quê.** `todo_add` termina com "Use it when the user asks to note something to do later" (use-a quando o usuário pedir para anotar algo para fazer depois). `todo_done` diz "Call it when you complete a task that is on the list" (chame-a quando concluir uma tarefa que está na lista). Essa segunda frase é o que faz o Claude riscar uma tarefa por conta própria quando termina o trabalho, como o README promete: "la tacha él mismo al terminarla" ("ele mesmo a risca quando a termina").

**As ferramentas esperam atrás do ToolSearch.** O mod não passa `isDeferred`. Os tipos dizem que, se ele for omitido, "the engine's rule places it: behind ToolSearch, as it places an MCP server's tool" (a regra do motor a posiciona: atrás do ToolSearch, como posiciona a ferramenta de um servidor MCP). O modelo vê o nome da ferramenta numa lista de ferramentas adiadas e carrega o schema completo só quando a procura. Então as quatro ferramentas quase não custam contexto até serem necessárias. O comentário do mod diz isso diretamente, "behind ToolSearch, so they cost nothing until used" (atrás do ToolSearch, então não custam nada até serem usadas), e o README: "No las lee en cada mensaje, así que no gastan contexto hasta que las usa" ("Ele não as lê a cada mensagem, então elas não gastam contexto até que ele as use"). A troca é uma etapa de busca na primeira vez. Nomes como `todo_add` num servidor chamado `narsil-check` facilitam essa busca.

**O comando nomeia a ferramenta.** `/narsil-check template "…"` não chama a ferramenta ele mesmo. Ele envia um prompt com `$.prompt.submit`, montado por `templatePrompt`, que diz qual ferramenta usar (`mcp__narsil-check__todo_add_to_template`), que o modelo é um nome de pasta ao lado deste projeto ou um caminho absoluto, que coloque no conteúdo o que foi mudado, em quais arquivos, o que falhou e como foi resolvido, e que pergunte se a ferramenta não encontrar o modelo. O pedido da pessoa vai entre aspas. O mod entrega a parte que só o Claude pode fazer, a explicação, e fica com a parte que o código faz melhor, encontrar a pasta e escrever o arquivo.

Nada disso força uma chamada. O modelo ainda pode responder sem a ferramenta, ou perguntar primeiro. As descrições tornam a chamada certa a óbvia.

## Construa com o Claude

Peça ao Claude que dê ao modelo ferramentas sobre a lista que o painel já guarda. A única ideia que ele precisa acertar é que cada ferramenta é ao mesmo tempo declarada e atendida, e que toda ferramenta passa pela mesma função de mudança que o painel usa.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No meu mod do Claude Code `my-panel`, dê ao Claude ferramentas sobre a lista de pendências que eu já mantenho em `.atl/my-panel/todos.json`. Em `session.start`, sem aguardar e capturando a falha, chame `$.tool.register` três vezes: `todo_list` (sem entrada), `todo_add` (`name` obrigatório, `content` opcional) e `todo_done` (`task`, um id ou nome exato). Escreva cada descrição dizendo quando usá-la: "Use it when the user asks to note something to do later", "Call it when you complete a task that is on the list". Deixe `isDeferred` de fora. Atenda cada uma com `on('tool.call', { tool: 'mcp__my-panel__todo_add' }, …)`, lendo os argumentos do evento, e passe pela mesma função de mudança que o painel usa. Responda `{ result: text }` com uma frase curta que inclua o id da tarefa, ou `{ deny: text }` para uma entrada ruim ou qualquer erro lançado, nunca um `{ content, isError }` no estilo MCP. Teste cada ferramenta chamando-a com `$.tool.call` e conferindo o arquivo e o texto.

### O que conferir na resposta do Claude

1. As ferramentas são registradas com `$.tool.register` a partir de `session.start`, sem aguardá-lo, e uma falha é capturada para que o painel continue funcionando.
2. Cada nome declarado tem o seu próprio hook `tool.call`, reconhecido pelo nome completo `mcp__<plugin>__<name>`.
3. Cada hook responde `{ result: text }` ou `{ deny: text }`, nunca um `{ content, isError }` no estilo MCP, e qualquer erro lançado vira um `deny` com a sua causa.
4. Cada descrição diz quando usar a ferramenta, não só o que ela faz.
5. Os hooks adicionam, concluem e leem tarefas pelas mesmas funções que o painel usa. Nenhuma ferramenta escreve o arquivo do seu próprio jeito.

Se uma verificação falhar, diga ao Claude o que você vê: "pedi ao Claude que anotasse uma tarefa e a chamada da ferramenta falhou sem motivo".

### Como a pessoa autora pediu

O pedido original destas ferramentas não foi registrado. Nenhum registro de tarefas público no narsil-check cobre a lista de pendências nem as suas ferramentas. O que segue é uma reconstrução.

#### Reconstrução a partir do histórico de commits

A partir de `git log -S tool.register` sobre `hooks/register.tsx` e `git log -- hooks/todos.ts` no narsil-check:

- `5439638` (2026-11-05) "feat: Pendientes, a per-project task list Claude can read and finish" (Pendientes, uma lista de tarefas por projeto que o Claude pode ler e concluir). O único commit que adiciona `$.tool.register`. A sua mensagem: "Claude gets todo_list, todo_add and todo_done, and /narsil-check template "…" asks Claude to add a task, with how the work was done, to a template's list through todo_add_to_template." (o Claude recebe todo_list, todo_add e todo_done, e /narsil-check template "…" pede ao Claude que adicione uma tarefa, com a forma como o trabalho foi feito, à lista de um modelo por meio de todo_add_to_template). A lista e as ferramentas foram construídas juntas, então o painel e o Claude compartilharam um escritor desde o início.
- `8dc7904` (2026-11-05) "fix: keep a damaged Pendientes list and never let side steps block a save" (manter uma lista Pendientes danificada e nunca deixar que etapas secundárias bloqueiem um salvamento). Para as ferramentas: "Claude's tools return a readable error on any file failure" (as ferramentas do Claude retornam um erro legível em qualquer falha de arquivo). É daqui que vem `answered`.

## Código de referência

Esta é uma resposta correta, escrita para este guia. Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

Esta é uma versão reduzida da ideia, escrita para este guia e conferida com os tipos do Claude Code 2.1.325 (`$.tool.register`, `on('tool.call', { tool }, …)`, as respostas `result` e `deny`). Foi adaptada de `registerTools` e dos hooks `tool.call` em `hooks/register.tsx` do [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). `change` e `Task` são os do código do guia anterior, supostos em `./todos`.

```ts
import type { EngineInterface, Register } from 'claude-code'
import { change, type Task } from './todos'

const PLUGIN = 'my-panel'

type Answer = { result: string } | { deny: string }

async function answered(fn: () => Promise<Answer>): Promise<Answer> {
  try {
    return await fn()
  } catch (err) {
    return {
      deny: `The list could not be changed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

async function registerTools($: EngineInterface): Promise<void> {
  await $.tool.register({
    name: 'todo_add',
    description:
      "Add a task to this project's to-do list. Use it when the user asks to note something to do later.",
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Short task name' } },
      required: ['name'],
    },
  })
  await $.tool.register({
    name: 'todo_done',
    description:
      "Remove a finished task from this project's to-do list. Call it when you complete a task that is on the list.",
    inputSchema: {
      type: 'object',
      properties: { task: { type: 'string', description: 'The task id, or its exact name' } },
      required: ['task'],
    },
  })
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    void registerTools($).catch(() => undefined)
    return next(e)
  })

  on('tool.call', { tool: `mcp__${PLUGIN}__todo_add` }, async ($, e) =>
    answered(async () => {
      const name = (e as unknown as { name?: unknown }).name
      if (typeof name !== 'string' || !name.trim()) return { deny: 'A task needs a name.' }
      const task: Task = { id: Date.now().toString(36), name: name.trim() }
      await change($, await $.session.cwd(), (tasks) => [...tasks, task])
      return { result: `Added [${task.id}] ${task.name}.` }
    }),
  )

  on('tool.call', { tool: `mcp__${PLUGIN}__todo_done` }, async ($, e) =>
    answered(async () => {
      const ref = String((e as unknown as { task?: unknown }).task ?? '').trim()
      let removed: Task | undefined
      await change($, await $.session.cwd(), (tasks) => {
        removed =
          tasks.find((t) => t.id === ref) ??
          tasks.find((t) => t.name.toLowerCase() === ref.toLowerCase())
        return tasks.filter((t) => t !== removed)
      })
      return removed
        ? { result: `Removed [${removed.id}] ${removed.name}.` }
        : { deny: `No task "${ref}".` }
    }),
  )
}
```

Use o nível superior do git do projeto em vez de `$.session.cwd()` se a sua lista ficar ali, como faz o guia anterior.

## Erros comuns e como testar

Estes vêm do código e dos testes do Narsil Check:

- **Registrar antes de a sessão se vincular.** `$.tool.register` é rejeitado até `session.start`. Registre ali.
- **Declarar sem atender.** "a call no hook answers fails" (uma chamada que nenhum hook responde falha). Cada nome precisa do seu hook `tool.call`, associado ao `mcp__<plugin>__<name>` completo.
- **Responder na forma do MCP.** `{ content, isError }` é recusado. Use `result` ou `deny`.
- **Deixar uma exceção escapar.** O Claude recebe uma falha sem motivo. Envolva e responda `deny` com a causa.
- **Descrições que dizem só o quê.** Diga também quando chamá-la; é com isso que o modelo age.
- **Um segundo escritor.** Uma ferramenta que escreve o arquivo do seu próprio jeito contorna as regras de segurança. Reutilize a função do painel.
- **Comparar nomes com tolerância no código mas com rigor na descrição.** `todo_done` aceita um id ou um nome ignorando maiúsculas; o seu schema diz "exact name" (nome exato), o que mantém o modelo preciso enquanto o código continua tolerante.

Para testar, `claude plugin test .` executa `tests/todos.test.tsx`. "Claude's tools list, add and finish tasks, and a change made elsewhere is kept" (as ferramentas do Claude listam, adicionam e concluem tarefas, e uma mudança feita em outro lugar é mantida) chama as ferramentas por `$.tool.call` e confere os textos e o arquivo, incluindo uma tarefa que outro escritor adicionou no meio. "Claude is told about a damaged list instead of reading it as empty" (o Claude é avisado sobre uma lista danificada em vez de lê-la como vazia) confere o `deny` num arquivo quebrado, e "a list that cannot be written gives Claude a readable error, and the pane a toast" (uma lista que não pode ser escrita dá ao Claude um erro legível, e ao painel um toast) o caminho de `answered`. "a task for a template lands in that folder, and an unclear name asks which one" (uma tarefa para um modelo cai naquela pasta, e um nome pouco claro pergunta qual), "a template named by its absolute path is used as given; an unknown one asks the user" (um modelo nomeado pelo seu caminho absoluto é usado como foi dado; um desconhecido pergunta ao usuário) e "/narsil-check template hands the request to Claude, who knows how the work was done" (/narsil-check template entrega o pedido ao Claude, que sabe como o trabalho foi feito) cobrem a ferramenta de modelo e o seu comando.

## Para ir além

- `$.tool.register` também aceita `isDeferred: false`, que coloca o schema de uma ferramenta na lista de ferramentas do prompt. Só vale a pena para uma ferramenta de que o modelo precisa em quase todo turno.
- Uma ferramenta `todo_update` que edita o conteúdo de uma tarefa deixaria o Claude adicionar o que aprendeu enquanto trabalhava nela.
- O mesmo padrão serve para quaisquer dados do painel com os quais o modelo deva agir: uma ferramenta que lê as vulnerabilidades do guia 14 deixaria o Claude abrir um PR de correção a partir delas.
- O próximo e último guia desta trilha volta às atualizações, para o caso mais difícil: Kotlin, Gradle e o Android Gradle Plugin.
