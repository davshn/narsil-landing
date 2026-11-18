---
title: Secrets and privacy
description: 'Every secret the bot holds and where it lives, what NVS and flash encryption protect, what leaves your network and to whom, and how to wipe the bot and revoke each credential.'
route: bot
order: 12
updated: 2026-11-18
---

## What it does

The bot is a microphone on your desk with your GitHub token inside, so it deserves one guide that puts the whole picture in one place. This one answers three questions:

- **What secrets does the bot hold, and where?** Seven of them, on two machines, and none in the repository.
- **What leaves your network?** Your voice goes to one company, your words to another, Narsil's answers to a third, and two services see the belly connect.
- **How do you take it all back?** How to wipe the belly, and how to revoke each credential at its source.

Nothing here is new code. It collects what guides 3 to 11 set up, and adds the options ESP-IDF offers to protect what is stored on the board.

## How it works inside

### The secrets, and where each one lives

| Secret                   | Lives in                                                 | Set by                     | Gives access to                       |
| ------------------------ | -------------------------------------------------------- | -------------------------- | ------------------------------------- |
| Wi-Fi name and password  | Belly NVS, namespace `wifi`, keys `ssid` and `password`  | Wi-Fi portal (guide 3)     | Your home network                     |
| OTA URL (server address) | Belly NVS, `wifi/ota_url`                                | Wi-Fi portal, Advanced tab | Where the belly sends your voice      |
| WebSocket URL and token  | Belly NVS, namespace `websocket`, keys `url` and `token` | Your server's OTA answer   | Talking to your server                |
| ntfy topic               | Belly NVS, namespace `narsil`, key `ntfy_topic`          | Settings screen (guide 9)  | Reading (and writing) Narsil's alerts |
| GitHub token             | Belly NVS, namespace `narsil`, key `gh_token`            | Settings screen (guide 9)  | Reading pull requests you can see     |
| Anthropic API key        | Your PC: `ANTHROPIC_API_KEY` or `data/.config.yaml`      | You (guide 5)              | Spending on your Anthropic account    |
| OpenAI API key           | Your PC: `data/.config.yaml`, block `OpenaiASR`          | You (guide 4)              | Spending on your OpenAI account       |

The namespaces come from the code: esp-wifi-connect's `ssid_manager.cc` opens `"wifi"` and reads `ssid`, `password` and their numbered copies (up to ten networks); Xiaozhi's `main/ota.cc` saves the WebSocket settings with `Settings settings("websocket", true)`; guides 7 to 9 use `narsil`.

Three things are worth noticing in that table:

- **The two API keys, the ones that cost money, never touch the bot.** The belly talks only to your server on the LAN; the server holds the keys. A stolen bot cannot run up an Anthropic or OpenAI bill.
- **The head holds nothing.** Its firmware has Narsil's art and the UART code. Anyone can read its flash and learn nothing (guide 10 explains why it was kept that way).
- **The repository holds nothing.** No topic, token, key or address appears in `davshn/narsil-bot`. The firmware is public, and that is why.

### Why NVS, and what NVS protects

NVS (non-volatile storage) is ESP-IDF's key-value store in a flash partition; Xiaozhi's `Settings` class (`main/settings.h`) is a thin wrapper over it. For the belly the partition is called `nvs` in Xiaozhi's partition tables (`partitions/v2/32m.csv` gives it 840 KB).

By default, NVS is **not encrypted**. ESP-IDF's `CONFIG_NVS_ENCRYPTION` defaults to on only when flash encryption is enabled, and Xiaozhi does not enable it. So anyone with the board in their hands and a USB cable can read the flash with esptool and find the Wi-Fi password, the topic and the token in it as plain text. For a bot that sits on your own desk, that is an acceptable risk for most people, as long as you know it and know how to revoke things (below). If the bot travels, sits in an office, or leaves your hands, the options below exist.

### NVS encryption on the ESP32-P4

ESP-IDF's [NVS encryption page](https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/api-reference/storage/nvs_encryption.html) describes two schemes for this chip. Both use XTS-AES, and the Kconfig help says it encrypts "the complete NVS data, except the page headers".

| Scheme                 | Where the keys live                                                                   | Needs flash encryption | Cost                                                           |
| ---------------------- | ------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------- |
| Flash encryption-based | An `nvs_keys` partition (data, subtype `nvs_keys`, marked `encrypted`, at least 4 KB) | Yes                    | Everything flash encryption costs (next section)               |
| HMAC peripheral-based  | Derived at runtime from an HMAC key in eFuse; never stored in flash                   | No                     | Burns one eFuse key block for good, with the purpose `HMAC_UP` |

The options are `CONFIG_NVS_ENCRYPTION`, and `CONFIG_NVS_SEC_KEY_PROTECTION_SCHEME` to choose between `CONFIG_NVS_SEC_KEY_PROTECT_USING_FLASH_ENC` and `CONFIG_NVS_SEC_KEY_PROTECT_USING_HMAC`. For HMAC, `CONFIG_NVS_SEC_HMAC_EFUSE_KEY_ID` must name the eFuse block (0 to 5; the default, -1, does not build). With encryption on, `nvs_flash_init()` sets up the encrypted default partition and generates its keys, so Xiaozhi's code does not change.

The HMAC scheme is the lighter one: the page says it enables "secure storage on ESP32-P4 without enabling flash encryption". It protects against someone reading the flash chip. It does not, on its own, stop someone who can flash new firmware onto the board from running code that uses the same eFuse key; that is what secure boot is for.

### Flash encryption, and its trade-offs

[Flash encryption](https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/security/flash-encryption.html) encrypts the firmware and the data in flash, so "physical readout of flash will not be sufficient to recover most flash contents". It is switched on with `CONFIG_SECURE_FLASH_ENC_ENABLED` and comes in two modes:

- **Development mode** (the default) still lets you flash new plaintext firmware over USB; the bootloader encrypts it. It can be turned off again, but only once per chip.
- **Release mode** blocks the USB bootloader from flash encryption operations; new firmware arrives only by OTA. Choosing Release in menuconfig does not burn the eFuses by itself; `esp_flash_encryption_set_release_mode()` does.

The same page is clear about its limits: flash encryption "alone may not prevent an attacker from modifying the firmware of the device", it does not hide the flash layout, and it recommends secure boot alongside it. And it changes how you work: a plaintext image flashed by mistake onto an encrypted board soft-bricks it into a reboot loop. For a hobby bot that is re-flashed every evening, that is a real cost.

The bot ships with neither. It keeps the secrets that matter most (the API keys) off the board, uses a read-only, expiring GitHub token, and treats the board's contents as revocable. Encrypting NVS with HMAC is the step to take if the board leaves your desk.

### What leaves your network

| What                                 | Goes to                         | Why                                        |
| ------------------------------------ | ------------------------------- | ------------------------------------------ |
| Your voice, as audio                 | OpenAI (`api.openai.com`)       | `OpenaiASR` turns it into text (guide 4)   |
| What you said, as text, and history  | Anthropic (`api.anthropic.com`) | Claude writes Narsil's answer (guide 5)    |
| Narsil's answers, as text            | Microsoft                       | `EdgeTTS` turns them into speech (guide 6) |
| A subscription to your ntfy topics   | ntfy.sh                         | Narsil's alerts (guide 7)                  |
| Your GitHub token and a search query | GitHub (`api.github.com`)       | Your pull requests (guide 8)               |

Be precise about the voice. The wake word is recognized on the belly itself, with ESP-SR, so nothing is streamed before you say "Hi ESP". After it, the belly streams what the microphones hear to your server, on the LAN. The server does not keep that audio at home: with `OpenaiASR`, each thing you say is sent **as audio** to OpenAI's transcription endpoint (`base_url: https://api.openai.com/v1/audio/transcriptions` in `config.yaml`), and the text comes back. Guide 4 lists the offline alternative: `VoskASR`, which runs on the PC with a downloaded model, keeps the audio on your network, at some cost in accuracy.

Each provider handles that data under its own terms for API use; read [Anthropic's](https://www.anthropic.com/legal/commercial-terms) and OpenAI's before you decide. EdgeTTS needs no account, which also means no agreement of yours covers what it receives.

ntfy.sh sees the belly's IP address and the name of the topics it follows. Without a key, it also sees every alert's text; with `/narsil movil clave`, it sees only the kind, the time and the stage (guide 7). GitHub sees the token, the query and the answer, over HTTPS.

### What stays on your network

- The audio between the belly and your server, over WebSocket on the LAN. It is plain `ws://`, not TLS, so it is as private as your network is: keep the bot on your home Wi-Fi, not a shared one.
- The UART between belly and head, three wires inside the bot.
- The OTA check, which goes to your server's address. One detail matters here: if the saved OTA URL is invalid, Xiaozhi falls back to `CONFIG_OTA_URL`, the official service at `api.tenclass.net` (guide 3). The monitor says "Ignoring invalid saved OTA URL; using the default" when that happens; if you see it, fix the URL.

### Wiping the bot

Three levels, from lightest to complete:

- **Only Narsil's secrets.** A "Forget" button on the settings screen of guide 9 that calls `Settings("narsil", true).EraseAll()` erases the topic and the token, and nothing else.
- **Everything on the belly.** From Windows, with the belly on its USB port (guide 2):

  ```powershell
  esptool --port COM5 erase-flash
  ```

  This erases the whole flash: firmware, NVS, Wi-Fi password, server address, topic and token. Flash the firmware again afterwards (guide 3); the belly then boots into Wi-Fi setup like a new one. The equivalent from ESP-IDF is `idf.py erase-flash`.

- **The head.** It holds no secrets, so there is nothing to wipe. The same `erase-flash` on its port removes the firmware if you give the board away.

### Revoking each credential

Wiping the board protects the board. Revoking the credential protects you even when the board is gone. If the bot is lost or stolen, or the flash was read, do all of these, starting with the token:

| Credential     | How to revoke it                                                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub token   | [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens), **Delete** next to the token (guide 8).          |
| ntfy topic     | `/narsil movil nuevo` in Claude Code makes a new topic; the old one stops receiving. Type the new one on the belly.                                |
| Wi-Fi password | Change it on the router. Every device needs the new one, which is why it comes after the others.                                                   |
| Anthropic key  | Delete it in the [Claude Console](https://platform.claude.com/settings/keys) (guide 5). It never was on the bot; rotate it if the PC was involved. |
| OpenAI key     | Delete it on OpenAI's API keys page. Same rule: it lives on the PC.                                                                                |

## How it was asked of the AI

The rule behind this guide came from the decision about where the firmware lives. The AI asked whether the bot's code should go in a repository of its own, and the author answered:

> repo propio como fork

In English: "own repository, as a fork".

Then the AI asked whether that repository would be public from the start or private, and the author chose the first option:

> 1

A public repository changes everything about secrets: anything committed is published. So the AI set the rule written as spec S6, that the GitHub token, the ntfy topic, the key and the server address live in NVS or local configuration, never in the repository, and every guide since has followed it.

Where the voice is processed had been decided before, with the same consequence for the API keys:

> servidor propio

In English: "own server". And where it runs:

> en el pc, igual la idea es usarlo para trabajar con claude

In English: "on the PC, the idea is to use it to work with Claude anyway".

That is why the paid keys stay on the PC. Which recognizer to use was the AI's call from the server's documentation; it chose `OpenaiASR` because the default offline recognizer does not support Spanish, and this guide is where that choice is spelled out as audio leaving the network.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the conversation used to build the bot.

> My desk bot is an ESP32-P4 running a fork of 78/xiaozhi-esp32, talking to xinnan-tech/xiaozhi-esp32-server on my PC with OpenaiASR, a Claude provider and EdgeTTS, plus ntfy.sh and the GitHub REST API from the board. List every secret it holds and where (read `main/settings.h`, `main/ota.cc` and esp-wifi-connect's `ssid_manager.cc` for the NVS namespaces), everything that leaves my network and to whom, and what stays on the LAN. Then explain ESP-IDF 6's NVS encryption schemes for the ESP32-P4 and flash encryption, quoting their docs, with the trade-offs for a hobby device I re-flash often. Finish with how to wipe the board and revoke each credential.

## The minimal code

The bot needs no new code for this guide. The one optional piece is the "Forget" button, added to guide 9's settings screen next to "Back":

```cpp
static void OnForget(lv_event_t*) {
    {
        Settings settings("narsil", true);
        settings.EraseAll();
    }
    esp_restart();
}
```

```cpp
Button(settings_screen, "Forget topic and token", OnForget);
```

`EraseAll` is part of Xiaozhi's `Settings` class; it erases every key in the `narsil` namespace, and the destructor commits it before the restart.

If you choose to encrypt NVS with the HMAC scheme, the change is configuration, not code. In `idf.py menuconfig`, enable `CONFIG_NVS_ENCRYPTION`, choose `CONFIG_NVS_SEC_KEY_PROTECT_USING_HMAC`, and set `CONFIG_NVS_SEC_HMAC_EFUSE_KEY_ID` to a free eFuse block. Read the NVS encryption page first: the eFuse block is used for good, and NVS written before the change is not readable after it, so erase the flash and set the bot up again.

## Common mistakes and how to test it

- **A secret in a commit.** Before every push to the public repository, search the diff for `github_pat_`, `narsil-`, `sk-ant-` and your LAN address. A real token in a test file is a leak; use made-up values like `github_pat_EXAMPLE_not_a_real_token`.
- **Secrets in the log.** Never print the token, the topic or the Wi-Fi password, even while debugging: a monitor log pasted into an issue publishes them.
- **`sdkconfig` with your settings.** If you put the server address in `CONFIG_OTA_URL` instead of the portal, it ends up in `sdkconfig`, and from there in a commit. Guide 3 saves it on the device for this reason.
- **Revoking only one thing.** A lost bot holds the token, the topic and the Wi-Fi password. Revoke all three.

To test what the board holds, read its NVS back and look. With the belly on COM5, `esptool --port COM5 read-flash 0 ALL belly.bin` dumps the flash; search the file for your topic. With NVS unencrypted it is there in plain text; with the HMAC scheme it is not. Delete `belly.bin` afterwards: it contains your secrets.

To test what leaves the network, watch your server's log (guide 4) while you talk: the recognized text appears after each sentence, which is the moment the audio went to OpenAI. Turn the PC's internet off and talk again: the belly still connects to the server on the LAN, but recognition fails, which shows the audio had nowhere local to go.

## Going further

- **Offline recognition.** `VoskASR` in the server keeps your voice on your network; check its Spanish model and compare the accuracy with `OpenaiASR`.
- **Your own ntfy server.** Running ntfy at home with access control takes the topic off the public internet. narsil-pet posts to `https://ntfy.sh`, so both sides would change (guide 7).
- Back to the start of the path: the parts and the wiring are in [guide 1](/en/bot/the-bot/).
