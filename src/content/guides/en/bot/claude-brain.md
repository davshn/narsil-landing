---
title: Claude as the brain
description: 'A native Anthropic provider in Python for the xiaozhi-esp32-server: how the server calls a language model, the Claude Messages API with streaming, prompt caching, cost per turn and the API key.'
route: bot
order: 5
updated: 2026-11-18
---

## What it does

The server from guide 4 hears your voice and turns it into text, but it does not think. For each turn it hands the conversation to a language model (LLM) and speaks back whatever comes out. In this bot that model is Claude.

This guide adds a new LLM provider to [xinnan-tech/xiaozhi-esp32-server](https://github.com/xinnan-tech/xiaozhi-esp32-server): one Python file that receives the server's conversation, sends it to the [Claude Messages API](https://platform.claude.com/docs/en/api/overview) with the official [`anthropic` Python SDK](https://github.com/anthropics/anthropic-sdk-python), and streams the answer back word by word, so the belly starts speaking before Claude has finished writing.

Only text crosses to Anthropic: what the speech recognizer understood, the system prompt and the earlier turns. Your audio never does; it stays between the belly and the PC (and the speech recognizer you chose in guide 4).

## How it works inside

### How the server loads a language model

The server picks its model in `selected_module.LLM`, which names a block under `LLM:` in the configuration. `core/utils/modules_initialize.py` reads that block's `type` (or the block's name, when it has no `type`) and passes the whole block to `core/utils/llm.py`, whose `create_instance` looks for a file at:

```text
core/providers/llm/<type>/<type>.py
```

and builds the `LLMProvider` class it finds there with the block as its only argument. The Gemini provider, `core/providers/llm/gemini/gemini.py`, is a good model to read: one folder, one file, one class.

So `type: claude` means a file `core/providers/llm/claude/claude.py`. The folder is named `claude`, not `anthropic`, so it can never be confused with the SDK package it imports.

### The interface a provider implements

Every provider extends `LLMProviderBase` from `core/providers/llm/base.py`. Its contract is small:

- `response(self, session_id, dialogue)` is abstract and must be a **generator**: it yields pieces of text as they arrive. The server feeds them to the speech synthesizer sentence by sentence.
- `response_with_functions(self, session_id, dialogue, functions=None)` is the tool-calling version. The base class already implements it by calling `response` and yielding `(token, None)` pairs, so a provider without tools gets it for free.
- `response_no_stream` builds a two-message dialogue and joins what `response` yields; it needs nothing from you.

`dialogue` is a list of dictionaries in the familiar chat shape, `{"role": ..., "content": ...}`. `core/utils/dialogue.py` builds it: first one `system` message (the rendered system prompt), then the conversation's `user` and `assistant` turns. With tool calling on, `tool` messages and `tool_calls` can appear as well.

`core/connection.py` calls `response_with_functions` only when the intent module is `function_call`; otherwise it calls `response`. The bot sets `Intent: nointent`, so the provider only needs `response`, and Claude only talks. Tools are under "Going further".

### From the server's dialogue to the Messages API

The Messages API wants the system prompt apart, in a `system` parameter, and a `messages` list of `user` and `assistant` turns that starts with a `user` turn. The provider converts:

1. System messages leave the list and become the `system` parameter.
2. User and assistant turns stay, as text.
3. Anything before the first user turn (an assistant greeting, for example) is dropped, because the first message must be the user's.

Then it opens a stream with `client.messages.stream(...)` and yields from its `text_stream`, which gives the answer's text as it is generated, exactly what the server's generator interface wants. The Python SDK's [streaming helpers](https://github.com/anthropics/anthropic-sdk-python/blob/main/helpers.md) document both.

### Why the native API and not the OpenAI-compatible one

The server already has an `openai` provider, and Anthropic offers an [OpenAI SDK compatibility layer](https://platform.claude.com/docs/en/cli-sdks-libraries/libraries/openai-sdk), so pointing the existing provider at Claude would work. Anthropic's own page explains why the bot does not: it says the layer "is primarily intended to test and compare model capabilities, and is not considered a long-term or production-ready solution for most use cases". The same page lists what it lacks, and the first missing piece matters here: prompt caching "is not supported" through it. The native SDK has caching, typed errors and the full parameter set.

### The model, and what a turn costs

The provider reads the model from the configuration. The example uses `claude-opus-5-5`, Claude Opus 5.5. For a voice assistant, `claude-haiku-5-5`, Claude Haiku 5.5, is the cheaper and faster choice; both take the same code. Prices from Anthropic's [pricing page](https://platform.claude.com/docs/en/about-claude/pricing), per million tokens, on the day of this guide:

| Model            | Input | 5-minute cache write | Cache hit | Output |
| ---------------- | ----- | -------------------- | --------- | ------ |
| Claude Opus 5.5  | $4    | $5                   | $0.20     | $20    |
| Claude Haiku 5.5 | $0.10 | $0.125               | $0.01     | $0.50  |

Haiku's row is for prompts up to 100,000 tokens, which a voice chat never reaches.

A rough voice turn: the server's system prompt is a few thousand characters (its `agent-base-prompt.txt` template plus Narsil's character from guide 6), about 2,000 tokens; you say a sentence, about 20 tokens; Narsil answers in two short sentences, about 60 tokens of text. On Opus 5.5 that is about $0.008 of input without caching, about $0.0004 with it, plus about $0.0012 of output. On Haiku 5.5 the whole turn is a small fraction of a cent. Two things grow the bill: the history, which is sent again on every turn, and thinking. On Claude Opus 5.5 thinking is always on and billed as output; the provider sets `output_config.effort` to `low` so that a voice answer does not think for long. Check the current pricing page before you rely on these numbers.

### Prompt caching

[Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) lets the API reuse the start of a request it has seen recently. You mark a block with `cache_control: {"type": "ephemeral"}`; everything up to that mark is stored for five minutes, refreshed for free each time it is used. A cache write costs 1.25 times the input price; a hit costs 0.05 times on Opus 5.5 and 0.1 times on Haiku 5.5. The prefix must be at least 512 tokens on both models, or it is silently not cached.

The catch is that caching is a prefix match: change one character and everything after it is new. The server's template ends with a `<context>` section that holds real-time data, and `core/utils/dialogue.py` replaces `{{current_time}}` with the time in `HH:MM` on every turn. So the provider splits the system prompt at `<context>`: the stable part goes first, with the cache mark, and the context part goes after it, uncached. The stable part is well over 512 tokens.

### The API key

The SDK reads the key from the `ANTHROPIC_API_KEY` environment variable when the provider passes none. The provider also accepts `api_key` in its configuration block, which lives in `data/.config.yaml` on your PC (guide 4). Either way the key stays on the PC and never enters a repository.

To get one:

1. Open the [Claude Console](https://platform.claude.com/) and go to **API keys** ([platform.claude.com/settings/keys](https://platform.claude.com/settings/keys)). Create a key with a name that says where it lives, for example `narsil-bot-pc`. The Console shows it once.
2. Set a monthly limit in [Spend limits](https://platform.claude.com/settings/spend-limits) (`platform.claude.com/settings/spend-limits`): next to **Monthly spend limit**, click **Adjust limit** or **Set limit**. According to the [rate limits page](https://platform.claude.com/docs/en/api/rate-limits), once your own limit is reached the API answers HTTP 400 until the next month or until you raise it, so a runaway loop costs at most that.
3. To revoke it, delete the key on the same **API keys** page. Requests with it stop working at once; create a new one and update the PC.

## How it was asked of the AI

This guide comes from one decision. In guide 4, the author placed the server on the PC with a reason:

> en el pc, igual la idea es usarlo para trabajar con claude

In English: "on the PC; anyway, the idea is to use it to work with Claude".

The AI then asked how the server should reach Claude. It offered two options: (1) a native Anthropic provider written in Python with the Anthropic SDK, or (2) the server's existing OpenAI-type provider pointed at Anthropic's OpenAI-compatible endpoint, with no new code. It cited Anthropic's compatibility page and its note that the endpoint is meant for testing and comparison. The author answered:

> 1

That answer is spec S5: a native provider. The model, the effort level and the cache split were not asked; the AI took them from Anthropic's documentation and the server's own template, and they are settings you can change.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the conversation used to build the bot.

> I run xinnan-tech/xiaozhi-esp32-server in Docker. Write a new LLM provider for it that calls Claude through the official `anthropic` Python SDK, not the OpenAI-compatible endpoint. First read `core/providers/llm/base.py`, `core/providers/llm/gemini/gemini.py`, `core/utils/llm.py` and `core/utils/dialogue.py` to learn the interface and the dialogue format. Convert system messages to the `system` parameter, stream with `messages.stream` and yield from `text_stream`, read the model, `max_tokens` and the API key from the provider's config block, and cache the stable part of the system prompt with `cache_control`. Show me the `.config.yaml` entry and how to add the file and the SDK to the Docker container.

## The minimal code

The provider, `providers/claude/claude.py` in your `xiaozhi-server` folder on the PC (MIT, like the site's own examples):

```python
import anthropic

from core.providers.llm.base import LLMProviderBase

CONTEXT_MARK = "<context>"


def to_messages_api(dialogue):
    system_text = "\n".join(m["content"] for m in dialogue if m["role"] == "system")
    stable, mark, context = system_text.partition(CONTEXT_MARK)
    system = [{"type": "text", "text": stable, "cache_control": {"type": "ephemeral"}}]
    if mark:
        system.append({"type": "text", "text": mark + context})

    messages = []
    for m in dialogue:
        content = str(m.get("content") or "")
        if m["role"] not in ("user", "assistant") or not content:
            continue
        if not messages and m["role"] != "user":
            continue
        messages.append({"role": m["role"], "content": content})
    return system, messages


class LLMProvider(LLMProviderBase):
    def __init__(self, config):
        self.model_name = config.get("model_name", "claude-opus-5-5")
        self.max_tokens = int(config.get("max_tokens", 4096))
        self.effort = config.get("effort", "low")
        self.client = anthropic.Anthropic(api_key=config.get("api_key") or None)

    def response(self, session_id, dialogue, **kwargs):
        system, messages = to_messages_api(dialogue)
        with self.client.messages.stream(
            model=self.model_name,
            max_tokens=self.max_tokens,
            system=system,
            messages=messages,
            output_config={"effort": self.effort},
        ) as stream:
            yield from stream.text_stream
            if stream.get_final_message().stop_reason == "refusal":
                yield "Prefiero no responder a eso."
```

The last line is what Narsil says, in Spanish ("I'd rather not answer that"), when Claude declines a request.

Its block in `data/.config.yaml`, next to what guide 4 put there:

```yaml
selected_module:
  LLM: ClaudeLLM
  Intent: nointent

LLM:
  ClaudeLLM:
    type: claude
    model_name: claude-opus-5-5
    max_tokens: 4096
    effort: low
```

For Haiku, change `model_name` to `claude-haiku-5-5`. `max_tokens` is a ceiling, not a target: the length of Narsil's answers is set by her prompt (guide 6).

The server's image does not include the SDK or the new file. A small `Dockerfile` next to `docker-compose.yml` adds the SDK on top of the project's image:

```dockerfile
FROM ghcr.nju.edu.cn/xinnan-tech/xiaozhi-esp32-server:server_latest
RUN pip install anthropic
```

And a `docker-compose.override.yml`, which Docker Compose merges into the project's file on its own, builds that image, mounts the provider where `create_instance` looks for it, and passes the key from your shell:

```yaml
services:
  xiaozhi-esp32-server:
    build: .
    image: xiaozhi-esp32-server-claude
    environment:
      - ANTHROPIC_API_KEY
    volumes:
      - ./providers/claude/claude.py:/opt/xiaozhi-esp32-server/core/providers/llm/claude/claude.py
```

Then, in PowerShell, with a made-up key:

```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-EXAMPLE-not-a-real-key"
docker compose up -d --build
docker logs -f xiaozhi-esp32-server
```

## Common mistakes and how to test it

- **A `type` that does not match the folder.** `type: claude` needs `core/providers/llm/claude/claude.py` inside the container. The server answers `不支持的LLM类型` ("unsupported LLM type") when the path is wrong; check the volume line.
- **`ModuleNotFoundError: anthropic`.** The container is still running the project's image. Rebuild with `docker compose up -d --build`.
- **The first message is not the user's.** The API rejects a `messages` list that starts with `assistant`; the conversion drops anything before the first user turn.
- **`max_tokens` too low.** Thinking counts toward it; with a few hundred tokens, an answer can stop halfway. Keep answers short through the prompt instead.
- **A cache that never hits.** Anything that changes before the cache mark breaks it. Read `usage.cache_read_input_tokens` on the final message: zero on every turn means the stable part is changing, for example because a custom template moved the time above `<context>`.
- **The key in the repository.** Keep it in the environment or in `data/.config.yaml`, both outside any repository. If one leaks, delete it in the Console at once.

To test, start the server and follow its log. It reports `初始化组件: llm成功 ClaudeLLM` ("component initialized: llm succeeded") when the provider loads. Then wake the belly and ask something short: the log shows the recognized text, and the answer starts to play while Claude is still writing. In the Console's [Usage](https://platform.claude.com/usage) page, the requests appear within minutes, with their cached and uncached tokens.

## Going further

- **Tools.** With `Intent: function_call`, the server passes its plugins (weather, music, the exit intent) to `response_with_functions`. Implementing it means converting the server's OpenAI-style function list to Claude's `tools` format and yielding the server's function-call shape, as the Gemini provider does.
- **Refusal fallbacks.** On Claude Opus 5.5, the beta `server-side-fallback-2026-07-01` lets the API retry a refused request on another model inside the same call (`fallbacks: "default"` on `client.beta.messages`).
- **Effort.** `low` keeps answers quick. Try `medium` for questions that need more thought, and measure the delay before you keep it.
- **Mid-conversation system messages.** To change Narsil's instructions during a conversation without touching the cached system prompt, the API accepts a `system` role inside `messages` on current models.
- Guide 6 writes the character that goes into that system prompt, and the Spanish voice that speaks it.
