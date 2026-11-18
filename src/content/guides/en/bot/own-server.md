---
title: Your own server
description: "Running xinnan-tech's xiaozhi-esp32-server in minimal mode with Docker on your PC, on the local network only: its configuration, its ports, and how the belly finds it."
route: bot
order: 4
updated: 2026-11-18
---

## What it does

Xiaozhi on the belly does not understand speech or think. It records, compresses and plays. The listening, thinking and speaking happen on a server: by default the official one at xiaozhi.me, and in this bot, a server on your own PC.

That server is [xinnan-tech/xiaozhi-esp32-server](https://github.com/xinnan-tech/xiaozhi-esp32-server), the Python server that Xiaozhi's README lists first for deployment on personal computers. For each conversation it:

1. Receives the belly's audio over WebSocket.
2. Detects where you start and stop speaking (voice activity detection).
3. Turns your speech into text (speech recognition, ASR).
4. Sends the text to a language model (LLM). In this bot, Claude, from guide 5.
5. Turns the answer into speech (synthesis, TTS) and streams it back.

It also answers the belly's OTA request, which is how the belly learns where the WebSocket is (guide 3).

The bot runs it in the project's **minimal mode**, which the English README calls "Simplified Installation": one agent, data stored in configuration files, no database and no web console. It runs in Docker on the PC you work on, and it is reachable only from your local network.

## How it works inside

### Why only on your local network

The project's README is direct about its maturity. Its English translation says the project "has not passed network security assessment", asks you not to use it in production, and asks for protective measures if you deploy it on a public network to learn. The original Chinese says the same: "未通过网络安全测评".

The bot takes the safe reading: the server never faces the internet. No port is forwarded on the router, and only devices on your network can reach it. The default configuration agrees with that use: authentication is off (`server.auth.enabled: false`), which is acceptable on a home network and not on the internet.

### Modules: what each step uses

`main/xiaozhi-server/config.yaml` picks one provider per step under `selected_module`. The defaults:

| Step               | Key      | Default         | Notes from `config.yaml`                     |
| ------------------ | -------- | --------------- | -------------------------------------------- |
| Voice activity     | `VAD`    | `SileroVAD`     | Local model                                  |
| Speech recognition | `ASR`    | `FunASR`        | Local, offline, SenseVoiceSmall model        |
| Language model     | `LLM`    | `ChatGLMLLM`    | Needs a key; guide 5 replaces it with Claude |
| Vision model       | `VLLM`   | `ChatGLMVLLM`   | Not used by the bot                          |
| Speech synthesis   | `TTS`    | `EdgeTTS`       | Voice `zh-CN-XiaoxiaoNeural` by default      |
| Memory             | `Memory` | `nomem`         | No memory between conversations              |
| Intent             | `Intent` | `function_call` | The model calls tools directly               |

Each name points to a block of the same name further down the file (`ASR.FunASR`, `TTS.EdgeTTS` and so on) with that provider's settings.

### `config.yaml` and `data/.config.yaml`

The comments at the top of `config.yaml` give the rule: create `data/.config.yaml` and put your changes there, not in `config.yaml`. The server reads `data/.config.yaml` first and takes anything missing from `config.yaml`. The deployment guide calls this the most concise way, and the comment adds why it matters: it keeps your keys out of the project's own file.

For the bot this means `data/.config.yaml` holds only what differs from the defaults: the WebSocket address, the time zone, the providers chosen, and their keys. It lives on your PC, outside any repository.

### Ports

The project's `docker-compose.yml` publishes two ports:

| Port | Setting            | What it serves                                                         |
| ---- | ------------------ | ---------------------------------------------------------------------- |
| 8000 | `server.port`      | The WebSocket the belly talks to, at `/xiaozhi/v1/`                    |
| 8003 | `server.http_port` | HTTP: the simple OTA interface at `/xiaozhi/ota/`, and vision analysis |

The server listens on `0.0.0.0` (`server.ip`), meaning every network interface of the container. Docker publishes those ports on the PC.

### How the belly finds it

Two addresses matter, both built from your PC's address on the local network (here the made-up `192.168.1.50`):

- **OTA URL:** `http://192.168.1.50:8003/xiaozhi/ota/`. You type it on the belly once, in the Wi-Fi portal's Advanced tab (guide 3).
- **WebSocket URL:** `ws://192.168.1.50:8000/xiaozhi/v1/`. The server sends it to the belly in its OTA answer.

The second one needs care in Docker. The server builds the WebSocket address itself only while `server.websocket` still holds the placeholder from `config.yaml` (`ws://你的ip或者域名:端口号/xiaozhi/v1/`, "your IP or domain : port"). Inside a container, the address it sees is the container's, not your PC's. The [deployment guide](https://github.com/xinnan-tech/xiaozhi-esp32-server/blob/main/docs/Deployment.md) warns that with Docker the addresses in the startup log are not the real ones, and that the right method is to use the PC's LAN address. So the bot sets `server.websocket` explicitly, and the OTA handler then sends exactly that value. Because no `mqtt_gateway` is configured, it sends a `websocket` object, which is what selects WebSocket on the belly.

One more setting goes with it: `server.timezone_offset`, the time zone the OTA answer reports to the belly. The default `+8` is China's time; set yours.

### Local or API: choosing speech recognition and synthesis

Each step can run on your PC or call a cloud API. `config.yaml` documents both kinds:

| Kind  | Speech recognition (ASR)                                    | Speech synthesis (TTS)                                                                             |
| ----- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Local | `FunASR` (default), `SherpaASR`, `VoskASR` (offline)        | `FishSpeech`, `PaddleSpeechTTS`, `IndexStreamTTS`, `GPT_SOVITS_V2` (each needs its own deployment) |
| API   | `OpenaiASR`, `GroqASR`, `AliyunASR`, `DoubaoASR` and others | `OpenAITTS`, `AliyunTTS`, `DoubaoTTS` and others                                                   |

The tradeoffs:

- **Local keeps your voice at home and costs nothing per use**, but uses your PC's memory and CPU. The README notes that running `FunASR` locally takes more memory, and that using APIs for everything keeps resource use low.
- **Language matters.** Narsil speaks Spanish. The `FunASR` block's comment lists the language tags SenseVoice supports as zh, en, ja, ko and yue, so for Spanish the bot uses another recognizer. `OpenaiASR` (model `gpt-4o-mini-transcribe` by default) and `GroqASR` (`whisper-large-v3-turbo`) are multilingual APIs; `VoskASR` is offline and supports several languages with a downloaded model.
- **An API sends your audio out of your network** and needs a key. [Guide 12](/en/bot/secrets-privacy/) lists what leaves the network and why.

The bot uses `OpenaiASR` for recognition and keeps `EdgeTTS` for synthesis, which needs no key in `config.yaml`. Narsil's voice itself, and the `voice` setting, are guide 6.

### Without the server, only the voice stops

The server does one job: voice. The belly connects to ntfy and GitHub on its own (guides 7 and 8), and the head draws whatever the belly sends it. If your PC is off, or Docker is stopped, Narsil's alerts, your pull requests and her face keep working. Only the wake word leads nowhere until the server is back.

## How it was asked of the AI

The decision to run a server came in guide 3: the author chose "servidor propio", an own server, over xiaozhi.me. The AI then proposed this server in minimal mode, with Docker, on the local network only, and asked again before going on. The author confirmed:

> vamos con el propio de una

In English: "let's go with our own one, straight away".

The next question was where it would run: on the PC, or on another machine at home. The answer:

> en el pc, igual la idea es usarlo para trabajar con claude

In English: "on the PC; anyway, the idea is to use it to work with Claude".

That second answer explains two things in this guide. The server runs in Docker on the PC the author already works on, so nothing new has to stay on. And Claude is the brain: the next decision, recorded as spec S5, chose option "1", a native Anthropic provider written in Python with the Anthropic SDK rather than an OpenAI-compatible endpoint. Guide 5 builds it.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the conversation used to set up the bot.

> I want to run xinnan-tech/xiaozhi-esp32-server in its minimal mode with Docker on my Windows PC, reachable only from my local network, for a Xiaozhi device. Read the project's README, `docs/Deployment.md`, `main/xiaozhi-server/config.yaml` and `docker-compose.yml`, then give me: the folder layout, a `data/.config.yaml` that overrides only what I need (WebSocket address with my LAN IP, time zone, a speech recognizer that understands Spanish), the commands to start it and read its logs, and the OTA URL I must give the device. Quote the project's security warning and tell me which ports it opens.

## The minimal code

The folder on the PC, from the deployment guide:

```text
xiaozhi-server
├─ docker-compose.yml
├─ data
│  └─ .config.yaml
└─ models
   └─ SenseVoiceSmall
      └─ model.pt
```

`docker-compose.yml` is the project's own file, downloaded from `main/xiaozhi-server/`. The compose file mounts `models/SenseVoiceSmall/model.pt` into the container, so the deployment guide has you download that model (from ModelScope or Baidu) even though the bot recognizes speech through an API.

`data/.config.yaml`, with a made-up address and key:

```yaml
server:
  websocket: ws://192.168.1.50:8000/xiaozhi/v1/
  timezone_offset: -5

selected_module:
  ASR: OpenaiASR
  TTS: EdgeTTS

ASR:
  OpenaiASR:
    api_key: sk-EXAMPLE-not-a-real-key
```

Only `api_key` is set under `OpenaiASR`; the rest of that block (`type`, `base_url`, `model_name`) comes from `config.yaml`. Use your own time zone offset. The `LLM` section arrives in guide 5; until then the server still selects the default `ChatGLMLLM`, which the deployment guide says needs its key to start.

Start it from the `xiaozhi-server` folder and follow its log:

```powershell
docker compose up -d
docker logs -f xiaozhi-esp32-server
```

The image is `ghcr.nju.edu.cn/xinnan-tech/xiaozhi-esp32-server:server_latest`, the container is named `xiaozhi-esp32-server`, and `restart: always` brings it back after a reboot of Docker.

## Common mistakes and how to test it

- **Editing `config.yaml` instead of `data/.config.yaml`.** Your changes get mixed with the project's file and lost on the next download. Put them in `data/.config.yaml`.
- **Trusting the addresses in the Docker log.** They are the container's. Use your PC's LAN address in `server.websocket` and in the belly's OTA URL.
- **Forwarding 8000 or 8003 on the router.** The project is not security-assessed and authentication is off by default. Keep it on your network.
- **The PC's firewall.** If the belly cannot reach the server but the PC's own browser can, allow inbound connections on 8000 and 8003 from your private network.
- **A changing PC address.** If your router gives the PC a new address, the belly's OTA URL and `server.websocket` both go stale. A DHCP reservation on the router keeps the address fixed.
- **Upgrading by overwriting `.config.yaml`.** The deployment guide's upgrade steps say to back it up and copy your keys one by one into the new one, because a new `config.yaml` may bring new settings.

To test, open the OTA URL in a browser on the PC, for example `http://192.168.1.50:8003/xiaozhi/ota/`. xinnan-tech's firmware guide says that a working server answers "OTA接口运行正常" ("the OTA interface is working normally") followed by the WebSocket address it sends to devices. If that address shows your LAN IP and port 8000, the belly will find it. Then say the wake word and watch `docker logs -f xiaozhi-esp32-server`: you should see the belly connect and the text it heard.

## Going further

- The full module installation adds a database, multiple users and agents, and a web console. The bot does not need it, and its OTA address is different (the firmware guide uses port 8002 for it).
- The server can serve firmware updates for the belly from its `data/bin` folder, described in the project's OTA upgrade guide (`docs/ota-upgrade-guide.md`).
- `server.auth` can require a token, with `allowed_devices` listing MAC addresses that skip the check. It is a useful layer even on a home network.
- Most provider blocks in `config.yaml` carry comments, in Chinese, on where to get the key and, for some, what it costs; read the one you pick before you commit to it.
- Guide 5 adds the `LLM` that makes Narsil think with Claude, and guide 6 gives her a voice and a personality.
