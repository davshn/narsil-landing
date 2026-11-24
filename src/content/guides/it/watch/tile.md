---
title: Il tile
description: "Come il tile Narsil · Claude disegna i limiti di 5 ore e settimanale come due anelli nei colori di Narsil, con Narsil nella posa della tua conversazione più importante e l'età della lettura."
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

## Cosa fa

Scorri di lato dal quadrante e arrivi al tile **Narsil · Claude**. Con un'occhiata risponde a tre domande: quanto hai consumato dei limiti di Claude, se una conversazione ti sta aspettando, e quanto è vecchia questa informazione.

Dall'esterno verso l'interno:

- **L'anello esterno** è il limite di 5 ore. La parte usata è disegnata nel suo colore, partendo dall'alto e andando in senso orario; il resto è una traccia scura.
- **L'anello interno**, più sottile, è il limite settimanale, disegnato allo stesso modo.
- **Narsil al centro**, al suo stadio attuale, nella posa della tua conversazione più importante: al lavoro, in attesa di te, finita, ferma o fallita.
- **Quattro righe brevi sotto di lei**, per esempio:

```text
5 h 62%
sem 90%
1 te necesita
hace 12 min
```

Le prime due sono i limiti ("sem" sta per "semana", settimana), ognuno nel suo colore. La terza riguarda le tue conversazioni: `1 te necesita` (1 ha bisogno di te), `2 te necesitan` (2 hanno bisogno di te) o, quando nessuna è in attesa, lo stato della prima in minuscolo, come `trabajando` (al lavoro). Senza conversazioni dice `sin conversaciones` (nessuna conversazione). L'ultima riga è l'età della lettura: `ahora` (adesso), `hace 12 min` (12 minuti fa), `hace 3 h`, `hace 2 d`.

Prima che l'orologio abbia uno stato, i limiti dicono `5 h –` e `sem –`, gli anelli sono vuoti, e l'ultima riga dice `configúrame` (configurami). Un tocco in qualsiasi punto del tile apre l'app.

> **Sperimentale.** Il tile disegna l'ultimo stato che l'orologio ha conservato, e quello stato è fresco solo quanto l'ultima pubblicazione della mod: la mod pubblica solo mentre lavori lontano dal computer, entro la quota giornaliera gratuita di ntfy.sh. Il tile chiede una nuova lettura al massimo ogni 15 minuti. Leggi la riga dell'età prima dei numeri.

## Come funziona dentro

Tutto sta in `tile/NarsilTileService.kt`, con i testi e i colori in `domain/Display.kt`. La posa e i colori li decide la mod sul tuo computer; il tile si limita a disegnarli.

### Un TileService che risponde con un layout

Un tile di Wear OS non è una schermata che programmi con Compose. È un servizio, `TileService`, a cui il sistema chiede una descrizione del layout, costruita con la libreria ProtoLayout. Il sistema la disegna e chiama di nuovo il servizio quando ne vuole una nuova. Il manifest lo dichiara con il permesso e l'azione `BIND_TILE_PROVIDER`, l'etichetta `@string/tile_label` ("Narsil · Claude") e un'immagine di anteprima, `@drawable/narsil_preview`.

Il servizio risponde a due richieste: il tile (il suo layout) e le sue risorse (le immagini che nomina). Entrambe restituiscono un `ListenableFuture`, e il codice le scrive come coroutine Kotlin con `SuspendToFutureAdapter.launchFuture`. Da `NarsilTileService.kt` in narsil-watch (GPL v3):

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

### Quando chiede una nuova lettura

Quella prima riga conta. `STALE_MS` vale 15 minuti. Se l'orologio non ha notizie da ntfy.sh da più tempo, il tile chiama `Refresh.now`, che mette in coda un aggiornamento in background con WorkManager. **Non** lo aspetta. Disegna subito da `repo.cached()`, lo stato conservato sull'orologio.

Quando l'aggiornamento in background finisce, chiede al sistema di ridisegnare il tile ([guida 5](/it/watch/app-and-refresh/)). Il sistema chiama di nuovo `onTileRequest`; a quel punto `checkedAt` è recente, quindi non viene messo in coda un secondo aggiornamento, e il tile disegna il nuovo stato. Due passaggi, e il tile non mostra mai un indicatore di caricamento.

`setFreshnessIntervalMillis(STALE_MS)` dice anche al sistema che vale la pena di chiedere di nuovo il layout dopo 15 minuti, così la riga dell'età si muove anche quando non succede nient'altro.

### Due anelli

Ogni anello è un `Arc` di ProtoLayout con due `ArcLine`: la parte usata e la traccia. Da `NarsilTileService.kt` (GPL v3):

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

Leggendolo:

- **Dalla percentuale ai gradi.** Un cerchio completo è 360 gradi, quindi l'1 % vale 3,6. Prima la percentuale viene limitata a 0–100, così un valore strano non disegna mai più di un giro.
- **Dove inizia.** L'ancora è a 0 gradi, la parte alta dello schermo, e `ARC_ANCHOR_START` significa che l'arco inizia lì e procede in senso orario.
- **Due pezzi, mai uno vuoto.** Allo 0 % c'è solo la traccia; al 100 %, solo il colore.
- **Nessun limite, nessun colore.** Senza una lettura, `percent` conta come 0, quindi l'intero anello è traccia.

Il layout mette gli anelli uno dentro l'altro. Il `Box` esterno riempie il tile, ha lo sfondo scuro `Palette.BG` e contiene l'anello delle 5 ore, spesso 7 dp (`RING`). Al suo interno, un secondo `Box` con un padding di `RING + GAP` (7 + 3 dp) contiene l'anello settimanale, spesso 5 dp (`RING_INNER`), e la colonna centrale. È il padding a tenere l'anello interno 3 dp dentro quello esterno su qualsiasi dimensione di schermo.

### I colori: decisi sul computer, letti sull'orologio

Il README dice che gli anelli sono "colored as Narsil colors them: green, yellow from 60 %, and red from 85 %" (colorati come li colora Narsil: verde, giallo da 60 % e rosso da 85 %). Vale la pena di sapere dove vive questa regola, perché non è sull'orologio.

La mod decide il colore di ogni limite quando pubblica lo stato. `levelColor` in `hooks/usage.ts` di narsil-pet (GPL v3):

```ts
export function levelColor(percent: number): string {
  return percent >= 85 ? '#F0435A' : percent >= 60 ? '#F5B400' : '#22B573'
}
```

`watchLimits` in `hooks/phone.ts` mette il risultato nel campo `color` di ogni limite ([guida 2](/it/watch/reading-the-state/)). L'orologio si limita a trasformare quel testo in un colore, con `parseColor` in `domain/Display.kt` (GPL v3):

```kotlin
// A #RRGGBB color as the PC sends it; dim for anything else.
fun parseColor(hex: String): Int {
    val digits = hex.removePrefix("#")
    if (digits.length != 6) return Palette.DIM
    val rgb = digits.toLongOrNull(16) ?: return Palette.DIM
    return (0xFF000000L or rgb).toInt()
}
```

Quindi un limite al 62 % è giallo sull'orologio perché è giallo sul computer. Se un giorno la mod cambia le sue soglie, l'orologio la segue senza aggiornamenti. Un colore che non è fatto di sei cifre esadecimali diventa `Palette.DIM`, un grigio smorzato, invece di un errore; il test "reads a level color, and falls back to dim on noise" (legge un colore di livello, e ripiega sul grigio smorzato davanti al rumore) controlla `#22B573` e la parola `rojo` (rosso).

`Display.kt` contiene i colori che l'orologio decide da sé. Il commento in cima: "How the watch says things, in Narsil's words and colors (overlay.html, dark theme). Pure functions, so the tile, the complication and the app read the same." (come l'orologio dice le cose, con le parole e i colori di Narsil, overlay.html, tema scuro. Funzioni pure, così il tile, la complicazione e l'app dicono lo stesso.) La sua `Palette` ha lo sfondo `0xFF16182A`, il testo `0xFFECEBF3`, il grigio smorzato `0xFF9A98AD`, la traccia `0xFF2A2D45` e il colore d'accento `0xFF7C6CF0`. Il suo `statusColor` dà a ogni stato di conversazione il colore che Narsil usa per esso: `working` blu `0xFF3B8BFF`, `idle` grigio `0xFF8A90A6`, `waiting` giallo `0xFFF5B400`, `done` verde `0xFF22B573` ed `error` rosso `0xFFF0435A`. Uno stato sconosciuto ripiega sul grigio di `idle`.

### Narsil al centro: il disegno

La colonna centrale inizia con un `Image` largo 40 dp e alto 66 dp, che nomina una risorsa, `ART_ID` (`"narsil"`). L'immagine vera e propria viene da `onTileResourcesRequest`:

- **Se l'orologio ha scaricato un disegno**, `repo.art()` restituisce i suoi byte, che entrano come risorsa di immagine inline.
- **Se non ancora**, il tile usa il disegno incluso nell'app, `R.drawable.narsil_preview`.

Il disegno viene dal repository [narsil-pet](https://github.com/davshn/narsil-pet) su GitHub. `StatusRepository` scarica l'URL del campo `art` dello stato, solo se inizia con `https://raw.githubusercontent.com/davshn/narsil-pet/`, e lo conserva come `art.png` ([guida 2](/it/watch/reading-the-state/)). Il README ne riporta il credito: "Narsil's art is © its author and comes from the narsil-pet repository." (le illustrazioni di Narsil sono © del loro autore e vengono dal repository narsil-pet.)

Il sistema mette in cache le risorse in base a una stringa di versione, quindi il tile deve cambiare la versione ogni volta che cambia l'immagine. `resourcesVersion()` è l'hash dei byte dell'immagine, o `"preview"` se non ce n'è una:

```kotlin
private fun resourcesVersion(): String = repo.art()?.contentHashCode()?.toString() ?: "preview"
```

Nuova posa, nuovi byte, nuova versione, e il sistema chiede di nuovo le risorse. Stessa posa, stessa versione, e non viene ricaricato niente.

### Quale posa: la conversazione più importante

Non è il tile a scegliere la posa. La sceglie la mod, e la indica nell'URL. In `sendStatus` (`hooks/register.tsx` in narsil-pet):

```ts
art: artUrl(POSE[list[0]!.status], stageOf(levelOf(earned).level)),
```

Tre pezzi decidono quell'URL:

1. **L'elenco è ordinato.** `list` viene da `fleetOf` in `hooks/fleet.ts`, che ordina ogni conversazione aperta per `RANK`, con il commento "An error first, then what needs you, what works, what finished" (prima un errore, poi ciò che ha bisogno di te, ciò che lavora, ciò che ha finito): `error` 0, `waiting` 1, `working` 2, `done` 3, `idle` 4. Tra due dello stesso rango, va prima quella cambiata più di recente. Quindi `list[0]` è la conversazione più importante: qualsiasi errore batte una domanda, qualsiasi domanda batte un lavoro in corso.
2. **La posa è quella dello stato.** `POSE` in `hooks/sprite.ts` nomina le immagini: `trabajando`, `parada`, `necesita`, `terminado`, `error`.
3. **Lo stadio è la crescita di Narsil.** `stageOf` in `hooks/xp.ts` dà uno stadio da 1 a 5 in base al suo livello, a partire dai livelli 1, 5, 10, 20 e 35.

`artUrl` in `hooks/phone.ts` li unisce: la base `https://raw.githubusercontent.com/davshn/narsil-pet/main/assets`, poi `etapa<stage>/` per gli stadi da 2 a 5 ("etapa" significa "stadio"), poi `<pose>-oscuro.png`. L'orologio riceve sempre il disegno scuro (`oscuro`), che si adatta allo sfondo scuro del tile. Una conversazione fallita, allo stadio 3, è `.../assets/etapa3/error-oscuro.png`.

### Le quattro righe di testo

Sotto il disegno, quattro elementi `Text`, ognuno di una riga (`setMaxLines(1)`):

```kotlin
.addContent(text(limitLine(fiveHour, "5 h"), 13f, fiveHour?.let { parseColor(it.color) } ?: Palette.DIM, bold = true))
.addContent(text(limitLine(week, "sem"), 11f, week?.let { parseColor(it.color) } ?: Palette.DIM))
.addContent(text(fleetLine(state), 11f, fleetColor(state)))
.addContent(text(state?.let { ageLabel(it.at, System.currentTimeMillis() / 1000) } ?: "configúrame", 9f, Palette.DIM))
```

Queste righe vengono da `NarsilTileService.kt` (GPL v3). Le dimensioni danno la gerarchia: la cifra delle 5 ore a 13 sp e in grassetto, perché cambia più in fretta e si esaurisce per prima; la settimana e le conversazioni a 11 sp; l'età a 9 sp in grigio.

- **`limitLine`** scrive `5 h 62%`, con la percentuale troncata a un numero intero (`toInt()`), o `5 h –` senza un limite.
- **`fleetLine`** conta le conversazioni che hanno bisogno di te con `needsYou` di `Display.kt`, che è `sessions.count { it.status == "waiting" }`. Una dà `1 te necesita`, più d'una danno `2 te necesitan`. Se nessuna è in attesa, mostra l'etichetta della prima conversazione in minuscolo; senza conversazioni, `sin conversaciones`.
- **`fleetColor`** colora quella riga con il colore dello stato della prima conversazione, quindi una riga rossa significa che la conversazione più importante è fallita.
- **`ageLabel`** misura da `at`, il momento in cui il computer ha inviato lo stato, non il momento in cui l'orologio l'ha letto. È l'età onesta: uno stato letto un minuto fa ma inviato tre ore fa dice `hace 3 h`.

`ageLabel`, da `Display.kt` (GPL v3):

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

`coerceAtLeast(0)` protegge da un orologio un po' indietro rispetto al computer: uno stato "dal futuro" dice `ahora`, non un'età negativa.

### Un tocco apre l'app

Il `Box` esterno ha un `Clickable` la cui azione è un `LaunchAction` per `MainActivity`, nel package stesso dell'app. L'intero tile è un unico grande bersaglio, adatto a un piccolo schermo rotondo.

## Costruiscila con Claude

Chiedi a Claude un tile che disegni i limiti come anelli a partire da uno stato salvato. Le idee che deve fare bene sono che il tile non aspetta mai la rete, e che il colore viene dallo stato e non da soglie sull'orologio.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nella mia app Wear OS `my-watch`, aggiungi un `TileService` con ProtoLayout. Legge lo stato salvato dal mio `StatusRepository.cached()` (un `NarsilState` con `limits` di `key` `fiveHour` e `week`, ognuno con `percent` e un `color` `#RRGGBB`, e `sessions` con `status` e `label`). Disegna il limite di 5 ore come anello esterno spesso 7 dp e la settimana come anello interno spesso 5 dp, 3 dp più all'interno; ogni anello è un `Arc` ancorato a 0 gradi con `ARC_ANCHOR_START`, la parte usata di `percent × 3.6` gradi nel colore del limite e il resto in un colore di traccia. Al centro, una risorsa di immagine con l'immagine salvata, con ripiego su un drawable incluso, e la versione delle risorse impostata a un hash dei byte dell'immagine. Sotto, `5 h 62%`, `sem 90%`, quante sessioni hanno lo stato `waiting`, e l'età dal campo `at` dello stato. Se l'ultimo controllo è più vecchio di 15 minuti, metti in coda un aggiornamento in background senza aspettarlo. Un tocco apre `MainActivity`. Metti i testi e il parsing dei colori in funzioni pure con test JUnit.

### Cosa controllare nella risposta di Claude

1. `onTileRequest` disegna dallo stato salvato e non aspetta mai una chiamata di rete.
2. I gradi dell'anello sono la percentuale, limitata a 0–100, moltiplicata per 3,6, e nessuna `ArcLine` viene aggiunta con lunghezza 0.
3. Il colore viene dal campo `color` del limite tramite un parser che ripiega su un colore neutro, non da soglie scritte nel codice del tile.
4. La versione delle risorse cambia quando cambia l'immagine.
5. L'età si misura dall'`at` dello stato, non da quando l'orologio l'ha letto.
6. Senza uno stato, il tile disegna comunque: anelli vuoti, trattini e un invito a configurarlo.

Se un controllo fallisce, di' a Claude cosa vedi: "il tile mostra la posa vecchia anche dopo che l'app mostra quella nuova", che indica una versione delle risorse che non cambia.

### Come l'ha chiesta l'autore

Per il tile non esiste una richiesta registrata. Questa è una ricostruzione dalla cronologia dei commit:

- narsil-pet `6400a6f` (2026-11-23) "feat(phone): publish Claude limits and open conversations for the watch" (pubblica i limiti di Claude e le conversazioni aperte per l'orologio). Aggiunge `limits`, con il `color` di ogni limite preso da `levelColor`, e `sessions` ordinate per importanza, ed è questo che permette al tile di prendere entrambi dallo stato.
- narsil-watch `b47ca7a` (2026-11-23) "feat: Narsil on Wear OS with Claude limits and open conversations" (Narsil su Wear OS con i limiti di Claude e le conversazioni aperte). Il suo messaggio si apre con il tile: "A tile with the 5-hour and weekly limits as rings and Narsil in her current pose" (un tile con i limiti di 5 ore e settimanali come anelli e Narsil nella sua posa attuale).

Il commento del file stesso è l'enunciato più breve del progetto: "The tile: the 5-hour limit as the outer ring, the week as the inner one, Narsil in the middle in her current pose, and who needs you." (il tile: il limite di 5 ore come anello esterno, la settimana come quello interno, Narsil al centro nella sua posa attuale, e chi ha bisogno di te.)

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida. Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

Un tile ridotto con un anello e una riga, scritto per questa guida e adattato da `NarsilTileService.kt` in [narsil-watch](https://github.com/davshn/narsil-watch) (GPL v3). Usa le stesse chiamate ProtoLayout e Tiles di quel file, e dà per scontati `StatusRepository`, `Limit`, `Palette` e `parseColor` delle cartelle `data/` e `domain/` del repository:

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

Non ha un'immagine, quindi le sue risorse sono vuote e la versione non cambia mai. Per aggiungere Narsil, segui il file reale: un `Image` con un id di risorsa nel layout, i byte in `onTileResourcesRequest`, e una versione che sia l'hash di quei byte. Dichiara il servizio nel manifest come mostra la [guida 1](/it/watch/what-it-is/).

## Errori comuni e come testarlo

- **Aspettare la rete in `onTileRequest`.** Il sistema si aspetta una risposta rapida. Disegna dallo stato salvato e aggiorna in background.
- **Aggiornare a ogni richiesta del tile.** Ogni scorrimento costerebbe una richiesta. Il controllo dei 15 minuti la limita a una per finestra.
- **Una versione delle risorse fissa.** L'immagine non si aggiorna mai, perché il sistema tiene quella in cache.
- **Scrivere 60 e 85 nel codice dell'orologio.** Funziona finché la mod non cambia la sua regola. Dipingi il colore che porta lo stato.
- **Un arco di lunghezza zero.** Aggiungi la parte usata solo quando supera 0 gradi, e la traccia solo sotto i 360.
- **Misurare l'età dalla lettura.** L'età che conta è quella da quando il computer l'ha inviato.
- **Dimenticare lo stato vuoto.** Prima della prima lettura, il tile deve comunque disegnarsi e dirti di configurarlo.

Per testare la logica senza un orologio, esegui i test unitari:

```bash
./gradlew :app:testDebugUnitTest
```

`DisplayTest.kt` copre ciò che il tile scrive e dipinge: "counts the conversations that need you" (conta le conversazioni che hanno bisogno di te; due `waiting` su quattro), "says how old the state is" (dice quanto è vecchio lo stato; `ahora`, `hace 12 min`, `hace 3 h`, `hace 2 d`), "colors a status as Narsil does" (colora uno stato come fa Narsil) e "reads a level color, and falls back to dim on noise" (legge un colore di livello, e ripiega sul grigio smorzato davanti al rumore). Il layout in sé non ha test automatici.

Sull'orologio: installa l'app, aggiungi il tile ed esegui `/narsil movil prueba` in Claude Code. Apri l'app una volta così si aggiorna, poi scorri fino al tile. Dovrebbe mostrare la nuova età, e la posa della tua conversazione più importante.

### Dove il codice e il README differiscono

- Il README dice che l'orologio legge lo stato "whenever you open the app or the tile" (ogni volta che apri l'app o il tile). Il tile lo chiede solo quando l'ultimo controllo risale a più di 15 minuti prima, e disegna lo stato conservato prima che arrivi quello nuovo.
- Un commento in `NarsilTileService.kt` dice "the art Narsil publishes is 91 x 150" (le illustrazioni che pubblica Narsil sono 91 x 150), e dichiara l'immagine inline con quelle dimensioni (`ART_W`, `ART_H`). I disegni scuri in `assets/` di narsil-pet oggi sono tutti alti 150 pixel, ma larghi tra 91 e 106 pixel, a seconda della posa e dello stadio. Il `narsil_preview.png` incluso è 91 x 150. Il tile mostra comunque l'immagine in un riquadro fisso di 40 x 66 dp.
- Il README dice che Narsil sta "above how many conversations need you" (sopra quante conversazioni hanno bisogno di te). Quando nessuna ha bisogno di te, la riga mostra invece lo stato della prima conversazione, cosa che il README non menziona.

## Per andare oltre

- Leggi `tile/NarsilTileService.kt` in [narsil-watch](https://github.com/davshn/narsil-watch).
- L'anello potrebbe segnare il punto in cui il limite si azzera: lo stato porta `resetsAt` per ogni limite, e il tile non lo usa ancora.
- Poiché il conteggio delle conversazioni che hanno bisogno di te viene da al massimo 8 sessioni, un computer con molte conversazioni fallite potrebbe spingere fuori dall'elenco una in attesa. L'ordinamento mette gli errori per primi, quindi ci vorrebbero nove o più conversazioni.
- Come arriva lo stato all'orologio: [Leggere lo stato di Narsil](/it/watch/reading-the-state/). Il lato della mod: [Avvisi sul telefono e sull'orologio](/it/mods/pet/phone-and-watch/).
- La prossima: [La complicazione](/it/watch/complication/), il limite di 5 ore su qualsiasi quadrante.
