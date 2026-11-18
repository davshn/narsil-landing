---
title: Créer la PR
description: 'Comment Narsil Check transforme les manifests mis à jour en un commit, une branche chore/upgrade-deps et une pull request ouverte avec gh, puis vous ramène sur la branche principale.'
route: check
order: 14
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

## Ce que ça fait

Une fois les mises à jour triviales installées, les manifests sur le disque ne correspondent plus au dernier commit. Le travail qui reste est toujours le même : une branche, un commit avec seulement les fichiers de dépendances, un push, une pull request avec une description lisible, et le retour là où vous étiez. Narsil Check fait ces étapes en un seul appui.

Quand les plages de dépendances d’un manifest diffèrent de `HEAD`, le panneau affiche une ligne comme :

```text
Sin commit: 2 librerías actualizadas en package.json
```

Cela signifie « pas de commit : 2 bibliothèques mises à jour dans package.json ». En dessous, il y a un bouton, et son libellé dépend de la branche sur laquelle vous êtes :

- Sur la branche principale : **Crear rama, commit y PR** (« créer la branche, le commit et la PR »).
- Sur toute autre branche : **Commit y push a &lt;rama&gt;** (« commit et push vers &lt;branche&gt; »). Il fait le commit et le push vers cette branche, et rien d’autre. La pull request, c’est à vous de la gérer.

Sur la branche principale, le bouton fait quatre choses. Il crée `chore/upgrade-deps-2026-11-17` (la date du jour), y commite les manifests et les lockfiles, ouvre une pull request vers la branche principale avec `gh`, et revient sur la branche principale. Le panneau dit alors `PR creado desde la rama chore/upgrade-deps-2026-11-17. Volviste a main.` (« PR créée depuis la branche …. Vous êtes revenu sur main. ») et un toast donne l’adresse de la PR.

Peu importe qui a modifié le manifest. Une mise à jour faite par le panneau et une autre que vous avez tapée à la main sont toutes deux détectées, parce que la comparaison se fait avec `HEAD`, pas avec la mémoire propre du panneau.

## Comment ça marche à l’intérieur

Les textes et les petites décisions vivent dans `hooks/git.ts`, sous forme de fonctions pures : le nom de la branche, le titre et le corps du commit, le corps de la PR, quelle branche compte comme principale, et comment trouver l’adresse de la PR dans la sortie de `gh`. Les étapes qui exécutent git et gh sont dans `hooks/register.tsx`, dans `checkPending` et `publish`. Cette séparation est la même que dans le reste du mod : les tests vérifient les textes sans rien exécuter.

### Trouver ce que contiendrait une PR

`checkPending` s’exécute après chaque analyse. Pour chaque écosystème qu’utilise le projet, et pour chacun de ses manifests, il lit la version du dernier commit avec `git --no-pager show HEAD:<manifest>` et la version sur le disque, analyse les deux avec l’adaptateur de l’écosystème, et compare les plages de dépendances (`specChanges` dans `hooks/adapter.ts`).

Analyser les deux côtés avec l’adaptateur, plutôt que comparer le texte, est un choix délibéré. Un changement dans `scripts` de `package.json` n’est pas un changement de dépendance et n’apparaît pas comme tel. Une plage passée de `^3.22.0` à `^3.25.1`, si. Cela résiste aussi à un redémarrage : l’état en attente est recalculé à partir de git, il n’est gardé nulle part.

Pour chaque écosystème qui a des changements, les fichiers candidats sont ses manifests modifiés plus ses lockfiles, à la racine et partout où l’arbre en contient. Ensuite, `git status --porcelain -- <those files>` ne garde que ceux que git signale comme modifiés. Un lockfile que l’installation n’a pas touché est laissé de côté.

### Quelle branche est la principale

`isMainBranch` interroge `git symbolic-ref --short refs/remotes/origin/HEAD`, qui affiche quelque chose comme `origin/main`. Quand origin ne nomme aucune branche par défaut, `main` ou `master` comptent. Un dépôt dont la branche par défaut est `develop` est traité correctement tant que `origin/HEAD` est défini.

### Les étapes sur la branche principale

`publish` exécute chaque commande via un petit helper `step` qui met l’état du panneau au nom de l’étape (le panneau affiche `Creando la rama…`, « création de la branche… ») et lève une erreur avec ce nom si la commande échoue. Dans l’ordre :

1. `git branch --show-current`. Une réponse vide signifie un `HEAD` détaché, et le panneau s’arrête avec « cambia a una rama antes de subir los cambios » (« passez sur une branche avant de pousser les changements »).
2. `git rev-parse --verify --quiet refs/heads/chore/upgrade-deps-<day>`. Si cette branche existe déjà, `branchName` ajoute l’heure et la minute : `chore/upgrade-deps-2026-11-17-1432`.
3. `git switch -c <branch>`.
4. `git add -- <files>`, puis `git commit -m <title> -m <body> -- <files>`.
5. `git push -u origin <branch>`.
6. `gh pr create --base <main> --head <branch> --title <title> --body <body>`.
7. `git switch <main>`, puis la session et la liste des bibliothèques sont relues.

Le titre du commit est `chore(deps): upgrade 2 dependencies` (ou `1 dependency`), et le corps liste chaque changement sous la forme `- zod: 3.22.0 -> 3.25.1`. Le corps de la PR a un `## Summary` avec le gestionnaire utilisé et un tableau paquet, depuis et vers, puis un `## Test plan` avec deux cases non cochées : lancer la suite de tests et construire le projet. Les cases sont là parce qu’une mise à jour triviale a quand même besoin d’un humain pour lancer les tests.

`prUrlOf` prend la dernière ligne de la sortie de gh qui ressemble à `https://…/pull/<number>`, puisque gh peut afficher d’autres lignes avant.

### Pourquoi il commite avec une liste de chemins

Le commit est `git commit ... -- <files>`, avec les fichiers nommés après `--`. Quand des chemins sont donnés, git commite ces fichiers tels qu’ils sont sur le disque et rien d’autre, même si vous aviez d’autres fichiers dans l’index. Votre travail en cours reste hors de la PR. Le README le dit clairement : « El resto de tus cambios sin commit no se incluye » (« le reste de vos changements sans commit n’est pas inclus »).

Les autres changements sans commit vous suivent : `git switch -c` les emporte vers la nouvelle branche et `git switch <main>` les ramène, parce qu’aucun d’eux n’est dans le commit et que les seuls fichiers qui diffèrent entre les deux branches sont ceux qui viennent d’être commités.

### Pourquoi il revient sur la branche principale

Le retour sur la branche principale a été ajouté plus tard (`2b91c7d`). Rester sur la branche de mise à jour amenait des personnes à travailler par accident par-dessus une branche de PR. De retour sur la branche principale, il y a un piège que le README explique : les manifests contiennent de nouveau les anciennes versions, alors que `node_modules` (ou son équivalent) peut encore contenir les nouvelles. Le panneau analyse donc de nouveau, et le README suggère de réinstaller si vous continuez à travailler là.

Si git refuse le changement de branche, le panneau n’essaie pas de le forcer. Il reste sur la nouvelle branche et dit pourquoi : `PR creado desde la rama …. No pude volver a main: <git's error>` (« je n’ai pas pu revenir sur main »).

### Ce qui se passe quand quelque chose échoue

- **Une étape échoue avant que la PR existe.** L’erreur nomme l’étape : `No pude crear el PR. Subiendo la rama: fatal: no remote` (« je n’ai pas pu créer la PR. Envoi de la branche : … »). D’après le code, les étapes déjà exécutées ne sont pas annulées : si le push échoue, vous êtes sur la nouvelle branche avec le commit fait en local.
- **gh n’est pas connecté.** `gh pr create` se termine avec une erreur et le panneau en affiche la fin, après `Creando el PR:`. La branche est déjà poussée à ce moment-là.
- **gh est absent.** Quand une commande ne peut pas démarrer du tout, `runCommand` l’essaie une fois de plus sous la forme `<name>.cmd` (la forme qu’installe Windows), puis abandonne. D’après le code, cet échec est un rejet plutôt qu’un code de sortie, si bien qu’il atteint le panneau sans le nom de l’étape.
- **Les deux noms de branche sont pris.** Seul le nom du jour est vérifié. Si le nom avec l’heure existe aussi (deux exécutions dans la même minute), `git switch -c` échoue et le panneau dit `Creando la rama: …`. Une branche de ce nom qui n’existe que sur le dépôt distant n’est pas vérifiée ; le push échouerait alors.
- **Deux appuis.** Un appui pendant que la tâche est `running` ne fait rien.

### Les hooks de commit ne s’exécutent pas

Les types 2.1.325 disent de `$.process.run` : « Git runs with repo hooks off » (Git s’exécute avec les hooks du dépôt désactivés). Le README est d’accord : les hooks comme husky ne s’exécutent pas sur ces commits. Une équipe qui compte sur un hook de commit pour le lint ou la signature verra ces commits arriver sans lui.

### Le README et le code

Le commentaire au-dessus de `publish` dit encore « A commit of package.json and its lockfile alone » (un commit de package.json et de son lockfile seuls), de l’époque où le mod ne connaissait que npm. Le code commite les manifests et les lockfiles de chaque écosystème qui a des changements, comme le dit le README.

## Le construire avec Claude

Demandez à Claude un bouton qui transforme les changements de dépendances sur le disque en un commit et, sur la branche principale, en une pull request. L’idée que Claude doit bien saisir : le commit ne contient que les fichiers de dépendances ; ils sont nommés après `--`, si bien que votre autre travail en cours reste dehors.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon mod Claude Code `my-panel`, ajoute un bouton qui transforme les changements de dépendances de `package.json` en pull request. Compare d’abord les plages de dépendances de `git show HEAD:package.json` avec le fichier sur le disque, et liste celles qui ont changé ; n’affiche le bouton que s’il y en a. À l’appui, avec `$.process.run` et sans shell : arrête-toi avec un message clair sur un HEAD détaché ; si la branche actuelle n’est pas celle par défaut (d’après `git symbolic-ref --short refs/remotes/origin/HEAD`, sinon `main` ou `master`), fais le commit et le push vers elle et arrête-toi là. Sur la branche par défaut, crée `chore/upgrade-deps-YYYY-MM-DD` (ajoute `-HHMM` si cette branche existe), exécute `git add -- package.json package-lock.json`, `git commit -m "chore(deps): upgrade N dependencies" -m <list> -- package.json package-lock.json`, `git push -u origin <branch>` et `gh pr create --base <default> --head <branch> --title … --body …` avec un tableau des changements et un plan de test. Ensuite, reviens avec `git switch` et dis-le ; si le changement de branche échoue, reste et affiche l’erreur de git. Nomme l’étape qui échoue dans chaque erreur. Ignore un second appui pendant l’exécution. Teste-le en répondant à `process.run` dans les tests et en vérifiant l’argv exact de chaque commande, dans l’ordre.

### Ce qu’il faut vérifier dans la réponse de Claude

1. Les changements en attente viennent de la comparaison entre les plages de dépendances de `git show HEAD:package.json` et le fichier sur le disque, si bien qu’un changement dans `scripts` ne propose pas de PR.
2. La branche principale vient de `git symbolic-ref --short refs/remotes/origin/HEAD`, avec `main` ou `master` seulement quand origin n’en nomme aucune. Sur toute autre branche, le bouton commite et pousse sur cette branche, puis s’arrête.
3. Le commit nomme ses fichiers, comme dans `git commit -m … -m … -- package.json package-lock.json`, jamais avec `git commit -a` ni un `git commit` nu.
4. Après `gh pr create`, le bouton exécute `git switch` pour revenir sur la branche principale. Quand ce changement de branche échoue, il reste sur la nouvelle branche et affiche l’erreur de git.
5. Chaque erreur nomme l’étape qui a échoué, et un second appui pendant que le travail tourne ne fait rien.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « la PR contient un fichier que j’étais encore en train de modifier, pas seulement package.json et son lockfile ».

### Comment l’auteur l’a demandé

La demande d’origine pour cette fonctionnalité n’a pas été consignée. Le bouton est déjà dans le premier commit, et aucun journal de tâches public ne couvre sa création. Un journal de tâches ultérieur le mentionne, avec les mots de l’agent.

#### Consigné dans un journal de tâches

`odd/tasks/ecosystems-wave-4.md`, qui ajoute les paquets Swift, liste comme spec S2 ce qui devait continuer à fonctionner. C’est la spec de l’agent, pas les mots de l’auteur ou de l’autrice :

> "Everything the earlier waves built keeps working for SwiftPM: grouping, the bump button, Haiku reasons, copy buttons, the commit/push/PR button and the auto-open rule."

Traduction en français : « Tout ce qu’ont construit les vagues précédentes continue de fonctionner pour SwiftPM : le regroupement, le bouton de montée de version, les raisons de Haiku, les boutons de copie, le bouton commit/push/PR et la règle d’ouverture automatique. »

#### Reconstitution à partir de l’historique des commits

À partir de `git log -- hooks/git.ts` et de `git log -S` sur `hooks/register.tsx` dans narsil-check :

- `1bf736a` (2026-11-04) « feat: add upgrade panel for npm and Expo projects » (ajouter un panneau de mises à jour pour les projets npm et Expo). Son message se termine par « Pending upgrades become a commit and push, or a branch and PR from the default branch. » (les mises à jour en attente deviennent un commit et un push, ou une branche et une PR depuis la branche par défaut). Le nom de branche `chore/upgrade-deps-…`, le commit limité aux chemins et `gh pr create` sont déjà là.
- `a95eb07` (2026-11-04) « refactor: read dependencies through an adapter per ecosystem » (lire les dépendances via un adaptateur par écosystème). Les changements en attente sont lus par adaptateur, en comparant chaque manifest avec `HEAD`, si bien que le bouton fonctionne pour chaque écosystème ajouté ensuite.
- `2b91c7d` (2026-11-13) « feat: return to the default branch after the PR and warn when the branch is behind » (revenir sur la branche par défaut après la PR et avertir quand la branche est en retard). Son message : « After opening the upgrade PR the pane switches back to the base branch and rescans; a refused switch keeps the new branch and says why. » (après avoir ouvert la PR de mise à jour, le panneau revient sur la branche de base et analyse de nouveau ; un changement de branche refusé garde la nouvelle branche et dit pourquoi).

La conception n’a pas beaucoup changé. Ce qui a changé, c’est l’endroit où vous vous retrouvez ensuite.

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide. Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

Voici une version réduite de l’idée, écrite pour ce guide et vérifiée par rapport aux types de Claude Code 2.1.325 (`$.process.run`, `$.ui.toast`). Elle est adaptée de `hooks/git.ts` et de `publish` dans `hooks/register.tsx` dans [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Elle ne traite que la branche par défaut, et reçoit les fichiers et les changements déjà trouvés.

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

Appelez-la depuis le `onPress` d’un bouton, gardez un état `running` dans un atome pour qu’un second appui ne fasse rien, et affichez le message de l’erreur, qui nomme déjà l’étape, quand elle lève une exception.

## Erreurs fréquentes et comment tester

Elles viennent du code et des tests de Narsil Check :

- **`git commit -a` ou un `git commit` seul.** L’un comme l’autre peut prendre des fichiers que vous n’aviez jamais voulu inclure. Nommez les fichiers après `--`.
- **Comparer le texte au lieu des plages.** Un changement d’espaces ou un nouveau script proposerait une PR. Analysez les deux côtés avec le même lecteur.
- **Supposer que la branche par défaut est `main`.** Interrogez d’abord `origin/HEAD`.
- **Rester sur la branche de mise à jour.** Le changement suivant atterrit par accident dans la PR. Revenez, et dites-le quand vous ne pouvez pas.
- **Laisser le panneau périmé après le changement de branche.** Les manifests ont changé sous lui. Analysez de nouveau.
- **Des erreurs sans étape.** « exit code 128 » n’aide personne. Nommez l’étape.
- **Compter sur les hooks de commit.** Ils sont désactivés pour `$.process.run` ; ne supposez pas qu’un hook passe le lint sur ces commits.

Le commit lui-même prend le fichier entier tel qu’il est sur le disque. Si vous avez modifié autre chose à la main dans `package.json`, comme un script, cette modification va aussi dans la PR. Vérifiez le diff avant d’appuyer.

Pour tester, `claude plugin test .` exécute `tests/upgrade.test.tsx`, qui répond lui-même à chaque `process.run` et enregistre l’argv. « the PR button makes a branch, commits package.json and the lock, pushes and opens a PR » (le bouton de PR crée une branche, commite package.json et le lock, pousse et ouvre une PR) vérifie l’ordre des commandes, le `git add -- package.json package-lock.json` exact, le titre du commit et le `gh pr create --base main --head <branch>`, et que `git switch main` vient après gh. « on a work branch the button commits and pushes to it, with no new branch or PR » (sur une branche de travail, le bouton commite et pousse vers elle, sans nouvelle branche ni PR), « a PR that is made but cannot go back to the default branch says so and stays on the new branch » (une PR créée qui ne peut pas revenir sur la branche par défaut le dit et reste sur la nouvelle branche) et « a failed push says which step failed » (un push raté dit quelle étape a échoué) couvrent les autres chemins. « the branch is named by day, and by time when the day is taken » (la branche est nommée d’après le jour, et d’après l’heure quand le jour est pris) et « the PR address is the URL gh prints » (l’adresse de la PR est l’URL qu’affiche gh) testent les fonctions pures.

## Pour aller plus loin

- Le corps de la PR pourrait indiquer les vulnérabilités que corrige chaque mise à jour, que le panneau connaît déjà (le guide suivant).
- `gh pr create` accepte `--label` et `--reviewer`. Un réglage d’équipe pour ceux-ci est un petit ajout.
- Une branche distante du même nom n’est pas vérifiée. Un `git ls-remote --heads origin <branch>` avant le push la détecterait.
- Le guide suivant quitte les mises à jour pour la sécurité : les vulnérabilités connues des paquets que vous avez installés.
