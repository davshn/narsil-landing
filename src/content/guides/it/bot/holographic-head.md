---
title: La testa olografica
description: "L'ESP32-S3-LCD-1.3 sotto il suo cubo prisma: perché l'immagine è specchiata, perché il nero è trasparente, Narsil disegnata per posa dalla UART, la retroilluminazione e come verificare l'allineamento."
route: bot
order: 11
updated: 2026-11-18
---

## Cosa fa

La testa è la parte che si nota per prima. Dentro un piccolo cubo di vetro in cima al bot, Narsil fluttua nell'aria: il suo disegno, nella posa che invia la pancia, senza niente intorno. Quando lavora, è al lavoro; quando Claude ha bisogno di te, ti sta aspettando; quando dici "Hi ESP", un piccolo punto blu sotto di lei mostra che sta ascoltando.

È uno schermo da 1,3 pollici e un prisma. Questa guida spiega perché il trucco funziona, cosa deve fare il firmware perché funzioni (specchiare l'immagine, tenere lo sfondo nero), come disegna ogni posa che arriva tramite la UART della guida 10, e come verificare che l'immagine sia dal verso giusto.

## Come funziona dentro

### La scheda

La testa è l'ESP32-S3-LCD-1.3-C della guida 1: un ESP32-S3R8 con 8 MB di PSRAM e 16 MB di flash, e uno schermo IPS da 1,3 pollici di 240 × 240 pixel pilotato da un controller ST7789 tramite SPI. SpotPear vende la versione con il cubo come [3D transparent prism display](https://spotpear.com/wiki/ESP32-S3-1.3-inch-LCD-ST7789-240x240-3D-Display-Transparent-Screen-Refractive-Prism-Mini-TV.html), e Waveshare documenta la scheda nella sua [wiki](https://www.waveshare.com/wiki/ESP32-S3-LCD-1.3).

I pin dello schermo vengono dallo schema elettrico di Waveshare, `ESP32S3_1.3inch.pdf`, collegato da entrambe le pagine:

| Segnale                     | GPIO |
| --------------------------- | ---- |
| Clock SPI (CLK)             | 40   |
| Dati SPI (MOSI)             | 41   |
| Chip select (CS)            | 39   |
| Dati/comando (DC)           | 38   |
| Reset (RES)                 | 42   |
| Retroilluminazione (BL_PWM) | 20   |

Nessuno di loro si scontra con la UART della guida 10 (GPIO13 e GPIO14), con l'IMU (da GPIO45 a GPIO48) o con la scheda TF (GPIO16, GPIO17, GPIO18 e GPIO21, secondo lo stesso schema). Il pin della retroilluminazione pilota i LED dello schermo tramite un transistor, quindi un segnale PWM su di esso imposta la luminosità.

### Perché la faccia fluttua

Il trucco è vecchio: si chiama fantasma di Pepper, da un'illusione teatrale del XIX secolo in cui un attore nascosto sotto il palco appariva come un fantasma riflesso in una grande lastra di vetro. Qui il vetro è il cubo. Lo schermo sta in orizzontale sotto di esso, e una faccia diagonale dentro il cubo riflette lo schermo verso di te, mentre continui a vedere attraverso il vetro la scrivania dietro. Il tuo occhio prende il riflesso per un oggetto che sta dentro il cubo.

Ne seguono due conseguenze, ed entrambe sono nel firmware.

### Il nero è trasparente

Un riflesso aggiunge solo luce. Un pixel luminoso riflette luminoso, e un pixel nero non riflette niente, quindi attraverso il vetro vedi ciò che c'è dietro il cubo. Su questo schermo, **il nero è trasparente**: uno sfondo nero è ciò che fa fluttuare Narsil senza un rettangolo intorno. Qualsiasi altro colore di sfondo, anche un grigio scuro, mostra i bordi dello schermo come un debole quadrato luminoso.

Quindi la testa pulisce ogni frame con nero puro (RGB565 `0x0000`) e ci disegna sopra solo Narsil. La sua arte di narsil-pet arriva in due versioni per posa, `-claro` per gli sfondi chiari e `-oscuro` per quelli scuri; la testa usa `-oscuro`, fatta per uno sfondo scuro, gli stessi file che nomina l'URL di `art` della guida 10. I PNG hanno bordi trasparenti, e vengono appiattiti sul nero quando vengono convertiti, così i loro contorni morbidi si fondono nel nero invece di formare un alone.

### L'immagine è specchiata

Uno specchio inverte l'immagine lungo un asse: tieni una pagina di testo davanti a uno specchio e si legge al contrario. Il cubo è uno specchio, quindi un'immagine disegnata normalmente sullo schermo appare invertita dentro il cubo. Narsil guarda dalla parte sbagliata, e qualsiasi testo è illeggibile. Il firmware disegna l'immagine già specchiata, così il riflesso la rimette dritta.

Waveshare distribuisce le sue demo in due build per questo motivo: la pagina di SpotPear elenca "AstronautClock-NoPrism and AstronautClock-Prism", e dice che la seconda è adatta alla versione con prisma.

Il driver LCD di ESP-IDF fa il ribaltamento nel controller dello schermo, senza costo per il processore. Dal [riferimento dell'API LCD](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/lcd/index.html):

```c
esp_err_t esp_lcd_panel_mirror(esp_lcd_panel_handle_t panel, bool mirror_x, bool mirror_y);
```

"Mirror the LCD panel on specific axis." (Specchia il pannello LCD su un asse specifico.) Nel driver ST7789 di ESP-IDF (`esp_lcd_panel_st7789.c`), la chiamata cambia solo dei bit del registro `MADCTL` del controller, che imposta l'ordine in cui il controller scrive i pixel nella sua memoria. Il frame che invia il firmware resta lo stesso; lo schermo lo mostra ribaltato.

Quale asse dipende da come lo schermo sta sotto il prisma, quindi la testa parte con `mirror_x` impostato e la verifica dell'allineamento più sotto ti dice se è giusto. La schermata di avvio della testa esiste per quella verifica: un quadrato rosso nel suo angolo in alto a sinistra per tre secondi.

### L'arte di Narsil nel firmware

La testa non ha rete né un file system da cui prendere le immagini, quindi l'arte va nel firmware stesso:

1. Ognuno dei file `-oscuro.png` di narsil-pet per le cinque pose (`parada`, `trabajando`, `necesita`, `terminado`, `error`) ai cinque stadi viene convertito con il convertitore di immagini di LVGL, `scripts/LVGLImage.py` nel [repository di LVGL](https://github.com/lvgl/lvgl). Le opzioni sono `--ofmt BIN` (un file binario), `--cf RGB565_SWAPPED` (colore a 16 bit con i suoi due byte nell'ordine che l'ST7789 si aspetta tramite SPI) e `--background 0x000000` (il colore in cui si fondono i bordi trasparenti, per un formato senza alfa).
2. I 25 file vengono uniti in uno, `faces.bin`, in un ordine fisso: dallo stadio 1 al 5, e le cinque pose nell'ordine sopra dentro ogni stadio.
3. Il sistema di build di ESP-IDF lo incorpora: `EMBED_FILES faces.bin` in `idf_component_register` mette il file nella flash e dà due simboli, `_binary_faces_bin_start` e `_binary_faces_bin_end`, come descrive la sua [documentazione del sistema di build](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-guides/build-system.html).

Ogni file convertito inizia con l'header di immagine di 12 byte di LVGL 9 (`lv_image_header_t` in `src/draw/lv_image_dsc.h`): un byte magico, il formato colore, dei flag, poi la larghezza, l'altezza e lo stride come numeri little-endian a 16 bit ai byte 4, 6 e 8. La testa percorre `faces.bin` leggendo ogni header e saltando `12 + stride × height` byte fino all'immagine successiva, quindi non le serve una tabella di indice. I disegni di Narsil sono alti 150 pixel e larghi da 79 a 106; 25 di loro occupano meno di 800 KB, una piccola parte dei 16 MB di flash della testa.

L'arte è di narsil-pet, con licenza GPL-3.0-or-later, e `faces.bin` è fatto a partire da essa, quindi mantiene quella licenza e un link a [davshn/narsil-pet](https://github.com/davshn/narsil-pet) nelle note della cartella `head/`. Il codice della testa è MIT, come gli esempi del sito.

### Disegnare un frame

La testa tiene un frame di 240 × 240 in memoria adatta al DMA (`heap_caps_malloc` con `MALLOC_CAP_DMA`), 115.200 byte. Per disegnare, riempie il frame di nero, copia l'immagine di Narsil al centro riga per riga, aggiunge il punto della voce e invia l'intero frame con `esp_lcd_panel_draw_bitmap`.

Quella chiamata torna prima che il trasferimento finisca: il driver SPI invia i byte in background, con il DMA, direttamente dal frame buffer. Cambiare il buffer prima che il trasferimento finisca invierebbe un misto di due frame, quindi la testa registra `on_color_trans_done`, una callback che il driver chiama quando il trasferimento finisce, e che rilascia un semaforo FreeRTOS. La funzione di disegno aspetta quel semaforo prima di tornare, così il frame successivo non sovrascrive mai uno ancora in viaggio.

La testa ridisegna solo quando la posa, lo stadio o lo stato vocale cambiano. Tra un cambio e l'altro lo schermo tiene da solo l'ultimo frame, e il processore aspetta sulla UART.

### Il punto della voce

Il messaggio `V` della guida 10 dice se Xiaozhi sta ascoltando o parlando. La testa lo mostra come un piccolo punto sotto Narsil: blu (`#3B8BFF`, il colore di narsil-pet per al lavoro) mentre ascolta, verde (`#22B573`, il suo colore per finito) mentre parla, e niente quando è inattiva. Un punto, non un secondo disegno, perché l'arte non ha una posa "listening" e il punto si vede dall'altra parte della stanza.

### La retroilluminazione

I LED dello schermo sono sul GPIO20, tramite un transistor. La testa pilota il pin con la periferica PWM [LEDC](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/ledc.html) di ESP-IDF a 5 kHz con risoluzione a 10 bit, quindi il duty cycle, da 0 a 1023, è la luminosità. Funziona a piena luminosità mentre arrivano righe, e scende al 20% dopo 15 secondi di silenzio (guida 10): la pancia è spenta o il filo è staccato, e una Narsil attenuata lo dice senza spegnersi. La retroilluminazione resta spenta finché non viene disegnato il primo frame, così all'avvio lo schermo non mostra mai per un attimo la memoria casuale del controller.

## Costruiscila con Claude

Chiedi a Claude il firmware della testa: un'app ESP-IDF che disegni sullo schermo ST7789 sotto il cubo prismatico la posa di Narsil, ricevuta tramite la UART. L'unica idea che deve fare bene è che il cubo è uno specchio: l'immagine va disegnata specchiata, e tutto ciò che non è Narsil deve essere nero puro, perché il nero è ciò che appare trasparente.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è la conversazione usata per preparare il bot.

> Ho una Waveshare ESP32-S3-LCD-1.3 (ST7789, 240×240, SPI) sotto un cubo prisma a fantasma di Pepper. Leggi la wiki e lo schema elettrico di Waveshare per i pin dell'LCD e della retroilluminazione, e la documentazione `esp_lcd` di ESP-IDF 6. Scrivi un'app ESP-IDF che inizializzi l'ST7789 con `esp_lcd_new_panel_st7789`, specchi l'immagine con `esp_lcd_panel_mirror`, tenga lo sfondo nero puro, imposti la retroilluminazione con LEDC e disegni una di 25 immagini RGB565 incorporate, scelta da una posa e uno stadio ricevuti tramite UART. Aspetta `on_color_trans_done` prima di riusare il frame buffer. Spiega perché l'immagine deve essere specchiata e perché il nero sembra trasparente, e come verifico l'allineamento.

### Cosa controllare nella risposta di Claude

1. L'immagine è specchiata nel controller dello schermo con `esp_lcd_panel_mirror`, partendo con `mirror_x` impostato, e la schermata di avvio mostra un quadrato rosso nell'angolo in alto a sinistra per tre secondi, così puoi controllare l'asse.
2. Ogni frame viene ripulito con il nero puro (`0x0000`), e l'arte viene convertita con `--background 0x000000` e `--cf RGB565_SWAPPED`, non con il semplice `RGB565`.
3. I pin corrispondono allo schema di Waveshare: CLK su GPIO40, MOSI su GPIO41, CS su GPIO39, DC su GPIO38, reset su GPIO42 e retroilluminazione su GPIO20. Nessuno di loro è GPIO13 o GPIO14, la UART della guida 10.
4. Dopo `esp_lcd_panel_draw_bitmap`, il codice aspetta che `on_color_trans_done` rilasci il suo semaforo prima di toccare di nuovo il frame buffer.
5. La testa ridisegna solo quando cambiano la posa, lo stadio o lo stato vocale. La retroilluminazione resta spenta fino al primo frame, e scende al 20% dopo 15 secondi senza una riga dalla pancia.

Se un controllo fallisce, di' a Claude cosa vedi: "Narsil guarda dalla parte sbagliata, e il quadrato rosso è nell'angolo in alto a destra del cubo".

### Come l'ha chiesta l'autore

Il compito della testa era nella prima descrizione del bot fatta da chi ha creato Narsil:

> la cabeza va a ser una apntalla holografica que solo sea la cara de narsil

In italiano: "la testa sarà uno schermo olografico che sia solo la faccia di Narsil".

"Solo la faccia di Narsil" è l'intero brief di design: niente orologio, niente testo, niente menu sulla testa. L'IA ha letto la pagina di SpotPear, che vende la scheda con il suo prisma, e la wiki e lo schema di Waveshare, che danno il controller e i pin dello schermo. Le due regole dell'ologramma, l'immagine specchiata e lo sfondo nero, sono venute da come funziona il prisma e dal fatto che Waveshare distribuisce demo "Prism" separate; non erano scelte che spettassero a chi ha creato Narsil.

Cosa disegnare è stata una proposta dell'IA: Narsil ha già un'arte dipinta per ogni stato e stadio in narsil-pet, le stesse immagini che usano gli avvisi sul telefono, quindi la testa mostra quelle invece di un nuovo disegno. Come la testa venga a sapere la posa era stato deciso prima dalla risposta di chi ha creato Narsil "Por cable desde la panza" ("via cavo dalla pancia"), che la guida 10 ha trasformato nel protocollo.

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida. Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

Prima l'arte. Da una cartella con un clone di narsil-pet e di LVGL (per `LVGLImage.py`, che richiede `pip install pypng lz4`), in PowerShell:

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

Il `main/CMakeLists.txt` della testa:

```cmake
idf_component_register(SRCS "main.c" "head_link.c"
                       INCLUDE_DIRS "."
                       EMBED_FILES "faces.bin")
```

`head_link.c` è il lato della testa della guida 10. `main.c`, in C (MIT):

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

Compilalo e flashalo dalla cartella `head/` con i comandi della guida 2 (`idf.py set-target esp32s3`, `idf.py build`, poi `idf.py flash` tramite il bridge seriale).

## Errori comuni e come testarlo

- **Un quadrato visibile intorno a Narsil.** Lo sfondo non è nero puro. Controlla che il frame venga pulito con zeri e che l'arte sia stata convertita con `--background 0x000000`.
- **Narsil guarda dalla parte sbagliata, o il quadrato rosso è nell'angolo sbagliato.** L'asse dello specchio è sbagliato; vedi la verifica dell'allineamento più sotto.
- **L'immagine spostata dopo aver specchiato l'altro asse, con una banda di rumore.** La memoria dell'ST7789 è di 240 × 320, più alta di questo schermo. Quando l'asse specchiato è quello da 320 pixel, la finestra visibile si sposta; `esp_lcd_panel_set_gap(panel, 0, 80)` la rimette a posto.
- **Un'immagine in negativo.** Il nero sembra bianco e i colori sono invertiti: cambia `esp_lcd_panel_invert_color` in `false`. Molti pannelli IPS ST7789 richiedono `true`.
- **Rosso e blu scambiati.** Usa `LCD_RGB_ELEMENT_ORDER_BGR` in `panel_config`.
- **Colori puntinati.** L'arte è stata convertita con `--cf RGB565` invece di `RGB565_SWAPPED`, quindi i due byte di ogni pixel sono nell'ordine sbagliato per il collegamento SPI.
- **Un frame strappato o misto.** Il frame buffer è stato cambiato mentre il trasferimento precedente era ancora in corso. Tieni lo `xSemaphoreTake` dopo `esp_lcd_panel_draw_bitmap`.
- **Lo schermo resta buio.** Il pin della retroilluminazione è l'ingresso del transistor, quindi alto lo accende; se il tuo resta buio al 100%, controlla il GPIO20 sullo schema della revisione della tua scheda.

Per verificare l'allineamento, metti il cubo sullo schermo e guardalo di fronte, all'altezza dei tuoi occhi, come starà il bot sulla scrivania:

1. Accendi la testa da sola. Per tre secondi, Narsil sta al centro con un quadrato rosso accanto.
2. Il quadrato rosso deve comparire nell'angolo **in alto a sinistra** come lo vedi nel cubo. Se è in alto a destra, l'immagine non è specchiata (o è specchiata due volte): inverti `mirror_x`. Se è in basso a sinistra, è specchiato l'asse sbagliato: usa `esp_lcd_panel_mirror(panel, false, true)` e il gap qui sopra.
3. Narsil deve stare dritta e centrata nel cubo. Se è bassa o alta, cambia il `- 10` in `y0`, che la sposta un po' in alto per lasciare spazio al punto della voce.
4. Guarda il cubo di lato: dovresti vedere la scrivania attraverso di esso, senza nessun bordo luminoso. Un bagliore significa che qualcosa sullo schermo non è nero.

Poi collega la pancia. Entro cinque secondi la testa mostra la posa reale di Narsil; di' "Hi ESP" e compare il punto blu. Stacca il filo dei dati: dopo 15 secondi la testa si attenua, e riattaccarlo riporta la piena luminosità alla riga successiva.

## Per andare oltre

- **Animazione.** narsil-pet ha anche dei loop animati per alcune pose (`hooks/art/animated.ts`, `assets/anim`). Due o tre frame per posa, disegnati a turno con la stessa funzione `draw`, la farebbero muovere; la flash ha spazio per molte altre immagini.
- **LVGL sulla testa.** Per testo o effetti, LVGL può girare anche sulla testa, tramite `esp_lvgl_port`, con lo stesso pannello specchiato sotto.
- **L'IMU.** Il QMI8658 può capire quando qualcuno tocca il bot. "Per andare oltre" della guida 10 descrive come la testa potrebbe rimandarlo indietro senza rompere la regola per cui non chiede niente alla pancia.
- **Luminosità di notte.** Più tenue è spesso meglio in una stanza buia: il riflesso si vede più facilmente e il nero è più trasparente. Un messaggio di luminosità dalla pancia è il passo successivo dopo la [guida 10](/it/bot/uart-protocol/).
- Cosa conserva il bot, e cosa esce dalla tua rete, è la [guida 12](/it/bot/secrets-privacy/).
