---
title: Les couleurs de Narsil, de jour comme de nuit
description: 'Comment skin.css habille claude.ai de la palette mer de nuit de Narsil Skin, comment mode.js choisit clair ou sombre selon l’heure quoi que dise Claude, et comment les barres suivent sans flash.'
route: android
order: 5
updated: 2026-11-24
sources:
  - repo: android
    path: app/src/main/assets/page/skin.css
  - repo: android
    path: app/src/main/assets/page/mode.js
  - repo: android
    path: app/src/main/assets/page/lib/mode.js
  - repo: android
    path: app/src/main/assets/page/lib/watch.js
  - repo: android
    path: app/src/main/assets/host.js
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/MainActivity.kt
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/PageScript.kt
---

## Ce que ça fait

Dans l’application, Claude porte les couleurs de Narsil : la palette mer de nuit de [Narsil Skin](https://github.com/davshn/narsil-skin), les thèmes de couleurs de l’auteur ou de l’autrice pour l’application de bureau de Claude. Les fonds, le texte, les bordures, les blocs de code et la lueur pendant que Claude travaille changent tous :

- **La nuit**, de 18:00 à 5:59, un fond bleu marine profond (`#0f1a2c`), un texte bleu pâle et un accent bleu vif.
- **Le jour**, de 6:00 à 17:59, un fond bleu mer pâle (`#c9e7f1`), un texte bleu foncé et un accent bleu-vert.
- **L’étincelle orange** que Claude montre pendant qu’il travaille devient violette.
- **Tout le texte est en gras**, comme le veut le thème.

C’est l’heure qui décide, d’après l’horloge du téléphone, quelle que soit l’apparence choisie dans Claude : l’application ne lit pas votre réglage et ne le modifie pas. La barre d’état et la barre de navigation suivent, avec le même fond derrière elles et des icônes sombres ou claires assorties. Et les couleurs sont posées tout au début de chaque page, si bien que celles de Claude ne s’affichent jamais en premier.

> **Expérimental.** L’habillage remplace les variables de design propres à `claude.ai` et donne un style à quelques-unes de ses parties grâce aux noms de classes et aux attributs du balisage actuel de la page. Rien de tout cela n’est une API publique. Une mise à jour de Claude peut les renommer ; quand cela arrive, certaines parties de la page retrouvent les couleurs de Claude ou, plus rarement, une partie devient difficile à lire jusqu’à ce que l’habillage soit mis à jour. Claude lui-même continue de fonctionner.

## Comment ça marche à l’intérieur

Trois fichiers font le travail, et un réglage en Kotlin le termine :

| Fichier                    | Rôle                                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| `assets/page/skin.css`     | La palette, sous forme de valeurs pour les variables de design de Claude, et quelques règles à lui. |
| `assets/page/lib/mode.js`  | Quel mode porte chaque heure : une seule règle, partagée par les scripts de page.                   |
| `assets/page/mode.js`      | Règle le mode clair ou sombre de la page selon l’heure, et le maintient.                            |
| `MainActivity.paintBars()` | Peint le fond derrière les barres système et choisit la couleur de leurs icônes.                    |

### Peindre avec les variables propres de la page

Une application web moderne n’écrit pas les couleurs dans chaque règle. Elle les définit une fois, sous forme de propriétés personnalisées CSS, et chaque composant les lit. `claude.ai` le fait avec une famille de variables dont les noms commencent par `--cds-` (fond de page, surfaces, texte, bordures, accents), plus une famille plus ancienne de valeurs `--bg-*`, `--text-*` et `--accent-*` écrites sous forme de triplets HSL.

Cela rend l’habillage petit. Au lieu de redonner un style à des centaines de composants, `skin.css` donne de nouvelles valeurs à ces variables, et la page se repeint d’elle-même. Le début de la moitié sombre, depuis `skin.css` dans narsil-android (MIT) :

<!-- prettier-ignore -->
```css
/* Each .cds-root the app mounts declares these again for itself, so setting
   them on html alone lasts only until it has mounted. */
html[data-mode="dark"],
html[data-mode="dark"] .cds-root:not([data-mode="light"]),
html[data-mode="dark"] #static-composer,
.cds-root[data-mode="dark"],
.cds-dark-scope {
  --cds-page-bg: #0f1a2c !important;
  --cds-surface-0: #0b1422 !important;
  --cds-surface-1: #0f1a2c !important;
  --cds-surface-2: #16243b !important;
  --cds-surface-3: #1a2a44 !important;
  --cds-surface-panel: #16243b !important;
  --cds-surface-popover: #22344f !important;
  --cds-text-primary: #dce6fa !important;
  --cds-text-secondary: color-mix(in srgb, #dce6fa 68%, transparent) !important;
```

Trois détails de ces quelques lignes expliquent tout le fichier :

- **Les sélecteurs se répètent.** Comme le dit le commentaire, chaque `.cds-root` que la page monte déclare de nouveau les variables pour lui-même, et une déclaration plus proche l’emporte sur celle de `html`. L’habillage les définit donc à chaque endroit où la page les définit : `html`, chaque `.cds-root`, la zone de saisie statique et les portées sombres.
- **`!important` partout.** Sinon, les déclarations propres de la page l’emporteraient quand elles sont aussi spécifiques que celles de l’habillage. Une déclaration importante bat une déclaration normale, quel que soit l’ordre.
- **Des nuances tirées d’une seule couleur.** Le texte secondaire et le texte atténué sont le texte principal mélangé à de la transparence (`color-mix(in srgb, #dce6fa 68%, transparent)`), si bien que chaque nuance reste dans la même teinte.

Les principales valeurs de la palette côte à côte :

| Variable              | Nuit (`dark`)       | Jour (`light`)              |
| --------------------- | ------------------- | --------------------------- |
| `--cds-page-bg`       | `#0f1a2c`           | `#c9e7f1`                   |
| `--cds-surface-0`     | `#0b1422`           | `#b7deed`                   |
| `--cds-surface-2`     | `#16243b`           | `#d6eef5`                   |
| `--cds-text-primary`  | `#dce6fa`           | `#0f2f47`                   |
| `--cds-text-accent`   | `#5aaeff`           | `#1f83a8`                   |
| `--cds-border-strong` | 26 % d’un bleu pâle | 26 % de la couleur du texte |

### Ce que les variables n’atteignent pas

Quelques parties de la page ne prennent pas leurs couleurs dans ces variables, et `skin.css` leur donne un style une par une :

- **Le menu latéral**, peint avec `--cds-surface-0`.
- **Les blocs de code des diffs**, qui vivent dans une shadow root, où les règles extérieures n’arrivent pas. Les propriétés personnalisées, elles, passent à l’intérieur, et une règle sur l’hôte de l’ombre bat celle du composant, donc l’habillage définit `--diffs-light-bg`, `--diffs-dark-bg` et leurs couleurs de texte sur `diffs-container`.
- **Les blocs de code de la conversation en mode clair.** Ils colorent leurs tokens en ligne avec la palette sombre de la page même quand le mode clair est forcé, si bien que des tokens pâles se retrouveraient sur un fond pâle. L’habillage les trouve par leur couleur de base en ligne et les retourne avec `filter: invert(1) hue-rotate(180deg) saturate(1.3)` : l’inversion fait passer le clair au sombre, et tourner la teinte d’un demi-cercle remet la teinte de chaque token à sa place.
- **La sélection**, la bordure de la zone de message (plus marquée quand elle a le focus), et **l’étincelle** : `[data-cds="Spark"]` et `[data-cds="WorkingMark"]` reçoivent `filter: hue-rotate(262deg) saturate(1.3)`, qui rend violet l’orange de Claude.
- **Le texte en gras** : `body, body *` reçoivent `font-weight: 700 !important`. Le commentaire explique pourquoi c’est une règle simple et non un `:not()` qui épargnerait les parties propres de Narsil : un `:not()` de descendants « would walk every element's ancestors on each recalculation » (parcourrait les ancêtres de chaque élément à chaque recalcul). À la place, `band.css` remet les graisses de la bande avec ses propres `!important`.

Les commentaires se soucient aussi de la vitesse. Deux variables dont la page hérite sont définies « Only where the page declares them » (seulement là où la page les déclare) parce que, sur chaque élément, « they would make each one carry its own copy and slow every style recalculation » (elles feraient porter à chacun sa propre copie et ralentiraient chaque recalcul de style). Sur un téléphone, pendant que Claude diffuse une réponse et que la page change de nombreuses fois par seconde, cela compte.

À sa fin, `skin.css` définit `--narsil-css-skin: 1` sur `:root`. Cela ne change rien de visible : c’est une marque que les scripts de la bande lisent pour savoir que la feuille de style a atteint la page (le [guide 3](/fr/android/conversation-band/) explique ce qu’ils font quand elle manque).

### Comment les styles atteignent la page

`skin.css` et `band.css` sont réunis par `PageScript.kt` en une seule chaîne JavaScript, `NARSIL_CSS`, et `host.js` la transforme en feuille de style construite :

<!-- prettier-ignore -->
```js
const sheet = new CSSStyleSheet()
sheet.replaceSync(NARSIL_CSS)

// The page sets adoptedStyleSheets of its own at times: the sheet goes back on each change the watch sees.
function adopt() {
  if (!document.adoptedStyleSheets.includes(sheet)) document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
}
adopt()
```

Cet extrait vient de `host.js` dans narsil-android (MIT). Une feuille construite n’est pas un élément de la page, donc les changements du balisage de la page ne peuvent pas la retirer, et le commentaire du fichier note que la Content Security Policy de la page ne la régit pas, alors qu’un `<style>` ajouté par un script pourrait être refusé. La page peut remplacer sa propre liste de feuilles adoptées, donc `PageScript` enregistre `adopt` auprès de l’observateur de la page : après n’importe quel changement, la feuille de Narsil est remise en place.

### Clair le jour, sombre la nuit

La règle de l’heure tient en une ligne, dans `lib/mode.js` (MIT) :

<!-- prettier-ignore -->
```js
// Which mode claude.ai wears at each hour, as narsil-skin's auto theme does.

self.narsilMode = (() => {
  const isDay = (hour) => hour >= 6 && hour < 18
  const modeOfHour = (hour) => (isDay(hour) ? 'light' : 'dark')
  return { modeOfHour }
})()
```

Elle reproduit le thème automatique de Narsil Skin sur l’ordinateur, si bien que le téléphone et l’ordinateur changent en même temps.

`claude.ai` marque son mode avec un attribut `data-mode` : `light`, `dark` ou `system`, sur l’élément `<html>` et sur certains de ses composants. C’est cet attribut qu’écrit votre réglage d’apparence, et que lisent les sélecteurs de l’habillage. Donc `mode.js` ne lutte pas contre les styles de la page ; il écrit simplement l’attribut. Le fichier entier, depuis `mode.js` (MIT) :

<!-- prettier-ignore -->
```js
// Light by day and dark by night, whatever claude.ai's own setting says: its
// data-mode attribute, on every element that carries one, as the page sets it
// again whenever it mounts one. Not every data-mode: data-mode=code means
// something else.

(() => {
  const MODES = '[data-mode=light],[data-mode=dark],[data-mode=system]'
  const CHECK_MS = 60_000
  function apply() {
    const mode = self.narsilMode.modeOfHour(new Date().getHours())
    for (const element of document.querySelectorAll(MODES)) if (element.dataset.mode !== mode) element.dataset.mode = mode
  }

  self.narsilWatch(apply)

  // The hour turns with no change on the page; a hidden page runs no frames.
  const timer = setInterval(apply, CHECK_MS)
  const onVisibility = () => apply()
  document.addEventListener('visibilitychange', onVisibility)
  self.narsilWatch.onStop(() => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisibility)
  })
  apply()
})()
```

Chaque partie a sa raison :

- **Seulement trois valeurs.** `data-mode=code` existe sur la page et « means something else » (signifie autre chose), donc le sélecteur nomme `light`, `dark` et `system` et laisse le reste tranquille.
- **Chaque élément qui en porte un,** pas seulement `<html>`. La page monte des composants avec leur propre `data-mode`, et le redéfinit quand elle les monte.
- **À chaque changement de la page,** grâce à `self.narsilWatch(apply)`. L’observateur de la page de `lib/watch.js` surveille aussi les attributs, avec `attributeFilter: ['data-mode', 'href']`, donc la page qui remet `data-mode` est elle-même un changement qui le réveille.
- **Toutes les 60 secondes,** parce que l’heure tourne sans que rien ne change sur la page.
- **Sur `visibilitychange`,** parce que, comme le dit le commentaire, « a hidden page runs no frames » (une page cachée n’exécute aucune image) : les callbacks de l’observateur attendent une image, et les minuteurs ralentissent dans une page cachée. Quand l’écran revient après une nuit dans votre poche, le bon mode est là tout de suite, pas jusqu’à une minute plus tard.
- **Seulement quand c’est différent.** Écrire l’attribut est un changement que l’observateur voit, donc `apply` n’écrit que quand la valeur diffère. Sinon, chaque écriture réveillerait l’observateur, qui écrirait de nouveau.

L’application ne touche jamais à votre réglage Claude. `mode.js` ne fait que réécrire l’attribut dans la page que vous avez sous les yeux. Sur votre ordinateur, ou dans l’application Claude elle-même, votre réglage reste tel que vous l’avez laissé.

### Avant le premier affichage

Le README promet que « The colors go on from the very start of each page, so Claude's own never flash first. » (les couleurs sont posées dès le tout début de chaque page, si bien que celles de Claude ne s’affichent jamais en premier). Trois choses le rendent vrai :

1. **Le script s’exécute au début du document.** `addDocumentStartJavaScript` l’exécute avant tous les scripts propres de `claude.ai` ([guide 2](/fr/android/webview-host/)). À ce moment-là, la feuille de style est adoptée, donc ses règles attendent le balisage de la page.
2. **Le mode est dans le premier groupe.** `PageScript` exécute `lib/watch.js`, `lib/mode.js` et `mode.js` tout de suite, et non après l’analyse du document, moment où tournent les scripts de la bande.
3. **L’observateur travaille avant l’affichage.** Il exécute ses callbacks avec `requestAnimationFrame`, et un navigateur exécute ces callbacks juste avant de dessiner l’image. Donc, quand la page met `data-mode` à sa propre valeur, `mode.js` a déjà réécrit celle de Narsil avant que cette image n’arrive à l’écran.

Le journal de tâches consigne la vérification sur un vrai téléphone, par les DevTools : « both style marks and the night ground rgb(15, 26, 44) » (les deux marques de style et le fond de nuit rgb(15, 26, 44)), c’est-à-dire `#0f1a2c`.

### Les barres système

La page tient entre les barres système (le [guide 2](/fr/android/webview-host/) explique la marge), donc ce qui apparaît derrière elles est le cadre propre de l’activité. `MainActivity` le peint avec le fond de la page et choisit la couleur des icônes. Depuis `MainActivity.kt` (MIT) :

```kotlin
    // Behind the system bars, the page's own ground, light by day and dark by night as the band's mode.js sets it.
    private fun paintBars() {
        val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        val isDay = hour in 6..17
        frame.setBackgroundColor(Color.parseColor(if (isDay) "#c9e7f1" else "#0f1a2c"))
        WindowCompat.getInsetsController(window, frame).apply {
            isAppearanceLightStatusBars = isDay
            isAppearanceLightNavigationBars = isDay
        }
    }
```

`hour in 6..17` est la même règle que celle de `lib/mode.js`, écrite en Kotlin : de 6:00 à 17:59. Les deux couleurs sont le `--cds-page-bg` de chaque mode. `isAppearanceLightStatusBars = true` demande des icônes sombres, dont un fond clair a besoin ; la nuit, elles deviennent claires.

La règle vit deux fois, une fois en JavaScript et une fois en Kotlin, parce que la page et l’activité ne peuvent pas facilement partager du code. Les valeurs doivent changer ensemble, ce qui mérite un test à vous (voir le code de référence).

`paintBars` s’exécute dans `onResume`, chaque fois que l’application revient au premier plan. Elle ne tourne pas sur un minuteur, comme le fait `mode.js`.

## Le construire avec Claude

Demandez à Claude un habillage en deux parties : une feuille de style qui donne de nouvelles valeurs aux variables de design propres de la page sous `html[data-mode=…]`, et un petit script qui règle cet attribut selon l’heure et le maintient. La seule idée qu’il doit bien saisir, c’est que l’habillage suit le mécanisme propre de la page au lieu de lutter contre lui : il écrit des variables et l’attribut de mode, et laisse la page se repeindre d’elle-même.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Mon application Android exécute un script au début du document sur `https://claude.ai` et adopte une feuille de style construite. Écris la feuille de style : sous `html[data-mode="dark"]`, chaque `.cds-root` sans `data-mode="light"`, et `.cds-root[data-mode="dark"]`, donne aux variables `--cds-page-bg`, `--cds-surface-0` à `-3`, `--cds-text-primary` et `--cds-text-accent` de la page une palette bleu marine avec `!important`, et une palette bleu mer pâle pour `light`. Écris ensuite un script qui, sur chaque élément dont `data-mode` vaut `light`, `dark` ou `system` (jamais `code`), écrit `light` de 6:00 à 17:59 et `dark` le reste du temps, d’après l’heure locale du téléphone. Lance-le tout de suite, à chaque changement que voit un unique `MutationObserver` (limité avec `requestAnimationFrame`, qui surveille aussi l’attribut `data-mode`), toutes les 60 secondes et sur `visibilitychange` ; n’écris que quand la valeur diffère. En Kotlin, dans `onResume`, peins le cadre derrière les barres système avec le même fond et règle des icônes de barres claires ou sombres selon les mêmes heures. Teste la règle de l’heure dans les deux langages.

### Ce qu’il faut vérifier dans la réponse de Claude

1. Les variables sont définies sur chaque élément où la page les déclare, pas seulement sur `html`.
2. Le script de mode laisse `data-mode=code` tranquille.
3. Il n’écrit l’attribut que quand la valeur diffère, pour que l’observateur ne tourne pas en boucle.
4. L’observateur surveille l’attribut `data-mode`, si bien que la page qui le remet est repérée.
5. Il y a un minuteur pour l’heure et un écouteur `visibilitychange` pour le retour de l’écran.
6. La règle Kotlin et la règle JavaScript sont d’accord à 5, 6, 17 et 18 heures.
7. Rien ne change le réglage Claude de la personne ; seulement l’attribut dans la page.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « à 18:00 la page devient sombre, mais la barre d’état reste claire ».

### Comment l’auteur l’a demandé

Les mots de l’auteur ou de l’autrice sont consignés dans `odd/tasks/android-app.md`. L1 demandait une vue web qui « modifique sus estilos como lo hace esta extension » (en modifie les styles comme le fait cette extension), et L3 : « recuerda que los estilos que va a inyectar seran los de la extension […] » (rappelle-toi que les styles qu’elle injectera seront ceux de l’extension ; le nom de l’ancien projet est omis ici). Les couleurs n’ont donc pas été redessinées pour l’application : `skin.css`, `mode.js` et `lib/mode.js` sont venus de l’ancienne extension tels quels, et le travail de l’application a été de les poser sur la page assez tôt.

Le reste est reconstitué à partir de l’historique des commits (un nom de projet dans un sujet de commit est remplacé par une description entre crochets) :

- `3bcea35` (2026-11-24) « feat: build the script that hosts [the earlier extension] in a WebView, and what alerts and states keep » (construire le script qui héberge [l’ancienne extension] dans une WebView, et ce que gardent les alertes et les états). Son message : « the styles go on as a constructed style sheet. » (les styles sont posés comme une feuille de style construite).
- `53c55c1` (2026-11-24) « feat: host claude.ai with [the earlier extension] in a WebView, and show Narsil's alerts from a foreground service » (héberger claude.ai avec [l’ancienne extension] dans une WebView, et afficher les alertes de Narsil depuis un service de premier plan). `paintBars` arrive avec `MainActivity`.
- `5ad4577` (2026-11-24) « refactor: make the band's scripts the app's own, and stop naming the projects it replaces » (faire des scripts de la bande ceux de l’application, et ne plus nommer les projets qu’elle remplace).

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide (MIT). Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

La règle de l’heure et les couleurs des barres dans un seul objet Kotlin, pour que l’activité et son test les partagent :

```kotlin
package io.github.davshn.narsil

object DayNight {
    const val DAY_GROUND = "#c9e7f1"
    const val NIGHT_GROUND = "#0f1a2c"

    fun isDay(hour: Int): Boolean = hour in 6..17

    fun groundOf(hour: Int): String = if (isDay(hour)) DAY_GROUND else NIGHT_GROUND
}
```

```kotlin
package io.github.davshn.narsil

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DayNightTest {
    @Test
    fun theDayRunsFromSixToFiveFiftyNine() {
        assertFalse(DayNight.isDay(5))
        assertTrue(DayNight.isDay(6))
        assertTrue(DayNight.isDay(17))
        assertFalse(DayNight.isDay(18))
    }

    @Test
    fun theGroundIsThePagesOwn() {
        assertEquals("#c9e7f1", DayNight.groundOf(12))
        assertEquals("#0f1a2c", DayNight.groundOf(23))
    }
}
```

Et le plus petit habillage possible pour une seule variable, pour voir le mécanisme tout seul. Mettez-le dans une feuille construite et réglez `data-mode` à la main dans les DevTools pour voir la page suivre :

```css
html[data-mode='dark'],
html[data-mode='dark'] .cds-root:not([data-mode='light']),
.cds-root[data-mode='dark'] {
  --cds-page-bg: #0f1a2c !important;
}

html[data-mode='light'],
html[data-mode='light'] .cds-root:not([data-mode='dark']),
.cds-root[data-mode='light'] {
  --cds-page-bg: #c9e7f1 !important;
}
```

## Erreurs fréquentes et comment tester

- **Des variables seulement sur `html`.** Le premier composant qui se monte déclare les siennes et la page retrouve par endroits les couleurs de Claude. Définissez-les partout où la page le fait.
- **Un élément `<style>` ajouté par le script.** La Content Security Policy d’une page peut le refuser. Une feuille de style construite, comme celle qu’utilise l’application, ou la feuille de style propre d’une extension, est la bonne porte d’entrée.
- **Réécrire chaque `data-mode`.** `data-mode=code` signifie autre chose sur cette page ; l’écraser casse cette partie.
- **Écrire l’attribut à chaque passage.** L’observateur se réveille sur sa propre écriture et ne se repose jamais. Comparez d’abord.
- **Pas de minuteur.** La page ne change pas à 18:00, donc sans minuteur le mode attend votre prochain toucher.
- **Du gras partout, bande de Narsil comprise.** `body *` atteint la bande. Rendez leurs graisses à vos propres parties.
- **Des blocs de code illisibles en mode clair.** Les couleurs en ligne ignorent les variables. Cherchez-les, comme le fait `skin.css` avec son filtre.
- **Croire que le réglage d’apparence de Claude compte.** Dans l’application, c’est l’heure qui gagne. C’est voulu, ce n’est pas un bug.

Pour le tester, ouvrez la page depuis `chrome://inspect` sur une version de débogage et lancez, dans la console : `document.documentElement.dataset.mode` (`light` ou `dark` selon l’heure), `getComputedStyle(document.documentElement).getPropertyValue('--narsil-css-skin')` (`1`) et `getComputedStyle(document.documentElement).getPropertyValue('--cds-page-bg')` (`#0f1a2c` la nuit, `#c9e7f1` le jour). Tapez ensuite `document.documentElement.dataset.mode = 'system'` : en une image, il devrait de nouveau indiquer le mode de l’heure. Pour essayer l’autre moitié de la journée, réglez l’horloge du téléphone à la main dans les paramètres de date et d’heure d’Android, puis revenez à l’application : la page change sur `visibilitychange`, les barres sur `onResume`.

### Là où le code et le README diffèrent

- Le README dit que les barres système suivent le changement des couleurs selon l’heure. La page suit en moins d’une minute ; les barres ne suivent que quand l’application revient au premier plan, puisque `paintBars` s’exécute dans `onResume` et nulle part ailleurs. Avec l’application ouverte au passage de 6:00 ou de 18:00, les barres gardent l’ancien fond jusqu’à ce que vous partiez et reveniez.

## Pour aller plus loin

- Le [guide 3](/fr/android/conversation-band/) montre l’observateur de la page que le mode partage avec la bande, et les marques de style que la bande vérifie.
- Le [guide 2](/fr/android/webview-host/) explique les scripts de début de document et l’ordre que construit `PageScript`.
- [Narsil Skin](https://github.com/davshn/narsil-skin) contient le thème complet pour l’application de bureau, avec ses fonds d’écran, que l’application laisse de côté : le commentaire en tête de `skin.css` dit qu’il ne prend « none of that theme's wallpaper, waves or stars » (rien du fond d’écran, des vagues ni des étoiles de ce thème).
- Le code source est sur [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
