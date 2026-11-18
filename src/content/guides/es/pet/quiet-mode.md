---
title: El modo discreto
description: 'Cómo /narsil discreto silencia a Narsil sin perder los avisos que importan: qué se detiene, qué sigue llegando y por qué la línea se traza en "te necesita".'
route: pet
order: 14
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: types/index.d.ts
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Qué hace

Narsil habla mucho a propósito: habla cuando el trabajo empieza y termina, avisa cuando acaba un turno, da consejos, propone próximos pasos y resume la sesión. En un día de reuniones, o simplemente en una oficina compartida, es demasiado.

`/narsil discreto` lo baja todo de una vez. Deja de hablar, deja de avisar cuando acaba un turno y deja de ofrecer consejos y próximos pasos por su cuenta. Sigue avisándote, sin voz, cuando te necesita o algo falló, y la banda sigue mostrando lo que está haciendo. `/narsil normal` lo devuelve todo a como estaba.

Narsil tiene tres formas de apartarse, y conviene distinguirlas:

| Comando            | Lo que cambia                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------ |
| `/narsil silencio` | Solo la voz. Todos los avisos, consejos y pasos siguen llegando, por escrito.              |
| `/narsil ocultar`  | Solo la banda. La voz y los avisos continúan.                                              |
| `/narsil discreto` | Voz apagada, avisos de fin de turno apagados, extras automáticos apagados; el resto sigue. |

Cada uno tiene su contrario: `voz`, `mostrar` y `normal`. Son interruptores independientes, así que `/narsil normal` apaga el modo discreto sin volver a encender una voz silenciada.

## Cómo funciona por dentro

### Una preferencia: `isQuiet`

El modo discreto es un único booleano, `isQuiet`, en el átomo `prefs` de `hooks/register.tsx` (su tipo, `Prefs`, está en `types/index.d.ts`). El manejador del comando `/narsil` lo escribe mediante una pequeña tabla:

```tsx
const change: Record<string, Partial<Prefs>> = {
  ocultar: { isHidden: true },
  mostrar: { isHidden: false },
  silencio: { isMuted: true },
  voz: { isMuted: false },
  discreto: { isQuiet: true },
  normal: { isQuiet: false },
}
```

El parche se fusiona en el átomo y el objeto `prefs` entero se guarda con `$.store.set('prefs', …)`, así que el modo dura entre sesiones hasta que lo cambies. En `session.start`, las preferencias guardadas se fusionan sobre los valores por defecto, lo que también cubre valores guardados antiguos que todavía no tienen el campo.

No hay un camino de código "discreto" propio. En su lugar, cada sitio que hace ruido lee `isQuiet` y decide por sí mismo. Eso mantiene la regla junto a lo que gobierna, y significa que un nuevo tipo de ruido tiene que sumarse al modo discreto de forma explícita.

### La línea que traza: "te necesita" pasa

Todos los avisos pasan por `announce` (la guía 6 lo trata completo). Sus primeras líneas son donde vive el modo discreto:

```tsx
const { isMuted, isFloating, isQuiet } = await read($, prefs)
// Quiet: no voice, and only what needs you (a question, an error) is told.
if (isQuiet && kind === 'done' && !force) return
const spoken = isMuted || isQuiet ? Promise.resolve() : speak($, voice)
```

Un aviso es de uno de tres tipos: `done`, `question` o `error`. En modo discreto:

- un aviso `done` vuelve antes de que pase nada: ni ventana flotante, ni notificación del sistema, ni móvil, ni voz;
- un `question` o un `error` sigue como siempre hacia la ventana flotante (o una notificación del sistema cuando la ventana está apagada) y hacia el móvil, solo que sin la voz.

El motivo de esta línea está en el comentario y en el README: lo que se detiene es lo que puedes perderte sin problema. Un turno terminado seguirá terminado cuando mires. Una pregunta o un permiso bloquea el trabajo hasta que respondas, y un error significa que el trabajo se detuvo. Silenciarlos convertiría un modo discreto en un modo roto.

La marca `force` deja pasar de todos modos a dos llamadores. `/narsil prueba`, el aviso de prueba, va forzado, para que puedas comprobar tus avisos incluso en modo discreto. El recordatorio de los cinco minutos para un permiso o una pregunta que se quedaron esperando también va forzado, aunque como `question` pasaría de todas formas.

### Lo que hace cada tipo de aviso en modo discreto

Recorriendo los llamadores de `announce`:

| Momento                                               | Tipo       | Modo discreto                 |
| ----------------------------------------------------- | ---------- | ----------------------------- |
| Un turno termina ("He terminado")                     | `done`     | detenido                      |
| Un subagente en segundo plano termina bien            | `done`     | detenido                      |
| Un subagente en segundo plano se detiene o falla      | `error`    | se muestra, sin voz           |
| Un turno falla ("Me he detenido")                     | `error`    | se muestra, sin voz           |
| Una pregunta, un plan o un permiso                    | `question` | se muestra, sin voz           |
| Un turno acaba preguntando en la caja de próximo paso | `question` | se muestra, sin voz           |
| Sigue esperando tras 5 minutos                        | `question` | se muestra, sin voz           |
| `/narsil prueba`                                      | `done`     | se muestra (forzado), sin voz |

### Los otros ruidos

Fuera de `announce`, otros cuatro sitios leen `isQuiet`:

- **La voz al empezar el trabajo.** En `turn.start`, un prompt que escribiste le hace decir una frase de inicio, salvo con `isMuted` o `isQuiet`.
- **Los consejos automáticos.** `mayTip` devuelve false con `isQuiet`, antes de contar nada. Un consejo que pides con `/narsil consejo` no es automático y sigue respondiendo.
- **Los próximos pasos.** `offerSteps` vuelve enseguida con `isQuiet`.
- **El resumen de la sesión en reposo.** `tickWatch` muestra el resumen tras 30 minutos de calma solo cuando `isQuiet` es false. `/narsil resumen` sigue respondiendo.

### Lo que el modo discreto no toca

Leer el código también te dice lo que se queda, y vale la pena saberlo:

- **La banda y el contenido de la ventana flotante.** Los estados, los titulares, los comentarios, la lista de conversaciones, el reloj de la caché y la celebración de una subida de nivel se dibujan como antes. El modo discreto trata de interrupciones, no de información.
- **La sugerencia de `/compact`** de la guía 7. Se comprueba contra `isAdviceOn`, no contra `isQuiet`, así que todavía puede aparecer en modo discreto. `/narsil consejos off` la detiene.
- **La advertencia sobre comandos peligrosos** de la guía 9: es un comentario en la banda y una línea de registro, no un aviso.
- **El estado silencioso enviado al tema `-estado` del móvil** (guía 15). Nunca genera una notificación y, mientras los avisos del móvil están activados y escribes desde fuera, se envía tras cada turno sea cual sea el modo.

Cuando el modo está activado, el comando `/narsil` sin argumentos añade una línea a su informe: "Modo discreto activado: sin voz, sin avisos de fin de turno ni consejos o pasos automáticos."

## Constrúyelo con Claude

Pídele a Claude una única preferencia guardada que baje todos los ruidos que hace el mod. La idea que debe acertar es dónde cae la línea: un turno terminado puede esperar, pero una pregunta o un error siguen pasando, sin la voz.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil.

> Mi mod de Claude Code `my-pet` habla, avisa al final de cada turno y muestra consejos. Añade un modo discreto: `/my-pet quiet` y `/my-pet normal` fijan un booleano `isQuiet` en las preferencias, guardado con `$.store.set` y cargado en `session.start`. En la función que envía todos los avisos, que recibe un tipo (`done`, `question`, `error`), vuelve antes de tiempo para `done` en modo discreto salvo que el aviso sea una prueba forzada, y no hables nunca en modo discreto; las preguntas y los errores se siguen mostrando. Omite también los consejos automáticos en modo discreto, pero conserva los consejos que pida la persona. Deja la banda como está. Añade tests con `claude-code/testing`: en modo discreto un turno terminado no genera notificación ni voz, y una llamada a `AskUserQuestion` sigue notificando.

### Qué revisar en la respuesta de Claude

1. `/my-pet quiet` y `/my-pet normal` cambian solo `isQuiet`, y la preferencia se guarda con `$.store.set` y se carga en `session.start`, así que dura entre sesiones.
2. En la función que envía todos los avisos, un aviso `done` vuelve antes de tiempo en modo discreto salvo que sea la prueba forzada, y una `question` o un `error` se siguen mostrando.
3. La voz se omite en modo discreto para todos los tipos de aviso.
4. Los consejos automáticos se omiten en modo discreto, pero un consejo que pide la persona sigue respondiendo.
5. La banda se dibuja como antes: el modo discreto detiene las interrupciones, no la información.

Si una comprobación falla, dile a Claude lo que ves: "en modo discreto un diálogo de permiso espera y nada me avisa".

### Cómo lo pidió el autor

La petición original del modo discreto no quedó registrada. Los registros de tareas públicos del proyecto no lo cubren.

#### Reconstrucción a partir del historial de commits

A partir de `git log -S isQuiet -- hooks/register.tsx` en narsil-pet:

- `17ffb30` (2026-10-31) "feat: add a quiet mode that only speaks up when Narsil needs you" (añadir un modo discreto que solo habla cuando Narsil te necesita). Un único commit añade todo el modo: el campo `isQuiet`, la salida temprana en `announce`, las comprobaciones en los consejos, los próximos pasos y el resumen en reposo, las palabras `discreto` y `normal`, la línea en el informe del comando sin argumentos, una sección del README y un test. Su asunto es el diseño en una frase.
- `665bd4e` (2026-11-06) "feat: speak when work starts and vary every spoken phrase" (hablar cuando empieza el trabajo y variar cada frase hablada). La voz al empezar el trabajo es nueva aquí, y lee `isQuiet` desde el primer día. Este es el patrón en acción: un nuevo ruido se suma al modo discreto cuando se añade.

El modo llegó al final de la primera semana, cuando la voz, los avisos, los consejos y los próximos pasos ya existían. Ese orden encaja con un camino habitual: un mod gana funcionalidades una a una, y solo cuando se acumulan necesita un único interruptor para bajarlas.

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Escrito para esta guía y comprobado con los tipos de 2.1.325 (`$.store.get`, `$.store.set`, `$.command.register`, `command.run`, `$.ui.notify`, `session.start`, `turn.complete`, `tool.call`). Está adaptado de `hooks/register.tsx` en [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). El átomo `prefs` se declara en `types/index.d.ts` como `{ isQuiet: boolean }`. La función vacía `speak` es donde va tu propia voz, como la de la guía 6.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

type Kind = 'done' | 'question' | 'error'
const prefs = atom({ plugin: 'my-pet', key: 'prefs' } as const, { isQuiet: false })

async function speak($: EngineInterface, text: string): Promise<void> {
  // your own voice goes here (guide 6)
}

async function announce(
  $: EngineInterface,
  kind: Kind,
  title: string,
  text: string,
  force = false,
) {
  const { isQuiet } = await read($, prefs)
  // What you can safely miss stays quiet; what blocks the work never does.
  if (isQuiet && kind === 'done' && !force) return
  const spoken = isQuiet ? Promise.resolve() : speak($, text)
  try {
    await $.ui.notify(text, { title })
  } catch {
    // no notification channel on this surface
  }
  await spoken
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'my-pet', description: 'My pet: quiet | normal | test' })
    const saved = await $.store.get('prefs').catch(() => undefined)
    if (saved && typeof saved === 'object') await update($, prefs, (p) => ({ ...p, ...saved }))
    return next(e)
  })

  on('command.run', { command: 'my-pet' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'test') {
      await announce($, 'done', 'Test', 'This is how I will tell you.', true)
      return { text: 'My pet: test alert sent.' }
    }
    if (arg !== 'quiet' && arg !== 'normal') return { text: 'Usage: /my-pet quiet | normal | test' }
    const saved = await update($, prefs, (p) => ({ ...p, isQuiet: arg === 'quiet' }))
    await $.store.set('prefs', saved).catch(() => undefined)
    return {
      text: saved.isQuiet
        ? 'My pet: quiet. I only tell you when I need you.'
        : 'My pet: back to normal.',
    }
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId === undefined && e.tool === 'AskUserQuestion')
      await announce($, 'question', 'I need you', 'I have a question for you.')
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    if (e.reason === 'answer') await announce($, 'done', 'Done', 'I have finished.')
    else if (e.reason !== 'aborted')
      await announce($, 'error', 'I stopped', 'The turn ended with an error.')
    return result
  })
}
```

`update` devuelve el nuevo valor, así que el comando guarda exactamente lo que escribió. El `try` alrededor de `$.ui.notify` sigue un comentario de la función `notify` de Narsil: donde el host no tiene notify en absoluto, "the call throws before it returns a promise" (la llamada lanza una excepción antes de devolver una promesa), así que un `.catch` no la atraparía.

## Errores comunes y cómo probarlo

- **Silenciarlo todo.** Un modo discreto que también detiene las preguntas y los errores deja a Claude esperando un permiso que nadie ve. Decide por tipo de aviso, según si perdértelo bloquea el trabajo.
- **Una marca en un solo sitio.** Si solo la función de avisos lee la marca, todos los ruidos que se añadan después la ignoran. Narsil lee `isQuiet` en cada sitio que hace ruido, y añade la comprobación cuando añade el ruido.
- **Dejar que el modo discreto detenga la prueba.** Sin `force`, `/narsil prueba` no haría nada en modo discreto, y la persona pensaría que los avisos están rotos.
- **Acoplar interruptores.** `normal` debería deshacer solo `discreto`. Si también volviera a activar la voz, una persona que silenció a Narsil antes la volvería a oír.
- **Olvidar guardarlo.** Una preferencia guardada solo en un átomo desaparece con la siguiente sesión.

Para probarlo, `tests/narsil.test.tsx` tiene dos tests para ello. "/narsil discreto keeps her quiet, and /narsil normal brings everything back" (/narsil discreto la mantiene en silencio, y /narsil normal lo devuelve todo) se ejecuta en un macOS simulado sin la ventana flotante, registra los scripts que se arrancan para la voz y las notificaciones, termina un turno y deja pasar once minutos: no se dice nada, no arranca ninguna notificación, no se pregunta a ningún modelo; después, una llamada a `AskUserQuestion` genera exactamente una notificación titulada "Narsil · Te necesito". "in quiet mode the phone gets only what needs you" (en modo discreto el móvil recibe solo lo que te necesita) comprueba la misma regla en el móvil: tras un turno terminado y una pregunta, solo se publica la pregunta.

## Para ir más lejos

- `announce` en `hooks/register.tsx` es la función que hay que leer para saber adónde va cada aviso; la guía de voz y avisos la recorre.
- El comando `/narsil` sin argumentos imprime todas las preferencias a la vez, incluida esta. La última guía de la ruta, sobre los comandos, muestra cómo está construido.
- La siguiente guía envía los mismos avisos a tu móvil y tu reloj, bajo la misma regla del modo discreto.
