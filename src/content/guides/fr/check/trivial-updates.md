---
title: Mettre à jour les triviales
description: 'Comment le bouton Actualizar las N monte tous les patchs et mineures d’un coup, en gardant l’opérateur de plage et la section de chacun, puis lance l’outil d’installation de chaque écosystème.'
route: check
order: 12
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

## Ce que ça fait

La plus grande partie d’une liste de bibliothèques obsolètes, ce sont des patchs et des mineures que rien ne bloque. Les monter une par une est fastidieux, et c’est là que les erreurs se glissent : un `^` perdu, un outil de développement déplacé dans `dependencies`, un lockfile non rafraîchi. Narsil Check les fait en un seul appui.

Sous le groupe **Solo subir la versión** (« montée de version seule »), il y a un bouton, **Actualizar las N** (« mettre à jour les N »), ou **Actualizar esta librería** (« mettre à jour cette bibliothèque ») quand il n’y en a qu’une. Pendant l’exécution, le panneau dit `Actualizando 6 librerías con npm…` (« mise à jour de 6 bibliothèques avec npm… ») et le bouton disparaît. À la fin, un toast dit `Actualicé 6 librerías con npm.` (« j’ai mis à jour 6 bibliothèques avec npm. ») et le panneau ajoute un rappel :

```text
Actualicé 6 librerías. Ejecuta los tests antes de hacer commit.
```

Cela signifie « j’ai mis à jour 6 bibliothèques. Exécutez les tests avant de faire un commit. » Ensuite, la liste est analysée de nouveau, depuis les registres, si bien que ce que vous voyez est ce qui est vrai maintenant.

Chaque bibliothèque garde la forme qu’elle avait. Le README donne les exemples : `^3.22.0` devient `^3.25.1`, et `>=2.31,<3` devient `>=2.34.2,<3`. Une dépendance de développement reste une dépendance de développement.

### Ce que « trivial » veut dire ici

Seul le groupe `bump` monte : un saut de patch ou de mineure (selon la règle 0.x du guide 7) sans raison de blocage. Les versions majeures, les modules fixés par le SDK d’Expo et tout ce qui est dans **Bloqueada** ne sont jamais touchés. Le README fait attention au mot : « 'Trivial' solo significa que el salto no es mayor y que no choca con lo que el panel sabe: no garantiza que el proyecto compile. » Traduction en français : « “Trivial” signifie seulement que le saut n’est pas majeur et qu’il ne heurte pas ce que sait le panneau : cela ne garantit pas que le projet compile. » C’est pourquoi le dernier message vous demande d’exécuter les tests.

## Comment ça marche à l’intérieur

### Un plan par écosystème

`upgradeBumps` dans `hooks/register.tsx` prend les lignes `bump` de la dernière analyse, les regroupe par écosystème, et traite chaque écosystème avec son propre outil. Un second appui pendant une exécution ne fait rien : l’état `running` de la tâche est vérifié en premier.

Pour chaque écosystème, les étapes sont les mêmes, et chacune vient du contrat d’adaptateur de `hooks/adapter.ts` :

1. **Lire les fichiers** que liste l’adaptateur (les manifests et lockfiles qui existent).
2. **Résoudre les pins** quand la réécriture a besoin qu’une commande dise d’abord quelque chose (`pinCommand`) : les GitHub Actions fixées à un commit ont besoin du commit du nouveau tag. Si l’un d’eux ne peut pas être lu, cet écosystème est ignoré et ses fichiers ne sont pas écrits.
3. **Réécrire** les manifests (`rewrite`), quand l’écosystème est réécrit par le mod.
4. **Installer** avec les commandes que construit `installArgv`.

### npm : le gestionnaire de paquets écrit `package.json`

npm n’a pas de `rewrite`. Le mod construit la commande d’installation et laisse le gestionnaire de paquets modifier `package.json` et le lockfile. Le gestionnaire est choisi selon le lockfile présent : `pnpm-lock.yaml`, `yarn.lock`, `bun.lock` ou `bun.lockb`, sinon npm.

La plage vient de `rangeFor` dans `hooks/npm.ts` :

```ts
export function rangeFor(spec: string, latest: string): string {
  const prefix = /^(\^|~)/.exec(spec.trim())?.[1] ?? ''
  return `${prefix}${latest}`
}
```

Et la section vient d’`installArgv`, qui fait une commande pour `dependencies` et une pour `devDependencies` :

```ts
for (const isDev of [false, true]) {
  const names = upgrades
    .filter((u) => u.isDev === isDev)
    .map((u) => `${u.name}@${rangeFor(u.spec, u.latest)}`)
  if (names.length > 0) argv.push([manager, ...add, ...(isDev ? [dev] : []), ...names])
}
```

Les deux sont cités de [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). `add` vaut `install` pour npm et `add` pour les autres ; `dev` vaut `--save-dev` pour npm et `-D` pour les autres. Le test « dependencies and devDependencies install in their own sections » (les dependencies et les devDependencies s’installent dans leurs propres sections) attend, pour trois mises à jour :

```text
npm install a@^1.1.0 c@^1.1.0
npm install --save-dev b@^1.1.0
```

Deux conséquences de `rangeFor` valent la peine d’être connues. Seuls `^` et `~` sont reportés : tout autre préfixe, comme `>=`, est abandonné et la version est passée nue. Et pour une version sans préfixe, ce qui finit dans `package.json` est la décision propre du gestionnaire de paquets ; le code passe la version nue, et les tests vérifient la commande, pas le fichier écrit. Si votre projet repose sur des versions exactes, vérifiez le résultat ou réglez l’option du gestionnaire pour les enregistrements exacts.

### Les autres écosystèmes : réécrire la ligne, garder chaque autre octet

Chaque autre écosystème réécrit lui-même son manifest, ligne par ligne, et ne change que la version. Chaque adaptateur a une petite fonction qui remplace la première version d’une exigence et garde son opérateur ; PyPI et Pub gardent aussi une borne supérieure :

| Écosystème | Fonction       | Exemple tiré de son commentaire ou de ses tests  |
| ---------- | -------------- | ------------------------------------------------ |
| PyPI       | `pySpecFor`    | `>=2.31,<3` → `>=2.34.2,<3`                      |
| Cargo      | `cargoSpecFor` | garde `^`, `~`, `=` ou `>=` ; abandonne le reste |
| Pub        | `pubSpecFor`   | `>=1.0.0 <2.0.0` → `>=1.6.0 <2.0.0`              |
| RubyGems   | `gemSpecFor`   | garde `~>`, `>=` et les opérateurs du même type  |

Comme la ligne est modifiée sur place, la section ne change jamais : une crate sous `[dev-dependencies]` y reste, un paquet Python dans `requirements-dev.txt` y reste. Le `rewriteCargo` de Cargo suit même l’en-tête de table dans lequel il se trouve, si bien qu’il ne touche que les lignes sous `[dependencies]`, `[dev-dependencies]`, `[build-dependencies]` (et leurs formes `target`) ou la table propre à une crate `[dependencies.<name>]`. Leurs commentaires décrivent le but de la même façon : « every other byte as it was » (chaque autre octet tel qu’il était).

Pourquoi réécrire au lieu d’appeler la commande « add » de chaque outil ? Le code ne le dit pas à un seul endroit, mais les commentaires montrent le raisonnement : une réécriture garde la mise en forme, les commentaires et le style de plage de la personne, et fonctionne de la même façon que l’outil soit installé ou non. L’outil ne sert ensuite qu’à ce que lui seul peut faire, le lockfile.

### Lancer l’installation ensuite

Oui, le mod la lance. L’`installArgv` de chaque adaptateur dit quoi, d’après le tableau du README et le code :

| Écosystème                            | Après la réécriture                                                  |
| ------------------------------------- | -------------------------------------------------------------------- |
| npm                                   | `npm install` / `pnpm add` / `yarn add` / `bun add`, comme plus haut |
| PyPI                                  | `uv lock` ou `poetry lock` ; avec seulement `requirements.txt`, rien |
| Go                                    | `go get <module>@<version>` et `go mod tidy` (sans réécriture)       |
| Cargo                                 | `cargo update -p <crate>` pour chacune                               |
| Pub                                   | `flutter pub get` ou `dart pub get`                                  |
| NuGet                                 | `dotnet restore`                                                     |
| RubyGems                              | `bundle update --conservative <gems>`                                |
| SwiftPM                               | `swift package update`, ou `xcodebuild -resolvePackageDependencies`  |
| Maven, Gradle wrapper, GitHub Actions | rien : le prochain build ou la prochaine exécution le télécharge     |

Avec seulement `requirements.txt`, le README le dit : il n’y a pas de lockfile, donc le bouton réécrit les pins et « no instala nada » (« n’installe rien ») ; vous installez dans votre propre environnement.

npm et pnpm s’exécutent sous l’attente de 24 heures du guide 9, via l’environnement que construit `releaseAgeEnv` et le champ `env` de `$.process.run` (dans les types, « Variables set over the host process's own environment », des variables définies par-dessus l’environnement propre du processus hôte). Une dépendance trop récente n’importe où dans l’arbre fait échouer l’installation au lieu d’arriver dans le lockfile.

### Quand quelque chose échoue

Trois cas, chacun traité différemment dans `upgradeBumps` :

- **L’outil n’est pas sur cette machine** (`xcodebuild` hors d’un Mac, `cargo` non installé : l’exécution rejette avec `ENOENT`). Les fichiers réécrits de cet écosystème sont remis tels qu’ils étaient, si bien qu’un manifest monté ne part jamais avec un lockfile périmé, et les autres continuent. Le panneau dit lequel est resté, par exemple « Cargo quedó sin actualizar (2 librerías): no pude ejecutar cargo en este equipo y dejé sus archivos como estaban. » (« Cargo n’a pas été mis à jour (2 bibliothèques) : je n’ai pas pu exécuter cargo sur cette machine et j’ai laissé ses fichiers tels qu’ils étaient. »)
- **L’outil s’exécute et échoue.** Le panneau montre la commande, son code de sortie et la fin de sa sortie, ou le message propre à l’attente quand pnpm ou npm a refusé une version trop récente, et analyse de nouveau. Les écosystèmes suivants ne sont pas tentés, et les fichiers déjà réécrits restent ; `git diff` les montre.
- **Toute autre exception.** « No pude ejecutar … » (« je n’ai pas pu exécuter … ») avec l’erreur.

## Le construire avec Claude

Demandez à Claude un seul bouton qui monte d’un coup toutes les mises à jour sûres. L’idée que Claude doit bien saisir : ce que « sûr » veut dire ici ; seuls montent les sauts patch et minor que rien ne bloque, chaque plage garde son préfixe, et chaque bibliothèque reste dans sa section.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon mod Claude Code `my-panel`, ajoute un bouton « Update all » sous les mises à jour npm qui sont un patch ou une mineure et ne sont pas bloquées. Choisis le gestionnaire de paquets d’après le lockfile (pnpm, yarn, bun, sinon npm). Garde le préfixe de chaque plage : `^1.2.0` avec une dernière version 1.4.0 devient `^1.4.0`, `~` reste `~`, l’absence de préfixe reste sans préfixe. Exécute une commande pour `dependencies` et une avec `--save-dev` (ou `-D`) pour `devDependencies`, avec `$.process.run` et un délai maximal. Pendant l’exécution, masque le bouton et affiche « Updating N libraries with <manager>… » ; un second appui ne doit rien faire. Sur un code de sortie non nul, montre la commande, son code de sortie et les dernières lignes de stderr. En cas de succès, affiche un toast « Updated N libraries » et dis « Run the tests before committing ». Analyse de nouveau depuis les registres dans les deux cas. Teste que les commandes pour trois mises à jour, dont une de développement, sont exactement deux, et qu’une mise à jour bloquée ou majeure n’y figure jamais.

### Ce qu’il faut vérifier dans la réponse de Claude

1. Seul le groupe `bump` est installé. Les majeures et les mises à jour bloquées ne sont jamais dans les commandes.
2. Chaque plage garde son préfixe `^` ou `~` : `^3.22.0` devient `^3.25.1`.
3. Il y a une commande pour `dependencies` et une avec `--save-dev` (ou `-D`) pour `devDependencies`, et le gestionnaire de paquets est choisi à partir du lockfile.
4. Pendant l’exécution, le bouton est masqué et un second appui ne fait rien.
5. Un échec affiche la commande, son code de sortie et la fin de sa sortie. En cas de succès comme d’échec, la liste est analysée de nouveau.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « après avoir appuyé sur le bouton, un outil de développement est passé dans `dependencies` ».

### Comment l’auteur l’a demandé

La demande d’origine pour le bouton n’a pas été consignée : il est dans le premier commit, et aucun journal de tâches public ne couvre sa création.

#### Consigné dans un journal de tâches

Le journal de tâches `odd/tasks/release-age-all-ecosystems.md` consigne, avec les mots de l’agent, comment l’étape d’installation a été vérifiée quand l’attente de 24 heures l’a atteinte. Sa tâche T3 est « npm installs with `before` set to 24 hours ago » (npm installe avec `before` réglé 24 heures en arrière), et l’entrée L3 note qu’avec `npm_config_before` réglé un jour en arrière, npm a refusé une version de tailwindcss vieille d’une heure et a résolu sa plage vers la version précédente. C’est une preuve que l’agent a recueillie, pas une demande.

`odd/tasks/ecosystems-wave-2.md` liste « the bump button » (le bouton de montée de version) dans S3, parmi ce qui devait continuer à fonctionner à mesure que de nouveaux écosystèmes étaient ajoutés ; c’est aussi la spec de l’agent.

#### Reconstitution à partir de l’historique des commits

À partir de `git log -S rangeFor`, de `git log -S upgradeBumps` et des commits par écosystème dans narsil-check :

- `1bf736a` (2026-11-04) « feat: add upgrade panel for npm and Expo projects » (ajouter un panneau de mises à jour pour les projets npm et Expo). Son message : « trivial bumps it installs in one press » (les montées triviales, qu’il installe en un appui). `rangeFor`, l’`installArgv` à deux sections et `upgradeBumps` sont là.
- `a95eb07` (2026-11-04) « refactor: read dependencies through an adapter per ecosystem » (lire les dépendances via un adaptateur par écosystème). Les autres écosystèmes « get a generic scan, install and pending check » (reçoivent une analyse, une installation et une vérification des changements en attente génériques).
- `bbe6519`, `8ae479e`, `503ba95`, `06bcc49` (2026-11-04) : « list and upgrade » (lister et mettre à jour) les crates Rust, les paquets Python, les paquets Dart et Flutter, les gems Ruby. Chacun apporte sa propre fonction de spec et sa réécriture.
- `8c5f2a3` (2026-11-06) « feat: install npm and pnpm upgrades under the 24-hour wait through the whole tree » (installer les mises à jour npm et pnpm sous l’attente de 24 heures dans tout l’arbre).
- `7125ffd` (2026-11-09) « fix: stop the upgrade button from breaking builds it cannot check » (empêcher le bouton de mise à jour de casser des builds qu’il ne peut pas vérifier). Son message : « Skip an ecosystem whose tool is not on the machine, such as xcodebuild outside a Mac, restoring its manifests so a raised version never goes out with a stale lockfile. The other ecosystems still go up. » (ignorer un écosystème dont l’outil n’est pas sur la machine, comme xcodebuild hors d’un Mac, en restaurant ses manifests pour qu’une version montée ne parte jamais avec un lockfile périmé ; les autres écosystèmes montent quand même). Il a aussi retiré de « trivial » les pins des lockfiles Gradle et les pins exacts de Swift.

Le schéma : le bouton était là dès le premier commit, et le travail ultérieur a restreint ce que « trivial » peut inclure et ce qui se passe quand un outil manque.

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide. Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

Voici une version réduite de l’idée, écrite pour ce guide et vérifiée par rapport aux types de Claude Code 2.1.325 (`$.process.run`, `$.ui.toast`). Elle est adaptée de `hooks/npm.ts` et `hooks/register.tsx` dans [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). npm seulement ; `rescan` est votre propre analyse.

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

Gardez le message renvoyé dans un atome et dessinez-le sous le bouton. Pour un second écosystème, ajoutez avant l’installation une étape de réécriture qui ne remplace que la version sur la propre ligne de la dépendance, et remettez les fichiers d’origine si l’outil se révèle absent.

## Erreurs fréquentes et comment tester

Elles viennent du code, des tests et des commits de Narsil Check :

- **Perdre l’opérateur.** `^1.2.0` réécrit en `1.4.0` change ce que le projet accepte à partir de là. Reportez le préfixe.
- **Déplacer une dépendance de développement.** Une seule commande d’installation pour tout met les outils de développement dans `dependencies` (ou l’inverse). Séparez par section.
- **Monter plus que le groupe sûr.** Le bouton ne doit prendre que `bump` ; « a blocked upgrade shows what blocks it and the button leaves it out » (une mise à jour bloquée montre ce qui la bloque et le bouton la laisse de côté) le vérifie.
- **Un manifest sans son lockfile.** Monter `Cargo.toml` sans `cargo` pour rafraîchir `Cargo.lock` désynchronise les deux. Restaurez le manifest quand l’outil manque.
- **Remettre en forme le fichier.** Analyser un fichier TOML ou YAML puis le réécrire fait perdre les commentaires et l’ordre. Modifiez la seule ligne concernée.
- **Ne pas analyser de nouveau.** Après une installation, la liste que vous montrez doit être la nouvelle vérité, en cas de succès comme d’échec.
- **La dire sûre.** Un patch peut quand même casser un build. Dites « exécutez les tests », comme le fait le panneau.

Pour tester, `claude plugin test .` exécute `tests/upgrade.test.tsx` : « an upgrade keeps the range prefix package.json wrote » (une mise à jour garde le préfixe de plage qu’a écrit package.json : `^3.22.0` → `^3.25.1`, `~5.4.0` → `~5.9.3`, `1.2.0` → `1.3.0`), « dependencies and devDependencies install in their own sections » (les dependencies et les devDependencies s’installent dans leurs propres sections), « the button installs the trivial upgrades and scans again » (le bouton installe les mises à jour triviales et analyse de nouveau) et « a failed install says why and keeps the list » (une installation échouée dit pourquoi et garde la liste). Le fichier de tests de chaque autre écosystème vérifie sa propre réécriture, par exemple ceux de PyPI et de Cargo pour l’opérateur et la borne supérieure.

## Pour aller plus loin

- Une fois que les manifests diffèrent de `HEAD`, le panneau propose de les commiter, de les pousser et d’ouvrir une pull request. C’est un guide ultérieur de ce parcours.
- `rangeFor` ne reporte que `^` et `~`. L’étendre à `>=` ou aux plages en `x` est un petit changement, avec un test par cas.
- Une équipe qui veut que les tests s’exécutent automatiquement pourrait enchaîner une commande de test après l’installation ; Narsil Check vous le laisse exprès, avec le rappel.
