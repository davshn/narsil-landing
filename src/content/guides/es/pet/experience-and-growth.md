---
title: Experiencia y crecimiento
description: 'Cómo Narsil gana experiencia con los turnos terminados, los tests que pasan y los subagentes que acaban, sube de nivel, crece en cinco etapas y lo celebra, con XP que dura entre sesiones.'
route: pet
order: 13
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/xp.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/sprite.ts
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: hooks/phone.ts
  - repo: pet
    path: types/index.d.ts
  - repo: pet
    path: odd/tasks/animated-poses.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Qué hace

Narsil crece con el trabajo que observa. Cada turno terminado, cada ejecución de tests que pasa y cada subagente que termina bien le dan puntos de experiencia (XP). Con suficiente XP llega a un nuevo nivel, y en algunos niveles crece hasta una nueva etapa de su vida: de cría recién salida del huevo a serpiente marina adulta.

Desde tu lado, lo notas en tres cosas:

- **Una etiqueta de nivel** junto a su nombre, en la banda y en la ventana flotante: "⭐ Nivel 3 · 120/300 XP".
- **Una celebración** cuando sube de nivel: un brillo dorado, anillos, estrellas y un cartel "NIVEL 3" sobre su dibujo, y el comentario de la banda dice "¡He subido al nivel 3! ⭐". Una nueva etapa se celebra de otra manera: un destello, rayos de luz, un cartel "¡ETAPA 2!" y "¡He crecido!".
- **Su aspecto.** Cada una de las cinco etapas tiene sus propios dibujos, y se mueve de forma distinta: la cría rebota ligera y rápida, la serpiente adulta se mueve lenta y pesada.

`/narsil nivel` te dice dónde está, la etapa y cómo gana XP.

La XP es un único número para toda la máquina. Sobrevive a cerrar Claude Code, y todas las conversaciones abiertas suman al mismo total. Es un pequeño circuito de recompensa sin efecto en el trabajo de Claude: solo cambia el aspecto de Narsil.

## Cómo funciona por dentro

### Las reglas: `hooks/xp.ts`

Toda la aritmética vive en `hooks/xp.ts`, como funciones puras sobre números simples. El archivo lo dice en su primer comentario: "the hooks module owns the store and the events" (el módulo de hooks se encarga del almacén y de los eventos). Esa separación hace que las reglas sean fáciles de probar sin un motor.

Las ganancias son una tabla, `XP_GAIN`:

| Motivo  | XP  | Cuándo                                             |
| ------- | --- | -------------------------------------------------- |
| `turn`  | 10  | un turno de la conversación principal responde     |
| `tests` | 5   | un comando de tests se ejecuta sin error           |
| `agent` | 3   | el turno propio de un subagente acaba con `answer` |

Los niveles se vuelven más difíciles de forma lineal. `levelOf` empieza en el nivel 1 y resta `level * 100` mientras puede: el nivel 1 necesita 100 XP para llegar al nivel 2, el nivel 2 necesita 200 más, el nivel 3 necesita 300 más, y así sucesivamente. Devuelve el nivel, la XP reunida dentro de este nivel (`into`) y la XP que necesita este nivel (`needed`), que es exactamente lo que imprime la etiqueta.

Las etapas son una segunda tabla, `STAGE_FROM = [1, 5, 10, 20, 35]`: el primer nivel de cada etapa. `stageOf(level)` cuenta cuántos de ellos ha alcanzado el nivel. Así:

| Etapa    | Niveles        | XP total para llegar |
| -------- | -------------- | -------------------- |
| 1 (cría) | 1 a 4          | 0                    |
| 2        | 5 a 9          | 1000                 |
| 3        | 10 a 19        | 4500                 |
| 4        | 20 a 34        | 19 000               |
| 5        | 35 en adelante | 59 500               |

Los totales salen de la regla: llegar al nivel L cuesta 100 × (1 + 2 + … + (L − 1)) XP. A 10 XP por turno, la cría pasa a la etapa 2 tras unos cien turnos terminados, y la etapa 5 queda muy lejos. El README enuncia las mismas reglas en español.

`xpOf` lee un valor guardado "from any version, or none" (de cualquier versión, o de ninguna): todo lo que no sea un número finito positivo cuenta como 0, y una fracción se redondea hacia abajo. Por eso un almacén roto o ausente hace que Narsil empiece de cero en lugar de romper la banda.

### De dónde viene la XP

`gainXp($, reason)` en `hooks/register.tsx` se llama desde cuatro sitios, bajo tres eventos:

- **`turn.complete`**, conversación principal, cuando el turno acaba con `answer`. Dos ramas lo llaman: el final normal ("He terminado") y un final que hace una pregunta en la caja de próximo paso de la app de escritorio. Un turno que termina mientras todavía corre trabajo en segundo plano aún no gana XP: el turno que despierta la sesión cuando ese trabajo informa es el que termina, y el que la gana. Un turno que detienes (`aborted`) o que falla no gana nada.
- **`tool.call`**, cuando el comando coincide con `TEST_COMMAND` (en `hooks/words.ts`: `npm test`, `pnpm test`, `vitest`, `pytest`, `cargo test`, `claude plugin test` y otros) y el resultado no tiene `isError`. Esta comprobación no mira `e.agentId`, así que los tests que pasan en un subagente también cuentan.
- **`endAgent`**, llamado desde `turn.complete` cuando `e.agentId` está definido y el motivo del subagente es `answer`.

El test `passing tests and finished subagents earn experience; failures and stopped turns do not` (los tests que pasan y los subagentes terminados ganan experiencia; los fallos y los turnos detenidos no) en `tests/narsil.test.tsx` fija todo esto.

### Por qué vive en `$.store`, y por qué se vuelve a leer

Narsil guarda dos copias de la XP:

- **`$.store`**, bajo la clave `xp`. Los tipos describen el almacén como "This plugin's own key-value store, kept between sessions and hot reloads" (el almacén clave-valor propio de este plugin, conservado entre sesiones y recargas en caliente), un archivo JSON propio del plugin bajo el directorio de configuración de Claude Code. Eso es lo que hace que la XP sobreviva a una sesión.
- **El átomo `xp`** (`$.state`), que la banda y la ventana flotante leen mientras dibujan, así que un cambio las vuelve a dibujar.

En `session.start`, Narsil copia el valor guardado en el átomo. Después, cada ganancia hace esto:

```tsx
const before = xpOf(await $.store.get(XP_KEY).catch(() => read($, xp)))
const after = before + XP_GAIN[reason]
await $.store.set(XP_KEY, after).catch(() => undefined)
await update($, xp, () => after)
```

El comentario que tiene encima da el motivo para leer primero el almacén en lugar de fiarse del átomo: "another open conversation may have added to it since" (otra conversación abierta puede haber sumado desde entonces). El almacén lo comparten todas las conversaciones del plugin, mientras que cada conversación tiene su propio átomo. Sumar al átomo sobrescribiría las ganancias que otra ventana hizo desde que empezó esta. El test `another conversation’s experience is added to, never overwritten` (a la experiencia de otra conversación se le suma, nunca se sobrescribe) pone el almacén en 50 a espaldas de la conversación y espera 60 tras un turno.

Volver a leer reduce el margen en el que se pierden ganancias; no es un cerrojo. Dos conversaciones que ganan XP en el mismo instante todavía pueden leer las dos el mismo `before`.

Si el almacén falla, la ganancia llega igualmente al átomo (`.catch(() => read($, xp))` y `.catch(() => undefined)`), así que la banda sigue contando durante esta sesión.

### Celebraciones: el átomo `milestone`

Cuando `after` cruza un nivel, `gainXp` compara las etapas de antes y de después y escribe el átomo `milestone`: `{ kind: 'level' | 'grew', level, stage, at }`. Su tipo, `(Milestone & { at: number }) | null`, se declara en `types/index.d.ts`. Además:

- escribe una línea de registro con `$.ui.log`: "🌊 Narsil ha crecido: nivel 5, etapa 2 de 5." o "⭐ Narsil ha subido al nivel 3.";
- sustituye su comentario en la banda mediante `setMood`, conservando su ánimo y su detalle actuales.

El dibujo lee el hito. `sprite(mood, stage, milestone)` en `hooks/sprite.ts` añade:

- para un nivel, `behind` dibuja un brillo radial dorado, y `celebration` dibuja dos anillos que se expanden, siete estrellas y un cartel `NIVEL <n>`;
- para una etapa, un destello blanco, cinco chispas, doce rayos de luz y un cartel `¡ETAPA <n>!`, con el dibujo envuelto en una animación `evolve` que la escala desde la mitad de su tamaño hasta su nuevo aspecto.

Mientras se muestra un hito, la pequeña insignia de estado junto a su cabeza se deja fuera, para que las dos no se peleen por el mismo espacio.

El latido (`beat`, cada 2 segundos) borra el hito cuando ha pasado `MILESTONE_MS`: 6 segundos para un nivel, 9 para una etapa. Un temporizador por celebración habría sido más fácil de escribir, pero el latido ya existe, y un temporizador de `$.clock` se pierde con una recarga del mod.

En la banda, la celebración solo se dibuja cuando la conversación que muestra Narsil es esta (`isOwnTop`): cuando otra conversación es más importante, el dibujo le pertenece a ella.

### Lo que cambia la etapa

`stageOf(levelOf(xp).level)` se calcula allí donde se hace un dibujo:

- **El arte.** `art` en `hooks/sprite.ts` elige la pose dibujada para esa etapa y ese tema, y recurre a la pose base de la etapa, y después a una etapa anterior, cuando falta alguna. Los bucles animados de cada etapa vienen de la tarea registrada en `odd/tasks/animated-poses.md`; la segunda guía de esta ruta trata el dibujo.
- **El movimiento.** `STAGE_MOTION` escala cuánto y a qué velocidad se mueve: amplitud 1.15 y tempo 0.9 para la cría, bajando hasta 0.6 y 1.4 para la etapa 5.
- **Todo lo que está fuera de la banda.** La ventana del consejo recibe `NARSIL_STAGE`; los avisos del móvil usan `phoneIcon(kind, stage)`, un PNG de ella en esa etapa sacado del repositorio; el tema `-estado` envía la etiqueta `xp` y la URL `art` (guía 15).

## Constrúyelo con Claude

Pídele a Claude un sistema de experiencia: puntos por turnos terminados, tests que pasan y subagentes terminados, y después niveles, etapas y una breve celebración. La idea que Claude debe acertar: el total vive en `$.store`, que comparten todas las conversaciones, así que cada ganancia vuelve a leer el almacén antes de sumar.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil.

> En mi mod de Claude Code `my-pet`, dale experiencia a la mascota. Pon las reglas en un módulo puro `hooks/xp.ts`: 10 XP por cada turno terminado de la conversación principal (`turn.complete` con `reason === 'answer'` y sin `agentId`), 5 cuando un comando de tests (`npm test`, `pnpm test`, `vitest`, `pytest`) vuelve sin `isError` en `tool.call`, 3 cuando el `turn.complete` de un subagente acaba con `answer`. El nivel 1 necesita 100 XP, y cada nivel siguiente 100 más que el anterior; las etapas empiezan en los niveles 1, 5, 10, 20 y 35. Guarda el total en `$.store` bajo `xp` para que sobreviva a las sesiones, y antes de cada ganancia vuelve a leer el almacén, porque otras conversaciones suman a él. Refléjalo en un átomo para dibujar. Con un nuevo nivel, escribe un átomo `milestone` con la hora, muestra "Level N" en la banda `AbovePrompt` durante 6 segundos (9 para una nueva etapa) y regístralo con `$.ui.log`. Prueba con `claude-code/testing`: un turno con 95 XP muestra el nivel 2, y a un almacén cambiado a espaldas de la conversación se le suma, no se sobrescribe.

### Qué revisar en la respuesta de Claude

1. Las reglas están en un módulo puro (`hooks/xp.ts`) con los números que pediste: 10, 5 y 3 XP, cada nivel 100 XP más que el anterior, y etapas desde los niveles 1, 5, 10, 20 y 35.
2. Una ganancia lee el almacén, suma, escribe el almacén y después actualiza el átomo. Nunca escribe el valor del átomo de vuelta en el almacén.
3. Solo un turno que termina con `answer` gana XP, y los tests la ganan solo sin `isError`; un turno abortado no gana nada.
4. Un valor guardado que no es un número positivo cuenta como 0 en lugar de romper la banda.
5. Un hito lleva su hora, y la celebración termina a los 6 segundos para un nivel y a los 9 para una etapa.

Si una comprobación falla, dile a Claude lo que ves: "con dos conversaciones abiertas, la XP que ganó una de ellas desaparece cuando la otra termina un turno", o "el aviso de nivel no se va nunca".

### Cómo lo pidió el autor

La petición original de la experiencia y los niveles no quedó registrada. Los registros de tareas públicos del proyecto empiezan más tarde.

Una petición posterior toca las etapas: en `odd/tasks/animated-poses.md`, L4 (2026-11-15), tras el primer bucle animado, quien creó Narsil respondió:

> "si me agrada, vamos a cambiar todos"

El registro de tareas lo convierte en S6: cada pose "at every stage 1-5, light and dark: 60 loops" (en cada etapa 1-5, clara y oscura: 60 bucles).

#### Reconstrucción a partir del historial de commits

A partir de `git log -- hooks/xp.ts` y los commits relacionados:

- `8913cdd` (2026-10-30) "feat: let Narsil earn experience and levels kept across sessions" (dejar que Narsil gane experiencia y niveles que se conservan entre sesiones). La XP, los niveles y el almacén llegan juntos.
- `9bfa039` (2026-10-30) "feat: let Narsil grow through five stages as she levels up" (dejar que Narsil crezca en cinco etapas a medida que sube de nivel). El mismo día, las etapas.
- `7a964d1` (2026-10-30) "feat: draw Narsil as a hatchling at stage 1 and split the art per stage" (dibujar a Narsil como una cría en la etapa 1 y separar el arte por etapa), seguido el 2026-10-31 por un commit por etapa y tema (`6b96e08`, `e029cf0`, `ff02847`, `6a1ceb3`, `4055242`, `b7361a0`, `5ef599a`, `eed13b0`).
- `2cf7133` (2026-10-31) "feat: celebrate a new level and a new stage with their own animations" (celebrar un nuevo nivel y una nueva etapa con sus propias animaciones). El átomo `milestone` y las dos celebraciones.
- `fcd68c7` (2026-10-31) "feat: move Narsil by her stage, with a shadow, splashes, a softer tremble and cheap glows" (mover a Narsil según su etapa, con una sombra, salpicaduras, un temblor más suave y brillos baratos). `STAGE_MOTION`.
- Del 2026-11-15 al 2026-11-16, los bucles animados de cada etapa (`2f08c55` a `673fc9f`), la tarea citada arriba.

El orden dice mucho: primero los números, después las etapas que hacen visibles los números, después un dibujo por etapa, después las celebraciones, después el movimiento. Cada paso hace que la recompensa sea más fácil de notar.

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Escrito para esta guía y comprobado con los tipos de 2.1.325 (`$.store.get`, `$.store.set`, `$.clock.now`, `$.ui.log`, `session.start`, `tool.call`, `turn.complete`, `ui.render`). Está adaptado de `hooks/xp.ts` y `hooks/register.tsx` en [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). Los átomos se declaran en `types/index.d.ts` como en la primera guía: `xp: number` y `milestone: { kind: 'level' | 'grew'; level: number; at: number } | null`.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const GAIN = { turn: 10, tests: 5, agent: 3 } as const
const STAGE_FROM = [1, 5, 10, 20, 35]
const SHOWN_MS = { level: 6000, grew: 9000 } as const
const TESTS = /\b(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?test|vitest|jest|pytest)\b/

const xp = atom({ plugin: 'my-pet', key: 'xp' } as const, 0)
const milestone = atom({ plugin: 'my-pet', key: 'milestone' } as const, null)

function levelOf(total: number) {
  let level = 1
  let left = Math.max(0, Math.floor(total))
  while (left >= level * 100) {
    left -= level * 100
    level += 1
  }
  return { level, into: left, needed: level * 100 }
}
const stageOf = (level: number) => STAGE_FROM.filter((from) => level >= from).length || 1
const xpOf = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0

async function gain($: EngineInterface, reason: keyof typeof GAIN): Promise<void> {
  // Read the store again: another conversation may have added to it.
  const before = xpOf(await $.store.get('xp').catch(() => read($, xp)))
  const after = before + GAIN[reason]
  await $.store.set('xp', after).catch(() => undefined)
  await update($, xp, () => after)
  const was = levelOf(before).level
  const level = levelOf(after).level
  if (level === was) return
  const kind = stageOf(level) > stageOf(was) ? ('grew' as const) : ('level' as const)
  const at = await $.clock.now()
  await update($, milestone, () => ({ kind, level, at }))
  $.ui.log(kind === 'grew' ? `My pet has grown: level ${level}` : `My pet reached level ${level}`)
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    const stored = xpOf(await $.store.get('xp').catch(() => 0))
    await update($, xp, () => stored)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const command = (e as { command?: unknown }).command
    const result = await next(e)
    if (typeof command === 'string' && TESTS.test(command) && !result.isError)
      await gain($, 'tests')
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.reason === 'answer') await gain($, e.agentId === undefined ? 'turn' : 'agent')
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { level, into, needed } = levelOf(await read($, xp))
    const shown = await read($, milestone)
    const isFresh = shown !== null && (await $.clock.now()) - shown.at < SHOWN_MS[shown.kind]
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" gap={1} minWidth={0}>
        <Text dimColor>{`⭐ Level ${level} · ${into}/${needed} XP · stage ${stageOf(level)}`}</Text>
        {isFresh ? (
          <Text bold color="#F5B400">
            {shown.kind === 'grew' ? 'I have grown!' : 'Level up!'}
          </Text>
        ) : null}
      </Box>
    )
  })
}
```

Dos simplificaciones respecto a Narsil. La banda comprueba la antigüedad del hito cuando dibuja, así que la celebración se va en el siguiente redibujado después de su tiempo; Narsil borra el átomo en su latido, que vuelve a dibujar a tiempo. Y esta versión cuenta cada turno de subagente que responde, mientras que Narsil cuenta un subagente una sola vez, mediante su propio registro de los subagentes en marcha.

## Errores comunes y cómo probarlo

- **Guardar la XP solo en un átomo.** `$.state` sobrevive a una recarga del mod, no a una nueva sesión. Todo lo que deba durar va en `$.store`.
- **Escribir el valor del átomo de vuelta en el almacén.** Con dos conversaciones abiertas, cada átomo va por detrás de las ganancias de la otra. Lee el almacén, suma, escribe.
- **Fiarse de un valor guardado.** Un almacén editado a mano, o escrito por una versión anterior, puede contener cualquier cosa. Valídalo (`xpOf`) y vuelve a cero.
- **Premiar el fallo.** Concede el turno solo con `answer`, y los tests solo sin `isError`; un turno abortado no gana nada.
- **Celebrar para siempre.** Un hito necesita una hora de fin y algo que vuelva a dibujar cuando pase.
- **Niveles que nunca llegan.** Comprueba tu curva con números antes de publicarla. Con la de Narsil, la etapa 5 necesita 59 500 XP, que son varios miles de turnos.

Para probarlo, los tests de `tests/narsil.test.tsx` arrancan el mod con un almacén preparado de antemano y lo vuelven a leer. Vale la pena leer: "Narsil keeps her experience across sessions, and celebrates a new level" (Narsil conserva su experiencia entre sesiones, y celebra un nuevo nivel) (95 XP más un turno muestra "⭐ Nivel 2 · 5/200 XP" y "¡He subido al nivel 2! ⭐"), "Narsil grows at levels 5, 10, 20 and 35, and says so" (Narsil crece en los niveles 5, 10, 20 y 35, y lo dice), "a new level plays its own celebration for a while, in the band and the window" (un nuevo nivel reproduce su propia celebración durante un rato, en la banda y en la ventana) y "levels need 100, 200, 300 XP more each, and odd stored values count as none" (cada nivel necesita 100, 200, 300 XP más, y los valores guardados extraños cuentan como ninguno). "the celebrations stay within the Svg size limit at every stage" (las celebraciones se mantienen dentro del límite de tamaño de Svg en cada etapa) protege algo fácil de olvidar: una celebración se suma a un dibujo que ya tiene su límite de tamaño.

## Para ir más lejos

- `xpLabel` en `hooks/xp.ts` es el único sitio donde se escribe la etiqueta, así que la banda, la ventana flotante y el estado del móvil dicen lo mismo.
- `banner`, `behind` y `celebration` en `hooks/sprite.ts` dibujan las celebraciones como SVG sobre el dibujo.
- `artUrl` en `hooks/phone.ts` construye la dirección de su dibujo en cada etapa para el móvil, tal como el repositorio lo publica bajo `assets/`.
- La siguiente guía, el modo discreto, muestra cómo Narsil guarda silencio sin perder lo importante; una celebración es una de las cosas que se siguen mostrando, ya que solo se dibuja.
