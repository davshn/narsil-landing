---
title: De quoi se compose un mod
description: Les trois fichiers d’un mod Claude Code, la fonction register et ses hooks, et le plus petit mod qui affiche quelque chose à l’écran.
route: mods
order: 1
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: .claude-plugin/plugin.json
  - repo: pet
    path: hooks/hooks.json
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: types/index.d.ts
---

## Ce que ça fait

Un mod est un plugin Claude Code composé de hooks de fonction : du TypeScript qui s’exécute à l’intérieur de Claude Code et modifie ce qu’il affiche ou la façon dont il se comporte. À la fin de ce guide, vous saurez quels fichiers un mod nécessite et ce que fait la fonction `register`, et vous aurez un mod qui affiche un toast au démarrage d’une session et tient le compte des appels d’outils dans sa ligne d’état.

L’API des mods est en accès anticipé et change d’une version à l’autre. Tout ce qui figure ici a été vérifié avec Claude Code 2.1.325 et son fichier de déclarations, `claude-code.d.ts`. Si votre build est plus récent, c’est ce fichier qui fait foi.

## Comment ça marche à l’intérieur

Un mod est un dossier contenant trois fichiers que vous écrivez à la main :

| Fichier                      | Ce qu’il contient                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `.claude-plugin/plugin.json` | Le manifeste : `name`, `version`, `description` et, en option, `license`, `repository` et `types`.                  |
| `hooks/hooks.json`           | Une ligne qui nomme le module de hooks : `{ "modules": ["./register.tsx"] }`. Le chemin est relatif à `hooks.json`. |
| `hooks/register.tsx`         | Le module de hooks. Il exporte `register`.                                                                          |

Le module de hooks est un module ES dont le nom se termine par `.ts`, `.tsx`, `.js` ou un autre suffixe de script. Il s’exécute dans un environnement qui lui est propre, sans DOM et sans Node. Tout ce qui est extérieur au module (l’écran, les fichiers, le réseau, l’horloge) passe par l’objet `$` que reçoit chaque hook. Les autres fichiers du plugin s’importent avec des déclarations `import` ordinaires ; un module qui utilise `import()` dynamique ne se charge pas.

`register(on, options)` est appelée au chargement du module. `on(event, matcher?, hook)` ajoute un hook à un événement. `options` contient les valeurs des champs `userConfig` que le manifeste déclare, le cas échéant.

Chaque hook a la forme `($, e, next)` :

- `$` est l’interface du moteur : affichage, store, état, horloge, réseau, processus, fichiers, session, modèle, outils, commandes et le reste.
- `e` est l’entrée de l’événement, sous forme de valeur simple. Pour `tool.call`, c’est l’appel d’outil, typé précisément selon l’outil.
- `next(e)` transmet l’événement aux autres plugins puis au comportement propre de Claude Code, et se résout avec le résultat de l’événement.

Un hook qui se termine sans appeler `next` répond lui-même à l’événement. Un hook qui appelle `next({ ...e, ... })` modifie ce que voit le reste de la chaîne, dans les limites permises par cet événement. La plupart des hooks qui se contentent d’observer se terminent par `return next(e)`.

Le fichier facultatif `types/index.d.ts` est le contrat de types du mod. Il déclare la forme des valeurs que le mod conserve dans `$.state` (et, pour un mod qui ajoute un nom à `$`, ce nom). `plugin.json` le désigne sous `"types"`, et `claude plugin validate` vérifie les lectures et écritures d’état du mod par rapport à ce contrat.

## Pas à pas

### 1. Le manifeste

Créez un dossier nommé `greeter` et écrivez `.claude-plugin/plugin.json` :

```json
{
  "name": "greeter",
  "version": "0.1.0",
  "description": "Says hello when a session starts and counts tool calls"
}
```

Le `name` est le nom par lequel Claude Code, son journal de débogage et vos clés d’état désignent le mod.

### 2. Le fichier de hooks

Écrivez `hooks/hooks.json` :

```json
{ "modules": ["./register.tsx"] }
```

### 3. Un hook qui affiche quelque chose

Écrivez `hooks/register.tsx` avec un hook sur `session.start` :

```tsx
import type { Register } from 'claude-code'

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    $.ui.toast('Hello from greeter')
    return next(e)
  })
}
```

`Register` provient du module `claude-code`. L’import ne sert qu’aux types : à l’exécution, il est vide. `$.ui.toast(text)` affiche une petite boîte sous le nom du plugin pendant quelques secondes (4000 ms par défaut). Le hook appelle ensuite `next(e)` pour que la session démarre normalement.

### 4. Une ligne d’état qui compte les appels d’outils

Ajoutez un second hook. `tool.call` s’exécute à chaque appel d’outil, et `$.ui.status(text)` épingle une ligne pour ce plugin sous le prompt jusqu’à ce que l’appel suivant la remplace :

```tsx
import type { Register } from 'claude-code'

export const register: Register = (on) => {
  let count = 0

  on('session.start', async ($, e, next) => {
    $.ui.toast('Hello from greeter')
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    count += 1
    $.ui.status(`greeter: ${count} tool calls`)
    return next(e)
  })
}
```

Cela fonctionne, mais `count` est une variable de module. Enregistrer le fichier recharge le module dans un environnement neuf, et le compte repart de zéro.

### 5. Un contrat de types et un état qui survit à un rechargement

`$.state` contient des valeurs nommées pour la session, et elles survivent à un rechargement à chaud du module. Déclarez la valeur dans `types/index.d.ts` :

```ts
declare module 'claude-code' {
  interface PluginState {
    greeter: { calls: number }
  }
}
```

Désignez le fichier dans le manifeste :

```json
{
  "name": "greeter",
  "version": "0.1.0",
  "description": "Says hello when a session starts and counts tool calls",
  "types": "./types/index.d.ts"
}
```

Utilisez ensuite les utilitaires d’état `atom` et `update` de `claude-code` :

```tsx
import { atom, update } from 'claude-code'
import type { Register } from 'claude-code'

const calls = atom({ plugin: 'greeter', key: 'calls' } as const, 0)

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    $.ui.toast('Hello from greeter')
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const count = await update($, calls, (n) => n + 1)
    $.ui.status(`greeter: ${count} tool calls`)
    return next(e)
  })
}
```

`plugin` et `key` doivent être des littéraux de chaîne, conformes au contrat. `update` lit la valeur, applique la fonction et réécrit le résultat, en réessayant si une autre écriture est passée avant, puis se résout avec la nouvelle valeur.

Le mod terminé :

```text
greeter/
  .claude-plugin/plugin.json
  hooks/hooks.json
  hooks/register.tsx
  types/index.d.ts
```

Le guide « Installer, recharger, valider et tester » montre comment le charger dans une session.

## Erreurs fréquentes et comment tester

- **Oublier `next`.** Un hook qui n’appelle jamais `next(e)` répond seul à l’événement. Sur `session.start` ou `tool.call`, cela change plus de choses que prévu. Retournez `next(e)`, sauf si répondre est justement le but.
- **Enregistrer deux fois le même hook.** Un enregistrement répété lève une exception, et une boucle qui exécute deux fois un même `on(...)` passe la validation mais est refusée au chargement.
- **Utiliser des API Node ou DOM.** Il n’y a ni `require`, ni module `fs`, ni `window`. Utilisez `$.fs`, `$.http`, `$.process` et le reste de `$`.
- **Un hook qui lève une exception.** Il est ignoré et la chaîne continue sans lui. Pendant le développement, lancez `claude --debug` : le journal de débogage indique pourquoi un hook a été ignoré.

Lancez `claude plugin validate` sur le dossier tôt et souvent. La commande lit le manifeste, le contrat et le module de hooks comme le fera Claude Code. Pour le mod `greeter` terminé, elle affiche, entre autres lignes :

```text
❯ types ./types/index.d.ts declares state: greeter.calls
❯ ./register.tsx hooks: session.start, tool.call
❯ ./register.tsx gating hook without .catch: tool.call
❯ ./register.tsx calls: $.state.get, $.state.set, $.ui.status, $.ui.toast
```

La ligne `gating hook without .catch` est un constat, pas un échec : `tool.call` est un événement dont la réponse peut refuser ce qui a été demandé, et un hook qui y échoue est ignoré. Seul un hook qui fait office de garde (un hook susceptible de refuser un appel) a besoin d’un gestionnaire `.catch`.

## Pour aller plus loin

narsil-pet suit la même structure. Son `.claude-plugin/plugin.json` définit `"license": "GPL-3.0-or-later"`, `repository` et `"types": "./types/index.d.ts"`. Son `hooks/hooks.json` est la même ligne unique que ci-dessus. Son `hooks/register.tsx` exporte `register` et enregistre un hook par événement, à commencer par `session.start`, qui enregistre la commande `/narsil`, restaure les préférences depuis `$.store` et démarre ses minuteurs avant de retourner `next(e)`. Son `types/index.d.ts` exporte les types du mod (`Mood`, `Pet`, `Prefs` et d’autres) et déclare chaque clé de `$.state` sous `PluginState['narsil-pet']`.
