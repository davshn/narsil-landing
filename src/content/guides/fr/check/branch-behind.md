---
title: Une branche en retard sur son dépôt distant
description: 'Comment Narsil Check fait un fetch, compte les commits qui manquent à votre branche, avertit en haut du panneau et les récupère avec un bouton git pull -r.'
route: check
order: 5
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/words.ts
  - repo: check
    path: hooks/git.ts
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/session.test.tsx
---

## Ce que ça fait

Quand vous travaillez sur une branche sur laquelle quelqu’un d’autre pousse aussi, il est facile de commencer une modification sur un état ancien et de ne s’en rendre compte qu’au push suivant. Narsil Check vous le dit avant que cela n’arrive.

Chaque fois que le panneau passe en revue les bibliothèques du projet, il demande aussi à git si votre branche est en retard sur son dépôt distant. Si c’est le cas, un panneau rouge apparaît tout en haut du panneau, au-dessus de tout le reste, en gras :

> ⚠ La rama feat/login está 3 commits detrás de su remota: actualízala antes de seguir.

Traduction en français : « La branche feat/login a 3 commits de retard sur sa branche distante : mettez-la à jour avant de continuer. » Juste en dessous se trouve un bouton, **Actualizar rama** (« mettre à jour la branche »).

Le même bouton se trouve aussi tout en bas du panneau, centré sous la dernière section, pour que vous puissiez faire un pull à tout moment, avec ou sans avertissement. Un appui exécute `git pull -r` sur la branche extraite. Pendant l’exécution, le bouton devient le texte atténué « Actualizando la rama… » (« mise à jour de la branche… »). Quand c’est terminé, une ligne au-dessus du bouton du bas dit comment cela s’est passé :

| Ligne                                           | Sens                                                        |
| ----------------------------------------------- | ----------------------------------------------------------- |
| `Rama feat/login actualizada: rebase hecho`     | Vos commits locaux ont été rejoués par-dessus les nouveaux. |
| `Rama feat/login actualizada: ya estaba al día` | Rien à récupérer : elle était déjà à jour.                  |
| `Rama feat/login actualizada: Fast-forward`     | Aucun commit local : la branche a simplement avancé.        |
| `No pude actualizar la rama: …` (rouge)         | Git a refusé ou a échoué ; sa propre raison suit.           |

Après un pull réussi, le panneau passe de nouveau en revue les bibliothèques, et l’avertissement disparaît.

Quand il n’y a rien à dire, rien ne s’affiche : pas de branche distante, pas de réponse du réseau ou un `HEAD` détaché laissent l’avertissement masqué, comme le dit le README.

## Comment ça marche à l’intérieur

### Où vit le code

La spécification de ce parcours renvoie à `hooks/git.ts`, mais ce fichier n’exécute pas git. Il contient les fonctions pures de la pull request de mise à jour d’un guide ultérieur (`isMainBranch`, `branchName`, `commitTitle`, `prBody`). Le fetch, le comptage et le pull se trouvent dans `hooks/register.tsx`, et leurs mots dans `hooks/words.ts` (`behindNote`, `pullSummary`, `tail`).

### Deux petites valeurs

Le module de hooks garde deux atomes, tous deux typés dans `types/index.d.ts` :

- `behind` : `{ status: 'unknown' }` ou `{ status: 'checked', branch, count }`. Ce que la dernière revue a trouvé.
- `pull` : `idle`, `running`, `done` avec un texte, ou `failed` avec un message. Comment s’est terminé le dernier appui sur le bouton.

Le panneau se dessine à partir de ces deux valeurs et de rien d’autre. Cette séparation est l’habituelle dans Narsil Check : les fonctions qui font le travail écrivent un atome, et le hook `ui.render` ne fait que lire.

### Compter ce qui manque

`checkBehind` pose trois questions à git, chacune via `$.process.run` avec un délai de deux minutes (`GIT_MS`) :

1. `git branch --show-current`. Une réponse vide signifie un `HEAD` détaché : il n’y a pas de branche à comparer, donc la valeur reste `unknown`.
2. `git fetch --quiet`. Cela met à jour les branches de suivi distantes, si bien que le comptage qui suit porte sur le dépôt distant tel qu’il est maintenant, et non tel qu’il était au dernier fetch.
3. `git rev-list --count HEAD..@{upstream}`. `HEAD..@{upstream}` signifie « les commits que l’upstream a et que `HEAD` n’a pas ». `--count` transforme cela en un seul nombre.

Seuls un code de sortie 0 et un nombre qui s’analyse donnent `{ status: 'checked', branch, count }`. Une branche sans upstream fait échouer `rev-list`, ce qui laisse `unknown`. Tout rejet (git absent, un délai dépassé) est intercepté et laisse aussi `unknown`. L’avertissement ne s’affiche que pour `checked` avec `count > 0`.

Un détail que le README ne mentionne pas : le code ne vérifie pas le code de sortie du fetch. Si le fetch échoue faute de réseau mais que la branche a un upstream, `rev-list` compte quand même par rapport à la branche de suivi distante du dernier fetch réussi. Le comptage peut alors être périmé, et il peut être supérieur à zéro. Le « sin red … no se muestra nada » (« sans réseau … rien ne s’affiche ») du README est vrai quand il n’y a jamais eu de fetch avec lequel comparer, pas dans tous les cas.

### Quand c’est vérifié

`checkBehind` n’est jamais attendu. `scanProject` le lance avec `void checkBehind($).catch(() => undefined)` à sa première ligne, si bien que le comptage tourne en parallèle de la revue des bibliothèques. Cette revue tourne au début de la session, sur **Revisar de nuevo**, sur `/narsil-check upgrade`, après le bouton de mise à jour, après le bouton de pull request et après un pull réussi. Un projet sans manifeste à analyser reçoit quand même la vérification au début de la session, via un `else void checkBehind($)` séparé : le commentaire dit « with nothing to scan, that check still runs » (sans rien à analyser, cette vérification tourne quand même).

Il n’y a pas de minuteur. Le panneau n’interroge pas le dépôt distant à intervalles réguliers ; il regarde de nouveau quand vous ou le panneau faites quelque chose qui passe le projet en revue.

### Faire le pull

`pullBranch` est ce qu’appellent les deux boutons :

```tsx
async function pullBranch($: EngineInterface): Promise<void> {
  if ((await read($, pull)).status === 'running') return
  await update($, pull, () => ({ status: 'running' }) as Pull)
  const branch = (await read($, session)).branch
  try {
    const ran = await runCommand($, ['git', 'pull', '-r'], PULL_MS)
    const value: Pull =
      ran.exitCode === 0
        ? {
            status: 'done',
            text: `Rama ${branch || 'actual'} actualizada: ${pullSummary(ran.stdout)}`,
          }
        : {
            status: 'failed',
            message:
              tail(ran.stderr || ran.stdout) || `git pull terminó con código ${ran.exitCode}`,
          }
    await update($, pull, () => value)
  } catch (err) {
    await update($, pull, () => ({ status: 'failed', message: errorText(err) }) as Pull)
  }
  void loadSession($, true, false).catch(() => undefined)
  if ((await read($, pull)).status === 'done') void runScan($, true).catch(() => undefined)
}
```

Il est cité de [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Chaque ligne est une décision :

- **Un pull à la fois.** Un second appui pendant qu’un pull tourne ne fait rien, et le bouton n’est pas dessiné pendant ce temps.
- **Deux minutes au plus** (`PULL_MS = 120_000`). Un pull qui télécharge beaucoup peut prendre plus que les 30 secondes par défaut de `$.process.run`.
- **Une sortie non nulle est une réponse.** Les types 2.1.325 disent que `$.process.run` se résout « once it exits, any exit code » (une fois qu’il se termine, quel que soit le code de sortie) et ne rejette que « when the command cannot start or is still running then » (quand la commande ne peut pas démarrer ou tourne encore à ce moment-là). Un refus se lit donc dans `exitCode`, et `catch` sert pour git absent ou un délai dépassé.
- **La raison est celle de git.** `tail` garde les quatre dernières lignes de stderr (ou de stdout quand stderr est vide), jointes et coupées à 400 caractères : là où git écrit son « pourquoi ». Sans aucune sortie, le texte est « git pull terminó con código N » (« git pull s’est terminé avec le code N »).
- **Puis tout relire.** `loadSession` relit la branche et le dossier de la session. Seul un pull réussi relance aussi l’analyse des bibliothèques avec `isFresh` activé, parce que le pull peut avoir apporté d’autres versions dans les manifestes. Cette nouvelle analyse relance `checkBehind`, et c’est ce qui masque l’avertissement.

`runCommand` est une petite fonction d’enveloppe que le bouton de mise à jour utilise aussi : sans shell, Windows ne lance certains outils que via leur shim `.cmd`, si bien qu’une commande qui ne peut pas démarrer est réessayée en tant que `<command>.cmd`.

`pullSummary` transforme la sortie de git en quelques mots : « up to date » devient `ya estaba al día`, « Successfully rebased » devient `rebase hecho`, « Fast-forward » reste `Fast-forward`, et tout le reste est la dernière ligne de git.

### Pourquoi `-r`

L’historique montre que le choix a été fait deux fois. La première version du bouton, dans `b3ad055`, exécutait `git pull --ff-only`. Le même jour, `7b864b6` l’a changé en `git pull -r`, « replaying local commits over the remote's » (en rejouant les commits locaux par-dessus ceux du dépôt distant).

Les commits ne disent pas pourquoi. En lisant les deux options côte à côte : `--ff-only` refuse dès que vous avez un commit local que le dépôt distant n’a pas, ce qui est le cas habituel quand vous êtes en retard sur une branche partagée, si bien que le bouton échouerait justement quand on en a besoin. Un simple `git pull` créerait un commit de fusion à chaque mise à jour. Un rebase garde l’historique sur une seule ligne et garde vos commits au-dessus, ce qui correspond à ce que demande l’avertissement : « mettez-la à jour avant de continuer ». Ce raisonnement est une interprétation du changement, pas une décision consignée.

### Pourquoi le mod exécute git lui-même

Un commentaire dans `hooks/register.tsx` le dit : « The mod runs git itself, so the app asks no permission. » (le mod exécute git lui-même, donc l’application ne demande aucune permission). Un appui sur un bouton du panneau est déjà la décision de la personne ; le faire passer par l’outil Bash de Claude demanderait une nouvelle fois. Le README dit la même chose : « Lo ejecuta el mod directamente, sin pasar por los permisos de la app » (« le mod l’exécute directement, sans passer par les permissions de l’application »).

Deux choses viennent avec cela, toutes deux tirées des types 2.1.325. `$.process.run` est marqué « CLI only » (CLI uniquement), comme le reste du nom `process`. Et « Git runs with repo hooks off » (git tourne avec les hooks du dépôt désactivés), si bien que les hooks du dépôt (un hook `post-merge` ou `post-rewrite`, par exemple) ne s’exécutent pas lors de ce pull.

### Quand le bouton est proposé, et quand il ne l’est pas

Le bouton du bas est toujours dessiné, sauf pendant qu’un pull tourne. Le bouton du panneau rouge n’est dessiné qu’avec l’avertissement. Le code ne regarde pas l’arbre de travail avant de le proposer : il ne vérifie ni les modifications non commitées ni un rebase en cours.

C’est délibéré, en ce sens que git connaît déjà ces règles. Un pull avec rebase alors que des fichiers suivis ont des modifications non commitées est refusé par git (sauf si la configuration propre du dépôt, comme `rebase.autoStash`, lui dit autrement), et le panneau affiche la raison de git en rouge. Le README le décrit ainsi : « Si git no puede hacerlo (un conflicto o cambios sin commit), lo dice y muestra el motivo » (« si git ne peut pas le faire, un conflit ou des modifications non commitées, il le dit et affiche la raison »).

Un conflit est le cas à connaître. Quand le rebase s’arrête sur un conflit, git se termine avec une erreur et laisse le dépôt au milieu du rebase. Le panneau affiche la fin de la sortie de git, et c’est tout ce qu’il fait : il n’exécute pas `git rebase --abort` ni rien d’autre. C’est à vous de résoudre le conflit et de continuer, ou d’abandonner. Comme un pull échoué ne relance pas l’analyse, l’avertissement reste avec son comptage précédent jusqu’à la revue suivante.

## Comment on l’a demandé à l’IA

La demande d’origine pour l’avertissement et le bouton n’a pas été consignée. Aucun des journaux de tâches publics de narsil-check (`odd/tasks/*.md`) ne couvre cette fonctionnalité.

### Reconstitution à partir de l’historique des commits

À partir de `git log -S checkBehind`, `git log -S pullBranch` et `git log -S "pull -r"` dans narsil-check :

- `b3ad055` (2026-11-06) « feat: fold upgrade and vulnerability groups, copy a row on click, show baby Narsil and pull the branch » (replier les groupes de mises à jour et de vulnérabilités, copier une ligne au clic, afficher bébé Narsil et tirer la branche). Son message : « Actualizar rama, last in the pane, runs git pull --ff-only through the mod, with no permission prompt. » (Actualizar rama, en dernier dans le panneau, exécute git pull --ff-only via le mod, sans demande de permission). Le bouton arrive, en bas, en fast-forward uniquement.
- `7b864b6` (2026-11-06) « feat: pull the branch with a rebase » (tirer la branche avec un rebase). Son message : « Actualizar rama now runs git pull -r, replaying local commits over the remote's, and names a rebase, an up-to-date branch or a fast-forward in its result. » (Actualizar rama exécute désormais git pull -r, en rejouant les commits locaux par-dessus ceux du dépôt distant, et nomme un rebase, une branche à jour ou un fast-forward dans son résultat). La correction en chemin : de `--ff-only` à `-r`, et `pullSummary` avec ses trois issues.
- `2b91c7d` (2026-11-13) « feat: return to the default branch after the PR and warn when the branch is behind » (revenir à la branche par défaut après la PR et avertir quand la branche est en retard). Son message : « Each review fetches and counts the commits the upstream has that HEAD lacks, and shows a red warning at the top of the pane with its own pull button. » (chaque revue fait un fetch et compte les commits que l’upstream a et qui manquent à HEAD, et affiche un avertissement rouge en haut du panneau avec son propre bouton de pull).

Le schéma : d’abord un bouton manuel, son comportement corrigé le même jour, et une semaine plus tard le panneau qui apprend à dire quand le bouton est nécessaire, en en plaçant une seconde copie là où l’œil se pose en premier.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon mod Claude Code `my-panel`, ajoute à mon panneau un avertissement « en retard sur son dépôt distant ». Dans une fonction qu’aucun hook n’attend, exécute avec `$.process.run` (délai de deux minutes) `git branch --show-current`, puis `git fetch --quiet`, puis `git rev-list --count HEAD..@{upstream}`. Garde le résultat dans un atome typé dans `types/index.d.ts` : `unknown` pour un HEAD détaché, l’absence d’upstream, une sortie non nulle ou un rejet, sinon la branche et le comptage. Exécute-la au début de la session. Quand le comptage est supérieur à zéro, dessine en haut du panneau une boîte à bordure rouge qui dit « La branche X a N commits de retard sur son dépôt distant » avec un bouton qui exécute `git pull -r` (délai de deux minutes). Garde l’état du pull dans un second atome : en cours, terminé avec un court résumé de la sortie de git, ou échoué avec les dernières lignes de stderr. Ignore un second appui pendant qu’un pull tourne. Après un pull réussi, relance la vérification. Vérifie chaque API par rapport aux types de plugin-authoring et teste-la avec `claude-code/testing`, en répondant à git via un hook `on('process.run', ...)`.

## Le code minimal

Voici une version réduite de l’idée, écrite pour ce guide et vérifiée par rapport aux types de Claude Code 2.1.325. Elle est adaptée de `hooks/register.tsx` dans [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Elle laisse de côté la lecture de la session et l’analyse des bibliothèques.

Le type de l’état, dans `types/index.d.ts` :

```ts
export type Behind = { status: 'unknown' } | { status: 'checked'; branch: string; count: number }
export type Pull =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; text: string }
  | { status: 'failed'; message: string }

declare module 'claude-code' {
  interface PluginState {
    'my-panel': { behind: Behind; pull: Pull }
  }
}
```

La partie du module de hooks, `hooks/register.tsx` :

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'
import type { Behind, Pull } from '../types'

const behind = atom({ plugin: 'my-panel', key: 'behind' } as const, { status: 'unknown' } as Behind)
const pull = atom({ plugin: 'my-panel', key: 'pull' } as const, { status: 'idle' } as Pull)
const GIT_MS = 120_000

export async function checkBehind($: EngineInterface): Promise<void> {
  let value: Behind = { status: 'unknown' }
  try {
    const run = (argv: string[]) => $.process.run(argv, { timeoutMs: GIT_MS })
    const branch = (await run(['git', 'branch', '--show-current'])).stdout.trim()
    if (branch) {
      await run(['git', 'fetch', '--quiet'])
      const counted = await run(['git', 'rev-list', '--count', 'HEAD..@{upstream}'])
      const count = Number.parseInt(counted.stdout.trim(), 10)
      if (counted.exitCode === 0 && Number.isFinite(count))
        value = { status: 'checked', branch, count }
    }
  } catch {
    // Unknown: nothing shows.
  }
  await update($, behind, () => value)
}

const tail = (text: string) => text.trim().split(/\r?\n/).slice(-4).join(' ').slice(0, 400)

export async function pullBranch($: EngineInterface): Promise<void> {
  if ((await read($, pull)).status === 'running') return
  await update($, pull, () => ({ status: 'running' }) as Pull)
  try {
    const ran = await $.process.run(['git', 'pull', '-r'], { timeoutMs: GIT_MS })
    await update($, pull, () =>
      ran.exitCode === 0
        ? { status: 'done', text: tail(ran.stdout) || 'done' }
        : {
            status: 'failed',
            message: tail(ran.stderr || ran.stdout) || `exit code ${ran.exitCode}`,
          },
    )
  } catch (err) {
    await update($, pull, () => ({ status: 'failed', message: String(err) }) as Pull)
  }
  if ((await read($, pull)).status === 'done') void checkBehind($).catch(() => undefined)
}
```

Lancez la vérification depuis `session.start` avec `void checkBehind($).catch(() => undefined)` avant `return next(e)`. Dans le hook `ui.render` du panneau, lisez les deux atomes avec `read($, behind)` et `read($, pull)`. Quand `behind` vaut `checked` avec un comptage supérieur à zéro, dessinez une `Box` avec une `borderColor` rouge, un `Text` en gras avec l’avertissement et un `Button` dont l’`onPress` est `() => pullBranch($)` ; pendant que `pull` vaut `running`, dessinez à sa place un `Text` atténué. Dessinez le texte de `pull` en vert quand il vaut `done` et son message en rouge quand il vaut `failed`.

## Erreurs fréquentes et comment tester

Elles viennent du code et des commits de Narsil Check :

- **Compter avant de faire le fetch.** Sans `git fetch`, `HEAD..@{upstream}` compare avec ce que vous avez récupéré la dernière fois, peut-être il y a des jours. Faites d’abord le fetch.
- **Se fier à un fetch échoué.** Si le fetch échoue et que vous ne vérifiez pas son code de sortie, le comptage peut être périmé. Narsil Check l’accepte ; une version plus stricte garde `unknown` quand le fetch ne se termine pas avec 0.
- **Traiter « pas de réponse » comme zéro.** Un `HEAD` détaché, l’absence d’upstream ou l’absence de git ne signifient pas « à jour ». Gardez un `unknown` séparé et n’affichez rien pour lui.
- **Attendre git dans un hook.** Un fetch peut prendre des secondes. Lancez-le avec `void`, ne l’attendez jamais avec `await` dans `session.start`.
- **`--ff-only` sur une branche partagée.** Il refuse dès que vous avez un commit local, ce qui est justement le cas pour lequel existe l’avertissement. C’est la correction qu’a faite `7b864b6`.
- **Masquer la raison de git.** Un pull qui échoue sans dire pourquoi laisse la personne deviner. Gardez les dernières lignes de stderr, là où git l’écrit.
- **Oublier le rebase en cours.** Après un conflit, le dépôt est au milieu d’un rebase. Dites-le dans le message, ou au moins ne relancez pas l’analyse comme si le pull avait fonctionné.
- **Deux pulls à la fois.** Protégez la fonction avec l’état `running` et masquez le bouton pendant ce temps.

Pour tester, `tests/session.test.tsx` répond à git via un hook `on('process.run', ...)` indexé sur le vecteur d’arguments joint. « a review that finds the branch behind its remote shows a big warning at the top, with the pull at hand » (une revue qui trouve la branche en retard sur son dépôt distant affiche un grand avertissement en haut, avec le pull à portée de main) répond à `git rev-list --count HEAD..@{upstream}` par `3` et attend la boîte rouge `behind`, le texte exact de l’avertissement et le bouton `behind-pull`. « a branch up to date with its remote, or with none, shows no warning » (une branche à jour avec son dépôt distant, ou sans dépôt distant, n’affiche aucun avertissement) répond `0`. « "Actualizar rama", last in the pane, pulls the checked-out branch with a rebase and says how it went » (« Actualizar rama », en dernier dans le panneau, tire la branche extraite avec un rebase et dit comment cela s’est passé) vérifie que `branch-pull` est le dernier bouton, centré, et qu’un appui laisse « Rama feat/login actualizada: rebase hecho ». « a pull that fails says why » (un pull qui échoue dit pourquoi) attend une ligne qui commence par « No pude actualizar la rama: ». « the words of each pull that went well » (les mots de chaque pull qui s’est bien passé) teste `pullSummary` avec les vraies phrases de git.

## Pour aller plus loin

- Le nom de la branche dans la section **Entorno** ouvre un onglet de terminal dans le dossier de la session (voir le guide sur l’environnement de la session), et c’est là que vous résolvez un conflit laissé par le pull.
- `@{upstream}` peut être remplacé par `origin/main` pour montrer à quelle distance une branche de fonctionnalité se trouve de la branche par défaut, une autre question avec les trois mêmes commandes.
- Le même `checkBehind` pourrait aussi compter `@{upstream}..HEAD`, les commits que vous n’avez pas encore poussés, et avertir à leur sujet aussi.
