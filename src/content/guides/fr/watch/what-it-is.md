---
title: Ce qu’est Narsil Watch
description: 'L’application Wear OS qui met les limites de Claude et vos conversations Claude Code ouvertes à votre poignet : une tuile, une complication et une application, sans serveur ni jeton Claude.'
route: watch
order: 1
updated: 2026-11-24
sources:
  - repo: watch
    path: README.md
  - repo: watch
    path: app/src/main/AndroidManifest.xml
  - repo: watch
    path: app/build.gradle.kts
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/data/StatusRepository.kt
  - repo: pet
    path: hooks/phone.ts
  - repo: pet
    path: hooks/register.tsx
---

## Ce que ça fait

Narsil Watch est une application Wear OS. Elle met deux choses à votre poignet : la part des limites d’utilisation de Claude que vous avez consommée, et l’avancement de vos conversations Claude Code ouvertes. Elle les affiche à trois endroits :

| Surface                          | Où la voir                                                                                     | Ce qu’elle montre                                                                                                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La tuile **Narsil · Claude**     | En balayant latéralement depuis le cadran                                                      | Deux anneaux, la limite de 5 heures à l’extérieur et l’hebdomadaire à l’intérieur, Narsil au centre, combien de conversations ont besoin de vous, et l’âge de la lecture. |
| La complication **Claude 5 h**   | Sur tout cadran qui en accepte une                                                             | La limite de 5 heures, sous forme d’arc ou de texte court comme `62%`.                                                                                                    |
| L’application, nommée **Narsil** | Depuis la liste des applications de la montre, ou d’un toucher sur la tuile ou la complication | Chaque conversation ouverte avec son état, les deux limites avec leur heure de réinitialisation, et le niveau de Narsil.                                                  |

L’application parle espagnol, comme Narsil elle-même. Les états qu’elle montre sont les siens : `TRABAJANDO` (au travail), `PARADA` (à l’arrêt), `TE NECESITA` (a besoin de vous), `TERMINADA` (terminée) et `ERROR`.

Elle n’a besoin **d’aucun serveur** ni **d’aucun jeton Claude**. Elle ne parle jamais à Claude. Elle lit un petit état que le mod Narsil, sur votre ordinateur, publie déjà pour votre téléphone, sur un sujet [ntfy.sh](https://ntfy.sh) privé. [Lire l’état de Narsil](/fr/watch/reading-the-state/) explique cet état, et [Les alertes sur votre téléphone et votre montre](/fr/mods/pet/phone-and-watch/) explique comment le mod l’envoie.

> **Expérimental.** La montre ne sait que ce que le mod a publié en dernier, et le mod ne publie que lorsqu’un tour se termine (ou qu’une question arrive) pendant que vous êtes loin de l’ordinateur, dans la marge quotidienne gratuite de ntfy.sh. Au bureau, la montre continue d’afficher une ancienne lecture. Elle en demande une nouvelle au plus toutes les 15 minutes, ntfy.sh ne garde un message que pendant un temps, et l’application est une version de débogage que vous installez vous-même par `adb`, version `0.1.0`. Tout changement dans la forme de l’état du mod peut la casser.

Narsil Watch est open source sous GPL v3 (ou toute version ultérieure), sur [github.com/davshn/narsil-watch](https://github.com/davshn/narsil-watch). Elle n’est pas affiliée à Anthropic.

## Comment ça marche à l’intérieur

### Un état, trois surfaces

Le code est petit : dix fichiers Kotlin sous `app/src/main/kotlin/tech/davshn/narsilwatch/`. Le README résume les dossiers, et ce découpage mérite d’être copié :

- `domain/` : l’état tel que Narsil le publie (`NarsilState.kt`) et la façon dont la montre le formule et le colore (`Display.kt`). Du Kotlin pur, sans Android.
- `data/` : la lecture du sujet ntfy (`StatusRepository.kt`, `StatusParser.kt`), l’ouverture du sceau (`Seal.kt`), et la conservation du dernier état.
- `tile/`, `complication/`, `presentation/` : les trois surfaces.
- `sync/` : le rafraîchissement toutes les 15 minutes avec WorkManager, et les redessins.

Les trois surfaces n’interrogent jamais le réseau elles-mêmes pendant qu’elles dessinent. Elles lisent toutes le même dernier état que `StatusRepository` garde sur la montre, par `cached()`. Seul le rafraîchissement interroge ntfy.sh, et quand il a du nouveau, il demande à la tuile et à la complication de se redessiner. C’est pourquoi la tuile apparaît aussitôt, même hors ligne : elle n’attend jamais une requête.

Le commentaire en tête de `StatusRepository.kt` (GPL v3) le dit en une ligne :

```kotlin
// Where the watch keeps the topic, the key, and the last state it read, so
// the tile and the complication draw at once, offline too.
```

(Là où la montre garde le sujet, la clé et le dernier état qu’elle a lu, pour que la tuile et la complication se dessinent aussitôt, hors ligne aussi.)

### Le flux des données

Le README dessine tout le chemin en une ligne :

```text
Claude Code ── Narsil mod ──► ntfy.sh/<topic>-estado ──► Narsil Watch (tile, complication, app)
```

Étape par étape :

1. **Claude Code exécute le mod Narsil** ([narsil-pet](https://github.com/davshn/narsil-pet)) sur votre ordinateur. Il connaît déjà vos conversations, leurs états, le niveau de Narsil et, depuis la version 3.10.0, les limites de 5 heures et hebdomadaire de Claude.
2. **Le mod publie un état JSON** sur `https://ntfy.sh`, sur le sujet `<votre sujet>-estado` (« estado » veut dire « état »). Votre sujet est celui que `/narsil movil` a créé, un nom comme `narsil-0000000000example0` (chaque sujet de ce parcours est un exemple inventé).
3. **ntfy.sh garde le dernier message** pendant un temps. Un commentaire de `hooks/register.tsx` dans narsil-pet dit qu’il « keeps a message 12 h » (garde un message 12 h).
4. **La montre demande à ntfy.sh le dernier message** de ce sujet, l’ouvre avec votre clé s’il est scellé, et le garde.
5. **La tuile, la complication et l’application** dessinent à partir de ce qu’elle a gardé.

Rien ne va dans l’autre sens. La section Security du README est claire : « the watch only reads the topic: it never publishes on it. » (la montre ne fait que lire le sujet : elle n’y publie jamais).

### Quand le mod publie, et ce que cela veut dire pour la fraîcheur

C’est la chose la plus importante à comprendre sur la montre. C’est une fenêtre sur le dernier message, pas un flux en direct.

Le `sendStatus` du mod, dans `hooks/register.tsx`, s’exécute quand un tour de la conversation principale se termine et quand une question arrive, et `/narsil movil prueba` (« test ») en envoie un aussi. À chaque fois, `postToPhone` décide s’il part vraiment. D’après ses premières lignes :

```ts
const { phoneTopic, isPhoneOn, phoneKey } = await read($, prefs)
if (!isPhoneOn || !phoneTopic || (!force && !(await isAway($)))) return false
const day = dayOf(await $.clock.now())
const count = countOf(await $.store.get(PHONE_KEY).catch(() => undefined), day)
if (count.sent >= PHONE_DAILY) return false
```

Cet extrait vient de `hooks/register.tsx` dans narsil-pet (GPL v3), sans son indentation. En mots, l’état ne part que quand :

- **`/narsil movil` est activé** et qu’un sujet existe.
- **Vous êtes absent ou absente.** `isAway` lit d’où est venu votre dernier message. S’il est venu par Remote Control (votre téléphone ou le web), vous êtes à distance ; s’il est venu du terminal ou de l’application de bureau, vous êtes au bureau.
- **La marge du jour n’est pas épuisée.** `PHONE_DAILY` vaut 200. Le commentaire de `hooks/phone.ts` : « ntfy.sh takes 250 a day for free: Narsil stops short of it. » (ntfy.sh en accepte 250 par jour gratuitement : Narsil s’arrête avant). Le jour est le jour UTC, et les alertes et les états partagent les mêmes 200.

En pratique, donc :

- **Pendant que vous travaillez depuis le téléphone**, un nouvel état part à la fin de chaque tour. La montre le récupère à son prochain rafraîchissement.
- **Au bureau**, rien ne part. La montre garde la dernière lecture qu’elle avait. C’est voulu : au bureau, vous voyez la bande et la fenêtre flottante, et envoyer gaspillerait la marge quotidienne pour rien. La tuile et l’application montrent l’âge de la lecture (`hace 2 h`, « il y a 2 heures »), pour que vous ne soyez jamais trompé ou trompée.
- **Lors d’une journée chargée à distance**, les 200 peuvent s’épuiser. Ensuite, rien de nouveau n’arrive avant minuit UTC.
- **Si rien n’a été publié depuis plus d’environ 12 heures**, ntfy.sh n’a peut-être plus rien à donner. La montre affiche toujours ce qu’elle a gardé.

Les limites vieillissent aussi. Un chiffre de 5 heures lu à midi ne dit rien de sûr sur 17 h. L’application montre quand chaque limite se réinitialise ([guide 5](/fr/watch/app-and-refresh/)), et l’étiquette d’âge vous dit à quel point le tout est ancien.

### Pourquoi les alertes ne font pas partie de l’application

Vous pourriez vous attendre à ce qu’une application de montre vibre quand Claude a besoin de vous. Celle-ci ne le fait pas, à dessein. Le README l’explique : « Alerts (a question, a finished turn, an error) are not part of this app: Narsil for Android or the ntfy app on your phone already mirror them to the watch. » (les alertes, une question, un tour terminé, une erreur, ne font pas partie de cette application : Narsil pour Android ou l’application ntfy sur votre téléphone les reflètent déjà sur la montre).

Wear OS affiche déjà les notifications du téléphone sur la montre. Le mod envoie déjà ses alertes à votre sujet ntfy. Les alertes atteignent donc votre poignet en passant par le téléphone, avec au choix :

- [Narsil pour Android](/fr/android/what-it-is/), qui les transforme en notifications natives et ouvre les alertes scellées avec votre clé, ou
- l’application ntfy, abonnée à votre sujet. Le texte d’aide du mod lui-même dit qu’une montre Wear OS « mostrará sus notificaciones si tienes activadas las de ntfy en la app del reloj » (affichera ses notifications si vous avez activé celles de ntfy dans l’application de la montre).

Un second chemin d’alertes depuis l’application de la montre voudrait dire deux vibrations pour un seul événement, et un second abonnement qui occupe la radio. L’application de la montre fait la seule chose que le téléphone ne peut pas refléter : un résumé de tout, lisible d’un coup d’œil.

### Ce qu’elle lit sur le réseau

D’après `AndroidManifest.xml`, l’application ne demande que deux permissions, `INTERNET` et `ACCESS_NETWORK_STATE`. Elle se déclare application de montre autonome (`com.google.android.wearable.standalone` vaut `true`), si bien qu’elle n’a pas besoin d’une application compagnon sur le téléphone. Elle définit `android:allowBackup="false"`, si bien que le sujet et la clé qu’elle garde ne sont pas copiés dans une sauvegarde.

Elle ne parle qu’à deux endroits, que la section Security du README liste et que le code confirme :

- **`https://ntfy.sh`**, pour l’état.
- **`https://raw.githubusercontent.com/davshn/narsil-pet/`**, pour les dessins de Narsil. `StatusRepository` refuse toute autre adresse pour l’image (le [guide 2](/fr/watch/reading-the-state/) explique pourquoi).

Aucun jeton Claude et aucun compte Claude n’atteignent la montre.

### L’installer par adb sans fil

Il n’y a pas de fiche sur un store. Vous compilez l’application sur votre ordinateur et vous l’installez sur la montre par Wi-Fi. D’après le README, il vous faut :

- Une montre sous **Wear OS 3 ou ultérieur**, avec les options pour les développeurs et le **débogage sans fil** activés.
- Sur l’ordinateur, **JDK 17 ou ultérieur** et le **SDK Android**, avec `ANDROID_HOME` qui pointe vers lui.

Associez la montre comme l’explique son écran de débogage sans fil, puis, dans une copie du dépôt :

```bash
adb connect 192.168.1.50:<port>
./gradlew :app:installDebug
```

L’adresse ici est un exemple ; utilisez l’IP et le port que votre montre affiche. `installDebug` compile la variante de débogage et l’installe sur l’appareil connecté. Ajoutez ensuite la tuile **Narsil · Claude** depuis l’éditeur de tuiles de la montre, et la complication **Claude 5 h** depuis l’éditeur du cadran.

Pour mettre à jour, récupérez la dernière version du dépôt et relancez la même commande. Le README dit que les réglages sont conservés.

La première fois que vous ouvrez l’application, elle affiche **Configurar** (configurer) : votre sujet et, si vous en utilisez une, votre clé. Vous pouvez les saisir sur la montre, ou les envoyer depuis l’ordinateur avec une seule commande `adb`. Le [guide 5](/fr/watch/app-and-refresh/) montre les deux. Dans Claude Code, `/narsil movil` affiche votre sujet et `/narsil movil clave` crée la clé.

### Le sujet et la clé : ce qu’ils permettent et comment les changer

Ce sont deux secrets, alors soyons précis :

- **Où ils sont stockés sur la montre.** Dans le stockage privé de l’application (des `SharedPreferences` Android nommées `narsil`, en `MODE_PRIVATE`), comme le dit le README. Pas dans une sauvegarde, puisque les sauvegardes sont désactivées.
- **Ce que permet le sujet.** Quiconque connaît son nom peut lire chaque message qui y passe, alertes et `-estado` confondus, et peut y publier. La montre elle-même ne fait que lire.
- **Ce que permet la clé.** Elle ouvre les messages scellés. Sans elle, un lecteur ou une lectrice du sujet voit du bruit ; avec elle, l’état complet.
- **Comment les renouveler.** `/narsil movil nuevo` (« nouveau ») crée un nouveau sujet ; l’ancien ne reçoit plus rien. `/narsil movil clave` crée une nouvelle clé à chaque exécution, et l’ancienne n’ouvre plus ce qui est envoyé à partir de là. Après l’un ou l’autre, donnez la nouvelle valeur à la montre sous **Configurar**.
- **Comment les retirer de la montre.** Videz les champs sous **Configurar**, ou désinstallez l’application.

Le README ajoute un avertissement simple : « Without a key, anyone who knows your topic's name can read it. Use `/narsil movil clave` if that matters to you. » (sans clé, quiconque connaît le nom de votre sujet peut le lire ; utilisez `/narsil movil clave` si cela compte pour vous).

### Systèmes pris en charge

D’après le README et `app/build.gradle.kts` :

| Système        | Pris en charge                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------- |
| Wear OS        | 3 ou ultérieur. Le build définit `minSdk = 30` (« Wear OS 3 and later ») et `targetSdk = 36`.  |
| Mod Narsil     | Une version qui publie `limits` et `sessions` dans son état : la version 3.10.0 ou ultérieure. |
| Tizen, watchOS | Non disponible. C’est une application Android.                                                 |

Le build utilise Java 17, Kotlin avec Compose pour l’application, les bibliothèques Tiles et ProtoLayout de Wear pour la tuile, la bibliothèque des sources de données de complications, et WorkManager. Les versions vivent dans `gradle/libs.versions.toml`.

Un mod plus ancien fonctionne encore, en partie. `NarsilState` donne à `limits` et `sessions` des valeurs vides par défaut, si bien qu’un état d’avant 3.10.0 est lu sans eux : les anneaux restent vides, et la liste dit `Sin conversaciones` (aucune conversation).

### Pourquoi elle est expérimentale

Chaque raison vient du code ou du README :

- **Elle dépend des publications du mod.** Pas de mod, `/narsil movil` désactivé, ou un mod plus ancien, et la montre n’a presque rien, voire rien, à montrer.
- **Les lectures n’arrivent que pendant que vous êtes à distance.** Au bureau, l’état ne change pas.
- **La marge quotidienne gratuite de ntfy.sh.** Le mod s’arrête à 200 messages par jour, partagés avec les alertes.
- **Un rafraîchissement toutes les 15 minutes.** L’intervalle de répétition le plus court de WorkManager, comme le dit le commentaire de `Refresh.kt`.
- **Un service public au milieu.** ntfy.sh garde les messages pendant un temps limité et c’est un tiers.
- **L’installation manuelle.** Elle s’installe comme version de débogage par `adb`, version `0.1.0`, sans store ni mises à jour automatiques.
- **Les tests couvrent la logique, pas les écrans.** Les tests unitaires vérifient le parseur, les formulations et le sceau ; rien ne teste la tuile ni la complication sur un appareil.

## Le construire avec Claude

Si vous voulez votre propre application de montre de ce genre, demandez d’abord à Claude le squelette : un projet Wear OS avec une application, un service de tuile et un service de complication, qui lisent tous un même état stocké. L’idée que Claude doit bien saisir : les surfaces lisent une copie locale et n’attendent jamais le réseau.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Crée une application Wear OS 3+ en Kotlin (`minSdk = 30`, Java 17) appelée `my-watch`, paquet `com.example.mywatch`. Elle lit un état JSON depuis le dernier message d’un sujet ntfy.sh, `https://ntfy.sh/<topic>-estado/json?poll=1&since=latest`, et ne publie jamais. Découpe-la en `domain/` (l’état sous forme de data class `@Serializable` et des fonctions d’affichage pures), `data/` (un dépôt qui garde le sujet et la dernière réponse brute dans des `SharedPreferences` privées, et un parseur), `tile/` (un `TileService`), `complication/` (un `SuspendingComplicationDataSourceService` avec `RANGED_VALUE` et `SHORT_TEXT`), `presentation/` (une activité Compose pour Wear OS) et `sync/` (une tâche WorkManager toutes les 15 minutes qui rafraîchit et demande à la tuile et à la complication de se redessiner). La tuile et la complication ne font que lire l’état stocké. Déclare l’application autonome, désactive les sauvegardes, et ne demande que `INTERNET` et `ACCESS_NETWORK_STATE`. Ajoute des tests JUnit pour le parseur et les fonctions d’affichage, et un workflow GitHub Actions qui exécute `./gradlew :app:testDebugUnitTest :app:assembleDebug`.

### Ce qu’il faut vérifier dans la réponse de Claude

1. La tuile et la complication lisent l’état stocké. Aucune ne fait de requête réseau pendant qu’elle dessine.
2. Le manifeste déclare la tuile avec `BIND_TILE_PROVIDER` et la complication avec `BIND_COMPLICATION_PROVIDER`, ses `SUPPORTED_TYPES` et un `UPDATE_PERIOD_SECONDS`.
3. L’application a `com.google.android.wearable.standalone` à `true` et `allowBackup` à `false`.
4. Seules `INTERNET` et `ACCESS_NETWORK_STATE` sont demandées.
5. Le dépôt garde la dernière bonne réponse et ne l’écrase pas avec une réponse vide ou illisible.
6. Le sujet n’apparaît jamais dans un journal.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « la tuile reste vide quelques secondes quand je balaie jusqu’à elle », ce qui veut dire qu’elle attend le réseau.

### Comment l’auteur l’a demandé

Aucun journal de tâches ni aucune demande consignée n’existe pour cette application. Ce qui suit est une reconstitution à partir de l’historique des commits des deux dépôts, pas les mots de l’auteur ou de l’autrice :

- narsil-pet `6400a6f` (2026-11-23) « feat(phone): publish Claude limits and open conversations for the watch » (publier les limites de Claude et les conversations ouvertes pour la montre). Son message : « The status topic now carries the 5-hour and weekly limits (percent, color, reset) and up to 8 open conversations, so a Wear OS app can show them. » (le sujet d’état transporte désormais les limites de 5 heures et hebdomadaire, pourcentage, couleur, réinitialisation, et jusqu’à 8 conversations ouvertes, pour qu’une application Wear OS puisse les afficher).
- narsil-watch `b47ca7a` (2026-11-23) « feat: Narsil on Wear OS with Claude limits and open conversations » (Narsil sur Wear OS avec les limites de Claude et les conversations ouvertes). Toute l’application en un seul commit. Son message : « A tile with the 5-hour and weekly limits as rings and Narsil in her current pose, a 5-hour complication, and an app listing every open conversation. It reads Narsil's state from its ntfy.sh status topic and opens it with the /narsil movil clave key when sealed. » (une tuile avec les limites de 5 heures et hebdomadaire en anneaux et Narsil dans sa pose actuelle, une complication de 5 heures, et une application qui liste chaque conversation ouverte ; elle lit l’état de Narsil sur son sujet d’état ntfy.sh et l’ouvre avec la clé de /narsil movil clave quand il est scellé).
- narsil-pet `9437318` (2026-11-23) « chore(release): 3.10.0 ». La première version dont la montre peut lire l’état en entier.
- narsil-watch `04390c8` (2026-11-24) « docs: align README with the Narsil family » (aligner le README sur la famille Narsil). Le README gagne le tableau des états, les sections Security et Supported systems, et Narsil pour Android à côté de l’application ntfy comme moyen pour les alertes d’atteindre la montre ; le premier README ne citait que l’application ntfy.

L’ordre raconte l’histoire : le côté du mod a changé d’abord, pour que l’état transporte ce dont une montre a besoin, puis la montre a été construite pour le lire. Aucun des deux côtés n’a eu besoin d’un serveur.

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide. Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

Un manifeste minimal pour une application de cette forme, écrit pour ce guide et adapté de `app/src/main/AndroidManifest.xml` dans [narsil-watch](https://github.com/davshn/narsil-watch) (GPL v3). Les noms de classes appartiennent au paquet d’exemple `com.example.mywatch` :

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-feature android:name="android.hardware.type.watch" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:name=".MyWatchApplication"
        android:allowBackup="false"
        android:label="My watch"
        android:theme="@android:style/Theme.DeviceDefault">

        <meta-data
            android:name="com.google.android.wearable.standalone"
            android:value="true" />

        <activity
            android:name=".presentation.MainActivity"
            android:exported="true"
            android:taskAffinity="">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <service
            android:name=".tile.MyTileService"
            android:exported="true"
            android:label="My tile"
            android:permission="com.google.android.wearable.permission.BIND_TILE_PROVIDER">
            <intent-filter>
                <action android:name="androidx.wear.tiles.action.BIND_TILE_PROVIDER" />
            </intent-filter>
        </service>

        <service
            android:name=".complication.MyComplicationService"
            android:exported="true"
            android:label="My limit"
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
    </application>
</manifest>
```

Chaque ligne a sa raison d’être. Le `uses-feature` réserve l’application aux montres. Les deux permissions sont tout ce qu’exige une lecture en HTTPS. Les services de la tuile et de la complication sont exportés, parce que c’est le système qui s’y lie, et protégés par les permissions de liaison, pour que seul le système le puisse. `900` secondes correspondent au rafraîchissement toutes les 15 minutes.

Et les commandes pour compiler, tester et installer, d’après le README, avec une adresse d’exemple :

```bash
./gradlew :app:testDebugUnitTest
./gradlew :app:assembleDebug
adb connect 192.168.1.50:<port>
./gradlew :app:installDebug
```

## Erreurs fréquentes et comment tester

- **S’attendre à des données en direct au bureau.** Le mod ne publie que pendant que vous êtes à distance. L’étiquette d’âge est la réponse honnête ; lisez-la avant les chiffres.
- **Désactiver `/narsil movil`.** Cela arrête les états aussi bien que les alertes. La montre garde sa dernière lecture, qui vieillit.
- **Un ancien mod.** Avant 3.10.0, il n’y a ni `limits` ni `sessions`. Les anneaux restent vides et la liste dit `Sin conversaciones`.
- **Le sujet `-estado` dans l’application d’alertes.** Abonnez l’application ntfy à votre sujet simple, pas à `-estado`. Le sujet d’état, ce sont des données, envoyées avec la priorité 1, et le commentaire du mod dit qu’il n’est « not followed by push » (pas suivi par push).
- **Attendre des alertes de l’application de la montre.** Elles passent par le téléphone. Vérifiez d’abord que l’application ntfy ou Narsil pour Android les affiche sur le téléphone.
- **Pas d’options pour les développeurs.** Sur la montre, les options pour les développeurs doivent être activées avant que le débogage sans fil n’apparaisse.

Pour tester tout le chemin de bout en bout :

1. Dans Claude Code, lancez `/narsil movil`, notez le sujet, et saisissez-le sur la montre sous **Configurar**.
2. Lancez `/narsil movil prueba`. Il envoie une alerte de test et, quand elle part, un état, même depuis le bureau.
3. Ouvrez l’application sur la montre. Elle se rafraîchit à l’ouverture. L’âge devrait indiquer `ahora` (maintenant).
4. Balayez jusqu’à la tuile. Elle montre la même lecture, avec les anneaux remplis si le mod a lu les limites de Claude.

### Là où le code et le README diffèrent

- Le README dit que la montre lit le dernier message « every 15 minutes, and whenever you open the app or the tile » (toutes les 15 minutes, et chaque fois que vous ouvrez l’application ou la tuile). L’application se rafraîchit bien chaque fois qu’elle s’ouvre. La tuile, elle, ne demande un rafraîchissement que quand la dernière vérification date de plus de 15 minutes, et dessine d’abord l’état gardé ([guide 3](/fr/watch/tile/)).
- Le README dit que Narsil publie l’état « when a turn ends while you are away » (quand un tour se termine pendant que vous êtes absent). Le code du mod le publie aussi avec chaque question, et avec `/narsil movil prueba`, qui part même depuis le bureau.
- Le README de narsil-pet liste encore cinq champs pour `-estado`. Son code en envoie sept depuis 3.10.0, `limits` et `sessions` compris ([guide 2](/fr/watch/reading-the-state/)).

## Pour aller plus loin

- Lisez le code source sur [github.com/davshn/narsil-watch](https://github.com/davshn/narsil-watch).
- [Les alertes sur votre téléphone et votre montre](/fr/mods/pet/phone-and-watch/) couvre le côté du mod : le sujet, le décompte quotidien et la clé.
- [Narsil pour Android](/fr/android/what-it-is/) est l’application de téléphone qui reflète les alertes sur la montre.
- Suivant dans ce parcours : [Lire l’état de Narsil](/fr/watch/reading-the-state/), comment la montre récupère, ouvre et garde l’état.
- Puis [la tuile](/fr/watch/tile/), [la complication](/fr/watch/complication/) et [l’application et son rafraîchissement](/fr/watch/app-and-refresh/).
