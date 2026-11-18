---
title: Contexto y límites
description: 'Cómo Narsil dibuja la barra de contexto de cada conversación, estima cuándo se llena al ritmo de los últimos 15 minutos, sugiere /compact una vez y muestra los límites de 5 horas y semanal.'
route: pet
order: 7
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/usage.ts
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

Dos tipos de límites deciden cuánto tiempo puedes seguir trabajando con Claude, y Narsil muestra los dos.

**La ventana de contexto** es cuánto de la conversación puede tener el modelo a la vez. Cuando se llena, Claude Code tiene que compactar la conversación, resumiendo lo anterior, y se pueden perder detalles. Cada conversación tiene su propia ventana, así que cada fila de la banda de Narsil tiene su propia barra y su propio porcentaje:

```text
● TRABAJANDO   ▾ web                     ██████░░░░ 62 %
```

La barra de tu propia conversación es azul, para que destaque; las demás son verdes, ámbar a partir del 60 % y rojas a partir del 85 %. Al pulsar el porcentaje de la conversación abierta se ven sus tokens, cuánto falta para que se llene y qué la llena:

- "120k / 200k · lleno en ~20 min".
- Una barra por parte, tal como la desglosa `/context`: mensajes, el prompt de sistema, las herramientas MCP, los archivos de memoria, la reserva para compactar y el espacio libre, cada una con sus tokens.

Cuando el contexto pasa del 70 % y se llenará en menos de 20 minutos, o en cuanto pasa del 85 %, Narsil sugiere una vez: "El contexto va al 72 % y se llenará en ~13 min: es buen momento para /compact."

**Los límites de la cuenta** son la ventana de 5 horas y la ventana semanal de un plan de suscripción. Son los mismos para todas las conversaciones, así que se muestran una sola vez, arriba, con el tiempo que falta para que cada uno se reinicie:

```text
5 horas  ███░░░░░░░ 31 %  reinicia en 2 h 05 min
Semana   █░░░░░░░░░ 12 %  reinicia en 3 d 4 h
```

Con una clave de API no existen esas ventanas, y Narsil no muestra ninguna.

## Cómo funciona por dentro

### De dónde salen los números

Narsil no cuenta tokens por su cuenta. Lee las cifras que Claude Code ya tiene, las mismas que muestra su línea de estado, desde dos lugares de la API de mods:

- **`$.session.usage()`**, llamada una vez en `session.start`. Devuelve `context` (la ventana en vivo: `window` en tokens, y `tokens` y `percent` en cuanto una respuesta los ha informado) y `rateLimits`, una entrada por ventana, cada una con un `kind` (`five_hour`, `seven_day`), un `percentUsed` y una marca de tiempo `resetsAt` opcional.
- **El evento `session.measure`**, que, como dicen los tipos de 2.1.325, "fires when the engine measures the session and a unit moved: after each main-thread turn, and when a rate-limit window moves a whole point" (se dispara cuando el motor mide la sesión y una unidad se movió: después de cada turno del hilo principal, y cuando una ventana de límite de uso se mueve un punto entero). Lleva los mismos `context` y `rateLimits`.

Los dos pasan por una función pura, `usageOf` en `hooks/usage.ts`, que los convierte en la forma propia de Narsil: `context` (`percent`, `tokens`, `window`), `fiveHour` y `week`. Una ventana sin lectura es `null`. Los tipos dicen que `rateLimits` está "empty off a subscription" (vacío fuera de una suscripción), y por eso no se muestran límites con una clave de API.

Después `setUsage` en `hooks/register.tsx` guarda el resultado en el átomo `usage` (solo cuando cambió), registra la lectura del contexto para la estimación, actualiza el desglose y envía el estado al hub, para que las otras conversaciones y la ventana flotante vean la barra de esta.

La decisión de diseño es recibir los datos, no consultarlos periódicamente. El motor lanza `session.measure` justo cuando un número se movió, así que Narsil nunca pide cifras que no pueden haber cambiado.

### La estimación: el ritmo de los últimos 15 minutos

"Lleno en ~20 min" es una suposición en línea recta a partir de las lecturas recientes. Cada vez que se mide el contexto, `trackContext` añade una muestra, `{ at, percent }`, a una lista de 30 como máximo. Después `minutesToFull` en `hooks/usage.ts` hace la cuenta:

1. Se queda solo con las muestras de los últimos 15 minutos (`BURN_WINDOW_MS`).
2. Toma la primera y la última. Si abarcan menos de un minuto, o el contexto no creció, no hay estimación.
3. El ritmo es el crecimiento dividido entre los minutos que hay entre ellas.
4. La respuesta es el espacio que queda dividido entre el ritmo, redondeado.

Por ejemplo: 50 % en el minuto 0 y 60 % en el minuto 5 son 2 % por minuto, y el 40 % que queda tarda 20 minutos.

Cada elección tiene una razón:

- **Quince minutos, no toda la conversación.** El trabajo llega a ráfagas. Un tramo largo de calma seguido de una lectura intensa de archivos debe dar una estimación cercana, no una media que esconda la ráfaga.
- **Sin estimación con menos de un minuto o con un contexto que no crece.** Dos lecturas separadas por segundos, o un contexto que se redujo, dan un ritmo que no significa nada.
- **Olvidar las muestras cuando el contexto se reduce.** Una bajada significa que se ejecutó `/compact` o `/clear`. El ritmo anterior pertenece a una conversación que ya no existe, así que la lista empieza de nuevo.
- **Ocultar las estimaciones de más de dos horas.** `MAX_ESTIMATE_MINUTES` vale 120; una suposición tan lejana falla demasiado para que valga la pena mostrarla, como dice el comentario.

### La sugerencia de `/compact`, una vez

`trackContext` también decide la sugerencia, con cuatro constantes:

- `NUDGE_AT = 70`: nunca por debajo del 70 %.
- `NUDGE_WITHIN_MINUTES = 20`: a partir del 70 %, solo si la estimación dice que se llena en menos de 20 minutos.
- `NUDGE_ALWAYS_AT = 85`: a partir del 85 %, siempre, haya estimación o no.
- `NUDGE_RESET_BELOW = 50`: en cuanto el contexto baja del 50 %, un nuevo llenado puede recibir una nueva sugerencia.

Una marca, `isCompactNudged`, hace que ocurra una vez por llenado. La sugerencia es uno de los consejos de Narsil (`showTip` con el tipo `context`), así que aparece donde aparecen sus consejos, y se omite cuando los consejos están desactivados (`/narsil consejos off`). El razonamiento es el mismo que para todos los avisos de Narsil: un aviso que se repite en cada turno pronto se ignora.

### El desglose, estimado localmente

Lo que llena el contexto sale de `$.session.usage({ breakdown: 'summary' })`. Los tipos describen los dos modos: `full` "sends one token-count request per tool and memory file, as /context does; `summary` estimates locally and sends none" (envía una petición de recuento de tokens por cada herramienta y archivo de memoria, como hace /context; `summary` estima localmente y no envía ninguna). Narsil usa `summary` y lo actualiza cada vez que una medición cambia las cifras, así que el desglose se puede abrir en el acto, incluso para otra conversación, cuyo desglose viaja a través del hub.

`contextDetailOf` en `hooks/usage.ts` se queda con las partes que vale la pena mostrar: descarta los esquemas de herramientas cargados bajo demanda (`deferred`, fuera de la ventana) y las filas vacías, ordena lo usado por tamaño, después la reserva para compactar, después el espacio libre, y da a cada una un color.

### Dibujar las barras

Las piezas de `hooks/usage.ts` son pequeñas y puras:

- `levelColor(percent)`: verde `#22B573`, ámbar `#F5B400` a partir del 60 %, rojo `#F0435A` a partir del 85 %.
- `textBar(percent)`: diez celdas de `█` y `░`, para las filas de la banda.
- `minutesLabel` y `resetIn`: "13 min", "2 h 05 min", "3 d 4 h".
- `usageRows`: las filas que hay que dibujar, cada una con su nota: los tokens y la estimación para el contexto, "reinicia en …" para los límites.
- `usageSvg`: las mismas filas como un SVG pequeño, que se usa en el escritorio, donde cada barra crece desde vacía al dibujarse y el texto sigue el tema claro u oscuro.

### Por qué una barra por conversación

El contexto pertenece a una conversación, no a ti. Una sola cifra de "contexto" para varias conversaciones haría la media de cosas que no se pueden promediar. Por eso se quitó la barra general y cada fila recibió la suya, como recoge la sección siguiente. Los límites de la cuenta son el caso contrario: pertenecen a la cuenta, así que se muestran una sola vez.

## Constrúyelo con Claude

Pídele a Claude que muestre en la banda el llenado de la ventana de contexto y los límites de la cuenta, con una estimación de cuándo se llena el contexto. La idea que Claude debe acertar: Claude Code ya tiene las cifras, así que el mod las lee de `$.session.usage()` y `session.measure` y nunca cuenta tokens ni pregunta con un temporizador.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil.

> En mi mod de Claude Code `my-pet`, muestra en la banda `AbovePrompt` el llenado de la ventana de contexto y los límites de 5 horas y semanal de la cuenta. Léelos una vez con `$.session.usage()` en `session.start` y después en cada evento `session.measure`, y guárdalos en un átomo. Escribe la lógica como funciones puras en `hooks/usage.ts`: una que convierta `context` y `rateLimits` (`five_hour`, `seven_day`) a mi propia forma, una barra de texto de diez celdas, un color que pase a ámbar al 60 % y a rojo al 85 %, y `minutesToFull(samples, now)`, que estime cuándo se llena el contexto a partir de las lecturas de los últimos 15 minutos y devuelva null con menos de un minuto de lecturas o sin crecimiento. Sugiere `/compact` una vez por llenado cuando el contexto pase del 70 % y se llene en menos de 20 minutos, o pase del 85 %. Añade tests para cada función y comprueba cada API con los tipos de plugin-authoring.

### Qué revisar en la respuesta de Claude

1. Las cifras se leen una vez en `session.start` y después en cada evento `session.measure`, sin un temporizador que pregunte una y otra vez.
2. Sin ventanas de límite de uso (una clave de API), no aparece ninguna barra de límite, en lugar de barras al 0 %.
3. `minutesToFull` usa solo las lecturas de los últimos 15 minutos y devuelve null con menos de un minuto de lecturas o sin crecimiento, y las lecturas se borran cuando el contexto se reduce.
4. La sugerencia de `/compact` llega una vez por llenado: desde el 70 % cuando el contexto se llena en menos de 20 minutos, desde el 85 % siempre, tras una marca que solo se reinicia cuando el contexto baja (Narsil usa el 50 %).
5. Las barras pasan a ámbar al 60 % y a rojo al 85 %.

Si una comprobación falla, dile a Claude lo que ves: "la sugerencia de /compact volvió al 71, al 72 y al 73 %", o "después de /compact la estimación sigue diciendo que el contexto está casi lleno".

### Cómo lo pidió el autor

#### Registrado: una barra por conversación

Las barras por conversación se pidieron en `odd/tasks/fleet-view.md` en narsil-pet, en la misma conversación que produjo la vista de todas las conversaciones (L1 tiene fecha 2026-11-06; las entradas posteriores no llevan fecha). L3 (extracto):

> "la barra de contexto general tambien se iria por que no existe un contexto general y se reemplazaria por las barras de contexto de cada conversacion"

La especificación S5 del registro añade: "The account limits (5 hours, week) stay, shown once." (los límites de la cuenta, 5 horas y semana, se mantienen, mostrados una sola vez).

El desglose se pidió en L2 (extracto):

> "el detalle de como se llena el contexto deberia aparecer cuando se de click en la palabra contexto."

L7 lo registra como hecho en la banda. Un día después, `250d2c6` (2026-11-07) "feat: open the context from its percent and let next steps stand alone" (abrir el contexto desde su porcentaje y dejar que los próximos pasos vayan por separado) movió el control de la banda de la palabra al porcentaje, que es donde lo ponen hoy el README y el código. En la ventana flotante, la palabra "Contexto" todavía lo abre.

#### Reconstrucción a partir del historial de commits

Las barras, la estimación y la sugerencia llegaron antes de ese registro, y sus peticiones no quedaron registradas. A partir de `git log -- hooks/usage.ts hooks/register.tsx`:

- `630c0d8` (2026-10-30) "feat(usage): add context, 5-hour and weekly usage bars" (añadir barras de uso de contexto, de 5 horas y semanal). La primera versión: una barra de contexto y los dos límites.
- `c885292` (2026-10-30) "feat: estimate when the context fills, react to tests and dangerous commands, show subagents" (estimar cuándo se llena el contexto, reaccionar a los tests y a las órdenes peligrosas, mostrar los subagentes). La estimación de 15 minutos y la sugerencia de `/compact`.
- `2bcc97c` (2026-11-05) "feat: open the context breakdown from the usage bars and calm loop, steps and permission alerts" (abrir el desglose del contexto desde las barras de uso y calmar los avisos de bucle, de pasos y de permisos). El desglose.
- `49f0fd9` (2026-11-06) "feat: list every open conversation in the band" (enumerar en la banda todas las conversaciones abiertas). La barra pasa a la fila de cada conversación, como pedía L3.
- `d654e3b` (2026-11-06) "feat: list this conversation first with a blue context bar" (enumerar esta conversación primero con una barra de contexto azul).
- `250d2c6` (2026-11-07), arriba.

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Escrito para esta guía y comprobado con los tipos de 2.1.325 (`$.session.usage`, `session.measure`, `SessionContextUsage`, `SessionRateLimit`, `$.clock.now`, `$.ui.toast`). Está adaptado de `hooks/usage.ts` y `hooks/register.tsx` en [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). El átomo `usage` se declara en `types/index.d.ts` como en la primera guía.

La parte pura, `hooks/usage.ts`:

```ts
import type { SessionContextUsage, SessionRateLimit } from 'claude-code'

export type Meter = { percent: number; resetsAt?: string }
export type Usage = { context: number | null; fiveHour: Meter | null; week: Meter | null }
export type Sample = { at: number; percent: number }

export function usageOf(m: {
  context: SessionContextUsage
  rateLimits: readonly SessionRateLimit[]
}): Usage {
  const meter = (kind: string): Meter | null => {
    const r = m.rateLimits.find((x) => x.kind === kind)
    return r ? { percent: r.percentUsed, resetsAt: r.resetsAt } : null
  }
  return {
    context: m.context.percent ?? null,
    fiveHour: meter('five_hour'),
    week: meter('seven_day'),
  }
}

export const levelColor = (p: number) => (p >= 85 ? '#F0435A' : p >= 60 ? '#F5B400' : '#22B573')

export function textBar(percent: number, cells = 10): string {
  const full = Math.max(0, Math.min(cells, Math.round((percent / 100) * cells)))
  return '█'.repeat(full) + '░'.repeat(cells - full)
}

const WINDOW_MS = 15 * 60_000

export function minutesToFull(samples: readonly Sample[], now: number): number | null {
  const recent = samples.filter((s) => now - s.at <= WINDOW_MS)
  const first = recent[0]
  const last = recent.at(-1)
  if (!first || !last) return null
  const minutes = (last.at - first.at) / 60_000
  if (minutes < 1 || last.percent <= first.percent) return null
  const perMinute = (last.percent - first.percent) / minutes
  return Math.max(0, Math.round((100 - last.percent) / perMinute))
}
```

Los hooks, en `hooks/register.tsx`:

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import { levelColor, minutesToFull, textBar, usageOf } from './usage'
import type { Sample, Usage } from './usage'

const usage = atom({ plugin: 'my-pet', key: 'usage' } as const, {
  context: null,
  fiveHour: null,
  week: null,
})
let samples: Sample[] = []
let isNudged = false

async function track($: EngineInterface, next: Usage): Promise<void> {
  await update($, usage, () => next)
  const percent = next.context
  if (percent === null) return
  const now = await $.clock.now()
  const last = samples.at(-1)
  if (last && percent < last.percent) samples = []
  if (percent < 50) isNudged = false
  samples = [...samples, { at: now, percent }].slice(-30)
  const toFull = minutesToFull(samples, now)
  const isNear = toFull !== null && toFull <= 20
  if (isNudged || percent < 70 || !(isNear || percent >= 85)) return
  isNudged = true
  $.ui.toast(`Context at ${Math.round(percent)} %: a good moment for /compact.`)
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    const spent = await $.session.usage().catch(() => undefined)
    if (spent) await track($, usageOf(spent))
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await track($, usageOf(e))
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const u = await read($, usage)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column" minWidth={0}>
        {u.context !== null ? (
          <Text
            color={levelColor(u.context)}
          >{`Context ${textBar(u.context)} ${Math.round(u.context)} %`}</Text>
        ) : null}
        {u.fiveHour ? (
          <Text>{`5 hours ${textBar(u.fiveHour.percent)} ${Math.round(u.fiveHour.percent)} %`}</Text>
        ) : null}
        {u.week ? (
          <Text>{`Week ${textBar(u.week.percent)} ${Math.round(u.week.percent)} %`}</Text>
        ) : null}
      </Box>
    )
  })
}
```

Narsil muestra la sugerencia como uno de sus consejos; una versión mínima puede usar `$.ui.toast`, como aquí.

## Errores comunes y cómo probarlo

- **Consultar las cifras periódicamente.** Un temporizador que llama a `$.session.usage()` cada pocos segundos hace un trabajo que `session.measure` ya hace por ti, en el momento en que un número se mueve.
- **Dar por hecho que los límites existen.** Fuera de una suscripción, `rateLimits` está vacío. En ese caso no dibujes nada, en lugar de una barra al 0 %.
- **Un contexto que todavía no tiene porcentaje.** Antes de la primera respuesta, `percent` y `tokens` pueden faltar. Narsil trata un `percent` que falta como "sin lectura".
- **Conservar el ritmo anterior después de `/compact`.** Si las muestras no se borran cuando el contexto se reduce, la estimación mezcla dos conversaciones y dice tonterías.
- **Una sugerencia en cada turno.** Sin una marca que solo se reinicie cuando el contexto baja, el mismo consejo de `/compact` vuelve al 71, al 72 y al 73 %.
- **Pedir el desglose `full` en cada medición.** `full` envía peticiones de recuento de tokens; `summary` es local y gratuito.

Para probarlo, `claude plugin test .` ejecuta `tests/narsil.test.tsx`. "the context bar tells when it will fill, and Narsil suggests /compact once when it is near" (la barra de contexto dice cuándo se llenará, y Narsil sugiere /compact una vez cuando está cerca) mide 50 % y, cinco minutos después, 60 %, y comprueba el texto "120k / 200k · lleno en ~20 min"; después mide 72 % en el minuto 10 y 74 % en el minuto 11 y comprueba que salió exactamente una sugerencia, "El contexto va al 72 % y se llenará en ~13 min: es buen momento para /compact.". "a context that is not growing shows no estimate and no nudge" (un contexto que no crece no muestra estimación ni sugerencia) cubre un contexto que se reduce. "the band shows the 5-hour window and the week once, and the context in its conversation" (la banda muestra la ventana de 5 horas y la semana una sola vez, y el contexto en su conversación), "off a plan, no limits show, and the context is read when the session starts" (fuera de un plan no se muestran límites, y el contexto se lee cuando empieza la sesión) y "a press on the open conversation percent shows what fills the context, and another goes back to the bars" (pulsar el porcentaje de la conversación abierta muestra qué llena el contexto, y otra pulsación vuelve a las barras) cubren el resto. Las funciones de `hooks/usage.ts` reciben valores simples, así que también se pueden probar directamente con una lista de muestras y un `now` fijo.

## Para ir más lejos

- `contextDetailOf`, `contextDetailRows` y `contextDetailSvg` en `hooks/usage.ts` convierten el desglose de `/context` en barras.
- `usageSummary` y `contextDetailSummary` dan una frase para los lugares que no pueden dibujar barras.
- `toggleContextDetail` en `hooks/register.tsx` vuelve a leer el desglose de esta conversación cuando lo abres, y muestra un toast si no puede.
- `shownState` envía al hub el `context` (su porcentaje y su nota) y el `contextDetail` de cada conversación, y así la banda de otra conversación y la ventana flotante dibujan una barra que no midieron.
