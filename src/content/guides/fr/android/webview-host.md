---
title: L’hôte WebView
description: 'Comment MainActivity héberge claude.ai : réglages de la WebView, session gardée, fichiers et micro, où vont les liens, et comment PageScript et host.js lancent Narsil au début de chaque page.'
route: android
order: 2
updated: 2026-11-24
sources:
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/MainActivity.kt
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/PageScript.kt
  - repo: android
    path: app/src/main/assets/host.js
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/Links.kt
  - repo: android
    path: app/src/test/java/io/github/davshn/narsil/PageScriptTest.kt
  - repo: android
    path: app/src/main/AndroidManifest.xml
---

## Ce que ça fait

L’hôte, c’est tout ce que fait l’application pour que `claude.ai` s’exécute à l’intérieur avec Narsil par-dessus. Il vit surtout dans un fichier, `MainActivity.kt`, avec deux aides : `PageScript.kt`, qui construit le script exécuté au début de chaque page, et `assets/host.js`, la partie de ce script qui joue le rôle d’un navigateur pour les scripts de page de Narsil.

De l’extérieur, vous ne remarquez que les résultats :

- Claude s’ouvre sur `claude.ai/code`, en plein écran, entre les barres système et au-dessus du clavier.
- Vous vous connectez une fois, et la session survit quand Android ferme l’application.
- Le bouton **+** ouvre le sélecteur de fichiers du téléphone, et la dictée peut utiliser le micro.
- `claude.ai` reste dans l’application. Tout autre lien s’ouvre dans votre navigateur, et les connexions de Google et d’Apple affichent un message à la place.
- Le bouton retour revient en arrière dans Claude et, depuis la première page de Claude, envoie l’application en arrière-plan.
- Les couleurs et la bande de Narsil sont sur chaque page `claude.ai` dès son tout premier instant.

> **Expérimental.** L’hôte exécute les scripts de Narsil dans une page qu’il ne contrôle pas. Ils dépendent de la structure de `claude.ai` et de ses requêtes internes, pas d’une API publique, donc une mise à jour de Claude peut les casser. L’hôte est construit pour que, quand cela arrive, Claude lui-même continue de fonctionner : chaque script s’exécute de son côté, et une erreur dans l’un est consignée dans le journal et laisse les autres tourner.

## Comment ça marche à l’intérieur

### Les réglages de la WebView

`onCreate` construit la WebView dans le code, à l’intérieur d’un `FrameLayout`, et règle ce dont `claude.ai` a besoin. Cet extrait vient de `MainActivity.kt` dans narsil-android (MIT) :

```kotlin
        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            // A page's popups (Google's sign-in button opens one) reach onCreateWindow, which decides where they go.
            setSupportMultipleWindows(true)
            javaScriptCanOpenWindowsAutomatically = true
        }
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(web, true)
        }
```

JavaScript et le stockage DOM sont désactivés par défaut dans une WebView, et `claude.ai` est une application JavaScript qui garde son état dans le stockage, donc les deux sont activés. Les médias peuvent se lire sans qu’on touche l’écran. Les fenêtres pop-up sont autorisées, mais seulement pour que l’application puisse les attraper (plus bas). Les cookies sont acceptés, y compris les cookies tiers ; le code ne dit pas quelle page en a besoin.

Deux lignes de plus comptent pour l’écran. Android 15 dessine les applications d’un bord à l’autre, sous la barre d’état, la barre de navigation et le clavier. L’activité appelle `enableEdgeToEdge()`, puis ajoute à son cadre une marge de la taille des barres système et du clavier (`WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime()`), pour que la page tienne entre eux. Le manifeste liste aussi chaque changement de configuration que l’application gère elle-même (`orientation|screenSize|...|uiMode|density`), si bien que tourner le téléphone ne reconstruit pas l’activité et ne recharge pas Claude.

### Se connecter une fois : écrire le cookie sur le disque

Votre session avec `claude.ai` est un cookie. Le `CookieManager` de la WebView garde les cookies en mémoire et les écrit sur le disque quand il le décide. Si Android tue l’application avant, la session est perdue et vous vous reconnectez. Alors l’application les écrit elle-même chaque fois qu’elle passe en arrière-plan :

```kotlin
    // The session's cookie reaches the disk now, not when Android gets to it: a killed app keeps its sign-in.
    override fun onPause() {
        CookieManager.getInstance().flush()
        web.onPause()
        super.onPause()
    }
```

`onPause` s’exécute chaque fois que l’application cesse d’être au premier plan : vous changez d’application, verrouillez le téléphone ou ouvrez les réglages. C’est le dernier moment où l’application est sûre de s’exécuter avant qu’Android puisse la fermer. La spécification S3 demandait exactement cela : « login once and the session stays (cookies flushed to disk) » (se connecter une fois et la session reste, cookies écrits sur le disque).

### Où va chaque lien

Chaque navigation demandée par la page arrive à `shouldOverrideUrlLoading`, qui interroge `Links.isInApp` (le [guide 1](/fr/android/what-it-is/) cite `Links.kt` en entier). Renvoyer `false` laisse la WebView la charger ; renvoyer `true` l’arrête, et `goOut` décide de ce qui se passe à la place :

- **Les connexions de Google et d’Apple** (`accounts.google.com`, `appleid.apple.com`) : rien ne s’ouvre, et un long toast dit de se connecter avec un e-mail.
- **Tout le reste** : `ACTION_VIEW` d’Android avec la catégorie `BROWSABLE`, qui ouvre votre navigateur ou l’application qui gère l’adresse. Si aucune ne le fait, l’application écrit dans le journal « Nothing opens » (rien ne s’ouvre) et l’adresse.

Les fenêtres pop-up ont besoin de leur propre chemin. Le bouton de Google en ouvre une, et une WebView qui n’a pas de fenêtre à lui donner l’abandonne, ce qui explique pourquoi la connexion restait bloquée. Maintenant, `onCreateWindow` donne à la page une WebView jetable qui ne s’affiche jamais. Son seul rôle est d’entendre la première adresse que veut la fenêtre pop-up : une adresse `claude.ai` se charge dans la WebView principale, tout le reste va à `goOut`, et la WebView jetable est détruite. Dans les mots du code : « The popup's opener sees it closed. » (celui qui a ouvert la fenêtre pop-up la voit fermée).

Des adresses viennent aussi de l’extérieur : le toucher d’une alerte, ou un lien `claude.ai` qu’Android confie à l’application. Les deux arrivent sous forme d’`Intent`, au lancement ou dans `onNewIntent`, puisque l’activité est `singleTask` et qu’il n’en existe qu’une copie. `claudeIn(intent)` ne garde l’adresse que si `Links.isClaude` l’accepte, si bien qu’une autre application ne peut pas faire charger à celle-ci une page qui n’est pas Claude.

### Les fichiers et le micro

Quand la page demande un fichier, la WebView appelle `onShowFileChooser`. L’application ouvre le sélecteur de documents d’Android (`ActivityResultContracts.OpenMultipleDocuments`) avec les types que la page accepte, ou `*/*` quand elle n’en nomme aucun, et rend les adresses choisies à la page. Une demande encore en attente reçoit d’abord `null` en réponse, pour que la page n’attende jamais un sélecteur qui a disparu.

Le micro est le seul périphérique que la page peut utiliser :

```kotlin
        // The microphone, for dictating to Claude; nothing else the page may ask for.
        override fun onPermissionRequest(request: PermissionRequest) {
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE !in request.resources || !Links.isClaude(request.origin.toString())) {
                request.deny()
                return
            }
            if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                request.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
            } else {
                microphone = request
                askMicrophone.launch(Manifest.permission.RECORD_AUDIO)
            }
        }
```

Deux autorisations sont en jeu. La page demande à la WebView, et la WebView demande à l’application (`onPermissionRequest`). L’application elle-même a besoin de `RECORD_AUDIO` d’Android, que vous accordez une fois, la première fois. Une demande qui vient d’ailleurs que de `https://claude.ai`, ou qui porte sur autre chose que l’audio, est refusée, et même une demande d’audio et de vidéo n’obtient que l’audio.

### Comment l’application se présente

Chaque requête qu’envoie une WebView porte son user agent, un texte qui nomme le moteur et, sur Android, le marque comme WebView avec `; wv`. Certaines connexions et certaines vérifications anti-robots refusent les WebViews à cause de cette marque.

L’historique montre que l’auteur ou l’autrice a essayé les deux voies. Le commit `bfa379a` « fix: present the WebView as Chrome, and let a debug build's page be inspected » (présenter la WebView comme Chrome, et permettre d’inspecter la page d’une version de débogage) a retiré `; wv` et `Version/4.0` du user agent, avec le commentaire « As Chrome on Android » (comme Chrome sur Android). Sept minutes plus tard, `38cb33c` l’a défait : « The user agent is the WebView's own again: the app does not pass itself off as Chrome to get past a sign-in's check. » (le user agent est de nouveau celui de la WebView : l’application ne se fait pas passer pour Chrome pour franchir la vérification d’une connexion). Aujourd’hui, le code ne touche plus du tout à `userAgentString`, et la section Security du README dit : « The app pretends nothing: Claude, Google, and Cloudflare see it as the Android app it is. » (l’application ne fait semblant de rien : Claude, Google et Cloudflare la voient comme l’application Android qu’elle est). C’est aussi pour cela qu’on ne force pas la connexion de Google à fonctionner : la réponse honnête, c’est le message sur l’e-mail.

### Regarder à l’intérieur : inspection de débogage et logcat

La page d’une WebView ne peut être inspectée depuis les DevTools d’un Chrome de bureau que si l’application le permet. L’application ne le permet que pour les versions de débogage :

```kotlin
        // A debug build's page can be inspected from a computer, at chrome://inspect.
        if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) WebView.setWebContentsDebuggingEnabled(true)
```

`./gradlew installDebug` installe une version de débogage, donc avec le téléphone branché par USB, `chrome://inspect` sur l’ordinateur liste la page. Les preuves du journal de tâches ont été recueillies ainsi : « through DevTools the page has narsilHostLoaded, a live narsilWatch, both style marks and the night ground rgb(15, 26, 44) » (dans les DevTools, la page a narsilHostLoaded, un narsilWatch actif, les deux marques de style et le fond de nuit rgb(15, 26, 44)). Retenez ce que cela signifie : quiconque a votre téléphone déverrouillé branché à un ordinateur avec le débogage USB autorisé peut voir votre page Claude.

La console de la page arrive aussi dans le journal d’Android : `onConsoleMessage` écrit chaque message dans logcat avec l’étiquette `NarsilWeb`, avec son niveau, son fichier et sa ligne. `adb logcat -s NarsilWeb` les affiche, y compris les erreurs `narsil: <file>` décrites plus bas.

### PageScript : un seul script, dans l’ordre

Les scripts de la bande ont été écrits comme content scripts d’extension, qu’un navigateur exécute par groupes et dans un ordre fixe. Une WebView n’a rien de tel : elle prend un script par enregistrement. Alors `PageScript.build` coud tout en un seul script, dans l’ordre qu’attendent les scripts. Depuis `PageScript.kt` dans narsil-android (MIT) :

```kotlin
object PageScript {
    private val STYLES = listOf("page/skin.css", "page/band.css")
    private val AT_START = listOf("page/lib/watch.js", "page/lib/mode.js", "page/mode.js")
    private val AT_IDLE = listOf("page/lib/restore.js", "page/lib/state.js", "page/lib/live.js", "page/content.js")

    fun build(read: (String) -> String): String {
        val css = STYLES.joinToString("\n") { read(it) }
        fun run(path: String) = "run(${jsString(path)}, function () {\n${read(path)}\n})\n"
        return buildString {
            append("(() => {\n")
            append("if (window.top !== window || self.narsilHostLoaded || !self.narsilHost) return\n")
            append("self.narsilHostLoaded = true\n")
            append("const run = (name, code) => { try { code() } catch (error) { console.error('narsil: ' + name, error) } }\n")
            append("const NARSIL_CSS = ${jsString(css)}\n")
            append(read("host.js")).append('\n')
            AT_START.forEach { append(run(it)) }
            append("self.narsilWatch(adopt)\n")
            append("const idle = () => {\n")
            AT_IDLE.forEach { append(run(it)) }
            append("}\n")
            append("if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', idle, { once: true })\n")
            append("else idle()\n")
            append("})()\n")
        }
    }
```

Lisez-le de haut en bas, comme la page l’exécute :

1. **Une garde.** Sortir tout de suite dans un cadre qui n’est pas la fenêtre principale, si le script a déjà tourné dans ce document, ou si le canal de l’application (`narsilHost`) manque.
2. **`run`**, une enveloppe qui attrape toute erreur, la consigne comme `narsil: <file>` et continue. Chaque fichier s’exécute dans sa propre fonction, donc un fichier cassé ne peut pas arrêter le reste.
3. **`NARSIL_CSS`**, les deux feuilles de style réunies en une seule chaîne JavaScript.
4. **`host.js`**, qui construit la feuille de style, la pose sur la page et définit `browser` (plus bas).
5. **Le premier groupe, tout de suite** : l’observateur de la page (`lib/watch.js`) et le mode clair ou sombre (`lib/mode.js`, `mode.js`). Ils doivent agir avant que la page se dessine, ce que le [guide 5](/fr/android/colors-and-mode/) explique.
6. **`self.narsilWatch(adopt)`** : à chaque changement que voit l’observateur, remettre la feuille de style si la page l’a retirée.
7. **Le second groupe, une fois le document analysé** : les scripts de la bande. Si le document est encore en train de se charger, ils attendent `DOMContentLoaded`, à peu près le moment où tournerait le groupe `document_idle` d’une extension : le balisage de la page est là, prêt à être trouvé.

`jsString` transforme un fichier en littéral de chaîne JavaScript en échappant les barres obliques inverses, les guillemets, les sauts de ligne et les deux caractères U+2028 et U+2029, que l’ancien JavaScript traitait comme des sauts de ligne à l’intérieur des chaînes. `read` est une fonction passée en paramètre, pour que les tests puissent construire le script à partir de faux fichiers. `PageScriptTest.kt` vérifie que chaque fichier est présent et dans l’ordre, que le second groupe attend le document, que les deux styles entrent comme une seule chaîne entre guillemets, et que la garde est là.

### Au début du document, seulement sur `claude.ai`, seulement dans le cadre principal

`MainActivity.host()` enregistre le script et le canal. Depuis `MainActivity.kt` (MIT) :

```kotlin
    private fun host() {
        val origins = setOf(ORIGIN)
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) ||
            !WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)
        ) {
            Log.w(TAG, "This WebView cannot run the band: update Android System WebView")
            return
        }
        WebViewCompat.addWebMessageListener(web, "narsilHost", origins) { _, message, origin, isMainFrame, proxy ->
            if (!isMainFrame || origin.toString() != ORIGIN) return@addWebMessageListener
            val m = try {
                JSONObject(message.data ?: return@addWebMessageListener)
            } catch (_: Exception) {
                return@addWebMessageListener
            }
            when (m.optString("kind")) {
                "connect" -> {
                    reply = proxy
                    feed.start()
                }
                "disconnect" -> if (reply === proxy) {
                    reply = null
                    feed.stop()
                }
                "port" -> if (m.optJSONObject("message")?.optString("type") == "settings") openSettings()
                "settings" -> openSettings()
            }
        }
        val script = PageScript.build { path -> assets.open(path).bufferedReader().use { it.readText() } }
        WebViewCompat.addDocumentStartJavaScript(web, script, origins)
    }
```

Les deux appels viennent d’`androidx.webkit` et prennent la même règle d’origine, `https://claude.ai` :

- **`addDocumentStartJavaScript`** exécute le script dans chaque document correspondant avant tous les scripts propres à la page, ce qui permet aux couleurs de l’emporter dès la première image.
- **`addWebMessageListener`** place un objet nommé `narsilHost` dans les cadres correspondants. La page appelle `narsilHost.postMessage(text)` ; l’application reçoit le texte, l’origine, l’indication qu’il vient ou non du cadre principal, et un proxy de réponse pour répondre.

Les vérifications sont en couches. La WebView elle-même ne donne ni le script ni `narsilHost` à une autre origine. La garde du script quitte tout cadre qui n’est pas la fenêtre principale. Et l’écouteur abandonne un message qui ne vient pas du cadre principal de `https://claude.ai`, ou qui n’est pas du JSON. Le README le résume : « The band's scripts and the channel to the app run only on `https://claude.ai`, in the page itself and not in its frames. » (les scripts de la bande et le canal vers l’application ne s’exécutent que sur `https://claude.ai`, dans la page elle-même et pas dans ses cadres).

Quand une nouvelle page commence à se charger (`onPageStarted`), l’application oublie son proxy de réponse et arrête le flux d’état, puisque l’ancienne page n’est plus là.

### Servir les fichiers de Narsil depuis `claude.ai/__narsil__/`

La bande montre l’icône propre de l’application quand elle n’a pas d’image de Narsil. Une page ne peut pas charger directement un fichier des assets de l’application, et la Content Security Policy de `claude.ai` limite d’où peuvent venir les images. L’application utilise `WebViewAssetLoader` pour répondre aux requêtes vers `https://claude.ai/__narsil__/` depuis ses propres assets :

```kotlin
        private val files = WebViewAssetLoader.Builder()
            .setDomain("claude.ai")
            .addPathHandler("/__narsil__/", WebViewAssetLoader.AssetsPathHandler(this@MainActivity))
            .build()
```

La requête n’atteint jamais le réseau : `shouldInterceptRequest` y répond avec l’asset. Pour la page, le fichier vient de sa propre origine, « where the page's own policy lets them load » (là où la politique propre de la page les laisse se charger), comme le dit le commentaire de la classe. Tout le reste sous `claude.ai` passe sans être touché.

### `host.js` : un navigateur pour les scripts de page

Les scripts de page de Narsil ont été écrits pour une extension. Ils appellent `browser.runtime.getURL`, ouvrent un port avec `browser.runtime.connect`, envoient `browser.runtime.sendMessage` et regardent `browser.runtime.id` pour savoir si leur extension est toujours en vie. `host.js` leur donne un objet `browser` avec exactement ces parties, et répond à chacune :

| Les scripts appellent          | `host.js` répond                                                                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `runtime.id`                   | Toujours `'narsil-android'`, pour que les scripts ne se croient jamais orphelins.                                                        |
| `runtime.getURL(path)`         | `https://claude.ai/__narsil__/page/` suivi du chemin.                                                                                    |
| `runtime.getManifest()`        | Seulement ce que les scripts y lisent : un groupe dont les styles sont `skin.css` et `band.css`.                                         |
| `runtime.connect({ name })`    | Un port. Il envoie `connect` à l’application ; les messages de l’application arrivent sur son `onMessage` ; `postMessage` envoie `port`. |
| `runtime.sendMessage(message)` | Pour `narsil-missing` (les scripts ont remarqué que les styles ont disparu), il remet la feuille de style. Répond toujours `true`.       |
| `runtime.onMessage`            | Une liste d’écouteurs que l’application n’appelle jamais ; les scripts s’y inscrivent, et rien d’autre ne se passe.                      |

Les styles sont posés comme une feuille de style construite : `host.js` crée une `CSSStyleSheet`, la remplit avec `replaceSync(NARSIL_CSS)` et l’ajoute à `document.adoptedStyleSheets`. Le commentaire du fichier donne la raison : les feuilles de style construites sont celles « which the page's CSP does not govern » (que la CSP de la page ne régit pas), alors qu’un élément `<style>` ajouté par un script pourrait être refusé. La page remplace parfois ses propres feuilles adoptées, alors `adopt()` vérifie et remet celle de Narsil à chaque changement que voit l’observateur.

`host.js` ajoute une chose dont une extension n’avait pas besoin. L’application n’a pas de menu de navigateur depuis lequel atteindre ses réglages, alors un toucher n’importe où sur l’image ou le niveau de Narsil dans le bloc du menu latéral (`#narsil-band .narsil-head`) envoie `{ kind: 'settings' }`. Il écoute pendant la phase de capture, pour que le toucher soit vu avant que la page puisse l’arrêter.

### Le canal, message par message

Tous les messages sont du texte JSON.

| Sens               | Message                     | Ce qui se passe                                                                               |
| ------------------ | --------------------------- | --------------------------------------------------------------------------------------------- |
| Page → application | `{ kind: 'connect', name }` | L’application garde ce proxy de réponse et commence à suivre `<topic>-estado`.                |
| Page → application | `{ kind: 'disconnect' }`    | Si c’est le proxy actuel, l’application arrête de suivre.                                     |
| Page → application | `{ kind: 'port', message }` | Seul `message.type === 'settings'` fait quelque chose : il ouvre les réglages.                |
| Page → application | `{ kind: 'settings' }`      | Ouvre les réglages.                                                                           |
| Application → page | `{ type: 'model', model }`  | L’état le plus récent que la bande doit afficher ([guide 3](/fr/android/conversation-band/)). |
| Application → page | `{ type: 'no-topic' }`      | Il n’y a pas encore de sujet : le bloc vous demande de toucher et d’en écrire un.             |

La bande envoie aussi `{ type: 'awake' }` sur son port toutes les 25 secondes, une habitude héritée de l’extension, où cela gardait éveillé un worker d’arrière-plan endormi. L’application l’ignore.

### Le pont comme frontière de sécurité

Un canal entre une page web et du code natif est une porte, et la question est toujours de savoir ce qui peut la franchir. Ici, très peu de choses :

- **Vers l’application, la page peut faire trois choses** : demander de commencer à suivre l’état, demander d’arrêter, et ouvrir l’écran des réglages. Tout autre message est ignoré. Aucun message ne porte une URL à ouvrir, un fichier à lire ou une valeur à enregistrer.
- **Depuis l’application, la page ne reçoit que l’état ouvert** : le JSON que le mod a envoyé à `-estado`, après déchiffrement. Le sujet et la clé restent dans Kotlin. Ils font partie de l’adresse et du déchiffrement que l’application fait elle-même, et ils ne sont jamais envoyés.
- **N’importe quel script du cadre principal de `claude.ai` peut utiliser `narsilHost`**, le code propre de `claude.ai` compris, puisqu’il partage la page avec les scripts de Narsil. Le pire qu’il puisse faire, c’est lire le même état que montre la bande et ouvrir les réglages.

Le sens inverse compte aussi. Ce qui arrive de ntfy.sh peut avoir été écrit par quiconque connaît votre sujet, donc les scripts de page le traitent comme non fiable : le texte entre avec `textContent`, et une image seulement depuis le dossier propre de Narsil sur GitHub.

## Le construire avec Claude

Demandez d’abord à Claude un hôte minimal : une WebView qui exécute un script au début du document sur une seule origine, avec un canal de messages par lequel le script peut parler. Ensuite, faites-le grandir. La seule idée qu’il doit bien saisir, c’est que le script et le canal n’existent que sur `https://claude.ai`, seulement dans le cadre principal, et que l’application le vérifie de nouveau à chaque message.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon application Android (Kotlin, `androidx.webkit` 1.18), l’activité principale affiche `https://claude.ai/code` dans une WebView. Si `WebViewFeature` prend en charge `WEB_MESSAGE_LISTENER` et `DOCUMENT_START_SCRIPT`, enregistre un écouteur de messages web nommé `myHost` et un script de début de document, tous deux pour la seule règle d’origine `https://claude.ai`. Construis le script dans un objet Kotlin pur à partir de fichiers d’assets : une garde qui sort sauf si `window.top === window`, que `self.myHost` existe et qu’il n’a pas encore tourné ; chaque fichier enveloppé dans son propre `try/catch` qui consigne le nom du fichier ; le CSS réuni en un seul littéral de chaîne échappé. Dans l’écouteur, abandonne tout ce qui ne vient pas du cadre principal de `https://claude.ai` ou qui n’est pas du JSON, et n’agis que sur une liste fixe de valeurs `kind`. Sers `https://claude.ai/__mine__/` depuis les assets avec `WebViewAssetLoader`. N’envoie jamais aucun réglage à la page. Ajoute des tests JUnit pour l’ordre et l’échappement du constructeur de script.

### Ce qu’il faut vérifier dans la réponse de Claude

1. `addWebMessageListener` et `addDocumentStartJavaScript` reçoivent tous deux le même ensemble d’origines restreint, pas `"*"`.
2. L’écouteur vérifie lui-même `isMainFrame` et l’origine, même si la règle d’origine filtre déjà.
3. La première ligne du script sort dans les iframes et lors d’une deuxième exécution.
4. Chaque fichier s’exécute dans son propre `try/catch`, donc une erreur n’arrête pas les autres.
5. L’échappement des chaînes gère `\`, `"`, `\n`, `\r`, U+2028 et U+2029, et un test le prouve.
6. Il y a une vérification des fonctionnalités avec une ligne de journal claire, et Claude se charge quand même si elle échoue.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « le script tourne deux fois dans le cadre de Cloudflare ».

### Comment l’auteur l’a demandé

Les mots de l’auteur ou de l’autrice sont consignés dans le journal de tâches, `odd/tasks/android-app.md`. Le premier, L1, demandait une vue web qui « muestre la web de claude y modifique sus estilos como lo hace esta extension » (affiche le site de Claude et en modifie les styles comme le fait cette extension). L3 ajoutait : « recuerda que los estilos que va a inyectar seran los de la extension […] » (rappelle-toi que les styles qu’elle injectera seront ceux de l’extension ; le nom de l’ancien projet est omis ici). La spécification S2 de l’agent en fait le design de ce guide : « the extension's content scripts and CSS run unchanged inside the WebView, with a `browser` shim the app answers natively. » (les content scripts et le CSS de l’extension s’exécutent sans changement dans la WebView, avec une cale `browser` à laquelle l’application répond nativement).

Le reste est reconstitué à partir de l’historique des commits (un nom de projet dans un sujet de commit est remplacé par une description entre crochets) :

- `3bcea35` (2026-11-24) « feat: build the script that hosts [the earlier extension] in a WebView, and what alerts and states keep » (construire le script qui héberge [l’ancienne extension] dans une WebView, et ce que gardent les alertes et les états). Son message : « host.js answers the extension's browser calls; the styles go on as a constructed style sheet. » (host.js répond aux appels browser de l’extension ; les styles sont posés comme une feuille de style construite).
- `53c55c1` (2026-11-24) « feat: host claude.ai with [the earlier extension] in a WebView, and show Narsil's alerts from a foreground service » (héberger claude.ai avec [l’ancienne extension] dans une WebView, et afficher les alertes de Narsil depuis un service de premier plan). `MainActivity` voit le jour.
- `bfa379a` (2026-11-24) « fix: present the WebView as Chrome, and let a debug build's page be inspected » (présenter la WebView comme Chrome, et permettre d’inspecter la page d’une version de débogage).
- `38cb33c` (2026-11-24) « fix: say to sign in with an email when Google's or Apple's sign-in is asked for, instead of hanging » (dire de se connecter avec un e-mail quand la connexion de Google ou d’Apple est demandée, au lieu de rester bloqué). Les fenêtres pop-up et le user agent honnête.
- `9e514dd` (2026-11-24) « feat: open the settings from Narsil in the band and from the service's notification » (ouvrir les réglages depuis Narsil dans la bande et depuis la notification du service). Son message : « The launcher shortcut is not shown by every launcher, and the band's notice only shows without a topic. » (tous les lanceurs n’affichent pas le raccourci, et l’avis de la bande ne s’affiche que sans sujet).
- `5ad4577` (2026-11-24) « refactor: make the band's scripts the app's own, and stop naming the projects it replaces » (faire des scripts de la bande ceux de l’application, et ne plus nommer les projets qu’elle remplace). `assets/extension` est devenu `assets/page` et `ExtensionScript` est devenu `PageScript`, suivant la L4 de l’auteur ou de l’autrice.

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide (MIT). Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

Un hôte minimal de la même forme que `MainActivity` : une origine, un script de début de document, un canal et une règle de liens. Il réutilise `Links` de l’application.

```kotlin
package io.github.davshn.narsil

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

class TinyHostActivity : ComponentActivity() {
    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val web = WebView(this)
        setContentView(web)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        val origins = setOf("https://claude.ai")
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) &&
            WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)
        ) {
            WebViewCompat.addWebMessageListener(web, "myHost", origins) { _, message, origin, isMainFrame, reply ->
                if (!isMainFrame || origin.toString() != "https://claude.ai") return@addWebMessageListener
                if (message.data == "hello") reply.postMessage("hi from the app")
            }
            WebViewCompat.addDocumentStartJavaScript(web, SCRIPT, origins)
        }
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (Links.isInApp(request.url.toString())) return false
                startActivity(Intent(Intent.ACTION_VIEW, request.url).addCategory(Intent.CATEGORY_BROWSABLE))
                return true
            }
        }
        web.loadUrl(Links.CLAUDE_CODE)
    }

    override fun onPause() {
        CookieManager.getInstance().flush()
        super.onPause()
    }

    private companion object {
        const val SCRIPT = """
            if (window.top === window && self.myHost && !self.myHostLoaded) {
              self.myHostLoaded = true
              myHost.addEventListener('message', (event) => {
                document.documentElement.dataset.myHost = event.data
              })
              myHost.postMessage('hello')
            }
        """
    }
}
```

Déclarez l’activité dans le manifeste comme activité de lancement, puis ouvrez la page dans `chrome://inspect` (avec `WebView.setWebContentsDebuggingEnabled(true)` dans une version de débogage) et regardez l’élément `<html>` : il devrait porter `data-my-host="hi from the app"`. Chargez n’importe quel autre site dans la même WebView et `self.myHost` y vaut `undefined`. `startActivity` lève `ActivityNotFoundException` quand aucune application ne peut ouvrir une adresse ; le vrai `goOut` l’attrape, et le vôtre devrait le faire aussi avant de le publier.

## Erreurs fréquentes et comment tester

- **`"*"` comme règle d’origine.** Le canal et le script atteindraient chaque page et chaque cadre que la WebView charge un jour, publicités et pages de connexion comprises. Nommez la seule origine.
- **Se fier à la seule règle d’origine.** Les cadres de la même origine reçoivent aussi l’objet. Vérifiez `isMainFrame` dans l’écouteur.
- **Un seul `try` autour de tout.** Une seule erreur, par exemple dans la bande après une mise à jour de Claude, ferait tomber aussi les couleurs. Enveloppez chaque fichier.
- **Oublier `flush()`.** La session fonctionne jusqu’à ce qu’Android tue l’application en arrière-plan, puis vous vous reconnectez.
- **Ignorer les fenêtres pop-up.** Avec `setSupportMultipleWindows(false)`, un bouton de connexion qui ouvre une fenêtre pop-up ne fait rien du tout. Attrapez-la dans `onCreateWindow`.
- **Falsifier le user agent.** Cela peut passer une vérification aujourd’hui et échouer demain, et cela cache ce qu’est l’application. L’application y a renoncé dans `38cb33c`.
- **Envoyer un réglage à la page.** N’importe quel script de la page pourrait alors le lire. Gardez le sujet et la clé côté Kotlin.
- **Accorder toutes les demandes d’autorisation.** N’accordez que le micro, et seulement à `claude.ai`.

Pour le tester sur le téléphone, installez une version de débogage, ouvrez `chrome://inspect` sur l’ordinateur et, dans la console de la page, vérifiez `self.narsilHostLoaded` (doit valoir `true`), `typeof narsilHost` (`object`) et `document.adoptedStyleSheets.length` (au moins un). Dans une iframe de la page, `self.narsilHostLoaded` devrait valoir `undefined`. Ensuite, `adb logcat -s NarsilWeb` montre la console de la page ; une ligne qui commence par `narsil:` nomme un script qui a levé une erreur.

Pour tester le constructeur de script sans téléphone, lancez `./gradlew testDebugUnitTest` : `PageScriptTest` construit le script à partir de faux fichiers et vérifie l’ordre, le groupe qui attend, les guillemets et la garde.

### Là où le code et le README diffèrent

- Le README dit : « A debug build's page can be inspected from a computer at `chrome://inspect`; its console goes to logcat with the `NarsilWeb` tag. » (la page d’une version de débogage peut être inspectée depuis un ordinateur à `chrome://inspect` ; sa console va dans logcat avec l’étiquette `NarsilWeb`). Dans le code, l’inspection est limitée aux versions de débogage ; la console ne l’est pas : `onConsoleMessage` écrit dans logcat dans n’importe quelle version. Comme la seule installation documentée est `installDebug`, la différence n’apparaît que si vous construisez vous-même une version de production.

## Pour aller plus loin

- Le [guide 3](/fr/android/conversation-band/) suit l’état depuis le canal de l’application jusqu’à la bande au-dessus de la zone de message.
- Le [guide 5](/fr/android/colors-and-mode/) explique pourquoi le premier groupe de scripts s’exécute tout de suite et comment les couleurs évitent un flash.
- Le [guide 7](/fr/android/encryption-and-settings/) couvre les réglages que le pont ouvre, et pourquoi le sujet et la clé restent hors de la page.
- Côté mod, [Les alertes sur votre téléphone et votre montre](/fr/mods/pet/phone-and-watch/) décrit l’état `-estado` que transporte le canal.
- Le code source est sur [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
