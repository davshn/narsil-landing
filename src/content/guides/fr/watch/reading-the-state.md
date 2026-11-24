---
title: Lire l’état de Narsil
description: 'Ce que le mod publie désormais sur <topic>-estado, limites et conversations comprises, et comment la montre récupère le dernier message de ntfy.sh, ouvre son sceau avec votre clé et le garde.'
route: watch
order: 2
updated: 2026-11-24
sources:
  - repo: pet
    path: hooks/phone.ts
  - repo: pet
    path: hooks/seal.ts
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/domain/NarsilState.kt
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/data/StatusParser.kt
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/data/StatusRepository.kt
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/data/Seal.kt
  - repo: watch
    path: app/src/test/kotlin/tech/davshn/narsilwatch/data/SealTest.kt
---

## Ce que ça fait

Tout ce que montre la montre vient d’un petit message JSON. Le mod Narsil l’écrit sur votre ordinateur et le publie sur ntfy.sh, sur le sujet `<votre sujet>-estado`. La montre lit le dernier, l’ouvre s’il est scellé, et le garde pour que la tuile, la complication et l’application puissent dessiner à partir de lui à tout moment.

Ce guide suit ce message d’un bout à l’autre : ce que le mod y met depuis narsil-pet 3.10.0, les classes Kotlin dans lesquelles il est lu (`NarsilState.kt`), la requête et ce qui est gardé (`StatusRepository.kt`), l’analyse (`StatusParser.kt`), et le sceau (`Seal.kt`), y compris ce qui se passe avec une mauvaise clé ou un message non scellé.

> **Expérimental.** La montre ne peut lire que ce que le mod a publié en dernier, et le mod ne publie que pendant que vous êtes loin de l’ordinateur, dans la marge quotidienne gratuite de ntfy.sh. ntfy.sh garde un message pendant un temps limité, si bien qu’une longue période calme laisse la montre avec sa propre dernière copie. Et la forme de l’état est un accord privé entre deux projets : un changement dans le mod peut casser la lecture.

Les exemples n’utilisent que des valeurs inventées : le sujet `narsil-0000000000example0` et de fausses clés.

## Comment ça marche à l’intérieur

### Le côté du mod : ce que transporte désormais `-estado`

`sendStatus` dans `hooks/register.tsx` de narsil-pet construit l’état et `phoneStatus` dans `hooks/phone.ts` l’emballe pour ntfy.sh : `{ topic: "<topic>-estado", message: JSON.stringify(state), priority: 1 }`. L’état lui-même est un objet JSON à sept champs depuis le commit `6400a6f`, « feat(phone): publish Claude limits and open conversations for the watch » (publier les limites de Claude et les conversations ouvertes pour la montre), publié en 3.10.0 :

| Champ          | Ce que c’est                                                                                  | La montre l’utilise ?      |
| -------------- | --------------------------------------------------------------------------------------------- | -------------------------- |
| `xp`           | Le libellé de niveau de Narsil, comme `⭐ Nivel 3 · 120/300 XP` (niveau 3).                   | Oui, dans l’application.   |
| `art`          | L’URL de son dessin, à son étape, dans la pose de la conversation ouverte la plus importante. | Oui, tuile et application. |
| `at`           | Le moment de l’envoi, en secondes Unix.                                                       | Oui, l’étiquette d’âge.    |
| `cacheMinutes` | La durée du cache du prompt ; absent quand aucune conversation n’en a un.                     | Lu, pas affiché.           |
| `usage`        | Une ligne, `ntfy`, avec le décompte de ntfy.sh des messages du jour depuis votre réseau.      | Non, ignoré.               |
| `limits`       | Les limites de 5 heures et hebdomadaire de Claude : pourcentage, couleur et réinitialisation. | Oui, partout.              |
| `sessions`     | Jusqu’à 8 conversations ouvertes, la plus importante d’abord : titre, état et libellé.        | Oui, tuile et application. |

Les deux nouveaux champs sont construits par deux fonctions pures à la fin de `hooks/phone.ts`. Ces extraits viennent de narsil-pet (GPL v3) ; le formateur de ce site a recoupé leurs longues lignes et ajouté des virgules finales et des parenthèses, et rien d’autre ne diffère du fichier :

```ts
// One Claude limit as the watch draws it: its arc, its color and when it
// resets, in seconds since the epoch (null when Claude did not say).
export type WatchLimit = {
  key: 'fiveHour' | 'week'
  label: string
  percent: number
  color: string
  resetsAt: number | null
}

type Meter = { percent: number; resetsAt?: string }

// The 5-hour and weekly limits; the context is each conversation's own.
export function watchLimits(u: { fiveHour: Meter | null; week: Meter | null }): WatchLimit[] {
  const row = (key: WatchLimit['key'], label: string, m: Meter | null): WatchLimit[] => {
    if (!m) return []
    const at = m.resetsAt ? Date.parse(m.resetsAt) : NaN
    return [
      {
        key,
        label,
        percent: m.percent,
        color: levelColor(m.percent),
        resetsAt: Number.isNaN(at) ? null : Math.floor(at / 1000),
      },
    ]
  }
  return [...row('fiveHour', '5 horas', u.fiveHour), ...row('week', 'Semana', u.week)]
}
```

Et juste en dessous, les conversations :

```ts
export type WatchSession = { title: string; status: string; label: string }

// The open conversations, most important first, as few and as short as an
// ntfy message (4 KB, more once sealed) holds with room to spare.
export const WATCH_SESSIONS = 8
const WATCH_TITLE = 40

export function watchSessions(list: readonly WatchSession[]): WatchSession[] {
  return list.slice(0, WATCH_SESSIONS).map((s) => {
    const title = s.title || 'conversación'
    return {
      title: title.length > WATCH_TITLE ? `${title.slice(0, WATCH_TITLE - 1)}…` : title,
      status: s.status,
      label: s.label,
    }
  })
}
```

Ce qu’il faut remarquer :

- **`limits` a zéro, une ou deux lignes**, `fiveHour` avec le libellé `5 horas` (5 heures) et `week` avec le libellé `Semana` (semaine). Une limite que Claude Code n’a pas signalée est laissée de côté, pas envoyée à zéro, et `resetsAt` est en secondes, ou `null` quand Claude ne l’a pas dit. Les valeurs viennent de `usage` du mod, que `usageOf` dans `hooks/usage.ts` remplit à partir des limites d’utilisation de la session de type `five_hour` et `seven_day`, les mêmes que lit la ligne d’état de Claude Code.
- **La couleur est décidée sur l’ordinateur.** `levelColor` dans `hooks/usage.ts` renvoie `#F0435A` (rouge) à partir de 85 %, `#F5B400` (jaune) à partir de 60 %, et `#22B573` (vert) en dessous. La montre peint ce qu’on lui dit, si bien que l’ordinateur et la montre ne sont jamais en désaccord.
- **`sessions` est la liste classée du mod.** `fleetOf` dans `hooks/fleet.ts` trie selon `RANK`, « An error first, then what needs you, what works, what finished » (une erreur d’abord, puis ce qui a besoin de vous, ce qui travaille, ce qui a terminé) : `error`, `waiting`, `working`, `done`, `idle`. À égalité, celle qui a changé le plus récemment passe en premier.
- **Au plus 8 sessions, des titres d’au plus 40 caractères.** Le commentaire en donne la raison : un message ntfy est limité à 4 Ko, et le scellement l’allonge. Un titre vide devient `conversación`.
- **`status` est le mot pour la machine et `label` le mot pour l’écran**, d’après `STATUS_LABEL` dans `hooks/words.ts` : `working` donne `TRABAJANDO`, `idle` donne `PARADA`, `waiting` donne `TE NECESITA`, `done` donne `TERMINADA`, `error` donne `ERROR`. La montre colore selon `status` et écrit `label`.

Un état tel que la montre le reçoit, écrit pour ce guide avec des valeurs inventées :

```json
{
  "xp": "⭐ Nivel 3 · 40/300 XP",
  "art": "https://raw.githubusercontent.com/davshn/narsil-pet/main/assets/etapa3/error-oscuro.png",
  "at": 1763900000,
  "cacheMinutes": 5,
  "usage": [],
  "limits": [
    {
      "key": "fiveHour",
      "label": "5 horas",
      "percent": 62.4,
      "color": "#F5B400",
      "resetsAt": 1763918000
    },
    { "key": "week", "label": "Semana", "percent": 90, "color": "#F0435A", "resetsAt": null }
  ],
  "sessions": [
    { "title": "web", "status": "error", "label": "ERROR" },
    { "title": "landing", "status": "waiting", "label": "TE NECESITA" }
  ]
}
```

C’est la même forme que celle qu’utilise `StatusParserTest.kt`.

### NarsilState.kt : le contrat sur la montre

La montre déclare la même forme en Kotlin. Le fichier entier, d’après `domain/NarsilState.kt` dans narsil-watch (GPL v3), sans ses lignes de package et d’import :

```kotlin
// What Narsil publishes on its ntfy status topic, as hooks/register.tsx
// (sendStatus) builds it. Fields the PC adds later are ignored; fields it
// does not send yet default to empty.
@Serializable
data class NarsilState(
    val xp: String? = null,
    val art: String? = null,
    // seconds since the epoch
    val at: Long = 0,
    val cacheMinutes: Int? = null,
    val limits: List<Limit> = emptyList(),
    val sessions: List<Session> = emptyList(),
)

// One Claude limit: the 5-hour window or the week.
@Serializable
data class Limit(
    val key: String,
    val label: String,
    val percent: Double,
    val color: String,
    // seconds since the epoch, null when Claude did not say
    val resetsAt: Long? = null,
)

// One open conversation, most important first.
@Serializable
data class Session(
    val title: String,
    val status: String,
    val label: String,
)
```

Le premier commentaire est la règle de conception, et elle joue dans les deux sens :

- **Les champs que l’ordinateur ajoute plus tard sont ignorés.** Le parseur est construit avec `Json { ignoreUnknownKeys = true }`. C’est pourquoi `usage` ne provoque aucune erreur : il n’est pas déclaré, donc il est sauté. Un futur champ sera sauté de la même façon.
- **Les champs que l’ordinateur n’envoie pas encore sont vides par défaut.** Un état d’avant 3.10.0 n’a ni `limits` ni `sessions`, et le test « reads a state from before the watch fields, with no limits or sessions » (lit un état d’avant les champs de la montre, sans limites ni sessions) vérifie qu’il se lit encore, avec les deux listes vides.

À l’intérieur d’un `Limit` ou d’une `Session`, en revanche, seul `resetsAt` a une valeur par défaut. Une limite sans sa `key`, ou une session sans son `label`, fait échouer tout le décodage, et le parseur traite le message comme s’il n’y avait aucun état.

### StatusRepository.kt : la requête

`refresh()`, le seul endroit qui demande l’état à ntfy.sh, s’exécute sur `Dispatchers.IO`, hors du fil principal. Sa ligne de requête :

```kotlin
val url = "$NTFY/${URLEncoder.encode(statusTopic, "UTF-8")}/json?poll=1&since=latest"
```

Pièce par pièce :

- **`$NTFY`** vaut `https://ntfy.sh`.
- **`statusTopic`** vaut `topic.removeSuffix(STATUS_SUFFIX) + STATUS_SUFFIX`, avec `STATUS_SUFFIX` égal à `-estado`. La montre fonctionne donc que vous saisissiez `narsil-0000000000example0` ou, par erreur, `narsil-0000000000example0-estado` : elle ne finit jamais par demander `-estado-estado`. Le sujet est encodé pour l’URL avant d’entrer dans le chemin.
- **`/json`** demande à ntfy.sh son flux JSON : un objet JSON par ligne, chacun avec un champ `event`.
- **`poll=1`** demande ce que ntfy.sh a gardé puis ferme la connexion, au lieu de la garder ouverte pour attendre de nouveaux messages. Une montre ne devrait pas garder une connexion ouverte.
- **`since=latest`** ne demande que le message le plus récent. La montre n’a besoin de rien de plus ancien : chaque état remplace le précédent.

L’assistant `get(url, limit)` ouvre une `HttpURLConnection` avec un délai de connexion de 10 secondes et un délai de lecture de 10 secondes (`TIMEOUT = 10_000`). Il renvoie `null` sauf si la réponse est un HTTP 200. Il lit au plus `limit + 1` octets, et renvoie `null` s’il y en avait plus que `limit` : 64 Ko pour l’état (`MAX_STATE`), 256 Ko pour l’image (`MAX_ART`). Un sujet que quelqu’un a rempli de déchets ne peut pas faire lire des mégaoctets à la montre.

### Ce qu’elle garde, et quand

Le dépôt garde cinq choses dans le fichier de `SharedPreferences` privé `narsil`, plus un fichier :

| Clé ou fichier | Ce qu’elle contient                                                                |
| -------------- | ---------------------------------------------------------------------------------- |
| `topic`        | Votre sujet, sans espaces autour.                                                  |
| `key`          | Votre clé, sans espaces autour, ou vide.                                           |
| `raw`          | La réponse brute de ntfy de la dernière bonne lecture.                             |
| `checkedAt`    | Le moment où la montre a reçu une réponse de ntfy.sh en dernier, en millisecondes. |
| `art.png`      | La dernière image de Narsil, dans le dossier des fichiers privés de l’application. |
| `artUrl`       | L’URL d’où vient cette image.                                                      |

Le reste de `refresh()` décide de ce qu’il faut garder. D’après `data/StatusRepository.kt` dans narsil-watch (GPL v3) :

```kotlin
val lines = try {
    get(url, MAX_STATE)?.toString(Charsets.UTF_8)
} catch (_: IOException) {
    null
} ?: return@withContext cached()?.let { StatusResult.Ok(it) } ?: StatusResult.Empty
val result = StatusParser.parse(lines, key.ifEmpty { null })
prefs.edit().putLong(CHECKED_AT, System.currentTimeMillis()).apply()
if (result is StatusResult.Ok) {
    prefs.edit().putString(RAW, lines).apply()
    result.state.art?.let { fetchArt(it) }
}
result
```

Donc :

- **Pas de réseau, un délai dépassé, une erreur HTTP ou une réponse trop grande :** rien ne change, `checkedAt` compris. Le résultat est l’état gardé, s’il y en a un. Être hors ligne n’est pas une erreur que la montre affiche.
- **Une réponse qui se lit comme un état :** les lignes brutes remplacent `raw`, `checkedAt` avance, et l’image est récupérée si son URL a changé.
- **Une réponse vide, du bruit ou scellée avec une autre clé :** `checkedAt` avance, mais `raw` est gardé. Un mauvais message n’efface jamais une bonne lecture.

Un détail est facile à manquer. Le dépôt garde la réponse **brute**, pas l’état décodé, et `cached()` l’analyse de nouveau à chaque fois, avec la clé telle qu’elle est maintenant :

```kotlin
fun cached(): NarsilState? = (StatusParser.parse(prefs.getString(RAW, "").orEmpty(), key.ifEmpty { null }) as? StatusResult.Ok)?.state
```

Cela garde un seul chemin de code pour la lecture, et cela veut dire que la copie gardée d’un état scellé reste scellée dans le stockage de la montre. Le prix : changez la clé, et une copie scellée gardée d’avant ne s’ouvre plus.

### StatusParser.kt : des lignes de ntfy à un état

`parse` renvoie l’un de trois résultats :

```kotlin
sealed interface StatusResult {
    data class Ok(val state: NarsilState) : StatusResult

    // the topic holds no state yet, or only noise
    data object Empty : StatusResult

    // sealed, and the watch has no key or the wrong one
    data object NeedsKey : StatusResult
}
```

Ces lignes et l’extrait suivant viennent de `data/StatusParser.kt` dans narsil-watch (GPL v3). Le travail :

```kotlin
val message = ntfyLines.lineSequence()
    .filter { it.isNotBlank() }
    .mapNotNull { line -> objectOf(line) }
    .filter { it["event"]?.jsonPrimitive?.content == "message" }
    .lastOrNull()
    ?.get("message")?.jsonPrimitive?.content
    ?: return StatusResult.Empty
val body = if (message.startsWith(Seal.PREFIX)) {
    val inside = key?.let { Seal.unseal(it, message) } ?: return StatusResult.NeedsKey
    // what goes inside the seal is { message } (sealedPayload)
    objectOf(inside)?.get("message")?.jsonPrimitive?.content ?: return StatusResult.Empty
} else {
    message
}
```

Étape par étape :

1. **Chaque ligne est un événement ntfy.** Les lignes qui ne sont pas des objets JSON sont sautées. Seuls les événements de type `message` comptent ; ntfy peut en envoyer d’autres.
2. **Le dernier message l’emporte.** Avec `since=latest`, il y en a d’habitude un seul, mais prendre le dernier rend le parseur correct pour n’importe quelle réponse.
3. **Son champ `message` est le texte du mod**, l’état sous forme de chaîne JSON.
4. **S’il commence par `narsil1:`, il est scellé.** Sans clé, ou si la clé ne l’ouvre pas, le résultat est `NeedsKey`.
5. **À l’intérieur du sceau, il y a une autre enveloppe.** Le mod scelle `sealedPayload(m)`, qui pour un message sans titre vaut `{"message": "..."}`. Le parseur lit donc ce `message` intérieur, qui est l’état.
6. **L’état est décodé en `NarsilState`.** Une `SerializationException` ou une `IllegalArgumentException` donne `Empty`.

### Seal.kt : ouvrir le sceau avec la même clé

`/narsil movil clave` fait sceller au mod tout ce qu’il envoie. [Les alertes sur votre téléphone et votre montre](/fr/mods/pet/phone-and-watch/) explique le schéma du côté du mod ; voici la moitié de la montre. `Seal.kt` n’implémente que `unseal`, puisque la montre ne scelle jamais rien.

Le commentaire en tête du fichier énonce le format, d’après `data/Seal.kt` dans narsil-watch (GPL v3) :

```kotlin
// Opens what Narsil seals with /narsil movil clave (hooks/seal.ts):
// HMAC-SHA256 in counter mode as the keystream, then a second HMAC over the
// nonce and the ciphertext (encrypt-then-MAC). "narsil1:" + base64url of
// nonce (16) | ciphertext | tag (32).
```

`unseal(key, sealed)` fait exactement ce que fait le `unseal` de narsil-pet, dans le même ordre :

1. **Le préfixe.** Sans `narsil1:`, il renvoie `null`.
2. **Les octets.** Le reste est décodé depuis le base64url. Moins de 48 octets (16 de nonce plus 32 de tag) renvoie `null`.
3. **La clé.** Votre clé, 43 caractères base64url, est décodée en ses 32 octets.
4. **Le tag d’abord.** `macKey = HMAC(key, "mac")`, puis `HMAC(macKey, nonce ‖ ciphertext)`, comparé avec les 32 derniers octets. S’ils diffèrent, il renvoie `null` sans rien déchiffrer.
5. **Seulement ensuite le texte.** `encKey = HMAC(key, "enc")`. Le bloc `i` du flux de clé est `HMAC(encKey, nonce ‖ i)`, avec `i` sur 4 octets, gros-boutiste. Chaque bloc donne 32 octets, combinés par XOR avec le texte chiffré. Le résultat est lu en UTF-8.

Les deux côtés diffèrent dans la manière, pas dans le résultat :

| Étape              | narsil-pet `hooks/seal.ts`                                                                                                                                | narsil-watch `Seal.kt`                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| HMAC-SHA256        | Construit à la main sur `crypto.subtle.digest`, parce que « The hooks module's crypto has SHA-256 alone » (la crypto du module de hooks n’a que SHA-256). | `javax.crypto.Mac` avec `HmacSHA256`.                                         |
| Base64url          | Ses propres `toBase64Url` et `fromBase64Url`, sur `btoa` et `atob`.                                                                                       | `java.util.Base64.getUrlDecoder()`.                                           |
| Comparaison du tag | `tag.some((b, i) => b !== given[i])`.                                                                                                                     | `MessageDigest.isEqual`, qui prend le même temps quels que soient les octets. |
| Erreurs            | Toute exception donne `null`.                                                                                                                             | Une `IllegalArgumentException` donne `null`.                                  |

Le test qui prouve qu’ils s’accordent est `SealTest.kt`. Son commentaire : « The vector comes from Narsil's own hooks/seal.ts, with a fixed nonce (100..115), so the watch opens exactly what the PC seals. » (le vecteur vient du hooks/seal.ts de Narsil lui-même, avec un nonce fixe, 100..115, pour que la montre ouvre exactement ce que le PC scelle). La clé est faite des octets 0 à 31, `AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8` ; le texte en clair est un petit `{"message": ...}` avec un `xp` et une session. Les 16 octets de nonce de 100 à 115 sont les lettres `defghijklmnopqrs`, c’est pourquoi le texte scellé commence par `narsil1:ZGVmZ2hpamtsbW5vcHFyc`, leur base64url.

Pour ce guide, le vecteur a aussi été vérifié dans l’autre sens : exécuter le `seal()` de narsil-pet depuis `hooks/seal.ts` avec cette clé, ce texte et ce nonce donne exactement la chaîne de `SealTest.kt`.

### Ce qui se passe avec une mauvaise clé, sans clé, ou avec un message non scellé

Le code est précis là-dessus, alors voici chaque cas :

| Le message sur le sujet      | La clé sur la montre | `Seal.unseal`                     | `StatusParser.parse`          |
| ---------------------------- | -------------------- | --------------------------------- | ----------------------------- |
| Scellé                       | La bonne             | Le texte intérieur                | `Ok`                          |
| Scellé                       | Aucune               | Pas appelé                        | `NeedsKey`                    |
| Scellé                       | Une autre clé valide | `null` : le tag ne correspond pas | `NeedsKey`                    |
| Scellé, un caractère modifié | La bonne             | `null` : le tag ne correspond pas | `NeedsKey`                    |
| Non scellé                   | Aucune               | Pas appelé                        | `Ok`, lu comme du JSON simple |
| Non scellé                   | N’importe quelle clé | Pas appelé                        | `Ok`, lu comme du JSON simple |
| Non scellé, et pas un état   | N’importe laquelle   | Pas appelé                        | `Empty`                       |

`SealTest.kt` couvre la colonne `Seal` : « opens what Narsil seals » (ouvre ce que Narsil scelle), « another key opens nothing » (une autre clé n’ouvre rien), « a tampered message opens nothing » (un message altéré n’ouvre rien) et « what is not sealed opens nothing » (ce qui n’est pas scellé n’ouvre rien), qui vérifie que `unseal(key, "no sellado")` (non scellé) et `unseal("not base64!", sealed)` donnent tous deux `null`. `StatusParserTest.kt` couvre la dernière colonne dans « a sealed state needs the key » (un état scellé a besoin de la clé).

Deux conséquences en découlent.

**Une mauvaise clé cache aussi l’état gardé.** Après un `NeedsKey`, `raw` n’est pas touché, mais `cached()` l’analyse de nouveau avec la mauvaise clé. Si la copie gardée était scellée, elle ne s’ouvre plus non plus : la tuile dit `configúrame` (configure-moi), la complication n’affiche aucune donnée, et l’application affiche sa note `El estado va sellado: falta la clave o no es la de /narsil movil clave.` (l’état est scellé : la clé manque ou ce n’est pas celle de /narsil movil clave). Remettez la bonne clé et tout revient, à partir du même `raw`.

**Une clé ne fait pas refuser les messages en clair à la montre.** Le parseur n’appelle `unseal` que pour un texte qui commence par `narsil1:`. Un état en clair est lu que vous ayez une clé ou non. Cela permet à la montre de continuer à fonctionner après `/narsil movil clave off`, mais cela veut aussi dire que quiconque connaît votre sujet peut publier un état en clair, et que la montre l’affichera. La clé protège ce que vous lisez du regard des autres ; elle ne prouve pas qui a écrit ce que vous lisez.

### L’image : seulement depuis narsil-pet

Quand une lecture est bonne, le dépôt récupère le dessin nommé dans `art`. D’après `StatusRepository.kt` (GPL v3) :

```kotlin
// Narsil's art, only from the repository that publishes it: whoever knows
// an unsealed topic could write to it.
private fun fetchArt(url: String) {
    if (!url.startsWith(ART_ORIGIN) || url == prefs.getString(ART_URL, null)) return
```

`ART_ORIGIN` vaut `https://raw.githubusercontent.com/davshn/narsil-pet/`. Le commentaire en donne la raison (les dessins de Narsil, seulement depuis le dépôt qui les publie : quiconque connaît un sujet non scellé pourrait y écrire). Un état en clair falsifié pourrait nommer n’importe quelle URL, et cette vérification empêche la montre de la récupérer. Elle saute aussi le téléchargement quand l’URL est celle qui est déjà sur le disque, si bien que la même pose n’est téléchargée qu’une fois. L’image n’est écrite dans `art.png` que si elle fait 256 Ko ou moins.

### Les secrets, en termes simples

- **Le sujet** est stocké dans les préférences privées de l’application, et il ne voyage que dans le chemin de la requête vers ntfy.sh. Il permet à n’importe qui de lire vos messages et de publier sur le sujet. Changez-le avec `/narsil movil nuevo`, puis saisissez le nouveau sur la montre.
- **La clé** est stockée à côté et n’est jamais envoyée nulle part. Elle ouvre les messages scellés. `/narsil movil clave` en crée une nouvelle à chaque fois ; l’ancienne cesse d’ouvrir les nouveaux messages.
- **Les mots du mod lui-même nomment encore d’anciens récepteurs.** Le commentaire de `hooks/seal.ts` nomme « the PC, the Firefox extension and the phone app » (le PC, l’extension Firefox et l’application du téléphone), et la réponse de `/narsil movil clave` dit de coller la clé dans « la extensión de Firefox » (l’extension Firefox). La montre ouvre le même sceau ; collez la même clé sous **Configurar** (configurer).

## Le construire avec Claude

Demandez à Claude la couche de données seule, sans aucun écran : les classes d’état, le parseur, le sceau et le dépôt, avec des tests. L’idée que Claude doit bien saisir : une mauvaise réponse ne remplace jamais une bonne lecture.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon application Wear OS `my-watch` (Kotlin, kotlinx.serialization), écris la couche de données pour l’état ntfy de Narsil. `domain/NarsilState.kt` : des classes `@Serializable` pour `{ xp, art, at, cacheMinutes, limits: [{ key, label, percent, color, resetsAt }], sessions: [{ title, status, label }] }`, chaque champ de premier niveau avec une valeur vide par défaut. `data/Seal.kt` : `unseal(key, sealed): String?` pour le format de `hooks/seal.ts` de narsil-pet (préfixe `narsil1:`, base64url de nonce 16 + ciphertext + tag 32 ; `macKey = HMAC(key,"mac")`, `encKey = HMAC(key,"enc")`, bloc i du flux de clé = `HMAC(encKey, nonce ‖ i as 4 bytes big-endian)`, vérifie le tag avec `MessageDigest.isEqual` avant de déchiffrer). `data/StatusParser.kt` : analyse les lignes JSON de ntfy, garde le dernier `event == "message"`, ouvre-le s’il est scellé (le JSON intérieur est `{ message }`), et renvoie `Ok`, `Empty` ou `NeedsKey`. `data/StatusRepository.kt` : GET `https://ntfy.sh/<topic>-estado/json?poll=1&since=latest` avec des délais de 10 s et un plafond de 64 Ko ; ne garde les lignes brutes que quand elles s’analysent en `Ok` ; en cas d’erreur réseau, renvoie l’état gardé. Des tests JUnit, dont un vecteur connu scellé par `hooks/seal.ts` avec un nonce fixe.

### Ce qu’il faut vérifier dans la réponse de Claude

1. La requête utilise `poll=1&since=latest`, encode le sujet, et ajoute `-estado` sans le doubler.
2. La taille de la réponse est plafonnée, et seul un HTTP 200 est lu.
3. La réponse brute n’est gardée que quand elle s’analyse en état. Une erreur réseau, un sujet vide ou une mauvaise clé ne l’écrasent jamais.
4. `unseal` vérifie le tag avant de déchiffrer, et le compare avec `MessageDigest.isEqual`.
5. Les champs inconnus sont ignorés (`ignoreUnknownKeys = true`), et un état sans `limits` ni `sessions` se lit quand même.
6. Il y a un test avec un vecteur produit par le `seal.ts` du mod lui-même, pas seulement un aller-retour du côté de la montre. Un aller-retour prouve seulement que la montre est d’accord avec elle-même.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « après une erreur réseau, la tuile est devenue vide », ce qui montre que le chemin d’erreur écrase l’état gardé.

### Comment l’auteur l’a demandé

Aucune demande consignée n’existe pour cette partie. Voici une reconstitution à partir de l’historique des commits :

- narsil-pet `5a9ee10` (2026-11-01) « feat: seal phone messages with /narsil movil clave, send reset times and an Abrir Claude button » (sceller les messages du téléphone avec /narsil movil clave, envoyer les heures de réinitialisation et un bouton Abrir Claude). Le sceau voit le jour du côté du mod.
- narsil-pet `6400a6f` (2026-11-23) « feat(phone): publish Claude limits and open conversations for the watch » (publier les limites de Claude et les conversations ouvertes pour la montre). `watchLimits` et `watchSessions` arrivent, avec le test « the watch gets the 5-hour and weekly limits with their color and reset, and at most 8 conversations » (la montre reçoit les limites de 5 heures et hebdomadaire avec leur couleur et leur réinitialisation, et au plus 8 conversations). Son message : « The status topic now carries the 5-hour and weekly limits (percent, color, reset) and up to 8 open conversations, so a Wear OS app can show them. » (le sujet d’état transporte désormais les limites de 5 heures et hebdomadaire, pourcentage, couleur, réinitialisation, et jusqu’à 8 conversations ouvertes, pour qu’une application Wear OS puisse les afficher).
- narsil-watch `b47ca7a` (2026-11-23) « feat: Narsil on Wear OS with Claude limits and open conversations » (Narsil sur Wear OS avec les limites de Claude et les conversations ouvertes). La couche de données et ses tests arrivent avec le reste de l’application. Son message se termine par : « It reads Narsil's state from its ntfy.sh status topic and opens it with the /narsil movil clave key when sealed. » (elle lit l’état de Narsil sur son sujet d’état ntfy.sh et l’ouvre avec la clé de /narsil movil clave quand il est scellé).

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide. Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

Un lecteur réduit, écrit pour ce guide et adapté de `StatusParser.kt`, `StatusRepository.kt` et `Seal.kt` dans [narsil-watch](https://github.com/davshn/narsil-watch) (GPL v3). Il n’utilise que les appels Java et kotlinx.serialization qu’utilisent ces fichiers. Il laisse de côté l’image et la copie stockée :

```kotlin
package com.example.mywatch.data

import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.security.MessageDigest
import java.util.Base64
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

object StateReader {
    private const val PREFIX = "narsil1:"
    private const val NONCE = 16
    private const val BLOCK = 32
    private const val MAX = 64 * 1024
    private val json = Json { ignoreUnknownKeys = true }

    fun fetch(topic: String): String? {
        val name = topic.removeSuffix("-estado") + "-estado"
        val url = "https://ntfy.sh/${URLEncoder.encode(name, "UTF-8")}/json?poll=1&since=latest"
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 10_000
        conn.readTimeout = 10_000
        return try {
            if (conn.responseCode != HttpURLConnection.HTTP_OK) return null
            val bytes = conn.inputStream.use { input ->
                val out = ByteArrayOutputStream()
                val buf = ByteArray(8192)
                while (out.size() <= MAX) {
                    val read = input.read(buf)
                    if (read < 0) break
                    out.write(buf, 0, read)
                }
                out.toByteArray()
            }
            if (bytes.size > MAX) null else bytes.toString(Charsets.UTF_8)
        } finally {
            conn.disconnect()
        }
    }

    fun stateText(lines: String, key: String?): String? {
        val message = lines.lineSequence()
            .mapNotNull { line ->
                try {
                    json.parseToJsonElement(line).jsonObject
                } catch (_: SerializationException) {
                    null
                } catch (_: IllegalArgumentException) {
                    null
                }
            }
            .filter { it["event"]?.jsonPrimitive?.content == "message" }
            .lastOrNull()
            ?.get("message")?.jsonPrimitive?.content ?: return null
        if (!message.startsWith(PREFIX)) return message
        val inside = key?.let { unseal(it, message) } ?: return null
        return json.parseToJsonElement(inside).jsonObject["message"]?.jsonPrimitive?.content
    }

    fun unseal(key: String, sealed: String): String? {
        if (!sealed.startsWith(PREFIX)) return null
        return try {
            val bytes = Base64.getUrlDecoder().decode(sealed.removePrefix(PREFIX))
            if (bytes.size < NONCE + BLOCK) return null
            val k = Base64.getUrlDecoder().decode(key)
            val body = bytes.copyOfRange(0, bytes.size - BLOCK)
            val tag = hmac(hmac(k, "mac".toByteArray()), body)
            if (!MessageDigest.isEqual(tag, bytes.copyOfRange(bytes.size - BLOCK, bytes.size))) return null
            val encKey = hmac(k, "enc".toByteArray())
            val nonce = bytes.copyOfRange(0, NONCE)
            val cipher = bytes.copyOfRange(NONCE, bytes.size - BLOCK)
            val out = ByteArray(cipher.size)
            for (i in cipher.indices) {
                val block = i / BLOCK
                val counter = byteArrayOf((block ushr 24).toByte(), (block ushr 16).toByte(), (block ushr 8).toByte(), block.toByte())
                out[i] = (cipher[i].toInt() xor hmac(encKey, nonce + counter)[i % BLOCK].toInt()).toByte()
            }
            String(out, Charsets.UTF_8)
        } catch (_: IllegalArgumentException) {
            null
        }
    }

    private fun hmac(key: ByteArray, data: ByteArray): ByteArray {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(key, "HmacSHA256"))
        return mac.doFinal(data)
    }
}
```

Deux simplifications à connaître. La boucle de lecture s’arrête un peu au-delà de 64 Ko plutôt qu’à 64 Ko plus un octet, ce qui suffit pour rejeter une réponse trop grande ; le `readNBytesCompat` du vrai dépôt s’arrête exactement. Et cette version recalcule le bloc du flux de clé pour chaque octet, par souci de brièveté, soit 32 fois le travail ; le vrai `xorStream` calcule chaque bloc une seule fois. `stateText` renvoie `null` aussi bien pour « aucun état » que pour « a besoin de la clé » ; le vrai parseur les sépare, parce que l’application vous dit de quel cas il s’agit.

## Erreurs fréquentes et comment tester

- **Garder la connexion ouverte.** Sans `poll=1`, le point d’accès `/json` de ntfy continue de diffuser. Sur une montre, c’est une ponction sur la batterie, et une tâche de rafraîchissement qui ne se termine jamais.
- **Écraser la bonne lecture.** Enregistrer chaque réponse veut dire qu’une seule interrogation vide, après que ntfy.sh a oublié le message, vide la tuile.
- **Oublier l’enveloppe intérieure.** Le texte scellé s’ouvre sur `{"message": "..."}`, pas sur l’état lui-même.
- **Supposer qu’une clé veut dire « scellé uniquement ».** Un état en clair est quand même lu. Traitez un état en clair comme possiblement falsifié quand une clé est définie, si cela compte pour vous.
- **Un décodeur strict.** Sans `ignoreUnknownKeys`, le champ non déclaré `usage` fait échouer chaque état.

Pour lancer les tests, depuis le dépôt :

```bash
./gradlew :app:testDebugUnitTest
```

`StatusParserTest.kt` a quatre tests : « reads the state as the PC sends it in the clear » (lit l’état tel que le PC l’envoie en clair), « reads a state from before the watch fields, with no limits or sessions » (lit un état d’avant les champs de la montre, sans limites ni sessions), « a sealed state needs the key » (un état scellé a besoin de la clé) et « an empty topic or noise is no state yet » (un sujet vide ou du bruit n’est pas encore un état). `SealTest.kt` a les quatre cités plus haut.

Pour vérifier le sujet réel depuis votre ordinateur, vous pouvez poser à ntfy.sh la même question que la montre. Ceci est écrit pour ce guide, avec le sujet d’exemple :

```bash
curl -s "https://ntfy.sh/narsil-0000000000example0-estado/json?poll=1&since=latest"
```

N’utilisez votre propre sujet que dans votre propre terminal, jamais dans un terminal partagé ni dans une capture d’écran.

### Là où le code et le README diffèrent

- Le README de narsil-pet documente encore cinq champs pour `-estado` (`xp`, `art`, `at`, `cacheMinutes`, `usage`). Depuis 3.10.0, son code en envoie sept ; `limits` et `sessions` manquent dans ce tableau. Le test de narsil-pet « as a turn ends from the phone, the extension gets only what it reads on the status topic, silently » (quand un tour se termine depuis le téléphone, l’extension ne reçoit que ce qu’elle lit sur le sujet d’état, en silence) les liste tous les sept.
- Le README de narsil-pet dit que l’état part « At the end of each turn » (à la fin de chaque tour). Le code l’envoie aussi avec chaque question, et seulement pendant que vous êtes à distance.
- Le README de la montre dit que la clé permet à la montre d’ouvrir l’état « just as the computer sealed it » (tel que l’ordinateur l’a scellé). C’est vrai, et le code ajoute une chose que le README ne dit pas : avec une clé définie, un message en clair est quand même accepté.

## Pour aller plus loin

- Lisez `data/` dans [narsil-watch](https://github.com/davshn/narsil-watch) sur GitHub.
- Le côté du mod pour le sujet, le décompte quotidien et le sceau : [Les alertes sur votre téléphone et votre montre](/fr/mods/pet/phone-and-watch/).
- Faites rejeter au parseur les messages en clair quand une clé est définie, pour qu’un état falsifié soit ignoré. Réfléchissez à ce qui se passe alors juste après `/narsil movil clave off`.
- Retour à [Ce qu’est Narsil Watch](/fr/watch/what-it-is/) pour la vue d’ensemble.
- Ensuite : [La tuile](/fr/watch/tile/), les deux anneaux et Narsil au centre.
