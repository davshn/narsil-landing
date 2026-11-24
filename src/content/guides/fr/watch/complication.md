---
title: La complication
description: 'Comment la complication Claude 5 h met la limite de 5 heures sur n’importe quel cadran, en arc coloré (RANGED_VALUE) ou en texte court, et comment sa source de données est priée de se mettre à jour.'
route: watch
order: 4
updated: 2026-11-24
sources:
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/complication/LimitComplicationService.kt
  - repo: watch
    path: app/src/main/AndroidManifest.xml
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/sync/Refresh.kt
  - repo: watch
    path: app/src/main/res/values/strings.xml
  - repo: pet
    path: hooks/usage.ts
---

## Ce que ça fait

Une complication est la petite information qu’un cadran affiche en plus de l’heure : la date, la batterie, la météo. Narsil Watch en propose une, nommée **Claude 5 h**. Elle met la limite de 5 heures de Claude sur tout cadran qui a un emplacement libre pour elle, si bien que vous voyez la part consommée chaque fois que vous regardez l’heure.

Elle existe sous deux formes, et c’est le cadran qui choisit :

- **Un arc**, le type `RANGED_VALUE` : un anneau ou une barre rempli de 0 à 100 %, avec `62%` comme texte et `5h` comme titre. Sa couleur passe du vert au jaune puis au rouge à mesure que la limite se remplit.
- **Un texte court**, le type `SHORT_TEXT` : juste `62%` avec le titre `5h`, dans le style qu’utilise le cadran.

Un toucher dessus ouvre l’application. Tant que la montre n’a pas lu un état avec des limites, elle n’affiche rien : l’aspect « aucune donnée » du cadran.

Pour l’ajouter, ouvrez l’éditeur du cadran sur la montre, choisissez un emplacement de complication, et sélectionnez **Claude 5 h** dans la liste de l’application Narsil.

> **Expérimental.** La complication montre le chiffre de 5 heures du dernier état que la montre a gardé, et elle n’indique aucun âge. Le mod ne publie cet état que pendant que vous travaillez loin de l’ordinateur, dans la marge quotidienne gratuite de ntfy.sh, et la montre le demande au plus toutes les 15 minutes. Un chiffre d’hier ressemble toujours à un chiffre de maintenant ; ouvrez l’application ou la tuile pour voir quel âge il a.

## Comment ça marche à l’intérieur

Tout se trouve dans `complication/LimitComplicationService.kt`, 65 lignes. C’est une source de données : le cadran lui demande des données, et elle répond à partir de l’état gardé sur la montre.

### Une source de données que le système interroge

Sur Wear OS, un cadran n’appelle pas votre application. C’est le système qui le fait, pour le compte du cadran, par un service que votre application déclare. Le manifeste déclare celui-ci :

```xml
<service
    android:name=".complication.LimitComplicationService"
    android:exported="true"
    android:icon="@mipmap/ic_launcher"
    android:label="@string/complication_label"
    android:permission="com.google.android.wearable.permission.BIND_COMPLICATION_PROVIDER">
    <intent-filter>
        <action android:name="android.support.wearable.complications.ACTION_COMPLICATION_UPDATE_REQUEST" />
    </intent-filter>
    <meta-data
        android:name="android.support.wearable.complications.SUPPORTED_TYPES"
        android:value="RANGED_VALUE,SHORT_TEXT" />
    <meta-data
        android:name="android.support.wearable.complications.UPDATE_PERIOD_SECONDS"
        android:value="900" />
</service>
```

Cet extrait vient de `app/src/main/AndroidManifest.xml` dans narsil-watch (GPL v3). Chaque partie a un rôle :

- **`BIND_COMPLICATION_PROVIDER`** : seul le système peut se lier au service. Il est exporté pour que le système puisse l’atteindre, et protégé pour que rien d’autre ne le puisse.
- **`ACTION_COMPLICATION_UPDATE_REQUEST`** : l’action que le système utilise pour demander des données.
- **`SUPPORTED_TYPES`** : les deux formes qu’il propose, `RANGED_VALUE` et `SHORT_TEXT`. L’éditeur du cadran ne montre la complication que pour les emplacements qui acceptent l’une d’elles.
- **`UPDATE_PERIOD_SECONDS`** : 900 secondes, 15 minutes, le même rythme que le rafraîchissement.
- **Le libellé**, `@string/complication_label`, vaut `Claude 5 h` dans `res/values/strings.xml`. C’est le nom dans la liste de l’éditeur.

### Répondre à partir de l’état stocké

Le service étend `SuspendingComplicationDataSourceService`, de la bibliothèque des sources de données de complications, si bien que sa réponse est une fonction Kotlin `suspend`. D’après `LimitComplicationService.kt` dans narsil-watch (GPL v3) :

```kotlin
// Claude's 5-hour limit on the watch face: an arc that turns yellow at 60 %
// and red at 85 %, as Narsil colors it.
class LimitComplicationService : SuspendingComplicationDataSourceService() {
    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
        val limit = StatusRepository(this).cached()?.limits?.find { it.key == "fiveHour" }
            ?: return NoDataComplicationData()
        return data(request.complicationType, limit)
    }

    override fun getPreviewData(type: ComplicationType): ComplicationData? =
        data(type, Limit("fiveHour", "5 horas", 62.0, "#F5B400"))
```

Deux choses à remarquer :

- **Pas de réseau.** `onComplicationRequest` lit `cached()`, l’état gardé par `StatusRepository` ([guide 2](/fr/watch/reading-the-state/)). Comme la tuile, la complication n’attend jamais ntfy.sh. Le système peut demander souvent, et la réponse est toujours immédiate.
- **Pas de limite, pas de données.** Sans état gardé, ou avec un état qui n’a pas de ligne `fiveHour` (un mod plus ancien, ou Claude Code ne l’a pas encore signalée), la réponse est `NoDataComplicationData()`. Le cadran affiche alors son aspect vide au lieu d’un faux 0 %.

`getPreviewData` est ce que dessine l’éditeur du cadran pendant que vous choisissez une complication : une limite inventée à 62 %, avec le libellé `5 horas` (5 heures), en jaune. C’est un exemple fixe, si bien que l’éditeur montre quelque chose de parlant avant même la première lecture.

### RANGED_VALUE ou SHORT_TEXT

`data(type, limit)` construit la réponse pour le type que le cadran a demandé. Les parties communes d’abord :

```kotlin
val percent = limit.percent.coerceIn(0.0, 100.0).toFloat()
val value = PlainComplicationText.Builder("${percent.toInt()}%").build()
val title = PlainComplicationText.Builder("5h").build()
val description = PlainComplicationText.Builder("Claude, límite de 5 horas: ${percent.toInt()} %").build()
```

- **Le pourcentage est borné entre 0 et 100** et transformé en `Float`, le type qu’accepte la valeur à plage.
- **`value`** est le texte `62%`, un nombre entier.
- **`title`** vaut `5h`, assez court pour les plus petits emplacements.
- **`description`** est la description du contenu, ce que dit un lecteur d’écran : `Claude, límite de 5 horas: 62 %` (Claude, limite de 5 heures : 62 %). Les deux constructeurs en exigent une. C’est la version accessible de la complication.

Un toucher mène à l’application par un `PendingIntent` vers `MainActivity`, avec `FLAG_IMMUTABLE` (personne ne peut modifier l’intent) et `FLAG_UPDATE_CURRENT`.

Puis les deux formes :

```kotlin
return when (type) {
    ComplicationType.RANGED_VALUE ->
        RangedValueComplicationData.Builder(percent, 0f, 100f, description)
            .setText(value)
            .setTitle(title)
            // seven equal steps (the most a ramp takes): green to 57 %,
            // yellow to 86 %, red after, close to Narsil's 60 / 85
            .setColorRamp(ColorRamp(intArrayOf(GREEN, GREEN, GREEN, GREEN, YELLOW, YELLOW, RED), false))
            .setTapAction(tap)
            .build()
    ComplicationType.SHORT_TEXT ->
        ShortTextComplicationData.Builder(value, description)
            .setTitle(title)
            .setTapAction(tap)
            .build()
    else -> null
}
```

Les deux extraits viennent de `LimitComplicationService.kt` (GPL v3).

**`RANGED_VALUE`** prend une valeur, un minimum et un maximum : `percent`, `0f`, `100f`. Le cadran dessine lui-même l’arc ou la barre, dans son propre style. Ce que l’application ajoute, c’est une **rampe de couleurs**, les couleurs que doit prendre la partie remplie à mesure que la valeur augmente.

**`SHORT_TEXT`** ne prend que le texte et la description, avec le titre. Pas de couleur : c’est le cadran qui décide de l’aspect du texte.

**Tout autre type** reçoit `null`. Le manifeste ne propose que ces deux-là, si bien que le système ne devrait jamais en demander un autre, et `null` est la réponse honnête s’il le fait.

### Pourquoi la rampe est proche de 60 et 85, sans y être exactement

La tuile peint chaque limite avec la couleur que l’ordinateur a envoyée ([guide 3](/fr/watch/tile/)). La complication ne le peut pas : une valeur à plage n’a pas de champ « couleur de cette valeur ». Elle prend une rampe, une liste de couleurs réparties sur la plage, et le cadran choisit la couleur selon la valeur.

Le commentaire du code explique son choix. Avec `interpolated` à `false`, la rampe est découpée en paliers égaux, un par couleur ; sept est « the most a ramp takes » (le maximum qu’accepte une rampe). Avec sept paliers sur 0–100, chacun couvre environ 14,3 %. Quatre verts, deux jaunes et un rouge donnent :

| Plage de la limite de 5 heures | Couleur | Hex          |
| ------------------------------ | ------- | ------------ |
| De 0 % à environ 57 %          | Vert    | `0xFF22B573` |
| D’environ 57 % à environ 86 %  | Jaune   | `0xFFF5B400` |
| D’environ 86 % à 100 %         | Rouge   | `0xFFF0435A` |

La règle propre de Narsil, `levelColor` dans `hooks/usage.ts` de narsil-pet, passe au jaune à 60 % et au rouge à 85 %. Entre 57 % et 60 %, la complication est donc déjà jaune alors que la tuile est encore verte ; et à exactement 85 %, la tuile est rouge alors que la complication est encore jaune. Trois points au plus, aux bords. Les trois couleurs elles-mêmes ont les mêmes valeurs hexadécimales que celles de `levelColor`, si bien que la complication ressemble au reste de Narsil.

Le commentaire de la classe, « an arc that turns yellow at 60 % and red at 85 % » (un arc qui passe au jaune à 60 % et au rouge à 85 %), décrit l’intention ; le commentaire de la rampe, à côté, décrit ce que fait le code.

### Comment la complication est priée de se mettre à jour

Le système demande de nouvelles données à une source de deux façons, et cette application utilise les deux.

1. **Selon un calendrier.** `UPDATE_PERIOD_SECONDS` vaut 900 dans le manifeste, si bien que le système peut demander toutes les 15 minutes. C’est une requête au service, qui répond à partir de l’état gardé.
2. **À la demande.** Quand l’application a du nouveau, elle demande au système de rappeler le service. C’est `Refresh.redraw` dans `sync/Refresh.kt` (GPL v3) :

```kotlin
fun redraw(context: Context) {
    TileService.getUpdater(context).requestUpdate(NarsilTileService::class.java)
    ComplicationDataSourceUpdateRequester
        .create(context, ComponentName(context, LimitComplicationService::class.java))
        .requestUpdateAll()
}
```

`ComplicationDataSourceUpdateRequester.create(...)` désigne cette source de données par son composant, et `requestUpdateAll()` demande au système de réclamer des données fraîches pour chaque emplacement où elle s’affiche, sur chaque cadran. La même fonction demande à la tuile de se redessiner.

`redraw` est appelé à la fin de chaque rafraîchissement en arrière-plan, par `RefreshWorker`, et après chaque rafraîchissement dans l’application ([guide 5](/fr/watch/app-and-refresh/)). L’ordre est donc toujours : récupérer l’état, le garder, puis prévenir les surfaces. Quand le système appelle `onComplicationRequest`, le nouvel état est déjà dans `cached()`.

Le calendrier seul suffirait à faire avancer le chiffre toutes les 15 minutes. C’est la requête à la demande qui le fait changer tout de suite après que vous avez touché **Actualizar** (actualiser) dans l’application.

## Le construire avec Claude

Demandez à Claude une source de données de complication pour un seul pourcentage. Les idées que Claude doit bien saisir : elle répond à partir de données stockées, elle propose à la fois une valeur à plage et un texte court, et « aucune donnée » est une vraie réponse.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon application Wear OS `my-watch`, ajoute une source de données de complication `LimitComplicationService` qui étend `SuspendingComplicationDataSourceService`. Dans `onComplicationRequest`, lis la limite de 5 heures depuis mon `StatusRepository.cached()` (une `Limit` avec `key` `fiveHour` et `percent`), et renvoie `NoDataComplicationData()` quand il n’y en a pas. Prends en charge `RANGED_VALUE` (valeur bornée entre 0 et 100, min 0, max 100, un texte comme `62%`, le titre `5h`, une `ColorRamp` non interpolée de sept couleurs : quatre vertes `0xFF22B573`, deux jaunes `0xFFF5B400`, une rouge `0xFFF0435A`) et `SHORT_TEXT` (le même texte et le même titre) ; renvoie `null` pour les autres types. Donne aux deux une description de contenu, et une action au toucher qui ouvre `MainActivity` avec un `PendingIntent` immuable. Fournis `getPreviewData` avec un exemple à 62 %. Déclare-la dans le manifeste avec `BIND_COMPLICATION_PROVIDER`, `SUPPORTED_TYPES` `RANGED_VALUE,SHORT_TEXT` et `UPDATE_PERIOD_SECONDS` 900, et après chaque rafraîchissement appelle `ComplicationDataSourceUpdateRequester.create(...).requestUpdateAll()`.

### Ce qu’il faut vérifier dans la réponse de Claude

1. `onComplicationRequest` lit l’état stocké et ne fait aucune requête réseau.
2. Sans limite, il renvoie `NoDataComplicationData()`, pas un 0 %.
3. La valeur est bornée entre 0 et 100 avant de devenir la valeur à plage.
4. Chaque forme a une description de contenu, le texte d’un lecteur d’écran.
5. Le `PendingIntent` est `FLAG_IMMUTABLE`.
6. Les `SUPPORTED_TYPES` du manifeste listent exactement les types que construit le code.
7. Quelque chose appelle `requestUpdateAll()` après que les nouvelles données sont gardées, pas avant.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « la complication indique 0 % juste après l’installation de l’application », ce qui veut dire que l’absence de données est rendue comme un zéro.

### Comment l’auteur l’a demandé

Aucune demande consignée n’existe pour la complication. Voici une reconstitution à partir de l’historique des commits :

- narsil-watch `b47ca7a` (2026-11-23) « feat: Narsil on Wear OS with Claude limits and open conversations » (Narsil sur Wear OS avec les limites de Claude et les conversations ouvertes). La complication arrive avec le reste de l’application. Son message la nomme en une expression : « a 5-hour complication » (une complication de 5 heures).
- narsil-watch `04390c8` (2026-11-24) « docs: align README with the Narsil family » (aligner le README sur la famille Narsil). Le README la décrit : « The **Claude 5 h** complication shows the 5-hour limit on any watch face, as an arc (`RANGED_VALUE`) or as a short text. » (la complication **Claude 5 h** affiche la limite de 5 heures sur n’importe quel cadran, en arc, `RANGED_VALUE`, ou en texte court).

Seule la limite de 5 heures a eu une complication. Le code ne dit pas pourquoi ; le commentaire de la classe l’appelle « Claude's 5-hour limit on the watch face » (la limite de 5 heures de Claude sur le cadran), et c’est la limite qui change le plus vite. La limite hebdomadaire est sur la tuile et dans l’application.

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide. Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

Une complication pour la limite hebdomadaire, écrite pour ce guide et adaptée de `LimitComplicationService.kt` dans [narsil-watch](https://github.com/davshn/narsil-watch) (GPL v3). Elle utilise les mêmes appels de bibliothèque, suppose les `StatusRepository` et `Limit` du dépôt, et ne propose que le texte court :

```kotlin
package com.example.mywatch.complication

import android.app.PendingIntent
import android.content.Intent
import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.NoDataComplicationData
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService
import com.example.mywatch.data.StatusRepository
import com.example.mywatch.domain.Limit
import com.example.mywatch.presentation.MainActivity

class WeekComplicationService : SuspendingComplicationDataSourceService() {
    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
        val limit = StatusRepository(this).cached()?.limits?.find { it.key == "week" }
            ?: return NoDataComplicationData()
        return data(request.complicationType, limit)
    }

    override fun getPreviewData(type: ComplicationType): ComplicationData? =
        data(type, Limit("week", "Semana", 40.0, "#22B573"))

    private fun data(type: ComplicationType, limit: Limit): ComplicationData? {
        if (type != ComplicationType.SHORT_TEXT) return null
        val percent = limit.percent.coerceIn(0.0, 100.0).toInt()
        val tap = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        return ShortTextComplicationData.Builder(
            PlainComplicationText.Builder("$percent%").build(),
            PlainComplicationText.Builder("Claude, límite semanal: $percent %").build(),
        )
            .setTitle(PlainComplicationText.Builder("sem").build())
            .setTapAction(tap)
            .build()
    }
}
```

Déclarez-la dans le manifeste comme la vraie, avec `SUPPORTED_TYPES` réglé sur `SHORT_TEXT` seulement, et ajoutez-la à `Refresh.redraw` avec son propre `ComplicationDataSourceUpdateRequester`.

## Erreurs fréquentes et comment tester

- **Récupérer des données dans `onComplicationRequest`.** Le système l’appelle quand il veut. Répondez à partir de l’état gardé.
- **Zéro pour « aucune donnée ».** Un faux 0 % donne l’impression d’avoir beaucoup de marge. `NoDataComplicationData()` est la réponse véridique.
- **Des types désaccordés.** Si le manifeste propose un type pour lequel le code renvoie `null`, l’emplacement reste vide.
- **Une rampe avec trop de couleurs.** Le commentaire du code dit que sept est le maximum qu’accepte une rampe.
- **S’attendre aux seuils exacts.** Avec sept paliers égaux, la rampe change vers 57 % et 86 %, pas à 60 % et 85 %.
- **Pas de description de contenu.** Les constructeurs en exigent une, et un lecteur d’écran en dépend.
- **Mettre à jour avant de garder.** Appelez `requestUpdateAll()` après que le nouvel état est stocké, sinon le système lit l’ancien.
- **Lire le chiffre comme s’il était en direct.** Il n’a pas d’âge. Quand c’est important, ouvrez la tuile ou l’application.

La complication n’a pas de test automatisé ; les tests unitaires couvrent l’état qu’elle lit ([guide 2](/fr/watch/reading-the-state/)). Sur la montre :

1. Ajoutez **Claude 5 h** à un emplacement qui accepte une valeur à plage. L’aperçu de l’éditeur montre 62 % en jaune.
2. Avant toute lecture, l’emplacement a l’air vide.
3. Lancez `/narsil movil prueba` dans Claude Code, puis ouvrez l’application et touchez **Actualizar**. L’emplacement devrait passer aussitôt à votre vrai chiffre de 5 heures.
4. Essayez un emplacement qui n’accepte que du texte court : le même chiffre, sans l’arc.

### Là où le code et le README diffèrent

- Le commentaire de la classe dit que l’arc « turns yellow at 60 % and red at 85 % » (passe au jaune à 60 % et au rouge à 85 %). La rampe qu’il construit change vers 57 % et 86 %, comme le dit le commentaire à côté de la rampe.
- Le README dit que la complication montre la limite « as an arc (`RANGED_VALUE`) or as a short text » (en arc, `RANGED_VALUE`, ou en texte court). C’est le cadran qui choisit, selon le type qu’accepte son emplacement.

## Pour aller plus loin

- Lisez `complication/LimitComplicationService.kt` dans [narsil-watch](https://github.com/davshn/narsil-watch).
- Une `RANGED_VALUE` avec `interpolated` à `true` fond les couleurs en dégradé au lieu de paliers. Vous échangeriez des seuils nets contre un dégradé ; essayez les deux sur votre cadran.
- L’état transporte `resetsAt` pour la limite de 5 heures. Une complication pourrait afficher « reinicia en 2 h » (se réinitialise dans 2 h) au lieu du pourcentage, avec `resetLabel` de `Display.kt`.
- Retour à [la tuile](/fr/watch/tile/), ou à la façon dont l’état est lu : [Lire l’état de Narsil](/fr/watch/reading-the-state/).
- Ensuite : [L’application et le rafraîchissement](/fr/watch/app-and-refresh/), la liste des conversations, la configuration et la tâche des 15 minutes.
