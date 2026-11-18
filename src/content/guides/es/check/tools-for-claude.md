---
title: Herramientas para Claude
description: 'Cómo Narsil Check da a Claude cuatro herramientas sobre la lista de pendientes con $.tool.register, las sirve desde hooks tool.call, y cómo decide el modelo cuándo usarlas.'
route: check
order: 17
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

## Qué hace

La lista de pendientes de la guía anterior es útil desde el panel. Es más útil si además puedes decirle a Claude "anota en los pendientes que el test de login es inestable" en mitad de una tarea, o "haz la tarea del README", y Claude la encuentra, la hace y la tacha.

Narsil Check da a Claude cuatro herramientas para eso:

| Herramienta            | Qué hace                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| `todo_list`            | Enumera las tareas de este proyecto: id, nombre y contenido de cada una.                    |
| `todo_add`             | Añade una tarea con un nombre y un contenido opcional.                                      |
| `todo_done`            | Quita una tarea terminada, nombrada por su id o por su nombre exacto.                       |
| `todo_add_to_template` | Añade una tarea a la lista de otro proyecto, normalmente la plantilla de la que salió este. |

Claude las ve como `mcp__narsil-check__todo_list` y así sucesivamente. Una tarea que añade Claude aparece enseguida en el panel, y una tarea que añades en el panel está en el siguiente `todo_list`. Comparten una lista y un escritor.

La cuarta herramienta tiene su propio comando. Cuando haces algo en un proyecto que también debería recibir la plantilla de la que salió, como una actualización complicada, dices:

```text
/narsil-check template "in acme-template create the task of raising TypeScript to the next major, explain what we had to do"
```

Claude encuentra la carpeta de la plantilla junto a este proyecto, escribe la explicación (sabe cómo se hizo el trabajo; el panel no) y añade allí la tarea. Si no encuentra ninguna carpeta, o encuentra varias parecidas, te pregunta cuál.

## Cómo funciona por dentro

### Dos mitades: declarar y servir

Una herramienta de un mod tiene dos partes, y los tipos de 2.1.325 describen las dos bajo `$.tool.register`:

- **Declararla**: `$.tool.register({ name, description, inputSchema })` "Declares a tool the model can call from the next prompt on" (declara una herramienta que el modelo puede llamar a partir del siguiente prompt). Devuelve el nombre completo, `mcp__<plugin>__<name>`.
- **Servirla**: "Serve it with a `tool.call` hook on `{ tool: "mcp__<plugin>__<name>" }` that returns the result (a call no hook answers fails)" (sírvela con un hook `tool.call` sobre `{ tool: "mcp__<plugin>__<name>" }` que devuelva el resultado; una llamada a la que no responde ningún hook falla).

Así que el mod declara cuatro herramientas en `registerTools` y añade cuatro hooks `on('tool.call', { tool: … }, …)` que las responden. Los tipos añaden que el registro "Rejects until the session binds, at `session.start`" (se rechaza hasta que la sesión se vincula, en `session.start`), y por eso `registerTools` se llama desde el hook `session.start`. Allí no se espera con await, y su fallo se captura: si las herramientas no se pueden registrar, el resto del panel sigue funcionando.

### Las declaraciones

Los nombres salen de constantes de `hooks/todos.ts`. Las descripciones y los esquemas están en `hooks/register.tsx`, citados aquí de [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later):

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

Con otro formato. En español, las tres descripciones dicen: enumera las tareas pendientes de este proyecto (los Pendientes del panel de Narsil Check): id, nombre y contenido de cada una; añade una tarea a la lista de Pendientes de este proyecto en el panel de Narsil Check, úsala cuando la persona pida anotar algo para hacerlo más tarde; quita una tarea terminada de la lista de Pendientes de este proyecto, llámala cuando completes una tarea que está en la lista.

`todo_list` no tiene `inputSchema`; los tipos dicen que por defecto es `{ type: "object" }`, una llamada sin argumentos. `todo_add_to_template` recibe `template` ("Folder name beside this project, or absolute path", nombre de una carpeta junto a este proyecto, o ruta absoluta), `name` y `content` ("What to do and how it was done here: changes, files, problems and fixes", qué hacer y cómo se hizo aquí: cambios, archivos, problemas y soluciones), con `template` y `name` obligatorios. Su descripción nombra una carpeta de plantilla de ejemplo, `backendTemplate`.

### Servir una llamada

Cada hook lee los argumentos del propio evento: los tipos describen la entrada de `tool.call` como portadora de sus propias claves "beside the tool's own arguments" (junto a los argumentos propios de la herramienta), así que el `name` de `todo_add` es `e.name`. El hook los comprueba, hace el trabajo con las mismas funciones que usa el panel (`addTodo`, `finishTodo`, `readTodoFile`) y responde con una de dos formas:

- `{ result: text }`: la salida de la herramienta, que lee el modelo.
- `{ deny: text }`: con las palabras de los tipos, "Refuses the call: the model receives the text as an error result" (rechaza la llamada: el modelo recibe el texto como un resultado de error).

El comentario del mod recoge una trampa: "An MCP-style { content, isError } object is refused by the engine." (el motor rechaza un objeto al estilo MCP { content, isError }). La respuesta es `result` o `deny`, nada más.

Las respuestas son frases cortas en inglés con las que el modelo puede actuar:

- `todo_add`: `Added [mh3k2a1b4c9z] Review the README.` (añadida [mh3k2a1b4c9z] Review the README).
- `todo_done` con una tarea desconocida: `No pending task "readme". Call todo_list to see them.` (no hay ninguna tarea pendiente "readme"; llama a todo_list para verlas), como error.
- `todo_list` con la lista vacía: `No pending tasks.` (no hay tareas pendientes).

Cada hook se ejecuta dentro de `answered`, que convierte cualquier error lanzado (un archivo que no se puede leer o escribir) en `{ deny: 'The Pendientes list could not be changed: …' }` (no se pudo cambiar la lista de Pendientes: …). Sin eso, una escritura fallida sería una llamada a herramienta fallida sin explicación. Con eso, Claude lee el motivo y puede contártelo.

Cuando el cambio se encontró con una lista dañada (la guía anterior), la respuesta lleva la nota del panel después de `Note for the user:` (nota para la persona usuaria), para que Claude la transmita. `todo_list` sobre un archivo dañado se rechaza con "cannot be read (…). Tell the user; a change will keep a copy of it and start a new list." (no se puede leer (…). Díselo a la persona; un cambio guardará una copia y empezará una lista nueva).

### Por qué dar herramientas al modelo

Claude ya podía editar `.atl/narsil-check/pendientes.json` con sus herramientas de archivos. Normalmente funcionaría, y se saltaría todo lo que construyó la guía anterior: la cadena que serializa los cambios, la relectura antes de escribir, la copia de un archivo dañado, la línea de exclusión. También podría escribir una forma que el lector rechaza.

Una herramienta hace que las reglas de la lista sean la única entrada. Claude no necesita conocer el formato, la ruta ni las reglas de seguridad; dice "añade esto" y el mod lo hace igual que el panel. El resultado además es comprobable: el texto de la herramienta dice qué cambió, con el id.

Hay una segunda razón, propia de la herramienta de plantillas: llega a otra carpeta. `templateDir` resuelve un nombre a una carpeta junto a este proyecto, comparando sin tener en cuenta mayúsculas, guiones, guiones bajos ni espacios, primero de forma exacta y si no por contención. Se rechaza con una pregunta cuando no hay ninguna o hay varias: "Several folders in … match "…": a, b. Ask the user which one." (varias carpetas en … coinciden con "…": a, b. Pregunta a la persona cuál). Una regla así es mucho más fácil de mantener en código que en un prompt.

### Cómo decide Claude usarlas

El modelo elige una herramienta por lo que lee sobre ella. Aquí tres cosas dan forma a esa elección.

**La descripción dice cuándo, no solo qué.** `todo_add` termina con "Use it when the user asks to note something to do later" (úsala cuando la persona pida anotar algo para hacerlo más tarde). `todo_done` dice "Call it when you complete a task that is on the list" (llámala cuando completes una tarea que está en la lista). Esa segunda frase es la que hace que Claude tache una tarea por su cuenta cuando termina el trabajo, como promete el README: "la tacha él mismo al terminarla".

**Las herramientas esperan detrás de ToolSearch.** El mod no pasa `isDeferred`. Los tipos dicen que, si se omite, "the engine's rule places it: behind ToolSearch, as it places an MCP server's tool" (la regla del motor la coloca: detrás de ToolSearch, como coloca la herramienta de un servidor MCP). El modelo ve el nombre de la herramienta en una lista de herramientas diferidas, y solo carga el esquema completo cuando la busca. Así que las cuatro herramientas casi no cuestan contexto hasta que hacen falta. El comentario del mod lo dice directamente, "behind ToolSearch, so they cost nothing until used" (detrás de ToolSearch, así que no cuestan nada hasta que se usan), y el README: "No las lee en cada mensaje, así que no gastan contexto hasta que las usa". El precio es un paso de búsqueda la primera vez. Nombres como `todo_add` en un servidor llamado `narsil-check` facilitan esa búsqueda.

**El comando nombra la herramienta.** `/narsil-check template "…"` no llama a la herramienta por sí mismo. Envía un prompt con `$.prompt.submit`, construido por `templatePrompt`, que dice qué herramienta usar (`mcp__narsil-check__todo_add_to_template`), que la plantilla es un nombre de carpeta junto a este proyecto o una ruta absoluta, que ponga en el contenido qué se cambió, en qué archivos, qué falló y cómo se resolvió, y que pregunte si la herramienta no encuentra la plantilla. La petición de la persona va entre comillas. El mod entrega la parte que solo Claude puede hacer, la explicación, y se queda con la parte que el código hace mejor, encontrar la carpeta y escribir el archivo.

Nada de esto obliga a hacer una llamada. El modelo puede responder igualmente sin la herramienta, o preguntar primero. Las descripciones hacen que la llamada correcta sea la obvia.

## Constrúyelo con Claude

Pídele a Claude que le dé al modelo herramientas sobre la lista que el panel ya guarda. La única idea que debe entender bien es que cada herramienta se declara y también se atiende, y que todas pasan por la misma función de cambio que usa el panel.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil Check.

> En mi mod de Claude Code `my-panel`, da a Claude herramientas sobre la lista de pendientes que ya guardo en `.atl/my-panel/todos.json`. En `session.start`, sin esperarlo con await y capturando su fallo, llama tres veces a `$.tool.register`: `todo_list` (sin entrada), `todo_add` (`name` obligatorio, `content` opcional) y `todo_done` (`task`, un id o un nombre exacto). Escribe cada descripción para que diga cuándo usarla: "Use it when the user asks to note something to do later", "Call it when you complete a task that is on the list". Omite `isDeferred`. Sirve cada una con `on('tool.call', { tool: 'mcp__my-panel__todo_add' }, …)`, leyendo los argumentos del evento, y pasa por la misma función de cambio que usa el panel. Responde `{ result: text }` con una frase corta que incluya el id de la tarea, o `{ deny: text }` para una entrada incorrecta o cualquier error lanzado, nunca un `{ content, isError }` al estilo MCP. Prueba cada herramienta llamándola con `$.tool.call` y comprobando el archivo y el texto.

### Qué revisar en la respuesta de Claude

1. Las herramientas se registran con `$.tool.register` desde `session.start`, sin esperarlo, y un fallo se captura para que el panel siga funcionando.
2. Cada nombre declarado tiene su propio hook `tool.call`, que coincide con el nombre completo `mcp__<plugin>__<name>`.
3. Cada hook responde `{ result: text }` o `{ deny: text }`, nunca un `{ content, isError }` al estilo de MCP, y cualquier error lanzado se convierte en un `deny` con su causa.
4. Cada descripción dice cuándo usar la herramienta, no solo lo que hace.
5. Los hooks añaden, terminan y leen tareas mediante las mismas funciones que usa el panel. Ninguna herramienta escribe el archivo a su manera.

Si una comprobación falla, dile a Claude lo que ves: "le pedí a Claude que anotara una tarea y la llamada a la herramienta falló sin ningún motivo".

### Cómo lo pidió el autor

La petición original de estas herramientas no quedó registrada. Ningún registro de tareas público de narsil-check cubre la lista de pendientes ni sus herramientas. Lo que sigue es una reconstrucción.

#### Reconstrucción a partir del historial de commits

A partir de `git log -S tool.register` sobre `hooks/register.tsx` y `git log -- hooks/todos.ts` en narsil-check:

- `5439638` (2026-11-05) "feat: Pendientes, a per-project task list Claude can read and finish" (Pendientes, una lista de tareas por proyecto que Claude puede leer y terminar). El único commit que añade `$.tool.register`. Su mensaje: "Claude gets todo_list, todo_add and todo_done, and /narsil-check template "…" asks Claude to add a task, with how the work was done, to a template's list through todo_add_to_template." (Claude recibe todo_list, todo_add y todo_done, y /narsil-check template "…" pide a Claude que añada una tarea, con cómo se hizo el trabajo, a la lista de una plantilla a través de todo_add_to_template). La lista y las herramientas se construyeron juntas, así que el panel y Claude compartieron un escritor desde el principio.
- `8dc7904` (2026-11-05) "fix: keep a damaged Pendientes list and never let side steps block a save" (conservar una lista de Pendientes dañada y no dejar nunca que los pasos secundarios bloqueen un guardado). Para las herramientas: "Claude's tools return a readable error on any file failure" (las herramientas de Claude devuelven un error legible ante cualquier fallo de archivo). De aquí sale `answered`.

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Esta es una versión reducida de la idea, escrita para esta guía y comprobada con los tipos de Claude Code 2.1.325 (`$.tool.register`, `on('tool.call', { tool }, …)`, las respuestas `result` y `deny`). Está adaptada de `registerTools` y de los hooks `tool.call` en `hooks/register.tsx` en [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). `change` y `Task` son los del código de la guía anterior, que se suponen en `./todos`.

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

Usa el nivel superior de git del proyecto en lugar de `$.session.cwd()` si tu lista vive allí, como hace la guía anterior.

## Errores comunes y cómo probarlo

Estos salen del código y los tests de Narsil Check:

- **Registrar antes de que la sesión se vincule.** `$.tool.register` se rechaza hasta `session.start`. Regístralas allí.
- **Declarar sin servir.** "a call no hook answers fails" (una llamada a la que no responde ningún hook falla). Cada nombre necesita su hook `tool.call`, con el nombre completo `mcp__<plugin>__<name>`.
- **Responder con la forma de MCP.** `{ content, isError }` se rechaza. Usa `result` o `deny`.
- **Dejar escapar una excepción.** Claude recibe un fallo sin motivo. Envuélvelo y responde `deny` con la causa.
- **Descripciones que solo dicen qué.** Di también cuándo llamarla; es con eso con lo que actúa el modelo.
- **Un segundo escritor.** Una herramienta que escribe el archivo a su manera se salta las reglas de seguridad. Reutiliza la función del panel.
- **Comparar nombres con tolerancia en el código pero con rigor en la descripción.** `todo_done` acepta un id o un nombre sin distinguir mayúsculas; su esquema dice "exact name" (nombre exacto), lo que mantiene preciso al modelo mientras el código sigue siendo tolerante.

Para probarlo, `claude plugin test .` ejecuta `tests/todos.test.tsx`. "Claude's tools list, add and finish tasks, and a change made elsewhere is kept" (las herramientas de Claude enumeran, añaden y terminan tareas, y se conserva un cambio hecho en otro sitio) llama a las herramientas a través de `$.tool.call` y comprueba los textos y el archivo, incluida una tarea que otro escritor añadió entre medias. "Claude is told about a damaged list instead of reading it as empty" (a Claude se le avisa de una lista dañada en lugar de leerla como vacía) comprueba el `deny` sobre un archivo roto, y "a list that cannot be written gives Claude a readable error, and the pane a toast" (una lista que no se puede escribir da a Claude un error legible, y al panel un toast) el camino de `answered`. "a task for a template lands in that folder, and an unclear name asks which one" (una tarea para una plantilla acaba en esa carpeta, y un nombre poco claro pregunta cuál), "a template named by its absolute path is used as given; an unknown one asks the user" (una plantilla nombrada por su ruta absoluta se usa tal cual; una desconocida pregunta a la persona) y "/narsil-check template hands the request to Claude, who knows how the work was done" (/narsil-check template entrega la petición a Claude, que sabe cómo se hizo el trabajo) cubren la herramienta de plantillas y su comando.

## Para ir más lejos

- `$.tool.register` también acepta `isDeferred: false`, que pone el esquema de una herramienta en la lista de herramientas del prompt. Solo merece la pena para una herramienta que el modelo necesita en casi cada turno.
- Una herramienta `todo_update` que edite el contenido de una tarea permitiría a Claude añadir lo que aprendió mientras trabajaba en ella.
- El mismo patrón sirve para cualquier dato del panel con el que el modelo deba actuar: una herramienta que lea las vulnerabilidades de la guía 14 permitiría a Claude abrir un PR de corrección a partir de ellas.
- La siguiente y última guía de esta ruta vuelve a las actualizaciones, para el caso más difícil: Kotlin, Gradle y el Android Gradle Plugin.
