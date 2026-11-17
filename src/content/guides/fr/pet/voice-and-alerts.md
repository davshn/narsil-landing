---
title: La voix et les alertes
description: 'Comment Narsil choisit une phrase au hasard pour chaque moment, la dit à voix haute avec les voix de Windows ou de macOS, et vous prévient par la fenêtre flottante ou une notification système.'
route: pet
order: 6
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: overlay/speak.ps1
  - repo: pet
    path: overlay/speak.sh
  - repo: pet
    path: overlay/toast.ps1
  - repo: pet
    path: overlay/toast.sh
  - repo: pet
    path: docs/plan-advice.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Ce que ça fait

Narsil parle, en espagnol, aux moments qui comptent :

| Moment                                               | Un exemple de ce qu’elle dit                                                 |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| Vous envoyez un prompt et le travail commence        | « Estoy en eso. » (« Je m’en occupe. »)                                      |
| Un tour se termine                                   | « Listo, ya quedó. » (« C’est fait, voilà. »)                                |
| Une question, une autorisation ou un plan attend     | « Te necesito un momento. » (« J’ai besoin de vous un instant. »)            |
| Un tour s’arrête sur une erreur                      | « Tuve un tropiezo y me detuve. » (« J’ai trébuché et je me suis arrêtée. ») |
| Quelque chose attend depuis cinq minutes             | « Sigo aquí, esperándote. » (« Je suis toujours là, je vous attends. »)      |
| Un sous-agent en arrière-plan se termine ou s’arrête | « Un ayudante terminó su encargo. » (« Un assistant a fini sa course. »)     |

Chaque moment a entre quatre et dix phrases, et elle en choisit une au hasard à chaque fois, si bien qu’elle ne se répète pas. Elle parle d’elle-même à la première personne et jamais par son nom.

Avec la voix vient une alerte écrite avec un titre et un texte, comme « He terminado » (« J’ai terminé ») au-dessus d’un court résumé de la réponse de Claude. L’endroit où elle s’affiche dépend d’un réglage :

- **Avec la fenêtre flottante activée** (par défaut), l’alerte s’affiche dans la fenêtre, qui apparaît pour l’occasion. Aucune notification système n’est envoyée en plus.
- **Avec la fenêtre flottante désactivée**, l’alerte arrive sous forme de notification. Sous Windows, cliquer dessus ouvre cette conversation.

Trois commandes l’ajustent. `/narsil silencio` et `/narsil voz` désactivent et réactivent la voix. `/narsil discreto` (mode discret) la garde silencieuse, supprime les alertes « tour terminé » et vous prévient quand même, sans parler, quand quelque chose a besoin de vous ou échoue ; `/narsil normal` l’annule. `/narsil prueba` joue une alerte de test avec sa voix, pour que vous puissiez entendre quelle voix votre système a choisie.

## Comment ça marche à l’intérieur

### Les phrases : `hooks/words.ts`

Les mots se trouvent dans leur propre fichier, à part des hooks. `VOICE` est un objet avec une liste par moment : `start`, `done`, `error`, `question`, `stillWaiting`, `agentDone` et `agentStopped`. `say(moment)` renvoie une phrase de cette liste, choisie avec `Math.random()`.

Le commentaire au-dessus de `VOICE` fixe les règles de style : un espagnol latino-américain neutre, le passé simple, aucun mot employé seulement en Espagne, la voix d’une assistante calme et chaleureuse, « composed, a little playful, never servile » (posée, un peu espiègle, jamais servile), qui parle d’elle-même à la première personne. Ces règles sont testées, comme décrit plus bas, si bien qu’une nouvelle phrase qui les enfreint fait échouer le build.

Garder les mots à part a une raison pratique : cela permet aux tests de lire chaque phrase sans lancer de session, et permet à quelqu’un de changer sa voix sans toucher à la logique des événements.

### Une fonction décide où va une alerte : `announce`

Chaque alerte passe par `announce` dans `hooks/register.tsx`. Elle reçoit un type (`done`, `question` ou `error`), un titre, un texte et la phrase à dire. Dans l’ordre, elle :

1. Lit les préférences. En mode discret, une alerte `done` s’arrête ici, sauf si elle est forcée (le test l’est).
2. Commence à parler, sauf en mode muet ou discret. Elle n’attend pas la voix pour continuer.
3. Avec la fenêtre flottante activée, envoie l’alerte au hub par `POST /event`. Si le hub est arrêté, `ensureOverlay` le démarre (au plus une fois par minute) et l’alerte est renvoyée.
4. Avec la fenêtre désactivée, appelle `notify`.
5. Envoie l’alerte au téléphone, quand les alertes sur le téléphone sont activées avec `/narsil movil`.
6. Attend que la voix ait fini.

Les appelants transmettent la phrase du moment : `say('done')` quand un tour se termine par une réponse, `say('question')` quand un tour se termine sur une question, `say('error')` quand il échoue, `say('stillWaiting')` pour le rappel des cinq minutes. Le début du travail est l’exception : dans `turn.start`, un prompt que vous avez tapé (et non une continuation) appelle directement `speak` avec `say('start')`, sans alerte écrite.

### La voix : d’abord les scripts du mod, ensuite le moteur

`speak` essaie d’abord le propre script de Narsil et se replie sur la voix du moteur :

```tsx
async function speak($: EngineInterface, text: string): Promise<void> {
  // The mod's own script first, so a Spanish voice is chosen when one is installed.
  if (await launch($, 'speak', { NARSIL_TEXT: text })) return
  void $.audio.speak(text).catch(() => undefined)
}
```

Le commentaire, « The mod's own script first, so a Spanish voice is chosen when one is installed. » (le propre script du mod d’abord, pour qu’une voix espagnole soit choisie quand il y en a une d’installée), en donne la raison. `$.audio.speak` parle avec le synthétiseur de la plateforme et, par défaut, sa voix par défaut. Sur un ordinateur configuré en anglais, c’est une voix anglaise qui lit de l’espagnol. Les scripts de Narsil cherchent d’abord une voix espagnole par son nom.

**Sous Windows, `overlay/speak.ps1`** essaie trois choses dans l’ordre :

1. Une voix espagnole du moteur vocal classique (`System.Speech`), en préférant les voix « Natural » (le commentaire du fichier mentionne un adaptateur qui y expose des voix du Narrateur comme Dalia) et les voix latino-américaines avant celles d’Espagne.
2. Une voix espagnole du moteur vocal plus récent de Windows (`Windows.Media.SpeechSynthesis`, les voix installées depuis les Paramètres de Windows), latino-américaine d’abord. Il écrit la parole dans un flux et la joue.
3. La voix par défaut du moteur classique.

**Sous macOS, `overlay/speak.sh`** liste les voix avec `say -v '?'` et choisit d’abord Paulina (mexicaine), puis une autre voix latino-américaine, puis Mónica, puis n’importe quelle voix espagnole, et sinon la voix par défaut du système, et exécute `say`.

Sur tout autre système, `launch` renvoie false et `$.audio.speak` parle avec le propre synthétiseur de la plateforme, que les types 2.1.325 décrivent comme « `say` on macOS » (`say` sous macOS).

### Les notifications : d’abord le moteur, ensuite les scripts

`notify` procède dans l’autre sens : elle demande d’abord au moteur.

```tsx
try {
  if ((await $.ui.notify(text, { title })).isSent) return
} catch {
  // no notification channel: the mod's own script below
}
await launch($, 'toast', {
  NARSIL_TITLE: title,
  NARSIL_TEXT: text,
  NARSIL_LINK: conversationLink(),
})
```

`$.ui.notify` renvoie `{ isSent: true, … }` quand un canal l’a prise en charge, ou `{ isSent: false, reason }` sinon. Le `try` est là, comme le dit le commentaire du code, parce que là où l’hôte n’a aucune notification, l’appel lève une exception avant de renvoyer une promesse. Ce n’est que lorsque le moteur ne l’a pas envoyée que Narsil utilise ses scripts. (Le README appelle le résultat « notificación del sistema », une notification système ; dans le code, le propre canal du moteur vient en premier et les scripts système en second.)

- **`overlay/toast.ps1`** construit une notification toast de Windows avec le titre au-dessus du texte, tous deux échappés pour le XML. Quand `NARSIL_LINK` contient un lien de conversation, il fait en sorte que la notification ouvre ce lien lors d’un clic. Il vérifie le lien selon le même motif que celui qu’utilise le hub, `claude://code/continue?session=local_…&source=desktop_action`, avant de l’utiliser.
- **`overlay/toast.sh`** appelle `osascript` avec `display notification`. Le titre et le texte sont transmis comme arguments au script, jamais écrits à l’intérieur, « so nothing in them runs » (pour que rien de ce qu’ils contiennent ne s’exécute), comme le dit son commentaire.

### Exécuter les scripts : `launch`

La voix comme la notification passent par `launch`, qui démarre un script comme un processus à part et rend la main immédiatement. Elle utilise `$.process.run`, qui exécute une commande par son vecteur d’arguments, sans shell, et attend qu’elle se termine :

- **Sous macOS**, elle exécute `/bin/sh -c 'nohup /bin/sh "$NARSIL_SCRIPT" </dev/null >/dev/null 2>&1 &'`. Le shell démarre le script en arrière-plan et se termine, si bien que `$.process.run` rend la main aussitôt.
- **Sous Windows**, elle exécute PowerShell avec `Start-Process -WindowStyle Hidden`, qui démarre un autre PowerShell masqué sur le script et rend la main.

Le système est détecté une seule fois, par `platformOf` : la variable d’environnement `OS` (`Windows_NT`), sinon `uname -s` (`Darwin` pour macOS).

Deux décisions de conception sont visibles ici :

- **Détaché, pour que la parole survive au hook.** Une phrase parlée peut prendre plusieurs secondes. Un processus détaché continue de parler après le retour du hook, après le tour et après un rechargement du mod, auquel, comme le note le commentaire au-dessus de `launch`, un minuteur `$.clock` ne survivrait pas.
- **Le texte dans l’environnement, jamais dans la commande.** Le chemin du script, le texte et le titre voyagent sous forme de variables d’environnement (`NARSIL_SCRIPT`, `NARSIL_TEXT`, `NARSIL_TITLE`, `NARSIL_LINK`). La ligne de commande elle-même est une chaîne fixe. Le commentaire en tête de `speak.ps1` dit pourquoi : « nothing Claude wrote can be interpreted as code » (rien de ce que Claude a écrit ne peut être interprété comme du code). Une réponse qui contient des guillemets, des points-virgules ou `$(…)` n’est jamais que dite ou affichée.

### Ce que le code n’utilise pas

Narsil ne joue pas d’extraits sonores : il n’y a aucun appel à `$.audio.play` dans `hooks/register.tsx`. Le seul appel à `$.audio` est le repli sur `$.audio.speak` vu plus haut.

## Comment on l’a demandé à l’IA

La demande d’origine de la voix et des notifications n’a pas été consignée. Elles arrivent dans le premier commit de la fenêtre flottante, avant le début des journaux de tâches publics. La seule note de conception consignée se trouve dans `docs/plan-advice.md`, le plan des conseils de Narsil : « **Voice**: off by default (`/narsil consejos voz` turns it on) » (**Voix** : désactivée par défaut, `/narsil consejos voz` l’active). C’est un plan, pas les mots de l’auteur ou de l’autrice, et il porte sur les conseils, pas sur ces alertes.

### Reconstitution à partir de l’historique des commits

À partir de `git log -- overlay/speak.ps1 overlay/speak.sh overlay/toast.ps1 overlay/toast.sh hooks/words.ts hooks/register.tsx` dans narsil-pet :

- `6f8f938` (2026-10-30) « feat(overlay): add floating window, Spanish voice and Windows toasts » (ajouter la fenêtre flottante, la voix en espagnol et les notifications toast de Windows). `speak.ps1` et `toast.ps1` arrivent avec la fenêtre flottante.
- `088508e` (2026-10-30) « fix(notify): fall back to the system script when the host has no notify » (se replier sur le script système quand l’hôte n’a pas de notification). Le `try` autour de `$.ui.notify` et les scripts en second choix.
- `52af072` (2026-10-30) « feat(mac): speak and notify on macOS with say and osascript » (parler et notifier sous macOS avec say et osascript). `speak.sh` et `toast.sh`.
- `a2b5970` (2026-10-30) « fix(overlay): start the window again for an event instead of a notification » (redémarrer la fenêtre pour un événement plutôt que pour une notification). Avec la fenêtre activée, une alerte va à la fenêtre même quand celle-ci doit être redémarrée.
- `f7a494e` (2026-10-30) « feat: warn about loops, insist on waiting permissions and sum the session up » (avertir des boucles, insister sur les autorisations en attente et résumer la session). Le rappel après une attente.
- `c73bc13` et `36256f9` (2026-10-31) : Narsil parle d’elle-même à la première personne, dans la bande, la fenêtre et les alertes.
- `17ffb30` (2026-10-31) « feat: add a quiet mode that only speaks up when Narsil needs you » (ajouter un mode discret qui ne prend la parole que lorsque Narsil a besoin de vous).
- `665bd4e` (2026-11-06) « feat: speak when work starts and vary every spoken phrase » (parler quand le travail commence et varier chaque phrase parlée). Les phrases `start`, et plusieurs phrases pour chaque moment.
- `44f4372` (2026-11-07) « feat: speak natural neutral Latin American Spanish with more phrases » (parler un espagnol latino-américain neutre et naturel, avec plus de phrases). L’ordre des voix qui préfère les voix latino-américaines naturelles, et les règles de style.

L’ordre raconte l’histoire : d’abord une voix et une notification qui fonctionnaient, puis chaque système, puis le confort de la personne (la première personne, un mode discret, moins de répétitions, une voix plus naturelle).

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon mod Claude Code `my-pet`, parle quand un tour se termine. Garde les phrases dans `hooks/words.ts` sous forme d’une liste par moment (`done`, `question`, `error`) avec au moins quatre phrases chacune, et une fonction `say(moment)` qui en choisit une au hasard. Dans `turn.complete`, pour la conversation principale uniquement, choisis le moment à partir de `e.reason` et appelle `$.audio.speak`, sans l’attendre pour que le hook rende la main immédiatement, et intercepte son rejet. Envoie ensuite une notification avec `$.ui.notify(text, { title })` et vérifie `isSent`. Ajoute un test qui vérifie que chaque moment a au moins quatre phrases distinctes et que 200 appels de `say` donnent plus d’une phrase. Vérifie chaque appel par rapport aux types de plugin-authoring.

## Le code minimal

Écrit pour ce guide et vérifié par rapport aux types 2.1.325 (`$.audio.speak`, `$.ui.notify`, `turn.complete`). Il n’utilise que la voix et les notifications du moteur. Les propres scripts de Narsil, qui choisissent une voix espagnole, sont décrits plus haut ; le code est adapté de `hooks/words.ts` et de `hooks/register.tsx` dans [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later).

Les phrases, `hooks/words.ts` :

```ts
export const VOICE = {
  done: ['Done.', 'All finished here.', 'Finished. Have a look when you can.', 'That is done.'],
  question: [
    'I need you for a moment.',
    'I have a question for you.',
    'Your call, please.',
    'Can you help me with something?',
  ],
  error: [
    'Something went wrong and I stopped.',
    'I hit an error.',
    'I stopped to avoid making it worse.',
    'Let us look at this together.',
  ],
} as const satisfies Record<string, readonly string[]>

export type Moment = keyof typeof VOICE

export function say(moment: Moment): string {
  const options: readonly string[] = VOICE[moment]
  return options[Math.floor(Math.random() * options.length)] ?? options[0]
}
```

Le hook, dans `hooks/register.tsx` :

```tsx
import type { Register } from 'claude-code'
import { say, type Moment } from './words'

export const register: Register = (on) => {
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    const moment: Moment = e.reason === 'answer' ? 'done' : 'error'
    const phrase = say(moment)
    // Not awaited: the utterance may take seconds.
    void $.audio.speak(phrase).catch(() => undefined)
    try {
      await $.ui.notify(phrase, { title: 'my-pet' })
    } catch {
      // no notification channel here
    }
    return result
  })
}
```

Narsil n’envoie les tours `aborted` (vous avez appuyé sur stop) nulle part : elle passe l’état à arrêté sans alerte. Une version plus complète vérifierait aussi `e.reason === 'aborted'` et resterait silencieuse.

## Erreurs fréquentes et comment tester

- **Attendre la voix dans le hook.** `$.audio.speak` se résout quand l’énoncé se termine. Attendu dans un hook, il bloque l’événement pendant plusieurs secondes. Lancez-le et interceptez son rejet, comme le fait Narsil.
- **Mettre le texte dans la ligne de commande.** Si vous exécutez un script avec une phrase construite à partir de la réponse de Claude, transmettez-la dans l’environnement ou comme argument séparé, jamais à l’intérieur d’une chaîne shell. `toast.sh` et `speak.ps1` montrent tous deux le schéma.
- **Supposer qu’une voix existe.** `$.audio.speak` rejette quand il n’y a pas de synthétiseur ou que la voix n’est pas installée. Les scripts de Narsil se replient étape par étape sur la voix par défaut.
- **Deux alertes pour un seul événement.** Narsil envoie une alerte à la fenêtre ou au système, jamais aux deux, et le README le dit de la même manière.
- **Notifier pendant que la personne regarde.** Avec la fenêtre flottante activée, le hub abandonne un événement qui arrive pendant que Claude est au premier plan, sauf s’il est forcé. La voix parle quand même.
- **Répéter une seule phrase.** La même phrase à chaque tour devient vite du bruit ; plusieurs phrases par moment règlent le problème pour presque rien.

Pour tester, `claude plugin test .` exécute `tests/narsil.test.tsx`. « each moment Narsil speaks has several phrases, so she does not always say the same » (chaque moment où Narsil parle a plusieurs phrases, pour qu’elle ne dise pas toujours la même chose) vérifie au moins quatre phrases distinctes par moment et appelle `say('start')` 200 fois. « what Narsil says is neutral Latin American Spanish: no Spain-only words, the simple past » (ce que dit Narsil est un espagnol latino-américain neutre : aucun mot propre à l’Espagne, le passé simple) applique les règles de style avec deux expressions régulières, et vérifie qu’aucune phrase ne contient son nom. « on macOS Narsil speaks and notifies with its own scripts, detached, never PowerShell » (sous macOS, Narsil parle et notifie avec ses propres scripts, détachés, jamais PowerShell) exécute `/narsil prueba` avec un faux macOS et vérifie la commande `nohup` exacte ainsi que les `NARSIL_TEXT` et `NARSIL_TITLE` qu’elle transmet. « on Windows Narsil still speaks and starts the window through PowerShell » (sous Windows, Narsil parle toujours et démarre la fenêtre par PowerShell) couvre l’autre côté, et « with the window on but down, an event starts it again and shows there, never as a notification » (avec la fenêtre activée mais arrêtée, un événement la redémarre et s’y affiche, jamais sous forme de notification) couvre le choix de `announce`. Pour entendre le résultat sur votre propre ordinateur, exécutez `/narsil prueba`.

## Pour aller plus loin

- `nudgeText` dans `hooks/watch.ts` construit le texte du rappel des cinq minutes, et `NUDGE_AFTER_MS` fixe l’attente.
- `summary` dans `hooks/words.ts` coupe la réponse de Claude pour en faire le court texte de l’alerte « He terminado », avec une version plus longue pour le téléphone.
- `/narsil consejos voz` permet aussi à Narsil de dire ses conseils de fin de tour ; c’est désactivé par défaut, comme le prévoyait `docs/plan-advice.md`.
- Le tableau « Sistemas compatibles » (systèmes compatibles) du README liste la voix et les notifications pour chaque système.
