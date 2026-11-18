---
title: The UART protocol between belly and head
description: "A small line-based protocol with a version and a checksum: the belly sends Narsil's pose and voice state, the head only says hello, and both survive a reboot or a loose wire."
route: bot
order: 10
updated: 2026-11-18
---

## What it does

The belly knows what Narsil is doing; the head only draws her. Between them run the three wires of guide 1, and this guide decides what travels on them: short lines of text such as

```text
$N1,P,trabajando,3*3A
```

which means "protocol version 1: show the pose `trabajando` (working) at stage 3". The belly sends a line when Narsil's pose changes, when Xiaozhi starts or stops listening or speaking, and every five seconds anyway. The head checks each line, draws what it says, and sends one line back only when it boots, to ask for the current state.

That is the whole protocol: two messages down, one up. It is enough because the head holds no state worth keeping and no secrets, as guide 1 decided.

## How it works inside

### Why text lines

A UART carries bytes, with no idea of where a message starts or ends. The protocol has to add that, and there are two common ways: binary frames with a start byte and a length, or text lines that end in `\n`. The bot uses text lines:

- **You can read them.** The serial monitor or a USB-serial adapter shows the messages as they are, and you can type one by hand to test the head.
- **A lost byte costs one line.** After any garbage, the next `$` starts a new message, and the next `\n` ends it. Nothing has to resynchronize.
- **The messages are tiny.** A pose and a stage fit in about 20 bytes. At 115200 baud a line takes under 2 milliseconds.

### The shape of a line

```text
$N1,<type>,<fields>*<checksum>\n
```

| Part         | Meaning                                                                       |
| ------------ | ----------------------------------------------------------------------------- |
| `$`          | Start of a message. Anything before it is ignored.                            |
| `N1`         | Narsil protocol, version 1. A head that does not know the version ignores it. |
| `<type>`     | One letter: `P` (pose), `V` (voice), `H` (hello).                             |
| `<fields>`   | Comma-separated values, depending on the type.                                |
| `*`          | End of the body.                                                              |
| `<checksum>` | Two uppercase hexadecimal digits: the XOR of every byte between `$` and `*`.  |
| `\n`         | End of the line. A line longer than 64 bytes is thrown away.                  |

It is the same shape GPS receivers use for their NMEA sentences, for the same reasons: readable, short and self-checking. The XOR checksum is one byte, computed by XOR-ing the characters one after another. It does not catch every error, but it catches the usual ones on a short wire, such as a flipped bit or a byte lost in the middle of a line, and costs nothing to compute.

The version field is what lets the protocol change later. If version 2 adds a field, a head with old firmware ignores `N2` lines instead of drawing something wrong, and the belly can send both while the two boards are updated one at a time.

### The messages

| Line                    | Direction    | Meaning                                                                                            |
| ----------------------- | ------------ | -------------------------------------------------------------------------------------------------- |
| `$N1,P,<pose>,<stage>*` | belly → head | Narsil's pose: `parada`, `trabajando`, `necesita`, `terminado` or `error`; her stage, from 1 to 5. |
| `$N1,V,<voice>*`        | belly → head | Xiaozhi's voice state: `idle`, `listening` or `speaking`.                                          |
| `$N1,H*1B`              | head → belly | Hello: the head has just booted and has nothing to draw.                                           |

Some real lines, with their checksums:

```text
$N1,P,parada,1*35
$N1,P,necesita,2*33
$N1,V,listening*40
$N1,V,idle*2D
$N1,H*1B
```

The pose names are narsil-pet's own, kept in Spanish so they match her art files one to one. They come from the `POSE` table in its `hooks/sprite.ts`, one pose per state: `working` is `trabajando`, `idle` is `parada`, `waiting` is `necesita`, `done` is `terminado` and `error` is `error`.

### Where the pose comes from

The belly does not invent Narsil's pose: the PC tells it, in the `-estado` message of guide 7. That JSON has no "pose" field of its own; it has `art`, the URL of her drawing, built by `artUrl` in narsil-pet's `hooks/phone.ts`:

```ts
export function artUrl(pose: string, stage: number): string {
  return `${ART_URL}/${stage > 1 ? `etapa${stage}/` : ''}${pose}-oscuro.png`
}
```

(Quoted from [davshn/narsil-pet](https://github.com/davshn/narsil-pet), GPL-3.0-or-later.) `sendStatus` in `hooks/register.tsx` calls it with the pose of the most important conversation and Narsil's stage, from 1 (the hatchling) to 5 (`STAGE_FROM` in `hooks/xp.ts`). So the URL carries both values:

| `art` ends in                          | Pose         | Stage |
| -------------------------------------- | ------------ | ----- |
| `/assets/parada-oscuro.png`            | `parada`     | 1     |
| `/assets/etapa3/trabajando-oscuro.png` | `trabajando` | 3     |
| `/assets/etapa5/error-oscuro.png`      | `error`      | 5     |

`HeadSetPoseFromArt`, the function guide 9's `ShowStatus` calls, takes the file name between the last `/` and `-oscuro.png` as the pose, and the number after `/etapa` as the stage (1 when there is none). It checks the pose against the five names before keeping it, so a changed URL format can never send the head something it cannot draw.

The head draws the same art that Narsil's band and the phone alerts show, which is why the names stay as narsil-pet writes them.

### The voice state

The belly also knows something the PC does not: whether Xiaozhi is listening or speaking right now. `Application::GetInstance().GetDeviceState()` in Xiaozhi returns its state machine's current state (`main/device_state.h`): `kDeviceStateListening` and `kDeviceStateSpeaking` become `listening` and `speaking`, and every other state is `idle`. The belly's link task checks it ten times a second and sends a `V` line when it changes, so the head can show that Narsil is listening while you talk to her.

### Reconnects, reboots and loose wires

The link has no connection to set up and nothing to acknowledge. Three rules keep both sides in step:

1. **The belly repeats itself.** Every five seconds it sends the current `P` and `V` lines, changed or not. A head that missed a line, or whose wire was unplugged and plugged back, is right again within five seconds.
2. **The head says hello.** When the head boots, it sends `$N1,H*1B` once. The belly answers at once with `P` and `V`, so a rebooted head does not wait for the next repeat.
3. **The head notices silence.** If no valid line arrives for 15 seconds, the belly is off or the wire is loose. The head keeps the last pose on screen and dims its backlight (guide 11), instead of freezing at full brightness.

When the belly boots, it starts from `parada` at stage 1 and sends it at once; the first `-estado` message from ntfy (the stream asks for `since=10m`, guide 7) corrects it.

### Why the head sends nothing else

The head has a six-axis IMU and could report taps or being picked up, and the TX wire is there for it. The bot keeps it to the hello for a reason: everything the head sends is something the belly must validate, act on and keep compatible across versions. With one message up, the head cannot ask the belly for anything, cannot cause a network request and cannot reach a secret. Guide 1's rule, "the belly owns every connection and every secret", is easier to keep when the other direction is almost empty.

### The UART on each board

Both sides use the ESP-IDF [UART driver](https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/api-reference/peripherals/uart.html) with the settings of guide 1: `UART_NUM_1`, 115200 baud, 8 data bits, no parity, 1 stop bit, no flow control, on a shared ground.

| Board            | TX     | RX     |
| ---------------- | ------ | ------ |
| Belly (ESP32-P4) | GPIO4  | GPIO5  |
| Head (ESP32-S3)  | GPIO14 | GPIO13 |

The calls are the ones in ESP-IDF's `uart_echo` example: `uart_driver_install` with a receive buffer, `uart_param_config`, `uart_set_pin`, then `uart_write_bytes` to send and `uart_read_bytes` with a timeout to receive. On the head, `uart_read_bytes` with a 200 ms timeout is also the clock of its main loop: it returns early when bytes arrive and otherwise lets the head check for silence.

## How it was asked of the AI

The link itself came from one of the author's first answers. Asked whether the head would join the network on its own or receive its data from the belly, the author said:

> Por cable desde la panza

In English: "by cable, from the belly".

And the head's job had been set at the very start:

> la cabeza va a ser una apntalla holografica que solo sea la cara de narsil

In English: "the head is going to be a holographic screen that is only Narsil's face".

Together, those two answers are the protocol's scope: a wire, and only what the face needs. The format was not the author's decision. The AI compared binary frames with text lines, and chose text lines with a version and a checksum because they can be read and typed by hand while testing. Mapping the pose from the `art` URL, instead of adding a new field on the PC, came from reading narsil-pet's `artUrl` and `sendStatus`: the information was already there, so nothing on the PC side had to change.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the conversation used to build the bot.

> Two ESP32 boards share a UART (UART_NUM_1, 115200 baud, shared ground). The body sends the head only a pose and a voice state; the head draws them and must survive reboots and unplugged wires. Design a line-based text protocol with a version field and a one-byte XOR checksum, list every message with an example and its checksum, and write both sides in ESP-IDF 6 with `uart_driver_install`, `uart_param_config`, `uart_set_pin`, `uart_write_bytes` and `uart_read_bytes`. The body repeats its state every 5 s; the head sends one hello at boot and nothing else. Explain how I test each side from a PC with a USB-serial adapter.

## The minimal code

The belly's side, in C++ next to Xiaozhi's code (MIT, like the site's own examples). `head_link_init` from guide 1 sets up the port; this adds the messages and the link task:

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

Call `head_link_init()` and then `StartHeadLink()` once at start; the link does not need Wi-Fi.

The head's side, in C (MIT). It reads one line at a time and fills a small state struct that guide 11 draws:

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

`head_link_poll` returns `true` for each valid line, after updating `state`, and `false` after `timeout_ms` with nothing valid. A `$` in the middle of garbage restarts the line, so the head picks up the next good message on its own.

## Common mistakes and how to test it

- **A checksum computed over the `$`.** The XOR covers only the bytes between `$` and `*`. `$N1,H*1B` is the reference: if your code gets another value for it, it includes too much.
- **Lowercase hex.** `%02X` writes `1B`; the head's `strtoul` accepts both cases, but a tool that compares strings may not.
- **`\r\n` from a terminal.** Many terminals send a carriage return before the newline. The head's `strlen(star) != 3` then fails; set the terminal to send `LF` only.
- **The belly's console on the link.** If boot messages appear on the head's side, the link is on UART0. It must be `UART_NUM_1` on GPIO4 and GPIO5 (guide 1).
- **A pose the head has no art for.** The belly only accepts narsil-pet's five pose names and stages 1 to 5, and the head checks them again.
- **Both boards silent after a reboot of the belly.** The belly sends at once when it starts, then every five seconds; if the head stays dim, swap the data wires (TX goes to RX).

To test each side without the other, use a 3.3 V USB-serial adapter and a terminal on the PC. pyserial comes with esptool, so `miniterm` is already there:

```powershell
python -m serial.tools.miniterm --eol LF COM7 115200
```

- **The belly alone.** Connect the adapter's RX to the belly's GPIO4 and its GND to the belly's GND. A `P` and a `V` line appear every five seconds. Say "Hi ESP" and a `$N1,V,listening*40` line appears at once. Run `/narsil movil prueba`, or finish a turn in Claude Code, and the `P` line changes with Narsil's pose.
- **The head alone.** Connect the adapter's TX to the head's GPIO13 and GND to GND, and its RX to GPIO14. Reset the head: `$N1,H*1B` arrives. Type `$N1,P,necesita,2*33` and press Enter: the head draws Narsil waiting at stage 2. Type the same line with a wrong checksum, `*34`: nothing changes.

Use 3.3 V adapters only. A 5 V adapter can damage the ESP32's pins.

## Going further

- **Brightness from the belly.** A message type such as `B,<percent>` would let the belly dim the head at night. Add it as a new type in version 1: old heads ignore types they do not know, because `apply` returns `false` for them.
- **Taps from the head.** The QMI8658 can detect a tap. A head-to-belly `T` line could mark the newest alert as read on the belly's screen of [guide 9](/en/bot/belly-ui/). Keep it to events, never requests.
- **A CRC.** For longer cables or more data, a CRC-16 replaces the XOR byte with four hexadecimal digits, under a new version, `N2`.
- The head's drawing, the mirrored image and the black background are [guide 11](/en/bot/holographic-head/).
