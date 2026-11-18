---
title: El resumen de la sesión
description: 'Cómo Narsil cuenta lo que ha hecho una conversación (turnos, archivos, comandos, fallos, subagentes) y sigue contando cuando Claude Code se reinicia, para /narsil resumen y un resumen tras una pausa.'
route: pet
order: 16
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/watch.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: types/index.d.ts
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Qué hace

`/narsil resumen` responde a una pregunta difícil de responder desde la transcripción: ¿qué ha hecho de verdad esta conversación hasta ahora? Imprime una línea:

```text
📋 Sesión de 1 h 5 min: 4 turnos (12 min de trabajo) · 3 archivos editados (a.ts, b.ts, c.ts) · 7 comandos, 1 fallo · 2 subagentes · contexto 40 %
```

El ejemplo es el del comentario que hay encima de `summaryText` en `hooks/watch.ts`.

Narsil también lo muestra por su cuenta cuando una conversación lleva 30 minutos en calma después de un turno: un momento natural para mirar atrás, por ejemplo después de un descanso. Se muestra donde se muestran sus consejos (guía 11): en una pequeña ventana propia en Windows y macOS, y en la banda en los demás sistemas.

Si cierras Claude Code y más tarde retomas la conversación, el resumen sigue sumando desde donde estaba. Narsil guarda las cuentas de las 20 conversaciones más recientes.

## Cómo funciona por dentro

### Lo que se cuenta: el tipo `Stats`

Las cuentas son un único valor, el átomo `stats` de `hooks/register.tsx`, del tipo `Stats` declarado en `types/index.d.ts`:

| Campo       | Lo que cuenta                                             | Dónde se suma                               |
| ----------- | --------------------------------------------------------- | ------------------------------------------- |
| `startedAt` | cuándo empezaron las cuentas de la conversación           | la primera vez, en `session.start`          |
| `turns`     | turnos terminados de la conversación principal            | `turn.complete`, con cualquier motivo       |
| `workedMs`  | el tiempo que duraron esos turnos                         | `turn.complete`, a partir de `e.durationMs` |
| `files`     | los nombres de los archivos editados, hasta 200           | `tool.call` de una herramienta de escritura |
| `moreFiles` | los archivos que pasan de los 200 primeros, solo contados | lo mismo                                    |
| `commands`  | comandos de shell ejecutados                              | `tool.call` de `Bash` o `PowerShell`        |
| `failures`  | llamadas a herramientas que devolvieron un error          | después de `next(e)` en `tool.call`         |
| `agents`    | subagentes arrancados                                     | `agent.spawn`                               |

Cada cambio pasa por una única función, `bumpStats($, change)`, que aplica un cambio puro al átomo (empezando por `emptyStats(now)` si todavía no hay ninguno) y lo guarda. Las funciones auxiliares de `hooks/watch.ts` mantienen las reglas sencillas: `emptyStats`, `addFile`, `summaryText`, `statsOf`.

Unos cuantos detalles deciden lo que significan los números:

- **Las herramientas de escritura** son `Edit`, `MultiEdit`, `Write` y `NotebookEdit` (`WRITING_TOOLS` en `hooks/words.ts`). El archivo es el detalle corto que muestra la banda, el nombre base del archivo, y `addFile` añade un nombre una sola vez. Así que el resumen cuenta nombres distintos: dos archivos `index.ts` en carpetas distintas cuentan como uno.
- **El trabajo de los subagentes también cuenta.** El hook `tool.call` suma archivos, comandos y fallos diga lo que diga `e.agentId`, mientras que `turns` cuenta solo los turnos de la conversación principal, porque el `turn.complete` de un subagente vuelve antes de esa línea.
- **Solo cuentan las llamadas de Claude.** El hook empieza con `isClaudesCall(next.origin)`: una llamada que hace otro mod no forma parte del trabajo de la sesión (guía 1).
- **Un test fallido es un fallo.** `failures` cuenta cualquier resultado de herramienta con `isError`, incluida una ejecución de tests que falla.
- **El contexto** no se guarda: `summarize` lee el porcentaje actual del átomo `usage` de la guía 7, y lo deja fuera cuando no hay ninguno.

`summaryText(stats, now, contextPercent)` escribe la línea. Nombra como mucho tres archivos y añade "…" detrás cuando hay más, escribe "ningún archivo editado" cuando no hay ninguno, deja fuera los subagentes cuando no hubo ninguno y gestiona el plural de cada cuenta. La duración es `now - startedAt`, escrita en minutos o en horas y minutos.

### Por qué dos capas de persistencia

Narsil guarda las cuentas en dos sitios, y cada uno cubre un tipo distinto de reinicio:

- **`$.state`, el átomo.** Los tipos lo describen como "plain data that survives a hot reload of the plugin's code" (datos simples que sobreviven a una recarga en caliente del código del plugin). Una recarga del mod, que sigue a cualquier turno que lo edite, conserva las cuentas sin hacer nada.
- **`$.store`, una clave por conversación.** Del almacén, los tipos dicen "kept between sessions and hot reloads" (se conserva entre sesiones y recargas en caliente). `loadStats` le pregunta a `$.session.id()`, que los tipos describen como "the session's id (the transcript file's name)" (el id de la sesión, el nombre del archivo de la transcripción), y usa la clave `stats:<id>`. `saveStats` escribe ahí el valor completo tras cada cambio.

En `session.start`, `loadStats` llena el átomo desde el almacén solo cuando el átomo está vacío. Una recarga conserva el átomo y se salta el almacén; un reinicio de Claude Code con la misma conversación tiene el átomo vacío y lo vuelve a leer. El comentario en ese punto lo resume: "The stats survive a reload of the mod, and Claude Code restarting with this conversation: only a new conversation starts them." (las cuentas sobreviven a una recarga del mod, y a que Claude Code se reinicie con esta conversación: solo una conversación nueva las empieza).

La clave es por conversación a propósito. La XP de la guía 13 es un único número para la máquina, al que todo el mundo suma; un resumen trata de una conversación, así que cada una tiene el suyo.

Si `$.session.id()` falla, la clave queda vacía y no se guarda nada: las cuentas duran entonces solo lo que dure el átomo.

De conservar `startedAt` se sigue una consecuencia: la duración se cuenta desde que empezaron las cuentas de la conversación, así que se incluye el tiempo con Claude Code cerrado. Una conversación retomada a la mañana siguiente dice que ha durado toda la noche.

### Conservar solo 20

Una clave por conversación crece sin fin, así que `saveStats` limpia una vez por carga del módulo (`isStatsPruned`). Lista las claves del almacén, se queda con las que empiezan por `stats:` aparte de la suya y borra las más antiguas hasta que quedan 19, de modo que quedan 20 con la suya. El código depende del orden: "Oldest first: the store lists its keys in the order they were set." (las más antiguas primero: el almacén lista sus claves en el orden en que se fijaron). Los tipos dicen que `$.store.keys()` "Returns every key set, in insertion order." (devuelve todas las claves fijadas, en orden de inserción). Cualquier fallo al listar o al borrar deja todas las claves en su sitio.

`statsOf` valida lo que lee: cada cuenta debe ser un número finito y `files` un array de cadenas, o el valor guardado se ignora y la conversación empieza de cero. El comentario lo llama "A stored value from any version, or none" (un valor guardado de cualquier versión, o de ninguna).

### El resumen tras una pausa

El latido (`beat`, cada 2 segundos) llama a `tickWatch`, que muestra el resumen cuando se cumple todo esto:

- ha terminado un turno: el reloj de la caché de la guía 8 tiene un inicio, `c.at`, que fija el final de cada turno;
- no queda nada en marcha en segundo plano (`backgroundAtStop === 0`);
- han pasado 30 minutos (`IDLE_SUMMARY_MS`) desde `c.at`;
- la pausa de este turno todavía no se ha resumido (`summarizedFor !== c.at`);
- la conversación tiene al menos un turno;
- el modo discreto está apagado (guía 14).

Entonces llama a `showTip($, await summarize($), 'summary')`. Reutilizar la forma de mostrar el consejo significa que el resumen obtiene sin coste la ventana del consejo, las tres líneas de la banda y la ventana flotante. `summarizedFor` hace que sea una vez por pausa: un nuevo turno fija un nuevo `c.at`, y la siguiente pausa se puede volver a resumir.

## Constrúyelo con Claude

Pídele a Claude un comando que resuma la conversación a partir de los recuentos que el mod lleva durante la sesión. La idea que debe acertar es dónde viven los recuentos: en un átomo, para que una recarga del mod los conserve, y en `$.store` bajo una clave por conversación, para que también los conserve un reinicio de Claude Code.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil.

> En mi mod de Claude Code `my-pet`, añade `/my-pet summary`. Mantén un átomo `stats` con `startedAt`, `turns`, `workedMs`, `files` (nombres base distintos, como mucho 200), `commands`, `failures` y `agents`. Cuenta los turnos y su `durationMs` en el `turn.complete` de la conversación principal; los archivos editados de las llamadas a `Edit` y `Write` en `tool.call`; las llamadas a `Bash` como comandos; cualquier resultado con `isError` como un fallo; los subagentes en `agent.spawn`. Cambia el átomo solo mediante una función que además lo guarde en `$.store` bajo `stats:` más `$.session.id()`. En `session.start`, cárgalo desde el almacén solo si el átomo está vacío, y valida lo que leas. Conserva solo las 20 últimas claves de este tipo. El comando imprime una línea como "Session of 12 min: 3 turns · 2 files edited (a.ts, b.ts) · 4 commands, 1 failure". Prueba con `claude-code/testing`: un valor guardado bajo la clave de la sesión continúa, y una clave antigua número 25 se borra.

### Qué revisar en la respuesta de Claude

1. Todos los recuentos están en un átomo, nunca en una variable del módulo, y cambian solo mediante una función que además lo guarda.
2. La clave del almacén es `stats:` seguida de `$.session.id()`, así que cada conversación tiene sus propios recuentos.
3. En `session.start` el almacén se lee solo cuando el átomo está vacío, y lo que se lee se valida campo por campo antes de usarlo.
4. Los turnos se cuentan solo para la conversación principal en `turn.complete`, y un archivo editado se cuenta una vez por nombre base.
5. Solo se conservan las 20 claves `stats:` más recientes.

Si una comprobación falla, dile a Claude lo que ves: "después de reiniciar Claude Code y retomar esta conversación, el resumen dice 0 turnos".

### Cómo lo pidió el autor

La petición original del resumen de la sesión no quedó registrada.

Una petición registrada toca el módulo en el que nació el resumen. `hooks/watch.ts` empezó con una alerta de bucle, un recordatorio para los permisos que esperan y el resumen. En `odd/tasks/fleet-view.md`, L1 (2026-11-06), quien creó Narsil pidió:

> "eliminariamos la alerta de bucle, no la he sentido tan util"

El registro de tareas lo recoge como S9, y `21e7288` la eliminó. El resumen y el recordatorio se quedaron.

#### Reconstrucción a partir del historial de commits

A partir de `git log -- hooks/watch.ts` en narsil-pet:

- `f7a494e` (2026-10-30) "feat: warn about loops, insist on waiting permissions and sum the session up" (avisar de los bucles, insistir con los permisos que esperan y resumir la sesión). El resumen, el recordatorio y la alerta de bucle llegan juntos.
- `21ffc2e` (2026-10-31) "fix: keep a conversation's session summary when Claude Code restarts" (conservar el resumen de la sesión de una conversación cuando Claude Code se reinicia). Las claves `stats:<id>`, `statsOf` y el límite de 20 (`KEEP_STATS`) vienen de aquí. La primera versión vivía solo en la sesión.
- `36256f9` (2026-10-31) "feat: let the band, window and alerts speak in Narsil's first person" (hacer que la banda, la ventana y los avisos hablen en la primera persona de Narsil).
- `2bcc97c` (2026-11-05) "feat: open the context breakdown from the usage bars and calm loop, steps and permission alerts" (abrir el desglose del contexto desde las barras de uso y calmar los avisos de bucle, de pasos y de permisos).
- `519dd73` (2026-11-06) "fix: wait for background work before announcing a turn finished" (esperar al trabajo en segundo plano antes de anunciar que un turno terminó). Con él llega la condición `backgroundAtStop === 0` del resumen tras una pausa.
- `21df208` (2026-11-06) "fix: ignore tool calls other mods make, so Narsil no longer sticks at working" (ignorar las llamadas a herramientas que hacen otros mods, para que Narsil ya no se quede atascada en trabajando). Su mensaje menciona que las llamadas de otro mod se contaban como trabajo de Claude; `isClaudesCall` también las deja fuera de las cuentas.
- `21e7288` (2026-11-06) "refactor: drop the loop alert, the spending count and the open-conversations line" (quitar la alerta de bucle, la cuenta del gasto y la línea de conversaciones abiertas).

La primera corrección es la instructiva: un resumen que se pierde cuando Claude Code se reinicia informa de una fracción del trabajo, y eso es peor que no tener ninguno.

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Escrito para esta guía y comprobado con los tipos de 2.1.325 (`$.session.id`, `$.store.get`, `$.store.set`, `$.clock.now`, `$.command.register`, `command.run`, `session.start`, `tool.call`, `turn.complete`, `agent.spawn`). Está adaptado de `hooks/watch.ts` y `hooks/register.tsx` en [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). El átomo `stats` se declara en `types/index.d.ts` como `Stats | null`, con el tipo de abajo. La limpieza hasta 20 queda fuera; consulta `saveStats`.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import type { Stats } from '../types'
// type Stats = { startedAt: number; turns: number; workedMs: number;
//   files: string[]; commands: number; failures: number; agents: number }

const stats = atom({ plugin: 'my-pet', key: 'stats' } as const, null)
let key = ''

const empty = (startedAt: number): Stats => ({
  startedAt,
  turns: 0,
  workedMs: 0,
  files: [],
  commands: 0,
  failures: 0,
  agents: 0,
})
const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path

async function bump($: EngineInterface, change: (s: Stats) => Stats): Promise<void> {
  const now = await $.clock.now()
  const next = await update($, stats, (s) => change(s ?? empty(now)))
  if (key) await $.store.set(key, next).catch(() => undefined)
}

function summary(s: Stats, now: number): string {
  const minutes = Math.round((now - s.startedAt) / 60_000)
  const files = s.files.length
    ? ` (${s.files.slice(0, 3).join(', ')}${s.files.length > 3 ? '…' : ''})`
    : ''
  return `Session of ${minutes} min: ${s.turns} turns · ${s.files.length} files edited${files} · ${s.commands} commands, ${s.failures} failures · ${s.agents} subagents`
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'my-pet', description: 'My pet: summary' })
    key = `stats:${await $.session.id().catch(() => '')}`
    if (key === 'stats:') key = ''
    // A reload keeps the atom; a restart reads the store back.
    if (key && !(await read($, stats))) {
      const kept = await $.store.get(key).catch(() => undefined)
      if (kept && typeof kept === 'object' && typeof (kept as Stats).turns === 'number')
        await update($, stats, (s) => s ?? (kept as Stats))
    }
    if (!(await read($, stats))) await bump($, (s) => s)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const path = (e as { file_path?: unknown }).file_path
    if ((e.tool === 'Edit' || e.tool === 'Write') && typeof path === 'string') {
      const name = baseName(path)
      await bump($, (s) =>
        s.files.includes(name) || s.files.length >= 200 ? s : { ...s, files: [...s.files, name] },
      )
    }
    if (e.tool === 'Bash') await bump($, (s) => ({ ...s, commands: s.commands + 1 }))
    const result = await next(e)
    if (result.isError) await bump($, (s) => ({ ...s, failures: s.failures + 1 }))
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined)
      await bump($, (s) => ({ ...s, turns: s.turns + 1, workedMs: s.workedMs + e.durationMs }))
    return result
  })

  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    await bump($, (s) => ({ ...s, agents: s.agents + 1 }))
    return result
  })

  on('command.run', { command: 'my-pet' }, async ($, e) => {
    if (e.args.trim() !== 'summary') return { text: 'Usage: /my-pet summary' }
    const now = await $.clock.now()
    return { text: summary((await read($, stats)) ?? empty(now), now) }
  })
}
```

`update` se resuelve con el valor que escribió, así que `bump` guarda exactamente lo que contiene el átomo. La comprobación del valor guardado es aquí un esbozo; `statsOf` de Narsil comprueba cada campo.

## Errores comunes y cómo probarlo

- **Contar en variables del módulo.** Una recarga del mod sigue a cualquier turno que lo edite, y una variable del módulo vuelve a empezar. Guarda las cuentas en un átomo.
- **Una clave de almacén para todas las conversaciones.** Entonces el resumen de cada conversación es el de todas. Usa `$.session.id()` como clave.
- **Cargar el almacén encima de un átomo vivo.** Tras una recarga, el átomo es el valor más reciente; el almacén puede ir un cambio por detrás. Carga solo cuando el átomo esté vacío.
- **Un almacén que crece para siempre.** Una clave por conversación necesita un límite y una limpieza.
- **Fiarse de lo que está guardado.** Una versión anterior puede haber guardado otra forma. Valida campo por campo, y empieza de cero cuando no encaje.
- **Resumir en el momento equivocado.** Una pausa mientras corre trabajo en segundo plano no es una pausa. Narsil espera a que termine, y resume cada pausa una sola vez.

Para probarlo, `tests/narsil.test.tsx` tiene cuatro tests. "/narsil resumen sums the session up, and so does a 30-minute pause after a turn" (/narsil resumen resume la sesión, y también lo hace una pausa de 30 minutos tras un turno) comprueba la línea exacta ("Narsil: 📋 Sesión de 0 min: 2 turnos (1 min 24 s de trabajo) · 2 archivos editados (a.ts, b.ts) · 1 comando, 0 fallos.") y después adelanta el reloj simulado. "a conversation taken up again keeps counting its session, kept across restarts" (una conversación retomada sigue contando su sesión, conservada entre reinicios) responde a `session.id` con un id fijo, pone cuentas anteriores en el almacén bajo `stats:` y ese id, y comprueba que el siguiente turno suma a ellas. "only the last 20 conversations keep their counts, and an odd stored value is ignored" (solo las 20 últimas conversaciones conservan sus cuentas, y un valor guardado extraño se ignora) empieza con 25 claves antiguas y un valor no válido. "the summary names three files at most, and counts subagents and context" (el resumen nombra como mucho tres archivos, y cuenta los subagentes y el contexto) prueba `summaryText` por separado.

## Para ir más lejos

- `nudgeText` y `NUDGE_AFTER_MS` en `hooks/watch.ts`, vecinos del resumen, controlan el recordatorio de los cinco minutos de la guía 10.
- `took` en `hooks/agents.ts` escribe las duraciones ("1 min 24 s") para el resumen y para los subagentes.
- La siguiente y última guía de la ruta muestra cómo se registra el propio `/narsil` y cómo se reparten sus palabras, `resumen` entre ellas.
