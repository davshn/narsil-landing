---
title: Il blocco nel menu laterale
description: 'Il blocco sotto Cerca nel menu laterale di claude.ai: il livello di Narsil e il conteggio ntfy del giorno dalla mod tramite ntfy.sh, e i limiti di 5 ore e settimanali da claude.ai.'
route: claude
order: 3
updated: 2026-11-18
---

## Cosa fa

Apri il menu laterale su `claude.ai` e, appena sotto **Cerca**, Narsil in Claude aggiunge un blocco con tre tipi di dati:

| Cosa                                                                | Da dove arriva                     |
| ------------------------------------------------------------------- | ---------------------------------- |
| **Narsil**, il suo livello e la sua esperienza, con una barra       | La mod narsil-pet, tramite ntfy.sh |
| **`5 horas`** e **`Semana`**: i limiti di 5 ore e settimanali       | `claude.ai` stesso, ogni minuto    |
| **`ntfy hoy`**: i messaggi ntfy.sh del giorno e il loro azzeramento | La mod narsil-pet, tramite ntfy.sh |

Ogni limite mostra una percentuale, una barra in verde, ambra o rosso, e quando si azzera, come `reinicia en 2 h 05 min` ("si azzera tra 2 h 05 min"). Il livello si legge come `Narsil ⭐ Nivel 4` con `350/400 XP` accanto.

ntfy.sh viene usato solo per ciò che la pagina non può sapere. Il livello e il conteggio cambiano quando la mod invia uno stato, cioè quando scrivi a Claude Code tramite Remote Control. Quando il conteggio ha più di un'ora, il blocco lo dice.

> **Sperimentale.** Il blocco trova il suo posto tramite la struttura del menu laterale di `claude.ai`, e legge i limiti da un indirizzo interno della pagina, non da un'API pubblica. Un aggiornamento di Claude può romperlo; quando succede, il blocco smette di comparire. Legge soltanto, e non invia mai i tuoi dati da nessuna parte.

## Come funziona dentro

Il blocco è disegnato da `extension/content.js`, come la banda della [guida 2](/it/mods/claude/conversation-band/). I limiti li legge il content script stesso, dalla pagina. Il livello e il conteggio li legge lo script di background, `extension/background.js`, con l'aiuto di `lib/stream.js` e `lib/seal.js`, e li conserva e li modella `lib/state.js`.

### Trovare Cerca in qualsiasi lingua

Il blocco non viene trovato tramite la parola "Cerca", che cambia con la lingua della pagina. Viene trovato tramite il punto in cui sta Cerca: su un telefono, il menu laterale è un pannello con Cerca nella sua intestazione; su uno schermo più largo, Cerca è l'unico pulsante diretto del primo gruppo del menu. Il blocco viene inserito subito dopo.

La pagina monta il menu laterale tardi, e a volte lo monta di nuovo, quindi il blocco viene rimesso a posto dallo stesso osservatore della pagina che usa la banda: a ogni esecuzione, se non è subito dopo Cerca, ci va.

### I limiti, da `claude.ai` ogni minuto

I limiti di 5 ore e settimanali sono del tuo account, e `claude.ai` li conosce già. Il content script li legge nello stesso modo in cui la banda legge una conversazione, con la sessione della pagina e una richiesta `GET`:

1. **Quale account.** L'id dell'organizzazione che la pagina ha aperta è in uno dei cookie della pagina, `lastActiveOrg`. Il content script lo legge da `document.cookie` e non lo conserva mai.
2. **L'utilizzo.** Chiede a `claude.ai` l'utilizzo di quell'organizzazione, un indirizzo interno della pagina.
3. **Due finestre.** Dalla risposta prende la finestra di 5 ore e quella di 7 giorni: quanto è usato, come percentuale, e quando si azzera ciascuna.

Chiede una volta quando la pagina si carica, poi ogni 60 secondi, e mai mentre la pagina è nascosta. Quando la pagina torna visibile, chiede subito.

### Il livello e il conteggio, dalla mod tramite ntfy.sh

Il tuo livello e il conteggio di ntfy.sh vivono sul tuo computer, nella mod. narsil-pet li invia nel suo topic di stato silenzioso: il tuo topic con `-estado` ("stato") alla fine, pubblicato dopo ogni turno mentre scrivi da fuori ([Avvisi sul telefono e sull'orologio](/it/mods/pet/phone-and-watch/) descrive il topic e i suoi cinque campi). Il suo README dice che quel topic lo legge questa estensione "because they are data only the PC knows" (perché sono dati che conosce solo il PC).

Il blocco usa tre dei cinque campi:

- **`xp`**, un'etichetta come `⭐ Nivel 4 · 350/400 XP` ([Esperienza e crescita](/it/mods/pet/experience-and-growth/) spiega i livelli). `lib/state.js` la divide nel nome, nei punti dentro il livello e nei punti che servono, per la barra.
- **`art`**, l'indirizzo dell'immagine di Narsil al suo stadio. Viene accettato solo quando punta agli asset di narsil-pet.
- **`usage`**, una riga chiamata `ntfy` con la sua etichetta, percentuale, colore, nota e ora di azzeramento.

Il quarto campo, `at`, è quando la mod lo ha inviato. I dati più recenti vincono sempre: un messaggio più vecchio di quello già mostrato viene ignorato.

### Perché ntfy.sh lo legge lo script di background, non la pagina

I content script girano dentro `claude.ai`, sotto la Content Security Policy della pagina. Così la lettura la fa `background.js`. La descrizione del codice stesso: da lì, "claude.ai's Content-Security-Policy does not apply, and the topic and the key never reach the page." (la Content-Security-Policy di claude.ai non si applica, e il topic e la chiave non arrivano mai alla pagina.)

Le due parti parlano tramite una porta ([MDN: runtime.connect](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/connect)):

1. Quando una pagina di `claude.ai` mostra il blocco, il suo content script apre una porta chiamata `narsil-band`. Il background accetta solo porte della sua stessa estensione.
2. Con la prima porta, il background inizia a leggere; quando se ne va l'ultima, si ferma. Una pagina nascosta chiude la sua porta, quindi niente viene letto mentre non stai guardando.
3. Ogni volta che lo stato cambia, il background invia lo stato aperto a ogni porta. Non invia mai il topic né la chiave.

### Prima il polling, poi seguire lo stream

ntfy.sh può inviare un topic come stream JSON, "one JSON message object per line" (un oggetto messaggio JSON per riga), e la sua opzione `poll=1` chiude la connessione una volta letti i messaggi in cache ([ntfy: subscribe API](https://docs.ntfy.sh/subscribe/api/)). Il background usa entrambi, solo sul topic `-estado`:

1. **Polling delle ultime 12 ore**: `https://ntfy.sh/<topic>-estado/json?poll=1&since=12h`. Questo porta subito lo stato più recente.
2. **Seguire lo stream** dall'id dell'ultimo messaggio ricevuto, così niente viene letto due volte e niente va perso.

Lo stream viene letto con `fetch` e un lettore di stream, riga per riga, non con `EventSource`. Il motivo è in `lib/stream.js`: il pacchetto Chromium esegue il background come service worker, "which has no EventSource" (che non ha EventSource). Quando lo stream finisce, riparte dall'ultimo messaggio che ha portato; quando fallisce, aspetta un secondo, poi il doppio ogni volta, fino a un minuto.

In Chromium, il service worker viene fermato dopo 30 secondi senza attività ([Chrome: the extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)), e lo stream con lui. Così, mentre il blocco è visibile, il content script invia una parola sulla sua porta ogni 25 secondi per tenerlo sveglio.

L'ultimo stato viene anche salvato in `storage.local`, con il topic a cui appartiene, così una pagina che si apre più tardi lo mostra subito. Il commento del codice spiega perché basta: "what it brought is kept, as ntfy.sh keeps it for 12 h" (ciò che ha portato viene conservato, dato che ntfy.sh lo conserva per 12 h).

### I messaggi sigillati e la chiave

Se hai attivato `/narsil movil clave` sul tuo computer, la mod sigilla ciò che pubblica: lo stato arriva come un testo che inizia con `narsil1:`, illeggibile senza la chiave. `lib/seal.js` lo apre con la chiave delle opzioni, seguendo lo schema che usa `hooks/seal.ts` di narsil-pet ([la guida del telefono](/it/mods/pet/phone-and-watch/) lo descrive passo per passo):

1. Dalla tua chiave ne vengono derivate due: HMAC-SHA256 di `enc` e di `mac`.
2. Il testo dopo `narsil1:` viene decodificato da base64url in un nonce di 16 byte, il testo cifrato e un tag di 32 byte.
3. Il tag viene calcolato di nuovo sul nonce e sul testo cifrato, e confrontato con quello ricevuto. Se sono diversi, il messaggio non viene aperto.
4. Solo allora il testo viene decifrato, 32 byte alla volta, con HMAC-SHA256 del nonce e di un contatore di blocco come keystream.

La mod costruisce l'HMAC a mano perché il suo modulo degli hook ha solo SHA-256. L'estensione non ne ha bisogno: il WebCrypto del browser ha l'HMAC integrato ([MDN: SubtleCrypto.sign](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/sign)), e il commento di narsil-pet dice che l'HMAC di WebCrypto "gives the same bytes" (dà gli stessi byte).

Quando un messaggio sigillato non si apre, perché non c'è una chiave o è quella sbagliata, il blocco mostra `🔒 Toca y pon la clave` ("tocca e inserisci la chiave"), e un tocco apre le opzioni. Un messaggio non sigillato viene letto così com'è, con o senza chiave.

### Cosa potrebbero fare i lettori del topic, e come si difende il blocco

Senza una chiave, chiunque conosca il tuo topic può anche pubblicarci. Quindi ciò che arriva da ntfy.sh non viene mai considerato affidabile come markup: ogni valore entra nel blocco con `textContent`, e un'immagine viene mostrata solo quando il suo indirizzo inizia con la cartella degli asset di narsil-pet. Uno stato falso potrebbe mostrare un livello o un conteggio sbagliati, ma non può aggiungere un link, uno script o un'immagine da altrove.

### "Più di un'ora fa", e perché il conteggio arriva dal PC

La mod invia uno stato solo mentre scrivi da fuori. Quando torni alla scrivania, l'ultimo stato resta, e invecchia. Così, quando uno stato ha più di un'ora, la riga `ntfy hoy` aggiunge una nota come `dato de hace 3 h` ("dato di 3 h fa"). Il livello non riceve una nota del genere.

Il conteggio stesso deve arrivare dal computer, perché ntfy.sh conta i messaggi per indirizzo IP. La mod chiede a ntfy.sh, dalla rete del computer, quanti messaggi ha inviato oggi quella rete, e mette la risposta nel suo stato. Se chiedesse il telefono, ntfy.sh risponderebbe sulla rete del telefono, che non invia niente. Come spiega la guida del telefono, quel giorno inoltre inizia a un'ora tutta di ntfy.sh, non a mezzanotte, ed è per questo che la riga mostra la sua ora di azzeramento.

## Come è stata chiesta all’IA

Nessuna richiesta per il blocco è stata registrata. Le parole di chi ha creato Narsil registrate per questo percorso riguardano il sito (la [guida 1](/it/mods/claude/what-it-is/) le cita). Quanto segue è ricostruito dalla cronologia dei commit dell'estensione:

- `c200e8a` (2026-11-09) "feat: show Narsil's state in claude.ai's sidebar on Firefox for Android" (mostra lo stato di Narsil nel menu laterale di claude.ai su Firefox per Android). La prima versione: "A row under the search, with a panel for the conversations, limits, cache and alerts" (una riga sotto la ricerca, con un pannello per le conversazioni, i limiti, la cache e gli avvisi), che leggeva ntfy.sh "from the background page, live while the page shows it" (dalla pagina di background, in diretta mentre la pagina lo mostra).
- `00adbb9` (2026-11-09) "feat: show only Narsil's level, the limits and ntfy's count in the sidebar" (mostra nel menu laterale solo il livello di Narsil, i limiti e il conteggio di ntfy). I limiti sono passati a `claude.ai` stesso: "ntfy.sh is only read for what the page cannot know: her level and its own count, so the extension no longer follows the alerts topic." (ntfy.sh viene letto solo per ciò che la pagina non può sapere: il suo livello e il suo conteggio, quindi l'estensione non segue più il topic degli avvisi.)
- `11dadb3` (2026-11-10) "feat: run the extension in Vivaldi for Android as a Chromium package" (esegue l'estensione in Vivaldi per Android come pacchetto Chromium). Lo stream è passato da `EventSource` a `fetch`, con l'attesa crescente dopo un fallimento e la parola ogni 25 secondi.

Dal lato della mod, `544ef89` (2026-11-09) di narsil-pet "feat: send only what the Firefox extension reads through ntfy" (invia tramite ntfy solo ciò che legge l'estensione di Firefox) ha ridotto il suo stato ai cinque campi visti sopra, lo stesso giorno.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt di chi ha creato Narsil.

> Nella mia estensione per `https://claude.ai/*`, aggiungi un blocco subito dopo il pulsante Cerca del menu laterale, trovato tramite la sua posizione, non il suo testo. Il content script apre una porta `runtime.connect` verso il background mentre la pagina è visibile e la chiude quando è nascosta. Il background legge il topic da `storage.local`, fa il polling di `https://ntfy.sh/<topic>-estado/json?poll=1&since=12h`, poi segue lo stesso stream JSON con `fetch` e un lettore di stream dall'id dell'ultimo messaggio, riprovando con un'attesa che raddoppia fino a 60 s. Invia lo stato analizzato più recente a ogni porta, mai il topic. Nel blocco, mostra il campo `xp` come testo con `textContent`, accetta l'URL di un'immagine solo da un prefisso fisso, e aggiungi "dato di N h fa" quando l'`at` dello stato ha più di un'ora. Testa l'analisi e lo stream con `node --test`, passando un `fetch` finto.

## Il codice minimo

Le due metà, scritte per questa guida (MIT). Il background segue il topic di stato e invia al blocco ciò che legge; il content script lo mostra. Provalo con un topic inventato come `narsil-0123456789abcdef0123`, su un topic tutto tuo.

`background.js`:

```js
const ports = new Set()
let controller = null
let latest = null

async function follow(topic, signal) {
  let since = null
  let wait = 1000
  while (!signal.aborted) {
    try {
      const query = since ? `?since=${encodeURIComponent(since)}` : '?since=12h'
      const response = await fetch(`https://ntfy.sh/${topic}-estado/json${query}`, { signal })
      if (!response.ok || !response.body) throw new Error(`ntfy.sh ${response.status}`)
      wait = 1000
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
      let rest = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        const lines = (rest + value).split('\n')
        rest = lines.pop()
        for (const line of lines.filter(Boolean)) {
          const message = JSON.parse(line)
          if (message.event !== 'message') continue
          since = message.id
          latest = JSON.parse(message.message)
          ports.forEach((port) => port.postMessage(latest))
        }
      }
    } catch {
      if (signal.aborted) return
      await new Promise((resolve) => setTimeout(resolve, wait))
      wait = Math.min(wait * 2, 60_000)
    }
  }
}

browser.runtime.onConnect.addListener(async (port) => {
  if (port.sender?.id !== browser.runtime.id) return
  ports.add(port)
  port.onDisconnect.addListener(() => {
    ports.delete(port)
    if (ports.size === 0) controller?.abort()
  })
  if (latest) port.postMessage(latest)
  if (ports.size > 1) return
  const { topic } = await browser.storage.local.get('topic')
  if (!/^[-_A-Za-z0-9]{1,64}$/.test(topic ?? '')) return
  controller = new AbortController()
  follow(topic, controller.signal)
})
```

Nel content script:

```js
const level = document.createElement('div')
const port = browser.runtime.connect({ name: 'my-block' })
port.onMessage.addListener((status) => {
  const hours = Math.floor((Date.now() / 1000 - (status.at ?? 0)) / 3600)
  level.textContent =
    hours >= 1 ? `${status.xp} · data from ${hours} h ago` : String(status.xp ?? '')
})
```

`TextDecoderStream` e il lettore di stream sono standard ([MDN: Using readable streams](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams)), e funzionano in un service worker di Chromium, dove `EventSource` no. Un messaggio che non è JSON valido lancia un'eccezione dentro il ciclo e lo stream riparte subito dopo di esso, il che basta per un esempio; l'estensione invece salta quelle righe.

## Errori comuni e come testarlo

- **Leggere ntfy.sh dalla pagina.** Il content script avrebbe bisogno del topic, e così qualsiasi altra cosa giri nella pagina. Tieni il topic nel background.
- **Trovare Cerca tramite il suo testo.** L'etichetta cambia con la lingua della pagina. Trovalo tramite la sua posizione.
- **`EventSource` in Chromium.** Il service worker non ce l'ha; usa `fetch` e leggi il corpo.
- **Uno stream che non riparte mai.** ntfy.sh, la rete o il telefono lo chiuderanno. Riparti dall'id dell'ultimo messaggio, e aspetta di più dopo ogni fallimento.
- **Un service worker addormentato.** Chromium ne ferma uno inattivo dopo 30 secondi, e lo stream si ferma con lui. Tienilo sveglio mentre il blocco è visibile, e lascialo dormire quando non c'è niente.
- **Fidarsi del topic.** Senza una chiave, chiunque abbia il nome può pubblicarci. Mostra solo testo, e immagini da un solo indirizzo fisso.
- **Chiedere a ntfy.sh il conteggio dal telefono.** La risposta riguarda la rete del telefono. Il conteggio deve arrivare dal computer.
- **Un conteggio che non si muove mai.** La mod invia il suo stato solo mentre scrivi tramite Remote Control. Alla scrivania, il blocco tiene l'ultimo e ne segna l'età.

Per testarlo, pubblica uno stato inventato sul tuo topic di prova da un computer: `curl -d '{"xp":"⭐ Nivel 2 · 40/200 XP","at":1700000000}' https://ntfy.sh/narsil-0123456789abcdef0123-estado` ([ntfy: publishing](https://docs.ntfy.sh/publish/)), con un topic che hai inventato. Il blocco dovrebbe mostrare il livello entro un secondo, e la nota sull'età, dato che quell'`at` è passato da tempo. Poi spegni la rete per un minuto e riaccendila: lo stream dovrebbe riprendere, e uno stato pubblicato mentre era spenta dovrebbe arrivare.

## Per andare oltre

- La [guida 4](/it/mods/claude/colors-and-icon/) veste l'intera pagina con i colori di Narsil, e dà all'app della schermata home la sua icona.
- La [guida 5](/it/mods/claude/android-packaging/) spiega il pacchetto Chromium, e perché il suo background ha bisogno della parola ogni 25 secondi.
- I limiti potrebbero avvisarti prima che tu li raggiunga, come fa Narsil dentro Claude Code: vedi [Contesto e limiti](/it/mods/pet/context-and-limits/).
