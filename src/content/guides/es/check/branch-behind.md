---
title: Una rama por detrás de su remoto
description: 'Cómo Narsil Check hace fetch, cuenta los commits que le faltan a tu rama, avisa arriba del panel y los trae con un botón de git pull -r.'
route: check
order: 5
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/words.ts
  - repo: check
    path: hooks/git.ts
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/session.test.tsx
---

## Qué hace

Cuando trabajas en una rama a la que otra persona también hace push, es fácil empezar un cambio sobre un estado antiguo y no enterarte hasta el siguiente push. Narsil Check te lo dice antes de que pase.

Cada vez que el panel revisa las bibliotecas del proyecto, también le pregunta a git si tu rama va por detrás de su remoto. Si es así, aparece un panel rojo en lo más alto del panel, por encima de todo lo demás, en negrita:

> ⚠ La rama feat/login está 3 commits detrás de su remota: actualízala antes de seguir.

Justo debajo hay un botón, **Actualizar rama**.

El mismo botón está también al final del panel, centrado bajo la última sección, para que puedas hacer pull en cualquier momento, haya aviso o no. Una pulsación ejecuta `git pull -r` sobre la rama activa. Mientras se ejecuta, el botón se convierte en el texto atenuado "Actualizando la rama…". Cuando termina, una línea encima del botón inferior dice cómo fue:

| Línea                                           | Significado                                                  |
| ----------------------------------------------- | ------------------------------------------------------------ |
| `Rama feat/login actualizada: rebase hecho`     | Tus commits locales se volvieron a aplicar sobre los nuevos. |
| `Rama feat/login actualizada: ya estaba al día` | No había nada que traer: ya estaba al día.                   |
| `Rama feat/login actualizada: Fast-forward`     | Sin commits locales: la rama simplemente avanzó.             |
| `No pude actualizar la rama: …` (en rojo)       | Git se negó o falló; a continuación va su propio motivo.     |

Después de un pull correcto el panel vuelve a revisar las bibliotecas, y el aviso desaparece.

Cuando no hay nada que decir, no se muestra nada: sin rama remota, sin respuesta de la red o con un `HEAD` separado, el aviso queda oculto, como dice el README.

## Cómo funciona por dentro

### Dónde vive el código

La especificación de esta ruta apunta a `hooks/git.ts`, pero ese archivo no ejecuta git. Contiene las funciones auxiliares puras para el pull request de actualización de una guía posterior (`isMainBranch`, `branchName`, `commitTitle`, `prBody`). El fetch, el recuento y el pull están en `hooks/register.tsx`, y sus palabras en `hooks/words.ts` (`behindNote`, `pullSummary`, `tail`).

### Dos valores pequeños

El módulo de hooks guarda dos atoms, ambos tipados en `types/index.d.ts`:

- `behind`: `{ status: 'unknown' }` o `{ status: 'checked', branch, count }`. Lo que encontró la última revisión.
- `pull`: `idle`, `running`, `done` con un texto, o `failed` con un mensaje. Cómo terminó la última pulsación del botón.

El panel se dibuja a partir de estos dos valores y nada más. Esa separación es la habitual en Narsil Check: las funciones que hacen el trabajo escriben un atom, y el hook `ui.render` solo lee.

### Contar lo que falta

`checkBehind` le hace tres preguntas a git, cada una mediante `$.process.run` con un tiempo límite de dos minutos (`GIT_MS`):

1. `git branch --show-current`. Una respuesta vacía significa un `HEAD` separado: no hay rama que comparar, así que el valor se queda en `unknown`.
2. `git fetch --quiet`. Actualiza las ramas de seguimiento remoto, para que el recuento que sigue trate del remoto tal como está ahora, no como estaba en el último fetch.
3. `git rev-list --count HEAD..@{upstream}`. `HEAD..@{upstream}` significa "los commits que tiene el upstream y que `HEAD` no tiene". `--count` lo convierte en un solo número.

Solo un código de salida 0 y un número que se pueda interpretar dan `{ status: 'checked', branch, count }`. Una rama sin upstream hace que `rev-list` falle, lo que deja `unknown`. Cualquier rechazo (git no instalado, un tiempo agotado) se captura y también deja `unknown`. El aviso solo se muestra con `checked` y `count > 0`.

Un detalle que el README no menciona: el código no comprueba el código de salida del fetch. Si el fetch falla porque no hay red pero la rama tiene upstream, `rev-list` sigue contando contra la rama de seguimiento remoto del último fetch correcto. El recuento puede estar desactualizado, y puede ser mayor que cero. El "sin red … no se muestra nada" del README se cumple cuando nunca hubo un fetch con el que comparar, no en todos los casos.

### Cuándo se comprueba

`checkBehind` nunca se espera con `await`. `scanProject` lo lanza con `void checkBehind($).catch(() => undefined)` en su primera línea, así que el recuento se ejecuta junto a la revisión de bibliotecas. Esa revisión se ejecuta al inicio de sesión, con **Revisar de nuevo**, con `/narsil-check upgrade`, después del botón de actualización, después del botón de pull request y después de un pull correcto. Un proyecto sin manifiesto que analizar también recibe la comprobación al inicio de sesión, mediante un `else void checkBehind($)` aparte: el comentario dice "with nothing to scan, that check still runs" (sin nada que analizar, esa comprobación se ejecuta igualmente).

No hay temporizador. El panel no consulta el remoto periódicamente; vuelve a mirar cuando haces algo que revisa el proyecto, o cuando lo hace el panel.

### Hacer pull

`pullBranch` es lo que llaman los dos botones:

```tsx
async function pullBranch($: EngineInterface): Promise<void> {
  if ((await read($, pull)).status === 'running') return
  await update($, pull, () => ({ status: 'running' }) as Pull)
  const branch = (await read($, session)).branch
  try {
    const ran = await runCommand($, ['git', 'pull', '-r'], PULL_MS)
    const value: Pull =
      ran.exitCode === 0
        ? {
            status: 'done',
            text: `Rama ${branch || 'actual'} actualizada: ${pullSummary(ran.stdout)}`,
          }
        : {
            status: 'failed',
            message:
              tail(ran.stderr || ran.stdout) || `git pull terminó con código ${ran.exitCode}`,
          }
    await update($, pull, () => value)
  } catch (err) {
    await update($, pull, () => ({ status: 'failed', message: errorText(err) }) as Pull)
  }
  void loadSession($, true, false).catch(() => undefined)
  if ((await read($, pull)).status === 'done') void runScan($, true).catch(() => undefined)
}
```

Está citado de [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Cada línea es una decisión:

- **Un pull cada vez.** Una segunda pulsación mientras uno se ejecuta no hace nada, y el botón no se dibuja mientras tanto.
- **Dos minutos como máximo** (`PULL_MS = 120_000`). Un pull que descarga mucho puede tardar más que los 30 segundos por defecto de `$.process.run`.
- **Una salida distinta de cero es una respuesta.** Los tipos de 2.1.325 dicen que `$.process.run` se resuelve "once it exits, any exit code" (en cuanto termina, con cualquier código de salida) y solo se rechaza "when the command cannot start or is still running then" (cuando la orden no puede arrancar o todavía se está ejecutando en ese momento). Así que una negativa se lee en `exitCode`, y `catch` es para cuando falta git o se agota el tiempo.
- **El motivo es el de git.** `tail` conserva las cuatro últimas líneas de stderr (o de stdout cuando stderr está vacío), unidas y recortadas a 400 caracteres: donde git escribe su "porqué". Sin ninguna salida, el texto es "git pull terminó con código N".
- **Después, volver a leerlo todo.** `loadSession` vuelve a leer la rama y la carpeta de la sesión. Solo un pull correcto vuelve a analizar también las bibliotecas con `isFresh` activado, porque el pull puede haber traído otras versiones en los manifiestos. Ese nuevo análisis vuelve a ejecutar `checkBehind`, que es lo que oculta el aviso.

`runCommand` es un pequeño envoltorio que también usa el botón de actualización: sin shell, Windows arranca algunas herramientas solo mediante su shim `.cmd`, así que una orden que no puede arrancar se vuelve a intentar como `<command>.cmd`.

`pullSummary` convierte la salida de git en unas pocas palabras: "up to date" pasa a `ya estaba al día`, "Successfully rebased" pasa a `rebase hecho`, "Fast-forward" se queda en `Fast-forward`, y cualquier otra cosa es la última línea de git.

### Por qué `-r`

El historial muestra que la elección se hizo dos veces. La primera versión del botón, en `b3ad055`, ejecutaba `git pull --ff-only`. El mismo día, `7b864b6` lo cambió a `git pull -r`, "replaying local commits over the remote's" (volviendo a aplicar los commits locales sobre los del remoto).

Los commits no dicen por qué. Leyendo las dos opciones lado a lado: `--ff-only` se niega en cuanto tienes un commit local que el remoto no tiene, que es el caso habitual cuando vas por detrás en una rama compartida, así que el botón fallaría justo cuando hace falta. Un `git pull` sin más crearía un commit de merge en cada actualización. Un rebase mantiene el historial en una sola línea y deja tus commits encima, lo que coincide con lo que pide el aviso: "actualízala antes de seguir". Este razonamiento es una interpretación del cambio, no una decisión registrada.

### Por qué el mod ejecuta git por su cuenta

Lo dice un comentario en `hooks/register.tsx`: "The mod runs git itself, so the app asks no permission." (El mod ejecuta git por su cuenta, así que la app no pide permiso.) Una pulsación en un botón del panel ya es una decisión de la persona; pasarla por la herramienta Bash de Claude volvería a preguntar. El README dice lo mismo: "Lo ejecuta el mod directamente, sin pasar por los permisos de la app".

Eso trae dos cosas, ambas de los tipos de 2.1.325. `$.process.run` está marcado como "CLI only" (solo CLI), como el resto del sustantivo `process`. Y "Git runs with repo hooks off" (git se ejecuta con los hooks del repositorio desactivados), así que los hooks del repositorio (un hook `post-merge` o `post-rewrite`, por ejemplo) no se ejecutan en este pull.

### Cuándo se ofrece el botón, y cuándo no

El botón inferior se dibuja siempre, salvo mientras se ejecuta un pull. El botón del panel rojo solo se dibuja con el aviso. El código no mira el árbol de trabajo antes de ofrecerlo: no comprueba si hay cambios sin commit ni un rebase en curso.

Eso es deliberado en el sentido de que git ya conoce esas reglas. Git rechaza un pull con rebase cuando hay cambios sin commit en archivos con seguimiento (salvo que la propia configuración del repositorio, como `rebase.autoStash`, le indique otra cosa), y el panel muestra el motivo de git en rojo. El README lo describe así: "Si git no puede hacerlo (un conflicto o cambios sin commit), lo dice y muestra el motivo".

Un conflicto es el caso que conviene conocer. Cuando el rebase se detiene en un conflicto, git termina con un error y deja el repositorio a mitad del rebase. El panel muestra el final de la salida de git, y eso es todo lo que hace: no ejecuta `git rebase --abort` ni nada más. Resuelves el conflicto y continúas, o abortas, por tu cuenta. Como un pull fallido no vuelve a analizar, el aviso se queda con su recuento anterior hasta la siguiente revisión.

## Constrúyelo con Claude

Pídele a Claude un aviso que cuente los commits que le faltan a tu rama y un botón que los traiga. La única idea que debe entender bien es que «sin respuesta» no es cero: un `HEAD` separado, la falta de upstream o un comando fallido dejan el estado en `unknown`, y no se muestra nada.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil Check.

> En mi mod de Claude Code `my-panel`, añade a mi panel un aviso de "por detrás de su remoto". En una función que ningún hook espere con await, ejecuta con `$.process.run` (tiempo límite de dos minutos) `git branch --show-current`, después `git fetch --quiet` y después `git rev-list --count HEAD..@{upstream}`. Guarda el resultado en un atom tipado en `types/index.d.ts`: `unknown` para un HEAD separado, sin upstream, una salida distinta de cero o un rechazo, y en otro caso la rama y el recuento. Ejecútala al inicio de sesión. Cuando el recuento sea mayor que cero, dibuja una caja con borde rojo arriba del panel que diga "Branch X is N commits behind its remote" con un botón que ejecute `git pull -r` (tiempo límite de dos minutos). Guarda el estado del pull en un segundo atom: en curso, terminado con un resumen breve de la salida de git, o fallido con las últimas líneas de stderr. Ignora una segunda pulsación mientras uno se ejecuta. Después de un pull correcto, vuelve a ejecutar la comprobación. Comprueba cada API con los tipos de plugin-authoring y pruébalo con `claude-code/testing`, respondiendo a git mediante un hook `on('process.run', ...)`.

### Qué revisar en la respuesta de Claude

1. La comprobación ejecuta `git fetch --quiet` antes de `git rev-list --count HEAD..@{upstream}`, así que la cuenta se refiere al remoto tal como está ahora.
2. Un `HEAD` separado, una rama sin upstream, un código de salida distinto de cero o un rechazo dejan el estado en `unknown`. El aviso solo aparece con una cuenta mayor que cero.
3. La comprobación empieza con `void` desde `session.start` y nunca se espera, así que un fetch lento no retiene la sesión.
4. El botón ejecuta `git pull -r`, no `--ff-only`, con un tiempo límite de dos minutos, y una segunda pulsación mientras corre un pull no hace nada.
5. Un pull fallido muestra en rojo las últimas líneas del stderr de git. Solo un pull que sale bien vuelve a ejecutar la comprobación, y eso oculta el aviso.

Si una comprobación falla, dile a Claude lo que ves: "el pull falló y el panel no dice por qué".

### Cómo lo pidió el autor

La petición original del aviso y del botón no quedó registrada. Ninguno de los registros de tareas públicos de narsil-check (`odd/tasks/*.md`) cubre esta función.

#### Reconstrucción a partir del historial de commits

A partir de `git log -S checkBehind`, `git log -S pullBranch` y `git log -S "pull -r"` en narsil-check:

- `b3ad055` (2026-11-06) "feat: fold upgrade and vulnerability groups, copy a row on click, show baby Narsil and pull the branch" (plegar los grupos de actualizaciones y vulnerabilidades, copiar una fila con un clic, mostrar a la Narsil bebé y hacer pull de la rama). Su mensaje: "Actualizar rama, last in the pane, runs git pull --ff-only through the mod, with no permission prompt." (Actualizar rama, al final del panel, ejecuta git pull --ff-only a través del mod, sin pedir permiso.) Llega el botón, al final, solo con fast-forward.
- `7b864b6` (2026-11-06) "feat: pull the branch with a rebase" (hacer pull de la rama con un rebase). Su mensaje: "Actualizar rama now runs git pull -r, replaying local commits over the remote's, and names a rebase, an up-to-date branch or a fast-forward in its result." (Actualizar rama ahora ejecuta git pull -r, volviendo a aplicar los commits locales sobre los del remoto, y nombra en su resultado un rebase, una rama al día o un fast-forward.) La corrección por el camino: de `--ff-only` a `-r`, y `pullSummary` con sus tres resultados.
- `2b91c7d` (2026-11-13) "feat: return to the default branch after the PR and warn when the branch is behind" (volver a la rama por defecto después del PR y avisar cuando la rama va por detrás). Su mensaje: "Each review fetches and counts the commits the upstream has that HEAD lacks, and shows a red warning at the top of the pane with its own pull button." (Cada revisión hace fetch y cuenta los commits que tiene el upstream y que le faltan a HEAD, y muestra un aviso rojo arriba del panel con su propio botón de pull.)

El patrón: primero un botón manual, su comportamiento corregido el mismo día, y una semana después el panel aprendiendo a decir cuándo hace falta el botón, poniendo una segunda copia donde primero se posa la vista.

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Esta es una versión reducida de la idea, escrita para esta guía y comprobada con los tipos de Claude Code 2.1.325. Está adaptada de `hooks/register.tsx` en [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Deja fuera la lectura de la sesión y el análisis de bibliotecas.

El tipo del estado, en `types/index.d.ts`:

```ts
export type Behind = { status: 'unknown' } | { status: 'checked'; branch: string; count: number }
export type Pull =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; text: string }
  | { status: 'failed'; message: string }

declare module 'claude-code' {
  interface PluginState {
    'my-panel': { behind: Behind; pull: Pull }
  }
}
```

La parte del módulo de hooks, `hooks/register.tsx`:

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'
import type { Behind, Pull } from '../types'

const behind = atom({ plugin: 'my-panel', key: 'behind' } as const, { status: 'unknown' } as Behind)
const pull = atom({ plugin: 'my-panel', key: 'pull' } as const, { status: 'idle' } as Pull)
const GIT_MS = 120_000

export async function checkBehind($: EngineInterface): Promise<void> {
  let value: Behind = { status: 'unknown' }
  try {
    const run = (argv: string[]) => $.process.run(argv, { timeoutMs: GIT_MS })
    const branch = (await run(['git', 'branch', '--show-current'])).stdout.trim()
    if (branch) {
      await run(['git', 'fetch', '--quiet'])
      const counted = await run(['git', 'rev-list', '--count', 'HEAD..@{upstream}'])
      const count = Number.parseInt(counted.stdout.trim(), 10)
      if (counted.exitCode === 0 && Number.isFinite(count))
        value = { status: 'checked', branch, count }
    }
  } catch {
    // Unknown: nothing shows.
  }
  await update($, behind, () => value)
}

const tail = (text: string) => text.trim().split(/\r?\n/).slice(-4).join(' ').slice(0, 400)

export async function pullBranch($: EngineInterface): Promise<void> {
  if ((await read($, pull)).status === 'running') return
  await update($, pull, () => ({ status: 'running' }) as Pull)
  try {
    const ran = await $.process.run(['git', 'pull', '-r'], { timeoutMs: GIT_MS })
    await update($, pull, () =>
      ran.exitCode === 0
        ? { status: 'done', text: tail(ran.stdout) || 'done' }
        : {
            status: 'failed',
            message: tail(ran.stderr || ran.stdout) || `exit code ${ran.exitCode}`,
          },
    )
  } catch (err) {
    await update($, pull, () => ({ status: 'failed', message: String(err) }) as Pull)
  }
  if ((await read($, pull)).status === 'done') void checkBehind($).catch(() => undefined)
}
```

Lanza la comprobación desde `session.start` con `void checkBehind($).catch(() => undefined)` antes de `return next(e)`. En el hook `ui.render` del panel, lee los dos atoms con `read($, behind)` y `read($, pull)`. Cuando `behind` sea `checked` con un recuento mayor que cero, dibuja un `Box` con un `borderColor` rojo, un `Text` en negrita con el aviso y un `Button` cuyo `onPress` sea `() => pullBranch($)`; mientras `pull` esté en `running`, dibuja en su lugar un `Text` atenuado. Dibuja el texto de `pull` en verde cuando esté en `done` y su mensaje en rojo cuando esté en `failed`.

## Errores comunes y cómo probarlo

Estos salen del código y los commits de Narsil Check:

- **Contar antes de hacer fetch.** Sin `git fetch`, `HEAD..@{upstream}` compara con lo que trajiste la última vez, quizá hace días. Haz fetch primero.
- **Fiarse de un fetch fallido.** Si el fetch falla y no compruebas su código de salida, el recuento puede estar desactualizado. Narsil Check lo acepta; una versión más estricta se queda en `unknown` cuando el fetch no termina con 0.
- **Tratar "sin respuesta" como cero.** Un `HEAD` separado, la falta de upstream o la falta de git no son "al día". Mantén un `unknown` aparte y no muestres nada para él.
- **Esperar a git en un hook.** Un fetch puede tardar segundos. Lánzalo con `void`, nunca lo esperes con `await` en `session.start`.
- **`--ff-only` en una rama compartida.** Se niega en cuanto tienes un commit local, que es justo el caso para el que existe el aviso. Esa es la corrección que hizo `7b864b6`.
- **Ocultar el motivo de git.** Un pull que falla sin decir por qué deja a la persona adivinando. Conserva las últimas líneas de stderr, donde git lo escribe.
- **Olvidar el rebase en curso.** Después de un conflicto el repositorio está a mitad de un rebase. Dilo en el mensaje, o al menos no vuelvas a analizar como si el pull hubiera funcionado.
- **Dos pulls a la vez.** Protege la función con el estado `running` y oculta el botón mientras tanto.

Para probarlo, `tests/session.test.tsx` responde a git mediante un hook `on('process.run', ...)` con el vector de argumentos unido como clave. "a review that finds the branch behind its remote shows a big warning at the top, with the pull at hand" (una revisión que encuentra la rama por detrás de su remoto muestra un aviso grande arriba, con el pull a mano) responde a `git rev-list --count HEAD..@{upstream}` con `3` y espera la caja roja `behind`, el texto exacto del aviso y el botón `behind-pull`. "a branch up to date with its remote, or with none, shows no warning" (una rama al día con su remoto, o sin remoto, no muestra ningún aviso) responde `0`. "\"Actualizar rama\", last in the pane, pulls the checked-out branch with a rebase and says how it went" ("Actualizar rama", al final del panel, hace pull de la rama activa con un rebase y dice cómo fue) comprueba que `branch-pull` es el último botón, centrado, y que una pulsación deja "Rama feat/login actualizada: rebase hecho". "a pull that fails says why" (un pull que falla dice por qué) espera una línea que empiece por "No pude actualizar la rama: ". "the words of each pull that went well" (las palabras de cada pull que salió bien) prueba `pullSummary` con las frases reales de git.

## Para ir más lejos

- El nombre de la rama en la sección **Entorno** abre una pestaña de terminal en la carpeta de la sesión (ver la guía del entorno de la sesión), que es donde resuelves un conflicto que dejó el pull.
- `@{upstream}` se puede cambiar por `origin/main` para mostrar a qué distancia está una rama de funcionalidad de la rama por defecto, una pregunta distinta con las mismas tres órdenes.
- El mismo `checkBehind` también podría contar `@{upstream}..HEAD`, los commits que todavía no has subido, y avisar también de ellos.
