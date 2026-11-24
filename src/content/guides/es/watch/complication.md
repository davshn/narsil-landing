---
title: La complicación
description: 'Cómo la complicación Claude 5 h pone el límite de 5 horas en cualquier esfera, como un arco de color (RANGED_VALUE) o un texto corto, y cómo se le dice a su fuente de datos que se actualice.'
route: watch
order: 4
updated: 2026-11-24
sources:
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/complication/LimitComplicationService.kt
  - repo: watch
    path: app/src/main/AndroidManifest.xml
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/sync/Refresh.kt
  - repo: watch
    path: app/src/main/res/values/strings.xml
  - repo: pet
    path: hooks/usage.ts
---

## Qué hace

Una complicación es el pequeño dato que una esfera muestra además de la hora: la fecha, la batería, el tiempo. Narsil Watch ofrece una, llamada **Claude 5 h**. Pone el límite de 5 horas de Claude en cualquier esfera que tenga un hueco libre para ella, así que ves cuánto has gastado cada vez que miras la hora.

Viene en dos formas, y la esfera elige cuál:

- **Un arco**, el tipo `RANGED_VALUE`: un anillo o una barra que se llena del 0 al 100 %, con `62%` como texto y `5h` como título. Su color pasa de verde a amarillo y a rojo a medida que se llena el límite.
- **Un texto corto**, el tipo `SHORT_TEXT`: solo `62%` con el título `5h`, en el estilo que use la esfera.

Un toque en ella abre la app. Antes de que el reloj haya leído un estado con límites, no muestra nada: el aspecto de "sin datos" de la esfera.

Para añadirla, abre el editor de la esfera en el reloj, elige un hueco de complicación y escoge **Claude 5 h** en la lista de la app Narsil.

> **Experimental.** La complicación muestra la cifra de 5 horas del último estado que guardó el reloj, y no lleva antigüedad. El mod solo publica ese estado mientras trabajas lejos del PC, dentro del margen diario gratuito de ntfy.sh, y el reloj lo pide como mucho cada 15 minutos. Una cifra de ayer sigue pareciendo una cifra de ahora; abre la app o el tile para ver qué antigüedad tiene.

## Cómo funciona por dentro

Todo está en `complication/LimitComplicationService.kt`, 65 líneas. Es una fuente de datos: la esfera le pide datos, y responde a partir del estado guardado en el reloj.

### Una fuente de datos a la que pregunta el sistema

En Wear OS, una esfera no llama a tu app. Lo hace el sistema, en nombre de la esfera, a través de un servicio que declara tu app. El manifiesto declara este:

```xml
<service
    android:name=".complication.LimitComplicationService"
    android:exported="true"
    android:icon="@mipmap/ic_launcher"
    android:label="@string/complication_label"
    android:permission="com.google.android.wearable.permission.BIND_COMPLICATION_PROVIDER">
    <intent-filter>
        <action android:name="android.support.wearable.complications.ACTION_COMPLICATION_UPDATE_REQUEST" />
    </intent-filter>
    <meta-data
        android:name="android.support.wearable.complications.SUPPORTED_TYPES"
        android:value="RANGED_VALUE,SHORT_TEXT" />
    <meta-data
        android:name="android.support.wearable.complications.UPDATE_PERIOD_SECONDS"
        android:value="900" />
</service>
```

Ese fragmento es de `app/src/main/AndroidManifest.xml` en narsil-watch (GPL v3). Cada parte tiene una función:

- **`BIND_COMPLICATION_PROVIDER`**: solo el sistema puede vincularse al servicio. Se exporta para que el sistema pueda alcanzarlo, y se protege para que nada más pueda.
- **`ACTION_COMPLICATION_UPDATE_REQUEST`**: la acción que usa el sistema para pedir datos.
- **`SUPPORTED_TYPES`**: las dos formas que ofrece, `RANGED_VALUE` y `SHORT_TEXT`. El editor de la esfera muestra la complicación solo para los huecos que admiten una de ellas.
- **`UPDATE_PERIOD_SECONDS`**: 900 segundos, 15 minutos, el mismo ritmo que el refresco.
- **La etiqueta**, `@string/complication_label`, es `Claude 5 h` en `res/values/strings.xml`. Es el nombre que aparece en la lista del editor.

### Responder a partir del estado guardado

El servicio extiende `SuspendingComplicationDataSourceService`, de la biblioteca de fuentes de datos de complicaciones, así que su respuesta es una función `suspend` de Kotlin. De `LimitComplicationService.kt` en narsil-watch (GPL v3):

```kotlin
// Claude's 5-hour limit on the watch face: an arc that turns yellow at 60 %
// and red at 85 %, as Narsil colors it.
class LimitComplicationService : SuspendingComplicationDataSourceService() {
    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
        val limit = StatusRepository(this).cached()?.limits?.find { it.key == "fiveHour" }
            ?: return NoDataComplicationData()
        return data(request.complicationType, limit)
    }

    override fun getPreviewData(type: ComplicationType): ComplicationData? =
        data(type, Limit("fiveHour", "5 horas", 62.0, "#F5B400"))
```

Dos cosas que notar:

- **Sin red.** `onComplicationRequest` lee `cached()`, el estado que guarda `StatusRepository` ([guía 2](/es/watch/reading-the-state/)). Como el tile, la complicación nunca espera a ntfy.sh. El sistema puede preguntar a menudo, y la respuesta es siempre inmediata.
- **Sin límite, sin datos.** Sin un estado guardado, o con un estado que no tiene la fila `fiveHour` (un mod antiguo, o Claude Code todavía no la ha informado), la respuesta es `NoDataComplicationData()`. La esfera muestra entonces su aspecto vacío en lugar de un falso 0 %.

`getPreviewData` es lo que dibuja el editor de la esfera mientras eliges una complicación: un límite inventado al 62 %, con la etiqueta `5 horas`, en amarillo. Es un ejemplo fijo, para que el editor muestre algo con sentido incluso antes de la primera lectura.

### RANGED_VALUE o SHORT_TEXT

`data(type, limit)` construye la respuesta para el tipo que pidió la esfera. Primero las partes comunes:

```kotlin
val percent = limit.percent.coerceIn(0.0, 100.0).toFloat()
val value = PlainComplicationText.Builder("${percent.toInt()}%").build()
val title = PlainComplicationText.Builder("5h").build()
val description = PlainComplicationText.Builder("Claude, límite de 5 horas: ${percent.toInt()} %").build()
```

- **El porcentaje se limita a 0–100** y se convierte en un `Float`, el tipo que admite el valor de rango.
- **`value`** es el texto `62%`, un número entero.
- **`title`** es `5h`, lo bastante corto para los huecos más pequeños.
- **`description`** es la descripción del contenido, lo que dice un lector de pantalla: `Claude, límite de 5 horas: 62 %`. Los dos builders exigen una. Es la versión accesible de la complicación.

Un toque lleva a la app mediante un `PendingIntent` para `MainActivity`, con `FLAG_IMMUTABLE` (nadie puede cambiar el intent) y `FLAG_UPDATE_CURRENT`.

Después, las dos formas:

```kotlin
return when (type) {
    ComplicationType.RANGED_VALUE ->
        RangedValueComplicationData.Builder(percent, 0f, 100f, description)
            .setText(value)
            .setTitle(title)
            // seven equal steps (the most a ramp takes): green to 57 %,
            // yellow to 86 %, red after, close to Narsil's 60 / 85
            .setColorRamp(ColorRamp(intArrayOf(GREEN, GREEN, GREEN, GREEN, YELLOW, YELLOW, RED), false))
            .setTapAction(tap)
            .build()
    ComplicationType.SHORT_TEXT ->
        ShortTextComplicationData.Builder(value, description)
            .setTitle(title)
            .setTapAction(tap)
            .build()
    else -> null
}
```

Los dos fragmentos son de `LimitComplicationService.kt` (GPL v3).

**`RANGED_VALUE`** recibe un valor, un mínimo y un máximo: `percent`, `0f`, `100f`. La esfera dibuja el arco o la barra por su cuenta, con su propio estilo. Lo que añade la app es una **rampa de color**, los colores que debe tomar la parte llena a medida que crece el valor.

**`SHORT_TEXT`** recibe solo el texto y la descripción, con el título. Sin color: la esfera decide cómo se ve el texto.

**Cualquier otro tipo** recibe `null`. El manifiesto solo ofrece estos dos, así que el sistema no debería pedir nunca otro, y `null` es la respuesta honesta si lo hace.

### Por qué la rampa se acerca a 60 y 85, pero no exactamente

El tile pinta cada límite con el color que envió el PC ([guía 3](/es/watch/tile/)). La complicación no puede: un valor de rango no tiene un campo de "color de este valor". Recibe una rampa, una lista de colores repartidos a lo largo del rango, y la esfera elige el color para el valor.

El comentario del código explica su elección. Con `interpolated` en `false`, la rampa se divide en pasos iguales, uno por color; siete es "the most a ramp takes" (lo máximo que admite una rampa). Con siete pasos sobre 0–100, cada uno cubre un 14,3 % aproximadamente. Cuatro verdes, dos amarillos y un rojo dan:

| Tramo del límite de 5 horas | Color    | Hex          |
| --------------------------- | -------- | ------------ |
| Del 0 % a un 57 % aprox.    | Verde    | `0xFF22B573` |
| De un 57 % a un 86 % aprox. | Amarillo | `0xFFF5B400` |
| De un 86 % aprox. al 100 %  | Rojo     | `0xFFF0435A` |

La propia regla de Narsil, `levelColor` en `hooks/usage.ts` de narsil-pet, pasa a amarillo en el 60 % y a rojo en el 85 %. Así que entre el 57 % y el 60 %, la complicación ya está amarilla mientras el tile sigue verde; y justo en el 85 %, el tile está rojo mientras la complicación sigue amarilla. Tres puntos como mucho, en los bordes. Los tres colores en sí son los mismos valores hexadecimales que los de `levelColor`, así que la complicación se ve como el resto de Narsil.

El comentario de la clase, "an arc that turns yellow at 60 % and red at 85 %" (un arco que pasa a amarillo en el 60 % y a rojo en el 85 %), describe la intención; el comentario de la rampa, a su lado, describe lo que hace el código.

### Cómo se le dice a la complicación que se actualice

El sistema le pide datos nuevos a una fuente de datos de dos maneras, y esta app usa las dos.

1. **Según un calendario.** `UPDATE_PERIOD_SECONDS` es 900 en el manifiesto, así que el sistema puede preguntar cada 15 minutos. Es una petición al servicio, que responde a partir del estado guardado.
2. **Bajo demanda.** Cuando la app tiene algo nuevo, le pide al sistema que vuelva a llamar al servicio. Eso es `Refresh.redraw` en `sync/Refresh.kt` (GPL v3):

```kotlin
fun redraw(context: Context) {
    TileService.getUpdater(context).requestUpdate(NarsilTileService::class.java)
    ComplicationDataSourceUpdateRequester
        .create(context, ComponentName(context, LimitComplicationService::class.java))
        .requestUpdateAll()
}
```

`ComplicationDataSourceUpdateRequester.create(...)` nombra esta fuente de datos por su componente, y `requestUpdateAll()` le pide al sistema que solicite datos nuevos para cada hueco en el que se muestra, en cada esfera. La misma función le pide al tile que se vuelva a dibujar.

`redraw` se llama al final de cada refresco en segundo plano, desde `RefreshWorker`, y después de cada refresco en la app ([guía 5](/es/watch/app-and-refresh/)). Así que el orden siempre es: obtener el estado, guardarlo y después avisar a las superficies. Cuando el sistema llama a `onComplicationRequest`, el estado nuevo ya está en `cached()`.

El calendario por sí solo bastaría para que la cifra se moviera cada 15 minutos. La petición bajo demanda es lo que la hace cambiar enseguida después de que toques **Actualizar** en la app.

## Constrúyelo con Claude

Pídele a Claude una fuente de datos de complicación para un porcentaje. Las ideas que debe acertar son que responde a partir de datos guardados, que ofrece tanto un valor de rango como un texto corto, y que "sin datos" es una respuesta de verdad.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt del autor.

> En mi app de Wear OS `my-watch`, añade una fuente de datos de complicación `LimitComplicationService` que extienda `SuspendingComplicationDataSourceService`. En `onComplicationRequest`, lee el límite de 5 horas de mi `StatusRepository.cached()` (un `Limit` con `key` `fiveHour` y `percent`), y devuelve `NoDataComplicationData()` cuando no lo haya. Admite `RANGED_VALUE` (valor limitado a 0–100, mínimo 0, máximo 100, un texto como `62%`, título `5h`, una `ColorRamp` no interpolada de siete colores: cuatro verdes `0xFF22B573`, dos amarillos `0xFFF5B400`, un rojo `0xFFF0435A`) y `SHORT_TEXT` (el mismo texto y título); devuelve `null` para otros tipos. Dales a los dos una descripción del contenido, y una acción de toque que abra `MainActivity` con un `PendingIntent` inmutable. Implementa `getPreviewData` con una muestra al 62 %. Declárala en el manifiesto con `BIND_COMPLICATION_PROVIDER`, `SUPPORTED_TYPES` `RANGED_VALUE,SHORT_TEXT` y `UPDATE_PERIOD_SECONDS` 900, y después de cada refresco llama a `ComplicationDataSourceUpdateRequester.create(...).requestUpdateAll()`.

### Qué revisar en la respuesta de Claude

1. `onComplicationRequest` lee el estado guardado y no hace ninguna petición de red.
2. Sin límite, devuelve `NoDataComplicationData()`, no un 0 %.
3. El valor se limita a 0–100 antes de convertirse en el valor de rango.
4. Cada forma tiene una descripción del contenido, el texto para un lector de pantalla.
5. El `PendingIntent` es `FLAG_IMMUTABLE`.
6. Los `SUPPORTED_TYPES` del manifiesto enumeran exactamente los tipos que construye el código.
7. Algo llama a `requestUpdateAll()` después de guardar los datos nuevos, no antes.

Si una comprobación falla, dile a Claude lo que ves: "la complicación dice 0 % justo después de instalar la app", lo que significa que "sin datos" se está respondiendo como un cero.

### Cómo lo pidió el autor

No existe ninguna petición registrada para la complicación. Esto es una reconstrucción a partir del historial de commits:

- narsil-watch `b47ca7a` (2026-11-23) "feat: Narsil on Wear OS with Claude limits and open conversations" (Narsil en Wear OS con los límites de Claude y las conversaciones abiertas). La complicación llega con el resto de la app. Su mensaje la nombra en una frase: "a 5-hour complication" (una complicación de 5 horas).
- narsil-watch `04390c8` (2026-11-24) "docs: align README with the Narsil family" (alinear el README con la familia Narsil). El README la describe: "The **Claude 5 h** complication shows the 5-hour limit on any watch face, as an arc (`RANGED_VALUE`) or as a short text." (la complicación Claude 5 h muestra el límite de 5 horas en cualquier esfera, como un arco, `RANGED_VALUE`, o como un texto corto).

Solo el límite de 5 horas tiene complicación. El código no dice por qué; el comentario de la clase la llama "Claude's 5-hour limit on the watch face" (el límite de 5 horas de Claude en la esfera), y es el límite que cambia más rápido. El límite semanal está en el tile y en la app.

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Una complicación para el límite semanal, escrita para esta guía y adaptada de `LimitComplicationService.kt` en [narsil-watch](https://github.com/davshn/narsil-watch) (GPL v3). Usa las mismas llamadas de la biblioteca, supone el `StatusRepository` y el `Limit` del repositorio, y solo ofrece el texto corto:

```kotlin
package com.example.mywatch.complication

import android.app.PendingIntent
import android.content.Intent
import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.NoDataComplicationData
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService
import com.example.mywatch.data.StatusRepository
import com.example.mywatch.domain.Limit
import com.example.mywatch.presentation.MainActivity

class WeekComplicationService : SuspendingComplicationDataSourceService() {
    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
        val limit = StatusRepository(this).cached()?.limits?.find { it.key == "week" }
            ?: return NoDataComplicationData()
        return data(request.complicationType, limit)
    }

    override fun getPreviewData(type: ComplicationType): ComplicationData? =
        data(type, Limit("week", "Semana", 40.0, "#22B573"))

    private fun data(type: ComplicationType, limit: Limit): ComplicationData? {
        if (type != ComplicationType.SHORT_TEXT) return null
        val percent = limit.percent.coerceIn(0.0, 100.0).toInt()
        val tap = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        return ShortTextComplicationData.Builder(
            PlainComplicationText.Builder("$percent%").build(),
            PlainComplicationText.Builder("Claude, límite semanal: $percent %").build(),
        )
            .setTitle(PlainComplicationText.Builder("sem").build())
            .setTapAction(tap)
            .build()
    }
}
```

Declárala en el manifiesto como la real, con `SUPPORTED_TYPES` solo en `SHORT_TEXT`, y añádela a `Refresh.redraw` con su propio `ComplicationDataSourceUpdateRequester`.

## Errores comunes y cómo probarlo

- **Descargar datos en `onComplicationRequest`.** El sistema la llama cuando quiere. Responde a partir del estado guardado.
- **Cero para "sin datos".** Un falso 0 % parece mucho margen. `NoDataComplicationData()` es la respuesta veraz.
- **Tipos desacompasados.** Si el manifiesto ofrece un tipo para el que el código devuelve `null`, el hueco se queda vacío.
- **Una rampa con demasiados colores.** El comentario del código dice que siete es lo máximo que admite una rampa.
- **Esperar los umbrales exactos.** Con siete pasos iguales, la rampa cambia en torno al 57 % y al 86 %, no en el 60 % y el 85 %.
- **Sin descripción del contenido.** Los builders exigen una, y un lector de pantalla depende de ella.
- **Actualizar antes de guardar.** Llama a `requestUpdateAll()` después de guardar el estado nuevo, o el sistema leerá el viejo.
- **Leer la cifra como si fuera en vivo.** No tiene antigüedad. Cuando importe, abre el tile o la app.

La complicación no tiene ningún test automático; los tests unitarios cubren el estado que lee ([guía 2](/es/watch/reading-the-state/)). En el reloj:

1. Añade **Claude 5 h** a un hueco que admita un valor de rango. La vista previa del editor muestra 62 % en amarillo.
2. Antes de cualquier lectura, el hueco se ve vacío.
3. Ejecuta `/narsil movil prueba` en Claude Code, y después abre la app y toca **Actualizar**. El hueco debería cambiar al instante a tu cifra real de 5 horas.
4. Prueba un hueco que solo admita texto corto: la misma cifra, sin el arco.

### Dónde difieren el código y el README

- El comentario de la clase dice que el arco "turns yellow at 60 % and red at 85 %" (pasa a amarillo en el 60 % y a rojo en el 85 %). La rampa que construye cambia en torno al 57 % y al 86 %, como dice el comentario junto a la rampa.
- El README dice que la complicación muestra el límite "as an arc (`RANGED_VALUE`) or as a short text" (como un arco, `RANGED_VALUE`, o como un texto corto). La esfera elige cuál, según el tipo que admita su hueco.

## Para ir más lejos

- Lee `complication/LimitComplicationService.kt` en [narsil-watch](https://github.com/davshn/narsil-watch).
- Un `RANGED_VALUE` con `interpolated` en `true` mezcla los colores de forma suave en lugar de por pasos. Cambiarías los umbrales claros por un degradado; prueba los dos en tu esfera.
- El estado lleva `resetsAt` para el límite de 5 horas. Una complicación podría mostrar "reinicia en 2 h" en lugar del porcentaje, con `resetLabel` de `Display.kt`.
- Vuelve a [el tile](/es/watch/tile/), o a cómo se lee el estado: [Leer el estado de Narsil](/es/watch/reading-the-state/).
- Lo siguiente: [La app y el refresco](/es/watch/app-and-refresh/), la lista de conversaciones, la configuración y el trabajo cada 15 minutos.
