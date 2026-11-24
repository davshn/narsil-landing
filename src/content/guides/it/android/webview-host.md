---
title: L'host della WebView
description: "Come MainActivity ospita claude.ai: le impostazioni della WebView, la sessione conservata, file e microfono, dove vanno i link, e come PageScript e host.js eseguono Narsil all'inizio di ogni pagina."
route: android
order: 2
updated: 2026-11-24
sources:
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/MainActivity.kt
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/PageScript.kt
  - repo: android
    path: app/src/main/assets/host.js
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/Links.kt
  - repo: android
    path: app/src/test/java/io/github/davshn/narsil/PageScriptTest.kt
  - repo: android
    path: app/src/main/AndroidManifest.xml
---

## Cosa fa

L'host è tutto ciò che fa l'app perché `claude.ai` giri al suo interno con Narsil sopra. Vive soprattutto in un file, `MainActivity.kt`, con due aiutanti: `PageScript.kt`, che costruisce lo script che gira all'inizio di ogni pagina, e `assets/host.js`, la parte di quello script che fa la parte del browser per gli script di pagina di Narsil.

Da fuori, noti solo i risultati:

- Claude si apre su `claude.ai/code`, a schermo intero, tra le barre di sistema e sopra la tastiera.
- Accedi una volta sola, e la sessione sopravvive quando Android chiude l'app.
- Il pulsante **+** apre il selettore di file del telefono, e la dettatura può usare il microfono.
- `claude.ai` resta nell'app. Qualsiasi altro link si apre nel tuo browser, e gli accessi di Google e di Apple mostrano invece un messaggio.
- Il pulsante Indietro torna indietro in Claude, e dalla prima pagina di Claude manda l'app in background.
- I colori e la banda di Narsil sono su ogni pagina di `claude.ai` fin dal primissimo istante.

> **Sperimentale.** L'host esegue gli script di Narsil dentro una pagina che non controlla. Dipendono dalla struttura di `claude.ai` e dalle sue richieste interne, non da un'API pubblica, quindi un aggiornamento di Claude può romperli. L'host è costruito in modo che, quando succede, Claude continui a funzionare: ogni script gira per conto suo, e un errore in uno viene scritto nel log e lascia girare gli altri.

## Come funziona dentro

### Le impostazioni della WebView

`onCreate` costruisce la WebView nel codice, dentro un `FrameLayout`, e imposta ciò che serve a `claude.ai`. Questo estratto è da `MainActivity.kt` in narsil-android (MIT):

```kotlin
        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            // A page's popups (Google's sign-in button opens one) reach onCreateWindow, which decides where they go.
            setSupportMultipleWindows(true)
            javaScriptCanOpenWindowsAutomatically = true
        }
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(web, true)
        }
```

In una WebView JavaScript e DOM storage sono spenti per impostazione predefinita, e `claude.ai` è un'app JavaScript che tiene lo stato nello storage, quindi si accendono entrambi. I contenuti multimediali possono partire senza un tocco. I popup sono consentiti, ma solo perché l'app possa intercettarli (vedi sotto). I cookie sono accettati, anche quelli di terze parti; il codice non dice quale pagina ne ha bisogno.

Altre due righe contano per lo schermo. Android 15 disegna le app da bordo a bordo, sotto la barra di stato, la barra di navigazione e la tastiera. L'activity chiama `enableEdgeToEdge()` e poi aggiunge al suo riquadro un margine pari alle barre di sistema e alla tastiera (`WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime()`), così la pagina sta tra di esse. Il manifest elenca anche ogni cambio di configurazione che l'app gestisce da sé (`orientation|screenSize|...|uiMode|density`), così ruotare il telefono non ricostruisce l'activity e non ricarica Claude.

### Accedere una volta sola: il flush del cookie

La tua sessione con `claude.ai` è un cookie. Il `CookieManager` della WebView tiene i cookie in memoria e li scrive su disco quando decide lui. Se Android chiude l'app prima, la sessione va persa e devi accedere di nuovo. Così l'app li scrive da sé ogni volta che va in background:

```kotlin
    // The session's cookie reaches the disk now, not when Android gets to it: a killed app keeps its sign-in.
    override fun onPause() {
        CookieManager.getInstance().flush()
        web.onPause()
        super.onPause()
    }
```

`onPause` gira ogni volta che l'app smette di stare in primo piano: cambi app, blocchi il telefono o apri le impostazioni. È l'ultimo momento in cui l'app è sicura di girare prima che Android possa chiuderla. La specifica S3 chiedeva esattamente questo: "login once and the session stays (cookies flushed to disk)" (accesso una volta sola e la sessione resta, con i cookie scritti su disco).

### Dove va ogni link

Ogni navigazione che la pagina chiede arriva a `shouldOverrideUrlLoading`, che interroga `Links.isInApp` (la [guida 1](/it/android/what-it-is/) cita `Links.kt` per intero). Restituire `false` lascia che la WebView la carichi; restituire `true` la ferma, e `goOut` decide cosa succede invece:

- **Gli accessi di Google e di Apple** (`accounts.google.com`, `appleid.apple.com`): non si apre niente, e un toast lungo dice di accedere con un'email.
- **Qualsiasi altra cosa**: `ACTION_VIEW` di Android con la categoria `BROWSABLE`, che apre il tuo browser o l'app che gestisce l'indirizzo. Se non lo gestisce niente, l'app scrive nel log "Nothing opens" (non si apre niente) e l'indirizzo.

I popup hanno bisogno di una strada propria. Il pulsante di Google ne apre uno, e una WebView che non ha una finestra da dargli lo scarta, ed è per questo che l'accesso restava appeso. Ora `onCreateWindow` dà alla pagina una WebView usa e getta che non si mostra mai. Il suo unico compito è sentire il primo indirizzo che il popup vuole: un indirizzo di `claude.ai` si carica nella WebView principale, qualsiasi altro va a `goOut`, e la WebView usa e getta viene distrutta. Con le parole del codice, "The popup's opener sees it closed." (chi ha aperto il popup lo vede chiuso.)

Gli indirizzi arrivano anche da fuori: il tocco su un avviso, o un link di `claude.ai` che Android passa all'app. Entrambi arrivano come `Intent`, all'avvio o in `onNewIntent`, dato che l'activity è `singleTask` e ne esiste una sola copia. `claudeIn(intent)` tiene l'indirizzo solo quando `Links.isClaude` lo accetta, così un'altra app non può far caricare a questa una pagina che non sia Claude.

### I file e il microfono

Quando la pagina chiede un file, la WebView chiama `onShowFileChooser`. L'app apre il selettore di documenti di Android (`ActivityResultContracts.OpenMultipleDocuments`) con i tipi che la pagina accetta, o `*/*` quando non ne indica nessuno, e restituisce alla pagina gli indirizzi scelti. A una richiesta ancora in attesa si risponde prima con `null`, così la pagina non aspetta mai un selettore che non c'è più.

Il microfono è l'unico dispositivo che la pagina può usare:

```kotlin
        // The microphone, for dictating to Claude; nothing else the page may ask for.
        override fun onPermissionRequest(request: PermissionRequest) {
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE !in request.resources || !Links.isClaude(request.origin.toString())) {
                request.deny()
                return
            }
            if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                request.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
            } else {
                microphone = request
                askMicrophone.launch(Manifest.permission.RECORD_AUDIO)
            }
        }
```

Sono in gioco due permessi. La pagina chiede alla WebView, e la WebView chiede all'app (`onPermissionRequest`). L'app stessa ha bisogno di `RECORD_AUDIO` di Android, che concedi una volta, la prima. Una richiesta che arriva da qualcosa che non sia `https://claude.ai`, o per qualcosa che non sia l'audio, viene negata, e anche una richiesta di audio e video riceve solo l'audio.

### Come si presenta l'app

Ogni richiesta che una WebView invia porta il suo user agent, un testo che nomina il motore e, su Android, lo segna come WebView con `; wv`. Alcuni accessi e controlli anti-bot respingono le WebView proprio per quel segno.

La cronologia mostra che l'autore ha provato entrambe le strade. Il commit `bfa379a` "fix: present the WebView as Chrome, and let a debug build's page be inspected" (presenta la WebView come Chrome, e permette di ispezionare la pagina di una build di debug) ha tolto `; wv` e `Version/4.0` dallo user agent, con il commento "As Chrome on Android" (come Chrome su Android). Sette minuti dopo, `38cb33c` l'ha annullato: "The user agent is the WebView's own again: the app does not pass itself off as Chrome to get past a sign-in's check." (lo user agent è di nuovo quello della WebView: l'app non si spaccia per Chrome per superare il controllo di un accesso.) Oggi il codice non tocca affatto `userAgentString`, e la sezione Security del README dice: "The app pretends nothing: Claude, Google, and Cloudflare see it as the Android app it is." (l'app non finge niente: Claude, Google e Cloudflare la vedono come l'app Android che è.) È anche il motivo per cui non si forza l'accesso di Google a funzionare: la risposta onesta è il messaggio sull'email.

### Guardare dentro: ispezione di debug e logcat

La pagina di una WebView si può ispezionare dai DevTools di Chrome su un desktop solo se l'app lo consente. L'app lo consente solo per le build di debug:

```kotlin
        // A debug build's page can be inspected from a computer, at chrome://inspect.
        if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) WebView.setWebContentsDebuggingEnabled(true)
```

`./gradlew installDebug` installa una build di debug, quindi con il telefono collegato via USB, `chrome://inspect` sul computer elenca la pagina. Le prove del log dei task sono state raccolte così: "through DevTools the page has narsilHostLoaded, a live narsilWatch, both style marks and the night ground rgb(15, 26, 44)" (tramite i DevTools la pagina ha narsilHostLoaded, un narsilWatch attivo, entrambi i segni di stile e lo sfondo notturno rgb(15, 26, 44)). Ricorda cosa significa: chi ha il tuo telefono sbloccato su un computer con il debug USB consentito può vedere la tua pagina di Claude.

Anche la console della pagina arriva al log di Android: `onConsoleMessage` scrive ogni messaggio in logcat con il tag `NarsilWeb`, con il suo livello, file e riga. `adb logcat -s NarsilWeb` li mostra, compresi gli errori `narsil: <file>` descritti più sotto.

### PageScript: un solo script, in ordine

Gli script della banda sono stati scritti come content script di un'estensione, che un browser esegue a gruppi e in un ordine fisso. Una WebView non ha niente del genere: accetta uno script per registrazione. Così `PageScript.build` cuce tutto in un solo script, nell'ordine che gli script si aspettano. Da `PageScript.kt` in narsil-android (MIT):

```kotlin
object PageScript {
    private val STYLES = listOf("page/skin.css", "page/band.css")
    private val AT_START = listOf("page/lib/watch.js", "page/lib/mode.js", "page/mode.js")
    private val AT_IDLE = listOf("page/lib/restore.js", "page/lib/state.js", "page/lib/live.js", "page/content.js")

    fun build(read: (String) -> String): String {
        val css = STYLES.joinToString("\n") { read(it) }
        fun run(path: String) = "run(${jsString(path)}, function () {\n${read(path)}\n})\n"
        return buildString {
            append("(() => {\n")
            append("if (window.top !== window || self.narsilHostLoaded || !self.narsilHost) return\n")
            append("self.narsilHostLoaded = true\n")
            append("const run = (name, code) => { try { code() } catch (error) { console.error('narsil: ' + name, error) } }\n")
            append("const NARSIL_CSS = ${jsString(css)}\n")
            append(read("host.js")).append('\n')
            AT_START.forEach { append(run(it)) }
            append("self.narsilWatch(adopt)\n")
            append("const idle = () => {\n")
            AT_IDLE.forEach { append(run(it)) }
            append("}\n")
            append("if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', idle, { once: true })\n")
            append("else idle()\n")
            append("})()\n")
        }
    }
```

Leggilo dall'alto in basso, come lo esegue la pagina:

1. **Una guardia.** Esce subito in un frame che non è la finestra principale, se lo script è già girato in questo documento, o se manca il canale dell'app (`narsilHost`).
2. **`run`**, un involucro che cattura qualsiasi errore, lo scrive nel log come `narsil: <file>`, e va avanti. Ogni file gira dentro una sua funzione, così un file rotto non può fermare gli altri.
3. **`NARSIL_CSS`**, entrambi i fogli di stile uniti in una sola stringa JavaScript.
4. **`host.js`**, che costruisce il foglio di stile, lo mette sulla pagina e definisce `browser` (vedi sotto).
5. **Il primo gruppo, subito**: l'osservatore della pagina (`lib/watch.js`) e la modalità chiara o scura (`lib/mode.js`, `mode.js`). Devono agire prima che la pagina si disegni, come spiega la [guida 5](/it/android/colors-and-mode/).
6. **`self.narsilWatch(adopt)`**: a ogni cambiamento che vede l'osservatore, rimette il foglio di stile se la pagina l'ha tolto.
7. **Il secondo gruppo, una volta analizzato il documento**: gli script della banda. Se il documento si sta ancora caricando, aspettano `DOMContentLoaded`, più o meno quando girerebbe il gruppo `document_idle` di un'estensione: il markup della pagina c'è già da trovare.

`jsString` trasforma un file in un letterale stringa JavaScript facendo l'escape di barre rovesciate, virgolette, a capo, e dei due caratteri U+2028 e U+2029, che il JavaScript più vecchio trattava come a capo dentro le stringhe. `read` è una funzione passata come argomento, così i test possono costruire lo script da file finti. `PageScriptTest.kt` controlla che ogni file ci sia e sia in ordine, che il secondo gruppo aspetti il documento, che entrambi gli stili entrino come un'unica stringa tra virgolette, e che la guardia ci sia.

### All'inizio del documento, solo su `claude.ai`, solo nel frame principale

`MainActivity.host()` registra lo script e il canale. Da `MainActivity.kt` (MIT):

```kotlin
    private fun host() {
        val origins = setOf(ORIGIN)
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) ||
            !WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)
        ) {
            Log.w(TAG, "This WebView cannot run the band: update Android System WebView")
            return
        }
        WebViewCompat.addWebMessageListener(web, "narsilHost", origins) { _, message, origin, isMainFrame, proxy ->
            if (!isMainFrame || origin.toString() != ORIGIN) return@addWebMessageListener
            val m = try {
                JSONObject(message.data ?: return@addWebMessageListener)
            } catch (_: Exception) {
                return@addWebMessageListener
            }
            when (m.optString("kind")) {
                "connect" -> {
                    reply = proxy
                    feed.start()
                }
                "disconnect" -> if (reply === proxy) {
                    reply = null
                    feed.stop()
                }
                "port" -> if (m.optJSONObject("message")?.optString("type") == "settings") openSettings()
                "settings" -> openSettings()
            }
        }
        val script = PageScript.build { path -> assets.open(path).bufferedReader().use { it.readText() } }
        WebViewCompat.addDocumentStartJavaScript(web, script, origins)
    }
```

Entrambe le chiamate vengono da `androidx.webkit` e prendono la stessa regola di origine, `https://claude.ai`:

- **`addDocumentStartJavaScript`** esegue lo script in ogni documento corrispondente prima di qualsiasi script della pagina stessa, ed è ciò che permette ai colori di vincere fin dal primo fotogramma.
- **`addWebMessageListener`** mette un oggetto chiamato `narsilHost` nei frame corrispondenti. La pagina chiama `narsilHost.postMessage(text)`; l'app riceve il testo, l'origine, se è arrivato dal frame principale, e un proxy di risposta su cui rispondere.

I controlli sono a strati. La WebView stessa non dà né lo script né `narsilHost` a nessun'altra origine. La guardia dello script esce da qualsiasi frame che non sia la finestra principale. E il listener scarta un messaggio che non arriva dal frame principale di `https://claude.ai`, o che non è JSON. Il README lo riassume: "The band's scripts and the channel to the app run only on `https://claude.ai`, in the page itself and not in its frames." (gli script della banda e il canale verso l'app girano solo su `https://claude.ai`, nella pagina stessa e non nei suoi frame.)

Quando una nuova pagina inizia a caricarsi (`onPageStarted`), l'app dimentica il suo proxy di risposta e ferma il flusso di stato, dato che la vecchia pagina non c'è più.

### Servire i file di Narsil da `claude.ai/__narsil__/`

La banda mostra l'icona dell'app quando non ha un'immagine di Narsil. Una pagina non può caricare direttamente un file dagli asset dell'app, e la Content Security Policy di `claude.ai` limita da dove possono arrivare le immagini. L'app usa `WebViewAssetLoader` per rispondere alle richieste per `https://claude.ai/__narsil__/` con i propri asset:

```kotlin
        private val files = WebViewAssetLoader.Builder()
            .setDomain("claude.ai")
            .addPathHandler("/__narsil__/", WebViewAssetLoader.AssetsPathHandler(this@MainActivity))
            .build()
```

La richiesta non arriva mai alla rete: `shouldInterceptRequest` risponde con l'asset. Per la pagina, il file arriva dalla sua stessa origine, "where the page's own policy lets them load" (dove la policy della pagina stessa ne permette il caricamento), come dice il commento della classe. Tutto il resto sotto `claude.ai` passa senza essere toccato.

### `host.js`: un browser per gli script di pagina

Gli script di pagina di Narsil sono stati scritti per un'estensione. Chiamano `browser.runtime.getURL`, aprono una porta con `browser.runtime.connect`, inviano `browser.runtime.sendMessage`, e controllano `browser.runtime.id` per sapere se la loro estensione è ancora viva. `host.js` dà loro un oggetto `browser` con esattamente quelle parti, e risponde a ciascuna:

| Gli script chiamano            | `host.js` risponde                                                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `runtime.id`                   | Sempre `'narsil-android'`, così gli script non si credono mai orfani.                                                             |
| `runtime.getURL(path)`         | `https://claude.ai/__narsil__/page/` più il percorso.                                                                             |
| `runtime.getManifest()`        | Solo ciò che gli script ne leggono: un gruppo i cui stili sono `skin.css` e `band.css`.                                           |
| `runtime.connect({ name })`    | Una porta. Invia `connect` all'app; i messaggi dell'app arrivano sul suo `onMessage`; `postMessage` invia `port`.                 |
| `runtime.sendMessage(message)` | Per `narsil-missing` (gli script si sono accorti che gli stili sono spariti), rimette il foglio di stile. Risponde sempre `true`. |
| `runtime.onMessage`            | Un elenco di listener che l'app non chiama mai; gli script ci si registrano, e non succede altro.                                 |

Gli stili entrano come foglio di stile costruito: `host.js` crea un `CSSStyleSheet`, lo riempie con `replaceSync(NARSIL_CSS)` e lo aggiunge a `document.adoptedStyleSheets`. Il commento del file dà il motivo: i fogli di stile costruiti sono quelli "which the page's CSP does not govern" (che la CSP della pagina non governa), mentre un elemento `<style>` aggiunto da uno script potrebbe essere rifiutato. A volte la pagina sostituisce i propri fogli adottati, quindi `adopt()` controlla e rimette quello di Narsil a ogni cambiamento che vede l'osservatore.

`host.js` aggiunge una cosa che a un'estensione non serviva. L'app non ha un menu del browser da cui raggiungere le sue impostazioni, quindi un tocco in qualsiasi punto dell'immagine o del livello di Narsil nel blocco del menu laterale (`#narsil-band .narsil-head`) invia `{ kind: 'settings' }`. Ascolta nella fase di cattura, così il tocco viene visto prima che la pagina possa fermarlo.

### Il canale, messaggio per messaggio

Tutti i messaggi sono testo JSON.

| Direzione    | Messaggio                   | Cosa succede                                                                                     |
| ------------ | --------------------------- | ------------------------------------------------------------------------------------------------ |
| Pagina → app | `{ kind: 'connect', name }` | L'app tiene questo proxy di risposta e inizia a seguire `<topic>-estado`.                        |
| Pagina → app | `{ kind: 'disconnect' }`    | Se è il proxy attuale, l'app smette di seguirlo.                                                 |
| Pagina → app | `{ kind: 'port', message }` | Fa qualcosa solo `message.type === 'settings'`: apre le impostazioni.                            |
| Pagina → app | `{ kind: 'settings' }`      | Apre le impostazioni.                                                                            |
| App → pagina | `{ type: 'model', model }`  | Lo stato più recente che la banda dovrebbe mostrare ([guida 3](/it/android/conversation-band/)). |
| App → pagina | `{ type: 'no-topic' }`      | Non c'è ancora un topic: il blocco ti chiede di toccare e scriverne uno.                         |

La banda invia anche `{ type: 'awake' }` sulla sua porta ogni 25 secondi, un'abitudine dell'estensione, dove teneva sveglio un worker di background addormentato. L'app lo ignora.

### Il ponte come confine di sicurezza

Un canale tra una pagina web e il codice nativo è una porta, e la domanda è sempre cosa può passarci. Qui, molto poco:

- **Verso l'app, la pagina può fare tre cose**: chiedere di iniziare a seguire lo stato, chiedere di smettere, e aprire la schermata delle impostazioni. Qualsiasi altro messaggio viene ignorato. Nessun messaggio porta un URL da aprire, un file da leggere o un valore da salvare.
- **Dall'app, la pagina riceve solo lo stato già aperto**: il JSON che la mod ha inviato a `-estado`, dopo la decifratura. Il topic e la chiave restano in Kotlin. Fanno parte dell'indirizzo e della decifratura che l'app fa da sé, e non vengono mai inviati.
- **Qualsiasi script nel frame principale di `claude.ai` può usare `narsilHost`**, compreso il codice di `claude.ai` stesso, dato che condivide la pagina con gli script di Narsil. Il peggio che può fare è leggere lo stesso stato che mostra la banda e aprire le impostazioni.

Conta anche la direzione opposta. Ciò che arriva da ntfy.sh potrebbe averlo scritto chiunque conosca il tuo topic, quindi gli script di pagina lo trattano come non affidabile: il testo entra con `textContent`, e un'immagine solo dalla cartella di Narsil su GitHub.

## Costruiscila con Claude

Chiedi prima a Claude un host minimo: una WebView che esegua uno script all'inizio del documento su un'origine, con un canale di messaggi attraverso cui lo script possa parlare. Poi fallo crescere. L'unica idea che deve fare bene è che lo script e il canale esistano solo su `https://claude.ai`, solo nel frame principale, e che l'app lo controlli di nuovo a ogni messaggio.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nella mia app Android (Kotlin, `androidx.webkit` 1.18), l'activity principale mostra `https://claude.ai/code` in una WebView. Se `WebViewFeature` supporta `WEB_MESSAGE_LISTENER` e `DOCUMENT_START_SCRIPT`, registra un web message listener chiamato `myHost` e uno script di inizio documento, entrambi solo per la regola di origine `https://claude.ai`. Costruisci lo script in un oggetto Kotlin puro a partire da file degli asset: una guardia che esce a meno che `window.top === window`, `self.myHost` esista e lo script non sia già girato; ogni file avvolto nel proprio `try/catch` che scriva nel log il nome del file; il CSS unito in un solo letterale stringa con escape. Nel listener, scarta tutto ciò che non arriva dal frame principale di `https://claude.ai` o che non è JSON, e agisci solo su un elenco fisso di valori di `kind`. Servi `https://claude.ai/__mine__/` dagli asset con `WebViewAssetLoader`. Non inviare mai nessuna impostazione alla pagina. Aggiungi test JUnit per l'ordine e l'escape del costruttore dello script.

### Cosa controllare nella risposta di Claude

1. Sia `addWebMessageListener` sia `addDocumentStartJavaScript` ricevono lo stesso insieme ristretto di origini, non `"*"`.
2. Il listener controlla da sé `isMainFrame` e l'origine, anche se la regola di origine filtra già.
3. La prima riga dello script esce negli iframe e alla seconda esecuzione.
4. Ogni file gira nel proprio `try/catch`, così un errore non ferma gli altri.
5. L'escape della stringa gestisce `\`, `"`, `\n`, `\r`, U+2028 e U+2029, e un test lo dimostra.
6. C'è un controllo delle funzionalità con una riga di log chiara, e Claude si carica comunque quando fallisce.

Se un controllo fallisce, di' a Claude cosa vedi: "lo script gira due volte dentro il frame di Cloudflare".

### Come l'ha chiesta l'autore

Le parole del proprietario sono registrate nel log dei task, `odd/tasks/android-app.md`. La prima, L1, chiedeva una web view che "muestre la web de claude y modifique sus estilos como lo hace esta extension" (mostri la web di Claude e ne modifichi gli stili come fa questa estensione). L3 aggiungeva: "recuerda que los estilos que va a inyectar seran los de la extension […]" (ricorda che gli stili che inietterà saranno quelli dell'estensione; il nome del progetto precedente qui è omesso). La specifica S2 dell'agente trasforma tutto questo nel design di questa guida: "the extension's content scripts and CSS run unchanged inside the WebView, with a `browser` shim the app answers natively." (i content script e il CSS dell'estensione girano senza modifiche dentro la WebView, con uno shim `browser` a cui l'app risponde in modo nativo.)

Il resto è ricostruito dalla cronologia dei commit (il nome di un progetto in un oggetto è sostituito da una descrizione tra parentesi quadre):

- `3bcea35` (2026-11-24) "feat: build the script that hosts [l'estensione precedente] in a WebView, and what alerts and states keep" (costruisce lo script che ospita l'estensione precedente in una WebView, e ciò che conservano avvisi e stati). Il suo messaggio: "host.js answers the extension's browser calls; the styles go on as a constructed style sheet." (host.js risponde alle chiamate browser dell'estensione; gli stili entrano come foglio di stile costruito.)
- `53c55c1` (2026-11-24) "feat: host claude.ai with [l'estensione precedente] in a WebView, and show Narsil's alerts from a foreground service" (ospita claude.ai con l'estensione precedente in una WebView, e mostra gli avvisi di Narsil da un servizio in primo piano). Nasce `MainActivity`.
- `bfa379a` (2026-11-24) "fix: present the WebView as Chrome, and let a debug build's page be inspected" (presenta la WebView come Chrome, e permette di ispezionare la pagina di una build di debug).
- `38cb33c` (2026-11-24) "fix: say to sign in with an email when Google's or Apple's sign-in is asked for, instead of hanging" (dice di accedere con un'email quando viene chiesto l'accesso di Google o di Apple, invece di restare appesa). I popup e lo user agent onesto.
- `9e514dd` (2026-11-24) "feat: open the settings from Narsil in the band and from the service's notification" (apre le impostazioni da Narsil nella banda e dalla notifica del servizio). Il suo messaggio: "The launcher shortcut is not shown by every launcher, and the band's notice only shows without a topic." (la scorciatoia del launcher non viene mostrata da tutti i launcher, e l'avviso della banda compare solo senza un topic.)
- `5ad4577` (2026-11-24) "refactor: make the band's scripts the app's own, and stop naming the projects it replaces" (rende gli script della banda propri dell'app, e smette di nominare i progetti che sostituisce). `assets/extension` è diventato `assets/page` e `ExtensionScript` è diventato `PageScript`, seguendo la L4 del proprietario.

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida (MIT). Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

Un host minimo con la stessa forma di `MainActivity`: un'origine, uno script di inizio documento, un canale e una regola per i link. Riusa `Links` dell'app.

```kotlin
package io.github.davshn.narsil

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

class TinyHostActivity : ComponentActivity() {
    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val web = WebView(this)
        setContentView(web)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        val origins = setOf("https://claude.ai")
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) &&
            WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)
        ) {
            WebViewCompat.addWebMessageListener(web, "myHost", origins) { _, message, origin, isMainFrame, reply ->
                if (!isMainFrame || origin.toString() != "https://claude.ai") return@addWebMessageListener
                if (message.data == "hello") reply.postMessage("hi from the app")
            }
            WebViewCompat.addDocumentStartJavaScript(web, SCRIPT, origins)
        }
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (Links.isInApp(request.url.toString())) return false
                startActivity(Intent(Intent.ACTION_VIEW, request.url).addCategory(Intent.CATEGORY_BROWSABLE))
                return true
            }
        }
        web.loadUrl(Links.CLAUDE_CODE)
    }

    override fun onPause() {
        CookieManager.getInstance().flush()
        super.onPause()
    }

    private companion object {
        const val SCRIPT = """
            if (window.top === window && self.myHost && !self.myHostLoaded) {
              self.myHostLoaded = true
              myHost.addEventListener('message', (event) => {
                document.documentElement.dataset.myHost = event.data
              })
              myHost.postMessage('hello')
            }
        """
    }
}
```

Dichiara l'activity nel manifest come launcher, poi apri la pagina in `chrome://inspect` (con `WebView.setWebContentsDebuggingEnabled(true)` in una build di debug) e guarda l'elemento `<html>`: dovrebbe portare `data-my-host="hi from the app"`. Carica qualsiasi altro sito nella stessa WebView e lì `self.myHost` è `undefined`. `startActivity` lancia `ActivityNotFoundException` quando nessuna app può aprire un indirizzo; il vero `goOut` la cattura, e anche il tuo dovrebbe farlo prima di pubblicarlo.

## Errori comuni e come testarlo

- **`"*"` come regola di origine.** Il canale e lo script arriverebbero a ogni pagina e a ogni frame che la WebView carica, pubblicità e pagine di accesso comprese. Nomina l'unica origine.
- **Fidarsi solo della regola di origine.** Anche i frame della stessa origine ricevono l'oggetto. Controlla `isMainFrame` nel listener.
- **Un solo `try` intorno a tutto.** Un singolo errore, per esempio nella banda dopo un aggiornamento di Claude, butterebbe giù anche i colori. Avvolgi ogni file.
- **Dimenticare `flush()`.** La sessione funziona finché Android non chiude l'app in background, e poi devi accedere di nuovo.
- **Popup ignorati.** Con `setSupportMultipleWindows(false)`, un pulsante di accesso che apre un popup non fa proprio niente. Intercettalo in `onCreateWindow`.
- **Falsificare lo user agent.** Può superare un controllo oggi e fallire domani, e nasconde cos'è l'app. L'app ci ha rinunciato in `38cb33c`.
- **Inviare un'impostazione alla pagina.** Qualsiasi script della pagina potrebbe allora leggerla. Tieni il topic e la chiave dal lato Kotlin.
- **Concedere ogni richiesta di permesso.** Concedi solo il microfono, e solo a `claude.ai`.

Per testarlo sul telefono, installa una build di debug, apri `chrome://inspect` sul computer, e nella console della pagina controlla `self.narsilHostLoaded` (dovrebbe essere `true`), `typeof narsilHost` (`object`) e `document.adoptedStyleSheets.length` (almeno uno). In un iframe della pagina, `self.narsilHostLoaded` dovrebbe essere `undefined`. Poi `adb logcat -s NarsilWeb` mostra la console della pagina; una riga che inizia con `narsil:` nomina uno script che ha lanciato un errore.

Per testare il costruttore dello script senza telefono, esegui `./gradlew testDebugUnitTest`: `PageScriptTest` costruisce lo script da file finti e controlla l'ordine, il gruppo che aspetta, le virgolette e la guardia.

### Dove il codice e il README differiscono

- Il README dice "A debug build's page can be inspected from a computer at `chrome://inspect`; its console goes to logcat with the `NarsilWeb` tag." (la pagina di una build di debug si può ispezionare da un computer su `chrome://inspect`; la sua console va in logcat con il tag `NarsilWeb`.) Nel codice l'ispezione è limitata alle build di debug; la console no: `onConsoleMessage` scrive in logcat in qualsiasi build. Dato che l'unica installazione documentata è `installDebug`, la differenza si vede solo se costruisci tu una release.

## Per andare oltre

- La [guida 3](/it/android/conversation-band/) segue lo stato dal canale dell'app fino alla banda sopra la casella dei messaggi.
- La [guida 5](/it/android/colors-and-mode/) spiega perché il primo gruppo di script gira subito e come i colori evitano un lampo.
- La [guida 7](/it/android/encryption-and-settings/) parla delle impostazioni che apre il ponte, e del perché il topic e la chiave restano fuori dalla pagina.
- Dal lato della mod, [Avvisi sul telefono e sull'orologio](/it/mods/pet/phone-and-watch/) descrive lo stato `-estado` che porta il canale.
- Il codice sorgente è su [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
