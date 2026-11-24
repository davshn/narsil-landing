---
title: La tuile
description: 'Comment la tuile Narsil · Claude dessine les limites de 5 heures et de la semaine en deux anneaux aux couleurs de Narsil, avec sa pose selon la conversation la plus importante et l’âge de la lecture.'
route: watch
order: 3
updated: 2026-11-24
sources:
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/tile/NarsilTileService.kt
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/domain/Display.kt
  - repo: watch
    path: app/src/test/kotlin/tech/davshn/narsilwatch/domain/DisplayTest.kt
  - repo: pet
    path: hooks/phone.ts
  - repo: pet
    path: hooks/fleet.ts
  - repo: pet
    path: hooks/usage.ts
---

## Ce que ça fait

Balayez latéralement depuis le cadran et vous arrivez à la tuile **Narsil · Claude**. D’un coup d’œil, elle répond à trois questions : quelle part des limites de Claude est consommée, si une conversation vous attend, et quel âge a cette information.

De l’extérieur vers l’intérieur :

- **L’anneau extérieur** est la limite de 5 heures. La partie utilisée est dessinée dans sa couleur, en partant du haut et dans le sens des aiguilles d’une montre ; le reste est une piste sombre.
- **L’anneau intérieur**, plus fin, est la limite hebdomadaire, dessinée de la même façon.
- **Narsil au centre**, à son étape actuelle, dans la pose de votre conversation la plus importante : au travail, en attente de vous, terminée, au repos ou en échec.
- **Quatre lignes courtes sous elle**, par exemple :

```text
5 h 62%
sem 90%
1 te necesita
hace 12 min
```

Les deux premières sont les limites (« sem » pour « semana », semaine), chacune dans sa propre couleur. La troisième parle de vos conversations : `1 te necesita` (1 a besoin de vous), `2 te necesitan` (2 ont besoin de vous), ou, quand aucune n’attend, l’état de la première en minuscules, comme `trabajando` (au travail). Sans conversation, elle dit `sin conversaciones` (aucune conversation). La dernière ligne est l’âge de la lecture : `ahora` (maintenant), `hace 12 min` (il y a 12 minutes), `hace 3 h`, `hace 2 d`.

Avant que la montre ait le moindre état, les limites indiquent `5 h –` et `sem –`, les anneaux sont vides, et la dernière ligne dit `configúrame` (configure-moi). Un toucher n’importe où sur la tuile ouvre l’application.

> **Expérimental.** La tuile dessine le dernier état que la montre a gardé, et cet état n’est pas plus frais que la dernière publication du mod : le mod ne publie que pendant que vous travaillez loin de l’ordinateur, dans la marge quotidienne gratuite de ntfy.sh. La tuile demande une nouvelle lecture au plus toutes les 15 minutes. Lisez la ligne d’âge avant les chiffres.

## Comment ça marche à l’intérieur

Tout vit dans `tile/NarsilTileService.kt`, avec les formulations et les couleurs dans `domain/Display.kt`. La pose et les couleurs sont décidées par le mod sur votre ordinateur ; la tuile ne fait que les dessiner.

### Un TileService qui répond avec une mise en page

Une tuile Wear OS n’est pas un écran que l’on programme avec Compose. C’est un service, `TileService`, auquel le système demande une description de la mise en page, construite avec la bibliothèque ProtoLayout. Le système la dessine et rappelle le service quand il en veut une nouvelle. Le manifeste le déclare avec la permission et l’action `BIND_TILE_PROVIDER`, le libellé `@string/tile_label` (« Narsil · Claude ») et une image d’aperçu, `@drawable/narsil_preview`.

Le service répond à deux requêtes : la tuile (sa mise en page) et ses ressources (les images qu’elle nomme). Les deux renvoient un `ListenableFuture`, et le code les écrit comme des coroutines Kotlin avec `SuspendToFutureAdapter.launchFuture`. D’après `NarsilTileService.kt` dans narsil-watch (GPL v3) :

```kotlin
override fun onTileRequest(requestParams: RequestBuilders.TileRequest): ListenableFuture<TileBuilders.Tile> =
    SuspendToFutureAdapter.launchFuture {
        if (System.currentTimeMillis() - repo.checkedAt > STALE_MS) Refresh.now(this@NarsilTileService)
        val state = repo.cached()
        TileBuilders.Tile.Builder()
            .setResourcesVersion(resourcesVersion())
            .setFreshnessIntervalMillis(STALE_MS)
            .setTileTimeline(TimelineBuilders.Timeline.fromLayoutElement(layout(state)))
            .build()
    }
```

### Quand elle demande une nouvelle lecture

Cette première ligne compte. `STALE_MS` vaut 15 minutes. Si la montre n’a pas eu de nouvelles de ntfy.sh depuis plus longtemps, la tuile appelle `Refresh.now`, qui met en file un rafraîchissement en arrière-plan avec WorkManager. Elle ne l’attend **pas**. Elle dessine aussitôt à partir de `repo.cached()`, l’état gardé sur la montre.

Quand le rafraîchissement en arrière-plan se termine, il demande au système de redessiner la tuile ([guide 5](/fr/watch/app-and-refresh/)). Le système rappelle `onTileRequest` ; à ce moment-là, `checkedAt` est frais, si bien qu’aucun second rafraîchissement n’est mis en file, et la tuile dessine le nouvel état. Deux passages, et la tuile n’affiche jamais d’indicateur de chargement.

`setFreshnessIntervalMillis(STALE_MS)` indique aussi au système que la mise en page vaut la peine d’être redemandée au bout de 15 minutes, si bien que la ligne d’âge avance même quand rien d’autre ne se passe.

### Deux anneaux

Chaque anneau est un `Arc` ProtoLayout avec deux `ArcLine` : la partie utilisée et la piste. D’après `NarsilTileService.kt` (GPL v3) :

```kotlin
// A full ring: the used part in the limit's color, the rest as track.
private fun ring(limit: Limit?, thickness: Float): LayoutElement {
    val used = ((limit?.percent ?: 0.0).coerceIn(0.0, 100.0) * 3.6).toFloat()
    val arc = LayoutElementBuilders.Arc.Builder()
        .setAnchorAngle(degrees(0f))
        .setAnchorType(LayoutElementBuilders.ARC_ANCHOR_START)
    if (used > 0f) arc.addContent(arcLine(used, thickness, limit?.let { parseColor(it.color) } ?: Palette.DIM))
    if (used < 360f) arc.addContent(arcLine(360f - used, thickness, Palette.TRACK))
    return arc.build()
}
```

À la lecture :

- **Du pourcentage aux degrés.** Un cercle complet fait 360 degrés, donc 1 % vaut 3,6. Le pourcentage est d’abord borné entre 0 et 100, si bien qu’une valeur étrange ne dessine jamais plus d’un tour.
- **Où il commence.** L’ancre est à 0 degré, le haut de l’écran, et `ARC_ANCHOR_START` veut dire que l’arc commence là et tourne dans le sens des aiguilles d’une montre.
- **Deux morceaux, jamais un vide.** À 0 %, il n’y a que la piste ; à 100 %, que la couleur.
- **Pas de limite, pas de couleur.** Sans lecture, `percent` compte comme 0, si bien que tout l’anneau est de la piste.

La mise en page place les anneaux l’un dans l’autre. La `Box` extérieure remplit la tuile, a le fond sombre `Palette.BG`, et contient l’anneau de 5 heures, épais de 7 dp (`RING`). À l’intérieur, une seconde `Box` avec une marge intérieure de `RING + GAP` (7 + 3 dp) contient l’anneau hebdomadaire, épais de 5 dp (`RING_INNER`), et la colonne du centre. C’est cette marge qui garde l’anneau intérieur 3 dp à l’intérieur de l’extérieur, quelle que soit la taille de l’écran.

### Les couleurs : décidées sur l’ordinateur, lues sur la montre

Le README dit que les anneaux sont « colored as Narsil colors them: green, yellow from 60 %, and red from 85 % » (colorés comme Narsil les colore : vert, jaune à partir de 60 %, et rouge à partir de 85 %). Il vaut la peine de savoir où vit cette règle, parce qu’elle n’est pas sur la montre.

Le mod décide de la couleur de chaque limite quand il publie l’état. `levelColor` dans `hooks/usage.ts` de narsil-pet (GPL v3) :

```ts
export function levelColor(percent: number): string {
  return percent >= 85 ? '#F0435A' : percent >= 60 ? '#F5B400' : '#22B573'
}
```

`watchLimits` dans `hooks/phone.ts` met le résultat dans le champ `color` de chaque limite ([guide 2](/fr/watch/reading-the-state/)). La montre ne fait que transformer ce texte en couleur, avec `parseColor` dans `domain/Display.kt` (GPL v3) :

```kotlin
// A #RRGGBB color as the PC sends it; dim for anything else.
fun parseColor(hex: String): Int {
    val digits = hex.removePrefix("#")
    if (digits.length != 6) return Palette.DIM
    val rgb = digits.toLongOrNull(16) ?: return Palette.DIM
    return (0xFF000000L or rgb).toInt()
}
```

Une limite à 62 % est donc jaune sur la montre parce qu’elle est jaune sur l’ordinateur. Si le mod change un jour ses seuils, la montre suit sans mise à jour. Une couleur qui n’est pas faite de six chiffres hexadécimaux devient `Palette.DIM`, un gris atténué, au lieu d’une erreur ; le test « reads a level color, and falls back to dim on noise » (lit une couleur de niveau, et se rabat sur le gris atténué en cas de bruit) vérifie `#22B573` et le mot `rojo` (rouge).

`Display.kt` contient les couleurs que la montre décide elle-même. Le commentaire en tête du fichier : « How the watch says things, in Narsil's words and colors (overlay.html, dark theme). Pure functions, so the tile, the complication and the app read the same. » (comment la montre dit les choses, avec les mots et les couleurs de Narsil, overlay.html, thème sombre ; des fonctions pures, pour que la tuile, la complication et l’application lisent la même chose). Sa `Palette` a le fond `0xFF16182A`, le texte `0xFFECEBF3`, le gris atténué `0xFF9A98AD`, la piste `0xFF2A2D45` et l’accent `0xFF7C6CF0`. Son `statusColor` donne à chaque état de conversation la couleur que Narsil utilise pour lui : `working` bleu `0xFF3B8BFF`, `idle` gris `0xFF8A90A6`, `waiting` jaune `0xFFF5B400`, `done` vert `0xFF22B573` et `error` rouge `0xFFF0435A`. Un état inconnu se rabat sur le gris du repos.

### Narsil au centre : le dessin

La colonne du centre commence par une `Image` de 40 dp de large et 66 dp de haut, qui nomme une ressource, `ART_ID` (`"narsil"`). L’image elle-même vient de `onTileResourcesRequest` :

- **Si la montre a téléchargé un dessin**, `repo.art()` renvoie ses octets, qui entrent comme ressource d’image en ligne.
- **S’il n’en a pas encore**, la tuile utilise le dessin livré avec l’application, `R.drawable.narsil_preview`.

Le dessin vient du dépôt [narsil-pet](https://github.com/davshn/narsil-pet) sur GitHub. `StatusRepository` télécharge l’URL du champ `art` de l’état, seulement si elle commence par `https://raw.githubusercontent.com/davshn/narsil-pet/`, et la garde sous `art.png` ([guide 2](/fr/watch/reading-the-state/)). Le README en mentionne l’origine : « Narsil's art is © its author and comes from the narsil-pet repository. » (les dessins de Narsil sont © de leur auteur ou autrice et viennent du dépôt narsil-pet).

Le système met les ressources en cache selon une chaîne de version, si bien que la tuile doit changer la version chaque fois que l’image change. `resourcesVersion()` est le hachage des octets de l’image, ou `"preview"` sans image :

```kotlin
private fun resourcesVersion(): String = repo.art()?.contentHashCode()?.toString() ?: "preview"
```

Nouvelle pose, nouveaux octets, nouvelle version, et le système redemande les ressources. Même pose, même version, et rien n’est rechargé.

### Quelle pose : la conversation la plus importante

La tuile ne choisit pas la pose. C’est le mod qui la choisit, et il la nomme dans l’URL. Dans `sendStatus` (`hooks/register.tsx` dans narsil-pet) :

```ts
art: artUrl(POSE[list[0]!.status], stageOf(levelOf(earned).level)),
```

Trois pièces décident de cette URL :

1. **La liste est classée.** `list` vient de `fleetOf` dans `hooks/fleet.ts`, qui trie chaque conversation ouverte selon `RANK`, avec le commentaire « An error first, then what needs you, what works, what finished » (une erreur d’abord, puis ce qui a besoin de vous, ce qui travaille, ce qui a terminé) : `error` 0, `waiting` 1, `working` 2, `done` 3, `idle` 4. Entre deux de même rang, celle qui a changé le plus récemment passe en premier. `list[0]` est donc la conversation la plus importante : toute erreur l’emporte sur une question, toute question l’emporte sur un travail en cours.
2. **La pose est celle de l’état.** `POSE` dans `hooks/sprite.ts` nomme les images : `trabajando`, `parada`, `necesita`, `terminado`, `error`.
3. **L’étape est la croissance de Narsil.** `stageOf` dans `hooks/xp.ts` donne l’étape 1 à 5 à partir de son niveau, qui commencent aux niveaux 1, 5, 10, 20 et 35.

`artUrl` dans `hooks/phone.ts` les assemble : la base `https://raw.githubusercontent.com/davshn/narsil-pet/main/assets`, puis `etapa<stage>/` pour les étapes 2 à 5 (« etapa » veut dire « étape »), puis `<pose>-oscuro.png`. La montre reçoit toujours le dessin sombre (`oscuro`), qui va bien avec le fond sombre de la tuile. Une conversation en échec, à l’étape 3, donne `.../assets/etapa3/error-oscuro.png`.

### Les quatre lignes de texte

Sous le dessin, quatre éléments `Text`, d’une ligne chacun (`setMaxLines(1)`) :

```kotlin
.addContent(text(limitLine(fiveHour, "5 h"), 13f, fiveHour?.let { parseColor(it.color) } ?: Palette.DIM, bold = true))
.addContent(text(limitLine(week, "sem"), 11f, week?.let { parseColor(it.color) } ?: Palette.DIM))
.addContent(text(fleetLine(state), 11f, fleetColor(state)))
.addContent(text(state?.let { ageLabel(it.at, System.currentTimeMillis() / 1000) } ?: "configúrame", 9f, Palette.DIM))
```

Ces lignes viennent de `NarsilTileService.kt` (GPL v3). Les tailles donnent la hiérarchie : le chiffre de 5 heures en 13 sp et en gras, parce qu’il change le plus vite et s’épuise en premier ; la semaine et les conversations en 11 sp ; l’âge en 9 sp et en gris.

- **`limitLine`** écrit `5 h 62%`, avec le pourcentage coupé en nombre entier (`toInt()`), ou `5 h –` sans limite.
- **`fleetLine`** compte les conversations qui ont besoin de vous avec `needsYou` de `Display.kt`, qui vaut `sessions.count { it.status == "waiting" }`. Une seule donne `1 te necesita`, plusieurs donnent `2 te necesitan`. Quand aucune n’attend, elle montre le libellé de la première conversation en minuscules ; sans conversation, `sin conversaciones`.
- **`fleetColor`** colore cette ligne avec la couleur de l’état de la première conversation, si bien qu’une ligne rouge veut dire que la conversation la plus importante a échoué.
- **`ageLabel`** mesure à partir de `at`, le moment où l’ordinateur a envoyé l’état, pas le moment où la montre l’a lu. C’est l’âge honnête : un état lu il y a une minute mais envoyé il y a trois heures dit `hace 3 h`.

`ageLabel`, d’après `Display.kt` (GPL v3) :

```kotlin
// How old the state is: the PC publishes only while you are away.
fun ageLabel(at: Long, nowSeconds: Long): String {
    val minutes = (nowSeconds - at).coerceAtLeast(0) / 60
    return when {
        minutes < 1 -> "ahora"
        minutes < 60 -> "hace $minutes min"
        minutes < 24 * 60 -> "hace ${minutes / 60} h"
        else -> "hace ${minutes / (24 * 60)} d"
    }
}
```

`coerceAtLeast(0)` protège contre une horloge de montre un peu en retard sur celle de l’ordinateur : un état « venu du futur » indique `ahora`, pas un âge négatif.

### Un toucher ouvre l’application

La `Box` extérieure a un `Clickable` dont l’action est un `LaunchAction` vers `MainActivity`, dans le paquet propre de l’application. Toute la tuile est une seule grande cible, ce qui convient à un petit écran rond.

## Le construire avec Claude

Demandez à Claude une tuile qui dessine les limites en anneaux à partir d’un état stocké. Les idées que Claude doit bien saisir : la tuile n’attend jamais le réseau, et la couleur vient de l’état plutôt que de seuils sur la montre.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon application Wear OS `my-watch`, ajoute un `TileService` avec ProtoLayout. Il lit l’état stocké depuis mon `StatusRepository.cached()` (un `NarsilState` avec des `limits` de `key` `fiveHour` et `week`, chacune avec un `percent` et une `color` `#RRGGBB`, et des `sessions` avec `status` et `label`). Dessine la limite de 5 heures en anneau extérieur épais de 7 dp et la semaine en anneau intérieur épais de 5 dp, 3 dp à l’intérieur ; chaque anneau est un `Arc` ancré à 0 degré avec `ARC_ANCHOR_START`, la partie utilisée de `percent × 3.6` degrés dans la couleur de la limite et le reste dans une couleur de piste. Au centre, une ressource d’image avec l’image stockée, qui se rabat sur un drawable livré, avec la version des ressources égale à un hachage des octets de l’image. En dessous, `5 h 62%`, `sem 90%`, combien de sessions ont l’état `waiting`, et l’âge à partir du champ `at` de l’état. Si la dernière vérification date de plus de 15 minutes, mets en file un rafraîchissement en arrière-plan sans l’attendre. Un toucher ouvre `MainActivity`. Mets les formulations et l’analyse des couleurs dans des fonctions pures avec des tests JUnit.

### Ce qu’il faut vérifier dans la réponse de Claude

1. `onTileRequest` dessine à partir de l’état stocké et n’attend jamais un appel réseau.
2. Les degrés de l’anneau valent le pourcentage, borné entre 0 et 100, multiplié par 3,6, et aucune `ArcLine` n’est ajoutée avec une longueur de 0.
3. La couleur vient du champ `color` de la limite, par un parseur qui se rabat sur une couleur neutre, et non de seuils codés en dur dans la tuile.
4. La version des ressources change quand l’image change.
5. L’âge est mesuré à partir du `at` de l’état, pas du moment où la montre l’a lu.
6. Sans état, la tuile dessine quand même : des anneaux vides, des tirets et une invitation à la configurer.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « la tuile montre l’ancienne pose même après que l’application montre la nouvelle », ce qui désigne une version de ressources qui ne change pas.

### Comment l’auteur l’a demandé

Aucune demande consignée n’existe pour la tuile. Voici une reconstitution à partir de l’historique des commits :

- narsil-pet `6400a6f` (2026-11-23) « feat(phone): publish Claude limits and open conversations for the watch » (publier les limites de Claude et les conversations ouvertes pour la montre). Il ajoute `limits` avec la `color` de chaque limite tirée de `levelColor`, et `sessions` classées par importance, ce qui permet à la tuile de prendre les deux dans l’état.
- narsil-watch `b47ca7a` (2026-11-23) « feat: Narsil on Wear OS with Claude limits and open conversations » (Narsil sur Wear OS avec les limites de Claude et les conversations ouvertes). Son message commence par la tuile : « A tile with the 5-hour and weekly limits as rings and Narsil in her current pose » (une tuile avec les limites de 5 heures et hebdomadaire en anneaux et Narsil dans sa pose actuelle).

Le commentaire du fichier lui-même est l’énoncé le plus court de la conception : « The tile: the 5-hour limit as the outer ring, the week as the inner one, Narsil in the middle in her current pose, and who needs you. » (la tuile : la limite de 5 heures en anneau extérieur, la semaine en anneau intérieur, Narsil au centre dans sa pose actuelle, et qui a besoin de vous).

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide. Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

Une tuile réduite avec un anneau et une ligne, écrite pour ce guide et adaptée de `NarsilTileService.kt` dans [narsil-watch](https://github.com/davshn/narsil-watch) (GPL v3). Elle utilise les mêmes appels ProtoLayout et Tiles que ce fichier, et suppose les `StatusRepository`, `Limit`, `Palette` et `parseColor` des dossiers `data/` et `domain/` du dépôt :

```kotlin
package com.example.mywatch.tile

import androidx.concurrent.futures.SuspendToFutureAdapter
import androidx.wear.protolayout.ColorBuilders.argb
import androidx.wear.protolayout.DimensionBuilders.degrees
import androidx.wear.protolayout.DimensionBuilders.dp
import androidx.wear.protolayout.DimensionBuilders.expand
import androidx.wear.protolayout.DimensionBuilders.sp
import androidx.wear.protolayout.LayoutElementBuilders
import androidx.wear.protolayout.LayoutElementBuilders.LayoutElement
import androidx.wear.protolayout.ModifiersBuilders
import androidx.wear.protolayout.ResourceBuilders
import androidx.wear.protolayout.TimelineBuilders
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import com.example.mywatch.data.StatusRepository
import com.example.mywatch.domain.Limit
import com.example.mywatch.domain.Palette
import com.example.mywatch.domain.parseColor
import com.google.common.util.concurrent.ListenableFuture

class LimitTileService : TileService() {
    private val repo by lazy { StatusRepository(this) }

    override fun onTileRequest(requestParams: RequestBuilders.TileRequest): ListenableFuture<TileBuilders.Tile> =
        SuspendToFutureAdapter.launchFuture {
            val fiveHour = repo.cached()?.limits?.find { it.key == "fiveHour" }
            TileBuilders.Tile.Builder()
                .setResourcesVersion("1")
                .setFreshnessIntervalMillis(15 * 60_000L)
                .setTileTimeline(TimelineBuilders.Timeline.fromLayoutElement(layout(fiveHour)))
                .build()
        }

    override fun onTileResourcesRequest(requestParams: RequestBuilders.ResourcesRequest): ListenableFuture<ResourceBuilders.Resources> =
        SuspendToFutureAdapter.launchFuture {
            ResourceBuilders.Resources.Builder().setVersion(requestParams.version).build()
        }

    private fun layout(limit: Limit?): LayoutElement {
        val color = limit?.let { parseColor(it.color) } ?: Palette.DIM
        val used = ((limit?.percent ?: 0.0).coerceIn(0.0, 100.0) * 3.6).toFloat()
        val arc = LayoutElementBuilders.Arc.Builder()
            .setAnchorAngle(degrees(0f))
            .setAnchorType(LayoutElementBuilders.ARC_ANCHOR_START)
        if (used > 0f) arc.addContent(arcLine(used, color))
        if (used < 360f) arc.addContent(arcLine(360f - used, Palette.TRACK))
        val label = LayoutElementBuilders.Text.Builder()
            .setText(limit?.let { "5 h ${it.percent.toInt()}%" } ?: "5 h –")
            .setMaxLines(1)
            .setFontStyle(LayoutElementBuilders.FontStyle.Builder().setSize(sp(13f)).setColor(argb(color)).build())
            .build()
        return LayoutElementBuilders.Box.Builder()
            .setWidth(expand())
            .setHeight(expand())
            .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
            .setVerticalAlignment(LayoutElementBuilders.VERTICAL_ALIGN_CENTER)
            .setModifiers(
                ModifiersBuilders.Modifiers.Builder()
                    .setBackground(ModifiersBuilders.Background.Builder().setColor(argb(Palette.BG)).build())
                    .build(),
            )
            .addContent(arc.build())
            .addContent(label)
            .build()
    }

    private fun arcLine(length: Float, color: Int) =
        LayoutElementBuilders.ArcLine.Builder()
            .setLength(degrees(length))
            .setThickness(dp(7f))
            .setColor(argb(color))
            .build()
}
```

Elle n’a pas d’image, si bien que ses ressources sont vides et que la version ne change jamais. Pour ajouter Narsil, suivez le vrai fichier : une `Image` avec un identifiant de ressource dans la mise en page, les octets dans `onTileResourcesRequest`, et une version égale au hachage de ces octets. Déclarez le service dans le manifeste comme le montre le [guide 1](/fr/watch/what-it-is/).

## Erreurs fréquentes et comment tester

- **Attendre le réseau dans `onTileRequest`.** Le système attend une réponse rapide. Dessinez à partir de l’état stocké et rafraîchissez en arrière-plan.
- **Rafraîchir à chaque requête de la tuile.** Chaque balayage coûterait une requête. La vérification des 15 minutes la limite à une par fenêtre.
- **Une version de ressources fixe.** L’image ne se met jamais à jour, parce que le système garde celle en cache.
- **Coder en dur 60 et 85 sur la montre.** Cela fonctionne jusqu’à ce que le mod change sa règle. Peignez la couleur que transporte l’état.
- **Un arc de longueur nulle.** N’ajoutez la partie utilisée que quand elle dépasse 0 degré, et la piste que quand elle est en dessous de 360.
- **Mesurer l’âge à partir de la lecture.** L’âge qui compte est celui depuis l’envoi par l’ordinateur.
- **Oublier l’état vide.** Avant la première lecture, la tuile doit quand même se dessiner et vous dire de la configurer.

Pour tester la logique sans montre, lancez les tests unitaires :

```bash
./gradlew :app:testDebugUnitTest
```

`DisplayTest.kt` couvre ce que la tuile écrit et peint : « counts the conversations that need you » (compte les conversations qui ont besoin de vous, deux `waiting` parmi quatre), « says how old the state is » (dit l’âge de l’état : `ahora`, `hace 12 min`, `hace 3 h`, `hace 2 d`), « colors a status as Narsil does » (colore un état comme le fait Narsil) et « reads a level color, and falls back to dim on noise » (lit une couleur de niveau, et se rabat sur le gris atténué en cas de bruit). La mise en page elle-même n’a pas de test automatisé.

Sur la montre : installez l’application, ajoutez la tuile, et lancez `/narsil movil prueba` dans Claude Code. Ouvrez l’application une fois pour qu’elle se rafraîchisse, puis balayez jusqu’à la tuile. Elle devrait montrer le nouvel âge, et la pose de votre conversation la plus importante.

### Là où le code et le README diffèrent

- Le README dit que la montre lit l’état « whenever you open the app or the tile » (chaque fois que vous ouvrez l’application ou la tuile). La tuile ne le demande que quand la dernière vérification date de plus de 15 minutes, et dessine l’état gardé avant que le nouveau n’arrive.
- Un commentaire de `NarsilTileService.kt` dit « the art Narsil publishes is 91 x 150 » (les dessins que publie Narsil font 91 x 150), et déclare l’image en ligne avec ces tailles (`ART_W`, `ART_H`). Les dessins sombres de `assets/` dans narsil-pet font aujourd’hui tous 150 pixels de haut, mais entre 91 et 106 pixels de large, selon la pose et l’étape. Le `narsil_preview.png` livré fait 91 x 150. La tuile affiche l’image dans une boîte fixe de 40 x 66 dp dans tous les cas.
- Le README dit que Narsil se tient « above how many conversations need you » (au-dessus du nombre de conversations qui ont besoin de vous). Quand aucune n’a besoin de vous, la ligne montre à la place l’état de la première conversation, ce que le README ne mentionne pas.

## Pour aller plus loin

- Lisez `tile/NarsilTileService.kt` dans [narsil-watch](https://github.com/davshn/narsil-watch).
- L’anneau pourrait marquer l’endroit où la limite se réinitialise : l’état transporte `resetsAt` pour chaque limite, et la tuile ne l’utilise pas encore.
- Comme le nombre de conversations qui ont besoin de vous vient d’au plus 8 sessions, un ordinateur avec beaucoup de conversations en échec pourrait faire sortir de la liste une conversation en attente. Le classement met les erreurs en premier, si bien qu’il faudrait neuf conversations ou plus.
- Comment l’état atteint la montre : [Lire l’état de Narsil](/fr/watch/reading-the-state/). Le côté du mod : [Les alertes sur votre téléphone et votre montre](/fr/mods/pet/phone-and-watch/).
- Ensuite : [La complication](/fr/watch/complication/), la limite de 5 heures sur n’importe quel cadran.
