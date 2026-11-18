---
title: Consejos con Haiku
description: 'Cómo Narsil pide a Haiku un consejo corto sobre el trabajo en curso: qué contexto envía, el prompt exacto, cada cuánto habla, el modo profundo y la ventana del consejo.'
route: pet
order: 11
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/advice.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: overlay/tip.ps1
  - repo: pet
    path: overlay/tip.sh
  - repo: pet
    path: overlay/tip.js
  - repo: pet
    path: docs/plan-advice.md
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Qué hace

De vez en cuando, Narsil te da un consejo sobre lo que estás haciendo: dos o tres frases, en español, sobre algo concreto que acaba de pasar. Se lo pide a un modelo pequeño, Haiku, con un resumen corto del trabajo.

Hay tres momentos automáticos y dos a petición:

- **Terminó un turno.** El consejo lee lo que cambió el turno y comenta una decisión de diseño: por qué se hizo así, cuál era la alternativa, qué gana o pierde cada una. Los consejos rutinarios ("ejecuta los tests", "revisa el push") quedan descartados a propósito.
- **Una herramienta falló varias veces.** La misma herramienta dos veces en un turno, o tres fallos de cualquier tipo. El consejo trata de depuración.
- **Un turno lleva más de 3 minutos**, comprobado en cada llamada a una herramienta. El consejo trata del ritmo, o de dividir la tarea.
- **`/narsil consejo`** pide uno ahora, como el consejo de final de turno.
- **`/narsil consejo profundo`** se lo pide al propio modelo de la sesión, sobre toda la conversación.

Los consejos automáticos se espacian: como mucho uno cada 30 minutos por defecto (`/narsil consejos cada <min>` lo cambia), el doble cuando el mismo tipo llega dos veces seguidas, y como mucho 20 al día. Un consejo que pides nunca se retiene. `/narsil consejos off` detiene los automáticos, `/narsil consejos voz` lee en voz alta los consejos de final de turno, y el modo discreto (`/narsil discreto`) los detiene junto con la voz.

En Windows y macOS, cada consejo se abre entero en una pequeña ventana propia, con el dibujo de Narsil, que no roba el foco y se cierra sola al cabo de 3 minutos. En los demás sistemas se muestra en la banda, bajo el titular, en hasta tres líneas cortas con una "×" para descartarlo, y en la ventana flotante.

Un consejo nunca frena a Claude: se pide después, mientras lees la respuesta.

## Cómo funciona por dentro

### Lo que Narsil recuerda: `seen`

`hooks/advice.ts` guarda las partes que son valores simples (contexto, prompt, análisis de la respuesta); `hooks/register.tsx` se encarga de las llamadas. Lo que Narsil ha visto del trabajo es una variable del módulo, `seen`, que rellenan los hooks de las guías anteriores:

- `prompt.submit`: tu último mensaje, sus primeros 400 caracteres (no los mensajes que añade el propio motor, `e.isMeta`).
- `tool.call`: las últimas 15 llamadas, cada una con su herramienta y el detalle corto de la banda (el nombre de un archivo, la primera línea de un comando); los archivos editados o escritos en este turno, con cuántas veces; y los últimos 5 fallos, con los primeros 200 caracteres del error.
- `turn.complete`: la duración del turno y la respuesta final de Claude.
- Justo antes de pedir, `git`: lo que cambió el turno (abajo).

Las variables del módulo se pierden con una recarga del mod, y no pasa nada: el siguiente turno las vuelve a llenar. El plan dice lo mismo: "losing it on reload is harmless" (perderlo en una recarga es inofensivo).

### Lo que cambió: el diff

Para el consejo de final de turno y el que pides, `readDiff` ejecuta `git diff HEAD --stat --patch --unified=2` mediante `$.process.run`, con un tiempo límite de 5 segundos. Si el turno ya hizo commit de todo y no hay diff pendiente, lee en su lugar el último commit (`git show HEAD`). Fuera de un repositorio, o sin git, queda vacío y el consejo va sin él. Un consejo de depuración o de ritmo no lee el diff en absoluto: no le sirve.

La primera versión de los consejos no tenía diff: llegó en `d1e6d40`, junto con la regla contra las comprobaciones rutinarias. Con el diff, el modelo puede nombrar la función que cambió en lugar de adivinarla a partir de la lista de llamadas a herramientas.

### El contexto que lee el modelo

`describe(seen, kind)` convierte todo eso en líneas de texto, con el motivo primero. Un ejemplo sintético de contexto de final de turno, abreviado:

```text
Motivo: El turno acaba de terminar. Comenta una decisión de diseño de lo que se hizo: …
Último mensaje de la persona: añade reintentos a net.ts
Archivos editados en este turno: net.ts (2 veces), net.test.ts
Últimas herramientas usadas:
- Read: net.ts
- Edit: net.ts
- Bash: pnpm test
Duración del turno: 4 min
Respuesta final: Añadí retry() con tres intentos … Falta decidir el tiempo entre intentos.
Cambios (git):
 net.ts | 14 ++++++++++++--
 …
```

Las etiquetas están en español porque el modelo debe responder en español: el último mensaje, los archivos editados, los fallos recientes, las últimas herramientas, la duración, la respuesta final y los cambios. Cada parte tiene su propio límite: 1500 caracteres de la respuesta, conservados por los dos extremos (`ends`), porque una respuesta dice primero lo que hizo y al final lo que falta; 3000 caracteres del diff, cortados por líneas; 6000 para todo el contexto. Después se le aplica `sanitize` (abajo).

### El prompt exacto

El prompt de sistema es `SYSTEM` en `hooks/advice.ts`, citado aquí tal como está en [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). `ASKED_TIP` es 300.

```ts
export const SYSTEM = [
  'Eres Narsil, una vieja serpiente marina sabia que acompaña a quien programa.',
  'Das UN consejo sabio y concreto sobre el trabajo en curso, el que daría alguien con experiencia que revisa el trabajo.',
  'Reglas:',
  `- Escribe en español, en dos o tres frases, como mucho ${ASKED_TIP} caracteres.`,
  '- Sigue el motivo que se te da. Cuando trate del diseño, nombra la decisión concreta (una función, un archivo, un enfoque),',
  '  la alternativa y por qué una u otra; el diff de los cambios te dice qué se hizo.',
  '- Menciona algo concreto del contexto; nada de motivación genérica ni datos inventados.',
  '- Puedes usar como mucho una metáfora del mar.',
  '- Habla como Narsil, en femenino; no nombres a ningún asistente ni a "Claude".',
  '- El femenino es solo para ti: a la persona háblale de tú con lenguaje neutro, sin suponer su género',
  '  (nada de "juntas", "juntos", "listo" o "lista"; di "contigo", "cuando quieras").',
  '- No repitas ninguno de los consejos anteriores.',
  '- Si no hay nada útil que decir, responde exactamente SKIP.',
  'Responde solo con el consejo (o SKIP), sin comillas ni prefijos.',
].join('\n')
```

El mensaje de usuario lo construye `prompt(context, recent)`: "Contexto del trabajo:", el contexto, después "Consejos anteriores (no los repitas):" con los cinco últimos consejos, y "Tu consejo:" para cerrar.

El motivo que abre el contexto cambia según el tipo (`REASON` en `hooks/advice.ts`):

- **Final de turno:** "El turno acaba de terminar." seguido de la instrucción de diseño: comentar una decisión de diseño de lo que se hizo, por qué, qué alternativa había y qué gana o pierde cada una, o cómo mejorar esa funcionalidad. Después, "Nada de comprobaciones rutinarias (ejecutar los tests, revisar el push o el commit, mirar si el error ya no sale)."
- **Fallos:** "Una herramienta ha fallado varias veces: da un consejo para depurarlo."
- **Turno largo:** "El turno lleva mucho tiempo: da un consejo de ritmo o de dividir la tarea."

Vale la pena copiar tres decisiones de diseño de este prompt. `SKIP` permite al modelo quedarse en silencio, y el silencio es mejor que un consejo inútil. Los consejos anteriores en el mensaje evitan que el mismo consejo vuelva en cada turno. Y la prohibición de las comprobaciones rutinarias existe porque, sin ella, el consejo más barato siempre es "ejecuta los tests".

### Llamar a Haiku: `$.model.complete`

`askTip` lo envía:

```tsx
const reply = await $.model.complete({
  model: 'haiku',
  system: SYSTEM,
  prompt: prompt(describe(seen, kind), recentTips),
  effort: 'medium',
  maxTokens: 2000,
  timeoutMs: 30_000,
})
return reply.isAnswered ? parse(reply.text) : null
```

Los tipos de 2.1.325 describen `$.model.complete` como una única compleción de texto a través del propio cliente de API de la sesión: "No tools, no history, no system prompt beyond the CLI's identity block and `request.system`" (sin herramientas, sin historial, sin prompt de sistema más allá del bloque de identidad de la CLI y `request.system`). Así que Haiku solo ve lo que Narsil envía, nada de la conversación en sí. El resultado dice si respondió (`isAnswered`); si no, un `reason` (`api-error`, `empty-reply`, `aborted`). Narsil trata cualquiera de ellos, y cualquier excepción, como "sin consejo".

`parse` limpia la respuesta: quita las comillas que la rodean y un prefijo "consejo:", convierte cualquier "Claude" en "Narsil", no devuelve nada para `SKIP` o una respuesta vacía, y corta un consejo desbocado de más de 450 caracteres en su última frase completa. El prompt pide 300; el margen está porque el modelo a menudo escribe unos pocos más, y esos se muestran enteros.

### El modo profundo: `$.model.fork`

`/narsil consejo profundo` hace otra cosa. Llama a `$.model.fork({ prompt: forkPrompt(recentTips) })`, donde `forkPrompt` es el mismo `SYSTEM` seguido de "Mira esta conversación hasta aquí y da tu consejo sobre ella."

Los tipos describen un fork como una compleción sin herramientas "over the session's OWN transcript as the main thread last sent it" (sobre la PROPIA transcripción de la sesión tal como la envió por última vez el hilo principal): el modelo, el prompt de sistema, las herramientas y los mensajes del hilo principal, con este prompt después de ellos y todas las herramientas denegadas. El modelo lo ve todo, que es justamente la idea. Cuando todavía no hay conversación, el motivo del resultado es `nothing-to-fork`, y Narsil responde que aún no hay nada que mirar.

### Cuándo puede hablar: `mayTip`

Cada disparador automático llama a `tipLater($, kind)`, y cada tipo se intenta como mucho una vez por turno. Entonces `mayTip` decide:

1. Consejos desactivados, o el modo discreto: no.
2. Ya van 20 hoy: no. El día se cuenta como `Math.floor(now / 86_400_000)`, así que cambia a medianoche UTC, no a medianoche local.
3. Menos del intervalo desde el último consejo automático: no. El intervalo es `adviceEveryMinutes` (30 por defecto), el doble cuando este tipo es el mismo que el anterior.
4. Si no, sí, y el consejo cuenta, aunque el modelo responda después `SKIP`.

`tipLater` nunca se espera con await: `void autoTip($, kind).catch(() => undefined)`. El hook que lo disparó vuelve enseguida, así que un modelo lento nunca retiene el turno. El plan lo pedía así, y también pedía no usar temporizadores de `$.clock`, porque una recarga del mod los cancela.

### Dónde se muestra el consejo

`showTip` hace lo mismo con cada consejo:

1. Guarda el texto entre los cinco últimos, para el siguiente prompt.
2. En Windows y macOS abre la ventana del consejo. Si eso funcionó, la banda y la ventana flotante dejan fuera el consejo: ya está en pantalla, entero.
3. Si no, la banda lo dibuja con `tipLines`, partido en como mucho tres líneas (60 caracteres en el escritorio, el ancho de la banda en el terminal), con un botón "×". Sale de la banda al cabo de 3 minutos; la ventana flotante lo conserva 15, porque esa ventana se suele mirar más tarde.
4. Escribe una línea de registro, "💡" y el consejo, con `$.ui.log`.

La ventana del consejo no es código del mod: `launch` arranca un script con `$.process.run`, desacoplado, mediante `powershell.exe` en Windows y `/bin/sh` en macOS. En Windows, `overlay/tip.ps1` construye una pequeña ventana de Windows Forms que se muestra sin robar el foco, se queda encima, se abre sobre la ventana flotante cuando está en pantalla (si no, en una esquina de la pantalla donde está Claude), se cierra al cabo de `NARSIL_SECONDS` (180) y cierra cualquier consejo anterior. En macOS, `overlay/tip.sh` ejecuta `overlay/tip.js` con `osascript` (JavaScript for Automation): un panel flotante que nunca se activa, colocado sobre la ventana flotante (le pregunta al servidor local dónde está) o en la esquina de la pantalla donde está el ratón. Las dos tienen un botón que vuelve a la conversación mediante un enlace `claude://`, que comprueban contra un patrón estricto antes de abrirlo.

Un detalle de `tip.sh` importa a quien lo copie: "The tip and the rest travel in the environment, never inside the script, so nothing in them runs." (el consejo y lo demás viajan en el entorno, nunca dentro del script, así que nada de ello se ejecuta). El consejo es texto escrito por un modelo. Pegarlo en una línea de comandos permitiría que una comilla suelta lo convirtiera en código.

La sugerencia de `/compact` de la guía 7 y el resumen de la sesión de la guía 10 también pasan por `showTip`, aunque ningún modelo los escribe.

### Coste

Cada consejo es una petición al modelo en la cuenta de la persona. Los tipos dicen que un `$.model.complete` respondido "counts toward the session's cost total" (cuenta para el coste total de la sesión), visible en `/cost` con el `query_source` `plugin_model_complete`, y "Nothing caps it per call" (nada lo limita por llamada). El límite es el de Narsil: uno cada 30 minutos y 20 al día, lo que acota los consejos automáticos a veinte llamadas pequeñas a Haiku al día como mucho. Los consejos que pides no cuentan para ese límite. Los próximos pasos de la siguiente guía añaden como mucho una llamada más por turno terminado.

El modo profundo es de otra naturaleza. Ejecuta el modelo principal sobre toda la transcripción. Los tipos explican que la transcripción se sirve desde la caché del prompt mientras está caliente, y "billed afresh once the entry lapsed" (se cobra de nuevo cuando la entrada caducó): el reloj de la caché de la guía 8 te dice en qué caso estás. Por eso solo se ejecuta cuando lo pides.

### Privacidad

El contexto va al mismo proveedor que ya usa la sesión, a través del propio cliente de la sesión. Aun así, es tu código: tu último mensaje, nombres de archivos, texto de errores, la respuesta de Claude y hasta 3000 caracteres del diff.

`sanitize` se aplica a todo el contexto antes de enviarlo. Sustituye por "[oculto]" cualquier `name=value` o `name: value` cuyo nombre contenga key, token, secret o password, y cualquier secuencia de 32 o más caracteres base64 o hexadecimales. Es una heurística: un secreto con otra forma se cuela. Si un repositorio no debe resumirse a ningún modelo más allá de la conversación principal, desactiva los consejos y los próximos pasos (`/narsil consejos off`, `/narsil pasos off`).

### Plan y código

`docs/plan-advice.md` dice "Status: implemented" (estado: implementado), y casi todo lo está. Algunos números cambiaron después, y lo que se ejecuta es el código:

| Plan                                                                   | Código hoy                                                                 |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| como mucho 160 caracteres, una o dos frases                            | 300, dos o tres frases (`69647da`, `d1e6d40`)                              |
| `effort: 'low'`, `maxTokens` ~120, `timeoutMs` ~8000                   | `medium`, 2000, 30 000 (`d1e6d40`)                                         |
| contexto limitado a ~2000 caracteres, los primeros 400 de la respuesta | 6000, respuesta de 1500 por los dos extremos, más el diff (`d1e6d40`)      |
| un consejo automático cada 10 minutos                                  | cada 30 (`1216dc4`)                                                        |
| una línea en la banda, cortada al final                                | hasta tres líneas (`c564ab5`), o una ventana propia (`c98adac`, `a95e96a`) |
| consejo de final de turno: qué comprobar o hacer después               | una decisión de diseño, sin comprobaciones rutinarias (`d1e6d40`)          |

El patrón de saneado del plan también es más estrecho que el del código.

## Constrúyelo con Claude

Pídele a Claude un consejo corto de un modelo pequeño cuando termine un turno, construido a partir de un contexto que eliges campo por campo. La idea que Claude debe acertar es que el consejo llega después: el hook lo inicia sin esperarlo, y el propio mod limita cada cuánto se ejecuta.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil.

> En mi mod de Claude Code `my-pet`, da un consejo corto sobre el trabajo cuando termine un turno. Guarda un contexto pequeño en variables del módulo: el último prompt de `prompt.submit`, las últimas 15 llamadas a herramientas y los archivos editados de `tool.call`, y la respuesta final de `turn.complete`. Cuando un turno de la conversación principal termine con `reason === 'answer'`, sin esperarlo con await, lee `git diff HEAD --stat --patch` con `$.process.run` (tiempo límite de 5 s), construye un contexto de como mucho 6000 caracteres, quita todo lo que parezca un secreto, y llama a `$.model.complete` con `model: 'haiku'`, un prompt de sistema que pida un único consejo concreto de como mucho 300 caracteres sobre una decisión de diseño del diff, sin comprobaciones rutinarias, y la respuesta exacta `SKIP` cuando no haya nada útil. Pasa los cinco últimos consejos y pide que no se repitan. Permite como mucho un consejo cada 30 minutos y 20 al día. Muestra el consejo en la banda `AbovePrompt` con un botón "×" durante 3 minutos. Prueba con `on('model.complete', ...)` simulando el modelo: el prompt contiene el nombre del archivo editado, `SKIP` no muestra nada, y un valor `API_KEY=` nunca llega al prompt.

### Qué revisar en la respuesta de Claude

1. El hook `turn.complete` inicia el consejo con `void … .catch(...)` y vuelve en el acto; nunca espera a `$.model.complete`.
2. El prompt de sistema permite la respuesta exacta `SKIP`, y un `SKIP` o una respuesta vacía no muestran nada.
3. Cada parte del contexto tiene un límite (3000 caracteres de diff, 6000 en total), y todo el contexto se limpia antes de enviarlo, así que un valor `API_KEY=` nunca llega al prompt.
4. El mod comprueba su propio intervalo y su tope diario (un consejo cada 30 minutos, 20 al día) antes de llamar al modelo. Nada en el motor añade uno.
5. Los cinco últimos consejos van en el prompt, con la petición de no repetirlos.

Si una comprobación falla, dile a Claude lo que ves: "ahora cada turno termina unos segundos más tarde, y no puedo escribir hasta que llega el consejo".

### Cómo lo pidió el autor

Los consejos son la única funcionalidad de Narsil planificada en un documento público antes de escribir el código: `docs/plan-advice.md`, añadido en `dd7027a` (2026-10-30) "docs: plan tips about the work in progress" (planificar consejos sobre el trabajo en curso). Es un plan, no las palabras de quien creó Narsil; la petición que llevó a él no quedó registrada.

#### Lo que dice el plan

El objetivo del plan:

> "Narsil, the mod's sea-serpent mascot, occasionally offers a short, wise, concrete tip about the work in progress: what Claude just did, the error it hit, the change it made."

(Narsil, la mascota serpiente marina del mod, ofrece de vez en cuando un consejo corto, sabio y concreto sobre el trabajo en curso: lo que Claude acaba de hacer, el error con el que se topó, el cambio que hizo.)

Y su elección entre las dos formas de pedir a un modelo, tras una tabla que las compara:

> "Recommendation: automatic tips through `complete` with `haiku`; the transcript-aware `fork` only when the person asks for it."

(Recomendación: consejos automáticos mediante `complete` con `haiku`; el `fork` que conoce la transcripción, solo cuando la persona lo pide.)

Esa recomendación es lo que hace hoy el código.

#### Registrado: los consejos se quedan como están

Cuando quien creó Narsil rediseñó la banda para todas las conversaciones, la petición en `odd/tasks/fleet-view.md`, L1 (2026-11-06), terminaba con:

> "los consejos seguirian funcionando como ahora en cada ventana"

El registro de tareas lo recoge como S10, "Tips unchanged" (consejos sin cambios), y el diseño acordado en L4 pone "the tip and next steps of this window below" (el consejo y los próximos pasos de esta ventana debajo de) la lista.

#### Reconstrucción a partir del historial de commits

A partir de `git log -- hooks/advice.ts docs/plan-advice.md overlay/tip.js overlay/tip.ps1 overlay/tip.sh`, con los commits relacionados de `hooks/register.tsx`:

- `dd7027a` (2026-10-30) "docs: plan tips about the work in progress" (planificar consejos sobre el trabajo en curso).
- `467a64b` (2026-10-30) "feat(advice): give short, concrete tips about the work in progress" (dar consejos cortos y concretos sobre el trabajo en curso). La primera versión, siguiendo el plan.
- `e379f0e` (2026-10-30) "feat(advice): keep the tip in the floating window for 15 minutes" (mantener el consejo en la ventana flotante durante 15 minutos).
- `c564ab5` (2026-10-30) "fix(band): break long tips into short lines" (partir los consejos largos en líneas cortas).
- `71383d6` (2026-10-30) "fix(texts): agree state counts in number and keep advice gender-neutral toward the person" (concordar en número los recuentos de estados y mantener los consejos neutros en género hacia la persona). La regla del prompt sobre que el femenino es solo de Narsil.
- `c98adac` (2026-10-31) "feat: open tips whole in their own window on Windows and give the band more room" (abrir los consejos enteros en su propia ventana en Windows y dar más espacio a la banda), después `a95e96a` (2026-10-31) "feat: open tips whole in their own window on macOS too" (abrir los consejos enteros en su propia ventana también en macOS).
- `69647da` (2026-11-01) "fix: show tips whole up to 320 characters, cutting a runaway one at its last sentence" (mostrar los consejos enteros hasta 320 caracteres, cortando uno desbocado en su última frase).
- `d1e6d40` (2026-11-04) "feat: make tips weigh design choices from the diff and next steps say what the project lacks" (hacer que los consejos sopesen decisiones de diseño a partir del diff y que los próximos pasos digan lo que le falta al proyecto). La corrección más grande: su mensaje dice que el consejo de final de turno "now reads the uncommitted diff (or the last commit) and comments on a design decision, an alternative and its tradeoff, instead of routine checks" (ahora lee el diff sin commit, o el último commit, y comenta una decisión de diseño, una alternativa y su compromiso, en lugar de comprobaciones rutinarias), con Haiku en esfuerzo medio y límites más largos.
- `1216dc4` (2026-11-04) "feat: space automatic tips to one every 30 minutes by default" (espaciar los consejos automáticos a uno cada 30 minutos por defecto). Las preferencias guardadas que aún tenían el antiguo valor por defecto de 10 pasan a 30 una vez.

El patrón: un plan, una primera versión fiel, y después correcciones cada vez que los consejos resultaron demasiado cortos, demasiado frecuentes o demasiado genéricos.

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Escrito para esta guía y comprobado con los tipos de 2.1.325 (`$.model.complete`, `$.process.run`, `$.clock.now`, `$.ui.log`, `prompt.submit`, `turn.complete`, `ui.render`). Está adaptado de `hooks/advice.ts` y `hooks/register.tsx` en [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). El átomo `tip` se declara en `types/index.d.ts` como en la primera guía, con el tipo `{ text: string; at: number } | null`.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const tip = atom({ plugin: 'my-pet', key: 'tip' } as const, null)
const SYSTEM = [
  'You give ONE concrete tip, at most 300 characters, about the work in progress.',
  'Comment on one design decision visible in the diff: the alternative and its tradeoff.',
  'No routine checks (running the tests, checking the push). Nothing invented.',
  'If there is nothing useful to say, answer exactly SKIP.',
].join('\n')
const EVERY_MS = 30 * 60_000
const SHOWN_MS = 3 * 60_000

let lastPrompt = ''
let lastTipAt: number | null = null
const recent: string[] = []

const sanitize = (text: string) =>
  text
    .replace(
      /[^\s"'`]*(key|token|secret|password)[^\s"'`]*\s*[:=]\s*("[^"]*"|'[^']*'|\S+)/gi,
      '[hidden]',
    )
    .replace(/[A-Za-z0-9+/_-]{32,}={0,2}/g, '[hidden]')

async function diff($: EngineInterface): Promise<string> {
  try {
    const r = await $.process.run(['git', '--no-pager', 'diff', 'HEAD', '--stat', '--patch'], {
      timeoutMs: 5000,
    })
    return r.exitCode === 0 ? r.stdout.slice(0, 3000) : ''
  } catch {
    return ''
  }
}

async function autoTip($: EngineInterface, answer: string): Promise<void> {
  const now = await $.clock.now()
  if (lastTipAt !== null && now - lastTipAt < EVERY_MS) return
  lastTipAt = now
  const context = sanitize(
    `Last message: ${lastPrompt}\nFinal answer: ${answer.slice(0, 1500)}\nChanges:\n${await diff($)}`,
  ).slice(0, 6000)
  const before = recent.length
    ? `\n\nEarlier tips (do not repeat):\n${recent.map((t) => `- ${t}`).join('\n')}`
    : ''
  const reply = await $.model.complete({
    model: 'haiku',
    system: SYSTEM,
    prompt: `Context:\n${context}${before}\n\nYour tip:`,
    effort: 'medium',
    timeoutMs: 30_000,
  })
  if (!reply.isAnswered) return
  const text = reply.text.trim()
  if (!text || /^skip\b/i.test(text)) return
  recent.push(text)
  if (recent.length > 5) recent.shift()
  await update($, tip, () => ({ text, at: now }))
  $.ui.log(`💡 ${text}`)
}

export const register: Register = (on) => {
  on('prompt.submit', async ($, e, next) => {
    if (!e.isMeta) lastPrompt = e.text.slice(0, 400)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    // Never awaited: the tip must not slow the turn.
    if (e.agentId === undefined && e.reason === 'answer')
      void autoTip($, e.answer).catch(() => undefined)
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const shown = await read($, tip)
    if (!shown || (await $.clock.now()) - shown.at > SHOWN_MS) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" gap={1} minWidth={0}>
        <Text wrap="truncate-end">{`💡 ${shown.text}`}</Text>
        <Button key="tip-dismiss" label="×" onPress={() => update($, tip, () => null)} />
      </Box>
    )
  })
}
```

Aquí la banda comprueba la antigüedad del consejo cuando dibuja. Narsil, en cambio, marca el consejo como apagado en su latido, así que la banda se vuelve a dibujar cuando terminan los tres minutos y no solo en el siguiente renderizado.

## Errores comunes y cómo probarlo

- **Esperar al modelo dentro del hook.** Un hook `turn.complete` que espera con await una compleción retiene el final del turno todo lo que tarde el modelo. Arráncala y vuelve.
- **No dar forma de quedarse en silencio.** Sin `SKIP`, el modelo siempre encuentra algo que decir, y casi todo es relleno.
- **Enviar la conversación a un modelo barato por accidente.** `$.model.complete` solo envía lo que pones en él. Decide campo por campo qué sale, limita cada uno y sanea el conjunto.
- **Ejecutar el texto del modelo como código.** Las ventanas del consejo reciben el texto a través del entorno, nunca dentro de un script ni de una línea de comandos.
- **No limitar la frecuencia.** Cada consejo es una petición que se cobra. Pon en el mod un intervalo mínimo y un límite diario; nada en el motor añade uno.
- **Fiarse del plan más que del código.** Si copias de `docs/plan-advice.md`, comprueba los números con `hooks/advice.ts`: varios cambiaron.

Para probarlo, `claude plugin test .` ejecuta `tests/narsil.test.tsx`, que responde al modelo con `on('model.complete', ...)` y `on('model.fork', ...)`, así que no se hace ninguna petición real. Tests que vale la pena leer: "a finished turn's tip weighs a design choice of the turn, from its diff, with Haiku at medium effort" (el consejo de un turno terminado sopesa una decisión de diseño del turno, a partir de su diff, con Haiku en esfuerzo medio), "SKIP or an empty reply shows nothing" (SKIP o una respuesta vacía no muestran nada), "with the default, a second tip waits 30 minutes" (con el valor por defecto, un segundo consejo espera 30 minutos), "two failures of the same tool give one debugging tip" (dos fallos de la misma herramienta dan un consejo de depuración), "/narsil consejo profundo asks over the conversation itself" (/narsil consejo profundo pregunta sobre la propia conversación), "a secret never reaches the prompt sent to the model" (un secreto nunca llega al prompt enviado al modelo) y "a failed, timed-out or rejected model call shows nothing and breaks nothing" (una llamada al modelo fallida, agotada o rechazada no muestra nada y no rompe nada). Las ventanas del consejo tienen los suyos: "on Windows a tip opens whole in its own window, and leaves the band and the floating window free" (en Windows un consejo se abre entero en su propia ventana, y deja libres la banda y la ventana flotante) y "on macOS a tip opens whole in its own window too, through tip.sh, detached" (en macOS un consejo también se abre entero en su propia ventana, mediante tip.sh, desacoplado).

## Para ir más lejos

- `adviceCommand` en `hooks/register.tsx` gestiona todas las órdenes `/narsil consejo…`; `setAdvice` guarda las preferencias con `$.store`.
- La migración del valor por defecto guardado de 10 a 30 minutos (`ADVICE_MIGRATED_KEY`) cambia una vez un 10 antiguo y conserva un 10 elegido después.
- `lines` en `hooks/advice.ts` parte un consejo en líneas y corta una palabra más larga que una línea, como una ruta o una URL.
- La siguiente guía reutiliza el mismo contexto, el mismo `describe` y la misma llamada al modelo para proponer próximos pasos.
