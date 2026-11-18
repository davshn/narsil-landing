---
title: Claude como cerebro
description: 'Un proveedor nativo de Anthropic en Python para xiaozhi-esp32-server: cómo llama el servidor a un LLM, la Messages API de Claude con streaming, prompt caching, costo por turno y la clave de API.'
route: bot
order: 5
updated: 2026-11-18
---

## Qué hace

El servidor de la guía 4 oye tu voz y la convierte en texto, pero no piensa. En cada turno entrega la conversación a un modelo de lenguaje (LLM) y dice en voz alta lo que sale de él. En este bot ese modelo es Claude.

Esta guía añade un nuevo proveedor de LLM a [xinnan-tech/xiaozhi-esp32-server](https://github.com/xinnan-tech/xiaozhi-esp32-server): un único archivo de Python que recibe la conversación del servidor, la envía a la [Messages API de Claude](https://platform.claude.com/docs/en/api/overview) con el [SDK oficial `anthropic` para Python](https://github.com/anthropics/anthropic-sdk-python), y devuelve la respuesta palabra por palabra, así que la panza empieza a hablar antes de que Claude termine de escribir.

Solo el texto llega a Anthropic: lo que entendió el reconocedor de voz, el system prompt y los turnos anteriores. Tu audio nunca llega; se queda entre la panza y el PC (y el reconocedor de voz que elegiste en la guía 4).

## Cómo funciona por dentro

### Cómo carga el servidor un modelo de lenguaje

El servidor elige su modelo en `selected_module.LLM`, que nombra un bloque dentro de `LLM:` en la configuración. `core/utils/modules_initialize.py` lee el `type` de ese bloque (o el nombre del bloque, cuando no tiene `type`) y pasa el bloque completo a `core/utils/llm.py`, cuyo `create_instance` busca un archivo en:

```text
core/providers/llm/<type>/<type>.py
```

y construye la clase `LLMProvider` que encuentra ahí, con el bloque como único argumento. El proveedor de Gemini, `core/providers/llm/gemini/gemini.py`, es un buen modelo para leer: una carpeta, un archivo, una clase.

Así que `type: claude` significa un archivo `core/providers/llm/claude/claude.py`. La carpeta se llama `claude`, no `anthropic`, para que nunca se confunda con el paquete del SDK que importa.

### La interfaz que implementa un proveedor

Cada proveedor extiende `LLMProviderBase` de `core/providers/llm/base.py`. Su contrato es pequeño:

- `response(self, session_id, dialogue)` es abstracto y debe ser un **generador**: entrega fragmentos de texto a medida que llegan. El servidor se los pasa a la síntesis de voz frase por frase.
- `response_with_functions(self, session_id, dialogue, functions=None)` es la versión con llamadas a herramientas. La clase base ya lo implementa llamando a `response` y entregando pares `(token, None)`, así que un proveedor sin herramientas lo obtiene gratis.
- `response_no_stream` construye un diálogo de dos mensajes y une lo que entrega `response`; no necesita nada de ti.

`dialogue` es una lista de diccionarios con la forma conocida de un chat, `{"role": ..., "content": ...}`. `core/utils/dialogue.py` la construye: primero un mensaje `system` (el system prompt ya renderizado), después los turnos `user` y `assistant` de la conversación. Con las llamadas a herramientas activadas, también pueden aparecer mensajes `tool` y `tool_calls`.

`core/connection.py` llama a `response_with_functions` solo cuando el módulo de intención es `function_call`; si no, llama a `response`. El bot fija `Intent: nointent`, así que el proveedor solo necesita `response`, y Claude solo habla. Las herramientas están en "Para ir más lejos".

### Del diálogo del servidor a la Messages API

La Messages API quiere el system prompt aparte, en un parámetro `system`, y una lista `messages` de turnos `user` y `assistant` que empiece con un turno `user`. El proveedor convierte:

1. Los mensajes de sistema salen de la lista y se convierten en el parámetro `system`.
2. Los turnos del usuario y del asistente se quedan, como texto.
3. Todo lo que va antes del primer turno del usuario (un saludo del asistente, por ejemplo) se descarta, porque el primer mensaje debe ser del usuario.

Después abre un stream con `client.messages.stream(...)` y entrega lo que sale de su `text_stream`, que da el texto de la respuesta a medida que se genera, exactamente lo que quiere la interfaz de generador del servidor. Los [helpers de streaming](https://github.com/anthropics/anthropic-sdk-python/blob/main/helpers.md) del SDK de Python documentan los dos.

### Por qué la API nativa y no la compatible con OpenAI

El servidor ya tiene un proveedor `openai`, y Anthropic ofrece una [capa de compatibilidad con el SDK de OpenAI](https://platform.claude.com/docs/en/cli-sdks-libraries/libraries/openai-sdk), así que apuntar el proveedor existente a Claude funcionaría. La propia página de Anthropic explica por qué el bot no lo hace: dice que la capa "is primarily intended to test and compare model capabilities, and is not considered a long-term or production-ready solution for most use cases" (está pensada sobre todo para probar y comparar las capacidades de los modelos, y no se considera una solución a largo plazo ni lista para producción en la mayoría de los casos). La misma página lista lo que le falta, y la primera pieza que falta importa aquí: el prompt caching "is not supported" (no está soportado) a través de ella. El SDK nativo tiene caching, errores tipados y el conjunto completo de parámetros.

### El modelo, y lo que cuesta un turno

El proveedor lee el modelo de la configuración. El ejemplo usa `claude-opus-5-5`, Claude Opus 5.5. Para un asistente de voz, `claude-haiku-5-5`, Claude Haiku 5.5, es la opción más barata y más rápida; los dos usan el mismo código. Precios de la [página de precios](https://platform.claude.com/docs/en/about-claude/pricing) de Anthropic, por millón de tokens, el día de esta guía:

| Modelo           | Entrada | Escritura de caché de 5 minutos | Acierto de caché | Salida |
| ---------------- | ------- | ------------------------------- | ---------------- | ------ |
| Claude Opus 5.5  | $4      | $5                              | $0,20            | $20    |
| Claude Haiku 5.5 | $0,10   | $0,125                          | $0,01            | $0,50  |

La fila de Haiku es para prompts de hasta 100.000 tokens, a los que una charla por voz nunca llega.

Un turno de voz aproximado: el system prompt del servidor tiene unos pocos miles de caracteres (su plantilla `agent-base-prompt.txt` más el personaje de Narsil de la guía 6), unos 2.000 tokens; dices una frase, unos 20 tokens; Narsil responde con dos frases cortas, unos 60 tokens de texto. Con Opus 5.5 eso son unos $0,008 de entrada sin caching, unos $0,0004 con él, más unos $0,0012 de salida. Con Haiku 5.5 el turno completo es una pequeña fracción de centavo. Dos cosas hacen crecer la factura: el historial, que se vuelve a enviar en cada turno, y el razonamiento (thinking). En Claude Opus 5.5 el razonamiento está siempre activado y se cobra como salida; el proveedor fija `output_config.effort` en `low` para que una respuesta de voz no piense mucho tiempo. Consulta la página de precios actual antes de fiarte de estas cifras.

### Prompt caching

El [prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) permite a la API reutilizar el comienzo de una petición que ha visto hace poco. Marcas un bloque con `cache_control: {"type": "ephemeral"}`; todo lo que hay hasta esa marca se guarda durante cinco minutos, y se renueva gratis cada vez que se usa. Una escritura en la caché cuesta 1,25 veces el precio de entrada; un acierto cuesta 0,05 veces en Opus 5.5 y 0,1 veces en Haiku 5.5. El prefijo debe tener al menos 512 tokens en los dos modelos, o simplemente no se guarda en caché, sin aviso.

El problema es que la caché funciona por coincidencia de prefijo: cambia un carácter y todo lo que viene después es nuevo. La plantilla del servidor termina con una sección `<context>` que contiene datos en tiempo real, y `core/utils/dialogue.py` sustituye `{{current_time}}` por la hora en `HH:MM` en cada turno. Así que el proveedor divide el system prompt en `<context>`: la parte estable va primero, con la marca de caché, y la parte de contexto va después, sin caché. La parte estable supera con creces los 512 tokens.

### La clave de API

El SDK lee la clave de la variable de entorno `ANTHROPIC_API_KEY` cuando el proveedor no le pasa ninguna. El proveedor también acepta `api_key` en su bloque de configuración, que vive en `data/.config.yaml` en tu PC (guía 4). De cualquiera de las dos formas, la clave se queda en el PC y nunca entra en un repositorio.

Para conseguir una:

1. Abre la [Claude Console](https://platform.claude.com/) y ve a **API keys** ([platform.claude.com/settings/keys](https://platform.claude.com/settings/keys)). Crea una clave con un nombre que diga dónde vive, por ejemplo `narsil-bot-pc`. La Console la muestra una sola vez.
2. Fija un límite mensual en [Spend limits](https://platform.claude.com/settings/spend-limits) (`platform.claude.com/settings/spend-limits`): junto a **Monthly spend limit**, haz clic en **Adjust limit** o **Set limit**. Según la [página de límites de uso](https://platform.claude.com/docs/en/api/rate-limits), una vez alcanzado tu propio límite la API responde HTTP 400 hasta el mes siguiente o hasta que lo subas, así que un bucle descontrolado cuesta como mucho eso.
3. Para revocarla, borra la clave en la misma página de **API keys**. Las peticiones con ella dejan de funcionar al instante; crea una nueva y actualiza el PC.

## Cómo se le pidió a la IA

Esta guía sale de una sola decisión. En la guía 4, quien creó Narsil puso el servidor en el PC con un motivo:

> en el pc, igual la idea es usarlo para trabajar con claude

La IA preguntó entonces cómo debía llegar el servidor a Claude. Ofreció dos opciones: (1) un proveedor nativo de Anthropic escrito en Python con el Anthropic SDK, o (2) el proveedor de tipo OpenAI que ya tiene el servidor, apuntado al endpoint compatible con OpenAI de Anthropic, sin código nuevo. Citó la página de compatibilidad de Anthropic y su nota de que el endpoint está pensado para pruebas y comparaciones. La respuesta fue:

> 1

Esa respuesta es la especificación S5: un proveedor nativo. El modelo, el nivel de esfuerzo y la división de la caché no se preguntaron; la IA los tomó de la documentación de Anthropic y de la propia plantilla del servidor, y son ajustes que puedes cambiar.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es la conversación con la que se construyó el bot.

> Corro xinnan-tech/xiaozhi-esp32-server en Docker. Escribe un nuevo proveedor de LLM para él que llame a Claude a través del SDK oficial `anthropic` para Python, no del endpoint compatible con OpenAI. Primero lee `core/providers/llm/base.py`, `core/providers/llm/gemini/gemini.py`, `core/utils/llm.py` y `core/utils/dialogue.py` para aprender la interfaz y el formato del diálogo. Convierte los mensajes de sistema en el parámetro `system`, haz streaming con `messages.stream` y entrega lo que sale de `text_stream`, lee el modelo, `max_tokens` y la clave de API del bloque de configuración del proveedor, y guarda en caché la parte estable del system prompt con `cache_control`. Muéstrame la entrada de `.config.yaml` y cómo añadir el archivo y el SDK al contenedor de Docker.

## El código mínimo

El proveedor, `providers/claude/claude.py` en tu carpeta `xiaozhi-server` del PC (MIT, como los ejemplos propios del sitio):

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

La última línea es lo que dice Narsil, "Prefiero no responder a eso.", cuando Claude rechaza una petición.

Su bloque en `data/.config.yaml`, junto a lo que puso ahí la guía 4:

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

Para Haiku, cambia `model_name` a `claude-haiku-5-5`. `max_tokens` es un techo, no un objetivo: la longitud de las respuestas de Narsil la fija su prompt (guía 6).

La imagen del servidor no incluye el SDK ni el archivo nuevo. Un pequeño `Dockerfile` junto a `docker-compose.yml` añade el SDK sobre la imagen del proyecto:

```dockerfile
FROM ghcr.nju.edu.cn/xinnan-tech/xiaozhi-esp32-server:server_latest
RUN pip install anthropic
```

Y un `docker-compose.override.yml`, que Docker Compose mezcla por su cuenta con el archivo del proyecto, construye esa imagen, monta el proveedor donde lo busca `create_instance` y pasa la clave desde tu shell:

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

Después, en PowerShell, con una clave inventada:

```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-EXAMPLE-not-a-real-key"
docker compose up -d --build
docker logs -f xiaozhi-esp32-server
```

## Errores comunes y cómo probarlo

- **Un `type` que no coincide con la carpeta.** `type: claude` necesita `core/providers/llm/claude/claude.py` dentro del contenedor. El servidor responde `不支持的LLM类型` ("tipo de LLM no soportado") cuando la ruta es incorrecta; revisa la línea del volumen.
- **`ModuleNotFoundError: anthropic`.** El contenedor sigue corriendo la imagen del proyecto. Vuelve a construirla con `docker compose up -d --build`.
- **El primer mensaje no es del usuario.** La API rechaza una lista `messages` que empieza con `assistant`; la conversión descarta todo lo que va antes del primer turno del usuario.
- **`max_tokens` demasiado bajo.** El razonamiento cuenta para él; con unos pocos cientos de tokens, una respuesta puede cortarse a la mitad. Mantén las respuestas cortas mediante el prompt.
- **Una caché que nunca acierta.** Cualquier cosa que cambie antes de la marca de caché la rompe. Lee `usage.cache_read_input_tokens` en el mensaje final: cero en cada turno significa que la parte estable está cambiando, por ejemplo porque una plantilla propia movió la hora por encima de `<context>`.
- **La clave en el repositorio.** Mantenla en el entorno o en `data/.config.yaml`, los dos fuera de cualquier repositorio. Si una se filtra, bórrala en la Console de inmediato.

Para probarlo, arranca el servidor y sigue su log. Muestra `初始化组件: llm成功 ClaudeLLM` ("componente inicializado: llm correcto") cuando el proveedor carga. Después despierta la panza y pregunta algo corto: el log muestra el texto reconocido, y la respuesta empieza a sonar mientras Claude todavía escribe. En la página [Usage](https://platform.claude.com/usage) de la Console, las peticiones aparecen en pocos minutos, con sus tokens en caché y sin caché.

## Para ir más lejos

- **Herramientas.** Con `Intent: function_call`, el servidor pasa sus plugins (el tiempo, la música, la intención de salir) a `response_with_functions`. Implementarlo significa convertir la lista de funciones al estilo de OpenAI del servidor al formato `tools` de Claude y entregar la forma de llamada a función del servidor, como hace el proveedor de Gemini.
- **Alternativas ante un rechazo.** En Claude Opus 5.5, la beta `server-side-fallback-2026-07-01` permite a la API reintentar una petición rechazada con otro modelo dentro de la misma llamada (`fallbacks: "default"` en `client.beta.messages`).
- **Esfuerzo.** `low` mantiene las respuestas rápidas. Prueba `medium` para preguntas que necesitan más reflexión, y mide la demora antes de quedártelo.
- **Mensajes de sistema a mitad de la conversación.** Para cambiar las instrucciones de Narsil durante una conversación sin tocar el system prompt en caché, la API acepta el rol `system` dentro de `messages` en los modelos actuales.
- La guía 6 escribe el personaje que va en ese system prompt, y la voz en español que lo dice.
