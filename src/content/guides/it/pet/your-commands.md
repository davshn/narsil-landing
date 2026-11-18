---
title: I tuoi /comandi
description: 'Come /narsil viene registrato come un solo comando slash con molti sottocomandi, come vengono smistate le sue parole, come il comando da solo fa anche da aiuto, e come testarlo.'
route: pet
order: 17
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: docs/plan-advice.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Cosa fa

Ogni funzionalità di questo percorso ha un interruttore o una domanda, e tutti vivono sotto un solo comando slash: `/narsil`. Scrivi `/narsil` e una parola, e Narsil risponde nella trascrizione. Scritto da solo, `/narsil` ti dice come è configurata ed elenca ogni parola che accetta.

Le parole, così come il codice le smista (Narsil parla spagnolo, quindi le parole sono in spagnolo):

| Comando                                                             | Cosa fa                                                                                |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `/narsil`                                                           | Mostra le impostazioni attuali e la riga d'uso.                                        |
| `/narsil estado`                                                    | Dice cosa sta facendo, quante conversazioni sono aperte, e su quali superfici disegna. |
| `/narsil ocultar` · `mostrar`                                       | Nasconde o mostra la fascia.                                                           |
| `/narsil silencio` · `voz`                                          | Spegne o accende la voce.                                                              |
| `/narsil discreto` · `normal`                                       | Attiva o disattiva la modalità discreta (guida 14).                                    |
| `/narsil flotante`                                                  | Attiva o disattiva la finestra mobile (guida 5).                                       |
| `/narsil prueba`                                                    | Invia un avviso di prova, con la voce.                                                 |
| `/narsil consejo` · `consejo profundo`                              | Chiede un consiglio subito, o uno sull'intera conversazione (guida 11).                |
| `/narsil consejos on` · `off` · `cada <min>` · `voz`                | Consigli automatici attivi o no, la loro spaziatura, detti a voce o no.                |
| `/narsil pasos on` · `off`                                          | Prossimi passi attivi o no (guida 12).                                                 |
| `/narsil cache` · `cache <min>` · `cache auto`                      | Dice, imposta o deduce quanto dura la cache del prompt (guida 8).                      |
| `/narsil resumen`                                                   | Il riassunto della sessione (guida 16).                                                |
| `/narsil nivel`                                                     | Livello, stadio e come guadagna XP (guida 13).                                         |
| `/narsil movil` · `on` · `off` · `nuevo` · `prueba` · `clave [off]` | Avvisi sul telefono (guida 15).                                                        |

La tabella "Comandos" ("comandi") del README elenca le stesse parole, e concordano con il codice.

Un comando invece di quindici mantiene pulito il completamento automatico: scrivi `/nar`, e tutto ciò che Narsil sa fare sta dietro un solo nome.

## Come funziona dentro

### Registrare: `$.command.register`

Una mod dichiara un comando slash durante l'esecuzione. Narsil lo fa come prima cosa in `session.start`:

```tsx
await $.command.register({
  name: 'narsil',
  description:
    'Narsil, tu mascota: estado | ocultar | mostrar | silencio | voz | discreto | normal | flotante | prueba | consejo [profundo] | consejos on|off|cada <min>|voz | pasos on|off | cache [auto|<min>] | resumen | nivel | movil [on|off|nuevo|prueba|clave [off]]',
})
```

I tipi della 2.1.325 descrivono `$.command.register` come "Declares the slash command `/<name>` for this session, listed in the typeahead from the next keystroke on" (dichiara il comando slash `/<name>` per questa sessione, elencato nel completamento automatico dal tasto successivo in poi). Tre punti di quella frase danno forma al design:

- **"for this session" (per questa sessione).** La registrazione non sopravvive alla sessione, ed è per questo che avviene a ogni `session.start`.
- **La specifica.** `CommandSpec` ha `name` (lettere, cifre, `_` e `-`, fino a 64), `description` ("The one line the typeahead and `/help` show for it", l'unica riga che il completamento automatico e `/help` mostrano per esso), un `argumentHint` opzionale ("The hint drawn dim after the name", il suggerimento disegnato attenuato dopo il nome) e un `immediate` opzionale. "Registering a name again replaces it; a built-in's name is refused." (registrare di nuovo un nome lo sostituisce; il nome di un comando integrato viene rifiutato.)
- **Servirlo.** "Serve it with a `command.run` hook on `{ command: "<name>" }` that returns `{ text }`" (servilo con un hook `command.run` su `{ command: "<name>" }` che restituisce `{ text }`).

Narsil mette l'elenco delle parole in `description`, così il completamento automatico e `/help` le mostrano tutte (la descrizione inizia con "Narsil, tu mascota", "Narsil, la tua mascotte"). Non usa `argumentHint`; un suggerimento breve come `[estado | resumen | …]` sarebbe l'alternativa, al prezzo di mostrare meno.

Non imposta nemmeno `immediate`. Senza di esso, dicono i tipi, un comando scritto mentre un turno è in corso aspetta "for the turn to end" (che il turno finisca). `/narsil discreto` scritto a metà turno ha quindi effetto dopo il turno. Con `immediate`, l'hook "must not assume the turn's state" (non deve presumere lo stato del turno), il che è molto da chiedere a un gestore che ne legge e scrive così tanto.

### Servire: un solo hook `command.run`

L'hook è registrato con un matcher, quindi gira solo per `/narsil`:

```tsx
on('command.run', { command: 'narsil' }, async ($, e) => {
  await noteOrigin($, e.origin)
  const arg = e.args.trim().toLowerCase().replace(/\s+/g, ' ')
  // …
})
```

Non chiama mai `next`. I tipi spiegano cosa significa: "A hook's own answer without `next` runs no command: its `text` is shown as the command's output" (la risposta propria di un hook senza `next` non esegue nessun comando: il suo `text` viene mostrato come output del comando). Dato che nient'altro implementa `/narsil`, non c'è niente a cui passare il controllo.

Prima che venga letta qualsiasi parola succedono tre cose:

- **`noteOrigin($, e.origin)`.** L'`origin` di un comando dice da dove è arrivato, come quello di `prompt.submit`. Eseguire `/narsil` dal telefono conta come scrivere da fuori (guida 15).
- **Normalizzare le parole.** `e.args` è "Everything after the name, as typed" (tutto ciò che segue il nome, così come è stato scritto). Narsil lo ripulisce dagli spazi ai bordi, lo mette in minuscolo e comprime le sequenze di spazi, così `/narsil  Consejos   OFF` funziona.
- **Gli accenti.** Il gruppo del telefono accetta `movil` e `móvil`, e il pattern della cache, `/^cach[eé](?: (auto|\d{1,3}))?$/`, accetta `cache` e `caché`. Le persone scrivono entrambe le forme.

### Smistare: gruppi che rispondono "non è mio"

Il corpo è una catena. I tre gruppi più grandi vivono ciascuno accanto alla propria funzionalità, come funzioni che restituiscono il testo della risposta, o `undefined` per le parole che non sono loro:

```tsx
const advice = await adviceCommand($, arg)
if (advice !== undefined) return { text: advice }
const stepped = await stepsCommand($, arg)
if (stepped !== undefined) return { text: stepped }
const phoned = await phoneCommand($, arg)
if (phoned !== undefined) return { text: phoned }
```

- `adviceCommand` accetta `consejo`, `consejo profundo` e `consejos …`.
- `stepsCommand` accetta `pasos on|off` e `cache [auto|<min>]`.
- `phoneCommand` accetta `movil …`.

Un gruppo che riconosce la sua prima parola ma non il resto risponde con la propria riga d'uso invece che con `undefined`: `/narsil consejo raro` riceve "Uso: /narsil consejo [profundo] | consejos on | off | cada <min> | voz", e `/narsil movil raro` riceve "Uso: /narsil movil [on | off | nuevo | prueba | clave [off]]". La persona vede le parole adatte a ciò che stava cercando di fare, non l'intero elenco.

Poi il gestore principale si occupa del resto da sé: `resumen` e `nivel` rispondono subito; `prueba`, `estado` e `flotante` hanno ciascuno un ramo; e sei parole on/off condividono una tabella, `change`, che associa ogni parola a una modifica delle preferenze (`ocultar` a `{ isHidden: true }`, `discreto` a `{ isQuiet: true }`, e così via). Una parola nota viene fusa nell'atom `prefs` e salvata con `$.store.set('prefs', …)`, così ogni impostazione sopravvive alla sessione.

Il design tiene le parole di ogni funzionalità con la funzionalità. Aggiungere un gruppo di comandi a una funzionalità significa una funzione nella sua sezione e una riga nella catena.

### Il comando da solo è l'aiuto

Tutto ciò che la catena non riconosce, compreso `/narsil` vuoto, cade alla fine, dove `patch` è undefined. Quel ramo legge le preferenze e le stampa: se la fascia è visibile, la voce accesa, la finestra mobile attiva; i consigli e la loro spaziatura; i prossimi passi e quanto dura la cache; una riga per la modalità discreta quando è attiva. L'ultima riga è la riga d'uso, lo stesso elenco di parole della descrizione.

Quindi non esiste una parola `ayuda` ("aiuto") separata: un errore di battitura e un semplice `/narsil` rispondono entrambi con lo stato e le parole. Questo corrisponde al README, la cui prima riga dice che `/narsil` "Muestra la configuración actual y la ayuda" ("mostra le impostazioni attuali e l'aiuto").

L'elenco delle parole vive in tre posti: la descrizione, la riga d'uso e il README. Il piano dei consigli, `docs/plan-advice.md`, lo dice apertamente quando aggiunge le parole `consejo`: "Update the command description and the usage text of `/narsil`." (aggiorna la descrizione del comando e il testo d'uso di `/narsil`.) Tenere allineati i tre è un compito manuale in Narsil.

### Cos'è la risposta

Ogni ramo restituisce `{ text }`, un `CommandRunResult`. Due dei suoi campi meritano di essere conosciuti anche se Narsil non li usa. `context` è "What the model reads after the command's output and the person never sees" (ciò che il modello legge dopo l'output del comando e che la persona non vede mai). `isTextDisplayOnly` tiene il testo fuori dalle richieste al modello, ma i tipi dicono che viene rispettato solo quando ogni plugin che aggancia il comando è incluso in Claude Code: "Any other plugin's text stays in requests" (il testo di qualsiasi altro plugin resta nelle richieste). Quindi tutto ciò che `/narsil` risponde, compresa la chiave del telefono della guida 15, fa parte di ciò che il modello legge.

## Costruiscila con Claude

Chiedi a Claude un unico comando slash con sottocomandi, registrato quando inizia la sessione e servito da un solo hook. L'unica idea che Claude deve fare bene è lo smistamento: ogni funzionalità risponde alle proprie parole e restituisce `undefined` per il resto, e tutto ciò che avanza stampa le impostazioni e la riga d'uso.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Dai alla mia mod di Claude Code `my-pet` un solo comando slash, `/my-pet`, con sottocomandi. In `session.start`, chiama `$.command.register` con il nome e una descrizione che elenchi ogni sottocomando. Servilo con un solo hook `command.run` con matcher su `{ command: 'my-pet' }` che restituisca `{ text }` senza chiamare `next`. Normalizza `e.args` (spazi ai bordi rimossi, minuscolo, spazi singoli). Dai a ogni funzionalità la propria funzione che restituisca la risposta per le sue parole, la propria riga d'uso per una prima parola nota con un resto sconosciuto, o `undefined` per le parole che non sono sue, e concatenale. Associa le parole on/off semplici a una modifica di un atom `prefs` salvato con `$.store.set`. Per un argomento vuoto o sconosciuto, stampa le impostazioni attuali e la riga d'uso. Tieni allineati la descrizione, la riga d'uso e il README. Testa con `claude-code/testing`, chiamando `$.command.run({ command: 'my-pet', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } })`, che ogni parola risponda e che una parola sconosciuta stampi la riga d'uso.

### Cosa controllare nella risposta di Claude

1. `$.command.register` viene eseguito in `session.start`, in ogni sessione, perché una registrazione dura solo per la sessione.
2. L'hook `command.run` riconosce il comando dal suo nome, restituisce `{ text }` e non chiama mai `next`.
3. A `e.args` vengono tolti gli spazi ai bordi, viene messo in minuscolo e le sue sequenze di spazi vengono ridotte a uno prima di confrontare qualsiasi parola.
4. La funzione di ogni funzionalità restituisce la sua risposta, la propria riga d'uso per una prima parola nota seguita da un resto sconosciuto, oppure `undefined`; un argomento vuoto o sconosciuto stampa le impostazioni e la riga d'uso.
5. La descrizione e la riga d'uso elencano le stesse parole, idealmente da un'unica costante.

Se un controllo fallisce, di' a Claude cosa vedi: "`/my-pet  Tips OFF`, con spazi in più e maiuscole, risponde con la riga d'uso invece di disattivare i consigli".

### Come l'ha chiesta l'autore

La richiesta originale per `/narsil` non è stata registrata. Ciò che è registrato è un passo del piano: in `docs/plan-advice.md`, tra i comandi che aggiungono i consigli, il piano dice:

> "Update the command description and the usage text of `/narsil`."

In italiano: aggiorna la descrizione del comando e il testo d'uso di `/narsil`.

Questa è la formulazione del piano, non la richiesta dell'autore.

#### Ricostruzione dalla cronologia dei commit

Da `git log -G "Narsil, tu mascota" -- hooks/register.tsx`, che trova ogni commit che ha cambiato la descrizione registrata:

- `b1187f3` (2026-10-30) "feat: show Narsil above the prompt with clear states and /narsil" (mostra Narsil sopra il prompt con stati chiari e /narsil). Il comando nasce con la fascia, e la sua prima descrizione dice "Narsil, tu mascota: estado | ocultar | mostrar | silencio | voz | flotante | prueba".
- `467a64b` (2026-10-30) "feat(advice): give short, concrete tips about the work in progress" (dà consigli brevi e concreti sul lavoro in corso). Le parole `consejo`.
- `0993bd7` (2026-10-30) "feat: show a prompt-cache clock and offer next steps after a turn" (mostra un orologio della cache del prompt e offre i prossimi passi dopo un turno). `pasos` e `cache`.
- `f7a494e` (2026-10-30) "feat: warn about loops, insist on waiting permissions and sum the session up" (avvisa dei cicli, insiste sui permessi in attesa e riassume la sessione). `resumen`.
- `8913cdd` (2026-10-30) "feat: let Narsil earn experience and levels kept across sessions" (fa guadagnare a Narsil esperienza e livelli conservati tra le sessioni). `nivel`.
- `17ffb30` (2026-10-31) "feat: add a quiet mode that only speaks up when Narsil needs you" (aggiunge una modalità discreta che si fa sentire solo quando Narsil ha bisogno di te). `discreto` e `normal`.
- `d91997f` (2026-10-31) "feat: send what needs you to your phone and watch through ntfy, with Narsil's picture" (invia ciò che ha bisogno di te al telefono e all'orologio tramite ntfy, con l'immagine di Narsil). `movil`.
- `5a9ee10` (2026-11-01) "feat: seal phone messages with /narsil movil clave, send reset times and an Abrir Claude button" (sigilla i messaggi al telefono con /narsil movil clave, invia gli orari di azzeramento e un pulsante Abrir Claude). `clave`.

Il comando è cresciuto una parola alla volta, ciascuna con la funzionalità che controlla, e ogni commit ha toccato la descrizione nella stessa modifica. È l'abitudine che il piano chiede.

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida. Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

Scritto per questa guida e verificato con i tipi della 2.1.325 (`$.command.register`, `command.run`, `$.store.get`, `$.store.set`, `session.start`). È adattato da `hooks/register.tsx` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). L'atom `prefs` è dichiarato in `types/index.d.ts` come `{ isHidden: boolean; isMuted: boolean }`.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const WORDS = 'status | hide | show | mute | voice | tips on|off'
const prefs = atom({ plugin: 'my-pet', key: 'prefs' } as const, { isHidden: false, isMuted: false })

// One feature's words: its answer, its own usage line, or undefined when the words are not its own.
async function tipsCommand($: EngineInterface, arg: string): Promise<string | undefined> {
  if (arg === 'tips on' || arg === 'tips off')
    return `My pet: tips ${arg === 'tips on' ? 'on' : 'off'}.`
  if (arg.startsWith('tips')) return 'Usage: /my-pet tips on | off'
  return undefined
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    // Registered for this session only: every session registers it again.
    await $.command.register({ name: 'my-pet', description: `My pet: ${WORDS}` })
    const saved = await $.store.get('prefs').catch(() => undefined)
    if (saved && typeof saved === 'object') await update($, prefs, (p) => ({ ...p, ...saved }))
    return next(e)
  })

  on('command.run', { command: 'my-pet' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase().replace(/\s+/g, ' ')
    const tips = await tipsCommand($, arg)
    if (tips !== undefined) return { text: tips }

    const change: Record<string, { isHidden?: boolean; isMuted?: boolean }> = {
      hide: { isHidden: true },
      show: { isHidden: false },
      mute: { isMuted: true },
      voice: { isMuted: false },
    }
    const patch = arg === 'status' ? undefined : change[arg]
    if (!patch) {
      // The bare command, a typo and "status" all answer with the state and the words.
      const p = await read($, prefs)
      return {
        text: `My pet is ${p.isHidden ? 'hidden' : 'visible'}, with the voice ${p.isMuted ? 'off' : 'on'}.\nUsage: /my-pet ${WORDS}`,
      }
    }
    const saved = await update($, prefs, (p) => ({ ...p, ...patch }))
    await $.store.set('prefs', saved).catch(() => undefined)
    return { text: `My pet: done (${arg}).` }
  })
}
```

`WORDS` viene scritto una volta e usato sia per la descrizione sia per la riga d'uso, il che elimina uno dei tre posti che Narsil tiene allineati a mano. Il README resta da aggiornare a te.

## Errori comuni e come testarlo

- **Registrare una volta sola.** Una registrazione dura per la sessione. Registra in `session.start`, ogni volta.
- **Un nome già preso.** "a built-in's name is refused" (il nome di un comando integrato viene rifiutato). Scegli un nome che sia chiaramente della tua mod.
- **Chiamare `next` dal tuo comando.** Dietro il tuo non c'è nessun comando da eseguire; rispondi con `{ text }`.
- **Confronto esatto sull'input grezzo.** Le persone scrivono spazi in più, maiuscole e accenti. Normalizza prima, e accetta le forme accentate che ti aspetti.
- **Un'unica gigantesca catena di `if`.** Funziona, ma le parole di ogni funzionalità finiscono lontano dalla funzionalità. Lascia che ogni funzionalità possieda le sue parole e restituisca `undefined` per il resto.
- **Un aiuto che si disallinea.** La descrizione, la riga d'uso e il README devono dire la stessa cosa. Costruisci le prime due da una sola costante, se puoi.
- **Segreti nelle risposte.** Il testo di un comando resta nelle richieste al modello. Stampa un segreto solo quando la persona deve copiarlo, e dillo.

Per testare, `claude plugin test .` esegue `tests/narsil.test.tsx`, dove i comandi girano tramite `$.command.run({ command: 'narsil', args: 'nivel', ...TYPED })`. `TYPED` è `{ origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } }`: un comando scritto alla scrivania. `BY_PHONE` sostituisce l'origine con `{ kind: 'bridge' }` per eseguirne uno da Remote Control. Test che vale la pena leggere per nome: "/narsil estado tells which surfaces asked to draw the band, and which never did" (/narsil estado dice quali superfici hanno chiesto di disegnare la fascia, e quali non l'hanno mai fatto), "/narsil discreto keeps her quiet, and /narsil normal brings everything back" (/narsil discreto la tiene in silenzio, e /narsil normal riporta tutto), "/narsil consejos off stops automatic tips, and /narsil consejo still answers" (/narsil consejos off ferma i consigli automatici, e /narsil consejo risponde ancora) e "/narsil movil nuevo changes the topic, and /narsil movil prueba sends one" (/narsil movil nuevo cambia il topic, e /narsil movil prueba ne invia uno).

### Dove il codice e il README differiscono

Concordano su ogni parola. Una piccola svista è nel codice: la riga d'uso del ramo di ripiego è scritta `'Uso:/narsil estado | …'`, senza lo spazio dopo i due punti che hanno le righe d'uso dei sottogruppi. Risale a `17ffb30`; prima di esso la riga diceva `'Uso: /narsil …'`.

## Per andare oltre

- `phoneCommand` in `hooks/register.tsx` è il più chiaro dei gruppi da copiare: separa la prima parola dal resto, salva tramite un piccolo helper `save`, e finisce con la propria riga d'uso.
- `stepsCommand` mostra una parola con un numero opzionale, analizzato con una sola espressione regolare e limitato (`Math.min(1440, Math.max(1, …))`).
- `$.command.list()` restituisce ogni comando slash che la persona può eseguire, e `$.command.run` ne esegue uno come se fosse scritto; entrambi sono nei tipi della 2.1.325.

Questa è l'ultima guida del percorso "La tua mascotte di stato". Il suo indice elenca tutte e diciassette le guide, dagli stati a colpo d'occhio a questi comandi, se vuoi tornare a una qualsiasi funzionalità. Per le basi su cui poggia ogni guida, le guide "Basi delle mod" trattano di cosa è fatta una mod, l'oggetto `$`, come installare, ricaricare, validare e testare una mod, le superfici su cui gira, e cosa significa la GPL v3 di Narsil quando ne riutilizzi il codice.
