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

| ID  | Specs    | Route                          | Status | Commit                                                   |
| --- | -------- | ------------------------------ | ------ | -------------------------------------------------------- |
| T1  | S7       | inline                         | done   | this branch                                              |
| T2  | S8       | inline                         | done   | this branch                                              |
| T3  | S7, S8   | inline                         | done   | 621 unit tests, 221 pages, 144 e2e passed (chromium)     |
| T4  | S10      | inline                         | done   | 6a: `/[locale]/bot/` pages and the third home card       |
| T5  | S10, S11 | delegated (context backstop)   | done   | `87d2515` (1–4), `39bf70e` (5–8), `8c7ed6b` (9–12)       |
| T6  | S11      | delegated (4 parallel writers) | done   | `4b4cbf5` (6a), `7767e8d` (6b), 6c translations commit   |
| T7  | S10, S11 | inline                         | done   | 6c: 654 unit tests, 286 pages, 191 e2e passed (chromium) |

T1: license files, README, `llms.txt`, footer copy and spec. T2: bot copy in the home meta, footer, hero and route card, `CLAUDE.md`, README. T3: unit tests, e2e, build.

## Not on the site

The bot code in these guides was written from documentation and has not run on the boards; the owner corrects the guides after building. Judgement calls in 6a that no source settled, to check first when building:

- Belly UART on GPIO4 (TX) and GPIO5 (RX): on the header and unused by Xiaozhi's `config.h` and the BSP; GPIO37/38 avoided because they are the boot console.
- Head UART on GPIO13 (RX) and GPIO14 (TX): read from the schematic's text layer as adjacent header pins; the least certain value, the guide tells readers to check the silkscreen.
- Each board on its own USB power, GND shared, 3V3 not shared; UART_NUM_1 at 115200 baud.
- Server providers: OpenaiASR (FunASR's SenseVoice has no Spanish) and EdgeTTS; example time zone -5.
- The OTA URL is set in the Wi-Fi portal (NVS `wifi/ota_url`), not in Kconfig, so the server address stays out of the repository.
- `idf.py monitor` over RFC2217 inferred from the documented flash command.
- Source contradictions: Waveshare documents ESP-IDF 5.3.1+, Xiaozhi needs 6.0.1+; the Xiaozhi README recommends `release/v6.1` while the cardputer README reports the `release-v6.1` image failing HTTPS; header size 13 vs 16 pins on Waveshare's page.
- For S2–S4 the guides phrase the AI's questions from the options recorded in this conversation; S9 and L5 are not quoted on the site.

Judgement calls in 6b (guides 5–8):

- Claude provider: folder and `type` named `claude`; `Intent: nointent`, so `response()` only and no tools; the system prompt is split at `<context>` (it holds `{{current_time}}`, which changes every minute) and only the stable part carries `cache_control`; defaults `effort: low`, `max_tokens: 4096`; a `Dockerfile` with `RUN pip install anthropic` on the project image (assumes `pip` in the image) and a `docker-compose.override.yml` mounting the provider into `/opt/xiaozhi-esp32-server/core/providers/llm/claude/`; key from `ANTHROPIC_API_KEY` or the block's `api_key`; the cost example uses estimated token counts (2,000 system, 20 in, 60 out).
- Voice: `language: Spanish` written in English (it fills an English template); voice `es-MX-DaliaNeural`, to confirm with `edge-tts --list-voices`; persona prompt in English; the Spanish `system_error_response`, `end_prompt` and exit commands (`salir`, `adiós`) are our wording; wake word stays "Hi ESP"; assumes a `.config.yaml` list replaces the default list.
- ntfy: one JSON stream for both topics, `since=<last id>` on reconnect and `since=10m` on cold boot; 120 s read timeout (ntfy.sh keepalive interval not documented on the pages read); NVS namespace `narsil`, key `ntfy_topic`, entered on a settings screen from guide 9; decrypting sealed messages only in "Going further"; `ShowAlert` and `ShowStatus` must come from guide 9.
- GitHub: "Pull requests: Read-only" on selected private repositories, none for public-only (GitHub lists no permission of its own for `/search/issues`); query `review-requested:@me` (alternative `author:@me`), polling every 2 minutes; assumes search responses carry an `etag`; User-Agent `narsil-bot`, NVS key `gh_token`, body capped at 64 KB; `ShowPullRequest` and `ShowGithubError` must come from guide 9.
- Links to guides 9–12 point to `/en/bot/` or name the guide without a link; 6c must link them once they exist.

Judgement calls in 6c (guides 9–12):

- Belly UI: a `NarsilDisplay` subclass of `MipiLcdDisplay` overrides `SetupUI` and builds a second LVGL screen (Xiaozhi's stays alive, hidden); the board file only changes `new MipiLcdDisplay(` to `new NarsilDisplay(`; `ShowNarsilScreen()` is called next to `StartNtfy()` so the Wi-Fi setup screen still shows on first boot; settings open with a long press on the strip, saved values are never shown, an empty field keeps the saved value, Save restarts the board; `ClearPullRequests()` is new and guide 8's `PollPullRequests` needs one extra line for an empty result; alert time formatted with `gmtime_r`; last 20 alerts kept; row colors reuse narsil-pet's `STATUS_COLOR`.
- UART protocol: lines `$N1,<type>,...*<XOR hex>\n`, 64-byte cap; types `P` (pose and stage), `V` (`idle`, `listening`, `speaking`) and the head's hello `H`; the belly resends its state every 5 s; the head dims after 15 s of silence; pose and stage parsed from the `art` URL; voice state from polling `GetDeviceState()` every 100 ms.
- Head: pins read from the schematic text layer (CLK 40, MOSI 41, CS 39, DC 38, RST 42, backlight 20, assumed active high); SPI 20 MHz, `invert_color(true)`, RGB order, `mirror(true, false)` as the starting value with the alignment check deciding; art as one `faces.bin` built from narsil-pet's `-oscuro` PNGs with `LVGLImage.py --cf RGB565_SWAPPED`, embedded with `EMBED_FILES`; the whole drawing, not a cropped face; dot colors and the 3-second red boot test are our choices.
- Secrets: no encryption enabled by default; the HMAC NVS scheme recommended only when the board leaves your desk (it burns one eFuse key block); Anthropic's commercial terms link not fetched.

## Log

- L1 (2026-11-17, owner): "Continúa" (phase 5 after path 2), then the hardware screenshot and S1.
- L2 (2026-11-17/18, owner): decisions S2–S7 as quoted above; questions asked one at a time, with Waveshare, SpotPear, the xiaozhi-esp32 README, xinnan-tech's README and config, and Anthropic's OpenAI SDK compatibility page as sources.
- L3 (2026-11-18, owner): "sí, arranca con la 5.0".
- L4: risks for 5.1: Xiaozhi requires ESP-IDF 6.0.1 or later while Waveshare documents the P4 board with 5.3.1 or later; the build would run in Espressif's Docker image (ESP-IDF is not installed locally, Docker 29.8 is); flashing and on-screen checks are the owner's; creating the public fork is an outward action confirmed right before it.
- L5 (2026-11-18, owner): S9 superseded as quoted; phase 5 continues as path 3 guides only (6a on branch `feat/bot-path-1`).
- L6: 6a translated to es, it, fr, pt; the Italian writer used "l'autore" and it was replaced by "chi ha creato Narsil" (no gender is known for the owner).
- L7 (2026-11-18, owner): "Listo, continúa con la 6b" (after #19 merged). 6b on branch `feat/bot-path-2`: guides 5–8, English by one delegated writer (context backstop), then four parallel translators.
- L8: 6b translated to es, it, fr, pt. Checks: typecheck ok; `eslint src` ok (`e2e/**` is ignored by the ESLint config); prettier ok; 632 unit tests, coverage 97.62% lines; build 266 pages; chromium e2e first run 28 failed, the next two runs 177 passed with no change in between (cause not found). Open terms for the owner: es "tema" for an ntfy topic and decimal comma in prices; fr prices kept as `$0.20`; pt "modelo" used both for template and language model.
- L9 (2026-11-18, owner): "sigue" (after #22 merged). 6c on branch `feat/bot-path-3`: guides 9–12, English by one delegated writer (context backstop), then four parallel translators; links from guides 5–8 to guides 9–12 are updated in every locale.
- L10: 6c translated to es, it, fr, pt, with the links to guides 9–12 mirrored in the earlier guides of every locale; no internal `/en/` link left in other locales. Checks: typecheck, `eslint src`, prettier ok; 654 unit tests, coverage 97.52% lines; build 286 pages; 191 chromium e2e passed on the first run. Path 3 (S11) is complete.
