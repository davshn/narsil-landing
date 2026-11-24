---
title: El bloque del menú lateral
description: 'El bloque bajo la búsqueda del menú lateral de Claude: el nivel de Narsil y la cuenta de ntfy del estado del mod, los límites de 5 horas y semanal de claude.ai cada minuto, y el aviso del candado.'
route: android
order: 4
updated: 2026-11-24
sources:
  - repo: android
    path: app/src/main/assets/page/content.js
  - repo: android
    path: app/src/main/assets/page/lib/state.js
  - repo: android
    path: app/src/main/assets/page/lib/live.js
  - repo: android
    path: app/src/main/assets/host.js
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/StateModel.kt
  - repo: pet
    path: hooks/phone.ts
  - repo: pet
    path: hooks/register.tsx
---

## Qué hace

Abre el menú lateral de Claude en la app y, justo debajo de la búsqueda, Narsil añade un bloque con tres tipos de datos:

| Qué                                                             | De dónde viene                        |
| --------------------------------------------------------------- | ------------------------------------- |
| **Narsil**, su dibujo, su nivel y su experiencia, con una barra | El mod de Narsil, a través de ntfy.sh |
| **`5 horas`** y **`Semana`**: tus dos límites de uso            | El propio `claude.ai`, cada minuto    |
| **`ntfy hoy`**: los mensajes de ntfy.sh del día y su reinicio   | El mod de Narsil, a través de ntfy.sh |

Cada límite muestra un porcentaje, una barra en verde, ámbar o rojo, y cuándo se reinicia, como `reinicia en 2 h 05 min`. El nivel se lee como `Narsil ⭐ Nivel 28` con `30/2800 XP` al lado.

El bloque también avisa cuando falta algo. Sin tema en la configuración, dice `Toca y escribe tu topic`. Cuando el estado del mod está cifrado y la app no puede abrirlo, dice `🔒 Toca y pon la clave`. Un toque en cualquiera de los dos avisos, o en la propia Narsil, abre la configuración de la app.

> **Experimental.** El bloque encuentra su sitio por la estructura del menú lateral de Claude, y lee tus límites de una dirección interna de la página de `claude.ai`, no de una API pública. Una actualización de Claude puede romper cualquiera de las dos cosas; cuando pasa, el bloque deja de mostrarse o pierde sus límites, y Claude sigue funcionando. Solo lee.

ntfy.sh se usa solo para lo que la página no puede saber. El nivel y la cuenta cambian cuando el mod envía un estado, que es cuando le escribes a Claude Code mediante Remote Control. Cuando la cuenta tiene más de una hora, el bloque lo indica.

## Cómo funciona por dentro

El bloque lo dibuja `assets/page/content.js`, como la franja de la [guía 3](/es/android/conversation-band/), y los dos comparten el observador de la página de `lib/watch.js`. Los límites los lee el propio `content.js`, desde la página, con las reglas de `lib/live.js`. El nivel y la cuenta llegan desde el código Kotlin de la app por el canal de la [guía 2](/es/android/webview-host/), y `lib/state.js` les da forma.

### Encontrar la búsqueda en cualquier idioma

El bloque no se encuentra por la palabra "Buscar", que cambia con el idioma de la página. Se encuentra por dónde está la búsqueda. De `content.js` en narsil-android (MIT):

<!-- prettier-ignore -->
```js
  // Under the search, found by where it sits and so in any language: on a phone
  // the sidebar is a sheet with the search in its header; on a wider screen
  // it is the only direct button of the list's first block. The page mounts
  // the sidebar late and again at times: she goes back under it.
  const PHONE_SEARCH = '.df-phone-sheet-header'
  const WIDE_SEARCH = '.dframe-nav-scroll > .shrink-0 > button'
  function place() {
    const search = document.querySelector(PHONE_SEARCH) || document.querySelector(WIDE_SEARCH)
    if (search && search.nextElementSibling !== band) search.after(band)
    drawEvent()
  }

  self.narsilWatch(place)
```

`place` se ejecuta en cada cambio que ve el observador de la página, como mucho una vez por fotograma. Si el bloque no está justo después de la búsqueda, va ahí. Los dos selectores son nombres de clase del marcado actual de `claude.ai`, y son las líneas más frágiles de esta guía: basta un rediseño del menú lateral para perder el bloque.

### Los límites, desde `claude.ai` cada minuto

Los límites de 5 horas y de la semana son de tu cuenta, y `claude.ai` ya los conoce. El bloque los lee igual que la franja lee una conversación, con la sesión de la página y una petición `GET`. De `lib/live.js` (MIT):

<!-- prettier-ignore -->
```js
  // The account the page has open is in its cookie.
  function usageUrl(cookie) {
    const org = /(?:^|; )lastActiveOrg=([0-9a-f-]{36})(?:;|$)/.exec(cookie || '')?.[1]
    return org ? `${ORIGIN}/api/organizations/${org}/usage` : null
  }

  function limitOf(label, window, now) {
    if (typeof window?.utilization !== 'number') return null
    const note = window.resets_at ? self.narsilState.resetLabel(Date.parse(window.resets_at) / 1000, now) : ''
    return { label, percent: Math.round(window.utilization), color: self.narsilState.levelColor(window.utilization), note }
  }

  const limitsOf = (usage, now) => [limitOf('5 horas', usage?.five_hour, now), limitOf('Semana', usage?.seven_day, now)].filter(Boolean)
```

1. **Qué cuenta.** El id de la organización que la página tiene abierta está en la cookie `lastActiveOrg`, un UUID de 36 caracteres. El script lo lee de `document.cookie` y no lo guarda en ningún sitio.
2. **El uso.** Pide `claude.ai/api/organizations/<id>/usage`, una dirección interna de la página.
3. **Dos ventanas.** De la respuesta toma `five_hour` y `seven_day`: `utilization`, que ya es un porcentaje, y `resets_at`, una fecha. Una ventana sin `utilization` numérico se deja fuera.

El reinicio lo redacta `resetLabel` en `lib/state.js`: `reinicia en 45 min`, `reinicia en 2 h 05 min` o `reinicia en 3 d 4 h`, y `ya se reinició` cuando la hora ya pasó. Los colores son los umbrales compartidos de `levelColor`: verde por debajo del 60 %, ámbar desde el 60 %, rojo desde el 85 %.

`pollUsage` pregunta una vez cuando carga la página, después cada 60 segundos, y nunca mientras la página está oculta. Cuando la página vuelve a estar visible, pregunta enseguida. Si la petición falla, se quedan los últimos límites.

### El nivel y la cuenta, desde el mod a través de ntfy.sh

Tu nivel y la cuenta de ntfy.sh viven en tu PC, en el mod. El mod los envía en su tema de estado silencioso, tu tema con `-estado` al final. La app lo sigue en Kotlin mientras la página muestra la franja, se queda con el estado más reciente y se lo envía a la página (la [guía 3](/es/android/conversation-band/) recorre `StateFeed` y `StateModel`). La página nunca ve el tema.

El estado lleva más campos de los que usa el bloque. `sendStatus` en `hooks/register.tsx` de narsil-pet lo construye con `xp`, `art`, `at`, `cacheMinutes`, `limits`, `sessions` y `usage`. El bloque lee tres de ellos, y `at`:

- **`xp`**, una etiqueta como `⭐ Nivel 28 · 30/2800 XP`, escrita por `xpLabel` del mod. `levelOf` en `lib/state.js` la divide en el nombre, los puntos dentro del nivel y los puntos que necesita, para la barra.
- **`art`**, la dirección del dibujo de Narsil en su etapa. Solo se acepta cuando empieza por la carpeta de assets de narsil-pet en GitHub. En modo claro, el bloque cambia `-oscuro.png` por `-claro.png`, ya que el mod envía la variante oscura.
- **`usage`**, una fila con la clave `ntfy`, construida por `ntfyRow` del mod en `hooks/phone.ts`: `{ key: 'ntfy', label: 'ntfy hoy', percent, color, note, resetsAt }`, donde `note` se lee como `24/250 mensajes`.
- **`at`**, cuándo lo envió el mod, en segundos. Decide qué estado es el más reciente, y qué antigüedad tiene la cuenta.

`limits` y `sessions` son para [Narsil Watch](/es/watch/what-it-is/), que no tiene una página de `claude.ai` a la que preguntar; la app toma sus límites de la página. Los dos analizadores, de `lib/state.js` (MIT):

<!-- prettier-ignore -->
```js
  // "⭐ Nivel 4 · 350/400 XP": the name, and how far into the level.
  function levelOf(xp) {
    const m = /^(.*?)\s*·\s*(\d+)\/(\d+)\s*XP/.exec(xp || '')
    if (!m) return null
    const [into, needed] = [Number(m[2]), Number(m[3])]
    return { name: `Narsil ${m[1]}`, into, needed, percent: Math.round((into / needed) * 100) }
  }

  function ntfyOf(s, now) {
    const row = Array.isArray(s.usage) ? s.usage.find((r) => r.key === 'ntfy') : null
    if (!row) return null
    const isStale = Boolean(s.at) && now - s.at > STALE_SECONDS
    const note = [row.note, row.resetsAt ? resetLabel(row.resetsAt, now) : '', isStale ? `dato de ${ago(s.at, now)}` : ''].filter(Boolean).join(' · ')
    return { label: row.label, percent: Math.round(row.percent), color: row.color, note }
  }
```

Una etiqueta de nivel que no encaja con el patrón da `null`, y la cabecera del bloque, dibujo incluido, se queda oculta. Eso es también lo que ves antes de que el mod haya enviado un estado por primera vez.

### Por qué la cuenta tiene que venir del PC

ntfy.sh cuenta los mensajes por dirección IP. El mod le pregunta a `https://ntfy.sh/v1/account`, desde la red de tu PC, cuántos mensajes envió hoy esa red, y pone la respuesta en su estado, contando el mensaje que está a punto de salir. Si preguntara el móvil, ntfy.sh respondería sobre la red del móvil, que no envía nada. Como explica el comentario de narsil-pet, además ese día empieza "at an hour hashed from the IP, not at midnight" (a una hora sacada de un hash de la IP, no a medianoche), y por eso la fila muestra su propia hora de reinicio.

### "Más de una hora"

El mod envía un estado solo mientras escribes desde fuera, y se limita a 200 mensajes al día. Cuando vuelves al escritorio, el último estado se queda, y envejece. Así que, cuando un estado tiene más de una hora (`STALE_SECONDS = 3600`), la fila `ntfy hoy` añade una nota como `dato de hace 3 h`. El nivel no lleva esa nota: cambia despacio, y un nivel de hace una hora sigue siendo tu nivel.

### Cómo se dibuja el bloque

`renderBand` en `content.js` construye el bloque a partir del último mensaje que envió la app y de los últimos límites. De `content.js` (MIT):

<!-- prettier-ignore -->
```js
  function renderBand() {
    const now = Date.now() / 1000
    const view = latest?.type === 'model' ? N.viewOf(latest.model, now) : null
    const notes = { sealed: '🔒 Toca y pon la clave' }
    const message = latest?.type === 'no-topic' ? 'Toca y escribe tu topic' : notes[view?.kind]
    notice.hidden = !message
    setText(notice, message || '')
    const level = view?.level
    head.hidden = !level
    if (level) {
      setPet(L.themedArt(view.art, document.documentElement.dataset.mode === 'light'))
      setText(levelName, level.name)
      setText(levelXp, `${level.into}/${level.needed} XP`)
      levelFill.style.width = `${Math.min(100, level.percent)}%`
    }
    meters.replaceChildren(...[...L.limitsOf(limits, now), ...(view?.ntfy ? [view.ntfy] : [])].map(meter))
  }
```

Los medidores se reconstruyen cada vez con `replaceChildren`, a partir de elementos creados con `createElement` y llenados con `textContent`. La cabecera se actualiza en su sitio con `setText`, que solo escribe cuando el texto cambió. Se ejecuta cuando llega un mensaje de la app, cuando llegan límites nuevos y cada 15 segundos mientras la página está visible, para que las horas de reinicio sigan avanzando.

### Los avisos y los toques

`viewOf` en `lib/state.js` decide el aviso a partir del modelo que envió la app:

| El modelo                                   | `viewOf` da  | El bloque muestra                          |
| ------------------------------------------- | ------------ | ------------------------------------------ |
| `{ type: 'no-topic' }` desde la app         | (sin modelo) | `Toca y escribe tu topic`                  |
| Sin estado, y el último mensaje no se abrió | `sealed`     | `🔒 Toca y pon la clave`                   |
| Sin estado, nada sellado                    | `empty`      | Solo los límites                           |
| Un estado                                   | `state`      | Narsil, su nivel, los límites y `ntfy hoy` |

Lee juntas la segunda y la cuarta fila, porque esconden un detalle: el aviso del candado solo aparece cuando el modelo **no tiene ningún estado**. `StateModel.receive` marca el modelo como `isSealed` cuando un mensaje no se abre, pero conserva el estado que tenía; y `viewOf` muestra un estado siempre que lo haya. Así que, si Narsil ya se estaba mostrando y llega un mensaje nuevo sellado con una clave que la app no tiene, el bloque sigue mostrando el nivel viejo, sin candado. Ves el candado en una instalación nueva, o después de cambiar el tema.

Dos toques abren la configuración, por dos caminos:

- **El aviso** es un `<button>`. Su manejador de clics envía `{ type: 'settings' }` por el puerto de la franja; `host.js` lo envuelve como `{ kind: 'port', message }`, y `MainActivity` abre `SettingsActivity` cuando el tipo de dentro es `settings`.
- **El dibujo o el nivel de Narsil.** `host.js` escucha los clics en todo el documento, en la fase de captura, y envía `{ kind: 'settings' }` cuando el destino está dentro de `#narsil-band .narsil-head`. El commit `9e514dd` explica por qué existen los dos: "The launcher shortcut is not shown by every launcher, and the band's notice only shows without a topic." (no todos los launchers muestran el acceso directo, y el aviso de la franja solo aparece sin tema).

### Lo que podría hacer quien lea tu tema

Sin clave, cualquiera que conozca tu tema también puede publicar en `<topic>-estado`. Así que nada de ahí se toma como marcado de confianza: cada valor entra con `textContent`, y un dibujo solo se muestra cuando su dirección empieza por la propia carpeta de assets de narsil-pet. El comentario del código en `lib/state.js` lo dice: "its text only ever goes in as text, and an image only comes from Narsil's own assets." (su texto solo entra como texto, y una imagen solo viene de los propios assets de Narsil). Un estado falsificado podría mostrar un nivel o una cuenta equivocados. No puede añadir un enlace, un script ni un dibujo de otro sitio. También podría llevar un `at` muy en el futuro: entonces todos los estados reales perderían frente a él, y como la app guarda el modelo por tema, que ntfy.sh olvide el mensaje pasadas 12 horas no ayudaría. Cambiar el tema empieza con un modelo vacío, y borrar los datos de la app también. La [guía 7](/es/android/encryption-and-settings/) explica cómo la clave estrecha esto, y hasta dónde.

## Constrúyelo con Claude

Pídele a Claude un bloque después del botón de búsqueda del menú lateral, alimentado desde dos lados: la propia petición de uso de la página y el estado que envía la app. La idea que debe acertar es que la página nunca tiene el tema, y que no se confía en nada de ntfy.sh.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil.

> En el script de página que mi WebView de Android ejecuta en `https://claude.ai`, añade un bloque justo después del botón de búsqueda del menú lateral, encontrado por su posición (`.df-phone-sheet-header`, si no `.dframe-nav-scroll > .shrink-0 > button`), no por su texto, y vuelve a colocarlo siempre que el observador de la página vea que se movió. Cada 60 segundos mientras la página esté visible, lee el id de la organización de la cookie `lastActiveOrg` y haz `GET /api/organizations/<id>/usage` con `credentials: 'include'`; muestra `five_hour` y `seven_day` como `5 horas` y `Semana`, con porcentaje, una barra de color (verde, ámbar desde 60, rojo desde 85) y la hora de reinicio. Del mensaje que envía la app, muestra la etiqueta `xp` dividida en nivel y puntos, un dibujo solo desde `https://raw.githubusercontent.com/davshn/narsil-pet/main/assets/`, y la fila de `usage` con clave `ntfy`, con "dato de hace N h" cuando `at` tenga más de una hora. Muestra un aviso que se pueda tocar cuando la app diga que no hay tema. Usa solo `textContent`. Mantén el análisis en un módulo sin DOM y pruébalo.

### Qué revisar en la respuesta de Claude

1. La búsqueda se encuentra por su posición, no por su texto.
2. El id de la organización se lee de la cookie cada vez y no se guarda en ningún sitio.
3. Los límites se piden cada 60 segundos, nunca mientras `document.hidden` es verdadero, y enseguida cuando la página vuelve a mostrarse.
4. La etiqueta del nivel se analiza con un patrón, y una etiqueta que no encaja oculta la cabecera en lugar de mostrar basura.
5. Una dirección de dibujo tiene que empezar por el único prefijo fijo.
6. Todo entra con `textContent` o como elementos creados, nunca como HTML.
7. El tema nunca aparece en el script de página.

Si una comprobación falla, dile a Claude lo que ves: "con Claude en español, el bloque no aparece".

### Cómo lo pidió el autor

Las palabras de quien creó Narsil registradas para esta app piden el aspecto y la franja de la extensión en una web view (L1: "que dentro en un web view muestre la web de claude y modifique sus estilos como lo hace esta extension"), así que el bloque vino sin cambios. Una petición posterior solo quedó registrada a través de su commit:

- `9e514dd` (2026-11-24) "feat: open the settings from Narsil in the band and from the service's notification" (abrir la configuración desde Narsil en la franja y desde la notificación del servicio). Su mensaje está citado arriba.

El registro de tareas recoge la comprobación en el móvil real, con el tema y la clave reales, el 2026-11-24 a las 00:44: "the band showed Narsil Nivel 28, 30/2800 XP, ntfy's count and her etapa4 art. Settings open from Narsil in the band and from the service's notification." (la franja mostró Narsil Nivel 28, 30/2800 XP, la cuenta de ntfy y su dibujo de etapa4. La configuración se abre desde Narsil en la franja y desde la notificación del servicio).

El resto se reconstruye a partir del historial de commits (el nombre de un proyecto en un asunto se reemplaza por una descripción entre corchetes):

- `3bcea35` (2026-11-24) "feat: build the script that hosts [the earlier extension] in a WebView, and what alerts and states keep" (construir el script que aloja [la extensión anterior] en una WebView, y lo que guardan los avisos y los estados).
- `53c55c1` (2026-11-24) "feat: host claude.ai with [the earlier extension] in a WebView, and show Narsil's alerts from a foreground service" (alojar claude.ai con [la extensión anterior] en una WebView, y mostrar los avisos de Narsil desde un servicio en primer plano).
- `ca01cc7` (2026-11-24) "docs: log the band verified with a signed-in session" (registrar la franja comprobada con una sesión iniciada).
- `a275382` (2026-11-24) "docs: log the alerts and the band verified with the real topic and key" (registrar los avisos y la franja comprobados con el tema y la clave reales).

Del lado del mod, `6400a6f` (2026-11-23) de narsil-pet, "feat(phone): publish Claude limits and open conversations for the watch" (publicar los límites de Claude y las conversaciones abiertas para el reloj), añadió los campos `limits` y `sessions` que el bloque le deja al reloj.

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía (MIT). Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Los límites como módulo puro, con la forma de `lib/live.js`, con una prueba. Guárdalo como `limits.js`.

```js
const colorOf = (percent) => (percent >= 85 ? '#F0435A' : percent >= 60 ? '#F5B400' : '#22B573')

export function usageUrl(cookie) {
  const org = /(?:^|; )lastActiveOrg=([0-9a-f-]{36})(?:;|$)/.exec(cookie || '')?.[1]
  return org ? `https://claude.ai/api/organizations/${org}/usage` : null
}

export function resetNote(resetsAt, now) {
  const left = Math.max(0, Math.round((resetsAt - now) / 60))
  if (left === 0) return 'ya se reinició'
  if (left < 60) return `reinicia en ${left} min`
  return `reinicia en ${Math.floor(left / 60)} h ${String(left % 60).padStart(2, '0')} min`
}

export function limitsOf(usage, now) {
  const rows = [
    ['5 horas', usage?.five_hour],
    ['Semana', usage?.seven_day],
  ]
  return rows
    .filter(([, window]) => typeof window?.utilization === 'number')
    .map(([label, window]) => ({
      label,
      percent: Math.round(window.utilization),
      color: colorOf(window.utilization),
      note: window.resets_at ? resetNote(Date.parse(window.resets_at) / 1000, now) : '',
    }))
}
```

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { limitsOf, usageUrl } from './limits.js'

test('the organization comes from the cookie, or there is no request', () => {
  const org = '00000000-0000-4000-8000-000000000000'
  assert.equal(
    usageUrl(`theme=dark; lastActiveOrg=${org}`),
    `https://claude.ai/api/organizations/${org}/usage`,
  )
  assert.equal(usageUrl('theme=dark'), null)
})

test('a window without a number is left out', () => {
  const now = Date.parse('2026-11-24T10:00:00Z') / 1000
  const usage = {
    five_hour: { utilization: 72.4, resets_at: '2026-11-24T12:05:00Z' },
    seven_day: null,
  }
  assert.deepEqual(limitsOf(usage, now), [
    { label: '5 horas', percent: 72, color: '#F5B400', note: 'reinicia en 2 h 05 min' },
  ])
})
```

El `minutesLabel` real también redacta días (`3 d 4 h`), que necesita el límite semanal; este se queda en las horas para ser corto.

## Errores comunes y cómo probarlo

- **Encontrar la búsqueda por su texto.** La etiqueta cambia con el idioma de la página. Encuéntrala por su posición.
- **Colocar el bloque una sola vez.** La página monta el menú lateral tarde, y lo vuelve a montar de vez en cuando. Vuelve a colocar el bloque en cada ejecución del observador.
- **Pedir los límites con la página oculta.** Un móvil en el bolsillo preguntaría cada minuto para nada.
- **Guardar el id de la organización.** Está en la cookie cuando lo necesitas; no hay razón para guardarlo.
- **Pedirle a ntfy.sh la cuenta desde el móvil.** La respuesta trata de la red del móvil. La cuenta tiene que venir del PC.
- **Una cuenta que nunca se mueve.** El mod solo envía su estado mientras escribes por Remote Control. En el escritorio, el bloque conserva el último y marca su antigüedad.
- **Esperar el candado después de cambiar la clave.** Si ya se mostraba un estado, un mensaje que la clave no puede abrir lo deja ahí. Sal de dudas enviando `/narsil movil prueba` después de poner la clave: un estado nuevo que se abre reemplaza al viejo.

Para probar el análisis en el PC, ejecuta el módulo de arriba con `node --test`, y lee `levelOf`, `ntfyOf` y `viewOf` en `lib/state.js` con un estado inventado. En el móvil, pon un tema inventado como `narsil-0000000000example0` en la configuración y publica después un estado en su tema `-estado` desde el PC ([ntfy: publishing](https://docs.ntfy.sh/publish/)):

```bash
curl -d '{"xp":"⭐ Nivel 2 · 40/200 XP","at":1700000000,"usage":[{"key":"ntfy","label":"ntfy hoy","percent":10,"color":"#22B573","note":"25/250 mensajes"}]}' https://ntfy.sh/narsil-0000000000example0-estado
```

Abre el menú lateral: en un segundo debería mostrar `Narsil ⭐ Nivel 2` con `40/200 XP`, y una fila `ntfy hoy` al 10 % con `25/250 mensajes` y una nota `dato de hace …`, ya que ese `at` queda muy atrás. Los límites también deberían estar, desde `claude.ai`. Toca a Narsil: debería abrirse la configuración. Vuelve a poner tu tema real cuando termines.

### Dónde difieren el código y el README

- El README dice que, si la clave no es la que selló los mensajes, la franja dice "🔒 Toca y pon la clave". El código solo lo muestra cuando la app todavía no tiene ningún estado para el tema; con un estado anterior guardado, el bloque lo sigue mostrando, como se explica arriba.
- El README sitúa el toque que abre la configuración en "The band in Claude's side menu" (la franja del menú lateral de Claude). En el código, ese elemento es efectivamente `#narsil-band`; la franja encima de la caja de texto es `#narsil-event`, y un toque ahí solo expande su texto.

## Para ir más lejos

- La [guía 5](/es/android/colors-and-mode/) viste toda la página con los colores de Narsil, y el bloque con ella.
- La [guía 7](/es/android/encryption-and-settings/) explica el candado, la clave y la configuración que abre el bloque.
- Del lado del mod, [Avisos en el móvil y el reloj](/es/mods/pet/phone-and-watch/) describe los campos de `-estado`, el límite diario de 200 y `ntfyRow`.
- [Narsil Watch](/es/watch/what-it-is/) lee el mismo estado, incluidos los campos `limits` y `sessions` que el bloque deja de lado.
- El código fuente está en [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
