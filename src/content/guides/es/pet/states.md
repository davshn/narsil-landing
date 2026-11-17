---
title: Los estados de un vistazo
description: 'Cómo Narsil convierte los eventos de la sesión en cinco estados, una frase sobre el paso actual y un comentario breve, dibujados en la banda sobre el prompt.'
route: pet
order: 1
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: hooks/sprite.ts
  - repo: pet
    path: types/index.d.ts
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Qué hace

Narsil vive en la banda que está justo encima del prompt. Con mirarla una vez respondes la pregunta que más te haces mientras Claude trabaja: ¿tengo que hacer algo ahora mismo?

La banda muestra tres cosas:

- **Un estado**, en mayúsculas y con su propio color. Narsil habla español, así que las etiquetas están en español:

  | Etiqueta      | Significado            | Cuándo aparece                                                           |
  | ------------- | ---------------------- | ------------------------------------------------------------------------ |
  | `TRABAJANDO`  | Trabajando             | Claude está pensando, leyendo, buscando, editando o ejecutando comandos. |
  | `PARADA`      | En reposo, esperándote | La conversación espera tu siguiente mensaje.                             |
  | `TE NECESITA` | Te necesita            | Una pregunta, un plan que aprobar o un permiso que decidir.              |
  | `TERMINADA`   | Terminada              | Claude terminó su respuesta.                                             |
  | `ERROR`       | Error                  | El turno se detuvo porque algo falló.                                    |

- **Una frase que dice exactamente qué está haciendo Claude**, como "Estoy editando: register.tsx" o "Te necesito: tengo una pregunta para ti".
- **El comentario propio de Narsil** bajo esa frase, elegido al azar entre unas pocas líneas para cada momento, como "Tecleando con mis aletas." mientras se edita un archivo.

Fuera de la terminal, la banda también dibuja a la propia Narsil, en una pose para cada estado (la siguiente guía trata el dibujo). En la terminal dibuja en su lugar una pequeña cara de texto, como `~(•ᴗ•)~ 💻`.

Lo valioso es que no necesitas leer la transcripción para saber cómo van las cosas. Un `TE NECESITA` amarillo es un motivo para volver; un `TRABAJANDO` azul es un motivo para seguir con otra cosa.

## Cómo funciona por dentro

El estado no es algo que Claude Code entregue a un mod. Narsil lo construye ella misma a partir de los eventos de la sesión, lo guarda en un solo valor y dibuja ese valor.

### Un valor, dos capas: ánimo y estado

El mod guarda un único valor de estado, el átomo `pet` de `hooks/register.tsx`, con tres campos: `mood`, `detail` y `line`. Su tipo, `Pet`, está declarado en `types/index.d.ts`.

`mood` (el ánimo) es más detallado que los cinco estados. Hay doce ánimos: `greeting`, `idle`, `thinking`, `talking`, `reading`, `searching`, `writing`, `running`, `asking`, `scared`, `celebrating` y `failed`. Los cinco estados se derivan del ánimo con `statusOf` en `hooks/sprite.ts`:

- `greeting` e `idle` son reposo (`PARADA`).
- `asking` es espera (`TE NECESITA`).
- `celebrating` es terminado (`TERMINADA`).
- `failed` es error (`ERROR`).
- Todos los demás ánimos son trabajo (`TRABAJANDO`), incluido `scared`.

El motivo de las dos capas es que el estado responde "¿tengo que actuar?", y para eso bastan cinco respuestas; el ánimo responde "¿qué está pasando exactamente?", y de él dependen la frase, el comentario y la pose. Guardar solo el ánimo y derivar el estado significa que los dos nunca pueden contradecirse.

El ánimo `scared` es un buen ejemplo de por qué importa esta separación. Cuando falla una llamada a una herramienta en mitad de un turno, Narsil parece asustada y la frase dice "Ha fallado un paso (Bash); sigo trabajando". El estado sigue en `TRABAJANDO`, porque Claude sigue trabajando y no se te pide nada. Solo un turno que termina en fallo pasa a `ERROR`.

### Los eventos que escucha Narsil

Cada cambio de ánimo pasa por una sola función, `setMood` en `hooks/register.tsx`, que escribe el átomo `pet` y envía el nuevo estado a la ventana flotante. Los hooks que la llaman:

- **`session.start`**: una conversación nueva empieza como `greeting`, que cuenta como reposo.
- **`turn.start`**: tu prompt inicia un turno; el ánimo pasa a `thinking`. El hook solo actúa cuando `e.agentId` no está definido, así que el turno de un subagente no reinicia la conversación principal.
- **`turn.step`**: la salida del modelo llega en fragmentos. Un fragmento `thinking` mantiene el ánimo en `thinking`; el primer fragmento `text` del bucle principal lo cambia a `talking` ("Estoy escribiendo la respuesta"). Este hook es un generador asíncrono: entrega con `yield` cada fragmento que recibe, así que el flujo llega a la pantalla sin cambios.
- **`tool.call`**: el evento que más información da. El nombre de la herramienta elige el ánimo mediante `MOOD_BY_TOOL` en `hooks/words.ts` (`Read` es leer, `Grep` y `WebSearch` son buscar, `Edit` y `Write` son escribir, `Bash` y `PowerShell` son ejecutar), y `describeCall` convierte la entrada de la llamada en el detalle breve que va tras los dos puntos: el nombre base del archivo para una herramienta de archivos, el patrón para una búsqueda, la primera línea de un comando. `AskUserQuestion` y `ExitPlanMode` se tratan aparte (`ASKING_TOOLS`): fijan `asking`, porque la propia herramienta es el momento en que Claude se detiene y espera.
- **`classic.PermissionRequest`**: un diálogo de permiso que tienes que responder. El hook llama primero a `next(e)` y fija `asking` solo cuando ningún hook de configuración lo decidió ya y el modo no es `bypassPermissions`.
- **`turn.complete`**: el turno termina, y `e.reason` decide el estado. `answer` pasa a `celebrating` con el tiempo que tardó ("He terminado (en 2 min)"), `aborted` vuelve a `idle` con "lo has detenido tú", y cualquier otro motivo pasa a `failed`.

### Por qué se tomó cada decisión

Los comentarios de `hooks/register.tsx` dan los motivos, y vale la pena leerlos como notas de diseño:

- **Los permisos usan `classic.PermissionRequest`, no `tool.check`.** El comentario explica que el `ask` de `tool.check` llega antes de que el modo de permisos resuelva la llamada, así que con "bypass permissions", una regla o el clasificador automático, Narsil daría falsas alarmas (el comentario dice "cry wolf", gritar que viene el lobo). El motor lanza `PermissionRequest` solo cuando está a punto de mostrarte el diálogo.
- **Un turno terminado no siempre está "terminado".** En el hook `classic.Stop`, Narsil cuenta las tareas en segundo plano que siguen en marcha (`e.background_tasks`). Si hay alguna, `turn.complete` la muestra todavía en `running` y esperándolas, en lugar de anunciar un final que no es real.
- **Una pregunta en el recuadro de siguiente paso de la app de escritorio es una pregunta.** Cuando un turno termina con la herramienta `mcp__ccd_turn__wrap_up` de la app de escritorio y esta lleva un `ask`, el hook `tool.call` guarda ese texto (`turnAsk`), y `turn.complete` muestra `asking` con él en lugar de `celebrating`.
- **Solo la mueven las llamadas del propio Claude.** `tool.call` empieza con `isClaudesCall(next.origin)` (en `hooks/watch.ts`): la llamada de otro mod, como narsil-check leyendo su sesión al empezar, no es trabajo de Claude.
- **Las palabras viven en un solo archivo.** `hooks/words.ts` contiene todas las etiquetas (`STATUS_LABEL`), el constructor de frases (`headline`), los comentarios (`LINES` y `pick`) y la tabla de herramientas. El módulo de hooks decide qué pasó; `words.ts` decide cómo se dice. Así las etiquetas son idénticas en todos los lugares donde aparecen: la banda, la ventana flotante, el teléfono y `/narsil estado`.
- **Narsil habla en primera persona.** Las frases están escritas como si Narsil hablara ("Estoy leyendo"), una decisión que consta en el historial de commits (ver más abajo).

### Qué dibuja la banda

El hook `ui.render` para `{ component: 'AbovePrompt' }` lee el estado y devuelve un árbol de elementos `Box`, `Text`, `Button` y `Svg` obtenidos de `$.ui.resolve(e)`. Cede el sitio a una encuesta (`e.props.hasSurvey`) y a `/narsil ocultar`.

En la terminal dibuja una línea: la cara de texto de `FACE`, la etiqueta en negrita con su color y la frase. En las demás superficies dibuja la imagen mediante `Svg` a 132 por 118 píxeles, y a su lado una columna con `● LABEL · Narsil · level`, la frase en negrita y el comentario atenuado. Los colores vienen de `STATUS_COLOR` en `hooks/sprite.ts`: azul `#3B8BFF` para trabajando, gris para reposo, amarillo `#F5B400` para te necesita, verde para terminado y rojo para error.

Todo texto que puede crecer se dibuja con `wrap="truncate-end"` dentro de una caja con `minWidth={0}`, así que un nombre de archivo largo se corta dentro de la banda en lugar de ensancharla.

La banda que ves hoy dibuja la más importante de todas tus conversaciones abiertas, no solo la actual; la tercera guía de esta ruta explica esa parte. Cuando la conversación que muestra es otra, la frase empieza con el nombre de esa conversación y se omite el comentario.

## Cómo se le pidió a la IA

La petición original de los estados no quedó registrada. Los registros de tareas públicos del proyecto (`odd/tasks/fleet-view.md` y `odd/tasks/animated-poses.md`) empiezan más tarde, y ninguno cubre la primera banda.

### Reconstrucción a partir del historial de commits

A partir de `git log -- hooks/register.tsx hooks/words.ts` en narsil-pet:

- `b1187f3` (2026-10-30) "feat: show Narsil above the prompt with clear states and /narsil" (mostrar a Narsil sobre el prompt con estados claros y /narsil). La banda, sus estados y el comando `/narsil` llegan juntos en el primer commit del módulo de hooks.
- `8e29583` (2026-10-30) "fix(band): keep long text from widening the desktop band" (evitar que el texto largo ensanche la banda de escritorio). De aquí viene la regla de `minWidth={0}` y el truncado descrita arriba.
- `2027f06` (2026-10-30) "fix(alerts): only alert when a permission dialog needs your answer" (avisar solo cuando un diálogo de permiso necesita tu respuesta). El paso a `classic.PermissionRequest`, explicado en el comentario del código citado arriba.
- `0cfc369` (2026-10-31) "refactor: move Narsil's wording and labels out of the hooks module" (sacar los textos y las etiquetas de Narsil del módulo de hooks). Es cuando nació `hooks/words.ts`.
- `c73bc13` (2026-10-31) "feat: let Narsil speak of herself in the first person" (que Narsil hable de sí misma en primera persona), seguido de `36256f9` "feat: let the band, window and alerts speak in Narsil's first person" (que la banda, la ventana y los avisos hablen en la primera persona de Narsil).
- `2532e7c` (2026-11-02) "feat: alert as a question when a turn ends asking in the desktop app's next-step box" (avisar como pregunta cuando un turno termina preguntando en el recuadro de siguiente paso de la app de escritorio).
- `519dd73` (2026-11-06) "fix: wait for background work before announcing a turn finished" (esperar al trabajo en segundo plano antes de anunciar que un turno terminó). Su mensaje dice que un turno que se detiene con shells, monitores o subagentes en segundo plano todavía en marcha ahora muestra a Narsil esperándolos.

El patrón es claro incluso sin los prompts: una primera versión que asignaba eventos a estados, y después una serie de correcciones cada vez que un estado mentía (una falsa alarma, un falso final, una pregunta que no se mostró).

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt que se usó para construir Narsil.

> Crea un mod de Claude Code llamado `my-pet` que muestre el estado de la conversación en la banda sobre el prompt (`ui.render` en `AbovePrompt`). Guarda un único valor de estado en un átomo con un estado (trabajando, en reposo, esperando, terminado, error) y un titular de una línea. Fíjalo desde `turn.start` (trabajando), `tool.call` (trabajando, con la herramienta y el nombre base del archivo en el titular; esperando para `AskUserQuestion` y `ExitPlanMode`) y `turn.complete` (terminado con `answer`, en reposo con `aborted`, error en otro caso). Ignora los eventos que tengan `agentId`. Dibuja la etiqueta en negrita con su color y el titular a continuación, truncado para que nunca ensanche la banda. Comprueba cada API con los tipos de plugin-authoring, declara el átomo en `types/index.d.ts` y añade un test con `claude-code/testing` que compruebe que una llamada a `Read` muestra el nombre del archivo.

## El código mínimo

Esta es una versión reducida de la idea, escrita para esta guía y comprobada con los tipos de Claude Code 2.1.325. Está adaptada de `hooks/register.tsx`, `hooks/words.ts` y `hooks/sprite.ts` de [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later); los colores son los de `STATUS_COLOR` de Narsil.

El tipo del estado, en `types/index.d.ts` (nombrado por `"types"` en `plugin.json`):

```ts
export type Status = 'working' | 'idle' | 'waiting' | 'done' | 'error'
export type Pet = { status: Status; headline: string }

declare module 'claude-code' {
  interface PluginState {
    'my-pet': { pet: Pet }
  }
}
```

El módulo de hooks, `hooks/register.tsx`:

```tsx
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'
import type { Status } from '../types'

const LABEL: Record<Status, string> = {
  working: 'WORKING',
  idle: 'IDLE',
  waiting: 'NEEDS YOU',
  done: 'DONE',
  error: 'ERROR',
}
const COLOR: Record<Status, string> = {
  working: '#3B8BFF',
  idle: '#8A90A6',
  waiting: '#F5B400',
  done: '#22B573',
  error: '#F0435A',
}
const VERB: Record<string, string> = {
  Read: 'reading',
  Grep: 'searching',
  Edit: 'editing',
  Write: 'editing',
  Bash: 'running',
}

const pet = atom({ plugin: 'my-pet', key: 'pet' } as const, {
  status: 'idle',
  headline: 'Waiting for your message',
})

export const register: Register = (on) => {
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined)
      await update($, pet, () => ({ status: 'working', headline: 'Thinking' }))
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId === undefined) {
      const input = e as unknown as Record<string, unknown>
      const file = typeof input.file_path === 'string' ? input.file_path.split(/[\\/]/).pop() : ''
      const isAsking = e.tool === 'AskUserQuestion' || e.tool === 'ExitPlanMode'
      await update($, pet, () =>
        isAsking
          ? { status: 'waiting', headline: 'I have a question for you' }
          : {
              status: 'working',
              headline: `I am ${VERB[e.tool] ?? 'working'}${file ? `: ${file}` : ''}`,
            },
      )
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    const status: Status =
      e.reason === 'answer' ? 'done' : e.reason === 'aborted' ? 'idle' : 'error'
    await update($, pet, () => ({
      status,
      headline: status === 'error' ? 'I stopped on an error' : 'Done',
    }))
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const s = await read($, pet)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" gap={1} minWidth={0}>
        <Text bold color={COLOR[s.status]}>{`● ${LABEL[s.status]}`}</Text>
        <Text wrap="truncate-end">{s.headline}</Text>
      </Box>
    )
  })
}
```

Tres detalles sostienen el diseño. Cada hook que solo observa termina llamando a `next(e)`, así que el comportamiento propio de Claude Code continúa. `turn.complete` espera primero a `next(e)` y reacciona al turno ya resuelto. Y el hook de dibujo lee el átomo con `read`, que suscribe el dibujo: cada `update` vuelve a dibujar la banda.

## Errores comunes y cómo probarlo

Estos salen del código y de las correcciones de Narsil:

- **Reaccionar a los subagentes como si fueran la conversación principal.** Los subagentes también lanzan `turn.start`, `tool.call` y `turn.complete`, con `e.agentId` definido. Narsil comprueba `e.agentId === undefined` antes de tocar el estado principal.
- **Alarmas que el modo de permisos ya resolvió.** Detectar "te necesita" desde `tool.check` salta con bypass permissions. La corrección de Narsil (`2027f06`) escucha `classic.PermissionRequest` y aun así lo omite cuando un hook de configuración respondió (`result.decision`) o el modo es `bypassPermissions`.
- **Un "terminado" que no está terminado.** Un turno puede terminar mientras sigue trabajo en segundo plano. Narsil lee `background_tasks` en `classic.Stop` antes de decidir (`519dd73`).
- **Texto que ensancha la banda.** En el escritorio, un titular largo desborda el diseño. Usa `minWidth={0}` en la columna y `wrap="truncate-end"` en el texto (`8e29583`).
- **Tragarse el flujo.** Un hook `turn.step` es un generador: si no entrega con `yield` cada fragmento de `next(e)`, la respuesta deja de llegar a la pantalla.
- **Ignorar las encuestas.** Cuando `e.props.hasSurvey` es verdadero, la banda pertenece a la encuesta; devuelve `next(e)`.

Para probarlo, `claude plugin test .` ejecuta los archivos `*.test.tsx` del mod. `tests/narsil.test.tsx` de Narsil es un buen modelo: inicia una sesión con `$.session.start`, llama a herramientas con `$.tool.call`, monta la banda con `$.ui.mount` y busca textos con `find`. Entre los tests que vale la pena copiar por su nombre están "a new conversation shows as stopped and ready, on every surface" (una conversación nueva se muestra parada y lista, en todas las superficies), "a permission dialog you must answer pops up as a question" (un diálogo de permiso que debes responder aparece como pregunta) y "an ask the mode settles by itself (bypass permissions) raises no alarm" (una petición que el modo resuelve por sí solo, con bypass permissions, no da la alarma). El registro de tareas de Narsil anota que, en la terminal de quien creó Narsil, `claude plugin test .` necesitó `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` (`odd/tasks/fleet-view.md`, L6). Ejecuta también `claude plugin validate .claude-plugin/plugin.json`: comprueba las lecturas y escrituras de tus átomos con `types/index.d.ts`.

Una nota sobre las superficies: el README de Narsil dice que la banda funciona en la terminal, la app de escritorio, VS Code y la app móvil. Los tipos de 2.1.325 documentan `AbovePrompt` como "Raised on the terminal, desktop and mobile surfaces only" (se lanza solo en las superficies de terminal, escritorio y móvil). Prueba en las superficies que te importan en lugar de fiarte de cualquiera de las dos afirmaciones.

## Para ir más lejos

La versión completa de narsil-pet añade mucho alrededor del mismo núcleo:

- `setMood` en `hooks/register.tsx` es el único punto de entrada de cada cambio, y además envía el estado al hub local (`pushOverlay`).
- `headline` y `LINES` en `hooks/words.ts` contienen la frase de cada uno de los doce ánimos y tres comentarios para cada uno; `describeCall` construye el detalle para archivos, patrones, consultas, URL, comandos y subagentes.
- El hook `tool.call` también reconoce comandos de test (`TEST_COMMAND`) para celebrar los tests que pasan, y advierte de los comandos que no se pueden deshacer (`dangerOf`), sin bloquearlos.
- `startWaiting` y `stopWaiting` insisten una vez cuando un permiso o una pregunta lleva cinco minutos esperando.
- `announce` habla y notifica en los momentos clave (inicio, terminado, pregunta, error), y `sendStatus` envía el estado al teléfono.
- `FACE` en `hooks/sprite.ts` es la cara de terminal de cada ánimo; `sprite` dibuja la imagen completa, que se trata en la siguiente guía.
