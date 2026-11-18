---
title: Des outils pour Claude
description: 'Comment Narsil Check donne à Claude quatre outils sur la liste des tâches avec $.tool.register, les sert depuis des hooks tool.call, et comment le modèle décide quand les utiliser.'
route: check
order: 17
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/todos.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/todos.test.tsx
---

## Ce que ça fait

La liste des tâches en attente du guide précédent est utile depuis le panneau. Elle l’est davantage si vous pouvez aussi dire à Claude « note dans les tâches que le test de connexion est instable » au milieu d’une tâche, ou « fais la tâche du README », et que Claude la trouve, la fait et la raye.

Narsil Check donne pour cela quatre outils à Claude :

| Outil                  | Ce qu’il fait                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| `todo_list`            | Liste les tâches de ce projet : id, nom et contenu de chacune.                              |
| `todo_add`             | Ajoute une tâche avec un nom et un contenu facultatif.                                      |
| `todo_done`            | Supprime une tâche terminée, désignée par son id ou son nom exact.                          |
| `todo_add_to_template` | Ajoute une tâche à la liste d’un autre projet, en général le modèle dont celui-ci est issu. |

Claude les voit sous la forme `mcp__narsil-check__todo_list` et ainsi de suite. Une tâche que Claude ajoute apparaît tout de suite dans le panneau, et une tâche que vous ajoutez dans le panneau est dans le `todo_list` suivant. Ils partagent une seule liste et un seul auteur des écritures.

Le quatrième outil a sa propre commande. Quand vous faites dans un projet quelque chose que le modèle dont il est issu devrait aussi recevoir, comme une mise à jour délicate, vous dites :

```text
/narsil-check template "in acme-template create the task of raising TypeScript to the next major, explain what we had to do"
```

Claude trouve le dossier du modèle à côté de ce projet, écrit l’explication (il sait comment le travail a été fait ; le panneau, non), et y ajoute la tâche. S’il ne trouve aucun dossier, ou plusieurs qui se ressemblent, il vous demande lequel.

## Comment ça marche à l’intérieur

### Deux moitiés : déclarer et servir

L’outil d’un mod a deux parties, et les types 2.1.325 décrivent les deux sous `$.tool.register` :

- **Le déclarer** : `$.tool.register({ name, description, inputSchema })` « Declares a tool the model can call from the next prompt on » (déclare un outil que le modèle peut appeler à partir du prompt suivant). Il renvoie le nom complet, `mcp__<plugin>__<name>`.
- **Le servir** : « Serve it with a `tool.call` hook on `{ tool: "mcp__<plugin>__<name>" }` that returns the result (a call no hook answers fails) » (servez-le avec un hook `tool.call` sur `{ tool: "mcp__<plugin>__<name>" }` qui renvoie le résultat ; un appel auquel aucun hook ne répond échoue).

Le mod déclare donc quatre outils dans `registerTools`, et ajoute quatre hooks `on('tool.call', { tool: … }, …)` qui leur répondent. Les types ajoutent que l’enregistrement « Rejects until the session binds, at `session.start` » (est rejeté tant que la session n’est pas liée, à `session.start`), et c’est pourquoi `registerTools` est appelé depuis le hook `session.start`. Il n’y est pas attendu, et son échec est intercepté : si les outils ne peuvent pas être enregistrés, le reste du panneau fonctionne encore.

### Les déclarations

Les noms viennent de constantes dans `hooks/todos.ts`. Les descriptions et les schémas sont dans `hooks/register.tsx`, cités ici depuis [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later) :

```ts
await $.tool.register({
  name: TOOL_LIST,
  description:
    "List this project's pending tasks (the Narsil Check pane's Pendientes): id, name and content of each.",
})
await $.tool.register({
  name: TOOL_ADD,
  description:
    "Add a task to this project's Pendientes list in the Narsil Check pane. Use it when the user asks to note something to do later.",
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Short task name' },
      content: { type: 'string', description: 'Optional details' },
    },
    required: ['name'],
  },
})
await $.tool.register({
  name: TOOL_DONE,
  description:
    "Remove a finished task from this project's Pendientes list. Call it when you complete a task that is on the list.",
  inputSchema: {
    type: 'object',
    properties: { task: { type: 'string', description: 'The task id, or its exact name' } },
    required: ['task'],
  },
})
```

Traduction en français des descriptions : `todo_list`, « liste les tâches en attente de ce projet (les Pendientes du panneau Narsil Check) : id, nom et contenu de chacune » ; `todo_add`, « ajoute une tâche à la liste Pendientes de ce projet dans le panneau Narsil Check. Utilise-le quand l’utilisateur demande de noter quelque chose à faire plus tard », avec `name` « nom court de la tâche » et `content` « détails facultatifs » ; `todo_done`, « supprime une tâche terminée de la liste Pendientes de ce projet. Appelle-le quand tu termines une tâche qui est sur la liste », avec `task` « l’id de la tâche, ou son nom exact ».

Reformaté. `todo_list` n’a pas d’`inputSchema` ; les types disent qu’il vaut par défaut `{ type: "object" }`, un appel sans arguments. `todo_add_to_template` prend `template` (« Folder name beside this project, or absolute path », nom de dossier à côté de ce projet, ou chemin absolu), `name` et `content` (« What to do and how it was done here: changes, files, problems and fixes », ce qu’il faut faire et comment cela a été fait ici : changements, fichiers, problèmes et corrections), `template` et `name` étant obligatoires. Sa description nomme un dossier de modèle d’exemple, `backendTemplate`.

### Servir un appel

Chaque hook lit les arguments dans l’événement lui-même : les types décrivent l’entrée de `tool.call` comme portant ses propres clés « beside the tool's own arguments » (à côté des propres arguments de l’outil), si bien que le `name` de `todo_add` est `e.name`. Le hook les vérifie, fait le travail via les mêmes fonctions qu’utilise le panneau (`addTodo`, `finishTodo`, `readTodoFile`), et répond sous l’une de deux formes :

- `{ result: text }` : la sortie de l’outil, que lit le modèle.
- `{ deny: text }` : selon les mots des types, « Refuses the call: the model receives the text as an error result » (refuse l’appel : le modèle reçoit le texte comme un résultat d’erreur).

Le commentaire du mod consigne un piège : « An MCP-style { content, isError } object is refused by the engine. » (un objet { content, isError } de style MCP est refusé par le moteur). La réponse est `result` ou `deny`, rien d’autre.

Les réponses sont de courtes phrases en anglais sur lesquelles le modèle peut agir :

- `todo_add` : `Added [mh3k2a1b4c9z] Review the README.` (tâche ajoutée).
- `todo_done` avec une tâche inconnue : `No pending task "readme". Call todo_list to see them.` (aucune tâche en attente « readme » ; appelez todo_list pour les voir), comme erreur.
- `todo_list` sur une liste vide : `No pending tasks.` (aucune tâche en attente).

Chaque hook s’exécute dans `answered`, qui transforme toute erreur levée (un fichier qui ne peut pas être lu ou écrit) en `{ deny: 'The Pendientes list could not be changed: …' }` (la liste Pendientes n’a pas pu être modifiée). Sans cela, une écriture ratée serait un appel d’outil raté sans explication. Avec cela, Claude lit pourquoi et peut vous le dire.

Quand le changement a rencontré une liste endommagée (le guide précédent), la réponse porte la note du panneau après `Note for the user:`, pour que Claude la transmette. `todo_list` sur un fichier endommagé refuse avec « cannot be read (…). Tell the user; a change will keep a copy of it and start a new list. » (ne peut pas être lu (…). Dites-le à l’utilisateur ; un changement en gardera une copie et commencera une nouvelle liste).

### Pourquoi donner des outils au modèle

Claude pouvait déjà modifier `.atl/narsil-check/pendientes.json` avec ses outils de fichiers. Cela fonctionnerait en général, et cela sauterait tout ce qu’a construit le guide précédent : la chaîne qui met les changements en série, la relecture avant l’écriture, la copie d’un fichier endommagé, la ligne d’exclusion. Il pourrait aussi écrire une forme que le lecteur rejette.

Un outil fait des règles de la liste la seule porte d’entrée. Claude n’a pas besoin de connaître le format, le chemin ni les règles de sécurité ; il dit « ajoute ceci » et le mod le fait de la même façon que le panneau. Le résultat est aussi vérifiable : le texte de l’outil dit ce qui a changé, avec l’id.

Il y a une seconde raison, propre à l’outil du modèle : il atteint un autre dossier. `templateDir` fait correspondre un nom à un dossier à côté de ce projet, sans tenir compte de la casse, des tirets, des tirets bas ni des espaces, d’abord exactement et sinon par inclusion. Il refuse avec une question quand il n’y en a aucun ou plusieurs : « Several folders in … match "…": a, b. Ask the user which one. » (plusieurs dossiers dans … correspondent à « … » : a, b. Demandez à l’utilisateur lequel). Une règle comme celle-là est bien plus facile à tenir dans le code que dans un prompt.

### Comment Claude décide de les utiliser

Le modèle choisit un outil d’après ce qu’il lit à son sujet. Trois choses façonnent ce choix ici.

**La description dit quand, pas seulement quoi.** `todo_add` se termine par « Use it when the user asks to note something to do later » (utilise-le quand l’utilisateur demande de noter quelque chose à faire plus tard). `todo_done` dit « Call it when you complete a task that is on the list » (appelle-le quand tu termines une tâche qui est sur la liste). Cette seconde phrase est ce qui fait que Claude raye une tâche de lui-même quand il termine le travail, comme le promet le README : « la tacha él mismo al terminarla » (« il la raye lui-même quand il la termine »).

**Les outils attendent derrière ToolSearch.** Le mod ne passe aucun `isDeferred`. Les types disent qu’en son absence « the engine's rule places it: behind ToolSearch, as it places an MCP server's tool » (la règle du moteur le place : derrière ToolSearch, comme il place l’outil d’un serveur MCP). Le modèle voit le nom de l’outil dans une liste d’outils différés, et ne charge le schéma complet que quand il le cherche. Les quatre outils ne coûtent donc presque aucun contexte tant qu’on n’en a pas besoin. Le commentaire du mod le dit directement, « behind ToolSearch, so they cost nothing until used » (derrière ToolSearch, si bien qu’ils ne coûtent rien tant qu’ils ne sont pas utilisés), et le README : « No las lee en cada mensaje, así que no gastan contexto hasta que las usa » (« il ne les lit pas à chaque message, si bien qu’elles ne consomment pas de contexte tant qu’il ne les utilise pas »). La contrepartie est une étape de recherche la première fois. Des noms comme `todo_add` dans un serveur nommé `narsil-check` rendent cette recherche facile.

**La commande nomme l’outil.** `/narsil-check template "…"` n’appelle pas l’outil lui-même. Elle soumet un prompt avec `$.prompt.submit`, construit par `templatePrompt`, qui dit quel outil utiliser (`mcp__narsil-check__todo_add_to_template`), que le modèle est un nom de dossier à côté de ce projet ou un chemin absolu, de mettre dans le contenu ce qui a été changé, dans quels fichiers, ce qui a échoué et comment cela a été résolu, et de demander si l’outil ne trouve pas le modèle. La demande de la personne y figure entre guillemets. Le mod confie la partie que seul Claude peut faire, l’explication, et garde la partie que le code fait mieux, trouver le dossier et écrire le fichier.

Rien de tout cela n’oblige à un appel. Le modèle peut encore répondre sans l’outil, ou demander d’abord. Les descriptions font du bon appel le choix évident.

## Le construire avec Claude

Demandez à Claude de donner au modèle des outils sur la liste que le panneau garde déjà. L’idée que Claude doit bien saisir : chaque outil est à la fois déclaré et servi, et chaque outil passe par la même fonction de changement que celle qu’utilise le panneau.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon mod Claude Code `my-panel`, donne à Claude des outils sur la liste des tâches que je tiens déjà dans `.atl/my-panel/todos.json`. Dans `session.start`, sans l’attendre et en interceptant son échec, appelle trois fois `$.tool.register` : `todo_list` (sans entrée), `todo_add` (`name` obligatoire, `content` facultatif) et `todo_done` (`task`, un id ou un nom exact). Écris chaque description pour dire quand l’utiliser : « Use it when the user asks to note something to do later », « Call it when you complete a task that is on the list ». Ne mets pas `isDeferred`. Sers chacun avec `on('tool.call', { tool: 'mcp__my-panel__todo_add' }, …)`, en lisant les arguments dans l’événement, et passe par la même fonction de changement qu’utilise le panneau. Réponds `{ result: text }` avec une courte phrase qui inclut l’id de la tâche, ou `{ deny: text }` pour une entrée incorrecte ou toute erreur levée, jamais un `{ content, isError }` de style MCP. Teste chaque outil en l’appelant avec `$.tool.call` et en vérifiant le fichier et le texte.

### Ce qu’il faut vérifier dans la réponse de Claude

1. Les outils sont enregistrés avec `$.tool.register` depuis `session.start`, sans attendre l’appel, et un échec est intercepté pour que le panneau fonctionne quand même.
2. Chaque nom déclaré a son propre hook `tool.call`, filtré sur le nom complet `mcp__<plugin>__<name>`.
3. Chaque hook répond `{ result: text }` ou `{ deny: text }`, jamais un `{ content, isError }` à la manière de MCP, et toute erreur levée devient un `deny` avec sa cause.
4. Chaque description dit quand utiliser l’outil, pas seulement ce qu’il fait.
5. Les hooks ajoutent, terminent et lisent les tâches avec les mêmes fonctions que celles qu’utilise le panneau. Aucun outil n’écrit le fichier à sa manière.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « j’ai demandé à Claude de noter une tâche et l’appel d’outil a échoué sans raison ».

### Comment l’auteur l’a demandé

La demande d’origine pour ces outils n’a pas été consignée. Aucun journal de tâches public de narsil-check ne couvre la liste des tâches en attente ni ses outils. Ce qui suit est une reconstitution.

#### Reconstitution à partir de l’historique des commits

À partir de `git log -S tool.register` sur `hooks/register.tsx` et de `git log -- hooks/todos.ts` dans narsil-check :

- `5439638` (2026-11-05) « feat: Pendientes, a per-project task list Claude can read and finish » (Pendientes, une liste de tâches par projet que Claude peut lire et terminer). Le seul commit qui ajoute `$.tool.register`. Son message : « Claude gets todo_list, todo_add and todo_done, and /narsil-check template "…" asks Claude to add a task, with how the work was done, to a template's list through todo_add_to_template. » (Claude reçoit todo_list, todo_add et todo_done, et /narsil-check template « … » demande à Claude d’ajouter une tâche, avec la façon dont le travail a été fait, à la liste d’un modèle via todo_add_to_template). La liste et les outils ont été construits ensemble, si bien que le panneau et Claude ont partagé un même auteur des écritures dès le début.
- `8dc7904` (2026-11-05) « fix: keep a damaged Pendientes list and never let side steps block a save » (garder une liste Pendientes endommagée et ne jamais laisser les étapes secondaires bloquer un enregistrement). Pour les outils : « Claude's tools return a readable error on any file failure » (les outils de Claude renvoient une erreur lisible pour tout échec de fichier). C’est de là que vient `answered`.

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide. Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

Voici une version réduite de l’idée, écrite pour ce guide et vérifiée par rapport aux types de Claude Code 2.1.325 (`$.tool.register`, `on('tool.call', { tool }, …)`, les réponses `result` et `deny`). Elle est adaptée de `registerTools` et des hooks `tool.call` dans `hooks/register.tsx` dans [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). `change` et `Task` sont ceux du code du guide précédent, supposés dans `./todos`.

```ts
import type { EngineInterface, Register } from 'claude-code'
import { change, type Task } from './todos'

const PLUGIN = 'my-panel'

type Answer = { result: string } | { deny: string }

async function answered(fn: () => Promise<Answer>): Promise<Answer> {
  try {
    return await fn()
  } catch (err) {
    return {
      deny: `The list could not be changed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

async function registerTools($: EngineInterface): Promise<void> {
  await $.tool.register({
    name: 'todo_add',
    description:
      "Add a task to this project's to-do list. Use it when the user asks to note something to do later.",
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Short task name' } },
      required: ['name'],
    },
  })
  await $.tool.register({
    name: 'todo_done',
    description:
      "Remove a finished task from this project's to-do list. Call it when you complete a task that is on the list.",
    inputSchema: {
      type: 'object',
      properties: { task: { type: 'string', description: 'The task id, or its exact name' } },
      required: ['task'],
    },
  })
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    void registerTools($).catch(() => undefined)
    return next(e)
  })

  on('tool.call', { tool: `mcp__${PLUGIN}__todo_add` }, async ($, e) =>
    answered(async () => {
      const name = (e as unknown as { name?: unknown }).name
      if (typeof name !== 'string' || !name.trim()) return { deny: 'A task needs a name.' }
      const task: Task = { id: Date.now().toString(36), name: name.trim() }
      await change($, await $.session.cwd(), (tasks) => [...tasks, task])
      return { result: `Added [${task.id}] ${task.name}.` }
    }),
  )

  on('tool.call', { tool: `mcp__${PLUGIN}__todo_done` }, async ($, e) =>
    answered(async () => {
      const ref = String((e as unknown as { task?: unknown }).task ?? '').trim()
      let removed: Task | undefined
      await change($, await $.session.cwd(), (tasks) => {
        removed =
          tasks.find((t) => t.id === ref) ??
          tasks.find((t) => t.name.toLowerCase() === ref.toLowerCase())
        return tasks.filter((t) => t !== removed)
      })
      return removed
        ? { result: `Removed [${removed.id}] ${removed.name}.` }
        : { deny: `No task "${ref}".` }
    }),
  )
}
```

Utilisez le niveau supérieur git du projet au lieu de `$.session.cwd()` si votre liste vit là, comme le fait le guide précédent.

## Erreurs fréquentes et comment tester

Elles viennent du code et des tests de Narsil Check :

- **Enregistrer avant que la session soit liée.** `$.tool.register` est rejeté jusqu’à `session.start`. Enregistrez là.
- **Déclarer sans servir.** « a call no hook answers fails » (un appel auquel aucun hook ne répond échoue). Chaque nom a besoin de son hook `tool.call`, associé au nom complet `mcp__<plugin>__<name>`.
- **Répondre sous la forme de MCP.** `{ content, isError }` est refusé. Utilisez `result` ou `deny`.
- **Laisser une exception s’échapper.** Claude reçoit un échec sans raison. Enveloppez et répondez `deny` avec la cause.
- **Des descriptions qui ne disent que quoi.** Dites aussi quand l’appeler ; c’est sur cela que le modèle agit.
- **Un second auteur des écritures.** Un outil qui écrit le fichier à sa façon contourne les règles de sécurité. Réutilisez la fonction du panneau.
- **Comparer les noms souplement dans le code mais strictement dans la description.** `todo_done` accepte un id ou un nom sans tenir compte de la casse ; son schéma dit « exact name » (nom exact), ce qui garde le modèle précis tandis que le code reste tolérant.

Pour tester, `claude plugin test .` exécute `tests/todos.test.tsx`. « Claude's tools list, add and finish tasks, and a change made elsewhere is kept » (les outils de Claude listent, ajoutent et terminent des tâches, et un changement fait ailleurs est gardé) appelle les outils via `$.tool.call` et vérifie les textes et le fichier, y compris une tâche qu’un autre auteur a ajoutée entre-temps. « Claude is told about a damaged list instead of reading it as empty » (Claude est informé d’une liste endommagée au lieu de la lire comme vide) vérifie le `deny` sur un fichier cassé, et « a list that cannot be written gives Claude a readable error, and the pane a toast » (une liste qui ne peut pas être écrite donne à Claude une erreur lisible, et au panneau un toast) le chemin de `answered`. « a task for a template lands in that folder, and an unclear name asks which one » (une tâche pour un modèle atterrit dans ce dossier, et un nom peu clair fait demander lequel), « a template named by its absolute path is used as given; an unknown one asks the user » (un modèle nommé par son chemin absolu est utilisé tel quel ; un modèle inconnu fait poser la question à l’utilisateur) et « /narsil-check template hands the request to Claude, who knows how the work was done » (/narsil-check template confie la demande à Claude, qui sait comment le travail a été fait) couvrent l’outil du modèle et sa commande.

## Pour aller plus loin

- `$.tool.register` accepte aussi `isDeferred: false`, qui place le schéma d’un outil dans la liste d’outils du prompt. Cela ne vaut la peine que pour un outil dont le modèle a besoin à presque chaque tour.
- Un outil `todo_update` qui modifie le contenu d’une tâche permettrait à Claude d’ajouter ce qu’il a appris en y travaillant.
- Le même schéma sert pour toute donnée du panneau sur laquelle le modèle devrait agir : un outil qui lit les vulnérabilités du guide 14 permettrait à Claude d’ouvrir une PR de correction à partir d’elles.
- Le guide suivant, le dernier de ce parcours, revient aux mises à jour, pour le cas le plus difficile : Kotlin, Gradle et l’Android Gradle Plugin.
