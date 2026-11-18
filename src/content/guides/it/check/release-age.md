---
title: L'attesa di 24 ore
description: 'Perché Narsil Check non alza mai una versione pubblicata meno di un giorno fa, dove ogni registry dice quando è uscita una versione e cosa succede quando nessuno sa dirlo.'
route: check
order: 9
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/npm.ts
  - repo: check
    path: hooks/adapter.ts
  - repo: check
    path: hooks/pypi.ts
  - repo: check
    path: hooks/cargo.ts
  - repo: check
    path: hooks/golang.ts
  - repo: check
    path: hooks/pub.ts
  - repo: check
    path: hooks/nuget.ts
  - repo: check
    path: hooks/rubygems.ts
  - repo: check
    path: hooks/maven.ts
  - repo: check
    path: hooks/swiftpm.ts
  - repo: check
    path: hooks/actions.ts
  - repo: check
    path: hooks/wrapper.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/release-age.test.tsx
  - repo: check
    path: tests/released.ts
  - repo: check
    path: odd/tasks/release-age-all-ecosystems.md
---

## Cosa fa

Una versione pubblicata un'ora fa non ha avuto il tempo di essere provata da nessuno. Se è rotta, o se è stata pubblicata da un account di un maintainer compromesso, le prime persone ad accorgersene sono quelle che l'hanno installata per prime. I registry e i maintainer ritirano davvero le release difettose, ma solo dopo che qualcuno se ne accorge, e questo richiede tempo.

Narsil Check dà a ogni release quel tempo. In ogni ecosistema che legge, una versione pubblicata meno di 24 ore fa non sale: finisce nel gruppo **Bloqueada** (Bloccata), con il motivo sotto la riga in rosso:

```text
Publicada hace 3 h: Narsil Check espera 24 h antes de subirla
```

Cioè "Pubblicata 3 h fa: Narsil Check aspetta 24 h prima di alzarla". Il README dà lo stesso motivo con parole sue: una versione "que todavía nadie ha probado o que puede venir de una cuenta comprometida" ("che nessuno ha ancora provato o che può venire da un account compromesso") non entra da sola nel progetto.

Per te non cambia nient'altro. La riga mostra ancora il salto, il pulsante **Actualizar las N** ("Aggiorna le N") la lascia fuori, e la prima analisi dopo che è passato il giorno la riporta nel suo gruppo normale.

## Come funziona dentro

L'attesa ha quattro parti: dove ogni registry tiene la data, cosa conta come prova quando non c'è una data, come si legge la regola propria di un progetto pnpm e come l'installazione stessa viene trattenuta allo stesso giorno.

### Da dove viene la data

Ogni adattatore indica l'indirizzo dove il suo registry risponde "quando è stata pubblicata questa versione", e come leggere la data dalla risposta. Sono due campi opzionali del contratto in `hooks/adapter.ts`:

- `releasedUrls(name, version)`: gli indirizzi da provare, in ordine.
- `releasedOf(text, headers)`: la data che dà una risposta, dal suo corpo o dalle sue intestazioni in minuscolo.

Cosa legge ogni adattatore, come lo ha il codice:

| Ecosistema     | Dove sta la data                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------ |
| npm ed Expo    | la mappa `time` del packument; quando non arriva, `pnpm view <name> time --json` o quello di npm |
| PyPI           | `/pypi/<name>/<version>/json`: il `upload_time_iso_8601` più vecchio tra i file della release    |
| Go             | il `/@v/<version>.info` del proxy: `Time`                                                        |
| Cargo          | crates.io `/api/v1/crates/<name>/<version>`: `version.created_at`                                |
| Pub            | pub.dev `/api/packages/<name>/versions/<version>`: `published`                                   |
| NuGet          | la registrazione SemVer 1, poi quella SemVer 2: `published`                                      |
| RubyGems       | `/api/v2/rubygems/<name>/versions/<version>.json`: `created_at`                                  |
| Maven, Gradle  | il POM della versione, nel suo repository e nel Gradle Plugin Portal: `Last-Modified`            |
| SwiftPM        | la release di GitHub per il tag (`<tag>` o `v<tag>`): `published_at`                             |
| GitHub Actions | come per SwiftPM, attraverso il repository dell'action                                           |
| Gradle wrapper | `services.gradle.org/versions/current`: `buildTime`                                              |

Due scelte di quella tabella vale la pena capirle.

**PyPI legge il file più vecchio.** Una release può ricevere altri file più tardi (una wheel per una nuova piattaforma). Il commento dice perché conta il primo: "The earliest file of the release: when it became installable." (il file più vecchio della release: quando è diventata installabile).

**SwiftPM legge la release, non il commit.** La prima versione leggeva la data del commit del tag. Il verificatore indipendente registrato nel log del task ha fatto notare che una data del committer "can be forged" (si può falsificare), e la correzione è passata al `published_at` della release di GitHub, che imposta GitHub stesso. Il README lo dice: "Es una fecha que pone GitHub, no la del commit, que el autor podría falsificar" ("È una data che mette GitHub, non quella del commit, che l'autore potrebbe falsificare").

npm è l'eccezione al contratto: la sua ricerca della data sta in `hooks/register.tsx` (`npmTimes`), perché l'host non restituisce un packument molto grande. Il commento nomina quelli di astro e di tailwindcss, "~10 MB". Quando il packument non arriva o non contiene la versione, la mod chiede invece al package manager.

### Chiedere una volta, tenerla per sempre

`releasedAt` in `hooks/register.tsx` interroga quegli indirizzi con `$.http.fetch` e tiene la risposta in `$.store` sotto `published:<ecosystem>:<name>@<version>` (la chiave di npm non ha la parte dell'ecosistema). Una data di pubblicazione non cambia mai, quindi non ha timer, a differenza della cache di sei ore delle versioni più recenti.

Si tiene solo una data valida. `dateOf` accetta una stringa che `Date.parse` sa leggere e nient'altro, quindi una pagina di errore o un campo vuoto non vengono mai salvati come data, e l'analisi successiva chiede di nuovo.

### Quando nessuno sa dirlo

Alcune versioni non hanno una data leggibile: un tag Swift senza release su GitHub, un pacchetto fuori da GitHub, un registry che non risponde. La regola fissata dall'autore (citata sotto) è che niente sale senza la prova che ha aspettato. Una prima versione di quella regola bloccava queste versioni per sempre, il che ha sollevato la domanda ovvia.

La risposta è `firstSeen`. La prima volta che la mod incontra una versione senza data, scrive l'ora attuale sotto `seen:<ecosystem>:<name>@<version>`. Una versione non può essere più giovane del momento in cui è stata vista per la prima volta, quindi 24 ore dopo è pubblicata da almeno un giorno. Nel frattempo la riga dice:

```text
No pude leer cuándo se publicó y la vi por primera vez hace 3 h: Narsil Check espera 24 h antes de subirla
```

Cioè "Non sono riuscito a leggere quando è stata pubblicata e l'ho vista per la prima volta 3 h fa: Narsil Check aspetta 24 h prima di alzarla". Un'ora salvata successiva al momento attuale viene ignorata e sostituita, così un orologio tornato indietro non trattiene una versione più a lungo.

### La regola stessa: `ageConflict`

`ageConflict` in `hooks/npm.ts` trasforma una data, l'ora attuale e un'attesa in minuti in un motivo o in niente. È una funzione pura, quindi i test possono chiamarla con qualsiasi orologio. `RELEASE_AGE` è 1440 minuti, "a day, as pnpm 11's minimumReleaseAge by default" (un giorno, come il minimumReleaseAge predefinito di pnpm 11), con le parole del codice.

`youngConflicts` la esegue per ogni aggiornamento, otto alla volta, prima che vengano decisi i gruppi. I suoi motivi si uniscono agli altri motivi di blocco delle guide precedenti, e qualsiasi motivo manda l'aggiornamento in **Bloqueada**, qualunque sia il suo salto.

### Anche le versioni di Expo aspettano

Un aggiornamento di Expo non è una versione ma un intervallo che risolve `npx expo install --fix`. `expoAgeConflict` prende la versione stabile più recente nei tempi di npm che soddisfa l'intervallo dell'SDK, e controlla quella. Finché è troppo giovane il motivo la nomina, per esempio "El SDK de Expo pide 17.0.8 (npx expo install --fix). Publicada hace 1 h: …" ("L'SDK di Expo chiede la 17.0.8").

### Il `minimumReleaseAge` di pnpm

pnpm ha una sua impostazione per questo, `minimumReleaseAge`, in minuti. Il commento del codice dice cosa presuppone al riguardo: "pnpm 11 and later wait one day unless pnpm-workspace.yaml or .npmrc says otherwise; pnpm 10 waited for nothing." (pnpm 11 e successivi aspettano un giorno a meno che pnpm-workspace.yaml o .npmrc non dicano altro; pnpm 10 non aspettava niente).

`releaseAgeOf` in `hooks/npm.ts` la legge in quest'ordine: `minimumReleaseAge:` in `pnpm-workspace.yaml`, poi `minimum-release-age` in `.npmrc`, poi la major di pnpm fissata in `packageManager` (sotto la 11 dà 0), altrimenti 1440. `releaseMinutes` in `hooks/register.tsx` lo fa solo quando esiste `pnpm-lock.yaml`, e legge i file come li tiene `HEAD`, con `git show HEAD:<path>`. Il README spiega perché: la CI installa dal commit, e una versione che il pannello avesse alzato in anticipo farebbe fallire il `pnpm install --frozen-lockfile` della CI.

Dalle parole dell'autore seguono due regole:

- **Vince l'attesa più lunga.** Un progetto pnpm con 2880 minuti aspetta due giorni, con il motivo "pnpm espera 48 h para instalarla (minimumReleaseAge)" ("pnpm aspetta 48 h per installarla"). Un valore più breve non abbassa mai il giorno.
- **Nessuna eccezione.** `minimumReleaseAgeExclude` non viene mai letto. Il commento è breve: "the wait has no exceptions here." (qui l'attesa non ha eccezioni).

### Trattenere anche l'installazione

Bloccare la riga copre solo la libreria che alzi. Le sue dipendenze possono portare dentro qualcosa pubblicato cinque minuti fa. Dove il package manager può rifiutarlo, il pulsante glielo chiede, attraverso `releaseAgeEnv`:

- **pnpm** gira con `PNPM_CONFIG_MINIMUM_RELEASE_AGE` impostato all'attesa, `PNPM_CONFIG_MINIMUM_RELEASE_AGE_STRICT=true` e un elenco di esclusioni vuoto, così una dipendenza giovane fa fallire l'installazione invece di essere scritta come eccezione.
- **npm** gira con `npm_config_before` a un giorno fa, così ogni intervallo si risolve a versioni pubblicate prima di allora.

Quando uno dei due rifiuta, `ageRefusal` riconosce il messaggio dello strumento e il pannello lo dice ("Bloqueada por minimumReleaseAge…", "Bloqueada por la espera de 24 h…", cioè "Bloccata da minimumReleaseAge…", "Bloccata dall'attesa di 24 h…"), senza aggiornare niente. Il README è onesto sul resto: yarn, bun e ogni altro ecosistema non hanno un interruttore del genere, quindi lì l'attesa vale per la libreria che sale, non per ciò che porta con sé.

## Come è stata chiesta all’IA

Questa funzionalità è registrata con le parole dell'autore, nel log di task pubblico di narsil-check `odd/tasks/release-age-all-ecosystems.md`. La guida precedente cita le stesse voci per i gruppi; qui vengono lette per ciò che dicono sull'attesa.

### Registrato: da pnpm a ogni ecosistema

Prima di questo task c'era già un blocco per il `minimumReleaseAge` di pnpm, e l'autore ne aveva fissato la regola correggendolo. Il log del task la tiene come S4, con le parole dell'autore:

> "siempre que haya minimumReleaseAge se bloquee la actualizacion automatica y se marque el bloqueo, sin excepcion alguna"

In italiano: "ogni volta che c'è un minimumReleaseAge, si blocchi l'aggiornamento automatico e si segnali il blocco, senza nessuna eccezione." Quella frase è l'origine di due comportamenti nel codice: un elenco di esclusioni non conta mai, e anche una data che non si riesce a leggere blocca.

La voce di log L1 (2026-11-06) registra la richiesta che l'ha estesa. L'autore ha chiesto se il problema di Expo succedesse anche con KMP o con altri linguaggi, poi ha scelto:

> "El primero me interesa, deberíamos implementar algo similar para los otros lenguajes, es más seguro"

In italiano: "Il primo mi interessa; dovremmo implementare qualcosa di simile per gli altri linguaggi, è più sicuro." Alla domanda su quanto aspettare, la risposta è stata "24 horas está perfecto" ("24 ore va benissimo").

### Cosa ne ha fatto l'agente

Il resto del log sono le note dell'agente, non le parole dell'autore. La voce L2 registra come è stata trovata la data di ogni registry: una prova per registry, con un pacchetto reale, prima di qualsiasi codice. La voce L3 registra il controllo dell'installazione npm: con `npm_config_before` a un giorno fa, npm ha rifiutato una release di tailwindcss di un'ora prima e ha risolto l'intervallo alla precedente. La voce L6 registra le osservazioni del verificatore indipendente, tra cui che una data del committer di SwiftPM "can be forged" (si può falsificare).

### Registrato: la correzione sulle date mancanti

Lo stesso giorno, l'autore ha notato il costo di "una data illeggibile blocca". L7 cita la domanda:

> "que pasa si una version siempre trae fecha ilegible? nunca la vamos a actualizar?"

In italiano: "cosa succede se una versione arriva sempre con una data illeggibile? non la aggiorneremo mai?" Il log registra la proposta dell'agente (aspettare 24 ore da quando la mod ha visto la versione per la prima volta, tenere solo date valide, leggere la data della release di SwiftPM invece di quella del commit) e la risposta dell'autore, "si hazlo asi" ("sì, fallo così"). Il design è dell'agente; la domanda e l'approvazione sono dell'autore.

### Ricostruzione dalla cronologia dei commit

Da `git log -S releasedUrls` e `git log -S ageConflict` in narsil-check:

- `690c1bb` (2026-11-06) "feat: block upgrades pnpm would refuse under minimumReleaseAge" (blocca gli aggiornamenti che pnpm rifiuterebbe sotto minimumReleaseAge). Il suo messaggio dice che le voci di `minimumReleaseAgeExclude` "are honored" (vengono rispettate).
- `54ac6aa` (2026-11-06) "fix: block every upgrade under pnpm's minimumReleaseAge, with no exceptions" (blocca ogni aggiornamento sotto il minimumReleaseAge di pnpm, senza eccezioni). L'elenco di esclusioni ora viene ignorato, una data illeggibile blocca, e le date ripiegano su `pnpm view` perché i packument grandi "never reached the hooks module" (non arrivavano mai al modulo degli hook).
- `1492ca5` (2026-11-06) "feat: hold every ecosystem's upgrades for 24 hours after release" (trattiene gli aggiornamenti di ogni ecosistema per 24 ore dopo la release). Ogni adattatore riceve `releasedUrls`; SwiftPM legge ancora il commit del tag.
- `ca13b3c` (2026-11-06) "feat: hold Expo SDK-pinned versions for 24 hours too" (trattiene per 24 ore anche le versioni fissate dall'SDK di Expo).
- `8c5f2a3` (2026-11-06) "feat: install npm and pnpm upgrades under the 24-hour wait through the whole tree" (installa gli aggiornamenti npm e pnpm sotto l'attesa di 24 ore in tutto l'albero).
- `54cd243` (2026-11-06) "feat: let a version with no readable date go up a day after it was first seen" (lascia salire una versione senza data leggibile un giorno dopo che è stata vista per la prima volta). La correzione di L7, con SwiftPM passato alla data della release.
- `40e5723` (2026-11-06) "fix: date Go +incompatible versions at the base path and keep Compose rules to its own line" (data le versioni Go +incompatible dal percorso base e tiene le regole di Compose sulla propria riga). Un'osservazione del verificatore.
- `7048580` (2026-11-09) "feat: check the Gradle wrapper and GitHub Actions for upgrades" (controlla gli aggiornamenti del Gradle wrapper e delle GitHub Actions). Entrambi i nuovi adattatori arrivano con le loro date.

Lo schema: la regola rigida è venuta per prima ed era giusta, e l'unica correzione l'ha resa rigida senza restare bloccata.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nella mia mod di Claude Code `my-panel`, blocca qualsiasi aggiornamento la cui nuova versione sia stata pubblicata meno di 24 ore fa. Scrivi una funzione pura `ageReason(published, now, minutes, seen)` che restituisca un motivo a parole o `undefined`: con una data valida, blocca finché è più giovane di `minutes`; senza, usa `seen` (quando la mod ha visto la versione per la prima volta) come prova, e blocca quando non c'è né l'una né l'altro. Per PyPI, leggi la data da `https://pypi.org/pypi/<name>/<version>/json` come il `upload_time_iso_8601` più vecchio in `urls`, con `$.http.fetch`. Tieni per sempre una data valida in `$.store` sotto `published:pypi:<name>@<version>` e non salvare mai niente che non sia una data. Tieni l'ora della prima vista sotto `seen:pypi:<name>@<version>`. Metti un aggiornamento bloccato in un gruppo `blocked` con il motivo sotto la sua riga, e tienilo fuori dal pulsante "Aggiorna tutto". Testa la funzione con un `now` fisso: un'ora, due giorni, nessuna data e nessun `seen`, nessuna data e `seen` di un giorno fa.

## Il codice minimo

Questa è una versione ridotta dell'idea, scritta per questa guida e verificata con i tipi di Claude Code 2.1.325 (`$.http.fetch`, `$.store.get`, `$.store.set`). È adattata da `hooks/npm.ts` e `hooks/register.tsx` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Gestisce solo PyPI; un altro registry è un URL in più e un lettore in più.

```ts
import type { EngineInterface } from 'claude-code'

export const WAIT_MINUTES = 24 * 60

const dateOf = (text: unknown) =>
  typeof text === 'string' && !Number.isNaN(Date.parse(text)) ? text : undefined

// Why a version must wait, or undefined when it is old enough.
export function ageReason(
  published: string | undefined,
  now: number,
  minutes: number,
  seen?: number,
): string | undefined {
  const from = published ? Date.parse(published) : seen
  if (from === undefined || Number.isNaN(from))
    return `No publication date: waiting ${minutes / 60} h`
  const age = Math.floor((now - from) / 60_000)
  if (age >= minutes) return undefined
  const ago = age >= 60 ? `${Math.floor(age / 60)} h` : `${age} min`
  return published ? `Published ${ago} ago` : `No date; first seen ${ago} ago`
}

async function releasedAt($: EngineInterface, name: string, version: string) {
  const key = `published:pypi:${name}@${version}`
  const cached = dateOf(await $.store.get(key))
  if (cached) return cached
  const res = await $.http
    .fetch(`https://pypi.org/pypi/${encodeURIComponent(name)}/${encodeURIComponent(version)}/json`)
    .catch(() => undefined)
  let published: string | undefined
  try {
    const files = res?.ok
      ? ((JSON.parse(res.text) as { urls?: { upload_time_iso_8601?: unknown }[] }).urls ?? [])
      : []
    published = dateOf(
      files
        .map((f) => f.upload_time_iso_8601)
        .filter((t): t is string => typeof t === 'string')
        .sort()[0],
    )
  } catch {
    published = undefined
  }
  if (published) await $.store.set(key, published)
  return published
}

async function firstSeen($: EngineInterface, name: string, version: string, now: number) {
  const key = `seen:pypi:${name}@${version}`
  const seen = await $.store.get(key)
  if (typeof seen === 'number' && seen <= now) return seen
  await $.store.set(key, now)
  return now
}

export async function waitReason($: EngineInterface, name: string, version: string) {
  const now = Date.now()
  const published = await releasedAt($, name, version)
  const seen = published ? undefined : await firstSeen($, name, version, now)
  return ageReason(published, now, WAIT_MINUTES, seen)
}
```

Chiama `waitReason` per ogni aggiornamento durante l'analisi, e tratta un motivo restituito come qualsiasi altro motivo di blocco. Nota che, con il ripiego sulla prima vista, il caso "né l'una né l'altro" di `ageReason` si verifica solo se non si può scrivere nell'archivio.

## Errori comuni e come testarlo

Questi vengono dal codice di Narsil Check, dal suo log dei task e dai suoi commit:

- **Lasciar passare una data sconosciuta.** "Nessuna data" non deve mai significare "abbastanza vecchia". La prima versione pnpm di Narsil Check lasciava passare i pacchetti grandi perché le loro date non arrivavano mai.
- **Bloccare per sempre una data sconosciuta.** L'errore opposto, che L7 ha colto. Un'ora di prima vista trasforma "sconosciuta" in "almeno così vecchia".
- **Mettere in cache qualcosa che non è una data.** Una pagina di errore salvata come data verrebbe riletta a ogni analisi. Tieni solo ciò che si legge come data.
- **Fidarsi di una data scritta da chi pubblica.** Una data di commit può essere impostata da chiunque abbia fatto il commit. Preferisci una data impostata dal registry o dall'host.
- **Leggere l'ora del file più recente.** Su PyPI, la release è diventata installabile con il suo primo file.
- **Lasciare che un'impostazione di progetto più breve abbassi l'attesa.** Prendi la più lunga tra la tua regola e quella del progetto.
- **Leggere la copia di lavoro quando la CI legge il commit.** Per questo l'impostazione di pnpm si legge in `HEAD`.

Per testare, `claude plugin test .` esegue `tests/release-age.test.tsx`: "each registry says where and when a version was published" (ogni registry dice dove e quando è stata pubblicata una versione) chiama `releasedUrls` e `releasedOf` di ogni adattatore con la forma di una risposta reale; "a version whose date cannot be read waits a day from when the mod first saw it" (una versione la cui data non si può leggere aspetta un giorno da quando la mod l'ha vista per la prima volta) e "the mod's own wait says so, in every ecosystem" (l'attesa propria della mod lo dice, in ogni ecosistema) chiamano `ageConflict` con un orologio fisso. `tests/released.ts` risponde a ogni URL di data dei registry con una data di un anno fa per impostazione predefinita, così gli altri test non vengono bloccati per caso, e con una data recente per gli URL che un test nomina. Il comportamento di pnpm e npm sta in `tests/upgrade.test.tsx`, per esempio "npm installs with before set a day back, so a range resolves only to versions a day old, its dependencies included" (npm installa con before a un giorno fa, così un intervallo si risolve solo a versioni di un giorno, dipendenze comprese).

## Per andare oltre

- La tabella del README non elenca il Gradle wrapper (il `buildTime` di `services.gradle.org`) né le GitHub Actions (la release, come SwiftPM): entrambi sono arrivati dopo, in `7048580`, e solo il codice mostra da dove vengono le loro date.
- Il log del task elenca gli avvisi che il verificatore ha lasciato aperti, come il limite di GitHub senza autenticazione di 60 richieste all'ora per le date di SwiftPM. Una versione la cui data non si può leggere per quel motivo ripiega sulla prima vista.
- Ventiquattro ore sono una costante, `RELEASE_AGE`. Una mod per un team con una politica più severa potrebbe alzarla, e la regola di pnpm mostra come rispettare un'impostazione di progetto più lunga senza lasciar passare una più breve.
