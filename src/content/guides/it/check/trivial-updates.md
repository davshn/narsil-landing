---
title: Aggiornare quelle banali
description: 'Come il pulsante Actualizar las N alza tutte le patch e le minor in una volta, mantenendo l’operatore di ogni intervallo e la sua sezione, poi esegue lo strumento di installazione di ogni ecosistema.'
route: check
order: 13
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/adapter.ts
  - repo: check
    path: hooks/npm.ts
  - repo: check
    path: hooks/pypi.ts
  - repo: check
    path: hooks/cargo.ts
  - repo: check
    path: hooks/pub.ts
  - repo: check
    path: hooks/rubygems.ts
  - repo: check
    path: hooks/words.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/upgrade.test.tsx
  - repo: check
    path: odd/tasks/release-age-all-ecosystems.md
---

## Cosa fa

La maggior parte di un elenco di librerie non aggiornate sono patch e minor che niente blocca. Alzarle una per una è noioso, ed è lì che si insinuano gli errori: un `^` perso, uno strumento di sviluppo spostato in `dependencies`, un lockfile non aggiornato. Narsil Check le fa con una sola pressione.

Sotto il gruppo **Solo subir la versión** ("Solo alzare la versione") c'è un pulsante, **Actualizar las N** ("Aggiorna le N"), oppure **Actualizar esta librería** ("Aggiorna questa libreria") quando ce n'è una sola. Mentre gira, il pannello dice `Actualizando 6 librerías con npm…` ("Aggiornamento di 6 librerie con npm in corso…") e il pulsante sparisce. Quando finisce, un toast dice `Actualicé 6 librerías con npm.` ("Ho aggiornato 6 librerie con npm.") e il pannello aggiunge un promemoria:

```text
Actualicé 6 librerías. Ejecuta los tests antes de hacer commit.
```

Cioè "Ho aggiornato 6 librerie. Esegui i test prima di fare commit." Poi l'elenco viene analizzato di nuovo, dai registry, così ciò che vedi è ciò che è vero adesso.

Ogni libreria mantiene la forma che aveva. Il README dà gli esempi: `^3.22.0` diventa `^3.25.1`, e `>=2.31,<3` diventa `>=2.34.2,<3`. Una dipendenza di sviluppo resta una dipendenza di sviluppo.

### Cosa significa "banale" qui

Sale solo il gruppo `bump`: un salto patch o minor (secondo la regola dello 0.x della guida 7) senza motivi di blocco. Le major, i moduli fissati dall'SDK di Expo e qualsiasi cosa in **Bloqueada** non vengono mai toccati. Il README sta attento alla parola: "'Trivial' solo significa que el salto no es mayor y que no choca con lo que el panel sabe: no garantiza que el proyecto compile." In italiano: "'Banale' significa solo che il salto non è major e che non si scontra con ciò che il pannello sa: non garantisce che il progetto compili." Ecco perché l'ultimo messaggio ti chiede di eseguire i test.

## Come funziona dentro

### Un piano per ecosistema

`upgradeBumps` in `hooks/register.tsx` prende le righe `bump` dell'ultima analisi, le raggruppa per ecosistema ed esegue ogni ecosistema con il suo strumento. Una seconda pressione mentre uno è in corso non fa niente: lo stato `running` del lavoro viene controllato per primo.

Per ogni ecosistema i passi sono gli stessi, e ciascuno viene dal contratto dell'adattatore in `hooks/adapter.ts`:

1. **Leggere i file** che l'adattatore elenca (manifest e lockfile che esistono).
2. **Risolvere i pin** quando la riscrittura ha bisogno che prima un comando dica qualcosa (`pinCommand`): le GitHub Actions fissate a un commit hanno bisogno del commit del nuovo tag. Se uno non si riesce a leggere, quell'ecosistema viene saltato e i suoi file non vengono scritti.
3. **Riscrivere** i manifest (`rewrite`), quando l'ecosistema viene riscritto dalla mod.
4. **Installare** con i comandi che costruisce `installArgv`.

### npm: il package manager scrive `package.json`

npm non ha `rewrite`. La mod costruisce il comando di installazione e lascia che il package manager modifichi `package.json` e il lockfile. Quale manager usare lo decide il lockfile presente: `pnpm-lock.yaml`, `yarn.lock`, `bun.lock` o `bun.lockb`, altrimenti npm.

L'intervallo viene da `rangeFor` in `hooks/npm.ts`:

```ts
export function rangeFor(spec: string, latest: string): string {
  const prefix = /^(\^|~)/.exec(spec.trim())?.[1] ?? ''
  return `${prefix}${latest}`
}
```

E la sezione da `installArgv`, che crea un comando per `dependencies` e uno per `devDependencies`:

```ts
for (const isDev of [false, true]) {
  const names = upgrades
    .filter((u) => u.isDev === isDev)
    .map((u) => `${u.name}@${rangeFor(u.spec, u.latest)}`)
  if (names.length > 0) argv.push([manager, ...add, ...(isDev ? [dev] : []), ...names])
}
```

Entrambi sono citati da [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). `add` è `install` per npm e `add` per gli altri; `dev` è `--save-dev` per npm e `-D` per gli altri. Il test "dependencies and devDependencies install in their own sections" (dependencies e devDependencies si installano ciascuna nella propria sezione) si aspetta, per tre aggiornamenti:

```text
npm install a@^1.1.0 c@^1.1.0
npm install --save-dev b@^1.1.0
```

Due conseguenze di `rangeFor` vale la pena conoscerle. Si portano solo `^` e `~`: qualsiasi altro prefisso, come `>=`, viene tolto e la versione entra senza prefisso. E per una versione senza prefisso, ciò che finisce in `package.json` è una decisione del package manager; il codice passa la versione senza prefisso, e i test controllano il comando, non il file scritto. Se il tuo progetto si basa su versioni esatte, controlla il risultato o imposta l'opzione del manager per salvare versioni esatte.

### Gli altri ecosistemi: riscrivere la riga, mantenere ogni altro byte

Ogni altro ecosistema riscrive il proprio manifest da sé, riga per riga, e cambia solo la versione. Ogni adattatore ha una piccola funzione che sostituisce la prima versione di un requisito e ne mantiene l'operatore; PyPI e Pub mantengono anche un limite superiore:

| Ecosistema | Funzione       | Esempio dal suo commento o dai suoi test       |
| ---------- | -------------- | ---------------------------------------------- |
| PyPI       | `pySpecFor`    | `>=2.31,<3` → `>=2.34.2,<3`                    |
| Cargo      | `cargoSpecFor` | mantiene `^`, `~`, `=` o `>=`; toglie il resto |
| Pub        | `pubSpecFor`   | `>=1.0.0 <2.0.0` → `>=1.6.0 <2.0.0`            |
| RubyGems   | `gemSpecFor`   | mantiene `~>`, `>=` e simili                   |

Poiché la riga viene modificata dove si trova, la sezione non cambia mai: un crate sotto `[dev-dependencies]` resta lì, un pacchetto Python in `requirements-dev.txt` resta lì. Il `rewriteCargo` di Cargo tiene persino traccia dell'intestazione di tabella in cui si trova, così tocca solo le righe sotto `[dependencies]`, `[dev-dependencies]`, `[build-dependencies]` (e le loro forme `target`) o la tabella propria di un crate `[dependencies.<name>]`. I loro commenti descrivono l'obiettivo allo stesso modo: "every other byte as it was" (ogni altro byte com'era).

Perché riscrivere invece di chiamare il comando "add" di ogni strumento? Il codice non lo dice in un unico punto, ma i commenti mostrano il ragionamento: una riscrittura mantiene la formattazione, i commenti e lo stile degli intervalli della persona, e funziona allo stesso modo che lo strumento sia installato o no. Lo strumento si usa poi solo per ciò che può fare soltanto lui, il lockfile.

### Eseguire l'installazione dopo

Sì, la mod la esegue. L'`installArgv` di ogni adattatore dice cosa, secondo la tabella del README e il codice:

| Ecosistema                            | Dopo la riscrittura                                                     |
| ------------------------------------- | ----------------------------------------------------------------------- |
| npm                                   | `npm install` / `pnpm add` / `yarn add` / `bun add`, come sopra         |
| PyPI                                  | `uv lock` o `poetry lock`; con solo `requirements.txt`, niente          |
| Go                                    | `go get <module>@<version>` e `go mod tidy` (nessuna riscrittura)       |
| Cargo                                 | `cargo update -p <crate>` per ciascuno                                  |
| Pub                                   | `flutter pub get` o `dart pub get`                                      |
| NuGet                                 | `dotnet restore`                                                        |
| RubyGems                              | `bundle update --conservative <gems>`                                   |
| SwiftPM                               | `swift package update`, oppure `xcodebuild -resolvePackageDependencies` |
| Maven, Gradle wrapper, GitHub Actions | niente: la build o l'esecuzione successiva lo scarica                   |

Con solo `requirements.txt`, il README lo dice: non c'è un lockfile, quindi il pulsante riscrive i pin e "no instala nada" ("non installa niente"); installi tu nel tuo ambiente.

npm e pnpm girano sotto l'attesa di 24 ore della guida 9, attraverso l'ambiente che costruisce `releaseAgeEnv` e il campo `env` di `$.process.run` (nei tipi, "Variables set over the host process's own environment", cioè variabili impostate sopra l'ambiente proprio del processo host). Una dipendenza giovane in qualsiasi punto dell'albero fa fallire l'installazione invece di finire nel lockfile.

### Quando qualcosa fallisce

Tre casi, ciascuno gestito in modo diverso in `upgradeBumps`:

- **Lo strumento non è su questa macchina** (`xcodebuild` fuori da un Mac, `cargo` non installato: l'esecuzione viene rifiutata con `ENOENT`). I file riscritti di quell'ecosistema vengono riscritti com'erano, così un manifest alzato non esce mai con un lockfile non aggiornato, e gli altri continuano. Il pannello dice quale è rimasto indietro, per esempio "Cargo quedó sin actualizar (2 librerías): no pude ejecutar cargo en este equipo y dejé sus archivos como estaban." ("Cargo è rimasto senza aggiornamento (2 librerie): non sono riuscito a eseguire cargo su questa macchina e ho lasciato i suoi file com'erano.")
- **Lo strumento gira e fallisce.** Il pannello mostra il comando, il suo codice di uscita e la fine del suo output, oppure il messaggio proprio dell'attesa quando pnpm o npm hanno rifiutato una versione giovane, e analizza di nuovo. Gli ecosistemi successivi non vengono tentati, e i file già riscritti restano; `git diff` li mostra.
- **Qualsiasi altra cosa lancia un'eccezione.** "No pude ejecutar …" ("Non sono riuscito a eseguire …") con l'errore.

## Costruiscila con Claude

Chiedi a Claude un solo pulsante che alzi tutti insieme gli aggiornamenti sicuri. L'unica idea che deve fare bene è cosa significa "sicuro" qui: salgono solo i salti patch e minor che niente blocca, ogni intervallo conserva il suo prefisso, e ogni libreria resta nella sua sezione.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nella mia mod di Claude Code `my-panel`, aggiungi un pulsante "Aggiorna tutto" sotto gli aggiornamenti npm che sono una patch o una minor e non sono bloccati. Scegli il package manager dal lockfile (pnpm, yarn, bun, altrimenti npm). Mantieni il prefisso di ogni intervallo: `^1.2.0` con latest 1.4.0 diventa `^1.4.0`, `~` resta `~`, nessun prefisso resta nessuno. Esegui un comando per `dependencies` e uno con `--save-dev` (o `-D`) per `devDependencies`, con `$.process.run` e un timeout. Mentre gira, nascondi il pulsante e mostra "Aggiornamento di N librerie con <manager> in corso…"; una seconda pressione non deve fare niente. Con un codice di uscita diverso da zero, mostra il comando, il suo codice di uscita e le ultime righe di stderr. In caso di successo, mostra il toast "N librerie aggiornate" e scrivi "Esegui i test prima di fare commit". Analizza di nuovo dai registry in entrambi i casi. Testa che i comandi per tre aggiornamenti, uno dei quali di sviluppo, siano esattamente due, e che un aggiornamento bloccato o major non sia mai tra essi.

### Cosa controllare nella risposta di Claude

1. Si installa solo il gruppo `bump`. Le major e gli aggiornamenti bloccati non sono mai nei comandi.
2. Ogni intervallo conserva il suo prefisso `^` o `~`: `^3.22.0` diventa `^3.25.1`.
3. C'è un comando per `dependencies` e uno con `--save-dev` (o `-D`) per `devDependencies`, e il gestore di pacchetti viene scelto dal lockfile.
4. Mentre è in esecuzione, il pulsante è nascosto e una seconda pressione non fa nulla.
5. Un errore mostra il comando, il suo codice di uscita e la fine del suo output. Che riesca o fallisca, l'elenco viene analizzato di nuovo.

Se un controllo fallisce, di' a Claude cosa vedi: "dopo che ho premuto il pulsante, uno strumento di sviluppo è finito in `dependencies`".

### Come l'ha chiesta l'autore

La richiesta originale per il pulsante non è stata registrata: è nel primo commit, e nessun log di task pubblico ne copre la creazione.

#### Registrato in un log di task

Il log di task `odd/tasks/release-age-all-ecosystems.md` registra, con le parole dell'agente, come è stato controllato il passo di installazione quando l'attesa di 24 ore lo ha raggiunto. Il suo task T3 è "npm installs with `before` set to 24 hours ago" (npm installa con `before` impostato a 24 ore fa), e la voce L3 annota che con `npm_config_before` a un giorno fa, npm ha rifiutato una release di tailwindcss di un'ora prima e ha risolto il suo intervallo alla versione precedente. Questa è una prova raccolta dall'agente, non una richiesta.

`odd/tasks/ecosystems-wave-2.md` elenca "the bump button" (il pulsante di aggiornamento) in S3, tra ciò che doveva continuare a funzionare man mano che si aggiungevano nuovi ecosistemi; anche questa è la spec dell'agente.

#### Ricostruzione dalla cronologia dei commit

Da `git log -S rangeFor`, `git log -S upgradeBumps` e dai commit per ecosistema in narsil-check:

- `1bf736a` (2026-11-04) "feat: add upgrade panel for npm and Expo projects" (aggiunge un pannello di aggiornamenti per progetti npm ed Expo). Il suo messaggio: "trivial bumps it installs in one press" (gli aggiornamenti banali li installa con una sola pressione). `rangeFor`, l'`installArgv` a due sezioni e `upgradeBumps` sono qui.
- `a95eb07` (2026-11-04) "refactor: read dependencies through an adapter per ecosystem" (legge le dipendenze attraverso un adattatore per ecosistema). Gli altri ecosistemi "get a generic scan, install and pending check" (ricevono un'analisi, un'installazione e un controllo delle modifiche in sospeso generici).
- `bbe6519`, `8ae479e`, `503ba95`, `06bcc49` (2026-11-04): "list and upgrade" (elenca e aggiorna) i crate Rust, i pacchetti Python, i pacchetti Dart e Flutter, le gem Ruby. Ciascuno porta la sua funzione di spec e la sua riscrittura.
- `8c5f2a3` (2026-11-06) "feat: install npm and pnpm upgrades under the 24-hour wait through the whole tree" (installa gli aggiornamenti npm e pnpm sotto l'attesa di 24 ore in tutto l'albero).
- `7125ffd` (2026-11-09) "fix: stop the upgrade button from breaking builds it cannot check" (impedisce al pulsante di aggiornamento di rompere build che non può controllare). Il suo messaggio: "Skip an ecosystem whose tool is not on the machine, such as xcodebuild outside a Mac, restoring its manifests so a raised version never goes out with a stale lockfile. The other ecosystems still go up." (salta un ecosistema il cui strumento non è sulla macchina, come xcodebuild fuori da un Mac, ripristinando i suoi manifest così una versione alzata non esce mai con un lockfile non aggiornato; gli altri ecosistemi salgono comunque). Ha anche tolto da "banale" i pin dei lockfile di Gradle e i pin esatti di Swift.

Lo schema: il pulsante c'era fin dal primo commit, e il lavoro successivo ha ristretto ciò che "banale" può includere e cosa succede quando manca uno strumento.

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida. Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

Questa è una versione ridotta dell'idea, scritta per questa guida e verificata con i tipi di Claude Code 2.1.325 (`$.process.run`, `$.ui.toast`). È adattata da `hooks/npm.ts` e `hooks/register.tsx` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Solo npm; `rescan` è la tua analisi.

```ts
import type { EngineInterface } from 'claude-code'

type Bump = { name: string; spec: string; latest: string; isDev: boolean }
type Manager = 'npm' | 'pnpm' | 'yarn' | 'bun'

export function rangeFor(spec: string, latest: string): string {
  const prefix = /^(\^|~)/.exec(spec.trim())?.[1] ?? ''
  return `${prefix}${latest}`
}

export function installArgv(manager: Manager, bumps: Bump[]): string[][] {
  const add = manager === 'npm' ? 'install' : 'add'
  const dev = manager === 'npm' ? '--save-dev' : '-D'
  const argv: string[][] = []
  for (const isDev of [false, true]) {
    const names = bumps
      .filter((b) => b.isDev === isDev)
      .map((b) => `${b.name}@${rangeFor(b.spec, b.latest)}`)
    if (names.length > 0) argv.push([manager, add, ...(isDev ? [dev] : []), ...names])
  }
  return argv
}

let isRunning = false

export async function upgradeAll(
  $: EngineInterface,
  manager: Manager,
  bumps: Bump[],
  rescan: () => Promise<void>,
): Promise<string | undefined> {
  if (isRunning || bumps.length === 0) return undefined
  isRunning = true
  try {
    for (const argv of installArgv(manager, bumps)) {
      const ran = await $.process.run(argv, { timeoutMs: 300_000 })
      if (ran.exitCode !== 0) {
        const tail = (ran.stderr || ran.stdout).trim().split('\n').slice(-5).join('\n')
        return `${argv.slice(0, 2).join(' ')} exited with ${ran.exitCode}:\n${tail}`
      }
    }
    $.ui.toast(`Updated ${bumps.length} libraries with ${manager}.`)
    return 'Run the tests before committing.'
  } finally {
    isRunning = false
    await rescan()
  }
}
```

Tieni il messaggio restituito in un atom e disegnalo sotto il pulsante. Per un secondo ecosistema, aggiungi prima dell'installazione un passo di riscrittura che sostituisca solo la versione sulla riga propria della dipendenza, e riscrivi i file originali se risulta che lo strumento manca.

## Errori comuni e come testarlo

Questi vengono dal codice, dai test e dai commit di Narsil Check:

- **Perdere l'operatore.** `^1.2.0` riscritto come `1.4.0` cambia ciò che il progetto accetta da quel momento in poi. Porta il prefisso.
- **Spostare una dipendenza di sviluppo.** Un solo comando di installazione per tutto mette gli strumenti di sviluppo in `dependencies` (o il contrario). Dividi per sezione.
- **Alzare più del gruppo sicuro.** Il pulsante deve prendere solo `bump`; "a blocked upgrade shows what blocks it and the button leaves it out" (un aggiornamento bloccato mostra cosa lo blocca e il pulsante lo lascia fuori) lo controlla.
- **Un manifest senza il suo lockfile.** Alzare `Cargo.toml` senza un `cargo` che aggiorni `Cargo.lock` lascia i due disallineati. Ripristina il manifest quando lo strumento manca.
- **Riformattare il file.** Leggere un file TOML o YAML e riscriverlo perde i commenti e l'ordine. Modifica l'unica riga.
- **Non analizzare di nuovo.** Dopo un'installazione, l'elenco che mostri deve essere la nuova verità, che sia andata bene o male.
- **Chiamarlo sicuro.** Una patch può comunque rompere una build. Di' "esegui i test", come fa il pannello.

Per testare, `claude plugin test .` esegue `tests/upgrade.test.tsx`: "an upgrade keeps the range prefix package.json wrote" (un aggiornamento mantiene il prefisso dell'intervallo che ha scritto package.json: `^3.22.0` → `^3.25.1`, `~5.4.0` → `~5.9.3`, `1.2.0` → `1.3.0`), "dependencies and devDependencies install in their own sections" (dependencies e devDependencies si installano ciascuna nella propria sezione), "the button installs the trivial upgrades and scans again" (il pulsante installa gli aggiornamenti banali e analizza di nuovo) e "a failed install says why and keeps the list" (un'installazione fallita dice perché e mantiene l'elenco). Il file di test di ogni altro ecosistema controlla la propria riscrittura, per esempio i file di PyPI e di Cargo per l'operatore e il limite superiore.

## Per andare oltre

- Quando i manifest differiscono da `HEAD`, il pannello offre di farne il commit, il push e di aprire una pull request. Questo è l'argomento di una guida successiva di questo percorso.
- `rangeFor` porta solo `^` e `~`. Estenderlo a `>=` o agli intervalli `x` è una piccola modifica con un test per caso.
- Un team che vuole i test eseguiti automaticamente potrebbe concatenare un comando di test dopo l'installazione; Narsil Check lo lascia a te apposta, con il promemoria.
