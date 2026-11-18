---
title: Classificare gli aggiornamenti
description: 'Come Narsil Check ordina ogni libreria non aggiornata in Bloccata, Versione major, Solo alzare la versione o Fuori dall’SDK di Expo, e perché le risposte dei registry si tengono sei ore.'
route: check
order: 7
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/semver.ts
  - repo: check
    path: hooks/npm.ts
  - repo: check
    path: hooks/words.ts
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/upgrade.test.tsx
  - repo: check
    path: odd/tasks/release-age-all-ecosystems.md
---

## Cosa fa

Un elenco di cinquanta librerie non aggiornate non è utile di per sé. Quello che vuoi sapere è quali puoi alzare subito senza pensarci, quali vanno lette e quali non dovresti ancora toccare. La sezione **Actualizaciones** risponde mettendo ogni libreria non aggiornata in uno di quattro gruppi, disegnati in questo ordine:

| Gruppo (etichetta nel pannello)  | In italiano                         | Suggerimento sotto l'intestazione               | Colore |
| -------------------------------- | ----------------------------------- | ----------------------------------------------- | ------ |
| `Fuera del SDK de Expo`          | Fuori dall'SDK di Expo              | `npx expo install --fix`                        | blu    |
| `Bloqueada`                      | Bloccata                            | `no se puede subir sola: el motivo está debajo` | rosso  |
| `Versión mayor: revisar cambios` | Versione major: rivedi le modifiche | `pueden romper la API`                          | giallo |
| `Solo subir la versión`          | Solo alzare la versione             | `parche o menor`                                | verde  |

I suggerimenti significano "non può salire da sola: il motivo è sotto", "possono rompere l'API" e "patch o minor". Le etichette e i suggerimenti vengono da `GROUPS` in `hooks/words.ts`.

Ogni gruppo ha un'intestazione che lo chiude, come `▾ Bloqueada (2)`, e il pannello ricorda quali hai chiuso. Sotto ogni riga c'è una seconda riga dove conta: in **Bloqueada**, tutto ciò che la blocca, in rosso; in **Versión mayor**, la lettura di Haiku su quanto è difficile il salto. Solo **Solo subir la versión** ha un pulsante, **Actualizar las N** ("Aggiorna le N"), e non prende mai una libreria da un altro gruppo.

Le librerie aggiornate non compaiono. La riga sotto l'intestazione della sezione conta le altre, nell'ordine dei gruppi:

```text
6 para actualizar de 31 · 2 bloqueadas · 2 mayores · 2 triviales
```

Cioè "6 da aggiornare su 31 · 2 bloccate · 2 major · 2 banali". Con niente da fare dice `Todo al día · 31 librerías revisadas` ("Tutto aggiornato · 31 librerie controllate").

Il punto colorato della sezione dice il gruppo più urgente presente: rosso se qualcosa è bloccato, altrimenti giallo per una major, altrimenti blu per Expo, altrimenti verde.

## Come funziona dentro

### Il tipo: quattro gruppi e un elenco di motivi

`types/index.d.ts` definisce il gruppo come un'unione, `'bump' | 'review' | 'expo' | 'blocked'`, e ogni `Upgrade` ne porta uno, con il suo `bump` (`'patch' | 'minor' | 'major'`) e `conflicts: string[]`. I commenti su `Group` dicono ancora che `blocked` è solo per una peer dependency; il codice e il README ora gli danno più motivi (sotto).

Il design separa due domande. `bump` è quanto sono distanti le versioni, un fatto. `group` è cosa dovrebbe fare la persona, una decisione che può cambiare man mano che si sa di più. Una patch può essere `blocked`; una major è `review` a meno che qualcosa non la blocchi.

### Passo 1: quanto è grande il salto

Ogni ecosistema inizia allo stesso modo, con `bumpOf(installed, latest)` da `hooks/semver.ts`:

```ts
export function bumpOf(from: Version, to: Version): Bump {
  if (compare(to, from) <= 0) return 'none'
  if (to.major !== from.major) return 'major'
  if (to.minor !== from.minor) return from.major === 0 ? 'major' : 'minor'
  if (to.patch !== from.patch) return from.major === 0 && from.minor === 0 ? 'major' : 'patch'
  return 'patch'
}
```

È citato da [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). `none` significa aggiornata (o il latest del registry è più vecchio di quello che hai) e la libreria resta fuori. Altrimenti `major` va in `review` e `patch` o `minor` in `bump`.

### Versioni sotto 1.0.0

Le due righe centrali portano la regola che enuncia il commento: "Below 1.0.0 a minor is a breaking change (0.3 -> 0.4) and below 0.1.0 so is a patch, as npm's caret ranges treat them." (sotto 1.0.0 una minor è una modifica che rompe, 0.3 -> 0.4, e sotto 0.1.0 lo è anche una patch, come le trattano gli intervalli con accento circonflesso di npm).

Segue la convenzione stessa del versionamento semantico per cui 0.x è instabile, e il `^` di npm la legge allo stesso modo: `^0.3.2` accetta `0.3.9` ma non `0.4.0`, e `^0.0.3` non accetta niente se non `0.0.3`. Se il pannello chiamasse minor il passaggio da 0.3 a 0.4, il pulsante di aggiornamento alzerebbe attraverso una modifica che l'autore stesso del pacchetto ha segnato come incompatibile. I test fissano tutti e tre i casi: `0.3.1 → 0.4.0` è major, `0.3.1 → 0.3.2` è una patch, `0.0.3 → 0.0.4` è major.

Il README enuncia solo la prima metà: "un salto de minor por debajo de 1.0.0" ("un salto di minor sotto 1.0.0"). La regola della patch sotto 0.1.0 è nel codice e nei test, non nel README.

`bumpOf` è condiviso, quindi la regola vale per ogni ecosistema, compresi quelli i cui strumenti leggono 0.x in modo diverso.

### Passo 2: npm e l'SDK di Expo

Un'app Expo fissa i moduli nativi con cui è costruito ogni SDK, in `bundledNativeModules.json`. Installarne uno più recente di quanto permette quella tabella rompe la build nativa, quindi in un progetto Expo "the table wins over npm" (la tabella vince su npm). `upgradeOf` in `hooks/npm.ts` la controlla prima di tutto:

- **La versione installata è fuori dall'intervallo dell'SDK**: l'aggiornamento va in `expo`, con l'intervallo dell'SDK come obiettivo. È il gruppo **Fuera del SDK de Expo**, e il suo suggerimento è il comando che lo sistema.
- **La versione installata è dentro l'intervallo, e npm ne ha una più recente**: la risposta è `'held'`, non un aggiornamento. Viene contata, non elencata, e una nota dice che quelle librerie "tienen versión nueva en npm, pero el SDK de Expo la fija: se suben con el SDK" ("hanno una versione nuova su npm, ma l'SDK di Expo la fissa: salgono con l'SDK").

La tabella viene da `node_modules/expo/bundledNativeModules.json` quando è installato, altrimenti da `https://unpkg.com/expo@<version>/bundledNativeModules.json` per la versione di Expo installata. Il pacchetto `expo` stesso non viene mai giudicato dalla propria tabella.

### Passo 3: qualsiasi cosa la blocchi

Per ultimo, qualsiasi aggiornamento che ha un motivo per non salire da solo passa a `blocked`, qualunque sia il suo salto. I motivi vengono tenuti come parole in `conflicts`, e quelle parole sono ciò che il pannello stampa sotto la riga.

Per npm (`scanNpm`), i motivi sono le peer dependency e i pin della prossima guida, più l'attesa di 24 ore. Per ogni altro ecosistema (`scanGeneric`):

- **Un commento che tiene la versione apposta**, trovato da `holdNote`: `Fijada a propósito: «…»` ("Fissata apposta"), con il commento stesso.
- **Ciò che l'ecosistema sa di rompere**, dal `conflictsOf` dell'adattatore: Kotlin e i suoi plugin del compilatore, l'Android Gradle Plugin e il wrapper di Gradle, un pacchetto Swift fissato a una sola versione esatta.
- **L'attesa di 24 ore**: una versione pubblicata meno di un giorno fa, come `Publicada hace 3 h: Narsil Check espera 24 h antes de subirla` ("Pubblicata 3 h fa: Narsil Check aspetta 24 h prima di alzarla").

L'attesa copre anche il gruppo di Expo: la versione a cui si risolve l'intervallo dell'SDK viene trattenuta per lo stesso giorno, e un aggiornamento di Expo ancora in attesa passa a `blocked` con il comando nel suo motivo.

L'ordine conta per un motivo: `blocked` viene deciso per ultimo, quindi prevale su tutto. Una patch banale che un plugin rifiuta non è banale.

### Dove viene disegnato

L'hook `ui.render` disegna `GROUPS` in ordine, filtrando `state.upgrades` per `u.group`; dentro un gruppo, un aggiornamento che corregge vulnerabilità note va per primo. La seconda riga di una riga bloccata è `u.conflicts.join(' · ')` in rosso. `sortUpgrades` ordina l'elenco per gruppo, poi le dependencies prima delle devDependencies, poi per nome.

### La cache di sei ore

Chiedere a ogni registry ogni libreria a ogni avvio di sessione sarebbe lento e metterebbe un carico reale sui registry pubblici per risposte che cambiano di rado. `latestIn` in `hooks/register.tsx` tiene ogni risposta:

```ts
// A registry answer is reused for this long, across sessions and projects.
const CACHE_MS = 6 * 60 * 60 * 1000
```

```ts
const key = `${adapter.id}:${name}`
const cached = (await $.store.get(key)) as Cached | undefined
if (!isFresh && cached && Date.now() - cached.at < CACHE_MS) return cached.version
```

Entrambi sono citati da [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Dopo un fetch, la risposta viene riscritta con `$.store.set(key, { version, at: Date.now() })`.

**Dove viene salvata.** `$.store` è, con le parole dei tipi della 2.1.325, "This plugin's own key-value store, kept between sessions and hot reloads" (l'archivio chiave-valore proprio di questo plugin, mantenuto tra le sessioni e i ricaricamenti a caldo), "A JSON file of the plugin's own under the user's Claude Code configuration directory" (un file JSON proprio del plugin sotto la cartella di configurazione di Claude Code dell'utente). Ecco perché il commento dice "across sessions and projects" (tra sessioni e progetti): la chiave è l'ecosistema e il nome del pacchetto (`npm:react`), non il progetto, quindi un secondo progetto che usa react riusa la risposta. I tipi dicono anche che `set` rifiuta "a store over 4 MiB of JSON text in all" (un archivio oltre 4 MiB di testo JSON in totale), un limite che condividono tutte le chiavi della mod.

**Quando viene saltata.** `isFresh` viene impostato da **Revisar de nuevo** ("Controlla di nuovo"), da `/narsil-check upgrade`, dopo il pulsante di aggiornamento, dopo il pulsante della pull request e dopo un pull del branch riuscito. Un'analisi fresca interroga di nuovo ogni registry e scrive le risposte nuove. L'analisi all'avvio della sessione non è fresca, quindi usa ciò che ha meno di sei ore. Il README dice lo stesso: "Cada respuesta se guarda 6 horas, y el botón **Revisar de nuevo** fuerza una consulta nueva" ("Ogni risposta si tiene 6 ore, e il pulsante **Revisar de nuevo** forza una nuova richiesta").

**Perché sei ore.** Né il codice, né il README, né i commit danno un motivo per il numero; `CACHE_MS` è di sei ore fin dal primo commit, `1bf736a`. Leggendo il compromesso: una cache più breve interrogherebbe ogni registry quasi a ogni avvio di sessione, e una più lunga nasconderebbe una release per la maggior parte di una giornata di lavoro. Sei ore sono meno dell'attesa di 24 ore, quindi una release che la cache nasconde per un po' non sarebbe comunque potuta salire in quel tempo. Questo ragionamento è un'interpretazione, non una decisione registrata.

**Cosa si tiene invece per sempre.** Alcune risposte non cambiano mai una volta pubblicata una versione, quindi la mod le tiene senza timer: le peer dependency di una versione (`peers:<name>@<version>`), la sua data di pubblicazione (`published:…`, solo quando è una data valida) e la lettura di una major da parte di Haiku (`why:…`).

## Come è stata chiesta all’IA

La richiesta originale per i quattro gruppi non è stata registrata: sono già nel primo commit, e nessun log di task pubblico li copre. I motivi di **Bloqueada** sono cresciuti dopo, e uno di essi è registrato con le parole dell'autore.

### Registrato: l'attesa di 24 ore in ogni ecosistema

`odd/tasks/release-age-all-ecosystems.md`, voce di log L1 (2026-11-06), cita l'autore. Il primo messaggio chiedeva di framework diversi da Expo:

> "Y el cuánto a expo, pasa igual con frameworks como kmp o alguno de los otros lenguajes? Tenemos que pensar en ellos?"

In italiano: "E quanto a Expo, succede lo stesso con framework come KMP o qualcuno degli altri linguaggi? Dobbiamo pensarci?" Poi:

> "El primero me interesa, deberíamos implementar algo similar para los otros lenguajes, es más seguro"

In italiano: "Il primo mi interessa; dovremmo implementare qualcosa di simile per gli altri linguaggi, è più sicuro." E poi: "24 horas está perfecto" ("24 ore va benissimo").

S4 dello stesso log cita una regola precedente dell'autore, mantenuta da una correzione precedente:

> "siempre que haya minimumReleaseAge se bloquee la actualizacion automatica y se marque el bloqueo, sin excepcion alguna"

In italiano: "ogni volta che c'è un minimumReleaseAge, si blocchi l'aggiornamento automatico e si segnali il blocco, senza nessuna eccezione." Ecco perché nessun elenco di esclusioni conta da nessuna parte, e perché blocca anche una data che non si riesce a leggere.

Una correzione è arrivata lo stesso giorno. L7 cita la domanda dell'autore:

> "que pasa si una version siempre trae fecha ilegible? nunca la vamos a actualizar?"

In italiano: "cosa succede se una versione arriva sempre con una data illeggibile? non la aggiorneremo mai?" Il log del task registra la proposta accettata ("si hazlo asi", "sì, fallo così"): una versione del genere aspetta 24 ore da quando la mod l'ha vista per la prima volta. Quel ripiego e il resto del design sono la proposta dell'agente, scritta nel log; le parole dell'autore sono la domanda e il "si".

### Ricostruzione dalla cronologia dei commit

Da `git log -- hooks/semver.ts hooks/words.ts` e `git log -S` sulle etichette dei gruppi, in narsil-check:

- `1bf736a` (2026-11-04) "feat: add upgrade panel for npm and Expo projects" (aggiunge un pannello di aggiornamenti per progetti npm ed Expo). Il suo messaggio: il pannello "lists the project's outdated libraries by how hard each upgrade is" (elenca le librerie non aggiornate del progetto secondo quanto è difficile ogni aggiornamento). I quattro gruppi, `bumpOf` con la regola dello 0.x e `CACHE_MS` sono già tutti qui. Il gruppo bloccato allora era etichettato `Bloqueada por otras dependencias` ("Bloccata da altre dipendenze"), con i colori semplici del terminale (rosso, magenta, giallo, verde).
- `4ea9be0` (2026-11-04) "feat: block upgrades kept on purpose and Kotlin past its compiler plugins" (blocca gli aggiornamenti tenuti apposta e Kotlin oltre i suoi plugin del compilatore). Il suo messaggio: "The blocked group is now just Bloqueada, since a dependency is no longer its only reason." (il gruppo bloccato ora è solo Bloqueada, perché una dipendenza non è più il suo unico motivo).
- `690c1bb` (2026-11-06) "feat: block upgrades pnpm would refuse under minimumReleaseAge" (blocca gli aggiornamenti che pnpm rifiuterebbe sotto minimumReleaseAge), poi `54ac6aa` (2026-11-06) "fix: block every upgrade under pnpm's minimumReleaseAge, with no exceptions" (blocca ogni aggiornamento sotto il minimumReleaseAge di pnpm, senza eccezioni).
- `1492ca5` (2026-11-06) "feat: hold every ecosystem's upgrades for 24 hours after release" (trattiene gli aggiornamenti di ogni ecosistema per 24 ore dopo la release), e `ca13b3c` (2026-11-06) "feat: hold Expo SDK-pinned versions for 24 hours too" (trattiene per 24 ore anche le versioni fissate dall'SDK di Expo).
- `54cd243` (2026-11-06) "feat: let a version with no readable date go up a day after it was first seen" (lascia salire una versione senza data leggibile un giorno dopo che è stata vista per la prima volta). La correzione di L7.

Lo schema: i gruppi erano giusti fin dall'inizio, e ciò che è cambiato è il significato di **Bloqueada**, da "un'altra dipendenza la rifiuta" a "qualsiasi cosa sappiamo che renda insicuro alzarla da sola".

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nella mia mod di Claude Code `my-panel`, ho un elenco di librerie npm non aggiornate, ciascuna con la versione installata e la più recente. Ordinale in gruppi: `blocked` (un elenco di motivi a parole non è vuoto), `review` (un salto major), `bump` (una patch o una minor). Scrivi `bumpOf(from, to)` come funzione pura: none, patch, minor o major, dove sotto 1.0.0 una minor conta come major e sotto 0.1.0 anche una patch, come le leggono gli intervalli con accento circonflesso di npm. Decidi `blocked` per ultimo così prevale sugli altri. Disegna i gruppi nell'ordine blocked, review, bump, ciascuno con un'intestazione comprimibile `▾ Label (N)` e una riga di suggerimento, e i motivi sotto una riga bloccata in rosso. Solo il gruppo bump riceve un pulsante "Aggiorna tutto". Metti in cache ogni risposta del registry in `$.store` sotto `npm:<name>` con l'ora, riusala per sei ore e salta la cache quando la persona preme "Controlla di nuovo". Testa `bumpOf` con casi 0.x e la cache con `mock.clock`.

## Il codice minimo

Questa è una versione ridotta dell'idea, scritta per questa guida e verificata con i tipi di Claude Code 2.1.325. È adattata da `hooks/semver.ts`, `hooks/npm.ts` e `hooks/register.tsx` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Lascia fuori Expo e i motivi stessi; `reasons` è qualsiasi cosa abbiano trovato i tuoi controlli.

```ts
import type { EngineInterface } from 'claude-code'

type V = { major: number; minor: number; patch: number }
export type Group = 'blocked' | 'review' | 'bump'

export function parse(text: string): V | undefined {
  const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(text.trim())
  return m ? { major: +m[1], minor: +(m[2] ?? 0), patch: +(m[3] ?? 0) } : undefined
}

export function bumpOf(from: V, to: V): 'none' | 'patch' | 'minor' | 'major' {
  const d = to.major - from.major || to.minor - from.minor || to.patch - from.patch
  if (d <= 0) return 'none'
  if (to.major !== from.major) return 'major'
  if (to.minor !== from.minor) return from.major === 0 ? 'major' : 'minor'
  return from.major === 0 && from.minor === 0 ? 'major' : 'patch'
}

export function groupOf(from: V, to: V, reasons: string[]): Group | undefined {
  const bump = bumpOf(from, to)
  if (bump === 'none') return undefined
  if (reasons.length > 0) return 'blocked'
  return bump === 'major' ? 'review' : 'bump'
}

const CACHE_MS = 6 * 60 * 60 * 1000
type Cached = { version: string; at: number }

export async function latest(
  $: EngineInterface,
  name: string,
  isFresh: boolean,
): Promise<string | undefined> {
  const key = `npm:${name}`
  const cached = (await $.store.get(key)) as Cached | undefined
  if (!isFresh && cached && Date.now() - cached.at < CACHE_MS) return cached.version
  const res = await $.http.fetch(`https://registry.npmjs.org/${name.replace('/', '%2F')}/latest`, {
    headers: { accept: 'application/json' },
  })
  const version = res.ok ? (JSON.parse(res.text) as { version?: string }).version : undefined
  if (version) await $.store.set(key, { version, at: Date.now() } satisfies Cached)
  return version
}
```

Chiama `latest` per ogni dipendenza dichiarata da un'analisi che nessun hook attende mai, poi `groupOf` con la versione installata e i motivi trovati dai tuoi controlli, e tieni l'elenco in un atom. Nel pannello, disegna un blocco comprimibile per gruppo nell'ordine di `Group`, e il pulsante **Update all** solo sotto `bump`. Il `parse` ridotto ignora le prerelease e le quarte parti, che gestisce `hooks/semver.ts`.

## Errori comuni e come testarlo

Questi vengono dal codice e dai commit di Narsil Check:

- **Mescolare il salto con la decisione.** Tieni separati `bump` (un fatto) e `group` (cosa fare), così di una patch bloccata si sa ancora che è una patch.
- **Decidere blocked per primo.** Una regola successiva che imposta `review` o `bump` lo annullerebbe. L'analisi npm di Narsil Check ripete persino il ciclo finché nessun gruppo cambia, perché bloccare un aggiornamento può bloccarne uno vicino.
- **Leggere 0.x come 1.x.** `0.3 → 0.4` rompe la compatibilità. Così anche `0.0.3 → 0.0.4`.
- **Una riga bloccata senza motivo.** Il gruppo dice "il motivo è sotto"; una riga vuota rompe quella promessa. Tieni i motivi come parole.
- **Un pulsante che prende tutto.** Deve prendere solo il gruppo `bump`; il test "a blocked upgrade shows what blocks it and the button leaves it out" (un aggiornamento bloccato mostra cosa lo blocca e il pulsante lo lascia fuori) lo controlla.
- **Mettere in cache per progetto.** L'ultima versione di un pacchetto è la stessa in ogni progetto. Usa come chiave l'ecosistema e il nome.
- **Mettere in cache con un timer ciò che non cambia mai.** Le peer e le date di pubblicazione di una versione pubblicata si possono tenere per sempre; le versioni più recenti no.
- **Mettere in cache spazzatura.** Per l'attesa di 24 ore si tiene solo una data valida, così "the next scan asks again" (l'analisi successiva chiede di nuovo).

Per testare, `tests/upgrade.test.tsx` ha "the jump between two versions" (il salto tra due versioni, con i casi 0.x), "each dependency lands in its group" (ogni dipendenza finisce nel suo gruppo), "the Expo SDK table wins over npm for the modules it pins" (la tabella dell'SDK di Expo vince su npm per i moduli che fissa) e "the summary counts each group" (il riepilogo conta ogni gruppo). I test del pannello usano `$.ui.mount` e `ui.press`: "a press on a library copies it, with no copy buttons, and each group folds on its own" (una pressione su una libreria la copia, senza pulsanti di copia, e ogni gruppo si chiude per conto suo). I test dell'età delle release, come "a version younger than minimumReleaseAge says how long it still waits" (una versione più giovane di minimumReleaseAge dice quanto deve ancora aspettare) e "a version whose date nobody can read goes up a day after the mod first saw it, and an answer that is not a date is never kept" (una versione la cui data nessuno sa leggere sale un giorno dopo che la mod l'ha vista per la prima volta, e una risposta che non è una data non viene mai tenuta), coprono i motivi di blocco legati al tempo.

## Per andare oltre

- La prossima guida spiega i motivi di blocco propri di npm: le peer della nuova versione, le peer di ciò che è installato e i pin esatti nell'albero delle dipendenze.
- La riga di Haiku sotto ogni major viene chiesta una volta per salto e tenuta per sempre, così il suo costo non si ripete.
- La costante delle sei ore è una riga. Una mod con meno librerie potrebbe abbassarla; una usata su molti progetti grandi potrebbe alzarla.
