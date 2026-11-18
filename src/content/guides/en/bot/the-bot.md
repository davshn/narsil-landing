---
title: The bot and its parts
description: 'The two boards of the Narsil desk bot, what each one does, the bill of materials, the three-wire UART link between belly and head, and how data flows through it.'
route: bot
order: 1
updated: 2026-11-18
---

## What it does

The Narsil desk bot is Narsil with a body. It sits on the desk next to your computer and does three jobs:

- **It talks.** You speak to it, and Narsil answers with a voice. The answer comes from Claude, through a small server that runs on your own PC.
- **It shows what Narsil is doing.** A 4.3-inch touch screen in the belly shows Narsil's alerts and your open GitHub pull requests.
- **It has a face.** The head is a small screen inside a glass prism cube that shows only Narsil's face, so it looks like a hologram floating above the body.

The bot is two boards joined by three wires. The belly is the brain and does everything that touches the network. The head only draws. This first guide describes the parts and how they fit together; the rest of the path builds each piece.

## How it works inside

### The belly: Waveshare ESP32-P4-WIFI6-Touch-LCD-4.3

The belly is the [Waveshare ESP32-P4-WIFI6-Touch-LCD-4.3](https://docs.waveshare.com/ESP32-P4-WIFI6-Touch-LCD-4.3). From Waveshare's page, the parts that matter for the bot are:

| Part      | What it is                                                                                      |
| --------- | ----------------------------------------------------------------------------------------------- |
| Main chip | ESP32-P4 (ESP32-P4NRW32X on the module): dual-core RISC-V plus one low-power core               |
| Memory    | 32 MB PSRAM stacked in the chip package, 32 MB NOR flash                                        |
| Screen    | 4.3-inch IPS, 480 × 800, capacitive touch, on a 2-lane MIPI DSI interface                       |
| Wireless  | An onboard ESP32-C6-MINI-1 module for Wi-Fi 6 and Bluetooth 5 (LE), connected to the P4 by SDIO |
| Audio     | ES8311 audio codec, ES7210 for echo cancellation, a dual-microphone array                       |
| Speaker   | A GH1.25 2-pin connector; Waveshare recommends an 8 Ω 2 W speaker                               |
| USB       | One Type-C "USB to UART" port for power, flashing and debugging; one Type-C USB OTG 2.0 port    |
| Expansion | A 40-pin 2.54 mm header with I2C, GPIOs, 3V3, 5V and GND                                        |

The ESP32-P4 has no radio of its own. Every byte that goes to the network passes through the ESP32-C6 next to it, over SDIO. For the firmware this is invisible: Xiaozhi's board support for this board (guide 3) already sets the C6 as the Wi-Fi co-processor (`CONFIG_SLAVE_IDF_TARGET_ESP32C6=y` in its ESP32-P4 defaults).

The board's touch controller is a GT911, which is what both Xiaozhi's board code and Waveshare's board support package (`waveshare/esp32_p4_wifi6_touch_lcd_4_3` in the Espressif component registry) drive.

### The head: ESP32-S3-LCD-1.3-C

The head is the ESP32-S3-LCD-1.3-C, the version of Waveshare's ESP32-S3-LCD-1.3 that comes with a plastic case and a prism cube. SpotPear sells it as the [3D transparent prism display](https://spotpear.com/wiki/ESP32-S3-1.3-inch-LCD-ST7789-240x240-3D-Display-Transparent-Screen-Refractive-Prism-Mini-TV.html), and Waveshare documents the base board on its [product page](https://www.waveshare.com/esp32-s3-lcd-1.3.htm):

| Part      | What it is                                                                           |
| --------- | ------------------------------------------------------------------------------------ |
| Main chip | ESP32-S3R8, dual-core Xtensa LX7 up to 240 MHz                                       |
| Memory    | 512 KB SRAM, 8 MB PSRAM, 16 MB flash                                                 |
| Screen    | 1.3-inch IPS, 240 × 240, 262K colors, ST7789V2 driver on SPI                         |
| Motion    | QMI8658 six-axis IMU (accelerometer and gyroscope), on the back                      |
| USB       | Type-C through a CH343P USB-to-serial chip                                           |
| Power     | ME6217C33M5G 3.3 V regulator (800 mA maximum), PL4054 charger, MX1.25 battery header |
| Other     | TF card slot, a 2.54 mm GPIO header                                                  |
| Prism     | A glass cube that sits on the screen and reflects its image                          |

The prism is why the face looks like it floats: the screen lies flat and the cube's inner face reflects it towards you. A reflection is a mirror image, so the head draws its face mirrored; [guide 11](/en/bot/holographic-head/) covers that.

The ESP32-S3 has its own Wi-Fi, and the head does not use it. That is a decision, explained next.

### Why the belly does all the networking

Narsil's data lives on the internet: alerts arrive through ntfy, pull requests come from the GitHub REST API, and the voice goes to your server. All three need Wi-Fi, credentials and retry logic. If both boards connected, both would need the Wi-Fi password, the GitHub token and the ntfy topic, and both could disagree about what Narsil is doing.

So the belly owns every connection and every secret, and decides Narsil's state. The head receives only what to draw: a pose and a state, over a serial cable. It holds no secrets, and if it reboots it simply waits for the next message. [Guide 10](/en/bot/uart-protocol/) defines that protocol.

### The UART link

The two boards talk over UART, the plain serial link every ESP32 has, using female-female Dupont wires between their headers:

| Wire   | Belly (ESP32-P4) | Head (ESP32-S3) |
| ------ | ---------------- | --------------- |
| Data → | GPIO4 (TX)       | GPIO13 (RX)     |
| Data ← | GPIO5 (RX)       | GPIO14 (TX)     |
| Ground | GND              | GND             |

TX on one side goes to RX on the other: each board talks on its TX pin and listens on its RX pin, so the wires cross.

Why these pins:

- **On the belly**, GPIO4 and GPIO5 are on the 40-pin header and are not used by anything Xiaozhi configures for this board. Its `config.h` takes GPIO9 to GPIO13 for I2S audio, GPIO7 and GPIO8 for I2C, GPIO53 for the speaker amplifier, GPIO26 and GPIO27 for the screen, and GPIO35 for the BOOT button. Waveshare's board support adds GPIO39 to GPIO44 for the TF card. The header's GPIO37 and GPIO38 are left alone too: ESP-IDF lists them as UART0's default TX and RX on the ESP32-P4, the port of the boot log.
- **On the head**, GPIO13 and GPIO14 are header pins next to each other in Waveshare's schematic (`ESP32S3_1.3inch.pdf`, linked from the SpotPear wiki). The screen, the IMU and the TF card use other pins, and GPIO43 and GPIO44 carry U0TXD and U0RXD to the CH343P, the head's own USB serial port.

Check the labels printed on your boards before you plug anything in: header layouts differ between revisions.

**Power: one USB cable per board, ground shared, 3V3 not shared.** Each board gets its own USB-C cable. The belly takes its power from its "USB to UART" port, and the head regulates its own 3.3 V with its ME6217C33M5G. Joining the two 3V3 pins would tie two separate regulators together, each trying to hold the rail, and the belly's 3V3 header pin was never meant to feed a second board. The ground wire is the one that matters: a UART signal is a voltage measured against ground, so both boards need the same ground. Both chips use 3.3 V logic, so no level shifter is needed.

### The data flow

| From            | To                       | Over                   | What                                         |
| --------------- | ------------------------ | ---------------------- | -------------------------------------------- |
| Microphones     | Belly (ES7210, Xiaozhi)  | I2S                    | Your voice                                   |
| Belly           | Your server (on your PC) | WebSocket, LAN         | Opus audio up; Opus audio and text back      |
| Your server     | Claude                   | HTTPS, Anthropic SDK   | What you said, as text; Narsil's answer back |
| Belly           | Speaker (ES8311)         | I2S                    | Narsil's voice                               |
| ntfy            | Belly                    | HTTPS                  | Narsil's alerts from your computer           |
| GitHub REST API | Belly                    | HTTPS, read-only token | Your open pull requests                      |
| Belly           | Belly's screen (LVGL)    | MIPI DSI               | Alerts and pull requests                     |
| Belly           | Head                     | UART, 3 wires          | Pose and state                               |
| Head            | Prism                    | ST7789 screen          | Narsil's face, mirrored                      |

The voice path is the only one that needs your PC. Alerts, pull requests and the face keep working when the server is off.

### The bill of materials

- 1 × Waveshare ESP32-P4-WIFI6-Touch-LCD-4.3 (the belly).
- 1 × ESP32-S3-LCD-1.3-C, with its case and prism cube (the head).
- Female-female Dupont wires (three are used).
- 1 × speaker with a GH1.25 2-pin plug, 8 Ω 2 W as Waveshare recommends. The microphones are already on the belly.
- 2 × USB-C data cables, one per board.
- A PC on the same network, running Docker, for the voice server (guide 4).

The firmware for both boards lives in one public repository, `davshn/narsil-bot`: a fork of 78/xiaozhi-esp32 for the belly, with the head's firmware in its own `head/` folder.

## Build it with Claude

Ask Claude to read the official pages of both boards and propose the role of each one, the UART pins, the power and the parts list. The one idea it must get right is that the belly owns every connection and every secret, and the head only draws what it receives over three wires.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the conversation used to design the bot.

> I want to build a desk bot from two ESP32 boards: a Waveshare ESP32-P4-WIFI6-Touch-LCD-4.3 as the body and an ESP32-S3-LCD-1.3-C (ST7789 240×240 under a prism cube) as the head. The body must do all networking and the head must only draw a face it receives over UART. Read the official Waveshare and SpotPear pages and schematics, then propose: the role of each board, which free header pins to use for the UART on each side (avoiding pins the board support or the boot console already use), how to power both boards, and a bill of materials. Cite the page each pin comes from, and ask me one question at a time when something is a real choice.

### What to check in Claude's answer

1. The belly does all the networking and holds the Wi-Fi password, the GitHub token and the ntfy topic. The head holds no secrets and only receives a pose and a state over UART.
2. The UART uses free header pins: GPIO4 (TX) and GPIO5 (RX) on the belly, GPIO13 (RX) and GPIO14 (TX) on the head. It avoids the pins Xiaozhi's `config.h` already takes, such as GPIO9 to GPIO13 for audio.
3. The wires cross: each TX goes to the other board's RX, and a third wire joins the two grounds.
4. Each board has its own USB-C cable, and the 3V3 pins stay unconnected. Both boards use 3.3 V logic, so no level shifter is needed.
5. The console pins are left alone: GPIO37 and GPIO38 on the belly, GPIO43 and GPIO44 on the head. Each pin choice cites the page or schematic it comes from.

If a check fails, tell Claude what you see: "the head prints garbage, and my plan has no ground wire between the boards".

### How the author asked for it

The design started from a shopping cart. On 2026-11-17 the author shared a screenshot of an AliExpress cart with the two boards and a pack of Dupont wires, and described the idea:

> va a ser la pantalla grande para una pantalla en la pansa que va a tener la informacion de las tareas que hace narsil y la cabeza va a ser una apntalla holografica que solo sea la cara de narsil

In English: "it's going to be the big screen, for a screen in the belly that will have the information about the tasks Narsil does, and the head is going to be a holographic screen that is only Narsil's face".

That fixed the roles of the two boards before any code: the P4 with the large screen is the belly, the S3 with the prism is the face.

The next question the AI asked was how the head would get its data: connect to the network on its own, or receive it from the belly. The author answered:

> Por cable desde la panza

In English: "By cable from the belly".

That answer is the rule in "Why the belly does all the networking" above: one board owns the network and the secrets, the other only draws. The AI asked its questions one at a time, with the Waveshare and SpotPear pages as sources, and recorded each answer in the project's task document as a numbered spec.

## Reference code

This is one correct answer, written for this guide. Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

The wiring becomes code in one place on each board: the UART setup. This is the belly's side, written for this guide with the ESP-IDF UART driver (`driver/uart.h`, the same calls as ESP-IDF's `uart_echo` example). The head's side is the same with its own pins.

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

One detail is easy to miss. On the ESP32-P4, ESP-IDF's default pins for UART1 are GPIO10 and GPIO11, and on this board those carry the audio (I2S word select and data in). `uart_set_pin` routes UART1 to GPIO4 and GPIO5 through the GPIO matrix instead, so the default pins are never touched. Sending is then one call, `uart_write_bytes(HEAD_UART, data, len)`; what goes in `data` is [guide 10](/en/bot/uart-protocol/).

## Common mistakes and how to test it

- **TX to TX.** If nothing arrives, swap the two data wires. Each TX goes to the other board's RX.
- **No ground wire.** Without a common ground the signal has no reference, and the head reads garbage or nothing.
- **Joining the 3V3 pins.** Each board is powered by its own USB cable; leave 3V3 unconnected.
- **Using the console pins.** GPIO37 and GPIO38 on the belly, and GPIO43 and GPIO44 on the head, are UART0, wired to each board's USB serial port. Messages there mix with the boot log.
- **Female wires on a bare header.** Female-female Dupont wires need male pins on both boards. Check that your boards' headers have pins before you plan the wiring.
- **A charge-only USB cable.** If Windows does not show a new COM port when you plug a board in, try another cable (guide 2).

To test the link before any protocol exists, flash both boards with ESP-IDF's `uart_echo` example set to these pins, or send a line from the belly and log what the head reads with `uart_read_bytes`. If the text arrives intact at 115200 baud, the wiring is right.

## Going further

- The belly's touch screen can do more than show: a tap can mark an alert as read, which [guide 9](/en/bot/belly-ui/) builds with LVGL.
- The head's QMI8658 can tell when someone picks the bot up or taps it. The head could send that back on its TX wire, which is why the link has two data wires and not one.
- Both boards have battery headers (MX1.25 on the head, a 3.7 V lithium header on the belly). The bot in this path runs from USB, which keeps the power design simple.
- Waveshare's [ESP-IDF page for the belly](https://docs.waveshare.com/ESP32-P4-WIFI6-Touch-LCD-4.3/ESP-IDF/) lists example projects (I2C tools, Wi-Fi station, I2S codec, LVGL) that are useful to check each part of the board on its own.
