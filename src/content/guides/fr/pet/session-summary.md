---
title: Le résumé de session
description: 'Comment Narsil compte ce qu’une conversation a fait (tours, fichiers, commandes, échecs, sous-agents) et continue après un redémarrage de Claude Code, pour /narsil resumen et après une pause.'
route: pet
order: 16
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/watch.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: types/index.d.ts
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Ce que ça fait

`/narsil resumen` (« résumé ») répond à une question à laquelle il est difficile de répondre à partir de la transcription : qu’a réellement fait cette conversation jusqu’ici ? Elle affiche une ligne :

```text
📋 Sesión de 1 h 5 min: 4 turnos (12 min de trabajo) · 3 archivos editados (a.ts, b.ts, c.ts) · 7 comandos, 1 fallo · 2 subagentes · contexto 40 %
```

Traduction en français : une session de 1 h 5 min, 4 tours (12 minutes de travail), 3 fichiers modifiés, 7 commandes dont 1 échec, 2 sous-agents, le contexte rempli à 40 %. L’exemple est celui du commentaire au-dessus de `summaryText` dans `hooks/watch.ts`.

Narsil l’affiche aussi d’elle-même une fois qu’une conversation est restée calme pendant 30 minutes après un tour : un moment naturel pour regarder en arrière, par exemple après une pause. Il s’affiche là où s’affichent ses conseils (guide 11) : dans une petite fenêtre à lui sous Windows et macOS, dans la bande ailleurs.

Si vous fermez Claude Code et reprenez plus tard la conversation, le résumé continue d’additionner à partir de là où il en était. Narsil garde les décomptes des 20 conversations les plus récentes.

## Comment ça marche à l’intérieur

### Ce qui est compté : le type `Stats`

Les décomptes forment une seule valeur, l’atome `stats` dans `hooks/register.tsx`, du type `Stats` déclaré dans `types/index.d.ts` :

| Champ       | Ce qu’il compte                                            | Où il est incrémenté                        |
| ----------- | ---------------------------------------------------------- | ------------------------------------------- |
| `startedAt` | le moment où les décomptes de la conversation ont commencé | la première fois, au `session.start`        |
| `turns`     | les tours terminés de la conversation principale           | `turn.complete`, quelle que soit la raison  |
| `workedMs`  | le temps qu’ont pris ces tours                             | `turn.complete`, à partir de `e.durationMs` |
| `files`     | les noms des fichiers modifiés, jusqu’à 200                | `tool.call` d’un outil d’écriture           |
| `moreFiles` | les fichiers au-delà des 200 premiers, seulement comptés   | le même                                     |
| `commands`  | les commandes shell exécutées                              | `tool.call` de `Bash` ou `PowerShell`       |
| `failures`  | les appels d’outils qui ont renvoyé une erreur             | après `next(e)` dans `tool.call`            |
| `agents`    | les sous-agents lancés                                     | `agent.spawn`                               |

Chaque changement passe par une seule fonction, `bumpStats($, change)`, qui applique un changement pur à l’atome (en partant de `emptyStats(now)` s’il n’y en a pas encore) et l’enregistre. Les fonctions auxiliaires de `hooks/watch.ts` gardent les règles simples : `emptyStats`, `addFile`, `summaryText`, `statsOf`.

Quelques détails décident de ce que signifient les nombres :

- **Les outils d’écriture** sont `Edit`, `MultiEdit`, `Write` et `NotebookEdit` (`WRITING_TOOLS` dans `hooks/words.ts`). Le fichier est le court détail que montre la bande, le nom de base du fichier, et `addFile` n’ajoute un nom qu’une fois. Le résumé compte donc des noms distincts : deux fichiers `index.ts` dans des dossiers différents comptent pour un.
- **Le travail des sous-agents compte aussi.** Le hook `tool.call` ajoute les fichiers, les commandes et les échecs quoi que dise `e.agentId`, tandis que `turns` ne compte que les tours de la conversation principale, puisque le `turn.complete` d’un sous-agent revient avant cette ligne.
- **Seuls les appels de Claude comptent.** Le hook commence par `isClaudesCall(next.origin)` : un appel fait par un autre mod ne fait pas partie du travail de la session (guide 1).
- **Un test échoué est un échec.** `failures` compte tout résultat d’outil avec `isError`, une exécution de tests qui échoue comprise.
- **Le contexte** n’est pas stocké : `summarize` lit le pourcentage actuel dans l’atome `usage` du guide 7, et l’omet quand il n’y en a pas.

`summaryText(stats, now, contextPercent)` écrit la ligne. Il nomme au plus trois fichiers et ajoute « … » après eux quand il y en a davantage, écrit « ningún archivo editado » (« aucun fichier modifié ») quand il n’y en a aucun, omet les sous-agents quand il n’y en a pas eu, et gère le pluriel de chaque décompte. La durée est `now - startedAt`, écrite en minutes ou en heures et minutes.

### Pourquoi deux couches de persistance

Narsil garde les décomptes à deux endroits, et chacun couvre un type de redémarrage différent :

- **`$.state`, l’atome.** Les types le décrivent comme « plain data that survives a hot reload of the plugin's code » (de simples données qui survivent à un rechargement à chaud du code du plugin). Un rechargement du mod, qui suit tout tour qui le modifie, garde les décomptes sans rien faire.
- **`$.store`, une clé par conversation.** Le store est « kept between sessions and hot reloads » (conservé entre les sessions et les rechargements à chaud). `loadStats` demande `$.session.id()`, que les types décrivent comme « the session's id (the transcript file's name) » (l’identifiant de la session, le nom du fichier de transcription), et utilise la clé `stats:<id>`. `saveStats` y écrit toute la valeur après chaque changement.

Au `session.start`, `loadStats` remplit l’atome depuis le store seulement quand l’atome est vide. Un rechargement garde l’atome et ignore le store ; un redémarrage de Claude Code avec la même conversation a un atome vide et le relit. Le commentaire à cet endroit le résume : « The stats survive a reload of the mod, and Claude Code restarting with this conversation: only a new conversation starts them. » (les statistiques survivent à un rechargement du mod, et au redémarrage de Claude Code avec cette conversation : seule une nouvelle conversation les fait commencer).

La clé est par conversation, à dessein. L’XP du guide 13 est un seul nombre pour la machine, auquel tout le monde ajoute ; un résumé porte sur une conversation, donc chacune a le sien.

Si `$.session.id()` échoue, la clé est vide et rien n’est stocké : les décomptes ne durent alors qu’aussi longtemps que l’atome.

Une conséquence découle du fait de garder `startedAt` : la durée compte à partir du moment où les décomptes de la conversation ont commencé, si bien que le temps passé avec Claude Code fermé est inclus. Une conversation reprise le lendemain matin dit qu’elle a duré toute la nuit.

### N’en garder que 20

Une clé par conversation grandit sans fin, alors `saveStats` fait le ménage une fois par chargement du module (`isStatsPruned`). Il liste les clés du store, garde celles qui commencent par `stats:` autres que la sienne, et supprime les plus anciennes jusqu’à ce qu’il en reste 19, si bien que 20 restent avec la sienne. Le code s’appuie sur l’ordre : « Oldest first: the store lists its keys in the order they were set. » (les plus anciennes d’abord : le store liste ses clés dans l’ordre où elles ont été définies). Les types disent que `$.store.keys()` « Returns every key set, in insertion order. » (renvoie chaque clé définie, dans l’ordre d’insertion). Tout échec de la liste ou de la suppression laisse toutes les clés en place.

`statsOf` valide ce qu’il lit : chaque décompte doit être un nombre fini et `files` un tableau de chaînes, sinon la valeur stockée est ignorée et la conversation repart de zéro. Le commentaire l’appelle « A stored value from any version, or none » (une valeur stockée de n’importe quelle version, ou aucune).

### Le résumé après une pause

Le battement (`beat`, toutes les 2 secondes) appelle `tickWatch`, qui affiche le résumé quand tout ceci est vrai :

- un tour s’est terminé : l’horloge du cache du guide 8 a un début, `c.at`, que la fin de chaque tour définit ;
- rien ne tourne encore en arrière-plan (`backgroundAtStop === 0`) ;
- 30 minutes (`IDLE_SUMMARY_MS`) se sont écoulées depuis `c.at` ;
- la pause de ce tour n’a pas encore été résumée (`summarizedFor !== c.at`) ;
- la conversation a au moins un tour ;
- le mode discret est désactivé (guide 14).

Il appelle alors `showTip($, await summarize($), 'summary')`. Réutiliser l’affichage du conseil signifie que le résumé obtient gratuitement la fenêtre du conseil, les trois lignes de la bande et la fenêtre flottante. `summarizedFor` le limite à une fois par pause : un nouveau tour définit un nouveau `c.at`, et la pause suivante peut être résumée de nouveau.

## Comment on l’a demandé à l’IA

La demande d’origine pour le résumé de session n’a pas été consignée.

Une demande consignée touche au module dans lequel le résumé est né. `hooks/watch.ts` a commencé avec une alerte de boucle, un rappel pour les permissions en attente et le résumé. Dans `odd/tasks/fleet-view.md`, L1 (2026-11-06), l’auteur ou l’autrice a demandé :

> "eliminariamos la alerta de bucle, no la he sentido tan util"

Traduction en français : nous supprimerions l’alerte de boucle, je ne l’ai pas trouvée si utile. Le journal de tâches l’enregistre comme S9, et `21e7288` l’a supprimée. Le résumé et le rappel sont restés.

### Reconstitution à partir de l’historique des commits

À partir de `git log -- hooks/watch.ts` dans narsil-pet :

- `f7a494e` (2026-10-30) « feat: warn about loops, insist on waiting permissions and sum the session up » (avertir des boucles, insister sur les permissions en attente et résumer la session). Le résumé, le rappel et l’alerte de boucle arrivent ensemble.
- `21ffc2e` (2026-10-31) « fix: keep a conversation's session summary when Claude Code restarts » (garder le résumé de session d’une conversation quand Claude Code redémarre). Les clés `stats:<id>`, `statsOf` et la limite de 20 (`KEEP_STATS`) viennent d’ici. La première version ne vivait que dans la session.
- `36256f9` (2026-10-31) « feat: let the band, window and alerts speak in Narsil's first person » (faire parler la bande, la fenêtre et les alertes à la première personne de Narsil).
- `2bcc97c` (2026-11-05) « feat: open the context breakdown from the usage bars and calm loop, steps and permission alerts » (ouvrir la répartition du contexte depuis les barres d’utilisation et calmer les alertes de boucle, d’étapes et de permission).
- `519dd73` (2026-11-06) « fix: wait for background work before announcing a turn finished » (attendre le travail d’arrière-plan avant d’annoncer qu’un tour est terminé). La condition `backgroundAtStop === 0` du résumé après une pause arrive avec lui.
- `21df208` (2026-11-06) « fix: ignore tool calls other mods make, so Narsil no longer sticks at working » (ignorer les appels d’outils faits par d’autres mods, pour que Narsil ne reste plus bloquée sur « en cours »). Son message cite des appels d’un autre mod comptés comme du travail de Claude ; `isClaudesCall` les garde aussi hors des décomptes.
- `21e7288` (2026-11-06) « refactor: drop the loop alert, the spending count and the open-conversations line » (supprimer l’alerte de boucle, le décompte des dépenses et la ligne des conversations ouvertes).

La première correction est la plus instructive : un résumé perdu quand Claude Code redémarre ne rapporte qu’une fraction du travail, ce qui est pire que rien.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon mod Claude Code `my-pet`, ajoute `/my-pet summary`. Garde un atome `stats` avec `startedAt`, `turns`, `workedMs`, `files` (noms de base distincts, 200 au plus), `commands`, `failures` et `agents`. Compte les tours et leur `durationMs` dans le `turn.complete` de la conversation principale ; les fichiers modifiés à partir des appels `Edit` et `Write` dans `tool.call` ; les appels `Bash` comme commandes ; tout résultat avec `isError` comme échec ; les sous-agents dans `agent.spawn`. Ne modifie l’atome que par une seule fonction qui l’enregistre aussi dans `$.store` sous `stats:` plus `$.session.id()`. Au `session.start`, charge-le depuis le store seulement si l’atome est vide, et valide ce que tu lis. Ne garde que les 20 dernières clés de ce type. La commande affiche une ligne comme « Session of 12 min: 3 turns · 2 files edited (a.ts, b.ts) · 4 commands, 1 failure ». Teste avec `claude-code/testing` : une valeur stockée sous la clé de la session est poursuivie, et une 25e ancienne clé est supprimée.

## Le code minimal

Écrit pour ce guide et vérifié par rapport aux types 2.1.325 (`$.session.id`, `$.store.get`, `$.store.set`, `$.clock.now`, `$.command.register`, `command.run`, `session.start`, `tool.call`, `turn.complete`, `agent.spawn`). Il est adapté de `hooks/watch.ts` et de `hooks/register.tsx` dans [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). L’atome `stats` est déclaré dans `types/index.d.ts` comme `Stats | null`, avec le type ci-dessous. L’élagage à 20 est laissé de côté ; voir `saveStats`.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import type { Stats } from '../types'
// type Stats = { startedAt: number; turns: number; workedMs: number;
//   files: string[]; commands: number; failures: number; agents: number }

const stats = atom({ plugin: 'my-pet', key: 'stats' } as const, null)
let key = ''

const empty = (startedAt: number): Stats => ({
  startedAt,
  turns: 0,
  workedMs: 0,
  files: [],
  commands: 0,
  failures: 0,
  agents: 0,
})
const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path

async function bump($: EngineInterface, change: (s: Stats) => Stats): Promise<void> {
  const now = await $.clock.now()
  const next = await update($, stats, (s) => change(s ?? empty(now)))
  if (key) await $.store.set(key, next).catch(() => undefined)
}

function summary(s: Stats, now: number): string {
  const minutes = Math.round((now - s.startedAt) / 60_000)
  const files = s.files.length
    ? ` (${s.files.slice(0, 3).join(', ')}${s.files.length > 3 ? '…' : ''})`
    : ''
  return `Session of ${minutes} min: ${s.turns} turns · ${s.files.length} files edited${files} · ${s.commands} commands, ${s.failures} failures · ${s.agents} subagents`
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'my-pet', description: 'My pet: summary' })
    key = `stats:${await $.session.id().catch(() => '')}`
    if (key === 'stats:') key = ''
    // A reload keeps the atom; a restart reads the store back.
    if (key && !(await read($, stats))) {
      const kept = await $.store.get(key).catch(() => undefined)
      if (kept && typeof kept === 'object' && typeof (kept as Stats).turns === 'number')
        await update($, stats, (s) => s ?? (kept as Stats))
    }
    if (!(await read($, stats))) await bump($, (s) => s)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const path = (e as { file_path?: unknown }).file_path
    if ((e.tool === 'Edit' || e.tool === 'Write') && typeof path === 'string') {
      const name = baseName(path)
      await bump($, (s) =>
        s.files.includes(name) || s.files.length >= 200 ? s : { ...s, files: [...s.files, name] },
      )
    }
    if (e.tool === 'Bash') await bump($, (s) => ({ ...s, commands: s.commands + 1 }))
    const result = await next(e)
    if (result.isError) await bump($, (s) => ({ ...s, failures: s.failures + 1 }))
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined)
      await bump($, (s) => ({ ...s, turns: s.turns + 1, workedMs: s.workedMs + e.durationMs }))
    return result
  })

  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    await bump($, (s) => ({ ...s, agents: s.agents + 1 }))
    return result
  })

  on('command.run', { command: 'my-pet' }, async ($, e) => {
    if (e.args.trim() !== 'summary') return { text: 'Usage: /my-pet summary' }
    const now = await $.clock.now()
    return { text: summary((await read($, stats)) ?? empty(now), now) }
  })
}
```

`update` se résout avec la valeur qu’il a écrite, si bien que `bump` enregistre exactement ce que contient l’atome. La vérification de la valeur stockée est ici une ébauche ; le `statsOf` de Narsil vérifie chaque champ.

## Erreurs fréquentes et comment tester

- **Compter dans des variables de module.** Un rechargement du mod suit tout tour qui le modifie, et une variable de module repart de zéro. Gardez les décomptes dans un atome.
- **Une seule clé de store pour toutes les conversations.** Le résumé de chaque conversation devient alors celui de toutes. Indexez par `$.session.id()`.
- **Charger le store par-dessus un atome vivant.** Après un rechargement, l’atome est la valeur la plus récente ; le store peut avoir un changement de retard. Ne chargez que lorsque l’atome est vide.
- **Un store qui grandit sans fin.** Une clé par conversation demande une limite et un nettoyage.
- **Se fier à ce qui est stocké.** Une version plus ancienne a pu stocker une autre forme. Validez champ par champ, et repartez de zéro quand cela ne correspond pas.
- **Résumer au mauvais moment.** Une pause pendant qu’un travail d’arrière-plan tourne n’est pas une pause. Narsil attend qu’il se termine, et ne résume chaque pause qu’une fois.

Pour tester, `tests/narsil.test.tsx` a quatre tests. « /narsil resumen sums the session up, and so does a 30-minute pause after a turn » (/narsil resumen résume la session, et une pause de 30 minutes après un tour aussi) vérifie la ligne exacte (« Narsil: 📋 Sesión de 0 min: 2 turnos (1 min 24 s de trabajo) · 2 archivos editados (a.ts, b.ts) · 1 comando, 0 fallos. ») puis fait avancer l’horloge simulée. « a conversation taken up again keeps counting its session, kept across restarts » (une conversation reprise continue de compter sa session, conservée à travers les redémarrages) répond à `session.id` avec un identifiant fixe, place des décomptes antérieurs dans le store sous `stats:` et cet identifiant, et vérifie que le tour suivant s’y ajoute. « only the last 20 conversations keep their counts, and an odd stored value is ignored » (seules les 20 dernières conversations gardent leurs décomptes, et une valeur stockée étrange est ignorée) commence avec 25 anciennes clés et une valeur invalide. « the summary names three files at most, and counts subagents and context » (le résumé nomme trois fichiers au plus, et compte les sous-agents et le contexte) teste `summaryText` seul.

## Pour aller plus loin

- `nudgeText` et `NUDGE_AFTER_MS` dans `hooks/watch.ts`, les voisins du résumé, pilotent le rappel de cinq minutes du guide 10.
- `took` dans `hooks/agents.ts` écrit les durées (« 1 min 24 s ») pour le résumé et pour les sous-agents.
- Le guide suivant, le dernier du parcours, montre comment `/narsil` lui-même est enregistré et comment ses mots, `resumen` parmi eux, sont répartis.
