---
title: Esperienza e crescita
description: 'Come Narsil guadagna esperienza da turni finiti, test superati e subagenti finiti, sale di livello, cresce in cinque stadi e festeggia, con gli XP conservati tra le sessioni.'
route: pet
order: 13
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/xp.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/sprite.ts
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: hooks/phone.ts
  - repo: pet
    path: types/index.d.ts
  - repo: pet
    path: odd/tasks/animated-poses.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Cosa fa

Narsil cresce con il lavoro che osserva. Ogni turno finito, ogni esecuzione di test che passa e ogni subagente che finisce bene le danno punti esperienza (XP). Con abbastanza XP raggiunge un nuovo livello, e ad alcuni livelli cresce verso un nuovo stadio della sua vita: da piccola appena uscita dall'uovo a serpente marino adulto.

Dal tuo lato, lo mostrano tre cose:

- **Un'etichetta di livello** accanto al suo nome, nella fascia e nella finestra mobile: "⭐ Nivel 3 · 120/300 XP" ("Livello 3, 120 dei 300 XP che servono a questo livello").
- **Un festeggiamento** quando sale di livello: un bagliore dorato, anelli, stelle e uno striscione "NIVEL 3" ("LIVELLO 3") sopra la sua immagine, e il commento della fascia dice "¡He subido al nivel 3! ⭐" ("sono salita al livello 3!"). Un nuovo stadio si festeggia in modo diverso: un lampo, raggi di luce, uno striscione "¡ETAPA 2!" ("STADIO 2!") e "¡He crecido!" ("sono cresciuta!").
- **Il suo aspetto.** Ciascuno dei cinque stadi ha i suoi disegni, e si muove in modo diverso: la piccola rimbalza leggera e veloce, il serpente adulto si muove lento e pesante.

`/narsil nivel` ("livello") ti dice a che punto è, lo stadio e come guadagna XP.

Gli XP sono un unico numero per tutta la macchina. Sopravvivono alla chiusura di Claude Code, e ogni conversazione aperta si aggiunge allo stesso totale. È un piccolo ciclo di ricompensa senza effetto sul lavoro di Claude: cambia solo l'aspetto di Narsil.

## Come funziona dentro

### Le regole: `hooks/xp.ts`

Tutta l'aritmetica vive in `hooks/xp.ts`, come funzioni pure su numeri semplici. Il file lo dice nel suo primo commento: "the hooks module owns the store and the events" (il modulo degli hook possiede lo store e gli eventi). Questa separazione rende le regole facili da testare senza un motore.

I guadagni sono una tabella, `XP_GAIN`:

| Motivo  | XP  | Quando                                                |
| ------- | --- | ----------------------------------------------------- |
| `turn`  | 10  | un turno della conversazione principale risponde      |
| `tests` | 5   | un comando di test viene eseguito senza errore        |
| `agent` | 3   | il turno proprio di un subagente finisce con `answer` |

I livelli diventano più difficili in modo lineare. `levelOf` parte dal livello 1 e sottrae `level * 100` finché può: il livello 1 ha bisogno di 100 XP per arrivare al livello 2, il livello 2 di altri 200, il livello 3 di altri 300, e così via. Restituisce il livello, gli XP raccolti in questo livello (`into`) e gli XP di cui questo livello ha bisogno (`needed`), che è esattamente ciò che stampa l'etichetta.

Gli stadi sono una seconda tabella, `STAGE_FROM = [1, 5, 10, 20, 35]`: il primo livello di ogni stadio. `stageOf(level)` conta quanti di questi il livello ha raggiunto. Quindi:

| Stadio                      | Livelli       | XP totali per arrivarci |
| --------------------------- | ------------- | ----------------------- |
| 1 (appena uscita dall'uovo) | da 1 a 4      | 0                       |
| 2                           | da 5 a 9      | 1.000                   |
| 3                           | da 10 a 19    | 4.500                   |
| 4                           | da 20 a 34    | 19.000                  |
| 5                           | dal 35 in poi | 59.500                  |

I totali derivano dalla regola: raggiungere il livello L richiede 100 × (1 + 2 + … + (L − 1)) XP. A 10 XP per turno, la piccola diventa stadio 2 dopo circa un centinaio di turni finiti, e lo stadio 5 è molto lontano. Il README enuncia le stesse regole in spagnolo.

`xpOf` legge un valore salvato "from any version, or none" (da qualsiasi versione, o nessuna): tutto ciò che non è un numero finito positivo conta come 0, e una frazione viene arrotondata per difetto. Uno store rotto o mancante fa quindi ripartire Narsil da zero invece di rompere la fascia.

### Da dove vengono gli XP

`gainXp($, reason)` in `hooks/register.tsx` viene chiamata da quattro punti, in tre eventi:

- **`turn.complete`**, conversazione principale, quando il turno finisce con `answer`. Due rami la chiamano: la fine normale ("He terminado", "ho finito") e una fine che pone una domanda nella casella del prossimo passo dell'app desktop. Un turno che finisce mentre del lavoro in background è ancora in corso non guadagna ancora XP: il turno che risveglia la sessione quando quel lavoro riporta è quello che finisce, e li guadagna. Un turno che fermi tu (`aborted`) o che fallisce non guadagna niente.
- **`tool.call`**, quando il comando corrisponde a `TEST_COMMAND` (in `hooks/words.ts`: `npm test`, `pnpm test`, `vitest`, `pytest`, `cargo test`, `claude plugin test` e altri) e il risultato non ha `isError`. Questo controllo non guarda `e.agentId`, quindi contano anche i test superati di un subagente.
- **`endAgent`**, chiamata da `turn.complete` quando `e.agentId` è impostato e il motivo del subagente è `answer`.

Il test `passing tests and finished subagents earn experience; failures and stopped turns do not` (i test superati e i subagenti finiti guadagnano esperienza; i fallimenti e i turni fermati no) in `tests/narsil.test.tsx` fissa tutto questo.

### Perché vive in `$.store`, e perché viene riletto

Narsil tiene due copie degli XP:

- **`$.store`**, sotto la chiave `xp`. I tipi descrivono lo store come "This plugin's own key-value store, kept between sessions and hot reloads" (lo store chiave-valore proprio di questo plugin, conservato tra le sessioni e i ricaricamenti a caldo), un file JSON proprio del plugin sotto la directory di configurazione di Claude Code. È questo che fa sopravvivere gli XP a una sessione.
- **L'atom `xp`** (`$.state`), che la fascia e la finestra mobile leggono mentre disegnano, così una modifica le ridisegna.

A `session.start`, Narsil copia il valore salvato nell'atom. Poi ogni guadagno fa questo:

```tsx
const before = xpOf(await $.store.get(XP_KEY).catch(() => read($, xp)))
const after = before + XP_GAIN[reason]
await $.store.set(XP_KEY, after).catch(() => undefined)
await update($, xp, () => after)
```

Il commento sopra dà il motivo per leggere prima lo store invece di fidarsi dell'atom: "another open conversation may have added to it since" (un'altra conversazione aperta potrebbe averci aggiunto qualcosa nel frattempo). Lo store è condiviso da tutte le conversazioni del plugin, mentre ogni conversazione ha il proprio atom. Sommare all'atom sovrascriverebbe i guadagni fatti da un'altra finestra da quando questa è partita. Il test `another conversation’s experience is added to, never overwritten` (all'esperienza di un'altra conversazione si aggiunge, non la si sovrascrive mai) imposta lo store a 50 alle spalle della conversazione e si aspetta 60 dopo un turno.

Rileggere riduce la finestra in cui si perdono guadagni; non è un lock. Due conversazioni che guadagnano XP nello stesso istante possono comunque leggere entrambe lo stesso `before`.

Se lo store fallisce, il guadagno arriva comunque all'atom (`.catch(() => read($, xp))` e `.catch(() => undefined)`), così la fascia continua a contare per questa sessione.

### I festeggiamenti: l'atom `milestone`

Quando `after` supera un livello, `gainXp` confronta gli stadi prima e dopo e scrive l'atom `milestone`: `{ kind: 'level' | 'grew', level, stage, at }`. Il suo tipo, `(Milestone & { at: number }) | null`, è dichiarato in `types/index.d.ts`. Inoltre:

- scrive una riga di log con `$.ui.log`: "🌊 Narsil ha crecido: nivel 5, etapa 2 de 5." ("Narsil è cresciuta: livello 5, stadio 2 di 5.") o "⭐ Narsil ha subido al nivel 3." ("Narsil è salita al livello 3.");
- sostituisce il suo commento nella fascia tramite `setMood`, mantenendo l'umore e il dettaglio attuali.

Il disegno legge la milestone. `sprite(mood, stage, milestone)` in `hooks/sprite.ts` aggiunge:

- per un livello, `behind` disegna un bagliore radiale dorato, e `celebration` disegna due anelli che si espandono, sette stelle e uno striscione `NIVEL <n>`;
- per uno stadio, un lampo bianco, cinque scintille, dodici raggi di luce e uno striscione `¡ETAPA <n>!`, con l'immagine avvolta in un'animazione `evolve` che la scala da metà dimensione alla sua nuova forma.

Mentre una milestone è visibile, il piccolo badge di stato vicino alla sua testa viene tolto, così i due non si contendono lo stesso spazio.

Il battito (`beat`, ogni 2 secondi) cancella la milestone una volta passato `MILESTONE_MS`: 6 secondi per un livello, 9 per uno stadio. Un timer per ogni festeggiamento sarebbe stato più semplice da scrivere, ma il battito esiste già, e un timer di `$.clock` si perde con un ricaricamento della mod.

Nella fascia, il festeggiamento viene disegnato solo quando la conversazione che Narsil mostra è questa (`isOwnTop`): quando un'altra conversazione è più importante, l'immagine appartiene a lei.

### Cosa cambia lo stadio

`stageOf(levelOf(xp).level)` viene calcolato ovunque si crei un'immagine:

- **Il disegno.** `art` in `hooks/sprite.ts` sceglie la posa disegnata per quello stadio e tema, ripiegando sulla posa base dello stadio, e poi su uno stadio precedente, quando ne manca una. I loop animati di ogni stadio vengono dal task registrato in `odd/tasks/animated-poses.md`; la seconda guida di questo percorso tratta il disegno.
- **Il movimento.** `STAGE_MOTION` scala quanto lontano e quanto veloce si muove: ampiezza 1.15 e tempo 0.9 per la piccola, fino a 0.6 e 1.4 per lo stadio 5.
- **Tutto ciò che sta fuori dalla fascia.** La finestra dei consigli riceve `NARSIL_STAGE`; gli avvisi sul telefono usano `phoneIcon(kind, stage)`, un PNG di lei a quello stadio preso dal repository; il topic `-estado` invia l'etichetta `xp` e l'URL `art` (guida 15).

## Come è stata chiesta all’IA

La richiesta originale per esperienza e livelli non è stata registrata. I log pubblici dei task del progetto iniziano più tardi.

Una richiesta successiva tocca gli stadi: in `odd/tasks/animated-poses.md`, L4 (2026-11-15), dopo il primo loop animato, l'autore ha risposto:

> "si me agrada, vamos a cambiar todos"

In italiano: sì, mi piace, cambiamoli tutti. Il log del task la trasforma in S6: ogni posa "at every stage 1-5, light and dark: 60 loops" (a ogni stadio 1-5, chiaro e scuro: 60 loop).

### Ricostruzione dalla cronologia dei commit

Da `git log -- hooks/xp.ts` e dai commit collegati:

- `8913cdd` (2026-10-30) "feat: let Narsil earn experience and levels kept across sessions" (fa guadagnare a Narsil esperienza e livelli conservati tra le sessioni). XP, livelli e store arrivano insieme.
- `9bfa039` (2026-10-30) "feat: let Narsil grow through five stages as she levels up" (fa crescere Narsil in cinque stadi man mano che sale di livello). Lo stesso giorno, gli stadi.
- `7a964d1` (2026-10-30) "feat: draw Narsil as a hatchling at stage 1 and split the art per stage" (disegna Narsil appena uscita dall'uovo allo stadio 1 e divide i disegni per stadio), seguito il 2026-10-31 da un commit per stadio e tema (`6b96e08`, `e029cf0`, `ff02847`, `6a1ceb3`, `4055242`, `b7361a0`, `5ef599a`, `eed13b0`).
- `2cf7133` (2026-10-31) "feat: celebrate a new level and a new stage with their own animations" (festeggia un nuovo livello e un nuovo stadio con animazioni proprie). L'atom `milestone` e i due festeggiamenti.
- `fcd68c7` (2026-10-31) "feat: move Narsil by her stage, with a shadow, splashes, a softer tremble and cheap glows" (muove Narsil secondo il suo stadio, con un'ombra, schizzi, un tremito più morbido e bagliori economici). `STAGE_MOTION`.
- Dal 2026-11-15 al 2026-11-16, i loop animati di ogni stadio (da `2f08c55` a `673fc9f`), il task citato sopra.

L'ordine dice molto: prima i numeri, poi gli stadi che rendono visibili i numeri, poi un'immagine per stadio, poi i festeggiamenti, poi il movimento. Ogni passo rende la ricompensa più facile da notare.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nella mia mod di Claude Code `my-pet`, dai esperienza alla mascotte. Metti le regole in un modulo puro `hooks/xp.ts`: 10 XP per ogni turno finito della conversazione principale (`turn.complete` con `reason === 'answer'` e senza `agentId`), 5 quando un comando di test (`npm test`, `pnpm test`, `vitest`, `pytest`) ritorna senza `isError` in `tool.call`, 3 quando il `turn.complete` di un subagente finisce con `answer`. Il livello 1 ha bisogno di 100 XP, ogni livello successivo di 100 in più del precedente; gli stadi iniziano ai livelli 1, 5, 10, 20 e 35. Tieni il totale in `$.store` sotto `xp` così sopravvive alle sessioni, e prima di ogni guadagno rileggi lo store, dato che altre conversazioni ci aggiungono. Rispecchialo in un atom per il disegno. A un nuovo livello scrivi un atom `milestone` con l'ora, mostra "Level N" nella fascia `AbovePrompt` per 6 secondi (9 per un nuovo stadio) e registralo con `$.ui.log`. Testa con `claude-code/testing`: un turno a 95 XP mostra il livello 2, e a uno store modificato alle spalle della conversazione si aggiunge, non lo si sovrascrive.

## Il codice minimo

Scritto per questa guida e verificato con i tipi della 2.1.325 (`$.store.get`, `$.store.set`, `$.clock.now`, `$.ui.log`, `session.start`, `tool.call`, `turn.complete`, `ui.render`). È adattato da `hooks/xp.ts` e `hooks/register.tsx` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). Gli atom sono dichiarati in `types/index.d.ts` come nella prima guida: `xp: number` e `milestone: { kind: 'level' | 'grew'; level: number; at: number } | null`.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const GAIN = { turn: 10, tests: 5, agent: 3 } as const
const STAGE_FROM = [1, 5, 10, 20, 35]
const SHOWN_MS = { level: 6000, grew: 9000 } as const
const TESTS = /\b(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?test|vitest|jest|pytest)\b/

const xp = atom({ plugin: 'my-pet', key: 'xp' } as const, 0)
const milestone = atom({ plugin: 'my-pet', key: 'milestone' } as const, null)

function levelOf(total: number) {
  let level = 1
  let left = Math.max(0, Math.floor(total))
  while (left >= level * 100) {
    left -= level * 100
    level += 1
  }
  return { level, into: left, needed: level * 100 }
}
const stageOf = (level: number) => STAGE_FROM.filter((from) => level >= from).length || 1
const xpOf = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0

async function gain($: EngineInterface, reason: keyof typeof GAIN): Promise<void> {
  // Read the store again: another conversation may have added to it.
  const before = xpOf(await $.store.get('xp').catch(() => read($, xp)))
  const after = before + GAIN[reason]
  await $.store.set('xp', after).catch(() => undefined)
  await update($, xp, () => after)
  const was = levelOf(before).level
  const level = levelOf(after).level
  if (level === was) return
  const kind = stageOf(level) > stageOf(was) ? ('grew' as const) : ('level' as const)
  const at = await $.clock.now()
  await update($, milestone, () => ({ kind, level, at }))
  $.ui.log(kind === 'grew' ? `My pet has grown: level ${level}` : `My pet reached level ${level}`)
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    const stored = xpOf(await $.store.get('xp').catch(() => 0))
    await update($, xp, () => stored)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const command = (e as { command?: unknown }).command
    const result = await next(e)
    if (typeof command === 'string' && TESTS.test(command) && !result.isError)
      await gain($, 'tests')
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.reason === 'answer') await gain($, e.agentId === undefined ? 'turn' : 'agent')
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { level, into, needed } = levelOf(await read($, xp))
    const shown = await read($, milestone)
    const isFresh = shown !== null && (await $.clock.now()) - shown.at < SHOWN_MS[shown.kind]
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" gap={1} minWidth={0}>
        <Text dimColor>{`⭐ Level ${level} · ${into}/${needed} XP · stage ${stageOf(level)}`}</Text>
        {isFresh ? (
          <Text bold color="#F5B400">
            {shown.kind === 'grew' ? 'I have grown!' : 'Level up!'}
          </Text>
        ) : null}
      </Box>
    )
  })
}
```

Due semplificazioni rispetto a Narsil. La fascia controlla l'età della milestone quando disegna, quindi il festeggiamento se ne va al primo ridisegno dopo il suo tempo; Narsil cancella l'atom nel suo battito, che ridisegna in tempo. E questa versione conta ogni turno di subagente che risponde, mentre Narsil conta un subagente una sola volta, tramite il proprio registro dei subagenti in esecuzione.

## Errori comuni e come testarlo

- **Tenere gli XP solo in un atom.** `$.state` sopravvive a un ricaricamento della mod, non a una nuova sessione. Tutto ciò che deve durare va in `$.store`.
- **Riscrivere nello store il valore dell'atom.** Con due conversazioni aperte, ogni atom resta indietro rispetto ai guadagni dell'altra. Leggi lo store, somma, scrivi.
- **Fidarsi di un valore salvato.** Uno store modificato a mano, o scritto da una versione più vecchia, può contenere qualsiasi cosa. Validalo (`xpOf`) e ripiega su zero.
- **Premiare il fallimento.** Assegna il turno solo con `answer`, e i test solo senza `isError`; un turno interrotto non guadagna niente.
- **Festeggiare per sempre.** Una milestone ha bisogno di un'ora di fine e di qualcosa che ridisegni quando passa.
- **Livelli che non arrivano mai.** Controlla la tua curva con i numeri prima di pubblicarla. Con quella di Narsil, lo stadio 5 richiede 59.500 XP, cioè diverse migliaia di turni.

Per testare, i test in `tests/narsil.test.tsx` avviano la mod con uno store impostato in anticipo e lo rileggono. Da leggere: "Narsil keeps her experience across sessions, and celebrates a new level" (Narsil conserva la sua esperienza tra le sessioni, e festeggia un nuovo livello) (95 XP più un turno mostrano "⭐ Nivel 2 · 5/200 XP" e "¡He subido al nivel 2! ⭐"), "Narsil grows at levels 5, 10, 20 and 35, and says so" (Narsil cresce ai livelli 5, 10, 20 e 35, e lo dice), "a new level plays its own celebration for a while, in the band and the window" (un nuovo livello mostra il proprio festeggiamento per un po', nella fascia e nella finestra) e "levels need 100, 200, 300 XP more each, and odd stored values count as none" (i livelli richiedono 100, 200, 300 XP in più ciascuno, e i valori salvati strani contano come nessuno). "the celebrations stay within the Svg size limit at every stage" (i festeggiamenti restano entro il limite di dimensione di Svg a ogni stadio) protegge qualcosa di facile da dimenticare: un festeggiamento si aggiunge a un'immagine che ha già il suo limite di dimensione.

## Per andare oltre

- `xpLabel` in `hooks/xp.ts` è l'unico punto in cui viene scritta l'etichetta, così la fascia, la finestra mobile e lo stato del telefono dicono la stessa cosa.
- `banner`, `behind` e `celebration` in `hooks/sprite.ts` disegnano i festeggiamenti come SVG sopra l'immagine.
- `artUrl` in `hooks/phone.ts` costruisce l'indirizzo della sua immagine a ogni stadio per il telefono, così come il repository la pubblica sotto `assets/`.
- La guida successiva, la modalità silenziosa, mostra come Narsil resta in silenzio senza perdere ciò che conta; un festeggiamento è una delle cose che si vedono ancora, dato che viene solo disegnato.
