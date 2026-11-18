---
title: Classer les mises à jour
description: 'Comment Narsil Check range chaque bibliothèque obsolète en Bloquée, Version majeure, Montée de version seule ou Hors du SDK Expo, et pourquoi les réponses des registres sont gardées six heures.'
route: check
order: 8
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/semver.ts
  - repo: check
    path: hooks/npm.ts
  - repo: check
    path: hooks/words.ts
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/upgrade.test.tsx
  - repo: check
    path: odd/tasks/release-age-all-ecosystems.md
---

## Ce que ça fait

Une liste de cinquante bibliothèques obsolètes n’est pas utile en elle-même. Ce que vous voulez savoir, c’est lesquelles vous pouvez monter maintenant sans réfléchir, lesquelles demandent une lecture, et auxquelles vous ne devriez pas encore toucher. La section **Actualizaciones** y répond en plaçant chaque bibliothèque obsolète dans l’un de quatre groupes, dessinés dans cet ordre :

| Groupe (libellé dans le panneau) | En français                                | Indication sous l’en-tête                       | Couleur |
| -------------------------------- | ------------------------------------------ | ----------------------------------------------- | ------- |
| `Fuera del SDK de Expo`          | Hors du SDK Expo                           | `npx expo install --fix`                        | bleu    |
| `Bloqueada`                      | Bloquée                                    | `no se puede subir sola: el motivo está debajo` | rouge   |
| `Versión mayor: revisar cambios` | Version majeure : examiner les changements | `pueden romper la API`                          | jaune   |
| `Solo subir la versión`          | Montée de version seule                    | `parche o menor`                                | vert    |

Les indications signifient « elle ne peut pas monter seule : la raison est en dessous », « elles peuvent casser l’API » et « patch ou mineure ». Les libellés et les indications viennent de `GROUPS` dans `hooks/words.ts`.

Chaque groupe a un en-tête qui le replie, comme `▾ Bloqueada (2)`, et le panneau se souvient de ceux que vous avez fermés. Sous chaque ligne, il y a une seconde ligne là où cela compte : dans **Bloqueada**, tout ce qui la bloque, en rouge ; dans **Versión mayor**, la lecture par Haiku de la difficulté du saut. Seul **Solo subir la versión** a un bouton, **Actualizar las N** (« mettre à jour les N »), et il ne prend jamais une bibliothèque d’un autre groupe.

Les bibliothèques à jour n’apparaissent pas. La ligne sous l’en-tête de la section compte le reste, dans l’ordre des groupes :

```text
6 para actualizar de 31 · 2 bloqueadas · 2 mayores · 2 triviales
```

Cela signifie « 6 à mettre à jour sur 31 · 2 bloquées · 2 majeures · 2 triviales ». Quand il n’y a rien à faire, elle dit `Todo al día · 31 librerías revisadas` (« tout est à jour · 31 bibliothèques vérifiées »).

Le point coloré de la section indique le groupe le plus urgent présent : rouge si quelque chose est bloqué, sinon jaune pour une version majeure, sinon bleu pour Expo, sinon vert.

## Comment ça marche à l’intérieur

### Le type : quatre groupes et une liste de raisons

`types/index.d.ts` définit le groupe comme une union, `'bump' | 'review' | 'expo' | 'blocked'`, et chaque `Upgrade` en porte un, avec son `bump` (`'patch' | 'minor' | 'major'`) et `conflicts: string[]`. Les commentaires sur `Group` disent encore que `blocked` ne sert qu’à une dépendance peer ; le code et le README lui donnent désormais d’autres raisons (voir plus bas).

La conception sépare deux questions. `bump` est l’écart entre les versions, un fait. `group` est ce que la personne devrait faire, une décision qui peut changer à mesure qu’on en sait plus. Un patch peut être `blocked` ; une version majeure est `review` sauf si quelque chose la bloque.

### Étape 1 : la taille du saut

Chaque écosystème commence de la même façon, avec `bumpOf(installed, latest)` de `hooks/semver.ts` :

```ts
export function bumpOf(from: Version, to: Version): Bump {
  if (compare(to, from) <= 0) return 'none'
  if (to.major !== from.major) return 'major'
  if (to.minor !== from.minor) return from.major === 0 ? 'major' : 'minor'
  if (to.patch !== from.patch) return from.major === 0 && from.minor === 0 ? 'major' : 'patch'
  return 'patch'
}
```

Il est cité de [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). `none` signifie à jour (ou la dernière version du registre est plus ancienne que celle que vous avez) et la bibliothèque est laissée de côté. Sinon, `major` va dans `review` et `patch` ou `minor` dans `bump`.

### Les versions inférieures à 1.0.0

Les deux lignes du milieu portent la règle qu’énonce le commentaire : « Below 1.0.0 a minor is a breaking change (0.3 -> 0.4) and below 0.1.0 so is a patch, as npm's caret ranges treat them. » (en dessous de 1.0.0, une mineure est un changement cassant, 0.3 -> 0.4, et en dessous de 0.1.0 un patch aussi, comme les traitent les plages caret de npm).

Cela suit la convention propre au versionnage sémantique selon laquelle 0.x est instable, et le `^` de npm la lit de la même façon : `^0.3.2` accepte `0.3.9` mais pas `0.4.0`, et `^0.0.3` n’accepte rien d’autre que `0.0.3`. Si le panneau appelait mineure le passage de 0.3 à 0.4, le bouton de mise à jour monterait par-dessus un changement que l’auteur ou l’autrice du paquet a marqué comme cassant. Les tests fixent les trois cas : `0.3.1 → 0.4.0` est majeure, `0.3.1 → 0.3.2` est un patch, `0.0.3 → 0.0.4` est majeure.

Le README n’énonce que la première moitié : « un salto de minor por debajo de 1.0.0 » (« un saut de mineure en dessous de 1.0.0 »). La règle du patch en dessous de 0.1.0 se trouve dans le code et les tests, pas dans le README.

`bumpOf` est partagé, donc la règle s’applique à chaque écosystème, y compris ceux dont les outils propres lisent 0.x différemment.

### Étape 2 : npm et le SDK Expo

Une application Expo fixe les modules natifs avec lesquels chaque SDK est construit, dans `bundledNativeModules.json`. Installer une version plus récente que ce que permet cette table casse le build natif, donc dans un projet Expo « the table wins over npm » (la table l’emporte sur npm). `upgradeOf` dans `hooks/npm.ts` la vérifie avant tout le reste :

- **La version installée est hors de la plage du SDK** : la mise à jour va dans `expo`, avec la plage du SDK comme cible. C’est le groupe **Fuera del SDK de Expo**, et son indication est la commande qui le corrige.
- **La version installée est dans la plage, et npm en a une plus récente** : la réponse est `'held'`, pas une mise à jour. Elle est comptée, pas listée, et une note dit que ces bibliothèques « tienen versión nueva en npm, pero el SDK de Expo la fija: se suben con el SDK » (« ont une nouvelle version sur npm, mais le SDK Expo la fixe : elles montent avec le SDK »).

La table vient de `node_modules/expo/bundledNativeModules.json` quand il est installé, sinon de `https://unpkg.com/expo@<version>/bundledNativeModules.json` pour la version d’Expo installée. Le paquet `expo` lui-même n’est jamais jugé d’après sa propre table.

### Étape 3 : tout ce qui la bloque

En dernier, toute mise à jour qui a une raison de ne pas monter seule passe dans `blocked`, quel que soit son saut. Les raisons sont gardées sous forme de mots dans `conflicts`, et ce sont ces mots que le panneau affiche sous la ligne.

Pour npm (`scanNpm`), les raisons sont les dépendances peer et les pins du guide suivant, plus l’attente de 24 heures. Pour tous les autres écosystèmes (`scanGeneric`) :

- **Un commentaire qui retient la version exprès**, trouvé par `holdNote` : `Fijada a propósito: «…»` (« fixée exprès »), avec le commentaire lui-même.
- **Ce que l’écosystème sait qu’elle casse**, d’après le `conflictsOf` de l’adaptateur : Kotlin et ses plugins de compilateur, l’Android Gradle Plugin et le wrapper Gradle, un paquet Swift fixé à une seule version exacte.
- **L’attente de 24 heures** : une version publiée il y a moins d’un jour, comme `Publicada hace 3 h: Narsil Check espera 24 h antes de subirla` (« publiée il y a 3 h : Narsil Check attend 24 h avant de la monter »).

L’attente couvre aussi le groupe Expo : la version à laquelle se résout la plage du SDK est retenue le même délai d’un jour, et une mise à jour Expo encore en attente passe dans `blocked` avec la commande dans sa raison.

L’ordre compte pour une raison : `blocked` est décidé en dernier, donc il l’emporte sur tout. Un patch trivial qu’un plugin refuse n’est pas trivial.

### Où c’est dessiné

Le hook `ui.render` dessine `GROUPS` dans l’ordre, en filtrant `state.upgrades` par `u.group` ; à l’intérieur d’un groupe, une mise à jour qui corrige des vulnérabilités connues passe en premier. La seconde ligne d’une ligne bloquée est `u.conflicts.join(' · ')` en rouge. `sortUpgrades` ordonne la liste par groupe, puis les dependencies avant les devDependencies, puis par nom.

### Le cache de six heures

Interroger chaque registre pour chaque bibliothèque à chaque début de session serait lent et imposerait une charge réelle aux registres publics pour des réponses qui changent rarement. `latestIn` dans `hooks/register.tsx` garde chaque réponse :

```ts
// A registry answer is reused for this long, across sessions and projects.
const CACHE_MS = 6 * 60 * 60 * 1000
```

```ts
const key = `${adapter.id}:${name}`
const cached = (await $.store.get(key)) as Cached | undefined
if (!isFresh && cached && Date.now() - cached.at < CACHE_MS) return cached.version
```

Les deux sont cités de [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Après une requête, la réponse est réécrite avec `$.store.set(key, { version, at: Date.now() })`.

**Où c’est stocké.** `$.store` est, selon les mots des types 2.1.325, « This plugin's own key-value store, kept between sessions and hot reloads » (le stockage clé-valeur propre à ce plugin, conservé entre les sessions et les rechargements à chaud), « A JSON file of the plugin's own under the user's Claude Code configuration directory » (un fichier JSON propre au plugin sous le dossier de configuration Claude Code de la personne). C’est pourquoi le commentaire dit « across sessions and projects » (d’une session et d’un projet à l’autre) : la clé est l’écosystème et le nom du paquet (`npm:react`), pas le projet, si bien qu’un second projet qui utilise react réutilise la réponse. Les types disent aussi que `set` rejette « a store over 4 MiB of JSON text in all » (un stockage de plus de 4 Mio de texte JSON au total), une limite que partagent toutes les clés du mod.

**Quand il est contourné.** `isFresh` est activé par **Revisar de nuevo** (« vérifier de nouveau »), par `/narsil-check upgrade`, après le bouton de mise à jour, après le bouton de pull request et après un pull de branche réussi. Une analyse fraîche interroge de nouveau chaque registre et écrit les nouvelles réponses. L’analyse du début de session n’est pas fraîche, donc elle utilise ce qui a moins de six heures. Le README dit la même chose : « Cada respuesta se guarda 6 horas, y el botón **Revisar de nuevo** fuerza una consulta nueva » (« chaque réponse est gardée 6 heures, et le bouton **Revisar de nuevo** force une nouvelle requête »).

**Pourquoi six heures.** Ni le code, ni le README, ni les commits ne donnent de raison pour ce nombre ; `CACHE_MS` vaut six heures depuis le premier commit, `1bf736a`. En lisant le compromis : un cache plus court interrogerait chaque registre à presque chaque début de session, et un cache plus long masquerait une version publiée pendant la majeure partie d’une journée de travail. Six heures, c’est moins que l’attente de 24 heures, si bien qu’une version que le cache masque un moment n’aurait de toute façon pas pu monter pendant ce temps. Ce raisonnement est une interprétation, pas une décision consignée.

**Ce qui est gardé pour de bon à la place.** Certaines réponses ne changent jamais une fois qu’une version est publiée, si bien que le mod les garde sans minuteur : les dépendances peer d’une version (`peers:<name>@<version>`), sa date de publication (`published:…`, seulement quand c’est une date valide) et la lecture d’une version majeure par Haiku (`why:…`).

## Le construire avec Claude

Demandez à Claude de ranger chaque bibliothèque en retard dans un groupe qui dit quoi en faire. L’idée que Claude doit bien saisir : le saut et la décision sont deux choses distinctes ; `bump` dit à quelle distance sont les versions, `group` dit quoi faire, et `blocked` est décidé en dernier.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon mod Claude Code `my-panel`, j’ai une liste de bibliothèques npm obsolètes, chacune avec sa version installée et sa dernière version. Range-les en groupes : `blocked` (une liste de raisons en mots n’est pas vide), `review` (un saut majeur), `bump` (un patch ou une mineure). Écris `bumpOf(from, to)` comme une fonction pure : none, patch, minor ou major, où en dessous de 1.0.0 une mineure compte comme majeure et en dessous de 0.1.0 un patch aussi, comme les lisent les plages caret de npm. Décide `blocked` en dernier pour qu’il l’emporte sur les autres. Dessine les groupes dans l’ordre blocked, review, bump, chacun avec un en-tête repliable `▾ Label (N)` et une ligne d’indication, et les raisons sous une ligne bloquée en rouge. Seul le groupe bump reçoit un bouton « Update all ». Mets en cache chaque réponse de registre dans `$.store` sous `npm:<name>` avec l’heure, réutilise-la pendant six heures et contourne le cache quand la personne appuie sur « Check again ». Teste `bumpOf` avec des cas 0.x et le cache avec `mock.clock`.

### Ce qu’il faut vérifier dans la réponse de Claude

1. `bumpOf` est une fonction pure qui renvoie none, patch, minor ou major, et une bibliothèque à none est laissée hors de la liste.
2. En dessous de 1.0.0, une minor compte comme une major (`0.3.1 → 0.4.0`), et en dessous de 0.1.0, un patch aussi (`0.0.3 → 0.0.4`).
3. `blocked` est décidé en dernier, si bien qu’une mise à jour qui a une raison est bloquée quel que soit son saut, et ses raisons sont affichées en rouge en dessous.
4. Seul le groupe `bump` a le bouton « Update all », et il ne prend jamais une bibliothèque d’un autre groupe.
5. Chaque réponse du registre est gardée dans `$.store` sous `npm:<name>` avec l’heure, réutilisée pendant six heures, et ignorée quand vous appuyez sur « Check again ».

Si une vérification échoue, décrivez à Claude ce que vous voyez : « un patch qu’un plugin refuse apparaît toujours dans le groupe bump, et le bouton l’installerait ».

### Comment l’auteur l’a demandé

La demande d’origine pour les quatre groupes n’a pas été consignée : ils sont déjà dans le premier commit, et aucun journal de tâches public ne les couvre. Les raisons de **Bloqueada** ont grandi plus tard, et l’une d’elles est consignée avec les mots de l’auteur ou de l’autrice.

#### Consigné : l’attente de 24 heures dans chaque écosystème

`odd/tasks/release-age-all-ecosystems.md`, entrée de journal L1 (2026-11-06), cite l’auteur ou l’autrice. Le premier message posait une question sur les frameworks autres qu’Expo :

> "Y el cuánto a expo, pasa igual con frameworks como kmp o alguno de los otros lenguajes? Tenemos que pensar en ellos?"

Traduction en français : « Et pour ce qui est d’Expo, est-ce que la même chose se produit avec des frameworks comme KMP ou l’un des autres langages ? Devons-nous y penser ? » Puis :

> "El primero me interesa, deberíamos implementar algo similar para los otros lenguajes, es más seguro"

Traduction en français : « Le premier m’intéresse ; nous devrions implémenter quelque chose de similaire pour les autres langages, c’est plus sûr. » Et ensuite : « 24 horas está perfecto » (« 24 heures, c’est parfait »).

Le S4 du même journal cite une règle antérieure de l’auteur ou de l’autrice, conservée d’une correction précédente :

> "siempre que haya minimumReleaseAge se bloquee la actualizacion automatica y se marque el bloqueo, sin excepcion alguna"

Traduction en français : « chaque fois qu’il y a un minimumReleaseAge, bloquer la mise à jour automatique et signaler le blocage, sans aucune exception. » C’est pourquoi aucune liste d’exclusion ne compte nulle part, et pourquoi une date illisible bloque aussi.

Une correction est arrivée le même jour. L7 cite la question de l’auteur ou de l’autrice :

> "que pasa si una version siempre trae fecha ilegible? nunca la vamos a actualizar?"

Traduction en français : « que se passe-t-il si une version arrive toujours avec une date illisible ? nous ne la mettrons jamais à jour ? » Le journal de tâches consigne la proposition acceptée (« si hazlo asi », « oui, fais-le comme ça ») : une telle version attend 24 heures à partir du moment où le mod l’a vue pour la première fois. Ce repli et le reste de la conception sont la proposition de l’agent, écrite dans le journal ; les mots de l’auteur ou de l’autrice sont la question et le « si ».

#### Reconstitution à partir de l’historique des commits

À partir de `git log -- hooks/semver.ts hooks/words.ts` et de `git log -S` sur les libellés des groupes, dans narsil-check :

- `1bf736a` (2026-11-04) « feat: add upgrade panel for npm and Expo projects » (ajouter un panneau de mises à jour pour les projets npm et Expo). Son message : le panneau « lists the project's outdated libraries by how hard each upgrade is » (liste les bibliothèques obsolètes du projet selon la difficulté de chaque mise à jour). Les quatre groupes, `bumpOf` avec la règle 0.x et `CACHE_MS` sont tous là. Le groupe bloqué s’appelait alors `Bloqueada por otras dependencias` (« bloquée par d’autres dépendances »), avec des couleurs de terminal simples (rouge, magenta, jaune, vert).
- `4ea9be0` (2026-11-04) « feat: block upgrades kept on purpose and Kotlin past its compiler plugins » (bloquer les mises à jour retenues exprès et Kotlin au-delà de ses plugins de compilateur). Son message : « The blocked group is now just Bloqueada, since a dependency is no longer its only reason. » (le groupe bloqué s’appelle désormais simplement Bloqueada, puisqu’une dépendance n’est plus sa seule raison).
- `690c1bb` (2026-11-06) « feat: block upgrades pnpm would refuse under minimumReleaseAge » (bloquer les mises à jour que pnpm refuserait sous minimumReleaseAge), puis `54ac6aa` (2026-11-06) « fix: block every upgrade under pnpm's minimumReleaseAge, with no exceptions » (bloquer toute mise à jour sous le minimumReleaseAge de pnpm, sans exception).
- `1492ca5` (2026-11-06) « feat: hold every ecosystem's upgrades for 24 hours after release » (retenir les mises à jour de chaque écosystème pendant 24 heures après leur publication), et `ca13b3c` (2026-11-06) « feat: hold Expo SDK-pinned versions for 24 hours too » (retenir aussi pendant 24 heures les versions fixées par le SDK Expo).
- `54cd243` (2026-11-06) « feat: let a version with no readable date go up a day after it was first seen » (laisser une version sans date lisible monter un jour après sa première observation). La correction de L7.

Le schéma : les groupes étaient justes dès le départ, et ce qui a changé, c’est le sens de **Bloqueada**, de « une autre dépendance la refuse » à « tout ce qui, à notre connaissance, rend risqué de la monter seule ».

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide. Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

Voici une version réduite de l’idée, écrite pour ce guide et vérifiée par rapport aux types de Claude Code 2.1.325. Elle est adaptée de `hooks/semver.ts`, `hooks/npm.ts` et `hooks/register.tsx` dans [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Elle laisse de côté Expo et les raisons elles-mêmes ; `reasons` est ce que vos vérifications ont trouvé.

```ts
import type { EngineInterface } from 'claude-code'

type V = { major: number; minor: number; patch: number }
export type Group = 'blocked' | 'review' | 'bump'

export function parse(text: string): V | undefined {
  const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(text.trim())
  return m ? { major: +m[1], minor: +(m[2] ?? 0), patch: +(m[3] ?? 0) } : undefined
}

export function bumpOf(from: V, to: V): 'none' | 'patch' | 'minor' | 'major' {
  const d = to.major - from.major || to.minor - from.minor || to.patch - from.patch
  if (d <= 0) return 'none'
  if (to.major !== from.major) return 'major'
  if (to.minor !== from.minor) return from.major === 0 ? 'major' : 'minor'
  return from.major === 0 && from.minor === 0 ? 'major' : 'patch'
}

export function groupOf(from: V, to: V, reasons: string[]): Group | undefined {
  const bump = bumpOf(from, to)
  if (bump === 'none') return undefined
  if (reasons.length > 0) return 'blocked'
  return bump === 'major' ? 'review' : 'bump'
}

const CACHE_MS = 6 * 60 * 60 * 1000
type Cached = { version: string; at: number }

export async function latest(
  $: EngineInterface,
  name: string,
  isFresh: boolean,
): Promise<string | undefined> {
  const key = `npm:${name}`
  const cached = (await $.store.get(key)) as Cached | undefined
  if (!isFresh && cached && Date.now() - cached.at < CACHE_MS) return cached.version
  const res = await $.http.fetch(`https://registry.npmjs.org/${name.replace('/', '%2F')}/latest`, {
    headers: { accept: 'application/json' },
  })
  const version = res.ok ? (JSON.parse(res.text) as { version?: string }).version : undefined
  if (version) await $.store.set(key, { version, at: Date.now() } satisfies Cached)
  return version
}
```

Appelez `latest` pour chaque dépendance déclarée depuis une analyse qu’aucun hook n’attend, puis `groupOf` avec la version installée et les raisons qu’ont trouvées vos vérifications, et gardez la liste dans un atome. Dans le panneau, dessinez un bloc repliable par groupe dans l’ordre de `Group`, et le bouton **Update all** seulement sous `bump`. Le `parse` réduit ignore les préversions et les quatrièmes parties, que gère `hooks/semver.ts`.

## Erreurs fréquentes et comment tester

Elles viennent du code et des commits de Narsil Check :

- **Mélanger le saut et la décision.** Gardez `bump` (un fait) et `group` (ce qu’il faut faire) séparés, pour qu’on sache encore qu’un patch bloqué est un patch.
- **Décider bloqué en premier.** Une règle ultérieure qui fixe `review` ou `bump` le défairait. L’analyse npm de Narsil Check boucle même jusqu’à ce qu’aucun groupe ne change, parce que bloquer une mise à jour peut en bloquer une voisine.
- **Lire 0.x comme 1.x.** `0.3 → 0.4` est cassant. `0.0.3 → 0.0.4` aussi.
- **Une ligne bloquée sans raison.** Le groupe dit « la raison est en dessous » ; une ligne vide rompt cette promesse. Gardez les raisons sous forme de mots.
- **Un bouton qui prend tout.** Il ne doit prendre que le groupe `bump` ; le test « a blocked upgrade shows what blocks it and the button leaves it out » (une mise à jour bloquée montre ce qui la bloque et le bouton la laisse de côté) le vérifie.
- **Mettre en cache par projet.** La dernière version d’un paquet est la même dans tous les projets. Indexez-la par écosystème et par nom.
- **Mettre en cache avec un minuteur ce qui ne change jamais.** Les peers et les dates de publication d’une version publiée peuvent être gardés pour de bon ; les dernières versions, non.
- **Mettre en cache des données invalides.** Seule une date valide est gardée pour l’attente de 24 heures, si bien que « the next scan asks again » (l’analyse suivante demande de nouveau).

Pour tester, `tests/upgrade.test.tsx` contient « the jump between two versions » (le saut entre deux versions, avec les cas 0.x), « each dependency lands in its group » (chaque dépendance arrive dans son groupe), « the Expo SDK table wins over npm for the modules it pins » (la table du SDK Expo l’emporte sur npm pour les modules qu’elle fixe) et « the summary counts each group » (le résumé compte chaque groupe). Les tests du panneau utilisent `$.ui.mount` et `ui.press` : « a press on a library copies it, with no copy buttons, and each group folds on its own » (un appui sur une bibliothèque la copie, sans boutons de copie, et chaque groupe se replie de lui-même). Les tests sur l’âge des versions, comme « a version younger than minimumReleaseAge says how long it still waits » (une version plus récente que minimumReleaseAge dit combien de temps elle attend encore) et « a version whose date nobody can read goes up a day after the mod first saw it, and an answer that is not a date is never kept » (une version dont personne ne peut lire la date monte un jour après que le mod l’a vue pour la première fois, et une réponse qui n’est pas une date n’est jamais gardée), couvrent les raisons de blocage liées au temps.

## Pour aller plus loin

- Le guide suivant explique les raisons de blocage propres à npm : les peers de la nouvelle version, les peers de ce qui est installé, et les pins exacts dans l’arbre des dépendances.
- La ligne de Haiku sous chaque version majeure est demandée une fois par saut et gardée pour de bon, si bien que son coût ne se répète pas.
- La constante de six heures tient en une ligne. Un mod avec moins de bibliothèques pourrait la baisser ; un mod utilisé sur de nombreux grands projets pourrait l’augmenter.
