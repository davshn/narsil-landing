---
title: Le panneau latéral
description: 'Comment Narsil Check dessine un panneau à côté du chat avec des sections repliables, un point coloré par section, des replis mémorisés et des lignes copiées d’un clic.'
route: check
order: 1
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/words.ts
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: hooks/explain.ts
  - repo: check
    path: hooks/osv.ts
  - repo: check
    path: tests/pane.test.tsx
  - repo: check
    path: odd/tasks/vulnerabilities.md
  - repo: check
    path: odd/tasks/ecosystems-wave-2.md
---

## Ce que ça fait

Narsil Check est un panneau qui se place à côté du chat, intitulé **● Narsil Check**. C’est le compagnon de Narsil, la mascotte d’état du premier parcours, et il parle avec ses couleurs. Là où Narsil répond à « dois-je faire quelque chose maintenant ? », le panneau répond à « comment va ce projet ? ».

Le panneau est une colonne de sections, une par vérification : **Entorno** (l’environnement de la session), **Conectores** (les connecteurs), **Actualizaciones** (les mises à jour), **Vulnerabilidades** (les vulnérabilités) et **Pendientes** (une liste de tâches par projet). Les libellés sont en espagnol, comme dans Narsil.

Chaque section a un en-tête en trois parties :

- **Un point coloré** qui indique la chose la plus urgente dans la section, si bien que vous pouvez lire le panneau replié.
- **Une flèche** : `▾` quand la section est ouverte, `▸` quand elle est repliée. Un clic sur l’en-tête la replie ou la déplie.
- **Un nom et un compte**, comme `▾ Actualizaciones · 3` ou `▸ Vulnerabilidades · 2`.

Dans **Actualizaciones** et **Vulnerabilidades**, chaque groupe (mises à jour bloquées, versions majeures, avis critiques, etc.) se replie aussi sur son propre en-tête, et le panneau se souvient de ceux que vous avez fermés. Un clic sur une bibliothèque ou un avis le copie dans le presse-papiers, avec un court message qui dit si cela a fonctionné.

L’intérêt, c’est un seul endroit où regarder. Le README dit qu’avec le panneau ouvert, vous pouvez masquer la barre de session de l’application de bureau et ne garder qu’un seul panneau.

## Comment ça marche à l’intérieur

### Un panneau, on l’ouvre puis on le dessine

Un mod n’obtient pas un panneau en le déclarant. Il en demande un avec `$.ui.open`, puis il dessine le contenu du panneau dans un hook `ui.render` pour le composant `Pane`. Ce sont deux étapes distinctes, et les deux se trouvent dans `hooks/register.tsx`.

L’ouverture se fait dans le hook `session.start` :

```tsx
// Opens on every session: it stands in for the app's session bar.
await $.ui.open({ id: PANE, title: TITLE }).catch(() => undefined)
```

`PANE` vaut `'narsil-check'` et `TITLE` vaut `'Narsil Check'`, tous deux dans `hooks/words.ts`. L’id nomme le panneau ; ouvrir un id déjà ouvert ne fait que changer son titre, d’après les types 2.1.325.

Le dessin est un hook filtré sur cet id :

```tsx
on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
  const { Box, Text, Button, Link } = $.ui.resolve(e)
  // ...reads the atoms and returns the tree
})
```

`$.ui.resolve(e)` donne les éléments que cette surface peut dessiner. Le hook vérifie ce qu’il a reçu : `Svg` n’existe qu’en dehors du terminal (bébé Narsil n’est donc dessinée que là), et l’application mobile ne reçoit pas d’`Input` (les tâches s’y ajoutent donc en le demandant à Claude). Il lit aussi `e.surface` pour décider s’il teinte les en-têtes de groupe : le terminal garde les bordures et ne dessine aucune teinte.

### Ce que signifie `isPlaced`

`$.ui.open` résout un résultat, `UiOpenResult` dans les types. `{ isPlaced: true }` signifie que le panneau est ouvert et dessiné, et le premier `ui.render` pour `{ component: "Pane", requestId: id }` suit. `{ isPlaced: false, reason }` signifie que le panneau est ouvert mais pas encore dessiné.

Les types donnent la règle : un panneau ouvert en réponse à la personne (une commande, un prompt, un appui) est placé à n’importe quelle largeur. Un panneau que le mod ouvre de lui-même attend sans être dessiné en dessous de 144 colonnes de terminal, ou 110 une fois que la personne a demandé cet id. Un panneau qu’un autre plugin détient est refusé, et l’appel est rejeté.

Narsil Check ouvre son panneau de lui-même à chaque début de session, donc sur un terminal étroit il peut attendre sans être dessiné. Le code ne lit pas `isPlaced` ; il ne fait qu’intercepter le rejet pour qu’un panneau refusé ne casse pas le début de session. Les tests répondent à l’événement `ui.open` avec `{ value: { isPlaced: true } }`, comme s’il était toujours dessiné. Quand la personne tape `/narsil-check upgrade` ou `/narsil-check vulns`, la commande appelle de nouveau `$.ui.open`, et comme cette ouverture répond à la personne, le panneau est placé à n’importe quelle largeur. Le README décrit `/narsil-check upgrade` comme le moyen de rouvrir le panneau après l’avoir fermé.

### Les couleurs du point

Les couleurs sont une seule table, `PALETTE` dans `hooks/words.ts`, avec les mêmes valeurs que les états de Narsil. Son commentaire en donne le sens : « blue for what is running or informs, gray for what rests, yellow for what waits on you, green for what is done, red for what failed or blocks » (bleu pour ce qui tourne ou informe, gris pour ce qui se repose, jaune pour ce qui vous attend, vert pour ce qui est fait, rouge pour ce qui a échoué ou bloque).

| Couleur | Valeur    | Sens dans le code                                         |
| ------- | --------- | --------------------------------------------------------- |
| Rouge   | `#F0435A` | Quelque chose a échoué ou bloque.                         |
| Jaune   | `#F5B400` | Quelque chose vous attend.                                |
| Vert    | `#22B573` | Fait, à jour, rien à faire.                               |
| Bleu    | `#3B8BFF` | Information, ou quelque chose qui tourne.                 |
| Gris    | `#8A90A6` | Au repos : pas encore lu, ou ne méritant pas l’attention. |

Chaque section choisit son point avec une petite fonction pure qui vérifie d’abord le cas le plus urgent :

- **Actualizaciones**, `sectionColor` : rouge si l’analyse a échoué ou si une mise à jour est bloquée, jaune si une version majeure demande un examen, bleu si une version est hors du SDK Expo, vert sinon, gris tant que l’analyse n’est pas terminée.
- **Vulnerabilidades**, `vulnsColor` : rouge pour une vérification échouée, gris avant qu’elle se termine, vert s’il n’y en a aucune, sinon la couleur de la pire gravité (`SEVERITY_COLOR` : rouge pour critique et élevée, jaune pour modérée, gris pour faible ou non évaluée).
- **Conectores**, `connectorsColor` dans `hooks/session.ts` : rouge quand ils n’ont pas pu être lus, gris avant le chargement, jaune quand l’un d’eux demande une connexion ou a échoué, vert quand tous fonctionnent.
- **Entorno** : bleu une fois la session lue, gris avant.

Depuis le commit `6291eaf`, la même couleur dessine aussi la bordure arrondie de la section (`borderStyle: 'round'`, `borderColor`), et sur les surfaces autres que le terminal, un en-tête de groupe est teinté de sa couleur avec un alpha faible (`${tone}1F`), ce qui, selon le commentaire, fonctionne aussi bien sur des panneaux clairs que sombres.

La raison d’une fonction par section, au lieu d’une couleur stockée à côté des données, est que la couleur ne peut jamais contredire le contenu : elle est calculée à partir de celui-ci à chaque dessin.

### Les replis : un atome par repli, ou une liste de clés fermées

Chaque repli est un état, gardé dans un atome (`atom` de `claude-code`). Il y a deux formes :

- **Une section** a son propre atome booléen : `isEnvOpen`, `isConnectorsOpen`, `isUpgradeOpen`, `isVulnsOpen`, `isTodosOpen`, `isCiOpen`. Le `Button` de l’en-tête l’inverse avec `update($, isUpgradeOpen, value => !value)`.
- **Un groupe dans une section** va dans une seule liste, `closedGroups`, des clés repliées (comme `upgrade-blocked` ou `vulns-high`). `toggleGroup` ajoute la clé si elle manque et la retire si elle y est. Chaque groupe commence ouvert, puisqu’une liste vide signifie que rien n’est fermé.

Le hook de rendu lit ces atomes avec `read`, et une lecture pendant un dessin l’y abonne : quand un appui appelle `update`, le panneau se redessine sans appel supplémentaire.

### Ce dont il se souvient, et où

C’est ici que le code, ses commentaires et les types demandent une lecture attentive.

À chaque `session.start`, le hook met les sections à des valeurs fixes : Entorno ouverte ; Conectores, Actualizaciones et Vulnerabilidades repliées ; et Pendientes ouverte seulement quand elle contient des tâches. Actualizaciones et Vulnerabilidades se déplient d’elles-mêmes quand elles trouvent quelque chose. Le commit qui a introduit ce comportement, `c07f5e9`, dit « Fold state is no longer kept across sessions. » (l’état des replis n’est plus conservé d’une session à l’autre).

Les groupes (`closedGroups`) et le repli du CI (`isCiOpen`) ne sont pas réinitialisés au début de la session. Les commentaires du code disent qu’ils gardent la façon dont vous les avez laissés « across sessions » (d’une session à l’autre), et le README dit que le panneau « recuerda cuáles cerraste » (« se souvient de ceux que vous avez fermés »).

Ce sont tous des atomes, et les atomes passent par `$.state`. Les types 2.1.325 décrivent `$.state` comme des « Named values held by the host for the session » (valeurs nommées détenues par l’hôte pour la session) qui survivent à un rechargement à chaud du code du plugin, et ils ajoutent « Persist through `$.store`. » (persistez via `$.store`). Un commentaire dans `hooks/register.tsx` note qu’un `/clear` garde le module chargé sous une nouvelle session, ce qui est un cas où un atome survit à une session. Si vous avez besoin qu’un repli survive à un redémarrage de Claude Code, les types renvoient à `$.store`, pas à un atome.

Les atomes sont créés avec une option `shape` (`{ shape: 'closed-1' }`). Les types l’expliquent : la valeur est conservée sous cette étiquette, et une version plus récente du code qui nomme une autre étiquette trouve la valeur absente. Le commentaire au-dessus des atomes dit de changer l’étiquette « when its type's fields change » (quand les champs de son type changent), pour qu’une ancienne valeur stockée n’atteigne jamais un code qui attend de nouveaux champs.

### Copier dans le presse-papiers

Chaque ligne de bibliothèque et chaque ligne d’avis est un `Button` `plain`. Son appui appelle `copyRow` :

```tsx
async function copyRow($: EngineInterface, text: string, surface: Surface): Promise<void> {
  const copied = await $.ui.copy({ text, surface })
  $.ui.toast(copied.isCopied ? 'Copiado al portapapeles.' : `No pude copiar: ${copied.reason}`)
}
```

La surface vient de l’appui : `onPress={press => copyRow($, copy, press.surface)}`. Ce détail compte. Les types disent que `$.ui.copy` met le texte « on the clipboard of a surface the session draws on » (dans le presse-papiers d’une surface sur laquelle la session dessine), et qu’un hook d’appui passe `e.surface` pour indiquer laquelle ; sans elle, c’est la première surface de la session. Une personne qui clique dans l’application de bureau veut le texte dans le presse-papiers du bureau, pas sur un terminal rattaché à la même session.

Le résultat dit si la copie a pris : `{ isCopied: true }`, ou `{ isCopied: false, reason }` avec une raison issue d’un ensemble fermé (`no-surface`, `no-clipboard`, `refused`). Le toast signale les deux cas, si bien qu’une copie échouée ne ressemble jamais à une copie réussie.

Ce qui est copié est plus que le libellé de la ligne. Deux fonctions pures construisent le texte : `upgradeCopyText` dans `hooks/explain.ts` (une mise à jour avec son saut et ce qui la bloque, ou la raison donnée par Haiku) et `vulnCopyText` dans `hooks/osv.ts` (un avis avec sa gravité, le correctif et le lien vers OSV).

### Pourquoi les mots vivent dans `hooks/words.ts`

Comme dans Narsil, le module de hooks décide de ce qui s’est passé et `hooks/words.ts` décide de la façon de le dire : la palette, les libellés et indications des groupes (`GROUPS`), les libellés des en-têtes (`sectionLabel`, `vulnsLabel`, `groupLabel`) et les couleurs. Ce sont des fonctions pures, c’est pourquoi `tests/pane.test.tsx` peut les vérifier sans rien monter, comme dans « the section is colored by what most needs you, and its toggle names it » (la section est colorée selon ce qui a le plus besoin de vous, et son bouton de repli la nomme).

## Comment on l’a demandé à l’IA

La demande d’origine pour le panneau n’a pas été consignée. Deux journaux de tâches publics de narsil-check citent les mots de l’auteur ou de l’autrice sur certaines de ses parties.

### Consigné : la copie, et une section repliable

`odd/tasks/vulnerabilities.md` consigne, dans son entrée de journal L1 (2026-11-05), les deux messages qui ont lancé la section des vulnérabilités. S1 cite le premier :

> "podemos checkear vulnerabilidades de la misma forma? es decir crear un sub menu de vulnerabilidades que haga pnpm audit o similar?"

Traduction en français : pouvons-nous vérifier les vulnérabilités de la même façon, c’est-à-dire créer un sous-menu de vulnérabilités qui exécute pnpm audit ou quelque chose de similaire ?

Le journal de tâches consigne ensuite la proposition que l’auteur ou l’autrice a acceptée avec « si » (« oui ») : entre autres choses, « a collapsible section "▾ Vulnerabilidades · N" under Actualizaciones, its dot red for critical or high, yellow for moderate, green for none » (une section repliable « ▾ Vulnerabilidades · N » sous Actualizaciones, avec son point rouge pour critique ou élevée, jaune pour modérée, vert s’il n’y en a aucune). Cette conception est la proposition de l’agent, écrite dans le journal de tâches ; les mots de l’auteur ou de l’autrice sont la question et le « si ».

S2 cite le second message :

> "solo agregar que me gustaria la opcion de copiar las vulnerabilidades por criticidad al porta papeles, como esta en el upgrade"

Traduction en français : seulement ajouter que j’aimerais l’option de copier les vulnérabilités par criticité dans le presse-papiers, comme c’est le cas dans la section des mises à jour.

### Consigné : quand le panneau doit s’ouvrir

`odd/tasks/ecosystems-wave-2.md` (son journal commence le 2026-11-04) énumère dans S3 le comportement qui devait être conservé, y compris une règle antérieure citée avec les mots de l’auteur ou de l’autrice :

> "el panel solo deberia abrirse automaticamente cuando haya versiones por actualizar, ya de resto que deba abrirse con /upgrades"

Traduction en français : le panneau ne devrait s’ouvrir automatiquement que lorsqu’il y a des versions à mettre à jour ; sinon, il devrait s’ouvrir avec /upgrades.

Cette règle n’a pas duré. `/upgrades` est devenu `/narsil-check upgrade` dans `684837f`, et depuis `be8eac0` le panneau s’ouvre à chaque session, parce qu’il a repris le rôle de la barre de session de l’application (voir plus bas).

### Reconstitution à partir de l’historique des commits

À partir de `git log -- hooks/register.tsx hooks/words.ts` dans narsil-check :

- `1bf736a` (2026-11-04) « feat: add upgrade panel for npm and Expo projects » (ajouter un panneau de mises à jour pour les projets npm et Expo). Le panneau commence comme une liste de mises à jour.
- `684837f` (2026-11-04) « feat!: rename to narsil-check, with /narsil-check upgrade and Narsil's look » (renommer en narsil-check, avec /narsil-check upgrade et l’apparence de Narsil). Son message : le panneau utilise la palette et les en-têtes de Narsil (« a colored dot and a bold name », un point coloré et un nom en gras), et la section des mises à jour se replie depuis son en-tête.
- `912478b` (2026-11-04) « feat: check known vulnerabilities with OSV.dev in a collapsible section » (vérifier les vulnérabilités connues avec OSV.dev dans une section repliable).
- `be8eac0` (2026-11-05) « feat: show the session bar's environment, connectors and Remote Control in the pane » (afficher dans le panneau l’environnement, les connecteurs et le Remote Control de la barre de session). Son message : « The pane opens on every session » (le panneau s’ouvre à chaque session).
- `c07f5e9` (2026-11-05) « feat: Entorno starts open, other sections fold until they have something » (Entorno commence ouverte, les autres sections restent repliées jusqu’à avoir quelque chose). Les replis de départ fixes.
- `b3ad055` (2026-11-06) « feat: fold upgrade and vulnerability groups, copy a row on click, show baby Narsil and pull the branch » (replier les groupes de mises à jour et de vulnérabilités, copier une ligne au clic, afficher bébé Narsil et tirer la branche). Son message : chaque groupe « folds on its own header and stays as left » (se replie sur son propre en-tête et reste tel qu’on l’a laissé), et « A press on a library or an advisory copies it, replacing the per-group copy buttons » (un appui sur une bibliothèque ou un avis le copie, en remplaçant les boutons de copie par groupe).
- `d5b08c3` (2026-11-06) « feat: center the pane's title and baby Narsil » (centrer le titre du panneau et bébé Narsil).
- `6291eaf` (2026-11-06) « feat: give the pane a health bar, state-colored panels and tinted group heads » (donner au panneau une barre de santé, des panneaux colorés selon l’état et des en-têtes de groupe teintés).

Le schéma : d’abord une liste de mises à jour, puis l’apparence de Narsil, puis une section par vérification, chaque fois avec le même en-tête (point, flèche, nom, compte), et la copie qui passe d’un bouton par groupe à un clic sur la ligne elle-même.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Construis un mod Claude Code appelé `my-panel` avec un panneau latéral. Dans `session.start`, appelle `$.ui.open({ id: 'my-panel', title: 'My panel' })` et intercepte un rejet. Dessine-le dans `ui.render` pour `{ component: 'Pane', requestId: 'my-panel' }` avec `$.ui.resolve(e)`. Affiche deux sections, chacune dans une boîte avec une bordure arrondie de sa couleur, et un en-tête avec un point coloré (rouge pour échoué, jaune pour en attente de moi, vert pour fait, bleu pour information, gris avant le chargement) et un `Button` `plain` intitulé `▾ Name` ou `▸ Name` qui la replie. Garde les clés des sections repliées dans un atome déclaré dans `types/index.d.ts`. Fais de chaque ligne un `Button` `plain` qui copie son texte avec `$.ui.copy({ text, surface: press.surface })` et affiche un toast qui dit si `isCopied` valait true. Vérifie chaque API par rapport aux types de plugin-authoring et ajoute un test avec `claude-code/testing` montrant qu’un appui sur un en-tête masque ses lignes.

## Le code minimal

Voici une version réduite de l’idée, écrite pour ce guide et vérifiée par rapport aux types de Claude Code 2.1.325. Elle est adaptée de `hooks/register.tsx` et de `hooks/words.ts` dans [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later) ; les couleurs sont sa `PALETTE`, et les lignes sont synthétiques.

Le type de l’état, dans `types/index.d.ts` :

```ts
declare module 'claude-code' {
  interface PluginState {
    'my-panel': { closed: string[] }
  }
}
export {}
```

Le module de hooks, `hooks/register.tsx` :

```tsx
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const PANE = 'my-panel'
const COLOR = { error: '#F0435A', waiting: '#F5B400', done: '#22B573', info: '#3B8BFF' } as const

const SECTIONS = [
  {
    key: 'checks',
    title: 'Checks',
    color: COLOR.waiting,
    rows: ['lint · 2 warnings', 'build · ok'],
  },
  { key: 'notes', title: 'Notes', color: COLOR.info, rows: ['Release acme/shop on Friday'] },
]

const closed = atom({ plugin: 'my-panel', key: 'closed' } as const, [] as string[])

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.ui.open({ id: PANE, title: 'My panel' }).catch(() => undefined)
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const shut = new Set(await read($, closed))
    const toggle = (key: string) =>
      update($, closed, (keys) =>
        keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key],
      )
    const copy = async (text: string, surface: Parameters<typeof $.ui.copy>[0]['surface']) => {
      const copied = await $.ui.copy({ text, surface })
      $.ui.toast(copied.isCopied ? 'Copied.' : `Could not copy: ${copied.reason}`)
    }

    return (
      <Box flexDirection="column">
        {SECTIONS.map((s) => (
          <Box
            key={s.key}
            flexDirection="column"
            borderStyle="round"
            borderColor={s.color}
            paddingX={1}
            marginTop={1}
          >
            <Box flexDirection="row" gap={1}>
              <Text bold color={s.color}>
                ●
              </Text>
              <Button
                key={`section-${s.key}`}
                plain
                label={`${shut.has(s.key) ? '▸' : '▾'} ${s.title}`}
                onPress={() => toggle(s.key)}
              />
            </Box>
            {!shut.has(s.key) &&
              s.rows.map((row, i) => (
                <Button
                  key={`row-${s.key}-${i}`}
                  plain
                  label={row}
                  onPress={(press) => copy(row, press.surface)}
                />
              ))}
          </Box>
        ))}
      </Box>
    )
  })
}
```

Trois détails portent la conception. Le panneau est ouvert une fois et dessiné par un hook filtré sur son propre `requestId`, si bien qu’il ne dessine jamais le panneau d’un autre plugin. Le repli vit dans un atome que lit le hook de rendu, si bien qu’un appui n’a qu’à faire un `update`. Et la copie prend la `surface` de l’appui, si bien que le texte arrive là où la personne a cliqué.

## Erreurs fréquentes et comment tester

Elles viennent du code et des commits de Narsil Check :

- **Supposer que le panneau est dessiné parce que `open` a été résolu.** Sur un terminal étroit, une ouverture non demandée résout `{ isPlaced: false, reason }` et attend. Si quelque chose dépend de la visibilité du panneau, lisez `isPlaced` ; une commande que tape la personne l’ouvre à n’importe quelle largeur.
- **Laisser une ouverture refusée casser le démarrage.** Un autre plugin peut détenir l’id, et l’appel est rejeté. Narsil Check termine l’appel par `.catch(() => undefined)`.
- **Copier vers la mauvaise surface.** Omettre `surface` copie vers la première surface de la session. Passez `press.surface` depuis le bouton.
- **Se fier aveuglément à `isCopied` sur un terminal.** Les types notent qu’OSC 52 ne renvoie pas de réponse : un terminal qui l’ignore, sans outil de presse-papiers sur la machine, renvoie quand même true.
- **Stocker une valeur dont les champs ont changé sous la même étiquette.** Changez la `shape` de l’atome quand son type change, comme le dit le commentaire au-dessus des atomes de Narsil Check.
- **S’attendre à ce qu’un atome survive à un redémarrage.** Les types gardent `$.state` pour la session et renvoient à `$.store` pour la persistance.
- **Dessiner des teintes sur le terminal.** Narsil Check ne teinte les en-têtes de groupe que lorsque `e.surface !== 'terminal'` ; le terminal garde les bordures.

Pour tester, `claude plugin test .` exécute les fichiers `*.test.tsx` du mod. `tests/pane.test.tsx` dans narsil-check est un bon modèle : il répond à `ui.open` avec `{ value: { isPlaced: true } }`, monte le panneau avec `$.ui.mount({ plugin, component: 'Pane', requestId, props, surface })`, appuie sur les en-têtes par clé (`ui.press({ key: 'section-upgrade' })`) et cherche des textes avec `find`. Parmi les tests à copier par leur nom : « the section is colored by what most needs you, and its toggle names it » (la section est colorée selon ce qui a le plus besoin de vous, et son bouton de repli la nomme), « baby Narsil stands under the title, light or dark as the app is; the terminal draws no picture » (bébé Narsil se tient sous le titre, claire ou sombre comme l’application ; le terminal ne dessine aucune image) et « each section is a panel bordered in the color of its state; the desktop tints group heads and counts, the terminal keeps borders alone » (chaque section est un panneau bordé de la couleur de son état ; le bureau teinte les en-têtes de groupe et les comptes, le terminal ne garde que les bordures).

## Pour aller plus loin

Le panneau complet de narsil-check ajoute beaucoup de choses autour du même cadre :

- Une barre de santé sous le titre (`healthOf` et `healthSvg` dans `hooks/words.ts`) qui répartit l’état du projet en parts, une par couleur.
- Bébé Narsil dessinée comme un seul SVG contenant une image claire et une image sombre, alternées par une media query `prefers-color-scheme` à l’intérieur du SVG (`narsilSvg`), si bien que l’image suit le thème de l’application sans aucune intervention du moteur.
- Les sections de session (les deux guides suivants) et le repli du CI de votre pull request (le quatrième).
- **Actualizar rama** (« mettre à jour la branche ») en bas, un `git pull -r` que le mod exécute lui-même, et un grand avertissement en haut quand la branche est en retard sur son dépôt distant.
- La commande `/narsil-check` avec `upgrade`, `vulns` et `template "…"`, enregistrée dans `session.start` avec `$.command.register`.
