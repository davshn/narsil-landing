---
title: Versioni fissate apposta
description: 'Come Narsil Check legge un commento come "# pinned: 3.7 breaks auth" in un manifest e tiene quella libreria fuori dal pulsante di aggiornamento, con il commento come motivo.'
route: check
order: 11
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/adapter.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/swiftpm.ts
  - repo: check
    path: hooks/npm.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/holds.test.tsx
---

## Cosa fa

A volte una versione è vecchia apposta. Una libreria ha rotto qualcosa nella release successiva, un plugin supporta solo questa, oppure il team ha deciso di aspettare una migrazione. Chi ha deciso di solito lascia un commento accanto alla versione, e la persona successiva che guarda il manifest lo legge.

Anche uno strumento che alza le versioni dovrebbe leggerlo. In Narsil Check, un commento che dice che la versione è tenuta apposta manda quella libreria in **Bloqueada** (Bloccata), e il commento stesso è il motivo sotto la riga:

```toml
[versions]
# Fijar 2.4.20 hasta confirmar soporte de SKIE para 2.4.21
kotlin = "2.4.20"
ktor = "3.6.1" # pinned: 3.7 breaks auth
```

Questo esempio viene dal README. Il primo commento significa "Fissare 2.4.20 finché non si conferma il supporto di SKIE per 2.4.21". Nel pannello, la riga di ktor riceve:

```text
Fijada a propósito: «pinned: 3.7 breaks auth»
```

Cioè "Fissata apposta", seguito dal commento ("fissata: la 3.7 rompe l'autenticazione"). Il pulsante **Actualizar las N** ("Aggiorna le N") non prende mai una libreria bloccata, quindi la decisione scritta nel manifest resta valida finché qualcuno non rimuove il commento.

## Come funziona dentro

### Le parole: `HOLD`

Il brief del task per questo percorso colloca il rilevamento in `hooks/words.ts`; nel codice sta in `hooks/adapter.ts`, accanto al contratto che rispetta ogni ecosistema. È un'unica espressione regolare:

```ts
const HOLD =
  /\b(pin(ned)?|hold|keep|freeze|frozen|do ?n[o']t (upgrade|update|bump)|fij(ar|ad[oa]|o)|congelad[oa]|no (actualizar|subir))\b/i
```

È citata da [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). In inglese riconosce pin, pinned, hold, keep, freeze, frozen, "do not" o "don't" seguiti da upgrade, update o bump; e in spagnolo, fijar, fijado, fijada, fijo ("fissare", "fissato"), congelado o congelada ("congelato"), "no actualizar" e "no subir" ("non aggiornare", "non alzare"). Ignora le maiuscole, e `\b` la limita a parole intere, quindi "keeper" o "pinch" non contano.

Il README elenca la maggior parte di queste parole ma non tutte: "frozen", "fijo", "no subir" e le forme con "update" e "bump" stanno solo nel codice.

### Quale commento conta: `commentOf` e `holdNote`

`commentOf` trova il commento che porta una riga: dopo `#`, `//` o `<!--` (preceduti da uno spazio o all'inizio della riga), togliendo un `-->` di chiusura. Questi tre coprono ogni manifest che la mod legge e che ammette commenti: TOML (`Cargo.toml`, `pyproject.toml`, il version catalog di Gradle), `requirements.txt`, `pubspec.yaml`, il `Gemfile`, `go.mod`, gli script Gradle, `Package.swift` e l'XML di `pom.xml` e dei file `.csproj`.

`holdNote(files, keys, spec)` cerca poi, in ogni file che l'adattatore ha letto, la riga che scrive questa dipendenza:

1. La riga deve contenere la versione così come è scritta (`spec`) e nominare una delle `keys` come nome intero. Le chiavi sono il nome della dipendenza, il suo nome visualizzato e, per una riga di un version catalog, la sua chiave di versione (`kotlin` in `versions.kotlin`).
2. Il commento su quella riga conta.
3. La riga sopra conta solo quando è un commento da sola. Un commento in coda sulla riga sopra appartiene a un'altra dichiarazione.

Ogni regola esiste per un motivo che i test fissano. "Another library's line with the same version is not this one's" (la riga di un'altra libreria con la stessa versione non è di questa): `other = "2.4.20" # keep` non trattiene kotlin. Un commento senza parola di blocco, come `# the DI library`, "is only a comment" (è solo un commento). E lo stesso controllo funziona per un `// do not upgrade: needs JDK 21` di Gradle e per un `# hold until the 8.0 migration` di un Gemfile.

### Dove si unisce all'analisi

`scanGeneric` in `hooks/register.tsx`, l'analisi da cui passa ogni ecosistema tranne npm, la chiama per ogni aggiornamento dopo che il registry ha risposto:

```ts
const hold = holdNote(files, [u.name, u.display ?? '', ref ?? ''], u.spec)
u.conflicts = [
  ...(hold ? [`Fijada a propósito: «${hold}»`] : []),
  ...(adapter.conflictsOf?.(u, deps, files) ?? []),
  ...(young.get(u) ?? []),
]
if (u.conflicts.length > 0) u.group = 'blocked'
```

Citato da [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later), riformattato. Il motivo del blocco va per primo, prima di ciò che l'ecosistema sa di rompere e dell'attesa di 24 ore della guida precedente. Qualsiasi motivo rende l'aggiornamento `blocked`, quindi una patch fissata è bloccata quanto una major fissata.

Il pannello poi la disegna come qualsiasi riga bloccata: i motivi uniti da `·` in rosso sotto la libreria. Una pressione sulla riga copia il salto con i suoi motivi, pronto da incollare in una issue.

### Perché npm resta fuori

`package.json` è JSON, e JSON non ha commenti. `scanNpm` non chiama mai `holdNote`, e il README lo dice: il controllo gira "en cualquier ecosistema cuyo manifest admite comentarios (todos menos npm, cuyo `package.json` no los tiene)" ("in qualsiasi ecosistema il cui manifest ammette commenti: tutti tranne npm, il cui `package.json` non ne ha").

Quello che npm ha è un'idea diversa con un nome simile. Le "versioni fissate nell'albero" (la guida precedente) sono versioni esatte che un altro pacchetto installato richiede, lette da `package-lock.json`, non la decisione di una persona. Nemmeno scrivere una versione esatta in `package.json` (`"1.2.0"` invece di `"^1.2.0"`) viene letto come blocco: il pulsante di aggiornamento la alza comunque, passando la nuova versione al package manager senza prefisso (`rangeFor` in `hooks/npm.ts`, vedi la guida 12).

Una riga del README qui può confondere. Il suo elenco di dettagli dice "Expo, peerDependencies y versiones fijadas se revisan solo en npm" ("Expo, le peer dependency e le versioni fissate si controllano solo in npm"). In quella riga, "versioni fissate" significa i pin nell'albero di npm, non i commenti di questa guida, che si controllano ovunque tranne in npm.

### Fissata dalla sintassi, non da un commento

Due ecosistemi hanno un loro modo di dire "questa versione esatta", e la mod tratta anche quello come una decisione:

- **SwiftPM.** Un requisito scritto con `exact:` in `Package.swift`, o `exactVersion` in un progetto Xcode, imposta `isExact` sulla dipendenza. Il `conflictsOf` dell'adattatore SwiftPM dà allora "Fijada a la versión exacta 1.2.0: revisa por qué antes de subirla" ("Fissata alla versione esatta 1.2.0: controlla perché prima di alzarla"). Il motivo del README: "suele ser una decisión a propósito" ("di solito è una decisione presa apposta").
- **Gradle.** Una libreria che un `gradle.lockfile` tiene a un'altra versione viene bloccata, perché una build con il locking la rifiuta finché il lock non viene rigenerato con `--write-locks`.

### Perché un commento, e non un file di impostazioni

Il codice e i commit non registrano perché il blocco stia nei commenti del manifest invece che in un elenco proprio della mod. Leggendo il design: il commento è già dove le persone scrivono decisioni del genere, viaggia con il repository verso chiunque nel team, e porta il suo motivo, che è esattamente ciò che la riga bloccata deve mostrare. Un elenco salvato dalla mod vivrebbe su una sola macchina e non direbbe niente sul perché. Questo ragionamento è un'interpretazione, non una decisione registrata.

## Costruiscila con Claude

Chiedi a Claude una funzione pura che trovi un commento di blocco accanto alla versione di una dipendenza e blocchi quell'aggiornamento con il commento come motivo. L'unica idea che deve fare bene è quale commento appartiene a quale dipendenza.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nella mia mod di Claude Code `my-panel`, che elenca le dipendenze non aggiornate da `Cargo.toml` e `pyproject.toml`, blocca qualsiasi dipendenza la cui versione sia tenuta apposta da un commento. Scrivi una funzione pura `holdNote(files, keys, spec)`: per ogni riga che contiene la versione `spec` e nomina una delle `keys` come nome intero, leggi il commento dopo `#`, `//` o `<!--` su quella riga, o sulla riga sopra solo quando quella riga è un commento da sola, e restituiscilo quando contiene una parola di blocco (pin, pinned, hold, keep, freeze, "do not upgrade", e gli spagnoli fijar, fijado, congelado, "no actualizar"), riconoscendo parole intere e ignorando le maiuscole. Metti una dipendenza bloccata nel gruppo `blocked` con il motivo "Fissata apposta: «commento»", e tienila fuori dal pulsante "Aggiorna tutto". Salta `package.json`, che non ha commenti. Testa che un commento in coda sulla riga sopra non conti, che la riga di un'altra dipendenza con la stessa versione non conti, e che un commento senza parola di blocco non blocchi.

### Cosa controllare nella risposta di Claude

1. La riga deve contenere la versione così come è scritta e nominare la dipendenza come nome intero, così un'altra libreria con la stessa versione, o `kotlin` dentro `kotlinx`, non conta.
2. Un commento sulla riga sopra conta solo quando quella riga è soltanto un commento. Un commento in fondo alla riga sopra appartiene a un'altra dichiarazione.
3. Le parole di blocco valgono solo come parole intere e ignorano maiuscole e minuscole, e un commento senza una parola di blocco, come `# the DI library`, non blocca.
4. Una dipendenza trattenuta finisce nel gruppo bloccato con il commento come motivo, e il pulsante "Aggiorna tutto" non la prende mai.
5. `package.json` viene saltato, perché JSON non ha commenti.

Se un controllo fallisce, di' a Claude cosa vedi: "Kotlin è bloccato da un commento "pin" scritto sulla riga di kotlinx-coroutines".

### Come l'ha chiesta l'autore

La richiesta originale per questa funzionalità non è stata registrata: nessun log di task pubblico in narsil-check la copre. Quella che segue è una ricostruzione.

#### Ricostruzione dalla cronologia dei commit

Da `git log -S holdNote` e `git log -S lockConflicts` in narsil-check:

- `4ea9be0` (2026-11-04) "feat: block upgrades kept on purpose and Kotlin past its compiler plugins" (blocca gli aggiornamenti tenuti apposta e Kotlin oltre i suoi plugin del compilatore). L'intera funzionalità in un solo commit. Il suo messaggio: "A comment with a hold word (pin, hold, keep, freeze, do not upgrade, fijar, congelado, no actualizar) on a version's line, or alone on the line above, blocks that upgrade with the comment as its reason." (un commento con una parola di blocco sulla riga di una versione, o da solo sulla riga sopra, blocca quell'aggiornamento con il commento come motivo). Ha anche rinominato il gruppo da "Bloqueada por otras dependencias" ("Bloccata da altre dipendenze") a semplicemente **Bloqueada**, "since a dependency is no longer its only reason" (perché una dipendenza non è più il suo unico motivo). Il messaggio nomina il caso su cui è stato verificato: un template Kotlin Multiplatform in cui la patch di Kotlin ora è bloccata dai suoi plugin del compilatore.
- `7125ffd` (2026-11-09) "fix: stop the upgrade button from breaking builds it cannot check" (impedisce al pulsante di aggiornamento di rompere build che non può controllare). Aggiunge i due pin dalla sintassi: una libreria Gradle che un `gradle.lockfile` trattiene, e "a Swift package pinned to an exact version. Neither counts as trivial any more." (un pacchetto Swift fissato a una versione esatta. Nessuno dei due conta più come banale).

Il commit abbina il controllo dei commenti alla regola dei plugin del compilatore di Kotlin, e il file di test che copre entrambi è `tests/holds.test.tsx`. I due condividono un'idea: alcuni aggiornamenti sembrano banali dal numero e non lo sono, e il motivo va mostrato a parole.

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida. Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

Questa è una versione ridotta dell'idea, scritta per questa guida. È TypeScript semplice senza API della mod, adattato da `hooks/adapter.ts` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later).

```ts
const HOLD =
  /\b(pin(ned)?|hold|keep|freeze|frozen|do ?n[o']t (upgrade|update|bump)|fij(ar|ad[oa]|o)|congelad[oa]|no (actualizar|subir))\b/i

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function commentOf(line: string): string | undefined {
  const m = /(?:^|\s)(?:#|\/\/|<!--)\s*(.*?)\s*(?:-->)?\s*$/.exec(line)
  return m?.[1]
}

function mentions(line: string, key: string): boolean {
  return new RegExp(`(^|[^\\w.-])${escape(key)}([^\\w.-]|$)`).test(line)
}

// The comment that holds a dependency, from the files of its manifests.
export function holdNote(
  files: Record<string, string>,
  keys: string[],
  spec: string,
): string | undefined {
  for (const text of Object.values(files)) {
    const lines = text.split(/\r?\n/)
    for (let n = 0; n < lines.length; n++) {
      const line = lines[n] ?? ''
      if (!line.includes(spec) || !keys.some((k) => k && mentions(line, k))) continue
      const above = lines[n - 1] ?? ''
      for (const candidate of [line, /^\s*(#|\/\/|<!--)/.test(above) ? above : '']) {
        const comment = commentOf(candidate)
        if (comment && HOLD.test(comment)) return comment
      }
    }
  }
  return undefined
}

// In the scan, after the registry answered:
// const hold = holdNote(files, [dep.name], dep.spec)
// if (hold) { upgrade.conflicts.push(`Pinned on purpose: «${hold}»`); upgrade.group = 'blocked' }
```

Passa solo i file dell'ecosistema che stai analizzando. Il controllo `mentions` impedisce a `kotlin` di riconoscere `kotlinx-coroutines`, perché un punto o un trattino accanto al nome significano che fa parte di un nome più lungo.

## Errori comuni e come testarlo

Questi vengono dal codice e dai test di Narsil Check:

- **Contare un commento in coda sulla riga sopra.** In `a = "1.0" # keep` seguito da `b = "1.0"`, il commento è di `a`. Solo un commento da solo sulla sua riga parla per la successiva.
- **Riconoscere solo la versione.** Due librerie possono condividere la stessa stringa di versione. La riga deve nominare anche la dipendenza.
- **Riconoscere parte di un nome.** `kotlin` dentro `kotlinx` è un'altra libreria; il nome deve stare da solo.
- **Parole troppo ampie.** `keep` riconosce anche un commento come "keep in sync with the server" (tienilo allineato con il server), che bloccherebbe quella libreria. Deriva dalla regex; se i tuoi progetti usano commenti del genere, restringi l'elenco.
- **Cercare commenti in JSON.** Non ce ne sono; non inventare una convenzione che il file non può portare, o documentala chiaramente se lo fai.
- **Nascondere il motivo.** Il commento è la cosa più utile da mostrare: è la spiegazione della persona stessa.

Per testare, `claude plugin test .` esegue `tests/holds.test.tsx`. "a comment with a hold word on the version line, or the line above, keeps it" (un commento con una parola di blocco sulla riga della versione, o sulla riga sopra, la trattiene) chiama `holdNote` con righe TOML, Gradle e Gemfile, compresi i casi che non devono contare. "a version kept by a comment is blocked with that comment" (una versione trattenuta da un commento è bloccata con quel commento) passa per tutto il pannello con `$.ui.mount`: trova il testo "Fijada a propósito: «keep: 1.11.1 breaks the iOS test runner»" e controlla che non venga disegnato nessun pulsante **Actualizar**.

## Per andare oltre

- Un blocco potrebbe avere una scadenza: "pin until 2027-01" potrebbe smettere di bloccare dopo quella data. Narsil Check non lo fa; il commento trattiene finché qualcuno non lo rimuove.
- npm potrebbe avere una convenzione sua, come una chiave sotto un campo personalizzato in `package.json`. La mod non ne ha, e il README dice chiaramente che npm non viene controllato.
- La prossima guida legge le note di release di un salto major con Haiku, che spesso è proprio il modo in cui qualcuno trova il motivo per scrivere un commento di blocco.
