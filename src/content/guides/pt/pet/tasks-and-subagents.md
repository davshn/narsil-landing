---
title: Tarefas e subagentes
description: 'Como a Narsil reconstrói a lista de tarefas de uma conversa a partir de TodoWrite, TaskCreate, TaskUpdate e do plano do app de desktop, e mostra cada subagente com tipo, modelo e tempo.'
route: pet
order: 4
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/tasks.ts
  - repo: pet
    path: hooks/agents.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## O que faz

Quando você abre uma conversa na faixa da Narsil (pressionando o nome dela, como explica o guia anterior), duas listas aparecem sob uma linha.

**As suas tarefas**, cada uma com uma marca para o seu estado:

| Marca | Estado                                                 |
| ----- | ------------------------------------------------------ |
| ○     | Pendente                                               |
| ◐     | Em andamento                                           |
| ●     | Concluída (desenhada esmaecida)                        |
| ⟳     | Em execução em segundo plano depois que o Claude parou |

A lista é a que o próprio Claude mantém enquanto trabalha: a lista de afazeres do `TodoWrite`, as tarefas do `TaskCreate` e do `TaskUpdate` ou o plano do aplicativo de desktop. Você vê o plano e o quanto ele já avançou sem rolar a transcrição.

**Os seus subagentes**, uma pequena serpente para cada um, com:

- **O seu tipo**, mostrado como um acessório: 🐍🔍 Explore, 🐍📜 Plan, 🐍📖 claude-code-guide, 🐍🪞 fork, um 🐍 sozinho para general-purpose e 🐍✨ para qualquer outro tipo.
- **O modelo em que roda e há quanto tempo está rodando**, por exemplo "🐍🔍 Explorar el overlay · Haiku 4.5 · 4 min" ("Explorar o overlay").
- **Um aviso quando fica em silêncio**: depois de cinco minutos sem usar nenhuma ferramenta, o chip fica amarelo e acrescenta "sin actividad" ("sem atividade"). Ele pode estar travado.
- **Como terminou**, por alguns segundos: "✓ … · terminado en 1 min 20 s" (terminado em), "✗ … · falló" (falhou) ou "■ … · detenido" (parado).

Um subagente que rodou em segundo plano também é anunciado, com a voz da Narsil e na janela flutuante, quando termina.

Como cada conversa informa as suas tarefas e os seus subagentes ao hub, você pode abrir a linha de outra conversa e ver o plano e os subagentes dela de onde estiver.

## Como funciona por dentro

### Tarefas: repetir as chamadas das ferramentas

O Claude Code não entrega a um mod "a lista de tarefas". A Narsil a reconstrói observando as chamadas das ferramentas que mantêm uma, e aplicando cada chamada à lista que ela já tem. A lógica é uma função pura, `applyTaskCall` em `hooks/tasks.ts`; o hook em `hooks/register.tsx` só a alimenta.

As ferramentas que ela lê (`TASK_TOOLS`) e o que cada chamada faz com a lista:

- **`TodoWrite`** envia a lista inteira toda vez (`todos`, cada um com `content` e `status`). A lista é substituída; os ids são as posições, `1`, `2`, `3`.
- **`TaskCreate`** adiciona uma tarefa. O id dela não está na entrada: ele volta no resultado da ferramenta (`result.task.id`). Por isso o hook lê o resultado e, quando não há nenhum, recorre à próxima posição.
- **`TaskUpdate`** muda uma tarefa por `taskId`: um novo `status`, um novo `subject` ou `status: 'deleted'`, que a remove.
- **`mcp__ccd_turn__update_plan`**, o plano do aplicativo de desktop (`PLAN_TOOL`). `applyPlan` trata as suas formas: `items` substitui a lista; `advance: true` conclui o passo em andamento e inicia o próximo pendente; `done: [n]` conclui passos pela sua posição, contada a partir de 1; `start: n` move a marca de em andamento para o passo `n`.
- **`mcp__ccd_turn__wrap_up`**, a caixa de próximo passo do aplicativo de desktop (`WRAP_UP_TOOL`). Ela fecha o turno e, no aplicativo, marca o plano como feito sem um último `update_plan`. Por isso a Narsil marca como concluída nela toda tarefa pendente ou em andamento. Esta é a correção descrita em "Como foi pedido à IA".

O hook em `tool.call` trata essas ferramentas só para a conversa principal (`e.agentId === undefined`) e numa ordem específica: aguarda `next(e)` primeiro e só aplica a chamada quando o resultado não é um erro e não foi negado. Um `TaskUpdate` recusado não pode mexer na lista, e o id de `TaskCreate` só existe depois que a ferramenta rodou. Em seguida, grava o atom `tasks` e envia o estado ao hub na hora.

O texto é limpo na entrada: espaços em branco reduzidos e cortado em 120 caracteres (`clean`), e a lista limitada a 30 tarefas (`MAX_TASKS`), já que ela viaja ao hub e ao celular a cada batimento.

### Trabalho em segundo plano como tarefas

Quando o laço principal para, o hook `classic.Stop` lê `e.background_tasks`: shells, monitores e subagentes ainda em execução. `backgroundTasks` os transforma em linhas extras com a marca ⟳, como "proceso en segundo plano: npm run dev" ("processo em segundo plano"). Elas ficam separadas da lista de tarefas e são juntadas a ela quando o estado é informado (`shownState`), e são apagadas no próximo `turn.start`. A mesma contagem diz a `turn.complete` que não comemore um fim enquanto o trabalho continua (veja o primeiro guia).

### Subagentes: três eventos

Os chips vêm de três eventos, e a escolha de cada um é deliberada:

- **`agent.spawn`** inicia um chip. O hook aguarda `next(e)` e registra a execução a partir da entrada e do resultado: `result.agentId`, `e.description` (a tarefa), `e.subagentType`, `e.background` e `result.model`. Ele ignora os lançamentos negados e os colegas de equipe (`e.isTeammate`). O comentário em `hooks/register.tsx` explica por que este evento e não a chamada da ferramenta `Agent`: "one in the background returns at once" (um em segundo plano retorna na hora), de modo que o fim da chamada da ferramenta não diz nada sobre quando o subagente termina.
- **`tool.call` com `e.agentId` definido**: o subagente usou uma ferramenta. `touchAgent` atualiza o seu `lastActiveAt`. É isso que torna "sem atividade" possível: a Narsil sabe a última vez em que cada subagente fez alguma coisa.
- **`turn.complete` com `e.agentId` definido**: o próprio turno do subagente terminou. `endAgent` guarda `endedAt` e um desfecho a partir de `e.reason`: `answer` é terminado, `aborted` é parado e qualquer outra coisa é falha. Um subagente em segundo plano é anunciado.

As execuções ficam no atom `agents`, e os chips (texto e cor, prontos para desenhar) em `agentChips`.

### Os chips são recalculados a cada batimento

O tempo passa sem nenhum evento: um subagente que não faz nada não emite nada. Por isso `refreshAgents` roda a cada batimento de dois segundos (`beat`), além de depois de cada um dos três eventos. Ele remove as execuções terminadas há mais de dez segundos (`liveRuns`, `ENDED_SHOWN_MS`), recalcula cada chip com `agentChip` e só grava o atom e envia ao hub quando o texto ou a cor de um chip mudou.

`agentChip` em `hooks/agents.ts` monta o texto:

- A marca do tipo, de `TYPE_MARK`, com ✨ para tipos desconhecidos.
- A tarefa e depois o modelo, por meio de `modelLabel`, que lê ids e apelidos como uma pessoa leria: `claude-opus-5-5` vira "Opus 5.5", `claude-3-5-sonnet-20241022` vira "Sonnet 3.5" e `opus[1m]` vira "Opus (1M)".
- Os minutos, a partir de um minuto.
- "sin actividad" assim que `now - lastActiveAt` chega a `QUIET_MS` (cinco minutos), com o tom amarelo.
- Para uma execução terminada, ✓ com o tempo de `took`, ✗ ou ■.

As cores estão em `TONE_COLOR`: cinza para em execução, amarelo `#F5B400` para em silêncio, verde para terminado, vermelho para falha e cinza-azulado para parado.

### Por que está dividido assim

Os dois arquivos, `hooks/tasks.ts` e `hooks/agents.ts`, são puros: valores simples entram, valores simples saem, sem `$`. O módulo de hooks cuida dos eventos e dos atoms. É essa divisão que permite aos testes conferir cada forma de ferramenta e cada texto de chip sem uma sessão, e permite que a mesma lista seja desenhada pela faixa, pela janela flutuante e pela faixa de outra conversa.

## Construa com o Claude

Peça ao Claude uma lista de tarefas reconstruída a partir das chamadas das ferramentas de tarefas, e um chip para cada subagente em execução. A única ideia que o Claude precisa acertar é o momento: uma chamada de tarefa só muda a lista depois que `next(e)` retornou sem erro, e um subagente é cronometrado pelos seus próprios eventos, não pela chamada da ferramenta `Agent`.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No meu mod do Claude Code, mostre a lista de tarefas da conversa principal na faixa `AbovePrompt`. Em `tool.call`, para as chamadas de `TodoWrite`, `TaskCreate` e `TaskUpdate` sem `agentId`, aguarde `next(e)` e, quando o resultado não for um erro, aplique a chamada a uma lista guardada num atom: `TodoWrite` a substitui, `TaskCreate` adiciona a tarefa com o id vindo do seu resultado, `TaskUpdate` muda ou apaga uma tarefa por `taskId`. Mantenha essa lógica como uma função pura em `hooks/tasks.ts`, com testes para cada ferramenta. Mostre também uma linha por subagente em execução: inicie-a em `agent.spawn` (tarefa, `subagentType`, `result.model`), marque-a como ativa nas suas `tool.call`, termine-a no seu `turn.complete` e, a cada poucos segundos, recalcule o texto para que um subagente parado há cinco minutos diga isso. Confira cada campo com os tipos do plugin-authoring.

### O que conferir na resposta do Claude

1. O hook `tool.call` aguarda `next(e)` antes de mudar a lista, e deixa a lista em paz quando o resultado é um erro ou foi negado.
2. As chamadas de tarefas só mudam a lista quando `e.agentId` é indefinido, então um subagente que chama `TodoWrite` não substitui a lista principal.
3. `TaskCreate` pega o id da tarefa do resultado da ferramenta, não da sua entrada.
4. Um chip começa em `agent.spawn` e termina no próprio `turn.complete` do subagente, não quando a chamada da ferramenta `Agent` retorna.
5. Os chips são recalculados com um relógio, então um subagente parado há cinco minutos é marcado como quieto mesmo quando nenhum evento chega.

Se uma verificação falhar, diga ao Claude o que você vê: "o chip de um subagente em segundo plano some no momento em que ele começa".

### Como a pessoa autora pediu

#### Tarefas: registradas no log do fleet-view

A lista de tarefas por conversa foi pedida em `odd/tasks/fleet-view.md` no narsil-pet. Em L2 (trecho), a pessoa autora escreveu:

> "al hacer click en el titulo de conversacion deberiamos poder ver sus sub agentes/ tareas y sus respectivos estados"

Tradução para o português: clicar no título de uma conversa deveria mostrar os seus subagentes e tarefas com os seus estados.

E em L3 (trecho):

> "cuando entre a una de esas conversaciones estaria de nuevo su contexto, sus tareas con su estado (no es necesario barra de avance) y sus sub agentes"

Tradução para o português: ao entrar numa dessas conversas, estariam de novo o seu contexto, as suas tarefas com o seu estado (sem necessidade de barra de progresso) e os seus subagentes. É por isso que as tarefas aparecem como marcas e não como uma porcentagem.

L7 registra o resultado: a conversa aberta mostra as suas tarefas e os seus subagentes, e "Tasks come from TodoWrite, TaskCreate/TaskUpdate, the desktop app's update_plan (hooks/tasks.ts) and background work at Stop." (as tarefas vêm de TodoWrite, TaskCreate/TaskUpdate, do update_plan do aplicativo de desktop, em hooks/tasks.ts, e do trabalho em segundo plano no Stop).

Depois, a pessoa autora relatou um bug, L12:

> "lo unico raro que veo es que las tareas de esta sesion las marca como en curso, o no empezadas, cuando el agente ya acabo, esto pasa en las dos ventanas, ademas note que creaste las tareas de la pwa en este proyecto, debias crearlo en proyecto de la pwa"

Tradução para o português: a única coisa estranha é que as tarefas desta sessão aparecem como em andamento ou não iniciadas quando o agente já terminou, nas duas janelas; a pessoa autora também notou que as tarefas de acompanhamento da PWA foram criadas neste projeto em vez de no projeto da PWA. (A segunda parte trata de onde as notas de acompanhamento foram guardadas, não desta funcionalidade.)

L13 registra a causa e a correção: "the desktop app's `mcp__ccd_turn__wrap_up` checks the plan off with no last `update_plan`; the mod now marks every pending or in-progress task completed on it (hooks/tasks.ts)" (o `mcp__ccd_turn__wrap_up` do aplicativo de desktop marca o plano como feito sem um último `update_plan`; o mod agora marca como concluída nele toda tarefa pendente ou em andamento, em hooks/tasks.ts), com um teste falhando observado primeiro. O commit é `5e9ca71` (2026-11-06) "fix: check the plan off when the app's next-step box closes the turn" (marcar o plano como feito quando a caixa de próximo passo do aplicativo fecha o turno).

#### Subagentes: reconstrução a partir do histórico de commits

O pedido original dos chips de subagentes não foi registrado. A partir de `git log -- hooks/agents.ts hooks/register.tsx`:

- `c885292` (2026-10-30) "feat: estimate when the context fills, react to tests and dangerous commands, show subagents" (estimar quando o contexto vai encher, reagir a testes e a comandos perigosos, mostrar subagentes). Os primeiros chips.
- `e5ba5ca` (2026-10-30) "feat: show each subagent's type, time, quiet spells and outcome" (mostrar o tipo, o tempo, os períodos de silêncio e o desfecho de cada subagente). As marcas por tipo, os minutos, o aviso de silêncio e o final.
- `f29cb5e` (2026-10-31) "feat: show the model of the main thread and of each subagent" (mostrar o modelo da linha principal e de cada subagente). O rótulo do modelo.
- `519dd73` (2026-11-06) "fix: wait for background work before announcing a turn finished" (esperar o trabalho em segundo plano antes de anunciar que um turno terminou). Os subagentes em segundo plano viram linhas ⟳.
- `49f0fd9` (2026-11-06) "feat: list every open conversation in the band" (listar todas as conversas abertas na faixa). A mensagem diz que abrir uma linha mostra "its context (the word opens what fills it), its tasks and its subagents" (o seu contexto, em que a palavra abre o que o preenche, as suas tarefas e os seus subagentes).

## Código de referência

Esta é uma resposta correta, escrita para este guia. Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

Escrito para este guia e conferido com os tipos da 2.1.325. Foi adaptado de `hooks/tasks.ts`, `hooks/agents.ts` e `hooks/register.tsx` do [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). Os atoms `tasks` e `runs` são declarados em `types/index.d.ts` como no primeiro guia.

O redutor puro, `hooks/tasks.ts`:

```ts
export type Task = { id: string; text: string; status: 'pending' | 'in_progress' | 'completed' }

const STATUSES = ['pending', 'in_progress', 'completed']
const statusOf = (v: unknown, fallback: Task['status'] = 'pending') =>
  STATUSES.includes(v as string) ? (v as Task['status']) : fallback

export function applyTaskCall(
  list: readonly Task[],
  tool: string,
  input: Record<string, unknown>,
  result?: unknown,
): readonly Task[] {
  if (tool === 'TodoWrite' && Array.isArray(input.todos)) {
    return (input.todos as Record<string, unknown>[]).map((t, i) => ({
      id: String(i + 1),
      text: String(t.content ?? ''),
      status: statusOf(t.status),
    }))
  }
  if (tool === 'TaskCreate') {
    const task = (result as { task?: { id?: unknown; subject?: unknown } } | undefined)?.task
    const id = task?.id === undefined ? String(list.length + 1) : String(task.id)
    return [
      ...list.filter((t) => t.id !== id),
      { id, text: String(task?.subject ?? input.subject ?? ''), status: 'pending' },
    ]
  }
  if (tool === 'TaskUpdate') {
    const id = String(input.taskId ?? '')
    if (input.status === 'deleted') return list.filter((t) => t.id !== id)
    return list.map((t) => (t.id === id ? { ...t, status: statusOf(input.status, t.status) } : t))
  }
  return list
}
```

Os hooks, em `hooks/register.tsx`:

```tsx
const TASK_TOOLS = new Set(['TodoWrite', 'TaskCreate', 'TaskUpdate'])
const QUIET_MS = 5 * 60_000

on('tool.call', async ($, e, next) => {
  if (e.agentId !== undefined) {
    const now = await $.clock.now()
    await update($, runs, (list) =>
      list.map((r) => (r.id === e.agentId ? { ...r, lastActiveAt: now } : r)),
    )
    return next(e)
  }
  if (!TASK_TOOLS.has(e.tool)) return next(e)
  const result = await next(e)
  if (!result.isError && !('deny' in result && result.deny)) {
    const input = e as unknown as Record<string, unknown>
    await update($, tasks, (list) =>
      applyTaskCall(list, e.tool, input, 'result' in result ? result.result : undefined),
    )
  }
  return result
})

on('agent.spawn', async ($, e, next) => {
  const result = await next(e)
  if ('deny' in result || e.isTeammate || !result.agentId) return result
  const now = await $.clock.now()
  const run = {
    id: result.agentId,
    task: e.description || 'task',
    type: e.subagentType,
    model: result.model,
    startedAt: now,
    lastActiveAt: now,
  }
  await update($, runs, (list) => [...list.filter((r) => r.id !== run.id), run])
  return result
})

on('turn.complete', async ($, e, next) => {
  const result = await next(e)
  if (e.agentId !== undefined)
    await update($, runs, (list) => list.filter((r) => r.id !== e.agentId))
  return result
})
```

No hook de renderização, uma execução está em silêncio quando `(await $.clock.now()) - run.lastActiveAt >= QUIET_MS`. A Narsil também mantém as execuções terminadas por dez segundos para mostrar como terminaram, e recalcula os chips num batimento de `$.clock.every`, para que "sem atividade" apareça mesmo quando nenhum evento chega. Uma versão mínima pode fazer o mesmo com `$.clock.every(5000, ...)` atualizando um atom que a faixa lê.

## Erros comuns e como testar

- **Aplicar a chamada antes de ela rodar.** O id de `TaskCreate` só está no resultado, e uma chamada negada ou que falhou não pode mudar a lista. Aguarde `next(e)` e depois aplique.
- **Tratar as ferramentas de tarefas dos próprios subagentes como a lista principal.** Um subagente também pode chamar `TodoWrite`. A Narsil só aplica chamadas de tarefas quando `e.agentId` é undefined.
- **Planos que nunca terminam.** No aplicativo de desktop, a caixa de próximo passo (`mcp__ccd_turn__wrap_up`) fecha o turno e marca o plano como feito sem um último `update_plan`. Sem tratar isso, os últimos passos ficam "em andamento" para sempre (fleet-view L12 e L13, commit `5e9ca71`).
- **Medir o tempo dos subagentes pela chamada da ferramenta `Agent`.** A chamada da ferramenta de um subagente em segundo plano retorna na hora. Use `agent.spawn` e o próprio `turn.complete` do subagente.
- **Um aviso de silêncio que nunca aparece.** Nada emite um evento enquanto um subagente está parado. Recalcule com um relógio.
- **Regravar o estado a cada tique.** Compare antes de gravar; o `refreshAgents` da Narsil só grava e envia quando um chip mudou.
- **Texto sem limite.** Assuntos e descrições de tarefas podem ser longos. Limpe-os e limite-os antes que viajem.

Para testar, `claude plugin test .` executa `tests/narsil.test.tsx`. "the task tools leave this conversation its list, for the band and the hub" (as ferramentas de tarefas deixam a esta conversa a sua lista, para a faixa e para o hub) chama `TodoWrite`, `TaskCreate` e `TaskUpdate`, depois o plano do desktop com `items` e `advance`, depois `mcp__ccd_turn__wrap_up`, e confere as linhas da faixa (" ● Leer", " ◐ Escribir el test") e a lista enviada ao hub. Para os subagentes, "each subagent shows its type, how long it has run, and when it has gone quiet" (cada subagente mostra o seu tipo, há quanto tempo está rodando e quando ficou em silêncio) avança um relógio simulado (`mock.clock`) e confere os chips, incluindo o amarelo `#F5B400`; "a finished subagent stays a few seconds with how it ended, then leaves" (um subagente terminado fica alguns segundos mostrando como terminou e depois sai), "each subagent shows the model it runs on" (cada subagente mostra o modelo em que roda) e "the subagent chips show each type with its own mark" (os chips de subagentes mostram cada tipo com a sua própria marca) cobrem o resto.

## Para ir além

- `applyPlan` em `hooks/tasks.ts` trata todas as formas do plano do aplicativo de desktop; `TASK_ICON` guarda as marcas.
- `backgroundTasks` nomeia o trabalho em segundo plano por tipo: processo, monitor, subagente.
- `refreshAgents`, `touchAgent` e `endAgent` em `hooks/register.tsx` gerenciam as execuções; `endAgent` também dá experiência por um subagente que terminou bem (`gainXp($, 'agent')`) e anuncia os que rodaram em segundo plano.
- `modelLabel` e `took` em `hooks/agents.ts` são os auxiliares de formatação, e `MAX_AGENTS_SHOWN` em `hooks/words.ts` limita a faixa a seis chips.
- O bloco da conversa aberta no hook de renderização de `AbovePrompt` desenha "Tareas:" e cada tarefa com `TASK_COLOR`, depois os chips, para qualquer conversa que esteja aberta, usando as tarefas e os chips que essa conversa informou ao hub.
