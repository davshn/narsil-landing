---
title: O seu próprio servidor
description: 'Rodar o xiaozhi-esp32-server da xinnan-tech no modo mínimo com Docker no seu PC, só na rede local: a sua configuração, as suas portas e como a barriga o encontra.'
route: bot
order: 4
updated: 2026-11-18
---

## O que faz

O Xiaozhi na barriga não entende a fala nem pensa. Ele grava, comprime e reproduz. Escutar, pensar e falar acontecem num servidor: por padrão o oficial, em xiaozhi.me, e neste bot, um servidor no seu próprio PC.

Esse servidor é o [xinnan-tech/xiaozhi-esp32-server](https://github.com/xinnan-tech/xiaozhi-esp32-server), o servidor em Python que o README do Xiaozhi lista em primeiro lugar para implantação em computadores pessoais. Para cada conversa, ele:

1. Recebe o áudio da barriga por WebSocket.
2. Detecta onde você começa e para de falar (detecção de atividade de voz).
3. Transforma a sua fala em texto (reconhecimento de fala, ASR).
4. Envia o texto para um modelo de linguagem (LLM). Neste bot, o Claude, a partir do guia 5.
5. Transforma a resposta em fala (síntese, TTS) e a transmite de volta.

Ele também responde à requisição de OTA da barriga, que é como a barriga descobre onde está o WebSocket (guia 3).

O bot o roda no **modo mínimo** do projeto, que o README em inglês chama de "Simplified Installation" (instalação simplificada): um agente, dados guardados em arquivos de configuração, sem banco de dados e sem console web. Ele roda no Docker no PC em que você trabalha, e só pode ser alcançado a partir da sua rede local.

## Como funciona por dentro

### Por que só na sua rede local

O README do projeto é direto sobre a sua maturidade. A sua tradução para o inglês diz que o projeto "has not passed network security assessment" (não passou por avaliação de segurança de rede), pede que você não o use em produção e pede medidas de proteção se você o implantar numa rede pública para aprender. O original em chinês diz o mesmo: "未通过网络安全测评".

O bot adota a leitura segura: o servidor nunca fica exposto à internet. Nenhuma porta é redirecionada no roteador, e só os dispositivos da sua rede conseguem alcançá-lo. A configuração padrão combina com esse uso: a autenticação vem desligada (`server.auth.enabled: false`), o que é aceitável numa rede doméstica e não na internet.

### Módulos: o que cada etapa usa

O `main/xiaozhi-server/config.yaml` escolhe um provedor por etapa em `selected_module`. Os padrões:

| Etapa                  | Chave    | Padrão          | Notas do `config.yaml`                             |
| ---------------------- | -------- | --------------- | -------------------------------------------------- |
| Atividade de voz       | `VAD`    | `SileroVAD`     | Modelo local                                       |
| Reconhecimento de fala | `ASR`    | `FunASR`        | Local, offline, modelo SenseVoiceSmall             |
| Modelo de linguagem    | `LLM`    | `ChatGLMLLM`    | Precisa de uma chave; o guia 5 o troca pelo Claude |
| Modelo de visão        | `VLLM`   | `ChatGLMVLLM`   | Não é usado pelo bot                               |
| Síntese de fala        | `TTS`    | `EdgeTTS`       | Voz `zh-CN-XiaoxiaoNeural` por padrão              |
| Memória                | `Memory` | `nomem`         | Sem memória entre conversas                        |
| Intenção               | `Intent` | `function_call` | O modelo chama as ferramentas diretamente          |

Cada nome aponta para um bloco de mesmo nome mais abaixo no arquivo (`ASR.FunASR`, `TTS.EdgeTTS` e assim por diante) com as configurações desse provedor.

### `config.yaml` e `data/.config.yaml`

Os comentários no topo do `config.yaml` dão a regra: crie `data/.config.yaml` e coloque ali as suas mudanças, não no `config.yaml`. O servidor lê primeiro o `data/.config.yaml` e pega do `config.yaml` tudo o que faltar. O guia de implantação chama isso de forma mais concisa, e o comentário acrescenta por que isso importa: mantém as suas chaves fora do arquivo do próprio projeto.

Para o bot, isso significa que o `data/.config.yaml` guarda só o que difere dos padrões: o endereço do WebSocket, o fuso horário, os provedores escolhidos e as suas chaves. Ele vive no seu PC, fora de qualquer repositório.

### Portas

O `docker-compose.yml` do projeto publica duas portas:

| Porta | Configuração       | O que serve                                                               |
| ----- | ------------------ | ------------------------------------------------------------------------- |
| 8000  | `server.port`      | O WebSocket com que a barriga conversa, em `/xiaozhi/v1/`                 |
| 8003  | `server.http_port` | HTTP: a interface de OTA simples em `/xiaozhi/ota/`, e a análise de visão |

O servidor escuta em `0.0.0.0` (`server.ip`), o que significa todas as interfaces de rede do contêiner. O Docker publica essas portas no PC.

### Como a barriga o encontra

Dois endereços importam, ambos formados a partir do endereço do seu PC na rede local (aqui o inventado `192.168.1.50`):

- **URL de OTA:** `http://192.168.1.50:8003/xiaozhi/ota/`. Você a digita na barriga uma vez, na aba Advanced (avançado) do portal de Wi-Fi (guia 3).
- **URL do WebSocket:** `ws://192.168.1.50:8000/xiaozhi/v1/`. O servidor a envia para a barriga na sua resposta de OTA.

A segunda exige cuidado no Docker. O servidor monta o endereço do WebSocket por conta própria só enquanto `server.websocket` ainda tem o valor de exemplo do `config.yaml` (`ws://你的ip或者域名:端口号/xiaozhi/v1/`, "o seu IP ou domínio : número da porta"). Dentro de um contêiner, o endereço que ele enxerga é o do contêiner, não o do seu PC. O [guia de implantação](https://github.com/xinnan-tech/xiaozhi-esp32-server/blob/main/docs/Deployment.md) avisa que, com Docker, os endereços no log de inicialização não são os reais, e que o método certo é usar o endereço do PC na rede local. Por isso o bot define `server.websocket` explicitamente, e o tratador de OTA passa a enviar exatamente esse valor. Como nenhum `mqtt_gateway` está configurado, ele envia um objeto `websocket`, que é o que seleciona o WebSocket na barriga.

Mais uma configuração acompanha essa: `server.timezone_offset`, o fuso horário que a resposta de OTA informa à barriga. O padrão `+8` é o horário da China; defina o seu.

### Local ou API: escolher o reconhecimento e a síntese de fala

Cada etapa pode rodar no seu PC ou chamar uma API na nuvem. O `config.yaml` documenta os dois tipos:

| Tipo  | Reconhecimento de fala (ASR)                              | Síntese de fala (TTS)                                                                                           |
| ----- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Local | `FunASR` (padrão), `SherpaASR`, `VoskASR` (offline)       | `FishSpeech`, `PaddleSpeechTTS`, `IndexStreamTTS`, `GPT_SOVITS_V2` (cada um precisa da sua própria implantação) |
| API   | `OpenaiASR`, `GroqASR`, `AliyunASR`, `DoubaoASR` e outros | `OpenAITTS`, `AliyunTTS`, `DoubaoTTS` e outros                                                                  |

As trocas:

- **O local mantém a sua voz em casa e não custa nada por uso**, mas usa a memória e a CPU do seu PC. O README observa que rodar o `FunASR` localmente consome mais memória, e que usar APIs para tudo mantém baixo o uso de recursos.
- **O idioma importa.** A Narsil fala espanhol. O comentário do bloco `FunASR` lista as etiquetas de idioma que o SenseVoice suporta como zh, en, ja, ko e yue, então para o espanhol o bot usa outro reconhecedor. O `OpenaiASR` (modelo `gpt-4o-mini-transcribe` por padrão) e o `GroqASR` (`whisper-large-v3-turbo`) são APIs multilíngues; o `VoskASR` é offline e suporta vários idiomas com um modelo baixado.
- **Uma API envia o seu áudio para fora da sua rede** e precisa de uma chave. O guia 12 lista o que sai da rede e por quê.

O bot usa o `OpenaiASR` para o reconhecimento e mantém o `EdgeTTS` para a síntese, que não precisa de chave no `config.yaml`. A voz da Narsil em si, e a configuração `voice`, são o guia 6.

### Sem o servidor, só a voz para

O servidor faz um trabalho: a voz. A barriga se conecta ao ntfy e ao GitHub por conta própria (guias 7 e 8), e a cabeça desenha o que a barriga lhe envia. Se o seu PC estiver desligado, ou o Docker estiver parado, os alertas da Narsil, os seus pull requests e o rosto dela continuam funcionando. Só a palavra de ativação não leva a lugar nenhum até o servidor voltar.

## Como foi pedido à IA

A decisão de rodar um servidor veio no guia 3: a pessoa autora escolheu "servidor propio", um servidor próprio, em vez do xiaozhi.me. A IA então propôs este servidor no modo mínimo, com Docker, só na rede local, e perguntou de novo antes de seguir. A pessoa autora confirmou:

> vamos con el propio de una

Tradução para o português: "vamos com o próprio, de uma vez".

A pergunta seguinte foi onde ele rodaria: no PC, ou em outra máquina da casa. A resposta:

> en el pc, igual la idea es usarlo para trabajar con claude

Tradução para o português: "no PC; de qualquer forma, a ideia é usá-lo para trabalhar com o Claude".

Essa segunda resposta explica duas coisas neste guia. O servidor roda no Docker no PC em que a pessoa autora já trabalha, então nada novo precisa ficar ligado. E o Claude é o cérebro: a decisão seguinte, registrada como a especificação S5, escolheu a opção "1", um provedor nativo da Anthropic escrito em Python com o Anthropic SDK, em vez de um endpoint compatível com a OpenAI. O guia 5 o constrói.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é a conversa usada para configurar o bot.

> Quero rodar o xinnan-tech/xiaozhi-esp32-server no seu modo mínimo com Docker no meu PC com Windows, acessível só a partir da minha rede local, para um dispositivo Xiaozhi. Leia o README do projeto, `docs/Deployment.md`, `main/xiaozhi-server/config.yaml` e `docker-compose.yml`, e depois me dê: a estrutura de pastas, um `data/.config.yaml` que sobrescreva só o que eu preciso (endereço do WebSocket com o meu IP da rede local, fuso horário, um reconhecedor de fala que entenda espanhol), os comandos para iniciá-lo e ler os seus logs, e a URL de OTA que devo dar ao dispositivo. Cite o aviso de segurança do projeto e me diga quais portas ele abre.

## O código mínimo

A pasta no PC, segundo o guia de implantação:

```text
xiaozhi-server
├─ docker-compose.yml
├─ data
│  └─ .config.yaml
└─ models
   └─ SenseVoiceSmall
      └─ model.pt
```

O `docker-compose.yml` é o arquivo do próprio projeto, baixado de `main/xiaozhi-server/`. O arquivo compose monta `models/SenseVoiceSmall/model.pt` dentro do contêiner, então o guia de implantação manda você baixar esse modelo (do ModelScope ou do Baidu) mesmo que o bot reconheça a fala por uma API.

O `data/.config.yaml`, com um endereço e uma chave inventados:

```yaml
server:
  websocket: ws://192.168.1.50:8000/xiaozhi/v1/
  timezone_offset: -5

selected_module:
  ASR: OpenaiASR
  TTS: EdgeTTS

ASR:
  OpenaiASR:
    api_key: sk-EXAMPLE-not-a-real-key
```

Só a `api_key` é definida em `OpenaiASR`; o resto desse bloco (`type`, `base_url`, `model_name`) vem do `config.yaml`. Use o deslocamento do seu próprio fuso horário. A seção `LLM` chega no guia 5; até lá o servidor continua selecionando o `ChatGLMLLM` padrão, que segundo o guia de implantação precisa da sua chave para iniciar.

Inicie-o a partir da pasta `xiaozhi-server` e acompanhe o seu log:

```powershell
docker compose up -d
docker logs -f xiaozhi-esp32-server
```

A imagem é `ghcr.nju.edu.cn/xinnan-tech/xiaozhi-esp32-server:server_latest`, o contêiner se chama `xiaozhi-esp32-server` e `restart: always` o traz de volta depois de uma reinicialização do Docker.

## Erros comuns e como testar

- **Editar o `config.yaml` em vez do `data/.config.yaml`.** As suas mudanças se misturam com o arquivo do projeto e se perdem no próximo download. Coloque-as no `data/.config.yaml`.
- **Confiar nos endereços do log do Docker.** Eles são os do contêiner. Use o endereço do seu PC na rede local em `server.websocket` e na URL de OTA da barriga.
- **Redirecionar a 8000 ou a 8003 no roteador.** O projeto não passou por avaliação de segurança e a autenticação vem desligada por padrão. Mantenha-o na sua rede.
- **O firewall do PC.** Se a barriga não consegue alcançar o servidor mas o navegador do próprio PC consegue, permita conexões de entrada nas portas 8000 e 8003 a partir da sua rede privada.
- **Um endereço do PC que muda.** Se o seu roteador der um novo endereço ao PC, a URL de OTA da barriga e o `server.websocket` ficam os dois desatualizados. Uma reserva de DHCP no roteador mantém o endereço fixo.
- **Atualizar sobrescrevendo o `.config.yaml`.** Os passos de atualização do guia de implantação dizem para fazer uma cópia de segurança dele e copiar as suas chaves uma a uma para o novo, porque um novo `config.yaml` pode trazer novas configurações.

Para testar, abra a URL de OTA num navegador no PC, por exemplo `http://192.168.1.50:8003/xiaozhi/ota/`. O guia de firmware da xinnan-tech diz que um servidor que funciona responde "OTA接口运行正常" ("a interface de OTA está funcionando normalmente") seguido do endereço do WebSocket que ele envia aos dispositivos. Se esse endereço mostrar o seu IP da rede local e a porta 8000, a barriga vai encontrá-lo. Depois diga a palavra de ativação e observe `docker logs -f xiaozhi-esp32-server`: você deve ver a barriga se conectar e o texto que ele ouviu.

## Para ir além

- A instalação completa por módulos acrescenta um banco de dados, várias pessoas usuárias e agentes, e um console web. O bot não precisa dela, e o seu endereço de OTA é diferente (o guia de firmware usa a porta 8002 para ela).
- O servidor pode servir atualizações de firmware para a barriga a partir da sua pasta `data/bin`, como descreve o guia de atualização por OTA do projeto (`docs/ota-upgrade-guide.md`).
- O `server.auth` pode exigir um token, com `allowed_devices` listando os endereços MAC que pulam a verificação. É uma camada útil mesmo numa rede doméstica.
- A maioria dos blocos de provedor no `config.yaml` traz comentários, em chinês, sobre onde obter a chave e, para alguns, quanto custa; leia o do provedor que escolher antes de se comprometer com ele.
- O guia 5 acrescenta o `LLM` que faz a Narsil pensar com o Claude, e o guia 6 dá a ela uma voz e uma personalidade.
