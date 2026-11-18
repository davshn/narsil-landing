---
title: La tête holographique
description: 'L’ESP32-S3-LCD-1.3 sous son cube prisme : pourquoi l’image est inversée, pourquoi le noir est transparent, dessiner Narsil par pose depuis l’UART, le rétroéclairage, et vérifier l’alignement.'
route: bot
order: 11
updated: 2026-11-18
---

## Ce que ça fait

La tête est la partie que les gens remarquent en premier. Dans un petit cube de verre au sommet du bot, Narsil flotte dans l’air : son dessin, dans la pose qu’envoie le ventre, sans rien autour d’elle. Quand elle travaille, elle travaille ; quand Claude a besoin de vous, elle vous attend ; quand vous dites « Hi ESP », un petit point bleu sous elle montre qu’elle écoute.

C’est un écran de 1,3 pouce et un prisme. Ce guide explique pourquoi l’illusion fonctionne, ce que le firmware doit faire pour elle (inverser l’image, garder le fond noir), comment il dessine chaque pose qui arrive par l’UART du guide 10, et comment vérifier que l’image est dans le bon sens.

## Comment ça marche à l’intérieur

### La carte

La tête est l’ESP32-S3-LCD-1.3-C du guide 1 : un ESP32-S3R8 avec 8 Mo de PSRAM et 16 Mo de flash, et un écran IPS de 1,3 pouce de 240 × 240 pixels piloté par un contrôleur ST7789 en SPI. SpotPear vend la version avec le cube sous le nom de [3D transparent prism display](https://spotpear.com/wiki/ESP32-S3-1.3-inch-LCD-ST7789-240x240-3D-Display-Transparent-Screen-Refractive-Prism-Mini-TV.html), et Waveshare documente la carte sur son [wiki](https://www.waveshare.com/wiki/ESP32-S3-LCD-1.3).

Les broches de l’écran viennent du schéma de Waveshare, `ESP32S3_1.3inch.pdf`, lié depuis les deux pages :

| Signal                  | GPIO |
| ----------------------- | ---- |
| Horloge SPI (CLK)       | 40   |
| Données SPI (MOSI)      | 41   |
| Sélection de puce (CS)  | 39   |
| Données/commande (DC)   | 38   |
| Réinitialisation (RES)  | 42   |
| Rétroéclairage (BL_PWM) | 20   |

Aucune n’entre en conflit avec l’UART du guide 10 (GPIO13 et GPIO14), la centrale inertielle (GPIO45 à GPIO48) ou la carte TF (GPIO16, GPIO17, GPIO18 et GPIO21, d’après le même schéma). La broche du rétroéclairage pilote les LED de l’écran à travers un transistor : un signal PWM sur elle règle donc la luminosité.

### Pourquoi le visage flotte

L’illusion est ancienne : on l’appelle le fantôme de Pepper, d’après une illusion de théâtre du XIXe siècle où un acteur caché sous la scène apparaissait comme un fantôme reflété dans une grande plaque de verre. Ici, le verre est le cube. L’écran est posé à plat dessous, et une face diagonale à l’intérieur du cube reflète l’écran vers vous, tandis que vous voyez toujours à travers le verre le bureau derrière lui. Votre œil prend le reflet pour un objet qui se tient dans le cube.

Deux conséquences en découlent, et toutes deux sont dans le firmware.

### Le noir est transparent

Un reflet ne fait qu’ajouter de la lumière. Un pixel clair se reflète clair, et un pixel noir ne reflète rien du tout : à travers le verre, vous voyez donc ce qui se trouve derrière le cube. Sur cet écran, **le noir est transparent** : un fond noir est ce qui fait flotter Narsil sans rectangle autour d’elle. Toute autre couleur de fond, même un gris foncé, montre les bords de l’écran comme un carré faiblement lumineux.

La tête efface donc chaque image en noir pur (RGB565 `0x0000`) et n’y dessine que Narsil. Ses dessins de narsil-pet existent en deux versions par pose, `-claro` pour les fonds clairs et `-oscuro` pour les fonds sombres ; la tête utilise `-oscuro`, fait pour un fond sombre, les mêmes fichiers que nomme l’URL `art` du guide 10. Les PNG ont des bords transparents, et ils sont aplatis sur du noir lors de leur conversion, si bien que leurs contours adoucis se fondent dans le noir au lieu de former un halo.

### L’image est inversée

Un miroir inverse l’image selon un axe : tenez une page de texte devant un miroir et elle se lit à l’envers. Le cube est un miroir, donc une image dessinée normalement sur l’écran paraît inversée dans le cube. Narsil regarde du mauvais côté, et tout texte est illisible. Le firmware dessine l’image déjà inversée, pour que le reflet la remette à l’endroit.

Waveshare livre ses démos en deux compilations pour cette raison : la page de SpotPear liste « AstronautClock-NoPrism and AstronautClock-Prism » (AstronautClock-NoPrism et AstronautClock-Prism), et indique que la seconde convient à la version avec prisme.

Le pilote LCD d’ESP-IDF fait l’inversion dans le contrôleur de l’écran, sans aucun coût pour le processeur. D’après la [référence de l’API LCD](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/lcd/index.html) :

```c
esp_err_t esp_lcd_panel_mirror(esp_lcd_panel_handle_t panel, bool mirror_x, bool mirror_y);
```

« Mirror the LCD panel on specific axis. » (inverser le panneau LCD selon un axe donné). Dans le pilote ST7789 d’ESP-IDF (`esp_lcd_panel_st7789.c`), l’appel ne fait que changer des bits du registre `MADCTL` du contrôleur, qui fixe l’ordre dans lequel le contrôleur écrit les pixels dans sa mémoire. L’image qu’envoie le firmware reste la même ; l’écran l’affiche inversée.

L’axe dépend de la façon dont l’écran est placé sous le prisme : la tête démarre donc avec `mirror_x` activé, et la vérification de l’alignement ci-dessous vous dit si c’est juste. L’écran de démarrage de la tête existe pour cette vérification : un carré rouge dans son coin supérieur gauche pendant trois secondes.

### Les dessins de Narsil dans le firmware

La tête n’a ni réseau ni système de fichiers d’où récupérer des images : les dessins vont donc dans le firmware lui-même :

1. Chacun des fichiers `-oscuro.png` de narsil-pet pour les cinq poses (`parada`, `trabajando`, `necesita`, `terminado`, `error`) aux cinq stades est converti avec le convertisseur d’images de LVGL, `scripts/LVGLImage.py` dans le [dépôt LVGL](https://github.com/lvgl/lvgl). Les options sont `--ofmt BIN` (un fichier binaire), `--cf RGB565_SWAPPED` (une couleur sur 16 bits dont les deux octets sont dans l’ordre qu’attend le ST7789 en SPI) et `--background 0x000000` (la couleur dans laquelle se fondent les bords transparents, pour un format sans alpha).
2. Les 25 fichiers sont réunis en un seul, `faces.bin`, dans un ordre fixe : du stade 1 au stade 5, et les cinq poses dans l’ordre ci-dessus à chaque stade.
3. Le système de compilation d’ESP-IDF l’embarque : `EMBED_FILES faces.bin` dans `idf_component_register` place le fichier en flash et fournit deux symboles, `_binary_faces_bin_start` et `_binary_faces_bin_end`, comme le décrit sa [documentation du système de compilation](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-guides/build-system.html).

Chaque fichier converti commence par l’en-tête d’image de 12 octets de LVGL 9 (`lv_image_header_t` dans `src/draw/lv_image_dsc.h`) : un octet magique, le format de couleur, des drapeaux, puis la largeur, la hauteur et le pas (stride) sous forme de nombres de 16 bits en petit-boutiste aux octets 4, 6 et 8. La tête parcourt `faces.bin` en lisant chaque en-tête et en sautant `12 + stride × height` octets jusqu’à l’image suivante : elle n’a donc besoin d’aucune table d’index. Les dessins de Narsil font 150 pixels de haut et de 79 à 106 de large ; 25 d’entre eux occupent moins de 800 Ko, une petite partie des 16 Mo de flash de la tête.

Les dessins sont ceux de narsil-pet, sous licence GPL-3.0-or-later, et `faces.bin` en est tiré : il garde donc cette licence et un lien vers [davshn/narsil-pet](https://github.com/davshn/narsil-pet) dans les notes du dossier `head/`. Le code propre de la tête est sous MIT, comme les exemples du site.

### Dessiner une image

La tête garde une image de 240 × 240 en mémoire compatible DMA (`heap_caps_malloc` avec `MALLOC_CAP_DMA`), soit 115 200 octets. Pour dessiner, elle remplit l’image de noir, copie le dessin de Narsil au milieu ligne par ligne, ajoute le point vocal, et envoie l’image entière avec `esp_lcd_panel_draw_bitmap`.

Cet appel revient avant la fin du transfert : le pilote SPI envoie les octets en arrière-plan, par DMA, directement depuis le tampon d’image. Modifier le tampon avant la fin du transfert enverrait un mélange de deux images ; la tête enregistre donc `on_color_trans_done`, une fonction de rappel que le pilote appelle quand le transfert se termine, et qui libère un sémaphore FreeRTOS. La fonction de dessin attend ce sémaphore avant de revenir, si bien que l’image suivante n’écrase jamais une image encore en route.

La tête ne redessine que lorsque la pose, le stade ou l’état vocal change. Entre deux changements, l’écran garde la dernière image de lui-même, et le processeur attend sur l’UART.

### Le point vocal

Le message `V` du guide 10 indique si Xiaozhi écoute ou parle. La tête le montre par un petit point sous Narsil : bleu (`#3B8BFF`, la couleur de narsil-pet pour le travail) pendant l’écoute, vert (`#22B573`, sa couleur pour terminé) pendant la parole, et rien au repos. Un point, et non un second dessin, parce que les dessins n’ont pas de pose « écoute » et que le point se voit depuis l’autre bout de la pièce.

### Le rétroéclairage

Les LED de l’écran sont sur GPIO20, à travers un transistor. La tête pilote la broche avec le périphérique PWM [LEDC](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/ledc.html) d’ESP-IDF à 5 kHz avec une résolution de 10 bits : le rapport cyclique, de 0 à 1023, est donc la luminosité. Elle tourne à pleine luminosité tant que des lignes arrivent, et descend à 20 % après 15 secondes de silence (guide 10) : le ventre est éteint ou le fil est mal branché, et une Narsil atténuée le dit sans s’éteindre. Le rétroéclairage reste éteint jusqu’à ce que la première image soit dessinée, si bien que l’écran ne montre jamais la mémoire aléatoire du contrôleur au démarrage.

## Comment on l’a demandé à l’IA

Le rôle de la tête figurait dans la première description du bot par l’auteur ou l’autrice :

> la cabeza va a ser una apntalla holografica que solo sea la cara de narsil

Traduction en français : la tête sera un écran holographique qui ne soit que le visage de Narsil.

« Que le visage de Narsil » est tout le cahier des charges : ni horloge, ni texte, ni menus sur la tête. L’IA a lu la page de SpotPear, qui vend la carte avec son prisme, ainsi que le wiki et le schéma de Waveshare, qui donnent le contrôleur et les broches de l’écran. Les deux règles de l’hologramme, l’image inversée et le fond noir, viennent du fonctionnement du prisme et du fait que Waveshare livre des démos « Prism » séparées ; ce n’étaient pas des choix à faire par l’auteur ou l’autrice.

Ce qu’il fallait dessiner était la proposition de l’IA : Narsil a déjà des dessins peints pour chaque état et chaque stade dans narsil-pet, les mêmes images qu’utilisent les alertes du téléphone ; la tête montre donc celles-là au lieu d’un nouveau dessin. La façon dont la tête apprend la pose avait été réglée plus tôt par la réponse de l’auteur ou de l’autrice, « Por cable desde la panza » (par câble depuis le ventre), que le guide 10 a transformée en protocole.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas la conversation qui a servi à construire le bot.

> J’ai une Waveshare ESP32-S3-LCD-1.3 (ST7789, 240×240, SPI) sous un cube prisme à fantôme de Pepper. Lis le wiki et le schéma de Waveshare pour les broches du LCD et du rétroéclairage, ainsi que la documentation `esp_lcd` d’ESP-IDF 6. Écris une application ESP-IDF qui initialise le ST7789 avec `esp_lcd_new_panel_st7789`, inverse l’image avec `esp_lcd_panel_mirror`, garde le fond en noir pur, règle le rétroéclairage avec LEDC, et dessine l’une de 25 images RGB565 embarquées choisie selon une pose et un stade reçus par l’UART. Attends `on_color_trans_done` avant de réutiliser le tampon d’image. Explique pourquoi l’image doit être inversée et pourquoi le noir paraît transparent, et comment je vérifie l’alignement.

## Le code minimal

D’abord les dessins. Depuis un dossier contenant un clone de narsil-pet et de LVGL (pour `LVGLImage.py`, qui demande `pip install pypng lz4`), dans PowerShell :

```powershell
$poses = 'parada', 'trabajando', 'necesita', 'terminado', 'error'
$files = @()
foreach ($stage in 1..5) {
  $folder = if ($stage -gt 1) { "narsil-pet/assets/etapa$stage" } else { 'narsil-pet/assets' }
  foreach ($pose in $poses) {
    python lvgl/scripts/LVGLImage.py --ofmt BIN --cf RGB565_SWAPPED --background 0x000000 `
      -o faces --name "s${stage}_$pose" "$folder/$pose-oscuro.png"
    $files += "faces/s${stage}_$pose.bin"
  }
}
python -c "import sys; open('narsil-bot/head/main/faces.bin','wb').write(b''.join(open(f,'rb').read() for f in sys.argv[1:]))" $files
```

Le `main/CMakeLists.txt` de la tête :

```cmake
idf_component_register(SRCS "main.c" "head_link.c"
                       INCLUDE_DIRS "."
                       EMBED_FILES "faces.bin")
```

`head_link.c` est le côté tête du guide 10. `main.c`, en C (MIT) :

```c
#include <stdbool.h>
#include <string.h>
#include "driver/ledc.h"
#include "driver/spi_master.h"
#include "esp_heap_caps.h"
#include "esp_lcd_panel_io.h"
#include "esp_lcd_panel_ops.h"
#include "esp_lcd_panel_vendor.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

#define LCD_HOST SPI2_HOST
#define PIN_CLK  40
#define PIN_MOSI 41
#define PIN_CS   39
#define PIN_DC   38
#define PIN_RST  42
#define PIN_BL   20
#define SIZE     240

typedef struct {
    char pose[16];
    int stage;
    char voice[12];
} head_state_t;

void head_link_init(void);
bool head_link_poll(head_state_t *state, int timeout_ms);

extern const uint8_t faces_start[] asm("_binary_faces_bin_start");
extern const uint8_t faces_end[] asm("_binary_faces_bin_end");

static const char *const POSES[] = {"parada", "trabajando", "necesita", "terminado", "error"};
static esp_lcd_panel_handle_t panel;
static SemaphoreHandle_t sent;
static uint16_t *frame;

static bool on_sent(esp_lcd_panel_io_handle_t io, esp_lcd_panel_io_event_data_t *data, void *ctx)
{
    BaseType_t woken = pdFALSE;
    xSemaphoreGiveFromISR(sent, &woken);
    return woken == pdTRUE;
}

static uint16_t color(uint32_t rgb)
{
    uint16_t c = ((rgb >> 8) & 0xF800) | ((rgb >> 5) & 0x07E0) | ((rgb >> 3) & 0x001F);
    return (uint16_t)((c >> 8) | (c << 8));
}

static void backlight(int percent)
{
    ledc_set_duty(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0, 1023 * percent / 100);
    ledc_update_duty(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0);
}

static void face_init(void)
{
    ledc_timer_config_t timer = {
        .speed_mode = LEDC_LOW_SPEED_MODE, .duty_resolution = LEDC_TIMER_10_BIT,
        .timer_num = LEDC_TIMER_0, .freq_hz = 5000, .clk_cfg = LEDC_AUTO_CLK,
    };
    ESP_ERROR_CHECK(ledc_timer_config(&timer));
    ledc_channel_config_t channel = {
        .gpio_num = PIN_BL, .speed_mode = LEDC_LOW_SPEED_MODE,
        .channel = LEDC_CHANNEL_0, .timer_sel = LEDC_TIMER_0, .duty = 0,
    };
    ESP_ERROR_CHECK(ledc_channel_config(&channel));

    spi_bus_config_t bus = {
        .sclk_io_num = PIN_CLK, .mosi_io_num = PIN_MOSI, .miso_io_num = -1,
        .quadwp_io_num = -1, .quadhd_io_num = -1, .max_transfer_sz = SIZE * SIZE * 2,
    };
    ESP_ERROR_CHECK(spi_bus_initialize(LCD_HOST, &bus, SPI_DMA_CH_AUTO));
    sent = xSemaphoreCreateBinary();
    esp_lcd_panel_io_handle_t io;
    esp_lcd_panel_io_spi_config_t io_config = {
        .dc_gpio_num = PIN_DC, .cs_gpio_num = PIN_CS, .pclk_hz = 20 * 1000 * 1000,
        .lcd_cmd_bits = 8, .lcd_param_bits = 8, .spi_mode = 0, .trans_queue_depth = 10,
        .on_color_trans_done = on_sent,
    };
    ESP_ERROR_CHECK(esp_lcd_new_panel_io_spi((esp_lcd_spi_bus_handle_t)LCD_HOST, &io_config, &io));
    esp_lcd_panel_dev_config_t panel_config = {
        .reset_gpio_num = PIN_RST, .rgb_ele_order = LCD_RGB_ELEMENT_ORDER_RGB, .bits_per_pixel = 16,
    };
    ESP_ERROR_CHECK(esp_lcd_new_panel_st7789(io, &panel_config, &panel));
    ESP_ERROR_CHECK(esp_lcd_panel_reset(panel));
    ESP_ERROR_CHECK(esp_lcd_panel_init(panel));
    ESP_ERROR_CHECK(esp_lcd_panel_invert_color(panel, true));
    ESP_ERROR_CHECK(esp_lcd_panel_mirror(panel, true, false));
    ESP_ERROR_CHECK(esp_lcd_panel_disp_on_off(panel, true));
    frame = heap_caps_malloc(SIZE * SIZE * 2, MALLOC_CAP_DMA);
}

static const uint8_t *find_face(const head_state_t *s, int *w, int *h, int *stride)
{
    int pose = -1;
    for (int i = 0; i < 5; i++) {
        if (strcmp(s->pose, POSES[i]) == 0) pose = i;
    }
    if (pose < 0) return NULL;
    int index = (s->stage - 1) * 5 + pose;
    const uint8_t *p = faces_start;
    for (int i = 0; p + 12 <= faces_end; i++) {
        *w = p[4] | p[5] << 8;
        *h = p[6] | p[7] << 8;
        *stride = p[8] | p[9] << 8;
        if (i == index) return p + 12;
        p += 12 + *stride * *h;
    }
    return NULL;
}

static void draw(const head_state_t *s, bool test)
{
    memset(frame, 0, SIZE * SIZE * 2);
    int w, h, stride;
    const uint8_t *pixels = find_face(s, &w, &h, &stride);
    if (pixels != NULL && w <= SIZE && h <= SIZE) {
        int x0 = (SIZE - w) / 2, y0 = (SIZE - h) / 2 - 10;
        for (int y = 0; y < h; y++) {
            memcpy(&frame[(y0 + y) * SIZE + x0], pixels + y * stride, w * 2);
        }
    }
    uint32_t dot = strcmp(s->voice, "listening") == 0 ? 0x3B8BFF
                 : strcmp(s->voice, "speaking") == 0  ? 0x22B573 : 0;
    for (int dy = -6; dot && dy <= 6; dy++) {
        for (int dx = -6; dx <= 6; dx++) {
            if (dx * dx + dy * dy <= 36) frame[(222 + dy) * SIZE + 120 + dx] = color(dot);
        }
    }
    for (int y = 8; test && y < 28; y++) {
        for (int x = 8; x < 28; x++) frame[y * SIZE + x] = color(0xFF0000);
    }
    esp_lcd_panel_draw_bitmap(panel, 0, 0, SIZE, SIZE, frame);
    xSemaphoreTake(sent, portMAX_DELAY);
}

static bool same(const head_state_t *a, const head_state_t *b)
{
    return strcmp(a->pose, b->pose) == 0 && a->stage == b->stage && strcmp(a->voice, b->voice) == 0;
}

void app_main(void)
{
    head_state_t state = {"parada", 1, "idle"};
    face_init();
    draw(&state, true);
    backlight(100);
    vTaskDelay(pdMS_TO_TICKS(3000));
    draw(&state, false);
    head_state_t shown = state;
    head_link_init();

    int64_t last_line = esp_timer_get_time();
    bool dim = false;
    while (true) {
        if (head_link_poll(&state, 200)) {
            last_line = esp_timer_get_time();
            if (dim) { backlight(100); dim = false; }
            if (!same(&state, &shown)) { draw(&state, false); shown = state; }
        } else if (!dim && esp_timer_get_time() - last_line > 15 * 1000 * 1000) {
            backlight(20);
            dim = true;
        }
    }
}
```

Compilez-la et flashez-la depuis le dossier `head/` avec les commandes du guide 2 (`idf.py set-target esp32s3`, `idf.py build`, puis `idf.py flash` via le pont série).

## Erreurs fréquentes et comment tester

- **Un carré visible autour de Narsil.** Le fond n’est pas d’un noir pur. Vérifiez que l’image est effacée avec des zéros et que les dessins ont été convertis avec `--background 0x000000`.
- **Narsil regarde du mauvais côté, ou le carré rouge est dans le mauvais coin.** L’axe d’inversion est faux ; voyez la vérification de l’alignement ci-dessous.
- **L’image décalée après l’inversion de l’autre axe, avec une bande de bruit.** La mémoire du ST7789 fait 240 × 320, plus haute que cet écran. Quand l’axe inversé est celui de 320 pixels, la fenêtre visible se déplace ; `esp_lcd_panel_set_gap(panel, 0, 80)` la remet en place.
- **Une image en négatif.** Le noir paraît blanc et les couleurs sont inversées : passez `esp_lcd_panel_invert_color` à `false`. Beaucoup de panneaux IPS ST7789 demandent `true`.
- **Le rouge et le bleu échangés.** Utilisez `LCD_RGB_ELEMENT_ORDER_BGR` dans `panel_config`.
- **Des couleurs mouchetées.** Les dessins ont été convertis avec `--cf RGB565` au lieu de `RGB565_SWAPPED` : les deux octets de chaque pixel sont donc dans le mauvais ordre pour la liaison SPI.
- **Une image déchirée ou mélangée.** Le tampon d’image a été modifié alors que le transfert précédent était encore en cours. Gardez le `xSemaphoreTake` après `esp_lcd_panel_draw_bitmap`.
- **L’écran reste sombre.** La broche du rétroéclairage est l’entrée du transistor : un niveau haut l’allume donc ; si le vôtre reste sombre à 100 %, vérifiez GPIO20 sur le schéma de la révision de votre carte.

Pour vérifier l’alignement, posez le cube sur l’écran et regardez-le de face, à hauteur des yeux, comme le bot sera posé sur le bureau :

1. Alimentez la tête seule. Pendant trois secondes, Narsil se tient au milieu avec un carré rouge à côté d’elle.
2. Le carré rouge doit apparaître dans le coin **supérieur gauche** tel que vous le voyez dans le cube. S’il est en haut à droite, l’image n’est pas inversée (ou l’est deux fois) : inversez `mirror_x`. S’il est en bas à gauche, c’est le mauvais axe qui est inversé : utilisez `esp_lcd_panel_mirror(panel, false, true)` et le décalage ci-dessus.
3. Narsil doit se tenir droite et être centrée dans le cube. Si elle est trop basse ou trop haute, changez le `- 10` de `y0`, qui la remonte un peu pour laisser de la place au point vocal.
4. Regardez le cube de côté : vous devriez voir le bureau à travers lui, sans bord lumineux. Une lueur signifie que quelque chose à l’écran n’est pas noir.

Branchez ensuite le ventre. En moins de cinq secondes, la tête affiche la vraie pose de Narsil ; dites « Hi ESP » et le point bleu apparaît. Débranchez le fil de données : après 15 secondes, la tête s’atténue, et le rebrancher rend la pleine luminosité à la ligne suivante.

## Pour aller plus loin

- **L’animation.** narsil-pet a aussi des boucles animées pour certaines poses (`hooks/art/animated.ts`, `assets/anim`). Deux ou trois images par pose, dessinées tour à tour avec la même fonction `draw`, la feraient bouger ; la flash a de la place pour beaucoup plus d’images.
- **LVGL sur la tête.** Pour du texte ou des effets, LVGL peut aussi tourner sur la tête, via `esp_lvgl_port`, avec le même panneau inversé en dessous.
- **La centrale inertielle.** Le QMI8658 peut détecter quand quelqu’un tape sur le bot. La section « Pour aller plus loin » du guide 10 décrit comment la tête le renverrait sans enfreindre la règle selon laquelle elle ne demande rien au ventre.
- **La luminosité la nuit.** Plus atténué, c’est souvent mieux dans une pièce sombre : le reflet est plus facile à voir et le noir plus transparent. Un message de luminosité depuis le ventre est l’étape suivante après le [guide 10](/fr/bot/uart-protocol/).
- Ce que le bot garde, et ce qui quitte votre réseau, fait l’objet du [guide 12](/fr/bot/secrets-privacy/).
