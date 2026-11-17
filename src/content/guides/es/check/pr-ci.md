---
title: 'El CI de tu PR'
description: 'Cómo Narsil Check sigue los pasos de GitHub Actions del pull request de la sesión con la CLI gh, cada 10 segundos mientras una ejecución avanza, y se detiene cuando termina.'
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

## Qué hace

Cuando la sesión tiene un pull request abierto, la sección **Entorno** muestra un pliegue **CI** bajo el interruptor de Remote Control. Sigue la ejecución de GitHub Actions del commit más reciente del pull request, paso a paso, para que puedas ver las comprobaciones sin abrir el navegador.

La cabecera del pliegue dice de un vistazo por dónde va el CI:

| Cabecera                               | Significado                                                                   |
| -------------------------------------- | ----------------------------------------------------------------------------- |
| `CI · 2/4 · Typecheck`                 | En marcha: dos de cuatro pasos hechos, `Typecheck` en marcha ahora.           |
| `CI · pasó`                            | Pasó.                                                                         |
| `CI · falló`                           | Falló.                                                                        |
| `CI · esperando el CI del último push` | Esperando: tu rama tiene un commit que ninguna ejecución ha recogido todavía. |
| `CI · sin ejecuciones`                 | No hay ejecuciones para esta rama.                                            |
| `CI · sin leer`                        | Sin leer: `gh` no pudo responder, y el motivo aparece debajo.                 |

Desplegado, enumera los pasos con una marca en los colores de Narsil:

- `✓` verde: hecho.
- `✗` rojo: fallido, cancelado, agotado por tiempo, esperando una acción o sin poder arrancar.
- `◐` amarillo: en marcha.
- `○` gris: en cola o esperando.
- `–` gris: omitido o neutro.

Los pasos de gestión propios de GitHub (`Set up job`, `Complete job`, `Post …`) se dejan fuera, porque no dicen nada del proyecto. Con varios workflows, el nombre de cada ejecución encabeza sus pasos; con varios jobs, cada job aparece con su propia marca.

Mientras una ejecución avanza, el pliegue vuelve a preguntar cada 10 segundos, y deja de preguntar en cuanto termina el CI. El pliegue se queda como lo dejaste: el inicio de sesión no lo reinicia, y el comentario del código dice que conserva cómo lo dejaste entre sesiones (la primera guía explica lo que dicen los tipos sobre eso). Mientras está plegado, no se pregunta nada.

## Cómo funciona por dentro

### Qué pull request, qué repositorio

El pliegue de CI no busca un pull request por sí mismo. Usa el que la app de escritorio ha vinculado a la sesión, leído en las guías anteriores mediante `$.mcp.call('ccd_pr', 'get_status', { session_id: 'self' })`. `parsePr` en `hooks/session.ts` guarda, para un pull request abierto, su url, su repositorio (`prRepo`, propietario y nombre, como `acme/shop`) y su rama de cabeza (`prHead`).

El pliegue solo se dibuja cuando `view.prUrl` tiene valor. Así que solo existe en la app de escritorio, donde existe `ccd_pr`; la tabla de superficies del README dice lo mismo.

### Preguntar a `gh`

La parte pura vive en `hooks/ci.ts`: construye las órdenes y lee su salida. El módulo de hooks las ejecuta en `readCi`, en `hooks/register.tsx`.

Primero, las ejecuciones de la rama:

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

`RUN_FIELDS` es `'databaseId,headSha,workflowName,status,conclusion'`. `gh` enumera primero las más recientes, así que `latestRuns` toma el commit de la primera ejecución (`headSha`) como el más reciente, guarda solo las ejecuciones de ese commit, y guarda una por nombre de workflow. Las ejecuciones de commits anteriores nunca se mezclan con la actual.

Después, para cada una de esas ejecuciones, sus jobs y pasos:

```ts
export function runViewArgv(repo: string, id: number): string[] {
  return ['gh', 'run', 'view', String(id), '--repo', repo, '--json', 'jobs']
}
```

`jobsOf` lee el nombre, el estado, la conclusión y los pasos de cada job, y descarta los pasos de gestión con una sola expresión regular, `NOISE = /^(Set up job|Complete job|Post .+)$/`.

Los estados del CI son los de GitHub: un `status` (`queued`, `in_progress`, `completed`) y, una vez completado, una `conclusion`. `markOf` convierte ese par en una marca y un color, y la lista de conclusiones fallidas (`FAILED`) es la misma en todas partes: en la marca de un paso, en la cabecera (`ciLabel`) y en la propia marca del pliegue (`ciMark`).

### `$.process.run`, tal como lo usa el código

Los tipos de 2.1.325 describen `$.process.run(argv, init)` como la ejecución de "a command on the host by its argument vector (no shell)" (una orden en el anfitrión mediante su vector de argumentos, sin shell), que resuelve `{ exitCode, stdout, stderr }` "once it exits, any exit code" (cuando termina, con cualquier código de salida). El tiempo límite es de 30 segundos por defecto y diez minutos como máximo; Narsil Check pasa `GH_MS`, 30 segundos. Se rechaza cuando la orden no puede arrancar o sigue en marcha al llegar el tiempo límite. Los tipos también marcan todo el sustantivo `process` como "CLI only" (solo CLI).

De ahí se siguen dos cosas, y el código maneja ambas:

- **Una salida distinta de cero es una respuesta, no una excepción.** `readCi` comprueba `list.exitCode !== 0` y guarda el stderr de `gh` como error, o "gh terminó con el código N" cuando stderr está vacío.
- **Un `gh` ausente es una excepción.** La llamada se rechaza, el `catch` alrededor de `readCi` guarda el mensaje, y el pliegue lo dice.

Como el vector de argumentos no tiene shell, los nombres del repositorio y de la rama llegan a `gh` como argumentos simples: no hay nada que entrecomillar ni escapar.

Hay una razón para ejecutar `gh` en lugar de llamar a la API HTTP de GitHub desde el mod: `gh` trae el inicio de sesión propio de la persona, así que el mod nunca guarda un token de GitHub. Un comentario en `hooks/register.tsx` da una razón relacionada para ejecutar git directamente en "Actualizar rama": "The mod runs git itself, so the app asks no permission." (El mod ejecuta git por sí mismo, así que la app no pide permiso.)

### Esperar a un push

Justo después de `git push`, puede que GitHub no haya arrancado una ejecución para el commit nuevo, y la lista sigue mostrando la ejecución del commit anterior, quizá ya en verde. Mostrar "pasó" entonces sería un error.

Así que cuando la rama activa es la rama de cabeza del pull request, `readCi` también ejecuta `git rev-parse @{upstream}`. Si el commit del upstream no es el commit de las ejecuciones listadas, un push más reciente todavía no tiene ejecución, y la vista se marca como `isWaiting`: la cabecera dice "esperando el CI del último push" y la marca es amarilla.

### Cada 10 segundos, y luego ya no

El sondeo es `watchCi`, un bucle:

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

Está citado de [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Cada línea es una regla:

- **Sin pull request, o con el pliegue cerrado: parar.** No se pregunta nada mientras no estás mirando.
- **Conservar la última respuesta mientras se recarga.** Una vista que ya está `ready` se queda como está durante la siguiente lectura, así que los pasos no parpadean.
- **Una sola vigilancia a la vez.** Cada llamada toma un `id` nuevo. Una vigilancia más reciente (de la siguiente lectura de la sesión, de un pull request encontrado tarde o de la apertura del pliegue) hace que la antigua se detenga en su siguiente comprobación.
- **Un push al que nadie responde termina la espera.** `CI_WAIT_POLLS` es 12, así que tras unos dos minutos un repositorio sin workflow para ese push deja de esperar.
- **Parar ante un error, o cuando no hay nada en marcha ni nada que esperar.** `isGoing` es true mientras el estado de alguna ejecución no sea `completed`.
- **En otro caso, esperar `CI_POLL_MS`, 10 segundos, con `$.clock.sleep`.** Los tipos lo describen como algo que se resuelve "after `ms` milliseconds" (tras `ms` milisegundos).

Los tipos también ofrecen `$.clock.every(ms, fn)`, que llama a `fn` en cada periodo hasta que se cancela. El bucle con `sleep` tiene una propiedad que encaja con este caso: la siguiente lectura empieza solo después de que termine la anterior, así que las llamadas lentas a `gh` nunca se solapan, y el bucle termina por sí mismo con la condición que acaba de leer.

La vigilancia se arranca con `void watchCi($)` tras una lectura completa de la sesión, tras un pull request encontrado tarde, y cuando despliegas el pliegue. Ningún hook la espera nunca con await.

### Cuando `gh` falta o no tiene sesión iniciada

Los dos casos terminan igual. La vista recibe un `error`, la cabecera dice `CI · sin leer`, la marca es un `○` gris, y el pliegue desplegado muestra en rojo "No pude leer el CI con gh: …" seguido del motivo: el mensaje del motor cuando `gh` no pudo arrancar, o el propio stderr de `gh` cuando se ejecutó y se negó, como hace cuando no tiene sesión iniciada. El bucle se detiene ante el error; la siguiente lectura de la sesión o desplegar el pliegue lo intenta de nuevo.

Sobre los permisos, el README solo dice que `gh` debe estar instalado y con sesión iniciada ("con `gh` instalado y con sesión iniciada"). Ni el README ni el código enumeran scopes para leer el CI. La nota del README sobre el permiso `workflow` trata de subir cambios a `.github/workflows` por HTTPS, que es otra funcionalidad.

## Cómo se le pidió a la IA

La petición original del pliegue de CI no quedó registrada. Ninguno de los registros de tareas públicos de narsil-check (`odd/tasks/*.md`) trata de él.

### Reconstrucción a partir del historial de commits

A partir de `git log -- hooks/ci.ts`, con los commits relacionados de `hooks/register.tsx` y `hooks/session.ts`:

- `7d91264` (2026-11-07) "feat: add an Auto-fix switch to Entorno for the session's open pull request" (añadir a Entorno un interruptor de Auto-fix para el pull request abierto de la sesión). La sesión conoce por primera vez su pull request aquí, mediante `ccd_pr`.
- `8af1f0e` (2026-11-07) "feat: show the PR's CI step by step in a collapsible fold under Remote Control" (mostrar el CI del PR paso a paso en un pliegue bajo Remote Control). Todo `hooks/ci.ts` llega en este único commit. Su mensaje: "Reads the newest commit's GitHub Actions runs on the PR's head branch with gh, lists each job's steps without GitHub's bookkeeping ones, and polls every 10 seconds while a run goes or a push waits for one. The fold keeps its open state across sessions." (Lee con gh las ejecuciones de GitHub Actions del commit más reciente en la rama de cabeza del PR, enumera los pasos de cada job sin los de gestión de GitHub, y sondea cada 10 segundos mientras una ejecución avanza o un push espera una. El pliegue conserva su estado abierto entre sesiones.) También cambia el `shape` del atom de sesión para los nuevos campos del pull request.
- `90c40f9` (2026-11-07) "fix: read the session's pull request again when the app binds it after the turn ends" (volver a leer el pull request de la sesión cuando la app lo vincula después de que termine el turno). Sin él, un pull request abierto en un turno no mostraba CI hasta la siguiente lectura.
- `f091e0b` (2026-11-07) "fix: retry only the pull request read and stop the retries when the session ends" (reintentar solo la lectura del pull request y detener los reintentos cuando termina la sesión).

El patrón es distinto del de las guías anteriores: el pliegue de CI llegó completo en un solo commit, sobre la infraestructura del pull request del día anterior, y las correcciones que siguieron trataban de encontrar el pull request, no del CI en sí.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil Check.

> En mi mod de Claude Code `my-panel`, añade un pliegue "CI" para el pull request abierto de la sesión, cuyo repositorio (`acme/shop`) y rama de cabeza ya tengo. Ejecuta `gh run list --repo <repo> --branch <branch> --json databaseId,headSha,workflowName,status,conclusion --limit 20` con `$.process.run` (tiempo límite de 30 s), guarda solo las ejecuciones del `headSha` de la primera fila, una por workflow, y después `gh run view <id> --repo <repo> --json jobs` para cada una. Oculta los pasos `Set up job`, `Complete job` y `Post …`. Muestra cada paso con ✓ verde, ✗ rojo, ◐ amarillo para en marcha, ○ gris para en cola y – gris para omitido. Trata una salida distinta de cero como un error con el stderr de gh, y también un rechazo (gh ausente) como un error; muéstralo en el pliegue. Sondea en un bucle con `$.clock.sleep(10_000)` solo mientras el pliegue esté abierto y una ejecución no esté completada, y detente en otro caso; da a cada vigilancia un id para que una más reciente la sustituya. Prueba los analizadores como funciones puras con JSON sintético de gh, y el bucle con `mock.clock`.

## El código mínimo

Esta es una versión reducida de la idea, escrita para esta guía y comprobada con los tipos de Claude Code 2.1.325. Está adaptada de `hooks/ci.ts` y `hooks/register.tsx` en [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Sigue un solo workflow y deja fuera la espera de un push.

El tipo del estado, en `types/index.d.ts`:

```ts
export type Step = { name: string; status: string; conclusion: string }
export type Ci = { steps: Step[]; isGoing: boolean; error?: string }

declare module 'claude-code' {
  interface PluginState {
    'my-panel': { ci: Ci }
  }
}
```

La parte del módulo de hooks, `hooks/register.tsx`:

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

Arráncalo con `void watchCi($, 'acme/shop', 'feat/login').catch(() => undefined)` desde un hook, sin esperarlo nunca con await, y dibuja los pasos en el hook `ui.render` del panel con `read($, ci)`, un `Text` por paso en su color de `MARK`, y el error en rojo cuando lo haya. El `MARK` reducido trata como fallo cualquier conclusión completada que no sea success o skipped; el `markOf` de Narsil Check nombra las fallidas (`FAILED`) y también muestra `neutral` en gris.

## Errores comunes y cómo probarlo

Estos salen del código y los commits de Narsil Check:

- **Mezclar commits.** `gh run list` devuelve ejecuciones de varios commits. Guarda solo las ejecuciones del commit más reciente, una por workflow, como hace `latestRuns`.
- **Anunciar que pasó justo después de un push.** Puede que la lista siga mostrando la ejecución verde del commit anterior. Compara el commit del upstream con el `headSha` de las ejecuciones, y deja de esperar tras un límite (`CI_WAIT_POLLS`), o un repositorio sin CI para ese push espera para siempre.
- **Tratar el código de salida como una excepción.** `$.process.run` se resuelve con cualquier código de salida. Comprueba `exitCode`, y guarda stderr como motivo.
- **Sondear para siempre.** Detente cuando no haya nada en marcha, cuando el pliegue esté cerrado y ante un error. El bucle de Narsil Check vuelve en cada uno de esos casos.
- **Dos vigilancias a la vez.** Cada lectura de la sesión puede arrancar una vigilancia. Da a cada una un id y deja que gane la más reciente.
- **Esperar la vigilancia con await en un hook.** El `$.clock.sleep` de un hook gasta el presupuesto de ese hook, como dicen los tipos; arranca la vigilancia con `void`.
- **Mostrar la gestión de GitHub.** Los pasos `Set up job` y `Post …` ocultan los que importan.

Para probarlo, `tests/ci.test.tsx` comprueba las funciones puras con JSON sintético de `gh`: "the newest commit's runs, one per workflow, newest first" (las ejecuciones del commit más reciente, una por workflow, primero las más recientes), "a run's steps leave out GitHub's own bookkeeping" (los pasos de una ejecución dejan fuera la gestión propia de GitHub), "each step shows as done, failed, going, waiting or skipped" (cada paso se muestra como hecho, fallido, en marcha, esperando u omitido) y "the fold's line says how far the CI is" (la línea del pliegue dice por dónde va el CI). `tests/session.test.tsx` prueba el pliegue en el panel: responde a `gh` mediante un hook `on('process.run', ...)` indexado por el vector de argumentos unido, y mueve el tiempo con `mock.clock` y `clock.advance(10_000)` en "the CI fold, under Remote Control, shows the PR's run step by step and follows it until it ends" (el pliegue de CI, bajo Remote Control, muestra la ejecución del PR paso a paso y la sigue hasta que termina). "a CI gh cannot read says why in its fold" (un CI que gh no puede leer dice por qué en su pliegue) responde a cada orden con el código de salida 1 y espera `CI · sin leer` y la línea roja.

## Para ir más lejos

- El interruptor **Auto-fix** justo debajo del pliegue (guías anteriores) activa el propio monitor de CI de la app de escritorio para el mismo pull request, que despierta la sesión cuando el CI falla; el pliegue muestra el CI, el interruptor actúa sobre él.
- `ciLabel` cuenta los pasos hechos en todos los jobs y ejecuciones, y nombra el paso en marcha ahora, así que la cabecera sola suele bastar mientras el pliegue sigue plegado.
- El pliegue lee los campos JSON de `gh`, no su salida de texto, así que un cambio en la redacción de `gh` no lo rompe.
