---
title: Les couleurs et l’icône de Narsil
description: 'Comment Narsil dans Claude habille claude.ai des couleurs de mer nocturne de Narsil Skin, claires le jour et sombres la nuit selon l’horloge du téléphone, et donne son icône à l’application.'
route: claude
order: 4
updated: 2026-11-18
---

## Ce que ça fait

Avec l’extension active, toute la page `claude.ai` porte la palette de mer nocturne de [Narsil Skin](https://github.com/davshn/narsil-skin) : des bleus profonds la nuit, des bleus de mer pâles le jour. Elle change :

- **Les couleurs de la page** : fonds, panneaux, texte, bordures, accents et menu latéral.
- **Les blocs de code**, dans la conversation comme dans les diffs de code, pour qu’ils s’accordent avec le reste.
- **Quelques détails** : la zone de saisie reçoit une fine bordure qui prend la couleur d’accent quand vous écrivez, le texte que vous sélectionnez prend la couleur d’accent, tout le texte est en gras comme dans le thème, et l’étincelle orange qui s’affiche pendant que Claude travaille devient violette.

Elle est claire de 6:00 à 17:59 et sombre de 18:00 à 5:59, selon l’horloge du téléphone, quelle que soit l’apparence choisie dans les réglages propres de Claude.

Et quand vous ajoutez `claude.ai` à l’écran d’accueil avec l’extension active, l’application reçoit l’icône de Narsil au lieu de celle de Claude.

> **Expérimental.** Les couleurs fonctionnent en remplaçant les variables de design que la page `claude.ai` déclare pour elle-même, et le mode en réécrivant un attribut de la page. Ni l’un ni l’autre n’est une API publique, donc une mise à jour de Claude peut les renommer et la page retrouve alors les couleurs propres de Claude, sans que rien ne casse. L’extension ne change que l’apparence de la page sur votre téléphone : elle n’écrit rien dans votre compte. Pour afficher l’icône de l’écran d’accueil, le navigateur la télécharge depuis l’adresse de l’application web de Narsil pour téléphone, `narsil-pwa.vercel.app`, seulement quand vous installez l’application.

## Comment ça marche à l’intérieur

Les couleurs et l’icône forment le premier groupe de content scripts du manifeste, celui qui s’exécute à `document_start`, avant que la page ne dessine quoi que ce soit ([MDN : content_scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_scripts)). Il contient une feuille de style, `skin.css`, et quatre petits scripts : `lib/watch.js` (l’observateur de la page que décrit le [guide 2](/fr/mods/claude/conversation-band/)), `lib/mode.js` et `mode.js` (l’heure), et `lib/manifest.js` et `app-icon.js` (l’icône).

S’exécuter aussi tôt compte : une feuille de style arrivée après que la page s’est dessinée montrerait d’abord un instant les couleurs propres de Claude. Le commentaire du code le dit clairement : les couleurs propres de la page « never flash first » (n’apparaissent jamais en premier).

### Seulement les variables de la page, pas un nouveau design

La page `claude.ai` n’écrit pas ses couleurs en dur. Elle les déclare comme propriétés personnalisées CSS, comme `--cds-page-bg` pour le fond de la page et `--cds-text-primary` pour le texte principal, et chaque partie de la page les lit ([MDN : Using CSS custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)). Elle en a deux jeux, un pour chaque mode, choisis par un attribut `data-mode`.

`skin.css` ne restyle donc pas les boutons, les menus et les panneaux un par un. Elle donne de nouvelles valeurs à ces mêmes variables, un bloc pour `data-mode="dark"` et un pour `data-mode="light"`, chacun marqué `!important` pour l’emporter sur les déclarations propres de la page. Le bloc sombre est construit sur les bleus nocturnes du thème, comme `#0f1a2c` pour la page ; le bloc clair sur ses bleus de mer pâles, comme `#c9e7f1`. Le texte secondaire et le texte atténué sont le texte principal mélangé à de la transparence (`color-mix()`), pour garder la même teinte.

Il y a un piège qu’expliquent les commentaires de la feuille de style : la page ne déclare pas les variables seulement sur `<html>`. Chaque partie qu’elle monte avec sa propre racine les déclare de nouveau pour elle-même, donc une règle sur `<html>` seul ne tient que jusqu’à ce que cette partie apparaisse. Les règles couvrent aussi ces racines.

Quelques éléments ne prennent pas les variables et ont leurs propres règles : le fond du menu latéral, les diffs de code et les blocs de code de la conversation.

### Pourquoi seulement des couleurs et des styles, sans fond animé

Sur l’ordinateur, Narsil Skin peut dessiner un fond d’écran animé derrière Claude. L’extension n’en garde rien. Le commentaire en tête de `skin.css` dit qu’elle ne prend « only the page's own design variables and a few parts » (que les variables de design propres de la page et quelques parties), et rien du fond d’écran, des vagues ou des étoiles du thème ; le README dit la même chose : seulement les couleurs et les styles du thème, sans fonds animés.

Ni l’un ni l’autre ne dit pourquoi. Une raison probable est le téléphone lui-même : une couche animée derrière une page qui se redessine déjà de nombreuses fois par seconde pendant que Claude écrit coûterait de la batterie et des images, et le travail ultérieur sur l’extension (plus bas) visait justement à alléger la page. Changer des variables ne coûte presque rien, parce que la page les lit déjà.

### Les blocs de code en mode clair

Les blocs de code de la conversation étaient un cas à part. Leurs tokens sont colorés en ligne, dans chaque `<pre>`, avec la palette sombre de la page, même quand le mode clair est forcé. En mode clair, des tokens pâles sur un fond pâle se lisaient à peine.

Le commit `127ca62` (2026-11-13) « style: darken code block tokens in light mode » (assombrir les tokens des blocs de code en mode clair) le corrige avec un filtre, pas avec une nouvelle palette. Il ne cible que les blocs de code en mode clair dont la couleur de base en ligne est celle de la palette sombre, les inverse et fait tourner la teinte d’un demi-tour ([MDN : filter](https://developer.mozilla.org/en-US/docs/Web/CSS/filter)). L’inversion rend le pâle sombre ; la rotation de la teinte de 180 degrés ramène chaque couleur à sa propre teinte, si bien qu’un mot-clé bleu pâle devient un bleu plus foncé, et non un orange. Un peu de saturation en plus les empêche de paraître délavés.

Les diffs de code fonctionnent autrement : ils vivent dans un shadow root, que les règles de la page ne peuvent pas atteindre. Mais les propriétés personnalisées pénètrent dans un shadow root, et une règle sur l’élément qui l’héberge l’emporte sur les règles propres du shadow root, donc `skin.css` définit les variables de fond et de texte du diff sur cet hôte.

### Claire le jour, sombre la nuit, selon l’horloge du téléphone

La règle est dans `lib/mode.js` : une heure de 6 jusqu’à 17 est le jour et reçoit `light` ; toute autre heure reçoit `dark`. Son commentaire dit qu’elle suit les mêmes heures que le thème automatique de Narsil Skin.

`mode.js` l’applique. Il cherche chaque élément dont le `data-mode` vaut `light`, `dark` ou `system`, et le règle sur le mode de l’heure actuelle. Pas tous les `data-mode` : la page utilise aussi `data-mode="code"` pour autre chose, et celui-là n’est pas touché. Il n’écrit que quand la valeur diffère, pour ne pas réveiller l’observateur de la page pour rien.

Comme le réglage d’apparence propre de Claude passe par le même attribut, le mode de l’extension l’emporte sur lui : quel que soit votre choix, le passage suivant remet le mode de l’heure.

Il s’exécute de nouveau :

- **Quand la page change**, par l’unique observateur de la page, qui écoute aussi les changements de `data-mode` lui-même. Quand la page monte une nouvelle partie avec son propre `data-mode`, ou le remet sur votre réglage de Claude, il est corrigé dans l’image suivante.
- **Chaque minute**, parce que l’heure peut basculer à 6:00 ou 18:00 sans aucun changement sur la page.
- **Quand la page redevient visible**, puisqu’une page cachée n’exécute aucune image et que le téléphone a pu dormir pendant le changement.

### Des conversations plus rapides

Le 2026-11-11, le commit `ce7d17e` « perf: lighten the styles and the page observers so claude.ai switches conversations faster » (alléger les styles et les observateurs de la page pour que claude.ai change de conversation plus vite) a constaté que les couleurs elles-mêmes ralentissaient la page. Son message nomme trois changements :

1. **Deux variables de couleur atténuée** étaient définies sur chaque élément. Une propriété personnalisée définie sur chaque élément oblige chacun à porter sa propre copie, et chaque recalcul des styles le paie. Elles ne sont plus définies que sur les éléments où la page elle-même les déclare, et héritées à partir de là.
2. **La règle du gras** excluait les parties propres de Narsil avec un `:not()` de descendants, ce qui oblige le navigateur à parcourir les ancêtres de chaque élément à chaque recalcul. C’est devenu une règle simple pour tout le texte, et la feuille de style propre de la bande rétablit ses graisses.
3. **Un seul observateur** pour tous les content scripts, exécuté au plus une fois par image, au lieu d’un par script.

### Quand Vivaldi saute les couleurs ou le mode

Vivaldi pour Android a apporté deux problèmes à lui, expliqués dans le [guide 5](/fr/mods/claude/android-packaging/) : après qu’Android a fermé Vivaldi et qu’il s’est rouvert, il peut charger la bande sans ses feuilles de style, ou sauter tout le groupe `document_start`, si bien que `mode.js` ne s’exécute jamais et que la page garde le mode propre de Claude.

Les corrections permettent à la page de remarquer ce qui manque et de le demander :

- **`a1e01b6`** (2026-11-18) : chaque feuille de style se termine en posant sa propre marque sur `:root`, une propriété personnalisée comme `--narsil-css-skin: 1`. Quand la bande démarre, elle lit les marques avec `getComputedStyle` ; une feuille de style dont la marque est vide n’est pas arrivée.
- **`8e31a1d`** (2026-11-18) : la bande vérifie aussi que `lib/mode.js` a laissé sa fonction sur la page. Sinon, le premier groupe ne s’est pas exécuté.

Dans les deux cas, la bande demande les morceaux manquants à l’arrière-plan, et l’arrière-plan ne remet que les feuilles de style et les groupes propres du manifeste, les styles d’abord.

### L’icône de l’écran d’accueil

Quand vous ajoutez une page à l’écran d’accueil, le navigateur lit son manifeste d’application web, le fichier que la page nomme dans un `<link rel="manifest">` ([MDN : Web application manifest](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest)). Son membre `icons` indique quelles images reçoit l’application ([MDN : icons](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons)).

L’extension ne touche donc pas l’écran d’accueil. Elle change le manifeste que la page propose :

1. **`lib/manifest.js` construit un manifeste** qui est Claude tel quel : le nom `Claude`, l’affichage autonome, le départ et la portée sur `https://claude.ai/`, le bleu de mer nocturne comme couleur de fond et de thème, et deux icônes, de 192 et 512 pixels.
2. **Il le transforme en une adresse** à lui : une URL `data:` de type `application/manifest+json` qui contient le JSON encodé. Rien n’est téléchargé pour le manifeste lui-même.
3. **`app-icon.js` fait pointer le lien de la page vers elle** : il trouve le `<link rel="manifest">` et remplace son `href`, s’il ne vaut pas déjà celle-là. L’observateur de la page écoute les changements de `href`, donc si la page remet son propre manifeste, le passage suivant le remplace de nouveau.

Les icônes ne sont pas dans l’extension. Un manifeste `data:` n’a pas d’adresse à lui par rapport à laquelle résoudre un chemin d’icône relatif, donc les icônes ont besoin d’adresses complètes, et elles pointent là où l’application web de Narsil pour téléphone les sert déjà : `https://narsil-pwa.vercel.app`. Le navigateur ne les télécharge que quand vous installez l’application.

### Pourquoi l’icône est fixée à l’installation

Le navigateur copie l’icône quand il crée l’application de l’écran d’accueil ; il ne la redemande pas à la page chaque fois que vous l’ouvrez. Le message du commit `083c03d` le dit : « The icon is set at install, so an app already installed has to be installed again. » (l’icône est fixée à l’installation, donc une application déjà installée doit être installée de nouveau).

Cela a deux conséquences que précise le README :

- **Si vous aviez déjà `claude.ai` sur l’écran d’accueil**, supprimez-la et ajoutez-la de nouveau avec l’extension active.
- **Si vous supprimez l’extension**, l’application garde l’icône de Narsil. Rien ne tourne pour la changer ; elle reste jusqu’à ce que vous installiez de nouveau l’application.

L’icône a été testée dans Firefox pour Android, où l’extension l’ajoute depuis le menu avec **Install** ou **Add to Home screen**. Dans Vivaldi, elle n’a pas été testée.

## Le construire avec Claude

Demandez à Claude un groupe de content scripts qui s’exécute à `document_start`, avec une feuille de style et deux petits scripts. L’idée que Claude doit bien saisir : ne changer que ce que la page lit déjà, ses variables de design et son attribut `data-mode`, au lieu de restyler la page morceau par morceau.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon extension Firefox pour `https://claude.ai/*`, ajoute un groupe de content scripts à `document_start` avec une feuille de style et deux scripts. La feuille de style ne remplace que les propriétés personnalisées CSS propres de la page, un bloc pour `[data-mode="dark"]` et un pour `[data-mode="light"]`, avec `!important` ; ni fonds, ni images, ni animations. Le premier script règle chaque élément dont le `data-mode` vaut `light`, `dark` ou `system` sur `light` de 6:00 à 17:59 en heure locale et sur `dark` sinon, en n’écrivant que quand la valeur diffère ; il s’exécute depuis un seul `MutationObserver` limité avec `requestAnimationFrame`, toutes les 60 secondes et sur `visibilitychange`. Le second script remplace le `href` du `<link rel="manifest">` de la page par une URL `data:application/manifest+json` contenant un manifeste avec des URL d’icônes absolues sur `https://example.com`. Garde la règle de l’heure dans son propre module et teste-la avec `node --test`.

### Ce qu’il faut vérifier dans la réponse de Claude

1. La feuille de style se charge à `document_start` et ne remplace que les propriétés personnalisées CSS de la page, un bloc pour le sombre et un pour le clair, avec `!important`, sans fonds, ni images, ni animations.
2. Le script du mode ne touche que les éléments dont le `data-mode` vaut `light`, `dark` ou `system`, jamais `data-mode="code"`, et n’écrit que quand la valeur diffère.
3. La règle de l’heure vit dans son propre module : 5, 6, 17 et 18 donnent `dark`, `light`, `light` et `dark`.
4. Le mode est réappliqué depuis un seul observateur limité avec `requestAnimationFrame`, toutes les 60 secondes, et sur `visibilitychange`.
5. Le manifeste est une URL `data:application/manifest+json` avec des adresses d’icônes complètes, et non des chemins relatifs, si bien que le navigateur ne télécharge les icônes que quand vous installez l’application, et le `href` du lien ne change que quand il diffère.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « après 18:00, la page reste claire jusqu’à ce que je la recharge ».

### Comment l’auteur l’a demandé

Aucune demande pour les couleurs ou l’icône n’a été consignée. Les mots de l’auteur ou de l’autrice consignés pour ce parcours portent sur le site (le [guide 1](/fr/mods/claude/what-it-is/) les cite). Ce qui suit est reconstitué à partir de l’historique des commits de l’extension :

- `0d65509` (2026-11-09) « feat: wear Narsil's colors on claude.ai, light by day and dark by night » (porter les couleurs de Narsil sur claude.ai, claires le jour et sombres la nuit). Son message décrit l’approche : il remplace les variables de design propres de la page par la palette de mer nocturne, « without its wallpaper » (sans son fond d’écran), et suit les mêmes heures que le mode automatique du thème.
- `083c03d` (2026-11-09) « feat: give claude.ai Narsil's icon when it is installed from Firefox » (donner à claude.ai l’icône de Narsil quand il est installé depuis Firefox). Il propose à Firefox un manifeste avec ses icônes à la place de celui de la page.
- `ce7d17e` (2026-11-11) « perf: lighten the styles and the page observers so claude.ai switches conversations faster » (alléger les styles et les observateurs de la page pour que claude.ai change de conversation plus vite).
- `127ca62` (2026-11-13) « style: darken code block tokens in light mode » (assombrir les tokens des blocs de code en mode clair).
- `a1e01b6` (2026-11-18) « fix: ask for the styles when Vivaldi loads the band without them » (demander les styles quand Vivaldi charge la bande sans eux).
- `8e31a1d` (2026-11-18) « fix: run the light and dark switch again when Vivaldi skips it » (relancer le passage clair-sombre quand Vivaldi le saute).

L’historique se lit comme un premier jour qui a réglé l’apparence, suivi d’un travail sur ce que cette apparence coûtait : la vitesse sur une longue page, la lisibilité dans un recoin, et l’habitude de Vivaldi de ne charger qu’une partie de l’extension.

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide. Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

Les trois mêmes morceaux, écrits pour ce guide (MIT). Les noms de variables sont ceux que la page `claude.ai` déclare aujourd’hui ; les couleurs sont deux de la palette de mer nocturne ; l’adresse de l’icône est un exemple à remplacer par la vôtre.

`skin.css` :

```css
html[data-mode='dark'],
[data-mode='dark'] {
  --cds-page-bg: #0f1a2c !important;
  --cds-text-primary: #dce6fa !important;
}

html[data-mode='light'],
[data-mode='light'] {
  --cds-page-bg: #c9e7f1 !important;
  --cds-text-primary: #0f2f47 !important;
}
```

`mode.js` :

```js
const modeAt = (hour) => (hour >= 6 && hour < 18 ? 'light' : 'dark')
const themed = '[data-mode="light"],[data-mode="dark"],[data-mode="system"]'

function applyMode() {
  const mode = modeAt(new Date().getHours())
  document.querySelectorAll(themed).forEach((element) => {
    if (element.dataset.mode !== mode) element.dataset.mode = mode
  })
}

const icons = [192, 512].map((size) => ({
  src: `https://example.com/icons/icon-${size}.png`,
  sizes: `${size}x${size}`,
  type: 'image/png',
}))
const manifest = { name: 'Claude', display: 'standalone', start_url: 'https://claude.ai/', icons }
const manifestUrl = `data:application/manifest+json,${encodeURIComponent(JSON.stringify(manifest))}`

function applyIcon() {
  const link = document.querySelector('link[rel~="manifest"]')
  if (link && link.getAttribute('href') !== manifestUrl) link.setAttribute('href', manifestUrl)
}

let queued = false
new MutationObserver(() => {
  if (queued) return
  queued = true
  requestAnimationFrame(() => {
    queued = false
    applyMode()
    applyIcon()
  })
}).observe(document.documentElement, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ['data-mode', 'href'],
})

setInterval(applyMode, 60_000)
document.addEventListener('visibilitychange', applyMode)
applyMode()
applyIcon()
```

Dans le manifeste, les deux vont dans une même entrée de content script avec `"run_at": "document_start"` et `"matches": ["https://claude.ai/*"]`. À `document_start`, la page n’a pas encore de body, c’est pourquoi tout attend l’observateur ([MDN : MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)) : l’observateur se déclenche à mesure que la page se construit, et chaque passage corrige ce qui est apparu. L’`attributeFilter` limite les changements d’attributs aux deux qui intéressent le script.

## Erreurs fréquentes et comment tester

- **Charger les couleurs à `document_idle`.** La page se dessine d’abord aux couleurs de Claude, puis change. Chargez la feuille de style à `document_start`.
- **Styler les parties au lieu des variables.** Chaque bouton et chaque panneau a besoin de sa propre règle, et chaque mise à jour de Claude en casse quelques-unes. Remplacez les variables que la page lit déjà.
- **Définir les variables seulement sur `<html>`.** Des parties de la page les déclarent de nouveau sur leurs propres racines. Couvrez aussi ces racines, et vérifiez qu’un panneau nouvellement ouvert garde les couleurs.
- **Définir une propriété personnalisée sur chaque élément.** Ça marche, et ça ralentit chaque recalcul des styles. Définissez-la là où la page la déclare et laissez-la s’hériter.
- **Réécrire chaque `data-mode`.** La page utilise `data-mode="code"` pour autre chose. Ne ciblez que `light`, `dark` et `system`.
- **Écrire quand rien n’a changé.** Chaque écriture réveille l’observateur, qui écrit de nouveau. Comparez d’abord.
- **Attendre que la page change à 18:00.** Elle peut ne pas changer. Vérifiez l’heure avec un minuteur, et quand la page redevient visible.
- **Un chemin d’icône relatif dans un manifeste `data:`.** Il n’a rien par rapport à quoi se résoudre. Utilisez des adresses complètes.
- **S’attendre à ce que l’icône change sur une application déjà installée.** Elle a été fixée à l’installation. Supprimez l’application et ajoutez-la de nouveau.

Pour tester la règle de l’heure, gardez-la dans un module sans DOM et vérifiez les limites : 5, 6, 17 et 18 doivent donner `dark`, `light`, `light` et `dark`. Pour tester la page, réglez l’heure du téléphone sur 17:59 et attendez 18:00, ou fixez l’heure à la main dans la règle pendant le développement : la page doit basculer dans la minute sans rechargement. Changez ensuite le réglage d’apparence propre de Claude : la page doit revenir aussitôt au mode de l’heure. Pour l’icône, ouvrez `claude.ai` avec l’extension active, ajoutez-la à l’écran d’accueil, et vérifiez que la nouvelle application affiche votre icône ; supprimez l’extension et vérifiez qu’elle reste.

## Pour aller plus loin

- Le [guide 5](/fr/mods/claude/android-packaging/) explique pourquoi Vivaldi charge parfois l’extension par morceaux, et comment l’arrière-plan remet les styles.
- [Narsil Skin](https://github.com/davshn/narsil-skin) contient le thème de mer nocturne complet pour l’ordinateur, fond d’écran compris, et d’autres thèmes dont les variables pourraient être reprises de la même façon.
- Les heures pourraient suivre le lever et le coucher du soleil au lieu de 6:00 et 18:00 fixes. La règle vit dans une petite fonction, donc seule cette fonction changerait.
