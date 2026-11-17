---
title: La ventana flotante
description: 'Cómo Narsil muestra una ventana siempre visible cuando Claude está minimizado o algo te espera, y por qué su servidor local solo escucha en 127.0.0.1 tras una clave de página y un token del mod.'
route: pet
order: 5
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: overlay/server.cjs
  - repo: pet
    path: overlay/overlay.html
  - repo: pet
    path: overlay/watch.ps1
  - repo: pet
    path: overlay/mac-claude.js
  - repo: pet
    path: overlay/start.sh
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: odd/tasks/animated-poses.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/overlay-server.check.cjs
---

## Qué hace

La banda que hay sobre el prompt solo ayuda mientras miras Claude. En cuanto lo minimizas para leer una página o responder un mensaje, un turno terminado o una pregunta pasan desapercibidos.

La ventana flotante cubre ese hueco. Es una ventana pequeña, de 330 por 450 píxeles, que:

- **Aparece cuando Claude está minimizado** (o cerrado), y **se oculta sola** cuando vuelves a Claude.
- **Aparece cuando algo te espera**, aunque Claude solo esté detrás de otra app: una pregunta, un permiso, un error o un turno terminado.
- **Se queda encima** de las demás ventanas en Windows, en la esquina de la pantalla en la que está Claude, sin quitar el foco del teclado a lo que estás haciendo.
- Muestra a Narsil con la conversación más importante (o aquella cuyo aviso está esperando), los límites de la cuenta y todas las conversaciones abiertas en una lista que se desplaza. Al pulsar una conversación se abren su contexto, sus tareas, sus subagentes, su caché y sus próximos pasos, con un botón que trae esa conversación al frente en la app de escritorio.

Un aviso de "terminado" se va solo a los 20 segundos; una pregunta o un error se quedan hasta que miras Claude o los descartas. Si cierras la ventana, el siguiente aviso la vuelve a traer, pero no antes de un minuto después de cerrarla. `/narsil flotante` activa o desactiva la ventana, y `/narsil prueba` envía un aviso de prueba que se muestra incluso mientras miras Claude.

En macOS la ventana se comporta un poco distinto, como explica el README: se abre y se cierra en lugar de ocultarse (ocultar la ventana de otra app necesitaría el permiso de accesibilidad), se abre detrás de la app en uso y no se queda encima. El navegador recuerda dónde la pusiste. En otros sistemas no hay ventana; quedan la banda, la voz y las notificaciones de Claude Code.

## Cómo funciona por dentro

Cuatro piezas, cada una con un trabajo:

| Pieza                                        | Qué es                                      | Su trabajo                                                                                  |
| -------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| El mod (`hooks/register.tsx`)                | Código de mod, uno por conversación         | Arranca el hub, informa del estado de esta conversación, envía avisos                       |
| El hub (`overlay/server.cjs`)                | Un script normal de Node.js                 | Guarda el estado de cada conversación, sirve la página, decide cuándo se muestra la ventana |
| La página (`overlay/overlay.html`)           | Una página web en una ventana del navegador | Dibuja a Narsil y la lista, devuelve tus pulsaciones                                        |
| El vigilante (`watch.ps1` o `mac-claude.js`) | Un script del sistema                       | Vigila la ventana de Claude y muestra, oculta o coloca la ventana del navegador             |

El hub es el mismo servidor que la guía anterior llama hub: reúne el estado de cada conversación. Esta guía mira su otra mitad, la ventana.

### Arrancar el hub y la ventana

En `session.start` el mod llama a `startOverlay` un momento después de que empiece la sesión. Hace un ping a `http://127.0.0.1:47190/ping` con `$.http.fetch`; si el servidor responde `narsil 4`, ya está en marcha. Si responde una versión anterior, el mod la detiene primero, porque un servidor sobrevive a las actualizaciones del mod.

Si no, arranca uno y le pasa tres valores en el entorno: `NARSIL_TOKEN` (el token del mod, más abajo), `NARSIL_PORT` (`47190`) y `NARSIL_WINDOW` (`1` cuando la ventana flotante está activada, `0` cuando está desactivada). El proceso se arranca separado, así que sobrevive al hook que lo arrancó:

- **En Windows**, mediante `$.process.run` ejecutando PowerShell, que encuentra Node y Microsoft Edge y llama a `Start-Process` sobre `node overlay/server.cjs`. La ruta de Edge va en `NARSIL_EDGE`.
- **En macOS**, mediante `$.process.run` ejecutando `overlay/start.sh`, que busca Chrome, Edge o Brave y Node en los lugares habituales, y después arranca el servidor con `nohup ... &`.

Sin navegador el servidor sigue funcionando y sirviendo las conversaciones; simplemente no hay ventana.

Cuando se quiere la ventana, el servidor abre el navegador en modo app, sin barra de direcciones ni pestañas: `--app=http://127.0.0.1:47190/`, su propia carpeta de perfil (`--user-data-dir`, bajo `%LOCALAPPDATA%\narsil-overlay` en Windows) y `--window-size=330,450`. También pasa `--disable-background-timer-throttling` y otras dos opciones parecidas, porque la ventana está oculta la mayor parte del tiempo y aun así debe actualizarse en el acto cuando se muestra.

### El vigilante: ¿está Claude minimizado?

Una página web no puede ver otras ventanas, y Node tampoco sin ayuda. Por eso un pequeño script del sistema vigila la ventana de Claude y pregunta al hub qué hacer.

En Windows, `overlay/watch.ps1` se ejecuta en bucle cada 400 ms. Encuentra la ventana del proceso `claude` con el título `Claude`, y la ventana de Edge con el título `Narsil`, mediante unas pocas llamadas a `user32.dll`. Clasifica Claude como:

- `min`: minimizado o no visible.
- `fg`: la ventana en primer plano.
- `bg`: visible pero detrás de otra app.
- `gone`: no hay ninguna ventana de Claude.

Después llama a `GET /tick?claude=<state>&window=<0|1>` con el token del mod, y ejecuta cada línea de la respuesta: `show` coloca la ventana abajo a la derecha de la pantalla en la que se vio Claude por última vez, a 16 píxeles del borde, con `SetWindowPos` y las opciones de "siempre encima" y "no activar"; `hide` la oculta; `open <link>` trae Claude al frente y abre un enlace de conversación. Tras cinco llamadas fallidas seguidas (el servidor ya no está), termina.

En macOS, `overlay/mac-claude.js` es un script de JavaScript for Automation que se ejecuta con `osascript -l JavaScript`. Cada 700 ms lee la lista de ventanas de Core Graphics e imprime `fg`, `bg` o `none`. El comentario del archivo explica la elección: la lista de ventanas da el nombre de la app de cada ventana sin ningún permiso, mientras que los títulos de las ventanas necesitarían uno. Aquí la lógica del vigilante vive en el propio servidor (`keepMac`): `none` se convierte en `min`, o en `gone` cuando `pgrep -x Claude` no encuentra ningún proceso.

### Decidir cuándo mostrarla

La decisión es una función, `tick`, en `overlay/server.cjs`:

- La ventana debe mostrarse cuando Claude está `min` o `gone`, o cuando hay un evento esperando.
- Un evento se borra cuando miras Claude (`fg`), y un evento `done` a los 20 segundos (`DONE_EVENT_MS`).
- `show` o `hide` solo se envían cuando cambia el estado deseado, así que una ventana que arrastraste se queda donde la pusiste.

Los eventos llegan del mod mediante `POST /event`, con un tipo `done`, `question` o `error`. El servidor ignora un evento que llega mientras miras Claude, salvo que sea forzado (la prueba de `/narsil prueba` y el recordatorio de "sigue esperando" de los cinco minutos). Si cerraste la ventana, un evento solo la vuelve a abrir tras `REOPEN_AFTER_CLOSE_MS`, 60 segundos.

### Server-sent events: cómo la página se mantiene al día

La página no pide actualizaciones al servidor cada segundo. Abre una única conexión larga con `new EventSource('/events')`. El servidor responde con el tipo de contenido `text/event-stream`, escribe en el acto la instantánea actual y mantiene la conexión abierta. Cada cambio posterior se escribe en cada conexión abierta como una línea `data: <json>` seguida de una línea en blanco (`broadcast`).

Este es el formato de server-sent events: un flujo de un solo sentido del servidor a la página sobre HTTP normal. Le va bien a la ventana. El navegador se reconecta solo si la conexión se cae, y el servidor solo envía cuando cambió algo de lo que se muestra: un latido que no cambia nada no se difunde.

La instantánea lleva todas las conversaciones vivas y el evento que espera. La página dibuja el texto con `textContent`, nunca como HTML, y dibuja el SVG de Narsil como una imagen a partir de una URL de `Blob`, una forma de mostrar una imagen en la que los scripts que haya dentro del SVG no se ejecutan.

Las acciones propias de la página son pequeñas peticiones `POST`: `/open` (traer una conversación al frente, a través del vigilante), `/dismiss` (borrar el evento) y `/bounds` (dónde está la ventana en la pantalla, que en macOS se usa para colocar encima la ventana de consejos).

### Seguridad: quién puede hablar con el hub

El hub se ejecuta en tu ordenador y sabe qué está haciendo cada conversación. Está construido para que solo tres cosas puedan usarlo: el mod, el vigilante y su propia página. Cuatro protecciones lo consiguen, todas en `overlay/server.cjs`.

**1. Solo escucha en la dirección de loopback.** Las últimas líneas del archivo son:

```js
server.listen(port, '127.0.0.1', () => {
  if (isWindowWanted) openWindow()
})
```

`127.0.0.1` es la dirección que usa un ordenador para hablar consigo mismo. Un servidor ligado a ella solo acepta conexiones de programas de la misma máquina. Otro ordenador de tu red Wi-Fi o de la red de tu oficina no puede abrir ninguna conexión con él, envíe lo que envíe.

**2. El token del mod.** El mod crea un token aleatorio con `crypto.randomUUID()` la primera vez y lo guarda en `$.store` bajo `overlayToken` (`overlayToken` en `hooks/register.tsx`), así que todas las conversaciones usan el mismo. Solo llega al servidor a través de la variable de entorno `NARSIL_TOKEN` cuando el mod lo arranca, y el servidor se lo pasa a `watch.ps1` de la misma forma. Cada petición del mod o del vigilante lo lleva en la cabecera `x-narsil-token`. El servidor lo compara (`isTrusted`) y rechaza con `403` cuando falta o es incorrecto; un token vacío nunca coincide.

**3. La clave de la página.** A la página no se le puede dar el token del mod: todo lo que hay dentro de una página web es visible para quien carga esa página. Por eso el servidor crea un segundo secreto para la página: `PAGE_KEY`, 16 bytes aleatorios de `crypto.randomBytes` de Node, nuevo cada vez que arranca el servidor. Escribe la clave en la página donde `overlay.html` tiene el marcador `__NARSIL_KEY__` (una etiqueta `<meta name="narsil-key">`), y la página la devuelve en la cabecera `x-narsil-page` con cada una de sus acciones. El comentario del servidor da el razonamiento: una página de otro sitio no puede leer esta, así que no puede conocer la clave.

**4. La comprobación de `Host`.** Antes que nada, el servidor rechaza con `403` cualquier petición cuya cabecera `Host` no sea `127.0.0.1:47190` o `localhost:47190`. Esto detiene el DNS rebinding, un ataque en el que un sitio web hace que su propio nombre apunte a `127.0.0.1`. El navegador envía entonces las peticiones de ese sitio web a tu servidor local, pero con el nombre del sitio web en `Host`, y el servidor las rechaza.

Qué necesita cada ruta:

| Ruta                                                     | Necesita                                  |
| -------------------------------------------------------- | ----------------------------------------- |
| `GET /ping`, `/`, `/icon.png`, `/favicon.ico`, `/anim/…` | Solo el `Host` correcto                   |
| `GET /events` (el flujo), `GET /window` (los límites)    | Solo el `Host` correcto                   |
| `POST /open`, `/dismiss`, `/bounds`                      | La clave de la página, o el token del mod |
| `GET /sessions`, `GET /tick`                             | El token del mod                          |
| `POST /state`, `/event`, `/window`, `/quit`              | El token del mod                          |

Dos detalles más: los enlaces se comprueban dos veces antes de que nada los abra, en el servidor (`LINK`, `conversationLink`) y otra vez en `watch.ps1`, y los dos solo aceptan `claude://code/continue?session=local_…&source=desktop_action`. Y los cuerpos de petición de más de un millón de caracteres se cortan (`readBody`).

### El modelo de amenazas en palabras sencillas

¿De quién te protege el servidor?

- **De un sitio web que visitas.** Tu navegador enviará peticiones desde cualquier página a `127.0.0.1`. Pero la página no puede leer las respuestas de otro origen (el servidor no envía cabeceras que lo permitan), así que no puede leer el flujo ni la clave. No conoce la clave ni el token, así que todas las acciones y todas las escrituras la rechazan. Y un nombre redirigido falla la comprobación de `Host`.
- **De otro ordenador de la red.** No puede conectarse, porque el servidor solo escucha en `127.0.0.1`.
- **De los programas de tu propio ordenador.** A estos no se les deja fuera. Cualquier programa local puede leer `/events`, y puede leer la clave de la página cargando `/`, igual que hace la ventana. El token protege de ellos las rutas del mod, pero un programa que ya se ejecuta como tú puede leer mucho más de lo que guarda este servidor. El diseño te protege de la web y de la red, no del software que ya ejecutas.

### Por qué nunca debe exponerse a la red

La dirección de loopback es la protección sobre la que descansan las otras tres. La clave de la página y la comprobación de `Host` funcionan porque solo las reglas de un navegador se interponen entre un desconocido y el servidor, y un navegador sigue esas reglas. Un programa de otro ordenador no:

- Podría escribir la cabecera `Host` que quisiera, así que la comprobación de `Host` no lo detendría.
- Podría cargar `/` y leer la clave de la página, y después usar las acciones de la página: abrir conversaciones en tu escritorio y descartar tus avisos.
- Podría leer `/events` libremente. Ese flujo lleva el título, el titular, las tareas, los subagentes, el contexto, el consejo y los próximos pasos de cada conversación, y los textos de los avisos, que incluyen un resumen de la última respuesta de Claude.

Los nombres de las carpetas del proyecto, las listas de tareas y trozos de las respuestas de Claude son justo lo que no querrías que leyera quien comparte la Wi-Fi de tu cafetería. El token seguiría protegiendo `/state` y `/sessions`, pero el flujo por sí solo revela casi todo el mismo contenido. Así que la regla es sencilla: el hub escucha en `127.0.0.1` y en ningún otro sitio.

## Cómo se le pidió a la IA

La petición original de la ventana flotante no quedó registrada. Llega en el commit `6f8f938` (2026-10-30) "feat(overlay): add floating window, Spanish voice and Windows toasts" (añadir la ventana flotante, la voz en español y las notificaciones de Windows), junto con la voz y las notificaciones de la siguiente guía, antes de que existiera ningún registro de tareas público.

### Peticiones posteriores, registradas en los registros de tareas

La ventana cambió de forma con la vista de todas las conversaciones, cuyo registro es `odd/tasks/fleet-view.md` en narsil-pet. L1 (2026-11-06) empieza con:

> "quiero hacerlo en los dos y tambien en la ventana externa, el diseno lo pensamos luego"

La guía anterior cita esta entrada completa.

L2 (extracto) pide la lista:

> "deberiamos ver en la ventana principal tanto en la banda como la ventana externa el estado de todas las conversaciones, con scroll si son muchas"

Por eso la ventana se desplaza mientras la banda pagina. L6 registra el cambio en el servidor que siguió: ahora arranca con cada conversación, haya ventana o no, "Closing the window no longer quits the server; an event reopens a wanted window after 60 s." (cerrar la ventana ya no detiene el servidor; un evento vuelve a abrir una ventana deseada tras 60 s). L8 registra la nueva disposición de la página, comprobada en el navegador a 330×450 con cuatro conversaciones inventadas, y anota: "No automated test covers the page's own script." (ningún test automático cubre el script propio de la página).

Los bucles nítidos vinieron de `odd/tasks/animated-poses.md`, L6 (2026-11-15):

> "en ventana externa podemos poner el video sin recortar? para que se vea mas nitido?"

El registro recoge la aprobación, "Sí, hazla", y su especificación S7 dice que la ventana no tiene límite de tamaño, así que el servidor local sirve una copia más nítida de cada bucle. Esa es la ruta `/anim/`.

### Reconstrucción a partir del historial de commits

El resto, a partir de `git log -- overlay/server.cjs overlay/overlay.html overlay/watch.ps1 overlay/mac-claude.js overlay/start.sh`:

- `6f8f938` (2026-10-30) "feat(overlay): add floating window, Spanish voice and Windows toasts" (añadir la ventana flotante, la voz en español y las notificaciones de Windows). El servidor, ya en `127.0.0.1` y con el token del mod en sus rutas de escritura, la página, `watch.ps1` y `kill.ps1`.
- `a2b5970` (2026-10-30) "fix(overlay): start the window again for an event instead of a notification" (volver a arrancar la ventana para un evento en lugar de para una notificación).
- `c8bf365` (2026-10-30) "feat(mac): open the floating window on macOS in a Chromium browser" (abrir la ventana flotante en macOS en un navegador Chromium).
- `9bb60c8` (2026-10-30) "fix(overlay): show the floating window on the screen Claude is on" (mostrar la ventana flotante en la pantalla en la que está Claude).
- `42f7efd` (2026-10-31) "fix: let only the floating window's own page and the mod drive its server" (dejar que solo la propia página de la ventana flotante y el mod manejen su servidor). Este commit añadió la clave de la página y la comprobación de `Host`. Antes, las acciones de la página no pedían ninguna clave y no había comprobación de `Host`, así que una página de cualquier sitio web que visitaras podía enviarles una petición simple y, por ejemplo, descartar tus avisos. También añadió las comprobaciones de seguridad de `tests/overlay-server.check.cjs`.
- `3031ef2` (2026-11-01) "fix(overlay): on macOS show the window when Claude is minimized, not when another app is in front, and open only one" (en macOS, mostrar la ventana cuando Claude está minimizado, no cuando otra app está delante, y abrir solo una).
- `aa54891` y `b87bd67` (2026-11-06): el servidor se convierte en el hub de todas las conversaciones, y la ventana las enumera todas.
- `42aab0c` (2026-11-07) "fix: open the floating window once when Edge hands it to a running instance" (abrir la ventana flotante una sola vez cuando Edge la pasa a una instancia en marcha).
- `e19331b` (2026-11-15) "feat: show sharper animated loops in the floating window" (mostrar bucles animados más nítidos en la ventana flotante).
- `f2cc0f6` (2026-11-16) "fix: answer 400 to a request path that makes no URL instead of crashing the overlay server" (responder 400 a una ruta de petición que no forma ninguna URL en lugar de tumbar el servidor de la ventana). Su mensaje explica que una línea de petición en bruto como `GET // HTTP/1.1` hacía que `new URL()` lanzara una excepción dentro del manejador asíncrono, lo que terminaba el proceso. Una sola petición rara podía detener el hub para todas las conversaciones.

El patrón: primero llegó la ventana, después su comportamiento en cada sistema, después su seguridad, y una corrección tardía encontrada al enviar al servidor una petición que ningún navegador enviaría.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil.

> Mi mod de Claude Code `my-pet` muestra el estado de Claude en la banda. Añade una ventana flotante para cuando Claude esté minimizado. Escribe un servidor de Node.js, `overlay/hub.cjs`, que escuche solo en 127.0.0.1, rechace cualquier cabecera `Host` distinta de `127.0.0.1:<port>` y `localhost:<port>`, sirva una página HTML con una clave aleatoria escrita en ella, transmita el estado a esa página con server-sent events en `/events` y acepte `POST /state` solo con un token que el mod crea con `crypto.randomUUID()`, guarda en `$.store` y pasa en una variable de entorno cuando arranca el servidor separado con `$.process.run`. Las acciones propias de la página deben llevar su clave. No escuches nunca en ninguna otra dirección. Añade un test de Node que compruebe que un `Host` incorrecto, un token que falta y una clave que falta se rechazan cada uno con 403, y que una línea de petición como `GET // HTTP/1.1` no tumba el servidor.

## El código mínimo

Un hub reducido, escrito para esta guía y adaptado de `overlay/server.cjs` y `hooks/register.tsx` en [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). El servidor es Node.js normal, no código de mod. Mostrar y ocultar la ventana queda fuera: esa parte depende del sistema, como muestran los vigilantes de arriba.

El servidor, `overlay/hub.cjs`:

```js
'use strict'
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const path = require('path')

const port = Number(process.env.PET_PORT || 47190)
const token = process.env.PET_TOKEN || ''
const PAGE_KEY = crypto.randomBytes(16).toString('hex')
const PAGE = fs
  .readFileSync(path.join(__dirname, 'page.html'), 'utf8')
  .replace('__PAGE_KEY__', PAGE_KEY)
const HOSTS = new Set([`127.0.0.1:${port}`, `localhost:${port}`])

let state = null
const listeners = new Set()

const server = http.createServer((req, res) => {
  const send = (status, type, body) => {
    res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
    res.end(body)
  }
  let url
  try {
    url = new URL(req.url, `http://127.0.0.1:${port}`)
  } catch {
    return send(400, 'text/plain', 'bad request')
  }
  if (!HOSTS.has(String(req.headers.host || '').toLowerCase()))
    return send(403, 'text/plain', 'forbidden')
  const isMod = token !== '' && req.headers['x-pet-token'] === token
  const isPage = isMod || req.headers['x-pet-page'] === PAGE_KEY

  if (req.method === 'GET' && url.pathname === '/') return send(200, 'text/html', PAGE)
  if (req.method === 'GET' && url.pathname === '/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' })
    res.write(`data: ${JSON.stringify(state)}\n\n`)
    listeners.add(res)
    req.on('close', () => listeners.delete(res))
    return
  }
  if (req.method === 'POST' && url.pathname === '/dismiss') {
    if (!isPage) return send(403, 'text/plain', 'forbidden')
    return send(204, 'text/plain', '')
  }
  if (req.method === 'POST' && url.pathname === '/state') {
    if (!isMod) return send(403, 'text/plain', 'forbidden')
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 100_000) req.destroy()
    })
    req.on('end', () => {
      try {
        state = JSON.parse(body)
      } catch {
        return send(400, 'text/plain', 'bad json')
      }
      for (const l of listeners) l.write(`data: ${JSON.stringify(state)}\n\n`)
      send(204, 'text/plain', '')
    })
    return
  }
  send(404, 'text/plain', 'not found')
})

server.on('error', () => process.exit(0))
server.listen(port, '127.0.0.1')
```

La página lee su clave de `<meta name="pet-key" content="__PAGE_KEY__">`, escucha con `new EventSource('/events')`, pone el texto con `textContent` y envía sus acciones con `fetch('/dismiss', { method: 'POST', headers: { 'x-pet-page': key } })`.

El lado del mod, en `hooks/register.tsx`, comprobado con los tipos de 2.1.325 (`$.store`, `$.process.run`, `$.http.fetch`, `$.plugin.root`, `$.clock.every`). Arranca el hub en macOS o Linux de la misma forma que lo hace `launch` de Narsil; en Windows, Narsil usa en su lugar `Start-Process` de PowerShell.

```tsx
import { read } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const HUB = 'http://127.0.0.1:47190'

async function hubToken($: EngineInterface): Promise<string> {
  const saved = await $.store.get('hubToken').catch(() => undefined)
  if (typeof saved === 'string' && saved) return saved
  const token = crypto.randomUUID()
  await $.store.set('hubToken', token)
  return token
}

async function startHub($: EngineInterface): Promise<void> {
  const up = await $.http.fetch(`${HUB}/`).then(
    (r) => r.ok,
    () => false,
  )
  if (up) return
  await $.process.run(['/bin/sh', '-c', 'nohup node "$PET_HUB" </dev/null >/dev/null 2>&1 &'], {
    env: { PET_HUB: `${$.plugin.root}/overlay/hub.cjs`, PET_TOKEN: await hubToken($) },
  })
}

async function push($: EngineInterface): Promise<void> {
  await $.http
    .fetch(`${HUB}/state`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-pet-token': await hubToken($) },
      body: JSON.stringify(await read($, pet)),
    })
    .catch(() => undefined)
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await startHub($)
    $.clock.every(2000, () => void push($))
    return next(e)
  })
}
```

`pet` es el átomo de estado de la primera guía. La orden de shell es una cadena fija; la ruta del script viaja en el entorno, nunca dentro de la orden, que es como Narsil mantiene el texto fuera de lo que un shell interpretaría.

## Errores comunes y cómo probarlo

- **Escuchar en todas las direcciones.** `server.listen(port)` sin host escucha en todas las direcciones del ordenador, la red incluida. Pasa siempre `'127.0.0.1'`.
- **Poner el token del mod en la página.** Lo que contiene una página lo puede leer cualquiera que la cargue. Da a la página su propia clave, nueva en cada ejecución, y reserva el token para el mod.
- **Confiar en `Host` como única protección.** Evita que se engañe a un navegador mediante DNS rebinding. No detiene a un programa que escribe sus propias cabeceras, y por eso importa la dirección de loopback.
- **Un manejador asíncrono que lanza una excepción.** En Node, una excepción dentro de un manejador de peticiones `async` se convierte en un rechazo no gestionado que puede terminar el proceso. Envuelve el análisis que puede fallar, como hizo `f2cc0f6` con `new URL()`.
- **Pasar texto en una línea de órdenes.** Los scripts de Narsil toman su texto del entorno (`NARSIL_TEXT`, `NARSIL_TOKEN`), así que un título que escribió Claude nunca puede leerse como parte de una orden.
- **Robar el foco.** Una ventana que salta al frente interrumpe la escritura. En Windows, `watch.ps1` pasa "no activar" a `SetWindowPos`.
- **Esperar a un proceso que nunca termina.** `$.process.run` lee toda la salida; un servidor arrancado sin separarse retiene la llamada hasta su tiempo de espera. Arráncalo con `nohup … &` o `Start-Process`.

Para probarlo, narsil-pet ejecuta `node tests/overlay-server.check.cjs`. Sus comprobaciones incluyen "the page is served with its key, and the key is not a placeholder" (la página se sirve con su clave, y la clave no es un marcador), "another host name (a page rebound to this address) is refused everywhere" (otro nombre de host, una página redirigida a esta dirección, se rechaza en todas partes), "the page's actions need its key" (las acciones de la página necesitan su clave), "the mod's state needs its token, as before" (el estado del mod necesita su token, como antes) y "a request path no URL can be made of is refused, and the server keeps answering" (una ruta de petición de la que no se puede formar ninguna URL se rechaza, y el servidor sigue respondiendo). El lado del mod lo cubre `tests/narsil.test.tsx` con "each state change is pushed to the floating window with its token and session" (cada cambio de estado se envía a la ventana flotante con su token y su sesión), "an older window server left running is closed and replaced by this version" (un servidor de ventana anterior que quedó en marcha se cierra y se sustituye por esta versión) y "with the window off, the conversation still reaches the hub: started with no window, and pushed to" (con la ventana desactivada, la conversación sigue llegando al hub: arrancado sin ventana, y recibiendo envíos). El registro de tareas anota que ningún test automático cubre el script propio de la página ni la apertura de una ventana real del navegador.

## Para ir más lejos

- `openWindow`, `checkWindowGone` e `isProfileRunning` en `overlay/server.cjs` gestionan el caso en que Edge pasa un arranque a una instancia que ya está en marcha, lo que de otro modo abriría una segunda ventana (`42aab0c`).
- `kill.ps1` y `running.ps1` encuentran los procesos del navegador por su carpeta de perfil, así que el servidor solo cierra su propia ventana.
- `HEARTBEAT_TIMEOUT_MS` (30 segundos) apaga el servidor cuando ninguna conversación late; `ensureOverlay` en `hooks/register.tsx` lo vuelve a arrancar como mucho una vez por minuto.
- La ventana de consejos (`overlay/tip.ps1`, `overlay/tip.sh`, `overlay/tip.js`) se abre encima de la ventana flotante usando los límites que informa la página.
- La tabla "Sistemas compatibles" del README resume qué recibe cada sistema.
