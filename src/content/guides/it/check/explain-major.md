---
title: Spiegare una versione major con Haiku
description: 'Come Narsil Check chiede a Haiku quanto è difficile un aggiornamento major per questo progetto, dalle note di release e dalle righe che importano la libreria, e come evita che il modello inventi.'
route: check
order: 11
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/explain.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/words.ts
  - repo: check
    path: hooks/adapter.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/upgrade.test.tsx
  - repo: check
    path: odd/tasks/ecosystems-wave-2.md
---

## Cosa fa

Una versione major dice "qualcosa potrebbe rompersi". Non dice se si rompe per te. React 19 ha rimosso diverse API vecchie; se il tuo progetto non le ha mai usate, l'aggiornamento è piccolo. Per saperlo, apriresti le note di release, poi cercheresti nel tuo codice ogni punto che importa la libreria, e confronteresti.

Narsil Check fa quel confronto per ogni libreria del gruppo **Versión mayor: revisar cambios** ("Versione major: rivedi le modifiche"). Sotto ogni riga, mentre lavora, una riga attenuata dice `Analizando con Haiku…` ("Analisi con Haiku in corso…"). Poi mostra una difficoltà e una o due frasi:

```text
react 18.2.0 → 19.2.0
  Dificultad media: React 19 quita propTypes; tus 2 imports no los usan, pero revisa las refs de texto.
```

Si legge "Difficoltà media: React 19 rimuove propTypes; i tuoi 2 import non li usano, ma controlla le ref di testo." L'esempio è quello che usano i test. La riga è verde per `baja` (bassa), gialla per `media` (media) e rossa per `alta` (alta).

Una pressione sulla riga copia il salto con la sua difficoltà e il suo motivo, pronto da incollare in una issue o in un prompt. Il motivo viene chiesto una volta per salto e tenuto, così nella sessione successiva c'è di nuovo senza costo.

## Come funziona dentro

`hooks/explain.ts` contiene le parti semplici (quali release rompono, il prompt, la lettura della risposta). `hooks/register.tsx` scarica, esegue `git grep` e chiama il modello. Questa divisione permette ai test di controllare il prompt e il parsing come funzioni pure.

### Quando gira

Quando un'analisi finisce, `scanProject` mostra subito l'elenco e avvia `explainMajors` senza aspettarlo. Si leggono solo gli aggiornamenti del gruppo `review`: una major che qualcosa blocca sta in **Bloqueada** e mostra invece i suoi motivi di blocco. Se ne leggono due alla volta (`EXPLAIN_CONCURRENCY`), così un elenco di venti major non lancia venti chiamate al modello insieme. Una riga già fatta o in corso viene saltata.

### Il primo input: le note di release delle versioni che rompono

`breakingVersions(current, latest)` indica le release che rompono tra le due, dalla più recente e al massimo tre: l'`x.0.0` di ogni nuova major (da 16 a 19: `19.0.0`, `18.0.0`, `17.0.0`), oppure sotto 1.0.0 lo `0.y.0` di ogni nuova minor. Le note delle release patch intermedie vengono lasciate fuori apposta: le modifiche che rompono vengono annunciate nella release che rompe.

`releaseNotes` trova poi il repository GitHub della libreria. Per npm legge il campo `repository` del `node_modules/<name>/package.json` installato, altrimenti quello della risposta del registry; gli altri ecosistemi lo danno attraverso il loro adattatore (`repoUrlOf`, `infoUrl` o `repoUrlFor`). Per ogni versione che rompe prova tre nomi di tag sull'API delle release di GitHub, perché i pacchetti usano tag diversi: `v19.0.0`, `@scope/name@19.0.0` per un monorepo, o il semplice `19.0.0`.

Le note di ogni release vengono tagliate a 6.000 caratteri e tutte insieme a 12.000 (`NOTES_PER_RELEASE`, `NOTES_TOTAL`), con `[…]` dove qualcosa è stato tagliato. Il commento dice perché esiste il limite per release: "so a long upgrade guide still leaves room" (così una lunga guida di aggiornamento lascia ancora spazio) per le altre release.

Quando nessuna release ha note e il pacchetto viene da npm, la mod legge il `CHANGELOG.md` del pacchetto da unpkg e tiene solo ciò che sta sopra l'intestazione della versione installata: ciò che è cambiato da allora. unpkg serve solo pacchetti npm, quindi gli altri ecosistemi non hanno un ripiego.

### Il secondo input: come lo usa il progetto

`usageOf` esegue:

```text
git --no-pager grep -n -I -E <pattern> -- . :!node_modules
```

Il pattern viene dall'`importPattern` dell'adattatore. Per npm riconosce `from 'name'`, `from 'name/sub'`, `require('name')` e `import('name')`; Python riconosce le righe `import` e `from` con il nome del modulo (`yaml` per PyYAML); ogni ecosistema ha il suo. Il risultato è il numero di file e al massimo 40 righe di al massimo 200 caratteri, ciascuna come `path:line:text`.

Si usa `git grep`, non una visita dei file, perché cerca solo nei file tracciati, salta i binari con `-I` ed è veloce su un repository grande.

### Il prompt esatto

Il system prompt è `SYSTEM` in `hooks/explain.ts`, citato così com'è in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Non è cambiato dal primo commit.

```text
You assess how hard a major dependency upgrade is for one specific project.
You get the release notes of the breaking versions and the lines where the project imports the library.
Answer in Spanish, in exactly this form:
DIFICULTAD: baja|media|alta
RAZÓN: one or two sentences, at most 280 characters, naming the concrete breaking change that affects the imports shown, or saying none of them is touched.
Base the answer only on what you are given. Never invent APIs, versions or changes.
If the release notes are missing, say so in the reason and judge only from how much the project uses the library.
```

In italiano: "Valuti quanto è difficile un aggiornamento major di una dipendenza per un progetto specifico. Ricevi le note di release delle versioni che rompono e le righe in cui il progetto importa la libreria. Rispondi in spagnolo, esattamente in questa forma: DIFICULTAD: baja|media|alta; RAZÓN: una o due frasi, al massimo 280 caratteri, che nominano la modifica concreta che rompe e tocca gli import mostrati, o che dicono che nessuno di essi è toccato. Basa la risposta solo su ciò che ti viene dato. Non inventare mai API, versioni o modifiche. Se mancano le note di release, dillo nel motivo e giudica solo da quanto il progetto usa la libreria."

È scritto in inglese, con le etichette della risposta in spagnolo perché il pannello parla spagnolo: `DIFICULTAD: baja|media|alta` è "DIFFICOLTÀ: bassa|media|alta", e `RAZÓN` è "MOTIVO".

Il messaggio utente è costruito da `prompt(u, notes, usage)`, anch'esso in `hooks/explain.ts`:

```text
Library: react
Upgrade: 18.2.0 -> 19.2.0

The project imports it in 2 files:
src/App.tsx:1:import { useState } from 'react'
src/main.tsx:2:import React from 'react'

Release notes of the breaking versions:
## v19.0.0
…
```

Senza import trovati, le righe vengono sostituite da "(no imports found: it may be used through config or a CLI)" (nessun import trovato: potrebbe essere usata tramite configurazione o una CLI). Senza note, l'ultima parte dice "(none found)" (nessuna trovata).

### Come evita che il modello inventi

Un modello a cui si chiede "quanto è difficile React 19?" risponderà da ciò che ricorda, che può essere sbagliato o più vecchio della release. Quattro scelte del design lavorano contro questo:

- **Gli si danno le prove.** Le note e le righe di import sono nel messaggio; il modello non deve ricordare né le une né le altre.
- **Gli si dice di usare solo quelle.** "Base the answer only on what you are given. Never invent APIs, versions or changes." (basa la risposta solo su ciò che ti viene dato; non inventare mai API, versioni o modifiche).
- **Ha una via d'uscita onesta.** Senza note, deve dirlo e giudicare da quanto il progetto usa la libreria, invece di riempire il vuoto.
- **La risposta ha una forma fissa.** `parseReason` accetta una risposta solo quando ha sia `DIFICULTAD:` con una delle tre parole sia `RAZÓN:` con del testo. Qualsiasi altra cosa viene scartata, e la riga dice "Haiku no dio una razón; revisa las notas de la versión." ("Haiku non ha dato un motivo; controlla le note della versione"). Il motivo viene tagliato a 400 caratteri, così una risposta fuori controllo non può riempire il pannello.

Niente di tutto questo prova che il motivo sia giusto; lo rende verificabile. Il pannello mostra cosa ha concluso Haiku e nomina la modifica che rompe, così puoi aprire le stesse note di release e controllarlo.

### Chiamare Haiku: `$.model.complete`

```ts
const reply = await $.model.complete({
  model: 'haiku',
  system: SYSTEM,
  prompt: prompt(u, notes, usage),
  maxTokens: 400,
  timeoutMs: EXPLAIN_MS,
})
const reason = reply.isAnswered ? parseReason(reply.text) : undefined
```

Citato da `hooks/register.tsx` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later), riformattato. `EXPLAIN_MS` è 60 secondi.

I tipi della 2.1.325 descrivono `$.model.complete` come "one text completion through the session's own API client" (un completamento di testo attraverso il client API della sessione stessa), con "No tools, no history, no system prompt beyond the CLI's identity block and `request.system`" (niente strumenti, niente cronologia, nessun system prompt oltre al blocco di identità della CLI e a `request.system`). Quindi Haiku vede solo questo messaggio, niente della tua conversazione. `model` accetta un alias come `haiku`, "resolved and allowlist-checked like a `--model` value" (risolto e controllato contro la allowlist come un valore di `--model`). Il risultato non viene mai rifiutato per ciò che ha fatto il provider: dice `isAnswered`, oppure dà un `reason` (`api-error`, `empty-reply`, `aborted`), e la mod li tratta tutti come "nessun motivo". Un'eccezione durante l'intero passo mostra "No pude analizar esta actualización." ("Non sono riuscito ad analizzare questo aggiornamento.").

Una buona risposta viene scritta in `$.store` sotto `why:<name>@<current>-><latest>` e tenuta per sempre: le note di una release pubblicata non cambiano. Una fallita non viene tenuta, così l'analisi successiva riprova.

### Costo

I tipi dicono che una richiesta con risposta "counts toward the session's cost total, `/cost` and the cost and token metrics" (conta nel costo totale della sessione, in `/cost` e nelle metriche di costo e di token), e che "Nothing caps it per call" (niente la limita per chiamata). La mod la limita da sé: al massimo 400 token in uscita, e un input di al massimo 12.000 caratteri di note più 40 righe brevi. Ogni salto viene chiesto una volta, per sempre, su quella macchina. Un lungo elenco di major costa una volta; le sessioni successive leggono l'archivio.

### Privacy

Cosa lascia la tua macchina, e dove va:

- **Al provider del modello** (attraverso il client della sessione stessa): il nome della libreria, le due versioni, e fino a 40 righe di import dal tuo codice con i loro percorsi di file. Non il resto dei tuoi file.
- **All'API di GitHub e a unpkg**: il nome del pacchetto e le versioni, per scaricare note pubbliche. Il README segnala il limite di GitHub senza autenticazione, 60 richieste all'ora; quando si esaurisce, l'analisi usa il `CHANGELOG.md` o dice che non ha trovato note.

Le righe di import di solito sono innocue, ma sono il tuo codice. Una mod che legge le major di pacchetti privati dovrebbe tenerlo presente.

### README e codice

Il README dice "Si no hay release, se usa el `CHANGELOG.md` del paquete" ("Se non c'è una release, si usa il `CHANGELOG.md` del pacchetto"), senza limiti. Nel codice, quel ripiego è solo per npm, perché passa per unpkg.

## Costruiscila con Claude

Chiedi a Claude di mandare a Haiku le note di rilascio di un aggiornamento major e le righe di import del progetto, e di mostrare quanto è difficile il salto. L'unica idea che deve fare bene è che Haiku risponde solo dalle prove che riceve, in una forma fissa che la mod può verificare.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nella mia mod di Claude Code `my-panel`, sotto ogni libreria npm con un aggiornamento major, mostra quanto è difficile il salto per questo progetto. Per ciascuna, trova il suo repository GitHub dal campo `repository` di `node_modules/<name>/package.json`, scarica con `$.http.fetch` le note di release dell'`x.0.0` di ogni nuova major (al massimo tre, tag `v<version>`, `<name>@<version>` o `<version>`), e tagliale a 12.000 caratteri. Trova le righe di import con `$.process.run(['git', '--no-pager', 'grep', '-n', '-I', '-E', pattern, '--', '.', ':!node_modules'])`, al massimo 40. Chiama `$.model.complete` con `model: 'haiku'`, `maxTokens: 400`, un `timeoutMs` di 60 secondi, e un system prompt che chieda esattamente `DIFFICULTY: low|medium|high` e `REASON:` in al massimo 280 caratteri, basandosi solo su ciò che riceve, senza mai inventare API, e dicendolo quando mancano le note. Accetta la risposta solo se entrambe le righe si leggono. Mettila in cache per sempre in `$.store` sotto `why:<name>@<from>-><to>`. Mostra "Analisi in corso…" mentre gira. Testa con `on('model.complete', ...)` che il prompt contenga le note e una riga di import, e che una risposta senza la forma mostri una riga di ripiego.

### Cosa controllare nella risposta di Claude

1. Il messaggio inviato a `$.model.complete` contiene le note di rilascio delle versioni con modifiche incompatibili e le righe di import, tagliate ai loro limiti: 12.000 caratteri di note e al massimo 40 righe.
2. Il system prompt dice al modello di basare la risposta solo su ciò che riceve, di non inventare mai API e di dirlo quando mancano le note.
3. Una risposta viene accettata solo quando si possono analizzare sia la riga della difficoltà sia quella del motivo. Qualsiasi altra cosa mostra una riga di riserva e non viene salvata.
4. Un motivo valido viene conservato in `$.store` sotto una chiave con il nome ed entrambe le versioni, così lo stesso salto non viene mai chiesto di nuovo. Uno fallito viene chiesto di nuovo alla scansione successiva.
5. La scansione non aspetta i motivi: l'elenco compare subito, con "Analisi in corso…" sotto ogni major finché non arriva il suo motivo.

Se un controllo fallisce, di' a Claude cosa vedi: "Haiku nomina un'API che il mio progetto non importa mai, e il prompt non contiene righe di import".

### Come l'ha chiesta l'autore

La richiesta originale per questa funzionalità non è stata registrata: è già nel primo commit, e nessun log di task pubblico ne copre la creazione. Un log di task successivo registra come è stata portata agli altri ecosistemi, con le parole dell'agente.

#### Registrato in un log di task

`odd/tasks/ecosystems-wave-2.md` elenca, come spec S5, cosa doveva continuare a funzionare quando è stato aggiunto il secondo gruppo di ecosistemi. Questa è la spec dell'agente, non le parole dell'autore:

> "Haiku's reason for a major upgrade works for every ecosystem: release notes from the repository each registry records, and the project's imports found with git grep."

In italiano: "Il motivo di Haiku per un aggiornamento major funziona per ogni ecosistema: le note di release dal repository che ogni registry registra, e gli import del progetto trovati con git grep."

La S3 dello stesso file elenca "Haiku reasons" (i motivi di Haiku) tra i comportamenti che dovevano restare invariati.

#### Ricostruzione dalla cronologia dei commit

Da `git log -- hooks/explain.ts` e `git log -S SYSTEM` in narsil-check:

- `1bf736a` (2026-11-04) "feat: add upgrade panel for npm and Expo projects" (aggiunge un pannello di aggiornamenti per progetti npm ed Expo). Il suo messaggio descrive "majors with Haiku's reading of the release notes against the project's imports" (le major con la lettura di Haiku delle note di release confrontate con gli import del progetto). `SYSTEM`, `prompt`, `parseReason`, `breakingVersions` e la cache `why:` sono tutti qui, così come sono ora.
- `a95eb07` (2026-11-04) "refactor: read dependencies through an adapter per ecosystem" (legge le dipendenze attraverso un adattatore per ecosistema). Ogni adattatore riceve il suo `importPattern` e il suo `repoUrlOf`, ed è così che il motivo arriva agli altri ecosistemi.
- `c50e830` (2026-11-04) "feat: find manifests anywhere in the tree and read four-part versions" (trova i manifest ovunque nell'albero e legge le versioni in quattro parti). Il suo messaggio: "infoUrl gives release notes a version's own record" (infoUrl dà alle note di release il record proprio di una versione), per i registry la cui risposta sull'ultima versione non nomina alcun repository.
- `b3ad055` (2026-11-06) "feat: fold upgrade and vulnerability groups, copy a row on click, …" (chiude i gruppi di aggiornamenti e vulnerabilità, copia una riga al clic, …). Una pressione su una riga la copia con il motivo di Haiku, sostituendo i pulsanti di copia.

Il prompt stesso non è mai cambiato. Ciò che è cresciuto è da dove vengono le note e l'uso.

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida. Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

Questa è una versione ridotta dell'idea, scritta per questa guida e verificata con i tipi di Claude Code 2.1.325 (`$.model.complete`, `$.store.get`, `$.store.set`). È adattata da `hooks/explain.ts` e `hooks/register.tsx` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Le note e le righe di import vengono passate come argomenti; come scaricarle è mostrato sopra.

```ts
import type { EngineInterface } from 'claude-code'

export type Reason = { difficulty: 'low' | 'medium' | 'high'; text: string }

const SYSTEM = [
  'You assess how hard a major dependency upgrade is for one specific project.',
  'You get the release notes of the breaking versions and the lines where the project imports the library.',
  'Answer in exactly this form:',
  'DIFFICULTY: low|medium|high',
  'REASON: one or two sentences, at most 280 characters.',
  'Base the answer only on what you are given. Never invent APIs, versions or changes.',
  'If the release notes are missing, say so and judge only from how much the project uses the library.',
].join('\n')

export function parseReason(text: string): Reason | undefined {
  const difficulty = /DIFFICULTY:\s*(low|medium|high)/i.exec(text)?.[1]?.toLowerCase()
  const reason = /REASON:\s*([\s\S]+)/i.exec(text)?.[1]?.trim()
  if (!difficulty || !reason) return undefined
  return {
    difficulty: difficulty as Reason['difficulty'],
    text: reason.replace(/\s+/g, ' ').slice(0, 400),
  }
}

export async function explain(
  $: EngineInterface,
  u: { name: string; current: string; latest: string },
  notes: string,
  lines: string[],
): Promise<Reason | undefined> {
  const key = `why:${u.name}@${u.current}->${u.latest}`
  const stored = (await $.store.get(key)) as Reason | undefined
  if (stored) return stored
  const prompt = [
    `Library: ${u.name}`,
    `Upgrade: ${u.current} -> ${u.latest}`,
    '',
    'Import lines:',
    lines.length > 0 ? lines.join('\n') : '(no imports found)',
    '',
    'Release notes of the breaking versions:',
    notes.trim() || '(none found)',
  ].join('\n')
  const reply = await $.model.complete({
    model: 'haiku',
    system: SYSTEM,
    prompt,
    maxTokens: 400,
    timeoutMs: 60_000,
  })
  const reason = reply.isAnswered ? parseReason(reply.text) : undefined
  if (reason) await $.store.set(key, reason)
  return reason
}
```

Esegui `explain` da un'analisi che nessun hook attende, tieni ogni risultato in un atom per chiave con prima uno stato `loading`, e disegna la riga sotto la riga della libreria a partire da quell'atom. Un risultato `undefined` è la tua riga di ripiego, e non viene salvato.

## Errori comuni e come testarlo

Questi vengono dal codice e dai test di Narsil Check:

- **Chiedere senza prove.** Un modello con solo un nome e due versioni risponde a memoria. Manda le note e l'uso.
- **Nessun modo di dire "non lo so".** Senza la regola delle note mancanti, il modello riempie il vuoto. Dagli la risposta onesta.
- **Fidarsi del testo libero.** Leggi una forma fissa e scarta ciò che non corrisponde; taglia la lunghezza.
- **Chiedere di nuovo a ogni sessione.** Le note di una release non cambiano; metti in cache il motivo per sempre, e non mettere in cache i fallimenti.
- **Attenderlo nell'analisi.** L'elenco deve comparire subito; i motivi arrivano dopo.
- **Lanciare tutte le chiamate insieme.** Limita la concorrenza; due bastano per un pannello laterale.
- **Mandare troppo.** Limita le note e le righe. Contiene il costo e quanto del tuo codice lascia la macchina.

Per testare, `claude plugin test .` esegue `tests/upgrade.test.tsx`, che risponde al modello con `on('model.complete', ...)`, così non viene fatta nessuna richiesta reale. "each major shows the reason Haiku gives from the release notes and the imports, and a press on it copies it" (ogni major mostra il motivo che Haiku dà dalle note di release e dagli import, e una pressione su di essa lo copia) controlla che il prompt contenga il corpo della release, una riga di import e "in 2 files", poi trova la riga "Dificultad media: …" e il testo copiato. "a major read before is not asked again" (una major già letta non viene chiesta di nuovo) mette prima un motivo nell'archivio e conta le chiamate al modello. "Haiku's answer is read as a difficulty and a reason" (la risposta di Haiku si legge come una difficoltà e un motivo) e "a changelog is cut where the installed version begins" (un changelog viene tagliato dove inizia la versione installata) testano le funzioni pure.

## Per andare oltre

- Il motivo ha come chiave il nome e le versioni, non l'ecosistema. Due ecosistemi con un pacchetto dello stesso nome e lo stesso salto lo condividerebbero; aggiungere l'ecosistema alla chiave li separerebbe.
- Il motivo non cambia quando cambia il tuo codice. Se inizi a usare un'API che la prossima major rimuove, il motivo salvato non lo saprà. Una chiave che includa un hash delle righe di import chiederebbe di nuovo quando cambiano.
- La prossima guida è l'altra estremità dell'elenco: gli aggiornamenti che non richiedono alcuna lettura, e il pulsante che li alza.
