---
title: L'app e l'aggiornamento
description: "L'app per l'orologio con ogni conversazione, i due limiti e il livello di Narsil; topic e chiave sull'orologio o dal computer; l'aggiornamento WorkManager ogni 15 minuti, i ridisegni e la CI."
route: watch
order: 5
updated: 2026-11-24
sources:
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/presentation/MainActivity.kt
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/sync/Refresh.kt
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/NarsilApplication.kt
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/domain/Display.kt
  - repo: watch
    path: .github/workflows/ci.yml
  - repo: watch
    path: app/src/test/kotlin/tech/davshn/narsilwatch/domain/DisplayTest.kt
  - repo: watch
    path: README.md
---

## Cosa fa

Il tile e la complicazione servono per un'occhiata. L'app, che si chiama **Narsil** nell'elenco delle app dell'orologio, serve quando vuoi il quadro completo. È un unico elenco che scorre:

1. **Narsil in alto**, nella posa della tua conversazione più importante, con il suo nome e il suo livello, come `⭐ Nivel 3 · 40/300 XP` (livello 3, 40 punti esperienza su 300).
2. **Una nota**, solo quando qualcosa non va: ancora nessuno stato, o uno stato sigillato che l'orologio non riesce ad aprire.
3. **`Límites de Claude`** (limiti di Claude): una riga per limite, `5 horas` (5 ore) e `Semana` (settimana), ognuna con la sua percentuale, una barra colorata, e quando si azzera, come `reinicia en 2 h 05 min` (si azzera tra 2 h 05 min).
4. **`Conversaciones`** (conversazioni): ogni conversazione aperta inviata dalla mod, le più importanti per prime, ognuna con un pallino colorato, il suo titolo e il suo stato, come `TE NECESITA` (ha bisogno di te). Se non ce n'è nessuna, l'intestazione dice `Sin conversaciones` (nessuna conversazione).
5. **L'età della lettura**, come `hace 12 min` (12 minuti fa).
6. **Due pulsanti**: `Actualizar` (aggiorna), che mentre lavora dice `Leyendo…` (sto leggendo), e `Configurar` (configura).

Dietro le schermate, un job in background chiede a ntfy.sh un nuovo stato ogni 15 minuti e ridisegna il tile e la complicazione. Questa guida copre entrambe le cose, più la CI e i test del progetto.

> **Sperimentale.** L'app mostra solo ciò che la mod ha pubblicato per ultimo, e la mod pubblica solo mentre lavori lontano dal computer, entro la quota giornaliera gratuita di ntfy.sh. L'aggiornamento in background gira al massimo ogni 15 minuti, l'intervallo più breve di WorkManager. L'app si installa come build di debug via `adb`, e il topic e la chiave si impostano a mano.

## Come funziona dentro

### Una sola activity, scritta con Compose for Wear OS

`presentation/MainActivity.kt` contiene l'intera app: una `ComponentActivity` e una manciata di funzioni composable. Usa Compose for Wear OS con Material 3: `AppScaffold`, `ScreenScaffold` e una `ScalingLazyColumn`, l'elenco che rimpicciolisce e sfuma gli elementi vicino ai bordi dello schermo rotondo.

I colori sono un `ColorScheme` di Material 3 costruito dalla `Palette` di `domain/Display.kt`: lo sfondo blu scuro, il testo chiaro, il grigio smorzato, la traccia e l'accento viola. Così l'app, il tile e la complicazione condividono un'unica serie di colori.

`onCreate` fa tre cose, in ordine:

```kotlin
override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val repo = StatusRepository(this)
    setupFrom(intent, repo)
    setContent {
        MaterialTheme(colorScheme = NarsilColors) {
            AppScaffold { NarsilScreen(repo) }
        }
    }
}
```

Questo estratto e gli altri di questa sezione vengono da `MainActivity.kt` in narsil-watch (GPL v3). `setupFrom` legge un topic e una chiave inviati dal computer, se ci sono (vedi sotto). Poi viene disegnata la schermata.

### Prima la configurazione, o l'elenco

`NarsilScreen` tiene il suo stato in pochi valori `remember`: se la configurazione è visibile, lo stato conservato, l'immagine, la nota corrente, e se è in corso un aggiornamento. La prima riga decide cosa vedi:

```kotlin
var isSetup by remember { mutableStateOf(!repo.isConfigured) }
```

`isConfigured` è vero quando c'è un topic salvato. Quindi la prima volta che apri l'app mostra **Configurar**, e tutte le volte successive mostra l'elenco.

Un `LaunchedEffect(isSetup)` esegue `refresh()` ogni volta che compare l'elenco: quando apri l'app, e subito dopo che salvi la configurazione. È questo l'"aggiornamento all'apertura". Chiama direttamente il repository, nello scope di coroutine della schermata:

```kotlin
fun refresh() {
    isLoading = true
    scope.launch {
        val result = repo.refresh()
        problem = when (result) {
            is StatusResult.Ok -> null
            StatusResult.NeedsKey -> "El estado va sellado: falta la clave o no es la de /narsil movil clave."
            StatusResult.Empty -> "Aún no hay estado: Narsil lo publica cuando escribes lejos del PC."
        }
        state = repo.cached()
        art = repo.art()
        isLoading = false
        Refresh.redraw(repo.appContext)
    }
}
```

Cosa significa ogni risultato sullo schermo:

- **`Ok`**: nessuna nota.
- **`NeedsKey`**: `El estado va sellado: falta la clave o no es la de /narsil movil clave.` (lo stato è sigillato: manca la chiave o non è quella di /narsil movil clave.)
- **`Empty`**: `Aún no hay estado: Narsil lo publica cuando escribes lejos del PC.` (ancora nessuno stato: Narsil lo pubblica quando scrivi lontano dal PC.)

Dopo qualsiasi risultato, la schermata ricarica lo stato e l'immagine conservati, e chiama `Refresh.redraw`, così il tile e la complicazione si allineano a ciò che l'app ha appena letto. La [guida 2](/it/watch/reading-the-state/) spiega perché un errore di rete dà `Ok` con lo stato conservato: essere offline non è un errore che l'app mostra.

`Empty` può comparire sopra uno stato. Se ntfy.sh non ha più un messaggio (un commento in narsil-pet dice che "keeps a message 12 h", conserva un messaggio 12 ore), il poll torna vuoto, ma l'orologio ha ancora la sua copia conservata. Vedi entrambe le cose: lo stato vecchio, e la nota che non c'è niente di nuovo.

### I limiti, con "reinicia en"

`LimitRow` disegna un limite: l'etichetta a sinistra, la percentuale a destra nel colore del limite (`62 %`), una barra di 6 dp con la parte usata in quel colore sopra la traccia e, sotto, quando si azzera. Il colore è `parseColor(limit.color)`, il colore che ha inviato il computer ([guida 3](/it/watch/tile/)).

Il testo dell'azzeramento è `resetLabel` di `domain/Display.kt` (GPL v3):

```kotlin
fun resetLabel(resetsAt: Long?, nowSeconds: Long): String {
    if (resetsAt == null) return ""
    if (resetsAt <= nowSeconds) return "reiniciado"
    val minutes = (resetsAt - nowSeconds) / 60
    return when {
        minutes < 60 -> "reinicia en $minutes min"
        minutes < 24 * 60 -> "reinicia en ${minutes / 60} h ${(minutes % 60).toString().padStart(2, '0')} min"
        else -> "reinicia en ${minutes / (24 * 60)} d ${(minutes % (24 * 60)) / 60} h"
    }
}
```

- **Nessun orario di azzeramento** (`null`, Claude non l'ha detto): nessuna riga. La riga la nasconde quando il testo è vuoto.
- **Entro l'ora**: `reinicia en 45 min`.
- **Entro il giorno**: `reinicia en 2 h 05 min`, con i minuti sempre a due cifre.
- **Più avanti**: `reinicia en 3 d 4 h`, la forma che di solito prende un limite settimanale.
- **Già passato**: `reiniciado` (azzerato).

Quest'ultimo caso è la riga più utile dell'app. La percentuale sopra viene dall'ultimo stato, che può avere ore. Se l'orario di azzeramento è passato, la finestra è ripartita da capo, e la percentuale mostrata non è più vera. `reiniciado` te lo dice. Il test "says when a limit resets" (dice quando si azzera un limite) in `DisplayTest.kt` controlla tutti e cinque i casi.

### Le conversazioni, con i loro stati

`SessionRow` disegna una conversazione come una riga arrotondata: un pallino di 8 dp nel colore dello stato, il titolo su una riga (tagliato con i puntini di sospensione se è lungo) e, sotto, l'etichetta dello stato, nello stesso colore, in grassetto. I colori sono quelli di `statusColor` di `Display.kt`: blu per `TRABAJANDO` (al lavoro), grigio per `PARADA` (ferma), giallo per `TE NECESITA` (ha bisogno di te), verde per `TERMINADA` (finita) e rosso per `ERROR`.

Le righe arrivano nell'ordine in cui le ha inviate la mod, che è l'ordinamento della mod: prima gli errori, poi ciò che ha bisogno di te, ciò che lavora, ciò che ha finito e ciò che è fermo ([guida 2](/it/watch/reading-the-state/)). Al massimo 8, con titoli di al massimo 40 caratteri, come li taglia `watchSessions` in `hooks/phone.ts` di narsil-pet. L'app non aggiunge un suo ordine, quindi è sempre d'accordo con la fascia sul tuo computer.

### Il livello di Narsil

`NarsilHeader` mostra l'immagine (48 per 80 dp), il nome **Narsil** in grassetto e il testo `xp` dello stato. L'immagine è quella che il repository ha scaricato dal GitHub di narsil-pet, decodificata con `BitmapFactory`; se non ce n'è ancora una, o non si decodifica, il disegno incluso `narsil_preview`. Il testo `xp` lo scrive la mod, quindi il livello, l'esperienza e le stelle sono esattamente quelli del computer.

### Configurar: configurarla sull'orologio

`SetupScreen` ha due campi e un pulsante:

- **`El tema de /narsil movil`** (il topic di /narsil movil), con il suggerimento `narsil-…`.
- **`La clave, si usas /narsil movil clave`** (la chiave, se usi /narsil movil clave), con il suggerimento `opcional` (facoltativa).
- **`Guardar`** (salva), attivo solo quando il topic non è vuoto.

I campi sono `BasicTextField` di Compose, di una riga ciascuno, riempiti con ciò che è già salvato. `Guardar` salva entrambi tramite il repository, che toglie gli spazi ai lati, e torna all'elenco, che si aggiorna. Per togliere la chiave, svuota il campo e salva.

La configurazione non controlla nient'altro. Un topic con un errore di battitura si salva senza problemi, e l'elenco poi dice `Aún no hay estado`. Un errore però viene perdonato: il repository aggiunge `-estado` solo se il topic non finisce già così ([guida 2](/it/watch/reading-the-state/)), quindi incollare per sbaglio il topic di stato funziona comunque.

Scrivere una chiave di 43 caratteri sulla tastiera di un orologio è lento. Per questo esiste un secondo modo.

### Impostare il topic e la chiave dal computer

`setupFrom` legge due extra dall'intent che ha avviato l'activity:

```kotlin
// Setup from the PC, without typing on the watch:
// adb shell am start -n tech.davshn.narsilwatch/.presentation.MainActivity --es topic narsil-... --es key ...
private fun setupFrom(intent: Intent?, repo: StatusRepository) {
    val topic = intent?.getStringExtra("topic") ?: return
    repo.topic = topic
    intent.getStringExtra("key")?.let { repo.key = it }
    Refresh.now(this)
}
```

Così, con l'orologio collegato via `adb` wireless ([guida 1](/it/watch/what-it-is/)), puoi inviare entrambi con un solo comando. Con valori inventati:

```bash
adb shell am start -n tech.davshn.narsilwatch/.presentation.MainActivity --es topic narsil-0000000000example0 --es key example-key-not-real
```

`am start -n` avvia l'activity indicata, e ogni `--es name value` aggiunge un extra di tipo stringa. Cosa ne fa il codice:

- **Senza l'extra `topic`, non succede niente.** La funzione esce subito, quindi un avvio normale dall'elenco delle app non cambia niente.
- **`topic` senza `key`** salva il topic e lascia la chiave salvata com'era.
- **`--es key ""`** salva una chiave vuota, cioè la toglie.
- **Poi `Refresh.now`** mette in coda un aggiornamento in background, e il tile e la complicazione si ridisegnano quando finisce.

Siccome `setupFrom` gira solo in `onCreate`, e l'activity non gestisce i nuovi intent, chiudi l'app sull'orologio prima di inviare il comando. Altrimenti Android potrebbe portare in primo piano l'app aperta senza leggere gli extra.

Due note sui segreti:

- **Dove finiscono.** Sull'orologio, nelle preferenze private dell'app ([guida 2](/it/watch/reading-the-state/)). Sul computer, il comando, chiave compresa, resta nella cronologia della tua shell. Cancella quella riga se altri usano la macchina.
- **Cosa permettono e come ruotarli.** Il topic permette a chiunque di leggere il tuo topic ntfy e di pubblicarci; la chiave apre i messaggi sigillati. `/narsil movil nuevo` crea un nuovo topic, e `/narsil movil clave` una nuova chiave; invia quelli nuovi con lo stesso comando.

L'activity è esportata, come deve esserlo ogni activity di avvio, perché il sistema possa avviarla. Vale lo stesso per qualsiasi app sull'orologio: tutto ciò che può avviare activity può avviare questa con un extra `topic`.

### L'aggiornamento: sync/Refresh.kt

Tre funzioni e un worker. Da `sync/Refresh.kt` in narsil-watch (GPL v3):

```kotlin
// Every 15 minutes (WorkManager's shortest), the watch asks ntfy.sh for the
// state and redraws the tile and the complication.
class RefreshWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        StatusRepository(applicationContext).refresh()
        Refresh.redraw(applicationContext)
        return Result.success()
    }
}

object Refresh {
    private const val PERIODIC = "narsil-refresh"
    private const val NOW = "narsil-refresh-now"

    private val online = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

    fun schedule(context: Context) {
        val work = PeriodicWorkRequestBuilder<RefreshWorker>(15, TimeUnit.MINUTES).setConstraints(online).build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP, work)
    }

    fun now(context: Context) {
        val work = OneTimeWorkRequestBuilder<RefreshWorker>().setConstraints(online).build()
        WorkManager.getInstance(context).enqueueUniqueWork(NOW, ExistingWorkPolicy.KEEP, work)
    }
```

Leggendolo:

- **`RefreshWorker`** prende lo stato ([guida 2](/it/watch/reading-the-state/)), poi chiede al tile e alla complicazione di ridisegnarsi (la [guida 4](/it/watch/complication/) mostra `redraw`). È un `CoroutineWorker`, quindi `refresh()`, una funzione `suspend`, ci gira dentro in modo naturale.
- **Riporta sempre successo.** Un recupero fallito non viene ripetuto con il backoff di WorkManager; il periodo successivo ci riprova e basta. Il repository conserva già l'ultimo stato buono, quindi non c'è niente da recuperare.
- **`online`**: entrambi i tipi di lavoro aspettano una connessione di rete. Offline, WorkManager trattiene il job finché l'orologio non è connesso, invece di eseguirlo per vederlo fallire.
- **`schedule`**: un job periodico ogni 15 minuti, la ripetizione più breve che WorkManager permette. È unico per nome, `narsil-refresh`, con la politica `KEEP`: se uno è già programmato, la nuova richiesta viene scartata. Così chiamare `schedule` a ogni avvio non accumula mai job né azzera il timer.
- **`now`**: un aggiornamento il prima possibile, unico come `narsil-refresh-now`, anch'esso con `KEEP`. Molte chiamate di fila, come scorrere più volte fino al tile, ne mettono in coda uno solo.

### NarsilApplication: dove parte la programmazione

L'intero file, senza package e import, da `NarsilApplication.kt` (GPL v3):

```kotlin
class NarsilApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        Refresh.schedule(this)
    }
}
```

Il manifest la indica come classe dell'applicazione (`android:name=".NarsilApplication"`). `Application.onCreate` gira ogni volta che parte il processo dell'app, per qualsiasi motivo: l'apertura dell'app, il sistema che si collega al tile, o che chiede dati alla complicazione. Quindi il job periodico viene programmato appena gira una qualsiasi parte dell'app e, grazie a `KEEP`, programmato una sola volta.

### Cosa gira quando

Mettendo insieme i pezzi:

| Momento                                                          | Cosa succede                                                                                     |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Parte una qualsiasi parte dell'app                               | `NarsilApplication` programma il job ogni 15 minuti, una sola volta.                             |
| Ogni 15 minuti, con la rete                                      | `RefreshWorker` prende lo stato, lo conserva e ridisegna il tile e la complicazione.             |
| Apri l'app (con il topic impostato)                              | La schermata prende lo stato direttamente, mostra il risultato e ridisegna entrambi.             |
| Tocchi `Actualizar`                                              | Lo stesso che all'apertura.                                                                      |
| Salvi sotto `Configurar`                                         | Compare l'elenco, che prende lo stato.                                                           |
| Invii il topic con `adb shell am start`                          | `Refresh.now` mette in coda un aggiornamento; anche la schermata lo prende quando compare.       |
| Il tile viene disegnato e l'ultimo controllo ha più di 15 minuti | `Refresh.now` mette in coda un aggiornamento; nel frattempo il tile disegna lo stato conservato. |
| L'orario di 900 secondi del sistema per la complicazione         | La complicazione risponde dallo stato conservato, senza scaricare niente.                        |

Ogni percorso finisce allo stesso modo: prendi, conserva, poi ridisegna. E nessuna superficie aspetta mai la rete per disegnare.

### La CI e i test unitari

`.github/workflows/ci.yml` gira a ogni push su `main` e a ogni pull request. Un solo job, su `ubuntu-latest`:

1. `actions/checkout@v4`.
2. `actions/setup-java@v4` con Temurin, Java 17.
3. `gradle/actions/setup-gradle@v4`.
4. `./gradlew :app:testDebugUnitTest :app:assembleDebug --console=plain`.

Quindi ogni modifica deve passare i test unitari e costruire un APK di debug. Non c'è un passo di lint, né una build di release, né test su dispositivo. Il wrapper di Gradle fissa Gradle 9.9.2 con un `distributionSha256Sum`, così il Gradle scaricato viene verificato prima di girare, e `gradle.properties` attiva la build cache e la configuration cache.

I test unitari sono JUnit 4 semplice, sulla JVM del computer, senza dispositivo Android. Tre file, tredici test:

- **`domain/DisplayTest.kt`** (5): "counts the conversations that need you" (conta le conversazioni che hanno bisogno di te), "says how old the state is" (dice quanto è vecchio lo stato), "says when a limit resets" (dice quando si azzera un limite), "colors a status as Narsil does" (colora uno stato come fa Narsil), "reads a level color, and falls back to dim on noise" (legge un colore di livello, e ripiega sul grigio smorzato davanti al rumore).
- **`data/StatusParserTest.kt`** (4): la lettura di uno stato in chiaro, la lettura di uno stato vecchio senza `limits` né `sessions`, uno stato sigillato che ha bisogno della chiave, e un topic vuoto o del rumore.
- **`data/SealTest.kt`** (4): l'apertura di un vettore sigillato dallo stesso `seal.ts` di narsil-pet, il rifiuto di un'altra chiave, il rifiuto di un messaggio manomesso, il rifiuto di ciò che non è sigillato.

Possono girare senza dispositivo perché la logica è stata tenuta fuori dalle classi Android: `Display.kt`, `NarsilState.kt`, `StatusParser.kt` e `Seal.kt` usano solo Kotlin, kotlinx.serialization e la libreria standard di Java. Le schermate, il tile, la complicazione e l'aggiornamento non hanno test automatici.

## Costruiscila con Claude

Chiedi a Claude l'elenco dell'app, la sua configurazione e l'aggiornamento in background insieme, dato che condividono il repository. Le idee che deve fare bene sono che ogni aggiornamento finisce ridisegnando le altre superfici, e che la programmazione è idempotente.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nella mia app Wear OS `my-watch` (Compose for Wear OS, Material 3), scrivi `presentation/MainActivity.kt`: se non c'è un topic salvato, mostra una schermata di configurazione con un campo per il topic, un campo facoltativo per la chiave e un pulsante Salva attivo solo con un topic; altrimenti una `ScalingLazyColumn` con l'immagine e il livello, i limiti (etichetta, percentuale nel colore del limite, una barra, e una riga di azzeramento da una funzione pura `resetLabel(resetsAt, now)` che dice "reiniciado" una volta passato), le sessioni nell'ordine ricevuto (un pallino nel colore dello stato, titolo, etichetta), l'età, e i pulsanti Aggiorna e Configura. Aggiorna quando compare l'elenco e con il pulsante, mostra una nota per "ancora nessuno stato" e "serve la chiave", poi ridisegna il tile e la complicazione. In `onCreate`, leggi gli extra stringa facoltativi `topic` e `key` così che `adb shell am start ... --es topic ... --es key ...` li imposti, poi metti in coda un aggiornamento. Scrivi `sync/Refresh.kt`: un `CoroutineWorker` che aggiorna e ridisegna; `schedule` come lavoro periodico unico ogni 15 minuti con `KEEP` e un vincolo di rete connessa; `now` come lavoro unico una tantum con `KEEP`; `redraw` con `TileService.getUpdater` e `ComplicationDataSourceUpdateRequester.requestUpdateAll()`. Chiama `schedule` da una sottoclasse di `Application`. Test JUnit per `resetLabel`, e un workflow di CI che esegua `./gradlew :app:testDebugUnitTest :app:assembleDebug`.

### Cosa controllare nella risposta di Claude

1. La schermata di configurazione compare solo quando non c'è un topic salvato, e l'elenco si aggiorna quando compare.
2. Ogni aggiornamento, nell'app e nel worker, finisce con un ridisegno del tile e della complicazione.
3. Il lavoro periodico è unico per nome con `KEEP`, e richiede una rete connessa.
4. Anche l'aggiornamento una tantum è unico, così chiamate ripetute mettono in coda un solo job.
5. `resetLabel` restituisce "reiniciado" per un azzeramento passato e niente per uno mancante, e ha un test per ogni caso.
6. Gli extra dell'intent sono facoltativi: un avvio normale non cambia niente, e un extra `key` mancante mantiene la chiave salvata.
7. Niente scrive nei log il topic o la chiave.

Se un controllo fallisce, di' a Claude cosa vedi: "dopo che tocco Actualizar l'app mostra il nuovo stato, ma il tile mostra ancora quello vecchio", che significa che nell'aggiornamento dell'app manca il ridisegno.

### Come l'ha chiesta l'autore

Per l'app o per l'aggiornamento non esiste una richiesta registrata. Questa è una ricostruzione dalla cronologia dei commit:

- narsil-watch `b47ca7a` (2026-11-23) "feat: Narsil on Wear OS with Claude limits and open conversations" (Narsil su Wear OS con i limiti di Claude e le conversazioni aperte). L'app, l'aggiornamento, la classe dell'applicazione, il workflow di CI e i test arrivano tutti in questo solo commit. Il suo messaggio chiude l'elenco delle superfici con "an app listing every open conversation" (un'app che elenca ogni conversazione aperta).
- narsil-watch `04390c8` (2026-11-24) "docs: align README with the Narsil family" (allinea il README alla famiglia Narsil). Il primo README aveva già entrambi i modi per impostare il topic e la chiave, sotto "Set up". Questo commit lo rinomina "Settings", aggiunge una sezione Security che dice dove vengono conservati il topic e la chiave, e la riga sull'aggiornamento: "pull the latest version of this repository and run the same command again: the settings are kept." (scarica l'ultima versione di questo repository ed esegui di nuovo lo stesso comando: le impostazioni vengono conservate.)

Il commento sopra `setupFrom` conserva nel codice stesso il motivo del percorso `adb`: "Setup from the PC, without typing on the watch" (configurazione dal PC, senza scrivere sull'orologio).

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida. Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

L'aggiornamento e il suo avvio, scritti per questa guida e adattati da `sync/Refresh.kt` e `NarsilApplication.kt` in [narsil-watch](https://github.com/davshn/narsil-watch) (GPL v3). Usano le stesse chiamate di WorkManager, Tiles e complicazioni, e danno per scontati il tuo `StatusRepository`, il tuo servizio del tile e il tuo servizio della complicazione:

```kotlin
package com.example.mywatch.sync

import android.app.Application
import android.content.ComponentName
import android.content.Context
import androidx.wear.tiles.TileService
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceUpdateRequester
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit
import com.example.mywatch.complication.MyComplicationService
import com.example.mywatch.data.StatusRepository
import com.example.mywatch.tile.MyTileService

class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        StatusRepository(applicationContext).refresh()
        Sync.redraw(applicationContext)
        return Result.success()
    }
}

object Sync {
    private val online = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

    fun schedule(context: Context) {
        val work = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES).setConstraints(online).build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork("my-sync", ExistingPeriodicWorkPolicy.KEEP, work)
    }

    fun now(context: Context) {
        val work = OneTimeWorkRequestBuilder<SyncWorker>().setConstraints(online).build()
        WorkManager.getInstance(context).enqueueUniqueWork("my-sync-now", ExistingWorkPolicy.KEEP, work)
    }

    fun redraw(context: Context) {
        TileService.getUpdater(context).requestUpdate(MyTileService::class.java)
        ComplicationDataSourceUpdateRequester
            .create(context, ComponentName(context, MyComplicationService::class.java))
            .requestUpdateAll()
    }
}

class MyWatchApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        Sync.schedule(this)
    }
}
```

Indica la classe dell'applicazione nel `<application android:name=...>` del manifest, come mostra la [guida 1](/it/watch/what-it-is/). Nella tua activity, leggi gli extra di configurazione prima di disegnare, anche questo scritto per questa guida:

```kotlin
private fun setupFrom(intent: Intent?, repo: StatusRepository) {
    val topic = intent?.getStringExtra("topic") ?: return
    repo.topic = topic
    intent.getStringExtra("key")?.let { repo.key = it }
    Sync.now(this)
}
```

## Errori comuni e come testarlo

- **Aggiornare senza ridisegnare.** L'app mostra il nuovo stato e il tile tiene quello vecchio. Finisci ogni aggiornamento con `redraw`.
- **Programmare con `REPLACE`.** Ogni avvio del processo annullerebbe il job programmato e ne metterebbe in coda uno nuovo. `KEEP` lascia stare la programmazione esistente, quindi avviare spesso non cambia niente.
- **Chiedere meno di 15 minuti.** Il lavoro periodico di WorkManager non si ripete più in fretta, come dice il commento del codice.
- **Nessun vincolo di rete.** Il job gira offline solo per fallire, e l'occasione successiva è tra 15 minuti.
- **Inviare il comando `adb` a un'app aperta.** Gli extra vengono letti solo in `onCreate`. Chiudi prima l'app.
- **Fidarsi della percentuale dopo un azzeramento.** Se la riga dice `reiniciado`, la percentuale sopra è di prima dell'azzeramento.
- **Una chiave vera in un terminale condiviso.** Resta nella cronologia della shell. Usa la schermata di configurazione, o cancella quella riga.
- **Logica dentro i composable.** I testi e i colori in `Display.kt` si testano sulla JVM; dentro un composable si potrebbero testare solo su un dispositivo.

Per eseguire gli stessi controlli della CI, dal repository:

```bash
./gradlew :app:testDebugUnitTest :app:assembleDebug
```

Sull'orologio:

1. Apri l'app senza topic: mostra `Configurar`.
2. Invia il topic dal computer con il comando `adb shell am start` visto sopra, usando il tuo topic in un terminale privato. Apri l'app: compare l'elenco, che si aggiorna.
3. Esegui `/narsil movil prueba` in Claude Code e tocca `Actualizar`. L'età dice `ahora`, e il tile e la complicazione cambiano subito.
4. Imposta una chiave sbagliata sotto `Configurar`. Con uno stato sigillato, la nota dice che lo stato è sigillato. Rimetti la chiave giusta e si apre di nuovo.
5. Per vedere il job periodico, collega l'orologio e aspetta: l'età sul tile si azzera dopo l'aggiornamento successivo, se nel frattempo la mod ha pubblicato.

### Dove il codice e il README differiscono

- Il README dice che l'orologio legge lo stato "every 15 minutes, and whenever you open the app or the tile" (ogni 15 minuti, e ogni volta che apri l'app o il tile). Aprire l'app aggiorna sempre. Il tile mette in coda un aggiornamento solo quando l'ultimo controllo risale a più di 15 minuti prima.
- La sezione Settings del README mostra `--es topic narsil-... --es key ...` insieme. Il codice prende la chiave come facoltativa: ometti `--es key` e la chiave salvata resta; passala vuota e la chiave viene tolta. Il README non lo dice.
- La sezione Development del README elenca i comandi di test e di build ma non la CI. Il workflow esegue esattamente quei due task.

## Per andare oltre

- Leggi `presentation/`, `sync/` e `.github/workflows/ci.yml` in [narsil-watch](https://github.com/davshn/narsil-watch).
- Gestisci anche `onNewIntent`, così la configurazione via `adb` funziona mentre l'app è aperta.
- Valida il topic nella schermata di configurazione. I topic della mod sono `narsil-` seguito da 20 caratteri esadecimali, come li crea `newTopic` in `hooks/phone.ts` di narsil-pet.
- Aggiungi un test per gli extra di configurazione con un repository finto, o spostali in una funzione pura che restituisca cosa salvare.
- Il lato della mod del topic e della chiave: [Avvisi sul telefono e sull'orologio](/it/mods/pet/phone-and-watch/). L'intero percorso dall'inizio: [Cos'è Narsil Watch](/it/watch/what-it-is/), [Leggere lo stato di Narsil](/it/watch/reading-the-state/), [Il tile](/it/watch/tile/) e [La complicazione](/it/watch/complication/).
