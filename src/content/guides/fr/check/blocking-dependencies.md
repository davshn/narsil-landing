---
title: Des dépendances qui se bloquent entre elles
description: 'Comment Narsil Check trouve les mises à jour npm qui ne peuvent pas monter seules : les peers que demande la nouvelle version, ceux que demandent les paquets installés, et les pins exacts de l’arbre.'
route: check
order: 8
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/npm.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/semver.ts
  - repo: check
    path: hooks/words.ts
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/upgrade.test.tsx
  - repo: check
    path: odd/tasks/ecosystems-wave-2.md
---

## Ce que ça fait

Certaines mises à jour ont l’air triviales et ne le sont pas. Passer d’eslint 9.39 à 10 est une version majeure sur laquelle vous pourriez vous renseigner puis l’accepter, mais si l’un de vos plugins ESLint installés n’accepte qu’eslint 9, l’installation échouera ou laissera un projet qui ne passe plus le lint. Un patch peut être pire : monter un paquet qu’un autre paquet fixe à une seule version exacte laisse deux copies installées, et certains outils cassent quand ils sont chargés deux fois.

Narsil Check vérifie cela avant de proposer quoi que ce soit. Dans un projet npm, une mise à jour que l’une de ces vérifications refuse va dans le groupe **Bloqueada** (« bloquée »), quelle que soit la taille de son saut, avec la raison écrite en dessous en rouge. Le bouton de mise à jour, **Actualizar las N**, ne l’inclut jamais.

Les raisons sont des phrases, construites à partir des données, dans l’espagnol du panneau :

| Raison dans le panneau                                                                 | En français                                                                        |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `eslint-plugin-astro 3.2.1 necesita eslint >=10.0.0 (tienes 9.39.5)`                   | La nouvelle version a besoin d’un peer que vous avez dans une autre version.       |
| `eslint-config-love exige eslint ^9.35.0`                                              | Un paquet installé demande celui-ci dans une plage que la nouvelle version quitte. |
| `typescript-eslint 8.71.0 fija @typescript-eslint/parser 8.71.0: quedarían dos copias` | Un paquet de l’arbre fixe l’ancienne version : deux copies resteraient.            |

« necesita » signifie « a besoin de », « tienes » signifie « vous avez », « exige » signifie « exige », et « fija … quedarían dos copias » signifie « fixe … deux copies resteraient ». Ces exemples sont ceux du README lui-même et des tests, avec des paquets publics bien connus.

Quand une mise à jour a plusieurs raisons, elles sont jointes par `·` sur la même ligne. Un appui sur la ligne copie la bibliothèque avec son saut et ce qui la bloque, pour que vous puissiez la coller dans une conversation et demander comment démêler la situation.

Ces vérifications n’existent que pour npm. La section du README s’ouvre sur « Solo en npm » (« npm uniquement »), et les autres écosystèmes bloquent pour leurs propres raisons (le guide précédent les liste).

## Comment ça marche à l’intérieur

### Trois vérifications, dans les deux sens

La question de conception était : qu’est-ce qui empêche une version de monter seule ? La réponse dans `hooks/npm.ts` tient en trois relations, lues dans les données et jamais devinées par un modèle :

1. **Ce que demande la nouvelle version.** Ses `peerDependencies`, comparées avec ce que le projet a installé.
2. **Ce que demandent les paquets installés.** Les `peerDependencies` de chaque paquet installé sur celui-ci, comparées avec la nouvelle version.
3. **Ce que fixe l’arbre.** Tout paquet du lockfile qui dépend de celui-ci à une seule version exacte qui n’est pas la nouvelle.

Les deux premières sont les deux sens de la même relation, et les deux sont nécessaires : un plugin qui passe à exiger eslint 10 est attrapé par la première, et un eslint 10 que votre ancienne configuration refuse est attrapé par la seconde.

### D’où viennent les données

Pour la première vérification, le manifeste de la nouvelle version est récupéré depuis `https://registry.npmjs.org/<name>/<version>` (`versionUrl`). `targetPeers` dans `hooks/register.tsx` garde la réponse dans `$.store` sous `peers:<name>@<version>` sans expiration, parce que, comme le dit son commentaire, « A version never changes once published, so its answer is kept for good. » (une version ne change jamais une fois publiée, donc sa réponse est gardée pour de bon).

Pour la seconde, le manifeste installé de chaque dépendance déclarée est lu depuis `node_modules/<name>/package.json`. Quand il n’y a pas de `node_modules` (un dépôt tout juste cloné ou créé à partir d’un modèle), `lockedPackage` lit la même information dans `package-lock.json`, ou dans `pnpm-lock.yaml` via `pnpmLocked`. Ce repli est arrivé dans `24dfeb1`, après qu’un projet pas encore installé « showed no 'exige' blocks, so eslint and typescript upgrades its plugins refuse looked safe » (n’affichait aucun blocage « exige », si bien que les mises à jour d’eslint et de typescript que ses plugins refusent semblaient sûres).

Un détail que le README n’explicite pas : la seconde vérification lit les peers des dépendances **déclarées** du projet, celles de `package.json`, parce que `scanNpm` remplit `installedMap` à partir de cette liste. Les plages peer propres à un paquet transitif ne sont pas comparées. La troisième vérification est celle qui atteint tout l’arbre.

Pour la troisième, `pinConflicts` lit la table `packages` de `package-lock.json`, qui dans les versions 2 et 3 du lockfile liste chaque paquet installé par chemin, y compris les paquets imbriqués. Le README en énonce la conséquence : « Esta comprobación usa `package-lock.json`, así que con yarn, pnpm o bun no se hace » (« cette vérification utilise `package-lock.json`, donc avec yarn, pnpm ou bun elle n’est pas faite »).

### La vérification des peers

```ts
export function peerConflicts(
  name: string,
  target: Installed,
  installed: Map<string, Installed>,
): string[] {
  const conflicts: string[] = []
  for (const [peer, range] of Object.entries(target.peers)) {
    const have = installed.get(peer)
    if (have && !satisfies(have.version, range))
      conflicts.push(
        `${name} ${show(target.version)} necesita ${peer} ${range} (tienes ${show(have.version)})`,
      )
  }
  for (const [other, have] of installed) {
    if (other === name) continue
    const range = have.peers[name]
    if (range && !satisfies(target.version, range))
      conflicts.push(`${other} exige ${name} ${range}`)
  }
  return conflicts
}
```

Il est cité de [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Trois décisions y sont visibles :

- **Un peer que vous n’avez pas n’est pas un conflit.** `have` vaut `undefined` et rien n’est ajouté. Le commentaire : « A peer the project does not have is npm's to add, not a conflict. » (un peer que le projet n’a pas, c’est à npm de l’ajouter, ce n’est pas un conflit).
- **Les plages sont lues comme npm les lit.** `satisfies` de `hooks/semver.ts` gère `||`, les plages à trait d’union, `^`, `~`, les versions partielles et `*`, si bien qu’une plage peer comme `^8.57.0 || ^9.0.0 || ^10.0.0` est comprise. Un comparateur qu’elle ne sait pas lire compte comme respecté, « so an unknown range never raises a false alarm » (si bien qu’une plage inconnue ne déclenche jamais de fausse alerte).
- **La raison nomme les deux côtés.** La première forme dit ce dont la nouvelle version a besoin et ce que vous avez ; la seconde dit qui refuse et ce qu’il accepte. L’une ou l’autre suffit pour décider quoi monter en premier.

`installedFromManifest` consigne aussi quels peers `peerDependenciesMeta` marque comme optionnels, mais `peerConflicts` ne lit pas cette liste : un peer optionnel que le projet a installé, dans une version hors de la plage, bloque comme n’importe quel autre.

### La vérification des pins

Deux copies d’un paquet sont généralement sans danger. Elles ne le sont pas pour un plugin qui s’enregistre lui-même, ni pour un singleton. Le commentaire du code donne l’exemple du « Cannot redefine plugin » d’ESLint, et le README le cas : `typescript-eslint` 8.71.0 fixe `@typescript-eslint/parser` 8.71.0, si bien que monter le parser seul en 8.72.1 fait charger le plugin deux fois par ESLint.

`pinConflicts` examine chaque paquet du lockfile, à n’importe quelle profondeur, et lit ses `dependencies` et `optionalDependencies` sur le paquet qu’on monte. Il ne signale un problème que lorsque tout ceci est vrai :

- la plage est un pin exact (`isExactPin` : `8.71.0` ou `=8.71.0`, rien d’autre) ;
- la nouvelle version ne la respecte pas ;
- le propriétaire ne fait pas partie d’une famille qui monte ensemble (voir plus bas).

Une plage qui n’est pas exacte, comme `^8.53.0`, est laissée tranquille : « a nested copy there is usually harmless » (une copie imbriquée y est généralement sans danger). Ce choix garde la vérification discrète ; un pin est une déclaration délibérée de l’auteur ou de l’autrice du paquet, une plage ne l’est pas.

### Les familles qui bougent ensemble

Certaines familles publient chaque membre à la même version et se fixent mutuellement à celle-ci : `typescript-eslint` avec son parser et son plugin, `@tailwindcss/*` avec `tailwindcss`. Les monter une par une paraîtrait toujours bloqué. Les monter ensemble ne pose pas de problème, parce que chaque pin passe à la nouvelle version en même temps.

`pinConflicts` prend donc un `batch` : les mises à jour triviales que le bouton installerait ensemble, par nom et nouvelle version. Un pin ne compte pas quand son propriétaire monte dans le lot à la même version. Il suit aussi les chaînes : l’exemple du commentaire est `@tailwindcss/vite`, qui fixe `@tailwindcss/node`, qui fixe `tailwindcss`. Les paquets fixés en lockstep par un paquet emporté sont emportés aussi, en répétant jusqu’à ce que plus rien de nouveau ne s’ajoute.

### Décider, puis décider de nouveau

Le lot dépend des mises à jour triviales, et lesquelles sont triviales dépend des pins. `scanNpm` résout cela avec une boucle :

```ts
for (let changed = true; changed;) {
  changed = false
  const batch = new Map(
    upgrades.filter((u) => u.group === 'bump').map((u) => [u.name, u.latest] as const),
  )
  for (const u of upgrades) {
    const own = peers.get(u)
    const version = parseVersion(u.latest)
    if (own === undefined || !version) continue
    u.conflicts = [...own, ...(young.get(u) ?? []), ...pinConflicts(u.name, version, lock, batch)]
    const group = u.conflicts.length > 0 ? 'blocked' : u.bump === 'major' ? 'review' : 'bump'
    if (group !== u.group) {
      u.group = group
      changed = true
    }
  }
}
```

Il est cité de [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Le commentaire au-dessus : « a blocked one leaves the batch, which can block a sibling it carried » (une mise à jour bloquée quitte le lot, ce qui peut bloquer une voisine qu’elle emportait). La boucle se termine quand un passage ne change aucun groupe. `young` contient les raisons de l’attente de 24 heures, si bien qu’elles arrivent dans la même liste. Les mises à jour du groupe Expo sautent la vérification des peers (`peers` n’a pas d’entrée pour elles, donc la boucle les saute aussi) ; elles passent par `npx expo install --fix` à la place.

### Avec quoi elle compare

Les vérifications comparent avec ce qui est installé maintenant. Le README est honnête sur la limite : « si subes varias juntas, puede que el bloqueo se resuelva entre ellas » (« si vous en montez plusieurs ensemble, il se peut que le blocage se résolve entre elles »). Seule la vérification des pins connaît le lot ; un conflit de peers entre deux mises à jour qui monteraient toutes les deux est quand même affiché. C’est le côté sûr : le panneau peut vous arrêter alors que vous auriez pu continuer, mais il ne laisse pas passer une mise à jour qui casse.

## Comment on l’a demandé à l’IA

La demande d’origine pour ces vérifications n’a pas été consignée. Elles sont déjà dans le premier commit, et aucun journal de tâches public ne les couvre.

### Consigné dans un journal de tâches, pas avec les mots de l’auteur ou de l’autrice

`odd/tasks/ecosystems-wave-2.md` consigne une décision à leur sujet au moment de l’arrivée des autres écosystèmes. C’est une hypothèse écrite dans le journal de tâches par l’agent, pas les mots de l’auteur ou de l’autrice :

> "Assumption: peer dependency and exact-pin checks stay npm-only; Go majors are new module paths (`/v2`), so a Go major is found by probing `<module>/vN/@latest`."

Traduction en français : hypothèse ; les vérifications des dépendances peer et des pins exacts restent propres à npm ; les versions majeures de Go sont de nouveaux chemins de module (`/v2`), donc une version majeure Go se trouve en sondant `<module>/vN/@latest`.

C’est pourquoi la section du README commence toujours par « Solo en npm ».

### Reconstitution à partir de l’historique des commits

À partir de `git log -- hooks/npm.ts` et de `git log -S` sur `peerConflicts`, `pinConflicts` et `lockedPackage` dans narsil-check :

- `1bf736a` (2026-11-04) « feat: add upgrade panel for npm and Expo projects » (ajouter un panneau de mises à jour pour les projets npm et Expo). Son message nomme « upgrades blocked by peer dependencies or exact pins in the lockfile » (les mises à jour bloquées par des dépendances peer ou des pins exacts dans le lockfile). `peerConflicts`, `pinConflicts` et le lot en lockstep sont tous dans ce premier commit.
- `a95eb07` (2026-11-04) « refactor: read dependencies through an adapter per ecosystem » (lire les dépendances via un adaptateur par écosystème). npm « keeps what only npm has (Expo, node_modules, peer and pin checks) » (garde ce que seul npm a : Expo, node_modules, vérifications des peers et des pins).
- `4ea9be0` (2026-11-04) « feat: block upgrades kept on purpose and Kotlin past its compiler plugins » (bloquer les mises à jour retenues exprès et Kotlin au-delà de ses plugins de compilateur). Le libellé du groupe passe de `Bloqueada por otras dependencias` (« bloquée par d’autres dépendances ») à `Bloqueada`, « since a dependency is no longer its only reason » (puisqu’une dépendance n’est plus sa seule raison).
- `24dfeb1` (2026-11-07) « fix: read peer dependencies from the lockfile when node_modules is missing » (lire les dépendances peer dans le lockfile quand node_modules manque). Son message décrit le bug que le lecteur ou la lectrice n’aurait pas remarqué : un projet pas encore installé n’affichait aucun blocage, si bien que les mises à jour refusées « looked safe » (semblaient sûres).

Le schéma : les vérifications ont été conçues d’un bloc dès le départ, et la seule correction portait sur l’origine des données, pas sur la règle.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon mod Claude Code `my-panel`, avant de marquer une mise à jour npm comme sûre, vérifie si elle peut monter seule. Écris des fonctions pures dans `hooks/npm.ts`. `peerConflicts(name, target, installed)` : pour chaque entrée `peerDependencies` de la nouvelle version, si le projet a ce peer installé dans une version hors de la plage, dis « <name> <version> needs <peer> <range> (you have <version>) » ; pour chaque paquet installé dont les `peerDependencies` nomment ce paquet avec une plage que la nouvelle version quitte, dis « <other> requires <name> <range> ». Un peer que le projet n’a pas n’est pas un conflit. `pinConflicts(name, target, lock)` : pour chaque paquet des `packages` de `package-lock.json` qui dépend de celui-ci à une version exacte (`1.2.3` ou `=1.2.3`) que la nouvelle n’est pas, dis « <owner> <version> pins <name> <range>: two copies would remain ». Lis les plages de versions avec un `satisfies` qui gère `||`, `^`, `~` et les plages à trait d’union et qui considère comme respecté ce qu’il ne sait pas lire. Dans le module de hooks, récupère le manifeste de la nouvelle version depuis `https://registry.npmjs.org/<name>/<version>` avec `$.http.fetch` et garde-le dans `$.store` pour de bon. Place toute mise à jour qui a une raison dans un groupe « blocked » et affiche les raisons en dessous. Teste avec des manifestes et des lockfiles synthétiques.

## Le code minimal

Voici une version réduite de l’idée, écrite pour ce guide et vérifiée par rapport aux types de Claude Code 2.1.325. Elle est adaptée de `hooks/npm.ts` et de `hooks/register.tsx` dans [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Elle ne gère que les plages caret, tilde, exactes et `>=`, et laisse de côté les familles qui bougent ensemble.

La partie pure, `hooks/peers.ts` :

```ts
type V = [number, number, number]
const parse = (t: string): V | undefined => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(t.trim())
  return m ? [+m[1], +m[2], +m[3]] : undefined
}
const cmp = (a: V, b: V) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]

// Enough of npm's ranges for the example: ^, ~, >=, exact, joined by ||.
export function satisfies(version: string, range: string): boolean {
  const v = parse(version)
  if (!v) return true
  return range.split('||').some((part) => {
    const m = /^\s*(\^|~|>=|=)?\s*v?(\d+\.\d+\.\d+)\s*$/.exec(part)
    const b = m && parse(m[2])
    if (!m || !b) return true // a range it cannot read never raises a false alarm
    const atLeast = cmp(v, b) >= 0
    if (m[1] === '>=') return atLeast
    if (m[1] === '~') return atLeast && v[0] === b[0] && v[1] === b[1]
    if (m[1] === '^') return atLeast && (b[0] > 0 ? v[0] === b[0] : v[0] === 0 && v[1] === b[1])
    return cmp(v, b) === 0
  })
}

export type Pkg = { version: string; peers: Record<string, string> }

export function peerConflicts(name: string, target: Pkg, installed: Map<string, Pkg>): string[] {
  const out: string[] = []
  for (const [peer, range] of Object.entries(target.peers)) {
    const have = installed.get(peer)
    if (have && !satisfies(have.version, range))
      out.push(`${name} ${target.version} needs ${peer} ${range} (you have ${have.version})`)
  }
  for (const [other, pkg] of installed) {
    const range = other === name ? undefined : pkg.peers[name]
    if (range && !satisfies(target.version, range)) out.push(`${other} requires ${name} ${range}`)
  }
  return out
}

type Lock = {
  packages?: Record<string, { version?: string; dependencies?: Record<string, string> }>
}

export function pinConflicts(name: string, target: string, lock: Lock): string[] {
  const out: string[] = []
  for (const [path, entry] of Object.entries(lock.packages ?? {})) {
    const owner = path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length)
    const range = entry.dependencies?.[name]
    if (!path.includes('node_modules/') || owner === name || !range) continue
    if (/^=?\d+\.\d+\.\d+$/.test(range.trim()) && !satisfies(target, range))
      out.push(`${owner} ${entry.version ?? ''} pins ${name} ${range}: two copies would remain`)
  }
  return out
}
```

La partie du module de hooks, qui récupère une seule fois les peers de la nouvelle version :

```ts
import type { EngineInterface } from 'claude-code'
import type { Pkg } from './peers'

export async function targetPeers(
  $: EngineInterface,
  name: string,
  version: string,
): Promise<Pkg | undefined> {
  const key = `peers:${name}@${version}`
  const kept = (await $.store.get(key)) as Pkg | undefined
  if (kept) return kept
  const res = await $.http.fetch(
    `https://registry.npmjs.org/${name.replace('/', '%2F')}/${version}`,
    { headers: { accept: 'application/json' } },
  )
  if (!res.ok) return undefined
  const manifest = JSON.parse(res.text) as { peerDependencies?: Record<string, string> }
  const pkg = { version, peers: manifest.peerDependencies ?? {} }
  await $.store.set(key, pkg)
  return pkg
}
```

Construisez `installed` à partir du `node_modules/<name>/package.json` de chaque dépendance déclarée, lu avec `$.fs.read`, sous la forme `{ version, peers: peerDependencies ?? {} }`. Pour chaque mise à jour, joignez `peerConflicts` et `pinConflicts` (avec `package-lock.json` analysé comme `lock`) ; toute raison la rend bloquée, et les raisons forment sa seconde ligne dans le panneau.

## Erreurs fréquentes et comment tester

Elles viennent du code, du README et des commits de Narsil Check :

- **Ne vérifier qu’un seul sens.** Les peers de la nouvelle version et les peers des paquets installés sont des questions différentes ; eslint 10 avec une ancienne configuration échoue à la seconde, un nouveau plugin avec un ancien eslint échoue à la première.
- **Traiter un peer manquant comme un conflit.** npm l’ajoute. Seul un peer que vous avez dans une mauvaise version bloque.
- **Ne lire que `node_modules`.** Un clone tout neuf n’en a pas, et alors rien ne bloque. C’est le bug que `24dfeb1` a corrigé en lisant les lockfiles.
- **Signaler chaque copie imbriquée.** La plupart sont sans danger. Ne signalez que les pins exacts.
- **Bloquer une famille qui bouge ensemble.** Les pins à l’intérieur d’une famille montée à la même version ne posent pas de problème ; sans le lot, `typescript-eslint` ou `@tailwindcss/*` paraîtraient bloqués pour toujours.
- **Décider une seule fois.** Bloquer une mise à jour la retire du lot et peut bloquer une voisine ; bouclez jusqu’à ce qu’aucun groupe ne change.
- **Un analyseur de plages trop strict.** S’il échoue sur `^8.57.0 || ^9.0.0 || ^10.0.0`, chaque plugin paraît incompatible. Considérez comme respecté ce que vous ne savez pas lire.
- **Récupérer le manifeste de la même version à chaque analyse.** Une version publiée ne change jamais ; gardez ses peers pour de bon.

Pour tester, `tests/upgrade.test.tsx` construit un ensemble installé avec des peers synthétiques et vérifie les phrases exactement : « typescript 7 is blocked by the packages that ask for an older one » (typescript 7 est bloqué par les paquets qui en demandent une version plus ancienne), « eslint 10 is blocked by the configs and plugins that stop at 9 » (eslint 10 est bloqué par les configurations et plugins qui s’arrêtent à 9), « eslint-plugin-astro 3 is blocked by the eslint it needs » (eslint-plugin-astro 3 est bloqué par l’eslint dont il a besoin) et « an upgrade every peer accepts has no conflicts » (une mise à jour que chaque peer accepte n’a aucun conflit). « peer ranges as packages write them » (les plages peer telles que les paquets les écrivent) fixe `satisfies` sur des formes de plages réelles. Pour les pins : « only a range naming one version is an exact pin » (seule une plage qui nomme une version est un pin exact), « a package in the tree that pins the old version leaves two copies » (un paquet de l’arbre qui fixe l’ancienne version laisse deux copies) et « a family that goes up together carries its pins, through its own members too » (une famille qui monte ensemble emporte ses pins, y compris à travers ses propres membres). Via le panneau : « a blocked upgrade shows what blocks it and the button leaves it out » (une mise à jour bloquée montre ce qui la bloque et le bouton la laisse de côté), « the button leaves out an upgrade a package in the tree pins » (le bouton laisse de côté une mise à jour qu’un paquet de l’arbre fixe), « without node_modules, the lockfiles say what a package asks for » (sans node_modules, les lockfiles disent ce que demande un paquet) et « a pnpm project with no node_modules still blocks an upgrade its installed plugins refuse » (un projet pnpm sans node_modules bloque quand même une mise à jour que ses plugins installés refusent).

## Pour aller plus loin

- La vérification des pins a besoin de `package-lock.json`. Lire de la même façon les paquets imbriqués de `pnpm-lock.yaml` l’étendrait aux projets pnpm, dont le README dit qu’ils ne sont pas couverts aujourd’hui.
- La vérification des peers pourrait aussi connaître le lot, pour que deux mises à jour qui ne sont en conflit qu’avec les anciennes versions l’une de l’autre soient proposées ensemble.
- Copier une ligne bloquée donne à Claude les deux côtés du conflit en une seule ligne : un bon point de départ pour demander quel paquet monter en premier.
