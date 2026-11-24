---
title: Le chiffrement et les réglages
description: 'Comment Seal.kt ouvre ce que le mod a scellé avec /narsil movil clave, octet pour octet comme hooks/seal.ts le scelle, ce que l’application garde et où, la rotation de clé et de sujet, et les menaces.'
route: android
order: 7
updated: 2026-11-24
sources:
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/Seal.kt
  - repo: android
    path: app/src/test/java/io/github/davshn/narsil/SealTest.kt
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/Settings.kt
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/SettingsActivity.kt
  - repo: android
    path: app/src/main/res/xml/shortcuts.xml
  - repo: pet
    path: hooks/seal.ts
  - repo: pet
    path: hooks/phone.ts
  - repo: pet
    path: hooks/register.tsx
---

## Ce que ça fait

Votre sujet ntfy.sh est public dans un certain sens : quiconque connaît son nom peut le lire. `/narsil movil clave` (clé) dans le mod Narsil règle la partie lecture. La commande crée une clé et, à partir de là, le mod scelle tout ce qu’il publie, alertes comme états. Qui lit le sujet voit « Narsil » et un texte illisible qui commence par `narsil1:`. Vous saisissez la même clé dans les réglages de l’application, et l’application ouvre chaque message avant de l’afficher.

Quand la clé est fausse ou manque :

- **Une alerte** dit « 🔒 Aviso cifrado: pon la clave en los ajustes de la app. » (alerte chiffrée : mettez la clé dans les réglages de l’application).
- **Le bloc du menu latéral** dit « 🔒 Toca y pon la clave » (touchez et saisissez la clé), s’il n’a pas d’état antérieur à afficher.

L’écran des réglages contient deux choses, le sujet et la clé, et ne les garde que sur le téléphone. Il s’ouvre depuis trois endroits : un toucher sur Narsil (ou sur un avis) dans le bloc du menu latéral, un toucher sur la notification discrète « Narsil escucha tus avisos », et un appui long sur l’icône de l’application, puis **Ajustes** (réglages), là où le lanceur affiche des raccourcis.

> **Expérimental.** L’application s’appuie sur la structure de la page `claude.ai` et sur ses requêtes internes, pas sur une API publique, donc une mise à jour de Claude peut casser la bande et les couleurs. Le chiffrement décrit ici est un schéma construit à la main pour Narsil, pas un format de bibliothèque revu. Il est vérifié face à la sortie du mod lui-même, mais personne ne l’a audité ; voyez-le comme une protection contre les lecteurs occasionnels de votre sujet, et lisez le modèle de menaces à la fin.

## Comment ça marche à l’intérieur

### Ce que le mod scelle, et ce qu’il ne scelle pas

C’est le mod qui décide de ce qui va à l’intérieur. Depuis `hooks/phone.ts` dans [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later) :

<!-- prettier-ignore -->
```ts
export function sealedMessage<M extends { title?: string; message: string }>(m: M, sealed: string): M {
  return { ...m, ...(m.title ? { title: 'Narsil' } : {}), message: sealed }
}

// What goes inside the seal.
export function sealedPayload(m: { title?: string; message: string }): string {
  return JSON.stringify(m.title ? { title: m.title, message: m.message } : { message: m.message })
}
```

Pour une alerte, le titre et le texte vont à l’intérieur, en JSON, et le titre à l’extérieur devient simplement `Narsil`. Tout le reste du message reste lisible : la priorité, les étiquettes, l’adresse de l’image et le bouton. Pour un état sur `-estado`, qui n’a pas de titre, tout l’état JSON va à l’intérieur.

### Le format : `narsil1:` et trois parties

Un message scellé est le préfixe `narsil1:` suivi d’une seule chaîne base64url, qui se décode en trois parties à la suite :

| Partie        | Taille               | Ce que c’est                                                                         |
| ------------- | -------------------- | ------------------------------------------------------------------------------------ |
| Nonce         | 16 octets            | Aléatoire pour chaque message, si bien que le même texte n’est jamais scellé pareil. |
| Texte chiffré | La même que le texte | Le texte UTF-8, combiné par XOR avec un flux de clé.                                 |
| Tag           | 32 octets            | La preuve que le nonce et le texte chiffré ont été faits avec cette clé.             |

La clé elle-même fait 32 octets aléatoires, affichés par le mod en base64url (43 caractères). Le schéma utilise une seule primitive, HMAC-SHA256, pour tout. Le commentaire du mod explique pourquoi : « The hooks module's crypto has SHA-256 alone » (le crypto du module de hooks n’a que SHA-256), donc HMAC est construit dessus à la main. [Les alertes sur votre téléphone et votre montre](/fr/mods/pet/phone-and-watch/) parcourt le côté scellement pas à pas.

### `Seal.kt` : l’ouvrir

Depuis `Seal.kt` dans narsil-android (MIT) :

```kotlin
    // The text inside, or IllegalArgumentException when the key is not the one that sealed it.
    fun open(key: String, text: String): String {
        val bytes = bytesOf(text.removePrefix(PREFIX))
        val shared = bytesOf(key)
        require(bytes.size >= NONCE + TAG && shared.isNotEmpty()) { WRONG_KEY }
        val encKey = hmac(shared, "enc".toByteArray())
        val macKey = hmac(shared, "mac".toByteArray())
        val body = bytes.copyOfRange(0, bytes.size - TAG)
        val given = bytes.copyOfRange(bytes.size - TAG, bytes.size)
        require(MessageDigest.isEqual(hmac(macKey, body), given)) { WRONG_KEY }
        val nonce = body.copyOfRange(0, NONCE)
        val cipher = body.copyOfRange(NONCE, body.size)
        val plain = ByteArray(cipher.size)
        var block = 0
        while (block * 32 < cipher.size) {
            val stream = hmac(encKey, ByteBuffer.allocate(NONCE + 4).put(nonce).putInt(block).array())
            for (j in 0 until 32) {
                val i = block * 32 + j
                if (i >= cipher.size) break
                plain[i] = (cipher[i].toInt() xor stream[j].toInt()).toByte()
            }
            block++
        }
        return String(plain, Charsets.UTF_8)
    }
```

Dans l’ordre :

1. **Décoder** le message et la clé depuis le base64. `bytesOf` accepte l’alphabet standard et l’alphabet sûr pour les URL, avec ou sans remplissage, et donne un tableau vide pour tout ce qui n’est pas du base64.
2. **Refuser ce qui ne peut pas être bon** : un message plus court qu’un nonce plus un tag, ou une clé vide. Les deux lèvent une exception avec le message « La clave no es la de este aviso » (la clé n’est pas celle de cette alerte).
3. **Dériver deux clés** de la vôtre : `encKey = HMAC(key, "enc")` pour le flux de clé et `macKey = HMAC(key, "mac")` pour le tag. Utiliser la même clé pour les deux rôles est une erreur classique ; en dériver deux l’évite.
4. **Vérifier d’abord le tag.** Calculer `HMAC(macKey, nonce ‖ ciphertext)` et le comparer avec le tag reçu. Une différence signifie une autre clé ou un octet modifié, et le code s’arrête là, avant de déchiffrer quoi que ce soit. Cet ordre s’appelle encrypt-then-MAC.
5. **Déchiffrer** 32 octets à la fois. Le bloc `i` du flux de clé est `HMAC(encKey, nonce ‖ i)`, avec `i` sur quatre octets, en big-endian (l’ordre par défaut de `ByteBuffer`). On le combine par XOR avec le texte chiffré. C’est le mode compteur (CTR), avec HMAC à la place d’un chiffrement par blocs.

La comparaison utilise `MessageDigest.isEqual`, qui prend le même temps quel que soit le nombre d’octets qui correspondent, si bien que le temps qu’elle prend ne révèle rien du bon tag.

### Octet pour octet avec `hooks/seal.ts`

Le commentaire de la classe dit que l’application ouvre ce que le mod scelle « byte for byte as it seals it » (octet pour octet comme il le scelle). Côte à côte avec `hooks/seal.ts` de narsil-pet :

| Étape              | Mod (`hooks/seal.ts`)                                            | Application (`Seal.kt`)                           |
| ------------------ | ---------------------------------------------------------------- | ------------------------------------------------- |
| Préfixe            | `narsil1:`                                                       | `narsil1:`                                        |
| HMAC               | Construit à la main à partir de SHA-256 (`crypto.subtle.digest`) | `javax.crypto.Mac` avec `HmacSHA256`              |
| Deux clés          | `hmac(k, 'enc')`, `hmac(k, 'mac')`                               | `hmac(shared, "enc")`, `hmac(shared, "mac")`      |
| Compteur           | `DataView.setUint32(0, i)` : 4 octets, big-endian                | `ByteBuffer.putInt(block)` : 4 octets, big-endian |
| Tag calculé sur    | `nonce ‖ ciphertext`                                             | `nonce ‖ ciphertext`                              |
| Comparaison du tag | `tag.some((b, i) => b !== given[i])`                             | `MessageDigest.isEqual`                           |
| Base64             | Sûr pour les URL, sans remplissage                               | L’un ou l’autre alphabet, remplissage facultatif  |
| Trop court         | Renvoie `null`                                                   | Lève une exception                                |
| Clé vide           | Non vérifié                                                      | Lève une exception                                |
| Mauvaise clé       | Renvoie `null`                                                   | Lève `IllegalArgumentException`                   |

Un HMAC construit à la main et un HMAC de bibliothèque donnent les mêmes octets quand les deux suivent la construction standard, ce que le commentaire du mod affirme pour WebCrypto : il « gives the same bytes » (donne les mêmes octets). La preuve, ici, c’est le test. `SealTest.kt` contient une clé et un message scellé dont le commentaire dit « The vector was sealed by a JavaScript port of the mod's hooks/seal.ts » (le vecteur a été scellé par un portage JavaScript du hooks/seal.ts du mod ; le commit `9051a31` dit que le vecteur venait du propre code de l’ancienne extension). Le texte à l’intérieur est long exprès, « texto largo para cruzar varios bloques de 32 bytes » (un texte long pour traverser plusieurs blocs de 32 octets), et contient des accents et un `✓`, si bien que le compteur et l’UTF-8 sont tous deux mis à l’épreuve. Les tests vérifient que le vecteur s’ouvre sur ce texte exact, qu’une autre clé lève une exception avec le message en espagnol, quels textes comptent comme scellés, et les trois cas d’`unseal` ci-dessous.

### `unseal` : ce qui arrive vraiment à chaque message

`Seal.open` est utilisé à travers `unseal`, qui prend un message ntfy et en renvoie un avec son titre et son texte remis à leur place. Depuis `Seal.kt` (MIT) :

```kotlin
    // An ntfy message with its title and text back in place: unchanged when not sealed; with `sealed: true` and no
    // text when the key cannot open it.
    fun unseal(key: String?, m: JSONObject): JSONObject {
        if (!isSealed(m.optString("message"))) return m
        val out = JSONObject(m.toString())
        try {
            val inside = JSONObject(open(key.orEmpty(), m.getString("message")))
            if (inside.has("title")) out.put("title", inside.get("title"))
            out.put("message", inside.optString("message"))
        } catch (_: Exception) {
            out.put("message", "").put("sealed", true)
        }
        return out
    }
```

Lisez-le attentivement, car les cas ne sont pas tous ceux qu’on pourrait attendre :

| Le message               | La clé dans l’application | Une alerte affiche                    | La bande                                      |
| ------------------------ | ------------------------- | ------------------------------------- | --------------------------------------------- |
| Non scellé               | Aucune                    | Son titre et son texte                | Prend l’état                                  |
| Non scellé               | N’importe quelle clé      | Son titre et son texte, **inchangés** | Prend l’état                                  |
| Scellé                   | La bonne                  | Le titre et le texte de l’intérieur   | Prend l’état                                  |
| Scellé                   | Fausse, vide ou aucune    | Le titre `Narsil`, le texte 🔒        | Marque `isSealed` ; garde tout état antérieur |
| Scellé, un octet modifié | La bonne                  | Le titre `Narsil`, le texte 🔒        | Marque `isSealed` ; garde tout état antérieur |

Trois faits en découlent :

- **Une mauvaise clé échoue en fermant.** Pas de texte partiel, pas de charabia : le message est marqué `sealed: true` et son texte vidé. Toute erreur à l’intérieur, un mauvais tag, un échec de décodage ou un intérieur qui n’est pas du JSON, se termine de la même façon.
- **Un message non scellé passe, avec ou sans clé.** `unseal` le renvoie inchangé s’il ne commence pas par `narsil1:`. L’application n’exige pas le scellement une fois que vous avez réglé une clé. C’est pratique après `/narsil movil clave off`, mais cela veut aussi dire que la clé n’empêche pas quelqu’un qui connaît votre sujet de publier une alerte ou un état en clair que l’application affichera.
- **Le cadenas de la bande est plus discret que celui de l’alerte.** Comme l’explique le [guide 4](/fr/android/sidebar/), `StateModel` garde son état antérieur quand un message ne s’ouvre pas, et le bloc affiche un état dès qu’il en a un. L’avis du cadenas n’apparaît que quand il n’y a rien à afficher.

### `Settings.kt` : ce que l’application garde, et où

Depuis `Settings.kt` (MIT) :

```kotlin
// What the app keeps on the phone: the topic and the key typed in its settings (never in its code, as the repository
// is public), the last alert it showed, so a restart goes on from it, and the band's last state, per topic.
class Settings(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("narsil", Context.MODE_PRIVATE)

    var topic: String?
        get() = prefs.getString(TOPIC, null)?.takeIf { isTopic(it) }
        set(value) = prefs.edit().putString(TOPIC, value).remove(LAST_ALERT).apply()

    var key: String?
        get() = prefs.getString(KEY, null)?.takeIf { it.isNotBlank() }
        set(value) = prefs.edit().putString(KEY, value).apply()

    var lastAlertId: String?
        get() = prefs.getString(LAST_ALERT, null)
        set(value) = prefs.edit().putString(LAST_ALERT, value).apply()
```

Quatre valeurs, dans le fichier `SharedPreferences` d’Android nommé `narsil` :

| Clé           | Ce qu’elle contient                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `topic`       | Votre sujet. Relu seulement s’il correspond encore à `^[-_A-Za-z0-9]{1,64}$`.                                                        |
| `key`         | Votre clé, telle que vous l’avez saisie. Une clé vide se lit comme aucune clé.                                                       |
| `lastAlertId` | L’identifiant de la dernière alerte affichée, pour reprendre ([guide 6](/fr/android/alerts-service/)). Effacé avec un nouveau sujet. |
| `band`        | Le dernier état de la bande, avec le sujet auquel il appartient ; ignoré pour tout autre sujet.                                      |

`MODE_PRIVATE` place le fichier dans le dossier de données propre à l’application, que le bac à sable d’Android ferme aux autres applications. Les valeurs y sont en texte clair : l’application ne les chiffre pas avec le Keystore d’Android. Le `android:allowBackup="false"` du manifeste les garde hors des sauvegardes d’Android. La spécification S4 explique pourquoi on les saisit au lieu de les intégrer : « the repository is public and named `narsil-android`: no topic or key in the code; they are typed in the app's settings. » (le dépôt est public et s’appelle `narsil-android` : aucun sujet ni clé dans le code ; on les saisit dans les réglages de l’application).

### `SettingsActivity.kt` : l’écran

L’écran est une mise en page Android simple : un texte d’introduction, un champ **Topic** (sujet), un champ **Clave (opcional)** (clé, facultative), le bouton **Guardar y recibir avisos**, une ligne d’état et le bouton d’arrière-plan du [guide 6](/fr/android/alerts-service/). Quelques choix méritent d’être remarqués :

- **Le champ de la clé est un champ de mot de passe** (`inputType="textPassword"`), donc il affiche des points, et les deux champs fixent `importantForAutofill="no"`, pour qu’aucun gestionnaire de mots de passe ne propose de les enregistrer.
- **L’enregistrement valide d’abord le sujet.** Un sujet qui contient autre chose que des lettres, des chiffres, `-` et `_` reçoit « Ese topic no es válido: solo letras, números, - y _. » (ce sujet n’est pas valide : seulement des lettres, des chiffres, - et _), et rien n’est enregistré.
- **Les deux valeurs sont nettoyées des espaces** au début et à la fin, si bien qu’une espace copiée avec elles ne fait pas de mal.
- **Le sujet n’est écrit que s’il a changé**, si bien qu’enregistrer le même sujet garde `lastAlertId` et que les alertes reprennent là où elles en étaient.
- **Enregistrer un champ de clé vide** supprime la clé : le getter lit une valeur vide comme aucune clé.
- Ensuite, il démarre le service d’alertes, dit « Guardado. Los avisos llegan a este teléfono; vuelve a Claude para ver la banda. » (enregistré ; les alertes arrivent sur ce téléphone ; revenez à Claude pour voir la bande), et demande l’autorisation des notifications si Android en a besoin.

L’activité est `exported` dans le manifeste, ce qui permet au raccourci du lanceur de l’ouvrir. `res/xml/shortcuts.xml` déclare cet unique raccourci statique, avec le libellé court **Ajustes** et le libellé long **Ajustes de Narsil** (réglages de Narsil), qui pointe vers `io.github.davshn.narsil.SettingsActivity`. Être exportée signifie aussi qu’une autre application pourrait ouvrir l’écran, mais elle n’y gagne rien : l’écran n’affiche que des champs, et ils ne contiennent rien que cette application puisse lire.

### Changer la clé et le sujet

Chaque commande s’exécute dans Claude Code sur votre ordinateur ; chaque changement va ensuite dans les réglages de l’application.

| Vous voulez                               | Sur l’ordinateur          | Dans l’application                                                                                                      |
| ----------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Commencer à chiffrer, ou une nouvelle clé | `/narsil movil clave`     | Collez la nouvelle clé et enregistrez. Tant que vous ne l’avez pas fait, les alertes affichent le texte 🔒.             |
| Arrêter de chiffrer                       | `/narsil movil clave off` | Rien n’est nécessaire, puisque les messages en clair passent ; videz le champ de la clé pour faire le ménage.           |
| Un nouveau sujet                          | `/narsil movil nuevo`     | Collez le nouveau sujet et enregistrez. Les alertes redémarrent sur lui, et la bande part d’un état vide.               |
| Arrêter les alertes                       | `/narsil movil off`       | Rien à faire ; l’application n’a pas d’interrupteur à elle.                                                             |
| Tout effacer sur le téléphone             |                           | **Paramètres → Applications → Narsil → Stockage** d’Android, videz-le : la session, le sujet, la clé et l’état partent. |

Les réponses du mod confirment chaque étape. Pour un nouveau sujet : « Narsil: tema nuevo, el anterior ya no recibe nada. » (nouveau sujet ; l’ancien ne reçoit plus rien). Pour une nouvelle clé, il affiche la clé et ajoute « /narsil movil clave crea otra clave » (crée une autre clé). Cette réponse dit encore de mettre la clé dans les options de l’extension Firefox ; sur Android, elle va dans les réglages de cette application.

Chaque `/narsil movil clave` crée une **nouvelle** clé, et aucune commande n’affiche de nouveau la clé actuelle. Sur l’ordinateur, la clé vit aussi dans les préférences du mod et dans la réponse de la commande, qui fait partie de votre conversation avec Claude. [Les alertes sur votre téléphone et votre montre](/fr/mods/pet/phone-and-watch/) couvre ce côté-là.

### Le modèle de menaces en termes simples

Qui pourrait voir ou faire quoi, d’après le code :

- **ntfy.sh** voit chaque message, l’adresse du téléphone quand il se connecte, et votre sujet dans chaque requête. Sans clé, il voit tout le texte. C’est un service tiers.
- **Quiconque connaît votre sujet, sans clé de votre côté,** lit chaque alerte et chaque état : noms des conversations, une partie des réponses de Claude, votre niveau.
- **La même personne, avec une clé de votre côté,** voit qu’un message est passé et quand, sa priorité (donc si Claude a besoin de vous), ses étiquettes, l’adresse de l’image (donc l’étape de Narsil et la pose de l’alerte), le bouton et le titre `Narsil`. Pas le texte.
- **Falsifier un message scellé** sans la clé échoue à la vérification du tag, et l’application affiche le texte 🔒.
- **Falsifier un message en clair** fonctionne, avec ou sans clé, comme on l’a vu plus haut. Ce qu’il peut faire est limité par l’application : le texte entre comme texte, une image seulement depuis le dossier propre de Narsil, un toucher seulement vers `claude.ai`. Ses deux boutons, en revanche, peuvent porter n’importe quelle adresse, qui s’ouvre dans une autre application si vous la touchez. Un état en clair falsifié peut afficher un mauvais niveau, et un `at` très loin dans le futur empêcherait les vrais états de le remplacer jusqu’à ce que vous changiez de sujet ou effaciez les données de l’application.
- **La page** ne reçoit jamais le sujet ni la clé ; seulement l’état ouvert ([guide 2](/fr/android/webview-host/)).
- **Quelqu’un qui a votre téléphone déverrouillé** peut ouvrir les réglages et lire le sujet (le champ de la clé est masqué, pas caché à une personne déterminée), et la notification discrète montre le sujet dans le volet.
- **Un ordinateur avec le débogage USB autorisé sur votre téléphone** peut faire plus avec une version de débogage, qui est ce qu’installe `./gradlew installDebug`. Android le laisse lire les fichiers privés d’une application débogable (avec `adb shell run-as`), la clé parmi eux, et inspecter la page Claude depuis `chrome://inspect`. Désactivez le débogage USB quand vous ne l’utilisez pas.

Rien de tout cela ne protège votre compte Claude lui-même : c’est votre cookie de session, gardé par la WebView dans le même dossier privé, et aussi sûr que le téléphone.

## Le construire avec Claude

Demandez à Claude de porter en Kotlin le côté ouverture du schéma du mod, et de le prouver avec un vecteur produit par le propre code du mod. La seule idée qu’il doit bien saisir, c’est l’ordre : vérifier d’abord le tag, avec une comparaison en temps constant, et seulement ensuite déchiffrer ; et un échec, de quelque nature qu’il soit, doit donner un seul résultat clair « impossible à ouvrir », jamais un texte partiel.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Porte la moitié `unseal` de ce schéma TypeScript vers un `object` Kotlin sans dépendances Android (colle `hooks/seal.ts` de narsil-pet ci-dessous). Utilise `javax.crypto.Mac` avec `HmacSHA256`, `ByteBuffer` pour le compteur de 4 octets en big-endian, et `MessageDigest.isEqual` pour le tag. Décode le base64url avec ou sans remplissage, et traite comme une mauvaise clé tout ce qui ne se décode pas, fait moins de 48 octets ou a une clé vide. Vérifie le tag avant de déchiffrer. Ajoute une fonction qui prend un message ntfy sous forme de `JSONObject` et, si son `message` commence par `narsil1:`, remplace `title` et `message` par ceux de l’intérieur, ou vide `message` et met `sealed: true` quand elle ne peut pas l’ouvrir. Écris des tests JUnit avec un vecteur que je produirai en lançant le `seal` TypeScript avec un nonce fixe, plus une mauvaise clé, une clé nulle, une clé vide et un message en clair.

### Ce qu’il faut vérifier dans la réponse de Claude

1. Le tag est calculé sur le nonce et le texte chiffré, et comparé avant tout déchiffrement.
2. La comparaison est `MessageDigest.isEqual`, pas `contentEquals` ni une boucle qui s’arrête tôt.
3. Le compteur fait quatre octets, en big-endian, et commence à 0.
4. Deux clés sont dérivées avec HMAC de `"enc"` et de `"mac"` ; la clé partagée n’est jamais utilisée directement.
5. Chaque échec aboutit à un seul résultat, `sealed: true` avec un message vide.
6. Un test utilise un vecteur scellé par le code TypeScript, et pas seulement un aller-retour par le code Kotlin lui-même : un aller-retour passe même quand les deux moitiés partagent la même erreur.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « le vecteur du mod s’ouvre en charabia après les 32 premiers caractères », ce qui désigne le compteur.

### Comment l’auteur l’a demandé

Les mots de l’auteur ou de l’autrice consignés dans `odd/tasks/android-app.md` posent le cadre de ce guide. L2 (2026-11-24) dit « el repositorio seria publico » (le dépôt serait public), dont la spécification S4 tire la règle citée plus haut : aucun sujet ni clé dans le code. La spécification S5, celle de l’agent, liste « sealed messages opened with the key (`narsil1:`) » (les messages scellés ouverts avec la clé) parmi les règles que gardent les alertes. T1 consigne la première tâche : « Gradle project and `Seal` port, tested against vectors from [the earlier extension]'s seal.js » (projet Gradle et portage de `Seal`, testé avec des vecteurs du seal.js de [l’ancienne extension] ; son nom est omis ici).

Le journal consigne la vérification avec le vrai sujet et la vraie clé, le 2026-11-24 à 00:44 : « the mod's alert and state, sealed with the new key, opened in the app. » (l’alerte et l’état du mod, scellés avec la nouvelle clé, se sont ouverts dans l’application).

Les commits (un nom de projet dans un sujet de commit est remplacé par une description entre crochets) :

- `9051a31` (2026-11-24) « feat: open what the mod seals, as [the earlier extension]'s seal.js does » (ouvrir ce que le mod scelle, comme le fait le seal.js de [l’ancienne extension]). Son message : « Gradle project for the Android app, with the sealing port tested against a vector sealed by the extension's own code. » (projet Gradle pour l’application Android, avec le portage du scellement testé face à un vecteur scellé par le propre code de l’extension).
- `53c55c1` (2026-11-24) « feat: host claude.ai with [the earlier extension] in a WebView, and show Narsil's alerts from a foreground service » (héberger claude.ai avec [l’ancienne extension] dans une WebView, et afficher les alertes de Narsil depuis un service de premier plan). Son message : « Settings keep the topic and key on the phone. » (les réglages gardent le sujet et la clé sur le téléphone).
- `9e514dd` (2026-11-24) « feat: open the settings from Narsil in the band and from the service's notification » (ouvrir les réglages depuis Narsil dans la bande et depuis la notification du service).
- `a275382` (2026-11-24) « docs: log the alerts and the band verified with the real topic and key » (consigner les alertes et la bande vérifiées avec le vrai sujet et la vraie clé).

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide (MIT). Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

Un sceau en Kotlin réservé aux tests, qui suit `hooks/seal.ts`, et deux tests face au `Seal` de l’application. Il utilise la clé clairement factice `example-key-not-real`, qui se décode en base64url en 15 octets ; HMAC accepte une clé de n’importe quelle longueur. Rappelez-vous l’avertissement de la dernière vérification plus haut : ces tests repèrent un octet modifié et un compteur cassé côté Kotlin, mais ils ne remplacent pas le vecteur issu du propre code du mod qu’utilise `SealTest.kt`.

```kotlin
package io.github.davshn.narsil

import java.nio.ByteBuffer
import java.util.Base64
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class SealRoundTripTest {
    private val key = "example-key-not-real"

    private fun hmac(key: ByteArray, data: ByteArray): ByteArray =
        Mac.getInstance("HmacSHA256").run {
            init(SecretKeySpec(key, "HmacSHA256"))
            doFinal(data)
        }

    private fun seal(text: String, nonce: ByteArray): String {
        val shared = Base64.getUrlDecoder().decode(key)
        val encKey = hmac(shared, "enc".toByteArray())
        val macKey = hmac(shared, "mac".toByteArray())
        val plain = text.toByteArray(Charsets.UTF_8)
        val cipher = ByteArray(plain.size)
        var block = 0
        while (block * 32 < plain.size) {
            val stream = hmac(encKey, ByteBuffer.allocate(20).put(nonce).putInt(block).array())
            for (j in 0 until 32) {
                val i = block * 32 + j
                if (i < plain.size) cipher[i] = (plain[i].toInt() xor stream[j].toInt()).toByte()
            }
            block++
        }
        val tag = hmac(macKey, nonce + cipher)
        return "narsil1:" + Base64.getUrlEncoder().withoutPadding().encodeToString(nonce + cipher + tag)
    }

    @Test
    fun aLongTextOpensAcrossBlocks() {
        val text = "{\"title\":\"Narsil\",\"message\":\"" + "ñ".repeat(40) + "\"}"
        assertEquals(text, Seal.open(key, seal(text, ByteArray(16) { 7 })))
    }

    @Test
    fun oneChangedByteIsRefused() {
        val sealed = seal("{\"message\":\"hola\"}", ByteArray(16))
        val bytes = Base64.getUrlDecoder().decode(sealed.removePrefix("narsil1:"))
        bytes[20] = (bytes[20].toInt() xor 1).toByte()
        val changed = "narsil1:" + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
        assertThrows(IllegalArgumentException::class.java) { Seal.open(key, changed) }
    }
}
```

`"ñ".repeat(40)` fait 80 octets en UTF-8, si bien qu’avec le JSON autour, le texte s’étend sur quatre blocs de 32. L’octet 20 se trouve dans le texte chiffré, juste après le nonce de 16 octets. Les nonces fixes ne servent qu’au test ; le mod tire un nonce aléatoire neuf pour chaque message, et tout ce que vous construisez qui scelle doit faire de même.

## Erreurs fréquentes et comment tester

- **Déchiffrer avant de vérifier le tag.** Un message modifié produirait un charabia que vous pourriez afficher. Vérifiez d’abord, puis déchiffrez.
- **Comparer les tags avec une boucle qui s’arrête tôt.** Elle révèle, par son temps d’exécution, combien d’octets correspondaient. Utilisez une comparaison en temps constant.
- **Un compteur dans le mauvais ordre d’octets.** Les 32 premiers octets s’ouvrent, le reste est du charabia. Quatre octets, big-endian.
- **Ne tester que des allers-retours.** Sceller et ouvrir dans le même code s’accordent même quand les deux sont faux. Testez face à un vecteur venu de l’autre côté.
- **Attendre de la clé qu’elle bloque les messages en clair.** Dans cette application, ce n’est pas le cas. Si vous construisez la vôtre, décidez si un récepteur qui a une clé doit refuser les messages non scellés.
- **Oublier de coller la nouvelle clé.** Chaque `/narsil movil clave` en crée une nouvelle. Les alertes affichent le texte 🔒 tant que vous ne l’avez pas collée.
- **Partager une capture d’écran des réglages ou du volet.** Le sujet est dans les deux.
- **Garder la clé dans le dépôt.** Le dépôt de l’application est public exprès ; les sujets et les clés ont leur place dans les réglages.

Pour le tester, lancez `./gradlew testDebugUnitTest` : `SealTest.kt` ouvre le vecteur du mod, refuse une autre clé, distingue le texte scellé du texte en clair, remet le titre et le texte en place, laisse tranquilles les messages en clair, et marque ce qu’une clé fausse, nulle ou vide ne peut pas ouvrir. Sur le téléphone, avec un sujet inventé dans les réglages et le champ de la clé réglé sur `example-key-not-real`, publiez depuis l’ordinateur une alerte qui a l’air scellée mais ne l’est pas :

```bash
curl -H "Title: Narsil" -d "narsil1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" https://ntfy.sh/narsil-0000000000example0
```

La notification devrait dire « 🔒 Aviso cifrado: pon la clave en los ajustes de la app. », puisque son tag ne peut pas correspondre. Publiez ensuite `-d "Hola"` sur le même sujet : elle s’affiche telle quelle, avec ou sans clé.

### Là où le code et le README diffèrent

- Le README dit qu’avec la clé, « Anyone reading the topic only sees "Narsil" and unreadable text. » (quiconque lit le sujet ne voit que « Narsil » et un texte illisible). Le `sealedMessage` du mod garde en clair la priorité, les étiquettes, l’adresse de l’image et le bouton, si bien qu’un lecteur voit aussi le type d’alerte et l’étape de Narsil.
- Le README dit que si la clé n’est pas celle qui a scellé un état, la bande affiche « 🔒 Toca y pon la clave ». Le bloc ne le fait que quand il n’a pas d’état antérieur pour le sujet, comme expliqué plus haut.
- Le README ne mentionne pas que les messages non scellés sont acceptés pendant qu’une clé est réglée. Le code les accepte.

## Pour aller plus loin

- Le [guide 6](/fr/android/alerts-service/) montre où `unseal` se place dans le chemin d’une alerte, et le bouton d’arrière-plan des réglages.
- Le [guide 4](/fr/android/sidebar/) montre l’avis du cadenas dans le bloc du menu latéral, et pourquoi il peut rester caché.
- Côté mod, [Les alertes sur votre téléphone et votre montre](/fr/mods/pet/phone-and-watch/) explique le scellement pas à pas et où vit la clé sur votre ordinateur.
- [Narsil Watch](/fr/watch/what-it-is/) lit le même sujet `-estado`.
- Le code source est sur [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
