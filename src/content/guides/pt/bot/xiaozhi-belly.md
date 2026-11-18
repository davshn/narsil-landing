---
title: O Xiaozhi na barriga
description: 'O que é o Xiaozhi, como ele roda na placa ESP32-P4 da Waveshare, como a barriga é apontada para o seu próprio servidor em vez do xiaozhi.me e o que acontece na primeira inicialização.'
route: bot
order: 3
updated: 2026-11-18
---

## O que faz

O Xiaozhi ([78/xiaozhi-esp32](https://github.com/78/xiaozhi-esp32), MIT) é um firmware de código aberto que transforma uma placa ESP32 num assistente de voz. É ele que dá à barriga os seus ouvidos e a sua voz: escuta uma palavra de ativação, transmite o que você diz para um servidor e reproduz a resposta.

Segundo o seu README, as partes que o bot usa são:

- **Um pipeline de voz.** O áudio é comprimido com Opus e transmitido para um servidor, que faz o reconhecimento de fala, roda um modelo de linguagem e a síntese de fala, e transmite de volta a resposta falada.
- **Dois transportes**: [WebSocket](https://github.com/78/xiaozhi-esp32/blob/main/docs/websocket.md), ou [MQTT mais UDP](https://github.com/78/xiaozhi-esp32/blob/main/docs/mqtt-udp.md). O bot usa WebSocket.
- **Palavra de ativação offline** com o ESP-SR da Espressif, de modo que a placa só começa a transmitir depois de ouvir a sua palavra de ativação.
- **MCP no dispositivo**: o firmware expõe "ferramentas" (o README cita controle de alto-falante, LED, servo e GPIO) que o modelo de linguagem no servidor pode descobrir e chamar.
- **Provisionamento de Wi-Fi** por um ponto de acesso ou por BluFi, de modo que nenhuma senha de Wi-Fi é compilada no firmware.
- **Uma camada de exibição** para telas LCD, com expressões e o texto da conversa.

O Xiaozhi suporta a barriga do bot sem mudanças. Por padrão ele conversa com o serviço oficial em xiaozhi.me; o bot, em vez disso, conversa com um servidor no seu próprio PC (guia 4).

## Como funciona por dentro

### A pasta da placa

Cada placa que o Xiaozhi suporta tem uma pasta em `main/boards/`. A da barriga é `main/boards/waveshare/esp32-p4-wifi6-touch-lcd/`, compartilhada por toda a família ESP32-P4-WIFI6-Touch-LCD (4B, 4.3, 5, 7B, 3.4C, 4C, 7, 8 e 10.1 polegadas). Ela contém:

- `esp32-p4-wifi6-touch-lcd.cc`: a classe da placa, `WaveshareEsp32p4`, construída sobre a `WifiBoard` do Xiaozhi. Ela inicializa a tela, o painel de toque GT911 e o codec de áudio.
- `config.h`: os pinos e os tamanhos. Para a placa de 4,3 polegadas, define uma tela de 480 × 800 em 2 vias MIPI DSI a 500 Mbps, áudio a 24.000 Hz de entrada e de saída, o ES8311 e o ES7210 em I2C (GPIO7 e GPIO8), I2S de GPIO9 a GPIO13 e o botão BOOT em GPIO35.
- `config.json`: as variantes de compilação que o `scripts/build.py` conhece.
- `README.md`: qual opção de menu seleciona cada tamanho.

### Duas variantes para a mesma placa

O `config.json` lista duas compilações para a placa de 4,3 polegadas, e escolher a certa importa:

| Variante                        | Opções extras                                                          | Para                                  |
| ------------------------------- | ---------------------------------------------------------------------- | ------------------------------------- |
| `esp32-p4-wifi6-touch-lcd-4.3`  | `CONFIG_ESP32P4_SELECTS_REV_LESS_V3=y`, `CONFIG_ESP32P4_REV_MIN_100=y` | Silício ESP32-P4 anterior à revisão 3 |
| `esp32-p4x-wifi6-touch-lcd-4.3` | nenhuma dessas duas                                                    | Silício ESP32-P4 da revisão 3.x       |

As duas definem `CONFIG_BOARD_TYPE_WAVESHARE_ESP32_P4_WIFI6_TOUCH_LCD_4_3=y`, o cancelamento de eco no dispositivo (`CONFIG_USE_DEVICE_AEC=y`) e as opções da câmera OV5647 para a versão que tem uma. O README do Xiaozhi observa que o ESP32-P4 Rev1 e o Rev3 são ambos suportados no IDF 6, e o README do suporte de placa da Waveshare descreve a mesma divisão ("pre-v3 silicon", silício anterior à v3, e "rev3.x or newer", rev3.x ou mais recente). O esptool imprime o chip e a sua revisão quando se conecta à placa, então confira a sua antes da primeira compilação.

### Como a barriga encontra o seu servidor

O endereço do servidor não é compilado no código de voz. A cada inicialização, o Xiaozhi pede as suas configurações a um **endpoint OTA**, como descreve o seu [documento de OTA](https://github.com/78/xiaozhi-esp32/blob/main/docs/ota.md):

1. A placa envia um `POST` para a URL de OTA com a sua identidade (endereço MAC, um UUID `Client-Id` guardado na NVS, nome da placa, versão do firmware) e as suas capacidades.
2. O servidor responde com JSON: um objeto `websocket` (`url` e `token`) ou um objeto `mqtt`, a hora do servidor, uma atualização de firmware opcional e um código de `activation` opcional.
3. A placa salva as configurações de conexão na NVS e abre o canal de voz quando precisa dele.

A regra do documento para escolher a URL de OTA: o firmware "uses a valid saved `wifi.ota_url`, otherwise `CONFIG_OTA_URL`" (usa uma `wifi.ota_url` salva e válida; caso contrário, `CONFIG_OTA_URL`). Em `main/ota.cc`:

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

O `CONFIG_OTA_URL` vem de `main/Kconfig.projbuild`, no menu `Xiaozhi Assistant`, como "Default OTA URL" (URL de OTA padrão), com o padrão `https://api.tenclass.net/xiaozhi/ota/` (o serviço oficial). Então há duas formas de apontar a barriga para o seu servidor:

- **Salvar a URL no dispositivo** (o que o bot faz). A página de configuração do Wi-Fi tem uma aba Advanced (avançado) com um campo de URL de OTA; o que você digita ali é salvo na NVS como `wifi/ota_url`.
- **Mudar o padrão na compilação**, pelo `idf.py menuconfig` ou editando o `Kconfig.projbuild`, como faz o guia de firmware da xinnan-tech.

O bot a salva no dispositivo por causa de uma regra definida para o projeto inteiro: os segredos, e com eles o endereço do servidor, vivem na NVS ou na configuração local, nunca no repositório. Uma URL salva no dispositivo nunca chega ao git, e mudar o servidor para outro PC não exige recompilar.

### Primeira inicialização e provisionamento do Wi-Fi

O Wi-Fi vem do componente [esp-wifi-connect](https://github.com/78/esp-wifi-connect) do Xiaozhi. O seu README diz que ele primeiro tenta as redes salvas na flash e, se isso falhar, inicia um ponto de acesso e um servidor web em `http://192.168.4.1`. A `WifiBoard` do Xiaozhi o configura com o prefixo `Xiaozhi`, de modo que o ponto de acesso se chama `Xiaozhi-` seguido de quatro dígitos hexadecimais do endereço MAC da placa, e ativa o campo de OTA da aba Advanced (`show_ota_config = true`).

O componente valida a URL de OTA antes de salvá-la: um valor vazio significa "usar o padrão do firmware", e qualquer outra coisa precisa ser uma URL HTTP ou HTTPS absoluta de no máximo 255 bytes ASCII, com um host.

Depois de conectada, a barriga chama o endpoint OTA do seu servidor. Com o serviço oficial, a resposta inclui um código de ativação que você digita no console do xiaozhi.me. O seu próprio servidor, no modo mínimo, devolve o endereço do WebSocket e nenhum código de ativação (guia 4), então não há nada a vincular e a barriga vai direto para o estado ocioso.

### Uma conversa, passo a passo

Segundo o documento de WebSocket do Xiaozhi:

1. **Ocioso → Conectando.** A palavra de ativação ou o botão BOOT abre o canal de áudio: a barriga se conecta à URL do WebSocket, com os cabeçalhos `Authorization`, `Protocol-Version`, `Device-Id` e `Client-Id`, e envia uma mensagem `"type": "hello"` com os seus parâmetros de áudio.
2. **Conectando → Escutando.** O servidor responde com o seu próprio `hello` e um ID de sessão, a barriga envia `listen` com `"state": "start"`, e o áudio do microfone sobe como Opus em quadros binários.
3. **O servidor trabalha.** Ele devolve `stt` com o texto que ouviu, `llm` com uma emoção para o rosto e mensagens `tts`: `start`, depois `sentence_start` com o texto de cada frase, depois `stop`.
4. **Escutando → Falando → Ocioso.** No `tts` `start` a barriga para de enviar áudio e reproduz o que chega; no `stop` ela volta a escutar se a continuação automática estiver ativa, caso contrário vai para o estado ocioso.

Essa emoção de `llm` é útil mais adiante: é a primeira coisa que a barriga pode repassar para a cabeça como pose.

### MCP no dispositivo

O Xiaozhi registra ferramentas no dispositivo pelo singleton `McpServer`, com `AddTool(name, description, properties, callback)`. O servidor envia `initialize`, depois `tools/list`, depois `tools/call` por JSON-RPC 2.0, como explica o seu [documento de uso do MCP](https://github.com/78/xiaozhi-esp32/blob/main/docs/mcp-usage.md). É assim que o cérebro da Narsil vai poder agir sobre o bot, e não só falar por meio dele; guias posteriores acrescentam as ferramentas próprias do bot.

## Como foi pedido à IA

A voz não estava no primeiro design. Quando as duas placas já tinham os seus papéis, a IA perguntou como a Narsil deveria falar, e a pessoa autora já tinha uma resposta:

> yo pensaba hacerlo con Xiaozhi

Tradução para o português: "eu pensava em fazer com o Xiaozhi".

A IA leu o README do Xiaozhi para conferir o que ele traz e o que ele exige: licença MIT, o ESP32-P4 entre as suas plataformas de chip e o ESP-IDF 6.0.1 ou posterior (guia 2). Isso fez do Xiaozhi a base do firmware da barriga, e do repositório um fork dele.

Depois veio a questão de onde a voz é processada. O Xiaozhi se conecta ao xiaozhi.me por padrão, e a IA perguntou se deveria usar esse serviço ou um servidor próprio da pessoa autora. A resposta:

> servidor propio

Tradução para o português: "servidor próprio".

Essa resposta é o motivo de este guia dedicar tempo à URL de OTA: ela é a única configuração que leva a barriga do serviço oficial para o seu. O guia 4 constrói o próprio servidor.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é a conversa usada para construir o bot.

> Tenho um fork de 78/xiaozhi-esp32 e uma Waveshare ESP32-P4-WIFI6-Touch-LCD-4.3. Leia a pasta da placa `main/boards/waveshare/esp32-p4-wifi6-touch-lcd/`, `main/Kconfig.projbuild`, `main/ota.cc` e `docs/ota.md`, e depois explique: qual variante de compilação serve para a minha placa e como descubro a revisão do meu chip, o comando `scripts/build.py` exato, e todas as formas pelas quais o firmware decide qual URL de OTA usar. Quero o endereço do meu servidor fora do repositório, então recomende a opção que o guarda no dispositivo, e me diga o que vou ver na primeira inicialização.

## O código mínimo

A barriga não precisa de código novo para este guia: é o Xiaozhi como vem, compilado para a placa certa. A partir da raiz do fork, no PowerShell, com a imagem Docker do guia 2:

```powershell
docker run --rm -v ${PWD}:/project -w /project -e HOME=/tmp -e IDF_GIT_SAFE_DIR=/project `
  espressif/idf:release-v6.1 `
  python scripts/build.py waveshare/esp32-p4-wifi6-touch-lcd --name esp32-p4-wifi6-touch-lcd-4.3 --language es-ES
```

- `waveshare/esp32-p4-wifi6-touch-lcd` é a pasta da placa em `main/boards/`.
- `--name` escolhe a variante. Sem ele, o `build.py` pergunta de forma interativa e, num contêiner sem terminal, para com "Multiple variants found in non-interactive mode; select one with --name." (várias variantes encontradas no modo não interativo; selecione uma com --name). Use `esp32-p4x-wifi6-touch-lcd-4.3` para o silício da revisão 3.
- `--language es-ES` deixa a interface e os avisos de voz em espanhol, o idioma da Narsil; o padrão é `en-US`. Sem `--wake-word`, o `build.py` escolhe "Hi ESP" para todos os idiomas exceto `zh-CN` e `zh-TW`.

O resultado é `build/merged-binary.bin`. Grave-o a partir do Windows (guia 2):

```powershell
esptool --port COM5 write-flash 0x0 build/merged-binary.bin
```

Depois, na primeira inicialização:

1. No seu celular, entre na rede Wi-Fi `Xiaozhi-` seguida de quatro caracteres.
2. Abra `http://192.168.4.1`.
3. Na aba **Advanced** (avançado), digite a URL de OTA do seu servidor, formada pelo endereço do seu PC na rede local e pela porta 8003 (guia 4), por exemplo `http://192.168.1.50:8003/xiaozhi/ota/`. Salve.
4. Escolha a sua rede Wi-Fi, digite a senha dela e salve.

Se você compilar com `idf.py` em vez de `build.py`, a mesma placa é selecionada no `idf.py menuconfig`, em `Xiaozhi Assistant`, opção "Waveshare ESP32-P4 Wi-Fi 6 Touch LCD 4.3".

## Erros comuns e como testar

- **A variante errada para o seu silício.** As duas compilações de 4,3 polegadas diferem só na revisão de chip que visam. Confira a revisão que o esptool imprime e escolha o `--name` correspondente.
- **`127.0.0.1` ou `localhost` como URL de OTA.** Na barriga, isso significa a própria barriga. Use o endereço do PC na sua rede.
- **Uma URL que o portal rejeita.** Ela precisa ser absoluta (com `http://`), ter um host e ficar abaixo de 255 bytes ASCII. Mantenha o caminho exatamente como `/xiaozhi/ota/`, com a barra final, como o servidor o imprime.
- **`https://` para um servidor HTTP simples.** O servidor mínimo do guia 4 fala HTTP simples na porta 8003.
- **Uma URL inválida salva antes.** O firmware a ignora e volta para o `CONFIG_OTA_URL`, que é o serviço oficial. O monitor mostra "Ignoring invalid saved OTA URL; using the default" (ignorando a URL de OTA salva inválida; usando o padrão).
- **O ponto de acesso volta depois de uma regravação completa.** O documento de WebSocket do Xiaozhi diz que o `Client-Id` é redefinido quando a NVS é apagada ou o firmware completo é regravado; se as configurações salvas também tiverem sumido, digite de novo o Wi-Fi e a URL de OTA.
- **A placa se conecta mas nunca responde.** O firewall do PC pode estar bloqueando as portas 8000 e 8003, ou o servidor pode estar desligado. A barriga continua tentando a verificação de OTA: dez tentativas, começando em dez segundos e dobrando.

Para testar, abra o monitor (guia 2) durante a primeira inicialização. Você deve ver a conexão ao Wi-Fi, a requisição de OTA para a sua URL e, quando o servidor estiver no ar, nenhuma etapa de ativação. Depois diga a palavra de ativação, "Hi ESP": a barriga passa a escutar, e o log do servidor (guia 4) mostra a conexão e o texto que ele ouviu.

## Para ir além

- O [documento de OTA](https://github.com/78/xiaozhi-esp32/blob/main/docs/ota.md) do Xiaozhi descreve como um servidor também pode oferecer atualizações de firmware; o servidor da xinnan-tech pode servi-las a partir da sua pasta `data/bin`, de modo que a barriga pode se atualizar por Wi-Fi.
- `scripts/build.py --list-wake-words` lista os modelos de palavra de ativação do componente ESP-SR atual, e `--wake-word` escolhe um.
- O [guia de placa personalizada](https://github.com/78/xiaozhi-esp32/blob/main/docs/custom-board.md) avisa para nunca sobrescrever a configuração de uma placa existente com uma personalizada, porque o OTA pode substituir o seu firmware pelo de fábrica daquela placa. Tenha isso em mente sempre que acrescentar código próprio à barriga.
- O Xiaozhi também pode mostrar expressões na sua própria tela; o guia 9 substitui a tela da barriga pela interface própria da Narsil.
