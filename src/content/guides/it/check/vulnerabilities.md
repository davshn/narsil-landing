---
title: Vulnerabilità con OSV.dev
description: 'Come Narsil Check chiede a OSV.dev di ogni pacchetto installato in una sola query a lotti, classifica ogni avviso dalla sua valutazione o dal suo vettore CVSS, e conta una volta gli avvisi gemelli.'
route: check
order: 15
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/osv.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/words.ts
  - repo: check
    path: hooks/adapter.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/vulns.test.tsx
  - repo: check
    path: odd/tasks/vulnerabilities.md
---

## Cosa fa

Ogni ecosistema ha il suo strumento di audit: `npm audit`, `pip-audit`, `cargo-audit`, `govulncheck`. Un progetto con un front end web, un servizio Python e un'app Gradle ne richiederebbe tre installati, ciascuno con il suo output. Narsil Check chiede a un solo posto per tutti.

Sotto **Actualizaciones** c'è una sezione **Vulnerabilidades**. Dopo ogni analisi legge i pacchetti installati del progetto e chiede a [OSV.dev](https://osv.dev), il database aperto che raccoglie gli avvisi di sicurezza di GitHub, PyPI, Go, crates.io, RubyGems e altri. Mentre lavora la sezione dice `Buscando vulnerabilidades en OSV.dev…` ("Ricerca di vulnerabilità in OSV.dev in corso…"). Poi:

```text
● ▾ Vulnerabilidades · 3
  3 vulnerabilidades en 2 de 412 paquetes · 1 alta · 2 moderadas
  ● ▾ Alta (1)
    left-pad-ish 1.0.2 · indirecta · GHSA-xxxx-xxxx-xxxx
      Prototype pollution in parse()
      Se corrige en 1.0.3
```

Il pacchetto e l'identificatore qui sopra sono illustrativi. La riga di riepilogo si legge "3 vulnerabilità in 2 di 412 pacchetti · 1 alta · 2 moderate". I risultati sono raggruppati per gravità, **Crítica**, **Alta**, **Moderada**, **Baja** e **Sin clasificar** ("non classificata"), e ogni gruppo si chiude per conto suo. Ogni risultato mostra il pacchetto e la versione, `indirecta` quando non lo dichiari tu, l'identificatore dell'avviso, un riepilogo di una riga, e la prima versione che lo corregge, oppure `Sin versión que la corrija` ("Nessuna versione la corregge").

Il punto della sezione è rosso per critica o alta, giallo per moderata, grigio quando restano solo risultati bassi o non classificati, e verde quando non è stato trovato niente. La sezione si apre da sola la prima volta che trova qualcosa. Una pressione su un risultato lo copia, con la sua gravità, la correzione e il link di OSV, pronto da incollare in una issue.

Anche l'elenco degli aggiornamenti usa il risultato. Un aggiornamento la cui nuova versione corregge qualcosa lo dice nella sua riga, `· corrige 2 vulnerabilidades` ("corregge 2 vulnerabilità"), e va per primo nel suo gruppo.

## Come funziona dentro

`hooks/osv.ts` è puro: il corpo della richiesta, la lettura delle risposte, la gravità, la versione che corregge, l'unione dei gemelli e il testo da copiare. `hooks/register.tsx` raccoglie i pacchetti, scarica, mette in cache e disegna. Come nel resto della mod, i test controllano le parti difficili senza rete.

### Di quali pacchetti si chiede

`auditedPackages` chiede all'adattatore di ogni ecosistema rilevato. Dove l'adattatore sa leggere un lockfile (`treeOf`), dà l'intero albero installato: ciò che dichiari e ciò che le tue dipendenze si portano dietro. Il README li elenca: `package-lock.json`, `Cargo.lock`, `uv.lock` o `poetry.lock`, `Gemfile.lock`, `pubspec.lock`, `Package.resolved`, e le righe `require` di `go.mod`, comprese quelle indirette. Dove non c'è un albero da leggere, come in Maven e NuGet, si usano le dipendenze dichiarate con la loro versione installata o di base.

L'albero completo conta. La maggior parte degli avvisi cade su pacchetti che nessuno ha dichiarato. Un pacchetto che non è uno dei tuoi riceve il segno `indirecta`, così sai che servirà l'aggiornamento di qualcos'altro.

Il wrapper di Gradle resta fuori: OSV non ha un ecosistema per lui, e il commento del codice dice perché questo conta, "one unknown name fails the whole batch" (un solo nome sconosciuto fa fallire l'intero lotto).

### Una sola query a lotti

L'endpoint a lotti di OSV, `https://api.osv.dev/v1/querybatch`, accetta molte domande in un solo POST. `batchBody` lo costruisce:

```json
{
  "queries": [
    { "package": { "name": "left-pad-ish", "ecosystem": "npm" }, "version": "1.0.2" },
    { "package": { "name": "pyyaml", "ecosystem": "PyPI" }, "version": "6.0.1" }
  ]
}
```

Ogni ecosistema va con il nome che usa OSV (`OSV_ECOSYSTEM`): `npm`, `PyPI`, `Go`, `crates.io`, `Pub`, `Maven`, `NuGet`, `RubyGems`, `SwiftURL`, `GitHub Actions`. Un pacchetto Swift prende il nome dal suo URL senza lo schema, come `github.com/acme/shop-kit`.

Il lotto viene mandato in fette da 500 (`BATCH_SIZE`); il commento nota che OSV accetta al massimo 1.000 per lotto. Quindi "una sola query" significa una richiesta per la maggior parte dei progetti, qualcuna per un albero molto grande, e mai una richiesta per pacchetto.

Il lotto risponde, nello stesso ordine delle domande, solo con l'`id` di ogni avviso e la sua data `modified`. Il log di task lo ha registrato durante le prove: "the batch returns ids only, details come from /v1/vulns/{id}" (il lotto restituisce solo gli id, i dettagli vengono da /v1/vulns/{id}). Così per ogni pacchetto con riscontri la mod scarica `https://api.osv.dev/v1/vulns/<id>`, otto pacchetti alla volta (`OSV_CONCURRENCY`).

### La cache degli avvisi

I dettagli vengono tenuti in `$.store` sotto `osv:<id>`, con la data `modified` data dal lotto. L'audit successivo scarica di nuovo un dettaglio solo se OSV dice che è cambiato. Si tengono solo i campi che il pannello legge (identificatore, alias, riepilogo, la prima riga dei dettagli, i campi della gravità e gli intervalli colpiti); il commento dice perché, "the full record can hold pages of details" (il record completo può contenere pagine di dettagli).

### Gravità: prima la parola dell'avviso, poi CVSS

`severityOf` cerca prima una valutazione che l'avviso dichiara a parole: `database_specific.severity`, poi lo stesso campo o `ecosystem_specific.severity` di ogni pacchetto colpito. Gli avvisi di GitHub portano `CRITICAL`, `HIGH`, `MODERATE` o `LOW`. `medium` viene letto come moderata.

Solo quando non c'è una parola del genere calcola un punteggio dal vettore CVSS dell'avviso, una stringa come `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H` che descrive come funziona un attacco: dalla rete o in locale, quanto è difficile, quali privilegi richiede, se un utente deve agire, e quanto costa in riservatezza, integrità e disponibilità.

`cvss3Score` non prende un punteggio da nessuna parte: calcola il punteggio di base dal vettore con i pesi e le formule della specifica CVSS v3.1 di FIRST, compresa la sua regola di arrotondamento e le formule diverse quando cambia lo scope (`S:C`). Poi `severityOfScore` lo associa alle fasce di CVSS: da 9.0 in su critica, 7.0 alta, 4.0 moderata, sopra 0 bassa. Il vettore qui sopra vale 9.8, critica.

Dal codice seguono due limiti:

- Si leggono solo vettori `CVSS:3.0/` e `CVSS:3.1/`. Un vettore `CVSS:4.0/` viene saltato, e un avviso con solo quello e senza parola è **Sin clasificar**.
- Un vettore 3.0 viene valutato con le formule della 3.1. Le due versioni differiscono soprattutto nel passo di arrotondamento, quindi in rari casi un punteggio può differire di un decimo.

Perché prima la parola? Il log di task dichiara l'ipotesi: "severity comes from the advisory's own rating … and, failing that, from its CVSS v3 vector's base score" (la gravità viene dalla valutazione dell'avviso stesso … e, in mancanza, dal punteggio di base del suo vettore CVSS v3). La valutazione di GitHub è ciò che mostra `npm audit`, così i due strumenti concordano dove si sovrappongono.

### La versione che lo corregge

Un avviso elenca gli intervalli colpiti come eventi: `introduced`, `fixed`, e altri. `fixedFor` raccoglie ogni versione `fixed` per questo pacchetto (confrontando i nomi come fa l'ecosistema: PyPI ignora maiuscole e minuscole e tratta allo stesso modo `-`, `_` e `.`, NuGet ignora maiuscole e minuscole), tiene quelle sopra la versione installata, e prende la più bassa. È l'aggiornamento più piccolo che lo chiude.

### Gemelli: GHSA e PYSEC

Lo stesso problema Python spesso esiste due volte in OSV: una volta come avviso di GitHub (`GHSA-…`) e una nel database di PyPA (`PYSEC-…`), e ciascuno elenca l'altro nei suoi `aliases`. Contarli entrambi raddoppierebbe il numero.

`mergeVulns` ordina gli avvisi di un pacchetto con GHSA per primo, poi li percorre. Un avviso il cui id o i cui alias incontrano l'id o gli alias di uno già tenuto è un gemello: viene scartato, ma completa ciò che manca a quello tenuto, la gravità se era non classificata e la versione che corregge se non ce n'era una. Il commento dice perché vince GHSA: "the GHSA kept for its rating" (si tiene il GHSA per la sua valutazione).

È anche per questo che il README nota che il conteggio è di avvisi, non di pacchetti. `npm audit` conta anche ogni pacchetto che dipende soltanto da uno vulnerabile; qui non vengono ripetuti.

### Cosa viene mandato a OSV.dev, in parole semplici

Due tipi di richiesta lasciano la tua macchina, entrambi attraverso `$.http.fetch`, che i tipi della 2.1.325 descrivono come una richiesta fatta "through the host (never the plugin's own network)" (attraverso l'host, mai con la rete propria del plugin):

- **Il lotto**, un POST a `api.osv.dev/v1/querybatch` con, per ogni pacchetto, il suo nome, il suo ecosistema e la sua versione. Questo è l'intero corpo.
- **I dettagli**, un GET a `api.osv.dev/v1/vulns/<id>` per ogni avviso che il lotto ha nominato e che la cache non contiene.

Non viene mandato nessun contenuto di file, nessun percorso, nessun nome di repository e nessun codice. Ma un elenco di nomi e versioni non è niente:

- Descrive il tuo stack, fino ai pacchetti transitivi e alle loro versioni esatte.
- I nomi possono essere privati. Un pacchetto npm interno `@acme/billing-core`, un modulo Go `git.acme.example/shop/api` o un pacchetto Swift `github.com/acme/private-kit` rivela un nome che forse non pubblichi. OSV non lo conoscerà, ma il nome ha lasciato la macchina.
- Come per qualsiasi richiesta web, OSV vede l'indirizzo da cui arriva.

Per la maggior parte dei progetti è uno scambio accettabile per una fonte gratuita di avvisi. Per un progetto i cui nomi di dipendenze sono essi stessi riservati, una mod potrebbe saltare i nomi che corrispondono a uno scope privato, o lasciare che la persona disattivi l'audit.

### Quando gira

`runAudit` gira dopo ogni analisi, in background così l'elenco compare prima, e con il suo pulsante **Consultar de nuevo** ("Controlla di nuovo"), con **Reintentar** dopo un errore, e con `/narsil-check vulns`. Gira un audit alla volta. Un errore HTTP del lotto mostra `No pude consultar OSV.dev: OSV respondió <status>` ("Non sono riuscito a interrogare OSV.dev").

### README, log di task e codice

Il README e il log di task dicono "nueve ecosistemas" ("nove ecosistemi"). Il codice chiede di dieci nomi, ogni adattatore tranne il wrapper di Gradle. Il commit che ha aggiunto l'audit (`912478b`) dice "Each severity copies its own list" (ogni gravità copia il proprio elenco); questo è stato sostituito in `b3ad055` dalla copia di un risultato per pressione, che è ciò che fa ora il codice.

## Costruiscila con Claude

Chiedi a Claude una sezione che mandi i pacchetti installati a OSV.dev e raggruppi per gravità ciò che torna indietro. L'unica idea che deve fare bene è che il lavoro avviene in poche richieste raggruppate, e che la gravità e la versione che corregge vengono da ciascun avviso stesso.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nella mia mod di Claude Code `my-panel`, aggiungi una sezione Vulnerabilità per i progetti npm. Leggi ogni pacchetto installato e la sua versione da `package-lock.json` (le sue voci `packages`), segna come indiretti quelli che non sono in `package.json`, e mandali a `https://api.osv.dev/v1/querybatch` con `$.http.fetch`, come `{ queries: [{ package: { name, ecosystem: "npm" }, version }] }`, in fette da 500. Per ogni id che il lotto restituisce, scarica `/v1/vulns/<id>` e mettilo in cache in `$.store` sotto `osv:<id>` con la sua data `modified`, scaricandolo di nuovo solo quando questa cambia. Classifica ogni avviso prima da `database_specific.severity`; se manca, calcola il punteggio di base CVSS v3.1 dal suo vettore e usa le fasce 9, 7, 4. Unisci gli avvisi che sono alias l'uno dell'altro, tenendo quello GHSA. Mostra la versione `fixed` più bassa sopra quella installata. Raggruppa per gravità, la peggiore per prima. Testa la funzione CVSS con alcuni vettori noti e i loro punteggi pubblicati, e il lotto con un `http.fetch` simulato.

### Cosa controllare nella risposta di Claude

1. I pacchetti vengono dal lockfile, cioè dall'intero albero installato, e quelli che non dichiari sono segnati come indiretti.
2. Vanno a `https://api.osv.dev/v1/querybatch` in blocchi da 500, mai una richiesta per pacchetto.
3. Ogni dettaglio viene scaricato da `/v1/vulns/<id>` e messo in cache in `$.store` sotto `osv:<id>` con la sua data `modified`, e scaricato di nuovo solo quando quella data cambia.
4. La gravità è prima di tutto la parola dell'avviso stesso. Solo se manca si calcola il punteggio base CVSS v3, assegnato alle fasce 9, 7 e 4.
5. Gli avvisi che sono alias l'uno dell'altro (GHSA e PYSEC) contano una volta, conservando quello GHSA, e la correzione mostrata è la versione `fixed` più bassa sopra quella installata.

Se un controllo fallisce, di' a Claude cosa vedi: "lo stesso problema di Python compare due volte, una con un id GHSA e una con un id PYSEC".

### Come l'ha chiesta l'autore

Questa è registrata. `odd/tasks/vulnerabilities.md` in narsil-check cita le parole dell'autore nella sua spec S1 e nella sua voce di log L1 (2026-11-05). La guida 1 di questo percorso cita gli stessi due messaggi per il design del pannello; qui contano per da dove vengono i dati.

#### Registrato: la richiesta

La S1 cita il primo messaggio:

> "podemos checkear vulnerabilidades de la misma forma? es decir crear un sub menu de vulnerabilidades que haga pnpm audit o similar?"

In italiano: possiamo controllare le vulnerabilità allo stesso modo, cioè creare un sottomenu di vulnerabilità che esegua pnpm audit o simile?

L'autore ha chiesto "pnpm audit o simile". Il log di task registra che l'agente ha proposto qualcos'altro, e l'autore lo ha accettato con "si" ("sì"). Con le parole dell'agente nella stessa spec: "OSV.dev instead of each ecosystem's audit tool; the full tree from the lockfile where one is read, direct dependencies elsewhere" (OSV.dev invece dello strumento di audit di ogni ecosistema; l'albero completo dal lockfile dove se ne legge uno, le dipendenze dirette altrove). Questa è la decisione che questa guida spiega: un solo database invece di nove strumenti, la maggior parte dei quali non era installata sulla macchina.

#### Registrato nel log di task: l'ipotesi e le prove

Queste sono le note dell'agente, non le parole dell'autore. L'ipotesi della spec:

> "Assumption: severity comes from the advisory's own rating (GitHub's CRITICAL, HIGH, MODERATE, LOW) and, failing that, from its CVSS v3 vector's base score; a finding with neither is "sin clasificar". Advisories that are the same issue under two ids (GHSA and PYSEC) count once."

In italiano: "Ipotesi: la gravità viene dalla valutazione dell'avviso stesso (CRITICAL, HIGH, MODERATE, LOW di GitHub) e, in mancanza, dal punteggio di base del suo vettore CVSS v3; un risultato senza nessuno dei due è "sin clasificar". Gli avvisi che sono lo stesso problema sotto due id (GHSA e PYSEC) contano una volta."

La voce di log L2 registra le prove che hanno dato forma al codice: un solo lotto ha risposto insieme per npm, PyPI, Go, Maven, NuGet e crates.io; il lotto restituisce solo gli id; i pacchetti Swift sono `SwiftURL` con nome `github.com/owner/repo`; e sulla macchina solo npm e pnpm avevano strumenti di audit, "no pip-audit, cargo-audit or govulncheck" (né pip-audit, né cargo-audit, né govulncheck). La L3 registra che su un progetto reale OSV ha trovato gli stessi avvisi che riporta `npm audit`, che `npm audit` distribuisce su più pacchetti "because it also names the packages that only depend on them" (perché nomina anche i pacchetti che dipendono soltanto da essi).

#### Ricostruzione dalla cronologia dei commit

Da `git log -- hooks/osv.ts` in narsil-check:

- `912478b` (2026-11-04) "feat: check known vulnerabilities with OSV.dev in a collapsible section" (controlla le vulnerabilità note con OSV.dev in una sezione richiudibile). L'intera funzionalità in un solo commit: il lotto, il punteggio CVSS, l'unione, la versione che corregge e i segni sugli aggiornamenti.
- `b3ad055` (2026-11-06) "feat: fold upgrade and vulnerability groups, copy a row on click, …" (chiude i gruppi di aggiornamenti e vulnerabilità, copia una riga al clic, …). I gruppi di gravità si chiudono per conto loro; una pressione copia un risultato.
- `7048580` (2026-11-09) "feat: check the Gradle wrapper and GitHub Actions for upgrades" (controlla gli aggiornamenti del wrapper di Gradle e delle GitHub Actions). Il suo messaggio: "OSV is not asked about it" (a OSV non si chiede di lui), per il wrapper.

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida. Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

Questa è una versione ridotta dell'idea, scritta per questa guida e verificata con i tipi di Claude Code 2.1.325 (`$.http.fetch`). È adattata da `hooks/osv.ts` e da `auditProject` in `hooks/register.tsx` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Lascia fuori il calcolo CVSS e la cache.

```ts
import type { EngineInterface } from 'claude-code'

type Pkg = { name: string; version: string; ecosystem: 'npm' | 'PyPI' }
type Severity = 'critical' | 'high' | 'moderate' | 'low' | 'unknown'
type Vuln = { id: string; aliases: string[]; severity: Severity }

const OSV = 'https://api.osv.dev/v1'

function severityOf(advisory: { database_specific?: { severity?: unknown } }): Severity {
  const word = String(advisory.database_specific?.severity ?? '').toLowerCase()
  if (word === 'critical' || word === 'high' || word === 'low') return word
  if (word === 'moderate' || word === 'medium') return 'moderate'
  return 'unknown' // the real mod computes the CVSS v3 score here
}

// Twins alias each other: keep one, the GHSA first.
function merge(vulns: Vuln[]): Vuln[] {
  const out: Vuln[] = []
  const ghsaFirst = [...vulns].sort(
    (a, b) => Number(b.id.startsWith('GHSA-')) - Number(a.id.startsWith('GHSA-')),
  )
  for (const v of ghsaFirst) {
    const names = new Set([v.id, ...v.aliases])
    const twin = out.find((o) => names.has(o.id) || o.aliases.some((a) => names.has(a)))
    if (!twin) out.push(v)
    else if (twin.severity === 'unknown') twin.severity = v.severity
  }
  return out
}

export async function audit($: EngineInterface, packages: Pkg[]): Promise<Map<Pkg, Vuln[]>> {
  const found = new Map<Pkg, Vuln[]>()
  for (let i = 0; i < packages.length; i += 500) {
    const slice = packages.slice(i, i + 500)
    const res = await $.http.fetch(`${OSV}/querybatch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        queries: slice.map((p) => ({
          package: { name: p.name, ecosystem: p.ecosystem },
          version: p.version,
        })),
      }),
    })
    if (!res.ok) throw new Error(`OSV answered ${res.status}`)
    const results = (JSON.parse(res.text).results ?? []) as { vulns?: { id: string }[] }[]
    for (const [j, r] of results.entries()) {
      const vulns: Vuln[] = []
      for (const { id } of r.vulns ?? []) {
        const detail = await $.http.fetch(`${OSV}/vulns/${encodeURIComponent(id)}`)
        if (!detail.ok) continue
        const a = JSON.parse(detail.text)
        vulns.push({
          id,
          aliases: Array.isArray(a.aliases) ? a.aliases : [],
          severity: severityOf(a),
        })
      }
      if (vulns.length > 0) found.set(slice[j] as Pkg, merge(vulns))
    }
  }
  return found
}
```

Eseguila dopo la tua analisi senza attenderla in un hook, tieni il suo risultato in un atom con prima uno stato `scanning`, e disegna una chiusura per gravità a partire da quell'atom.

## Errori comuni e come testarlo

Questi vengono dal codice e dai test di Narsil Check:

- **Una richiesta per pacchetto.** Un lockfile ha centinaia di pacchetti. Raggruppali in lotti.
- **Un solo nome di ecosistema sconosciuto nel lotto.** Fa fallire l'intero lotto. Lascia fuori ciò che OSV non conosce.
- **Solo i pacchetti dichiarati.** La maggior parte degli avvisi riguarda quelli transitivi. Leggi il lockfile dove ce n'è uno.
- **Fidarsi di un punteggio salvato.** Gli avvisi spesso portano solo un vettore. Calcola il punteggio, e testa la funzione con i punteggi pubblicati.
- **Contare due volte i gemelli.** GHSA e PYSEC sono alias l'uno dell'altro. Unisci per alias.
- **"Corretto in" come primo evento `fixed`.** Un avviso può avere più intervalli. Prendi la correzione più bassa sopra ciò che è installato.
- **Scaricare ogni dettaglio ogni volta.** Metti in cache per id e `modified`.
- **Dimenticare cosa rivela la richiesta.** I nomi dei pacchetti possono essere privati. Di' cosa viene mandato.

Per testare, `claude plugin test .` esegue `tests/vulns.test.tsx`. "a CVSS v3 vector's base score is FIRST's" (il punteggio di base di un vettore CVSS v3 è quello di FIRST) controlla la formula, "severity is the advisory's own rating, else its CVSS score's band" (la gravità è la valutazione dell'avviso stesso, altrimenti la fascia del suo punteggio CVSS) l'ordine, "the fixing version is the lowest fixed event past the installed one" (la versione che corregge è l'evento fixed più basso oltre quello installato) la correzione, e "one issue under a GHSA and a PYSEC id counts once, the GHSA kept" (un problema sotto un id GHSA e uno PYSEC conta una volta, e si tiene il GHSA) l'unione. "OSV's batch is asked by each ecosystem's name and answered in order" (al lotto di OSV si chiede con il nome di ogni ecosistema e risponde in ordine) controlla il corpo. Con `on('http.fetch', ...)` che risponde al posto di OSV, "the vulnerabilities section lists findings in folding severity groups, copies one on a press, and marks the upgrade that fixes them" (la sezione delle vulnerabilità elenca i risultati in gruppi di gravità richiudibili, ne copia uno a una pressione, e segna l'aggiornamento che li corregge) guida il pannello, e "an advisory read before is not fetched again while OSV says it has not changed" (un avviso già letto non viene scaricato di nuovo finché OSV dice che non è cambiato) conta le richieste di dettaglio.

## Per andare oltre

- Valuta anche i vettori `CVSS:4.0/`. La sua formula è diversa e più lunga; un test con i punteggi pubblicati è essenziale.
- Lascia che la persona escluda gli scope privati dal lotto, o disattivi l'audit per un progetto.
- OSV ha anche un endpoint `/v1/query` che restituisce gli avvisi completi per un pacchetto. Per una manciata di pacchetti risparmia il secondo giro di richieste.
- La prossima guida cambia argomento: una lista di cose da fare tenuta per progetto, fuori da git.
