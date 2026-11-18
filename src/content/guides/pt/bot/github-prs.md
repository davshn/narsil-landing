---
title: Os seus pull requests do GitHub
description: 'A barriga lista os pull requests abertos que esperam a sua revisão: busca do GitHub por REST, um token fine-grained só de leitura com acesso mínimo, consultas dentro dos limites e como revogá-lo.'
route: bot
order: 8
updated: 2026-11-18
---

## O que faz

Ao lado dos alertas da Narsil, a barriga mostra uma lista curta: os pull requests abertos no GitHub que estão esperando a sua revisão. Cada linha tem o repositório, o número, o título e quem o abriu, e a lista se atualiza a cada dois minutos, mais ou menos. Quando alguém pede a sua revisão, o pedido aparece na barriga sem abrir um navegador.

A barriga obtém a lista por conta própria, direto da API REST do GitHub, com um token que só pode ler. O PC, o servidor de voz e o Claude não participam: se o PC estiver desligado, a lista continua se atualizando.

## Como funciona por dentro

### Uma busca resolve

A [API de busca](https://docs.github.com/en/rest/search/search) do GitHub responde "quais pull requests abertos querem a minha revisão" numa única requisição:

```text
GET https://api.github.com/search/issues?q=is:pr+is:open+review-requested:@me&per_page=10
```

O `GET /search/issues` busca issues e pull requests em todos os repositórios que o token consegue ver. Os qualificadores a restringem: `is:pr` mantém só os pull requests, `is:open` descarta os fechados e os mesclados, e `review-requested:@me` mantém aqueles em que a sua revisão foi solicitada; `@me` significa a conta dona do token. O `per_page` limita a resposta (o máximo é 100; a barriga mostra 10).

A resposta é um JSON com `total_count` e um array `items`. De cada item, a barriga lê `title`, `number`, `html_url`, `repository_url` (cujas duas últimas partes são a conta dona e o repositório), `user.login`, `updated_at` e `draft`.

Uma segunda busca com `author:@me` no lugar de `review-requested:@me` lista os seus próprios pull requests abertos; a barriga pode alternar entre as duas.

### Os cabeçalhos

A documentação REST do GitHub usa os mesmos três cabeçalhos em toda requisição:

| Cabeçalho              | Valor                         | Por quê                                                 |
| ---------------------- | ----------------------------- | ------------------------------------------------------- |
| `Authorization`        | `Bearer <token>`              | Quem está pedindo, e portanto o que `@me` significa     |
| `Accept`               | `application/vnd.github+json` | O formato JSON que a documentação recomenda             |
| `X-GitHub-Api-Version` | `2026-03-10`                  | A versão da REST; sem ele, o GitHub assume `2022-11-28` |

A [página de versões da API](https://docs.github.com/en/rest/about-the-rest-api/api-versions) lista `2026-03-10` e `2022-11-28` como as versões suportadas, e diz que uma requisição sem o cabeçalho recebe `2022-11-28`. O GitHub também quer um `User-Agent`; a barriga envia `narsil-bot`.

### O token: só leitura, o mínimo acesso

A barriga usa um [fine-grained personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) (token de acesso pessoal de granularidade fina), não um clássico. Um token fine-grained fica limitado aos repositórios que você escolhe e às permissões que você marca, e pode expirar sozinho.

A página do GitHub de [endpoints disponíveis para tokens fine-grained](https://docs.github.com/en/rest/authentication/endpoints-available-for-fine-grained-personal-access-tokens) inclui o `GET /search/issues`, e a [página de permissões](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens) não lista nenhuma permissão própria para ele. A documentação de busca explica a regra em vez disso: é preciso "have access to the repositories in your search queries" (ter acesso aos repositórios das suas consultas de busca). Então o token vê:

- **Repositórios públicos, sempre.** A página do GitHub observa que "Tokens always include read-only access to all public repositories on GitHub." (Os tokens sempre incluem acesso só de leitura a todos os repositórios públicos do GitHub.)
- **Repositórios privados, só os que você acrescenta** em **Repository access**, com **Pull requests: Read-only** como única permissão. Essa é a permissão que o GitHub lista para ler pull requests (`GET /repos/{owner}/{repo}/pulls`), e ela deixa a busca ver os privados que você escolheu.

Se todo repositório que você revisa é público, o token não precisa de permissão nenhuma: escolha **Public repositories** em **Repository access** e não marque nada. De um jeito ou de outro, o token não consegue escrever, mesclar, comentar nem ler código em repositórios privados.

O **Resource owner** também importa. Um token que pertence a você vê os seus repositórios; para ver os privados de uma organização, a organização precisa ser o resource owner, e as pessoas proprietárias dela podem ter de aprovar o token.

### Como criá-lo, fazê-lo expirar e revogá-lo

Da página do GitHub sobre o gerenciamento de tokens:

1. **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**, ou vá direto para [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens).
2. Dê a ele um nome que diga onde ele vive, como `narsil-bot belly`.
3. Em **Expiration**, escolha uma data. O padrão é 30 dias. Uma vida mais curta significa que um token vazado para de funcionar mais cedo; quando ele expira, a lista da barriga mostra um erro até você colocar um novo.
4. Escolha o **Resource owner**, o **Repository access** e a única permissão acima, depois clique em **Generate token**. O GitHub mostra o token uma única vez; ele começa com `github_pat_`.

Para revogá-lo, abra a mesma página e clique em **Delete** ao lado do token. As requisições da barriga falham a partir daí, que é exatamente o que você quer se a placa se perder ou o token vazar.

### Consultas periódicas, dentro dos limites

Os endpoints de busca têm o seu próprio limite de taxa: 30 requisições por minuto para uma conta autenticada. A barriga pergunta a cada dois minutos, uma pequena fração disso, e uma requisição de cada vez, como pedem as [boas práticas](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api) do GitHub para evitar limites de taxa secundários. A mesma página pede que você "Poll only as often as you need to, on a fixed schedule" (consulte só com a frequência necessária, num horário fixo), e que espere pelo menos os segundos de um cabeçalho `x-poll-interval` quando ele vier na resposta.

Ela também explica as requisições condicionais. Quando uma resposta traz um cabeçalho `etag`, a barriga o guarda e o envia de volta como `If-None-Match` na vez seguinte. Se nada mudou, o GitHub responde `304 Not Modified` sem corpo, e "Making a conditional request does not count against your primary rate limit if a `304` response is returned." (Fazer uma requisição condicional não conta para o seu limite de taxa primário se a resposta for um `304`.) A barriga mantém a lista que já tem.

Diante de um `403` ou `429`, a barriga espera o tempo de `retry-after` (ou de `x-ratelimit-reset`) antes de tentar de novo. Diante de um `401`, o token está errado, expirado ou apagado, e a tela diz isso.

### Na barriga

A requisição usa o [`esp_http_client`](https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/api-reference/protocols/esp_http_client.html) do ESP-IDF com o pacote de certificados (`crt_bundle_attach = esp_crt_bundle_attach`), como o stream do ntfy no guia 7. Desta vez a resposta é curta, então ela usa `esp_http_client_perform`, junta o corpo no evento `HTTP_EVENT_ON_DATA`, pega o `etag` em `HTTP_EVENT_ON_HEADER` (onde `evt->header_key` e `evt->header_value` guardam cada cabeçalho da resposta) e lê o status com `esp_http_client_get_status_code` depois que o `perform` retorna.

O token vive na NVS, no namespace `narsil` do `Settings` do Xiaozhi, sob a chave `gh_token`, digitado uma vez na tela de configurações da barriga ([guia 9](/pt/bot/belly-ui/)). Ele nunca é compilado no firmware nem escrito no log.

## Construa com o Claude

Peça ao Claude uma função na barriga que pergunte à API de busca do GitHub pelos pull requests abertos que pedem a sua revisão e os mostre na tela. A única ideia que ele precisa acertar é que o token só pode ler, com o mínimo acesso, e vive na NVS da barriga, nunca no código nem no log.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é a conversa usada para construir o bot.

> Num ESP32-P4 com ESP-IDF 6, quero mostrar os pull requests abertos do GitHub que pedem a minha revisão. Confira na documentação REST do GitHub se o `GET /search/issues` funciona com um fine-grained personal access token e qual permissão ele precisa, o `X-GitHub-Api-Version` atual, o limite de taxa da busca e como funcionam as requisições condicionais com `If-None-Match`. Depois escreva uma função que o chame com o `esp_http_client` e o pacote de certificados, leia o token da NVS, guarde o ETag, trate 304, 401, 403 e 429, e analise `items` com o cJSON. Diga-me como criar o token com o mínimo acesso e como revogá-lo.

### O que conferir na resposta do Claude

1. Faz uma única requisição, `GET /search/issues` com `is:pr+is:open+review-requested:@me`, e envia os cabeçalhos `Authorization`, `Accept`, `X-GitHub-Api-Version` (`2026-03-10`) e `User-Agent`.
2. O token é um token de acesso pessoal refinado com data de expiração: nenhuma permissão para repositórios públicos, ou só **Pull requests: Read-only** para os privados que você adicionar. O Claude também diz como revogá-lo: **Delete** ao lado do token na página de tokens do GitHub.
3. O token é lido da NVS (namespace `narsil`, chave `gh_token`) e enviado só no cabeçalho `Authorization`. Ele nunca é compilado no firmware nem impresso no log, nem mesmo o cabeçalho.
4. Pergunta a cada dois minutos, uma requisição por vez. Guarda o `etag`, o envia de volta como `If-None-Match` e mantém a lista que já tem quando recebe um `304`.
5. Mostra `401` na tela como um token errado, expirado ou excluído, e com `403` ou `429` espera `retry-after` (ou `x-ratelimit-reset`) antes de tentar de novo. O HTTPS usa o pacote de certificados.

Se uma verificação falhar, diga ao Claude o que você vê: "a lista está vazia, mas eu tenho um pedido de revisão num repositório privado".

### Como a pessoa autora pediu

Os pull requests vieram com o propósito do bot: uma tela na barriga que mostra o que precisa de você, ao lado das tarefas da Narsil. Onde acontece o trabalho de rede ficou resolvido pela resposta da pessoa autora sobre a cabeça:

> Por cable desde la panza

Tradução para o português: "por cabo, a partir da barriga".

Então a barriga chama o GitHub por conta própria. A especificação S6 depois definiu a regra para todo segredo, incluindo o token do GitHub: ele vive na NVS ou na configuração local, nunca no repositório.

O resto era trabalho de pesquisa da IA, não decisão da pessoa autora: qual endpoint lista os pull requests que precisam de você, se um token fine-grained consegue chamá-lo e qual é a permissão mínima que funciona. A IA leu a documentação de busca do GitHub e as suas páginas de endpoints e permissões para tokens fine-grained, e escolheu a busca com uma permissão **Pull requests** só de leitura apenas onde os repositórios privados precisam dela.

## Código de referência

Esta é uma resposta correta, escrita para este guia. Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

Uma função para a barriga, em C++, ao lado do código do Xiaozhi (MIT, como os próprios exemplos do site). `ShowPullRequest` e `ShowGithubError` são as funções da tela do [guia 9](/pt/bot/belly-ui/); uma tarefa chama `PollPullRequests()` a cada dois minutos:

```cpp
#include <cJSON.h>
#include <esp_crt_bundle.h>
#include <esp_http_client.h>
#include <cstring>
#include <string>
#include <strings.h>

#include "settings.h"

void ShowPullRequest(int index, const char* repo, int number, const char* title, const char* author);
void ShowGithubError(int status);

static std::string body;
static std::string etag;

static esp_err_t OnEvent(esp_http_client_event_t* evt) {
    if (evt->event_id == HTTP_EVENT_ON_HEADER && strcasecmp(evt->header_key, "etag") == 0) {
        etag = evt->header_value;
    } else if (evt->event_id == HTTP_EVENT_ON_DATA && body.size() < 64 * 1024) {
        body.append((const char*)evt->data, evt->data_len);
    }
    return ESP_OK;
}

int PollPullRequests() {
    Settings settings("narsil");
    std::string token = settings.GetString("gh_token");
    if (token.empty()) return 0;

    esp_http_client_config_t config = {};
    config.url = "https://api.github.com/search/issues?q=is:pr+is:open+review-requested:@me&per_page=10";
    config.crt_bundle_attach = esp_crt_bundle_attach;
    config.event_handler = OnEvent;
    config.user_agent = "narsil-bot";
    esp_http_client_handle_t client = esp_http_client_init(&config);

    std::string auth = "Bearer " + token;
    esp_http_client_set_header(client, "Authorization", auth.c_str());
    esp_http_client_set_header(client, "Accept", "application/vnd.github+json");
    esp_http_client_set_header(client, "X-GitHub-Api-Version", "2026-03-10");
    std::string previous_etag = etag;
    if (!previous_etag.empty()) {
        esp_http_client_set_header(client, "If-None-Match", previous_etag.c_str());
    }

    body.clear();
    int status = 0;
    if (esp_http_client_perform(client) == ESP_OK) {
        status = esp_http_client_get_status_code(client);
    }
    esp_http_client_cleanup(client);

    if (status == 304) return status;
    if (status != 200) {
        etag = previous_etag;
        ShowGithubError(status);
        return status;
    }

    cJSON* root = cJSON_Parse(body.c_str());
    cJSON* items = cJSON_GetObjectItem(root, "items");
    for (int i = 0; i < cJSON_GetArraySize(items); i++) {
        cJSON* item = cJSON_GetArrayItem(items, i);
        const char* repo_url = cJSON_GetStringValue(cJSON_GetObjectItem(item, "repository_url"));
        const char* repo = repo_url ? strstr(repo_url, "/repos/") : nullptr;
        ShowPullRequest(i, repo ? repo + 7 : "",
                        (int)cJSON_GetNumberValue(cJSON_GetObjectItem(item, "number")),
                        cJSON_GetStringValue(cJSON_GetObjectItem(item, "title")),
                        cJSON_GetStringValue(cJSON_GetObjectItem(cJSON_GetObjectItem(item, "user"), "login")));
    }
    cJSON_Delete(root);
    return status;
}
```

O `repository_url` tem a forma `https://api.github.com/repos/octo-org/example-repo`, então o texto depois de `/repos/` é o `owner/repo` que a linha mostra. O limite de 64 KB no corpo é uma proteção: dez resultados de busca cabem com folga abaixo dele.

Um token de teste no PC, para as verificações abaixo, aparece aqui inventado: `github_pat_EXAMPLE_not_a_real_token`.

## Erros comuns e como testar

- **Um token clássico com o escopo `repo`.** Funciona, e pode escrever em todos os repositórios que você tem. Use um token fine-grained com acesso só de leitura.
- **Uma lista vazia com repositórios privados.** O token só vê os repositórios privados que você acrescentou em **Repository access**, com **Pull requests: Read-only**.
- **`401 Unauthorized`.** O token foi digitado errado, expirou ou foi apagado. Crie um novo e digite-o de novo na barriga.
- **`403` depois de muitas requisições.** Buscas demais num minuto, ou requisições enviadas em paralelo. Uma requisição a cada dois minutos, uma de cada vez.
- **Espaços na consulta.** A URL não pode ter espaços crus; os qualificadores são unidos com `+`.
- **Sem HTTPS.** Sem o pacote de certificados, o handshake TLS com `api.github.com` falha. Mantenha o `crt_bundle_attach`, e o `CONFIG_MBEDTLS_CERTIFICATE_BUNDLE` habilitado no menuconfig.
- **O token numa linha de log.** Nunca imprima o cabeçalho `Authorization` nem o valor da NVS, nem mesmo durante a depuração.

Para testar primeiro a partir do PC, com o seu token no lugar do exemplo:

```powershell
curl.exe -s -H "Authorization: Bearer github_pat_EXAMPLE_not_a_real_token" -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2026-03-10" "https://api.github.com/search/issues?q=is:pr+is:open+review-requested:@me&per_page=10"
```

Uma resposta JSON com `total_count` significa que o token funciona. Acrescente `-i` para ver o cabeçalho `etag`, depois repita com `-H "If-None-Match: <esse etag>"` para receber um `304`. Na barriga, peça a alguém (ou a uma segunda conta) que solicite a sua revisão num pull request de teste: em até dois minutos ele aparece na tela. Apague o token no GitHub, e a consulta seguinte mostra o erro `401`.

## Para ir além

- **Mais listas.** `author:@me` mostra os seus próprios pull requests abertos; acrescentar `draft:false` esconde os rascunhos. Cada lista é mais uma busca, então mantenha o total bem abaixo de 30 por minuto.
- **Verificações e revisões.** Os endpoints de pulls (`GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews`, por exemplo) dão o estado de revisão de cada pull request; eles também precisam de **Pull requests: Read-only**.
- **Notificações em vez de busca.** A API de notificações do GitHub responde "o que aconteceu comigo", mas o GitHub não a lista entre os endpoints para tokens fine-grained, então ela precisaria de um token clássico.
- **Rotação.** Com um token de 30 dias, coloque um lembrete na sua agenda. A barriga pode mostrar a data de expiração se você a digitar junto com o token.
- O [guia 9](/pt/bot/belly-ui/) desenha as duas listas, alertas e pull requests, na tela da barriga.
