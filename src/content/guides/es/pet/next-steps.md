---
title: Próximos pasos
description: 'Cómo Narsil propone hasta tres próximos pasos 15 minutos después de un turno, a partir de los commits, los cambios sin commit y las tareas pendientes, y pone en el prompt el que eliges.'
route: pet
order: 12
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/advice.ts
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Qué hace

Terminas un turno, lees la respuesta y te alejas. Cuando vuelves, la pregunta suele ser la misma: ¿y ahora qué?

Quince minutos después de que terminara un turno, si no has escrito nada desde entonces, Narsil propone hasta tres próximos pasos. En la banda aparecen bajo su propia línea:

```text
➜ ¿Y ahora? Elige uno y te lo dejo en el prompt:
[ Añade reintentos con backoff a net.ts ]  [ Documenta el modo oscuro en el README ]
```

(El terminal muestra solo "➜ ¿Y ahora?".) Cada paso es un botón, y cada uno es una petición escrita en imperativo, lista para enviarse tal cual. El ejemplo del README es "Añade reintentos con backoff a net.ts".

Pulsar un paso no lo envía. Pone el texto en la caja del prompt como borrador, para que lo leas, lo cambies y lo envíes tú. Los demás pasos desaparecen.

El README dice que los pasos responden a dos preguntas: "¿cómo seguimos con el proyecto?" y "¿qué nos falta por hacer?". Para responderlas, Narsil lee los últimos commits, los archivos sin commit y, si el proyecto las tiene, las tareas pendientes de `odd/tasks/*.md`.

La ventana flotante también muestra los pasos. `/narsil pasos off` los desactiva, y el modo discreto los deja fuera.

## Cómo funciona por dentro

### Quince minutos desde el final del turno

Los próximos pasos no tienen temporizador propio. Van montados en el reloj de la caché de la guía 8: cuando termina un turno de la conversación principal, `startCache` escribe el átomo `cache` con `at`, el momento en que terminó el turno. En cada latido de dos segundos, `tickCache` lleva la cuenta atrás de la caché y además comprueba:

```tsx
if (now - c.at >= STEPS_AFTER_MS) void offerSteps($, c.at).catch(() => undefined)
```

`STEPS_AFTER_MS` es 15 minutos. "Si no has escrito nada" no necesita estado adicional: un prompt nuevo inicia un turno, `turn.start` borra tanto el reloj de la caché como cualquier paso en oferta, y no queda ningún `at` desde el que contar.

Los pasos cuentan desde el final del turno, `at`, no desde el inicio de su última petición como hace la caché. La guía del reloj de la caché explica la diferencia: la caché tiene que ver con la API, y los pasos tienen que ver con que tú estés ausente. Un test lo fija: "next steps still wait from the end of the turn, however long its last request took" (los próximos pasos siguen esperando desde el final del turno, por mucho que tardara su última petición).

Al principio la espera era de 3 minutos. El commit `2bcc97c` la pasó a 15 en un commit titulado "calm loop, steps and permission alerts" (calmar las alertas de bucle, de pasos y de permisos), el mismo que pasó el recordatorio de permisos de la guía 10 de 2 a 5 minutos.

### Una vez por turno terminado

`offerSteps` pregunta como mucho una vez por cada turno. Vuelve antes de tiempo cuando:

- ya preguntó para este `at` (`stepsAskedFor`), o hay pasos para este `at` a la vista;
- el turno se detuvo con trabajo en segundo plano todavía en marcha (guía 1): el trabajo no ha terminado, así que no es el momento de preguntar qué viene después;
- los pasos están desactivados, o el modo discreto está activado.

Marca el turno como preguntado antes de comprobar las preferencias. Activar los pasos más tarde no trae pasos para un turno que ya pasó; llegan con el siguiente.

### Lo que lee el modelo

Los pasos reutilizan el contexto de los consejos de la guía 11: el mismo `seen`, el mismo `describe`, el mismo `sanitize`, con el motivo "Propón cómo seguir con el proyecto: qué falta por hacer, qué mejorar o qué funcionalidad viene después."

Dos partes se leen justo antes de preguntar. `readDiff` da lo que cambió el turno, como para el consejo de final de turno. `readProject` da en qué punto está el proyecto, tres partes con `git` y el sistema de archivos:

- `git log --oneline --no-decorate -10`: los diez últimos commits.
- `git status --short`: los archivos sin commit.
- Hasta cinco archivos `.md` de `odd/tasks`, listados con `$.fs.list` y leídos con `$.fs.read`. Una ruta relativa queda bajo el directorio de trabajo de la sesión, como dicen los tipos de 2.1.325.

De cada archivo de tareas, `pendingTasks` se queda solo con lo que no está terminado: las líneas `- [ ]` sin marcar, y las líneas bajo un encabezado `## Tasks` que digan pending, pendiente, todo o in progress. Los elementos marcados y todo lo que hay bajo un encabezado `Log` quedan fuera. El formato es el que usan los propios archivos de tareas de quien creó Narsil; un proyecto sin esos archivos sigue recibiendo sus commits y su estado.

La parte del proyecto está limitada a 2000 caracteres y el diff a 3000, dentro del mismo contexto de 6000 caracteres. Solo los pasos leen el proyecto; un consejo nunca lo hace.

### El prompt exacto

`STEPS_SYSTEM` en `hooks/advice.ts`, citado tal como está en [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). `MAX_STEPS` es 3, `MAX_STEP` es 90, y `NO_ROUTINE` es la misma prohibición de comprobaciones rutinarias que usan los consejos.

```ts
export const STEPS_SYSTEM = [
  'Eres Narsil, una vieja serpiente marina sabia que acompaña a quien programa.',
  'El turno terminó hace unos minutos: propón los próximos pasos que la persona podría pedir ahora.',
  'Responden a "¿cómo seguimos con el proyecto?" y "¿qué nos falta por hacer?": la siguiente tarea pendiente,',
  'una funcionalidad que completa lo que se hizo, o una mejora de diseño que vale la pena.',
  'Reglas:',
  `- Entre uno y ${MAX_STEPS} pasos, uno por línea, en español, como mucho ${MAX_STEP} caracteres cada uno.`,
  '- Cada paso es una petición en imperativo que se le puede enviar tal cual (por ejemplo: "Añade reintentos con backoff a net.ts").',
  `- ${NO_ROUTINE}`,
  '- Concretos y sacados del contexto: las tareas pendientes, los commits recientes, los archivos sin commit; nada inventado.',
  '- Usa lenguaje neutro, sin suponer el género de la persona; no nombres a ningún asistente ni a "Claude".',
  '- Si no hay nada útil que proponer, responde exactamente SKIP.',
  'Responde solo con los pasos (o SKIP), sin comillas ni introducción.',
].join('\n')
```

El mensaje de usuario es `stepsPrompt(context)`: "Contexto del trabajo:", el contexto, y "Próximos pasos:" para cerrar. La llamada es la misma de los consejos: `$.model.complete` con `model: 'haiku'`, `effort: 'medium'`, `maxTokens: 2000` y `timeoutMs: 30_000`.

Pedir imperativos "que se le puede enviar tal cual" es la decisión de diseño que hace funcionar el clic: un paso ya es un prompt, así que llenar la caja con él no necesita reescritura.

### Leer la respuesta

`parseSteps` convierte la respuesta en una lista: nada para `SKIP`; si no, un paso por línea, sin viñetas, números ni comillas, con cualquier "Claude" convertido en "Narsil", como mucho tres, cada uno cortado a 90 caracteres con "…".

Después, una última comprobación: si el átomo `cache` ya no tiene el mismo `at`, empezó un turno nuevo mientras el modelo respondía, y los pasos están desfasados. Se descartan.

Si no, se escriben en el átomo `steps` con su `at`, se registran con `$.ui.log` ("➜ Narsil propone: …") y se envían a la ventana flotante. Cualquier fallo (git, los archivos, el modelo) acaba en un `catch`: esta vez no hay pasos.

### Llenar el prompt al hacer clic

Cada paso se dibuja como un `Button` cuyo `onPress` llama a `pickStep`:

```tsx
async function pickStep($: EngineInterface, step: string): Promise<void> {
  await $.prompt.fill({ text: step })
  await update($, steps, () => null)
  await pushOverlay($)
}
```

Los tipos de 2.1.325 describen que `$.prompt.fill` pone `input.text` "in the prompt box as the draft" (en la caja del prompt como borrador), según `mode`: `replace` por defecto, `append` después del borrador, `insert` en el cursor. Del código se siguen dos consecuencias:

- Sin `mode`, un paso sustituye el borrador que tuvieras en la caja.
- Los tipos dicen que el resultado es `isFilled: false` "under a dialog or headless" (bajo un diálogo o sin interfaz). Narsil no lee el resultado: borra los pasos en cualquier caso. El README describe solo el caso normal.

¿Por qué llenar en lugar de enviar? Un paso sale de un modelo pequeño que lee un resumen. Enviarlo iniciaría un turno que no elegiste, en tu cuenta. Llenar la caja te deja como quien decide, y te permite editar el paso antes.

### Los pasos se quedan solos en la banda

Cuando llegan pasos, `offerSteps` también cierra todas las conversaciones abiertas en la lista de la banda (guía 3), para que los pasos se vean solos. El comentario del render de la banda explica la regla: "Next steps on offer close every conversation until you open one: then they hide, and come back once you close them all." (los próximos pasos en oferta cierran todas las conversaciones hasta que abres una: entonces se ocultan, y vuelven cuando las cierras todas). Esto llegó en `250d2c6`, "let next steps stand alone" (dejar que los próximos pasos se queden solos).

## Constrúyelo con Claude

Pídele a Claude que proponga próximos pasos tras una pausa tranquila, construidos a partir de los commits recientes del proyecto, sus archivos sin commit y sus tareas pendientes. La idea que debe acertar es que un paso entra en el cuadro del prompt como borrador y nunca se envía: tú sigues siendo quien decide.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil.

> En mi mod de Claude Code `my-pet`, propón próximos pasos tras una pausa tranquila. En `turn.complete`, para la conversación principal, registra en un átomo cuándo terminó el turno; bórralo, junto con cualquier paso en oferta, en `turn.start`. En un latido `$.clock.every(2000, ...)`, cuando hayan pasado 15 minutos desde ese momento y solo una vez por turno, lee `git log --oneline -10` y `git status --short` con `$.process.run` y las líneas `- [ ]` sin marcar de `odd/tasks/*.md` con `$.fs.list` y `$.fs.read`. Llama a `$.model.complete` con `model: 'haiku'` y un prompt de sistema que pida de una a tres peticiones en imperativo, de como mucho 90 caracteres cada una, que puedan enviarse tal cual, sacadas de ese contexto, o exactamente `SKIP`. Descarta la respuesta si mientras tanto empezó un turno nuevo. Muestra cada paso como un `Button` en la banda `AbovePrompt`; al pulsarlo, llama a `$.prompt.fill({ text })` y borra los pasos solo cuando `isFilled` sea verdadero. Prueba con un reloj simulado y `on('model.complete', ...)`: nada a los 14 minutos, pasos a los 15, y el paso pulsado llegando a un hook `prompt.fill`.

### Qué revisar en la respuesta de Claude

1. La pausa cuenta desde el momento en que terminó el turno, y `turn.start` la borra junto con cualquier paso en oferta.
2. Al modelo se le pregunta como mucho una vez por turno, aunque el latido se ejecute cada dos segundos.
3. Después de que el modelo responde, el código comprueba que no empezó un turno nuevo mientras tanto, y descarta los pasos si empezó.
4. Solo las líneas `- [ ]` sin marcar de los archivos de tareas llegan al modelo; los elementos marcados se quedan fuera.
5. Pulsar un paso llama a `$.prompt.fill` y nunca lo envía, y los pasos se borran solo cuando `isFilled` es verdadero.

Si una comprobación falla, dile a Claude lo que ves: "después de 15 minutos los pasos cambian cada dos segundos".

### Cómo lo pidió el autor

La petición original de los próximos pasos no quedó registrada. Llegaron el 2026-10-30, en el mismo commit que el reloj de la caché, antes de los registros de tareas públicos. `docs/plan-advice.md`, el plan de los consejos, no los menciona.

#### Registrado: dónde van

El diseño acordado para la banda con todas las conversaciones, `odd/tasks/fleet-view.md` en narsil-pet, L4, los sitúa: "the tip and next steps of this window below" (el consejo y los próximos pasos de esta ventana debajo de) la lista. L4 es el diseño tal como se acordó, apuntado en el registro, no las palabras de quien creó Narsil.

#### Reconstrucción a partir del historial de commits

A partir de `git log -- hooks/register.tsx hooks/advice.ts`:

- `0993bd7` (2026-10-30) "feat: show a prompt-cache clock and offer next steps after a turn" (mostrar un reloj de la caché del prompt y ofrecer próximos pasos tras un turno). Los pasos y el reloj llegan juntos, los dos arrancados por el final de un turno.
- `d1e6d40` (2026-11-04) "feat: make tips weigh design choices from the diff and next steps say what the project lacks" (hacer que los consejos sopesen decisiones de diseño a partir del diff y que los próximos pasos digan lo que le falta al proyecto). Su mensaje: "Next steps read recent commits, git status and pending odd/tasks items to answer how the project goes on." (los próximos pasos leen los commits recientes, git status y los elementos pendientes de odd/tasks para responder cómo sigue el proyecto). `readProject`, `pendingTasks` y las dos preguntas del prompt vienen de aquí.
- `2bcc97c` (2026-11-05) "feat: open the context breakdown from the usage bars and calm loop, steps and permission alerts" (abrir el desglose del contexto desde las barras de uso y calmar las alertas de bucle, de pasos y de permisos). Su mensaje: "next steps wait 15 minutes" (los próximos pasos esperan 15 minutos); antes esperaban 3.
- `250d2c6` (2026-11-07) "feat: open the context from its percent and let next steps stand alone" (abrir el contexto desde su porcentaje y dejar que los próximos pasos se queden solos).
- `c3e4464` (2026-11-09) "fix: count the prompt cache from the start of its last request" (contar la caché del prompt desde el inicio de su última petición). La caché pasó al inicio de la petición; los pasos siguieron contando desde el final del turno.

Las correcciones siguen una dirección: de pasos que llegaban demasiado pronto y decían demasiado poco a pasos que esperan una pausa de verdad y leen el propio plan del proyecto.

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Escrito para esta guía y comprobado con los tipos de 2.1.325 (`$.model.complete`, `$.process.run`, `$.fs.list`, `$.fs.read`, `$.prompt.fill` y su `isFilled`, `$.clock.every`, `turn.start`, `turn.complete`, `ui.render`). Está adaptado de `hooks/advice.ts` y `hooks/register.tsx` en [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). El átomo `ended` (`number | null`) y el átomo `steps` (`{ at: number; items: string[] } | null`) se declaran en `types/index.d.ts` como en la primera guía.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const ended = atom({ plugin: 'my-pet', key: 'ended' } as const, null)
const steps = atom({ plugin: 'my-pet', key: 'steps' } as const, null)
const AFTER_MS = 15 * 60_000
const SYSTEM = [
  'Propose one to three next steps for this project, one per line, at most 90 characters each.',
  'Each one is an imperative request that can be sent as it is.',
  'Take them from the context (pending tasks, recent commits, uncommitted files); nothing invented.',
  'No routine checks. If there is nothing useful, answer exactly SKIP.',
].join('\n')
let askedFor: number | null = null

async function git($: EngineInterface, args: string[]): Promise<string> {
  try {
    const r = await $.process.run(['git', '--no-pager', ...args], { timeoutMs: 5000 })
    return r.exitCode === 0 ? r.stdout.trim() : ''
  } catch {
    return ''
  }
}

async function pending($: EngineInterface): Promise<string[]> {
  try {
    const files = (await $.fs.list('odd/tasks')).filter(
      (f) => f.kind === 'file' && f.name.endsWith('.md'),
    )
    const out: string[] = []
    for (const f of files.slice(0, 5)) {
      const text = await $.fs.read(`odd/tasks/${f.name}`)
      if (typeof text !== 'string') continue
      for (const line of text.split('\n')) {
        const m = /^\s*[-*]\s+\[ \]\s+(.*)$/.exec(line)
        if (m) out.push(m[1]!)
      }
    }
    return out
  } catch {
    return []
  }
}

async function offer($: EngineInterface, at: number): Promise<void> {
  if (askedFor === at) return
  askedFor = at
  const context = [
    `Recent commits:\n${await git($, ['log', '--oneline', '--no-decorate', '-10'])}`,
    `Uncommitted:\n${await git($, ['status', '--short'])}`,
    `Pending tasks:\n${(await pending($)).map((t) => `- ${t}`).join('\n')}`,
  ]
    .join('\n')
    .slice(0, 2000)
  const reply = await $.model.complete({
    model: 'haiku',
    system: SYSTEM,
    prompt: `Context:\n${context}\n\nNext steps:`,
    effort: 'medium',
    timeoutMs: 30_000,
  })
  if (!reply.isAnswered || /^\s*skip\b/i.test(reply.text)) return
  const items = reply.text
    .split('\n')
    .map((l) => l.trim().replace(/^([-*•]|\d+[.)])\s*/, ''))
    .filter(Boolean)
    .slice(0, 3)
    .map((s) => (s.length > 90 ? `${s.slice(0, 89)}…` : s))
  // A turn that started meanwhile makes them stale.
  if (items.length === 0 || (await read($, ended)) !== at) return
  await update($, steps, () => ({ at, items }))
}

async function beat($: EngineInterface): Promise<void> {
  const at = await read($, ended)
  if (at !== null && (await $.clock.now()) - at >= AFTER_MS)
    void offer($, at).catch(() => undefined)
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    $.clock.every(2000, () => void beat($))
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      await update($, ended, () => null)
      await update($, steps, () => null)
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined && e.reason === 'answer') {
      const now = await $.clock.now()
      await update($, ended, () => now)
    }
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const offered = (await read($, steps))?.items ?? []
    if (offered.length === 0) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    const pick = (step: string) => async () => {
      const { isFilled } = await $.prompt.fill({ text: step })
      if (isFilled) await update($, steps, () => null)
    }
    return (
      <Box flexDirection="row" gap={1} flexWrap="wrap" minWidth={0}>
        <Text dimColor>➜ And now?</Text>
        {offered.map((step, i) => (
          <Button key={`step-${i}`} label={step} onPress={pick(step)} />
        ))}
      </Box>
    )
  })
}
```

A diferencia de Narsil, esta versión conserva los pasos cuando no se pudo llenar la caja, así que una pulsación bajo un diálogo se puede repetir.

## Errores comunes y cómo probarlo

- **Pasos para un turno que ya no es el último.** El modelo tarda segundos; mientras tanto puede llegar un prompt nuevo. Vuelve a comparar el momento del turno tras la respuesta, como hace `offerSteps`.
- **Preguntar en cada latido.** La comprobación se ejecuta cada dos segundos. Sin una marca por turno (`stepsAskedFor`), cada latido después del minuto quince volvería a preguntar al modelo.
- **Enviar en lugar de llenar.** Un paso propuesto por un modelo pequeño debe llegar a la caja, no al modelo. Deja que la persona pulse Enter.
- **Sustituir un borrador sin querer.** `$.prompt.fill` sustituye el borrador por defecto. Si quieres conservarlo, pasa `mode: 'append'` o `mode: 'insert'`.
- **Leer el archivo de tareas entero.** Las tareas hechas y el registro solo añaden ruido y longitud. Quédate con las líneas sin terminar, como hace `pendingTasks`.
- **Contar desde la última petición.** Los pasos tratan de una pausa en tu trabajo; cuenta desde el final del turno.

Para probarlo, `claude plugin test .` ejecuta `tests/narsil.test.tsx` con un reloj simulado, el modelo respondido por `on('model.complete', ...)` y la caja del prompt por `on('prompt.fill', ...)`. "a few minutes after a turn Narsil offers next steps, and one click puts it in the prompt" (unos minutos después de un turno, Narsil ofrece próximos pasos, y un clic pone uno en el prompt) no encuentra pasos a los 14 minutos, encuentra tres a los 15, comprueba que cierran las conversaciones y se ocultan cuando se abre una, pulsa el segundo y espera exactamente su texto en la caja, y comprueba que por cada turno se pregunta una vez. "a new turn before the minutes pass, or /narsil pasos off, offers no next steps" (un turno nuevo antes de que pasen los minutos, o /narsil pasos off, no ofrece próximos pasos) y "the next steps ask how the project goes on, from its log, its status and its pending tasks" (los próximos pasos preguntan cómo sigue el proyecto, a partir de su log, su estado y sus tareas pendientes) cubren el resto; el último comprueba que una tarea marcada y el registro nunca llegan al prompt.

## Para ir más lejos

- `stepsCommand` en `hooks/register.tsx` gestiona `/narsil pasos on` y `off`, junto a `/narsil cache`.
- `shownState` envía los pasos al hub, así que la ventana flotante los muestra con la conversación; el estado del teléfono los deja fuera para las otras conversaciones.
- `pendingTasks` en `hooks/advice.ts` también lee tareas en una tabla bajo `## Tasks`, por las palabras pending, pendiente, todo o in progress, así que un registro de tareas escrito como tabla también funciona.
- Con los consejos de la guía 11 y esta guía, todas las llamadas al modelo que hace Narsil pasan por `$.model.complete` con Haiku, salvo el consejo profundo, que hace un fork de la sesión.
