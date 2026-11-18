---
title: A faixa acima da caixa de mensagem
description: 'A faixa que a Narsil no Claude desenha acima da caixa de mensagem do claude.ai: a pose dela, o estado, o contexto, o cache e o último evento, lidos dos dados da própria página.'
route: claude
order: 2
updated: 2026-11-18
---

## O que faz

Quando você abre uma conversa no `claude.ai/code`, uma faixa aparece logo acima da caixa onde você escreve. Da esquerda para a direita e de cima para baixo, ela mostra:

- **A Narsil**, no estágio atual dela e na pose do estado da conversa.
- **O estado**, como uma etiqueta colorida: `TRABAJANDO` (trabalhando, azul), `TE NECESITA` (precisa de você, âmbar), `TERMINADA` (terminada, verde) ou `EN REPOSO` (em repouso, cinza). A borda esquerda da faixa ganha a mesma cor.
- **O contexto**, como `Contexto 42 %`: quanto da sua janela a conversa já usou, em verde, âmbar ou vermelho.
- **O cache**, como `🧊 38 min`: os minutos que faltam para o cache do prompt expirar, até ele virar `🧊 fría` ("fria").
- **O último evento**: a última coisa que o Claude disse, ou `Usando Bash` ("usando o Bash") quando o Claude só está rodando uma ferramenta, com há quanto tempo, como `hace 3 min` ("há 3 min").

O texto ocupa duas linhas. Um toque o abre inteiro e outro toque o fecha. A faixa empurra a conversa para cima em vez de cobri-la, e se atualiza a cada 10 segundos enquanto a tela está visível.

> **Experimental.** A faixa lê os mesmos dados que a página do `claude.ai` carrega para si mesma, de endereços internos que não são uma API pública, e encontra a caixa de mensagem pela estrutura da página. Uma atualização do Claude pode quebrá-la; quando isso acontece, a faixa simplesmente deixa de aparecer. Ela só lê e nunca envia os seus dados para lugar nenhum.

Tudo na faixa vem do próprio `claude.ai`, então ela não precisa de nenhuma mensagem do seu computador. Só dois detalhes dependem do [mod narsil-pet](https://github.com/davshn/narsil-pet): o estágio da Narsil no desenho e quanto tempo o cache dura.

## Como funciona por dentro

A faixa é desenhada pelo content script `extension/content.js`. O que ela faz com os dados vive em `extension/lib/live.js`, um módulo sem código de DOM, o que permite testar as regras isoladamente.

### De onde vêm os dados: as próprias requisições da página

A faixa não lê a conversa da tela. Ela faz ao `claude.ai` as mesmas perguntas que a página faz, com a sua sessão, e lê as respostas como JSON. Duas requisições saem juntas:

- **A lista das suas conversas**, ativas e pausadas, até 50 (`/v1/code/sessions` no `claude.ai`). A faixa pega a que você tem aberta, encontrada pelo id no endereço da página (`/code/session_…`). O endereço e a lista podem nomear a mesma conversa com prefixos diferentes, então os ids são comparados sem eles.
- **Os últimos 60 eventos dessa conversa**, do mais novo para o mais antigo (`/v1/code/sessions/<id>/events`).

São endereços internos do `claude.ai`. O código diz isso logo acima deles: "These addresses are not a public API and may change." (Estes endereços não são uma API pública e podem mudar.) Eles são o principal motivo de a extensão ser experimental.

Para enviar as requisições "como a própria página, com a sua sessão", o content script usa o `content.fetch` do Firefox quando ele existe. O MDN explica que no Firefox, com Manifest V2, `content.fetch()` faz "requests that behave as if they were sent by the content itself" (requisições que se comportam como se tivessem sido enviadas pelo próprio conteúdo); no Manifest V3 ele não está disponível, e o próprio `fetch` de um content script já roda no contexto da página ([MDN: Content scripts, XHR and Fetch](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts#xhr_and_fetch)). Por isso a extensão do Firefox usa `content.fetch` e o pacote Chromium para o Vivaldi recorre ao `fetch`. Os dois enviam os seus cookies (`credentials: 'include'`), então o `claude.ai` responde como responde à página. São só requisições `GET`, e as respostas ficam na página.

### De que é feito cada valor

`liveOf` em `lib/live.js` transforma a conversa e os seus eventos no que a faixa mostra:

| Valor         | Feito a partir de                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Estado        | O `status_bucket` da conversa: `working`, `blocked` ou `completed`; qualquer outra coisa é `EN REPOSO`.                   |
| Contexto      | `context_usage` nos metadados da conversa: tokens usados sobre o máximo da janela, arredondado para um percentual.        |
| Último evento | A mensagem mais nova do Claude que tem texto; se ela só tiver uma chamada de ferramenta, `Usando` e o nome da ferramenta. |
| Quando        | A hora dessa mensagem, como `ahora mismo`, `hace 5 min`, `hace 2 h` ou `hace 1 d`.                                        |
| Cache         | Essa mesma mensagem mais nova do Claude, mais quanto tempo o cache dura (abaixo).                                         |

Duas regras mantêm o último evento útil. Um raciocínio sozinho não diz nada, então uma mensagem sem texto e sem ferramenta é pulada. E só as mensagens do Claude contam: a conversa tem muitos outros tipos de eventos.

O contexto e o cache compartilham uma coloração: verde abaixo de 60 %, âmbar a partir de 60 %, vermelho a partir de 85 %, os mesmos limiares que os limites do menu lateral usam. Para o cache, o percentual é quanto do seu tempo já passou.

### O desenho da Narsil: a pose vem da página, o estágio vem do mod

A pose segue o estado: trabalhando, precisando de você, terminada ou parada em repouso. O estágio dela não é algo que o `claude.ai` saiba. Ele vem do mod: o estado que o narsil-pet envia pelo ntfy.sh leva o endereço do desenho dela, e o estágio dela é a pasta nesse endereço ([Experiência e crescimento](/pt/mods/pet/experience-and-growth/) explica os estágios). A faixa guarda o estágio dali, coloca a pose desta conversa e escolhe a variante clara ou escura de acordo com a página.

Os desenhos só são aceitos a partir dos próprios assets do narsil-pet no GitHub. Quando não há estado do mod, ou um desenho falha ao carregar, a faixa mostra no lugar o ícone da própria extensão, e um desenho que falhou não é pedido de novo.

### Por que o cache é uma estimativa

O `claude.ai` não diz quando o cache de uma conversa expira, então a faixa o estima: **a hora da última mensagem do Claude mais quanto tempo um cache dura**.

- **A partir da última mensagem do Claude**, não do último evento da conversa. O commit que acrescentou a faixa explica por quê: "as any event moves the session's own time" (já que qualquer evento move a hora da própria sessão). O código acrescenta que abrir a página gera alguns eventos próprios, o que reiniciaria a contagem regressiva toda vez que você olhasse.
- **Quanto tempo ele dura** é o mod que sabe: o narsil-pet envia `cacheMinutes` no seu estado ([O relógio do cache](/pt/mods/pet/cache-clock/) explica como ele decide entre 60 e 5 minutos). Sem esse valor, a faixa assume 60 minutos.

Então a contagem regressiva pode estar errada: o cache na verdade começa a partir da requisição, não da mensagem, e sem o mod um cache de 5 minutos aparece como 60. Leia `🧊 38 min` como "uns 38 minutos".

### A cada 10 segundos, só enquanto você olha

A faixa pede novos dados a cada 10 segundos, e nunca enquanto a página está oculta (a tela desligada, outro app ou outra aba na frente). Quando a página volta a ficar visível, ela pede na hora, usando o evento [`visibilitychange`](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event). Entre as requisições, ela redesenha a cada 15 segundos, para que a contagem regressiva e o tempo "hace" continuem andando. Se uma requisição falhar, o que ela sabia por último fica até a próxima.

### No fluxo da página, para não cobrir nada

A faixa não é uma camada flutuante. É um elemento normal inserido logo antes da caixa de mensagem, como o seu irmão anterior. A caixa de mensagem é encontrada por um atributo que a página põe nela. Como a faixa faz parte do próprio layout da página, a conversa acima simplesmente termina um pouco mais alto; nada fica escondido atrás dela.

O texto é limitado a duas linhas com CSS ([`line-clamp`](https://developer.mozilla.org/en-US/docs/Web/CSS/line-clamp)). Um toque alterna uma classe que remove o limite e deixa o texto rolar dentro de uma caixa de no máximo 40 % da altura da tela. Todo o texto entra com `textContent`, nunca como HTML.

### Acompanhar a página enquanto ela muda

O `claude.ai` é um app de página única: abrir outra conversa muda o endereço e o conteúdo sem carregar uma nova página, e a página às vezes reconstrói a caixa de mensagem. Por isso a faixa não pode ser posicionada uma vez só.

`extension/lib/watch.js` contém o único [`MutationObserver`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) da extensão, observando o documento inteiro. Enquanto o Claude escreve, a página muda muitas vezes por quadro, então o observador não roda os seus callbacks a cada mudança: ele os agenda uma vez por quadro com [`requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame). A cada execução, a faixa confere duas coisas:

- **Ela ainda está logo acima da caixa de mensagem?** Se não, ela volta para lá.
- **Esta ainda é a mesma conversa?** A faixa compara o id no endereço com o último que ela consultou. Quando ele muda, os dados antigos são descartados, a faixa desaparece e novos dados são pedidos na hora.

A faixa só escreve um valor quando ele mudou, já que cada escrita própria é mais uma mudança para o observador. E o observador para, com tudo o que o usava, assim que a extensão é removida ou recarregada, para que uma cópia órfã não continue desenhando.

## Como foi pedido à IA

Nenhum pedido para a faixa foi registrado. As palavras da pessoa autora registradas para este caminho são sobre o site (o [guia 1](/pt/mods/claude/what-it-is/) as cita). O que segue é reconstruído a partir do histórico de commits da extensão:

- `c200e8a` (2026-11-09) "feat: show Narsil's state in claude.ai's sidebar on Firefox for Android" (mostrar o estado da Narsil no menu lateral do claude.ai no Firefox para Android). A primeira versão mostrava as conversas num painel no menu lateral, alimentado pelo mod através do ntfy.sh.
- `19677ac` (2026-11-09) "feat: show each conversation's state, context and cache above the prompt" (mostrar o estado, o contexto e o cache de cada conversa acima do prompt). Nasce a faixa. A sua mensagem a descreve como "read from the same addresses claude.ai uses, so it needs no message from the PC" (lida dos mesmos endereços que o claude.ai usa, então não precisa de nenhuma mensagem do PC) e explica a regra do cache citada acima.
- `00adbb9` (2026-11-09) "feat: show only Narsil's level, the limits and ntfy's count in the sidebar" (mostrar no menu lateral só o nível da Narsil, os limites e a contagem do ntfy). O painel e os seus alertas foram removidos, "as each conversation's strip covers them" (já que a faixa de cada conversa os cobre).
- `ce7d17e` (2026-11-11) "perf: lighten the styles and the page observers so claude.ai switches conversations faster" (aliviar os estilos e os observadores da página para que o claude.ai troque de conversa mais rápido). O observador único, limitado a uma execução por quadro.
- `1d9db3d` (2026-11-11) "fix: load the page observer with the band and stop when the extension goes away" (carregar o observador da página com a faixa e parar quando a extensão sai).

O histórico mostra uma passagem de dados enviados pelo computador para dados que a página já tinha: a faixa funciona no momento em que você abre uma conversa, mesmo com o computador desligado.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> Na minha extensão do Firefox para `https://claude.ai/*`, acrescente um content script que desenhe uma faixa de estado logo antes da caixa de mensagem da página, como o seu irmão anterior, para que ela empurre a conversa para cima em vez de cobri-la. Encontre o id da conversa em `location.pathname`. A cada 10 segundos, e só enquanto `document.hidden` for false, leia os dados da conversa com a própria sessão da página (`content.fetch` quando existir, senão `fetch`, com `credentials: 'include'`), só `GET`. Mostre o estado, o percentual de contexto, o último texto que o Claude escreveu e há quanto tempo, e uma contagem regressiva do cache estimada a partir da hora da última mensagem do Claude mais 60 minutos. Use um único `MutationObserver` no documento, limitado com `requestAnimationFrame`, para recolocar a faixa quando a página se reconstruir e para reiniciá-la quando a conversa mudar. Escreva texto só com `textContent`. Limite o texto a duas linhas e deixe um toque expandi-lo. Mantenha as regras num módulo sem código de DOM e teste-as com `node --test`.

## O código mínimo

Um pequeno content script com a mesma forma, escrito para este guia (MIT). `readConversation` representa o que quer que leia os seus dados; aqui ele devolve a hora da última mensagem do Claude, em segundos. O resto é a mecânica da faixa: posicioná-la, acompanhar a página, atualizar enquanto está visível e estimar o cache.

```js
const BOX = '[data-cds=ChatComposer]'
const CACHE_MINUTES = 60
const band = document.createElement('div')
band.id = 'my-band'
const text = document.createElement('span')
band.append(text)
band.addEventListener('click', () => band.classList.toggle('open'))

let lastSaidAt = null

function cacheLabel(saidAt, now) {
  const left = Math.ceil((saidAt + CACHE_MINUTES * 60 - now) / 60)
  return left > 0 ? `🧊 ${left} min` : '🧊 cold'
}

function draw() {
  const box = document.querySelector(BOX)
  if (!box || lastSaidAt === null) {
    band.remove()
    return
  }
  const label = cacheLabel(lastSaidAt, Date.now() / 1000)
  if (text.textContent !== label) text.textContent = label
  if (box.previousElementSibling !== band) box.before(band)
}

async function refresh() {
  if (document.hidden) return
  try {
    lastSaidAt = await readConversation(location.pathname)
  } catch {
    return
  }
  draw()
}

let queued = false
new MutationObserver(() => {
  if (queued) return
  queued = true
  requestAnimationFrame(() => {
    queued = false
    draw()
  })
}).observe(document.documentElement, { childList: true, subtree: true })

document.addEventListener('visibilitychange', refresh)
setInterval(refresh, 10_000)
refresh()
```

O CSS para as duas linhas e o toque:

```css
#my-band span {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

#my-band.open span {
  display: block;
  max-height: 40dvh;
  overflow-y: auto;
}
```

`BOX` é o atributo que o `claude.ai` põe hoje na sua caixa de mensagem; se o Claude o renomear, é esta a linha que quebra. Comparar `box.previousElementSibling` antes de chamar [`before()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/before) importa: mover a faixa a cada quadro seria uma mudança própria, e o observador acordaria de novo.

## Erros comuns e como testar

- **Um observador por funcionalidade.** Vários observadores numa página que muda muitas vezes por quadro se somam. Use um só e rode o trabalho dele no máximo uma vez por quadro.
- **Escrever a cada execução.** Definir `textContent` ou mover a faixa quando nada mudou dispara o observador de novo. Compare antes.
- **Uma faixa flutuante.** Uma faixa com `position: fixed` cobre as últimas linhas da conversa e os botões que o Claude mostra ali. Insira-a no fluxo da página.
- **Requisições enquanto está oculta.** Um celular com a tela desligada continuaria perguntando a cada 10 segundos. Confira `document.hidden` e escute `visibilitychange`.
- **O cache a partir do último evento.** Abrir a página cria eventos, então contar a partir do último reinicia a contagem regressiva toda vez que você olha. Conte a partir da última mensagem do Claude.
- **Texto como HTML.** As mensagens do Claude podem conter qualquer coisa. Use `textContent`, nunca `innerHTML`.
- **Não reiniciar numa conversa nova.** Sem comparar o id no endereço, a faixa mostra os dados da conversa anterior por até 10 segundos.

Para testar as regras, mantenha-as num módulo sem DOM, como faz `lib/live.js`, e alimente-as com eventos inventados: uma lista em que a mensagem mais nova do Claude só tem uma chamada de ferramenta deve dar `Usando` e o nome da ferramenta, e uma mensagem de 61 minutos atrás deve dar o cache frio. Para testar a própria faixa, abra uma conversa, troque para outra e volte, gire o celular, e desligue e ligue a tela: a faixa deve ficar acima da caixa de mensagem, mudar com a conversa e se atualizar até 10 segundos depois de a tela voltar.

## Para ir além

- O [guia 3](/pt/mods/claude/sidebar/) trata do bloco no menu lateral, que acrescenta o que a página não consegue saber.
- Dentro do Claude Code, a Narsil mostra os mesmos estados com as suas próprias regras: veja [O relógio do cache](/pt/mods/pet/cache-clock/) e [Contexto e limites](/pt/mods/pet/context-and-limits/).
- A faixa poderia avisar quando o cache está prestes a esfriar. Ela precisaria da duração real do cache, e é por isso que a extensão a pega do mod quando pode.
