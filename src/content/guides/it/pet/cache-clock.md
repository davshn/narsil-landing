---
title: L'orologio della cache
description: "Come Narsil conta alla rovescia la cache del prompt dall'inizio dell'ultima richiesta, 60 minuti con un abbonamento e 5 con una chiave API, e perché il turno dopo costa di più quando è fredda."
route: pet
order: 8
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: hooks/usage.ts
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Cosa fa

Quando un turno finisce e Claude ti aspetta, Narsil mostra un piccolo orologio nella riga della conversazione:

```text
🧊 Caché: 42 min
```

Conta alla rovescia, minuto per minuto, quanto dovrebbe durare la cache del prompt di questa conversazione. Quando arriva a zero lo dice: nella fascia, "🧊 Caché fría" ("cache fredda"), e nella finestra mobile e nell'hub, la frase completa "🧊 Caché fría: el próximo mensaje se cobra completo" ("cache fredda: il prossimo messaggio viene addebitato per intero"). Quando invii il prompt successivo l'orologio se ne va, dato che Claude sta di nuovo lavorando, e ne parte uno nuovo quando quel turno finisce.

Perché ti interessa: ogni messaggio che invii fa rileggere a Claude l'intera conversazione. La cache del prompt conserva la parte già inviata, quindi una risposta entro la sua durata la riutilizza. Come dice il README, il messaggio allora costa meno; una volta scaduta la cache, il messaggio successivo viene addebitato per intero, e la conversazione deve essere scritta di nuovo nella cache. I tipi della 2.1.325 descrivono quella riscrittura, in un altro contesto, come "waited for, the longer the conversation the longer" (da attendere, tanto più a lungo quanto più lunga è la conversazione). Quindi l'orologio risponde a una domanda pratica: se torni ora a questa conversazione, è ancora calda?

L'orologio presume 60 minuti con un piano in abbonamento e 5 minuti con una chiave API. `/narsil cache` dice quanto sta contando; `/narsil cache 30` lo imposta a mano, e `/narsil cache auto` torna a decidere in base al tuo account.

La riga di ogni conversazione mostra il proprio orologio, così puoi vedere quali conversazioni sono ancora calde prima di riprenderne una.

## Come funziona dentro

### Non un timer: un valore e un battito

L'orologio è un atom, `cache`, in `hooks/register.tsx`. Contiene quattro numeri:

- `at`: quando è finito il turno.
- `requestAt`: quando è iniziata l'ultima richiesta al modello del turno.
- `minutes`: quanto dura la cache.
- `left`: i minuti interi rimasti, così come vengono mostrati.

Niente conta alla rovescia da solo. A ogni battito di due secondi, `tickCache` ricalcola `left` con `cacheLeft` da `hooks/words.ts`:

```ts
export function cacheLeft(at: number, minutes: number, now: number): number {
  return Math.max(0, Math.ceil((at + minutes * 60_000 - now) / 60_000))
}
```

Scrive l'atom solo quando il numero di minuti è cambiato, così la fascia si ridisegna una volta al minuto, non ogni due secondi. Arrotondare per eccesso significa che "1 min" resta finché non è passato l'ultimo secondo, e zero significa che la cache è davvero finita.

### Quando parte e quando si ferma

Tre eventi lo guidano:

- **`turn.step`** scatta quando il motore sta per inviare una richiesta al modello. Per la conversazione principale (`e.agentId === undefined`), Narsil registra l'ora in `lastRequestAt`. Le richieste di un subagente restano fuori: come dice il commento, le richieste di un subagente hanno una cache propria.
- **`turn.complete`** per la conversazione principale chiama `startCache`, che scrive l'atom con `at` impostato su adesso e `requestAt` impostato su `lastRequestAt`.
- **`turn.start`** svuota l'atom: mentre Claude lavora, non c'è nessun orologio.

### Perché dall'inizio dell'ultima richiesta

L'orologio conta da quando è iniziata l'ultima richiesta, non da quando è finito il turno. L'helper `cacheStart` spiega perché nel suo commento: "the API counts it from the start of the request that last read or wrote it" (l'API la conta dall'inizio della richiesta che l'ha letta o scritta per ultima). Una risposta lunga che ha richiesto tre minuti per essere scritta ha già consumato tre dei minuti della cache quando il turno finisce.

Questa è stata una correzione, `c3e4464`, e il test che la fissa si legge come la spiegazione: con una cache di cinque minuti e tre minuti spesi mentre il modello rispondeva, la fascia mostra "🧊 Caché: 2 min" alla fine del turno, non cinque.

I prossimi passi che Narsil propone dopo un turno tranquillo contano ancora dalla fine del turno (`at`): riguardano il fatto che tu sia via, non la cache.

### Decidere tra 60 e 5 minuti

Quanto dura la cache non è qualcosa che la mod possa leggere. Lo dice il commento sopra le costanti:

```tsx
// How long the prompt cache lasts, in minutes: on a plan Claude Code keeps it
// an hour, with an API key five minutes. The API does not say which: a
// person who knows better sets it with /narsil cache.
const PLAN_CACHE_MINUTES = 60
const API_CACHE_MINUTES = 5
```

Quindi `cacheMinutes` decide in due passi:

1. Se hai impostato un numero con `/narsil cache <min>`, quel numero.
2. Altrimenti, se l'account ha finestre di limiti. Se l'atom `usage` (la guida precedente) contiene una lettura delle 5 ore o settimanale, è un abbonamento e la cache riceve 60 minuti; se no, è una chiave API e la cache riceve 5.

Il secondo passo si basa su ciò che i tipi della 2.1.325 dicono di `rateLimits`: "empty off a subscription" (vuoto fuori da un abbonamento). La decisione viene presa quando il turno finisce, da ciò che l'atom `usage` contiene in quel momento.

I numeri 60 e 5 sono un'ipotesi della mod, dichiarata nel suo codice e nel README, non una cifra che Claude Code comunica. L'impostazione manuale esiste perché l'autore sapeva che l'ipotesi poteva essere sbagliata per la configurazione di qualcuno. Una nuova impostazione ricalcola anche l'orologio già in corsa.

### Cosa disegna, e dove

Il testo viene da `cacheLabel` in `hooks/words.ts`: "🧊 Caché: N min" finché è calda, la frase della cache fredda a zero. `cacheShort` riduce la frase della cache fredda a "🧊 Caché fría" per le righe della fascia, che hanno poco spazio; la finestra mobile mostra l'etichetta per intero quando apri una conversazione.

Ogni conversazione invia anche all'hub `cacheEndsAt`, il momento in cui la sua cache si esaurisce, in secondi, e `cacheMinutes`. Con questi, le altre conversazioni, la finestra mobile e il telefono possono fare il conto alla rovescia di un orologio che non hanno avviato.

Il README dice che l'orologio è verde finché è fresco e rosso quando sta per scadere, e `hooks/words.ts` ha un `cacheColor` per questo, basato su quanta parte della vita della cache è stata consumata. Nel codice attuale `hooks/register.tsx` importa `cacheColor` ma non lo chiama mai: la fascia disegna l'orologio come testo attenuato, e la finestra mobile come una semplice nota. Se costruisci il tuo, il colore è un'aggiunta di una riga, mostrata sotto.

## Costruiscila con Claude

Chiedi a Claude un conto alla rovescia che mostri, dopo ogni turno, quanto dovrebbe durare la cache del prompt. L'unica idea che Claude deve fare bene: l'orologio conta dall'inizio dell'ultima richiesta, non dalla fine del turno.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nella mia mod di Claude Code `my-pet`, mostra un conto alla rovescia della cache del prompt nella fascia `AbovePrompt` mentre Claude mi aspetta. In `turn.step`, solo per la conversazione principale (`e.agentId === undefined`), registra l'ora con `$.clock.now()` prima della richiesta e lascia passare lo stream con `return yield* next(e)`. In `turn.complete`, per la conversazione principale, avvia un orologio in un atom a partire dall'ora di quella richiesta; svuotalo in `turn.start`. Fallo durare 60 minuti quando `$.session.usage()` riporta finestre di limiti e 5 minuti quando non ne riporta nessuna, e permetti a un comando `/pet cache <min>` di sovrascriverlo. Ogni pochi secondi con `$.clock.every`, ricalcola i minuti interi rimasti, arrotondati per eccesso, e scrivi l'atom solo quando il numero è cambiato. Mostra "Cache: N min" e, a zero, "Cache fredda: il prossimo messaggio viene addebitato per intero". Aggiungi un test con un orologio simulato che verifichi che una risposta di tre minuti lasci due minuti di una cache di cinque minuti.

### Cosa controllare nella risposta di Claude

1. L'ora della richiesta viene registrata in `turn.step`, solo per la conversazione principale (`e.agentId === undefined`), e l'hook continua a passare il flusso con `return yield* next(e)`.
2. `turn.complete` fa partire l'orologio da quell'ora della richiesta, e `turn.start` lo svuota, così non c'è orologio mentre Claude lavora.
3. I minuti rimanenti sono arrotondati per eccesso, e l'atom viene scritto solo quando quel numero cambia, non a ogni battito.
4. La cache dura 60 minuti quando l'account ha finestre di limiti e 5 quando non ne ha, e un comando può impostarla a mano.
5. Un test con un orologio simulato mostra che una risposta di tre minuti lascia due minuti di una cache da cinque minuti.

Se un controllo fallisce, di' a Claude cosa vedi: "dopo una risposta lunga l'orologio mostra 5 min pieni", oppure "le risposte di Claude non compaiono più sullo schermo".

### Come l'ha chiesta l'autore

La richiesta originale per l'orologio della cache non è stata registrata. È arrivato il 2026-10-30, prima dei log pubblici dei task.

#### Registrato: la cache resta

L'unica menzione registrata è in `odd/tasks/fleet-view.md` in narsil-pet, L2 (estratto), quando l'autore stava rimuovendo sezioni della fascia per fare spazio all'elenco delle conversazioni:

> "la del cache la mantenemos, la del dinero tambien podriamos eliminarla"

In italiano: quella della cache la teniamo; quella del denaro potremmo eliminarla anche. Il conteggio della spesa se n'è andato; l'orologio della cache è rimasto, e il design concordato in L4 lo ha messo nella riga di ogni conversazione: "the list of conversations (state, title, context bar, cache clock)" (l'elenco delle conversazioni: stato, titolo, barra del contesto, orologio della cache).

#### Ricostruzione dalla cronologia dei commit

Da `git log -- hooks/register.tsx hooks/words.ts`, i commit che hanno toccato l'orologio:

- `0993bd7` (2026-10-30) "feat: show a prompt-cache clock and offer next steps after a turn" (mostra un orologio della cache del prompt e propone i prossimi passi dopo un turno). L'orologio e i prossimi passi arrivano insieme, entrambi avviati dalla fine di un turno.
- `0cfc369` (2026-10-31) "refactor: move Narsil's wording and labels out of the hooks module" (sposta i testi e le etichette di Narsil fuori dal modulo degli hook). Le etichette passano a `hooks/words.ts`.
- `4f8abaa` (2026-11-01) "feat: send the state the band shows to a status topic for your own phone app" (invia lo stato che mostra la fascia a un topic di stato per la tua app del telefono). La cache viaggia fino al telefono.
- `49f0fd9` (2026-11-06) "feat: list every open conversation in the band" (elenca ogni conversazione aperta nella fascia). L'orologio passa in ogni riga.
- `0072d87` (2026-11-07) "fix: make room for the cache in each band row" (fa spazio alla cache in ogni riga della fascia).
- `c3e4464` (2026-11-09) "fix: count the prompt cache from the start of its last request" (conta la cache del prompt dall'inizio della sua ultima richiesta). La correzione descritta sopra: prima, l'orologio partiva quando il turno finiva, e sovrastimava ciò che restava dopo una risposta lunga.

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida. Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

Scritto per questa guida e verificato con i tipi della 2.1.325 (`turn.step`, `turn.start`, `turn.complete`, `$.clock.now`, `$.clock.every`, `$.session.usage`). È adattato da `hooks/register.tsx` e `hooks/words.ts` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). L'atom `cache` è dichiarato in `types/index.d.ts` come nella prima guida, con il tipo `{ requestAt: number; minutes: number; left: number } | null`.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const cache = atom({ plugin: 'my-pet', key: 'cache' } as const, null)
let lastRequestAt: number | null = null

const minutesLeft = (from: number, minutes: number, now: number) =>
  Math.max(0, Math.ceil((from + minutes * 60_000 - now) / 60_000))

async function cacheMinutes($: EngineInterface): Promise<number> {
  const usage = await $.session.usage().catch(() => undefined)
  return usage && usage.rateLimits.length > 0 ? 60 : 5
}

async function tick($: EngineInterface): Promise<void> {
  const c = await read($, cache)
  if (!c) return
  const left = minutesLeft(c.requestAt, c.minutes, await $.clock.now())
  if (left !== c.left) await update($, cache, (k) => (k ? { ...k, left } : k))
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    $.clock.every(5000, () => void tick($))
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) lastRequestAt = await $.clock.now()
    return yield* next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) await update($, cache, () => null)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    const now = await $.clock.now()
    const requestAt = lastRequestAt ?? now
    const minutes = await cacheMinutes($)
    await update($, cache, () => ({
      requestAt,
      minutes,
      left: minutesLeft(requestAt, minutes, now),
    }))
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const c = await read($, cache)
    if (!c) return next(e)
    const { Text } = $.ui.resolve(e)
    const spent = 100 - (c.left / c.minutes) * 100
    const color = spent >= 85 ? '#F0435A' : spent >= 60 ? '#F5B400' : '#22B573'
    return c.left > 0 ? (
      <Text color={color}>{`🧊 Cache: ${c.left} min`}</Text>
    ) : (
      <Text color={color}>🧊 Cache cold: the next message is billed in full</Text>
    )
  })
}
```

Questa versione interroga `$.session.usage()` alla fine di ogni turno. Narsil legge invece le stesse cifre dal suo atom `usage`, mantenuto aggiornato da `session.measure` (guida precedente), il che risparmia la chiamata.

## Errori comuni e come testarlo

- **Contare dalla fine del turno.** La vita della cache inizia con la richiesta. Dopo una risposta lunga, un orologio avviato alla fine mostra minuti che sono già passati (`c3e4464`).
- **Lasciare che i subagenti spostino l'orologio.** Anche le richieste di un subagente sollevano `turn.step`, con `e.agentId` impostato, e hanno una cache propria. Narsil registra solo quelle della conversazione principale.
- **Un orologio mentre Claude lavora.** Ogni nuova richiesta scrive di nuovo la cache, quindi un conto alla rovescia durante un turno non significa nulla. Svuotalo in `turn.start`.
- **Ridisegnare a ogni battito.** Ricalcola spesso, scrivi solo quando il minuto cambia.
- **Trattare 60 e 5 come fatti.** Sono l'ipotesi della mod su come Claude Code e l'API configurano la cache. Dai alla persona un modo per sovrascriverli.
- **Inghiottire lo stream in `turn.step`.** L'hook è un generatore: inoltra ogni chunk (`return yield* next(e)` o un `for await` che restituisca ciascuno con yield), altrimenti la risposta smette di arrivare sullo schermo.

Per testare, `claude plugin test .` esegue `tests/narsil.test.tsx` con un orologio simulato. "after a turn the band counts down the prompt cache, and says when it has gone cold" (dopo un turno la fascia fa il conto alla rovescia della cache del prompt, e dice quando si è raffreddata) verifica "🧊 Caché: 5 min" fuori da un piano, poi "🧊 Caché: 2 min", poi "🧊 Caché fría" nella fascia mentre l'hub riceve la frase completa, e che un nuovo turno rimuova l'orologio. "the cache counts from the start of the last request, not from the end of the turn" (la cache conta dall'inizio dell'ultima richiesta, non dalla fine del turno) verifica "🧊 Caché: 2 min" dopo una risposta di tre minuti e il `cacheEndsAt` esatto inviato all'hub. "a request of a subagent does not move the cache clock of the conversation" (una richiesta di un subagente non sposta l'orologio della cache della conversazione) e "on a plan the cache lasts an hour, and /narsil cache sets it by hand" (con un piano la cache dura un'ora, e /narsil cache la imposta a mano) coprono il resto.

## Per andare oltre

- `stepsCommand` in `hooks/register.tsx` gestisce `/narsil cache`, `/narsil cache auto` e `/narsil cache <min>`, e accetta anche `caché` con l'accento.
- `offerSteps` usa lo stesso momento di fine turno, `at`, per proporre i prossimi passi 15 minuti dopo un turno (`STEPS_AFTER_MS`).
- `shownState` invia all'hub `cache`, `cacheEndsAt` e `cacheMinutes` per la finestra mobile, le altre conversazioni e il telefono.
- `cacheColor` in `hooks/words.ts` è pronto per un orologio colorato, con le stesse soglie di `levelColor` delle barre di utilizzo in `hooks/usage.ts`.
