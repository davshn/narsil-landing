---
title: Les étapes suivantes
description: 'Comment Narsil propose jusqu’à trois étapes 15 minutes après un tour, d’après les commits, les changements non commités et les tâches en attente du projet, et met celle choisie dans le prompt.'
route: pet
order: 12
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/advice.ts
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Ce que ça fait

Vous terminez un tour, lisez la réponse et vous éloignez. À votre retour, la question est souvent la même : et maintenant ?

Quinze minutes après la fin d’un tour, si vous n’avez rien écrit depuis, Narsil propose jusqu’à trois étapes suivantes. Dans la bande, elles apparaissent sous leur propre ligne :

```text
➜ ¿Y ahora? Elige uno y te lo dejo en el prompt:
[ Añade reintentos con backoff a net.ts ]  [ Documenta el modo oscuro en el README ]
```

« Et maintenant ? Choisis-en une et je te la laisse dans le prompt. » (Le terminal n’affiche que « ➜ ¿Y ahora? ».) Chaque étape est un bouton, et chacune est une demande écrite à l’impératif, prête à être envoyée telle quelle. L’exemple du README est « Añade reintentos con backoff a net.ts » (« ajoute des nouvelles tentatives avec backoff à net.ts »).

Appuyer sur une étape ne l’envoie pas. Cela place le texte dans la zone du prompt comme brouillon, pour que vous le lisiez, le modifiiez et l’envoyiez vous-même. Les autres étapes disparaissent.

Le README dit que les étapes répondent à deux questions : « ¿cómo seguimos con el proyecto? » et « ¿qué nos falta por hacer? » (« comment poursuivons-nous le projet ? » et « que nous reste-t-il à faire ? »). Pour y répondre, Narsil lit les derniers commits, les fichiers non commités et, si le projet en a, les tâches en attente dans `odd/tasks/*.md`.

La fenêtre flottante affiche aussi les étapes. `/narsil pasos off` (« étapes désactivées ») les désactive, et le mode discret les laisse de côté.

## Comment ça marche à l’intérieur

### Quinze minutes après la fin du tour

Les étapes suivantes n’ont pas de minuteur à elles. Elles s’appuient sur l’horloge du cache du guide 8 : quand un tour de la conversation principale se termine, `startCache` écrit l’atome `cache` avec `at`, le moment où le tour s’est terminé. À chaque battement de deux secondes, `tickCache` décompte le cache et vérifie aussi :

```tsx
if (now - c.at >= STEPS_AFTER_MS) void offerSteps($, c.at).catch(() => undefined)
```

`STEPS_AFTER_MS` vaut 15 minutes. « Si vous n’avez rien écrit » ne demande aucun état supplémentaire : un nouveau prompt démarre un tour, `turn.start` efface à la fois l’horloge du cache et toute étape proposée, et il ne reste plus de `at` à partir duquel compter.

Les étapes comptent à partir de la fin du tour, `at`, et non du début de sa dernière requête comme le fait le cache. Le guide sur l’horloge du cache explique la différence : le cache concerne l’API, et les étapes concernent votre absence. Un test le fixe : « next steps still wait from the end of the turn, however long its last request took » (les étapes suivantes attendent toujours à partir de la fin du tour, quelle que soit la durée de sa dernière requête).

L’attente était de 3 minutes au début. Le commit `2bcc97c` l’a portée à 15 dans un commit intitulé « calm loop, steps and permission alerts » (calmer les alertes de boucle, d’étapes et d’autorisation), le même qui a fait passer le rappel d’autorisation du guide 10 de 2 à 5 minutes.

### Une fois par tour terminé

`offerSteps` demande au plus une fois pour chaque tour. Il revient tôt quand :

- il a déjà demandé pour ce `at` (`stepsAskedFor`), ou des étapes pour ce `at` sont affichées ;
- le tour s’est arrêté avec du travail en arrière-plan encore en cours (guide 1) : le travail n’est pas fini, ce n’est donc pas le moment de demander la suite ;
- les étapes sont désactivées, ou le mode discret est activé.

Il marque le tour comme demandé avant de vérifier les préférences. Réactiver les étapes plus tard n’apporte pas d’étapes pour un tour déjà passé ; elles viennent avec le suivant.

### Ce que lit le modèle

Les étapes réutilisent le contexte des conseils du guide 11 : le même `seen`, le même `describe`, le même `sanitize`, avec le motif « Propón cómo seguir con el proyecto: qué falta por hacer, qué mejorar o qué funcionalidad viene después. » (« propose comment poursuivre le projet : ce qui reste à faire, ce qu’il faut améliorer ou quelle fonctionnalité vient ensuite »).

Deux parties sont lues juste avant la demande. `readDiff` donne ce que le tour a modifié, comme pour le conseil de fin de tour. `readProject` donne l’état du projet, en trois parties avec `git` et le système de fichiers :

- `git log --oneline --no-decorate -10` : les dix derniers commits.
- `git status --short` : les fichiers non commités.
- Jusqu’à cinq fichiers `.md` dans `odd/tasks`, listés avec `$.fs.list` et lus avec `$.fs.read`. Un chemin relatif se trouve sous le répertoire de travail de la session, comme le disent les types 2.1.325.

De chaque fichier de tâches, `pendingTasks` ne garde que ce qui n’est pas fini : les lignes `- [ ]` non cochées, et les lignes sous un titre `## Tasks` qui disent pending, pendiente, todo ou in progress. Les éléments cochés et tout ce qui se trouve sous un titre `Log` restent dehors. Le format est celui qu’utilisent les propres fichiers de tâches de l’auteur ou de l’autrice ; un projet sans de tels fichiers reçoit quand même ses commits et son état.

La partie projet est plafonnée à 2 000 caractères et le diff à 3 000, à l’intérieur du même contexte de 6 000 caractères. Seules les étapes lisent le projet ; un conseil ne le fait jamais.

### Le prompt exact

`STEPS_SYSTEM` dans `hooks/advice.ts`, cité tel qu’il est dans [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). `MAX_STEPS` vaut 3, `MAX_STEP` vaut 90, et `NO_ROUTINE` est la même interdiction des vérifications de routine que celle des conseils.

```ts
export const STEPS_SYSTEM = [
  'Eres Narsil, una vieja serpiente marina sabia que acompaña a quien programa.',
  'El turno terminó hace unos minutos: propón los próximos pasos que la persona podría pedir ahora.',
  'Responden a "¿cómo seguimos con el proyecto?" y "¿qué nos falta por hacer?": la siguiente tarea pendiente,',
  'una funcionalidad que completa lo que se hizo, o una mejora de diseño que vale la pena.',
  'Reglas:',
  `- Entre uno y ${MAX_STEPS} pasos, uno por línea, en español, como mucho ${MAX_STEP} caracteres cada uno.`,
  '- Cada paso es una petición en imperativo que se le puede enviar tal cual (por ejemplo: "Añade reintentos con backoff a net.ts").',
  `- ${NO_ROUTINE}`,
  '- Concretos y sacados del contexto: las tareas pendientes, los commits recientes, los archivos sin commit; nada inventado.',
  '- Usa lenguaje neutro, sin suponer el género de la persona; no nombres a ningún asistente ni a "Claude".',
  '- Si no hay nada útil que proponer, responde exactamente SKIP.',
  'Responde solo con los pasos (o SKIP), sin comillas ni introducción.',
].join('\n')
```

Traduction en français : tu es Narsil, un vieux serpent de mer sage qui accompagne les personnes qui programment. Le tour s’est terminé il y a quelques minutes : propose les prochaines étapes que la personne pourrait demander maintenant. Elles répondent à « comment poursuivons-nous le projet ? » et « que nous reste-t-il à faire ? » : la prochaine tâche en attente, une fonctionnalité qui complète ce qui a été fait, ou une amélioration de conception qui en vaut la peine. Règles : entre une et 3 étapes, une par ligne, en espagnol, 90 caractères au plus chacune. Chaque étape est une demande à l’impératif qui peut être envoyée telle quelle (par exemple : « ajoute des nouvelles tentatives avec backoff à net.ts »). Pas de vérifications de routine (lancer les tests, vérifier le push ou le commit, regarder si l’erreur a disparu). Concrètes et tirées du contexte : les tâches en attente, les commits récents, les fichiers non commités ; rien d’inventé. Utilise un langage neutre, sans supposer le genre de la personne ; ne nomme aucun assistant ni « Claude ». S’il n’y a rien d’utile à proposer, réponds exactement SKIP. Réponds seulement avec les étapes (ou SKIP), sans guillemets ni introduction.

Le message utilisateur est `stepsPrompt(context)` : « Contexto del trabajo: » (« contexte du travail »), le contexte, et « Próximos pasos: » (« prochaines étapes : ») pour finir. L’appel est celui des conseils : `$.model.complete` avec `model: 'haiku'`, `effort: 'medium'`, `maxTokens: 2000` et `timeoutMs: 30_000`.

Demander des impératifs qui « peuvent être envoyés tels quels » est la décision de conception qui fait fonctionner le clic : une étape est déjà un prompt, si bien que remplir la zone avec elle ne demande aucune réécriture.

### Lire la réponse

`parseSteps` transforme la réponse en liste : rien pour `SKIP` ; sinon une étape par ligne, sans puces, numéros ni guillemets, avec tout « Claude » transformé en « Narsil », trois au plus, chacune coupée à 90 caractères avec « … ».

Puis une dernière vérification : si l’atome `cache` n’a plus le même `at`, un nouveau tour a commencé pendant que le modèle répondait, et les étapes sont périmées. Elles sont abandonnées.

Sinon, elles sont écrites dans l’atome `steps` avec leur `at`, consignées avec `$.ui.log` (« ➜ Narsil propone: … », « Narsil propose »), et envoyées à la fenêtre flottante. Tout échec (git, les fichiers, le modèle) aboutit dans un `catch` : pas d’étapes cette fois.

### Remplir le prompt au clic

Chaque étape est dessinée comme un `Button` dont le `onPress` appelle `pickStep` :

```tsx
async function pickStep($: EngineInterface, step: string): Promise<void> {
  await $.prompt.fill({ text: step })
  await update($, steps, () => null)
  await pushOverlay($)
}
```

Les types 2.1.325 décrivent `$.prompt.fill` comme plaçant `input.text` « in the prompt box as the draft » (dans la zone du prompt comme brouillon), selon `mode` : `replace` par défaut, `append` après le brouillon, `insert` au curseur. Deux conséquences découlent du code :

- Sans `mode`, une étape remplace le brouillon que vous aviez dans la zone.
- Les types disent que le résultat est `isFilled: false` « under a dialog or headless » (sous une boîte de dialogue ou sans interface). Narsil ne lit pas le résultat : il efface les étapes dans tous les cas. Le README ne décrit que le cas normal.

Pourquoi remplir plutôt qu’envoyer ? Une étape vient d’un petit modèle qui lit un résumé. L’envoyer démarrerait un tour que vous n’avez pas choisi, sur votre compte. Remplir la zone vous laisse décider, et vous permet de modifier l’étape d’abord.

### Les étapes s’affichent seules dans la bande

Quand des étapes arrivent, `offerSteps` ferme aussi toutes les conversations ouvertes dans la liste de la bande (guide 3), pour que les étapes soient vues seules. Le commentaire dans le rendu de la bande explique la règle : « Next steps on offer close every conversation until you open one: then they hide, and come back once you close them all. » (les étapes suivantes proposées ferment toutes les conversations jusqu’à ce que vous en ouvriez une : elles se cachent alors, et reviennent une fois que vous les avez toutes fermées). C’est arrivé dans `250d2c6`, « let next steps stand alone » (laisser les étapes suivantes seules).

## Le construire avec Claude

Demandez à Claude de proposer des prochaines étapes après une pause calme, à partir des commits récents du projet, de ses fichiers sans commit et de ses tâches en attente. L’idée que Claude doit bien saisir : une étape va dans la zone du prompt comme brouillon et n’est jamais envoyée ; c’est vous qui décidez.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon mod Claude Code `my-pet`, propose des étapes suivantes après une pause calme. Dans `turn.complete`, pour la conversation principale, enregistre dans un atome le moment où le tour s’est terminé ; efface-le, ainsi que toute étape proposée, dans `turn.start`. Sur un battement `$.clock.every(2000, ...)`, une fois que 15 minutes sont passées depuis ce moment et une seule fois par tour, lis `git log --oneline -10` et `git status --short` avec `$.process.run`, et les lignes `- [ ]` non cochées de `odd/tasks/*.md` avec `$.fs.list` et `$.fs.read`. Appelle `$.model.complete` avec `model: 'haiku'` et un prompt système qui demande d’une à trois demandes à l’impératif, de 90 caractères au plus chacune, qui peuvent être envoyées telles quelles, tirées de ce contexte, ou exactement `SKIP`. Abandonne la réponse si un nouveau tour a commencé entre-temps. Affiche chaque étape comme un `Button` dans la bande `AbovePrompt` ; à l’appui, appelle `$.prompt.fill({ text })` et efface les étapes uniquement quand `isFilled` est vrai. Teste avec une horloge simulée et `on('model.complete', ...)` : rien à 14 minutes, des étapes à 15, et l’étape pressée qui atteint un hook `prompt.fill`.

### Ce qu’il faut vérifier dans la réponse de Claude

1. La pause compte à partir de la fin du tour, et `turn.start` l’efface ainsi que les étapes proposées.
2. Le modèle est interrogé au plus une fois par tour, même si le battement tourne toutes les deux secondes.
3. Après la réponse du modèle, le code vérifie qu’aucun nouveau tour n’a commencé entre-temps, et abandonne les étapes si c’est le cas.
4. Seules les lignes non cochées `- [ ]` des fichiers de tâches parviennent au modèle ; les éléments cochés restent dehors.
5. Appuyer sur une étape appelle `$.prompt.fill` et ne l’envoie jamais, et les étapes ne sont effacées que lorsque `isFilled` vaut true.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « après 15 minutes, les étapes changent toutes les deux secondes ».

### Comment l’auteur l’a demandé

La demande d’origine des étapes suivantes n’a pas été consignée. Elles sont arrivées le 2026-10-30, dans le même commit que l’horloge du cache, avant les journaux de tâches publics. `docs/plan-advice.md`, le plan des conseils, ne les mentionne pas.

#### Consigné : où elles vont

La conception convenue pour la bande avec toutes les conversations, `odd/tasks/fleet-view.md` dans narsil-pet, L4, les place : « the tip and next steps of this window below » (le conseil et les étapes suivantes de cette fenêtre en dessous) la liste. L4 est la conception telle qu’elle a été convenue, écrite dans le journal, et non les propres mots de l’auteur ou de l’autrice.

#### Reconstitution à partir de l’historique des commits

À partir de `git log -- hooks/register.tsx hooks/advice.ts` :

- `0993bd7` (2026-10-30) « feat: show a prompt-cache clock and offer next steps after a turn » (afficher une horloge du cache du prompt et proposer des étapes suivantes après un tour). Les étapes et l’horloge arrivent ensemble, toutes deux démarrées par la fin d’un tour.
- `d1e6d40` (2026-11-04) « feat: make tips weigh design choices from the diff and next steps say what the project lacks » (faire peser aux conseils des choix de conception à partir du diff et faire dire aux étapes suivantes ce qui manque au projet). Son message : « Next steps read recent commits, git status and pending odd/tasks items to answer how the project goes on. » (les étapes suivantes lisent les commits récents, git status et les éléments en attente de odd/tasks pour répondre à la façon dont le projet se poursuit). `readProject`, `pendingTasks` et les deux questions du prompt viennent d’ici.
- `2bcc97c` (2026-11-05) « feat: open the context breakdown from the usage bars and calm loop, steps and permission alerts » (ouvrir le détail du contexte depuis les barres d’utilisation et calmer les alertes de boucle, d’étapes et d’autorisation). Son message : « next steps wait 15 minutes » (les étapes suivantes attendent 15 minutes) ; elles en attendaient 3.
- `250d2c6` (2026-11-07) « feat: open the context from its percent and let next steps stand alone » (ouvrir le contexte depuis son pourcentage et laisser les étapes suivantes seules).
- `c3e4464` (2026-11-09) « fix: count the prompt cache from the start of its last request » (compter le cache du prompt à partir du début de sa dernière requête). Le cache est passé au début de la requête ; les étapes ont continué à compter à partir de la fin du tour.

Les corrections vont dans un même sens : d’étapes qui venaient trop tôt et disaient trop peu, à des étapes qui attendent une vraie pause et lisent le propre plan du projet.

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide. Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

Écrit pour ce guide et vérifié par rapport aux types 2.1.325 (`$.model.complete`, `$.process.run`, `$.fs.list`, `$.fs.read`, `$.prompt.fill` et son `isFilled`, `$.clock.every`, `turn.start`, `turn.complete`, `ui.render`). Il est adapté de `hooks/advice.ts` et de `hooks/register.tsx` dans [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). L’atome `ended` (`number | null`) et l’atome `steps` (`{ at: number; items: string[] } | null`) sont déclarés dans `types/index.d.ts` comme dans le premier guide.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const ended = atom({ plugin: 'my-pet', key: 'ended' } as const, null)
const steps = atom({ plugin: 'my-pet', key: 'steps' } as const, null)
const AFTER_MS = 15 * 60_000
const SYSTEM = [
  'Propose one to three next steps for this project, one per line, at most 90 characters each.',
  'Each one is an imperative request that can be sent as it is.',
  'Take them from the context (pending tasks, recent commits, uncommitted files); nothing invented.',
  'No routine checks. If there is nothing useful, answer exactly SKIP.',
].join('\n')
let askedFor: number | null = null

async function git($: EngineInterface, args: string[]): Promise<string> {
  try {
    const r = await $.process.run(['git', '--no-pager', ...args], { timeoutMs: 5000 })
    return r.exitCode === 0 ? r.stdout.trim() : ''
  } catch {
    return ''
  }
}

async function pending($: EngineInterface): Promise<string[]> {
  try {
    const files = (await $.fs.list('odd/tasks')).filter(
      (f) => f.kind === 'file' && f.name.endsWith('.md'),
    )
    const out: string[] = []
    for (const f of files.slice(0, 5)) {
      const text = await $.fs.read(`odd/tasks/${f.name}`)
      if (typeof text !== 'string') continue
      for (const line of text.split('\n')) {
        const m = /^\s*[-*]\s+\[ \]\s+(.*)$/.exec(line)
        if (m) out.push(m[1]!)
      }
    }
    return out
  } catch {
    return []
  }
}

async function offer($: EngineInterface, at: number): Promise<void> {
  if (askedFor === at) return
  askedFor = at
  const context = [
    `Recent commits:\n${await git($, ['log', '--oneline', '--no-decorate', '-10'])}`,
    `Uncommitted:\n${await git($, ['status', '--short'])}`,
    `Pending tasks:\n${(await pending($)).map((t) => `- ${t}`).join('\n')}`,
  ]
    .join('\n')
    .slice(0, 2000)
  const reply = await $.model.complete({
    model: 'haiku',
    system: SYSTEM,
    prompt: `Context:\n${context}\n\nNext steps:`,
    effort: 'medium',
    timeoutMs: 30_000,
  })
  if (!reply.isAnswered || /^\s*skip\b/i.test(reply.text)) return
  const items = reply.text
    .split('\n')
    .map((l) => l.trim().replace(/^([-*•]|\d+[.)])\s*/, ''))
    .filter(Boolean)
    .slice(0, 3)
    .map((s) => (s.length > 90 ? `${s.slice(0, 89)}…` : s))
  // A turn that started meanwhile makes them stale.
  if (items.length === 0 || (await read($, ended)) !== at) return
  await update($, steps, () => ({ at, items }))
}

async function beat($: EngineInterface): Promise<void> {
  const at = await read($, ended)
  if (at !== null && (await $.clock.now()) - at >= AFTER_MS)
    void offer($, at).catch(() => undefined)
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    $.clock.every(2000, () => void beat($))
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      await update($, ended, () => null)
      await update($, steps, () => null)
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined && e.reason === 'answer') {
      const now = await $.clock.now()
      await update($, ended, () => now)
    }
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const offered = (await read($, steps))?.items ?? []
    if (offered.length === 0) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    const pick = (step: string) => async () => {
      const { isFilled } = await $.prompt.fill({ text: step })
      if (isFilled) await update($, steps, () => null)
    }
    return (
      <Box flexDirection="row" gap={1} flexWrap="wrap" minWidth={0}>
        <Text dimColor>➜ And now?</Text>
        {offered.map((step, i) => (
          <Button key={`step-${i}`} label={step} onPress={pick(step)} />
        ))}
      </Box>
    )
  })
}
```

Contrairement à Narsil, cette version garde les étapes quand la zone n’a pas pu être remplie, si bien qu’un appui sous une boîte de dialogue peut être répété.

## Erreurs fréquentes et comment tester

- **Des étapes pour un tour qui n’est plus le dernier.** Le modèle met quelques secondes ; un nouveau prompt peut arriver entre-temps. Comparez de nouveau le moment du tour après la réponse, comme le fait `offerSteps`.
- **Demander à chaque battement.** La vérification s’exécute toutes les deux secondes. Sans marque par tour (`stepsAskedFor`), chaque battement après la quinzième minute interrogerait de nouveau le modèle.
- **Envoyer au lieu de remplir.** Une étape proposée par un petit modèle doit atteindre la zone du prompt, pas le modèle. Laissez la personne appuyer sur Entrée.
- **Remplacer un brouillon sans le vouloir.** `$.prompt.fill` remplace le brouillon par défaut. Si vous voulez le garder, passez `mode: 'append'` ou `mode: 'insert'`.
- **Lire tout le fichier de tâches.** Les tâches terminées et le journal n’ajoutent que du bruit et de la longueur. Gardez les lignes non terminées, comme le fait `pendingTasks`.
- **Compter à partir de la dernière requête.** Les étapes portent sur une pause dans votre travail ; comptez à partir de la fin du tour.

Pour tester, `claude plugin test .` exécute `tests/narsil.test.tsx` avec une horloge simulée, le modèle répondu par `on('model.complete', ...)` et la zone du prompt par `on('prompt.fill', ...)`. « a few minutes after a turn Narsil offers next steps, and one click puts it in the prompt » (quelques minutes après un tour, Narsil propose des étapes suivantes, et un clic en met une dans le prompt) ne trouve aucune étape à 14 minutes, trois à 15, vérifie qu’elles ferment les conversations et se cachent quand on en ouvre une, appuie sur la deuxième et attend exactement son texte dans la zone, et vérifie qu’un tour n’est demandé qu’une fois. « a new turn before the minutes pass, or /narsil pasos off, offers no next steps » (un nouveau tour avant que les minutes ne passent, ou /narsil pasos off, ne propose aucune étape suivante) et « the next steps ask how the project goes on, from its log, its status and its pending tasks » (les étapes suivantes demandent comment le projet se poursuit, à partir de son historique, de son état et de ses tâches en attente) couvrent le reste ; le dernier vérifie qu’une tâche cochée et le journal n’atteignent jamais le prompt.

## Pour aller plus loin

- `stepsCommand` dans `hooks/register.tsx` gère `/narsil pasos on` et `off`, à côté de `/narsil cache`.
- `shownState` envoie les étapes au hub, si bien que la fenêtre flottante les affiche avec la conversation ; l’état du téléphone les laisse de côté pour les autres conversations.
- `pendingTasks` dans `hooks/advice.ts` lit aussi les tâches d’un tableau sous `## Tasks`, par les mots pending, pendiente, todo ou in progress, si bien qu’un journal de tâches écrit sous forme de tableau fonctionne aussi.
- Avec les conseils du guide 11 et ce guide, chaque appel au modèle que fait Narsil passe par `$.model.complete` avec Haiku, sauf le conseil approfondi, qui fait un fork de la session.
