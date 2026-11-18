---
title: Voce e avvisi
description: 'Come Narsil sceglie una frase a caso per ogni momento, la pronuncia ad alta voce con le voci di Windows o di macOS e ti avvisa tramite la finestra mobile o una notifica di sistema.'
route: pet
order: 6
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: overlay/speak.ps1
  - repo: pet
    path: overlay/speak.sh
  - repo: pet
    path: overlay/toast.ps1
  - repo: pet
    path: overlay/toast.sh
  - repo: pet
    path: docs/plan-advice.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Cosa fa

Narsil parla, in spagnolo, nei momenti che contano:

| Momento                                         | Un esempio di ciò che dice                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------------- |
| Invii un prompt e il lavoro inizia              | "Estoy en eso." ("Ci sto lavorando.")                                        |
| Un turno finisce                                | "Listo, ya quedó." ("Fatto, ecco qua.")                                      |
| Una domanda, un permesso o un piano è in attesa | "Te necesito un momento." ("Ho bisogno di te per un momento.")               |
| Un turno si ferma per un errore                 | "Tuve un tropiezo y me detuve." ("Ho inciampato e mi sono fermata.")         |
| Qualcosa è in attesa da cinque minuti           | "Sigo aquí, esperándote." ("Sono ancora qui, ad aspettarti.")                |
| Un subagente in background finisce o si ferma   | "Un ayudante terminó su encargo." ("Un aiutante ha finito il suo incarico.") |

Ogni momento ha tra quattro e dieci frasi, e lei ne sceglie una a caso ogni volta, così non si ripete. Parla di sé in prima persona e mai per nome.

Insieme alla voce arriva un avviso scritto con un titolo e un testo, come "He terminado" ("Ho finito") sopra un breve riassunto della risposta di Claude. Dove compare dipende da un'impostazione:

- **Con la finestra mobile attiva** (l'impostazione predefinita), l'avviso compare nella finestra, che si apre per mostrarlo. Non viene inviata anche una notifica di sistema.
- **Con la finestra mobile disattivata**, l'avviso arriva come notifica. Su Windows, facendo clic su di essa si apre quella conversazione.

Tre comandi la regolano. `/narsil silencio` e `/narsil voz` disattivano e riattivano la voce. `/narsil discreto` (modalità discreta) la tiene in silenzio, elimina gli avvisi di "turno finito" e ti avvisa comunque, senza parlare, quando qualcosa ha bisogno di te o fallisce; `/narsil normal` la annulla. `/narsil prueba` riproduce un avviso di prova con la sua voce, così puoi sentire quale voce ha scelto il tuo sistema.

## Come funziona dentro

### Le frasi: `hooks/words.ts`

Le parole vivono in un file a parte, separate dagli hook. `VOICE` è un oggetto con un elenco per momento: `start`, `done`, `error`, `question`, `stillWaiting`, `agentDone` e `agentStopped`. `say(moment)` restituisce una frase di quell'elenco, scelta con `Math.random()`.

Il commento sopra `VOICE` fissa le regole di stile: spagnolo latinoamericano neutro, il passato semplice, nessuna parola usata solo in Spagna, la voce di un'assistente calma e cordiale, "composed, a little playful, never servile" (composta, un po' giocosa, mai servile), che parla di sé in prima persona. Quelle regole sono testate, come descritto sotto, quindi una nuova frase che le infrange fa fallire la build.

Tenere le parole a parte ha una ragione pratica: permette ai test di leggere ogni frase senza eseguire una sessione, e permette a qualcuno di cambiare la sua voce senza toccare la logica degli eventi.

### Una funzione decide dove va un avviso: `announce`

Ogni avviso passa per `announce` in `hooks/register.tsx`. Riceve un tipo (`done`, `question` o `error`), un titolo, un testo e la frase da dire. In ordine:

1. Legge le preferenze. In modalità discreta, un avviso `done` si ferma qui a meno che non sia forzato (quello di prova lo è).
2. Inizia a parlare, a meno che la voce non sia disattivata o in modalità discreta. Non aspetta la voce prima di proseguire.
3. Con la finestra mobile attiva, invia l'avviso all'hub come `POST /event`. Se l'hub è giù, `ensureOverlay` lo avvia (al massimo una volta al minuto) e l'avviso viene inviato di nuovo.
4. Con la finestra disattivata, chiama `notify`.
5. Invia l'avviso al telefono, quando gli avvisi sul telefono sono attivati con `/narsil movil`.
6. Aspetta che la voce finisca.

Chi la chiama passa la frase del momento: `say('done')` quando un turno finisce con una risposta, `say('question')` quando un turno finisce con una domanda, `say('error')` quando fallisce, `say('stillWaiting')` per il promemoria dopo cinque minuti. L'inizio del lavoro è l'eccezione: in `turn.start`, un prompt che hai scritto tu (non una continuazione) chiama direttamente `speak` con `say('start')`, senza alcun avviso scritto.

### La voce: prima gli script della mod, poi il motore

`speak` prova prima lo script di Narsil e ripiega sulla voce del motore:

```tsx
async function speak($: EngineInterface, text: string): Promise<void> {
  // The mod's own script first, so a Spanish voice is chosen when one is installed.
  if (await launch($, 'speak', { NARSIL_TEXT: text })) return
  void $.audio.speak(text).catch(() => undefined)
}
```

Il commento spiega il motivo. `$.audio.speak` parla con il sintetizzatore della piattaforma e, per impostazione predefinita, con la sua voce predefinita. Su un computer configurato in inglese, si tratta di una voce inglese che legge lo spagnolo. Gli script di Narsil cercano prima una voce spagnola per nome.

**Su Windows, `overlay/speak.ps1`** prova tre cose in ordine:

1. Una voce spagnola del motore vocale classico (`System.Speech`), preferendo le voci "Natural" (il commento del file menziona un adattatore che espone lì voci dell'Assistente vocale come Dalia) e quelle latinoamericane prima di quelle della Spagna.
2. Una voce spagnola del motore vocale più recente di Windows (`Windows.Media.SpeechSynthesis`, le voci installate dalle Impostazioni di Windows), prima quelle latinoamericane. Scrive il parlato in uno stream e lo riproduce.
3. La voce predefinita del motore classico.

**Su macOS, `overlay/speak.sh`** elenca le voci con `say -v '?'` e sceglie prima Paulina (messicana), poi un'altra voce latinoamericana, poi Mónica, poi qualsiasi voce spagnola, e altrimenti quella predefinita del sistema, ed esegue `say`.

Su qualsiasi altro sistema, `launch` restituisce false e `$.audio.speak` parla con il sintetizzatore della piattaforma, che i tipi della 2.1.325 descrivono come "`say` on macOS" (`say` su macOS).

### Le notifiche: prima il motore, poi gli script

`notify` fa il contrario: chiede prima al motore.

```tsx
try {
  if ((await $.ui.notify(text, { title })).isSent) return
} catch {
  // no notification channel: the mod's own script below
}
await launch($, 'toast', {
  NARSIL_TITLE: title,
  NARSIL_TEXT: text,
  NARSIL_LINK: conversationLink(),
})
```

`$.ui.notify` restituisce `{ isSent: true, … }` quando un canale l'ha presa in carico, oppure `{ isSent: false, reason }` altrimenti. Il `try` c'è, come dice il commento del codice, perché dove l'host non ha alcun notify la chiamata lancia un'eccezione prima di restituire una promise. Solo quando il motore non l'ha inviata Narsil usa i suoi script. (Il README chiama il risultato "notificación del sistema", una notifica di sistema; nel codice, il canale del motore viene prima e gli script di sistema dopo.)

- **`overlay/toast.ps1`** costruisce una notifica toast di Windows con il titolo sopra il testo, entrambi con escape per XML. Quando `NARSIL_LINK` contiene un link a una conversazione, fa in modo che il toast apra quel link al clic. Verifica il link con lo stesso schema che usa l'hub, `claude://code/continue?session=local_…&source=desktop_action`, prima di usarlo.
- **`overlay/toast.sh`** chiama `osascript` con `display notification`. Il titolo e il testo vengono passati come argomenti allo script, mai scritti al suo interno, "so nothing in them runs" (così niente di ciò che contengono viene eseguito), come dice il suo commento.

### Eseguire gli script: `launch`

Sia la voce sia la notifica passano per `launch`, che avvia uno script come processo a sé e ritorna subito. Usa `$.process.run`, che esegue un comando tramite il suo vettore di argomenti senza shell e aspetta che finisca:

- **Su macOS** esegue `/bin/sh -c 'nohup /bin/sh "$NARSIL_SCRIPT" </dev/null >/dev/null 2>&1 &'`. La shell avvia lo script in background ed esce, così `$.process.run` ritorna subito.
- **Su Windows** esegue PowerShell con `Start-Process -WindowStyle Hidden`, che avvia un altro PowerShell nascosto sullo script e ritorna.

Il sistema viene rilevato una sola volta, da `platformOf`: la variabile d'ambiente `OS` (`Windows_NT`), altrimenti `uname -s` (`Darwin` per macOS).

Qui si vedono due decisioni di design:

- **Staccato, così il parlato sopravvive all'hook.** Una frase pronunciata può durare secondi. Un processo staccato continua a parlare dopo che l'hook è tornato, dopo il turno e dopo un ricaricamento della mod, a cui, come nota il commento sopra `launch`, un timer di `$.clock` non sopravvivrebbe.
- **Il testo nell'ambiente, mai nel comando.** Il percorso dello script, il testo e il titolo viaggiano come variabili d'ambiente (`NARSIL_SCRIPT`, `NARSIL_TEXT`, `NARSIL_TITLE`, `NARSIL_LINK`). La riga di comando stessa è una stringa fissa. Il commento in cima a `speak.ps1` dice perché: "nothing Claude wrote can be interpreted as code" (niente di ciò che ha scritto Claude può essere interpretato come codice). Una risposta che contiene virgolette, punti e virgola o `$(…)` viene sempre e solo pronunciata o mostrata.

### Cosa non usa il codice

Narsil non riproduce clip sonori: non c'è nessuna chiamata a `$.audio.play` in `hooks/register.tsx`. L'unica chiamata a `$.audio` è il ripiego `$.audio.speak` descritto sopra.

## Costruiscila con Claude

Chiedi a Claude alcune frasi per ogni momento e un hook che, quando un turno finisce, ne dica una ad alta voce e invii un avviso scritto. L'unica idea che Claude deve fare bene è che la voce non trattiene mai l'hook: il parlato può richiedere secondi, quindi viene avviato, il suo rifiuto viene intercettato, e non viene atteso.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nella mia mod di Claude Code `my-pet`, parla quando un turno finisce. Tieni le frasi in `hooks/words.ts` come un elenco per momento (`done`, `question`, `error`) con almeno quattro frasi ciascuno, e una `say(moment)` che ne scelga una a caso. In `turn.complete`, solo per la conversazione principale, scegli il momento da `e.reason` e chiama `$.audio.speak`, senza aspettarla con await così l'hook ritorna subito, e intercetta il suo rifiuto. Poi invia una notifica con `$.ui.notify(text, { title })` e controlla `isSent`. Aggiungi un test che verifichi che ogni momento abbia almeno quattro frasi distinte e che 200 chiamate a `say` diano più di una frase. Verifica ogni chiamata con i tipi di plugin-authoring.

### Cosa controllare nella risposta di Claude

1. Le frasi vivono in `hooks/words.ts`, separate dagli hook, con almeno quattro per momento e una `say(moment)` che ne sceglie una a caso.
2. `$.audio.speak` viene chiamato con `void … .catch(...)`, non atteso.
3. `$.ui.notify` sta dentro un `try`, perché lancia un'eccezione dove l'host non ha un canale di notifica, e il suo `isSent` dice se un canale ha preso l'avviso.
4. Parla solo la conversazione principale: l'hook ritorna subito quando `e.agentId` è impostato.
5. Se Claude esegue uno script per la voce, il testo viaggia nell'ambiente o come argomento separato, mai dentro una stringa della shell.

Se un controllo fallisce, di' a Claude cosa vedi: "ogni turno finisce qualche secondo in ritardo, quanto serve a dire la frase".

### Come l'ha chiesta l'autore

La richiesta originale per la voce e le notifiche non è stata registrata. Arrivano nel primo commit della finestra mobile, prima che iniziassero i log pubblici dei task. L'unica nota di design registrata è in `docs/plan-advice.md`, il piano per i consigli di Narsil: "**Voice**: off by default (`/narsil consejos voz` turns it on)" (voce: disattivata per impostazione predefinita, `/narsil consejos voz` la attiva). Quello è un piano, non le parole dell'autore, e riguarda i consigli, non questi avvisi.

#### Ricostruzione dalla cronologia dei commit

Da `git log -- overlay/speak.ps1 overlay/speak.sh overlay/toast.ps1 overlay/toast.sh hooks/words.ts hooks/register.tsx` in narsil-pet:

- `6f8f938` (2026-10-30) "feat(overlay): add floating window, Spanish voice and Windows toasts" (aggiunge la finestra mobile, la voce in spagnolo e i toast di Windows). `speak.ps1` e `toast.ps1` arrivano con la finestra mobile.
- `088508e` (2026-10-30) "fix(notify): fall back to the system script when the host has no notify" (ripiega sullo script di sistema quando l'host non ha notify). Il `try` attorno a `$.ui.notify` e gli script come seconda scelta.
- `52af072` (2026-10-30) "feat(mac): speak and notify on macOS with say and osascript" (parla e notifica su macOS con say e osascript). `speak.sh` e `toast.sh`.
- `a2b5970` (2026-10-30) "fix(overlay): start the window again for an event instead of a notification" (riavvia la finestra per un evento invece che per una notifica). Con la finestra attiva, un avviso va alla finestra anche quando questa deve essere riavviata.
- `f7a494e` (2026-10-30) "feat: warn about loops, insist on waiting permissions and sum the session up" (avvisa dei cicli, insiste sui permessi in attesa e riassume la sessione). Il promemoria dopo un'attesa.
- `c73bc13` e `36256f9` (2026-10-31): Narsil parla di sé in prima persona, nella fascia, nella finestra e negli avvisi.
- `17ffb30` (2026-10-31) "feat: add a quiet mode that only speaks up when Narsil needs you" (aggiunge una modalità discreta che parla solo quando Narsil ha bisogno di te).
- `665bd4e` (2026-11-06) "feat: speak when work starts and vary every spoken phrase" (parla quando il lavoro inizia e varia ogni frase pronunciata). Le frasi di `start`, e diverse frasi per ogni momento.
- `44f4372` (2026-11-07) "feat: speak natural neutral Latin American Spanish with more phrases" (parla uno spagnolo latinoamericano neutro e naturale con più frasi). L'ordine delle voci che preferisce le voci latinoamericane naturali, e le regole di stile.

L'ordine racconta la storia: prima una voce e una notifica che funzionavano, poi ogni sistema, poi il comfort della persona (prima persona, una modalità discreta, meno ripetizioni, una voce più naturale).

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida. Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

Scritto per questa guida e verificato con i tipi della 2.1.325 (`$.audio.speak`, `$.ui.notify`, `turn.complete`). Usa solo la voce e le notifiche del motore. Gli script di Narsil, che scelgono una voce spagnola, sono descritti sopra; il codice è adattato da `hooks/words.ts` e `hooks/register.tsx` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later).

Le frasi, `hooks/words.ts`:

```ts
export const VOICE = {
  done: ['Done.', 'All finished here.', 'Finished. Have a look when you can.', 'That is done.'],
  question: [
    'I need you for a moment.',
    'I have a question for you.',
    'Your call, please.',
    'Can you help me with something?',
  ],
  error: [
    'Something went wrong and I stopped.',
    'I hit an error.',
    'I stopped to avoid making it worse.',
    'Let us look at this together.',
  ],
} as const satisfies Record<string, readonly string[]>

export type Moment = keyof typeof VOICE

export function say(moment: Moment): string {
  const options: readonly string[] = VOICE[moment]
  return options[Math.floor(Math.random() * options.length)] ?? options[0]
}
```

L'hook, in `hooks/register.tsx`:

```tsx
import type { Register } from 'claude-code'
import { say, type Moment } from './words'

export const register: Register = (on) => {
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    const moment: Moment = e.reason === 'answer' ? 'done' : 'error'
    const phrase = say(moment)
    // Not awaited: the utterance may take seconds.
    void $.audio.speak(phrase).catch(() => undefined)
    try {
      await $.ui.notify(phrase, { title: 'my-pet' })
    } catch {
      // no notification channel here
    }
    return result
  })
}
```

Narsil non invia da nessuna parte i turni `aborted` (hai premuto stop): imposta lo stato su fermato senza alcun avviso. Una versione più completa controllerebbe anche `e.reason === 'aborted'` e resterebbe in silenzio.

## Errori comuni e come testarlo

- **Aspettare la voce nell'hook.** `$.audio.speak` si risolve quando la frase finisce. Aspettata con await in un hook, trattiene l'evento per secondi. Avviala e intercetta il suo rifiuto, come fa Narsil.
- **Mettere il testo nella riga di comando.** Se esegui uno script con una frase costruita dalla risposta di Claude, passala nell'ambiente o come argomento separato, mai dentro una stringa della shell. `toast.sh` e `speak.ps1` mostrano entrambi lo schema.
- **Dare per scontato che una voce esista.** `$.audio.speak` rifiuta quando non c'è nessun sintetizzatore o la voce non è installata. Gli script di Narsil ripiegano passo dopo passo sulla voce predefinita.
- **Due avvisi per un solo evento.** Narsil invia un avviso alla finestra o al sistema, mai a entrambi, e il README lo dice allo stesso modo.
- **Notificare mentre la persona sta guardando.** Con la finestra mobile attiva, l'hub scarta un evento che arriva mentre Claude è davanti, a meno che non sia forzato. La voce parla comunque.
- **Ripetere una sola frase.** La stessa frase a ogni turno diventa presto rumore; diverse frasi per momento risolvono il problema quasi senza costi.

Per testare, `claude plugin test .` esegue `tests/narsil.test.tsx`. "each moment Narsil speaks has several phrases, so she does not always say the same" (ogni momento in cui Narsil parla ha diverse frasi, così non dice sempre la stessa) verifica almeno quattro frasi distinte per momento e chiama `say('start')` 200 volte. "what Narsil says is neutral Latin American Spanish: no Spain-only words, the simple past" (ciò che dice Narsil è spagnolo latinoamericano neutro: nessuna parola solo della Spagna, il passato semplice) fa rispettare le regole di stile con due espressioni regolari, e verifica che nessuna frase contenga il suo nome. "on macOS Narsil speaks and notifies with its own scripts, detached, never PowerShell" (su macOS Narsil parla e notifica con i propri script, staccati, mai PowerShell) esegue `/narsil prueba` con un macOS fittizio e verifica il comando `nohup` esatto e le variabili `NARSIL_TEXT` e `NARSIL_TITLE` che passa. "on Windows Narsil still speaks and starts the window through PowerShell" (su Windows Narsil parla ancora e avvia la finestra tramite PowerShell) copre l'altro lato, e "with the window on but down, an event starts it again and shows there, never as a notification" (con la finestra attiva ma giù, un evento la riavvia e compare lì, mai come notifica) copre la scelta di `announce`. Per sentire il risultato sul tuo computer, esegui `/narsil prueba`.

## Per andare oltre

- `nudgeText` in `hooks/watch.ts` costruisce il testo del promemoria dopo cinque minuti, e `NUDGE_AFTER_MS` imposta l'attesa.
- `summary` in `hooks/words.ts` riduce la risposta di Claude al breve testo dell'avviso "He terminado", con una versione più lunga per il telefono.
- `/narsil consejos voz` permette a Narsil di pronunciare anche i suoi consigli di fine turno; è disattivato per impostazione predefinita, come previsto da `docs/plan-advice.md`.
- La tabella "Sistemas compatibles" del README elenca la voce e le notifiche per ogni sistema.
