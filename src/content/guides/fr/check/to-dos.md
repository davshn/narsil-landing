---
title: Les tâches en attente
description: 'Comment Narsil Check tient une liste de tâches par projet dans un fichier JSON non suivi, la garde hors de git, et n’écrase jamais une liste endommagée sans en faire une copie.'
route: check
order: 15
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/todos.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: README.md
  - repo: check
    path: tests/todos.test.tsx
---

## Ce que ça fait

Pendant que vous travaillez sur une chose, vous pensez à trois autres : un README à relire, une mise à jour à essayer plus tard, un test à ajouter. Elles vont quelque part hors du projet, ou elles se perdent. Narsil Check donne à chaque projet sa propre courte liste, dans le panneau, tout en bas.

La section s’appelle **Pendientes** (« en attente ») :

```text
● ▾ Pendientes · 2
  ○ ▾ Raise TypeScript to the next major
       Check moduleResolution first
  ○ Review the README
  [ Nueva tarea (nombre: contenido) ]  Agregar
```

- **Ajouter** : tapez dans le champ et appuyez sur Entrée. Ce qui vient après le premier deux-points est le contenu : `Raise TypeScript: check moduleResolution first`. Sans deux-points, la tâche n’a qu’un nom.
- **Lire** : un appui sur un nom affiche ou masque son contenu. Une tâche sans contenu ne se déplie pas.
- **Terminer** : un appui sur `○` supprime la tâche. Aucun historique des tâches terminées n’est gardé.

Le point est jaune tant que quelque chose attend et gris quand la liste est vide. La section s’ouvre au début d’une session quand la liste contient quelque chose, et reste repliée quand elle est vide. Sur le téléphone, il n’y a pas de champ de texte (l’application mobile n’en dessine pas) ; là, la liste se lit, les tâches se terminent avec `○`, et les nouvelles s’ajoutent via Claude, comme le montre le guide suivant.

La liste appartient au projet, pas à la session ni aux réglages de la machine. C’est un fichier à l’intérieur du projet, et il n’atteint jamais un commit.

## Comment ça marche à l’intérieur

`hooks/todos.ts` contient les parties simples : où vit le fichier, comment il est lu et écrit, comment une entrée se coupe à son deux-points, et la ligne du fichier d’exclusion de git. `hooks/register.tsx` lit et écrit le fichier et dessine la section.

### Où vit la liste

Le fichier est `.atl/narsil-check/pendientes.json`, sous la racine du projet. La racine est le niveau supérieur de git (`git rev-parse --show-toplevel`), sinon le dossier de la session. Utiliser le niveau supérieur de git signifie que la même liste est trouvée depuis n’importe quel sous-dossier où vous ouvrez la session.

Le format est un petit JSON :

```json
{
  "version": 1,
  "tasks": [
    { "id": "mh3k2a1b4c9z", "name": "Review the README" },
    { "id": "mh3k2f9x0q1w", "name": "Raise TypeScript", "content": "Check moduleResolution first" }
  ]
}
```

Le champ `version` est écrit mais pas encore lu ; il laisse la place pour changer le format plus tard. Chaque `id` est l’heure en base 36 plus quatre caractères aléatoires, si bien que deux tâches du même nom restent distinctes et que Claude peut en nommer une exactement. Les ids ci-dessus sont inventés.

Pourquoi un fichier et pas `$.store` ? Le stockage appartient au mod sur cette machine. Un fichier dans le projet appartient au projet : vous pouvez l’ouvrir, le modifier à la main, le sauvegarder, et il se déplace avec le dossier. Et il permet à un projet d’écrire dans la liste d’un autre projet, ce qu’utilise le guide suivant.

### La garder hors de git

La liste est personnelle ; une pull request ne devrait jamais la transporter. L’ajouter à `.gitignore` modifierait un fichier suivi et mettrait ce changement sous les yeux de tout le monde. Le mod utilise donc à la place le fichier d’exclusion local de git, qui fonctionne comme `.gitignore` mais n’est jamais commité.

`excludeTodos` demande à git où se trouve ce fichier, avec `git rev-parse --git-path info/exclude`, plutôt que de supposer `.git/info/exclude`. Dans un worktree lié, `.git` est un fichier, pas un dossier, et git répond avec le bon emplacement. Ensuite, `withExclude` ajoute la ligne `/.atl/narsil-check/` sauf si le fichier l’a déjà (ou `.atl/narsil-check` ou `.atl/narsil-check/`), en gardant un saut de ligne final.

Cela s’exécute à chaque changement, et on peut le répéter sans risque : la ligne est ajoutée une seule fois. Le README dit « La primera vez » (« la première fois »), ce que vous voyez, puisque les exécutions suivantes ne changent rien.

C’est aussi une préoccupation secondaire. Si le fichier d’exclusion ne peut pas être écrit, l’erreur est avalée et la tâche est quand même enregistrée. Le README le dit : « Si ese archivo no se puede escribir, la tarea se guarda igual. » (« si ce fichier ne peut pas être écrit, la tâche est enregistrée quand même. »). Un dossier qui n’est pas un dépôt git n’a rien à exclure, et l’étape est sautée.

### Des écritures sûres : un changement à la fois, sur le fichier tel qu’il est maintenant

La liste peut changer depuis trois endroits : le champ du panneau, le bouton `○` et les outils de Claude. Claude peut être en train d’ajouter une tâche pendant que vous en terminez une autre. Et une autre session sur le même projet peut avoir écrit le fichier depuis que celle-ci l’a lu.

`changeTodos` gère cela avec deux règles :

1. **Un changement à la fois dans la session.** Chaque changement est enchaîné sur une seule promesse, `todoChain`. Un changement attend que le précédent se termine, si bien que deux écritures ne s’entremêlent jamais.
2. **Lire juste avant d’écrire.** Chaque changement relit le fichier, applique sa modification (en ajouter une, en supprimer une) à ce qui s’y trouve maintenant, et réécrit toute la liste. Une tâche qu’une autre session a enregistrée il y a une minute est gardée.

La chaîne survit à un changement raté : elle continue à partir de `run.catch(() => undefined)`, si bien qu’une erreur ne bloque pas tous les enregistrements suivants.

Ce que cela ne protège pas, et le README est honnête à ce sujet : deux sessions du même projet qui écrivent au même instant. La dernière écriture peut alors écraser l’autre. Les écritures ne sont pas atomiques non plus : `$.fs.write` remplace tout le contenu du fichier, comme le disent les types (« the whole new content », tout le nouveau contenu) ; il n’y a ni fichier temporaire ni renommage. Pour une courte liste personnelle, c’est une limite raisonnable.

### Un fichier endommagé n’est jamais lu comme vide

Supposons que vous modifiiez le fichier à la main et laissiez une virgule finale. Un lecteur négligent verrait un JSON invalide, le traiterait comme une liste vide, et le changement suivant écrirait une nouvelle liste par-dessus vos tâches.

`parseTodoFile` distingue les cas. Un fichier vide ou absent est une liste vide. Un fichier qui n’est pas du JSON donne `{ error: 'no es JSON válido' }` (« n’est pas du JSON valide »), et un fichier sans tableau `tasks` donne `{ error: 'no tiene la lista "tasks"' }` (« n’a pas la liste "tasks" »). Les entrées sans nom sont écartées ; le reste est gardé.

En cas d’erreur, deux choses se passent :

- **À la lecture**, le panneau affiche l’erreur en rouge, `.atl/narsil-check/pendientes.json no se puede leer (…). No lo toco: …`, ce qui signifie « ne peut pas être lu (…). Je n’y touche pas : corrigez-le, ou ajoutez une tâche et je garderai une copie du fichier avant de commencer une nouvelle liste ». Rien n’est écrit.
- **Au changement suivant**, le texte endommagé est d’abord copié à côté sous le nom `pendientes.danado-<moment>.json` (`danado` signifie « endommagé »), nommé d’après l’heure ISO avec `:` et `.` remplacés, comme `pendientes.danado-2026-11-17T09-30-00-000Z.json`. Ensuite, une nouvelle liste commence avec le changement, et le panneau affiche une note jaune qui dit où se trouve la copie.

Cela vient d’un bug. Le commit de correction `8dc7904` le décrit : « A list file that is not valid JSON was read as empty and overwritten by the next change. » (un fichier de liste qui n’était pas du JSON valide était lu comme vide et écrasé par le changement suivant).

La copie est dans le même dossier exclu, elle n’atteint donc pas git non plus.

### Quand elle est lue

`loadTodos` s’exécute au début de la session, et de nouveau chaque fois que vous dépliez la section, si bien qu’un changement fait par une autre session ou à la main apparaît quand vous regardez. Chaque changement met directement à jour l’atome du panneau avec la liste qu’il vient d’écrire, mais seulement quand le changement portait sur la liste de ce projet : une tâche écrite dans la liste d’un autre projet ne remplace pas ce qu’affiche ce panneau.

## Comment on l’a demandé à l’IA

La demande d’origine pour cette fonctionnalité n’a pas été consignée. Aucun journal de tâches public de narsil-check ne couvre la liste des tâches en attente. Ce qui suit est une reconstitution.

### Reconstitution à partir de l’historique des commits

À partir de `git log -- hooks/todos.ts` dans narsil-check :

- `5439638` (2026-11-05) « feat: Pendientes, a per-project task list Claude can read and finish » (Pendientes, une liste de tâches par projet que Claude peut lire et terminer). Son message décrit toute la conception d’un coup : les tâches « in .atl/narsil-check/pendientes.json, kept out of git through .git/info/exclude » (dans .atl/narsil-check/pendientes.json, gardées hors de git via .git/info/exclude), le champ qui ajoute « nombre: contenido » (« nom : contenu »), et « every change rereads the file, so edits during a turn or from another session are kept » (chaque changement relit le fichier, si bien que les modifications faites pendant un tour ou depuis une autre session sont gardées). Les outils de Claude et la commande de modèle arrivent dans le même commit.
- `8dc7904` (2026-11-05) « fix: keep a damaged Pendientes list and never let side steps block a save » (garder une liste Pendientes endommagée et ne jamais laisser les étapes secondaires bloquer un enregistrement). Le même jour. Son message liste les corrections : le fichier endommagé est « reported in the pane and to Claude, left untouched, and copied aside » (signalé dans le panneau et à Claude, laissé intact, et copié à part) avant une nouvelle liste ; « A git exclude file that cannot be written no longer stops the save » (un fichier d’exclusion de git qui ne peut pas être écrit n’arrête plus l’enregistrement) ; le panneau mobile « decides by surface whether to draw the field » (décide selon la surface s’il dessine le champ) ; « and the README no longer promises safety for two sessions writing at once » (et le README ne promet plus de sécurité pour deux sessions qui écrivent en même temps).

Le second commit est le plus instructif. La première version fonctionnait dans le cas idéal. La correction est une liste de ce qui peut mal tourner autour d’un fichier : il peut être cassé, une étape secondaire peut échouer, une surface peut ne pas avoir un élément, et une promesse du README peut être trop forte.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon mod Claude Code `my-panel`, ajoute une section de tâches en attente tenue par projet dans `.atl/my-panel/todos.json` sous le niveau supérieur de git (`git rev-parse --show-toplevel`, sinon le dossier de la session), sous la forme `{ "version": 1, "tasks": [{ "id", "name", "content"? }] }`. Dessine chaque tâche avec un bouton `○` qui la supprime, un nom qui affiche ou masque son contenu, et un `Input` qui ajoute `name: content`, coupé au premier deux-points ; n’affiche pas l’`Input` sur la surface mobile. Garde le dossier hors de git en ajoutant `/.atl/my-panel/` au fichier que nomme `git rev-parse --git-path info/exclude`, une seule fois, et ne laisse jamais cette étape arrêter un enregistrement. Fais passer chaque changement par une seule chaîne de promesses, et relis le fichier avant chaque écriture. Si le fichier n’est pas du JSON valide ou n’a pas de tableau `tasks`, ne le traite jamais comme vide : affiche une erreur, et au changement suivant copie-le dans `todos.damaged-<ISO time>.json` avant de commencer une nouvelle liste. Teste un fichier endommagé, un fichier d’exclusion qui ne peut pas être écrit, et un changement fait par un autre auteur entre deux des tiens.

## Le code minimal

Voici une version réduite de l’idée, écrite pour ce guide et vérifiée par rapport aux types de Claude Code 2.1.325 (`$.fs.exists`, `$.fs.read`, `$.fs.write`, `$.process.run`). Elle est adaptée de `hooks/todos.ts` et de `changeTodos` dans `hooks/register.tsx` dans [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Elle reçoit la racine du projet déjà connue et laisse de côté le dessin.

```ts
import type { EngineInterface } from 'claude-code'

export type Task = { id: string; name: string; content?: string }

const DIR = '.atl/my-panel'
const FILE = `${DIR}/todos.json`

// A missing or empty file is an empty list; anything else unreadable is an error.
export function parseFile(text: string | undefined): { tasks: Task[] } | { error: string } {
  if (!text?.trim()) return { tasks: [] }
  try {
    const tasks = (JSON.parse(text) as { tasks?: unknown })?.tasks
    if (!Array.isArray(tasks)) return { error: 'no "tasks" list' }
    return {
      tasks: tasks.filter((t): t is Task => typeof t?.name === 'string' && t.name.trim() !== ''),
    }
  } catch {
    return { error: 'not valid JSON' }
  }
}

async function exclude($: EngineInterface, root: string): Promise<void> {
  const ran = await $.process.run(['git', 'rev-parse', '--git-path', 'info/exclude'], { cwd: root })
  if (ran.exitCode !== 0) return
  const rel = ran.stdout.trim().replace(/\\/g, '/')
  const path = /^([A-Za-z]:)?\//.test(rel) ? rel : `${root}/${rel}`
  const text = (await $.fs.exists(path)) ? await $.fs.read(path) : ''
  if (text.split(/\r?\n/).some((l) => l.trim() === `/${DIR}/`)) return
  await $.fs.write(path, `${text}${text === '' || text.endsWith('\n') ? '' : '\n'}/${DIR}/\n`)
}

let chain: Promise<unknown> = Promise.resolve()

export function change(
  $: EngineInterface,
  root: string,
  edit: (tasks: Task[]) => Task[],
): Promise<string | undefined> {
  const run = chain.then(async () => {
    const path = `${root}/${FILE}`
    const text = (await $.fs.exists(path)) ? await $.fs.read(path) : undefined
    const file = parseFile(text)
    let notice: string | undefined
    if ('error' in file) {
      const copy = `${DIR}/todos.damaged-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      await $.fs.write(`${root}/${copy}`, text ?? '')
      notice = `The list was damaged (${file.error}); a copy is in ${copy}.`
    }
    const tasks = edit('error' in file ? [] : file.tasks)
    await exclude($, root).catch(() => undefined)
    await $.fs.write(path, `${JSON.stringify({ version: 1, tasks }, null, 2)}\n`)
    return notice
  })
  chain = run.catch(() => undefined)
  return run
}
```

Ajoutez une tâche avec `change($, root, tasks => [...tasks, task])` et terminez-en une avec `change($, root, tasks => tasks.filter(t => t.id !== id))`, puis écrivez la nouvelle liste dans votre atome pour que le panneau se redessine.

## Erreurs fréquentes et comment tester

Elles viennent du code et des tests de Narsil Check :

- **Lire un fichier cassé comme vide.** L’enregistrement suivant détruit les tâches. Distinguez « vide » d’« illisible », et faites une copie avant de remplacer.
- **Écrire de mémoire.** Une liste gardée dans l’état du panneau et réécrite perd ce qu’un autre auteur a ajouté. Relisez le fichier juste avant chaque écriture.
- **Deux écritures à la fois.** Le champ et l’outil de Claude peuvent se déclencher ensemble. Enchaînez-les.
- **Modifier `.gitignore`.** C’est un fichier partagé et suivi. Utilisez le fichier d’exclusion local.
- **Supposer que `.git` est un dossier.** Dans un worktree, il ne l’est pas. Demandez le chemin à git.
- **Laisser une étape secondaire bloquer la principale.** La ligne d’exclusion est un plus ; l’enregistrement est l’essentiel.
- **Dessiner un élément que la surface n’a pas.** Vérifiez qu’`Input` existe, et décidez selon la surface.

Pour tester, `claude plugin test .` exécute `tests/todos.test.tsx`. « the list file is read leniently and an entry splits at its first colon » (le fichier de liste est lu avec indulgence et une entrée se coupe à son premier deux-points) et « the exclude line is added once, and a template is found by its folder name » (la ligne d’exclusion est ajoutée une seule fois, et un modèle est trouvé par le nom de son dossier) testent les parties pures. « Pendientes starts folded when empty; a task added in the field is saved, kept out of git, and shown » (Pendientes commence replié quand il est vide ; une tâche ajoutée dans le champ est enregistrée, gardée hors de git et affichée) pilote le champ et vérifie le fichier et la ligne d’exclusion. « a damaged list is left as it is and said so; the next change keeps a copy of it before starting a new list » (une liste endommagée est laissée telle quelle et le panneau le dit ; le changement suivant en garde une copie avant de commencer une nouvelle liste), « a git exclude file that cannot be written does not stop the task from being saved » (un fichier d’exclusion de git qui ne peut pas être écrit n’empêche pas la tâche d’être enregistrée) et « the mobile app has no text field: an empty list says so, and tasks still finish with ○ » (l’application mobile n’a pas de champ de texte : une liste vide le dit, et les tâches se terminent toujours avec ○) couvrent les corrections de `8dc7904`.

## Pour aller plus loin

- Écrivez via un fichier temporaire et un renommage si votre liste devient quelque chose de plus précieux.
- Gardez les tâches terminées avec une date au lieu de les supprimer, et affichez les dernières repliées.
- Un fichier de verrou à côté de la liste comblerait le trou des deux sessions qui écrivent au même instant, au prix de la gestion d’un verrou périmé.
- Le guide suivant donne à Claude ses propres outils sur cette liste : lister, ajouter et terminer des tâches, et écrire dans la liste d’un autre projet.
