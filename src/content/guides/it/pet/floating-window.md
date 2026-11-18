---
title: La finestra mobile
description: 'Come Narsil mostra una finestra sempre in primo piano quando Claude è ridotto a icona o qualcosa ti aspetta, e perché il suo server ascolta solo su 127.0.0.1 con chiave di pagina e token della mod.'
route: pet
order: 5
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: overlay/server.cjs
  - repo: pet
    path: overlay/overlay.html
  - repo: pet
    path: overlay/watch.ps1
  - repo: pet
    path: overlay/mac-claude.js
  - repo: pet
    path: overlay/start.sh
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: odd/tasks/animated-poses.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/overlay-server.check.cjs
---

## Cosa fa

La fascia sopra il prompt aiuta solo mentre guardi Claude. Appena lo riduci a icona per leggere una pagina o rispondere a un messaggio, un turno finito o una domanda passano inosservati.

La finestra mobile colma questa lacuna. È una piccola finestra, di 330 per 450 pixel, che:

- **Compare quando Claude è ridotto a icona** (o chiuso), e **si nasconde da sola** quando torni a Claude.
- **Compare quando qualcosa ti aspetta**, anche se Claude è solo dietro un'altra app: una domanda, un permesso, un errore o un turno finito.
- **Resta sopra** le altre finestre su Windows, nell'angolo dello schermo in cui si trova Claude, senza togliere il focus della tastiera a ciò che stai facendo.
- Mostra Narsil con la conversazione più importante (o quella il cui avviso è in attesa), i limiti dell'account e ogni conversazione aperta in un elenco che scorre. Premendo una conversazione si aprono il suo contesto, i suoi task, i suoi subagenti, la cache e i prossimi passi, con un pulsante che porta quella conversazione in primo piano nell'app desktop.

Un avviso di "finito" se ne va da solo dopo 20 secondi; una domanda o un errore restano finché non guardi Claude o non li chiudi. Se chiudi la finestra, l'avviso successivo la riporta, ma non prima di un minuto da quando l'hai chiusa. `/narsil flotante` attiva o disattiva la finestra, e `/narsil prueba` invia un avviso di prova che compare anche mentre guardi Claude.

Su macOS la finestra si comporta in modo un po' diverso, come spiega il README: viene aperta e chiusa invece che nascosta (nascondere la finestra di un'altra app richiederebbe il permesso di accessibilità), si apre dietro l'app in uso e non resta in primo piano. Il browser ricorda dove l'hai messa. Sugli altri sistemi non c'è nessuna finestra; restano la fascia, la voce e le notifiche di Claude Code.

## Come funziona dentro

Quattro pezzi, ognuno con un solo compito:

| Pezzo                                      | Cos'è                                      | Il suo compito                                                                              |
| ------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| La mod (`hooks/register.tsx`)              | Codice della mod, uno per conversazione    | Avvia l'hub, comunica lo stato di questa conversazione, invia gli avvisi                    |
| L'hub (`overlay/server.cjs`)               | Un semplice script Node.js                 | Conserva lo stato di ogni conversazione, serve la pagina, decide quando la finestra compare |
| La pagina (`overlay/overlay.html`)         | Una pagina web in una finestra del browser | Disegna Narsil e l'elenco, rimanda indietro ciò che premi                                   |
| Il custode (`watch.ps1` o `mac-claude.js`) | Uno script di sistema                      | Osserva la finestra di Claude e mostra, nasconde o posiziona la finestra del browser        |

L'hub è lo stesso server che la guida precedente chiama hub: raccoglie lo stato di ogni conversazione. Questa guida guarda la sua altra metà, la finestra.

### Avviare l'hub e la finestra

In `session.start` la mod chiama `startOverlay` un attimo dopo l'inizio della sessione. Interroga con un ping `http://127.0.0.1:47190/ping` tramite `$.http.fetch`; se il server risponde `narsil 4`, è già in funzione. Se risponde una versione più vecchia, la mod prima la ferma, dato che un server sopravvive agli aggiornamenti della mod.

Altrimenti ne avvia uno, passando tre valori nell'ambiente: `NARSIL_TOKEN` (il token della mod, vedi sotto), `NARSIL_PORT` (`47190`) e `NARSIL_WINDOW` (`1` quando la finestra mobile è attiva, `0` quando è disattivata). Il processo viene avviato staccato, così sopravvive all'hook che l'ha avviato:

- **Su Windows**, tramite `$.process.run` che esegue PowerShell, il quale trova Node e Microsoft Edge e chiama `Start-Process` su `node overlay/server.cjs`. Il percorso di Edge va in `NARSIL_EDGE`.
- **Su macOS**, tramite `$.process.run` che esegue `overlay/start.sh`, il quale cerca Chrome, Edge o Brave e Node nei posti consueti, poi avvia il server con `nohup ... &`.

Senza un browser il server funziona comunque e serve le conversazioni; semplicemente non c'è nessuna finestra.

Quando la finestra serve, il server apre il browser in modalità app, senza barra degli indirizzi né schede: `--app=http://127.0.0.1:47190/`, una propria cartella del profilo (`--user-data-dir`, sotto `%LOCALAPPDATA%\narsil-overlay` su Windows) e `--window-size=330,450`. Passa anche `--disable-background-timer-throttling` e due flag simili, perché la finestra è nascosta la maggior parte del tempo e deve comunque aggiornarsi subito quando compare.

### Il custode: Claude è ridotto a icona?

Una pagina web non può vedere le altre finestre, e nemmeno Node può farlo senza aiuto. Così un piccolo script di sistema osserva la finestra di Claude e chiede all'hub cosa fare.

Su Windows, `overlay/watch.ps1` gira in un ciclo ogni 400 ms. Trova la finestra del processo `claude` intitolata `Claude`, e la finestra di Edge intitolata `Narsil`, tramite alcune chiamate a `user32.dll`. Classifica Claude come:

- `min`: ridotto a icona o non visibile.
- `fg`: la finestra in primo piano.
- `bg`: visibile ma dietro un'altra app.
- `gone`: nessuna finestra di Claude.

Poi chiama `GET /tick?claude=<state>&window=<0|1>` con il token della mod, ed esegue ogni riga della risposta: `show` mette la finestra in basso a destra dello schermo in cui Claude è stato visto l'ultima volta, a 16 pixel dal bordo, con `SetWindowPos` e i flag per "sempre in primo piano" e "non attivare"; `hide` la nasconde; `open <link>` porta Claude in primo piano e apre un link a una conversazione. Dopo cinque chiamate fallite di fila (il server non c'è più), termina.

Su macOS, `overlay/mac-claude.js` è uno script JavaScript for Automation eseguito con `osascript -l JavaScript`. Ogni 700 ms legge l'elenco delle finestre da Core Graphics e stampa `fg`, `bg` o `none`. Il commento del file spiega la scelta: l'elenco delle finestre indica l'app di ogni finestra senza alcun permesso, mentre i titoli delle finestre ne richiederebbero uno. Qui la logica del custode vive nel server stesso (`keepMac`): `none` diventa `min`, oppure `gone` quando `pgrep -x Claude` non trova nessun processo.

### Decidere quando mostrarla

La decisione è una sola funzione, `tick`, in `overlay/server.cjs`:

- La finestra deve comparire quando Claude è `min` o `gone`, oppure quando un evento è in attesa.
- Un evento viene cancellato quando guardi Claude (`fg`), e un evento `done` dopo 20 secondi (`DONE_EVENT_MS`).
- `show` o `hide` vengono inviati solo quando lo stato desiderato cambia, così una finestra che hai trascinato resta dove l'hai messa.

Gli eventi arrivano dalla mod tramite `POST /event`, di tipo `done`, `question` o `error`. Il server ignora un evento che arriva mentre stai guardando Claude, a meno che non sia forzato (la prova di `/narsil prueba` e il promemoria "ancora in attesa" dopo cinque minuti). Se hai chiuso la finestra, un evento la riapre solo dopo `REOPEN_AFTER_CLOSE_MS`, 60 secondi.

### Server-sent events: come la pagina resta aggiornata

La pagina non chiede aggiornamenti al server ogni secondo. Apre una sola connessione lunga con `new EventSource('/events')`. Il server risponde con il tipo di contenuto `text/event-stream`, scrive subito l'istantanea corrente e tiene aperta la connessione. Ogni cambiamento successivo viene scritto su ogni connessione aperta come una riga `data: <json>` seguita da una riga vuota (`broadcast`).

Questo è il formato dei server-sent events: un flusso a senso unico dal server alla pagina su semplice HTTP. Si adatta bene alla finestra. Il browser si riconnette da solo se la connessione cade, e il server invia solo quando qualcosa di mostrato è cambiato: un battito che non cambia nulla non viene trasmesso.

L'istantanea contiene ogni conversazione attiva e l'evento in attesa. La pagina disegna il testo con `textContent`, mai come HTML, e disegna l'SVG di Narsil come immagine da un URL `Blob`, un modo di mostrare un'immagine in cui gli script dentro l'SVG non vengono eseguiti.

Le azioni della pagina stessa sono piccole richieste `POST`: `/open` (porta in primo piano una conversazione, tramite il custode), `/dismiss` (cancella l'evento) e `/bounds` (dove si trova la finestra sullo schermo, usato su macOS per posizionare sopra di essa la finestra dei consigli).

### Sicurezza: chi può parlare con l'hub

L'hub gira sul tuo computer e sa cosa sta facendo ogni conversazione. È costruito in modo che solo tre cose possano usarlo: la mod, il custode e la sua pagina. Lo fanno quattro protezioni, tutte in `overlay/server.cjs`.

**1. Ascolta solo sull'indirizzo di loopback.** Le ultime righe del file sono:

```js
server.listen(port, '127.0.0.1', () => {
  if (isWindowWanted) openWindow()
})
```

`127.0.0.1` è l'indirizzo che un computer usa per parlare con sé stesso. Un server legato a esso accetta connessioni solo dai programmi sulla stessa macchina. Un altro computer sulla tua rete Wi-Fi o dell'ufficio non può affatto aprire una connessione verso di esso, qualunque cosa invii.

**2. Il token della mod.** La mod crea un token casuale con `crypto.randomUUID()` la prima volta e lo conserva in `$.store` sotto `overlayToken` (`overlayToken` in `hooks/register.tsx`), così ogni conversazione usa lo stesso. Raggiunge il server solo tramite la variabile d'ambiente `NARSIL_TOKEN` quando la mod lo avvia, e il server lo passa a `watch.ps1` nello stesso modo. Ogni richiesta della mod o del custode lo porta nell'header `x-narsil-token`. Il server lo confronta (`isTrusted`) e rifiuta con `403` quando manca o è sbagliato; un token vuoto non corrisponde mai.

**3. La chiave della pagina.** Alla pagina non si può dare il token della mod: tutto ciò che sta dentro una pagina web è visibile a chiunque carichi quella pagina. Così il server crea un secondo segreto per la pagina: `PAGE_KEY`, 16 byte casuali da `crypto.randomBytes` di Node, nuovi a ogni avvio del server. Scrive la chiave nella pagina dove `overlay.html` ha il segnaposto `__NARSIL_KEY__` (un tag `<meta name="narsil-key">`), e la pagina la rimanda nell'header `x-narsil-page` con ognuna delle sue azioni. Il commento del server spiega il ragionamento: una pagina di un altro sito non può leggere questa, quindi non può conoscere la chiave.

**4. Il controllo di `Host`.** Prima di tutto, il server rifiuta con `403` qualsiasi richiesta il cui header `Host` non sia `127.0.0.1:47190` o `localhost:47190`. Questo blocca il DNS rebinding, un attacco in cui un sito web fa puntare il proprio nome a `127.0.0.1`. Il browser invia allora le richieste di quel sito al tuo server locale, ma con il nome del sito in `Host`, e il server le respinge.

Cosa richiede ogni rotta:

| Rotta                                                    | Richiede                                     |
| -------------------------------------------------------- | -------------------------------------------- |
| `GET /ping`, `/`, `/icon.png`, `/favicon.ico`, `/anim/…` | Solo l'`Host` giusto                         |
| `GET /events` (il flusso), `GET /window` (i limiti)      | Solo l'`Host` giusto                         |
| `POST /open`, `/dismiss`, `/bounds`                      | La chiave della pagina, o il token della mod |
| `GET /sessions`, `GET /tick`                             | Il token della mod                           |
| `POST /state`, `/event`, `/window`, `/quit`              | Il token della mod                           |

Altri due dettagli: i link vengono controllati due volte prima che qualcosa li apra, dal server (`LINK`, `conversationLink`) e di nuovo da `watch.ps1`, ed entrambi accettano solo `claude://code/continue?session=local_…&source=desktop_action`. E i corpi delle richieste oltre un milione di caratteri vengono troncati (`readBody`).

### Il modello di minaccia in parole semplici

Da chi ti protegge il server?

- **Un sito web che visiti.** Il tuo browser invierà richieste da qualsiasi pagina a `127.0.0.1`. Ma la pagina non può leggere le risposte da un'altra origine (il server non invia header che lo permettano), quindi non può leggere il flusso né la chiave. Non conosce la chiave né il token, quindi ogni azione e ogni scrittura la rifiutano. E un nome sottoposto a rebinding non supera il controllo di `Host`.
- **Un altro computer sulla rete.** Non può connettersi, perché il server ascolta solo su `127.0.0.1`.
- **I programmi sul tuo stesso computer.** Questi non vengono tenuti fuori. Qualsiasi programma locale può leggere `/events`, e può leggere la chiave della pagina caricando `/`, proprio come fa la finestra. Il token protegge da loro le rotte della mod, ma un programma che gira già con il tuo utente può leggere molto più di quanto contenga questo server. Il design ti protegge dal web e dalla rete, non dal software che già esegui.

### Perché non deve mai essere esposto alla rete

L'indirizzo di loopback è la protezione su cui poggiano le altre tre. La chiave della pagina e il controllo di `Host` funzionano perché tra un estraneo e il server ci sono solo le regole di un browser, e un browser segue quelle regole. Un programma su un altro computer no:

- Potrebbe scrivere qualsiasi header `Host` voglia, quindi il controllo di `Host` non lo fermerebbe.
- Potrebbe caricare `/` e leggere la chiave della pagina dalla pagina, poi usare le azioni della pagina: aprire conversazioni sul tuo desktop e chiudere i tuoi avvisi.
- Potrebbe leggere `/events` liberamente. Quel flusso contiene il titolo di ogni conversazione, la frase, i task, i subagenti, il contesto, il consiglio, i prossimi passi e i testi degli avvisi, che includono un riassunto dell'ultima risposta di Claude.

I nomi delle cartelle del progetto, gli elenchi dei task e i pezzi delle risposte di Claude sono esattamente ciò che non vorresti fosse letto da chi condivide il Wi-Fi del tuo bar. Il token proteggerebbe ancora `/state` e `/sessions`, ma il solo flusso rivela gran parte dello stesso contenuto. Quindi la regola è semplice: l'hub ascolta su `127.0.0.1` e da nessun'altra parte.

## Costruiscila con Claude

Chiedi a Claude un piccolo server locale che la mod avvia, e una pagina che mostri lo stato in una finestra propria. L'unica idea che deve fare bene è che il server ascolta solo su `127.0.0.1` e controlla chi gli sta parlando a ogni richiesta.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> La mia mod di Claude Code `my-pet` mostra lo stato di Claude nella fascia. Aggiungi una finestra mobile per quando Claude è ridotto a icona. Scrivi un server Node.js, `overlay/hub.cjs`, che ascolti solo su 127.0.0.1, rifiuti qualsiasi header `Host` diverso da `127.0.0.1:<port>` e `localhost:<port>`, serva una pagina HTML con una chiave casuale scritta dentro, trasmetta lo stato a quella pagina con i server-sent events su `/events`, e accetti `POST /state` solo con un token che la mod crea con `crypto.randomUUID()`, conserva in `$.store` e passa in una variabile d'ambiente quando avvia il server staccato con `$.process.run`. Le azioni della pagina stessa devono portare la sua chiave. Non ascoltare mai su nessun altro indirizzo. Aggiungi un test Node che verifichi che un `Host` sbagliato, un token mancante e una chiave mancante vengano ciascuno rifiutati con 403, e che una riga di richiesta come `GET // HTTP/1.1` non faccia cadere il server.

### Cosa controllare nella risposta di Claude

1. Il server chiama `listen` con `'127.0.0.1'` come host, mai con la sola porta.
2. Ogni richiesta il cui header `Host` non è `127.0.0.1:<port>` o `localhost:<port>` viene rifiutata con `403`.
3. Il token della mod non compare mai nella pagina. La pagina riceve una propria chiave casuale, nuova a ogni avvio del server, e la rimanda con ognuna delle sue azioni.
4. Il parsing che può lanciare un'eccezione, come `new URL()`, è protetto, così una riga di richiesta come `GET // HTTP/1.1` riceve una risposta e il server continua a funzionare.
5. Il server viene avviato in modo distaccato, così `$.process.run` non aspetta che finisca.

Se un controllo fallisce, di' a Claude cosa vedi: "l'hook che avvia il server aspetta fino al timeout, e intanto la fascia smette di aggiornarsi".

### Come l'ha chiesta l'autore

La richiesta originale per la finestra mobile non è stata registrata. Arriva nel commit `6f8f938` (2026-10-30) "feat(overlay): add floating window, Spanish voice and Windows toasts" (aggiunge la finestra mobile, la voce in spagnolo e i toast di Windows), insieme alla voce e alle notifiche della prossima guida, prima che esistesse qualsiasi log pubblico dei task.

#### Richieste successive, registrate nei log dei task

La finestra è stata rimodellata dalla vista di tutte le conversazioni, il cui log è `odd/tasks/fleet-view.md` in narsil-pet. L1 (2026-11-06) si apre con:

> "quiero hacerlo en los dos y tambien en la ventana externa, el diseno lo pensamos luego"

In italiano: l'autore lo vuole in entrambi i posti, e anche nella finestra esterna, lasciando il design per dopo. La guida precedente cita questa voce per intero.

L2 (estratto) chiede l'elenco:

> "deberiamos ver en la ventana principal tanto en la banda como la ventana externa el estado de todas las conversaciones, con scroll si son muchas"

In italiano: sia la fascia sia la finestra esterna dovrebbero mostrare lo stato di ogni conversazione, con lo scorrimento quando sono molte. Ecco perché la finestra scorre mentre la fascia usa le pagine. L6 registra il cambiamento al server che è seguito: ora parte con ogni conversazione, con o senza finestra, "Closing the window no longer quits the server; an event reopens a wanted window after 60 s." (chiudere la finestra non spegne più il server; un evento riapre una finestra desiderata dopo 60 s). L8 registra il nuovo layout della pagina, verificato nel browser a 330×450 con quattro conversazioni inventate, e annota: "No automated test covers the page's own script." (nessun test automatico copre lo script della pagina stessa).

I loop nitidi vengono da `odd/tasks/animated-poses.md`, L6 (2026-11-15):

> "en ventana externa podemos poner el video sin recortar? para que se vea mas nitido?"

In italiano: nella finestra esterna si può mostrare il video senza ritagliarlo, così si vede più nitido? Il log registra l'approvazione, "Sí, hazla" ("Sì, falla"), e la sua spec S7 dice che la finestra non ha limiti di dimensione, quindi il server locale serve una copia più nitida di ogni loop. Questa è la rotta `/anim/`.

#### Ricostruzione dalla cronologia dei commit

Il resto, da `git log -- overlay/server.cjs overlay/overlay.html overlay/watch.ps1 overlay/mac-claude.js overlay/start.sh`:

- `6f8f938` (2026-10-30) "feat(overlay): add floating window, Spanish voice and Windows toasts" (aggiunge la finestra mobile, la voce in spagnolo e i toast di Windows). Il server, già su `127.0.0.1` e con il token della mod sulle sue rotte di scrittura, la pagina, `watch.ps1` e `kill.ps1`.
- `a2b5970` (2026-10-30) "fix(overlay): start the window again for an event instead of a notification" (riavvia la finestra per un evento invece che per una notifica).
- `c8bf365` (2026-10-30) "feat(mac): open the floating window on macOS in a Chromium browser" (apre la finestra mobile su macOS in un browser Chromium).
- `9bb60c8` (2026-10-30) "fix(overlay): show the floating window on the screen Claude is on" (mostra la finestra mobile sullo schermo in cui si trova Claude).
- `42f7efd` (2026-10-31) "fix: let only the floating window's own page and the mod drive its server" (lascia che solo la pagina della finestra mobile e la mod comandino il suo server). Questo commit ha aggiunto la chiave della pagina e il controllo di `Host`. Prima, le azioni della pagina non richiedevano nessuna chiave e non c'era nessun controllo di `Host`, quindi una pagina di qualsiasi sito web che visitavi poteva inviare loro una semplice richiesta e, per esempio, chiudere i tuoi avvisi. Ha anche aggiunto i controlli di sicurezza in `tests/overlay-server.check.cjs`.
- `3031ef2` (2026-11-01) "fix(overlay): on macOS show the window when Claude is minimized, not when another app is in front, and open only one" (su macOS mostra la finestra quando Claude è ridotto a icona, non quando un'altra app è davanti, e ne apre solo una).
- `aa54891` e `b87bd67` (2026-11-06): il server diventa l'hub di ogni conversazione, e la finestra le elenca tutte.
- `42aab0c` (2026-11-07) "fix: open the floating window once when Edge hands it to a running instance" (apre la finestra mobile una sola volta quando Edge la passa a un'istanza in esecuzione).
- `e19331b` (2026-11-15) "feat: show sharper animated loops in the floating window" (mostra loop animati più nitidi nella finestra mobile).
- `f2cc0f6` (2026-11-16) "fix: answer 400 to a request path that makes no URL instead of crashing the overlay server" (risponde 400 a un percorso di richiesta che non forma un URL invece di far cadere il server della finestra). Il suo messaggio spiega che una riga di richiesta grezza come `GET // HTTP/1.1` faceva lanciare un'eccezione a `new URL()` dentro il gestore asincrono, il che terminava il processo. Una sola richiesta strana poteva fermare l'hub per ogni conversazione.

Lo schema: prima è arrivata la finestra, poi il suo comportamento su ogni sistema, poi la sua sicurezza, e una correzione tardiva trovata inviando al server una richiesta che nessun browser invierebbe.

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida. Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

Un hub ridotto, scritto per questa guida e adattato da `overlay/server.cjs` e `hooks/register.tsx` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). Il server è semplice Node.js, non codice della mod. Mostrare e nascondere la finestra è lasciato fuori: quella parte dipende dal sistema, come mostrano i custodi descritti sopra.

Il server, `overlay/hub.cjs`:

```js
'use strict'
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const path = require('path')

const port = Number(process.env.PET_PORT || 47190)
const token = process.env.PET_TOKEN || ''
const PAGE_KEY = crypto.randomBytes(16).toString('hex')
const PAGE = fs
  .readFileSync(path.join(__dirname, 'page.html'), 'utf8')
  .replace('__PAGE_KEY__', PAGE_KEY)
const HOSTS = new Set([`127.0.0.1:${port}`, `localhost:${port}`])

let state = null
const listeners = new Set()

const server = http.createServer((req, res) => {
  const send = (status, type, body) => {
    res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
    res.end(body)
  }
  let url
  try {
    url = new URL(req.url, `http://127.0.0.1:${port}`)
  } catch {
    return send(400, 'text/plain', 'bad request')
  }
  if (!HOSTS.has(String(req.headers.host || '').toLowerCase()))
    return send(403, 'text/plain', 'forbidden')
  const isMod = token !== '' && req.headers['x-pet-token'] === token
  const isPage = isMod || req.headers['x-pet-page'] === PAGE_KEY

  if (req.method === 'GET' && url.pathname === '/') return send(200, 'text/html', PAGE)
  if (req.method === 'GET' && url.pathname === '/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' })
    res.write(`data: ${JSON.stringify(state)}\n\n`)
    listeners.add(res)
    req.on('close', () => listeners.delete(res))
    return
  }
  if (req.method === 'POST' && url.pathname === '/dismiss') {
    if (!isPage) return send(403, 'text/plain', 'forbidden')
    return send(204, 'text/plain', '')
  }
  if (req.method === 'POST' && url.pathname === '/state') {
    if (!isMod) return send(403, 'text/plain', 'forbidden')
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 100_000) req.destroy()
    })
    req.on('end', () => {
      try {
        state = JSON.parse(body)
      } catch {
        return send(400, 'text/plain', 'bad json')
      }
      for (const l of listeners) l.write(`data: ${JSON.stringify(state)}\n\n`)
      send(204, 'text/plain', '')
    })
    return
  }
  send(404, 'text/plain', 'not found')
})

server.on('error', () => process.exit(0))
server.listen(port, '127.0.0.1')
```

La pagina legge la sua chiave da `<meta name="pet-key" content="__PAGE_KEY__">`, ascolta con `new EventSource('/events')`, imposta il testo con `textContent` e invia le sue azioni con `fetch('/dismiss', { method: 'POST', headers: { 'x-pet-page': key } })`.

Il lato della mod, in `hooks/register.tsx`, verificato con i tipi della 2.1.325 (`$.store`, `$.process.run`, `$.http.fetch`, `$.plugin.root`, `$.clock.every`). Avvia l'hub su macOS o Linux nel modo in cui lo fa `launch` di Narsil; su Windows, Narsil usa invece `Start-Process` di PowerShell.

```tsx
import { read } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const HUB = 'http://127.0.0.1:47190'

async function hubToken($: EngineInterface): Promise<string> {
  const saved = await $.store.get('hubToken').catch(() => undefined)
  if (typeof saved === 'string' && saved) return saved
  const token = crypto.randomUUID()
  await $.store.set('hubToken', token)
  return token
}

async function startHub($: EngineInterface): Promise<void> {
  const up = await $.http.fetch(`${HUB}/`).then(
    (r) => r.ok,
    () => false,
  )
  if (up) return
  await $.process.run(['/bin/sh', '-c', 'nohup node "$PET_HUB" </dev/null >/dev/null 2>&1 &'], {
    env: { PET_HUB: `${$.plugin.root}/overlay/hub.cjs`, PET_TOKEN: await hubToken($) },
  })
}

async function push($: EngineInterface): Promise<void> {
  await $.http
    .fetch(`${HUB}/state`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-pet-token': await hubToken($) },
      body: JSON.stringify(await read($, pet)),
    })
    .catch(() => undefined)
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await startHub($)
    $.clock.every(2000, () => void push($))
    return next(e)
  })
}
```

`pet` è l'atom di stato della prima guida. Il comando della shell è una stringa fissa; il percorso dello script viaggia nell'ambiente, mai dentro il comando, ed è così che Narsil tiene il testo fuori da ciò che una shell interpreterebbe.

## Errori comuni e come testarlo

- **Ascoltare su ogni indirizzo.** `server.listen(port)` senza host ascolta su tutti gli indirizzi del computer, rete inclusa. Passa sempre `'127.0.0.1'`.
- **Mettere il token della mod nella pagina.** Qualunque cosa contenga una pagina, chiunque la carichi può leggerla. Dai alla pagina una sua chiave, nuova a ogni esecuzione, e tieni il token per la mod.
- **Fidarsi di `Host` come unica protezione.** Impedisce che un browser venga ingannato tramite il DNS rebinding. Non ferma un programma che scrive i propri header, ed è per questo che l'indirizzo di loopback conta.
- **Un gestore asincrono che lancia un'eccezione.** In Node, un'eccezione dentro un gestore di richieste `async` diventa un rifiuto non gestito che può terminare il processo. Racchiudi il parsing che può lanciare un'eccezione, come ha fatto `f2cc0f6` con `new URL()`.
- **Passare testo in una riga di comando.** Gli script di Narsil prendono il loro testo dall'ambiente (`NARSIL_TEXT`, `NARSIL_TOKEN`), così un titolo scritto da Claude non può mai essere letto come parte di un comando.
- **Rubare il focus.** Una finestra che salta in primo piano interrompe la digitazione. Su Windows, `watch.ps1` passa "non attivare" a `SetWindowPos`.
- **Aspettare un processo che non finisce mai.** `$.process.run` legge tutto l'output; un server avviato senza staccarlo blocca la chiamata fino al suo timeout. Avvialo con `nohup … &` o `Start-Process`.

Per testare, narsil-pet esegue `node tests/overlay-server.check.cjs`. I suoi controlli includono "the page is served with its key, and the key is not a placeholder" (la pagina viene servita con la sua chiave, e la chiave non è un segnaposto), "another host name (a page rebound to this address) is refused everywhere" (un altro nome host, cioè una pagina sottoposta a rebinding verso questo indirizzo, viene rifiutato ovunque), "the page's actions need its key" (le azioni della pagina richiedono la sua chiave), "the mod's state needs its token, as before" (lo stato della mod richiede il suo token, come prima) e "a request path no URL can be made of is refused, and the server keeps answering" (un percorso di richiesta da cui non si può formare un URL viene rifiutato, e il server continua a rispondere). Il lato della mod è coperto in `tests/narsil.test.tsx` da "each state change is pushed to the floating window with its token and session" (ogni cambio di stato viene inviato alla finestra mobile con il suo token e la sua sessione), "an older window server left running is closed and replaced by this version" (un server della finestra più vecchio rimasto in funzione viene chiuso e sostituito da questa versione) e "with the window off, the conversation still reaches the hub: started with no window, and pushed to" (con la finestra disattivata, la conversazione raggiunge comunque l'hub: avviato senza finestra, e con lo stato inviato). Il log dei task annota che nessun test automatico copre lo script della pagina stessa né l'apertura di una vera finestra del browser.

## Per andare oltre

- `openWindow`, `checkWindowGone` e `isProfileRunning` in `overlay/server.cjs` gestiscono il caso in cui Edge passa un avvio a un'istanza già in esecuzione, che altrimenti aprirebbe una seconda finestra (`42aab0c`).
- `kill.ps1` e `running.ps1` trovano i processi del browser tramite la sua cartella del profilo, così il server chiude solo la propria finestra.
- `HEARTBEAT_TIMEOUT_MS` (30 secondi) spegne il server quando nessuna conversazione batte; `ensureOverlay` in `hooks/register.tsx` lo riavvia al massimo una volta al minuto.
- La finestra dei consigli (`overlay/tip.ps1`, `overlay/tip.sh`, `overlay/tip.js`) si apre sopra la finestra mobile usando i limiti che la pagina comunica.
- La tabella "Sistemas compatibles" del README riassume cosa ottiene ogni sistema.
