---
title: Les réactions aux commandes
description: 'Comment Narsil lit les commandes shell que Claude exécute : elle acclame les tests qui passent, remarque ceux qui échouent et avertit des commandes irréversibles sans jamais les bloquer.'
route: pet
order: 9
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/watch.ts
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Ce que ça fait

Chaque fois que Claude exécute une commande shell (l’outil `Bash` ou `PowerShell`), Narsil lit la ligne de commande et réagit à deux sortes de commandes.

**Les tests.** Quand la commande lance les tests d’un projet, Narsil attend le résultat :

- S’ils réussissent, elle fête cela dans la bande : « ¡Los tests pasan! 🎉 » (« les tests passent ! »), et gagne 5 points d’expérience.
- S’ils échouent, elle sursaute (la pose « effrayée » des guides précédents) et dit « Los tests fallan; vamos a ver por qué. » (« les tests échouent ; voyons pourquoi »).
- La fois suivante où ils passent après un échec, elle dit « ¡Recuperados! Los tests vuelven a pasar. » (« rétablis ! les tests passent de nouveau »).

Le README énumère les exécuteurs de tests qu’elle reconnaît : npm, pnpm, yarn, bun, vitest, jest, pytest, go, cargo, dotnet, maven, gradle et d’autres.

**Les commandes irréversibles.** Avant qu’une telle commande ne s’exécute, le commentaire de la bande devient un avertissement, « ⚠️ Cuidado: … no tiene vuelta atrás. » (« attention : … est irréversible »), avec le nom du type de commande à la place des points de suspension. Une ligne part aussi dans le journal du terminal, avec la première ligne de la commande. Puis la commande s’exécute normalement. Le README est clair à ce sujet : « Solo avisa: nunca bloquea nada. » (elle ne fait qu’avertir, elle ne bloque jamais rien).

Ce que cela vous apporte : un coup d’œil à la bande vous dit si la dernière exécution des tests a réussi, et une commande destructrice bénéficie d’un second regard pendant que la boîte de dialogue d’autorisation, s’il y en a une, est encore à l’écran.

## Comment ça marche à l’intérieur

### Un seul hook devant chaque outil : `tool.call`

Les deux réactions se trouvent dans le hook `tool.call` de `hooks/register.tsx`. Un hook `tool.call` enveloppe l’appel : le code placé avant `next(e)` s’exécute avant l’outil, et `await next(e)` renvoie le résultat de l’outil. C’est cette forme qui permet à Narsil d’avertir avant la commande et de réagir aux tests après.

Le hook écarte d’abord ce qui n’est pas le travail de Claude :

- Un appel fait par un autre mod (avec `$.tool.call` ou `$.mcp.call`) déclenche aussi `tool.call`. `isClaudesCall` dans `hooks/watch.ts` ne garde que les appels dont `next.origin.plugin` vaut `"engine"`. Le commentaire explique le bogue corrigé : aucun tour ne termine un appel fait par un autre mod, si bien que Narsil restait « en train de travailler » jusqu’au prompt suivant (`21df208`).
- Seuls `Bash` et `PowerShell` portent une ligne de commande (`SHELL_TOOLS` dans `hooks/words.ts`). Pour tous les autres outils, la commande est la chaîne vide, et aucune des deux réactions ne peut se déclencher.

Contrairement à l’état de la bande, cette partie n’écarte pas les sous-agents : un test lancé par un sous-agent est acclamé lui aussi.

### Reconnaître une exécution de tests

`TEST_COMMAND` dans `hooks/words.ts` est une seule expression régulière appliquée à la ligne de commande :

```ts
export const TEST_COMMAND =
  /\b(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?test|(?:go|cargo|dotnet|mvn|gradle|gradlew|deno|mix)\s+test|claude\s+plugin\s+test|python3?\s+-m\s+(?:pytest|unittest)|vitest|jest|pytest|mocha|phpunit|rspec)\b/
```

Elle cherche n’importe où dans la ligne, si bien qu’une commande qui change d’abord de répertoire puis lance les tests compte quand même.

Le fait que les tests aient réussi n’est pas lu dans leur sortie. Narsil ne regarde que `result.isError`, le verdict de l’outil lui-même sur l’appel. Analyser la sortie d’une douzaine d’exécuteurs, chacun avec son propre format de résumé, casserait à chaque nouvel exécuteur ou nouvelle version ; l’indicateur d’erreur de l’outil est le même signal pour tous, et c’est aussi celui sur lequel s’appuie une tâche de CI. Le prix à payer est que Narsil sait seulement « réussi » ou « échoué », pas combien.

Une variable de module, `areTestsFailing`, retient que la dernière exécution a échoué. C’est ce seul indicateur qui transforme le succès suivant en « rétablis » au lieu d’une simple acclamation.

Un échec alimente aussi les conseils du guide 11 : le texte de l’erreur est conservé, et deux échecs du même outil dans un même tour demandent un conseil de débogage.

### Reconnaître une commande dangereuse

`DANGEROUS_COMMANDS` dans `hooks/words.ts` est une liste de paires : le nom avec lequel Narsil avertit, et le motif qui la détecte. Un extrait, réduit aux motifs :

```ts
const DANGEROUS_COMMANDS: readonly (readonly [name: string, pattern: RegExp])[] = [
  ['rm -rf', /\brm\s+(?:-[a-zA-Z]*(?:[rR]f|f[rR])[a-zA-Z]*|-[rR]\s+-f|-f\s+-[rR])\b/],
  ['git push --force', /\bgit\s+push\b[^|;&\n]*\s(?:--force(?!-with-lease)|-f)\b/],
  ['git reset --hard', /\bgit\s+reset\s+--hard\b/],
  ['Remove-Item -Recurse -Force', /\bRemove-Item\b(?=[^|;\n]*-Recurse\b)(?=[^|;\n]*-Force\b)/i],
  ['DROP', /\bdrop\s+(?:table|database|schema)\b/i],
  // ... also git clean -f, git branch -D, chmod -R 777, mkfs, dd onto a device
  // and 'descargar y ejecutar' (download and run): curl, wget or
  // Invoke-WebRequest piped into a shell
]
```

Traduction en français du commentaire : aussi git clean -f, git branch -D, chmod -R 777, mkfs, dd vers un périphérique et « descargar y ejecutar » (télécharger et exécuter) : curl, wget ou Invoke-WebRequest redirigés vers un shell.

Quelques détails montrent le soin apporté aux motifs :

- Le push forcé exclut `--force-with-lease`, la variante qui refuse d’écraser un travail qu’elle n’a pas vu.
- `[^|;&\n]*` garde l’option dans la même commande : un `--force` placé après un pipe ou un `;` appartient à une autre commande.
- Le motif de `rm` accepte les options regroupées dans n’importe quel ordre ou écrites séparément.
- Celui de PowerShell exige à la fois `-Recurse` et `-Force`, dans n’importe quel ordre, au moyen d’assertions avant (lookaheads).

`dangerOf(command)` renvoie le nom du premier motif qui correspond, ou `null`.

### Pourquoi avertir plutôt que refuser

Un hook `tool.call` pourrait refuser l’appel : les types 2.1.325 documentent `{ deny: reason }` comme réponse, et le modèle reçoit alors le texte comme résultat d’erreur. Narsil ne le fait jamais. Ni le code ni le README ne disent pourquoi en toutes lettres ; le README affirme seulement qu’elle ne bloque jamais. Les raisons ci-dessous sont la lecture que fait ce guide du code et des types :

- **Les motifs sont des suppositions.** Supprimer récursivement un dossier de build est une opération courante dans beaucoup de scripts. Un blocage à chaque correspondance arrêterait un travail légitime, et le modèle chercherait un autre moyen de faire la même chose. Les motifs laissent aussi passer des cas (noms d’options longs, fichier de script qui contient la commande), si bien qu’un blocage promettrait une sécurité qu’il ne peut pas offrir.
- **Claude Code a déjà le verrou.** Les types décrivent `tool.check` comme se déclenchant « after the `tool.call` and PreToolUse hooks and before the mode settles an ask » (après les hooks `tool.call` et PreToolUse et avant que le mode ne tranche une demande). Les règles d’autorisation et la boîte de dialogue d’autorisation sont l’endroit où une commande est arrêtée ; l’avertissement de Narsil arrive avant cette décision, pendant que vous pouvez encore répondre non.
- **Le hook d’un mod est de toute façon une protection fragile.** Les types préviennent que « a guard that fails is skipped and the tool runs » (une protection qui échoue est ignorée et l’outil s’exécute). Une vraie protection demande un soin que Narsil, en tant que compagne, n’a pas besoin de prendre.

### Ce qu’elle affiche

Les réactions passent par `setMood`, le point d’entrée unique du premier guide : l’humeur reste celle de l’outil (« running » pour un shell, « scared » en cas d’échec), et la ligne de commentaire porte l’avertissement ou l’acclamation. La ligne du journal du terminal est écrite avec `$.ui.log`, coupée à la première ligne de la commande et à 120 caractères. L’avertissement est posé avant `next(e)`, si bien qu’il est à l’écran pendant que la commande attend une autorisation ou s’exécute.

## Le construire avec Claude

Demandez à Claude un hook `tool.call` qui lit les commandes du shell, avertit avant les commandes irréversibles et réagit aux résultats des tests. L’idée que Claude doit bien saisir : le hook avertit, et ne bloque jamais.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon mod Claude Code `my-pet`, ajoute un hook `tool.call` qui réagit aux commandes shell. Ignore les appels dont `next.origin.plugin` n’est pas `"engine"`, ainsi que les outils autres que `Bash` et `PowerShell`. Avant d’appeler `next(e)`, compare `e.command` à une liste d’expressions régulières nommées pour les commandes irréversibles (suppression récursive forcée, push forcé mais pas `--force-with-lease`, reset hard, suppression d’une table) ; en cas de correspondance, écris un avertissement avec le nom dans un atome affiché dans la bande `AbovePrompt` et consigne-le avec `$.ui.log`, et ne renvoie jamais `{ deny }`. Après `next(e)`, si la commande correspond à un motif d’exécuteur de tests, affiche « Tests pass » quand `result.isError` est faux, « Tests fail » quand il est vrai, et « Recovered » quand ils passent après un échec. Ajoute des tests avec `claude-code/testing` où l’outil reçoit sa réponse d’un hook, pour que rien ne s’exécute réellement.

### Ce qu’il faut vérifier dans la réponse de Claude

1. Le hook ignore les appels dont `next.origin.plugin` n’est pas `"engine"`, ainsi que tout outil autre que `Bash` et `PowerShell`.
2. L’avertissement est posé avant `next(e)`, pour qu’il soit à l’écran pendant que la commande attend une autorisation ou s’exécute.
3. Aucun chemin du hook ne renvoie `{ deny }`.
4. La réussite ou l’échec se lit dans `result.isError`, pas dans la sortie des tests, et un drapeau retient l’échec pour que la réussite suivante dise « Recovered ».
5. Les tests répondent à l’outil depuis un hook, si bien qu’aucune commande destructrice ne s’exécute vraiment.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « l’avertissement n’apparaît qu’une fois la commande terminée » ou « l’animal reste au travail après qu’un autre mod a appelé un outil ».

### Comment l’auteur l’a demandé

La demande d’origine de ces réactions n’a pas été consignée. Elles sont arrivées le 2026-10-30, avant les journaux de tâches publics du projet (`odd/tasks/fleet-view.md` commence le 2026-11-06 et ne les mentionne pas).

#### Reconstitution à partir de l’historique des commits

À partir de `git log -- hooks/register.tsx hooks/words.ts hooks/watch.ts` dans narsil-pet :

- `c885292` (2026-10-30) « feat: estimate when the context fills, react to tests and dangerous commands, show subagents » (estimer quand le contexte se remplit, réagir aux tests et aux commandes dangereuses, afficher les sous-agents). Le motif des tests, la liste des commandes dangereuses et l’indicateur « rétablis » arrivent ensemble dans ce commit, à l’intérieur du hook `tool.call`.
- `8913cdd` (2026-10-30) « feat: let Narsil earn experience and levels kept across sessions » (permettre à Narsil de gagner de l’expérience et des niveaux conservés d’une session à l’autre). Les tests qui passent commencent à rapporter de l’expérience.
- `0cfc369` (2026-10-31) « refactor: move Narsil's wording and labels out of the hooks module » (sortir les textes et les libellés de Narsil du module des hooks). Les motifs passent dans `hooks/words.ts`, où ils se trouvent aujourd’hui.
- `21df208` (2026-11-06) « fix: ignore tool calls other mods make, so Narsil no longer sticks at working » (ignorer les appels d’outils faits par d’autres mods, pour que Narsil ne reste plus bloquée sur « en train de travailler »). Le filtre `isClaudesCall` décrit plus haut.

Les motifs eux-mêmes n’ont pas changé depuis leur écriture : `git log -S` ne les trouve que dans le premier commit et dans le déplacement.

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide. Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

Écrit pour ce guide et vérifié par rapport aux types 2.1.325 (`tool.call`, `next.origin`, `$.ui.log`, `ui.render`). Il est adapté de `hooks/register.tsx` et de `hooks/words.ts` dans [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). L’atome `line` est déclaré dans `types/index.d.ts` comme dans le premier guide, avec le type `string`.

```tsx
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const line = atom({ plugin: 'my-pet', key: 'line' } as const, '')

const TEST =
  /\b(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?test|vitest|jest|pytest|cargo\s+test|go\s+test)\b/
const DANGER: readonly (readonly [string, RegExp])[] = [
  ['rm -rf', /\brm\s+(?:-[a-zA-Z]*(?:[rR]f|f[rR])[a-zA-Z]*|-[rR]\s+-f|-f\s+-[rR])\b/],
  ['git push --force', /\bgit\s+push\b[^|;&\n]*\s(?:--force(?!-with-lease)|-f)\b/],
  ['git reset --hard', /\bgit\s+reset\s+--hard\b/],
]
let testsFailing = false

export const register: Register = (on) => {
  on('tool.call', async ($, e, next) => {
    if (next.origin.plugin !== 'engine') return next(e)
    if (e.tool !== 'Bash' && e.tool !== 'PowerShell') return next(e)
    const command = e.command

    const danger = DANGER.find(([, pattern]) => pattern.test(command))?.[0]
    if (danger) {
      $.ui.log(`⚠️ my-pet: ${danger} cannot be undone: ${command.split('\n')[0]!.slice(0, 120)}`)
      await update($, line, () => `⚠️ Careful: ${danger} cannot be undone.`)
    }

    // Warn only: the call always goes on to the engine.
    const result = await next(e)

    if (TEST.test(command)) {
      const text = result.isError
        ? 'The tests fail; let us see why.'
        : testsFailing
          ? 'Recovered! The tests pass again.'
          : 'The tests pass! 🎉'
      testsFailing = !!result.isError
      await update($, line, () => text)
    }
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const text = await read($, line)
    if (!text) return next(e)
    const { Text } = $.ui.resolve(e)
    return <Text wrap="truncate-end">{text}</Text>
  })
}
```

## Erreurs fréquentes et comment tester

- **Réagir aux appels des autres mods.** Le `$.tool.call` d’un autre mod déclenche aussi `tool.call`, et aucun tour ne le termine. Vérifiez `next.origin.plugin === 'engine'` (`21df208`).
- **Avertir après coup.** Un avertissement posé après `await next(e)` arrive une fois la commande exécutée. Posez-le avant.
- **Transformer l’avertissement en blocage.** Renvoyer `{ deny }` à partir d’une correspondance de motif arrête un travail légitime et incite le modèle à trouver un moyen de le contourner. Laissez la décision au système d’autorisations.
- **Trop se fier à l’indicateur d’erreur.** Une commande qui masque son propre code de sortie (en redirigeant l’exécution des tests vers un autre programme, ou en la terminant par une solution de repli qui réussit toujours) se lit comme une réussite. Narsil ne peut pas faire la différence, et votre copie non plus.
- **Tester avec de vraies commandes destructrices.** Ne les exécutez jamais pour voir l’avertissement. Dans un test, répondez à l’outil depuis un hook pour que rien ne s’exécute.

Pour tester, `claude plugin test .` exécute `tests/narsil.test.tsx`. « a dangerous command is flagged before it runs, and an ordinary one is not » (une commande dangereuse est signalée avant de s’exécuter, et une commande ordinaire ne l’est pas) répond à chaque `tool.call` depuis un hook avec `{ result: {} }`, si bien qu’aucune commande n’atteint un shell, et lit la ligne de commentaire envoyée à la fenêtre flottante au moment où chaque appel arrive. Il attend les quatre avertissements pour quatre commandes destructrices, et aucun avertissement pour un push ordinaire. « tests that pass are cheered, and failing ones are noticed until they pass again » (les tests qui passent sont acclamés, et ceux qui échouent sont remarqués jusqu’à ce qu’ils passent de nouveau) couvre l’acclamation, l’échec et le rétablissement.

## Pour aller plus loin

- `describeCall` dans `hooks/words.ts` construit le détail de la bande pour chaque outil (le nom d’un fichier, la première ligne d’une commande) ; les réactions réutilisent ce même détail.
- `gainXp($, 'tests')` ajoute les 5 points ; `hooks/xp.ts` contient les montants et les niveaux.
- Les échecs que ce hook enregistre (`seen.failures`) font partie de ce que les conseils du guide 11 envoient au modèle.
- `DANGEROUS_COMMANDS` est facile à étendre : un nom et un motif par ligne. Gardez chaque motif à l’intérieur d’une seule commande avec `[^|;&\n]`, comme le font les motifs existants.
