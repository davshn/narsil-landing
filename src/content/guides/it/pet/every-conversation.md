---
title: Tutte le conversazioni in un solo posto
description: "Come Narsil raccoglie lo stato di ogni conversazione aperta in un hub locale, le ordina partendo dall'errore, le mostra quattro per pagina e dimentica quelle silenziose dopo un'ora."
route: pet
order: 3
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/fleet.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: overlay/server.cjs
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
  - repo: pet
    path: tests/overlay-server.check.cjs
---

## Cosa fa

Se tieni aperte più conversazioni di Claude Code, ognuna ha la sua fascia. Narsil fa in modo che ogni fascia le mostri tutte.

C'è una sola Narsil per tutte le tue conversazioni. Il suo disegno e la sua frase mostrano la più importante, in questo ordine: prima un `ERROR`, poi qualsiasi `TE NECESITA` (ha bisogno di te), poi ciò che è `TRABAJANDO` (al lavoro) e infine ciò che è `TERMINADA` (finito). Quando quella conversazione non è quella che stai guardando, la frase inizia con il suo nome, per esempio "web: Me he detenido por un error" ("web: mi sono fermata per un errore"). Così una conversazione bloccata su una domanda in un'altra finestra compare in quella in cui stai scrivendo.

Sotto di lei, la fascia elenca ogni conversazione, una riga ciascuna: il suo stato, il suo nome e la sua barra del contesto con una percentuale. La conversazione corrente è sempre la prima, e la sua barra è blu perché tu la possa trovare. Le righe arrivano quattro alla volta, con i pulsanti ◂ e ▸ per cambiare pagina ("Conversaciones 1/2").

Premendo il nome di una conversazione la si apre sotto una riga: i suoi task, i suoi subagenti e, dalla sua percentuale, cosa riempie il suo contesto. La prossima guida tratta i task e i subagenti.

Una conversazione che non apri da un po' resta nell'elenco con il suo ultimo stato per un'ora, anche se l'app desktop l'ha messa a dormire. Dopo un'ora senza notizie esce dall'elenco, ed è anche così che spariscono le conversazioni eliminate. Se la riapri, torna subito.

## Come funziona dentro

### Il problema: ogni conversazione è sola

Una mod gira una volta per conversazione. Narsil in una conversazione non può vedere gli atom di Narsil in un'altra. Per mostrare tutte le conversazioni, qualcosa al di fuori di esse deve raccogliere gli stati e restituire l'elenco.

Narsil aveva già qualcosa del genere: il piccolo server locale dietro la sua finestra mobile. Il README dice che ogni conversazione invia il suo stato a "un pequeño servidor local (el de la ventana flotante)" (un piccolo server locale, quello della finestra mobile), che parte con la prima conversazione anche quando la finestra è disattivata. Quel server è l'hub.

### L'hub: uno script Node

`overlay/server.cjs` è un semplice script Node.js, non codice della mod. Usa il modulo `http` di Node, conserva una voce per conversazione in una `Map` chiamata `sessions` e chiama `server.listen(port, '127.0.0.1', ...)`, quindi ascolta solo sull'indirizzo di loopback locale. La porta è `47190` a meno che `NARSIL_PORT` non indichi altro.

Risponde, tra le altre, a:

- **`POST /state`**: una conversazione comunica il suo stato. La voce viene salvata con l'ora di arrivo (`at`) e l'ora dell'ultimo cambiamento di qualcosa di visibile (`changedAt`). I battiti che non cambiano nulla non vengono inoltrati alla pagina della finestra mobile.
- **`GET /sessions`**: l'elenco di tutte le conversazioni attive, dalla più importante, senza i disegni (ogni mod disegna la propria Narsil).

Entrambe richiedono il token della mod nell'header `x-narsil-token`. Il token è un UUID casuale che la mod conserva in `$.store` (`overlayToken` in `hooks/register.tsx`) e passa al server nella variabile d'ambiente `NARSIL_TOKEN` quando lo avvia. Il server controlla anche l'header `Host` e rifiuta qualsiasi nome diverso da `127.0.0.1` e `localhost`. La guida sulla finestra mobile tratta queste protezioni nel dettaglio.

Due timer mantengono l'elenco affidabile:

- `SESSION_FORGET_MS = 60 * 60_000`: `forgetSilent` elimina una conversazione un'ora dopo il suo ultimo battito.
- `HEARTBEAT_TIMEOUT_MS = 30_000`: quando nessuna conversazione ha battuto per 30 secondi, il server si spegne da solo. La conversazione successiva lo riavvia.

### Il lato della mod: un battito

In `session.start`, Narsil avvia l'hub poco dopo l'inizio della sessione (`$.clock.after(10, () => startOverlay($))`) e poi batte ogni due secondi (`$.clock.every(2000, () => beat($))`). `startOverlay` prima interroga il server con un ping; se risponde un server di una versione più vecchia (dice qualcosa di diverso da `narsil 4`), lo ferma e ne avvia uno nuovo. Su Windows lancia `node` con `overlay/server.cjs` tramite `Start-Process` di PowerShell; su macOS esegue `overlay/start.sh`.

Ogni `beat` fa, tra le altre operazioni di manutenzione:

1. `pushOverlay`: `POST /state` con lo stato di questa conversazione, costruito da `shownState` (id, titolo, umore, stato, frase, contesto, task, chip dei subagenti e altro). Il disegno viene inviato solo quando è cambiato; un server che non ne ha nessuno risponde `need-svg`.
2. `readSessions`: `GET /sessions`, ripulito campo per campo e scritto nell'atom `sessions` solo quando è diverso da quello che c'è già.

Ogni cambio di umore chiama anche subito `pushOverlay`, attraverso `setMood`, così l'hub non aspetta il battito successivo.

L'id della conversazione viene dalla variabile d'ambiente `CLAUDE_CODE_HOST_SESSION_ID`, letta in `session.start`. `ownId` la accetta solo quando ha la forma `local_` seguito da lettere, cifre e trattini, e altrimenti usa `local_unknown`. Il link `claude://code/continue` dell'app desktop apre una conversazione tramite quell'id, ed è così che funziona il pulsante "apri" della finestra mobile.

### L'ordinamento: `hooks/fleet.ts`

La logica dell'elenco è un file separato di funzioni pure, `hooks/fleet.ts`, senza eventi e senza `$`. Questo lo rende facile da testare e da condividere tra la fascia e la finestra.

- `RANK` dà a ogni stato il suo posto: `error` 0, `waiting` 1, `working` 2, `done` 3, `idle` 4. Il server usa lo stesso ordine (`PRIORITY` in `overlay/server.cjs`).
- `fleetOf(hub, own)` prende l'elenco dell'hub, sostituisce la voce di questa conversazione con una fresca (la copia dell'hub può essere vecchia di un battito) e ordina per rango, poi per il cambiamento più recente. La prima voce è quella che Narsil indossa.
- `ownFirst(list, ownId)` porta questa conversazione in testa alle righe, qualunque sia il suo stato, così la trovi sempre nello stesso posto.
- `pageOf(list, page)` divide l'elenco in pagine di `FLEET_PAGE = 4` e mantiene il numero di pagina entro i limiti quando le conversazioni arrivano e se ne vanno.
- `fit(text, cells)` taglia o riempie un titolo fino a `TITLE_CELLS` (26) caratteri, così ogni barra del contesto inizia nella stessa colonna.
- `openOf` e `toggleOpen` decidono quale conversazione è aperta. `open: null` significa "questa, per impostazione predefinita"; una stringa vuota significa "nessuna".

Cosa mostra aperto la fascia, su quale pagina si trova e se è visibile la scomposizione del contesto vivono in un altro atom, `view` (`fleetView` in `hooks/register.tsx`), quindi premere ◂ o un nome è solo un `update` di quell'atom.

### Perché è stata presa ogni decisione

- **Errore prima di ha bisogno di te, prima di al lavoro, prima di finito.** La richiesta dell'autore le ordina così (vedi sotto): il disegno è prima di tutto un avviso, quindi ciò che è fallito o ti aspetta viene prima di ciò che è semplicemente occupato.
- **La propria conversazione prima nelle righe, ma non nel disegno.** Il disegno risponde a "dove c'è bisogno di me?"; le righe rispondono a "dov'è questa?". Tenere entrambe le cose permette alla frase di saltare a un'altra conversazione mentre l'elenco resta stabile.
- **Pagine invece dello scorrimento.** La spec S3 del log dei task dice "The band cannot scroll (Box overflow is only visible/hidden): it pages instead." (la fascia non può scorrere, perché l'overflow di Box è solo visible/hidden: invece usa le pagine). I tipi della 2.1.325 ora descrivono la fascia `AbovePrompt` che fa scorrere un albero più alto del suo `maxRows`; Narsil usa ancora le pagine, e la finestra mobile, che è una pagina web, scorre.
- **Un'ora, non 30 secondi e non per sempre.** La cronologia dei commit mostra che la scadenza è stata regolata due volte. `2ce3acb` (2026-11-07) "fix: keep sleeping conversations listed in the hub" (mantiene nell'hub le conversazioni addormentate) spiega che l'app desktop mette a dormire il motore di una conversazione che non apri da un po', quindi i suoi battiti si fermano e l'hub la eliminava dopo 30 secondi. La correzione manteneva ogni conversazione finché il server era in funzione. Poi `570961d` (2026-11-10) "fix: forget conversations silent for an hour in the hub" (dimentica nell'hub le conversazioni silenziose da un'ora) dice che quelle eliminate si accumulavano, e ha scelto un'ora: abbastanza lunga per una conversazione addormentata, abbastanza breve perché una eliminata se ne vada.
- **La copia di te stesso nell'hub viene sostituita.** `fleetOf` e `ownEntry` usano lo stato fresco di questa conversazione, mantenendo il `changedAt` dell'hub solo finché lo stato resta lo stesso, così la tua riga non resta mai indietro di un battito.

## Come è stata chiesta all’IA

Questa funzionalità ha un log pubblico dei task: `odd/tasks/fleet-view.md` in narsil-pet, voci da L1 a L13. Cita le richieste dell'autore parola per parola.

La richiesta originale, L1, datata 2026-11-06:

> "quiero hacerlo en los dos y tambien en la ventana externa, el diseno lo pensamos luego, quisiera poder mostrar todas las sesiones en curso y sus estados, la imagen de narsil solo mostraria lo mas importante error->te necesita-> trabajando--> termine, y las notificaciones se enviarian al celular cuando se pida algo desde el celular como ahora y haya cambios, es decir alguna tarea pase de trabajando a terminado, o de trabajando a error, etc, (eliminariamos la alerta de bucle, no la he sentido tan util) las notificaciones del celular cuando se envien llevarian la info de todas las sesiones funcionando en ese momento, algo asi es mi idea, como lo hacemos? los consejos seguirian funcionando como ahora en cada ventana"

In italiano: l'autore vuole questa funzione in entrambi i posti (la fascia e il desktop) e anche nella finestra mobile esterna, lasciando il design per dopo. Vuole mostrare ogni sessione in corso e il suo stato; l'immagine di Narsil mostrerebbe solo quella più importante, nell'ordine errore, ha bisogno di te, al lavoro, finito. Le notifiche sul telefono partirebbero, come ora, quando una richiesta arriva dal telefono e qualcosa cambia (una conversazione che passa da al lavoro a finito, o da al lavoro a errore); l'avviso di ciclo verrebbe eliminato perché non si è rivelato utile; e ogni notifica sul telefono porterebbe tutte le sessioni in corso in quel momento. L'autore chiude chiedendo come farlo, e dice che i consigli dovrebbero continuare a funzionare come prima in ogni finestra.

Le correzioni che sono seguite, e cosa hanno cambiato:

- **L2** (estratto): "deberiamos ver en la ventana principal tanto en la banda como la ventana externa el estado de todas las conversaciones, con scroll si son muchas, [...] donde ponemos las barras de cada conversacion con su porcentaje de avance y con sus estados? al hacer click en el titulo de conversacion deberiamos poder ver sus sub agentes/ tareas y sus respectivos estados". In italiano: sia la fascia sia la finestra esterna dovrebbero mostrare lo stato di ogni conversazione, con lo scorrimento quando sono molte; l'autore chiede dove mettere la barra di ogni conversazione; e facendo clic sul titolo di una conversazione si dovrebbero vedere i suoi subagenti e task con i loro stati. La stessa voce rimuove la sezione finale delle "conversazioni aperte" e la sezione dei costi, e mantiene la cache. Da qui sono nate le righe, i titoli cliccabili e il dettaglio della conversazione aperta; dato che la fascia non poteva scorrere, lo scorrimento è diventato paginazione.
- **L3**: "entonces otro cambio, me parece bien lo que me dices del contexto, entonces la barra de contexto general tambien se iria por que no existe un contexto general y se reemplazaria por las barras de contexto de cada conversacion, el avance entonces no existe cuando entre a una de esas conversaciones estaria de nuevo su contexto, sus tareas con su estado (no es necesario barra de avance) y sus sub agentes, al clickear aca su contexto veria como se lleno su propio contexto y ya". In italiano: l'autore è d'accordo sul punto del contesto, quindi la barra del contesto generale se ne va, perché un contesto generale non esiste; al suo posto ogni conversazione ha la propria barra. Aprire una conversazione mostra il suo contesto, i suoi task con i loro stati (non serve una barra di avanzamento) e i suoi subagenti, e facendo clic sul suo contesto si vede come quel contesto si è riempito. Questo ha eliminato la barra del contesto generale e ha messo una barra in ogni riga.
- **L4** registra il design concordato: in alto Narsil e la frase della conversazione che conta, i limiti dell'account una sola volta, l'elenco delle conversazioni, una riga che si apre sul suo contesto, i suoi task e i suoi subagenti, e "The band pages 4 rows at a time." (la fascia mostra 4 righe per pagina).
- **Da L6 a L11** registrano ogni task come completato, con le sue prove. L6 descrive l'hub: ora il server parte con ogni conversazione, con o senza finestra, e `GET /sessions` (solo con token) elenca tutte le conversazioni attive, "error first, then waiting, working, done, idle" (prima l'errore, poi in attesa, al lavoro, finito, ferma).
- **L12** e **L13** segnalano e correggono un bug negli stati dei task, trattato nella prossima guida.

La scadenza di un'ora non faceva parte del log; è arrivata dopo, nei due commit descritti sopra.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> La mia mod di Claude Code `my-pet` mostra lo stato di una conversazione nella fascia `AbovePrompt`. Falle mostrare tutte le conversazioni aperte. Scrivi un piccolo hub in Node.js (`hub.cjs`) che ascolti solo su 127.0.0.1, accetti `POST /state` e serva `GET /sessions`, entrambi protetti da un token casuale che la mod conserva in `$.store`, e che dimentichi una conversazione un'ora dopo la sua ultima comunicazione. Nella mod, comunica lo stato di questa conversazione ogni due secondi con `$.clock.every` e `$.http.fetch`, rileggi l'elenco in un atom e tieni l'ordinamento e la paginazione come funzioni pure in `hooks/fleet.ts`: errore, poi in attesa, poi al lavoro, poi finito, poi ferma, dal cambiamento più recente, quattro righe per pagina. Disegna in alto lo stato della conversazione più importante e sotto le righe, con questa conversazione per prima. Aggiungi test per l'ordinamento, la paginazione e la scadenza.

## Il codice minimo

Scritto per questa guida. L'ordinamento e la paginazione sono adattati da `hooks/fleet.ts`, e la scadenza e l'ordine dell'hub da `overlay/server.cjs`, entrambi in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later).

La parte pura, `hooks/fleet.ts`:

```ts
import type { Entry, Status } from '../types' // Entry: { sessionId: string; status: Status; headline: string; changedAt: number }

export const PAGE = 4
const RANK: Record<Status, number> = { error: 0, waiting: 1, working: 2, done: 3, idle: 4 }

export function ranked(hub: readonly Entry[], own: Entry): Entry[] {
  return [own, ...hub.filter((s) => s.sessionId !== own.sessionId)].sort(
    (a, b) => RANK[a.status] - RANK[b.status] || b.changedAt - a.changedAt,
  )
}

export function pageOf(list: readonly Entry[], page: number) {
  const pages = Math.max(1, Math.ceil(list.length / PAGE))
  const at = Math.min(Math.max(0, page), pages - 1)
  return { rows: list.slice(at * PAGE, (at + 1) * PAGE), page: at, pages }
}
```

Il battito della mod, in `hooks/register.tsx` (l'atom `fleet` contiene l'elenco dell'hub ed è dichiarato in `types/index.d.ts`; `ownEntry` costruisce la voce di questa conversazione dal tuo atom di stato):

```ts
const HUB = 'http://127.0.0.1:47191'

async function token($: EngineInterface): Promise<string> {
  const saved = await $.store.get('hubToken')
  if (typeof saved === 'string' && saved) return saved
  const fresh = crypto.randomUUID()
  await $.store.set('hubToken', fresh)
  return fresh
}

async function beat($: EngineInterface): Promise<void> {
  const headers = { 'content-type': 'application/json', 'x-my-pet-token': await token($) }
  try {
    await $.http.fetch(`${HUB}/state`, {
      method: 'POST',
      headers,
      body: JSON.stringify(await ownEntry($)),
    })
    const { ok, text } = await $.http.fetch(`${HUB}/sessions`, { headers })
    if (ok) await update($, fleet, () => JSON.parse(text))
  } catch {
    // the hub is out of reach: keep the last list
  }
}

// in register:
on('session.start', async ($, e, next) => {
  $.clock.every(2000, () => beat($))
  return next(e)
})
```

Per l'id in `ownEntry`, `$.session.id()` restituisce l'id della sessione (il nome del file della trascrizione). Narsil usa invece `CLAUDE_CODE_HOST_SESSION_ID` perché ha bisogno dell'id `local_` dell'app desktop per aprire la conversazione da un link.

L'hub, `overlay/hub.cjs`, è semplice Node.js, non API delle mod. La mod lo avvia con `$.process.run`, passando il token come `MY_PET_TOKEN` in `env`; lo `startOverlay` di Narsil mostra come lanciarlo staccato su Windows e macOS.

```js
'use strict'
const http = require('http')
const token = process.env.MY_PET_TOKEN || ''
const RANK = { error: 0, waiting: 1, working: 2, done: 3, idle: 4 }
const FORGET_MS = 60 * 60_000
const sessions = new Map()

http
  .createServer((req, res) => {
    if (!token || req.headers['x-my-pet-token'] !== token) return res.writeHead(403).end()
    if (req.method === 'GET' && req.url === '/sessions') {
      const now = Date.now()
      for (const [id, s] of sessions) if (now - s.at > FORGET_MS) sessions.delete(id)
      const list = [...sessions.values()].sort(
        (a, b) => (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9) || b.changedAt - a.changedAt,
      )
      return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(list))
    }
    if (req.method !== 'POST' || req.url !== '/state') return res.writeHead(404).end()
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 100_000) req.destroy()
    })
    req.on('end', () => {
      try {
        const s = JSON.parse(body)
        const before = sessions.get(String(s.sessionId))
        const changedAt = before && before.status === s.status ? before.changedAt : Date.now()
        sessions.set(String(s.sessionId), { ...s, at: Date.now(), changedAt })
        res.writeHead(204).end()
      } catch {
        res.writeHead(400).end()
      }
    })
  })
  .listen(47191, '127.0.0.1')
```

Questo schizzo tralascia ciò che aggiunge il server vero: il controllo di `Host`, lo spegnimento quando tutte le conversazioni sono silenziose e la finestra mobile. Non allargare `'127.0.0.1'` a tutte le interfacce; la guida successiva sulla finestra mobile spiega perché esiste ogni protezione.

## Errori comuni e come testarlo

- **Eliminare le conversazioni addormentate.** L'app desktop ferma il motore di una conversazione che non apri da un po', quindi i suoi battiti si fermano anche se la conversazione esiste ancora. Un timeout breve svuota il tuo elenco (`2ce3acb`).
- **Non dimenticare mai.** Mantenere ogni conversazione finché l'hub è in funzione riempie l'elenco di quelle eliminate (`570961d`). Falle scadere in base al tempo trascorso dall'ultimo battito, e lascia che il primo nuovo battito le rimetta in elenco.
- **Mostrare la propria conversazione con un battito di ritardo.** La copia dell'hub è vecchia fino a un battito. Unisci la tua voce fresca prima di ordinare, come fa `fleetOf`.
- **Una pagina che non esiste più.** Quando le conversazioni se ne vanno, la pagina salvata può puntare oltre la fine. Riportala entro i limiti, come fa `pageOf`.
- **Riscrivere l'atom a ogni battito.** Ogni `update` ridisegna la fascia. Narsil confronta il nuovo elenco con quello vecchio e scrive solo se c'è una differenza.
- **Lanciare un errore quando l'hub è giù.** Un `$.http.fetch` fallito non deve rompere la mod. Narsil lo intercetta, conserva l'ultimo elenco e prova a riavviare l'hub al massimo una volta al minuto (`ensureOverlay`).
- **Un hub vecchio che risponde a una mod nuova.** Il server sopravvive agli aggiornamenti della mod. Il `/ping` di Narsil risponde con una stringa di protocollo (`narsil 4`), e la mod sostituisce un server che ne risponde un'altra.
- **Più terminali senza un id dell'host.** `ownId` ripiega su `local_unknown` quando `CLAUDE_CODE_HOST_SESSION_ID` manca o non corrisponde, e il server fa lo stesso, quindi queste conversazioni condividono una sola voce.

Per testare la mod, `claude plugin test .` esegue `tests/narsil.test.tsx`, che fornisce un hub fittizio attraverso un `$.http.fetch` simulato. Guarda "the band lists every open conversation with its state and context, and Narsil wears the most important" (la fascia elenca ogni conversazione aperta con il suo stato e il suo contesto, e Narsil indossa la più importante) e "the band pages through many conversations, four at a time" (la fascia sfoglia molte conversazioni, quattro alla volta), che preme il pulsante `page-next` e verifica "Conversaciones 2/2". Per testare il server, `node tests/overlay-server.check.cjs` avvia lo script vero e verifica, tra gli altri, "every conversation is served to the mods alone, the most important first, without drawings" (ogni conversazione viene servita solo alle mod, la più importante per prima, senza disegni) e "a conversation that stops beating stays listed for an hour, then goes until it beats again" (una conversazione che smette di battere resta in elenco per un'ora, poi se ne va finché non batte di nuovo), che porta avanti `Date.now` di 59 e 61 minuti.

## Per andare oltre

- `hooks/fleet.ts` ha anche `countOfStates`, che `/narsil estado` usa per dire quante conversazioni ci sono in ogni stato.
- L'hook `ui.render` su `AbovePrompt` in `hooks/register.tsx` disegna le righe: una colonna dello stato a larghezza fissa, il titolo come `Button` che chiama `toggleOpen`, `textBar` per il contesto, la percentuale come pulsante per la conversazione aperta e l'orologio della cache. Finché ci sono prossimi passi proposti, tutte le righe partono chiuse perché i passi si vedano; aprendo una riga i passi si nascondono, e tornano quando richiudi tutte le righe.
- `shownState` è la voce completa che ogni conversazione comunica; `readSessions` mostra come validare campo per campo ciò che torna dall'hub.
- `overlay/server.cjs` trasmette anche l'elenco alla finestra mobile tramite server-sent events (`GET /events`), apre la finestra quando un evento ti aspetta e serve la sua pagina. Se ne occupa la guida sulla finestra mobile.
- Gli avvisi sul telefono usano lo stesso elenco: `fleetNow` e `fleetText` chiudono ogni avviso con tutte le conversazioni aperte e il loro stato.
