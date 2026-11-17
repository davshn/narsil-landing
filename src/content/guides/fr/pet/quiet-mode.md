---
title: Le mode discret
description: 'Comment /narsil discreto fait taire Narsil sans perdre les alertes qui comptent : ce qui s’arrête, ce qui passe encore, et pourquoi la limite est placée à « elle a besoin de vous ».'
route: pet
order: 14
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: types/index.d.ts
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Ce que ça fait

Narsil parle beaucoup, à dessein : elle parle quand le travail commence et se termine, alerte quand un tour se termine, donne des conseils, propose des étapes suivantes et résume la session. Un jour de réunions, ou simplement dans un bureau partagé, c’est trop.

`/narsil discreto` (« discret ») baisse tout cela d’un coup. Elle cesse de parler, cesse d’alerter quand un tour se termine, et cesse de proposer d’elle-même des conseils et des étapes suivantes. Elle vous alerte toujours, sans voix, quand elle a besoin de vous ou que quelque chose a échoué, et la bande montre toujours ce qu’elle fait. `/narsil normal` remet tout comme avant.

Narsil a trois façons de se mettre en retrait, et il est utile de les distinguer :

| Commande           | Ce qu’elle change                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `/narsil silencio` | Seulement la voix. Chaque alerte, conseil et étape arrive toujours, par écrit.              |
| `/narsil ocultar`  | Seulement la bande. La voix et les alertes continuent.                                      |
| `/narsil discreto` | Voix coupée, alertes de fin de tour coupées, extras automatiques coupés ; le reste demeure. |

Chacune a son contraire : `voz`, `mostrar` et `normal`. Ce sont des interrupteurs indépendants, si bien que `/narsil normal` désactive le mode discret sans réactiver une voix coupée.

## Comment ça marche à l’intérieur

### Une seule préférence : `isQuiet`

Le mode discret est un seul booléen, `isQuiet`, dans l’atome `prefs` de `hooks/register.tsx` (son type, `Prefs`, se trouve dans `types/index.d.ts`). Le gestionnaire de la commande `/narsil` l’écrit au moyen d’une petite table :

```tsx
const change: Record<string, Partial<Prefs>> = {
  ocultar: { isHidden: true },
  mostrar: { isHidden: false },
  silencio: { isMuted: true },
  voz: { isMuted: false },
  discreto: { isQuiet: true },
  normal: { isQuiet: false },
}
```

Le correctif est fusionné dans l’atome et tout l’objet `prefs` est enregistré avec `$.store.set('prefs', …)`, si bien que le mode dure d’une session à l’autre jusqu’à ce que vous le changiez. Au `session.start`, les préférences stockées sont fusionnées par-dessus les valeurs par défaut, ce qui couvre aussi les anciennes valeurs stockées qui n’ont pas encore ce champ.

Il n’y a pas de chemin de code « discret » à part. À la place, chaque endroit qui fait du bruit lit `isQuiet` et décide pour lui-même. Cela garde la règle à côté de ce qu’elle gouverne, et cela signifie qu’un nouveau type de bruit doit adhérer explicitement au mode discret.

### La limite qu’il trace : « a besoin de vous » passe

Chaque alerte passe par `announce` (le guide 6 la décrit en entier). Ses premières lignes sont l’endroit où vit le mode discret :

```tsx
const { isMuted, isFloating, isQuiet } = await read($, prefs)
// Quiet: no voice, and only what needs you (a question, an error) is told.
if (isQuiet && kind === 'done' && !force) return
const spoken = isMuted || isQuiet ? Promise.resolve() : speak($, voice)
```

Une alerte a l’un de trois types : `done`, `question` ou `error`. En mode discret :

- une alerte `done` revient avant que quoi que ce soit ne se passe : pas de fenêtre flottante, pas de notification système, pas de téléphone, pas de voix ;
- une `question` ou une `error` continue comme d’habitude vers la fenêtre flottante (ou une notification système quand la fenêtre est désactivée) et vers le téléphone, simplement sans la voix.

La raison de cette limite se trouve dans le commentaire et dans le README : ce qui s’arrête, c’est ce que vous pouvez manquer sans risque. Un tour terminé sera toujours terminé quand vous regarderez. Une question ou une permission bloque le travail jusqu’à votre réponse, et une erreur signifie que le travail s’est arrêté. Les faire taire transformerait un mode discret en mode cassé.

L’indicateur `force` laisse tout de même passer deux appelants. `/narsil prueba`, l’alerte de test, est forcée, pour que vous puissiez vérifier vos alertes même en mode discret. Le rappel de cinq minutes pour une permission ou une question restée en attente est forcé aussi, bien qu’en tant que `question` il passerait de toute façon.

### Ce que fait chaque type d’alerte en mode discret

En passant en revue les appelants de `announce` :

| Moment                                                         | Type       | Mode discret                 |
| -------------------------------------------------------------- | ---------- | ---------------------------- |
| Un tour se termine (« He terminado »)                          | `done`     | arrêtée                      |
| Un sous-agent d’arrière-plan se termine bien                   | `done`     | arrêtée                      |
| Un sous-agent d’arrière-plan s’arrête ou échoue                | `error`    | affichée, sans voix          |
| Un tour échoue (« Me he detenido »)                            | `error`    | affichée, sans voix          |
| Une question, un plan ou une permission                        | `question` | affichée, sans voix          |
| Un tour se termine en demandant dans la boîte d’étape suivante | `question` | affichée, sans voix          |
| Toujours en attente au bout de 5 minutes                       | `question` | affichée, sans voix          |
| `/narsil prueba`                                               | `done`     | affichée (forcée), sans voix |

### Les autres bruits

En dehors de `announce`, quatre autres endroits lisent `isQuiet` :

- **La voix au début du travail.** Dans `turn.start`, un prompt que vous avez tapé lui fait dire une phrase de début, sauf si `isMuted` ou `isQuiet`.
- **Les conseils automatiques.** `mayTip` renvoie false quand `isQuiet`, avant de compter quoi que ce soit. Un conseil que vous demandez avec `/narsil consejo` n’est pas automatique et répond toujours.
- **Les étapes suivantes.** `offerSteps` revient aussitôt quand `isQuiet`.
- **Le résumé de session après inactivité.** `tickWatch` affiche le résumé après 30 minutes calmes uniquement quand `isQuiet` est false. `/narsil resumen` répond toujours.

### Ce que le mode discret ne touche pas

Lire le code dit aussi ce qui reste, et cela vaut la peine de le savoir :

- **La bande et le contenu de la fenêtre flottante.** Les états, les titres, les commentaires, la liste des conversations, l’horloge du cache et une célébration de montée de niveau sont dessinés comme avant. Le mode discret concerne les interruptions, pas l’information.
- **La suggestion de `/compact`** du guide 7. Elle est vérifiée par rapport à `isAdviceOn`, pas `isQuiet`, si bien qu’elle peut encore apparaître en mode discret. `/narsil consejos off` l’arrête.
- **L’avertissement sur les commandes dangereuses** du guide 9 : c’est un commentaire dans la bande et une ligne de journal, pas une alerte.
- **L’état silencieux envoyé au sujet `-estado` du téléphone** (guide 15). Il ne produit jamais de notification et, tant que les alertes du téléphone sont activées et que vous écrivez à distance, il part après chaque tour quel que soit le mode.

Quand le mode est activé, la commande `/narsil` seule ajoute une ligne à son rapport : « Modo discreto activado: sin voz, sin avisos de fin de turno ni consejos o pasos automáticos. » (« mode discret activé : pas de voix, pas d’alertes de fin de tour, pas de conseils ni d’étapes automatiques »).

## Comment on l’a demandé à l’IA

La demande d’origine pour le mode discret n’a pas été consignée. Les journaux de tâches publics du projet ne le couvrent pas.

### Reconstitution à partir de l’historique des commits

À partir de `git log -S isQuiet -- hooks/register.tsx` dans narsil-pet :

- `17ffb30` (2026-10-31) « feat: add a quiet mode that only speaks up when Narsil needs you » (ajouter un mode discret qui ne se manifeste que lorsque Narsil a besoin de vous). Un seul commit ajoute tout le mode : le champ `isQuiet`, le retour anticipé dans `announce`, les vérifications dans les conseils, les étapes suivantes et le résumé après inactivité, les mots `discreto` et `normal`, la ligne dans le rapport de la commande seule, une section du README et un test. Son sujet résume la conception en une phrase.
- `665bd4e` (2026-11-06) « feat: speak when work starts and vary every spoken phrase » (parler quand le travail commence et varier chaque phrase prononcée). La voix de début du travail est nouvelle ici, et elle lit `isQuiet` dès le premier jour. C’est le schéma en action : un nouveau bruit adhère au mode discret au moment où il est ajouté.

Le mode est arrivé tard dans la première semaine, après que la voix, les alertes, les conseils et les étapes suivantes existaient déjà. Cet ordre correspond à un chemin courant : un mod gagne des fonctionnalités une à une, et ce n’est qu’une fois qu’elles s’accumulent qu’il a besoin d’un seul interrupteur pour les baisser.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Mon mod Claude Code `my-pet` parle, alerte à la fin de chaque tour et affiche des conseils. Ajoute un mode discret : `/my-pet quiet` et `/my-pet normal` définissent un booléen `isQuiet` dans les préférences, enregistré avec `$.store.set` et chargé au `session.start`. Dans la fonction qui envoie chaque alerte, qui prend un type (`done`, `question`, `error`), reviens tôt pour `done` en mode discret sauf si l’alerte est un test forcé, et ne parle jamais en mode discret ; les questions et les erreurs s’affichent toujours. Saute aussi les conseils automatiques en mode discret, mais garde les conseils que la personne demande. Laisse la bande telle quelle. Ajoute des tests avec `claude-code/testing` : en mode discret, un tour terminé ne produit ni notification ni voix, et un appel `AskUserQuestion` notifie toujours.

## Le code minimal

Écrit pour ce guide et vérifié par rapport aux types 2.1.325 (`$.store.get`, `$.store.set`, `$.command.register`, `command.run`, `$.ui.notify`, `session.start`, `turn.complete`, `tool.call`). Il est adapté de `hooks/register.tsx` dans [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). L’atome `prefs` est déclaré dans `types/index.d.ts` comme `{ isQuiet: boolean }`. La fonction `speak` vide est l’endroit où va votre propre voix, comme celle du guide 6.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

type Kind = 'done' | 'question' | 'error'
const prefs = atom({ plugin: 'my-pet', key: 'prefs' } as const, { isQuiet: false })

async function speak($: EngineInterface, text: string): Promise<void> {
  // your own voice goes here (guide 6)
}

async function announce(
  $: EngineInterface,
  kind: Kind,
  title: string,
  text: string,
  force = false,
) {
  const { isQuiet } = await read($, prefs)
  // What you can safely miss stays quiet; what blocks the work never does.
  if (isQuiet && kind === 'done' && !force) return
  const spoken = isQuiet ? Promise.resolve() : speak($, text)
  try {
    await $.ui.notify(text, { title })
  } catch {
    // no notification channel on this surface
  }
  await spoken
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'my-pet', description: 'My pet: quiet | normal | test' })
    const saved = await $.store.get('prefs').catch(() => undefined)
    if (saved && typeof saved === 'object') await update($, prefs, (p) => ({ ...p, ...saved }))
    return next(e)
  })

  on('command.run', { command: 'my-pet' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'test') {
      await announce($, 'done', 'Test', 'This is how I will tell you.', true)
      return { text: 'My pet: test alert sent.' }
    }
    if (arg !== 'quiet' && arg !== 'normal') return { text: 'Usage: /my-pet quiet | normal | test' }
    const saved = await update($, prefs, (p) => ({ ...p, isQuiet: arg === 'quiet' }))
    await $.store.set('prefs', saved).catch(() => undefined)
    return {
      text: saved.isQuiet
        ? 'My pet: quiet. I only tell you when I need you.'
        : 'My pet: back to normal.',
    }
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId === undefined && e.tool === 'AskUserQuestion')
      await announce($, 'question', 'I need you', 'I have a question for you.')
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    if (e.reason === 'answer') await announce($, 'done', 'Done', 'I have finished.')
    else if (e.reason !== 'aborted')
      await announce($, 'error', 'I stopped', 'The turn ended with an error.')
    return result
  })
}
```

`update` renvoie la nouvelle valeur, si bien que la commande enregistre exactement ce qu’elle a écrit. Le `try` autour de `$.ui.notify` suit un commentaire du `notify` de Narsil : là où l’hôte n’a aucun notify, « the call throws before it returns a promise » (l’appel lève une exception avant de renvoyer une promesse), si bien qu’un `.catch` ne l’attraperait pas.

## Erreurs fréquentes et comment tester

- **Tout faire taire.** Un mode discret qui arrête aussi les questions et les erreurs laisse Claude attendre une permission que personne ne voit. Décidez par type d’alerte, selon que la manquer bloque ou non le travail.
- **Un indicateur à un seul endroit.** Si seule la fonction d’alerte lit l’indicateur, chaque bruit ajouté plus tard l’ignore. Narsil lit `isQuiet` à chaque endroit qui fait du bruit, et ajoute la vérification quand elle ajoute le bruit.
- **Laisser le mode discret arrêter le test.** Sans `force`, `/narsil prueba` ne ferait rien en mode discret, et la personne penserait que les alertes sont cassées.
- **Coupler les interrupteurs.** `normal` ne doit défaire que `discreto`. S’il réactivait aussi la voix, une personne qui avait d’abord coupé la voix de Narsil l’entendrait de nouveau.
- **Oublier de persister.** Une préférence gardée seulement dans un atome disparaît à la session suivante.

Pour tester, `tests/narsil.test.tsx` a deux tests pour cela. « /narsil discreto keeps her quiet, and /narsil normal brings everything back » (/narsil discreto la garde discrète, et /narsil normal remet tout) s’exécute sur un macOS simulé sans la fenêtre flottante, enregistre les scripts lancés pour la voix et les notifications, termine un tour et laisse passer onze minutes : rien n’est prononcé, aucune notification ne démarre, aucun modèle n’est interrogé ; ensuite, un appel `AskUserQuestion` produit exactement une notification intitulée « Narsil · Te necesito ». « in quiet mode the phone gets only what needs you » (en mode discret, le téléphone ne reçoit que ce qui a besoin de vous) vérifie la même règle sur le téléphone : après un tour terminé et une question, seule la question est publiée.

## Pour aller plus loin

- `announce` dans `hooks/register.tsx` est la seule fonction à lire pour savoir où va chaque alerte ; le guide sur la voix et les alertes la parcourt.
- La commande `/narsil` seule affiche toutes les préférences à la fois, celle-ci comprise. Le dernier guide du parcours, sur les commandes, montre comment elle est construite.
- Le guide suivant envoie les mêmes alertes à votre téléphone et à votre montre, sous la même règle de discrétion.
