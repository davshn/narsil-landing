---
title: La franja sobre la caja de texto
description: 'La franja que Narsil en Claude dibuja sobre la caja de texto de claude.ai: su pose, el estado, el contexto, la cuenta atrás de la caché y el último evento, leídos de los datos de la página.'
route: claude
order: 2
updated: 2026-11-18
---

## Qué hace

Cuando abres una conversación en `claude.ai/code`, aparece una franja justo encima de la caja donde escribes. De izquierda a derecha y de arriba abajo muestra:

- **Narsil**, en su etapa actual y en la pose del estado de la conversación.
- **El estado**, como una etiqueta de color: `TRABAJANDO` (azul), `TE NECESITA` (ámbar), `TERMINADA` (verde) o `EN REPOSO` (gris). El borde izquierdo de la franja toma el mismo color.
- **El contexto**, como `Contexto 42 %`: cuánto de su ventana ha usado la conversación, en verde, ámbar o rojo.
- **La caché**, como `🧊 38 min`: los minutos que faltan para que caduque la caché del prompt, hasta que pasa a `🧊 fría`.
- **El último evento**: lo último que dijo Claude, o `Usando Bash` cuando Claude solo está ejecutando una herramienta, con hace cuánto, como `hace 3 min`.

El texto ocupa dos líneas. Un toque lo abre entero y otro toque lo cierra. La franja empuja la conversación hacia arriba en lugar de taparla, y se actualiza cada 10 segundos mientras la pantalla está visible.

> **Experimental.** La franja lee los mismos datos que la página de `claude.ai` carga para sí misma, desde direcciones internas que no son una API pública, y encuentra la caja de texto por la estructura de la página. Una actualización de Claude puede romperla; cuando pasa, la franja simplemente deja de mostrarse. Solo lee: nunca escribe en tu cuenta ni envía tus conversaciones a ningún sitio, aunque la extensión carga los dibujos de Narsil desde GitHub y lee su tema de estado en ntfy.sh.

Todo lo que hay en la franja viene del propio `claude.ai`, así que no necesita ningún mensaje de tu ordenador. Solo dos detalles dependen de [el mod narsil-pet](https://github.com/davshn/narsil-pet): la etapa de Narsil en el dibujo y cuánto dura la caché.

## Cómo funciona por dentro

La franja la dibuja el script de contenido `extension/content.js`. Lo que saca de los datos vive en `extension/lib/live.js`, un módulo sin código de DOM, lo que permite probar las reglas por separado.

### De dónde vienen los datos: las propias peticiones de la página

La franja no lee la conversación de la pantalla. Le hace a `claude.ai` las mismas preguntas que hace la página, con tu sesión, y lee las respuestas como JSON. Salen dos peticiones a la vez:

- **La lista de tus conversaciones**, activas y en pausa, hasta 50 (`/v1/code/sessions` en `claude.ai`). La franja toma la que tienes abierta, encontrada por el id de la dirección de la página (`/code/session_…`). La dirección y la lista pueden nombrar la misma conversación con prefijos distintos, así que los ids se comparan sin ellos.
- **Los últimos 60 eventos de esa conversación**, del más reciente al más antiguo (`/v1/code/sessions/<id>/events`).

Son direcciones internas de `claude.ai`. El código lo dice justo encima de ellas: "These addresses are not a public API and may change." (estas direcciones no son una API pública y pueden cambiar). Son la razón principal de que la extensión sea experimental.

Para enviar las peticiones "como la propia página, con su sesión", el script de contenido usa `content.fetch` de Firefox cuando existe. MDN explica que en Firefox, con Manifest V2, `content.fetch()` hace "requests that behave as if they were sent by the content itself" (peticiones que se comportan como si las enviara el propio contenido); en Manifest V3 no está disponible, y el `fetch` propio de un script de contenido ya se ejecuta en el contexto de la página ([MDN: Content scripts, XHR and Fetch](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts#xhr_and_fetch)). Así que la extensión de Firefox usa `content.fetch` y el paquete Chromium para Vivaldi recurre a `fetch`. Los dos envían tus cookies (`credentials: 'include'`), así que `claude.ai` responde como le responde a la página. Son solo peticiones `GET`, y las respuestas se quedan en la página.

### De qué está hecho cada valor

`liveOf` en `lib/live.js` convierte la conversación y sus eventos en lo que muestra la franja:

| Valor         | Hecho a partir de                                                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Estado        | El `status_bucket` de la conversación: `working`, `blocked` o `completed`; cualquier otra cosa es `EN REPOSO`.                          |
| Contexto      | `context_usage` en los metadatos de la conversación: tokens usados sobre el máximo de la ventana, redondeado a un porcentaje.           |
| Último evento | El mensaje más reciente de Claude que tiene texto; si solo tiene una llamada a una herramienta, `Usando` y el nombre de la herramienta. |
| Cuándo        | La hora de ese mensaje, como `ahora mismo`, `hace 5 min`, `hace 2 h` o `hace 1 d`.                                                      |
| Caché         | Ese mismo mensaje más reciente de Claude, más cuánto dura la caché (abajo).                                                             |

Dos reglas mantienen útil el último evento. Un pensamiento solo no dice nada, así que se salta un mensaje sin texto y sin herramienta. Y solo cuentan los mensajes de Claude: la conversación tiene muchos otros tipos de eventos.

El contexto y la caché comparten un mismo coloreado: verde por debajo del 60 %, ámbar desde el 60 %, rojo desde el 85 %, los mismos umbrales que usan los límites del menú lateral. Para la caché, el porcentaje es cuánto de su tiempo ha pasado.

### El dibujo de Narsil: la pose desde la página, la etapa desde el mod

La pose sigue al estado: trabajando, necesitándote, terminada o de pie en reposo. Su etapa no es algo que sepa `claude.ai`. Viene del mod: el estado que narsil-pet envía por ntfy.sh lleva la dirección de su dibujo, y su etapa es la carpeta de esa dirección ([Experiencia y crecimiento](/es/mods/pet/experience-and-growth/) explica las etapas). La franja toma de ahí la etapa, pone la pose de esta conversación y elige la variante clara u oscura según la página.

Solo se aceptan dibujos de los recursos propios de narsil-pet en GitHub. Cuando no hay estado del mod, o un dibujo no carga, la franja muestra en su lugar el icono propio de la extensión, y un dibujo que falló no se vuelve a pedir.

### Por qué la caché es una estimación

`claude.ai` no dice cuándo caduca la caché de una conversación, así que la franja la estima: **la hora del último mensaje de Claude más lo que dura una caché**.

- **Desde el último mensaje de Claude**, no desde el último evento de la conversación. El commit que añadió la franja explica por qué: "as any event moves the session's own time" (porque cualquier evento mueve la propia hora de la sesión). El código añade que abrir la página genera algunos eventos propios, que reiniciarían la cuenta atrás cada vez que miras.
- **Cuánto dura** es cosa del mod: narsil-pet envía `cacheMinutes` en su estado ([El reloj de la caché](/es/mods/pet/cache-clock/) explica cómo decide entre 60 y 5 minutos). Sin ese valor, la franja supone 60 minutos.

Así que la cuenta atrás puede desviarse: la caché empieza en realidad desde la petición, no desde el mensaje, y sin el mod una caché de 5 minutos se muestra como de 60. Lee `🧊 38 min` como "unos 38 minutos".

### Cada 10 segundos, solo mientras miras

La franja pide datos nuevos cada 10 segundos, y ninguno mientras la página está oculta (la pantalla apagada, otra app u otra pestaña delante). Cuando la página vuelve a estar visible, pide enseguida, con el evento [`visibilitychange`](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event). Entre peticiones, se vuelve a dibujar cada 15 segundos, para que la cuenta atrás y el "hace" sigan avanzando. Si una petición falla, lo último que sabía se queda hasta la siguiente.

### En el flujo de la página, para no tapar nada

La franja no es una capa flotante. Es un elemento normal insertado justo antes de la caja de texto, como su hermano anterior. La caja de texto se encuentra por un atributo que la página le pone. Como la franja forma parte del propio diseño de la página, la conversación de arriba simplemente termina un poco más arriba; no queda nada escondido detrás.

El texto se limita a dos líneas con CSS ([`line-clamp`](https://developer.mozilla.org/en-US/docs/Web/CSS/line-clamp)). Un toque alterna una clase que quita el límite y deja que el texto se desplace dentro de una caja de como mucho el 40 % de la altura de la pantalla. Todo el texto entra con `textContent`, nunca como HTML.

### Seguir a la página mientras cambia

`claude.ai` es una aplicación de una sola página: abrir otra conversación cambia la dirección y el contenido sin cargar una página nueva, y la página reconstruye la caja de texto de vez en cuando. Así que la franja no se puede colocar una sola vez.

`extension/lib/watch.js` contiene el único [`MutationObserver`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) de la extensión, que observa todo el documento. Mientras Claude escribe, la página cambia muchas veces por fotograma, así que el observador no ejecuta sus funciones en cada cambio: las programa una vez por fotograma con [`requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame). En cada ejecución, la franja comprueba dos cosas:

- **¿Sigue justo encima de la caja de texto?** Si no, vuelve ahí.
- **¿Sigue siendo la misma conversación?** La franja compara el id de la dirección con el último por el que preguntó. Cuando cambia, se descartan los datos viejos, la franja desaparece y se piden datos nuevos enseguida.

La franja escribe un valor solo cuando cambió, porque cada escritura suya es un cambio más para el observador. Y el observador se detiene, con todo lo que lo usaba, en cuanto la extensión se quita o se recarga, para que una copia huérfana no siga dibujando.

## Cómo se le pidió a la IA

No quedó registrada ninguna petición sobre la franja. Las palabras de quien creó Narsil registradas para esta ruta tratan del sitio (la [guía 1](/es/mods/claude/what-it-is/) las cita). Lo siguiente se reconstruye a partir del historial de commits de la extensión:

- `c200e8a` (2026-11-09) "feat: show Narsil's state in claude.ai's sidebar on Firefox for Android" (mostrar el estado de Narsil en el menú lateral de claude.ai en Firefox para Android). La primera versión mostraba las conversaciones en un panel del menú lateral, alimentado por el mod a través de ntfy.sh.
- `19677ac` (2026-11-09) "feat: show each conversation's state, context and cache above the prompt" (mostrar el estado, el contexto y la caché de cada conversación sobre la caja de texto). Nace la franja. Su mensaje la describe como "read from the same addresses claude.ai uses, so it needs no message from the PC" (leída de las mismas direcciones que usa claude.ai, así que no necesita ningún mensaje del PC), y explica la regla de la caché citada arriba.
- `00adbb9` (2026-11-09) "feat: show only Narsil's level, the limits and ntfy's count in the sidebar" (mostrar solo el nivel de Narsil, los límites y la cuenta de ntfy en el menú lateral). El panel y sus avisos se quitaron, "as each conversation's strip covers them" (porque la franja de cada conversación ya los cubre).
- `ce7d17e` (2026-11-11) "perf: lighten the styles and the page observers so claude.ai switches conversations faster" (aligerar los estilos y los observadores de la página para que claude.ai cambie de conversación más rápido). El observador único, limitado a una ejecución por fotograma.
- `1d9db3d` (2026-11-11) "fix: load the page observer with the band and stop when the extension goes away" (cargar el observador de la página con la franja y detenerse cuando la extensión desaparece).

El historial muestra un paso de datos enviados por el ordenador a datos que la página ya tenía: la franja funciona en cuanto abres una conversación, incluso con el ordenador apagado.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil.

> En mi extensión de Firefox para `https://claude.ai/*`, añade un script de contenido que dibuje una franja de estado justo antes de la caja de texto de la página, como su hermano anterior, para que empuje la conversación hacia arriba en lugar de taparla. Encuentra el id de la conversación en `location.pathname`. Cada 10 segundos, y solo mientras `document.hidden` sea falso, lee los datos de la conversación con la propia sesión de la página (`content.fetch` cuando exista, si no `fetch`, con `credentials: 'include'`), solo con `GET`. Muestra el estado, el porcentaje de contexto, el último texto que escribió Claude y hace cuánto, y una cuenta atrás de la caché estimada a partir de la hora del último mensaje de Claude más 60 minutos. Usa un solo `MutationObserver` sobre el documento, limitado con `requestAnimationFrame`, para volver a colocar la franja cuando la página se reconstruya y para reiniciarla cuando cambie la conversación. Escribe el texto solo con `textContent`. Limita el texto a dos líneas y deja que un toque lo expanda. Mantén las reglas en un módulo sin código de DOM, y pruébalas con `node --test`.

## El código mínimo

Un pequeño script de contenido con la misma forma, escrito para esta guía (MIT). `readConversation` representa lo que lea tus datos; aquí devuelve la hora del último mensaje de Claude, en segundos. El resto es la mecánica de la franja: colocarla, seguir a la página, actualizarla mientras está visible y estimar la caché.

```js
const BOX = '[data-cds=ChatComposer]'
const CACHE_MINUTES = 60
const band = document.createElement('div')
band.id = 'my-band'
const text = document.createElement('span')
band.append(text)
band.addEventListener('click', () => band.classList.toggle('open'))

let lastSaidAt = null

function cacheLabel(saidAt, now) {
  const left = Math.ceil((saidAt + CACHE_MINUTES * 60 - now) / 60)
  return left > 0 ? `🧊 ${left} min` : '🧊 cold'
}

function draw() {
  const box = document.querySelector(BOX)
  if (!box || lastSaidAt === null) {
    band.remove()
    return
  }
  const label = cacheLabel(lastSaidAt, Date.now() / 1000)
  if (text.textContent !== label) text.textContent = label
  if (box.previousElementSibling !== band) box.before(band)
}

async function refresh() {
  if (document.hidden) return
  try {
    lastSaidAt = await readConversation(location.pathname)
  } catch {
    return
  }
  draw()
}

let queued = false
new MutationObserver(() => {
  if (queued) return
  queued = true
  requestAnimationFrame(() => {
    queued = false
    draw()
  })
}).observe(document.documentElement, { childList: true, subtree: true })

document.addEventListener('visibilitychange', refresh)
setInterval(refresh, 10_000)
refresh()
```

El CSS de las dos líneas y del toque:

```css
#my-band span {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

#my-band.open span {
  display: block;
  max-height: 40dvh;
  overflow-y: auto;
}
```

`BOX` es el atributo que `claude.ai` pone hoy en su caja de texto; si Claude lo renombra, esta es la línea que se rompe. Comparar `box.previousElementSibling` antes de llamar a [`before()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/before) importa: mover la franja en cada fotograma sería un cambio en sí mismo, y el observador volvería a despertar.

## Errores comunes y cómo probarlo

- **Un observador por funcionalidad.** Varios observadores en una página que cambia muchas veces por fotograma se van sumando. Usa uno solo, y ejecuta su trabajo como mucho una vez por fotograma.
- **Escribir en cada ejecución.** Asignar `textContent` o mover la franja cuando nada cambió vuelve a disparar el observador. Compara primero.
- **Una franja flotante.** Una franja con `position: fixed` tapa las últimas líneas de la conversación y los botones que Claude muestra ahí. Insértala en el flujo de la página.
- **Peticiones con la página oculta.** Un móvil con la pantalla apagada seguiría preguntando cada 10 segundos. Comprueba `document.hidden` y escucha `visibilitychange`.
- **La caché desde el último evento.** Abrir la página crea eventos, así que contar desde el último reinicia la cuenta atrás cada vez que miras. Cuenta desde el último mensaje de Claude.
- **Texto como HTML.** Los mensajes de Claude pueden contener cualquier cosa. Usa `textContent`, nunca `innerHTML`.
- **No reiniciar con una conversación nueva.** Sin comparar el id de la dirección, la franja muestra los datos de la conversación anterior durante hasta 10 segundos.

Para probar las reglas, mantenlas en un módulo sin DOM, como hace `lib/live.js`, y dales eventos inventados: una lista en la que el mensaje más reciente de Claude solo tiene una llamada a una herramienta debería dar `Usando` y el nombre de la herramienta, y un mensaje de hace 61 minutos debería dar la caché fría. Para probar la franja en sí, abre una conversación, cambia a otra y vuelve, gira el móvil y apaga y enciende la pantalla: la franja debería quedarse sobre la caja de texto, cambiar con la conversación y actualizarse en los 10 segundos siguientes a que vuelva la pantalla.

## Para ir más lejos

- La [guía 3](/es/mods/claude/sidebar/) explica el bloque del menú lateral, que añade lo que la página no puede saber.
- Dentro de Claude Code, Narsil muestra los mismos estados con sus propias reglas: mira [El reloj de la caché](/es/mods/pet/cache-clock/) y [Contexto y límites](/es/mods/pet/context-and-limits/).
- La franja podría avisarte cuando la caché esté a punto de enfriarse. Necesitaría la duración real de la caché, y por eso la extensión la toma del mod cuando puede.
