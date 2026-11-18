---
title: L’horloge du cache
description: 'Comment Narsil décompte le cache du prompt depuis le début de la dernière requête, 60 minutes avec un abonnement et 5 avec une clé d’API, et pourquoi le tour suivant coûte plus cher une fois refroidi.'
route: pet
order: 8
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: hooks/usage.ts
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Ce que ça fait

Quand un tour se termine et que Claude vous attend, Narsil affiche une petite horloge dans la ligne de la conversation :

```text
🧊 Caché: 42 min
```

Elle décompte, minute par minute, combien de temps le cache du prompt de cette conversation est censé durer. Quand elle atteint zéro, elle le dit : dans la bande, « 🧊 Caché fría » (« cache froid »), et dans la fenêtre flottante et le hub, la phrase complète « 🧊 Caché fría: el próximo mensaje se cobra completo » (« cache froid : le prochain message est facturé en entier »). Quand vous envoyez le prompt suivant, l’horloge disparaît, puisque Claude travaille de nouveau, et une nouvelle démarre quand ce tour se termine.

Pourquoi cela vous concerne : chaque message que vous envoyez fait relire toute la conversation à Claude. Le cache du prompt conserve la partie déjà envoyée, si bien qu’une réponse pendant sa durée de vie la réutilise. Comme le dit le README, le message coûte alors moins cher ; une fois le cache expiré, le message suivant est facturé en entier, et la conversation doit être réécrite dans le cache. Les types 2.1.325 décrivent cette réécriture, dans un autre contexte, comme « waited for, the longer the conversation the longer » (une attente, d’autant plus longue que la conversation est longue). L’horloge répond donc à une question pratique : si vous revenez maintenant à cette conversation, est-elle encore chaude ?

L’horloge suppose 60 minutes avec un abonnement et 5 minutes avec une clé d’API. `/narsil cache` indique la durée qu’elle décompte ; `/narsil cache 30` la règle à la main, et `/narsil cache auto` revient à une décision fondée sur votre compte.

La ligne de chaque conversation affiche sa propre horloge, si bien que vous pouvez voir quelles conversations sont encore chaudes avant d’en reprendre une.

## Comment ça marche à l’intérieur

### Pas un minuteur : une valeur et un battement

L’horloge est un atome, `cache`, dans `hooks/register.tsx`. Il contient quatre nombres :

- `at` : le moment où le tour s’est terminé.
- `requestAt` : le moment où la dernière requête au modèle du tour a commencé.
- `minutes` : la durée du cache.
- `left` : les minutes entières restantes, telles qu’affichées.

Rien ne décompte de soi-même. À chaque battement de deux secondes, `tickCache` recalcule `left` avec `cacheLeft` de `hooks/words.ts` :

```ts
export function cacheLeft(at: number, minutes: number, now: number): number {
  return Math.max(0, Math.ceil((at + minutes * 60_000 - now) / 60_000))
}
```

Elle n’écrit l’atome que lorsque le nombre de minutes a changé, si bien que la bande se redessine une fois par minute, et non toutes les deux secondes. Arrondir à l’entier supérieur signifie que « 1 min » reste affiché jusqu’à ce que la dernière seconde soit passée, et que zéro signifie que le cache a vraiment disparu.

### Quand elle démarre et s’arrête

Trois événements la pilotent :

- **`turn.step`** se déclenche quand le moteur s’apprête à envoyer une requête au modèle. Pour la conversation principale (`e.agentId === undefined`), Narsil enregistre l’heure dans `lastRequestAt`. Les requêtes d’un sous-agent sont laissées de côté : comme le dit le commentaire, les requêtes d’un sous-agent ont leur propre cache.
- **`turn.complete`** pour la conversation principale appelle `startCache`, qui écrit l’atome avec `at` fixé à maintenant et `requestAt` fixé à `lastRequestAt`.
- **`turn.start`** efface l’atome : pendant que Claude travaille, il n’y a pas d’horloge.

### Pourquoi depuis le début de la dernière requête

L’horloge compte à partir du début de la dernière requête, et non de la fin du tour. La fonction auxiliaire `cacheStart` dit pourquoi dans son commentaire : « the API counts it from the start of the request that last read or wrote it » (l’API le compte à partir du début de la requête qui l’a lu ou écrit en dernier). Une longue réponse qui a pris trois minutes à s’écrire a déjà consommé trois des minutes du cache au moment où le tour se termine.

C’était un correctif, `c3e4464`, et le test qui le fixe se lit comme l’explication : avec un cache de cinq minutes et trois minutes passées pendant que le modèle répondait, la bande affiche « 🧊 Caché: 2 min » à la fin du tour, et non cinq.

Les étapes suivantes que Narsil propose après un tour calme comptent toujours à partir de la fin du tour (`at`) : elles portent sur votre absence, pas sur le cache.

### Choisir entre 60 et 5 minutes

La durée du cache n’est pas quelque chose que le mod peut lire. Le commentaire au-dessus des constantes le dit :

```tsx
// How long the prompt cache lasts, in minutes: on a plan Claude Code keeps it
// an hour, with an API key five minutes. The API does not say which: a
// person who knows better sets it with /narsil cache.
const PLAN_CACHE_MINUTES = 60
const API_CACHE_MINUTES = 5
```

Traduction en français du commentaire : la durée du cache du prompt, en minutes ; avec un abonnement, Claude Code le garde une heure, avec une clé d’API cinq minutes. L’API ne dit pas lequel des deux s’applique : une personne mieux informée le règle avec /narsil cache.

`cacheMinutes` décide donc en deux étapes :

1. Si vous avez fixé un nombre avec `/narsil cache <min>`, ce nombre.
2. Sinon, selon que le compte a des fenêtres de limite d’utilisation ou non. Si l’atome `usage` (guide précédent) contient un relevé de 5 heures ou hebdomadaire, c’est un abonnement et le cache reçoit 60 minutes ; sinon, c’est une clé d’API et le cache reçoit 5 minutes.

La seconde étape s’appuie sur ce que disent les types 2.1.325 de `rateLimits` : « empty off a subscription » (vide hors abonnement). La décision est prise à la fin du tour, à partir de ce que contient l’atome `usage` à ce moment-là.

Les nombres 60 et 5 sont l’hypothèse du mod, énoncée dans son code et son README, et non un chiffre que Claude Code signale. Le réglage manuel existe parce que l’auteur ou l’autrice savait que l’hypothèse pouvait être fausse pour la configuration de quelqu’un. Un nouveau réglage recalcule aussi l’horloge déjà en cours.

### Ce qu’elle dessine, et où

Le texte vient de `cacheLabel` dans `hooks/words.ts` : « 🧊 Caché: N min » tant que le cache est chaud, la phrase du cache froid à zéro. `cacheShort` raccourcit la phrase du cache froid en « 🧊 Caché fría » pour les lignes de la bande, qui ont peu de place ; la fenêtre flottante affiche le libellé en entier quand vous ouvrez une conversation.

Chaque conversation envoie aussi au hub `cacheEndsAt`, le moment où son cache expire, en secondes, et `cacheMinutes`. Avec ces valeurs, les autres conversations, la fenêtre flottante et le téléphone peuvent décompter une horloge qu’ils n’ont pas démarrée.

Le README dit que l’horloge est verte tant que le cache est frais et rouge quand il est sur le point d’expirer, et `hooks/words.ts` contient un `cacheColor` pour cela, fondé sur la part de la durée de vie du cache déjà écoulée. Dans le code actuel, `hooks/register.tsx` importe `cacheColor` mais ne l’appelle jamais : la bande dessine l’horloge sous forme de texte atténué, et la fenêtre flottante sous forme de simple note. Si vous construisez la vôtre, la couleur s’ajoute en une ligne, comme le montre le code plus bas.

## Le construire avec Claude

Demandez à Claude un compte à rebours qui affiche, après chaque tour, combien de temps le cache du prompt devrait encore durer. L’idée que Claude doit bien saisir : l’horloge compte à partir du début de la dernière requête, pas de la fin du tour.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon mod Claude Code `my-pet`, affiche un compte à rebours du cache du prompt dans la bande `AbovePrompt` pendant que Claude m’attend. Dans `turn.step`, pour la conversation principale uniquement (`e.agentId === undefined`), enregistre l’heure avec `$.clock.now()` avant la requête et laisse passer le flux avec `return yield* next(e)`. Dans `turn.complete`, pour la conversation principale, démarre une horloge dans un atome à partir de cette heure de requête ; efface-la dans `turn.start`. Compte 60 minutes quand `$.session.usage()` signale des fenêtres de limite d’utilisation et 5 minutes quand il n’en signale aucune, et laisse une commande `/pet cache <min>` imposer une autre valeur. Toutes les quelques secondes, avec `$.clock.every`, recalcule les minutes entières restantes, arrondies à l’entier supérieur, et n’écris l’atome que lorsque le nombre a changé. Affiche « Cache: N min » et, à zéro, « Cache cold: the next message is billed in full ». Ajoute un test avec une horloge simulée qui vérifie qu’une réponse de trois minutes laisse deux minutes d’un cache de cinq minutes.

### Ce qu’il faut vérifier dans la réponse de Claude

1. L’heure de la requête est enregistrée dans `turn.step`, uniquement pour la conversation principale (`e.agentId === undefined`), et le hook continue de transmettre le flux avec `return yield* next(e)`.
2. `turn.complete` démarre l’horloge à partir de cette heure de requête, et `turn.start` l’efface, si bien qu’il n’y a pas d’horloge pendant que Claude travaille.
3. Les minutes restantes sont arrondies vers le haut, et l’atome n’est écrit que lorsque ce nombre change, pas à chaque battement.
4. Le cache dure 60 minutes quand le compte a des fenêtres de limite de débit et 5 quand il n’en a pas, et une commande permet de le régler à la main.
5. Un test avec une horloge simulée montre qu’une réponse de trois minutes laisse deux minutes d’un cache de cinq minutes.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « après une longue réponse, l’horloge affiche les 5 min complètes » ou « les réponses de Claude ne s’affichent plus à l’écran ».

### Comment l’auteur l’a demandé

La demande d’origine de l’horloge du cache n’a pas été consignée. Elle est arrivée le 2026-10-30, avant les journaux de tâches publics.

#### Consigné : le cache reste

La seule mention consignée se trouve dans `odd/tasks/fleet-view.md` dans narsil-pet, L2 (extrait), au moment où l’auteur ou l’autrice retirait des sections de la bande pour faire de la place à la liste des conversations :

> "la del cache la mantenemos, la del dinero tambien podriamos eliminarla"

Traduction en français : celle du cache, on la garde ; celle de l’argent, on pourrait aussi la supprimer. Le décompte des dépenses est parti ; l’horloge du cache est restée, et la conception convenue dans L4 l’a placée dans la ligne de chaque conversation : « the list of conversations (state, title, context bar, cache clock) » (la liste des conversations : état, titre, barre de contexte, horloge du cache).

#### Reconstitution à partir de l’historique des commits

À partir de `git log -- hooks/register.tsx hooks/words.ts`, les commits qui ont touché l’horloge :

- `0993bd7` (2026-10-30) « feat: show a prompt-cache clock and offer next steps after a turn » (afficher une horloge du cache du prompt et proposer des étapes suivantes après un tour). L’horloge et les étapes suivantes arrivent ensemble, toutes deux démarrées par la fin d’un tour.
- `0cfc369` (2026-10-31) « refactor: move Narsil's wording and labels out of the hooks module » (sortir les textes et les libellés de Narsil du module des hooks). Les libellés passent dans `hooks/words.ts`.
- `4f8abaa` (2026-11-01) « feat: send the state the band shows to a status topic for your own phone app » (envoyer l’état qu’affiche la bande à un sujet d’état pour votre propre application de téléphone). Le cache voyage jusqu’au téléphone.
- `49f0fd9` (2026-11-06) « feat: list every open conversation in the band » (lister chaque conversation ouverte dans la bande). L’horloge passe dans chaque ligne.
- `0072d87` (2026-11-07) « fix: make room for the cache in each band row » (faire de la place pour le cache dans chaque ligne de la bande).
- `c3e4464` (2026-11-09) « fix: count the prompt cache from the start of its last request » (compter le cache du prompt à partir du début de sa dernière requête). La correction décrite plus haut : avant elle, l’horloge démarrait à la fin du tour et surestimait ce qui restait après une longue réponse.

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide. Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

Écrit pour ce guide et vérifié par rapport aux types 2.1.325 (`turn.step`, `turn.start`, `turn.complete`, `$.clock.now`, `$.clock.every`, `$.session.usage`). Il est adapté de `hooks/register.tsx` et de `hooks/words.ts` dans [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). L’atome `cache` est déclaré dans `types/index.d.ts` comme dans le premier guide, avec le type `{ requestAt: number; minutes: number; left: number } | null`.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const cache = atom({ plugin: 'my-pet', key: 'cache' } as const, null)
let lastRequestAt: number | null = null

const minutesLeft = (from: number, minutes: number, now: number) =>
  Math.max(0, Math.ceil((from + minutes * 60_000 - now) / 60_000))

async function cacheMinutes($: EngineInterface): Promise<number> {
  const usage = await $.session.usage().catch(() => undefined)
  return usage && usage.rateLimits.length > 0 ? 60 : 5
}

async function tick($: EngineInterface): Promise<void> {
  const c = await read($, cache)
  if (!c) return
  const left = minutesLeft(c.requestAt, c.minutes, await $.clock.now())
  if (left !== c.left) await update($, cache, (k) => (k ? { ...k, left } : k))
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    $.clock.every(5000, () => void tick($))
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) lastRequestAt = await $.clock.now()
    return yield* next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) await update($, cache, () => null)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    const now = await $.clock.now()
    const requestAt = lastRequestAt ?? now
    const minutes = await cacheMinutes($)
    await update($, cache, () => ({
      requestAt,
      minutes,
      left: minutesLeft(requestAt, minutes, now),
    }))
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const c = await read($, cache)
    if (!c) return next(e)
    const { Text } = $.ui.resolve(e)
    const spent = 100 - (c.left / c.minutes) * 100
    const color = spent >= 85 ? '#F0435A' : spent >= 60 ? '#F5B400' : '#22B573'
    return c.left > 0 ? (
      <Text color={color}>{`🧊 Cache: ${c.left} min`}</Text>
    ) : (
      <Text color={color}>🧊 Cache cold: the next message is billed in full</Text>
    )
  })
}
```

Cette version interroge `$.session.usage()` à la fin de chaque tour. Narsil lit plutôt les mêmes chiffres dans son atome `usage`, tenu à jour par `session.measure` (guide précédent), ce qui épargne l’appel.

## Erreurs fréquentes et comment tester

- **Compter à partir de la fin du tour.** La durée de vie du cache commence avec la requête. Après une longue réponse, une horloge démarrée à la fin affiche des minutes déjà écoulées (`c3e4464`).
- **Laisser les sous-agents déplacer l’horloge.** Les requêtes d’un sous-agent déclenchent aussi `turn.step`, avec `e.agentId` renseigné, et elles ont leur propre cache. Narsil n’enregistre que celles de la conversation principale.
- **Une horloge pendant que Claude travaille.** Chaque nouvelle requête réécrit le cache, si bien qu’un compte à rebours pendant un tour ne veut rien dire. Effacez-le dans `turn.start`.
- **Redessiner à chaque battement.** Recalculez souvent, n’écrivez que lorsque la minute change.
- **Traiter 60 et 5 comme des faits.** Ce sont les hypothèses du mod sur la façon dont Claude Code et l’API configurent le cache. Donnez à la personne un moyen de les remplacer.
- **Avaler le flux dans `turn.step`.** Le hook est un générateur : transmettez chaque fragment (`return yield* next(e)` ou un `for await` qui transmet chacun d’eux), sinon la réponse cesse d’atteindre l’écran.

Pour tester, `claude plugin test .` exécute `tests/narsil.test.tsx` avec une horloge simulée. « after a turn the band counts down the prompt cache, and says when it has gone cold » (après un tour, la bande décompte le cache du prompt, et dit quand il est devenu froid) vérifie « 🧊 Caché: 5 min » hors abonnement, puis « 🧊 Caché: 2 min », puis « 🧊 Caché fría » dans la bande pendant que le hub reçoit la phrase complète, et qu’un nouveau tour retire l’horloge. « the cache counts from the start of the last request, not from the end of the turn » (le cache compte à partir du début de la dernière requête, et non de la fin du tour) vérifie « 🧊 Caché: 2 min » après une réponse de trois minutes et le `cacheEndsAt` exact envoyé au hub. « a request of a subagent does not move the cache clock of the conversation » (une requête d’un sous-agent ne déplace pas l’horloge du cache de la conversation) et « on a plan the cache lasts an hour, and /narsil cache sets it by hand » (avec un abonnement, le cache dure une heure, et /narsil cache le règle à la main) couvrent le reste.

## Pour aller plus loin

- `stepsCommand` dans `hooks/register.tsx` gère `/narsil cache`, `/narsil cache auto` et `/narsil cache <min>`, et accepte aussi `caché` avec son accent.
- `offerSteps` utilise le même moment de fin de tour, `at`, pour proposer des étapes suivantes 15 minutes après un tour (`STEPS_AFTER_MS`).
- `shownState` envoie `cache`, `cacheEndsAt` et `cacheMinutes` au hub pour la fenêtre flottante, les autres conversations et le téléphone.
- `cacheColor` dans `hooks/words.ts` est prêt pour une horloge en couleur, avec les mêmes seuils que `levelColor` pour les barres d’utilisation dans `hooks/usage.ts`.
