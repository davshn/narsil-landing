---
title: Di cosa è fatta una mod
description: I tre file di una mod di Claude Code, la funzione register e i suoi hook, e la mod più piccola che mostra qualcosa sullo schermo.
route: mods
order: 1
updated: 2026-11-18
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

Una mod è un plugin di Claude Code fatto di hook. Un hook è una funzione che Claude Code chiama quando succede qualcosa: inizia una sessione, Claude chiama uno strumento, finisce un turno. Le mod si scrivono in TypeScript e cambiano ciò che Claude Code mostra o come si comporta.

In questa guida chiederai a Claude di costruire una piccola mod chiamata `greeter`. Mostra un breve messaggio (un toast) quando inizia una sessione e conta le chiamate agli strumenti nella sua riga di stato. Strada facendo imparerai quali file servono a ogni mod e cosa fa la funzione `register`, così potrai capire se ciò che ha scritto Claude è corretto.

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

## Costruiscila con Claude

Non devi scrivere tu questi file. Claude Code include una skill per scrivere mod, `plugin-authoring`, che conosce i tipi reali dell'API delle mod. Chiedi a Claude di usarla e descrivi ciò che vuoi con parole semplici: il nome della mod, cosa fa e quando.

> Usando la skill plugin-authoring, crea una mod di Claude Code chiamata `greeter` in una nuova cartella. Quando inizia una sessione, mostra un toast che dice "Hello from greeter". Conta ogni chiamata a uno strumento e mostra il conteggio nella sua riga di stato, per esempio "greeter: 3 tool calls". Conserva il conteggio in `$.state` con un `atom` dichiarato in `types/index.d.ts`, così sopravvive a un ricaricamento del modulo. Quando hai finito, esegui `claude plugin validate` sulla cartella e mostrami cosa riporta.

Perché questo prompt funziona:

- **Nomina la skill**, così Claude controlla ogni chiamata con l'API reale invece di tirare a indovinare.
- **Descrive un comportamento che puoi vedere** (il toast e la riga di stato), così puoi capire quando funziona.
- **Dice dove vive il conteggio.** Senza quella riga, una prima risposta frequente tiene il conteggio in una semplice variabile che si azzera ogni volta che salvi il file. Il passo 4 qui sotto mostra perché.
- **Chiede una prova.** L'output di validate elenca gli hook e le chiamate che la mod fa davvero.

Quando Claude risponde, controlla quattro cose prima di andare avanti:

1. La cartella ha i quattro file della tabella qui sopra: `plugin.json`, `hooks.json`, `register.tsx` e `types/index.d.ts`.
2. Ogni hook termina con `return next(e)`.
3. Il conteggio usa `atom` e `update`, non una variabile dichiarata con `let`.
4. `claude plugin validate` elenca `hooks: session.start, tool.call`.

Se qualcosa non va, di' a Claude cosa vedi, non solo come correggerlo: "il conteggio torna a 0 ogni volta che salvo `register.tsx`". Descrivere il sintomo permette a Claude di trovarne la causa, e tu impari a leggere la mod come la legge Claude.

## Capisci il codice, passo dopo passo

Ecco come appare una buona risposta, costruita un pezzo alla volta. Leggila per capire cosa fa ogni riga e per confrontarla con ciò che ha scritto Claude. Claude può scegliere altri nomi o un altro ordine ed essere comunque corretto.

### 1. Il manifest

La mod vive in una cartella chiamata `greeter`. Il suo manifest è `.claude-plugin/plugin.json`:

```json
{
  "name": "greeter",
  "version": "0.1.0",
  "description": "Says hello when a session starts and counts tool calls"
}
```

Il `name` è il modo in cui Claude Code, il suo log di debug e le tue chiavi di stato fanno riferimento alla mod.

### 2. Il file degli hook

`hooks/hooks.json` dice a Claude Code quale file contiene gli hook:

```json
{ "modules": ["./register.tsx"] }
```

### 3. Un hook che mostra qualcosa

`hooks/register.tsx` comincia con un hook su `session.start`:

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

Un secondo hook conta le chiamate. `tool.call` gira per ogni chiamata a uno strumento, e `$.ui.status(text)` fissa una riga per questo plugin sotto il prompt finché la chiamata successiva non la sostituisce:

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

Questa è una prima risposta frequente, e un buon esempio del perché conviene controllare: funziona finché non salvi il file. `count` è una variabile del modulo, e salvare ricarica il modulo in un ambiente nuovo, quindi il conteggio riparte da 0.

### 5. Un contratto di tipi e uno stato che sopravvive al ricaricamento

La soluzione è `$.state`, che contiene valori con nome per la sessione e li conserva quando il modulo si ricarica. Il valore si dichiara in `types/index.d.ts`:

```ts
declare module 'claude-code' {
  interface PluginState {
    greeter: { calls: number }
  }
}
```

Il manifest indica quel file:

```json
{
  "name": "greeter",
  "version": "0.1.0",
  "description": "Says hello when a session starts and counts tool calls",
  "types": "./types/index.d.ts"
}
```

E l'hook usa gli helper di stato `atom` e `update` di `claude-code`:

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

La guida successiva, "Installare, ricaricare, validare e testare", mostra come caricarla in una sessione e testarla.

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
