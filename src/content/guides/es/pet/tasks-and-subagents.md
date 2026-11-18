---
title: Tareas y subagentes
description: 'Cómo Narsil reconstruye las tareas de una conversación a partir de TodoWrite, TaskCreate, TaskUpdate y el plan de la app de escritorio, y muestra cada subagente con su tipo, modelo y tiempo.'
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

## Qué hace

Cuando abres una conversación en la banda de Narsil (pulsando su nombre, como explica la guía anterior), aparecen dos listas bajo una línea.

**Sus tareas**, cada una con una marca para su estado:

| Marca | Estado                                                  |
| ----- | ------------------------------------------------------- |
| ○     | Pendiente                                               |
| ◐     | En curso                                                |
| ●     | Hecha (se dibuja atenuada)                              |
| ⟳     | En marcha en segundo plano después de que Claude parara |

La lista es la que Claude lleva para sí mismo mientras trabaja: la lista de pendientes de `TodoWrite`, las tareas de `TaskCreate` y `TaskUpdate`, o el plan de la app de escritorio. Ves el plan y cuánto se ha avanzado sin desplazarte por la transcripción.

**Sus subagentes**, una pequeña serpiente por cada uno, con:

- **Su tipo**, mostrado como accesorio: 🐍🔍 Explore, 🐍📜 Plan, 🐍📖 claude-code-guide, 🐍🪞 fork, un 🐍 solo para general-purpose y 🐍✨ para cualquier otro tipo.
- **El modelo con el que se ejecuta y cuánto tiempo lleva**, por ejemplo "🐍🔍 Explorar el overlay · Haiku 4.5 · 4 min".
- **Un aviso cuando se queda callado**: tras cinco minutos sin usar ninguna herramienta, el chip se vuelve amarillo y añade "sin actividad". Puede que esté atascado.
- **Cómo terminó**, durante unos segundos: "✓ … · terminado en 1 min 20 s", "✗ … · falló" o "■ … · detenido".

Un subagente que se ejecutó en segundo plano también se anuncia, con la voz de Narsil y en la ventana flotante, cuando termina.

Como cada conversación envía sus tareas y sus subagentes al hub, puedes abrir la fila de otra conversación y ver su plan y sus subagentes desde donde estás.

## Cómo funciona por dentro

### Tareas: reproducir las llamadas de las herramientas

Claude Code no le entrega a un mod "la lista de tareas". Narsil la reconstruye observando las llamadas de las herramientas que llevan una, y aplicando cada llamada a la lista que ya tiene. La lógica es una función pura, `applyTaskCall` en `hooks/tasks.ts`; el hook de `hooks/register.tsx` solo la alimenta.

Las herramientas que lee (`TASK_TOOLS`) y lo que cada llamada hace con la lista:

- **`TodoWrite`** envía la lista entera cada vez (`todos`, cada una con `content` y `status`). La lista se sustituye; los ids son las posiciones, `1`, `2`, `3`.
- **`TaskCreate`** añade una tarea. Su id no está en la entrada: vuelve en el resultado de la herramienta (`result.task.id`). Por eso el hook lee el resultado, y recurre a la siguiente posición cuando no hay ninguno.
- **`TaskUpdate`** cambia una tarea por `taskId`: un `status` nuevo, un `subject` nuevo, o `status: 'deleted'`, que la elimina.
- **`mcp__ccd_turn__update_plan`**, el plan de la app de escritorio (`PLAN_TOOL`). `applyPlan` maneja sus formas: `items` sustituye la lista; `advance: true` completa el paso en curso e inicia el siguiente pendiente; `done: [n]` completa pasos por su posición contando desde 1; `start: n` mueve la marca de en curso al paso `n`.
- **`mcp__ccd_turn__wrap_up`**, el recuadro de siguiente paso de la app de escritorio (`WRAP_UP_TOOL`). Cierra el turno y, en la app, marca el plan como hecho sin un último `update_plan`. Por eso Narsil marca como completada en ese momento cada tarea pendiente o en curso. Esta es la corrección que se describe en "Cómo se le pidió a la IA".

El hook de `tool.call` maneja estas herramientas solo para la conversación principal (`e.agentId === undefined`) y en un orden concreto: espera primero a `next(e)`, y aplica la llamada solo cuando el resultado no es un error y no fue denegado. Un `TaskUpdate` rechazado no debe mover la lista, y el id de `TaskCreate` solo existe después de que la herramienta se ejecutó. Después escribe el átomo `tasks` y envía el estado al hub en el acto.

El texto se limpia al entrar: los espacios en blanco se compactan y se corta a 120 caracteres (`clean`), y la lista se limita a 30 tareas (`MAX_TASKS`), ya que viaja al hub y al teléfono en cada latido.

### El trabajo en segundo plano como tareas

Cuando el bucle principal se detiene, el hook `classic.Stop` lee `e.background_tasks`: shells, monitores y subagentes que siguen en marcha. `backgroundTasks` los convierte en filas extra con la marca ⟳, como "proceso en segundo plano: npm run dev". Se guardan aparte de la lista de tareas y se unen a ella cuando se informa del estado (`shownState`), y se borran en el siguiente `turn.start`. La misma cuenta le dice a `turn.complete` que no celebre un final mientras sigue habiendo trabajo (ver la primera guía).

### Subagentes: tres eventos

Los chips salen de tres eventos, y la elección de cada uno es deliberada:

- **`agent.spawn`** inicia un chip. El hook espera a `next(e)` y registra la ejecución a partir de la entrada y del resultado: `result.agentId`, `e.description` (la tarea), `e.subagentType`, `e.background` y `result.model`. Omite los lanzamientos denegados y los compañeros de equipo (`e.isTeammate`). El comentario de `hooks/register.tsx` explica por qué este evento y no la llamada a la herramienta `Agent`: "one in the background returns at once" (uno en segundo plano vuelve en el acto), así que el final de la llamada a la herramienta no dice nada sobre cuándo termina el subagente.
- **`tool.call` con `e.agentId` definido**: el subagente usó una herramienta. `touchAgent` actualiza su `lastActiveAt`. Esto es lo que hace posible "sin actividad": Narsil sabe la última vez que cada subagente hizo algo.
- **`turn.complete` con `e.agentId` definido**: terminó el propio turno del subagente. `endAgent` guarda `endedAt` y un resultado a partir de `e.reason`: `answer` es terminado, `aborted` es detenido y cualquier otra cosa es fallido. Si era en segundo plano, se anuncia.

Las ejecuciones viven en el átomo `agents`, y los chips (texto y color, listos para dibujar) en `agentChips`.

### Los chips se recalculan en cada latido

El tiempo pasa sin que haya eventos: un subagente que no hace nada no lanza nada. Por eso `refreshAgents` se ejecuta en cada latido de dos segundos (`beat`) además de después de cada uno de los tres eventos. Elimina las ejecuciones terminadas hace más de diez segundos (`liveRuns`, `ENDED_SHOWN_MS`), recalcula cada chip con `agentChip`, y escribe el átomo y envía al hub solo cuando cambió el texto o el color de un chip.

`agentChip` en `hooks/agents.ts` construye el texto:

- La marca del tipo, de `TYPE_MARK`, con ✨ para los tipos desconocidos.
- La tarea, después el modelo mediante `modelLabel`, que lee ids y alias como lo haría una persona: `claude-opus-5-5` pasa a ser "Opus 5.5", `claude-3-5-sonnet-20241022` pasa a ser "Sonnet 3.5" y `opus[1m]` pasa a ser "Opus (1M)".
- Los minutos, a partir de un minuto.
- "sin actividad" en cuanto `now - lastActiveAt` llega a `QUIET_MS` (cinco minutos), con el tono amarillo.
- Para una ejecución terminada, ✓ con el tiempo de `took`, ✗ o ■.

Los colores están en `TONE_COLOR`: gris para en marcha, amarillo `#F5B400` para callado, verde para terminado, rojo para fallido y gris azulado para detenido.

### Por qué está dividido así

Los dos archivos, `hooks/tasks.ts` y `hooks/agents.ts`, son puros: entran valores simples, salen valores simples, sin `$`. El módulo de hooks es dueño de los eventos y de los átomos. Esa división es la que permite que los tests comprueben cada forma de herramienta y cada texto de chip sin una sesión, y que la misma lista la dibujen la banda, la ventana flotante y la banda de otra conversación.

## Constrúyelo con Claude

Pídele a Claude una lista de tareas reconstruida a partir de las llamadas de las herramientas de tareas, y un chip por cada subagente en marcha. La idea que Claude debe acertar es el momento: una llamada de tarea cambia la lista solo después de que `next(e)` volvió sin error, y un subagente se cronometra por sus propios eventos, no por la llamada a la herramienta `Agent`.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil.

> En mi mod de Claude Code, muestra la lista de tareas de la conversación principal en la banda `AbovePrompt`. En `tool.call`, para las llamadas a `TodoWrite`, `TaskCreate` y `TaskUpdate` sin `agentId`, espera a `next(e)` y, cuando el resultado no sea un error, aplica la llamada a una lista guardada en un átomo: `TodoWrite` la sustituye, `TaskCreate` añade la tarea con el id de su resultado, `TaskUpdate` cambia o elimina una por `taskId`. Deja esa lógica como una función pura en `hooks/tasks.ts` con tests para cada herramienta. Muestra también una línea por cada subagente en marcha: iníciala en `agent.spawn` (tarea, `subagentType`, `result.model`), márcala como activa en sus `tool.call` y termínala en su `turn.complete`, y recalcula el texto cada pocos segundos para que un subagente inactivo durante cinco minutos lo diga. Comprueba cada campo con los tipos de plugin-authoring.

### Qué revisar en la respuesta de Claude

1. El hook `tool.call` espera a `next(e)` antes de cambiar la lista, y no toca la lista cuando el resultado es un error o se denegó.
2. Las llamadas de tareas cambian la lista solo cuando `e.agentId` no está definido, así que un subagente que llama a `TodoWrite` no sustituye la lista principal.
3. `TaskCreate` toma el id de la tarea del resultado de la herramienta, no de su entrada.
4. Un chip empieza en `agent.spawn` y termina en el propio `turn.complete` del subagente, no cuando vuelve la llamada a la herramienta `Agent`.
5. Los chips se recalculan con un reloj, así que un subagente inactivo durante cinco minutos se marca como callado aunque no llegue ningún evento.

Si una comprobación falla, dile a Claude lo que ves: "el chip de un subagente en segundo plano desaparece en cuanto empieza".

### Cómo lo pidió el autor

#### Tareas: registradas en el registro de fleet-view

La lista de tareas por conversación se pidió en `odd/tasks/fleet-view.md` en narsil-pet. En L2 (extracto), quien creó Narsil escribió:

> "al hacer click en el titulo de conversacion deberiamos poder ver sus sub agentes/ tareas y sus respectivos estados"

Y en L3 (extracto):

> "cuando entre a una de esas conversaciones estaria de nuevo su contexto, sus tareas con su estado (no es necesario barra de avance) y sus sub agentes"

Por eso las tareas se muestran con marcas y no como un porcentaje.

L7 recoge el resultado: la conversación abierta muestra sus tareas y sus subagentes, y "Tasks come from TodoWrite, TaskCreate/TaskUpdate, the desktop app's update_plan (hooks/tasks.ts) and background work at Stop." (las tareas salen de TodoWrite, de TaskCreate y TaskUpdate, del update_plan de la app de escritorio, en hooks/tasks.ts, y del trabajo en segundo plano en Stop).

Después, el autor o la autora informó de un fallo, L12:

> "lo unico raro que veo es que las tareas de esta sesion las marca como en curso, o no empezadas, cuando el agente ya acabo, esto pasa en las dos ventanas, ademas note que creaste las tareas de la pwa en este proyecto, debias crearlo en proyecto de la pwa"

(La segunda parte trata de dónde se guardaron las notas de seguimiento, no de esta funcionalidad.)

L13 recoge la causa y la corrección: "the desktop app's `mcp__ccd_turn__wrap_up` checks the plan off with no last `update_plan`; the mod now marks every pending or in-progress task completed on it (hooks/tasks.ts)" (el `mcp__ccd_turn__wrap_up` de la app de escritorio marca el plan como hecho sin un último `update_plan`; ahora el mod marca como completada cada tarea pendiente o en curso en ese momento, en hooks/tasks.ts), con un test que falla observado primero. El commit es `5e9ca71` (2026-11-06) "fix: check the plan off when the app's next-step box closes the turn" (marcar el plan como hecho cuando el recuadro de siguiente paso de la app cierra el turno).

#### Reconstrucción a partir del historial de commits: subagentes

La petición original de los chips de subagentes no quedó registrada. A partir de `git log -- hooks/agents.ts hooks/register.tsx`:

- `c885292` (2026-10-30) "feat: estimate when the context fills, react to tests and dangerous commands, show subagents" (estimar cuándo se llena el contexto, reaccionar a los tests y a los comandos peligrosos, mostrar los subagentes). Los primeros chips.
- `e5ba5ca` (2026-10-30) "feat: show each subagent's type, time, quiet spells and outcome" (mostrar el tipo, el tiempo, los ratos de silencio y el resultado de cada subagente). Las marcas por tipo, los minutos, el aviso de silencio y el final.
- `f29cb5e` (2026-10-31) "feat: show the model of the main thread and of each subagent" (mostrar el modelo del hilo principal y de cada subagente). La etiqueta del modelo.
- `519dd73` (2026-11-06) "fix: wait for background work before announcing a turn finished" (esperar al trabajo en segundo plano antes de anunciar que un turno terminó). Los subagentes en segundo plano pasan a ser filas ⟳.
- `49f0fd9` (2026-11-06) "feat: list every open conversation in the band" (enumerar en la banda todas las conversaciones abiertas). Su mensaje dice que abrir una fila muestra "its context (the word opens what fills it), its tasks and its subagents" (su contexto, cuya palabra abre lo que lo llena, sus tareas y sus subagentes).

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Escrito para esta guía y comprobado con los tipos de 2.1.325. Está adaptado de `hooks/tasks.ts`, `hooks/agents.ts` y `hooks/register.tsx` de [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). Los átomos `tasks` y `runs` se declaran en `types/index.d.ts` como en la primera guía.

El reductor puro, `hooks/tasks.ts`:

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

Los hooks, en `hooks/register.tsx`:

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

En el hook de dibujo, una ejecución está callada cuando `(await $.clock.now()) - run.lastActiveAt >= QUIET_MS`. Narsil además conserva las ejecuciones terminadas durante diez segundos para mostrar cómo terminaron, y recalcula los chips en un latido de `$.clock.every` para que "sin actividad" aparezca aunque no llegue ningún evento. Una versión mínima puede hacer lo mismo con `$.clock.every(5000, ...)` actualizando un átomo que lea la banda.

## Errores comunes y cómo probarlo

- **Aplicar la llamada antes de que se ejecute.** El id de `TaskCreate` solo está en el resultado, y una llamada denegada o fallida no debe cambiar la lista. Espera a `next(e)` y después aplica.
- **Tomar las herramientas de tareas de los subagentes como la lista principal.** Un subagente también puede llamar a `TodoWrite`. Narsil aplica las llamadas de tareas solo cuando `e.agentId` no está definido.
- **Planes que nunca terminan.** En la app de escritorio, el recuadro de siguiente paso (`mcp__ccd_turn__wrap_up`) cierra el turno y marca el plan como hecho sin un último `update_plan`. Si no lo manejas, los últimos pasos se quedan "en curso" para siempre (L12 y L13 de fleet-view, commit `5e9ca71`).
- **Medir el tiempo de los subagentes por la llamada a la herramienta `Agent`.** La llamada a la herramienta de un subagente en segundo plano vuelve en el acto. Usa `agent.spawn` y el propio `turn.complete` del subagente.
- **Un aviso de silencio que nunca aparece.** Nada lanza un evento mientras un subagente está inactivo. Recalcula con un reloj.
- **Reescribir el estado en cada tic.** Compara antes de escribir; `refreshAgents` de Narsil escribe y envía solo cuando cambió un chip.
- **Texto sin límite.** Los asuntos y las descripciones de las tareas pueden ser largos. Límpialos y limítalos antes de que viajen.

Para probarlo, `claude plugin test .` ejecuta `tests/narsil.test.tsx`. "the task tools leave this conversation its list, for the band and the hub" (las herramientas de tareas dejan a esta conversación su lista, para la banda y para el hub) llama a `TodoWrite`, `TaskCreate` y `TaskUpdate`, después al plan de escritorio con `items` y `advance`, después a `mcp__ccd_turn__wrap_up`, y comprueba las líneas de la banda (" ● Leer", " ◐ Escribir el test") y la lista enviada al hub. Para los subagentes, "each subagent shows its type, how long it has run, and when it has gone quiet" (cada subagente muestra su tipo, cuánto tiempo lleva y cuándo se ha quedado callado) adelanta un reloj simulado (`mock.clock`) y comprueba los chips, incluido el amarillo `#F5B400`; "a finished subagent stays a few seconds with how it ended, then leaves" (un subagente terminado se queda unos segundos con cómo terminó y después se va), "each subagent shows the model it runs on" (cada subagente muestra el modelo con el que se ejecuta) y "the subagent chips show each type with its own mark" (los chips de subagentes muestran cada tipo con su propia marca) cubren el resto.

## Para ir más lejos

- `applyPlan` en `hooks/tasks.ts` maneja todas las formas del plan de la app de escritorio; `TASK_ICON` contiene las marcas.
- `backgroundTasks` nombra el trabajo en segundo plano según su clase: proceso, monitor, subagente.
- `refreshAgents`, `touchAgent` y `endAgent` en `hooks/register.tsx` gestionan las ejecuciones; `endAgent` además da experiencia por un subagente que terminó bien (`gainXp($, 'agent')`) y anuncia los que iban en segundo plano.
- `modelLabel` y `took` en `hooks/agents.ts` son las funciones auxiliares de formato, y `MAX_AGENTS_SHOWN` en `hooks/words.ts` limita la banda a seis chips.
- El bloque de la conversación abierta en el hook de dibujo de `AbovePrompt` dibuja "Tareas:" y cada tarea con `TASK_COLOR`, después los chips, para la conversación que esté abierta, usando las tareas y los chips que esa conversación envió al hub.
