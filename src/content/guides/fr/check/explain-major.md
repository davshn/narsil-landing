---
title: Expliquer une version majeure avec Haiku
description: 'Comment Narsil Check demande à Haiku la difficulté d’une mise à jour majeure pour ce projet, à partir des notes de version et des lignes qui importent la bibliothèque, sans rien inventer.'
route: check
order: 11
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/explain.ts
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
    path: odd/tasks/ecosystems-wave-2.md
---

## Ce que ça fait

Une version majeure dit « quelque chose peut casser ». Elle ne dit pas si cela casse chez vous. React 19 a retiré plusieurs anciennes API ; si votre projet ne les a jamais utilisées, la mise à jour est petite. Pour le savoir, vous ouvririez les notes de version, puis vous chercheriez dans votre code chaque endroit qui importe la bibliothèque, et vous compareriez.

Narsil Check fait cette comparaison pour chaque bibliothèque du groupe **Versión mayor: revisar cambios** (« version majeure : examiner les changements »). Sous chaque ligne, pendant qu’il travaille, une ligne atténuée dit `Analizando con Haiku…` (« analyse avec Haiku… »). Ensuite, il affiche une difficulté et une ou deux phrases :

```text
react 18.2.0 → 19.2.0
  Dificultad media: React 19 quita propTypes; tus 2 imports no los usan, pero revisa las refs de texto.
```

Cela signifie « difficulté moyenne : React 19 retire propTypes ; vos 2 imports ne les utilisent pas, mais vérifiez les refs de texte ». L’exemple est celui qu’utilisent les tests. La ligne est verte pour `baja` (faible), jaune pour `media` (moyenne) et rouge pour `alta` (élevée).

Un appui sur la ligne copie le saut avec sa difficulté et sa raison, prêt à coller dans une issue ou un prompt. La raison est demandée une fois par saut et gardée, si bien qu’elle est de nouveau là à la session suivante, sans coût.

## Comment ça marche à l’intérieur

`hooks/explain.ts` contient les parties simples (quelles versions cassent, le prompt, la lecture de la réponse). `hooks/register.tsx` récupère les données, exécute `git grep` et appelle le modèle. Cette séparation permet aux tests de vérifier le prompt et l’analyse de la réponse comme des fonctions pures.

### Quand il s’exécute

Quand une analyse se termine, `scanProject` affiche la liste tout de suite et lance `explainMajors` sans l’attendre. Seules les mises à jour du groupe `review` sont lues : une version majeure que quelque chose bloque est dans **Bloqueada** et montre ses raisons de blocage à la place. Deux sont lues à la fois (`EXPLAIN_CONCURRENCY`), si bien qu’une liste de vingt versions majeures ne déclenche pas vingt appels au modèle en même temps. Une ligne déjà traitée ou en cours est ignorée.

### La première entrée : les notes des versions qui cassent

`breakingVersions(current, latest)` nomme les versions qui cassent entre les deux, la plus récente en premier et trois au plus : le `x.0.0` de chaque nouvelle majeure (de 16 à 19 : `19.0.0`, `18.0.0`, `17.0.0`), ou en dessous de 1.0.0 le `0.y.0` de chaque nouvelle mineure. Les notes des patchs intermédiaires sont laissées de côté exprès : les changements cassants sont annoncés dans la version qui casse.

`releaseNotes` trouve ensuite le dépôt GitHub de la bibliothèque. Pour npm, il lit le champ `repository` du `node_modules/<name>/package.json` installé, sinon de la réponse du registre ; les autres écosystèmes le donnent via leur adaptateur (`repoUrlOf`, `infoUrl` ou `repoUrlFor`). Pour chaque version qui casse, il essaie trois noms de tag sur l’API des releases de GitHub, puisque les paquets ne taguent pas tous de la même façon : `v19.0.0`, `@scope/name@19.0.0` pour un monorepo, ou simplement `19.0.0`.

Les notes de chaque version sont coupées à 6 000 caractères et l’ensemble à 12 000 (`NOTES_PER_RELEASE`, `NOTES_TOTAL`), avec `[…]` là où quelque chose a été coupé. Le commentaire dit pourquoi la limite par version existe : « so a long upgrade guide still leaves room » (pour qu’un long guide de migration laisse encore de la place) aux autres versions.

Quand aucune version n’a de notes et que le paquet vient de npm, le mod lit le `CHANGELOG.md` du paquet depuis unpkg et ne garde que ce qui se trouve au-dessus du titre de la version installée : ce qui a changé depuis. unpkg ne sert que des paquets npm, donc les autres écosystèmes n’ont pas de repli.

### La seconde entrée : comment le projet l’utilise

`usageOf` exécute :

```text
git --no-pager grep -n -I -E <pattern> -- . :!node_modules
```

Le motif vient de l’`importPattern` de l’adaptateur. Pour npm, il reconnaît `from 'name'`, `from 'name/sub'`, `require('name')` et `import('name')` ; Python reconnaît les lignes `import` et `from` avec le nom du module (`yaml` pour PyYAML) ; chaque écosystème a le sien. Le résultat est le nombre de fichiers et au plus 40 lignes d’au plus 200 caractères, chacune sous la forme `path:line:text`.

C’est `git grep` qui est utilisé, et non un parcours des fichiers, parce qu’il ne cherche que dans les fichiers suivis, ignore les binaires avec `-I`, et est rapide sur un grand dépôt.

### Le prompt exact

Le prompt système est `SYSTEM` dans `hooks/explain.ts`, cité tel qu’il est dans [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Il n’a pas changé depuis le premier commit.

```text
You assess how hard a major dependency upgrade is for one specific project.
You get the release notes of the breaking versions and the lines where the project imports the library.
Answer in Spanish, in exactly this form:
DIFICULTAD: baja|media|alta
RAZÓN: one or two sentences, at most 280 characters, naming the concrete breaking change that affects the imports shown, or saying none of them is touched.
Base the answer only on what you are given. Never invent APIs, versions or changes.
If the release notes are missing, say so in the reason and judge only from how much the project uses the library.
```

Traduction en français : « Tu évalues la difficulté d’une mise à jour majeure d’une dépendance pour un projet précis. Tu reçois les notes de version des versions qui cassent et les lignes où le projet importe la bibliothèque. Réponds en espagnol, exactement sous cette forme : DIFICULTAD: baja|media|alta ; RAZÓN: une ou deux phrases, 280 caractères au plus, qui nomment le changement cassant concret qui touche les imports montrés, ou qui disent qu’aucun d’eux n’est touché. Fonde la réponse uniquement sur ce qu’on te donne. N’invente jamais d’API, de versions ni de changements. Si les notes de version manquent, dis-le dans la raison et juge uniquement d’après l’usage que le projet fait de la bibliothèque. »

Il est écrit en anglais, avec les libellés de la réponse en espagnol parce que le panneau parle espagnol : `DIFICULTAD: baja|media|alta` signifie « DIFFICULTÉ : faible|moyenne|élevée », et `RAZÓN` signifie « RAISON ».

Le message utilisateur est construit par `prompt(u, notes, usage)`, aussi dans `hooks/explain.ts` :

```text
Library: react
Upgrade: 18.2.0 -> 19.2.0

The project imports it in 2 files:
src/App.tsx:1:import { useState } from 'react'
src/main.tsx:2:import React from 'react'

Release notes of the breaking versions:
## v19.0.0
…
```

Ses lignes disent « bibliothèque », « mise à jour », « le projet l’importe dans 2 fichiers » et « notes de version des versions qui cassent ». Quand aucun import n’est trouvé, les lignes sont remplacées par « (no imports found: it may be used through config or a CLI) » (aucun import trouvé : elle est peut-être utilisée via une configuration ou une CLI). Sans notes, la dernière partie dit « (none found) » (aucune trouvée).

### Comment il empêche le modèle d’inventer

Un modèle à qui l’on demande « quelle est la difficulté de React 19 ? » répondra d’après ce dont il se souvient, ce qui peut être faux ou plus ancien que la version. Quatre choix de la conception vont contre cela :

- **On lui donne les preuves.** Les notes et les lignes d’import sont dans le message ; le modèle n’a à se souvenir ni des unes ni des autres.
- **On lui dit de n’utiliser que cela.** « Base the answer only on what you are given. Never invent APIs, versions or changes. » (fonde la réponse uniquement sur ce qu’on te donne ; n’invente jamais d’API, de versions ni de changements).
- **Il a une porte de sortie honnête.** Sans notes, il doit le dire et juger d’après l’usage que le projet fait de la bibliothèque, au lieu de combler le vide.
- **La réponse a une forme fixe.** `parseReason` n’accepte une réponse que si elle contient à la fois `DIFICULTAD:` avec l’un des trois mots et `RAZÓN:` avec du texte. Tout le reste est écarté, et la ligne dit « Haiku no dio una razón; revisa las notas de la versión. » (« Haiku n’a pas donné de raison ; consultez les notes de la version. »). La raison est coupée à 400 caractères, si bien qu’une réponse qui s’emballe ne peut pas remplir le panneau.

Rien de tout cela ne prouve que la raison est juste ; cela la rend vérifiable. Le panneau montre ce qu’a conclu Haiku et nomme le changement cassant, si bien que vous pouvez ouvrir les mêmes notes de version et le vérifier.

### Appeler Haiku : `$.model.complete`

```ts
const reply = await $.model.complete({
  model: 'haiku',
  system: SYSTEM,
  prompt: prompt(u, notes, usage),
  maxTokens: 400,
  timeoutMs: EXPLAIN_MS,
})
const reason = reply.isAnswered ? parseReason(reply.text) : undefined
```

Cité de `hooks/register.tsx` dans [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later), reformaté. `EXPLAIN_MS` vaut 60 secondes.

Les types 2.1.325 décrivent `$.model.complete` comme « one text completion through the session's own API client » (une complétion de texte via le propre client d’API de la session), avec « No tools, no history, no system prompt beyond the CLI's identity block and `request.system` » (pas d’outils, pas d’historique, pas de prompt système au-delà du bloc d’identité de la CLI et de `request.system`). Haiku ne voit donc que ce message, rien de votre conversation. `model` accepte un alias comme `haiku`, « resolved and allowlist-checked like a `--model` value » (résolu et vérifié par rapport à la liste autorisée comme une valeur de `--model`). Le résultat ne rejette jamais à cause de ce qu’a fait le fournisseur : il indique `isAnswered`, ou donne une `reason` (`api-error`, `empty-reply`, `aborted`), et le mod les traite toutes comme « pas de raison ». Une exception pendant toute l’étape affiche « No pude analizar esta actualización. » (« je n’ai pas pu analyser cette mise à jour. »).

Une bonne réponse est écrite dans `$.store` sous `why:<name>@<current>-><latest>` et gardée pour de bon : les notes d’une version publiée ne changent pas. Une réponse ratée n’est pas gardée, si bien que l’analyse suivante réessaie.

### Le coût

Les types disent qu’une requête qui a reçu une réponse « counts toward the session's cost total, `/cost` and the cost and token metrics » (compte dans le coût total de la session, dans `/cost` et dans les métriques de coût et de tokens), et que « Nothing caps it per call » (rien ne le plafonne par appel). Le mod le plafonne lui-même : au plus 400 tokens de sortie, et une entrée d’au plus 12 000 caractères de notes plus 40 lignes courtes. Chaque saut n’est demandé qu’une fois, pour toujours, sur cette machine. Une longue liste de versions majeures coûte une seule fois ; les sessions suivantes lisent le stockage.

### La confidentialité

Ce qui quitte votre machine, et vers où :

- **Vers le fournisseur du modèle** (via le propre client de la session) : le nom de la bibliothèque, les deux versions, et jusqu’à 40 lignes d’import de votre code avec leurs chemins de fichiers. Pas le reste de vos fichiers.
- **Vers l’API de GitHub et unpkg** : le nom du paquet et les versions, pour récupérer des notes publiques. Le README signale la limite de GitHub sans authentification, 60 requêtes par heure ; quand elle est épuisée, l’analyse utilise le `CHANGELOG.md` ou dit qu’elle n’a trouvé aucune note.

Les lignes d’import sont en général inoffensives, mais elles sont votre code. Un mod qui lit les versions majeures de paquets privés devrait le garder à l’esprit.

### Le README et le code

Le README dit « Si no hay release, se usa el `CHANGELOG.md` del paquete » (« s’il n’y a pas de release, le `CHANGELOG.md` du paquet est utilisé »), sans limite. Dans le code, ce repli ne vaut que pour npm, parce qu’il passe par unpkg.

## Comment on l’a demandé à l’IA

La demande d’origine pour cette fonctionnalité n’a pas été consignée : elle est déjà dans le premier commit, et aucun journal de tâches public ne couvre sa création. Un journal de tâches ultérieur consigne, avec les mots de l’agent, comment elle a été étendue aux autres écosystèmes.

### Consigné dans un journal de tâches

`odd/tasks/ecosystems-wave-2.md` liste, comme spec S5, ce qui devait continuer à fonctionner quand le second groupe d’écosystèmes a été ajouté. C’est la spec de l’agent, pas les mots de l’auteur ou de l’autrice :

> "Haiku's reason for a major upgrade works for every ecosystem: release notes from the repository each registry records, and the project's imports found with git grep."

Traduction en français : « La raison de Haiku pour une mise à jour majeure fonctionne pour chaque écosystème : notes de version depuis le dépôt que consigne chaque registre, et imports du projet trouvés avec git grep. »

Le S3 du même fichier liste « Haiku reasons » (les raisons de Haiku) parmi les comportements qui devaient rester inchangés.

### Reconstitution à partir de l’historique des commits

À partir de `git log -- hooks/explain.ts` et de `git log -S SYSTEM` dans narsil-check :

- `1bf736a` (2026-11-04) « feat: add upgrade panel for npm and Expo projects » (ajouter un panneau de mises à jour pour les projets npm et Expo). Son message décrit « majors with Haiku's reading of the release notes against the project's imports » (les versions majeures avec la lecture par Haiku des notes de version face aux imports du projet). `SYSTEM`, `prompt`, `parseReason`, `breakingVersions` et le cache `why:` sont tous là, tels qu’ils sont aujourd’hui.
- `a95eb07` (2026-11-04) « refactor: read dependencies through an adapter per ecosystem » (lire les dépendances via un adaptateur par écosystème). Chaque adaptateur reçoit son propre `importPattern` et son `repoUrlOf`, et c’est ainsi que la raison atteint les autres écosystèmes.
- `c50e830` (2026-11-04) « feat: find manifests anywhere in the tree and read four-part versions » (trouver les manifests n’importe où dans l’arbre et lire les versions en quatre parties). Son message : « infoUrl gives release notes a version's own record » (infoUrl donne aux notes de version la fiche propre à une version), pour les registres dont la réponse sur la dernière version ne nomme aucun dépôt.
- `b3ad055` (2026-11-06) « feat: fold upgrade and vulnerability groups, copy a row on click, … » (replier les groupes de mises à jour et de vulnérabilités, copier une ligne au clic, …). Un appui sur une ligne la copie avec la raison de Haiku, à la place des boutons de copie.

Le prompt lui-même n’a jamais changé. Ce qui a grandi, c’est l’origine des notes et de l’usage.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon mod Claude Code `my-panel`, sous chaque bibliothèque npm avec une mise à jour majeure, montre la difficulté du saut pour ce projet. Pour chacune, trouve son dépôt GitHub depuis le champ `repository` de `node_modules/<name>/package.json`, récupère avec `$.http.fetch` les notes de version du `x.0.0` de chaque nouvelle majeure (trois au plus, tags `v<version>`, `<name>@<version>` ou `<version>`), et coupe-les à 12 000 caractères. Trouve les lignes d’import avec `$.process.run(['git', '--no-pager', 'grep', '-n', '-I', '-E', pattern, '--', '.', ':!node_modules'])`, 40 au plus. Appelle `$.model.complete` avec `model: 'haiku'`, `maxTokens: 400`, un `timeoutMs` de 60 secondes, et un prompt système qui demande exactement `DIFFICULTY: low|medium|high` et `REASON:` en 280 caractères au plus, fondé uniquement sur ce qu’on lui donne, sans jamais inventer d’API, et qui le dit quand les notes manquent. N’accepte la réponse que si les deux lignes s’analysent. Mets-la en cache dans `$.store` sous `why:<name>@<from>-><to>` pour de bon. Affiche « Analyzing… » pendant l’exécution. Teste avec `on('model.complete', ...)` que le prompt contient les notes et une ligne d’import, et qu’une réponse sans la forme affiche une ligne de repli.

## Le code minimal

Voici une version réduite de l’idée, écrite pour ce guide et vérifiée par rapport aux types de Claude Code 2.1.325 (`$.model.complete`, `$.store.get`, `$.store.set`). Elle est adaptée de `hooks/explain.ts` et `hooks/register.tsx` dans [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Les notes et les lignes d’import sont passées en paramètre ; leur récupération est montrée plus haut.

```ts
import type { EngineInterface } from 'claude-code'

export type Reason = { difficulty: 'low' | 'medium' | 'high'; text: string }

const SYSTEM = [
  'You assess how hard a major dependency upgrade is for one specific project.',
  'You get the release notes of the breaking versions and the lines where the project imports the library.',
  'Answer in exactly this form:',
  'DIFFICULTY: low|medium|high',
  'REASON: one or two sentences, at most 280 characters.',
  'Base the answer only on what you are given. Never invent APIs, versions or changes.',
  'If the release notes are missing, say so and judge only from how much the project uses the library.',
].join('\n')

export function parseReason(text: string): Reason | undefined {
  const difficulty = /DIFFICULTY:\s*(low|medium|high)/i.exec(text)?.[1]?.toLowerCase()
  const reason = /REASON:\s*([\s\S]+)/i.exec(text)?.[1]?.trim()
  if (!difficulty || !reason) return undefined
  return {
    difficulty: difficulty as Reason['difficulty'],
    text: reason.replace(/\s+/g, ' ').slice(0, 400),
  }
}

export async function explain(
  $: EngineInterface,
  u: { name: string; current: string; latest: string },
  notes: string,
  lines: string[],
): Promise<Reason | undefined> {
  const key = `why:${u.name}@${u.current}->${u.latest}`
  const stored = (await $.store.get(key)) as Reason | undefined
  if (stored) return stored
  const prompt = [
    `Library: ${u.name}`,
    `Upgrade: ${u.current} -> ${u.latest}`,
    '',
    'Import lines:',
    lines.length > 0 ? lines.join('\n') : '(no imports found)',
    '',
    'Release notes of the breaking versions:',
    notes.trim() || '(none found)',
  ].join('\n')
  const reply = await $.model.complete({
    model: 'haiku',
    system: SYSTEM,
    prompt,
    maxTokens: 400,
    timeoutMs: 60_000,
  })
  const reason = reply.isAnswered ? parseReason(reply.text) : undefined
  if (reason) await $.store.set(key, reason)
  return reason
}
```

Exécutez `explain` depuis une analyse qu’aucun hook n’attend, gardez chaque résultat dans un atome par clé avec d’abord un état `loading`, et dessinez la ligne sous la ligne de la bibliothèque à partir de cet atome. Un résultat `undefined` est votre ligne de repli, et il n’est pas stocké.

## Erreurs fréquentes et comment tester

Elles viennent du code et des tests de Narsil Check :

- **Demander sans preuves.** Un modèle qui n’a qu’un nom et deux versions répond de mémoire. Envoyez les notes et l’usage.
- **Aucun moyen de dire « je ne sais pas ».** Sans la règle des notes manquantes, le modèle comble le vide. Donnez-lui la réponse honnête.
- **Faire confiance à du texte libre.** Analysez une forme fixe et écartez ce qui ne correspond pas ; coupez la longueur.
- **Redemander à chaque session.** Les notes d’une version ne changent pas ; mettez la raison en cache pour de bon, et ne mettez pas les échecs en cache.
- **L’attendre dans l’analyse.** La liste doit s’afficher tout de suite ; les raisons arrivent après.
- **Lancer tous les appels à la fois.** Limitez la concurrence ; deux suffisent pour un panneau latéral.
- **Envoyer trop.** Plafonnez les notes et les lignes. Cela borne le coût et la part de votre code qui quitte la machine.

Pour tester, `claude plugin test .` exécute `tests/upgrade.test.tsx`, qui répond au modèle avec `on('model.complete', ...)`, si bien qu’aucune vraie requête n’est faite. « each major shows the reason Haiku gives from the release notes and the imports, and a press on it copies it » (chaque version majeure montre la raison que donne Haiku à partir des notes de version et des imports, et un appui dessus la copie) vérifie que le prompt contient le corps de la release, une ligne d’import et « in 2 files », puis trouve la ligne « Dificultad media: … » et le texte copié. « a major read before is not asked again » (une version majeure déjà lue n’est pas redemandée) place d’abord une raison dans le stockage et compte les appels au modèle. « Haiku's answer is read as a difficulty and a reason » (la réponse de Haiku est lue comme une difficulté et une raison) et « a changelog is cut where the installed version begins » (un changelog est coupé là où commence la version installée) testent les fonctions pures.

## Pour aller plus loin

- La raison est indexée par nom et par versions, pas par écosystème. Deux écosystèmes avec un paquet du même nom et le même saut la partageraient ; ajouter l’écosystème à la clé les séparerait.
- La raison ne change pas quand votre code change. Si vous commencez à utiliser une API que la prochaine version majeure retire, la raison stockée ne le saura pas. Une clé qui inclut un hash des lignes d’import redemanderait quand elles changent.
- Le guide suivant est l’autre bout de la liste : les mises à jour qui ne demandent aucune lecture, et le bouton qui les monte.
