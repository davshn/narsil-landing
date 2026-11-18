---
title: A personalidade e a voz da Narsil
description: 'Quem a Narsil é quando fala: o caráter dela no prompt do servidor, respostas curtas para uma voz, respostas em espanhol, uma voz do Edge em espanhol e os outros padrões chineses em espanhol.'
route: bot
order: 6
updated: 2026-11-18
---

## O que faz

Depois do guia 5, o Claude responde pela barriga, mas com o caráter padrão do servidor: o `prompt` de exemplo do projeto descreve uma garota falante de Taiwan, em chinês, e a voz padrão é chinesa. Este guia dá ao bot o caráter próprio da Narsil, o mesmo que ela tem no [Narsil for Claude Code](https://github.com/davshn/narsil-pet), e uma voz em espanhol para dizê-lo.

Quatro configurações no `data/.config.yaml` fazem o trabalho:

- `prompt`: quem a Narsil é e como ela fala.
- `TTS.EdgeTTS.voice`: a voz que fala as respostas dela.
- `TTS.EdgeTTS.language`: o idioma em que toda resposta é escrita.
- `system_error_response`, `end_prompt` e `exit_commands`: as frases e os comandos fixos do servidor, que são em chinês por padrão.

## Como funciona por dentro

### Onde o caráter entra

O servidor não envia o `prompt` ao modelo por conta própria. O `core/utils/prompt_manager.py` lê um modelo, `agent-base-prompt.txt` por padrão (a configuração `prompt_template`), e monta o prompt de sistema a partir dele. O modelo, em inglês, começa com regras gerais para um assistente de voz e depois coloca o seu `prompt` dentro de uma seção `<identity>`, onde ele substitui `{{base_prompt}}`. Outros marcadores preenchem a data, o lugar, o clima e, no final, uma seção `<context>` com a hora atual (o guia 5 explica por que essa seção fica fora do cache).

Então o `prompt` só precisa dizer quem a Narsil é. O modelo já pede o resto: ir direto ao ponto, tolerar erros do reconhecimento de fala, não empilhar perguntas.

### Quem é a Narsil

O caráter da Narsil vem do repositório narsil-pet (GPL-3.0-or-later), e o bot o mantém para que a Narsil da mesa e a que fica acima do seu prompt sejam a mesma. Do README dele e de `hooks/words.ts`:

- Ela é uma serpente marinha chibi. O nome dela vem da espada reforjada de _O Senhor dos Anéis_, e o README diz que ela está ali "para cortar bugs".
- A voz dela é descrita num comentário em `hooks/words.ts`: espanhol latino-americano neutro, "a calm, warm assistant who works beside you: composed, a little playful, never servile" (uma assistente calma e calorosa que trabalha ao seu lado: serena, um pouco brincalhona, nunca servil). Ela fala de si mesma na primeira pessoa, nunca pelo nome.
- Os comentários dela pegam imagens emprestadas do mar: ela flutua, mergulha numa ideia, encontra coisas "como una perla" ("como uma pérola").
- Ela cresce em cinco estágios com a experiência que ganha, e relata o que o Claude está fazendo em frases simples: trabalhando, esperando por você, pronto, ou parado por um erro.

O `prompt` do bot transforma esses pontos em instruções. Ele é escrito em inglês, como o modelo em volta dele; o idioma das respostas é definido à parte.

### Curto, para o ouvido

Uma resposta por voz é ouvida uma vez, na velocidade da fala. As frases faladas da Narsil no narsil-pet são uma ou duas frases curtas, como "Listo, ya quedó." ("Pronto, já ficou."). O prompt pede o mesmo: no máximo duas frases, a menos que você peça mais, sem listas, sem Markdown, sem código lido em voz alta, e números ditos do jeito que uma pessoa os diria. As regras do próprio modelo, como a sua lista de emojis permitidos, ficam como estão.

### O idioma de toda resposta

O modelo tem uma regra estrita: toda resposta é escrita em `{{language}}`, qualquer que seja o idioma em que você fala. O gerenciador de prompts a preenche a partir da configuração `language` do bloco de TTS selecionado, e recorre a `中文` (chinês) quando ela falta. É por isso que o bot define `language` sob `TTS.EdgeTTS`, como `Spanish`, a palavra que o modelo em inglês lê melhor.

### A voz

O `EdgeTTS` usa o serviço de fala on-line do Microsoft Edge por meio do pacote Python `edge-tts`; o provedor do servidor (`core/providers/tts/edge.py`) passa a `voice` configurada direto para `edge_tts.Communicate`. O padrão é `zh-CN-XiaoxiaoNeural`.

A Narsil fala espanhol latino-americano neutro, então o bot usa `es-MX-DaliaNeural`, uma voz feminina para espanhol (México) na [lista de vozes de fala](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts) da Microsoft. O Edge oferece um subconjunto dessa lista; o `edge-tts --list-voices`, do [README do edge-tts](https://github.com/rany2/edge-tts), imprime as vozes que ele de fato pode usar, então confira a sua escolha ali. `es-CO-SalomeNeural` e `es-US-PalomaNeural` são outras vozes femininas latino-americanas da lista da Microsoft.

O EdgeTTS não precisa de chave, mas é um serviço on-line: as respostas da Narsil, como texto, vão para a Microsoft para serem faladas. O [guia 12](/pt/bot/secrets-privacy/) lista o que sai da sua rede.

### As frases próprias do servidor

Algumas frases não vêm do Claude, e estão em chinês no `config.yaml`:

| Configuração            | O que é                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| `system_error_response` | O que o servidor diz quando algo falha ("主人，小智现在有点忙…", "Mestre, o Xiaozhi está ocupado…") |
| `end_prompt.prompt`     | A instrução para a despedida quando uma conversa termina                                            |
| `exit_commands`         | Palavras que encerram a conversa: `退出` ("sair") e `关闭` ("fechar")                               |

O bot substitui as três. A frase de erro é falada como está escrita, então fica em espanhol; a despedida é uma instrução para o modelo, então pode ficar em inglês.

### A palavra de ativação

A palavra de ativação é escutada na barriga, não no servidor. O `scripts/build.py` do Xiaozhi escolhe "Hi ESP" para uma compilação em espanhol (guia 3), e o bot a mantém. O `Kconfig.projbuild` do Xiaozhi também oferece uma palavra de ativação personalizada no ESP32-P4 (`USE_CUSTOM_WAKE_WORD`, com a frase em `CUSTOM_WAKE_WORD`), por meio do modelo MultiNet do ESP-SR; o texto de ajuda dele pede pinyin para frases em chinês. "Para ir além" tem mais.

## Construa com o Claude

Peça ao Claude o `prompt` da Narsil e as linhas de `data/.config.yaml` que lhe dão respostas em espanhol e uma voz em espanhol. A única ideia que ele precisa acertar é que o caráter, o idioma das respostas e a voz são três configurações separadas: `prompt`, `TTS.EdgeTTS.language` e `TTS.EdgeTTS.voice`.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é a conversa usada para construir o bot.

> O meu dispositivo Xiaozhi conversa pelo xinnan-tech/xiaozhi-esp32-server com o Claude como LLM. Leia o `agent-base-prompt.txt` e o `core/utils/prompt_manager.py` do servidor para ver onde a configuração `prompt` entra e como `{{language}}` é preenchido. Depois escreva um `prompt` para a minha personagem, uma serpente marinha calma e calorosa que responde em no máximo duas frases curtas para uma voz, e as linhas do `data/.config.yaml` que definem respostas em espanhol, uma voz de EdgeTTS em espanhol latino-americano que o `edge-tts --list-voices` liste, e versões em espanhol de `system_error_response` e `exit_commands`.

### O que conferir na resposta do Claude

1. O `prompt` só diz quem a Narsil é: uma serpente marinha calma e calorosa que fala em primeira pessoa e nunca diz o próprio nome. O modelo em volta dele já acrescenta as regras gerais.
2. Pede no máximo duas frases curtas, a menos que você peça mais, sem listas, sem Markdown e sem código lido em voz alta.
3. `language` está definido como `Spanish` sob `TTS.EdgeTTS`, o bloco nomeado em `selected_module.TTS`. Sem ele, as respostas voltam para o chinês.
4. `voice` é uma voz em espanhol latino-americano que `edge-tts --list-voices` imprime, como `es-MX-DaliaNeural`, e não a padrão `zh-CN-XiaoxiaoNeural`. O Claude não deve pedir uma chave a você: o EdgeTTS não precisa de nenhuma, mas envia as respostas, como texto, para a Microsoft.
5. `system_error_response` está em espanhol, porque é falado como está escrito, e `exit_commands` contém palavras em espanhol como `salir` em vez de `退出` e `关闭`.

Se uma verificação falhar, diga ao Claude o que você vê: "a Narsil responde em espanhol, mas com uma voz chinesa".

### Como a pessoa autora pediu

O caráter nunca foi uma pergunta, porque ficou resolvido desde a primeira mensagem. A pessoa autora descreveu a cabeça como o rosto da Narsil:

> la cabeza va a ser una apntalla holografica que solo sea la cara de narsil

Tradução para o português: "a cabeça vai ser uma tela holográfica que seja só o rosto da Narsil".

E quando a IA perguntou como a Narsil deveria falar, a pessoa autora escolheu o Xiaozhi:

> yo pensaba hacerlo con Xiaozhi

Tradução para o português: "eu pensava em fazer com o Xiaozhi".

Um rosto que é da Narsil precisa de uma voz que também seja dela. A IA não escreveu um caráter novo: leu o README do narsil-pet e o `hooks/words.ts`, e manteve o que eles dizem sobre ela. O nome da voz, o valor de `language` e a frase de erro em espanhol não foram perguntados; são escolhas da IA a partir da lista de vozes da Microsoft e do modelo do servidor, e você pode mudar qualquer uma delas.

## Código de referência

Esta é uma resposta correta, escrita para este guia. Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

As linhas que o `data/.config.yaml` acrescenta aos guias 4 e 5:

```yaml
prompt: |
  You are Narsil, a small chibi sea serpent who lives on the author's desk.
  Your name comes from the reforged sword in The Lord of the Rings: you are
  here to cut bugs. You are calm, warm and composed, a little playful, never
  servile. You speak of yourself in the first person and never say your own
  name. Now and then you borrow an image from the sea, without overdoing it.
  You answer for a voice: at most two short sentences unless asked for more,
  no lists, no Markdown, no code read aloud. Speak neutral Latin American
  Spanish, with the simple past.

system_error_response: 'Tuve un tropiezo y no pude responder. Probemos de nuevo en un momento.'

end_prompt:
  enable: true
  prompt: |
    Say a short, warm goodbye in one sentence, as Narsil would.

exit_commands:
  - 'salir'
  - 'adiós'

TTS:
  EdgeTTS:
    voice: es-MX-DaliaNeural
    language: Spanish
```

A frase de erro diz "tive um tropeço e não consegui responder; vamos tentar de novo daqui a pouco", no mesmo registro das linhas de erro do narsil-pet. Só `voice` e `language` são definidos sob `EdgeTTS`; `type` e `output_dir` vêm do `config.yaml`.

Reinicie o servidor para que ele leia o arquivo de novo:

```powershell
docker compose restart
```

## Erros comuns e como testar

- **Respostas em chinês.** O `language` está faltando ou está sob um bloco de TTS que não está selecionado. Ele precisa ficar sob o bloco nomeado em `selected_module.TTS`.
- **Respostas longas.** O Claude segue o prompt; se a Narsil fala demais, torne a regra de tamanho mais concreta ("uma ou duas frases") em vez de baixar o `max_tokens`, que corta as respostas no meio da frase.
- **Uma voz que não existe no Edge.** Uma voz da lista da Microsoft que o Edge não oferece falha na hora da síntese. Confira-a com `edge-tts --list-voices`.
- **Texto em espanhol, voz em chinês.** A `voice` ainda tem o padrão. A voz e o idioma são duas configurações separadas.
- **O nome da personagem dito em voz alta.** A Narsil do narsil-pet nunca diz o próprio nome; se o bot disser, deixe isso explícito no prompt.
- **Markdown lido em voz alta.** Asteriscos e cerquilhas viram ruído na fala. O prompt os proíbe; se ainda aparecerem, acrescente um exemplo de uma boa resposta.

Para testar, reinicie o servidor, acorde a barriga e pergunte "¿quién eres?" ("quem é você?"). A Narsil deve responder em espanhol, em uma ou duas frases, com a voz nova e sem dizer o nome dela. Depois pergunte algo longo, como funciona uma receita: a resposta deve continuar curta e oferecer mais. Diga "salir" para conferir que a conversa se encerra.

## Para ir além

- **O seu próprio modelo.** O `prompt_template` pode apontar para um arquivo seu, por exemplo em `data/`, se você quiser tirar regras que não combinam com a Narsil (o reconhecimento de quem fala do modelo ou a sua seção de segurança). Mantenha a seção `<context>` por último para que a divisão do cache do guia 5 continue funcionando.
- **Uma palavra de ativação personalizada.** Com `USE_CUSTOM_WAKE_WORD`, a barriga pode escutar uma frase à sua escolha. Confira na documentação do ESP-SR quais idiomas os seus modelos MultiNet suportam antes de escolher "Narsil".
- **Outras vozes.** O `private_voice`, se definido, substitui a `voice` no provedor do EdgeTTS. Os provedores de TTS locais (guia 4) mantêm a voz no seu PC.
- **O estágio dela.** A Narsil do narsil-pet cresce em cinco estágios. A barriga recebe o estado dela do ntfy (guia 7), e o servidor poderia acrescentá-lo ao prompt pelo `dynamic_context` do modelo, para que a Narsil da mesa fale como o estágio em que está.
- O guia 7 mostra os alertas da Narsil na tela da barriga.
