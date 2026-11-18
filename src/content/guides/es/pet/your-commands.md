---
title: Tus propios /comandos
description: 'Cómo /narsil se registra como un único comando de barra con muchos subcomandos, cómo se reparten sus palabras, cómo el comando sin argumentos sirve también de ayuda y cómo probarlo.'
route: pet
order: 17
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: docs/plan-advice.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Qué hace

Cada funcionalidad de esta ruta tiene un interruptor o una pregunta, y todos viven bajo un único comando de barra: `/narsil`. Escribes `/narsil` y una palabra, y Narsil responde en la transcripción. Escrito solo, `/narsil` te dice cómo está configurada y lista todas las palabras que acepta.

Las palabras, tal como las reparte el código (Narsil habla español, así que las palabras están en español):

| Comando                                                             | Lo que hace                                                                              |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `/narsil`                                                           | Muestra la configuración actual y la línea de uso.                                       |
| `/narsil estado`                                                    | Dice qué está haciendo, cuántas conversaciones hay abiertas y en qué superficies dibuja. |
| `/narsil ocultar` · `mostrar`                                       | Oculta o muestra la banda.                                                               |
| `/narsil silencio` · `voz`                                          | Apaga o enciende la voz.                                                                 |
| `/narsil discreto` · `normal`                                       | Activa o desactiva el modo discreto (guía 14).                                           |
| `/narsil flotante`                                                  | Activa o desactiva la ventana flotante (guía 5).                                         |
| `/narsil prueba`                                                    | Envía un aviso de prueba, con voz.                                                       |
| `/narsil consejo` · `consejo profundo`                              | Pide un consejo ahora, o uno sobre toda la conversación (guía 11).                       |
| `/narsil consejos on` · `off` · `cada <min>` · `voz`                | Consejos automáticos activados o desactivados, su espaciado, en voz alta o no.           |
| `/narsil pasos on` · `off`                                          | Próximos pasos activados o desactivados (guía 12).                                       |
| `/narsil cache` · `cache <min>` · `cache auto`                      | Dice, fija o deduce cuánto dura la caché del prompt (guía 8).                            |
| `/narsil resumen`                                                   | El resumen de la sesión (guía 16).                                                       |
| `/narsil nivel`                                                     | Nivel, etapa y cómo gana XP (guía 13).                                                   |
| `/narsil movil` · `on` · `off` · `nuevo` · `prueba` · `clave [off]` | Avisos en el móvil (guía 15).                                                            |

La tabla "Comandos" del README lista las mismas palabras, y coinciden con el código.

Un comando en lugar de quince mantiene limpio el autocompletado: escribes `/nar`, y todo lo que Narsil puede hacer está detrás de un solo nombre.

## Cómo funciona por dentro

### Registrar: `$.command.register`

Un mod declara un comando de barra en tiempo de ejecución. Narsil lo hace lo primero en `session.start`:

```tsx
await $.command.register({
  name: 'narsil',
  description:
    'Narsil, tu mascota: estado | ocultar | mostrar | silencio | voz | discreto | normal | flotante | prueba | consejo [profundo] | consejos on|off|cada <min>|voz | pasos on|off | cache [auto|<min>] | resumen | nivel | movil [on|off|nuevo|prueba|clave [off]]',
})
```

Los tipos de 2.1.325 describen `$.command.register` como "Declares the slash command `/<name>` for this session, listed in the typeahead from the next keystroke on" (declara el comando de barra `/<name>` para esta sesión, listado en el autocompletado a partir de la siguiente pulsación). Tres puntos de esa frase dan forma al diseño:

- **"for this session" (para esta sesión).** El registro no sobrevive a la sesión, y por eso se hace en cada `session.start`.
- **La especificación.** `CommandSpec` tiene `name` (letras, dígitos, `_` y `-`, hasta 64), `description` ("The one line the typeahead and `/help` show for it", la única línea que muestran para él el autocompletado y `/help`), un `argumentHint` opcional ("The hint drawn dim after the name", la pista dibujada atenuada después del nombre) y un `immediate` opcional. "Registering a name again replaces it; a built-in's name is refused." (registrar de nuevo un nombre lo sustituye; el nombre de uno integrado se rechaza).
- **Servirlo.** "Serve it with a `command.run` hook on `{ command: "<name>" }` that returns `{ text }`" (sírvelo con un hook `command.run` sobre `{ command: "<name>" }` que devuelva `{ text }`).

Narsil pone la lista de palabras en `description`, así que el autocompletado y `/help` las muestran todas (la descripción empieza por "Narsil, tu mascota"). No usa `argumentHint`; una pista corta como `[estado | resumen | …]` sería la alternativa, a costa de mostrar menos.

Tampoco fija `immediate`. Sin él, dicen los tipos, un comando escrito mientras hay un turno en curso espera "for the turn to end" (a que el turno termine). Por eso `/narsil discreto` escrito a mitad de un turno tiene efecto después del turno. Con `immediate`, el hook "must not assume the turn's state" (no debe dar por supuesto el estado del turno), lo que es mucho pedir a un manejador que lee y escribe tanto de él.

### Servir: un único hook `command.run`

El hook se registra con un filtro, así que solo se ejecuta para `/narsil`:

```tsx
on('command.run', { command: 'narsil' }, async ($, e) => {
  await noteOrigin($, e.origin)
  const arg = e.args.trim().toLowerCase().replace(/\s+/g, ' ')
  // …
})
```

Nunca llama a `next`. Los tipos explican lo que eso significa: "A hook's own answer without `next` runs no command: its `text` is shown as the command's output" (la respuesta propia de un hook sin `next` no ejecuta ningún comando: su `text` se muestra como la salida del comando). Como nada más implementa `/narsil`, no hay nada a lo que pasarlo.

Antes de leer ninguna palabra pasan tres cosas:

- **`noteOrigin($, e.origin)`.** El `origin` de un comando dice de dónde vino, igual que el de `prompt.submit`. Ejecutar `/narsil` desde el móvil cuenta como escribir desde fuera (guía 15).
- **Normalizar las palabras.** `e.args` es "Everything after the name, as typed" (todo lo que va después del nombre, tal como se escribió). Narsil le quita los espacios de los extremos, lo pasa a minúsculas y junta los espacios repetidos, así que `/narsil  Consejos   OFF` funciona.
- **Las tildes.** El grupo del móvil acepta `movil` y `móvil`, y el patrón de la caché, `/^cach[eé](?: (auto|\d{1,3}))?$/`, acepta `cache` y `caché`. La gente escribe las dos.

### Repartir: grupos que responden "no es mío"

El cuerpo es una cadena. Los tres grupos más grandes viven cada uno junto a su funcionalidad, como funciones que devuelven el texto de la respuesta, o `undefined` para las palabras que no son suyas:

```tsx
const advice = await adviceCommand($, arg)
if (advice !== undefined) return { text: advice }
const stepped = await stepsCommand($, arg)
if (stepped !== undefined) return { text: stepped }
const phoned = await phoneCommand($, arg)
if (phoned !== undefined) return { text: phoned }
```

- `adviceCommand` acepta `consejo`, `consejo profundo` y `consejos …`.
- `stepsCommand` acepta `pasos on|off` y `cache [auto|<min>]`.
- `phoneCommand` acepta `movil …`.

Un grupo que reconoce su primera palabra pero no el resto responde con su propia línea de uso en lugar de `undefined`: `/narsil consejo raro` recibe "Uso: /narsil consejo [profundo] | consejos on | off | cada <min> | voz", y `/narsil movil raro` recibe "Uso: /narsil movil [on | off | nuevo | prueba | clave [off]]". La persona ve las palabras que encajan con lo que intentaba hacer, no la lista entera.

Después, el manejador principal se encarga del resto por sí mismo: `resumen` y `nivel` responden enseguida; `prueba`, `estado` y `flotante` tienen cada una una rama; y seis palabras de activar y desactivar comparten una tabla, `change`, que asigna a cada palabra un parche de las preferencias (`ocultar` a `{ isHidden: true }`, `discreto` a `{ isQuiet: true }`, y así sucesivamente). Una palabra conocida se fusiona en el átomo `prefs` y se guarda con `$.store.set('prefs', …)`, así que cada ajuste sobrevive a la sesión.

El diseño mantiene las palabras de cada funcionalidad junto a la funcionalidad. Añadir un grupo de comandos a una funcionalidad supone una función en su propia sección y una línea en la cadena.

### El comando sin argumentos es la ayuda

Todo lo que la cadena no reconoce, incluido `/narsil` vacío, cae al final, donde `patch` es undefined. Esa rama lee las preferencias y las imprime: si la banda está visible, la voz encendida, la ventana flotante activada; los consejos y su espaciado; los próximos pasos y cuánto dura la caché; una línea para el modo discreto cuando está activado. La última línea es la línea de uso, la misma lista de palabras que la descripción.

Así que no hay una palabra `ayuda` aparte: una errata y un `/narsil` a secas responden los dos con el estado y las palabras. Esto coincide con el README, cuya primera fila dice que `/narsil` "Muestra la configuración actual y la ayuda".

La lista de palabras vive en tres sitios: la descripción, la línea de uso y el README. El plan de los consejos, `docs/plan-advice.md`, lo dice abiertamente cuando añade las palabras `consejo`: "Update the command description and the usage text of `/narsil`." (actualiza la descripción del comando y el texto de uso de `/narsil`). Mantener los tres al día es una tarea manual en Narsil.

### Qué es la respuesta

Cada rama devuelve `{ text }`, un `CommandRunResult`. Dos de sus campos merecen conocerse aunque Narsil no los use. `context` es "What the model reads after the command's output and the person never sees" (lo que el modelo lee después de la salida del comando y la persona nunca ve). `isTextDisplayOnly` deja el texto fuera de las peticiones del modelo, pero los tipos dicen que solo se respeta cuando todos los plugins que enganchan el comando vienen incluidos con Claude Code: "Any other plugin's text stays in requests" (el texto de cualquier otro plugin se queda en las peticiones). Así que todo lo que responde `/narsil`, incluida la clave del móvil de la guía 15, forma parte de lo que lee el modelo.

## Constrúyelo con Claude

Pídele a Claude un único comando de barra con subcomandos, registrado cuando empieza la sesión y servido por un único hook. La idea que Claude debe acertar es el reparto: cada funcionalidad responde a sus propias palabras y devuelve `undefined` para el resto, y lo que sobra imprime la configuración y la línea de uso.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil.

> Dale a mi mod de Claude Code `my-pet` un único comando de barra, `/my-pet`, con subcomandos. En `session.start`, llama a `$.command.register` con el nombre y una descripción que liste todos los subcomandos. Sírvelo con un único hook `command.run` filtrado por `{ command: 'my-pet' }` que devuelva `{ text }` sin llamar a `next`. Normaliza `e.args` (quitar espacios de los extremos, minúsculas, espacios simples). Dale a cada funcionalidad su propia función que devuelva la respuesta para sus palabras, su propia línea de uso para una primera palabra conocida con un resto desconocido, o `undefined` para las palabras que no son suyas, y encadénalas. Asigna las palabras simples de activar y desactivar a un parche de un átomo `prefs` guardado con `$.store.set`. Para un argumento vacío o desconocido, imprime la configuración actual y la línea de uso. Mantén al día la descripción, la línea de uso y el README. Prueba con `claude-code/testing`, llamando a `$.command.run({ command: 'my-pet', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } })`, que cada palabra responde y que una palabra desconocida imprime la línea de uso.

### Qué revisar en la respuesta de Claude

1. `$.command.register` se ejecuta en `session.start`, en cada sesión, porque un registro dura solo lo que dura la sesión.
2. El hook `command.run` se filtra por el nombre del comando, devuelve `{ text }` y nunca llama a `next`.
3. A `e.args` se le quitan los espacios de los extremos, se pasa a minúsculas y se reducen sus espacios repetidos antes de comparar ninguna palabra.
4. La función de cada funcionalidad devuelve su respuesta, su propia línea de uso para una primera palabra conocida con un resto desconocido, o `undefined`; un argumento vacío o desconocido imprime la configuración y la línea de uso.
5. La descripción y la línea de uso listan las mismas palabras, idealmente a partir de una única constante.

Si una comprobación falla, dile a Claude lo que ves: "`/my-pet  Tips OFF`, con espacios de más y mayúsculas, responde con la línea de uso en lugar de desactivar los consejos".

### Cómo lo pidió el autor

La petición original de `/narsil` no quedó registrada. Lo que sí está registrado es un paso de un plan: en `docs/plan-advice.md`, bajo los comandos que añaden los consejos, el plan dice:

> "Update the command description and the usage text of `/narsil`."

(Actualiza la descripción del comando y el texto de uso de `/narsil`.)

Esas son las palabras del plan, no la petición de quien creó Narsil.

#### Reconstrucción a partir del historial de commits

A partir de `git log -G "Narsil, tu mascota" -- hooks/register.tsx`, que encuentra todos los commits que cambiaron la descripción registrada:

- `b1187f3` (2026-10-30) "feat: show Narsil above the prompt with clear states and /narsil" (mostrar a Narsil encima del prompt con estados claros y /narsil). El comando nace con la banda, y su primera descripción dice "Narsil, tu mascota: estado | ocultar | mostrar | silencio | voz | flotante | prueba".
- `467a64b` (2026-10-30) "feat(advice): give short, concrete tips about the work in progress" (dar consejos cortos y concretos sobre el trabajo en curso). Las palabras `consejo`.
- `0993bd7` (2026-10-30) "feat: show a prompt-cache clock and offer next steps after a turn" (mostrar un reloj de la caché del prompt y ofrecer próximos pasos tras un turno). `pasos` y `cache`.
- `f7a494e` (2026-10-30) "feat: warn about loops, insist on waiting permissions and sum the session up" (avisar de los bucles, insistir con los permisos que esperan y resumir la sesión). `resumen`.
- `8913cdd` (2026-10-30) "feat: let Narsil earn experience and levels kept across sessions" (dejar que Narsil gane experiencia y niveles que se conservan entre sesiones). `nivel`.
- `17ffb30` (2026-10-31) "feat: add a quiet mode that only speaks up when Narsil needs you" (añadir un modo discreto que solo habla cuando Narsil te necesita). `discreto` y `normal`.
- `d91997f` (2026-10-31) "feat: send what needs you to your phone and watch through ntfy, with Narsil's picture" (enviar lo que te necesita a tu móvil y tu reloj mediante ntfy, con el dibujo de Narsil). `movil`.
- `5a9ee10` (2026-11-01) "feat: seal phone messages with /narsil movil clave, send reset times and an Abrir Claude button" (sellar los mensajes del móvil con /narsil movil clave, enviar las horas de reinicio y un botón Abrir Claude). `clave`.

El comando creció palabra a palabra, cada una con la funcionalidad que controla, y cada commit tocó la descripción en el mismo cambio. Ese es el hábito que pide el plan.

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Escrito para esta guía y comprobado con los tipos de 2.1.325 (`$.command.register`, `command.run`, `$.store.get`, `$.store.set`, `session.start`). Está adaptado de `hooks/register.tsx` en [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). El átomo `prefs` se declara en `types/index.d.ts` como `{ isHidden: boolean; isMuted: boolean }`.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const WORDS = 'status | hide | show | mute | voice | tips on|off'
const prefs = atom({ plugin: 'my-pet', key: 'prefs' } as const, { isHidden: false, isMuted: false })

// One feature's words: its answer, its own usage line, or undefined when the words are not its own.
async function tipsCommand($: EngineInterface, arg: string): Promise<string | undefined> {
  if (arg === 'tips on' || arg === 'tips off')
    return `My pet: tips ${arg === 'tips on' ? 'on' : 'off'}.`
  if (arg.startsWith('tips')) return 'Usage: /my-pet tips on | off'
  return undefined
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    // Registered for this session only: every session registers it again.
    await $.command.register({ name: 'my-pet', description: `My pet: ${WORDS}` })
    const saved = await $.store.get('prefs').catch(() => undefined)
    if (saved && typeof saved === 'object') await update($, prefs, (p) => ({ ...p, ...saved }))
    return next(e)
  })

  on('command.run', { command: 'my-pet' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase().replace(/\s+/g, ' ')
    const tips = await tipsCommand($, arg)
    if (tips !== undefined) return { text: tips }

    const change: Record<string, { isHidden?: boolean; isMuted?: boolean }> = {
      hide: { isHidden: true },
      show: { isHidden: false },
      mute: { isMuted: true },
      voice: { isMuted: false },
    }
    const patch = arg === 'status' ? undefined : change[arg]
    if (!patch) {
      // The bare command, a typo and "status" all answer with the state and the words.
      const p = await read($, prefs)
      return {
        text: `My pet is ${p.isHidden ? 'hidden' : 'visible'}, with the voice ${p.isMuted ? 'off' : 'on'}.\nUsage: /my-pet ${WORDS}`,
      }
    }
    const saved = await update($, prefs, (p) => ({ ...p, ...patch }))
    await $.store.set('prefs', saved).catch(() => undefined)
    return { text: `My pet: done (${arg}).` }
  })
}
```

`WORDS` se escribe una vez y se usa tanto para la descripción como para la línea de uso, lo que elimina uno de los tres sitios que Narsil mantiene al día a mano. El README sigue siendo cosa tuya.

## Errores comunes y cómo probarlo

- **Registrar una sola vez.** Un registro dura lo que la sesión. Registra en `session.start`, cada vez.
- **Un nombre que ya está ocupado.** "a built-in's name is refused" (el nombre de uno integrado se rechaza). Elige un nombre que sea claramente de tu mod.
- **Llamar a `next` desde tu propio comando.** No hay ningún comando detrás del tuyo que ejecutar; responde con `{ text }`.
- **Comparar exactamente con la entrada sin procesar.** La gente escribe espacios de más, mayúsculas y tildes. Normaliza primero, y acepta las formas con tilde que esperas.
- **Una cadena de `if` gigante.** Funciona, pero las palabras de cada funcionalidad acaban lejos de la funcionalidad. Deja que cada funcionalidad sea dueña de sus palabras y devuelva `undefined` para el resto.
- **Una ayuda que se desfasa.** La descripción, la línea de uso y el README deben decir lo mismo. Construye las dos primeras a partir de una constante si puedes.
- **Secretos en las respuestas.** El texto de un comando se queda en las peticiones del modelo. Imprime un secreto solo cuando la persona deba copiarlo, y dilo.

Para probarlo, `claude plugin test .` ejecuta `tests/narsil.test.tsx`, donde los comandos se ejecutan mediante `$.command.run({ command: 'narsil', args: 'nivel', ...TYPED })`. `TYPED` es `{ origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } }`: un comando escrito en el escritorio. `BY_PHONE` cambia el origen por `{ kind: 'bridge' }` para ejecutar uno desde Remote Control. Tests que vale la pena leer por su nombre: "/narsil estado tells which surfaces asked to draw the band, and which never did" (/narsil estado dice qué superficies pidieron dibujar la banda, y cuáles nunca lo hicieron), "/narsil discreto keeps her quiet, and /narsil normal brings everything back" (/narsil discreto la mantiene en silencio, y /narsil normal lo devuelve todo), "/narsil consejos off stops automatic tips, and /narsil consejo still answers" (/narsil consejos off detiene los consejos automáticos, y /narsil consejo sigue respondiendo) y "/narsil movil nuevo changes the topic, and /narsil movil prueba sends one" (/narsil movil nuevo cambia el tema, y /narsil movil prueba envía uno).

### Dónde difieren el código y el README

Coinciden en todas las palabras. Hay un pequeño desliz en el código: la línea de uso de la rama final se escribe `'Uso:/narsil estado | …'`, sin el espacio después de los dos puntos que tienen las líneas de uso de los subgrupos. Viene de `17ffb30`; antes de él, la línea decía `'Uso: /narsil …'`.

## Para ir más lejos

- `phoneCommand` en `hooks/register.tsx` es el más claro de los grupos para copiar: separa la primera palabra del resto, guarda mediante una pequeña función auxiliar `save` y termina con su propia línea de uso.
- `stepsCommand` muestra una palabra con un número opcional, analizado con una sola expresión regular y acotado (`Math.min(1440, Math.max(1, …))`).
- `$.command.list()` devuelve todos los comandos de barra que la persona puede ejecutar, y `$.command.run` ejecuta uno como si se hubiera escrito; los dos están en los tipos de 2.1.325.

Esta es la última guía de la ruta "Tu propia mascota de estado". Su índice lista las diecisiete guías, desde los estados de un vistazo hasta estos comandos, por si quieres volver a cualquier funcionalidad. Para la base sobre la que se apoya cada guía, las guías de "Fundamentos de mods" cubren de qué está hecho un mod, el objeto `$`, cómo instalar, recargar, validar y probar un mod, las superficies en las que se ejecuta y lo que significa la GPL v3 de Narsil cuando reutilizas su código.
