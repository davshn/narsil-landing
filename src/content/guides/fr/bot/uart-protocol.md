---
title: Le protocole UART entre le ventre et la tête
description: 'Un petit protocole par lignes avec une version et une somme de contrôle : le ventre envoie la pose et l’état vocal de Narsil, la tête ne fait que saluer, et tous deux survivent à un redémarrage.'
route: bot
order: 10
updated: 2026-11-18
---

## Ce que ça fait

Le ventre sait ce que fait Narsil ; la tête ne fait que la dessiner. Entre les deux passent les trois fils du guide 1, et ce guide décide de ce qui y circule : de courtes lignes de texte comme

```text
$N1,P,trabajando,3*3A
```

qui signifie « protocole version 1 : affiche la pose `trabajando` (au travail) au stade 3 ». Le ventre envoie une ligne quand la pose de Narsil change, quand Xiaozhi commence ou arrête d’écouter ou de parler, et toutes les cinq secondes de toute façon. La tête vérifie chaque ligne, dessine ce qu’elle dit, et ne renvoie une ligne que lorsqu’elle démarre, pour demander l’état actuel.

C’est tout le protocole : deux messages vers le bas, un vers le haut. Cela suffit parce que la tête ne détient aucun état qui vaille d’être gardé ni aucun secret, comme l’a décidé le guide 1.

## Comment ça marche à l’intérieur

### Pourquoi des lignes de texte

Un UART transporte des octets, sans aucune idée de l’endroit où un message commence ou se termine. Le protocole doit l’ajouter, et il existe deux façons courantes de le faire : des trames binaires avec un octet de début et une longueur, ou des lignes de texte qui se terminent par `\n`. Le bot utilise des lignes de texte :

- **On peut les lire.** Le moniteur série ou un adaptateur USB-série montre les messages tels quels, et vous pouvez en taper un à la main pour tester la tête.
- **Un octet perdu coûte une ligne.** Après n’importe quels déchets, le `$` suivant commence un nouveau message, et le `\n` suivant le termine. Rien n’a besoin de se resynchroniser.
- **Les messages sont minuscules.** Une pose et un stade tiennent en une vingtaine d’octets. À 115200 bauds, une ligne prend moins de 2 millisecondes.

### La forme d’une ligne

```text
$N1,<type>,<fields>*<checksum>\n
```

| Partie       | Signification                                                                       |
| ------------ | ----------------------------------------------------------------------------------- |
| `$`          | Début d’un message. Tout ce qui le précède est ignoré.                              |
| `N1`         | Protocole Narsil, version 1. Une tête qui ne connaît pas la version l’ignore.       |
| `<type>`     | Une lettre : `P` (pose), `V` (voix), `H` (hello, salut).                            |
| `<fields>`   | Des valeurs séparées par des virgules, selon le type.                               |
| `*`          | Fin du corps.                                                                       |
| `<checksum>` | Deux chiffres hexadécimaux en majuscules : le XOR de chaque octet entre `$` et `*`. |
| `\n`         | Fin de la ligne. Une ligne de plus de 64 octets est jetée.                          |

C’est la même forme que celle qu’utilisent les récepteurs GPS pour leurs phrases NMEA, pour les mêmes raisons : lisible, courte et auto-vérifiée. La somme de contrôle XOR fait un octet, calculé en combinant les caractères par XOR l’un après l’autre. Elle ne détecte pas toutes les erreurs, mais elle détecte les plus courantes sur un fil court, comme un bit inversé ou un octet perdu au milieu d’une ligne, et ne coûte rien à calculer.

Le champ de version est ce qui permet au protocole d’évoluer plus tard. Si la version 2 ajoute un champ, une tête avec un ancien firmware ignore les lignes `N2` au lieu de dessiner quelque chose de faux, et le ventre peut envoyer les deux pendant que les deux cartes sont mises à jour l’une après l’autre.

### Les messages

| Ligne                   | Sens          | Signification                                                                                         |
| ----------------------- | ------------- | ----------------------------------------------------------------------------------------------------- |
| `$N1,P,<pose>,<stage>*` | ventre → tête | La pose de Narsil : `parada`, `trabajando`, `necesita`, `terminado` ou `error` ; son stade, de 1 à 5. |
| `$N1,V,<voice>*`        | ventre → tête | L’état vocal de Xiaozhi : `idle`, `listening` ou `speaking`.                                          |
| `$N1,H*1B`              | tête → ventre | Salut : la tête vient de démarrer et n’a rien à dessiner.                                             |

Quelques lignes réelles, avec leurs sommes de contrôle :

```text
$N1,P,parada,1*35
$N1,P,necesita,2*33
$N1,V,listening*40
$N1,V,idle*2D
$N1,H*1B
```

Les noms des poses sont ceux de narsil-pet, gardés en espagnol pour correspondre un à un à ses fichiers de dessin. Ils viennent de la table `POSE` de son `hooks/sprite.ts`, une pose par état : `working` est `trabajando`, `idle` est `parada`, `waiting` est `necesita`, `done` est `terminado` et `error` est `error`.

### D’où vient la pose

Le ventre n’invente pas la pose de Narsil : c’est le PC qui la lui donne, dans le message `-estado` du guide 7. Ce JSON n’a pas de champ « pose » à lui ; il a `art`, l’URL de son dessin, construite par `artUrl` dans le `hooks/phone.ts` de narsil-pet :

```ts
export function artUrl(pose: string, stage: number): string {
  return `${ART_URL}/${stage > 1 ? `etapa${stage}/` : ''}${pose}-oscuro.png`
}
```

(Cité de [davshn/narsil-pet](https://github.com/davshn/narsil-pet), GPL-3.0-or-later.) `sendStatus` dans `hooks/register.tsx` l’appelle avec la pose de la conversation la plus importante et le stade de Narsil, de 1 (le nouveau-né) à 5 (`STAGE_FROM` dans `hooks/xp.ts`). L’URL porte donc les deux valeurs :

| `art` se termine par                   | Pose         | Stade |
| -------------------------------------- | ------------ | ----- |
| `/assets/parada-oscuro.png`            | `parada`     | 1     |
| `/assets/etapa3/trabajando-oscuro.png` | `trabajando` | 3     |
| `/assets/etapa5/error-oscuro.png`      | `error`      | 5     |

`HeadSetPoseFromArt`, la fonction qu’appelle le `ShowStatus` du guide 9, prend comme pose le nom de fichier entre le dernier `/` et `-oscuro.png`, et comme stade le nombre après `/etapa` (1 quand il n’y en a pas). Elle vérifie la pose par rapport aux cinq noms avant de la garder, si bien qu’un format d’URL modifié ne peut jamais envoyer à la tête quelque chose qu’elle ne sait pas dessiner.

La tête dessine les mêmes images que celles que montrent la bande de Narsil et les alertes du téléphone, c’est pourquoi les noms restent tels que narsil-pet les écrit.

### L’état vocal

Le ventre sait aussi quelque chose que le PC ignore : si Xiaozhi écoute ou parle en ce moment. `Application::GetInstance().GetDeviceState()` dans Xiaozhi renvoie l’état actuel de sa machine à états (`main/device_state.h`) : `kDeviceStateListening` et `kDeviceStateSpeaking` deviennent `listening` et `speaking`, et tout autre état est `idle`. La tâche de liaison du ventre le vérifie dix fois par seconde et envoie une ligne `V` quand il change, pour que la tête puisse montrer que Narsil écoute pendant que vous lui parlez.

### Reconnexions, redémarrages et fils mal branchés

La liaison n’a aucune connexion à établir ni rien à acquitter. Trois règles gardent les deux côtés en phase :

1. **Le ventre se répète.** Toutes les cinq secondes, il envoie les lignes `P` et `V` actuelles, qu’elles aient changé ou non. Une tête qui a manqué une ligne, ou dont le fil a été débranché puis rebranché, est de nouveau juste en moins de cinq secondes.
2. **La tête salue.** Quand la tête démarre, elle envoie `$N1,H*1B` une fois. Le ventre répond aussitôt avec `P` et `V`, si bien qu’une tête redémarrée n’attend pas la répétition suivante.
3. **La tête remarque le silence.** Si aucune ligne valide n’arrive pendant 15 secondes, le ventre est éteint ou le fil est mal branché. La tête garde la dernière pose à l’écran et baisse son rétroéclairage (guide 11), au lieu de rester figée à pleine luminosité.

Quand le ventre démarre, il part de `parada` au stade 1 et l’envoie aussitôt ; le premier message `-estado` de ntfy (le flux demande `since=10m`, guide 7) le corrige.

### Pourquoi la tête n’envoie rien d’autre

La tête a une centrale inertielle à six axes et pourrait signaler des tapes ou qu’on la soulève, et le fil TX est là pour cela. Le bot le limite au salut pour une raison : tout ce qu’envoie la tête est quelque chose que le ventre doit valider, traiter et garder compatible d’une version à l’autre. Avec un seul message vers le haut, la tête ne peut rien demander au ventre, ne peut provoquer aucune requête réseau et ne peut atteindre aucun secret. La règle du guide 1, « le ventre possède chaque connexion et chaque secret », est plus facile à tenir quand l’autre sens est presque vide.

### L’UART sur chaque carte

Les deux côtés utilisent le [pilote UART](https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/api-reference/peripherals/uart.html) d’ESP-IDF avec les réglages du guide 1 : `UART_NUM_1`, 115200 bauds, 8 bits de données, sans parité, 1 bit d’arrêt, sans contrôle de flux, sur une masse commune.

| Carte             | TX     | RX     |
| ----------------- | ------ | ------ |
| Ventre (ESP32-P4) | GPIO4  | GPIO5  |
| Tête (ESP32-S3)   | GPIO14 | GPIO13 |

Les appels sont ceux de l’exemple `uart_echo` d’ESP-IDF : `uart_driver_install` avec un tampon de réception, `uart_param_config`, `uart_set_pin`, puis `uart_write_bytes` pour envoyer et `uart_read_bytes` avec un délai pour recevoir. Sur la tête, `uart_read_bytes` avec un délai de 200 ms sert aussi d’horloge à sa boucle principale : il revient plus tôt quand des octets arrivent, et sinon laisse la tête vérifier le silence.

## Le construire avec Claude

Demandez à Claude un petit protocole texte entre le ventre et la tête, et ses deux côtés en ESP-IDF. L’idée que Claude doit bien saisir, c’est la ligne : `$`, la version `N1`, un type, les champs, `*` et une somme de contrôle XOR à deux chiffres des octets entre `$` et `*`.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas la conversation qui a servi à construire le bot.

> Deux cartes ESP32 partagent un UART (UART_NUM_1, 115200 bauds, masse commune). Le corps n’envoie à la tête qu’une pose et un état vocal ; la tête les dessine et doit survivre aux redémarrages et aux fils débranchés. Conçois un protocole texte par lignes avec un champ de version et une somme de contrôle XOR d’un octet, liste chaque message avec un exemple et sa somme de contrôle, et écris les deux côtés en ESP-IDF 6 avec `uart_driver_install`, `uart_param_config`, `uart_set_pin`, `uart_write_bytes` et `uart_read_bytes`. Le corps répète son état toutes les 5 s ; la tête envoie un salut au démarrage et rien d’autre. Explique comment je teste chaque côté depuis un PC avec un adaptateur USB-série.

### Ce qu’il faut vérifier dans la réponse de Claude

1. La somme de contrôle couvre seulement les octets entre `$` et `*`, écrite en hexadécimal majuscule. Le code de Claude obtient `1B` pour `$N1,H*1B`.
2. Il y a trois messages : `P` avec une pose et une étape, `V` avec `idle`, `listening` ou `speaking`, et le `H` (hello) de la tête. La tête n’envoie rien d’autre, donc elle ne peut jamais rien demander au ventre ni atteindre un secret.
3. Le ventre envoie ses lignes `P` et `V` quand elles changent, toutes les cinq secondes de toute façon, et tout de suite après un hello. La tête baisse son rétroéclairage après 15 secondes sans ligne valide, et jette les lignes de plus de 64 octets.
4. La pose vient de l’URL `art` : le nom de fichier avant `-oscuro.png` et le nombre après `/etapa` (1 s’il n’y en a pas), vérifiés par rapport aux cinq noms de poses et aux étapes 1 à 5.
5. Les deux côtés utilisent `UART_NUM_1` à 115200 bauds, 8 bits de données, sans parité, 1 bit de stop et sans contrôle de flux : GPIO4 et GPIO5 sur le ventre, GPIO14 et GPIO13 sur la tête, avec une masse commune.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « je tape `$N1,P,necesita,2*33` dans le terminal de la tête et rien ne change ».

### Comment l’auteur l’a demandé

La liaison elle-même vient de l’une des premières réponses de l’auteur ou de l’autrice. À la question de savoir si la tête rejoindrait le réseau par elle-même ou recevrait ses données du ventre, la réponse a été :

> Por cable desde la panza

Traduction en français : par câble depuis le ventre.

Et le rôle de la tête avait été fixé dès le début :

> la cabeza va a ser una apntalla holografica que solo sea la cara de narsil

Traduction en français : la tête sera un écran holographique qui ne soit que le visage de Narsil.

Ensemble, ces deux réponses sont la portée du protocole : un fil, et seulement ce dont le visage a besoin. Le format n’était pas une décision de l’auteur ou de l’autrice. L’IA a comparé les trames binaires et les lignes de texte, et a choisi des lignes de texte avec une version et une somme de contrôle parce qu’on peut les lire et les taper à la main pendant les tests. Déduire la pose de l’URL `art`, au lieu d’ajouter un nouveau champ côté PC, vient de la lecture d’`artUrl` et de `sendStatus` dans narsil-pet : l’information était déjà là, donc rien n’avait à changer côté PC.

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide. Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

Le côté ventre, en C++ à côté du code de Xiaozhi (MIT, comme les exemples propres au site). `head_link_init` du guide 1 configure le port ; ceci ajoute les messages et la tâche de liaison :

```cpp
#include <driver/uart.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <mutex>
#include <string>

#include "application.h"

#define HEAD_UART UART_NUM_1

static const char* const kPoses[] = {"parada", "trabajando", "necesita", "terminado", "error"};
static std::mutex state_lock;
static std::string pose = "parada";
static int stage = 1;
static bool resend = true;

static void SendLine(const char* body) {
    uint8_t sum = 0;
    for (const char* c = body; *c; c++) sum ^= (uint8_t)*c;
    char line[72];
    int len = snprintf(line, sizeof(line), "$%s*%02X\n", body, sum);
    uart_write_bytes(HEAD_UART, line, len);
}

void HeadSetPoseFromArt(const char* art) {
    const char* file = strrchr(art, '/');
    const char* end = file ? strstr(file, "-oscuro.png") : nullptr;
    if (end == nullptr) return;
    std::string name(file + 1, end);
    const char* etapa = strstr(art, "/etapa");
    int new_stage = etapa ? atoi(etapa + 6) : 1;
    if (new_stage < 1 || new_stage > 5) return;
    for (const char* known : kPoses) {
        if (name == known) {
            std::lock_guard<std::mutex> guard(state_lock);
            pose = name;
            stage = new_stage;
            resend = true;
            return;
        }
    }
}

static const char* Voice() {
    switch (Application::GetInstance().GetDeviceState()) {
        case kDeviceStateListening: return "listening";
        case kDeviceStateSpeaking: return "speaking";
        default: return "idle";
    }
}

static void HeadLinkTask(void*) {
    const char* last_voice = "";
    TickType_t last_sent = 0;
    std::string rx;
    while (true) {
        uint8_t byte;
        while (uart_read_bytes(HEAD_UART, &byte, 1, 0) == 1) {
            if (byte != '\n') { if (rx.size() < 64) rx += (char)byte; continue; }
            if (rx == "$N1,H*1B") resend = true;
            rx.clear();
        }
        const char* voice = Voice();
        bool due = xTaskGetTickCount() - last_sent > pdMS_TO_TICKS(5000);
        if (resend || due || voice != last_voice) {
            char body[48];
            {
                std::lock_guard<std::mutex> guard(state_lock);
                snprintf(body, sizeof(body), "N1,P,%s,%d", pose.c_str(), stage);
                resend = false;
            }
            SendLine(body);
            snprintf(body, sizeof(body), "N1,V,%s", voice);
            SendLine(body);
            last_voice = voice;
            last_sent = xTaskGetTickCount();
        }
        vTaskDelay(pdMS_TO_TICKS(100));
    }
}

void StartHeadLink() {
    xTaskCreate(HeadLinkTask, "head_link", 4096, nullptr, 2, nullptr);
}
```

Appelez `head_link_init()` puis `StartHeadLink()` une fois au démarrage ; la liaison n’a pas besoin du Wi-Fi.

Le côté tête, en C (MIT). Il lit une ligne à la fois et remplit une petite structure d’état que dessine le guide 11 :

```c
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "driver/uart.h"
#include "freertos/FreeRTOS.h"

#define BELLY_UART    UART_NUM_1
#define BELLY_UART_TX 14
#define BELLY_UART_RX 13

typedef struct {
    char pose[16];
    int stage;
    char voice[12];
} head_state_t;

void head_link_init(void)
{
    const uart_config_t config = {
        .baud_rate = 115200,
        .data_bits = UART_DATA_8_BITS,
        .parity = UART_PARITY_DISABLE,
        .stop_bits = UART_STOP_BITS_1,
        .flow_ctrl = UART_HW_FLOWCTRL_DISABLE,
        .source_clk = UART_SCLK_DEFAULT,
    };
    ESP_ERROR_CHECK(uart_driver_install(BELLY_UART, 1024, 0, 0, NULL, 0));
    ESP_ERROR_CHECK(uart_param_config(BELLY_UART, &config));
    ESP_ERROR_CHECK(uart_set_pin(BELLY_UART, BELLY_UART_TX, BELLY_UART_RX,
                                 UART_PIN_NO_CHANGE, UART_PIN_NO_CHANGE));
    uart_write_bytes(BELLY_UART, "$N1,H*1B\n", 9);
}

static bool frame_ok(char *line)
{
    char *star = strrchr(line, '*');
    if (line[0] != '$' || star == NULL || strlen(star) != 3) return false;
    unsigned sum = 0;
    for (char *c = line + 1; c < star; c++) sum ^= (unsigned char)*c;
    unsigned got = strtoul(star + 1, NULL, 16);
    *star = '\0';
    return got == sum;
}

static bool apply(char *body, head_state_t *state)
{
    char *save;
    char *version = strtok_r(body, ",", &save);
    char *type = strtok_r(NULL, ",", &save);
    if (version == NULL || type == NULL || strcmp(version, "N1") != 0) return false;
    if (strcmp(type, "P") == 0) {
        char *pose = strtok_r(NULL, ",", &save);
        char *stage = strtok_r(NULL, ",", &save);
        if (pose == NULL || stage == NULL || strlen(pose) >= sizeof(state->pose)) return false;
        int n = atoi(stage);
        if (n < 1 || n > 5) return false;
        strcpy(state->pose, pose);
        state->stage = n;
        return true;
    }
    if (strcmp(type, "V") == 0) {
        char *voice = strtok_r(NULL, ",", &save);
        if (voice == NULL || strlen(voice) >= sizeof(state->voice)) return false;
        strcpy(state->voice, voice);
        return true;
    }
    return false;
}

bool head_link_poll(head_state_t *state, int timeout_ms)
{
    static char line[65];
    static size_t len = 0;
    uint8_t byte;
    while (uart_read_bytes(BELLY_UART, &byte, 1, pdMS_TO_TICKS(timeout_ms)) == 1) {
        if (byte == '$') len = 0;
        if (byte != '\n') {
            if (len < sizeof(line) - 1) line[len++] = (char)byte;
            continue;
        }
        line[len] = '\0';
        len = 0;
        return frame_ok(line) && apply(line + 1, state);
    }
    return false;
}
```

`head_link_poll` renvoie `true` pour chaque ligne valide, après avoir mis à jour `state`, et `false` après `timeout_ms` sans rien de valide. Un `$` au milieu de déchets fait recommencer la ligne, si bien que la tête reprend d’elle-même le prochain bon message.

## Erreurs fréquentes et comment tester

- **Une somme de contrôle calculée en incluant le `$`.** Le XOR ne couvre que les octets entre `$` et `*`. `$N1,H*1B` sert de référence : si votre code obtient une autre valeur pour lui, il en inclut trop.
- **De l’hexadécimal en minuscules.** `%02X` écrit `1B` ; le `strtoul` de la tête accepte les deux casses, mais un outil qui compare des chaînes peut ne pas le faire.
- **Des `\r\n` venant d’un terminal.** Beaucoup de terminaux envoient un retour chariot avant le saut de ligne. Le `strlen(star) != 3` de la tête échoue alors ; réglez le terminal pour qu’il n’envoie que `LF`.
- **La console du ventre sur la liaison.** Si des messages de démarrage apparaissent côté tête, la liaison est sur l’UART0. Elle doit être sur `UART_NUM_1`, sur GPIO4 et GPIO5 (guide 1).
- **Une pose pour laquelle la tête n’a pas de dessin.** Le ventre n’accepte que les cinq noms de pose de narsil-pet et les stades 1 à 5, et la tête les vérifie à nouveau.
- **Les deux cartes muettes après un redémarrage du ventre.** Le ventre envoie aussitôt au démarrage, puis toutes les cinq secondes ; si la tête reste atténuée, croisez les fils de données (TX va sur RX).

Pour tester chaque côté sans l’autre, utilisez un adaptateur USB-série en 3,3 V et un terminal sur le PC. pyserial est fourni avec esptool, donc `miniterm` est déjà là :

```powershell
python -m serial.tools.miniterm --eol LF COM7 115200
```

- **Le ventre seul.** Reliez le RX de l’adaptateur au GPIO4 du ventre et sa GND à la GND du ventre. Une ligne `P` et une ligne `V` apparaissent toutes les cinq secondes. Dites « Hi ESP » et une ligne `$N1,V,listening*40` apparaît aussitôt. Lancez `/narsil movil prueba`, ou terminez un tour dans Claude Code, et la ligne `P` change avec la pose de Narsil.
- **La tête seule.** Reliez le TX de l’adaptateur au GPIO13 de la tête et GND à GND, et son RX au GPIO14. Réinitialisez la tête : `$N1,H*1B` arrive. Tapez `$N1,P,necesita,2*33` et appuyez sur Entrée : la tête dessine Narsil en attente au stade 2. Tapez la même ligne avec une mauvaise somme de contrôle, `*34` : rien ne change.

N’utilisez que des adaptateurs en 3,3 V. Un adaptateur en 5 V peut endommager les broches de l’ESP32.

## Pour aller plus loin

- **La luminosité depuis le ventre.** Un type de message comme `B,<percent>` permettrait au ventre d’atténuer la tête la nuit. Ajoutez-le comme nouveau type dans la version 1 : les anciennes têtes ignorent les types qu’elles ne connaissent pas, parce qu’`apply` renvoie `false` pour eux.
- **Des tapes depuis la tête.** Le QMI8658 peut détecter une tape. Une ligne `T` de la tête vers le ventre pourrait marquer l’alerte la plus récente comme lue sur l’écran du ventre du [guide 9](/fr/bot/belly-ui/). Limitez-vous à des événements, jamais à des requêtes.
- **Un CRC.** Pour des câbles plus longs ou plus de données, un CRC-16 remplace l’octet XOR par quatre chiffres hexadécimaux, dans une nouvelle version, `N2`.
- Le dessin de la tête, l’image en miroir et le fond noir sont l’objet du [guide 11](/fr/bot/holographic-head/).
