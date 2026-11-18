---
title: The holographic head
description: 'The ESP32-S3-LCD-1.3 under its prism cube: why the image is mirrored, why black is transparent, drawing Narsil per pose from the UART, the backlight, and how to check alignment.'
route: bot
order: 11
updated: 2026-11-18
---

## What it does

The head is the part people notice first. Inside a small glass cube on top of the bot, Narsil floats in the air: her drawing, in the pose the belly sends, with nothing around her. When she is working, she is working; when Claude needs you, she is waiting for you; when you say "Hi ESP", a small blue dot under her shows that she is listening.

It is a 1.3-inch screen and a prism. This guide explains why the trick works, what the firmware must do for it (mirror the image, keep the background black), how it draws each pose that arrives over the UART of guide 10, and how to check that the picture is the right way round.

## How it works inside

### The board

The head is the ESP32-S3-LCD-1.3-C of guide 1: an ESP32-S3R8 with 8 MB of PSRAM and 16 MB of flash, and a 1.3-inch IPS screen of 240 × 240 pixels driven by an ST7789 controller over SPI. SpotPear sells the version with the cube as the [3D transparent prism display](https://spotpear.com/wiki/ESP32-S3-1.3-inch-LCD-ST7789-240x240-3D-Display-Transparent-Screen-Refractive-Prism-Mini-TV.html), and Waveshare documents the board on its [wiki](https://www.waveshare.com/wiki/ESP32-S3-LCD-1.3).

The screen's pins come from Waveshare's schematic, `ESP32S3_1.3inch.pdf`, linked from both pages:

| Signal             | GPIO |
| ------------------ | ---- |
| SPI clock (CLK)    | 40   |
| SPI data (MOSI)    | 41   |
| Chip select (CS)   | 39   |
| Data/command (DC)  | 38   |
| Reset (RES)        | 42   |
| Backlight (BL_PWM) | 20   |

None of them collide with the UART of guide 10 (GPIO13 and GPIO14), the IMU (GPIO45 to GPIO48) or the TF card (GPIO16, GPIO17, GPIO18 and GPIO21, per the same schematic). The backlight pin drives the screen's LEDs through a transistor, so a PWM signal on it sets the brightness.

### Why the face floats

The trick is old: it is called Pepper's ghost, after a 19th-century stage illusion where an actor hidden below the stage appeared as a ghost reflected in a large sheet of glass. Here the glass is the cube. The screen lies flat under it, and a diagonal face inside the cube reflects the screen towards you, while you still see through the glass to the desk behind it. Your eye takes the reflection for an object standing inside the cube.

Two consequences follow, and both are in the firmware.

### Black is transparent

A reflection only adds light. A bright pixel reflects bright, and a black pixel reflects nothing at all, so through the glass you see whatever is behind the cube. On this screen, **black is transparent**: a black background is what makes Narsil float with no rectangle around her. Any other background color, even a dark gray, shows the edges of the screen as a faint glowing square.

So the head clears every frame to pure black (RGB565 `0x0000`) and draws only Narsil on it. Her art from narsil-pet comes in two versions per pose, `-claro` for light backgrounds and `-oscuro` for dark ones; the head uses `-oscuro`, made for a dark background, the same files the `art` URL of guide 10 names. The PNGs have transparent edges, and they are flattened onto black when they are converted, so their soft outlines blend into the black instead of a halo.

### The image is mirrored

A mirror reverses the image along one axis: hold a page of text up to a mirror and it reads backwards. The cube is a mirror, so an image drawn normally on the screen looks reversed inside the cube. Narsil faces the wrong way, and any text is unreadable. The firmware draws the image already mirrored, so the reflection reverses it back.

Waveshare ships its demos in two builds for this reason: the SpotPear page lists "AstronautClock-NoPrism and AstronautClock-Prism", and says the latter is suitable for the prism version.

ESP-IDF's LCD driver does the flip in the screen controller, at no cost for the processor. From the [LCD API reference](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/lcd/index.html):

```c
esp_err_t esp_lcd_panel_mirror(esp_lcd_panel_handle_t panel, bool mirror_x, bool mirror_y);
```

"Mirror the LCD panel on specific axis." In ESP-IDF's ST7789 driver (`esp_lcd_panel_st7789.c`), the call only changes bits of the controller's `MADCTL` register, which sets the order in which the controller writes pixels to its memory. The frame the firmware sends stays the same; the screen shows it flipped.

Which axis depends on how the screen sits under the prism, so the head starts with `mirror_x` set and the alignment check below tells you whether it is right. The head's boot screen exists for that check: a red square in its top-left corner for three seconds.

### Narsil's art in the firmware

The head has no network and no file system to fetch pictures from, so the art goes into the firmware itself:

1. Each of narsil-pet's `-oscuro.png` files for the five poses (`parada`, `trabajando`, `necesita`, `terminado`, `error`) at the five stages is converted with LVGL's image converter, `scripts/LVGLImage.py` in the [LVGL repository](https://github.com/lvgl/lvgl). The options are `--ofmt BIN` (a binary file), `--cf RGB565_SWAPPED` (16-bit color with its two bytes in the order the ST7789 expects over SPI) and `--background 0x000000` (the color the transparent edges blend into, for a format with no alpha).
2. The 25 files are joined into one, `faces.bin`, in a fixed order: stage 1 to 5, and the five poses in the order above within each stage.
3. ESP-IDF's build system embeds it: `EMBED_FILES faces.bin` in `idf_component_register` puts the file in flash and gives two symbols, `_binary_faces_bin_start` and `_binary_faces_bin_end`, as its [build system docs](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-guides/build-system.html) describe.

Each converted file starts with LVGL 9's 12-byte image header (`lv_image_header_t` in `src/draw/lv_image_dsc.h`): a magic byte, the color format, flags, then the width, height and stride as 16-bit little-endian numbers at bytes 4, 6 and 8. The head walks through `faces.bin` by reading each header and skipping `12 + stride × height` bytes to the next picture, so it needs no index table. Narsil's drawings are 150 pixels tall and 79 to 106 wide; 25 of them take under 800 KB, a small part of the head's 16 MB of flash.

The art is narsil-pet's, licensed GPL-3.0-or-later, and `faces.bin` is made from it, so it keeps that license and a link to [davshn/narsil-pet](https://github.com/davshn/narsil-pet) in the `head/` folder's notes. The head's own code is MIT, like the site's examples.

### Drawing a frame

The head keeps one 240 × 240 frame in DMA-capable memory (`heap_caps_malloc` with `MALLOC_CAP_DMA`), 115,200 bytes. To draw, it fills the frame with black, copies Narsil's picture into the middle row by row, adds the voice dot, and sends the whole frame with `esp_lcd_panel_draw_bitmap`.

That call returns before the transfer ends: the SPI driver sends the bytes in the background, with DMA, straight from the frame buffer. Changing the buffer before the transfer ends would send a mix of two frames, so the head registers `on_color_trans_done`, a callback the driver calls when the transfer finishes, which gives a FreeRTOS semaphore. The drawing function waits on that semaphore before it returns, so the next frame never overwrites one still on its way.

The head only redraws when the pose, the stage or the voice state changes. Between changes the screen keeps the last frame on its own, and the processor waits on the UART.

### The voice dot

The `V` message of guide 10 says whether Xiaozhi is listening or speaking. The head shows it as a small dot under Narsil: blue (`#3B8BFF`, narsil-pet's color for working) while listening, green (`#22B573`, its color for done) while speaking, and nothing when idle. A dot, not a second drawing, because the art has no "listening" pose and the dot can be seen from across the room.

### The backlight

The screen's LEDs are on GPIO20, through a transistor. The head drives the pin with ESP-IDF's [LEDC](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/ledc.html) PWM peripheral at 5 kHz with 10-bit resolution, so the duty cycle, from 0 to 1023, is the brightness. It runs at full brightness while lines arrive, and drops to 20% after 15 seconds of silence (guide 10): the belly is off or the wire is loose, and a dim Narsil says so without going dark. The backlight stays off until the first frame is drawn, so the screen never flashes the controller's random memory at boot.

## Build it with Claude

Ask Claude for the head's firmware: an ESP-IDF app that draws Narsil's pose, received over the UART, on the ST7789 screen under the prism cube. The one idea it must get right is that the cube is a mirror: the image must be drawn mirrored, and everything that is not Narsil must be pure black, because black is what looks transparent.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the conversation used to build the bot.

> I have a Waveshare ESP32-S3-LCD-1.3 (ST7789, 240×240, SPI) under a Pepper's-ghost prism cube. Read Waveshare's wiki and schematic for the LCD and backlight pins, and ESP-IDF 6's `esp_lcd` docs. Write an ESP-IDF app that initializes the ST7789 with `esp_lcd_new_panel_st7789`, mirrors the image with `esp_lcd_panel_mirror`, keeps the background pure black, sets the backlight with LEDC, and draws one of 25 embedded RGB565 images chosen by a pose and a stage received over UART. Wait for `on_color_trans_done` before reusing the frame buffer. Explain why the image must be mirrored and why black looks transparent, and how I check the alignment.

### What to check in Claude's answer

1. The image is mirrored in the screen controller with `esp_lcd_panel_mirror`, starting with `mirror_x` set, and the boot screen shows a red square in the top-left corner for three seconds so you can check the axis.
2. Every frame is cleared to pure black (`0x0000`), and the art is converted with `--background 0x000000` and `--cf RGB565_SWAPPED`, not plain `RGB565`.
3. The pins match Waveshare's schematic: CLK on GPIO40, MOSI on GPIO41, CS on GPIO39, DC on GPIO38, reset on GPIO42 and the backlight on GPIO20. None of them is GPIO13 or GPIO14, the UART of guide 10.
4. After `esp_lcd_panel_draw_bitmap`, the code waits for `on_color_trans_done` to give its semaphore before it touches the frame buffer again.
5. The head redraws only when the pose, the stage or the voice state changes. The backlight stays off until the first frame, and drops to 20% after 15 seconds without a line from the belly.

If a check fails, tell Claude what you see: "Narsil faces the wrong way, and the red square is in the top-right corner of the cube".

### How the author asked for it

The head's job was in the author's first description of the bot:

> la cabeza va a ser una apntalla holografica que solo sea la cara de narsil

In English: "the head is going to be a holographic screen that is only Narsil's face".

"Only Narsil's face" is the whole design brief: no clock, no text, no menus on the head. The AI read the SpotPear page, which sells the board with its prism, and the Waveshare wiki and schematic, which give the screen's controller and pins. The two hologram rules, the mirrored image and the black background, came from how the prism works and from Waveshare shipping separate "Prism" demos; they were not choices for the author to make.

What to draw was the AI's proposal: Narsil already has painted art for every state and stage in narsil-pet, the same pictures the phone alerts use, so the head shows those instead of a new drawing. How the head learns the pose was settled earlier by the author's answer "Por cable desde la panza" ("by cable, from the belly"), which guide 10 turned into the protocol.

## Reference code

This is one correct answer, written for this guide. Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

First the art. From a folder with a clone of narsil-pet and of LVGL (for `LVGLImage.py`, which needs `pip install pypng lz4`), in PowerShell:

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

The head's `main/CMakeLists.txt`:

```cmake
idf_component_register(SRCS "main.c" "head_link.c"
                       INCLUDE_DIRS "."
                       EMBED_FILES "faces.bin")
```

`head_link.c` is the head's side of guide 10. `main.c`, in C (MIT):

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

Build and flash it from the `head/` folder with the commands of guide 2 (`idf.py set-target esp32s3`, `idf.py build`, then `idf.py flash` through the serial bridge).

## Common mistakes and how to test it

- **A visible square around Narsil.** The background is not pure black. Check that the frame is cleared with zeros and that the art was converted with `--background 0x000000`.
- **Narsil faces the wrong way, or the red square is in the wrong corner.** The mirror axis is wrong; see the alignment check below.
- **The image shifted after mirroring the other axis, with a band of noise.** The ST7789's memory is 240 × 320, taller than this screen. When the mirrored axis is the 320-pixel one, the visible window moves; `esp_lcd_panel_set_gap(panel, 0, 80)` moves it back.
- **A negative image.** Black looks white and the colors are inverted: change `esp_lcd_panel_invert_color` to `false`. Many IPS ST7789 panels need `true`.
- **Red and blue swapped.** Use `LCD_RGB_ELEMENT_ORDER_BGR` in `panel_config`.
- **Speckled colors.** The art was converted with `--cf RGB565` instead of `RGB565_SWAPPED`, so the two bytes of each pixel are in the wrong order for the SPI link.
- **A torn or mixed frame.** The frame buffer was changed while the previous transfer was still running. Keep the `xSemaphoreTake` after `esp_lcd_panel_draw_bitmap`.
- **The screen stays dark.** The backlight pin is the transistor's input, so high turns it on; if yours stays dark at 100%, check GPIO20 against the schematic of your board's revision.

To check the alignment, put the cube on the screen and look at it from the front, at the height of your eyes, as the bot will sit on the desk:

1. Power the head on its own. For three seconds, Narsil stands in the middle with a red square next to her.
2. The red square must appear in the **top-left** corner as you see it in the cube. If it is top-right, the image is not mirrored (or mirrored twice): flip `mirror_x`. If it is bottom-left, the wrong axis is mirrored: use `esp_lcd_panel_mirror(panel, false, true)` and the gap above.
3. Narsil must stand upright and be centered in the cube. If she is low or high, change the `- 10` in `y0`, which moves her up a little to leave room for the voice dot.
4. Look at the cube from the side: you should see the desk through it, with no glowing edge. A glow means something on the screen is not black.

Then connect the belly. Within five seconds the head shows Narsil's real pose; say "Hi ESP" and the blue dot appears. Unplug the data wire: after 15 seconds the head dims, and plugging it back brings full brightness at the next line.

## Going further

- **Animation.** narsil-pet also has animated loops for some poses (`hooks/art/animated.ts`, `assets/anim`). Two or three frames per pose, drawn in turn with the same `draw` function, would make her move; the flash has room for many more pictures.
- **LVGL on the head.** For text or effects, LVGL can run on the head too, through `esp_lvgl_port`, with the same mirrored panel underneath.
- **The IMU.** The QMI8658 can tell when someone taps the bot. Guide 10's "Going further" describes how the head would send that back without breaking the rule that it asks the belly for nothing.
- **Brightness at night.** Dimmer is often better in a dark room: the reflection is easier to see and the black more transparent. A brightness message from the belly is the next step after [guide 10](/en/bot/uart-protocol/).
- What the bot keeps, and what leaves your network, is [guide 12](/en/bot/secrets-privacy/).
