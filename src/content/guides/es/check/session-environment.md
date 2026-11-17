---
title: 'El entorno de la sesión'
description: 'Cómo Narsil Check muestra el repositorio, la carpeta, la rama, Remote Control y Auto-fix, leídos de git y de los servidores de la app de escritorio, y por qué los consulta tan poco.'
route: check
order: 2
updated: 2026-11-17
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

## Qué hace

La primera sección del panel, **Entorno**, muestra lo que muestra la barra de sesión de la app de escritorio, para que puedas ocultar esa barra y quedarte con un solo panel. Tiene una fila por dato, y la mayoría de las filas hacen algo cuando haces clic en ellas:

| Fila               | Qué muestra                                                                         | Al hacer clic                                                        |
| ------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Repositorio**    | La dirección web del remoto `origin`, como `github.com/acme/shop`.                  | La abre en el navegador.                                             |
| **Carpeta**        | La carpeta de trabajo de la sesión.                                                 | Abre el selector de carpetas y mueve la sesión a la carpeta elegida. |
| **Rama**           | La rama de git actual.                                                              | Abre una pestaña de terminal en la carpeta de trabajo.               |
| `worktree …`       | El worktree de la sesión, cuando tiene uno.                                         | Nada.                                                                |
| **Control remoto** | Un interruptor: `●━━ desactivado` en gris, `━━● activado` en verde.                 | Lo activa o lo desactiva.                                            |
| **Auto-fix**       | El mismo interruptor para el pull request abierto de la sesión, o `sin PR abierto`. | Lo activa o lo desactiva.                                            |

Con un pull request abierto, aparece un pliegue **CI** entre los dos interruptores; la cuarta guía de esta ruta trata de él.

Cuando algo no se puede leer, la sección lo dice en rojo bajo su fila, como "No pude leer o cambiar el control remoto: …", en lugar de quedarse vacía.

## Cómo funciona por dentro

### De dónde sale cada dato

El README dice que la sección se lee de los propios servidores MCP de la app de escritorio. El código es más preciso, y la diferencia importa en otras superficies: tres datos salen del motor y de git, el resto de los servidores de la app. Todo ocurre en `loadSession`, en `hooks/register.tsx`.

| Dato                     | Fuente                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| Carpeta                  | `$.session.cwd()`                                                                                       |
| Rama                     | `$.process.run(['git', 'branch', '--show-current'])`                                                    |
| Repositorio              | `$.process.run(['git', 'remote', 'get-url', 'origin'])`, convertido en una dirección web por `webUrlOf` |
| Remote Control, worktree | `$.mcp.call('ccd_session_mgmt', 'get_session', { session_id: 'self' })`                                 |
| Pull request, Auto-fix   | `$.mcp.call('ccd_pr', 'get_status', { session_id: 'self' })`                                            |
| Conectores               | `$.mcp.call('ccd_connectors', 'session_connectors_status')` (guía siguiente)                            |

Los nombres de servidores y herramientas son constantes al principio de `hooks/session.ts` (`SESSIONS_SERVER`, `SESSION_TOOL`, `PR_SERVER`, `PR_TOOL` y el resto), así que el módulo de hooks nunca los escribe dos veces.

`webUrlOf` acepta remotos SSH (`git@github.com:acme/shop.git`, `ssh://git@host:22/acme/shop`) y HTTPS, con o sin usuario o `.git`, y devuelve `https://host/owner/repo`. Cualquier otra cosa, una ruta local entre ellas, no da enlace y la fila dice "sin repositorio remoto".

### `$.mcp.call`, tal como lo usa el código

Los tipos de 2.1.325 describen `$.mcp.call(server, tool, args)` como una llamada a una herramienta "on one of the engine's connected MCP servers with the engine's own connection and credentials" (en uno de los servidores MCP conectados al motor, con la propia conexión y credenciales del motor). Es posicional (servidor, herramienta, argumentos), no el nombre `mcp__server__tool` que ve un hook `tool.call`. Resuelve el resultado tal como lo devuelve MCP: bloques `content`, `isError`, y `structuredContent` cuando la herramienta declara un esquema de salida.

Narsil Check lee todas las respuestas de la misma forma:

```tsx
const result = await $.mcp.call(SESSIONS_SERVER, SESSION_TOOL, { session_id: 'self' })
const read = result.isError
  ? undefined
  : parseSession(result.structuredContent ?? jsonOf(result.content))
where = read ?? { remote: 'unknown', remoteError: textOf(result.content) || 'respuesta sin sesión' }
```

Prefiere `structuredContent` y recurre al JSON dentro de los bloques de texto (`jsonOf` en `hooks/session.ts`). Cada llamada va en su propio `try`, y un fallo se convierte en un campo de error solo de esa parte (`remoteError`, `fixError`, `connectorsError`): un servidor que no responde no deja en blanco toda la sección.

Los analizadores son defensivos a propósito. `parseSession` toma `remoteControlState` cuando es uno de `on`, `off`, `connecting` o `unavailable`, y en otro caso recurre al booleano `remoteControlActive`. `parsePr` informa de Auto-fix solo para un pull request vinculado y `open`, porque solo ese se puede cambiar y el interruptor necesita su url; también guarda el repositorio y la rama de cabeza del pull request para el pliegue de CI.

### Por qué consulta tan poco

La sección podría simplemente preguntar a los servidores cada pocos segundos. No lo hace, y el código y los commits dan dos razones.

**Cada llamada es visible para todos los demás mods.** Un comentario en `hooks/register.tsx` dice "each call to them reaches every other mod as a tool call" (cada llamada a ellos llega a todos los demás mods como una llamada a herramienta). Los tipos coinciden con sus propias palabras: la llamada del plugin la ven "the hooks above it" (los hooks que están por encima). El commit `55fe118` recoge la consecuencia: "seven retries tripped Narsil's loop alert" (siete reintentos dispararon la alerta de bucle de Narsil). Un mod que observa las llamadas a herramientas ve las llamadas del panel junto al propio trabajo de Claude; Narsil hoy se salta las llamadas que no son de Claude (`isClaudesCall`, tratado en la primera guía de la ruta 1), y el comentario de allí pone como ejemplo a narsil-check leyendo su sesión al inicio.

**Una llamada temprana puede provocar una petición de permiso.** El comentario sobre `SESSION_DELAY_MS` dice que los servidores de la app se conectan después de que empiece la sesión, y que "a call that comes while the app has not yet confirmed which server serves the tool makes the app ask the person for permission, whatever the permission mode" (una llamada que llega mientras la app todavía no ha confirmado qué servidor sirve la herramienta hace que la app pida permiso a la persona, sea cual sea el modo de permisos). El commit `4770a49` "fix: ask the app's session servers once, ten seconds after start" (preguntar a los servidores de sesión de la app una sola vez, diez segundos después del inicio) es esa corrección.

Aquí el código y los tipos no coinciden. Los tipos de 2.1.325 dicen de `$.mcp.call`: "No permission prompt: the plugin's call, seen by the hooks above it, is the grant." (Sin petición de permiso: la llamada del plugin, vista por los hooks que están por encima, es la concesión.) El README y el commit describen una petición que la app de escritorio mostró de todos modos. Toma los tipos como el contrato del motor y el commit como lo que quien creó Narsil Check observó en la app de escritorio, y diseña para el caso más estricto.

Así que el calendario es:

1. **Al inicio de la sesión**, `loadSessionAtStart` espera diez segundos con `$.clock.sleep(SESSION_DELAY_MS)` y lee una vez. Se ejecuta con `void`, así que el inicio de sesión no se retiene. Hasta entonces la sección dice "Leyendo la sesión…".
2. **Si esa lectura falla**, se vuelve a hacer cuando empieza tu primer turno, "when the servers are surely confirmed" (cuando los servidores están confirmados con seguridad), sin reintentos rápidos entre medias. La primera lectura se hace con `isFinal: false`: una lectura fallida no escribe nada, así que la sección sigue leyendo en lugar de mostrar un error que el reintento puede resolver.
3. **Cuando termina cada turno principal**, la carpeta, la rama y el repositorio se vuelven a leer de git. A los servidores se les pregunta de nuevo solo cuando el turno usó una herramienta que cambia su respuesta (`SESSION_TOOLS`: las herramientas `mcp__ccd_session_mgmt__`, `mcp__ccd_connectors__`, `mcp__ccd_directory__` y `mcp__ccd_pr__`, `EnterWorktree`, `ExitWorktree`, o una orden de shell con `gh pr` o `git push`), o cuando la última lectura falló.
4. **Tras un turno que abrió o subió un pull request**, la app puede vincularlo solo después de que termine el turno. `retryPr` pregunta de nuevo solo a `ccd_pr` tras esperas de 5, 10 y 15 segundos (5, 15 y 30 segundos después del turno, como lo dice el README), se detiene en cuanto aparece el pull request, y se detiene cuando termina la sesión, un `/clear` incluido.
5. **Cuando abres el pliegue Entorno o Conectores**, y después de cambiar un interruptor, se vuelve a leer todo.

La forma de este calendario es lo importante: las lecturas baratas (git, la carpeta) ocurren a menudo, y las lecturas que otros mods pueden ver ocurren solo cuando algo podría haber cambiado.

### Los interruptores

Los dos interruptores llaman a los servidores de la app para cambiar algo y después vuelven a leer:

- **Remote Control**: `$.mcp.call('ccd_session_mgmt', 'set_remote_control', { session_id: 'self', enabled })`. La respuesta puede ser JSON o palabras, así que `parseRemote` busca el estado en ambos.
- **Auto-fix**: `$.mcp.call('ccd_pr', 'set_monitor', { auto_fix: enabled, address_comments: enabled, url })`. Un comentario dice que `address_comments` debe ser igual a `auto_fix` en el lado de la app. El README dice que la app puede pedirte permiso antes.

Mientras un interruptor cambia, `isSwitching` (o `isFixSwitching`) dibuja el botón deslizante en el centro y en amarillo (`━●━`, "cambiando…"), y el botón no se dibuja, así que una segunda pulsación no puede competir con la primera. `switchGlyph` y `fixGlyph` en `hooks/session.ts` dibujan los dos interruptores con la misma función.

Los clics en la carpeta y en la rama usan dos servidores más de la app: `ccd_directory` (`request_directory` abre el selector nativo, `change_directory` mueve la sesión) y `terminal` (`open_terminal_tab`, con el nombre de la rama).

### En superficies sin esos servidores

El terminal, VS Code y las demás superficies no tienen los servidores de la app de escritorio. Allí, cada `$.mcp.call` falla, y el código convierte cada fallo en el error de su parte.

Lo que ves se deduce del calendario anterior. La lectura a los diez segundos falla y no escribe nada, así que la sección sigue diciendo "Leyendo la sesión…". Cuando empieza tu primer turno, la lectura se vuelve a hacer como definitiva: se muestran el repositorio, la carpeta y la rama (salen de git y del motor), y las filas de Remote Control y Auto-fix dicen en rojo que no se pudieron leer. El test "a server the mod cannot reach says why once the first turn has tried it too" (un servidor al que el mod no puede llegar dice por qué una vez que el primer turno también lo ha intentado) comprueba exactamente esto: dos lecturas en total, cada una preguntando una vez a cada servidor, y después las líneas de error.

La tabla de superficies del README dice que Entorno no funciona fuera de la app de escritorio y que "la sección dice por qué no pudo leerlos". El código es un poco más amable que eso: las filas de git se siguen mostrando. Los clics en la carpeta y en la rama necesitan los servidores de la app, así que fuera del escritorio responden con un toast que dice que no pudieron.

## Cómo se le pidió a la IA

La petición original de esta sección no quedó registrada. Ninguno de los registros de tareas públicos de narsil-check (`odd/tasks/*.md`) trata de ella; tratan de ecosistemas, antigüedad de las versiones y vulnerabilidades.

### Reconstrucción a partir del historial de commits

A partir de `git log -- hooks/session.ts`, con los commits relacionados de `hooks/register.tsx`:

- `be8eac0` (2026-11-05) "feat: show the session bar's environment, connectors and Remote Control in the pane" (mostrar en el panel el entorno, los conectores y Remote Control de la barra de sesión). Su mensaje da el motivo: la sección es "read from the desktop app's own MCP servers, so the app's session bar can be hidden" (de los propios servidores MCP de la app de escritorio, para que la barra de sesión de la app se pueda ocultar).
- `2bd1919` (2026-11-05) "feat: repository link, Remote Control switch in Entorno and /mcp from connectors" (enlace al repositorio, interruptor de Remote Control en Entorno y /mcp desde los conectores). Entorno pierde una línea Local/Nube y gana el enlace al repositorio.
- `c07f5e9` (2026-11-05) "feat: Entorno starts open, other sections fold until they have something" (Entorno empieza abierta, las demás secciones se pliegan hasta que tienen algo).
- `d8c664e` (2026-11-05) "fix: retry the first session read until the app's servers answer" (reintentar la primera lectura de la sesión hasta que respondan los servidores de la app). La primera respuesta a unos servidores que todavía no estaban conectados: reintentar durante alrededor de un minuto.
- `55fe118` (2026-11-06) "fix: ask the app's session servers less often" (preguntar menos a menudo a los servidores de sesión de la app). Como mucho cuatro lecturas al inicio, y servidores consultados tras un turno solo cuando hace falta, porque los reintentos "tripped Narsil's loop alert" (dispararon la alerta de bucle de Narsil).
- `4770a49` (2026-11-06) "fix: ask the app's session servers once, ten seconds after start" (preguntar a los servidores de sesión de la app una sola vez, diez segundos después del inicio). Los reintentos se sustituyen por una única lectura retrasada, por la petición de permiso.
- `7d91264` (2026-11-07) "feat: add an Auto-fix switch to Entorno for the session's open pull request" (añadir a Entorno un interruptor de Auto-fix para el pull request abierto de la sesión).
- `90c40f9` (2026-11-07) "fix: read the session's pull request again when the app binds it after the turn ends" (volver a leer el pull request de la sesión cuando la app lo vincula después de que termine el turno).
- `f091e0b` (2026-11-07) "fix: retry only the pull request read and stop the retries when the session ends" (reintentar solo la lectura del pull request y detener los reintentos cuando termina la sesión). Su mensaje: cada reintento había vuelto a preguntar a los conectores y a la sesión, "three calls that reach every other mod" (tres llamadas que llegan a todos los demás mods).

Vale la pena fijarse en el patrón: tres correcciones seguidas (`d8c664e`, `55fe118`, `4770a49`) preguntaron cada una menos a los servidores. La primera versión insistía más cuando los servidores no estaban listos; la última espera, pregunta una vez y vuelve a preguntar solo por un motivo.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil Check.

> En mi mod de Claude Code `my-panel`, añade al panel una sección "Environment". Lee la carpeta con `$.session.cwd()`, la rama con `$.process.run(['git', 'branch', '--show-current'])` y el remoto con `git remote get-url origin`, convertido en un enlace https para remotos SSH y HTTPS. Lee Remote Control de la app de escritorio con `$.mcp.call('ccd_session_mgmt', 'get_session', { session_id: 'self' })`, prefiriendo `structuredContent` y recurriendo al JSON del contenido de texto. Otros mods ven cada llamada a los servidores de la app, y una temprana puede provocar una petición de permiso, así que lee una vez, diez segundos después de `session.start` con `$.clock.sleep`, sin esperarlo con await en el hook; si falla, muestra "Reading…" e inténtalo una vez más en el primer `turn.start` principal. Después de cada turno principal vuelve a leer solo git. Guarda el error de cada parte por separado y muéstralo en rojo. Prueba con `mock.clock` que no se llama a ningún servidor antes de diez segundos y solo una vez después.

## El código mínimo

Esta es una versión reducida de la idea, escrita para esta guía y comprobada con los tipos de Claude Code 2.1.325. Está adaptada de `hooks/register.tsx` y `hooks/session.ts` en [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later).

El tipo del estado, en `types/index.d.ts`:

```ts
export type Env = { isLoaded: boolean; cwd: string; branch: string; remote: string; error?: string }

declare module 'claude-code' {
  interface PluginState {
    'my-panel': { env: Env }
  }
}
```

El módulo de hooks, `hooks/register.tsx`:

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

El panel se abre como en la primera guía. Tres detalles sostienen el diseño. La lectura retrasada se ejecuta con `void`, así que `session.start` vuelve enseguida. Una primera lectura fallida no escribe nada, así que la sección dice que está leyendo en lugar de mostrar un error que el siguiente intento puede resolver. Y el reintento espera a un evento real, el primer turno, en lugar de un bucle con temporizador que otros mods verían como llamadas a herramientas repetidas.

## Errores comunes y cómo probarlo

Estos salen del código y los commits de Narsil Check:

- **Llamar a los servidores de la app justo en `session.start`.** Puede que todavía no estén conectados, y quien creó Narsil Check vio a la app de escritorio pedir permiso incluso con los permisos omitidos (`4770a49`). Espera, y después pregunta una vez.
- **Reintentar en bucle.** Otros mods ven cada llamada como una llamada a herramienta; los reintentos de Narsil Check dispararon la alerta de bucle de Narsil (`55fe118`).
- **Esperar con await la lectura lenta dentro del hook.** `$.clock.sleep` gasta el propio presupuesto del hook, como dicen los tipos. Arráncala con `void` y deja que el hook vuelva.
- **Leer solo `content`.** Prefiere `structuredContent` cuando la herramienta declara uno, y analiza los bloques de texto solo como alternativa.
- **Un solo error para todo.** Guarda un error por parte, para que un servidor ausente no oculte la rama que puedes leer de git.
- **Suponer que todas las superficies tienen los servidores del escritorio.** En el terminal las llamadas fallan; diseña la sección para que muestre lo que git puede decir y explique por qué falta el resto.
- **Leer los servidores después de cada turno.** Narsil Check les vuelve a preguntar solo cuando el turno usó una herramienta que cambia su respuesta (`SESSION_TOOLS`) o la última lectura falló.

Para probarlo, `tests/session.test.tsx` en narsil-check responde a los servidores de la app con un hook `on('mcp.call', ...)`, a git con `on('process.run', ...)` y a la carpeta con `on('session.cwd', ...)`, y mueve el tiempo con `mock.clock(on)` y `clock.advance`. Entre los tests que vale la pena copiar por su nombre están "the app's servers are first asked ten seconds after the session starts, once; a failed read is tried again as the first turn starts" (a los servidores de la app se les pregunta por primera vez diez segundos después de que empiece la sesión, una vez; una lectura fallida se intenta de nuevo cuando empieza el primer turno), "a turn that touched no session tool reads only git again, not the app's servers" (un turno que no tocó ninguna herramienta de sesión vuelve a leer solo git, no los servidores de la app) y "a server the mod cannot reach says why once the first turn has tried it too" (un servidor al que el mod no puede llegar dice por qué una vez que el primer turno también lo ha intentado). Usa valores sintéticos en tus fixtures, como un remoto `git@github.com:acme/shop.git`.

## Para ir más lejos

La sección completa de narsil-check añade:

- El pliegue **CI** del pull request de la sesión, leído con `gh` (la cuarta guía).
- La sección **Conectores**, leída de los mismos servidores en el mismo `loadSession` (la guía siguiente).
- `pathOf` en `hooks/session.ts`, que encuentra la carpeta con la que respondió el selector, como campo `path` o como la primera ruta absoluta de sus palabras.
- Esta misma sección es lo que te permite ocultar la propia barra de sesión de la app de escritorio: todo lo que mostraba está aquí, con los mismos clics.
