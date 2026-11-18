---
title: L’attente de 24 heures
description: 'Pourquoi Narsil Check ne monte jamais une version publiée il y a moins d’un jour, où chaque registre dit quand une version est sortie, et ce qui se passe quand personne ne le sait.'
route: check
order: 9
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/npm.ts
  - repo: check
    path: hooks/adapter.ts
  - repo: check
    path: hooks/pypi.ts
  - repo: check
    path: hooks/cargo.ts
  - repo: check
    path: hooks/golang.ts
  - repo: check
    path: hooks/pub.ts
  - repo: check
    path: hooks/nuget.ts
  - repo: check
    path: hooks/rubygems.ts
  - repo: check
    path: hooks/maven.ts
  - repo: check
    path: hooks/swiftpm.ts
  - repo: check
    path: hooks/actions.ts
  - repo: check
    path: hooks/wrapper.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/release-age.test.tsx
  - repo: check
    path: tests/released.ts
  - repo: check
    path: odd/tasks/release-age-all-ecosystems.md
---

## Ce que ça fait

Une version publiée il y a une heure n’a laissé à personne le temps de l’essayer. Si elle est cassée, ou si elle a été poussée depuis le compte compromis d’une personne qui maintient le paquet, les personnes qui s’en aperçoivent les premières sont celles qui l’ont installée les premières. Les registres et les personnes qui maintiennent les paquets retirent bien les mauvaises versions, mais seulement après que quelqu’un l’a remarqué, et cela prend du temps.

Narsil Check donne ce temps à chaque version. Dans chaque écosystème qu’il lit, une version publiée il y a moins de 24 heures ne monte pas : elle arrive dans le groupe **Bloqueada** (Bloquée), avec la raison sous la ligne, en rouge :

```text
Publicada hace 3 h: Narsil Check espera 24 h antes de subirla
```

Cela signifie « publiée il y a 3 h : Narsil Check attend 24 h avant de la monter ». Le README donne la même raison avec ses propres mots : une version « que todavía nadie ha probado o que puede venir de una cuenta comprometida » (« que personne n’a encore essayée, ou qui peut venir d’un compte compromis ») n’entre pas seule dans le projet.

Rien d’autre ne change pour vous. La ligne montre toujours le saut, le bouton **Actualizar las N** (« mettre à jour les N ») la laisse de côté, et la première analyse après que la journée est passée la remet dans son groupe normal.

## Comment ça marche à l’intérieur

L’attente a quatre parties : où chaque registre garde la date, ce qui compte comme preuve quand il n’y a pas de date, comment la règle propre à un projet pnpm est lue, et comment l’installation elle-même est retenue au même délai d’un jour.

### D’où vient la date

Chaque adaptateur nomme l’adresse où son registre répond à « quand cette version a-t-elle été publiée », et comment lire la date dans la réponse. Ce sont deux champs facultatifs du contrat de `hooks/adapter.ts` :

- `releasedUrls(name, version)` : les adresses à essayer, dans l’ordre.
- `releasedOf(text, headers)` : la date que donne une réponse, d’après son corps ou ses en-têtes en minuscules.

Ce que lit chaque adaptateur, d’après le code :

| Écosystème     | Où se trouve la date                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| npm et Expo    | la table `time` du packument ; quand elle n’arrive pas, `pnpm view <name> time --json` ou celui de npm |
| PyPI           | `/pypi/<name>/<version>/json` : le `upload_time_iso_8601` le plus ancien des fichiers de la version    |
| Go             | le `/@v/<version>.info` du proxy : `Time`                                                              |
| Cargo          | crates.io `/api/v1/crates/<name>/<version>` : `version.created_at`                                     |
| Pub            | pub.dev `/api/packages/<name>/versions/<version>` : `published`                                        |
| NuGet          | l’enregistrement SemVer 1, puis celui en SemVer 2 : `published`                                        |
| RubyGems       | `/api/v2/rubygems/<name>/versions/<version>.json` : `created_at`                                       |
| Maven, Gradle  | le POM de la version, sur son propre dépôt et sur le Gradle Plugin Portal : `Last-Modified`            |
| SwiftPM        | la release GitHub du tag (`<tag>` ou `v<tag>`) : `published_at`                                        |
| GitHub Actions | comme SwiftPM, via le dépôt de l’action                                                                |
| Gradle wrapper | `services.gradle.org/versions/current` : `buildTime`                                                   |

Deux choix de ce tableau méritent d’être compris.

**PyPI lit le fichier le plus ancien.** Une version peut recevoir d’autres fichiers plus tard (un wheel pour une nouvelle plateforme). Le commentaire dit pourquoi c’est le premier qui compte : « The earliest file of the release: when it became installable. » (le fichier le plus ancien de la version : le moment où elle est devenue installable).

**SwiftPM lit la release, pas le commit.** La première version lisait la date du commit du tag. Le vérificateur indépendant consigné dans le journal de tâches a fait remarquer qu’une date de committer « can be forged » (peut être falsifiée), et la correction est passée au `published_at` de la release GitHub, que GitHub fixe lui-même. Le README le dit : « Es una fecha que pone GitHub, no la del commit, que el autor podría falsificar » (« c’est une date que fixe GitHub, pas celle du commit, que l’auteur ou l’autrice pourrait falsifier »).

npm est l’exception au contrat : sa recherche de date se trouve dans `hooks/register.tsx` (`npmTimes`), parce que l’hôte ne renvoie pas un packument très volumineux. Le commentaire cite ceux d’astro et de tailwindcss, « ~10 MB ». Quand le packument n’arrive pas ou ne contient pas la version, le mod interroge le gestionnaire de paquets à la place.

### Demander une fois, garder pour de bon

`releasedAt` dans `hooks/register.tsx` interroge ces adresses avec `$.http.fetch` et garde la réponse dans `$.store` sous `published:<ecosystem>:<name>@<version>` (la clé de npm n’a pas de partie écosystème). Une date de publication ne change jamais, donc elle n’a pas de minuteur, contrairement au cache de six heures des dernières versions.

Seule une date valide est gardée. `dateOf` accepte une chaîne que `Date.parse` sait lire et rien d’autre, si bien qu’une page d’erreur ou un champ vide n’est jamais stocké comme une date, et l’analyse suivante demande de nouveau.

### Quand personne ne le sait

Certaines versions n’ont pas de date lisible : un tag Swift sans release GitHub, un paquet hors de GitHub, un registre qui ne répond pas. La règle qu’a fixée l’auteur ou l’autrice (citée plus bas) est que rien ne monte sans preuve qu’il a attendu. Une première version de cette règle bloquait ces versions pour toujours, ce qui a soulevé la question évidente.

La réponse est `firstSeen`. La première fois que le mod rencontre une version sans date, il écrit l’heure actuelle sous `seen:<ecosystem>:<name>@<version>`. Une version ne peut pas être plus récente que le moment où elle a été vue pour la première fois, donc 24 heures après, elle est publiée depuis au moins un jour. En attendant, la ligne dit :

```text
No pude leer cuándo se publicó y la vi por primera vez hace 3 h: Narsil Check espera 24 h antes de subirla
```

Cela signifie « je n’ai pas pu lire quand elle a été publiée et je l’ai vue pour la première fois il y a 3 h : Narsil Check attend 24 h avant de la monter ». Une heure stockée postérieure à maintenant est ignorée et remplacée, si bien qu’une horloge qui a reculé ne retient pas une version plus longtemps.

### La règle elle-même : `ageConflict`

`ageConflict` dans `hooks/npm.ts` transforme une date, l’heure actuelle et une attente en minutes en une raison ou en rien. C’est une fonction pure, donc les tests peuvent l’appeler avec n’importe quelle horloge. `RELEASE_AGE` vaut 1440 minutes, « a day, as pnpm 11's minimumReleaseAge by default » (un jour, comme le minimumReleaseAge de pnpm 11 par défaut), selon les mots du code.

`youngConflicts` l’exécute pour chaque mise à jour, huit à la fois, avant que les groupes soient décidés. Ses raisons rejoignent les autres raisons de blocage des guides précédents, et n’importe quelle raison envoie la mise à jour dans **Bloqueada**, quel que soit son saut.

### Les versions d’Expo attendent aussi

Une mise à jour Expo n’est pas une version mais une plage que résout `npx expo install --fix`. `expoAgeConflict` prend la version stable la plus récente dans les dates npm qui satisfait la plage du SDK, et vérifie celle-là. Tant qu’elle est trop récente, la raison la nomme, par exemple « El SDK de Expo pide 17.0.8 (npx expo install --fix). Publicada hace 1 h: … » (« le SDK Expo demande 17.0.8 »).

### Le `minimumReleaseAge` de pnpm

pnpm a son propre réglage pour cela, `minimumReleaseAge`, en minutes. Le commentaire du code dit ce qu’il suppose à son sujet : « pnpm 11 and later wait one day unless pnpm-workspace.yaml or .npmrc says otherwise; pnpm 10 waited for nothing. » (pnpm 11 et les versions suivantes attendent un jour sauf si pnpm-workspace.yaml ou .npmrc dit autre chose ; pnpm 10 n’attendait rien).

`releaseAgeOf` dans `hooks/npm.ts` le lit dans cet ordre : `minimumReleaseAge:` dans `pnpm-workspace.yaml`, puis `minimum-release-age` dans `.npmrc`, puis la version majeure de pnpm fixée dans `packageManager` (en dessous de 11, cela donne 0), sinon 1440. `releaseMinutes` dans `hooks/register.tsx` ne le fait que quand `pnpm-lock.yaml` existe, et lit les fichiers tels que `HEAD` les contient, avec `git show HEAD:<path>`. Le README explique pourquoi : la CI installe à partir du commit, et une version que le panneau aurait montée trop tôt ferait échouer le `pnpm install --frozen-lockfile` de la CI.

Deux règles découlent des mots de l’auteur ou de l’autrice :

- **L’attente la plus longue l’emporte.** Un projet pnpm avec 2880 minutes attend deux jours, avec la raison « pnpm espera 48 h para instalarla (minimumReleaseAge) » (« pnpm attend 48 h pour l’installer »). Une valeur plus courte ne réduit jamais le délai d’un jour.
- **Aucune exception.** `minimumReleaseAgeExclude` n’est jamais lu. Le commentaire est bref : « the wait has no exceptions here. » (l’attente n’a pas d’exceptions ici).

### Retenir aussi l’installation

Bloquer la ligne ne couvre que la bibliothèque que vous montez. Ses propres dépendances peuvent faire entrer quelque chose publié il y a cinq minutes. Là où le gestionnaire de paquets peut refuser cela, le bouton le lui demande, via `releaseAgeEnv` :

- **pnpm** s’exécute avec `PNPM_CONFIG_MINIMUM_RELEASE_AGE` réglé sur l’attente, `PNPM_CONFIG_MINIMUM_RELEASE_AGE_STRICT=true` et une liste d’exclusion vide, si bien qu’une dépendance trop récente fait échouer l’installation au lieu d’être écrite comme exception.
- **npm** s’exécute avec `npm_config_before` réglé un jour en arrière, si bien que chaque plage se résout en versions publiées avant ce moment.

Quand l’un ou l’autre refuse, `ageRefusal` reconnaît le message de l’outil et le panneau le dit (« Bloqueada por minimumReleaseAge… », « Bloqueada por la espera de 24 h… », c’est-à-dire « bloquée par minimumReleaseAge… », « bloquée par l’attente de 24 h… »), sans rien mettre à jour. Le README est honnête sur le reste : yarn, bun et tous les autres écosystèmes n’ont pas un tel interrupteur, donc là l’attente s’applique à la bibliothèque qui monte, pas à ce qu’elle apporte.

## Le construire avec Claude

Demandez à Claude de bloquer toute mise à jour dont la nouvelle version a été publiée il y a moins de 24 heures. L’idée que Claude doit bien saisir : ce qui compte comme preuve de l’âge ; une date valide venue du registre, ou le moment où le mod a vu la version pour la première fois, et jamais rien.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon mod Claude Code `my-panel`, bloque toute mise à jour dont la nouvelle version a été publiée il y a moins de 24 heures. Écris une fonction pure `ageReason(published, now, minutes, seen)` qui renvoie une raison en mots ou `undefined` : avec une date valide, bloque tant que la version a moins de `minutes` ; sans date, utilise `seen` (le moment où le mod a vu la version pour la première fois) comme preuve, et bloque quand il n’y a ni l’un ni l’autre. Pour PyPI, lis la date depuis `https://pypi.org/pypi/<name>/<version>/json` comme le `upload_time_iso_8601` le plus ancien dans `urls`, avec `$.http.fetch`. Garde une date valide dans `$.store` sous `published:pypi:<name>@<version>` pour de bon et ne stocke jamais rien qui ne soit pas une date. Garde l’heure de première observation sous `seen:pypi:<name>@<version>`. Mets une mise à jour bloquée dans un groupe `blocked` avec la raison sous sa ligne, et garde-la hors du bouton « Update all ». Teste la fonction avec un `now` fixe : une heure, deux jours, pas de date et pas de `seen`, pas de date et `seen` il y a un jour.

### Ce qu’il faut vérifier dans la réponse de Claude

1. Avec une date valide, la mise à jour est bloquée tant que la version est plus jeune que l’attente, et la raison sous la ligne le dit en toutes lettres.
2. Sans date, le moment de la première observation sert de preuve. Sans aucun des deux, la mise à jour est bloquée : « pas de date » ne veut jamais dire « assez ancienne ».
3. Seule une valeur qui se lit comme une date est stockée sous `published:…`, si bien qu’une page d’erreur n’est jamais gardée. Le moment de la première observation est gardé sous `seen:…`.
4. Pour PyPI, la date est le plus ancien `upload_time_iso_8601` des fichiers de la version, c’est-à-dire le moment où elle est devenue installable.
5. Une mise à jour bloquée se trouve dans le groupe bloqué, le bouton « Update all » la laisse de côté, et les tests utilisent un `now` fixe pour les quatre cas que nomme le prompt.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « une version sans date lisible est bloquée depuis trois jours ».

### Comment l’auteur l’a demandé

Cette fonctionnalité est consignée avec les mots de l’auteur ou de l’autrice, dans le journal de tâches public de narsil-check `odd/tasks/release-age-all-ecosystems.md`. Le guide précédent cite les mêmes entrées pour les groupes ; ici, on les lit pour ce qu’elles disent de l’attente.

#### Consigné : de pnpm à tous les écosystèmes

Avant cette tâche, il existait déjà un blocage pour le `minimumReleaseAge` de pnpm, et l’auteur ou l’autrice en avait fixé la règle en le corrigeant. Le journal de tâches la garde comme S4, avec ses mots :

> "siempre que haya minimumReleaseAge se bloquee la actualizacion automatica y se marque el bloqueo, sin excepcion alguna"

Traduction en français : « chaque fois qu’il y a un minimumReleaseAge, bloquer la mise à jour automatique et signaler le blocage, sans aucune exception. » Cette phrase est la source de deux comportements du code : une liste d’exclusion ne compte jamais, et une date illisible bloque aussi.

L’entrée de journal L1 (2026-11-06) consigne la demande qui l’a étendue. L’auteur ou l’autrice a demandé si le problème d’Expo se produisait aussi avec KMP ou d’autres langages, puis a choisi :

> "El primero me interesa, deberíamos implementar algo similar para los otros lenguajes, es más seguro"

Traduction en français : « Le premier m’intéresse ; nous devrions implémenter quelque chose de similaire pour les autres langages, c’est plus sûr. » À la question de la durée d’attente, la réponse a été « 24 horas está perfecto » (« 24 heures, c’est parfait »).

#### Ce que l’agent en a fait

Le reste du journal, ce sont les notes de l’agent lui-même, pas les mots de l’auteur ou de l’autrice. L’entrée L2 consigne comment la date de chaque registre a été trouvée : une sonde par registre, avec un vrai paquet, avant tout code. L’entrée L3 consigne la vérification de l’installation npm : avec `npm_config_before` réglé un jour en arrière, npm a refusé une version de tailwindcss vieille d’une heure et a résolu la plage vers la précédente. L’entrée L6 consigne les constats du vérificateur indépendant, parmi lesquels le fait qu’une date de committer SwiftPM « can be forged » (peut être falsifiée).

#### Consigné : la correction sur les dates manquantes

Le même jour, l’auteur ou l’autrice a remarqué le coût de « une date illisible bloque ». L7 cite la question :

> "que pasa si una version siempre trae fecha ilegible? nunca la vamos a actualizar?"

Traduction en français : « que se passe-t-il si une version arrive toujours avec une date illisible ? nous ne la mettrons jamais à jour ? » Le journal consigne la proposition de l’agent (attendre 24 heures à partir du moment où le mod a vu la version pour la première fois, ne garder que les dates valides, lire la date de la release SwiftPM au lieu de celle du commit) et la réponse de l’auteur ou de l’autrice, « si hazlo asi » (« oui, fais-le comme ça »). La conception est celle de l’agent ; la question et l’approbation sont celles de l’auteur ou de l’autrice.

#### Reconstitution à partir de l’historique des commits

À partir de `git log -S releasedUrls` et de `git log -S ageConflict` dans narsil-check :

- `690c1bb` (2026-11-06) « feat: block upgrades pnpm would refuse under minimumReleaseAge » (bloquer les mises à jour que pnpm refuserait sous minimumReleaseAge). Son message dit que les entrées de `minimumReleaseAgeExclude` « are honored » (sont respectées).
- `54ac6aa` (2026-11-06) « fix: block every upgrade under pnpm's minimumReleaseAge, with no exceptions » (bloquer toute mise à jour sous le minimumReleaseAge de pnpm, sans exception). La liste d’exclusion est désormais ignorée, une date illisible bloque, et les dates se rabattent sur `pnpm view` parce que les gros packuments « never reached the hooks module » (n’atteignaient jamais le module des hooks).
- `1492ca5` (2026-11-06) « feat: hold every ecosystem's upgrades for 24 hours after release » (retenir les mises à jour de chaque écosystème pendant 24 heures après leur publication). Chaque adaptateur reçoit `releasedUrls` ; SwiftPM lit encore le commit du tag.
- `ca13b3c` (2026-11-06) « feat: hold Expo SDK-pinned versions for 24 hours too » (retenir aussi pendant 24 heures les versions fixées par le SDK Expo).
- `8c5f2a3` (2026-11-06) « feat: install npm and pnpm upgrades under the 24-hour wait through the whole tree » (installer les mises à jour npm et pnpm sous l’attente de 24 heures dans tout l’arbre).
- `54cd243` (2026-11-06) « feat: let a version with no readable date go up a day after it was first seen » (laisser une version sans date lisible monter un jour après sa première observation). La correction de L7, avec SwiftPM passé à la date de la release.
- `40e5723` (2026-11-06) « fix: date Go +incompatible versions at the base path and keep Compose rules to its own line » (dater les versions Go +incompatible au chemin de base et limiter les règles de Compose à sa propre ligne). Un constat du vérificateur.
- `7048580` (2026-11-09) « feat: check the Gradle wrapper and GitHub Actions for upgrades » (vérifier les mises à jour du wrapper Gradle et des GitHub Actions). Les deux nouveaux adaptateurs arrivent avec leurs dates.

Le schéma : la règle stricte est venue en premier et était juste, et la seule correction l’a rendue stricte sans qu’elle reste bloquée.

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide. Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

Voici une version réduite de l’idée, écrite pour ce guide et vérifiée par rapport aux types de Claude Code 2.1.325 (`$.http.fetch`, `$.store.get`, `$.store.set`). Elle est adaptée de `hooks/npm.ts` et `hooks/register.tsx` dans [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Elle ne gère que PyPI ; un autre registre, c’est une URL et un lecteur de plus.

```ts
import type { EngineInterface } from 'claude-code'

export const WAIT_MINUTES = 24 * 60

const dateOf = (text: unknown) =>
  typeof text === 'string' && !Number.isNaN(Date.parse(text)) ? text : undefined

// Why a version must wait, or undefined when it is old enough.
export function ageReason(
  published: string | undefined,
  now: number,
  minutes: number,
  seen?: number,
): string | undefined {
  const from = published ? Date.parse(published) : seen
  if (from === undefined || Number.isNaN(from))
    return `No publication date: waiting ${minutes / 60} h`
  const age = Math.floor((now - from) / 60_000)
  if (age >= minutes) return undefined
  const ago = age >= 60 ? `${Math.floor(age / 60)} h` : `${age} min`
  return published ? `Published ${ago} ago` : `No date; first seen ${ago} ago`
}

async function releasedAt($: EngineInterface, name: string, version: string) {
  const key = `published:pypi:${name}@${version}`
  const cached = dateOf(await $.store.get(key))
  if (cached) return cached
  const res = await $.http
    .fetch(`https://pypi.org/pypi/${encodeURIComponent(name)}/${encodeURIComponent(version)}/json`)
    .catch(() => undefined)
  let published: string | undefined
  try {
    const files = res?.ok
      ? ((JSON.parse(res.text) as { urls?: { upload_time_iso_8601?: unknown }[] }).urls ?? [])
      : []
    published = dateOf(
      files
        .map((f) => f.upload_time_iso_8601)
        .filter((t): t is string => typeof t === 'string')
        .sort()[0],
    )
  } catch {
    published = undefined
  }
  if (published) await $.store.set(key, published)
  return published
}

async function firstSeen($: EngineInterface, name: string, version: string, now: number) {
  const key = `seen:pypi:${name}@${version}`
  const seen = await $.store.get(key)
  if (typeof seen === 'number' && seen <= now) return seen
  await $.store.set(key, now)
  return now
}

export async function waitReason($: EngineInterface, name: string, version: string) {
  const now = Date.now()
  const published = await releasedAt($, name, version)
  const seen = published ? undefined : await firstSeen($, name, version, now)
  return ageReason(published, now, WAIT_MINUTES, seen)
}
```

Appelez `waitReason` pour chaque mise à jour pendant l’analyse, et traitez une raison renvoyée comme n’importe quelle autre raison de blocage. Notez qu’avec le repli sur la première observation, le cas « ni l’un ni l’autre » de `ageReason` ne se produit que si le stockage ne peut pas être écrit.

## Erreurs fréquentes et comment tester

Elles viennent du code de Narsil Check, de son journal de tâches et de ses commits :

- **Laisser passer une date inconnue.** « Pas de date » ne doit jamais signifier « assez ancienne ». La première version pnpm de Narsil Check laissait passer les gros paquets parce que leurs dates n’arrivaient jamais.
- **Bloquer une date inconnue pour toujours.** L’erreur inverse, que L7 a repérée. Une heure de première observation transforme « inconnue » en « au moins aussi ancienne ».
- **Mettre en cache quelque chose qui n’est pas une date.** Une page d’erreur stockée comme date serait relue à chaque analyse. Ne gardez que ce qui s’analyse comme une date.
- **Faire confiance à une date qu’écrit la personne qui publie.** Une date de commit peut être fixée par quiconque a fait le commit. Préférez une date que fixe le registre ou l’hébergeur.
- **Lire l’heure du dernier fichier.** Sur PyPI, la version est devenue installable avec son premier fichier.
- **Laisser un réglage de projet plus court réduire l’attente.** Prenez la plus longue entre votre propre règle et celle du projet.
- **Lire la copie de travail quand la CI lit le commit.** Le réglage de pnpm est lu à `HEAD` pour cette raison.

Pour tester, `claude plugin test .` exécute `tests/release-age.test.tsx` : « each registry says where and when a version was published » (chaque registre dit où et quand une version a été publiée) appelle `releasedUrls` et `releasedOf` de chaque adaptateur avec la forme d’une vraie réponse ; « a version whose date cannot be read waits a day from when the mod first saw it » (une version dont la date ne peut pas être lue attend un jour à partir du moment où le mod l’a vue pour la première fois) et « the mod's own wait says so, in every ecosystem » (l’attente propre au mod le dit, dans chaque écosystème) appellent `ageConflict` avec une horloge fixe. `tests/released.ts` répond par défaut à l’URL de date de chaque registre avec une date vieille d’un an, pour que les autres tests ne soient pas bloqués par accident, et avec une date récente pour les URL qu’un test nomme. Le comportement de pnpm et de npm se trouve dans `tests/upgrade.test.tsx`, par exemple « npm installs with before set a day back, so a range resolves only to versions a day old, its dependencies included » (npm installe avec before réglé un jour en arrière, si bien qu’une plage ne se résout qu’en versions vieilles d’un jour, dépendances comprises).

## Pour aller plus loin

- Le tableau du README ne mentionne ni le wrapper Gradle (le `buildTime` de `services.gradle.org`) ni les GitHub Actions (la release, comme SwiftPM) : les deux sont arrivés plus tard, dans `7048580`, et seul le code montre d’où viennent leurs dates.
- Le journal de tâches liste les avertissements que le vérificateur a laissés ouverts, comme la limite de GitHub sans authentification de 60 requêtes par heure pour les dates SwiftPM. Une version dont la date ne peut pas être lue pour cette raison se rabat sur la première observation.
- Vingt-quatre heures, c’est une constante, `RELEASE_AGE`. Un mod pour une équipe à la politique plus stricte pourrait l’augmenter, et la règle pnpm montre comment respecter un réglage de projet plus long sans laisser passer un plus court.
