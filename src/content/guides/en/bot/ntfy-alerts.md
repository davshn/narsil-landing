---
title: "Narsil's alerts from ntfy"
description: "How the belly follows the same ntfy topic as Narsil's phone alerts: how narsil-pet builds the topic and its messages, what the key hides, and a JSON stream on ESP-IDF."
route: bot
order: 7
updated: 2026-11-18
---

## What it does

[Narsil for Claude Code](https://github.com/davshn/narsil-pet) already tells your phone when a conversation needs you: `/narsil movil` sends each alert to a private topic on [ntfy.sh](https://ntfy.sh), and the ntfy app shows it as a notification. The belly subscribes to the same topic. When Claude finishes, has a question or stops with an error, the alert appears on the belly's screen too, with Narsil's state next to it.

Nothing changes on the PC side: narsil-pet keeps publishing as it does for the phone, and the belly is one more reader of the topic. It reads two topics:

- **The alerts topic**, `narsil-` followed by 20 hexadecimal characters: one message per alert (done, question, error).
- **The status topic**, the same name with `-estado` at the end: a small JSON state sent as each turn ends, never shown as a notification.

## How it works inside

### How narsil-pet builds the topic

The topic name is made in `hooks/phone.ts`. The following excerpt is quoted from [davshn/narsil-pet](https://github.com/davshn/narsil-pet), licensed GPL-3.0-or-later:

```ts
// A topic nobody guesses: whoever knows its name can read it.
export function newTopic(uuid: string): string {
  return `narsil-${uuid
    .replace(/[^0-9a-f]/gi, '')
    .toLowerCase()
    .slice(0, 20)}`
}
```

It takes a random UUID, keeps its hexadecimal digits in lowercase and uses the first 20: a made-up example is `narsil-0123456789abcdef0123`. The status topic comes from the same file:

```ts
export function statusTopic(topic: string): string {
  return `${topic}-estado`
}
```

On public ntfy.sh the name is the only protection. The [ntfy configuration docs](https://docs.ntfy.sh/config/) say the server is open by default, and that "everyone can read and write to any topic (this is how ntfy.sh is configured)". The comment above `newTopic` says the same in fewer words. Treat the topic as a password: it does not go in the firmware repository, and `/narsil movil nuevo` makes a new one if it leaks.

### What an alert carries

`phoneMessage` in `hooks/phone.ts` builds the JSON that narsil-pet posts to ntfy.sh. In short:

- `title`: `Narsil · <title> · <conversation>`, with the name of the conversation the alert comes from.
- `message`: the alert's text, then the list of open conversations and their states, and on the day's last alert a note that it is the last one (narsil-pet sends at most 200 a day, under ntfy.sh's free 250).
- `priority`: 3 for `done`, 4 for `question` and `error`.
- `tags`: one tag that names the kind: `white_check_mark` (done), `raising_hand` (question) or `warning` (error).
- `icon`: Narsil's art at her current stage, in the pose of the alert.

So the belly can tell the kind of alert from its tag alone, and it knows the time from ntfy's own `time` field.

### What the status carries

The `-estado` message is a JSON object inside the ntfy message's `message` field, sent with priority 1. narsil-pet's README documents its fields: `xp` (Narsil's level and experience), `art` (the URL of her drawing at her stage, in the pose of the most important conversation), `at` (when it was sent, in Unix seconds), `cacheMinutes` (how long a cache lasts, when one exists) and `usage` (the day's ntfy count). The belly shows `xp` with ntfy's own time for the message, and reads the pose and stage from `art` to pass them on to the head ([guides 10](/en/bot/uart-protocol/) and [11](/en/bot/holographic-head/)).

### What the key hides, and what it does not

`/narsil movil clave` seals what narsil-pet sends, with a key only your devices hold (`hooks/seal.ts`, HMAC-SHA256 in counter mode with an encrypt-then-MAC tag). Be precise about what that covers. This is `sealedMessage` from `hooks/phone.ts`, quoted from [davshn/narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later):

```ts
export function sealedMessage<M extends { title?: string; message: string }>(
  m: M,
  sealed: string,
): M {
  return { ...m, ...(m.title ? { title: 'Narsil' } : {}), message: sealed }
}
```

Only `title` and `message` change: the title becomes "Narsil", and the text becomes a sealed string that starts with `narsil1:`. Everything else is copied as it was. With a key, anyone who knows the topic still sees:

- the **kind** of alert, from `tags` and `priority`;
- **when** it was sent, from ntfy's `time`;
- Narsil's **stage** and pose, from the `icon` URL.

The status message has no title, so its whole JSON is sealed and only its priority shows.

On the belly this means two modes. Without a key, it shows everything. With a key, it shows the kind, the time and the stage, and "Narsil" as the title; reading the text needs the key on the belly, which is under "Going further".

### Subscribing from the belly

ntfy's [subscribe API](https://docs.ntfy.sh/subscribe/api/) has a JSON stream: a long `GET` to `https://ntfy.sh/<topic>/json` that never ends, and "returns a JSON stream, with one JSON message object per line". Several topics fit in one connection, separated by commas, so the belly opens a single stream for both:

```text
https://ntfy.sh/narsil-0123456789abcdef0123,narsil-0123456789abcdef0123-estado/json
```

Each line is one event. The `event` field says which: `open` when the stream starts, `keepalive` now and then so the connection does not look dead, and `message` for the real thing. A `message` event has `id`, `time`, `topic`, `title`, `message`, `tags` and `priority`, among others.

On ESP-IDF the stream is read with [`esp_http_client`](https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/api-reference/protocols/esp_http_client.html) in its streaming order: `esp_http_client_open`, `esp_http_client_fetch_headers`, then `esp_http_client_read` in a loop, cutting the bytes into lines at each `\n`. HTTPS uses the ESP-IDF [certificate bundle](https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/api-reference/protocols/esp_crt_bundle.html) (`crt_bundle_attach = esp_crt_bundle_attach`), so no certificate is pasted into the code. Each line is parsed with cJSON, which Xiaozhi already uses for its own protocol.

### Not losing alerts on a reconnect

Wi-Fi drops, and long connections break. ntfy keeps messages for a while (the server's `cache-duration` defaults to 12 hours), and the `since=` parameter asks for what you missed: a duration like `10m`, a Unix time, or a message ID. The belly remembers the `id` of the last message it showed and reconnects with `since=<that id>`, so it gets exactly the alerts sent while it was away and none twice. On a fresh boot it has no ID and asks for `since=10m`.

### Where the topic lives

The topic is stored in the belly's NVS, through Xiaozhi's `Settings` class (`main/settings.h`), in the namespace `narsil` under the key `ntfy_topic`. You type it once on the belly's settings screen, which [guide 9](/en/bot/belly-ui/) builds; it never appears in the source code. [Guide 12](/en/bot/secrets-privacy/) explains why NVS is not encrypted by default and what that means for a device on your desk.

## How it was asked of the AI

The belly's job was in the author's first description of the bot:

> va a ser la pantalla grande para una pantalla en la pansa que va a tener la informacion de las tareas que hace narsil

In English: "it's going to be the big screen, for a screen in the belly that will have the information about the tasks Narsil does".

Narsil already publishes those tasks to ntfy for the phone, so the AI proposed reading that same topic instead of inventing a new channel from the PC. Then it asked whether the head would connect to the network on its own or receive everything from the belly, and the author answered:

> Por cable desde la panza

In English: "by cable, from the belly".

So the belly is the only board on the network for alerts: it subscribes to ntfy, and the head gets only pose and state over the wire ([guide 10](/en/bot/uart-protocol/)). How to reconnect, and what to show when a key is set, were not asked; the AI took them from ntfy's documentation and from narsil-pet's `sealedMessage`.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the conversation used to build the bot.

> My ESP32-P4 runs Xiaozhi (ESP-IDF 6). Add a FreeRTOS task that subscribes to two ntfy.sh topics in one JSON stream (`https://ntfy.sh/<a>,<b>/json`), reads it with `esp_http_client_open`, `esp_http_client_fetch_headers` and `esp_http_client_read`, splits it into lines, parses each with cJSON and passes `message` events to a callback. Use the certificate bundle, read the topic from NVS with Xiaozhi's `Settings` class, keep the last message ID and reconnect with `since=` after an error. Quote the ntfy docs for the stream format and the `since` parameter.

## The minimal code

A task for the belly, in C++ next to Xiaozhi's code (MIT, like the site's own examples). `ShowAlert` and `ShowStatus` are the screen's functions from [guide 9](/en/bot/belly-ui/):

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

Call `StartNtfy()` once Wi-Fi is up. `ShowAlert` receives the tag, so the screen can pick the right pose and color even when the text is sealed. The read timeout of two minutes is well above the gap between ntfy's keepalive events, so a quiet topic does not count as a dead connection.

## Common mistakes and how to test it

- **A stream that ends after the first lines.** `poll=1` returns the cache and closes; the bot's URL must not include it.
- **The whole cache on every reconnect.** Without `since=`, a reconnect brings nothing old; with `since=all`, it brings everything again. Use the last `id`.
- **A topic with an uppercase letter or a typo.** ntfy treats it as a different, empty topic. Copy it from `/narsil movil`, which prints the name.
- **Sealed text on the screen.** A message that starts with `narsil1:` was sealed by `/narsil movil clave`. Show "Narsil" and the kind from the tag, or add the key (Going further).
- **No alerts while you sit at the PC.** narsil-pet only sends while your last message came from Remote Control (its README explains why). `/narsil movil prueba` sends a test alert from anywhere.
- **The topic in the repository.** It goes in NVS through the settings screen, never in a source file or a default value.

To test without the belly, follow the stream from a terminal on the PC with the ntfy docs' own example, using your topic:

```powershell
curl.exe -s "https://ntfy.sh/narsil-0123456789abcdef0123/json"
```

Run `/narsil movil prueba` in Claude Code: a `message` line appears. Then do the same with the belly on: the alert shows on its screen, and the serial monitor (guide 2) shows the connection to ntfy.sh. Turn the router's Wi-Fi off for a minute, send another test, turn it back on: the belly reconnects with `since=` and shows the alert it missed.

## Going further

- **Reading sealed alerts.** `hooks/seal.ts` derives two keys from yours with HMAC-SHA256 (`enc` and `mac`), XORs the text with an HMAC keystream in 32-byte blocks and checks a tag over the nonce and the ciphertext. mbedTLS, part of ESP-IDF, has HMAC-SHA256; porting `unseal` lets the belly read the text while the topic shows noise.
- **Your own ntfy server.** ntfy can run at home with access control, so the topic is not public. narsil-pet posts to `https://ntfy.sh`, so both sides would have to change.
- **The status for the head.** The `-estado` message is what drives Narsil's pose on the head; [guide 10](/en/bot/uart-protocol/) sends it over the UART.
- Guide 8 adds the other list the belly shows: the pull requests that need you. The screen itself is [guide 9](/en/bot/belly-ui/).
