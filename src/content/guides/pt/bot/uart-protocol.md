---
title: O protocolo UART entre barriga e cabeça
description: 'Um pequeno protocolo de linhas com versão e checksum: a barriga envia a pose e o estado de voz da Narsil, a cabeça só diz olá, e os dois sobrevivem a uma reinicialização ou a um fio solto.'
route: bot
order: 10
updated: 2026-11-18
---

## O que faz

A barriga sabe o que a Narsil está fazendo; a cabeça só a desenha. Entre elas correm os três fios do guia 1, e este guia decide o que viaja por eles: linhas curtas de texto como

```text
$N1,P,trabajando,3*3A
```

que significa "protocolo versão 1: mostre a pose `trabajando` (trabalhando) no estágio 3". A barriga envia uma linha quando a pose da Narsil muda, quando o Xiaozhi começa ou para de escutar ou de falar, e a cada cinco segundos de qualquer forma. A cabeça confere cada linha, desenha o que ela diz e envia uma linha de volta só quando inicia, para pedir o estado atual.

Esse é o protocolo inteiro: duas mensagens para baixo, uma para cima. Basta porque a cabeça não guarda nenhum estado que valha a pena manter nem segredos, como o guia 1 decidiu.

## Como funciona por dentro

### Por que linhas de texto

Uma UART transporta bytes, sem nenhuma ideia de onde uma mensagem começa ou termina. O protocolo tem de acrescentar isso, e há duas formas comuns: quadros binários com um byte de início e um comprimento, ou linhas de texto que terminam em `\n`. O bot usa linhas de texto:

- **Você consegue lê-las.** O monitor serial ou um adaptador USB-serial mostra as mensagens como são, e você pode digitar uma à mão para testar a cabeça.
- **Um byte perdido custa uma linha.** Depois de qualquer lixo, o próximo `$` começa uma nova mensagem, e o próximo `\n` a termina. Nada precisa ressincronizar.
- **As mensagens são minúsculas.** Uma pose e um estágio cabem em uns 20 bytes. A 115200 baud, uma linha leva menos de 2 milissegundos.

### O formato de uma linha

```text
$N1,<type>,<fields>*<checksum>\n
```

| Parte        | Significado                                                                    |
| ------------ | ------------------------------------------------------------------------------ |
| `$`          | Início de uma mensagem. Tudo o que vem antes é ignorado.                       |
| `N1`         | Protocolo Narsil, versão 1. Uma cabeça que não conhece a versão a ignora.      |
| `<type>`     | Uma letra: `P` (pose), `V` (voz), `H` (olá).                                   |
| `<fields>`   | Valores separados por vírgulas, conforme o tipo.                               |
| `*`          | Fim do corpo.                                                                  |
| `<checksum>` | Dois dígitos hexadecimais maiúsculos: o XOR de todos os bytes entre `$` e `*`. |
| `\n`         | Fim da linha. Uma linha com mais de 64 bytes é descartada.                     |

É o mesmo formato que os receptores de GPS usam para as suas sentenças NMEA, pelos mesmos motivos: legível, curto e autoverificável. O checksum XOR é um byte, calculado fazendo XOR dos caracteres um após o outro. Ele não pega todos os erros, mas pega os comuns num fio curto, como um bit trocado ou um byte perdido no meio de uma linha, e não custa nada calcular.

O campo de versão é o que permite que o protocolo mude depois. Se a versão 2 acrescentar um campo, uma cabeça com firmware antigo ignora as linhas `N2` em vez de desenhar algo errado, e a barriga pode enviar as duas enquanto as placas são atualizadas uma de cada vez.

### As mensagens

| Linha                   | Direção          | Significado                                                                                             |
| ----------------------- | ---------------- | ------------------------------------------------------------------------------------------------------- |
| `$N1,P,<pose>,<stage>*` | barriga → cabeça | A pose da Narsil: `parada`, `trabajando`, `necesita`, `terminado` ou `error`; o estágio dela, de 1 a 5. |
| `$N1,V,<voice>*`        | barriga → cabeça | O estado de voz do Xiaozhi: `idle`, `listening` ou `speaking`.                                          |
| `$N1,H*1B`              | cabeça → barriga | Olá: a cabeça acabou de iniciar e não tem nada para desenhar.                                           |

Algumas linhas reais, com os seus checksums:

```text
$N1,P,parada,1*35
$N1,P,necesita,2*33
$N1,V,listening*40
$N1,V,idle*2D
$N1,H*1B
```

Os nomes das poses são os do próprio narsil-pet, mantidos em espanhol para que correspondam um a um aos arquivos de arte dela. Eles vêm da tabela `POSE` no seu `hooks/sprite.ts`, uma pose por estado: `working` é `trabajando`, `idle` é `parada`, `waiting` é `necesita`, `done` é `terminado` e `error` é `error`.

### De onde vem a pose

A barriga não inventa a pose da Narsil: o PC a informa, na mensagem `-estado` do guia 7. Esse JSON não tem um campo "pose" próprio; ele tem `art`, a URL do desenho dela, montada pelo `artUrl` em `hooks/phone.ts` do narsil-pet:

```ts
export function artUrl(pose: string, stage: number): string {
  return `${ART_URL}/${stage > 1 ? `etapa${stage}/` : ''}${pose}-oscuro.png`
}
```

(Citado do [davshn/narsil-pet](https://github.com/davshn/narsil-pet), GPL-3.0-or-later.) O `sendStatus` em `hooks/register.tsx` o chama com a pose da conversa mais importante e o estágio da Narsil, de 1 (a recém-nascida) a 5 (`STAGE_FROM` em `hooks/xp.ts`). Assim, a URL leva os dois valores:

| `art` termina em                       | Pose         | Estágio |
| -------------------------------------- | ------------ | ------- |
| `/assets/parada-oscuro.png`            | `parada`     | 1       |
| `/assets/etapa3/trabajando-oscuro.png` | `trabajando` | 3       |
| `/assets/etapa5/error-oscuro.png`      | `error`      | 5       |

`HeadSetPoseFromArt`, a função que o `ShowStatus` do guia 9 chama, pega como pose o nome do arquivo entre a última `/` e `-oscuro.png`, e como estágio o número depois de `/etapa` (1 quando não há). Ela confere a pose contra os cinco nomes antes de guardá-la, então uma mudança no formato da URL nunca pode enviar à cabeça algo que ela não consegue desenhar.

A cabeça desenha a mesma arte que a faixa da Narsil e os alertas do celular mostram, e por isso os nomes ficam como o narsil-pet os escreve.

### O estado de voz

A barriga também sabe algo que o PC não sabe: se o Xiaozhi está escutando ou falando neste momento. `Application::GetInstance().GetDeviceState()` no Xiaozhi devolve o estado atual da sua máquina de estados (`main/device_state.h`): `kDeviceStateListening` e `kDeviceStateSpeaking` viram `listening` e `speaking`, e todos os outros estados são `idle`. A tarefa do link na barriga o confere dez vezes por segundo e envia uma linha `V` quando ele muda, para que a cabeça possa mostrar que a Narsil está escutando enquanto você fala com ela.

### Reconexões, reinicializações e fios soltos

O link não tem conexão para estabelecer nem nada para confirmar. Três regras mantêm os dois lados em sintonia:

1. **A barriga se repete.** A cada cinco segundos ela envia as linhas `P` e `V` atuais, mudadas ou não. Uma cabeça que perdeu uma linha, ou cujo fio foi desconectado e conectado de novo, volta a estar certa em até cinco segundos.
2. **A cabeça diz olá.** Quando a cabeça inicia, ela envia `$N1,H*1B` uma vez. A barriga responde na hora com `P` e `V`, então uma cabeça reiniciada não espera pela próxima repetição.
3. **A cabeça percebe o silêncio.** Se nenhuma linha válida chega por 15 segundos, a barriga está desligada ou o fio está solto. A cabeça mantém a última pose na tela e diminui a luz de fundo (guia 11), em vez de congelar no brilho máximo.

Quando a barriga inicia, ela começa por `parada` no estágio 1 e o envia na hora; a primeira mensagem `-estado` do ntfy (o stream pede `since=10m`, guia 7) o corrige.

### Por que a cabeça não envia mais nada

A cabeça tem uma IMU de seis eixos e poderia informar toques ou quando é levantada, e o fio TX está lá para isso. O bot o limita ao olá por um motivo: tudo o que a cabeça envia é algo que a barriga precisa validar, tratar e manter compatível entre versões. Com uma mensagem para cima, a cabeça não pode pedir nada à barriga, não pode causar uma requisição de rede e não pode alcançar um segredo. A regra do guia 1, "a barriga é dona de cada conexão e de cada segredo", é mais fácil de manter quando a outra direção está quase vazia.

### A UART em cada placa

Os dois lados usam o [driver de UART](https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/api-reference/peripherals/uart.html) do ESP-IDF com as configurações do guia 1: `UART_NUM_1`, 115200 baud, 8 bits de dados, sem paridade, 1 bit de parada, sem controle de fluxo, com um terra comum.

| Placa              | TX     | RX     |
| ------------------ | ------ | ------ |
| Barriga (ESP32-P4) | GPIO4  | GPIO5  |
| Cabeça (ESP32-S3)  | GPIO14 | GPIO13 |

As chamadas são as do exemplo `uart_echo` do ESP-IDF: `uart_driver_install` com um buffer de recepção, `uart_param_config`, `uart_set_pin`, depois `uart_write_bytes` para enviar e `uart_read_bytes` com um tempo limite para receber. Na cabeça, `uart_read_bytes` com um tempo limite de 200 ms é também o relógio do seu laço principal: ele retorna antes quando chegam bytes e, se não chegam, deixa a cabeça verificar o silêncio.

## Como foi pedido à IA

O link em si veio de uma das primeiras respostas da pessoa autora. Perguntada se a cabeça entraria na rede por conta própria ou receberia os seus dados da barriga, a pessoa autora disse:

> Por cable desde la panza

Tradução para o português: "por cabo, a partir da barriga".

E o trabalho da cabeça tinha sido definido logo no início:

> la cabeza va a ser una apntalla holografica que solo sea la cara de narsil

Tradução para o português: "a cabeça vai ser uma tela holográfica que seja só o rosto da Narsil".

Juntas, essas duas respostas são o escopo do protocolo: um fio, e só o que o rosto precisa. O formato não foi decisão da pessoa autora. A IA comparou quadros binários com linhas de texto, e escolheu linhas de texto com uma versão e um checksum porque elas podem ser lidas e digitadas à mão durante os testes. Mapear a pose a partir da URL de `art`, em vez de acrescentar um novo campo no PC, veio da leitura do `artUrl` e do `sendStatus` do narsil-pet: a informação já estava lá, então nada do lado do PC precisou mudar.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é a conversa usada para construir o bot.

> Duas placas ESP32 compartilham uma UART (UART_NUM_1, 115200 baud, terra comum). O corpo envia à cabeça só uma pose e um estado de voz; a cabeça os desenha e deve sobreviver a reinicializações e fios desconectados. Projete um protocolo de texto baseado em linhas com um campo de versão e um checksum XOR de um byte, liste cada mensagem com um exemplo e o seu checksum, e escreva os dois lados no ESP-IDF 6 com `uart_driver_install`, `uart_param_config`, `uart_set_pin`, `uart_write_bytes` e `uart_read_bytes`. O corpo repete o seu estado a cada 5 s; a cabeça envia um olá ao iniciar e nada mais. Explique como testo cada lado a partir de um PC com um adaptador USB-serial.

## O código mínimo

O lado da barriga, em C++, ao lado do código do Xiaozhi (MIT, como os próprios exemplos do site). O `head_link_init` do guia 1 configura a porta; isto acrescenta as mensagens e a tarefa do link:

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

Chame `head_link_init()` e depois `StartHeadLink()` uma vez no início; o link não precisa de Wi-Fi.

O lado da cabeça, em C (MIT). Ele lê uma linha de cada vez e preenche uma pequena struct de estado que o guia 11 desenha:

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

`head_link_poll` devolve `true` para cada linha válida, depois de atualizar `state`, e `false` depois de `timeout_ms` sem nada válido. Um `$` no meio do lixo reinicia a linha, então a cabeça pega a próxima mensagem boa por conta própria.

## Erros comuns e como testar

- **Um checksum calculado incluindo o `$`.** O XOR cobre só os bytes entre `$` e `*`. `$N1,H*1B` é a referência: se o seu código obtém outro valor para ela, está incluindo demais.
- **Hexadecimal em minúsculas.** `%02X` escreve `1B`; o `strtoul` da cabeça aceita as duas formas, mas uma ferramenta que compara strings pode não aceitar.
- **`\r\n` vindo de um terminal.** Muitos terminais enviam um retorno de carro antes da quebra de linha. Então o `strlen(star) != 3` da cabeça falha; configure o terminal para enviar só `LF`.
- **O console da barriga no link.** Se mensagens de inicialização aparecem do lado da cabeça, o link está na UART0. Ele deve estar na `UART_NUM_1`, em GPIO4 e GPIO5 (guia 1).
- **Uma pose para a qual a cabeça não tem arte.** A barriga só aceita os cinco nomes de pose do narsil-pet e os estágios de 1 a 5, e a cabeça os confere de novo.
- **As duas placas em silêncio depois de uma reinicialização da barriga.** A barriga envia na hora quando inicia, e depois a cada cinco segundos; se a cabeça continua com pouco brilho, troque os fios de dados (TX vai em RX).

Para testar cada lado sem o outro, use um adaptador USB-serial de 3,3 V e um terminal no PC. O pyserial vem com o esptool, então o `miniterm` já está lá:

```powershell
python -m serial.tools.miniterm --eol LF COM7 115200
```

- **Só a barriga.** Ligue o RX do adaptador ao GPIO4 da barriga e o GND dele ao GND da barriga. Uma linha `P` e uma `V` aparecem a cada cinco segundos. Diga "Hi ESP" e uma linha `$N1,V,listening*40` aparece na hora. Rode `/narsil movil prueba`, ou termine um turno no Claude Code, e a linha `P` muda com a pose da Narsil.
- **Só a cabeça.** Ligue o TX do adaptador ao GPIO13 da cabeça e GND a GND, e o RX dele ao GPIO14. Reinicie a cabeça: chega `$N1,H*1B`. Digite `$N1,P,necesita,2*33` e pressione Enter: a cabeça desenha a Narsil esperando no estágio 2. Digite a mesma linha com um checksum errado, `*34`: nada muda.

Use só adaptadores de 3,3 V. Um adaptador de 5 V pode danificar os pinos do ESP32.

## Para ir além

- **Brilho a partir da barriga.** Um tipo de mensagem como `B,<percent>` permitiria que a barriga diminuísse o brilho da cabeça à noite. Acrescente-o como um novo tipo na versão 1: as cabeças antigas ignoram os tipos que não conhecem, porque `apply` devolve `false` para eles.
- **Toques a partir da cabeça.** A QMI8658 consegue detectar um toque. Uma linha `T` da cabeça para a barriga poderia marcar o alerta mais novo como lido na tela da barriga do [guia 9](/pt/bot/belly-ui/). Mantenha-a em eventos, nunca em pedidos.
- **Um CRC.** Para cabos mais longos ou mais dados, um CRC-16 substitui o byte XOR por quatro dígitos hexadecimais, numa nova versão, `N2`.
- O desenho da cabeça, a imagem espelhada e o fundo preto estão no [guia 11](/pt/bot/holographic-head/).
