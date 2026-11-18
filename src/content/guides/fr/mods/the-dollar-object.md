---
title: L’objet $
description: Les domaines de l’interface du moteur que reçoit chaque hook, avec leurs vraies signatures et l’endroit où narsil-pet et narsil-check utilisent chacun d’eux.
route: mods
order: 2
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: types/index.d.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: types/index.d.ts
---

## Ce que ça fait

Chaque hook reçoit `$`, l’interface du moteur. Un mod n’a ni Node ni navigateur, si bien que `$` est son seul moyen d’atteindre l’extérieur : l’écran, ses données enregistrées, l’horloge, le réseau, les processus, les fichiers, la session, le modèle, les outils et les commandes.

Ce guide est une carte de `$`. Il montre quel domaine fait quoi, pour que vous puissiez demander la bonne chose à Claude et reconnaître un appel qui n’existe pas. Chaque méthode apparaît avec sa signature telle que la déclare Claude Code 2.1.325, et avec l’endroit où les mods Narsil l’utilisent.

`$` contient davantage que ce qui figure ici (thèmes, paramètres, agents, télémétrie et d’autres). Le fichier de déclarations, `claude-code.d.ts`, documente chaque nom et chaque méthode avec son commentaire de documentation et un exemple.

## Comment ça marche à l’intérieur

Chaque méthode de `$` est un appel qui passe par l’hôte : il est émis comme un événement, si bien que les hooks d’autres plugins peuvent le voir, le réécrire ou le refuser, et presque toutes les méthodes retournent une promesse. Les types proviennent du module `claude-code` :

```ts
import type { EngineInterface } from 'claude-code'
```

Une fonction utilitaire qui reçoit `$: EngineInterface` peut faire les mêmes appels qu’un hook.

| Domaine     | À quoi il sert                                                                                      | Utilisé dans                           |
| ----------- | --------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `$.ui`      | Toasts, notifications, lignes de journal, ligne d’état, panneaux, presse-papiers, tables d’éléments | les deux                               |
| `$.store`   | Données JSON conservées d’une session à l’autre                                                     | les deux                               |
| `$.state`   | Valeurs nommées pour la session, lues pendant le dessin                                             | les deux, via `atom`, `read`, `update` |
| `$.clock`   | L’heure et les minuteurs                                                                            | les deux                               |
| `$.process` | Commandes sur l’hôte                                                                                | les deux                               |
| `$.http`    | Requêtes réseau via l’hôte                                                                          | les deux                               |
| `$.fs`      | Fichiers                                                                                            | les deux                               |
| `$.session` | Le répertoire, l’identifiant, la consommation et les surfaces de la session                         | les deux                               |
| `$.model`   | Complétions ponctuelles                                                                             | les deux                               |
| `$.tool`    | Outils que le modèle peut appeler                                                                   | narsil-check                           |
| `$.command` | Commandes slash                                                                                     | les deux                               |
| `$.mcp`     | Appel des outils d’un serveur MCP connecté                                                          | narsil-check                           |
| `$.prompt`  | La zone de prompt et l’envoi de prompts                                                             | les deux                               |
| `$.audio`   | Synthèse vocale et son                                                                              | narsil-pet                             |
| `$.env`     | Variables d’environnement                                                                           | narsil-pet                             |
| `$.plugin`  | Le nom et le dossier du plugin lui-même                                                             | narsil-pet                             |

## Le construire avec Claude

Vous n’avez pas besoin d’apprendre `$` par cœur. Ce qui aide, c’est de savoir quel domaine fait quoi, pour pouvoir décrire votre idée dans ces termes et repérer un appel qui n’existe pas. Une bonne façon de travailler consiste à demander à Claude un plan avant le code :

> En utilisant le skill plugin-authoring, je veux que mon mod Claude Code `greeter` compte combien de sessions j’ai démarrées, garde ce nombre d’une session à l’autre, l’affiche dans un toast au démarrage d’une session, et réponde à une commande `/greeter` avec le même nombre. Dis-moi d’abord quels domaines de `$` tu utiliserais pour chaque partie et pourquoi. Écris ensuite le code, en vérifiant chaque appel dans `claude-code.d.ts`.

L’étape du plan compte. Si Claude annonce qu’il gardera le nombre dans `$.state`, vous savez déjà que quelque chose ne va pas : `$.state` se termine avec la session, et c’est `$.store` qui dure. Le repérer en une phrase coûte moins cher que de le découvrir plus tard dans le code.

Quand Claude écrit le code, vérifiez :

1. Chaque appel à `$` figure dans le tableau ci-dessus ou dans `claude-code.d.ts`. Si vous ne trouvez pas un appel, demandez à Claude où il est déclaré.
2. Le nombre est lu et écrit avec `$.store.get` et `$.store.set`.
3. La commande est enregistrée avec `$.command.register` dans `session.start` et reçoit sa réponse dans un hook `command.run`.
4. Les appels qui peuvent échouer ont un `.catch`, ou leur résultat est vérifié (`isSent`, `isAnswered` et autres).

## Comprendre chaque domaine, avec des exemples

Chaque domaine ci-dessous a quelques lignes écrites comme Claude les écrirait, et ce que renvoie chaque méthode. Inutile de les mémoriser : servez-vous-en pour reconnaître ce qu’écrit Claude et pour demander la bonne chose.

### $.ui : ce que voit la personne

```ts
$.ui.toast('Saved 3 notes')
$.ui.log('greeter: cache warmed', { to: 'debug' })
$.ui.status('greeter: 2 tool calls')
$.ui.status(undefined)

const sent = await $.ui.notify('Tests passed', { title: 'greeter' })
if (!sent.isSent) $.ui.log(`no notification: ${sent.reason}`)

const opened = await $.ui.open({ id: 'notes', title: 'Notes' })
if (!opened.isPlaced) $.ui.log(`pane waits: ${opened.reason}`)
```

- `toast(text, options?)` affiche une petite boîte pendant quelques secondes (`timeoutMs`, 4000 par défaut). Elle ne touche ni à la transcription ni au modèle.
- `log(text, options?)` ajoute à la transcription une ligne estompée que le modèle ne lit pas ou, avec `{ to: 'debug' }`, écrit uniquement dans le journal de débogage.
- `status(text | undefined)` épingle une ligne pour ce plugin sous le prompt ; `undefined` la retire.
- `notify(text, options?)` déclenche une notification native par le canal propre à la personne et se résout avec `{ isSent: true, channel }` ou `{ isSent: false, reason }`.
- `open(pane)` ouvre un panneau que le plugin dessine ensuite avec un hook `ui.render` sur `{ component: 'Pane' }`. Elle se résout avec `{ isPlaced: true }` ou `{ isPlaced: false, reason }`.
- `copy({ text, surface })` place du texte dans le presse-papiers de la surface indiquée et se résout avec `{ isCopied: true }` ou `{ isCopied: false, reason }`. Un gestionnaire d’appui transmet `e.surface`.
- `resolve(e)` retourne la table d’éléments (`Box`, `Text`, `Button` et d’autres) de la surface sur laquelle dessine un hook `ui.render`. Le guide « Surfaces » la présente.

Le `hooks/register.tsx` de narsil-check utilise `$.ui.copy` et `$.ui.toast` ensemble dans `copyRow`, et ouvre son panneau avec `$.ui.open({ id: PANE, title: TITLE })` sur `session.start`. Le `hooks/register.tsx` de narsil-pet essaie `$.ui.notify` avant son propre script de notification. Aucun des deux mods n’appelle `$.ui.status` ; la ligne ci-dessus suit l’exemple du fichier de déclarations.

### $.store : des données d’une session à l’autre

```ts
const runs = Number((await $.store.get('runs')) ?? 0) + 1
await $.store.set('runs', runs)

const old = (await $.store.keys()).filter((key) => key.startsWith('day:'))
for (const key of old) await $.store.delete(key)
```

- `get(key)` se résout avec la valeur ou `undefined`. Son type est `unknown` : vérifiez-le ou convertissez-le.
- `set(key, value)` enregistre des données JSON. Une `Date` revient sous forme de chaîne ISO et un champ `undefined` est supprimé. Elle rejette une fonction, une référence circulaire ou un store dont le JSON dépasse 4 Mio au total.
- `keys()` se résout avec toutes les clés dans l’ordre d’insertion ; `delete(key)` en supprime une.

Le store est un fichier JSON propre au plugin, situé dans le répertoire de configuration Claude Code de l’utilisateur ou de l’utilisatrice. narsil-pet restaure ses préférences avec `$.store.get(PREFS_KEY)` sur `session.start`, et élague les anciennes statistiques par session avec `$.store.keys()` et `$.store.delete(key)`.

### $.state : des valeurs pour le dessin

`$.state` contient des valeurs nommées pour la session. Elles survivent à un rechargement à chaud du code du mod, et un hook `ui.render` qui en lit une est redessiné quand elle change, sans appel à `$.ui.invalidate`. Chaque valeur est déclarée dans le contrat du mod (`types/index.d.ts`) sous `PluginState`.

Les appels bruts prennent une référence dont `plugin` et `key` sont des littéraux :

```ts
const ref = { plugin: 'greeter', key: 'calls' } as const

const held = await $.state.get(ref)
await $.state.set(ref, (held.value ?? 0) + 1, { ifVersion: held.version })
```

`get` se résout avec `{ value, version }` (`undefined` à la version 0 tant que rien n’a été écrit). `set` avec `ifVersion` n’écrit que si la valeur en est toujours à cette version. Les deux mods Narsil utilisent plutôt les utilitaires de `claude-code`, qui s’en chargent pour vous :

```ts
import { atom, read, update } from 'claude-code'

const calls = atom({ plugin: 'greeter', key: 'calls' } as const, 0)

const now = await read($, calls)
await update($, calls, (n) => n + 1)
```

La différence qui compte : `$.state` dure le temps de la session et `$.store` d’une session à l’autre. Pour conserver une valeur d’état après la fin de la session, écrivez-la aussi dans `$.store`. Un hook de rendu n’écrit jamais d’état (`$.state.set` pendant le dessin est refusé) ; écrivez depuis un gestionnaire d’appui ou un autre événement. narsil-pet déclare tout son état dans `types/index.d.ts` sous `PluginState['narsil-pet']` et crée chaque valeur avec `atom` en tête de `hooks/register.tsx`.

### $.clock : l’heure et les minuteurs

```ts
const startedAt = await $.clock.now()
await $.clock.sleep(500)

const once = $.clock.after(10_000, () => $.ui.toast('Ten seconds in'))
const tick = $.clock.every(2000, () => $.ui.status('still here'))
once.cancel()
tick.cancel()
```

`now()` se résout avec le nombre de millisecondes écoulées depuis l’epoch. `sleep(ms, options?)` attend et accepte un `signal`. `after(ms, fn)` et `every(ms, fn)` retournent un minuteur doté de `cancel()`. Un rechargement à chaud annule les minuteurs en attente. narsil-pet démarre sa fenêtre avec `$.clock.after(10, ...)` et un battement régulier avec `$.clock.every(2000, ...)` sur `session.start`.

### $.process, $.http, $.env, $.plugin : l’hôte

```ts
const { exitCode, stdout } = await $.process.run(['git', 'status', '--short'], { timeoutMs: 5000 })
const { ok, status, text } = await $.http.fetch('https://example.com/status')
const home = await $.env.get('HOME')
const script = `${$.plugin.root}/scripts/hello.sh`
```

- `process.run(argv, init?)` exécute une commande à partir de son vecteur d’arguments, sans shell, et se résout avec `{ exitCode, stdout, stderr }` quel que soit le code de sortie. `init` accepte `cwd`, `env`, `stdin` et `timeoutMs` (30 s par défaut).
- `http.fetch(url, init?)` passe par l’hôte et se résout avec `{ status, ok, headers, text }`. `init` accepte `method`, `headers`, `body`, `auth` et `socketPath`.
- `env.get(name)` se résout avec la variable ou `undefined`. Le nom doit être un littéral de chaîne, pour que la validation puisse lister ce que lit le module.
- `plugin.root` est le dossier du plugin (chemin absolu) et `plugin.name` le nom indiqué dans son manifeste. Ce sont deux chaînes simples, pas des appels.

narsil-check exécute des gestionnaires de paquets et `gh` avec `$.process.run`, et interroge des registres et OSV.dev avec `$.http.fetch`. narsil-pet lit `OS` avec `$.env.get` et construit les chemins de ses scripts à partir de `$.plugin.root`.

### $.fs : les fichiers

```ts
const path = `${await $.session.cwd()}/notes.json`
if (await $.fs.exists(path)) {
  const notes = JSON.parse(await $.fs.read(path)) as unknown
  await $.fs.write(path, JSON.stringify(notes, null, 2))
}
const entries = await $.fs.list(await $.session.cwd())
```

`read(path)` se résout avec le texte (ou des octets avec `{ as: 'bytes' }`) et rejette quand le fichier est absent ou dépasse 4 Mio. `write(path, text)` crée le fichier et ses répertoires. `exists(path)` et `list(path?)` font ce que leur nom indique ; chaque entrée de `list` comporte `name`, `kind`, `size`, `mtimeMs` et `isLink`. L’utilitaire `readJson` de narsil-check consiste en `$.fs.exists` suivi de `$.fs.read`.

### $.session : la session elle-même

```ts
const cwd = await $.session.cwd()
const id = await $.session.id()
const usage = await $.session.usage()
const inApp = (await $.session.surfaces()).some((s) => s !== 'terminal')
```

`cwd()` est le répertoire dans lequel s’exécute la session, `id()` son identifiant, `usage()` le moment où elle a commencé et le taux de remplissage de la fenêtre de contexte, et `surfaces()` toutes les surfaces sur lesquelles elle dessine. narsil-pet lit les quatre ; narsil-check lit `cwd()`.

### $.model : les complétions

```ts
const reply = await $.model.complete({
  model: 'haiku',
  system: 'Answer in one line.',
  prompt: 'Name a color.',
  maxTokens: 50,
})
const color = reply.isAnswered ? reply.text : `no answer: ${reply.reason}`

const forked = await $.model.fork({ prompt: 'Summarize this session in one sentence.' })
```

`complete` exécute une complétion unique, sans outils ni historique, et se résout toujours avec un résultat : `isAnswered` avec `text`, ou `isAnswered: false` avec une `reason`. `fork` exécute une complétion sans outils sur la transcription de la session elle-même. Les deux comptent dans le coût de la session. narsil-pet rédige ses conseils avec `$.model.complete({ model: 'haiku', ... })` et ses conseils plus approfondis avec `$.model.fork` ; narsil-check demande à Haiku pourquoi une mise à niveau est risquée.

### $.tool et $.command : ce que le modèle et la personne peuvent appeler

```tsx
on('session.start', async ($, e, next) => {
  await $.command.register({
    name: 'notes',
    description: 'Show the notes count',
    argumentHint: 'clear',
  })
  await $.tool.register({
    name: 'add_note',
    description: 'Add a note to the list.',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  })
  return next(e)
})

on('command.run', { command: 'notes' }, async ($, e) => {
  const count = Number((await $.store.get('count')) ?? 0)
  return { text: e.args.trim() === 'clear' ? 'Cleared.' : `${count} notes` }
})

on('tool.call', { tool: 'mcp__greeter__add_note' }, async ($, e) => {
  const text = (e as unknown as { text?: unknown }).text
  if (typeof text !== 'string') return { deny: 'A note needs text.' }
  return { result: `Added: ${text}` }
})
```

`command.register` déclare `/<name>` ; un hook `command.run` sur `{ command: '<name>' }` y répond avec `{ text }`. `tool.register` déclare un outil nommé `mcp__<plugin>__<name>` ; un hook `tool.call` sur ce nom y répond. Les deux s’enregistrent depuis `session.start`. Ce modèle est adapté du `hooks/register.tsx` de narsil-check, qui enregistre ses quatre outils de liste de tâches dans `registerTools` et répond à chacun avec `{ result }` ou `{ deny }`.

### $.mcp, $.prompt, $.audio

```ts
const result = await $.mcp.call('example-server', 'list_items', { limit: 5 })
await $.prompt.fill({ text: 'Run the tests again' })
await $.prompt.submit({ text: 'List the files changed today' })
await $.audio.speak('Done')
```

- `mcp.call(server, tool, args?)` appelle un outil d’un serveur MCP connecté avec la connexion propre au moteur, et se résout avec des blocs `content` et `isError`. narsil-check lit ainsi les serveurs de session de l’application de bureau.
- `prompt.fill({ text })` place du texte dans la zone de prompt sous forme de brouillon. narsil-pet l’utilise quand vous choisissez une étape suivante proposée.
- `prompt.submit({ text })` met en file d’attente un prompt qui lance son propre tour dès que la session est inactive. narsil-check l’utilise pour confier une tâche à Claude.
- `audio.speak(text)` parle avec le synthétiseur de la plateforme. narsil-pet s’y rabat quand son propre script vocal n’est pas disponible.

## Erreurs fréquentes et comment tester

- **Considérer `$.state` comme permanent.** Il prend fin avec la session. Persistez via `$.store`.
- **Écrire de l’état pendant le dessin.** `$.state.set` dans un hook `ui.render` est refusé. Écrivez depuis `onPress` ou un autre événement.
- **Des clés d’état ou des noms de variables d’environnement calculés.** `plugin` et `key` dans une référence d’état, ainsi que le nom passé à `$.env.get`, doivent être des littéraux dans le code source.
- **Ignorer la forme des résultats.** `$.model.complete`, `$.ui.notify`, `$.ui.open` et `$.ui.copy` se résolvent avec un résultat qui indique si l’opération a réussi, au lieu de rejeter. Vérifiez `isAnswered`, `isSent`, `isPlaced` ou `isCopied`.
- **Oublier que les appels peuvent échouer.** Les deux mods enveloppent les appels facultatifs dans `.catch(() => undefined)` pour qu’un échec n’arrête pas un hook.

`claude plugin validate` liste chaque appel à `$` que fait le module (`calls: $.state.get, $.ui.toast, ...`), les clés d’état qu’il lit et écrit, et les noms de variables d’environnement qu’il utilise. La vérification des types par rapport au fichier de déclarations repère un nom de méthode ou un argument erroné avant qu’une session ne charge le mod.

## Pour aller plus loin

- `hooks/register.tsx` de narsil-pet : `session.start` utilise `$.command.register`, `$.store.get`, `$.env.get`, `$.session.usage`, `$.session.cwd`, `$.clock.after` et `$.clock.every` dans un seul hook.
- `hooks/register.tsx` de narsil-check : `registerTools` pour `$.tool.register`, les hooks `tool.call` sur `mcp__narsil-check__...` qui y répondent, et `copyRow` pour `$.ui.copy`.
- Les deux fichiers `types/index.d.ts` : les déclarations `PluginState` derrière chaque `atom`.
