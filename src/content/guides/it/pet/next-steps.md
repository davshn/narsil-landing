---
title: Prossimi passi
description: 'Come Narsil propone fino a tre prossimi passi 15 minuti dopo un turno, dai commit del progetto, dalle modifiche senza commit e dai task in sospeso, e mette nel prompt quello che scegli.'
route: pet
order: 12
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/advice.ts
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Cosa fa

Finisci un turno, leggi la risposta e ti allontani. Quando torni, la domanda è spesso la stessa: e adesso?

Quindici minuti dopo la fine di un turno, se nel frattempo non hai scritto niente, Narsil propone fino a tre prossimi passi. Nella fascia appaiono sotto una riga propria:

```text
➜ ¿Y ahora? Elige uno y te lo dejo en el prompt:
[ Añade reintentos con backoff a net.ts ]  [ Documenta el modo oscuro en el README ]
```

"E adesso? Scegline uno e te lo lascio nel prompt." (Il terminale mostra solo "➜ ¿Y ahora?".) Ogni passo è un pulsante, e ognuno è una richiesta scritta all'imperativo, pronta da inviare così com'è. L'esempio nel README è "Añade reintentos con backoff a net.ts" ("aggiungi tentativi ripetuti con backoff a net.ts").

Premere un passo non lo invia. Mette il testo nella casella del prompt come bozza, perché tu lo legga, lo modifichi e lo invii. Gli altri passi se ne vanno.

Il README dice che i passi rispondono a due domande: "¿cómo seguimos con el proyecto?" e "¿qué nos falta por hacer?" ("come andiamo avanti con il progetto?" e "cosa ci resta da fare?"). Per rispondere, Narsil legge gli ultimi commit, i file senza commit e, se il progetto li ha, i task in sospeso in `odd/tasks/*.md`.

Anche la finestra mobile mostra i passi. `/narsil pasos off` ("passi off") li disattiva, e la modalità discreta li lascia fuori.

## Come funziona dentro

### Quindici minuti dalla fine del turno

I prossimi passi non hanno un timer proprio. Si appoggiano all'orologio della cache della guida 8: quando un turno della conversazione principale finisce, `startCache` scrive l'atom `cache` con `at`, il momento in cui il turno è finito. A ogni battito di due secondi, `tickCache` fa il conto alla rovescia della cache e controlla anche:

```tsx
if (now - c.at >= STEPS_AFTER_MS) void offerSteps($, c.at).catch(() => undefined)
```

`STEPS_AFTER_MS` vale 15 minuti. "Se non hai scritto niente" non ha bisogno di stato in più: un nuovo prompt avvia un turno, `turn.start` svuota sia l'orologio della cache sia gli eventuali passi proposti, e non resta nessun `at` da cui contare.

I passi contano dalla fine del turno, `at`, non dall'inizio della sua ultima richiesta come fa la cache. La guida sull'orologio della cache spiega la differenza: la cache riguarda l'API, e i passi riguardano il fatto che tu sia via. Un test lo fissa: "next steps still wait from the end of the turn, however long its last request took" (i prossimi passi aspettano comunque dalla fine del turno, per quanto sia durata la sua ultima richiesta).

All'inizio l'attesa era di 3 minuti. Il commit `2bcc97c` l'ha portata a 15 in un commit intitolato "calm loop, steps and permission alerts" (calma gli avvisi di ciclo, dei passi e dei permessi), lo stesso che ha spostato il promemoria dei permessi della guida 10 da 2 a 5 minuti.

### Una volta per ogni turno finito

`offerSteps` chiede al massimo una volta per ogni turno. Ritorna subito quando:

- ha già chiesto per questo `at` (`stepsAskedFor`), oppure i passi per questo `at` sono in mostra;
- il turno si è fermato con lavoro in background ancora in esecuzione (guida 1): il lavoro non è finito, quindi non è il momento di chiedere cosa viene dopo;
- i passi sono disattivati, o la modalità discreta è attiva.

Segna il turno come già chiesto prima di controllare le preferenze. Attivare i passi più tardi non porta passi per un turno già passato; arrivano con quello successivo.

### Cosa legge il modello

I passi riutilizzano il contesto dei consigli della guida 11: lo stesso `seen`, lo stesso `describe`, lo stesso `sanitize`, con il motivo "Propón cómo seguir con el proyecto: qué falta por hacer, qué mejorar o qué funcionalidad viene después." ("proponi come andare avanti con il progetto: cosa resta da fare, cosa migliorare o quale funzionalità viene dopo").

Due parti vengono lette subito prima di chiedere. `readDiff` dà ciò che il turno ha cambiato, come per il consiglio di fine turno. `readProject` dà il punto in cui si trova il progetto, tre parti con `git` e il file system:

- `git log --oneline --no-decorate -10`: gli ultimi dieci commit.
- `git status --short`: i file senza commit.
- Fino a cinque file `.md` in `odd/tasks`, elencati con `$.fs.list` e letti con `$.fs.read`. Un percorso relativo sta sotto la directory di lavoro della sessione, come dicono i tipi della 2.1.325.

Da ogni file dei task, `pendingTasks` tiene solo ciò che non è finito: le righe `- [ ]` non spuntate, e le righe sotto un titolo `## Tasks` che dicono pending, pendiente, todo o in progress. Gli elementi spuntati e tutto ciò che sta sotto un titolo `Log` restano fuori. Il formato è quello che usano i file dei task dell'autore stesso; un progetto senza file del genere riceve comunque i suoi commit e il suo stato.

La parte del progetto è limitata a 2.000 caratteri e il diff a 3.000, dentro lo stesso contesto di 6.000 caratteri. Solo i passi leggono il progetto; un consiglio non lo fa mai.

### Il prompt esatto

`STEPS_SYSTEM` in `hooks/advice.ts`, citato così com'è in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). `MAX_STEPS` vale 3, `MAX_STEP` vale 90, e `NO_ROUTINE` è lo stesso divieto dei controlli di routine che usano i consigli.

```ts
export const STEPS_SYSTEM = [
  'Eres Narsil, una vieja serpiente marina sabia que acompaña a quien programa.',
  'El turno terminó hace unos minutos: propón los próximos pasos que la persona podría pedir ahora.',
  'Responden a "¿cómo seguimos con el proyecto?" y "¿qué nos falta por hacer?": la siguiente tarea pendiente,',
  'una funcionalidad que completa lo que se hizo, o una mejora de diseño que vale la pena.',
  'Reglas:',
  `- Entre uno y ${MAX_STEPS} pasos, uno por línea, en español, como mucho ${MAX_STEP} caracteres cada uno.`,
  '- Cada paso es una petición en imperativo que se le puede enviar tal cual (por ejemplo: "Añade reintentos con backoff a net.ts").',
  `- ${NO_ROUTINE}`,
  '- Concretos y sacados del contexto: las tareas pendientes, los commits recientes, los archivos sin commit; nada inventado.',
  '- Usa lenguaje neutro, sin suponer el género de la persona; no nombres a ningún asistente ni a "Claude".',
  '- Si no hay nada útil que proponer, responde exactamente SKIP.',
  'Responde solo con los pasos (o SKIP), sin comillas ni introducción.',
].join('\n')
```

In italiano: sei Narsil, un vecchio e saggio serpente marino che fa compagnia a chi programma. Il turno è finito qualche minuto fa: proponi i prossimi passi che la persona potrebbe chiedere adesso. Rispondono a "come andiamo avanti con il progetto?" e "cosa ci resta da fare?": il prossimo task in sospeso, una funzionalità che completa ciò che è stato fatto, o un miglioramento di design che vale la pena. Regole: tra uno e 3 passi, uno per riga, in spagnolo, al massimo 90 caratteri ciascuno. Ogni passo è una richiesta all'imperativo che si può inviare così com'è (per esempio: "aggiungi tentativi ripetuti con backoff a net.ts"). Niente controlli di routine (eseguire i test, controllare il push o il commit, vedere se l'errore non compare più). Concreti e presi dal contesto: i task in sospeso, i commit recenti, i file senza commit; niente di inventato. Usa un linguaggio neutro, senza presumere il genere della persona; non nominare nessun assistente né "Claude". Se non c'è niente di utile da proporre, rispondi esattamente SKIP. Rispondi solo con i passi (o SKIP), senza virgolette né introduzione.

Il messaggio dell'utente è `stepsPrompt(context)`: "Contexto del trabajo:" ("contesto del lavoro"), il contesto, e "Próximos pasos:" ("prossimi passi:") per chiudere. La chiamata è quella dei consigli: `$.model.complete` con `model: 'haiku'`, `effort: 'medium'`, `maxTokens: 2000` e `timeoutMs: 30_000`.

Chiedere imperativi che "si possono inviare così come sono" è la decisione di design che fa funzionare il clic: un passo è già un prompt, quindi riempirci la casella non richiede nessuna riscrittura.

### Leggere la risposta

`parseSteps` trasforma la risposta in un elenco: niente per `SKIP`; altrimenti un passo per riga, senza punti elenco, numeri né virgolette, con ogni "Claude" trasformato in "Narsil", al massimo tre, ciascuno tagliato a 90 caratteri con "…".

Poi un ultimo controllo: se l'atom `cache` non ha più lo stesso `at`, un nuovo turno è iniziato mentre il modello rispondeva, e i passi sono superati. Vengono scartati.

Altrimenti vengono scritti nell'atom `steps` con il loro `at`, registrati con `$.ui.log` ("➜ Narsil propone: …", "Narsil propone"), e inviati alla finestra mobile. Qualsiasi fallimento (git, i file, il modello) finisce in un `catch`: niente passi questa volta.

### Riempire il prompt al clic

Ogni passo è disegnato come un `Button` il cui `onPress` chiama `pickStep`:

```tsx
async function pickStep($: EngineInterface, step: string): Promise<void> {
  await $.prompt.fill({ text: step })
  await update($, steps, () => null)
  await pushOverlay($)
}
```

I tipi della 2.1.325 descrivono `$.prompt.fill` come qualcosa che mette `input.text` "in the prompt box as the draft" (nella casella del prompt come bozza), secondo `mode`: `replace` per impostazione predefinita, `append` dopo la bozza, `insert` al cursore. Dal codice seguono due conseguenze:

- Senza `mode`, un passo sostituisce qualunque bozza avessi nella casella.
- I tipi dicono che il risultato è `isFilled: false` "under a dialog or headless" (sotto una finestra di dialogo o senza interfaccia). Narsil non legge il risultato: svuota i passi in ogni caso. Il README descrive solo il caso normale.

Perché riempire invece di inviare? Un passo viene da un modello piccolo che legge un riassunto. Inviarlo avvierebbe un turno che non hai scelto, sul tuo account. Riempire la casella lascia a te la decisione, e ti permette di modificare prima il passo.

### I passi restano soli nella fascia

Quando arrivano i passi, `offerSteps` chiude anche ogni conversazione aperta nell'elenco della fascia (guida 3), così i passi si vedono da soli. Il commento nel render della fascia spiega la regola: "Next steps on offer close every conversation until you open one: then they hide, and come back once you close them all." (i prossimi passi proposti chiudono ogni conversazione finché non ne apri una: allora si nascondono, e tornano quando le chiudi tutte). È arrivato in `250d2c6`, "let next steps stand alone" (lascia che i prossimi passi restino da soli).

## Come è stata chiesta all’IA

La richiesta originale per i prossimi passi non è stata registrata. Sono arrivati il 2026-10-30, nello stesso commit dell'orologio della cache, prima dei log pubblici dei task. `docs/plan-advice.md`, il piano per i consigli, non li menziona.

### Registrato: dove vanno

Il design concordato per la fascia con ogni conversazione, `odd/tasks/fleet-view.md` in narsil-pet, L4, li colloca: "the tip and next steps of this window below" (il consiglio e i prossimi passi di questa finestra sotto) l'elenco. L4 è il design così come è stato concordato, messo per iscritto nel log, non le parole dell'autore stesso.

### Ricostruzione dalla cronologia dei commit

Da `git log -- hooks/register.tsx hooks/advice.ts`:

- `0993bd7` (2026-10-30) "feat: show a prompt-cache clock and offer next steps after a turn" (mostra un orologio della cache del prompt e propone i prossimi passi dopo un turno). I passi e l'orologio arrivano insieme, entrambi avviati dalla fine di un turno.
- `d1e6d40` (2026-11-04) "feat: make tips weigh design choices from the diff and next steps say what the project lacks" (fa sì che i consigli valutino le scelte di design dal diff e che i prossimi passi dicano cosa manca al progetto). Il suo messaggio: "Next steps read recent commits, git status and pending odd/tasks items to answer how the project goes on." (i prossimi passi leggono i commit recenti, git status e gli elementi in sospeso di odd/tasks per rispondere a come va avanti il progetto). `readProject`, `pendingTasks` e le due domande del prompt vengono da qui.
- `2bcc97c` (2026-11-05) "feat: open the context breakdown from the usage bars and calm loop, steps and permission alerts" (apre il dettaglio del contesto dalle barre di utilizzo e calma gli avvisi di ciclo, dei passi e dei permessi). Il suo messaggio: "next steps wait 15 minutes" (i prossimi passi aspettano 15 minuti). Prima aspettavano 3.
- `250d2c6` (2026-11-07) "feat: open the context from its percent and let next steps stand alone" (apre il contesto dalla sua percentuale e lascia che i prossimi passi restino da soli).
- `c3e4464` (2026-11-09) "fix: count the prompt cache from the start of its last request" (conta la cache del prompt dall'inizio della sua ultima richiesta). La cache è passata all'inizio della richiesta; i passi hanno continuato a contare dalla fine del turno.

Le correzioni seguono una direzione: da passi che arrivavano troppo presto e dicevano troppo poco, a passi che aspettano una pausa vera e leggono il piano del progetto stesso.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nella mia mod di Claude Code `my-pet`, proponi i prossimi passi dopo una pausa tranquilla. In `turn.complete`, per la conversazione principale, registra in un atom quando è finito il turno; svuotalo, insieme agli eventuali passi proposti, in `turn.start`. Su un battito `$.clock.every(2000, ...)`, una volta passati 15 minuti da quel momento e solo una volta per turno, leggi `git log --oneline -10` e `git status --short` con `$.process.run` e le righe `- [ ]` non spuntate di `odd/tasks/*.md` con `$.fs.list` e `$.fs.read`. Chiama `$.model.complete` con `model: 'haiku'` e un prompt di sistema che chieda da una a tre richieste all'imperativo, al massimo 90 caratteri ciascuna, che si possano inviare così come sono, prese da quel contesto, oppure esattamente `SKIP`. Scarta la risposta se nel frattempo è iniziato un nuovo turno. Mostra ogni passo come un `Button` nella fascia `AbovePrompt`; alla pressione, chiama `$.prompt.fill({ text })` e svuota i passi solo quando `isFilled` è true. Testa con un orologio simulato e `on('model.complete', ...)`: niente a 14 minuti, passi a 15, e il passo premuto che arriva a un hook `prompt.fill`.

## Il codice minimo

Scritto per questa guida e verificato con i tipi della 2.1.325 (`$.model.complete`, `$.process.run`, `$.fs.list`, `$.fs.read`, `$.prompt.fill` e il suo `isFilled`, `$.clock.every`, `turn.start`, `turn.complete`, `ui.render`). È adattato da `hooks/advice.ts` e `hooks/register.tsx` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). L'atom `ended` (`number | null`) e l'atom `steps` (`{ at: number; items: string[] } | null`) sono dichiarati in `types/index.d.ts` come nella prima guida.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const ended = atom({ plugin: 'my-pet', key: 'ended' } as const, null)
const steps = atom({ plugin: 'my-pet', key: 'steps' } as const, null)
const AFTER_MS = 15 * 60_000
const SYSTEM = [
  'Propose one to three next steps for this project, one per line, at most 90 characters each.',
  'Each one is an imperative request that can be sent as it is.',
  'Take them from the context (pending tasks, recent commits, uncommitted files); nothing invented.',
  'No routine checks. If there is nothing useful, answer exactly SKIP.',
].join('\n')
let askedFor: number | null = null

async function git($: EngineInterface, args: string[]): Promise<string> {
  try {
    const r = await $.process.run(['git', '--no-pager', ...args], { timeoutMs: 5000 })
    return r.exitCode === 0 ? r.stdout.trim() : ''
  } catch {
    return ''
  }
}

async function pending($: EngineInterface): Promise<string[]> {
  try {
    const files = (await $.fs.list('odd/tasks')).filter(
      (f) => f.kind === 'file' && f.name.endsWith('.md'),
    )
    const out: string[] = []
    for (const f of files.slice(0, 5)) {
      const text = await $.fs.read(`odd/tasks/${f.name}`)
      if (typeof text !== 'string') continue
      for (const line of text.split('\n')) {
        const m = /^\s*[-*]\s+\[ \]\s+(.*)$/.exec(line)
        if (m) out.push(m[1]!)
      }
    }
    return out
  } catch {
    return []
  }
}

async function offer($: EngineInterface, at: number): Promise<void> {
  if (askedFor === at) return
  askedFor = at
  const context = [
    `Recent commits:\n${await git($, ['log', '--oneline', '--no-decorate', '-10'])}`,
    `Uncommitted:\n${await git($, ['status', '--short'])}`,
    `Pending tasks:\n${(await pending($)).map((t) => `- ${t}`).join('\n')}`,
  ]
    .join('\n')
    .slice(0, 2000)
  const reply = await $.model.complete({
    model: 'haiku',
    system: SYSTEM,
    prompt: `Context:\n${context}\n\nNext steps:`,
    effort: 'medium',
    timeoutMs: 30_000,
  })
  if (!reply.isAnswered || /^\s*skip\b/i.test(reply.text)) return
  const items = reply.text
    .split('\n')
    .map((l) => l.trim().replace(/^([-*•]|\d+[.)])\s*/, ''))
    .filter(Boolean)
    .slice(0, 3)
    .map((s) => (s.length > 90 ? `${s.slice(0, 89)}…` : s))
  // A turn that started meanwhile makes them stale.
  if (items.length === 0 || (await read($, ended)) !== at) return
  await update($, steps, () => ({ at, items }))
}

async function beat($: EngineInterface): Promise<void> {
  const at = await read($, ended)
  if (at !== null && (await $.clock.now()) - at >= AFTER_MS)
    void offer($, at).catch(() => undefined)
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    $.clock.every(2000, () => void beat($))
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      await update($, ended, () => null)
      await update($, steps, () => null)
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined && e.reason === 'answer') {
      const now = await $.clock.now()
      await update($, ended, () => now)
    }
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const offered = (await read($, steps))?.items ?? []
    if (offered.length === 0) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    const pick = (step: string) => async () => {
      const { isFilled } = await $.prompt.fill({ text: step })
      if (isFilled) await update($, steps, () => null)
    }
    return (
      <Box flexDirection="row" gap={1} flexWrap="wrap" minWidth={0}>
        <Text dimColor>➜ And now?</Text>
        {offered.map((step, i) => (
          <Button key={`step-${i}`} label={step} onPress={pick(step)} />
        ))}
      </Box>
    )
  })
}
```

A differenza di Narsil, questa versione conserva i passi quando la casella non ha potuto essere riempita, così una pressione sotto una finestra di dialogo si può ripetere.

## Errori comuni e come testarlo

- **Passi per un turno che non è più l'ultimo.** Il modello impiega secondi; nel frattempo può arrivare un nuovo prompt. Confronta di nuovo il momento del turno dopo la risposta, come fa `offerSteps`.
- **Chiedere a ogni battito.** Il controllo viene eseguito ogni due secondi. Senza un segno per turno (`stepsAskedFor`), ogni battito dopo il quindicesimo minuto interrogherebbe di nuovo il modello.
- **Inviare invece di riempire.** Un passo proposto da un modello piccolo dovrebbe arrivare alla casella, non al modello. Lascia che sia la persona a premere Invio.
- **Sostituire una bozza senza volerlo.** `$.prompt.fill` sostituisce la bozza per impostazione predefinita. Se vuoi conservarla, passa `mode: 'append'` o `mode: 'insert'`.
- **Leggere l'intero file dei task.** I task completati e il log aggiungono solo rumore e lunghezza. Tieni le righe non finite, come fa `pendingTasks`.
- **Contare dall'ultima richiesta.** I passi riguardano una pausa nel tuo lavoro; conta dalla fine del turno.

Per testare, `claude plugin test .` esegue `tests/narsil.test.tsx` con un orologio simulato, il modello a cui risponde `on('model.complete', ...)` e la casella del prompt a cui risponde `on('prompt.fill', ...)`. "a few minutes after a turn Narsil offers next steps, and one click puts it in the prompt" (qualche minuto dopo un turno Narsil propone i prossimi passi, e un clic lo mette nel prompt) non trova passi a 14 minuti, ne trova tre a 15, controlla che chiudano le conversazioni e si nascondano quando se ne apre una, preme il secondo e si aspetta esattamente il suo testo nella casella, e controlla che per un turno si chieda una volta. "a new turn before the minutes pass, or /narsil pasos off, offers no next steps" (un nuovo turno prima che passino i minuti, o /narsil pasos off, non propone prossimi passi) e "the next steps ask how the project goes on, from its log, its status and its pending tasks" (i prossimi passi chiedono come va avanti il progetto, dal suo log, dal suo stato e dai suoi task in sospeso) coprono il resto; l'ultimo controlla che un task spuntato e il log non arrivino mai al prompt.

## Per andare oltre

- `stepsCommand` in `hooks/register.tsx` gestisce `/narsil pasos on` e `off`, accanto a `/narsil cache`.
- `shownState` invia i passi all'hub, così la finestra mobile li mostra con la conversazione; lo stato per il telefono li lascia fuori per le altre conversazioni.
- `pendingTasks` in `hooks/advice.ts` legge anche i task in una tabella sotto `## Tasks`, in base alle parole pending, pendiente, todo o in progress, così funziona anche un log dei task scritto come tabella.
- Con i consigli della guida 11 e questa guida, ogni chiamata al modello che Narsil fa passa per `$.model.complete` con Haiku, tranne il consiglio profondo, che fa il fork della sessione.
