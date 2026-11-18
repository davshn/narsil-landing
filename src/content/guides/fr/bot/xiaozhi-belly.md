---
title: Xiaozhi dans le ventre
description: 'Ce qu’est Xiaozhi, comment il tourne sur la carte Waveshare ESP32-P4, comment diriger le ventre vers votre propre serveur au lieu de xiaozhi.me, et ce qui se passe au premier démarrage.'
route: bot
order: 3
updated: 2026-11-18
---

## Ce que ça fait

Xiaozhi ([78/xiaozhi-esp32](https://github.com/78/xiaozhi-esp32), MIT) est un firmware open source qui transforme une carte ESP32 en assistant vocal. C’est lui qui donne au ventre ses oreilles et sa voix : il guette un mot d’activation, transmet en continu ce que vous dites à un serveur, et joue la réponse.

D’après son README, les parties que le bot utilise :

- **Une chaîne vocale.** L’audio est compressé avec Opus et transmis en continu à un serveur, qui exécute la reconnaissance vocale, un modèle de langage et la synthèse vocale, puis renvoie en continu la réponse parlée.
- **Deux transports** : [WebSocket](https://github.com/78/xiaozhi-esp32/blob/main/docs/websocket.md), ou [MQTT plus UDP](https://github.com/78/xiaozhi-esp32/blob/main/docs/mqtt-udp.md). Le bot utilise WebSocket.
- **Un mot d’activation hors ligne** avec ESP-SR d’Espressif, si bien que la carte ne commence à transmettre qu’après avoir entendu son mot d’activation.
- **Un MCP côté appareil** : le firmware expose des « outils » (le README cite le contrôle du haut-parleur, des LED, d’un servo et des GPIO) que le modèle de langage du serveur peut découvrir et appeler.
- **Le provisionnement Wi-Fi** par un point d’accès ou par BluFi, si bien qu’aucun mot de passe Wi-Fi n’est compilé dans le firmware.
- **Une couche d’affichage** pour les écrans LCD, avec des expressions et le texte de la conversation.

Xiaozhi prend en charge le ventre du bot d’origine. Par défaut, il parle au service officiel xiaozhi.me ; le bot parle plutôt à un serveur sur votre propre PC (guide 4).

## Comment ça marche à l’intérieur

### Le dossier de la carte

Chaque carte que Xiaozhi prend en charge a un dossier sous `main/boards/`. Celui du ventre est `main/boards/waveshare/esp32-p4-wifi6-touch-lcd/`, partagé par toute la famille ESP32-P4-WIFI6-Touch-LCD (4B, 4.3, 5, 7B, 3.4C, 4C, 7, 8 et 10.1 pouces). Il contient :

- `esp32-p4-wifi6-touch-lcd.cc` : la classe de la carte, `WaveshareEsp32p4`, construite sur le `WifiBoard` de Xiaozhi. Elle initialise l’écran, la dalle tactile GT911 et le codec audio.
- `config.h` : les broches et les tailles. Pour la carte de 4,3 pouces, il définit un écran de 480 × 800 sur 2 voies MIPI DSI à 500 Mbit/s, l’audio à 24 000 Hz en entrée et en sortie, l’ES8311 et l’ES7210 sur I2C (GPIO7 et GPIO8), l’I2S sur GPIO9 à GPIO13, et le bouton BOOT sur GPIO35.
- `config.json` : les variantes de compilation que connaît `scripts/build.py`.
- `README.md` : quelle option de menu sélectionne chaque taille.

### Deux variantes pour la même carte

`config.json` liste deux compilations pour la carte de 4,3 pouces, et choisir la bonne compte :

| Variante                        | Options supplémentaires                                                | Pour                                        |
| ------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------- |
| `esp32-p4-wifi6-touch-lcd-4.3`  | `CONFIG_ESP32P4_SELECTS_REV_LESS_V3=y`, `CONFIG_ESP32P4_REV_MIN_100=y` | Silicium ESP32-P4 antérieur à la révision 3 |
| `esp32-p4x-wifi6-touch-lcd-4.3` | aucune de ces deux                                                     | Silicium ESP32-P4 de révision 3.x           |

Les deux définissent `CONFIG_BOARD_TYPE_WAVESHARE_ESP32_P4_WIFI6_TOUCH_LCD_4_3=y`, l’annulation d’écho côté appareil (`CONFIG_USE_DEVICE_AEC=y`) et les options de la caméra OV5647 pour la version qui en a une. Le README de Xiaozhi note que l’ESP32-P4 Rev1 et Rev3 sont tous deux pris en charge sur IDF 6, et le README du support de carte de Waveshare décrit la même séparation (« pre-v3 silicon », silicium antérieur à la v3, et « rev3.x or newer », rev3.x ou plus récent). esptool affiche la puce et sa révision quand il se connecte à la carte, alors vérifiez la vôtre avant la première compilation.

### Comment le ventre trouve son serveur

L’adresse du serveur n’est pas compilée dans le code vocal. À chaque démarrage, Xiaozhi demande ses réglages à un **point de terminaison OTA**, comme le décrit son [document OTA](https://github.com/78/xiaozhi-esp32/blob/main/docs/ota.md) :

1. La carte envoie un `POST` à l’URL OTA avec son identité (adresse MAC, un UUID `Client-Id` conservé dans la NVS, nom de la carte, version du firmware) et ses capacités.
2. Le serveur répond en JSON : un objet `websocket` (`url` et `token`) ou un objet `mqtt`, l’heure du serveur, une mise à jour de firmware facultative, et un code `activation` facultatif.
3. La carte enregistre les réglages de connexion dans la NVS et ouvre le canal vocal quand elle en a besoin.

La règle du document pour choisir l’URL OTA : le firmware « uses a valid saved `wifi.ota_url`, otherwise `CONFIG_OTA_URL` » (utilise un `wifi.ota_url` enregistré et valide, sinon `CONFIG_OTA_URL`). Dans `main/ota.cc` :

```cpp
std::string Ota::GetCheckVersionUrl() {
    Settings settings("wifi", false);
    std::string url = settings.GetString("ota_url");
    if (!wifi_config::IsValidOtaUrl(url)) {
        ESP_LOGW(TAG, "Ignoring invalid saved OTA URL; using the default");
        url.clear();
    }
    if (url.empty()) {
        url = CONFIG_OTA_URL;
    }
    return url;
}
```

`CONFIG_OTA_URL` vient de `main/Kconfig.projbuild`, sous le menu `Xiaozhi Assistant`, en tant que « Default OTA URL » (URL OTA par défaut), avec la valeur par défaut `https://api.tenclass.net/xiaozhi/ota/` (le service officiel). Il y a donc deux façons de diriger le ventre vers votre serveur :

- **Enregistrer l’URL sur l’appareil** (ce que fait le bot). La page de configuration Wi-Fi a un onglet Advanced avec un champ d’URL OTA ; ce que vous y saisissez est enregistré dans la NVS sous `wifi/ota_url`.
- **Changer la valeur par défaut dans la compilation**, via `idf.py menuconfig` ou en modifiant `Kconfig.projbuild`, comme le fait le guide du firmware de xinnan-tech.

Le bot l’enregistre sur l’appareil en raison d’une règle fixée pour tout le projet : les secrets, et l’adresse du serveur avec eux, vivent dans la NVS ou dans une configuration locale, jamais dans le dépôt. Une URL enregistrée sur l’appareil n’atteint jamais git, et déplacer le serveur vers un autre PC ne demande aucune recompilation.

### Premier démarrage et provisionnement Wi-Fi

Le Wi-Fi vient du composant [esp-wifi-connect](https://github.com/78/esp-wifi-connect) de Xiaozhi. Son README indique qu’il essaie d’abord les réseaux enregistrés dans la flash, et qu’en cas d’échec il démarre un point d’accès et un serveur web à `http://192.168.4.1`. Le `WifiBoard` de Xiaozhi le configure avec le préfixe `Xiaozhi`, si bien que le point d’accès s’appelle `Xiaozhi-` suivi de quatre chiffres hexadécimaux tirés de l’adresse MAC de la carte, et il active le champ OTA de l’onglet Advanced (`show_ota_config = true`).

Le composant valide l’URL OTA avant de l’enregistrer : une valeur vide signifie « utiliser la valeur par défaut du firmware », et toute autre valeur doit être une URL HTTP ou HTTPS absolue de 255 octets ASCII au plus, avec un hôte.

Une fois connecté, le ventre appelle le point de terminaison OTA de votre serveur. Avec le service officiel, la réponse comprend un code d’activation que vous saisissez dans la console de xiaozhi.me. Votre propre serveur, dans son mode minimal, renvoie l’adresse WebSocket et aucun code d’activation (guide 4), il n’y a donc rien à associer et le ventre passe directement au repos.

### Une conversation, étape par étape

D’après le document WebSocket de Xiaozhi :

1. **Repos → Connexion.** Le mot d’activation ou le bouton BOOT ouvre le canal audio : le ventre se connecte à l’URL WebSocket, avec les en-têtes `Authorization`, `Protocol-Version`, `Device-Id` et `Client-Id`, et envoie un message `"type": "hello"` avec ses paramètres audio.
2. **Connexion → Écoute.** Le serveur répond avec son propre `hello` et un identifiant de session, le ventre envoie `listen` avec `"state": "start"`, et l’audio du microphone monte en Opus dans des trames binaires.
3. **Le serveur travaille.** Il renvoie `stt` avec le texte qu’il a entendu, `llm` avec une émotion pour le visage, et des messages `tts` : `start`, puis `sentence_start` avec le texte de chaque phrase, puis `stop`.
4. **Écoute → Parole → Repos.** Sur `tts` `start`, le ventre arrête d’envoyer de l’audio et joue ce qui arrive ; sur `stop`, il revient à l’écoute si la continuation automatique est activée, sinon au repos.

Cette émotion `llm` sera utile plus tard : c’est la première chose que le ventre peut transmettre à la tête comme pose.

### Le MCP côté appareil

Xiaozhi enregistre des outils sur l’appareil via le singleton `McpServer`, avec `AddTool(name, description, properties, callback)`. Le serveur envoie `initialize`, puis `tools/list`, puis `tools/call` en JSON-RPC 2.0, comme l’explique son [document d’utilisation du MCP](https://github.com/78/xiaozhi-esp32/blob/main/docs/mcp-usage.md). C’est ainsi que le cerveau de Narsil pourra agir sur le bot, et pas seulement parler à travers lui ; des guides ultérieurs ajoutent les propres outils du bot.

## Comment on l’a demandé à l’IA

La voix ne figurait pas dans la première conception. Une fois que les deux cartes ont eu leur rôle, l’IA a demandé comment Narsil devait parler, et l’auteur ou l’autrice avait déjà une réponse :

> yo pensaba hacerlo con Xiaozhi

Traduction en français : je pensais le faire avec Xiaozhi.

L’IA a lu le README de Xiaozhi pour vérifier ce qu’il apporte et ce qu’il exige : licence MIT, l’ESP32-P4 parmi ses plateformes de puces, et ESP-IDF 6.0.1 ou ultérieure (guide 2). Cela a fait de Xiaozhi la base du firmware du ventre, et du dépôt un fork de celui-ci.

Puis est venue la question de l’endroit où la voix est traitée. Xiaozhi se connecte à xiaozhi.me par défaut, et l’IA a demandé s’il fallait utiliser ce service ou un serveur appartenant à l’auteur ou à l’autrice. La réponse :

> servidor propio

Traduction en français : un serveur à soi.

C’est à cause de cette réponse que ce guide s’attarde sur l’URL OTA : c’est le seul réglage qui fait passer le ventre du service officiel au vôtre. Le guide 4 construit le serveur lui-même.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas la conversation qui a servi à construire le bot.

> J’ai un fork de 78/xiaozhi-esp32 et une Waveshare ESP32-P4-WIFI6-Touch-LCD-4.3. Lis le dossier de carte `main/boards/waveshare/esp32-p4-wifi6-touch-lcd/`, `main/Kconfig.projbuild`, `main/ota.cc` et `docs/ota.md`, puis explique : quelle variante de compilation convient à ma carte et comment connaître la révision de ma puce, la commande `scripts/build.py` exacte, et toutes les façons dont le firmware décide quelle URL OTA utiliser. Je veux que l’adresse de mon serveur reste hors du dépôt, alors recommande l’option qui l’enregistre sur l’appareil, et dis-moi ce que je verrai au premier démarrage.

## Le code minimal

Le ventre n’a besoin d’aucun nouveau code pour ce guide : c’est Xiaozhi tel quel, compilé pour la bonne carte. Depuis la racine du fork, dans PowerShell, avec l’image Docker du guide 2 :

```powershell
docker run --rm -v ${PWD}:/project -w /project -e HOME=/tmp -e IDF_GIT_SAFE_DIR=/project `
  espressif/idf:release-v6.1 `
  python scripts/build.py waveshare/esp32-p4-wifi6-touch-lcd --name esp32-p4-wifi6-touch-lcd-4.3 --language es-ES
```

- `waveshare/esp32-p4-wifi6-touch-lcd` est le dossier de la carte sous `main/boards/`.
- `--name` choisit la variante. Sans lui, `build.py` pose la question de façon interactive, et dans un conteneur sans terminal il s’arrête avec « Multiple variants found in non-interactive mode; select one with --name. » (plusieurs variantes trouvées en mode non interactif ; choisissez-en une avec --name). Utilisez `esp32-p4x-wifi6-touch-lcd-4.3` pour un silicium de révision 3.
- `--language es-ES` met l’interface et les messages vocaux en espagnol, la langue de Narsil ; la valeur par défaut est `en-US`. Sans `--wake-word`, `build.py` choisit « Hi ESP » pour toutes les langues sauf `zh-CN` et `zh-TW`.

Le résultat est `build/merged-binary.bin`. Flashez-le depuis Windows (guide 2) :

```powershell
esptool --port COM5 write-flash 0x0 build/merged-binary.bin
```

Puis, au premier démarrage :

1. Sur votre téléphone, rejoignez le réseau Wi-Fi `Xiaozhi-` suivi de quatre caractères.
2. Ouvrez `http://192.168.4.1`.
3. Dans l’onglet **Advanced**, saisissez l’URL OTA de votre serveur, formée de l’adresse LAN de votre PC et du port 8003 (guide 4), par exemple `http://192.168.1.50:8003/xiaozhi/ota/`. Enregistrez.
4. Choisissez votre réseau Wi-Fi, saisissez son mot de passe, et enregistrez.

Si vous compilez avec `idf.py` au lieu de `build.py`, la même carte se sélectionne dans `idf.py menuconfig` sous `Xiaozhi Assistant`, option « Waveshare ESP32-P4 Wi-Fi 6 Touch LCD 4.3 ».

## Erreurs fréquentes et comment tester

- **La mauvaise variante pour votre silicium.** Les deux compilations de 4,3 pouces ne diffèrent que par la révision de puce qu’elles visent. Vérifiez la révision qu’affiche esptool et choisissez le `--name` correspondant.
- **`127.0.0.1` ou `localhost` comme URL OTA.** Sur le ventre, ces adresses désignent le ventre lui-même. Utilisez l’adresse du PC sur votre réseau.
- **Une URL que le portail refuse.** Elle doit être absolue (`http://` compris), comporter un hôte, et rester sous 255 octets ASCII. Gardez le chemin exactement `/xiaozhi/ota/`, avec la barre oblique finale, tel que le serveur l’affiche.
- **`https://` vers un serveur en HTTP simple.** Le serveur minimal du guide 4 parle en HTTP simple sur le 8003.
- **Une URL invalide enregistrée auparavant.** Le firmware l’ignore et se rabat sur `CONFIG_OTA_URL`, qui est le service officiel. Le moniteur affiche « Ignoring invalid saved OTA URL; using the default » (URL OTA enregistrée invalide ignorée ; utilisation de la valeur par défaut).
- **Le point d’accès revient après un reflashage complet.** Le document WebSocket de Xiaozhi indique que le `Client-Id` est réinitialisé quand la NVS est effacée ou que le firmware complet est reflashé ; si les réglages enregistrés ont aussi disparu, saisissez de nouveau le Wi-Fi et l’URL OTA.
- **La carte se connecte mais ne répond jamais.** Le pare-feu du PC bloque peut-être les ports 8000 et 8003, ou le serveur est peut-être éteint. Le ventre continue de réessayer la vérification OTA : dix tentatives, en commençant à dix secondes et en doublant.

Pour tester, ouvrez le moniteur (guide 2) pendant le premier démarrage. Vous devriez voir la connexion Wi-Fi, la requête OTA vers votre URL et, une fois le serveur lancé, aucune étape d’activation. Dites ensuite le mot d’activation, « Hi ESP » : le ventre passe en écoute, et le journal du serveur (guide 4) montre la connexion et le texte qu’il a entendu.

## Pour aller plus loin

- Le [document OTA](https://github.com/78/xiaozhi-esp32/blob/main/docs/ota.md) de Xiaozhi décrit comment un serveur peut aussi proposer des mises à jour de firmware ; le serveur de xinnan-tech peut les servir depuis son dossier `data/bin`, si bien que le ventre peut se mettre à jour par Wi-Fi.
- `scripts/build.py --list-wake-words` liste les modèles de mot d’activation du composant ESP-SR actuel, et `--wake-word` en choisit un.
- Le [guide de carte personnalisée](https://github.com/78/xiaozhi-esp32/blob/main/docs/custom-board.md) avertit de ne jamais écraser la configuration d’une carte existante pour une carte personnalisée, parce que l’OTA peut remplacer votre firmware par le firmware d’origine de cette carte. Gardez-le en tête chaque fois que vous ajoutez votre propre code au ventre.
- Xiaozhi peut aussi afficher des expressions sur son propre écran ; le guide 9 remplace l’écran du ventre par l’interface propre de Narsil.
