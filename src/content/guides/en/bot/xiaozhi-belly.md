---
title: Xiaozhi in the belly
description: 'What Xiaozhi is, how it runs on the Waveshare ESP32-P4 board, how the belly is pointed at your own server instead of xiaozhi.me, and what happens on first boot.'
route: bot
order: 3
updated: 2026-11-18
---

## What it does

Xiaozhi ([78/xiaozhi-esp32](https://github.com/78/xiaozhi-esp32), MIT) is open-source firmware that turns an ESP32 board into a voice assistant. It is what gives the belly its ears and its voice: it listens for a wake word, streams what you say to a server, and plays the answer back.

From its README, the parts the bot uses:

- **A voice pipeline.** Audio is compressed with Opus and streamed to a server, which runs speech recognition, a language model and speech synthesis, and streams the spoken answer back.
- **Two transports**: [WebSocket](https://github.com/78/xiaozhi-esp32/blob/main/docs/websocket.md), or [MQTT plus UDP](https://github.com/78/xiaozhi-esp32/blob/main/docs/mqtt-udp.md). The bot uses WebSocket.
- **Offline wake word** with Espressif's ESP-SR, so the board only starts streaming after it hears its wake word.
- **Device-side MCP**: the firmware exposes "tools" (the README names speaker, LED, servo and GPIO control) that the language model on the server can discover and call.
- **Wi-Fi provisioning** through a hotspot or BluFi, so no Wi-Fi password is compiled in.
- **A display layer** for LCD screens, with expressions and chat text.

Xiaozhi supports the bot's belly out of the box. By default it talks to the official service at xiaozhi.me; the bot talks to a server on your own PC instead (guide 4).

## How it works inside

### The board folder

Every board Xiaozhi supports has a folder under `main/boards/`. The belly's is `main/boards/waveshare/esp32-p4-wifi6-touch-lcd/`, shared by the whole ESP32-P4-WIFI6-Touch-LCD family (4B, 4.3, 5, 7B, 3.4C, 4C, 7, 8 and 10.1 inches). It holds:

- `esp32-p4-wifi6-touch-lcd.cc`: the board class, `WaveshareEsp32p4`, built on Xiaozhi's `WifiBoard`. It brings up the screen, the GT911 touch panel and the audio codec.
- `config.h`: the pins and sizes. For the 4.3-inch board it sets a 480 × 800 screen on 2 MIPI DSI lanes at 500 Mbps, audio at 24,000 Hz in and out, the ES8311 and ES7210 on I2C (GPIO7 and GPIO8), I2S on GPIO9 to GPIO13, and the BOOT button on GPIO35.
- `config.json`: the build variants that `scripts/build.py` knows.
- `README.md`: which menu option selects each size.

### Two variants for the same board

`config.json` lists two builds for the 4.3-inch board, and choosing the right one matters:

| Variant                         | Extra options                                                          | For                                |
| ------------------------------- | ---------------------------------------------------------------------- | ---------------------------------- |
| `esp32-p4-wifi6-touch-lcd-4.3`  | `CONFIG_ESP32P4_SELECTS_REV_LESS_V3=y`, `CONFIG_ESP32P4_REV_MIN_100=y` | ESP32-P4 silicon before revision 3 |
| `esp32-p4x-wifi6-touch-lcd-4.3` | none of those two                                                      | ESP32-P4 revision 3.x silicon      |

Both set `CONFIG_BOARD_TYPE_WAVESHARE_ESP32_P4_WIFI6_TOUCH_LCD_4_3=y`, device-side echo cancellation (`CONFIG_USE_DEVICE_AEC=y`) and the OV5647 camera options for the version that has one. Xiaozhi's README notes that ESP32-P4 Rev1 and Rev3 are both supported on IDF 6, and Waveshare's board support README describes the same split ("pre-v3 silicon" and "rev3.x or newer"). esptool prints the chip and its revision when it connects to the board, so check yours before the first build.

### How the belly finds its server

The address of the server is not compiled into the voice code. On every start, Xiaozhi asks an **OTA endpoint** for its settings, as its [OTA document](https://github.com/78/xiaozhi-esp32/blob/main/docs/ota.md) describes:

1. The board sends `POST` to the OTA URL with its identity (MAC address, a `Client-Id` UUID kept in NVS, board name, firmware version) and its capabilities.
2. The server answers with JSON: a `websocket` object (`url` and `token`) or an `mqtt` object, the server time, an optional firmware update, and an optional `activation` code.
3. The board saves the connection settings in NVS and opens the voice channel when it needs it.

The document's rule for picking the OTA URL: the firmware "uses a valid saved `wifi.ota_url`, otherwise `CONFIG_OTA_URL`". In `main/ota.cc`:

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

`CONFIG_OTA_URL` comes from `main/Kconfig.projbuild`, under the menu `Xiaozhi Assistant`, as "Default OTA URL", with the default `https://api.tenclass.net/xiaozhi/ota/` (the official service). So there are two ways to point the belly at your server:

- **Save the URL on the device** (what the bot does). The Wi-Fi setup page has an Advanced tab with an OTA URL field; what you type there is saved in NVS as `wifi/ota_url`.
- **Change the default in the build**, through `idf.py menuconfig` or by editing `Kconfig.projbuild`, as xinnan-tech's firmware guide does.

The bot saves it on the device because of a rule set for the whole project: secrets, and the server address with them, live in NVS or local configuration, never in the repository. A URL saved on the device never reaches git, and moving the server to another PC needs no rebuild.

### First boot and Wi-Fi provisioning

Wi-Fi comes from Xiaozhi's [esp-wifi-connect](https://github.com/78/esp-wifi-connect) component. Its README says it first tries the networks saved in flash, and if that fails it starts an access point and a web server at `http://192.168.4.1`. Xiaozhi's `WifiBoard` configures it with the prefix `Xiaozhi`, so the hotspot is called `Xiaozhi-` followed by four hexadecimal digits from the board's MAC address, and it turns on the Advanced tab's OTA field (`show_ota_config = true`).

The component validates the OTA URL before saving it: an empty value means "use the firmware's default", and anything else must be an absolute HTTP or HTTPS URL of at most 255 ASCII bytes, with a host.

Once connected, the belly calls your server's OTA endpoint. With the official service, the answer includes an activation code that you enter in the xiaozhi.me console. Your own server in its minimal mode sends back the WebSocket address and no activation code (guide 4), so there is nothing to bind and the belly goes straight to idle.

### A conversation, step by step

From Xiaozhi's WebSocket document:

1. **Idle → Connecting.** The wake word or the BOOT button opens the audio channel: the belly connects to the WebSocket URL, with `Authorization`, `Protocol-Version`, `Device-Id` and `Client-Id` headers, and sends a `"type": "hello"` message with its audio parameters.
2. **Connecting → Listening.** The server answers with its own `hello` and a session ID, the belly sends `listen` with `"state": "start"`, and the microphone audio goes up as Opus in binary frames.
3. **The server works.** It sends back `stt` with the text it heard, `llm` with an emotion for the face, and `tts` messages: `start`, then `sentence_start` with each sentence's text, then `stop`.
4. **Listening → Speaking → Idle.** On `tts` `start` the belly stops sending audio and plays what arrives; on `stop` it goes back to listening if auto-continue is on, otherwise to idle.

That `llm` emotion is useful later: it is the first thing the belly can forward to the head as a pose.

### Device-side MCP

Xiaozhi registers tools on the device through the `McpServer` singleton, with `AddTool(name, description, properties, callback)`. The server sends `initialize`, then `tools/list`, then `tools/call` over JSON-RPC 2.0, as its [MCP usage document](https://github.com/78/xiaozhi-esp32/blob/main/docs/mcp-usage.md) explains. This is how Narsil's brain will be able to act on the bot, not only talk through it; later guides add the bot's own tools.

## How it was asked of the AI

The voice was not in the first design. Once the two boards had their roles, the AI asked how Narsil should talk, and the author already had an answer:

> yo pensaba hacerlo con Xiaozhi

In English: "I was thinking of doing it with Xiaozhi".

The AI read Xiaozhi's README to check what it brings and what it requires: MIT license, the ESP32-P4 among its chip platforms, and ESP-IDF 6.0.1 or later (guide 2). That made Xiaozhi the base of the belly's firmware, and the repository a fork of it.

Then came where the voice is processed. Xiaozhi connects to xiaozhi.me by default, and the AI asked whether to use that service or a server of the author's own. The answer:

> servidor propio

In English: "own server".

That answer is why this guide spends time on the OTA URL: it is the single setting that moves the belly from the official service to yours. Guide 4 builds the server itself.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the conversation used to build the bot.

> I have a fork of 78/xiaozhi-esp32 and a Waveshare ESP32-P4-WIFI6-Touch-LCD-4.3. Read the board folder `main/boards/waveshare/esp32-p4-wifi6-touch-lcd/`, `main/Kconfig.projbuild`, `main/ota.cc` and `docs/ota.md`, then explain: which build variant fits my board and how I tell my chip revision, the exact `scripts/build.py` command, and every way the firmware decides which OTA URL to use. I want my server address kept out of the repository, so recommend the option that stores it on the device, and tell me what I will see on first boot.

## The minimal code

The belly needs no new code for this guide: it is Xiaozhi as it comes, built for the right board. From the root of the fork, in PowerShell, with the Docker image of guide 2:

```powershell
docker run --rm -v ${PWD}:/project -w /project -e HOME=/tmp -e IDF_GIT_SAFE_DIR=/project `
  espressif/idf:release-v6.1 `
  python scripts/build.py waveshare/esp32-p4-wifi6-touch-lcd --name esp32-p4-wifi6-touch-lcd-4.3 --language es-ES
```

- `waveshare/esp32-p4-wifi6-touch-lcd` is the board folder under `main/boards/`.
- `--name` picks the variant. Without it, `build.py` asks interactively, and in a container with no terminal it stops with "Multiple variants found in non-interactive mode; select one with --name." Use `esp32-p4x-wifi6-touch-lcd-4.3` for revision 3 silicon.
- `--language es-ES` makes the interface and voice prompts Spanish, Narsil's language; the default is `en-US`. With no `--wake-word`, `build.py` picks "Hi ESP" for every language except `zh-CN` and `zh-TW`.

The result is `build/merged-binary.bin`. Flash it from Windows (guide 2):

```powershell
esptool --port COM5 write-flash 0x0 build/merged-binary.bin
```

Then, on first boot:

1. On your phone, join the Wi-Fi network `Xiaozhi-` followed by four characters.
2. Open `http://192.168.4.1`.
3. On the **Advanced** tab, enter the OTA URL of your server, made of your PC's LAN address and port 8003 (guide 4), for example `http://192.168.1.50:8003/xiaozhi/ota/`. Save.
4. Choose your Wi-Fi network, enter its password, and save.

If you build with `idf.py` instead of `build.py`, the same board is selected in `idf.py menuconfig` under `Xiaozhi Assistant`, option "Waveshare ESP32-P4 Wi-Fi 6 Touch LCD 4.3".

## Common mistakes and how to test it

- **The wrong variant for your silicon.** The two 4.3-inch builds differ only in the chip revision they target. Check the revision esptool prints and pick the matching `--name`.
- **`127.0.0.1` or `localhost` as the OTA URL.** On the belly, those mean the belly itself. Use the PC's address on your network.
- **A URL the portal rejects.** It must be absolute (`http://` included), carry a host, and stay under 255 ASCII bytes. Keep the path exactly `/xiaozhi/ota/`, with the final slash, as the server prints it.
- **`https://` to a plain HTTP server.** The minimal server of guide 4 speaks plain HTTP on 8003.
- **An invalid URL saved earlier.** The firmware ignores it and falls back to `CONFIG_OTA_URL`, which is the official service. The monitor shows "Ignoring invalid saved OTA URL; using the default".
- **The hotspot comes back after a full re-flash.** Xiaozhi's WebSocket document says the `Client-Id` resets when NVS is erased or the full firmware is re-flashed; if the saved settings are gone too, enter Wi-Fi and the OTA URL again.
- **The board connects but never answers.** The PC's firewall may block ports 8000 and 8003, or the server may be off. The belly keeps retrying the OTA check: ten attempts, starting at ten seconds and doubling.

To test, open the monitor (guide 2) during the first boot. You should see the Wi-Fi connection, the OTA request to your URL and, once the server is up, no activation step. Then say the wake word, "Hi ESP": the belly switches to listening, and the server's log (guide 4) shows the connection and the text it heard.

## Going further

- Xiaozhi's [OTA document](https://github.com/78/xiaozhi-esp32/blob/main/docs/ota.md) describes how a server can also offer firmware updates; xinnan-tech's server can serve them from its `data/bin` folder, so the belly can update over Wi-Fi.
- `scripts/build.py --list-wake-words` lists the wake-word models of the current ESP-SR component, and `--wake-word` picks one.
- The [custom board guide](https://github.com/78/xiaozhi-esp32/blob/main/docs/custom-board.md) warns never to overwrite an existing board's configuration for a custom one, because OTA can replace your firmware with the stock one for that board. Keep it in mind whenever you add your own code to the belly.
- Xiaozhi can also show expressions on its own screen; [guide 9](/en/bot/belly-ui/) replaces the belly's screen with Narsil's own interface.
