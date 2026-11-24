---
title: La franja sobre la caja de texto
description: 'La franja sobre la caja donde escribes en la app: estado, contexto, caché y último evento del propio claude.ai, y Narsil en su etapa según el estado del mod que sigue StateFeed.'
route: android
order: 3
updated: 2026-11-24
sources:
  - repo: android
    path: app/src/main/assets/page/content.js
  - repo: android
    path: app/src/main/assets/page/lib/live.js
  - repo: android
    path: app/src/main/assets/page/lib/watch.js
  - repo: android
    path: app/src/main/assets/page/lib/restore.js
  - repo: android
    path: app/src/main/assets/page/band.css
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/StateFeed.kt
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/StateModel.kt
---

## Qué hace

Cuando abres una conversación en la app (una dirección como `claude.ai/code/session_…`), aparece una franja justo encima de la caja donde escribes. De izquierda a derecha y de arriba abajo muestra:

- **Narsil**, en su etapa actual y en la pose del estado de la conversación.
- **El estado**, como una etiqueta de color: `TRABAJANDO` (azul), `TE NECESITA` (ámbar), `TERMINADA` (verde) o `EN REPOSO` (gris). El borde izquierdo de la franja toma el mismo color.
- **El contexto**, como `Contexto 42 %`: cuánto de su ventana ha usado la conversación, en verde, ámbar o rojo.
- **La caché**, como `🧊 38 min`: los minutos que faltan para que caduque la caché del prompt, hasta que pasa a `🧊 fría`.
- **El último evento**: lo último que dijo Claude, o `Usando Bash` cuando Claude solo está ejecutando una herramienta, con hace cuánto, como `hace 3 min`.

El texto ocupa dos líneas. Un toque en la franja lo abre entero y otro toque lo cierra. La franja empuja la conversación hacia arriba en lugar de taparla, y se actualiza cada 10 segundos mientras la app está al frente.

> **Experimental.** La franja lee los mismos datos que la página de `claude.ai` carga para sí misma, desde direcciones internas que no son una API pública, y encuentra la caja de texto por un atributo del marcado de la página. Una actualización de Claude puede romperla; cuando pasa, la franja simplemente deja de mostrarse y Claude sigue funcionando. Solo lee: envía peticiones `GET` a `claude.ai` con tu sesión y nunca escribe en tu cuenta.

Casi todo lo que hay en la franja viene del propio `claude.ai`, así que funciona en cuanto abres una conversación, incluso con tu PC apagado. Solo dos detalles dependen del mod de Narsil: su etapa en el dibujo y cuánto dura la caché. Esos vienen de `<tu tema>-estado`, que la app sigue en Kotlin.

## Cómo funciona por dentro

La franja la dibuja `assets/page/content.js`. Lo que saca de los datos vive en `assets/page/lib/live.js`, un módulo sin código de DOM. El observador de la página es `lib/watch.js`, los estilos están en `band.css`, y el estado del mod llega a la página desde `StateFeed.kt` y `StateModel.kt` por el canal que describe la [guía 2](/es/android/webview-host/).

Estos scripts se escribieron primero para la extensión de navegador anterior, y la mayor parte de su código no ha cambiado. En la app se ejecutan en el propio mundo de JavaScript de la página, en lugar de en el mundo aparte de una extensión: `addDocumentStartJavaScript` los pone junto al código de `claude.ai`. Eso cambia un detalle de más abajo, el `fetch` que usan, y nada de lo que muestran.

### De dónde vienen los datos: dos fuentes

| Valor en la franja       | Fuente                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------- |
| Estado                   | `claude.ai`: el `status_bucket` de la conversación                                     |
| Contexto                 | `claude.ai`: `context_usage` en los metadatos de la conversación                       |
| Último evento y su hora  | `claude.ai`: los eventos más recientes de la conversación                              |
| Cuenta atrás de la caché | `claude.ai` para cuándo habló Claude por última vez; el mod para cuánto dura una caché |
| Pose de Narsil           | `claude.ai`: la elige el estado                                                        |
| Etapa de Narsil          | El mod: la carpeta del dibujo de su último estado                                      |

### Las propias peticiones de la página

La franja no lee la conversación de la pantalla. Le hace a `claude.ai` las mismas preguntas que hace la página, con tu sesión, y lee las respuestas como JSON. Cada 10 segundos salen dos peticiones a la vez:

- **La lista de tus conversaciones**, activas y en pausa, hasta 50: `/v1/code/sessions?statuses=active&statuses=paused&limit=50`. La franja toma la que tienes abierta, encontrada por el id de la dirección de la página (`/code/session_…`). La dirección y la lista pueden nombrar la misma conversación con prefijos distintos (`session_x` y `cse_x`, dice el código), así que los ids se comparan sin ellos.
- **Los últimos 60 eventos de esa conversación**, del más reciente al más antiguo: `/v1/code/sessions/<id>/events?limit=60&sort_order=desc`.

El comentario que tienen encima en `lib/live.js` es la razón de que esta ruta sea experimental: "These addresses are not a public API and may change." (estas direcciones no son una API pública y pueden cambiar).

`content.js` las envía con `credentials: 'include'` y una cabecera `anthropic-version: 2023-06-01`. En la extensión anterior prefería el `content.fetch` de Firefox, que hace peticiones "as the page itself, with its session" (como la propia página, con su sesión), en palabras del código. Una WebView no tiene objeto `content`, así que el código recurre a `fetch`, y como el script se ejecuta en el mundo de la página, ese es el propio `fetch` de la página, con las cookies de la página. Tu sesión nunca sale de `claude.ai`, y las respuestas se quedan en la página.

### De qué está hecho cada valor

`liveOf` en `lib/live.js` convierte la conversación y sus eventos en lo que muestra la franja. Este fragmento es de `lib/live.js` en narsil-android (MIT):

<!-- prettier-ignore -->
```js
  const STATES = {
    working: { label: 'TRABAJANDO', color: '#3B8BFF' },
    blocked: { label: 'TE NECESITA', color: '#F5B400' },
    completed: { label: 'TERMINADA', color: '#22B573' },
  }
  const AT_REST = { label: 'EN REPOSO', color: '#8A90A6' }
```

| Valor         | Hecho a partir de                                                                                                                              |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Estado        | `status_bucket`: `working`, `blocked` o `completed`; cualquier otra cosa es `EN REPOSO`.                                                       |
| Contexto      | `external_metadata.context_usage`: `used_tokens` sobre `max_tokens`, redondeado a un porcentaje.                                               |
| Último evento | El evento más reciente de Claude (`assistant`) con texto; si solo tiene una llamada a una herramienta, `Usando` y el nombre de la herramienta. |
| Cuándo        | La hora de ese evento, como `ahora mismo`, `hace 5 min`, `hace 2 h` o `hace 1 d`.                                                              |
| Caché         | El evento más reciente de Claude, más cuánto dura una caché (abajo).                                                                           |

Dos reglas mantienen útil el último evento. Un pensamiento solo no dice nada, así que se salta un evento sin texto y sin llamada a una herramienta. Y solo cuentan los eventos de Claude: una conversación tiene muchos otros tipos.

El contexto y la caché comparten un mismo coloreado, de `levelColor` en `lib/state.js`: verde por debajo del 60 %, ámbar desde el 60 %, rojo desde el 85 %. Para la caché, el porcentaje es cuánto de su tiempo ha pasado.

### Por qué la caché es una estimación

`claude.ai` no dice cuándo caduca la caché de una conversación, así que la franja la estima: **la hora del último evento de Claude más lo que dura una caché**. De `lib/live.js` (MIT):

<!-- prettier-ignore -->
```js
  // From the model's last message: the session's last event may be anything,
  // and opening the page makes some of its own.
  function cacheOf(events, cacheMinutes, now) {
    const last = events.find((e) => e.event_type === 'assistant')
    if (!last) return null
    const left = Math.max(0, Math.ceil((secondsOf(last) + cacheMinutes * 60 - now) / 60))
    return { text: left > 0 ? `🧊 ${left} min` : '🧊 fría', color: self.narsilState.levelColor(100 - (left / cacheMinutes) * 100) }
  }
```

El inicio es el último evento de Claude, no el último evento de la conversación, porque, como dice el comentario, abrir la página genera eventos propios, y la cuenta atrás volvería a empezar cada vez que miras.

Cuánto dura una caché es cosa del mod: `cacheMinutesOf` toma `cacheMinutes` del último estado del mod ([El reloj de la caché](/es/mods/pet/cache-clock/) explica cómo decide el mod). Sin estado, supone 60 minutos, "an hour on a plan" (una hora en un plan), en palabras del código. Así que lee `🧊 38 min` como "unos 38 minutos": la caché empieza en realidad con la petición, no con la respuesta, y sin el mod una caché de 5 minutos se muestra como de 60.

### El dibujo de Narsil: la pose desde la página, la etapa desde el mod

La pose sigue al estado: `trabajando`, `necesita`, `terminado`, o `parada` en reposo. Su etapa no es algo que sepa `claude.ai`. Viene del estado del mod, cuyo campo `art` guarda la dirección de su dibujo. De `lib/live.js` (MIT):

<!-- prettier-ignore -->
```js
  // Her stage is the mod's to know: it comes in the art of its last state,
  // with the first stage at the root and each later one in its folder.
  function petOf(bucket, sentArt, isLight) {
    if (typeof sentArt !== 'string' || !sentArt.startsWith(ART)) return null
    const stage = /^etapa\d+\//.exec(sentArt.slice(ART.length))?.[0] ?? ''
    return `${ART}${stage}${POSES[bucket] ?? 'parada'}-${isLight ? 'claro' : 'oscuro'}.png`
  }
```

`ART` es `https://raw.githubusercontent.com/davshn/narsil-pet/main/assets/`. La franja se queda solo con la carpeta de la etapa (`etapa4/`, por ejemplo) de la dirección del mod, pone la pose de esta conversación y elige `-claro` u `-oscuro` según el modo de la página. Una dirección de cualquier otro sitio se rechaza, así que un estado falsificado no puede hacer que la franja cargue un dibujo de otro sitio.

Cuando no hay estado del mod, o un dibujo no carga, la franja muestra en su lugar el icono propio de la app, servido desde `https://claude.ai/__narsil__/page/icons/icon-192.png`. Un dibujo que falló no se vuelve a pedir.

### De `<topic>-estado` a la página: `StateFeed` y `StateModel`

En la extensión, un script de fondo leía ntfy.sh. En la app lo hace Kotlin, y solo mientras una página muestra la franja. Cuando `content.js` abre su puerto, `host.js` envía `connect`, y `MainActivity` llama a `StateFeed.start()`. De `StateFeed.kt` en narsil-android (MIT):

```kotlin
    @Synchronized
    fun start() {
        stop()
        val mine = run
        val topic = settings.topic
        if (topic == null) {
            post(JSONObject().put("type", "no-topic").toString())
            return
        }
        val key = settings.key
        model = settings.model(topic) ?: StateModel.empty()
        send()
        stream = NtfyStream(NtfyStream.topicUrl("$topic-estado"), "12h") { raw ->
            synchronized(this) {
                if (mine != run) return@synchronized
                model = StateModel.receive(model, raw, key)
                settings.saveModel(topic, model)
                send()
            }
        }.also { it.start() }
    }
```

Paso a paso:

1. **Sin tema, no hay fuente.** La página recibe `{ type: 'no-topic' }`, y el bloque del menú lateral te pide que toques y escribas uno.
2. **El último estado conocido, enseguida.** La app guarda en su configuración el último modelo de la franja por cada tema, así que una página que se abre más tarde muestra a Narsil de inmediato, antes de que responda ntfy.sh.
3. **Después, el flujo**, `https://ntfy.sh/<topic>-estado/json?since=12h`: primero lo que ntfy.sh guardó de las últimas 12 horas, y después cada estado nuevo según llega. `NtfyStream` es la misma clase que usan los avisos; la [guía 6](/es/android/alerts-service/) explica sus reconexiones.
4. **Cada mensaje** pasa por `StateModel.receive`, se guarda y se envía a la página como `{ type: 'model', model }`.

El contador `run` protege contra una carrera: si la página se desconecta y se vuelve a conectar mientras un mensaje va en camino, el mensaje del flujo viejo se descarta. Cuando la página se oculta, la franja cierra su puerto, `host.js` envía `disconnect` y el flujo se detiene. No se lee nada de ntfy.sh mientras no estás mirando a Claude.

`StateModel.receive` se queda solo con el estado más reciente. De `StateModel.kt` (MIT):

```kotlin
    fun receive(model: JSONObject, raw: JSONObject, key: String?): JSONObject {
        if (raw.optString("event") != "message") return model
        val m = Seal.unseal(key, raw)
        if (m.optBoolean("sealed")) return JSONObject(model.toString()).put("isSealed", true)
        val state = try {
            JSONObject(m.optString("message"))
        } catch (_: JSONException) {
            return model
        }
        val kept = model.optJSONObject("state")?.optDouble("at", 0.0) ?: 0.0
        if (kept > state.optDouble("at", 0.0)) return model
        return JSONObject().put("state", state).put("isSealed", false)
    }
```

Los keepalives y los demás eventos se ignoran. Un mensaje sellado se abre con la clave; si no se abre, el modelo se marca como `isSealed` y conserva el estado que tuviera. Un mensaje que no es un objeto JSON se ignora. Y un estado más viejo que el guardado (según su campo `at`, en segundos) pierde, así que repetir 12 horas en cada conexión nunca hace retroceder la franja. `StateModelTest.kt` comprueba cada uno de estos casos. La [guía 7](/es/android/encryption-and-settings/) explica qué significa el aviso del candado.

### Cada 10 segundos, solo mientras miras

`content.js` pide datos nuevos cada 10 segundos, y ninguno mientras la página está oculta: otra app delante, la pantalla apagada o la configuración de la app abierta. Cuando la página vuelve a estar visible, pide enseguida, con el evento [`visibilitychange`](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event), y vuelve a abrir su puerto, lo que arranca un `StateFeed` nuevo con el tema y la clave actuales. Por eso una clave que acabas de escribir en la configuración se aplica en cuanto vuelves. Entre peticiones, la franja se vuelve a dibujar cada 15 segundos, para que la cuenta atrás y el `hace` sigan avanzando. Si una petición falla, lo último que sabía se queda hasta la siguiente.

### En el flujo de la página, para no tapar nada

La franja no es una capa flotante. Es un elemento normal, `#narsil-event`, insertado justo antes de la caja de texto, que se encuentra por el atributo `[data-cds=ChatComposer]` que le pone la página. Como forma parte del propio diseño de la página, la conversación de arriba simplemente termina un poco más arriba.

`band.css` empieza cada una de las partes de Narsil con `all: initial`, para que no se cuele ninguno de los estilos de `claude.ai`, y fija sus propios colores como variables, con un juego claro bajo `html[data-mode="light"]`. También deshace una regla de la propia piel de Narsil: la [guía 5](/es/android/colors-and-mode/) pone en negrita todo el texto de Claude, y la franja devuelve sus pesos con `!important`. El texto se limita a dos líneas con [`line-clamp`](https://developer.mozilla.org/en-US/docs/Web/CSS/line-clamp); un toque alterna `narsil-open`, que deja que se desplace dentro de como mucho el 40 % de la altura de la pantalla (`40dvh`). Todo el texto entra con `textContent`, nunca como HTML.

### Seguir a la página mientras cambia

`claude.ai` es una aplicación de una sola página: abrir otra conversación cambia la dirección y el contenido sin cargar una página nueva, y la página reconstruye la caja de texto de vez en cuando. Así que la franja no se puede colocar una sola vez.

`lib/watch.js` contiene el único [`MutationObserver`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) de todos los scripts de Narsil, que observa todo el documento. Mientras Claude escribe, la página cambia muchas veces por fotograma, así que ejecuta sus funciones como mucho una vez por fotograma, con [`requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame). En cada ejecución, la franja comprueba dos cosas:

- **¿Sigue justo encima de la caja de texto?** Si no, vuelve ahí.
- **¿Sigue siendo la misma conversación?** Compara el id de la dirección con el último por el que preguntó. Cuando cambia, se descartan los datos viejos, la franja desaparece y se piden datos nuevos enseguida.

Escribe un valor solo cuando cambió, porque cada escritura suya es un cambio más para el observador.

Dos partes de estos scripts son restos de la extensión que en la app hacen poco. El observador se detiene solo cuando su extensión desaparece, mirando `browser.runtime.id`; `host.js` siempre responde `'narsil-android'`, así que en la app nunca se detiene por esa razón. Y `lib/restore.js` existía para volver a poner scripts y estilos después de que Vivaldi en Android los perdiera. En la app solo se ejecuta una parte: `missingStyles`, que comprueba las marcas `--narsil-css-skin` y `--narsil-css-band` que cada hoja de estilos fija en `:root`. Si falta una, `content.js` envía `narsil-missing`, y `host.js` vuelve a adoptar la hoja de estilos.

### Tocar la franja, y tocar a Narsil

Un toque en la franja solo abre o cierra su texto. El toque que abre la configuración de la app es sobre Narsil en el bloque del menú lateral, `#narsil-band .narsil-head` en `host.js`; la [guía 4](/es/android/sidebar/) lo muestra. Los nombres pueden confundir: en el código, `narsil-band` es el bloque del menú lateral, y esta franja es `narsil-event`.

## Constrúyelo con Claude

Pídele a Claude las dos mitades a la vez: un script de página que dibuje una franja encima de la caja de texto con los propios datos de `claude.ai`, y una fuente en Kotlin que le envíe el estado del mod por el canal de la WebView. La idea que debe acertar es que la página solo lee, solo mientras miras, y que el estado que le llega es el más reciente, ya abierto.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil.

> Mi app de Android aloja `https://claude.ai` en una WebView y ejecuta un script de página al inicio del documento, con un canal `myHost` hacia Kotlin. En el script de página, dibuja una franja justo antes de `[data-cds=ChatComposer]`, como su hermano anterior. Toma el id de la conversación de `location.pathname` (`/code/session_…`). Cada 10 segundos, y solo mientras `document.hidden` sea falso, pide con `GET` la lista de conversaciones y sus últimos 60 eventos con `fetch` y `credentials: 'include'`. Muestra el estado a partir de `status_bucket`, el porcentaje de contexto, el último texto que escribió Claude y hace cuánto, y una cuenta atrás de la caché a partir de la hora del último evento de Claude más un número de minutos que envía la app. Usa un solo `MutationObserver` limitado con `requestAnimationFrame`. Escribe el texto solo con `textContent`. En Kotlin, cuando la página diga `connect`, sigue `https://ntfy.sh/<topic>-estado/json?since=12h` en un hilo de fondo, quédate solo con el mensaje de mayor `at`, guárdalo y envíaselo a la página; detente con `disconnect`. Mantén las reglas en módulos puros y pruébalas.

### Qué revisar en la respuesta de Claude

1. La franja se inserta justo antes de la caja de texto, no como una capa `position: fixed`.
2. Las peticiones son solo `GET`, con `credentials: 'include'`, y no sale ninguna mientras `document.hidden` es verdadero.
3. La cuenta atrás de la caché empieza en el último evento de Claude, no en el último evento de la conversación.
4. El lado de Kotlin se queda con el más nuevo de dos estados según `at`, así que repetir las últimas 12 horas nunca hace retroceder la franja.
5. Una dirección de dibujo solo se acepta con un prefijo fijo, y de ella solo se toma la carpeta de la etapa.
6. La fuente se detiene cuando la página se desconecta o empieza a cargarse una página nueva, y un mensaje tardío de un flujo viejo se descarta.

Si una comprobación falla, dile a Claude lo que ves: "después de cambiar de conversación, la franja muestra durante unos segundos el texto de la anterior".

### Cómo lo pidió el autor

Las palabras de quien creó Narsil sobre esta app están recogidas en `odd/tasks/android-app.md`. L1 pedía una web view que "muestre la web de claude y modifique sus estilos como lo hace esta extension", y L3 que los estilos fueran los de la propia extensión. Así que la franja no se rediseñó para la app: la petición era traer la franja de la extensión sin cambios.

El registro de tareas también recoge cómo se comprobó en un móvil real, con la sesión iniciada: "With a state published to the throwaway topic's -estado, the sidebar band showed level, XP, ntfy's count and Narsil's art from raw.githubusercontent.com (the page's CSP lets it load), and the strip above the composer showed TRABAJANDO, context, cache and her pose." (con un estado publicado en el -estado del tema desechable, el bloque del menú lateral mostró el nivel, la XP, la cuenta de ntfy y el dibujo de Narsil desde raw.githubusercontent.com, que la CSP de la página deja cargar, y la franja sobre la caja de texto mostró TRABAJANDO, el contexto, la caché y su pose).

El resto se reconstruye a partir del historial de commits (el nombre de un proyecto en un asunto se reemplaza por una descripción entre corchetes):

- `3bcea35` (2026-11-24) "feat: build the script that hosts [the earlier extension] in a WebView, and what alerts and states keep" (construir el script que aloja [la extensión anterior] en una WebView, y lo que guardan los avisos y los estados). Llegan `StateModel` y los scripts de página.
- `53c55c1` (2026-11-24) "feat: host claude.ai with [the earlier extension] in a WebView, and show Narsil's alerts from a foreground service" (alojar claude.ai con [la extensión anterior] en una WebView, y mostrar los avisos de Narsil desde un servicio en primer plano). Su mensaje: "The band's state follows <topic>-estado while the band shows" (el estado de la franja sigue <topic>-estado mientras la franja se muestra).
- `ca01cc7` (2026-11-24) "docs: log the band verified with a signed-in session" (registrar la franja comprobada con una sesión iniciada).
- `5ad4577` (2026-11-24) "refactor: make the band's scripts the app's own, and stop naming the projects it replaces" (hacer que los scripts de la franja sean de la app, y dejar de nombrar los proyectos que reemplaza).

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía (MIT). Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Las reglas de la franja como módulo puro, sin DOM, con la forma de `lib/live.js`. Recibe la conversación, sus eventos (del más reciente al más antiguo) y la duración de la caché, y devuelve lo que hay que mostrar.

```js
const STATES = {
  working: { label: 'TRABAJANDO', color: '#3B8BFF' },
  blocked: { label: 'TE NECESITA', color: '#F5B400' },
  completed: { label: 'TERMINADA', color: '#22B573' },
}
const AT_REST = { label: 'EN REPOSO', color: '#8A90A6' }

const secondsOf = (event) => Date.parse(event.created_at) / 1000

export function stripOf(session, events, cacheMinutes, now) {
  const said = events.find((event) => event.event_type === 'assistant')
  const blocks = Array.isArray(said?.payload?.message?.content) ? said.payload.message.content : []
  const words = blocks
    .filter((block) => block.type === 'text' && block.text?.trim())
    .map((block) => block.text.trim())
    .join('\n')
  const tool = blocks.filter((block) => block.type === 'tool_use').pop()
  const left = said
    ? Math.max(0, Math.ceil((secondsOf(said) + cacheMinutes * 60 - now) / 60))
    : null
  return {
    ...(STATES[session.status_bucket] ?? AT_REST),
    text: words || (tool ? `Usando ${tool.name}` : ''),
    cache: left === null ? '' : left > 0 ? `🧊 ${left} min` : '🧊 fría',
  }
}
```

Es más simple que el real a propósito: solo lee el evento más reciente de Claude, mientras que `lastSaid` en `lib/live.js` retrocede más allá de los eventos que solo tienen pensamiento. Guárdalo como `strip.js`. Una prueba para él con `node --test`, también escrita para esta guía:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { stripOf } from './strip.js'

const at = (iso, content) => ({
  event_type: 'assistant',
  created_at: iso,
  payload: { message: { content } },
})

test('a tool call alone says what Claude is using', () => {
  const now = Date.parse('2026-11-24T10:10:00Z') / 1000
  const events = [at('2026-11-24T10:00:00Z', [{ type: 'tool_use', name: 'Bash' }])]
  const strip = stripOf({ status_bucket: 'working' }, events, 60, now)
  assert.equal(strip.label, 'TRABAJANDO')
  assert.equal(strip.text, 'Usando Bash')
  assert.equal(strip.cache, '🧊 50 min')
})

test('an hour and a minute later the cache is cold', () => {
  const now = Date.parse('2026-11-24T11:01:00Z') / 1000
  const events = [at('2026-11-24T10:00:00Z', [{ type: 'text', text: 'Listo.' }])]
  assert.equal(stripOf({ status_bucket: 'completed' }, events, 60, now).cache, '🧊 fría')
})
```

## Errores comunes y cómo probarlo

- **Un observador por función.** Varios observadores en una página que cambia muchas veces por fotograma se van sumando. Usa uno, y ejecuta su trabajo como mucho una vez por fotograma.
- **Escribir en cada ejecución.** Poner `textContent` o mover la franja cuando nada cambió vuelve a despertar al observador. Compara primero.
- **Una franja flotante.** Una franja `position: fixed` tapa las últimas líneas de la conversación y los botones que Claude muestra ahí.
- **Peticiones con la página oculta.** Un móvil con la pantalla apagada seguiría preguntando cada 10 segundos. Comprueba `document.hidden`.
- **La caché desde el último evento.** Abrir la página crea eventos, así que contar desde el último reinicia la cuenta atrás cada vez que miras.
- **El último estado, no el más reciente.** Cada conexión repite 12 horas, de la más antigua a la más nueva, encima de un estado guardado que puede ser más nuevo. Compara `at`.
- **Texto como HTML.** Los mensajes de Claude, y cualquier cosa de un tema de ntfy.sh, pueden contener cualquier cosa. Usa `textContent`.
- **Esperar la franja en la página de inicio de Claude.** Solo aparece en la página de una conversación, con la caja de texto presente.

Para probar las reglas en el PC, mantenlas en módulos sin DOM, como hace `lib/live.js`, y dales eventos inventados, como en el código de referencia. Del lado de Kotlin, `./gradlew testDebugUnitTest` ejecuta `StateModelTest`, que comprueba que un estado se guarda, que gana el más nuevo de dos, que se ignoran los keepalives y los mensajes que no son JSON, y que un estado sellado que la clave no puede abrir se marca.

En el móvil, publica desde el PC un estado inventado en un tema de prueba que hayas puesto en la configuración:

```bash
curl -d '{"xp":"⭐ Nivel 3 · 40/300 XP","art":"https://raw.githubusercontent.com/davshn/narsil-pet/main/assets/etapa3/parada-oscuro.png","at":1795000000,"cacheMinutes":5}' https://ntfy.sh/narsil-0000000000example0-estado
```

Abre una conversación: en un segundo, la Narsil de la franja debería mostrar la etapa 3 en la pose de la conversación, y la caché debería contar hacia atrás desde 5 minutos después de la última respuesta de Claude. Después cambia de conversación, gira el móvil y apaga y enciende la pantalla: la franja debería quedarse encima de la caja de texto, cambiar con la conversación y actualizarse dentro de los 10 segundos siguientes a volver.

### Dónde difieren el código y el README

- Los comentarios de `band.css` y de `lib/state.js` todavía describen la extensión: "A stylesheet of the manifest's, not a `<style>` the script adds" (una hoja de estilos del manifiesto, no un `<style>` que añade el script) y "the background page loads it after seal.js" (la página de fondo lo carga después de seal.js). En la app no hay manifiesto, ni página de fondo, ni `seal.js`: la hoja de estilos entra como hoja construida desde `host.js`, y Kotlin abre los estados sellados. El código se comporta como describe esta guía; solo esos comentarios están desactualizados.

## Para ir más lejos

- La [guía 4](/es/android/sidebar/) cubre el bloque del menú lateral, donde un toque en Narsil abre la configuración.
- La [guía 6](/es/android/alerts-service/) explica `NtfyStream`, la clase que aquí sigue `-estado` y, para los avisos, tu tema.
- Dentro de Claude Code, Narsil muestra los mismos estados con sus propias reglas: mira [El reloj de la caché](/es/mods/pet/cache-clock/) y, para los campos de `-estado`, [Avisos en el móvil y el reloj](/es/mods/pet/phone-and-watch/).
- El mismo estado también llega a un reloj: [Narsil Watch](/es/watch/what-it-is/).
- El código fuente está en [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
