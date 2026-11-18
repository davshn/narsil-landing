---
title: El bloque del menú lateral
description: 'El bloque bajo Buscar en el menú lateral de claude.ai: el nivel de Narsil y la cuenta de ntfy del día desde el mod por ntfy.sh, y los límites de 5 horas y semanal desde el propio claude.ai.'
route: claude
order: 3
updated: 2026-11-18
---

## Qué hace

Abre el menú lateral de `claude.ai` y, justo debajo de **Buscar**, Narsil en Claude añade un bloque con tres tipos de datos:

| Qué                                                                 | De dónde viene                         |
| ------------------------------------------------------------------- | -------------------------------------- |
| **Narsil**, su nivel y su experiencia, con una barra                | El mod narsil-pet, a través de ntfy.sh |
| **`5 horas`** y **`Semana`**: los límites de 5 horas y de la semana | El propio `claude.ai`, cada minuto     |
| **`ntfy hoy`**: los mensajes de ntfy.sh del día y su reinicio       | El mod narsil-pet, a través de ntfy.sh |

Cada límite muestra un porcentaje, una barra en verde, ámbar o rojo, y cuándo se reinicia, como `reinicia en 2 h 05 min`. El nivel se lee como `Narsil ⭐ Nivel 4` con `350/400 XP` al lado.

ntfy.sh se usa solo para lo que la página no puede saber. El nivel y la cuenta cambian cuando el mod envía un estado, que es cuando escribes a Claude Code mediante Remote Control. Cuando la cuenta tiene más de una hora, el bloque lo indica.

> **Experimental.** El bloque encuentra su sitio por la estructura del menú lateral de `claude.ai`, y lee los límites de una dirección interna de la página, no de una API pública. Una actualización de Claude puede romperlo; cuando pasa, el bloque deja de mostrarse. Solo lee, y nunca envía tus datos a ningún sitio.

## Cómo funciona por dentro

El bloque lo dibuja `extension/content.js`, como la franja de la [guía 2](/es/mods/claude/conversation-band/). Los límites los lee el propio script de contenido, desde la página. El nivel y la cuenta los lee el script de fondo, `extension/background.js`, con ayuda de `lib/stream.js` y `lib/seal.js`, y los guarda y les da forma `lib/state.js`.

### Encontrar Buscar en cualquier idioma

El bloque no se encuentra por la palabra "Buscar", que cambia con el idioma de la página. Se encuentra por dónde está Buscar: en un móvil, el menú lateral es una hoja con Buscar en su cabecera; en una pantalla más ancha, Buscar es el único botón directo del primer grupo del menú. El bloque se inserta justo después.

La página monta el menú lateral tarde, y lo vuelve a montar de vez en cuando, así que el bloque se vuelve a colocar con el mismo observador de la página que usa la franja: en cada ejecución, si no está justo después de Buscar, va ahí.

### Los límites, desde `claude.ai` cada minuto

Los límites de 5 horas y de la semana son de tu cuenta, y `claude.ai` ya los conoce. El script de contenido los lee igual que la franja lee una conversación, con la sesión de la página y una petición `GET`:

1. **Qué cuenta.** El id de la organización que la página tiene abierta está en una de las cookies de la página, `lastActiveOrg`. El script de contenido lo lee de `document.cookie` y nunca lo guarda.
2. **El uso.** Le pide a `claude.ai` el uso de esa organización, una dirección interna de la página.
3. **Dos ventanas.** De la respuesta toma la ventana de 5 horas y la de 7 días: cuánto se ha usado, como porcentaje, y cuándo se reinicia cada una.

Pregunta una vez cuando carga la página, después cada 60 segundos, y nunca mientras la página está oculta. Cuando la página vuelve a estar visible, pregunta enseguida.

### El nivel y la cuenta, desde el mod a través de ntfy.sh

Tu nivel y la cuenta de ntfy.sh viven en tu ordenador, en el mod. narsil-pet los envía en su tema de estado silencioso: tu tema con `-estado` al final, publicado tras cada turno mientras escribes desde fuera ([Avisos en el móvil y el reloj](/es/mods/pet/phone-and-watch/) describe el tema y sus cinco campos). Su README dice que ese tema lo lee esta extensión "because they are data only the PC knows" (porque son datos que solo conoce el PC).

El bloque usa tres de los cinco campos:

- **`xp`**, una etiqueta como `⭐ Nivel 4 · 350/400 XP` ([Experiencia y crecimiento](/es/mods/pet/experience-and-growth/) explica los niveles). `lib/state.js` la divide en el nombre, los puntos dentro del nivel y los puntos que necesita, para la barra.
- **`art`**, la dirección del dibujo de Narsil en su etapa. Solo se acepta cuando apunta a los recursos propios de narsil-pet.
- **`usage`**, una fila llamada `ntfy` con su etiqueta, porcentaje, color, nota y hora de reinicio.

El cuarto campo, `at`, es cuándo lo envió el mod. Los datos más nuevos siempre ganan: un mensaje más antiguo que el que ya se muestra se ignora.

### Por qué lee ntfy.sh el script de fondo, y no la página

Los scripts de contenido se ejecutan dentro de `claude.ai`, bajo la política de seguridad de contenido (Content Security Policy) de la página. Así que la lectura la hace `background.js`. La descripción del propio código: desde ahí, "claude.ai's Content-Security-Policy does not apply, and the topic and the key never reach the page." (la Content-Security-Policy de claude.ai no se aplica, y el tema y la clave nunca llegan a la página).

Las dos partes hablan por un puerto ([MDN: runtime.connect](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/connect)):

1. Cuando una página de `claude.ai` muestra el bloque, su script de contenido abre un puerto llamado `narsil-band`. El script de fondo acepta solo puertos de su propia extensión.
2. Con el primer puerto, el script de fondo empieza a leer; cuando se va el último, se detiene. Una página oculta cierra su puerto, así que no se lee nada mientras no miras.
3. Cada vez que cambia el estado, el script de fondo envía el estado ya abierto a cada puerto. Nunca envía el tema ni la clave.

### Primero consultar, después seguir el flujo

ntfy.sh puede enviar un tema como un flujo JSON, "one JSON message object per line" (un objeto de mensaje JSON por línea), y su opción `poll=1` cierra la conexión en cuanto se leen los mensajes guardados ([ntfy: subscribe API](https://docs.ntfy.sh/subscribe/api/)). El script de fondo usa las dos cosas, solo en el tema `-estado`:

1. **Consultar las últimas 12 horas**: `https://ntfy.sh/<topic>-estado/json?poll=1&since=12h`. Esto trae enseguida el estado más reciente.
2. **Seguir el flujo** desde el id del último mensaje que recibió, para que nada se lea dos veces y nada se pierda.

El flujo se lee con `fetch` y un lector de flujo, línea a línea, no con `EventSource`. La razón está en `lib/stream.js`: el paquete Chromium ejecuta el script de fondo como un service worker, "which has no EventSource" (que no tiene EventSource). Cuando el flujo termina, vuelve a empezar desde el último mensaje que trajo; cuando falla, espera un segundo, después el doble cada vez, hasta un minuto.

En Chromium, el service worker se detiene tras 30 segundos sin actividad ([Chrome: the extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)), y el flujo con él. Así que mientras el bloque se muestra, el script de contenido envía una palabra por su puerto cada 25 segundos para mantenerlo despierto.

El último estado también se guarda en `storage.local`, con el tema al que pertenece, para que una página que se abre más tarde lo muestre enseguida. El comentario del código explica por qué basta con eso: "what it brought is kept, as ntfy.sh keeps it for 12 h" (lo que trajo se guarda, igual que ntfy.sh lo guarda 12 h).

### Mensajes sellados y la clave

Si activaste `/narsil movil clave` en tu ordenador, el mod sella lo que publica: el estado llega como un texto que empieza por `narsil1:`, ilegible sin la clave. `lib/seal.js` lo abre con la clave de las opciones, siguiendo el esquema que usa `hooks/seal.ts` de narsil-pet ([la guía del móvil](/es/mods/pet/phone-and-watch/) lo describe paso a paso):

1. De la tuya se derivan dos claves: HMAC-SHA256 de `enc` y de `mac`.
2. El texto que sigue a `narsil1:` se decodifica de base64url en un nonce de 16 bytes, el texto cifrado y una etiqueta de 32 bytes.
3. La etiqueta se vuelve a calcular sobre el nonce y el texto cifrado, y se compara con la recibida. Si difieren, el mensaje no se abre.
4. Solo entonces se descifra el texto, de 32 en 32 bytes, con HMAC-SHA256 del nonce y un contador de bloque como flujo de clave.

El mod construye HMAC a mano porque su módulo de hooks solo tiene SHA-256. La extensión no lo necesita: WebCrypto, el del navegador, trae HMAC incorporado ([MDN: SubtleCrypto.sign](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/sign)), y el comentario de narsil-pet dice que el HMAC de WebCrypto "gives the same bytes" (da los mismos bytes).

Cuando un mensaje sellado no se abre, porque no hay clave o es la equivocada, el bloque muestra `🔒 Toca y pon la clave`, y un toque abre las opciones. Un mensaje que no está sellado se lee tal cual, con clave o sin ella.

### Lo que podrían hacer los lectores del tema, y cómo se defiende el bloque

Sin clave, cualquiera que conozca tu tema también puede publicar en él. Así que lo que llega de ntfy.sh nunca se trata como marcado de confianza: cada valor entra en el bloque con `textContent`, y un dibujo solo se muestra cuando su dirección empieza por la carpeta de recursos propia de narsil-pet. Un estado falso podría mostrar un nivel o una cuenta equivocados, pero no puede añadir un enlace, un script ni una imagen de otro sitio.

### "Más de una hora", y por qué la cuenta viene del PC

El mod envía un estado solo mientras escribes desde fuera. Cuando vuelves al escritorio, el último estado se queda, y envejece. Así que cuando un estado tiene más de una hora, la fila `ntfy hoy` añade una nota como `dato de hace 3 h`. El nivel no lleva esa nota.

La cuenta en sí tiene que venir del ordenador, porque ntfy.sh cuenta los mensajes por dirección IP. El mod le pregunta a ntfy.sh, desde la red del ordenador, cuántos mensajes ha enviado hoy esa red, y pone la respuesta en su estado. Si preguntara el móvil, ntfy.sh respondería sobre la red del móvil, que no envía nada. Como explica la guía del móvil, ese día además empieza a una hora propia de ntfy.sh, no a medianoche, y por eso la fila muestra su propia hora de reinicio.

## Cómo se le pidió a la IA

No quedó registrada ninguna petición sobre el bloque. Las palabras de quien creó Narsil registradas para esta ruta tratan del sitio (la [guía 1](/es/mods/claude/what-it-is/) las cita). Lo siguiente se reconstruye a partir del historial de commits de la extensión:

- `c200e8a` (2026-11-09) "feat: show Narsil's state in claude.ai's sidebar on Firefox for Android" (mostrar el estado de Narsil en el menú lateral de claude.ai en Firefox para Android). La primera versión: "A row under the search, with a panel for the conversations, limits, cache and alerts" (una fila bajo la búsqueda, con un panel para las conversaciones, los límites, la caché y los avisos), leyendo ntfy.sh "from the background page, live while the page shows it" (desde la página de fondo, en vivo mientras la página lo muestra).
- `00adbb9` (2026-11-09) "feat: show only Narsil's level, the limits and ntfy's count in the sidebar" (mostrar solo el nivel de Narsil, los límites y la cuenta de ntfy en el menú lateral). Los límites pasaron al propio `claude.ai`: "ntfy.sh is only read for what the page cannot know: her level and its own count, so the extension no longer follows the alerts topic." (ntfy.sh solo se lee para lo que la página no puede saber: su nivel y su propia cuenta, así que la extensión ya no sigue el tema de avisos).
- `11dadb3` (2026-11-10) "feat: run the extension in Vivaldi for Android as a Chromium package" (ejecutar la extensión en Vivaldi para Android como paquete Chromium). El flujo pasó de `EventSource` a `fetch`, con la espera creciente tras un fallo y la palabra cada 25 segundos.

Del lado del mod, `544ef89` de narsil-pet (2026-11-09) "feat: send only what the Firefox extension reads through ntfy" (enviar solo lo que la extensión de Firefox lee a través de ntfy) recortó su estado a los cinco campos de arriba, el mismo día.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil.

> En mi extensión para `https://claude.ai/*`, añade un bloque justo después del botón Buscar del menú lateral, encontrado por su posición, no por su texto. El script de contenido abre un puerto `runtime.connect` hacia el script de fondo mientras la página está visible y lo cierra cuando se oculta. El script de fondo lee el tema de `storage.local`, consulta `https://ntfy.sh/<topic>-estado/json?poll=1&since=12h` y después sigue el mismo flujo JSON con `fetch` y un lector de flujo desde el id del último mensaje, reintentando con una espera que se duplica hasta 60 s. Envía el estado más reciente ya interpretado a cada puerto, nunca el tema. En el bloque, muestra el campo `xp` como texto con `textContent`, acepta la URL de una imagen solo desde un prefijo fijo, y añade "data from N h ago" cuando el `at` del estado tenga más de una hora. Prueba la interpretación y el flujo con `node --test`, pasando un `fetch` falso.

## El código mínimo

Las dos mitades, escritas para esta guía (MIT). El script de fondo sigue el tema de estado y envía al bloque lo que lee; el script de contenido lo muestra. Pruébalo con un tema inventado como `narsil-0123456789abcdef0123`, en un tema tuyo.

`background.js`:

```js
const ports = new Set()
let controller = null
let latest = null

async function follow(topic, signal) {
  let since = null
  let wait = 1000
  while (!signal.aborted) {
    try {
      const query = since ? `?since=${encodeURIComponent(since)}` : '?since=12h'
      const response = await fetch(`https://ntfy.sh/${topic}-estado/json${query}`, { signal })
      if (!response.ok || !response.body) throw new Error(`ntfy.sh ${response.status}`)
      wait = 1000
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
      let rest = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        const lines = (rest + value).split('\n')
        rest = lines.pop()
        for (const line of lines.filter(Boolean)) {
          const message = JSON.parse(line)
          if (message.event !== 'message') continue
          since = message.id
          latest = JSON.parse(message.message)
          ports.forEach((port) => port.postMessage(latest))
        }
      }
    } catch {
      if (signal.aborted) return
      await new Promise((resolve) => setTimeout(resolve, wait))
      wait = Math.min(wait * 2, 60_000)
    }
  }
}

browser.runtime.onConnect.addListener(async (port) => {
  if (port.sender?.id !== browser.runtime.id) return
  ports.add(port)
  port.onDisconnect.addListener(() => {
    ports.delete(port)
    if (ports.size === 0) controller?.abort()
  })
  if (latest) port.postMessage(latest)
  if (ports.size > 1) return
  const { topic } = await browser.storage.local.get('topic')
  if (!/^[-_A-Za-z0-9]{1,64}$/.test(topic ?? '')) return
  controller = new AbortController()
  follow(topic, controller.signal)
})
```

En el script de contenido:

```js
const level = document.createElement('div')
const port = browser.runtime.connect({ name: 'my-block' })
port.onMessage.addListener((status) => {
  const hours = Math.floor((Date.now() / 1000 - (status.at ?? 0)) / 3600)
  level.textContent =
    hours >= 1 ? `${status.xp} · data from ${hours} h ago` : String(status.xp ?? '')
})
```

`TextDecoderStream` y el lector de flujo son estándar ([MDN: Using readable streams](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams)), y funcionan en un service worker de Chromium, donde `EventSource` no existe. Un mensaje que no es JSON válido lanza un error dentro del bucle y el flujo se reinicia justo después de él, lo que basta para un ejemplo; la extensión, en cambio, se salta esas líneas.

## Errores comunes y cómo probarlo

- **Leer ntfy.sh desde la página.** El script de contenido necesitaría el tema, y también cualquier otra cosa que se ejecute en la página. Mantén el tema en el script de fondo.
- **Encontrar Buscar por su texto.** La etiqueta cambia con el idioma de la página. Encuéntralo por su posición.
- **`EventSource` en Chromium.** El service worker no lo tiene; usa `fetch` y lee el cuerpo.
- **Un flujo que nunca se reinicia.** ntfy.sh, la red o el móvil lo cerrarán. Reinícialo desde el id del último mensaje, y espera más tras cada fallo.
- **Un service worker dormido.** Chromium detiene uno inactivo tras 30 segundos, y el flujo se detiene con él. Mantenlo despierto mientras se muestra el bloque, y déjalo dormir cuando no se muestra nada.
- **Fiarse del tema.** Sin clave, cualquiera que tenga el nombre puede publicar. Muestra solo texto, e imágenes de una dirección fija.
- **Pedirle la cuenta a ntfy.sh desde el móvil.** La respuesta es sobre la red del móvil. La cuenta tiene que venir del ordenador.
- **Una cuenta que nunca se mueve.** El mod envía su estado solo mientras escribes mediante Remote Control. En el escritorio, el bloque conserva el último y marca su antigüedad.

Para probarlo, publica un estado inventado en tu propio tema de prueba desde un ordenador: `curl -d '{"xp":"⭐ Nivel 2 · 40/200 XP","at":1700000000}' https://ntfy.sh/narsil-0123456789abcdef0123-estado` ([ntfy: publishing](https://docs.ntfy.sh/publish/)), con un tema que hayas inventado. El bloque debería mostrar el nivel en menos de un segundo, y la nota de antigüedad, porque ese `at` ya pasó hace mucho. Después apaga la red un minuto y vuelve a encenderla: el flujo debería reanudarse, y un estado publicado mientras estaba apagada debería llegar.

## Para ir más lejos

- La [guía 4](/es/mods/claude/colors-and-icon/) viste toda la página con los colores de Narsil, y le da su icono a la app de la pantalla de inicio.
- La [guía 5](/es/mods/claude/android-packaging/) explica el paquete Chromium, y por qué su script de fondo necesita la palabra cada 25 segundos.
- Los límites podrían avisarte antes de que llegues a ellos, como hace Narsil dentro de Claude Code: mira [Contexto y límites](/es/mods/pet/context-and-limits/).
