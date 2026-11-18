---
title: Kotlin, Gradle e AGP (avanzato)
description: 'Perché una build Kotlin o Android non può alzare un solo strumento, e come Narsil Check blocca Kotlin oltre i suoi plugin del compilatore e controlla i minimi tra Gradle, AGP, Kotlin e Compose.'
route: check
order: 17
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/kmp.ts
  - repo: check
    path: hooks/maven.ts
  - repo: check
    path: hooks/wrapper.ts
  - repo: check
    path: hooks/actions.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/kmp.test.tsx
  - repo: check
    path: tests/wrapper.test.tsx
  - repo: check
    path: tests/actions.test.tsx
  - repo: check
    path: odd/tasks/release-age-all-ecosystems.md
---

## Cosa fa

Nella maggior parte degli ecosistemi una libreria è una libreria: la alzi, e se la sua API non è cambiata, il progetto continua a compilare. Una build Android o Kotlin Multiplatform (KMP) è diversa. I suoi strumenti sono a strati, e ogni strato è costruito per un intervallo di quello sotto.

In parole semplici, gli strati sono questi:

- **Gradle** è lo strumento di build. Il progetto fissa la sua versione nel wrapper di Gradle, il piccolo file `gradle/wrapper/gradle-wrapper.properties` che dice quale Gradle scaricare.
- **L'Android Gradle Plugin (AGP)** insegna a Gradle a costruire app Android. Ogni AGP ha bisogno almeno di un certo Gradle.
- **Kotlin** è il linguaggio, e il suo plugin di Gradle ha bisogno almeno di un certo AGP e di un certo Gradle.
- **I plugin del compilatore** (KSP, SKIE e altri) girano dentro il compilatore Kotlin. Ogni release è costruita per versioni specifiche di Kotlin, quindi devono muoversi con Kotlin.
- **Compose Multiplatform** è il framework di UI, e ogni versione ha bisogno almeno di un certo Kotlin, e dalla 1.7 almeno di un certo AGP.

Così una patch di Kotlin, che sembra banale, può fermare la build perché un plugin del compilatore non la supporta ancora. Una minor di AGP può fallire perché il Gradle del wrapper è troppo vecchio. Niente di questo si vede nei numeri di versione. È lo stesso tipo di problema dei moduli Expo legati a un SDK, descritto nella guida 7.

Narsil Check conosce questi legami. Un aggiornamento che ne romperebbe uno va in **Bloqueada** ("Bloccato"), qualunque sia il suo salto, con il motivo a parole. Due esempi dal README:

```text
SKIE 0.10.16 es un plugin del compilador de Kotlin: confirma que soporta Kotlin 2.4.21
AGP 8.13.0 necesita Gradle 8.13 o más; el wrapper usa 8.11.1
```

Si leggono "SKIE 0.10.16 è un plugin del compilatore Kotlin: conferma che supporta Kotlin 2.4.21" e "AGP 8.13.0 ha bisogno di Gradle 8.13 o successivo; il wrapper usa 8.11.1".

Anche il wrapper di Gradle stesso è elencato come qualcosa da alzare, e così le GitHub Actions che i tuoi workflow fissano, perché anche una CI fa parte della build.

## Come funziona dentro

Tutto questo sta nell'adattatore Maven, che legge i progetti Gradle e Maven (guida 6). Il suo `conflictsOf` unisce tre controlli: `kotlinConflicts` (i plugin del compilatore, in `hooks/maven.ts`), `kmpConflicts` (i minimi incrociati, in `hooks/kmp.ts`), e `lockConflicts` (i lock delle dipendenze di Gradle). Ciascuno restituisce frasi; qualsiasi frase blocca l'aggiornamento. Tutti e tre sono funzioni pure sulle dipendenze interpretate e sui file del progetto, così i test danno loro un elenco e un wrapper e leggono le frasi.

### Plugin del compilatore che devono muoversi con Kotlin

`COMPILER_PLUGINS` in `hooks/maven.ts` ne elenca sette: SKIE, KSP, Mokkery, Realm, Metro, kotlinx-rpc e Anvil. Ciascuno viene trovato dalle sue coordinate (`co.touchlab.skie`, `com.google.devtools.ksp`, …) o dalla sua chiave nel version catalog. La chiave del catalog conta: l'esempio del commento è un modulo `build-logic` che legge direttamente `libs.versions.mokkery`, così nessuna coordinata nei file di build nomina Mokkery, eppure il progetto lo usa.

Quando Kotlin sale e il progetto ne dichiara uno qualsiasi, l'aggiornamento viene bloccato:

- **KSP viene controllato con esattezza.** Una versione di KSP1 porta il Kotlin per cui è stata costruita, come in `2.4.20-1.0.30`. Se quel prefisso non è il nuovo Kotlin, il motivo è "hace falta un KSP para 2.4.21" ("serve un KSP per 2.4.21"). Una versione di KSP2 senza Kotlin dentro, come `2.3.0`, funziona con qualsiasi versione e non blocca.
- **Per gli altri si chiede una conferma.** Le loro versioni non dicono niente di Kotlin, quindi la mod non può controllarli. Blocca e ti chiede di confermare il supporto.

Ciò che conta come Kotlin è `org.jetbrains.kotlin` e i suoi plugin, mai `kotlinx` (coroutines e serialization salgono per conto loro).

Un plugin manca dall'elenco apposta: il compilatore di Compose. È pubblicato come `org.jetbrains.kotlin.plugin.compose`, quindi fa parte di Kotlin stesso, con la versione di Kotlin. Il log di task spiega la scelta: "Compose compiler lockstep with Kotlin left out: separate rows would block each other; catalogs share the kotlin version ref." (lasciato fuori il compilatore di Compose che va di pari passo con Kotlin: righe separate si bloccherebbero a vicenda; i catalog condividono il riferimento di versione kotlin). In un catalog entrambi leggono la stessa versione `kotlin`, quindi sono una sola riga e salgono insieme.

### I minimi incrociati, dalla documentazione degli strumenti stessi

`hooks/kmp.ts` contiene quattro tabelle, ciascuna con l'indirizzo da cui è stata copiata e la data in cui era aggiornata. Il commento lo dice chiaramente: "the tables come from the tools' own documentation, quoted below" (le tabelle vengono dalla documentazione degli strumenti stessi, citata sotto). Il log di task registra perché sono scritte nel codice: i metadati dei moduli Gradle pubblicati "states none of these" (non dichiarano niente di tutto questo).

**AGP verso il suo Gradle minimo**, dalla pagina delle release di AGP di Google, "as of AGP 9.5.0" (aggiornata ad AGP 9.5.0):

| AGP  | Gradle minimo |
| ---- | ------------- |
| 9.5  | 9.6.0         |
| 9.4  | 9.6.0         |
| 9.3  | 9.5.0         |
| 9.2  | 9.4.1         |
| 9.1  | 9.3.1         |
| 9.0  | 9.1.0         |
| 8.13 | 8.13          |
| 8.12 | 8.13          |
| 8.11 | 8.13          |
| 8.10 | 8.11.1        |
| 8.9  | 8.11.1        |
| 8.8  | 8.10.2        |
| 8.7  | 8.9           |
| 8.6  | 8.7           |
| 8.5  | 8.7           |
| 8.4  | 8.6           |
| 8.3  | 8.4           |
| 8.2  | 8.2           |
| 8.1  | 8.0           |
| 8.0  | 8.0           |

Nel codice la tabella continua da 7.0 a 7.4.

**Kotlin verso l'AGP e il Gradle minimi del suo plugin di Gradle**, dalla pagina su Gradle di kotlinlang.org, "as of 2.4.21" (aggiornata alla 2.4.21). Ogni riga si applica da quella versione di Kotlin in poi:

| Kotlin da | AGP minimo | Gradle minimo |
| --------- | ---------- | ------------- |
| 2.4.0     | 8.5.2      | 7.6.3         |
| 2.3.0     | 8.2.2      | 7.6.3         |
| 2.1.0     | 7.3.1      | 7.6.3         |
| 2.0.0     | 7.1.3      | 6.8.3         |

**Compose Multiplatform verso il suo Kotlin e AGP minimi**, dalle note di migrazione del CHANGELOG di JetBrains e dalla pagina di compatibilità. Il Kotlin è quello della piattaforma più esigente, iOS e web. La 1.12 non dichiara un nuovo minimo, quindi tiene quello della 1.11:

| Compose Multiplatform | Kotlin minimo | AGP minimo |
| --------------------- | ------------- | ---------- |
| 1.6                   | 2.0.0         |            |
| 1.7                   | 2.0.0         | 8.1.0      |
| 1.8                   | 2.1.0         | 8.1.0      |
| 1.9                   | 2.1.0         | 8.1.0      |
| 1.10                  | 2.2.0         | 8.1.0      |
| 1.11                  | 2.3.0         | 8.1.0      |
| 1.12                  | 2.3.0         | 8.1.0      |

**KSP dalla 2.3.12 ha bisogno di AGP 8.12.0**, dalle release di KSP.

### Come i controlli leggono il progetto

`kmpConflicts` ha bisogno di tre fatti:

- **Il Gradle che esegue il wrapper**, letto da `gradleVersionOf` dalla riga `distributionUrl`, `…/gradle-9.6.0-bin.zip`. Guarda il wrapper nella radice e in `android/gradle/wrapper/…`, dove lo tiene un progetto React Native.
- **L'AGP e il Kotlin in uso**: la versione più alta che scrive una qualsiasi dichiarazione di quello strumento.
- **Cosa sta salendo**, e a quale versione.

Poi, per l'aggiornamento in questione:

- **AGP**: si cerca la minor della nuova versione. Se il Gradle del wrapper è sotto il suo minimo, bloccato. Se non c'è un wrapper da leggere, bloccato anche così: "no encontré gradle/wrapper/gradle-wrapper.properties para confirmarlo" ("non ho trovato … per confermarlo").
- **Passare ad AGP 9 dalla 8.x**: AGP 9 include Kotlin, e il codice aggiunge due regole dalla guida di migrazione di Google. Un modulo che combina `org.jetbrains.kotlin.multiplatform` con `com.android.library` o `com.android.application` deve passare a `com.android.kotlin.multiplatform.library`, e kapt non funziona (passa a KSP, o usa `com.android.legacy-kapt`). Queste scattano solo nel passaggio. Un progetto già sulla 9 le ha già affrontate; il log di task registra che un test le ha colte mentre scattavano di nuovo su un progetto del genere.
- **Kotlin**: la prima riga il cui "da" il nuovo Kotlin raggiunge dà l'AGP e il Gradle minimi.
- **Compose Multiplatform**: conta solo la sua linea, il plugin di Gradle e i gruppi `runtime`, `foundation`, `ui`, `animation`, `material`, `components` e `desktop`. `org.jetbrains.compose.hot-reload` e `material3.adaptive` hanno versioni proprie e qui non sono Compose Multiplatform.
- **KSP**: dalla 2.3.12, l'AGP deve essere 8.12.0 o successivo.

### Solo minimi, e "oltre la tabella" significa "conferma"

Due decisioni danno forma a ciò che la mod rifiuta.

**I massimi non vengono controllati.** JetBrains pubblica l'AGP e il Gradle più alti con cui ogni Kotlin è testato, ma andare oltre non è un fallimento. Il commento del codice: "The maximums are what is fully supported, not a failure, so they are not checked." (i massimi sono ciò che è pienamente supportato, non un fallimento, quindi non vengono controllati). Il README aggiunge che Google stessa combina versioni oltre quei massimi. Bloccare sui massimi tratterrebbe build che funzionano.

**Una versione più nuova della tabella blocca.** AGP 9.6, o Compose Multiplatform 1.13, non è nelle tabelle. Invece di tirare a indovinare, la mod blocca con "es más nuevo que la tabla de Google que conozco (hasta 9.5): confirma qué Gradle necesita" ("è più nuovo della tabella di Google che conosco (fino alla 9.5): conferma quale Gradle gli serve"). Una tabella copiata dalla documentazione invecchia; la lettura sicura di una riga sconosciuta è "chiedi".

### Il wrapper come dipendenza a sé

`hooks/wrapper.ts` fa del wrapper nella radice un ecosistema a sé, `gradle-wrapper`. La sua ultima versione viene dal servizio delle versioni di Gradle, `https://services.gradle.org/versions/current`, che dà anche l'ora di build usata per l'attesa di 24 ore (guida 9). L'aggiornamento riscrive solo la versione in `distributionUrl`; non c'è niente da installare, perché il wrapper scarica la nuova distribuzione alla sua prossima esecuzione.

Dal codice vengono due limiti. Un wrapper con `distributionSha256Sum` viene bloccato, perché il checksum appartiene a una distribuzione e la mod non può conoscere quello della successiva; il motivo dà il comando `./gradlew wrapper --gradle-version … --gradle-distribution-sha256-sum <sum>`. E il wrapper sotto `android/` non viene alzato: lo scelgono React Native e Flutter.

Questo chiude un cerchio con la regola di AGP. Quando AGP è bloccato perché il Gradle del wrapper è troppo vecchio, il wrapper stesso compare come aggiornamento banale. Leggendo il codice, alzarlo prima e analizzare di nuovo permette ad AGP di superare il suo controllo.

### GitHub Actions nello stesso commit

Il commit che ha aggiunto il wrapper ha aggiunto anche `hooks/actions.ts`, un adattatore per le righe `uses:` di `.github/workflows/*.yml` e `.github/actions/*/action.yml`. Una CI Android fissa così i suoi passi di setup, che quindi invecchiano come qualsiasi dipendenza.

Legge un'action fissata a un tag completo (`@v6.1.0`) o a un commit con la sua versione in un commento (`@<commit> # v6.1.0`). Un tag mobile come `@v6` segue già la sua major e resta fuori. Le ultime versioni vengono dai tag git dell'action con `git ls-remote`, tenendo solo le versioni complete. Per un pin su commit, l'aggiornamento risolve prima il commit del nuovo tag, seguendo i tag annotati (`^{}`), e se non riesce a leggerne uno, nessun workflow viene scritto. Il README aggiunge una nota pratica: fare il push di modifiche a `.github/workflows` via HTTPS richiede un token con il permesso `workflow`.

### README e codice

Il README, nella sua sezione su questi strumenti, dice "El wrapper solo se lee: nunca entra en el commit del PR" ("Il wrapper viene solo letto: non entra mai nel commit della PR"). Questo è stato scritto con `1637e94`, quando il wrapper era solo contesto per l'adattatore Maven, ed è ancora vero per quell'adattatore (un test lo controlla). Da `7048580` il wrapper è anche un ecosistema a sé, il cui manifest è `gradle-wrapper.properties`. Leggendo `checkPending` (guida 13), un wrapper alzato differisce da `HEAD` e verrebbe elencato e committato con il resto. Nessun test copre quel caso, né in un senso né nell'altro.

## Come è stata chiesta all’IA

Questa è registrata in parte. La regola dei plugin del compilatore è precedente ai log di task pubblici; i minimi incrociati hanno le parole dell'autore.

### Registrato: "antes de subir corrijamos KMP"

`odd/tasks/release-age-all-ecosystems.md` in narsil-check registra, nella sua spec S5, cosa ha detto l'autore dopo aver saputo che Compose Multiplatform e AGP non erano coperti:

> "antes de subir corrijamos KMP. Compose Multiplatform y el Android Gradle Plugin etc, ademas cuando termines lanza el verificador independiente con todo esto"

In italiano: prima di fare il push, sistemiamo KMP. Compose Multiplatform e l'Android Gradle Plugin, ecc.; e inoltre, quando finisci, lancia il verificatore indipendente con tutto questo.

La spec S6 cita di nuovo la seconda metà, "lanza el verificador independiente con todo esto" ("lancia il verificatore indipendente con tutto questo"), come requisito a sé: un controllo indipendente dell'intera funzionalità prima del push.

### Registrato nel log di task: come è stato trovato e costruito

Queste sono le note dell'agente, non le parole dell'autore. La voce di log L4 registra la lacuna che ha portato alla richiesta: "Compose Multiplatform and the Android Gradle Plugin are coupled to Kotlin and Gradle versions like Expo modules to the SDK, and no rule here knows them" (Compose Multiplatform e l'Android Gradle Plugin sono legati alle versioni di Kotlin e di Gradle come i moduli Expo all'SDK, e nessuna regola qui li conosce). La L5 (2026-11-06) registra la ricerca: la tabella di AGP "matched row by row" (confrontata riga per riga) con la pagina di Google, i minimi di Kotlin da kotlinlang.org, che Compose Multiplatform "has no official per-version table" (non ha una tabella ufficiale per versione) così i suoi minimi vengono dal suo CHANGELOG, e la decisione di lasciare fuori il compilatore di Compose.

La L6 registra cosa ha trovato il verificatore indipendente: due blocchi sull'intera funzionalità, uno dei quali in queste regole. `isCompose` prendeva `org.jetbrains.compose.hot-reload` e `material3.adaptive`, "which version on their own" (che hanno versioni proprie). Entrambi sono stati corretti in un solo lotto di correzioni.

### Ricostruzione dalla cronologia dei commit

Da `git log -- hooks/kmp.ts hooks/wrapper.ts hooks/actions.ts` e `git log -S COMPILER_PLUGINS` in narsil-check:

- `4ea9be0` (2026-11-04) "feat: block upgrades kept on purpose and Kotlin past its compiler plugins" (blocca gli aggiornamenti trattenuti apposta e Kotlin oltre i suoi plugin del compilatore). I sette plugin, trovati per coordinata o per chiave del catalog, con KSP controllato con esattezza. Il suo messaggio nomina il controllo su cui è stato fatto: su un modello KMP, "Kotlin 2.4.20 -> 2.4.21 is now blocked by SKIE and Mokkery" (Kotlin 2.4.20 -> 2.4.21 ora è bloccato da SKIE e Mokkery).
- `1637e94` (2026-11-06) "feat: block Android and KMP upgrades the rest of the build cannot take" (blocca gli aggiornamenti Android e KMP che il resto della build non può accettare). Le quattro tabelle. Il suo messaggio: "Tables quote Google's and JetBrains' documentation; a version past them waits to be confirmed. The Gradle wrapper is read as context and never committed." (le tabelle citano la documentazione di Google e di JetBrains; una versione oltre di esse aspetta una conferma. Il wrapper di Gradle viene letto come contesto e mai committato).
- `40e5723` (2026-11-06) "fix: date Go +incompatible versions at the base path and keep Compose rules to its own line" (data le versioni Go +incompatible sul percorso di base e limita le regole di Compose alla sua linea). I due blocchi del verificatore.
- `7048580` (2026-11-09) "feat: check the Gradle wrapper and GitHub Actions for upgrades" (controlla gli aggiornamenti del wrapper di Gradle e delle GitHub Actions). Il wrapper come ecosistema a sé, bloccato con un checksum, e l'adattatore delle actions.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nella mia mod di Claude Code `my-panel`, che elenca gli aggiornamenti Gradle da `gradle/libs.versions.toml`, blocca quelli che il resto della build non può accettare, con il motivo come frase. Leggi il Gradle del wrapper dal `distributionUrl` in `gradle/wrapper/gradle-wrapper.properties`. Tieni tre tabelle in un unico modulo puro, ciascuna con l'URL della documentazione da cui viene e la versione a cui è aggiornata: minor di AGP verso Gradle minimo (le note di release di AGP di Google), Kotlin verso AGP e Gradle minimi (la pagina di configurazione di Gradle di kotlinlang.org), e minor di Compose Multiplatform verso Kotlin e AGP minimi (il suo CHANGELOG). Controlla solo i minimi. Una versione di AGP o di Compose più nuova della sua tabella, o AGP senza wrapper, blocca con "conferma". Quando Kotlin sale e il progetto dichiara KSP, blocca se il prefisso `x.y.z-` di KSP non è il nuovo Kotlin; per SKIE, blocca e chiedi di confermare. Scrivi un test per regola con un elenco di dipendenze e un testo di wrapper, compresa una versione oltre la tabella.

## Il codice minimo

Questa è una versione ridotta dell'idea, scritta per questa guida. È TypeScript semplice senza API della mod; si inserisce nel `conflictsOf` di un adattatore come nella guida 6. È adattata da `hooks/kmp.ts` e da `kotlinConflicts` in `hooks/maven.ts` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Le tabelle sono ridotte a poche righe; i valori sono quelli di `hooks/kmp.ts`.

```ts
type Dep = { name: string; version: string }

// AGP minor -> minimum Gradle (a few rows of Google's table).
const AGP_GRADLE: Record<string, string> = {
  '9.0': '9.1.0',
  '8.13': '8.13',
  '8.12': '8.13',
  '8.11': '8.13',
  '8.10': '8.11.1',
}
// Kotlin from -> minimum AGP and Gradle (kotlinlang.org).
const KOTLIN_MIN = [
  { from: '2.4.0', agp: '8.5.2', gradle: '7.6.3' },
  { from: '2.3.0', agp: '8.2.2', gradle: '7.6.3' },
]

const parts = (v: string) =>
  v
    .split(/[.-]/)
    .slice(0, 3)
    .map((n) => Number.parseInt(n, 10) || 0)
const below = (a: string, b: string) => {
  const [x, y] = [parts(a), parts(b)]
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0)
  return false
}

export function gradleOf(wrapper: string): string | undefined {
  return /distributionUrl\s*=.*gradle-(\d+(?:\.\d+){0,2})-(?:bin|all)\.zip/.exec(wrapper)?.[1]
}

const AGP = 'com.android.tools.build:gradle'
const isKotlin = (name: string) => /^org\.jetbrains\.kotlin[.:]/.test(name)
const isKsp = (name: string) => /^com\.google\.devtools\.ksp[.:]/.test(name)

export function conflicts(
  name: string,
  target: string,
  deps: Dep[],
  gradle: string | undefined,
): string[] {
  const out: string[] = []
  const agp = deps.find((d) => d.name === AGP)?.version

  if (name === AGP) {
    const needs = AGP_GRADLE[/^(\d+\.\d+)/.exec(target)?.[1] ?? '']
    if (!needs) out.push(`AGP ${target} is newer than the table: confirm which Gradle it needs`)
    else if (!gradle) out.push(`AGP ${target} needs Gradle ${needs}; no wrapper to confirm it`)
    else if (below(gradle, needs))
      out.push(`AGP ${target} needs Gradle ${needs} or later; the wrapper uses ${gradle}`)
  }

  if (isKotlin(name)) {
    const needs = KOTLIN_MIN.find((k) => !below(target, k.from))
    if (needs && agp && below(agp, needs.agp))
      out.push(`Kotlin ${target} needs AGP ${needs.agp} or later; the project uses ${agp}`)
    if (needs && gradle && below(gradle, needs.gradle))
      out.push(`Kotlin ${target} needs Gradle ${needs.gradle} or later`)
    for (const d of deps.filter((d) => isKsp(d.name))) {
      const builtFor = /^(\d+\.\d+\.\d+)-/.exec(d.version)?.[1]
      if (builtFor && builtFor !== target)
        out.push(`KSP ${d.version} is built for Kotlin ${builtFor}: a KSP for ${target} is needed`)
    }
  }
  return out
}
```

`conflicts('com.android.tools.build:gradle', '8.13.0', deps, '8.11.1')` restituisce la frase su Gradle 8.13. Qualsiasi frase sposta la riga nel tuo gruppo dei bloccati.

## Errori comuni e come testarlo

Questi vengono dal codice, dai test e dal log di task di Narsil Check:

- **Trattare una patch di Kotlin come banale.** Con un plugin del compilatore nella build non lo è. Controlla i plugin a ogni salto di Kotlin.
- **Non vedere un plugin letto solo tramite il catalog.** Un modulo `build-logic` può non nominare nessuna coordinata. Guarda anche le chiavi del catalog.
- **Controllare i massimi.** Sono "fully supported" (pienamente supportati), non limiti. Bloccare su di essi trattiene build che funzionano.
- **Tirare a indovinare oltre la tabella.** Una versione sconosciuta dovrebbe chiedere, non passare.
- **Far scattare le regole di migrazione ad AGP 9 a ogni aggiornamento di AGP 9.** Appartengono al passaggio dalla 8.x; un test ha colto proprio questo.
- **Riconoscere un gruppo in modo troppo largo.** `org.jetbrains.compose.*` include artifact con versioni proprie. Nomina i gruppi della linea principale.
- **Tabelle senza fonte.** Scrivi l'URL e la versione "as of" (aggiornata a) accanto a ciascuna, così chi viene dopo sa dove controllare.
- **Riscrivere un wrapper con checksum.** La somma cambia con la distribuzione. Blocca e dai il comando.

Per testare, `claude plugin test .` esegue `tests/kmp.test.tsx`: "the Android Gradle Plugin cannot go past what the Gradle wrapper runs" (l'Android Gradle Plugin non può andare oltre ciò che esegue il wrapper di Gradle), "AGP 9 refuses KMP modules on com.android.library and kapt" (AGP 9 rifiuta i moduli KMP su com.android.library e kapt), "Kotlin cannot go past the AGP and Gradle its Gradle plugin supports at least" (Kotlin non può andare oltre l'AGP e il Gradle che il suo plugin di Gradle supporta come minimo), "Compose Multiplatform cannot go past the Kotlin and AGP it needs" (Compose Multiplatform non può andare oltre il Kotlin e l'AGP di cui ha bisogno), "KSP from 2.3.12 needs AGP 8.12" (KSP dalla 2.3.12 ha bisogno di AGP 8.12), "artifacts under org.jetbrains.compose on their own version line are not Compose Multiplatform" (gli artifact sotto org.jetbrains.compose con una propria linea di versione non sono Compose Multiplatform) e "a wrapper under android/, as a React Native project keeps it, gives the Gradle version too" (anche un wrapper sotto android/, come lo tiene un progetto React Native, dà la versione di Gradle). `tests/wrapper.test.tsx` ha "a wrapper that checks a checksum is blocked with the reason, since the sum changes too" (un wrapper che controlla un checksum viene bloccato con il motivo, perché cambia anche la somma) e "the vulnerabilities check never asks OSV about the wrapper, which it does not know" (il controllo delle vulnerabilità non chiede mai a OSV del wrapper, che non conosce); `tests/actions.test.tsx` ha "a new tag whose commit cannot be read leaves every workflow as it was and says which" (un nuovo tag il cui commit non si può leggere lascia ogni workflow com'era e dice quale).

## Per andare oltre

- Le tabelle invecchieranno. Un piccolo script che scarica le pagine di Google e di JetBrains e le confronta con le tabelle direbbe quando aggiornarle.
- Rilevare il riferimento `kotlin` condiviso del version catalog permetterebbe al pannello di dire "alza Kotlin e il compilatore di Compose insieme" invece di lasciarlo implicito.
- Il wrapper android/ di un progetto React Native potrebbe ricevere una riga informativa, senza pulsante.

Questa è l'ultima guida del percorso "Il tuo pannello di revisione". Il suo indice elenca tutte e diciassette le guide, dal pannello laterale a questi strumenti di build, se vuoi tornare a una qualsiasi funzionalità. Per le basi su cui poggia ogni guida, le guide "Basi delle mod" trattano di cosa è fatta una mod, l'oggetto `$`, come installare, ricaricare, validare e testare una mod, le superfici su cui gira, e cosa significa la GPL v3 di Narsil quando ne riutilizzi il codice.
