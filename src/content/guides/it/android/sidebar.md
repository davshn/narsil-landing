---
title: Il blocco nel menu laterale
description: "Il blocco sotto la ricerca nel menu laterale di Claude: livello di Narsil e conteggio ntfy dallo stato della mod, limiti di 5 ore e settimanali da claude.ai ogni minuto, e l'avviso del lucchetto."
route: android
order: 4
updated: 2026-11-24
sources:
  - repo: android
    path: app/src/main/assets/page/content.js
  - repo: android
    path: app/src/main/assets/page/lib/state.js
  - repo: android
    path: app/src/main/assets/page/lib/live.js
  - repo: android
    path: app/src/main/assets/host.js
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/StateModel.kt
  - repo: pet
    path: hooks/phone.ts
  - repo: pet
    path: hooks/register.tsx
---

## Cosa fa

Apri il menu laterale di Claude nell'app e, appena sotto la ricerca, Narsil aggiunge un blocco con tre tipi di dati:

| Cosa                                                                            | Da dove arriva                    |
| ------------------------------------------------------------------------------- | --------------------------------- |
| **Narsil**, la sua immagine, il suo livello e la sua esperienza, con una barra  | La mod di Narsil, tramite ntfy.sh |
| **`5 horas`** e **`Semana`** (5 ore e settimana): i tuoi due limiti di utilizzo | `claude.ai` stesso, ogni minuto   |
| **`ntfy hoy`** (ntfy oggi): i messaggi ntfy.sh del giorno e il loro azzeramento | La mod di Narsil, tramite ntfy.sh |

Ogni limite mostra una percentuale, una barra verde, ambra o rossa, e quando si azzera, come `reinicia en 2 h 05 min` (si azzera tra 2 h 05 min). Il livello si legge come `Narsil ⭐ Nivel 28` con accanto `30/2800 XP`.

Il blocco parla anche quando manca qualcosa. Senza un topic nelle impostazioni, dice `Toca y escribe tu topic` (tocca e scrivi il tuo topic). Quando lo stato della mod è cifrato e l'app non riesce ad aprirlo, dice `🔒 Toca y pon la clave` (tocca e inserisci la chiave). Un tocco su uno dei due avvisi, o su Narsil stessa, apre le impostazioni dell'app.

> **Sperimentale.** Il blocco trova il suo posto tramite la struttura del menu laterale di Claude, e legge i tuoi limiti da un indirizzo interno della pagina di `claude.ai`, non da un'API pubblica. Un aggiornamento di Claude può rompere l'una o l'altra cosa; quando succede, il blocco smette di comparire o perde i suoi limiti, e Claude continua a funzionare. Legge soltanto.

ntfy.sh viene usato solo per ciò che la pagina non può sapere. Il livello e il conteggio cambiano quando la mod invia uno stato, cioè quando scrivi a Claude Code tramite Remote Control. Quando il conteggio ha più di un'ora, il blocco lo dice.

## Come funziona dentro

Il blocco è disegnato da `assets/page/content.js`, come la banda della [guida 3](/it/android/conversation-band/), ed entrambi condividono l'osservatore della pagina di `lib/watch.js`. I limiti li legge `content.js` stesso, dalla pagina, con regole in `lib/live.js`. Il livello e il conteggio arrivano dal codice Kotlin dell'app attraverso il canale della [guida 2](/it/android/webview-host/), e `lib/state.js` dà loro forma.

### Trovare la ricerca in qualsiasi lingua

Il blocco non si trova tramite la parola "Search", che cambia con la lingua della pagina. Si trova tramite il punto in cui sta la ricerca. Da `content.js` in narsil-android (MIT):

<!-- prettier-ignore -->
```js
  // Under the search, found by where it sits and so in any language: on a phone
  // the sidebar is a sheet with the search in its header; on a wider screen
  // it is the only direct button of the list's first block. The page mounts
  // the sidebar late and again at times: she goes back under it.
  const PHONE_SEARCH = '.df-phone-sheet-header'
  const WIDE_SEARCH = '.dframe-nav-scroll > .shrink-0 > button'
  function place() {
    const search = document.querySelector(PHONE_SEARCH) || document.querySelector(WIDE_SEARCH)
    if (search && search.nextElementSibling !== band) search.after(band)
    drawEvent()
  }

  self.narsilWatch(place)
```

`place` gira a ogni cambiamento che vede l'osservatore della pagina, al massimo una volta per frame. Se il blocco non è subito dopo la ricerca, ci va. I due selettori sono nomi di classe del markup attuale di `claude.ai`, e sono le righe più fragili di questa guida: basta un ridisegno del menu laterale per perdere il blocco.

### I limiti, da `claude.ai` ogni minuto

I limiti di 5 ore e settimanali sono del tuo account, e `claude.ai` li conosce già. Il blocco li legge nello stesso modo in cui la banda legge una conversazione, con la sessione della pagina e una richiesta `GET`. Da `lib/live.js` (MIT):

<!-- prettier-ignore -->
```js
  // The account the page has open is in its cookie.
  function usageUrl(cookie) {
    const org = /(?:^|; )lastActiveOrg=([0-9a-f-]{36})(?:;|$)/.exec(cookie || '')?.[1]
    return org ? `${ORIGIN}/api/organizations/${org}/usage` : null
  }

  function limitOf(label, window, now) {
    if (typeof window?.utilization !== 'number') return null
    const note = window.resets_at ? self.narsilState.resetLabel(Date.parse(window.resets_at) / 1000, now) : ''
    return { label, percent: Math.round(window.utilization), color: self.narsilState.levelColor(window.utilization), note }
  }

  const limitsOf = (usage, now) => [limitOf('5 horas', usage?.five_hour, now), limitOf('Semana', usage?.seven_day, now)].filter(Boolean)
```

1. **Quale account.** L'id dell'organizzazione che la pagina ha aperta è nel cookie `lastActiveOrg`, un UUID di 36 caratteri. Lo script lo legge da `document.cookie` e non lo conserva da nessuna parte.
2. **L'utilizzo.** Chiede `claude.ai/api/organizations/<id>/usage`, un indirizzo interno della pagina.
3. **Due finestre.** Dalla risposta prende `five_hour` e `seven_day`: `utilization`, già una percentuale, e `resets_at`, una data. Una finestra senza un `utilization` numerico viene lasciata fuori.

L'azzeramento lo formula `resetLabel` in `lib/state.js`: `reinicia en 45 min`, `reinicia en 2 h 05 min` o `reinicia en 3 d 4 h`, e `ya se reinició` (si è già azzerato) una volta passata l'ora. I colori sono le soglie condivise di `levelColor`: verde sotto il 60 %, ambra dal 60 %, rosso dall'85 %.

`pollUsage` chiede una volta quando la pagina si carica, poi ogni 60 secondi, e mai mentre la pagina è nascosta. Quando la pagina torna visibile, chiede subito. Se la richiesta fallisce, restano gli ultimi limiti.

### Il livello e il conteggio, dalla mod tramite ntfy.sh

Il tuo livello e il conteggio di ntfy.sh vivono sul tuo computer, nella mod. La mod li invia nel suo topic di stato silenzioso, il tuo topic con `-estado` ("stato") alla fine. L'app lo segue in Kotlin mentre la pagina mostra la banda, tiene lo stato più recente e lo invia alla pagina (la [guida 3](/it/android/conversation-band/) ripercorre `StateFeed` e `StateModel`). La pagina non vede mai il topic.

Lo stato porta più campi di quelli che usa il blocco. `sendStatus` in `hooks/register.tsx` di narsil-pet lo costruisce con `xp`, `art`, `at`, `cacheMinutes`, `limits`, `sessions` e `usage`. Il blocco ne legge tre, più `at`:

- **`xp`**, un'etichetta come `⭐ Nivel 28 · 30/2800 XP`, scritta da `xpLabel` della mod. `levelOf` in `lib/state.js` la divide nel nome, nei punti già fatti nel livello e nei punti che servono, per la barra.
- **`art`**, l'indirizzo dell'immagine di Narsil al suo stadio. È accettato solo quando inizia con la cartella degli asset di narsil-pet su GitHub. In modalità chiara, il blocco sostituisce `-oscuro.png` con `-claro.png`, dato che la mod invia la variante scura.
- **`usage`**, una riga con la chiave `ntfy`, costruita da `ntfyRow` della mod in `hooks/phone.ts`: `{ key: 'ntfy', label: 'ntfy hoy', percent, color, note, resetsAt }`, dove `note` si legge come `24/250 mensajes` (24/250 messaggi).
- **`at`**, quando l'ha inviato la mod, in secondi. Decide quale stato è il più recente, e quanto è vecchio il conteggio.

`limits` e `sessions` sono per [Narsil Watch](/it/watch/what-it-is/), che non ha una pagina di `claude.ai` a cui chiedere; l'app prende invece i suoi limiti dalla pagina. I due parser, da `lib/state.js` (MIT):

<!-- prettier-ignore -->
```js
  // "⭐ Nivel 4 · 350/400 XP": the name, and how far into the level.
  function levelOf(xp) {
    const m = /^(.*?)\s*·\s*(\d+)\/(\d+)\s*XP/.exec(xp || '')
    if (!m) return null
    const [into, needed] = [Number(m[2]), Number(m[3])]
    return { name: `Narsil ${m[1]}`, into, needed, percent: Math.round((into / needed) * 100) }
  }

  function ntfyOf(s, now) {
    const row = Array.isArray(s.usage) ? s.usage.find((r) => r.key === 'ntfy') : null
    if (!row) return null
    const isStale = Boolean(s.at) && now - s.at > STALE_SECONDS
    const note = [row.note, row.resetsAt ? resetLabel(row.resetsAt, now) : '', isStale ? `dato de ${ago(s.at, now)}` : ''].filter(Boolean).join(' · ')
    return { label: row.label, percent: Math.round(row.percent), color: row.color, note }
  }
```

Un'etichetta di livello che non corrisponde al pattern dà `null`, e la testa del blocco, immagine compresa, resta nascosta. È anche ciò che vedi prima che la mod abbia mai inviato uno stato.

### Perché il conteggio deve arrivare dal computer

ntfy.sh conta i messaggi per indirizzo IP. La mod chiede a `https://ntfy.sh/v1/account`, dalla rete del tuo computer, quanti messaggi ha inviato oggi quella rete, e mette la risposta nel suo stato, contando il messaggio che sta per partire. Se chiedesse il telefono, ntfy.sh risponderebbe sulla rete del telefono, che non invia niente. Come spiega il commento di narsil-pet, quel giorno inoltre inizia "at an hour hashed from the IP, not at midnight" (a un'ora ricavata dall'hash dell'IP, non a mezzanotte), ed è per questo che la riga mostra la propria ora di azzeramento.

### "Più di un'ora"

La mod invia uno stato solo mentre scrivi da lontano, e si limita a 200 messaggi al giorno. Quando torni alla scrivania, l'ultimo stato resta, e invecchia. Così, quando uno stato ha più di un'ora (`STALE_SECONDS = 3600`), la riga `ntfy hoy` aggiunge una nota come `dato de hace 3 h` (dato di 3 h fa). Il livello non riceve una nota del genere: cambia lentamente, e un livello di un'ora fa è ancora il tuo livello.

### Come viene disegnato il blocco

`renderBand` in `content.js` costruisce il blocco dall'ultimo messaggio che l'app ha inviato e dagli ultimi limiti. Da `content.js` (MIT):

<!-- prettier-ignore -->
```js
  function renderBand() {
    const now = Date.now() / 1000
    const view = latest?.type === 'model' ? N.viewOf(latest.model, now) : null
    const notes = { sealed: '🔒 Toca y pon la clave' }
    const message = latest?.type === 'no-topic' ? 'Toca y escribe tu topic' : notes[view?.kind]
    notice.hidden = !message
    setText(notice, message || '')
    const level = view?.level
    head.hidden = !level
    if (level) {
      setPet(L.themedArt(view.art, document.documentElement.dataset.mode === 'light'))
      setText(levelName, level.name)
      setText(levelXp, `${level.into}/${level.needed} XP`)
      levelFill.style.width = `${Math.min(100, level.percent)}%`
    }
    meters.replaceChildren(...[...L.limitsOf(limits, now), ...(view?.ntfy ? [view.ntfy] : [])].map(meter))
  }
```

Gli indicatori vengono ricostruiti ogni volta con `replaceChildren`, a partire da elementi creati con `createElement` e riempiti con `textContent`. La testa viene aggiornata al suo posto con `setText`, che scrive solo quando il testo è cambiato. Gira quando arriva un messaggio dall'app, quando arrivano nuovi limiti, e ogni 15 secondi mentre la pagina è visibile, così le ore di azzeramento continuano a muoversi.

### Gli avvisi e i tocchi

`viewOf` in `lib/state.js` decide l'avviso a partire dal modello che l'app ha inviato:

| Il modello                                          | `viewOf` dà      | Il blocco mostra                              |
| --------------------------------------------------- | ---------------- | --------------------------------------------- |
| `{ type: 'no-topic' }` dall'app                     | (nessun modello) | `Toca y escribe tu topic`                     |
| Nessuno stato, e l'ultimo messaggio non si è aperto | `sealed`         | `🔒 Toca y pon la clave`                      |
| Nessuno stato, niente di sigillato                  | `empty`          | Solo i limiti                                 |
| Uno stato                                           | `state`          | Narsil, il suo livello, i limiti e `ntfy hoy` |

Leggi insieme la seconda e la quarta riga, perché nascondono un dettaglio: l'avviso del lucchetto compare solo quando il modello **non ha nessuno stato**. `StateModel.receive` segna il modello `isSealed` quando un messaggio non si apre, ma tiene lo stato che aveva; e `viewOf` mostra uno stato ogni volta che ce n'è uno. Quindi, se Narsil era già visibile e arriva un nuovo messaggio sigillato con una chiave che l'app non ha, il blocco continua a mostrare il livello vecchio, senza lucchetto. Il lucchetto lo vedi su un'installazione nuova, o dopo aver cambiato il topic.

Due tocchi aprono le impostazioni, per due strade:

- **L'avviso** è un `<button>`. Il suo gestore del clic invia `{ type: 'settings' }` sulla porta della banda; `host.js` lo avvolge come `{ kind: 'port', message }`, e `MainActivity` apre `SettingsActivity` quando il tipo interno è `settings`.
- **L'immagine o il livello di Narsil.** `host.js` ascolta i clic su tutto il documento, nella fase di cattura, e invia `{ kind: 'settings' }` quando il bersaglio è dentro `#narsil-band .narsil-head`. Il commit `9e514dd` spiega perché esistono entrambe: "The launcher shortcut is not shown by every launcher, and the band's notice only shows without a topic." (la scorciatoia del launcher non viene mostrata da tutti i launcher, e l'avviso della banda compare solo senza un topic.)

### Cosa potrebbe fare chi legge il tuo topic

Senza una chiave, chiunque conosca il tuo topic può anche pubblicare su `<topic>-estado`. Quindi niente di ciò che arriva da lì viene trattato come markup: ogni valore entra con `textContent`, e un'immagine viene mostrata solo quando il suo indirizzo inizia con la cartella degli asset di narsil-pet. Il commento del codice in `lib/state.js` lo dice: "its text only ever goes in as text, and an image only comes from Narsil's own assets." (il suo testo entra sempre e solo come testo, e un'immagine arriva solo dagli asset di Narsil.) Uno stato falsificato potrebbe mostrare un livello o un conteggio sbagliati. Non può aggiungere un link, uno script o un'immagine da un'altra parte. Potrebbe anche portare un `at` molto avanti nel futuro: ogni stato reale perderebbe allora contro di esso, e dato che l'app salva il modello per topic, il fatto che ntfy.sh dimentichi il messaggio dopo 12 ore non aiuterebbe. Cambiare il topic riparte da un modello vuoto, e così anche cancellare i dati dell'app. La [guida 7](/it/android/encryption-and-settings/) spiega come la chiave restringe tutto questo, e fino a che punto.

## Costruiscila con Claude

Chiedi a Claude un blocco dopo il pulsante di ricerca del menu laterale, alimentato da due lati: la richiesta di utilizzo della pagina stessa, e lo stato che invia l'app. L'unica idea che deve fare bene è che la pagina non tiene mai il topic, e che niente di ciò che arriva da ntfy.sh è affidabile.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nello script di pagina che la mia WebView Android esegue su `https://claude.ai`, aggiungi un blocco subito dopo il pulsante di ricerca del menu laterale, trovato tramite la sua posizione (`.df-phone-sheet-header`, altrimenti `.dframe-nav-scroll > .shrink-0 > button`), non tramite il suo testo, e rimettilo a posto ogni volta che l'osservatore della pagina vede che si è spostato. Ogni 60 secondi, mentre la pagina è visibile, leggi l'id dell'organizzazione dal cookie `lastActiveOrg` e fai `GET /api/organizations/<id>/usage` con `credentials: 'include'`; mostra `five_hour` e `seven_day` come `5 horas` e `Semana`, con percentuale, una barra colorata (verde, ambra da 60, rosso da 85) e l'ora di azzeramento. Dal messaggio che invia l'app, mostra l'etichetta `xp` divisa in livello e punti, un'immagine solo da `https://raw.githubusercontent.com/davshn/narsil-pet/main/assets/`, e la riga di `usage` con chiave `ntfy`, con "dato de hace N h" quando `at` ha più di un'ora. Mostra un avviso toccabile quando l'app dice che non c'è un topic. Usa solo `textContent`. Tieni il parsing in un modulo senza DOM e testalo.

### Cosa controllare nella risposta di Claude

1. La ricerca si trova tramite la sua posizione, non tramite il suo testo.
2. L'id dell'organizzazione viene letto dal cookie ogni volta e non viene conservato da nessuna parte.
3. I limiti vengono chiesti ogni 60 secondi, mai mentre `document.hidden` è true, e subito quando la pagina torna visibile.
4. L'etichetta del livello viene analizzata con un pattern, e un'etichetta che non corrisponde nasconde la testa invece di mostrare spazzatura.
5. L'indirizzo di un'immagine deve iniziare con l'unico prefisso fisso.
6. Tutto entra con `textContent` o come elementi creati, mai come HTML.
7. Il topic non compare mai nello script di pagina.

Se un controllo fallisce, di' a Claude cosa vedi: "con Claude in spagnolo, il blocco non compare".

### Come l'ha chiesta l'autore

Le parole del proprietario registrate per questa app chiedono l'aspetto e la banda dell'estensione in una web view (L1: "que dentro en un web view muestre la web de claude y modifique sus estilos como lo hace esta extension"), quindi il blocco è arrivato senza modifiche. Una richiesta successiva è registrata solo tramite il suo commit:

- `9e514dd` (2026-11-24) "feat: open the settings from Narsil in the band and from the service's notification" (apre le impostazioni da Narsil nella banda e dalla notifica del servizio). Il suo messaggio è citato sopra.

Il log dei task registra il controllo sul telefono reale, con il topic e la chiave reali, il 2026-11-24 alle 00:44: "the band showed Narsil Nivel 28, 30/2800 XP, ntfy's count and her etapa4 art. Settings open from Narsil in the band and from the service's notification." (la banda ha mostrato Narsil Nivel 28, 30/2800 XP, il conteggio di ntfy e la sua immagine di etapa4. Le impostazioni si aprono da Narsil nella banda e dalla notifica del servizio.)

Il resto è ricostruito dalla cronologia dei commit (il nome di un progetto in un oggetto è sostituito da una descrizione tra parentesi quadre):

- `3bcea35` (2026-11-24) "feat: build the script that hosts [l'estensione precedente] in a WebView, and what alerts and states keep" (costruisce lo script che ospita l'estensione precedente in una WebView, e ciò che conservano avvisi e stati).
- `53c55c1` (2026-11-24) "feat: host claude.ai with [l'estensione precedente] in a WebView, and show Narsil's alerts from a foreground service" (ospita claude.ai con l'estensione precedente in una WebView, e mostra gli avvisi di Narsil da un servizio in primo piano).
- `ca01cc7` (2026-11-24) "docs: log the band verified with a signed-in session" (registra la banda verificata con una sessione con accesso fatto).
- `a275382` (2026-11-24) "docs: log the alerts and the band verified with the real topic and key" (registra gli avvisi e la banda verificati con il topic e la chiave reali).

Dal lato della mod, `6400a6f` di narsil-pet (2026-11-23) "feat(phone): publish Claude limits and open conversations for the watch" (pubblica i limiti di Claude e le conversazioni aperte per l'orologio) ha aggiunto i campi `limits` e `sessions` che il blocco lascia all'orologio.

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida (MIT). Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

I limiti come modulo puro, nella forma di `lib/live.js`, con un test. Salvalo come `limits.js`.

```js
const colorOf = (percent) => (percent >= 85 ? '#F0435A' : percent >= 60 ? '#F5B400' : '#22B573')

export function usageUrl(cookie) {
  const org = /(?:^|; )lastActiveOrg=([0-9a-f-]{36})(?:;|$)/.exec(cookie || '')?.[1]
  return org ? `https://claude.ai/api/organizations/${org}/usage` : null
}

export function resetNote(resetsAt, now) {
  const left = Math.max(0, Math.round((resetsAt - now) / 60))
  if (left === 0) return 'ya se reinició'
  if (left < 60) return `reinicia en ${left} min`
  return `reinicia en ${Math.floor(left / 60)} h ${String(left % 60).padStart(2, '0')} min`
}

export function limitsOf(usage, now) {
  const rows = [
    ['5 horas', usage?.five_hour],
    ['Semana', usage?.seven_day],
  ]
  return rows
    .filter(([, window]) => typeof window?.utilization === 'number')
    .map(([label, window]) => ({
      label,
      percent: Math.round(window.utilization),
      color: colorOf(window.utilization),
      note: window.resets_at ? resetNote(Date.parse(window.resets_at) / 1000, now) : '',
    }))
}
```

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { limitsOf, usageUrl } from './limits.js'

test('the organization comes from the cookie, or there is no request', () => {
  const org = '00000000-0000-4000-8000-000000000000'
  assert.equal(
    usageUrl(`theme=dark; lastActiveOrg=${org}`),
    `https://claude.ai/api/organizations/${org}/usage`,
  )
  assert.equal(usageUrl('theme=dark'), null)
})

test('a window without a number is left out', () => {
  const now = Date.parse('2026-11-24T10:00:00Z') / 1000
  const usage = {
    five_hour: { utilization: 72.4, resets_at: '2026-11-24T12:05:00Z' },
    seven_day: null,
  }
  assert.deepEqual(limitsOf(usage, now), [
    { label: '5 horas', percent: 72, color: '#F5B400', note: 'reinicia en 2 h 05 min' },
  ])
})
```

Il vero `minutesLabel` formula anche i giorni (`3 d 4 h`), che servono al limite settimanale; questo si ferma alle ore per restare breve.

## Errori comuni e come testarlo

- **Trovare la ricerca tramite il suo testo.** L'etichetta cambia con la lingua della pagina. Trovala tramite la sua posizione.
- **Posizionare il blocco una volta sola.** La pagina monta il menu laterale tardi, e a volte di nuovo. Rimetti a posto il blocco a ogni esecuzione dell'osservatore.
- **Chiedere i limiti mentre la pagina è nascosta.** Un telefono in tasca chiederebbe ogni minuto per niente.
- **Conservare l'id dell'organizzazione.** È nel cookie quando ti serve; non c'è motivo di salvarlo.
- **Chiedere il conteggio a ntfy.sh dal telefono.** La risposta riguarda la rete del telefono. Il conteggio deve arrivare dal computer.
- **Un conteggio che non si muove mai.** La mod invia il suo stato solo mentre scrivi tramite Remote Control. Alla scrivania, il blocco tiene l'ultimo e ne segna l'età.
- **Aspettarsi il lucchetto dopo un cambio di chiave.** Se uno stato era già visibile, un messaggio che la chiave non apre lo lascia lì. Togliti il dubbio inviando `/narsil movil prueba` dopo aver impostato la chiave: un nuovo stato che si apre sostituisce quello vecchio.

Per testare il parsing sul computer, esegui il modulo qui sopra con `node --test`, e leggi `levelOf`, `ntfyOf` e `viewOf` in `lib/state.js` con uno stato inventato. Sul telefono, metti nelle impostazioni un topic inventato come `narsil-0000000000example0`, poi pubblica dal computer uno stato sul suo topic `-estado` ([ntfy: publishing](https://docs.ntfy.sh/publish/)):

```bash
curl -d '{"xp":"⭐ Nivel 2 · 40/200 XP","at":1700000000,"usage":[{"key":"ntfy","label":"ntfy hoy","percent":10,"color":"#22B573","note":"25/250 mensajes"}]}' https://ntfy.sh/narsil-0000000000example0-estado
```

Apri il menu laterale: entro un secondo dovrebbe mostrare `Narsil ⭐ Nivel 2` con `40/200 XP`, e una riga `ntfy hoy` al 10 % con `25/250 mensajes` e una nota `dato de hace …`, dato che quell'`at` è passato da un pezzo. Dovrebbero esserci anche i limiti, da `claude.ai`. Tocca Narsil: dovrebbero aprirsi le impostazioni. Rimetti il tuo topic reale quando hai finito.

### Dove il codice e il README differiscono

- Il README dice che se la chiave non è quella che ha sigillato i messaggi, la banda dice "🔒 Toca y pon la clave". Il codice lo mostra solo quando l'app non ha ancora nessuno stato per il topic; con uno stato precedente conservato, il blocco continua a mostrare quello, come spiegato sopra.
- Il README mette il tocco per le impostazioni su "The band in Claude's side menu" (la banda nel menu laterale di Claude). Nel codice, quell'elemento è in effetti `#narsil-band`; la banda sopra la casella dei messaggi è `#narsil-event`, e un tocco lì espande solo il suo testo.

## Per andare oltre

- La [guida 5](/it/android/colors-and-mode/) veste tutta la pagina con i colori di Narsil, e il blocco con essa.
- La [guida 7](/it/android/encryption-and-settings/) spiega il lucchetto, la chiave e le impostazioni che apre il blocco.
- Dal lato della mod, [Avvisi sul telefono e sull'orologio](/it/mods/pet/phone-and-watch/) descrive i campi di `-estado`, il limite giornaliero di 200 e `ntfyRow`.
- [Narsil Watch](/it/watch/what-it-is/) legge lo stesso stato, compresi i campi `limits` e `sessions` che il blocco lascia stare.
- Il codice sorgente è su [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
