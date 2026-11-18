---
title: Todas las conversaciones en un solo lugar
description: 'Cómo Narsil reúne el estado de cada conversación abierta en un hub local, las ordena con el error primero, las pagina de cuatro en cuatro y olvida las silenciosas al cabo de una hora.'
route: pet
order: 3
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/fleet.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: overlay/server.cjs
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
  - repo: pet
    path: tests/overlay-server.check.cjs
---

## Qué hace

Si tienes abiertas varias conversaciones de Claude Code, cada una tiene su propia banda. Narsil hace que cada banda las muestre todas.

Hay una sola Narsil para todas tus conversaciones. Su dibujo y su titular muestran la más importante, en este orden: primero un `ERROR`, después lo que `TE NECESITA`, después lo que está `TRABAJANDO` y por último lo que está `TERMINADA`. Cuando esa conversación no es la que estás mirando, el titular empieza con su nombre, por ejemplo "web: Me he detenido por un error". Así, una conversación atascada en una pregunta en otra ventana aparece en la que estás escribiendo.

Debajo de ella, la banda enumera todas las conversaciones, una fila por cada una: su estado, su nombre y su propia barra de contexto con un porcentaje. La conversación actual va siempre primero, y su barra es azul para que la encuentres. Las filas aparecen de cuatro en cuatro, con botones ◂ y ▸ para pasar de página ("Conversaciones 1/2").

Al pulsar el nombre de una conversación, esta se abre bajo una línea: sus tareas, sus subagentes y, a partir de su porcentaje, qué llena su contexto. La siguiente guía trata las tareas y los subagentes.

Una conversación que no has abierto desde hace un rato se queda en la lista con su último estado durante una hora, aunque la app de escritorio la haya puesto a dormir. Tras una hora sin noticias sale de la lista, y así es también como desaparecen las conversaciones eliminadas. Si vuelves a abrirla, regresa enseguida.

## Cómo funciona por dentro

### El problema: cada conversación está sola

Un mod se ejecuta una vez por conversación. La Narsil de una conversación no puede ver los átomos de la Narsil de otra. Para mostrar todas las conversaciones, algo que esté fuera de ellas tiene que reunir los estados y devolver la lista.

Narsil ya tenía algo así: el pequeño servidor local que hay detrás de su ventana flotante. El README dice que cada conversación envía su estado a "un pequeño servidor local (el de la ventana flotante)", que arranca con la primera conversación aunque la ventana esté desactivada. Ese servidor es el hub, el punto central.

### El hub: un script de Node

`overlay/server.cjs` es un script normal de Node.js, no código de mod. Usa el módulo `http` de Node, guarda una entrada por conversación en un `Map` llamado `sessions` y llama a `server.listen(port, '127.0.0.1', ...)`, así que solo escucha en la dirección local de loopback. El puerto es `47190` salvo que `NARSIL_PORT` diga otra cosa.

Responde, entre otras, a:

- **`POST /state`**: una conversación informa de su estado. La entrada se guarda con la hora a la que llegó (`at`) y la hora en que cambió por última vez algo de lo que se muestra (`changedAt`). Los latidos que no cambian nada no se transmiten a la página de la ventana flotante.
- **`GET /sessions`**: la lista de todas las conversaciones vivas, la más importante primero, sin los dibujos (cada mod dibuja su propia Narsil).

Las dos necesitan el token del mod en la cabecera `x-narsil-token`. El token es un UUID aleatorio que el mod guarda en `$.store` (`overlayToken` en `hooks/register.tsx`) y pasa al servidor en la variable de entorno `NARSIL_TOKEN` cuando lo arranca. El servidor también comprueba la cabecera `Host` y rechaza cualquier nombre distinto de `127.0.0.1` y `localhost`. La guía de la ventana flotante trata estas protecciones en detalle.

Dos temporizadores mantienen la lista al día:

- `SESSION_FORGET_MS = 60 * 60_000`: `forgetSilent` elimina una conversación una hora después de su último latido.
- `HEARTBEAT_TIMEOUT_MS = 30_000`: cuando ninguna conversación ha latido durante 30 segundos, el servidor se apaga solo. La siguiente conversación lo vuelve a arrancar.

### El lado del mod: un latido

En `session.start`, Narsil arranca el hub poco después de que empiece la sesión (`$.clock.after(10, () => startOverlay($))`) y después late cada dos segundos (`$.clock.every(2000, () => beat($))`). `startOverlay` hace primero un ping al servidor; si responde un servidor de una versión anterior (dice algo distinto de `narsil 4`), lo detiene y arranca uno nuevo. En Windows lanza `node` con `overlay/server.cjs` mediante `Start-Process` de PowerShell; en macOS ejecuta `overlay/start.sh`.

Cada `beat` hace, entre otras tareas de mantenimiento:

1. `pushOverlay`: `POST /state` con el estado de esta conversación, construido por `shownState` (id, título, ánimo, estado, titular, contexto, tareas, chips de subagentes y más). El dibujo solo se envía cuando cambió; un servidor que no tiene ninguno responde `need-svg`.
2. `readSessions`: `GET /sessions`, limpiado campo por campo y escrito en el átomo `sessions` solo cuando difiere de lo que ya hay.

Cada cambio de ánimo llama además a `pushOverlay` en el acto, a través de `setMood`, para que el hub no espere al siguiente latido.

El id de la conversación sale de la variable de entorno `CLAUDE_CODE_HOST_SESSION_ID`, que se lee en `session.start`. `ownId` solo lo acepta cuando tiene la forma `local_` seguida de letras, dígitos y guiones, y en otro caso usa `local_unknown`. El enlace `claude://code/continue` de la app de escritorio abre una conversación por ese id, y así funciona el botón "abrir" de la ventana flotante.

### El orden: `hooks/fleet.ts`

La lógica de la lista es un archivo aparte de funciones puras, `hooks/fleet.ts`, sin eventos y sin `$`. Eso facilita probarla y compartirla con la banda y la ventana.

- `RANK` da a cada estado su lugar: `error` 0, `waiting` 1, `working` 2, `done` 3, `idle` 4. El servidor usa el mismo orden (`PRIORITY` en `overlay/server.cjs`).
- `fleetOf(hub, own)` toma la lista del hub, sustituye la entrada de esta conversación por una recién calculada (la copia del hub puede tener hasta un latido de antigüedad) y ordena por rango y después por el cambio más reciente. La primera entrada es la que Narsil lleva puesta.
- `ownFirst(list, ownId)` mueve esta conversación al principio de las filas, sea cual sea su estado, para que siempre la encuentres en el mismo sitio.
- `pageOf(list, page)` corta la lista en páginas de `FLEET_PAGE = 4` y mantiene el número de página dentro del rango cuando las conversaciones van y vienen.
- `fit(text, cells)` corta o rellena un título hasta `TITLE_CELLS` (26) caracteres, para que todas las barras de contexto empiecen en la misma columna.
- `openOf` y `toggleOpen` deciden qué conversación está abierta. `open: null` significa "esta, por defecto"; una cadena vacía significa "ninguna".

Qué muestra abierto la banda, en qué página está y si se ve el desglose del contexto viven en otro átomo, `view` (`fleetView` en `hooks/register.tsx`), así que pulsar ◂ o un nombre es solo un `update` de ese átomo.

### Por qué se tomó cada decisión

- **El error antes que te necesita, antes que trabajando, antes que terminado.** La petición de quien creó Narsil las ordena así (ver más abajo): el dibujo es ante todo un aviso, así que lo que falló o te espera va por delante de lo que solo está ocupado.
- **La conversación propia primero en las filas, pero no en el dibujo.** El dibujo responde "¿dónde se me necesita?"; las filas responden "¿dónde está esta?". Mantener las dos cosas permite que el titular salte a otra conversación mientras la lista se queda estable.
- **Páginas en lugar de desplazamiento.** La especificación S3 del registro de tareas dice "The band cannot scroll (Box overflow is only visible/hidden): it pages instead." (la banda no puede desplazarse, porque el desbordamiento de Box solo es visible u oculto, así que pagina en su lugar). Los tipos de 2.1.325 describen ahora la banda `AbovePrompt` desplazando un árbol más alto que su `maxRows`; Narsil sigue paginando, y la ventana flotante, que es una página web, se desplaza.
- **Una hora, ni 30 segundos ni para siempre.** El historial de commits muestra que la caducidad se ajustó dos veces. `2ce3acb` (2026-11-07) "fix: keep sleeping conversations listed in the hub" (mantener en la lista del hub las conversaciones dormidas) explica que la app de escritorio pone a dormir el motor de una conversación que no has abierto desde hace un rato, así que sus latidos se detienen y el hub la eliminaba a los 30 segundos. La corrección mantuvo cada conversación mientras el servidor siguiera en marcha. Después `570961d` (2026-11-10) "fix: forget conversations silent for an hour in the hub" (olvidar en el hub las conversaciones silenciosas durante una hora) dice que las eliminadas se acumulaban, y se quedó en una hora: suficiente para una dormida, lo bastante corta para que una eliminada se vaya.
- **La copia que el hub tiene de ti se sustituye.** `fleetOf` y `ownEntry` usan el estado recién calculado de esta conversación, y conservan el `changedAt` del hub solo mientras el estado se mantiene, así que tu propia fila nunca va un latido por detrás.

## Constrúyelo con Claude

Pídele a Claude un pequeño hub local que reúna el estado de todas las conversaciones, y el código del mod que le informa y lee la lista de vuelta. La idea que Claude debe acertar: cada conversación ejecuta su propia copia del mod y no puede ver las demás, así que el hub es el único lugar donde se encuentran.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil.

> Mi mod de Claude Code `my-pet` muestra el estado de una conversación en la banda `AbovePrompt`. Haz que muestre todas las conversaciones abiertas. Escribe un pequeño hub de Node.js (`hub.cjs`) que escuche solo en 127.0.0.1, reciba `POST /state` y sirva `GET /sessions`, los dos protegidos por un token aleatorio que el mod guarda en `$.store`, y que olvide una conversación una hora después de su último informe. En el mod, informa del estado de esta conversación cada dos segundos con `$.clock.every` y `$.http.fetch`, lee la lista de vuelta en un átomo y deja el orden y la paginación como funciones puras en `hooks/fleet.ts`: error, después esperando, después trabajando, después terminado, después en reposo, el cambio más reciente primero, cuatro filas por página. Dibuja arriba el estado de la conversación más importante y las filas debajo, con esta conversación primero. Añade tests para el orden, la paginación y la caducidad.

### Qué revisar en la respuesta de Claude

1. El hub escucha solo en `127.0.0.1`, y tanto `POST /state` como `GET /sessions` necesitan el token que el mod guarda en `$.store`.
2. El hub olvida una conversación una hora después de su último informe: no a los pocos segundos, y no nunca.
3. El orden es error, después esperando, después trabajando, después terminado, después en reposo, el cambio más reciente primero, y el estado reciente de esta conversación sustituye a la copia del hub antes de ordenar.
4. Las filas van de cuatro en cuatro por página, y el número de página se mantiene dentro del rango cuando se van conversaciones.
5. Un `$.http.fetch` fallido se captura y se conserva la última lista, y el átomo se escribe solo cuando la lista cambió.

Si una comprobación falla, dile a Claude lo que ves: "una conversación que llevo un rato sin abrir desaparece de la lista", o "la página 2 queda vacía después de cerrar dos conversaciones".

### Cómo lo pidió el autor

Esta funcionalidad tiene un registro de tareas público: `odd/tasks/fleet-view.md` en narsil-pet, entradas L1 a L13. Cita palabra por palabra las peticiones de quien creó Narsil.

La petición original, L1, con fecha 2026-11-06:

> "quiero hacerlo en los dos y tambien en la ventana externa, el diseno lo pensamos luego, quisiera poder mostrar todas las sesiones en curso y sus estados, la imagen de narsil solo mostraria lo mas importante error->te necesita-> trabajando--> termine, y las notificaciones se enviarian al celular cuando se pida algo desde el celular como ahora y haya cambios, es decir alguna tarea pase de trabajando a terminado, o de trabajando a error, etc, (eliminariamos la alerta de bucle, no la he sentido tan util) las notificaciones del celular cuando se envien llevarian la info de todas las sesiones funcionando en ese momento, algo asi es mi idea, como lo hacemos? los consejos seguirian funcionando como ahora en cada ventana"

"Los dos" se refiere a la banda y al escritorio.

Las correcciones que siguieron, y lo que cambiaron:

- **L2** (extracto): "deberiamos ver en la ventana principal tanto en la banda como la ventana externa el estado de todas las conversaciones, con scroll si son muchas, [...] donde ponemos las barras de cada conversacion con su porcentaje de avance y con sus estados? al hacer click en el titulo de conversacion deberiamos poder ver sus sub agentes/ tareas y sus respectivos estados". La misma entrada quita la sección final de "conversaciones abiertas" y la sección de dinero, y mantiene la caché. De aquí salieron las filas, los títulos que se pueden pulsar y el detalle de la conversación abierta; como la banda no podía desplazarse, se convirtió en paginación.
- **L3**: "entonces otro cambio, me parece bien lo que me dices del contexto, entonces la barra de contexto general tambien se iria por que no existe un contexto general y se reemplazaria por las barras de contexto de cada conversacion, el avance entonces no existe cuando entre a una de esas conversaciones estaria de nuevo su contexto, sus tareas con su estado (no es necesario barra de avance) y sus sub agentes, al clickear aca su contexto veria como se lleno su propio contexto y ya". Esto quitó la barra de contexto general y puso una barra en cada fila.
- **L4** recoge el diseño acordado: Narsil y el titular de la conversación que importa arriba, los límites de la cuenta una sola vez, la lista de conversaciones, una fila que se abre a su contexto, tareas y subagentes, y "The band pages 4 rows at a time." (la banda pagina de 4 en 4 filas).
- **L6 a L11** registran cada tarea como hecha, con su evidencia. L6 describe el hub: el servidor ahora arranca con cada conversación, haya ventana o no, y `GET /sessions` (solo con token) enumera todas las conversaciones vivas, "error first, then waiting, working, done, idle" (el error primero, después esperando, trabajando, terminado y en reposo).
- **L12** y **L13** informan de un fallo con los estados de las tareas y lo corrigen, como se explica en la siguiente guía.

La caducidad de una hora no formaba parte del registro; llegó después, en los dos commits descritos arriba.

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Escrito para esta guía. El orden y la paginación están adaptados de `hooks/fleet.ts`, y la caducidad y el orden del hub de `overlay/server.cjs`, ambos de [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later).

La parte pura, `hooks/fleet.ts`:

```ts
import type { Entry, Status } from '../types' // Entry: { sessionId: string; status: Status; headline: string; changedAt: number }

export const PAGE = 4
const RANK: Record<Status, number> = { error: 0, waiting: 1, working: 2, done: 3, idle: 4 }

export function ranked(hub: readonly Entry[], own: Entry): Entry[] {
  return [own, ...hub.filter((s) => s.sessionId !== own.sessionId)].sort(
    (a, b) => RANK[a.status] - RANK[b.status] || b.changedAt - a.changedAt,
  )
}

export function pageOf(list: readonly Entry[], page: number) {
  const pages = Math.max(1, Math.ceil(list.length / PAGE))
  const at = Math.min(Math.max(0, page), pages - 1)
  return { rows: list.slice(at * PAGE, (at + 1) * PAGE), page: at, pages }
}
```

El latido del mod, en `hooks/register.tsx` (el átomo `fleet` contiene la lista del hub y está declarado en `types/index.d.ts`; `ownEntry` construye la entrada de esta conversación a partir de tu átomo de estado):

```ts
const HUB = 'http://127.0.0.1:47191'

async function token($: EngineInterface): Promise<string> {
  const saved = await $.store.get('hubToken')
  if (typeof saved === 'string' && saved) return saved
  const fresh = crypto.randomUUID()
  await $.store.set('hubToken', fresh)
  return fresh
}

async function beat($: EngineInterface): Promise<void> {
  const headers = { 'content-type': 'application/json', 'x-my-pet-token': await token($) }
  try {
    await $.http.fetch(`${HUB}/state`, {
      method: 'POST',
      headers,
      body: JSON.stringify(await ownEntry($)),
    })
    const { ok, text } = await $.http.fetch(`${HUB}/sessions`, { headers })
    if (ok) await update($, fleet, () => JSON.parse(text))
  } catch {
    // the hub is out of reach: keep the last list
  }
}

// in register:
on('session.start', async ($, e, next) => {
  $.clock.every(2000, () => beat($))
  return next(e)
})
```

Para el id de `ownEntry`, `$.session.id()` devuelve el id de la sesión (el nombre del archivo de la transcripción). Narsil usa en su lugar `CLAUDE_CODE_HOST_SESSION_ID` porque necesita el id `local_` de la app de escritorio para abrir la conversación desde un enlace.

El hub, `overlay/hub.cjs`, es Node.js normal, no API de mods. El mod lo arranca con `$.process.run`, pasando el token como `MY_PET_TOKEN` en `env`; `startOverlay` de Narsil muestra cómo lanzarlo separado del proceso en Windows y macOS.

```js
'use strict'
const http = require('http')
const token = process.env.MY_PET_TOKEN || ''
const RANK = { error: 0, waiting: 1, working: 2, done: 3, idle: 4 }
const FORGET_MS = 60 * 60_000
const sessions = new Map()

http
  .createServer((req, res) => {
    if (!token || req.headers['x-my-pet-token'] !== token) return res.writeHead(403).end()
    if (req.method === 'GET' && req.url === '/sessions') {
      const now = Date.now()
      for (const [id, s] of sessions) if (now - s.at > FORGET_MS) sessions.delete(id)
      const list = [...sessions.values()].sort(
        (a, b) => (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9) || b.changedAt - a.changedAt,
      )
      return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(list))
    }
    if (req.method !== 'POST' || req.url !== '/state') return res.writeHead(404).end()
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 100_000) req.destroy()
    })
    req.on('end', () => {
      try {
        const s = JSON.parse(body)
        const before = sessions.get(String(s.sessionId))
        const changedAt = before && before.status === s.status ? before.changedAt : Date.now()
        sessions.set(String(s.sessionId), { ...s, at: Date.now(), changedAt })
        res.writeHead(204).end()
      } catch {
        res.writeHead(400).end()
      }
    })
  })
  .listen(47191, '127.0.0.1')
```

Este esbozo deja fuera lo que añade el servidor real: la comprobación de `Host`, el apagado cuando todas las conversaciones están en silencio y la ventana flotante. No amplíes `'127.0.0.1'` a todas las interfaces; la guía posterior sobre la ventana flotante explica por qué existe cada protección.

## Errores comunes y cómo probarlo

- **Eliminar las conversaciones dormidas.** La app de escritorio detiene el motor de una conversación que no has abierto desde hace un rato, así que sus latidos se detienen aunque siga existiendo. Un tiempo de espera corto vacía tu lista (`2ce3acb`).
- **No olvidar nunca.** Mantener cada conversación mientras el hub siga en marcha llena la lista de conversaciones eliminadas (`570961d`). Haz que caduquen según el tiempo desde el último latido, y deja que el primer latido nuevo las vuelva a listar.
- **Mostrar tu propia conversación un latido tarde.** La copia del hub tiene hasta un latido de antigüedad. Combina tu entrada recién calculada antes de ordenar, como hace `fleetOf`.
- **Una página que ya no existe.** Cuando salen conversaciones, la página guardada puede apuntar más allá del final. Limítala, como hace `pageOf`.
- **Reescribir el átomo en cada latido.** Cada `update` vuelve a dibujar la banda. Narsil compara la lista nueva con la anterior y solo escribe si hay diferencias.
- **Lanzar un error cuando el hub está caído.** Un `$.http.fetch` fallido no debe romper el mod. Narsil lo captura, conserva la última lista e intenta arrancar el hub de nuevo como mucho una vez por minuto (`ensureOverlay`).
- **Un hub antiguo que responde por un mod nuevo.** El servidor sobrevive a las actualizaciones del mod. El `/ping` de Narsil responde con una cadena de protocolo (`narsil 4`), y el mod sustituye a un servidor que responda otra.
- **Varias terminales sin id de host.** `ownId` recurre a `local_unknown` cuando `CLAUDE_CODE_HOST_SESSION_ID` falta o no coincide, y el servidor hace lo mismo, así que esas conversaciones comparten una entrada.

Para probar el mod, `claude plugin test .` ejecuta `tests/narsil.test.tsx`, que alimenta un hub inventado mediante un `$.http.fetch` simulado. Fíjate en "the band lists every open conversation with its state and context, and Narsil wears the most important" (la banda enumera cada conversación abierta con su estado y su contexto, y Narsil lleva puesta la más importante) y en "the band pages through many conversations, four at a time" (la banda pagina muchas conversaciones, de cuatro en cuatro), que pulsa el botón `page-next` y comprueba "Conversaciones 2/2". Para probar el servidor, `node tests/overlay-server.check.cjs` arranca el script real y comprueba, entre otras cosas, "every conversation is served to the mods alone, the most important first, without drawings" (cada conversación se sirve solo a los mods, la más importante primero, sin dibujos) y "a conversation that stops beating stays listed for an hour, then goes until it beats again" (una conversación que deja de latir sigue en la lista una hora y después se va hasta que vuelva a latir), que adelanta `Date.now` 59 y 61 minutos.

## Para ir más lejos

- `hooks/fleet.ts` tiene también `countOfStates`, que `/narsil estado` usa para decir cuántas conversaciones hay en cada estado.
- El hook `ui.render` sobre `AbovePrompt` en `hooks/register.tsx` dibuja las filas: una columna de estado de ancho fijo, el título como un `Button` que llama a `toggleOpen`, `textBar` para el contexto, el porcentaje como botón para la conversación abierta y el reloj de la caché. Mientras hay próximos pasos ofrecidos, todas las filas empiezan cerradas para que se vean los pasos; al abrir una fila, los pasos se ocultan, y vuelven cuando cierras todas otra vez.
- `shownState` es la entrada completa que envía cada conversación; `readSessions` muestra cómo validar campo por campo lo que vuelve del hub.
- `overlay/server.cjs` también difunde la lista a la ventana flotante mediante server-sent events (`GET /events`), abre la ventana cuando un evento te espera y sirve su página. La guía de la ventana flotante lo trata.
- Los avisos del teléfono usan la misma lista: `fleetNow` y `fleetText` terminan cada aviso con todas las conversaciones abiertas y su estado.
