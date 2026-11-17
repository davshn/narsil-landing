---
title: Le contexte et les limites
description: 'Comment Narsil trace une barre de contexte par conversation, prévoit son remplissage au rythme des 15 dernières minutes, suggère /compact une fois et montre les limites de 5 heures et hebdomadaire.'
route: pet
order: 7
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/usage.ts
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

Deux sortes de limites décident du temps pendant lequel vous pouvez continuer à travailler avec Claude, et Narsil affiche les deux.

**La fenêtre de contexte** est la quantité de conversation que le modèle peut garder en tête à la fois. Quand elle se remplit, Claude Code doit compacter la conversation en résumant ce qui précède, et des détails peuvent se perdre. Chaque conversation a sa propre fenêtre, si bien que chaque ligne de la bande de Narsil a sa propre barre et son propre pourcentage :

```text
● TRABAJANDO   ▾ web                     ██████░░░░ 62 %
```

La barre de votre propre conversation est bleue, pour qu’elle ressorte ; les autres sont vertes, orange au-delà de 60 % et rouges au-delà de 85 %. Appuyer sur le pourcentage de la conversation ouverte affiche ses tokens, le temps avant qu’elle soit pleine et ce qui la remplit :

- « 120k / 200k · lleno en ~20 min » (« pleine dans environ 20 minutes »).
- Une barre par partie, telle que `/context` la décompose : les messages, le prompt système, les outils MCP, les fichiers de mémoire, la réserve de compaction et l’espace libre, chacun avec ses tokens.

Quand le contexte dépasse 70 % et sera plein dans les 20 minutes, ou dès qu’il dépasse 85 %, Narsil suggère une fois : « El contexto va al 72 % y se llenará en ~13 min: es buen momento para /compact. » (« Le contexte est à 72 % et sera plein dans environ 13 minutes : c’est un bon moment pour /compact. »)

**Les limites du compte** sont la fenêtre de 5 heures et la fenêtre hebdomadaire d’un abonnement. Elles sont les mêmes pour toutes les conversations, si bien qu’elles s’affichent une seule fois, en haut, avec le temps restant avant que chacune ne recommence :

```text
5 horas  ███░░░░░░░ 31 %  reinicia en 2 h 05 min
Semana   █░░░░░░░░░ 12 %  reinicia en 3 d 4 h
```

Avec une clé d’API, ces fenêtres n’existent pas, et Narsil n’en affiche aucune.

## Comment ça marche à l’intérieur

### D’où viennent les chiffres

Narsil ne compte pas les tokens elle-même. Elle lit les chiffres dont Claude Code dispose déjà, les mêmes que ceux qu’affiche sa ligne d’état, à deux endroits de l’API de mod :

- **`$.session.usage()`**, appelée une fois dans `session.start`. Elle renvoie `context` (la fenêtre en cours : `window` en tokens, ainsi que `tokens` et `percent` dès qu’une réponse les a signalés) et `rateLimits`, une entrée par fenêtre, chacune avec un `kind` (`five_hour`, `seven_day`), un `percentUsed` et un horodatage `resetsAt` facultatif.
- **L’événement `session.measure`**, qui, selon les termes des types 2.1.325, « fires when the engine measures the session and a unit moved: after each main-thread turn, and when a rate-limit window moves a whole point » (se déclenche quand le moteur mesure la session et qu’une unité a bougé : après chaque tour du fil principal, et quand une fenêtre de limite d’utilisation bouge d’un point entier). Il porte les mêmes `context` et `rateLimits`.

Les deux passent par une seule fonction pure, `usageOf` dans `hooks/usage.ts`, qui les met dans la forme propre à Narsil : `context` (`percent`, `tokens`, `window`), `fiveHour` et `week`. Une fenêtre sans relevé vaut `null`. Les types disent que `rateLimits` est « empty off a subscription » (vide hors abonnement), et c’est pourquoi aucune limite ne s’affiche avec une clé d’API.

Ensuite, `setUsage` dans `hooks/register.tsx` enregistre le résultat dans l’atome `usage` (uniquement quand il a changé), consigne le relevé du contexte pour l’estimation, actualise la répartition et envoie l’état au hub, afin que les autres conversations et la fenêtre flottante voient la barre de celle-ci.

Le choix de conception est de recevoir les chiffres, pas de les demander à intervalles réguliers. Le moteur déclenche `session.measure` exactement quand un chiffre a bougé, si bien que Narsil ne demande jamais des chiffres qui n’ont pas pu changer.

### L’estimation : le rythme des 15 dernières minutes

« Pleine dans environ 20 minutes » est une extrapolation linéaire à partir des relevés récents. Chaque fois que le contexte est mesuré, `trackContext` ajoute un échantillon, `{ at, percent }`, à une liste d’au plus 30. Puis `minutesToFull` dans `hooks/usage.ts` fait le calcul :

1. Ne garder que les échantillons des 15 dernières minutes (`BURN_WINDOW_MS`).
2. Prendre le premier et le dernier. S’ils couvrent moins d’une minute, ou si le contexte n’a pas grandi, il n’y a pas d’estimation.
3. Le rythme est la croissance divisée par les minutes qui les séparent.
4. La réponse est la place restante divisée par le rythme, arrondie.

Par exemple : 50 % à la minute 0 et 60 % à la minute 5 font 2 % par minute, et les 40 % restants prennent 20 minutes.

Chaque choix a une raison :

- **Quinze minutes, pas toute la conversation.** Le travail arrive par vagues. Une longue période calme suivie d’une lecture intensive de fichiers doit donner une estimation proche, pas une moyenne qui masque la vague.
- **Pas d’estimation pour moins d’une minute ou pour un contexte qui ne grandit pas.** Deux relevés à quelques secondes d’écart, ou un contexte qui a diminué, donnent un rythme qui ne veut rien dire.
- **Oublier les échantillons quand le contexte diminue.** Une baisse signifie que `/compact` ou `/clear` a été exécuté. L’ancien rythme appartient à une conversation qui n’existe plus, donc la liste repart de zéro.
- **Masquer les estimations au-delà de deux heures.** `MAX_ESTIMATE_MINUTES` vaut 120 ; une prévision aussi lointaine est trop imprécise pour valoir la peine d’être affichée, comme le dit le commentaire.

### La suggestion de `/compact`, une seule fois

`trackContext` décide aussi de la suggestion, avec quatre constantes :

- `NUDGE_AT = 70` : jamais en dessous de 70 %.
- `NUDGE_WITHIN_MINUTES = 20` : à partir de 70 %, seulement si l’estimation dit que le contexte sera plein dans les 20 minutes.
- `NUDGE_ALWAYS_AT = 85` : à partir de 85 %, toujours, avec ou sans estimation.
- `NUDGE_RESET_BELOW = 50` : une fois que le contexte redescend sous 50 %, un nouveau remplissage peut donner lieu à une nouvelle suggestion.

Un indicateur, `isCompactNudged`, la limite à une fois par remplissage. La suggestion est l’un des conseils de Narsil (`showTip` avec le type `context`), si bien qu’elle apparaît là où apparaissent ses conseils, et elle est sautée quand les conseils sont désactivés (`/narsil consejos off`). Le raisonnement est le même que pour toutes les alertes de Narsil : un avertissement qui se répète à chaque tour finit vite par être ignoré.

### La répartition, estimée localement

Ce qui remplit le contexte vient de `$.session.usage({ breakdown: 'summary' })`. Les types décrivent les deux modes : `full` « sends one token-count request per tool and memory file, as /context does; `summary` estimates locally and sends none » (envoie une requête de comptage de tokens par outil et par fichier de mémoire, comme le fait /context ; `summary` estime localement et n’en envoie aucune). Narsil utilise `summary` et l’actualise chaque fois qu’une mesure change les chiffres, si bien que la répartition peut s’ouvrir immédiatement, même pour une autre conversation, dont la répartition transite par le hub.

`contextDetailOf` dans `hooks/usage.ts` garde les parties qui valent la peine d’être affichées : il écarte les schémas d’outils chargés à la demande (`deferred`, hors de la fenêtre) et les lignes vides, trie ce qui est utilisé par taille, puis la réserve de compaction, puis l’espace libre, et donne une couleur à chacun.

### Dessiner les barres

Les éléments de `hooks/usage.ts` sont petits et purs :

- `levelColor(percent)` : vert `#22B573`, orange `#F5B400` à partir de 60 %, rouge `#F0435A` à partir de 85 %.
- `textBar(percent)` : dix cellules de `█` et de `░`, pour les lignes de la bande.
- `minutesLabel` et `resetIn` : « 13 min », « 2 h 05 min », « 3 d 4 h ».
- `usageRows` : les lignes à dessiner, chacune avec sa note : les tokens et l’estimation pour le contexte, « reinicia en … » (recommence dans …) pour les limites.
- `usageSvg` : les mêmes lignes sous forme d’un petit SVG, utilisé sur le bureau, où chaque barre grandit à partir de zéro quand elle est dessinée et où le texte suit le thème clair ou sombre.

### Pourquoi une barre par conversation

Le contexte appartient à une conversation, pas à vous. Un seul chiffre de « contexte » pour plusieurs conversations ferait la moyenne de choses dont on ne peut pas faire la moyenne. C’est pourquoi la barre générale a été supprimée et chaque ligne a reçu la sienne, comme le consigne la section suivante. Les limites du compte sont le cas inverse : elles appartiennent au compte, donc elles s’affichent une seule fois.

## Comment on l’a demandé à l’IA

### Consigné : une barre par conversation

Les barres par conversation ont été demandées dans `odd/tasks/fleet-view.md` dans narsil-pet, dans la même conversation qui a produit la vue de toutes les conversations (L1 est datée du 2026-11-06 ; les entrées suivantes ne portent pas de date). L3 (extrait) :

> "la barra de contexto general tambien se iria por que no existe un contexto general y se reemplazaria por las barras de contexto de cada conversacion"

Traduction en français : la barre de contexte générale disparaîtrait aussi, parce qu’il n’existe pas de contexte général, et elle serait remplacée par la barre de contexte de chaque conversation. La spécification S5 du journal ajoute : « The account limits (5 hours, week) stay, shown once. » (les limites du compte, 5 heures et semaine, restent, affichées une seule fois).

La répartition a été demandée dans L2 (extrait) :

> "el detalle de como se llena el contexto deberia aparecer cuando se de click en la palabra contexto."

Traduction en français : le détail de la façon dont le contexte se remplit devrait apparaître quand on clique sur le mot « contexte ». L7 la consigne comme faite dans la bande. Un jour plus tard, `250d2c6` (2026-11-07) « feat: open the context from its percent and let next steps stand alone » (ouvrir le contexte depuis son pourcentage et laisser les étapes suivantes à part) a déplacé la commande de la bande du mot vers le pourcentage, là où le README et le code la placent aujourd’hui. Dans la fenêtre flottante, le mot « Contexto » l’ouvre toujours.

### Reconstitution à partir de l’historique des commits

Les barres, l’estimation et la suggestion sont antérieures à ce journal, et leurs demandes n’ont pas été consignées. À partir de `git log -- hooks/usage.ts hooks/register.tsx` :

- `630c0d8` (2026-10-30) « feat(usage): add context, 5-hour and weekly usage bars » (ajouter les barres d’utilisation du contexte, de 5 heures et hebdomadaire). La première version : une barre de contexte et les deux limites.
- `c885292` (2026-10-30) « feat: estimate when the context fills, react to tests and dangerous commands, show subagents » (estimer quand le contexte sera plein, réagir aux tests et aux commandes dangereuses, afficher les sous-agents). L’estimation sur 15 minutes et la suggestion de `/compact`.
- `2bcc97c` (2026-11-05) « feat: open the context breakdown from the usage bars and calm loop, steps and permission alerts » (ouvrir la répartition du contexte depuis les barres d’utilisation et calmer les alertes de boucle, d’étapes et d’autorisation). La répartition.
- `49f0fd9` (2026-11-06) « feat: list every open conversation in the band » (lister chaque conversation ouverte dans la bande). La barre passe dans la ligne de chaque conversation, comme le demandait L3.
- `d654e3b` (2026-11-06) « feat: list this conversation first with a blue context bar » (lister cette conversation en premier avec une barre de contexte bleue).
- `250d2c6` (2026-11-07), vu plus haut.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon mod Claude Code `my-pet`, affiche le remplissage de la fenêtre de contexte et les limites de 5 heures et hebdomadaire du compte dans la bande `AbovePrompt`. Lis-les une fois avec `$.session.usage()` dans `session.start`, puis à chaque événement `session.measure`, et garde-les dans un atome. Écris la logique sous forme de fonctions pures dans `hooks/usage.ts` : une qui met `context` et `rateLimits` (`five_hour`, `seven_day`) dans ma propre forme, une barre de texte de dix cellules, une couleur qui passe à l’orange à 60 % et au rouge à 85 %, et `minutesToFull(samples, now)`, qui estime quand le contexte sera plein à partir des relevés des 15 dernières minutes et renvoie null avec moins d’une minute de relevés ou sans croissance. Suggère `/compact` une fois par remplissage quand le contexte dépasse 70 % et sera plein dans les 20 minutes, ou dépasse 85 %. Ajoute des tests pour chaque fonction et vérifie chaque API par rapport aux types de plugin-authoring.

## Le code minimal

Écrit pour ce guide et vérifié par rapport aux types 2.1.325 (`$.session.usage`, `session.measure`, `SessionContextUsage`, `SessionRateLimit`, `$.clock.now`, `$.ui.toast`). Il est adapté de `hooks/usage.ts` et de `hooks/register.tsx` dans [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). L’atome `usage` est déclaré dans `types/index.d.ts` comme dans le premier guide.

La partie pure, `hooks/usage.ts` :

```ts
import type { SessionContextUsage, SessionRateLimit } from 'claude-code'

export type Meter = { percent: number; resetsAt?: string }
export type Usage = { context: number | null; fiveHour: Meter | null; week: Meter | null }
export type Sample = { at: number; percent: number }

export function usageOf(m: {
  context: SessionContextUsage
  rateLimits: readonly SessionRateLimit[]
}): Usage {
  const meter = (kind: string): Meter | null => {
    const r = m.rateLimits.find((x) => x.kind === kind)
    return r ? { percent: r.percentUsed, resetsAt: r.resetsAt } : null
  }
  return {
    context: m.context.percent ?? null,
    fiveHour: meter('five_hour'),
    week: meter('seven_day'),
  }
}

export const levelColor = (p: number) => (p >= 85 ? '#F0435A' : p >= 60 ? '#F5B400' : '#22B573')

export function textBar(percent: number, cells = 10): string {
  const full = Math.max(0, Math.min(cells, Math.round((percent / 100) * cells)))
  return '█'.repeat(full) + '░'.repeat(cells - full)
}

const WINDOW_MS = 15 * 60_000

export function minutesToFull(samples: readonly Sample[], now: number): number | null {
  const recent = samples.filter((s) => now - s.at <= WINDOW_MS)
  const first = recent[0]
  const last = recent.at(-1)
  if (!first || !last) return null
  const minutes = (last.at - first.at) / 60_000
  if (minutes < 1 || last.percent <= first.percent) return null
  const perMinute = (last.percent - first.percent) / minutes
  return Math.max(0, Math.round((100 - last.percent) / perMinute))
}
```

Les hooks, dans `hooks/register.tsx` :

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import { levelColor, minutesToFull, textBar, usageOf } from './usage'
import type { Sample, Usage } from './usage'

const usage = atom({ plugin: 'my-pet', key: 'usage' } as const, {
  context: null,
  fiveHour: null,
  week: null,
})
let samples: Sample[] = []
let isNudged = false

async function track($: EngineInterface, next: Usage): Promise<void> {
  await update($, usage, () => next)
  const percent = next.context
  if (percent === null) return
  const now = await $.clock.now()
  const last = samples.at(-1)
  if (last && percent < last.percent) samples = []
  if (percent < 50) isNudged = false
  samples = [...samples, { at: now, percent }].slice(-30)
  const toFull = minutesToFull(samples, now)
  const isNear = toFull !== null && toFull <= 20
  if (isNudged || percent < 70 || !(isNear || percent >= 85)) return
  isNudged = true
  $.ui.toast(`Context at ${Math.round(percent)} %: a good moment for /compact.`)
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    const spent = await $.session.usage().catch(() => undefined)
    if (spent) await track($, usageOf(spent))
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await track($, usageOf(e))
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const u = await read($, usage)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column" minWidth={0}>
        {u.context !== null ? (
          <Text
            color={levelColor(u.context)}
          >{`Context ${textBar(u.context)} ${Math.round(u.context)} %`}</Text>
        ) : null}
        {u.fiveHour ? (
          <Text>{`5 hours ${textBar(u.fiveHour.percent)} ${Math.round(u.fiveHour.percent)} %`}</Text>
        ) : null}
        {u.week ? (
          <Text>{`Week ${textBar(u.week.percent)} ${Math.round(u.week.percent)} %`}</Text>
        ) : null}
      </Box>
    )
  })
}
```

Narsil affiche la suggestion comme l’un de ses conseils ; une version minimale peut utiliser `$.ui.toast`, comme ici.

## Erreurs fréquentes et comment tester

- **Demander les chiffres à intervalles réguliers.** Un minuteur qui appelle `$.session.usage()` toutes les quelques secondes fait un travail que `session.measure` fait déjà pour vous, au moment où un chiffre bouge.
- **Supposer que les limites existent.** Hors abonnement, `rateLimits` est vide. Ne dessinez alors rien, plutôt qu’une barre à 0 %.
- **Un contexte encore sans pourcentage.** Avant la première réponse, `percent` et `tokens` peuvent être absents. Narsil traite un `percent` absent comme « aucun relevé ».
- **Garder l’ancien rythme après `/compact`.** Si les échantillons ne sont pas effacés quand le contexte diminue, l’estimation mélange deux conversations et dit n’importe quoi.
- **Une suggestion à chaque tour.** Sans un indicateur qui ne se réinitialise que lorsque le contexte baisse, le même conseil de `/compact` revient à 71, 72 et 73 %.
- **Demander la répartition `full` à chaque mesure.** `full` envoie des requêtes de comptage de tokens ; `summary` est local et gratuit.

Pour tester, `claude plugin test .` exécute `tests/narsil.test.tsx`. « the context bar tells when it will fill, and Narsil suggests /compact once when it is near » (la barre de contexte indique quand elle sera pleine, et Narsil suggère /compact une fois quand c’est proche) mesure 50 % puis, cinq minutes plus tard, 60 %, et vérifie le texte « 120k / 200k · lleno en ~20 min » ; il mesure ensuite 72 % à la minute 10 et 74 % à la minute 11 et vérifie qu’exactement une suggestion est partie, « El contexto va al 72 % y se llenará en ~13 min: es buen momento para /compact. ». « a context that is not growing shows no estimate and no nudge » (un contexte qui ne grandit pas n’affiche ni estimation ni suggestion) couvre un contexte qui diminue. « the band shows the 5-hour window and the week once, and the context in its conversation » (la bande affiche une seule fois la fenêtre de 5 heures et la semaine, et le contexte dans sa conversation), « off a plan, no limits show, and the context is read when the session starts » (hors abonnement, aucune limite ne s’affiche, et le contexte est lu au démarrage de la session) et « a press on the open conversation percent shows what fills the context, and another goes back to the bars » (un appui sur le pourcentage de la conversation ouverte montre ce qui remplit le contexte, et un autre revient aux barres) couvrent le reste. Les fonctions de `hooks/usage.ts` prennent des valeurs simples, si bien qu’on peut aussi les tester directement avec une liste d’échantillons et un `now` fixe.

## Pour aller plus loin

- `contextDetailOf`, `contextDetailRows` et `contextDetailSvg` dans `hooks/usage.ts` transforment la répartition de `/context` en barres.
- `usageSummary` et `contextDetailSummary` donnent une phrase pour les endroits qui ne peuvent pas dessiner de barres.
- `toggleContextDetail` dans `hooks/register.tsx` relit la répartition de cette conversation quand vous l’ouvrez, et affiche une notification toast s’il n’y parvient pas.
- `shownState` envoie au hub le `context` (son pourcentage et sa note) et le `contextDetail` de chaque conversation, et c’est ainsi que la bande d’une autre conversation et la fenêtre flottante dessinent une barre qu’elles n’ont pas mesurée.
