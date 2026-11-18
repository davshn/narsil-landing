---
title: O bot e as suas peças
description: 'As duas placas do bot de mesa da Narsil, o que cada uma faz, a lista de materiais, o link UART de três fios entre barriga e cabeça e como os dados circulam por ele.'
route: bot
order: 1
updated: 2026-11-18
---

## O que faz

O bot de mesa da Narsil é a Narsil com um corpo. Ele fica na mesa, ao lado do seu computador, e faz três trabalhos:

- **Ele fala.** Você fala com ele, e a Narsil responde com uma voz. A resposta vem do Claude, por meio de um pequeno servidor que roda no seu próprio PC.
- **Ele mostra o que a Narsil está fazendo.** Uma tela sensível ao toque de 4,3 polegadas na barriga mostra os alertas da Narsil e os seus pull requests abertos no GitHub.
- **Ele tem um rosto.** A cabeça é uma pequena tela dentro de um cubo prisma de vidro que mostra só o rosto da Narsil, de modo que parece um holograma flutuando acima do corpo.

O bot são duas placas unidas por três fios. A barriga é o cérebro e faz tudo o que toca a rede. A cabeça só desenha. Este primeiro guia descreve as peças e como elas se encaixam; o resto do caminho constrói cada peça.

## Como funciona por dentro

### A barriga: Waveshare ESP32-P4-WIFI6-Touch-LCD-4.3

A barriga é a [Waveshare ESP32-P4-WIFI6-Touch-LCD-4.3](https://docs.waveshare.com/ESP32-P4-WIFI6-Touch-LCD-4.3). Segundo a página da Waveshare, as partes que importam para o bot são:

| Parte          | O que é                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------- |
| Chip principal | ESP32-P4 (ESP32-P4NRW32X no módulo): RISC-V de dois núcleos mais um núcleo de baixo consumo         |
| Memória        | 32 MB de PSRAM empilhada no encapsulamento do chip, 32 MB de flash NOR                              |
| Tela           | IPS de 4,3 polegadas, 480 × 800, toque capacitivo, numa interface MIPI DSI de 2 vias                |
| Sem fio        | Um módulo ESP32-C6-MINI-1 na placa para Wi-Fi 6 e Bluetooth 5 (LE), ligado ao P4 por SDIO           |
| Áudio          | Codec de áudio ES8311, ES7210 para cancelamento de eco, um conjunto de dois microfones              |
| Alto-falante   | Um conector GH1.25 de 2 pinos; a Waveshare recomenda um alto-falante de 8 Ω 2 W                     |
| USB            | Uma porta Type-C "USB to UART" para alimentação, gravação e depuração; uma porta Type-C USB OTG 2.0 |
| Expansão       | Um conector de 40 pinos de 2,54 mm com I2C, GPIOs, 3V3, 5V e GND                                    |

O ESP32-P4 não tem rádio próprio. Cada byte que vai para a rede passa pelo ESP32-C6 ao lado dele, por SDIO. Para o firmware isso é invisível: o suporte de placa do Xiaozhi para esta placa (guia 3) já configura o C6 como coprocessador de Wi-Fi (`CONFIG_SLAVE_IDF_TARGET_ESP32C6=y` nos seus padrões para o ESP32-P4).

O controlador de toque da placa é um GT911, que é o que tanto o código de placa do Xiaozhi quanto o pacote de suporte de placa da Waveshare (`waveshare/esp32_p4_wifi6_touch_lcd_4_3` no registro de componentes da Espressif) controlam.

### A cabeça: ESP32-S3-LCD-1.3-C

A cabeça é a ESP32-S3-LCD-1.3-C, a versão da ESP32-S3-LCD-1.3 da Waveshare que vem com uma caixa de plástico e um cubo prisma. A SpotPear a vende como o [3D transparent prism display](https://spotpear.com/wiki/ESP32-S3-1.3-inch-LCD-ST7789-240x240-3D-Display-Transparent-Screen-Refractive-Prism-Mini-TV.html) (tela de prisma transparente 3D), e a Waveshare documenta a placa base na sua [página de produto](https://www.waveshare.com/esp32-s3-lcd-1.3.htm):

| Parte          | O que é                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------- |
| Chip principal | ESP32-S3R8, Xtensa LX7 de dois núcleos até 240 MHz                                                |
| Memória        | 512 KB de SRAM, 8 MB de PSRAM, 16 MB de flash                                                     |
| Tela           | IPS de 1,3 polegada, 240 × 240, 262K cores, driver ST7789V2 em SPI                                |
| Movimento      | IMU de seis eixos QMI8658 (acelerômetro e giroscópio), na parte de trás                           |
| USB            | Type-C por meio de um chip USB-serial CH343P                                                      |
| Alimentação    | Regulador de 3,3 V ME6217C33M5G (máximo de 800 mA), carregador PL4054, conector de bateria MX1.25 |
| Outros         | Slot para cartão TF, um conector GPIO de 2,54 mm                                                  |
| Prisma         | Um cubo de vidro que fica sobre a tela e reflete a sua imagem                                     |

O prisma é o motivo de o rosto parecer flutuar: a tela fica deitada e a face interna do cubo a reflete na sua direção. Um reflexo é uma imagem espelhada, então a cabeça desenha o rosto espelhado; o [guia 11](/pt/bot/holographic-head/) trata disso.

O ESP32-S3 tem Wi-Fi próprio, e a cabeça não o usa. Isso é uma decisão, explicada a seguir.

### Por que a barriga faz toda a parte de rede

Os dados da Narsil vivem na internet: os alertas chegam pelo ntfy, os pull requests vêm da API REST do GitHub e a voz vai para o seu servidor. Os três precisam de Wi-Fi, credenciais e lógica de novas tentativas. Se as duas placas se conectassem, as duas precisariam da senha do Wi-Fi, do token do GitHub e do tópico do ntfy, e as duas poderiam discordar sobre o que a Narsil está fazendo.

Por isso a barriga é dona de cada conexão e de cada segredo, e decide o estado da Narsil. A cabeça recebe só o que desenhar: uma pose e um estado, por um cabo serial. Ela não guarda nenhum segredo e, se reiniciar, simplesmente espera a próxima mensagem. O [guia 10](/pt/bot/uart-protocol/) define esse protocolo.

### O link UART

As duas placas conversam por UART, o link serial simples que todo ESP32 tem, usando fios Dupont fêmea-fêmea entre os seus conectores:

| Fio     | Barriga (ESP32-P4) | Cabeça (ESP32-S3) |
| ------- | ------------------ | ----------------- |
| Dados → | GPIO4 (TX)         | GPIO13 (RX)       |
| Dados ← | GPIO5 (RX)         | GPIO14 (TX)       |
| Terra   | GND                | GND               |

O TX de um lado vai para o RX do outro: cada placa fala no seu pino TX e escuta no seu pino RX, então os fios se cruzam.

Por que estes pinos:

- **Na barriga**, GPIO4 e GPIO5 estão no conector de 40 pinos e não são usados por nada que o Xiaozhi configure para esta placa. O seu `config.h` usa de GPIO9 a GPIO13 para o áudio I2S, GPIO7 e GPIO8 para I2C, GPIO53 para o amplificador do alto-falante, GPIO26 e GPIO27 para a tela e GPIO35 para o botão BOOT. O suporte de placa da Waveshare acrescenta de GPIO39 a GPIO44 para o cartão TF. Os pinos GPIO37 e GPIO38 do conector também ficam de fora: o ESP-IDF os lista como TX e RX padrão da UART0 no ESP32-P4, a porta do log de inicialização.
- **Na cabeça**, GPIO13 e GPIO14 são pinos do conector vizinhos no esquema da Waveshare (`ESP32S3_1.3inch.pdf`, com link na wiki da SpotPear). A tela, a IMU e o cartão TF usam outros pinos, e GPIO43 e GPIO44 levam U0TXD e U0RXD ao CH343P, a porta serial USB da própria cabeça.

Confira as etiquetas impressas nas suas placas antes de ligar qualquer coisa: a disposição dos conectores muda entre revisões.

**Alimentação: um cabo USB por placa, terra compartilhado, 3V3 não compartilhado.** Cada placa recebe o seu próprio cabo USB-C. A barriga se alimenta pela sua porta "USB to UART", e a cabeça regula os seus próprios 3,3 V com o seu ME6217C33M5G. Unir os dois pinos 3V3 amarraria dois reguladores separados, cada um tentando manter a linha, e o pino 3V3 do conector da barriga nunca foi pensado para alimentar uma segunda placa. O fio de terra é o que importa: um sinal UART é uma tensão medida em relação ao terra, então as duas placas precisam do mesmo terra. Os dois chips usam lógica de 3,3 V, então não é preciso conversor de nível.

### O fluxo de dados

| De                 | Para                       | Por                        | O quê                                                       |
| ------------------ | -------------------------- | -------------------------- | ----------------------------------------------------------- |
| Microfones         | Barriga (ES7210, Xiaozhi)  | I2S                        | A sua voz                                                   |
| Barriga            | O seu servidor (no seu PC) | WebSocket, LAN             | Áudio Opus de ida; áudio Opus e texto de volta              |
| O seu servidor     | Claude                     | HTTPS, Anthropic SDK       | O que você disse, como texto; a resposta da Narsil de volta |
| Barriga            | Alto-falante (ES8311)      | I2S                        | A voz da Narsil                                             |
| ntfy               | Barriga                    | HTTPS                      | Os alertas da Narsil vindos do seu computador               |
| API REST do GitHub | Barriga                    | HTTPS, token só de leitura | Os seus pull requests abertos                               |
| Barriga            | Tela da barriga (LVGL)     | MIPI DSI                   | Alertas e pull requests                                     |
| Barriga            | Cabeça                     | UART, 3 fios               | Pose e estado                                               |
| Cabeça             | Prisma                     | Tela ST7789                | O rosto da Narsil, espelhado                                |

O caminho da voz é o único que precisa do seu PC. Os alertas, os pull requests e o rosto continuam funcionando quando o servidor está desligado.

### A lista de materiais

- 1 × Waveshare ESP32-P4-WIFI6-Touch-LCD-4.3 (a barriga).
- 1 × ESP32-S3-LCD-1.3-C, com a sua caixa e o cubo prisma (a cabeça).
- Fios Dupont fêmea-fêmea (são usados três).
- 1 × alto-falante com plugue GH1.25 de 2 pinos, de 8 Ω 2 W como a Waveshare recomenda. Os microfones já estão na barriga.
- 2 × cabos USB-C de dados, um por placa.
- Um PC na mesma rede, com Docker, para o servidor de voz (guia 4).

O firmware das duas placas vive num único repositório público, `davshn/narsil-bot`: um fork de 78/xiaozhi-esp32 para a barriga, com o firmware da cabeça na sua própria pasta `head/`.

## Como foi pedido à IA

O design começou num carrinho de compras. Em 2026-11-17 a pessoa autora compartilhou uma captura de tela de um carrinho do AliExpress com as duas placas e um pacote de fios Dupont, e descreveu a ideia:

> va a ser la pantalla grande para una pantalla en la pansa que va a tener la informacion de las tareas que hace narsil y la cabeza va a ser una apntalla holografica que solo sea la cara de narsil

Tradução para o português: "vai ser a tela grande, para uma tela na barriga que vai ter a informação das tarefas que a Narsil faz, e a cabeça vai ser uma tela holográfica que seja só o rosto da Narsil".

Isso fixou os papéis das duas placas antes de qualquer código: o P4 com a tela grande é a barriga, o S3 com o prisma é o rosto.

A pergunta seguinte que a IA fez foi como a cabeça receberia os seus dados: conectar-se à rede por conta própria ou recebê-los da barriga. A pessoa autora respondeu:

> Por cable desde la panza

Tradução para o português: "Por cabo a partir da barriga".

Essa resposta é a regra de "Por que a barriga faz toda a parte de rede" acima: uma placa é dona da rede e dos segredos, a outra só desenha. A IA fez as suas perguntas uma de cada vez, com as páginas da Waveshare e da SpotPear como fontes, e registrou cada resposta no documento de tarefas do projeto como uma especificação numerada.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é a conversa usada para projetar o bot.

> Quero construir um bot de mesa com duas placas ESP32: uma Waveshare ESP32-P4-WIFI6-Touch-LCD-4.3 como corpo e uma ESP32-S3-LCD-1.3-C (ST7789 240×240 sob um cubo prisma) como cabeça. O corpo deve fazer toda a parte de rede e a cabeça deve só desenhar um rosto que recebe por UART. Leia as páginas e os esquemas oficiais da Waveshare e da SpotPear, e depois proponha: o papel de cada placa, quais pinos livres do conector usar para a UART de cada lado (evitando pinos que o suporte de placa ou o console de inicialização já usam), como alimentar as duas placas e uma lista de materiais. Cite a página de onde vem cada pino e me faça uma pergunta de cada vez quando algo for uma escolha real.

## O código mínimo

A fiação vira código num só lugar em cada placa: a configuração da UART. Este é o lado da barriga, escrito para este guia com o driver UART do ESP-IDF (`driver/uart.h`, as mesmas chamadas do exemplo `uart_echo` do ESP-IDF). O lado da cabeça é igual, com os seus próprios pinos.

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

Um detalhe passa despercebido com facilidade. No ESP32-P4, os pinos padrão do ESP-IDF para a UART1 são GPIO10 e GPIO11, e nesta placa eles levam o áudio (seleção de palavra e entrada de dados do I2S). Em vez disso, `uart_set_pin` encaminha a UART1 para GPIO4 e GPIO5 pela matriz de GPIO, de modo que os pinos padrão nunca são tocados. Enviar é então uma chamada, `uart_write_bytes(HEAD_UART, data, len)`; o que vai em `data` é o [guia 10](/pt/bot/uart-protocol/).

## Erros comuns e como testar

- **TX com TX.** Se nada chegar, troque os dois fios de dados. Cada TX vai para o RX da outra placa.
- **Sem fio de terra.** Sem um terra comum o sinal não tem referência, e a cabeça lê lixo ou nada.
- **Unir os pinos 3V3.** Cada placa é alimentada pelo seu próprio cabo USB; deixe o 3V3 desconectado.
- **Usar os pinos do console.** GPIO37 e GPIO38 na barriga, e GPIO43 e GPIO44 na cabeça, são a UART0, ligada à porta serial USB de cada placa. As mensagens ali se misturam com o log de inicialização.
- **Fios fêmea num conector sem pinos.** Fios Dupont fêmea-fêmea precisam de pinos macho nas duas placas. Confira se os conectores das suas placas têm pinos antes de planejar a fiação.
- **Um cabo USB só de carga.** Se o Windows não mostrar uma nova porta COM quando você conectar uma placa, tente outro cabo (guia 2).

Para testar o link antes de existir qualquer protocolo, grave nas duas placas o exemplo `uart_echo` do ESP-IDF configurado com estes pinos, ou envie uma linha a partir da barriga e registre o que a cabeça lê com `uart_read_bytes`. Se o texto chegar intacto a 115200 baud, a fiação está certa.

## Para ir além

- A tela sensível ao toque da barriga pode fazer mais do que mostrar: um toque pode marcar um alerta como lido, o que o [guia 9](/pt/bot/belly-ui/) constrói com LVGL.
- A QMI8658 da cabeça pode perceber quando alguém levanta o bot ou dá um toque nele. A cabeça poderia enviar isso de volta pelo seu fio TX, e é por isso que o link tem dois fios de dados e não um.
- As duas placas têm conectores de bateria (MX1.25 na cabeça, um conector de lítio de 3,7 V na barriga). O bot deste caminho funciona por USB, o que mantém simples o design da alimentação.
- A [página de ESP-IDF da Waveshare para a barriga](https://docs.waveshare.com/ESP32-P4-WIFI6-Touch-LCD-4.3/ESP-IDF/) lista projetos de exemplo (ferramentas I2C, estação Wi-Fi, codec I2S, LVGL) que são úteis para conferir cada parte da placa isoladamente.
