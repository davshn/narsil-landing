---
title: "L'ambiente della sessione"
description: "Come Narsil Check mostra repository, cartella, branch, Remote Control e Auto-fix, letti da git e dai server dell'app desktop, e perché li interroga così di rado."
route: check
order: 2
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/session.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/session.test.tsx
---

## Cosa fa

La prima sezione del pannello, **Entorno** ("ambiente"), mostra ciò che mostra la barra della sessione dell'app desktop, così puoi nascondere quella barra e tenere un solo pannello. Ha una riga per ogni dato, e la maggior parte delle righe fa qualcosa quando la clicchi:

| Riga                                | Cosa mostra                                                                                                 | Con un clic                                                               |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Repositorio** (repository)        | L'indirizzo web del remoto `origin`, come `github.com/acme/shop`.                                           | Lo apre nel browser.                                                      |
| **Carpeta** (cartella)              | La cartella di lavoro della sessione.                                                                       | Apre il selettore di cartelle e sposta la sessione nella cartella scelta. |
| **Rama** (branch)                   | Il branch git corrente.                                                                                     | Apre una scheda di terminale nella cartella di lavoro.                    |
| `worktree …`                        | Il worktree della sessione, quando ne ha uno.                                                               | Niente.                                                                   |
| **Control remoto** (Remote Control) | Un interruttore: `●━━ desactivado` in grigio, `━━● activado` in verde.                                      | Lo attiva o lo disattiva.                                                 |
| **Auto-fix**                        | Lo stesso interruttore per la pull request aperta della sessione, o `sin PR abierto` ("nessuna PR aperta"). | Lo attiva o lo disattiva.                                                 |

Con una pull request aperta, tra i due interruttori appare una chiusura **CI**; la quarta guida di questo percorso se ne occupa.

Quando qualcosa non si può leggere, la sezione lo dice in rosso sotto la sua riga, come "No pude leer o cambiar el control remoto: …" ("non ho potuto leggere o cambiare il Remote Control: …"), invece di restare vuota.

## Come funziona dentro

### Da dove viene ogni dato

Il README dice che la sezione viene letta dai server MCP dell'app desktop stessa. Il codice è più preciso, e la differenza conta sulle altre superfici: tre dati vengono dal motore e da git, il resto dai server dell'app. Tutto avviene in `loadSession`, in `hooks/register.tsx`.

| Dato                     | Fonte                                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| Cartella                 | `$.session.cwd()`                                                                                   |
| Branch                   | `$.process.run(['git', 'branch', '--show-current'])`                                                |
| Repository               | `$.process.run(['git', 'remote', 'get-url', 'origin'])`, trasformato in indirizzo web da `webUrlOf` |
| Remote Control, worktree | `$.mcp.call('ccd_session_mgmt', 'get_session', { session_id: 'self' })`                             |
| Pull request, Auto-fix   | `$.mcp.call('ccd_pr', 'get_status', { session_id: 'self' })`                                        |
| Connettori               | `$.mcp.call('ccd_connectors', 'session_connectors_status')` (guida successiva)                      |

I nomi dei server e degli strumenti sono costanti in cima a `hooks/session.ts` (`SESSIONS_SERVER`, `SESSION_TOOL`, `PR_SERVER`, `PR_TOOL` e gli altri), così il modulo degli hook non li scrive mai due volte.

`webUrlOf` accetta remoti SSH (`git@github.com:acme/shop.git`, `ssh://git@host:22/acme/shop`) e HTTPS, con o senza utente o `.git`, e restituisce `https://host/owner/repo`. Qualsiasi altra cosa, un percorso locale compreso, non dà nessun link e la riga dice "sin repositorio remoto" ("nessun repository remoto").

### `$.mcp.call`, come lo usa il codice

I tipi della 2.1.325 descrivono `$.mcp.call(server, tool, args)` come una chiamata a uno strumento "on one of the engine's connected MCP servers with the engine's own connection and credentials" (su uno dei server MCP connessi del motore con la connessione e le credenziali del motore stesso). È posizionale (server, strumento, argomenti), non il nome `mcp__server__tool` che vede un hook `tool.call`. Risolve il risultato come lo restituisce MCP: blocchi `content`, `isError`, e `structuredContent` quando lo strumento dichiara uno schema di output.

Narsil Check legge ogni risposta allo stesso modo:

```tsx
const result = await $.mcp.call(SESSIONS_SERVER, SESSION_TOOL, { session_id: 'self' })
const read = result.isError
  ? undefined
  : parseSession(result.structuredContent ?? jsonOf(result.content))
where = read ?? { remote: 'unknown', remoteError: textOf(result.content) || 'respuesta sin sesión' }
```

Preferisce `structuredContent` e ripiega sul JSON dentro i blocchi di testo (`jsonOf` in `hooks/session.ts`). Ogni chiamata è nel proprio `try`, e un fallimento diventa un campo di errore solo di quella parte (`remoteError`, `fixError`, `connectorsError`): un server che non risponde non svuota l'intera sezione.

I parser sono difensivi di proposito. `parseSession` prende `remoteControlState` quando è uno tra `on`, `off`, `connecting` o `unavailable`, e altrimenti ripiega sul booleano `remoteControlActive`. `parsePr` riporta Auto-fix solo per una pull request associata e `open`, perché solo quella si può attivare e l'interruttore ha bisogno del suo url; conserva anche il repository e il branch di testa della pull request per la chiusura della CI.

### Perché interroga così di rado

La sezione potrebbe semplicemente interrogare i server ogni pochi secondi. Non lo fa, e il codice e i commit danno due motivi.

**Ogni chiamata è visibile a tutte le altre mod.** Un commento in `hooks/register.tsx` dice "each call to them reaches every other mod as a tool call" (ogni chiamata a essi arriva a tutte le altre mod come chiamata a uno strumento). I tipi concordano con parole proprie: la chiamata del plugin è "seen by the hooks above it" (vista dagli hook sopra di esso). Il commit `55fe118` registra la conseguenza: "seven retries tripped Narsil's loop alert" (sette tentativi hanno fatto scattare l'allarme di loop di Narsil). Una mod che osserva le chiamate agli strumenti vede le chiamate del pannello accanto al lavoro di Claude; Narsil oggi salta le chiamate che non sono di Claude (`isClaudesCall`, trattato nella prima guida del percorso 1), e il commento lì nomina come esempio narsil-check che legge la sua sessione all'avvio.

**Una chiamata troppo presto può far apparire una richiesta di permesso.** Il commento sopra `SESSION_DELAY_MS` dice che i server dell'app si connettono dopo l'avvio della sessione, e che "a call that comes while the app has not yet confirmed which server serves the tool makes the app ask the person for permission, whatever the permission mode" (una chiamata che arriva mentre l'app non ha ancora confermato quale server serve lo strumento fa chiedere all'app il permesso alla persona, qualunque sia la modalità dei permessi). Il commit `4770a49` "fix: ask the app's session servers once, ten seconds after start" (interroga i server della sessione dell'app una volta, dieci secondi dopo l'avvio) è quella correzione.

Qui il codice e i tipi non concordano. I tipi della 2.1.325 dicono di `$.mcp.call`: "No permission prompt: the plugin's call, seen by the hooks above it, is the grant." (nessuna richiesta di permesso: la chiamata del plugin, vista dagli hook sopra di esso, è l'autorizzazione). Il README e il commit descrivono una richiesta che l'app desktop ha mostrato comunque. Tratta i tipi come il contratto del motore e il commit come ciò che l'autore ha osservato nell'app desktop, e progetta per il caso più rigoroso.

Quindi la programmazione è:

1. **All'avvio della sessione**, `loadSessionAtStart` aspetta dieci secondi con `$.clock.sleep(SESSION_DELAY_MS)` e legge una volta. Viene eseguito con `void`, così l'avvio della sessione non viene trattenuto. Fino ad allora la sezione dice "Leyendo la sesión…" ("sto leggendo la sessione…").
2. **Se quella lettura fallisce**, viene ripetuta quando inizia il tuo primo turno, "when the servers are surely confirmed" (quando i server sono sicuramente confermati), senza tentativi rapidi nel mezzo. La prima lettura viene fatta con `isFinal: false`: una lettura fallita non scrive niente, così la sezione continua a leggere invece di mostrare un errore che il nuovo tentativo potrebbe eliminare.
3. **Quando finisce ogni turno principale**, la cartella, il branch e il repository vengono riletti da git. I server vengono interrogati di nuovo solo quando il turno ha usato uno strumento che cambia la loro risposta (`SESSION_TOOLS`: gli strumenti `mcp__ccd_session_mgmt__`, `mcp__ccd_connectors__`, `mcp__ccd_directory__` e `mcp__ccd_pr__`, `EnterWorktree`, `ExitWorktree`, o un comando di shell con `gh pr` o `git push`), o quando l'ultima lettura è fallita.
4. **Dopo un turno che ha aperto o fatto il push di una pull request**, l'app può associarla solo dopo la fine del turno. `retryPr` interroga di nuovo solo `ccd_pr` dopo attese di 5, 10 e 15 secondi (5, 15 e 30 secondi dopo il turno, come lo dice il README), si ferma appena la pull request appare, e si ferma quando la sessione finisce, un `/clear` compreso.
5. **Quando apri la chiusura di Entorno o di Conectores**, e dopo che hai azionato un interruttore, tutto viene riletto.

La forma di questa programmazione è il punto: le letture economiche (git, la cartella) avvengono spesso, le letture che le altre mod possono vedere avvengono solo quando qualcosa potrebbe essere cambiato.

### Gli interruttori

I due interruttori chiamano i server dell'app per cambiare qualcosa, poi rileggono:

- **Remote Control**: `$.mcp.call('ccd_session_mgmt', 'set_remote_control', { session_id: 'self', enabled })`. La risposta può essere JSON o parole, quindi `parseRemote` cerca lo stato in entrambi.
- **Auto-fix**: `$.mcp.call('ccd_pr', 'set_monitor', { auto_fix: enabled, address_comments: enabled, url })`. Un commento dice che `address_comments` deve essere uguale a `auto_fix` dal lato dell'app. Il README dice che l'app potrebbe chiederti prima il permesso.

Mentre un interruttore cambia, `isSwitching` (o `isFixSwitching`) disegna la manopola al centro e in giallo (`━●━`, "cambiando…"), e il pulsante non viene disegnato, così una seconda pressione non può entrare in competizione con la prima. `switchGlyph` e `fixGlyph` in `hooks/session.ts` disegnano entrambi gli interruttori con la stessa funzione.

I clic su cartella e branch usano altri due server dell'app: `ccd_directory` (`request_directory` apre il selettore nativo, `change_directory` sposta la sessione) e `terminal` (`open_terminal_tab`, con il nome del branch).

### Sulle superfici senza quei server

Il terminale, VS Code e le altre superfici non hanno i server dell'app desktop. Lì, ogni `$.mcp.call` fallisce, e il codice trasforma ogni fallimento nell'errore della sua parte.

Ciò che vedi segue dalla programmazione sopra. La lettura a dieci secondi fallisce e non scrive niente, quindi la sezione continua a dire "Leyendo la sesión…". Quando inizia il tuo primo turno, la lettura viene ripetuta come definitiva: il repository, la cartella e il branch appaiono (vengono da git e dal motore), e le righe di Remote Control e Auto-fix dicono in rosso che non si sono potute leggere. Il test "a server the mod cannot reach says why once the first turn has tried it too" (un server che la mod non riesce a raggiungere dice perché una volta che anche il primo turno ci ha provato) controlla esattamente questo: due letture in tutto, ciascuna che interroga ogni server una volta, poi le righe di errore.

La tabella delle superfici del README dice che Entorno non funziona fuori dall'app desktop e che "la sección dice por qué no pudo leerlos" ("la sezione dice perché non ha potuto leggerli"). Il codice è un po' più gentile di così: le righe di git appaiono comunque. I clic su cartella e branch hanno bisogno dei server dell'app, quindi fuori dal desktop rispondono con un toast che dice che non hanno potuto.

## Costruiscila con Claude

Chiedi a Claude una sezione dell'ambiente letta da git e dai server dell'app desktop. L'unica idea che deve fare bene è quanto raramente interrogare quei server: ogni chiamata è vista dalle altre mod, e una chiamata troppo presto può far comparire una richiesta di permesso.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nella mia mod di Claude Code `my-panel`, aggiungi al pannello una sezione "Environment". Leggi la cartella con `$.session.cwd()`, il branch con `$.process.run(['git', 'branch', '--show-current'])` e il remoto con `git remote get-url origin`, trasformato in un link https per remoti SSH e HTTPS. Leggi il Remote Control dall'app desktop con `$.mcp.call('ccd_session_mgmt', 'get_session', { session_id: 'self' })`, preferendo `structuredContent` e ripiegando sul JSON nel contenuto di testo. Ogni chiamata ai server dell'app viene vista dalle altre mod, e una troppo presto può far apparire una richiesta di permesso, quindi leggi una volta, dieci secondi dopo `session.start` con `$.clock.sleep`, senza attenderla nell'hook; se fallisce, mostra "Reading…" e riprova una volta al primo `turn.start` principale. Dopo ogni turno principale rileggi solo git. Tieni separato l'errore di ogni parte e mostralo in rosso. Testa con `mock.clock` che nessun server venga chiamato prima di dieci secondi e solo una volta dopo.

### Cosa controllare nella risposta di Claude

1. Nessuna chiamata ai server dell'app avviene nei primi dieci secondi dopo `session.start`, e la lettura ritardata parte con `void`, così l'hook ritorna subito.
2. Se quella prima lettura fallisce, non scrive nulla, la sezione dice che sta leggendo, e riprova una volta al primo `turn.start` principale, senza un ciclo di tentativi.
3. Dopo ogni turno principale si rilegge solo git (cartella, branch e remoto), non i server dell'app.
4. Ogni risposta viene letta prima da `structuredContent` e, in alternativa, dal JSON nei blocchi di testo, e ogni parte conserva il proprio errore, mostrato in rosso.
5. Il remoto diventa un link https sia per i remoti SSH sia per quelli HTTPS, e qualsiasi altra cosa non dà alcun link.

Se un controllo fallisce, di' a Claude cosa vedi: "fuori dall'app desktop la sezione dice "Reading…" per sempre e il branch non compare mai".

### Come l'ha chiesta l'autore

La richiesta originale per questa sezione non è stata registrata. Nessuno dei log di task pubblici di narsil-check (`odd/tasks/*.md`) la copre; riguardano ecosistemi, età delle release e vulnerabilità.

#### Ricostruzione dalla cronologia dei commit

Da `git log -- hooks/session.ts`, con i commit correlati a `hooks/register.tsx`:

- `be8eac0` (2026-11-05) "feat: show the session bar's environment, connectors and Remote Control in the pane" (mostra nel pannello l'ambiente, i connettori e il Remote Control della barra della sessione). Il suo messaggio dà il motivo: la sezione è "read from the desktop app's own MCP servers, so the app's session bar can be hidden" (letta dai server MCP dell'app desktop stessa, così la barra della sessione dell'app si può nascondere).
- `2bd1919` (2026-11-05) "feat: repository link, Remote Control switch in Entorno and /mcp from connectors" (link al repository, interruttore del Remote Control in Entorno e /mcp dai connettori). Entorno perde una riga Local/Nube ("locale/cloud") e guadagna il link al repository.
- `c07f5e9` (2026-11-05) "feat: Entorno starts open, other sections fold until they have something" (Entorno parte aperta, le altre sezioni restano chiuse finché non hanno qualcosa).
- `d8c664e` (2026-11-05) "fix: retry the first session read until the app's servers answer" (ripete la prima lettura della sessione finché i server dell'app non rispondono). La prima risposta a server non ancora connessi: riprovare per circa un minuto.
- `55fe118` (2026-11-06) "fix: ask the app's session servers less often" (interroga meno spesso i server della sessione dell'app). Al massimo quattro letture all'avvio, e server interrogati dopo un turno solo quando serve, perché i tentativi "tripped Narsil's loop alert" (hanno fatto scattare l'allarme di loop di Narsil).
- `4770a49` (2026-11-06) "fix: ask the app's session servers once, ten seconds after start" (interroga i server della sessione dell'app una volta, dieci secondi dopo l'avvio). I tentativi vengono sostituiti da una sola lettura ritardata, a causa della richiesta di permesso.
- `7d91264` (2026-11-07) "feat: add an Auto-fix switch to Entorno for the session's open pull request" (aggiunge a Entorno un interruttore Auto-fix per la pull request aperta della sessione).
- `90c40f9` (2026-11-07) "fix: read the session's pull request again when the app binds it after the turn ends" (rilegge la pull request della sessione quando l'app la associa dopo la fine del turno).
- `f091e0b` (2026-11-07) "fix: retry only the pull request read and stop the retries when the session ends" (ripete solo la lettura della pull request e ferma i tentativi quando la sessione finisce). Il suo messaggio: ogni tentativo aveva interrogato di nuovo i connettori e la sessione, "three calls that reach every other mod" (tre chiamate che arrivano a tutte le altre mod).

Lo schema merita attenzione: tre correzioni di fila (`d8c664e`, `55fe118`, `4770a49`), ognuna interrogava meno i server. La prima versione insisteva di più quando i server non erano pronti; l'ultima aspetta, interroga una volta, e interroga di nuovo solo per un motivo.

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida. Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

Questa è una versione ridotta dell'idea, scritta per questa guida e verificata con i tipi di Claude Code 2.1.325. È adattata da `hooks/register.tsx` e `hooks/session.ts` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later).

Il tipo dello stato, in `types/index.d.ts`:

```ts
export type Env = { isLoaded: boolean; cwd: string; branch: string; remote: string; error?: string }

declare module 'claude-code' {
  interface PluginState {
    'my-panel': { env: Env }
  }
}
```

Il modulo degli hook, `hooks/register.tsx`:

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import type { Env } from '../types'

const PANE = 'my-panel'
const env = atom(
  { plugin: 'my-panel', key: 'env' } as const,
  { isLoaded: false, cwd: '', branch: '', remote: '' } as Env,
)

const git = ($: EngineInterface, argv: string[]) =>
  $.process
    .run(argv, { timeoutMs: 15_000 })
    .then((r) => (r.exitCode === 0 ? r.stdout.trim() : ''))
    .catch(() => '')

// One read; `isFinal: false` writes nothing when the app's server fails.
async function load($: EngineInterface, isFinal: boolean): Promise<boolean> {
  const cwd = await $.session.cwd().catch(() => '')
  const branch = await git($, ['git', 'branch', '--show-current'])
  let remote = 'unknown'
  let error: string | undefined
  try {
    const result = await $.mcp.call('ccd_session_mgmt', 'get_session', { session_id: 'self' })
    const value = (result.structuredContent ?? {}) as { remoteControlState?: unknown }
    if (result.isError || typeof value.remoteControlState !== 'string') error = 'no answer'
    else remote = value.remoteControlState
  } catch (err) {
    error = err instanceof Error ? err.message : String(err)
  }
  if (!error || isFinal)
    await update($, env, () => ({ isLoaded: true, cwd, branch, remote, error }))
  return !error
}

let isRetryPending = false

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    void $.clock
      .sleep(10_000)
      .then(async () => {
        isRetryPending = !(await load($, false))
      })
      .catch(() => undefined)
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined && isRetryPending) {
      isRetryPending = false
      void load($, true).catch(() => undefined)
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const view = await read($, env)
    if (!view.isLoaded) return <Text dimColor>Reading the session…</Text>
    return (
      <Box flexDirection="column">
        <Text>{`Folder ${view.cwd || '?'}`}</Text>
        <Text>{`Branch ${view.branch || 'no git'}`}</Text>
        <Text>{`Remote Control ${view.remote}`}</Text>
        {view.error && (
          <Text color="#F0435A">{`Could not read Remote Control: ${view.error}`}</Text>
        )}
      </Box>
    )
  })
}
```

Il pannello viene aperto come nella prima guida. Tre dettagli reggono il design. La lettura ritardata viene eseguita con `void`, così `session.start` ritorna subito. Una prima lettura fallita non scrive niente, così la sezione dice che sta leggendo invece di mostrare un errore che il tentativo successivo potrebbe eliminare. E il nuovo tentativo aspetta un evento reale, il primo turno, invece di un ciclo con timer che le altre mod vedrebbero come chiamate ripetute agli strumenti.

## Errori comuni e come testarlo

Questi vengono dal codice e dai commit di Narsil Check:

- **Chiamare i server dell'app proprio a `session.start`.** Potrebbero non essere ancora connessi, e l'autore ha visto l'app desktop chiedere il permesso anche con i permessi aggirati (`4770a49`). Aspetta, poi interroga una volta.
- **Riprovare in un ciclo.** Ogni chiamata viene vista dalle altre mod come una chiamata a uno strumento; i tentativi di Narsil Check hanno fatto scattare l'allarme di loop di Narsil (`55fe118`).
- **Attendere la lettura lenta dentro l'hook.** `$.clock.sleep` consuma il budget dell'hook stesso, come dicono i tipi. Avviala con `void` e lascia che l'hook ritorni.
- **Leggere solo `content`.** Preferisci `structuredContent` quando lo strumento ne dichiara uno, e analizza i blocchi di testo solo come ripiego.
- **Un solo errore per tutto.** Tieni un errore per parte, così un server mancante non nasconde il branch che puoi leggere da git.
- **Dare per scontato che ogni superficie abbia i server del desktop.** Sul terminale le chiamate falliscono; progetta la sezione per mostrare ciò che git può dire e per spiegare perché manca il resto.
- **Interrogare i server dopo ogni turno.** Narsil Check li interroga di nuovo solo quando il turno ha usato uno strumento che cambia la loro risposta (`SESSION_TOOLS`) o l'ultima lettura è fallita.

Per testare, `tests/session.test.tsx` in narsil-check risponde ai server dell'app con un hook `on('mcp.call', ...)`, a git con `on('process.run', ...)` e alla cartella con `on('session.cwd', ...)`, e fa avanzare il tempo con `mock.clock(on)` e `clock.advance`. Tra i test da copiare per nome ci sono "the app's servers are first asked ten seconds after the session starts, once; a failed read is tried again as the first turn starts" (i server dell'app vengono interrogati la prima volta dieci secondi dopo l'avvio della sessione, una volta; una lettura fallita viene ritentata all'inizio del primo turno), "a turn that touched no session tool reads only git again, not the app's servers" (un turno che non ha toccato nessuno strumento della sessione rilegge solo git, non i server dell'app) e "a server the mod cannot reach says why once the first turn has tried it too" (un server che la mod non riesce a raggiungere dice perché una volta che anche il primo turno ci ha provato). Usa valori sintetici nelle tue fixture, come un remoto `git@github.com:acme/shop.git`.

## Per andare oltre

La sezione completa in narsil-check aggiunge:

- La chiusura **CI** della pull request della sessione, letta con `gh` (la quarta guida).
- La sezione **Conectores**, letta dagli stessi server nello stesso `loadSession` (la guida successiva).
- `pathOf` in `hooks/session.ts`, che trova la cartella con cui ha risposto il selettore, come campo `path` o come primo percorso assoluto nelle sue parole.
- La stessa sezione è ciò che ti permette di nascondere la barra della sessione dell'app desktop: tutto ciò che mostrava è qui, con gli stessi clic.
