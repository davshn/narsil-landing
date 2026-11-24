---
title: El tile
description: 'Cómo el tile Narsil · Claude dibuja los límites de 5 horas y semanal en dos anillos con los colores de Narsil, con Narsil en la pose de tu conversación más importante y la edad de la lectura.'
route: watch
order: 3
updated: 2026-11-24
sources:
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/tile/NarsilTileService.kt
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/domain/Display.kt
  - repo: watch
    path: app/src/test/kotlin/tech/davshn/narsilwatch/domain/DisplayTest.kt
  - repo: pet
    path: hooks/phone.ts
  - repo: pet
    path: hooks/fleet.ts
  - repo: pet
    path: hooks/usage.ts
---

## Qué hace

Desliza hacia un lado desde la esfera y llegas al tile **Narsil · Claude**. De un vistazo responde a tres preguntas: cuánto has gastado de los límites de Claude, si alguna conversación te está esperando y qué antigüedad tiene esa información.

De fuera hacia dentro:

- **El anillo exterior** es el límite de 5 horas. La parte usada se dibuja en su color, empezando arriba y avanzando en el sentido de las agujas del reloj; el resto es una pista oscura.
- **El anillo interior**, más fino, es el límite semanal, dibujado igual.
- **Narsil en el centro**, en su etapa actual, en la pose de tu conversación más importante: trabajando, esperándote, terminada, en reposo o con un fallo.
- **Cuatro líneas cortas debajo de ella**, por ejemplo:

```text
5 h 62%
sem 90%
1 te necesita
hace 12 min
```

Las dos primeras son los límites ("sem" por "semana"), cada una en su color. La tercera habla de tus conversaciones: `1 te necesita`, `2 te necesitan` o, cuando ninguna está esperando, el estado de la primera en minúsculas, como `trabajando`. Sin conversaciones, dice `sin conversaciones`. La última línea es la antigüedad de la lectura: `ahora`, `hace 12 min`, `hace 3 h`, `hace 2 d`.

Antes de que el reloj tenga ningún estado, los límites dicen `5 h –` y `sem –`, los anillos están vacíos y la última línea dice `configúrame`. Un toque en cualquier parte del tile abre la app.

> **Experimental.** El tile dibuja el último estado que guardó el reloj, y ese estado solo es tan reciente como la última publicación del mod: el mod solo publica mientras trabajas lejos del PC, dentro del margen diario gratuito de ntfy.sh. El tile pide una lectura nueva como mucho cada 15 minutos. Lee la línea de antigüedad antes que los números.

## Cómo funciona por dentro

Todo vive en `tile/NarsilTileService.kt`, con la redacción y los colores en `domain/Display.kt`. La pose y los colores los decide el mod en tu PC; el tile solo los dibuja.

### Un TileService que responde con un diseño

Un tile de Wear OS no es una pantalla que programas con Compose. Es un servicio, `TileService`, al que el sistema le pide una descripción del diseño, construida con la biblioteca ProtoLayout. El sistema la dibuja y vuelve a llamar al servicio cuando quiere una nueva. El manifiesto lo declara con el permiso y la acción `BIND_TILE_PROVIDER`, la etiqueta `@string/tile_label` ("Narsil · Claude") y una imagen de vista previa, `@drawable/narsil_preview`.

El servicio responde a dos peticiones: el tile (su diseño) y sus recursos (las imágenes que nombra). Las dos devuelven un `ListenableFuture`, y el código las escribe como corrutinas de Kotlin con `SuspendToFutureAdapter.launchFuture`. De `NarsilTileService.kt` en narsil-watch (GPL v3):

```kotlin
override fun onTileRequest(requestParams: RequestBuilders.TileRequest): ListenableFuture<TileBuilders.Tile> =
    SuspendToFutureAdapter.launchFuture {
        if (System.currentTimeMillis() - repo.checkedAt > STALE_MS) Refresh.now(this@NarsilTileService)
        val state = repo.cached()
        TileBuilders.Tile.Builder()
            .setResourcesVersion(resourcesVersion())
            .setFreshnessIntervalMillis(STALE_MS)
            .setTileTimeline(TimelineBuilders.Timeline.fromLayoutElement(layout(state)))
            .build()
    }
```

### Cuándo pide una lectura nueva

Esa primera línea importa. `STALE_MS` son 15 minutos. Si el reloj no ha sabido nada de ntfy.sh durante más tiempo que eso, el tile llama a `Refresh.now`, que pone en cola un refresco en segundo plano con WorkManager. **No** lo espera. Dibuja al instante a partir de `repo.cached()`, el estado guardado en el reloj.

Cuando termina el refresco en segundo plano, le pide al sistema que vuelva a dibujar el tile ([guía 5](/es/watch/app-and-refresh/)). El sistema vuelve a llamar a `onTileRequest`; para entonces `checkedAt` es reciente, así que no se pone en cola un segundo refresco, y el tile dibuja el estado nuevo. Dos pasadas, y el tile nunca muestra un indicador de carga.

`setFreshnessIntervalMillis(STALE_MS)` también le dice al sistema que vale la pena volver a pedir el diseño pasados 15 minutos, así que la línea de antigüedad avanza aunque no pase nada más.

### Dos anillos

Cada anillo es un `Arc` de ProtoLayout con dos `ArcLine`: la parte usada y la pista. De `NarsilTileService.kt` (GPL v3):

```kotlin
// A full ring: the used part in the limit's color, the rest as track.
private fun ring(limit: Limit?, thickness: Float): LayoutElement {
    val used = ((limit?.percent ?: 0.0).coerceIn(0.0, 100.0) * 3.6).toFloat()
    val arc = LayoutElementBuilders.Arc.Builder()
        .setAnchorAngle(degrees(0f))
        .setAnchorType(LayoutElementBuilders.ARC_ANCHOR_START)
    if (used > 0f) arc.addContent(arcLine(used, thickness, limit?.let { parseColor(it.color) } ?: Palette.DIM))
    if (used < 360f) arc.addContent(arcLine(360f - used, thickness, Palette.TRACK))
    return arc.build()
}
```

Leyéndolo:

- **Del porcentaje a los grados.** Un círculo completo son 360 grados, así que el 1 % son 3,6. Antes, el porcentaje se limita a 0–100, así que un valor extraño nunca dibuja más de una vuelta.
- **Dónde empieza.** El ancla está a 0 grados, arriba de la pantalla, y `ARC_ANCHOR_START` significa que el arco empieza ahí y avanza en el sentido de las agujas del reloj.
- **Dos piezas, nunca una vacía.** Al 0 % solo hay pista; al 100 %, solo color.
- **Sin límite, sin color.** Sin lectura, `percent` cuenta como 0, así que todo el anillo es pista.

El diseño pone los anillos uno dentro del otro. El `Box` exterior llena el tile, tiene el fondo oscuro `Palette.BG` y contiene el anillo de 5 horas, de 7 dp de grosor (`RING`). Dentro de él, un segundo `Box` con un relleno de `RING + GAP` (7 + 3 dp) contiene el anillo semanal, de 5 dp de grosor (`RING_INNER`), y la columna del centro. El relleno es lo que mantiene el anillo interior 3 dp por dentro del exterior en cualquier tamaño de pantalla.

### Los colores: se deciden en el PC y se leen en el reloj

El README dice que los anillos van "colored as Narsil colors them: green, yellow from 60 %, and red from 85 %" (coloreados como los colorea Narsil: verde, amarillo desde el 60 % y rojo desde el 85 %). Vale la pena saber dónde vive esa regla, porque no está en el reloj.

El mod decide el color de cada límite cuando publica el estado. `levelColor` en `hooks/usage.ts` de narsil-pet (GPL v3):

```ts
export function levelColor(percent: number): string {
  return percent >= 85 ? '#F0435A' : percent >= 60 ? '#F5B400' : '#22B573'
}
```

`watchLimits` en `hooks/phone.ts` pone el resultado en el campo `color` de cada límite ([guía 2](/es/watch/reading-the-state/)). El reloj solo convierte ese texto en un color, con `parseColor` en `domain/Display.kt` (GPL v3):

```kotlin
// A #RRGGBB color as the PC sends it; dim for anything else.
fun parseColor(hex: String): Int {
    val digits = hex.removePrefix("#")
    if (digits.length != 6) return Palette.DIM
    val rgb = digits.toLongOrNull(16) ?: return Palette.DIM
    return (0xFF000000L or rgb).toInt()
}
```

Así que un límite al 62 % es amarillo en el reloj porque es amarillo en el PC. Si el mod cambia alguna vez sus umbrales, el reloj lo sigue sin ninguna actualización. Un color que no tenga seis dígitos hexadecimales se convierte en `Palette.DIM`, un gris apagado, en lugar de dar un error; el test "reads a level color, and falls back to dim on noise" (lee un color de nivel y recurre al gris apagado ante el ruido) comprueba `#22B573` y la palabra `rojo`.

`Display.kt` contiene los colores que decide el propio reloj. El comentario al principio del archivo: "How the watch says things, in Narsil's words and colors (overlay.html, dark theme). Pure functions, so the tile, the complication and the app read the same." (cómo dice las cosas el reloj, con las palabras y los colores de Narsil, overlay.html, tema oscuro; funciones puras, para que el tile, la complicación y la app lean lo mismo). Su `Palette` tiene el fondo `0xFF16182A`, el texto `0xFFECEBF3`, el gris apagado `0xFF9A98AD`, la pista `0xFF2A2D45` y el acento `0xFF7C6CF0`. Su `statusColor` da a cada estado de conversación el color que Narsil usa para él: `working` azul `0xFF3B8BFF`, `idle` gris `0xFF8A90A6`, `waiting` amarillo `0xFFF5B400`, `done` verde `0xFF22B573` y `error` rojo `0xFFF0435A`. Un estado desconocido recurre al gris de reposo.

### Narsil en el centro: el dibujo

La columna del centro empieza con una `Image` de 40 dp de ancho y 66 dp de alto, que nombra un recurso, `ART_ID` (`"narsil"`). El dibujo en sí sale de `onTileResourcesRequest`:

- **Si el reloj ha descargado un dibujo**, `repo.art()` devuelve sus bytes, y entran como un recurso de imagen en línea.
- **Si todavía no**, el tile usa el dibujo que viene con la app, `R.drawable.narsil_preview`.

El dibujo sale del repositorio [narsil-pet](https://github.com/davshn/narsil-pet) en GitHub. `StatusRepository` descarga la URL del campo `art` del estado, solo si empieza por `https://raw.githubusercontent.com/davshn/narsil-pet/`, y la guarda como `art.png` ([guía 2](/es/watch/reading-the-state/)). El README lo acredita: "Narsil's art is © its author and comes from the narsil-pet repository." (el arte de Narsil es © de su autor y sale del repositorio narsil-pet).

El sistema guarda en caché los recursos según una cadena de versión, así que el tile tiene que cambiar la versión cada vez que cambia el dibujo. `resourcesVersion()` es el hash de los bytes del dibujo, o `"preview"` si no hay ninguno:

```kotlin
private fun resourcesVersion(): String = repo.art()?.contentHashCode()?.toString() ?: "preview"
```

Pose nueva, bytes nuevos, versión nueva, y el sistema vuelve a pedir los recursos. Misma pose, misma versión, y no se recarga nada.

### Qué pose: la conversación más importante

El tile no elige la pose. La elige el mod, y la nombra en la URL. En `sendStatus` (`hooks/register.tsx` en narsil-pet):

```ts
art: artUrl(POSE[list[0]!.status], stageOf(levelOf(earned).level)),
```

Tres piezas deciden esa URL:

1. **La lista está ordenada.** `list` sale de `fleetOf` en `hooks/fleet.ts`, que ordena cada conversación abierta por `RANK`, con el comentario "An error first, then what needs you, what works, what finished" (primero un error, después lo que te necesita, lo que trabaja, lo que terminó): `error` 0, `waiting` 1, `working` 2, `done` 3, `idle` 4. Entre dos del mismo rango, va primero la que cambió más recientemente. Así que `list[0]` es la conversación más importante: cualquier error gana a una pregunta, cualquier pregunta gana al trabajo en curso.
2. **La pose es la del estado.** `POSE` en `hooks/sprite.ts` nombra los dibujos: `trabajando`, `parada`, `necesita`, `terminado`, `error`.
3. **La etapa es el crecimiento de Narsil.** `stageOf` en `hooks/xp.ts` da la etapa de 1 a 5 a partir de su nivel, empezando en los niveles 1, 5, 10, 20 y 35.

`artUrl` en `hooks/phone.ts` las une: la base `https://raw.githubusercontent.com/davshn/narsil-pet/main/assets`, después `etapa<stage>/` para las etapas 2 a 5, y después `<pose>-oscuro.png`. El reloj siempre recibe el dibujo oscuro (`oscuro`), que va bien con el fondo oscuro del tile. Una conversación que falló, en la etapa 3, es `.../assets/etapa3/error-oscuro.png`.

### Las cuatro líneas de texto

Debajo del dibujo, cuatro elementos `Text`, cada uno de una línea (`setMaxLines(1)`):

```kotlin
.addContent(text(limitLine(fiveHour, "5 h"), 13f, fiveHour?.let { parseColor(it.color) } ?: Palette.DIM, bold = true))
.addContent(text(limitLine(week, "sem"), 11f, week?.let { parseColor(it.color) } ?: Palette.DIM))
.addContent(text(fleetLine(state), 11f, fleetColor(state)))
.addContent(text(state?.let { ageLabel(it.at, System.currentTimeMillis() / 1000) } ?: "configúrame", 9f, Palette.DIM))
```

Esas líneas son de `NarsilTileService.kt` (GPL v3). Los tamaños marcan la jerarquía: la cifra de 5 horas a 13 sp y en negrita, porque es la que cambia más rápido y se agota antes; la semana y las conversaciones a 11 sp; la antigüedad a 9 sp en gris.

- **`limitLine`** escribe `5 h 62%`, con el porcentaje recortado a un número entero (`toInt()`), o `5 h –` sin límite.
- **`fleetLine`** cuenta las conversaciones que te necesitan con `needsYou` de `Display.kt`, que es `sessions.count { it.status == "waiting" }`. Una da `1 te necesita`, varias dan `2 te necesitan`. Si ninguna espera, muestra la etiqueta de la primera conversación en minúsculas; sin conversaciones, `sin conversaciones`.
- **`fleetColor`** colorea esa línea con el color del estado de la primera conversación, así que una línea roja significa que la conversación más importante falló.
- **`ageLabel`** mide desde `at`, el momento en que el PC envió el estado, no el momento en que lo leyó el reloj. Esa es la antigüedad honesta: un estado leído hace un minuto pero enviado hace tres horas dice `hace 3 h`.

`ageLabel`, de `Display.kt` (GPL v3):

```kotlin
// How old the state is: the PC publishes only while you are away.
fun ageLabel(at: Long, nowSeconds: Long): String {
    val minutes = (nowSeconds - at).coerceAtLeast(0) / 60
    return when {
        minutes < 1 -> "ahora"
        minutes < 60 -> "hace $minutes min"
        minutes < 24 * 60 -> "hace ${minutes / 60} h"
        else -> "hace ${minutes / (24 * 60)} d"
    }
}
```

`coerceAtLeast(0)` protege frente a un reloj que va un poco por detrás del PC: un estado "del futuro" dice `ahora`, no una antigüedad negativa.

### Un toque abre la app

El `Box` exterior tiene un `Clickable` cuya acción es un `LaunchAction` para `MainActivity`, en el propio paquete de la app. Todo el tile es un único objetivo grande, lo que va bien en una pantalla pequeña y redonda.

## Constrúyelo con Claude

Pídele a Claude un tile que dibuje los límites como anillos a partir de un estado guardado. Las ideas que debe acertar son que el tile nunca espera a la red y que el color sale del estado, no de umbrales en el reloj.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt del autor.

> En mi app de Wear OS `my-watch`, añade un `TileService` con ProtoLayout. Lee el estado guardado de mi `StatusRepository.cached()` (un `NarsilState` con `limits` de `key` `fiveHour` y `week`, cada uno con `percent` y un `color` `#RRGGBB`, y `sessions` con `status` y `label`). Dibuja el límite de 5 horas como un anillo exterior de 7 dp de grosor y la semana como un anillo interior de 5 dp de grosor, 3 dp por dentro; cada anillo es un `Arc` anclado a 0 grados con `ARC_ANCHOR_START`, la parte usada de `percent × 3.6` grados en el color del límite y el resto en un color de pista. En el centro, un recurso de imagen con el dibujo guardado, que recurra a un drawable incluido, con la versión de los recursos igual a un hash de los bytes del dibujo. Debajo, `5 h 62%`, `sem 90%`, cuántas sesiones tienen el estado `waiting` y la antigüedad a partir del campo `at` del estado. Si la última comprobación tiene más de 15 minutos, pon en cola un refresco en segundo plano sin esperarlo. Un toque abre `MainActivity`. Pon la redacción y el análisis del color en funciones puras con tests de JUnit.

### Qué revisar en la respuesta de Claude

1. `onTileRequest` dibuja a partir del estado guardado y nunca espera una llamada de red.
2. Los grados del anillo son el porcentaje, limitado a 0–100, por 3,6, y no se añade ningún `ArcLine` de longitud 0.
3. El color sale del campo `color` del límite mediante un analizador que recurre a un color neutro, no de umbrales escritos a fuego en el tile.
4. La versión de los recursos cambia cuando cambia el dibujo.
5. La antigüedad se mide desde el `at` del estado, no desde cuándo lo leyó el reloj.
6. Sin estado, el tile se sigue dibujando: anillos vacíos, guiones y una indicación para configurarlo.

Si una comprobación falla, dile a Claude lo que ves: "el tile muestra la pose vieja incluso después de que la app muestra la nueva", lo que apunta a una versión de recursos que no cambia.

### Cómo lo pidió el autor

No existe ninguna petición registrada para el tile. Esto es una reconstrucción a partir del historial de commits:

- narsil-pet `6400a6f` (2026-11-23) "feat(phone): publish Claude limits and open conversations for the watch" (publicar los límites de Claude y las conversaciones abiertas para el reloj). Añade `limits`, con el `color` de cada límite sacado de `levelColor`, y `sessions` ordenadas por importancia, que es lo que permite al tile tomar las dos cosas del estado.
- narsil-watch `b47ca7a` (2026-11-23) "feat: Narsil on Wear OS with Claude limits and open conversations" (Narsil en Wear OS con los límites de Claude y las conversaciones abiertas). Su mensaje empieza por el tile: "A tile with the 5-hour and weekly limits as rings and Narsil in her current pose" (un tile con los límites de 5 horas y semanal como anillos y Narsil en su pose actual).

El propio comentario del archivo es la expresión más corta del diseño: "The tile: the 5-hour limit as the outer ring, the week as the inner one, Narsil in the middle in her current pose, and who needs you." (el tile: el límite de 5 horas como anillo exterior, la semana como el interior, Narsil en el centro en su pose actual, y quién te necesita).

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Un tile reducido con un anillo y una línea, escrito para esta guía y adaptado de `NarsilTileService.kt` en [narsil-watch](https://github.com/davshn/narsil-watch) (GPL v3). Usa las mismas llamadas de ProtoLayout y de Tiles que ese archivo, y supone el `StatusRepository`, `Limit`, `Palette` y `parseColor` de las carpetas `data/` y `domain/` del repositorio:

```kotlin
package com.example.mywatch.tile

import androidx.concurrent.futures.SuspendToFutureAdapter
import androidx.wear.protolayout.ColorBuilders.argb
import androidx.wear.protolayout.DimensionBuilders.degrees
import androidx.wear.protolayout.DimensionBuilders.dp
import androidx.wear.protolayout.DimensionBuilders.expand
import androidx.wear.protolayout.DimensionBuilders.sp
import androidx.wear.protolayout.LayoutElementBuilders
import androidx.wear.protolayout.LayoutElementBuilders.LayoutElement
import androidx.wear.protolayout.ModifiersBuilders
import androidx.wear.protolayout.ResourceBuilders
import androidx.wear.protolayout.TimelineBuilders
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import com.example.mywatch.data.StatusRepository
import com.example.mywatch.domain.Limit
import com.example.mywatch.domain.Palette
import com.example.mywatch.domain.parseColor
import com.google.common.util.concurrent.ListenableFuture

class LimitTileService : TileService() {
    private val repo by lazy { StatusRepository(this) }

    override fun onTileRequest(requestParams: RequestBuilders.TileRequest): ListenableFuture<TileBuilders.Tile> =
        SuspendToFutureAdapter.launchFuture {
            val fiveHour = repo.cached()?.limits?.find { it.key == "fiveHour" }
            TileBuilders.Tile.Builder()
                .setResourcesVersion("1")
                .setFreshnessIntervalMillis(15 * 60_000L)
                .setTileTimeline(TimelineBuilders.Timeline.fromLayoutElement(layout(fiveHour)))
                .build()
        }

    override fun onTileResourcesRequest(requestParams: RequestBuilders.ResourcesRequest): ListenableFuture<ResourceBuilders.Resources> =
        SuspendToFutureAdapter.launchFuture {
            ResourceBuilders.Resources.Builder().setVersion(requestParams.version).build()
        }

    private fun layout(limit: Limit?): LayoutElement {
        val color = limit?.let { parseColor(it.color) } ?: Palette.DIM
        val used = ((limit?.percent ?: 0.0).coerceIn(0.0, 100.0) * 3.6).toFloat()
        val arc = LayoutElementBuilders.Arc.Builder()
            .setAnchorAngle(degrees(0f))
            .setAnchorType(LayoutElementBuilders.ARC_ANCHOR_START)
        if (used > 0f) arc.addContent(arcLine(used, color))
        if (used < 360f) arc.addContent(arcLine(360f - used, Palette.TRACK))
        val label = LayoutElementBuilders.Text.Builder()
            .setText(limit?.let { "5 h ${it.percent.toInt()}%" } ?: "5 h –")
            .setMaxLines(1)
            .setFontStyle(LayoutElementBuilders.FontStyle.Builder().setSize(sp(13f)).setColor(argb(color)).build())
            .build()
        return LayoutElementBuilders.Box.Builder()
            .setWidth(expand())
            .setHeight(expand())
            .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
            .setVerticalAlignment(LayoutElementBuilders.VERTICAL_ALIGN_CENTER)
            .setModifiers(
                ModifiersBuilders.Modifiers.Builder()
                    .setBackground(ModifiersBuilders.Background.Builder().setColor(argb(Palette.BG)).build())
                    .build(),
            )
            .addContent(arc.build())
            .addContent(label)
            .build()
    }

    private fun arcLine(length: Float, color: Int) =
        LayoutElementBuilders.ArcLine.Builder()
            .setLength(degrees(length))
            .setThickness(dp(7f))
            .setColor(argb(color))
            .build()
}
```

No tiene imagen, así que sus recursos están vacíos y la versión nunca cambia. Para añadir a Narsil, sigue el archivo real: una `Image` con un id de recurso en el diseño, los bytes en `onTileResourcesRequest` y una versión que sea el hash de esos bytes. Declara el servicio en el manifiesto como muestra la [guía 1](/es/watch/what-it-is/).

## Errores comunes y cómo probarlo

- **Esperar a la red en `onTileRequest`.** El sistema espera una respuesta rápida. Dibuja a partir del estado guardado y refresca en segundo plano.
- **Refrescar en cada petición del tile.** Cada deslizamiento costaría una petición. La comprobación de 15 minutos lo deja en una por ventana.
- **Una versión de recursos fija.** El dibujo nunca se actualiza, porque el sistema conserva el que tiene en caché.
- **Escribir a fuego 60 y 85 en el reloj.** Funciona hasta que el mod cambia su regla. Pinta el color que trae el estado.
- **Un arco de longitud cero.** Añade la parte usada solo cuando supera los 0 grados, y la pista solo por debajo de 360.
- **Medir la antigüedad desde la lectura.** La antigüedad que importa es desde que el PC lo envió.
- **Olvidar el estado vacío.** Antes de la primera lectura, el tile tiene que dibujarse igualmente y decirte que lo configures.

Para probar la lógica sin un reloj, ejecuta los tests unitarios:

```bash
./gradlew :app:testDebugUnitTest
```

`DisplayTest.kt` cubre lo que el tile escribe y pinta: "counts the conversations that need you" (cuenta las conversaciones que te necesitan; dos `waiting` entre cuatro), "says how old the state is" (dice qué antigüedad tiene el estado: `ahora`, `hace 12 min`, `hace 3 h`, `hace 2 d`), "colors a status as Narsil does" (colorea un estado como lo hace Narsil) y "reads a level color, and falls back to dim on noise" (lee un color de nivel y recurre al gris apagado ante el ruido). El diseño en sí no tiene ningún test automático.

En el reloj: instala la app, añade el tile y ejecuta `/narsil movil prueba` en Claude Code. Abre la app una vez para que se refresque y después desliza hasta el tile. Debería mostrar la nueva antigüedad y la pose de tu conversación más importante.

### Dónde difieren el código y el README

- El README dice que el reloj lee el estado "whenever you open the app or the tile" (cada vez que abres la app o el tile). El tile solo lo pide cuando la última comprobación tiene más de 15 minutos, y dibuja el estado guardado antes de que llegue el nuevo.
- Un comentario de `NarsilTileService.kt` dice "the art Narsil publishes is 91 x 150" (el arte que publica Narsil mide 91 x 150), y declara la imagen en línea con esas medidas (`ART_W`, `ART_H`). Los dibujos oscuros de `assets/` en narsil-pet miden hoy todos 150 píxeles de alto, pero entre 91 y 106 píxeles de ancho, según la pose y la etapa. El `narsil_preview.png` incluido mide 91 x 150. En cualquier caso, el tile muestra el dibujo en una caja fija de 40 x 66 dp.
- El README dice que Narsil se sitúa "above how many conversations need you" (encima de cuántas conversaciones te necesitan). Cuando ninguna te necesita, la línea muestra en su lugar el estado de la primera conversación, algo que el README no menciona.

## Para ir más lejos

- Lee `tile/NarsilTileService.kt` en [narsil-watch](https://github.com/davshn/narsil-watch).
- El anillo podría marcar dónde se reinicia el límite: el estado lleva `resetsAt` para cada límite, y el tile todavía no lo usa.
- Como la cuenta de conversaciones que te necesitan sale de como mucho 8 sesiones, un PC con muchas conversaciones fallidas podría dejar fuera de la lista a una que espera. El orden pone primero los errores, así que harían falta nueve conversaciones o más.
- Cómo llega el estado al reloj: [Leer el estado de Narsil](/es/watch/reading-the-state/). El lado del mod: [Avisos en el móvil y el reloj](/es/mods/pet/phone-and-watch/).
- Lo siguiente: [La complicación](/es/watch/complication/), el límite de 5 horas en cualquier esfera.
