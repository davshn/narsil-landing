---
title: Le bot et ses pièces
description: 'Les deux cartes du bot de bureau Narsil, le rôle de chacune, la liste des composants, la liaison UART à trois fils entre le ventre et la tête, et le trajet des données.'
route: bot
order: 1
updated: 2026-11-18
---

## Ce que ça fait

Le bot de bureau Narsil, c’est Narsil avec un corps. Il se pose sur le bureau à côté de votre ordinateur et remplit trois fonctions :

- **Il parle.** Vous lui parlez, et Narsil répond avec une voix. La réponse vient de Claude, en passant par un petit serveur qui tourne sur votre propre PC.
- **Il montre ce que fait Narsil.** Un écran tactile de 4,3 pouces dans le ventre affiche les alertes de Narsil et vos pull requests GitHub ouvertes.
- **Il a un visage.** La tête est un petit écran placé dans un cube prisme en verre qui n’affiche que le visage de Narsil, si bien qu’on dirait un hologramme flottant au-dessus du corps.

Le bot se compose de deux cartes reliées par trois fils. Le ventre est le cerveau et fait tout ce qui touche au réseau. La tête ne fait que dessiner. Ce premier guide décrit les pièces et la façon dont elles s’assemblent ; la suite du parcours construit chaque élément.

## Comment ça marche à l’intérieur

### Le ventre : Waveshare ESP32-P4-WIFI6-Touch-LCD-4.3

Le ventre est la [Waveshare ESP32-P4-WIFI6-Touch-LCD-4.3](https://docs.waveshare.com/ESP32-P4-WIFI6-Touch-LCD-4.3). D’après la page de Waveshare, les pièces qui comptent pour le bot sont :

| Pièce           | Ce que c’est                                                                                                |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| Puce principale | ESP32-P4 (ESP32-P4NRW32X sur le module) : RISC-V double cœur plus un cœur basse consommation                |
| Mémoire         | 32 Mo de PSRAM empilée dans le boîtier de la puce, 32 Mo de flash NOR                                       |
| Écran           | IPS de 4,3 pouces, 480 × 800, tactile capacitif, sur une interface MIPI DSI à 2 voies                       |
| Sans fil        | Un module ESP32-C6-MINI-1 intégré pour le Wi-Fi 6 et le Bluetooth 5 (LE), relié au P4 par SDIO              |
| Audio           | Codec audio ES8311, ES7210 pour l’annulation d’écho, un réseau de deux microphones                          |
| Haut-parleur    | Un connecteur GH1.25 à 2 broches ; Waveshare recommande un haut-parleur de 8 Ω 2 W                          |
| USB             | Un port Type-C « USB to UART » pour l’alimentation, le flashage et le débogage ; un port Type-C USB OTG 2.0 |
| Extension       | Un connecteur de 40 broches au pas de 2,54 mm avec I2C, GPIO, 3V3, 5V et GND                                |

L’ESP32-P4 n’a pas de radio propre. Chaque octet qui part sur le réseau passe par l’ESP32-C6 voisin, via SDIO. Pour le firmware, c’est invisible : le support de carte de Xiaozhi pour cette carte (guide 3) configure déjà le C6 comme coprocesseur Wi-Fi (`CONFIG_SLAVE_IDF_TARGET_ESP32C6=y` dans ses valeurs par défaut pour l’ESP32-P4).

Le contrôleur tactile de la carte est un GT911, celui que pilotent à la fois le code de carte de Xiaozhi et le paquet de support de carte de Waveshare (`waveshare/esp32_p4_wifi6_touch_lcd_4_3` dans le registre de composants d’Espressif).

### La tête : ESP32-S3-LCD-1.3-C

La tête est l’ESP32-S3-LCD-1.3-C, la version de l’ESP32-S3-LCD-1.3 de Waveshare livrée avec un boîtier en plastique et un cube prisme. SpotPear la vend sous le nom de [3D transparent prism display](https://spotpear.com/wiki/ESP32-S3-1.3-inch-LCD-ST7789-240x240-3D-Display-Transparent-Screen-Refractive-Prism-Mini-TV.html) (écran prisme transparent 3D), et Waveshare documente la carte de base sur sa [page produit](https://www.waveshare.com/esp32-s3-lcd-1.3.htm) :

| Pièce           | Ce que c’est                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------- |
| Puce principale | ESP32-S3R8, Xtensa LX7 double cœur jusqu’à 240 MHz                                                |
| Mémoire         | 512 Ko de SRAM, 8 Mo de PSRAM, 16 Mo de flash                                                     |
| Écran           | IPS de 1,3 pouce, 240 × 240, 262K couleurs, pilote ST7789V2 sur SPI                               |
| Mouvement       | Centrale inertielle six axes QMI8658 (accéléromètre et gyroscope), au dos                         |
| USB             | Type-C via une puce USB-série CH343P                                                              |
| Alimentation    | Régulateur 3,3 V ME6217C33M5G (800 mA au maximum), chargeur PL4054, connecteur de batterie MX1.25 |
| Autres          | Emplacement pour carte TF, un connecteur GPIO au pas de 2,54 mm                                   |
| Prisme          | Un cube en verre posé sur l’écran qui en reflète l’image                                          |

C’est le prisme qui donne l’impression que le visage flotte : l’écran est à plat et la face intérieure du cube le reflète vers vous. Un reflet est une image en miroir, donc la tête dessine son visage inversé ; le [guide 11](/fr/bot/holographic-head/) traite ce point.

L’ESP32-S3 a son propre Wi-Fi, et la tête ne s’en sert pas. C’est une décision, expliquée ci-dessous.

### Pourquoi le ventre gère tout le réseau

Les données de Narsil vivent sur Internet : les alertes arrivent par ntfy, les pull requests viennent de l’API REST de GitHub, et la voix part vers votre serveur. Les trois ont besoin du Wi-Fi, d’identifiants et d’une logique de nouvelle tentative. Si les deux cartes se connectaient, toutes deux auraient besoin du mot de passe Wi-Fi, du token GitHub et du topic ntfy, et toutes deux pourraient être en désaccord sur ce que fait Narsil.

Le ventre possède donc chaque connexion et chaque secret, et décide de l’état de Narsil. La tête ne reçoit que ce qu’elle doit dessiner : une pose et un état, par un câble série. Elle ne détient aucun secret, et si elle redémarre, elle attend simplement le message suivant. Le [guide 10](/fr/bot/uart-protocol/) définit ce protocole.

### La liaison UART

Les deux cartes communiquent par UART, la liaison série simple dont dispose chaque ESP32, à l’aide de fils Dupont femelle-femelle entre leurs connecteurs :

| Fil       | Ventre (ESP32-P4) | Tête (ESP32-S3) |
| --------- | ----------------- | --------------- |
| Données → | GPIO4 (TX)        | GPIO13 (RX)     |
| Données ← | GPIO5 (RX)        | GPIO14 (TX)     |
| Masse     | GND               | GND             |

Le TX d’un côté va au RX de l’autre : chaque carte parle sur sa broche TX et écoute sur sa broche RX, donc les fils se croisent.

Pourquoi ces broches :

- **Sur le ventre**, GPIO4 et GPIO5 se trouvent sur le connecteur de 40 broches et ne servent à rien de ce que Xiaozhi configure pour cette carte. Son `config.h` prend GPIO9 à GPIO13 pour l’audio I2S, GPIO7 et GPIO8 pour l’I2C, GPIO53 pour l’amplificateur du haut-parleur, GPIO26 et GPIO27 pour l’écran, et GPIO35 pour le bouton BOOT. Le support de carte de Waveshare ajoute GPIO39 à GPIO44 pour la carte TF. Les broches GPIO37 et GPIO38 du connecteur sont elles aussi laissées de côté : ESP-IDF les indique comme TX et RX par défaut de l’UART0 sur l’ESP32-P4, le port du journal de démarrage.
- **Sur la tête**, GPIO13 et GPIO14 sont des broches voisines du connecteur dans le schéma de Waveshare (`ESP32S3_1.3inch.pdf`, lié depuis le wiki de SpotPear). L’écran, la centrale inertielle et la carte TF utilisent d’autres broches, et GPIO43 et GPIO44 portent U0TXD et U0RXD vers le CH343P, le port série USB propre à la tête.

Vérifiez les inscriptions imprimées sur vos cartes avant de brancher quoi que ce soit : la disposition des connecteurs varie d’une révision à l’autre.

**Alimentation : un câble USB par carte, masse commune, 3V3 non partagé.** Chaque carte reçoit son propre câble USB-C. Le ventre s’alimente par son port « USB to UART », et la tête régule son propre 3,3 V avec son ME6217C33M5G. Relier les deux broches 3V3 attacherait ensemble deux régulateurs distincts, chacun essayant de tenir la ligne, et la broche 3V3 du connecteur du ventre n’a jamais été prévue pour alimenter une seconde carte. Le fil de masse est celui qui compte : un signal UART est une tension mesurée par rapport à la masse, donc les deux cartes ont besoin de la même masse. Les deux puces utilisent une logique en 3,3 V, il n’y a donc pas besoin d’adaptateur de niveau.

### Le trajet des données

| De              | Vers                         | Par                           | Quoi                                                            |
| --------------- | ---------------------------- | ----------------------------- | --------------------------------------------------------------- |
| Microphones     | Ventre (ES7210, Xiaozhi)     | I2S                           | Votre voix                                                      |
| Ventre          | Votre serveur (sur votre PC) | WebSocket, LAN                | Audio Opus à l’aller ; audio Opus et texte au retour            |
| Votre serveur   | Claude                       | HTTPS, SDK Anthropic          | Ce que vous avez dit, en texte ; la réponse de Narsil au retour |
| Ventre          | Haut-parleur (ES8311)        | I2S                           | La voix de Narsil                                               |
| ntfy            | Ventre                       | HTTPS                         | Les alertes de Narsil depuis votre ordinateur                   |
| API REST GitHub | Ventre                       | HTTPS, token en lecture seule | Vos pull requests ouvertes                                      |
| Ventre          | Écran du ventre (LVGL)       | MIPI DSI                      | Alertes et pull requests                                        |
| Ventre          | Tête                         | UART, 3 fils                  | Pose et état                                                    |
| Tête            | Prisme                       | Écran ST7789                  | Le visage de Narsil, en miroir                                  |

Le trajet de la voix est le seul qui a besoin de votre PC. Les alertes, les pull requests et le visage continuent de fonctionner quand le serveur est éteint.

### La liste des composants

- 1 × Waveshare ESP32-P4-WIFI6-Touch-LCD-4.3 (le ventre).
- 1 × ESP32-S3-LCD-1.3-C, avec son boîtier et son cube prisme (la tête).
- Des fils Dupont femelle-femelle (trois sont utilisés).
- 1 × haut-parleur avec une fiche GH1.25 à 2 broches, 8 Ω 2 W comme le recommande Waveshare. Les microphones sont déjà sur le ventre.
- 2 × câbles de données USB-C, un par carte.
- Un PC sur le même réseau, avec Docker, pour le serveur vocal (guide 4).

Le firmware des deux cartes se trouve dans un seul dépôt public, `davshn/narsil-bot` : un fork de 78/xiaozhi-esp32 pour le ventre, avec le firmware de la tête dans son propre dossier `head/`.

## Comment on l’a demandé à l’IA

La conception est partie d’un panier d’achat. Le 2026-11-17, l’auteur ou l’autrice a partagé une capture d’écran d’un panier AliExpress contenant les deux cartes et un lot de fils Dupont, et a décrit l’idée :

> va a ser la pantalla grande para una pantalla en la pansa que va a tener la informacion de las tareas que hace narsil y la cabeza va a ser una apntalla holografica que solo sea la cara de narsil

Traduction en français : ce sera le grand écran, pour un écran dans le ventre qui aura les informations sur les tâches que fait Narsil, et la tête sera un écran holographique qui ne soit que le visage de Narsil.

Cela a fixé le rôle des deux cartes avant tout code : le P4 au grand écran est le ventre, le S3 au prisme est le visage.

La question suivante posée par l’IA portait sur la façon dont la tête obtiendrait ses données : se connecter au réseau par elle-même, ou les recevoir du ventre. L’auteur ou l’autrice a répondu :

> Por cable desde la panza

Traduction en français : par câble depuis le ventre.

Cette réponse est la règle de « Pourquoi le ventre gère tout le réseau » ci-dessus : une carte possède le réseau et les secrets, l’autre ne fait que dessiner. L’IA a posé ses questions une à la fois, avec les pages de Waveshare et de SpotPear comme sources, et a consigné chaque réponse dans le document de tâches du projet sous forme de spec numérotée.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas la conversation qui a servi à concevoir le bot.

> Je veux construire un bot de bureau à partir de deux cartes ESP32 : une Waveshare ESP32-P4-WIFI6-Touch-LCD-4.3 comme corps et une ESP32-S3-LCD-1.3-C (ST7789 240×240 sous un cube prisme) comme tête. Le corps doit gérer tout le réseau et la tête doit seulement dessiner un visage qu’elle reçoit par UART. Lis les pages et les schémas officiels de Waveshare et de SpotPear, puis propose : le rôle de chaque carte, quelles broches libres du connecteur utiliser pour l’UART de chaque côté (en évitant les broches que le support de carte ou la console de démarrage utilisent déjà), comment alimenter les deux cartes, et une liste des composants. Cite la page d’où vient chaque broche, et pose-moi une question à la fois quand quelque chose relève d’un vrai choix.

## Le code minimal

Le câblage devient du code à un seul endroit sur chaque carte : la configuration de l’UART. Voici le côté du ventre, écrit pour ce guide avec le pilote UART d’ESP-IDF (`driver/uart.h`, les mêmes appels que l’exemple `uart_echo` d’ESP-IDF). Le côté de la tête est identique avec ses propres broches.

```c
#include "driver/uart.h"

#define HEAD_UART      UART_NUM_1
#define HEAD_UART_TX   4
#define HEAD_UART_RX   5
#define HEAD_UART_BAUD 115200

void head_link_init(void)
{
    const uart_config_t config = {
        .baud_rate = HEAD_UART_BAUD,
        .data_bits = UART_DATA_8_BITS,
        .parity = UART_PARITY_DISABLE,
        .stop_bits = UART_STOP_BITS_1,
        .flow_ctrl = UART_HW_FLOWCTRL_DISABLE,
        .source_clk = UART_SCLK_DEFAULT,
    };
    ESP_ERROR_CHECK(uart_driver_install(HEAD_UART, 1024, 0, 0, NULL, 0));
    ESP_ERROR_CHECK(uart_param_config(HEAD_UART, &config));
    ESP_ERROR_CHECK(uart_set_pin(HEAD_UART, HEAD_UART_TX, HEAD_UART_RX,
                                 UART_PIN_NO_CHANGE, UART_PIN_NO_CHANGE));
}
```

Un détail passe facilement inaperçu. Sur l’ESP32-P4, les broches par défaut d’ESP-IDF pour l’UART1 sont GPIO10 et GPIO11, et sur cette carte elles portent l’audio (sélection de mot I2S et entrée de données). `uart_set_pin` achemine plutôt l’UART1 vers GPIO4 et GPIO5 par la matrice GPIO, si bien que les broches par défaut ne sont jamais touchées. L’envoi se fait ensuite en un appel, `uart_write_bytes(HEAD_UART, data, len)` ; ce que contient `data` relève du [guide 10](/fr/bot/uart-protocol/).

## Erreurs fréquentes et comment tester

- **TX vers TX.** Si rien n’arrive, inversez les deux fils de données. Chaque TX va au RX de l’autre carte.
- **Pas de fil de masse.** Sans masse commune, le signal n’a pas de référence, et la tête lit des données incohérentes ou rien du tout.
- **Relier les broches 3V3.** Chaque carte est alimentée par son propre câble USB ; laissez le 3V3 non connecté.
- **Utiliser les broches de la console.** GPIO37 et GPIO38 sur le ventre, et GPIO43 et GPIO44 sur la tête, sont l’UART0, relié au port série USB de chaque carte. Les messages qui y passent se mélangent au journal de démarrage.
- **Des fils femelles sur un connecteur nu.** Les fils Dupont femelle-femelle ont besoin de broches mâles sur les deux cartes. Vérifiez que les connecteurs de vos cartes ont des broches avant de planifier le câblage.
- **Un câble USB qui ne fait que charger.** Si Windows n’affiche pas de nouveau port COM quand vous branchez une carte, essayez un autre câble (guide 2).

Pour tester la liaison avant qu’un protocole existe, flashez les deux cartes avec l’exemple `uart_echo` d’ESP-IDF réglé sur ces broches, ou envoyez une ligne depuis le ventre et journalisez ce que la tête lit avec `uart_read_bytes`. Si le texte arrive intact à 115200 bauds, le câblage est correct.

## Pour aller plus loin

- L’écran tactile du ventre peut faire plus qu’afficher : un appui peut marquer une alerte comme lue, ce que le [guide 9](/fr/bot/belly-ui/) construit avec LVGL.
- Le QMI8658 de la tête peut détecter quand quelqu’un soulève le bot ou le tapote. La tête pourrait renvoyer cette information sur son fil TX, et c’est pourquoi la liaison a deux fils de données et non un seul.
- Les deux cartes ont des connecteurs de batterie (MX1.25 sur la tête, un connecteur lithium 3,7 V sur le ventre). Le bot de ce parcours fonctionne sur USB, ce qui garde la conception de l’alimentation simple.
- La [page ESP-IDF de Waveshare pour le ventre](https://docs.waveshare.com/ESP32-P4-WIFI6-Touch-LCD-4.3/ESP-IDF/) liste des projets d’exemple (outils I2C, station Wi-Fi, codec I2S, LVGL) utiles pour vérifier chaque partie de la carte isolément.
