---
title: Cose da fare
description: 'Come Narsil Check tiene una lista di cose da fare per progetto in un file JSON non tracciato, la tiene fuori da git, e non sovrascrive mai una lista danneggiata senza una copia.'
route: check
order: 15
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/todos.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: README.md
  - repo: check
    path: tests/todos.test.tsx
---

## Cosa fa

Mentre lavori a una cosa ne pensi altre tre: un README da rivedere, un aggiornamento da provare più tardi, un test da aggiungere. Finiscono da qualche parte fuori dal progetto, oppure si perdono. Narsil Check dà a ogni progetto la sua breve lista, nel pannello, in fondo.

La sezione è **Pendientes** ("Cose da fare"):

```text
● ▾ Pendientes · 2
  ○ ▾ Raise TypeScript to the next major
       Check moduleResolution first
  ○ Review the README
  [ Nueva tarea (nombre: contenido) ]  Agregar
```

- **Aggiungere**: scrivi nel campo e premi Invio. Ciò che viene dopo i primi due punti è il contenuto: `Raise TypeScript: check moduleResolution first`. Senza i due punti, l'attività ha solo un nome.
- **Leggere**: una pressione su un nome mostra o nasconde il suo contenuto. Un'attività senza contenuto non si apre.
- **Finire**: una pressione su `○` rimuove l'attività. Non si tiene nessuna cronologia delle attività finite.

Il punto è giallo mentre qualcosa aspetta e grigio quando la lista è vuota. La sezione si apre all'inizio di una sessione quando la lista contiene qualcosa, e resta chiusa quando è vuota. Sul telefono non c'è un campo di testo (l'app mobile non ne disegna); lì la lista si legge, le attività si finiscono con `○`, e quelle nuove si aggiungono tramite Claude, come mostra la prossima guida.

La lista appartiene al progetto, non alla sessione né alle impostazioni della macchina. È un file dentro il progetto, e non arriva mai in un commit.

## Come funziona dentro

`hooks/todos.ts` contiene le parti semplici: dove sta il file, come si legge e si scrive, come una voce si divide ai suoi due punti, e la riga per il file di esclusione di git. `hooks/register.tsx` legge e scrive il file e disegna la sezione.

### Dove sta la lista

Il file è `.atl/narsil-check/pendientes.json`, sotto la radice del progetto. La radice è il livello più alto di git (`git rev-parse --show-toplevel`), altrimenti la cartella della sessione. Usare il livello più alto di git significa che si trova la stessa lista da qualsiasi sottocartella in cui apri la sessione.

Il formato è un piccolo JSON:

```json
{
  "version": 1,
  "tasks": [
    { "id": "mh3k2a1b4c9z", "name": "Review the README" },
    { "id": "mh3k2f9x0q1w", "name": "Raise TypeScript", "content": "Check moduleResolution first" }
  ]
}
```

Il campo `version` viene scritto ma non ancora letto; lascia spazio per cambiare il formato più avanti. Ogni `id` è l'ora in base 36 più quattro caratteri casuali, così due attività con lo stesso nome restano distinte e Claude può nominarne una con esattezza. Gli id qui sopra sono inventati.

Perché un file e non `$.store`? L'archivio appartiene alla mod su quella macchina. Un file nel progetto è del progetto: puoi aprirlo, modificarlo a mano, farne un backup, e si sposta con la cartella. E permette a un progetto di scrivere nella lista di un altro progetto, cosa che usa la prossima guida.

### Tenerla fuori da git

La lista è personale; una pull request non dovrebbe mai portarla con sé. Aggiungerla a `.gitignore` cambierebbe un file tracciato e metterebbe quella modifica davanti a tutti. Così la mod usa invece il file di esclusione locale di git, che funziona come `.gitignore` ma non viene mai committato.

`excludeTodos` chiede a git dov'è quel file, con `git rev-parse --git-path info/exclude`, invece di dare per scontato `.git/info/exclude`. In un worktree collegato `.git` è un file, non una cartella, e git risponde con il posto giusto. Poi `withExclude` aggiunge la riga `/.atl/narsil-check/` a meno che il file non ce l'abbia già (o `.atl/narsil-check` o `.atl/narsil-check/`), mantenendo un a capo finale.

Questo gira a ogni modifica, ed è sicuro ripeterlo: la riga viene aggiunta una volta. Il README dice "La primera vez" ("La prima volta"), che è ciò che vedi, perché le esecuzioni successive non cambiano niente.

È anche una questione secondaria. Se il file di esclusione non si può scrivere, l'errore viene ignorato e l'attività viene comunque salvata. Il README lo dice: "Si ese archivo no se puede escribir, la tarea se guarda igual." ("Se quel file non si può scrivere, l'attività viene salvata lo stesso."). Una cartella che non è un repository git non ha niente da cui escludere, e il passo viene saltato.

### Scritture sicure: una modifica alla volta, sul file com'è adesso

La lista può cambiare da tre posti: il campo nel pannello, il pulsante `○`, e gli strumenti di Claude. Claude può star aggiungendo un'attività mentre tu ne finisci un'altra. E un'altra sessione sullo stesso progetto può aver scritto il file da quando questa l'ha letto.

`changeTodos` gestisce questo con due regole:

1. **Una modifica alla volta dentro la sessione.** Ogni modifica viene concatenata a un'unica promise, `todoChain`. Una modifica aspetta che finisca la precedente, così due scritture non si intrecciano mai.
2. **Leggere subito prima di scrivere.** Ogni modifica legge di nuovo il file, applica la sua modifica (aggiungerne una, toglierne una) a ciò che c'è adesso, e riscrive l'intera lista. Un'attività che un'altra sessione ha salvato un minuto fa viene tenuta.

La catena sopravvive a una modifica fallita: continua da `run.catch(() => undefined)`, così un errore non blocca tutti i salvataggi successivi.

Cosa questo non protegge, e il README lo dice onestamente: due sessioni dello stesso progetto che scrivono nello stesso istante. Allora l'ultima scrittura può sovrascrivere l'altra. Le scritture non sono nemmeno atomiche: `$.fs.write` sostituisce l'intero contenuto del file, come dicono i tipi ("the whole new content", l'intero nuovo contenuto); non c'è un file temporaneo con rinomina. Per una breve lista personale è un limite ragionevole.

### Un file danneggiato non viene mai letto come vuoto

Supponi di modificare il file a mano e di lasciare una virgola finale. Un lettore poco attento vedrebbe un JSON non valido, lo tratterebbe come una lista vuota, e la modifica successiva scriverebbe una lista nuova sopra le tue attività.

`parseTodoFile` distingue i casi. Un file vuoto o mancante è una lista vuota. Un file che non è JSON dà `{ error: 'no es JSON válido' }` ("non è JSON valido"), e uno senza un array `tasks` dà `{ error: 'no tiene la lista "tasks"' }` ("non ha la lista "tasks""). Le voci senza nome vengono scartate; il resto viene tenuto.

Con un errore, succedono due cose:

- **Alla lettura**, il pannello mostra l'errore in rosso, `.atl/narsil-check/pendientes.json no se puede leer (…). No lo toco: …`, che si legge "non si può leggere (…). Non lo tocco: correggilo, oppure aggiungi un'attività e terrò una copia del file prima di iniziare una lista nuova". Non viene scritto niente.
- **Alla modifica successiva**, il testo danneggiato viene prima copiato accanto come `pendientes.danado-<moment>.json` (`danado` significa "danneggiato"), con il nome dato dall'ora ISO con `:` e `.` sostituiti, come `pendientes.danado-2026-11-17T09-30-00-000Z.json`. Poi inizia una lista nuova con la modifica, e il pannello mostra una nota gialla che dice dov'è la copia.

Questo è nato da un bug. Il commit di correzione `8dc7904` lo descrive: "A list file that is not valid JSON was read as empty and overwritten by the next change." (un file di lista che non era JSON valido veniva letto come vuoto e sovrascritto dalla modifica successiva).

La copia sta dentro la stessa cartella esclusa, quindi nemmeno lei arriva a git.

### Quando viene letta

`loadTodos` gira all'inizio della sessione, e di nuovo ogni volta che apri la sezione, così una modifica fatta da un'altra sessione o a mano compare quando guardi. Ogni modifica aggiorna direttamente l'atom del pannello con la lista appena scritta, ma solo quando la modifica riguardava la lista di questo progetto: un'attività scritta nella lista di un altro progetto non sostituisce ciò che mostra questo pannello.

## Costruiscila con Claude

Chiedi a Claude un breve elenco per progetto, tenuto in un file dentro il progetto e fuori da git. L'unica idea che deve fare bene è che il file è la verità: ogni modifica lo rilegge subito prima di scrivere, e un file danneggiato non viene mai letto come vuoto.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nella mia mod di Claude Code `my-panel`, aggiungi una sezione di cose da fare tenuta per progetto in `.atl/my-panel/todos.json` sotto il livello più alto di git (`git rev-parse --show-toplevel`, altrimenti la cartella della sessione), come `{ "version": 1, "tasks": [{ "id", "name", "content"? }] }`. Disegna ogni attività con un pulsante `○` che la rimuove, un nome che mostra o nasconde il suo contenuto, e un `Input` che aggiunge `name: content`, diviso ai primi due punti; salta l'`Input` sulla superficie mobile. Tieni la cartella fuori da git aggiungendo `/.atl/my-panel/` al file che indica `git rev-parse --git-path info/exclude`, una volta, e non lasciare mai che quel passo fermi un salvataggio. Fai passare ogni modifica per un'unica catena di promise, e rileggi il file prima di ogni scrittura. Se il file non è JSON valido o non ha un array `tasks`, non trattarlo mai come vuoto: mostra un errore, e alla modifica successiva copialo in `todos.damaged-<ISO time>.json` prima di iniziare una lista nuova. Testa un file danneggiato, un file di esclusione che non si può scrivere, e una modifica fatta da un altro scrittore tra due delle tue.

### Cosa controllare nella risposta di Claude

1. Il file sta sotto il livello più alto di git (`git rev-parse --show-toplevel`), altrimenti nella cartella della sessione, così lo stesso elenco si trova da qualsiasi sottocartella.
2. La cartella resta fuori da git tramite il file che indica `git rev-parse --git-path info/exclude`. La riga viene aggiunta una volta, e un errore lì non ferma il salvataggio.
3. Ogni modifica passa per un'unica catena di promise, e la catena continua dopo una modifica fallita.
4. Ogni modifica rilegge il file e applica il suo cambiamento a ciò che c'è adesso, così un'attività aggiunta da un altro scrittore viene conservata.
5. Un file che non è JSON valido, o non ha un array `tasks`, mostra un errore e non viene scritto. La modifica successiva prima lo copia da parte, poi inizia un elenco nuovo.

Se un controllo fallisce, di' a Claude cosa vedi: "ho lasciato una virgola finale nel file, ho aggiunto un'attività, e le mie vecchie attività sono sparite senza una copia accanto al file".

### Come l'ha chiesta l'autore

La richiesta originale per questa funzionalità non è stata registrata. Nessun log di task pubblico in narsil-check copre la lista di cose da fare. Ciò che segue è una ricostruzione.

#### Ricostruzione dalla cronologia dei commit

Da `git log -- hooks/todos.ts` in narsil-check:

- `5439638` (2026-11-05) "feat: Pendientes, a per-project task list Claude can read and finish" (Pendientes, una lista di attività per progetto che Claude può leggere e finire). Il suo messaggio descrive l'intero design in una volta: le attività "in .atl/narsil-check/pendientes.json, kept out of git through .git/info/exclude" (in .atl/narsil-check/pendientes.json, tenute fuori da git tramite .git/info/exclude), il campo che aggiunge "nombre: contenido" ("nome: contenuto"), e "every change rereads the file, so edits during a turn or from another session are kept" (ogni modifica rilegge il file, così le modifiche durante un turno o da un'altra sessione vengono tenute). Gli strumenti di Claude e il comando del modello arrivano nello stesso commit.
- `8dc7904` (2026-11-05) "fix: keep a damaged Pendientes list and never let side steps block a save" (tiene una lista Pendientes danneggiata e non lascia mai che i passi secondari blocchino un salvataggio). Lo stesso giorno. Il suo messaggio elenca le correzioni: il file danneggiato viene "reported in the pane and to Claude, left untouched, and copied aside" (segnalato nel pannello e a Claude, lasciato intatto, e copiato a parte) prima di una lista nuova; "A git exclude file that cannot be written no longer stops the save" (un file di esclusione di git che non si può scrivere non ferma più il salvataggio); il pannello mobile "decides by surface whether to draw the field" (decide in base alla superficie se disegnare il campo); "and the README no longer promises safety for two sessions writing at once" (e il README non promette più sicurezza per due sessioni che scrivono insieme).

Il secondo commit è il più istruttivo. La prima versione funzionava nel caso felice. La correzione è un elenco di ciò che può andare storto attorno a un file: può essere rotto, un passo secondario può fallire, una superficie può non avere un elemento, e una promessa nel README può essere troppo forte.

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida. Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

Questa è una versione ridotta dell'idea, scritta per questa guida e verificata con i tipi di Claude Code 2.1.325 (`$.fs.exists`, `$.fs.read`, `$.fs.write`, `$.process.run`). È adattata da `hooks/todos.ts` e da `changeTodos` in `hooks/register.tsx` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Riceve la radice del progetto come data e lascia fuori il disegno.

```ts
import type { EngineInterface } from 'claude-code'

export type Task = { id: string; name: string; content?: string }

const DIR = '.atl/my-panel'
const FILE = `${DIR}/todos.json`

// A missing or empty file is an empty list; anything else unreadable is an error.
export function parseFile(text: string | undefined): { tasks: Task[] } | { error: string } {
  if (!text?.trim()) return { tasks: [] }
  try {
    const tasks = (JSON.parse(text) as { tasks?: unknown })?.tasks
    if (!Array.isArray(tasks)) return { error: 'no "tasks" list' }
    return {
      tasks: tasks.filter((t): t is Task => typeof t?.name === 'string' && t.name.trim() !== ''),
    }
  } catch {
    return { error: 'not valid JSON' }
  }
}

async function exclude($: EngineInterface, root: string): Promise<void> {
  const ran = await $.process.run(['git', 'rev-parse', '--git-path', 'info/exclude'], { cwd: root })
  if (ran.exitCode !== 0) return
  const rel = ran.stdout.trim().replace(/\\/g, '/')
  const path = /^([A-Za-z]:)?\//.test(rel) ? rel : `${root}/${rel}`
  const text = (await $.fs.exists(path)) ? await $.fs.read(path) : ''
  if (text.split(/\r?\n/).some((l) => l.trim() === `/${DIR}/`)) return
  await $.fs.write(path, `${text}${text === '' || text.endsWith('\n') ? '' : '\n'}/${DIR}/\n`)
}

let chain: Promise<unknown> = Promise.resolve()

export function change(
  $: EngineInterface,
  root: string,
  edit: (tasks: Task[]) => Task[],
): Promise<string | undefined> {
  const run = chain.then(async () => {
    const path = `${root}/${FILE}`
    const text = (await $.fs.exists(path)) ? await $.fs.read(path) : undefined
    const file = parseFile(text)
    let notice: string | undefined
    if ('error' in file) {
      const copy = `${DIR}/todos.damaged-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      await $.fs.write(`${root}/${copy}`, text ?? '')
      notice = `The list was damaged (${file.error}); a copy is in ${copy}.`
    }
    const tasks = edit('error' in file ? [] : file.tasks)
    await exclude($, root).catch(() => undefined)
    await $.fs.write(path, `${JSON.stringify({ version: 1, tasks }, null, 2)}\n`)
    return notice
  })
  chain = run.catch(() => undefined)
  return run
}
```

Aggiungi un'attività con `change($, root, tasks => [...tasks, task])` e finiscine una con `change($, root, tasks => tasks.filter(t => t.id !== id))`, poi scrivi la nuova lista nel tuo atom così il pannello si ridisegna.

## Errori comuni e come testarlo

Questi vengono dal codice e dai test di Narsil Check:

- **Leggere un file rotto come vuoto.** Il salvataggio successivo distrugge le attività. Distingui "vuoto" da "illeggibile", e fai una copia prima di sostituire.
- **Scrivere dalla memoria.** Una lista tenuta nello stato del pannello e riscritta perde ciò che ha aggiunto un altro scrittore. Leggi il file subito prima di ogni scrittura.
- **Due scritture insieme.** Il campo e lo strumento di Claude possono scattare insieme. Concatenali.
- **Modificare `.gitignore`.** È un file condiviso e tracciato. Usa il file di esclusione locale.
- **Dare per scontato che `.git` sia una cartella.** In un worktree non lo è. Chiedi il percorso a git.
- **Lasciare che un passo secondario blocchi quello principale.** La riga di esclusione è un di più; il salvataggio è ciò che conta.
- **Disegnare un elemento che la superficie non ha.** Controlla che `Input` esista, e decidi in base alla superficie.

Per testare, `claude plugin test .` esegue `tests/todos.test.tsx`. "the list file is read leniently and an entry splits at its first colon" (il file della lista viene letto con tolleranza e una voce si divide ai suoi primi due punti) e "the exclude line is added once, and a template is found by its folder name" (la riga di esclusione viene aggiunta una volta, e un modello si trova dal nome della sua cartella) testano le parti pure. "Pendientes starts folded when empty; a task added in the field is saved, kept out of git, and shown" (Pendientes parte chiusa quando è vuota; un'attività aggiunta nel campo viene salvata, tenuta fuori da git, e mostrata) usa il campo e controlla il file e la riga di esclusione. "a damaged list is left as it is and said so; the next change keeps a copy of it before starting a new list" (una lista danneggiata viene lasciata com'è e lo si dice; la modifica successiva ne tiene una copia prima di iniziare una lista nuova), "a git exclude file that cannot be written does not stop the task from being saved" (un file di esclusione di git che non si può scrivere non impedisce di salvare l'attività) e "the mobile app has no text field: an empty list says so, and tasks still finish with ○" (l'app mobile non ha un campo di testo: una lista vuota lo dice, e le attività si finiscono comunque con ○) coprono le correzioni di `8dc7904`.

## Per andare oltre

- Scrivi attraverso un file temporaneo e una rinomina se la tua lista diventa qualcosa di più prezioso.
- Tieni le attività finite con una data invece di rimuoverle, e mostra le ultime in una chiusura.
- Un file di lock accanto alla lista chiuderebbe il buco di due sessioni che scrivono nello stesso istante, al prezzo di gestire un lock rimasto appeso.
- La prossima guida dà a Claude i suoi strumenti su questa lista: elencare, aggiungere e finire attività, e scrivere nella lista di un altro progetto.
