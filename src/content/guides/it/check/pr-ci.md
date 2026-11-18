---
title: 'La CI della tua PR'
description: 'Come Narsil Check segue i passi di GitHub Actions della pull request della sessione con la CLI gh, ogni 10 secondi mentre un run è in corso, e si ferma quando finisce.'
route: check
order: 4
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/ci.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/session.ts
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/ci.test.tsx
  - repo: check
    path: tests/session.test.tsx
---

## Cosa fa

Quando la sessione ha una pull request aperta, la sezione **Entorno** mostra una chiusura **CI** sotto l'interruttore del Remote Control. Segue il run di GitHub Actions del commit più recente della pull request, passo per passo, così puoi guardare i controlli senza aprire il browser.

L'intestazione della chiusura dice a colpo d'occhio a che punto è la CI:

| Intestazione                           | Significato                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| `CI · 2/4 · Typecheck`                 | In corso: due passi su quattro fatti, `Typecheck` in esecuzione adesso.         |
| `CI · pasó`                            | Superata.                                                                       |
| `CI · falló`                           | Fallita.                                                                        |
| `CI · esperando el CI del último push` | In attesa: il tuo branch ha un commit che nessun run ha ancora preso in carico. |
| `CI · sin ejecuciones`                 | Nessun run per questo branch.                                                   |
| `CI · sin leer`                        | Non letta: `gh` non ha potuto rispondere, e il motivo appare sotto.             |

Aperta, elenca i passi con un segno nei colori di Narsil:

- `✓` verde: fatto.
- `✗` rosso: fallito, annullato, scaduto, in attesa di un'azione o non avviato.
- `◐` giallo: in esecuzione.
- `○` grigio: in coda o in attesa.
- `–` grigio: saltato o neutro.

I passi di servizio di GitHub stesso (`Set up job`, `Complete job`, `Post …`) vengono lasciati fuori, perché non dicono niente sul progetto. Con più workflow, il nome di ogni run fa da intestazione ai suoi passi; con più job, ogni job appare con il proprio segno.

Mentre un run è in corso, la chiusura interroga di nuovo ogni 10 secondi, e smette di interrogare appena la CI finisce. La chiusura resta come l'hai lasciata: l'avvio della sessione non la reimposta, e il commento del codice dice che mantiene come l'hai lasciata tra le sessioni (la prima guida spiega cosa dicono i tipi al riguardo). Mentre è chiusa, non viene interrogato niente.

## Come funziona dentro

### Quale pull request, quale repository

La chiusura della CI non cerca da sola una pull request. Usa quella che l'app desktop ha associato alla sessione, letta nelle guide precedenti tramite `$.mcp.call('ccd_pr', 'get_status', { session_id: 'self' })`. `parsePr` in `hooks/session.ts` conserva, per una pull request aperta, il suo url, il suo repository (`prRepo`, proprietario e nome, come `acme/shop`) e il suo branch di testa (`prHead`).

La chiusura viene disegnata solo quando `view.prUrl` è impostato. Quindi esiste solo nell'app desktop, dove esiste `ccd_pr`; la tabella delle superfici del README dice lo stesso.

### Interrogare `gh`

La parte pura vive in `hooks/ci.ts`: costruisce i comandi e legge il loro output. Il modulo degli hook li esegue in `readCi`, in `hooks/register.tsx`.

Prima, i run del branch:

```ts
export function runListArgv(repo: string, branch: string): string[] {
  return [
    'gh',
    'run',
    'list',
    '--repo',
    repo,
    '--branch',
    branch,
    '--json',
    RUN_FIELDS,
    '--limit',
    '20',
  ]
}
```

`RUN_FIELDS` è `'databaseId,headSha,workflowName,status,conclusion'`. `gh` elenca prima i più recenti, quindi `latestRuns` prende il commit del primo run (`headSha`) come il più recente, tiene solo i run di quel commit, e ne tiene uno per nome di workflow. I run dei commit più vecchi non si mescolano mai con quello attuale.

Poi, per ognuno di quei run, i suoi job e i suoi passi:

```ts
export function runViewArgv(repo: string, id: number): string[] {
  return ['gh', 'run', 'view', String(id), '--repo', repo, '--json', 'jobs']
}
```

`jobsOf` legge il nome, lo stato, la conclusione e i passi di ogni job, e scarta i passi di servizio con un'unica espressione regolare, `NOISE = /^(Set up job|Complete job|Post .+)$/`.

Gli stati della CI sono quelli di GitHub: uno `status` (`queued`, `in_progress`, `completed`) e, una volta completato, una `conclusion`. `markOf` trasforma quella coppia in un segno e un colore, e l'elenco delle conclusioni di fallimento (`FAILED`) è lo stesso ovunque: nel segno di un passo, nell'intestazione (`ciLabel`) e nel segno della chiusura stessa (`ciMark`).

### `$.process.run`, come lo usa il codice

I tipi della 2.1.325 descrivono `$.process.run(argv, init)` come l'esecuzione di "a command on the host by its argument vector (no shell)" (un comando sull'host tramite il suo vettore di argomenti, senza shell), che risolve `{ exitCode, stdout, stderr }` "once it exits, any exit code" (una volta terminato, con qualsiasi codice di uscita). Il timeout è di 30 secondi per impostazione predefinita e di dieci minuti al massimo; Narsil Check passa `GH_MS`, 30 secondi. Viene respinto quando il comando non può avviarsi o è ancora in esecuzione allo scadere del timeout. I tipi segnano anche l'intero sostantivo `process` come "CLI only" (solo CLI).

Ne seguono due cose, e il codice le gestisce entrambe:

- **Un'uscita diversa da zero è una risposta, non un'eccezione.** `readCi` controlla `list.exitCode !== 0` e tiene lo stderr di `gh` come errore, o "gh terminó con el código N" ("gh è terminato con il codice N") quando lo stderr è vuoto.
- **Un `gh` mancante è un'eccezione.** La chiamata viene respinta, il `catch` attorno a `readCi` tiene il messaggio, e la chiusura lo dice.

Dato che il vettore di argomenti non ha shell, i nomi del repository e del branch arrivano a `gh` come argomenti semplici: non c'è niente da mettere tra virgolette o da sottoporre a escape.

C'è un motivo per eseguire `gh` invece di chiamare l'API HTTP di GitHub dalla mod: `gh` porta l'accesso della persona stessa, così la mod non tiene mai un token di GitHub. Un commento in `hooks/register.tsx` dà un motivo correlato per eseguire git direttamente in "Actualizar rama": "The mod runs git itself, so the app asks no permission." (la mod esegue git da sola, così l'app non chiede nessun permesso).

### Aspettare un push

Subito dopo `git push`, GitHub potrebbe non aver avviato un run per il nuovo commit, e l'elenco mostra ancora il run del commit precedente, magari già verde. Mostrare "superata" in quel momento sarebbe sbagliato.

Quindi, quando il branch su cui sei è il branch di testa della pull request, `readCi` esegue anche `git rev-parse @{upstream}`. Se il commit upstream non è il commit dei run elencati, un push più recente non ha ancora un run, e la vista viene segnata come `isWaiting`: l'intestazione dice "esperando el CI del último push" e il segno è giallo.

### Ogni 10 secondi, e poi basta

L'interrogazione periodica è `watchCi`, un ciclo:

```tsx
let ciWatch = 0
async function watchCi($: EngineInterface): Promise<void> {
  const id = ++ciWatch
  let waits = 0
  for (;;) {
    const view = await read($, session)
    if (!view.prUrl || !(await read($, isCiOpen))) return
    await update($, ci, (current) =>
      current.status === 'ready' ? current : { ...current, status: 'loading' },
    )
    let next = await readCi($, view)
    if (id !== ciWatch) return
    // A push no workflow answers (a repository with no CI for it) stops waiting.
    if (next.isWaiting && ++waits > CI_WAIT_POLLS) next = { ...next, isWaiting: false }
    await update($, ci, () => next)
    if (next.error || !(next.isWaiting || isGoing(next.runs))) return
    await $.clock.sleep(CI_POLL_MS)
    if (id !== ciWatch) return
  }
}
```

È citato da [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Ogni riga è una regola:

- **Nessuna pull request, o la chiusura chiusa: fermati.** Non viene interrogato niente mentre non stai guardando.
- **Tieni l'ultima risposta mentre ricarichi.** Una vista che è già `ready` resta com'è durante la lettura successiva, così i passi non sfarfallano.
- **Una sola osservazione alla volta.** Ogni chiamata prende un nuovo `id`. Un'osservazione più recente (dalla lettura successiva della sessione, da una pull request trovata in ritardo, o dall'apertura della chiusura) fa fermare quella vecchia al suo controllo successivo.
- **Un push a cui nessuno risponde chiude l'attesa.** `CI_WAIT_POLLS` vale 12, quindi dopo circa due minuti un repository senza workflow per quel push smette di aspettare.
- **Fermati su un errore, o quando niente è in esecuzione e niente è atteso.** `isGoing` è vero finché lo stato di qualche run non è `completed`.
- **Altrimenti aspetta `CI_POLL_MS`, 10 secondi, con `$.clock.sleep`.** I tipi lo descrivono come qualcosa che risolve "after `ms` milliseconds" (dopo `ms` millisecondi).

I tipi offrono anche `$.clock.every(ms, fn)`, che chiama `fn` a ogni periodo finché non viene annullato. Il ciclo con `sleep` ha una proprietà adatta a questo caso: la lettura successiva inizia solo dopo che la precedente è finita, così le chiamate lente a `gh` non si sovrappongono mai, e il ciclo finisce da solo sulla condizione che ha appena letto.

L'osservazione viene avviata con `void watchCi($)` dopo una lettura completa della sessione, dopo una pull request trovata in ritardo, e quando apri la chiusura. Non viene mai attesa da un hook.

### Quando `gh` manca o non ha l'accesso

Entrambi i casi finiscono allo stesso modo. La vista riceve un `error`, l'intestazione dice `CI · sin leer`, il segno è `○` grigio, e la chiusura aperta mostra in rosso "No pude leer el CI con gh: …" ("non ho potuto leggere la CI con gh: …") seguito dal motivo: il messaggio del motore quando `gh` non ha potuto avviarsi, o lo stderr di `gh` stesso quando è stato eseguito e ha rifiutato, come fa quando non ha l'accesso. Il ciclo si ferma sull'errore; la lettura successiva della sessione o l'apertura della chiusura riprova.

Sui permessi, il README dice solo che `gh` deve essere installato e con l'accesso effettuato ("con `gh` instalado y con sesión iniciada"). Né il README né il codice elencano scope per leggere la CI. La nota del README sul permesso `workflow` riguarda il push di modifiche a `.github/workflows` via HTTPS, una funzionalità diversa.

## Costruiscila con Claude

Chiedi a Claude di seguire passo per passo, con `gh`, l'esecuzione di GitHub Actions della pull request della sessione. L'unica idea che deve fare bene è quando chiedere: solo le esecuzioni del commit più recente, solo mentre la sezione è aperta e un'esecuzione è in corso, e una sola osservazione alla volta.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nella mia mod di Claude Code `my-panel`, aggiungi una chiusura "CI" per la pull request aperta della sessione, di cui ho già il repository (`acme/shop`) e il branch di testa. Esegui `gh run list --repo <repo> --branch <branch> --json databaseId,headSha,workflowName,status,conclusion --limit 20` con `$.process.run` (timeout di 30 s), tieni solo i run dell'`headSha` della prima riga, uno per workflow, poi `gh run view <id> --repo <repo> --json jobs` per ciascuno. Nascondi i passi `Set up job`, `Complete job` e `Post …`. Mostra ogni passo con ✓ verde, ✗ rosso, ◐ giallo per in corso, ○ grigio per in coda e – grigio per saltato. Tratta un'uscita diversa da zero come un errore con lo stderr di gh, e anche un rifiuto (gh mancante) come un errore; mostralo nella chiusura. Interroga in un ciclo con `$.clock.sleep(10_000)` solo mentre la chiusura è aperta e un run non è completato, e altrimenti fermati; dai a ogni osservazione un id così una più recente la sostituisce. Testa i parser come funzioni pure con JSON di gh sintetico, e il ciclo con `mock.clock`.

### Cosa controllare nella risposta di Claude

1. Si conservano solo le esecuzioni dell'`headSha` della prima riga, una per workflow, così le esecuzioni di un commit più vecchio non si mescolano mai con quella attuale.
2. Un'uscita diversa da zero di `gh` viene letta come errore con il suo stderr, e anche un rifiuto, quando `gh` manca, compare come errore nella sezione.
3. Il ciclo aspetta 10 secondi con `$.clock.sleep` tra una lettura e l'altra, e si ferma quando la sezione è chiusa, quando nessuna esecuzione è ancora in corso o su un errore.
4. Ogni osservazione ha un id, così una più recente fa fermare quella vecchia, e l'osservazione parte con `void`, mai attesa in un hook.
5. I passi `Set up job`, `Complete job` e `Post …` sono nascosti, e ogni passo mostra il suo segno nel suo colore.

Se un controllo fallisce, di' a Claude cosa vedi: "la sezione continua a chiedere a gh ogni 10 secondi dopo che l'esecuzione è passata".

### Come l'ha chiesta l'autore

La richiesta originale per la chiusura della CI non è stata registrata. Nessuno dei log di task pubblici di narsil-check (`odd/tasks/*.md`) la copre.

#### Ricostruzione dalla cronologia dei commit

Da `git log -- hooks/ci.ts`, con i commit correlati a `hooks/register.tsx` e `hooks/session.ts`:

- `7d91264` (2026-11-07) "feat: add an Auto-fix switch to Entorno for the session's open pull request" (aggiunge a Entorno un interruttore Auto-fix per la pull request aperta della sessione). La sessione viene a sapere per la prima volta della sua pull request qui, tramite `ccd_pr`.
- `8af1f0e` (2026-11-07) "feat: show the PR's CI step by step in a collapsible fold under Remote Control" (mostra la CI della PR passo per passo in una chiusura comprimibile sotto il Remote Control). L'intero `hooks/ci.ts` arriva in questo solo commit. Il suo messaggio: "Reads the newest commit's GitHub Actions runs on the PR's head branch with gh, lists each job's steps without GitHub's bookkeeping ones, and polls every 10 seconds while a run goes or a push waits for one. The fold keeps its open state across sessions." (legge con gh i run di GitHub Actions del commit più recente sul branch di testa della PR, elenca i passi di ogni job senza quelli di servizio di GitHub, e interroga ogni 10 secondi mentre un run è in corso o un push ne aspetta uno. La chiusura mantiene il suo stato di apertura tra le sessioni). Cambia anche la `shape` dell'atom della sessione per i nuovi campi della pull request.
- `90c40f9` (2026-11-07) "fix: read the session's pull request again when the app binds it after the turn ends" (rilegge la pull request della sessione quando l'app la associa dopo la fine del turno). Senza di esso, una pull request aperta in un turno non mostrava nessuna CI fino alla lettura successiva.
- `f091e0b` (2026-11-07) "fix: retry only the pull request read and stop the retries when the session ends" (ripete solo la lettura della pull request e ferma i tentativi quando la sessione finisce).

Lo schema è diverso da quello delle guide precedenti: la chiusura della CI è arrivata completa in un solo commit, sopra l'infrastruttura della pull request del giorno prima, e le correzioni che sono seguite riguardavano il trovare la pull request, non la CI in sé.

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida. Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

Questa è una versione ridotta dell'idea, scritta per questa guida e verificata con i tipi di Claude Code 2.1.325. È adattata da `hooks/ci.ts` e `hooks/register.tsx` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Segue un solo workflow e lascia fuori l'attesa di un push.

Il tipo dello stato, in `types/index.d.ts`:

```ts
export type Step = { name: string; status: string; conclusion: string }
export type Ci = { steps: Step[]; isGoing: boolean; error?: string }

declare module 'claude-code' {
  interface PluginState {
    'my-panel': { ci: Ci }
  }
}
```

La parte del modulo degli hook, `hooks/register.tsx`:

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'
import type { Ci, Step } from '../types'

const ci = atom({ plugin: 'my-panel', key: 'ci' } as const, { steps: [], isGoing: false } as Ci)
const NOISE = /^(Set up job|Complete job|Post .+)$/

async function gh($: EngineInterface, argv: string[]): Promise<string> {
  const ran = await $.process.run(['gh', ...argv], { timeoutMs: 30_000 })
  if (ran.exitCode !== 0) throw new Error(ran.stderr.trim() || `gh ended with code ${ran.exitCode}`)
  return ran.stdout
}

async function readCi($: EngineInterface, repo: string, branch: string): Promise<Ci> {
  try {
    const fields = 'databaseId,headSha,status,conclusion'
    const runs = JSON.parse(
      await gh($, [
        'run',
        'list',
        '--repo',
        repo,
        '--branch',
        branch,
        '--json',
        fields,
        '--limit',
        '1',
      ]),
    )
    if (!Array.isArray(runs) || runs.length === 0) return { steps: [], isGoing: false }
    const run = runs[0] as { databaseId: number; status: string }
    const viewed = JSON.parse(
      await gh($, ['run', 'view', String(run.databaseId), '--repo', repo, '--json', 'jobs']),
    )
    const steps: Step[] = (viewed.jobs ?? [])
      .flatMap((job: { steps?: Step[] }) => job.steps ?? [])
      .filter((step: Step) => !NOISE.test(step.name))
    return { steps, isGoing: run.status !== 'completed' }
  } catch (err) {
    return { steps: [], isGoing: false, error: err instanceof Error ? err.message : String(err) }
  }
}

let watch = 0
export async function watchCi($: EngineInterface, repo: string, branch: string): Promise<void> {
  const id = ++watch
  for (;;) {
    const next = await readCi($, repo, branch)
    if (id !== watch) return
    await update($, ci, () => next)
    if (next.error || !next.isGoing) return
    await $.clock.sleep(10_000)
    if (id !== watch) return
  }
}

export const MARK = (s: Step) =>
  s.status !== 'completed'
    ? s.status === 'in_progress'
      ? { mark: '◐', color: '#F5B400' }
      : { mark: '○', color: '#8A90A6' }
    : s.conclusion === 'success'
      ? { mark: '✓', color: '#22B573' }
      : s.conclusion === 'skipped'
        ? { mark: '–', color: '#8A90A6' }
        : { mark: '✗', color: '#F0435A' }
```

Avvialo con `void watchCi($, 'acme/shop', 'feat/login').catch(() => undefined)` da un hook, senza mai attenderlo, e disegna i passi nell'hook `ui.render` del pannello con `read($, ci)`, un `Text` per passo nel suo colore `MARK`, e l'errore in rosso quando c'è. La versione ridotta di `MARK` tratta come fallimento qualsiasi conclusione completata diversa da success o skipped; `markOf` di Narsil Check nomina quelle di fallimento (`FAILED`) e mostra anche `neutral` in grigio.

## Errori comuni e come testarlo

Questi vengono dal codice e dai commit di Narsil Check:

- **Mescolare i commit.** `gh run list` restituisce run di più commit. Tieni solo i run del commit più recente, uno per workflow, come fa `latestRuns`.
- **Annunciare un successo subito dopo un push.** L'elenco può ancora mostrare il run verde del commit precedente. Confronta il commit upstream con l'`headSha` dei run, e smetti di aspettare dopo un limite (`CI_WAIT_POLLS`), altrimenti un repository senza CI per quel push aspetta per sempre.
- **Trattare il codice di uscita come un'eccezione.** `$.process.run` risolve con qualsiasi codice di uscita. Controlla `exitCode`, e tieni lo stderr come motivo.
- **Interrogare per sempre.** Fermati quando niente è in esecuzione, quando la chiusura è chiusa e su un errore. Il ciclo di Narsil Check ritorna in ognuno di questi casi.
- **Due osservazioni insieme.** Ogni lettura della sessione può avviare un'osservazione. Dai a ciascuna un id e lascia vincere la più recente.
- **Attendere l'osservazione in un hook.** Il `$.clock.sleep` di un hook consuma il budget di quell'hook, come dicono i tipi; avvia l'osservazione con `void`.
- **Mostrare i passi di servizio di GitHub.** I passi `Set up job` e `Post …` nascondono quelli che contano.

Per testare, `tests/ci.test.tsx` controlla le funzioni pure con JSON di `gh` sintetico: "the newest commit's runs, one per workflow, newest first" (i run del commit più recente, uno per workflow, prima i più recenti), "a run's steps leave out GitHub's own bookkeeping" (i passi di un run lasciano fuori quelli di servizio di GitHub), "each step shows as done, failed, going, waiting or skipped" (ogni passo appare come fatto, fallito, in corso, in attesa o saltato) e "the fold's line says how far the CI is" (la riga della chiusura dice a che punto è la CI). `tests/session.test.tsx` testa la chiusura nel pannello: risponde a `gh` tramite un hook `on('process.run', ...)` con chiave sul vettore di argomenti unito, e fa avanzare il tempo con `mock.clock` e `clock.advance(10_000)` in "the CI fold, under Remote Control, shows the PR's run step by step and follows it until it ends" (la chiusura della CI, sotto il Remote Control, mostra il run della PR passo per passo e lo segue finché non finisce). "a CI gh cannot read says why in its fold" (una CI che gh non riesce a leggere dice perché nella sua chiusura) risponde a ogni comando con codice di uscita 1 e si aspetta `CI · sin leer` e la riga rossa.

## Per andare oltre

- L'interruttore **Auto-fix** subito sotto la chiusura (guide precedenti) attiva il monitor della CI dell'app desktop stessa per la stessa pull request, che risveglia la sessione quando la CI fallisce; la chiusura mostra la CI, l'interruttore agisce su di essa.
- `ciLabel` conta i passi fatti in tutti i job e i run, e nomina il passo in esecuzione adesso, quindi spesso basta la sola intestazione mentre la chiusura resta chiusa.
- La chiusura legge i campi JSON di `gh`, non il suo output testuale, così un cambiamento nella formulazione di `gh` non la rompe.
