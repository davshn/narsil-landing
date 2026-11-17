---
title: Riassunto della sessione
description: 'Come Narsil conta ciò che fa una conversazione (turni, file, comandi, fallimenti, subagenti) e continua a contare quando Claude Code si riavvia, per /narsil resumen e un riassunto dopo una pausa.'
route: pet
order: 16
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/watch.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: types/index.d.ts
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Cosa fa

`/narsil resumen` ("riassunto") risponde a una domanda a cui è difficile rispondere dalla trascrizione: cosa ha fatto davvero questa conversazione finora? Stampa una riga:

```text
📋 Sesión de 1 h 5 min: 4 turnos (12 min de trabajo) · 3 archivos editados (a.ts, b.ts, c.ts) · 7 comandos, 1 fallo · 2 subagentes · contexto 40 %
```

In italiano: una sessione di 1 h 5 min, 4 turni (12 minuti di lavoro), 3 file modificati, 7 comandi con 1 fallimento, 2 subagenti, il contesto pieno al 40 %. L'esempio è quello del commento sopra `summaryText` in `hooks/watch.ts`.

Narsil lo mostra anche da sé quando una conversazione è rimasta tranquilla per 30 minuti dopo un turno: un momento naturale per guardarsi indietro, per esempio dopo una pausa. Appare dove appaiono i suoi consigli (guida 11): in una piccola finestra propria su Windows e macOS, nella fascia altrove.

Se chiudi Claude Code e più tardi riprendi la conversazione, il riassunto continua a sommare da dove era rimasto. Narsil conserva i conteggi delle 20 conversazioni più recenti.

## Come funziona dentro

### Cosa viene contato: il tipo `Stats`

I conteggi sono un unico valore, l'atom `stats` in `hooks/register.tsx`, del tipo `Stats` dichiarato in `types/index.d.ts`:

| Campo       | Cosa conta                                          | Dove viene sommato                        |
| ----------- | --------------------------------------------------- | ----------------------------------------- |
| `startedAt` | quando sono iniziati i conteggi della conversazione | la prima volta, a `session.start`         |
| `turns`     | turni finiti della conversazione principale         | `turn.complete`, qualsiasi motivo         |
| `workedMs`  | il tempo che quei turni hanno richiesto             | `turn.complete`, da `e.durationMs`        |
| `files`     | i nomi dei file modificati, fino a 200              | `tool.call` di uno strumento di scrittura |
| `moreFiles` | i file oltre i primi 200, solo contati              | lo stesso                                 |
| `commands`  | comandi della shell eseguiti                        | `tool.call` di `Bash` o `PowerShell`      |
| `failures`  | chiamate a strumenti che hanno restituito un errore | dopo `next(e)` in `tool.call`             |
| `agents`    | subagenti avviati                                   | `agent.spawn`                             |

Ogni modifica passa per un'unica funzione, `bumpStats($, change)`, che applica una modifica pura all'atom (partendo da `emptyStats(now)` se non ce n'è ancora uno) e lo salva. Gli helper in `hooks/watch.ts` mantengono le regole semplici: `emptyStats`, `addFile`, `summaryText`, `statsOf`.

Alcuni dettagli decidono cosa significano i numeri:

- **Gli strumenti di scrittura** sono `Edit`, `MultiEdit`, `Write` e `NotebookEdit` (`WRITING_TOOLS` in `hooks/words.ts`). Il file è il breve dettaglio che mostra la fascia, il nome base del file, e `addFile` aggiunge un nome una sola volta. Quindi il riassunto conta nomi distinti: due file `index.ts` in cartelle diverse contano come uno.
- **Conta anche il lavoro dei subagenti.** L'hook `tool.call` somma file, comandi e fallimenti qualunque cosa dica `e.agentId`, mentre `turns` conta solo i turni della conversazione principale, dato che il `turn.complete` di un subagente ritorna prima di quella riga.
- **Contano solo le chiamate di Claude.** L'hook inizia con `isClaudesCall(next.origin)`: una chiamata fatta da un'altra mod non fa parte del lavoro della sessione (guida 1).
- **Un test fallito è un fallimento.** `failures` conta qualsiasi risultato di strumento con `isError`, compresa un'esecuzione di test che fallisce.
- **Il contesto** non viene salvato: `summarize` legge la percentuale attuale dall'atom `usage` della guida 7, e la lascia fuori quando non c'è.

`summaryText(stats, now, contextPercent)` scrive la riga. Nomina al massimo tre file e aggiunge "…" dopo di essi quando ce ne sono di più, scrive "ningún archivo editado" ("nessun file modificato") quando non ce n'è nessuno, lascia fuori i subagenti quando non ce ne sono stati, e gestisce il plurale di ogni conteggio. La durata è `now - startedAt`, scritta in minuti o in ore e minuti.

### Perché due livelli di persistenza

Narsil tiene i conteggi in due posti, e ciascuno copre un tipo diverso di riavvio:

- **`$.state`, l'atom.** I tipi lo descrivono come "plain data that survives a hot reload of the plugin's code" (dati semplici che sopravvivono a un ricaricamento a caldo del codice del plugin). Un ricaricamento della mod, che segue qualsiasi turno che la modifica, conserva i conteggi senza fare niente.
- **`$.store`, una chiave per conversazione.** Lo store è "kept between sessions and hot reloads" (conservato tra le sessioni e i ricaricamenti a caldo). `loadStats` chiede `$.session.id()`, che i tipi descrivono come "the session's id (the transcript file's name)" (l'id della sessione, il nome del file della trascrizione), e usa la chiave `stats:<id>`. `saveStats` ci scrive l'intero valore dopo ogni modifica.

A `session.start`, `loadStats` riempie l'atom dallo store solo quando l'atom è vuoto. Un ricaricamento conserva l'atom e salta lo store; un riavvio di Claude Code con la stessa conversazione ha un atom vuoto e lo rilegge. Il commento in quel punto lo riassume: "The stats survive a reload of the mod, and Claude Code restarting with this conversation: only a new conversation starts them." (le statistiche sopravvivono a un ricaricamento della mod, e al riavvio di Claude Code con questa conversazione: solo una nuova conversazione le fa ripartire.)

La chiave è per conversazione di proposito. Gli XP della guida 13 sono un unico numero per la macchina, a cui tutti aggiungono; un riassunto riguarda una conversazione, quindi ciascuna ha il suo.

Se `$.session.id()` fallisce, la chiave è vuota e niente viene salvato: i conteggi durano allora solo quanto l'atom.

Dal conservare `startedAt` segue una conseguenza: la durata conta da quando sono iniziati i conteggi della conversazione, quindi è incluso il tempo con Claude Code chiuso. Una conversazione ripresa la mattina dopo dice di essere durata tutta la notte.

### Conservarne solo 20

Una chiave per conversazione cresce senza fine, quindi `saveStats` fa pulizia una volta per ogni caricamento del modulo (`isStatsPruned`). Elenca le chiavi dello store, tiene quelle che iniziano con `stats:` diverse dalla propria, ed elimina le più vecchie finché ne restano 19, così con la propria ne restano 20. Il codice si basa sull'ordine: "Oldest first: the store lists its keys in the order they were set." (prima le più vecchie: lo store elenca le sue chiavi nell'ordine in cui sono state impostate.) I tipi dicono che `$.store.keys()` "Returns every key set, in insertion order." (restituisce ogni chiave impostata, in ordine di inserimento.) Qualsiasi fallimento nell'elencare o eliminare lascia ogni chiave al suo posto.

`statsOf` valida ciò che legge: ogni conteggio deve essere un numero finito e `files` un array di stringhe, altrimenti il valore salvato viene ignorato e la conversazione riparte da zero. Il commento lo chiama "A stored value from any version, or none" (un valore salvato da qualsiasi versione, o nessuno).

### Il riassunto dopo una pausa

Il battito (`beat`, ogni 2 secondi) chiama `tickWatch`, che mostra il riassunto quando vale tutto questo:

- un turno è finito: l'orologio della cache della guida 8 ha un inizio, `c.at`, che la fine di ogni turno imposta;
- niente è ancora in esecuzione in background (`backgroundAtStop === 0`);
- sono passati 30 minuti (`IDLE_SUMMARY_MS`) da `c.at`;
- la pausa di questo turno non è ancora stata riassunta (`summarizedFor !== c.at`);
- la conversazione ha almeno un turno;
- la modalità discreta è spenta (guida 14).

Allora chiama `showTip($, await summarize($), 'summary')`. Riutilizzare la visualizzazione del consiglio significa che il riassunto ottiene gratis la finestra dei consigli, le tre righe della fascia e la finestra mobile. `summarizedFor` lo fa una volta per pausa: un nuovo turno imposta un nuovo `c.at`, e la pausa successiva può essere riassunta di nuovo.

## Come è stata chiesta all’IA

La richiesta originale per il riassunto della sessione non è stata registrata.

Una richiesta registrata tocca il modulo in cui è nato il riassunto. `hooks/watch.ts` è nato con un avviso di ciclo, un promemoria per i permessi in attesa e il riassunto. In `odd/tasks/fleet-view.md`, L1 (2026-11-06), l'autore ha chiesto:

> "eliminariamos la alerta de bucle, no la he sentido tan util"

In italiano: elimineremmo l'avviso di ciclo, non l'ho trovato così utile. Il log dei task lo registra come S9, e `21e7288` l'ha rimosso. Il riassunto e il promemoria sono rimasti.

### Ricostruzione dalla cronologia dei commit

Da `git log -- hooks/watch.ts` in narsil-pet:

- `f7a494e` (2026-10-30) "feat: warn about loops, insist on waiting permissions and sum the session up" (avvisa dei cicli, insiste sui permessi in attesa e riassume la sessione). Il riassunto, il promemoria e l'avviso di ciclo arrivano insieme.
- `21ffc2e` (2026-10-31) "fix: keep a conversation's session summary when Claude Code restarts" (conserva il riassunto della sessione di una conversazione quando Claude Code si riavvia). Le chiavi `stats:<id>`, `statsOf` e il limite di 20 (`KEEP_STATS`) vengono da qui. La prima versione viveva solo nella sessione.
- `36256f9` (2026-10-31) "feat: let the band, window and alerts speak in Narsil's first person" (fa parlare la fascia, la finestra e gli avvisi in prima persona di Narsil).
- `2bcc97c` (2026-11-05) "feat: open the context breakdown from the usage bars and calm loop, steps and permission alerts" (apre il dettaglio del contesto dalle barre d'uso e calma gli avvisi di ciclo, di passi e di permessi).
- `519dd73` (2026-11-06) "fix: wait for background work before announcing a turn finished" (aspetta il lavoro in background prima di annunciare un turno finito). La condizione `backgroundAtStop === 0` del riassunto di pausa arriva con esso.
- `21df208` (2026-11-06) "fix: ignore tool calls other mods make, so Narsil no longer sticks at working" (ignora le chiamate a strumenti fatte da altre mod, così Narsil non resta più bloccata su al lavoro). Il suo messaggio cita le chiamate di un'altra mod contate come lavoro di Claude; `isClaudesCall` le tiene fuori anche dai conteggi.
- `21e7288` (2026-11-06) "refactor: drop the loop alert, the spending count and the open-conversations line" (elimina l'avviso di ciclo, il conteggio della spesa e la riga delle conversazioni aperte).

La prima correzione è quella istruttiva: un riassunto che si perde quando Claude Code si riavvia riporta una frazione del lavoro, il che è peggio di niente.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nella mia mod di Claude Code `my-pet`, aggiungi `/my-pet summary`. Tieni un atom `stats` con `startedAt`, `turns`, `workedMs`, `files` (nomi base distinti, al massimo 200), `commands`, `failures` e `agents`. Conta i turni e il loro `durationMs` in `turn.complete` della conversazione principale; i file modificati dalle chiamate `Edit` e `Write` in `tool.call`; le chiamate `Bash` come comandi; qualsiasi risultato con `isError` come fallimento; i subagenti in `agent.spawn`. Modifica l'atom solo tramite un'unica funzione che lo salva anche in `$.store` sotto `stats:` più `$.session.id()`. A `session.start`, caricalo dallo store solo se l'atom è vuoto, e valida ciò che leggi. Conserva solo le ultime 20 chiavi di questo tipo. Il comando stampa una riga come "Session of 12 min: 3 turns · 2 files edited (a.ts, b.ts) · 4 commands, 1 failure". Testa con `claude-code/testing`: un valore salvato sotto la chiave della sessione viene continuato, e una 25ª chiave vecchia viene eliminata.

## Il codice minimo

Scritto per questa guida e verificato con i tipi della 2.1.325 (`$.session.id`, `$.store.get`, `$.store.set`, `$.clock.now`, `$.command.register`, `command.run`, `session.start`, `tool.call`, `turn.complete`, `agent.spawn`). È adattato da `hooks/watch.ts` e `hooks/register.tsx` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). L'atom `stats` è dichiarato in `types/index.d.ts` come `Stats | null`, con il tipo qui sotto. La pulizia a 20 è lasciata fuori; vedi `saveStats`.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import type { Stats } from '../types'
// type Stats = { startedAt: number; turns: number; workedMs: number;
//   files: string[]; commands: number; failures: number; agents: number }

const stats = atom({ plugin: 'my-pet', key: 'stats' } as const, null)
let key = ''

const empty = (startedAt: number): Stats => ({
  startedAt,
  turns: 0,
  workedMs: 0,
  files: [],
  commands: 0,
  failures: 0,
  agents: 0,
})
const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path

async function bump($: EngineInterface, change: (s: Stats) => Stats): Promise<void> {
  const now = await $.clock.now()
  const next = await update($, stats, (s) => change(s ?? empty(now)))
  if (key) await $.store.set(key, next).catch(() => undefined)
}

function summary(s: Stats, now: number): string {
  const minutes = Math.round((now - s.startedAt) / 60_000)
  const files = s.files.length
    ? ` (${s.files.slice(0, 3).join(', ')}${s.files.length > 3 ? '…' : ''})`
    : ''
  return `Session of ${minutes} min: ${s.turns} turns · ${s.files.length} files edited${files} · ${s.commands} commands, ${s.failures} failures · ${s.agents} subagents`
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'my-pet', description: 'My pet: summary' })
    key = `stats:${await $.session.id().catch(() => '')}`
    if (key === 'stats:') key = ''
    // A reload keeps the atom; a restart reads the store back.
    if (key && !(await read($, stats))) {
      const kept = await $.store.get(key).catch(() => undefined)
      if (kept && typeof kept === 'object' && typeof (kept as Stats).turns === 'number')
        await update($, stats, (s) => s ?? (kept as Stats))
    }
    if (!(await read($, stats))) await bump($, (s) => s)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const path = (e as { file_path?: unknown }).file_path
    if ((e.tool === 'Edit' || e.tool === 'Write') && typeof path === 'string') {
      const name = baseName(path)
      await bump($, (s) =>
        s.files.includes(name) || s.files.length >= 200 ? s : { ...s, files: [...s.files, name] },
      )
    }
    if (e.tool === 'Bash') await bump($, (s) => ({ ...s, commands: s.commands + 1 }))
    const result = await next(e)
    if (result.isError) await bump($, (s) => ({ ...s, failures: s.failures + 1 }))
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined)
      await bump($, (s) => ({ ...s, turns: s.turns + 1, workedMs: s.workedMs + e.durationMs }))
    return result
  })

  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    await bump($, (s) => ({ ...s, agents: s.agents + 1 }))
    return result
  })

  on('command.run', { command: 'my-pet' }, async ($, e) => {
    if (e.args.trim() !== 'summary') return { text: 'Usage: /my-pet summary' }
    const now = await $.clock.now()
    return { text: summary((await read($, stats)) ?? empty(now), now) }
  })
}
```

`update` si risolve nel valore che ha scritto, quindi `bump` salva esattamente ciò che contiene l'atom. Il controllo del valore salvato qui è un abbozzo; lo `statsOf` di Narsil controlla ogni campo.

## Errori comuni e come testarlo

- **Contare in variabili di modulo.** Un ricaricamento della mod segue qualsiasi turno che la modifica, e una variabile di modulo riparte da zero. Tieni i conteggi in un atom.
- **Una sola chiave dello store per tutte le conversazioni.** Allora il riassunto di ogni conversazione è quello di tutte. Usa come chiave `$.session.id()`.
- **Caricare lo store sopra un atom vivo.** Dopo un ricaricamento l'atom è il valore più recente; lo store può essere indietro di una modifica. Carica solo quando l'atom è vuoto.
- **Uno store che cresce per sempre.** Una chiave per conversazione ha bisogno di un limite e di una pulizia.
- **Fidarsi di ciò che è salvato.** Una versione più vecchia può aver salvato un'altra forma. Valida campo per campo, e riparti da zero quando non corrisponde.
- **Riassumere nel momento sbagliato.** Una pausa mentre gira del lavoro in background non è una pausa. Narsil aspetta che finisca, e riassume ogni pausa una sola volta.

Per testare, `tests/narsil.test.tsx` ha quattro test. "/narsil resumen sums the session up, and so does a 30-minute pause after a turn" (/narsil resumen riassume la sessione, e così fa una pausa di 30 minuti dopo un turno) verifica la riga esatta ("Narsil: 📋 Sesión de 0 min: 2 turnos (1 min 24 s de trabajo) · 2 archivos editados (a.ts, b.ts) · 1 comando, 0 fallos.") e poi fa avanzare l'orologio finto. "a conversation taken up again keeps counting its session, kept across restarts" (una conversazione ripresa continua a contare la sua sessione, conservata tra i riavvii) risponde a `session.id` con un id fisso, mette conteggi precedenti nello store sotto `stats:` e quell'id, e verifica che il turno successivo si sommi a essi. "only the last 20 conversations keep their counts, and an odd stored value is ignored" (solo le ultime 20 conversazioni conservano i loro conteggi, e un valore salvato strano viene ignorato) parte con 25 chiavi vecchie e un valore non valido. "the summary names three files at most, and counts subagents and context" (il riassunto nomina al massimo tre file, e conta subagenti e contesto) testa `summaryText` da sola.

## Per andare oltre

- `nudgeText` e `NUDGE_AFTER_MS` in `hooks/watch.ts`, i vicini del riassunto, guidano il promemoria dei cinque minuti della guida 10.
- `took` in `hooks/agents.ts` scrive le durate ("1 min 24 s") per il riassunto e per i subagenti.
- La guida successiva, l'ultima del percorso, mostra come viene registrato `/narsil` stesso e come vengono smistate le sue parole, tra cui `resumen`.
