---
title: Secretos y privacidad
description: 'Cada secreto que guarda el bot y dónde vive, qué protegen la NVS y el cifrado de la flash, qué sale de tu red y hacia quién, y cómo borrar el bot y revocar cada credencial.'
route: bot
order: 12
updated: 2026-11-18
---

## Qué hace

El bot es un micrófono sobre tu escritorio con tu token de GitHub dentro, así que merece una guía que reúna todo el panorama en un solo lugar. Esta responde tres preguntas:

- **¿Qué secretos guarda el bot, y dónde?** Siete, en dos máquinas, y ninguno en el repositorio.
- **¿Qué sale de tu red?** Tu voz va a una empresa, tus palabras a otra, las respuestas de Narsil a una tercera, y dos servicios ven conectarse a la panza.
- **¿Cómo lo recuperas todo?** Cómo borrar la panza, y cómo revocar cada credencial en su origen.

Nada de esto es código nuevo. Reúne lo que configuraron las guías 3 a 11, y añade las opciones que ofrece ESP-IDF para proteger lo que se guarda en la placa.

## Cómo funciona por dentro

### Los secretos, y dónde vive cada uno

| Secreto                          | Vive en                                                                 | Lo pone                            | Da acceso a                            |
| -------------------------------- | ----------------------------------------------------------------------- | ---------------------------------- | -------------------------------------- |
| Nombre y contraseña del Wi-Fi    | NVS de la panza, espacio de nombres `wifi`, claves `ssid` y `password`  | Portal del Wi-Fi (guía 3)          | Tu red de casa                         |
| URL OTA (dirección del servidor) | NVS de la panza, `wifi/ota_url`                                         | Portal del Wi-Fi, pestaña Advanced | Adónde envía la panza tu voz           |
| URL y token del WebSocket        | NVS de la panza, espacio de nombres `websocket`, claves `url` y `token` | La respuesta OTA de tu servidor    | Hablar con tu servidor                 |
| Tema de ntfy                     | NVS de la panza, espacio de nombres `narsil`, clave `ntfy_topic`        | Pantalla de ajustes (guía 9)       | Leer (y escribir) los avisos de Narsil |
| Token de GitHub                  | NVS de la panza, espacio de nombres `narsil`, clave `gh_token`          | Pantalla de ajustes (guía 9)       | Leer los pull requests que puedes ver  |
| Clave de la API de Anthropic     | Tu PC: `ANTHROPIC_API_KEY` o `data/.config.yaml`                        | Tú (guía 5)                        | Gastar en tu cuenta de Anthropic       |
| Clave de la API de OpenAI        | Tu PC: `data/.config.yaml`, bloque `OpenaiASR`                          | Tú (guía 4)                        | Gastar en tu cuenta de OpenAI          |

Los espacios de nombres salen del código: el `ssid_manager.cc` de esp-wifi-connect abre `"wifi"` y lee `ssid`, `password` y sus copias numeradas (hasta diez redes); el `main/ota.cc` de Xiaozhi guarda los ajustes del WebSocket con `Settings settings("websocket", true)`; las guías 7 a 9 usan `narsil`.

En esa tabla vale la pena notar tres cosas:

- **Las dos claves de API, las que cuestan dinero, nunca tocan el bot.** La panza solo habla con tu servidor en la LAN; el servidor guarda las claves. Un bot robado no puede inflar una factura de Anthropic o de OpenAI.
- **La cabeza no guarda nada.** Su firmware tiene el arte de Narsil y el código de la UART. Cualquiera puede leer su flash y no aprender nada (la guía 10 explica por qué se dejó así).
- **El repositorio no guarda nada.** Ningún tema, token, clave ni dirección aparece en `davshn/narsil-bot`. El firmware es público, y por eso.

### Por qué la NVS, y qué protege la NVS

La NVS (non-volatile storage, almacenamiento no volátil) es el almacén de clave y valor de ESP-IDF en una partición de la flash; la clase `Settings` de Xiaozhi (`main/settings.h`) es una capa fina sobre ella. En la panza la partición se llama `nvs` en las tablas de particiones de Xiaozhi (`partitions/v2/32m.csv` le da 840 KB).

Por defecto, la NVS **no está cifrada**. `CONFIG_NVS_ENCRYPTION` de ESP-IDF solo viene activado por defecto cuando el cifrado de la flash está activado, y Xiaozhi no lo activa. Así que cualquiera con la placa en las manos y un cable USB puede leer la flash con esptool y encontrar en ella la contraseña del Wi-Fi, el tema y el token como texto plano. Para un bot que está en tu propio escritorio, ese es un riesgo aceptable para la mayoría, siempre que lo sepas y sepas cómo revocar las cosas (abajo). Si el bot viaja, está en una oficina o sale de tus manos, existen las opciones de abajo.

### Cifrado de la NVS en el ESP32-P4

La [página de cifrado de la NVS](https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/api-reference/storage/nvs_encryption.html) de ESP-IDF describe dos esquemas para este chip. Los dos usan XTS-AES, y la ayuda de Kconfig dice que cifra "the complete NVS data, except the page headers" (todos los datos de la NVS, excepto las cabeceras de página).

| Esquema                          | Dónde viven las claves                                                                     | Necesita cifrado de la flash | Costo                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------- | --------------------------------------------------------------------------- |
| Basado en el cifrado de la flash | Una partición `nvs_keys` (data, subtipo `nvs_keys`, marcada `encrypted`, de al menos 4 KB) | Sí                           | Todo lo que cuesta el cifrado de la flash (siguiente sección)               |
| Basado en el periférico HMAC     | Se derivan en tiempo de ejecución de una clave HMAC en eFuse; nunca se guardan en la flash | No                           | Quema para siempre un bloque de claves de eFuse, con el propósito `HMAC_UP` |

Las opciones son `CONFIG_NVS_ENCRYPTION`, y `CONFIG_NVS_SEC_KEY_PROTECTION_SCHEME` para elegir entre `CONFIG_NVS_SEC_KEY_PROTECT_USING_FLASH_ENC` y `CONFIG_NVS_SEC_KEY_PROTECT_USING_HMAC`. Para HMAC, `CONFIG_NVS_SEC_HMAC_EFUSE_KEY_ID` debe nombrar el bloque de eFuse (de 0 a 5; el valor por defecto, -1, no compila). Con el cifrado activado, `nvs_flash_init()` prepara la partición por defecto cifrada y genera sus claves, así que el código de Xiaozhi no cambia.

El esquema HMAC es el más ligero: la página dice que permite "secure storage on ESP32-P4 without enabling flash encryption" (almacenamiento seguro en el ESP32-P4 sin activar el cifrado de la flash). Protege contra alguien que lea el chip de la flash. Por sí solo no impide que alguien que pueda flashear un firmware nuevo en la placa ejecute código que use la misma clave de eFuse; para eso está el arranque seguro.

### Cifrado de la flash, y lo que cuesta

El [cifrado de la flash](https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/security/flash-encryption.html) cifra el firmware y los datos de la flash, de modo que "physical readout of flash will not be sufficient to recover most flash contents" (la lectura física de la flash no bastará para recuperar la mayor parte de su contenido). Se activa con `CONFIG_SECURE_FLASH_ENC_ENABLED` y tiene dos modos:

- **El modo Development** (el valor por defecto) sigue dejándote flashear un firmware nuevo en texto plano por USB; el bootloader lo cifra. Se puede volver a desactivar, pero solo una vez por chip.
- **El modo Release** impide que el bootloader USB haga operaciones de cifrado de la flash; el firmware nuevo llega solo por OTA. Elegir Release en menuconfig no quema los eFuses por sí solo; lo hace `esp_flash_encryption_set_release_mode()`.

La misma página es clara sobre sus límites: el cifrado de la flash "alone may not prevent an attacker from modifying the firmware of the device" (por sí solo puede no impedir que un atacante modifique el firmware del dispositivo), no oculta la distribución de la flash, y recomienda el arranque seguro junto a él. Y cambia tu forma de trabajar: una imagen en texto plano flasheada por error en una placa cifrada la deja bloqueada, de forma recuperable, en un bucle de reinicios. Para un bot de hobby que se vuelve a flashear cada tarde, ese es un costo real.

El bot no trae ninguno de los dos. Mantiene fuera de la placa los secretos que más importan (las claves de API), usa un token de GitHub de solo lectura que caduca, y trata el contenido de la placa como revocable. Cifrar la NVS con HMAC es el paso a dar si la placa sale de tu escritorio.

### Qué sale de tu red

| Qué                                           | Va a                            | Por qué                                        |
| --------------------------------------------- | ------------------------------- | ---------------------------------------------- |
| Tu voz, como audio                            | OpenAI (`api.openai.com`)       | `OpenaiASR` la convierte en texto (guía 4)     |
| Lo que dijiste, como texto, y el historial    | Anthropic (`api.anthropic.com`) | Claude escribe la respuesta de Narsil (guía 5) |
| Las respuestas de Narsil, como texto          | Microsoft                       | `EdgeTTS` las convierte en voz (guía 6)        |
| Una suscripción a tus temas de ntfy           | ntfy.sh                         | Los avisos de Narsil (guía 7)                  |
| Tu token de GitHub y una consulta de búsqueda | GitHub (`api.github.com`)       | Tus pull requests (guía 8)                     |

Hay que ser precisos con la voz. La palabra de activación se reconoce en la propia panza, con ESP-SR, así que no se transmite nada antes de que digas "Hi ESP". Después, la panza transmite lo que oyen los micrófonos a tu servidor, en la LAN. El servidor no se queda con ese audio en casa: con `OpenaiASR`, cada cosa que dices se envía **como audio** al endpoint de transcripción de OpenAI (`base_url: https://api.openai.com/v1/audio/transcriptions` en `config.yaml`), y el texto vuelve. La guía 4 lista la alternativa sin conexión: `VoskASR`, que corre en el PC con un modelo descargado, mantiene el audio en tu red, a cambio de algo de precisión.

Cada proveedor trata esos datos según sus propios términos para el uso de la API; lee los [de Anthropic](https://www.anthropic.com/legal/commercial-terms) y los de OpenAI antes de decidir. EdgeTTS no necesita cuenta, lo que también significa que ningún acuerdo tuyo cubre lo que recibe.

ntfy.sh ve la dirección IP de la panza y el nombre de los temas que sigue. Sin clave, también ve el texto de cada aviso; con `/narsil movil clave`, solo ve el tipo, la hora y la etapa (guía 7). GitHub ve el token, la consulta y la respuesta, por HTTPS.

### Qué se queda en tu red

- El audio entre la panza y tu servidor, por WebSocket en la LAN. Es `ws://` simple, no TLS, así que es tan privado como lo sea tu red: mantén el bot en el Wi-Fi de tu casa, no en uno compartido.
- La UART entre la panza y la cabeza, tres cables dentro del bot.
- La comprobación OTA, que va a la dirección de tu servidor. Aquí importa un detalle: si la URL OTA guardada no es válida, Xiaozhi recurre a `CONFIG_OTA_URL`, el servicio oficial en `api.tenclass.net` (guía 3). El monitor dice "Ignoring invalid saved OTA URL; using the default" cuando eso pasa; si lo ves, corrige la URL.

### Borrar el bot

Tres niveles, del más ligero al completo:

- **Solo los secretos de Narsil.** Un botón "Forget" en la pantalla de ajustes de la guía 9 que llame a `Settings("narsil", true).EraseAll()` borra el tema y el token, y nada más.
- **Todo lo de la panza.** Desde Windows, con la panza en su puerto USB (guía 2):

  ```powershell
  esptool --port COM5 erase-flash
  ```

  Esto borra la flash entera: el firmware, la NVS, la contraseña del Wi-Fi, la dirección del servidor, el tema y el token. Vuelve a flashear el firmware después (guía 3); la panza arranca entonces en la configuración del Wi-Fi como una nueva. El equivalente desde ESP-IDF es `idf.py erase-flash`.

- **La cabeza.** No guarda secretos, así que no hay nada que borrar. El mismo `erase-flash` en su puerto quita el firmware si regalas la placa.

### Revocar cada credencial

Borrar la placa protege la placa. Revocar la credencial te protege incluso cuando la placa ya no está. Si el bot se pierde o te lo roban, o alguien leyó la flash, haz todo esto, empezando por el token:

| Credencial           | Cómo revocarla                                                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Token de GitHub      | [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens), **Delete** junto al token (guía 8).         |
| Tema de ntfy         | `/narsil movil nuevo` en Claude Code crea un tema nuevo; el antiguo deja de recibir. Escribe el nuevo en la panza.                            |
| Contraseña del Wi-Fi | Cámbiala en el router. Todos los dispositivos necesitan la nueva, por eso va después de las demás.                                            |
| Clave de Anthropic   | Bórrala en la [Claude Console](https://platform.claude.com/settings/keys) (guía 5). Nunca estuvo en el bot; rótala si el PC estuvo implicado. |
| Clave de OpenAI      | Bórrala en la página de claves de la API de OpenAI. La misma regla: vive en el PC.                                                            |

## Constrúyelo con Claude

Pídele a Claude un mapa de los secretos y los datos del bot: dónde vive cada secreto, qué sale de tu red, y cómo borrar la placa y revocar cada credencial. La idea que debe acertar es que las claves de API de pago nunca tocan el bot, y que todo lo que guarda la placa se puede revocar en su origen.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es la conversación con la que se construyó el bot.

> Mi bot de escritorio es un ESP32-P4 que corre un fork de 78/xiaozhi-esp32, y habla con xinnan-tech/xiaozhi-esp32-server en mi PC con OpenaiASR, un proveedor de Claude y EdgeTTS, además de ntfy.sh y la API REST de GitHub desde la placa. Lista cada secreto que guarda y dónde (lee `main/settings.h`, `main/ota.cc` y el `ssid_manager.cc` de esp-wifi-connect para ver los espacios de nombres de la NVS), todo lo que sale de mi red y hacia quién, y lo que se queda en la LAN. Después explica los esquemas de cifrado de la NVS de ESP-IDF 6 para el ESP32-P4 y el cifrado de la flash, citando su documentación, con lo que cuestan para un dispositivo de hobby que vuelvo a flashear a menudo. Termina con cómo borrar la placa y revocar cada credencial.

### Qué revisar en la respuesta de Claude

1. Cada secreto tiene su sitio: los ajustes del Wi-Fi, la URL OTA, los ajustes del WebSocket, el tema de ntfy y el token de GitHub en la NVS de la panza; las claves de Anthropic y de OpenAI solo en tu PC; nada en la cabeza y nada en el repositorio.
2. Dice con claridad que la NVS no está cifrada por defecto, así que cualquiera con la placa y un cable USB puede leer el tema y el token como texto plano.
3. Su lista de lo que sale de tu red nombra tu voz como audio a OpenAI, tus palabras a Anthropic, las respuestas de Narsil a Microsoft mediante EdgeTTS, la suscripción al tema a ntfy.sh, y el token con la búsqueda a GitHub. El audio entre la panza y el servidor se queda en la LAN sobre `ws://` sin cifrar, así que el bot va en el Wi-Fi de tu casa, no en uno compartido.
4. Da los dos esquemas de cifrado de la NVS para el ESP32-P4 con su coste: el esquema HMAC quema para siempre un bloque de claves de eFuse, y con el cifrado de la flash una imagen en texto plano flasheada por error deja la placa bloqueada, de forma recuperable.
5. Revoca cada credencial en su origen, empezando por el token: **Delete** en la página de tokens de GitHub, `/narsil movil nuevo` para el tema, el router para la contraseña del Wi-Fi, y cada clave de API en la página de su proveedor.

Si una comprobación falla, dile a Claude lo que ves: "el plan solo borra la flash, y nunca dice cómo revocar el token de GitHub".

### Cómo lo pidió el autor

La regla detrás de esta guía salió de la decisión sobre dónde vive el firmware. La IA preguntó si el código del bot debía ir en un repositorio propio, y quien creó Narsil respondió:

> repo propio como fork

Después la IA preguntó si ese repositorio sería público desde el principio o privado, y quien creó Narsil eligió la primera opción:

> 1

Un repositorio público lo cambia todo respecto a los secretos: todo lo que se confirma en él se publica. Así que la IA fijó la regla escrita como la especificación S6, que el token de GitHub, el tema de ntfy, la clave y la dirección del servidor viven en la NVS o en la configuración local, nunca en el repositorio, y cada guía desde entonces la ha seguido.

Dónde se procesa la voz se había decidido antes, con la misma consecuencia para las claves de API:

> servidor propio

Y dónde corre:

> en el pc, igual la idea es usarlo para trabajar con claude

Por eso las claves de pago se quedan en el PC. Qué reconocedor usar lo decidió la IA a partir de la documentación del servidor; eligió `OpenaiASR` porque el reconocedor sin conexión por defecto no admite el español, y esta guía es donde esa elección se explica como audio que sale de la red.

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

El bot no necesita código nuevo para esta guía. La única pieza opcional es el botón "Forget", añadido a la pantalla de ajustes de la guía 9 junto a "Back":

```cpp
static void OnForget(lv_event_t*) {
    {
        Settings settings("narsil", true);
        settings.EraseAll();
    }
    esp_restart();
}
```

```cpp
Button(settings_screen, "Forget topic and token", OnForget);
```

`EraseAll` es parte de la clase `Settings` de Xiaozhi; borra cada clave del espacio de nombres `narsil`, y el destructor confirma el cambio antes del reinicio.

Si eliges cifrar la NVS con el esquema HMAC, el cambio es de configuración, no de código. En `idf.py menuconfig`, activa `CONFIG_NVS_ENCRYPTION`, elige `CONFIG_NVS_SEC_KEY_PROTECT_USING_HMAC`, y pon en `CONFIG_NVS_SEC_HMAC_EFUSE_KEY_ID` un bloque de eFuse libre. Lee primero la página de cifrado de la NVS: el bloque de eFuse se usa para siempre, y la NVS escrita antes del cambio no se puede leer después, así que borra la flash y vuelve a configurar el bot.

## Errores comunes y cómo probarlo

- **Un secreto en un commit.** Antes de cada push al repositorio público, busca en el diff `github_pat_`, `narsil-`, `sk-ant-` y tu dirección de la LAN. Un token real en un archivo de prueba es una filtración; usa valores inventados como `github_pat_EXAMPLE_not_a_real_token`.
- **Secretos en el log.** Nunca imprimas el token, el tema ni la contraseña del Wi-Fi, ni siquiera mientras depuras: un log del monitor pegado en un issue los publica.
- **`sdkconfig` con tus ajustes.** Si pones la dirección del servidor en `CONFIG_OTA_URL` en lugar de en el portal, acaba en `sdkconfig`, y de ahí en un commit. La guía 3 la guarda en el dispositivo por esta razón.
- **Revocar una sola cosa.** Un bot perdido guarda el token, el tema y la contraseña del Wi-Fi. Revoca los tres.

Para probar lo que guarda la placa, vuelve a leer su NVS y mira. Con la panza en COM5, `esptool --port COM5 read-flash 0 ALL belly.bin` vuelca la flash; busca tu tema en el archivo. Con la NVS sin cifrar está ahí como texto plano; con el esquema HMAC no. Borra `belly.bin` después: contiene tus secretos.

Para probar lo que sale de la red, mira el log de tu servidor (guía 4) mientras hablas: el texto reconocido aparece después de cada frase, que es el momento en que el audio fue a OpenAI. Apaga el internet del PC y vuelve a hablar: la panza sigue conectándose al servidor en la LAN, pero el reconocimiento falla, lo que muestra que el audio no tenía ningún sitio local adonde ir.

## Para ir más lejos

- **Reconocimiento sin conexión.** `VoskASR` en el servidor mantiene tu voz en tu red; revisa su modelo en español y compara la precisión con `OpenaiASR`.
- **Tu propio servidor de ntfy.** Correr ntfy en casa con control de acceso saca el tema del internet público. narsil-pet publica en `https://ntfy.sh`, así que ambos lados cambiarían (guía 7).
- De vuelta al principio de la ruta: las piezas y el cableado están en la [guía 1](/es/bot/the-bot/).
