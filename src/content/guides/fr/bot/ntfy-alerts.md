---
title: Les alertes de Narsil depuis ntfy
description: 'Comment le ventre suit le même topic ntfy que les alertes de Narsil sur le téléphone : comment narsil-pet construit le topic et ses messages, ce que cache la clé, et un flux JSON sur ESP-IDF.'
route: bot
order: 7
updated: 2026-11-18
---

## Ce que ça fait

[Narsil for Claude Code](https://github.com/davshn/narsil-pet) prévient déjà votre téléphone quand une conversation a besoin de vous : `/narsil movil` envoie chaque alerte à un topic privé sur [ntfy.sh](https://ntfy.sh), et l’application ntfy l’affiche comme une notification. Le ventre s’abonne au même topic. Quand Claude termine, a une question ou s’arrête sur une erreur, l’alerte apparaît aussi sur l’écran du ventre, avec l’état de Narsil à côté.

Rien ne change côté PC : narsil-pet continue de publier comme il le fait pour le téléphone, et le ventre est un lecteur de plus du topic. Il lit deux topics :

- **Le topic des alertes**, `narsil-` suivi de 20 caractères hexadécimaux : un message par alerte (terminé, question, erreur).
- **Le topic d’état**, le même nom avec `-estado` à la fin : un petit état JSON envoyé à la fin de chaque tour, jamais affiché comme notification.

## Comment ça marche à l’intérieur

### Comment narsil-pet construit le topic

Le nom du topic est fabriqué dans `hooks/phone.ts`. L’extrait suivant est cité de [davshn/narsil-pet](https://github.com/davshn/narsil-pet), sous licence GPL-3.0-or-later :

```ts
// A topic nobody guesses: whoever knows its name can read it.
export function newTopic(uuid: string): string {
  return `narsil-${uuid
    .replace(/[^0-9a-f]/gi, '')
    .toLowerCase()
    .slice(0, 20)}`
}
```

Il prend un UUID aléatoire, garde ses chiffres hexadécimaux en minuscules et utilise les 20 premiers : un exemple inventé est `narsil-0123456789abcdef0123`. Le topic d’état vient du même fichier :

```ts
export function statusTopic(topic: string): string {
  return `${topic}-estado`
}
```

Sur le ntfy.sh public, le nom est la seule protection. La [documentation de configuration de ntfy](https://docs.ntfy.sh/config/) indique que le serveur est ouvert par défaut, et que « everyone can read and write to any topic (this is how ntfy.sh is configured) » (tout le monde peut lire et écrire dans n’importe quel topic ; c’est ainsi que ntfy.sh est configuré). Le commentaire au-dessus de `newTopic` dit la même chose en moins de mots. Traitez le topic comme un mot de passe : il ne va pas dans le dépôt du firmware, et `/narsil movil nuevo` en crée un nouveau s’il fuit.

### Ce que transporte une alerte

`phoneMessage` dans `hooks/phone.ts` construit le JSON que narsil-pet publie sur ntfy.sh. En bref :

- `title` : `Narsil · <title> · <conversation>`, avec le nom de la conversation d’où vient l’alerte.
- `message` : le texte de l’alerte, puis la liste des conversations ouvertes et leurs états, et, sur la dernière alerte du jour, une note indiquant que c’est la dernière (narsil-pet en envoie au plus 200 par jour, sous les 250 gratuites de ntfy.sh).
- `priority` : 3 pour `done`, 4 pour `question` et `error`.
- `tags` : une étiquette qui nomme le type : `white_check_mark` (terminé), `raising_hand` (question) ou `warning` (erreur).
- `icon` : le dessin de Narsil à son stade actuel, dans la pose de l’alerte.

Le ventre peut donc reconnaître le type d’alerte à sa seule étiquette, et il connaît l’heure grâce au champ `time` propre à ntfy.

### Ce que transporte l’état

Le message `-estado` est un objet JSON placé dans le champ `message` du message ntfy, envoyé avec la priorité 1. Le README de narsil-pet documente ses champs : `xp` (le niveau et l’expérience de Narsil), `art` (l’URL de son dessin à son stade, dans la pose de la conversation la plus importante), `at` (le moment de l’envoi, en secondes Unix), `cacheMinutes` (la durée d’un cache, quand il y en a un) et `usage` (le compte ntfy du jour). Le ventre affiche `xp` avec l’heure propre à ntfy pour le message, et lit la pose et le stade dans `art` pour les transmettre à la tête ([guides 10](/fr/bot/uart-protocol/) et [11](/fr/bot/holographic-head/)).

### Ce que cache la clé, et ce qu’elle ne cache pas

`/narsil movil clave` scelle ce qu’envoie narsil-pet, avec une clé que seuls vos appareils détiennent (`hooks/seal.ts`, HMAC-SHA256 en mode compteur avec une étiquette encrypt-then-MAC). Soyez précis sur ce que cela couvre. Voici `sealedMessage` de `hooks/phone.ts`, cité de [davshn/narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later) :

```ts
export function sealedMessage<M extends { title?: string; message: string }>(
  m: M,
  sealed: string,
): M {
  return { ...m, ...(m.title ? { title: 'Narsil' } : {}), message: sealed }
}
```

Seuls `title` et `message` changent : le titre devient « Narsil », et le texte devient une chaîne scellée qui commence par `narsil1:`. Tout le reste est copié tel quel. Avec une clé, quiconque connaît le topic voit encore :

- le **type** d’alerte, d’après `tags` et `priority` ;
- **quand** elle a été envoyée, d’après le `time` de ntfy ;
- le **stade** et la pose de Narsil, d’après l’URL de `icon`.

Le message d’état n’a pas de titre : tout son JSON est donc scellé et seule sa priorité est visible.

Sur le ventre, cela donne deux modes. Sans clé, il affiche tout. Avec une clé, il affiche le type, l’heure et le stade, et « Narsil » comme titre ; lire le texte demande la clé sur le ventre, ce qui se trouve dans « Pour aller plus loin ».

### S’abonner depuis le ventre

L’[API d’abonnement](https://docs.ntfy.sh/subscribe/api/) de ntfy propose un flux JSON : un long `GET` vers `https://ntfy.sh/<topic>/json` qui ne se termine jamais, et qui « returns a JSON stream, with one JSON message object per line » (renvoie un flux JSON, avec un objet message JSON par ligne). Plusieurs topics tiennent dans une seule connexion, séparés par des virgules ; le ventre ouvre donc un seul flux pour les deux :

```text
https://ntfy.sh/narsil-0123456789abcdef0123,narsil-0123456789abcdef0123-estado/json
```

Chaque ligne est un événement. Le champ `event` dit lequel : `open` quand le flux démarre, `keepalive` de temps en temps pour que la connexion ne semble pas morte, et `message` pour le contenu réel. Un événement `message` a, entre autres, `id`, `time`, `topic`, `title`, `message`, `tags` et `priority`.

Sur ESP-IDF, le flux se lit avec [`esp_http_client`](https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/api-reference/protocols/esp_http_client.html) dans son ordre de streaming : `esp_http_client_open`, `esp_http_client_fetch_headers`, puis `esp_http_client_read` en boucle, en découpant les octets en lignes à chaque `\n`. HTTPS utilise le [bundle de certificats](https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/api-reference/protocols/esp_crt_bundle.html) d’ESP-IDF (`crt_bundle_attach = esp_crt_bundle_attach`), si bien qu’aucun certificat n’est collé dans le code. Chaque ligne est analysée avec cJSON, que Xiaozhi utilise déjà pour son propre protocole.

### Ne pas perdre d’alertes à la reconnexion

Le Wi-Fi décroche, et les longues connexions se rompent. ntfy garde les messages un certain temps (le `cache-duration` du serveur vaut 12 heures par défaut), et le paramètre `since=` demande ce que vous avez manqué : une durée comme `10m`, une heure Unix ou un ID de message. Le ventre retient l’`id` du dernier message qu’il a affiché et se reconnecte avec `since=<cet id>` ; il reçoit ainsi exactement les alertes envoyées pendant son absence, et aucune deux fois. Au démarrage à froid, il n’a pas d’ID et demande `since=10m`.

### Où vit le topic

Le topic est stocké dans la NVS du ventre, via la classe `Settings` de Xiaozhi (`main/settings.h`), dans l’espace de noms `narsil` sous la clé `ntfy_topic`. Vous le saisissez une seule fois sur l’écran de réglages du ventre, que construit le [guide 9](/fr/bot/belly-ui/) ; il n’apparaît jamais dans le code source. Le [guide 12](/fr/bot/secrets-privacy/) explique pourquoi la NVS n’est pas chiffrée par défaut et ce que cela signifie pour un appareil posé sur votre bureau.

## Comment on l’a demandé à l’IA

Le rôle du ventre figurait dans la première description du bot par l’auteur ou l’autrice :

> va a ser la pantalla grande para una pantalla en la pansa que va a tener la informacion de las tareas que hace narsil

Traduction en français : ce sera le grand écran, pour un écran dans le ventre qui aura les informations sur les tâches que fait Narsil.

Narsil publie déjà ces tâches sur ntfy pour le téléphone ; l’IA a donc proposé de lire ce même topic au lieu d’inventer un nouveau canal depuis le PC. Elle a ensuite demandé si la tête se connecterait au réseau par elle-même ou recevrait tout du ventre, et la réponse a été :

> Por cable desde la panza

Traduction en français : par câble depuis le ventre.

Le ventre est donc la seule carte sur le réseau pour les alertes : il s’abonne à ntfy, et la tête ne reçoit que la pose et l’état par le fil ([guide 10](/fr/bot/uart-protocol/)). La façon de se reconnecter, et ce qu’il faut afficher quand une clé est définie, n’ont pas fait l’objet de questions ; l’IA les a tirées de la documentation de ntfy et du `sealedMessage` de narsil-pet.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas la conversation qui a servi à construire le bot.

> Mon ESP32-P4 fait tourner Xiaozhi (ESP-IDF 6). Ajoute une tâche FreeRTOS qui s’abonne à deux topics ntfy.sh dans un seul flux JSON (`https://ntfy.sh/<a>,<b>/json`), le lit avec `esp_http_client_open`, `esp_http_client_fetch_headers` et `esp_http_client_read`, le découpe en lignes, analyse chacune avec cJSON et passe les événements `message` à une fonction de rappel. Utilise le bundle de certificats, lis le topic dans la NVS avec la classe `Settings` de Xiaozhi, garde l’ID du dernier message et reconnecte-toi avec `since=` après une erreur. Cite la documentation de ntfy pour le format du flux et le paramètre `since`.

## Le code minimal

Une tâche pour le ventre, en C++ à côté du code de Xiaozhi (MIT, comme les exemples propres au site). `ShowAlert` et `ShowStatus` sont les fonctions de l’écran du [guide 9](/fr/bot/belly-ui/) :

```cpp
#include <cJSON.h>
#include <esp_crt_bundle.h>
#include <esp_http_client.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <string>

#include "settings.h"

void ShowAlert(const char* title, const char* text, const char* tag, long time);
void ShowStatus(const char* state_json, long time);

static std::string last_id;

static void HandleLine(const std::string& line, const std::string& status_topic) {
    cJSON* root = cJSON_Parse(line.c_str());
    if (root == nullptr) return;
    const char* event = cJSON_GetStringValue(cJSON_GetObjectItem(root, "event"));
    if (event != nullptr && std::string(event) == "message") {
        const char* id = cJSON_GetStringValue(cJSON_GetObjectItem(root, "id"));
        const char* topic = cJSON_GetStringValue(cJSON_GetObjectItem(root, "topic"));
        const char* title = cJSON_GetStringValue(cJSON_GetObjectItem(root, "title"));
        const char* text = cJSON_GetStringValue(cJSON_GetObjectItem(root, "message"));
        cJSON* tags = cJSON_GetObjectItem(root, "tags");
        const char* tag = cJSON_GetStringValue(cJSON_GetArrayItem(tags, 0));
        long time = (long)cJSON_GetNumberValue(cJSON_GetObjectItem(root, "time"));
        if (id != nullptr) last_id = id;
        if (topic != nullptr && status_topic == topic) {
            ShowStatus(text ? text : "", time);
        } else {
            ShowAlert(title ? title : "Narsil", text ? text : "", tag ? tag : "", time);
        }
    }
    cJSON_Delete(root);
}

static void NtfyTask(void*) {
    Settings settings("narsil");
    std::string topic = settings.GetString("ntfy_topic");
    if (topic.empty()) vTaskDelete(nullptr);
    std::string status_topic = topic + "-estado";

    while (true) {
        std::string url = "https://ntfy.sh/" + topic + "," + status_topic + "/json?since=" +
                          (last_id.empty() ? "10m" : last_id);
        esp_http_client_config_t config = {};
        config.url = url.c_str();
        config.crt_bundle_attach = esp_crt_bundle_attach;
        config.timeout_ms = 120000;
        esp_http_client_handle_t client = esp_http_client_init(&config);

        if (esp_http_client_open(client, 0) == ESP_OK && esp_http_client_fetch_headers(client) >= 0) {
            std::string line;
            char buffer[512];
            int read;
            while ((read = esp_http_client_read(client, buffer, sizeof(buffer))) > 0) {
                for (int i = 0; i < read; i++) {
                    if (buffer[i] != '\n') { line += buffer[i]; continue; }
                    HandleLine(line, status_topic);
                    line.clear();
                }
            }
        }
        esp_http_client_close(client);
        esp_http_client_cleanup(client);
        vTaskDelay(pdMS_TO_TICKS(5000));
    }
}

void StartNtfy() {
    xTaskCreate(NtfyTask, "ntfy", 8192, nullptr, 3, nullptr);
}
```

Appelez `StartNtfy()` une fois le Wi-Fi connecté. `ShowAlert` reçoit l’étiquette, si bien que l’écran peut choisir la bonne pose et la bonne couleur même quand le texte est scellé. Le délai de lecture de deux minutes dépasse largement l’intervalle entre les événements keepalive de ntfy, si bien qu’un topic silencieux ne compte pas comme une connexion morte.

## Erreurs fréquentes et comment tester

- **Un flux qui se termine après les premières lignes.** `poll=1` renvoie le cache et ferme la connexion ; l’URL du bot ne doit pas l’inclure.
- **Tout le cache à chaque reconnexion.** Sans `since=`, une reconnexion n’apporte rien d’ancien ; avec `since=all`, elle apporte tout à nouveau. Utilisez le dernier `id`.
- **Un topic avec une majuscule ou une faute de frappe.** ntfy le traite comme un autre topic, vide. Copiez-le depuis `/narsil movil`, qui affiche le nom.
- **Du texte scellé à l’écran.** Un message qui commence par `narsil1:` a été scellé par `/narsil movil clave`. Affichez « Narsil » et le type d’après l’étiquette, ou ajoutez la clé (Pour aller plus loin).
- **Aucune alerte pendant que vous êtes devant le PC.** narsil-pet n’envoie que lorsque votre dernier message est venu de Remote Control (son README explique pourquoi). `/narsil movil prueba` envoie une alerte de test depuis n’importe où.
- **Le topic dans le dépôt.** Il va dans la NVS via l’écran de réglages, jamais dans un fichier source ni dans une valeur par défaut.

Pour tester sans le ventre, suivez le flux depuis un terminal sur le PC avec l’exemple de la documentation de ntfy elle-même, en utilisant votre topic :

```powershell
curl.exe -s "https://ntfy.sh/narsil-0123456789abcdef0123/json"
```

Lancez `/narsil movil prueba` dans Claude Code : une ligne `message` apparaît. Faites ensuite de même avec le ventre allumé : l’alerte s’affiche sur son écran, et le moniteur série (guide 2) montre la connexion à ntfy.sh. Coupez le Wi-Fi du routeur pendant une minute, envoyez un autre test, rallumez-le : le ventre se reconnecte avec `since=` et affiche l’alerte qu’il a manquée.

## Pour aller plus loin

- **Lire les alertes scellées.** `hooks/seal.ts` dérive deux clés de la vôtre avec HMAC-SHA256 (`enc` et `mac`), applique un XOR entre le texte et un flux de clé HMAC par blocs de 32 octets, et vérifie une étiquette sur le nonce et le texte chiffré. mbedTLS, qui fait partie d’ESP-IDF, a HMAC-SHA256 ; porter `unseal` permet au ventre de lire le texte pendant que le topic ne montre que du bruit.
- **Votre propre serveur ntfy.** ntfy peut tourner chez vous avec un contrôle d’accès, si bien que le topic n’est pas public. narsil-pet publie sur `https://ntfy.sh`, il faudrait donc changer les deux côtés.
- **L’état pour la tête.** Le message `-estado` est ce qui pilote la pose de Narsil sur la tête ; le [guide 10](/fr/bot/uart-protocol/) l’envoie par l’UART.
- Le guide 8 ajoute l’autre liste qu’affiche le ventre : les pull requests qui ont besoin de vous. L’écran lui-même est le [guide 9](/fr/bot/belly-ui/).
