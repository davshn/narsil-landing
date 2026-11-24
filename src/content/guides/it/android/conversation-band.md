---
title: La banda sopra la casella dei messaggi
description: "La striscia sopra la casella in cui scrivi nell'app: stato, contesto, cache e ultimo evento da claude.ai stesso, e Narsil al suo stadio dallo stato della mod che segue StateFeed."
route: android
order: 3
updated: 2026-11-24
sources:
  - repo: android
    path: app/src/main/assets/page/content.js
  - repo: android
    path: app/src/main/assets/page/lib/live.js
  - repo: android
    path: app/src/main/assets/page/lib/watch.js
  - repo: android
    path: app/src/main/assets/page/lib/restore.js
  - repo: android
    path: app/src/main/assets/page/band.css
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/StateFeed.kt
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/StateModel.kt
---

## Cosa fa

Quando apri una conversazione nell'app (un indirizzo come `claude.ai/code/session_…`), compare una striscia appena sopra la casella in cui scrivi. Da sinistra a destra e dall'alto in basso mostra:

- **Narsil**, al suo stadio attuale e nella posa dello stato della conversazione.
- **Lo stato**, come un'etichetta colorata: `TRABAJANDO` (al lavoro, blu), `TE NECESITA` (ha bisogno di te, ambra), `TERMINADA` (finita, verde) o `EN REPOSO` (a riposo, grigio). Il bordo sinistro della banda prende lo stesso colore.
- **Il contesto**, come `Contexto 42 %`: quanta parte della sua finestra ha usato la conversazione, in verde, ambra o rosso.
- **La cache**, come `🧊 38 min`: i minuti che mancano prima che scada la cache del prompt, finché non diventa `🧊 fría` (fredda).
- **L'ultimo evento**: l'ultima cosa che ha detto Claude, o `Usando Bash` (sta usando Bash) quando Claude sta solo eseguendo uno strumento, con quanto tempo fa, come `hace 3 min` (3 min fa).

Il testo occupa due righe. Un tocco sulla banda lo apre per intero, e un altro tocco lo chiude. La banda spinge la conversazione in su invece di coprirla, e si aggiorna ogni 10 secondi mentre l'app è in primo piano.

> **Sperimentale.** La banda legge gli stessi dati che la pagina di `claude.ai` carica per sé, da indirizzi interni che non sono un'API pubblica, e trova la casella dei messaggi tramite un attributo nel markup della pagina. Un aggiornamento di Claude può romperla; quando succede, la banda semplicemente smette di comparire e Claude continua a funzionare. Legge soltanto: invia richieste `GET` a `claude.ai` con la tua sessione e non scrive mai nel tuo account.

Quasi tutto ciò che c'è nella banda arriva da `claude.ai` stesso, quindi funziona nel momento in cui apri una conversazione, anche con il computer spento. Solo due dettagli dipendono dalla mod di Narsil: il suo stadio nell'immagine, e quanto dura la cache. Questi arrivano da `<il tuo topic>-estado`, che l'app segue in Kotlin.

## Come funziona dentro

La banda è disegnata da `assets/page/content.js`. Ciò che ricava dai dati vive in `assets/page/lib/live.js`, un modulo senza codice DOM. L'osservatore della pagina è `lib/watch.js`, gli stili sono in `band.css`, e lo stato della mod arriva alla pagina da `StateFeed.kt` e `StateModel.kt` attraverso il canale che descrive la [guida 2](/it/android/webview-host/).

Questi script sono stati scritti prima per l'estensione del browser precedente, e la maggior parte del loro codice è rimasta uguale. Nell'app girano nel mondo JavaScript della pagina stessa invece che in quello separato di un'estensione: `addDocumentStartJavaScript` li mette accanto al codice di `claude.ai`. Questo cambia un dettaglio più sotto, il `fetch` che usano, e niente di ciò che mostrano.

### Da dove arrivano i dati: due fonti

| Valore nella banda              | Fonte                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| Stato                           | `claude.ai`: lo `status_bucket` della conversazione                                   |
| Contesto                        | `claude.ai`: `context_usage` nei metadati della conversazione                         |
| Ultimo evento e la sua ora      | `claude.ai`: gli eventi più recenti della conversazione                               |
| Conto alla rovescia della cache | `claude.ai` per quando Claude ha parlato per ultimo; la mod per quanto dura una cache |
| Posa di Narsil                  | `claude.ai`: la sceglie lo stato                                                      |
| Stadio di Narsil                | La mod: la cartella dell'immagine nel suo ultimo stato                                |

### Le richieste della pagina stessa

La banda non legge la conversazione dallo schermo. Fa a `claude.ai` le stesse domande che fa la pagina, con la tua sessione, e legge le risposte come JSON. Ogni 10 secondi partono insieme due richieste:

- **L'elenco delle tue conversazioni**, attive e in pausa, fino a 50: `/v1/code/sessions?statuses=active&statuses=paused&limit=50`. La banda prende quella che hai aperta, trovata tramite l'id nell'indirizzo della pagina (`/code/session_…`). L'indirizzo e l'elenco possono nominare la stessa conversazione con prefissi diversi (`session_x` e `cse_x`, dice il codice), quindi gli id vengono confrontati senza di essi.
- **Gli ultimi 60 eventi di quella conversazione**, dal più recente: `/v1/code/sessions/<id>/events?limit=60&sort_order=desc`.

Il commento sopra di esse in `lib/live.js` è il motivo per cui questo percorso è sperimentale: "These addresses are not a public API and may change." (questi indirizzi non sono un'API pubblica e possono cambiare.)

`content.js` le invia con `credentials: 'include'` e un'intestazione `anthropic-version: 2023-06-01`. Nell'estensione precedente preferiva il `content.fetch` di Firefox, che fa richieste "as the page itself, with its session" (come la pagina stessa, con la sua sessione), con le parole del codice. Una WebView non ha un oggetto `content`, quindi il codice ripiega su `fetch`, e dato che lo script gira nel mondo della pagina, quello è il `fetch` della pagina stessa, con i cookie della pagina. La tua sessione non lascia mai `claude.ai`, e le risposte restano nella pagina.

### Di cosa è fatto ogni valore

`liveOf` in `lib/live.js` trasforma la conversazione e i suoi eventi in ciò che mostra la banda. Questo estratto è da `lib/live.js` in narsil-android (MIT):

<!-- prettier-ignore -->
```js
  const STATES = {
    working: { label: 'TRABAJANDO', color: '#3B8BFF' },
    blocked: { label: 'TE NECESITA', color: '#F5B400' },
    completed: { label: 'TERMINADA', color: '#22B573' },
  }
  const AT_REST = { label: 'EN REPOSO', color: '#8A90A6' }
```

| Valore        | Fatto da                                                                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Stato         | `status_bucket`: `working`, `blocked` o `completed`; qualsiasi altra cosa è `EN REPOSO`.                                                 |
| Contesto      | `external_metadata.context_usage`: `used_tokens` su `max_tokens`, arrotondato a una percentuale.                                         |
| Ultimo evento | L'evento più recente di Claude (`assistant`) con del testo; se ha solo una chiamata a uno strumento, `Usando` e il nome dello strumento. |
| Quando        | L'ora di quell'evento, come `ahora mismo` (proprio ora), `hace 5 min`, `hace 2 h` o `hace 1 d`.                                          |
| Cache         | L'evento più recente di Claude, più quanto dura una cache (sotto).                                                                       |

Due regole mantengono utile l'ultimo evento. Il solo ragionamento non dice niente, quindi un evento senza testo e senza chiamata a uno strumento viene saltato. E contano solo gli eventi di Claude: una conversazione ne ha di molti altri tipi.

Il contesto e la cache condividono una stessa colorazione, da `levelColor` in `lib/state.js`: verde sotto il 60 %, ambra dal 60 %, rosso dall'85 %. Per la cache, la percentuale è quanta parte del suo tempo è passata.

### Perché la cache è una stima

`claude.ai` non dice quando scade la cache di una conversazione, quindi la banda la stima: **l'ora dell'ultimo evento di Claude più quanto dura una cache**. Da `lib/live.js` (MIT):

<!-- prettier-ignore -->
```js
  // From the model's last message: the session's last event may be anything,
  // and opening the page makes some of its own.
  function cacheOf(events, cacheMinutes, now) {
    const last = events.find((e) => e.event_type === 'assistant')
    if (!last) return null
    const left = Math.max(0, Math.ceil((secondsOf(last) + cacheMinutes * 60 - now) / 60))
    return { text: left > 0 ? `🧊 ${left} min` : '🧊 fría', color: self.narsilState.levelColor(100 - (left / cacheMinutes) * 100) }
  }
```

Il punto di partenza è l'ultimo evento di Claude, non l'ultimo evento della conversazione, perché, come dice il commento, aprire la pagina crea eventi propri, e il conto alla rovescia ricomincerebbe ogni volta che guardi.

Quanto dura una cache lo sa la mod: `cacheMinutesOf` prende `cacheMinutes` dall'ultimo stato della mod ([L'orologio della cache](/it/mods/pet/cache-clock/) spiega come decide la mod). Senza uno stato, presume 60 minuti, "an hour on a plan" (un'ora con un abbonamento), con le parole del codice. Quindi leggi `🧊 38 min` come "circa 38 minuti": la cache in realtà parte dalla richiesta, non dalla risposta, e senza la mod una cache di 5 minuti compare come di 60.

### L'immagine di Narsil: la posa dalla pagina, lo stadio dalla mod

La posa segue lo stato: `trabajando` (al lavoro), `necesita` (ha bisogno di te), `terminado` (finito), o `parada` (in piedi) a riposo. Il suo stadio non è qualcosa che `claude.ai` conosce. Arriva dallo stato della mod, il cui campo `art` contiene l'indirizzo della sua immagine. Da `lib/live.js` (MIT):

<!-- prettier-ignore -->
```js
  // Her stage is the mod's to know: it comes in the art of its last state,
  // with the first stage at the root and each later one in its folder.
  function petOf(bucket, sentArt, isLight) {
    if (typeof sentArt !== 'string' || !sentArt.startsWith(ART)) return null
    const stage = /^etapa\d+\//.exec(sentArt.slice(ART.length))?.[0] ?? ''
    return `${ART}${stage}${POSES[bucket] ?? 'parada'}-${isLight ? 'claro' : 'oscuro'}.png`
  }
```

`ART` è `https://raw.githubusercontent.com/davshn/narsil-pet/main/assets/`. Dell'indirizzo della mod la banda tiene solo la cartella dello stadio (`etapa4/`, per esempio), ci mette la posa di questa conversazione, e sceglie `-claro` (chiaro) o `-oscuro` (scuro) in base alla modalità della pagina. Un indirizzo che arriva da qualsiasi altra parte viene rifiutato, così uno stato falsificato non può far caricare alla banda un'immagine da un altro sito.

Quando non c'è uno stato dalla mod, o un'immagine non si carica, la banda mostra al suo posto l'icona dell'app, servita da `https://claude.ai/__narsil__/page/icons/icon-192.png`. Un'immagine che non si è caricata non viene richiesta di nuovo.

### Da `<topic>-estado` alla pagina: `StateFeed` e `StateModel`

Nell'estensione, a leggere ntfy.sh era uno script di background. Nell'app lo fa Kotlin, e solo mentre una pagina mostra la banda. Quando `content.js` apre la sua porta, `host.js` invia `connect`, e `MainActivity` chiama `StateFeed.start()`. Da `StateFeed.kt` in narsil-android (MIT):

```kotlin
    @Synchronized
    fun start() {
        stop()
        val mine = run
        val topic = settings.topic
        if (topic == null) {
            post(JSONObject().put("type", "no-topic").toString())
            return
        }
        val key = settings.key
        model = settings.model(topic) ?: StateModel.empty()
        send()
        stream = NtfyStream(NtfyStream.topicUrl("$topic-estado"), "12h") { raw ->
            synchronized(this) {
                if (mine != run) return@synchronized
                model = StateModel.receive(model, raw, key)
                settings.saveModel(topic, model)
                send()
            }
        }.also { it.start() }
    }
```

Passo per passo:

1. **Niente topic, niente flusso.** La pagina riceve `{ type: 'no-topic' }`, e il blocco nel menu laterale ti chiede di toccare e scriverne uno.
2. **L'ultimo stato conosciuto, subito.** L'app conserva nelle sue impostazioni l'ultimo modello della banda per ogni topic, così una pagina che si apre più tardi mostra Narsil immediatamente, prima che risponda ntfy.sh.
3. **Poi lo stream**, `https://ntfy.sh/<topic>-estado/json?since=12h`: prima ciò che ntfy.sh ha conservato delle ultime 12 ore, poi ogni nuovo stato man mano che arriva. `NtfyStream` è la stessa classe che usano gli avvisi; la [guida 6](/it/android/alerts-service/) spiega le sue riconnessioni.
4. **Ogni messaggio** passa per `StateModel.receive`, viene salvato, e viene inviato alla pagina come `{ type: 'model', model }`.

Il contatore `run` protegge da una corsa: se la pagina si disconnette e si riconnette mentre un messaggio è in viaggio, il messaggio del vecchio stream viene scartato. Quando la pagina è nascosta, la banda chiude la sua porta, `host.js` invia `disconnect`, e lo stream si ferma. Da ntfy.sh non si legge niente mentre non stai guardando Claude.

`StateModel.receive` tiene solo lo stato più recente. Da `StateModel.kt` (MIT):

```kotlin
    fun receive(model: JSONObject, raw: JSONObject, key: String?): JSONObject {
        if (raw.optString("event") != "message") return model
        val m = Seal.unseal(key, raw)
        if (m.optBoolean("sealed")) return JSONObject(model.toString()).put("isSealed", true)
        val state = try {
            JSONObject(m.optString("message"))
        } catch (_: JSONException) {
            return model
        }
        val kept = model.optJSONObject("state")?.optDouble("at", 0.0) ?: 0.0
        if (kept > state.optDouble("at", 0.0)) return model
        return JSONObject().put("state", state).put("isSealed", false)
    }
```

I keepalive e gli altri eventi vengono ignorati. Un messaggio sigillato si apre con la chiave; se non si apre, il modello viene segnato `isSealed` e tiene lo stato che aveva. Un messaggio che non è un oggetto JSON viene ignorato. E uno stato più vecchio di quello conservato (secondo il suo campo `at`, in secondi) perde, così rigiocare 12 ore a ogni connessione non fa mai tornare indietro la banda. `StateModelTest.kt` controlla ognuno di questi casi. La [guida 7](/it/android/encryption-and-settings/) spiega cosa significa l'avviso del lucchetto.

### Ogni 10 secondi, solo mentre guardi

`content.js` chiede nuovi dati ogni 10 secondi, e per niente mentre la pagina è nascosta: un'altra app davanti, lo schermo spento, o le impostazioni dell'app aperte. Quando la pagina torna visibile, chiede subito, dall'evento [`visibilitychange`](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event), e riapre la sua porta, il che fa partire un `StateFeed` nuovo con il topic e la chiave attuali. Ecco perché una chiave che hai appena scritto nelle impostazioni ha effetto appena torni. Tra una richiesta e l'altra la banda si ridisegna ogni 15 secondi, così il conto alla rovescia e il tempo `hace` continuano a muoversi. Se una richiesta fallisce, ciò che sapeva per ultimo resta fino alla successiva.

### Nel flusso della pagina, così non copre niente

La banda non è uno strato fluttuante. È un elemento normale, `#narsil-event`, inserito appena prima della casella dei messaggi, che si trova tramite l'attributo `[data-cds=ChatComposer]` che la pagina le mette. Dato che fa parte del layout della pagina stessa, la conversazione sopra semplicemente finisce un po' più in alto.

`band.css` fa partire ogni parte di Narsil con `all: initial`, così non ci filtra dentro nessuno stile di `claude.ai`, e imposta i propri colori come variabili, con una serie chiara sotto `html[data-mode="light"]`. Annulla anche una regola della skin di Narsil stessa: la [guida 5](/it/android/colors-and-mode/) mette in grassetto tutto il testo di Claude, e la banda rimette i propri pesi con `!important`. Il testo è limitato a due righe con [`line-clamp`](https://developer.mozilla.org/en-US/docs/Web/CSS/line-clamp); un tocco alterna `narsil-open`, che lo lascia scorrere dentro al massimo il 40 % dell'altezza dello schermo (`40dvh`). Tutto il testo entra con `textContent`, mai come HTML.

### Seguire la pagina mentre cambia

`claude.ai` è un'app a pagina singola: aprire un'altra conversazione cambia l'indirizzo e il contenuto senza caricare una nuova pagina, e la pagina a volte ricostruisce la casella dei messaggi. Quindi la banda non può essere posizionata una volta sola.

`lib/watch.js` contiene l'unico [`MutationObserver`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) di tutti gli script di Narsil, che osserva l'intero documento. Mentre Claude scrive, la pagina cambia molte volte per frame, quindi esegue le sue callback al massimo una volta per frame, con [`requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame). A ogni esecuzione, la banda controlla due cose:

- **È ancora appena sopra la casella dei messaggi?** Se no, ci torna.
- **È ancora la stessa conversazione?** Confronta l'id nell'indirizzo con quello di cui ha chiesto per ultimo. Quando cambia, i vecchi dati vengono scartati, la banda scompare, e i nuovi dati vengono richiesti subito.

Scrive un valore solo quando è cambiato, dato che ogni sua scrittura è un cambiamento in più per l'osservatore.

Due parti di questi script sono residui dell'estensione che nell'app fanno poco. L'osservatore si ferma da solo quando la sua estensione se ne va, controllando `browser.runtime.id`; `host.js` risponde sempre `'narsil-android'`, quindi nell'app non si ferma mai per quel motivo. E `lib/restore.js` esisteva per rimettere a posto script e stili dopo che Vivaldi su Android li perdeva. Nell'app ne gira solo una parte: `missingStyles`, che controlla i segni `--narsil-css-skin` e `--narsil-css-band` che ogni foglio di stile imposta su `:root`. Se ne manca uno, `content.js` invia `narsil-missing`, e `host.js` adotta di nuovo il foglio di stile.

### Toccare la banda, e toccare Narsil

Un tocco sulla banda apre o chiude soltanto il suo testo. Il tocco che apre le impostazioni dell'app è su Narsil nel blocco del menu laterale, `#narsil-band .narsil-head` in `host.js`; lo mostra la [guida 4](/it/android/sidebar/). I nomi possono ingannare: nel codice, `narsil-band` è il blocco del menu laterale, e questa banda è `narsil-event`.

## Costruiscila con Claude

Chiedi a Claude le due metà insieme: uno script di pagina che disegni una banda sopra la casella dei messaggi dai dati di `claude.ai` stesso, e un flusso Kotlin che le invii lo stato della mod attraverso il canale della WebView. L'unica idea che deve fare bene è che la pagina legge soltanto, solo mentre guardi, e che lo stato che le arriva è il più recente, già aperto.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> La mia app Android ospita `https://claude.ai` in una WebView ed esegue uno script di pagina all'inizio del documento, con un canale `myHost` verso Kotlin. Nello script di pagina, disegna una striscia appena prima di `[data-cds=ChatComposer]`, come suo fratello precedente. Prendi l'id della conversazione da `location.pathname` (`/code/session_…`). Ogni 10 secondi, e solo mentre `document.hidden` è false, fai `GET` dell'elenco delle conversazioni e dei suoi ultimi 60 eventi con `fetch` e `credentials: 'include'`. Mostra lo stato da `status_bucket`, la percentuale di contesto, l'ultimo testo scritto da Claude e quanto tempo fa, e un conto alla rovescia della cache dall'ora dell'ultimo evento di Claude più un numero di minuti che invia l'app. Usa un solo `MutationObserver` limitato con `requestAnimationFrame`. Scrivi il testo solo con `textContent`. In Kotlin, quando la pagina dice `connect`, segui `https://ntfy.sh/<topic>-estado/json?since=12h` su un thread in background, tieni solo il messaggio con l'`at` più alto, salvalo e invialo alla pagina; fermati su `disconnect`. Tieni le regole in moduli puri e testale.

### Cosa controllare nella risposta di Claude

1. La banda è inserita appena prima della casella dei messaggi, non come uno strato `position: fixed`.
2. Le richieste sono solo `GET`, con `credentials: 'include'`, e non ne parte nessuna mentre `document.hidden` è true.
3. Il conto alla rovescia della cache parte dall'ultimo evento di Claude, non dall'ultimo evento della conversazione.
4. Il lato Kotlin tiene il più recente di due stati secondo `at`, così rigiocare le ultime 12 ore non fa mai tornare indietro la banda.
5. L'indirizzo di un'immagine è accettato solo da un prefisso fisso, e se ne prende solo la cartella dello stadio.
6. Il flusso si ferma quando la pagina si disconnette o una nuova pagina inizia a caricarsi, e un messaggio in ritardo di un vecchio stream viene scartato.

Se un controllo fallisce, di' a Claude cosa vedi: "dopo che cambio conversazione, la banda mostra per qualche secondo il testo di quella vecchia".

### Come l'ha chiesta l'autore

Le parole del proprietario per questa app sono registrate in `odd/tasks/android-app.md`. L1 chiedeva una web view che "muestre la web de claude y modifique sus estilos como lo hace esta extension" (mostri la web di Claude e ne modifichi gli stili come fa questa estensione), e L3 che gli stili fossero quelli dell'estensione stessa. Così la banda non è stata ridisegnata per l'app: la richiesta era portare con sé la banda dell'estensione senza cambiarla.

Il log dei task registra anche come è stata controllata su un telefono reale, con l'accesso fatto: "With a state published to the throwaway topic's -estado, the sidebar band showed level, XP, ntfy's count and Narsil's art from raw.githubusercontent.com (the page's CSP lets it load), and the strip above the composer showed TRABAJANDO, context, cache and her pose." (con uno stato pubblicato sul -estado del topic usa e getta, la banda del menu laterale ha mostrato livello, XP, il conteggio di ntfy e l'immagine di Narsil da raw.githubusercontent.com, che la CSP della pagina lascia caricare, e la striscia sopra la casella ha mostrato TRABAJANDO, contesto, cache e la sua posa.)

Il resto è ricostruito dalla cronologia dei commit (il nome di un progetto in un oggetto è sostituito da una descrizione tra parentesi quadre):

- `3bcea35` (2026-11-24) "feat: build the script that hosts [l'estensione precedente] in a WebView, and what alerts and states keep" (costruisce lo script che ospita l'estensione precedente in una WebView, e ciò che conservano avvisi e stati). Arrivano `StateModel` e gli script di pagina.
- `53c55c1` (2026-11-24) "feat: host claude.ai with [l'estensione precedente] in a WebView, and show Narsil's alerts from a foreground service" (ospita claude.ai con l'estensione precedente in una WebView, e mostra gli avvisi di Narsil da un servizio in primo piano). Il suo messaggio: "The band's state follows <topic>-estado while the band shows" (lo stato della banda segue <topic>-estado mentre la banda è visibile).
- `ca01cc7` (2026-11-24) "docs: log the band verified with a signed-in session" (registra la banda verificata con una sessione con accesso fatto).
- `5ad4577` (2026-11-24) "refactor: make the band's scripts the app's own, and stop naming the projects it replaces" (rende gli script della banda propri dell'app, e smette di nominare i progetti che sostituisce).

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida (MIT). Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

Le regole della banda come modulo puro, senza DOM, nella forma di `lib/live.js`. Prende la conversazione, i suoi eventi (dal più recente) e la durata della cache, e restituisce cosa mostrare.

```js
const STATES = {
  working: { label: 'TRABAJANDO', color: '#3B8BFF' },
  blocked: { label: 'TE NECESITA', color: '#F5B400' },
  completed: { label: 'TERMINADA', color: '#22B573' },
}
const AT_REST = { label: 'EN REPOSO', color: '#8A90A6' }

const secondsOf = (event) => Date.parse(event.created_at) / 1000

export function stripOf(session, events, cacheMinutes, now) {
  const said = events.find((event) => event.event_type === 'assistant')
  const blocks = Array.isArray(said?.payload?.message?.content) ? said.payload.message.content : []
  const words = blocks
    .filter((block) => block.type === 'text' && block.text?.trim())
    .map((block) => block.text.trim())
    .join('\n')
  const tool = blocks.filter((block) => block.type === 'tool_use').pop()
  const left = said
    ? Math.max(0, Math.ceil((secondsOf(said) + cacheMinutes * 60 - now) / 60))
    : null
  return {
    ...(STATES[session.status_bucket] ?? AT_REST),
    text: words || (tool ? `Usando ${tool.name}` : ''),
    cache: left === null ? '' : left > 0 ? `🧊 ${left} min` : '🧊 fría',
  }
}
```

È più semplice di quello vero di proposito: legge solo l'evento più recente di Claude, mentre `lastSaid` in `lib/live.js` torna indietro oltre gli eventi che contengono solo ragionamento. Salvalo come `strip.js`. Un test con `node --test`, scritto anch'esso per questa guida:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { stripOf } from './strip.js'

const at = (iso, content) => ({
  event_type: 'assistant',
  created_at: iso,
  payload: { message: { content } },
})

test('a tool call alone says what Claude is using', () => {
  const now = Date.parse('2026-11-24T10:10:00Z') / 1000
  const events = [at('2026-11-24T10:00:00Z', [{ type: 'tool_use', name: 'Bash' }])]
  const strip = stripOf({ status_bucket: 'working' }, events, 60, now)
  assert.equal(strip.label, 'TRABAJANDO')
  assert.equal(strip.text, 'Usando Bash')
  assert.equal(strip.cache, '🧊 50 min')
})

test('an hour and a minute later the cache is cold', () => {
  const now = Date.parse('2026-11-24T11:01:00Z') / 1000
  const events = [at('2026-11-24T10:00:00Z', [{ type: 'text', text: 'Listo.' }])]
  assert.equal(stripOf({ status_bucket: 'completed' }, events, 60, now).cache, '🧊 fría')
})
```

## Errori comuni e come testarlo

- **Un osservatore per ogni funzionalità.** Diversi osservatori su una pagina che cambia molte volte per frame si sommano. Usane uno, ed esegui il suo lavoro al massimo una volta per frame.
- **Scrivere a ogni esecuzione.** Impostare `textContent` o spostare la banda quando niente è cambiato risveglia di nuovo l'osservatore. Confronta prima.
- **Una banda fluttuante.** Una banda `position: fixed` copre le ultime righe della conversazione e i pulsanti che Claude mostra lì.
- **Richieste mentre è nascosta.** Un telefono con lo schermo spento continuerebbe a chiedere ogni 10 secondi. Controlla `document.hidden`.
- **La cache dall'ultimo evento.** Aprire la pagina crea eventi, quindi contare dall'ultimo azzera il conto alla rovescia ogni volta che guardi.
- **L'ultimo stato arrivato, non il più recente.** Ogni connessione rigioca 12 ore, dal più vecchio, sopra uno stato salvato che può essere più recente. Confronta `at`.
- **Testo come HTML.** I messaggi di Claude, e qualsiasi cosa su un topic di ntfy.sh, possono contenere qualsiasi cosa. Usa `textContent`.
- **Aspettarsi la banda nella home di Claude.** Compare solo nella pagina di una conversazione, con la casella dei messaggi presente.

Per testare le regole sul computer, tienile in moduli senza DOM, come fa `lib/live.js`, e dagli eventi inventati, come nel codice di riferimento. Dal lato Kotlin, `./gradlew testDebugUnitTest` esegue `StateModelTest`, che controlla che uno stato venga conservato, che vinca il più recente di due, che i keepalive e i messaggi non JSON vengano ignorati, e che uno stato sigillato che la chiave non apre venga segnato.

Sul telefono, pubblica dal computer uno stato inventato su un topic di prova che hai messo nelle impostazioni:

```bash
curl -d '{"xp":"⭐ Nivel 3 · 40/300 XP","art":"https://raw.githubusercontent.com/davshn/narsil-pet/main/assets/etapa3/parada-oscuro.png","at":1795000000,"cacheMinutes":5}' https://ntfy.sh/narsil-0000000000example0-estado
```

Apri una conversazione: entro un secondo la Narsil della banda dovrebbe mostrare lo stadio 3 nella posa della conversazione, e la cache dovrebbe contare alla rovescia da 5 minuti dopo l'ultima risposta di Claude. Poi cambia conversazione, ruota il telefono e spegni e riaccendi lo schermo: la banda dovrebbe restare sopra la casella dei messaggi, cambiare con la conversazione, e aggiornarsi entro 10 secondi dal ritorno.

### Dove il codice e il README differiscono

- I commenti in `band.css` e `lib/state.js` descrivono ancora l'estensione: "A stylesheet of the manifest's, not a `<style>` the script adds" (un foglio di stile del manifest, non uno `<style>` che aggiunge lo script) e "the background page loads it after seal.js" (la pagina di background lo carica dopo seal.js). Nell'app non c'è un manifest, né una pagina di background, né `seal.js`: il foglio di stile entra come foglio costruito da `host.js`, ed è Kotlin ad aprire gli stati sigillati. Il codice si comporta come descrive questa guida; sono solo quei commenti a essere superati.

## Per andare oltre

- La [guida 4](/it/android/sidebar/) parla del blocco nel menu laterale, dove un tocco su Narsil apre le impostazioni.
- La [guida 6](/it/android/alerts-service/) spiega `NtfyStream`, la classe che qui segue `-estado` e il tuo topic per gli avvisi.
- Dentro Claude Code, Narsil mostra gli stessi stati con regole sue: vedi [L'orologio della cache](/it/mods/pet/cache-clock/) e [Avvisi sul telefono e sull'orologio](/it/mods/pet/phone-and-watch/) per i campi di `-estado`.
- Lo stesso stato arriva anche a un orologio: [Narsil Watch](/it/watch/what-it-is/).
- Il codice sorgente è su [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
