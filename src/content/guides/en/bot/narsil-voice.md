---
title: "Narsil's personality and voice"
description: "Who Narsil is when she talks: her character in the server's prompt, short answers for a voice, Spanish replies, a Spanish Edge voice, and the server's other Chinese defaults turned to Spanish."
route: bot
order: 6
updated: 2026-11-18
---

## What it does

After guide 5, Claude answers through the belly, but with the server's default character: the project's example `prompt` describes a talkative girl from Taiwan, in Chinese, and the default voice is a Chinese one. This guide gives the bot Narsil's own character, the same one she has in [Narsil for Claude Code](https://github.com/davshn/narsil-pet), and a Spanish voice to say it with.

Four settings in `data/.config.yaml` do the work:

- `prompt`: who Narsil is and how she talks.
- `TTS.EdgeTTS.voice`: the voice that speaks her answers.
- `TTS.EdgeTTS.language`: the language every answer is written in.
- `system_error_response`, `end_prompt` and `exit_commands`: the server's fixed phrases and commands, which are Chinese by default.

## How it works inside

### Where the character goes

The server does not send `prompt` to the model on its own. `core/utils/prompt_manager.py` reads a template, `agent-base-prompt.txt` by default (the `prompt_template` setting), and builds the system prompt from it. The template, in English, starts with general rules for a voice assistant and then places your `prompt` inside an `<identity>` section, where it replaces `{{base_prompt}}`. Other placeholders fill in the date, the place, the weather and, at the end, a `<context>` section with the current time (guide 5 explains why that section stays out of the cache).

So `prompt` only has to say who Narsil is. The template already asks for the rest: get to the point, tolerate speech-recognition errors, do not stack questions.

### Who Narsil is

Narsil's character comes from the narsil-pet repository (GPL-3.0-or-later), and the bot keeps it so that the desk Narsil and the one above your prompt are the same. From its README and `hooks/words.ts`:

- She is a chibi sea serpent. Her name comes from the reforged sword of _The Lord of the Rings_, and the README says she is there "para cortar bugs" ("to cut bugs").
- Her voice is described in a comment in `hooks/words.ts`: neutral Latin American Spanish, "a calm, warm assistant who works beside you: composed, a little playful, never servile". She speaks of herself in the first person, never by name.
- Her asides borrow from the sea: she floats, dives into an idea, finds things "como una perla" ("like a pearl").
- She grows in five stages with the experience she earns, and she reports what Claude is doing in plain sentences: working, waiting for you, done, or stopped by an error.

The bot's `prompt` turns those points into instructions. It is written in English, like the template around it; the language of the answers is set separately.

### Short, for the ear

A voice answer is heard once, at the speed of speech. Narsil's spoken phrases in narsil-pet are one or two short sentences, such as "Listo, ya quedó." ("Done, it's finished."). The prompt asks for the same: two sentences at most unless you ask for more, no lists, no Markdown, no code read aloud, and numbers said the way a person would say them. The template's own rules, such as its emoji whitelist, stay as they are.

### The language of every answer

The template has a strict rule: every answer is written in `{{language}}`, whatever language you speak. The prompt manager fills it from the selected TTS block's `language` setting, and falls back to `中文` (Chinese) when it is missing. That is why the bot sets `language` under `TTS.EdgeTTS`, to `Spanish`, the word the English template reads best.

### The voice

`EdgeTTS` uses Microsoft Edge's online speech service through the `edge-tts` Python package; the server's provider (`core/providers/tts/edge.py`) passes the configured `voice` straight to `edge_tts.Communicate`. The default is `zh-CN-XiaoxiaoNeural`.

Narsil speaks neutral Latin American Spanish, so the bot uses `es-MX-DaliaNeural`, a female voice for Spanish (Mexico) in Microsoft's [list of speech voices](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts). Edge offers a subset of that list; `edge-tts --list-voices`, from the [edge-tts README](https://github.com/rany2/edge-tts), prints the voices it can actually use, so check your choice there. `es-CO-SalomeNeural` and `es-US-PalomaNeural` are other Latin American female voices on Microsoft's list.

EdgeTTS needs no key, but it is an online service: Narsil's answers, as text, go to Microsoft to be spoken. Guide 12 lists what leaves your network.

### The server's own phrases

A few phrases do not come from Claude, and they are Chinese in `config.yaml`:

| Setting                 | What it is                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| `system_error_response` | What the server says when something fails ("主人，小智现在有点忙…", "Master, Xiaozhi is busy…") |
| `end_prompt.prompt`     | The instruction for the goodbye when a conversation ends                                        |
| `exit_commands`         | Words that close the conversation: `退出` ("exit") and `关闭` ("close")                         |

The bot replaces all three. The error phrase is spoken as written, so it is in Spanish; the goodbye is an instruction to the model, so it can stay in English.

### The wake word

The wake word is listened for on the belly, not on the server. Xiaozhi's `scripts/build.py` picks "Hi ESP" for a Spanish build (guide 3), and the bot keeps it. Xiaozhi's `Kconfig.projbuild` also offers a custom wake word on the ESP32-P4 (`USE_CUSTOM_WAKE_WORD`, with the phrase in `CUSTOM_WAKE_WORD`), through ESP-SR's MultiNet model; its help text asks for pinyin for Chinese phrases. "Going further" has more.

## How it was asked of the AI

The character was never a question, because it was settled from the first message. The author described the head as Narsil's face:

> la cabeza va a ser una apntalla holografica que solo sea la cara de narsil

In English: "the head is going to be a holographic screen that is only Narsil's face".

And when the AI asked how Narsil should talk, the author chose Xiaozhi:

> yo pensaba hacerlo con Xiaozhi

In English: "I was thinking of doing it with Xiaozhi".

A face that is Narsil's needs a voice that is hers too. The AI did not write a new character: it read narsil-pet's README and `hooks/words.ts`, and kept what they say about her. The voice name, the `language` value and the Spanish error phrase were not asked; they are the AI's choices from Microsoft's voice list and the server's template, and you can change any of them.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the conversation used to build the bot.

> My Xiaozhi device talks through xinnan-tech/xiaozhi-esp32-server with Claude as the LLM. Read the server's `agent-base-prompt.txt` and `core/utils/prompt_manager.py` to see where the `prompt` setting goes and how `{{language}}` is filled. Then write a `prompt` for my character, a calm and warm sea serpent who answers in at most two short sentences for a voice, and the `data/.config.yaml` lines that set Spanish answers, a Latin American Spanish EdgeTTS voice that `edge-tts --list-voices` lists, and Spanish versions of `system_error_response` and `exit_commands`.

## The minimal code

The lines `data/.config.yaml` adds to guides 4 and 5:

```yaml
prompt: |
  You are Narsil, a small chibi sea serpent who lives on the author's desk.
  Your name comes from the reforged sword in The Lord of the Rings: you are
  here to cut bugs. You are calm, warm and composed, a little playful, never
  servile. You speak of yourself in the first person and never say your own
  name. Now and then you borrow an image from the sea, without overdoing it.
  You answer for a voice: at most two short sentences unless asked for more,
  no lists, no Markdown, no code read aloud. Speak neutral Latin American
  Spanish, with the simple past.

system_error_response: 'Tuve un tropiezo y no pude responder. Probemos de nuevo en un momento.'

end_prompt:
  enable: true
  prompt: |
    Say a short, warm goodbye in one sentence, as Narsil would.

exit_commands:
  - 'salir'
  - 'adiós'

TTS:
  EdgeTTS:
    voice: es-MX-DaliaNeural
    language: Spanish
```

The error phrase says "I stumbled and couldn't answer. Let's try again in a moment", in the same register as narsil-pet's error lines. Only `voice` and `language` are set under `EdgeTTS`; `type` and `output_dir` come from `config.yaml`.

Restart the server so it reads the file again:

```powershell
docker compose restart
```

## Common mistakes and how to test it

- **Answers in Chinese.** `language` is missing or is under a TTS block that is not selected. It must sit under the block named in `selected_module.TTS`.
- **Long answers.** Claude follows the prompt; if Narsil talks too much, make the length rule more concrete ("one or two sentences") rather than lowering `max_tokens`, which cuts answers mid-sentence.
- **A voice that does not exist in Edge.** A voice from Microsoft's list that Edge does not offer fails at synthesis time. Check it with `edge-tts --list-voices`.
- **Spanish text, Chinese voice.** `voice` still holds the default. The voice and the language are two separate settings.
- **The character name spoken aloud.** narsil-pet's Narsil never says her own name; if the bot does, say so explicitly in the prompt.
- **Markdown read aloud.** Asterisks and hashes become noise in speech. The prompt forbids them; if they still appear, add an example of a good answer.

To test, restart the server, wake the belly and ask "¿quién eres?" ("who are you?"). Narsil should answer in Spanish, in one or two sentences, with the new voice, and without saying her name. Then ask something long, such as how a recipe works: the answer should stay short and offer more. Say "salir" to check that the conversation closes.

## Going further

- **Your own template.** `prompt_template` can point to a file of your own, for example in `data/`, if you want to drop rules that do not fit Narsil (the template's speaker recognition or its safety section). Keep the `<context>` section last so the cache split from guide 5 still works.
- **A custom wake word.** With `USE_CUSTOM_WAKE_WORD`, the belly can listen for a phrase of your choice. Check in ESP-SR's documentation which languages its MultiNet models support before choosing "Narsil".
- **Other voices.** `private_voice`, if set, replaces `voice` in the EdgeTTS provider. Local TTS providers (guide 4) keep the voice on your PC.
- **Her stage.** narsil-pet's Narsil grows in five stages. The belly receives her state from ntfy (guide 7), and the server could add it to the prompt through the template's `dynamic_context`, so the desk Narsil talks like the stage she is in.
- Guide 7 shows Narsil's alerts on the belly screen.
