---
title: Dipendenze che si bloccano a vicenda
description: 'Come Narsil Check trova gli aggiornamenti npm che non possono salire da soli: peer chieste dalla nuova versione, peer chieste dai pacchetti installati e pin esatti nell’albero.'
route: check
order: 8
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/npm.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/semver.ts
  - repo: check
    path: hooks/words.ts
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/upgrade.test.tsx
  - repo: check
    path: odd/tasks/ecosystems-wave-2.md
---

## Cosa fa

Alcuni aggiornamenti sembrano banali e non lo sono. eslint da 9.39 a 10 è una major di cui potresti leggere e che potresti accettare, ma se uno dei tuoi plugin di ESLint installati accetta solo eslint 9, l'installazione fallirà oppure lascerà un progetto in cui il lint non funziona. Una patch può essere peggio: alzare un pacchetto che un altro pacchetto fissa a una sola versione esatta lascia installate due copie, e alcuni strumenti si rompono quando vengono caricati due volte.

Narsil Check lo controlla prima di offrire qualsiasi cosa. In un progetto npm, un aggiornamento che uno di questi controlli rifiuta va nel gruppo **Bloqueada** ("Bloccata"), qualunque sia la dimensione del suo salto, con il motivo scritto sotto in rosso. Il pulsante di aggiornamento, **Actualizar las N**, non lo include mai.

I motivi sono frasi, costruite dai dati, nello spagnolo del pannello:

| Motivo nel pannello                                                                    | In italiano                                                                       |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `eslint-plugin-astro 3.2.1 necesita eslint >=10.0.0 (tienes 9.39.5)`                   | La nuova versione ha bisogno di una peer che hai in un'altra versione.            |
| `eslint-config-love exige eslint ^9.35.0`                                              | Un pacchetto installato chiede questo in un intervallo che la nuova lascia fuori. |
| `typescript-eslint 8.71.0 fija @typescript-eslint/parser 8.71.0: quedarían dos copias` | Un pacchetto nell'albero fissa la vecchia versione: resterebbero due copie.       |

"necesita" è "ha bisogno di", "tienes" è "hai", "exige" è "esige", e "fija … quedarían dos copias" è "fissa …, resterebbero due copie". Questi esempi sono quelli del README stesso e dei test, con pacchetti pubblici noti.

Quando un aggiornamento ha più motivi, vengono uniti con `·` sulla stessa riga. Una pressione sulla riga copia la libreria con il suo salto e ciò che la blocca, così puoi incollarla in una conversazione e chiedere come sbrogliarla.

Questi controlli esistono solo per npm. La sezione del README si apre con "Solo en npm" ("solo npm"), e gli altri ecosistemi bloccano per motivi propri (la guida precedente li elenca).

## Come funziona dentro

### Tre controlli, in entrambe le direzioni

La domanda di design era: cosa rende una versione incapace di salire da sola? La risposta in `hooks/npm.ts` sono tre relazioni, lette dai dati e mai indovinate da un modello:

1. **Cosa chiede la nuova versione.** Le sue `peerDependencies`, confrontate con ciò che il progetto ha installato.
2. **Cosa chiedono i pacchetti installati.** Le `peerDependencies` di ogni pacchetto installato su questo, confrontate con la nuova versione.
3. **Cosa fissa l'albero.** Qualsiasi pacchetto nel lockfile che dipende da questo a una sola versione esatta che non è quella nuova.

Le prime due sono le due direzioni della stessa relazione, e servono entrambe: un plugin che passa a richiedere eslint 10 viene preso dalla prima, e un eslint 10 che la tua vecchia configurazione rifiuta viene preso dalla seconda.

### Da dove vengono i dati

Per il primo controllo, il manifest della nuova versione viene scaricato da `https://registry.npmjs.org/<name>/<version>` (`versionUrl`). `targetPeers` in `hooks/register.tsx` tiene la risposta in `$.store` sotto `peers:<name>@<version>` senza scadenza, perché, come dice il suo commento, "A version never changes once published, so its answer is kept for good." (una versione non cambia mai una volta pubblicata, quindi la sua risposta si tiene per sempre).

Per il secondo, il manifest installato di ogni dipendenza dichiarata viene letto da `node_modules/<name>/package.json`. Quando non c'è `node_modules` (un repository appena clonato o creato da un template), `lockedPackage` legge la stessa informazione da `package-lock.json`, o da `pnpm-lock.yaml` tramite `pnpmLocked`. Quel ripiego è arrivato in `24dfeb1`, dopo che un progetto non ancora installato "showed no 'exige' blocks, so eslint and typescript upgrades its plugins refuse looked safe" (non mostrava nessun blocco 'exige', quindi gli aggiornamenti di eslint e typescript che i suoi plugin rifiutano sembravano sicuri).

Un dettaglio che il README non esplicita: il secondo controllo legge le peer delle dipendenze **dichiarate** del progetto, quelle in `package.json`, perché `scanNpm` riempie `installedMap` da quell'elenco. Gli intervalli di peer propri di un pacchetto transitivo non vengono confrontati. Il terzo controllo è quello che arriva a tutto l'albero.

Per il terzo, `pinConflicts` legge la mappa `packages` di `package-lock.json`, che nelle versioni 2 e 3 del lockfile elenca ogni pacchetto installato per percorso, compresi quelli annidati. Il README enuncia la conseguenza: "Esta comprobación usa `package-lock.json`, así que con yarn, pnpm o bun no se hace" ("Questo controllo usa `package-lock.json`, quindi con yarn, pnpm o bun non viene fatto").

### Il controllo delle peer

```ts
export function peerConflicts(
  name: string,
  target: Installed,
  installed: Map<string, Installed>,
): string[] {
  const conflicts: string[] = []
  for (const [peer, range] of Object.entries(target.peers)) {
    const have = installed.get(peer)
    if (have && !satisfies(have.version, range))
      conflicts.push(
        `${name} ${show(target.version)} necesita ${peer} ${range} (tienes ${show(have.version)})`,
      )
  }
  for (const [other, have] of installed) {
    if (other === name) continue
    const range = have.peers[name]
    if (range && !satisfies(target.version, range))
      conflicts.push(`${other} exige ${name} ${range}`)
  }
  return conflicts
}
```

È citato da [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Vi si vedono tre decisioni:

- **Una peer che non hai non è un conflitto.** `have` è `undefined` e non viene aggiunto niente. Il commento: "A peer the project does not have is npm's to add, not a conflict." (una peer che il progetto non ha tocca a npm aggiungerla, non è un conflitto).
- **Gli intervalli si leggono come li legge npm.** `satisfies` da `hooks/semver.ts` gestisce `||`, intervalli con trattino, `^`, `~`, versioni parziali e `*`, così un intervallo di peer come `^8.57.0 || ^9.0.0 || ^10.0.0` viene capito. Un comparatore che non sa leggere conta come soddisfatto, "so an unknown range never raises a false alarm" (così un intervallo sconosciuto non dà mai un falso allarme).
- **Il motivo nomina entrambe le parti.** La prima forma dice di cosa ha bisogno la nuova versione e cosa hai; la seconda dice chi rifiuta e cosa accetta. Ognuna basta per decidere cosa alzare per primo.

`installedFromManifest` registra anche quali peer `peerDependenciesMeta` segna come opzionali, ma `peerConflicts` non legge quell'elenco: una peer opzionale che il progetto ha installato, a una versione fuori dall'intervallo, blocca come qualsiasi altra.

### Il controllo dei pin

Due copie di un pacchetto di solito sono innocue. Non lo sono per un plugin che si registra da solo, o per un singleton. Il commento del codice dà l'esempio del "Cannot redefine plugin" di ESLint, e il README il caso: `typescript-eslint` 8.71.0 fissa `@typescript-eslint/parser` 8.71.0, quindi alzare solo il parser a 8.72.1 fa caricare il plugin due volte a ESLint.

`pinConflicts` guarda ogni pacchetto nel lockfile, a qualsiasi profondità, e legge le sue `dependencies` e `optionalDependencies` sul pacchetto da alzare. Segnala solo quando valgono tutte queste condizioni:

- l'intervallo è un pin esatto (`isExactPin`: `8.71.0` o `=8.71.0`, nient'altro);
- la nuova versione non lo soddisfa;
- il proprietario non fa parte di una famiglia che sale insieme (sotto).

Un intervallo che non è esatto, come `^8.53.0`, viene lasciato stare: "a nested copy there is usually harmless" (una copia annidata lì di solito è innocua). Quella scelta tiene il controllo silenzioso; un pin è una dichiarazione deliberata dell'autore del pacchetto, un intervallo no.

### Famiglie che si muovono insieme

Alcune famiglie pubblicano ogni membro alla stessa versione e si fissano a vicenda a quella: `typescript-eslint` con il suo parser e il suo plugin, `@tailwindcss/*` con `tailwindcss`. Alzarli uno per uno sembrerebbe sempre bloccato. Alzarli insieme va bene, perché ogni pin passa alla nuova versione nello stesso momento.

Quindi `pinConflicts` riceve un `batch`: gli aggiornamenti banali che il pulsante installerebbe insieme, per nome e nuova versione. Un pin non conta quando il suo proprietario sale nel batch alla stessa versione. Segue anche le catene: l'esempio del commento è `@tailwindcss/vite`, che fissa `@tailwindcss/node`, che fissa `tailwindcss`. I pacchetti fissati in sincronia da un pacchetto trascinato vengono trascinati anche loro, ripetendo finché non si aggiunge niente di nuovo.

### Decidere, e poi decidere di nuovo

Il batch dipende da quali aggiornamenti sono banali, e quali sono banali dipende dai pin. `scanNpm` lo risolve con un ciclo:

```ts
for (let changed = true; changed;) {
  changed = false
  const batch = new Map(
    upgrades.filter((u) => u.group === 'bump').map((u) => [u.name, u.latest] as const),
  )
  for (const u of upgrades) {
    const own = peers.get(u)
    const version = parseVersion(u.latest)
    if (own === undefined || !version) continue
    u.conflicts = [...own, ...(young.get(u) ?? []), ...pinConflicts(u.name, version, lock, batch)]
    const group = u.conflicts.length > 0 ? 'blocked' : u.bump === 'major' ? 'review' : 'bump'
    if (group !== u.group) {
      u.group = group
      changed = true
    }
  }
}
```

È citato da [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Il commento sopra: "a blocked one leaves the batch, which can block a sibling it carried" (uno bloccato esce dal batch, il che può bloccare un fratello che trascinava). Il ciclo finisce quando un passaggio non cambia nessun gruppo. `young` tiene i motivi dell'attesa di 24 ore, così finiscono nello stesso elenco. Gli aggiornamenti del gruppo di Expo saltano il controllo delle peer (`peers` non ha nessuna voce per loro, quindi anche il ciclo li salta); passano invece per `npx expo install --fix`.

### Con cosa confronta

I controlli confrontano con ciò che è installato adesso. Il README è onesto sul limite: "si subes varias juntas, puede que el bloqueo se resuelva entre ellas" ("se ne alzi diverse insieme, può darsi che il blocco si risolva tra di loro"). Solo il controllo dei pin conosce il batch; un conflitto di peer tra due aggiornamenti che salirebbero entrambi viene comunque mostrato. È il lato sicuro: il pannello può fermarti quando avresti potuto proseguire, ma non lascia passare un aggiornamento che rompe.

## Costruiscila con Claude

Chiedi a Claude dei controlli che ti dicano quando un aggiornamento npm non può salire da solo, prima che l'aggiornamento venga proposto. L'unica idea che deve fare bene è che contano entrambe le direzioni: ciò che chiede la nuova versione e ciò che chiedono i pacchetti che hai installato.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nella mia mod di Claude Code `my-panel`, prima di segnare un aggiornamento npm come sicuro, controlla se può salire da solo. Scrivi funzioni pure in `hooks/npm.ts`. `peerConflicts(name, target, installed)`: per ogni voce `peerDependencies` della nuova versione, se il progetto ha quella peer installata a una versione fuori dall'intervallo, di' "<name> <version> ha bisogno di <peer> <range> (hai <version>)"; per ogni pacchetto installato le cui `peerDependencies` nominano questo pacchetto con un intervallo che la nuova versione lascia fuori, di' "<other> richiede <name> <range>". Una peer che il progetto non ha non è un conflitto. `pinConflicts(name, target, lock)`: per ogni pacchetto in `packages` di `package-lock.json` che dipende da questo a una versione esatta (`1.2.3` o `=1.2.3`) che la nuova non è, di' "<owner> <version> fissa <name> <range>: resterebbero due copie". Leggi gli intervalli di versione con un `satisfies` che gestisca `||`, `^`, `~` e gli intervalli con trattino e consideri soddisfatto ciò che non sa leggere. Nel modulo degli hook, scarica il manifest della nuova versione da `https://registry.npmjs.org/<name>/<version>` con `$.http.fetch` e tienilo per sempre in `$.store`. Metti qualsiasi aggiornamento con un motivo in un gruppo "bloccato" e stampa i motivi sotto. Testa con manifest e lockfile sintetici.

### Cosa controllare nella risposta di Claude

1. `peerConflicts` confronta entrambe le direzioni: le `peerDependencies` della nuova versione con ciò che hai installato, e le `peerDependencies` di ogni pacchetto installato su questo pacchetto con la nuova versione.
2. Una peer che il progetto non ha non è un conflitto, quindi per lei non viene segnalato nulla.
3. `pinConflicts` segnala solo i pin esatti (`1.2.3` o `=1.2.3`) che la nuova versione non soddisfa. Un intervallo come `^8.53.0` viene lasciato stare.
4. `satisfies` legge gli intervalli con `||`, `^`, `~` e trattino, e considera soddisfatto un intervallo che non sa leggere, così `^8.57.0 || ^9.0.0 || ^10.0.0` non blocca ogni plugin.
5. Ogni aggiornamento con un motivo va nel gruppo bloccato con i suoi motivi stampati sotto, e il manifest della nuova versione viene scaricato da `https://registry.npmjs.org/<name>/<version>` una volta sola e conservato per sempre in `$.store`.

Se un controllo fallisce, di' a Claude cosa vedi: "eslint 10 compare come aggiornamento sicuro, ma la mia configurazione di ESLint accetta solo eslint 9".

### Come l'ha chiesta l'autore

La richiesta originale per questi controlli non è stata registrata. Sono già nel primo commit, e nessun log di task pubblico li copre.

#### Registrato in un log di task, non con le parole dell'autore

`odd/tasks/ecosystems-wave-2.md` registra una decisione su di essi quando sono arrivati gli altri ecosistemi. È un'assunzione scritta nel log del task dall'agente, non le parole dell'autore:

> "Assumption: peer dependency and exact-pin checks stay npm-only; Go majors are new module paths (`/v2`), so a Go major is found by probing `<module>/vN/@latest`."

In italiano: assunzione: i controlli delle peer dependency e dei pin esatti restano solo per npm; le major di Go sono nuovi percorsi di modulo (`/v2`), quindi una major di Go si trova sondando `<module>/vN/@latest`.

Ecco perché la sezione del README inizia ancora con "Solo en npm".

#### Ricostruzione dalla cronologia dei commit

Da `git log -- hooks/npm.ts` e `git log -S` su `peerConflicts`, `pinConflicts` e `lockedPackage` in narsil-check:

- `1bf736a` (2026-11-04) "feat: add upgrade panel for npm and Expo projects" (aggiunge un pannello di aggiornamenti per progetti npm ed Expo). Il suo messaggio nomina "upgrades blocked by peer dependencies or exact pins in the lockfile" (aggiornamenti bloccati da peer dependency o da pin esatti nel lockfile). `peerConflicts`, `pinConflicts` e il batch in sincronia sono già tutti in questo primo commit.
- `a95eb07` (2026-11-04) "refactor: read dependencies through an adapter per ecosystem" (legge le dipendenze tramite un adattatore per ecosistema). npm "keeps what only npm has (Expo, node_modules, peer and pin checks)" (tiene ciò che ha solo npm: Expo, node_modules, controlli di peer e pin).
- `4ea9be0` (2026-11-04) "feat: block upgrades kept on purpose and Kotlin past its compiler plugins" (blocca gli aggiornamenti tenuti apposta e Kotlin oltre i suoi plugin del compilatore). L'etichetta del gruppo passa da `Bloqueada por otras dependencias` ("Bloccata da altre dipendenze") a `Bloqueada`, "since a dependency is no longer its only reason" (perché una dipendenza non è più il suo unico motivo).
- `24dfeb1` (2026-11-07) "fix: read peer dependencies from the lockfile when node_modules is missing" (legge le peer dependency dal lockfile quando manca node_modules). Il suo messaggio descrive il bug che chi legge non avrebbe notato: un progetto non ancora installato non mostrava nessun blocco, quindi gli aggiornamenti rifiutati "looked safe" (sembravano sicuri).

Lo schema: i controlli sono stati progettati completi fin dall'inizio, e l'unica correzione ha riguardato da dove vengono i dati, non la regola.

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida. Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

Questa è una versione ridotta dell'idea, scritta per questa guida e verificata con i tipi di Claude Code 2.1.325. È adattata da `hooks/npm.ts` e `hooks/register.tsx` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Gestisce solo intervalli con accento circonflesso, tilde, esatti e `>=`, e lascia fuori le famiglie che si muovono insieme.

La parte pura, `hooks/peers.ts`:

```ts
type V = [number, number, number]
const parse = (t: string): V | undefined => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(t.trim())
  return m ? [+m[1], +m[2], +m[3]] : undefined
}
const cmp = (a: V, b: V) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]

// Enough of npm's ranges for the example: ^, ~, >=, exact, joined by ||.
export function satisfies(version: string, range: string): boolean {
  const v = parse(version)
  if (!v) return true
  return range.split('||').some((part) => {
    const m = /^\s*(\^|~|>=|=)?\s*v?(\d+\.\d+\.\d+)\s*$/.exec(part)
    const b = m && parse(m[2])
    if (!m || !b) return true // a range it cannot read never raises a false alarm
    const atLeast = cmp(v, b) >= 0
    if (m[1] === '>=') return atLeast
    if (m[1] === '~') return atLeast && v[0] === b[0] && v[1] === b[1]
    if (m[1] === '^') return atLeast && (b[0] > 0 ? v[0] === b[0] : v[0] === 0 && v[1] === b[1])
    return cmp(v, b) === 0
  })
}

export type Pkg = { version: string; peers: Record<string, string> }

export function peerConflicts(name: string, target: Pkg, installed: Map<string, Pkg>): string[] {
  const out: string[] = []
  for (const [peer, range] of Object.entries(target.peers)) {
    const have = installed.get(peer)
    if (have && !satisfies(have.version, range))
      out.push(`${name} ${target.version} needs ${peer} ${range} (you have ${have.version})`)
  }
  for (const [other, pkg] of installed) {
    const range = other === name ? undefined : pkg.peers[name]
    if (range && !satisfies(target.version, range)) out.push(`${other} requires ${name} ${range}`)
  }
  return out
}

type Lock = {
  packages?: Record<string, { version?: string; dependencies?: Record<string, string> }>
}

export function pinConflicts(name: string, target: string, lock: Lock): string[] {
  const out: string[] = []
  for (const [path, entry] of Object.entries(lock.packages ?? {})) {
    const owner = path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length)
    const range = entry.dependencies?.[name]
    if (!path.includes('node_modules/') || owner === name || !range) continue
    if (/^=?\d+\.\d+\.\d+$/.test(range.trim()) && !satisfies(target, range))
      out.push(`${owner} ${entry.version ?? ''} pins ${name} ${range}: two copies would remain`)
  }
  return out
}
```

La parte del modulo degli hook, che scarica una volta sola le peer della nuova versione:

```ts
import type { EngineInterface } from 'claude-code'
import type { Pkg } from './peers'

export async function targetPeers(
  $: EngineInterface,
  name: string,
  version: string,
): Promise<Pkg | undefined> {
  const key = `peers:${name}@${version}`
  const kept = (await $.store.get(key)) as Pkg | undefined
  if (kept) return kept
  const res = await $.http.fetch(
    `https://registry.npmjs.org/${name.replace('/', '%2F')}/${version}`,
    { headers: { accept: 'application/json' } },
  )
  if (!res.ok) return undefined
  const manifest = JSON.parse(res.text) as { peerDependencies?: Record<string, string> }
  const pkg = { version, peers: manifest.peerDependencies ?? {} }
  await $.store.set(key, pkg)
  return pkg
}
```

Costruisci `installed` dal `node_modules/<name>/package.json` di ogni dipendenza dichiarata, letto con `$.fs.read`, come `{ version, peers: peerDependencies ?? {} }`. Per ogni aggiornamento, unisci `peerConflicts` e `pinConflicts` (con `package-lock.json` letto come `lock`); qualsiasi motivo lo rende bloccato, e i motivi sono la sua seconda riga nel pannello.

## Errori comuni e come testarlo

Questi vengono dal codice, dal README e dai commit di Narsil Check:

- **Controllare una sola direzione.** Le peer della nuova versione e le peer dei pacchetti installati sono domande diverse; eslint 10 con una vecchia configurazione fallisce la seconda, un plugin nuovo con un vecchio eslint fallisce la prima.
- **Trattare una peer mancante come un conflitto.** npm la aggiunge. Blocca solo una peer che hai a una versione sbagliata.
- **Leggere solo `node_modules`.** Un clone fresco non ce l'ha, e allora non blocca niente. È il bug che `24dfeb1` ha corretto leggendo i lockfile.
- **Segnalare ogni copia annidata.** La maggior parte è innocua. Segnala solo i pin esatti.
- **Bloccare una famiglia che si muove insieme.** I pin dentro una famiglia alzata alla stessa versione vanno bene; senza il batch, `typescript-eslint` o `@tailwindcss/*` sembrerebbero bloccati per sempre.
- **Decidere una volta sola.** Bloccare un aggiornamento lo toglie dal batch e può bloccarne un fratello; ripeti il ciclo finché nessun gruppo cambia.
- **Un parser di intervalli troppo rigido.** Se fallisce su `^8.57.0 || ^9.0.0 || ^10.0.0`, ogni plugin sembra incompatibile. Considera soddisfatto ciò che non sai leggere.
- **Scaricare il manifest della stessa versione a ogni analisi.** Una versione pubblicata non cambia mai; tieni le sue peer per sempre.

Per testare, `tests/upgrade.test.tsx` costruisce un insieme installato con peer sintetiche e controlla le frasi esatte: "typescript 7 is blocked by the packages that ask for an older one" (typescript 7 è bloccato dai pacchetti che ne chiedono uno più vecchio), "eslint 10 is blocked by the configs and plugins that stop at 9" (eslint 10 è bloccato dalle configurazioni e dai plugin che si fermano a 9), "eslint-plugin-astro 3 is blocked by the eslint it needs" (eslint-plugin-astro 3 è bloccato dall'eslint di cui ha bisogno) e "an upgrade every peer accepts has no conflicts" (un aggiornamento che ogni peer accetta non ha conflitti). "peer ranges as packages write them" (intervalli di peer come li scrivono i pacchetti) fissa `satisfies` su forme di intervallo reali. Per i pin: "only a range naming one version is an exact pin" (solo un intervallo che nomina una versione è un pin esatto), "a package in the tree that pins the old version leaves two copies" (un pacchetto nell'albero che fissa la vecchia versione lascia due copie) e "a family that goes up together carries its pins, through its own members too" (una famiglia che sale insieme trascina i suoi pin, anche attraverso i propri membri). Attraverso il pannello: "a blocked upgrade shows what blocks it and the button leaves it out" (un aggiornamento bloccato mostra cosa lo blocca e il pulsante lo lascia fuori), "the button leaves out an upgrade a package in the tree pins" (il pulsante lascia fuori un aggiornamento che un pacchetto nell'albero fissa), "without node_modules, the lockfiles say what a package asks for" (senza node_modules, sono i lockfile a dire cosa chiede un pacchetto) e "a pnpm project with no node_modules still blocks an upgrade its installed plugins refuse" (un progetto pnpm senza node_modules blocca comunque un aggiornamento che i suoi plugin installati rifiutano).

## Per andare oltre

- Il controllo dei pin ha bisogno di `package-lock.json`. Leggere allo stesso modo i pacchetti annidati di `pnpm-lock.yaml` lo estenderebbe ai progetti pnpm, che secondo il README oggi non sono coperti.
- Anche il controllo delle peer potrebbe conoscere il batch, così che due aggiornamenti che sono in conflitto solo con le vecchie versioni l'uno dell'altro vengano offerti insieme.
- Copiare una riga bloccata dà a Claude entrambe le parti del conflitto in una riga: un buon inizio per chiedere quale pacchetto alzare per primo.
