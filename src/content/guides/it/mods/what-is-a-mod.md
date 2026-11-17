---
title: Di cosa è fatta una mod
description: I tre file di una mod di Claude Code, la funzione register e i suoi hook, e la mod più piccola che mostra qualcosa sullo schermo.
route: mods
order: 1
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: .claude-plugin/plugin.json
  - repo: pet
    path: hooks/hooks.json
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: types/index.d.ts
---

## Cosa fa

Una mod è un plugin di Claude Code fatto di hook di funzione: codice TypeScript che gira dentro Claude Code e cambia ciò che mostra o come si comporta. Alla fine di questa guida saprai quali file servono a una mod, cosa fa la funzione `register`, e avrai una mod che mostra un toast quando inizia una sessione e tiene il conto delle chiamate agli strumenti nella sua riga di stato.

L'API delle mod è in accesso anticipato e cambia da una release all'altra. Tutto quello che trovi qui è stato verificato con Claude Code 2.1.325 e il suo file di dichiarazioni, `claude-code.d.ts`. Se la tua build è più recente, fa fede quel file.

## Come funziona dentro

Una mod è una cartella con tre file che scrivi a mano:

| File                         | Cosa contiene                                                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `.claude-plugin/plugin.json` | Il manifest: `name`, `version`, `description` e, facoltativamente, `license`, `repository` e `types`.                 |
| `hooks/hooks.json`           | Una riga che indica il modulo degli hook: `{ "modules": ["./register.tsx"] }`. Il percorso è relativo a `hooks.json`. |
| `hooks/register.tsx`         | Il modulo degli hook. Esporta `register`.                                                                             |

Il modulo degli hook è un modulo ES con estensione `.ts`, `.tsx`, `.js` o un altro suffisso di script. Gira in un ambiente tutto suo, senza DOM e senza Node. Tutto ciò che sta fuori dal modulo (lo schermo, i file, la rete, l'orologio) si raggiunge attraverso l'oggetto `$` che ogni hook riceve. Gli altri file del plugin si importano con normali dichiarazioni `import`; un modulo che usa `import()` dinamico non si carica.

`register(on, options)` viene chiamata quando il modulo si carica. `on(event, matcher?, hook)` aggiunge un hook a un evento. `options` contiene i valori dei campi `userConfig` che il manifest dichiara.

Ogni hook ha la forma `($, e, next)`:

- `$` è l'interfaccia del motore: visualizzazione, store, stato, orologio, rete, processi, file, sessione, modello, strumenti, comandi e il resto.
- `e` è l'input dell'evento come valore semplice. Per `tool.call` è la chiamata allo strumento, ristretta per ciascuno strumento.
- `next(e)` passa l'evento agli altri plugin e poi al comportamento di Claude Code, e si risolve con il risultato dell'evento.

Un hook che termina senza chiamare `next` risponde all'evento da solo. Un hook che chiama `next({ ...e, ... })` cambia ciò che vede il resto della catena, entro i limiti che quell'evento consente. La maggior parte degli hook che si limitano a osservare termina con `return next(e)`.

Il file facoltativo `types/index.d.ts` è il contratto di tipi della mod. Dichiara la forma dei valori che la mod conserva in `$.state` (e, per una mod che aggiunge un nome a `$`, quel nome). `plugin.json` lo indica sotto `"types"`, e `claude plugin validate` confronta con esso le letture e le scritture di stato della mod.

## Passo dopo passo

### 1. Il manifest

Crea una cartella chiamata `greeter` e scrivi `.claude-plugin/plugin.json`:

```json
{
  "name": "greeter",
  "version": "0.1.0",
  "description": "Says hello when a session starts and counts tool calls"
}
```

Il `name` è il modo in cui Claude Code, il suo log di debug e le tue chiavi di stato fanno riferimento alla mod.

### 2. Il file degli hook

Scrivi `hooks/hooks.json`:

```json
{ "modules": ["./register.tsx"] }
```

### 3. Un hook che mostra qualcosa

Scrivi `hooks/register.tsx` con un hook su `session.start`:

```tsx
import type { Register } from 'claude-code'

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    $.ui.toast('Hello from greeter')
    return next(e)
  })
}
```

`Register` viene dal modulo `claude-code`. L'import serve solo per i tipi: in esecuzione è vuoto. `$.ui.toast(text)` mostra un piccolo riquadro sotto il nome del plugin per qualche secondo (4000 ms per impostazione predefinita). Poi l'hook chiama `next(e)` perché la sessione inizi come al solito.

### 4. Una riga di stato che conta le chiamate agli strumenti

Aggiungi un secondo hook. `tool.call` gira per ogni chiamata a uno strumento, e `$.ui.status(text)` fissa una riga per questo plugin sotto il prompt finché la chiamata successiva non la sostituisce:

```tsx
import type { Register } from 'claude-code'

export const register: Register = (on) => {
  let count = 0

  on('session.start', async ($, e, next) => {
    $.ui.toast('Hello from greeter')
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    count += 1
    $.ui.status(`greeter: ${count} tool calls`)
    return next(e)
  })
}
```

Funziona, ma `count` è una variabile del modulo. Salvare il file ricarica il modulo in un ambiente nuovo, quindi il conteggio riparte da zero.

### 5. Un contratto di tipi e uno stato che sopravvive al ricaricamento

`$.state` contiene valori con nome per la sessione, e questi sopravvivono a un ricaricamento a caldo del modulo. Dichiara il valore in `types/index.d.ts`:

```ts
declare module 'claude-code' {
  interface PluginState {
    greeter: { calls: number }
  }
}
```

Indica il file nel manifest:

```json
{
  "name": "greeter",
  "version": "0.1.0",
  "description": "Says hello when a session starts and counts tool calls",
  "types": "./types/index.d.ts"
}
```

Poi usa gli helper di stato `atom` e `update` di `claude-code`:

```tsx
import { atom, update } from 'claude-code'
import type { Register } from 'claude-code'

const calls = atom({ plugin: 'greeter', key: 'calls' } as const, 0)

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    $.ui.toast('Hello from greeter')
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const count = await update($, calls, (n) => n + 1)
    $.ui.status(`greeter: ${count} tool calls`)
    return next(e)
  })
}
```

`plugin` e `key` devono essere stringhe letterali, coerenti con il contratto. `update` legge il valore, applica la funzione e lo riscrive, riprovando se nel frattempo è arrivata un'altra scrittura, e si risolve con il nuovo valore.

La mod finita:

```text
greeter/
  .claude-plugin/plugin.json
  hooks/hooks.json
  hooks/register.tsx
  types/index.d.ts
```

La guida "Installare, ricaricare, validare e testare" mostra come caricarla in una sessione.

## Errori comuni e come testarlo

- **Dimenticare `next`.** Un hook che non chiama mai `next(e)` risponde all'evento da solo. Su `session.start` o `tool.call` questo cambia più di quanto volevi. Restituisci `next(e)`, a meno che rispondere non sia proprio lo scopo.
- **Registrare due volte lo stesso hook.** Una registrazione ripetuta lancia un errore, e un ciclo che esegue due volte lo stesso `on(...)` supera validate ma viene rifiutato al caricamento.
- **Usare API di Node o del DOM.** Non ci sono `require`, il modulo `fs` né `window`. Usa `$.fs`, `$.http`, `$.process` e il resto di `$`.
- **Un hook che lancia un errore.** Viene saltato e la catena prosegue senza di lui. Durante lo sviluppo esegui `claude --debug`: il log di debug dice perché un hook è stato saltato.

Esegui `claude plugin validate` sulla cartella presto e spesso. Legge il manifest, il contratto e il modulo degli hook come farà Claude Code. Per il `greeter` finito riporta, tra le altre, queste righe:

```text
❯ types ./types/index.d.ts declares state: greeter.calls
❯ ./register.tsx hooks: session.start, tool.call
❯ ./register.tsx gating hook without .catch: tool.call
❯ ./register.tsx calls: $.state.get, $.state.set, $.ui.status, $.ui.toast
```

La riga `gating hook without .catch` è un'informazione, non un errore: `tool.call` è un evento la cui risposta può rifiutare ciò che è stato chiesto, e un hook che lì fallisce viene saltato. Solo un hook che fa da guardia (uno che può rifiutare una chiamata) ha bisogno di un gestore `.catch`.

## Per andare oltre

narsil-pet segue la stessa struttura. Il suo `.claude-plugin/plugin.json` imposta `"license": "GPL-3.0-or-later"`, `repository` e `"types": "./types/index.d.ts"`. Il suo `hooks/hooks.json` è la stessa riga vista sopra. Il suo `hooks/register.tsx` esporta `register` e registra un hook per evento, a cominciare da `session.start`, che registra il comando `/narsil`, ripristina le preferenze da `$.store` e avvia i suoi timer prima di restituire `next(e)`. Il suo `types/index.d.ts` esporta i tipi della mod (`Mood`, `Pet`, `Prefs` e altri) e dichiara ogni chiave di `$.state` sotto `PluginState['narsil-pet']`.
