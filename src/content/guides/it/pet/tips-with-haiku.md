---
title: Consigli con Haiku
description: 'Come Narsil chiede a Haiku un breve consiglio sul lavoro in corso: quale contesto invia, il prompt esatto, ogni quanto parla, la modalità profonda e la finestra dei consigli.'
route: pet
order: 11
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/advice.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: overlay/tip.ps1
  - repo: pet
    path: overlay/tip.sh
  - repo: pet
    path: overlay/tip.js
  - repo: pet
    path: docs/plan-advice.md
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Cosa fa

Di tanto in tanto Narsil ti dà un consiglio su ciò su cui stai lavorando: due o tre frasi, in spagnolo, su qualcosa di concreto appena successo. Lo chiede a un modello piccolo, Haiku, con un breve riassunto del lavoro.

Ci sono tre momenti automatici e due su richiesta:

- **Un turno è finito.** Il consiglio legge ciò che il turno ha cambiato e commenta una decisione di design: perché è stato fatto così, qual era l'alternativa, cosa guadagna o perde ciascuna. I consigli di routine ("esegui i test", "controlla il push") sono esclusi di proposito.
- **Uno strumento è fallito più volte.** Lo stesso strumento due volte in un turno, o tre fallimenti di qualsiasi tipo. Il consiglio riguarda il debug.
- **Un turno dura da più di 3 minuti**, controllato a ogni chiamata a uno strumento. Il consiglio riguarda il ritmo, o la suddivisione del task.
- **`/narsil consejo`** ("consiglio") ne chiede uno subito, come il consiglio di fine turno.
- **`/narsil consejo profundo`** ("consiglio profondo") lo chiede al modello della sessione stessa, sull'intera conversazione.

I consigli automatici sono distanziati: al massimo uno ogni 30 minuti per impostazione predefinita (`/narsil consejos cada <min>` lo cambia), il doppio quando lo stesso tipo arriva due volte di fila, e al massimo 20 al giorno. Un consiglio che chiedi non viene mai trattenuto. `/narsil consejos off` ferma quelli automatici, `/narsil consejos voz` legge ad alta voce i consigli di fine turno, e la modalità discreta (`/narsil discreto`) li ferma insieme alla voce.

Su Windows e macOS ogni consiglio si apre per intero in una piccola finestra propria, con l'immagine di Narsil, che non prende il focus e si chiude da sola dopo 3 minuti. Altrove appare nella fascia, sotto il titolo, in un massimo di tre righe brevi con una "×" per chiuderlo, e nella finestra mobile.

Un consiglio non rallenta mai Claude: viene chiesto a cose fatte, mentre leggi la risposta.

## Come funziona dentro

### Cosa ricorda Narsil: `seen`

`hooks/advice.ts` contiene le parti che sono semplici valori (contesto, prompt, analisi della risposta); `hooks/register.tsx` possiede le chiamate. Ciò che Narsil ha visto del lavoro è una variabile di modulo, `seen`, riempita dagli hook delle guide precedenti:

- `prompt.submit`: il tuo ultimo messaggio, i suoi primi 400 caratteri (non i messaggi che il motore aggiunge da sé, `e.isMeta`).
- `tool.call`: le ultime 15 chiamate, ciascuna con il suo strumento e il breve dettaglio della fascia (il nome di un file, la prima riga di un comando); i file modificati o scritti in questo turno, con quante volte; e gli ultimi 5 fallimenti, con i primi 200 caratteri dell'errore.
- `turn.complete`: la durata del turno e la risposta finale di Claude.
- Subito prima di chiedere, `git`: ciò che il turno ha cambiato (vedi sotto).

Le variabili di modulo si perdono con un ricaricamento della mod, e va bene così: il turno successivo le riempie di nuovo. Il piano dice lo stesso: "losing it on reload is harmless" (perderlo al ricaricamento è innocuo).

### Cosa è cambiato: il diff

Per il consiglio di fine turno e per quello che chiedi, `readDiff` esegue `git diff HEAD --stat --patch --unified=2` tramite `$.process.run`, con un timeout di 5 secondi. Se il turno ha già fatto il commit di tutto e non c'è nessun diff in sospeso, legge invece l'ultimo commit (`git show HEAD`). Fuori da un repository, o senza git, è vuoto e il consiglio procede senza. Un consiglio di debug o di ritmo non legge affatto il diff: non gli serve.

La prima versione dei consigli non aveva il diff: è arrivato in `d1e6d40`, insieme alla regola contro i controlli di routine. Con il diff, il modello può nominare la funzione che è cambiata invece di indovinare dall'elenco delle chiamate agli strumenti.

### Il contesto che il modello legge

`describe(seen, kind)` trasforma tutto questo in righe di testo, con il motivo per primo. Un esempio sintetico di un contesto di fine turno, accorciato:

```text
Motivo: El turno acaba de terminar. Comenta una decisión de diseño de lo que se hizo: …
Último mensaje de la persona: añade reintentos a net.ts
Archivos editados en este turno: net.ts (2 veces), net.test.ts
Últimas herramientas usadas:
- Read: net.ts
- Edit: net.ts
- Bash: pnpm test
Duración del turno: 4 min
Respuesta final: Añadí retry() con tres intentos … Falta decidir el tiempo entre intentos.
Cambios (git):
 net.ts | 14 ++++++++++++--
 …
```

Le etichette sono in spagnolo perché il modello deve rispondere in spagnolo: l'ultimo messaggio, i file modificati, i fallimenti recenti, gli ultimi strumenti, la durata, la risposta finale e i cambiamenti. Ogni parte ha il proprio limite: 1.500 caratteri della risposta, conservati da entrambe le estremità (`ends`), dato che una risposta dice prima cosa ha fatto e alla fine cosa resta; 3.000 caratteri del diff, tagliati per righe; 6.000 per l'intero contesto. Poi `sanitize` passa su tutto (vedi sotto).

### Il prompt esatto

Il prompt di sistema è `SYSTEM` in `hooks/advice.ts`, citato qui così com'è in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). `ASKED_TIP` vale 300.

```ts
export const SYSTEM = [
  'Eres Narsil, una vieja serpiente marina sabia que acompaña a quien programa.',
  'Das UN consejo sabio y concreto sobre el trabajo en curso, el que daría alguien con experiencia que revisa el trabajo.',
  'Reglas:',
  `- Escribe en español, en dos o tres frases, como mucho ${ASKED_TIP} caracteres.`,
  '- Sigue el motivo que se te da. Cuando trate del diseño, nombra la decisión concreta (una función, un archivo, un enfoque),',
  '  la alternativa y por qué una u otra; el diff de los cambios te dice qué se hizo.',
  '- Menciona algo concreto del contexto; nada de motivación genérica ni datos inventados.',
  '- Puedes usar como mucho una metáfora del mar.',
  '- Habla como Narsil, en femenino; no nombres a ningún asistente ni a "Claude".',
  '- El femenino es solo para ti: a la persona háblale de tú con lenguaje neutro, sin suponer su género',
  '  (nada de "juntas", "juntos", "listo" o "lista"; di "contigo", "cuando quieras").',
  '- No repitas ninguno de los consejos anteriores.',
  '- Si no hay nada útil que decir, responde exactamente SKIP.',
  'Responde solo con el consejo (o SKIP), sin comillas ni prefijos.',
].join('\n')
```

In italiano: sei Narsil, un vecchio e saggio serpente marino che fa compagnia a chi programma. Dai UN consiglio saggio e concreto sul lavoro in corso, quello che darebbe una persona esperta che rivede il lavoro. Regole: scrivi in spagnolo, in due o tre frasi, al massimo 300 caratteri. Segui il motivo che ti viene dato; quando riguarda il design, nomina la decisione concreta (una funzione, un file, un approccio), l'alternativa e perché l'una o l'altra; il diff dei cambiamenti ti dice cosa è stato fatto. Menziona qualcosa di concreto del contesto; niente motivazione generica né dati inventati. Puoi usare al massimo una metafora del mare. Parla come Narsil, al femminile; non nominare nessun assistente né "Claude". Il femminile è solo per te: alla persona dai del tu con un linguaggio neutro, senza presumere il suo genere (gli esempi sono parole spagnole che portano un genere, e alternative neutre). Non ripetere nessuno dei consigli precedenti. Se non c'è niente di utile da dire, rispondi esattamente SKIP. Rispondi solo con il consiglio (o SKIP), senza virgolette né prefissi.

Il messaggio dell'utente è costruito da `prompt(context, recent)`: "Contexto del trabajo:" ("contesto del lavoro"), il contesto, poi "Consejos anteriores (no los repitas):" ("consigli precedenti, non ripeterli") con gli ultimi cinque consigli, e "Tu consejo:" ("il tuo consiglio:") per chiudere.

Il motivo che apre il contesto cambia con il tipo (`REASON` in `hooks/advice.ts`):

- **Fine turno:** "El turno acaba de terminar." ("il turno è appena finito") seguito dall'istruzione sul design: commentare una decisione di design di ciò che è stato fatto, perché, quale alternativa c'era e cosa guadagna o perde ciascuna, o come migliorare quella funzionalità. Poi "Nada de comprobaciones rutinarias (ejecutar los tests, revisar el push o el commit, mirar si el error ya no sale)." ("niente controlli di routine: eseguire i test, controllare il push o il commit, vedere se l'errore non compare più").
- **Fallimenti:** "Una herramienta ha fallado varias veces: da un consejo para depurarlo." ("uno strumento è fallito più volte: dai un consiglio per farne il debug").
- **Turno lungo:** "El turno lleva mucho tiempo: da un consejo de ritmo o de dividir la tarea." ("il turno dura da molto tempo: dai un consiglio sul ritmo o sulla suddivisione del task").

Tre scelte di design in questo prompt meritano di essere copiate. `SKIP` permette al modello di restare in silenzio, e il silenzio è meglio di un consiglio inutile. I consigli precedenti nel messaggio impediscono che lo stesso consiglio torni a ogni turno. E il divieto dei controlli di routine esiste perché, senza di esso, il consiglio più facile è sempre "esegui i test".

### Chiamare Haiku: `$.model.complete`

`askTip` lo invia:

```tsx
const reply = await $.model.complete({
  model: 'haiku',
  system: SYSTEM,
  prompt: prompt(describe(seen, kind), recentTips),
  effort: 'medium',
  maxTokens: 2000,
  timeoutMs: 30_000,
})
return reply.isAnswered ? parse(reply.text) : null
```

I tipi della 2.1.325 descrivono `$.model.complete` come un completamento di testo tramite il client API della sessione stessa: "No tools, no history, no system prompt beyond the CLI's identity block and `request.system`" (nessuno strumento, nessuna cronologia, nessun prompt di sistema oltre al blocco di identità della CLI e `request.system`). Quindi Haiku vede solo ciò che Narsil invia, niente della conversazione stessa. Il risultato dice se ha risposto (`isAnswered`); se no, una `reason` (`api-error`, `empty-reply`, `aborted`). Narsil tratta ognuna di queste, e qualsiasi eccezione, come "nessun consiglio".

`parse` pulisce la risposta: toglie le virgolette intorno e un prefisso "consejo:", trasforma qualsiasi "Claude" in "Narsil", non restituisce niente per `SKIP` o una risposta vuota, e taglia un consiglio fuori controllo oltre i 450 caratteri alla sua ultima frase completa. Il prompt ne chiede 300; il margine c'è perché il modello spesso ne scrive qualcuno in più, e quelli si mostrano per intero.

### La modalità profonda: `$.model.fork`

`/narsil consejo profundo` fa un'altra cosa. Chiama `$.model.fork({ prompt: forkPrompt(recentTips) })`, dove `forkPrompt` è lo stesso `SYSTEM` seguito da "Mira esta conversación hasta aquí y da tu consejo sobre ella." ("guarda questa conversazione fin qui e dai il tuo consiglio su di essa").

I tipi descrivono un fork come un completamento senza strumenti "over the session's OWN transcript as the main thread last sent it" (sulla trascrizione PROPRIA della sessione così come il thread principale l'ha inviata per ultima): il modello, il prompt di sistema, gli strumenti e i messaggi del thread principale, con questo prompt dopo di loro e ogni strumento negato. Il modello vede tutto, ed è proprio questo lo scopo. Quando non c'è ancora una conversazione, la reason del risultato è `nothing-to-fork`, e Narsil risponde che non c'è ancora niente da guardare.

### Quando può parlare: `mayTip`

Ogni attivazione automatica chiama `tipLater($, kind)`, e ogni tipo viene tentato al massimo una volta per turno. `mayTip` poi decide:

1. Consigli disattivati, o la modalità discreta: no.
2. Già 20 oggi: no. Il giorno viene contato come `Math.floor(now / 86_400_000)`, quindi cambia a mezzanotte UTC, non a mezzanotte locale.
3. Meno dell'intervallo dall'ultimo consiglio automatico: no. L'intervallo è `adviceEveryMinutes` (30 per impostazione predefinita), raddoppiato quando questo tipo è lo stesso dell'ultimo.
4. Altrimenti sì, e il consiglio conta, anche se il modello poi risponde `SKIP`.

`tipLater` non viene mai atteso: `void autoTip($, kind).catch(() => undefined)`. L'hook che l'ha attivato ritorna subito, quindi un modello lento non trattiene mai il turno. Il piano lo chiedeva, e chiedeva anche di non usare i timer di `$.clock`, dato che un ricaricamento della mod li annulla.

### Dove appare il consiglio

`showTip` fa lo stesso per ogni consiglio:

1. Conserva il testo tra gli ultimi cinque, per il prompt successivo.
2. Su Windows e macOS apre la finestra del consiglio. Se ha funzionato, la fascia e la finestra mobile lasciano fuori il consiglio: è già sullo schermo, per intero.
3. Altrimenti la fascia lo disegna con `tipLines`, spezzato in un massimo di tre righe (60 caratteri sul desktop, la larghezza della fascia nel terminale), con un pulsante "×". Lascia la fascia dopo 3 minuti; la finestra mobile lo tiene per 15, dato che quella finestra viene spesso guardata più tardi.
4. Scrive una riga di log, "💡" e il consiglio, con `$.ui.log`.

La finestra del consiglio non è codice della mod: `launch` avvia uno script con `$.process.run`, staccato, tramite `powershell.exe` su Windows e `/bin/sh` su macOS. Su Windows, `overlay/tip.ps1` costruisce una piccola finestra Windows Forms che si mostra senza prendere il focus, resta in primo piano, si apre sopra la finestra mobile quando questa è sullo schermo (altrimenti in un angolo dello schermo su cui si trova Claude), si chiude dopo `NARSIL_SECONDS` (180) e chiude qualsiasi consiglio più vecchio. Su macOS, `overlay/tip.sh` esegue `overlay/tip.js` con `osascript` (JavaScript for Automation): un pannello mobile che non si attiva mai, posizionato sopra la finestra mobile (chiede al server locale dove si trova) o nell'angolo dello schermo su cui si trova il mouse. Entrambe hanno un pulsante che torna alla conversazione tramite un link `claude://`, che controllano con un pattern rigoroso prima di aprirlo.

Un dettaglio in `tip.sh` conta per chiunque lo copi: "The tip and the rest travel in the environment, never inside the script, so nothing in them runs." (il consiglio e il resto viaggiano nell'ambiente, mai dentro lo script, così niente di ciò che contengono viene eseguito). Il consiglio è testo scritto da un modello. Incollarlo in una riga di comando permetterebbe a una virgoletta vagante di trasformarlo in codice.

Anche il suggerimento di `/compact` della guida 7 e il riassunto della sessione della guida 10 passano per `showTip`, anche se nessun modello li scrive.

### Costo

Ogni consiglio è una richiesta al modello sull'account della persona. I tipi dicono che un `$.model.complete` con risposta "counts toward the session's cost total" (conta nel costo totale della sessione), visibile in `/cost` con il `query_source` `plugin_model_complete`, e "Nothing caps it per call" (niente lo limita per chiamata). Il limite è quello di Narsil: uno ogni 30 minuti e 20 al giorno, il che limita i consigli automatici a un massimo di venti piccole chiamate a Haiku al giorno. I consigli che chiedi non vengono contati in questo limite. I prossimi passi della guida successiva aggiungono al massimo un'altra chiamata per ogni turno finito.

La modalità profonda è di un altro genere. Esegue il modello principale sull'intera trascrizione. I tipi spiegano che la trascrizione viene servita dalla cache del prompt finché è calda, e "billed afresh once the entry lapsed" (addebitata di nuovo una volta scaduta la voce): l'orologio della cache della guida 8 ti dice in quale caso ti trovi. Per questo viene eseguita solo quando la chiedi.

### Privacy

Il contesto va allo stesso fornitore che la sessione usa già, tramite il client della sessione stessa. Tuttavia, è il tuo codice: il tuo ultimo messaggio, i nomi dei file, il testo degli errori, la risposta di Claude e fino a 3.000 caratteri del diff.

`sanitize` passa sull'intero contesto prima che venga inviato. Sostituisce con "[oculto]" ("nascosto") qualsiasi `name=value` o `name: value` il cui nome contenga key, token, secret o password, e qualsiasi sequenza di 32 o più caratteri base64 o esadecimali. È un'euristica: un segreto in un'altra forma passa. Se un repository non deve essere riassunto a nessun modello oltre alla conversazione principale, disattiva i consigli e i prossimi passi (`/narsil consejos off`, `/narsil pasos off`).

### Piano e codice

`docs/plan-advice.md` dice "Status: implemented" (stato: implementato), e lo è in gran parte. Alcuni numeri sono cambiati in seguito, e ciò che viene eseguito è il codice:

| Piano                                                            | Codice oggi                                                                 |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------- |
| al massimo 160 caratteri, una o due frasi                        | 300, due o tre frasi (`69647da`, `d1e6d40`)                                 |
| `effort: 'low'`, `maxTokens` ~120, `timeoutMs` ~8000             | `medium`, 2000, 30.000 (`d1e6d40`)                                          |
| contesto limitato a ~2.000 caratteri, i primi 400 della risposta | 6.000, risposta 1.500 da entrambe le estremità, più il diff (`d1e6d40`)     |
| un consiglio automatico ogni 10 minuti                           | ogni 30 (`1216dc4`)                                                         |
| una riga nella fascia, tagliata alla fine                        | fino a tre righe (`c564ab5`), o una finestra propria (`c98adac`, `a95e96a`) |
| consiglio di fine turno: cosa controllare o fare dopo            | una decisione di design, niente controlli di routine (`d1e6d40`)            |

Anche il pattern di sanificazione del piano è più ristretto di quello del codice.

## Costruiscila con Claude

Chiedi a Claude un unico consiglio breve da un modello piccolo quando un turno finisce, costruito da un contesto che scegli campo per campo. L'unica idea che Claude deve fare bene è che il consiglio arriva a cose fatte: l'hook lo avvia senza aspettarlo, e la mod stessa limita quanto spesso viene eseguito.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nella mia mod di Claude Code `my-pet`, dai un breve consiglio sul lavoro quando un turno finisce. Tieni un piccolo contesto in variabili di modulo: l'ultimo prompt da `prompt.submit`, le ultime 15 chiamate agli strumenti e i file modificati da `tool.call`, e la risposta finale da `turn.complete`. Quando un turno della conversazione principale finisce con `reason === 'answer'`, senza attenderlo, leggi `git diff HEAD --stat --patch` con `$.process.run` (timeout di 5 s), costruisci un contesto di al massimo 6.000 caratteri, rimuovi tutto ciò che sembra un segreto, e chiama `$.model.complete` con `model: 'haiku'`, un prompt di sistema che chieda un consiglio concreto di al massimo 300 caratteri su una decisione di design nel diff, niente controlli di routine, e la risposta esatta `SKIP` quando non c'è niente di utile. Passa gli ultimi cinque consigli e chiedi di non ripeterli. Permetti al massimo un consiglio ogni 30 minuti e 20 al giorno. Mostra il consiglio nella fascia `AbovePrompt` con un pulsante "×" per 3 minuti. Testa con `on('model.complete', ...)` simulando il modello: il prompt contiene il nome del file modificato, `SKIP` non mostra niente, e un valore `API_KEY=` non arriva mai al prompt.

### Cosa controllare nella risposta di Claude

1. L'hook `turn.complete` avvia il consiglio con `void … .catch(...)` e ritorna subito; non attende mai `$.model.complete`.
2. Il prompt di sistema ammette la risposta esatta `SKIP`, e un `SKIP` o una risposta vuota non mostrano nulla.
3. Ogni parte del contesto ha un limite (3.000 caratteri di diff, 6.000 in tutto), e l'intero contesto viene ripulito prima di essere inviato, così un valore `API_KEY=` non arriva mai al prompt.
4. La mod controlla il proprio intervallo e il proprio tetto giornaliero (un consiglio ogni 30 minuti, 20 al giorno) prima di chiamare il modello. Il motore non ne aggiunge nessuno.
5. Gli ultimi cinque consigli entrano nel prompt, con la richiesta di non ripeterli.

Se un controllo fallisce, di' a Claude cosa vedi: "ogni turno ora finisce qualche secondo dopo, e non posso scrivere finché non arriva il consiglio".

### Come l'ha chiesta l'autore

I consigli sono l'unica funzionalità di Narsil pianificata in un documento pubblico prima che il codice fosse scritto: `docs/plan-advice.md`, aggiunto in `dd7027a` (2026-10-30) "docs: plan tips about the work in progress" (pianifica consigli sul lavoro in corso). È un piano, non le parole dell'autore; la richiesta che ha portato a esso non è stata registrata.

#### Cosa dice il piano

L'obiettivo del piano:

> "Narsil, the mod's sea-serpent mascot, occasionally offers a short, wise, concrete tip about the work in progress: what Claude just did, the error it hit, the change it made."

In italiano: Narsil, la mascotte della mod a forma di serpente marino, offre di tanto in tanto un consiglio breve, saggio e concreto sul lavoro in corso: ciò che Claude ha appena fatto, l'errore in cui si è imbattuto, il cambiamento che ha fatto.

E la sua scelta tra i due modi di interrogare un modello, dopo una tabella che li confronta:

> "Recommendation: automatic tips through `complete` with `haiku`; the transcript-aware `fork` only when the person asks for it."

In italiano: raccomandazione: consigli automatici tramite `complete` con `haiku`; il `fork` che conosce la trascrizione solo quando la persona lo chiede.

Quella raccomandazione è ciò che il codice fa oggi.

#### Registrato: i consigli restano come sono

Quando l'autore ha ridisegnato la fascia per ogni conversazione, la richiesta in `odd/tasks/fleet-view.md`, L1 (2026-11-06), finiva con:

> "los consejos seguirian funcionando como ahora en cada ventana"

In italiano: i consigli continuerebbero a funzionare come adesso in ogni finestra. Il log dei task lo registra come S10, "Tips unchanged" (consigli invariati), e il design concordato in L4 mette "the tip and next steps of this window below" (il consiglio e i prossimi passi di questa finestra sotto) l'elenco.

#### Ricostruzione dalla cronologia dei commit

Da `git log -- hooks/advice.ts docs/plan-advice.md overlay/tip.js overlay/tip.ps1 overlay/tip.sh`, con i commit correlati a `hooks/register.tsx`:

- `dd7027a` (2026-10-30) "docs: plan tips about the work in progress" (pianifica consigli sul lavoro in corso).
- `467a64b` (2026-10-30) "feat(advice): give short, concrete tips about the work in progress" (dà consigli brevi e concreti sul lavoro in corso). La prima versione, che segue il piano.
- `e379f0e` (2026-10-30) "feat(advice): keep the tip in the floating window for 15 minutes" (tiene il consiglio nella finestra mobile per 15 minuti).
- `c564ab5` (2026-10-30) "fix(band): break long tips into short lines" (spezza i consigli lunghi in righe brevi).
- `71383d6` (2026-10-30) "fix(texts): agree state counts in number and keep advice gender-neutral toward the person" (accorda i conteggi degli stati nel numero e mantiene i consigli neutri nel genere verso la persona). La regola nel prompt sul femminile che appartiene solo a Narsil.
- `c98adac` (2026-10-31) "feat: open tips whole in their own window on Windows and give the band more room" (apre i consigli per intero in una finestra propria su Windows e dà più spazio alla fascia), poi `a95e96a` (2026-10-31) "feat: open tips whole in their own window on macOS too" (apre i consigli per intero in una finestra propria anche su macOS).
- `69647da` (2026-11-01) "fix: show tips whole up to 320 characters, cutting a runaway one at its last sentence" (mostra i consigli per intero fino a 320 caratteri, tagliando uno fuori controllo alla sua ultima frase).
- `d1e6d40` (2026-11-04) "feat: make tips weigh design choices from the diff and next steps say what the project lacks" (fa sì che i consigli valutino le scelte di design dal diff e che i prossimi passi dicano cosa manca al progetto). La correzione più grande: il suo messaggio dice che il consiglio di fine turno "now reads the uncommitted diff (or the last commit) and comments on a design decision, an alternative and its tradeoff, instead of routine checks" (ora legge il diff senza commit, o l'ultimo commit, e commenta una decisione di design, un'alternativa e il suo compromesso, invece dei controlli di routine), con Haiku a sforzo medio e limiti più lunghi.
- `1216dc4` (2026-11-04) "feat: space automatic tips to one every 30 minutes by default" (distanzia i consigli automatici a uno ogni 30 minuti per impostazione predefinita). Le preferenze salvate che avevano ancora il vecchio valore predefinito di 10 passano a 30 una volta.

Lo schema: un piano, una prima versione fedele, poi correzioni ogni volta che i consigli si sono rivelati troppo brevi, troppo frequenti o troppo generici.

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida. Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

Scritto per questa guida e verificato con i tipi della 2.1.325 (`$.model.complete`, `$.process.run`, `$.clock.now`, `$.ui.log`, `prompt.submit`, `turn.complete`, `ui.render`). È adattato da `hooks/advice.ts` e `hooks/register.tsx` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). L'atom `tip` è dichiarato in `types/index.d.ts` come nella prima guida, con il tipo `{ text: string; at: number } | null`.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const tip = atom({ plugin: 'my-pet', key: 'tip' } as const, null)
const SYSTEM = [
  'You give ONE concrete tip, at most 300 characters, about the work in progress.',
  'Comment on one design decision visible in the diff: the alternative and its tradeoff.',
  'No routine checks (running the tests, checking the push). Nothing invented.',
  'If there is nothing useful to say, answer exactly SKIP.',
].join('\n')
const EVERY_MS = 30 * 60_000
const SHOWN_MS = 3 * 60_000

let lastPrompt = ''
let lastTipAt: number | null = null
const recent: string[] = []

const sanitize = (text: string) =>
  text
    .replace(
      /[^\s"'`]*(key|token|secret|password)[^\s"'`]*\s*[:=]\s*("[^"]*"|'[^']*'|\S+)/gi,
      '[hidden]',
    )
    .replace(/[A-Za-z0-9+/_-]{32,}={0,2}/g, '[hidden]')

async function diff($: EngineInterface): Promise<string> {
  try {
    const r = await $.process.run(['git', '--no-pager', 'diff', 'HEAD', '--stat', '--patch'], {
      timeoutMs: 5000,
    })
    return r.exitCode === 0 ? r.stdout.slice(0, 3000) : ''
  } catch {
    return ''
  }
}

async function autoTip($: EngineInterface, answer: string): Promise<void> {
  const now = await $.clock.now()
  if (lastTipAt !== null && now - lastTipAt < EVERY_MS) return
  lastTipAt = now
  const context = sanitize(
    `Last message: ${lastPrompt}\nFinal answer: ${answer.slice(0, 1500)}\nChanges:\n${await diff($)}`,
  ).slice(0, 6000)
  const before = recent.length
    ? `\n\nEarlier tips (do not repeat):\n${recent.map((t) => `- ${t}`).join('\n')}`
    : ''
  const reply = await $.model.complete({
    model: 'haiku',
    system: SYSTEM,
    prompt: `Context:\n${context}${before}\n\nYour tip:`,
    effort: 'medium',
    timeoutMs: 30_000,
  })
  if (!reply.isAnswered) return
  const text = reply.text.trim()
  if (!text || /^skip\b/i.test(text)) return
  recent.push(text)
  if (recent.length > 5) recent.shift()
  await update($, tip, () => ({ text, at: now }))
  $.ui.log(`💡 ${text}`)
}

export const register: Register = (on) => {
  on('prompt.submit', async ($, e, next) => {
    if (!e.isMeta) lastPrompt = e.text.slice(0, 400)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    // Never awaited: the tip must not slow the turn.
    if (e.agentId === undefined && e.reason === 'answer')
      void autoTip($, e.answer).catch(() => undefined)
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const shown = await read($, tip)
    if (!shown || (await $.clock.now()) - shown.at > SHOWN_MS) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" gap={1} minWidth={0}>
        <Text wrap="truncate-end">{`💡 ${shown.text}`}</Text>
        <Button key="tip-dismiss" label="×" onPress={() => update($, tip, () => null)} />
      </Box>
    )
  })
}
```

Qui la fascia controlla l'età del consiglio quando disegna. Narsil invece segna il consiglio come sbiadito nel suo battito, così la fascia si ridisegna quando i tre minuti sono finiti e non solo al render successivo.

## Errori comuni e come testarlo

- **Attendere il modello nell'hook.** Un hook `turn.complete` che attende un completamento trattiene la fine del turno per tutto il tempo che il modello impiega. Avvialo e ritorna.
- **Nessun modo di restare in silenzio.** Senza `SKIP`, il modello trova sempre qualcosa da dire, e la maggior parte è riempitivo.
- **Inviare per errore la conversazione a un modello economico.** `$.model.complete` invia solo ciò che ci metti dentro. Decidi campo per campo cosa esce, limita ciascuno, e sanifica il tutto.
- **Eseguire come codice il testo del modello.** Le finestre dei consigli ricevono il testo tramite l'ambiente, mai dentro uno script o una riga di comando.
- **Nessun limite di frequenza.** Ogni consiglio è una richiesta addebitata. Metti nella mod un intervallo minimo e un limite giornaliero; niente nel motore ne aggiunge uno.
- **Fidarsi del piano più che del codice.** Se copi da `docs/plan-advice.md`, controlla i numeri con `hooks/advice.ts`: diversi sono cambiati.

Per testare, `claude plugin test .` esegue `tests/narsil.test.tsx`, che risponde al modello con `on('model.complete', ...)` e `on('model.fork', ...)`, così non viene fatta nessuna richiesta reale. Test che vale la pena leggere: "a finished turn's tip weighs a design choice of the turn, from its diff, with Haiku at medium effort" (il consiglio di un turno finito valuta una scelta di design del turno, dal suo diff, con Haiku a sforzo medio), "SKIP or an empty reply shows nothing" (SKIP o una risposta vuota non mostrano niente), "with the default, a second tip waits 30 minutes" (con il valore predefinito, un secondo consiglio aspetta 30 minuti), "two failures of the same tool give one debugging tip" (due fallimenti dello stesso strumento danno un consiglio di debug), "/narsil consejo profundo asks over the conversation itself" (/narsil consejo profundo chiede sulla conversazione stessa), "a secret never reaches the prompt sent to the model" (un segreto non arriva mai al prompt inviato al modello) e "a failed, timed-out or rejected model call shows nothing and breaks nothing" (una chiamata al modello fallita, scaduta o rifiutata non mostra niente e non rompe niente). Le finestre dei consigli hanno i loro: "on Windows a tip opens whole in its own window, and leaves the band and the floating window free" (su Windows un consiglio si apre per intero in una finestra propria, e lascia libere la fascia e la finestra mobile) e "on macOS a tip opens whole in its own window too, through tip.sh, detached" (anche su macOS un consiglio si apre per intero in una finestra propria, tramite tip.sh, staccato).

## Per andare oltre

- `adviceCommand` in `hooks/register.tsx` gestisce ogni comando `/narsil consejo…`; `setAdvice` salva le preferenze con `$.store`.
- La migrazione del valore predefinito salvato da 10 a 30 minuti (`ADVICE_MIGRATED_KEY`) sposta un vecchio 10 una volta e mantiene un 10 scelto in seguito.
- `lines` in `hooks/advice.ts` spezza un consiglio in righe e taglia una parola più lunga di una riga, come un percorso o un URL.
- La guida successiva riutilizza lo stesso contesto, lo stesso `describe` e la stessa chiamata al modello per proporre i prossimi passi.
