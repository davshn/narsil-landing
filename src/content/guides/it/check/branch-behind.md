---
title: Un branch indietro rispetto al suo remoto
description: 'Come Narsil Check fa il fetch, conta i commit che mancano al tuo branch, avvisa in cima al pannello e li porta dentro con un pulsante git pull -r.'
route: check
order: 5
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/words.ts
  - repo: check
    path: hooks/git.ts
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/session.test.tsx
---

## Cosa fa

Lavorando su un branch su cui fa push anche qualcun altro, è facile iniziare una modifica sopra uno stato vecchio e accorgersene solo al push successivo. Narsil Check te lo dice prima che succeda.

Ogni volta che il pannello rivede le librerie del progetto, chiede anche a git se il tuo branch è indietro rispetto al suo remoto. Se lo è, compare un riquadro rosso in cima al pannello, sopra tutto il resto, in grassetto:

> ⚠ La rama feat/login está 3 commits detrás de su remota: actualízala antes de seguir.

In italiano: "Il branch feat/login è 3 commit indietro rispetto al suo remoto: aggiornalo prima di andare avanti." Subito sotto c'è un pulsante, **Actualizar rama** ("Aggiorna il branch").

Lo stesso pulsante si trova anche in fondo al pannello, centrato sotto l'ultima sezione, così puoi fare il pull in qualsiasi momento, con o senza avviso. Una pressione esegue `git pull -r` sul branch attivo. Mentre è in esecuzione, il pulsante diventa il testo attenuato "Actualizando la rama…" ("Aggiornamento del branch…"). Quando finisce, una riga sopra il pulsante in fondo dice com'è andata:

| Riga                                            | Significato                                                     |
| ----------------------------------------------- | --------------------------------------------------------------- |
| `Rama feat/login actualizada: rebase hecho`     | I tuoi commit locali sono stati riapplicati sopra quelli nuovi. |
| `Rama feat/login actualizada: ya estaba al día` | Niente da portare: era già aggiornato.                          |
| `Rama feat/login actualizada: Fast-forward`     | Nessun commit locale: il branch è solo andato avanti.           |
| `No pude actualizar la rama: …` (rosso)         | Git ha rifiutato o è fallito; segue il suo motivo.              |

Dopo un pull riuscito il pannello rivede di nuovo le librerie, e l'avviso sparisce.

Quando non c'è niente da dire, non compare niente: nessun branch remoto, nessuna risposta dalla rete o un `HEAD` staccato lasciano l'avviso nascosto, come dice il README.

## Come funziona dentro

### Dove vive il codice

La specifica di questo percorso indica `hooks/git.ts`, ma quel file non esegue git. Contiene gli helper puri per la pull request degli aggiornamenti di una guida successiva (`isMainBranch`, `branchName`, `commitTitle`, `prBody`). Il fetch, il conteggio e il pull sono in `hooks/register.tsx`, e le loro parole in `hooks/words.ts` (`behindNote`, `pullSummary`, `tail`).

### Due piccoli valori

Il modulo degli hook tiene due atom, entrambi tipizzati in `types/index.d.ts`:

- `behind`: `{ status: 'unknown' }` o `{ status: 'checked', branch, count }`. Ciò che ha trovato l'ultima revisione.
- `pull`: `idle`, `running`, `done` con un testo, o `failed` con un messaggio. Come è finita l'ultima pressione del pulsante.

Il pannello disegna da questi due valori e da nient'altro. È la separazione solita in Narsil Check: le funzioni che fanno il lavoro scrivono un atom, e l'hook `ui.render` si limita a leggere.

### Contare ciò che manca

`checkBehind` fa a git tre domande, ciascuna tramite `$.process.run` con un timeout di due minuti (`GIT_MS`):

1. `git branch --show-current`. Una risposta vuota significa un `HEAD` staccato: non c'è nessun branch da confrontare, quindi il valore resta `unknown`.
2. `git fetch --quiet`. Aggiorna i branch di tracciamento remoto, così il conteggio che segue riguarda il remoto com'è adesso, non com'era all'ultimo fetch.
3. `git rev-list --count HEAD..@{upstream}`. `HEAD..@{upstream}` significa "i commit che l'upstream ha e `HEAD` no". `--count` li trasforma in un numero.

Solo un codice di uscita 0 e un numero che si riesce a leggere danno `{ status: 'checked', branch, count }`. Un branch senza upstream fa fallire `rev-list`, il che lascia `unknown`. Qualsiasi rifiuto (git assente, un timeout) viene catturato e lascia anch'esso `unknown`. L'avviso compare solo per `checked` con `count > 0`.

Un dettaglio che il README non menziona: il codice non controlla il codice di uscita del fetch. Se il fetch fallisce perché non c'è rete ma il branch ha un upstream, `rev-list` conta comunque rispetto al branch di tracciamento remoto dell'ultimo fetch riuscito. Il conteggio allora può essere vecchio, e può essere maggiore di zero. Il "sin red … no se muestra nada" ("senza rete … non si mostra niente") del README vale quando non c'è mai stato un fetch con cui confrontare, non in ogni caso.

### Quando viene controllato

`checkBehind` non viene mai atteso. `scanProject` lo avvia con `void checkBehind($).catch(() => undefined)` alla sua prima riga, così il conteggio gira accanto alla revisione delle librerie. Quella revisione gira all'avvio della sessione, su **Revisar de nuevo**, su `/narsil-check upgrade`, dopo il pulsante di aggiornamento, dopo il pulsante della pull request e dopo un pull riuscito. Un progetto senza manifest da analizzare riceve comunque il controllo all'avvio della sessione, tramite un `else void checkBehind($)` separato: il commento dice "with nothing to scan, that check still runs" (senza niente da analizzare, quel controllo gira comunque).

Non c'è nessun timer. Il pannello non interroga il remoto a intervalli; guarda di nuovo quando tu o il pannello fate qualcosa che rivede il progetto.

### Il pull

`pullBranch` è ciò che chiamano entrambi i pulsanti:

```tsx
async function pullBranch($: EngineInterface): Promise<void> {
  if ((await read($, pull)).status === 'running') return
  await update($, pull, () => ({ status: 'running' }) as Pull)
  const branch = (await read($, session)).branch
  try {
    const ran = await runCommand($, ['git', 'pull', '-r'], PULL_MS)
    const value: Pull =
      ran.exitCode === 0
        ? {
            status: 'done',
            text: `Rama ${branch || 'actual'} actualizada: ${pullSummary(ran.stdout)}`,
          }
        : {
            status: 'failed',
            message:
              tail(ran.stderr || ran.stdout) || `git pull terminó con código ${ran.exitCode}`,
          }
    await update($, pull, () => value)
  } catch (err) {
    await update($, pull, () => ({ status: 'failed', message: errorText(err) }) as Pull)
  }
  void loadSession($, true, false).catch(() => undefined)
  if ((await read($, pull)).status === 'done') void runScan($, true).catch(() => undefined)
}
```

È citato da [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Ogni riga è una decisione:

- **Un pull alla volta.** Una seconda pressione mentre uno è in corso non fa niente, e nel frattempo il pulsante non viene disegnato.
- **Due minuti al massimo** (`PULL_MS = 120_000`). Un pull che scarica molto può durare più dei 30 secondi predefiniti di `$.process.run`.
- **Un'uscita diversa da zero è una risposta.** I tipi della 2.1.325 dicono che `$.process.run` risolve "once it exits, any exit code" (quando esce, con qualsiasi codice di uscita) e rifiuta solo "when the command cannot start or is still running then" (quando il comando non può partire o è ancora in esecuzione a quel punto). Quindi un rifiuto si legge da `exitCode`, e `catch` serve per git assente o un timeout.
- **Il motivo è quello di git.** `tail` tiene le ultime quattro righe di stderr (o di stdout quando stderr è vuoto), unite e tagliate a 400 caratteri: dove git scrive il suo "perché". Senza nessun output, il testo è "git pull terminó con código N" ("git pull è terminato con codice N").
- **Poi rileggere tutto.** `loadSession` rilegge il branch e la cartella della sessione. Solo un pull riuscito rianalizza anche le librerie con `isFresh` impostato, perché il pull può aver portato altre versioni nei manifest. Quella nuova analisi esegue di nuovo `checkBehind`, ed è questo che nasconde l'avviso.

`runCommand` è un piccolo wrapper che usa anche il pulsante di aggiornamento: senza shell, Windows avvia alcuni strumenti solo tramite il loro shim `.cmd`, quindi un comando che non può partire viene riprovato come `<command>.cmd`.

`pullSummary` trasforma l'output di git in poche parole: "up to date" diventa `ya estaba al día`, "Successfully rebased" diventa `rebase hecho`, "Fast-forward" resta `Fast-forward`, e qualsiasi altra cosa è l'ultima riga di git.

### Perché `-r`

La cronologia mostra che la scelta è stata fatta due volte. La prima versione del pulsante, in `b3ad055`, eseguiva `git pull --ff-only`. Lo stesso giorno, `7b864b6` l'ha cambiata in `git pull -r`, "replaying local commits over the remote's" (riapplicando i commit locali sopra quelli del remoto).

I commit non dicono perché. Leggendo le due opzioni una accanto all'altra: `--ff-only` rifiuta appena hai un commit locale che il remoto non ha, che è il caso solito quando sei indietro su un branch condiviso, quindi il pulsante fallirebbe proprio quando serve. Un semplice `git pull` creerebbe un commit di merge a ogni aggiornamento. Un rebase tiene la cronologia su una linea e tiene i tuoi commit in cima, il che corrisponde a ciò che chiede l'avviso: "aggiornalo prima di andare avanti". Questo ragionamento è un'interpretazione della modifica, non una decisione registrata.

### Perché la mod esegue git da sola

Un commento in `hooks/register.tsx` lo dice: "The mod runs git itself, so the app asks no permission." (la mod esegue git da sola, quindi l'app non chiede nessun permesso). Una pressione su un pulsante del pannello è già la decisione della persona; farla passare per lo strumento Bash di Claude chiederebbe di nuovo. Il README dice lo stesso: "Lo ejecuta el mod directamente, sin pasar por los permisos de la app" ("La mod lo esegue direttamente, senza passare per i permessi dell'app").

Due cose vengono con questo, entrambe dai tipi della 2.1.325. `$.process.run` è segnato "CLI only" (solo CLI), come il resto del sostantivo `process`. E "Git runs with repo hooks off" (git gira con gli hook del repository disattivati), quindi gli hook del repository (un hook `post-merge` o `post-rewrite`, per esempio) non girano su questo pull.

### Quando il pulsante viene offerto, e quando no

Il pulsante in fondo viene sempre disegnato, tranne mentre un pull è in corso. Il pulsante del riquadro rosso viene disegnato solo con l'avviso. Il codice non guarda il working tree prima di offrirlo: non controlla modifiche non committate né un rebase in corso.

È voluto, nel senso che git conosce già quelle regole. Un pull con rebase con modifiche non committate in file tracciati viene rifiutato da git (a meno che la configurazione del repository stesso, come `rebase.autoStash`, non gli dica altrimenti), e il pannello mostra il motivo di git in rosso. Il README lo descrive così: "Si git no puede hacerlo (un conflicto o cambios sin commit), lo dice y muestra el motivo" ("Se git non può farlo, un conflitto o modifiche senza commit, lo dice e mostra il motivo").

Un conflitto è il caso da conoscere. Quando il rebase si ferma su un conflitto, git esce con un errore e lascia il repository a metà del rebase. Il pannello mostra la coda dell'output di git, e non fa altro: non esegue `git rebase --abort` né nient'altro. Il conflitto lo risolvi tu e continui, o annulli, da solo. Dato che un pull fallito non rianalizza, l'avviso resta con il conteggio precedente fino alla revisione successiva.

## Come è stata chiesta all’IA

La richiesta originale per l'avviso e il pulsante non è stata registrata. Nessuno dei log di task pubblici di narsil-check (`odd/tasks/*.md`) copre questa funzione.

### Ricostruzione dalla cronologia dei commit

Da `git log -S checkBehind`, `git log -S pullBranch` e `git log -S "pull -r"` in narsil-check:

- `b3ad055` (2026-11-06) "feat: fold upgrade and vulnerability groups, copy a row on click, show baby Narsil and pull the branch" (chiude i gruppi di aggiornamenti e vulnerabilità, copia una riga con un clic, mostra la piccola Narsil e fa il pull del branch). Il suo messaggio: "Actualizar rama, last in the pane, runs git pull --ff-only through the mod, with no permission prompt." (Actualizar rama, ultimo nel pannello, esegue git pull --ff-only tramite la mod, senza richiesta di permesso). Il pulsante arriva, in fondo, solo con fast-forward.
- `7b864b6` (2026-11-06) "feat: pull the branch with a rebase" (fa il pull del branch con un rebase). Il suo messaggio: "Actualizar rama now runs git pull -r, replaying local commits over the remote's, and names a rebase, an up-to-date branch or a fast-forward in its result." (Actualizar rama ora esegue git pull -r, riapplicando i commit locali sopra quelli del remoto, e nomina nel suo risultato un rebase, un branch aggiornato o un fast-forward). La correzione lungo il percorso: da `--ff-only` a `-r`, e `pullSummary` con i suoi tre esiti.
- `2b91c7d` (2026-11-13) "feat: return to the default branch after the PR and warn when the branch is behind" (torna al branch predefinito dopo la PR e avvisa quando il branch è indietro). Il suo messaggio: "Each review fetches and counts the commits the upstream has that HEAD lacks, and shows a red warning at the top of the pane with its own pull button." (ogni revisione fa il fetch e conta i commit che l'upstream ha e a HEAD mancano, e mostra un avviso rosso in cima al pannello con il suo pulsante di pull).

Lo schema: prima un pulsante manuale, il suo comportamento corretto lo stesso giorno, e una settimana dopo il pannello che impara a dire quando il pulsante serve, mettendone una seconda copia dove l'occhio cade per primo.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nella mia mod di Claude Code `my-panel`, aggiungi al mio pannello un avviso "indietro rispetto al suo remoto". In una funzione che nessun hook attende mai, esegui con `$.process.run` (timeout di due minuti) `git branch --show-current`, poi `git fetch --quiet`, poi `git rev-list --count HEAD..@{upstream}`. Tieni il risultato in un atom tipizzato in `types/index.d.ts`: `unknown` per un HEAD staccato, nessun upstream, un'uscita diversa da zero o un rifiuto, altrimenti il branch e il conteggio. Eseguilo all'avvio della sessione. Quando il conteggio è sopra zero, disegna in cima al pannello un riquadro con bordo rosso che dica "Il branch X è N commit indietro rispetto al suo remoto" con un pulsante che esegue `git pull -r` (timeout di due minuti). Tieni lo stato del pull in un secondo atom: in corso, fatto con un breve riassunto dell'output di git, o fallito con le ultime righe di stderr. Ignora una seconda pressione mentre uno è in corso. Dopo un pull riuscito, esegui di nuovo il controllo. Controlla ogni API con i tipi di plugin-authoring e testalo con `claude-code/testing`, rispondendo a git tramite un hook `on('process.run', ...)`.

## Il codice minimo

Questa è una versione ridotta dell'idea, scritta per questa guida e verificata con i tipi di Claude Code 2.1.325. È adattata da `hooks/register.tsx` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Lascia fuori la lettura della sessione e l'analisi delle librerie.

Il tipo dello stato, in `types/index.d.ts`:

```ts
export type Behind = { status: 'unknown' } | { status: 'checked'; branch: string; count: number }
export type Pull =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; text: string }
  | { status: 'failed'; message: string }

declare module 'claude-code' {
  interface PluginState {
    'my-panel': { behind: Behind; pull: Pull }
  }
}
```

La parte del modulo degli hook, `hooks/register.tsx`:

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'
import type { Behind, Pull } from '../types'

const behind = atom({ plugin: 'my-panel', key: 'behind' } as const, { status: 'unknown' } as Behind)
const pull = atom({ plugin: 'my-panel', key: 'pull' } as const, { status: 'idle' } as Pull)
const GIT_MS = 120_000

export async function checkBehind($: EngineInterface): Promise<void> {
  let value: Behind = { status: 'unknown' }
  try {
    const run = (argv: string[]) => $.process.run(argv, { timeoutMs: GIT_MS })
    const branch = (await run(['git', 'branch', '--show-current'])).stdout.trim()
    if (branch) {
      await run(['git', 'fetch', '--quiet'])
      const counted = await run(['git', 'rev-list', '--count', 'HEAD..@{upstream}'])
      const count = Number.parseInt(counted.stdout.trim(), 10)
      if (counted.exitCode === 0 && Number.isFinite(count))
        value = { status: 'checked', branch, count }
    }
  } catch {
    // Unknown: nothing shows.
  }
  await update($, behind, () => value)
}

const tail = (text: string) => text.trim().split(/\r?\n/).slice(-4).join(' ').slice(0, 400)

export async function pullBranch($: EngineInterface): Promise<void> {
  if ((await read($, pull)).status === 'running') return
  await update($, pull, () => ({ status: 'running' }) as Pull)
  try {
    const ran = await $.process.run(['git', 'pull', '-r'], { timeoutMs: GIT_MS })
    await update($, pull, () =>
      ran.exitCode === 0
        ? { status: 'done', text: tail(ran.stdout) || 'done' }
        : {
            status: 'failed',
            message: tail(ran.stderr || ran.stdout) || `exit code ${ran.exitCode}`,
          },
    )
  } catch (err) {
    await update($, pull, () => ({ status: 'failed', message: String(err) }) as Pull)
  }
  if ((await read($, pull)).status === 'done') void checkBehind($).catch(() => undefined)
}
```

Avvia il controllo da `session.start` con `void checkBehind($).catch(() => undefined)` prima di `return next(e)`. Nell'hook `ui.render` del pannello, leggi entrambi gli atom con `read($, behind)` e `read($, pull)`. Quando `behind` è `checked` con un conteggio sopra zero, disegna un `Box` con un `borderColor` rosso, un `Text` in grassetto con l'avviso e un `Button` il cui `onPress` è `() => pullBranch($)`; mentre `pull` è `running`, disegna al suo posto un `Text` attenuato. Disegna il testo di `pull` in verde quando è `done` e il suo messaggio in rosso quando è `failed`.

## Errori comuni e come testarlo

Questi vengono dal codice e dai commit di Narsil Check:

- **Contare prima di fare il fetch.** Senza `git fetch`, `HEAD..@{upstream}` confronta con ciò che hai scaricato l'ultima volta, magari giorni fa. Fai prima il fetch.
- **Fidarsi di un fetch fallito.** Se il fetch fallisce e non controlli il suo codice di uscita, il conteggio può essere vecchio. Narsil Check lo accetta; una versione più rigorosa tiene `unknown` quando il fetch non esce con 0.
- **Trattare "nessuna risposta" come zero.** Un `HEAD` staccato, nessun upstream o niente git non significano "aggiornato". Tieni un `unknown` separato e non mostrare niente per esso.
- **Attendere git in un hook.** Un fetch può durare secondi. Avvialo con `void`, non attenderlo mai con `await` in `session.start`.
- **`--ff-only` su un branch condiviso.** Rifiuta appena hai un commit locale, che è il caso per cui esiste l'avviso. È la correzione fatta da `7b864b6`.
- **Nascondere il motivo di git.** Un pull che fallisce senza dire perché lascia la persona a indovinare. Tieni le ultime righe di stderr, dove git lo scrive.
- **Dimenticare il rebase in corso.** Dopo un conflitto il repository è a metà di un rebase. Dillo nel messaggio, o almeno non rianalizzare come se il pull avesse funzionato.
- **Due pull insieme.** Proteggi la funzione con lo stato `running` e nascondi il pulsante nel frattempo.

Per testare, `tests/session.test.tsx` risponde a git tramite un hook `on('process.run', ...)` con chiave sul vettore di argomenti unito. "a review that finds the branch behind its remote shows a big warning at the top, with the pull at hand" (una revisione che trova il branch indietro rispetto al suo remoto mostra un grande avviso in cima, con il pull a portata di mano) risponde a `git rev-list --count HEAD..@{upstream}` con `3` e si aspetta il riquadro rosso `behind`, il testo esatto dell'avviso e il pulsante `behind-pull`. "a branch up to date with its remote, or with none, shows no warning" (un branch aggiornato rispetto al suo remoto, o senza remoto, non mostra nessun avviso) risponde `0`. "\"Actualizar rama\", last in the pane, pulls the checked-out branch with a rebase and says how it went" ("Actualizar rama", ultimo nel pannello, fa il pull del branch attivo con un rebase e dice com'è andata) controlla che `branch-pull` sia l'ultimo pulsante, centrato, e che una pressione lasci "Rama feat/login actualizada: rebase hecho". "a pull that fails says why" (un pull che fallisce dice perché) si aspetta una riga che inizia con "No pude actualizar la rama: ". "the words of each pull that went well" (le parole di ogni pull andato bene) testa `pullSummary` con le frasi reali di git.

## Per andare oltre

- Il nome del branch nella sezione **Entorno** apre una scheda del terminale nella cartella della sessione (vedi la guida sull'ambiente della sessione), che è dove risolvi un conflitto lasciato dal pull.
- `@{upstream}` si può sostituire con `origin/main` per mostrare quanto un branch di funzione è lontano dal branch predefinito, una domanda diversa con gli stessi tre comandi.
- Lo stesso `checkBehind` potrebbe contare anche `@{upstream}..HEAD`, i commit che non hai ancora spinto, e avvisare anche di quelli.
