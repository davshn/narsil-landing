---
title: Permessi che aspettano
description: 'Come Narsil insiste una volta quando un permesso, una domanda o un piano ti aspetta da cinque minuti, e perché controlla con un battito invece di impostare un timer.'
route: pet
order: 10
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/watch.ts
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: overlay/server.cjs
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Cosa fa

Claude si ferma spesso a metà di un turno per chiederti qualcosa: il permesso di eseguire uno strumento, una domanda, o un piano da approvare. Narsil te lo dice in quel momento, come mostrano le guide precedenti (lo stato "TE NECESITA", la voce, la finestra mobile).

Ma quel primo avviso è facile da perdere. Eri in un'altra finestra, oppure l'hai visto e volevi tornarci. Cinque minuti dopo, se la stessa cosa è ancora in attesa, Narsil insiste una volta:

```text
Sigo esperándote
Sigo esperándote desde hace 5 min: pido permiso para usar Bash.
```

"Ti sto ancora aspettando, da 5 minuti ormai: chiedo il permesso di usare Bash." La seconda metà nomina ciò che è in attesa, quindi una domanda si legge "tengo una pregunta para ti" ("ho una domanda per te") e un piano "tengo un plan para que lo apruebes" ("ho un piano da farti approvare").

L'insistenza esce come un avviso di domanda: nella finestra mobile, ad alta voce con una delle frasi di `stillWaiting` ("Sigo aquí, esperándote.", "sono ancora qui, ti aspetto"), e sul telefono secondo le regole della guida su voce e avvisi. Il README aggiunge il dettaglio che la distingue dal primo avviso: si mostra "aunque estés mirando Claude", anche mentre stai guardando Claude.

Succede una volta per ogni attesa. Se continui a non rispondere, Narsil non continua a insistere.

## Come funziona dentro

### Un'attesa è una variabile di modulo

Ciò che è in attesa è contenuto in una variabile in `hooks/register.tsx`:

```tsx
let waiting: { since: number; what: string; isNudged: boolean } | null = null
```

`startWaiting($, what)` la riempie con l'ora attuale presa da `$.clock.now()`; `stopWaiting()` la riporta a `null`. Una variabile di modulo basta: l'attesa appartiene a questa conversazione, e nessun altro la legge.

### Cosa avvia un'attesa

Tre punti chiamano `startWaiting`, gli stessi tre che sollevano il primo avviso:

- **`classic.PermissionRequest`**, una finestra di dialogo dei permessi. La prima guida spiega perché Narsil ascolta qui e non `tool.check`: il motore lo solleva solo quando sta per mostrarti la finestra di dialogo. L'hook lo salta comunque quando un hook delle impostazioni ha già risposto (`result.decision` è impostato) o la modalità è `bypassPermissions`.
- **`tool.call` per `AskUserQuestion` o `ExitPlanMode`**, una domanda o un piano. Qui l'attesa avvolge la chiamata stessa: `startWaiting` prima di `next(e)`, e `stopWaiting()` in un `finally`, così finisce quando lo strumento ritorna, in qualunque modo ritorni.
- **`turn.complete` con una domanda nel riquadro del prossimo passo dell'app desktop**, un turno che è finito chiedendoti qualcosa.

### Cosa la termina

Non viene impostato nessun timer, quindi non c'è niente da annullare. Un'attesa finisce quando `waiting` torna a `null`, e ogni segnale che hai risposto fa questo:

- `classic.PostToolUse` e `classic.PostToolUseFailure`: lo strumento è stato eseguito, quindi l'hai permesso.
- `classic.PermissionDenied`: hai detto di no. Il commento sopra questi tre hook: "A permission answered, either way: nothing waits any more." (un permesso a cui si è risposto, in un modo o nell'altro: non aspetta più niente).
- Qualsiasi altro `tool.call`: è iniziato un altro passo, quindi qualunque cosa fosse in attesa ha avuto risposta.
- `turn.start` e `turn.complete`: un nuovo turno, o la fine di questo.

### Nessun timer: controlla il battito

Narsil ha già un battito: `$.clock.every(2000, ...)` avviato in `session.start`, che fa anche il conto alla rovescia della cache (guida 8). A ogni battito, `tickWatch` si pone una domanda:

```tsx
if (waiting && !waiting.isNudged && now - waiting.since >= NUDGE_AFTER_MS) {
  waiting.isNudged = true
  const text = nudgeText(waiting.what, now - waiting.since)
  void announce($, 'question', 'Sigo esperándote', text, say('stillWaiting'), true).catch(
    () => undefined,
  )
}
```

I tipi della 2.1.325 offrono un timer a colpo singolo, `$.clock.after`, e una versione potrebbe avviarne uno in ogni `startWaiting` e annullarlo in ogni `stopWaiting`. Narsil non lo fa, e il suo codice dice perché in un altro punto: un commento in `turn.complete` nota che un ricaricamento della mod, che segue ogni turno che l'ha modificata, annulla i timer di `$.clock`. Con il battito, il controllo è un confronto tra due numeri, e nessuno dei punti che terminano un'attesa deve ricordarsi di un timer.

Neanche il battito fa sopravvivere l'attesa a un ricaricamento: `waiting` è una variabile di modulo e ricomincia vuota. La differenza sta nel modo in cui fallisce. Un'attesa persa significa un promemoria mancato, mai un promemoria per qualcosa a cui hai già risposto.

### Perché una volta, e perché cinque minuti

`isNudged` fa sì che succeda una volta. Un promemoria ogni cinque minuti trasformerebbe Narsil nel tipo di allarme che le persone spengono, e il primo avviso più un promemoria coprono già il caso abituale di una notifica persa.

Cinque minuti è `NUDGE_AFTER_MS` in `hooks/watch.ts`. All'inizio erano due minuti; il commit che l'ha alzato, `2bcc97c`, si intitola "calm loop, steps and permission alerts" (calma gli avvisi di ciclo, dei passi e dei permessi). Lo stesso commit ha spostato i prossimi passi da 3 a 15 minuti: l'autore stava diradando tutto ciò che Narsil dice senza che le venga chiesto.

`nudgeText` costruisce la frase; `took` da `hooks/agents.ts` scrive il tempo ("5 min").

### Perché si mostra anche mentre guardi

L'ultimo argomento di `announce`, `true`, è `force`. La finestra mobile della guida 5 normalmente appare solo quando Claude non è in primo piano. Un evento forzato viene mostrato comunque: `overlay/server.cjs` mostra l'evento quando Claude non è in primo piano o l'evento è forzato, e un evento forzato riapre anche una finestra che hai chiuso meno di un minuto prima.

Né il codice né il README dicono perché; la lettura di questa guida è che, se sono passati cinque minuti e la cosa è ancora in attesa, il primo avviso non ha funzionato, e il fatto che Claude sia in primo piano non significa che tu l'abbia visto.

`announce` rispetta le scelte della persona: silenziato o discreto significa niente voce, e la finestra mobile disattivata significa invece una notifica di sistema. La modalità discreta (`/narsil discreto`) silenzia solo gli annunci di fine turno, quindi un promemoria che qualcosa ha bisogno di te arriva comunque, senza la voce.

## Come è stata chiesta all’IA

La richiesta originale per il promemoria non è stata registrata. È arrivato il 2026-10-30, prima dei log pubblici dei task.

### Registrato: l'avviso di ciclo che se n'è andato

Il promemoria è nato nello stesso commit di un avviso di ciclo, che avvertiva quando Claude continuava a fallire o a modificare gli stessi file. La prima richiesta dell'autore in `odd/tasks/fleet-view.md` in narsil-pet, L1 (2026-11-06, estratto), ha rimosso quello:

> "(eliminariamos la alerta de bucle, no la he sentido tan util)"

In italiano: elimineremmo l'avviso di ciclo, non l'ho trovato così utile. Il log dei task lo trasforma in S9, "Loop alert removed" (avviso di ciclo rimosso), e il commit `21e7288` lo elimina. Il promemoria per un permesso in attesa è rimasto.

### Ricostruzione dalla cronologia dei commit

Da `git log -- hooks/register.tsx hooks/watch.ts`:

- `2027f06` (2026-10-30) "fix(alerts): only alert when a permission dialog needs your answer" (avvisa solo quando una finestra di dialogo dei permessi ha bisogno della tua risposta). Il passaggio a `classic.PermissionRequest`, che decide anche cosa avvia un'attesa.
- `f7a494e` (2026-10-30) "feat: warn about loops, insist on waiting permissions and sum the session up" (avverte dei cicli, insiste sui permessi in attesa e riassume la sessione). Il promemoria, con un'attesa di due minuti.
- `2532e7c` (2026-11-02) "feat: alert as a question when a turn ends asking in the desktop app's next-step box" (avvisa come domanda quando un turno finisce chiedendo nel riquadro del prossimo passo dell'app desktop). Oggi anche quella domanda è un'attesa.
- `2bcc97c` (2026-11-05) "feat: open the context breakdown from the usage bars and calm loop, steps and permission alerts" (apre il dettaglio del contesto dalle barre di utilizzo e calma gli avvisi di ciclo, dei passi e dei permessi). Il suo messaggio: "a waiting permission is insisted on after 5 minutes" (su un permesso in attesa si insiste dopo 5 minuti).
- `21e7288` (2026-11-06) "refactor: drop the loop alert, the spending count and the open-conversations line" (elimina l'avviso di ciclo, il conteggio della spesa e la riga delle conversazioni aperte).

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nella mia mod di Claude Code `my-pet`, ricordami una volta quando un permesso aspetta troppo. Tieni una variabile di modulo `waiting` con `since`, `what` e `isNudged`. Avviala in `classic.PermissionRequest` dopo `next(e)`, a meno che `result.decision` sia impostato o `e.permission_mode` sia `bypassPermissions`. Svuotala in `classic.PostToolUse`, `classic.PostToolUseFailure`, `classic.PermissionDenied`, qualsiasi altro `tool.call`, `turn.start` e `turn.complete`. Non usare `$.clock.after`: in `session.start`, avvia un battito `$.clock.every(2000, ...)` che, quando sono passati cinque minuti e `isNudged` è false, lo imposti e invii una notifica con `$.ui.notify`. Aggiungi un test con un orologio simulato: niente a 4 minuti e 50 secondi, esattamente un promemoria dopo 15 minuti, e nessuno quando al permesso si è risposto dopo un minuto.

## Il codice minimo

Scritto per questa guida e verificato con i tipi della 2.1.325 (`classic.PermissionRequest` e il suo `decision`, `classic.PostToolUse`, `classic.PostToolUseFailure`, `classic.PermissionDenied`, `$.clock.every`, `$.clock.now`, `$.ui.notify`). È adattato da `hooks/register.tsx` e `hooks/watch.ts` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later).

```tsx
import type { EngineInterface, Register } from 'claude-code'

const NUDGE_AFTER_MS = 5 * 60_000
let waiting: { since: number; what: string; isNudged: boolean } | null = null

async function startWaiting($: EngineInterface, what: string): Promise<void> {
  waiting = { since: await $.clock.now(), what, isNudged: false }
}

function stopWaiting(): void {
  waiting = null
}

async function beat($: EngineInterface): Promise<void> {
  if (!waiting || waiting.isNudged) return
  const waited = (await $.clock.now()) - waiting.since
  if (waited < NUDGE_AFTER_MS) return
  waiting.isNudged = true
  const minutes = Math.round(waited / 60_000)
  void $.ui
    .notify(`Still waiting for you after ${minutes} min: ${waiting.what}`, { title: 'my-pet' })
    .catch(() => undefined)
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    $.clock.every(2000, () => void beat($))
    return next(e)
  })

  on('classic.PermissionRequest', async ($, e, next) => {
    const result = await next(e)
    const isDecided = result.decision !== undefined || e.permission_mode === 'bypassPermissions'
    if (!isDecided) await startWaiting($, `permission to use ${e.tool_name}.`)
    return result
  })

  // Answered, either way: nothing waits any more.
  on('classic.PostToolUse', async ($, e, next) => {
    stopWaiting()
    return next(e)
  })
  on('classic.PostToolUseFailure', async ($, e, next) => {
    stopWaiting()
    return next(e)
  })
  on('classic.PermissionDenied', async ($, e, next) => {
    stopWaiting()
    return next(e)
  })
  // A subagent's turns are not this conversation's: they leave the wait alone.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) stopWaiting()
    return next(e)
  })
  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) stopWaiting()
    return next(e)
  })
}
```

Narsil svuota l'attesa anche nel suo hook `tool.call`, dove l'inizio di un altro passo significa che all'attesa si è risposto, e lì ne avvia una per `AskUserQuestion` e `ExitPlanMode`. La prima guida mostra una versione di quell'hook.

## Errori comuni e come testarlo

- **Avviare un'attesa per richieste che nessuno vede.** Con bypass permissions, o quando risponde un hook delle impostazioni, non appare nessuna finestra di dialogo. Controlla `result.decision` e `e.permission_mode` dopo `next(e)`.
- **Dimenticare una via d'uscita.** Un'attesa che non viene mai svuotata ti ricorda qualcosa a cui hai risposto molto tempo fa. Elenca ogni percorso: permesso, fallito, negato, un altro passo, un nuovo turno.
- **Insistere per sempre.** Senza il flag `isNudged`, il battito te lo ricorda ogni due secondi dopo il quinto minuto.
- **Affidarsi a un timer attraverso un ricaricamento.** I timer di `$.clock` muoiono con un ricaricamento della mod. Un battito che confronta orari è più facile da capire.
- **Bloccare il battito.** Il promemoria viene inviato con `void … .catch(...)`: una notifica lenta non deve trattenere il battito che conta anche la cache.

Per testare, `claude plugin test .` esegue `tests/narsil.test.tsx` con un orologio simulato. "a permission left waiting five minutes is insisted on once, even while you look" (su un permesso lasciato in attesa cinque minuti si insiste una volta, anche mentre guardi) solleva un `classic.PermissionRequest`, non trova nessun promemoria a 4 minuti e 50 secondi, poi esattamente uno dopo altri dieci minuti, di tipo `question`, con `force` impostato e il testo "Sigo esperándote desde hace 5 min: pido permiso para usar Bash.". "a permission or question answered in time is not insisted on" (su un permesso o una domanda a cui si risponde in tempo non si insiste) risponde dopo un minuto e non se ne aspetta nessuno.

## Per andare oltre

- `tickWatch` in `hooks/register.tsx` riassume anche la sessione dopo 30 minuti tranquilli (`IDLE_SUMMARY_MS` e `summaryText` in `hooks/watch.ts`), mostrato come un consiglio.
- `announceQuestion` solleva il primo avviso per gli stessi tre casi, e `setMood($, 'asking', ...)` mette la fascia in "TE NECESITA".
- L'hub della guida 3 mette una conversazione che aspetta sopra una che lavora, così il promemoria e l'elenco concordano su ciò che conta.
