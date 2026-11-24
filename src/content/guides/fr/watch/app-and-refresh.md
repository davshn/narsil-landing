---
title: L’application et le rafraîchissement
description: 'L’application de la montre avec chaque conversation, les deux limites et le niveau de Narsil ; le sujet et la clé, sur la montre ou depuis le PC ; le rafraîchissement de 15 min, les redessins, la CI.'
route: watch
order: 5
updated: 2026-11-24
sources:
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/presentation/MainActivity.kt
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/sync/Refresh.kt
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/NarsilApplication.kt
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/domain/Display.kt
  - repo: watch
    path: .github/workflows/ci.yml
  - repo: watch
    path: app/src/test/kotlin/tech/davshn/narsilwatch/domain/DisplayTest.kt
  - repo: watch
    path: README.md
---

## Ce que ça fait

La tuile et la complication servent à un coup d’œil. L’application, nommée **Narsil** dans la liste des applications de la montre, sert quand vous voulez la vue d’ensemble. C’est une seule liste qui défile :

1. **Narsil en haut**, dans la pose de votre conversation la plus importante, avec son nom et son niveau, comme `⭐ Nivel 3 · 40/300 XP` (niveau 3, 40 points d’expérience sur 300).
2. **Une note**, seulement quand quelque chose ne va pas : pas encore d’état, ou un état scellé que la montre ne peut pas ouvrir.
3. **`Límites de Claude`** (les limites de Claude) : une ligne par limite, `5 horas` (5 heures) et `Semana` (semaine), chacune avec son pourcentage, une barre colorée, et quand elle se réinitialise, comme `reinicia en 2 h 05 min` (se réinitialise dans 2 h 05 min).
4. **`Conversaciones`** (conversations) : chaque conversation ouverte que le mod a envoyée, la plus importante d’abord, chacune avec un point coloré, son titre et son état, comme `TE NECESITA` (a besoin de vous). Sans conversation, l’en-tête indique `Sin conversaciones` (aucune conversation).
5. **L’âge de la lecture**, comme `hace 12 min` (il y a 12 minutes).
6. **Deux boutons** : `Actualizar` (actualiser), qui indique `Leyendo…` (lecture en cours) pendant qu’il travaille, et `Configurar` (configurer).

En coulisses, une tâche en arrière-plan demande un nouvel état à ntfy.sh toutes les 15 minutes et redessine la tuile et la complication. Ce guide couvre les deux, ainsi que la CI et les tests du projet.

> **Expérimental.** L’application ne montre que ce que le mod a publié en dernier, et le mod ne publie que pendant que vous travaillez loin de l’ordinateur, dans la marge quotidienne gratuite de ntfy.sh. Le rafraîchissement en arrière-plan s’exécute au plus toutes les 15 minutes, l’intervalle le plus court de WorkManager. L’application s’installe comme version de débogage par `adb`, et le sujet et la clé se règlent à la main.

## Comment ça marche à l’intérieur

### Une activité, écrite avec Compose pour Wear OS

`presentation/MainActivity.kt` contient toute l’application : une `ComponentActivity` et une poignée de fonctions composables. Elle utilise Compose pour Wear OS avec Material 3 : `AppScaffold`, `ScreenScaffold`, et une `ScalingLazyColumn`, la liste qui réduit et estompe les éléments près des bords de l’écran rond.

Les couleurs sont un `ColorScheme` Material 3 construit à partir de `Palette` dans `domain/Display.kt` : le fond bleu sombre, le texte clair, le gris atténué, la piste et l’accent violet. L’application, la tuile et la complication partagent ainsi un même jeu de couleurs.

`onCreate` fait trois choses, dans l’ordre :

```kotlin
override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val repo = StatusRepository(this)
    setupFrom(intent, repo)
    setContent {
        MaterialTheme(colorScheme = NarsilColors) {
            AppScaffold { NarsilScreen(repo) }
        }
    }
}
```

Cet extrait et les autres de cette section viennent de `MainActivity.kt` dans narsil-watch (GPL v3). `setupFrom` lit un sujet et une clé envoyés depuis l’ordinateur, s’il y en a (voir plus bas). Ensuite, l’écran est dessiné.

### La configuration d’abord, ou la liste

`NarsilScreen` garde son état dans quelques valeurs `remember` : si la configuration est affichée, l’état gardé, l’image, la note du moment, et si un rafraîchissement est en cours. La première ligne décide de ce que vous voyez :

```kotlin
var isSetup by remember { mutableStateOf(!repo.isConfigured) }
```

`isConfigured` est vrai dès qu’un sujet est enregistré. La première fois que vous ouvrez l’application, elle affiche donc **Configurar**, et toutes les fois suivantes, la liste.

Un `LaunchedEffect(isSetup)` exécute `refresh()` chaque fois que la liste apparaît : quand vous ouvrez l’application, et juste après que vous avez enregistré la configuration. C’est le « rafraîchissement à l’ouverture ». Il appelle directement le dépôt, dans la portée de coroutines de l’écran :

```kotlin
fun refresh() {
    isLoading = true
    scope.launch {
        val result = repo.refresh()
        problem = when (result) {
            is StatusResult.Ok -> null
            StatusResult.NeedsKey -> "El estado va sellado: falta la clave o no es la de /narsil movil clave."
            StatusResult.Empty -> "Aún no hay estado: Narsil lo publica cuando escribes lejos del PC."
        }
        state = repo.cached()
        art = repo.art()
        isLoading = false
        Refresh.redraw(repo.appContext)
    }
}
```

Ce que chaque résultat veut dire à l’écran :

- **`Ok`** : pas de note.
- **`NeedsKey`** : `El estado va sellado: falta la clave o no es la de /narsil movil clave.` (l’état est scellé : la clé manque ou ce n’est pas celle de /narsil movil clave).
- **`Empty`** : `Aún no hay estado: Narsil lo publica cuando escribes lejos del PC.` (pas encore d’état : Narsil le publie quand vous écrivez loin du PC).

Après n’importe quel résultat, l’écran recharge l’état et l’image gardés, et appelle `Refresh.redraw`, pour que la tuile et la complication rattrapent ce que l’application vient de lire. Le [guide 2](/fr/watch/reading-the-state/) explique pourquoi une erreur réseau donne `Ok` avec l’état gardé : être hors ligne n’est pas une erreur que l’application affiche.

`Empty` peut s’afficher au-dessus d’un état. Si ntfy.sh ne garde plus de message (un commentaire de narsil-pet dit qu’il « keeps a message 12 h », garde un message 12 h), l’interrogation revient vide, mais la montre a toujours sa copie gardée. Vous voyez les deux : l’ancien état, et la note qui dit qu’il n’y a rien de nouveau.

### Les limites, avec « reinicia en »

`LimitRow` dessine une limite : le libellé à gauche, le pourcentage à droite dans la couleur de la limite (`62 %`), une barre de 6 dp avec la partie utilisée dans cette couleur sur la piste, et, en dessous, quand elle se réinitialise. La couleur est `parseColor(limit.color)`, la couleur que l’ordinateur a envoyée ([guide 3](/fr/watch/tile/)).

Le texte de réinitialisation est `resetLabel` de `domain/Display.kt` (GPL v3) :

```kotlin
fun resetLabel(resetsAt: Long?, nowSeconds: Long): String {
    if (resetsAt == null) return ""
    if (resetsAt <= nowSeconds) return "reiniciado"
    val minutes = (resetsAt - nowSeconds) / 60
    return when {
        minutes < 60 -> "reinicia en $minutes min"
        minutes < 24 * 60 -> "reinicia en ${minutes / 60} h ${(minutes % 60).toString().padStart(2, '0')} min"
        else -> "reinicia en ${minutes / (24 * 60)} d ${(minutes % (24 * 60)) / 60} h"
    }
}
```

- **Pas d’heure de réinitialisation** (`null`, Claude ne l’a pas dit) : pas de ligne du tout. La ligne la masque quand le texte est vide.
- **Dans l’heure** : `reinicia en 45 min`.
- **Dans la journée** : `reinicia en 2 h 05 min`, les minutes complétées à deux chiffres.
- **Plus loin** : `reinicia en 3 d 4 h`, la forme que prend d’habitude une limite hebdomadaire.
- **Déjà passée** : `reiniciado` (réinitialisée).

Ce dernier cas est la ligne la plus utile de l’application. Le pourcentage au-dessus vient du dernier état, qui peut dater de plusieurs heures. Si l’heure de réinitialisation est passée, la fenêtre a recommencé, et le pourcentage affiché n’est plus vrai. `reiniciado` vous le dit. Le test « says when a limit resets » (dit quand une limite se réinitialise) de `DisplayTest.kt` vérifie les cinq cas.

### Les conversations, avec leurs états

`SessionRow` dessine une conversation sous forme de ligne arrondie : un point de 8 dp dans la couleur de l’état, le titre sur une ligne (coupé par des points de suspension s’il est long), et le libellé de l’état en dessous, dans la même couleur, en gras. Les couleurs sont celles de `statusColor` dans `Display.kt` : bleu pour `TRABAJANDO` (au travail), gris pour `PARADA` (à l’arrêt), jaune pour `TE NECESITA` (a besoin de vous), vert pour `TERMINADA` (terminée) et rouge pour `ERROR`.

Les lignes arrivent dans l’ordre où le mod les a envoyées, qui est le classement du mod : les erreurs d’abord, puis ce qui a besoin de vous, ce qui travaille, ce qui a terminé, et ce qui est au repos ([guide 2](/fr/watch/reading-the-state/)). Au plus 8, avec des titres d’au plus 40 caractères, tels que `watchSessions` dans `hooks/phone.ts` de narsil-pet les coupe. L’application n’ajoute aucun ordre à elle, si bien qu’elle est toujours d’accord avec la bande sur votre ordinateur.

### Le niveau de Narsil

`NarsilHeader` montre l’image (48 sur 80 dp), le nom **Narsil** en gras, et le texte `xp` de l’état. L’image est celle que le dépôt a téléchargée depuis le GitHub de narsil-pet, décodée avec `BitmapFactory` ; s’il n’y en a pas encore, ou si elle ne se décode pas, c’est le dessin livré `narsil_preview`. Le texte `xp` est écrit par le mod, si bien que le niveau, l’expérience et les étoiles sont exactement ceux de l’ordinateur.

### Configurar : la configuration sur la montre

`SetupScreen` a deux champs et un bouton :

- **`El tema de /narsil movil`** (le sujet de /narsil movil), avec l’indication `narsil-…`.
- **`La clave, si usas /narsil movil clave`** (la clé, si vous utilisez /narsil movil clave), avec l’indication `opcional` (facultatif).
- **`Guardar`** (enregistrer), activé seulement quand le sujet n’est pas vide.

Les champs sont des `BasicTextField` Compose, d’une ligne chacun, remplis avec ce qui est déjà enregistré. `Guardar` enregistre les deux par le dépôt, qui retire les espaces autour, et revient à la liste, qui se rafraîchit. Pour retirer la clé, videz le champ et enregistrez.

La configuration ne vérifie rien d’autre. Un sujet avec une faute de frappe s’enregistre sans problème, et la liste dit ensuite `Aún no hay estado`. Une erreur est pardonnée, toutefois : le dépôt n’ajoute `-estado` que si le sujet ne se termine pas déjà ainsi ([guide 2](/fr/watch/reading-the-state/)), si bien que coller par erreur le sujet d’état fonctionne quand même.

Saisir une clé de 43 caractères sur un clavier de montre est lent. C’est pourquoi il existe un second moyen.

### Régler le sujet et la clé depuis l’ordinateur

`setupFrom` lit deux extras de l’intent qui a démarré l’activité :

```kotlin
// Setup from the PC, without typing on the watch:
// adb shell am start -n tech.davshn.narsilwatch/.presentation.MainActivity --es topic narsil-... --es key ...
private fun setupFrom(intent: Intent?, repo: StatusRepository) {
    val topic = intent?.getStringExtra("topic") ?: return
    repo.topic = topic
    intent.getStringExtra("key")?.let { repo.key = it }
    Refresh.now(this)
}
```

Ainsi, avec la montre connectée par `adb` sans fil ([guide 1](/fr/watch/what-it-is/)), vous pouvez envoyer les deux en une seule commande. Avec des valeurs inventées :

```bash
adb shell am start -n tech.davshn.narsilwatch/.presentation.MainActivity --es topic narsil-0000000000example0 --es key example-key-not-real
```

`am start -n` démarre l’activité nommée, et chaque `--es name value` ajoute un extra de type chaîne. Ce que le code en fait :

- **Pas d’extra `topic`, il ne se passe rien.** La fonction s’arrête aussitôt, si bien qu’un lancement normal depuis la liste des applications ne change rien.
- **`topic` sans `key`** enregistre le sujet et laisse la clé enregistrée telle qu’elle était.
- **`--es key ""`** enregistre une clé vide, ce qui la retire.
- **Ensuite `Refresh.now`** met en file un rafraîchissement en arrière-plan, et la tuile et la complication se redessinent quand il se termine.

Comme `setupFrom` ne s’exécute que dans `onCreate`, et que l’activité ne gère pas les nouveaux intents, fermez l’application sur la montre avant d’envoyer la commande. Sinon, Android peut ramener l’application ouverte au premier plan sans lire les extras.

Deux remarques sur les secrets :

- **Où ils finissent.** Sur la montre, dans les préférences privées de l’application ([guide 2](/fr/watch/reading-the-state/)). Sur l’ordinateur, la commande, clé comprise, reste dans l’historique de votre shell. Effacez cette ligne si d’autres personnes utilisent la machine.
- **Ce qu’ils permettent et comment les renouveler.** Le sujet permet à n’importe qui de lire votre sujet ntfy et d’y publier ; la clé ouvre les messages scellés. `/narsil movil nuevo` crée un nouveau sujet, et `/narsil movil clave` une nouvelle clé ; envoyez les nouveaux avec la même commande.

L’activité est exportée, comme doit l’être toute activité de lancement, pour que le système puisse la démarrer. C’est vrai pour toute application de la montre : tout ce qui peut démarrer des activités peut démarrer celle-ci avec un extra `topic`.

### Le rafraîchissement : sync/Refresh.kt

Trois fonctions et un worker. D’après `sync/Refresh.kt` dans narsil-watch (GPL v3) :

```kotlin
// Every 15 minutes (WorkManager's shortest), the watch asks ntfy.sh for the
// state and redraws the tile and the complication.
class RefreshWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        StatusRepository(applicationContext).refresh()
        Refresh.redraw(applicationContext)
        return Result.success()
    }
}

object Refresh {
    private const val PERIODIC = "narsil-refresh"
    private const val NOW = "narsil-refresh-now"

    private val online = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

    fun schedule(context: Context) {
        val work = PeriodicWorkRequestBuilder<RefreshWorker>(15, TimeUnit.MINUTES).setConstraints(online).build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP, work)
    }

    fun now(context: Context) {
        val work = OneTimeWorkRequestBuilder<RefreshWorker>().setConstraints(online).build()
        WorkManager.getInstance(context).enqueueUniqueWork(NOW, ExistingWorkPolicy.KEEP, work)
    }
```

À la lecture :

- **`RefreshWorker`** récupère l’état ([guide 2](/fr/watch/reading-the-state/)), puis demande à la tuile et à la complication de se redessiner (le [guide 4](/fr/watch/complication/) montre `redraw`). C’est un `CoroutineWorker`, si bien que `refresh()`, une fonction `suspend`, s’y exécute naturellement.
- **Il signale toujours un succès.** Une récupération ratée n’est pas réessayée avec le délai progressif de WorkManager ; la période suivante essaie simplement de nouveau. Le dépôt garde déjà le dernier bon état, si bien qu’il n’y a rien à récupérer.
- **`online`** : les deux sortes de travail attendent une connexion réseau. Hors ligne, WorkManager retient la tâche jusqu’à ce que la montre soit connectée, plutôt que de l’exécuter pour qu’elle échoue.
- **`schedule`** : une tâche périodique toutes les 15 minutes, la répétition la plus courte que permet WorkManager. Elle est unique par son nom, `narsil-refresh`, avec la politique `KEEP` : s’il y en a déjà une de planifiée, la nouvelle demande est abandonnée. Appeler `schedule` à chaque démarrage n’empile donc jamais les tâches et ne remet jamais le minuteur à zéro.
- **`now`** : un rafraîchissement dès que possible, unique sous le nom `narsil-refresh-now`, lui aussi avec `KEEP`. Plusieurs appels d’affilée, comme balayer plusieurs fois jusqu’à la tuile, n’en mettent qu’un en file.

### NarsilApplication : là où le calendrier démarre

Le fichier entier, sans son package ni ses imports, d’après `NarsilApplication.kt` (GPL v3) :

```kotlin
class NarsilApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        Refresh.schedule(this)
    }
}
```

Le manifeste la désigne comme classe d’application (`android:name=".NarsilApplication"`). `Application.onCreate` s’exécute chaque fois que le processus de l’application démarre, pour quelque raison que ce soit : ouvrir l’application, le système qui se lie à la tuile, ou qui demande des données à la complication. La tâche périodique est donc planifiée dès qu’une partie quelconque de l’application s’exécute et, grâce à `KEEP`, planifiée une seule fois.

### Ce qui s’exécute, et quand

En assemblant les pièces :

| Moment                                                                       | Ce qui se passe                                                                             |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Une partie quelconque de l’application démarre                               | `NarsilApplication` planifie la tâche des 15 minutes, une seule fois.                       |
| Toutes les 15 minutes, avec un réseau                                        | `RefreshWorker` récupère, garde, et redessine la tuile et la complication.                  |
| Vous ouvrez l’application (sujet réglé)                                      | L’écran récupère directement, affiche le résultat, et redessine les deux.                   |
| Vous touchez `Actualizar`                                                    | La même chose qu’à l’ouverture.                                                             |
| Vous enregistrez sous `Configurar`                                           | La liste apparaît et récupère.                                                              |
| Vous envoyez le sujet avec `adb shell am start`                              | `Refresh.now` met en file un rafraîchissement ; l’écran récupère aussi quand il apparaît.   |
| La tuile est dessinée et la dernière vérification date de plus de 15 minutes | `Refresh.now` met en file un rafraîchissement ; la tuile dessine l’état gardé en attendant. |
| Le calendrier de 900 secondes du système pour la complication                | La complication répond à partir de l’état gardé, sans récupérer.                            |

Chaque chemin se termine de la même façon : récupérer, garder, puis redessiner. Et aucune surface n’attend jamais le réseau pour se dessiner.

### La CI et les tests unitaires

`.github/workflows/ci.yml` s’exécute à chaque push sur `main` et à chaque pull request. Un seul job, sur `ubuntu-latest` :

1. `actions/checkout@v4`.
2. `actions/setup-java@v4` avec Temurin, Java 17.
3. `gradle/actions/setup-gradle@v4`.
4. `./gradlew :app:testDebugUnitTest :app:assembleDebug --console=plain`.

Chaque changement doit donc passer les tests unitaires et compiler un APK de débogage. Il n’y a pas d’étape de lint, pas de build de release et pas de test sur appareil. Le wrapper Gradle fixe Gradle 9.9.2 avec un `distributionSha256Sum`, si bien que le Gradle téléchargé est vérifié avant de s’exécuter, et `gradle.properties` active le cache de build et le cache de configuration.

Les tests unitaires sont du JUnit 4 simple, sur la JVM de l’ordinateur, sans appareil Android. Trois fichiers, treize tests :

- **`domain/DisplayTest.kt`** (5) : « counts the conversations that need you » (compte les conversations qui ont besoin de vous), « says how old the state is » (dit l’âge de l’état), « says when a limit resets » (dit quand une limite se réinitialise), « colors a status as Narsil does » (colore un état comme le fait Narsil), « reads a level color, and falls back to dim on noise » (lit une couleur de niveau, et se rabat sur le gris atténué en cas de bruit).
- **`data/StatusParserTest.kt`** (4) : lire un état en clair, lire un ancien état sans `limits` ni `sessions`, un état scellé qui a besoin de la clé, et un sujet vide ou du bruit.
- **`data/SealTest.kt`** (4) : ouvrir un vecteur scellé par le `seal.ts` de narsil-pet lui-même, refuser une autre clé, refuser un message altéré, refuser ce qui n’est pas scellé.

Ils peuvent s’exécuter sans appareil parce que la logique a été tenue à l’écart des classes Android : `Display.kt`, `NarsilState.kt`, `StatusParser.kt` et `Seal.kt` n’utilisent que Kotlin, kotlinx.serialization et la bibliothèque standard Java. Les écrans, la tuile, la complication et le rafraîchissement ne sont pas testés automatiquement.

## Le construire avec Claude

Demandez à Claude la liste de l’application, sa configuration et le rafraîchissement en arrière-plan ensemble, puisqu’ils partagent le dépôt. Les idées que Claude doit bien saisir : chaque rafraîchissement se termine en redessinant les autres surfaces, et la planification est idempotente.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon application Wear OS `my-watch` (Compose pour Wear OS, Material 3), écris `presentation/MainActivity.kt` : si aucun sujet n’est enregistré, affiche un écran de configuration avec un champ pour le sujet, un champ facultatif pour la clé et un bouton Enregistrer activé seulement avec un sujet ; sinon une `ScalingLazyColumn` avec l’image et le niveau, les limites (libellé, pourcentage dans la couleur de la limite, une barre, et une ligne de réinitialisation tirée d’une fonction pure `resetLabel(resetsAt, now)` qui dit « reiniciado » une fois l’heure passée), les sessions dans l’ordre reçu (un point dans la couleur de l’état, le titre, le libellé), l’âge, et des boutons Actualiser et Configurer. Rafraîchis quand la liste apparaît et avec le bouton, affiche une note pour « pas encore d’état » et « a besoin de la clé », puis redessine la tuile et la complication. Dans `onCreate`, lis des extras de type chaîne facultatifs `topic` et `key` pour que `adb shell am start ... --es topic ... --es key ...` les règle, puis mets en file un rafraîchissement. Écris `sync/Refresh.kt` : un `CoroutineWorker` qui rafraîchit et redessine ; `schedule` comme travail périodique unique toutes les 15 minutes avec `KEEP` et une contrainte de réseau connecté ; `now` comme travail ponctuel unique avec `KEEP` ; `redraw` avec `TileService.getUpdater` et `ComplicationDataSourceUpdateRequester.requestUpdateAll()`. Appelle `schedule` depuis une sous-classe d’`Application`. Des tests JUnit pour `resetLabel`, et un workflow de CI qui exécute `./gradlew :app:testDebugUnitTest :app:assembleDebug`.

### Ce qu’il faut vérifier dans la réponse de Claude

1. L’écran de configuration n’apparaît que quand aucun sujet n’est enregistré, et la liste se rafraîchit quand elle apparaît.
2. Chaque rafraîchissement, dans l’application et dans le worker, se termine par un redessin de la tuile et de la complication.
3. Le travail périodique est unique par son nom avec `KEEP`, et exige un réseau connecté.
4. Le rafraîchissement ponctuel est unique lui aussi, si bien que des appels répétés ne mettent qu’une tâche en file.
5. `resetLabel` renvoie « reiniciado » pour une réinitialisation passée et rien pour une absente, et a un test pour chaque cas.
6. Les extras de l’intent sont facultatifs : un lancement normal ne change rien, et un extra `key` absent garde la clé enregistrée.
7. Rien ne journalise le sujet ni la clé.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « après avoir touché Actualizar, l’application montre le nouvel état, mais la tuile montre toujours l’ancien », ce qui veut dire que le redessin manque dans le rafraîchissement de l’application.

### Comment l’auteur l’a demandé

Aucune demande consignée n’existe pour l’application ni pour le rafraîchissement. Voici une reconstitution à partir de l’historique des commits :

- narsil-watch `b47ca7a` (2026-11-23) « feat: Narsil on Wear OS with Claude limits and open conversations » (Narsil sur Wear OS avec les limites de Claude et les conversations ouvertes). L’application, le rafraîchissement, la classe d’application, le workflow de CI et les tests arrivent tous dans ce seul commit. Son message termine la liste des surfaces par « an app listing every open conversation » (une application qui liste chaque conversation ouverte).
- narsil-watch `04390c8` (2026-11-24) « docs: align README with the Narsil family » (aligner le README sur la famille Narsil). Le premier README avait déjà les deux moyens de régler le sujet et la clé, sous « Set up ». Ce commit renomme cette section « Settings », ajoute une section Security qui dit où le sujet et la clé sont gardés, et la ligne sur la mise à jour : « pull the latest version of this repository and run the same command again: the settings are kept. » (récupérez la dernière version de ce dépôt et relancez la même commande : les réglages sont conservés).

Le commentaire au-dessus de `setupFrom` garde dans le code lui-même la raison du chemin par `adb` : « Setup from the PC, without typing on the watch » (configuration depuis le PC, sans saisir sur la montre).

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide. Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

Le rafraîchissement et son démarrage, écrits pour ce guide et adaptés de `sync/Refresh.kt` et de `NarsilApplication.kt` dans [narsil-watch](https://github.com/davshn/narsil-watch) (GPL v3). Ils utilisent les mêmes appels WorkManager, Tiles et complications, et supposent vos propres `StatusRepository`, service de tuile et service de complication :

```kotlin
package com.example.mywatch.sync

import android.app.Application
import android.content.ComponentName
import android.content.Context
import androidx.wear.tiles.TileService
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceUpdateRequester
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit
import com.example.mywatch.complication.MyComplicationService
import com.example.mywatch.data.StatusRepository
import com.example.mywatch.tile.MyTileService

class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        StatusRepository(applicationContext).refresh()
        Sync.redraw(applicationContext)
        return Result.success()
    }
}

object Sync {
    private val online = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

    fun schedule(context: Context) {
        val work = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES).setConstraints(online).build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork("my-sync", ExistingPeriodicWorkPolicy.KEEP, work)
    }

    fun now(context: Context) {
        val work = OneTimeWorkRequestBuilder<SyncWorker>().setConstraints(online).build()
        WorkManager.getInstance(context).enqueueUniqueWork("my-sync-now", ExistingWorkPolicy.KEEP, work)
    }

    fun redraw(context: Context) {
        TileService.getUpdater(context).requestUpdate(MyTileService::class.java)
        ComplicationDataSourceUpdateRequester
            .create(context, ComponentName(context, MyComplicationService::class.java))
            .requestUpdateAll()
    }
}

class MyWatchApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        Sync.schedule(this)
    }
}
```

Désignez la classe d’application dans le `<application android:name=...>` du manifeste, comme le montre le [guide 1](/fr/watch/what-it-is/). Dans votre activité, lisez les extras de configuration avant de dessiner, ce qui est aussi écrit pour ce guide :

```kotlin
private fun setupFrom(intent: Intent?, repo: StatusRepository) {
    val topic = intent?.getStringExtra("topic") ?: return
    repo.topic = topic
    intent.getStringExtra("key")?.let { repo.key = it }
    Sync.now(this)
}
```

## Erreurs fréquentes et comment tester

- **Rafraîchir sans redessiner.** L’application montre le nouvel état et la tuile garde l’ancien. Terminez chaque rafraîchissement par `redraw`.
- **Planifier avec `REPLACE`.** Chaque démarrage du processus annulerait la tâche planifiée et en mettrait une nouvelle en file. `KEEP` laisse le calendrier existant tranquille, si bien que démarrer souvent ne change rien.
- **Demander moins de 15 minutes.** Le travail périodique de WorkManager ne se répète pas plus vite, comme le dit le commentaire du code.
- **Pas de contrainte de réseau.** La tâche s’exécute hors ligne pour échouer, et la prochaine occasion est dans 15 minutes.
- **Envoyer la commande `adb` à une application ouverte.** Les extras ne sont lus que dans `onCreate`. Fermez d’abord l’application.
- **Faire confiance au pourcentage après une réinitialisation.** Si la ligne dit `reiniciado`, le pourcentage au-dessus date d’avant la réinitialisation.
- **Une vraie clé dans un terminal partagé.** Elle reste dans l’historique du shell. Utilisez l’écran de configuration, ou effacez cette ligne.
- **De la logique dans les composables.** Les formulations et les couleurs de `Display.kt` sont testées sur la JVM ; dans un composable, elles ne pourraient être testées que sur un appareil.

Pour lancer les mêmes vérifications que la CI, depuis le dépôt :

```bash
./gradlew :app:testDebugUnitTest :app:assembleDebug
```

Sur la montre :

1. Ouvrez l’application sans sujet : elle affiche `Configurar`.
2. Envoyez le sujet depuis l’ordinateur avec la commande `adb shell am start` ci-dessus, avec votre propre sujet dans un terminal privé. Ouvrez l’application : la liste apparaît et se rafraîchit.
3. Lancez `/narsil movil prueba` dans Claude Code et touchez `Actualizar`. L’âge indique `ahora`, et la tuile et la complication changent aussitôt.
4. Réglez une mauvaise clé sous `Configurar`. Avec un état scellé, la note dit que l’état est scellé. Remettez la bonne clé et il s’ouvre de nouveau.
5. Pour voir la tâche périodique, connectez la montre et attendez : l’âge sur la tuile repart à zéro après le prochain rafraîchissement, si le mod a publié entre-temps.

### Là où le code et le README diffèrent

- Le README dit que la montre lit l’état « every 15 minutes, and whenever you open the app or the tile » (toutes les 15 minutes, et chaque fois que vous ouvrez l’application ou la tuile). Ouvrir l’application rafraîchit toujours. La tuile ne met un rafraîchissement en file que quand la dernière vérification date de plus de 15 minutes.
- La section Settings du README montre `--es topic narsil-... --es key ...` ensemble. Le code prend la clé comme facultative : omettez `--es key` et la clé enregistrée reste ; passez-la vide et la clé est retirée. Le README ne le dit pas.
- La section Development du README liste les commandes de test et de build mais pas la CI. Le workflow exécute exactement ces deux tâches.

## Pour aller plus loin

- Lisez `presentation/`, `sync/` et `.github/workflows/ci.yml` dans [narsil-watch](https://github.com/davshn/narsil-watch).
- Gérez aussi `onNewIntent`, pour que la configuration par `adb` fonctionne pendant que l’application est ouverte.
- Validez le sujet sur l’écran de configuration. Les sujets du mod sont `narsil-` suivi de 20 caractères hexadécimaux, tels que `newTopic` dans `hooks/phone.ts` de narsil-pet les crée.
- Ajoutez un test pour les extras de configuration avec un faux dépôt, ou déplacez-les dans une fonction pure qui renvoie ce qu’il faut enregistrer.
- Le côté du mod pour le sujet et la clé : [Les alertes sur votre téléphone et votre montre](/fr/mods/pet/phone-and-watch/). Tout le chemin depuis le début : [Ce qu’est Narsil Watch](/fr/watch/what-it-is/), [Lire l’état de Narsil](/fr/watch/reading-the-state/), [La tuile](/fr/watch/tile/) et [La complication](/fr/watch/complication/).
