---
title: 'Surfaces : terminal, bureau, VS Code et mobile'
description: 'Où dessine un mod, quels éléments offre chaque surface, et comment écrire un hook de rendu qui fonctionne dans le terminal, l’application de bureau, VS Code et l’application mobile.'
route: mods
order: 4
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: README.md
  - repo: pet
    path: hooks/register.tsx
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: README.md
---

## Ce que ça fait

Un même mod peut dessiner dans le terminal, dans l’application de bureau Claude, dans VS Code et dans l’application mobile Claude. Chacun de ces endroits est une surface, et chaque surface a son propre jeu d’éléments (boîtes, texte, boutons, champs).

Ce guide explique comment un mod apprend sur quelle surface il dessine, ce que propose chaque surface, et comment demander à Claude un seul design qui tienne sur toutes.

## Comment ça marche à l’intérieur

Un mod dessine en accrochant `ui.render` pour un composant. Le hook reçoit une instance de composant dans `e` :

- `e.component` : l’emplacement dessiné (`AbovePrompt`, `Pane`, `ToolUse` et d’autres).
- `e.surface` : l’endroit où il est dessiné : `terminal`, `desktop`, `mobile` ou `vscode`.
- `e.props` : les props propres à l’emplacement, sous forme de données simples.
- `e.viewport` : une fois que la surface a pris ses mesures, la taille dans laquelle elle dessine, en cellules de caractères.

Une session peut dessiner sur plusieurs surfaces à la fois, par exemple un terminal et deux téléphones. `$.session.surfaces()` liste toutes les surfaces sur lesquelles dessine la session, le terminal en premier. Un hook de rendu n’a pas besoin de cette liste : il est sollicité une fois par surface et lit `e.surface` à chaque fois.

Les éléments ne sont pas des globales. `$.ui.resolve(e)` retourne la table de la surface sur laquelle `e` est dessiné, et le hook en extrait ses balises JSX par déstructuration. Restreindre `e.surface` restreint le type de la table.

| Surface    | Éléments                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `terminal` | `Box`, `Text`, `Button`, `Input`, `Select`, `Link`, `Code`, `Markdown`, `Progress`, plus `Client`, `Raster` et `Image`. Pas de `Svg`. |
| `desktop`  | Les neuf éléments communs, plus `Svg` et `Client`.                                                                                    |
| `vscode`   | La table du bureau, sans `Client`.                                                                                                    |
| `mobile`   | Les neuf éléments communs, plus `Svg`. Pas de `Client`.                                                                               |

Sur mobile, une application ne reçoit un `Input` ou un `Select` que si elle a déclaré les dessiner, et une `Box` vide sinon ; de même pour un `Progress`, qui se rabat sur sa `Box` et son `Text`. Un hook ne peut pas savoir ce que l’application a reçu.

Où chaque emplacement est dessiné, tel que l’indique le fichier de déclarations :

| Emplacement                                  | Émis sur                              | Remarques                                                                                                                                                                                        |
| -------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AbovePrompt` (la bande au-dessus du prompt) | terminal, bureau et mobile uniquement | Une ligne par plugin. La personne peut la réduire ou lui donner le focus.                                                                                                                        |
| `Pane` (ouvert avec `$.ui.open`)             | toutes les surfaces attachées         | Ancré dans la disposition plein écran du terminal, sinon au-dessus du prompt. Dans l’application de bureau, il peut aussi être un petit `widget`, à lire dans `e.props.placement`.               |
| `ToolUse` (la ligne d’un appel d’outil)      | toutes les surfaces attachées         | Sur mobile, un arbre qui conserve la ligne s’affiche généralement comme une ligne discrète en dessous ; un `borderStyle` ou un `backgroundColor` sur la `Box` qui le contient demande une carte. |

Deux sorties ne passent pas par `ui.render`. `$.ui.status(text)` épingle une ligne pour le plugin sous le prompt. `$.ui.toast(text)` flotte dans le coin supérieur droit de la transcription et, là où la transcription est imprimée dans l’historique de défilement, occupe une ligne de la barre de notifications. Le fichier de déclarations n’indique pas, surface par surface, où apparaissent ces deux sorties.

## Le construire avec Claude

Le piège avec les surfaces, c’est qu’un mod peut sembler correct sur la surface que vous testez et casser sur une autre. Le prompt demande donc à Claude de consulter la table des éléments avant d’utiliser un élément, et de tester chaque surface :

> En utilisant le skill plugin-authoring, ajoute une bande au-dessus du prompt à mon mod Claude Code `greeter` : un hook `ui.render` sur `AbovePrompt` qui affiche le nombre d’appels d’outils et la surface sur laquelle il est dessiné, et qui renvoie `next(e)` quand `e.props.hasSurvey` est vrai. Prends les éléments dans `$.ui.resolve(e)`. Dessine ensuite un `Pane` avec l’identifiant de requête `notes` qui affiche un champ de texte uniquement là où la surface a `Input` et n’est pas mobile, et la ligne « Ask Claude to add a note. » partout ailleurs. Écris un test avec `claude-code/testing` qui monte le panneau sur `terminal`, `desktop`, `vscode` et `mobile` dans une seule boucle.

Quand Claude répond, vérifiez :

1. Les éléments viennent de `$.ui.resolve(e)`. Aucun n’est importé ni supposé.
2. Chaque élément qui ne figure pas dans les quatre tables (`Input`, `Svg`, `Raster`, `Image`, `Client`) est vérifié avant usage, avec une solution de repli.
3. Le test parcourt les quatre surfaces.
4. Aucun hook de rendu n’appelle `$.state.set`.

Même si vous n’utilisez que le terminal, cette boucle de test est le moyen de savoir si le mod tient dans l’application de bureau et sur un téléphone.

## Comprendre le code, pas à pas

Voici à quoi ressemble une bonne réponse. Lisez-la pour comprendre pourquoi chaque vérification est là et pour la comparer avec ce que Claude a écrit.

### 1. Une bande qui lit sa surface

```tsx
import { atom, read } from 'claude-code'
import type { Register } from 'claude-code'

const calls = atom({ plugin: 'greeter', key: 'calls' } as const, 0)

export const register: Register = (on) => {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const count = await read($, calls)
    const where = e.surface === 'terminal' ? 'in the terminal' : `on ${e.surface}`

    return (
      <Box>
        <Text dimColor>
          {count} tool calls {where}
        </Text>
      </Box>
    )
  })
}
```

`Box` et `Text` figurent dans toutes les tables : cet arbre se dessine donc partout où la bande est émise. Le hook cède la place à un sondage (`e.props.hasSurvey`) en retournant `next(e)`.

### 2. N’utiliser un élément que là où la surface le possède

Quand un arbre a besoin d’un élément qui manque sur certaines surfaces, vérifiez la table au lieu de le supposer présent. Cet exemple est adapté du hook `Pane` du `hooks/register.tsx` de narsil-check, qui n’affiche un SVG que là où `Svg` existe et un champ de texte partout sauf sur mobile :

```tsx
on('ui.render', { component: 'Pane', requestId: 'notes' }, async ($, e) => {
  const elements = $.ui.resolve(e)
  const { Box, Text } = elements
  const Input = e.surface !== 'mobile' && 'Input' in elements ? elements.Input : undefined

  return (
    <Box flexDirection="column">
      <Text bold>Notes</Text>
      {Input ? (
        <Input key="new" label="New note" onSubmit={() => undefined} />
      ) : (
        <Text dimColor>Ask Claude to add a note.</Text>
      )}
    </Box>
  )
})
```

La même vérification avec `'Svg' in elements` maintient le terminal, qui n’a pas de `Svg`, sur une solution de repli textuelle.

### 3. S’adapter à l’espace disponible

Un hook `Pane` ou `AbovePrompt` dimensionne son arbre selon `e.props.bodyColumns`, la boîte dans laquelle il dessine. Elle est plus étroite que la zone d’affichage quand un panneau est ancré à côté de la transcription. Un changement de largeur relance chaque emplacement accroché : un arbre dimensionné à partir de `bodyColumns` reste donc correct.

### 4. Le tester sur chaque surface

`claude plugin test` monte un composant sur une surface que le test nomme, jamais sur une surface supposée. Bouclez le même corps sur les surfaces :

```tsx
for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
  const ui = await $.ui.mount({ ...PANE, surface })
  expect(await ui.find({ type: 'Text', text: /Notes/ })).toBeDefined()
  await ui.unmount()
}
```

`PANE` contient `plugin`, `component`, `requestId` et `props`, comme dans l’exemple `pane.test.tsx` du skill.

## Erreurs fréquentes et comment tester

- **Supposer la table d’une seule surface.** `Svg` ne figure pas dans la table du terminal, et `Raster` et `Image` ne figurent que dans celle du terminal. Vérifiez la table (`'Svg' in elements`) ou restreignez `e.surface`, et les types vous indiquent quels éléments vous pouvez utiliser.
- **Un arbre qui ne passe pas la validation.** Un élément absent de la surface, une prop qu’il n’accepte pas ou un enfant là où il n’en faut pas fait échouer le hook. Seul ce hook est ignoré, et les parties des autres plugins se dessinent toujours. Le journal de débogage, ainsi que la transcription pendant qu’un dossier de plugin se recharge à chaud, en donnent la raison.
- **Compter sur `Input` sur mobile.** Une application mobile qui ne le dessine pas n’affiche rien à sa place. Proposez un autre moyen, par exemple demander à Claude via un outil enregistré.
- **S’attendre à voir la bande partout.** Dans ce build, le fichier de déclarations n’émet `AbovePrompt` que sur les surfaces terminal, bureau et mobile. Un `Pane` est émis sur toutes les surfaces attachées.
- **Une seule surface dans les tests.** Un test qui ne monte que `terminal` ne prouve rien pour les autres. Bouclez sur les quatre.

## Pour aller plus loin

Le README de narsil-pet indique que sa bande, ses animations, ses conseils et ses barres de consommation fonctionnent partout où Claude Code les dessine, et liste le terminal, l’application de bureau, VS Code et l’application mobile. Sa voix, ses notifications et sa fenêtre flottante s’exécutent sur l’ordinateur où tourne la session : elles dépendent donc de ce système plutôt que de la surface. Son hook `ui.render` sur `AbovePrompt` dans `hooks/register.tsx` enregistre quelles surfaces ont demandé la bande, et `surfaceReport` combine cette information avec `$.session.surfaces()`.

Le README de narsil-check comporte un tableau par surface : les sections des mises à niveau, des vulnérabilités et des tâches en attente fonctionnent sur toutes les surfaces, l’application mobile n’a pas de champ pour saisir des tâches (on les ajoute en le demandant à Claude), et les sections de l’environnement, des connecteurs et du contrôle à distance n’apparaissent que dans l’application de bureau, car elles sont lues depuis les propres serveurs MCP de l’application de bureau. Dans `hooks/register.tsx`, le hook `Pane` résout `Svg` et `Input` à partir de la table, comme à l’étape 2.
