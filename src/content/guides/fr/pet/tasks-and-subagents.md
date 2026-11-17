---
title: Tâches et sous-agents
description: 'Comment Narsil reconstruit les tâches d’une conversation depuis TodoWrite, TaskCreate, TaskUpdate et le plan de l’application de bureau, et montre chaque sous-agent, son type, son modèle et son temps.'
route: pet
order: 4
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/tasks.ts
  - repo: pet
    path: hooks/agents.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Ce que ça fait

Quand vous ouvrez une conversation dans la bande de Narsil (en appuyant sur son nom, comme l’explique le guide précédent), deux listes apparaissent sous une ligne.

**Ses tâches**, chacune avec une marque indiquant son état :

| Marque | État                                              |
| ------ | ------------------------------------------------- |
| ○      | En attente                                        |
| ◐      | En cours                                          |
| ●      | Terminée (dessinée atténuée)                      |
| ⟳      | S’exécute en arrière-plan après l’arrêt de Claude |

La liste est celle que Claude tient pour lui-même pendant qu’il travaille : la liste de tâches de `TodoWrite`, les tâches de `TaskCreate` et `TaskUpdate`, ou le plan de l’application de bureau. Vous voyez le plan et son avancement sans faire défiler la transcription.

**Ses sous-agents**, un petit serpent pour chacun, avec :

- **Son type**, affiché sous forme d’accessoire : 🐍🔍 Explore, 🐍📜 Plan, 🐍📖 claude-code-guide, 🐍🪞 fork, un 🐍 seul pour general-purpose et 🐍✨ pour tout autre type.
- **Le modèle sur lequel il tourne et depuis combien de temps**, par exemple « 🐍🔍 Explorar el overlay · Haiku 4.5 · 4 min » (« Explorer l’overlay »).
- **Un avertissement quand il devient silencieux** : après cinq minutes sans utiliser d’outil, la pastille passe au jaune et ajoute « sin actividad » (« aucune activité »). Il est peut-être bloqué.
- **La façon dont il s’est terminé**, pendant quelques secondes : « ✓ … · terminado en 1 min 20 s » (terminé en), « ✗ … · falló » (a échoué) ou « ■ … · detenido » (arrêté).

Un sous-agent qui s’est exécuté en arrière-plan est aussi annoncé à sa fin, par la voix de Narsil et dans la fenêtre flottante.

Comme chaque conversation signale ses tâches et ses sous-agents au hub, vous pouvez ouvrir la ligne d’une autre conversation et voir son plan et ses sous-agents depuis l’endroit où vous êtes.

## Comment ça marche à l’intérieur

### Les tâches : rejouer les appels des outils

Claude Code ne transmet pas « la liste de tâches » à un mod. Narsil la reconstruit en observant les appels des outils qui en tiennent une, et en appliquant chaque appel à la liste dont elle dispose déjà. La logique est une fonction pure, `applyTaskCall` dans `hooks/tasks.ts` ; le hook de `hooks/register.tsx` ne fait que l’alimenter.

Les outils qu’elle lit (`TASK_TOOLS`) et ce que chaque appel fait à la liste :

- **`TodoWrite`** envoie la liste entière à chaque fois (`todos`, chacune avec `content` et `status`). La liste est remplacée ; les identifiants sont les positions, `1`, `2`, `3`.
- **`TaskCreate`** ajoute une tâche. Son identifiant ne figure pas dans l’entrée : il revient dans le résultat de l’outil (`result.task.id`). Le hook lit donc le résultat, et se replie sur la position suivante quand il n’y en a pas.
- **`TaskUpdate`** modifie une tâche par son `taskId` : un nouveau `status`, un nouveau `subject`, ou `status: 'deleted'`, qui la supprime.
- **`mcp__ccd_turn__update_plan`**, le plan de l’application de bureau (`PLAN_TOOL`). `applyPlan` gère ses différentes formes : `items` remplace la liste ; `advance: true` termine l’étape en cours et démarre la suivante en attente ; `done: [n]` termine des étapes selon leur place, comptée à partir de 1 ; `start: n` déplace la marque « en cours » vers l’étape `n`.
- **`mcp__ccd_turn__wrap_up`**, la case d’étape suivante de l’application de bureau (`WRAP_UP_TOOL`). Elle clôt le tour et, dans l’application, coche le plan sans dernier `update_plan`. Narsil marque donc comme terminées, à ce moment, toutes les tâches en attente ou en cours. C’est le correctif décrit dans « Comment on l’a demandé à l’IA ».

Le hook de `tool.call` ne traite ces outils que pour la conversation principale (`e.agentId === undefined`) et dans un ordre particulier : il attend d’abord `next(e)`, et n’applique l’appel que si le résultat n’est pas une erreur et n’a pas été refusé. Un `TaskUpdate` refusé ne doit pas modifier la liste, et l’identifiant de `TaskCreate` n’existe qu’une fois l’outil exécuté. Ensuite, il écrit l’atome `tasks` et envoie immédiatement l’état au hub.

Le texte est nettoyé à l’entrée : espaces regroupés et coupure à 120 caractères (`clean`), et liste limitée à 30 tâches (`MAX_TASKS`), puisqu’elle voyage vers le hub et le téléphone à chaque battement.

### Le travail d’arrière-plan sous forme de tâches

Quand la boucle principale s’arrête, le hook `classic.Stop` lit `e.background_tasks` : les shells, moniteurs et sous-agents encore en cours. `backgroundTasks` les transforme en lignes supplémentaires avec la marque ⟳, comme « proceso en segundo plano: npm run dev » (« processus en arrière-plan »). Elles sont tenues à part de la liste de tâches et y sont jointes lorsque l’état est signalé (`shownState`), et elles sont effacées au `turn.start` suivant. Le même décompte indique à `turn.complete` de ne pas fêter une fin pendant que le travail continue (voir le premier guide).

### Les sous-agents : trois événements

Les pastilles proviennent de trois événements, et le choix de chacun est délibéré :

- **`agent.spawn`** crée une pastille. Le hook attend `next(e)` et enregistre l’exécution à partir de l’entrée et du résultat : `result.agentId`, `e.description` (la tâche), `e.subagentType`, `e.background` et `result.model`. Il ignore les lancements refusés et les coéquipiers (`e.isTeammate`). Le commentaire de `hooks/register.tsx` explique pourquoi cet événement et non l’appel de l’outil `Agent` : « one in the background returns at once » (un sous-agent en arrière-plan rend la main immédiatement), si bien que la fin de l’appel d’outil ne dit rien du moment où le sous-agent se termine.
- **`tool.call` avec `e.agentId` défini** : le sous-agent a utilisé un outil. `touchAgent` met à jour son `lastActiveAt`. C’est ce qui rend possible « aucune activité » : Narsil connaît le dernier moment où chaque sous-agent a fait quelque chose.
- **`turn.complete` avec `e.agentId` défini** : le tour propre du sous-agent s’est terminé. `endAgent` enregistre `endedAt` et une issue tirée de `e.reason` : `answer` signifie terminé, `aborted` signifie arrêté, tout le reste signifie échec. Un sous-agent d’arrière-plan est annoncé.

Les exécutions vivent dans l’atome `agents`, les pastilles (texte et couleur, prêtes à dessiner) dans `agentChips`.

### Les pastilles sont recalculées à chaque battement

Le temps passe sans aucun événement : un sous-agent qui ne fait rien ne déclenche rien. C’est pourquoi `refreshAgents` s’exécute à chaque battement de deux secondes (`beat`) ainsi qu’après chacun des trois événements. Elle retire les exécutions terminées depuis plus de dix secondes (`liveRuns`, `ENDED_SHOWN_MS`), recalcule chaque pastille avec `agentChip`, et n’écrit l’atome et n’envoie au hub que lorsque le texte ou la couleur d’une pastille a changé.

`agentChip` dans `hooks/agents.ts` construit le texte :

- La marque du type tirée de `TYPE_MARK`, avec ✨ pour les types inconnus.
- La tâche, puis le modèle au moyen de `modelLabel`, qui lit les identifiants et les alias comme le ferait une personne : `claude-opus-5-5` devient « Opus 5.5 », `claude-3-5-sonnet-20241022` devient « Sonnet 3.5 », et `opus[1m]` devient « Opus (1M) ».
- Les minutes, à partir d’une minute.
- « sin actividad » dès que `now - lastActiveAt` atteint `QUIET_MS` (cinq minutes), avec la teinte jaune.
- Pour une exécution terminée, ✓ avec le temps issu de `took`, ✗ ou ■.

Les couleurs se trouvent dans `TONE_COLOR` : gris pour en cours, jaune `#F5B400` pour silencieux, vert pour terminé, rouge pour échec et gris-bleu pour arrêté.

### Pourquoi c’est découpé ainsi

Les deux fichiers, `hooks/tasks.ts` et `hooks/agents.ts`, sont purs : des valeurs simples en entrée, des valeurs simples en sortie, pas de `$`. Le module de hooks possède les événements et les atomes. C’est ce découpage qui permet aux tests de vérifier chaque forme d’outil et chaque texte de pastille sans session, et qui permet à la même liste d’être dessinée par la bande, la fenêtre flottante et la bande d’une autre conversation.

## Comment on l’a demandé à l’IA

### Les tâches : consignées dans le journal fleet-view

La liste de tâches par conversation a été demandée dans `odd/tasks/fleet-view.md` dans narsil-pet. En L2 (extrait), l’auteur ou l’autrice a écrit :

> "al hacer click en el titulo de conversacion deberiamos poder ver sus sub agentes/ tareas y sus respectivos estados"

Traduction en français : cliquer sur le titre d’une conversation devrait montrer ses sous-agents et ses tâches avec leurs états.

Et en L3 (extrait) :

> "cuando entre a una de esas conversaciones estaria de nuevo su contexto, sus tareas con su estado (no es necesario barra de avance) y sus sub agentes"

Traduction en français : en entrant dans l’une de ces conversations, on retrouverait son contexte, ses tâches avec leur état (pas besoin de barre de progression) et ses sous-agents. C’est pourquoi les tâches sont affichées sous forme de marques et non de pourcentage.

L7 consigne le résultat : la conversation ouverte montre ses tâches et ses sous-agents, et « Tasks come from TodoWrite, TaskCreate/TaskUpdate, the desktop app's update_plan (hooks/tasks.ts) and background work at Stop. » (les tâches proviennent de TodoWrite, de TaskCreate/TaskUpdate, de l’update_plan de l’application de bureau, hooks/tasks.ts, et du travail d’arrière-plan au moment de Stop).

Puis l’auteur ou l’autrice a signalé un bogue, L12 :

> "lo unico raro que veo es que las tareas de esta sesion las marca como en curso, o no empezadas, cuando el agente ya acabo, esto pasa en las dos ventanas, ademas note que creaste las tareas de la pwa en este proyecto, debias crearlo en proyecto de la pwa"

Traduction en français : la seule chose étrange est que les tâches de cette session s’affichent comme en cours ou non commencées alors que l’agent a déjà fini, et cela dans les deux fenêtres ; l’auteur ou l’autrice a aussi remarqué que les tâches de suivi de la PWA avaient été créées dans ce projet au lieu du projet de la PWA. (La seconde partie concerne l’endroit où les notes de suivi étaient stockées, pas cette fonctionnalité.)

L13 consigne la cause et le correctif : « the desktop app's `mcp__ccd_turn__wrap_up` checks the plan off with no last `update_plan`; the mod now marks every pending or in-progress task completed on it (hooks/tasks.ts) » (le `mcp__ccd_turn__wrap_up` de l’application de bureau coche le plan sans dernier `update_plan` ; le mod marque désormais à ce moment comme terminée chaque tâche en attente ou en cours, hooks/tasks.ts), avec un test en échec observé d’abord. Le commit est `5e9ca71` (2026-11-06) « fix: check the plan off when the app's next-step box closes the turn » (cocher le plan quand la case d’étape suivante de l’application clôt le tour).

### Les sous-agents : reconstitution à partir de l’historique des commits

La demande d’origine pour les pastilles de sous-agents n’a pas été conservée. D’après `git log -- hooks/agents.ts hooks/register.tsx` :

- `c885292` (2026-10-30) « feat: estimate when the context fills, react to tests and dangerous commands, show subagents » (estimer quand le contexte se remplit, réagir aux tests et aux commandes dangereuses, afficher les sous-agents). Les premières pastilles.
- `e5ba5ca` (2026-10-30) « feat: show each subagent's type, time, quiet spells and outcome » (afficher le type, le temps, les périodes de silence et l’issue de chaque sous-agent). Les marques par type, les minutes, l’avertissement de silence et la fin.
- `f29cb5e` (2026-10-31) « feat: show the model of the main thread and of each subagent » (afficher le modèle du fil principal et de chaque sous-agent). Le libellé du modèle.
- `519dd73` (2026-11-06) « fix: wait for background work before announcing a turn finished » (attendre le travail d’arrière-plan avant d’annoncer la fin d’un tour). Les sous-agents d’arrière-plan deviennent des lignes ⟳.
- `49f0fd9` (2026-11-06) « feat: list every open conversation in the band » (lister chaque conversation ouverte dans la bande). Son message indique qu’ouvrir une ligne montre « its context (the word opens what fills it), its tasks and its subagents » (son contexte, le mot ouvrant ce qui le remplit, ses tâches et ses sous-agents).

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon mod Claude Code, affiche la liste de tâches de la conversation principale dans la bande `AbovePrompt`. Dans `tool.call`, pour les appels `TodoWrite`, `TaskCreate` et `TaskUpdate` sans `agentId`, attends `next(e)` et, si le résultat n’est pas une erreur, applique l’appel à une liste conservée dans un atome : `TodoWrite` la remplace, `TaskCreate` ajoute la tâche avec l’identifiant issu de son résultat, `TaskUpdate` en modifie ou en supprime une par son `taskId`. Garde cette logique sous forme de fonction pure dans `hooks/tasks.ts`, avec des tests pour chaque outil. Affiche aussi une ligne par sous-agent en cours : crée-la sur `agent.spawn` (tâche, `subagentType`, `result.model`), marque-la active sur ses `tool.call`, termine-la sur son `turn.complete`, et recalcule le texte toutes les quelques secondes pour qu’un sous-agent inactif depuis cinq minutes l’indique. Vérifie chaque champ par rapport aux types de plugin-authoring.

## Le code minimal

Écrit pour ce guide et vérifié avec les types 2.1.325. Il est adapté de `hooks/tasks.ts`, `hooks/agents.ts` et `hooks/register.tsx` dans [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). Les atomes `tasks` et `runs` sont déclarés dans `types/index.d.ts` comme dans le premier guide.

Le réducteur pur, `hooks/tasks.ts` :

```ts
export type Task = { id: string; text: string; status: 'pending' | 'in_progress' | 'completed' }

const STATUSES = ['pending', 'in_progress', 'completed']
const statusOf = (v: unknown, fallback: Task['status'] = 'pending') =>
  STATUSES.includes(v as string) ? (v as Task['status']) : fallback

export function applyTaskCall(
  list: readonly Task[],
  tool: string,
  input: Record<string, unknown>,
  result?: unknown,
): readonly Task[] {
  if (tool === 'TodoWrite' && Array.isArray(input.todos)) {
    return (input.todos as Record<string, unknown>[]).map((t, i) => ({
      id: String(i + 1),
      text: String(t.content ?? ''),
      status: statusOf(t.status),
    }))
  }
  if (tool === 'TaskCreate') {
    const task = (result as { task?: { id?: unknown; subject?: unknown } } | undefined)?.task
    const id = task?.id === undefined ? String(list.length + 1) : String(task.id)
    return [
      ...list.filter((t) => t.id !== id),
      { id, text: String(task?.subject ?? input.subject ?? ''), status: 'pending' },
    ]
  }
  if (tool === 'TaskUpdate') {
    const id = String(input.taskId ?? '')
    if (input.status === 'deleted') return list.filter((t) => t.id !== id)
    return list.map((t) => (t.id === id ? { ...t, status: statusOf(input.status, t.status) } : t))
  }
  return list
}
```

Les hooks, dans `hooks/register.tsx` :

```tsx
const TASK_TOOLS = new Set(['TodoWrite', 'TaskCreate', 'TaskUpdate'])
const QUIET_MS = 5 * 60_000

on('tool.call', async ($, e, next) => {
  if (e.agentId !== undefined) {
    const now = await $.clock.now()
    await update($, runs, (list) =>
      list.map((r) => (r.id === e.agentId ? { ...r, lastActiveAt: now } : r)),
    )
    return next(e)
  }
  if (!TASK_TOOLS.has(e.tool)) return next(e)
  const result = await next(e)
  if (!result.isError && !('deny' in result && result.deny)) {
    const input = e as unknown as Record<string, unknown>
    await update($, tasks, (list) =>
      applyTaskCall(list, e.tool, input, 'result' in result ? result.result : undefined),
    )
  }
  return result
})

on('agent.spawn', async ($, e, next) => {
  const result = await next(e)
  if ('deny' in result || e.isTeammate || !result.agentId) return result
  const now = await $.clock.now()
  const run = {
    id: result.agentId,
    task: e.description || 'task',
    type: e.subagentType,
    model: result.model,
    startedAt: now,
    lastActiveAt: now,
  }
  await update($, runs, (list) => [...list.filter((r) => r.id !== run.id), run])
  return result
})

on('turn.complete', async ($, e, next) => {
  const result = await next(e)
  if (e.agentId !== undefined)
    await update($, runs, (list) => list.filter((r) => r.id !== e.agentId))
  return result
})
```

Dans le hook de rendu, une exécution est silencieuse quand `(await $.clock.now()) - run.lastActiveAt >= QUIET_MS`. Narsil conserve aussi les exécutions terminées pendant dix secondes pour montrer comment elles se sont terminées, et recalcule les pastilles sur un battement `$.clock.every`, afin que « aucune activité » apparaisse même quand aucun événement n’arrive. Une version minimale peut faire de même avec `$.clock.every(5000, ...)` mettant à jour un atome que lit la bande.

## Erreurs fréquentes et comment tester

- **Appliquer l’appel avant son exécution.** L’identifiant de `TaskCreate` ne se trouve que dans le résultat, et un appel refusé ou en échec ne doit pas modifier la liste. Attendez `next(e)`, puis appliquez.
- **Suivre les outils de tâches propres aux sous-agents comme s’il s’agissait de la liste principale.** Un sous-agent peut lui aussi appeler `TodoWrite`. Narsil n’applique les appels de tâches que lorsque `e.agentId` est indéfini.
- **Des plans qui ne se terminent jamais.** Dans l’application de bureau, la case d’étape suivante (`mcp__ccd_turn__wrap_up`) clôt le tour et coche le plan sans dernier `update_plan`. Si ce cas n’est pas géré, les dernières étapes restent « en cours » pour toujours (fleet-view L12 et L13, commit `5e9ca71`).
- **Chronométrer les sous-agents à partir de l’appel de l’outil `Agent`.** L’appel d’outil d’un sous-agent d’arrière-plan rend la main immédiatement. Utilisez `agent.spawn` et le `turn.complete` propre au sous-agent.
- **Un avertissement de silence qui n’apparaît jamais.** Rien ne déclenche d’événement pendant qu’un sous-agent est inactif. Recalculez sur une horloge.
- **Réécrire l’état à chaque tic.** Comparez avant d’écrire ; la fonction `refreshAgents` de Narsil n’écrit et n’envoie que lorsqu’une pastille a changé.
- **Du texte sans limite.** Les sujets et descriptions de tâches peuvent être longs. Nettoyez-les et limitez-les avant qu’ils ne voyagent.

Pour tester, `claude plugin test .` exécute `tests/narsil.test.tsx`. « the task tools leave this conversation its list, for the band and the hub » (les outils de tâches laissent à cette conversation sa liste, pour la bande et le hub) appelle `TodoWrite`, `TaskCreate` et `TaskUpdate`, puis le plan de bureau avec `items` et `advance`, puis `mcp__ccd_turn__wrap_up`, et vérifie les lignes de la bande (« ● Leer », « ◐ Escribir el test ») et la liste envoyée au hub. Pour les sous-agents, « each subagent shows its type, how long it has run, and when it has gone quiet » (chaque sous-agent affiche son type, depuis combien de temps il tourne et quand il est devenu silencieux) fait avancer une horloge simulée (`mock.clock`) et vérifie les pastilles, y compris le jaune `#F5B400` ; « a finished subagent stays a few seconds with how it ended, then leaves » (un sous-agent terminé reste quelques secondes avec la façon dont il s’est terminé, puis disparaît), « each subagent shows the model it runs on » (chaque sous-agent affiche le modèle sur lequel il tourne) et « the subagent chips show each type with its own mark » (les pastilles de sous-agents montrent chaque type avec sa propre marque) couvrent le reste.

## Pour aller plus loin

- `applyPlan` dans `hooks/tasks.ts` gère toutes les formes du plan de l’application de bureau ; `TASK_ICON` contient les marques.
- `backgroundTasks` nomme le travail d’arrière-plan selon sa nature : processus, moniteur, sous-agent.
- `refreshAgents`, `touchAgent` et `endAgent` dans `hooks/register.tsx` gèrent les exécutions ; `endAgent` donne aussi de l’expérience pour un sous-agent qui s’est bien terminé (`gainXp($, 'agent')`) et annonce ceux d’arrière-plan.
- `modelLabel` et `took` dans `hooks/agents.ts` sont les fonctions utilitaires de mise en forme, et `MAX_AGENTS_SHOWN` dans `hooks/words.ts` limite la bande à six pastilles.
- Le bloc de la conversation ouverte, dans le hook de rendu `AbovePrompt`, dessine « Tareas: » et chaque tâche avec `TASK_COLOR`, puis les pastilles, pour la conversation ouverte quelle qu’elle soit, à partir des tâches et des pastilles que cette conversation a signalées au hub.
