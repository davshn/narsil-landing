---
title: Permisos que esperan
description: 'Cómo Narsil insiste una vez cuando un permiso, una pregunta o un plan llevan cinco minutos esperándote, y por qué lo comprueba con un latido en lugar de con un temporizador.'
route: pet
order: 10
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/watch.ts
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: overlay/server.cjs
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Qué hace

Claude se detiene a menudo en mitad de un turno para preguntarte algo: permiso para ejecutar una herramienta, una pregunta o un plan para aprobar. Narsil te lo dice en ese momento, como muestran las guías anteriores (el estado "TE NECESITA", la voz, la ventana flotante).

Pero esa primera alerta es fácil de pasar por alto. Estabas en otra ventana, o la viste y pensabas volver. Cinco minutos después, si lo mismo sigue esperando, Narsil insiste una vez:

```text
Sigo esperándote
Sigo esperándote desde hace 5 min: pido permiso para usar Bash.
```

La segunda mitad dice qué es lo que espera, así que una pregunta se lee "tengo una pregunta para ti" y un plan "tengo un plan para que lo apruebes".

La insistencia sale como una alerta de pregunta: en la ventana flotante, en voz alta con una de las frases de `stillWaiting` ("Sigo aquí, esperándote."), y al teléfono según las reglas de la guía de voz y alertas. El README añade el detalle que la distingue de la primera alerta: se muestra "aunque estés mirando Claude".

Ocurre una vez por espera. Si sigues sin responder, Narsil no sigue insistiendo.

## Cómo funciona por dentro

### Una espera es una variable del módulo

Lo que espera se guarda en una variable de `hooks/register.tsx`:

```tsx
let waiting: { since: number; what: string; isNudged: boolean } | null = null
```

`startWaiting($, what)` la rellena con la hora actual de `$.clock.now()`; `stopWaiting()` la vuelve a poner a `null`. Una variable del módulo basta: la espera pertenece a esta conversación, y nadie más la lee.

### Qué inicia una espera

Tres sitios llaman a `startWaiting`, los mismos tres que lanzan la primera alerta:

- **`classic.PermissionRequest`**, un diálogo de permiso. La primera guía explica por qué Narsil escucha aquí y no en `tool.check`: el motor solo lo lanza cuando está a punto de mostrarte el diálogo. El hook se lo salta igualmente cuando un hook de la configuración ya respondió (`result.decision` está definido) o el modo es `bypassPermissions`.
- **`tool.call` para `AskUserQuestion` o `ExitPlanMode`**, una pregunta o un plan. Aquí la espera envuelve la propia llamada: `startWaiting` antes de `next(e)`, y `stopWaiting()` en un `finally`, así que termina cuando la herramienta vuelve, vuelva como vuelva.
- **`turn.complete` con una pregunta en la caja de próximo paso de la app de escritorio**, un turno que terminó preguntándote algo.

### Qué la termina

No se fija ningún temporizador, así que no hay nada que cancelar. Una espera termina cuando `waiting` vuelve a `null`, y cada señal de que respondiste hace eso:

- `classic.PostToolUse` y `classic.PostToolUseFailure`: la herramienta se ejecutó, así que la permitiste.
- `classic.PermissionDenied`: dijiste que no. El comentario sobre estos tres hooks: "A permission answered, either way: nothing waits any more." (un permiso respondido, en un sentido u otro: ya no espera nada).
- Cualquier otro `tool.call`: empezó otro paso, así que lo que esperaba quedó respondido.
- `turn.start` y `turn.complete`: un turno nuevo, o el final de este.

### Sin temporizador: el latido comprueba

Narsil ya tiene un latido: `$.clock.every(2000, ...)` arrancado en `session.start`, que también lleva la cuenta atrás de la caché (guía 8). En cada latido, `tickWatch` se hace una pregunta:

```tsx
if (waiting && !waiting.isNudged && now - waiting.since >= NUDGE_AFTER_MS) {
  waiting.isNudged = true
  const text = nudgeText(waiting.what, now - waiting.since)
  void announce($, 'question', 'Sigo esperándote', text, say('stillWaiting'), true).catch(
    () => undefined,
  )
}
```

Los tipos de 2.1.325 ofrecen un temporizador de un solo disparo, `$.clock.after`, y una versión podría arrancar uno en cada `startWaiting` y cancelarlo en cada `stopWaiting`. Narsil no lo hace, y su código dice por qué en otro sitio: un comentario en `turn.complete` señala que una recarga del mod, que sigue a cualquier turno que lo haya editado, cancela los temporizadores de `$.clock`. Con el latido, la comprobación es una comparación de dos números, y ninguno de los sitios que terminan una espera tiene que acordarse de un temporizador.

El latido tampoco hace que la espera sobreviva a una recarga: `waiting` es una variable del módulo y vuelve a empezar vacía. La diferencia está en cómo falla. Una espera perdida significa un recordatorio que no llega, nunca un recordatorio de algo que ya respondiste.

### Por qué una vez, y por qué cinco minutos

`isNudged` hace que sea una vez. Un recordatorio cada cinco minutos convertiría a Narsil en el tipo de alarma que la gente apaga, y la primera alerta más un recordatorio ya cubren el caso habitual de una notificación que se pasó por alto.

Cinco minutos es `NUDGE_AFTER_MS` en `hooks/watch.ts`. Al principio eran dos minutos; el commit que lo subió, `2bcc97c`, se titula "calm loop, steps and permission alerts" (calmar las alertas de bucle, de pasos y de permisos). El mismo commit pasó los próximos pasos de 3 a 15 minutos: quien creó Narsil estaba espaciando todo lo que Narsil dice sin que se lo pidan.

`nudgeText` construye la frase; `took` de `hooks/agents.ts` escribe el tiempo ("5 min").

### Por qué se muestra aunque estés mirando

El último argumento de `announce`, `true`, es `force`. La ventana flotante de la guía 5 normalmente solo aparece cuando Claude no está delante. Un evento forzado se muestra de todos modos: `overlay/server.cjs` muestra el evento cuando Claude no está en primer plano o el evento es forzado, y un evento forzado también vuelve a abrir una ventana que cerraste hace menos de un minuto.

Ni el código ni el README dicen por qué; la lectura de esta guía es que, si han pasado cinco minutos y lo mismo sigue esperando, la primera alerta no funcionó, y que Claude esté delante no significa que la hayas visto.

`announce` respeta las elecciones de cada persona: silenciado o discreto significa sin voz, y la ventana flotante desactivada significa una notificación del sistema en su lugar. El modo discreto (`/narsil discreto`) solo silencia los anuncios de final de turno, así que un recordatorio de que algo te necesita sigue llegando, sin la voz.

## Cómo se le pidió a la IA

La petición original del recordatorio no quedó registrada. Llegó el 2026-10-30, antes de los registros de tareas públicos.

### Registrado: la alerta de bucle que se fue

El recordatorio nació en el mismo commit que una alerta de bucle, que avisaba cuando Claude seguía fallando o editando los mismos archivos. La primera petición de quien creó Narsil en `odd/tasks/fleet-view.md` en narsil-pet, L1 (2026-11-06, extracto), quitó esa alerta:

> "(eliminariamos la alerta de bucle, no la he sentido tan util)"

El registro de tareas la convierte en S9, "Loop alert removed" (alerta de bucle eliminada), y el commit `21e7288` la quita. El recordatorio de un permiso que espera se quedó.

### Reconstrucción a partir del historial de commits

A partir de `git log -- hooks/register.tsx hooks/watch.ts`:

- `2027f06` (2026-10-30) "fix(alerts): only alert when a permission dialog needs your answer" (alertar solo cuando un diálogo de permiso necesita tu respuesta). El paso a `classic.PermissionRequest`, que también decide qué inicia una espera.
- `f7a494e` (2026-10-30) "feat: warn about loops, insist on waiting permissions and sum the session up" (avisar de los bucles, insistir en los permisos que esperan y resumir la sesión). El recordatorio, con una espera de dos minutos.
- `2532e7c` (2026-11-02) "feat: alert as a question when a turn ends asking in the desktop app's next-step box" (alertar como pregunta cuando un turno termina preguntando en la caja de próximo paso de la app de escritorio). Hoy esa pregunta también es una espera.
- `2bcc97c` (2026-11-05) "feat: open the context breakdown from the usage bars and calm loop, steps and permission alerts" (abrir el desglose del contexto desde las barras de uso y calmar las alertas de bucle, de pasos y de permisos). Su mensaje: "a waiting permission is insisted on after 5 minutes" (en un permiso que espera se insiste tras 5 minutos).
- `21e7288` (2026-11-06) "refactor: drop the loop alert, the spending count and the open-conversations line" (quitar la alerta de bucle, la cuenta del gasto y la línea de conversaciones abiertas).

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil.

> En mi mod de Claude Code `my-pet`, recuérdame una vez cuando un permiso espere demasiado. Guarda una variable del módulo `waiting` con `since`, `what` e `isNudged`. Iníciala en `classic.PermissionRequest` después de `next(e)`, salvo que `result.decision` esté definido o `e.permission_mode` sea `bypassPermissions`. Bórrala en `classic.PostToolUse`, `classic.PostToolUseFailure`, `classic.PermissionDenied`, cualquier otro `tool.call`, `turn.start` y `turn.complete`. No uses `$.clock.after`: en `session.start`, arranca un único latido `$.clock.every(2000, ...)` que, cuando hayan pasado cinco minutos e `isNudged` sea falso, lo active y envíe una notificación con `$.ui.notify`. Añade un test con un reloj simulado: nada a los 4 minutos y 50 segundos, exactamente un recordatorio tras 15 minutos, y ninguno cuando el permiso se respondió al cabo de un minuto.

## El código mínimo

Escrito para esta guía y comprobado con los tipos de 2.1.325 (`classic.PermissionRequest` y su `decision`, `classic.PostToolUse`, `classic.PostToolUseFailure`, `classic.PermissionDenied`, `$.clock.every`, `$.clock.now`, `$.ui.notify`). Está adaptado de `hooks/register.tsx` y `hooks/watch.ts` en [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later).

```tsx
import type { EngineInterface, Register } from 'claude-code'

const NUDGE_AFTER_MS = 5 * 60_000
let waiting: { since: number; what: string; isNudged: boolean } | null = null

async function startWaiting($: EngineInterface, what: string): Promise<void> {
  waiting = { since: await $.clock.now(), what, isNudged: false }
}

function stopWaiting(): void {
  waiting = null
}

async function beat($: EngineInterface): Promise<void> {
  if (!waiting || waiting.isNudged) return
  const waited = (await $.clock.now()) - waiting.since
  if (waited < NUDGE_AFTER_MS) return
  waiting.isNudged = true
  const minutes = Math.round(waited / 60_000)
  void $.ui
    .notify(`Still waiting for you after ${minutes} min: ${waiting.what}`, { title: 'my-pet' })
    .catch(() => undefined)
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    $.clock.every(2000, () => void beat($))
    return next(e)
  })

  on('classic.PermissionRequest', async ($, e, next) => {
    const result = await next(e)
    const isDecided = result.decision !== undefined || e.permission_mode === 'bypassPermissions'
    if (!isDecided) await startWaiting($, `permission to use ${e.tool_name}.`)
    return result
  })

  // Answered, either way: nothing waits any more.
  on('classic.PostToolUse', async ($, e, next) => {
    stopWaiting()
    return next(e)
  })
  on('classic.PostToolUseFailure', async ($, e, next) => {
    stopWaiting()
    return next(e)
  })
  on('classic.PermissionDenied', async ($, e, next) => {
    stopWaiting()
    return next(e)
  })
  // A subagent's turns are not this conversation's: they leave the wait alone.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) stopWaiting()
    return next(e)
  })
  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) stopWaiting()
    return next(e)
  })
}
```

Narsil también borra la espera en su hook `tool.call`, donde que empiece otro paso significa que la espera quedó respondida, y ahí mismo inicia una para `AskUserQuestion` y `ExitPlanMode`. La primera guía muestra una versión de ese hook.

## Errores comunes y cómo probarlo

- **Iniciar una espera para peticiones que nadie ve.** Con bypass permissions, o cuando responde un hook de la configuración, no aparece ningún diálogo. Comprueba `result.decision` y `e.permission_mode` después de `next(e)`.
- **Olvidar una salida.** Una espera que nunca se borra te recuerda algo que respondiste hace mucho. Enumera todos los caminos: permitido, fallido, denegado, otro paso, un turno nuevo.
- **Insistir para siempre.** Sin el indicador `isNudged`, el latido te lo recuerda cada dos segundos a partir del quinto minuto.
- **Confiar en un temporizador a través de una recarga.** Los temporizadores de `$.clock` mueren con una recarga del mod. Un latido que compara horas es más fácil de razonar.
- **Bloquear el latido.** El recordatorio se envía con `void … .catch(...)`: una notificación lenta no debe retener el latido que también lleva la cuenta de la caché.

Para probarlo, `claude plugin test .` ejecuta `tests/narsil.test.tsx` con un reloj simulado. "a permission left waiting five minutes is insisted on once, even while you look" (en un permiso que se deja esperando cinco minutos se insiste una vez, aunque estés mirando) lanza un `classic.PermissionRequest`, no encuentra ningún recordatorio a los 4 minutos y 50 segundos, y después exactamente uno tras diez minutos más, de tipo `question`, con `force` activado y el texto "Sigo esperándote desde hace 5 min: pido permiso para usar Bash.". "a permission or question answered in time is not insisted on" (en un permiso o una pregunta respondidos a tiempo no se insiste) responde al cabo de un minuto y no espera ninguno.

## Para ir más lejos

- `tickWatch` en `hooks/register.tsx` también resume la sesión tras 30 minutos tranquilos (`IDLE_SUMMARY_MS` y `summaryText` en `hooks/watch.ts`), mostrado como un consejo.
- `announceQuestion` lanza la primera alerta para los mismos tres casos, y `setMood($, 'asking', ...)` pone la banda en "TE NECESITA".
- El hub de la guía 3 coloca una conversación que espera por encima de una que trabaja, así que el recordatorio y la lista coinciden en lo que importa.
