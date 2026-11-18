---
title: Secrets et vie privée
description: 'Chaque secret que détient le bot et où il vit, ce que protègent la NVS et le chiffrement de la flash, ce qui quitte votre réseau et vers qui, et comment effacer le bot et révoquer chaque identifiant.'
route: bot
order: 12
updated: 2026-11-18
---

## Ce que ça fait

Le bot est un micro posé sur votre bureau avec votre token GitHub à l’intérieur : il mérite donc un guide qui rassemble toute la situation au même endroit. Celui-ci répond à trois questions :

- **Quels secrets le bot détient-il, et où ?** Sept, sur deux machines, et aucun dans le dépôt.
- **Qu’est-ce qui quitte votre réseau ?** Votre voix part chez une entreprise, vos mots chez une autre, les réponses de Narsil chez une troisième, et deux services voient le ventre se connecter.
- **Comment tout reprendre ?** Comment effacer le ventre, et comment révoquer chaque identifiant à sa source.

Rien ici n’est du code nouveau. Ce guide rassemble ce que les guides 3 à 11 ont mis en place, et ajoute les options qu’offre ESP-IDF pour protéger ce qui est stocké sur la carte.

## Comment ça marche à l’intérieur

### Les secrets, et où vit chacun d’eux

| Secret                       | Vit dans                                                         | Défini par                      | Donne accès à                               |
| ---------------------------- | ---------------------------------------------------------------- | ------------------------------- | ------------------------------------------- |
| Nom et mot de passe du Wi-Fi | NVS du ventre, espace de noms `wifi`, clés `ssid` et `password`  | Portail Wi-Fi (guide 3)         | Votre réseau domestique                     |
| URL OTA (adresse du serveur) | NVS du ventre, `wifi/ota_url`                                    | Portail Wi-Fi, onglet Advanced  | L’endroit où le ventre envoie votre voix    |
| URL et token WebSocket       | NVS du ventre, espace de noms `websocket`, clés `url` et `token` | La réponse OTA de votre serveur | Parler à votre serveur                      |
| Topic ntfy                   | NVS du ventre, espace de noms `narsil`, clé `ntfy_topic`         | Écran de réglages (guide 9)     | Lire (et écrire) les alertes de Narsil      |
| Token GitHub                 | NVS du ventre, espace de noms `narsil`, clé `gh_token`           | Écran de réglages (guide 9)     | Lire les pull requests que vous pouvez voir |
| Clé d’API Anthropic          | Votre PC : `ANTHROPIC_API_KEY` ou `data/.config.yaml`            | Vous (guide 5)                  | Dépenser sur votre compte Anthropic         |
| Clé d’API OpenAI             | Votre PC : `data/.config.yaml`, bloc `OpenaiASR`                 | Vous (guide 4)                  | Dépenser sur votre compte OpenAI            |

Les espaces de noms viennent du code : le `ssid_manager.cc` d’esp-wifi-connect ouvre `"wifi"` et lit `ssid`, `password` et leurs copies numérotées (jusqu’à dix réseaux) ; le `main/ota.cc` de Xiaozhi enregistre les réglages WebSocket avec `Settings settings("websocket", true)` ; les guides 7 à 9 utilisent `narsil`.

Trois choses méritent d’être remarquées dans ce tableau :

- **Les deux clés d’API, celles qui coûtent de l’argent, ne touchent jamais le bot.** Le ventre ne parle qu’à votre serveur sur le réseau local ; c’est le serveur qui détient les clés. Un bot volé ne peut pas faire grimper une facture Anthropic ou OpenAI.
- **La tête ne détient rien.** Son firmware contient les dessins de Narsil et le code UART. N’importe qui peut lire sa flash et n’y apprendre rien (le guide 10 explique pourquoi on l’a gardée ainsi).
- **Le dépôt ne contient rien.** Aucun topic, token, clé ni adresse n’apparaît dans `davshn/narsil-bot`. Le firmware est public, et c’est pour cela.

### Pourquoi la NVS, et ce que protège la NVS

La NVS (non-volatile storage, stockage non volatil) est le stockage clé-valeur d’ESP-IDF dans une partition de la flash ; la classe `Settings` de Xiaozhi (`main/settings.h`) en est une fine surcouche. Pour le ventre, la partition s’appelle `nvs` dans les tables de partitions de Xiaozhi (`partitions/v2/32m.csv` lui donne 840 Ko).

Par défaut, la NVS **n’est pas chiffrée**. Le `CONFIG_NVS_ENCRYPTION` d’ESP-IDF n’est activé par défaut que lorsque le chiffrement de la flash l’est, et Xiaozhi ne l’active pas. Ainsi, n’importe qui ayant la carte en main et un câble USB peut lire la flash avec esptool et y trouver en clair le mot de passe du Wi-Fi, le topic et le token. Pour un bot posé sur votre propre bureau, c’est un risque acceptable pour la plupart des gens, à condition de le savoir et de savoir comment révoquer les choses (ci-dessous). Si le bot voyage, se trouve dans un bureau partagé ou quitte vos mains, les options ci-dessous existent.

### Le chiffrement de la NVS sur l’ESP32-P4

La [page sur le chiffrement de la NVS](https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/api-reference/storage/nvs_encryption.html) d’ESP-IDF décrit deux schémas pour cette puce. Tous deux utilisent XTS-AES, et l’aide de Kconfig dit qu’il chiffre « the complete NVS data, except the page headers » (l’ensemble des données de la NVS, sauf les en-têtes de page).

| Schéma                              | Où vivent les clés                                                                          | Demande le chiffrement de la flash | Coût                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------- |
| Basé sur le chiffrement de la flash | Une partition `nvs_keys` (data, sous-type `nvs_keys`, marquée `encrypted`, d’au moins 4 Ko) | Oui                                | Tout ce que coûte le chiffrement de la flash (section suivante)        |
| Basé sur le périphérique HMAC       | Dérivées à l’exécution d’une clé HMAC dans l’eFuse ; jamais stockées en flash               | Non                                | Grille définitivement un bloc de clé eFuse, avec la finalité `HMAC_UP` |

Les options sont `CONFIG_NVS_ENCRYPTION`, et `CONFIG_NVS_SEC_KEY_PROTECTION_SCHEME` pour choisir entre `CONFIG_NVS_SEC_KEY_PROTECT_USING_FLASH_ENC` et `CONFIG_NVS_SEC_KEY_PROTECT_USING_HMAC`. Pour HMAC, `CONFIG_NVS_SEC_HMAC_EFUSE_KEY_ID` doit désigner le bloc eFuse (de 0 à 5 ; la valeur par défaut, -1, ne compile pas). Avec le chiffrement activé, `nvs_flash_init()` prépare la partition par défaut chiffrée et génère ses clés : le code de Xiaozhi ne change donc pas.

Le schéma HMAC est le plus léger : la page dit qu’il permet un « secure storage on ESP32-P4 without enabling flash encryption » (stockage sécurisé sur l’ESP32-P4 sans activer le chiffrement de la flash). Il protège contre quelqu’un qui lit la puce de flash. Il n’empêche pas, à lui seul, quelqu’un qui peut flasher un nouveau firmware sur la carte d’exécuter du code qui utilise la même clé eFuse ; c’est le rôle du démarrage sécurisé (secure boot).

### Le chiffrement de la flash, et ses compromis

Le [chiffrement de la flash](https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/security/flash-encryption.html) chiffre le firmware et les données en flash, si bien que « physical readout of flash will not be sufficient to recover most flash contents » (la lecture physique de la flash ne suffira pas à récupérer la plupart de son contenu). Il s’active avec `CONFIG_SECURE_FLASH_ENC_ENABLED` et existe en deux modes :

- **Le mode Development** (par défaut) permet encore de flasher un nouveau firmware en clair par USB ; le bootloader le chiffre. Il peut être désactivé à nouveau, mais une seule fois par puce.
- **Le mode Release** empêche le bootloader USB d’effectuer des opérations de chiffrement de la flash ; un nouveau firmware n’arrive plus que par OTA. Choisir Release dans menuconfig ne grille pas les eFuses à lui seul ; c’est `esp_flash_encryption_set_release_mode()` qui le fait.

La même page est claire sur ses limites : le chiffrement de la flash « alone may not prevent an attacker from modifying the firmware of the device » (ne peut pas, à lui seul, empêcher un attaquant de modifier le firmware de l’appareil), il ne cache pas l’organisation de la flash, et elle recommande le démarrage sécurisé en complément. Et il change votre façon de travailler : une image en clair flashée par erreur sur une carte chiffrée la bloque logiciellement dans une boucle de redémarrages. Pour un bot de loisir reflashé chaque soir, c’est un vrai coût.

Le bot n’est livré avec ni l’un ni l’autre. Il garde hors de la carte les secrets qui comptent le plus (les clés d’API), utilise un token GitHub en lecture seule et qui expire, et traite le contenu de la carte comme révocable. Chiffrer la NVS avec HMAC est l’étape à franchir si la carte quitte votre bureau.

### Ce qui quitte votre réseau

| Quoi                                                       | Va chez                         | Pourquoi                                     |
| ---------------------------------------------------------- | ------------------------------- | -------------------------------------------- |
| Votre voix, sous forme audio                               | OpenAI (`api.openai.com`)       | `OpenaiASR` la transforme en texte (guide 4) |
| Ce que vous avez dit, sous forme de texte, et l’historique | Anthropic (`api.anthropic.com`) | Claude écrit la réponse de Narsil (guide 5)  |
| Les réponses de Narsil, sous forme de texte                | Microsoft                       | `EdgeTTS` les transforme en parole (guide 6) |
| Un abonnement à vos topics ntfy                            | ntfy.sh                         | Les alertes de Narsil (guide 7)              |
| Votre token GitHub et une requête de recherche             | GitHub (`api.github.com`)       | Vos pull requests (guide 8)                  |

Soyons précis sur la voix. Le mot d’activation est reconnu sur le ventre lui-même, avec ESP-SR : rien n’est donc envoyé avant que vous ne disiez « Hi ESP ». Ensuite, le ventre envoie en continu ce qu’entendent les micros à votre serveur, sur le réseau local. Le serveur ne garde pas cet audio à la maison : avec `OpenaiASR`, chaque chose que vous dites est envoyée **sous forme audio** au point de terminaison de transcription d’OpenAI (`base_url: https://api.openai.com/v1/audio/transcriptions` dans `config.yaml`), et le texte revient. Le guide 4 indique l’alternative hors ligne : `VoskASR`, qui tourne sur le PC avec un modèle téléchargé, garde l’audio sur votre réseau, au prix d’une certaine précision.

Chaque fournisseur traite ces données selon ses propres conditions d’utilisation de l’API ; lisez [celles d’Anthropic](https://www.anthropic.com/legal/commercial-terms) et celles d’OpenAI avant de décider. EdgeTTS ne demande aucun compte, ce qui signifie aussi qu’aucun accord de votre part ne couvre ce qu’il reçoit.

ntfy.sh voit l’adresse IP du ventre et le nom des topics qu’il suit. Sans clé, il voit aussi le texte de chaque alerte ; avec `/narsil movil clave`, il ne voit que le type, l’heure et le stade (guide 7). GitHub voit le token, la requête et la réponse, en HTTPS.

### Ce qui reste sur votre réseau

- L’audio entre le ventre et votre serveur, en WebSocket sur le réseau local. C’est du `ws://` simple, pas du TLS : il est donc aussi privé que votre réseau. Gardez le bot sur votre Wi-Fi domestique, pas sur un réseau partagé.
- L’UART entre le ventre et la tête, trois fils à l’intérieur du bot.
- La vérification OTA, qui va à l’adresse de votre serveur. Un détail compte ici : si l’URL OTA enregistrée n’est pas valide, Xiaozhi se rabat sur `CONFIG_OTA_URL`, le service officiel sur `api.tenclass.net` (guide 3). Le moniteur affiche « Ignoring invalid saved OTA URL; using the default » quand cela arrive ; si vous le voyez, corrigez l’URL.

### Effacer le bot

Trois niveaux, du plus léger au complet :

- **Seulement les secrets de Narsil.** Un bouton « Forget » sur l’écran de réglages du guide 9, qui appelle `Settings("narsil", true).EraseAll()`, efface le topic et le token, et rien d’autre.
- **Tout ce qui est sur le ventre.** Depuis Windows, avec le ventre sur son port USB (guide 2) :

  ```powershell
  esptool --port COM5 erase-flash
  ```

  Cela efface toute la flash : firmware, NVS, mot de passe du Wi-Fi, adresse du serveur, topic et token. Flashez ensuite à nouveau le firmware (guide 3) ; le ventre démarre alors en configuration Wi-Fi comme un neuf. L’équivalent depuis ESP-IDF est `idf.py erase-flash`.

- **La tête.** Elle ne détient aucun secret : il n’y a donc rien à effacer. Le même `erase-flash` sur son port supprime le firmware si vous donnez la carte.

### Révoquer chaque identifiant

Effacer la carte protège la carte. Révoquer l’identifiant vous protège, même quand la carte a disparu. Si le bot est perdu ou volé, ou si la flash a été lue, faites tout ce qui suit, en commençant par le token :

| Identifiant           | Comment le révoquer                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Token GitHub          | [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens), **Delete** à côté du token (guide 8).                             |
| Topic ntfy            | `/narsil movil nuevo` dans Claude Code crée un nouveau topic ; l’ancien ne reçoit plus rien. Saisissez le nouveau sur le ventre.                                    |
| Mot de passe du Wi-Fi | Changez-le sur le routeur. Chaque appareil a besoin du nouveau, c’est pourquoi il vient après les autres.                                                           |
| Clé Anthropic         | Supprimez-la dans la [Claude Console](https://platform.claude.com/settings/keys) (guide 5). Elle n’a jamais été sur le bot ; renouvelez-la si le PC était concerné. |
| Clé OpenAI            | Supprimez-la sur la page des clés d’API d’OpenAI. Même règle : elle vit sur le PC.                                                                                  |

## Comment on l’a demandé à l’IA

La règle derrière ce guide vient de la décision sur l’endroit où vit le firmware. L’IA a demandé si le code du bot devait aller dans un dépôt à lui, et l’auteur ou l’autrice a répondu :

> repo propio como fork

Traduction en français : un dépôt à part, sous forme de fork.

L’IA a ensuite demandé si ce dépôt serait public dès le départ ou privé, et l’auteur ou l’autrice a choisi la première option :

> 1

Un dépôt public change tout pour les secrets : tout ce qui est commité est publié. L’IA a donc fixé la règle écrite comme spec S6, selon laquelle le token GitHub, le topic ntfy, la clé et l’adresse du serveur vivent dans la NVS ou dans une configuration locale, jamais dans le dépôt, et chaque guide depuis l’a suivie.

L’endroit où la voix est traitée avait été décidé auparavant, avec la même conséquence pour les clés d’API :

> servidor propio

Traduction en français : un serveur à moi. Et où il tourne :

> en el pc, igual la idea es usarlo para trabajar con claude

Traduction en français : sur le PC, de toute façon l’idée est de l’utiliser pour travailler avec Claude.

C’est pourquoi les clés payantes restent sur le PC. Le choix du système de reconnaissance revenait à l’IA, d’après la documentation du serveur ; elle a choisi `OpenaiASR` parce que le système de reconnaissance hors ligne par défaut ne prend pas en charge l’espagnol, et ce guide est l’endroit où ce choix est expliqué comme de l’audio qui quitte le réseau.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas la conversation qui a servi à construire le bot.

> Mon bot de bureau est un ESP32-P4 qui fait tourner un fork de 78/xiaozhi-esp32, et qui parle à xinnan-tech/xiaozhi-esp32-server sur mon PC avec OpenaiASR, un fournisseur Claude et EdgeTTS, plus ntfy.sh et l’API REST de GitHub depuis la carte. Liste chaque secret qu’il détient et où (lis `main/settings.h`, `main/ota.cc` et le `ssid_manager.cc` d’esp-wifi-connect pour les espaces de noms de la NVS), tout ce qui quitte mon réseau et vers qui, et ce qui reste sur le réseau local. Explique ensuite les schémas de chiffrement de la NVS d’ESP-IDF 6 pour l’ESP32-P4 et le chiffrement de la flash, en citant leur documentation, avec les compromis pour un appareil de loisir que je reflashe souvent. Termine par la façon d’effacer la carte et de révoquer chaque identifiant.

## Le code minimal

Le bot n’a besoin d’aucun nouveau code pour ce guide. La seule pièce facultative est le bouton « Forget », ajouté à l’écran de réglages du guide 9 à côté de « Back » :

```cpp
static void OnForget(lv_event_t*) {
    {
        Settings settings("narsil", true);
        settings.EraseAll();
    }
    esp_restart();
}
```

```cpp
Button(settings_screen, "Forget topic and token", OnForget);
```

`EraseAll` fait partie de la classe `Settings` de Xiaozhi ; elle efface chaque clé de l’espace de noms `narsil`, et le destructeur valide l’effacement avant le redémarrage.

Si vous choisissez de chiffrer la NVS avec le schéma HMAC, le changement relève de la configuration, pas du code. Dans `idf.py menuconfig`, activez `CONFIG_NVS_ENCRYPTION`, choisissez `CONFIG_NVS_SEC_KEY_PROTECT_USING_HMAC`, et réglez `CONFIG_NVS_SEC_HMAC_EFUSE_KEY_ID` sur un bloc eFuse libre. Lisez d’abord la page sur le chiffrement de la NVS : le bloc eFuse est utilisé définitivement, et la NVS écrite avant le changement n’est plus lisible après ; effacez donc la flash et reconfigurez le bot.

## Erreurs fréquentes et comment tester

- **Un secret dans un commit.** Avant chaque push vers le dépôt public, cherchez dans le diff `github_pat_`, `narsil-`, `sk-ant-` et votre adresse sur le réseau local. Un vrai token dans un fichier de test est une fuite ; utilisez des valeurs inventées comme `github_pat_EXAMPLE_not_a_real_token`.
- **Des secrets dans le journal.** N’affichez jamais le token, le topic ou le mot de passe du Wi-Fi, même pendant le débogage : un journal du moniteur collé dans une issue les publie.
- **Un `sdkconfig` avec vos réglages.** Si vous mettez l’adresse du serveur dans `CONFIG_OTA_URL` au lieu du portail, elle finit dans `sdkconfig`, et de là dans un commit. Le guide 3 l’enregistre sur l’appareil pour cette raison.
- **Ne révoquer qu’une seule chose.** Un bot perdu détient le token, le topic et le mot de passe du Wi-Fi. Révoquez les trois.

Pour tester ce que contient la carte, relisez sa NVS et regardez. Avec le ventre sur COM5, `esptool --port COM5 read-flash 0 ALL belly.bin` copie la flash ; cherchez votre topic dans le fichier. Avec une NVS non chiffrée, il s’y trouve en clair ; avec le schéma HMAC, il n’y est pas. Supprimez `belly.bin` ensuite : il contient vos secrets.

Pour tester ce qui quitte le réseau, surveillez le journal de votre serveur (guide 4) pendant que vous parlez : le texte reconnu apparaît après chaque phrase, et c’est le moment où l’audio est parti chez OpenAI. Coupez l’accès à internet du PC et parlez à nouveau : le ventre se connecte toujours au serveur sur le réseau local, mais la reconnaissance échoue, ce qui montre que l’audio n’avait aucun endroit local où aller.

## Pour aller plus loin

- **La reconnaissance hors ligne.** `VoskASR` dans le serveur garde votre voix sur votre réseau ; vérifiez son modèle espagnol et comparez sa précision avec celle d’`OpenaiASR`.
- **Votre propre serveur ntfy.** Faire tourner ntfy à la maison avec un contrôle d’accès retire le topic de l’internet public. narsil-pet publie sur `https://ntfy.sh`, donc les deux côtés devraient changer (guide 7).
- Retour au début du parcours : les pièces et le câblage sont dans le [guide 1](/fr/bot/the-bot/).
