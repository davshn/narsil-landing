---
title: Task e subagenti
description: "Come Narsil ricostruisce l'elenco dei task di una conversazione da TodoWrite, TaskCreate, TaskUpdate e dal piano dell'app desktop, e mostra ogni subagente come un chip con tipo, modello e tempo."
route: pet
order: 4
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/tasks.ts
  - repo: pet
    path: hooks/agents.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Cosa fa

Quando apri una conversazione nella fascia di Narsil (premendo il suo nome, come spiega la guida precedente), sotto una riga compaiono due elenchi.

**I suoi task**, ciascuno con un simbolo per il suo stato:

| Simbolo | Stato                                                    |
| ------- | -------------------------------------------------------- |
| ○       | In sospeso                                               |
| ◐       | In corso                                                 |
| ●       | Completato (disegnato attenuato)                         |
| ⟳       | In esecuzione in background dopo che Claude si è fermato |

L'elenco è quello che Claude tiene per sé mentre lavora: la todo list di `TodoWrite`, i task di `TaskCreate` e `TaskUpdate`, o il piano dell'app desktop. Vedi il piano e a che punto è senza scorrere la trascrizione.

**I suoi subagenti**, un piccolo serpente ciascuno, con:

- **Il suo tipo**, mostrato come accessorio: 🐍🔍 Explore, 🐍📜 Plan, 🐍📖 claude-code-guide, 🐍🪞 fork, un 🐍 senza nulla per general-purpose e 🐍✨ per qualsiasi altro tipo.
- **Il modello su cui gira e da quanto tempo è in esecuzione**, per esempio "🐍🔍 Explorar el overlay · Haiku 4.5 · 4 min" ("Esplora l'overlay").
- **Un avviso quando tace**: dopo cinque minuti senza usare alcuno strumento, il chip diventa giallo e aggiunge "sin actividad" ("nessuna attività"). Potrebbe essere bloccato.
- **Come è finito**, per qualche secondo: "✓ … · terminado en 1 min 20 s" (finito in), "✗ … · falló" (fallito) o "■ … · detenido" (fermato).

Un subagente che girava in background viene anche annunciato, con la voce di Narsil e nella finestra mobile, quando termina.

Poiché ogni conversazione comunica all'hub i suoi task e i suoi subagenti, puoi aprire la riga di un'altra conversazione e vedere il suo piano e i suoi subagenti da dove ti trovi.

## Come funziona dentro

### I task: rigiocare le chiamate degli strumenti

Claude Code non consegna a una mod "l'elenco dei task". Narsil lo ricostruisce osservando le chiamate degli strumenti che ne tengono uno, e applicando ogni chiamata all'elenco che ha già. La logica è una funzione pura, `applyTaskCall` in `hooks/tasks.ts`; l'hook in `hooks/register.tsx` si limita ad alimentarla.

Gli strumenti che legge (`TASK_TOOLS`) e cosa fa ogni chiamata all'elenco:

- **`TodoWrite`** invia ogni volta l'elenco intero (`todos`, ciascuno con `content` e `status`). L'elenco viene sostituito; gli id sono le posizioni, `1`, `2`, `3`.
- **`TaskCreate`** aggiunge un task. Il suo id non è nell'input: torna nel risultato dello strumento (`result.task.id`). Quindi l'hook legge il risultato, e se non c'è ripiega sulla posizione successiva.
- **`TaskUpdate`** cambia un task tramite `taskId`: un nuovo `status`, un nuovo `subject`, oppure `status: 'deleted'`, che lo rimuove.
- **`mcp__ccd_turn__update_plan`**, il piano dell'app desktop (`PLAN_TOOL`). `applyPlan` gestisce le sue forme: `items` sostituisce l'elenco; `advance: true` completa il passo in corso e avvia il successivo in sospeso; `done: [n]` completa i passi in base alla loro posizione, contando da 1; `start: n` sposta il segno di "in corso" sul passo `n`.
- **`mcp__ccd_turn__wrap_up`**, il riquadro del passo successivo dell'app desktop (`WRAP_UP_TOOL`). Chiude il turno e, nell'app, spunta il piano senza un ultimo `update_plan`. Per questo Narsil, quando lo vede, segna come completati tutti i task in sospeso o in corso. È la correzione descritta in "Come è stata chiesta all'IA".

L'hook in `tool.call` gestisce questi strumenti solo per la conversazione principale (`e.agentId === undefined`) e in un ordine preciso: prima attende `next(e)`, e applica la chiamata solo quando il risultato non è un errore e non è stato negato. Un `TaskUpdate` rifiutato non deve muovere l'elenco, e l'id di `TaskCreate` esiste solo dopo che lo strumento è stato eseguito. Poi scrive l'atom `tasks` e invia subito lo stato all'hub.

Il testo viene ripulito in ingresso: spazi compressi e taglio a 120 caratteri (`clean`), e l'elenco limitato a 30 task (`MAX_TASKS`), perché viaggia verso l'hub e il telefono a ogni battito.

### Il lavoro in background come task

Quando il ciclo principale si ferma, l'hook `classic.Stop` legge `e.background_tasks`: shell, monitor e subagenti ancora in esecuzione. `backgroundTasks` li trasforma in righe aggiuntive con il simbolo ⟳, come "proceso en segundo plano: npm run dev" ("processo in background"). Sono tenute separate dall'elenco dei task e unite a esso quando lo stato viene comunicato (`shownState`), e vengono cancellate al `turn.start` successivo. Lo stesso conteggio dice a `turn.complete` di non festeggiare una fine mentre il lavoro continua (vedi la prima guida).

### I subagenti: tre eventi

I chip vengono da tre eventi, e la scelta di ognuno è voluta:

- **`agent.spawn`** avvia un chip. L'hook attende `next(e)` e registra l'esecuzione sia dall'input sia dal risultato: `result.agentId`, `e.description` (il task), `e.subagentType`, `e.background` e `result.model`. Salta gli avvii negati e i compagni di squadra (`e.isTeammate`). Il commento in `hooks/register.tsx` spiega perché questo evento e non la chiamata allo strumento `Agent`: "one in the background returns at once" (uno in background ritorna subito), quindi la fine della chiamata allo strumento non dice nulla su quando finisce il subagente.
- **`tool.call` con `e.agentId` impostato**: il subagente ha usato uno strumento. `touchAgent` aggiorna il suo `lastActiveAt`. È questo che rende possibile "nessuna attività": Narsil sa l'ultima volta in cui ogni subagente ha fatto qualcosa.
- **`turn.complete` con `e.agentId` impostato**: è finito il turno del subagente stesso. `endAgent` salva `endedAt` e un esito ricavato da `e.reason`: `answer` è finito, `aborted` è fermato, qualsiasi altra cosa è fallito. Uno in background viene annunciato.

Le esecuzioni vivono nell'atom `agents`, i chip (testo e colore, pronti da disegnare) in `agentChips`.

### I chip si ricalcolano a ogni battito

Il tempo passa senza alcun evento: un subagente che non fa nulla non genera nulla. Per questo `refreshAgents` gira a ogni battito di due secondi (`beat`) oltre che dopo ciascuno dei tre eventi. Elimina le esecuzioni terminate da più di dieci secondi (`liveRuns`, `ENDED_SHOWN_MS`), ricalcola ogni chip con `agentChip`, e scrive l'atom e invia all'hub solo quando il testo o il colore di un chip è cambiato.

`agentChip` in `hooks/agents.ts` costruisce il testo:

- Il simbolo del tipo da `TYPE_MARK`, con ✨ per i tipi sconosciuti.
- Il task, poi il modello attraverso `modelLabel`, che legge id e alias come farebbe una persona: `claude-opus-5-5` diventa "Opus 5.5", `claude-3-5-sonnet-20241022` diventa "Sonnet 3.5" e `opus[1m]` diventa "Opus (1M)".
- I minuti, a partire da un minuto.
- "sin actividad" quando `now - lastActiveAt` raggiunge `QUIET_MS` (cinque minuti), con il tono giallo.
- Per un'esecuzione terminata, ✓ con il tempo da `took`, ✗ o ■.

I colori sono in `TONE_COLOR`: grigio per in esecuzione, giallo `#F5B400` per silenzioso, verde per finito, rosso per fallito e grigio-blu per fermato.

### Perché è diviso così

I due file, `hooks/tasks.ts` e `hooks/agents.ts`, sono puri: valori semplici in ingresso, valori semplici in uscita, nessun `$`. Il modulo degli hook possiede gli eventi e gli atom. È questa divisione che permette ai test di verificare ogni forma degli strumenti e ogni testo dei chip senza una sessione, e che permette allo stesso elenco di essere disegnato dalla fascia, dalla finestra mobile e dalla fascia di un'altra conversazione.

## Come è stata chiesta all’IA

### I task: registrati nel log di fleet-view

L'elenco dei task per conversazione è stato chiesto in `odd/tasks/fleet-view.md` in narsil-pet. In L2 (estratto), l'autore ha scritto:

> "al hacer click en el titulo de conversacion deberiamos poder ver sus sub agentes/ tareas y sus respectivos estados"

In italiano: facendo clic sul titolo di una conversazione si dovrebbero vedere i suoi subagenti e task con i loro stati.

E in L3 (estratto):

> "cuando entre a una de esas conversaciones estaria de nuevo su contexto, sus tareas con su estado (no es necesario barra de avance) y sus sub agentes"

In italiano: entrando in una di quelle conversazioni ci sarebbero di nuovo il suo contesto, i suoi task con il loro stato (non serve una barra di avanzamento) e i suoi subagenti. Per questo i task sono mostrati come simboli e non come percentuale.

L7 registra il risultato: la conversazione aperta mostra i suoi task e i suoi subagenti, e "Tasks come from TodoWrite, TaskCreate/TaskUpdate, the desktop app's update_plan (hooks/tasks.ts) and background work at Stop." (i task vengono da TodoWrite, TaskCreate/TaskUpdate, dall'update_plan dell'app desktop, in hooks/tasks.ts, e dal lavoro in background allo Stop).

Poi l'autore ha segnalato un bug, L12:

> "lo unico raro que veo es que las tareas de esta sesion las marca como en curso, o no empezadas, cuando el agente ya acabo, esto pasa en las dos ventanas, ademas note que creaste las tareas de la pwa en este proyecto, debias crearlo en proyecto de la pwa"

In italiano: l'unica cosa strana è che i task di questa sessione appaiono in corso o non iniziati quando l'agente ha già finito, in entrambe le finestre; l'autore ha anche notato che i task successivi per la PWA erano stati creati in questo progetto invece che nel progetto della PWA. (La seconda parte riguarda dove sono state salvate le note di seguito, non questa funzionalità.)

L13 registra la causa e la correzione: "the desktop app's `mcp__ccd_turn__wrap_up` checks the plan off with no last `update_plan`; the mod now marks every pending or in-progress task completed on it (hooks/tasks.ts)" (il `mcp__ccd_turn__wrap_up` dell'app desktop spunta il piano senza un ultimo `update_plan`; ora la mod, quando lo vede, segna come completati tutti i task in sospeso o in corso, in hooks/tasks.ts), con un test che falliva osservato prima. Il commit è `5e9ca71` (2026-11-06) "fix: check the plan off when the app's next-step box closes the turn" (spunta il piano quando il riquadro del passo successivo dell'app chiude il turno).

### I subagenti: ricostruzione dalla cronologia dei commit

La richiesta originale per i chip dei subagenti non è stata registrata. Da `git log -- hooks/agents.ts hooks/register.tsx`:

- `c885292` (2026-10-30) "feat: estimate when the context fills, react to tests and dangerous commands, show subagents" (stima quando si riempie il contesto, reagisce ai test e ai comandi pericolosi, mostra i subagenti). I primi chip.
- `e5ba5ca` (2026-10-30) "feat: show each subagent's type, time, quiet spells and outcome" (mostra il tipo, il tempo, i periodi di silenzio e l'esito di ogni subagente). I simboli per tipo, i minuti, l'avviso di silenzio e la conclusione.
- `f29cb5e` (2026-10-31) "feat: show the model of the main thread and of each subagent" (mostra il modello del thread principale e di ogni subagente). L'etichetta del modello.
- `519dd73` (2026-11-06) "fix: wait for background work before announcing a turn finished" (aspetta il lavoro in background prima di annunciare che un turno è finito). I subagenti in background diventano righe ⟳.
- `49f0fd9` (2026-11-06) "feat: list every open conversation in the band" (elenca nella fascia ogni conversazione aperta). Il suo messaggio dice che aprire una riga mostra "its context (the word opens what fills it), its tasks and its subagents" (il suo contesto, dove la parola apre ciò che lo riempie, i suoi task e i suoi subagenti).

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nella mia mod di Claude Code, mostra l'elenco dei task della conversazione principale nella fascia `AbovePrompt`. In `tool.call`, per le chiamate a `TodoWrite`, `TaskCreate` e `TaskUpdate` senza `agentId`, attendi `next(e)` e, quando il risultato non è un errore, applica la chiamata a un elenco conservato in un atom: `TodoWrite` lo sostituisce, `TaskCreate` aggiunge il task con l'id preso dal suo risultato, `TaskUpdate` ne cambia o ne elimina uno tramite `taskId`. Tieni questa logica come funzione pura in `hooks/tasks.ts`, con test per ogni strumento. Mostra anche una riga per ogni subagente in esecuzione: avviala su `agent.spawn` (task, `subagentType`, `result.model`), segnala come attiva a ogni suo `tool.call`, chiudila al suo `turn.complete` e ricalcola il testo ogni pochi secondi, così un subagente inattivo da cinque minuti lo dice. Verifica ogni campo sui tipi di plugin-authoring.

## Il codice minimo

Scritto per questa guida e verificato sui tipi della 2.1.325. È adattato da `hooks/tasks.ts`, `hooks/agents.ts` e `hooks/register.tsx` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). Gli atom `tasks` e `runs` sono dichiarati in `types/index.d.ts` come nella prima guida.

Il reducer puro, `hooks/tasks.ts`:

```ts
export type Task = { id: string; text: string; status: 'pending' | 'in_progress' | 'completed' }

const STATUSES = ['pending', 'in_progress', 'completed']
const statusOf = (v: unknown, fallback: Task['status'] = 'pending') =>
  STATUSES.includes(v as string) ? (v as Task['status']) : fallback

export function applyTaskCall(
  list: readonly Task[],
  tool: string,
  input: Record<string, unknown>,
  result?: unknown,
): readonly Task[] {
  if (tool === 'TodoWrite' && Array.isArray(input.todos)) {
    return (input.todos as Record<string, unknown>[]).map((t, i) => ({
      id: String(i + 1),
      text: String(t.content ?? ''),
      status: statusOf(t.status),
    }))
  }
  if (tool === 'TaskCreate') {
    const task = (result as { task?: { id?: unknown; subject?: unknown } } | undefined)?.task
    const id = task?.id === undefined ? String(list.length + 1) : String(task.id)
    return [
      ...list.filter((t) => t.id !== id),
      { id, text: String(task?.subject ?? input.subject ?? ''), status: 'pending' },
    ]
  }
  if (tool === 'TaskUpdate') {
    const id = String(input.taskId ?? '')
    if (input.status === 'deleted') return list.filter((t) => t.id !== id)
    return list.map((t) => (t.id === id ? { ...t, status: statusOf(input.status, t.status) } : t))
  }
  return list
}
```

Gli hook, in `hooks/register.tsx`:

```tsx
const TASK_TOOLS = new Set(['TodoWrite', 'TaskCreate', 'TaskUpdate'])
const QUIET_MS = 5 * 60_000

on('tool.call', async ($, e, next) => {
  if (e.agentId !== undefined) {
    const now = await $.clock.now()
    await update($, runs, (list) =>
      list.map((r) => (r.id === e.agentId ? { ...r, lastActiveAt: now } : r)),
    )
    return next(e)
  }
  if (!TASK_TOOLS.has(e.tool)) return next(e)
  const result = await next(e)
  if (!result.isError && !('deny' in result && result.deny)) {
    const input = e as unknown as Record<string, unknown>
    await update($, tasks, (list) =>
      applyTaskCall(list, e.tool, input, 'result' in result ? result.result : undefined),
    )
  }
  return result
})

on('agent.spawn', async ($, e, next) => {
  const result = await next(e)
  if ('deny' in result || e.isTeammate || !result.agentId) return result
  const now = await $.clock.now()
  const run = {
    id: result.agentId,
    task: e.description || 'task',
    type: e.subagentType,
    model: result.model,
    startedAt: now,
    lastActiveAt: now,
  }
  await update($, runs, (list) => [...list.filter((r) => r.id !== run.id), run])
  return result
})

on('turn.complete', async ($, e, next) => {
  const result = await next(e)
  if (e.agentId !== undefined)
    await update($, runs, (list) => list.filter((r) => r.id !== e.agentId))
  return result
})
```

Nell'hook di render, un'esecuzione è silenziosa quando `(await $.clock.now()) - run.lastActiveAt >= QUIET_MS`. Narsil conserva anche le esecuzioni terminate per dieci secondi per mostrare come sono finite, e ricalcola i chip su un battito di `$.clock.every`, così "nessuna attività" compare anche quando non arriva alcun evento. Una versione minima può fare lo stesso con `$.clock.every(5000, ...)` che aggiorna un atom letto dalla fascia.

## Errori comuni e come testarlo

- **Applicare la chiamata prima che sia stata eseguita.** L'id di `TaskCreate` è solo nel risultato, e una chiamata negata o fallita non deve cambiare l'elenco. Attendi `next(e)`, poi applica.
- **Trattare gli strumenti dei task dei subagenti come l'elenco principale.** Anche un subagente può chiamare `TodoWrite`. Narsil applica le chiamate dei task solo quando `e.agentId` non è definito.
- **Piani che non finiscono mai.** Nell'app desktop, il riquadro del passo successivo (`mcp__ccd_turn__wrap_up`) chiude il turno e spunta il piano senza un ultimo `update_plan`. Se non lo gestisci, gli ultimi passi restano "in corso" per sempre (fleet-view L12 e L13, commit `5e9ca71`).
- **Misurare il tempo dei subagenti dalla chiamata allo strumento `Agent`.** La chiamata allo strumento di un subagente in background ritorna subito. Usa `agent.spawn` e il `turn.complete` del subagente stesso.
- **Un avviso di silenzio che non compare mai.** Nessun evento viene generato mentre un subagente è inattivo. Ricalcola con un orologio.
- **Riscrivere lo stato a ogni tick.** Confronta prima di scrivere; il `refreshAgents` di Narsil scrive e invia solo quando un chip è cambiato.
- **Testo senza limiti.** I titoli e le descrizioni dei task possono essere lunghi. Ripuliscili e limitali prima che viaggino.

Per testare, `claude plugin test .` esegue `tests/narsil.test.tsx`. "the task tools leave this conversation its list, for the band and the hub" (gli strumenti dei task lasciano a questa conversazione il suo elenco, per la fascia e per l'hub) chiama `TodoWrite`, `TaskCreate` e `TaskUpdate`, poi il piano del desktop con `items` e `advance`, poi `mcp__ccd_turn__wrap_up`, e verifica le righe della fascia (" ● Leer", " ◐ Escribir el test") e l'elenco inviato all'hub. Per i subagenti, "each subagent shows its type, how long it has run, and when it has gone quiet" (ogni subagente mostra il suo tipo, da quanto è in esecuzione e quando è diventato silenzioso) fa avanzare un orologio simulato (`mock.clock`) e verifica i chip, compreso il giallo `#F5B400`; "a finished subagent stays a few seconds with how it ended, then leaves" (un subagente finito resta qualche secondo con il suo esito, poi se ne va), "each subagent shows the model it runs on" (ogni subagente mostra il modello su cui gira) e "the subagent chips show each type with its own mark" (i chip dei subagenti mostrano ogni tipo con il suo simbolo) coprono il resto.

## Per andare oltre

- `applyPlan` in `hooks/tasks.ts` gestisce ogni forma del piano dell'app desktop; `TASK_ICON` contiene i simboli.
- `backgroundTasks` dà un nome al lavoro in background in base al tipo: processo, monitor, subagente.
- `refreshAgents`, `touchAgent` ed `endAgent` in `hooks/register.tsx` gestiscono le esecuzioni; `endAgent` dà anche esperienza per un subagente che è finito bene (`gainXp($, 'agent')`) e annuncia quelli in background.
- `modelLabel` e `took` in `hooks/agents.ts` sono gli helper di formattazione, e `MAX_AGENTS_SHOWN` in `hooks/words.ts` limita la fascia a sei chip.
- Il blocco della conversazione aperta nell'hook di render di `AbovePrompt` disegna "Tareas:" e ogni task con `TASK_COLOR`, poi i chip, per qualunque conversazione sia aperta, usando i task e i chip che quella conversazione ha comunicato all'hub.
