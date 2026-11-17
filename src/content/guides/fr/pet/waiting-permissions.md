---
title: Les autorisations qui attendent
description: 'Comment Narsil insiste une fois quand une autorisation, une question ou un plan vous attend depuis cinq minutes, et pourquoi elle vérifie au battement plutôt que de régler un minuteur.'
route: pet
order: 10
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/watch.ts
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: overlay/server.cjs
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Ce que ça fait

Claude s’arrête souvent au milieu d’un tour pour vous demander quelque chose : l’autorisation d’utiliser un outil, une question, ou un plan à approuver. Narsil vous prévient à ce moment-là, comme le montrent les guides précédents (l’état « TE NECESITA », la voix, la fenêtre flottante).

Mais cette première alerte est facile à manquer. Vous étiez dans une autre fenêtre, ou vous l’avez vue et comptiez revenir. Cinq minutes plus tard, si la même chose attend toujours, Narsil insiste une fois :

```text
Sigo esperándote
Sigo esperándote desde hace 5 min: pido permiso para usar Bash.
```

« Je t’attends toujours, depuis 5 minutes maintenant : je demande l’autorisation d’utiliser Bash. » La seconde moitié nomme ce qui attend, si bien qu’une question se lit « tengo una pregunta para ti » (« j’ai une question pour toi ») et un plan « tengo un plan para que lo apruebes » (« j’ai un plan à te faire approuver »).

L’insistance part comme une alerte de question : dans la fenêtre flottante, à voix haute avec l’une des phrases `stillWaiting` (« Sigo aquí, esperándote. », « je suis toujours là, à t’attendre »), et vers le téléphone selon les règles du guide sur la voix et les alertes. Le README ajoute le détail qui la distingue de la première alerte : elle s’affiche « aunque estés mirando Claude », même pendant que vous regardez Claude.

Cela arrive une fois par attente. Si vous ne répondez toujours pas, Narsil n’insiste plus.

## Comment ça marche à l’intérieur

### Une attente est une variable de module

Ce qui attend est conservé dans une variable de `hooks/register.tsx` :

```tsx
let waiting: { since: number; what: string; isNudged: boolean } | null = null
```

`startWaiting($, what)` la remplit avec l’heure courante tirée de `$.clock.now()` ; `stopWaiting()` la remet à `null`. Une variable de module suffit : l’attente appartient à cette conversation, et personne d’autre ne la lit.

### Ce qui démarre une attente

Trois endroits appellent `startWaiting`, les trois mêmes qui déclenchent la première alerte :

- **`classic.PermissionRequest`**, une boîte de dialogue d’autorisation. Le premier guide explique pourquoi Narsil écoute ici et non `tool.check` : le moteur ne le déclenche que lorsqu’il s’apprête à vous montrer la boîte de dialogue. Le hook l’ignore quand même lorsqu’un hook des paramètres a déjà répondu (`result.decision` est renseigné) ou que le mode est `bypassPermissions`.
- **`tool.call` pour `AskUserQuestion` ou `ExitPlanMode`**, une question ou un plan. Ici, l’attente enveloppe l’appel lui-même : `startWaiting` avant `next(e)`, et `stopWaiting()` dans un `finally`, si bien qu’elle se termine quand l’outil revient, quelle que soit la façon dont il revient.
- **`turn.complete` avec une question dans la zone d’étape suivante de l’application de bureau**, un tour qui s’est terminé en vous demandant quelque chose.

### Ce qui la termine

Aucun minuteur n’est réglé, il n’y a donc rien à annuler. Une attente se termine quand `waiting` revient à `null`, et chaque signe que vous avez répondu provoque cela :

- `classic.PostToolUse` et `classic.PostToolUseFailure` : l’outil s’est exécuté, vous l’avez donc autorisé.
- `classic.PermissionDenied` : vous avez dit non. Le commentaire au-dessus de ces trois hooks : « A permission answered, either way: nothing waits any more. » (une autorisation a reçu une réponse, dans un sens ou dans l’autre : plus rien n’attend).
- Tout autre `tool.call` : une autre étape a commencé, donc ce qui attendait a reçu une réponse.
- `turn.start` et `turn.complete` : un nouveau tour, ou la fin de celui-ci.

### Pas de minuteur : le battement vérifie

Narsil a déjà un battement : `$.clock.every(2000, ...)` démarré dans `session.start`, qui décompte aussi le cache (guide 8). À chaque battement, `tickWatch` pose une seule question :

```tsx
if (waiting && !waiting.isNudged && now - waiting.since >= NUDGE_AFTER_MS) {
  waiting.isNudged = true
  const text = nudgeText(waiting.what, now - waiting.since)
  void announce($, 'question', 'Sigo esperándote', text, say('stillWaiting'), true).catch(
    () => undefined,
  )
}
```

Les types 2.1.325 proposent un minuteur à usage unique, `$.clock.after`, et une version pourrait en démarrer un dans chaque `startWaiting` et l’annuler dans chaque `stopWaiting`. Narsil ne le fait pas, et son code dit pourquoi à un autre endroit : un commentaire dans `turn.complete` note qu’un rechargement du mod, qui suit tout tour l’ayant modifié, annule les minuteurs de `$.clock`. Avec le battement, la vérification est une comparaison de deux nombres, et aucun des endroits qui terminent une attente n’a à se souvenir d’un minuteur.

Le battement ne fait pas non plus survivre l’attente à un rechargement : `waiting` est une variable de module et repart vide. La différence tient à la façon dont cela échoue. Une attente perdue signifie un rappel manqué, jamais un rappel pour quelque chose à quoi vous avez déjà répondu.

### Pourquoi une fois, et pourquoi cinq minutes

`isNudged` fait que cela n’arrive qu’une fois. Un rappel toutes les cinq minutes ferait de Narsil le genre d’alarme que l’on finit par couper, et la première alerte plus un rappel couvrent déjà le cas habituel d’une notification manquée.

Cinq minutes, c’est `NUDGE_AFTER_MS` dans `hooks/watch.ts`. C’était deux minutes au début ; le commit qui l’a augmenté, `2bcc97c`, est intitulé « calm loop, steps and permission alerts » (calmer les alertes de boucle, d’étapes et d’autorisation). Le même commit a fait passer les étapes suivantes de 3 à 15 minutes : l’auteur ou l’autrice espaçait tout ce que Narsil dit sans qu’on le lui demande.

`nudgeText` construit la phrase ; `took` de `hooks/agents.ts` écrit la durée (« 5 min »).

### Pourquoi elle s’affiche même pendant que vous regardez

Le dernier argument d’`announce`, `true`, est `force`. La fenêtre flottante du guide 5 n’apparaît normalement que lorsque Claude n’est pas au premier plan. Un événement forcé s’affiche quand même : `overlay/server.cjs` montre l’événement quand Claude n’est pas au premier plan ou que l’événement est forcé, et un événement forcé rouvre aussi une fenêtre que vous avez fermée il y a moins d’une minute.

Ni le code ni le README ne disent pourquoi ; la lecture de ce guide est que si cinq minutes sont passées et que la chose attend toujours, la première alerte n’a pas fonctionné, et le fait que Claude soit au premier plan ne signifie pas que vous l’avez vue.

`announce` respecte les choix de la personne : en mode muet ou discret, pas de voix, et si la fenêtre flottante est désactivée, une notification système la remplace. Le mode discret (`/narsil discreto`) ne fait taire que les annonces de fin de tour, si bien qu’un rappel indiquant que quelque chose a besoin de vous arrive quand même, sans la voix.

## Comment on l’a demandé à l’IA

La demande d’origine du rappel n’a pas été consignée. Elle est arrivée le 2026-10-30, avant les journaux de tâches publics.

### Consigné : l’alerte de boucle qui est partie

Le rappel est né dans le même commit qu’une alerte de boucle, qui avertissait quand Claude continuait à échouer ou à modifier les mêmes fichiers. La première demande de l’auteur ou de l’autrice dans `odd/tasks/fleet-view.md` dans narsil-pet, L1 (2026-11-06, extrait), a retiré celle-ci :

> "(eliminariamos la alerta de bucle, no la he sentido tan util)"

Traduction en français : nous retirerions l’alerte de boucle, je ne l’ai pas trouvée si utile. Le journal de tâches en fait S9, « Loop alert removed » (alerte de boucle retirée), et le commit `21e7288` la supprime. Le rappel pour une autorisation en attente est resté.

### Reconstitution à partir de l’historique des commits

À partir de `git log -- hooks/register.tsx hooks/watch.ts` :

- `2027f06` (2026-10-30) « fix(alerts): only alert when a permission dialog needs your answer » (n’alerter que lorsqu’une boîte de dialogue d’autorisation a besoin de votre réponse). Le passage à `classic.PermissionRequest`, qui décide aussi de ce qui démarre une attente.
- `f7a494e` (2026-10-30) « feat: warn about loops, insist on waiting permissions and sum the session up » (avertir des boucles, insister sur les autorisations en attente et résumer la session). Le rappel, avec une attente de deux minutes.
- `2532e7c` (2026-11-02) « feat: alert as a question when a turn ends asking in the desktop app's next-step box » (alerter comme une question quand un tour se termine par une demande dans la zone d’étape suivante de l’application de bureau). Cette question est aujourd’hui aussi une attente.
- `2bcc97c` (2026-11-05) « feat: open the context breakdown from the usage bars and calm loop, steps and permission alerts » (ouvrir le détail du contexte depuis les barres d’utilisation et calmer les alertes de boucle, d’étapes et d’autorisation). Son message : « a waiting permission is insisted on after 5 minutes » (on insiste sur une autorisation en attente après 5 minutes).
- `21e7288` (2026-11-06) « refactor: drop the loop alert, the spending count and the open-conversations line » (supprimer l’alerte de boucle, le décompte des dépenses et la ligne des conversations ouvertes).

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon mod Claude Code `my-pet`, rappelle-moi une fois quand une autorisation attend trop longtemps. Garde une variable de module `waiting` avec `since`, `what` et `isNudged`. Démarre-la dans `classic.PermissionRequest` après `next(e)`, sauf si `result.decision` est renseigné ou si `e.permission_mode` vaut `bypassPermissions`. Efface-la dans `classic.PostToolUse`, `classic.PostToolUseFailure`, `classic.PermissionDenied`, tout autre `tool.call`, `turn.start` et `turn.complete`. N’utilise pas `$.clock.after` : dans `session.start`, démarre un battement `$.clock.every(2000, ...)` qui, quand cinq minutes sont passées et que `isNudged` est faux, le passe à vrai et envoie une notification avec `$.ui.notify`. Ajoute un test avec une horloge simulée : rien à 4 minutes 50 secondes, exactement un rappel après 15 minutes, et aucun quand l’autorisation a reçu une réponse après une minute.

## Le code minimal

Écrit pour ce guide et vérifié par rapport aux types 2.1.325 (`classic.PermissionRequest` et sa `decision`, `classic.PostToolUse`, `classic.PostToolUseFailure`, `classic.PermissionDenied`, `$.clock.every`, `$.clock.now`, `$.ui.notify`). Il est adapté de `hooks/register.tsx` et de `hooks/watch.ts` dans [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later).

```tsx
import type { EngineInterface, Register } from 'claude-code'

const NUDGE_AFTER_MS = 5 * 60_000
let waiting: { since: number; what: string; isNudged: boolean } | null = null

async function startWaiting($: EngineInterface, what: string): Promise<void> {
  waiting = { since: await $.clock.now(), what, isNudged: false }
}

function stopWaiting(): void {
  waiting = null
}

async function beat($: EngineInterface): Promise<void> {
  if (!waiting || waiting.isNudged) return
  const waited = (await $.clock.now()) - waiting.since
  if (waited < NUDGE_AFTER_MS) return
  waiting.isNudged = true
  const minutes = Math.round(waited / 60_000)
  void $.ui
    .notify(`Still waiting for you after ${minutes} min: ${waiting.what}`, { title: 'my-pet' })
    .catch(() => undefined)
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    $.clock.every(2000, () => void beat($))
    return next(e)
  })

  on('classic.PermissionRequest', async ($, e, next) => {
    const result = await next(e)
    const isDecided = result.decision !== undefined || e.permission_mode === 'bypassPermissions'
    if (!isDecided) await startWaiting($, `permission to use ${e.tool_name}.`)
    return result
  })

  // Answered, either way: nothing waits any more.
  on('classic.PostToolUse', async ($, e, next) => {
    stopWaiting()
    return next(e)
  })
  on('classic.PostToolUseFailure', async ($, e, next) => {
    stopWaiting()
    return next(e)
  })
  on('classic.PermissionDenied', async ($, e, next) => {
    stopWaiting()
    return next(e)
  })
  // A subagent's turns are not this conversation's: they leave the wait alone.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) stopWaiting()
    return next(e)
  })
  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) stopWaiting()
    return next(e)
  })
}
```

Narsil efface aussi l’attente dans son hook `tool.call`, où le début d’une autre étape signifie que l’attente a reçu une réponse, et y en démarre une pour `AskUserQuestion` et `ExitPlanMode`. Le premier guide montre une version de ce hook.

## Erreurs fréquentes et comment tester

- **Démarrer une attente pour des demandes que personne ne voit.** En mode de contournement des autorisations, ou quand un hook des paramètres répond, aucune boîte de dialogue n’apparaît. Vérifiez `result.decision` et `e.permission_mode` après `next(e)`.
- **Oublier une issue.** Une attente qui n’est jamais effacée vous rappelle quelque chose à quoi vous avez répondu depuis longtemps. Énumérez chaque chemin : autorisé, échoué, refusé, une autre étape, un nouveau tour.
- **Insister indéfiniment.** Sans l’indicateur `isNudged`, le battement vous relance toutes les deux secondes après la cinquième minute.
- **Compter sur un minuteur à travers un rechargement.** Les minuteurs de `$.clock` disparaissent avec un rechargement du mod. Un battement qui compare des heures est plus simple à raisonner.
- **Bloquer le battement.** Le rappel est envoyé avec `void … .catch(...)` : une notification lente ne doit pas retenir le battement qui décompte aussi le cache.

Pour tester, `claude plugin test .` exécute `tests/narsil.test.tsx` avec une horloge simulée. « a permission left waiting five minutes is insisted on once, even while you look » (on insiste une fois sur une autorisation laissée en attente cinq minutes, même pendant que vous regardez) déclenche un `classic.PermissionRequest`, ne trouve aucun rappel à 4 minutes 50 secondes, puis exactement un après dix minutes de plus, de type `question`, avec `force` activé et le texte « Sigo esperándote desde hace 5 min: pido permiso para usar Bash. ». « a permission or question answered in time is not insisted on » (on n’insiste pas sur une autorisation ou une question qui a reçu une réponse à temps) répond après une minute et n’en attend aucun.

## Pour aller plus loin

- `tickWatch` dans `hooks/register.tsx` résume aussi la session après 30 minutes calmes (`IDLE_SUMMARY_MS` et `summaryText` dans `hooks/watch.ts`), affiché comme un conseil.
- `announceQuestion` déclenche la première alerte pour les trois mêmes cas, et `setMood($, 'asking', ...)` met la bande en « TE NECESITA ».
- Le hub du guide 3 classe une conversation qui attend au-dessus d’une conversation qui travaille, si bien que le rappel et la liste s’accordent sur ce qui compte.
