---
title: Des alertes depuis un service de premier plan
description: 'Comment AlertService garde une connexion ouverte vers ntfy.sh, rattrape les alertes manquées avec since, et comment Alert et Notifier changent chaque message en notification sur le bon canal.'
route: android
order: 6
updated: 2026-11-24
sources:
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/AlertService.kt
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/NtfyStream.kt
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/Alert.kt
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/Notifier.kt
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/BootReceiver.kt
  - repo: android
    path: app/src/test/java/io/github/davshn/narsil/AlertTest.kt
  - repo: pet
    path: hooks/phone.ts
---

## Ce que ça fait

Pendant que vous écrivez à Claude Code par Remote Control, le mod Narsil publie sur votre sujet ntfy.sh quand une conversation se termine, a besoin de vous ou échoue. L’application affiche chacune de ces alertes sous forme de notification, avec Narsil à son étape actuelle et dans la pose de l’alerte :

| Alerte                     | Comment elle arrive                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Une question ou une erreur | Sur le canal **Te necesita** (a besoin de vous) : elle s’affiche par-dessus ce que vous faites et vibre selon son propre motif long. |
| Un tour terminé            | Sur le canal **Terminó** (terminé) : une courte vibration, et elle apparaît discrètement dans le volet.                              |

- **Un toucher** ouvre Claude Code dans l’application. Jusque-là, chaque alerte reste dans le volet.
- **Les liens de l’alerte** apparaissent comme des boutons, deux au plus. Ceux de `claude.ai` s’ouvrent dans l’application, les autres dans votre navigateur. Le mod en envoie un, `Abrir Claude` (ouvrir Claude).
- **L’application peut être fermée.** Une connexion à ntfy.sh reste ouverte dans un service de premier plan, avec sa propre notification discrète : « Narsil escucha tus avisos » (Narsil écoute vos alertes) et, en dessous, `Topic <your topic> · toca para cambiarlo` (touchez pour le changer). Un toucher dessus ouvre les réglages.
- **Après un redémarrage** du téléphone, ou une mise à jour de l’application, le service repart tout seul.
- **Les alertes manquées arrivent en retard, mais elles arrivent.** Si le téléphone était éteint ou hors ligne, les alertes envoyées entre-temps arrivent à son retour, tant que ntfy.sh les garde encore (12 heures, dit le code).

Vous n’avez plus besoin de l’application ntfy.

> **Expérimental.** L’application dans son ensemble s’appuie sur la structure de la page `claude.ai` et sur ses requêtes internes, qu’une mise à jour de Claude peut casser. Cette partie ne touche pas à `claude.ai`, mais elle a ses propres points fragiles : elle dépend du service public gratuit de ntfy.sh et du fait qu’Android laisse une application garder une connexion ouverte toute la journée. Certains fabricants de téléphones ferment quand même les applications en arrière-plan, et alors les alertes arrivent en retard ou s’arrêtent jusqu’à ce que vous ouvriez l’application.

## Comment ça marche à l’intérieur

### Le chemin d’une alerte

```text
Narsil mod on the computer
  └─ POST https://ntfy.sh  (your topic)
       └─ NtfyStream: GET https://ntfy.sh/<topic>/json?since=<last id>
            └─ AlertService.take
                 ├─ Seal.unseal      (opens it with the key, if sealed)
                 ├─ Alert.of         (the rules: channel, tag, buttons, picture, tap)
                 ├─ Notifier.show    (the notification)
                 └─ settings.lastAlertId = its id
```

Chaque étape est un petit fichier avec un seul rôle. `NtfyStream` connaît ntfy.sh, `Alert` connaît les règles et n’a pas de code Android (donc `AlertTest.kt` le teste sur l’ordinateur), et `Notifier` connaît les notifications d’Android.

### Un service de premier plan, et pourquoi `specialUse`

Android arrête le travail en arrière-plan qu’il ne voit pas. Pour garder une connexion ouverte pendant des heures, une application doit faire tourner un **service de premier plan** : un service qui affiche une notification aussi longtemps qu’il tourne, pour que vous sachiez toujours qu’il est là. Depuis Android 14, chaque service de premier plan déclare aussi un type qui dit à quoi il sert.

Le type évident, `dataSync`, ne convient pas : la décision du journal de tâches consigne qu’« Android 15 caps `dataSync` at 6 h a day » (Android 15 limite `dataSync` à 6 h par jour). L’application déclare `specialUse` à la place, avec la raison qu’Android demande dans le manifeste :

<!-- prettier-ignore -->
```xml
        <service
            android:name=".AlertService"
            android:exported="false"
            android:foregroundServiceType="specialUse">
            <property
                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
                android:value="Keeps a connection to ntfy.sh open to show the alerts of Claude Code as they come" />
        </service>
```

Cet extrait vient de `AndroidManifest.xml` dans narsil-android (MIT). La même décision explique ce que l’application n’utilise pas : « no Firebase, no ntfy app needed » (pas de Firebase, pas besoin de l’application ntfy). Les services de push comme Firebase Cloud Messaging demandent un serveur qui leur envoie les messages ; ici, le seul serveur est ntfy.sh, et l’application l’écoute directement.

Le service lui-même est court. Depuis `AlertService.kt` (MIT) :

```kotlin
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val settings = Settings(this)
        val wanted = settings.topic
        if (wanted == null) {
            stopSelf()
            return START_NOT_STICKY
        }
        Notifier.createChannels(this)
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0
        ServiceCompat.startForeground(this, Notifier.SERVICE_ID, Notifier.serviceNotification(this, wanted), type)
        if (wanted != topic || stream == null) {
            stream?.stop()
            topic = wanted
            stream = NtfyStream(NtfyStream.topicUrl(wanted), settings.lastAlertId, ::take).also { it.start() }
        }
        return START_STICKY
    }
```

- **Pas de sujet, pas de service.** Il s’arrête de lui-même et demande à ne pas être relancé.
- **La notification discrète d’abord.** `startForeground` doit être appelé peu après le démarrage du service, sinon Android l’arrête. Le type n’est passé que sur Android 14 (`UPSIDE_DOWN_CAKE`) et plus récent, où les types existent.
- **Un flux par sujet.** Le service peut être démarré de nombreuses fois : au lancement de l’application, depuis **Guardar y recibir avisos** dans les réglages, et après un redémarrage. Si le sujet est le même et qu’un flux tourne, rien ne change. Si vous avez enregistré un nouveau sujet, l’ancien flux s’arrête et un nouveau démarre.
- **`START_STICKY`** demande à Android de redémarrer le service s’il doit un jour le tuer.

La notification discrète vit sur son propre canal, **Conexión** (connexion), à l’importance la plus basse, sans pastille, si bien qu’elle reste en bas du volet sans bruit. Son texte inclut votre sujet, ce qui est bon à savoir si d’autres personnes voient votre écran.

### `NtfyStream` : une connexion, gardée ouverte

ntfy.sh peut envoyer un sujet sous forme de flux JSON : une réponse HTTP qui ne se termine jamais, avec un objet JSON par ligne ([ntfy : subscribe API](https://docs.ntfy.sh/subscribe/api/)). Chaque ligne de message a `"event": "message"` ; ntfy.sh envoie aussi des lignes `open` et `keepalive`. `NtfyStream` lit ce flux dans un thread à lui. La partie qui lit, depuis `NtfyStream.kt` (MIT) :

```kotlin
    private fun read() {
        val from = since
        val url = URL(if (from != null) "$topicUrl?since=${URLEncoder.encode(from, "UTF-8")}" else topicUrl)
        val c = url.openConnection() as HttpURLConnection
        connection = c
        try {
            c.connectTimeout = 15_000
            c.readTimeout = 90_000
            c.useCaches = false
            if (c.responseCode != 200) throw IOException("ntfy.sh answered ${c.responseCode}")
            c.inputStream.bufferedReader().useLines { lines ->
                for (line in lines) {
                    if (!isRunning) return
                    val raw = try {
                        JSONObject(line)
                    } catch (_: Exception) {
                        continue
                    }
                    if (raw.optString("event") != "message") continue
                    try {
                        onMessage(raw)
                    } catch (e: Exception) {
                        Log.w(TAG, "a message could not be taken: ${e.message}")
                    }
                    raw.optString("id").takeIf { it.isNotEmpty() }?.let { since = it }
                }
            }
        } finally {
            c.disconnect()
            connection = null
        }
    }
```

Les nombres ont leurs raisons. Le commentaire de la classe dit « ntfy.sh sends a keepalive every 45 s, so a read that waits 90 s found a dead connection » (ntfy.sh envoie un keepalive toutes les 45 s, donc une lecture qui attend 90 s a trouvé une connexion morte) : un téléphone qui a changé de réseau peut garder un socket qui ne livrera plus jamais rien, et le délai de lecture de 90 secondes est la façon dont l’application s’en aperçoit. Une ligne qui n’est pas du JSON est sautée. Un message qui n’arrive pas à s’afficher est consigné et n’arrête pas le flux. Et après chaque message, `since` passe à son identifiant.

Autour de `read()`, `follow()` le fait tourner :

- **Quand le flux se termine normalement** (ntfy.sh ou un proxy l’a fermé), il attend une seconde et relit, à partir de `since`.
- **Quand il échoue** (pas de réseau, un délai dépassé, une réponse autre que 200), il attend une seconde, puis deux, quatre, et ainsi de suite, jusqu’à une minute, et revient à une seconde après une lecture qui a fonctionné.
- **`stop()`** efface un indicateur, coupe la connexion ouverte et interrompt le thread, qui se termine donc aussitôt, même au milieu d’une attente.

Le thread est un thread démon, donc il ne garde jamais à lui seul le processus de l’application en vie ; c’est le service de premier plan qui s’en charge.

### Rattraper le retard avec `since`

ntfy.sh garde les messages d’un sujet pendant un certain temps (12 heures, dit le commentaire de `AlertService.kt`), et son paramètre `since` demande ceux qui suivent un identifiant de message donné ([ntfy : subscribe API](https://docs.ntfy.sh/subscribe/api/)). L’application l’utilise pour reprendre là où elle s’était arrêtée :

1. Après chaque alerte qu’elle affiche, `AlertService.take` enregistre l’identifiant du message comme `lastAlertId` dans les réglages.
2. Quand le service démarre, après un redémarrage par exemple, il ouvre le flux avec `since=<lastAlertId>`.
3. ntfy.sh envoie d’abord ce qu’il a gardé après cet identifiant, puis continue en direct.

Une alerte envoyée pendant que le téléphone était éteint arrive donc à son retour. Trois limites découlent du code :

- **La première fois, il n’y a rien à partir de quoi reprendre.** Sans identifiant enregistré, `since` vaut `null` et le flux part « from now on » (à partir de maintenant). Les alertes envoyées avant votre première ne sont pas récupérées.
- **Un nouveau sujet repart de zéro.** Enregistrer un autre sujet supprime `lastAlertId` (le setter s’en charge), pour que vous n’ayez pas un identifiant qui appartient à un autre sujet.
- **Au-delà de 12 heures, elles ont disparu** de ntfy.sh, et donc de l’application.

L’étiquette de la notification apporte une sécurité discrète. Si Android tue l’application entre l’affichage d’une alerte et l’enregistrement de son identifiant, l’alerte revient au démarrage suivant, mais avec le même identifiant de message, donc la même étiquette, si bien qu’elle se remplace elle-même au lieu d’apparaître deux fois.

### `Alert.kt` : les règles

`Alert.of` transforme un message, déjà ouvert s’il était scellé, en ce qu’une notification affiche. Depuis `Alert.kt` (MIT) :

```kotlin
        fun of(m: JSONObject): Alert {
            val isUrgent = m.optInt("priority", 3) >= 4
            val tags = m.optJSONArray("tags")
            val conversation = (0 until (tags?.length() ?: 0)).map { tags!!.optString(it) }.firstOrNull { it.startsWith("conv-") }
            val id = m.optString("id").ifEmpty { m.optLong("time").toString() }
            val actions = m.optJSONArray("actions")
            val views = (0 until (actions?.length() ?: 0)).mapNotNull { actions!!.optJSONObject(it) }
                .filter { it.optString("action") == "view" && it.optString("url").isNotEmpty() }
                .take(2)
                .map { View(it.optString("label").ifEmpty { "Abrir" }, it.optString("url")) }
            val click = m.optString("click").takeIf { Links.isClaude(it) }
            return Alert(
                title = m.optString("title").ifEmpty { "Narsil" },
                body = if (m.optBoolean("sealed")) SEALED else m.optString("message"),
                isUrgent = isUrgent,
                tag = if (!isUrgent && conversation != null) "done-$conversation" else id,
                views = views,
                icon = m.optString("icon").takeIf { it.startsWith(ART) },
                opens = click ?: Links.CLAUDE_CODE,
            )
        }
```

| Règle     | Ce que fait le code                                                                                                                                                   |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Urgente   | Priorité ntfy 4 ou 5. Le mod envoie 4 pour une question ou une erreur, 3 pour un tour terminé.                                                                        |
| Étiquette | Un tour terminé avec une étiquette `conv-…` reçoit `done-conv-…`, si bien que le suivant de cette conversation le remplace. Tout le reste, son propre identifiant.    |
| Boutons   | Seulement les actions ntfy `view` avec une adresse, deux au plus, avec le libellé `Abrir` (ouvrir) quand elles n’en ont pas.                                          |
| Toucher   | L’adresse `click` du message seulement si c’est `claude.ai` ; sinon `https://claude.ai/code`.                                                                         |
| Image     | Seulement une `icon` qui commence par `https://raw.githubusercontent.com/davshn/narsil-pet/main/assets/`.                                                             |
| Titre     | Le titre du message, ou `Narsil`.                                                                                                                                     |
| Scellée   | Quand la clé n’a pas pu l’ouvrir : « 🔒 Aviso cifrado: pon la clave en los ajustes de la app. » (alerte chiffrée : mettez la clé dans les réglages de l’application). |

La règle de l’image a sa raison dans un commentaire : « Without a key anyone who knows the topic can publish on it: a picture only comes from Narsil's own assets. » (sans clé, quiconque connaît le sujet peut y publier : une image ne vient que des assets propres de Narsil). Il en va de même pour le toucher. Les adresses des boutons ne sont vérifiées que sur leur présence : une adresse qui n’est pas `claude.ai` s’ouvre dans l’application qui la gère, après que vous l’avez touchée.

### Ce qu’envoie le mod

Les règles ci-dessus correspondent à ce que publie le mod. Depuis `hooks/phone.ts` dans [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later) :

<!-- prettier-ignore -->
```ts
export function phoneMessage(topic: string, kind: PhoneKind, title: string, text: string, where: string, stage: number, isLast: boolean, fleet = '') {
  const body = fleet ? `${text}\n\n${fleet}` : text
  return {
    topic,
    title: where ? `Narsil · ${title} · ${where}` : `Narsil · ${title}`,
    message: isLast ? `${body}\n(último aviso de hoy: mañana sigo)` : body,
    priority: PRIORITY[kind],
    tags: [TAGS[kind]],
    icon: phoneIcon(kind, stage),
    actions: [OPEN_CLAUDE],
  }
}
```

`PRIORITY` vaut 3 pour `done` et 4 pour `question` et `error`. `TAGS` contient une étiquette emoji par type (`white_check_mark`, `raising_hand`, `warning`). `phoneIcon` construit l’adresse de l’image à partir de l’étape de Narsil et de la pose de l’alerte : les images du bébé sont à la racine de `assets/`, chaque étape suivante dans un dossier `etapaN/`, et la pose est `terminado`, `necesita` ou `error`, toujours dans la variante sombre (`-oscuro.png`). `OPEN_CLAUDE` est l’unique bouton, `Abrir Claude`, vers `https://claude.ai/code`. Le corps peut se terminer par la liste des conversations ouvertes et, au 200e message de la journée, par `(último aviso de hoy: mañana sigo)` (dernière alerte d’aujourd’hui : je continue demain). [Les alertes sur votre téléphone et votre montre](/fr/mods/pet/phone-and-watch/) explique quand le mod envoie.

Remarquez ce que le mod n’envoie pas : une étiquette `conv-` ou une adresse `click`. Donc, avec le mod d’aujourd’hui, chaque tour terminé est sa propre notification, et chaque toucher ouvre `claude.ai/code`, où Remote Control liste vos conversations.

### `Notifier.kt` : les canaux et la notification

Depuis Android 8, chaque notification appartient à un canal, et la personne décide, canal par canal, s’il sonne, vibre ou s’affiche. L’application en crée trois. Depuis `Notifier.kt` (MIT) :

```kotlin
    fun createChannels(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannels(
            listOf(
                NotificationChannel(NEEDS, "Te necesita", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Una pregunta o un error de Claude"
                    enableVibration(true)
                    vibrationPattern = NEEDS_BUZZ
                },
                NotificationChannel(DONE, "Terminó", NotificationManager.IMPORTANCE_DEFAULT).apply {
                    description = "Claude terminó un turno"
                    enableVibration(true)
                    vibrationPattern = DONE_BUZZ
                },
                NotificationChannel(SERVICE, "Conexión", NotificationManager.IMPORTANCE_MIN).apply {
                    description = "La conexión con ntfy.sh que trae los avisos"
                    setShowBadge(false)
                },
            ),
        )
    }
```

`IMPORTANCE_HIGH` est ce qui fait qu’une alerte s’affiche par-dessus ce que vous faites. Les deux motifs de vibration sont la « propre façon » de vibrer de chacune : `NEEDS_BUZZ` vaut `0, 300, 120, 300, 120, 600` (trois impulsions, la dernière longue), `DONE_BUZZ` vaut `0, 200`. Une fois qu’un canal existe, Android vous laisse changer son son et sa vibration dans les réglages de notifications de l’application, et les valeurs de l’application ne sont qu’un point de départ.

`show` construit chaque notification :

- Elle sort tout de suite si les notifications sont désactivées pour l’application (le commentaire : « the person may have turned notifications off », la personne a peut-être désactivé les notifications).
- Titre et corps tels quels, avec `BigTextStyle` pour qu’un long corps puisse être déplié. Catégorie `REMINDER` pour les urgentes, `STATUS` pour les autres, et `setAutoCancel(true)`, pour qu’un toucher la fasse disparaître.
- **Le toucher et les boutons** sont des `PendingIntent` construits par `open` : une adresse `claude.ai` devient un intent explicite vers `MainActivity`, toute autre un `ACTION_VIEW` pour l’application qui la gère. Ils sont immuables (`FLAG_IMMUTABLE`), si bien qu’aucune autre application ne peut changer l’endroit où ils mènent.
- **L’image** est téléchargée depuis l’adresse `icon` avec des délais de connexion et de lecture de 5 secondes, et devient la grande icône. Si elle n’arrive pas à temps, la notification part sans elle. Cela s’exécute dans le thread du flux, qui peut se permettre d’attendre.
- `manager.notify(alert.tag, 0, ...)` : l’étiquette décide du remplacement. La même étiquette remplace la notification précédente ; une nouvelle étiquette en ajoute une.

Rien dans `show` ne fixe de délai d’expiration ni ne rend une notification permanente, donc chaque alerte, urgente ou non, reste dans le volet jusqu’à ce que vous la touchiez (`setAutoCancel`) ou la balayiez. Ce qui distingue les urgentes, c’est que leur canal les fait s’afficher par-dessus ce que vous faites et vibrer selon le motif long.

### Le toucher, retour dans l’application

Quand vous touchez une alerte, Android envoie l’intent explicite à `MainActivity` avec l’adresse. L’activité est `singleTask`, donc si elle est déjà ouverte elle reçoit l’adresse dans `onNewIntent` et la charge ; sinon, `onCreate` la charge à la place de la page par défaut. Dans les deux cas, `claudeIn` n’accepte que les adresses `claude.ai` ([guide 2](/fr/android/webview-host/)).

### `BootReceiver` : après un redémarrage ou une mise à jour

Un redémarrage tue tous les services. L’application écoute deux diffusions, `BOOT_COMPLETED` et `MY_PACKAGE_REPLACED`, et sur l’une comme l’autre elle appelle `AlertService.start`, qui ne démarre le service que si un sujet est enregistré. La seconde se déclenche après que vous relancez `./gradlew installDebug`, si bien qu’une mise à jour ne vous laisse pas sans alertes. La première demande l’autorisation `RECEIVE_BOOT_COMPLETED`, que le manifeste réclame.

### La batterie : Doze et les téléphones agressifs

Le mode Doze d’Android coupe l’accès réseau des applications pendant que le téléphone dort, et ne les réveille que dans de courtes fenêtres. Un service de premier plan aide, mais la connexion peut quand même être coupée. La solution est une exemption des optimisations de batterie, que vous seul ou seule pouvez accorder.

Le second bouton de l’écran des réglages s’en charge. Tant que l’application n’est pas exemptée (`PowerManager.isIgnoringBatteryOptimizations` dit non), **Permitir en segundo plano** est actif ; un toucher ouvre la boîte de dialogue d’Android elle-même (`ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`) pour cette application. Une fois l’exemption accordée, le bouton devient **Ya funciona en segundo plano** et se grise. Le code fait taire l’avertissement de lint `BatteryLife` pour cet appel, qui prévient que Google Play n’autorise cette demande que pour certains types d’applications ; cette application est installée depuis le code source.

Certains fabricants de téléphones vont plus loin et ferment d’eux-mêmes les applications en arrière-plan. Le README cite Infinix, Xiaomi et Huawei. Les tests du journal de tâches ont tourné sur un Infinix X6730B sous Android 15. Si les alertes cessent d’arriver, vérifiez **Permitir en segundo plano**, puis les réglages de batterie ou de lancement des applications propres au téléphone pour Narsil.

## Le construire avec Claude

Demandez à Claude le service et les règles séparément : une fonction Kotlin pure qui va d’un message ntfy à ce qu’affiche une notification, testée sur l’ordinateur, et un service de premier plan qui suit un sujet et lui confie chaque message. La seule idée qu’il doit bien saisir, c’est la reprise : le flux doit partir du dernier message affiché, et seules les adresses qui ne peuvent pas nuire obtiennent le toucher et l’image.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon application Android (Kotlin, `minSdk 29`, `targetSdk 36`), ajoute un service de premier plan de type `specialUse` (avec `PROPERTY_SPECIAL_USE_FGS_SUBTYPE` dans le manifeste) qui suit `https://ntfy.sh/<topic>/json` dans un thread démon avec `HttpURLConnection`, un délai de connexion de 15 s et de lecture de 90 s, un objet JSON par ligne, en ne gardant que `event == "message"`. Reprends avec `?since=<id>` à partir du dernier message affiché, enregistré dans `SharedPreferences` après chacun, et effacé quand le sujet change. Reconnecte-toi après une seconde quand le flux se termine, et avec une attente qui double jusqu’à 60 s après un échec. Mets les règles dans une fonction pure `Alert.of(JSONObject)` : une priorité de 4 ou plus va sur un canal de haute importance, une étiquette `conv-` sur une alerte non urgente devient l’étiquette de remplacement, deux actions `view` au plus deviennent des boutons, le toucher n’ouvre l’adresse `click` que si c’est `https://claude.ai`, et une grande icône n’est acceptée que depuis un seul préfixe d’URL fixe. Redémarre le service sur `BOOT_COMPLETED` et `MY_PACKAGE_REPLACED`. Ajoute un bouton qui demande l’exemption des optimisations de batterie. Teste `Alert.of` avec JUnit.

### Ce qu’il faut vérifier dans la réponse de Claude

1. `startForeground` est appelé au début de `onStartCommand`, avec le type `specialUse` seulement sur Android 14 et plus récent.
2. Le flux reprend à partir d’un identifiant enregistré, et enregistrer un nouveau sujet efface cet identifiant.
3. Un délai de lecture plus long que le keepalive de 45 secondes de ntfy.sh détecte une connexion morte.
4. Les échecs attendent chaque fois plus longtemps, jusqu’à un plafond, et une lecture qui fonctionne remet l’attente à zéro.
5. L’adresse du toucher et l’image sont restreintes ; les boutons sont limités à deux.
6. Chaque notification est publiée avec une étiquette, si bien qu’un message répété se remplace lui-même.
7. Les `PendingIntent` sont `FLAG_IMMUTABLE`.
8. Les règles n’ont pas de code Android, et leurs tests tournent avec `./gradlew testDebugUnitTest`.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « après une heure téléphone éteint, les alertes de cette heure ne sont jamais arrivées ».

### Comment l’auteur l’a demandé

Le premier message de l’auteur ou de l’autrice, consigné dans `odd/tasks/android-app.md` comme L1, demandait « una app movil completa, que reciba las notificaciones » (une application mobile complète, qui reçoive les notifications). Les autres règles de ce guide sont celles de l’agent, consignées dans la spécification et le journal, et non les mots de l’auteur ou de l’autrice. La spécification S5 dit que les alertes « keep the PWA's rules » (gardent les règles de la PWA, l’ancienne application web) : « sealed messages opened with the key (`narsil1:`), priority >= 4 stays until touched and buzzes its own way, a "done" replaces the previous one of its `conv-` tag, ntfy "view" actions as buttons, a tap opens Claude Code inside the app. » (les messages scellés ouverts avec la clé, `narsil1:` ; une priorité >= 4 reste jusqu’à ce qu’on la touche et vibre à sa façon ; un « done » remplace le précédent de son étiquette `conv-` ; les actions ntfy « view » comme boutons ; un toucher ouvre Claude Code dans l’application). La décision sur le type de service est citée plus haut.

Le journal consigne deux vérifications sur le téléphone. Avec un sujet jetable : « two done alerts of conv-a left one notification (tag done-conv-a, importance 3) and a priority 4 one its own (importance 4); accents arrive intact; a tap opened MainActivity on claude.ai/code. » (deux alertes done de conv-a ont laissé une seule notification, étiquette done-conv-a, importance 3, et une de priorité 4 la sienne, importance 4 ; les accents arrivent intacts ; un toucher a ouvert MainActivity sur claude.ai/code). Et avec le vrai sujet et la vraie clé, le 2026-11-24 à 00:44 : « The alert showed as an app notification on the urgent channel (importance 4) » (l’alerte s’est affichée comme notification de l’application sur le canal urgent, importance 4).

Les commits (un nom de projet dans un sujet de commit est remplacé par une description entre crochets) :

- `3bcea35` (2026-11-24) « feat: build the script that hosts [the earlier extension] in a WebView, and what alerts and states keep » (construire le script qui héberge [l’ancienne extension] dans une WebView, et ce que gardent les alertes et les états). `Alert.kt` et ses tests.
- `53c55c1` (2026-11-24) « feat: host claude.ai with [the earlier extension] in a WebView, and show Narsil's alerts from a foreground service » (héberger claude.ai avec [l’ancienne extension] dans une WebView, et afficher les alertes de Narsil depuis un service de premier plan). Son message : « alerts follow <topic> from the last one shown, also after a reboot. » (les alertes suivent <topic> à partir de la dernière affichée, y compris après un redémarrage).
- `9e514dd` (2026-11-24) « feat: open the settings from Narsil in the band and from the service's notification » (ouvrir les réglages depuis Narsil dans la bande et depuis la notification du service).
- `a275382` (2026-11-24) « docs: log the alerts and the band verified with the real topic and key » (consigner les alertes et la bande vérifiées avec le vrai sujet et la vraie clé).

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide (MIT). Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

Deux tests JUnit pour `Alert.of` avec des messages de la même forme que ceux du mod, avec des identifiants et un texte inventés. Mettez-les à côté de `AlertTest.kt` :

```kotlin
package io.github.davshn.narsil

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ModAlertTest {
    private val openClaude = JSONObject()
        .put("action", "view")
        .put("label", "Abrir Claude")
        .put("url", "https://claude.ai/code")

    @Test
    fun aQuestionFromTheModIsUrgentAndKeepsItsButton() {
        val m = JSONObject()
            .put("id", "example1")
            .put("title", "Narsil · Te necesito · web")
            .put("message", "¿Sigo con la migración?")
            .put("priority", 4)
            .put("tags", JSONArray().put("raising_hand"))
            .put("icon", "https://raw.githubusercontent.com/davshn/narsil-pet/main/assets/etapa3/necesita-oscuro.png")
            .put("actions", JSONArray().put(openClaude))
        val alert = Alert.of(m)
        assertTrue(alert.isUrgent)
        assertEquals("example1", alert.tag)
        assertEquals(listOf("Abrir Claude"), alert.views.map { it.label })
        assertEquals("https://claude.ai/code", alert.opens)
        assertNotNull(alert.icon)
    }

    @Test
    fun twoDonesWithoutAConversationTagDoNotReplaceEachOther() {
        fun done(id: String) = JSONObject()
            .put("id", id)
            .put("message", "He terminado")
            .put("priority", 3)
            .put("tags", JSONArray().put("white_check_mark"))
        assertNotEquals(Alert.of(done("example2")).tag, Alert.of(done("example3")).tag)
    }
}
```

Le second test documente le comportement actuel avec le mod : pas d’étiquette `conv-`, donc pas de remplacement. Pour voir le remplacement lui-même, publiez deux alertes avec une étiquette `conv-` sur un sujet inventé que vous avez mis dans les réglages ([ntfy : publier](https://docs.ntfy.sh/publish/)) :

```bash
curl -H "Tags: white_check_mark,conv-demo" -d "Primera" https://ntfy.sh/narsil-0000000000example0
curl -H "Tags: white_check_mark,conv-demo" -d "Segunda" https://ntfy.sh/narsil-0000000000example0
curl -H "Priority: 4" -H "Actions: view, Abrir Claude, https://claude.ai/code" -d "¿Sigo?" https://ntfy.sh/narsil-0000000000example0
```

Vous devriez voir une seule notification **Terminó** qui dit « Segunda », et une **Te necesita** qui s’affiche par-dessus, vibre trois fois et a un bouton `Abrir Claude`.

## Erreurs fréquentes et comment tester

- **Un service `dataSync`.** Sur Android 15, il est arrêté après six heures par jour. Déclarez le type qui convient, avec sa raison.
- **Lancer le flux à partir de maintenant à chaque redémarrage.** Les alertes envoyées pendant que le téléphone était éteint sont perdues. Reprenez à partir du dernier identifiant.
- **Pas de délai de lecture.** Une connexion morte avec un changement de réseau attend indéfiniment. Choisissez-en un plus long que le keepalive.
- **Réessayer tout de suite, sans fin.** Sans attente croissante, un téléphone sans réseau tourne en boucle. Plafonnez-la à une minute.
- **Faire confiance au sujet.** Sans clé, quiconque en connaît le nom peut publier une alerte. Restreignez le toucher, l’image et le nombre de boutons.
- **Publier sans étiquette.** Utilisez l’identifiant propre du message comme étiquette, pour qu’un message livré deux fois se remplace lui-même.
- **Ignorer l’exemption de batterie.** Les alertes arrivent par rafales quand le téléphone se réveille, avec des minutes de retard.
- **Attendre le remplacement avec le mod d’aujourd’hui.** Le mod n’envoie pas d’étiquette `conv-`, donc les tours terminés s’empilent.

Pour tester les règles, lancez `./gradlew testDebugUnitTest` : `AlertTest.kt` vérifie qu’une question ou une erreur est urgente, qu’un done avec une étiquette `conv-` remplace et qu’un done sans étiquette ne remplace pas, le texte scellé, le titre par défaut, la limite de deux boutons, la règle de `click` (une adresse d’un autre site retombe sur `claude.ai/code`) et la règle de l’image. Pour tester le service, publiez sur un sujet inventé comme plus haut, puis activez le mode avion, publiez deux fois et désactivez-le : les deux devraient arriver en moins d’une minute. `adb logcat -s NarsilNtfy` montre les échecs du flux et ses attentes (« ntfy.sh stream failed, again in 4 s », le flux ntfy.sh a échoué, nouvel essai dans 4 s).

### Là où le code et le README diffèrent

- Le README dit que chaque tour terminé « takes the place of the previous one of the same conversation » (prend la place du précédent de la même conversation). L’application les remplace bien quand un message porte une étiquette `conv-`, comme l’a montré le test du journal de tâches avec `conv-a`, mais `phoneMessage` de narsil-pet n’envoie aucune étiquette de ce genre aujourd’hui, seulement `white_check_mark`, `raising_hand` ou `warning`. Avec le vrai mod, chaque tour terminé est sa propre notification.
- Le README dit que les alertes manquées pendant que le téléphone était éteint arrivent « once it is back, as ntfy.sh keeps them for 12 hours » (à son retour, puisque ntfy.sh les garde 12 heures). C’est vrai dès que l’application a affiché au moins une alerte du sujet. Avant cela, et juste après un changement de sujet, il n’y a pas d’identifiant enregistré et le flux part du moment où il se connecte.
- Le README dit qu’une question ou une erreur « stays until you touch it » (reste jusqu’à ce que vous la touchiez), comme si un tour terminé ne restait pas. Dans le code, aucune notification n’est permanente ni minutée : les deux types restent jusqu’à ce que vous les touchiez ou les balayiez, et le canal urgent ajoute l’affichage par-dessus et la longue vibration.
- Le commentaire de la classe de `NtfyStream.kt` dit qu’elle suit le flux « as the band's lib/stream.js follows it » (comme le lib/stream.js de la bande le suit). Il n’y a pas de `lib/stream.js` dans ce dépôt ; le commentaire renvoie à l’ancienne extension.

## Pour aller plus loin

- Le [guide 7](/fr/android/encryption-and-settings/) ouvre `Seal.unseal`, la première étape de `take`, et explique l’écran des réglages et ses boutons.
- Le [guide 3](/fr/android/conversation-band/) réutilise `NtfyStream` pour `<topic>-estado`, à partir de `since=12h`.
- Côté mod, [Les alertes sur votre téléphone et votre montre](/fr/mods/pet/phone-and-watch/) explique quand le mod envoie, la limite quotidienne de 200 et le sujet.
- [Narsil Watch](/fr/watch/what-it-is/) affiche l’état de Narsil sur une montre Wear OS, à partir du même sujet `-estado`.
- Le code source est sur [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
