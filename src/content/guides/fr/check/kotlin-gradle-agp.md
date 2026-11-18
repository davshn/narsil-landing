---
title: Kotlin, Gradle et AGP (avancé)
description: 'Pourquoi un build Kotlin ou Android ne peut pas monter un outil seul, et comment Narsil Check bloque Kotlin après ses plugins du compilateur et vérifie les minimums de Gradle, AGP, Kotlin et Compose.'
route: check
order: 18
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/kmp.ts
  - repo: check
    path: hooks/maven.ts
  - repo: check
    path: hooks/wrapper.ts
  - repo: check
    path: hooks/actions.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/kmp.test.tsx
  - repo: check
    path: tests/wrapper.test.tsx
  - repo: check
    path: tests/actions.test.tsx
  - repo: check
    path: odd/tasks/release-age-all-ecosystems.md
---

## Ce que ça fait

Dans la plupart des écosystèmes, une bibliothèque est une bibliothèque : vous la montez, et si sa propre API n’a pas changé, le projet continue de se construire. Un build Android ou Kotlin Multiplatform (KMP) est différent. Ses outils sont en couches, et chaque couche est construite pour une plage de la couche inférieure.

En termes simples, les couches sont celles-ci :

- **Gradle** est l’outil de build. Le projet fixe sa version dans le wrapper Gradle, le petit fichier `gradle/wrapper/gradle-wrapper.properties` qui dit quel Gradle télécharger.
- **L’Android Gradle Plugin (AGP)** apprend à Gradle à construire des applications Android. Chaque AGP a besoin d’au moins un certain Gradle.
- **Kotlin** est le langage, et son plugin Gradle a besoin d’au moins un certain AGP et d’un certain Gradle.
- **Les plugins de compilateur** (KSP, SKIE et d’autres) s’exécutent à l’intérieur du compilateur Kotlin. Chaque version est construite pour des versions précises de Kotlin, ils doivent donc bouger avec Kotlin.
- **Compose Multiplatform** est le framework d’interface, et chaque version a besoin d’au moins un certain Kotlin, et à partir de 1.7 d’au moins un certain AGP.

Ainsi, un patch de Kotlin, qui a l’air trivial, peut arrêter le build parce qu’un plugin de compilateur ne le prend pas encore en charge. Une mineure d’AGP peut échouer parce que le Gradle du wrapper est trop ancien. Rien de cela n’apparaît dans les numéros de version. C’est le même genre de problème que les modules Expo liés à un SDK, que décrivait le guide 7.

Narsil Check connaît ces liens. Une mise à jour qui en casserait un va dans **Bloqueada** (« bloquée »), quel que soit son saut, avec la raison en toutes lettres. Deux exemples du README :

```text
SKIE 0.10.16 es un plugin del compilador de Kotlin: confirma que soporta Kotlin 2.4.21
AGP 8.13.0 necesita Gradle 8.13 o más; el wrapper usa 8.11.1
```

Ils signifient « SKIE 0.10.16 est un plugin du compilateur Kotlin : confirmez qu’il prend en charge Kotlin 2.4.21 » et « AGP 8.13.0 a besoin de Gradle 8.13 ou plus ; le wrapper utilise 8.11.1 ».

Le wrapper Gradle lui-même est aussi listé comme quelque chose à monter, de même que les GitHub Actions que fixent vos workflows, puisqu’une CI fait aussi partie du build.

## Comment ça marche à l’intérieur

Tout cela se trouve dans l’adaptateur Maven, qui lit les projets Gradle et Maven (guide 6). Son `conflictsOf` réunit trois vérifications : `kotlinConflicts` (les plugins de compilateur, dans `hooks/maven.ts`), `kmpConflicts` (les minimums croisés, dans `hooks/kmp.ts`) et `lockConflicts` (les verrous de dépendances de Gradle). Chacune renvoie des phrases ; n’importe quelle phrase bloque la mise à jour. Les trois sont des fonctions pures sur les dépendances analysées et les fichiers du projet, si bien que les tests leur donnent une liste et un wrapper et lisent les phrases.

### Les plugins de compilateur qui doivent bouger avec Kotlin

`COMPILER_PLUGINS` dans `hooks/maven.ts` en liste sept : SKIE, KSP, Mokkery, Realm, Metro, kotlinx-rpc et Anvil. Chacun est trouvé par ses coordonnées (`co.touchlab.skie`, `com.google.devtools.ksp`, …) ou par sa clé dans le catalogue de versions. La clé du catalogue compte : l’exemple du commentaire est un module `build-logic` qui lit directement `libs.versions.mokkery`, si bien qu’aucune coordonnée des fichiers de build ne nomme Mokkery, alors que le projet l’utilise.

Quand Kotlin monte et que le projet déclare l’un d’eux, la mise à jour est bloquée :

- **KSP est vérifié exactement.** Une version de KSP1 porte le Kotlin pour lequel elle a été construite, comme dans `2.4.20-1.0.30`. Si ce préfixe n’est pas le nouveau Kotlin, la raison est « hace falta un KSP para 2.4.21 » (« il faut un KSP pour 2.4.21 »). Une version de KSP2 sans Kotlin dedans, comme `2.3.0`, fonctionne avec n’importe lequel et ne bloque pas.
- **Pour les autres, on demande une confirmation.** Leurs versions ne disent rien de Kotlin, le mod ne peut donc pas les vérifier. Il bloque et vous demande de confirmer la prise en charge.

Ce qui compte comme Kotlin, c’est `org.jetbrains.kotlin` et ses plugins, jamais `kotlinx` (coroutines et serialization montent de leur côté).

Un plugin manque exprès dans la liste : le compilateur Compose. Il est publié sous `org.jetbrains.kotlin.plugin.compose`, il fait donc partie de Kotlin lui-même, avec la version de Kotlin. Le journal de tâches explique ce choix : « Compose compiler lockstep with Kotlin left out: separate rows would block each other; catalogs share the kotlin version ref. » (la synchronisation du compilateur Compose avec Kotlin est laissée de côté : des lignes séparées se bloqueraient l’une l’autre ; les catalogues partagent la référence de version kotlin). Dans un catalogue, les deux lisent la même version `kotlin`, ils forment donc une seule ligne et montent ensemble.

### Les minimums croisés, d’après la documentation des outils eux-mêmes

`hooks/kmp.ts` contient quatre tableaux, chacun avec l’adresse d’où il a été copié et la date à laquelle il était à jour. Le commentaire le dit clairement : « the tables come from the tools' own documentation, quoted below » (les tableaux viennent de la documentation des outils eux-mêmes, citée ci-dessous). Le journal de tâches consigne pourquoi ils sont écrits en dur : les métadonnées de module Gradle publiées « states none of these » (n’énoncent rien de tout cela).

**AGP et son Gradle minimum**, d’après la page des versions d’AGP de Google, « as of AGP 9.5.0 » (à la date d’AGP 9.5.0) :

| AGP  | Gradle minimum |
| ---- | -------------- |
| 9.5  | 9.6.0          |
| 9.4  | 9.6.0          |
| 9.3  | 9.5.0          |
| 9.2  | 9.4.1          |
| 9.1  | 9.3.1          |
| 9.0  | 9.1.0          |
| 8.13 | 8.13           |
| 8.12 | 8.13           |
| 8.11 | 8.13           |
| 8.10 | 8.11.1         |
| 8.9  | 8.11.1         |
| 8.8  | 8.10.2         |
| 8.7  | 8.9            |
| 8.6  | 8.7            |
| 8.5  | 8.7            |
| 8.4  | 8.6            |
| 8.3  | 8.4            |
| 8.2  | 8.2            |
| 8.1  | 8.0            |
| 8.0  | 8.0            |

Dans le code, le tableau continue de 7.0 à 7.4.

**Kotlin et l’AGP et le Gradle minimums de son plugin Gradle**, d’après la page Gradle de kotlinlang.org, « as of 2.4.21 » (à la date de 2.4.21). Chaque ligne s’applique à partir de cette version de Kotlin :

| Kotlin à partir de | AGP minimum | Gradle minimum |
| ------------------ | ----------- | -------------- |
| 2.4.0              | 8.5.2       | 7.6.3          |
| 2.3.0              | 8.2.2       | 7.6.3          |
| 2.1.0              | 7.3.1       | 7.6.3          |
| 2.0.0              | 7.1.3       | 6.8.3          |

**Compose Multiplatform et ses Kotlin et AGP minimums**, d’après les notes de migration du CHANGELOG de JetBrains et la page de compatibilité. Le Kotlin est celui de la plateforme la plus stricte, iOS et le web. 1.12 n’énonce pas de nouveau minimum, il garde donc ceux de 1.11 :

| Compose Multiplatform | Kotlin minimum | AGP minimum |
| --------------------- | -------------- | ----------- |
| 1.6                   | 2.0.0          |             |
| 1.7                   | 2.0.0          | 8.1.0       |
| 1.8                   | 2.1.0          | 8.1.0       |
| 1.9                   | 2.1.0          | 8.1.0       |
| 1.10                  | 2.2.0          | 8.1.0       |
| 1.11                  | 2.3.0          | 8.1.0       |
| 1.12                  | 2.3.0          | 8.1.0       |

**KSP à partir de 2.3.12 a besoin d’AGP 8.12.0**, d’après les versions publiées de KSP.

### Comment les vérifications lisent le projet

`kmpConflicts` a besoin de trois faits :

- **Le Gradle qu’exécute le wrapper**, lu par `gradleVersionOf` dans la ligne `distributionUrl`, `…/gradle-9.6.0-bin.zip`. Il regarde le wrapper à la racine et `android/gradle/wrapper/…`, là où un projet React Native le garde.
- **L’AGP et le Kotlin utilisés** : la plus haute version qu’écrit une déclaration de cet outil.
- **Ce qui monte**, et vers quelle version.

Ensuite, pour la mise à jour en question :

- **AGP** : on cherche la mineure de la nouvelle version. Si le Gradle du wrapper est en dessous de son minimum, c’est bloqué. S’il n’y a pas de wrapper à lire, c’est aussi bloqué : « no encontré gradle/wrapper/gradle-wrapper.properties para confirmarlo » (« je n’ai pas trouvé … pour le confirmer »).
- **Le passage à AGP 9 depuis 8.x** : AGP 9 intègre la compilation de Kotlin, et le code ajoute deux règles tirées du guide de migration de Google. Un module qui combine `org.jetbrains.kotlin.multiplatform` avec `com.android.library` ou `com.android.application` doit passer à `com.android.kotlin.multiplatform.library`, et kapt ne fonctionne pas (passez à KSP, ou utilisez `com.android.legacy-kapt`). Elles ne se déclenchent qu’au passage. Un projet déjà sur 9 les a déjà traitées ; le journal de tâches consigne qu’un test les a surprises à se déclencher de nouveau sur un tel projet.
- **Kotlin** : la première ligne dont le « à partir de » est atteint par le nouveau Kotlin donne l’AGP et le Gradle minimums.
- **Compose Multiplatform** : seule sa propre ligne compte, le plugin Gradle et les groupes `runtime`, `foundation`, `ui`, `animation`, `material`, `components` et `desktop`. `org.jetbrains.compose.hot-reload` et `material3.adaptive` ont leurs propres versions et ne sont pas Compose Multiplatform ici.
- **KSP** : à partir de 2.3.12, l’AGP doit être 8.12.0 ou plus.

### Seulement des minimums, et « au-delà du tableau » signifie « confirmer »

Deux décisions façonnent ce que refuse le mod.

**Les maximums ne sont pas vérifiés.** JetBrains publie l’AGP et le Gradle les plus élevés avec lesquels chaque Kotlin est testé, mais aller au-delà n’est pas un échec. Le commentaire du code : « The maximums are what is fully supported, not a failure, so they are not checked. » (les maximums sont ce qui est entièrement pris en charge, pas un échec, ils ne sont donc pas vérifiés). Le README ajoute que Google lui-même combine des versions qui les dépassent. Bloquer sur les maximums retiendrait des builds qui fonctionnent.

**Une version plus récente que le tableau bloque.** AGP 9.6, ou Compose Multiplatform 1.13, n’est pas dans les tableaux. Plutôt que de deviner, le mod bloque avec « es más nuevo que la tabla de Google que conozco (hasta 9.5): confirma qué Gradle necesita » (« est plus récent que le tableau de Google que je connais (jusqu’à 9.5) : confirmez de quel Gradle il a besoin »). Un tableau copié d’une documentation vieillit ; la lecture prudente d’une ligne inconnue est « demander ».

### Le wrapper comme dépendance à part entière

`hooks/wrapper.ts` fait du wrapper à la racine un écosystème à part entière, `gradle-wrapper`. Sa dernière version vient du service de versions de Gradle, `https://services.gradle.org/versions/current`, qui donne aussi l’heure de build utilisée pour l’attente de 24 heures (guide 9). La montée de version ne réécrit que la version dans `distributionUrl` ; il n’y a rien à installer, puisque le wrapper télécharge la nouvelle distribution à sa prochaine exécution.

Deux limites viennent du code. Un wrapper avec `distributionSha256Sum` est bloqué, puisque la somme de contrôle appartient à une seule distribution et que le mod ne peut pas connaître la suivante ; la raison donne la commande `./gradlew wrapper --gradle-version … --gradle-distribution-sha256-sum <sum>`. Et le wrapper sous `android/` n’est pas monté : ce sont React Native et Flutter qui le choisissent.

Cela boucle la boucle avec la règle d’AGP. Quand AGP est bloqué parce que le Gradle du wrapper est trop ancien, le wrapper lui-même apparaît comme une mise à jour triviale. D’après le code, le monter d’abord puis analyser de nouveau permet à AGP de passer sa vérification.

### Les GitHub Actions dans le même commit

Le commit qui a ajouté le wrapper a aussi ajouté `hooks/actions.ts`, un adaptateur pour les lignes `uses:` de `.github/workflows/*.yml` et `.github/actions/*/action.yml`. Une CI Android fixe ainsi ses étapes de configuration, qui vieillissent donc comme n’importe quelle dépendance.

Il lit une action fixée sur un tag complet (`@v6.1.0`) ou sur un commit avec sa version dans un commentaire (`@<commit> # v6.1.0`). Un tag mobile comme `@v6` suit déjà sa majeure et est laissé de côté. Les dernières versions viennent des tags git de l’action avec `git ls-remote`, en ne gardant que les versions complètes. Pour une action fixée sur un commit, la montée de version résout d’abord le commit du nouveau tag, en suivant les tags annotés (`^{}`), et s’il ne peut pas en lire un, aucun workflow n’est écrit. Le README ajoute une note pratique : pousser des changements dans `.github/workflows` en HTTPS demande un token avec la permission `workflow`.

### Le README et le code

Le README, dans sa section sur ces outils, dit « El wrapper solo se lee: nunca entra en el commit del PR » (« le wrapper est seulement lu : il n’entre jamais dans le commit de la PR »). Cela a été écrit avec `1637e94`, quand le wrapper n’était que du contexte pour l’adaptateur Maven, et c’est encore vrai pour cet adaptateur (un test le vérifie). Depuis `7048580`, le wrapper est aussi un écosystème à part entière dont le manifest est `gradle-wrapper.properties`. D’après `checkPending` (guide 13), un wrapper monté diffère de `HEAD` et serait listé et commité avec le reste. Aucun test ne couvre ce cas, dans un sens ou dans l’autre.

## Le construire avec Claude

Demandez à Claude un module pur qui bloque une mise à jour Gradle que le reste du build ne peut pas suivre, avec la raison sous forme de phrase. L’idée que Claude doit bien saisir : les vérifications sont des minimums tirés de tableaux publiés, et une version que les tableaux ne connaissent pas bloque avec « confirmer » au lieu de passer.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon mod Claude Code `my-panel`, qui liste les mises à jour Gradle depuis `gradle/libs.versions.toml`, bloque celles que le reste du build ne peut pas accepter, avec la raison sous forme de phrase. Lis le Gradle du wrapper dans le `distributionUrl` de `gradle/wrapper/gradle-wrapper.properties`. Garde trois tableaux dans un module pur, chacun avec l’URL de la documentation dont il vient et la version à laquelle il est à jour : mineure d’AGP vers Gradle minimum (les notes de version d’AGP de Google), Kotlin vers AGP et Gradle minimums (la page de configuration Gradle de kotlinlang.org), et mineure de Compose Multiplatform vers Kotlin et AGP minimums (son CHANGELOG). Ne vérifie que les minimums. Une version d’AGP ou de Compose plus récente que son tableau, ou AGP sans wrapper, bloque avec « confirmer ». Quand Kotlin monte et que le projet déclare KSP, bloque si le préfixe `x.y.z-` de KSP n’est pas le nouveau Kotlin ; pour SKIE, bloque et demande une confirmation. Écris un test par règle avec une liste de dépendances et un texte de wrapper, y compris une version au-delà du tableau.

### Ce qu’il faut vérifier dans la réponse de Claude

1. Chaque tableau se trouve à côté de l’URL de la documentation dont il vient et de la version à laquelle il est à jour.
2. Seuls les minimums sont vérifiés : un AGP qui demande un Gradle plus récent que celui du wrapper bloque, mais dépasser un maximum publié ne bloque pas.
3. Une version d’AGP ou de Compose Multiplatform plus récente que son tableau, et AGP sans wrapper à lire, bloquent avec une phrase qui vous demande de confirmer.
4. Quand Kotlin monte, KSP ne bloque que si son préfixe `x.y.z-` n’est pas le nouveau Kotlin, et SKIE bloque et vous demande de confirmer la prise en charge.
5. Il y a un test par règle, alimenté par une liste de dépendances et un texte de wrapper, et l’un d’eux utilise une version au-delà du tableau.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « AGP 8.13.0 apparaît comme une mise à jour normale alors que mon wrapper utilise encore Gradle 8.11.1 ».

### Comment l’auteur l’a demandé

Celle-ci est en partie consignée. La règle des plugins de compilateur est antérieure aux journaux de tâches publics ; les minimums croisés ont les mots de l’auteur ou de l’autrice.

#### Consigné : « antes de subir corrijamos KMP »

`odd/tasks/release-age-all-ecosystems.md` dans narsil-check consigne, dans sa spec S5, ce qu’a dit l’auteur ou l’autrice en apprenant que Compose Multiplatform et AGP n’étaient pas couverts :

> "antes de subir corrijamos KMP. Compose Multiplatform y el Android Gradle Plugin etc, ademas cuando termines lanza el verificador independiente con todo esto"

Traduction en français : avant de pousser, corrigeons KMP. Compose Multiplatform et l’Android Gradle Plugin, etc. ; et aussi, quand tu as fini, lance le vérificateur indépendant avec tout cela.

La spec S6 cite de nouveau la seconde moitié, « lanza el verificador independiente con todo esto » (« lance le vérificateur indépendant avec tout cela »), comme exigence à part entière : une vérification indépendante de toute la fonctionnalité avant de pousser.

#### Consigné dans le journal de tâches : comment cela a été trouvé et construit

Ce sont les notes de l’agent, pas les mots de l’auteur ou de l’autrice. L’entrée de journal L4 consigne le manque qui a mené à la demande : « Compose Multiplatform and the Android Gradle Plugin are coupled to Kotlin and Gradle versions like Expo modules to the SDK, and no rule here knows them » (Compose Multiplatform et l’Android Gradle Plugin sont couplés aux versions de Kotlin et de Gradle comme les modules Expo au SDK, et aucune règle ici ne les connaît). L5 (2026-11-06) consigne la recherche : le tableau d’AGP « matched row by row » (vérifié ligne par ligne) avec la page de Google, les minimums de Kotlin d’après kotlinlang.org, le fait que Compose Multiplatform « has no official per-version table » (n’a pas de tableau officiel par version), si bien que ses minimums viennent de son CHANGELOG, et la décision de laisser de côté le compilateur Compose.

L6 consigne ce qu’a trouvé le vérificateur indépendant : deux points bloquants sur toute la fonctionnalité, dont l’un dans ces règles. `isCompose` attrapait `org.jetbrains.compose.hot-reload` et `material3.adaptive`, « which version on their own » (qui ont leurs propres versions). Les deux ont été corrigés en une seule série de corrections.

#### Reconstitution à partir de l’historique des commits

À partir de `git log -- hooks/kmp.ts hooks/wrapper.ts hooks/actions.ts` et de `git log -S COMPILER_PLUGINS` dans narsil-check :

- `4ea9be0` (2026-11-04) « feat: block upgrades kept on purpose and Kotlin past its compiler plugins » (bloquer les mises à jour retenues exprès et Kotlin au-delà de ses plugins de compilateur). Les sept plugins, trouvés par coordonnée ou par clé de catalogue, avec KSP vérifié exactement. Son message nomme la vérification sur laquelle il a été fait : sur un modèle KMP, « Kotlin 2.4.20 -> 2.4.21 is now blocked by SKIE and Mokkery » (Kotlin 2.4.20 -> 2.4.21 est maintenant bloqué par SKIE et Mokkery).
- `1637e94` (2026-11-06) « feat: block Android and KMP upgrades the rest of the build cannot take » (bloquer les mises à jour Android et KMP que le reste du build ne peut pas accepter). Les quatre tableaux. Son message : « Tables quote Google's and JetBrains' documentation; a version past them waits to be confirmed. The Gradle wrapper is read as context and never committed. » (les tableaux citent la documentation de Google et de JetBrains ; une version qui les dépasse attend d’être confirmée. Le wrapper Gradle est lu comme contexte et jamais commité).
- `40e5723` (2026-11-06) « fix: date Go +incompatible versions at the base path and keep Compose rules to its own line » (dater les versions Go +incompatible au chemin de base et limiter les règles de Compose à sa propre ligne). Les deux points bloquants du vérificateur.
- `7048580` (2026-11-09) « feat: check the Gradle wrapper and GitHub Actions for upgrades » (vérifier les mises à jour du wrapper Gradle et des GitHub Actions). Le wrapper comme écosystème à part entière, bloqué en présence d’une somme de contrôle, et l’adaptateur des actions.

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide. Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

Voici une version réduite de l’idée, écrite pour ce guide. C’est du TypeScript simple sans API de mod ; elle se branche sur le `conflictsOf` d’un adaptateur comme dans le guide 6. Elle est adaptée de `hooks/kmp.ts` et de `kotlinConflicts` dans `hooks/maven.ts` dans [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Les tableaux sont réduits à quelques lignes ; les valeurs sont celles de `hooks/kmp.ts`.

```ts
type Dep = { name: string; version: string }

// AGP minor -> minimum Gradle (a few rows of Google's table).
const AGP_GRADLE: Record<string, string> = {
  '9.0': '9.1.0',
  '8.13': '8.13',
  '8.12': '8.13',
  '8.11': '8.13',
  '8.10': '8.11.1',
}
// Kotlin from -> minimum AGP and Gradle (kotlinlang.org).
const KOTLIN_MIN = [
  { from: '2.4.0', agp: '8.5.2', gradle: '7.6.3' },
  { from: '2.3.0', agp: '8.2.2', gradle: '7.6.3' },
]

const parts = (v: string) =>
  v
    .split(/[.-]/)
    .slice(0, 3)
    .map((n) => Number.parseInt(n, 10) || 0)
const below = (a: string, b: string) => {
  const [x, y] = [parts(a), parts(b)]
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0)
  return false
}

export function gradleOf(wrapper: string): string | undefined {
  return /distributionUrl\s*=.*gradle-(\d+(?:\.\d+){0,2})-(?:bin|all)\.zip/.exec(wrapper)?.[1]
}

const AGP = 'com.android.tools.build:gradle'
const isKotlin = (name: string) => /^org\.jetbrains\.kotlin[.:]/.test(name)
const isKsp = (name: string) => /^com\.google\.devtools\.ksp[.:]/.test(name)

export function conflicts(
  name: string,
  target: string,
  deps: Dep[],
  gradle: string | undefined,
): string[] {
  const out: string[] = []
  const agp = deps.find((d) => d.name === AGP)?.version

  if (name === AGP) {
    const needs = AGP_GRADLE[/^(\d+\.\d+)/.exec(target)?.[1] ?? '']
    if (!needs) out.push(`AGP ${target} is newer than the table: confirm which Gradle it needs`)
    else if (!gradle) out.push(`AGP ${target} needs Gradle ${needs}; no wrapper to confirm it`)
    else if (below(gradle, needs))
      out.push(`AGP ${target} needs Gradle ${needs} or later; the wrapper uses ${gradle}`)
  }

  if (isKotlin(name)) {
    const needs = KOTLIN_MIN.find((k) => !below(target, k.from))
    if (needs && agp && below(agp, needs.agp))
      out.push(`Kotlin ${target} needs AGP ${needs.agp} or later; the project uses ${agp}`)
    if (needs && gradle && below(gradle, needs.gradle))
      out.push(`Kotlin ${target} needs Gradle ${needs.gradle} or later`)
    for (const d of deps.filter((d) => isKsp(d.name))) {
      const builtFor = /^(\d+\.\d+\.\d+)-/.exec(d.version)?.[1]
      if (builtFor && builtFor !== target)
        out.push(`KSP ${d.version} is built for Kotlin ${builtFor}: a KSP for ${target} is needed`)
    }
  }
  return out
}
```

`conflicts('com.android.tools.build:gradle', '8.13.0', deps, '8.11.1')` renvoie la phrase sur Gradle 8.13. N’importe quelle phrase déplace la ligne vers votre groupe des mises à jour bloquées.

## Erreurs fréquentes et comment tester

Elles viennent du code, des tests et du journal de tâches de Narsil Check :

- **Traiter un patch de Kotlin comme trivial.** Avec un plugin de compilateur dans le build, il ne l’est pas. Vérifiez les plugins à chaque saut de Kotlin.
- **Manquer un plugin lu seulement via le catalogue.** Un module `build-logic` peut ne nommer aucune coordonnée. Regardez aussi les clés du catalogue.
- **Vérifier les maximums.** Ils sont « fully supported » (entièrement pris en charge), pas des limites. Bloquer sur eux retient des builds qui fonctionnent.
- **Deviner au-delà du tableau.** Une version inconnue doit faire demander, pas passer.
- **Déclencher les règles de migration vers AGP 9 à chaque montée d’AGP 9.** Elles appartiennent au passage depuis 8.x ; un test a surpris exactement cela.
- **Faire correspondre un groupe trop largement.** `org.jetbrains.compose.*` inclut des artefacts avec leurs propres versions. Nommez les groupes de la ligne principale.
- **Des tableaux sans source.** Écrivez l’URL et la version « as of » (à la date de) à côté de chacun, pour que la personne suivante sache où vérifier.
- **Réécrire un wrapper avec somme de contrôle.** La somme change avec la distribution. Bloquez et donnez la commande.

Pour tester, `claude plugin test .` exécute `tests/kmp.test.tsx` : « the Android Gradle Plugin cannot go past what the Gradle wrapper runs » (l’Android Gradle Plugin ne peut pas dépasser ce qu’exécute le wrapper Gradle), « AGP 9 refuses KMP modules on com.android.library and kapt » (AGP 9 refuse les modules KMP sur com.android.library et kapt), « Kotlin cannot go past the AGP and Gradle its Gradle plugin supports at least » (Kotlin ne peut pas dépasser l’AGP et le Gradle minimums que prend en charge son plugin Gradle), « Compose Multiplatform cannot go past the Kotlin and AGP it needs » (Compose Multiplatform ne peut pas dépasser le Kotlin et l’AGP dont il a besoin), « KSP from 2.3.12 needs AGP 8.12 » (KSP à partir de 2.3.12 a besoin d’AGP 8.12), « artifacts under org.jetbrains.compose on their own version line are not Compose Multiplatform » (les artefacts sous org.jetbrains.compose qui ont leur propre ligne de versions ne sont pas Compose Multiplatform) et « a wrapper under android/, as a React Native project keeps it, gives the Gradle version too » (un wrapper sous android/, là où un projet React Native le garde, donne aussi la version de Gradle). `tests/wrapper.test.tsx` contient « a wrapper that checks a checksum is blocked with the reason, since the sum changes too » (un wrapper qui vérifie une somme de contrôle est bloqué avec la raison, puisque la somme change aussi) et « the vulnerabilities check never asks OSV about the wrapper, which it does not know » (la vérification des vulnérabilités n’interroge jamais OSV sur le wrapper, qu’il ne connaît pas) ; `tests/actions.test.tsx` contient « a new tag whose commit cannot be read leaves every workflow as it was and says which » (un nouveau tag dont le commit ne peut pas être lu laisse chaque workflow tel qu’il était et dit lequel).

## Pour aller plus loin

- Les tableaux vieilliront. Un petit script qui récupère les pages de Google et de JetBrains et les compare aux tableaux dirait quand les mettre à jour.
- Détecter la référence `kotlin` partagée du catalogue de versions permettrait au panneau de dire « montez Kotlin et le compilateur Compose ensemble » au lieu de le laisser implicite.
- Le wrapper android/ d’un projet React Native pourrait recevoir une ligne informative, sans bouton.

C’est le dernier guide du parcours « Votre propre panneau de revue ». Son index liste les dix-sept guides, du panneau latéral à ces outils de build, si vous voulez revenir à une fonctionnalité. Pour le socle sur lequel repose chaque guide, les guides « Bases des mods » couvrent ce dont est fait un mod, l’objet `$`, comment installer, recharger, valider et tester un mod, les surfaces sur lesquelles il s’exécute, et ce que la GPL v3 de Narsil implique quand vous réutilisez son code.
