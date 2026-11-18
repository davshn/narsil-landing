---
title: Strumenti per Claude
description: 'Come Narsil Check dà a Claude quattro strumenti sulla lista di cose da fare con $.tool.register, li serve da hook tool.call, e come il modello decide quando usarli.'
route: check
order: 16
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/todos.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/todos.test.tsx
---

## Cosa fa

La lista di cose da fare della guida precedente è utile dal pannello. È più utile se puoi anche dire a Claude "annota nelle cose da fare che il test del login è instabile" nel mezzo di un'attività, o "fai l'attività del README", e Claude la trova, la fa, e la spunta.

Narsil Check dà a Claude quattro strumenti per questo:

| Strumento              | Cosa fa                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| `todo_list`            | Elenca le attività di questo progetto: id, nome e contenuto di ciascuna.                         |
| `todo_add`             | Aggiunge un'attività con un nome e un contenuto facoltativo.                                     |
| `todo_done`            | Rimuove un'attività finita, indicata dal suo id o dal suo nome esatto.                           |
| `todo_add_to_template` | Aggiunge un'attività alla lista di un altro progetto, di solito il modello da cui è nato questo. |

Claude li vede come `mcp__narsil-check__todo_list` e così via. Un'attività che Claude aggiunge compare subito nel pannello, e un'attività che aggiungi nel pannello è nel `todo_list` successivo. Condividono una lista e uno scrittore.

Il quarto strumento ha il suo comando. Quando fai in un progetto qualcosa che dovrebbe ricevere anche il modello da cui è nato, come un aggiornamento complicato, dici:

```text
/narsil-check template "in acme-template create the task of raising TypeScript to the next major, explain what we had to do"
```

Claude trova la cartella del modello accanto a questo progetto, scrive la spiegazione (sa come è stato fatto il lavoro; il pannello no), e aggiunge lì l'attività. Se non trova nessuna cartella, o ne trova diverse che si somigliano, ti chiede quale.

## Come funziona dentro

### Due metà: dichiarare e servire

Lo strumento di una mod ha due parti, e i tipi della 2.1.325 le descrivono entrambe sotto `$.tool.register`:

- **Dichiararlo**: `$.tool.register({ name, description, inputSchema })` "Declares a tool the model can call from the next prompt on" (dichiara uno strumento che il modello può chiamare dal prompt successivo in poi). Restituisce il nome completo, `mcp__<plugin>__<name>`.
- **Servirlo**: "Serve it with a `tool.call` hook on `{ tool: "mcp__<plugin>__<name>" }` that returns the result (a call no hook answers fails)" (servilo con un hook `tool.call` su `{ tool: "mcp__<plugin>__<name>" }` che restituisce il risultato; una chiamata a cui nessun hook risponde fallisce).

Così la mod dichiara quattro strumenti in `registerTools`, e aggiunge quattro hook `on('tool.call', { tool: … }, …)` che rispondono. I tipi aggiungono che la registrazione "Rejects until the session binds, at `session.start`" (viene rifiutata finché la sessione non si collega, a `session.start`), ed è per questo che `registerTools` viene chiamata dall'hook `session.start`. Lì non viene attesa, e il suo fallimento viene intercettato: se gli strumenti non si possono registrare, il resto del pannello funziona lo stesso.

### Le dichiarazioni

I nomi vengono da costanti in `hooks/todos.ts`. Le descrizioni e gli schemi sono in `hooks/register.tsx`, citati qui da [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later):

```ts
await $.tool.register({
  name: TOOL_LIST,
  description:
    "List this project's pending tasks (the Narsil Check pane's Pendientes): id, name and content of each.",
})
await $.tool.register({
  name: TOOL_ADD,
  description:
    "Add a task to this project's Pendientes list in the Narsil Check pane. Use it when the user asks to note something to do later.",
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Short task name' },
      content: { type: 'string', description: 'Optional details' },
    },
    required: ['name'],
  },
})
await $.tool.register({
  name: TOOL_DONE,
  description:
    "Remove a finished task from this project's Pendientes list. Call it when you complete a task that is on the list.",
  inputSchema: {
    type: 'object',
    properties: { task: { type: 'string', description: 'The task id, or its exact name' } },
    required: ['task'],
  },
})
```

In italiano, le tre descrizioni: "Elenca le attività in sospeso di questo progetto (le Pendientes del pannello di Narsil Check): id, nome e contenuto di ciascuna."; "Aggiunge un'attività alla lista Pendientes di questo progetto nel pannello di Narsil Check. Usalo quando l'utente chiede di annotare qualcosa da fare più tardi."; "Rimuove un'attività finita dalla lista Pendientes di questo progetto. Chiamalo quando completi un'attività che è nella lista." I campi dicono "Short task name" (nome breve dell'attività), "Optional details" (dettagli facoltativi) e "The task id, or its exact name" (l'id dell'attività, o il suo nome esatto).

Riformattato. `todo_list` non ha `inputSchema`; i tipi dicono che il default è `{ type: "object" }`, una chiamata senza argomenti. `todo_add_to_template` accetta `template` ("Folder name beside this project, or absolute path", nome di una cartella accanto a questo progetto, o percorso assoluto), `name` e `content` ("What to do and how it was done here: changes, files, problems and fixes", cosa fare e come è stato fatto qui: modifiche, file, problemi e soluzioni), con `template` e `name` obbligatori. La sua descrizione nomina una cartella di modello di esempio, `backendTemplate`.

### Servire una chiamata

Ogni hook legge gli argomenti dall'evento stesso: i tipi descrivono l'input di `tool.call` come portatore delle sue chiavi "beside the tool's own arguments" (accanto agli argomenti propri dello strumento), quindi il `name` di `todo_add` è `e.name`. L'hook li controlla, fa il lavoro attraverso le stesse funzioni che usa il pannello (`addTodo`, `finishTodo`, `readTodoFile`), e risponde con una di due forme:

- `{ result: text }`: l'output dello strumento, che il modello legge.
- `{ deny: text }`: con le parole dei tipi, "Refuses the call: the model receives the text as an error result" (rifiuta la chiamata: il modello riceve il testo come risultato di errore).

Il commento della mod registra un tranello: "An MCP-style { content, isError } object is refused by the engine." (un oggetto in stile MCP { content, isError } viene rifiutato dal motore). La risposta è `result` o `deny`, nient'altro.

Le risposte sono brevi frasi in inglese su cui il modello può agire:

- `todo_add`: `Added [mh3k2a1b4c9z] Review the README.` (aggiunta [mh3k2a1b4c9z] Review the README).
- `todo_done` con un'attività sconosciuta: `No pending task "readme". Call todo_list to see them.` (nessuna attività in sospeso "readme"; chiama todo_list per vederle), come errore.
- `todo_list` su una lista vuota: `No pending tasks.` (nessuna attività in sospeso).

Ogni hook gira dentro `answered`, che trasforma qualsiasi errore lanciato (un file che non si può leggere o scrivere) in `{ deny: 'The Pendientes list could not be changed: …' }` (non è stato possibile modificare la lista Pendientes: …). Senza di essa, una scrittura fallita sarebbe una chiamata di strumento fallita senza spiegazione. Con essa, Claude legge il perché e può dirtelo.

Quando la modifica ha incontrato una lista danneggiata (la guida precedente), la risposta porta la nota del pannello dopo `Note for the user:`, così Claude la riferisce. `todo_list` su un file danneggiato rifiuta con "cannot be read (…). Tell the user; a change will keep a copy of it and start a new list." (non si può leggere (…); dillo all'utente; una modifica ne terrà una copia e inizierà una lista nuova).

### Perché dare strumenti al modello

Claude poteva già modificare `.atl/narsil-check/pendientes.json` con i suoi strumenti per i file. Di solito funzionerebbe, e salterebbe tutto ciò che ha costruito la guida precedente: la catena che mette in fila le modifiche, la rilettura prima di scrivere, la copia di un file danneggiato, la riga di esclusione. Potrebbe anche scrivere una forma che il lettore rifiuta.

Uno strumento rende le regole della lista l'unica porta d'ingresso. Claude non ha bisogno di conoscere il formato, il percorso o le regole di sicurezza; dice "aggiungi questo" e la mod lo fa nello stesso modo in cui lo fa il pannello. Il risultato è anche verificabile: il testo dello strumento dice cosa è cambiato, con l'id.

C'è un secondo motivo, specifico dello strumento del modello: raggiunge un'altra cartella. `templateDir` risolve un nome in una cartella accanto a questo progetto, confrontando senza badare a maiuscole, trattini, trattini bassi o spazi, prima in modo esatto e altrimenti per contenimento. Rifiuta con una domanda quando non ce n'è nessuna o ce ne sono diverse: "Several folders in … match "…": a, b. Ask the user which one." (diverse cartelle in … corrispondono a "…": a, b; chiedi all'utente quale). Una regola così è molto più facile da mantenere nel codice che in un prompt.

### Come Claude decide di usarli

Il modello sceglie uno strumento da ciò che legge su di esso. Qui tre cose danno forma a quella scelta.

**La descrizione dice quando, non solo cosa.** `todo_add` finisce con "Use it when the user asks to note something to do later" (usalo quando l'utente chiede di annotare qualcosa da fare più tardi). `todo_done` dice "Call it when you complete a task that is on the list" (chiamalo quando completi un'attività che è nella lista). Quella seconda frase è ciò che porta Claude a spuntare da solo un'attività quando finisce il lavoro, come promette il README: "la tacha él mismo al terminarla" ("la spunta da solo quando la finisce").

**Gli strumenti aspettano dietro ToolSearch.** La mod non passa `isDeferred`. I tipi dicono che, se omesso, "the engine's rule places it: behind ToolSearch, as it places an MCP server's tool" (lo colloca la regola del motore: dietro ToolSearch, come colloca lo strumento di un server MCP). Il modello vede il nome dello strumento in un elenco di strumenti differiti, e carica lo schema completo solo quando lo cerca. Così i quattro strumenti non costano quasi niente di contesto finché non servono. Il commento della mod lo dice direttamente, "behind ToolSearch, so they cost nothing until used" (dietro ToolSearch, così non costano niente finché non si usano), e il README: "No las lee en cada mensaje, así que no gastan contexto hasta que las usa" ("Non li legge a ogni messaggio, quindi non consumano contesto finché non li usa"). Il prezzo è un passo di ricerca la prima volta. Nomi come `todo_add` in un server chiamato `narsil-check` rendono facile quella ricerca.

**Il comando nomina lo strumento.** `/narsil-check template "…"` non chiama lo strumento da sé. Invia un prompt con `$.prompt.submit`, costruito da `templatePrompt`, che dice quale strumento usare (`mcp__narsil-check__todo_add_to_template`), che il modello è un nome di cartella accanto a questo progetto o un percorso assoluto, di mettere nel contenuto cosa è stato cambiato, in quali file, cosa è fallito e come è stato risolto, e di chiedere se lo strumento non trova il modello. La richiesta della persona viene inserita tra virgolette. La mod consegna la parte che solo Claude può fare, la spiegazione, e tiene la parte che il codice fa meglio, trovare la cartella e scrivere il file.

Niente di tutto questo forza una chiamata. Il modello può comunque rispondere senza lo strumento, o chiedere prima. Le descrizioni rendono ovvia la chiamata giusta.

## Costruiscila con Claude

Chiedi a Claude di dare al modello degli strumenti sull'elenco che il pannello tiene già. L'unica idea che deve fare bene è che ogni strumento è sia dichiarato sia servito, e che ogni strumento passa per la stessa funzione di modifica che usa il pannello.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nella mia mod di Claude Code `my-panel`, dai a Claude degli strumenti sulla lista di cose da fare che tengo già in `.atl/my-panel/todos.json`. In `session.start`, senza attenderla e intercettando il suo fallimento, chiama `$.tool.register` tre volte: `todo_list` (nessun input), `todo_add` (`name` obbligatorio, `content` facoltativo) e `todo_done` (`task`, un id o un nome esatto). Scrivi ogni descrizione in modo che dica quando usarlo: "Use it when the user asks to note something to do later", "Call it when you complete a task that is on the list". Lascia fuori `isDeferred`. Servi ciascuno con `on('tool.call', { tool: 'mcp__my-panel__todo_add' }, …)`, leggendo gli argomenti dall'evento, e passa per la stessa funzione di modifica che usa il pannello. Rispondi `{ result: text }` con una frase breve che includa l'id dell'attività, o `{ deny: text }` per un input sbagliato o qualsiasi errore lanciato, mai un `{ content, isError }` in stile MCP. Testa ogni strumento chiamandolo con `$.tool.call` e controllando il file e il testo.

### Cosa controllare nella risposta di Claude

1. Gli strumenti vengono registrati con `$.tool.register` da `session.start`, senza attenderlo, e un errore viene intercettato così il pannello funziona comunque.
2. Ogni nome dichiarato ha il proprio hook `tool.call`, confrontato con il nome completo `mcp__<plugin>__<name>`.
3. Ogni hook risponde `{ result: text }` o `{ deny: text }`, mai un `{ content, isError }` in stile MCP, e qualsiasi errore lanciato diventa un `deny` con la sua causa.
4. Ogni descrizione dice quando usare lo strumento, non solo cosa fa.
5. Gli hook aggiungono, completano e leggono le attività con le stesse funzioni che usa il pannello. Nessuno strumento scrive il file a modo suo.

Se un controllo fallisce, di' a Claude cosa vedi: "ho chiesto a Claude di annotare un'attività e la chiamata allo strumento è fallita senza un motivo".

### Come l'ha chiesta l'autore

La richiesta originale per questi strumenti non è stata registrata. Nessun log di task pubblico in narsil-check copre la lista di cose da fare o i suoi strumenti. Ciò che segue è una ricostruzione.

#### Ricostruzione dalla cronologia dei commit

Da `git log -S tool.register` su `hooks/register.tsx` e `git log -- hooks/todos.ts` in narsil-check:

- `5439638` (2026-11-05) "feat: Pendientes, a per-project task list Claude can read and finish" (Pendientes, una lista di attività per progetto che Claude può leggere e finire). L'unico commit che aggiunge `$.tool.register`. Il suo messaggio: "Claude gets todo_list, todo_add and todo_done, and /narsil-check template "…" asks Claude to add a task, with how the work was done, to a template's list through todo_add_to_template." (Claude riceve todo_list, todo_add e todo_done, e /narsil-check template "…" chiede a Claude di aggiungere un'attività, con come è stato fatto il lavoro, alla lista di un modello tramite todo_add_to_template). La lista e gli strumenti sono stati costruiti insieme, così il pannello e Claude hanno condiviso uno scrittore fin dall'inizio.
- `8dc7904` (2026-11-05) "fix: keep a damaged Pendientes list and never let side steps block a save" (tiene una lista Pendientes danneggiata e non lascia mai che i passi secondari blocchino un salvataggio). Per gli strumenti: "Claude's tools return a readable error on any file failure" (gli strumenti di Claude restituiscono un errore leggibile per qualsiasi fallimento sul file). È da qui che viene `answered`.

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida. Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

Questa è una versione ridotta dell'idea, scritta per questa guida e verificata con i tipi di Claude Code 2.1.325 (`$.tool.register`, `on('tool.call', { tool }, …)`, le risposte `result` e `deny`). È adattata da `registerTools` e dagli hook `tool.call` in `hooks/register.tsx` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). `change` e `Task` sono quelli del codice della guida precedente, che si suppone stiano in `./todos`.

```ts
import type { EngineInterface, Register } from 'claude-code'
import { change, type Task } from './todos'

const PLUGIN = 'my-panel'

type Answer = { result: string } | { deny: string }

async function answered(fn: () => Promise<Answer>): Promise<Answer> {
  try {
    return await fn()
  } catch (err) {
    return {
      deny: `The list could not be changed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

async function registerTools($: EngineInterface): Promise<void> {
  await $.tool.register({
    name: 'todo_add',
    description:
      "Add a task to this project's to-do list. Use it when the user asks to note something to do later.",
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Short task name' } },
      required: ['name'],
    },
  })
  await $.tool.register({
    name: 'todo_done',
    description:
      "Remove a finished task from this project's to-do list. Call it when you complete a task that is on the list.",
    inputSchema: {
      type: 'object',
      properties: { task: { type: 'string', description: 'The task id, or its exact name' } },
      required: ['task'],
    },
  })
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    void registerTools($).catch(() => undefined)
    return next(e)
  })

  on('tool.call', { tool: `mcp__${PLUGIN}__todo_add` }, async ($, e) =>
    answered(async () => {
      const name = (e as unknown as { name?: unknown }).name
      if (typeof name !== 'string' || !name.trim()) return { deny: 'A task needs a name.' }
      const task: Task = { id: Date.now().toString(36), name: name.trim() }
      await change($, await $.session.cwd(), (tasks) => [...tasks, task])
      return { result: `Added [${task.id}] ${task.name}.` }
    }),
  )

  on('tool.call', { tool: `mcp__${PLUGIN}__todo_done` }, async ($, e) =>
    answered(async () => {
      const ref = String((e as unknown as { task?: unknown }).task ?? '').trim()
      let removed: Task | undefined
      await change($, await $.session.cwd(), (tasks) => {
        removed =
          tasks.find((t) => t.id === ref) ??
          tasks.find((t) => t.name.toLowerCase() === ref.toLowerCase())
        return tasks.filter((t) => t !== removed)
      })
      return removed
        ? { result: `Removed [${removed.id}] ${removed.name}.` }
        : { deny: `No task "${ref}".` }
    }),
  )
}
```

Usa il livello più alto di git del progetto invece di `$.session.cwd()` se la tua lista sta lì, come fa la guida precedente.

## Errori comuni e come testarlo

Questi vengono dal codice e dai test di Narsil Check:

- **Registrare prima che la sessione si colleghi.** `$.tool.register` rifiuta fino a `session.start`. Registra lì.
- **Dichiarare senza servire.** "a call no hook answers fails" (una chiamata a cui nessun hook risponde fallisce). Ogni nome ha bisogno del suo hook `tool.call`, abbinato sul nome completo `mcp__<plugin>__<name>`.
- **Rispondere nella forma di MCP.** `{ content, isError }` viene rifiutato. Usa `result` o `deny`.
- **Lasciar sfuggire un'eccezione.** Claude riceve un fallimento senza motivo. Avvolgi e rispondi `deny` con la causa.
- **Descrizioni che dicono solo cosa.** Di' anche quando chiamarlo; è su questo che il modello agisce.
- **Un secondo scrittore.** Uno strumento che scrive il file a modo suo aggira le regole di sicurezza. Riusa la funzione del pannello.
- **Confrontare i nomi con tolleranza nel codice ma con rigore nella descrizione.** `todo_done` accetta un id o un nome ignorando maiuscole e minuscole; il suo schema dice "exact name" (nome esatto), il che mantiene preciso il modello mentre il codice resta indulgente.

Per testare, `claude plugin test .` esegue `tests/todos.test.tsx`. "Claude's tools list, add and finish tasks, and a change made elsewhere is kept" (gli strumenti di Claude elencano, aggiungono e finiscono attività, e una modifica fatta altrove viene tenuta) chiama gli strumenti tramite `$.tool.call` e controlla i testi e il file, compresa un'attività che un altro scrittore ha aggiunto nel frattempo. "Claude is told about a damaged list instead of reading it as empty" (a Claude viene detto di una lista danneggiata invece di leggerla come vuota) controlla il `deny` su un file rotto, e "a list that cannot be written gives Claude a readable error, and the pane a toast" (una lista che non si può scrivere dà a Claude un errore leggibile, e al pannello un toast) il percorso di `answered`. "a task for a template lands in that folder, and an unclear name asks which one" (un'attività per un modello finisce in quella cartella, e un nome poco chiaro chiede quale), "a template named by its absolute path is used as given; an unknown one asks the user" (un modello indicato con il suo percorso assoluto viene usato così com'è; uno sconosciuto chiede all'utente) e "/narsil-check template hands the request to Claude, who knows how the work was done" (/narsil-check template passa la richiesta a Claude, che sa come è stato fatto il lavoro) coprono lo strumento del modello e il suo comando.

## Per andare oltre

- `$.tool.register` accetta anche `isDeferred: false`, che mette lo schema di uno strumento nell'elenco degli strumenti del prompt. Vale la pena solo per uno strumento di cui il modello ha bisogno quasi a ogni turno.
- Uno strumento `todo_update` che modifica il contenuto di un'attività permetterebbe a Claude di aggiungere ciò che ha imparato lavorandoci.
- Lo stesso schema serve per qualsiasi dato del pannello su cui il modello dovrebbe agire: uno strumento che legge le vulnerabilità della guida 14 permetterebbe a Claude di aprire da esse una PR di correzione.
- La prossima e ultima guida di questo percorso torna agli aggiornamenti, per il caso più difficile: Kotlin, Gradle e l'Android Gradle Plugin.
