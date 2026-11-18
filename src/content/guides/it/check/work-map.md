---
title: La mappa del lavoro
description: 'Come Narsil Check disegna una mappa animata e in diretta di ciò che fa Claude, con la piccola Narsil al centro, senza mai far aspettare uno strumento né mostrare ciò che hai scritto.'
route: check
order: 2
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/map/hooks.ts
  - repo: check
    path: hooks/map/board.ts
  - repo: check
    path: hooks/map/classify.ts
  - repo: check
    path: hooks/map/draw.ts
  - repo: check
    path: hooks/map/stations.ts
  - repo: check
    path: hooks/map/words.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: tests/map-pane.test.tsx
  - repo: check
    path: odd/tasks/work-map.md
---

## Cosa fa

La prima sezione del pannello è **Mapa mental** ("Mappa mentale"): un'immagine in diretta di ciò che Claude sta facendo nella sessione. La piccola Narsil sta al centro, nella versione chiara o scura secondo il tema dell'app. Intorno ci sono dieci stazioni, una per tipo di lavoro:

| Stazione      | In italiano | Cosa arriva lì                                            |
| ------------- | ----------- | --------------------------------------------------------- |
| **Tú**        | Tu          | I tuoi messaggi, e ogni risposta pronta                   |
| **Modelo**    | Modello     | Ogni passo del modello, e un cambio di modello            |
| **Memoria**   | Memoria     | I file nella cartella di memoria di Claude Code           |
| **Archivos**  | File        | Read, Write, Edit, Grep, Glob e i comandi sui file        |
| **Terminal**  | Terminale   | Comandi di shell, PowerShell e monitor                    |
| **Red**       | Rete        | Download e ricerche web, e i comandi che vanno in rete    |
| **Navegador** | Browser     | Gli strumenti del browser                                 |
| **Agentes**   | Agenti      | Subagenti, workflow e lavoro in background                |
| **Skills**    | Skill       | Skill, comandi con barra e ricerche di strumenti          |
| **Hooks**     | Hook        | Hook delle impostazioni che rifiutano, chiedono o tardano |

Ogni chiamata a uno strumento parte da Narsil come un impulso verso la sua stazione. La stazione si accende mentre lavora e mostra quante volte è stata usata. Intorno a questo, la mappa mostra:

- **Raggi** che si ispessiscono con l'uso, e **un percorso** che unisce le ultime stazioni visitate e sbiadisce col tempo.
- **Due lancette** intorno a una stazione la cui chiamata sta durando a lungo.
- **Un punto rosso** su una stazione dopo un errore o un rifiuto di un hook, fino al tuo messaggio successivo.
- **Un anello** intorno a Narsil che si riempie con il contesto in uso: ambra al 70% e rosso al 90%. Sotto, il modello e la percentuale.
- **I subagenti** ancora al lavoro, che girano intorno ad **Agentes**.
- **Un'attività in background** (un comando, un monitor o un agente lanciato a parte) che resta accesa finché non avvisa di aver finito. Se in un'ora non avvisa, viene chiusa alla fine di un turno.

Il punto della sezione è blu mentre qualcosa lavora, rosso se qualcosa è fallito e verde a riposo. Nel terminale, che non disegna SVG, la sezione non compare.

La mappa viene da [lot-map](https://github.com/alexeyw/lot-map), di Aleksei Volodin (licenza MIT), adattata ai colori di Narsil. Narsil Check la cita nel suo README e conserva l'avviso di copyright e di permesso di lot-map in `hooks/map/LICENSE-lot-map.txt`.

## Come funziona dentro

La mappa vive in `hooks/map/`, in quattro parti: `classify.ts` decide a quale stazione va una chiamata, `board.ts` conserva ciò che è successo, `hooks.ts` ascolta gli eventi e `draw.ts` trasforma la tavola in un SVG. `hooks/register.tsx` aggiunge la sezione al pannello.

### Ogni chiamata va a una stazione, solo per nome

`classify(tool, input, setup)` legge il nome dello strumento e il suo input, e restituisce una stazione e un'etichetta. La maggior parte degli strumenti è un caso diretto: `Read`, `Write` e `Edit` vanno in **Archivos**, `WebFetch` in **Red**, `Agent` in **Agentes**, `Skill` in **Skills**. Un file sotto `.claude/projects/<progetto>/memory/` va invece in **Memoria**.

I comandi di shell richiedono più lavoro, perché lo strumento è sempre `Bash` ma il lavoro no. `classifyShell` legge la prima parola del comando, guarda attraverso gli involucri (`sudo`, `env`, `timeout`, `nohup` e simili eseguono un altro comando, ed è quello che conta), e poi decide: `cat`, `grep` o `mv` lavorano sui file, `curl`, `ssh` o `gh` vanno in rete, e alcuni programmi vanno in rete solo con certi sottocomandi (`git push` sì, `git status` no; `npm install` sì, `npm test` no).

L'etichetta è ciò che la mappa mostra accanto alla stazione, e porta solo nomi:

- di un file, le ultime due parti del percorso (`src/app.ts`),
- di una pagina web, solo l'host, mai il percorso, la query o un login (`hostOf` legge `user:pa/ss@host` come `host`),
- di un comando, la sua `description`, altrimenti il suo nome,
- di una ricerca web, le parole `búsqueda web`, mai la query.

`clean` toglie anche da ogni etichetta i caratteri di controllo e i segni di direzione, così un nome di file non può spostare il cursore né invertire il testo. Un test porta il nome di questa regola: "labels never carry what was written, searched or a password" ("le etichette non portano mai ciò che è stato scritto, cercato o una password").

### La tavola: un atom, e una copia per disegnare

Ciò che la mappa mostra è un `MapBoard` (in `types/index.d.ts`): una lista di voci, un conteggio per stazione, il modello e il passo, la percentuale di contesto, i guasti per stazione e i subagenti ancora al lavoro. Ogni voce ha una stazione, un'etichetta, un inizio e una fine, e uno stato: `run`, `ok`, `err` o `block`.

La tavola è un atom della sessione, `board`, scritto da quattro piccole funzioni di `board.ts`: `begin` apre una voce, `finish` la chiude, `background` la tiene aperta con l'id di un'attività, e `settle` la chiude quando quell'attività avvisa. La tavola tiene le 80 voci più recenti, più fino a 16 attività in background più vecchie ancora in corso.

Il pannello non legge `board`. Legge `mapView`, una copia fatta al massimo ogni 400 ms:

```ts
async function redraw($: EngineInterface): Promise<void> {
  if (isRedrawPending) return
  isRedrawPending = true
  try {
    await $.clock.sleep(REDRAW_MS)
  } catch {
    // No clock: copy now.
  } finally {
    isRedrawPending = false
  }
  const current = await read($, board)
  await update($, shown, () => current)
}
```

Perché? Ogni ridisegno invia all'app l'SVG intero, con le due immagini di Narsil. Una raffica di venti chiamate sarebbe venti ridisegni. Con la copia, la prima scrittura avvia un'attesa di 400 ms, il resto della raffica cambia solo `board`, e una sola copia alla fine le disegna tutte. Il test "a burst of calls is one redraw of the map, made once the wait is over" lo verifica.

### La mappa non fa mai aspettare uno strumento

È la regola su cui la revisione ha insistito. La mappa ascolta `tool.call`, che avvolge ogni strumento. Se aspettasse le proprie scritture prima di chiamare `next(e)`, ogni strumento aspetterebbe la mappa. Per questo la voce viene scritta accanto alla chiamata, non prima:

```ts
export async function mapToolCall($, e, next) {
  const started = quietly(async () => {
    const seen = classify(e.tool, e, SETUP)
    return begin($, { ...seen, from: e.agentId === undefined ? 'core' : 'agents' })
  })
  const close = (how) => {
    void started.then(how).catch(() => undefined)
  }
  try {
    const ran = await next(e)
    // ...refused, failed, sent to the background, or ok
    close((id) => finish($, id, ran.isError === true ? 'err' : 'ok'))
    return ran
  } catch (failure) {
    close((id) => finish($, id, 'err'))
    throw failure
  }
}
```

`next(e)` parte subito. La voce si chiude quando la chiamata e la scrittura sono finite, e anche la chiusura non viene attesa. `quietly` avvolge ogni scrittura: qualunque cosa vada storta sulla mappa restituisce `undefined` e non raggiunge mai lo strumento, il turno o la conversazione. Ogni hook passa il suo evento senza modifiche, quindi la mappa non altera mai un input, un risultato o una decisione sui permessi.

Lo stesso vale per `classic.PreToolUse`: la decisione degli hook delle impostazioni viene restituita appena presa, e la mappa scrive la sua voce dopo. Un controllo durato meno di 400 ms non viene disegnato.

### Tre eventi condivisi con il resto del pannello

Il motore rifiuta un secondo `on()` dello stesso evento senza filtro nello stesso modulo. Narsil Check ascoltava già `turn.start`, `tool.call` e `turn.complete`. Così la mappa esporta quei tre come funzioni, `mapTurnStart`, `mapToolCall` e `mapTurnComplete`, e `register.tsx` chiama ognuna al posto di `next(e)`:

```tsx
on('tool.call', async ($, e, next) => {
  // ...what the pane already tracked
  return mapToolCall($, e, next)
})
```

Ogni altro evento che serve alla mappa (`turn.step`, `classic.PreToolUse`, `prompt.submit`, `skill.prompt`, `session.compact`, e gli hook delle impostazioni che aggiungono contesto) si registra in `registerMap(on)`, che `register` chiama per primo.

### Guasti, turni e attività in background

- Un tuo **nuovo messaggio** cancella i guasti: i punti rossi riguardano la strada verso l'ultima risposta.
- Un **turno interrotto** cade su **Tú** e non è colpa di niente. Chiude anche le chiamate che non hanno mai avvisato, così non pulsano per il resto della sessione.
- Una chiamata la cui risposta avvia **lavoro in background** (`backgroundTaskId`, o un agente con `status: 'async_launched'`) resta aperta con l'id di quell'attività. `taskNotice` legge l'avviso dell'attività solo per il suo id e il suo stato, mai il riepilogo o l'output, e `settle` chiude la voce.
- Un **subagente** entra nella lista `agents` con la sua prima chiamata e ne esce quando arriva il suo `turn.complete`.

### Il disegno: un SVG, con la piccola Narsil al centro

`drawMap(board, now, narsil)` restituisce una stringa SVG. La sua animazione è SMIL dentro l'SVG (`<animate>` con tempi di inizio relativi a `now`), così il disegno si muove tra un ridisegno e l'altro senza aiuto della mod. È disegnato con la tavolozza scura, e una regola `prefers-color-scheme: light` dentro l'SVG ridipinge ogni colore, così la mappa segue da sola il tema dell'app, come faceva l'immagine di Narsil.

L'elemento `Svg` accetta al massimo 131072 caratteri, e le due immagini di Narsil ne occupano circa 88 KB. `drawMap` misura la lunghezza: se le immagini porterebbero il disegno oltre il limite, ridisegna la mappa con `NARSIL` scritto al centro. La mappa compare sempre. Il test "the map at its fullest, with baby Narsil, stays within what Svg accepts" disegna la tavola più piena possibile.

Per chi non può vederla, `describeMap` fornisce il testo `alt`: la sezione, ciò che è in corso e il contesto, per esempio `Mapa mental. Archivos: src/app.ts · contexto 13%`.

Nel pannello, la sezione si disegna solo quando la superficie ha `Svg` e non è il terminale. Si apre all'inizio di ogni sessione, e `resetMap()` dimentica i rifiuti e l'ultimo modello della sessione precedente.

## Costruiscila con Claude

Chiedi a Claude una mappa del lavoro della sessione come sezione del pannello. Le due idee che deve azzeccare sono che la mappa non fa mai aspettare uno strumento, e che mostra nomi, mai contenuti.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nella mia mod di Claude Code `my-panel`, aggiungi una prima sezione, `Map`, che disegni ciò che Claude fa in questa sessione come un solo SVG: un nucleo al centro e stazioni intorno (tu, modello, memoria, file, shell, rete, browser, agenti, skill, hook). Classifica ogni `tool.call` in una stazione con un'etichetta che porti solo nomi: le ultime due parti del percorso di un file, l'host di un URL, la descrizione di un comando. Tieni la tavola in un atom della sessione (voci con stazione, etichetta, inizio, fine e stato `run`, `ok`, `err` o `block`, un conteggio per stazione, guasti per stazione) e fai leggere al pannello una copia fatta al massimo ogni 400 ms. Lo strumento non deve mai aspettare la mappa: avvia `next(e)` subito, scrivi la voce accanto e avvolgi ogni scrittura perché un errore non raggiunga mai lo strumento. Anima con SMIL dentro l'SVG, segui il tema dell'app con una regola `prefers-color-scheme`, tieni l'SVG sotto i 131072 caratteri e lascia fuori la sezione nel terminale. Testa che una chiamata non aspetta la tavola, che una raffica di chiamate è un solo ridisegno e che nessuna etichetta contiene una query, un percorso di più di due parti o una password.

### Cosa controllare nella risposta di Claude

1. `next(e)` viene chiamato prima di attendere la scrittura della mappa, e nessuna scrittura della mappa viene attesa sul percorso dello strumento.
2. Ogni scrittura della mappa è avvolta in modo da ingoiare gli errori, e ogni hook restituisce il risultato del suo evento senza modifiche.
3. Le etichette sono nomi: due parti di percorso, un host, una descrizione. Non compaiono query di ricerca, percorsi di pagine né il testo dei comandi.
4. Il pannello legge una copia limitata della tavola, non la tavola stessa.
5. La lunghezza dell'SVG viene confrontata con il limite di `Svg`, con un'alternativa più piccola.
6. La sezione non compare dove manca `Svg` o la superficie è il terminale.

Se un controllo fallisce, di' a Claude cosa vedi: "con la mappa attiva, una lettura lenta di un file ha rallentato tutte le chiamate" oppure "la mappa ha mostrato la mia ricerca intera accanto a Red".

### Come l'ha chiesta l'autore

Il registro dell'attività, `odd/tasks/work-map.md` in narsil-check, cita le richieste parola per parola. Erano in spagnolo; la traduzione segue ciascuna.

Per prima cosa l'autore ha mostrato lot-map a Claude:

> "mira este mod, quisiera traer la funcionalidad aca, como lo ves? https://github.com/alexeyw/lot-map"

("Guarda questa mod, vorrei portare qui la sua funzionalità, come la vedi?") Claude ha proposto parti che Narsil aveva già, e l'autore ha ristretto:

> "lo que propones traer ya lo tengo en narsilPet, me interesa traer es el mapa animado"

("Quello che proponi di portare ce l'ho già in narsilPet; quello che mi interessa portare è la mappa animata.") Poi ha accettato il piano e ha deciso dove va la sezione:

> "sí, avanza con ese plan, la seccion mapa va a ir de primeras, quita la imagen de narsil bebe y ponlo ahi, ya que es la misma imagen que ira creo que sera un buen reemplazo"

("Sì, vai avanti con quel piano. La sezione mappa va per prima; togli l'immagine della piccola Narsil e mettila lì, visto che è la stessa immagine che andrà lì, credo che sarà un buon sostituto.")

Una revisione della prima versione ha lasciato cinque avvisi: il pannello ridisegnava l'SVG intero a ogni scrittura, lo strumento aspettava la mappa, un percorso morto per il movimento ridotto, percorsi di guasti e di attività non testati, e voci in background che non scadevano mai. La risposta dell'autore è stata "Sí, corrígelos" ("Sì, correggili"). I commit sul branch della funzionalità mostrano l'ordine:

- `bcae0da` "feat(map): classify Claude's work into the work map's stations".
- `e8b29dd` "feat(map): add the animated work map as the pane's first section".
- `4ee05ed` "fix(map): keep the work map off the tool's path and its redraws bounded".
- `1c6677c` "feat(map): larger, higher-contrast work map named Mapa mental".

Il commit della correzione, `4ee05ed`, è il più istruttivo. La prima versione funzionava e i suoi test passavano. La revisione ha chiesto quanto costa la mappa al resto della sessione, e la risposta è stata una copia limitata e uno strumento che non aspetta mai.

Dopo aver provato la versione 1.12.0, l'autore ha chiesto una mappa più leggibile:

> "las esferas deberian ser mas grandes al igual que el texto, o tener mas contraste ya que no se ve claramente lo que dice, narsil bebe tambien podria ser algo mas grande"

("Le sfere dovrebbero essere più grandi, come il testo, o avere più contrasto, perché non si legge chiaramente cosa dice; anche la piccola Narsil potrebbe essere un po' più grande.") E poi: "y al mapa ponle mapa mental" ("e chiama la mappa mappa mentale"). È `1c6677c`: stazioni, nomi e conteggi più grandi, colori delle etichette con più contrasto in ogni tema, una piccola Narsil più grande su un azzurro tenue, e la sezione rinominata **Mapa mental**.

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida. Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

È una versione ridotta di `hooks/map/board.ts` e `hooks/map/hooks.ts` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later), che adattano [lot-map](https://github.com/alexeyw/lot-map) (MIT, Copyright © 2026 Aleksei Volodin). È verificata con i tipi di Claude Code 2.1.325 (`atom`, `read`, `update`, `$.clock.now`, `$.clock.sleep`, l'hook `tool.call`). Tiene una sola regola di stazione e lascia fuori il disegno, i guasti e le attività in background.

```ts
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

type Status = 'run' | 'ok' | 'err' | 'block'
type Entry = {
  id: string
  station: string
  label: string
  startedAt: number
  endedAt?: number
  status: Status
}
type Board = { entries: Entry[]; counts: Record<string, number> }

const EMPTY: Board = { entries: [], counts: {} }
const board = atom({ plugin: 'my-panel', key: 'board' } as const, EMPTY, { shape: 'board-1' })
const shown = atom({ plugin: 'my-panel', key: 'mapView' } as const, EMPTY, { shape: 'board-1' })

async function quietly<T>(work: () => Promise<T>): Promise<T | undefined> {
  try {
    return await work()
  } catch {
    return undefined
  }
}

let isRedrawPending = false
async function redraw($: EngineInterface): Promise<void> {
  if (isRedrawPending) return
  isRedrawPending = true
  try {
    await $.clock.sleep(400)
  } catch {
    // No clock: copy now.
  } finally {
    isRedrawPending = false
  }
  const current = await read($, board)
  await update($, shown, () => current)
}

async function write($: EngineInterface, by: (b: Board) => Board): Promise<void> {
  await update($, board, by)
  void redraw($).catch(() => undefined)
}

const lastTwo = (path: string): string =>
  path.replace(/\\/g, '/').split('/').filter(Boolean).slice(-2).join('/')

function classify(
  tool: string,
  input: Record<string, unknown>,
): { station: string; label: string } {
  const path = typeof input.file_path === 'string' ? input.file_path : ''
  if (tool === 'Read' || tool === 'Write' || tool === 'Edit')
    return { station: 'files', label: lastTwo(path) || tool }
  if (tool === 'WebSearch') return { station: 'web', label: 'web search' }
  return { station: 'model', label: tool }
}

export const register: Register = (on) => {
  on('tool.call', async ($, e, next) => {
    const started = quietly(async () => {
      const now = await $.clock.now()
      const entry: Entry = {
        id: `${now}-${Math.random()}`,
        ...classify(e.tool, e as Record<string, unknown>),
        startedAt: now,
        status: 'run',
      }
      await write($, (b) => ({
        entries: [...b.entries, entry].slice(-80),
        counts: { ...b.counts, [entry.station]: (b.counts[entry.station] ?? 0) + 1 },
      }))
      return entry.id
    })
    const close = (status: Status): void => {
      void started
        .then((id) =>
          quietly(async () => {
            const now = await $.clock.now()
            await write($, (b) => ({
              ...b,
              entries: b.entries.map((x) => (x.id === id ? { ...x, status, endedAt: now } : x)),
            }))
          }),
        )
        .catch(() => undefined)
    }
    try {
      const ran = await next(e)
      close(ran.deny !== undefined ? 'block' : ran.isError === true ? 'err' : 'ok')
      return ran
    } catch (failure) {
      close('err')
      throw failure
    }
  })
}
```

Il pannello legge `shown` con `read($, shown)` e lo disegna con `Svg` solo quando la superficie ce l'ha e non è il terminale.

## Errori comuni e come testarlo

Vengono dal codice di Narsil Check, dalla sua revisione e dai suoi test:

- **Attendere la mappa prima dello strumento.** Ogni chiamata rallenta. Avvia `next(e)` per primo e scrivi accanto.
- **Lasciar sfuggire un errore della mappa.** Una scrittura fallita farebbe fallire lo strumento. Avvolgi ogni scrittura.
- **Ridisegnare a ogni scrittura.** Una raffica di chiamate diventa una raffica di SVG grandi. Limita una copia.
- **Mostrare contenuti.** Una ricerca, il percorso di un URL o una riga di comando possono contenere segreti. Mostra solo nomi e pulisci i caratteri di controllo.
- **Chiamate che non si chiudono mai.** Un turno interrotto o un avviso perso lasciano una voce che pulsa per sempre. Chiudile alla fine del turno e fai scadere le vecchie attività in background.
- **Registrare un evento due volte in un modulo.** Il motore lo rifiuta. Chiama la funzione della mappa dall'hook che esiste già.
- **Dimenticare il limite di `Svg`.** Le immagini incorporate pesano. Misura, e prevedi un'alternativa.

Per testare, `claude plugin test .` esegue i test della mod. `tests/map.test.tsx` copre le parti pure: "every kind of call lands on its station", "a command behind a wrapper or inside another is the command it runs" e "labels never carry what was written, searched or a password". `tests/map-pane.test.tsx` guida gli hook: "a tool never waits on the map", "a burst of calls is one redraw of the map, made once the wait is over", "a refused call turns the map red with a dot on its station, and the next message clears it" e "a background task that never reports back is closed at the end of a turn once it is an hour old". In `tests/pane.test.tsx`, "the work map is the first section, open, with baby Narsil at its core; the terminal draws neither" verifica il posto della sezione.

## Per andare oltre

- Lascia che ognuno nomini i propri server o comandi di memoria: `hooks/map/stations.ts` conserva la configurazione di lot-map, con tutte le liste vuote.
- Porta l'elenco di righe di lot-map, una lista testuale delle ultime azioni, per il terminale, dove l'SVG non si disegna.
- Aggiungi uno zoom o un filtro per stazione, che lot-map ha e questo adattamento ha lasciato fuori.
