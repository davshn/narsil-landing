---
title: Voz y avisos
description: 'Cómo Narsil elige una frase al azar para cada momento, la dice en voz alta con las voces propias de Windows o macOS y te avisa a través de la ventana flotante o de una notificación del sistema.'
route: pet
order: 6
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: overlay/speak.ps1
  - repo: pet
    path: overlay/speak.sh
  - repo: pet
    path: overlay/toast.ps1
  - repo: pet
    path: overlay/toast.sh
  - repo: pet
    path: docs/plan-advice.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Qué hace

Narsil habla, en español, en los momentos que importan:

| Momento                                            | Un ejemplo de lo que dice         |
| -------------------------------------------------- | --------------------------------- |
| Envías un prompt y empieza el trabajo              | "Estoy en eso."                   |
| Termina un turno                                   | "Listo, ya quedó."                |
| Espera una pregunta, un permiso o un plan          | "Te necesito un momento."         |
| Un turno se detiene por un error                   | "Tuve un tropiezo y me detuve."   |
| Algo lleva cinco minutos esperando                 | "Sigo aquí, esperándote."         |
| Un subagente en segundo plano termina o se detiene | "Un ayudante terminó su encargo." |

Cada momento tiene entre cuatro y diez frases, y elige una al azar cada vez, así que no se repite. Habla de sí misma en primera persona y nunca por su nombre.

Junto con la voz llega un aviso escrito con un título y un texto, como "He terminado" sobre un breve resumen de la respuesta de Claude. Dónde aparece depende de un ajuste:

- **Con la ventana flotante activada** (lo predeterminado), el aviso aparece en la ventana, que se abre para mostrarlo. No se envía además una notificación del sistema.
- **Con la ventana flotante desactivada**, el aviso llega como notificación. En Windows, al hacer clic en ella se abre esa conversación.

Tres órdenes lo ajustan. `/narsil silencio` y `/narsil voz` desactivan y activan la voz. `/narsil discreto` la mantiene en silencio, quita los avisos de "turno terminado" y te sigue avisando, sin hablar, cuando algo te necesita o falla; `/narsil normal` lo deshace. `/narsil prueba` reproduce un aviso de prueba con su voz, para que oigas qué voz eligió tu sistema.

## Cómo funciona por dentro

### Las frases: `hooks/words.ts`

Las palabras viven en su propio archivo, aparte de los hooks. `VOICE` es un objeto con una lista por momento: `start`, `done`, `error`, `question`, `stillWaiting`, `agentDone` y `agentStopped`. `say(moment)` devuelve una frase de esa lista, elegida con `Math.random()`.

El comentario que hay sobre `VOICE` fija las reglas de estilo: español latinoamericano neutro, el pretérito simple, ninguna palabra que solo se use en España, la voz de una asistente tranquila y cálida, "composed, a little playful, never servile" (serena, un poco juguetona, nunca servil), que habla de sí misma en primera persona. Esas reglas se prueban, como se describe más abajo, así que una frase nueva que las incumpla hace fallar la compilación.

Mantener las palabras aparte tiene una razón práctica: permite que los tests lean todas las frases sin ejecutar una sesión, y que alguien cambie su voz sin tocar la lógica de los eventos.

### Una función decide adónde va un aviso: `announce`

Todos los avisos pasan por `announce` en `hooks/register.tsx`. Recibe un tipo (`done`, `question` o `error`), un título, un texto y la frase que hay que decir. En orden:

1. Lee las preferencias. En modo discreto, un aviso `done` se detiene aquí salvo que sea forzado (la prueba lo es).
2. Empieza a hablar, salvo que esté silenciada o en modo discreto. No espera a la voz para seguir.
3. Con la ventana flotante activada, envía el aviso al hub como `POST /event`. Si el hub está caído, `ensureOverlay` lo arranca (como mucho una vez por minuto) y el aviso se vuelve a enviar.
4. Con la ventana desactivada, llama a `notify`.
5. Envía el aviso al teléfono, cuando los avisos al teléfono están activados con `/narsil movil`.
6. Espera a que termine la voz.

Quienes llaman pasan la frase del momento: `say('done')` cuando un turno termina con una respuesta, `say('question')` cuando un turno termina en una pregunta, `say('error')` cuando falla, `say('stillWaiting')` para el recordatorio de los cinco minutos. El inicio del trabajo es la excepción: en `turn.start`, un prompt que escribiste (no una continuación) llama directamente a `speak` con `say('start')`, sin aviso escrito.

### La voz: primero los scripts del mod, después el motor

`speak` prueba primero el script propio de Narsil y recurre a la voz del motor si no puede:

```tsx
async function speak($: EngineInterface, text: string): Promise<void> {
  // The mod's own script first, so a Spanish voice is chosen when one is installed.
  if (await launch($, 'speak', { NARSIL_TEXT: text })) return
  void $.audio.speak(text).catch(() => undefined)
}
```

El comentario da la razón. `$.audio.speak` habla con el sintetizador de la plataforma y, por defecto, con su voz predeterminada. En un ordenador configurado en inglés, esa es una voz inglesa leyendo español. Los scripts de Narsil buscan primero una voz en español por su nombre.

**En Windows, `overlay/speak.ps1`** prueba tres cosas en orden:

1. Una voz en español del motor de voz clásico (`System.Speech`), prefiriendo las voces "Natural" (el comentario del archivo menciona un adaptador que expone ahí voces del Narrador como Dalia) y las latinoamericanas antes que las de España.
2. Una voz en español del motor de voz más reciente de Windows (`Windows.Media.SpeechSynthesis`, las voces instaladas desde la Configuración de Windows), las latinoamericanas primero. Escribe la voz en un flujo y lo reproduce.
3. La voz predeterminada del motor clásico.

**En macOS, `overlay/speak.sh`** enumera las voces con `say -v '?'` y elige primero Paulina (mexicana), después otra voz latinoamericana, después Mónica, después cualquier voz en español y, si no, la predeterminada del sistema, y ejecuta `say`.

En cualquier otro sistema, `launch` devuelve false y `$.audio.speak` habla con el sintetizador propio de la plataforma, que los tipos de 2.1.325 describen como "`say` on macOS" (`say` en macOS).

### Notificaciones: primero el motor, después los scripts

`notify` va al revés: pregunta primero al motor.

```tsx
try {
  if ((await $.ui.notify(text, { title })).isSent) return
} catch {
  // no notification channel: the mod's own script below
}
await launch($, 'toast', {
  NARSIL_TITLE: title,
  NARSIL_TEXT: text,
  NARSIL_LINK: conversationLink(),
})
```

`$.ui.notify` devuelve `{ isSent: true, … }` cuando un canal la aceptó, o `{ isSent: false, reason }` en otro caso. El `try` está ahí, como dice el comentario del código, porque donde el host no tiene ningún notify la llamada lanza una excepción antes de devolver una promesa. Solo cuando el motor no la envió usa Narsil sus scripts. (El README llama al resultado "notificación del sistema"; en el código, el canal propio del motor va primero y los scripts del sistema después.)

- **`overlay/toast.ps1`** construye una notificación emergente de Windows con el título sobre el texto, los dos escapados para XML. Cuando `NARSIL_LINK` contiene un enlace de conversación, hace que la notificación abra ese enlace al hacer clic. Comprueba el enlace con el mismo patrón que usa el hub, `claude://code/continue?session=local_…&source=desktop_action`, antes de usarlo.
- **`overlay/toast.sh`** llama a `osascript` con `display notification`. El título y el texto se pasan como argumentos al script, nunca escritos dentro de él, "so nothing in them runs" (para que nada de ellos se ejecute), como dice su comentario.

### Ejecutar los scripts: `launch`

Tanto la voz como la notificación pasan por `launch`, que arranca un script como un proceso propio y vuelve en el acto. Usa `$.process.run`, que ejecuta una orden por su vector de argumentos, sin shell, y espera a que termine:

- **En macOS** ejecuta `/bin/sh -c 'nohup /bin/sh "$NARSIL_SCRIPT" </dev/null >/dev/null 2>&1 &'`. El shell arranca el script en segundo plano y termina, así que `$.process.run` vuelve enseguida.
- **En Windows** ejecuta PowerShell con `Start-Process -WindowStyle Hidden`, que arranca otro PowerShell oculto sobre el script y vuelve.

El sistema se detecta una sola vez, con `platformOf`: la variable de entorno `OS` (`Windows_NT`) y, si no, `uname -s` (`Darwin` para macOS).

Aquí se ven dos decisiones de diseño:

- **Separado, para que la voz sobreviva al hook.** Una frase hablada puede tardar segundos. Un proceso separado sigue hablando después de que el hook vuelva, después del turno y después de una recarga del mod, a la que, como señala el comentario sobre `launch`, un temporizador de `$.clock` no sobreviviría.
- **El texto en el entorno, nunca en la orden.** La ruta del script, el texto y el título viajan como variables de entorno (`NARSIL_SCRIPT`, `NARSIL_TEXT`, `NARSIL_TITLE`, `NARSIL_LINK`). La línea de órdenes en sí es una cadena fija. El comentario al principio de `speak.ps1` dice por qué: "nothing Claude wrote can be interpreted as code" (nada de lo que escribió Claude puede interpretarse como código). Una respuesta que contenga comillas, puntos y coma o `$(…)` solo se dice o se muestra, nunca otra cosa.

### Lo que el código no usa

Narsil no reproduce clips de sonido: no hay ninguna llamada a `$.audio.play` en `hooks/register.tsx`. La única llamada a `$.audio` es el recurso de `$.audio.speak` de arriba.

## Constrúyelo con Claude

Pídele a Claude unas cuantas frases por momento y un hook que, cuando termina un turno, diga una en voz alta y envíe un aviso escrito. La idea que Claude debe acertar es que la voz nunca retiene el hook: hablar puede tardar segundos, así que se inicia, se captura su rechazo y no se espera.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil.

> En mi mod de Claude Code `my-pet`, habla cuando termine un turno. Deja las frases en `hooks/words.ts` como una lista por momento (`done`, `question`, `error`) con al menos cuatro frases cada una, y una función `say(moment)` que elija una al azar. En `turn.complete`, solo para la conversación principal, elige el momento a partir de `e.reason` y llama a `$.audio.speak`, sin esperarla para que el hook vuelva en el acto, y captura su rechazo. Después envía una notificación con `$.ui.notify(text, { title })` y comprueba `isSent`. Añade un test de que cada momento tiene al menos cuatro frases distintas y de que 200 llamadas a `say` dan más de una frase. Comprueba cada llamada con los tipos de plugin-authoring.

### Qué revisar en la respuesta de Claude

1. Las frases viven en `hooks/words.ts`, aparte de los hooks, con al menos cuatro por momento y una `say(moment)` que elige una al azar.
2. `$.audio.speak` se llama con `void … .catch(...)`, sin esperarla.
3. `$.ui.notify` está dentro de un `try`, porque lanza un error donde el host no tiene canal de notificaciones, y su `isSent` dice si algún canal aceptó el aviso.
4. Solo habla la conversación principal: el hook vuelve antes de tiempo cuando `e.agentId` está definido.
5. Si Claude ejecuta un script para la voz, el texto viaja en el entorno o como un argumento aparte, nunca dentro de una cadena de shell.

Si una comprobación falla, dile a Claude lo que ves: "cada turno termina unos segundos tarde, lo que tarda en decirse la frase".

### Cómo lo pidió el autor

La petición original de la voz y las notificaciones no quedó registrada. Llegan en el primer commit de la ventana, antes de que empezaran los registros de tareas públicos. La única nota de diseño registrada está en `docs/plan-advice.md`, el plan de los consejos de Narsil: "**Voice**: off by default (`/narsil consejos voz` turns it on)" (voz: desactivada por defecto; `/narsil consejos voz` la activa). Eso es un plan, no las palabras de quien creó Narsil, y trata de los consejos, no de estos avisos.

#### Reconstrucción a partir del historial de commits

A partir de `git log -- overlay/speak.ps1 overlay/speak.sh overlay/toast.ps1 overlay/toast.sh hooks/words.ts hooks/register.tsx` en narsil-pet:

- `6f8f938` (2026-10-30) "feat(overlay): add floating window, Spanish voice and Windows toasts" (añadir la ventana flotante, la voz en español y las notificaciones de Windows). `speak.ps1` y `toast.ps1` llegan con la ventana flotante.
- `088508e` (2026-10-30) "fix(notify): fall back to the system script when the host has no notify" (recurrir al script del sistema cuando el host no tiene notify). El `try` alrededor de `$.ui.notify` y los scripts como segunda opción.
- `52af072` (2026-10-30) "feat(mac): speak and notify on macOS with say and osascript" (hablar y notificar en macOS con say y osascript). `speak.sh` y `toast.sh`.
- `a2b5970` (2026-10-30) "fix(overlay): start the window again for an event instead of a notification" (volver a arrancar la ventana para un evento en lugar de para una notificación). Con la ventana activada, un aviso va a la ventana aunque haya que volver a arrancarla.
- `f7a494e` (2026-10-30) "feat: warn about loops, insist on waiting permissions and sum the session up" (avisar de los bucles, insistir en los permisos que esperan y resumir la sesión). El recordatorio tras una espera.
- `c73bc13` y `36256f9` (2026-10-31): Narsil habla de sí misma en primera persona, en la banda, la ventana y los avisos.
- `17ffb30` (2026-10-31) "feat: add a quiet mode that only speaks up when Narsil needs you" (añadir un modo discreto que solo habla cuando Narsil te necesita).
- `665bd4e` (2026-11-06) "feat: speak when work starts and vary every spoken phrase" (hablar cuando empieza el trabajo y variar cada frase hablada). Las frases de `start`, y varias frases para cada momento.
- `44f4372` (2026-11-07) "feat: speak natural neutral Latin American Spanish with more phrases" (hablar un español latinoamericano neutro y natural con más frases). El orden de voces que prefiere las voces latinoamericanas naturales, y las reglas de estilo.

El orden cuenta la historia: primero una voz y una notificación que funcionaban, después cada sistema, después la comodidad de la persona (primera persona, un modo discreto, menos repetición, una voz más natural).

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Escrito para esta guía y comprobado con los tipos de 2.1.325 (`$.audio.speak`, `$.ui.notify`, `turn.complete`). Usa solo la voz y las notificaciones del motor. Los scripts propios de Narsil, que eligen una voz en español, se describen arriba; está adaptado de `hooks/words.ts` y `hooks/register.tsx` en [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later).

Las frases, `hooks/words.ts`:

```ts
export const VOICE = {
  done: ['Done.', 'All finished here.', 'Finished. Have a look when you can.', 'That is done.'],
  question: [
    'I need you for a moment.',
    'I have a question for you.',
    'Your call, please.',
    'Can you help me with something?',
  ],
  error: [
    'Something went wrong and I stopped.',
    'I hit an error.',
    'I stopped to avoid making it worse.',
    'Let us look at this together.',
  ],
} as const satisfies Record<string, readonly string[]>

export type Moment = keyof typeof VOICE

export function say(moment: Moment): string {
  const options: readonly string[] = VOICE[moment]
  return options[Math.floor(Math.random() * options.length)] ?? options[0]
}
```

El hook, en `hooks/register.tsx`:

```tsx
import type { Register } from 'claude-code'
import { say, type Moment } from './words'

export const register: Register = (on) => {
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    const moment: Moment = e.reason === 'answer' ? 'done' : 'error'
    const phrase = say(moment)
    // Not awaited: the utterance may take seconds.
    void $.audio.speak(phrase).catch(() => undefined)
    try {
      await $.ui.notify(phrase, { title: 'my-pet' })
    } catch {
      // no notification channel here
    }
    return result
  })
}
```

Narsil no envía a ningún sitio los turnos `aborted` (pulsaste detener): pone el estado en detenido sin aviso. Una versión más completa comprobaría también `e.reason === 'aborted'` y se quedaría callada.

## Errores comunes y cómo probarlo

- **Esperar a la voz en el hook.** `$.audio.speak` se resuelve cuando termina la frase. Si se espera en un hook, retiene el evento durante segundos. Arráncala y captura su rechazo, como hace Narsil.
- **Poner el texto en la línea de órdenes.** Si ejecutas un script con una frase construida a partir de la respuesta de Claude, pásala en el entorno o como un argumento aparte, nunca dentro de una cadena de shell. `toast.sh` y `speak.ps1` muestran los dos el patrón.
- **Dar por hecho que existe una voz.** `$.audio.speak` rechaza cuando no hay sintetizador o la voz no está instalada. Los scripts de Narsil recurren paso a paso a la voz predeterminada.
- **Dos avisos para un evento.** Narsil envía un aviso a la ventana o al sistema, nunca a los dos, y el README lo dice de la misma forma.
- **Notificar mientras la persona está mirando.** Con la ventana flotante activada, el hub descarta un evento que llega mientras Claude está delante, salvo que sea forzado. La voz sigue hablando.
- **Repetir una sola frase.** La misma frase en cada turno se vuelve ruido enseguida; varias frases por momento lo arreglan casi sin coste.

Para probarlo, `claude plugin test .` ejecuta `tests/narsil.test.tsx`. "each moment Narsil speaks has several phrases, so she does not always say the same" (cada momento en que habla Narsil tiene varias frases, así que no siempre dice lo mismo) comprueba al menos cuatro frases distintas por momento y llama a `say('start')` 200 veces. "what Narsil says is neutral Latin American Spanish: no Spain-only words, the simple past" (lo que dice Narsil es español latinoamericano neutro: ninguna palabra solo de España, el pretérito simple) hace cumplir las reglas de estilo con dos expresiones regulares, y comprueba que ninguna frase contiene su nombre. "on macOS Narsil speaks and notifies with its own scripts, detached, never PowerShell" (en macOS Narsil habla y notifica con sus propios scripts, separados, nunca con PowerShell) ejecuta `/narsil prueba` con un macOS simulado y comprueba la orden `nohup` exacta y los `NARSIL_TEXT` y `NARSIL_TITLE` que pasa. "on Windows Narsil still speaks and starts the window through PowerShell" (en Windows Narsil sigue hablando y arranca la ventana mediante PowerShell) cubre el otro lado, y "with the window on but down, an event starts it again and shows there, never as a notification" (con la ventana activada pero caída, un evento la vuelve a arrancar y se muestra ahí, nunca como notificación) cubre la elección de `announce`. Para oír el resultado en tu propio ordenador, ejecuta `/narsil prueba`.

## Para ir más lejos

- `nudgeText` en `hooks/watch.ts` construye el texto del recordatorio de los cinco minutos, y `NUDGE_AFTER_MS` fija la espera.
- `summary` en `hooks/words.ts` recorta la respuesta de Claude al texto corto del aviso "He terminado", con una versión más larga para el teléfono.
- `/narsil consejos voz` permite que Narsil diga también en voz alta sus consejos de fin de turno; está desactivado por defecto, como planeaba `docs/plan-advice.md`.
- La tabla "Sistemas compatibles" del README enumera la voz y las notificaciones de cada sistema.
