---
title: Los avisos de Narsil desde ntfy
description: 'Cómo sigue la panza el mismo tema de ntfy que los avisos de Narsil en el teléfono: cómo arma narsil-pet el tema y sus mensajes, qué oculta la clave y un stream JSON en ESP-IDF.'
route: bot
order: 7
updated: 2026-11-18
---

## Qué hace

[Narsil for Claude Code](https://github.com/davshn/narsil-pet) ya le avisa a tu teléfono cuando una conversación te necesita: `/narsil movil` envía cada aviso a un tema privado de [ntfy.sh](https://ntfy.sh), y la app de ntfy lo muestra como una notificación. La panza se suscribe al mismo tema. Cuando Claude termina, tiene una pregunta o se detiene con un error, el aviso también aparece en la pantalla de la panza, con el estado de Narsil al lado.

Nada cambia del lado del PC: narsil-pet sigue publicando como lo hace para el teléfono, y la panza es un lector más del tema. Lee dos temas:

- **El tema de avisos**, `narsil-` seguido de 20 caracteres hexadecimales: un mensaje por aviso (listo, pregunta, error).
- **El tema de estado**, el mismo nombre con `-estado` al final: un pequeño estado en JSON que se envía al terminar cada turno, y que nunca se muestra como notificación.

## Cómo funciona por dentro

### Cómo arma narsil-pet el tema

El nombre del tema se crea en `hooks/phone.ts`. El siguiente extracto se cita de [davshn/narsil-pet](https://github.com/davshn/narsil-pet), con licencia GPL-3.0-or-later:

```ts
// A topic nobody guesses: whoever knows its name can read it.
export function newTopic(uuid: string): string {
  return `narsil-${uuid
    .replace(/[^0-9a-f]/gi, '')
    .toLowerCase()
    .slice(0, 20)}`
}
```

Toma un UUID aleatorio, conserva sus dígitos hexadecimales en minúsculas y usa los 20 primeros: un ejemplo inventado es `narsil-0123456789abcdef0123`. El tema de estado sale del mismo archivo:

```ts
export function statusTopic(topic: string): string {
  return `${topic}-estado`
}
```

En el ntfy.sh público, el nombre es la única protección. La [documentación de configuración de ntfy](https://docs.ntfy.sh/config/) dice que el servidor está abierto por defecto, y que "everyone can read and write to any topic (this is how ntfy.sh is configured)" (cualquiera puede leer y escribir en cualquier tema; así está configurado ntfy.sh). El comentario sobre `newTopic` dice lo mismo en menos palabras. Trata el tema como una contraseña: no va en el repositorio del firmware, y `/narsil movil nuevo` crea uno nuevo si se filtra.

### Qué lleva un aviso

`phoneMessage` en `hooks/phone.ts` construye el JSON que narsil-pet publica en ntfy.sh. En resumen:

- `title`: `Narsil · <title> · <conversation>`, con el nombre de la conversación de la que viene el aviso.
- `message`: el texto del aviso, después la lista de conversaciones abiertas y sus estados, y en el último aviso del día una nota de que es el último (narsil-pet envía como mucho 200 al día, por debajo de los 250 gratuitos de ntfy.sh).
- `priority`: 3 para `done`, 4 para `question` y `error`.
- `tags`: una etiqueta que nombra el tipo: `white_check_mark` (listo), `raising_hand` (pregunta) o `warning` (error).
- `icon`: el dibujo de Narsil en su etapa actual, en la pose del aviso.

Así que la panza puede saber el tipo de aviso solo por su etiqueta, y conoce la hora por el propio campo `time` de ntfy.

### Qué lleva el estado

El mensaje `-estado` es un objeto JSON dentro del campo `message` del mensaje de ntfy, enviado con prioridad 1. El README de narsil-pet documenta sus campos: `xp` (el nivel y la experiencia de Narsil), `art` (la URL de su dibujo en su etapa, en la pose de la conversación más importante), `at` (cuándo se envió, en segundos Unix), `cacheMinutes` (cuánto dura una caché, cuando la hay) y `usage` (la cuenta de ntfy del día). La panza usa `xp` y `at`, y le pasa la pose a la cabeza (guías 10 y 11).

### Qué oculta la clave, y qué no

`/narsil movil clave` sella lo que envía narsil-pet, con una clave que solo tienen tus dispositivos (`hooks/seal.ts`, HMAC-SHA256 en modo contador con una etiqueta encrypt-then-MAC). Conviene ser preciso con lo que cubre. Esto es `sealedMessage` de `hooks/phone.ts`, citado de [davshn/narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later):

```ts
export function sealedMessage<M extends { title?: string; message: string }>(
  m: M,
  sealed: string,
): M {
  return { ...m, ...(m.title ? { title: 'Narsil' } : {}), message: sealed }
}
```

Solo cambian `title` y `message`: el título pasa a ser "Narsil", y el texto pasa a ser una cadena sellada que empieza con `narsil1:`. Todo lo demás se copia tal cual. Con una clave, cualquiera que conozca el tema sigue viendo:

- el **tipo** de aviso, por `tags` y `priority`;
- **cuándo** se envió, por el `time` de ntfy;
- la **etapa** y la pose de Narsil, por la URL de `icon`.

El mensaje de estado no tiene título, así que todo su JSON va sellado y solo se ve su prioridad.

En la panza esto significa dos modos. Sin clave, lo muestra todo. Con clave, muestra el tipo, la hora y la etapa, y "Narsil" como título; leer el texto necesita la clave en la panza, que está en "Para ir más lejos".

### Suscribirse desde la panza

La [API de suscripción](https://docs.ntfy.sh/subscribe/api/) de ntfy tiene un stream JSON: un `GET` largo a `https://ntfy.sh/<topic>/json` que nunca termina, y que "returns a JSON stream, with one JSON message object per line" (devuelve un stream JSON, con un objeto de mensaje JSON por línea). Caben varios temas en una conexión, separados por comas, así que la panza abre un único stream para los dos:

```text
https://ntfy.sh/narsil-0123456789abcdef0123,narsil-0123456789abcdef0123-estado/json
```

Cada línea es un evento. El campo `event` dice cuál: `open` cuando empieza el stream, `keepalive` de vez en cuando para que la conexión no parezca muerta, y `message` para lo que importa. Un evento `message` tiene `id`, `time`, `topic`, `title`, `message`, `tags` y `priority`, entre otros.

En ESP-IDF el stream se lee con [`esp_http_client`](https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/api-reference/protocols/esp_http_client.html) en su orden de streaming: `esp_http_client_open`, `esp_http_client_fetch_headers` y después `esp_http_client_read` en un bucle, cortando los bytes en líneas en cada `\n`. HTTPS usa el [paquete de certificados](https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/api-reference/protocols/esp_crt_bundle.html) de ESP-IDF (`crt_bundle_attach = esp_crt_bundle_attach`), así que no se pega ningún certificado en el código. Cada línea se analiza con cJSON, que Xiaozhi ya usa para su propio protocolo.

### No perder avisos al reconectar

El Wi-Fi se cae, y las conexiones largas se cortan. ntfy guarda los mensajes durante un tiempo (el `cache-duration` del servidor es de 12 horas por defecto), y el parámetro `since=` pide lo que te perdiste: una duración como `10m`, una hora Unix o el ID de un mensaje. La panza recuerda el `id` del último mensaje que mostró y se reconecta con `since=<ese id>`, así que recibe exactamente los avisos enviados mientras estaba desconectada y ninguno dos veces. En un arranque desde cero no tiene ID y pide `since=10m`.

### Dónde vive el tema

El tema se guarda en la NVS de la panza, mediante la clase `Settings` de Xiaozhi (`main/settings.h`), en el espacio de nombres `narsil` con la clave `ntfy_topic`. Lo escribes una vez en la pantalla de ajustes de la panza, que construye la guía 9; nunca aparece en el código fuente. La guía 12 explica por qué la NVS no está cifrada por defecto y qué significa eso para un dispositivo en tu escritorio.

## Cómo se le pidió a la IA

El trabajo de la panza estaba en la primera descripción del bot que hizo quien creó Narsil:

> va a ser la pantalla grande para una pantalla en la pansa que va a tener la informacion de las tareas que hace narsil

Narsil ya publica esas tareas en ntfy para el teléfono, así que la IA propuso leer ese mismo tema en lugar de inventar un canal nuevo desde el PC. Después preguntó si la cabeza se conectaría a la red por su cuenta o lo recibiría todo de la panza, y la respuesta fue:

> Por cable desde la panza

Así que la panza es la única placa en la red para los avisos: se suscribe a ntfy, y la cabeza recibe solo la pose y el estado por el cable (guía 10). Cómo reconectar, y qué mostrar cuando hay una clave, no se preguntaron; la IA los tomó de la documentación de ntfy y del `sealedMessage` de narsil-pet.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es la conversación con la que se construyó el bot.

> Mi ESP32-P4 corre Xiaozhi (ESP-IDF 6). Añade una tarea de FreeRTOS que se suscriba a dos temas de ntfy.sh en un único stream JSON (`https://ntfy.sh/<a>,<b>/json`), lo lea con `esp_http_client_open`, `esp_http_client_fetch_headers` y `esp_http_client_read`, lo divida en líneas, analice cada una con cJSON y pase los eventos `message` a un callback. Usa el paquete de certificados, lee el tema de la NVS con la clase `Settings` de Xiaozhi, guarda el ID del último mensaje y reconéctate con `since=` después de un error. Cita la documentación de ntfy para el formato del stream y el parámetro `since`.

## El código mínimo

Una tarea para la panza, en C++ junto al código de Xiaozhi (MIT, como los ejemplos propios del sitio). `ShowAlert` y `ShowStatus` son las funciones de la pantalla de la guía 9:

```cpp
#include <cJSON.h>
#include <esp_crt_bundle.h>
#include <esp_http_client.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <string>

#include "settings.h"

void ShowAlert(const char* title, const char* text, const char* tag, long time);
void ShowStatus(const char* state_json, long time);

static std::string last_id;

static void HandleLine(const std::string& line, const std::string& status_topic) {
    cJSON* root = cJSON_Parse(line.c_str());
    if (root == nullptr) return;
    const char* event = cJSON_GetStringValue(cJSON_GetObjectItem(root, "event"));
    if (event != nullptr && std::string(event) == "message") {
        const char* id = cJSON_GetStringValue(cJSON_GetObjectItem(root, "id"));
        const char* topic = cJSON_GetStringValue(cJSON_GetObjectItem(root, "topic"));
        const char* title = cJSON_GetStringValue(cJSON_GetObjectItem(root, "title"));
        const char* text = cJSON_GetStringValue(cJSON_GetObjectItem(root, "message"));
        cJSON* tags = cJSON_GetObjectItem(root, "tags");
        const char* tag = cJSON_GetStringValue(cJSON_GetArrayItem(tags, 0));
        long time = (long)cJSON_GetNumberValue(cJSON_GetObjectItem(root, "time"));
        if (id != nullptr) last_id = id;
        if (topic != nullptr && status_topic == topic) {
            ShowStatus(text ? text : "", time);
        } else {
            ShowAlert(title ? title : "Narsil", text ? text : "", tag ? tag : "", time);
        }
    }
    cJSON_Delete(root);
}

static void NtfyTask(void*) {
    Settings settings("narsil");
    std::string topic = settings.GetString("ntfy_topic");
    if (topic.empty()) vTaskDelete(nullptr);
    std::string status_topic = topic + "-estado";

    while (true) {
        std::string url = "https://ntfy.sh/" + topic + "," + status_topic + "/json?since=" +
                          (last_id.empty() ? "10m" : last_id);
        esp_http_client_config_t config = {};
        config.url = url.c_str();
        config.crt_bundle_attach = esp_crt_bundle_attach;
        config.timeout_ms = 120000;
        esp_http_client_handle_t client = esp_http_client_init(&config);

        if (esp_http_client_open(client, 0) == ESP_OK && esp_http_client_fetch_headers(client) >= 0) {
            std::string line;
            char buffer[512];
            int read;
            while ((read = esp_http_client_read(client, buffer, sizeof(buffer))) > 0) {
                for (int i = 0; i < read; i++) {
                    if (buffer[i] != '\n') { line += buffer[i]; continue; }
                    HandleLine(line, status_topic);
                    line.clear();
                }
            }
        }
        esp_http_client_close(client);
        esp_http_client_cleanup(client);
        vTaskDelay(pdMS_TO_TICKS(5000));
    }
}

void StartNtfy() {
    xTaskCreate(NtfyTask, "ntfy", 8192, nullptr, 3, nullptr);
}
```

Llama a `StartNtfy()` cuando el Wi-Fi esté conectado. `ShowAlert` recibe la etiqueta, así que la pantalla puede elegir la pose y el color correctos aunque el texto esté sellado. El tiempo de espera de lectura de dos minutos está muy por encima del intervalo entre los eventos keepalive de ntfy, así que un tema en silencio no cuenta como una conexión muerta.

## Errores comunes y cómo probarlo

- **Un stream que termina después de las primeras líneas.** `poll=1` devuelve la caché y cierra; la URL del bot no debe incluirlo.
- **Toda la caché en cada reconexión.** Sin `since=`, una reconexión no trae nada antiguo; con `since=all`, lo vuelve a traer todo. Usa el último `id`.
- **Un tema con una mayúscula o una errata.** ntfy lo trata como un tema distinto y vacío. Cópialo de `/narsil movil`, que imprime el nombre.
- **Texto sellado en la pantalla.** Un mensaje que empieza con `narsil1:` fue sellado por `/narsil movil clave`. Muestra "Narsil" y el tipo según la etiqueta, o añade la clave (Para ir más lejos).
- **Ningún aviso mientras estás en el PC.** narsil-pet solo envía mientras tu último mensaje vino de Remote Control (su README explica por qué). `/narsil movil prueba` envía un aviso de prueba desde cualquier lugar.
- **El tema en el repositorio.** Va en la NVS a través de la pantalla de ajustes, nunca en un archivo fuente ni en un valor por defecto.

Para probarlo sin la panza, sigue el stream desde una terminal en el PC con el propio ejemplo de la documentación de ntfy, usando tu tema:

```powershell
curl.exe -s "https://ntfy.sh/narsil-0123456789abcdef0123/json"
```

Ejecuta `/narsil movil prueba` en Claude Code: aparece una línea `message`. Después haz lo mismo con la panza encendida: el aviso se muestra en su pantalla, y el monitor serie (guía 2) muestra la conexión con ntfy.sh. Apaga el Wi-Fi del router durante un minuto, envía otra prueba y vuelve a encenderlo: la panza se reconecta con `since=` y muestra el aviso que se perdió.

## Para ir más lejos

- **Leer los avisos sellados.** `hooks/seal.ts` deriva dos claves de la tuya con HMAC-SHA256 (`enc` y `mac`), hace XOR del texto con un flujo de clave HMAC en bloques de 32 bytes y comprueba una etiqueta sobre el nonce y el texto cifrado. mbedTLS, parte de ESP-IDF, tiene HMAC-SHA256; portar `unseal` permite a la panza leer el texto mientras el tema muestra ruido.
- **Tu propio servidor de ntfy.** ntfy puede correr en casa con control de acceso, así que el tema no es público. narsil-pet publica en `https://ntfy.sh`, así que habría que cambiar los dos lados.
- **El estado para la cabeza.** El mensaje `-estado` es lo que mueve la pose de Narsil en la cabeza; la guía 10 lo envía por la UART.
- La guía 8 añade la otra lista que muestra la panza: los pull requests que te necesitan. La pantalla en sí es la guía 9, en la [ruta del bot](/es/bot/).
