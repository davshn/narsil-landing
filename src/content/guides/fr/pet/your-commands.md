---
title: Vos propres /commandes
description: 'Comment /narsil est enregistré comme une seule commande slash à nombreuses sous-commandes, comment ses mots sont répartis, comment la commande seule sert d’aide, et comment la tester.'
route: pet
order: 17
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: docs/plan-advice.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Ce que ça fait

Chaque fonctionnalité de ce parcours a un interrupteur ou une question, et tous vivent sous une seule commande slash : `/narsil`. Vous tapez `/narsil` et un mot, et Narsil répond dans la transcription. Tapée seule, `/narsil` vous dit comment elle est configurée et liste chaque mot qu’elle accepte.

Les mots, tels que le code les répartit (Narsil parle espagnol, donc les mots sont en espagnol) :

| Commande                                                            | Ce qu’elle fait                                                                                    |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `/narsil`                                                           | Affiche les réglages actuels et la ligne d’usage.                                                  |
| `/narsil estado`                                                    | Dit ce qu’elle fait, combien de conversations sont ouvertes, et sur quelles surfaces elle dessine. |
| `/narsil ocultar` · `mostrar`                                       | Masque ou affiche la bande.                                                                        |
| `/narsil silencio` · `voz`                                          | Coupe ou active la voix.                                                                           |
| `/narsil discreto` · `normal`                                       | Active ou désactive le mode discret (guide 14).                                                    |
| `/narsil flotante`                                                  | Active ou désactive la fenêtre flottante (guide 5).                                                |
| `/narsil prueba`                                                    | Envoie une alerte de test, avec la voix.                                                           |
| `/narsil consejo` · `consejo profundo`                              | Demande un conseil maintenant, ou un conseil sur toute la conversation (guide 11).                 |
| `/narsil consejos on` · `off` · `cada <min>` · `voz`                | Conseils automatiques activés ou désactivés, leur espacement, lus à voix haute ou non.             |
| `/narsil pasos on` · `off`                                          | Étapes suivantes activées ou désactivées (guide 12).                                               |
| `/narsil cache` · `cache <min>` · `cache auto`                      | Dit, définit ou déduit la durée du cache du prompt (guide 8).                                      |
| `/narsil resumen`                                                   | Le résumé de session (guide 16).                                                                   |
| `/narsil nivel`                                                     | Niveau, étape et façon dont elle gagne de l’XP (guide 13).                                         |
| `/narsil movil` · `on` · `off` · `nuevo` · `prueba` · `clave [off]` | Alertes sur le téléphone (guide 15).                                                               |

Le tableau « Comandos » (« commandes ») du README liste les mêmes mots, et ils concordent avec le code.

Une commande au lieu de quinze garde l’autocomplétion propre : vous tapez `/nar`, et tout ce que Narsil sait faire se trouve derrière un seul nom.

## Comment ça marche à l’intérieur

### Enregistrer : `$.command.register`

Un mod déclare une commande slash à l’exécution. Narsil le fait en tout premier dans `session.start` :

```tsx
await $.command.register({
  name: 'narsil',
  description:
    'Narsil, tu mascota: estado | ocultar | mostrar | silencio | voz | discreto | normal | flotante | prueba | consejo [profundo] | consejos on|off|cada <min>|voz | pasos on|off | cache [auto|<min>] | resumen | nivel | movil [on|off|nuevo|prueba|clave [off]]',
})
```

Les types 2.1.325 décrivent `$.command.register` ainsi : « Declares the slash command `/<name>` for this session, listed in the typeahead from the next keystroke on » (déclare la commande slash `/<name>` pour cette session, listée dans l’autocomplétion dès la frappe suivante). Trois points de cette phrase façonnent la conception :

- **« for this session » (pour cette session).** L’enregistrement ne survit pas à la session, c’est pourquoi il a lieu à chaque `session.start`.
- **La spécification.** `CommandSpec` a `name` (lettres, chiffres, `_` et `-`, jusqu’à 64), `description` (« The one line the typeahead and `/help` show for it », la ligne unique que l’autocomplétion et `/help` affichent pour elle), un `argumentHint` facultatif (« The hint drawn dim after the name », l’indication dessinée en grisé après le nom) et un `immediate` facultatif. « Registering a name again replaces it; a built-in's name is refused. » (enregistrer de nouveau un nom le remplace ; le nom d’une commande intégrée est refusé).
- **La servir.** « Serve it with a `command.run` hook on `{ command: "<name>" }` that returns `{ text }` » (servez-la avec un hook `command.run` sur `{ command: "<name>" }` qui renvoie `{ text }`).

Narsil met la liste des mots dans `description`, si bien que l’autocomplétion et `/help` les montrent tous (la description commence par « Narsil, tu mascota », « Narsil, ta mascotte »). Elle n’utilise pas `argumentHint` ; une courte indication comme `[estado | resumen | …]` serait l’alternative, au prix d’en montrer moins.

Elle ne définit pas non plus `immediate`. Sans lui, disent les types, une commande tapée pendant qu’un tour est en cours attend « for the turn to end » (que le tour se termine). `/narsil discreto` tapé en plein tour prend donc effet après le tour. Avec `immediate`, le hook « must not assume the turn's state » (ne doit pas présumer de l’état du tour), ce qui est beaucoup demander à un gestionnaire qui en lit et en écrit une si grande partie.

### Servir : un seul hook `command.run`

Le hook est enregistré avec un filtre, si bien qu’il ne s’exécute que pour `/narsil` :

```tsx
on('command.run', { command: 'narsil' }, async ($, e) => {
  await noteOrigin($, e.origin)
  const arg = e.args.trim().toLowerCase().replace(/\s+/g, ' ')
  // …
})
```

Il n’appelle jamais `next`. Les types expliquent ce que cela signifie : « A hook's own answer without `next` runs no command: its `text` is shown as the command's output » (la réponse propre d’un hook sans `next` n’exécute aucune commande : son `text` est affiché comme sortie de la commande). Puisque rien d’autre n’implémente `/narsil`, il n’y a rien à qui passer la main.

Trois choses se produisent avant qu’un mot ne soit lu :

- **`noteOrigin($, e.origin)`.** L’`origin` d’une commande dit d’où elle vient, comme celle de `prompt.submit`. Lancer `/narsil` depuis le téléphone compte comme écrire à distance (guide 15).
- **Normaliser les mots.** `e.args` est « Everything after the name, as typed » (tout ce qui suit le nom, tel que tapé). Narsil le rogne, le met en minuscules et réduit les suites d’espaces, si bien que `/narsil  Consejos   OFF` fonctionne.
- **Les accents.** Le groupe du téléphone accepte `movil` et `móvil`, et le motif du cache, `/^cach[eé](?: (auto|\d{1,3}))?$/`, accepte `cache` et `caché`. Les gens tapent les deux.

### Répartir : des groupes qui répondent « pas à moi »

Le corps est une chaîne. Les trois groupes les plus grands vivent chacun à côté de leur fonctionnalité, sous forme de fonctions qui renvoient le texte de la réponse, ou `undefined` pour les mots qui ne sont pas les leurs :

```tsx
const advice = await adviceCommand($, arg)
if (advice !== undefined) return { text: advice }
const stepped = await stepsCommand($, arg)
if (stepped !== undefined) return { text: stepped }
const phoned = await phoneCommand($, arg)
if (phoned !== undefined) return { text: phoned }
```

- `adviceCommand` prend `consejo`, `consejo profundo` et `consejos …`.
- `stepsCommand` prend `pasos on|off` et `cache [auto|<min>]`.
- `phoneCommand` prend `movil …`.

Un groupe qui reconnaît son premier mot mais pas la suite répond avec sa propre ligne d’usage au lieu de `undefined` : `/narsil consejo raro` reçoit « Uso: /narsil consejo [profundo] | consejos on | off | cada <min> | voz », et `/narsil movil raro` reçoit « Uso: /narsil movil [on | off | nuevo | prueba | clave [off]] ». La personne voit les mots qui correspondent à ce qu’elle essayait de faire, pas toute la liste.

Ensuite, le gestionnaire principal prend lui-même le reste : `resumen` et `nivel` répondent aussitôt ; `prueba`, `estado` et `flotante` ont chacun une branche ; et six mots d’activation et de désactivation partagent une table, `change`, qui associe chaque mot à un correctif des préférences (`ocultar` à `{ isHidden: true }`, `discreto` à `{ isQuiet: true }`, et ainsi de suite). Un mot connu est fusionné dans l’atome `prefs` et enregistré avec `$.store.set('prefs', …)`, si bien que chaque réglage survit à la session.

La conception garde les mots de chaque fonctionnalité avec la fonctionnalité. Ajouter un groupe de commandes à une fonctionnalité demande une fonction dans sa propre section et une ligne dans la chaîne.

### La commande seule est l’aide

Tout ce que la chaîne ne reconnaît pas, y compris `/narsil` vide, tombe à la fin, où `patch` est undefined. Cette branche lit les préférences et les affiche : si la bande est visible, la voix activée, la fenêtre flottante activée ; les conseils et leur espacement ; les étapes suivantes et la durée du cache ; une ligne pour le mode discret quand il est activé. La dernière ligne est la ligne d’usage, la même liste de mots que la description.

Il n’y a donc pas de mot `ayuda` (« aide ») à part : une faute de frappe et un simple `/narsil` répondent tous deux avec l’état et les mots. Cela correspond au README, dont la première ligne dit que `/narsil` « Muestra la configuración actual y la ayuda » (« affiche la configuration actuelle et l’aide »).

La liste des mots vit à trois endroits : la description, la ligne d’usage et le README. Le plan des conseils, `docs/plan-advice.md`, le dit sans détour quand il ajoute les mots `consejo` : « Update the command description and the usage text of `/narsil`. » (mettre à jour la description de la commande et le texte d’usage de `/narsil`). Garder les trois en accord est une tâche manuelle dans Narsil.

### Ce qu’est la réponse

Chaque branche renvoie `{ text }`, un `CommandRunResult`. Deux de ses champs valent la peine d’être connus même si Narsil ne les utilise pas. `context` est « What the model reads after the command's output and the person never sees » (ce que le modèle lit après la sortie de la commande et que la personne ne voit jamais). `isTextDisplayOnly` garde le texte hors des requêtes du modèle, mais les types disent qu’il n’est respecté que lorsque chaque plugin qui intercepte la commande est livré avec Claude Code : « Any other plugin's text stays in requests » (le texte de tout autre plugin reste dans les requêtes). Ainsi, tout ce que répond `/narsil`, la clé du téléphone du guide 15 comprise, fait partie de ce que lit le modèle.

## Comment on l’a demandé à l’IA

La demande d’origine pour `/narsil` n’a pas été consignée. Ce qui est consigné, c’est une étape d’un plan : dans `docs/plan-advice.md`, parmi les commandes qu’ajoutent les conseils, le plan dit :

> "Update the command description and the usage text of `/narsil`."

Traduction en français : mettre à jour la description de la commande et le texte d’usage de `/narsil`.

Ce sont les mots du plan, pas la demande de l’auteur ou de l’autrice.

### Reconstitution à partir de l’historique des commits

À partir de `git log -G "Narsil, tu mascota" -- hooks/register.tsx`, qui trouve chaque commit ayant modifié la description enregistrée :

- `b1187f3` (2026-10-30) « feat: show Narsil above the prompt with clear states and /narsil » (afficher Narsil au-dessus du prompt avec des états clairs et /narsil). La commande naît avec la bande, et sa première description dit « Narsil, tu mascota: estado | ocultar | mostrar | silencio | voz | flotante | prueba ».
- `467a64b` (2026-10-30) « feat(advice): give short, concrete tips about the work in progress » (donner des conseils courts et concrets sur le travail en cours). Les mots `consejo`.
- `0993bd7` (2026-10-30) « feat: show a prompt-cache clock and offer next steps after a turn » (afficher une horloge du cache du prompt et proposer des étapes suivantes après un tour). `pasos` et `cache`.
- `f7a494e` (2026-10-30) « feat: warn about loops, insist on waiting permissions and sum the session up » (avertir des boucles, insister sur les permissions en attente et résumer la session). `resumen`.
- `8913cdd` (2026-10-30) « feat: let Narsil earn experience and levels kept across sessions » (permettre à Narsil de gagner de l’expérience et des niveaux conservés d’une session à l’autre). `nivel`.
- `17ffb30` (2026-10-31) « feat: add a quiet mode that only speaks up when Narsil needs you » (ajouter un mode discret qui ne se manifeste que lorsque Narsil a besoin de vous). `discreto` et `normal`.
- `d91997f` (2026-10-31) « feat: send what needs you to your phone and watch through ntfy, with Narsil's picture » (envoyer ce qui a besoin de vous à votre téléphone et à votre montre via ntfy, avec l’image de Narsil). `movil`.
- `5a9ee10` (2026-11-01) « feat: seal phone messages with /narsil movil clave, send reset times and an Abrir Claude button » (sceller les messages du téléphone avec /narsil movil clave, envoyer les heures de réinitialisation et un bouton Abrir Claude). `clave`.

La commande a grandi un mot à la fois, chacun avec la fonctionnalité qu’il contrôle, et chaque commit a touché la description dans le même changement. C’est l’habitude que demande le plan.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Donne à mon mod Claude Code `my-pet` une seule commande slash, `/my-pet`, avec des sous-commandes. Dans `session.start`, appelle `$.command.register` avec le nom et une description qui liste chaque sous-commande. Sers-la avec un seul hook `command.run` filtré sur `{ command: 'my-pet' }` qui renvoie `{ text }` sans appeler `next`. Normalise `e.args` (rognage, minuscules, espaces simples). Donne à chaque fonctionnalité sa propre fonction qui renvoie la réponse pour ses mots, sa propre ligne d’usage pour un premier mot connu suivi d’une suite inconnue, ou `undefined` pour les mots qui ne sont pas les siens, et enchaîne-les. Associe les mots simples d’activation et de désactivation à un correctif d’un atome `prefs` enregistré avec `$.store.set`. Pour un argument vide ou inconnu, affiche les réglages actuels et la ligne d’usage. Garde la description, la ligne d’usage et le README en accord. Teste avec `claude-code/testing`, en appelant `$.command.run({ command: 'my-pet', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } })`, que chaque mot répond et qu’un mot inconnu affiche la ligne d’usage.

## Le code minimal

Écrit pour ce guide et vérifié par rapport aux types 2.1.325 (`$.command.register`, `command.run`, `$.store.get`, `$.store.set`, `session.start`). Il est adapté de `hooks/register.tsx` dans [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). L’atome `prefs` est déclaré dans `types/index.d.ts` comme `{ isHidden: boolean; isMuted: boolean }`.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const WORDS = 'status | hide | show | mute | voice | tips on|off'
const prefs = atom({ plugin: 'my-pet', key: 'prefs' } as const, { isHidden: false, isMuted: false })

// One feature's words: its answer, its own usage line, or undefined when the words are not its own.
async function tipsCommand($: EngineInterface, arg: string): Promise<string | undefined> {
  if (arg === 'tips on' || arg === 'tips off')
    return `My pet: tips ${arg === 'tips on' ? 'on' : 'off'}.`
  if (arg.startsWith('tips')) return 'Usage: /my-pet tips on | off'
  return undefined
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    // Registered for this session only: every session registers it again.
    await $.command.register({ name: 'my-pet', description: `My pet: ${WORDS}` })
    const saved = await $.store.get('prefs').catch(() => undefined)
    if (saved && typeof saved === 'object') await update($, prefs, (p) => ({ ...p, ...saved }))
    return next(e)
  })

  on('command.run', { command: 'my-pet' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase().replace(/\s+/g, ' ')
    const tips = await tipsCommand($, arg)
    if (tips !== undefined) return { text: tips }

    const change: Record<string, { isHidden?: boolean; isMuted?: boolean }> = {
      hide: { isHidden: true },
      show: { isHidden: false },
      mute: { isMuted: true },
      voice: { isMuted: false },
    }
    const patch = arg === 'status' ? undefined : change[arg]
    if (!patch) {
      // The bare command, a typo and "status" all answer with the state and the words.
      const p = await read($, prefs)
      return {
        text: `My pet is ${p.isHidden ? 'hidden' : 'visible'}, with the voice ${p.isMuted ? 'off' : 'on'}.\nUsage: /my-pet ${WORDS}`,
      }
    }
    const saved = await update($, prefs, (p) => ({ ...p, ...patch }))
    await $.store.set('prefs', saved).catch(() => undefined)
    return { text: `My pet: done (${arg}).` }
  })
}
```

`WORDS` est écrit une fois et utilisé à la fois pour la description et pour la ligne d’usage, ce qui supprime l’un des trois endroits que Narsil garde en accord à la main. Le README reste à vous de le mettre à jour.

## Erreurs fréquentes et comment tester

- **N’enregistrer qu’une fois.** Un enregistrement dure le temps de la session. Enregistrez dans `session.start`, à chaque fois.
- **Un nom déjà pris.** « a built-in's name is refused » (le nom d’une commande intégrée est refusé). Choisissez un nom qui appartient clairement à votre mod.
- **Appeler `next` depuis votre propre commande.** Il n’y a aucune commande derrière la vôtre à exécuter ; répondez avec `{ text }`.
- **Une correspondance exacte sur l’entrée brute.** Les gens tapent des espaces en trop, des majuscules et des accents. Normalisez d’abord, et acceptez les formes accentuées que vous attendez.
- **Une chaîne de `if` géante.** Elle fonctionne, mais les mots de chaque fonctionnalité finissent loin de la fonctionnalité. Laissez chaque fonctionnalité posséder ses mots et renvoyer `undefined` pour le reste.
- **Une aide qui dérive.** La description, la ligne d’usage et le README doivent dire la même chose. Construisez les deux premières à partir d’une seule constante si vous le pouvez.
- **Des secrets dans les réponses.** Le texte d’une commande reste dans les requêtes du modèle. N’affichez un secret que lorsque la personne doit le copier, et dites-le.

Pour tester, `claude plugin test .` exécute `tests/narsil.test.tsx`, où les commandes s’exécutent via `$.command.run({ command: 'narsil', args: 'nivel', ...TYPED })`. `TYPED` vaut `{ origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } }` : une commande tapée au bureau. `BY_PHONE` remplace l’origine par `{ kind: 'bridge' }` pour en lancer une depuis Remote Control. Tests à lire, par leur nom : « /narsil estado tells which surfaces asked to draw the band, and which never did » (/narsil estado dit quelles surfaces ont demandé à dessiner la bande, et lesquelles ne l’ont jamais fait), « /narsil discreto keeps her quiet, and /narsil normal brings everything back » (/narsil discreto la garde discrète, et /narsil normal remet tout), « /narsil consejos off stops automatic tips, and /narsil consejo still answers » (/narsil consejos off arrête les conseils automatiques, et /narsil consejo répond toujours) et « /narsil movil nuevo changes the topic, and /narsil movil prueba sends one » (/narsil movil nuevo change le sujet, et /narsil movil prueba en envoie un).

### Là où le code et le README diffèrent

Ils concordent sur chaque mot. Une petite erreur se trouve dans le code : la ligne d’usage de repli est écrite `'Uso:/narsil estado | …'`, sans l’espace après les deux-points que portent les lignes d’usage des sous-groupes. Elle date de `17ffb30` ; avant, la ligne disait `'Uso: /narsil …'`.

## Pour aller plus loin

- `phoneCommand` dans `hooks/register.tsx` est le plus clair des groupes à copier : il sépare le premier mot du reste, enregistre via une petite fonction auxiliaire `save`, et se termine par sa propre ligne d’usage.
- `stepsCommand` montre un mot suivi d’un nombre facultatif, analysé avec une seule expression régulière et borné (`Math.min(1440, Math.max(1, …))`).
- `$.command.list()` renvoie chaque commande slash que la personne peut exécuter, et `$.command.run` en exécute une comme si elle était tapée ; les deux figurent dans les types 2.1.325.

Ceci est le dernier guide du parcours « Votre propre mascotte d’état ». Son index liste les dix-sept guides, des états d’un coup d’œil à ces commandes, si vous voulez revenir sur une fonctionnalité. Pour les bases sur lesquelles repose chaque guide, les guides « Bases des mods » couvrent ce qui compose un mod, l’objet `$`, comment installer, recharger, valider et tester un mod, les surfaces sur lesquelles il s’exécute, et ce que la GPL v3 de Narsil implique quand vous réutilisez son code.
