---
title: Les connecteurs
description: 'Comment Narsil Check liste les serveurs MCP de la session avec leur état et le nombre d’outils de chacun, demandés une fois au serveur de connecteurs de l’application de bureau.'
route: check
order: 4
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/session.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/session.test.tsx
---

## Ce que ça fait

La section **Conectores** (« connecteurs ») liste les serveurs MCP de la session, la même liste que celle de la barre de session de l’application de bureau. Elle répond à deux questions rapides : quels serveurs Claude peut-il utiliser maintenant, et lequel a besoin de vous ?

L’en-tête affiche `▸ Conectores · 2`, où le nombre compte les serveurs connectés. Dépliée, elle montre :

- **D’abord les serveurs connectés**, chacun avec un point vert et le nombre d’outils qu’il propose, comme `notes-server · 19 herramientas` (« 19 outils »).
- **Puis les autres**, chacun avec un point jaune et son état tel que l’application le signale, comme `Mail · needs_auth`.

Quand rien n’est connecté, elle dit « No hay conectores conectados. » (« aucun connecteur n’est connecté »). Quand la liste ne peut pas être lue, elle dit pourquoi en rouge : « No pude leer los conectores: … » (« je n’ai pas pu lire les connecteurs : … »).

Le point de la section résume le tout : vert quand chaque serveur fonctionne, jaune quand l’un d’eux demande une connexion ou a échoué, rouge quand la liste n’a pas pu être lue, gris avant la première lecture.

Chaque session commence avec cette section repliée ; le début de session la règle ainsi (`isConnectorsOpen` à `false`), quelle que soit la façon dont vous l’avez laissée.

## Comment ça marche à l’intérieur

### D’où vient la liste

La liste est un seul appel au propre serveur de connecteurs de l’application de bureau, fait dans `loadSession` dans `hooks/register.tsx`, à côté des lectures de session du guide précédent :

```tsx
const result = await $.mcp.call(CONNECTORS_SERVER, CONNECTORS_TOOL)
const list = result.isError
  ? undefined
  : parseConnectors(result.structuredContent ?? jsonOf(result.content))
connectors = list
  ? { connectors: list }
  : { connectors: [], connectorsError: textOf(result.content) || 'respuesta sin conectores' }
```

`CONNECTORS_SERVER` vaut `'ccd_connectors'` et `CONNECTORS_TOOL` vaut `'session_connectors_status'`, tous deux dans `hooks/session.ts`. L’appel ne prend aucun argument. Comme pour tout `$.mcp.call` (voir le guide précédent), la réponse est lue depuis `structuredContent` quand il existe, et sinon depuis le JSON des blocs de texte, et un échec est intercepté et gardé dans `connectorsError`.

`parseConnectors` transforme la réponse dans le type propre du mod, `Connector` dans `types/index.d.ts` : `{ name, status, tools? }`. Il lit un tableau `servers` ; écarte toute entrée sans `name` de type chaîne ; garde `status` comme texte, ou `'unknown'` quand il manque ; et garde `tool_count` comme `tools` seulement quand c’est un nombre. S’il n’y a aucun tableau `servers`, il renvoie `undefined`, que l’appelant transforme en erreur plutôt qu’en liste vide.

Cette distinction est délibérée : « aucun serveur n’est connecté » et « je n’ai pas pu lire les serveurs » sont des réponses différentes, et la section les affiche différemment.

### Ce qu’elle montre, et ce qu’elle ne montre pas

La section montre le nom, l’état et le nombre d’outils de chaque serveur. Elle ne liste pas les noms des outils. Le README décrit la même chose : les serveurs connectés « con cuántas herramientas tiene cada uno » (« avec le nombre d’outils de chacun »), puis les autres avec leur état.

Les champs qu’elle lit (`servers`, `name`, `status`, `tool_count`) sont la réponse du serveur de l’application de bureau, et ne font pas partie de l’API des mods, si bien que les types 2.1.325 ne les documentent pas. La fixture de `tests/session.test.tsx` montre la forme avec laquelle l’auteur ou l’autrice a travaillé, avec un champ `kind` que le mod ignore. L’analyseur accepte ce qu’il ne connaît pas : un état autre que `connected` est affiché tel qu’il est arrivé, et le point jaune d’une ligne signifie seulement « non connecté ».

Les mots sont des fonctions pures dans `hooks/session.ts`, si bien qu’ils peuvent être testés seuls :

- `connected(view)` filtre les serveurs dont l’état est `connected`.
- `connectorsLabel(isOpen, view)` dessine l’en-tête, avec le compte seulement quand il est supérieur à zéro.
- `connectorLine(c)` dessine une ligne : le nom, puis le nombre d’outils pour un serveur connecté, sinon l’état.
- `toolsLabel(n)` dit `1 herramienta` ou `N herramientas`.
- `connectorsColor(view)` choisit le point, en vérifiant d’abord l’erreur, puis si la liste a été lue, puis si un serveur est `needs_auth` ou `failed`.

### Quand elle est relue

Les connecteurs sont lus dans le même `loadSession` que le reste de la session, si bien qu’ils suivent le même calendrier prudent : une fois dix secondes après le début de la session, une fois de plus au premier tour si cela a échoué, et après un tour seulement quand le tour a utilisé un outil qui change la réponse des serveurs. Pour les connecteurs, cela signifie n’importe quel outil `mcp__ccd_connectors__`, qui fait partie de `SESSION_TOOLS`. Ouvrir le repli relit tout, si bien que déplier la section est la façon de l’actualiser à la main.

La raison est la même que pour l’environnement : chaque appel aux serveurs de l’application est vu par tous les autres mods comme un appel d’outil, et un appel trop précoce peut amener l’application de bureau à demander une autorisation.

### Pourquoi un serveur du bureau, et pas le moteur

Les types 2.1.325 donnent au mod deux appels sur `$.mcp` : `call`, pour appeler l’outil d’un serveur connecté, et `connect`, pour faire entrer dans la session un serveur tenu en réserve. Aucun des deux ne liste les serveurs avec leurs états. L’application de bureau a un outil qui le fait, alors Narsil Check l’interroge.

Le prix à payer, c’est la surface. En dehors de l’application de bureau, il n’y a pas de `ccd_connectors`, l’appel échoue, et la section le dit. Le tableau des surfaces du README l’indique : Conectores fonctionne dans l’application de bureau, et ailleurs « la sección dice por qué no pudo leerlos » (« la section dit pourquoi elle n’a pas pu les lire »).

### À quoi sert la section

Les commits montrent que la finalité de la section a changé une fois. Dans `2bd1919`, un clic sur n’importe quelle ligne de connecteur ouvrait `/mcp`, la liste de serveurs du moteur lui-même. Un commit plus tard, `c07f5e9` a rendu les lignes de nouveau simples, et son message dit pourquoi : « /mcp from a mod only prints a summary in the desktop app » (/mcp depuis un mod n’affiche qu’un résumé dans l’application de bureau). La section sert donc à lire d’un coup d’œil, et l’endroit où se connecter ou réparer un serveur reste celui de l’application.

## Le construire avec Claude

Demandez à Claude une section qui liste les serveurs MCP de la session et leur état. L’idée que Claude doit bien saisir : « aucun serveur n’est connecté » et « je n’ai pas pu lire les serveurs » sont deux réponses différentes, et la section les montre différemment.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon mod Claude Code `my-panel`, ajoute une section « Connectors » au panneau. Dans l’application de bureau, lis une fois les serveurs MCP de la session avec `$.mcp.call('ccd_connectors', 'session_connectors_status')`, en préférant `structuredContent` et en te rabattant sur le JSON du contenu textuel. Analyse un tableau `servers` en `{ name, status, tools }` à partir de `name`, `status` et `tool_count`, en écartant les entrées sans nom, et traite un tableau manquant comme une erreur, pas comme une liste vide. Affiche d’abord les serveurs connectés avec un point vert et leur nombre d’outils, puis les autres avec un point jaune et leur état. Colore le point de la section en rouge quand la lecture a échoué, en gris avant, en jaune quand un serveur est `needs_auth` ou `failed`, et en vert sinon. Ne relis que quand le repli s’ouvre. Teste l’analyseur et les couleurs comme des fonctions pures.

### Ce qu’il faut vérifier dans la réponse de Claude

1. La liste vient d’un seul `$.mcp.call('ccd_connectors', 'session_connectors_status')`, lu d’abord dans `structuredContent` et sinon dans le JSON du contenu texte.
2. L’analyseur écarte les entrées sans `name` de type chaîne, garde un `status` inconnu sous forme de texte, et renvoie `undefined`, pas une liste vide, quand il n’y a pas de tableau `servers`.
3. Le point de la section est rouge quand la lecture a échoué, gris avant la première lecture, jaune quand un serveur est `needs_auth` ou `failed`, et vert sinon.
4. Les serveurs connectés viennent d’abord, avec un point vert et leur nombre d’outils, puis les autres, avec un point jaune et leur état.
5. La liste n’est pas relue sur une minuterie. Ouvrir le repli la relit.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « hors de l’application de bureau, la section dit qu’aucun connecteur n’est connecté, au lieu de dire pourquoi elle n’a pas pu les lire ».

### Comment l’auteur l’a demandé

La demande d’origine pour la section des connecteurs n’a pas été consignée. Aucun des journaux de tâches publics de narsil-check (`odd/tasks/*.md`) ne la couvre.

#### Reconstitution à partir de l’historique des commits

À partir de `git log -- hooks/session.ts`, avec les commits liés de `hooks/register.tsx` :

- `be8eac0` (2026-11-05) « feat: show the session bar's environment, connectors and Remote Control in the pane » (afficher dans le panneau l’environnement, les connecteurs et le Remote Control de la barre de session). Les connecteurs arrivent avec l’environnement, dans le cadre du remplacement de la barre de session de l’application.
- `2bd1919` (2026-11-05) « feat: repository link, Remote Control switch in Entorno and /mcp from connectors » (lien vers le dépôt, interrupteur Remote Control dans Entorno et /mcp depuis les connecteurs). Son message : « Any connector row opens /mcp. » (toute ligne de connecteur ouvre /mcp).
- `c07f5e9` (2026-11-05) « feat: Entorno starts open, other sections fold until they have something » (Entorno commence ouverte, les autres sections restent repliées jusqu’à avoir quelque chose). Conectores commence repliée, et les lignes redeviennent simples.
- `55fe118` (2026-11-06) et `4770a49` (2026-11-06), les deux correctifs qui ont rendu plus rare chaque lecture des serveurs de l’application, traités dans le guide précédent. Ils s’appliquent aux connecteurs parce que ceux-ci sont lus dans le même appel.

Le schéma : une fonctionnalité ajoutée avec le reste de la barre de session, un clic qui s’est révélé inutile dans l’application de bureau et a été retiré, et la règle d’interroger rarement, héritée de l’environnement.

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide. Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

Voici une version réduite de l’idée, écrite pour ce guide et vérifiée par rapport aux types de Claude Code 2.1.325. Elle est adaptée de `hooks/session.ts` et de `hooks/register.tsx` dans [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later).

La partie pure, `hooks/connectors.ts` :

```ts
export type Connector = { name: string; status: string; tools?: number }

export function parseConnectors(value: unknown): Connector[] | undefined {
  const servers = (value as { servers?: unknown } | undefined)?.servers
  if (!Array.isArray(servers)) return undefined
  return servers
    .filter(
      (s): s is Record<string, unknown> =>
        typeof s === 'object' && s !== null && typeof s.name === 'string',
    )
    .map((s) => ({
      name: s.name as string,
      status: typeof s.status === 'string' ? s.status : 'unknown',
      ...(typeof s.tool_count === 'number' ? { tools: s.tool_count } : {}),
    }))
}

export function connectorLine(c: Connector): string {
  if (c.status !== 'connected') return `${c.name} · ${c.status}`
  return c.tools === undefined ? c.name : `${c.name} · ${c.tools} tools`
}
```

L’appel, dans `hooks/register.tsx`, qui renvoie soit la liste, soit la raison pour laquelle elle n’a pas pu être lue :

```tsx
import type { EngineInterface } from 'claude-code'
import { parseConnectors, type Connector } from './connectors'

async function readConnectors($: EngineInterface): Promise<{ list: Connector[]; error?: string }> {
  try {
    const result = await $.mcp.call('ccd_connectors', 'session_connectors_status')
    const list = result.isError ? undefined : parseConnectors(result.structuredContent)
    return list ? { list } : { list: [], error: 'no list in the answer' }
  } catch (err) {
    return { list: [], error: err instanceof Error ? err.message : String(err) }
  }
}
```

Gardez le résultat dans un atome et dessinez-le dans le hook `ui.render` du panneau comme dans le premier guide : les lignes connectées d’abord, puis le reste, chacune avec `connectorLine`. Cette version minimale ne lit que `structuredContent` ; Narsil Check analyse aussi le JSON des blocs de texte (`jsonOf` dans `hooks/session.ts`), au cas où le serveur ne répondrait qu’avec du texte.

## Erreurs fréquentes et comment tester

Elles viennent du code et des commits de Narsil Check :

- **Traiter une lecture échouée comme « aucun serveur ».** Renvoyez `undefined` depuis l’analyseur quand la forme est mauvaise, et affichez l’erreur. « Aucun connecteur » est une vraie réponse qui ne doit venir que d’une vraie liste.
- **Se fier à la forme de la réponse de l’application.** Ces champs appartiennent à l’application de bureau, pas à l’API des mods. Vérifiez le type de chaque champ, comme le fait `parseConnectors`, et affichez un état inconnu comme du texte.
- **Actualiser avec un minuteur.** Chaque appel est un appel d’outil que les autres mods voient. Lisez sur des événements : le démarrage, un tour qui a touché aux connecteurs, l’ouverture du repli.
- **Lier les lignes à `/mcp`.** Narsil Check l’a essayé et l’a retiré (`c07f5e9`) : depuis un mod, dans l’application de bureau, cela n’affiche qu’un résumé.
- **S’attendre à l’avoir sur chaque surface.** `ccd_connectors` appartient à l’application de bureau ; ailleurs, la section ne peut que dire pourquoi elle est vide.

Pour tester, les analyseurs et les libellés sont purs : `tests/session.test.tsx` les vérifie directement dans « the session section reads the app servers and names what it found » (la section de session lit les serveurs de l’application et nomme ce qu’elle a trouvé). Pour la section elle-même, répondez au serveur avec un hook comme `on('mcp.call', (_, e) => e.server === 'ccd_connectors' ? { value: { content: [{ type: 'text', text: JSON.stringify({ servers: [...] }) }], isError: false } } : ...)`, montez le panneau, appuyez sur `section-connectors` et cherchez les lignes. Utilisez des noms de serveurs synthétiques dans les fixtures, comme `notes-server` et `Mail`.

## Pour aller plus loin

- La section va de pair avec l’environnement du guide précédent : les deux sont lus dans un seul `loadSession`, si bien qu’un seul calendrier régit chaque appel aux serveurs de l’application.
- Les types offrent une autre source qui fonctionne sur toutes les surfaces : `$.tool.list()` renvoie les outils que le modèle peut appeler maintenant, chacun avec `name`, `description` et `mcp: true` pour l’outil d’un serveur MCP. Regrouper les noms `mcp__server__tool` par serveur donne les serveurs connectés et leurs outils, par leur nom. Cela ne dit pas quels serveurs attendent une connexion ou ont échoué, ce à quoi servent ici les lignes jaunes. C’est un vrai compromis, et narsil-check a choisi le serveur du bureau.
- `$.mcp.connect(server)` peut faire entrer un serveur que la session a tenu en réserve, ce qui est l’étape qui suit le constat qu’un serveur n’est pas connecté. Narsil Check ne l’utilise pas.
