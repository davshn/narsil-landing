---
title: Modalità discreta
description: 'Come /narsil discreto zittisce Narsil senza perdere gli avvisi che contano: cosa si ferma, cosa passa ancora e perché il confine è su "ha bisogno di te".'
route: pet
order: 14
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: types/index.d.ts
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Cosa fa

Narsil parla molto, per scelta: parla quando il lavoro inizia e finisce, avvisa quando un turno finisce, dà consigli, propone i prossimi passi e riassume la sessione. In una giornata di riunioni, o semplicemente in un ufficio condiviso, è troppo.

`/narsil discreto` ("discreta") abbassa tutto questo in un colpo solo. Smette di parlare, smette di avvisare quando un turno finisce, e smette di offrire da sé consigli e prossimi passi. Ti avvisa ancora, senza voce, quando ha bisogno di te o qualcosa è fallito, e la fascia mostra ancora cosa sta facendo. `/narsil normal` riporta tutto com'era.

Narsil ha tre modi di farsi da parte, ed è utile distinguerli:

| Comando            | Cosa cambia                                                                         |
| ------------------ | ----------------------------------------------------------------------------------- |
| `/narsil silencio` | Solo la voce. Ogni avviso, consiglio e passo arriva ancora, per iscritto.           |
| `/narsil ocultar`  | Solo la fascia. Voce e avvisi continuano.                                           |
| `/narsil discreto` | Voce spenta, avvisi di fine turno spenti, extra automatici spenti; il resto rimane. |

Ciascuno ha il suo opposto: `voz`, `mostrar` e `normal`. Sono interruttori indipendenti, quindi `/narsil normal` spegne la modalità discreta senza riaccendere una voce silenziata.

## Come funziona dentro

### Una preferenza: `isQuiet`

La modalità discreta è un unico booleano, `isQuiet`, nell'atom `prefs` di `hooks/register.tsx` (il suo tipo, `Prefs`, è in `types/index.d.ts`). Il gestore del comando `/narsil` lo scrive tramite una piccola tabella:

```tsx
const change: Record<string, Partial<Prefs>> = {
  ocultar: { isHidden: true },
  mostrar: { isHidden: false },
  silencio: { isMuted: true },
  voz: { isMuted: false },
  discreto: { isQuiet: true },
  normal: { isQuiet: false },
}
```

La modifica viene fusa nell'atom e l'intero oggetto `prefs` viene salvato con `$.store.set('prefs', …)`, così la modalità dura tra le sessioni finché non la cambi. A `session.start`, le preferenze salvate vengono fuse sopra i valori predefiniti, il che copre anche i valori salvati più vecchi che non hanno ancora il campo.

Non esiste un percorso di codice "discreto" a sé. Invece, ogni punto che fa rumore legge `isQuiet` e decide da sé. Questo tiene la regola accanto a ciò che governa, e significa che un nuovo tipo di rumore deve aderire esplicitamente alla modalità discreta.

### Il confine che traccia: "ha bisogno di te" passa

Ogni avviso passa per `announce` (la guida 6 lo tratta per intero). Le sue prime righe sono dove vive la modalità discreta:

```tsx
const { isMuted, isFloating, isQuiet } = await read($, prefs)
// Quiet: no voice, and only what needs you (a question, an error) is told.
if (isQuiet && kind === 'done' && !force) return
const spoken = isMuted || isQuiet ? Promise.resolve() : speak($, voice)
```

Un avviso è di uno di tre tipi: `done`, `question` o `error`. In modalità discreta:

- un avviso `done` ritorna prima che succeda qualsiasi cosa: niente finestra mobile, niente notifica di sistema, niente telefono, niente voce;
- una `question` o un `error` prosegue come al solito verso la finestra mobile (o una notifica di sistema quando la finestra è spenta) e verso il telefono, solo senza la voce.

Il motivo di questo confine è nel commento e nel README: ciò che si ferma è ciò che puoi perderti senza problemi. Un turno finito sarà ancora finito quando guarderai. Una domanda o un permesso bloccano il lavoro finché non rispondi, e un errore significa che il lavoro si è fermato. Zittirli trasformerebbe una modalità discreta in una modalità rotta.

Il flag `force` lascia comunque passare due chiamanti. `/narsil prueba` ("prova"), l'avviso di prova, è forzato, così puoi controllare i tuoi avvisi anche in modalità discreta. Anche il promemoria dei cinque minuti per un permesso o una domanda rimasti in attesa è forzato, anche se come `question` passerebbe comunque.

### Cosa fa ogni tipo di avviso in modalità discreta

Passando in rassegna i chiamanti di `announce`:

| Momento                                                     | Tipo       | Modalità discreta              |
| ----------------------------------------------------------- | ---------- | ------------------------------ |
| Un turno finisce ("He terminado", "ho finito")              | `done`     | fermato                        |
| Un subagente in background finisce bene                     | `done`     | fermato                        |
| Un subagente in background si ferma o fallisce              | `error`    | mostrato, senza voce           |
| Un turno fallisce ("Me he detenido", "mi sono fermata")     | `error`    | mostrato, senza voce           |
| Una domanda, un piano o un permesso                         | `question` | mostrato, senza voce           |
| Un turno finisce chiedendo nella casella del prossimo passo | `question` | mostrato, senza voce           |
| Ancora in attesa dopo 5 minuti                              | `question` | mostrato, senza voce           |
| `/narsil prueba`                                            | `done`     | mostrato (forzato), senza voce |

### Gli altri rumori

Fuori da `announce`, altri quattro punti leggono `isQuiet`:

- **La voce all'inizio del lavoro.** In `turn.start`, un prompt che hai scritto le fa dire una frase di inizio, a meno che non sia attivo `isMuted` o `isQuiet`.
- **I consigli automatici.** `mayTip` restituisce false quando `isQuiet`, prima di contare qualsiasi cosa. Un consiglio che chiedi con `/narsil consejo` non è automatico e risponde comunque.
- **I prossimi passi.** `offerSteps` ritorna subito quando `isQuiet`.
- **Il riassunto della sessione inattiva.** `tickWatch` mostra il riassunto dopo 30 minuti di quiete solo quando `isQuiet` è false. `/narsil resumen` risponde comunque.

### Cosa non tocca la modalità discreta

Leggere il codice ti dice anche cosa rimane, e vale la pena saperlo:

- **La fascia e il contenuto della finestra mobile.** Stati, titoli, commenti, l'elenco delle conversazioni, l'orologio della cache e il festeggiamento di un nuovo livello vengono disegnati come prima. La modalità discreta riguarda le interruzioni, non l'informazione.
- **Il suggerimento di `/compact`** della guida 7. Viene controllato con `isAdviceOn`, non con `isQuiet`, quindi può comparire anche in modalità discreta. `/narsil consejos off` lo ferma.
- **L'avvertimento sui comandi pericolosi** della guida 9: è un commento nella fascia e una riga di log, non un avviso.
- **Lo stato silenzioso inviato al topic `-estado` del telefono** (guida 15). Non genera mai una notifica e, mentre gli avvisi sul telefono sono attivi e scrivi da fuori, parte dopo ogni turno qualunque sia la modalità.

Quando la modalità è attiva, il comando `/narsil` da solo aggiunge una riga al suo resoconto: "Modo discreto activado: sin voz, sin avisos de fin de turno ni consejos o pasos automáticos." ("Modalità discreta attiva: niente voce, niente avvisi di fine turno, niente consigli o passi automatici.")

## Costruiscila con Claude

Chiedi a Claude un'unica preferenza salvata che abbassi ogni rumore che la mod fa. L'unica idea che deve fare bene è dove passa il confine: un turno finito può aspettare, ma una domanda o un errore passano comunque, senza la voce.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> La mia mod di Claude Code `my-pet` parla, avvisa alla fine di ogni turno e mostra consigli. Aggiungi una modalità discreta: `/my-pet quiet` e `/my-pet normal` impostano un booleano `isQuiet` nelle preferenze, salvato con `$.store.set` e caricato a `session.start`. Nella funzione che invia ogni avviso, che riceve un tipo (`done`, `question`, `error`), ritorna subito per `done` in modalità discreta a meno che l'avviso non sia una prova forzata, e non parlare mai in modalità discreta; domande ed errori si mostrano comunque. Salta anche i consigli automatici in modalità discreta, ma mantieni i consigli che la persona chiede. Lascia la fascia com'è. Aggiungi test con `claude-code/testing`: in modalità discreta un turno finito non genera né notifica né voce, e una chiamata `AskUserQuestion` notifica comunque.

### Cosa controllare nella risposta di Claude

1. `/my-pet quiet` e `/my-pet normal` cambiano solo `isQuiet`, e la preferenza viene salvata con `$.store.set` e caricata a `session.start`, così resta tra una sessione e l'altra.
2. Nella funzione che invia ogni avviso, un avviso `done` ritorna subito in modalità discreta a meno che non sia la prova forzata, e una `question` o un `error` si mostrano comunque.
3. La voce viene saltata in modalità discreta per ogni tipo di avviso.
4. I consigli automatici vengono saltati in modalità discreta, ma un consiglio che la persona chiede riceve comunque risposta.
5. La fascia viene disegnata come prima: la modalità discreta ferma le interruzioni, non le informazioni.

Se un controllo fallisce, di' a Claude cosa vedi: "in modalità discreta una finestra di permesso aspetta e niente me lo dice".

### Come l'ha chiesta l'autore

La richiesta originale per la modalità discreta non è stata registrata. I log pubblici dei task del progetto non la coprono.

#### Ricostruzione dalla cronologia dei commit

Da `git log -S isQuiet -- hooks/register.tsx` in narsil-pet:

- `17ffb30` (2026-10-31) "feat: add a quiet mode that only speaks up when Narsil needs you" (aggiunge una modalità discreta che si fa sentire solo quando Narsil ha bisogno di te). Un solo commit aggiunge l'intera modalità: il campo `isQuiet`, il ritorno anticipato in `announce`, i controlli nei consigli, nei prossimi passi e nel riassunto di inattività, le parole `discreto` e `normal`, la riga nel resoconto del comando da solo, una sezione del README e un test. Il suo oggetto è il design in una frase.
- `665bd4e` (2026-11-06) "feat: speak when work starts and vary every spoken phrase" (parla quando il lavoro inizia e varia ogni frase detta). La voce di inizio lavoro è nuova qui, e legge `isQuiet` fin dal primo giorno. È lo schema in azione: un nuovo rumore aderisce alla modalità discreta quando viene aggiunto.

La modalità è arrivata alla fine della prima settimana, dopo che la voce, gli avvisi, i consigli e i prossimi passi esistevano già. Quell'ordine corrisponde a un percorso comune: una mod acquisisce funzionalità una alla volta, e solo quando si accumulano ha bisogno di un unico interruttore per abbassarle.

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida. Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

Scritto per questa guida e verificato con i tipi della 2.1.325 (`$.store.get`, `$.store.set`, `$.command.register`, `command.run`, `$.ui.notify`, `session.start`, `turn.complete`, `tool.call`). È adattato da `hooks/register.tsx` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). L'atom `prefs` è dichiarato in `types/index.d.ts` come `{ isQuiet: boolean }`. La funzione vuota `speak` è dove va la tua voce, come quella della guida 6.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

type Kind = 'done' | 'question' | 'error'
const prefs = atom({ plugin: 'my-pet', key: 'prefs' } as const, { isQuiet: false })

async function speak($: EngineInterface, text: string): Promise<void> {
  // your own voice goes here (guide 6)
}

async function announce(
  $: EngineInterface,
  kind: Kind,
  title: string,
  text: string,
  force = false,
) {
  const { isQuiet } = await read($, prefs)
  // What you can safely miss stays quiet; what blocks the work never does.
  if (isQuiet && kind === 'done' && !force) return
  const spoken = isQuiet ? Promise.resolve() : speak($, text)
  try {
    await $.ui.notify(text, { title })
  } catch {
    // no notification channel on this surface
  }
  await spoken
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'my-pet', description: 'My pet: quiet | normal | test' })
    const saved = await $.store.get('prefs').catch(() => undefined)
    if (saved && typeof saved === 'object') await update($, prefs, (p) => ({ ...p, ...saved }))
    return next(e)
  })

  on('command.run', { command: 'my-pet' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'test') {
      await announce($, 'done', 'Test', 'This is how I will tell you.', true)
      return { text: 'My pet: test alert sent.' }
    }
    if (arg !== 'quiet' && arg !== 'normal') return { text: 'Usage: /my-pet quiet | normal | test' }
    const saved = await update($, prefs, (p) => ({ ...p, isQuiet: arg === 'quiet' }))
    await $.store.set('prefs', saved).catch(() => undefined)
    return {
      text: saved.isQuiet
        ? 'My pet: quiet. I only tell you when I need you.'
        : 'My pet: back to normal.',
    }
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId === undefined && e.tool === 'AskUserQuestion')
      await announce($, 'question', 'I need you', 'I have a question for you.')
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    if (e.reason === 'answer') await announce($, 'done', 'Done', 'I have finished.')
    else if (e.reason !== 'aborted')
      await announce($, 'error', 'I stopped', 'The turn ended with an error.')
    return result
  })
}
```

`update` restituisce il nuovo valore, quindi il comando salva esattamente ciò che ha scritto. Il `try` intorno a `$.ui.notify` segue un commento nel `notify` di Narsil: dove l'host non ha alcun notify, "the call throws before it returns a promise" (la chiamata lancia un'eccezione prima di restituire una promise), quindi un `.catch` non la catturerebbe.

## Errori comuni e come testarlo

- **Zittire tutto.** Una modalità discreta che ferma anche domande ed errori lascia Claude in attesa di un permesso che nessuno vede. Decidi per tipo di avviso, in base a se perderlo blocca il lavoro.
- **Un flag in un solo punto.** Se solo la funzione degli avvisi legge il flag, ogni rumore aggiunto dopo lo ignora. Narsil legge `isQuiet` in ogni punto che fa rumore, e aggiunge il controllo quando aggiunge il rumore.
- **Lasciare che la modalità discreta fermi la prova.** Senza `force`, `/narsil prueba` non farebbe niente in modalità discreta, e la persona penserebbe che gli avvisi siano rotti.
- **Accoppiare gli interruttori.** `normal` dovrebbe annullare solo `discreto`. Se riattivasse anche la voce, una persona che prima aveva silenziato Narsil la sentirebbe di nuovo.
- **Dimenticare di salvare.** Una preferenza tenuta solo in un atom sparisce con la sessione successiva.

Per testare, `tests/narsil.test.tsx` ha due test per questo. "/narsil discreto keeps her quiet, and /narsil normal brings everything back" (/narsil discreto la tiene in silenzio, e /narsil normal riporta tutto) gira su un macOS simulato senza la finestra mobile, registra gli script avviati per la voce e le notifiche, finisce un turno e lascia passare undici minuti: niente viene detto, nessuna notifica parte, nessun modello viene interrogato; poi una chiamata `AskUserQuestion` genera esattamente una notifica intitolata "Narsil · Te necesito" ("Narsil · Ho bisogno di te"). "in quiet mode the phone gets only what needs you" (in modalità discreta il telefono riceve solo ciò che ha bisogno di te) verifica la stessa regola sul telefono: dopo un turno finito e una domanda, viene pubblicata solo la domanda.

## Per andare oltre

- `announce` in `hooks/register.tsx` è l'unica funzione da leggere per sapere dove va ogni avviso; la guida su voce e avvisi la percorre.
- Il comando `/narsil` da solo stampa tutte le preferenze insieme, compresa questa. L'ultima guida del percorso, sui comandi, mostra come è costruito.
- La guida successiva invia gli stessi avvisi al tuo telefono e al tuo orologio, con la stessa regola della modalità discreta.
