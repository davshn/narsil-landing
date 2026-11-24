---
title: La bande au-dessus de la zone de message
description: 'La bande au-dessus de la zone où vous écrivez : état, contexte, cache et dernier événement tirés de claude.ai, et Narsil à son étape d’après l’état du mod que suit StateFeed.'
route: android
order: 3
updated: 2026-11-24
sources:
  - repo: android
    path: app/src/main/assets/page/content.js
  - repo: android
    path: app/src/main/assets/page/lib/live.js
  - repo: android
    path: app/src/main/assets/page/lib/watch.js
  - repo: android
    path: app/src/main/assets/page/lib/restore.js
  - repo: android
    path: app/src/main/assets/page/band.css
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/StateFeed.kt
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/StateModel.kt
---

## Ce que ça fait

Quand vous ouvrez une conversation dans l’application (une adresse comme `claude.ai/code/session_…`), une bande apparaît juste au-dessus de la zone où vous écrivez. De gauche à droite et de haut en bas, elle affiche :

- **Narsil**, à son étape actuelle et dans la pose de l’état de la conversation.
- **L’état**, sous forme de pastille colorée : `TRABAJANDO` (au travail, bleu), `TE NECESITA` (a besoin de vous, ambre), `TERMINADA` (terminée, vert) ou `EN REPOSO` (au repos, gris). Le bord gauche de la bande prend la même couleur.
- **Le contexte**, comme `Contexto 42 %` : la part de sa fenêtre que la conversation a utilisée, en vert, ambre ou rouge.
- **Le cache**, comme `🧊 38 min` : les minutes restantes avant que le cache du prompt n’expire, jusqu’à ce qu’il devienne `🧊 fría` (froid).
- **Le dernier événement** : la dernière chose que Claude a dite, ou `Usando Bash` (utilise Bash) quand Claude ne fait qu’exécuter un outil, avec depuis combien de temps, comme `hace 3 min` (il y a 3 min).

Le texte tient sur deux lignes. Un toucher sur la bande l’ouvre en entier, et un autre la referme. La bande pousse la conversation vers le haut au lieu de la recouvrir, et elle se rafraîchit toutes les 10 secondes tant que l’application est au premier plan.

> **Expérimental.** La bande lit les mêmes données que la page `claude.ai` charge pour elle-même, depuis des adresses internes qui ne sont pas une API publique, et trouve la zone de message grâce à un attribut du balisage de la page. Une mise à jour de Claude peut la casser ; quand cela arrive, la bande cesse simplement de s’afficher et Claude continue de fonctionner. Elle ne fait que lire : elle envoie des requêtes `GET` à `claude.ai` avec votre session et n’écrit jamais dans votre compte.

Presque tout ce que montre la bande vient de `claude.ai` lui-même, donc elle fonctionne dès que vous ouvrez une conversation, même avec votre ordinateur éteint. Seuls deux détails dépendent du mod Narsil : son étape sur l’image, et la durée du cache. Ils viennent de `<your topic>-estado`, que l’application suit en Kotlin.

## Comment ça marche à l’intérieur

La bande est dessinée par `assets/page/content.js`. Ce qu’elle tire des données vit dans `assets/page/lib/live.js`, un module sans code DOM. L’observateur de la page est `lib/watch.js`, les styles sont dans `band.css`, et l’état du mod arrive à la page depuis `StateFeed.kt` et `StateModel.kt` par le canal que décrit le [guide 2](/fr/android/webview-host/).

Ces scripts ont d’abord été écrits pour l’ancienne extension de navigateur, et la plus grande partie de leur code n’a pas changé. Dans l’application, ils s’exécutent dans le monde JavaScript propre de la page plutôt que dans le monde séparé d’une extension : `addDocumentStartJavaScript` les place à côté du code de `claude.ai`. Cela change un détail plus bas, le `fetch` qu’ils utilisent, et rien de ce qu’ils affichent.

### D’où viennent les données : deux sources

| Valeur dans la bande           | Source                                                                                    |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| État                           | `claude.ai` : le `status_bucket` de la conversation                                       |
| Contexte                       | `claude.ai` : `context_usage` dans les métadonnées de la conversation                     |
| Dernier événement et son heure | `claude.ai` : les événements les plus récents de la conversation                          |
| Compte à rebours du cache      | `claude.ai` pour le moment où Claude a parlé en dernier ; le mod pour la durée d’un cache |
| Pose de Narsil                 | `claude.ai` : l’état la choisit                                                           |
| Étape de Narsil                | Le mod : le dossier de l’image dans son dernier état                                      |

### Les requêtes propres de la page

La bande ne lit pas la conversation à l’écran. Elle pose à `claude.ai` les mêmes questions que la page, avec votre session, et lit les réponses en JSON. Toutes les 10 secondes, deux requêtes partent ensemble :

- **La liste de vos conversations**, actives et en pause, jusqu’à 50 : `/v1/code/sessions?statuses=active&statuses=paused&limit=50`. La bande prend celle que vous avez ouverte, trouvée par l’identifiant dans l’adresse de la page (`/code/session_…`). L’adresse et la liste peuvent nommer la même conversation avec des préfixes différents (`session_x` et `cse_x`, dit le code), donc les identifiants sont comparés sans eux.
- **Les 60 derniers événements de cette conversation**, les plus récents d’abord : `/v1/code/sessions/<id>/events?limit=60&sort_order=desc`.

Le commentaire qui les précède dans `lib/live.js` est la raison pour laquelle ce parcours est expérimental : « These addresses are not a public API and may change. » (ces adresses ne sont pas une API publique et peuvent changer).

`content.js` les envoie avec `credentials: 'include'` et un en-tête `anthropic-version: 2023-06-01`. Dans l’ancienne extension, il préférait `content.fetch` de Firefox, qui fait des requêtes « as the page itself, with its session » (comme la page elle-même, avec sa session), dans les mots du code. Une WebView n’a pas d’objet `content`, donc le code se rabat sur `fetch` et, comme le script s’exécute dans le monde de la page, c’est le `fetch` propre de la page, avec les cookies de la page. Votre session ne quitte jamais `claude.ai`, et les réponses restent dans la page.

### De quoi est faite chaque valeur

`liveOf` dans `lib/live.js` transforme la conversation et ses événements en ce que montre la bande. Cet extrait vient de `lib/live.js` dans narsil-android (MIT) :

<!-- prettier-ignore -->
```js
  const STATES = {
    working: { label: 'TRABAJANDO', color: '#3B8BFF' },
    blocked: { label: 'TE NECESITA', color: '#F5B400' },
    completed: { label: 'TERMINADA', color: '#22B573' },
  }
  const AT_REST = { label: 'EN REPOSO', color: '#8A90A6' }
```

| Valeur            | Construite à partir de                                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| État              | `status_bucket` : `working`, `blocked` ou `completed` ; toute autre valeur donne `EN REPOSO`.                                    |
| Contexte          | `external_metadata.context_usage` : `used_tokens` sur `max_tokens`, arrondi au pour cent.                                        |
| Dernier événement | L’événement de Claude (`assistant`) le plus récent qui a du texte ; s’il n’a qu’un appel d’outil, `Usando` et le nom de l’outil. |
| Quand             | L’heure de cet événement, sous la forme `ahora mismo` (à l’instant), `hace 5 min`, `hace 2 h` ou `hace 1 d`.                     |
| Cache             | L’événement de Claude le plus récent, plus la durée d’un cache (voir plus bas).                                                  |

Deux règles gardent le dernier événement utile. La réflexion seule ne dit rien, donc un événement sans texte ni appel d’outil est ignoré. Et seuls les événements de Claude comptent : une conversation en a beaucoup d’autres types.

Le contexte et le cache partagent une même coloration, celle de `levelColor` dans `lib/state.js` : vert sous 60 %, ambre à partir de 60 %, rouge à partir de 85 %. Pour le cache, le pourcentage est la part de son temps qui s’est écoulée.

### Pourquoi le cache est une estimation

`claude.ai` ne dit pas quand le cache d’une conversation expire, donc la bande l’estime : **l’heure du dernier événement de Claude plus la durée d’un cache**. Depuis `lib/live.js` (MIT) :

<!-- prettier-ignore -->
```js
  // From the model's last message: the session's last event may be anything,
  // and opening the page makes some of its own.
  function cacheOf(events, cacheMinutes, now) {
    const last = events.find((e) => e.event_type === 'assistant')
    if (!last) return null
    const left = Math.max(0, Math.ceil((secondsOf(last) + cacheMinutes * 60 - now) / 60))
    return { text: left > 0 ? `🧊 ${left} min` : '🧊 fría', color: self.narsilState.levelColor(100 - (left / cacheMinutes) * 100) }
  }
```

Le point de départ est le dernier événement de Claude, et non le dernier événement de la conversation parce que, comme le dit le commentaire, ouvrir la page crée des événements à elle, et le compte à rebours recommencerait chaque fois que vous regardez.

La durée d’un cache, c’est au mod de la connaître : `cacheMinutesOf` prend `cacheMinutes` dans le dernier état du mod ([L’horloge du cache](/fr/mods/pet/cache-clock/) explique comment le mod décide). Sans état, elle suppose 60 minutes, « an hour on a plan » (une heure sur un forfait), dans les mots du code. Lisez donc `🧊 38 min` comme « environ 38 minutes » : le cache part en réalité de la requête, pas de la réponse, et sans le mod un cache de 5 minutes s’affiche comme 60.

### L’image de Narsil : la pose vient de la page, l’étape du mod

La pose suit l’état : `trabajando` (au travail), `necesita` (a besoin de vous), `terminado` (terminé), ou `parada` (debout) au repos. Son étape n’est pas une chose que `claude.ai` connaît. Elle vient de l’état du mod, dont le champ `art` contient l’adresse de son image. Depuis `lib/live.js` (MIT) :

<!-- prettier-ignore -->
```js
  // Her stage is the mod's to know: it comes in the art of its last state,
  // with the first stage at the root and each later one in its folder.
  function petOf(bucket, sentArt, isLight) {
    if (typeof sentArt !== 'string' || !sentArt.startsWith(ART)) return null
    const stage = /^etapa\d+\//.exec(sentArt.slice(ART.length))?.[0] ?? ''
    return `${ART}${stage}${POSES[bucket] ?? 'parada'}-${isLight ? 'claro' : 'oscuro'}.png`
  }
```

`ART` vaut `https://raw.githubusercontent.com/davshn/narsil-pet/main/assets/`. La bande ne garde de l’adresse du mod que le dossier de l’étape (`etapa4/`, par exemple), y met la pose de cette conversation, et choisit `-claro` (clair) ou `-oscuro` (sombre) selon le mode de la page. Une adresse venant d’ailleurs est refusée, si bien qu’un état falsifié ne peut pas faire charger à la bande une image d’un autre site.

Quand il n’y a pas d’état du mod, ou qu’une image ne se charge pas, la bande montre à la place l’icône propre de l’application, servie depuis `https://claude.ai/__narsil__/page/icons/icon-192.png`. Une image qui a échoué n’est pas redemandée.

### De `<topic>-estado` à la page : `StateFeed` et `StateModel`

Dans l’extension, un script d’arrière-plan lisait ntfy.sh. Dans l’application, c’est Kotlin qui le fait, et seulement pendant qu’une page affiche la bande. Quand `content.js` ouvre son port, `host.js` envoie `connect`, et `MainActivity` appelle `StateFeed.start()`. Depuis `StateFeed.kt` dans narsil-android (MIT) :

```kotlin
    @Synchronized
    fun start() {
        stop()
        val mine = run
        val topic = settings.topic
        if (topic == null) {
            post(JSONObject().put("type", "no-topic").toString())
            return
        }
        val key = settings.key
        model = settings.model(topic) ?: StateModel.empty()
        send()
        stream = NtfyStream(NtfyStream.topicUrl("$topic-estado"), "12h") { raw ->
            synchronized(this) {
                if (mine != run) return@synchronized
                model = StateModel.receive(model, raw, key)
                settings.saveModel(topic, model)
                send()
            }
        }.also { it.start() }
    }
```

Étape par étape :

1. **Pas de sujet, pas de flux.** La page reçoit `{ type: 'no-topic' }`, et le bloc du menu latéral vous demande de toucher et d’en écrire un.
2. **Le dernier état connu, tout de suite.** L’application garde dans ses réglages le dernier modèle de la bande pour chaque sujet, si bien qu’une page qui s’ouvre plus tard montre Narsil immédiatement, avant que ntfy.sh réponde.
3. **Puis le flux**, `https://ntfy.sh/<topic>-estado/json?since=12h` : d’abord ce que ntfy.sh a gardé des 12 dernières heures, puis chaque nouvel état à mesure qu’il arrive. `NtfyStream` est la même classe que celle qu’utilisent les alertes ; le [guide 6](/fr/android/alerts-service/) explique ses reconnexions.
4. **Chaque message** passe par `StateModel.receive`, est enregistré, et est envoyé à la page sous la forme `{ type: 'model', model }`.

Le compteur `run` protège contre une situation de concurrence : si la page se déconnecte et se reconnecte pendant qu’un message est en route, le message de l’ancien flux est abandonné. Quand la page est cachée, la bande ferme son port, `host.js` envoie `disconnect`, et le flux s’arrête. Rien n’est lu sur ntfy.sh tant que vous ne regardez pas Claude.

`StateModel.receive` ne garde que l’état le plus récent. Depuis `StateModel.kt` (MIT) :

```kotlin
    fun receive(model: JSONObject, raw: JSONObject, key: String?): JSONObject {
        if (raw.optString("event") != "message") return model
        val m = Seal.unseal(key, raw)
        if (m.optBoolean("sealed")) return JSONObject(model.toString()).put("isSealed", true)
        val state = try {
            JSONObject(m.optString("message"))
        } catch (_: JSONException) {
            return model
        }
        val kept = model.optJSONObject("state")?.optDouble("at", 0.0) ?: 0.0
        if (kept > state.optDouble("at", 0.0)) return model
        return JSONObject().put("state", state).put("isSealed", false)
    }
```

Les keepalives et les autres événements sont ignorés. Un message scellé est ouvert avec la clé ; s’il ne s’ouvre pas, le modèle est marqué `isSealed` et garde l’état qu’il avait. Un message qui n’est pas un objet JSON est ignoré. Et un état plus ancien que celui qui est gardé (d’après son champ `at`, en secondes) perd, si bien que rejouer 12 heures à chaque connexion ne fait jamais reculer la bande. `StateModelTest.kt` vérifie chacun de ces cas. Le [guide 7](/fr/android/encryption-and-settings/) explique ce que signifie l’avis du cadenas.

### Toutes les 10 secondes, seulement pendant que vous regardez

`content.js` demande de nouvelles données toutes les 10 secondes, et pas du tout pendant que la page est cachée : une autre application au premier plan, l’écran éteint ou les réglages de l’application ouverts. Quand la page redevient visible, il demande aussitôt, grâce à l’événement [`visibilitychange`](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event), et rouvre son port, ce qui lance un nouveau `StateFeed` avec le sujet et la clé actuels. C’est pourquoi une clé que vous venez de saisir dans les réglages prend effet dès que vous revenez. Entre les requêtes, la bande se redessine toutes les 15 secondes, pour que le compte à rebours et le temps `hace` continuent d’avancer. Si une requête échoue, ce qu’elle savait en dernier reste jusqu’à la suivante.

### Dans le flux de la page, pour ne rien recouvrir

La bande n’est pas une couche flottante. C’est un élément normal, `#narsil-event`, inséré juste avant la zone de message, trouvée par l’attribut `[data-cds=ChatComposer]` que la page lui donne. Comme la bande fait partie de la mise en page propre de la page, la conversation au-dessus se termine simplement un peu plus haut.

`band.css` commence chacune des parties de Narsil par `all: initial`, pour qu’aucun style de `claude.ai` ne s’y infiltre, et définit ses propres couleurs comme variables, avec une série claire sous `html[data-mode="light"]`. Il défait aussi une règle du propre habillage de Narsil : le [guide 5](/fr/android/colors-and-mode/) met tout le texte de Claude en gras, et la bande remet ses graisses avec `!important`. Le texte est limité à deux lignes avec [`line-clamp`](https://developer.mozilla.org/en-US/docs/Web/CSS/line-clamp) ; un toucher bascule `narsil-open`, qui le laisse défiler à l’intérieur d’au plus 40 % de la hauteur de l’écran (`40dvh`). Tout le texte est inséré avec `textContent`, jamais en HTML.

### Suivre la page quand elle change

`claude.ai` est une application monopage : ouvrir une autre conversation change l’adresse et le contenu sans charger de nouvelle page, et la page reconstruit parfois la zone de message. La bande ne peut donc pas être placée une fois pour toutes.

`lib/watch.js` contient l’unique [`MutationObserver`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) de tous les scripts de Narsil, qui surveille tout le document. Pendant que Claude écrit, la page change de nombreuses fois par image, donc il exécute ses callbacks au plus une fois par image, avec [`requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame). À chaque passage, la bande vérifie deux choses :

- **Est-elle toujours juste au-dessus de la zone de message ?** Sinon, elle y retourne.
- **Est-ce toujours la même conversation ?** Elle compare l’identifiant dans l’adresse avec celui qu’elle a demandé en dernier. Quand il change, les anciennes données sont abandonnées, la bande disparaît, et de nouvelles données sont demandées aussitôt.

Elle n’écrit une valeur que quand elle a changé, puisque chacune de ses propres écritures est un changement de plus pour l’observateur.

Deux parties de ces scripts sont des restes de l’extension qui ne font pas grand-chose dans l’application. L’observateur s’arrête de lui-même quand son extension disparaît, en vérifiant `browser.runtime.id` ; `host.js` répond toujours `'narsil-android'`, donc dans l’application il ne s’arrête jamais pour cette raison. Et `lib/restore.js` existait pour remettre en place les scripts et les styles après que Vivaldi sur Android les avait abandonnés. Dans l’application, une seule partie s’exécute : `missingStyles`, qui vérifie les marques `--narsil-css-skin` et `--narsil-css-band` que chaque feuille de style pose sur `:root`. Si l’une manque, `content.js` envoie `narsil-missing`, et `host.js` adopte de nouveau la feuille de style.

### Toucher la bande, et toucher Narsil

Un toucher sur la bande ne fait qu’ouvrir ou fermer son texte. Le toucher qui ouvre les réglages de l’application se fait sur Narsil dans le bloc du menu latéral, `#narsil-band .narsil-head` dans `host.js` ; le [guide 4](/fr/android/sidebar/) le montre. Les noms peuvent tromper : dans le code, `narsil-band` est le bloc du menu latéral, et cette bande-ci est `narsil-event`.

## Le construire avec Claude

Demandez à Claude les deux moitiés en même temps : un script de page qui dessine une bande au-dessus de la zone de message à partir des données propres de `claude.ai`, et un flux Kotlin qui lui envoie l’état du mod par le canal de la WebView. La seule idée qu’il doit bien saisir, c’est que la page ne fait que lire, seulement pendant que vous regardez, et que l’état qui lui parvient est le plus récent, déjà ouvert.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Mon application Android héberge `https://claude.ai` dans une WebView et exécute un script de page au début du document, avec un canal `myHost` vers Kotlin. Dans le script de page, dessine une bande juste avant `[data-cds=ChatComposer]`, comme son frère précédent. Prends l’identifiant de la conversation dans `location.pathname` (`/code/session_…`). Toutes les 10 secondes, et seulement tant que `document.hidden` est faux, fais un `GET` de la liste des conversations et de ses 60 derniers événements avec `fetch` et `credentials: 'include'`. Affiche l’état tiré de `status_bucket`, le pourcentage de contexte, le dernier texte écrit par Claude et depuis combien de temps, et un compte à rebours du cache à partir de l’heure du dernier événement de Claude plus un nombre de minutes que l’application envoie. Utilise un seul `MutationObserver` limité avec `requestAnimationFrame`. N’écris le texte qu’avec `textContent`. En Kotlin, quand la page dit `connect`, suis `https://ntfy.sh/<topic>-estado/json?since=12h` dans un thread d’arrière-plan, ne garde que le message au `at` le plus élevé, enregistre-le et envoie-le à la page ; arrête-toi sur `disconnect`. Garde les règles dans des modules purs et teste-les.

### Ce qu’il faut vérifier dans la réponse de Claude

1. La bande est insérée juste avant la zone de message, et non comme une couche en `position: fixed`.
2. Les requêtes sont uniquement des `GET`, avec `credentials: 'include'`, et aucune ne part tant que `document.hidden` est vrai.
3. Le compte à rebours du cache part du dernier événement de Claude, et non du dernier événement de la conversation.
4. Le côté Kotlin garde le plus récent de deux états d’après `at`, si bien que rejouer les 12 dernières heures ne fait jamais reculer la bande.
5. Une adresse d’image n’est acceptée que depuis un seul préfixe fixe, et seul le dossier de l’étape en est tiré.
6. Le flux s’arrête quand la page se déconnecte ou qu’une nouvelle page commence à se charger, et un message en retard d’un ancien flux est abandonné.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « après un changement de conversation, la bande montre le texte de l’ancienne pendant quelques secondes ».

### Comment l’auteur l’a demandé

Les mots de l’auteur ou de l’autrice pour cette application sont consignés dans `odd/tasks/android-app.md`. L1 demandait une vue web qui « muestre la web de claude y modifique sus estilos como lo hace esta extension » (affiche le site de Claude et en modifie les styles comme le fait cette extension), et L3 que les styles soient ceux de l’extension. La bande n’a donc pas été repensée pour l’application : la demande était d’apporter la bande de l’extension telle quelle.

Le journal de tâches consigne aussi comment elle a été vérifiée sur un vrai téléphone, avec une session connectée : « With a state published to the throwaway topic's -estado, the sidebar band showed level, XP, ntfy's count and Narsil's art from raw.githubusercontent.com (the page's CSP lets it load), and the strip above the composer showed TRABAJANDO, context, cache and her pose. » (avec un état publié sur le -estado du sujet jetable, le bloc du menu latéral a affiché le niveau, l’XP, le décompte de ntfy et le dessin de Narsil depuis raw.githubusercontent.com, que la CSP de la page laisse se charger, et la bande au-dessus de la zone de saisie a affiché TRABAJANDO, le contexte, le cache et sa pose).

Le reste est reconstitué à partir de l’historique des commits (un nom de projet dans un sujet de commit est remplacé par une description entre crochets) :

- `3bcea35` (2026-11-24) « feat: build the script that hosts [the earlier extension] in a WebView, and what alerts and states keep » (construire le script qui héberge [l’ancienne extension] dans une WebView, et ce que gardent les alertes et les états). `StateModel` et les scripts de page arrivent.
- `53c55c1` (2026-11-24) « feat: host claude.ai with [the earlier extension] in a WebView, and show Narsil's alerts from a foreground service » (héberger claude.ai avec [l’ancienne extension] dans une WebView, et afficher les alertes de Narsil depuis un service de premier plan). Son message : « The band's state follows <topic>-estado while the band shows » (l’état de la bande suit <topic>-estado tant que la bande est affichée).
- `ca01cc7` (2026-11-24) « docs: log the band verified with a signed-in session » (consigner la bande vérifiée avec une session connectée).
- `5ad4577` (2026-11-24) « refactor: make the band's scripts the app's own, and stop naming the projects it replaces » (faire des scripts de la bande ceux de l’application, et ne plus nommer les projets qu’elle remplace).

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide (MIT). Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

Les règles de la bande sous forme de module pur, sans DOM, sur le modèle de `lib/live.js`. Il prend la conversation, ses événements (les plus récents d’abord) et la durée du cache, et renvoie ce qu’il faut afficher.

```js
const STATES = {
  working: { label: 'TRABAJANDO', color: '#3B8BFF' },
  blocked: { label: 'TE NECESITA', color: '#F5B400' },
  completed: { label: 'TERMINADA', color: '#22B573' },
}
const AT_REST = { label: 'EN REPOSO', color: '#8A90A6' }

const secondsOf = (event) => Date.parse(event.created_at) / 1000

export function stripOf(session, events, cacheMinutes, now) {
  const said = events.find((event) => event.event_type === 'assistant')
  const blocks = Array.isArray(said?.payload?.message?.content) ? said.payload.message.content : []
  const words = blocks
    .filter((block) => block.type === 'text' && block.text?.trim())
    .map((block) => block.text.trim())
    .join('\n')
  const tool = blocks.filter((block) => block.type === 'tool_use').pop()
  const left = said
    ? Math.max(0, Math.ceil((secondsOf(said) + cacheMinutes * 60 - now) / 60))
    : null
  return {
    ...(STATES[session.status_bucket] ?? AT_REST),
    text: words || (tool ? `Usando ${tool.name}` : ''),
    cache: left === null ? '' : left > 0 ? `🧊 ${left} min` : '🧊 fría',
  }
}
```

Il est volontairement plus simple que le vrai : il ne lit que l’événement de Claude le plus récent, alors que `lastSaid` dans `lib/live.js` remonte au-delà des événements qui ne contiennent que de la réflexion. Enregistrez-le sous le nom `strip.js`. Un test pour lui avec `node --test`, lui aussi écrit pour ce guide :

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { stripOf } from './strip.js'

const at = (iso, content) => ({
  event_type: 'assistant',
  created_at: iso,
  payload: { message: { content } },
})

test('a tool call alone says what Claude is using', () => {
  const now = Date.parse('2026-11-24T10:10:00Z') / 1000
  const events = [at('2026-11-24T10:00:00Z', [{ type: 'tool_use', name: 'Bash' }])]
  const strip = stripOf({ status_bucket: 'working' }, events, 60, now)
  assert.equal(strip.label, 'TRABAJANDO')
  assert.equal(strip.text, 'Usando Bash')
  assert.equal(strip.cache, '🧊 50 min')
})

test('an hour and a minute later the cache is cold', () => {
  const now = Date.parse('2026-11-24T11:01:00Z') / 1000
  const events = [at('2026-11-24T10:00:00Z', [{ type: 'text', text: 'Listo.' }])]
  assert.equal(stripOf({ status_bucket: 'completed' }, events, 60, now).cache, '🧊 fría')
})
```

## Erreurs fréquentes et comment tester

- **Un observateur par fonctionnalité.** Plusieurs observateurs sur une page qui change de nombreuses fois par image, ça s’additionne. Utilisez-en un seul, et exécutez son travail au plus une fois par image.
- **Écrire à chaque passage.** Modifier `textContent` ou déplacer la bande quand rien n’a changé réveille de nouveau l’observateur. Comparez d’abord.
- **Une bande flottante.** Une bande en `position: fixed` recouvre les dernières lignes de la conversation et les boutons que Claude y affiche.
- **Des requêtes pendant que la page est cachée.** Un téléphone écran éteint continuerait à demander toutes les 10 secondes. Vérifiez `document.hidden`.
- **Le cache à partir du dernier événement.** Ouvrir la page crée des événements, donc compter à partir du dernier remet le compte à rebours à zéro chaque fois que vous regardez.
- **Le dernier état, et non le plus récent.** Chaque connexion rejoue 12 heures, du plus ancien au plus récent, par-dessus un état enregistré qui peut être plus récent. Comparez `at`.
- **Du texte en HTML.** Les messages de Claude, et tout ce qui se trouve sur un sujet ntfy.sh, peuvent contenir n’importe quoi. Utilisez `textContent`.
- **Attendre la bande sur la page d’accueil de Claude.** Elle ne s’affiche que sur la page d’une conversation, quand la zone de message est présente.

Pour tester les règles sur l’ordinateur, gardez-les dans des modules sans DOM, comme le fait `lib/live.js`, et donnez-leur des événements inventés, comme dans le code de référence. Côté Kotlin, `./gradlew testDebugUnitTest` lance `StateModelTest`, qui vérifie qu’un état est gardé, que le plus récent de deux l’emporte, que les keepalives et les messages qui ne sont pas du JSON sont ignorés, et qu’un état scellé que la clé ne peut pas ouvrir est marqué.

Sur le téléphone, publiez depuis l’ordinateur un état inventé sur un sujet de test que vous avez mis dans les réglages :

```bash
curl -d '{"xp":"⭐ Nivel 3 · 40/300 XP","art":"https://raw.githubusercontent.com/davshn/narsil-pet/main/assets/etapa3/parada-oscuro.png","at":1795000000,"cacheMinutes":5}' https://ntfy.sh/narsil-0000000000example0-estado
```

Ouvrez une conversation : en une seconde, la Narsil de la bande devrait montrer l’étape 3 dans la pose de la conversation, et le cache devrait décompter à partir de 5 minutes après la dernière réponse de Claude. Ensuite, changez de conversation, tournez le téléphone, éteignez et rallumez l’écran : la bande devrait rester au-dessus de la zone de message, changer avec la conversation, et se mettre à jour dans les 10 secondes qui suivent votre retour.

### Là où le code et le README diffèrent

- Les commentaires de `band.css` et de `lib/state.js` décrivent encore l’extension : « A stylesheet of the manifest's, not a `<style>` the script adds » (une feuille de style du manifeste, pas un `<style>` qu’ajoute le script), et « the background page loads it after seal.js » (la page d’arrière-plan le charge après seal.js). Dans l’application, il n’y a ni manifeste, ni page d’arrière-plan, ni `seal.js` : la feuille de style est posée comme feuille construite depuis `host.js`, et c’est Kotlin qui ouvre les états scellés. Le code se comporte comme ce guide le décrit ; seuls ces commentaires sont périmés.

## Pour aller plus loin

- Le [guide 4](/fr/android/sidebar/) présente le bloc du menu latéral, où un toucher sur Narsil ouvre les réglages.
- Le [guide 6](/fr/android/alerts-service/) explique `NtfyStream`, la classe qui suit ici `-estado`, et votre sujet pour les alertes.
- Dans Claude Code, Narsil affiche les mêmes états avec ses propres règles : voir [L’horloge du cache](/fr/mods/pet/cache-clock/) et [Les alertes sur votre téléphone et votre montre](/fr/mods/pet/phone-and-watch/) pour les champs de `-estado`.
- Le même état arrive aussi sur une montre : [Narsil Watch](/fr/watch/what-it-is/).
- Le code source est sur [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
