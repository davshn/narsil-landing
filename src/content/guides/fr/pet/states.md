---
title: Les états d’un coup d’œil
description: 'Comment Narsil transforme les événements de la session en cinq états, une phrase sur l’étape en cours et un court commentaire, dessinés dans la bande au-dessus du prompt.'
route: pet
order: 1
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: hooks/sprite.ts
  - repo: pet
    path: types/index.d.ts
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Ce que ça fait

Narsil vit dans la bande située juste au-dessus du prompt. Un coup d’œil suffit pour répondre à la question que vous vous posez le plus souvent pendant que Claude travaille : dois-je faire quelque chose maintenant ?

La bande affiche trois choses :

- **Un état**, en capitales et dans sa propre couleur. Narsil parle espagnol, les libellés sont donc en espagnol :

  | Libellé       | Signification          | Quand il s’affiche                                                             |
  | ------------- | ---------------------- | ------------------------------------------------------------------------------ |
  | `TRABAJANDO`  | Au travail             | Claude réfléchit, lit, cherche, modifie des fichiers ou exécute des commandes. |
  | `PARADA`      | À l’arrêt, vous attend | La conversation attend votre prochain message.                                 |
  | `TE NECESITA` | A besoin de vous       | Une question, un plan à approuver ou une autorisation à accorder ou refuser.   |
  | `TERMINADA`   | Terminé                | Claude a fini sa réponse.                                                      |
  | `ERROR`       | Erreur                 | Le tour s’est arrêté parce que quelque chose a échoué.                         |

- **Une phrase qui dit exactement ce que fait Claude**, comme « Estoy editando: register.tsx » (« Je modifie : register.tsx ») ou « Te necesito: tengo una pregunta para ti » (« J’ai besoin de vous : j’ai une question pour vous »).
- **Le commentaire propre à Narsil** sous cette phrase, tiré au hasard parmi quelques lignes prévues pour chaque moment, comme « Tecleando con mis aletas. » (« Je tape avec mes nageoires. ») pendant la modification d’un fichier.

En dehors du terminal, la bande dessine aussi Narsil elle-même, dans une pose propre à chaque état (le guide suivant traite du dessin). Dans le terminal, elle dessine à la place un petit visage en texte, comme `~(•ᴗ•)~ 💻`.

L’intérêt est que vous n’avez pas besoin de lire la transcription pour savoir où en sont les choses. Un `TE NECESITA` jaune est une raison de revenir ; un `TRABAJANDO` bleu est une raison de continuer à faire autre chose.

## Comment ça marche à l’intérieur

L’état n’est pas quelque chose que Claude Code transmet à un mod. Narsil le construit elle-même à partir des événements de la session, le conserve dans une seule valeur et dessine cette valeur.

### Une valeur, deux niveaux : l’humeur et l’état

Le mod conserve une seule valeur d’état, l’atome `pet` dans `hooks/register.tsx`, avec trois champs : `mood`, `detail` et `line`. Son type, `Pet`, est déclaré dans `types/index.d.ts`.

`mood` (l’humeur) est plus fin que les cinq états. Il existe douze humeurs : `greeting`, `idle`, `thinking`, `talking`, `reading`, `searching`, `writing`, `running`, `asking`, `scared`, `celebrating` et `failed`. Les cinq états sont dérivés de l’humeur par `statusOf` dans `hooks/sprite.ts` :

- `greeting` et `idle` correspondent à l’arrêt (`PARADA`).
- `asking` correspond à l’attente (`TE NECESITA`).
- `celebrating` correspond à terminé (`TERMINADA`).
- `failed` correspond à l’erreur (`ERROR`).
- Toutes les autres humeurs correspondent au travail (`TRABAJANDO`), y compris `scared`.

La raison de ces deux niveaux est que l’état répond à la question « dois-je agir ? », et cinq réponses suffisent pour cela ; l’humeur répond à la question « que se passe-t-il exactement ? », qui détermine la phrase, le commentaire et la pose. Ne conserver que l’humeur et en dériver l’état garantit que les deux ne peuvent jamais se contredire.

L’humeur `scared` montre bien pourquoi cette séparation compte. Quand un appel d’outil échoue au milieu d’un tour, Narsil a l’air surprise et la phrase dit « Ha fallado un paso (Bash); sigo trabajando » (« Une étape a échoué (Bash) ; je continue à travailler »). L’état reste `TRABAJANDO`, parce que Claude travaille toujours et que rien ne vous est demandé. Seul un tour qui se termine par un échec devient `ERROR`.

### Les événements qu’écoute Narsil

Chaque changement d’humeur passe par une seule fonction, `setMood` dans `hooks/register.tsx`, qui écrit l’atome `pet` et envoie le nouvel état à la fenêtre flottante. Les hooks qui l’appellent :

- **`session.start`** : une nouvelle conversation commence en `greeting`, ce qui compte comme un arrêt.
- **`turn.start`** : votre prompt lance un tour ; l’humeur devient `thinking`. Le hook n’agit que lorsque `e.agentId` est indéfini, afin que le tour d’un sous-agent ne réinitialise pas la conversation principale.
- **`turn.step`** : la sortie du modèle arrive en flux, par morceaux. Un morceau `thinking` maintient l’humeur à `thinking` ; le premier morceau `text` de la boucle principale la fait passer à `talking` (« Estoy escribiendo la respuesta », « J’écris la réponse »). Ce hook est un générateur asynchrone : il fournit (`yield`) chaque morceau qu’il reçoit, si bien que le flux atteint l’écran sans modification.
- **`tool.call`** : l’événement le plus parlant. Le nom de l’outil choisit l’humeur au moyen de `MOOD_BY_TOOL` dans `hooks/words.ts` (`Read` correspond à la lecture, `Grep` et `WebSearch` à la recherche, `Edit` et `Write` à l’écriture, `Bash` et `PowerShell` à l’exécution), et `describeCall` transforme l’entrée de l’appel en un court détail placé après les deux-points : le nom de base du fichier pour un outil de fichiers, le motif pour une recherche, la première ligne d’une commande. `AskUserQuestion` et `ExitPlanMode` sont traités à part (`ASKING_TOOLS`) : ils définissent `asking`, parce que l’outil lui-même est le moment où Claude s’arrête et attend.
- **`classic.PermissionRequest`** : une boîte de dialogue d’autorisation à laquelle vous devez répondre. Le hook appelle d’abord `next(e)` et ne définit `asking` que si aucun hook de paramètres n’a déjà tranché et que le mode n’est pas `bypassPermissions`.
- **`turn.complete`** : le tour se termine, et `e.reason` décide de l’état. `answer` devient `celebrating` avec le temps écoulé (« He terminado (en 2 min) »), `aborted` revient à `idle` avec « lo has detenido tú » (« c’est vous qui l’avez arrêté »), et toute autre raison devient `failed`.

### Pourquoi chaque décision a été prise

Les commentaires de `hooks/register.tsx` donnent les raisons, et ils méritent d’être lus comme des notes de conception :

- **Les autorisations utilisent `classic.PermissionRequest`, et non `tool.check`.** Le commentaire explique que le `ask` de `tool.check` arrive avant que le mode d’autorisation ne règle l’appel, si bien qu’en mode « bypass permissions », avec une règle ou avec le classificateur automatique, Narsil « cry wolf » (« crierait au loup »). Le moteur ne déclenche `PermissionRequest` que lorsqu’il est sur le point de vous montrer la boîte de dialogue.
- **Un tour terminé n’est pas toujours « terminé ».** Dans le hook `classic.Stop`, Narsil compte les tâches d’arrière-plan encore en cours (`e.background_tasks`). S’il y en a, `turn.complete` la montre toujours en `running`, en train de les attendre, au lieu d’annoncer une fin qui n’est pas réelle.
- **Une question dans la case d’étape suivante de l’application de bureau est une question.** Quand un tour se termine avec l’outil `mcp__ccd_turn__wrap_up` de l’application de bureau portant un `ask`, le hook `tool.call` conserve ce texte (`turnAsk`), et `turn.complete` affiche `asking` avec ce texte au lieu de `celebrating`.
- **Seuls les appels de Claude lui-même la font réagir.** `tool.call` commence par `isClaudesCall(next.origin)` (dans `hooks/watch.ts`) : l’appel d’un autre mod, par exemple narsil-check qui lit sa session au démarrage, n’est pas le travail de Claude.
- **Les mots vivent dans un seul fichier.** `hooks/words.ts` contient tous les libellés (`STATUS_LABEL`), le constructeur de phrases (`headline`), les commentaires (`LINES` et `pick`) et la table des outils. Le module de hooks décide de ce qui s’est passé ; `words.ts` décide de la façon de le dire. Les libellés restent ainsi identiques partout où ils apparaissent : la bande, la fenêtre flottante, le téléphone et `/narsil estado`.
- **Narsil parle à la première personne.** Les phrases sont écrites comme si Narsil parlait (« Estoy leyendo », « Je lis »), un choix consigné dans l’historique des commits (voir plus bas).

### Ce que dessine la bande

Le hook `ui.render` pour `{ component: 'AbovePrompt' }` lit l’état et renvoie un arbre d’éléments `Box`, `Text`, `Button` et `Svg` issus de `$.ui.resolve(e)`. Il cède la place à un sondage (`e.props.hasSurvey`) et à `/narsil ocultar`.

Dans le terminal, il dessine une seule ligne : le visage en texte tiré de `FACE`, le libellé en gras dans sa couleur, et la phrase. Sur les autres surfaces, il dessine l’image au moyen de `Svg` en 132 par 118 pixels, avec à côté une colonne contenant `● LABEL · Narsil · level`, la phrase en gras et le commentaire atténué. Les couleurs proviennent de `STATUS_COLOR` dans `hooks/sprite.ts` : bleu `#3B8BFF` pour le travail, gris pour l’arrêt, jaune `#F5B400` pour « a besoin de vous », vert pour terminé et rouge pour l’erreur.

Tout texte susceptible de s’allonger est dessiné avec `wrap="truncate-end"` dans une boîte avec `minWidth={0}`, afin qu’un long nom de fichier soit coupé à l’intérieur de la bande au lieu de l’élargir.

La bande que vous voyez aujourd’hui dessine la plus importante de toutes vos conversations ouvertes, et pas seulement la conversation en cours ; le troisième guide de ce parcours explique cette partie. Quand la conversation affichée est une autre, la phrase commence par le nom de cette conversation, et le commentaire est omis.

## Comment on l’a demandé à l’IA

La demande d’origine pour les états n’a pas été conservée. Les journaux de tâches publics du projet (`odd/tasks/fleet-view.md` et `odd/tasks/animated-poses.md`) commencent plus tard, et aucun des deux ne couvre la première bande.

### Reconstitution à partir de l’historique des commits

D’après `git log -- hooks/register.tsx hooks/words.ts` dans narsil-pet :

- `b1187f3` (2026-10-30) « feat: show Narsil above the prompt with clear states and /narsil » (afficher Narsil au-dessus du prompt avec des états clairs et /narsil). La bande, ses états et la commande `/narsil` arrivent ensemble dans le premier commit du module de hooks.
- `8e29583` (2026-10-30) « fix(band): keep long text from widening the desktop band » (empêcher le texte long d’élargir la bande sur le bureau). La règle de `minWidth={0}` et de troncature décrite plus haut vient de là.
- `2027f06` (2026-10-30) « fix(alerts): only alert when a permission dialog needs your answer » (n’alerter que lorsqu’une boîte de dialogue d’autorisation attend votre réponse). Le passage à `classic.PermissionRequest`, expliqué dans le commentaire de code cité plus haut.
- `0cfc369` (2026-10-31) « refactor: move Narsil's wording and labels out of the hooks module » (sortir les formulations et les libellés de Narsil du module de hooks). C’est à ce moment qu’est né `hooks/words.ts`.
- `c73bc13` (2026-10-31) « feat: let Narsil speak of herself in the first person » (laisser Narsil parler d’elle-même à la première personne), suivi de `36256f9` « feat: let the band, window and alerts speak in Narsil's first person » (faire parler la bande, la fenêtre et les alertes à la première personne de Narsil).
- `2532e7c` (2026-11-02) « feat: alert as a question when a turn ends asking in the desktop app's next-step box » (alerter sous forme de question quand un tour se termine par une question dans la case d’étape suivante de l’application de bureau).
- `519dd73` (2026-11-06) « fix: wait for background work before announcing a turn finished » (attendre le travail d’arrière-plan avant d’annoncer la fin d’un tour). Son message indique qu’un tour qui s’arrête alors que des shells, des moniteurs ou des sous-agents d’arrière-plan sont encore en cours montre désormais Narsil en train de les attendre.

Le schéma est clair même sans les prompts : une première version qui associait des événements à des états, puis une série de corrections chaque fois qu’un état mentait (une fausse alerte, une fausse fin, une question manquée).

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt utilisé pour construire Narsil.

> Construis un mod Claude Code appelé `my-pet` qui affiche l’état de la conversation dans la bande au-dessus du prompt (`ui.render` sur `AbovePrompt`). Conserve une seule valeur d’état dans un atome, avec un statut (au travail, à l’arrêt, en attente, terminé, erreur) et une phrase d’une ligne. Définis-la à partir de `turn.start` (au travail), de `tool.call` (au travail, avec l’outil et le nom de base du fichier dans la phrase ; en attente pour `AskUserQuestion` et `ExitPlanMode`) et de `turn.complete` (terminé sur `answer`, à l’arrêt sur `aborted`, erreur sinon). Ignore les événements dont `agentId` est défini. Dessine le libellé en gras dans sa couleur et la phrase après lui, tronquée pour qu’elle n’élargisse jamais la bande. Vérifie chaque API par rapport aux types de plugin-authoring, déclare l’atome dans `types/index.d.ts` et ajoute un test avec `claude-code/testing` qui vérifie qu’un appel `Read` affiche le nom du fichier.

## Le code minimal

Voici une version réduite de l’idée, écrite pour ce guide et vérifiée avec les types de Claude Code 2.1.325. Elle est adaptée de `hooks/register.tsx`, `hooks/words.ts` et `hooks/sprite.ts` dans [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later) ; les couleurs sont celles de `STATUS_COLOR` de Narsil.

Le type de l’état, dans `types/index.d.ts` (désigné par `"types"` dans `plugin.json`) :

```ts
export type Status = 'working' | 'idle' | 'waiting' | 'done' | 'error'
export type Pet = { status: Status; headline: string }

declare module 'claude-code' {
  interface PluginState {
    'my-pet': { pet: Pet }
  }
}
```

Le module de hooks, `hooks/register.tsx` :

```tsx
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'
import type { Status } from '../types'

const LABEL: Record<Status, string> = {
  working: 'WORKING',
  idle: 'IDLE',
  waiting: 'NEEDS YOU',
  done: 'DONE',
  error: 'ERROR',
}
const COLOR: Record<Status, string> = {
  working: '#3B8BFF',
  idle: '#8A90A6',
  waiting: '#F5B400',
  done: '#22B573',
  error: '#F0435A',
}
const VERB: Record<string, string> = {
  Read: 'reading',
  Grep: 'searching',
  Edit: 'editing',
  Write: 'editing',
  Bash: 'running',
}

const pet = atom({ plugin: 'my-pet', key: 'pet' } as const, {
  status: 'idle',
  headline: 'Waiting for your message',
})

export const register: Register = (on) => {
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined)
      await update($, pet, () => ({ status: 'working', headline: 'Thinking' }))
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId === undefined) {
      const input = e as unknown as Record<string, unknown>
      const file = typeof input.file_path === 'string' ? input.file_path.split(/[\\/]/).pop() : ''
      const isAsking = e.tool === 'AskUserQuestion' || e.tool === 'ExitPlanMode'
      await update($, pet, () =>
        isAsking
          ? { status: 'waiting', headline: 'I have a question for you' }
          : {
              status: 'working',
              headline: `I am ${VERB[e.tool] ?? 'working'}${file ? `: ${file}` : ''}`,
            },
      )
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    const status: Status =
      e.reason === 'answer' ? 'done' : e.reason === 'aborted' ? 'idle' : 'error'
    await update($, pet, () => ({
      status,
      headline: status === 'error' ? 'I stopped on an error' : 'Done',
    }))
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const s = await read($, pet)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" gap={1} minWidth={0}>
        <Text bold color={COLOR[s.status]}>{`● ${LABEL[s.status]}`}</Text>
        <Text wrap="truncate-end">{s.headline}</Text>
      </Box>
    )
  })
}
```

Trois détails portent la conception. Chaque hook qui se contente d’observer se termine en appelant `next(e)`, si bien que le comportement propre de Claude Code se poursuit. `turn.complete` attend d’abord `next(e)` et réagit au tour une fois réglé. Et le hook de rendu lit l’atome avec `read`, ce qui abonne le dessin : chaque `update` redessine la bande.

## Erreurs fréquentes et comment tester

Elles proviennent du code et des correctifs de Narsil :

- **Réagir aux sous-agents comme s’ils étaient la conversation principale.** Les sous-agents déclenchent eux aussi `turn.start`, `tool.call` et `turn.complete`, avec `e.agentId` défini. Narsil vérifie `e.agentId === undefined` avant de toucher à l’état principal.
- **Des alertes que le mode d’autorisation a déjà réglées.** Détecter « a besoin de vous » à partir de `tool.check` déclenche une alerte en mode bypass permissions. Le correctif de Narsil (`2027f06`) écoute `classic.PermissionRequest` et l’ignore quand même si un hook de paramètres a répondu (`result.decision`) ou si le mode est `bypassPermissions`.
- **Un « terminé » qui ne l’est pas.** Un tour peut se terminer alors que du travail d’arrière-plan continue. Narsil lit `background_tasks` dans `classic.Stop` avant de décider (`519dd73`).
- **Du texte qui élargit la bande.** Sur le bureau, une longue phrase fait déborder la mise en page. Utilisez `minWidth={0}` sur la colonne et `wrap="truncate-end"` sur le texte (`8e29583`).
- **Avaler le flux.** Un hook `turn.step` est un générateur : s’il ne fournit pas (`yield`) chaque morceau issu de `next(e)`, la réponse cesse d’atteindre l’écran.
- **Ignorer les sondages.** Quand `e.props.hasSurvey` est vrai, la bande appartient au sondage ; renvoyez `next(e)`.

Pour tester, `claude plugin test .` exécute les fichiers `*.test.tsx` du mod. Le fichier `tests/narsil.test.tsx` de Narsil est un bon modèle : il démarre une session avec `$.session.start`, appelle des outils avec `$.tool.call`, monte la bande avec `$.ui.mount` et cherche des textes avec `find`. Parmi les tests qui valent la peine d’être copiés, citons « a new conversation shows as stopped and ready, on every surface » (une nouvelle conversation s’affiche à l’arrêt et prête, sur toutes les surfaces), « a permission dialog you must answer pops up as a question » (une boîte de dialogue d’autorisation à laquelle vous devez répondre apparaît comme une question) et « an ask the mode settles by itself (bypass permissions) raises no alarm » (une demande que le mode règle seul, en bypass permissions, ne déclenche aucune alerte). Le journal de tâches de Narsil consigne que, dans le shell de l’auteur ou de l’autrice, `claude plugin test .` nécessitait `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` (`odd/tasks/fleet-view.md`, L6). Exécutez aussi `claude plugin validate .claude-plugin/plugin.json` : cette commande vérifie les lectures et écritures de votre atome par rapport à `types/index.d.ts`.

Une remarque sur les surfaces : le README de Narsil indique que la bande fonctionne dans le terminal, l’application de bureau, VS Code et l’application mobile. Les types 2.1.325 documentent `AbovePrompt` par « Raised on the terminal, desktop and mobile surfaces only » (déclenché uniquement sur les surfaces terminal, bureau et mobile). Testez sur les surfaces qui vous importent plutôt que de vous fier à l’une ou l’autre de ces affirmations.

## Pour aller plus loin

La version complète de narsil-pet ajoute beaucoup de choses autour du même noyau :

- `setMood` dans `hooks/register.tsx` est le point d’entrée unique de chaque changement, et elle envoie aussi l’état au hub local (`pushOverlay`).
- `headline` et `LINES` dans `hooks/words.ts` contiennent la phrase de chacune des douze humeurs et trois commentaires pour chacune ; `describeCall` construit le détail pour les fichiers, les motifs, les requêtes, les URL, les commandes et les sous-agents.
- Le hook `tool.call` reconnaît aussi les commandes de test (`TEST_COMMAND`) pour fêter les tests qui passent, et avertit des commandes irréversibles (`dangerOf`), sans les bloquer.
- `startWaiting` et `stopWaiting` insistent une fois sur une autorisation ou une question restée en attente cinq minutes.
- `announce` parle et notifie aux moments clés (démarrage, fin, question, erreur), et `sendStatus` envoie l’état au téléphone.
- `FACE` dans `hooks/sprite.ts` est le visage du terminal pour chaque humeur ; `sprite` dessine l’image complète, traitée dans le guide suivant.
