---
title: Los colores y el icono de Narsil
description: 'Cómo Narsil en Claude viste claude.ai con los colores de mar nocturno de Narsil Skin, claros de día y oscuros de noche según el reloj del móvil, y le da su icono a la app de inicio.'
route: claude
order: 4
updated: 2026-11-18
---

## Qué hace

Con la extensión activa, toda la página de `claude.ai` lleva la paleta de mar nocturno de [Narsil Skin](https://github.com/davshn/narsil-skin): azules profundos de noche, azules marinos pálidos de día. Cambia:

- **Los colores de la página**: fondos, paneles, texto, bordes, acentos y el menú lateral.
- **Los bloques de código**, tanto en el chat como en las diferencias de código, para que combinen con el resto.
- **Algunos detalles**: la caja de mensajes recibe un borde fino que toma el color de acento cuando escribes, el texto que seleccionas toma el color de acento, todo el texto va en negrita como en el tema, y la chispa naranja que aparece mientras Claude trabaja se vuelve morada.

Es clara de 6:00 a 17:59 y oscura de 18:00 a 5:59, según el reloj del móvil, sea cual sea la apariencia que elegiste en la propia configuración de Claude.

Y cuando añades `claude.ai` a la pantalla de inicio con la extensión activa, la app recibe el icono de Narsil en lugar del de Claude.

> **Experimental.** Los colores funcionan sustituyendo las variables de diseño que la página de `claude.ai` declara para sí misma, y el modo reescribiendo un atributo de la página. Ninguna de las dos cosas es una API pública, así que una actualización de Claude puede renombrarlas y la página vuelve a los colores propios de Claude, sin que nada se rompa. La extensión solo cambia cómo se ve la página en tu móvil: no escribe nada en tu cuenta. Para mostrar el icono de la pantalla de inicio, el navegador lo descarga de la dirección de la app web del móvil de Narsil, `narsil-pwa.vercel.app`, solo cuando instalas la app.

## Cómo funciona por dentro

Los colores y el icono son el primer grupo de scripts de contenido del manifiesto, el que se ejecuta en `document_start`, antes de que la página dibuje nada ([MDN: content_scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_scripts)). Contiene una hoja de estilos, `skin.css`, y cuatro pequeños scripts: `lib/watch.js` (el observador de la página que describe la [guía 2](/es/mods/claude/conversation-band/)), `lib/mode.js` y `mode.js` (la hora), y `lib/manifest.js` y `app-icon.js` (el icono).

Ejecutarse tan pronto importa: una hoja de estilos que llegara después de que la página se dibujara mostraría primero, por un momento, los colores propios de Claude. El comentario del código lo dice claramente: los colores propios de la página "never flash first" (nunca aparecen primero).

### Solo las variables de la página, no un diseño nuevo

La página de `claude.ai` no fija sus colores en el código. Los declara como propiedades personalizadas de CSS, como `--cds-page-bg` para el fondo de la página y `--cds-text-primary` para el texto principal, y cada parte de la página las lee ([MDN: Using CSS custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)). Tiene dos conjuntos, uno para cada modo, elegidos por un atributo `data-mode`.

Así que `skin.css` no vuelve a dar estilo a botones, menús y paneles uno por uno. Les da valores nuevos a esas mismas variables, un bloque para `data-mode="dark"` y otro para `data-mode="light"`, cada uno marcado con `!important` para que gane sobre las declaraciones propias de la página. El bloque oscuro se construye con los azules nocturnos del tema, como `#0f1a2c` para la página; el claro, con sus azules marinos pálidos, como `#c9e7f1`. El texto secundario y el atenuado son el texto principal mezclado con transparencia (`color-mix()`), así que conservan el mismo tono.

Hay una trampa que explican los comentarios de la hoja de estilos: la página no declara las variables solo en `<html>`. Cada parte que monta con su propia raíz las vuelve a declarar para sí, así que una regla solo en `<html>` dura únicamente hasta que aparece esa parte. Las reglas cubren también esas raíces.

Algunas cosas no usan las variables y tienen sus propias reglas: el fondo del menú lateral, las diferencias de código y los bloques de código del chat.

### Por qué solo colores y estilos, sin fondo animado

Narsil Skin en el escritorio puede dibujar un fondo de pantalla en vivo detrás de Claude. La extensión no conserva nada de eso. El comentario al principio de `skin.css` dice que toma "only the page's own design variables and a few parts" (solo las propias variables de diseño de la página y algunas partes), y nada del fondo de pantalla, las olas o las estrellas del tema; el README dice lo mismo: solo los colores y estilos del tema, sin fondos animados.

Ninguno de los dos dice por qué. Una razón probable es el propio móvil: una capa animada detrás de una página que ya se vuelve a dibujar muchas veces por segundo mientras Claude escribe costaría batería y fotogramas, y el trabajo posterior de la extensión (abajo) consistió en hacer la página más ligera. Cambiar variables no cuesta casi nada, porque la página ya las lee.

### Los bloques de código en modo claro

Los bloques de código del chat eran un caso especial. Sus tokens se colorean en línea, en cada `<pre>`, con la paleta oscura de la página, incluso cuando se fuerza el modo claro. En modo claro, tokens pálidos sobre un fondo pálido apenas se podían leer.

El commit `127ca62` (2026-11-13) "style: darken code block tokens in light mode" (oscurecer los tokens de los bloques de código en modo claro) lo arregla con un filtro, no con una paleta nueva. Selecciona solo los bloques de código en modo claro cuyo color base en línea es el de la paleta oscura, los invierte y gira el tono media vuelta ([MDN: filter](https://developer.mozilla.org/en-US/docs/Web/CSS/filter)). Invertir convierte lo pálido en oscuro; girar el tono 180 grados devuelve cada color a su propio tono, así que una palabra clave azul pálido se vuelve de un azul más oscuro, no naranja. Un poco más de saturación evita que se vean desvaídos.

Las diferencias de código funcionan de otra manera: viven dentro de una shadow root, que las reglas de la página no pueden alcanzar. Pero las propiedades personalizadas pasan dentro de una shadow root, y una regla sobre el elemento que la aloja gana a las reglas propias de la shadow root, así que `skin.css` fija las variables de fondo y de texto de la diferencia en ese elemento anfitrión.

### Clara de día, oscura de noche, según el reloj del móvil

La regla está en `lib/mode.js`: una hora de 6 hasta 17 es de día y recibe `light`; cualquier otra hora recibe `dark`. Su comentario dice que sigue las mismas horas que el tema automático de Narsil Skin.

`mode.js` la aplica. Busca cada elemento cuyo `data-mode` sea `light`, `dark` o `system`, y lo fija en el modo de la hora actual. No cualquier `data-mode`: la página también usa `data-mode="code"` para otra cosa, y ese se deja en paz. Solo escribe cuando el valor es distinto, para no despertar al observador de la página sin motivo.

Como la propia configuración de apariencia de Claude funciona mediante el mismo atributo, el modo de la extensión gana sobre ella: elijas lo que elijas, la siguiente ejecución vuelve a poner el modo de la hora.

Se vuelve a ejecutar:

- **Cuando la página cambia**, mediante el único observador de la página, que también escucha los cambios del propio `data-mode`. Cuando la página monta una parte nueva con su propio `data-mode`, o lo devuelve a tu configuración de Claude, se corrige en un fotograma.
- **Cada minuto**, porque la hora puede cambiar a las 6:00 o a las 18:00 sin ningún cambio en la página.
- **Cuando la página vuelve a estar visible**, ya que una página oculta no ejecuta fotogramas y el móvil puede haber estado dormido durante el cambio.

### Conversaciones más rápidas

El 2026-11-11, el commit `ce7d17e` "perf: lighten the styles and the page observers so claude.ai switches conversations faster" (aligerar los estilos y los observadores de la página para que claude.ai cambie de conversación más rápido) descubrió que los propios colores estaban ralentizando la página. Su mensaje nombra tres cambios:

1. **Dos variables de color atenuado** se fijaban antes en cada elemento. Una propiedad personalizada fijada en cada elemento hace que cada uno lleve su propia copia, y cada recálculo de estilos lo paga. Ahora se fijan solo en los elementos donde la propia página las declara, y se heredan desde ahí.
2. **La regla de la negrita** excluía antes las partes propias de Narsil con un `:not()` de descendientes, lo que obliga al navegador a recorrer los ancestros de cada elemento en cada recálculo. Pasó a ser una regla simple para todo el texto, y la hoja de estilos propia de la franja vuelve a fijar sus pesos.
3. **Un solo observador** para todos los scripts de contenido, ejecutado como mucho una vez por fotograma, en lugar de uno por script.

### Cuando Vivaldi se salta los colores o el modo

Vivaldi para Android trajo dos problemas propios, explicados en la [guía 5](/es/mods/claude/android-packaging/): después de que Android cierre Vivaldi y este se vuelva a abrir, puede cargar la franja sin sus hojas de estilos, o saltarse todo el grupo de `document_start`, de modo que `mode.js` nunca se ejecuta y la página mantiene el modo propio de Claude.

Los arreglos permiten que la página note lo que falta y lo pida:

- **`a1e01b6`** (2026-11-18): cada hoja de estilos termina fijando una marca propia en `:root`, una propiedad personalizada como `--narsil-css-skin: 1`. Cuando la franja arranca, lee las marcas con `getComputedStyle`; una hoja de estilos cuya marca está vacía no llegó.
- **`8e31a1d`** (2026-11-18): la franja también comprueba que `lib/mode.js` haya dejado su función en la página. Si no, el primer grupo no se ejecutó.

En los dos casos la franja le pide al script de fondo las piezas que faltan, y el script de fondo vuelve a poner solo las hojas de estilos y los grupos del propio manifiesto, primero los estilos.

### El icono de la pantalla de inicio

Cuando añades una página a la pantalla de inicio, el navegador lee su manifiesto de aplicación web, el archivo que la página nombra en un `<link rel="manifest">` ([MDN: Web application manifest](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest)). Su miembro `icons` dice qué imágenes recibe la app ([MDN: icons](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons)).

Así que la extensión no toca la pantalla de inicio. Cambia qué manifiesto ofrece la página:

1. **`lib/manifest.js` construye un manifiesto** que es Claude tal cual: el nombre `Claude`, visualización independiente (standalone), inicio y ámbito en `https://claude.ai/`, el azul de mar nocturno como color de fondo y de tema, y dos iconos, de 192 y 512 píxeles.
2. **Lo convierte en una dirección** propia: una URL `data:` con el tipo `application/manifest+json` y el JSON codificado en ella. No se descarga nada para el manifiesto en sí.
3. **`app-icon.js` apunta el enlace de la página hacia ella**: encuentra el `<link rel="manifest">` y sustituye su `href`, si no es ya esa. El observador de la página escucha los cambios de `href`, así que si la página vuelve a poner su propio manifiesto, la siguiente ejecución lo cambia otra vez.

Los iconos no están dentro de la extensión. Un manifiesto `data:` no tiene una dirección propia contra la que resolver una ruta de icono relativa, así que los iconos necesitan direcciones completas, y apuntan a donde la app web del móvil de Narsil ya los sirve: `https://narsil-pwa.vercel.app`. El navegador los descarga solo cuando instalas la app.

### Por qué el icono se fija al instalar

El navegador copia el icono cuando crea la app de la pantalla de inicio; no se lo vuelve a preguntar a la página cada vez que la abres. El mensaje del commit `083c03d` lo dice: "The icon is set at install, so an app already installed has to be installed again." (el icono se fija al instalar, así que una app ya instalada tiene que instalarse de nuevo).

Eso tiene dos consecuencias que el README explica:

- **Si ya tenías `claude.ai` en la pantalla de inicio**, quítala y vuelve a añadirla con la extensión activa.
- **Si quitas la extensión**, la app conserva el icono de Narsil. No hay nada en marcha que lo cambie de vuelta; se queda hasta que vuelvas a instalar la app.

El icono se probó en Firefox para Android, donde la extensión lo añade desde el menú con **Instalar** o **Añadir a la pantalla de inicio**. En Vivaldi no se ha probado.

## Cómo se le pidió a la IA

No quedó registrada ninguna petición sobre los colores ni el icono. Las palabras de quien creó Narsil registradas para esta ruta tratan del sitio (la [guía 1](/es/mods/claude/what-it-is/) las cita). Lo siguiente se reconstruye a partir del historial de commits de la extensión:

- `0d65509` (2026-11-09) "feat: wear Narsil's colors on claude.ai, light by day and dark by night" (vestir claude.ai con los colores de Narsil, claros de día y oscuros de noche). Su mensaje describe el enfoque: sustituye las propias variables de diseño de la página por la paleta de mar nocturno, "without its wallpaper" (sin su fondo de pantalla), y sigue las mismas horas que el modo automático del tema.
- `083c03d` (2026-11-09) "feat: give claude.ai Narsil's icon when it is installed from Firefox" (darle a claude.ai el icono de Narsil cuando se instala desde Firefox). Le ofrece a Firefox un manifiesto con sus iconos en lugar del propio de la página.
- `ce7d17e` (2026-11-11) "perf: lighten the styles and the page observers so claude.ai switches conversations faster" (aligerar los estilos y los observadores de la página para que claude.ai cambie de conversación más rápido).
- `127ca62` (2026-11-13) "style: darken code block tokens in light mode" (oscurecer los tokens de los bloques de código en modo claro).
- `a1e01b6` (2026-11-18) "fix: ask for the styles when Vivaldi loads the band without them" (pedir los estilos cuando Vivaldi carga la franja sin ellos).
- `8e31a1d` (2026-11-18) "fix: run the light and dark switch again when Vivaldi skips it" (volver a ejecutar el cambio entre claro y oscuro cuando Vivaldi se lo salta).

El historial se lee como un primer día que dejó bien el aspecto, seguido de trabajo sobre lo que costaba ese aspecto: velocidad en una página larga, legibilidad en un rincón, y la costumbre de Vivaldi de cargar solo parte de la extensión.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil.

> En mi extensión de Firefox para `https://claude.ai/*`, añade un grupo de scripts de contenido en `document_start` con una hoja de estilos y dos scripts. La hoja de estilos sustituye solo las propiedades personalizadas de CSS propias de la página, un bloque para `[data-mode="dark"]` y otro para `[data-mode="light"]`, con `!important`; sin fondos, imágenes ni animaciones. El primer script fija cada elemento cuyo `data-mode` sea `light`, `dark` o `system` en `light` de 6:00 a 17:59 hora local y en `dark` el resto del tiempo, escribiendo solo cuando el valor es distinto; se ejecuta desde un único `MutationObserver` limitado con `requestAnimationFrame`, cada 60 segundos y en `visibilitychange`. El segundo script sustituye el `href` del `<link rel="manifest">` de la página por una URL `data:application/manifest+json` que contiene un manifiesto con URLs absolutas de iconos en `https://example.com`. Mantén la regla de la hora en su propio módulo y pruébala con `node --test`.

## El código mínimo

Las mismas tres piezas, escritas para esta guía (MIT). Los nombres de las variables son los que declara hoy la página de `claude.ai`; los colores son dos de la paleta de mar nocturno; la dirección del icono es un marcador para la tuya.

`skin.css`:

```css
html[data-mode='dark'],
[data-mode='dark'] {
  --cds-page-bg: #0f1a2c !important;
  --cds-text-primary: #dce6fa !important;
}

html[data-mode='light'],
[data-mode='light'] {
  --cds-page-bg: #c9e7f1 !important;
  --cds-text-primary: #0f2f47 !important;
}
```

`mode.js`:

```js
const modeAt = (hour) => (hour >= 6 && hour < 18 ? 'light' : 'dark')
const themed = '[data-mode="light"],[data-mode="dark"],[data-mode="system"]'

function applyMode() {
  const mode = modeAt(new Date().getHours())
  document.querySelectorAll(themed).forEach((element) => {
    if (element.dataset.mode !== mode) element.dataset.mode = mode
  })
}

const icons = [192, 512].map((size) => ({
  src: `https://example.com/icons/icon-${size}.png`,
  sizes: `${size}x${size}`,
  type: 'image/png',
}))
const manifest = { name: 'Claude', display: 'standalone', start_url: 'https://claude.ai/', icons }
const manifestUrl = `data:application/manifest+json,${encodeURIComponent(JSON.stringify(manifest))}`

function applyIcon() {
  const link = document.querySelector('link[rel~="manifest"]')
  if (link && link.getAttribute('href') !== manifestUrl) link.setAttribute('href', manifestUrl)
}

let queued = false
new MutationObserver(() => {
  if (queued) return
  queued = true
  requestAnimationFrame(() => {
    queued = false
    applyMode()
    applyIcon()
  })
}).observe(document.documentElement, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ['data-mode', 'href'],
})

setInterval(applyMode, 60_000)
document.addEventListener('visibilitychange', applyMode)
applyMode()
applyIcon()
```

En el manifiesto, los dos van en una misma entrada de scripts de contenido con `"run_at": "document_start"` y `"matches": ["https://claude.ai/*"]`. En `document_start` la página todavía no tiene cuerpo, y por eso todo espera al observador ([MDN: MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)): el observador se dispara a medida que la página se construye, y cada ejecución arregla lo que ya apareció. El `attributeFilter` reduce los cambios de atributos a los dos que le importan al script.

## Errores comunes y cómo probarlo

- **Cargar los colores en `document_idle`.** La página se dibuja primero con los colores de Claude y después cambia. Carga la hoja de estilos en `document_start`.
- **Dar estilo a las partes en lugar de a las variables.** Cada botón y cada panel necesitan su propia regla, y cada actualización de Claude rompe alguna. Sustituye las variables que la página ya lee.
- **Fijar las variables solo en `<html>`.** Partes de la página las vuelven a declarar en sus propias raíces. Cubre también esas raíces, y comprueba que un panel recién abierto conserve los colores.
- **Fijar una propiedad personalizada en cada elemento.** Funciona, y ralentiza cada recálculo de estilos. Fíjala donde la página la declara y deja que se herede.
- **Reescribir cualquier `data-mode`.** La página usa `data-mode="code"` para otra cosa. Selecciona solo `light`, `dark` y `system`.
- **Escribir cuando nada cambió.** Cada escritura despierta al observador, que vuelve a escribir. Compara primero.
- **Esperar a que la página cambie a las 18:00.** Puede que no cambie. Comprueba la hora con un temporizador, y cuando la página vuelva a estar visible.
- **Una ruta de icono relativa en un manifiesto `data:`.** No tiene contra qué resolverse. Usa direcciones completas.
- **Esperar que el icono cambie en una app ya instalada.** Se fijó al instalarla. Quita la app y vuelve a añadirla.

Para probar la regla de la hora, mantenla en un módulo sin DOM y comprueba los bordes: 5, 6, 17 y 18 deberían dar `dark`, `light`, `light` y `dark`. Para probar la página, cambia la hora del móvil a las 17:59 y espera a las 18:00, o fija la hora a mano en la regla mientras desarrollas: la página debería cambiar en menos de un minuto sin recargar. Después cambia la propia configuración de apariencia de Claude: la página debería volver enseguida al modo de la hora. Para el icono, abre `claude.ai` con la extensión activa, añádela a la pantalla de inicio y comprueba que la app nueva muestre tu icono; quita la extensión y comprueba que se queda.

## Para ir más lejos

- La [guía 5](/es/mods/claude/android-packaging/) explica por qué Vivaldi a veces carga la extensión por partes, y cómo el script de fondo vuelve a poner los estilos.
- [Narsil Skin](https://github.com/davshn/narsil-skin) tiene el tema completo de mar nocturno para el escritorio, con el fondo de pantalla incluido, y otros temas cuyas variables se podrían trasladar de la misma forma.
- Las horas podrían seguir el amanecer y el atardecer en lugar de unas 6:00 y 18:00 fijas. La regla vive en una pequeña función, así que solo cambiaría esa función.
