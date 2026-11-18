---
title: L'oggetto $
description: Le aree dell'interfaccia del motore che ogni hook riceve, con le loro firme reali e dove narsil-pet e narsil-check usano ciascuna.
route: mods
order: 2
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: types/index.d.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: types/index.d.ts
---

## Cosa fa

Ogni hook riceve `$`, l'interfaccia del motore. Una mod non ha Node né browser, quindi `$` è il suo unico modo per raggiungere l'esterno: lo schermo, i suoi dati salvati, l'orologio, la rete, i processi, i file, la sessione, il modello, gli strumenti e i comandi.

Questa guida è una mappa di `$`. Mostra quale area fa cosa, così puoi chiedere a Claude la cosa giusta e riconoscere una chiamata che non esiste. Ogni metodo compare con la sua firma come la dichiara Claude Code 2.1.325, e con il punto in cui la usano le mod di Narsil.

`$` ha più di quanto trovi qui (temi, impostazioni, agenti, telemetria e altro). Il file di dichiarazioni, `claude-code.d.ts`, documenta ogni nome e ogni metodo con il suo commento di documentazione e un esempio.

## Come funziona dentro

Ogni metodo di `$` è una chiamata che passa per l'host: viene sollevata come evento, quindi gli hook di altri plugin possono vederla, riscriverla o rifiutarla, e quasi tutti i metodi restituiscono una promise. I tipi vengono dal modulo `claude-code`:

```ts
import type { EngineInterface } from 'claude-code'
```

Un helper che riceve `$: EngineInterface` può usare le stesse chiamate di un hook.

| Area        | A cosa serve                                                                                      | Usata in                                   |
| ----------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `$.ui`      | Toast, notifiche, righe di log, la riga di stato, i pannelli, gli appunti, le tabelle di elementi | entrambe                                   |
| `$.store`   | Dati JSON conservati tra una sessione e l'altra                                                   | entrambe                                   |
| `$.state`   | Valori con nome per la sessione, letti durante il disegno                                         | entrambe, tramite `atom`, `read`, `update` |
| `$.clock`   | L'ora e i timer                                                                                   | entrambe                                   |
| `$.process` | Comandi sull'host                                                                                 | entrambe                                   |
| `$.http`    | Richieste di rete tramite l'host                                                                  | entrambe                                   |
| `$.fs`      | File                                                                                              | entrambe                                   |
| `$.session` | La directory, l'id, il consumo e le superfici della sessione                                      | entrambe                                   |
| `$.model`   | Completamenti singoli                                                                             | entrambe                                   |
| `$.tool`    | Strumenti che il modello può chiamare                                                             | narsil-check                               |
| `$.command` | Comandi slash                                                                                     | entrambe                                   |
| `$.mcp`     | Chiamare gli strumenti di un server MCP connesso                                                  | narsil-check                               |
| `$.prompt`  | La casella del prompt e l'invio di prompt                                                         | entrambe                                   |
| `$.audio`   | Voce e suoni                                                                                      | narsil-pet                                 |
| `$.env`     | Variabili d'ambiente                                                                              | narsil-pet                                 |
| `$.plugin`  | Il nome e la cartella del plugin stesso                                                           | narsil-pet                                 |

## Costruiscila con Claude

Non serve imparare `$` a memoria. Ciò che aiuta è sapere quale area fa cosa, così puoi descrivere la tua idea in quei termini e accorgerti di una chiamata che non esiste. Un buon modo di lavorare è chiedere a Claude un piano prima del codice:

> Usando la skill plugin-authoring, voglio che la mia mod di Claude Code `greeter` conti quante sessioni ho avviato, conservi quel numero tra una sessione e l'altra, lo mostri in un toast quando inizia una sessione e risponda a un comando `/greeter` con lo stesso numero. Prima dimmi quali aree di `$` useresti per ciascuna parte e perché. Poi scrivi il codice, controllando ogni chiamata con `claude-code.d.ts`.

Il passo del piano conta. Se Claude dice che conserverà il numero in `$.state`, sai già che qualcosa non va: `$.state` finisce con la sessione, ed è `$.store` quello che dura. Accorgertene in una frase costa meno che scoprirlo più tardi nel codice.

Quando Claude scrive il codice, controlla:

1. Ogni chiamata a `$` compare nella tabella qui sopra o in `claude-code.d.ts`. Se non trovi una chiamata, chiedi a Claude dove è dichiarata.
2. Il numero si legge e si scrive con `$.store.get` e `$.store.set`.
3. Il comando è registrato con `$.command.register` in `session.start` e riceve risposta in un hook `command.run`.
4. Le chiamate che possono fallire hanno un `.catch`, oppure il loro risultato viene controllato (`isSent`, `isAnswered` e simili).

## Capisci ogni area, con esempi

Ogni area qui sotto ha qualche riga scritta come la scriverebbe Claude, e cosa restituisce ogni metodo. Non serve memorizzarle: usale per riconoscere ciò che scrive Claude e per chiedere la cosa giusta.

### $.ui: ciò che vede la persona

```ts
$.ui.toast('Saved 3 notes')
$.ui.log('greeter: cache warmed', { to: 'debug' })
$.ui.status('greeter: 2 tool calls')
$.ui.status(undefined)

const sent = await $.ui.notify('Tests passed', { title: 'greeter' })
if (!sent.isSent) $.ui.log(`no notification: ${sent.reason}`)

const opened = await $.ui.open({ id: 'notes', title: 'Notes' })
if (!opened.isPlaced) $.ui.log(`pane waits: ${opened.reason}`)
```

- `toast(text, options?)` mostra un piccolo riquadro per qualche secondo (`timeoutMs`, predefinito 4000). Non tocca né la trascrizione né il modello.
- `log(text, options?)` aggiunge alla trascrizione una riga attenuata che il modello non legge, oppure, con `{ to: 'debug' }`, scrive solo nel log di debug.
- `status(text | undefined)` fissa una riga per questo plugin sotto il prompt; `undefined` la rimuove.
- `notify(text, options?)` invia una notifica nativa attraverso il canale della persona e si risolve con `{ isSent: true, channel }` o `{ isSent: false, reason }`.
- `open(pane)` apre un pannello che il plugin poi disegna con un hook `ui.render` su `{ component: 'Pane' }`. Si risolve con `{ isPlaced: true }` o `{ isPlaced: false, reason }`.
- `copy({ text, surface })` mette il testo negli appunti della superficie indicata e si risolve con `{ isCopied: true }` o `{ isCopied: false, reason }`. Un gestore di pressione passa `e.surface`.
- `resolve(e)` restituisce la tabella di elementi (`Box`, `Text`, `Button` e altri) per la superficie su cui disegna un hook `ui.render`. La guida "Superfici" ne parla.

Il `hooks/register.tsx` di narsil-check usa `$.ui.copy` e `$.ui.toast` insieme in `copyRow`, e apre il suo pannello con `$.ui.open({ id: PANE, title: TITLE })` su `session.start`. Il `hooks/register.tsx` di narsil-pet prova `$.ui.notify` prima del suo script di notifica. Nessuna delle due mod chiama `$.ui.status`; la riga sopra segue l'esempio del file di dichiarazioni.

### $.store: dati tra le sessioni

```ts
const runs = Number((await $.store.get('runs')) ?? 0) + 1
await $.store.set('runs', runs)

const old = (await $.store.keys()).filter((key) => key.startsWith('day:'))
for (const key of old) await $.store.delete(key)
```

- `get(key)` si risolve con il valore o con `undefined`. Il suo tipo è `unknown`, quindi controllalo o convertilo.
- `set(key, value)` salva dati JSON. Un `Date` torna come stringa ISO e un campo `undefined` viene scartato. Rifiuta una funzione, un ciclo o uno store che superi in totale 4 MiB di JSON.
- `keys()` si risolve con tutte le chiavi in ordine di inserimento; `delete(key)` ne rimuove una.

Lo store è un file JSON del plugin stesso, nella directory di configurazione di Claude Code dell'utente. narsil-pet ripristina le sue preferenze con `$.store.get(PREFS_KEY)` su `session.start` e ripulisce le vecchie statistiche per sessione con `$.store.keys()` e `$.store.delete(key)`.

### $.state: valori per il disegno

`$.state` contiene valori con nome per la sessione. Sopravvivono a un ricaricamento a caldo del codice della mod, e un hook `ui.render` che ne legge uno viene ridisegnato quando cambia, senza chiamare `$.ui.invalidate`. Ogni valore è dichiarato nel contratto della mod (`types/index.d.ts`) sotto `PluginState`.

Le chiamate dirette ricevono un riferimento i cui `plugin` e `key` sono letterali:

```ts
const ref = { plugin: 'greeter', key: 'calls' } as const

const held = await $.state.get(ref)
await $.state.set(ref, (held.value ?? 0) + 1, { ifVersion: held.version })
```

`get` si risolve con `{ value, version }` (`undefined` alla versione 0 se non è mai stato scritto). `set` con `ifVersion` scrive solo mentre il valore è a quella versione. Le due mod di Narsil usano invece gli helper di `claude-code`, che lo fanno per te:

```ts
import { atom, read, update } from 'claude-code'

const calls = atom({ plugin: 'greeter', key: 'calls' } as const, 0)

const now = await read($, calls)
await update($, calls, (n) => n + 1)
```

La differenza che conta: `$.state` dura per la sessione e `$.store` dura tra le sessioni. Per conservare un valore di stato dopo la fine della sessione, scrivilo anche in `$.store`. Un hook di render non scrive mai lo stato (`$.state.set` durante il disegno viene rifiutato); scrivi da un gestore di pressione o da un altro evento. narsil-pet dichiara tutto il suo stato in `types/index.d.ts` sotto `PluginState['narsil-pet']` e crea ogni valore con `atom` all'inizio di `hooks/register.tsx`.

### $.clock: ora e timer

```ts
const startedAt = await $.clock.now()
await $.clock.sleep(500)

const once = $.clock.after(10_000, () => $.ui.toast('Ten seconds in'))
const tick = $.clock.every(2000, () => $.ui.status('still here'))
once.cancel()
tick.cancel()
```

`now()` si risolve con i millisecondi trascorsi dall'epoch. `sleep(ms, options?)` attende e accetta un `signal`. `after(ms, fn)` e `every(ms, fn)` restituiscono un timer con `cancel()`. Un ricaricamento a caldo annulla i timer in sospeso. narsil-pet avvia la sua finestra con `$.clock.after(10, ...)` e un battito periodico con `$.clock.every(2000, ...)` su `session.start`.

### $.process, $.http, $.env, $.plugin: l'host

```ts
const { exitCode, stdout } = await $.process.run(['git', 'status', '--short'], { timeoutMs: 5000 })
const { ok, status, text } = await $.http.fetch('https://example.com/status')
const home = await $.env.get('HOME')
const script = `${$.plugin.root}/scripts/hello.sh`
```

- `process.run(argv, init?)` esegue un comando dal suo vettore di argomenti, senza shell, e si risolve con `{ exitCode, stdout, stderr }` per qualsiasi codice di uscita. `init` accetta `cwd`, `env`, `stdin` e `timeoutMs` (30 s per impostazione predefinita).
- `http.fetch(url, init?)` passa per l'host e si risolve con `{ status, ok, headers, text }`. `init` accetta `method`, `headers`, `body`, `auth` e `socketPath`.
- `env.get(name)` si risolve con la variabile o con `undefined`. Il nome deve essere una stringa letterale, così validate può elencare ciò che il modulo legge.
- `plugin.root` è la cartella del plugin (assoluta) e `plugin.name` il suo nome nel manifest. Entrambi sono semplici stringhe, non chiamate.

narsil-check esegue i gestori di pacchetti e `gh` con `$.process.run` e interroga i registri e OSV.dev con `$.http.fetch`. narsil-pet legge `OS` con `$.env.get` e costruisce i percorsi degli script a partire da `$.plugin.root`.

### $.fs: file

```ts
const path = `${await $.session.cwd()}/notes.json`
if (await $.fs.exists(path)) {
  const notes = JSON.parse(await $.fs.read(path)) as unknown
  await $.fs.write(path, JSON.stringify(notes, null, 2))
}
const entries = await $.fs.list(await $.session.cwd())
```

`read(path)` si risolve con il testo (o con i byte, con `{ as: 'bytes' }`) e rifiuta quando il file manca o supera 4 MiB. `write(path, text)` crea il file e le sue directory. `exists(path)` e `list(path?)` fanno quello che dice il nome; ogni voce di `list` ha `name`, `kind`, `size`, `mtimeMs` e `isLink`. L'helper `readJson` di narsil-check è `$.fs.exists` seguito da `$.fs.read`.

### $.session: la sessione stessa

```ts
const cwd = await $.session.cwd()
const id = await $.session.id()
const usage = await $.session.usage()
const inApp = (await $.session.surfaces()).some((s) => s !== 'terminal')
```

`cwd()` è la directory in cui gira la sessione, `id()` il suo id, `usage()` quando è iniziata e quanto è piena la finestra di contesto, e `surfaces()` tutte le superfici su cui disegna. narsil-pet le legge tutte e quattro; narsil-check legge `cwd()`.

### $.model: completamenti

```ts
const reply = await $.model.complete({
  model: 'haiku',
  system: 'Answer in one line.',
  prompt: 'Name a color.',
  maxTokens: 50,
})
const color = reply.isAnswered ? reply.text : `no answer: ${reply.reason}`

const forked = await $.model.fork({ prompt: 'Summarize this session in one sentence.' })
```

`complete` esegue un completamento senza strumenti e senza cronologia e si risolve sempre con un risultato: `isAnswered` con `text`, oppure `isAnswered: false` con un `reason`. `fork` esegue un completamento senza strumenti sulla trascrizione della sessione stessa. Entrambi contano nel costo della sessione. narsil-pet scrive i suoi consigli con `$.model.complete({ model: 'haiku', ... })` e i consigli più approfonditi con `$.model.fork`; narsil-check chiede a Haiku perché un aggiornamento è rischioso.

### $.tool e $.command: ciò che possono chiamare il modello e la persona

```tsx
on('session.start', async ($, e, next) => {
  await $.command.register({
    name: 'notes',
    description: 'Show the notes count',
    argumentHint: 'clear',
  })
  await $.tool.register({
    name: 'add_note',
    description: 'Add a note to the list.',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  })
  return next(e)
})

on('command.run', { command: 'notes' }, async ($, e) => {
  const count = Number((await $.store.get('count')) ?? 0)
  return { text: e.args.trim() === 'clear' ? 'Cleared.' : `${count} notes` }
})

on('tool.call', { tool: 'mcp__greeter__add_note' }, async ($, e) => {
  const text = (e as unknown as { text?: unknown }).text
  if (typeof text !== 'string') return { deny: 'A note needs text.' }
  return { result: `Added: ${text}` }
})
```

`command.register` dichiara `/<name>`; un hook `command.run` su `{ command: '<name>' }` gli risponde con `{ text }`. `tool.register` dichiara uno strumento chiamato `mcp__<plugin>__<name>`; un hook `tool.call` su quel nome gli risponde. Entrambi si registrano da `session.start`. Questo schema è adattato dal `hooks/register.tsx` di narsil-check, che registra i suoi quattro strumenti per la lista di attività in `registerTools` e risponde a ciascuno con `{ result }` o `{ deny }`.

### $.mcp, $.prompt, $.audio

```ts
const result = await $.mcp.call('example-server', 'list_items', { limit: 5 })
await $.prompt.fill({ text: 'Run the tests again' })
await $.prompt.submit({ text: 'List the files changed today' })
await $.audio.speak('Done')
```

- `mcp.call(server, tool, args?)` chiama uno strumento su un server MCP connesso con la connessione del motore stesso e si risolve con blocchi `content` e `isError`. narsil-check legge così i server di sessione dell'app desktop.
- `prompt.fill({ text })` mette del testo nella casella del prompt come bozza. narsil-pet lo usa quando scegli un passo successivo suggerito.
- `prompt.submit({ text })` accoda un prompt che avvia un proprio turno appena la sessione è inattiva. narsil-check lo usa per affidare un'attività a Claude.
- `audio.speak(text)` parla con il sintetizzatore della piattaforma. narsil-pet ricorre a questo quando il suo script vocale non è disponibile.

## Errori comuni e come testarlo

- **Considerare `$.state` permanente.** Finisce con la sessione. Rendi persistenti i dati con `$.store`.
- **Scrivere lo stato durante il disegno.** `$.state.set` dentro un hook `ui.render` viene rifiutato. Scrivi da `onPress` o da un altro evento.
- **Chiavi di stato o nomi di variabili calcolati.** `plugin` e `key` in un riferimento di stato, e il nome passato a `$.env.get`, devono essere letterali nel sorgente.
- **Ignorare la forma dei risultati.** `$.model.complete`, `$.ui.notify`, `$.ui.open` e `$.ui.copy` si risolvono con un risultato che dice se ha funzionato, invece di rifiutare. Controlla `isAnswered`, `isSent`, `isPlaced` o `isCopied`.
- **Dimenticare che le chiamate possono fallire.** Entrambe le mod avvolgono le chiamate facoltative in `.catch(() => undefined)`, così un singolo errore non ferma un hook.

`claude plugin validate` elenca ogni chiamata a `$` che il modulo fa (`calls: $.state.get, $.ui.toast, ...`), le chiavi di stato che legge e scrive e i nomi di variabili d'ambiente che usa. Il controllo dei tipi rispetto al file di dichiarazioni individua un nome di metodo o un argomento sbagliato prima che una sessione carichi la mod.

## Per andare oltre

- `hooks/register.tsx` di narsil-pet: `session.start` usa `$.command.register`, `$.store.get`, `$.env.get`, `$.session.usage`, `$.session.cwd`, `$.clock.after` e `$.clock.every` in un solo hook.
- `hooks/register.tsx` di narsil-check: `registerTools` per `$.tool.register`, gli hook `tool.call` su `mcp__narsil-check__...` che rispondono a quegli strumenti, e `copyRow` per `$.ui.copy`.
- Entrambi i file `types/index.d.ts`: le dichiarazioni `PluginState` dietro ogni `atom`.
