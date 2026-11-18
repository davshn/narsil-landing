---
title: La cabeza holográfica
description: 'La ESP32-S3-LCD-1.3 bajo su cubo prisma: por qué la imagen va en espejo, por qué el negro es transparente, dibujar a Narsil por pose desde la UART, la retroiluminación y cómo revisar la alineación.'
route: bot
order: 11
updated: 2026-11-18
---

## Qué hace

La cabeza es lo primero que la gente nota. Dentro de un pequeño cubo de vidrio encima del bot, Narsil flota en el aire: su dibujo, en la pose que envía la panza, sin nada alrededor. Cuando está trabajando, está trabajando; cuando Claude te necesita, te está esperando; cuando dices "Hi ESP", un pequeño punto azul debajo de ella muestra que está escuchando.

Es una pantalla de 1,3 pulgadas y un prisma. Esta guía explica por qué funciona el truco, qué debe hacer el firmware para lograrlo (poner la imagen en espejo, mantener el fondo negro), cómo dibuja cada pose que llega por la UART de la guía 10, y cómo comprobar que la imagen está del lado correcto.

## Cómo funciona por dentro

### La placa

La cabeza es la ESP32-S3-LCD-1.3-C de la guía 1: un ESP32-S3R8 con 8 MB de PSRAM y 16 MB de flash, y una pantalla IPS de 1,3 pulgadas de 240 × 240 píxeles controlada por un ST7789 por SPI. SpotPear vende la versión con el cubo como la [pantalla 3D de prisma transparente](https://spotpear.com/wiki/ESP32-S3-1.3-inch-LCD-ST7789-240x240-3D-Display-Transparent-Screen-Refractive-Prism-Mini-TV.html), y Waveshare documenta la placa en su [wiki](https://www.waveshare.com/wiki/ESP32-S3-LCD-1.3).

Los pines de la pantalla salen del esquema de Waveshare, `ESP32S3_1.3inch.pdf`, enlazado desde las dos páginas:

| Señal                     | GPIO |
| ------------------------- | ---- |
| Reloj SPI (CLK)           | 40   |
| Datos SPI (MOSI)          | 41   |
| Selección de chip (CS)    | 39   |
| Datos/comando (DC)        | 38   |
| Reinicio (RES)            | 42   |
| Retroiluminación (BL_PWM) | 20   |

Ninguno choca con la UART de la guía 10 (GPIO13 y GPIO14), la IMU (de GPIO45 a GPIO48) ni la tarjeta TF (GPIO16, GPIO17, GPIO18 y GPIO21, según el mismo esquema). El pin de la retroiluminación maneja los LED de la pantalla a través de un transistor, así que una señal PWM en él fija el brillo.

### Por qué la cara flota

El truco es antiguo: se llama fantasma de Pepper, por una ilusión teatral del siglo XIX en la que un actor escondido bajo el escenario aparecía como un fantasma reflejado en una gran lámina de vidrio. Aquí el vidrio es el cubo. La pantalla está tumbada debajo, y una cara diagonal dentro del cubo refleja la pantalla hacia ti, mientras sigues viendo a través del vidrio el escritorio que hay detrás. Tu ojo toma el reflejo por un objeto que está de pie dentro del cubo.

De ahí salen dos consecuencias, y las dos están en el firmware.

### El negro es transparente

Un reflejo solo suma luz. Un píxel brillante se refleja brillante, y un píxel negro no refleja nada en absoluto, así que a través del vidrio ves lo que haya detrás del cubo. En esta pantalla, **el negro es transparente**: un fondo negro es lo que hace que Narsil flote sin ningún rectángulo alrededor. Cualquier otro color de fondo, incluso un gris oscuro, muestra los bordes de la pantalla como un cuadrado tenue que brilla.

Así que la cabeza borra cada fotograma a negro puro (RGB565 `0x0000`) y dibuja solo a Narsil encima. Su arte de narsil-pet viene en dos versiones por pose, `-claro` para fondos claros y `-oscuro` para fondos oscuros; la cabeza usa `-oscuro`, hecho para un fondo oscuro, los mismos archivos que nombra la URL de `art` de la guía 10. Los PNG tienen bordes transparentes, y se aplanan sobre negro al convertirlos, así que sus contornos suaves se funden con el negro en lugar de dejar un halo.

### La imagen va en espejo

Un espejo invierte la imagen en un eje: pon una página de texto frente a un espejo y se lee al revés. El cubo es un espejo, así que una imagen dibujada normalmente en la pantalla se ve invertida dentro del cubo. Narsil mira hacia el lado equivocado, y cualquier texto es ilegible. El firmware dibuja la imagen ya en espejo, así que el reflejo la vuelve a invertir.

Waveshare publica sus demos en dos compilaciones por esta razón: la página de SpotPear lista "AstronautClock-NoPrism and AstronautClock-Prism" (AstronautClock-NoPrism y AstronautClock-Prism), y dice que la segunda es adecuada para la versión con prisma.

El driver de LCD de ESP-IDF hace el volteo en el controlador de la pantalla, sin costo para el procesador. De la [referencia de la API de LCD](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/lcd/index.html):

```c
esp_err_t esp_lcd_panel_mirror(esp_lcd_panel_handle_t panel, bool mirror_x, bool mirror_y);
```

"Mirror the LCD panel on specific axis." (refleja el panel LCD en un eje concreto). En el driver ST7789 de ESP-IDF (`esp_lcd_panel_st7789.c`), la llamada solo cambia bits del registro `MADCTL` del controlador, que fija el orden en que el controlador escribe los píxeles en su memoria. El fotograma que envía el firmware no cambia; la pantalla lo muestra volteado.

Qué eje depende de cómo está la pantalla bajo el prisma, así que la cabeza empieza con `mirror_x` activado y la comprobación de alineación de abajo te dice si es correcto. La pantalla de arranque de la cabeza existe para esa comprobación: un cuadrado rojo en su esquina superior izquierda durante tres segundos.

### El arte de Narsil en el firmware

La cabeza no tiene red ni sistema de archivos del que sacar imágenes, así que el arte va dentro del propio firmware:

1. Cada uno de los archivos `-oscuro.png` de narsil-pet para las cinco poses (`parada`, `trabajando`, `necesita`, `terminado`, `error`) en las cinco etapas se convierte con el conversor de imágenes de LVGL, `scripts/LVGLImage.py` en el [repositorio de LVGL](https://github.com/lvgl/lvgl). Las opciones son `--ofmt BIN` (un archivo binario), `--cf RGB565_SWAPPED` (color de 16 bits con sus dos bytes en el orden que espera el ST7789 por SPI) y `--background 0x000000` (el color con el que se funden los bordes transparentes, para un formato sin alfa).
2. Los 25 archivos se unen en uno, `faces.bin`, en un orden fijo: de la etapa 1 a la 5, y dentro de cada etapa las cinco poses en el orden de arriba.
3. El sistema de compilación de ESP-IDF lo incrusta: `EMBED_FILES faces.bin` en `idf_component_register` pone el archivo en la flash y da dos símbolos, `_binary_faces_bin_start` y `_binary_faces_bin_end`, como describe su [documentación del sistema de compilación](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-guides/build-system.html).

Cada archivo convertido empieza con la cabecera de imagen de 12 bytes de LVGL 9 (`lv_image_header_t` en `src/draw/lv_image_dsc.h`): un byte mágico, el formato de color, unas banderas, y después el ancho, el alto y el stride como números de 16 bits little-endian en los bytes 4, 6 y 8. La cabeza recorre `faces.bin` leyendo cada cabecera y saltando `12 + stride × alto` bytes hasta la siguiente imagen, así que no necesita ninguna tabla de índices. Los dibujos de Narsil miden 150 píxeles de alto y de 79 a 106 de ancho; 25 de ellos ocupan menos de 800 KB, una pequeña parte de los 16 MB de flash de la cabeza.

El arte es de narsil-pet, con licencia GPL-3.0-or-later, y `faces.bin` está hecho a partir de él, así que conserva esa licencia y un enlace a [davshn/narsil-pet](https://github.com/davshn/narsil-pet) en las notas de la carpeta `head/`. El código propio de la cabeza es MIT, como los ejemplos del sitio.

### Dibujar un fotograma

La cabeza guarda un fotograma de 240 × 240 en memoria apta para DMA (`heap_caps_malloc` con `MALLOC_CAP_DMA`), 115.200 bytes. Para dibujar, llena el fotograma de negro, copia la imagen de Narsil en el centro fila por fila, añade el punto de voz, y envía el fotograma entero con `esp_lcd_panel_draw_bitmap`.

Esa llamada vuelve antes de que termine la transferencia: el driver SPI envía los bytes en segundo plano, con DMA, directamente desde el búfer del fotograma. Cambiar el búfer antes de que termine la transferencia enviaría una mezcla de dos fotogramas, así que la cabeza registra `on_color_trans_done`, un callback al que el driver llama cuando termina la transferencia, que libera un semáforo de FreeRTOS. La función de dibujo espera ese semáforo antes de volver, así que el siguiente fotograma nunca sobrescribe uno que aún va de camino.

La cabeza solo vuelve a dibujar cuando cambian la pose, la etapa o el estado de voz. Entre cambios la pantalla conserva el último fotograma por su cuenta, y el procesador espera en la UART.

### El punto de voz

El mensaje `V` de la guía 10 dice si Xiaozhi está escuchando o hablando. La cabeza lo muestra como un pequeño punto debajo de Narsil: azul (`#3B8BFF`, el color de narsil-pet para trabajando) mientras escucha, verde (`#22B573`, su color para terminado) mientras habla, y nada cuando está en reposo. Un punto, no un segundo dibujo, porque el arte no tiene una pose de "escuchando" y el punto se ve desde el otro lado de la habitación.

### La retroiluminación

Los LED de la pantalla están en GPIO20, a través de un transistor. La cabeza maneja el pin con el periférico PWM [LEDC](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/ledc.html) de ESP-IDF a 5 kHz con 10 bits de resolución, así que el ciclo de trabajo, de 0 a 1023, es el brillo. Funciona con el brillo al máximo mientras llegan líneas, y baja al 20 % después de 15 segundos de silencio (guía 10): la panza está apagada o el cable está suelto, y una Narsil atenuada lo dice sin apagarse. La retroiluminación sigue apagada hasta que se dibuja el primer fotograma, así que la pantalla nunca muestra al arrancar la memoria aleatoria del controlador.

## Constrúyelo con Claude

Pídele a Claude el firmware de la cabeza: una app de ESP-IDF que dibuja la pose de Narsil, recibida por la UART, en la pantalla ST7789 bajo el cubo de prisma. La idea que debe acertar es que el cubo es un espejo: la imagen debe dibujarse en espejo, y todo lo que no es Narsil debe ser negro puro, porque el negro es lo que se ve transparente.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es la conversación con la que se construyó el bot.

> Tengo una Waveshare ESP32-S3-LCD-1.3 (ST7789, 240×240, SPI) bajo un cubo prisma de fantasma de Pepper. Lee la wiki y el esquema de Waveshare para los pines de la LCD y de la retroiluminación, y la documentación de `esp_lcd` de ESP-IDF 6. Escribe una app de ESP-IDF que inicialice el ST7789 con `esp_lcd_new_panel_st7789`, ponga la imagen en espejo con `esp_lcd_panel_mirror`, mantenga el fondo en negro puro, fije la retroiluminación con LEDC, y dibuje una de 25 imágenes RGB565 incrustadas elegida por una pose y una etapa recibidas por UART. Espera a `on_color_trans_done` antes de reutilizar el búfer del fotograma. Explica por qué la imagen debe ir en espejo y por qué el negro se ve transparente, y cómo compruebo la alineación.

### Qué revisar en la respuesta de Claude

1. La imagen se refleja en el controlador de la pantalla con `esp_lcd_panel_mirror`, empezando con `mirror_x` activado, y la pantalla de arranque muestra un cuadrado rojo en la esquina superior izquierda durante tres segundos para que puedas comprobar el eje.
2. Cada fotograma se borra a negro puro (`0x0000`), y el arte se convierte con `--background 0x000000` y `--cf RGB565_SWAPPED`, no con `RGB565` a secas.
3. Los pines coinciden con el esquema de Waveshare: CLK en GPIO40, MOSI en GPIO41, CS en GPIO39, DC en GPIO38, reset en GPIO42 y la retroiluminación en GPIO20. Ninguno es GPIO13 ni GPIO14, la UART de la guía 10.
4. Después de `esp_lcd_panel_draw_bitmap`, el código espera a que `on_color_trans_done` entregue su semáforo antes de volver a tocar el búfer del fotograma.
5. La cabeza solo vuelve a dibujar cuando cambian la pose, la etapa o el estado de voz. La retroiluminación sigue apagada hasta el primer fotograma, y baja al 20 % después de 15 segundos sin una línea de la panza.

Si una comprobación falla, dile a Claude lo que ves: "Narsil mira hacia el lado equivocado, y el cuadrado rojo está en la esquina superior derecha del cubo".

### Cómo lo pidió el autor

El trabajo de la cabeza estaba en la primera descripción del bot que hizo quien creó Narsil:

> la cabeza va a ser una apntalla holografica que solo sea la cara de narsil

"Solo la cara de Narsil" es todo el encargo de diseño: ni reloj, ni texto, ni menús en la cabeza. La IA leyó la página de SpotPear, que vende la placa con su prisma, y la wiki y el esquema de Waveshare, que dan el controlador y los pines de la pantalla. Las dos reglas del holograma, la imagen en espejo y el fondo negro, salieron de cómo funciona el prisma y de que Waveshare publique demos "Prism" aparte; no eran decisiones que le tocaran a quien creó Narsil.

Qué dibujar fue la propuesta de la IA: Narsil ya tiene arte pintado para cada estado y cada etapa en narsil-pet, las mismas imágenes que usan los avisos del teléfono, así que la cabeza muestra esas en lugar de un dibujo nuevo. Cómo se entera la cabeza de la pose quedó resuelto antes con la respuesta de quien creó Narsil, "Por cable desde la panza", que la guía 10 convirtió en el protocolo.

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Primero el arte. Desde una carpeta con un clon de narsil-pet y otro de LVGL (para `LVGLImage.py`, que necesita `pip install pypng lz4`), en PowerShell:

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

El `main/CMakeLists.txt` de la cabeza:

```cmake
idf_component_register(SRCS "main.c" "head_link.c"
                       INCLUDE_DIRS "."
                       EMBED_FILES "faces.bin")
```

`head_link.c` es el lado de la cabeza de la guía 10. `main.c`, en C (MIT):

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

Compílalo y flashéalo desde la carpeta `head/` con los comandos de la guía 2 (`idf.py set-target esp32s3`, `idf.py build`, y después `idf.py flash` a través del puente serie).

## Errores comunes y cómo probarlo

- **Un cuadrado visible alrededor de Narsil.** El fondo no es negro puro. Comprueba que el fotograma se borra con ceros y que el arte se convirtió con `--background 0x000000`.
- **Narsil mira hacia el lado equivocado, o el cuadrado rojo está en la esquina equivocada.** El eje del espejo es incorrecto; mira la comprobación de alineación de abajo.
- **La imagen se desplazó después de poner en espejo el otro eje, con una franja de ruido.** La memoria del ST7789 es de 240 × 320, más alta que esta pantalla. Cuando el eje en espejo es el de 320 píxeles, la ventana visible se mueve; `esp_lcd_panel_set_gap(panel, 0, 80)` la devuelve a su sitio.
- **Una imagen en negativo.** El negro se ve blanco y los colores están invertidos: cambia `esp_lcd_panel_invert_color` a `false`. Muchos paneles IPS ST7789 necesitan `true`.
- **El rojo y el azul intercambiados.** Usa `LCD_RGB_ELEMENT_ORDER_BGR` en `panel_config`.
- **Colores moteados.** El arte se convirtió con `--cf RGB565` en lugar de `RGB565_SWAPPED`, así que los dos bytes de cada píxel están en el orden equivocado para el enlace SPI.
- **Un fotograma partido o mezclado.** El búfer del fotograma se cambió mientras la transferencia anterior seguía en curso. Mantén el `xSemaphoreTake` después de `esp_lcd_panel_draw_bitmap`.
- **La pantalla sigue a oscuras.** El pin de la retroiluminación es la entrada del transistor, así que en alto la enciende; si la tuya sigue a oscuras al 100 %, comprueba GPIO20 contra el esquema de la revisión de tu placa.

Para comprobar la alineación, pon el cubo sobre la pantalla y míralo de frente, a la altura de tus ojos, como estará el bot sobre el escritorio:

1. Alimenta la cabeza sola. Durante tres segundos, Narsil está de pie en el centro con un cuadrado rojo a su lado.
2. El cuadrado rojo debe aparecer en la esquina **superior izquierda** tal como la ves en el cubo. Si está arriba a la derecha, la imagen no está en espejo (o lo está dos veces): invierte `mirror_x`. Si está abajo a la izquierda, el eje en espejo es el equivocado: usa `esp_lcd_panel_mirror(panel, false, true)` y el gap de arriba.
3. Narsil debe estar de pie, derecha y centrada en el cubo. Si está baja o alta, cambia el `- 10` de `y0`, que la sube un poco para dejar sitio al punto de voz.
4. Mira el cubo de lado: deberías ver el escritorio a través de él, sin ningún borde que brille. Un brillo significa que algo en la pantalla no es negro.

Después conecta la panza. En menos de cinco segundos la cabeza muestra la pose real de Narsil; di "Hi ESP" y aparece el punto azul. Desconecta el cable de datos: después de 15 segundos la cabeza se atenúa, y al volver a conectarlo recupera el brillo máximo con la siguiente línea.

## Para ir más lejos

- **Animación.** narsil-pet también tiene bucles animados para algunas poses (`hooks/art/animated.ts`, `assets/anim`). Dos o tres fotogramas por pose, dibujados por turnos con la misma función `draw`, la harían moverse; la flash tiene sitio para muchas más imágenes.
- **LVGL en la cabeza.** Para texto o efectos, LVGL también puede correr en la cabeza, mediante `esp_lvgl_port`, con el mismo panel en espejo por debajo.
- **La IMU.** El QMI8658 puede saber cuándo alguien toca el bot. La sección "Para ir más lejos" de la guía 10 describe cómo la cabeza lo enviaría de vuelta sin romper la regla de que no le pide nada a la panza.
- **El brillo de noche.** Más tenue suele ser mejor en una habitación oscura: el reflejo se ve más fácilmente y el negro es más transparente. Un mensaje de brillo desde la panza es el siguiente paso después de la [guía 10](/es/bot/uart-protocol/).
- Lo que guarda el bot, y lo que sale de tu red, es la [guía 12](/es/bot/secrets-privacy/).
