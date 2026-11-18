---
title: El mapa de trabajo
description: 'Cómo Narsil Check dibuja un mapa animado y en vivo de lo que hace Claude, con Narsil bebé en el centro, sin hacer esperar nunca a una herramienta ni mostrar lo que escribiste.'
route: check
order: 2
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/map/hooks.ts
  - repo: check
    path: hooks/map/board.ts
  - repo: check
    path: hooks/map/classify.ts
  - repo: check
    path: hooks/map/draw.ts
  - repo: check
    path: hooks/map/stations.ts
  - repo: check
    path: hooks/map/words.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: tests/map-pane.test.tsx
  - repo: check
    path: odd/tasks/work-map.md
---

## Qué hace

La primera sección del panel es **Mapa mental**: una imagen en vivo de lo que Claude está haciendo en la sesión. Narsil bebé está en el centro, en su versión clara u oscura según el tema de la app. Alrededor hay diez estaciones, una por tipo de trabajo:

| Estación      | Qué llega ahí                                                |
| ------------- | ------------------------------------------------------------ |
| **Tú**        | Tus mensajes, y cada respuesta lista                         |
| **Modelo**    | Cada paso del modelo, y un cambio de modelo                  |
| **Memoria**   | Archivos de la carpeta de memoria propia de Claude Code      |
| **Archivos**  | Read, Write, Edit, Grep, Glob y los comandos de archivos     |
| **Terminal**  | Comandos de shell, PowerShell y monitores                    |
| **Red**       | Descargas y búsquedas web, y los comandos que salen a la red |
| **Navegador** | Las herramientas del navegador                               |
| **Agentes**   | Subagentes, flujos de trabajo y trabajo en segundo plano     |
| **Skills**    | Skills, comandos con barra y búsquedas de herramientas       |
| **Hooks**     | Hooks de configuración que rechazan, preguntan o tardan      |

Cada llamada a una herramienta sale de Narsil como un pulso hacia su estación. La estación se enciende mientras trabaja y muestra cuántas veces se usó. Además, el mapa muestra:

- **Radios** que se engrosan con el uso, y **una ruta** que une las últimas estaciones visitadas y se desvanece con el tiempo.
- **Dos manecillas** alrededor de una estación cuya llamada está tardando.
- **Un punto rojo** en una estación tras un error o un rechazo de un hook, hasta tu siguiente mensaje.
- **Un anillo** alrededor de Narsil que se llena con el contexto en uso: ámbar al 70 % y rojo al 90 %. Debajo, el modelo y el porcentaje.
- **Los subagentes** que siguen trabajando, girando alrededor de **Agentes**.
- **Una tarea en segundo plano** (un comando, un monitor o un agente lanzado aparte) que sigue encendida hasta que avisa de que terminó. Si en una hora no avisa, se cierra al final de un turno.

El punto de la sección es azul mientras algo trabaja, rojo si algo falló y verde en reposo. En la terminal, que no dibuja SVG, la sección no aparece.

El mapa viene de [lot-map](https://github.com/alexeyw/lot-map), de Aleksei Volodin (licencia MIT), adaptado a los colores de Narsil. Narsil Check le da el crédito en su README y guarda el aviso de copyright y de permiso de lot-map en `hooks/map/LICENSE-lot-map.txt`.

## Cómo funciona por dentro

El mapa vive en `hooks/map/`, en cuatro partes: `classify.ts` decide a qué estación va una llamada, `board.ts` guarda lo que pasó, `hooks.ts` escucha los eventos y `draw.ts` convierte el tablero en un SVG. `hooks/register.tsx` añade la sección al panel.

### Cada llamada va a una estación, solo por nombre

`classify(tool, input, setup)` lee el nombre de la herramienta y su entrada, y devuelve una estación y una etiqueta. La mayoría de las herramientas son un caso directo: `Read`, `Write` y `Edit` van a **Archivos**, `WebFetch` a **Red**, `Agent` a **Agentes**, `Skill` a **Skills**. Un archivo bajo `.claude/projects/<proyecto>/memory/` va a **Memoria**.

Los comandos de shell dan más trabajo, porque la herramienta siempre es `Bash` pero el trabajo no. `classifyShell` lee la primera palabra del comando, mira a través de los envoltorios (`sudo`, `env`, `timeout`, `nohup` y similares ejecutan otro comando, y ese es el que cuenta), y luego decide: `cat`, `grep` o `mv` trabajan con archivos, `curl`, `ssh` o `gh` salen a la red, y algunos programas salen a la red solo con ciertos subcomandos (`git push` sí, `git status` no; `npm install` sí, `npm test` no).

La etiqueta es lo que el mapa muestra junto a la estación, y solo lleva nombres:

- de un archivo, las dos últimas partes de su ruta (`src/app.ts`),
- de una página web, solo el dominio, nunca la ruta, la consulta ni un usuario (`hostOf` lee `user:pa/ss@host` como `host`),
- de un comando, su `description`, o si no su nombre,
- de una búsqueda web, las palabras `búsqueda web`, nunca la consulta.

`clean` además quita de cada etiqueta los caracteres de control y las marcas de dirección, para que un nombre de archivo no pueda mover el cursor ni invertir el texto. Un test lleva el nombre de esta regla: "labels never carry what was written, searched or a password" ("las etiquetas nunca llevan lo que se escribió, se buscó ni una contraseña").

### El tablero: un átomo, y una copia para dibujar

Lo que muestra el mapa es un `MapBoard` (en `types/index.d.ts`): una lista de entradas, un conteo por estación, el modelo y el paso, el porcentaje de contexto, los fallos por estación y los subagentes que siguen trabajando. Cada entrada tiene una estación, una etiqueta, un inicio y un fin, y un estado: `run`, `ok`, `err` o `block`.

El tablero es un átomo de la sesión, `board`, que escriben cuatro funciones pequeñas de `board.ts`: `begin` abre una entrada, `finish` la cierra, `background` la deja abierta con el id de una tarea, y `settle` la cierra cuando esa tarea avisa. El tablero guarda las 80 entradas más nuevas, más hasta 16 tareas en segundo plano más antiguas que siguen en marcha.

El panel no lee `board`. Lee `mapView`, una copia hecha como mucho cada 400 ms:

```ts
async function redraw($: EngineInterface): Promise<void> {
  if (isRedrawPending) return
  isRedrawPending = true
  try {
    await $.clock.sleep(REDRAW_MS)
  } catch {
    // No clock: copy now.
  } finally {
    isRedrawPending = false
  }
  const current = await read($, board)
  await update($, shown, () => current)
}
```

¿Por qué? Cada redibujado envía el SVG entero a la app, con las dos imágenes de Narsil. Una ráfaga de veinte llamadas serían veinte redibujados. Con la copia, la primera escritura inicia una espera de 400 ms, el resto de la ráfaga solo cambia `board`, y una sola copia al final las dibuja todas. El test "a burst of calls is one redraw of the map, made once the wait is over" lo comprueba.

### El mapa nunca hace esperar a una herramienta

Esta es la regla en la que insistió la revisión. El mapa escucha `tool.call`, que envuelve cada herramienta. Si esperara sus propias escrituras antes de llamar a `next(e)`, cada herramienta esperaría al mapa. Por eso la entrada se escribe a la vez que la llamada, no antes:

```ts
export async function mapToolCall($, e, next) {
  const started = quietly(async () => {
    const seen = classify(e.tool, e, SETUP)
    return begin($, { ...seen, from: e.agentId === undefined ? 'core' : 'agents' })
  })
  const close = (how) => {
    void started.then(how).catch(() => undefined)
  }
  try {
    const ran = await next(e)
    // ...refused, failed, sent to the background, or ok
    close((id) => finish($, id, ran.isError === true ? 'err' : 'ok'))
    return ran
  } catch (failure) {
    close((id) => finish($, id, 'err'))
    throw failure
  }
}
```

`next(e)` arranca de inmediato. La entrada se cierra cuando la llamada y la escritura terminaron, y ese cierre tampoco se espera. `quietly` envuelve cada escritura: lo que falle en el mapa devuelve `undefined` y nunca llega a la herramienta, al turno ni a la conversación. Cada hook pasa su evento sin cambios, así que el mapa nunca altera una entrada, un resultado ni una decisión de permisos.

Lo mismo vale para `classic.PreToolUse`: la decisión de los hooks de configuración se devuelve en cuanto está tomada, y el mapa escribe su entrada después. Una comprobación que tardó menos de 400 ms no se dibuja.

### Tres eventos compartidos con el resto del panel

El motor rechaza un segundo `on()` del mismo evento sin filtro en un mismo módulo. Narsil Check ya escuchaba `turn.start`, `tool.call` y `turn.complete`. Así que el mapa exporta esos tres como funciones, `mapTurnStart`, `mapToolCall` y `mapTurnComplete`, y `register.tsx` llama a cada una en lugar de `next(e)`:

```tsx
on('tool.call', async ($, e, next) => {
  // ...what the pane already tracked
  return mapToolCall($, e, next)
})
```

Los demás eventos que necesita el mapa (`turn.step`, `classic.PreToolUse`, `prompt.submit`, `skill.prompt`, `session.compact` y los hooks de configuración que añaden contexto) se registran en `registerMap(on)`, que `register` llama primero.

### Fallos, turnos y tareas en segundo plano

- Un **mensaje nuevo** tuyo borra los fallos: los puntos rojos hablan del camino hacia la última respuesta.
- Un **turno interrumpido** cae en **Tú** y no es culpa de nada. También cierra las llamadas que nunca avisaron, para que no sigan latiendo el resto de la sesión.
- Una llamada cuya respuesta inicia **trabajo en segundo plano** (`backgroundTaskId`, o un agente con `status: 'async_launched'`) queda abierta con el id de esa tarea. `taskNotice` lee el aviso de la tarea solo para su id y su estado, nunca su resumen ni su salida, y `settle` cierra la entrada.
- Un **subagente** entra en la lista `agents` con su primera llamada y sale cuando llega su propio `turn.complete`.

### El dibujo: un SVG, con Narsil bebé en el centro

`drawMap(board, now, narsil)` devuelve una cadena de SVG. Su animación es SMIL dentro del SVG (`<animate>` con tiempos de inicio relativos a `now`), así que el dibujo se mueve entre redibujados sin ayuda del mod. Se dibuja con la paleta oscura, y una regla `prefers-color-scheme: light` dentro del SVG repinta cada color, así que el mapa sigue el tema de la app por sí solo, como hacía la imagen de Narsil.

El elemento `Svg` acepta como mucho 131072 caracteres, y las dos imágenes de Narsil ocupan unos 88 KB de eso. `drawMap` mide la longitud: si las imágenes llevaran el dibujo por encima del límite, vuelve a dibujar el mapa con `NARSIL` escrito en el centro. El mapa siempre aparece. El test "the map at its fullest, with baby Narsil, stays within what Svg accepts" dibuja el tablero más lleno posible.

Para quien no puede verlo, `describeMap` da el texto `alt`: la sección, lo que está en marcha y el contexto, por ejemplo `Mapa mental. Archivos: src/app.ts · contexto 13%`.

En el panel, la sección solo se dibuja cuando la superficie tiene `Svg` y no es la terminal. Se abre al empezar cada sesión, y `resetMap()` olvida los rechazos y el último modelo de la sesión anterior.

## Constrúyelo con Claude

Pídele a Claude un mapa del trabajo de la sesión como sección del panel. Las dos ideas que tiene que acertar son que el mapa nunca hace esperar a una herramienta, y que muestra nombres, nunca contenido.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil Check.

> En mi mod de Claude Code `my-panel`, añade una primera sección, `Map`, que dibuje lo que hace Claude en esta sesión como un solo SVG: un núcleo en el centro y estaciones alrededor (tú, modelo, memoria, archivos, shell, red, navegador, agentes, skills, hooks). Clasifica cada `tool.call` en una estación con una etiqueta que solo lleve nombres: las dos últimas partes de la ruta de un archivo, el dominio de una URL, la descripción de un comando. Guarda el tablero en un átomo de la sesión (entradas con estación, etiqueta, inicio, fin y estado `run`, `ok`, `err` o `block`, un conteo por estación, fallos por estación) y haz que el panel lea una copia hecha como mucho cada 400 ms. La herramienta nunca debe esperar al mapa: arranca `next(e)` de inmediato, escribe la entrada a la vez y envuelve cada escritura para que un fallo nunca llegue a la herramienta. Anima con SMIL dentro del SVG, sigue el tema de la app con una regla `prefers-color-scheme`, mantén el SVG por debajo de 131072 caracteres y deja la sección fuera en la terminal. Prueba que una llamada no espera al tablero, que una ráfaga de llamadas es un solo redibujado y que ninguna etiqueta lleva una consulta, una ruta de más de dos partes ni una contraseña.

### Qué revisar en la respuesta de Claude

1. `next(e)` se llama antes de esperar la escritura del mapa, y ninguna escritura del mapa se espera en el camino de la herramienta.
2. Cada escritura del mapa está envuelta para tragarse los errores, y cada hook devuelve el resultado de su evento sin cambios.
3. Las etiquetas son nombres: dos partes de ruta, un dominio, una descripción. No aparecen consultas de búsqueda, rutas de páginas ni el texto de los comandos.
4. El panel lee una copia limitada del tablero, no el tablero mismo.
5. La longitud del SVG se compara con el límite de `Svg`, con una alternativa más pequeña.
6. La sección no aparece donde falta `Svg` o la superficie es la terminal.

Si una comprobación falla, dile a Claude lo que ves: "con el mapa activo, una lectura lenta de un archivo hizo que todas las llamadas tardaran más" o "el mapa mostró mi búsqueda entera junto a Red".

### Cómo lo pidió el autor

El registro de la tarea, `odd/tasks/work-map.md` en narsil-check, cita las peticiones palabra por palabra.

Primero el autor le mostró lot-map a Claude:

> "mira este mod, quisiera traer la funcionalidad aca, como lo ves? https://github.com/alexeyw/lot-map"

Claude propuso partes que Narsil ya tenía, y el autor acotó:

> "lo que propones traer ya lo tengo en narsilPet, me interesa traer es el mapa animado"

Luego aceptó el plan y decidió dónde iba la sección:

> "sí, avanza con ese plan, la seccion mapa va a ir de primeras, quita la imagen de narsil bebe y ponlo ahi, ya que es la misma imagen que ira creo que sera un buen reemplazo"

Una revisión de la primera versión dejó cinco avisos: el panel redibujaba el SVG entero en cada escritura, la herramienta esperaba al mapa, un camino muerto para el movimiento reducido, caminos de fallos y de tareas sin probar, y entradas en segundo plano que nunca caducaban. La respuesta del autor fue "Sí, corrígelos". Los commits de la rama de la funcionalidad muestran el orden:

- `bcae0da` "feat(map): classify Claude's work into the work map's stations".
- `e8b29dd` "feat(map): add the animated work map as the pane's first section".
- `4ee05ed` "fix(map): keep the work map off the tool's path and its redraws bounded".
- `1c6677c` "feat(map): larger, higher-contrast work map named Mapa mental".

El commit del arreglo, `4ee05ed`, es el que más enseña. La primera versión funcionaba y sus tests pasaban. La revisión preguntó cuánto le cuesta el mapa al resto de la sesión, y la respuesta fue una copia limitada y una herramienta que nunca espera.

Tras probar la versión 1.12.0, el autor pidió un mapa que se leyera mejor:

> "las esferas deberian ser mas grandes al igual que el texto, o tener mas contraste ya que no se ve claramente lo que dice, narsil bebe tambien podria ser algo mas grande"

Y luego: "y al mapa ponle mapa mental". Eso es `1c6677c`: estaciones, nombres y conteos más grandes, colores de las etiquetas con más contraste en cada tema, una Narsil bebé más grande sobre un azul suave, y la sección renombrada **Mapa mental**.

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Es una versión reducida de `hooks/map/board.ts` y `hooks/map/hooks.ts` de [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later), que adaptan [lot-map](https://github.com/alexeyw/lot-map) (MIT, Copyright © 2026 Aleksei Volodin). Está comprobada con los tipos de Claude Code 2.1.325 (`atom`, `read`, `update`, `$.clock.now`, `$.clock.sleep`, el hook `tool.call`). Conserva una sola regla de estaciones y deja fuera el dibujo, los fallos y las tareas en segundo plano.

```ts
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

type Status = 'run' | 'ok' | 'err' | 'block'
type Entry = {
  id: string
  station: string
  label: string
  startedAt: number
  endedAt?: number
  status: Status
}
type Board = { entries: Entry[]; counts: Record<string, number> }

const EMPTY: Board = { entries: [], counts: {} }
const board = atom({ plugin: 'my-panel', key: 'board' } as const, EMPTY, { shape: 'board-1' })
const shown = atom({ plugin: 'my-panel', key: 'mapView' } as const, EMPTY, { shape: 'board-1' })

async function quietly<T>(work: () => Promise<T>): Promise<T | undefined> {
  try {
    return await work()
  } catch {
    return undefined
  }
}

let isRedrawPending = false
async function redraw($: EngineInterface): Promise<void> {
  if (isRedrawPending) return
  isRedrawPending = true
  try {
    await $.clock.sleep(400)
  } catch {
    // No clock: copy now.
  } finally {
    isRedrawPending = false
  }
  const current = await read($, board)
  await update($, shown, () => current)
}

async function write($: EngineInterface, by: (b: Board) => Board): Promise<void> {
  await update($, board, by)
  void redraw($).catch(() => undefined)
}

const lastTwo = (path: string): string =>
  path.replace(/\\/g, '/').split('/').filter(Boolean).slice(-2).join('/')

function classify(
  tool: string,
  input: Record<string, unknown>,
): { station: string; label: string } {
  const path = typeof input.file_path === 'string' ? input.file_path : ''
  if (tool === 'Read' || tool === 'Write' || tool === 'Edit')
    return { station: 'files', label: lastTwo(path) || tool }
  if (tool === 'WebSearch') return { station: 'web', label: 'web search' }
  return { station: 'model', label: tool }
}

export const register: Register = (on) => {
  on('tool.call', async ($, e, next) => {
    const started = quietly(async () => {
      const now = await $.clock.now()
      const entry: Entry = {
        id: `${now}-${Math.random()}`,
        ...classify(e.tool, e as Record<string, unknown>),
        startedAt: now,
        status: 'run',
      }
      await write($, (b) => ({
        entries: [...b.entries, entry].slice(-80),
        counts: { ...b.counts, [entry.station]: (b.counts[entry.station] ?? 0) + 1 },
      }))
      return entry.id
    })
    const close = (status: Status): void => {
      void started
        .then((id) =>
          quietly(async () => {
            const now = await $.clock.now()
            await write($, (b) => ({
              ...b,
              entries: b.entries.map((x) => (x.id === id ? { ...x, status, endedAt: now } : x)),
            }))
          }),
        )
        .catch(() => undefined)
    }
    try {
      const ran = await next(e)
      close(ran.deny !== undefined ? 'block' : ran.isError === true ? 'err' : 'ok')
      return ran
    } catch (failure) {
      close('err')
      throw failure
    }
  })
}
```

El panel lee `shown` con `read($, shown)` y lo dibuja con `Svg` solo cuando la superficie lo tiene y no es la terminal.

## Errores comunes y cómo probarlo

Salen del código de Narsil Check, de su revisión y de sus tests:

- **Esperar al mapa antes de la herramienta.** Cada llamada se vuelve más lenta. Arranca `next(e)` primero y escribe a la vez.
- **Dejar escapar un error del mapa.** Una escritura fallida haría fallar la herramienta. Envuelve cada escritura.
- **Redibujar en cada escritura.** Una ráfaga de llamadas se convierte en una ráfaga de SVG grandes. Limita una copia.
- **Mostrar contenido.** Una búsqueda, la ruta de una URL o una línea de comando pueden llevar secretos. Muestra solo nombres y limpia los caracteres de control.
- **Llamadas que nunca se cierran.** Un turno interrumpido o un aviso perdido dejan una entrada latiendo para siempre. Ciérralas al final del turno y caduca las tareas en segundo plano viejas.
- **Registrar un evento dos veces en un módulo.** El motor lo rechaza. Llama a la función del mapa desde el hook que ya existe.
- **Olvidar el límite de `Svg`.** Las imágenes incrustadas pesan. Mide, y ten una alternativa.

Para probarlo, `claude plugin test .` ejecuta los tests del mod. `tests/map.test.tsx` cubre las partes puras: "every kind of call lands on its station", "a command behind a wrapper or inside another is the command it runs" y "labels never carry what was written, searched or a password". `tests/map-pane.test.tsx` maneja los hooks: "a tool never waits on the map", "a burst of calls is one redraw of the map, made once the wait is over", "a refused call turns the map red with a dot on its station, and the next message clears it" y "a background task that never reports back is closed at the end of a turn once it is an hour old". En `tests/pane.test.tsx`, "the work map is the first section, open, with baby Narsil at its core; the terminal draws neither" comprueba el lugar de la sección.

## Para ir más lejos

- Deja que cada persona nombre sus propios servidores o comandos de memoria: `hooks/map/stations.ts` conserva la configuración de lot-map, con todas las listas vacías.
- Adapta la lista de filas de lot-map, un listado de texto de las últimas acciones, para la terminal, donde el SVG no se dibuja.
- Añade un zoom o un filtro de estaciones, que lot-map tiene y esta adaptación dejó fuera.
