---
title: El objeto $
description: Las áreas de la interfaz del motor que recibe cada hook, con sus firmas reales y dónde usan cada una narsil-pet y narsil-check.
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

## Qué hace

Cada hook recibe `$`, la interfaz del motor. Un mod no tiene Node ni DOM, así que `$` es la forma de llegar a la pantalla, a sus datos guardados, al reloj, a la red, a los procesos, a los archivos, a la sesión, al modelo, a las herramientas y a los comandos. Esta guía recorre las áreas que usan los dos mods de Narsil, con la firma de cada método tal como la declara Claude Code 2.1.325.

`$` tiene más de lo que aparece aquí (temas, ajustes, agentes, telemetría y otros). El archivo de declaraciones, `claude-code.d.ts`, documenta cada sustantivo y cada método con su comentario de documentación y un ejemplo.

## Cómo funciona por dentro

Cada método de `$` es una llamada a través del host: se lanza como un evento, de modo que los hooks de otros plugins pueden verla, reescribirla o rechazarla, y casi todos los métodos devuelven una promesa. Los tipos vienen del módulo `claude-code`:

```ts
import type { EngineInterface } from 'claude-code'
```

Una función auxiliar que recibe `$: EngineInterface` puede hacer las mismas llamadas que un hook.

| Área        | Para qué sirve                                                                                                | Dónde se usa                             |
| ----------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `$.ui`      | Toasts, notificaciones, líneas de registro, la barra de estado, paneles, el portapapeles, tablas de elementos | ambos                                    |
| `$.store`   | Datos JSON que se conservan entre sesiones                                                                    | ambos                                    |
| `$.state`   | Valores con nombre para la sesión, que se leen al dibujar                                                     | ambos, mediante `atom`, `read`, `update` |
| `$.clock`   | La hora y los temporizadores                                                                                  | ambos                                    |
| `$.process` | Comandos en el host                                                                                           | ambos                                    |
| `$.http`    | Peticiones de red a través del host                                                                           | ambos                                    |
| `$.fs`      | Archivos                                                                                                      | ambos                                    |
| `$.session` | El directorio, el id, el uso y las superficies de la sesión                                                   | ambos                                    |
| `$.model`   | Completados puntuales                                                                                         | ambos                                    |
| `$.tool`    | Herramientas que el modelo puede llamar                                                                       | narsil-check                             |
| `$.command` | Comandos de barra                                                                                             | ambos                                    |
| `$.mcp`     | Llamadas a las herramientas de un servidor MCP conectado                                                      | narsil-check                             |
| `$.prompt`  | El cuadro del prompt y el envío de prompts                                                                    | ambos                                    |
| `$.audio`   | Voz y sonido                                                                                                  | narsil-pet                               |
| `$.env`     | Variables de entorno                                                                                          | narsil-pet                               |
| `$.plugin`  | El nombre y la carpeta del propio plugin                                                                      | narsil-pet                               |

## Paso a paso

### $.ui: lo que ve la persona

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

- `toast(text, options?)` muestra un recuadro pequeño durante unos segundos (`timeoutMs`, 4000 por defecto). No toca la transcripción ni el modelo.
- `log(text, options?)` añade a la transcripción una línea atenuada que el modelo no lee o, con `{ to: 'debug' }`, escribe solo en el registro de depuración.
- `status(text | undefined)` fija una línea para este plugin bajo el prompt; `undefined` la quita.
- `notify(text, options?)` lanza una notificación nativa por el canal propio de la persona y se resuelve con `{ isSent: true, channel }` o `{ isSent: false, reason }`.
- `open(pane)` abre un panel que el plugin dibuja después con un hook `ui.render` sobre `{ component: 'Pane' }`. Se resuelve con `{ isPlaced: true }` o `{ isPlaced: false, reason }`.
- `copy({ text, surface })` pone texto en el portapapeles de la superficie indicada y se resuelve con `{ isCopied: true }` o `{ isCopied: false, reason }`. Un manejador de pulsación pasa `e.surface`.
- `resolve(e)` devuelve la tabla de elementos (`Box`, `Text`, `Button` y otros) de la superficie en la que dibuja un hook `ui.render`. La guía "Superficies" lo explica.

El `hooks/register.tsx` de narsil-check usa `$.ui.copy` y `$.ui.toast` juntos en `copyRow`, y abre su panel con `$.ui.open({ id: PANE, title: TITLE })` en `session.start`. El `hooks/register.tsx` de narsil-pet prueba `$.ui.notify` antes que su propio script de notificaciones. Ninguno de los dos mods llama a `$.ui.status`; la línea de arriba sigue el ejemplo del archivo de declaraciones.

### $.store: datos entre sesiones

```ts
const runs = Number((await $.store.get('runs')) ?? 0) + 1
await $.store.set('runs', runs)

const old = (await $.store.keys()).filter((key) => key.startsWith('day:'))
for (const key of old) await $.store.delete(key)
```

- `get(key)` se resuelve con el valor o con `undefined`. Su tipo es `unknown`, así que compruébalo o conviértelo.
- `set(key, value)` guarda datos JSON. Un `Date` vuelve como su cadena ISO y un campo `undefined` se descarta. Rechaza una función, un ciclo o un almacén de más de 4 MiB de JSON en total.
- `keys()` se resuelve con todas las claves en orden de inserción; `delete(key)` elimina una.

El almacén es un archivo JSON propio del plugin dentro del directorio de configuración de Claude Code del usuario. narsil-pet restaura sus preferencias con `$.store.get(PREFS_KEY)` en `session.start`, y recorta las estadísticas antiguas por sesión con `$.store.keys()` y `$.store.delete(key)`.

### $.state: valores para dibujar

`$.state` guarda valores con nombre para la sesión. Sobreviven a una recarga en caliente del código del mod, y un hook `ui.render` que lee uno se vuelve a dibujar cuando cambia, sin llamar a `$.ui.invalidate`. Cada valor se declara en el contrato del mod (`types/index.d.ts`) dentro de `PluginState`.

Las llamadas directas reciben una referencia cuyos `plugin` y `key` son literales:

```ts
const ref = { plugin: 'greeter', key: 'calls' } as const

const held = await $.state.get(ref)
await $.state.set(ref, (held.value ?? 0) + 1, { ifVersion: held.version })
```

`get` se resuelve con `{ value, version }` (`undefined` en la versión 0 si nunca se escribió). `set` con `ifVersion` escribe solo mientras el valor siga en esa versión. Los dos mods de Narsil usan en su lugar las funciones auxiliares de `claude-code`, que hacen esto por ti:

```ts
import { atom, read, update } from 'claude-code'

const calls = atom({ plugin: 'greeter', key: 'calls' } as const, 0)

const now = await read($, calls)
await update($, calls, (n) => n + 1)
```

La diferencia que importa: `$.state` dura lo que la sesión y `$.store` dura entre sesiones. Para conservar un valor de estado cuando termina la sesión, escríbelo también en `$.store`. Un hook de dibujo nunca escribe estado (`$.state.set` mientras se dibuja se rechaza); escribe desde un manejador de pulsación o desde otro evento. narsil-pet declara todo su estado en `types/index.d.ts` dentro de `PluginState['narsil-pet']` y crea cada valor con `atom` al principio de `hooks/register.tsx`.

### $.clock: la hora y los temporizadores

```ts
const startedAt = await $.clock.now()
await $.clock.sleep(500)

const once = $.clock.after(10_000, () => $.ui.toast('Ten seconds in'))
const tick = $.clock.every(2000, () => $.ui.status('still here'))
once.cancel()
tick.cancel()
```

`now()` se resuelve con los milisegundos desde la época Unix. `sleep(ms, options?)` espera y acepta una `signal`. `after(ms, fn)` y `every(ms, fn)` devuelven un temporizador con `cancel()`. Una recarga en caliente cancela los temporizadores pendientes. narsil-pet arranca su ventana con `$.clock.after(10, ...)` y un latido con `$.clock.every(2000, ...)` en `session.start`.

### $.process, $.http, $.env, $.plugin: el host

```ts
const { exitCode, stdout } = await $.process.run(['git', 'status', '--short'], { timeoutMs: 5000 })
const { ok, status, text } = await $.http.fetch('https://example.com/status')
const home = await $.env.get('HOME')
const script = `${$.plugin.root}/scripts/hello.sh`
```

- `process.run(argv, init?)` ejecuta un comando a partir de su vector de argumentos, sin shell, y se resuelve con `{ exitCode, stdout, stderr }` sea cual sea el código de salida. `init` acepta `cwd`, `env`, `stdin` y `timeoutMs` (30 s por defecto).
- `http.fetch(url, init?)` pasa por el host y se resuelve con `{ status, ok, headers, text }`. `init` acepta `method`, `headers`, `body`, `auth` y `socketPath`.
- `env.get(name)` se resuelve con la variable o con `undefined`. El nombre debe ser un literal de cadena, para que la validación pueda listar lo que lee el módulo.
- `plugin.root` es la carpeta del plugin (absoluta) y `plugin.name`, su nombre en el manifiesto. Ambos son cadenas simples, no llamadas.

narsil-check ejecuta gestores de paquetes y `gh` con `$.process.run` y consulta registros y OSV.dev con `$.http.fetch`. narsil-pet lee `OS` con `$.env.get` y construye las rutas de sus scripts a partir de `$.plugin.root`.

### $.fs: archivos

```ts
const path = `${await $.session.cwd()}/notes.json`
if (await $.fs.exists(path)) {
  const notes = JSON.parse(await $.fs.read(path)) as unknown
  await $.fs.write(path, JSON.stringify(notes, null, 2))
}
const entries = await $.fs.list(await $.session.cwd())
```

`read(path)` se resuelve con el texto (o con los bytes, con `{ as: 'bytes' }`) y se rechaza cuando el archivo no existe o supera los 4 MiB. `write(path, text)` crea el archivo y sus directorios. `exists(path)` y `list(path?)` hacen lo que dicen; cada entrada de `list` tiene `name`, `kind`, `size`, `mtimeMs` e `isLink`. La función auxiliar `readJson` de narsil-check es `$.fs.exists` seguido de `$.fs.read`.

### $.session: la propia sesión

```ts
const cwd = await $.session.cwd()
const id = await $.session.id()
const usage = await $.session.usage()
const inApp = (await $.session.surfaces()).some((s) => s !== 'terminal')
```

`cwd()` es el directorio en el que se ejecuta la sesión, `id()` su id, `usage()` cuándo empezó y cuánto se ha llenado la ventana de contexto, y `surfaces()` todas las superficies en las que dibuja. narsil-pet lee las cuatro; narsil-check lee `cwd()`.

### $.model: completados

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

`complete` ejecuta un completado sin herramientas y sin historial, y siempre se resuelve con un resultado: `isAnswered` con `text`, o `isAnswered: false` con un `reason`. `fork` ejecuta un completado sin herramientas sobre la propia transcripción de la sesión. Ambos cuentan para el coste de la sesión. narsil-pet escribe sus consejos con `$.model.complete({ model: 'haiku', ... })` y sus consejos más profundos con `$.model.fork`; narsil-check pregunta a Haiku por qué una actualización es arriesgada.

### $.tool y $.command: lo que pueden llamar el modelo y la persona

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

`command.register` declara `/<name>`; un hook `command.run` sobre `{ command: '<name>' }` lo responde con `{ text }`. `tool.register` declara una herramienta llamada `mcp__<plugin>__<name>`; un hook `tool.call` sobre ese nombre la responde. Ambos se registran desde `session.start`. Este patrón está adaptado del `hooks/register.tsx` de narsil-check, que registra sus cuatro herramientas de lista de tareas en `registerTools` y responde cada una con `{ result }` o `{ deny }`.

### $.mcp, $.prompt, $.audio

```ts
const result = await $.mcp.call('example-server', 'list_items', { limit: 5 })
await $.prompt.fill({ text: 'Run the tests again' })
await $.prompt.submit({ text: 'List the files changed today' })
await $.audio.speak('Done')
```

- `mcp.call(server, tool, args?)` llama a una herramienta de un servidor MCP conectado con la propia conexión del motor y se resuelve con bloques `content` e `isError`. narsil-check lee así los servidores de sesión de la aplicación de escritorio.
- `prompt.fill({ text })` pone texto en el cuadro del prompt como borrador. narsil-pet lo usa cuando eliges un siguiente paso sugerido.
- `prompt.submit({ text })` pone en cola un prompt que inicia su propio turno cuando la sesión queda inactiva. narsil-check lo usa para pasarle una tarea a Claude.
- `audio.speak(text)` habla con el sintetizador de la plataforma. narsil-pet recurre a él cuando su propio script de voz no está disponible.

## Errores comunes y cómo probarlo

- **Tratar `$.state` como permanente.** Termina con la sesión. Persiste los datos con `$.store`.
- **Escribir estado mientras se dibuja.** `$.state.set` dentro de un hook `ui.render` se rechaza. Escribe desde `onPress` o desde otro evento.
- **Claves de estado o nombres de variables de entorno calculados.** `plugin` y `key` en una referencia de estado, y el nombre que se pasa a `$.env.get`, deben ser literales en el código fuente.
- **Ignorar la forma de los resultados.** `$.model.complete`, `$.ui.notify`, `$.ui.open` y `$.ui.copy` se resuelven con un resultado que indica si funcionó, en lugar de rechazarse. Comprueba `isAnswered`, `isSent`, `isPlaced` o `isCopied`.
- **Olvidar que las llamadas pueden fallar.** Los dos mods envuelven las llamadas opcionales en `.catch(() => undefined)` para que un fallo no detenga un hook.

`claude plugin validate` lista cada llamada a `$` que hace el módulo (`calls: $.state.get, $.ui.toast, ...`), las claves de estado que lee y escribe y los nombres de variables de entorno que usa. La comprobación de tipos con el archivo de declaraciones detecta un nombre de método o un argumento incorrecto antes de que una sesión cargue el mod.

## Para ir más lejos

- `hooks/register.tsx` de narsil-pet: `session.start` usa `$.command.register`, `$.store.get`, `$.env.get`, `$.session.usage`, `$.session.cwd`, `$.clock.after` y `$.clock.every` en un solo hook.
- `hooks/register.tsx` de narsil-check: `registerTools` para `$.tool.register`, los hooks `tool.call` sobre `mcp__narsil-check__...` que las responden, y `copyRow` para `$.ui.copy`.
- Los dos archivos `types/index.d.ts`: las declaraciones `PluginState` que hay detrás de cada `atom`.
