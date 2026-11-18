---
title: Os alertas da Narsil pelo ntfy
description: 'Como a barriga segue o mesmo tópico do ntfy que os alertas da Narsil no celular: como o narsil-pet monta o tópico e as mensagens, o que a chave esconde e um stream JSON no ESP-IDF.'
route: bot
order: 7
updated: 2026-11-18
---

## O que faz

O [Narsil for Claude Code](https://github.com/davshn/narsil-pet) já avisa o seu celular quando uma conversa precisa de você: `/narsil movil` envia cada alerta para um tópico privado no [ntfy.sh](https://ntfy.sh), e o app do ntfy o mostra como notificação. A barriga assina o mesmo tópico. Quando o Claude termina, tem uma pergunta ou para com um erro, o alerta aparece também na tela da barriga, com o estado da Narsil ao lado.

Nada muda do lado do PC: o narsil-pet continua publicando como faz para o celular, e a barriga é mais uma leitora do tópico. Ela lê dois tópicos:

- **O tópico de alertas**, `narsil-` seguido de 20 caracteres hexadecimais: uma mensagem por alerta (pronto, pergunta, erro).
- **O tópico de estado**, o mesmo nome com `-estado` no final: um pequeno estado em JSON enviado ao fim de cada turno, nunca mostrado como notificação.

## Como funciona por dentro

### Como o narsil-pet monta o tópico

O nome do tópico é feito em `hooks/phone.ts`. O trecho a seguir é citado do [davshn/narsil-pet](https://github.com/davshn/narsil-pet), licenciado sob GPL-3.0-or-later:

```ts
// A topic nobody guesses: whoever knows its name can read it.
export function newTopic(uuid: string): string {
  return `narsil-${uuid
    .replace(/[^0-9a-f]/gi, '')
    .toLowerCase()
    .slice(0, 20)}`
}
```

Ele pega um UUID aleatório, mantém os seus dígitos hexadecimais em minúsculas e usa os 20 primeiros: um exemplo inventado é `narsil-0123456789abcdef0123`. O tópico de estado vem do mesmo arquivo:

```ts
export function statusTopic(topic: string): string {
  return `${topic}-estado`
}
```

No ntfy.sh público, o nome é a única proteção. A [documentação de configuração do ntfy](https://docs.ntfy.sh/config/) diz que o servidor é aberto por padrão, e que "everyone can read and write to any topic (this is how ntfy.sh is configured)" (todo mundo pode ler e escrever em qualquer tópico; é assim que o ntfy.sh está configurado). O comentário acima de `newTopic` diz o mesmo em menos palavras. Trate o tópico como uma senha: ele não entra no repositório do firmware, e `/narsil movil nuevo` cria um novo se ele vazar.

### O que um alerta leva

O `phoneMessage`, em `hooks/phone.ts`, monta o JSON que o narsil-pet publica no ntfy.sh. Em resumo:

- `title`: `Narsil · <title> · <conversation>`, com o nome da conversa de onde o alerta vem.
- `message`: o texto do alerta, depois a lista das conversas abertas e os seus estados, e, no último alerta do dia, uma nota dizendo que é o último (o narsil-pet envia no máximo 200 por dia, abaixo dos 250 gratuitos do ntfy.sh).
- `priority`: 3 para `done`, 4 para `question` e `error`.
- `tags`: uma tag que nomeia o tipo: `white_check_mark` (pronto), `raising_hand` (pergunta) ou `warning` (erro).
- `icon`: a arte da Narsil no estágio atual dela, na pose do alerta.

Assim, a barriga consegue saber o tipo de alerta só pela tag, e sabe a hora pelo próprio campo `time` do ntfy.

### O que o estado leva

A mensagem `-estado` é um objeto JSON dentro do campo `message` da mensagem do ntfy, enviada com prioridade 1. O README do narsil-pet documenta os seus campos: `xp` (o nível e a experiência da Narsil), `art` (a URL do desenho dela no seu estágio, na pose da conversa mais importante), `at` (quando foi enviada, em segundos Unix), `cacheMinutes` (quanto dura um cache, quando existe um) e `usage` (a contagem do ntfy no dia). A barriga mostra `xp` com a própria hora do ntfy para a mensagem, e lê a pose e o estágio em `art` para repassá-los à cabeça ([guias 10](/pt/bot/uart-protocol/) e [11](/pt/bot/holographic-head/)).

### O que a chave esconde, e o que não esconde

`/narsil movil clave` sela o que o narsil-pet envia, com uma chave que só os seus dispositivos têm (`hooks/seal.ts`, HMAC-SHA256 em modo contador com uma tag encrypt-then-MAC). Convém ter precisão sobre o que isso cobre. Este é o `sealedMessage` de `hooks/phone.ts`, citado do [davshn/narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later):

```ts
export function sealedMessage<M extends { title?: string; message: string }>(
  m: M,
  sealed: string,
): M {
  return { ...m, ...(m.title ? { title: 'Narsil' } : {}), message: sealed }
}
```

Só `title` e `message` mudam: o título vira "Narsil", e o texto vira uma string selada que começa com `narsil1:`. Todo o resto é copiado como estava. Com uma chave, quem conhece o tópico ainda vê:

- o **tipo** de alerta, por `tags` e `priority`;
- **quando** ele foi enviado, pelo `time` do ntfy;
- o **estágio** e a pose da Narsil, pela URL do `icon`.

A mensagem de estado não tem título, então o JSON inteiro dela é selado e só a prioridade aparece.

Na barriga, isso significa dois modos. Sem chave, ela mostra tudo. Com chave, ela mostra o tipo, a hora e o estágio, e "Narsil" como título; ler o texto exige a chave na barriga, o que está em "Para ir além".

### Assinar a partir da barriga

A [API de assinatura](https://docs.ntfy.sh/subscribe/api/) do ntfy tem um stream JSON: um `GET` longo para `https://ntfy.sh/<topic>/json` que nunca termina, e que "returns a JSON stream, with one JSON message object per line" (devolve um stream JSON, com um objeto de mensagem JSON por linha). Vários tópicos cabem numa conexão, separados por vírgulas, então a barriga abre um único stream para os dois:

```text
https://ntfy.sh/narsil-0123456789abcdef0123,narsil-0123456789abcdef0123-estado/json
```

Cada linha é um evento. O campo `event` diz qual: `open` quando o stream começa, `keepalive` de tempos em tempos para que a conexão não pareça morta, e `message` para o que importa de verdade. Um evento `message` tem `id`, `time`, `topic`, `title`, `message`, `tags` e `priority`, entre outros.

No ESP-IDF, o stream é lido com o [`esp_http_client`](https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/api-reference/protocols/esp_http_client.html) na sua ordem de streaming: `esp_http_client_open`, `esp_http_client_fetch_headers`, depois `esp_http_client_read` em laço, cortando os bytes em linhas a cada `\n`. O HTTPS usa o [pacote de certificados](https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/api-reference/protocols/esp_crt_bundle.html) do ESP-IDF (`crt_bundle_attach = esp_crt_bundle_attach`), então nenhum certificado é colado no código. Cada linha é analisada com o cJSON, que o Xiaozhi já usa no seu próprio protocolo.

### Não perder alertas numa reconexão

O Wi-Fi cai, e conexões longas se rompem. O ntfy guarda as mensagens por um tempo (o `cache-duration` do servidor é de 12 horas por padrão), e o parâmetro `since=` pede o que você perdeu: uma duração como `10m`, um horário Unix ou um ID de mensagem. A barriga lembra o `id` da última mensagem que mostrou e se reconecta com `since=<esse id>`, então recebe exatamente os alertas enviados enquanto estava fora, e nenhum duas vezes. Numa inicialização do zero, ela não tem ID e pede `since=10m`.

### Onde o tópico vive

O tópico fica guardado na NVS da barriga, por meio da classe `Settings` do Xiaozhi (`main/settings.h`), no namespace `narsil`, sob a chave `ntfy_topic`. Você o digita uma vez na tela de configurações da barriga, que o [guia 9](/pt/bot/belly-ui/) constrói; ele nunca aparece no código-fonte. O [guia 12](/pt/bot/secrets-privacy/) explica por que a NVS não é criptografada por padrão e o que isso significa para um dispositivo na sua mesa.

## Como foi pedido à IA

O trabalho da barriga estava na primeira descrição do bot feita pela pessoa autora:

> va a ser la pantalla grande para una pantalla en la pansa que va a tener la informacion de las tareas que hace narsil

Tradução para o português: "vai ser a tela grande, para uma tela na barriga que vai ter a informação das tarefas que a Narsil faz".

A Narsil já publica essas tarefas no ntfy para o celular, então a IA propôs ler esse mesmo tópico em vez de inventar um novo canal a partir do PC. Depois perguntou se a cabeça se conectaria à rede por conta própria ou receberia tudo da barriga, e a pessoa autora respondeu:

> Por cable desde la panza

Tradução para o português: "por cabo, a partir da barriga".

Assim, a barriga é a única placa na rede para os alertas: ela assina o ntfy, e a cabeça recebe só a pose e o estado pelo fio ([guia 10](/pt/bot/uart-protocol/)). Como reconectar, e o que mostrar quando há uma chave definida, não foram perguntados; a IA os tirou da documentação do ntfy e do `sealedMessage` do narsil-pet.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é a conversa usada para construir o bot.

> O meu ESP32-P4 roda o Xiaozhi (ESP-IDF 6). Acrescente uma tarefa do FreeRTOS que assine dois tópicos do ntfy.sh num único stream JSON (`https://ntfy.sh/<a>,<b>/json`), o leia com `esp_http_client_open`, `esp_http_client_fetch_headers` e `esp_http_client_read`, o divida em linhas, analise cada uma com o cJSON e passe os eventos `message` para um callback. Use o pacote de certificados, leia o tópico da NVS com a classe `Settings` do Xiaozhi, guarde o ID da última mensagem e reconecte com `since=` depois de um erro. Cite a documentação do ntfy para o formato do stream e o parâmetro `since`.

## O código mínimo

Uma tarefa para a barriga, em C++, ao lado do código do Xiaozhi (MIT, como os próprios exemplos do site). `ShowAlert` e `ShowStatus` são as funções da tela do [guia 9](/pt/bot/belly-ui/):

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

Chame `StartNtfy()` quando o Wi-Fi estiver conectado. O `ShowAlert` recebe a tag, então a tela consegue escolher a pose e a cor certas mesmo quando o texto está selado. O tempo limite de leitura de dois minutos fica bem acima do intervalo entre os eventos keepalive do ntfy, então um tópico em silêncio não conta como uma conexão morta.

## Erros comuns e como testar

- **Um stream que termina depois das primeiras linhas.** `poll=1` devolve o cache e fecha; a URL do bot não deve incluí-lo.
- **O cache inteiro a cada reconexão.** Sem `since=`, uma reconexão não traz nada antigo; com `since=all`, traz tudo de novo. Use o último `id`.
- **Um tópico com uma letra maiúscula ou um erro de digitação.** O ntfy o trata como um tópico diferente e vazio. Copie-o do `/narsil movil`, que imprime o nome.
- **Texto selado na tela.** Uma mensagem que começa com `narsil1:` foi selada pelo `/narsil movil clave`. Mostre "Narsil" e o tipo pela tag, ou acrescente a chave (Para ir além).
- **Nenhum alerta enquanto você está no PC.** O narsil-pet só envia quando a sua última mensagem veio do Remote Control (o README dele explica por quê). `/narsil movil prueba` envia um alerta de teste de qualquer lugar.
- **O tópico no repositório.** Ele vai na NVS pela tela de configurações, nunca num arquivo-fonte ou num valor padrão.

Para testar sem a barriga, acompanhe o stream de um terminal no PC com o próprio exemplo da documentação do ntfy, usando o seu tópico:

```powershell
curl.exe -s "https://ntfy.sh/narsil-0123456789abcdef0123/json"
```

Rode `/narsil movil prueba` no Claude Code: aparece uma linha `message`. Depois faça o mesmo com a barriga ligada: o alerta aparece na tela dela, e o monitor serial (guia 2) mostra a conexão com o ntfy.sh. Desligue o Wi-Fi do roteador por um minuto, envie outro teste e ligue-o de novo: a barriga se reconecta com `since=` e mostra o alerta que perdeu.

## Para ir além

- **Ler alertas selados.** O `hooks/seal.ts` deriva duas chaves da sua com HMAC-SHA256 (`enc` e `mac`), faz XOR do texto com um keystream HMAC em blocos de 32 bytes e confere uma tag sobre o nonce e o texto cifrado. O mbedTLS, parte do ESP-IDF, tem HMAC-SHA256; portar o `unseal` permite que a barriga leia o texto enquanto o tópico mostra ruído.
- **O seu próprio servidor ntfy.** O ntfy pode rodar em casa com controle de acesso, para que o tópico não seja público. O narsil-pet publica em `https://ntfy.sh`, então os dois lados teriam de mudar.
- **O estado para a cabeça.** A mensagem `-estado` é o que comanda a pose da Narsil na cabeça; o [guia 10](/pt/bot/uart-protocol/) a envia pela UART.
- O guia 8 acrescenta a outra lista que a barriga mostra: os pull requests que precisam de você. A tela em si é o [guia 9](/pt/bot/belly-ui/).
