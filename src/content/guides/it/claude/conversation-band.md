---
title: La banda sopra la casella dei messaggi
description: "La banda che Narsil in Claude disegna sopra la casella dei messaggi di claude.ai: la sua posa, lo stato, il contesto, la cache e l'ultimo evento, letti dai dati della pagina."
route: claude
order: 2
updated: 2026-11-18
---

## Cosa fa

Quando apri una conversazione su `claude.ai/code`, compare una banda appena sopra la casella in cui scrivi. Da sinistra a destra e dall'alto in basso mostra:

- **Narsil**, al suo stadio attuale e nella posa dello stato della conversazione.
- **Lo stato**, come un'etichetta colorata: `TRABAJANDO` (al lavoro, blu), `TE NECESITA` (ha bisogno di te, ambra), `TERMINADA` (finita, verde) o `EN REPOSO` (a riposo, grigio). Il bordo sinistro della banda prende lo stesso colore.
- **Il contesto**, come `Contexto 42 %`: quanta parte della sua finestra ha usato la conversazione, in verde, ambra o rosso.
- **La cache**, come `🧊 38 min`: i minuti che mancano prima che scada la cache del prompt, finché non diventa `🧊 fría` ("fredda").
- **L'ultimo evento**: l'ultima cosa che ha detto Claude, o `Usando Bash` ("sta usando Bash") quando Claude sta solo eseguendo uno strumento, con quanto tempo fa, come `hace 3 min`.

Il testo occupa due righe. Un tocco lo apre per intero e un altro tocco lo chiude. La banda spinge la conversazione in su invece di coprirla, e si aggiorna ogni 10 secondi mentre lo schermo è visibile.

> **Sperimentale.** La banda legge gli stessi dati che la pagina di `claude.ai` carica per sé, da indirizzi interni che non sono un'API pubblica, e trova la casella dei messaggi tramite la struttura della pagina. Un aggiornamento di Claude può romperla; quando succede, la banda semplicemente smette di comparire. Legge soltanto, e non invia mai i tuoi dati da nessuna parte.

Tutto ciò che c'è nella banda arriva da `claude.ai` stesso, quindi non ha bisogno di nessun messaggio dal tuo computer. Solo due dettagli dipendono dalla [mod narsil-pet](https://github.com/davshn/narsil-pet): lo stadio di Narsil nell'immagine, e quanto dura la cache.

## Come funziona dentro

La banda è disegnata dal content script `extension/content.js`. Ciò che ricava dai dati vive in `extension/lib/live.js`, un modulo senza codice DOM, che permette di testare le regole da sole.

### Da dove arrivano i dati: le richieste della pagina stessa

La banda non legge la conversazione dallo schermo. Fa a `claude.ai` le stesse domande che fa la pagina, con la tua sessione, e legge le risposte come JSON. Partono insieme due richieste:

- **L'elenco delle tue conversazioni**, attive e in pausa, fino a 50 (`/v1/code/sessions` su `claude.ai`). La banda prende quella che hai aperta, trovata tramite l'id nell'indirizzo della pagina (`/code/session_…`). L'indirizzo e l'elenco possono nominare la stessa conversazione con prefissi diversi, quindi gli id vengono confrontati senza di essi.
- **Gli ultimi 60 eventi di quella conversazione**, dal più recente (`/v1/code/sessions/<id>/events`).

Questi sono indirizzi interni di `claude.ai`. Il codice lo dice sopra di essi: "These addresses are not a public API and may change." (questi indirizzi non sono un'API pubblica e possono cambiare.) Sono il motivo principale per cui l'estensione è sperimentale.

Per inviare le richieste "come la pagina stessa, con la sua sessione", il content script usa `content.fetch` di Firefox quando esiste. MDN spiega che in Firefox, con Manifest V2, `content.fetch()` fa "requests that behave as if they were sent by the content itself" (richieste che si comportano come se fossero inviate dal contenuto stesso); in Manifest V3 non è disponibile, e il `fetch` di un content script gira già nel contesto della pagina ([MDN: Content scripts, XHR and Fetch](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts#xhr_and_fetch)). Così l'estensione di Firefox usa `content.fetch` e il pacchetto Chromium per Vivaldi ripiega su `fetch`. Entrambi inviano i tuoi cookie (`credentials: 'include'`), quindi `claude.ai` risponde come risponde alla pagina. Sono solo richieste `GET`, e le risposte restano nella pagina.

### Di cosa è fatto ogni valore

`liveOf` in `lib/live.js` trasforma la conversazione e i suoi eventi in ciò che mostra la banda:

| Valore        | Fatto da                                                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Stato         | Lo `status_bucket` della conversazione: `working`, `blocked` o `completed`; qualsiasi altra cosa è `EN REPOSO`.                   |
| Contesto      | `context_usage` nei metadati della conversazione: token usati sul massimo della finestra, arrotondati a una percentuale.          |
| Ultimo evento | Il messaggio più recente di Claude che ha del testo; se ha solo una chiamata a uno strumento, `Usando` e il nome dello strumento. |
| Quando        | L'ora di quel messaggio, come `ahora mismo`, `hace 5 min`, `hace 2 h` o `hace 1 d`.                                               |
| Cache         | Quello stesso messaggio più recente di Claude, più quanto dura la cache (sotto).                                                  |

Due regole mantengono utile l'ultimo evento. Il solo ragionamento non dice niente, quindi un messaggio senza testo e senza strumento viene saltato. E contano solo i messaggi di Claude: la conversazione ha molti altri tipi di eventi.

Il contesto e la cache condividono una stessa colorazione: verde sotto il 60 %, ambra dal 60 %, rosso dall'85 %, le stesse soglie che usano i limiti del menu laterale. Per la cache, la percentuale è quanta parte del suo tempo è passata.

### L'immagine di Narsil: la posa dalla pagina, lo stadio dalla mod

La posa segue lo stato: al lavoro, in attesa di te, finita, o in piedi a riposo. Il suo stadio non è qualcosa che `claude.ai` conosce. Arriva dalla mod: lo stato che narsil-pet invia tramite ntfy.sh porta l'indirizzo della sua immagine, e il suo stadio è la cartella in quell'indirizzo ([Esperienza e crescita](/it/mods/pet/experience-and-growth/) spiega gli stadi). La banda ne prende lo stadio, ci mette la posa di questa conversazione, e sceglie la variante chiara o scura in base alla pagina.

Le immagini sono accettate solo dagli asset di narsil-pet su GitHub. Quando non c'è uno stato dalla mod, o un'immagine non si carica, la banda mostra al suo posto l'icona propria dell'estensione, e un'immagine che non si è caricata non viene richiesta di nuovo.

### Perché la cache è una stima

`claude.ai` non dice quando scade la cache di una conversazione, quindi la banda la stima: **l'ora dell'ultimo messaggio di Claude più quanto dura una cache**.

- **Dall'ultimo messaggio di Claude**, non dall'ultimo evento della conversazione. Il commit che ha aggiunto la banda spiega perché: "as any event moves the session's own time" (dato che qualsiasi evento sposta l'ora della sessione stessa). Il codice aggiunge che aprire la pagina crea alcuni eventi propri, che azzererebbero il conto alla rovescia ogni volta che guardi.
- **Quanto dura** lo sa la mod: narsil-pet invia `cacheMinutes` nel suo stato ([L'orologio della cache](/it/mods/pet/cache-clock/) spiega come decide tra 60 e 5 minuti). Senza quel valore, la banda presume 60 minuti.

Quindi il conto alla rovescia può sbagliare: la cache in realtà parte dalla richiesta, non dal messaggio, e senza la mod una cache di 5 minuti compare come di 60. Leggi `🧊 38 min` come "circa 38 minuti".

### Ogni 10 secondi, solo mentre guardi

La banda chiede nuovi dati ogni 10 secondi, e per niente mentre la pagina è nascosta (lo schermo spento, un'altra app o un'altra scheda davanti). Quando la pagina torna visibile, chiede subito, usando l'evento [`visibilitychange`](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event). Tra una richiesta e l'altra, si ridisegna ogni 15 secondi, così il conto alla rovescia e il tempo "hace" continuano a muoversi. Se una richiesta fallisce, ciò che sapeva per ultimo resta fino alla successiva.

### Nel flusso della pagina, così non copre niente

La banda non è uno strato fluttuante. È un elemento normale inserito appena prima della casella dei messaggi, come suo fratello precedente. La casella dei messaggi viene trovata tramite un attributo che la pagina le mette. Dato che la banda fa parte del layout della pagina stessa, la conversazione sopra semplicemente finisce un po' più in alto; niente resta nascosto dietro.

Il testo è limitato a due righe con CSS ([`line-clamp`](https://developer.mozilla.org/en-US/docs/Web/CSS/line-clamp)). Un tocco attiva una classe che toglie il limite e lascia scorrere il testo dentro un riquadro alto al massimo il 40 % dello schermo. Tutto il testo entra con `textContent`, mai come HTML.

### Seguire la pagina mentre cambia

`claude.ai` è un'app a pagina singola: aprire un'altra conversazione cambia l'indirizzo e il contenuto senza caricare una nuova pagina, e la pagina a volte ricostruisce la casella dei messaggi. Quindi la banda non può essere posizionata una volta sola.

`extension/lib/watch.js` contiene l'unico [`MutationObserver`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) dell'estensione, che osserva l'intero documento. Mentre Claude scrive, la pagina cambia molte volte per frame, quindi l'osservatore non esegue le sue callback a ogni cambiamento: le pianifica una volta per frame con [`requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame). A ogni esecuzione, la banda controlla due cose:

- **È ancora appena sopra la casella dei messaggi?** Se no, ci torna.
- **È ancora la stessa conversazione?** La banda confronta l'id nell'indirizzo con quello di cui ha chiesto per ultimo. Quando cambia, i vecchi dati vengono scartati, la banda scompare, e i nuovi dati vengono richiesti subito.

La banda scrive un valore solo quando è cambiato, dato che ogni sua scrittura è un cambiamento in più per l'osservatore. E l'osservatore si ferma, con tutto ciò che lo usava, quando l'estensione viene rimossa o ricaricata, così una copia orfana non continua a disegnare.

## Come è stata chiesta all’IA

Nessuna richiesta per la banda è stata registrata. Le parole di chi ha creato Narsil registrate per questo percorso riguardano il sito (la [guida 1](/it/mods/claude/what-it-is/) le cita). Quanto segue è ricostruito dalla cronologia dei commit dell'estensione:

- `c200e8a` (2026-11-09) "feat: show Narsil's state in claude.ai's sidebar on Firefox for Android" (mostra lo stato di Narsil nel menu laterale di claude.ai su Firefox per Android). La prima versione mostrava le conversazioni in un pannello nel menu laterale, alimentato dalla mod tramite ntfy.sh.
- `19677ac` (2026-11-09) "feat: show each conversation's state, context and cache above the prompt" (mostra lo stato, il contesto e la cache di ogni conversazione sopra il prompt). Nasce la banda. Il suo messaggio la descrive come "read from the same addresses claude.ai uses, so it needs no message from the PC" (letta dagli stessi indirizzi che usa claude.ai, quindi non ha bisogno di nessun messaggio dal PC), e spiega la regola della cache citata sopra.
- `00adbb9` (2026-11-09) "feat: show only Narsil's level, the limits and ntfy's count in the sidebar" (mostra nel menu laterale solo il livello di Narsil, i limiti e il conteggio di ntfy). Il pannello e i suoi avvisi sono stati rimossi, "as each conversation's strip covers them" (dato che la striscia di ogni conversazione li copre).
- `ce7d17e` (2026-11-11) "perf: lighten the styles and the page observers so claude.ai switches conversations faster" (alleggerisce gli stili e gli osservatori della pagina così claude.ai cambia conversazione più in fretta). L'osservatore unico, limitato a un'esecuzione per frame.
- `1d9db3d` (2026-11-11) "fix: load the page observer with the band and stop when the extension goes away" (carica l'osservatore della pagina con la banda e si ferma quando l'estensione se ne va).

La cronologia mostra un passaggio dai dati inviati dal computer ai dati che la pagina aveva già: la banda funziona nel momento in cui apri una conversazione, anche con il computer spento.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt di chi ha creato Narsil.

> Nella mia estensione di Firefox per `https://claude.ai/*`, aggiungi un content script che disegni una banda di stato appena prima della casella dei messaggi della pagina, come suo fratello precedente, così spinge la conversazione in su invece di coprirla. Trova l'id della conversazione in `location.pathname`. Ogni 10 secondi, e solo mentre `document.hidden` è false, leggi i dati della conversazione con la sessione della pagina stessa (`content.fetch` quando esiste, altrimenti `fetch`, con `credentials: 'include'`), solo `GET`. Mostra lo stato, la percentuale di contesto, l'ultimo testo scritto da Claude e quanto tempo fa, e un conto alla rovescia della cache stimato dall'ora dell'ultimo messaggio di Claude più 60 minuti. Usa un solo `MutationObserver` sul documento, limitato con `requestAnimationFrame`, per rimettere a posto la banda quando la pagina si ricostruisce e per azzerarla quando cambia la conversazione. Scrivi il testo solo con `textContent`. Limita il testo a due righe e lascia che un tocco lo espanda. Tieni le regole in un modulo senza codice DOM, e testale con `node --test`.

## Il codice minimo

Un piccolo content script della stessa forma, scritto per questa guida (MIT). `readConversation` sta per qualunque cosa legga i tuoi dati; qui restituisce l'ora dell'ultimo messaggio di Claude, in secondi. Il resto è la meccanica della banda: posizionarla, seguire la pagina, aggiornarla mentre è visibile e stimare la cache.

```js
const BOX = '[data-cds=ChatComposer]'
const CACHE_MINUTES = 60
const band = document.createElement('div')
band.id = 'my-band'
const text = document.createElement('span')
band.append(text)
band.addEventListener('click', () => band.classList.toggle('open'))

let lastSaidAt = null

function cacheLabel(saidAt, now) {
  const left = Math.ceil((saidAt + CACHE_MINUTES * 60 - now) / 60)
  return left > 0 ? `🧊 ${left} min` : '🧊 cold'
}

function draw() {
  const box = document.querySelector(BOX)
  if (!box || lastSaidAt === null) {
    band.remove()
    return
  }
  const label = cacheLabel(lastSaidAt, Date.now() / 1000)
  if (text.textContent !== label) text.textContent = label
  if (box.previousElementSibling !== band) box.before(band)
}

async function refresh() {
  if (document.hidden) return
  try {
    lastSaidAt = await readConversation(location.pathname)
  } catch {
    return
  }
  draw()
}

let queued = false
new MutationObserver(() => {
  if (queued) return
  queued = true
  requestAnimationFrame(() => {
    queued = false
    draw()
  })
}).observe(document.documentElement, { childList: true, subtree: true })

document.addEventListener('visibilitychange', refresh)
setInterval(refresh, 10_000)
refresh()
```

Il CSS per le due righe e il tocco:

```css
#my-band span {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

#my-band.open span {
  display: block;
  max-height: 40dvh;
  overflow-y: auto;
}
```

`BOX` è l'attributo che `claude.ai` mette oggi sulla sua casella dei messaggi; se Claude lo rinomina, è questa la riga che si rompe. Confrontare `box.previousElementSibling` prima di chiamare [`before()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/before) conta: spostare la banda a ogni frame sarebbe un cambiamento a sé, e l'osservatore si risveglierebbe.

## Errori comuni e come testarlo

- **Un osservatore per ogni funzionalità.** Diversi osservatori su una pagina che cambia molte volte per frame si sommano. Usane uno, ed esegui il suo lavoro al massimo una volta per frame.
- **Scrivere a ogni esecuzione.** Impostare `textContent` o spostare la banda quando niente è cambiato fa scattare di nuovo l'osservatore. Confronta prima.
- **Una banda fluttuante.** Una banda `position: fixed` copre le ultime righe della conversazione e i pulsanti che Claude mostra lì. Inseriscila nel flusso della pagina.
- **Richieste mentre è nascosta.** Un telefono con lo schermo spento continuerebbe a chiedere ogni 10 secondi. Controlla `document.hidden` e ascolta `visibilitychange`.
- **La cache dall'ultimo evento.** Aprire la pagina crea eventi, quindi contare dall'ultimo azzera il conto alla rovescia ogni volta che guardi. Conta dall'ultimo messaggio di Claude.
- **Testo come HTML.** I messaggi di Claude possono contenere qualsiasi cosa. Usa `textContent`, mai `innerHTML`.
- **Non azzerare con una nuova conversazione.** Senza confrontare l'id nell'indirizzo, la banda mostra i dati della conversazione precedente per un massimo di 10 secondi.

Per testare le regole, tienile in un modulo senza DOM, come fa `lib/live.js`, e dagli eventi inventati: un elenco in cui il messaggio più recente di Claude ha solo una chiamata a uno strumento dovrebbe dare `Usando` e il nome dello strumento, e un messaggio vecchio di 61 minuti dovrebbe dare la cache fredda. Per testare la banda stessa, apri una conversazione, passa a un'altra e torna indietro, ruota il telefono, e spegni e riaccendi lo schermo: la banda dovrebbe restare sopra la casella dei messaggi, cambiare con la conversazione, e aggiornarsi entro 10 secondi dal ritorno dello schermo.

## Per andare oltre

- La [guida 3](/it/mods/claude/sidebar/) parla del blocco nel menu laterale, che aggiunge ciò che la pagina non può sapere.
- Dentro Claude Code, Narsil mostra gli stessi stati con regole sue: vedi [L'orologio della cache](/it/mods/pet/cache-clock/) e [Contesto e limiti](/it/mods/pet/context-and-limits/).
- La banda potrebbe dirti quando la cache sta per raffreddarsi. Le servirebbe la durata reale della cache, ed è per questo che l'estensione la prende dalla mod quando può.
