---
title: Gli stati a colpo d'occhio
description: 'Come Narsil trasforma gli eventi della sessione in cinque stati, una frase sul passo in corso e un breve commento, disegnati nella fascia sopra il prompt.'
route: pet
order: 1
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: hooks/sprite.ts
  - repo: pet
    path: types/index.d.ts
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Cosa fa

Narsil vive nella fascia subito sopra il prompt. Basta uno sguardo per rispondere alla domanda che ti fai più spesso mentre Claude lavora: devo fare qualcosa adesso?

La fascia mostra tre cose:

- **Uno stato**, in maiuscolo e con il suo colore. Narsil parla spagnolo, quindi le etichette sono in spagnolo:

  | Etichetta     | Significato            | Quando appare                                                             |
  | ------------- | ---------------------- | ------------------------------------------------------------------------- |
  | `TRABAJANDO`  | Al lavoro              | Claude sta pensando, leggendo, cercando, modificando o eseguendo comandi. |
  | `PARADA`      | Ferma, in attesa di te | La conversazione aspetta il tuo prossimo messaggio.                       |
  | `TE NECESITA` | Ha bisogno di te       | Una domanda, un piano da approvare o un permesso da decidere.             |
  | `TERMINADA`   | Finito                 | Claude ha terminato la sua risposta.                                      |
  | `ERROR`       | Errore                 | Il turno si è fermato perché qualcosa è andato storto.                    |

- **Una frase che dice esattamente cosa sta facendo Claude**, come "Estoy editando: register.tsx" ("Sto modificando: register.tsx") o "Te necesito: tengo una pregunta para ti" ("Ho bisogno di te: ho una domanda per te").
- **Il commento di Narsil** sotto quella frase, scelto a caso tra alcune righe per ogni momento, come "Tecleando con mis aletas." ("Scrivo con le mie pinne.") mentre si modifica un file.

Fuori dal terminale la fascia disegna anche Narsil, con una posa per ogni stato (il disegno è l'argomento della prossima guida). Nel terminale disegna invece una piccola faccina di testo, come `~(•ᴗ•)~ 💻`.

Il vantaggio è che non devi leggere la trascrizione per sapere a che punto sono le cose. Un `TE NECESITA` giallo è un motivo per tornare; un `TRABAJANDO` blu è un motivo per continuare a fare altro.

## Come funziona dentro

Lo stato non è qualcosa che Claude Code consegna a una mod. Narsil lo costruisce da sé a partire dagli eventi della sessione, lo conserva in un unico valore e disegna quel valore.

### Un valore, due livelli: umore e stato

La mod conserva un solo valore di stato, l'atom `pet` in `hooks/register.tsx`, con tre campi: `mood`, `detail` e `line`. Il suo tipo, `Pet`, è dichiarato in `types/index.d.ts`.

`mood` è più fine dei cinque stati. Gli umori sono dodici: `greeting`, `idle`, `thinking`, `talking`, `reading`, `searching`, `writing`, `running`, `asking`, `scared`, `celebrating` e `failed`. I cinque stati si ricavano dall'umore con `statusOf` in `hooks/sprite.ts`:

- `greeting` e `idle` sono fermi (`PARADA`).
- `asking` è in attesa (`TE NECESITA`).
- `celebrating` è finito (`TERMINADA`).
- `failed` è errore (`ERROR`).
- Tutti gli altri umori sono al lavoro (`TRABAJANDO`), compreso `scared`.

Il motivo dei due livelli è che lo stato risponde a "devo intervenire?", e per questo bastano cinque risposte; l'umore risponde a "cosa sta succedendo esattamente?", e guida la frase, il commento e la posa. Conservare solo l'umore e ricavarne lo stato significa che i due non possono mai essere in disaccordo.

L'umore `scared` è un buon esempio del perché la separazione conta. Quando una chiamata a uno strumento fallisce a metà turno, Narsil sembra spaventata e la frase dice "Ha fallado un paso (Bash); sigo trabajando" ("Un passo è fallito (Bash); continuo a lavorare"). Lo stato resta `TRABAJANDO`, perché Claude sta ancora lavorando e a te non viene chiesto nulla. Solo un turno che termina con un fallimento diventa `ERROR`.

### Gli eventi che Narsil ascolta

Ogni cambio di umore passa per una sola funzione, `setMood` in `hooks/register.tsx`, che scrive l'atom `pet` e invia il nuovo stato alla finestra mobile. Gli hook che la chiamano:

- **`session.start`**: una nuova conversazione inizia come `greeting`, che conta come ferma.
- **`turn.start`**: il tuo prompt avvia un turno; l'umore diventa `thinking`. L'hook agisce solo quando `e.agentId` non è definito, così il turno di un subagente non azzera la conversazione principale.
- **`turn.step`**: l'output del modello arriva a pezzi. Un pezzo `thinking` mantiene l'umore su `thinking`; il primo pezzo `text` del ciclo principale lo cambia in `talking` ("Estoy escribiendo la respuesta", "Sto scrivendo la risposta"). Questo hook è un generatore asincrono: restituisce con `yield` ogni pezzo che riceve, così il flusso arriva allo schermo senza modifiche.
- **`tool.call`**: l'evento più informativo. Il nome dello strumento sceglie l'umore attraverso `MOOD_BY_TOOL` in `hooks/words.ts` (`Read` è lettura, `Grep` e `WebSearch` sono ricerca, `Edit` e `Write` sono scrittura, `Bash` e `PowerShell` sono esecuzione), e `describeCall` trasforma l'input della chiamata nel breve dettaglio dopo i due punti: il nome base del file per uno strumento sui file, il pattern per una ricerca, la prima riga di un comando. `AskUserQuestion` ed `ExitPlanMode` sono gestiti a parte (`ASKING_TOOLS`): impostano `asking`, perché lo strumento stesso è il momento in cui Claude si ferma e aspetta.
- **`classic.PermissionRequest`**: una finestra di permesso a cui devi rispondere. L'hook chiama prima `next(e)` e imposta `asking` solo quando nessun hook delle impostazioni l'ha già decisa e la modalità non è `bypassPermissions`.
- **`turn.complete`**: il turno termina, ed `e.reason` decide lo stato. `answer` diventa `celebrating` con il tempo impiegato ("He terminado (en 2 min)"), `aborted` torna a `idle` con "lo has detenido tú" ("l'hai fermato tu"), e qualsiasi altro motivo diventa `failed`.

### Perché è stata presa ogni decisione

I commenti in `hooks/register.tsx` danno le ragioni, e vale la pena leggerli come note di progetto:

- **I permessi usano `classic.PermissionRequest`, non `tool.check`.** Il commento spiega che l'`ask` di `tool.check` arriva prima che la modalità di permesso decida la chiamata, quindi con "bypass permissions", una regola o il classificatore automatico Narsil darebbe falsi allarmi ("cry wolf", gridare al lupo). Il motore genera `PermissionRequest` solo quando sta per mostrarti la finestra.
- **Un turno finito non è sempre "finito".** Nell'hook `classic.Stop` Narsil conta i task in background ancora in corso (`e.background_tasks`). Se ce ne sono, `turn.complete` la mostra ancora `running` e in attesa di loro, invece di annunciare una fine che non è reale.
- **Una domanda nel riquadro del passo successivo dell'app desktop è una domanda.** Quando un turno termina con lo strumento `mcp__ccd_turn__wrap_up` dell'app desktop che porta un `ask`, l'hook `tool.call` conserva quel testo (`turnAsk`), e `turn.complete` mostra `asking` con quel testo invece di `celebrating`.
- **Solo le chiamate di Claude la muovono.** `tool.call` inizia con `isClaudesCall(next.origin)` (in `hooks/watch.ts`): la chiamata di un'altra mod, come narsil-check che legge la sua sessione all'avvio, non è lavoro di Claude.
- **Le parole vivono in un solo file.** `hooks/words.ts` contiene tutte le etichette (`STATUS_LABEL`), il costruttore delle frasi (`headline`), i commenti (`LINES` e `pick`) e la tabella degli strumenti. Il modulo degli hook decide cosa è successo; `words.ts` decide come dirlo. Così le etichette restano identiche ovunque compaiano: la fascia, la finestra mobile, il telefono e `/narsil estado`.
- **Narsil parla in prima persona.** Le frasi sono scritte come se parlasse Narsil ("Estoy leyendo", "Sto leggendo"), una scelta registrata nella cronologia dei commit (vedi sotto).

### Cosa disegna la fascia

L'hook `ui.render` per `{ component: 'AbovePrompt' }` legge lo stato e restituisce un albero di elementi `Box`, `Text`, `Button` e `Svg` ottenuti da `$.ui.resolve(e)`. Cede il posto a un sondaggio (`e.props.hasSurvey`) e a `/narsil ocultar`.

Nel terminale disegna una riga: la faccina di testo da `FACE`, l'etichetta in grassetto nel suo colore e la frase. Sulle altre superfici disegna l'immagine con `Svg` a 132 per 118 pixel, e accanto una colonna con `● LABEL · Narsil · level`, la frase in grassetto e il commento attenuato. I colori vengono da `STATUS_COLOR` in `hooks/sprite.ts`: blu `#3B8BFF` per al lavoro, grigio per ferma, giallo `#F5B400` per ha bisogno di te, verde per finito e rosso per errore.

Ogni testo che può crescere viene disegnato con `wrap="truncate-end"` dentro un box con `minWidth={0}`, così un nome di file lungo viene tagliato dentro la fascia invece di allargarla.

La fascia che vedi oggi disegna la più importante di tutte le tue conversazioni aperte, non solo quella corrente; la terza guida di questo percorso spiega questa parte. Quando la conversazione mostrata è un'altra, la frase inizia con il nome di quella conversazione e il commento viene omesso.

## Costruiscila con Claude

Chiedi a Claude una mod che tenga un unico valore di stato, lo imposti dagli eventi della sessione e lo disegni nella fascia sopra il prompt. L'unica idea che deve fare bene è che solo la conversazione principale muove quello stato: gli eventi di un subagente portano un `agentId`, e per loro gli hook lasciano lo stato com'è.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt usato per costruire Narsil.

> Crea una mod di Claude Code chiamata `my-pet` che mostri lo stato della conversazione nella fascia sopra il prompt (`ui.render` su `AbovePrompt`). Conserva un unico valore di stato in un atom con uno stato (al lavoro, ferma, in attesa, finito, errore) e una frase di una riga. Impostalo da `turn.start` (al lavoro), `tool.call` (al lavoro, con lo strumento e il nome base del file nella frase; in attesa per `AskUserQuestion` ed `ExitPlanMode`) e `turn.complete` (finito su `answer`, ferma su `aborted`, errore negli altri casi). Ignora gli eventi che hanno `agentId` impostato. Disegna l'etichetta in grassetto nel suo colore e la frase dopo, troncata in modo che non allarghi mai la fascia. Verifica ogni API sui tipi di plugin-authoring, dichiara l'atom in `types/index.d.ts` e aggiungi un test con `claude-code/testing` che verifichi che una chiamata a `Read` mostri il nome del file.

### Cosa controllare nella risposta di Claude

1. Ogni hook che si limita a osservare finisce chiamando `next(e)`, e `turn.complete` attende `next(e)` prima di leggere `e.reason`.
2. `turn.start`, `tool.call` e `turn.complete` controllano `e.agentId` e non cambiano nulla quando è impostato.
3. `AskUserQuestion` e `ExitPlanMode` impostano lo stato di attesa, e `turn.complete` trasforma `answer` in finito, `aborted` in inattivo e ogni altro motivo in errore.
4. La frase viene disegnata con `wrap="truncate-end"` dentro un box con `minWidth={0}`, così un nome di file lungo non allarga la fascia.
5. L'hook di render restituisce `next(e)` quando `e.props.hasSurvey` è true.

Se un controllo fallisce, di' a Claude cosa vedi: "la fascia torna a WORKING quando parte un subagente, dopo che la risposta era già finita".

### Come l'ha chiesta l'autore

La richiesta originale per gli stati non è stata registrata. I log pubblici dei task del progetto (`odd/tasks/fleet-view.md` e `odd/tasks/animated-poses.md`) iniziano più tardi, e nessuno dei due riguarda la prima fascia.

#### Ricostruzione dalla cronologia dei commit

Da `git log -- hooks/register.tsx hooks/words.ts` in narsil-pet:

- `b1187f3` (2026-10-30) "feat: show Narsil above the prompt with clear states and /narsil" (mostra Narsil sopra il prompt con stati chiari e /narsil). La fascia, i suoi stati e il comando `/narsil` arrivano insieme nel primo commit del modulo degli hook.
- `8e29583` (2026-10-30) "fix(band): keep long text from widening the desktop band" (evita che il testo lungo allarghi la fascia desktop). La regola di `minWidth={0}` e del troncamento vista sopra viene da qui.
- `2027f06` (2026-10-30) "fix(alerts): only alert when a permission dialog needs your answer" (avvisa solo quando una finestra di permesso ha bisogno della tua risposta). Il passaggio a `classic.PermissionRequest`, spiegato nel commento del codice citato sopra.
- `0cfc369` (2026-10-31) "refactor: move Narsil's wording and labels out of the hooks module" (sposta i testi e le etichette di Narsil fuori dal modulo degli hook). È qui che nasce `hooks/words.ts`.
- `c73bc13` (2026-10-31) "feat: let Narsil speak of herself in the first person" (fa parlare Narsil di sé in prima persona), seguito da `36256f9` "feat: let the band, window and alerts speak in Narsil's first person" (fa parlare la fascia, la finestra e gli avvisi in prima persona con la voce di Narsil).
- `2532e7c` (2026-11-02) "feat: alert as a question when a turn ends asking in the desktop app's next-step box" (avvisa come domanda quando un turno termina chiedendo qualcosa nel riquadro del passo successivo dell'app desktop).
- `519dd73` (2026-11-06) "fix: wait for background work before announcing a turn finished" (aspetta il lavoro in background prima di annunciare che un turno è finito). Il suo messaggio dice che un turno che si ferma con shell, monitor o subagenti in background ancora in corso ora mostra Narsil in attesa di loro.

Lo schema è chiaro anche senza i prompt: una prima versione che associava gli eventi agli stati, poi una serie di correzioni ogni volta che uno stato mentiva (un falso allarme, una falsa fine, una domanda persa).

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida. Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

Questa è una versione ridotta dell'idea, scritta per questa guida e verificata sui tipi di Claude Code 2.1.325. È adattata da `hooks/register.tsx`, `hooks/words.ts` e `hooks/sprite.ts` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later); i colori sono lo `STATUS_COLOR` di Narsil.

Il tipo dello stato, in `types/index.d.ts` (indicato da `"types"` in `plugin.json`):

```ts
export type Status = 'working' | 'idle' | 'waiting' | 'done' | 'error'
export type Pet = { status: Status; headline: string }

declare module 'claude-code' {
  interface PluginState {
    'my-pet': { pet: Pet }
  }
}
```

Il modulo degli hook, `hooks/register.tsx`:

```tsx
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'
import type { Status } from '../types'

const LABEL: Record<Status, string> = {
  working: 'WORKING',
  idle: 'IDLE',
  waiting: 'NEEDS YOU',
  done: 'DONE',
  error: 'ERROR',
}
const COLOR: Record<Status, string> = {
  working: '#3B8BFF',
  idle: '#8A90A6',
  waiting: '#F5B400',
  done: '#22B573',
  error: '#F0435A',
}
const VERB: Record<string, string> = {
  Read: 'reading',
  Grep: 'searching',
  Edit: 'editing',
  Write: 'editing',
  Bash: 'running',
}

const pet = atom({ plugin: 'my-pet', key: 'pet' } as const, {
  status: 'idle',
  headline: 'Waiting for your message',
})

export const register: Register = (on) => {
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined)
      await update($, pet, () => ({ status: 'working', headline: 'Thinking' }))
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId === undefined) {
      const input = e as unknown as Record<string, unknown>
      const file = typeof input.file_path === 'string' ? input.file_path.split(/[\\/]/).pop() : ''
      const isAsking = e.tool === 'AskUserQuestion' || e.tool === 'ExitPlanMode'
      await update($, pet, () =>
        isAsking
          ? { status: 'waiting', headline: 'I have a question for you' }
          : {
              status: 'working',
              headline: `I am ${VERB[e.tool] ?? 'working'}${file ? `: ${file}` : ''}`,
            },
      )
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    const status: Status =
      e.reason === 'answer' ? 'done' : e.reason === 'aborted' ? 'idle' : 'error'
    await update($, pet, () => ({
      status,
      headline: status === 'error' ? 'I stopped on an error' : 'Done',
    }))
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const s = await read($, pet)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" gap={1} minWidth={0}>
        <Text bold color={COLOR[s.status]}>{`● ${LABEL[s.status]}`}</Text>
        <Text wrap="truncate-end">{s.headline}</Text>
      </Box>
    )
  })
}
```

Tre dettagli reggono il progetto. Ogni hook che si limita a osservare termina chiamando `next(e)`, così il comportamento di Claude Code prosegue. `turn.complete` attende prima `next(e)` e reagisce al turno ormai concluso. E l'hook di render legge l'atom con `read`, che iscrive il disegno: ogni `update` ridisegna la fascia.

## Errori comuni e come testarlo

Questi vengono dal codice e dalle correzioni di Narsil:

- **Reagire ai subagenti come se fossero la conversazione principale.** Anche i subagenti generano `turn.start`, `tool.call` e `turn.complete`, con `e.agentId` impostato. Narsil verifica `e.agentId === undefined` prima di toccare lo stato principale.
- **Allarmi che la modalità di permesso ha già risolto.** Rilevare "ha bisogno di te" da `tool.check` scatta anche con bypass permissions. La correzione di Narsil (`2027f06`) ascolta `classic.PermissionRequest` e lo ignora comunque quando ha risposto un hook delle impostazioni (`result.decision`) o la modalità è `bypassPermissions`.
- **Un "finito" che non è finito.** Un turno può terminare mentre il lavoro in background continua. Narsil legge `background_tasks` in `classic.Stop` prima di decidere (`519dd73`).
- **Testo che allarga la fascia.** Sul desktop una frase lunga spinge fuori il layout. Usa `minWidth={0}` sulla colonna e `wrap="truncate-end"` sul testo (`8e29583`).
- **Inghiottire il flusso.** Un hook `turn.step` è un generatore: se non restituisce con `yield` ogni pezzo ricevuto da `next(e)`, la risposta smette di arrivare allo schermo.
- **Ignorare i sondaggi.** Quando `e.props.hasSurvey` è vero, la fascia appartiene al sondaggio; restituisci `next(e)`.

Per testare, `claude plugin test .` esegue i file `*.test.tsx` della mod. Il `tests/narsil.test.tsx` di Narsil è un buon modello: avvia una sessione con `$.session.start`, chiama strumenti con `$.tool.call`, monta la fascia con `$.ui.mount` e cerca i testi con `find`. Tra i test da copiare per nome ci sono "a new conversation shows as stopped and ready, on every surface" (una nuova conversazione appare ferma e pronta, su ogni superficie), "a permission dialog you must answer pops up as a question" (una finestra di permesso a cui devi rispondere compare come domanda) e "an ask the mode settles by itself (bypass permissions) raises no alarm" (una richiesta che la modalità risolve da sola, con bypass permissions, non genera allarmi). Il log dei task di Narsil registra che, nella shell dell'autore, `claude plugin test .` richiedeva `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` (`odd/tasks/fleet-view.md`, L6). Esegui anche `claude plugin validate .claude-plugin/plugin.json`: confronta le letture e le scritture dei tuoi atom con `types/index.d.ts`.

Una nota sulle superfici: il README di Narsil dice che la fascia funziona nel terminale, nell'app desktop, in VS Code e nell'app mobile. I tipi della 2.1.325 documentano `AbovePrompt` come "Raised on the terminal, desktop and mobile surfaces only" (generato solo sulle superfici terminale, desktop e mobile). Prova sulle superfici che ti interessano invece di affidarti a una delle due affermazioni.

## Per andare oltre

La versione completa in narsil-pet aggiunge molto attorno allo stesso nucleo:

- `setMood` in `hooks/register.tsx` è l'unico punto d'ingresso per ogni cambiamento, e invia anche lo stato all'hub locale (`pushOverlay`).
- `headline` e `LINES` in `hooks/words.ts` contengono la frase per ciascuno dei dodici umori e tre commenti per ognuno; `describeCall` costruisce il dettaglio per file, pattern, query, URL, comandi e subagenti.
- L'hook `tool.call` riconosce anche i comandi di test (`TEST_COMMAND`) per festeggiare i test superati, e avvisa dei comandi che non si possono annullare (`dangerOf`), senza bloccarli.
- `startWaiting` e `stopWaiting` insistono una volta su un permesso o una domanda rimasti in attesa per cinque minuti.
- `announce` parla e notifica nei momenti chiave (inizio, fine, domanda, errore), e `sendStatus` invia lo stato al telefono.
- `FACE` in `hooks/sprite.ts` è la faccina del terminale per ogni umore; `sprite` disegna l'immagine completa, trattata nella prossima guida.
