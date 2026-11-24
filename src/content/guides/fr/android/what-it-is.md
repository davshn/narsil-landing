---
title: Ce qu’est Narsil pour Android
description: 'Une application Android expérimentale qui ouvre claude.ai dans une WebView avec les couleurs, la bande et le bloc latéral de Narsil, et change les alertes du mod sur ntfy.sh en notifications.'
route: android
order: 1
updated: 2026-11-24
sources:
  - repo: android
    path: README.md
  - repo: android
    path: odd/tasks/android-app.md
  - repo: android
    path: app/src/main/AndroidManifest.xml
  - repo: android
    path: app/build.gradle.kts
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/Links.kt
  - repo: pet
    path: hooks/register.tsx
---

## Ce que ça fait

Narsil pour Android est une application pour téléphone qui réunit deux choses au même endroit : l’application web de Claude, `claude.ai`, et les alertes que le [mod Narsil](/fr/mods/pet/phone-and-watch/) envoie à votre téléphone. Vous l’ouvrez comme n’importe quelle application. À l’intérieur, vous voyez le vrai `claude.ai`, connecté avec votre compte : vous approuvez les autorisations, répondez aux questions, envoyez des fichiers et lisez des conversations entières comme toujours. Par-dessus, Narsil ajoute ses propres touches :

- **Les couleurs de Narsil.** Claude porte la palette mer de nuit de Narsil Skin, claire de 6:00 à 17:59 et sombre le reste de la journée, quelle que soit l’apparence choisie dans Claude ([guide 5](/fr/android/colors-and-mode/)).
- **La bande.** Juste au-dessus de la zone où vous écrivez, une bande montre la conversation ouverte : Narsil dans la pose de son état, l’état (`TRABAJANDO` (au travail), `TE NECESITA` (a besoin de vous), `TERMINADA` (terminée) ou `EN REPOSO` (au repos)), le contexte utilisé, le compte à rebours du cache et la dernière chose que Claude a dite ([guide 3](/fr/android/conversation-band/)).
- **Le bloc du menu latéral.** Sous la recherche du menu latéral de Claude : le niveau et l’expérience de Narsil, vos limites de 5 heures et hebdomadaire, et le décompte ntfy.sh du jour ([guide 4](/fr/android/sidebar/)).
- **Les alertes.** Quand une conversation se termine, a besoin de vous ou échoue, une notification arrive, même application fermée et après un redémarrage ([guide 6](/fr/android/alerts-service/)).
- **Le chiffrement.** Avec une clé obtenue par `/narsil movil clave`, l’application ouvre ce que le mod a scellé ([guide 7](/fr/android/encryption-and-settings/)).
- **Une seule connexion.** La session est gardée jusqu’à ce que Claude y mette fin ou que vous effaciez les données de l’application.
- **Fichiers et voix.** Le bouton **+** de Claude ouvre le sélecteur de fichiers du téléphone, et le micro fonctionne pour la dictée.

> **Expérimental.** L’application s’appuie sur la structure de la page `claude.ai` et sur ses requêtes internes, pas sur une API publique. La bande trouve la zone de message et le menu latéral grâce au balisage de la page, les couleurs remplacent les variables de design propres à la page, et les limites et les données des conversations viennent d’adresses que la page utilise pour elle-même. Une mise à jour de Claude peut casser n’importe lequel de ces éléments ; quand cela arrive, cette partie cesse de s’afficher, et Claude lui-même continue de fonctionner. C’est aussi un projet personnel, installé depuis le code source avec une version de débogage.

L’application est open source sous licence MIT, et elle n’est pas affiliée à Anthropic. Son interface et les mots de Narsil sont en espagnol ; ce parcours garde les libellés tels qu’ils apparaissent, avec leur sens en français entre parenthèses.

## Comment ça marche à l’intérieur

### Pourquoi une application avec une WebView

On ne peut rien ajouter à l’application Claude native : elle exécute son propre code et n’offre aucun moyen de charger le vôtre. Sur un ordinateur, la façon habituelle de modifier une page web est une extension de navigateur, mais Chrome pour Android n’accepte pas d’extensions. L’ancienne extension de navigateur qui dessinait Narsil dans `claude.ai` demandait donc un navigateur qui les accepte : une application de plus à installer et à garder connectée.

Une WebView règle les deux problèmes. C’est le moteur web intégré d’Android, le même Chromium que celui de Chrome, logé dans la fenêtre d’une application. L’application qui possède la WebView décide de ce qui s’y exécute : ici, elle charge `claude.ai`, exécute les scripts et les styles de Narsil au début de chaque page, et leur répond depuis Kotlin. Le premier message de l’auteur ou de l’autrice, consigné dans le journal de tâches, demandait exactement cela : une application mobile complète qui reçoive les notifications et qui, dans une vue web, affiche le site de Claude et en modifie les styles comme le faisait l’extension.

Les scripts qui dessinent la bande, le bloc et les couleurs reprennent les idées de l’extension, et une bonne partie de leur code est la même : ils parlent toujours à un objet `browser`, comme le font les scripts d’extension. L’application leur en fournit un, écrit dans `host.js`, et répond nativement à chaque appel. Le [guide 2](/fr/android/webview-host/) explique cet hôte.

### Les pièces

Tout le code de l’application se trouve dans un seul module Gradle, `app`, avec le paquet `io.github.davshn.narsil` :

| Fichier                                                       | Ce qu’il fait                                                                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `MainActivity.kt`                                             | La WebView : réglages, cookies, fichiers, micro, fenêtres pop-up, et où va chaque lien.                       |
| `PageScript.kt` et `assets/host.js`                           | Construit l’unique script qui s’exécute au début de chaque page `claude.ai`, et le « navigateur » de la page. |
| `assets/page/`                                                | Les couleurs de Narsil (`skin.css`, `mode.js`) et la bande (`content.js`, `band.css`, `lib/`).                |
| `StateFeed.kt` et `StateModel.kt`                             | Suivent `<your topic>-estado` pour la bande, et gardent l’état le plus récent.                                |
| `AlertService.kt`, `NtfyStream.kt`, `Alert.kt`, `Notifier.kt` | Suivent votre sujet en arrière-plan et transforment chaque message en notification.                           |
| `BootReceiver.kt`                                             | Relance les alertes après un redémarrage ou une mise à jour.                                                  |
| `Seal.kt`                                                     | Ouvre ce que le mod a scellé avec `/narsil movil clave`.                                                      |
| `Settings.kt` et `SettingsActivity.kt`                        | Le sujet, la clé et ce dont l’application se souvient, dans un stockage privé.                                |
| `Links.kt`                                                    | Quelles adresses restent dans l’application.                                                                  |

Pas de serveur propre, pas de Firebase ni d’analytics : le module dépend de trois bibliothèques AndroidX (`core-ktx`, `webkit` et `activity`), et de JUnit et `org.json` pour les tests.

### Ce qu’elle demande au mod Narsil

L’application lit deux sujets sur [ntfy.sh](https://ntfy.sh), tous deux créés par le mod Narsil dans Claude Code sur votre ordinateur :

- **Votre sujet**, comme `narsil-0000000000example0`, où le mod publie une alerte quand une conversation se termine, a besoin de vous ou échoue.
- **`<your topic>-estado`** (« état »), où le mod publie un état silencieux à la fin d’un tour et avec chaque question : le niveau de Narsil, son image à son étape, la durée d’un cache et le décompte ntfy.sh des messages du jour.

Le mod n’envoie les deux que pendant que vous écrivez à Claude par Remote Control, c’est-à-dire depuis le téléphone ou le web. Dès que vous écrivez de nouveau au bureau, il s’arrête. Il se limite aussi à 200 messages par jour, sous la marge gratuite de ntfy.sh. [Les alertes sur votre téléphone et votre montre](/fr/mods/pet/phone-and-watch/) explique en détail le côté du mod.

Sans le mod, l’application fonctionne toujours comme Claude aux couleurs de Narsil, la bande montre toujours l’état, le contexte, le cache et le dernier événement de chaque conversation, et le bloc vos limites : tout cela vient de `claude.ai` lui-même. Ce que vous perdez, c’est ce que seul votre ordinateur sait : les alertes, le niveau de Narsil, son étape dans les images (l’icône de l’application la remplace), le décompte ntfy.sh et la vraie durée du cache (la bande suppose 60 minutes).

### Systèmes pris en charge

| Quoi                   | Ce qu’il faut                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| Android                | 10 ou plus récent (`minSdk = 29`) ; construite pour Android 16 (`targetSdk = 36`)                        |
| Android System WebView | Une qui sache exécuter des scripts au début d’une page et parler à l’application ; toute version récente |
| Connexion              | L’e-mail de votre compte Claude ; les boutons de Google et d’Apple ne fonctionnent pas ici               |
| iPhone                 | Non disponible                                                                                           |
| Pour la construire     | Un ordinateur avec JDK 17 ou plus récent et le SDK Android (`ANDROID_HOME`) ; Gradle est fourni          |

La vérification de la WebView est dans le code. `MainActivity` demande deux fonctionnalités à `WebViewFeature`, `WEB_MESSAGE_LISTENER` et `DOCUMENT_START_SCRIPT`. S’il en manque une, elle écrit dans le journal « This WebView cannot run the band: update Android System WebView » (cette WebView ne peut pas faire tourner la bande : mettez à jour Android System WebView) et charge Claude sans Narsil. La solution est de mettre à jour Android System WebView depuis Google Play.

### Installation

Il n’y a pas de fiche dans une boutique : vous construisez l’application depuis son dépôt et l’installez par USB.

1. Sur le téléphone, activez les options pour les développeurs et le **débogage USB**, puis branchez-le à l’ordinateur.
2. Sur l’ordinateur, clonez [narsil-android](https://github.com/davshn/narsil-android) et, dans son dossier, lancez :

```bash
./gradlew installDebug
```

Gradle se télécharge lui-même (le wrapper est fixé à Gradle 9.9.2), construit un APK de débogage et l’installe. Pour mettre à jour plus tard, récupérez les changements du dépôt et relancez la même commande : Android remplace l’application sur place et garde ses données, donc la session et les réglages restent.

Une version de débogage a une propriété à connaître : sa page peut être inspectée depuis un ordinateur à `chrome://inspect`, comme l’explique le [guide 2](/fr/android/webview-host/). C’est pratique pour apprendre et pour réparer, et c’est aussi une raison de laisser le débogage USB désactivé quand vous n’en avez pas besoin.

### Se connecter : avec votre e-mail

Ouvrez **Narsil** et connectez-vous **avec votre e-mail** : celui de votre compte Claude, même si vous avez créé le compte avec Google. Claude vous envoie un code ou un lien, et vous êtes dedans.

Les boutons de connexion de Google et d’Apple ne fonctionnent pas dans la WebView d’une application. Les deux fournisseurs refusent de s’y exécuter, et les ouvrir dans le navigateur du téléphone n’aiderait pas : comme le dit `Links.kt`, « in the phone's browser they would sign the browser in, not the app » (dans le navigateur du téléphone, ils connecteraient le navigateur, pas l’application). Donc quand la page essaie d’aller vers `accounts.google.com` ou `appleid.apple.com`, l’application ne va nulle part et affiche un message à la place :

> "Google y Apple no dejan iniciar sesión dentro de una app como esta. Escribe tu correo (el mismo de tu cuenta) y entra con el código o el enlace que te llega."

(Google et Apple ne permettent pas de se connecter dans une application comme celle-ci. Écrivez votre e-mail, le même que celui de votre compte, et entrez avec le code ou le lien que vous recevez.)

C’est venu d’un vrai échec. Avant le commit `38cb33c`, le bouton de Google ouvrait une fenêtre pop-up que la WebView abandonnait, et la connexion restait bloquée.

Si le lien de connexion arrive par e-mail, il s’ouvre par défaut dans votre navigateur. Pour que les liens `claude.ai` s’ouvrent dans l’application, allez dans **Paramètres → Applications → Narsil → Ouvrir par défaut → Ajouter un lien** d’Android et activez `claude.ai`. Le manifeste explique pourquoi c’est manuel : Android « cannot verify a domain that is not ours » (ne peut pas vérifier un domaine qui n’est pas le nôtre).

### Première configuration

1. Dans Claude Code sur votre ordinateur, lancez `/narsil movil`. La commande active les alertes et répond avec votre sujet.
2. Si vous voulez des alertes chiffrées, lancez aussi `/narsil movil clave` (« clé »). Elle répond avec une nouvelle clé.
3. Dans l’application, ouvrez les réglages : touchez Narsil dans le bloc du menu latéral (ou l’avis `Toca y escribe tu topic` (touchez et écrivez votre sujet)), ou appuyez longuement sur l’icône de l’application et choisissez **Ajustes** (réglages).
4. Écrivez le sujet et, si vous en avez créé une, la clé, puis touchez **Guardar y recibir avisos** (enregistrer et recevoir les alertes). Autorisez les notifications quand Android le demande.
5. Touchez **Permitir en segundo plano** (autoriser en arrière-plan). Sans cela, Android coupe la connexion pendant que le téléphone dort et les alertes arrivent en retard. Une fois l’autorisation donnée, le bouton affiche **Ya funciona en segundo plano** (fonctionne déjà en arrière-plan).

De retour dans Claude, la bande montre Narsil dès que le mod a envoyé un état. Pour vérifier toute la chaîne d’un coup, lancez `/narsil movil prueba` (« test ») sur l’ordinateur : la commande envoie une alerte de test et un état, d’où que vous écriviez.

Les réponses du mod ont été écrites avant que cette application existe. `/narsil movil` vous dit encore d’installer l’application ntfy, et `/narsil movil clave` de mettre la clé dans « las opciones de la extensión de Firefox » (les options de l’extension Firefox). Avec cette application, vous n’avez besoin ni de l’un ni de l’autre : la clé va dans les réglages de l’application.

### Le modèle de confidentialité

L’application parle à quatre endroits, chacun pour une raison :

| Qui                                   | Parle à                                    | Pourquoi                                                                                                    |
| ------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| La WebView                            | `claude.ai` et `challenges.cloudflare.com` | Claude lui-même, et la vérification Cloudflare qui peut le précéder. Rien d’autre ne s’ouvre à l’intérieur. |
| Les scripts de la bande, dans la page | `claude.ai`                                | Les mêmes requêtes `GET` que fait la page, avec votre session : conversations et limites.                   |
| La page et les notifications          | `raw.githubusercontent.com`                | Les images de Narsil, uniquement depuis le dossier `assets/` de narsil-pet.                                 |
| Le code Kotlin de l’application       | `ntfy.sh`                                  | Votre sujet pour les alertes, et `<your topic>-estado` pour la bande.                                       |

Trois règles découlent du code :

- **Le sujet et la clé n’atteignent jamais la page.** Ils vivent dans le stockage privé de l’application, et seul Kotlin lit ntfy.sh. La page reçoit l’état déjà ouvert, rien de plus. `host.js` le dit clairement : « the topic and the key never reach the page » (le sujet et la clé n’atteignent jamais la page).
- **ntfy.sh est un service public.** Sans clé, quiconque connaît votre sujet peut le lire et y publier, et ntfy.sh voit tout. Avec une clé, on voit qu’un message est passé et quelques détails, pas son texte. Le [guide 7](/fr/android/encryption-and-settings/) passe en revue ce qui est caché et ce qui ne l’est pas.
- **Rien de ce qui vient de ntfy.sh n’est pris pour du balisage.** Tout entre dans la page et dans les notifications sous forme de texte, et une image n’est acceptée que depuis le dossier propre de Narsil.

L’application fixe aussi `android:allowBackup="false"`, si bien que ses données, session comprise, ne partent pas dans les sauvegardes d’Android.

## Le construire avec Claude

Demandez d’abord le squelette à Claude : un projet Gradle avec une activité qui affiche `claude.ai` dans une WebView, décide où va chaque lien et a un écran de réglages pour un sujet. La seule idée qu’il doit bien saisir, c’est la frontière : `claude.ai` et rien d’autre ne s’ouvre dans l’application, et les secrets restent dans Kotlin, jamais dans la page.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Crée une application Android en Kotlin (Gradle Kotlin DSL, `minSdk 29`, JDK 17, sans Compose) dont l’activité principale affiche `https://claude.ai/code` dans une WebView plein écran avec JavaScript et le stockage DOM activés. Garde uniquement `https://claude.ai` et `https://challenges.cloudflare.com` dans la WebView ; ouvre toute autre adresse `https` dans le navigateur du téléphone avec `ACTION_VIEW`. Quand la page va vers `accounts.google.com` ou `appleid.apple.com`, n’ouvre rien et affiche un toast qui dit de se connecter avec un e-mail. Gère les fenêtres pop-up dans `onCreateWindow` avec une WebView jetable qui ne fait que lire l’adresse demandée. Vide les cookies sur le disque dans `onPause`. Ajoute une activité de réglages avec un champ de sujet validé par `^[-_A-Za-z0-9]{1,64}$`, enregistré dans des `SharedPreferences` privées, et un raccourci du lanceur vers elle. Mets les règles des liens dans un objet Kotlin pur avec des tests JUnit, y compris `http://claude.ai`, `https://claude.ai.evil.example/` et une chaîne qui n’est pas une URL.

### Ce qu’il faut vérifier dans la réponse de Claude

1. Les hôtes sont comparés exactement après l’analyse de l’adresse, et seulement pour `https` : `https://claude.ai.evil.example/` et `http://claude.ai` ne doivent pas compter comme Claude.
2. Les adresses de connexion de Google et d’Apple n’ouvrent rien ; elles affichent un message.
3. Les fenêtres pop-up n’ouvrent pas une deuxième fenêtre visible : leur première adresse va là où irait n’importe quel lien.
4. `CookieManager.getInstance().flush()` est appelé dans `onPause`, pour que la session survive quand Android tue l’application.
5. Le sujet est validé avant d’être enregistré, et rien de secret n’est écrit dans la page ni dans le code.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « le bouton de Google ne fait rien et l’écran reste blanc ».

### Comment l’auteur l’a demandé

Cette fois, c’est consigné. Le journal de tâches de narsil-android, `odd/tasks/android-app.md`, cite les messages de l’auteur ou de l’autrice dans ses entrées L1 à L3.

L’idée, le 2026-11-23 (L1) :

> "se me ocurrio crear una app movil completa, que reciba las notificaciones y que dentro en un web view muestre la web de claude y modifique sus estilos como lo hace esta extension, eso es viable?"

Traduction en français : il m’est venu l’idée de créer une application mobile complète qui reçoive les notifications et qui, dans une vue web, affiche le site de Claude et en modifie les styles comme le fait cette extension ; est-ce faisable ?

La portée, le 2026-11-24 (L2) :

> "seria para reemplazar la pwa, la friccion que me dices para iniciar sesion seria igual solo una vez, no? ... (igual seria para mi uso personal)"

Traduction en français : ce serait pour remplacer la PWA (l’ancienne application web des alertes) ; la friction dont tu parles pour se connecter n’arriverait de toute façon qu’une fois, non ? (De toute façon, ce serait pour mon usage personnel.) Et dans la même entrée : « hazlo en un proyecto nuevo y probemos a ver que tal, el repositorio seria publico, te dejo conectado el celular para que la instales » (fais-le dans un nouveau projet et essayons pour voir ; le dépôt serait public ; je te laisse le téléphone branché pour que tu l’installes).

De L3 : « no olvides ir haciendo commits al repositorio a medida que vas trabajando el repo se va a llamar narsil-android » (n’oublie pas de faire des commits dans le dépôt au fur et à mesure que tu travailles ; le dépôt s’appellera narsil-android).

La spécification en tire des règles : S3 « login once and the session stays (cookies flushed to disk) » (se connecter une fois et la session reste, cookies écrits sur le disque), et S4 « the repository is public and named `narsil-android`: no topic or key in the code; they are typed in the app's settings » (le dépôt est public et s’appelle `narsil-android` : aucun sujet ni clé dans le code ; on les saisit dans les réglages de l’application). La dernière entrée du journal, L4, consigne la décision de l’auteur ou de l’autrice de retirer l’ancienne extension et l’ancienne application web au profit de cette application (« […] los voy a deprecar en favor de esta app », je vais les déprécier au profit de cette application), ce qui explique pourquoi les scripts de la bande sont devenus ceux de l’application.

Les commits, tous du 2026-11-24, montrent l’ordre de la construction (un nom de projet dans un sujet de commit est remplacé ici par une description entre crochets) :

- `9051a31` « feat: open what the mod seals, as [the earlier extension]'s seal.js does » (ouvrir ce que le mod scelle, comme le fait le seal.js de [l’ancienne extension])
- `3bcea35` « feat: build the script that hosts [the earlier extension] in a WebView, and what alerts and states keep » (construire le script qui héberge [l’ancienne extension] dans une WebView, et ce que gardent les alertes et les états)
- `53c55c1` « feat: host claude.ai with [the earlier extension] in a WebView, and show Narsil's alerts from a foreground service » (héberger claude.ai avec [l’ancienne extension] dans une WebView, et afficher les alertes de Narsil depuis un service de premier plan)
- `bfa379a` « fix: present the WebView as Chrome, and let a debug build's page be inspected » (présenter la WebView comme Chrome, et permettre d’inspecter la page d’une version de débogage)
- `38cb33c` « fix: say to sign in with an email when Google's or Apple's sign-in is asked for, instead of hanging » (dire de se connecter avec un e-mail quand la connexion de Google ou d’Apple est demandée, au lieu de rester bloqué)
- `9e514dd` « feat: open the settings from Narsil in the band and from the service's notification » (ouvrir les réglages depuis Narsil dans la bande et depuis la notification du service)
- `5ad4577` « refactor: make the band's scripts the app's own, and stop naming the projects it replaces » (faire des scripts de la bande ceux de l’application, et ne plus nommer les projets qu’elle remplace)

## Code de référence

Voici `Links.kt` en entier, depuis `app/src/main/java/io/github/davshn/narsil/` dans [narsil-android](https://github.com/davshn/narsil-android) (MIT). Il est court, et chaque navigation de l’application passe par lui : les liens de la WebView, ses fenêtres pop-up, les adresses que porte une alerte et les adresses qu’Android confie à l’application.

```kotlin
package io.github.davshn.narsil

import java.net.URI

// Which addresses the app opens itself: claude.ai, and the Cloudflare check it may put before it. Everything else
// goes to the phone's browser, Google's sign-in among it, which refuses to run inside a WebView.
object Links {
    const val CLAUDE_CODE = "https://claude.ai/code"
    private val IN_APP = setOf("claude.ai", "challenges.cloudflare.com")

    private fun hostOf(url: String): String? = try {
        URI(url).takeIf { it.scheme == "https" }?.host?.lowercase()
    } catch (_: Exception) {
        null
    }

    fun isClaude(url: String?): Boolean = url != null && hostOf(url) == "claude.ai"

    fun isInApp(url: String?): Boolean = url != null && hostOf(url) in IN_APP

    // Google's and Apple's sign-ins, which refuse to run inside an app's WebView: in the phone's browser they would
    // sign the browser in, not the app, so the app says to sign in with an email instead.
    private val OUTSIDE_SIGN_IN = setOf("accounts.google.com", "appleid.apple.com")

    fun isOutsideSignIn(url: String?): Boolean = url != null && hostOf(url) in OUTSIDE_SIGN_IN
}
```

Trois détails le rendent sûr. `hostOf` renvoie `null` sauf si le schéma est `https`, donc une adresse `http` n’est jamais Claude. Il compare exactement l’hôte analysé, donc `claude.ai.evil.example` n’est pas `claude.ai`. Et une chaîne qui ne s’analyse pas lève une exception dans `URI`, que le `try` transforme en `null`. `LinksTest.kt` vérifie les trois.

Un petit test à vous, écrit pour ce guide (MIT), dans le même style que ceux de l’application :

```kotlin
package io.github.davshn.narsil

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MyLinksTest {
    @Test
    fun onlyClaudeAndTheCheckStayInside() {
        assertTrue(Links.isInApp("https://claude.ai/code/session_example"))
        assertTrue(Links.isInApp("https://CHALLENGES.cloudflare.com/x"))
        assertFalse(Links.isInApp("https://sub.claude.ai/"))
        assertFalse(Links.isInApp("claude.ai/code"))
    }
}
```

La deuxième assertion passe parce que `hostOf` met l’hôte en minuscules. La dernière tient parce qu’une adresse sans schéma n’a pas de schéma `https`, donc elle n’a pas d’hôte pour l’application.

## Erreurs fréquentes et comment tester

- **Toucher Continuer avec Google.** Cela ne peut pas fonctionner ici. Utilisez l’e-mail de votre compte, même si vous l’avez créé avec Google.
- **Pas d’autorisation en arrière-plan.** Sans **Permitir en segundo plano**, les alertes peuvent arriver avec de longues minutes de retard pendant que le téléphone dort. Certains téléphones (le README cite Infinix, Xiaomi et Huawei) demandent aussi que leur propre économiseur de batterie laisse Narsil tourner.
- **Attendre des alertes au bureau.** Le mod n’envoie rien tant que votre dernier message est venu du terminal ou de l’application de bureau. Écrivez à Claude par Remote Control, ou utilisez `/narsil movil prueba`.
- **Un sujet copié avec une espace ou une faute de frappe.** Les réglages refusent tout ce qui n’est pas lettres, chiffres, `-` et `_` avec « Ese topic no es válido » (ce sujet n’est pas valide). Un sujet valide mais faux reste simplement silencieux : comparez-le avec la réponse de `/narsil movil`.
- **Installer depuis un deuxième ordinateur.** Une version de débogage est signée avec la clé de débogage propre à l’ordinateur, et Android refuse une mise à jour signée avec une autre clé. Désinstaller pour contourner le problème efface la session et les réglages.
- **Un Android System WebView ancien.** Claude se charge, mais sans les couleurs ni la bande. Mettez-le à jour depuis Google Play.

Pour tester la logique de l’application, lancez ses tests JVM sur l’ordinateur :

```bash
./gradlew testDebugUnitTest
```

Ils couvrent les règles des liens, le script qui charge la bande, les règles des alertes, l’état que garde la bande, et le chiffrement face à un message scellé comme le mod le scelle. Pour tester toute la chaîne sans toucher à votre vrai sujet, mettez-en un inventé comme `narsil-0000000000example0` dans les réglages et publiez-y depuis l’ordinateur ([ntfy : publier](https://docs.ntfy.sh/publish/)) :

```bash
curl -H "Title: Narsil prueba" -d "Hola desde el ordenador" https://ntfy.sh/narsil-0000000000example0
```

Une notification devrait arriver en une ou deux secondes. Ensuite, remettez votre vrai sujet.

### Là où le code et le README diffèrent

- Le README n’indique aucun moyen d’arrêter les alertes dans l’application, et le code n’en a pas : `AlertService.stop` existe, mais rien ne l’appelle, et les réglages refusent un sujet vide. Pour les arrêter, lancez `/narsil movil off` sur l’ordinateur, ou désactivez les notifications de l’application dans les paramètres d’Android.
- Le README dit que vous n’avez plus besoin de l’application ntfy. C’est vrai pour l’application ; la réponse de `/narsil movil` du mod vous dit encore de l’installer (voir Première configuration).

## Pour aller plus loin

- Le [guide 2](/fr/android/webview-host/) ouvre l’hôte WebView : comment les scripts sont assemblés et comment la page parle à l’application.
- Le [guide 6](/fr/android/alerts-service/) suit une alerte depuis ntfy.sh jusqu’au volet des notifications.
- Le [guide 7](/fr/android/encryption-and-settings/) explique la clé, les réglages, et ce qu’une personne qui lit votre sujet peut encore voir.
- Le côté du mod est dans [Les alertes sur votre téléphone et votre montre](/fr/mods/pet/phone-and-watch/). Le même état `-estado` alimente aussi [Narsil Watch](/fr/watch/what-it-is/).
- Le code source est sur [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
