---
title: Installare, ricaricare, validare e testare
description: Carica una mod dalla sua cartella o da un marketplace locale, ricaricala dopo una modifica e controllala con claude plugin validate, claude plugin test e tsc.
route: mods
order: 3
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: .claude-plugin/marketplace.json
  - repo: pet
    path: README.md
  - repo: check
    path: .claude-plugin/marketplace.json
  - repo: check
    path: tsconfig.json
  - repo: check
    path: tests/pane.test.tsx
  - repo: check
    path: README.md
---

## Cosa fa

Questa guida prende la mod `greeter` di "Di cosa è fatta una mod" e la esegue in una sessione, la ricarica dopo una modifica e la controlla in tre modi: `claude plugin validate` per ciò che vedrà il motore, `claude plugin test` per ciò che fanno gli hook e `tsc` per i tipi.

## Come funziona dentro

Claude Code legge una mod da uno di due tipi di posizione, e questo decide come una modifica arriva a una sessione in esecuzione:

| Come viene caricata                                                                  | Come arriva una modifica                                                                                                                                           |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `claude --plugin-dir <folder>`, o una cartella indicata in `CLAUDE_CODE_PLUGIN_DIRS` | In una sessione interattiva la cartella è osservata: salvare un file ricarica il modulo degli hook.                                                                |
| Installata da un marketplace che è una cartella locale, con un `source` relativo     | Esegui `/reload-plugins`. La sessione rilegge la cartella stessa, senza una nuova versione e senza reinstallare.                                                   |
| Installata da un repository git, da npm, da un archivio o da un URL                  | La sessione esegue la copia fatta al momento dell'installazione. Una modifica arriva solo come nuova versione, con `claude plugin update` e poi `/reload-plugins`. |

Un ricaricamento esegue di nuovo `register` in un ambiente nuovo. Le variabili del modulo e i timer in sospeso spariscono; i valori in `$.state` e `$.store` restano.

## Passo dopo passo

### 1. Eseguila dalla sua cartella

Per una sessione:

```bash
claude --plugin-dir ./greeter
```

Ripeti l'opzione per caricare più cartelle. Dove non si può passare un'opzione (una sessione avviata dall'app desktop o da un host SDK), imposta `CLAUDE_CODE_PLUGIN_DIRS` su uno o più percorsi assoluti (`~` è consentito), separati dal separatore di liste di percorsi della piattaforma. Viene letta dall'ambiente del processo o dal blocco `env` di `~/.claude/settings.json`, mai dalle impostazioni di un progetto.

In una sessione interattiva la cartella è osservata. Un salvataggio ricarica il modulo quando la cartella è rimasta ferma per un momento; i salvataggi fatti mentre un turno è in corso ricaricano una sola volta, alla fine del turno. Durante lo sviluppo esegui `claude --debug`: quando un hook viene saltato o un modulo non si carica, la trascrizione lo dice una volta, e il log di debug riporta ogni occorrenza.

### 2. Trasforma la cartella in un marketplace locale

Un marketplace è un solo file, `.claude-plugin/marketplace.json`, accanto a `plugin.json`. La sua unica voce punta alla cartella stessa:

```json
{
  "name": "greeter-dev",
  "owner": { "name": "Example Author" },
  "plugins": [{ "name": "greeter", "source": "./" }]
}
```

Aggiungi la cartella come marketplace e installa la mod da lì:

```bash
claude plugin marketplace add ./greeter
claude plugin install greeter@greeter-dev
```

Al prompt di una sessione nel terminale la riga di installazione ha anche la forma `/plugin install <mod> --marketplace <source>`, dove la sorgente è un `<owner>/<repo>` di GitHub, un URL git o il percorso di una cartella. `claude plugin list` mostra la cartella da cui viene letto un plugin (`Read from:`).

Poiché il `source` della voce è un percorso relativo, la sessione legge la mod da quella cartella, non da una copia. Dopo una modifica, esegui:

```text
/reload-plugins
```

Il ricaricamento indica il plugin e la cartella quando la cartella è cambiata dall'ultima volta che la sessione l'ha letta.

### 3. Valida

```bash
claude plugin validate ./greeter
```

Legge il file del marketplace, il manifest, il contratto di tipi e il sorgente del modulo degli hook come farà il motore, e riporta quali eventi il modulo aggancia, cosa chiama e tutto ciò che il motore rifiuterebbe, prima che una sessione lo carichi. Per `greeter` la sezione degli hook dice:

```text
❯ ./register.tsx hooks: session.start, tool.call
❯ ./register.tsx gating hook without .catch: tool.call
❯ ./register.tsx calls: $.state.get, $.state.set, $.ui.status, $.ui.toast
❯ ./register.tsx state writes: greeter.calls
❯ ./register.tsx state reads: greeter.calls
```

La stessa esecuzione elenca anche i controlli che applica la directory pubblica dei plugin (un README di almeno 40 parole, un file `LICENSE` o una `license` in `plugin.json`, un'icona). Contano per una pubblicazione, non per eseguire la mod.

Validate conosce la mod, non una sessione: se un hook è stato davvero eseguito si verifica nella sessione, con `claude --debug`.

### 4. Testa

`claude plugin test <folder>` esegue i file `*.test.ts` e `*.test.tsx` del plugin contro il motore stesso. Un test importa `test` ed `expect` (e `mock`) da `claude-code/testing` e riceve il `$` del motore e un `on` i cui hook stanno sotto il plugin, al posto del motore. Sotto di loro non c'è nient'altro, quindi è il test a rispondere a ciò che il plugin chiama: una chiamata su `$` con `{ value }`, un evento con il suo risultato.

Scrivi `tests/greeter.test.tsx`:

```tsx
import { expect, test } from 'claude-code/testing'

test('greets on start and counts tool calls', async ($, on) => {
  const toasts: string[] = []
  const lines: (string | undefined)[] = []

  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.status', (_, e) => {
    lines.push(e.text)
    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.tool.call({ tool: 'Bash', command: 'pwd' })

  expect(toasts).toEqual(['Hello from greeter'])
  expect(lines.at(-1)).toBe('greeter: 2 tool calls')
})
```

Eseguilo:

```bash
claude plugin test ./greeter
```

```text
(pass) greets on start and counts tool calls
 1 pass
 0 fail
```

Un test di interfaccia monta un componente attraverso il plugin su una superficie che indica (`$.ui.mount({ plugin, surface, component, props })`) e agisce sul disegno tramite chiave: `find`, `press`, `input`. Scrivi il corpo una volta e ripetilo in un ciclo sulle superfici, così il test dimostra che la mod non dipende da una sola di esse. L'esempio `pane.test.tsx` della skill monta un `Pane` su `terminal`, `desktop`, `vscode` e `mobile` in un solo ciclo.

### 5. Controlla i tipi

Quando Claude Code carica una mod da una cartella in cui la stai scrivendo (una cartella di `--plugin-dir` o di `CLAUDE_CODE_PLUGIN_DIRS` che la sessione ricarica a caldo), mette le dichiarazioni dell'API accanto a essa in `.claude-plugin/types/`, con un `tsconfig.json`. Il `tsconfig.json` della mod lo estende:

```json
{
  "extends": "./.claude-plugin/types/tsconfig.json"
}
```

Poi:

```bash
npx tsc -p ./greeter
```

`.claude-plugin/types/` viene rigenerata a ogni caricamento, quindi tienila fuori da git. Entrambe le mod di Narsil la elencano in `.gitignore`.

Una cartella che la sessione non ricarica a caldo (quella di un plugin installato, o una `--plugin-dir` sotto `claude -p`) non riceve mai quei file. Controlla i tipi di una mod del genere con il `tsconfig.json` stampato nell'intestazione di `claude-code.d.ts`, tenuto fuori dalla cartella della mod, con il suo `include` che punta a una copia del file di dichiarazioni e a `hooks`, `types` e `tests` della mod.

## Errori comuni e come testarlo

- **Modificare una copia che la sessione non esegue.** Una mod installata da un repository git esegue la copia installata. Durante lo sviluppo installa da un marketplace in una cartella locale, oppure carica la cartella con `--plugin-dir`.
- **Un hook di test che non restituisce nulla.** In `claude plugin test`, un hook che fa le veci del motore deve rispondere. Una chiamata a `$` a cui non risponde nessuno fallisce con "returned no result" e "nothing beneath the plugins answers ui.toast".
- **Testare una sola superficie.** Ripeti i test di interfaccia in un ciclo sulle superfici che supporti; le app mobile potrebbero non disegnare `Input` o `Select`.
- **Fare commit di `.claude-plugin/types/`.** Appartiene alla build che l'ha scritta. Rigenerala, non modificarla mai.
- **Aspettarsi che validate esegua il codice.** Legge il sorgente. Il comportamento lo mostrano `claude plugin test` e una sessione `--debug`.

## Per andare oltre

Entrambe le mod di Narsil includono un file di marketplace che elenca la mod con `"source": "./"`: il `.claude-plugin/marketplace.json` di narsil-pet chiama il marketplace `narsil`, e quello di narsil-check lo chiama `narsil-check`. I loro README installano con due righe al prompt di Claude Code:

```text
/plugin marketplace add davshn/narsil-pet
/plugin install narsil-pet@narsil
```

e aggiornano con `/plugin marketplace update` seguito da `/plugin update`. Il README di narsil-check descrive il flusso di lavoro locale di questa guida: aggiungi la cartella della tua copia con `claude plugin marketplace add`, e le modifiche arrivano con `/reload-plugins`, senza reinstallare. Il suo `tsconfig.json` è la riga `extends` vista sopra, e la sua cartella `tests/` contiene un `*.test.tsx` per funzionalità; `tests/pane.test.tsx` monta il pannello con una costante `PANE` nello stesso modo dell'esempio della skill.
