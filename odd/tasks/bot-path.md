# Narsil Workshop — phase 5 (path 3: the Narsil desk bot)

Objective: a Narsil desk bot with a body and a voice, built in a public firmware fork, then taught in path 3 from the working code. 5.0 (this branch, `chore/licenses-and-bot-design`): licenses and the new bot design on the site. 5.1: firmware in `davshn/narsil-bot`. 5.2: path 3 guides. Delivery: `ask-on-risk`. Test runner: Vitest (`pnpm test:cov`), Playwright (`pnpm e2e`).

## Specs

- S1. Hardware (owner, 2026-11-17, from an AliExpress cart): Waveshare ESP32-P4-WIFI6-Touch-LCD-4.3 as the belly and ESP32-S3-LCD-1.3-C (ST7789 240×240, prism cube) as the head, plus female-female Dupont wires. "va a ser la pantalla grande para una pantalla en la pansa que va a tener la informacion de las tareas que hace narsil y la cabeza va a ser una apntalla holografica que solo sea la cara de narsil".
- S2. The belly does all networking (ntfy, GitHub) and sends the head only pose and state over UART (owner: "Por cable desde la panza").
- S3. The belly runs Xiaozhi (78/xiaozhi-esp32, MIT, ESP-IDF 6.0.1 or later), so Narsil has a voice (owner: "yo pensaba hacerlo con Xiaozhi").
- S4. Self-hosted voice server, not xiaozhi.me (owner: "servidor propio", reconfirmed "vamos con el propio de una"); proposed: xinnan-tech/xiaozhi-esp32-server in minimal mode with Docker, on the local network only. It runs on the owner's PC (owner: "en el pc, igual la idea es usarlo para trabajar con claude").
- S5. Claude is wired through a native Anthropic provider written in Python with the Anthropic SDK, not the OpenAI-compatible endpoint (owner: "1").
- S6. The firmware lives in its own public repository, a fork of 78/xiaozhi-esp32, with the head firmware in a folder of the same repository (owner: "repo propio como fork", then "1" for public from the start). Secrets (GitHub token, ntfy topic, key, server address) live in NVS or local configuration, never in the repository.
- S7. Site license (owner: "1"): site code and our own example code MIT; guide prose CC BY-SA 4.0; code quoted or adapted from narsil-pet and narsil-check keeps GPL-3.0-or-later. Stated in `LICENSE`, `LICENSE-CONTENT.md`, the README, `llms.txt`, and the footer in five locales.
- S8. Everything on the site that called the bot "an ESP32-S3 bot" describes the new design in five locales.
- S9. Superseded (2026-11-18). Owner: "espera, no vas a hacer ningun fork ni nada de eso, lo unico que vas a hacer es poner aca en la web las instrucciones de todo lo que haremos a modo de guia, no lo haremos aun", then "no, haz como si ya lo hubieramos hecho que cuando yo lo haga lo corrijo, vamos a hacerlo asi por que es la guia que le mostrare a mi companero para empezar". No fork, firmware or server now; the path 3 guides are written as a finished build, with no "planned" banner on the site.
- S10. Path 3 lives at `/[locale]/bot/`, linked from the third home route card, with the path template of phases 3 and 4. Bot guides carry no Claude Code version (`verifiedWith` is optional) and no `sources` from narsil-pet or narsil-check; they link official documentation in the prose. Every API call comes from verified sources: Waveshare, SpotPear, 78/xiaozhi-esp32, xinnan-tech/xiaozhi-esp32-server, ESP-IDF, LVGL, ntfy, GitHub REST, Anthropic SDK docs. "How it was asked of the AI" quotes the owner's messages recorded in this document.
- S11. Twelve guides in three PRs (6a: 1–4, 6b: 5–8, 6c: 9–12), all five locales: 1 the bot and its parts (bill of materials, wiring); 2 the toolchain (ESP-IDF 6.x with Docker or VS Code); 3 Xiaozhi in the belly; 4 your own server (xinnan-tech, minimal mode, Docker, LAN only); 5 Claude as the brain (native Anthropic provider in Python, cost, prompt caching); 6 Narsil's personality and voice; 7 Narsil's alerts from ntfy; 8 your GitHub pull requests (read-only token, minimum permission, revocation); 9 the belly UI with LVGL; 10 the UART protocol between belly and head; 11 the holographic head (prism, mirrored image); 12 secrets and privacy (NVS, what leaves your network).

## Tasks

| ID  | Specs    | Route                          | Status  | Commit                                               |
| --- | -------- | ------------------------------ | ------- | ---------------------------------------------------- |
| T1  | S7       | inline                         | done    | this branch                                          |
| T2  | S8       | inline                         | done    | this branch                                          |
| T3  | S7, S8   | inline                         | done    | 621 unit tests, 221 pages, 144 e2e passed (chromium) |
| T4  | S10      | inline                         | pending |                                                      |
| T5  | S10, S11 | delegated (context backstop)   | pending |                                                      |
| T6  | S11      | delegated (4 parallel writers) | pending |                                                      |
| T7  | S10, S11 | inline                         | pending |                                                      |

T1: license files, README, `llms.txt`, footer copy and spec. T2: bot copy in the home meta, footer, hero and route card, `CLAUDE.md`, README. T3: unit tests, e2e, build.

## Not on the site

The bot code in these guides was written from documentation and has not run on the boards; the owner corrects the guides after building.

## Log

- L1 (2026-11-17, owner): "Continúa" (phase 5 after path 2), then the hardware screenshot and S1.
- L2 (2026-11-17/18, owner): decisions S2–S7 as quoted above; questions asked one at a time, with Waveshare, SpotPear, the xiaozhi-esp32 README, xinnan-tech's README and config, and Anthropic's OpenAI SDK compatibility page as sources.
- L3 (2026-11-18, owner): "sí, arranca con la 5.0".
- L4: risks for 5.1: Xiaozhi requires ESP-IDF 6.0.1 or later while Waveshare documents the P4 board with 5.3.1 or later; the build would run in Espressif's Docker image (ESP-IDF is not installed locally, Docker 29.8 is); flashing and on-screen checks are the owner's; creating the public fork is an outward action confirmed right before it.
- L5 (2026-11-18, owner): S9 superseded as quoted; phase 5 continues as path 3 guides only (6a on branch `feat/bot-path-1`).
