---
title: La personalidad y la voz de Narsil
description: 'Quién es Narsil cuando habla: su personaje en el prompt del servidor, respuestas cortas para la voz, en español, una voz de Edge en español y los demás valores en chino pasados a español.'
route: bot
order: 6
updated: 2026-11-18
---

## Qué hace

Después de la guía 5, Claude responde a través de la panza, pero con el personaje por defecto del servidor: el `prompt` de ejemplo del proyecto describe a una chica conversadora de Taiwán, en chino, y la voz por defecto es una voz china. Esta guía le da al bot el personaje propio de Narsil, el mismo que tiene en [Narsil for Claude Code](https://github.com/davshn/narsil-pet), y una voz en español para decirlo.

Cuatro ajustes de `data/.config.yaml` hacen el trabajo:

- `prompt`: quién es Narsil y cómo habla.
- `TTS.EdgeTTS.voice`: la voz que dice sus respuestas.
- `TTS.EdgeTTS.language`: el idioma en que se escribe cada respuesta.
- `system_error_response`, `end_prompt` y `exit_commands`: las frases y los comandos fijos del servidor, que por defecto están en chino.

## Cómo funciona por dentro

### Dónde va el personaje

El servidor no envía `prompt` al modelo tal cual. `core/utils/prompt_manager.py` lee una plantilla, `agent-base-prompt.txt` por defecto (el ajuste `prompt_template`), y construye el system prompt a partir de ella. La plantilla, en inglés, empieza con reglas generales para un asistente de voz y después coloca tu `prompt` dentro de una sección `<identity>`, donde sustituye a `{{base_prompt}}`. Otros marcadores rellenan la fecha, el lugar, el tiempo y, al final, una sección `<context>` con la hora actual (la guía 5 explica por qué esa sección queda fuera de la caché).

Así que `prompt` solo tiene que decir quién es Narsil. La plantilla ya pide el resto: ir al grano, tolerar los errores del reconocimiento de voz, no encadenar preguntas.

### Quién es Narsil

El personaje de Narsil viene del repositorio narsil-pet (GPL-3.0-or-later), y el bot lo conserva para que la Narsil del escritorio y la que está sobre tu prompt sean la misma. Según su README y `hooks/words.ts`:

- Es una serpiente marina chibi. Su nombre viene de la espada reforjada de _El Señor de los Anillos_, y el README dice que está ahí "para cortar bugs".
- Su voz se describe en un comentario de `hooks/words.ts`: español latinoamericano neutro, "a calm, warm assistant who works beside you: composed, a little playful, never servile" (una asistente tranquila y cálida que trabaja a tu lado: serena, un poco juguetona, nunca servil). Habla de sí misma en primera persona, nunca por su nombre.
- Sus comentarios toman prestado del mar: flota, se sumerge en una idea, encuentra cosas "como una perla".
- Crece en cinco etapas con la experiencia que gana, y cuenta lo que hace Claude en frases sencillas: trabajando, esperándote, listo, o detenido por un error.

El `prompt` del bot convierte esos puntos en instrucciones. Está escrito en inglés, como la plantilla que lo rodea; el idioma de las respuestas se fija aparte.

### Corto, para el oído

Una respuesta de voz se oye una sola vez, a la velocidad del habla. Las frases habladas de Narsil en narsil-pet son una o dos frases cortas, como "Listo, ya quedó.". El prompt pide lo mismo: dos frases como mucho salvo que pidas más, sin listas, sin Markdown, sin código leído en voz alta, y los números dichos como los diría una persona. Las reglas propias de la plantilla, como su lista de emojis permitidos, se quedan como están.

### El idioma de cada respuesta

La plantilla tiene una regla estricta: cada respuesta se escribe en `{{language}}`, hables el idioma que hables. El gestor de prompts lo rellena con el ajuste `language` del bloque de TTS seleccionado, y recurre a `中文` (chino) cuando falta. Por eso el bot fija `language` dentro de `TTS.EdgeTTS`, con el valor `Spanish`, la palabra que mejor lee la plantilla en inglés.

### La voz

`EdgeTTS` usa el servicio de voz en línea de Microsoft Edge a través del paquete de Python `edge-tts`; el proveedor del servidor (`core/providers/tts/edge.py`) pasa la `voice` configurada directamente a `edge_tts.Communicate`. El valor por defecto es `zh-CN-XiaoxiaoNeural`.

Narsil habla español latinoamericano neutro, así que el bot usa `es-MX-DaliaNeural`, una voz femenina de español (México) de la [lista de voces](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts) de Microsoft. Edge ofrece una parte de esa lista; `edge-tts --list-voices`, del [README de edge-tts](https://github.com/rany2/edge-tts), imprime las voces que de verdad puede usar, así que comprueba ahí tu elección. `es-CO-SalomeNeural` y `es-US-PalomaNeural` son otras voces femeninas latinoamericanas de la lista de Microsoft.

EdgeTTS no necesita clave, pero es un servicio en línea: las respuestas de Narsil, como texto, van a Microsoft para convertirse en voz. [La guía 12](/es/bot/secrets-privacy/) lista lo que sale de tu red.

### Las frases propias del servidor

Algunas frases no vienen de Claude, y están en chino en `config.yaml`:

| Ajuste                  | Qué es                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| `system_error_response` | Lo que dice el servidor cuando algo falla ("主人，小智现在有点忙…", "Amo, Xiaozhi está ocupado…") |
| `end_prompt.prompt`     | La instrucción para la despedida cuando termina una conversación                                  |
| `exit_commands`         | Palabras que cierran la conversación: `退出` ("salir") y `关闭` ("cerrar")                        |

El bot sustituye las tres. La frase de error se dice tal como está escrita, así que está en español; la despedida es una instrucción para el modelo, así que puede quedarse en inglés.

### La palabra de activación

La palabra de activación se escucha en la panza, no en el servidor. `scripts/build.py` de Xiaozhi elige "Hi ESP" para una compilación en español (guía 3), y el bot la conserva. `Kconfig.projbuild` de Xiaozhi también ofrece una palabra de activación personalizada en el ESP32-P4 (`USE_CUSTOM_WAKE_WORD`, con la frase en `CUSTOM_WAKE_WORD`), mediante el modelo MultiNet de ESP-SR; su texto de ayuda pide pinyin para las frases en chino. "Para ir más lejos" tiene más.

## Cómo se le pidió a la IA

El personaje nunca fue una pregunta, porque quedó resuelto desde el primer mensaje. Quien creó Narsil describió la cabeza como la cara de Narsil:

> la cabeza va a ser una apntalla holografica que solo sea la cara de narsil

Y cuando la IA preguntó cómo debía hablar Narsil, la elección fue Xiaozhi:

> yo pensaba hacerlo con Xiaozhi

Una cara que es la de Narsil necesita una voz que también sea suya. La IA no escribió un personaje nuevo: leyó el README y `hooks/words.ts` de narsil-pet, y conservó lo que dicen de ella. El nombre de la voz, el valor de `language` y la frase de error en español no se preguntaron; son elecciones de la IA a partir de la lista de voces de Microsoft y de la plantilla del servidor, y puedes cambiar cualquiera de ellas.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es la conversación con la que se construyó el bot.

> Mi dispositivo Xiaozhi habla a través de xinnan-tech/xiaozhi-esp32-server con Claude como LLM. Lee `agent-base-prompt.txt` y `core/utils/prompt_manager.py` del servidor para ver dónde va el ajuste `prompt` y cómo se rellena `{{language}}`. Después escribe un `prompt` para mi personaje, una serpiente marina tranquila y cálida que responde con dos frases cortas como mucho, pensadas para la voz, y las líneas de `data/.config.yaml` que fijan respuestas en español, una voz de EdgeTTS en español latinoamericano que aparezca en `edge-tts --list-voices`, y versiones en español de `system_error_response` y `exit_commands`.

## El código mínimo

Las líneas que `data/.config.yaml` añade a las de las guías 4 y 5:

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

La frase de error dice "Tuve un tropiezo y no pude responder. Probemos de nuevo en un momento.", en el mismo registro que las frases de error de narsil-pet. Dentro de `EdgeTTS` solo se fijan `voice` y `language`; `type` y `output_dir` vienen de `config.yaml`.

Reinicia el servidor para que vuelva a leer el archivo:

```powershell
docker compose restart
```

## Errores comunes y cómo probarlo

- **Respuestas en chino.** Falta `language`, o está dentro de un bloque de TTS que no está seleccionado. Debe estar dentro del bloque nombrado en `selected_module.TTS`.
- **Respuestas largas.** Claude sigue el prompt; si Narsil habla demasiado, haz más concreta la regla de longitud ("una o dos frases") en lugar de bajar `max_tokens`, que corta las respuestas a mitad de frase.
- **Una voz que no existe en Edge.** Una voz de la lista de Microsoft que Edge no ofrece falla en el momento de la síntesis. Compruébala con `edge-tts --list-voices`.
- **Texto en español, voz china.** `voice` todavía tiene el valor por defecto. La voz y el idioma son dos ajustes separados.
- **El nombre del personaje dicho en voz alta.** La Narsil de narsil-pet nunca dice su propio nombre; si el bot lo dice, indícalo de forma explícita en el prompt.
- **Markdown leído en voz alta.** Los asteriscos y las almohadillas se convierten en ruido al hablar. El prompt los prohíbe; si aun así aparecen, añade un ejemplo de una buena respuesta.

Para probarlo, reinicia el servidor, despierta la panza y pregunta "¿quién eres?". Narsil debería responder en español, con una o dos frases, con la voz nueva y sin decir su nombre. Después pregunta algo largo, como cómo se prepara una receta: la respuesta debería seguir siendo corta y ofrecer más. Di "salir" para comprobar que la conversación se cierra.

## Para ir más lejos

- **Tu propia plantilla.** `prompt_template` puede apuntar a un archivo propio, por ejemplo en `data/`, si quieres quitar reglas que no encajan con Narsil (el reconocimiento de hablantes de la plantilla o su sección de seguridad). Mantén la sección `<context>` al final para que la división de la caché de la guía 5 siga funcionando.
- **Una palabra de activación personalizada.** Con `USE_CUSTOM_WAKE_WORD`, la panza puede escuchar una frase que elijas. Comprueba en la documentación de ESP-SR qué idiomas admiten sus modelos MultiNet antes de elegir "Narsil".
- **Otras voces.** `private_voice`, si se fija, sustituye a `voice` en el proveedor EdgeTTS. Los proveedores de TTS locales (guía 4) mantienen la voz en tu PC.
- **Su etapa.** La Narsil de narsil-pet crece en cinco etapas. La panza recibe su estado desde ntfy (guía 7), y el servidor podría añadirlo al prompt mediante el `dynamic_context` de la plantilla, para que la Narsil del escritorio hable según la etapa en la que está.
- La guía 7 muestra los avisos de Narsil en la pantalla de la panza.
