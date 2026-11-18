---
title: The toolchain
description: "Which ESP-IDF version the bot needs and why, building both boards in Espressif's Docker image, and flashing them from Windows, where Docker cannot reach the USB ports."
route: bot
order: 2
updated: 2026-11-18
---

## What it does

Both boards are programmed with ESP-IDF, Espressif's official framework for ESP32 chips. This guide sets up one toolchain that builds the belly (ESP32-P4, Xiaozhi) and the head (ESP32-S3, our own firmware), and explains how the firmware gets from your PC into each board.

The short version:

- **One ESP-IDF version for both boards:** the `release/v6.1` branch.
- **Building happens in Docker**, in Espressif's image `espressif/idf:release-v6.1`, so nothing but Docker is installed on the PC.
- **Flashing happens from Windows itself**, because a Docker container on Windows cannot see USB serial ports.

If you prefer an editor with buttons, the ESP-IDF extension for VS Code does the same job natively, and this guide covers it too.

## How it works inside

### Two documented versions, one choice

The two sources for the belly disagree on the version:

- **Waveshare** recommends ESP-IDF V5.3.1 or later for the ESP32-P4-WIFI6-Touch-LCD-4.3 on its [ESP-IDF page](https://docs.waveshare.com/ESP32-P4-WIFI6-Touch-LCD-4.3/ESP-IDF/), and its walkthrough uses V5.5.2.
- **Xiaozhi** (78/xiaozhi-esp32) says in its README that the project now requires ESP-IDF v6.0.1 or later, recommends the `release/v6.1` branch, and states that ESP-IDF 5.x is no longer supported.

The bot follows Xiaozhi, because Xiaozhi is the firmware that runs on the belly. A 5.x toolchain cannot build it at all, while the board itself does not care: Waveshare's own board support package declares `idf: '>=5.4'`, so 6.x is inside its range. Waveshare's 5.3.1 is a floor for its examples, not a ceiling.

Xiaozhi recommends the branch, not the `v6.1` tag, for a concrete reason: its README links issue #2344, where the `v6.1` tag ships an ESP32-C3 Wi-Fi library that does not match its own header. Xiaozhi's own CI builds every board in the `espressif/idf:release-v6.1` image, so the bot uses exactly that image. After switching ESP-IDF revisions, the README asks for `idf.py fullclean` in the project before rebuilding.

The head runs our own small firmware, so it has no version requirement of its own. It is built with the same image, which means one toolchain, one set of habits and one cache.

### Building in Docker

Espressif publishes ESP-IDF as a Docker image, documented in the [IDF Docker Image guide](https://docs.espressif.com/projects/esp-idf/en/latest/esp32p4/api-guides/tools/idf-docker-image.html). Its tags follow three patterns: `latest` follows `master`, `vX.Y` matches a release, and `release-vX.Y` follows that release branch. The container has ESP-IDF, the compilers and Python ready; your project folder is mounted into it.

The documented command, from the project folder, is:

```bash
docker run --rm -v $PWD:/project -w /project -u $UID -e HOME=/tmp espressif/idf idf.py build
```

- `--rm` removes the container when the build ends.
- `-v $PWD:/project` mounts your folder at `/project`, so the build output lands in your folder.
- `-w /project` starts in that folder.
- `-u $UID` (Linux and macOS) keeps the output files owned by you, not by root.
- `-e HOME=/tmp` gives `idf.py` somewhere to keep its cache.

The guide also documents `-e IDF_GIT_SAFE_DIR='/project'` for the case where git reports "dubious ownership" of the mounted repository, which happens easily on a Windows drive.

### Targets: `esp32p4` and `esp32s3`

ESP-IDF builds for one chip at a time, chosen with `idf.py set-target`. The commands from Espressif's [Windows start guide](https://docs.espressif.com/projects/esp-idf/en/v6.1/esp32p4/get-started/windows-start-project.html) are:

```bash
idf.py set-target esp32p4
idf.py menuconfig
idf.py build
idf.py -p PORT flash
idf.py -p PORT monitor
```

The head uses `idf.py set-target esp32s3`. Xiaozhi's custom board guide sets the target "first time, or when switching targets", not before every build. To leave the monitor, press `Ctrl+]`.

For the belly, Xiaozhi wraps these steps in `scripts/build.py`, which reads the board's `config.json`, sets the target and the board's options, builds, and merges everything into `build/merged-binary.bin`. Guide 3 uses it.

### Why Docker cannot flash on Windows

The IDF Docker guide says it plainly: commands that talk to the board, such as `idf.py flash` and `idf.py monitor`, need the serial port passed into the container. On Linux, Docker's device option does that. On Windows the guide says "currently, this is not possible with Docker for Windows", and the same limitation applies to Docker for Mac.

So the bot splits the work: Docker builds, Windows flashes. There are two ways to do the second half, both from Espressif's documentation.

**From the host with esptool.** esptool is Espressif's flashing tool. A merged binary, like Xiaozhi's `merged-binary.bin`, goes at offset `0x0`; esptool's [basic commands page](https://docs.espressif.com/projects/esptool/en/latest/esp32p4/esptool/basic-commands.html) shows the form `esptool --port COM4 write-flash 0x1000 my_app-0x01000.bin` and says a merged file is written with `write-flash 0x0`. It also notes that `--chip` is optional when writing, because esptool detects the chip when it connects. On Windows, esptool ships as a ready-made executable in the esptool release ZIP; on Linux or macOS, `pip install esptool`.

**Through a serial bridge (RFC2217).** The IDF Docker guide's workaround: run `esp_rfc2217_server` on Windows to share the COM port over the network, and point `idf.py` inside the container at it. `host.docker.internal` is the name Docker gives the host. This keeps `idf.py flash` working for any project, including the head, which has no merged binary.

### USB ports and drivers on Windows

On Windows, serial ports are named `COM` followed by a number. Espressif's [serial connection guide](https://docs.espressif.com/projects/esp-idf/en/v6.1/esp32p4/get-started/establish-serial-connection.html) gives the simplest way to find the right one: open Device Manager, unplug the board, plug it back in, and the port that disappears and comes back is yours. It also says the USB-to-serial drivers usually come with the operating system and install by themselves.

For each board:

- **The belly** is flashed through its Type-C port marked "USB to UART", which Waveshare describes as the port for power, programming and debugging. Waveshare's ESP-IDF page recommends installing the drivers through the ESP-IDF Installation Manager (EIM).
- **The head** has a CH343P USB-to-serial chip (WCH), listed on Waveshare's product page.

If a board does not enter download mode by itself, or for its first flash, Espressif's guide gives the manual way: hold BOOT, press RESET once, release BOOT.

### The alternative: VS Code

Espressif's [Get Started page](https://docs.espressif.com/projects/esp-idf/en/v6.1/esp32p4/get-started/index.html) recommends two installation paths: the ESP-IDF Installation Manager (EIM), and an IDE, either Espressif-IDE or VS Code with the ESP-IDF extension. Waveshare's ESP-IDF page walks through EIM plus the VS Code extension on Windows: install ESP-IDF with EIM (in a path without spaces), then the extension, which from version 2.0 detects the installation by itself. The bottom toolbar then has buttons to pick the COM port, set the target (`esp32p4`), build, flash and open the monitor.

A native install flashes directly, with no bridge. The cost is a large install on the PC, and you have to install the same `release/v6.1` branch Xiaozhi asks for, not whichever version EIM offers first.

## How it was asked of the AI

The toolchain question came from an earlier decision. When the AI asked what the belly should run to give Narsil a voice, the author answered:

> yo pensaba hacerlo con Xiaozhi

In English: "I was thinking of doing it with Xiaozhi".

The AI then read Xiaozhi's README and found its requirement, ESP-IDF 6.0.1 or later, and put it next to Waveshare's documented 5.3.1. It recorded the gap as a risk in the task document, together with the plan to build in Espressif's Docker image and leave flashing and the on-screen checks to the person with the boards. The rule it applied is the one in this guide: the firmware that runs decides the version, and the board's documentation only sets a minimum.

The second decision that shapes the toolchain is where the code lives. Asked about the firmware's home, the author chose:

> repo propio como fork

In English: "own repository, as a fork".

Then, asked whether it should be public or private from the start, the author answered "1", the first option offered: public from the start. That is why both boards build from one repository, `davshn/narsil-bot`, and why the toolchain has to handle two targets in one tree.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the conversation used to set up the bot.

> I build ESP32 firmware on Windows with Docker and do not want ESP-IDF installed natively. My project is a fork of 78/xiaozhi-esp32 for an ESP32-P4 board, plus a small ESP-IDF app for an ESP32-S3 in a subfolder. Read Xiaozhi's README and CI workflow and Espressif's IDF Docker Image guide, then tell me: which `espressif/idf` tag to use and why, the exact `docker run` command to build each target from PowerShell, and how to flash and monitor each board from Windows given that Docker cannot pass USB serial ports through. Quote the documentation for every version and command.

## The minimal code

Building the belly, from the root of the fork in PowerShell (`${PWD}` is PowerShell's current folder; the `-u $UID` flag is for Linux and macOS and is left out here):

```powershell
docker run --rm -v ${PWD}:/project -w /project -e HOME=/tmp -e IDF_GIT_SAFE_DIR=/project `
  espressif/idf:release-v6.1 `
  python scripts/build.py waveshare/esp32-p4-wifi6-touch-lcd --name esp32-p4-wifi6-touch-lcd-4.3 --language es-ES
```

Guide 3 explains the board folder, the `--name` and the language. Building the head, from its folder:

```powershell
docker run --rm -v ${PWD}:/project -w /project/head -e HOME=/tmp -e IDF_GIT_SAFE_DIR=/project `
  espressif/idf:release-v6.1 `
  sh -c "idf.py set-target esp32s3 && idf.py build"
```

Flashing the belly from Windows with esptool, using a made-up port name:

```powershell
esptool --port COM5 write-flash 0x0 build/merged-binary.bin
```

Flashing the head through the serial bridge. In one terminal, share the port:

```powershell
esp_rfc2217_server -v -p 4000 COM6
```

In another, flash from the container:

```powershell
docker run --rm -v ${PWD}:/project -w /project/head -e HOME=/tmp -e IDF_GIT_SAFE_DIR=/project `
  espressif/idf:release-v6.1 `
  idf.py --port "rfc2217://host.docker.internal:4000?ign_set_control" flash
```

For the monitor, the same `--port` works with `idf.py monitor`; add `-it` to `docker run` so the container has a terminal to draw in.

## Common mistakes and how to test it

- **Building Xiaozhi with ESP-IDF 5.x.** Xiaozhi's README is explicit that 5.x is no longer supported. If you followed Waveshare's setup page and installed 5.5.2, the belly will not build; use `release-v6.1`.
- **Mixing build folders after a version change.** Xiaozhi's README asks for `idf.py fullclean` after switching ESP-IDF revisions. A stale `build` folder from another version gives errors that look unrelated.
- **Trying `--device` on Windows.** It works on Linux only. On Windows, flash from the host or through `esp_rfc2217_server`.
- **"dubious ownership" from git inside the container.** Pass `-e IDF_GIT_SAFE_DIR=/project`, as the IDF Docker guide documents.
- **No COM port appears.** Unplug and replug while watching Device Manager. If nothing changes, try another cable: a charge-only USB cable has no data lines.
- **The wrong port on the belly.** Flash through the Type-C port marked "USB to UART", not the USB OTG one.
- **The board does not answer esptool.** Hold BOOT, press RESET, release BOOT, and flash again.

To test the toolchain before Xiaozhi, build ESP-IDF's `hello_world` example for each target in the container, flash it, and look for its output in the monitor. If both boards print, the toolchain, the drivers and the cables are all right.

## Going further

- `docker run` with `-it` and no command opens a shell in the container, where you can run `idf.py menuconfig` and the other commands interactively, as the IDF Docker guide shows.
- Pin the image by digest instead of by tag if you want every build of the bot to use exactly the same ESP-IDF commit; `release-v6.1` moves as the branch moves.
- Xiaozhi's `scripts/build.py --list-boards` prints every board and variant it knows, which is a quick way to check a board name before a long build.
- The full ESP-IDF command reference lives in Espressif's documentation for each chip; switch the chip in the URL (`esp32p4`, `esp32s3`) to see its own pages.
