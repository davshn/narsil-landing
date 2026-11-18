---
title: El reloj de la caché
description: 'Cómo Narsil cuenta hacia atrás la caché del prompt desde la última petición, 60 minutos con suscripción y 5 con clave de API, y por qué el siguiente turno cuesta más cuando se enfría.'
route: pet
order: 8
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: hooks/usage.ts
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Qué hace

Cuando un turno termina y Claude te espera, Narsil muestra un pequeño reloj en la fila de la conversación:

```text
🧊 Caché: 42 min
```

Cuenta hacia atrás, minuto a minuto, cuánto se espera que dure la caché del prompt de esta conversación. Cuando llega a cero, lo dice: en la banda, "🧊 Caché fría", y en la ventana flotante y en el hub, la frase completa "🧊 Caché fría: el próximo mensaje se cobra completo". Cuando envías el siguiente prompt, el reloj desaparece, porque Claude vuelve a trabajar, y empieza uno nuevo cuando termina ese turno.

Por qué te importa: cada mensaje que envías hace que Claude vuelva a leer toda la conversación. La caché del prompt guarda la parte ya enviada, así que una respuesta dentro de su vida útil la reutiliza. Como dice el README, el mensaje sale entonces más barato; en cuanto la caché ha caducado, el siguiente mensaje se cobra completo, y la conversación tiene que volver a escribirse en la caché. Los tipos de 2.1.325 describen esa reescritura, en otro contexto, como "waited for, the longer the conversation the longer" (algo que hay que esperar, y cuanto más larga la conversación, más larga la espera). Así que el reloj responde a una pregunta práctica: si vuelves ahora a esta conversación, ¿sigue caliente?

El reloj supone 60 minutos con un plan de suscripción y 5 minutos con una clave de API. `/narsil cache` dice cuánto está contando; `/narsil cache 30` lo fija a mano, y `/narsil cache auto` vuelve a decidirlo a partir de tu cuenta.

La fila de cada conversación muestra su propio reloj, así que puedes ver qué conversaciones siguen calientes antes de retomar una.

## Cómo funciona por dentro

### No es un temporizador: un valor y un latido

El reloj es un átomo, `cache`, en `hooks/register.tsx`. Contiene cuatro números:

- `at`: cuándo terminó el turno.
- `requestAt`: cuándo empezó la última petición al modelo del turno.
- `minutes`: cuánto dura la caché.
- `left`: los minutos enteros que quedan, tal como se muestran.

Nada cuenta hacia atrás por sí solo. En cada latido de dos segundos, `tickCache` vuelve a calcular `left` con `cacheLeft` de `hooks/words.ts`:

```ts
export function cacheLeft(at: number, minutes: number, now: number): number {
  return Math.max(0, Math.ceil((at + minutes * 60_000 - now) / 60_000))
}
```

Solo escribe el átomo cuando cambió el número de minutos, así que la banda se vuelve a dibujar una vez por minuto, no cada dos segundos. Redondear hacia arriba significa que "1 min" se queda hasta que ha pasado el último segundo, y que cero significa que de verdad se acabó.

### Cuándo empieza y cuándo se detiene

Tres eventos lo mueven:

- **`turn.step`** se dispara cuando el motor está a punto de enviar una petición al modelo. Para la conversación principal (`e.agentId === undefined`), Narsil registra la hora en `lastRequestAt`. Las peticiones de un subagente quedan fuera: como dice el comentario, las peticiones de un subagente tienen su propia caché.
- **`turn.complete`** para la conversación principal llama a `startCache`, que escribe el átomo con `at` igual a ahora y `requestAt` igual a `lastRequestAt`.
- **`turn.start`** borra el átomo: mientras Claude trabaja, no hay reloj.

### Por qué desde el inicio de la última petición

El reloj cuenta desde que empezó la última petición, no desde que terminó el turno. La función auxiliar `cacheStart` dice por qué en su comentario: "the API counts it from the start of the request that last read or wrote it" (la API la cuenta desde el inicio de la petición que la leyó o escribió por última vez). Una respuesta larga que tardó tres minutos en escribirse ya ha gastado tres de los minutos de la caché cuando termina el turno.

Esto fue una corrección, `c3e4464`, y el test que la fija se lee como la explicación: con una caché de cinco minutos y tres minutos gastados mientras el modelo respondía, la banda muestra "🧊 Caché: 2 min" al final del turno, no cinco.

Los próximos pasos que Narsil ofrece tras un turno tranquilo siguen contando desde el final del turno (`at`): tratan de que tú estés ausente, no de la caché.

### Decidir entre 60 y 5 minutos

Cuánto dura la caché no es algo que el mod pueda leer. El comentario que hay sobre las constantes lo dice:

```tsx
// How long the prompt cache lasts, in minutes: on a plan Claude Code keeps it
// an hour, with an API key five minutes. The API does not say which: a
// person who knows better sets it with /narsil cache.
const PLAN_CACHE_MINUTES = 60
const API_CACHE_MINUTES = 5
```

(Cuánto dura la caché del prompt, en minutos: con un plan, Claude Code la mantiene una hora; con una clave de API, cinco minutos. La API no dice cuál: una persona que lo sepa mejor lo fija con /narsil cache.)

Así que `cacheMinutes` decide en dos pasos:

1. Si fijaste un número con `/narsil cache <min>`, ese número.
2. Si no, según si la cuenta tiene ventanas de límite de uso. Si el átomo `usage` (la guía anterior) tiene una lectura de 5 horas o semanal, es una suscripción y la caché recibe 60 minutos; si no, es una clave de API y la caché recibe 5.

El segundo paso se apoya en lo que dicen los tipos de 2.1.325 sobre `rateLimits`: "empty off a subscription" (vacío fuera de una suscripción). La decisión se toma cuando termina el turno, a partir de lo que tenga el átomo `usage` en ese momento.

Los números 60 y 5 son la suposición del mod, declarada en su código y en su README, no una cifra que informe Claude Code. El ajuste manual existe porque quien creó Narsil sabía que la suposición podía ser incorrecta para la configuración de alguien. Un ajuste nuevo también vuelve a calcular el reloj que ya está en marcha.

### Qué dibuja, y dónde

El texto sale de `cacheLabel` en `hooks/words.ts`: "🧊 Caché: N min" mientras está caliente, la frase de caché fría en cero. `cacheShort` recorta la frase de caché fría a "🧊 Caché fría" para las filas de la banda, que tienen poco espacio; la ventana flotante muestra la etiqueta completa cuando abres una conversación.

Cada conversación envía además al hub `cacheEndsAt`, el momento en que se acaba su caché, en segundos, y `cacheMinutes`. Con eso, las otras conversaciones, la ventana flotante y el teléfono pueden llevar la cuenta atrás de un reloj que no arrancaron.

El README dice que el reloj es verde mientras está fresco y rojo cuando está a punto de caducar, y `hooks/words.ts` tiene un `cacheColor` para ello, basado en cuánto de la vida de la caché se ha gastado. En el código actual, `hooks/register.tsx` importa `cacheColor` pero nunca lo llama: la banda dibuja el reloj como texto atenuado, y la ventana flotante como una nota simple. Si construyes el tuyo, el color es una línea más, como se muestra abajo.

## Constrúyelo con Claude

Pídele a Claude una cuenta atrás que muestre, tras cada turno, cuánto se espera que dure la caché del prompt. La idea que Claude debe acertar: el reloj cuenta desde el inicio de la última petición, no desde el final del turno.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil.

> En mi mod de Claude Code `my-pet`, muestra una cuenta atrás de la caché del prompt en la banda `AbovePrompt` mientras Claude me espera. En `turn.step`, solo para la conversación principal (`e.agentId === undefined`), registra la hora con `$.clock.now()` antes de la petición y deja pasar el flujo con `return yield* next(e)`. En `turn.complete`, para la conversación principal, arranca un reloj en un átomo desde esa hora de petición; bórralo en `turn.start`. Que dure 60 minutos cuando `$.session.usage()` informe ventanas de límite de uso y 5 minutos cuando no informe ninguna, y que una orden `/pet cache <min>` pueda cambiarlo. Cada pocos segundos con `$.clock.every`, vuelve a calcular los minutos enteros que quedan, redondeados hacia arriba, y escribe el átomo solo cuando el número cambie. Muestra "Cache: N min" y, en cero, "Cache cold: the next message is billed in full". Añade un test con un reloj simulado de que una respuesta de tres minutos deja dos minutos de una caché de cinco.

### Qué revisar en la respuesta de Claude

1. La hora de la petición se registra en `turn.step`, solo para la conversación principal (`e.agentId === undefined`), y el hook sigue dejando pasar el flujo con `return yield* next(e)`.
2. `turn.complete` arranca el reloj desde esa hora de petición, y `turn.start` lo borra, así que no hay reloj mientras Claude trabaja.
3. Los minutos que quedan se redondean hacia arriba, y el átomo se escribe solo cuando ese número cambia, no en cada latido.
4. La caché dura 60 minutos cuando la cuenta tiene ventanas de límite de uso y 5 cuando no tiene ninguna, y un comando puede fijarla a mano.
5. Un test con un reloj simulado muestra que una respuesta de tres minutos deja dos minutos de una caché de cinco.

Si una comprobación falla, dile a Claude lo que ves: "tras una respuesta larga el reloj muestra los 5 min completos", o "las respuestas de Claude dejaron de aparecer en pantalla".

### Cómo lo pidió el autor

La petición original del reloj de la caché no quedó registrada. Llegó el 2026-10-30, antes de los registros de tareas públicos.

#### Registrado: la caché se queda

La única mención registrada está en `odd/tasks/fleet-view.md` en narsil-pet, L2 (extracto), cuando quien creó Narsil estaba quitando secciones de la banda para hacer sitio a la lista de conversaciones:

> "la del cache la mantenemos, la del dinero tambien podriamos eliminarla"

La cuenta del gasto se fue; el reloj de la caché se quedó, y el diseño acordado en L4 lo puso en la fila de cada conversación: "the list of conversations (state, title, context bar, cache clock)" (la lista de conversaciones: estado, título, barra de contexto, reloj de la caché).

#### Reconstrucción a partir del historial de commits

A partir de `git log -- hooks/register.tsx hooks/words.ts`, los commits que tocaron el reloj:

- `0993bd7` (2026-10-30) "feat: show a prompt-cache clock and offer next steps after a turn" (mostrar un reloj de la caché del prompt y ofrecer próximos pasos tras un turno). El reloj y los próximos pasos llegan juntos, los dos arrancados por el final de un turno.
- `0cfc369` (2026-10-31) "refactor: move Narsil's wording and labels out of the hooks module" (sacar los textos y las etiquetas de Narsil del módulo de hooks). Las etiquetas pasan a `hooks/words.ts`.
- `4f8abaa` (2026-11-01) "feat: send the state the band shows to a status topic for your own phone app" (enviar el estado que muestra la banda a un tema de estado para tu propia app del teléfono). La caché viaja al teléfono.
- `49f0fd9` (2026-11-06) "feat: list every open conversation in the band" (enumerar en la banda todas las conversaciones abiertas). El reloj pasa a cada fila.
- `0072d87` (2026-11-07) "fix: make room for the cache in each band row" (hacer sitio a la caché en cada fila de la banda).
- `c3e4464` (2026-11-09) "fix: count the prompt cache from the start of its last request" (contar la caché del prompt desde el inicio de su última petición). La corrección de arriba: antes, el reloj arrancaba cuando terminaba el turno, y exageraba lo que quedaba tras una respuesta larga.

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Escrito para esta guía y comprobado con los tipos de 2.1.325 (`turn.step`, `turn.start`, `turn.complete`, `$.clock.now`, `$.clock.every`, `$.session.usage`). Está adaptado de `hooks/register.tsx` y `hooks/words.ts` en [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). El átomo `cache` se declara en `types/index.d.ts` como en la primera guía, con el tipo `{ requestAt: number; minutes: number; left: number } | null`.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const cache = atom({ plugin: 'my-pet', key: 'cache' } as const, null)
let lastRequestAt: number | null = null

const minutesLeft = (from: number, minutes: number, now: number) =>
  Math.max(0, Math.ceil((from + minutes * 60_000 - now) / 60_000))

async function cacheMinutes($: EngineInterface): Promise<number> {
  const usage = await $.session.usage().catch(() => undefined)
  return usage && usage.rateLimits.length > 0 ? 60 : 5
}

async function tick($: EngineInterface): Promise<void> {
  const c = await read($, cache)
  if (!c) return
  const left = minutesLeft(c.requestAt, c.minutes, await $.clock.now())
  if (left !== c.left) await update($, cache, (k) => (k ? { ...k, left } : k))
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    $.clock.every(5000, () => void tick($))
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) lastRequestAt = await $.clock.now()
    return yield* next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) await update($, cache, () => null)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    const now = await $.clock.now()
    const requestAt = lastRequestAt ?? now
    const minutes = await cacheMinutes($)
    await update($, cache, () => ({
      requestAt,
      minutes,
      left: minutesLeft(requestAt, minutes, now),
    }))
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const c = await read($, cache)
    if (!c) return next(e)
    const { Text } = $.ui.resolve(e)
    const spent = 100 - (c.left / c.minutes) * 100
    const color = spent >= 85 ? '#F0435A' : spent >= 60 ? '#F5B400' : '#22B573'
    return c.left > 0 ? (
      <Text color={color}>{`🧊 Cache: ${c.left} min`}</Text>
    ) : (
      <Text color={color}>🧊 Cache cold: the next message is billed in full</Text>
    )
  })
}
```

Esta versión consulta `$.session.usage()` al final de cada turno. Narsil lee en su lugar las mismas cifras de su átomo `usage`, que `session.measure` mantiene al día (guía anterior), y así se ahorra la llamada.

## Errores comunes y cómo probarlo

- **Contar desde el final del turno.** La vida de la caché empieza con la petición. Tras una respuesta larga, un reloj arrancado al final muestra minutos que ya se fueron (`c3e4464`).
- **Dejar que los subagentes muevan el reloj.** Las peticiones de un subagente también lanzan `turn.step`, con `e.agentId` definido, y tienen su propia caché. Narsil solo registra las de la conversación principal.
- **Un reloj mientras Claude trabaja.** Cada petición nueva vuelve a escribir la caché, así que una cuenta atrás durante un turno no significa nada. Bórralo en `turn.start`.
- **Volver a dibujar en cada tic.** Calcula a menudo, escribe solo cuando cambie el minuto.
- **Tratar 60 y 5 como hechos.** Son la suposición del mod sobre cómo configuran la caché Claude Code y la API. Da a la persona una forma de cambiarlos.
- **Tragarse el flujo en `turn.step`.** El hook es un generador: reenvía cada fragmento (`return yield* next(e)` o un `for await` que haga yield de cada uno), o la respuesta deja de llegar a la pantalla.

Para probarlo, `claude plugin test .` ejecuta `tests/narsil.test.tsx` con un reloj simulado. "after a turn the band counts down the prompt cache, and says when it has gone cold" (tras un turno, la banda hace la cuenta atrás de la caché del prompt, y dice cuándo se ha enfriado) comprueba "🧊 Caché: 5 min" fuera de un plan, después "🧊 Caché: 2 min", después "🧊 Caché fría" en la banda mientras el hub recibe la frase completa, y que un turno nuevo quita el reloj. "the cache counts from the start of the last request, not from the end of the turn" (la caché cuenta desde el inicio de la última petición, no desde el final del turno) comprueba "🧊 Caché: 2 min" tras una respuesta de tres minutos y el `cacheEndsAt` exacto que se envía al hub. "a request of a subagent does not move the cache clock of the conversation" (una petición de un subagente no mueve el reloj de la caché de la conversación) y "on a plan the cache lasts an hour, and /narsil cache sets it by hand" (con un plan la caché dura una hora, y /narsil cache la fija a mano) cubren el resto.

## Para ir más lejos

- `stepsCommand` en `hooks/register.tsx` gestiona `/narsil cache`, `/narsil cache auto` y `/narsil cache <min>`, y también acepta `caché` con su tilde.
- `offerSteps` usa el mismo momento de final de turno, `at`, para ofrecer próximos pasos 15 minutos después de un turno (`STEPS_AFTER_MS`).
- `shownState` envía `cache`, `cacheEndsAt` y `cacheMinutes` al hub para la ventana flotante, las otras conversaciones y el teléfono.
- `cacheColor` en `hooks/words.ts` está listo para un reloj con color, con los mismos umbrales de `levelColor` que las barras de uso de `hooks/usage.ts`.
