---
title: La complicazione
description: 'Come la complicazione Claude 5 h mette il limite di 5 ore su qualsiasi quadrante, come arco colorato (RANGED_VALUE) o testo breve, e come si dice alla sua sorgente dati di aggiornarsi.'
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

## Cosa fa

Una complicazione è la piccola informazione che un quadrante mostra oltre all'ora: la data, la batteria, il meteo. Narsil Watch ne offre una, chiamata **Claude 5 h**. Mette il limite di 5 ore di Claude su qualsiasi quadrante che abbia uno spazio libero per lei, così vedi quanto hai consumato ogni volta che guardi l'ora.

Esiste in due forme, e a scegliere è il quadrante:

- **Un arco**, il tipo `RANGED_VALUE`: un anello o una barra che si riempie da 0 a 100 %, con `62%` come testo e `5h` come titolo. Il suo colore passa dal verde al giallo al rosso man mano che il limite si riempie.
- **Un testo breve**, il tipo `SHORT_TEXT`: solo `62%` con il titolo `5h`, nello stile che usa il quadrante.

Un tocco sulla complicazione apre l'app. Prima che l'orologio abbia letto uno stato con i limiti, non mostra niente: l'aspetto "nessun dato" del quadrante.

Per aggiungerla, apri l'editor del quadrante sull'orologio, scegli uno spazio per le complicazioni e seleziona **Claude 5 h** dall'elenco dell'app Narsil.

> **Sperimentale.** La complicazione mostra la cifra delle 5 ore dall'ultimo stato che l'orologio ha conservato, e non porta un'età. La mod pubblica quello stato solo mentre lavori lontano dal computer, entro la quota giornaliera gratuita di ntfy.sh, e l'orologio lo chiede al massimo ogni 15 minuti. Una cifra di ieri sembra comunque una cifra di adesso; apri l'app o il tile per vedere quanto è vecchia.

## Come funziona dentro

Sta tutta in `complication/LimitComplicationService.kt`, 65 righe. È una sorgente dati: il quadrante le chiede i dati, e lei risponde dallo stato conservato sull'orologio.

### Una sorgente dati interrogata dal sistema

Su Wear OS, un quadrante non chiama la tua app. Lo fa il sistema, per conto del quadrante, tramite un servizio che la tua app dichiara. Il manifest dichiara questo:

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

L'estratto viene da `app/src/main/AndroidManifest.xml` in narsil-watch (GPL v3). Ogni parte ha un compito:

- **`BIND_COMPLICATION_PROVIDER`**: solo il sistema può collegarsi al servizio. È esportato perché il sistema possa raggiungerlo, e protetto perché nient'altro possa farlo.
- **`ACTION_COMPLICATION_UPDATE_REQUEST`**: l'azione che il sistema usa per chiedere i dati.
- **`SUPPORTED_TYPES`**: le due forme che offre, `RANGED_VALUE` e `SHORT_TEXT`. L'editor del quadrante mostra la complicazione solo per gli spazi che accettano una delle due.
- **`UPDATE_PERIOD_SECONDS`**: 900 secondi, 15 minuti, lo stesso ritmo dell'aggiornamento.
- **L'etichetta**, `@string/complication_label`, è `Claude 5 h` in `res/values/strings.xml`. È il nome che compare nell'elenco dell'editor.

### Rispondere dallo stato salvato

Il servizio estende `SuspendingComplicationDataSourceService`, della libreria delle sorgenti dati per le complicazioni, quindi la sua risposta è una funzione Kotlin `suspend`. Da `LimitComplicationService.kt` in narsil-watch (GPL v3):

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

Due cose da notare:

- **Niente rete.** `onComplicationRequest` legge `cached()`, lo stato conservato da `StatusRepository` ([guida 2](/it/watch/reading-the-state/)). Come il tile, la complicazione non aspetta mai ntfy.sh. Il sistema può chiedere spesso, e la risposta è sempre immediata.
- **Nessun limite, nessun dato.** Senza uno stato conservato, o con uno stato che non ha la riga `fiveHour` (una mod più vecchia, o Claude Code non l'ha ancora comunicata), la risposta è `NoDataComplicationData()`. Il quadrante mostra allora il suo aspetto vuoto invece di un falso 0 %.

`getPreviewData` è ciò che l'editor del quadrante disegna mentre scegli una complicazione: un limite inventato al 62 %, con l'etichetta `5 horas` (5 ore), in giallo. È un esempio fisso, così l'editor mostra qualcosa di sensato anche prima della prima lettura.

### RANGED_VALUE o SHORT_TEXT

`data(type, limit)` costruisce la risposta per il tipo che il quadrante ha chiesto. Prima le parti comuni:

```kotlin
val percent = limit.percent.coerceIn(0.0, 100.0).toFloat()
val value = PlainComplicationText.Builder("${percent.toInt()}%").build()
val title = PlainComplicationText.Builder("5h").build()
val description = PlainComplicationText.Builder("Claude, límite de 5 horas: ${percent.toInt()} %").build()
```

- **La percentuale viene limitata a 0–100** e trasformata in un `Float`, il tipo che accetta il valore a intervallo.
- **`value`** è il testo `62%`, un numero intero.
- **`title`** è `5h`, abbastanza corto per gli spazi più piccoli.
- **`description`** è la descrizione del contenuto, ciò che dice uno screen reader: `Claude, límite de 5 horas: 62 %` (Claude, limite di 5 ore: 62 %). Entrambi i builder ne richiedono una. È la versione accessibile della complicazione.

Un tocco porta all'app tramite un `PendingIntent` per `MainActivity`, con `FLAG_IMMUTABLE` (nessuno può cambiare l'intent) e `FLAG_UPDATE_CURRENT`.

Poi le due forme:

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

Entrambi gli estratti vengono da `LimitComplicationService.kt` (GPL v3).

**`RANGED_VALUE`** accetta un valore, un minimo e un massimo: `percent`, `0f`, `100f`. L'arco o la barra li disegna il quadrante stesso, nel suo stile. Ciò che aggiunge l'app è una **rampa di colori**, i colori che la parte piena deve assumere man mano che il valore cresce.

**`SHORT_TEXT`** accetta solo il testo e la descrizione, con il titolo. Niente colore: è il quadrante a decidere l'aspetto del testo.

**Qualsiasi altro tipo** riceve `null`. Il manifest offre solo questi due, quindi il sistema non dovrebbe mai chiederne un altro, e `null` è la risposta onesta se lo fa.

### Perché la rampa è vicina a 60 e 85, ma non esatta

Il tile dipinge ogni limite con il colore che ha inviato il computer ([guida 3](/it/watch/tile/)). La complicazione non può: un valore a intervallo non ha un campo "colore di questo valore". Accetta una rampa, un elenco di colori distribuiti sull'intervallo, e il quadrante sceglie il colore per il valore.

Il commento del codice spiega la sua scelta. Con `interpolated` impostato a `false`, la rampa viene divisa in passi uguali, uno per colore; sette è "the most a ramp takes" (il massimo che una rampa accetta). Con sette passi su 0–100, ognuno copre circa il 14,3 %. Quattro verdi, due gialli e un rosso danno:

| Intervallo del limite di 5 ore | Colore | Esadecimale  |
| ------------------------------ | ------ | ------------ |
| Da 0 % a circa 57 %            | Verde  | `0xFF22B573` |
| Da circa 57 % a circa 86 %     | Giallo | `0xFFF5B400` |
| Da circa 86 % a 100 %          | Rosso  | `0xFFF0435A` |

La regola di Narsil, `levelColor` in `hooks/usage.ts` di narsil-pet, diventa gialla al 60 % e rossa all'85 %. Quindi tra il 57 % e il 60 % la complicazione è già gialla mentre il tile è ancora verde; ed esattamente all'85 % il tile è rosso mentre la complicazione è ancora gialla. Tre punti al massimo, ai bordi. I tre colori sono gli stessi valori esadecimali di `levelColor`, così la complicazione si accorda con il resto di Narsil.

Il commento della classe, "an arc that turns yellow at 60 % and red at 85 %" (un arco che diventa giallo al 60 % e rosso all'85 %), descrive l'intenzione; il commento della rampa accanto descrive ciò che fa il codice.

### Come si dice alla complicazione di aggiornarsi

Il sistema chiede nuovi dati a una sorgente dati in due modi, e questa app li usa entrambi.

1. **A orario.** `UPDATE_PERIOD_SECONDS` vale 900 nel manifest, quindi il sistema può chiedere ogni 15 minuti. È una richiesta al servizio, che risponde dallo stato conservato.
2. **Su richiesta.** Quando l'app ha qualcosa di nuovo, chiede al sistema di chiamare di nuovo il servizio. È `Refresh.redraw` in `sync/Refresh.kt` (GPL v3):

```kotlin
fun redraw(context: Context) {
    TileService.getUpdater(context).requestUpdate(NarsilTileService::class.java)
    ComplicationDataSourceUpdateRequester
        .create(context, ComponentName(context, LimitComplicationService::class.java))
        .requestUpdateAll()
}
```

`ComplicationDataSourceUpdateRequester.create(...)` nomina questa sorgente dati tramite il suo componente, e `requestUpdateAll()` chiede al sistema di richiedere dati freschi per ogni spazio in cui compare, su ogni quadrante. La stessa funzione chiede al tile di ridisegnarsi.

`redraw` viene chiamata alla fine di ogni aggiornamento in background, da `RefreshWorker`, e dopo ogni aggiornamento nell'app ([guida 5](/it/watch/app-and-refresh/)). Quindi l'ordine è sempre: prendi lo stato, conservalo, poi avvisa le superfici. Quando il sistema chiama `onComplicationRequest`, il nuovo stato è già in `cached()`.

L'orario da solo basterebbe a far muovere la cifra ogni 15 minuti. La richiesta su richiesta è ciò che la fa cambiare subito dopo che tocchi **Actualizar** (aggiorna) nell'app.

## Costruiscila con Claude

Chiedi a Claude una sorgente dati per complicazioni che mostri una percentuale. Le idee che deve fare bene sono che risponde da dati salvati, che offre sia un valore a intervallo sia un testo breve, e che "nessun dato" è una risposta vera e propria.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nella mia app Wear OS `my-watch`, aggiungi una sorgente dati per complicazioni `LimitComplicationService` che estenda `SuspendingComplicationDataSourceService`. In `onComplicationRequest`, leggi il limite di 5 ore dal mio `StatusRepository.cached()` (un `Limit` con `key` `fiveHour` e `percent`), e restituisci `NoDataComplicationData()` quando non c'è. Supporta `RANGED_VALUE` (valore limitato a 0–100, minimo 0, massimo 100, testo come `62%`, titolo `5h`, una `ColorRamp` non interpolata di sette colori: quattro verdi `0xFF22B573`, due gialli `0xFFF5B400`, un rosso `0xFFF0435A`) e `SHORT_TEXT` (lo stesso testo e lo stesso titolo); restituisci `null` per gli altri tipi. Dai a entrambi una descrizione del contenuto, e un'azione al tocco che apra `MainActivity` con un `PendingIntent` immutabile. Fornisci `getPreviewData` con un esempio al 62 %. Dichiarala nel manifest con `BIND_COMPLICATION_PROVIDER`, `SUPPORTED_TYPES` `RANGED_VALUE,SHORT_TEXT` e `UPDATE_PERIOD_SECONDS` 900, e dopo ogni aggiornamento chiama `ComplicationDataSourceUpdateRequester.create(...).requestUpdateAll()`.

### Cosa controllare nella risposta di Claude

1. `onComplicationRequest` legge lo stato salvato e non fa nessuna richiesta di rete.
2. Senza un limite restituisce `NoDataComplicationData()`, non uno 0 %.
3. Il valore viene limitato a 0–100 prima di diventare il valore a intervallo.
4. Ogni forma ha una descrizione del contenuto, il testo per uno screen reader.
5. Il `PendingIntent` è `FLAG_IMMUTABLE`.
6. I `SUPPORTED_TYPES` del manifest elencano esattamente i tipi che il codice costruisce.
7. Qualcosa chiama `requestUpdateAll()` dopo che i nuovi dati sono stati conservati, non prima.

Se un controllo fallisce, di' a Claude cosa vedi: "la complicazione dice 0 % subito dopo che installo l'app", che significa che "nessun dato" viene risposto come uno zero.

### Come l'ha chiesta l'autore

Per la complicazione non esiste una richiesta registrata. Questa è una ricostruzione dalla cronologia dei commit:

- narsil-watch `b47ca7a` (2026-11-23) "feat: Narsil on Wear OS with Claude limits and open conversations" (Narsil su Wear OS con i limiti di Claude e le conversazioni aperte). La complicazione arriva con il resto dell'app. Il suo messaggio la nomina in una frase: "a 5-hour complication" (una complicazione delle 5 ore).
- narsil-watch `04390c8` (2026-11-24) "docs: align README with the Narsil family" (allinea il README alla famiglia Narsil). Il README la descrive: "The **Claude 5 h** complication shows the 5-hour limit on any watch face, as an arc (`RANGED_VALUE`) or as a short text." (la complicazione **Claude 5 h** mostra il limite di 5 ore su qualsiasi quadrante, come arco, `RANGED_VALUE`, o come testo breve.)

Solo il limite di 5 ore ha avuto una complicazione. Il codice non dice perché; il commento della classe la chiama "Claude's 5-hour limit on the watch face" (il limite di 5 ore di Claude sul quadrante), ed è il limite che cambia più in fretta. Il limite settimanale sta sul tile e nell'app.

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida. Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

Una complicazione per il limite settimanale, scritta per questa guida e adattata da `LimitComplicationService.kt` in [narsil-watch](https://github.com/davshn/narsil-watch) (GPL v3). Usa le stesse chiamate di libreria, dà per scontati `StatusRepository` e `Limit` del repository, e offre solo il testo breve:

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

Dichiarala nel manifest come quella reale, con `SUPPORTED_TYPES` impostato solo a `SHORT_TEXT`, e aggiungila a `Refresh.redraw` con il suo `ComplicationDataSourceUpdateRequester`.

## Errori comuni e come testarlo

- **Scaricare dati in `onComplicationRequest`.** Il sistema la chiama quando vuole. Rispondi dallo stato conservato.
- **Zero per "nessun dato".** Un falso 0 % sembra tanto margine. `NoDataComplicationData()` è la risposta veritiera.
- **Tipi non allineati.** Se il manifest offre un tipo per cui il codice restituisce `null`, lo spazio resta vuoto.
- **Una rampa con troppi colori.** Il commento del codice dice che sette è il massimo che una rampa accetta.
- **Aspettarsi le soglie esatte.** Con sette passi uguali, la rampa cambia a circa il 57 % e l'86 %, non al 60 % e all'85 %.
- **Nessuna descrizione del contenuto.** I builder ne richiedono una, e uno screen reader dipende da essa.
- **Aggiornare prima di conservare.** Chiama `requestUpdateAll()` dopo che il nuovo stato è stato salvato, altrimenti il sistema legge quello vecchio.
- **Leggere la cifra come se fosse in diretta.** Non ha un'età. Quando conta, apri il tile o l'app.

La complicazione non ha test automatici; i test unitari coprono lo stato che legge ([guida 2](/it/watch/reading-the-state/)). Sull'orologio:

1. Aggiungi **Claude 5 h** a uno spazio che accetta un valore a intervallo. L'anteprima dell'editor mostra 62 % in giallo.
2. Prima di qualsiasi lettura, lo spazio sembra vuoto.
3. Esegui `/narsil movil prueba` in Claude Code, poi apri l'app e tocca **Actualizar**. Lo spazio dovrebbe passare subito alla tua vera cifra delle 5 ore.
4. Prova uno spazio che accetta solo testo breve: la stessa cifra, senza l'arco.

### Dove il codice e il README differiscono

- Il commento della classe dice che l'arco "turns yellow at 60 % and red at 85 %" (diventa giallo al 60 % e rosso all'85 %). La rampa che costruisce cambia a circa il 57 % e l'86 %, come dice il commento accanto alla rampa.
- Il README dice che la complicazione mostra il limite "as an arc (`RANGED_VALUE`) or as a short text" (come arco, `RANGED_VALUE`, o come testo breve). È il quadrante a scegliere quale, in base al tipo che accetta il suo spazio.

## Per andare oltre

- Leggi `complication/LimitComplicationService.kt` in [narsil-watch](https://github.com/davshn/narsil-watch).
- Un `RANGED_VALUE` con `interpolated` impostato a `true` sfuma i colori in modo continuo invece che a passi. Scambieresti le soglie nette con un gradiente; prova entrambe le cose sul tuo quadrante.
- Lo stato porta `resetsAt` per il limite di 5 ore. Una complicazione potrebbe mostrare "reinicia en 2 h" (si azzera tra 2 h) invece della percentuale, con `resetLabel` di `Display.kt`.
- Torna [al tile](/it/watch/tile/), o a come si legge lo stato: [Leggere lo stato di Narsil](/it/watch/reading-the-state/).
- La prossima: [L'app e l'aggiornamento](/it/watch/app-and-refresh/), l'elenco delle conversazioni, la configurazione e il job ogni 15 minuti.
