---
title: Segredos e privacidade
description: 'Cada segredo que o bot guarda e onde ele vive, o que a NVS e a criptografia da flash protegem, o que sai da sua rede e para quem, e como apagar o bot e revogar cada credencial.'
route: bot
order: 12
updated: 2026-11-18
---

## O que faz

O bot é um microfone na sua mesa com o seu token do GitHub dentro, então ele merece um guia que reúna o quadro inteiro num só lugar. Este responde a três perguntas:

- **Que segredos o bot guarda, e onde?** Sete, em duas máquinas, e nenhum no repositório.
- **O que sai da sua rede?** A sua voz vai para uma empresa, as suas palavras para outra, as respostas da Narsil para uma terceira, e dois serviços veem a barriga se conectar.
- **Como você pega tudo de volta?** Como apagar a barriga, e como revogar cada credencial na sua origem.

Nada aqui é código novo. Ele reúne o que os guias 3 a 11 configuraram, e acrescenta as opções que o ESP-IDF oferece para proteger o que fica guardado na placa.

## Como funciona por dentro

### Os segredos, e onde cada um vive

| Segredo                           | Vive em                                                       | Definido por                      | Dá acesso a                            |
| --------------------------------- | ------------------------------------------------------------- | --------------------------------- | -------------------------------------- |
| Nome e senha do Wi-Fi             | NVS da barriga, namespace `wifi`, chaves `ssid` e `password`  | Portal do Wi-Fi (guia 3)          | A sua rede doméstica                   |
| URL de OTA (endereço do servidor) | NVS da barriga, `wifi/ota_url`                                | Portal do Wi-Fi, aba Avançado     | Para onde a barriga envia a sua voz    |
| URL e token do WebSocket          | NVS da barriga, namespace `websocket`, chaves `url` e `token` | A resposta de OTA do seu servidor | Conversar com o seu servidor           |
| Tópico do ntfy                    | NVS da barriga, namespace `narsil`, chave `ntfy_topic`        | Tela de configurações (guia 9)    | Ler (e escrever) os alertas da Narsil  |
| Token do GitHub                   | NVS da barriga, namespace `narsil`, chave `gh_token`          | Tela de configurações (guia 9)    | Ler os pull requests que você pode ver |
| Chave de API da Anthropic         | O seu PC: `ANTHROPIC_API_KEY` ou `data/.config.yaml`          | Você (guia 5)                     | Gastar na sua conta da Anthropic       |
| Chave de API da OpenAI            | O seu PC: `data/.config.yaml`, bloco `OpenaiASR`              | Você (guia 4)                     | Gastar na sua conta da OpenAI          |

Os namespaces vêm do código: o `ssid_manager.cc` do esp-wifi-connect abre `"wifi"` e lê `ssid`, `password` e as suas cópias numeradas (até dez redes); o `main/ota.cc` do Xiaozhi salva as configurações do WebSocket com `Settings settings("websocket", true)`; os guias 7 a 9 usam `narsil`.

Vale a pena notar três coisas nessa tabela:

- **As duas chaves de API, as que custam dinheiro, nunca tocam o bot.** A barriga só conversa com o seu servidor na LAN; o servidor guarda as chaves. Um bot roubado não consegue gerar uma conta da Anthropic ou da OpenAI.
- **A cabeça não guarda nada.** O firmware dela tem a arte da Narsil e o código da UART. Qualquer pessoa pode ler a flash dela e não descobrir nada (o guia 10 explica por que ela foi mantida assim).
- **O repositório não guarda nada.** Nenhum tópico, token, chave ou endereço aparece em `davshn/narsil-bot`. O firmware é público, e é por isso.

### Por que a NVS, e o que a NVS protege

A NVS (non-volatile storage, armazenamento não volátil) é o armazenamento de chave-valor do ESP-IDF numa partição da flash; a classe `Settings` do Xiaozhi (`main/settings.h`) é uma camada fina sobre ela. Na barriga, a partição se chama `nvs` nas tabelas de partição do Xiaozhi (`partitions/v2/32m.csv` lhe dá 840 KB).

Por padrão, a NVS **não é criptografada**. O `CONFIG_NVS_ENCRYPTION` do ESP-IDF vem ativado por padrão só quando a criptografia da flash está ativada, e o Xiaozhi não a ativa. Então qualquer pessoa com a placa nas mãos e um cabo USB pode ler a flash com o esptool e encontrar nela a senha do Wi-Fi, o tópico e o token em texto puro. Para um bot que fica na sua própria mesa, esse é um risco aceitável para a maioria das pessoas, desde que você saiba disso e saiba como revogar as coisas (abaixo). Se o bot viaja, fica num escritório ou sai das suas mãos, existem as opções abaixo.

### Criptografia da NVS no ESP32-P4

A [página de criptografia da NVS](https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/api-reference/storage/nvs_encryption.html) do ESP-IDF descreve dois esquemas para este chip. Os dois usam XTS-AES, e a ajuda do Kconfig diz que ele criptografa "the complete NVS data, except the page headers" (todos os dados da NVS, exceto os cabeçalhos de página).

| Esquema                          | Onde as chaves vivem                                                                         | Precisa de criptografia da flash | Custo                                                                    |
| -------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------ |
| Baseado na criptografia da flash | Uma partição `nvs_keys` (data, subtipo `nvs_keys`, marcada `encrypted`, com pelo menos 4 KB) | Sim                              | Tudo o que a criptografia da flash custa (próxima seção)                 |
| Baseado no periférico HMAC       | Derivadas em tempo de execução de uma chave HMAC no eFuse; nunca guardadas na flash          | Não                              | Queima um bloco de chave do eFuse para sempre, com o propósito `HMAC_UP` |

As opções são `CONFIG_NVS_ENCRYPTION`, e `CONFIG_NVS_SEC_KEY_PROTECTION_SCHEME` para escolher entre `CONFIG_NVS_SEC_KEY_PROTECT_USING_FLASH_ENC` e `CONFIG_NVS_SEC_KEY_PROTECT_USING_HMAC`. Para o HMAC, `CONFIG_NVS_SEC_HMAC_EFUSE_KEY_ID` deve indicar o bloco do eFuse (0 a 5; o padrão, -1, não compila). Com a criptografia ativada, `nvs_flash_init()` configura a partição padrão criptografada e gera as suas chaves, então o código do Xiaozhi não muda.

O esquema HMAC é o mais leve: a página diz que ele permite "secure storage on ESP32-P4 without enabling flash encryption" (armazenamento seguro no ESP32-P4 sem ativar a criptografia da flash). Ele protege contra alguém que leia o chip de flash. Ele não impede, por si só, que alguém capaz de gravar um novo firmware na placa rode código que use a mesma chave do eFuse; é para isso que serve o secure boot.

### Criptografia da flash, e as suas contrapartidas

A [criptografia da flash](https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/security/flash-encryption.html) criptografa o firmware e os dados na flash, de modo que "physical readout of flash will not be sufficient to recover most flash contents" (a leitura física da flash não será suficiente para recuperar a maior parte do seu conteúdo). Ela é ativada com `CONFIG_SECURE_FLASH_ENC_ENABLED` e vem em dois modos:

- **Modo de desenvolvimento** (o padrão) ainda deixa você gravar um novo firmware em texto puro pelo USB; o bootloader o criptografa. Ele pode ser desativado de novo, mas só uma vez por chip.
- **Modo de release** impede o bootloader USB de fazer operações de criptografia da flash; um novo firmware só chega por OTA. Escolher Release no menuconfig não queima os eFuses por si só; `esp_flash_encryption_set_release_mode()` queima.

A mesma página é clara sobre os seus limites: a criptografia da flash "alone may not prevent an attacker from modifying the firmware of the device" (sozinha pode não impedir que um atacante modifique o firmware do dispositivo), ela não esconde o layout da flash, e a página recomenda o secure boot junto com ela. E ela muda a forma como você trabalha: uma imagem em texto puro gravada por engano numa placa criptografada a deixa num laço de reinicialização, um soft-brick. Para um bot de hobby que é regravado toda noite, esse é um custo real.

O bot vem sem nenhuma das duas. Ele mantém fora da placa os segredos que mais importam (as chaves de API), usa um token do GitHub só de leitura e com validade, e trata o conteúdo da placa como revogável. Criptografar a NVS com HMAC é o passo a dar se a placa sair da sua mesa.

### O que sai da sua rede

| O quê                                         | Vai para                        | Por quê                                        |
| --------------------------------------------- | ------------------------------- | ---------------------------------------------- |
| A sua voz, como áudio                         | OpenAI (`api.openai.com`)       | O `OpenaiASR` a transforma em texto (guia 4)   |
| O que você disse, como texto, e o histórico   | Anthropic (`api.anthropic.com`) | O Claude escreve a resposta da Narsil (guia 5) |
| As respostas da Narsil, como texto            | Microsoft                       | O `EdgeTTS` as transforma em fala (guia 6)     |
| Uma assinatura dos seus tópicos do ntfy       | ntfy.sh                         | Os alertas da Narsil (guia 7)                  |
| O seu token do GitHub e uma consulta de busca | GitHub (`api.github.com`)       | Os seus pull requests (guia 8)                 |

Convém ter precisão sobre a voz. A palavra de ativação é reconhecida na própria barriga, com o ESP-SR, então nada é transmitido antes de você dizer "Hi ESP". Depois dela, a barriga transmite o que os microfones ouvem para o seu servidor, na LAN. O servidor não mantém esse áudio em casa: com o `OpenaiASR`, cada coisa que você diz é enviada **como áudio** para o endpoint de transcrição da OpenAI (`base_url: https://api.openai.com/v1/audio/transcriptions` no `config.yaml`), e o texto volta. O guia 4 lista a alternativa offline: o `VoskASR`, que roda no PC com um modelo baixado, mantém o áudio na sua rede, com algum custo em precisão.

Cada provedor trata esses dados segundo os seus próprios termos para uso da API; leia os [da Anthropic](https://www.anthropic.com/legal/commercial-terms) e os da OpenAI antes de decidir. O EdgeTTS não precisa de conta, o que também significa que nenhum acordo seu cobre o que ele recebe.

O ntfy.sh vê o endereço IP da barriga e o nome dos tópicos que ela segue. Sem chave, ele também vê o texto de cada alerta; com `/narsil movil clave`, ele vê só o tipo, a hora e o estágio (guia 7). O GitHub vê o token, a consulta e a resposta, por HTTPS.

### O que fica na sua rede

- O áudio entre a barriga e o seu servidor, por WebSocket na LAN. É `ws://` simples, não TLS, então ele é tão privado quanto a sua rede: mantenha o bot no Wi-Fi da sua casa, não num compartilhado.
- A UART entre barriga e cabeça, três fios dentro do bot.
- A verificação de OTA, que vai para o endereço do seu servidor. Um detalhe importa aqui: se a URL de OTA salva for inválida, o Xiaozhi volta para o `CONFIG_OTA_URL`, o serviço oficial em `api.tenclass.net` (guia 3). O monitor diz "Ignoring invalid saved OTA URL; using the default" (ignorando a URL de OTA salva inválida; usando o padrão) quando isso acontece; se você vir isso, corrija a URL.

### Apagar o bot

Três níveis, do mais leve ao completo:

- **Só os segredos da Narsil.** Um botão "Forget" (esquecer) na tela de configurações do guia 9 que chame `Settings("narsil", true).EraseAll()` apaga o tópico e o token, e nada mais.
- **Tudo na barriga.** A partir do Windows, com a barriga na sua porta USB (guia 2):

  ```powershell
  esptool --port COM5 erase-flash
  ```

  Isso apaga a flash inteira: firmware, NVS, senha do Wi-Fi, endereço do servidor, tópico e token. Grave o firmware de novo depois (guia 3); então a barriga inicia na configuração do Wi-Fi como uma nova. O equivalente a partir do ESP-IDF é `idf.py erase-flash`.

- **A cabeça.** Ela não guarda segredos, então não há nada para apagar. O mesmo `erase-flash` na porta dela remove o firmware se você der a placa para alguém.

### Revogar cada credencial

Apagar a placa protege a placa. Revogar a credencial protege você mesmo quando a placa se foi. Se o bot for perdido ou roubado, ou a flash tiver sido lida, faça tudo isto, começando pelo token:

| Credencial         | Como revogá-la                                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Token do GitHub    | [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens), **Delete** ao lado do token (guia 8).        |
| Tópico do ntfy     | `/narsil movil nuevo` no Claude Code cria um novo tópico; o antigo deixa de receber. Digite o novo na barriga.                                 |
| Senha do Wi-Fi     | Troque-a no roteador. Todo dispositivo precisa da nova, e é por isso que ela vem depois das outras.                                            |
| Chave da Anthropic | Apague-a no [Claude Console](https://platform.claude.com/settings/keys) (guia 5). Ela nunca esteve no bot; troque-a se o PC estiver envolvido. |
| Chave da OpenAI    | Apague-a na página de chaves de API da OpenAI. A mesma regra: ela vive no PC.                                                                  |

## Construa com o Claude

Peça ao Claude um mapa dos segredos e dos dados do bot: onde cada segredo vive, o que sai da sua rede e como apagar a placa e revogar cada credencial. A única ideia que ele precisa acertar é que as chaves de API pagas nunca tocam o bot, e que tudo o que a placa guarda pode ser revogado na sua origem.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é a conversa usada para construir o bot.

> O meu bot de mesa é um ESP32-P4 rodando um fork do 78/xiaozhi-esp32, que conversa com o xinnan-tech/xiaozhi-esp32-server no meu PC com OpenaiASR, um provedor do Claude e EdgeTTS, além do ntfy.sh e da API REST do GitHub a partir da placa. Liste cada segredo que ele guarda e onde (leia o `main/settings.h`, o `main/ota.cc` e o `ssid_manager.cc` do esp-wifi-connect para os namespaces da NVS), tudo o que sai da minha rede e para quem, e o que fica na LAN. Depois explique os esquemas de criptografia da NVS do ESP-IDF 6 para o ESP32-P4 e a criptografia da flash, citando a documentação deles, com as contrapartidas para um dispositivo de hobby que eu regravo com frequência. Termine com como apagar a placa e revogar cada credencial.

### O que conferir na resposta do Claude

1. Cada segredo tem o seu lugar: as configurações de Wi-Fi, a URL de OTA, as configurações do WebSocket, o tópico ntfy e o token do GitHub na NVS da barriga; as chaves da Anthropic e da OpenAI só no seu PC; nada na cabeça e nada no repositório.
2. Diz com clareza que a NVS não é criptografada por padrão, então qualquer pessoa com a placa e um cabo USB pode ler o tópico e o token como texto simples.
3. A sua lista do que sai da sua rede nomeia a sua voz como áudio para a OpenAI, as suas palavras para a Anthropic, as respostas da Narsil para a Microsoft pelo EdgeTTS, a assinatura do tópico para o ntfy.sh e o token com a busca para o GitHub. O áudio entre a barriga e o servidor fica na rede local por `ws://` simples, então o bot pertence ao Wi-Fi da sua casa, não a um compartilhado.
4. Dá os dois esquemas de criptografia da NVS para o ESP32-P4 com o seu custo: o esquema HMAC queima um bloco de chave eFuse para sempre, e com a criptografia da flash uma imagem em texto simples gravada por engano deixa a placa inutilizável até ser recuperada.
5. Revoga cada credencial na sua origem, começando pelo token: **Delete** na página de tokens do GitHub, `/narsil movil nuevo` para o tópico, o roteador para a senha do Wi-Fi e cada chave de API na página do seu provedor.

Se uma verificação falhar, diga ao Claude o que você vê: "o plano só apaga a flash e nunca diz como revogar o token do GitHub".

### Como a pessoa autora pediu

A regra por trás deste guia veio da decisão sobre onde o firmware vive. A IA perguntou se o código do bot deveria ir num repositório próprio, e a pessoa autora respondeu:

> repo propio como fork

Tradução para o português: "repositório próprio, como fork".

Depois a IA perguntou se esse repositório seria público desde o início ou privado, e a pessoa autora escolheu a primeira opção:

> 1

Um repositório público muda tudo sobre os segredos: qualquer coisa que entra num commit é publicada. Por isso a IA definiu a regra escrita como especificação S6, de que o token do GitHub, o tópico do ntfy, a chave e o endereço do servidor vivem na NVS ou na configuração local, nunca no repositório, e todos os guias desde então a seguiram.

Onde a voz é processada tinha sido decidido antes, com a mesma consequência para as chaves de API:

> servidor propio

Tradução para o português: "servidor próprio". E onde ele roda:

> en el pc, igual la idea es usarlo para trabajar con claude

Tradução para o português: "no PC; de qualquer forma, a ideia é usá-lo para trabalhar com o Claude".

É por isso que as chaves pagas ficam no PC. Qual reconhecedor usar foi decisão da IA, a partir da documentação do servidor; ela escolheu o `OpenaiASR` porque o reconhecedor offline padrão não suporta espanhol, e este guia é onde essa escolha é explicada como áudio saindo da rede.

## Código de referência

Esta é uma resposta correta, escrita para este guia. Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

O bot não precisa de código novo para este guia. A única peça opcional é o botão "Forget", acrescentado à tela de configurações do guia 9 ao lado de "Back":

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

O `EraseAll` faz parte da classe `Settings` do Xiaozhi; ele apaga todas as chaves do namespace `narsil`, e o destrutor confirma a gravação antes da reinicialização.

Se você escolher criptografar a NVS com o esquema HMAC, a mudança é de configuração, não de código. No `idf.py menuconfig`, ative `CONFIG_NVS_ENCRYPTION`, escolha `CONFIG_NVS_SEC_KEY_PROTECT_USING_HMAC` e defina `CONFIG_NVS_SEC_HMAC_EFUSE_KEY_ID` como um bloco livre do eFuse. Leia primeiro a página de criptografia da NVS: o bloco do eFuse fica usado para sempre, e a NVS escrita antes da mudança não é legível depois dela, então apague a flash e configure o bot de novo.

## Erros comuns e como testar

- **Um segredo num commit.** Antes de cada push para o repositório público, procure no diff por `github_pat_`, `narsil-`, `sk-ant-` e o seu endereço da LAN. Um token real num arquivo de teste é um vazamento; use valores inventados como `github_pat_EXAMPLE_not_a_real_token`.
- **Segredos no log.** Nunca imprima o token, o tópico ou a senha do Wi-Fi, nem durante a depuração: um log do monitor colado numa issue os publica.
- **`sdkconfig` com as suas configurações.** Se você puser o endereço do servidor no `CONFIG_OTA_URL` em vez de no portal, ele acaba no `sdkconfig`, e dali num commit. O guia 3 o salva no dispositivo por esse motivo.
- **Revogar só uma coisa.** Um bot perdido guarda o token, o tópico e a senha do Wi-Fi. Revogue os três.

Para testar o que a placa guarda, leia a NVS dela de volta e olhe. Com a barriga na COM5, `esptool --port COM5 read-flash 0 ALL belly.bin` copia a flash; procure o seu tópico no arquivo. Com a NVS sem criptografia, ele está lá em texto puro; com o esquema HMAC, não está. Apague o `belly.bin` depois: ele contém os seus segredos.

Para testar o que sai da rede, acompanhe o log do seu servidor (guia 4) enquanto fala: o texto reconhecido aparece depois de cada frase, que é o momento em que o áudio foi para a OpenAI. Desligue a internet do PC e fale de novo: a barriga ainda se conecta ao servidor na LAN, mas o reconhecimento falha, o que mostra que o áudio não tinha para onde ir localmente.

## Para ir além

- **Reconhecimento offline.** O `VoskASR` no servidor mantém a sua voz na sua rede; confira o modelo em espanhol dele e compare a precisão com o `OpenaiASR`.
- **O seu próprio servidor ntfy.** Rodar o ntfy em casa com controle de acesso tira o tópico da internet pública. O narsil-pet publica em `https://ntfy.sh`, então os dois lados mudariam (guia 7).
- De volta ao início do caminho: as peças e a fiação estão no [guia 1](/pt/bot/the-bot/).
