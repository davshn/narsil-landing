---
title: El bot y sus piezas
description: 'Las dos placas del bot de escritorio de Narsil, qué hace cada una, la lista de materiales, el enlace UART de tres cables entre panza y cabeza, y cómo fluyen los datos.'
route: bot
order: 1
updated: 2026-11-18
---

## Qué hace

El bot de escritorio de Narsil es Narsil con cuerpo. Se queda en el escritorio junto a tu ordenador y hace tres trabajos:

- **Habla.** Le hablas, y Narsil responde con voz. La respuesta viene de Claude, a través de un pequeño servidor que corre en tu propio PC.
- **Muestra lo que está haciendo Narsil.** Una pantalla táctil de 4,3 pulgadas en la panza muestra los avisos de Narsil y tus pull requests abiertas de GitHub.
- **Tiene cara.** La cabeza es una pequeña pantalla dentro de un cubo prisma de cristal que muestra solo la cara de Narsil, así que parece un holograma flotando sobre el cuerpo.

El bot son dos placas unidas por tres cables. La panza es el cerebro y hace todo lo que toca la red. La cabeza solo dibuja. Esta primera guía describe las piezas y cómo encajan; el resto del recorrido construye cada pieza.

## Cómo funciona por dentro

### La panza: Waveshare ESP32-P4-WIFI6-Touch-LCD-4.3

La panza es la [Waveshare ESP32-P4-WIFI6-Touch-LCD-4.3](https://docs.waveshare.com/ESP32-P4-WIFI6-Touch-LCD-4.3). Según la página de Waveshare, las piezas que importan para el bot son:

| Pieza          | Qué es                                                                                               |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| Chip principal | ESP32-P4 (ESP32-P4NRW32X en el módulo): RISC-V de doble núcleo más un núcleo de bajo consumo         |
| Memoria        | 32 MB de PSRAM apilada en el encapsulado del chip, 32 MB de flash NOR                                |
| Pantalla       | IPS de 4,3 pulgadas, 480 × 800, táctil capacitiva, en una interfaz MIPI DSI de 2 carriles            |
| Inalámbrico    | Un módulo ESP32-C6-MINI-1 integrado para Wi-Fi 6 y Bluetooth 5 (LE), conectado al P4 por SDIO        |
| Audio          | Códec de audio ES8311, ES7210 para cancelación de eco, una matriz de dos micrófonos                  |
| Altavoz        | Un conector GH1.25 de 2 pines; Waveshare recomienda un altavoz de 8 Ω y 2 W                          |
| USB            | Un puerto Type-C "USB to UART" para alimentación, flasheo y depuración; un puerto Type-C USB OTG 2.0 |
| Expansión      | Un conector de 40 pines de 2,54 mm con I2C, GPIO, 3V3, 5V y GND                                      |

El ESP32-P4 no tiene radio propia. Cada byte que va a la red pasa por el ESP32-C6 que tiene al lado, por SDIO. Para el firmware esto es invisible: el soporte de Xiaozhi para esta placa (guía 3) ya configura el C6 como coprocesador Wi-Fi (`CONFIG_SLAVE_IDF_TARGET_ESP32C6=y` en sus valores por defecto para ESP32-P4).

El controlador táctil de la placa es un GT911, que es lo que manejan tanto el código de placa de Xiaozhi como el paquete de soporte de placa de Waveshare (`waveshare/esp32_p4_wifi6_touch_lcd_4_3` en el registro de componentes de Espressif).

### La cabeza: ESP32-S3-LCD-1.3-C

La cabeza es la ESP32-S3-LCD-1.3-C, la versión de la ESP32-S3-LCD-1.3 de Waveshare que viene con una carcasa de plástico y un cubo prisma. SpotPear la vende como la [pantalla prisma transparente 3D](https://spotpear.com/wiki/ESP32-S3-1.3-inch-LCD-ST7789-240x240-3D-Display-Transparent-Screen-Refractive-Prism-Mini-TV.html), y Waveshare documenta la placa base en su [página de producto](https://www.waveshare.com/esp32-s3-lcd-1.3.htm):

| Pieza          | Qué es                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------- |
| Chip principal | ESP32-S3R8, Xtensa LX7 de doble núcleo hasta 240 MHz                                              |
| Memoria        | 512 KB de SRAM, 8 MB de PSRAM, 16 MB de flash                                                     |
| Pantalla       | IPS de 1,3 pulgadas, 240 × 240, 262K colores, controlador ST7789V2 por SPI                        |
| Movimiento     | IMU de seis ejes QMI8658 (acelerómetro y giroscopio), en la parte trasera                         |
| USB            | Type-C a través de un chip USB a serie CH343P                                                     |
| Alimentación   | Regulador de 3,3 V ME6217C33M5G (800 mA como máximo), cargador PL4054, conector de batería MX1.25 |
| Otros          | Ranura para tarjeta TF, un conector GPIO de 2,54 mm                                               |
| Prisma         | Un cubo de cristal que se apoya sobre la pantalla y refleja su imagen                             |

El prisma es la razón de que la cara parezca flotar: la pantalla está tumbada y la cara interior del cubo la refleja hacia ti. Un reflejo es una imagen especular, así que la cabeza dibuja su cara en espejo; la [guía 11](/es/bot/holographic-head/) lo trata.

El ESP32-S3 tiene su propio Wi-Fi, y la cabeza no lo usa. Es una decisión, explicada a continuación.

### Por qué la panza hace toda la parte de red

Los datos de Narsil viven en internet: los avisos llegan por ntfy, las pull requests vienen de la API REST de GitHub y la voz va a tu servidor. Los tres necesitan Wi-Fi, credenciales y lógica de reintentos. Si las dos placas se conectaran, las dos necesitarían la contraseña del Wi-Fi, el token de GitHub y el topic de ntfy, y las dos podrían discrepar sobre lo que está haciendo Narsil.

Así que la panza es dueña de cada conexión y de cada secreto, y decide el estado de Narsil. La cabeza recibe solo lo que tiene que dibujar: una pose y un estado, por un cable serie. No guarda ningún secreto, y si se reinicia simplemente espera el siguiente mensaje. La [guía 10](/es/bot/uart-protocol/) define ese protocolo.

### El enlace UART

Las dos placas hablan por UART, el enlace serie sencillo que tiene cualquier ESP32, con cables Dupont hembra-hembra entre sus conectores:

| Cable   | Panza (ESP32-P4) | Cabeza (ESP32-S3) |
| ------- | ---------------- | ----------------- |
| Datos → | GPIO4 (TX)       | GPIO13 (RX)       |
| Datos ← | GPIO5 (RX)       | GPIO14 (TX)       |
| Tierra  | GND              | GND               |

El TX de un lado va al RX del otro: cada placa habla por su pin TX y escucha por su pin RX, así que los cables se cruzan.

Por qué estos pines:

- **En la panza**, GPIO4 y GPIO5 están en el conector de 40 pines y no los usa nada de lo que Xiaozhi configura para esta placa. Su `config.h` toma de GPIO9 a GPIO13 para el audio I2S, GPIO7 y GPIO8 para I2C, GPIO53 para el amplificador del altavoz, GPIO26 y GPIO27 para la pantalla, y GPIO35 para el botón BOOT. El soporte de placa de Waveshare añade de GPIO39 a GPIO44 para la tarjeta TF. Los GPIO37 y GPIO38 del conector también se dejan libres: ESP-IDF los indica como TX y RX por defecto de UART0 en el ESP32-P4, el puerto del log de arranque.
- **En la cabeza**, GPIO13 y GPIO14 son pines del conector contiguos en el esquema de Waveshare (`ESP32S3_1.3inch.pdf`, enlazado desde la wiki de SpotPear). La pantalla, la IMU y la tarjeta TF usan otros pines, y GPIO43 y GPIO44 llevan U0TXD y U0RXD al CH343P, el propio puerto serie USB de la cabeza.

Revisa las etiquetas impresas en tus placas antes de conectar nada: la disposición de los conectores cambia entre revisiones.

**Alimentación: un cable USB por placa, tierra compartida, 3V3 sin compartir.** Cada placa recibe su propio cable USB-C. La panza toma la alimentación de su puerto "USB to UART", y la cabeza regula sus propios 3,3 V con su ME6217C33M5G. Unir los dos pines 3V3 ataría dos reguladores separados, cada uno intentando sostener la línea, y el pin 3V3 del conector de la panza nunca se pensó para alimentar una segunda placa. El cable que importa es el de tierra: una señal UART es una tensión medida respecto a tierra, así que las dos placas necesitan la misma tierra. Los dos chips usan lógica de 3,3 V, así que no hace falta adaptador de niveles.

### El flujo de datos

| Desde              | Hacia                       | Por                          | Qué                                                |
| ------------------ | --------------------------- | ---------------------------- | -------------------------------------------------- |
| Micrófonos         | Panza (ES7210, Xiaozhi)     | I2S                          | Tu voz                                             |
| Panza              | Tu servidor (en tu PC)      | WebSocket, LAN               | Audio Opus de subida; audio Opus y texto de vuelta |
| Tu servidor        | Claude                      | HTTPS, Anthropic SDK         | Lo que dijiste, como texto; la respuesta de Narsil |
| Panza              | Altavoz (ES8311)            | I2S                          | La voz de Narsil                                   |
| ntfy               | Panza                       | HTTPS                        | Los avisos de Narsil desde tu ordenador            |
| API REST de GitHub | Panza                       | HTTPS, token de solo lectura | Tus pull requests abiertas                         |
| Panza              | Pantalla de la panza (LVGL) | MIPI DSI                     | Avisos y pull requests                             |
| Panza              | Cabeza                      | UART, 3 cables               | Pose y estado                                      |
| Cabeza             | Prisma                      | Pantalla ST7789              | La cara de Narsil, en espejo                       |

La ruta de la voz es la única que necesita tu PC. Los avisos, las pull requests y la cara siguen funcionando cuando el servidor está apagado.

### La lista de materiales

- 1 × Waveshare ESP32-P4-WIFI6-Touch-LCD-4.3 (la panza).
- 1 × ESP32-S3-LCD-1.3-C, con su carcasa y su cubo prisma (la cabeza).
- Cables Dupont hembra-hembra (se usan tres).
- 1 × altavoz con conector GH1.25 de 2 pines, de 8 Ω y 2 W como recomienda Waveshare. Los micrófonos ya están en la panza.
- 2 × cables USB-C de datos, uno por placa.
- Un PC en la misma red, con Docker, para el servidor de voz (guía 4).

El firmware de las dos placas vive en un único repositorio público, `davshn/narsil-bot`: un fork de 78/xiaozhi-esp32 para la panza, con el firmware de la cabeza en su propia carpeta `head/`.

## Cómo se le pidió a la IA

El diseño empezó en un carrito de compra. El 2026-11-17 quien creó Narsil compartió una captura de un carrito de AliExpress con las dos placas y un paquete de cables Dupont, y describió la idea:

> va a ser la pantalla grande para una pantalla en la pansa que va a tener la informacion de las tareas que hace narsil y la cabeza va a ser una apntalla holografica que solo sea la cara de narsil

Eso fijó los papeles de las dos placas antes de cualquier código: el P4 con la pantalla grande es la panza, el S3 con el prisma es la cara.

La siguiente pregunta de la IA fue cómo recibiría la cabeza sus datos: conectándose a la red por su cuenta, o recibiéndolos de la panza. La respuesta fue:

> Por cable desde la panza

Esa respuesta es la regla de "Por qué la panza hace toda la parte de red", más arriba: una placa es dueña de la red y de los secretos, la otra solo dibuja. La IA hizo sus preguntas de una en una, con las páginas de Waveshare y SpotPear como fuentes, y registró cada respuesta en el documento de tareas del proyecto como una especificación numerada.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es la conversación con la que se diseñó el bot.

> Quiero construir un bot de escritorio con dos placas ESP32: una Waveshare ESP32-P4-WIFI6-Touch-LCD-4.3 como cuerpo y una ESP32-S3-LCD-1.3-C (ST7789 240×240 bajo un cubo prisma) como cabeza. El cuerpo debe hacer toda la parte de red y la cabeza solo debe dibujar una cara que recibe por UART. Lee las páginas y los esquemas oficiales de Waveshare y SpotPear, y después propón: el papel de cada placa, qué pines libres del conector usar para la UART en cada lado (evitando los pines que ya usan el soporte de placa o la consola de arranque), cómo alimentar las dos placas y una lista de materiales. Cita la página de la que sale cada pin, y hazme una pregunta cada vez cuando algo sea una elección real.

## El código mínimo

El cableado se convierte en código en un único sitio de cada placa: la configuración de la UART. Este es el lado de la panza, escrito para esta guía con el driver UART de ESP-IDF (`driver/uart.h`, las mismas llamadas que el ejemplo `uart_echo` de ESP-IDF). El lado de la cabeza es igual con sus propios pines.

```c
#include "driver/uart.h"

#define HEAD_UART      UART_NUM_1
#define HEAD_UART_TX   4
#define HEAD_UART_RX   5
#define HEAD_UART_BAUD 115200

void head_link_init(void)
{
    const uart_config_t config = {
        .baud_rate = HEAD_UART_BAUD,
        .data_bits = UART_DATA_8_BITS,
        .parity = UART_PARITY_DISABLE,
        .stop_bits = UART_STOP_BITS_1,
        .flow_ctrl = UART_HW_FLOWCTRL_DISABLE,
        .source_clk = UART_SCLK_DEFAULT,
    };
    ESP_ERROR_CHECK(uart_driver_install(HEAD_UART, 1024, 0, 0, NULL, 0));
    ESP_ERROR_CHECK(uart_param_config(HEAD_UART, &config));
    ESP_ERROR_CHECK(uart_set_pin(HEAD_UART, HEAD_UART_TX, HEAD_UART_RX,
                                 UART_PIN_NO_CHANGE, UART_PIN_NO_CHANGE));
}
```

Hay un detalle fácil de pasar por alto. En el ESP32-P4, los pines por defecto de ESP-IDF para UART1 son GPIO10 y GPIO11, y en esta placa esos llevan el audio (selección de palabra I2S y entrada de datos). `uart_set_pin` enruta UART1 a GPIO4 y GPIO5 a través de la matriz GPIO, así que los pines por defecto nunca se tocan. Enviar es después una sola llamada, `uart_write_bytes(HEAD_UART, data, len)`; lo que va en `data` es la [guía 10](/es/bot/uart-protocol/).

## Errores comunes y cómo probarlo

- **TX con TX.** Si no llega nada, intercambia los dos cables de datos. Cada TX va al RX de la otra placa.
- **Sin cable de tierra.** Sin una tierra común la señal no tiene referencia, y la cabeza lee basura o nada.
- **Unir los pines 3V3.** Cada placa se alimenta con su propio cable USB; deja 3V3 sin conectar.
- **Usar los pines de la consola.** GPIO37 y GPIO38 en la panza, y GPIO43 y GPIO44 en la cabeza, son UART0, cableados al puerto serie USB de cada placa. Los mensajes por ahí se mezclan con el log de arranque.
- **Cables hembra en un conector sin pines.** Los cables Dupont hembra-hembra necesitan pines macho en las dos placas. Comprueba que los conectores de tus placas tienen pines antes de planificar el cableado.
- **Un cable USB solo de carga.** Si Windows no muestra un puerto COM nuevo al conectar una placa, prueba con otro cable (guía 2).

Para probar el enlace antes de que exista ningún protocolo, flashea las dos placas con el ejemplo `uart_echo` de ESP-IDF configurado con estos pines, o envía una línea desde la panza y registra lo que lee la cabeza con `uart_read_bytes`. Si el texto llega intacto a 115200 baudios, el cableado está bien.

## Para ir más lejos

- La pantalla táctil de la panza puede hacer algo más que mostrar: un toque puede marcar un aviso como leído, lo que la [guía 9](/es/bot/belly-ui/) construye con LVGL.
- La QMI8658 de la cabeza puede detectar cuándo alguien levanta el bot o le da un golpecito. La cabeza podría enviarlo de vuelta por su cable TX, y por eso el enlace tiene dos cables de datos y no uno.
- Las dos placas tienen conectores de batería (MX1.25 en la cabeza, un conector de litio de 3,7 V en la panza). El bot de este recorrido funciona por USB, lo que mantiene sencillo el diseño de la alimentación.
- La [página de ESP-IDF de Waveshare para la panza](https://docs.waveshare.com/ESP32-P4-WIFI6-Touch-LCD-4.3/ESP-IDF/) lista proyectos de ejemplo (herramientas I2C, estación Wi-Fi, códec I2S, LVGL) útiles para comprobar cada parte de la placa por separado.
