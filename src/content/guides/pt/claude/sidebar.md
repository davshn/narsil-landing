---
title: O bloco no menu lateral
description: 'O bloco abaixo de Pesquisar no menu lateral do claude.ai: o nível da Narsil e a contagem do ntfy do dia, vindos do mod pelo ntfy.sh, e os limites de 5 horas e da semana, do próprio claude.ai.'
route: claude
order: 3
updated: 2026-11-18
---

## O que faz

Abra o menu lateral no `claude.ai` e, logo abaixo de **Pesquisar**, a Narsil no Claude acrescenta um bloco com três tipos de dados:

| O quê                                                           | De onde vem                          |
| --------------------------------------------------------------- | ------------------------------------ |
| **A Narsil**, o nível dela e a experiência dela, com uma barra  | O mod narsil-pet, pelo ntfy.sh       |
| **`5 horas`** e **`Semana`**: os limites de 5 horas e da semana | O próprio `claude.ai`, a cada minuto |
| **`ntfy hoy`**: as mensagens do ntfy.sh do dia e o seu reinício | O mod narsil-pet, pelo ntfy.sh       |

Cada limite mostra um percentual, uma barra em verde, âmbar ou vermelho, e quando ele reinicia, como `reinicia en 2 h 05 min` ("reinicia em 2 h 05 min"). O nível aparece como `Narsil ⭐ Nivel 4` com `350/400 XP` ao lado.

O ntfy.sh é usado só para o que a página não consegue saber. O nível e a contagem mudam quando o mod envia um estado, o que acontece quando você escreve para o Claude Code pelo Remote Control. Quando a contagem tem mais de uma hora, o bloco avisa.

> **Experimental.** O bloco encontra o seu lugar pela estrutura do menu lateral do `claude.ai` e lê os limites de um endereço interno da página, não de uma API pública. Uma atualização do Claude pode quebrá-lo; quando isso acontece, o bloco deixa de aparecer. Ele só lê: nunca escreve na sua conta nem envia as suas conversas para lugar nenhum, embora a extensão carregue os desenhos da Narsil do GitHub e leia o tópico de estado dela no ntfy.sh.

## Como funciona por dentro

O bloco é desenhado por `extension/content.js`, como a faixa do [guia 2](/pt/mods/claude/conversation-band/). Os limites são lidos pelo próprio content script, a partir da página. O nível e a contagem são lidos pelo script de fundo, `extension/background.js`, com a ajuda de `lib/stream.js` e `lib/seal.js`, e guardados e formatados por `lib/state.js`.

### Encontrar Pesquisar em qualquer idioma

O bloco não é encontrado pela palavra "Pesquisar", que muda com o idioma da página. Ele é encontrado pelo lugar onde Pesquisar fica: num celular, o menu lateral é uma folha com Pesquisar no cabeçalho; numa tela mais larga, Pesquisar é o único botão direto do primeiro grupo do menu. O bloco é inserido logo depois dele.

A página monta o menu lateral tarde, e às vezes o monta de novo, então o bloco é recolocado pelo mesmo observador da página que a faixa usa: a cada execução, se ele não estiver logo depois de Pesquisar, ele vai para lá.

### Os limites, do `claude.ai` a cada minuto

Os limites de 5 horas e da semana são da sua conta, e o `claude.ai` já os conhece. O content script os lê do mesmo jeito que a faixa lê uma conversa, com a sessão da página e uma requisição `GET`:

1. **Qual conta.** O id da organização que a página tem aberta está num dos cookies da página, `lastActiveOrg`. O content script o lê de `document.cookie` e nunca o guarda.
2. **O uso.** Ele pede ao `claude.ai` o uso dessa organização, num endereço interno da página.
3. **Duas janelas.** Da resposta ele pega a janela de 5 horas e a janela de 7 dias: quanto foi usado, como percentual, e quando cada uma reinicia.

Ele pergunta uma vez quando a página carrega, depois a cada 60 segundos, e nunca enquanto a página está oculta. Quando a página volta a ficar visível, ele pergunta na hora.

### O nível e a contagem, do mod pelo ntfy.sh

O seu nível e a contagem do ntfy.sh vivem no seu computador, no mod. O narsil-pet os envia no seu tópico de estado silencioso: o seu tópico com `-estado` ("estado") no final, publicado depois de cada turno enquanto você escreve de longe ([Alertas no celular e no relógio](/pt/mods/pet/phone-and-watch/) descreve o tópico e os seus cinco campos). O README dele diz que esse tópico é lido por esta extensão "because they are data only the PC knows" (porque são dados que só o PC conhece).

O bloco usa três dos cinco campos:

- **`xp`**, um rótulo como `⭐ Nivel 4 · 350/400 XP` ([Experiência e crescimento](/pt/mods/pet/experience-and-growth/) explica os níveis). `lib/state.js` o divide no nome, nos pontos dentro do nível e nos pontos que ele precisa, para a barra.
- **`art`**, o endereço do desenho da Narsil no estágio dela. Ele só é aceito quando aponta para os próprios assets do narsil-pet.
- **`usage`**, uma linha chamada `ntfy` com o seu rótulo, percentual, cor, nota e hora de reinício.

O quarto campo, `at`, é quando o mod o enviou. Os dados mais novos sempre ganham: uma mensagem mais antiga que a já mostrada é ignorada.

### Por que o script de fundo lê o ntfy.sh, e não a página

Os content scripts rodam dentro do `claude.ai`, sob a Content Security Policy da página. Por isso é o `background.js` que faz a leitura. A própria descrição do código: dali, "claude.ai's Content-Security-Policy does not apply, and the topic and the key never reach the page." (a Content-Security-Policy do claude.ai não se aplica, e o tópico e a chave nunca chegam à página.)

Os dois lados conversam por uma porta ([MDN: runtime.connect](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/connect)):

1. Quando uma página do `claude.ai` mostra o bloco, o seu content script abre uma porta chamada `narsil-band`. O script de fundo só aceita portas da sua própria extensão.
2. Com a primeira porta, o script de fundo começa a ler; quando a última some, ele para. Uma página oculta fecha a sua porta, então nada é lido enquanto você não está olhando.
3. Cada vez que o estado muda, o script de fundo envia o estado já aberto a todas as portas. Ele nunca envia o tópico nem a chave.

### Primeiro consultar, depois acompanhar o fluxo

O ntfy.sh pode enviar um tópico como um fluxo JSON, "one JSON message object per line" (um objeto de mensagem JSON por linha), e a sua opção `poll=1` encerra a conexão assim que as mensagens em cache são lidas ([ntfy: subscribe API](https://docs.ntfy.sh/subscribe/api/)). O script de fundo usa os dois, só no tópico `-estado`:

1. **Consultar as últimas 12 horas**: `https://ntfy.sh/<topic>-estado/json?poll=1&since=12h`. Isso traz na hora o estado mais recente.
2. **Acompanhar o fluxo** a partir do id da última mensagem recebida, para que nada seja lido duas vezes e nada se perca.

O fluxo é lido com `fetch` e um leitor de stream, linha por linha, não com `EventSource`. O motivo está em `lib/stream.js`: o pacote Chromium roda o script de fundo como um service worker, "which has no EventSource" (que não tem EventSource). Quando o fluxo termina, ele recomeça a partir da última mensagem que trouxe; quando falha, espera um segundo, depois o dobro a cada vez, até um minuto.

No Chromium, o service worker é parado depois de 30 segundos sem atividade ([Chrome: the extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)), e o fluxo com ele. Por isso, enquanto o bloco está à mostra, o content script envia uma palavra pela sua porta a cada 25 segundos para mantê-lo acordado.

O último estado também é salvo em `storage.local`, com o tópico ao qual pertence, para que uma página aberta depois o mostre na hora. O comentário do código explica por que isso basta: "what it brought is kept, as ntfy.sh keeps it for 12 h" (o que ele trouxe é guardado, já que o ntfy.sh o guarda por 12 h).

### Mensagens seladas e a chave

Se você ligou o `/narsil movil clave` no seu computador, o mod sela o que publica: o estado chega como um texto que começa com `narsil1:`, ilegível sem a chave. `lib/seal.js` o abre com a chave das opções, seguindo o esquema que o `hooks/seal.ts` do narsil-pet usa ([o guia do celular](/pt/mods/pet/phone-and-watch/) o descreve passo a passo):

1. Duas chaves são derivadas da sua: HMAC-SHA256 de `enc` e de `mac`.
2. O texto depois de `narsil1:` é decodificado de base64url num nonce de 16 bytes, no texto cifrado e numa tag de 32 bytes.
3. A tag é calculada de novo sobre o nonce e o texto cifrado, e comparada com a recebida. Se forem diferentes, a mensagem não é aberta.
4. Só então o texto é decifrado, 32 bytes de cada vez, com HMAC-SHA256 do nonce e de um contador de blocos como fluxo de chave.

O mod constrói o HMAC à mão porque o seu módulo de hooks só tem SHA-256. A extensão não precisa: o WebCrypto do navegador tem HMAC embutido ([MDN: SubtleCrypto.sign](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/sign)), e o comentário do narsil-pet diz que o HMAC do WebCrypto "gives the same bytes" (dá os mesmos bytes).

Quando uma mensagem selada não abre, porque não há chave ou ela é a errada, o bloco mostra `🔒 Toca y pon la clave` ("toque e informe a chave"), e um toque abre as opções. Uma mensagem que não está selada é lida como está, com ou sem chave.

### O que os leitores do tópico poderiam fazer, e como o bloco se defende

Sem chave, qualquer pessoa que conheça o seu tópico também pode publicar nele. Por isso o que chega do ntfy.sh nunca é tratado como marcação confiável: cada valor entra no bloco com `textContent`, e um desenho só é mostrado quando o seu endereço começa pela pasta de assets do próprio narsil-pet. Um estado falso poderia mostrar um nível ou uma contagem errados, mas não pode acrescentar um link, um script ou uma imagem de outro lugar.

### "Mais de uma hora", e por que a contagem vem do PC

O mod só envia um estado enquanto você escreve de longe. Quando você volta para a mesa, o último estado fica, e envelhece. Por isso, quando um estado tem mais de uma hora, a linha `ntfy hoy` acrescenta uma nota como `dato de hace 3 h` ("dado de 3 h atrás"). O nível não recebe essa nota.

A própria contagem tem de vir do computador, porque o ntfy.sh conta as mensagens por endereço IP. O mod pergunta ao ntfy.sh, a partir da rede do computador, quantas mensagens essa rede enviou hoje, e põe a resposta no seu estado. Se o celular perguntasse, o ntfy.sh responderia sobre a rede do celular, que não envia nada. Como o guia do celular explica, esse dia também começa numa hora própria do ntfy.sh, não à meia-noite, e é por isso que a linha mostra a sua própria hora de reinício.

## Construa com o Claude

Peça ao Claude um bloco depois do botão Pesquisar do menu lateral, alimentado por um script de fundo que acompanha o tópico de estado do mod no ntfy.sh. A única ideia que ele precisa acertar é que o tópico fica no script de fundo e que nada vindo do ntfy.sh é confiável: chega à página só como texto.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> Na minha extensão para `https://claude.ai/*`, acrescente um bloco logo depois do botão Pesquisar do menu lateral, encontrado pela sua posição, não pelo seu texto. O content script abre uma porta `runtime.connect` para o script de fundo enquanto a página está visível e a fecha quando ela fica oculta. O script de fundo lê o tópico de `storage.local`, consulta `https://ntfy.sh/<topic>-estado/json?poll=1&since=12h` e depois acompanha o mesmo fluxo JSON com `fetch` e um leitor de stream a partir do id da última mensagem, tentando de novo com uma espera que dobra até 60 s. Ele envia o estado mais novo já interpretado a todas as portas, nunca o tópico. No bloco, mostre o campo `xp` como texto com `textContent`, aceite uma URL de imagem só de um prefixo fixo e acrescente "dado de N h atrás" quando o `at` do estado tiver mais de uma hora. Teste a interpretação e o fluxo com `node --test`, passando um `fetch` falso.

### O que conferir na resposta do Claude

1. Pesquisar é encontrado pela sua posição, não pelo seu texto, então o bloco continua aparecendo quando a página está em outro idioma.
2. Só o script de fundo lê o tópico de `storage.local` e fala com o ntfy.sh. Ele envia o estado às portas, nunca o tópico.
3. Primeiro consulta `https://ntfy.sh/<topic>-estado/json?poll=1&since=12h`, depois acompanha o fluxo a partir do id da última mensagem, e espera o dobro do tempo depois de cada falha, até 60 segundos.
4. A porta fica aberta enquanto a página está visível e fechada enquanto está oculta, então nada é lido enquanto você não está olhando.
5. Cada valor entra com `textContent`, uma imagem só é mostrada a partir de um endereço fixo, e um estado cujo `at` tem mais de uma hora ganha o aviso "dado de N h atrás".

Se uma verificação falhar, diga ao Claude o que você vê: "depois que eu desligo e ligo a rede, o nível nunca mais muda".

### Como a pessoa autora pediu

Nenhum pedido para o bloco foi registrado. As palavras da pessoa autora registradas para este caminho são sobre o site (o [guia 1](/pt/mods/claude/what-it-is/) as cita). O que segue é reconstruído a partir do histórico de commits da extensão:

- `c200e8a` (2026-11-09) "feat: show Narsil's state in claude.ai's sidebar on Firefox for Android" (mostrar o estado da Narsil no menu lateral do claude.ai no Firefox para Android). A primeira versão: "A row under the search, with a panel for the conversations, limits, cache and alerts" (uma linha abaixo da pesquisa, com um painel para as conversas, os limites, o cache e os alertas), lendo o ntfy.sh "from the background page, live while the page shows it" (a partir da página de fundo, ao vivo enquanto a página o mostra).
- `00adbb9` (2026-11-09) "feat: show only Narsil's level, the limits and ntfy's count in the sidebar" (mostrar no menu lateral só o nível da Narsil, os limites e a contagem do ntfy). Os limites passaram para o próprio `claude.ai`: "ntfy.sh is only read for what the page cannot know: her level and its own count, so the extension no longer follows the alerts topic." (o ntfy.sh só é lido para o que a página não consegue saber: o nível dela e a sua própria contagem, então a extensão deixa de acompanhar o tópico de alertas.)
- `11dadb3` (2026-11-10) "feat: run the extension in Vivaldi for Android as a Chromium package" (rodar a extensão no Vivaldi para Android como um pacote Chromium). O fluxo passou de `EventSource` para `fetch`, com a espera crescente depois de uma falha e a palavra a cada 25 segundos.

Do lado do mod, o `544ef89` (2026-11-09) do narsil-pet, "feat: send only what the Firefox extension reads through ntfy" (enviar pelo ntfy só o que a extensão do Firefox lê), reduziu o seu estado aos cinco campos acima, no mesmo dia.

## Código de referência

Esta é uma resposta correta, escrita para este guia. Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

As duas metades, escritas para este guia (MIT). O script de fundo acompanha o tópico de estado e envia o que lê para o bloco; o content script o mostra. Teste-o com um tópico inventado como `narsil-0123456789abcdef0123`, num tópico seu.

`background.js`:

```js
const ports = new Set()
let controller = null
let latest = null

async function follow(topic, signal) {
  let since = null
  let wait = 1000
  while (!signal.aborted) {
    try {
      const query = since ? `?since=${encodeURIComponent(since)}` : '?since=12h'
      const response = await fetch(`https://ntfy.sh/${topic}-estado/json${query}`, { signal })
      if (!response.ok || !response.body) throw new Error(`ntfy.sh ${response.status}`)
      wait = 1000
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
      let rest = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        const lines = (rest + value).split('\n')
        rest = lines.pop()
        for (const line of lines.filter(Boolean)) {
          const message = JSON.parse(line)
          if (message.event !== 'message') continue
          since = message.id
          latest = JSON.parse(message.message)
          ports.forEach((port) => port.postMessage(latest))
        }
      }
    } catch {
      if (signal.aborted) return
      await new Promise((resolve) => setTimeout(resolve, wait))
      wait = Math.min(wait * 2, 60_000)
    }
  }
}

browser.runtime.onConnect.addListener(async (port) => {
  if (port.sender?.id !== browser.runtime.id) return
  ports.add(port)
  port.onDisconnect.addListener(() => {
    ports.delete(port)
    if (ports.size === 0) controller?.abort()
  })
  if (latest) port.postMessage(latest)
  if (ports.size > 1) return
  const { topic } = await browser.storage.local.get('topic')
  if (!/^[-_A-Za-z0-9]{1,64}$/.test(topic ?? '')) return
  controller = new AbortController()
  follow(topic, controller.signal)
})
```

No content script:

```js
const level = document.createElement('div')
const port = browser.runtime.connect({ name: 'my-block' })
port.onMessage.addListener((status) => {
  const hours = Math.floor((Date.now() / 1000 - (status.at ?? 0)) / 3600)
  level.textContent =
    hours >= 1 ? `${status.xp} · data from ${hours} h ago` : String(status.xp ?? '')
})
```

O `TextDecoderStream` e o leitor de stream são padrão ([MDN: Using readable streams](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams)), e funcionam num service worker do Chromium, onde o `EventSource` não funciona. Uma mensagem que não é JSON válido lança um erro dentro do laço e o fluxo recomeça logo depois dela, o que basta para um exemplo; a extensão, em vez disso, pula essas linhas.

## Erros comuns e como testar

- **Ler o ntfy.sh a partir da página.** O content script precisaria do tópico, e também qualquer outra coisa rodando na página. Mantenha o tópico no script de fundo.
- **Encontrar Pesquisar pelo texto.** O rótulo muda com o idioma da página. Encontre-o pela posição.
- **`EventSource` no Chromium.** O service worker não tem; use `fetch` e leia o corpo.
- **Um fluxo que nunca recomeça.** O ntfy.sh, a rede ou o celular vão fechá-lo. Recomece a partir do id da última mensagem e espere mais depois de cada falha.
- **Um service worker adormecido.** O Chromium para um service worker ocioso depois de 30 segundos, e o fluxo para com ele. Mantenha-o acordado enquanto o bloco está à mostra, e deixe-o dormir quando nada está.
- **Confiar no tópico.** Sem chave, qualquer pessoa com o nome pode publicar. Mostre só texto, e imagens de um endereço fixo.
- **Pedir a contagem ao ntfy.sh a partir do celular.** A resposta é sobre a rede do celular. A contagem tem de vir do computador.
- **Uma contagem que nunca se move.** O mod só envia o seu estado enquanto você escreve pelo Remote Control. Na mesa, o bloco mantém o último e marca a idade dele.

Para testar, publique um estado inventado no seu próprio tópico de teste a partir de um computador: `curl -d '{"xp":"⭐ Nivel 2 · 40/200 XP","at":1700000000}' https://ntfy.sh/narsil-0123456789abcdef0123-estado` ([ntfy: publishing](https://docs.ntfy.sh/publish/)), com um tópico que você inventou. O bloco deve mostrar o nível em até um segundo, e a nota de idade, já que esse `at` ficou muito para trás. Depois desligue a rede por um minuto e ligue de novo: o fluxo deve retomar, e um estado publicado enquanto ela estava desligada deve chegar.

## Para ir além

- O [guia 4](/pt/mods/claude/colors-and-icon/) veste a página inteira com as cores da Narsil e dá ao app da tela inicial o ícone dela.
- O [guia 5](/pt/mods/claude/android-packaging/) explica o pacote Chromium, e por que o script de fundo dele precisa da palavra a cada 25 segundos.
- Os limites poderiam avisar antes de você chegar a eles, como a Narsil faz dentro do Claude Code: veja [Contexto e limites](/pt/mods/pet/context-and-limits/).
