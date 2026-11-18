---
title: Les versions fixées exprès
description: 'Comment Narsil Check lit un commentaire comme "# pinned: 3.7 breaks auth" dans un manifest et garde cette bibliothèque hors du bouton de mise à jour, avec le commentaire pour raison.'
route: check
order: 10
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/adapter.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/swiftpm.ts
  - repo: check
    path: hooks/npm.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/holds.test.tsx
---

## Ce que ça fait

Parfois, une version est ancienne exprès. Une bibliothèque a cassé quelque chose dans sa version suivante, un plugin ne prend en charge que celle-ci, ou l’équipe a convenu d’attendre une migration. La personne qui a décidé laisse en général un commentaire à côté de la version, et la personne suivante qui regarde le manifest le lit.

Un outil qui monte les versions devrait le lire aussi. Dans Narsil Check, un commentaire qui dit que la version est gardée exprès envoie cette bibliothèque dans **Bloqueada** (Bloquée), et le commentaire lui-même est la raison sous la ligne :

```toml
[versions]
# Fijar 2.4.20 hasta confirmar soporte de SKIE para 2.4.21
kotlin = "2.4.20"
ktor = "3.6.1" # pinned: 3.7 breaks auth
```

Cet exemple vient du README. Le premier commentaire signifie « fixer 2.4.20 jusqu’à confirmation de la prise en charge de 2.4.21 par SKIE ». Dans le panneau, la ligne de ktor reçoit :

```text
Fijada a propósito: «pinned: 3.7 breaks auth»
```

Cela signifie « fixée exprès », suivi du commentaire (qui veut dire « fixé : 3.7 casse l’authentification »). Le bouton **Actualizar las N** (« mettre à jour les N ») ne prend jamais une bibliothèque bloquée, si bien que la décision écrite dans le manifest tient jusqu’à ce que quelqu’un retire le commentaire.

## Comment ça marche à l’intérieur

### Les mots : `HOLD`

Le cahier des charges de ce parcours place la détection dans `hooks/words.ts` ; dans le code, elle se trouve dans `hooks/adapter.ts`, à côté du contrat que respecte chaque écosystème. C’est une seule expression régulière :

```ts
const HOLD =
  /\b(pin(ned)?|hold|keep|freeze|frozen|do ?n[o']t (upgrade|update|bump)|fij(ar|ad[oa]|o)|congelad[oa]|no (actualizar|subir))\b/i
```

Elle est citée de [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). En anglais, elle reconnaît pin, pinned, hold, keep, freeze, frozen (fixer, fixé, retenir, garder, geler, gelé), « do not » ou « don't » suivi de upgrade, update ou bump (ne pas mettre à jour, ne pas monter) ; et en espagnol, fijar, fijado, fijada, fijo (« fixer », « fixé »), congelado ou congelada (« gelé »), « no actualizar » et « no subir » (« ne pas mettre à jour », « ne pas monter »). Elle ignore la casse, et `\b` la limite aux mots entiers, si bien que « keeper » ou « pinch » ne comptent pas.

Le README liste la plupart de ces mots, mais pas tous : « frozen », « fijo », « no subir » et les formes « update » et « bump » ne se trouvent que dans le code.

### Quel commentaire compte : `commentOf` et `holdNote`

`commentOf` trouve le commentaire que porte une ligne : après `#`, `//` ou `<!--` (précédé d’une espace ou en début de ligne), en retirant un `-->` final. Ces trois formes couvrent chaque manifest que lit le mod et qui admet des commentaires : TOML (`Cargo.toml`, `pyproject.toml`, le catalogue de versions Gradle), `requirements.txt`, `pubspec.yaml`, le `Gemfile`, `go.mod`, les scripts Gradle, `Package.swift`, et le XML de `pom.xml` et des fichiers `.csproj`.

`holdNote(files, keys, spec)` cherche ensuite, dans chaque fichier que l’adaptateur a lu, la ligne qui écrit cette dépendance :

1. La ligne doit contenir la version telle qu’elle est écrite (`spec`) et mentionner l’une des `keys` comme nom entier. Les clés sont le nom de la dépendance, son nom d’affichage et, pour une ligne de catalogue de versions, sa clé de version (`kotlin` dans `versions.kotlin`).
2. Le commentaire de cette ligne compte.
3. La ligne du dessus ne compte que si c’est un commentaire seul. Un commentaire en fin de ligne sur la ligne du dessus appartient à une autre déclaration.

Chaque règle existe pour une raison que fixent les tests. « Another library's line with the same version is not this one's » (la ligne d’une autre bibliothèque avec la même version n’est pas celle-ci) : `other = "2.4.20" # keep` ne retient pas kotlin. Un commentaire sans mot de retenue, comme `# the DI library`, « is only a comment » (n’est qu’un commentaire). Et la même vérification fonctionne pour un `// do not upgrade: needs JDK 21` de Gradle et un `# hold until the 8.0 migration` de Gemfile.

### Où elle rejoint l’analyse

`scanGeneric` dans `hooks/register.tsx`, l’analyse par laquelle passe chaque écosystème sauf npm, l’appelle pour chaque mise à jour après la réponse du registre :

```ts
const hold = holdNote(files, [u.name, u.display ?? '', ref ?? ''], u.spec)
u.conflicts = [
  ...(hold ? [`Fijada a propósito: «${hold}»`] : []),
  ...(adapter.conflictsOf?.(u, deps, files) ?? []),
  ...(young.get(u) ?? []),
]
if (u.conflicts.length > 0) u.group = 'blocked'
```

Cité de [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later), reformaté. La raison de retenue passe en premier, avant ce que l’écosystème sait qu’elle casse et l’attente de 24 heures du guide précédent. N’importe quelle raison rend la mise à jour `blocked`, si bien qu’un patch fixé est aussi bloqué qu’une version majeure fixée.

Le panneau la dessine ensuite comme n’importe quelle ligne bloquée : les raisons jointes par `·` en rouge sous la bibliothèque. Un appui sur la ligne copie le saut avec ses raisons, prêt à coller dans une issue.

### Pourquoi npm est laissé de côté

`package.json` est du JSON, et le JSON n’a pas de commentaires. `scanNpm` n’appelle jamais `holdNote`, et le README le dit : la vérification s’exécute « en cualquier ecosistema cuyo manifest admite comentarios (todos menos npm, cuyo `package.json` no los tiene) » (« dans tout écosystème dont le manifest admet des commentaires : tous sauf npm, dont le `package.json` n’en a pas »).

Ce que npm a, c’est une autre idée au nom semblable. Les « versions fixées dans l’arbre » (le guide précédent) sont des versions exactes qu’exige un autre paquet installé, lues dans `package-lock.json`, pas la décision d’une personne. Écrire une version exacte dans `package.json` (`"1.2.0"` au lieu de `"^1.2.0"`) n’est pas lu comme une retenue non plus : le bouton de mise à jour la monte quand même, en passant la nouvelle version au gestionnaire de paquets sans préfixe (`rangeFor` dans `hooks/npm.ts`, voir le guide 12).

Une ligne du README peut prêter à confusion ici. Sa liste de détails dit « Expo, peerDependencies y versiones fijadas se revisan solo en npm » (« Expo, les dépendances peer et les versions fixées ne sont vérifiées que dans npm »). Dans cette ligne, « versions fixées » désigne les pins dans l’arbre de npm, pas les commentaires de ce guide, qui sont vérifiés partout sauf dans npm.

### Fixée par la syntaxe, pas par un commentaire

Deux écosystèmes ont leur propre façon de dire « cette version exacte », et le mod la traite aussi comme une décision :

- **SwiftPM.** Une exigence écrite avec `exact:` dans `Package.swift`, ou `exactVersion` dans un projet Xcode, active `isExact` sur la dépendance. Le `conflictsOf` de l’adaptateur SwiftPM donne alors « Fijada a la versión exacta 1.2.0: revisa por qué antes de subirla » (« fixée à la version exacte 1.2.0 : vérifiez pourquoi avant de la monter »). La raison du README : « suele ser una decisión a propósito » (« c’est en général une décision prise exprès »).
- **Gradle.** Une bibliothèque qu’un `gradle.lockfile` retient à une autre version est bloquée, parce qu’un build avec verrouillage la refuse tant que le verrou n’est pas régénéré avec `--write-locks`.

### Pourquoi un commentaire, et pas un fichier de réglages

Le code et les commits ne consignent pas pourquoi la retenue vit dans les commentaires du manifest plutôt que dans une liste propre au mod. En lisant la conception : le commentaire est déjà l’endroit où l’on écrit ce genre de décision, il voyage avec le dépôt jusqu’à chaque membre de l’équipe, et il porte sa raison, ce qui est exactement ce que la ligne bloquée doit montrer. Une liste stockée par le mod vivrait sur une seule machine et ne dirait rien du pourquoi. Ce raisonnement est une interprétation, pas une décision consignée.

## Le construire avec Claude

Demandez à Claude une fonction pure qui trouve un commentaire de maintien à côté de la version d’une dépendance et bloque cette mise à jour avec le commentaire comme raison. L’idée que Claude doit bien saisir : quel commentaire appartient à quelle dépendance.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon mod Claude Code `my-panel`, qui liste les dépendances obsolètes de `Cargo.toml` et `pyproject.toml`, bloque toute dépendance dont la version est gardée exprès par un commentaire. Écris une fonction pure `holdNote(files, keys, spec)` : pour chaque ligne qui contient la version `spec` et mentionne l’une des `keys` comme nom entier, lis le commentaire après `#`, `//` ou `<!--` sur cette ligne, ou sur la ligne du dessus seulement quand cette ligne est un commentaire seul, et renvoie-le quand il contient un mot de retenue (pin, pinned, hold, keep, freeze, « do not upgrade », et les mots espagnols fijar, fijado, congelado, « no actualizar »), en reconnaissant des mots entiers et en ignorant la casse. Mets une dépendance retenue dans le groupe `blocked` avec la raison « Pinned on purpose: «comment» », et garde-la hors du bouton « Update all ». Ignore `package.json`, qui n’a pas de commentaires. Teste qu’un commentaire en fin de ligne sur la ligne du dessus ne compte pas, que la ligne d’une autre dépendance avec la même version ne compte pas, et qu’un commentaire sans mot de retenue ne bloque pas.

### Ce qu’il faut vérifier dans la réponse de Claude

1. La ligne doit contenir la version telle qu’elle est écrite et nommer la dépendance comme un nom entier, si bien qu’une autre bibliothèque avec la même version, ou `kotlin` à l’intérieur de `kotlinx`, ne compte pas.
2. Un commentaire sur la ligne du dessus ne compte que si cette ligne est un commentaire à elle seule. Un commentaire en fin de ligne sur la ligne du dessus appartient à une autre déclaration.
3. Les mots de maintien correspondent à des mots entiers et ignorent la casse, et un commentaire sans mot de maintien, comme `# the DI library`, ne bloque pas.
4. Une dépendance maintenue arrive dans le groupe bloqué avec le commentaire comme raison, et le bouton « Update all » ne la prend jamais.
5. `package.json` est ignoré, puisque JSON n’a pas de commentaires.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « Kotlin est bloqué par un commentaire “pin” écrit sur la ligne de kotlinx-coroutines ».

### Comment l’auteur l’a demandé

La demande d’origine pour cette fonctionnalité n’a pas été consignée : aucun journal de tâches public de narsil-check ne la couvre. Ce qui suit est une reconstitution.

#### Reconstitution à partir de l’historique des commits

À partir de `git log -S holdNote` et de `git log -S lockConflicts` dans narsil-check :

- `4ea9be0` (2026-11-04) « feat: block upgrades kept on purpose and Kotlin past its compiler plugins » (bloquer les mises à jour retenues exprès et Kotlin au-delà de ses plugins de compilateur). Toute la fonctionnalité en un commit. Son message : « A comment with a hold word (pin, hold, keep, freeze, do not upgrade, fijar, congelado, no actualizar) on a version's line, or alone on the line above, blocks that upgrade with the comment as its reason. » (un commentaire avec un mot de retenue sur la ligne d’une version, ou seul sur la ligne du dessus, bloque cette mise à jour avec le commentaire pour raison). Il a aussi renommé le groupe de « Bloqueada por otras dependencias » (« bloquée par d’autres dépendances ») en simplement **Bloqueada**, « since a dependency is no longer its only reason » (puisqu’une dépendance n’est plus sa seule raison). Le message nomme le cas sur lequel il a été vérifié : un modèle Kotlin Multiplatform où le patch de Kotlin est désormais bloqué par ses plugins de compilateur.
- `7125ffd` (2026-11-09) « fix: stop the upgrade button from breaking builds it cannot check » (empêcher le bouton de mise à jour de casser des builds qu’il ne peut pas vérifier). Il ajoute les deux pins par la syntaxe : une bibliothèque Gradle que retient un `gradle.lockfile`, et « a Swift package pinned to an exact version. Neither counts as trivial any more. » (un paquet Swift fixé à une version exacte. Aucun des deux ne compte plus comme trivial).

Le commit associe la vérification des commentaires à la règle des plugins de compilateur Kotlin, et le fichier de tests qui couvre les deux est `tests/holds.test.tsx`. Les deux partagent une idée : certaines mises à jour paraissent triviales par leur numéro et ne le sont pas, et la raison doit être montrée en mots.

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide. Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

Voici une version réduite de l’idée, écrite pour ce guide. C’est du TypeScript simple sans API de mod, adapté de `hooks/adapter.ts` dans [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later).

```ts
const HOLD =
  /\b(pin(ned)?|hold|keep|freeze|frozen|do ?n[o']t (upgrade|update|bump)|fij(ar|ad[oa]|o)|congelad[oa]|no (actualizar|subir))\b/i

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function commentOf(line: string): string | undefined {
  const m = /(?:^|\s)(?:#|\/\/|<!--)\s*(.*?)\s*(?:-->)?\s*$/.exec(line)
  return m?.[1]
}

function mentions(line: string, key: string): boolean {
  return new RegExp(`(^|[^\\w.-])${escape(key)}([^\\w.-]|$)`).test(line)
}

// The comment that holds a dependency, from the files of its manifests.
export function holdNote(
  files: Record<string, string>,
  keys: string[],
  spec: string,
): string | undefined {
  for (const text of Object.values(files)) {
    const lines = text.split(/\r?\n/)
    for (let n = 0; n < lines.length; n++) {
      const line = lines[n] ?? ''
      if (!line.includes(spec) || !keys.some((k) => k && mentions(line, k))) continue
      const above = lines[n - 1] ?? ''
      for (const candidate of [line, /^\s*(#|\/\/|<!--)/.test(above) ? above : '']) {
        const comment = commentOf(candidate)
        if (comment && HOLD.test(comment)) return comment
      }
    }
  }
  return undefined
}

// In the scan, after the registry answered:
// const hold = holdNote(files, [dep.name], dep.spec)
// if (hold) { upgrade.conflicts.push(`Pinned on purpose: «${hold}»`); upgrade.group = 'blocked' }
```

Ne passez que les fichiers de l’écosystème analysé. La vérification `mentions` empêche `kotlin` de correspondre à `kotlinx-coroutines`, parce qu’un point ou un tiret à côté du nom signifie qu’il fait partie d’un nom plus long.

## Erreurs fréquentes et comment tester

Elles viennent du code et des tests de Narsil Check :

- **Compter un commentaire en fin de ligne sur la ligne du dessus.** Dans `a = "1.0" # keep` suivi de `b = "1.0"`, le commentaire est celui de `a`. Seul un commentaire seul sur sa ligne parle pour la suivante.
- **Ne reconnaître que la version.** Deux bibliothèques peuvent partager une même chaîne de version. La ligne doit aussi nommer la dépendance.
- **Reconnaître une partie d’un nom.** `kotlin` dans `kotlinx` est une autre bibliothèque ; le nom doit être isolé.
- **Des mots trop larges.** `keep` reconnaît aussi un commentaire comme « keep in sync with the server » (garder synchronisé avec le serveur), ce qui bloquerait cette bibliothèque. Cela découle de l’expression régulière ; si vos projets utilisent de tels commentaires, réduisez la liste.
- **Chercher des commentaires dans du JSON.** Il n’y en a pas ; n’inventez pas une convention que le fichier ne peut pas porter, ou documentez-la clairement si vous le faites.
- **Masquer la raison.** Le commentaire est la chose la plus utile à montrer : c’est l’explication de la personne elle-même.

Pour tester, `claude plugin test .` exécute `tests/holds.test.tsx`. « a comment with a hold word on the version line, or the line above, keeps it » (un commentaire avec un mot de retenue sur la ligne de la version, ou sur la ligne du dessus, la retient) appelle `holdNote` avec des lignes TOML, Gradle et Gemfile, y compris les cas qui ne doivent pas compter. « a version kept by a comment is blocked with that comment » (une version retenue par un commentaire est bloquée avec ce commentaire) passe par tout le panneau avec `$.ui.mount` : il trouve le texte « Fijada a propósito: «keep: 1.11.1 breaks the iOS test runner» » (« fixée exprès : «garder : 1.11.1 casse l’exécuteur de tests iOS» ») et vérifie qu’aucun bouton **Actualizar** n’est dessiné.

## Pour aller plus loin

- Une retenue pourrait avoir une fin : « pin until 2027-01 » (fixer jusqu’en 2027-01) pourrait cesser de bloquer après cette date. Narsil Check ne le fait pas ; le commentaire retient jusqu’à ce que quelqu’un le retire.
- npm pourrait recevoir une convention propre, comme une clé sous un champ personnalisé de `package.json`. Le mod n’en a aucune, et le README dit clairement que npm n’est pas vérifié.
- Le guide suivant lit avec Haiku les notes de version d’un saut majeur, et c’est souvent ainsi que quelqu’un trouve la raison d’écrire un commentaire de retenue.
