---
title: Un adattatore per ecosistema
description: 'Come Narsil Check legge undici ecosistemi di pacchetti con un unico piccolo contratto: ogni adattatore legge il suo manifest, interroga il suo registry e dice come alzare una versione.'
route: check
order: 6
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/adapter.ts
  - repo: check
    path: hooks/ecosystems.ts
  - repo: check
    path: hooks/npm.ts
  - repo: check
    path: hooks/semver.ts
  - repo: check
    path: hooks/toml.ts
  - repo: check
    path: hooks/pypi.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/contract.test.tsx
  - repo: check
    path: tests/pypi.test.tsx
  - repo: check
    path: odd/tasks/ecosystems-wave-2.md
  - repo: check
    path: odd/tasks/ecosystems-wave-3.md
  - repo: check
    path: odd/tasks/ecosystems-wave-4.md
---

## Cosa fa

La sezione **Actualizaciones** elenca le librerie del progetto che hanno una versione più recente, in qualunque linguaggio sia scritto il progetto. Un repository con un front end web e un servizio Python riceve un solo elenco, e ogni riga nomina il suo ecosistema alla fine quando ce n'è più di uno:

```text
zod 3.22.4 → 3.25.1 · npm
requests 2.31.0 → 2.32.3 · PyPI
```

Per la persona non cambia niente da un linguaggio all'altro: gli stessi gruppi, la stessa copia con un clic, lo stesso pulsante che alza quelli banali. Dietro questa uniformità c'è un adattatore per ecosistema, e questa guida parla di quel design.

Gli ecosistemi che la mod legge, come elencati in `ADAPTERS` in `hooks/ecosystems.ts`, in questo ordine:

| Adattatore       | Linguaggi             | Legge                                                              | Interroga                              |
| ---------------- | --------------------- | ------------------------------------------------------------------ | -------------------------------------- |
| `npm`            | JavaScript, TS (Expo) | `package.json`, `package-lock.json`, `pnpm-lock.yaml`              | registry.npmjs.org                     |
| `pypi`           | Python                | `pyproject.toml`, `requirements.txt`, `uv.lock`/`poetry.lock`      | pypi.org                               |
| `go`             | Go                    | `go.mod`                                                           | proxy.golang.org                       |
| `cargo`          | Rust                  | `Cargo.toml`, `Cargo.lock`                                         | crates.io                              |
| `pub`            | Dart, Flutter         | `pubspec.yaml`, `pubspec.lock`                                     | pub.dev                                |
| `maven`          | Kotlin, Java          | `gradle/libs.versions.toml`, `build.gradle(.kts)`, `pom.xml`       | Maven Central, Google Maven, Plugin P. |
| `gradle-wrapper` | Gradle stesso         | `gradle/wrapper/gradle-wrapper.properties`                         | services.gradle.org                    |
| `nuget`          | C#, F#, VB            | `*.csproj`, `*.fsproj`, `*.vbproj`, `Directory.Packages.props`     | api.nuget.org                          |
| `rubygems`       | Ruby                  | `Gemfile`, `Gemfile.lock`                                          | rubygems.org                           |
| `swiftpm`        | Swift                 | `Package.swift`, il `project.pbxproj` di Xcode, `Package.resolved` | i tag git di ogni pacchetto            |
| `actions`        | GitHub Actions        | le righe `uses:` di `.github/workflows` e `.github/actions`        | i tag git di ogni action               |

Sono undici adattatori. La tabella **Ecosistemas** del README ha le stesse undici righe. La sua sezione sulle vulnerabilità parla di "los nueve ecosistemas" ("i nove ecosistemi"), e così il log del task sull'età delle release ("all nine ecosystems", tutti e nove gli ecosistemi): entrambi contano gli ecosistemi di pacchetti di allora, prima che gli adattatori del wrapper di Gradle e di GitHub Actions arrivassero in `7048580`.

## Come funziona dentro

### L'idea: adattatori puri, un solo motore

`hooks/adapter.ts` si apre con la regola su cui poggia tutto il design:

> An adapter is pure: the hooks module reads the files it names, fetches the addresses it gives and runs the commands it builds.

In italiano: un adattatore è puro: il modulo degli hook legge i file che nomina, scarica gli indirizzi che dà ed esegue i comandi che costruisce.

Un adattatore non chiama mai `$`. È un oggetto di valori semplici e funzioni semplici: nomi di file, costruttori di URL, parser, costruttori di comandi. Il modulo degli hook (`hooks/register.tsx`) è l'unico posto che tocca il disco, la rete o un processo. Quindi c'è un solo motore e molte descrizioni, e ogni descrizione si può testare con fixture di testo e nessuna toolchain.

Quest'ultimo punto non era teorico. Il log del task dell'ondata 2 registra: "No Python, Cargo or Dart toolchain and no project of those ecosystems on this machine: adapters are checked with fixtures and against the live registries only." (nessuna toolchain Python, Cargo o Dart e nessun progetto di quegli ecosistemi su questa macchina: gli adattatori vengono controllati solo con fixture e contro i registry reali). Un design in cui l'adattatore eseguisse `cargo` da solo non si sarebbe potuto costruire su quella macchina.

### Le tre domande a cui risponde ogni adattatore

Il tipo `Adapter` ha molti campi, la maggior parte opzionali. Quelli obbligatori rispondono a tre domande.

**1. Cosa dichiara il progetto, e cosa è installato?**

- `manifests`: i file la cui presenza dice che il progetto usa questo ecosistema, nella radice (`package.json`). `globs` aggiunge manifest in qualsiasi punto dell'albero (`**/*.csproj`).
- `lockfiles`: dove vengono registrate le versioni installate.
- `parse(files)`: trasforma il testo di quei file in un elenco di `Dep`, ciascuno `{ name, spec, isDev, installed? }`. `spec` è l'intervallo o la versione che scrive il manifest (`^18.2.0`, `>=2.31,<3`), `installed` ciò che registra un lockfile.

**2. Qual è la release più recente?**

- `latestUrl(name)`: dove risponde il registry, con gli `headers` da inviare.
- `latestOf(text)`: legge la versione da quella risposta.

**3. Come sale una versione?**

- `installArgv(present, upgrades, files)`: i comandi che alzano gli aggiornamenti banali (`npm install …`, `uv lock`, `cargo update -p …`).
- `rewrite(files, upgrades, pins)`, opzionale: i file scritti prima di quei comandi, per gli ecosistemi il cui strumento non modifica da solo il manifest.
- `managerOf(present)`: il nome dello strumento, per la nota del pulsante.

Tutto il resto è un'estensione di cui ha avuto bisogno una funzione successiva, e ognuna è una frase nei commenti del tipo: `releasedUrls` e `releasedOf` per l'attesa di 24 ore, `repoUrlOf` e `importPattern` per la lettura di una major da parte di Haiku, `treeOf` per il controllo delle vulnerabilità, `conflictsOf` per un ecosistema che sa cosa rompe un aggiornamento (Kotlin e i suoi plugin del compilatore). Tre campi esistono perché un ecosistema non ci stava:

- `latestCommand` (SwiftPM, GitHub Actions): non c'è nessun registry, quindi il tag più recente viene da `git ls-remote --tags --refs` sul repository stesso del pacchetto.
- `nextMajor` (Go): una major di Go dalla v2 in poi è un nuovo percorso di modulo (`/v2`), quindi il "latest" del registry non lascia mai la major attuale. Il motore chiede ogni major successiva finché una manca.
- `alternateUrl` (Maven): un plugin di Gradle pubblicato come libreria sta sul Plugin Portal, non su Maven Central, quindi un mancato riscontro sul primo registry interroga il secondo.

### Il registro degli ecosistemi

`hooks/ecosystems.ts` è breve. Definisce l'adattatore npm e li raccoglie tutti:

```ts
export const ADAPTERS: Adapter[] = [
  NPM,
  PYPI,
  GO,
  CARGO,
  PUB,
  MAVEN,
  GRADLE_WRAPPER,
  NUGET,
  RUBYGEMS,
  SWIFTPM,
  ACTIONS,
]

export function adapterOf(id: Ecosystem): Adapter {
  return ADAPTERS.find((a) => a.id === id) ?? NPM
}
```

È citato da [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). L'unione `Ecosystem` in `types/index.d.ts` elenca gli stessi undici id, così una riga di aggiornamento porta con sé il suo ecosistema e il motore ritrova il suo adattatore con `adapterOf`.

Il rilevamento è "ogni adattatore il cui manifest è presente". `presentOf` in `hooks/register.tsx` controlla ogni manifest, lockfile e file di contesto con `$.fs.exists`, e per i glob esegue `git ls-files --cached --others --exclude-standard`, che elenca ciò che git traccia o traccerebbe e quindi lascia fuori l'output di build. Fuori da un repository git contano solo i manifest della radice.

### Cosa fa il motore con un adattatore

Per qualsiasi ecosistema tranne npm, `scanGeneric` è tutto il ciclo:

1. Legge i file presenti con `$.fs.read` (un file troppo grande o illeggibile viene saltato: "the adapter does without it", l'adattatore ne fa a meno).
2. `adapter.parse(files)` dà le dipendenze dichiarate.
3. Per ciascuna, la versione installata è `installed`, altrimenti la versione da cui è scritto l'intervallo (`baseOf`).
4. `latestIn` interroga il registry: `$.http.fetch(adapter.latestUrl(name), { headers })`, o `$.process.run(adapter.latestCommand(name))`, e lo legge con `adapter.latestOf`. La risposta viene tenuta in `$.store` per sei ore (la prossima guida spiega la cache).
5. `bumpOf(installed, latest)` da `hooks/semver.ts` dice patch, minor o major, e l'aggiornamento finisce nel suo gruppo.

Il pulsante di aggiornamento fa la terza domanda: per ogni ecosistema con aggiornamenti banali scrive ciò che restituisce `rewrite`, poi esegue ogni comando di `installArgv`. Se lo strumento non è sulla macchina (`xcodebuild` fuori da un Mac), i file riscritti vengono rimessi com'erano, "raised manifests would go out with a stale lockfile, so they go back" (i manifest alzati uscirebbero con un lockfile vecchio, quindi tornano indietro), e gli altri ecosistemi salgono comunque.

### npm, l'adattatore di riferimento

npm è stato il primo ecosistema, l'unico nel primo commit. Quando sono arrivati gli adattatori, in `a95eb07`, "npm becomes the first adapter and keeps what only npm has (Expo, node_modules, peer and pin checks)" (npm diventa il primo adattatore e tiene ciò che ha solo npm: Expo, node_modules, controlli di peer e pin). Quindi npm ha un adattatore come gli altri, usato per il rilevamento, il pulsante, le note di rilascio e l'albero delle vulnerabilità, e anche un'analisi tutta sua, `scanNpm`, per ciò che il ciclo generico non conosce.

I suoi pezzi vivono in `hooks/npm.ts` e vengono assemblati in `hooks/ecosystems.ts`:

- `parseManifest` legge `dependencies` e `devDependencies`, e vince la prima quando un nome è in entrambe.
- `lockedVersion` legge `packages["node_modules/<name>"].version` da `package-lock.json` (v2 e v3).
- `latestUrl` interroga `https://registry.npmjs.org/<name>/latest`, "a small document, unlike the package's full record" (un documento piccolo, a differenza del record completo del pacchetto). Un nome con scope mantiene la sua `@` ed esegue l'escape della sua barra: `@types%2Fnode`.
- `managerOf` sceglie npm, pnpm, yarn o bun dal lockfile presente, e vince il primo trovato in `LOCKFILES`.
- `installArgv` costruisce un comando per le dependencies e uno per le devDependencies, "so each package stays in its own section" (così ogni pacchetto resta nella sua sezione), e `rangeFor` mantiene il prefisso dell'intervallo: `^1.2.0` diventa `^1.4.0`, un pin esatto resta esatto.

npm non ha `rewrite`: `npm install name@^1.4.0` scrive `package.json` da solo.

### Versioni: un'unica aritmetica per tutti

`hooks/semver.ts` è condiviso da ogni adattatore. Il suo `Version` è `{ major, minor, patch, pre, rest? }`. `rest` tiene una quarta parte e oltre, perché RubyGems e NuGet le usano (Rails `8.1.4.1`); è arrivato con l'ondata di Maven in `c50e830`. Lo schema accetta anche un qualificatore Maven dopo un punto (`5.6.15.Final`) e una `v` iniziale.

Esporta quattro cose su cui si appoggia il resto della mod:

- `compare`: major, minor, patch, poi le parti extra, e una prerelease prima della sua release.
- `bumpOf`: il tipo di salto, con la regola per le versioni sotto 1.0.0 (prossima guida).
- `baseOf`: la versione da cui è scritto un intervallo, `undefined` per ciò che non ne nomina nessuna (`workspace:*`, un URL git, `latest`).
- `satisfies`: se una versione soddisfa un intervallo in stile npm, con `||`, intervalli con trattino, `^`, `~`, versioni parziali e `*`. Il suo commento enuncia una scelta di design che vale la pena copiare: "A comparator it cannot read is taken as met, so an unknown range never raises a false alarm." (un comparatore che non sa leggere viene considerato soddisfatto, così un intervallo sconosciuto non dà mai un falso allarme).

### Un piccolo lettore TOML

Cargo, Python e il catalogo delle versioni di Gradle scrivono TOML. `hooks/toml.ts` è "a small TOML reader" (un piccolo lettore TOML): tabelle, array di tabelle, chiavi puntate e tra virgolette, i tipi di stringa, numeri, booleani, date come testo, array e tabelle inline. Lancia un errore su un input malformato, e chi lo chiama lo cattura (un `uv.lock` illeggibile fa sì che le versioni vengano invece dai requisiti).

Perché scriverne uno? La mod non ha un `package.json` suo: i suoi hook importano solo `claude-code` e i propri file. Ogni parser di cui ha bisogno, TOML, YAML per `pnpm-lock.yaml` (letto riga per riga in `pnpmLocked`), versioni e intervalli, vive nel repository. L'intestazione del lettore elenca i file di Cargo e Python; anche `hooks/maven.ts` lo importa, per `libs.versions.toml`.

## Costruiscila con Claude

Chiedi a Claude di trasformare il tuo elenco di librerie non aggiornate in un unico motore con un adattatore puro per ogni ecosistema. L'unica idea che deve fare bene è che un adattatore non chiama mai `$`: indica i file, costruisce indirizzi e comandi e analizza testo, mentre il modulo degli hook fa tutta la lettura, il download e l'esecuzione.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nella mia mod di Claude Code `my-panel`, elenco le dipendenze npm non aggiornate. Rifattorizzala in modo che ogni ecosistema di pacchetti sia un oggetto adattatore puro in un file suo sotto `hooks/`, senza chiamate a `$`: `id`, `label`, `manifests` (nomi di file), `lockfiles`, `parse(files: Record<string, string>)` che restituisce `{ name, spec, isDev, installed? }[]`, `latestUrl(name)`, `latestOf(text)` e `installArgv(present, upgrades)`. Tieni tutto l'I/O in `hooks/register.tsx`: controlla quali manifest esistono con `$.fs.exists`, leggili con `$.fs.read`, scarica `latestUrl` con `$.http.fetch` ed esegui `installArgv` con `$.process.run`. Fai di npm il primo adattatore senza nessun cambiamento di comportamento, dimostrato dai test esistenti. Poi aggiungi un adattatore PyPI per `requirements.txt` contro `https://pypi.org/pypi/<name>/json` (`info.version`). Testa ogni adattatore come funzioni pure con fixture di testo e una risposta del registry sintetica.

### Cosa controllare nella risposta di Claude

1. Nessun adattatore chiama `$`. `$.fs.exists`, `$.fs.read`, `$.http.fetch` e `$.process.run` compaiono solo in `hooks/register.tsx`.
2. Ogni adattatore ha `manifests`, `lockfiles`, `parse`, `latestUrl`, `latestOf` e `installArgv`. Un campo che serve a un solo ecosistema è opzionale.
3. npm diventa il primo adattatore senza alcun cambio di comportamento, e i test esistenti passano ancora.
4. Un nome npm con scope conserva la sua `@` e fa l'escape della barra nell'URL (`@types%2Fnode`).
5. Ogni adattatore è testato come funzioni pure con fixture di testo e una risposta sintetica del registro, senza alcuna toolchain dell'ecosistema installata.

Se un controllo fallisce, di' a Claude cosa vedi: "i test di PyPI falliscono su una macchina senza Python, perché l'adattatore esegue un comando da solo".

### Come l'ha chiesta l'autore

Gli adattatori sono stati costruiti in tre ondate il 2026-11-04, ciascuna con un log di task pubblico in narsil-check. I log dei task registrano le parole dell'autore, e anche il piano che le ondate hanno seguito; qui sotto le due cose sono tenute separate.

#### Registrato: ondata 2

`odd/tasks/ecosystems-wave-2.md`, voce di log L1 (2026-11-04), cita l'autore:

> "camos con la oleada 2", then "espera primero sube a github - main y luego sigue con la oleada 2".

In italiano: "andiamo con l'ondata 2" ("camos" è un refuso per "vamos"), poi "aspetta, prima fai il push su GitHub, main, e poi continua con l'ondata 2".

S1 registra il piano seguito dall'ondata, sotto "The user's request, as wave 2 was planned in this conversation" (la richiesta dell'utente, come l'ondata 2 è stata pianificata in questa conversazione):

> "2. **PyPI, Go, Cargo y Pub.** Tienen registros con APIs JSON sencillas."

In italiano: "2. PyPI, Go, Cargo e Pub. Hanno registry con API JSON semplici." Il log non dice chi ha scritto quella riga del piano. Lo stesso S1 aggiunge, con le parole del log del task, che "Each ecosystem's adapter follows the shared contract: `detect`, `parse`, `latest`, `importPattern` (the planned contract), plus an install command for the bump group." (l'adattatore di ogni ecosistema segue il contratto condiviso: `detect`, `parse`, `latest`, `importPattern`, il contratto pianificato, più un comando di installazione per il gruppo dei salti). Il contratto rilasciato ha chiamato quei passi `manifests`, `parse`, `latestUrl`/`latestOf` e `installArgv`. La sua assunzione dichiarata: "peer dependency and exact-pin checks stay npm-only" (i controlli delle peer dependency e dei pin esatti restano solo per npm).

#### Registrato: ondata 3

`odd/tasks/ecosystems-wave-3.md`, L1 (2026-11-04), cita l'autore: "dale a la oleada 3" ("vai con l'ondata 3"). Il suo S1 registra il piano:

> "3. **Maven (Kotlin/Java), NuGet y RubyGems.** Gradle es lo más difícil de leer, porque `build.gradle.kts` es código. Leería el catálogo de versiones con exactitud y los `build.gradle.kts` lo mejor posible."

In italiano: "3. Maven (Kotlin/Java), NuGet e RubyGems. Gradle è il più difficile da leggere, perché `build.gradle.kts` è codice. Leggerei il catalogo delle versioni con esattezza e i file `build.gradle.kts` meglio possibile." La prima persona ("Leería", "Leggerei") si legge come una proposta che l'autore ha poi accettato con "dale a la oleada 3"; il log non dice di più.

Quel piano è il motivo per cui il README dice che una versione di Gradle tenuta in una variabile "es código y queda fuera" ("è codice e resta fuori").

#### Registrato: ondata 4

`odd/tasks/ecosystems-wave-4.md`, L1 (2026-11-04), cita l'autore: "dale a la oleada 4" ("vai con l'ondata 4"). Il suo S1 registra il piano:

> "4. **SwiftPM.** Lo dejo para el final porque depende de la API de GitHub, que tiene límite de peticiones."

In italiano: "4. SwiftPM. Lo lascio per ultimo perché dipende dall'API di GitHub, che ha un limite di richieste."

Qui il piano è cambiato lungo il percorso. L'assunzione del log del task: "tags are read with `git ls-remote --tags --refs <url>` instead of the GitHub API, which has no request limit and works for any git host" (i tag vengono letti con `git ls-remote --tags --refs <url>` invece che con l'API di GitHub, il che non ha limite di richieste e funziona con qualsiasi host git). È lì che il contratto ha ricevuto `latestCommand`, in `8444155` "feat: let an adapter answer its latest version with a command" (permette a un adattatore di rispondere la sua versione più recente con un comando).

#### Ricostruzione dalla cronologia dei commit

L'ondata 1, solo npm, non ha un log di task, quindi la sua richiesta non è stata registrata. Da `git log -- hooks/adapter.ts hooks/ecosystems.ts hooks/toml.ts hooks/semver.ts`:

- `1bf736a` (2026-11-04) "feat: add upgrade panel for npm and Expo projects" (aggiunge un pannello di aggiornamenti per progetti npm ed Expo). Arrivano `semver.ts` e `npm.ts`; non ci sono ancora adattatori.
- `a95eb07` (2026-11-04) "refactor: read dependencies through an adapter per ecosystem" (legge le dipendenze tramite un adattatore per ecosistema). Il contratto, con npm come primo adattatore "with no change in behaviour" (senza nessun cambiamento di comportamento), come dice il log dell'ondata 2 per T1.
- `bbe6519`, `8ae479e`, `90f8502`, `503ba95` (2026-11-04): Cargo (con `toml.ts`), PyPI, Go e Pub, un commit ciascuno.
- `c50e830` (2026-11-04) "feat: find manifests anywhere in the tree and read four-part versions" (trova manifest in qualsiasi punto dell'albero e legge versioni in quattro parti): il contratto acquisisce `globs` e `Version.rest` prima di Maven, NuGet e RubyGems (`4f9b8ea`, `1362623`, `06bcc49`).
- `8444155` e `83c0029` (2026-11-04): `latestCommand`, poi SwiftPM.
- `1492ca5` (2026-11-06) "feat: hold every ecosystem's upgrades for 24 hours after release" (trattiene gli aggiornamenti di ogni ecosistema per 24 ore dopo la release): `releasedUrls` e `releasedOf` in ogni adattatore.
- `7048580` (2026-11-09) "feat: check the Gradle wrapper and GitHub Actions for upgrades" (controlla gli aggiornamenti del wrapper di Gradle e di GitHub Actions): il decimo e l'undicesimo adattatore.

Lo schema: prima fare dell'ecosistema esistente un adattatore senza cambiare il suo comportamento, poi aggiungere un ecosistema per commit, e far crescere il contratto di un campo opzionale ogni volta che un ecosistema non ci sta.

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida. Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

Questa è una versione ridotta dell'idea, scritta per questa guida e verificata con i tipi di Claude Code 2.1.325. È adattata da `hooks/adapter.ts`, `hooks/npm.ts` e `hooks/register.tsx` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Legge le versioni solo dal manifest, senza lockfile.

Il contratto e l'adattatore npm, `hooks/adapter.ts`:

```ts
export type Dep = { name: string; spec: string; isDev: boolean }
export type Files = Record<string, string>

export type Adapter = {
  id: string
  manifests: string[]
  parse: (files: Files) => Dep[]
  latestUrl: (name: string) => string
  latestOf: (text: string) => string | undefined
  installArgv: (upgrades: { name: string; latest: string; isDev: boolean }[]) => string[][]
}

export const NPM: Adapter = {
  id: 'npm',
  manifests: ['package.json'],
  parse: (files) => {
    const json = JSON.parse(files['package.json'] ?? '{}') as Record<string, Record<string, string>>
    return (['dependencies', 'devDependencies'] as const).flatMap((field) =>
      Object.entries(json[field] ?? {}).map(([name, spec]) => ({
        name,
        spec,
        isDev: field === 'devDependencies',
      })),
    )
  },
  latestUrl: (name) => `https://registry.npmjs.org/${name.replace('/', '%2F')}/latest`,
  latestOf: (text) => (JSON.parse(text) as { version?: string }).version,
  installArgv: (upgrades) =>
    [false, true]
      .map((isDev) =>
        upgrades.filter((u) => u.isDev === isDev).map((u) => `${u.name}@^${u.latest}`),
      )
      .flatMap((names, i) =>
        names.length ? [['npm', 'install', ...(i ? ['--save-dev'] : []), ...names]] : [],
      ),
}

export const ADAPTERS: Adapter[] = [NPM]
```

Il motore, in `hooks/register.tsx`:

```tsx
import type { EngineInterface } from 'claude-code'
import { ADAPTERS } from './adapter'
import type { Adapter } from './adapter'

const major = (v: string) => Number(/\d+/.exec(v)?.[0] ?? 0)
const clean = (spec: string) => /\d+(\.\d+){0,2}/.exec(spec)?.[0]

export async function scan($: EngineInterface) {
  const rows: { ecosystem: string; name: string; from: string; to: string; isMajor: boolean }[] = []
  for (const adapter of ADAPTERS) {
    const files: Record<string, string> = {}
    for (const path of adapter.manifests)
      if (await $.fs.exists(path)) files[path] = await $.fs.read(path)
    if (Object.keys(files).length === 0) continue
    for (const dep of adapter.parse(files)) {
      const from = clean(dep.spec)
      if (!from) continue
      const res = await $.http.fetch(adapter.latestUrl(dep.name), {
        headers: { accept: 'application/json' },
      })
      const to = res.ok ? adapter.latestOf(res.text) : undefined
      if (to && to !== from)
        rows.push({
          ecosystem: adapter.id,
          name: dep.name,
          from,
          to,
          isMajor: major(to) !== major(from),
        })
    }
  }
  return rows
}
```

Chiama `scan` da una funzione che nessun hook attende mai, tieni le righe in un atom e disegnale nel pannello. Il motore ridotto tratta qualsiasi versione diversa come più recente e qualsiasi cambio di major come major; Narsil Check confronta con `compare` e `bumpOf` da `hooks/semver.ts`, legge la versione installata dal lockfile, chiede fino a otto librerie alla volta e mette in cache le risposte.

### Esercizio: aggiungi PyPI

Aggiungi un secondo adattatore, `PYPI`, ad `ADAPTERS` senza toccare `scan`. Gli serve:

- `manifests: ['requirements.txt']`.
- `parse`: una dipendenza per riga, saltando i commenti e le righe di opzioni (`-r`, `--index-url`), il nome prima del primo operatore (`==`, `>=`, `~=`) e il resto come `spec`.
- `latestUrl`: `https://pypi.org/pypi/<name>/json`.
- `latestOf`: `info.version` di quel JSON.
- `installArgv`: `[]` quando non c'è nessun lockfile, perché riscrivere `requirements.txt` è tutto l'aggiornamento (è quello che fa anche Narsil Check: "con solo `requirements.txt` no hay lockfile, así que el botón reescribe los pins y no instala nada", "con solo `requirements.txt` non c'è nessun lockfile, quindi il pulsante riscrive i pin e non installa niente"). Il tuo contratto allora ha bisogno di un `rewrite`.

Quando funziona, confrontalo con la risposta di riferimento, `hooks/pypi.ts` in narsil-check. Mostra cosa aggiunge un adattatore reale: la normalizzazione dei nomi PEP 503 (`Foo_Bar` e `foo-bar` sono un solo pacchetto), extras e marker in PEP 508 (`Django[argon2]~=4.2 ; python_version > '3.8'`), `pyproject.toml` letto con `parseToml`, le versioni installate da `uv.lock` o `poetry.lock`, un `rewrite` che alza solo la prima versione e mantiene un limite superiore (`>=2.31,<3` diventa `>=2.34.2,<3`), e una tabella dei nomi di import per Haiku (`pyyaml` si importa come `yaml`).

## Errori comuni e come testarlo

Questi vengono dal codice e dai log dei task di Narsil Check:

- **Lasciare che l'adattatore faccia I/O.** Allora non si può testare senza gli strumenti dell'ecosistema. Tienilo puro, e lascia che sia il motore a leggere, scaricare ed eseguire.
- **Un adattatore che sa troppo.** La logica di Expo, peer e pin di npm è rimasta nell'analisi propria di npm. Un campo che serve a un solo ecosistema è opzionale, mai richiesto a tutti.
- **Nomi con scope e nomi speciali.** Lo `@scope/name` di npm deve fare l'escape della sua barra nell'URL. PyPI confronta i nomi normalizzati. Le major di Go sono altri percorsi.
- **Fidarsi di "latest".** Il `<release>` di Maven può essere una prerelease (il log dell'ondata 3 ha trovato `2.12.0-alpha05`), quindi il massimo stabile viene dall'elenco completo.
- **Registry con regole proprie.** crates.io rifiuta una richiesta senza User-Agent, come dice un commento in `hooks/cargo.ts`, quindi il suo adattatore ne invia uno in `headers`.
- **Riscrivere più della versione.** Un `rewrite` che riformatta un manifest produce un diff rumoroso. I rewrite di Narsil Check cambiano la versione e "every other byte as it was" (ogni altro byte com'era).
- **Un test che finge ogni processo.** Il log dell'ondata 3 registra "A test mock that simulated the npm install on every process call broke once the scan began calling git ls-files" (un mock di test che simulava l'npm install a ogni chiamata di processo si è rotto quando l'analisi ha iniziato a chiamare git ls-files). Rispondi solo ai comandi di cui parla il test.

Per testare, `tests/contract.test.tsx` controlla i pezzi condivisi: "a version may have a fourth part, and it counts" (una versione può avere una quarta parte, e conta), "a glob matches at any depth with \*\*/ and within one directory with \*" (un glob corrisponde a qualsiasi profondità con \*\*/ e dentro una sola cartella con \*), "the manifests are the root ones and the globbed ones, never a lockfile" (i manifest sono quelli della radice e quelli trovati con i glob, mai un lockfile). Ogni ecosistema ha il suo file; `tests/pypi.test.tsx` ha "a PEP 508 requirement is a name and its specifier, without extras or markers" (un requisito PEP 508 è un nome e il suo specificatore, senza extras né marker), "raising a requirement keeps its operators and upper bound, and every other byte" (alzare un requisito mantiene i suoi operatori e il limite superiore, e ogni altro byte), "PyPI's answer gives the latest release and the GitHub repository" (la risposta di PyPI dà la release più recente e il repository GitHub) e, attraverso il pannello, "a uv project lists its packages and the button raises pyproject.toml and runs uv lock" (un progetto uv elenca i suoi pacchetti e il pulsante alza pyproject.toml ed esegue uv lock) e "a project with two ecosystems names each library's" (un progetto con due ecosistemi nomina quello di ogni libreria).

## Per andare oltre

- La prossima guida segue un aggiornamento da `bumpOf` al suo gruppo, e spiega la cache di sei ore che usa `latestIn`.
- I campi opzionali degli adattatori sono una mappa delle funzioni successive della mod: leggi `releasedUrls` per l'attesa di 24 ore, `treeOf` per le vulnerabilità, `conflictsOf` per Kotlin Multiplatform.
- Un ecosistema senza registry non è un vicolo cieco: `latestCommand` lascia rispondere un comando git, come fanno SwiftPM e GitHub Actions.
