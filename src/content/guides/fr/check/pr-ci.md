---
title: Le CI de votre PR
description: 'Comment Narsil Check suit les étapes GitHub Actions de la pull request de la session avec la CLI gh, toutes les 10 secondes pendant une exécution, et s’arrête quand elle se termine.'
route: check
order: 4
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/ci.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/session.ts
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/ci.test.tsx
  - repo: check
    path: tests/session.test.tsx
---

## Ce que ça fait

Quand la session a une pull request ouverte, la section **Entorno** affiche un repli **CI** sous l’interrupteur Remote Control. Il suit l’exécution GitHub Actions du commit le plus récent de la pull request, étape par étape, pour que vous puissiez suivre les vérifications sans ouvrir le navigateur.

L’en-tête du repli dit d’un coup d’œil où en est le CI :

| En-tête                                | Sens                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------- |
| `CI · 2/4 · Typecheck`                 | En cours : deux étapes sur quatre faites, `Typecheck` en cours maintenant.            |
| `CI · pasó`                            | Réussi.                                                                               |
| `CI · falló`                           | Échoué.                                                                               |
| `CI · esperando el CI del último push` | En attente : votre branche a un commit qu’aucune exécution n’a encore pris en charge. |
| `CI · sin ejecuciones`                 | Aucune exécution pour cette branche.                                                  |
| `CI · sin leer`                        | Non lu : `gh` n’a pas pu répondre, et la raison s’affiche en dessous.                 |

Déplié, il liste les étapes avec une marque aux couleurs de Narsil :

- `✓` vert : fait.
- `✗` rouge : échoué, annulé, expiré, en attente d’une action ou n’a pas pu démarrer.
- `◐` jaune : en cours.
- `○` gris : en file d’attente ou en attente.
- `–` gris : ignoré ou neutre.

Les étapes de gestion interne de GitHub (`Set up job`, `Complete job`, `Post …`) sont omises, puisqu’elles ne disent rien du projet. Avec plusieurs workflows, le nom de chaque exécution sert d’en-tête à ses étapes ; avec plusieurs jobs, chaque job s’affiche avec sa propre marque.

Pendant qu’une exécution tourne, le repli interroge de nouveau toutes les 10 secondes, et il cesse d’interroger dès que le CI se termine. Le repli reste tel que vous l’avez laissé : le début de session ne le réinitialise pas, et le commentaire du code dit qu’il garde la façon dont vous l’avez laissé d’une session à l’autre (le premier guide explique ce que les types en disent). Tant qu’il est replié, rien n’est demandé.

## Comment ça marche à l’intérieur

### Quelle pull request, quel dépôt

Le repli CI ne cherche pas lui-même de pull request. Il utilise celle que l’application de bureau a liée à la session, lue dans les guides précédents via `$.mcp.call('ccd_pr', 'get_status', { session_id: 'self' })`. `parsePr` dans `hooks/session.ts` garde, pour une pull request ouverte, son url, son dépôt (`prRepo`, propriétaire et nom, comme `acme/shop`) et sa branche de tête (`prHead`).

Le repli n’est dessiné que lorsque `view.prUrl` est défini. Il n’existe donc que dans l’application de bureau, où `ccd_pr` existe ; le tableau des surfaces du README dit la même chose.

### Interroger `gh`

La partie pure vit dans `hooks/ci.ts` : elle construit les commandes et lit leur sortie. Le module de hooks les exécute dans `readCi`, dans `hooks/register.tsx`.

D’abord, les exécutions de la branche :

```ts
export function runListArgv(repo: string, branch: string): string[] {
  return [
    'gh',
    'run',
    'list',
    '--repo',
    repo,
    '--branch',
    branch,
    '--json',
    RUN_FIELDS,
    '--limit',
    '20',
  ]
}
```

`RUN_FIELDS` vaut `'databaseId,headSha,workflowName,status,conclusion'`. `gh` liste les plus récentes en premier, si bien que `latestRuns` prend le commit de la première exécution (`headSha`) comme le plus récent, ne garde que les exécutions de ce commit, et en garde une par nom de workflow. Les exécutions de commits plus anciens ne se mélangent jamais à l’actuelle.

Ensuite, pour chacune de ces exécutions, ses jobs et ses étapes :

```ts
export function runViewArgv(repo: string, id: number): string[] {
  return ['gh', 'run', 'view', String(id), '--repo', repo, '--json', 'jobs']
}
```

`jobsOf` lit le nom, l’état, la conclusion et les étapes de chaque job, et écarte les étapes de gestion interne avec une seule expression régulière, `NOISE = /^(Set up job|Complete job|Post .+)$/`.

Les états du CI sont ceux de GitHub : un `status` (`queued`, `in_progress`, `completed`) et, une fois terminé, une `conclusion`. `markOf` transforme cette paire en marque et en couleur, et la liste des conclusions en échec (`FAILED`) est la même partout : dans la marque d’une étape, dans l’en-tête (`ciLabel`) et dans la marque du repli lui-même (`ciMark`).

### `$.process.run`, tel que le code l’utilise

Les types 2.1.325 décrivent `$.process.run(argv, init)` comme l’exécution d’« a command on the host by its argument vector (no shell) » (une commande sur l’hôte par son vecteur d’arguments, sans shell), qui résout `{ exitCode, stdout, stderr }` « once it exits, any exit code » (une fois qu’elle se termine, quel que soit le code de sortie). Le délai est de 30 secondes par défaut et de dix minutes au plus ; Narsil Check passe `GH_MS`, 30 secondes. L’appel est rejeté quand la commande ne peut pas démarrer ou tourne encore à l’expiration du délai. Les types marquent aussi tout le nom `process` comme « CLI only » (CLI uniquement).

Deux choses en découlent, et le code gère les deux :

- **Une sortie non nulle est une réponse, pas une exception.** `readCi` vérifie `list.exitCode !== 0` et garde le stderr de `gh` comme erreur, ou « gh terminó con el código N » (« gh s’est terminé avec le code N ») quand stderr est vide.
- **Un `gh` absent est une exception.** L’appel est rejeté, le `catch` autour de `readCi` garde le message, et le repli l’affiche.

Comme le vecteur d’arguments n’a pas de shell, les noms du dépôt et de la branche arrivent à `gh` comme de simples arguments : il n’y a rien à mettre entre guillemets ni à échapper.

Il y a une raison d’exécuter `gh` au lieu d’appeler l’API HTTP de GitHub depuis le mod : `gh` apporte la connexion de la personne elle-même, si bien que le mod ne détient jamais de jeton GitHub. Un commentaire dans `hooks/register.tsx` donne une raison voisine pour exécuter git lui-même dans « Actualizar rama » : « The mod runs git itself, so the app asks no permission. » (le mod exécute git lui-même, si bien que l’application ne demande aucune autorisation).

### Attendre un push

Juste après `git push`, GitHub n’a peut-être pas encore lancé d’exécution pour le nouveau commit, et la liste montre encore l’exécution du commit précédent, peut-être déjà verte. Afficher « réussi » serait alors faux.

Donc, quand la branche extraite est la branche de tête de la pull request, `readCi` exécute aussi `git rev-parse @{upstream}`. Si le commit amont n’est pas le commit des exécutions listées, un push plus récent n’a pas encore d’exécution, et la vue est marquée `isWaiting` : l’en-tête dit « esperando el CI del último push » (« en attente du CI du dernier push ») et la marque est jaune.

### Toutes les 10 secondes, et puis plus du tout

L’interrogation périodique est `watchCi`, une boucle :

```tsx
let ciWatch = 0
async function watchCi($: EngineInterface): Promise<void> {
  const id = ++ciWatch
  let waits = 0
  for (;;) {
    const view = await read($, session)
    if (!view.prUrl || !(await read($, isCiOpen))) return
    await update($, ci, (current) =>
      current.status === 'ready' ? current : { ...current, status: 'loading' },
    )
    let next = await readCi($, view)
    if (id !== ciWatch) return
    // A push no workflow answers (a repository with no CI for it) stops waiting.
    if (next.isWaiting && ++waits > CI_WAIT_POLLS) next = { ...next, isWaiting: false }
    await update($, ci, () => next)
    if (next.error || !(next.isWaiting || isGoing(next.runs))) return
    await $.clock.sleep(CI_POLL_MS)
    if (id !== ciWatch) return
  }
}
```

Elle est citée depuis [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Chaque ligne est une règle :

- **Pas de pull request, ou le repli fermé : arrêt.** Rien n’est demandé tant que vous ne regardez pas.
- **Garder la dernière réponse pendant le rechargement.** Une vue déjà `ready` reste telle quelle pendant la lecture suivante, si bien que les étapes ne clignotent pas.
- **Une seule surveillance à la fois.** Chaque appel prend un nouvel `id`. Une surveillance plus récente (issue de la lecture de session suivante, d’une pull request trouvée tardivement, ou de l’ouverture du repli) fait s’arrêter l’ancienne à sa prochaine vérification.
- **Un push auquel personne ne répond met fin à l’attente.** `CI_WAIT_POLLS` vaut 12, si bien qu’après environ deux minutes, un dépôt sans workflow pour ce push cesse d’attendre.
- **Arrêt sur une erreur, ou quand rien ne tourne et que rien n’est attendu.** `isGoing` est vrai tant que l’état d’une exécution n’est pas `completed`.
- **Sinon, attendre `CI_POLL_MS`, 10 secondes, avec `$.clock.sleep`.** Les types le décrivent comme se résolvant « after `ms` milliseconds » (après `ms` millisecondes).

Les types offrent aussi `$.clock.every(ms, fn)`, qui appelle `fn` à chaque période jusqu’à son annulation. La boucle avec `sleep` a une propriété qui convient à ce cas : la lecture suivante ne commence qu’après la fin de la précédente, si bien que des appels lents à `gh` ne se chevauchent jamais, et la boucle se termine d’elle-même sur la condition qu’elle vient de lire.

La surveillance est lancée avec `void watchCi($)` après une lecture complète de la session, après une pull request trouvée tardivement, et quand vous dépliez le repli. Elle n’est jamais attendue par un hook.

### Quand `gh` est absent ou non connecté

Les deux cas se terminent de la même façon. La vue reçoit une `error`, l’en-tête dit `CI · sin leer`, la marque est un `○` gris, et le repli déplié affiche en rouge « No pude leer el CI con gh: … » (« je n’ai pas pu lire le CI avec gh : … ») suivi de la raison : le message du moteur quand `gh` n’a pas pu démarrer, ou le stderr de `gh` lui-même quand il s’est exécuté et a refusé, comme il le fait quand il n’est pas connecté. La boucle s’arrête sur l’erreur ; la lecture de session suivante ou le dépliage du repli réessaie.

Sur les autorisations, le README dit seulement que `gh` doit être installé et connecté (« con `gh` instalado y con sesión iniciada », « avec `gh` installé et une session ouverte »). Ni le README ni le code ne listent de scopes pour lire le CI. La note du README sur l’autorisation `workflow` concerne l’envoi de modifications vers `.github/workflows` en HTTPS, une autre fonctionnalité.

## Le construire avec Claude

Demandez à Claude de suivre pas à pas, avec `gh`, l’exécution GitHub Actions de la pull request de la session. L’idée que Claude doit bien saisir : quand interroger ; seulement les exécutions du commit le plus récent, seulement tant que le repli est ouvert et qu’une exécution est en cours, et une seule surveillance à la fois.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon mod Claude Code `my-panel`, ajoute un repli « CI » pour la pull request ouverte de la session, dont j’ai déjà le dépôt (`acme/shop`) et la branche de tête. Exécute `gh run list --repo <repo> --branch <branch> --json databaseId,headSha,workflowName,status,conclusion --limit 20` avec `$.process.run` (délai de 30 s), ne garde que les exécutions du `headSha` de la première ligne, une par workflow, puis `gh run view <id> --repo <repo> --json jobs` pour chacune. Masque les étapes `Set up job`, `Complete job` et `Post …`. Affiche chaque étape avec ✓ vert, ✗ rouge, ◐ jaune pour en cours, ○ gris pour en file d’attente et – gris pour ignorée. Traite une sortie non nulle comme une erreur avec le stderr de gh, et un rejet (gh absent) aussi comme une erreur ; affiche-la dans le repli. Interroge en boucle avec `$.clock.sleep(10_000)` seulement tant que le repli est ouvert et qu’une exécution n’est pas terminée, et arrête-toi sinon ; donne un id à chaque surveillance pour qu’une plus récente la remplace. Teste les analyseurs comme des fonctions pures avec du JSON gh synthétique, et la boucle avec `mock.clock`.

### Ce qu’il faut vérifier dans la réponse de Claude

1. Seules les exécutions du `headSha` de la première ligne sont gardées, une par workflow, si bien que les exécutions d’un commit plus ancien ne se mélangent jamais avec celles du commit actuel.
2. Un code de sortie non nul de `gh` est lu comme une erreur avec son stderr, et un rejet, quand `gh` est absent, s’affiche aussi comme une erreur dans le repli.
3. La boucle attend 10 secondes avec `$.clock.sleep` entre deux lectures, et s’arrête quand le repli est fermé, quand aucune exécution n’est encore en cours, ou sur une erreur.
4. Chaque surveillance a un identifiant, si bien qu’une surveillance plus récente fait s’arrêter l’ancienne, et la surveillance est lancée avec `void`, jamais attendue dans un hook.
5. Les étapes `Set up job`, `Complete job` et `Post …` sont masquées, et chaque étape affiche sa marque dans sa couleur.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « le repli continue d’interroger gh toutes les 10 secondes après la réussite de l’exécution ».

### Comment l’auteur l’a demandé

La demande d’origine pour le repli CI n’a pas été consignée. Aucun des journaux de tâches publics de narsil-check (`odd/tasks/*.md`) ne la couvre.

#### Reconstitution à partir de l’historique des commits

À partir de `git log -- hooks/ci.ts`, avec les commits liés de `hooks/register.tsx` et de `hooks/session.ts` :

- `7d91264` (2026-11-07) « feat: add an Auto-fix switch to Entorno for the session's open pull request » (ajouter à Entorno un interrupteur Auto-fix pour la pull request ouverte de la session). C’est ici que la session apprend d’abord l’existence de sa pull request, via `ccd_pr`.
- `8af1f0e` (2026-11-07) « feat: show the PR's CI step by step in a collapsible fold under Remote Control » (afficher le CI de la PR étape par étape dans un repli sous Remote Control). Tout `hooks/ci.ts` arrive dans ce seul commit. Son message : il « Reads the newest commit's GitHub Actions runs on the PR's head branch with gh, lists each job's steps without GitHub's bookkeeping ones, and polls every 10 seconds while a run goes or a push waits for one. The fold keeps its open state across sessions. » (lit avec gh les exécutions GitHub Actions du commit le plus récent sur la branche de tête de la PR, liste les étapes de chaque job sans celles de gestion interne de GitHub, et interroge toutes les 10 secondes pendant qu’une exécution tourne ou qu’un push en attend une. Le repli garde son état ouvert d’une session à l’autre.) Il change aussi la `shape` de l’atome de session pour les nouveaux champs de la pull request.
- `90c40f9` (2026-11-07) « fix: read the session's pull request again when the app binds it after the turn ends » (relire la pull request de la session quand l’application la lie après la fin du tour). Sans lui, une pull request ouverte pendant un tour n’affichait aucun CI jusqu’à la lecture suivante.
- `f091e0b` (2026-11-07) « fix: retry only the pull request read and stop the retries when the session ends » (ne retenter que la lecture de la pull request et arrêter les nouvelles tentatives quand la session se termine).

Le schéma diffère de celui des guides précédents : le repli CI est arrivé complet en un seul commit, par-dessus la mécanique de pull request de la veille, et les correctifs qui ont suivi portaient sur la découverte de la pull request, pas sur le CI lui-même.

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide. Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

Voici une version réduite de l’idée, écrite pour ce guide et vérifiée par rapport aux types de Claude Code 2.1.325. Elle est adaptée de `hooks/ci.ts` et de `hooks/register.tsx` dans [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Elle suit un seul workflow et laisse de côté l’attente d’un push.

Le type de l’état, dans `types/index.d.ts` :

```ts
export type Step = { name: string; status: string; conclusion: string }
export type Ci = { steps: Step[]; isGoing: boolean; error?: string }

declare module 'claude-code' {
  interface PluginState {
    'my-panel': { ci: Ci }
  }
}
```

La partie du module de hooks, `hooks/register.tsx` :

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'
import type { Ci, Step } from '../types'

const ci = atom({ plugin: 'my-panel', key: 'ci' } as const, { steps: [], isGoing: false } as Ci)
const NOISE = /^(Set up job|Complete job|Post .+)$/

async function gh($: EngineInterface, argv: string[]): Promise<string> {
  const ran = await $.process.run(['gh', ...argv], { timeoutMs: 30_000 })
  if (ran.exitCode !== 0) throw new Error(ran.stderr.trim() || `gh ended with code ${ran.exitCode}`)
  return ran.stdout
}

async function readCi($: EngineInterface, repo: string, branch: string): Promise<Ci> {
  try {
    const fields = 'databaseId,headSha,status,conclusion'
    const runs = JSON.parse(
      await gh($, [
        'run',
        'list',
        '--repo',
        repo,
        '--branch',
        branch,
        '--json',
        fields,
        '--limit',
        '1',
      ]),
    )
    if (!Array.isArray(runs) || runs.length === 0) return { steps: [], isGoing: false }
    const run = runs[0] as { databaseId: number; status: string }
    const viewed = JSON.parse(
      await gh($, ['run', 'view', String(run.databaseId), '--repo', repo, '--json', 'jobs']),
    )
    const steps: Step[] = (viewed.jobs ?? [])
      .flatMap((job: { steps?: Step[] }) => job.steps ?? [])
      .filter((step: Step) => !NOISE.test(step.name))
    return { steps, isGoing: run.status !== 'completed' }
  } catch (err) {
    return { steps: [], isGoing: false, error: err instanceof Error ? err.message : String(err) }
  }
}

let watch = 0
export async function watchCi($: EngineInterface, repo: string, branch: string): Promise<void> {
  const id = ++watch
  for (;;) {
    const next = await readCi($, repo, branch)
    if (id !== watch) return
    await update($, ci, () => next)
    if (next.error || !next.isGoing) return
    await $.clock.sleep(10_000)
    if (id !== watch) return
  }
}

export const MARK = (s: Step) =>
  s.status !== 'completed'
    ? s.status === 'in_progress'
      ? { mark: '◐', color: '#F5B400' }
      : { mark: '○', color: '#8A90A6' }
    : s.conclusion === 'success'
      ? { mark: '✓', color: '#22B573' }
      : s.conclusion === 'skipped'
        ? { mark: '–', color: '#8A90A6' }
        : { mark: '✗', color: '#F0435A' }
```

Lancez-la avec `void watchCi($, 'acme/shop', 'feat/login').catch(() => undefined)` depuis un hook, sans jamais l’attendre, et dessinez les étapes dans le hook `ui.render` du panneau avec `read($, ci)`, un `Text` par étape dans sa couleur `MARK`, et l’erreur en rouge quand il y en a une. Le `MARK` réduit traite toute conclusion terminée autre que success ou skipped comme un échec ; le `markOf` de Narsil Check nomme celles qui échouent (`FAILED`) et affiche aussi `neutral` en gris.

## Erreurs fréquentes et comment tester

Elles viennent du code et des commits de Narsil Check :

- **Mélanger les commits.** `gh run list` renvoie des exécutions de plusieurs commits. Ne gardez que les exécutions du commit le plus récent, une par workflow, comme le fait `latestRuns`.
- **Annoncer une réussite juste après un push.** La liste peut encore montrer l’exécution verte du commit précédent. Comparez le commit amont avec le `headSha` des exécutions, et renoncez à attendre après une limite (`CI_WAIT_POLLS`), sinon un dépôt sans CI pour ce push attend indéfiniment.
- **Traiter le code de sortie comme une exception.** `$.process.run` se résout quel que soit le code de sortie. Vérifiez `exitCode`, et gardez stderr comme raison.
- **Interroger indéfiniment.** Arrêtez-vous quand rien ne tourne, quand le repli est fermé et sur une erreur. La boucle de Narsil Check revient dans chacun de ces cas.
- **Deux surveillances à la fois.** Chaque lecture de la session peut lancer une surveillance. Donnez un id à chacune et laissez gagner la plus récente.
- **Attendre la surveillance dans un hook.** Le `$.clock.sleep` d’un hook consomme le budget de ce hook, comme le disent les types ; lancez la surveillance avec `void`.
- **Afficher la gestion interne de GitHub.** Les étapes `Set up job` et `Post …` cachent celles qui comptent.

Pour tester, `tests/ci.test.tsx` vérifie les fonctions pures avec du JSON `gh` synthétique : « the newest commit's runs, one per workflow, newest first » (les exécutions du commit le plus récent, une par workflow, les plus récentes en premier), « a run's steps leave out GitHub's own bookkeeping » (les étapes d’une exécution omettent la gestion interne de GitHub), « each step shows as done, failed, going, waiting or skipped » (chaque étape s’affiche comme faite, échouée, en cours, en attente ou ignorée) et « the fold's line says how far the CI is » (la ligne du repli dit où en est le CI). `tests/session.test.tsx` teste le repli dans le panneau : il répond à `gh` via un hook `on('process.run', ...)` dont la clé est le vecteur d’arguments joint, et fait avancer le temps avec `mock.clock` et `clock.advance(10_000)` dans « the CI fold, under Remote Control, shows the PR's run step by step and follows it until it ends » (le repli CI, sous Remote Control, montre l’exécution de la PR étape par étape et la suit jusqu’à sa fin). « a CI gh cannot read says why in its fold » (un CI que gh ne peut pas lire dit pourquoi dans son repli) répond à chaque commande avec le code de sortie 1 et attend `CI · sin leer` et la ligne rouge.

## Pour aller plus loin

- L’interrupteur **Auto-fix** juste sous le repli (guides précédents) active le propre moniteur de CI de l’application de bureau pour la même pull request, qui réveille la session quand le CI échoue ; le repli montre le CI, l’interrupteur agit dessus.
- `ciLabel` compte les étapes faites à travers chaque job et chaque exécution, et nomme l’étape en cours, si bien que l’en-tête seul suffit souvent tant que le repli reste replié.
- Le repli lit les champs JSON de `gh`, pas sa sortie texte, si bien qu’un changement de formulation de `gh` ne le casse pas.
