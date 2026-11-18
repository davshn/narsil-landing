---
title: Xiaozhi en la panza
description: 'Qué es Xiaozhi, cómo corre en la placa ESP32-P4 de Waveshare, cómo se apunta la panza a tu propio servidor en lugar de a xiaozhi.me, y qué pasa en el primer arranque.'
route: bot
order: 3
updated: 2026-11-18
---

## Qué hace

Xiaozhi ([78/xiaozhi-esp32](https://github.com/78/xiaozhi-esp32), MIT) es un firmware de código abierto que convierte una placa ESP32 en un asistente de voz. Es lo que le da a la panza sus oídos y su voz: escucha una palabra de activación, envía lo que dices a un servidor y reproduce la respuesta.

Según su README, las partes que usa el bot son:

- **Una cadena de voz.** El audio se comprime con Opus y se envía a un servidor, que hace el reconocimiento de voz, el modelo de lenguaje y la síntesis de voz, y devuelve la respuesta hablada.
- **Dos transportes**: [WebSocket](https://github.com/78/xiaozhi-esp32/blob/main/docs/websocket.md), o [MQTT más UDP](https://github.com/78/xiaozhi-esp32/blob/main/docs/mqtt-udp.md). El bot usa WebSocket.
- **Palabra de activación sin conexión** con ESP-SR de Espressif, así que la placa solo empieza a enviar audio después de oír su palabra de activación.
- **MCP en el dispositivo**: el firmware expone "herramientas" (el README nombra el control del altavoz, LED, servo y GPIO) que el modelo de lenguaje del servidor puede descubrir y llamar.
- **Configuración del Wi-Fi** mediante un punto de acceso o BluFi, así que no se compila ninguna contraseña de Wi-Fi.
- **Una capa de pantalla** para pantallas LCD, con expresiones y texto del chat.

Xiaozhi admite la panza del bot sin cambios. Por defecto habla con el servicio oficial en xiaozhi.me; el bot habla en su lugar con un servidor en tu propio PC (guía 4).

## Cómo funciona por dentro

### La carpeta de la placa

Cada placa que admite Xiaozhi tiene una carpeta en `main/boards/`. La de la panza es `main/boards/waveshare/esp32-p4-wifi6-touch-lcd/`, compartida por toda la familia ESP32-P4-WIFI6-Touch-LCD (4B, 4.3, 5, 7B, 3.4C, 4C, 7, 8 y 10.1 pulgadas). Contiene:

- `esp32-p4-wifi6-touch-lcd.cc`: la clase de la placa, `WaveshareEsp32p4`, construida sobre `WifiBoard` de Xiaozhi. Pone en marcha la pantalla, el panel táctil GT911 y el códec de audio.
- `config.h`: los pines y los tamaños. Para la placa de 4,3 pulgadas fija una pantalla de 480 × 800 en 2 carriles MIPI DSI a 500 Mbps, audio a 24.000 Hz de entrada y de salida, el ES8311 y el ES7210 por I2C (GPIO7 y GPIO8), I2S de GPIO9 a GPIO13, y el botón BOOT en GPIO35.
- `config.json`: las variantes de compilación que conoce `scripts/build.py`.
- `README.md`: qué opción del menú selecciona cada tamaño.

### Dos variantes para la misma placa

`config.json` lista dos compilaciones para la placa de 4,3 pulgadas, y elegir la correcta importa:

| Variante                        | Opciones adicionales                                                   | Para                                      |
| ------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------- |
| `esp32-p4-wifi6-touch-lcd-4.3`  | `CONFIG_ESP32P4_SELECTS_REV_LESS_V3=y`, `CONFIG_ESP32P4_REV_MIN_100=y` | Silicio ESP32-P4 anterior a la revisión 3 |
| `esp32-p4x-wifi6-touch-lcd-4.3` | ninguna de esas dos                                                    | Silicio ESP32-P4 de revisión 3.x          |

Las dos fijan `CONFIG_BOARD_TYPE_WAVESHARE_ESP32_P4_WIFI6_TOUCH_LCD_4_3=y`, la cancelación de eco en el dispositivo (`CONFIG_USE_DEVICE_AEC=y`) y las opciones de la cámara OV5647 para la versión que la tiene. El README de Xiaozhi indica que ESP32-P4 Rev1 y Rev3 tienen soporte en IDF 6, y el README del soporte de placa de Waveshare describe la misma división ("pre-v3 silicon" y "rev3.x or newer", es decir, silicio anterior a v3 y rev3.x o posterior). esptool imprime el chip y su revisión cuando se conecta a la placa, así que comprueba el tuyo antes de la primera compilación.

### Cómo encuentra la panza su servidor

La dirección del servidor no se compila en el código de voz. En cada arranque, Xiaozhi pide sus ajustes a un **endpoint OTA**, como describe su [documento OTA](https://github.com/78/xiaozhi-esp32/blob/main/docs/ota.md):

1. La placa envía un `POST` a la URL OTA con su identidad (dirección MAC, un UUID `Client-Id` guardado en NVS, nombre de la placa, versión del firmware) y sus capacidades.
2. El servidor responde con JSON: un objeto `websocket` (`url` y `token`) o un objeto `mqtt`, la hora del servidor, una actualización de firmware opcional y un código de `activation` opcional.
3. La placa guarda los ajustes de conexión en NVS y abre el canal de voz cuando lo necesita.

La regla del documento para elegir la URL OTA: el firmware "uses a valid saved `wifi.ota_url`, otherwise `CONFIG_OTA_URL`" (usa un `wifi.ota_url` guardado y válido; si no, `CONFIG_OTA_URL`). En `main/ota.cc`:

```cpp
std::string Ota::GetCheckVersionUrl() {
    Settings settings("wifi", false);
    std::string url = settings.GetString("ota_url");
    if (!wifi_config::IsValidOtaUrl(url)) {
        ESP_LOGW(TAG, "Ignoring invalid saved OTA URL; using the default");
        url.clear();
    }
    if (url.empty()) {
        url = CONFIG_OTA_URL;
    }
    return url;
}
```

`CONFIG_OTA_URL` viene de `main/Kconfig.projbuild`, en el menú `Xiaozhi Assistant`, como "Default OTA URL", con el valor por defecto `https://api.tenclass.net/xiaozhi/ota/` (el servicio oficial). Así que hay dos formas de apuntar la panza a tu servidor:

- **Guardar la URL en el dispositivo** (lo que hace el bot). La página de configuración del Wi-Fi tiene una pestaña Advanced (avanzado) con un campo de URL OTA; lo que escribas ahí se guarda en NVS como `wifi/ota_url`.
- **Cambiar el valor por defecto en la compilación**, con `idf.py menuconfig` o editando `Kconfig.projbuild`, como hace la guía de firmware de xinnan-tech.

El bot la guarda en el dispositivo por una regla fijada para todo el proyecto: los secretos, y con ellos la dirección del servidor, viven en NVS o en la configuración local, nunca en el repositorio. Una URL guardada en el dispositivo nunca llega a git, y mover el servidor a otro PC no requiere volver a compilar.

### Primer arranque y configuración del Wi-Fi

El Wi-Fi viene del componente [esp-wifi-connect](https://github.com/78/esp-wifi-connect) de Xiaozhi. Su README dice que primero prueba las redes guardadas en la flash, y si eso falla arranca un punto de acceso y un servidor web en `http://192.168.4.1`. El `WifiBoard` de Xiaozhi lo configura con el prefijo `Xiaozhi`, así que el punto de acceso se llama `Xiaozhi-` seguido de cuatro dígitos hexadecimales de la dirección MAC de la placa, y activa el campo OTA de la pestaña Advanced (`show_ota_config = true`).

El componente valida la URL OTA antes de guardarla: un valor vacío significa "usar el valor por defecto del firmware", y cualquier otro debe ser una URL HTTP o HTTPS absoluta de como mucho 255 bytes ASCII, con host.

Una vez conectada, la panza llama al endpoint OTA de tu servidor. Con el servicio oficial, la respuesta incluye un código de activación que se introduce en la consola de xiaozhi.me. Tu propio servidor en su modo mínimo devuelve la dirección del WebSocket y ningún código de activación (guía 4), así que no hay nada que vincular y la panza pasa directamente a reposo.

### Una conversación, paso a paso

Según el documento de WebSocket de Xiaozhi:

1. **Reposo → Conectando.** La palabra de activación o el botón BOOT abre el canal de audio: la panza se conecta a la URL del WebSocket, con las cabeceras `Authorization`, `Protocol-Version`, `Device-Id` y `Client-Id`, y envía un mensaje `"type": "hello"` con sus parámetros de audio.
2. **Conectando → Escuchando.** El servidor responde con su propio `hello` y un ID de sesión, la panza envía `listen` con `"state": "start"`, y el audio del micrófono sube como Opus en tramas binarias.
3. **El servidor trabaja.** Devuelve `stt` con el texto que oyó, `llm` con una emoción para la cara, y mensajes `tts`: `start`, después `sentence_start` con el texto de cada frase, y después `stop`.
4. **Escuchando → Hablando → Reposo.** Con `tts` `start` la panza deja de enviar audio y reproduce lo que llega; con `stop` vuelve a escuchar si la continuación automática está activada, o a reposo si no.

Esa emoción de `llm` será útil más adelante: es lo primero que la panza puede reenviar a la cabeza como pose.

### MCP en el dispositivo

Xiaozhi registra herramientas en el dispositivo a través del singleton `McpServer`, con `AddTool(name, description, properties, callback)`. El servidor envía `initialize`, después `tools/list` y después `tools/call` por JSON-RPC 2.0, como explica su [documento de uso de MCP](https://github.com/78/xiaozhi-esp32/blob/main/docs/mcp-usage.md). Así es como el cerebro de Narsil podrá actuar sobre el bot, no solo hablar a través de él; guías posteriores añaden las herramientas propias del bot.

## Cómo se le pidió a la IA

La voz no estaba en el primer diseño. Cuando las dos placas ya tenían sus papeles, la IA preguntó cómo debía hablar Narsil, y quien creó Narsil ya tenía una respuesta:

> yo pensaba hacerlo con Xiaozhi

La IA leyó el README de Xiaozhi para comprobar qué aporta y qué requiere: licencia MIT, el ESP32-P4 entre sus plataformas de chips, y ESP-IDF 6.0.1 o posterior (guía 2). Eso convirtió a Xiaozhi en la base del firmware de la panza, y al repositorio en un fork suyo.

Después tocaba decidir dónde se procesa la voz. Xiaozhi se conecta a xiaozhi.me por defecto, y la IA preguntó si usar ese servicio o un servidor propio. La respuesta:

> servidor propio

Esa respuesta es la razón de que esta guía dedique tiempo a la URL OTA: es el único ajuste que lleva la panza del servicio oficial al tuyo. La guía 4 construye el servidor en sí.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es la conversación con la que se construyó el bot.

> Tengo un fork de 78/xiaozhi-esp32 y una Waveshare ESP32-P4-WIFI6-Touch-LCD-4.3. Lee la carpeta de la placa `main/boards/waveshare/esp32-p4-wifi6-touch-lcd/`, `main/Kconfig.projbuild`, `main/ota.cc` y `docs/ota.md`, y después explícame: qué variante de compilación encaja con mi placa y cómo sé la revisión de mi chip, el comando `scripts/build.py` exacto, y todas las formas en que el firmware decide qué URL OTA usar. Quiero que la dirección de mi servidor quede fuera del repositorio, así que recomiéndame la opción que la guarda en el dispositivo, y dime qué veré en el primer arranque.

## El código mínimo

La panza no necesita código nuevo para esta guía: es Xiaozhi tal cual, compilado para la placa correcta. Desde la raíz del fork, en PowerShell, con la imagen Docker de la guía 2:

```powershell
docker run --rm -v ${PWD}:/project -w /project -e HOME=/tmp -e IDF_GIT_SAFE_DIR=/project `
  espressif/idf:release-v6.1 `
  python scripts/build.py waveshare/esp32-p4-wifi6-touch-lcd --name esp32-p4-wifi6-touch-lcd-4.3 --language es-ES
```

- `waveshare/esp32-p4-wifi6-touch-lcd` es la carpeta de la placa dentro de `main/boards/`.
- `--name` elige la variante. Sin él, `build.py` pregunta de forma interactiva, y en un contenedor sin terminal se detiene con "Multiple variants found in non-interactive mode; select one with --name." (se encontraron varias variantes en modo no interactivo; elige una con --name). Usa `esp32-p4x-wifi6-touch-lcd-4.3` para silicio de revisión 3.
- `--language es-ES` pone en español la interfaz y los mensajes de voz, el idioma de Narsil; el valor por defecto es `en-US`. Sin `--wake-word`, `build.py` elige "Hi ESP" para todos los idiomas excepto `zh-CN` y `zh-TW`.

El resultado es `build/merged-binary.bin`. Flashéalo desde Windows (guía 2):

```powershell
esptool --port COM5 write-flash 0x0 build/merged-binary.bin
```

Después, en el primer arranque:

1. En tu teléfono, únete a la red Wi-Fi `Xiaozhi-` seguida de cuatro caracteres.
2. Abre `http://192.168.4.1`.
3. En la pestaña **Advanced**, introduce la URL OTA de tu servidor, formada por la dirección LAN de tu PC y el puerto 8003 (guía 4), por ejemplo `http://192.168.1.50:8003/xiaozhi/ota/`. Guarda.
4. Elige tu red Wi-Fi, introduce su contraseña y guarda.

Si compilas con `idf.py` en lugar de `build.py`, la misma placa se selecciona en `idf.py menuconfig`, en `Xiaozhi Assistant`, opción "Waveshare ESP32-P4 Wi-Fi 6 Touch LCD 4.3".

## Errores comunes y cómo probarlo

- **La variante equivocada para tu silicio.** Las dos compilaciones de 4,3 pulgadas solo se diferencian en la revisión de chip a la que apuntan. Comprueba la revisión que imprime esptool y elige el `--name` correspondiente.
- **`127.0.0.1` o `localhost` como URL OTA.** En la panza, eso significa la propia panza. Usa la dirección del PC en tu red.
- **Una URL que el portal rechaza.** Debe ser absoluta (con `http://`), llevar host y quedarse por debajo de 255 bytes ASCII. Mantén la ruta exactamente como `/xiaozhi/ota/`, con la barra final, tal como la imprime el servidor.
- **`https://` hacia un servidor HTTP simple.** El servidor mínimo de la guía 4 habla HTTP simple en el 8003.
- **Una URL no válida guardada antes.** El firmware la ignora y vuelve a `CONFIG_OTA_URL`, que es el servicio oficial. El monitor muestra "Ignoring invalid saved OTA URL; using the default" (se ignora la URL OTA guardada no válida; se usa la de por defecto).
- **El punto de acceso vuelve tras un reflasheo completo.** El documento de WebSocket de Xiaozhi dice que el `Client-Id` se reinicia cuando se borra la NVS o se vuelve a flashear el firmware completo; si los ajustes guardados también han desaparecido, vuelve a introducir el Wi-Fi y la URL OTA.
- **La placa se conecta pero nunca responde.** El cortafuegos del PC puede estar bloqueando los puertos 8000 y 8003, o el servidor puede estar apagado. La panza sigue reintentando la comprobación OTA: diez intentos, empezando en diez segundos y duplicando.

Para probarlo, abre el monitor (guía 2) durante el primer arranque. Deberías ver la conexión Wi-Fi, la petición OTA a tu URL y, una vez que el servidor está en marcha, ningún paso de activación. Después di la palabra de activación, "Hi ESP": la panza pasa a escuchar, y el log del servidor (guía 4) muestra la conexión y el texto que oyó.

## Para ir más lejos

- El [documento OTA](https://github.com/78/xiaozhi-esp32/blob/main/docs/ota.md) de Xiaozhi describe cómo un servidor también puede ofrecer actualizaciones de firmware; el servidor de xinnan-tech puede servirlas desde su carpeta `data/bin`, así que la panza puede actualizarse por Wi-Fi.
- `scripts/build.py --list-wake-words` lista los modelos de palabra de activación del componente ESP-SR actual, y `--wake-word` elige uno.
- La [guía de placas personalizadas](https://github.com/78/xiaozhi-esp32/blob/main/docs/custom-board.md) advierte que nunca sobrescribas la configuración de una placa existente para una personalizada, porque la OTA puede sustituir tu firmware por el de serie de esa placa. Tenlo en cuenta siempre que añadas tu propio código a la panza.
- Xiaozhi también puede mostrar expresiones en su propia pantalla; la guía 9 sustituye la pantalla de la panza por la interfaz propia de Narsil.
