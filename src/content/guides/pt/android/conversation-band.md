---
title: A faixa acima da caixa de mensagem
description: 'A faixa acima da caixa onde você escreve no app: estado, contexto, cache e último evento vindos do próprio claude.ai, e a Narsil no estágio dela a partir do estado do mod que o StateFeed acompanha.'
route: android
order: 3
updated: 2026-11-24
sources:
  - repo: android
    path: app/src/main/assets/page/content.js
  - repo: android
    path: app/src/main/assets/page/lib/live.js
  - repo: android
    path: app/src/main/assets/page/lib/watch.js
  - repo: android
    path: app/src/main/assets/page/lib/restore.js
  - repo: android
    path: app/src/main/assets/page/band.css
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/StateFeed.kt
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/StateModel.kt
---

## O que faz

Quando você abre uma conversa no app (um endereço como `claude.ai/code/session_…`), uma faixa aparece logo acima da caixa onde você escreve. Da esquerda para a direita e de cima para baixo, ela mostra:

- **A Narsil**, no estágio atual dela e na pose do estado da conversa.
- **O estado**, como uma etiqueta colorida: `TRABAJANDO` (trabalhando, azul), `TE NECESITA` (precisa de você, âmbar), `TERMINADA` (terminada, verde) ou `EN REPOSO` (em repouso, cinza). A borda esquerda da faixa ganha a mesma cor.
- **O contexto**, como `Contexto 42 %`: quanto da sua janela a conversa já usou, em verde, âmbar ou vermelho.
- **O cache**, como `🧊 38 min`: os minutos que faltam para o cache do prompt expirar, até ele virar `🧊 fría` (fria).
- **O último evento**: a última coisa que o Claude disse, ou `Usando Bash` (usando o Bash) quando o Claude só está rodando uma ferramenta, com há quanto tempo, como `hace 3 min` (há 3 min).

O texto ocupa duas linhas. Um toque na faixa o abre inteiro e outro toque o fecha. A faixa empurra a conversa para cima em vez de cobri-la, e se atualiza a cada 10 segundos enquanto o app está na frente.

> **Experimental.** A faixa lê os mesmos dados que a página do `claude.ai` carrega para si mesma, de endereços internos que não são uma API pública, e encontra a caixa de mensagem por um atributo na marcação da página. Uma atualização do Claude pode quebrá-la; quando isso acontece, a faixa simplesmente deixa de aparecer e o Claude continua funcionando. Ela só lê: envia requisições `GET` ao `claude.ai` com a sua sessão e nunca escreve na sua conta.

Quase tudo na faixa vem do próprio `claude.ai`, então ela funciona no momento em que você abre uma conversa, mesmo com o computador desligado. Só dois detalhes dependem do mod Narsil: o estágio dela no desenho e quanto tempo o cache dura. Eles vêm de `<seu tópico>-estado`, que o app acompanha em Kotlin.

## Como funciona por dentro

A faixa é desenhada por `assets/page/content.js`. O que ela faz com os dados vive em `assets/page/lib/live.js`, um módulo sem código de DOM. O observador da página é `lib/watch.js`, os estilos estão em `band.css`, e o estado do mod chega à página a partir de `StateFeed.kt` e `StateModel.kt` pelo canal que o [guia 2](/pt/android/webview-host/) descreve.

Esses scripts foram escritos primeiro para a extensão de navegador anterior, e a maior parte do código deles não mudou. No app, eles rodam no próprio mundo JavaScript da página, e não no mundo separado de uma extensão: `addDocumentStartJavaScript` os coloca ao lado do código do `claude.ai`. Isso muda um detalhe abaixo, o `fetch` que eles usam, e nada do que eles mostram.

### De onde vêm os dados: duas fontes

| Valor na faixa               | Fonte                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| Estado                       | `claude.ai`: o `status_bucket` da conversa                                         |
| Contexto                     | `claude.ai`: `context_usage` nos metadados da conversa                             |
| Último evento e a sua hora   | `claude.ai`: os eventos mais novos da conversa                                     |
| Contagem regressiva do cache | `claude.ai` para quando o Claude falou por último; o mod para quanto dura um cache |
| Pose da Narsil               | `claude.ai`: o estado a escolhe                                                    |
| Estágio da Narsil            | O mod: a pasta do desenho no seu último estado                                     |

### As próprias requisições da página

A faixa não lê a conversa da tela. Ela faz ao `claude.ai` as mesmas perguntas que a página faz, com a sua sessão, e lê as respostas como JSON. A cada 10 segundos, duas requisições saem juntas:

- **A lista das suas conversas**, ativas e pausadas, até 50: `/v1/code/sessions?statuses=active&statuses=paused&limit=50`. A faixa pega a que você tem aberta, encontrada pelo id no endereço da página (`/code/session_…`). O endereço e a lista podem nomear a mesma conversa com prefixos diferentes (`session_x` e `cse_x`, diz o código), então os ids são comparados sem eles.
- **Os últimos 60 eventos dessa conversa**, do mais novo para o mais antigo: `/v1/code/sessions/<id>/events?limit=60&sort_order=desc`.

O comentário acima deles em `lib/live.js` é o motivo de este caminho ser experimental: "These addresses are not a public API and may change." (Estes endereços não são uma API pública e podem mudar.)

`content.js` as envia com `credentials: 'include'` e um cabeçalho `anthropic-version: 2023-06-01`. Na extensão anterior, ele preferia o `content.fetch` do Firefox, que faz requisições "as the page itself, with its session" (como a própria página, com a sua sessão), nas palavras do código. Uma WebView não tem objeto `content`, então o código recorre ao `fetch` e, como o script roda no mundo da página, esse é o próprio `fetch` da página, com os cookies da página. A sua sessão nunca sai do `claude.ai`, e as respostas ficam na página.

### De que é feito cada valor

`liveOf` em `lib/live.js` transforma a conversa e os seus eventos no que a faixa mostra. Este trecho é de `lib/live.js` no narsil-android (MIT):

<!-- prettier-ignore -->
```js
  const STATES = {
    working: { label: 'TRABAJANDO', color: '#3B8BFF' },
    blocked: { label: 'TE NECESITA', color: '#F5B400' },
    completed: { label: 'TERMINADA', color: '#22B573' },
  }
  const AT_REST = { label: 'EN REPOSO', color: '#8A90A6' }
```

| Valor         | Feito a partir de                                                                                                                 |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Estado        | `status_bucket`: `working`, `blocked` ou `completed`; qualquer outra coisa é `EN REPOSO`.                                         |
| Contexto      | `external_metadata.context_usage`: `used_tokens` sobre `max_tokens`, arredondado para um percentual.                              |
| Último evento | O evento mais novo do Claude (`assistant`) com texto; se ele só tiver uma chamada de ferramenta, `Usando` e o nome da ferramenta. |
| Quando        | A hora desse evento, como `ahora mismo` (agora mesmo), `hace 5 min`, `hace 2 h` ou `hace 1 d`.                                    |
| Cache         | O evento mais novo do Claude, mais quanto tempo um cache dura (abaixo).                                                           |

Duas regras mantêm o último evento útil. Um raciocínio sozinho não diz nada, então um evento sem texto e sem chamada de ferramenta é pulado. E só os eventos do Claude contam: uma conversa tem muitos outros tipos.

O contexto e o cache compartilham uma coloração, de `levelColor` em `lib/state.js`: verde abaixo de 60 %, âmbar a partir de 60 %, vermelho a partir de 85 %. Para o cache, o percentual é quanto do seu tempo já passou.

### Por que o cache é uma estimativa

O `claude.ai` não diz quando o cache de uma conversa expira, então a faixa o estima: **a hora do último evento do Claude mais quanto tempo um cache dura**. De `lib/live.js` (MIT):

<!-- prettier-ignore -->
```js
  // From the model's last message: the session's last event may be anything,
  // and opening the page makes some of its own.
  function cacheOf(events, cacheMinutes, now) {
    const last = events.find((e) => e.event_type === 'assistant')
    if (!last) return null
    const left = Math.max(0, Math.ceil((secondsOf(last) + cacheMinutes * 60 - now) / 60))
    return { text: left > 0 ? `🧊 ${left} min` : '🧊 fría', color: self.narsilState.levelColor(100 - (left / cacheMinutes) * 100) }
  }
```

O ponto de partida é o último evento do Claude, não o último evento da conversa, porque, como diz o comentário, abrir a página gera eventos próprios, e a contagem regressiva recomeçaria toda vez que você olhasse.

Quanto tempo um cache dura é o mod que sabe: `cacheMinutesOf` pega `cacheMinutes` do último estado do mod ([O relógio do cache](/pt/mods/pet/cache-clock/) explica como o mod decide). Sem um estado, ele assume 60 minutos, "an hour on a plan" (uma hora num plano), nas palavras do código. Então leia `🧊 38 min` como "uns 38 minutos": o cache na verdade começa na requisição, não na resposta, e sem o mod um cache de 5 minutos aparece como 60.

### O desenho da Narsil: a pose vem da página, o estágio vem do mod

A pose segue o estado: `trabajando` (trabalhando), `necesita` (precisa de você), `terminado` (terminado), ou `parada` (parada) em repouso. O estágio dela não é algo que o `claude.ai` saiba. Ele vem do estado do mod, cujo campo `art` guarda o endereço do desenho dela. De `lib/live.js` (MIT):

<!-- prettier-ignore -->
```js
  // Her stage is the mod's to know: it comes in the art of its last state,
  // with the first stage at the root and each later one in its folder.
  function petOf(bucket, sentArt, isLight) {
    if (typeof sentArt !== 'string' || !sentArt.startsWith(ART)) return null
    const stage = /^etapa\d+\//.exec(sentArt.slice(ART.length))?.[0] ?? ''
    return `${ART}${stage}${POSES[bucket] ?? 'parada'}-${isLight ? 'claro' : 'oscuro'}.png`
  }
```

`ART` é `https://raw.githubusercontent.com/davshn/narsil-pet/main/assets/`. A faixa só guarda a pasta do estágio (`etapa4/`, por exemplo) do endereço do mod, coloca a pose desta conversa e escolhe `-claro` (claro) ou `-oscuro` (escuro) de acordo com o modo da página. Um endereço de qualquer outro lugar é recusado, então um estado forjado não consegue fazer a faixa carregar um desenho de outro site.

Quando não há estado do mod, ou um desenho falha ao carregar, a faixa mostra no lugar o ícone do próprio app, servido a partir de `https://claude.ai/__narsil__/page/icons/icon-192.png`. Um desenho que falhou não é pedido de novo.

### De `<topic>-estado` até a página: `StateFeed` e `StateModel`

Na extensão, um script de fundo lia o ntfy.sh. No app, quem lê é o Kotlin, e só enquanto uma página mostra a faixa. Quando `content.js` abre a sua porta, `host.js` envia `connect`, e a `MainActivity` chama `StateFeed.start()`. De `StateFeed.kt` no narsil-android (MIT):

```kotlin
    @Synchronized
    fun start() {
        stop()
        val mine = run
        val topic = settings.topic
        if (topic == null) {
            post(JSONObject().put("type", "no-topic").toString())
            return
        }
        val key = settings.key
        model = settings.model(topic) ?: StateModel.empty()
        send()
        stream = NtfyStream(NtfyStream.topicUrl("$topic-estado"), "12h") { raw ->
            synchronized(this) {
                if (mine != run) return@synchronized
                model = StateModel.receive(model, raw, key)
                settings.saveModel(topic, model)
                send()
            }
        }.also { it.start() }
    }
```

Passo a passo:

1. **Sem tópico, sem feed.** A página recebe `{ type: 'no-topic' }`, e o bloco do menu lateral pede que você toque e escreva um.
2. **O último estado conhecido, na hora.** O app guarda nas configurações o último modelo da faixa por tópico, então uma página que abre depois mostra a Narsil imediatamente, antes de o ntfy.sh responder.
3. **Depois o fluxo**, `https://ntfy.sh/<topic>-estado/json?since=12h`: primeiro o que o ntfy.sh guardou das últimas 12 horas, depois cada estado novo à medida que chega. `NtfyStream` é a mesma classe que os alertas usam; o [guia 6](/pt/android/alerts-service/) explica as suas reconexões.
4. **Cada mensagem** passa por `StateModel.receive`, é salva e é enviada à página como `{ type: 'model', model }`.

O contador `run` protege contra uma condição de corrida: se a página se desconecta e se conecta de novo enquanto uma mensagem está a caminho, a mensagem do fluxo antigo é descartada. Quando a página fica oculta, a faixa fecha a sua porta, `host.js` envia `disconnect`, e o fluxo para. Nada é lido do ntfy.sh enquanto você não está olhando para o Claude.

`StateModel.receive` só guarda o estado mais novo. De `StateModel.kt` (MIT):

```kotlin
    fun receive(model: JSONObject, raw: JSONObject, key: String?): JSONObject {
        if (raw.optString("event") != "message") return model
        val m = Seal.unseal(key, raw)
        if (m.optBoolean("sealed")) return JSONObject(model.toString()).put("isSealed", true)
        val state = try {
            JSONObject(m.optString("message"))
        } catch (_: JSONException) {
            return model
        }
        val kept = model.optJSONObject("state")?.optDouble("at", 0.0) ?: 0.0
        if (kept > state.optDouble("at", 0.0)) return model
        return JSONObject().put("state", state).put("isSealed", false)
    }
```

Keepalives e outros eventos são ignorados. Uma mensagem selada é aberta com a chave; se ela não abrir, o modelo é marcado como `isSealed` e mantém o estado que tinha. Uma mensagem que não é um objeto JSON é ignorada. E um estado mais antigo que o guardado (pelo campo `at`, em segundos) perde, então reproduzir 12 horas a cada conexão nunca faz a faixa andar para trás. `StateModelTest.kt` confere cada um desses casos. O [guia 7](/pt/android/encryption-and-settings/) trata do que o aviso do cadeado significa.

### A cada 10 segundos, só enquanto você olha

`content.js` pede novos dados a cada 10 segundos, e nunca enquanto a página está oculta: outro app na frente, a tela desligada ou as configurações do app abertas. Quando a página volta a ficar visível, ele pede na hora, a partir do evento [`visibilitychange`](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event), e abre a sua porta de novo, o que inicia um `StateFeed` novo com o tópico e a chave atuais. É por isso que uma chave que você acabou de digitar nas configurações vale assim que você volta. Entre as requisições, a faixa redesenha a cada 15 segundos, para que a contagem regressiva e o tempo `hace` continuem andando. Se uma requisição falhar, o que ela sabia por último fica até a próxima.

### No fluxo da página, para não cobrir nada

A faixa não é uma camada flutuante. É um elemento normal, `#narsil-event`, inserido logo antes da caixa de mensagem, encontrada pelo atributo `[data-cds=ChatComposer]` que a página põe nela. Como ela faz parte do próprio layout da página, a conversa acima simplesmente termina um pouco mais alto.

`band.css` começa cada parte da Narsil com `all: initial`, para que nenhum estilo do `claude.ai` vaze para dentro, e define as suas próprias cores como variáveis, com um conjunto claro sob `html[data-mode="light"]`. Ele também desfaz uma regra da própria skin da Narsil: o [guia 5](/pt/android/colors-and-mode/) deixa todo o texto do Claude em negrito, e a faixa restaura os seus pesos com `!important`. O texto é limitado a duas linhas com [`line-clamp`](https://developer.mozilla.org/en-US/docs/Web/CSS/line-clamp); um toque alterna `narsil-open`, que o deixa rolar dentro de no máximo 40 % da altura da tela (`40dvh`). Todo o texto entra com `textContent`, nunca como HTML.

### Acompanhar a página enquanto ela muda

O `claude.ai` é um app de página única: abrir outra conversa muda o endereço e o conteúdo sem carregar uma nova página, e a página às vezes reconstrói a caixa de mensagem. Por isso a faixa não pode ser posicionada uma vez só.

`lib/watch.js` contém o único [`MutationObserver`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) de todos os scripts da Narsil, observando o documento inteiro. Enquanto o Claude escreve, a página muda muitas vezes por quadro, então ele roda os seus callbacks no máximo uma vez por quadro, com [`requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame). A cada execução, a faixa confere duas coisas:

- **Ela ainda está logo acima da caixa de mensagem?** Se não, ela volta para lá.
- **Esta ainda é a mesma conversa?** Ela compara o id no endereço com o último que ela consultou. Quando ele muda, os dados antigos são descartados, a faixa desaparece e novos dados são pedidos na hora.

Ela só escreve um valor quando ele mudou, já que cada escrita própria é mais uma mudança para o observador.

Duas partes desses scripts são sobras da extensão que fazem pouco no app. O observador para sozinho quando a sua extensão sai, conferindo `browser.runtime.id`; `host.js` sempre responde `'narsil-android'`, então no app ele nunca para por esse motivo. E `lib/restore.js` existia para devolver scripts e estilos depois que o Vivaldi no Android os descartava. No app só uma parte dele roda: `missingStyles`, que confere as marcas `--narsil-css-skin` e `--narsil-css-band` que cada folha de estilo define em `:root`. Se faltar uma, `content.js` envia `narsil-missing`, e `host.js` adota a folha de estilo de novo.

### Tocar na faixa, e tocar na Narsil

Um toque na faixa só abre ou fecha o seu texto. O toque que abre as configurações do app é na Narsil no bloco do menu lateral, `#narsil-band .narsil-head` em `host.js`; o [guia 4](/pt/android/sidebar/) o mostra. Os nomes podem confundir: no código, `narsil-band` é o bloco do menu lateral, e esta faixa é `narsil-event`.

## Construa com o Claude

Peça ao Claude as duas metades de uma vez: um script de página que desenhe uma faixa acima da caixa de mensagem a partir dos próprios dados do `claude.ai`, e um feed em Kotlin que lhe envie o estado do mod pelo canal da WebView. A única ideia que ele precisa acertar é que a página só lê, só enquanto você olha, e que o estado que chega a ela é o mais novo, já aberto.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> O meu app Android hospeda `https://claude.ai` numa WebView e roda um script de página no início do documento, com um canal `myHost` para o Kotlin. No script de página, desenhe uma faixa logo antes de `[data-cds=ChatComposer]`, como o seu irmão anterior. Pegue o id da conversa de `location.pathname` (`/code/session_…`). A cada 10 segundos, e só enquanto `document.hidden` for false, faça `GET` da lista de conversas e dos seus últimos 60 eventos com `fetch` e `credentials: 'include'`. Mostre o estado a partir de `status_bucket`, o percentual de contexto, o último texto que o Claude escreveu e há quanto tempo, e uma contagem regressiva do cache a partir da hora do último evento do Claude mais um número de minutos que o app envia. Use um único `MutationObserver` limitado com `requestAnimationFrame`. Escreva texto só com `textContent`. No Kotlin, quando a página disser `connect`, acompanhe `https://ntfy.sh/<topic>-estado/json?since=12h` numa thread de fundo, guarde só a mensagem com o maior `at`, salve-a e envie-a à página; pare com `disconnect`. Mantenha as regras em módulos puros e teste-as.

### O que conferir na resposta do Claude

1. A faixa é inserida logo antes da caixa de mensagem, e não como uma camada `position: fixed`.
2. As requisições são só `GET`, com `credentials: 'include'`, e nenhuma sai enquanto `document.hidden` é verdadeiro.
3. A contagem regressiva do cache começa no último evento do Claude, não no último evento da conversa.
4. O lado Kotlin guarda o mais novo de dois estados pelo `at`, então reproduzir as últimas 12 horas nunca faz a faixa andar para trás.
5. Um endereço de desenho só é aceito a partir de um prefixo fixo, e só a pasta do estágio é tirada dele.
6. O feed para quando a página se desconecta ou uma nova página começa a carregar, e uma mensagem atrasada de um fluxo antigo é descartada.

Se uma verificação falhar, diga ao Claude o que você vê: "depois que eu troco de conversa, a faixa mostra o texto da anterior por alguns segundos".

### Como a pessoa autora pediu

As palavras da pessoa autora para este app estão registradas em `odd/tasks/android-app.md`. A L1 pedia uma web view que "muestre la web de claude y modifique sus estilos como lo hace esta extension" (mostre a web do Claude e mude os seus estilos como esta extensão faz), e a L3, que os estilos fossem os da própria extensão. Então a faixa não foi redesenhada para o app: o pedido era trazer a faixa da extensão sem mudanças.

O registro de tarefas também registra como ela foi conferida num celular real, com a sessão iniciada: "With a state published to the throwaway topic's -estado, the sidebar band showed level, XP, ntfy's count and Narsil's art from raw.githubusercontent.com (the page's CSP lets it load), and the strip above the composer showed TRABAJANDO, context, cache and her pose." (Com um estado publicado no -estado do tópico descartável, o bloco do menu lateral mostrou o nível, a XP, a contagem do ntfy e o desenho da Narsil vindo de raw.githubusercontent.com, que a CSP da página deixa carregar, e a faixa acima da caixa de mensagem mostrou TRABAJANDO, o contexto, o cache e a pose dela.)

O resto é reconstruído a partir do histórico de commits (um nome de projeto num assunto é substituído por uma descrição entre colchetes):

- `3bcea35` (2026-11-24) "feat: build the script that hosts [the earlier extension] in a WebView, and what alerts and states keep" (montar o script que hospeda a [extensão anterior] numa WebView, e o que os alertas e os estados guardam). Chegam o `StateModel` e os scripts de página.
- `53c55c1` (2026-11-24) "feat: host claude.ai with [the earlier extension] in a WebView, and show Narsil's alerts from a foreground service" (hospedar o claude.ai com a [extensão anterior] numa WebView, e mostrar os alertas da Narsil a partir de um serviço em primeiro plano). A sua mensagem: "The band's state follows <topic>-estado while the band shows" (o estado da faixa acompanha <topic>-estado enquanto a faixa aparece).
- `ca01cc7` (2026-11-24) "docs: log the band verified with a signed-in session" (registrar a faixa conferida com uma sessão iniciada).
- `5ad4577` (2026-11-24) "refactor: make the band's scripts the app's own, and stop naming the projects it replaces" (tornar os scripts da faixa do próprio app, e parar de nomear os projetos que ele substitui).

## Código de referência

Esta é uma resposta correta, escrita para este guia (MIT). Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

As regras da faixa como um módulo puro, sem DOM, com a forma de `lib/live.js`. Ele recebe a conversa, os seus eventos (do mais novo para o mais antigo) e a duração do cache, e devolve o que mostrar.

```js
const STATES = {
  working: { label: 'TRABAJANDO', color: '#3B8BFF' },
  blocked: { label: 'TE NECESITA', color: '#F5B400' },
  completed: { label: 'TERMINADA', color: '#22B573' },
}
const AT_REST = { label: 'EN REPOSO', color: '#8A90A6' }

const secondsOf = (event) => Date.parse(event.created_at) / 1000

export function stripOf(session, events, cacheMinutes, now) {
  const said = events.find((event) => event.event_type === 'assistant')
  const blocks = Array.isArray(said?.payload?.message?.content) ? said.payload.message.content : []
  const words = blocks
    .filter((block) => block.type === 'text' && block.text?.trim())
    .map((block) => block.text.trim())
    .join('\n')
  const tool = blocks.filter((block) => block.type === 'tool_use').pop()
  const left = said
    ? Math.max(0, Math.ceil((secondsOf(said) + cacheMinutes * 60 - now) / 60))
    : null
  return {
    ...(STATES[session.status_bucket] ?? AT_REST),
    text: words || (tool ? `Usando ${tool.name}` : ''),
    cache: left === null ? '' : left > 0 ? `🧊 ${left} min` : '🧊 fría',
  }
}
```

Ele é mais simples que o real de propósito: só lê o evento mais novo do Claude, enquanto `lastSaid` em `lib/live.js` volta para trás passando por eventos que só têm raciocínio. Salve-o como `strip.js`. Um teste para ele com `node --test`, também escrito para este guia:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { stripOf } from './strip.js'

const at = (iso, content) => ({
  event_type: 'assistant',
  created_at: iso,
  payload: { message: { content } },
})

test('a tool call alone says what Claude is using', () => {
  const now = Date.parse('2026-11-24T10:10:00Z') / 1000
  const events = [at('2026-11-24T10:00:00Z', [{ type: 'tool_use', name: 'Bash' }])]
  const strip = stripOf({ status_bucket: 'working' }, events, 60, now)
  assert.equal(strip.label, 'TRABAJANDO')
  assert.equal(strip.text, 'Usando Bash')
  assert.equal(strip.cache, '🧊 50 min')
})

test('an hour and a minute later the cache is cold', () => {
  const now = Date.parse('2026-11-24T11:01:00Z') / 1000
  const events = [at('2026-11-24T10:00:00Z', [{ type: 'text', text: 'Listo.' }])]
  assert.equal(stripOf({ status_bucket: 'completed' }, events, 60, now).cache, '🧊 fría')
})
```

## Erros comuns e como testar

- **Um observador por funcionalidade.** Vários observadores numa página que muda muitas vezes por quadro se somam. Use um só e rode o trabalho dele no máximo uma vez por quadro.
- **Escrever a cada execução.** Definir `textContent` ou mover a faixa quando nada mudou acorda o observador de novo. Compare antes.
- **Uma faixa flutuante.** Uma faixa com `position: fixed` cobre as últimas linhas da conversa e os botões que o Claude mostra ali.
- **Requisições enquanto está oculta.** Um celular com a tela desligada continuaria perguntando a cada 10 segundos. Confira `document.hidden`.
- **O cache a partir do último evento.** Abrir a página cria eventos, então contar a partir do último reinicia a contagem regressiva toda vez que você olha.
- **O último estado, e não o mais novo.** Cada conexão reproduz 12 horas, do mais antigo para o mais novo, por cima de um estado salvo que pode ser mais novo. Compare o `at`.
- **Texto como HTML.** As mensagens do Claude, e qualquer coisa num tópico do ntfy.sh, podem conter qualquer coisa. Use `textContent`.
- **Esperar a faixa na página inicial do Claude.** Ela só aparece na página de uma conversa, com a caixa de mensagem presente.

Para testar as regras no computador, mantenha-as em módulos sem DOM, como faz `lib/live.js`, e alimente-as com eventos inventados, como no código de referência. Do lado Kotlin, `./gradlew testDebugUnitTest` roda o `StateModelTest`, que confere que um estado é guardado, que o mais novo de dois vence, que keepalives e mensagens que não são JSON são ignorados e que um estado selado que a chave não consegue abrir é marcado.

No celular, publique um estado inventado num tópico de teste que você colocou nas configurações, a partir do computador:

```bash
curl -d '{"xp":"⭐ Nivel 3 · 40/300 XP","art":"https://raw.githubusercontent.com/davshn/narsil-pet/main/assets/etapa3/parada-oscuro.png","at":1795000000,"cacheMinutes":5}' https://ntfy.sh/narsil-0000000000example0-estado
```

Abra uma conversa: em um segundo, a Narsil da faixa deve mostrar o estágio 3 na pose da conversa, e o cache deve contar regressivamente a partir de 5 minutos depois da última resposta do Claude. Depois troque de conversa, gire o celular e desligue e ligue a tela: a faixa deve ficar acima da caixa de mensagem, mudar com a conversa e se atualizar até 10 segundos depois de você voltar.

### Onde o código e o README diferem

- Os comentários em `band.css` e `lib/state.js` ainda descrevem a extensão: "A stylesheet of the manifest's, not a `<style>` the script adds" (uma folha de estilo do manifesto, não um `<style>` que o script acrescenta), e "the background page loads it after seal.js" (a página de fundo o carrega depois do seal.js). No app não há manifesto, nem página de fundo, nem `seal.js`: a folha de estilo entra como uma folha construída a partir de `host.js`, e o Kotlin abre os estados selados. O código se comporta como este guia descreve; só esses comentários estão desatualizados.

## Para ir além

- O [guia 4](/pt/android/sidebar/) trata do bloco no menu lateral, onde um toque na Narsil abre as configurações.
- O [guia 6](/pt/android/alerts-service/) explica o `NtfyStream`, a classe que acompanha o `-estado` aqui e o seu tópico para os alertas.
- Dentro do Claude Code, a Narsil mostra os mesmos estados com as suas próprias regras: veja [O relógio do cache](/pt/mods/pet/cache-clock/) e, para os campos do `-estado`, [Alertas no celular e no relógio](/pt/mods/pet/phone-and-watch/).
- O mesmo estado também chega a um relógio: o [Narsil Watch](/pt/watch/what-it-is/).
- O código-fonte está em [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
