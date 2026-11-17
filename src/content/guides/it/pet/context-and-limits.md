---
title: Contesto e limiti
description: 'Come Narsil disegna la barra del contesto di ogni conversazione, stima quando si riempie al ritmo degli ultimi 15 minuti, suggerisce /compact una volta e mostra i limiti di 5 ore e settimanali.'
route: pet
order: 7
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/usage.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Cosa fa

Due tipi di limiti decidono per quanto tempo puoi continuare a lavorare con Claude, e Narsil li mostra entrambi.

**La finestra di contesto** è quanta parte della conversazione il modello può tenere in una volta. Quando si riempie, Claude Code deve compattare la conversazione, riassumendo ciò che è venuto prima, e alcuni dettagli possono perdersi. Ogni conversazione ha la propria finestra, quindi ogni riga nella fascia di Narsil ha la propria barra e la propria percentuale:

```text
● TRABAJANDO   ▾ web                     ██████░░░░ 62 %
```

La barra della tua conversazione è blu, così risalta; le altre sono verdi, ambra oltre il 60 % e rosse oltre l'85 %. Premendo la percentuale della conversazione aperta si vedono i suoi token, tra quanto si riempirà e cosa la riempie:

- "120k / 200k · lleno en ~20 min" ("piena tra circa 20 minuti").
- Una barra per parte, come la scompone `/context`: messaggi, il prompt di sistema, gli strumenti MCP, i file di memoria, la riserva per la compattazione e lo spazio libero, ognuno con i suoi token.

Quando il contesto supera il 70 % e si riempirà entro 20 minuti, o appena supera l'85 %, Narsil suggerisce una volta: "El contexto va al 72 % y se llenará en ~13 min: es buen momento para /compact." ("Il contesto è al 72 % e si riempirà tra circa 13 minuti: è un buon momento per /compact.")

**I limiti dell'account** sono la finestra di 5 ore e la finestra settimanale di un piano in abbonamento. Sono gli stessi per ogni conversazione, quindi compaiono una sola volta, in alto, con il tempo che manca prima che ciascuno ricominci:

```text
5 horas  ███░░░░░░░ 31 %  reinicia en 2 h 05 min
Semana   █░░░░░░░░░ 12 %  reinicia en 3 d 4 h
```

Con una chiave API non ci sono finestre di questo tipo, e Narsil non ne mostra nessuna.

## Come funziona dentro

### Da dove vengono i numeri

Narsil non conta i token da sola. Legge le cifre che Claude Code ha già, le stesse che mostra la sua riga di stato, da due punti dell'API delle mod:

- **`$.session.usage()`**, chiamata una volta in `session.start`. Restituisce `context` (la finestra attiva: `window` in token, e `tokens` e `percent` una volta che una risposta li ha comunicati) e `rateLimits`, una voce per finestra, ognuna con un `kind` (`five_hour`, `seven_day`), un `percentUsed` e un timestamp `resetsAt` facoltativo.
- **L'evento `session.measure`**, che, come dicono i tipi della 2.1.325, "fires when the engine measures the session and a unit moved: after each main-thread turn, and when a rate-limit window moves a whole point" (scatta quando il motore misura la sessione e un'unità si è spostata: dopo ogni turno del thread principale, e quando una finestra dei limiti si sposta di un punto intero). Porta gli stessi `context` e `rateLimits`.

Entrambi passano per una sola funzione pura, `usageOf` in `hooks/usage.ts`, che li trasforma nella forma propria di Narsil: `context` (`percent`, `tokens`, `window`), `fiveHour` e `week`. Una finestra senza lettura è `null`. I tipi dicono che `rateLimits` è "empty off a subscription" (vuoto fuori da un abbonamento), ed è per questo che con una chiave API non compare nessun limite.

Poi `setUsage` in `hooks/register.tsx` salva il risultato nell'atom `usage` (solo quando è cambiato), registra la lettura del contesto per la stima, aggiorna la scomposizione e invia lo stato all'hub, così le altre conversazioni e la finestra mobile vedono la barra di questa.

La scelta di design è ricevere i dati, non interrogare periodicamente. Il motore solleva `session.measure` esattamente quando un numero si è spostato, quindi Narsil non chiede mai cifre che non possono essere cambiate.

### La stima: il ritmo degli ultimi 15 minuti

"Piena tra circa 20 minuti" è una previsione in linea retta dalle letture recenti. Ogni volta che il contesto viene misurato, `trackContext` aggiunge un campione, `{ at, percent }`, a un elenco di al massimo 30. Poi `minutesToFull` in `hooks/usage.ts` fa il calcolo:

1. Tiene solo i campioni degli ultimi 15 minuti (`BURN_WINDOW_MS`).
2. Prende il primo e l'ultimo. Se coprono meno di un minuto, o il contesto non è cresciuto, non c'è nessuna stima.
3. Il ritmo è la crescita divisa per i minuti tra i due.
4. La risposta è lo spazio rimasto diviso per il ritmo, arrotondato.

Per esempio: 50 % al minuto 0 e 60 % al minuto 5 fanno il 2 % al minuto, e il 40 % rimasto richiede 20 minuti.

Ogni scelta ha una ragione:

- **Quindici minuti, non tutta la conversazione.** Il lavoro arriva a raffiche. Un lungo tratto tranquillo seguito da una lettura intensa di file deve dare una stima vicina, non una media che nasconde la raffica.
- **Nessuna stima per meno di un minuto o per un contesto che non cresce.** Due letture a pochi secondi di distanza, o un contesto che si è ridotto, danno un ritmo che non significa nulla.
- **Dimenticare i campioni quando il contesto si riduce.** Un calo significa che è stato eseguito `/compact` o `/clear`. Il vecchio ritmo appartiene a una conversazione che non esiste più, quindi l'elenco ricomincia.
- **Nascondere le stime oltre le due ore.** `MAX_ESTIMATE_MINUTES` vale 120; una previsione così lontana è troppo imprecisa per valere la pena di mostrarla, come dice il commento.

### Il suggerimento di `/compact`, una volta

`trackContext` decide anche il suggerimento, con quattro costanti:

- `NUDGE_AT = 70`: mai sotto il 70 %.
- `NUDGE_WITHIN_MINUTES = 20`: dal 70 %, solo se la stima dice che si riempie entro 20 minuti.
- `NUDGE_ALWAYS_AT = 85`: dall'85 %, sempre, con o senza stima.
- `NUDGE_RESET_BELOW = 50`: una volta che il contesto scende sotto il 50 %, un nuovo riempimento può ricevere un nuovo suggerimento.

Un flag, `isCompactNudged`, fa sì che avvenga una volta per riempimento. Il suggerimento è uno dei consigli di Narsil (`showTip` con il tipo `context`), quindi compare dove compaiono i suoi consigli, e viene saltato quando i consigli sono disattivati (`/narsil consejos off`). Il ragionamento è lo stesso di ogni avviso in Narsil: un avvertimento che si ripete a ogni turno viene presto ignorato.

### La scomposizione, stimata in locale

Cosa riempie il contesto viene da `$.session.usage({ breakdown: 'summary' })`. I tipi descrivono le due modalità: `full` "sends one token-count request per tool and memory file, as /context does; `summary` estimates locally and sends none" (`full` invia una richiesta di conteggio dei token per ogni strumento e file di memoria, come fa /context; `summary` stima in locale e non ne invia nessuna). Narsil usa `summary` e la aggiorna ogni volta che una misurazione cambia le cifre, così la scomposizione si può aprire subito, anche per un'altra conversazione, la cui scomposizione viaggia attraverso l'hub.

`contextDetailOf` in `hooks/usage.ts` tiene le parti che vale la pena mostrare: scarta gli schemi degli strumenti caricati su richiesta (`deferred`, fuori dalla finestra) e le righe vuote, ordina per dimensione ciò che è usato, poi la riserva per la compattazione, poi lo spazio libero, e dà a ognuna un colore.

### Disegnare le barre

I pezzi in `hooks/usage.ts` sono piccoli e puri:

- `levelColor(percent)`: verde `#22B573`, ambra `#F5B400` dal 60 %, rosso `#F0435A` dall'85 %.
- `textBar(percent)`: dieci celle di `█` e `░`, per le righe della fascia.
- `minutesLabel` e `resetIn`: "13 min", "2 h 05 min", "3 d 4 h".
- `usageRows`: le righe da disegnare, ognuna con la sua nota: i token e la stima per il contesto, "reinicia en …" (si azzera tra …) per i limiti.
- `usageSvg`: le stesse righe come un piccolo SVG, usato sul desktop, dove ogni barra cresce da vuota quando viene disegnata e il testo segue il tema chiaro o scuro.

### Perché una barra per conversazione

Il contesto appartiene a una conversazione, non a te. Una sola cifra di "contesto" per più conversazioni farebbe la media di cose di cui non si può fare la media. Ecco perché la barra generale è stata rimossa e ogni riga ha ricevuto la propria, come registra la sezione seguente. I limiti dell'account sono il caso opposto: appartengono all'account, quindi compaiono una sola volta.

## Come è stata chiesta all’IA

### Registrato: una barra per conversazione

Le barre per conversazione sono state chieste in `odd/tasks/fleet-view.md` in narsil-pet, nella stessa conversazione che ha prodotto la vista di tutte le conversazioni (L1 è datata 2026-11-06; le voci successive non hanno data). L3 (estratto):

> "la barra de contexto general tambien se iria por que no existe un contexto general y se reemplazaria por las barras de contexto de cada conversacion"

In italiano: anche la barra del contesto generale se ne andrebbe, perché un contesto generale non esiste, e verrebbe sostituita dalla barra del contesto di ogni conversazione. La spec S5 del log aggiunge: "The account limits (5 hours, week) stay, shown once." (i limiti dell'account, 5 ore e settimana, restano, mostrati una sola volta).

La scomposizione è stata chiesta in L2 (estratto):

> "el detalle de como se llena el contexto deberia aparecer cuando se de click en la palabra contexto."

In italiano: il dettaglio di come si riempie il contesto dovrebbe comparire quando si fa clic sulla parola "contesto". L7 la registra come completata nella fascia. Un giorno dopo, `250d2c6` (2026-11-07) "feat: open the context from its percent and let next steps stand alone" (apre il contesto dalla sua percentuale e lascia che i prossimi passi stiano da soli) ha spostato il controllo della fascia dalla parola alla percentuale, che è dove lo mettono oggi il README e il codice. Nella finestra mobile, la parola "Contexto" la apre ancora.

### Ricostruzione dalla cronologia dei commit

Le barre, la stima e il suggerimento sono venuti prima di quel log, e le loro richieste non sono state registrate. Da `git log -- hooks/usage.ts hooks/register.tsx`:

- `630c0d8` (2026-10-30) "feat(usage): add context, 5-hour and weekly usage bars" (aggiunge le barre di utilizzo del contesto, delle 5 ore e settimanale). La prima versione: una barra del contesto e i due limiti.
- `c885292` (2026-10-30) "feat: estimate when the context fills, react to tests and dangerous commands, show subagents" (stima quando il contesto si riempie, reagisce ai test e ai comandi pericolosi, mostra i subagenti). La stima sui 15 minuti e il suggerimento di `/compact`.
- `2bcc97c` (2026-11-05) "feat: open the context breakdown from the usage bars and calm loop, steps and permission alerts" (apre la scomposizione del contesto dalle barre di utilizzo e calma gli avvisi di ciclo, passi e permessi). La scomposizione.
- `49f0fd9` (2026-11-06) "feat: list every open conversation in the band" (elenca ogni conversazione aperta nella fascia). La barra si sposta nella riga di ogni conversazione, come chiedeva L3.
- `d654e3b` (2026-11-06) "feat: list this conversation first with a blue context bar" (elenca per prima questa conversazione con una barra del contesto blu).
- `250d2c6` (2026-11-07), citato sopra.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nella mia mod di Claude Code `my-pet`, mostra nella fascia `AbovePrompt` il riempimento della finestra di contesto e i limiti di 5 ore e settimanali dell'account. Leggili una volta con `$.session.usage()` in `session.start` e poi a ogni evento `session.measure`, e conservali in un atom. Scrivi la logica come funzioni pure in `hooks/usage.ts`: una che trasformi `context` e `rateLimits` (`five_hour`, `seven_day`) nella mia forma, una barra di testo di dieci celle, un colore che diventa ambra al 60 % e rosso all'85 %, e `minutesToFull(samples, now)`, che stima quando il contesto si riempie dalle letture degli ultimi 15 minuti e restituisce null con meno di un minuto di letture o senza crescita. Suggerisci `/compact` una volta per riempimento quando il contesto supera il 70 % e si riempie entro 20 minuti, o supera l'85 %. Aggiungi test per ogni funzione e verifica ogni API con i tipi di plugin-authoring.

## Il codice minimo

Scritto per questa guida e verificato con i tipi della 2.1.325 (`$.session.usage`, `session.measure`, `SessionContextUsage`, `SessionRateLimit`, `$.clock.now`, `$.ui.toast`). È adattato da `hooks/usage.ts` e `hooks/register.tsx` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). L'atom `usage` è dichiarato in `types/index.d.ts` come nella prima guida.

La parte pura, `hooks/usage.ts`:

```ts
import type { SessionContextUsage, SessionRateLimit } from 'claude-code'

export type Meter = { percent: number; resetsAt?: string }
export type Usage = { context: number | null; fiveHour: Meter | null; week: Meter | null }
export type Sample = { at: number; percent: number }

export function usageOf(m: {
  context: SessionContextUsage
  rateLimits: readonly SessionRateLimit[]
}): Usage {
  const meter = (kind: string): Meter | null => {
    const r = m.rateLimits.find((x) => x.kind === kind)
    return r ? { percent: r.percentUsed, resetsAt: r.resetsAt } : null
  }
  return {
    context: m.context.percent ?? null,
    fiveHour: meter('five_hour'),
    week: meter('seven_day'),
  }
}

export const levelColor = (p: number) => (p >= 85 ? '#F0435A' : p >= 60 ? '#F5B400' : '#22B573')

export function textBar(percent: number, cells = 10): string {
  const full = Math.max(0, Math.min(cells, Math.round((percent / 100) * cells)))
  return '█'.repeat(full) + '░'.repeat(cells - full)
}

const WINDOW_MS = 15 * 60_000

export function minutesToFull(samples: readonly Sample[], now: number): number | null {
  const recent = samples.filter((s) => now - s.at <= WINDOW_MS)
  const first = recent[0]
  const last = recent.at(-1)
  if (!first || !last) return null
  const minutes = (last.at - first.at) / 60_000
  if (minutes < 1 || last.percent <= first.percent) return null
  const perMinute = (last.percent - first.percent) / minutes
  return Math.max(0, Math.round((100 - last.percent) / perMinute))
}
```

Gli hook, in `hooks/register.tsx`:

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import { levelColor, minutesToFull, textBar, usageOf } from './usage'
import type { Sample, Usage } from './usage'

const usage = atom({ plugin: 'my-pet', key: 'usage' } as const, {
  context: null,
  fiveHour: null,
  week: null,
})
let samples: Sample[] = []
let isNudged = false

async function track($: EngineInterface, next: Usage): Promise<void> {
  await update($, usage, () => next)
  const percent = next.context
  if (percent === null) return
  const now = await $.clock.now()
  const last = samples.at(-1)
  if (last && percent < last.percent) samples = []
  if (percent < 50) isNudged = false
  samples = [...samples, { at: now, percent }].slice(-30)
  const toFull = minutesToFull(samples, now)
  const isNear = toFull !== null && toFull <= 20
  if (isNudged || percent < 70 || !(isNear || percent >= 85)) return
  isNudged = true
  $.ui.toast(`Context at ${Math.round(percent)} %: a good moment for /compact.`)
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    const spent = await $.session.usage().catch(() => undefined)
    if (spent) await track($, usageOf(spent))
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await track($, usageOf(e))
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const u = await read($, usage)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column" minWidth={0}>
        {u.context !== null ? (
          <Text
            color={levelColor(u.context)}
          >{`Context ${textBar(u.context)} ${Math.round(u.context)} %`}</Text>
        ) : null}
        {u.fiveHour ? (
          <Text>{`5 hours ${textBar(u.fiveHour.percent)} ${Math.round(u.fiveHour.percent)} %`}</Text>
        ) : null}
        {u.week ? (
          <Text>{`Week ${textBar(u.week.percent)} ${Math.round(u.week.percent)} %`}</Text>
        ) : null}
      </Box>
    )
  })
}
```

Narsil mostra il suggerimento come uno dei suoi consigli; una versione minima può usare `$.ui.toast`, come qui.

## Errori comuni e come testarlo

- **Interrogare periodicamente per avere le cifre.** Un timer che chiama `$.session.usage()` ogni pochi secondi fa un lavoro che `session.measure` fa già per te, nel momento in cui un numero si sposta.
- **Dare per scontato che i limiti esistano.** Fuori da un abbonamento, `rateLimits` è vuoto. In quel caso non disegnare nulla, invece di una barra allo 0 %.
- **Un contesto ancora senza percentuale.** Prima della prima risposta, `percent` e `tokens` possono mancare. Narsil tratta un `percent` mancante come "nessuna lettura".
- **Mantenere il vecchio ritmo dopo `/compact`.** Se i campioni non vengono cancellati quando il contesto si riduce, la stima mescola due conversazioni e dice cose senza senso.
- **Un suggerimento a ogni turno.** Senza un flag che si azzeri solo quando il contesto cala, lo stesso consiglio di `/compact` torna al 71, al 72 e al 73 %.
- **Chiedere la scomposizione `full` a ogni misurazione.** `full` invia richieste di conteggio dei token; `summary` è locale e gratuita.

Per testare, `claude plugin test .` esegue `tests/narsil.test.tsx`. "the context bar tells when it will fill, and Narsil suggests /compact once when it is near" (la barra del contesto dice quando si riempirà, e Narsil suggerisce /compact una volta quando è vicina) misura il 50 % e, cinque minuti dopo, il 60 %, poi verifica il testo "120k / 200k · lleno en ~20 min"; poi misura il 72 % al minuto 10 e il 74 % al minuto 11 e verifica che sia uscito esattamente un suggerimento, "El contexto va al 72 % y se llenará en ~13 min: es buen momento para /compact.". "a context that is not growing shows no estimate and no nudge" (un contesto che non cresce non mostra né stima né suggerimento) copre un contesto che si riduce. "the band shows the 5-hour window and the week once, and the context in its conversation" (la fascia mostra una sola volta la finestra di 5 ore e la settimana, e il contesto nella sua conversazione), "off a plan, no limits show, and the context is read when the session starts" (fuori da un piano non compare nessun limite, e il contesto viene letto quando la sessione inizia) e "a press on the open conversation percent shows what fills the context, and another goes back to the bars" (premere la percentuale della conversazione aperta mostra cosa riempie il contesto, e premerla di nuovo torna alle barre) coprono il resto. Le funzioni in `hooks/usage.ts` ricevono valori semplici, quindi si possono anche testare direttamente con un elenco di campioni e un `now` fisso.

## Per andare oltre

- `contextDetailOf`, `contextDetailRows` e `contextDetailSvg` in `hooks/usage.ts` trasformano la scomposizione di `/context` in barre.
- `usageSummary` e `contextDetailSummary` danno una frase per i posti che non possono disegnare barre.
- `toggleContextDetail` in `hooks/register.tsx` rilegge da capo la scomposizione di questa conversazione quando la apri, e mostra un toast se non ci riesce.
- `shownState` invia all'hub il `context` (la sua percentuale e la sua nota) e il `contextDetail` di ogni conversazione, ed è così che la fascia di un'altra conversazione e la finestra mobile disegnano una barra che non hanno misurato.
