---
title: Creare la PR
description: 'Come Narsil Check trasforma i manifest aggiornati in un commit, un branch chore/upgrade-deps e una pull request aperta con gh, e poi ti riporta al branch principale.'
route: check
order: 13
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/git.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/words.ts
  - repo: check
    path: hooks/adapter.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/upgrade.test.tsx
  - repo: check
    path: odd/tasks/ecosystems-wave-4.md
---

## Cosa fa

Dopo che gli aggiornamenti banali sono stati installati, i manifest sul disco non corrispondono più all'ultimo commit. Il lavoro che resta è sempre lo stesso: un branch, un commit con solo i file delle dipendenze, un push, una pull request con una descrizione leggibile, e il ritorno a dove eri. Narsil Check fa questi passi con una sola pressione.

Quando gli intervalli delle dipendenze di un manifest differiscono da `HEAD`, il pannello mostra una riga come:

```text
Sin commit: 2 librerías actualizadas en package.json
```

Si legge "Senza commit: 2 librerie aggiornate in package.json". Sotto c'è un pulsante, e la sua etichetta dipende dal branch su cui sei:

- Sul branch principale: **Crear rama, commit y PR** ("Crea branch, commit e PR").
- Su qualsiasi altro branch: **Commit y push a &lt;rama&gt;** ("Commit e push su &lt;branch&gt;"). Fa il commit e il push su quel branch, e nient'altro. La pull request la gestisci tu.

Sul branch principale il pulsante fa quattro cose. Crea `chore/upgrade-deps-2026-11-17` (la data del giorno), ci fa il commit dei manifest e dei lockfile, apre una pull request verso il branch principale con `gh`, e torna al branch principale. Il pannello allora dice `PR creado desde la rama chore/upgrade-deps-2026-11-17. Volviste a main.` ("PR creata dal branch …. Sei di nuovo su main.") e un toast porta l'indirizzo della PR.

Non importa chi abbia cambiato il manifest. Un aggiornamento fatto dal pannello e uno scritto a mano vengono rilevati entrambi, perché il confronto è con `HEAD`, non con la memoria del pannello.

## Come funziona dentro

I testi e le piccole decisioni stanno in `hooks/git.ts`, come funzioni pure: il nome del branch, il titolo e il corpo del commit, il corpo della PR, quale branch conta come principale, e come trovare l'indirizzo della PR nell'output di `gh`. I passi che eseguono git e gh sono in `hooks/register.tsx`, in `checkPending` e `publish`. Questa divisione è la stessa del resto della mod: i test controllano i testi senza eseguire niente.

### Trovare cosa conterrebbe una PR

`checkPending` gira dopo ogni analisi. Per ogni ecosistema che il progetto usa, e per ognuno dei suoi manifest, legge la versione nell'ultimo commit con `git --no-pager show HEAD:<manifest>` e la versione sul disco, le interpreta entrambe con l'adattatore dell'ecosistema, e confronta gli intervalli delle dipendenze (`specChanges` in `hooks/adapter.ts`).

Interpretare entrambi i lati con l'adattatore, invece di confrontare il testo, è una scelta voluta. Una modifica a `scripts` in `package.json` non è una modifica alle dipendenze e non appare come tale. Un intervallo passato da `^3.22.0` a `^3.25.1` sì. Sopravvive anche a un riavvio: lo stato in sospeso viene ricalcolato da git, non tenuto da qualche parte.

Per ogni ecosistema con modifiche, i file candidati sono i suoi manifest modificati più i suoi lockfile, nella radice e ovunque l'albero li contenga. Poi `git status --porcelain -- <those files>` tiene solo quelli che git segnala come modificati. Un lockfile che l'installazione non ha toccato resta fuori.

### Quale branch è quello principale

`isMainBranch` chiede `git symbolic-ref --short refs/remotes/origin/HEAD`, che stampa qualcosa come `origin/main`. Quando origin non indica un default, contano `main` o `master`. Un repository il cui default è `develop` viene gestito correttamente purché `origin/HEAD` sia impostato.

### I passi sul branch principale

`publish` esegue ogni comando attraverso un piccolo helper `step` che imposta lo stato del pannello sul nome del passo (il pannello mostra `Creando la rama…`, "Creazione del branch in corso…") e lancia un errore con quel nome se il comando fallisce. In ordine:

1. `git branch --show-current`. Una risposta vuota significa un `HEAD` staccato, e il pannello si ferma con "cambia a una rama antes de subir los cambios" ("passa a un branch prima di caricare le modifiche").
2. `git rev-parse --verify --quiet refs/heads/chore/upgrade-deps-<day>`. Se quel branch esiste già, `branchName` aggiunge l'ora e il minuto: `chore/upgrade-deps-2026-11-17-1432`.
3. `git switch -c <branch>`.
4. `git add -- <files>`, poi `git commit -m <title> -m <body> -- <files>`.
5. `git push -u origin <branch>`.
6. `gh pr create --base <main> --head <branch> --title <title> --body <body>`.
7. `git switch <main>`, poi la sessione e l'elenco delle librerie vengono letti di nuovo.

Il titolo del commit è `chore(deps): upgrade 2 dependencies` (o `1 dependency`), e il corpo elenca ogni modifica come `- zod: 3.22.0 -> 3.25.1`. Il corpo della PR ha un `## Summary` con il gestore usato e una tabella con pacchetto, da e a, poi un `## Test plan` con due caselle non spuntate: eseguire la suite di test e fare la build del progetto. Le caselle ci sono perché anche un aggiornamento banale ha bisogno di una persona che esegua i test.

`prUrlOf` prende l'ultima riga dell'output di gh che assomiglia a `https://…/pull/<number>`, perché gh può stampare altre righe prima.

### Perché fa il commit con un elenco di percorsi

Il commit è `git commit ... -- <files>`, con i file nominati dopo `--`. Con dei percorsi indicati, git fa il commit di quei file così come sono sul disco e di nient'altro, anche se avevi altri file nell'area di staging. Il tuo lavoro in corso resta fuori dalla PR. Il README lo dice chiaramente: "El resto de tus cambios sin commit no se incluye" ("Il resto delle tue modifiche senza commit non viene incluso").

Le altre modifiche senza commit viaggiano con te: `git switch -c` le porta sul nuovo branch e `git switch <main>` le riporta indietro, perché nessuna di esse è nel commit e gli unici file che differiscono tra i due branch sono quelli appena committati.

### Perché torna al branch principale

Il ritorno al branch principale è stato aggiunto dopo (`2b91c7d`). Restare sul branch dell'aggiornamento portava le persone a lavorare per sbaglio sopra un branch di PR. Tornati sul branch principale c'è un tranello che il README spiega: i manifest contengono di nuovo le versioni vecchie, mentre `node_modules` (o il suo equivalente) può contenere ancora quelle nuove. Così il pannello analizza di nuovo, e il README suggerisce di reinstallare se continui a lavorare lì.

Se git rifiuta il cambio di branch, il pannello non prova a forzarlo. Resta sul nuovo branch e dice perché: `PR creado desde la rama …. No pude volver a main: <git's error>` ("Non sono riuscito a tornare su main").

### Cosa succede quando qualcosa fallisce

- **Un passo fallisce prima che la PR esista.** L'errore nomina il passo: `No pude crear el PR. Subiendo la rama: fatal: no remote` ("Non sono riuscito a creare la PR. Caricamento del branch: …"). Leggendo il codice, i passi già eseguiti non vengono annullati: se il push fallisce, sei sul nuovo branch con il commit fatto in locale.
- **gh non ha fatto l'accesso.** `gh pr create` esce con un errore e il pannello ne mostra la fine, dopo `Creando el PR:`. A quel punto il branch è già stato caricato.
- **gh manca.** Quando un comando non riesce nemmeno a partire, `runCommand` lo riprova una volta come `<name>.cmd` (la forma che installa Windows), poi rinuncia. Leggendo il codice, quel fallimento è un rifiuto e non un codice di uscita, quindi arriva al pannello senza il nome del passo.
- **Entrambi i nomi di branch sono occupati.** Si controlla solo il nome del giorno. Se esiste anche il nome con l'ora (due esecuzioni nello stesso minuto), `git switch -c` fallisce e il pannello dice `Creando la rama: …`. Un branch con quel nome che esiste solo sul remoto non viene controllato; allora fallirebbe il push.
- **Due pressioni.** Una pressione mentre il lavoro è `running` non fa niente.

### Gli hook di commit non girano

I tipi della 2.1.325 dicono di `$.process.run`: "Git runs with repo hooks off" (git gira con gli hook del repository disattivati). Il README è d'accordo: hook come husky non girano su questi commit. Un team che conta su un hook di commit per il lint o la firma vedrà arrivare questi commit senza.

### README e codice

Il commento sopra `publish` dice ancora "A commit of package.json and its lockfile alone" (un commit solo di package.json e del suo lockfile), dai tempi in cui la mod conosceva solo npm. Il codice fa il commit dei manifest e dei lockfile di ogni ecosistema con modifiche, come dice il README.

## Costruiscila con Claude

Chiedi a Claude un pulsante che trasformi le modifiche alle dipendenze sul disco in un commit e, sul branch predefinito, in una pull request. L'unica idea che deve fare bene è che il commit contiene solo i file delle dipendenze: sono indicati dopo `--`, così il resto del tuo lavoro in corso resta fuori.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nella mia mod di Claude Code `my-panel`, aggiungi un pulsante che trasforma le modifiche alle dipendenze di `package.json` in una pull request. Prima confronta gli intervalli delle dipendenze di `git show HEAD:package.json` con il file sul disco, ed elenca quelli cambiati; mostra il pulsante solo quando ce ne sono. Alla pressione, con `$.process.run` e senza shell: fermati con un messaggio chiaro su un HEAD staccato; se il branch corrente non è quello predefinito (da `git symbolic-ref --short refs/remotes/origin/HEAD`, altrimenti `main` o `master`), fai commit e push su di esso e fermati lì. Sul branch predefinito, crea `chore/upgrade-deps-YYYY-MM-DD` (aggiungi `-HHMM` se quel branch esiste), esegui `git add -- package.json package-lock.json`, `git commit -m "chore(deps): upgrade N dependencies" -m <list> -- package.json package-lock.json`, `git push -u origin <branch>`, e `gh pr create --base <default> --head <branch> --title … --body …` con una tabella delle modifiche e un piano di test. Poi torna indietro con `git switch` e dillo; se il cambio fallisce, resta e mostra l'errore di git. Nomina il passo che fallisce in ogni errore. Ignora una seconda pressione mentre è in esecuzione. Testalo rispondendo a `process.run` nei test e controllando l'argv esatto di ogni comando, in ordine.

### Cosa controllare nella risposta di Claude

1. Le modifiche in sospeso vengono dal confronto tra gli intervalli delle dipendenze di `git show HEAD:package.json` e il file sul disco, così una modifica a `scripts` non propone una PR.
2. Il branch predefinito viene da `git symbolic-ref --short refs/remotes/origin/HEAD`, con `main` o `master` solo quando origin non ne indica nessuno. Su qualsiasi altro branch il pulsante fa commit e push lì, e si ferma.
3. Il commit indica i suoi file, come in `git commit -m … -m … -- package.json package-lock.json`, mai con `git commit -a` o con un `git commit` senza file.
4. Dopo `gh pr create`, il pulsante esegue `git switch` per tornare al branch predefinito. Quando il cambio fallisce, resta sul nuovo branch e mostra l'errore di git.
5. Ogni errore indica il passo che è fallito, e una seconda pressione mentre il lavoro è in corso non fa nulla.

Se un controllo fallisce, di' a Claude cosa vedi: "la PR include un file che stavo ancora modificando, non solo package.json e il suo lockfile".

### Come l'ha chiesta l'autore

La richiesta originale per questa funzionalità non è stata registrata. Il pulsante è già nel primo commit, e nessun log di task pubblico ne copre la creazione. Un log di task successivo lo nomina, con le parole dell'agente.

#### Registrato in un log di task

`odd/tasks/ecosystems-wave-4.md`, che aggiunge i pacchetti Swift, elenca come spec S2 cosa doveva continuare a funzionare. Questa è la spec dell'agente, non le parole dell'autore:

> "Everything the earlier waves built keeps working for SwiftPM: grouping, the bump button, Haiku reasons, copy buttons, the commit/push/PR button and the auto-open rule."

In italiano: "Tutto ciò che hanno costruito le ondate precedenti continua a funzionare per SwiftPM: il raggruppamento, il pulsante di aggiornamento, i motivi di Haiku, i pulsanti di copia, il pulsante commit/push/PR e la regola di apertura automatica."

#### Ricostruzione dalla cronologia dei commit

Da `git log -- hooks/git.ts` e `git log -S` su `hooks/register.tsx` in narsil-check:

- `1bf736a` (2026-11-04) "feat: add upgrade panel for npm and Expo projects" (aggiunge un pannello di aggiornamenti per progetti npm ed Expo). Il suo messaggio finisce con "Pending upgrades become a commit and push, or a branch and PR from the default branch." (gli aggiornamenti in sospeso diventano un commit e un push, o un branch e una PR dal branch predefinito). Il nome del branch `chore/upgrade-deps-…`, il commit limitato ai percorsi e `gh pr create` sono già qui.
- `a95eb07` (2026-11-04) "refactor: read dependencies through an adapter per ecosystem" (legge le dipendenze attraverso un adattatore per ecosistema). Le modifiche in sospeso vengono lette per adattatore, confrontando ogni manifest con `HEAD`, così il pulsante funziona per ogni ecosistema aggiunto dopo.
- `2b91c7d` (2026-11-13) "feat: return to the default branch after the PR and warn when the branch is behind" (torna al branch predefinito dopo la PR e avvisa quando il branch è indietro). Il suo messaggio: "After opening the upgrade PR the pane switches back to the base branch and rescans; a refused switch keeps the new branch and says why." (dopo aver aperto la PR di aggiornamento il pannello torna al branch di base e analizza di nuovo; un cambio rifiutato tiene il nuovo branch e dice perché).

Il design non è cambiato molto. Ciò che è cambiato è dove ti ritrovi dopo.

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida. Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

Questa è una versione ridotta dell'idea, scritta per questa guida e verificata con i tipi di Claude Code 2.1.325 (`$.process.run`, `$.ui.toast`). È adattata da `hooks/git.ts` e da `publish` in `hooks/register.tsx` in [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Gestisce solo il branch predefinito, e riceve i file e le modifiche come già trovati.

```ts
import type { EngineInterface } from 'claude-code'

type Change = { name: string; from: string; to: string }

const pad = (n: number) => String(n).padStart(2, '0')

export function branchName(ms: number, taken: boolean): string {
  const d = new Date(ms)
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return `chore/upgrade-deps-${day}${taken ? `-${pad(d.getHours())}${pad(d.getMinutes())}` : ''}`
}

async function step($: EngineInterface, label: string, argv: string[]): Promise<string> {
  const ran = await $.process.run(argv, { timeoutMs: 60_000 })
  if (ran.exitCode !== 0) throw new Error(`${label}: ${(ran.stderr || ran.stdout).trim()}`)
  return ran.stdout
}

export async function openUpgradePr(
  $: EngineInterface,
  base: string,
  files: string[],
  changes: Change[],
): Promise<string> {
  const title = `chore(deps): upgrade ${changes.length} ${changes.length === 1 ? 'dependency' : 'dependencies'}`
  const body = changes.map((c) => `- ${c.name}: ${c.from} -> ${c.to}`).join('\n')
  const now = Date.now()
  const taken = await $.process.run([
    'git',
    'rev-parse',
    '--verify',
    '--quiet',
    `refs/heads/${branchName(now, false)}`,
  ])
  const branch = branchName(now, taken.exitCode === 0)

  await step($, 'Creating the branch', ['git', 'switch', '-c', branch])
  await step($, 'Staging', ['git', 'add', '--', ...files])
  await step($, 'Committing', ['git', 'commit', '-m', title, '-m', body, '--', ...files])
  await step($, 'Pushing', ['git', 'push', '-u', 'origin', branch])
  const out = await step($, 'Opening the PR', [
    'gh',
    'pr',
    'create',
    '--base',
    base,
    '--head',
    branch,
    '--title',
    title,
    '--body',
    body,
  ])
  const url =
    out
      .split(/\r?\n/)
      .filter((l) => /^https:\/\/\S+\/pull\/\d+$/.test(l.trim()))
      .pop() ?? out.trim()

  const back = await $.process.run(['git', 'switch', base])
  $.ui.toast(
    back.exitCode === 0
      ? `PR opened: ${url}. Back on ${base}.`
      : `PR opened: ${url}. Still on ${branch}.`,
  )
  return url
}
```

Chiamala dall'`onPress` di un pulsante, tieni uno stato `running` in un atom così una seconda pressione non fa niente, e quando lancia un errore mostra il suo messaggio, che nomina già il passo.

## Errori comuni e come testarlo

Questi vengono dal codice e dai test di Narsil Check:

- **`git commit -a` o un `git commit` senza argomenti.** Entrambi possono prendere file che non volevi includere. Nomina i file dopo `--`.
- **Confrontare il testo invece degli intervalli.** Una modifica agli spazi o un nuovo script offrirebbero una PR. Interpreta entrambi i lati con lo stesso lettore.
- **Dare per scontato che il branch predefinito sia `main`.** Chiedi prima a `origin/HEAD`.
- **Restare sul branch dell'aggiornamento.** La modifica successiva finisce per sbaglio nella PR. Torna indietro, e dillo quando non puoi.
- **Lasciare il pannello non aggiornato dopo il cambio di branch.** I manifest sono cambiati sotto di lui. Analizza di nuovo.
- **Errori senza un passo.** "exit code 128" non aiuta nessuno. Nomina il passo.
- **Contare sugli hook di commit.** Sono disattivati per `$.process.run`; non dare per scontato che un hook faccia il lint di questi commit.

Il commit stesso prende l'intero file così com'è sul disco. Se hai modificato a mano qualcos'altro in `package.json`, come uno script, anche quella modifica finisce nella PR. Controlla il diff prima di premere.

Per testare, `claude plugin test .` esegue `tests/upgrade.test.tsx`, che risponde da sé a ogni `process.run` e registra l'argv. "the PR button makes a branch, commits package.json and the lock, pushes and opens a PR" (il pulsante della PR crea un branch, fa il commit di package.json e del lock, fa il push e apre una PR) controlla l'ordine dei comandi, l'esatto `git add -- package.json package-lock.json`, il titolo del commit e il `gh pr create --base main --head <branch>`, e che `git switch main` venga dopo gh. "on a work branch the button commits and pushes to it, with no new branch or PR" (su un branch di lavoro il pulsante fa commit e push su di esso, senza nuovo branch né PR), "a PR that is made but cannot go back to the default branch says so and stays on the new branch" (una PR creata che non riesce a tornare al branch predefinito lo dice e resta sul nuovo branch) e "a failed push says which step failed" (un push fallito dice quale passo è fallito) coprono gli altri percorsi. "the branch is named by day, and by time when the day is taken" (il branch prende il nome dal giorno, e dall'ora quando il giorno è occupato) e "the PR address is the URL gh prints" (l'indirizzo della PR è l'URL che stampa gh) testano le funzioni pure.

## Per andare oltre

- Il corpo della PR potrebbe riportare le vulnerabilità che ogni aggiornamento corregge, che il pannello conosce già (la prossima guida).
- `gh pr create` accetta `--label` e `--reviewer`. Un'impostazione di team per questi è una piccola aggiunta.
- Un branch remoto con lo stesso nome non viene controllato. Un `git ls-remote --heads origin <branch>` prima del push lo intercetterebbe.
- La prossima guida lascia gli aggiornamenti per la sicurezza: le vulnerabilità note dei pacchetti che hai installato.
