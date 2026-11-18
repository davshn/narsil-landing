---
title: Tu propio servidor
description: 'Cómo correr xiaozhi-esp32-server de xinnan-tech en modo mínimo con Docker en tu PC, solo en la red local: su configuración, sus puertos y cómo lo encuentra la panza.'
route: bot
order: 4
updated: 2026-11-18
---

## Qué hace

Xiaozhi en la panza no entiende la voz ni piensa. Graba, comprime y reproduce. Escuchar, pensar y hablar ocurre en un servidor: por defecto el oficial en xiaozhi.me, y en este bot, un servidor en tu propio PC.

Ese servidor es [xinnan-tech/xiaozhi-esp32-server](https://github.com/xinnan-tech/xiaozhi-esp32-server), el servidor en Python que el README de Xiaozhi lista primero para desplegar en ordenadores personales. En cada conversación:

1. Recibe el audio de la panza por WebSocket.
2. Detecta dónde empiezas y dónde terminas de hablar (detección de actividad de voz).
3. Convierte tu voz en texto (reconocimiento de voz, ASR).
4. Envía el texto a un modelo de lenguaje (LLM). En este bot, Claude, desde la guía 5.
5. Convierte la respuesta en voz (síntesis, TTS) y la envía de vuelta.

También responde a la petición OTA de la panza, que es como la panza sabe dónde está el WebSocket (guía 3).

El bot lo corre en el **modo mínimo** del proyecto, que el README en inglés llama "Simplified Installation" (instalación simplificada): un agente, datos guardados en archivos de configuración, sin base de datos y sin consola web. Corre en Docker en el PC en el que trabajas, y solo se puede llegar a él desde tu red local.

## Cómo funciona por dentro

### Por qué solo en tu red local

El README del proyecto es directo sobre su madurez. Su traducción al inglés dice que el proyecto "has not passed network security assessment" (no ha superado una evaluación de seguridad de red), pide no usarlo en producción y pide medidas de protección si lo despliegas en una red pública para aprender. El original en chino dice lo mismo: "未通过网络安全测评".

El bot toma la lectura segura: el servidor nunca da a internet. No se redirige ningún puerto en el router, y solo los dispositivos de tu red pueden llegar a él. La configuración por defecto encaja con ese uso: la autenticación está desactivada (`server.auth.enabled: false`), lo que es aceptable en una red doméstica y no en internet.

### Módulos: qué usa cada paso

`main/xiaozhi-server/config.yaml` elige un proveedor por paso en `selected_module`. Los valores por defecto:

| Paso                  | Clave    | Por defecto     | Notas de `config.yaml`                            |
| --------------------- | -------- | --------------- | ------------------------------------------------- |
| Actividad de voz      | `VAD`    | `SileroVAD`     | Modelo local                                      |
| Reconocimiento de voz | `ASR`    | `FunASR`        | Local, sin conexión, modelo SenseVoiceSmall       |
| Modelo de lenguaje    | `LLM`    | `ChatGLMLLM`    | Necesita clave; la guía 5 lo sustituye por Claude |
| Modelo de visión      | `VLLM`   | `ChatGLMVLLM`   | El bot no lo usa                                  |
| Síntesis de voz       | `TTS`    | `EdgeTTS`       | Voz `zh-CN-XiaoxiaoNeural` por defecto            |
| Memoria               | `Memory` | `nomem`         | Sin memoria entre conversaciones                  |
| Intención             | `Intent` | `function_call` | El modelo llama a las herramientas directamente   |

Cada nombre apunta a un bloque del mismo nombre más abajo en el archivo (`ASR.FunASR`, `TTS.EdgeTTS` y así sucesivamente) con los ajustes de ese proveedor.

### `config.yaml` y `data/.config.yaml`

Los comentarios del principio de `config.yaml` dan la regla: crea `data/.config.yaml` y pon ahí tus cambios, no en `config.yaml`. El servidor lee primero `data/.config.yaml` y toma de `config.yaml` todo lo que falte. La guía de despliegue lo llama la forma más concisa, y el comentario añade por qué importa: mantiene tus claves fuera del propio archivo del proyecto.

Para el bot esto significa que `data/.config.yaml` contiene solo lo que difiere de los valores por defecto: la dirección del WebSocket, la zona horaria, los proveedores elegidos y sus claves. Vive en tu PC, fuera de cualquier repositorio.

### Puertos

El `docker-compose.yml` del proyecto publica dos puertos:

| Puerto | Ajuste             | Qué sirve                                                                  |
| ------ | ------------------ | -------------------------------------------------------------------------- |
| 8000   | `server.port`      | El WebSocket con el que habla la panza, en `/xiaozhi/v1/`                  |
| 8003   | `server.http_port` | HTTP: la interfaz OTA sencilla en `/xiaozhi/ota/`, y el análisis de visión |

El servidor escucha en `0.0.0.0` (`server.ip`), es decir, en todas las interfaces de red del contenedor. Docker publica esos puertos en el PC.

### Cómo lo encuentra la panza

Importan dos direcciones, las dos construidas a partir de la dirección de tu PC en la red local (aquí la inventada `192.168.1.50`):

- **URL OTA:** `http://192.168.1.50:8003/xiaozhi/ota/`. La escribes una vez en la panza, en la pestaña Advanced del portal Wi-Fi (guía 3).
- **URL del WebSocket:** `ws://192.168.1.50:8000/xiaozhi/v1/`. El servidor se la envía a la panza en su respuesta OTA.

La segunda necesita cuidado en Docker. El servidor construye la dirección del WebSocket por sí mismo solo mientras `server.websocket` conserva el marcador de `config.yaml` (`ws://你的ip或者域名:端口号/xiaozhi/v1/`, "tu IP o dominio : puerto"). Dentro de un contenedor, la dirección que ve es la del contenedor, no la de tu PC. La [guía de despliegue](https://github.com/xinnan-tech/xiaozhi-esp32-server/blob/main/docs/Deployment.md) advierte que con Docker las direcciones del log de arranque no son las reales, y que el método correcto es usar la dirección LAN del PC. Así que el bot fija `server.websocket` de forma explícita, y el manejador OTA envía entonces exactamente ese valor. Como no hay ningún `mqtt_gateway` configurado, envía un objeto `websocket`, que es lo que selecciona WebSocket en la panza.

Va un ajuste más con él: `server.timezone_offset`, la zona horaria que la respuesta OTA comunica a la panza. El valor por defecto `+8` es la hora de China; pon la tuya.

### Local o API: elegir el reconocimiento y la síntesis de voz

Cada paso puede correr en tu PC o llamar a una API en la nube. `config.yaml` documenta los dos tipos:

| Tipo  | Reconocimiento de voz (ASR)                                   | Síntesis de voz (TTS)                                                                                       |
| ----- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Local | `FunASR` (por defecto), `SherpaASR`, `VoskASR` (sin conexión) | `FishSpeech`, `PaddleSpeechTTS`, `IndexStreamTTS`, `GPT_SOVITS_V2` (cada uno necesita su propio despliegue) |
| API   | `OpenaiASR`, `GroqASR`, `AliyunASR`, `DoubaoASR` y otros      | `OpenAITTS`, `AliyunTTS`, `DoubaoTTS` y otros                                                               |

Las ventajas y desventajas:

- **Lo local mantiene tu voz en casa y no cuesta nada por uso**, pero usa la memoria y la CPU de tu PC. El README indica que correr `FunASR` en local consume más memoria, y que usar APIs para todo mantiene bajo el consumo de recursos.
- **El idioma importa.** Narsil habla español. El comentario del bloque `FunASR` lista las etiquetas de idioma que admite SenseVoice como zh, en, ja, ko y yue, así que para español el bot usa otro reconocedor. `OpenaiASR` (modelo `gpt-4o-mini-transcribe` por defecto) y `GroqASR` (`whisper-large-v3-turbo`) son APIs multilingües; `VoskASR` funciona sin conexión y admite varios idiomas con un modelo descargado.
- **Una API envía tu audio fuera de tu red** y necesita una clave. La guía 12 lista lo que sale de la red y por qué.

El bot usa `OpenaiASR` para el reconocimiento y mantiene `EdgeTTS` para la síntesis, que no necesita clave en `config.yaml`. La voz de Narsil en sí, y el ajuste `voice`, son la guía 6.

### Sin el servidor, solo se para la voz

El servidor hace un único trabajo: la voz. La panza se conecta a ntfy y a GitHub por su cuenta (guías 7 y 8), y la cabeza dibuja lo que la panza le envíe. Si tu PC está apagado, o Docker está parado, los avisos de Narsil, tus pull requests y su cara siguen funcionando. Solo la palabra de activación no lleva a ninguna parte hasta que el servidor vuelve.

## Cómo se le pidió a la IA

La decisión de correr un servidor llegó en la guía 3: quien creó Narsil eligió "servidor propio" en lugar de xiaozhi.me. La IA propuso entonces este servidor en modo mínimo, con Docker, solo en la red local, y volvió a preguntar antes de seguir. La confirmación fue:

> vamos con el propio de una

La siguiente pregunta fue dónde correría: en el PC, o en otra máquina de casa. La respuesta:

> en el pc, igual la idea es usarlo para trabajar con claude

Esa segunda respuesta explica dos cosas de esta guía. El servidor corre en Docker en el PC en el que ya trabaja quien creó Narsil, así que no hay nada nuevo que tenga que quedarse encendido. Y Claude es el cerebro: la siguiente decisión, registrada como la especificación S5, eligió la opción "1", un proveedor nativo de Anthropic escrito en Python con el Anthropic SDK en lugar de un endpoint compatible con OpenAI. La guía 5 lo construye.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es la conversación con la que se preparó el bot.

> Quiero correr xinnan-tech/xiaozhi-esp32-server en su modo mínimo con Docker en mi PC con Windows, accesible solo desde mi red local, para un dispositivo Xiaozhi. Lee el README del proyecto, `docs/Deployment.md`, `main/xiaozhi-server/config.yaml` y `docker-compose.yml`, y después dame: la estructura de carpetas, un `data/.config.yaml` que sobrescriba solo lo que necesito (dirección del WebSocket con mi IP de la LAN, zona horaria, un reconocedor de voz que entienda español), los comandos para arrancarlo y leer sus logs, y la URL OTA que tengo que darle al dispositivo. Cita el aviso de seguridad del proyecto y dime qué puertos abre.

## El código mínimo

La carpeta en el PC, según la guía de despliegue:

```text
xiaozhi-server
├─ docker-compose.yml
├─ data
│  └─ .config.yaml
└─ models
   └─ SenseVoiceSmall
      └─ model.pt
```

`docker-compose.yml` es el propio archivo del proyecto, descargado de `main/xiaozhi-server/`. El archivo compose monta `models/SenseVoiceSmall/model.pt` en el contenedor, así que la guía de despliegue te hace descargar ese modelo (desde ModelScope o Baidu) aunque el bot reconozca la voz mediante una API.

`data/.config.yaml`, con una dirección y una clave inventadas:

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

Solo se fija `api_key` dentro de `OpenaiASR`; el resto de ese bloque (`type`, `base_url`, `model_name`) viene de `config.yaml`. Usa el desplazamiento de tu propia zona horaria. La sección `LLM` llega en la guía 5; hasta entonces el servidor sigue seleccionando el `ChatGLMLLM` por defecto, que según la guía de despliegue necesita su clave para arrancar.

Arráncalo desde la carpeta `xiaozhi-server` y sigue su log:

```powershell
docker compose up -d
docker logs -f xiaozhi-esp32-server
```

La imagen es `ghcr.nju.edu.cn/xinnan-tech/xiaozhi-esp32-server:server_latest`, el contenedor se llama `xiaozhi-esp32-server`, y `restart: always` lo vuelve a levantar después de un reinicio de Docker.

## Errores comunes y cómo probarlo

- **Editar `config.yaml` en lugar de `data/.config.yaml`.** Tus cambios se mezclan con el archivo del proyecto y se pierden en la siguiente descarga. Ponlos en `data/.config.yaml`.
- **Fiarse de las direcciones del log de Docker.** Son las del contenedor. Usa la dirección LAN de tu PC en `server.websocket` y en la URL OTA de la panza.
- **Redirigir el 8000 o el 8003 en el router.** El proyecto no tiene evaluación de seguridad y la autenticación está desactivada por defecto. Mantenlo en tu red.
- **El cortafuegos del PC.** Si la panza no llega al servidor pero el propio navegador del PC sí, permite las conexiones entrantes en el 8000 y el 8003 desde tu red privada.
- **Una dirección del PC que cambia.** Si el router le da al PC una dirección nueva, la URL OTA de la panza y `server.websocket` quedan desfasadas. Una reserva DHCP en el router mantiene fija la dirección.
- **Actualizar sobrescribiendo `.config.yaml`.** Los pasos de actualización de la guía de despliegue dicen que hagas una copia de seguridad y copies tus claves una a una en el nuevo, porque un `config.yaml` nuevo puede traer ajustes nuevos.

Para probarlo, abre la URL OTA en un navegador del PC, por ejemplo `http://192.168.1.50:8003/xiaozhi/ota/`. La guía de firmware de xinnan-tech dice que un servidor que funciona responde "OTA接口运行正常" ("la interfaz OTA funciona con normalidad") seguido de la dirección del WebSocket que envía a los dispositivos. Si esa dirección muestra tu IP de la LAN y el puerto 8000, la panza lo encontrará. Después di la palabra de activación y mira `docker logs -f xiaozhi-esp32-server`: deberías ver cómo se conecta la panza y el texto que oyó.

## Para ir más lejos

- La instalación completa con módulos añade una base de datos, varios usuarios y agentes, y una consola web. El bot no la necesita, y su dirección OTA es distinta (la guía de firmware usa el puerto 8002 para ella).
- El servidor puede servir actualizaciones de firmware para la panza desde su carpeta `data/bin`, como describe la guía de actualización OTA del proyecto (`docs/ota-upgrade-guide.md`).
- `server.auth` puede exigir un token, con `allowed_devices` listando las direcciones MAC que se saltan la comprobación. Es una capa útil incluso en una red doméstica.
- La mayoría de los bloques de proveedor de `config.yaml` llevan comentarios, en chino, sobre dónde conseguir la clave y, en algunos, cuánto cuesta; lee el del que elijas antes de comprometerte con él.
- La guía 5 añade el `LLM` que hace pensar a Narsil con Claude, y la guía 6 le da una voz y una personalidad.
