---
title: O Claude como cérebro
description: 'Um provedor nativo da Anthropic em Python para o xiaozhi-esp32-server: como o servidor chama um modelo, a API Messages com streaming, cache de prompt, custo por turno e a chave de API.'
route: bot
order: 5
updated: 2026-11-18
---

## O que faz

O servidor do guia 4 escuta a sua voz e a transforma em texto, mas não pensa. A cada turno, ele entrega a conversa a um modelo de linguagem (LLM) e fala de volta o que sair dele. Neste bot, esse modelo é o Claude.

Este guia acrescenta um novo provedor de LLM ao [xinnan-tech/xiaozhi-esp32-server](https://github.com/xinnan-tech/xiaozhi-esp32-server): um arquivo em Python que recebe a conversa do servidor, a envia para a [API Messages do Claude](https://platform.claude.com/docs/en/api/overview) com o [SDK oficial `anthropic` para Python](https://github.com/anthropics/anthropic-sdk-python) e transmite a resposta de volta palavra por palavra, para que a barriga comece a falar antes de o Claude terminar de escrever.

Só texto vai para a Anthropic: o que o reconhecedor de fala entendeu, o prompt de sistema e os turnos anteriores. O seu áudio nunca vai; ele fica entre a barriga e o PC (e o reconhecedor de fala que você escolheu no guia 4).

## Como funciona por dentro

### Como o servidor carrega um modelo de linguagem

O servidor escolhe o seu modelo em `selected_module.LLM`, que nomeia um bloco sob `LLM:` na configuração. O `core/utils/modules_initialize.py` lê o `type` desse bloco (ou o nome do bloco, quando ele não tem `type`) e passa o bloco inteiro para o `core/utils/llm.py`, cujo `create_instance` procura um arquivo em:

```text
core/providers/llm/<type>/<type>.py
```

e constrói a classe `LLMProvider` que encontra ali, com o bloco como único argumento. O provedor do Gemini, `core/providers/llm/gemini/gemini.py`, é um bom modelo para ler: uma pasta, um arquivo, uma classe.

Então `type: claude` significa um arquivo `core/providers/llm/claude/claude.py`. A pasta se chama `claude`, não `anthropic`, para que nunca seja confundida com o pacote do SDK que ela importa.

### A interface que um provedor implementa

Todo provedor estende `LLMProviderBase`, de `core/providers/llm/base.py`. O seu contrato é pequeno:

- `response(self, session_id, dialogue)` é abstrato e precisa ser um **gerador**: ele entrega pedaços de texto conforme chegam. O servidor os passa para o sintetizador de fala frase por frase.
- `response_with_functions(self, session_id, dialogue, functions=None)` é a versão com chamada de ferramentas. A classe base já o implementa chamando `response` e entregando pares `(token, None)`, então um provedor sem ferramentas o ganha de graça.
- `response_no_stream` monta um diálogo de duas mensagens e junta o que `response` entrega; ele não precisa de nada de você.

`dialogue` é uma lista de dicionários no formato de chat conhecido, `{"role": ..., "content": ...}`. O `core/utils/dialogue.py` a monta: primeiro uma mensagem `system` (o prompt de sistema renderizado), depois os turnos `user` e `assistant` da conversa. Com a chamada de ferramentas ligada, também podem aparecer mensagens `tool` e `tool_calls`.

O `core/connection.py` chama `response_with_functions` só quando o módulo de intenção é `function_call`; caso contrário, chama `response`. O bot define `Intent: nointent`, então o provedor só precisa de `response`, e o Claude só conversa. As ferramentas estão em "Para ir além".

### Do diálogo do servidor para a API Messages

A API Messages quer o prompt de sistema à parte, num parâmetro `system`, e uma lista `messages` de turnos `user` e `assistant` que começa com um turno `user`. O provedor converte:

1. As mensagens de sistema saem da lista e viram o parâmetro `system`.
2. Os turnos de usuário e de assistente ficam, como texto.
3. Tudo o que vem antes do primeiro turno de usuário (uma saudação do assistente, por exemplo) é descartado, porque a primeira mensagem precisa ser do usuário.

Depois ele abre um stream com `client.messages.stream(...)` e entrega a partir do seu `text_stream`, que dá o texto da resposta conforme ele é gerado, exatamente o que a interface de gerador do servidor quer. Os [auxiliares de streaming](https://github.com/anthropics/anthropic-sdk-python/blob/main/helpers.md) do SDK para Python documentam os dois.

### Por que a API nativa e não a compatível com a OpenAI

O servidor já tem um provedor `openai`, e a Anthropic oferece uma [camada de compatibilidade com o SDK da OpenAI](https://platform.claude.com/docs/en/cli-sdks-libraries/libraries/openai-sdk), então apontar o provedor existente para o Claude funcionaria. A própria página da Anthropic explica por que o bot não faz isso: ela diz que a camada "is primarily intended to test and compare model capabilities, and is not considered a long-term or production-ready solution for most use cases" (destina-se principalmente a testar e comparar as capacidades dos modelos, e não é considerada uma solução de longo prazo nem pronta para produção na maioria dos casos de uso). A mesma página lista o que falta nela, e a primeira peça que falta importa aqui: o cache de prompt "is not supported" (não é suportado) por ela. O SDK nativo tem cache, erros tipados e o conjunto completo de parâmetros.

### O modelo, e quanto custa um turno

O provedor lê o modelo da configuração. O exemplo usa `claude-opus-5-5`, o Claude Opus 5.5. Para um assistente de voz, o `claude-haiku-5-5`, o Claude Haiku 5.5, é a escolha mais barata e mais rápida; os dois usam o mesmo código. Preços da [página de preços](https://platform.claude.com/docs/en/about-claude/pricing) da Anthropic, por milhão de tokens, no dia deste guia:

| Modelo           | Entrada | Escrita no cache de 5 minutos | Acerto no cache | Saída |
| ---------------- | ------- | ----------------------------- | --------------- | ----- |
| Claude Opus 5.5  | $4      | $5                            | $0.20           | $20   |
| Claude Haiku 5.5 | $0.10   | $0.125                        | $0.01           | $0.50 |

A linha do Haiku vale para prompts de até 100.000 tokens, que uma conversa por voz nunca alcança.

Um turno de voz aproximado: o prompt de sistema do servidor tem alguns milhares de caracteres (o seu modelo `agent-base-prompt.txt` mais o caráter da Narsil do guia 6), cerca de 2.000 tokens; você diz uma frase, cerca de 20 tokens; a Narsil responde em duas frases curtas, cerca de 60 tokens de texto. No Opus 5.5, isso dá cerca de $0.008 de entrada sem cache, cerca de $0.0004 com ele, mais cerca de $0.0012 de saída. No Haiku 5.5, o turno inteiro é uma pequena fração de um centavo. Duas coisas aumentam a conta: o histórico, que é enviado de novo a cada turno, e o raciocínio. No Claude Opus 5.5 o raciocínio fica sempre ligado e é cobrado como saída; o provedor define `output_config.effort` como `low` para que uma resposta por voz não pense por muito tempo. Confira a página de preços atual antes de confiar nesses números.

### Cache de prompt

O [cache de prompt](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) permite que a API reaproveite o começo de uma requisição que viu recentemente. Você marca um bloco com `cache_control: {"type": "ephemeral"}`; tudo até essa marca fica guardado por cinco minutos, renovados de graça a cada uso. Uma escrita no cache custa 1,25 vez o preço de entrada; um acerto custa 0,05 vez no Opus 5.5 e 0,1 vez no Haiku 5.5. O prefixo precisa ter pelo menos 512 tokens nos dois modelos, ou ele simplesmente não entra no cache, sem aviso.

O porém é que o cache é uma correspondência de prefixo: mude um caractere e tudo o que vem depois é novo. O modelo do servidor termina com uma seção `<context>` que guarda dados em tempo real, e o `core/utils/dialogue.py` substitui `{{current_time}}` pela hora em `HH:MM` a cada turno. Por isso o provedor divide o prompt de sistema em `<context>`: a parte estável vai primeiro, com a marca de cache, e a parte de contexto vai depois dela, fora do cache. A parte estável passa bem dos 512 tokens.

### A chave de API

O SDK lê a chave da variável de ambiente `ANTHROPIC_API_KEY` quando o provedor não passa nenhuma. O provedor também aceita `api_key` no seu bloco de configuração, que vive no `data/.config.yaml` no seu PC (guia 4). De um jeito ou de outro, a chave fica no PC e nunca entra num repositório.

Para obter uma:

1. Abra o [Claude Console](https://platform.claude.com/) e vá em **API keys** ([platform.claude.com/settings/keys](https://platform.claude.com/settings/keys)). Crie uma chave com um nome que diga onde ela vive, por exemplo `narsil-bot-pc`. O Console a mostra uma única vez.
2. Defina um limite mensal em [Spend limits](https://platform.claude.com/settings/spend-limits) (`platform.claude.com/settings/spend-limits`): ao lado de **Monthly spend limit**, clique em **Adjust limit** ou **Set limit**. Segundo a [página de limites de taxa](https://platform.claude.com/docs/en/api/rate-limits), quando o seu próprio limite é atingido, a API responde HTTP 400 até o mês seguinte ou até você aumentá-lo, então um laço descontrolado custa no máximo isso.
3. Para revogá-la, apague a chave na mesma página **API keys**. As requisições com ela param de funcionar na hora; crie uma nova e atualize o PC.

## Como foi pedido à IA

Este guia vem de uma decisão. No guia 4, a pessoa autora colocou o servidor no PC com um motivo:

> en el pc, igual la idea es usarlo para trabajar con claude

Tradução para o português: "no PC; de qualquer forma, a ideia é usá-lo para trabalhar com o Claude".

A IA então perguntou como o servidor deveria chegar ao Claude. Ofereceu duas opções: (1) um provedor nativo da Anthropic escrito em Python com o Anthropic SDK, ou (2) o provedor existente do tipo OpenAI do servidor apontado para o endpoint compatível com a OpenAI da Anthropic, sem código novo. Ela citou a página de compatibilidade da Anthropic e a sua observação de que o endpoint se destina a testes e comparações. A pessoa autora respondeu:

> 1

Essa resposta é a especificação S5: um provedor nativo. O modelo, o nível de esforço e a divisão do cache não foram perguntados; a IA os tirou da documentação da Anthropic e do próprio modelo do servidor, e são configurações que você pode mudar.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é a conversa usada para construir o bot.

> Eu rodo o xinnan-tech/xiaozhi-esp32-server no Docker. Escreva um novo provedor de LLM para ele que chame o Claude pelo SDK oficial `anthropic` para Python, não pelo endpoint compatível com a OpenAI. Primeiro leia `core/providers/llm/base.py`, `core/providers/llm/gemini/gemini.py`, `core/utils/llm.py` e `core/utils/dialogue.py` para aprender a interface e o formato do diálogo. Converta as mensagens de sistema para o parâmetro `system`, faça streaming com `messages.stream` e entregue a partir de `text_stream`, leia o modelo, o `max_tokens` e a chave de API do bloco de configuração do provedor, e coloque no cache a parte estável do prompt de sistema com `cache_control`. Mostre-me a entrada do `.config.yaml` e como adicionar o arquivo e o SDK ao contêiner Docker.

## O código mínimo

O provedor, `providers/claude/claude.py` na sua pasta `xiaozhi-server` no PC (MIT, como os próprios exemplos do site):

```python
import anthropic

from core.providers.llm.base import LLMProviderBase

CONTEXT_MARK = "<context>"


def to_messages_api(dialogue):
    system_text = "\n".join(m["content"] for m in dialogue if m["role"] == "system")
    stable, mark, context = system_text.partition(CONTEXT_MARK)
    system = [{"type": "text", "text": stable, "cache_control": {"type": "ephemeral"}}]
    if mark:
        system.append({"type": "text", "text": mark + context})

    messages = []
    for m in dialogue:
        content = str(m.get("content") or "")
        if m["role"] not in ("user", "assistant") or not content:
            continue
        if not messages and m["role"] != "user":
            continue
        messages.append({"role": m["role"], "content": content})
    return system, messages


class LLMProvider(LLMProviderBase):
    def __init__(self, config):
        self.model_name = config.get("model_name", "claude-opus-5-5")
        self.max_tokens = int(config.get("max_tokens", 4096))
        self.effort = config.get("effort", "low")
        self.client = anthropic.Anthropic(api_key=config.get("api_key") or None)

    def response(self, session_id, dialogue, **kwargs):
        system, messages = to_messages_api(dialogue)
        with self.client.messages.stream(
            model=self.model_name,
            max_tokens=self.max_tokens,
            system=system,
            messages=messages,
            output_config={"effort": self.effort},
        ) as stream:
            yield from stream.text_stream
            if stream.get_final_message().stop_reason == "refusal":
                yield "Prefiero no responder a eso."
```

A última linha é o que a Narsil diz, em espanhol ("prefiro não responder a isso"), quando o Claude recusa um pedido.

O seu bloco no `data/.config.yaml`, ao lado do que o guia 4 colocou ali:

```yaml
selected_module:
  LLM: ClaudeLLM
  Intent: nointent

LLM:
  ClaudeLLM:
    type: claude
    model_name: claude-opus-5-5
    max_tokens: 4096
    effort: low
```

Para o Haiku, mude `model_name` para `claude-haiku-5-5`. O `max_tokens` é um teto, não uma meta: o tamanho das respostas da Narsil é definido pelo prompt dela (guia 6).

A imagem do servidor não inclui o SDK nem o arquivo novo. Um pequeno `Dockerfile` ao lado do `docker-compose.yml` acrescenta o SDK por cima da imagem do projeto:

```dockerfile
FROM ghcr.nju.edu.cn/xinnan-tech/xiaozhi-esp32-server:server_latest
RUN pip install anthropic
```

E um `docker-compose.override.yml`, que o Docker Compose mescla sozinho ao arquivo do projeto, constrói essa imagem, monta o provedor onde o `create_instance` o procura e repassa a chave a partir do seu shell:

```yaml
services:
  xiaozhi-esp32-server:
    build: .
    image: xiaozhi-esp32-server-claude
    environment:
      - ANTHROPIC_API_KEY
    volumes:
      - ./providers/claude/claude.py:/opt/xiaozhi-esp32-server/core/providers/llm/claude/claude.py
```

Depois, no PowerShell, com uma chave inventada:

```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-EXAMPLE-not-a-real-key"
docker compose up -d --build
docker logs -f xiaozhi-esp32-server
```

## Erros comuns e como testar

- **Um `type` que não combina com a pasta.** `type: claude` precisa de `core/providers/llm/claude/claude.py` dentro do contêiner. O servidor responde `不支持的LLM类型` ("tipo de LLM não suportado") quando o caminho está errado; confira a linha do volume.
- **`ModuleNotFoundError: anthropic`.** O contêiner ainda está rodando a imagem do projeto. Reconstrua com `docker compose up -d --build`.
- **A primeira mensagem não é do usuário.** A API rejeita uma lista `messages` que começa com `assistant`; a conversão descarta tudo o que vem antes do primeiro turno de usuário.
- **Um `max_tokens` baixo demais.** O raciocínio conta para ele; com algumas centenas de tokens, uma resposta pode parar no meio. Mantenha as respostas curtas pelo prompt.
- **Um cache que nunca acerta.** Qualquer coisa que muda antes da marca de cache o quebra. Leia `usage.cache_read_input_tokens` na mensagem final: zero em todo turno significa que a parte estável está mudando, por exemplo porque um modelo personalizado moveu a hora para cima de `<context>`.
- **A chave no repositório.** Mantenha-a no ambiente ou no `data/.config.yaml`, ambos fora de qualquer repositório. Se uma vazar, apague-a no Console na hora.

Para testar, inicie o servidor e acompanhe o seu log. Ele informa `初始化组件: llm成功 ClaudeLLM` ("componente inicializado: llm com sucesso") quando o provedor carrega. Depois acorde a barriga e pergunte algo curto: o log mostra o texto reconhecido, e a resposta começa a tocar enquanto o Claude ainda está escrevendo. Na página [Usage](https://platform.claude.com/usage) do Console, as requisições aparecem em poucos minutos, com os seus tokens com e sem cache.

## Para ir além

- **Ferramentas.** Com `Intent: function_call`, o servidor passa os seus plugins (clima, música, a intenção de sair) para `response_with_functions`. Implementá-lo significa converter a lista de funções no estilo da OpenAI do servidor para o formato `tools` do Claude e entregar o formato de chamada de função do servidor, como faz o provedor do Gemini.
- **Alternativas em caso de recusa.** No Claude Opus 5.5, o beta `server-side-fallback-2026-07-01` permite que a API tente de novo uma requisição recusada em outro modelo dentro da mesma chamada (`fallbacks: "default"` em `client.beta.messages`).
- **Esforço.** `low` mantém as respostas rápidas. Experimente `medium` para perguntas que exigem mais reflexão, e meça o atraso antes de mantê-lo.
- **Mensagens de sistema no meio da conversa.** Para mudar as instruções da Narsil durante uma conversa sem mexer no prompt de sistema em cache, a API aceita um papel `system` dentro de `messages` nos modelos atuais.
- O guia 6 escreve o caráter que vai nesse prompt de sistema, e a voz em espanhol que o fala.
