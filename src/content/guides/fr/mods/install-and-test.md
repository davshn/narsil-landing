---
title: Installer, recharger, valider et tester
description: Charger un mod depuis son dossier ou une marketplace locale, le recharger après une modification et le vérifier avec claude plugin validate, claude plugin test et tsc.
route: mods
order: 3
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: .claude-plugin/marketplace.json
  - repo: pet
    path: README.md
  - repo: check
    path: .claude-plugin/marketplace.json
  - repo: check
    path: tsconfig.json
  - repo: check
    path: tests/pane.test.tsx
  - repo: check
    path: README.md
---

## Ce que ça fait

Ce guide reprend le mod `greeter` de « De quoi se compose un mod », l’exécute dans une session, le recharge après une modification et le vérifie de trois façons : `claude plugin validate` pour ce que verra le moteur, `claude plugin test` pour ce que font les hooks et `tsc` pour les types.

## Comment ça marche à l’intérieur

Claude Code lit un mod depuis l’un de deux types d’emplacement, et c’est ce qui détermine comment une modification parvient à une session en cours :

| Mode de chargement                                                                   | Comment arrive une modification                                                                                                                                      |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `claude --plugin-dir <folder>`, ou un dossier indiqué dans `CLAUDE_CODE_PLUGIN_DIRS` | Dans une session interactive, le dossier est surveillé : enregistrer un fichier recharge le module de hooks.                                                         |
| Installé depuis une marketplace qui est un dossier local, avec une `source` relative | Lancez `/reload-plugins`. La session relit le dossier lui-même, sans nouvelle version ni réinstallation.                                                             |
| Installé depuis un dépôt git, npm, une archive ou une URL                            | La session exécute la copie faite à l’installation. Une modification n’arrive que sous forme de nouvelle version, via `claude plugin update` puis `/reload-plugins`. |

Un rechargement exécute à nouveau `register` dans un environnement neuf. Les variables de module et les minuteurs en attente disparaissent ; les valeurs de `$.state` et de `$.store` restent.

## Pas à pas

### 1. L’exécuter depuis son dossier

Pour une session :

```bash
claude --plugin-dir ./greeter
```

Répétez l’option pour charger plusieurs dossiers. Là où aucune option ne peut être passée (une session lancée par l’application de bureau ou par un hôte SDK), définissez `CLAUDE_CODE_PLUGIN_DIRS` avec un ou plusieurs chemins absolus (`~` est accepté), séparés par le séparateur de listes de chemins de la plateforme. La variable est lue dans l’environnement du processus ou dans le bloc `env` de `~/.claude/settings.json`, jamais dans les paramètres d’un projet.

Dans une session interactive, le dossier est surveillé. Un enregistrement recharge le module dès que le dossier est resté calme un instant ; les enregistrements faits pendant un tour ne déclenchent qu’un seul rechargement, à la fin du tour. Pendant le développement, lancez `claude --debug` : quand un hook est ignoré ou qu’un module ne se charge pas, la transcription le signale une fois, et le journal de débogage contient chaque occurrence.

### 2. Faire du dossier une marketplace locale

Une marketplace est un seul fichier, `.claude-plugin/marketplace.json`, à côté de `plugin.json`. Son unique entrée pointe vers le dossier lui-même :

```json
{
  "name": "greeter-dev",
  "owner": { "name": "Example Author" },
  "plugins": [{ "name": "greeter", "source": "./" }]
}
```

Ajoutez le dossier comme marketplace et installez le mod depuis celle-ci :

```bash
claude plugin marketplace add ./greeter
claude plugin install greeter@greeter-dev
```

Au prompt d’une session de terminal, la ligne d’installation prend aussi la forme `/plugin install <mod> --marketplace <source>`, où la source est un `<owner>/<repo>` GitHub, une URL git ou le chemin d’un dossier. `claude plugin list` indique le dossier depuis lequel un plugin est lu (`Read from:`).

Comme la `source` de l’entrée est un chemin relatif, la session lit le mod depuis ce dossier, et non depuis une copie. Après une modification, lancez :

```text
/reload-plugins
```

Le rechargement nomme le plugin et le dossier quand le dossier a changé depuis la dernière lecture par la session.

### 3. Valider

```bash
claude plugin validate ./greeter
```

La commande lit le fichier de marketplace, le manifeste, le contrat de types et le code source du module de hooks comme le fera le moteur, et indique ce que le module accroche et appelle ainsi que tout ce que le moteur refuserait, avant qu’une session ne le charge. Pour `greeter`, la section des hooks indique :

```text
❯ ./register.tsx hooks: session.start, tool.call
❯ ./register.tsx gating hook without .catch: tool.call
❯ ./register.tsx calls: $.state.get, $.state.set, $.ui.status, $.ui.toast
❯ ./register.tsx state writes: greeter.calls
❯ ./register.tsx state reads: greeter.calls
```

La même exécution liste aussi les vérifications qu’applique l’annuaire public de plugins (un README d’au moins 40 mots, un fichier `LICENSE` ou un `license` dans `plugin.json`, une icône). Elles comptent pour une soumission, pas pour exécuter le mod.

La validation connaît le mod, pas une session : pour savoir si un hook s’est réellement exécuté, il faut vérifier dans la session, avec `claude --debug`.

### 4. Tester

`claude plugin test <folder>` exécute les fichiers `*.test.ts` et `*.test.tsx` du plugin avec le moteur lui-même. Un test importe `test` et `expect` (et `mock`) depuis `claude-code/testing` et reçoit le `$` du moteur ainsi qu’un `on` dont les hooks se placent sous le plugin et tiennent le rôle du moteur. Rien d’autre ne se trouve sous eux : c’est donc le test qui répond à ce qu’appelle le plugin, un appel sur `$` avec `{ value }`, un événement avec son propre résultat.

Écrivez `tests/greeter.test.tsx` :

```tsx
import { expect, test } from 'claude-code/testing'

test('greets on start and counts tool calls', async ($, on) => {
  const toasts: string[] = []
  const lines: (string | undefined)[] = []

  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.status', (_, e) => {
    lines.push(e.text)
    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.tool.call({ tool: 'Bash', command: 'pwd' })

  expect(toasts).toEqual(['Hello from greeter'])
  expect(lines.at(-1)).toBe('greeter: 2 tool calls')
})
```

Exécutez-le :

```bash
claude plugin test ./greeter
```

```text
(pass) greets on start and counts tool calls
 1 pass
 0 fail
```

Un test d’interface monte un composant via le plugin sur une surface qu’il nomme (`$.ui.mount({ plugin, surface, component, props })`) et agit sur le dessin par clé : `find`, `press`, `input`. Écrivez le corps une seule fois et bouclez-le sur les surfaces, afin que le test montre que le mod ne dépend pas de l’une d’elles. L’exemple `pane.test.tsx` du skill monte un `Pane` sur `terminal`, `desktop`, `vscode` et `mobile` en une seule boucle.

### 5. Vérifier les types

Quand Claude Code charge un mod depuis un dossier où il est en cours d’écriture (un dossier `--plugin-dir` ou `CLAUDE_CODE_PLUGIN_DIRS` que la session recharge à chaud), il dépose à côté les déclarations de l’API dans `.claude-plugin/types/`, avec un `tsconfig.json`. Le `tsconfig.json` propre au mod l’étend :

```json
{
  "extends": "./.claude-plugin/types/tsconfig.json"
}
```

Ensuite :

```bash
npx tsc -p ./greeter
```

`.claude-plugin/types/` est régénéré à chaque chargement : gardez-le hors de git. Les deux mods Narsil le listent dans `.gitignore`.

Un dossier que la session ne recharge pas à chaud (celui d’un plugin installé, ou un `--plugin-dir` sous `claude -p`) ne reçoit jamais ces fichiers. Vérifiez les types d’un tel mod avec le `tsconfig.json` affiché dans l’en-tête de `claude-code.d.ts`, conservé hors du dossier du mod, son `include` pointant vers une copie du fichier de déclarations et vers les dossiers `hooks`, `types` et `tests` du mod.

## Erreurs fréquentes et comment tester

- **Modifier une copie que la session n’exécute pas.** Un mod installé depuis un dépôt git exécute la copie installée. Pendant le développement, installez-le depuis une marketplace de dossier local ou chargez le dossier avec `--plugin-dir`.
- **Un hook de test qui ne retourne rien.** Dans `claude plugin test`, un hook qui tient le rôle du moteur doit répondre. Un appel sur `$` auquel rien ne répond échoue avec « returned no result » et « nothing beneath the plugins answers ui.toast ».
- **Ne tester qu’une seule surface.** Bouclez les tests d’interface sur les surfaces que vous prenez en charge ; les applications mobiles peuvent ne pas dessiner `Input` ou `Select`.
- **Committer `.claude-plugin/types/`.** Ce dossier appartient au build qui l’a écrit. Régénérez-le, ne le modifiez jamais.
- **S’attendre à ce que la validation exécute le code.** Elle lit le code source. Le comportement, c’est ce que montrent `claude plugin test` et une session `--debug`.

## Pour aller plus loin

Les deux mods Narsil fournissent un fichier de marketplace qui liste le mod avec `"source": "./"` : le `.claude-plugin/marketplace.json` de narsil-pet nomme la marketplace `narsil`, et celui de narsil-check la nomme `narsil-check`. Leurs README installent le mod avec deux lignes au prompt de Claude Code :

```text
/plugin marketplace add davshn/narsil-pet
/plugin install narsil-pet@narsil
```

et le mettent à jour avec `/plugin marketplace update` suivi de `/plugin update`. Le README de narsil-check décrit le flux de travail local de ce guide : ajoutez le dossier de votre copie avec `claude plugin marketplace add`, et les modifications arrivent avec `/reload-plugins`, sans réinstallation. Son `tsconfig.json` est le `extends` d’une ligne vu plus haut, et son dossier `tests/` contient un `*.test.tsx` par fonctionnalité ; `tests/pane.test.tsx` monte le panneau avec une constante `PANE`, de la même façon que l’exemple du skill.
