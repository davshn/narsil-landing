---
title: Los colores de Narsil, de día y de noche
description: 'Cómo skin.css viste claude.ai con la paleta de mar nocturno de Narsil Skin, cómo mode.js elige claro u oscuro según la hora diga lo que diga Claude, y cómo las barras lo siguen sin destellos.'
route: android
order: 5
updated: 2026-11-24
sources:
  - repo: android
    path: app/src/main/assets/page/skin.css
  - repo: android
    path: app/src/main/assets/page/mode.js
  - repo: android
    path: app/src/main/assets/page/lib/mode.js
  - repo: android
    path: app/src/main/assets/page/lib/watch.js
  - repo: android
    path: app/src/main/assets/host.js
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/MainActivity.kt
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/PageScript.kt
---

## Qué hace

Dentro de la app, Claude se viste con los colores de Narsil: la paleta de mar nocturno de [Narsil Skin](https://github.com/davshn/narsil-skin), los temas de color que hizo el autor para la app de escritorio de Claude. Cambian los fondos, el texto, los bordes, los bloques de código y el brillo mientras Claude trabaja:

- **De noche**, de 18:00 a 5:59, un fondo azul marino profundo (`#0f1a2c`), texto azul pálido y un acento azul brillante.
- **De día**, de 6:00 a 17:59, un fondo azul marino pálido (`#c9e7f1`), texto azul oscuro y un acento verde azulado.
- **La chispa naranja** que muestra Claude mientras trabaja se vuelve morada.
- **Todo el texto va en negrita**, como en el tema.

Decide la hora, según el propio reloj del móvil, sea cual sea la apariencia que elegiste en Claude: la app no lee tu configuración ni la cambia. La barra de estado y la barra de navegación lo siguen, con el mismo fondo detrás e iconos oscuros o claros a juego. Y los colores se aplican desde el mismo inicio de cada página, así que los propios de Claude nunca aparecen primero.

> **Experimental.** La piel reemplaza las propias variables de diseño de `claude.ai` y da estilo a algunas de sus partes por nombres de clase y atributos del marcado actual de la página. Nada de eso es una API pública. Una actualización de Claude puede renombrarlos; cuando pasa, algunas partes de la página vuelven a los colores de Claude o, rara vez, una parte se vuelve difícil de leer hasta que se actualiza la piel. Claude sigue funcionando.

## Cómo funciona por dentro

Tres archivos hacen el trabajo, y un ajuste en Kotlin lo termina:

| Archivo                    | Tarea                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| `assets/page/skin.css`     | La paleta, como valores para las variables de diseño de Claude, y unas pocas reglas propias. |
| `assets/page/lib/mode.js`  | Qué modo lleva cada hora: una regla, compartida por los scripts de página.                   |
| `assets/page/mode.js`      | Fija el modo claro u oscuro de la página según la hora, y lo mantiene.                       |
| `MainActivity.paintBars()` | Pinta el fondo detrás de las barras del sistema y elige el color de sus iconos.              |

### Pintar con las propias variables de la página

Una app web moderna no escribe los colores en cada regla. Los define una vez, como propiedades personalizadas de CSS, y cada componente las lee. `claude.ai` lo hace con una familia de variables cuyos nombres empiezan por `--cds-` (fondo de la página, superficies, texto, bordes, acentos), más una familia más antigua de valores `--bg-*`, `--text-*` y `--accent-*` escritos como tríos HSL.

Eso hace que la piel sea pequeña. En lugar de volver a dar estilo a cientos de componentes, `skin.css` les da valores nuevos a esas variables, y la página se vuelve a pintar sola. El inicio de la mitad oscura, de `skin.css` en narsil-android (MIT):

<!-- prettier-ignore -->
```css
/* Each .cds-root the app mounts declares these again for itself, so setting
   them on html alone lasts only until it has mounted. */
html[data-mode="dark"],
html[data-mode="dark"] .cds-root:not([data-mode="light"]),
html[data-mode="dark"] #static-composer,
.cds-root[data-mode="dark"],
.cds-dark-scope {
  --cds-page-bg: #0f1a2c !important;
  --cds-surface-0: #0b1422 !important;
  --cds-surface-1: #0f1a2c !important;
  --cds-surface-2: #16243b !important;
  --cds-surface-3: #1a2a44 !important;
  --cds-surface-panel: #16243b !important;
  --cds-surface-popover: #22344f !important;
  --cds-text-primary: #dce6fa !important;
  --cds-text-secondary: color-mix(in srgb, #dce6fa 68%, transparent) !important;
```

Tres detalles de esas pocas líneas explican todo el archivo:

- **Los selectores se repiten.** Como dice el comentario, cada `.cds-root` que monta la página vuelve a declarar las variables para sí, y una declaración más cercana gana a la de `html`. Así que la piel las fija en cada sitio donde las fija la página: `html`, cada `.cds-root`, el composer estático y los ámbitos oscuros.
- **`!important` en todas partes.** Si no, las propias declaraciones de la página ganarían cuando son tan específicas como las de la piel. Una declaración importante gana a una normal sin importar el orden.
- **Tonos a partir de un color.** El texto secundario y el atenuado son el texto principal mezclado con transparencia (`color-mix(in srgb, #dce6fa 68%, transparent)`), así que cada tono se queda en el mismo matiz.

Los valores principales de la paleta, lado a lado:

| Variable              | Noche (`dark`)         | Día (`light`)            |
| --------------------- | ---------------------- | ------------------------ |
| `--cds-page-bg`       | `#0f1a2c`              | `#c9e7f1`                |
| `--cds-surface-0`     | `#0b1422`              | `#b7deed`                |
| `--cds-surface-2`     | `#16243b`              | `#d6eef5`                |
| `--cds-text-primary`  | `#dce6fa`              | `#0f2f47`                |
| `--cds-text-accent`   | `#5aaeff`              | `#1f83a8`                |
| `--cds-border-strong` | 26 % de un azul pálido | 26 % del color del texto |

### Lo que no alcanzan las variables

Unas pocas partes de la página no toman sus colores de esas variables, y `skin.css` les da estilo una a una:

- **El menú lateral**, pintado con `--cds-surface-0`.
- **Los bloques de código de las diferencias**, que viven en una shadow root, donde no llegan las reglas de fuera. Las propiedades personalizadas sí pasan dentro, y una regla sobre el host de la shadow root gana a las del propio componente, así que la piel fija `--diffs-light-bg`, `--diffs-dark-bg` y sus colores de texto en `diffs-container`.
- **Los bloques de código del chat en modo claro.** Colorean sus tokens en línea con la paleta oscura de la página incluso cuando se fuerza el modo claro, así que quedarían tokens pálidos sobre un fondo pálido. La piel los encuentra por su color base en línea y los gira con `filter: invert(1) hue-rotate(180deg) saturate(1.3)`: invertir pasa lo claro a oscuro, y girar el tono media vuelta devuelve a cada token su matiz.
- **La selección**, el borde de la caja de texto (más fuerte cuando tiene el foco) y **la chispa**: `[data-cds="Spark"]` y `[data-cds="WorkingMark"]` reciben `filter: hue-rotate(262deg) saturate(1.3)`, que vuelve morado el naranja de Claude.
- **El texto en negrita**: `body, body *` reciben `font-weight: 700 !important`. El comentario explica por qué es una regla simple y no un `:not()` que respete las partes propias de Narsil: un `:not()` de descendientes "would walk every element's ancestors on each recalculation" (recorrería los ancestros de cada elemento en cada recálculo). En su lugar, `band.css` devuelve los pesos de la franja con un `!important` propio.

Los comentarios también cuidan la velocidad. Dos variables que hereda la página se fijan "Only where the page declares them" (solo donde la página las declara), porque en cada elemento "they would make each one carry its own copy and slow every style recalculation" (harían que cada uno llevara su propia copia y ralentizarían cada recálculo de estilos). En un móvil, mientras Claude va escribiendo una respuesta y la página cambia muchas veces por segundo, eso importa.

Al final, `skin.css` fija `--narsil-css-skin: 1` en `:root`. No cambia nada visible: es una marca que leen los scripts de la franja para saber que la hoja de estilos llegó a la página (la [guía 3](/es/android/conversation-band/) explica qué hacen cuando falta).

### Cómo llegan los estilos a la página

`PageScript.kt` une `skin.css` y `band.css` en una sola cadena de JavaScript, `NARSIL_CSS`, y `host.js` la convierte en una hoja de estilos construida:

<!-- prettier-ignore -->
```js
const sheet = new CSSStyleSheet()
sheet.replaceSync(NARSIL_CSS)

// The page sets adoptedStyleSheets of its own at times: the sheet goes back on each change the watch sees.
function adopt() {
  if (!document.adoptedStyleSheets.includes(sheet)) document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
}
adopt()
```

Ese fragmento es de `host.js` en narsil-android (MIT). Una hoja construida no es un elemento de la página, así que los cambios del marcado de la página no pueden quitarla, y el comentario del archivo señala que la Content Security Policy de la página no la gobierna, mientras que un `<style>` añadido por un script podría rechazarse. La página puede reemplazar su propia lista de hojas adoptadas, así que `PageScript` registra `adopt` en el observador de la página: después de cualquier cambio, la hoja de Narsil vuelve a su sitio.

### Clara de día, oscura de noche

La regla de la hora es una línea, en `lib/mode.js` (MIT):

<!-- prettier-ignore -->
```js
// Which mode claude.ai wears at each hour, as narsil-skin's auto theme does.

self.narsilMode = (() => {
  const isDay = (hour) => hour >= 6 && hour < 18
  const modeOfHour = (hour) => (isDay(hour) ? 'light' : 'dark')
  return { modeOfHour }
})()
```

Copia el tema automático de Narsil Skin en el escritorio, así que el móvil y el PC cambian a la vez.

`claude.ai` marca su modo con un atributo `data-mode`: `light`, `dark` o `system`, en el elemento `<html>` y en algunos de sus componentes. Ese atributo es lo que escribe tu configuración de apariencia, y lo que leen los selectores de la piel. Así que `mode.js` no pelea con los estilos de la página; simplemente escribe el atributo. El archivo completo, de `mode.js` (MIT):

<!-- prettier-ignore -->
```js
// Light by day and dark by night, whatever claude.ai's own setting says: its
// data-mode attribute, on every element that carries one, as the page sets it
// again whenever it mounts one. Not every data-mode: data-mode=code means
// something else.

(() => {
  const MODES = '[data-mode=light],[data-mode=dark],[data-mode=system]'
  const CHECK_MS = 60_000
  function apply() {
    const mode = self.narsilMode.modeOfHour(new Date().getHours())
    for (const element of document.querySelectorAll(MODES)) if (element.dataset.mode !== mode) element.dataset.mode = mode
  }

  self.narsilWatch(apply)

  // The hour turns with no change on the page; a hidden page runs no frames.
  const timer = setInterval(apply, CHECK_MS)
  const onVisibility = () => apply()
  document.addEventListener('visibilitychange', onVisibility)
  self.narsilWatch.onStop(() => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisibility)
  })
  apply()
})()
```

Cada parte tiene su razón:

- **Solo tres valores.** `data-mode=code` existe en la página y "means something else" (significa otra cosa), así que el selector nombra `light`, `dark` y `system` y deja el resto en paz.
- **Cada elemento que lleve uno,** no solo `<html>`. La página monta componentes con su propio `data-mode`, y lo vuelve a fijar cuando los monta.
- **En cada cambio de la página,** mediante `self.narsilWatch(apply)`. El observador de la página de `lib/watch.js` también vigila atributos, con `attributeFilter: ['data-mode', 'href']`, así que la página volviendo a fijar `data-mode` es en sí un cambio que lo despierta.
- **Cada 60 segundos,** porque la hora cambia sin que cambie nada en la página.
- **En `visibilitychange`,** porque, como dice el comentario, "a hidden page runs no frames" (una página oculta no ejecuta fotogramas): las funciones del observador esperan a un fotograma, y los temporizadores van más lentos en una página oculta. Cuando la pantalla vuelve después de una noche en el bolsillo, el modo correcto está ahí enseguida, no hasta un minuto después.
- **Solo cuando es distinto.** Escribir el atributo es un cambio que ve el observador, así que `apply` solo escribe cuando el valor difiere. Si no, cada escritura despertaría al observador, que volvería a escribir.

La app nunca toca tu configuración de Claude. `mode.js` solo reescribe el atributo en la página que tienes delante. En tu PC, o en la propia app de Claude, tu configuración sigue como la dejaste.

### Antes del primer pintado

El README promete que "The colors go on from the very start of each page, so Claude's own never flash first." (los colores se aplican desde el mismo inicio de cada página, así que los de Claude nunca aparecen primero). Tres cosas lo hacen cierto:

1. **El script se ejecuta al inicio del documento.** `addDocumentStartJavaScript` lo ejecuta antes que cualquiera de los propios scripts de `claude.ai` ([guía 2](/es/android/webview-host/)). Para entonces la hoja de estilos ya está adoptada, así que sus reglas esperan al marcado de la página.
2. **El modo va en el primer grupo.** `PageScript` ejecuta `lib/watch.js`, `lib/mode.js` y `mode.js` enseguida, no después de analizar el documento, que es cuando se ejecutan los scripts de la franja.
3. **El observador trabaja antes del pintado.** Ejecuta sus funciones con `requestAnimationFrame`, y un navegador ejecuta esas funciones justo antes de pintar el fotograma. Así que, cuando la página fija `data-mode` en su propio valor, `mode.js` ya ha vuelto a escribir el de Narsil antes de que ese fotograma llegue a la pantalla.

El registro de tareas recoge la comprobación en un móvil real, desde las DevTools: "both style marks and the night ground rgb(15, 26, 44)" (las dos marcas de estilo y el fondo de noche rgb(15, 26, 44)), que es `#0f1a2c`.

### Las barras del sistema

La página queda entre las barras del sistema (la [guía 2](/es/android/webview-host/) explica el relleno), así que lo que se ve detrás de ellas es el propio marco de la actividad. `MainActivity` lo pinta con el fondo de la página y elige el color de los iconos. De `MainActivity.kt` (MIT):

```kotlin
    // Behind the system bars, the page's own ground, light by day and dark by night as the band's mode.js sets it.
    private fun paintBars() {
        val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        val isDay = hour in 6..17
        frame.setBackgroundColor(Color.parseColor(if (isDay) "#c9e7f1" else "#0f1a2c"))
        WindowCompat.getInsetsController(window, frame).apply {
            isAppearanceLightStatusBars = isDay
            isAppearanceLightNavigationBars = isDay
        }
    }
```

`hour in 6..17` es la misma regla que `lib/mode.js`, escrita en Kotlin: de 6:00 a 17:59. Los dos colores son el `--cds-page-bg` de cada modo. `isAppearanceLightStatusBars = true` pide iconos oscuros, que es lo que necesita un fondo claro; de noche se vuelven claros.

La regla vive dos veces, una en JavaScript y otra en Kotlin, porque la página y la actividad no pueden compartir código con facilidad. Los valores tienen que cambiar juntos, y eso merece una prueba propia (mira el código de referencia).

`paintBars` se ejecuta en `onResume`, cada vez que la app pasa al frente. No se ejecuta con un temporizador, como hace `mode.js`.

## Constrúyelo con Claude

Pídele a Claude una piel en dos partes: una hoja de estilos que dé valores nuevos a las propias variables de diseño de la página bajo `html[data-mode=…]`, y un pequeño script que fije ese atributo según la hora y lo mantenga. La idea que debe acertar es que la piel sigue el propio mecanismo de la página en lugar de pelear con él: escribe variables y el atributo del modo, y deja que la página se vuelva a pintar sola.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil.

> Mi app de Android ejecuta un script al inicio del documento en `https://claude.ai` y adopta una hoja de estilos construida. Escribe la hoja de estilos: bajo `html[data-mode="dark"]`, cada `.cds-root` sin `data-mode="light"` y `.cds-root[data-mode="dark"]`, da a `--cds-page-bg`, `--cds-surface-0` a `-3`, `--cds-text-primary` y `--cds-text-accent` de la página una paleta azul marino con `!important`, y una paleta azul marino pálido para `light`. Después escribe un script que, en cada elemento con `data-mode` en `light`, `dark` o `system` (nunca `code`), escriba `light` de 6:00 a 17:59 y `dark` el resto, según la hora local del móvil. Ejecútalo enseguida, en cada cambio que vea un único `MutationObserver` (limitado con `requestAnimationFrame` y que también vigile el atributo `data-mode`), cada 60 segundos y en `visibilitychange`; escribe solo cuando el valor sea distinto. En Kotlin, en `onResume`, pinta el marco detrás de las barras del sistema con el mismo fondo y pon iconos de barra claros u oscuros según las mismas horas. Prueba la regla de la hora en los dos lenguajes.

### Qué revisar en la respuesta de Claude

1. Las variables se fijan en cada elemento donde las declara la página, no solo en `html`.
2. El script del modo deja en paz `data-mode=code`.
3. Escribe el atributo solo cuando el valor es distinto, para que el observador no entre en bucle.
4. El observador vigila el atributo `data-mode`, así que se atrapa a la página cuando lo vuelve a fijar.
5. Hay un temporizador para la hora y un listener de `visibilitychange` para cuando vuelve la pantalla.
6. La regla de Kotlin y la de JavaScript coinciden a las 5, las 6, las 17 y las 18.
7. Nada cambia la configuración de Claude de la persona; solo el atributo en la página.

Si una comprobación falla, dile a Claude lo que ves: "a las 18:00 la página se oscurece pero la barra de estado sigue clara".

### Cómo lo pidió el autor

Las palabras de quien creó Narsil están recogidas en `odd/tasks/android-app.md`. L1 pedía una web view que "modifique sus estilos como lo hace esta extension", y L3: "recuerda que los estilos que va a inyectar seran los de la extension […]" (aquí se omite el nombre del proyecto anterior). Así que los colores no se volvieron a diseñar para la app: `skin.css`, `mode.js` y `lib/mode.js` vinieron de la extensión anterior tal cual, y el trabajo de la app fue ponerlos en la página lo bastante pronto.

El resto se reconstruye a partir del historial de commits (el nombre de un proyecto en un asunto se reemplaza por una descripción entre corchetes):

- `3bcea35` (2026-11-24) "feat: build the script that hosts [the earlier extension] in a WebView, and what alerts and states keep" (construir el script que aloja [la extensión anterior] en una WebView, y lo que guardan los avisos y los estados). Su mensaje: "the styles go on as a constructed style sheet." (los estilos entran como una hoja de estilos construida).
- `53c55c1` (2026-11-24) "feat: host claude.ai with [the earlier extension] in a WebView, and show Narsil's alerts from a foreground service" (alojar claude.ai con [la extensión anterior] en una WebView, y mostrar los avisos de Narsil desde un servicio en primer plano). `paintBars` llega con `MainActivity`.
- `5ad4577` (2026-11-24) "refactor: make the band's scripts the app's own, and stop naming the projects it replaces" (hacer que los scripts de la franja sean de la app, y dejar de nombrar los proyectos que reemplaza).

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía (MIT). Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

La regla de la hora y los colores de las barras en un solo objeto de Kotlin, para que la actividad y su prueba los compartan:

```kotlin
package io.github.davshn.narsil

object DayNight {
    const val DAY_GROUND = "#c9e7f1"
    const val NIGHT_GROUND = "#0f1a2c"

    fun isDay(hour: Int): Boolean = hour in 6..17

    fun groundOf(hour: Int): String = if (isDay(hour)) DAY_GROUND else NIGHT_GROUND
}
```

```kotlin
package io.github.davshn.narsil

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DayNightTest {
    @Test
    fun theDayRunsFromSixToFiveFiftyNine() {
        assertFalse(DayNight.isDay(5))
        assertTrue(DayNight.isDay(6))
        assertTrue(DayNight.isDay(17))
        assertFalse(DayNight.isDay(18))
    }

    @Test
    fun theGroundIsThePagesOwn() {
        assertEquals("#c9e7f1", DayNight.groundOf(12))
        assertEquals("#0f1a2c", DayNight.groundOf(23))
    }
}
```

Y la piel más pequeña posible, para una sola variable, para ver el mecanismo por sí solo. Ponla en una hoja construida y fija `data-mode` a mano en las DevTools para ver cómo la sigue la página:

```css
html[data-mode='dark'],
html[data-mode='dark'] .cds-root:not([data-mode='light']),
.cds-root[data-mode='dark'] {
  --cds-page-bg: #0f1a2c !important;
}

html[data-mode='light'],
html[data-mode='light'] .cds-root:not([data-mode='dark']),
.cds-root[data-mode='light'] {
  --cds-page-bg: #c9e7f1 !important;
}
```

## Errores comunes y cómo probarlo

- **Variables solo en `html`.** El primer componente que se monta declara las suyas, y la página vuelve a los colores de Claude a parches. Fíjalas donde las fije la página.
- **Un elemento `<style>` desde el script.** La Content Security Policy de una página puede rechazarlo. Una hoja de estilos construida, como usa la app, o la hoja de estilos propia de una extensión, es la forma de entrar.
- **Reescribir cada `data-mode`.** `data-mode=code` significa otra cosa en esta página; sobrescribirlo rompe esa parte.
- **Escribir el atributo en cada ejecución.** El observador se despierta con su propia escritura y nunca descansa. Compara primero.
- **Sin temporizador.** La página no cambia a las 18:00, así que sin uno el modo espera a tu siguiente toque.
- **Negrita en todas partes, también en la franja de Narsil.** `body *` alcanza a la franja. Devuélveles sus pesos a tus propias partes.
- **Bloques de código ilegibles en modo claro.** Los colores en línea ignoran las variables. Búscalos, como hace `skin.css` con su filtro.
- **Esperar que importe la configuración de apariencia de Claude.** En la app, gana la hora. Es el diseño, no un error.

Para probarlo, abre la página desde `chrome://inspect` en una compilación de depuración y ejecuta en la consola: `document.documentElement.dataset.mode` (`light` o `dark` según la hora), `getComputedStyle(document.documentElement).getPropertyValue('--narsil-css-skin')` (`1`) y `getComputedStyle(document.documentElement).getPropertyValue('--cds-page-bg')` (`#0f1a2c` de noche, `#c9e7f1` de día). Después escribe `document.documentElement.dataset.mode = 'system'`: en un fotograma debería volver a mostrar el modo de la hora. Para probar la otra mitad del día, cambia a mano el reloj del móvil en los ajustes de fecha y hora de Android y vuelve a la app: la página cambia en `visibilitychange`, y las barras en `onResume`.

### Dónde difieren el código y el README

- El README dice que las barras del sistema siguen el cambio de colores según la hora. La página lo sigue en menos de un minuto; las barras solo cuando la app vuelve al frente, ya que `paintBars` se ejecuta en `onResume` y en ningún otro sitio. Con la app abierta durante las 6:00 o las 18:00, las barras conservan el fondo viejo hasta que sales y vuelves.

## Para ir más lejos

- La [guía 3](/es/android/conversation-band/) muestra el observador de la página que el modo comparte con la franja, y las marcas de estilo que comprueba la franja.
- La [guía 2](/es/android/webview-host/) explica los scripts de inicio de documento y el orden que construye `PageScript`.
- [Narsil Skin](https://github.com/davshn/narsil-skin) tiene el tema completo para la app de escritorio, con sus fondos de pantalla, que la app deja fuera: el comentario al principio de `skin.css` dice que toma "none of that theme's wallpaper, waves or stars" (nada del fondo de pantalla, las olas ni las estrellas de ese tema).
- El código fuente está en [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
