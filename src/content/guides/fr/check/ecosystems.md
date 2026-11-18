---
title: Un adaptateur par écosystème
description: 'Comment Narsil Check lit onze écosystèmes de paquets via un petit contrat : chaque adaptateur lit son manifeste, interroge son registre et dit comment monter une version.'
route: check
order: 6
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/adapter.ts
  - repo: check
    path: hooks/ecosystems.ts
  - repo: check
    path: hooks/npm.ts
  - repo: check
    path: hooks/semver.ts
  - repo: check
    path: hooks/toml.ts
  - repo: check
    path: hooks/pypi.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/contract.test.tsx
  - repo: check
    path: tests/pypi.test.tsx
  - repo: check
    path: odd/tasks/ecosystems-wave-2.md
  - repo: check
    path: odd/tasks/ecosystems-wave-3.md
  - repo: check
    path: odd/tasks/ecosystems-wave-4.md
---

## Ce que ça fait

La section **Actualizaciones** liste les bibliothèques du projet qui ont une version plus récente, quel que soit le langage dans lequel le projet est écrit. Un dépôt avec un front-end web et un service Python obtient une seule liste, où chaque ligne nomme son écosystème à la fin quand il y en a plus d’un :

```text
zod 3.22.4 → 3.25.1 · npm
requests 2.31.0 → 2.32.3 · PyPI
```

Pour la personne, rien ne change d’un langage à l’autre : les mêmes groupes, la même copie au clic, le même bouton qui monte les mises à jour triviales. Derrière cette uniformité, il y a un adaptateur par écosystème, et ce guide porte sur cette conception.

Les écosystèmes que le mod lit, tels qu’ils sont listés dans `ADAPTERS` dans `hooks/ecosystems.ts`, dans cet ordre :

| Adaptateur       | Langages              | Lit                                                                | Interroge                              |
| ---------------- | --------------------- | ------------------------------------------------------------------ | -------------------------------------- |
| `npm`            | JavaScript, TS (Expo) | `package.json`, `package-lock.json`, `pnpm-lock.yaml`              | registry.npmjs.org                     |
| `pypi`           | Python                | `pyproject.toml`, `requirements.txt`, `uv.lock`/`poetry.lock`      | pypi.org                               |
| `go`             | Go                    | `go.mod`                                                           | proxy.golang.org                       |
| `cargo`          | Rust                  | `Cargo.toml`, `Cargo.lock`                                         | crates.io                              |
| `pub`            | Dart, Flutter         | `pubspec.yaml`, `pubspec.lock`                                     | pub.dev                                |
| `maven`          | Kotlin, Java          | `gradle/libs.versions.toml`, `build.gradle(.kts)`, `pom.xml`       | Maven Central, Google Maven, Plugin P. |
| `gradle-wrapper` | Gradle lui-même       | `gradle/wrapper/gradle-wrapper.properties`                         | services.gradle.org                    |
| `nuget`          | C#, F#, VB            | `*.csproj`, `*.fsproj`, `*.vbproj`, `Directory.Packages.props`     | api.nuget.org                          |
| `rubygems`       | Ruby                  | `Gemfile`, `Gemfile.lock`                                          | rubygems.org                           |
| `swiftpm`        | Swift                 | `Package.swift`, le `project.pbxproj` de Xcode, `Package.resolved` | les tags git de chaque paquet          |
| `actions`        | GitHub Actions        | les lignes `uses:` de `.github/workflows` et `.github/actions`     | les tags git de chaque action          |

Cela fait onze adaptateurs. Le tableau **Ecosistemas** du README a les mêmes onze lignes. Sa section sur les vulnérabilités parle de « los nueve ecosistemas » (« les neuf écosystèmes »), tout comme le journal de tâches sur l’âge des versions (« all nine ecosystems », tous les neuf écosystèmes) : les deux comptent les écosystèmes de paquets de l’époque, avant l’arrivée des adaptateurs du wrapper Gradle et de GitHub Actions dans `7048580`.

## Comment ça marche à l’intérieur

### L’idée : des adaptateurs purs, un seul moteur

`hooks/adapter.ts` s’ouvre sur la règle sur laquelle repose toute la conception :

> An adapter is pure: the hooks module reads the files it names, fetches the addresses it gives and runs the commands it builds.

Traduction en français : un adaptateur est pur ; le module de hooks lit les fichiers qu’il nomme, récupère les adresses qu’il donne et exécute les commandes qu’il construit.

Un adaptateur n’appelle jamais `$`. C’est un objet de valeurs simples et de fonctions simples : des noms de fichiers, des constructeurs d’URL, des analyseurs, des constructeurs de commandes. Le module de hooks (`hooks/register.tsx`) est le seul endroit qui touche au disque, au réseau ou à un processus. Il y a donc un seul moteur et de nombreuses descriptions, et chaque description peut être testée avec des fixtures textuelles et sans aucune chaîne d’outils.

Ce dernier point n’était pas théorique. Le journal de tâches de la vague 2 consigne : « No Python, Cargo or Dart toolchain and no project of those ecosystems on this machine: adapters are checked with fixtures and against the live registries only. » (aucune chaîne d’outils Python, Cargo ou Dart et aucun projet de ces écosystèmes sur cette machine : les adaptateurs ne sont vérifiés qu’avec des fixtures et contre les registres réels). Une conception où l’adaptateur exécutait `cargo` lui-même n’aurait pas pu être construite sur cette machine.

### Les trois questions auxquelles répond chaque adaptateur

Le type `Adapter` a de nombreux champs, la plupart optionnels. Les champs obligatoires répondent à trois questions.

**1. Qu’est-ce que le projet déclare, et qu’est-ce qui est installé ?**

- `manifests` : les fichiers dont la présence indique que le projet utilise cet écosystème, à la racine (`package.json`). `globs` ajoute des manifestes n’importe où dans l’arborescence (`**/*.csproj`).
- `lockfiles` : où sont consignées les versions installées.
- `parse(files)` : transforme le texte de ces fichiers en une liste de `Dep`, chacun `{ name, spec, isDev, installed? }`. `spec` est la plage ou la version qu’écrit le manifeste (`^18.2.0`, `>=2.31,<3`), `installed` ce que consigne un lockfile.

**2. Quelle est la version publiée la plus récente ?**

- `latestUrl(name)` : où le registre répond, avec les `headers` à envoyer.
- `latestOf(text)` : lit la version dans cette réponse.

**3. Comment une version monte-t-elle ?**

- `installArgv(present, upgrades, files)` : les commandes qui montent les mises à jour triviales (`npm install …`, `uv lock`, `cargo update -p …`).
- `rewrite(files, upgrades, pins)`, optionnel : les fichiers écrits avant ces commandes, pour les écosystèmes dont l’outil ne modifie pas le manifeste lui-même.
- `managerOf(present)` : le nom de l’outil, pour la note du bouton.

Tout le reste est une extension dont une fonctionnalité ultérieure a eu besoin, et chacune est une phrase dans les commentaires du type : `releasedUrls` et `releasedOf` pour l’attente de 24 heures, `repoUrlOf` et `importPattern` pour la lecture d’une version majeure par Haiku, `treeOf` pour la vérification des vulnérabilités, `conflictsOf` pour un écosystème qui sait ce qu’une mise à jour casse (Kotlin et ses plugins de compilateur). Trois champs existent parce qu’un écosystème ne rentrait pas dans le moule :

- `latestCommand` (SwiftPM, GitHub Actions) : il n’y a pas de registre, donc le tag le plus récent vient de `git ls-remote --tags --refs` sur le dépôt propre du paquet.
- `nextMajor` (Go) : une version majeure Go à partir de v2 est un nouveau chemin de module (`/v2`), si bien que le « latest » du registre ne quitte jamais la version majeure actuelle. Le moteur demande chaque version majeure suivante jusqu’à ce qu’il en manque une.
- `alternateUrl` (Maven) : un plugin Gradle publié comme bibliothèque se trouve sur le Plugin Portal, pas sur Maven Central, si bien qu’un échec sur le premier registre interroge le second.

### Le registre des écosystèmes

`hooks/ecosystems.ts` est court. Il définit l’adaptateur npm et les rassemble tous :

```ts
export const ADAPTERS: Adapter[] = [
  NPM,
  PYPI,
  GO,
  CARGO,
  PUB,
  MAVEN,
  GRADLE_WRAPPER,
  NUGET,
  RUBYGEMS,
  SWIFTPM,
  ACTIONS,
]

export function adapterOf(id: Ecosystem): Adapter {
  return ADAPTERS.find((a) => a.id === id) ?? NPM
}
```

Il est cité de [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). L’union `Ecosystem` dans `types/index.d.ts` liste les mêmes onze ids, si bien qu’une ligne de mise à jour porte son écosystème et que le moteur retrouve son adaptateur avec `adapterOf`.

La détection, c’est « chaque adaptateur dont le manifeste est présent ». `presentOf` dans `hooks/register.tsx` vérifie chaque manifeste, lockfile et fichier de contexte avec `$.fs.exists`, et pour les globs exécute `git ls-files --cached --others --exclude-standard`, qui liste ce que git suit ou suivrait et laisse donc de côté les sorties de build. En dehors d’un dépôt git, seuls les manifestes à la racine comptent.

### Ce que le moteur fait d’un adaptateur

Pour tout écosystème autre que npm, `scanGeneric` est toute la boucle :

1. Lire les fichiers présents avec `$.fs.read` (un fichier trop gros ou illisible est ignoré : « the adapter does without it », l’adaptateur s’en passe).
2. `adapter.parse(files)` donne les dépendances déclarées.
3. Pour chacune, la version installée est `installed`, sinon la version à partir de laquelle la plage est écrite (`baseOf`).
4. `latestIn` interroge le registre : `$.http.fetch(adapter.latestUrl(name), { headers })`, ou `$.process.run(adapter.latestCommand(name))`, et lit la réponse avec `adapter.latestOf`. La réponse est gardée dans `$.store` pendant six heures (le guide suivant explique le cache).
5. `bumpOf(installed, latest)` de `hooks/semver.ts` dit patch, mineure ou majeure, et la mise à jour arrive dans son groupe.

Le bouton de mise à jour traite la troisième question : pour chaque écosystème ayant des mises à jour triviales, il écrit ce que renvoie `rewrite`, puis exécute chaque commande d’`installArgv`. Si l’outil n’est pas sur la machine (`xcodebuild` en dehors d’un Mac), les fichiers réécrits sont remis en place, « raised manifests would go out with a stale lockfile, so they go back » (des manifestes montés partiraient avec un lockfile périmé, donc ils reviennent en arrière), et les autres écosystèmes montent quand même.

### npm, l’adaptateur de référence

npm a été le premier écosystème, le seul du premier commit. Quand les adaptateurs sont arrivés, dans `a95eb07`, « npm becomes the first adapter and keeps what only npm has (Expo, node_modules, peer and pin checks) » (npm devient le premier adaptateur et garde ce que seul npm a : Expo, node_modules, vérifications des peers et des pins). npm a donc un adaptateur comme les autres, utilisé pour la détection, le bouton, les notes de version et l’arbre des vulnérabilités, et aussi une analyse propre, `scanNpm`, pour ce que la boucle générique ne connaît pas.

Ses pièces vivent dans `hooks/npm.ts` et sont assemblées dans `hooks/ecosystems.ts` :

- `parseManifest` lit `dependencies` et `devDependencies`, le premier l’emportant quand un nom figure dans les deux.
- `lockedVersion` lit `packages["node_modules/<name>"].version` dans `package-lock.json` (v2 et v3).
- `latestUrl` interroge `https://registry.npmjs.org/<name>/latest`, « a small document, unlike the package's full record » (un petit document, contrairement à la fiche complète du paquet). Un nom avec scope garde son `@` et échappe sa barre oblique : `@types%2Fnode`.
- `managerOf` choisit npm, pnpm, yarn ou bun d’après le lockfile présent, le premier trouvé dans `LOCKFILES` l’emportant.
- `installArgv` construit une commande pour les dependencies et une pour les devDependencies, « so each package stays in its own section » (pour que chaque paquet reste dans sa propre section), et `rangeFor` garde le préfixe de la plage : `^1.2.0` devient `^1.4.0`, un pin exact reste exact.

npm n’a pas de `rewrite` : `npm install name@^1.4.0` écrit `package.json` lui-même.

### Les versions : une seule arithmétique pour tous

`hooks/semver.ts` est partagé par tous les adaptateurs. Son `Version` est `{ major, minor, patch, pre, rest? }`. `rest` contient une quatrième partie et au-delà, parce que RubyGems et NuGet les utilisent (Rails `8.1.4.1`) ; il est arrivé avec la vague Maven dans `c50e830`. Le motif accepte aussi un qualificatif Maven après un point (`5.6.15.Final`) et un `v` initial.

Il exporte quatre choses sur lesquelles repose le reste du mod :

- `compare` : majeure, mineure, patch, puis les parties supplémentaires, et une préversion avant sa version publiée.
- `bumpOf` : le type de saut, avec la règle pour les versions inférieures à 1.0.0 (guide suivant).
- `baseOf` : la version à partir de laquelle une plage est écrite, `undefined` pour ce qui n’en nomme aucune (`workspace:*`, une URL git, `latest`).
- `satisfies` : si une version respecte une plage de style npm, avec `||`, les plages à trait d’union, `^`, `~`, les versions partielles et `*`. Son commentaire énonce un choix de conception qui mérite d’être copié : « A comparator it cannot read is taken as met, so an unknown range never raises a false alarm. » (un comparateur qu’elle ne sait pas lire est considéré comme respecté, si bien qu’une plage inconnue ne déclenche jamais de fausse alerte).

### Un petit lecteur TOML

Cargo, Python et le catalogue de versions de Gradle écrivent du TOML. `hooks/toml.ts` est « a small TOML reader » (un petit lecteur TOML) : tables, tableaux de tables, clés pointées et entre guillemets, les types de chaînes, nombres, booléens, dates sous forme de texte, tableaux et tables en ligne. Il lève une exception sur une entrée malformée, et les appelants l’interceptent (un `uv.lock` illisible fait venir les versions des requirements à la place).

Pourquoi en écrire un ? Le mod n’a pas de `package.json` à lui : ses hooks n’importent que `claude-code` et ses propres fichiers. Chaque analyseur dont il a besoin, TOML, YAML pour `pnpm-lock.yaml` (lu ligne par ligne dans `pnpmLocked`), versions et plages, vit dans le dépôt. L’en-tête du lecteur liste les fichiers de Cargo et de Python ; `hooks/maven.ts` l’importe aussi, pour `libs.versions.toml`.

## Le construire avec Claude

Demandez à Claude de transformer votre liste de bibliothèques en retard en un seul moteur, avec un adaptateur pur par écosystème. L’idée que Claude doit bien saisir : un adaptateur n’appelle jamais `$` ; il nomme des fichiers, construit des adresses et des commandes, et analyse du texte, tandis que le module de hooks fait toute la lecture, toutes les requêtes et toutes les exécutions.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon mod Claude Code `my-panel`, je liste les dépendances npm obsolètes. Refactorise-le pour que chaque écosystème de paquets soit un objet adaptateur pur dans son propre fichier sous `hooks/`, sans aucun appel à `$` : `id`, `label`, `manifests` (noms de fichiers), `lockfiles`, `parse(files: Record<string, string>)` qui renvoie `{ name, spec, isDev, installed? }[]`, `latestUrl(name)`, `latestOf(text)` et `installArgv(present, upgrades)`. Garde toutes les entrées-sorties dans `hooks/register.tsx` : vérifie quels manifestes existent avec `$.fs.exists`, lis-les avec `$.fs.read`, récupère `latestUrl` avec `$.http.fetch` et exécute `installArgv` avec `$.process.run`. Fais de npm le premier adaptateur sans changement de comportement, prouvé par les tests existants. Ajoute ensuite un adaptateur PyPI pour `requirements.txt` contre `https://pypi.org/pypi/<name>/json` (`info.version`). Teste chaque adaptateur comme des fonctions pures avec des fixtures textuelles et une réponse de registre synthétique.

### Ce qu’il faut vérifier dans la réponse de Claude

1. Aucun adaptateur n’appelle `$`. `$.fs.exists`, `$.fs.read`, `$.http.fetch` et `$.process.run` n’apparaissent que dans `hooks/register.tsx`.
2. Chaque adaptateur a `manifests`, `lockfiles`, `parse`, `latestUrl`, `latestOf` et `installArgv`. Un champ dont un seul écosystème a besoin est optionnel.
3. npm devient le premier adaptateur sans changement de comportement, et les tests existants passent toujours.
4. Un nom npm avec portée garde son `@` et échappe sa barre oblique dans l’URL (`@types%2Fnode`).
5. Chaque adaptateur est testé comme des fonctions pures, avec des fixtures texte et une réponse de registre synthétique, sans aucune chaîne d’outils d’écosystème installée.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « les tests PyPI échouent sur une machine sans Python, parce que l’adaptateur exécute lui-même une commande ».

### Comment l’auteur l’a demandé

Les adaptateurs ont été construits en trois vagues le 2026-11-04, chacune avec un journal de tâches public dans narsil-check. Les journaux de tâches consignent les mots de l’auteur ou de l’autrice, ainsi que le plan que les vagues ont suivi ; les deux sont tenus séparés ci-dessous.

#### Consigné : la vague 2

`odd/tasks/ecosystems-wave-2.md`, entrée de journal L1 (2026-11-04), cite l’auteur ou l’autrice :

> "camos con la oleada 2", puis "espera primero sube a github - main y luego sigue con la oleada 2".

Traduction en français : « allons-y avec la vague 2 » (« camos » est une faute de frappe pour « vamos »), puis « attends, d’abord pousse sur GitHub, main, et ensuite continue avec la vague 2 ».

S1 consigne le plan que la vague a suivi, sous « The user's request, as wave 2 was planned in this conversation » (la demande de l’utilisateur ou de l’utilisatrice, telle que la vague 2 a été planifiée dans cette conversation) :

> "2. **PyPI, Go, Cargo y Pub.** Tienen registros con APIs JSON sencillas."

Traduction en français : « 2. PyPI, Go, Cargo et Pub. Ils ont des registres avec des API JSON simples. » Le journal ne dit pas qui a écrit cette ligne du plan. Le même S1 ajoute, avec les mots propres au journal de tâches, que « Each ecosystem's adapter follows the shared contract: `detect`, `parse`, `latest`, `importPattern` (the planned contract), plus an install command for the bump group. » (l’adaptateur de chaque écosystème suit le contrat partagé : `detect`, `parse`, `latest`, `importPattern`, le contrat prévu, plus une commande d’installation pour le groupe des montées de version). Le contrat livré a nommé ces étapes `manifests`, `parse`, `latestUrl`/`latestOf` et `installArgv`. Son hypothèse énoncée : « peer dependency and exact-pin checks stay npm-only » (les vérifications des dépendances peer et des pins exacts restent propres à npm).

#### Consigné : la vague 3

`odd/tasks/ecosystems-wave-3.md`, L1 (2026-11-04), cite l’auteur ou l’autrice : « dale a la oleada 3 » (« vas-y avec la vague 3 »). Son S1 consigne le plan :

> "3. **Maven (Kotlin/Java), NuGet y RubyGems.** Gradle es lo más difícil de leer, porque `build.gradle.kts` es código. Leería el catálogo de versiones con exactitud y los `build.gradle.kts` lo mejor posible."

Traduction en français : « 3. Maven (Kotlin/Java), NuGet et RubyGems. Gradle est le plus difficile à lire, parce que `build.gradle.kts` est du code. Je lirais le catalogue de versions avec exactitude et les fichiers `build.gradle.kts` du mieux possible. » La première personne (« Leería », « je lirais ») se lit comme une proposition que l’auteur ou l’autrice a ensuite acceptée avec « dale a la oleada 3 » ; le journal n’en dit pas plus.

Ce plan est la raison pour laquelle le README dit qu’une version Gradle gardée dans une variable « es código y queda fuera » (« est du code et reste de côté »).

#### Consigné : la vague 4

`odd/tasks/ecosystems-wave-4.md`, L1 (2026-11-04), cite l’auteur ou l’autrice : « dale a la oleada 4 » (« vas-y avec la vague 4 »). Son S1 consigne le plan :

> "4. **SwiftPM.** Lo dejo para el final porque depende de la API de GitHub, que tiene límite de peticiones."

Traduction en français : « 4. SwiftPM. Je le laisse pour la fin parce qu’il dépend de l’API de GitHub, qui a une limite de requêtes. »

Ici, le plan a changé en chemin. L’hypothèse du journal de tâches : « tags are read with `git ls-remote --tags --refs <url>` instead of the GitHub API, which has no request limit and works for any git host » (les tags sont lus avec `git ls-remote --tags --refs <url>` au lieu de l’API GitHub, ce qui n’a pas de limite de requêtes et fonctionne avec n’importe quel hébergeur git). C’est là que le contrat a obtenu `latestCommand`, dans `8444155` « feat: let an adapter answer its latest version with a command » (permettre à un adaptateur de répondre sa dernière version avec une commande).

#### Reconstitution à partir de l’historique des commits

La vague 1, npm seul, n’a pas de journal de tâches, donc sa demande n’a pas été consignée. À partir de `git log -- hooks/adapter.ts hooks/ecosystems.ts hooks/toml.ts hooks/semver.ts` :

- `1bf736a` (2026-11-04) « feat: add upgrade panel for npm and Expo projects » (ajouter un panneau de mises à jour pour les projets npm et Expo). `semver.ts` et `npm.ts` arrivent ; il n’y a pas encore d’adaptateurs.
- `a95eb07` (2026-11-04) « refactor: read dependencies through an adapter per ecosystem » (lire les dépendances via un adaptateur par écosystème). Le contrat, avec npm comme premier adaptateur « with no change in behaviour » (sans changement de comportement), comme le dit le journal de la vague 2 pour T1.
- `bbe6519`, `8ae479e`, `90f8502`, `503ba95` (2026-11-04) : Cargo (avec `toml.ts`), PyPI, Go et Pub, un commit chacun.
- `c50e830` (2026-11-04) « feat: find manifests anywhere in the tree and read four-part versions » (trouver les manifestes n’importe où dans l’arborescence et lire les versions en quatre parties) : le contrat gagne `globs` et `Version.rest` avant Maven, NuGet et RubyGems (`4f9b8ea`, `1362623`, `06bcc49`).
- `8444155` et `83c0029` (2026-11-04) : `latestCommand`, puis SwiftPM.
- `1492ca5` (2026-11-06) « feat: hold every ecosystem's upgrades for 24 hours after release » (retenir les mises à jour de chaque écosystème pendant 24 heures après leur publication) : `releasedUrls` et `releasedOf` dans chaque adaptateur.
- `7048580` (2026-11-09) « feat: check the Gradle wrapper and GitHub Actions for upgrades » (vérifier les mises à jour du wrapper Gradle et de GitHub Actions) : les dixième et onzième adaptateurs.

Le schéma : d’abord faire de l’écosystème existant un adaptateur sans changer son comportement, puis ajouter un écosystème par commit, et faire grandir le contrat d’un champ optionnel chaque fois qu’un écosystème ne rentre pas dans le moule.

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide. Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

Voici une version réduite de l’idée, écrite pour ce guide et vérifiée par rapport aux types de Claude Code 2.1.325. Elle est adaptée de `hooks/adapter.ts`, `hooks/npm.ts` et `hooks/register.tsx` dans [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Elle ne lit les versions que dans le manifeste, sans lockfile.

Le contrat et l’adaptateur npm, `hooks/adapter.ts` :

```ts
export type Dep = { name: string; spec: string; isDev: boolean }
export type Files = Record<string, string>

export type Adapter = {
  id: string
  manifests: string[]
  parse: (files: Files) => Dep[]
  latestUrl: (name: string) => string
  latestOf: (text: string) => string | undefined
  installArgv: (upgrades: { name: string; latest: string; isDev: boolean }[]) => string[][]
}

export const NPM: Adapter = {
  id: 'npm',
  manifests: ['package.json'],
  parse: (files) => {
    const json = JSON.parse(files['package.json'] ?? '{}') as Record<string, Record<string, string>>
    return (['dependencies', 'devDependencies'] as const).flatMap((field) =>
      Object.entries(json[field] ?? {}).map(([name, spec]) => ({
        name,
        spec,
        isDev: field === 'devDependencies',
      })),
    )
  },
  latestUrl: (name) => `https://registry.npmjs.org/${name.replace('/', '%2F')}/latest`,
  latestOf: (text) => (JSON.parse(text) as { version?: string }).version,
  installArgv: (upgrades) =>
    [false, true]
      .map((isDev) =>
        upgrades.filter((u) => u.isDev === isDev).map((u) => `${u.name}@^${u.latest}`),
      )
      .flatMap((names, i) =>
        names.length ? [['npm', 'install', ...(i ? ['--save-dev'] : []), ...names]] : [],
      ),
}

export const ADAPTERS: Adapter[] = [NPM]
```

Le moteur, dans `hooks/register.tsx` :

```tsx
import type { EngineInterface } from 'claude-code'
import { ADAPTERS } from './adapter'
import type { Adapter } from './adapter'

const major = (v: string) => Number(/\d+/.exec(v)?.[0] ?? 0)
const clean = (spec: string) => /\d+(\.\d+){0,2}/.exec(spec)?.[0]

export async function scan($: EngineInterface) {
  const rows: { ecosystem: string; name: string; from: string; to: string; isMajor: boolean }[] = []
  for (const adapter of ADAPTERS) {
    const files: Record<string, string> = {}
    for (const path of adapter.manifests)
      if (await $.fs.exists(path)) files[path] = await $.fs.read(path)
    if (Object.keys(files).length === 0) continue
    for (const dep of adapter.parse(files)) {
      const from = clean(dep.spec)
      if (!from) continue
      const res = await $.http.fetch(adapter.latestUrl(dep.name), {
        headers: { accept: 'application/json' },
      })
      const to = res.ok ? adapter.latestOf(res.text) : undefined
      if (to && to !== from)
        rows.push({
          ecosystem: adapter.id,
          name: dep.name,
          from,
          to,
          isMajor: major(to) !== major(from),
        })
    }
  }
  return rows
}
```

Appelez `scan` depuis une fonction qu’aucun hook n’attend, gardez les lignes dans un atome et dessinez-les dans le panneau. Le moteur réduit considère toute version différente comme plus récente et tout changement de version majeure comme majeur ; Narsil Check compare avec `compare` et `bumpOf` de `hooks/semver.ts`, lit la version installée dans le lockfile, interroge jusqu’à huit bibliothèques à la fois et met les réponses en cache.

### Exercice : ajouter PyPI

Ajoutez un second adaptateur, `PYPI`, à `ADAPTERS` sans toucher à `scan`. Il lui faut :

- `manifests: ['requirements.txt']`.
- `parse` : une dépendance par ligne, en ignorant les commentaires et les lignes d’options (`-r`, `--index-url`), le nom avant le premier opérateur (`==`, `>=`, `~=`), et le reste comme `spec`.
- `latestUrl` : `https://pypi.org/pypi/<name>/json`.
- `latestOf` : le `info.version` de ce JSON.
- `installArgv` : `[]` quand il n’y a pas de lockfile, puisque réécrire `requirements.txt` constitue toute la mise à jour (c’est aussi ce que fait Narsil Check : « con solo `requirements.txt` no hay lockfile, así que el botón reescribe los pins y no instala nada », « avec seulement `requirements.txt` il n’y a pas de lockfile, donc le bouton réécrit les pins et n’installe rien »). Votre contrat a alors besoin d’un `rewrite`.

Quand cela fonctionne, comparez avec la réponse de référence, `hooks/pypi.ts` dans narsil-check. Elle montre ce qu’ajoute un véritable adaptateur : la normalisation des noms PEP 503 (`Foo_Bar` et `foo-bar` sont un seul paquet), les extras et marqueurs de PEP 508 (`Django[argon2]~=4.2 ; python_version > '3.8'`), `pyproject.toml` lu avec `parseToml`, les versions installées depuis `uv.lock` ou `poetry.lock`, un `rewrite` qui ne monte que la première version et garde une borne supérieure (`>=2.31,<3` devient `>=2.34.2,<3`), et une table de noms d’import pour Haiku (`pyyaml` est importé sous le nom `yaml`).

## Erreurs fréquentes et comment tester

Elles viennent du code et des journaux de tâches de Narsil Check :

- **Laisser l’adaptateur faire des entrées-sorties.** Il ne peut alors pas être testé sans les outils de l’écosystème. Gardez-le pur, et laissez le moteur lire, récupérer et exécuter.
- **Un adaptateur qui en sait trop.** La logique Expo, peer et pin de npm est restée dans l’analyse propre à npm. Un champ dont un seul écosystème a besoin est optionnel, jamais exigé de tous.
- **Les noms avec scope et les noms spéciaux.** Le `@scope/name` de npm doit échapper sa barre oblique dans l’URL. PyPI compare des noms normalisés. Les versions majeures de Go sont d’autres chemins.
- **Se fier à « latest ».** Le `<release>` de Maven peut être une préversion (le journal de la vague 3 a trouvé `2.12.0-alpha05`), si bien que le maximum stable vient de la liste complète.
- **Des registres avec leurs propres règles.** crates.io refuse une requête sans User-Agent, comme le dit un commentaire dans `hooks/cargo.ts`, donc son adaptateur en envoie un dans `headers`.
- **Réécrire plus que la version.** Un `rewrite` qui reformate un manifeste produit un diff bruyant. Les réécritures de Narsil Check changent la version et « every other byte as it was » (tous les autres octets tels qu’ils étaient).
- **Un test qui simule chaque processus.** Le journal de la vague 3 consigne « A test mock that simulated the npm install on every process call broke once the scan began calling git ls-files » (un mock de test qui simulait l’installation npm à chaque appel de processus a cassé dès que l’analyse a commencé à appeler git ls-files). Ne répondez qu’aux commandes dont le test parle.

Pour tester, `tests/contract.test.tsx` vérifie les pièces partagées : « a version may have a fourth part, and it counts » (une version peut avoir une quatrième partie, et elle compte), « a glob matches at any depth with \*\*/ and within one directory with \* » (un glob correspond à n’importe quelle profondeur avec \*\*/ et dans un seul dossier avec \*), « the manifests are the root ones and the globbed ones, never a lockfile » (les manifestes sont ceux de la racine et ceux trouvés par glob, jamais un lockfile). Chaque écosystème a son propre fichier ; `tests/pypi.test.tsx` contient « a PEP 508 requirement is a name and its specifier, without extras or markers » (une exigence PEP 508 est un nom et son spécificateur, sans extras ni marqueurs), « raising a requirement keeps its operators and upper bound, and every other byte » (monter une exigence garde ses opérateurs et sa borne supérieure, et tous les autres octets), « PyPI's answer gives the latest release and the GitHub repository » (la réponse de PyPI donne la dernière version publiée et le dépôt GitHub) et, via le panneau, « a uv project lists its packages and the button raises pyproject.toml and runs uv lock » (un projet uv liste ses paquets et le bouton monte pyproject.toml et exécute uv lock) et « a project with two ecosystems names each library's » (un projet avec deux écosystèmes nomme celui de chaque bibliothèque).

## Pour aller plus loin

- Le guide suivant suit une mise à jour depuis `bumpOf` jusqu’à son groupe, et explique le cache de six heures qu’utilise `latestIn`.
- Les champs optionnels des adaptateurs sont une carte des fonctionnalités ultérieures du mod : lisez `releasedUrls` pour l’attente de 24 heures, `treeOf` pour les vulnérabilités, `conflictsOf` pour Kotlin Multiplatform.
- Un écosystème sans registre n’est pas une impasse : `latestCommand` permet à une commande git de répondre, comme le font SwiftPM et GitHub Actions.
