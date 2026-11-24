---
title: Cos'è Narsil Watch
description: "L'app per Wear OS che ti porta al polso i limiti di Claude e le conversazioni aperte di Claude Code: un tile, una complicazione e un'app, senza server e senza token di Claude."
route: watch
order: 1
updated: 2026-11-24
sources:
  - repo: watch
    path: README.md
  - repo: watch
    path: app/src/main/AndroidManifest.xml
  - repo: watch
    path: app/build.gradle.kts
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/data/StatusRepository.kt
  - repo: pet
    path: hooks/phone.ts
  - repo: pet
    path: hooks/register.tsx
---

## Cosa fa

Narsil Watch è un'app per Wear OS. Ti porta al polso due cose: quanto hai consumato dei limiti di utilizzo di Claude, e come vanno le tue conversazioni aperte di Claude Code. Le mostra in tre posti:

| Superficie                      | Dove la vedi                                                                       | Cosa mostra                                                                                                                                                 |
| ------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Il tile **Narsil · Claude**     | Scorrendo di lato dal quadrante                                                    | Due anelli, il limite di 5 ore fuori e quello settimanale dentro, Narsil al centro, quante conversazioni hanno bisogno di te e quanto è vecchia la lettura. |
| La complicazione **Claude 5 h** | Su qualsiasi quadrante che ne accetti una                                          | Il limite di 5 ore, come un arco o come un testo breve tipo `62%`.                                                                                          |
| L'app, che si chiama **Narsil** | Dall'elenco delle app dell'orologio, o con un tocco sul tile o sulla complicazione | Ogni conversazione aperta con il suo stato, entrambi i limiti con quando si azzerano, e il livello di Narsil.                                               |

L'app parla spagnolo, come Narsil. Gli stati che mostra sono i suoi: `TRABAJANDO` (al lavoro), `PARADA` (ferma), `TE NECESITA` (ha bisogno di te), `TERMINADA` (finita) ed `ERROR`.

Non ha bisogno di **nessun server** né di **nessun token di Claude**. Non parla mai con Claude. Legge un piccolo stato che la mod di Narsil sul tuo computer pubblica già per il telefono, su un topic privato di [ntfy.sh](https://ntfy.sh). [Leggere lo stato di Narsil](/it/watch/reading-the-state/) spiega quello stato, e [Avvisi sul telefono e sull'orologio](/it/mods/pet/phone-and-watch/) spiega come lo invia la mod.

> **Sperimentale.** L'orologio sa solo ciò che la mod ha pubblicato per ultimo, e la mod pubblica solo quando un turno finisce (o arriva una domanda) mentre sei lontano dal computer, entro la quota giornaliera gratuita di ntfy.sh. Alla scrivania l'orologio continua a mostrare una lettura vecchia. Ne chiede una nuova al massimo ogni 15 minuti, ntfy.sh conserva un messaggio solo per un certo tempo, e l'app è una build di debug che installi tu stesso via `adb`, versione `0.1.0`. Qualsiasi cambiamento nella forma dello stato della mod può romperla.

Narsil Watch è open source con licenza GPL v3 (o qualsiasi versione successiva), su [github.com/davshn/narsil-watch](https://github.com/davshn/narsil-watch). Non è affiliata ad Anthropic.

## Come funziona dentro

### Un solo stato, tre superfici

Il codice è piccolo: dieci file Kotlin sotto `app/src/main/kotlin/tech/davshn/narsilwatch/`. Il README riassume le cartelle, e la divisione vale la pena di copiarla:

- `domain/`: lo stato così come lo pubblica Narsil (`NarsilState.kt`) e come l'orologio lo esprime a parole e a colori (`Display.kt`). Kotlin puro, niente Android.
- `data/`: la lettura del topic ntfy (`StatusRepository.kt`, `StatusParser.kt`), l'apertura del sigillo (`Seal.kt`) e la conservazione dell'ultimo stato.
- `tile/`, `complication/`, `presentation/`: le tre superfici.
- `sync/`: l'aggiornamento ogni 15 minuti con WorkManager, e i ridisegni.

Le tre superfici non interrogano mai la rete da sole mentre disegnano. Leggono tutte lo stesso ultimo stato che `StatusRepository` conserva sull'orologio, tramite `cached()`. Solo l'aggiornamento interroga ntfy.sh, e quando ha qualcosa di nuovo dice al tile e alla complicazione di ridisegnarsi. Per questo il tile compare subito, anche offline: non aspetta mai una richiesta.

Il commento in cima a `StatusRepository.kt` (GPL v3) lo dice in una riga:

```kotlin
// Where the watch keeps the topic, the key, and the last state it read, so
// the tile and the complication draw at once, offline too.
```

(Dove l'orologio conserva il topic, la chiave e l'ultimo stato che ha letto, così il tile e la complicazione si disegnano subito, anche offline.)

### Il flusso dei dati

Il README disegna l'intero percorso in una riga:

```text
Claude Code ── Narsil mod ──► ntfy.sh/<topic>-estado ──► Narsil Watch (tile, complication, app)
```

Passo dopo passo:

1. **Claude Code esegue la mod di Narsil** ([narsil-pet](https://github.com/davshn/narsil-pet)) sul tuo computer. Conosce già le tue conversazioni, i loro stati, il livello di Narsil e, dalla release 3.10.0, i limiti di 5 ore e settimanali di Claude.
2. **La mod pubblica uno stato JSON** su `https://ntfy.sh`, sul topic `<il tuo topic>-estado` ("estado" significa "stato"). Il tuo topic è quello che ha creato `/narsil movil`, un nome come `narsil-0000000000example0` (ogni topic di questo percorso è un esempio inventato).
3. **ntfy.sh conserva l'ultimo messaggio** per un certo tempo. Un commento in `hooks/register.tsx` di narsil-pet dice che "keeps a message 12 h" (conserva un messaggio 12 ore).
4. **L'orologio chiede a ntfy.sh l'ultimo messaggio** su quel topic, lo apre con la tua chiave se è sigillato, e lo conserva.
5. **Il tile, la complicazione e l'app** disegnano da ciò che ha conservato.

Niente va nella direzione opposta. La sezione Security del README è chiara: "the watch only reads the topic: it never publishes on it." (l'orologio legge soltanto il topic: non ci pubblica mai.)

### Quando pubblica la mod, e cosa significa per la freschezza

Questa è la cosa più importante da capire sull'orologio. È una finestra sull'ultimo messaggio, non un flusso in diretta.

`sendStatus` della mod, in `hooks/register.tsx`, gira quando finisce un turno della conversazione principale e quando arriva una domanda, e anche `/narsil movil prueba` ("prova") ne invia uno. Ogni volta, `postToPhone` decide se parte davvero. Dalle sue prime righe:

```ts
const { phoneTopic, isPhoneOn, phoneKey } = await read($, prefs)
if (!isPhoneOn || !phoneTopic || (!force && !(await isAway($)))) return false
const day = dayOf(await $.clock.now())
const count = countOf(await $.store.get(PHONE_KEY).catch(() => undefined), day)
if (count.sent >= PHONE_DAILY) return false
```

L'estratto viene da `hooks/register.tsx` in narsil-pet (GPL v3), con l'indentazione rimossa. A parole, lo stato parte solo quando:

- **`/narsil movil` è attivo** ed esiste un topic.
- **Sei lontano.** `isAway` legge da dove è arrivato il tuo ultimo messaggio. Se è arrivato tramite Remote Control (il telefono o il web), sei lontano; se è arrivato dal terminale o dall'app desktop, sei alla scrivania.
- **La quota del giorno non è esaurita.** `PHONE_DAILY` vale 200. Il commento in `hooks/phone.ts`: "ntfy.sh takes 250 a day for free: Narsil stops short of it." (ntfy.sh ne accetta 250 al giorno gratis: Narsil si ferma prima.) Il giorno è quello UTC, e gli avvisi e gli stati condividono gli stessi 200.

Quindi, in pratica:

- **Mentre lavori dal telefono**, parte un nuovo stato alla fine di ogni turno. L'orologio lo raccoglie al suo aggiornamento successivo.
- **Alla scrivania**, non parte niente. L'orologio tiene l'ultima lettura che aveva. È voluto: alla scrivania vedi la fascia e la finestra mobile, e inviare consumerebbe la quota giornaliera per niente. Il tile e l'app mostrano quanto è vecchia la lettura (`hace 2 h`, "2 ore fa"), così non ti inganna mai.
- **In una giornata intensa lontano dal computer**, i 200 possono esaurirsi. Dopo, non arriva niente di nuovo fino alla mezzanotte UTC.
- **Se non è stato pubblicato niente per più di circa 12 ore**, ntfy.sh potrebbe non avere più niente da dare. L'orologio mostra comunque ciò che ha conservato.

Anche i limiti invecchiano. Una cifra delle 5 ore letta a mezzogiorno non dice niente di certo sulle 17. L'app mostra quando si azzera ogni limite ([guida 5](/it/watch/app-and-refresh/)), e l'etichetta dell'età ti dice quanto è vecchio il tutto.

### Perché gli avvisi non fanno parte dell'app

Potresti aspettarti che un'app per l'orologio vibri quando Claude ha bisogno di te. Questa no, di proposito. Il README spiega: "Alerts (a question, a finished turn, an error) are not part of this app: Narsil for Android or the ntfy app on your phone already mirror them to the watch." (gli avvisi, una domanda, un turno finito, un errore, non fanno parte di questa app: Narsil per Android o l'app ntfy sul telefono li rispecchiano già sull'orologio.)

Wear OS mostra già sull'orologio le notifiche del telefono. La mod invia già i suoi avvisi al tuo topic ntfy. Così gli avvisi arrivano al polso passando per il telefono, con una di queste:

- [Narsil per Android](/it/android/what-it-is/), che li trasforma in notifiche native e apre quelli sigillati con la tua chiave, oppure
- l'app ntfy, iscritta al tuo topic. Il testo di aiuto della mod stessa dice che un orologio Wear OS "mostrará sus notificaciones si tienes activadas las de ntfy en la app del reloj" (mostrerà le sue notifiche se hai attivato quelle di ntfy nell'app dell'orologio).

Un secondo canale di avvisi dall'app dell'orologio significherebbe due vibrazioni per un solo evento, e una seconda iscrizione che tiene occupata la radio. L'app dell'orologio fa l'unica cosa che il telefono non può rispecchiare: un riepilogo di tutto, da leggere con un'occhiata.

### Cosa legge dalla rete

Secondo `AndroidManifest.xml`, l'app chiede solo due permessi, `INTERNET` e `ACCESS_NETWORK_STATE`. Si dichiara app autonoma per orologio (`com.google.android.wearable.standalone` è `true`), quindi non le serve un'app compagna sul telefono. Imposta `android:allowBackup="false"`, così il topic e la chiave che conserva non vengono copiati in un backup.

Parla solo con due posti, che la sezione Security del README elenca e il codice conferma:

- **`https://ntfy.sh`**, per lo stato.
- **`https://raw.githubusercontent.com/davshn/narsil-pet/`**, per i disegni di Narsil. `StatusRepository` rifiuta qualsiasi altro indirizzo per l'immagine (la [guida 2](/it/watch/reading-the-state/) spiega perché).

Nessun token di Claude e nessun account di Claude arrivano all'orologio.

### Installarla via adb wireless

Non c'è una scheda nello store. Costruisci l'app sul computer e la installi sull'orologio via Wi-Fi. Dal README, ti servono:

- Un orologio con **Wear OS 3 o successivo**, con le opzioni sviluppatore e il **debug wireless** attivi.
- Sul computer, **JDK 17 o successivo** e l'**Android SDK**, con `ANDROID_HOME` che punta a esso.

Associa l'orologio come spiega la sua schermata del debug wireless, poi, in una copia del repository:

```bash
adb connect 192.168.1.50:<port>
./gradlew :app:installDebug
```

L'indirizzo qui è un esempio; usa l'IP e la porta che mostra il tuo orologio. `installDebug` costruisce la variante di debug e la installa sul dispositivo collegato. Poi aggiungi il tile **Narsil · Claude** dall'editor dei tile dell'orologio, e la complicazione **Claude 5 h** dall'editor del quadrante.

Per aggiornarla, scarica l'ultima versione del repository ed esegui di nuovo lo stesso comando. Il README dice che le impostazioni vengono conservate.

La prima volta che apri l'app, mostra **Configurar** (configura): il tuo topic e, se ne usi una, la tua chiave. Puoi scriverli sull'orologio, o inviarli dal computer con un solo comando `adb`. La [guida 5](/it/watch/app-and-refresh/) mostra entrambi i modi. In Claude Code, `/narsil movil` mostra il tuo topic e `/narsil movil clave` crea la chiave.

### Il topic e la chiave: cosa permettono e come cambiarli

Sono entrambi segreti, quindi conviene essere precisi:

- **Dove vengono salvati sull'orologio.** Nello spazio privato dell'app (le `SharedPreferences` di Android chiamate `narsil`, in `MODE_PRIVATE`), come dice il README. Non in un backup, dato che i backup sono disattivati.
- **Cosa permette il topic.** Chiunque conosca il suo nome può leggere ogni messaggio che contiene, avvisi e `-estado` allo stesso modo, e può pubblicarci. L'orologio, da parte sua, legge soltanto.
- **Cosa permette la chiave.** Apre i messaggi sigillati. Senza, chi legge il topic vede rumore; con essa, lo stato completo.
- **Come ruotarli.** `/narsil movil nuevo` ("nuovo") crea un nuovo topic; quello vecchio non riceve più niente. `/narsil movil clave` crea una nuova chiave ogni volta che lo esegui, e quella vecchia non apre più ciò che viene inviato da quel momento. Dopo l'uno o l'altro, dai all'orologio il nuovo valore sotto **Configurar**.
- **Come toglierli dall'orologio.** Svuota i campi sotto **Configurar**, o disinstalla l'app.

Il README aggiunge un avvertimento chiaro: "Without a key, anyone who knows your topic's name can read it. Use `/narsil movil clave` if that matters to you." (senza una chiave, chiunque conosca il nome del tuo topic può leggerlo. Usa `/narsil movil clave` se per te è importante.)

### Sistemi supportati

Dal README e da `app/build.gradle.kts`:

| Sistema        | Supportato                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------- |
| Wear OS        | 3 o successivo. La build imposta `minSdk = 30` ("Wear OS 3 and later") e `targetSdk = 36`.     |
| Mod di Narsil  | Una versione che pubblica `limits` e `sessions` nel suo stato: la release 3.10.0 o successiva. |
| Tizen, watchOS | Non disponibile. È un'app Android.                                                             |

La build usa Java 17, Kotlin con Compose per l'app, le librerie Tiles e ProtoLayout di Wear per il tile, la libreria delle sorgenti dati per le complicazioni, e WorkManager. Le versioni stanno in `gradle/libs.versions.toml`.

Una mod più vecchia funziona ancora, in parte. `NarsilState` dà a `limits` e `sessions` dei valori predefiniti vuoti, quindi uno stato di prima della 3.10.0 viene letto senza di essi: gli anelli restano vuoti, e l'elenco dice `Sin conversaciones` (nessuna conversazione).

### Perché è sperimentale

Ogni motivo viene dal codice o dal README:

- **Dipende dal fatto che la mod pubblichi.** Senza mod, con `/narsil movil` disattivato o con una mod più vecchia, l'orologio ha poco o niente da mostrare.
- **Le letture arrivano solo mentre sei lontano.** Alla scrivania lo stato non cambia.
- **La quota giornaliera gratuita di ntfy.sh.** La mod si ferma a 200 messaggi al giorno, condivisi con gli avvisi.
- **Un aggiornamento ogni 15 minuti.** L'intervallo ripetuto più breve di WorkManager, come dice il commento in `Refresh.kt`.
- **Un servizio pubblico in mezzo.** ntfy.sh conserva i messaggi per un tempo limitato ed è un servizio di terzi.
- **Installazione manuale.** Si installa come build di debug via `adb`, versione `0.1.0`, senza store e senza aggiornamenti automatici.
- **I test coprono la logica, non le schermate.** I test unitari controllano il parser, i testi e il sigillo; niente testa il tile o la complicazione su un dispositivo.

## Costruiscila con Claude

Se vuoi una tua app per l'orologio come questa, chiedi prima a Claude lo scheletro: un progetto Wear OS con un'app, un servizio per il tile e un servizio per la complicazione, che leggono tutti un unico stato salvato. L'unica idea che deve fare bene è che le superfici leggono una copia locale e non aspettano mai la rete.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Crea un'app Wear OS 3+ in Kotlin (`minSdk = 30`, Java 17) chiamata `my-watch`, package `com.example.mywatch`. Legge un unico stato JSON dall'ultimo messaggio di un topic ntfy.sh, `https://ntfy.sh/<topic>-estado/json?poll=1&since=latest`, e non pubblica mai. Dividila in `domain/` (lo stato come data class `@Serializable` e funzioni di visualizzazione pure), `data/` (un repository che conserva il topic e l'ultima risposta grezza in `SharedPreferences` private, e un parser), `tile/` (un `TileService`), `complication/` (un `SuspendingComplicationDataSourceService` con `RANGED_VALUE` e `SHORT_TEXT`), `presentation/` (un'activity Compose for Wear OS) e `sync/` (un job WorkManager ogni 15 minuti che aggiorna e chiede al tile e alla complicazione di ridisegnarsi). Il tile e la complicazione leggono soltanto lo stato salvato. Segna l'app come autonoma, disattiva i backup e chiedi solo `INTERNET` e `ACCESS_NETWORK_STATE`. Aggiungi test JUnit per il parser e per le funzioni di visualizzazione, e un workflow di GitHub Actions che esegua `./gradlew :app:testDebugUnitTest :app:assembleDebug`.

### Cosa controllare nella risposta di Claude

1. Il tile e la complicazione leggono lo stato salvato. Nessuno dei due fa una richiesta di rete mentre disegna.
2. Il manifest dichiara il tile con `BIND_TILE_PROVIDER` e la complicazione con `BIND_COMPLICATION_PROVIDER`, i suoi `SUPPORTED_TYPES` e un `UPDATE_PERIOD_SECONDS`.
3. L'app ha `com.google.android.wearable.standalone` impostato a `true` e `allowBackup` impostato a `false`.
4. Vengono chiesti solo `INTERNET` e `ACCESS_NETWORK_STATE`.
5. Il repository conserva l'ultima risposta buona e non la sovrascrive con una vuota o illeggibile.
6. Il topic non compare mai in un log.

Se un controllo fallisce, di' a Claude cosa vedi: "il tile resta vuoto per qualche secondo quando ci arrivo scorrendo", che significa che sta aspettando la rete.

### Come l'ha chiesta l'autore

Per questa app non esistono log dei task né richieste registrate. Quella che segue è una ricostruzione dalla cronologia dei commit di entrambi i repository, non le parole dell'autore:

- narsil-pet `6400a6f` (2026-11-23) "feat(phone): publish Claude limits and open conversations for the watch" (pubblica i limiti di Claude e le conversazioni aperte per l'orologio). Il suo messaggio: "The status topic now carries the 5-hour and weekly limits (percent, color, reset) and up to 8 open conversations, so a Wear OS app can show them." (il topic di stato ora porta i limiti di 5 ore e settimanali, con percentuale, colore e azzeramento, e fino a 8 conversazioni aperte, così un'app Wear OS può mostrarli.)
- narsil-watch `b47ca7a` (2026-11-23) "feat: Narsil on Wear OS with Claude limits and open conversations" (Narsil su Wear OS con i limiti di Claude e le conversazioni aperte). L'intera app in un solo commit. Il suo messaggio: "A tile with the 5-hour and weekly limits as rings and Narsil in her current pose, a 5-hour complication, and an app listing every open conversation. It reads Narsil's state from its ntfy.sh status topic and opens it with the /narsil movil clave key when sealed." (un tile con i limiti di 5 ore e settimanali come anelli e Narsil nella sua posa attuale, una complicazione delle 5 ore e un'app che elenca ogni conversazione aperta. Legge lo stato di Narsil dal suo topic di stato su ntfy.sh e lo apre con la chiave di /narsil movil clave quando è sigillato.)
- narsil-pet `9437318` (2026-11-23) "chore(release): 3.10.0". La prima release il cui stato l'orologio può leggere per intero.
- narsil-watch `04390c8` (2026-11-24) "docs: align README with the Narsil family" (allinea il README alla famiglia Narsil). Il README guadagna la tabella degli stati, le sezioni Security e Supported systems, e Narsil per Android accanto all'app ntfy come via con cui gli avvisi arrivano all'orologio; il primo README nominava solo l'app ntfy.

L'ordine racconta la storia: prima è cambiato il lato della mod, così che lo stato portasse ciò che serve a un orologio, e poi l'orologio è stato costruito per leggerlo. Nessuno dei due lati ha avuto bisogno di un server.

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida. Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

Un manifest minimo per un'app di questa forma, scritto per questa guida e adattato da `app/src/main/AndroidManifest.xml` in [narsil-watch](https://github.com/davshn/narsil-watch) (GPL v3). I nomi delle classi appartengono al package di esempio `com.example.mywatch`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-feature android:name="android.hardware.type.watch" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:name=".MyWatchApplication"
        android:allowBackup="false"
        android:label="My watch"
        android:theme="@android:style/Theme.DeviceDefault">

        <meta-data
            android:name="com.google.android.wearable.standalone"
            android:value="true" />

        <activity
            android:name=".presentation.MainActivity"
            android:exported="true"
            android:taskAffinity="">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <service
            android:name=".tile.MyTileService"
            android:exported="true"
            android:label="My tile"
            android:permission="com.google.android.wearable.permission.BIND_TILE_PROVIDER">
            <intent-filter>
                <action android:name="androidx.wear.tiles.action.BIND_TILE_PROVIDER" />
            </intent-filter>
        </service>

        <service
            android:name=".complication.MyComplicationService"
            android:exported="true"
            android:label="My limit"
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
    </application>
</manifest>
```

Ogni riga c'è per un motivo. Lo `uses-feature` limita l'app agli orologi. I due permessi sono tutto ciò che serve per una lettura via HTTPS. I servizi del tile e della complicazione sono esportati, perché è il sistema a collegarsi a loro, e protetti dai permessi di binding, così solo il sistema può farlo. `900` secondi corrisponde all'aggiornamento ogni 15 minuti.

E i comandi per costruire, testare e installare, dal README, con un indirizzo di esempio:

```bash
./gradlew :app:testDebugUnitTest
./gradlew :app:assembleDebug
adb connect 192.168.1.50:<port>
./gradlew :app:installDebug
```

## Errori comuni e come testarlo

- **Aspettarsi dati in diretta alla scrivania.** La mod pubblica solo mentre sei lontano. L'etichetta dell'età è la risposta onesta; leggila prima dei numeri.
- **Disattivare `/narsil movil`.** Ferma gli stati oltre agli avvisi. L'orologio tiene la sua ultima lettura, che invecchia.
- **Una mod vecchia.** Prima della 3.10.0 non ci sono `limits` né `sessions`. Gli anelli restano vuoti e l'elenco dice `Sin conversaciones`.
- **Il topic `-estado` nell'app degli avvisi.** Iscrivi l'app ntfy al tuo topic semplice, non a `-estado`. Il topic di stato è un dato, inviato con priorità 1, e il commento della mod dice che è "not followed by push" (non seguito tramite push).
- **Aspettare avvisi dall'app dell'orologio.** Arrivano tramite il telefono. Controlla prima che l'app ntfy o Narsil per Android li mostri sul telefono.
- **Niente opzioni sviluppatore.** Sull'orologio, le opzioni sviluppatore devono essere attive prima che compaia il debug wireless.

Per testare l'intero percorso da un capo all'altro:

1. In Claude Code, esegui `/narsil movil`, annota il topic e inseriscilo sull'orologio sotto **Configurar**.
2. Esegui `/narsil movil prueba`. Invia un avviso di prova e, quando quello parte, uno stato, anche dalla scrivania.
3. Apri l'app sull'orologio. Si aggiorna all'apertura. L'età dovrebbe dire `ahora` (adesso).
4. Scorri fino al tile. Mostra la stessa lettura, con gli anelli pieni se la mod ha letto i limiti di Claude.

### Dove il codice e il README differiscono

- Il README dice che l'orologio legge l'ultimo messaggio "every 15 minutes, and whenever you open the app or the tile" (ogni 15 minuti, e ogni volta che apri l'app o il tile). L'app si aggiorna davvero ogni volta che si apre. Il tile, invece, chiede un aggiornamento solo quando l'ultimo controllo risale a più di 15 minuti prima, e disegna prima lo stato conservato ([guida 3](/it/watch/tile/)).
- Il README dice che Narsil pubblica lo stato "when a turn ends while you are away" (quando un turno finisce mentre sei lontano). Il codice della mod lo pubblica anche con ogni domanda, e con `/narsil movil prueba`, che parte anche dalla scrivania.
- Il README di narsil-pet elenca ancora cinque campi per `-estado`. Il suo codice ne invia sette dalla 3.10.0, compresi `limits` e `sessions` ([guida 2](/it/watch/reading-the-state/)).

## Per andare oltre

- Leggi il codice sorgente su [github.com/davshn/narsil-watch](https://github.com/davshn/narsil-watch).
- [Avvisi sul telefono e sull'orologio](/it/mods/pet/phone-and-watch/) copre il lato della mod: il topic, il conteggio giornaliero e la chiave.
- [Narsil per Android](/it/android/what-it-is/) è l'app per il telefono che rispecchia gli avvisi sull'orologio.
- La prossima guida di questo percorso: [Leggere lo stato di Narsil](/it/watch/reading-the-state/), come l'orologio recupera, apre e conserva lo stato.
- Poi [il tile](/it/watch/tile/), [la complicazione](/it/watch/complication/) e [l'app e il suo aggiornamento](/it/watch/app-and-refresh/).
