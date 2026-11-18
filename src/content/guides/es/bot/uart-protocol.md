---
title: El protocolo UART entre la panza y la cabeza
description: 'Un pequeño protocolo de líneas con versión y checksum: la panza envía la pose y el estado de voz de Narsil, la cabeza solo saluda, y ambas sobreviven a un reinicio o a un cable suelto.'
route: bot
order: 10
updated: 2026-11-18
---

## Qué hace

La panza sabe lo que está haciendo Narsil; la cabeza solo la dibuja. Entre ellas van los tres cables de la guía 1, y esta guía decide qué viaja por ellos: líneas cortas de texto como

```text
$N1,P,trabajando,3*3A
```

que significa "versión 1 del protocolo: muestra la pose `trabajando` en la etapa 3". La panza envía una línea cuando cambia la pose de Narsil, cuando Xiaozhi empieza o deja de escuchar o de hablar, y de todos modos cada cinco segundos. La cabeza comprueba cada línea, dibuja lo que dice, y envía una línea de vuelta solo cuando arranca, para pedir el estado actual.

Ese es todo el protocolo: dos mensajes hacia abajo, uno hacia arriba. Es suficiente porque la cabeza no guarda ningún estado que valga la pena conservar ni ningún secreto, como decidió la guía 1.

## Cómo funciona por dentro

### Por qué líneas de texto

Una UART transporta bytes, sin ninguna idea de dónde empieza o termina un mensaje. El protocolo tiene que añadir eso, y hay dos formas comunes: tramas binarias con un byte de inicio y una longitud, o líneas de texto que terminan en `\n`. El bot usa líneas de texto:

- **Se pueden leer.** El monitor serie o un adaptador USB-serie muestra los mensajes tal como son, y puedes escribir uno a mano para probar la cabeza.
- **Un byte perdido cuesta una línea.** Después de cualquier basura, el siguiente `$` empieza un mensaje nuevo, y el siguiente `\n` lo termina. No hay nada que resincronizar.
- **Los mensajes son diminutos.** Una pose y una etapa caben en unos 20 bytes. A 115200 baudios una línea tarda menos de 2 milisegundos.

### La forma de una línea

```text
$N1,<type>,<fields>*<checksum>\n
```

| Parte        | Significado                                                                    |
| ------------ | ------------------------------------------------------------------------------ |
| `$`          | Inicio de un mensaje. Todo lo que va antes se ignora.                          |
| `N1`         | Protocolo de Narsil, versión 1. Una cabeza que no conoce la versión lo ignora. |
| `<type>`     | Una letra: `P` (pose), `V` (voz), `H` (saludo).                                |
| `<fields>`   | Valores separados por comas, según el tipo.                                    |
| `*`          | Fin del cuerpo.                                                                |
| `<checksum>` | Dos dígitos hexadecimales en mayúscula: el XOR de cada byte entre `$` y `*`.   |
| `\n`         | Fin de la línea. Una línea de más de 64 bytes se descarta.                     |

Es la misma forma que usan los receptores GPS para sus sentencias NMEA, por las mismas razones: legible, corta y autoverificable. El checksum XOR es un byte, calculado haciendo XOR de los caracteres uno tras otro. No detecta todos los errores, pero detecta los habituales en un cable corto, como un bit invertido o un byte perdido en mitad de una línea, y no cuesta nada calcularlo.

El campo de versión es lo que permite que el protocolo cambie más adelante. Si la versión 2 añade un campo, una cabeza con firmware antiguo ignora las líneas `N2` en lugar de dibujar algo incorrecto, y la panza puede enviar las dos mientras las placas se actualizan una a una.

### Los mensajes

| Línea                   | Dirección      | Significado                                                                                       |
| ----------------------- | -------------- | ------------------------------------------------------------------------------------------------- |
| `$N1,P,<pose>,<stage>*` | panza → cabeza | La pose de Narsil: `parada`, `trabajando`, `necesita`, `terminado` o `error`; su etapa, de 1 a 5. |
| `$N1,V,<voice>*`        | panza → cabeza | El estado de voz de Xiaozhi: `idle`, `listening` o `speaking`.                                    |
| `$N1,H*1B`              | cabeza → panza | Saludo: la cabeza acaba de arrancar y no tiene nada que dibujar.                                  |

Algunas líneas reales, con sus checksums:

```text
$N1,P,parada,1*35
$N1,P,necesita,2*33
$N1,V,listening*40
$N1,V,idle*2D
$N1,H*1B
```

Los nombres de las poses son los propios de narsil-pet, en español para que coincidan uno a uno con sus archivos de dibujo. Vienen de la tabla `POSE` de su `hooks/sprite.ts`, una pose por estado: `working` es `trabajando`, `idle` es `parada`, `waiting` es `necesita`, `done` es `terminado` y `error` es `error`.

### De dónde sale la pose

La panza no se inventa la pose de Narsil: se la dice el PC, en el mensaje `-estado` de la guía 7. Ese JSON no tiene un campo "pose" propio; tiene `art`, la URL de su dibujo, construida por `artUrl` en el `hooks/phone.ts` de narsil-pet:

```ts
export function artUrl(pose: string, stage: number): string {
  return `${ART_URL}/${stage > 1 ? `etapa${stage}/` : ''}${pose}-oscuro.png`
}
```

(Citado de [davshn/narsil-pet](https://github.com/davshn/narsil-pet), GPL-3.0-or-later.) `sendStatus` en `hooks/register.tsx` lo llama con la pose de la conversación más importante y la etapa de Narsil, de 1 (la recién nacida) a 5 (`STAGE_FROM` en `hooks/xp.ts`). Así que la URL lleva los dos valores:

| `art` termina en                       | Pose         | Etapa |
| -------------------------------------- | ------------ | ----- |
| `/assets/parada-oscuro.png`            | `parada`     | 1     |
| `/assets/etapa3/trabajando-oscuro.png` | `trabajando` | 3     |
| `/assets/etapa5/error-oscuro.png`      | `error`      | 5     |

`HeadSetPoseFromArt`, la función a la que llama el `ShowStatus` de la guía 9, toma como pose el nombre de archivo entre la última `/` y `-oscuro.png`, y como etapa el número después de `/etapa` (1 cuando no hay). Comprueba la pose contra los cinco nombres antes de guardarla, así que un formato de URL cambiado nunca puede enviarle a la cabeza algo que no sabe dibujar.

La cabeza dibuja el mismo arte que muestran la banda de Narsil y los avisos del teléfono, por eso los nombres se quedan tal como los escribe narsil-pet.

### El estado de voz

La panza también sabe algo que el PC no sabe: si Xiaozhi está escuchando o hablando en este momento. `Application::GetInstance().GetDeviceState()` en Xiaozhi devuelve el estado actual de su máquina de estados (`main/device_state.h`): `kDeviceStateListening` y `kDeviceStateSpeaking` pasan a ser `listening` y `speaking`, y cualquier otro estado es `idle`. La tarea del enlace de la panza lo comprueba diez veces por segundo y envía una línea `V` cuando cambia, así que la cabeza puede mostrar que Narsil está escuchando mientras le hablas.

### Reconexiones, reinicios y cables sueltos

El enlace no tiene ninguna conexión que establecer ni nada que confirmar. Tres reglas mantienen a los dos lados sincronizados:

1. **La panza se repite.** Cada cinco segundos envía las líneas `P` y `V` actuales, hayan cambiado o no. Una cabeza que se perdió una línea, o cuyo cable se desconectó y se volvió a conectar, vuelve a estar bien en menos de cinco segundos.
2. **La cabeza saluda.** Cuando la cabeza arranca, envía `$N1,H*1B` una vez. La panza responde enseguida con `P` y `V`, así que una cabeza reiniciada no espera a la siguiente repetición.
3. **La cabeza nota el silencio.** Si no llega ninguna línea válida durante 15 segundos, la panza está apagada o el cable está suelto. La cabeza mantiene la última pose en pantalla y atenúa su retroiluminación (guía 11), en lugar de quedarse congelada con el brillo al máximo.

Cuando la panza arranca, empieza con `parada` en la etapa 1 y lo envía enseguida; el primer mensaje `-estado` de ntfy (el stream pide `since=10m`, guía 7) lo corrige.

### Por qué la cabeza no envía nada más

La cabeza tiene una IMU de seis ejes y podría informar de toques o de que la levantan, y el cable TX está ahí para eso. El bot lo limita al saludo por una razón: todo lo que envía la cabeza es algo que la panza debe validar, a lo que debe reaccionar y que debe mantener compatible entre versiones. Con un solo mensaje hacia arriba, la cabeza no puede pedirle nada a la panza, no puede provocar una petición de red y no puede llegar a un secreto. La regla de la guía 1, "la panza es dueña de cada conexión y de cada secreto", es más fácil de mantener cuando la otra dirección está casi vacía.

### La UART en cada placa

Los dos lados usan el [driver de UART](https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/api-reference/peripherals/uart.html) de ESP-IDF con los ajustes de la guía 1: `UART_NUM_1`, 115200 baudios, 8 bits de datos, sin paridad, 1 bit de parada, sin control de flujo, con tierra compartida.

| Placa             | TX     | RX     |
| ----------------- | ------ | ------ |
| Panza (ESP32-P4)  | GPIO4  | GPIO5  |
| Cabeza (ESP32-S3) | GPIO14 | GPIO13 |

Las llamadas son las del ejemplo `uart_echo` de ESP-IDF: `uart_driver_install` con un búfer de recepción, `uart_param_config`, `uart_set_pin`, y después `uart_write_bytes` para enviar y `uart_read_bytes` con un tiempo de espera para recibir. En la cabeza, `uart_read_bytes` con un tiempo de espera de 200 ms es también el reloj de su bucle principal: vuelve antes cuando llegan bytes y, si no, deja que la cabeza compruebe el silencio.

## Constrúyelo con Claude

Pídele a Claude un pequeño protocolo de texto entre la panza y la cabeza, y los dos lados en ESP-IDF. La idea que debe acertar es la línea: `$`, la versión `N1`, un tipo, los campos, `*` y una suma de comprobación XOR de dos dígitos de los bytes entre `$` y `*`.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es la conversación con la que se construyó el bot.

> Dos placas ESP32 comparten una UART (UART_NUM_1, 115200 baudios, tierra compartida). El cuerpo le envía a la cabeza solo una pose y un estado de voz; la cabeza los dibuja y debe sobrevivir a reinicios y a cables desconectados. Diseña un protocolo de texto basado en líneas con un campo de versión y un checksum XOR de un byte, lista cada mensaje con un ejemplo y su checksum, y escribe los dos lados en ESP-IDF 6 con `uart_driver_install`, `uart_param_config`, `uart_set_pin`, `uart_write_bytes` y `uart_read_bytes`. El cuerpo repite su estado cada 5 s; la cabeza envía un saludo al arrancar y nada más. Explica cómo pruebo cada lado desde un PC con un adaptador USB-serie.

### Qué revisar en la respuesta de Claude

1. La suma de comprobación cubre solo los bytes entre `$` y `*`, escrita en hexadecimal en mayúsculas. El código de Claude obtiene `1B` para `$N1,H*1B`.
2. Hay tres mensajes: `P` con una pose y una etapa, `V` con `idle`, `listening` o `speaking`, y el saludo `H` de la cabeza. La cabeza no envía nada más, así que nunca puede pedirle nada a la panza ni llegar a un secreto.
3. La panza envía sus líneas `P` y `V` cuando cambian, cada cinco segundos de todos modos, y enseguida después de un saludo. La cabeza baja su retroiluminación después de 15 segundos sin una línea válida, y descarta las líneas de más de 64 bytes.
4. La pose sale de la URL de `art`: el nombre de archivo antes de `-oscuro.png` y el número después de `/etapa` (1 cuando no hay), comprobados contra los cinco nombres de pose y las etapas 1 a 5.
5. Los dos lados usan `UART_NUM_1` a 115200 baudios, 8 bits de datos, sin paridad, 1 bit de parada y sin control de flujo: GPIO4 y GPIO5 en la panza, GPIO14 y GPIO13 en la cabeza, con una tierra compartida.

Si una comprobación falla, dile a Claude lo que ves: "escribo `$N1,P,necesita,2*33` en el terminal de la cabeza y no cambia nada".

### Cómo lo pidió el autor

El enlace en sí salió de una de las primeras respuestas de quien creó Narsil. Ante la pregunta de si la cabeza se conectaría a la red por su cuenta o recibiría sus datos de la panza, la respuesta fue:

> Por cable desde la panza

Y el trabajo de la cabeza se había fijado desde el principio:

> la cabeza va a ser una apntalla holografica que solo sea la cara de narsil

Juntas, esas dos respuestas son el alcance del protocolo: un cable, y solo lo que necesita la cara. El formato no lo decidió quien creó Narsil. La IA comparó tramas binarias con líneas de texto, y eligió líneas de texto con versión y checksum porque se pueden leer y escribir a mano mientras se prueba. Obtener la pose de la URL de `art`, en lugar de añadir un campo nuevo en el PC, salió de leer `artUrl` y `sendStatus` de narsil-pet: la información ya estaba ahí, así que no hubo que cambiar nada en el lado del PC.

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

El lado de la panza, en C++ junto al código de Xiaozhi (MIT, como los ejemplos propios del sitio). `head_link_init` de la guía 1 configura el puerto; esto añade los mensajes y la tarea del enlace:

```cpp
#include <driver/uart.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <mutex>
#include <string>

#include "application.h"

#define HEAD_UART UART_NUM_1

static const char* const kPoses[] = {"parada", "trabajando", "necesita", "terminado", "error"};
static std::mutex state_lock;
static std::string pose = "parada";
static int stage = 1;
static bool resend = true;

static void SendLine(const char* body) {
    uint8_t sum = 0;
    for (const char* c = body; *c; c++) sum ^= (uint8_t)*c;
    char line[72];
    int len = snprintf(line, sizeof(line), "$%s*%02X\n", body, sum);
    uart_write_bytes(HEAD_UART, line, len);
}

void HeadSetPoseFromArt(const char* art) {
    const char* file = strrchr(art, '/');
    const char* end = file ? strstr(file, "-oscuro.png") : nullptr;
    if (end == nullptr) return;
    std::string name(file + 1, end);
    const char* etapa = strstr(art, "/etapa");
    int new_stage = etapa ? atoi(etapa + 6) : 1;
    if (new_stage < 1 || new_stage > 5) return;
    for (const char* known : kPoses) {
        if (name == known) {
            std::lock_guard<std::mutex> guard(state_lock);
            pose = name;
            stage = new_stage;
            resend = true;
            return;
        }
    }
}

static const char* Voice() {
    switch (Application::GetInstance().GetDeviceState()) {
        case kDeviceStateListening: return "listening";
        case kDeviceStateSpeaking: return "speaking";
        default: return "idle";
    }
}

static void HeadLinkTask(void*) {
    const char* last_voice = "";
    TickType_t last_sent = 0;
    std::string rx;
    while (true) {
        uint8_t byte;
        while (uart_read_bytes(HEAD_UART, &byte, 1, 0) == 1) {
            if (byte != '\n') { if (rx.size() < 64) rx += (char)byte; continue; }
            if (rx == "$N1,H*1B") resend = true;
            rx.clear();
        }
        const char* voice = Voice();
        bool due = xTaskGetTickCount() - last_sent > pdMS_TO_TICKS(5000);
        if (resend || due || voice != last_voice) {
            char body[48];
            {
                std::lock_guard<std::mutex> guard(state_lock);
                snprintf(body, sizeof(body), "N1,P,%s,%d", pose.c_str(), stage);
                resend = false;
            }
            SendLine(body);
            snprintf(body, sizeof(body), "N1,V,%s", voice);
            SendLine(body);
            last_voice = voice;
            last_sent = xTaskGetTickCount();
        }
        vTaskDelay(pdMS_TO_TICKS(100));
    }
}

void StartHeadLink() {
    xTaskCreate(HeadLinkTask, "head_link", 4096, nullptr, 2, nullptr);
}
```

Llama a `head_link_init()` y después a `StartHeadLink()` una vez al arrancar; el enlace no necesita Wi-Fi.

El lado de la cabeza, en C (MIT). Lee una línea a la vez y rellena una pequeña estructura de estado que dibuja la guía 11:

```c
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "driver/uart.h"
#include "freertos/FreeRTOS.h"

#define BELLY_UART    UART_NUM_1
#define BELLY_UART_TX 14
#define BELLY_UART_RX 13

typedef struct {
    char pose[16];
    int stage;
    char voice[12];
} head_state_t;

void head_link_init(void)
{
    const uart_config_t config = {
        .baud_rate = 115200,
        .data_bits = UART_DATA_8_BITS,
        .parity = UART_PARITY_DISABLE,
        .stop_bits = UART_STOP_BITS_1,
        .flow_ctrl = UART_HW_FLOWCTRL_DISABLE,
        .source_clk = UART_SCLK_DEFAULT,
    };
    ESP_ERROR_CHECK(uart_driver_install(BELLY_UART, 1024, 0, 0, NULL, 0));
    ESP_ERROR_CHECK(uart_param_config(BELLY_UART, &config));
    ESP_ERROR_CHECK(uart_set_pin(BELLY_UART, BELLY_UART_TX, BELLY_UART_RX,
                                 UART_PIN_NO_CHANGE, UART_PIN_NO_CHANGE));
    uart_write_bytes(BELLY_UART, "$N1,H*1B\n", 9);
}

static bool frame_ok(char *line)
{
    char *star = strrchr(line, '*');
    if (line[0] != '$' || star == NULL || strlen(star) != 3) return false;
    unsigned sum = 0;
    for (char *c = line + 1; c < star; c++) sum ^= (unsigned char)*c;
    unsigned got = strtoul(star + 1, NULL, 16);
    *star = '\0';
    return got == sum;
}

static bool apply(char *body, head_state_t *state)
{
    char *save;
    char *version = strtok_r(body, ",", &save);
    char *type = strtok_r(NULL, ",", &save);
    if (version == NULL || type == NULL || strcmp(version, "N1") != 0) return false;
    if (strcmp(type, "P") == 0) {
        char *pose = strtok_r(NULL, ",", &save);
        char *stage = strtok_r(NULL, ",", &save);
        if (pose == NULL || stage == NULL || strlen(pose) >= sizeof(state->pose)) return false;
        int n = atoi(stage);
        if (n < 1 || n > 5) return false;
        strcpy(state->pose, pose);
        state->stage = n;
        return true;
    }
    if (strcmp(type, "V") == 0) {
        char *voice = strtok_r(NULL, ",", &save);
        if (voice == NULL || strlen(voice) >= sizeof(state->voice)) return false;
        strcpy(state->voice, voice);
        return true;
    }
    return false;
}

bool head_link_poll(head_state_t *state, int timeout_ms)
{
    static char line[65];
    static size_t len = 0;
    uint8_t byte;
    while (uart_read_bytes(BELLY_UART, &byte, 1, pdMS_TO_TICKS(timeout_ms)) == 1) {
        if (byte == '$') len = 0;
        if (byte != '\n') {
            if (len < sizeof(line) - 1) line[len++] = (char)byte;
            continue;
        }
        line[len] = '\0';
        len = 0;
        return frame_ok(line) && apply(line + 1, state);
    }
    return false;
}
```

`head_link_poll` devuelve `true` por cada línea válida, después de actualizar `state`, y `false` pasados `timeout_ms` sin nada válido. Un `$` en mitad de la basura reinicia la línea, así que la cabeza recoge por su cuenta el siguiente mensaje bueno.

## Errores comunes y cómo probarlo

- **Un checksum calculado incluyendo el `$`.** El XOR cubre solo los bytes entre `$` y `*`. `$N1,H*1B` es la referencia: si tu código obtiene otro valor para él, incluye de más.
- **Hexadecimal en minúscula.** `%02X` escribe `1B`; el `strtoul` de la cabeza acepta las dos formas, pero una herramienta que compare cadenas puede que no.
- **`\r\n` desde una terminal.** Muchas terminales envían un retorno de carro antes del salto de línea. Entonces falla el `strlen(star) != 3` de la cabeza; configura la terminal para que envíe solo `LF`.
- **La consola de la panza en el enlace.** Si aparecen mensajes de arranque en el lado de la cabeza, el enlace está en UART0. Debe ser `UART_NUM_1` en GPIO4 y GPIO5 (guía 1).
- **Una pose para la que la cabeza no tiene dibujo.** La panza solo acepta los cinco nombres de pose de narsil-pet y las etapas de 1 a 5, y la cabeza los vuelve a comprobar.
- **Las dos placas en silencio tras reiniciar la panza.** La panza envía enseguida al arrancar, y después cada cinco segundos; si la cabeza sigue atenuada, intercambia los cables de datos (TX va a RX).

Para probar cada lado sin el otro, usa un adaptador USB-serie de 3,3 V y una terminal en el PC. pyserial viene con esptool, así que `miniterm` ya está ahí:

```powershell
python -m serial.tools.miniterm --eol LF COM7 115200
```

- **La panza sola.** Conecta el RX del adaptador al GPIO4 de la panza y su GND al GND de la panza. Cada cinco segundos aparecen una línea `P` y una `V`. Di "Hi ESP" y aparece enseguida una línea `$N1,V,listening*40`. Ejecuta `/narsil movil prueba`, o termina un turno en Claude Code, y la línea `P` cambia con la pose de Narsil.
- **La cabeza sola.** Conecta el TX del adaptador al GPIO13 de la cabeza y GND a GND, y su RX al GPIO14. Reinicia la cabeza: llega `$N1,H*1B`. Escribe `$N1,P,necesita,2*33` y pulsa Enter: la cabeza dibuja a Narsil esperando en la etapa 2. Escribe la misma línea con un checksum incorrecto, `*34`: no cambia nada.

Usa solo adaptadores de 3,3 V. Un adaptador de 5 V puede dañar los pines del ESP32.

## Para ir más lejos

- **El brillo desde la panza.** Un tipo de mensaje como `B,<percent>` permitiría que la panza atenúe la cabeza de noche. Añádelo como un tipo nuevo en la versión 1: las cabezas antiguas ignoran los tipos que no conocen, porque `apply` devuelve `false` para ellos.
- **Toques desde la cabeza.** El QMI8658 puede detectar un toque. Una línea `T` de la cabeza a la panza podría marcar como leído el aviso más nuevo en la pantalla de la panza de la [guía 9](/es/bot/belly-ui/). Limítalo a eventos, nunca a peticiones.
- **Un CRC.** Para cables más largos o más datos, un CRC-16 reemplaza el byte XOR por cuatro dígitos hexadecimales, bajo una versión nueva, `N2`.
- El dibujo de la cabeza, la imagen en espejo y el fondo negro son la [guía 11](/es/bot/holographic-head/).
