---
title: A janela flutuante
description: 'Como a Narsil mostra uma janela sempre visível quando o Claude está minimizado ou algo espera por você, e por que o servidor local escuta só em 127.0.0.1 com chave de página e token.'
route: pet
order: 5
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: overlay/server.cjs
  - repo: pet
    path: overlay/overlay.html
  - repo: pet
    path: overlay/watch.ps1
  - repo: pet
    path: overlay/mac-claude.js
  - repo: pet
    path: overlay/start.sh
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: odd/tasks/animated-poses.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/overlay-server.check.cjs
---

## O que faz

A faixa acima do prompt só ajuda enquanto você está olhando para o Claude. Quando você o minimiza para ler uma página ou responder a uma mensagem, um turno terminado ou uma pergunta passa despercebido.

A janela flutuante preenche essa lacuna. É uma janela pequena, de 330 por 450 pixels, que:

- **Aparece quando o Claude está minimizado** (ou fechado) e **se esconde sozinha** quando você volta ao Claude.
- **Aparece quando algo espera por você**, mesmo que o Claude esteja apenas atrás de outro aplicativo: uma pergunta, uma permissão, um erro ou um turno terminado.
- **Fica por cima** das outras janelas no Windows, no canto da tela em que o Claude está, sem tirar o foco do teclado daquilo que você está fazendo.
- Mostra a Narsil com a conversa mais importante (ou aquela cujo alerta está esperando), os limites da conta e todas as conversas abertas numa lista que rola. Pressionar uma conversa abre o seu contexto, tarefas, subagentes, cache e próximos passos, com um botão que traz essa conversa para a frente no aplicativo de desktop.

Um alerta de "terminado" sai sozinho depois de 20 segundos; uma pergunta ou um erro fica até você olhar para o Claude ou dispensá-lo. Se você fechar a janela, o próximo alerta a traz de volta, mas não antes de um minuto depois de você tê-la fechado. `/narsil flotante` liga ou desliga a janela, e `/narsil prueba` envia um alerta de teste que aparece mesmo enquanto você olha para o Claude.

No macOS a janela se comporta de um jeito um pouco diferente, como explica o README: ela é aberta e fechada em vez de escondida (esconder a janela de outro aplicativo exigiria a permissão de acessibilidade), abre atrás do aplicativo em uso e não fica por cima. O navegador lembra onde você a colocou. Em outros sistemas não há janela; a faixa, a voz e as notificações do Claude Code continuam.

## Como funciona por dentro

Quatro peças, cada uma com uma tarefa:

| Peça                                     | O que é                                 | A sua tarefa                                                                     |
| ---------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------- |
| O mod (`hooks/register.tsx`)             | Código de mod, um por conversa          | Inicia o hub, informa o estado desta conversa, envia alertas                     |
| O hub (`overlay/server.cjs`)             | Um script Node.js simples               | Guarda o estado de cada conversa, serve a página, decide quando a janela aparece |
| A página (`overlay/overlay.html`)        | Uma página web numa janela de navegador | Desenha a Narsil e a lista, envia de volta o que você pressiona                  |
| O vigia (`watch.ps1` ou `mac-claude.js`) | Um script do sistema                    | Observa a janela do Claude e mostra, esconde ou posiciona a janela do navegador  |

O hub é o mesmo servidor que o guia anterior chama de hub: ele reúne o estado de cada conversa. Este guia olha para a outra metade dele, a janela.

### Iniciar o hub e a janela

Em `session.start`, o mod chama `startOverlay` um instante depois do começo da sessão. Ele faz um ping em `http://127.0.0.1:47190/ping` com `$.http.fetch`; se o servidor responder `narsil 4`, ele já está rodando. Se responder uma versão mais antiga, o mod primeiro a para, já que um servidor sobrevive às atualizações do mod.

Caso contrário, ele inicia um, passando três valores no ambiente: `NARSIL_TOKEN` (o token do mod, abaixo), `NARSIL_PORT` (`47190`) e `NARSIL_WINDOW` (`1` quando a janela flutuante está ligada, `0` quando está desligada). O processo é iniciado desacoplado, para que sobreviva ao hook que o iniciou:

- **No Windows**, por meio de `$.process.run` executando o PowerShell, que encontra o Node e o Microsoft Edge e chama `Start-Process` em `node overlay/server.cjs`. O caminho do Edge vai em `NARSIL_EDGE`.
- **No macOS**, por meio de `$.process.run` executando `overlay/start.sh`, que procura o Chrome, o Edge ou o Brave e o Node nos lugares habituais, e depois inicia o servidor com `nohup ... &`.

Sem navegador, o servidor continua rodando e servindo as conversas; só não há janela.

Quando a janela é desejada, o servidor abre o navegador em modo de aplicativo, sem barra de endereço nem abas: `--app=http://127.0.0.1:47190/`, a sua própria pasta de perfil (`--user-data-dir`, em `%LOCALAPPDATA%\narsil-overlay` no Windows) e `--window-size=330,450`. Ele também passa `--disable-background-timer-throttling` e duas flags parecidas, porque a janela fica escondida a maior parte do tempo e ainda assim precisa se atualizar na hora quando aparece.

### O vigia: o Claude está minimizado?

Uma página web não consegue ver outras janelas, e o Node também não sem ajuda. Por isso, um pequeno script do sistema observa a janela do Claude e pergunta ao hub o que fazer.

No Windows, `overlay/watch.ps1` roda num laço a cada 400 ms. Ele encontra a janela do processo `claude` com o título `Claude` e a janela do Edge com o título `Narsil` por meio de algumas chamadas a `user32.dll`. Ele classifica o Claude como:

- `min`: minimizado ou não visível.
- `fg`: a janela em primeiro plano.
- `bg`: visível, mas atrás de outro aplicativo.
- `gone`: nenhuma janela do Claude.

Depois, ele chama `GET /tick?claude=<state>&window=<0|1>` com o token do mod e executa cada linha da resposta: `show` coloca a janela no canto inferior direito da tela em que o Claude foi visto pela última vez, a 16 pixels da borda, com `SetWindowPos` e as flags de "sempre por cima" e "não ativar"; `hide` a esconde; `open <link>` traz o Claude para a frente e abre um link de conversa. Depois de cinco chamadas seguidas com falha (o servidor sumiu), ele sai.

No macOS, `overlay/mac-claude.js` é um script de JavaScript for Automation executado com `osascript -l JavaScript`. A cada 700 ms ele lê a lista de janelas do Core Graphics e imprime `fg`, `bg` ou `none`. O comentário do arquivo explica a escolha: a lista de janelas informa o aplicativo de cada janela sem nenhuma permissão, enquanto os títulos das janelas exigiriam uma. Aqui a lógica do vigia fica no próprio servidor (`keepMac`): `none` vira `min`, ou `gone` quando `pgrep -x Claude` não encontra nenhum processo.

### Decidir quando mostrar

A decisão é uma função, `tick`, em `overlay/server.cjs`:

- A janela deve aparecer quando o Claude está `min` ou `gone`, ou quando um evento está esperando.
- Um evento é apagado quando você olha para o Claude (`fg`), e um evento `done` depois de 20 segundos (`DONE_EVENT_MS`).
- `show` ou `hide` só é enviado quando o estado desejado muda, para que uma janela que você arrastou fique onde você a colocou.

Os eventos vêm do mod por meio de `POST /event`, com um tipo `done`, `question` ou `error`. O servidor ignora um evento que chega enquanto você está olhando para o Claude, a menos que seja forçado (o teste `/narsil prueba` e o lembrete de "ainda esperando" de cinco minutos). Se você fechou a janela, um evento só a abre de novo depois de `REOPEN_AFTER_CLOSE_MS`, 60 segundos.

### Server-sent events: como a página se mantém atualizada

A página não pede atualizações ao servidor a cada segundo. Ela abre uma única conexão longa com `new EventSource('/events')`. O servidor responde com o tipo de conteúdo `text/event-stream`, escreve o retrato atual na hora e mantém a conexão aberta. Cada mudança posterior é escrita em todas as conexões abertas como uma linha `data: <json>` seguida de uma linha em branco (`broadcast`).

Esse é o formato de server-sent events: um fluxo de mão única do servidor para a página sobre HTTP simples. Ele combina bem com a janela. O navegador se reconecta sozinho se a conexão cair, e o servidor só envia quando algo exibido mudou: um batimento que não muda nada não é transmitido.

O retrato leva todas as conversas vivas e o evento que está esperando. A página desenha o texto com `textContent`, nunca como HTML, e desenha o SVG da Narsil como uma imagem a partir de uma URL de `Blob`, uma forma de mostrar uma figura em que os scripts dentro do SVG não são executados.

As ações da própria página são pequenas requisições `POST`: `/open` (trazer uma conversa para a frente, por meio do vigia), `/dismiss` (apagar o evento) e `/bounds` (onde a janela está na tela, usado no macOS para posicionar a janela de dicas acima dela).

### Segurança: quem pode falar com o hub

O hub roda no seu computador e sabe o que cada conversa está fazendo. Ele foi construído para que só três coisas possam usá-lo: o mod, o vigia e a sua própria página. Quatro proteções fazem isso, todas em `overlay/server.cjs`.

**1. Ele escuta apenas no endereço de loopback.** As últimas linhas do arquivo são:

```js
server.listen(port, '127.0.0.1', () => {
  if (isWindowWanted) openWindow()
})
```

`127.0.0.1` é o endereço que um computador usa para falar consigo mesmo. Um servidor ligado a ele aceita conexões apenas de programas na mesma máquina. Outro computador no seu Wi-Fi ou na rede do escritório não consegue sequer abrir uma conexão com ele, seja o que for que envie.

**2. O token do mod.** O mod cria um token aleatório com `crypto.randomUUID()` na primeira vez e o guarda em `$.store` sob `overlayToken` (`overlayToken` em `hooks/register.tsx`), de modo que todas as conversas usam o mesmo. Ele chega ao servidor apenas pela variável de ambiente `NARSIL_TOKEN` quando o mod o inicia, e o servidor o entrega a `watch.ps1` da mesma forma. Cada requisição do mod ou do vigia o leva no cabeçalho `x-narsil-token`. O servidor o compara (`isTrusted`) e recusa com `403` quando ele está ausente ou errado; um token vazio nunca corresponde.

**3. A chave da página.** A página não pode receber o token do mod: qualquer coisa dentro de uma página web fica visível para quem carrega essa página. Por isso o servidor cria um segundo segredo para a página: `PAGE_KEY`, 16 bytes aleatórios do `crypto.randomBytes` do Node, novo a cada vez que o servidor inicia. Ele escreve a chave na página onde `overlay.html` tem o marcador `__NARSIL_KEY__` (uma tag `<meta name="narsil-key">`), e a página a devolve no cabeçalho `x-narsil-page` com cada uma das suas ações. O comentário do servidor dá o raciocínio: uma página de outro site não consegue ler esta, então não consegue descobrir a chave.

**4. A verificação de `Host`.** Antes de qualquer outra coisa, o servidor recusa com `403` qualquer requisição cujo cabeçalho `Host` não seja `127.0.0.1:47190` ou `localhost:47190`. Isso impede o DNS rebinding, um ataque em que um site faz o seu próprio nome apontar para `127.0.0.1`. O navegador então envia as requisições desse site ao seu servidor local, mas com o nome do site em `Host`, e o servidor as rejeita.

Qual rota precisa de quê:

| Rota                                                     | Precisa de                          |
| -------------------------------------------------------- | ----------------------------------- |
| `GET /ping`, `/`, `/icon.png`, `/favicon.ico`, `/anim/…` | Só o `Host` certo                   |
| `GET /events` (o fluxo), `GET /window` (os limites)      | Só o `Host` certo                   |
| `POST /open`, `/dismiss`, `/bounds`                      | A chave da página ou o token do mod |
| `GET /sessions`, `GET /tick`                             | O token do mod                      |
| `POST /state`, `/event`, `/window`, `/quit`              | O token do mod                      |

Mais dois detalhes: os links são verificados duas vezes antes que algo os abra, pelo servidor (`LINK`, `conversationLink`) e de novo por `watch.ps1`, e ambos aceitam apenas `claude://code/continue?session=local_…&source=desktop_action`. E os corpos de requisição com mais de um milhão de caracteres são cortados (`readBody`).

### O modelo de ameaça em palavras simples

De quem o servidor está protegendo você?

- **Um site que você visita.** O seu navegador envia requisições de qualquer página para `127.0.0.1`. Mas a página não consegue ler as respostas vindas de outra origem (o servidor não envia nenhum cabeçalho que permita isso), então não consegue ler o fluxo nem a chave. Ela não conhece a chave nem o token, então todas as ações e todas as escritas a recusam. E um nome redirecionado falha na verificação de `Host`.
- **Outro computador na rede.** Ele não consegue se conectar, porque o servidor escuta apenas em `127.0.0.1`.
- **Programas no seu próprio computador.** Estes não são barrados. Qualquer programa local pode ler `/events`, e pode ler a chave da página carregando `/`, exatamente como a janela faz. O token protege deles as rotas do mod, mas um programa que já roda como você pode ler muito mais do que este servidor guarda. O design protege você da web e da rede, não de software que você já executa.

### Por que ele nunca deve ser exposto à rede

O endereço de loopback é a proteção sobre a qual as outras três se apoiam. A chave da página e a verificação de `Host` funcionam porque só as regras de um navegador estão entre um estranho e o servidor, e um navegador segue essas regras. Um programa em outro computador não segue:

- Ele poderia escrever qualquer cabeçalho `Host` que quisesse, então a verificação de `Host` não o deteria.
- Ele poderia carregar `/` e ler a chave da página na própria página, e depois usar as ações da página: abrir conversas no seu desktop e dispensar os seus alertas.
- Ele poderia ler `/events` livremente. Esse fluxo leva o título, a frase, as tarefas, os subagentes, o contexto, a dica e os próximos passos de cada conversa, além dos textos dos alertas, que incluem um resumo da última resposta do Claude.

Os nomes das pastas do projeto, as listas de tarefas e trechos das respostas do Claude são exatamente o que você não gostaria que fosse lido por quem compartilha o Wi-Fi do seu café. O token ainda protegeria `/state` e `/sessions`, mas o fluxo sozinho entrega a maior parte do mesmo conteúdo. Por isso a regra é simples: o hub escuta em `127.0.0.1` e em nenhum outro lugar.

## Construa com o Claude

Peça ao Claude um pequeno servidor local que o mod inicia, e uma página que mostre o estado numa janela própria. A única ideia que ele precisa acertar é que o servidor escuta apenas em `127.0.0.1` e confere quem está falando com ele a cada requisição.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> Meu mod do Claude Code `my-pet` mostra o estado do Claude na faixa. Adicione uma janela flutuante para quando o Claude estiver minimizado. Escreva um servidor Node.js, `overlay/hub.cjs`, que escute apenas em 127.0.0.1, recuse qualquer cabeçalho `Host` diferente de `127.0.0.1:<port>` e `localhost:<port>`, sirva uma página HTML com uma chave aleatória escrita nela, transmita o estado para essa página com server-sent events em `/events` e aceite `POST /state` apenas com um token que o mod cria com `crypto.randomUUID()`, guarda em `$.store` e passa numa variável de ambiente quando inicia o servidor desacoplado com `$.process.run`. As ações da própria página devem levar a sua chave. Nunca escute em nenhum outro endereço. Adicione um teste em Node que confira que um `Host` errado, um token ausente e uma chave ausente são cada um recusados com 403, e que uma linha de requisição como `GET // HTTP/1.1` não derruba o servidor.

### O que conferir na resposta do Claude

1. O servidor chama `listen` com `'127.0.0.1'` como host, nunca só com a porta.
2. Toda requisição cujo cabeçalho `Host` não seja `127.0.0.1:<port>` ou `localhost:<port>` é recusada com `403`.
3. O token do mod nunca aparece na página. A página recebe a sua própria chave aleatória, nova a cada vez que o servidor inicia, e a devolve em cada uma das suas ações.
4. A análise que pode lançar erro, como `new URL()`, fica protegida, então uma linha de requisição como `GET // HTTP/1.1` recebe uma resposta e o servidor continua rodando.
5. O servidor é iniciado de forma destacada, então `$.process.run` não espera que ele termine.

Se uma verificação falhar, diga ao Claude o que você vê: "o hook que inicia o servidor espera até estourar o tempo limite, e enquanto isso a faixa para de atualizar".

### Como a pessoa autora pediu

O pedido original da janela flutuante não foi registrado. Ela chega no commit `6f8f938` (2026-10-30) "feat(overlay): add floating window, Spanish voice and Windows toasts" (adicionar janela flutuante, voz em espanhol e toasts do Windows), junto com a voz e as notificações do próximo guia, antes que existisse qualquer registro público de tarefas.

#### Pedidos posteriores, registrados nos registros de tarefas

A janela foi remodelada pela visão de frota, cujo registro é `odd/tasks/fleet-view.md` no narsil-pet. L1 (2026-11-06) começa com:

> "quiero hacerlo en los dos y tambien en la ventana externa, el diseno lo pensamos luego"

Tradução para o português: a pessoa autora quer isso nos dois lugares, e também na janela externa, deixando o design para depois. O guia anterior cita essa entrada inteira.

L2 (trecho) pede a lista:

> "deberiamos ver en la ventana principal tanto en la banda como la ventana externa el estado de todas las conversaciones, con scroll si son muchas"

Tradução para o português: tanto a faixa quanto a janela externa deveriam mostrar o estado de todas as conversas, com rolagem quando forem muitas. É por isso que a janela rola enquanto a faixa pagina. L6 registra a mudança no servidor que veio em seguida: ele agora inicia com todas as conversas, com janela ou sem janela, "Closing the window no longer quits the server; an event reopens a wanted window after 60 s." (fechar a janela não encerra mais o servidor; um evento reabre uma janela desejada depois de 60 s). L8 registra o novo layout da página, conferido no navegador em 330×450 com quatro conversas inventadas, e observa: "No automated test covers the page's own script." (nenhum teste automatizado cobre o script da própria página).

Os laços nítidos vieram de `odd/tasks/animated-poses.md`, L6 (2026-11-15):

> "en ventana externa podemos poner el video sin recortar? para que se vea mas nitido?"

Tradução para o português: a janela externa pode mostrar o vídeo sem cortar, para que fique mais nítido? O registro anota a aprovação, "Sí, hazla" ("Sim, faça"), e a sua spec S7 diz que a janela não tem limite de tamanho, então o servidor local serve uma cópia mais nítida de cada laço. Essa é a rota `/anim/`.

#### Reconstrução a partir do histórico de commits

O restante, a partir de `git log -- overlay/server.cjs overlay/overlay.html overlay/watch.ps1 overlay/mac-claude.js overlay/start.sh`:

- `6f8f938` (2026-10-30) "feat(overlay): add floating window, Spanish voice and Windows toasts" (adicionar janela flutuante, voz em espanhol e toasts do Windows). O servidor, já em `127.0.0.1` e com o token do mod nas suas rotas de escrita, a página, `watch.ps1` e `kill.ps1`.
- `a2b5970` (2026-10-30) "fix(overlay): start the window again for an event instead of a notification" (iniciar a janela de novo para um evento em vez de uma notificação).
- `c8bf365` (2026-10-30) "feat(mac): open the floating window on macOS in a Chromium browser" (abrir a janela flutuante no macOS num navegador Chromium).
- `9bb60c8` (2026-10-30) "fix(overlay): show the floating window on the screen Claude is on" (mostrar a janela flutuante na tela em que o Claude está).
- `42f7efd` (2026-10-31) "fix: let only the floating window's own page and the mod drive its server" (deixar que apenas a própria página da janela flutuante e o mod controlem o seu servidor). Este commit adicionou a chave da página e a verificação de `Host`. Antes dele, as ações da página não exigiam chave e não havia verificação de `Host`, então uma página de qualquer site que você visitasse podia lhes enviar uma requisição simples e, por exemplo, dispensar os seus alertas. Ele também adicionou as verificações de segurança em `tests/overlay-server.check.cjs`.
- `3031ef2` (2026-11-01) "fix(overlay): on macOS show the window when Claude is minimized, not when another app is in front, and open only one" (no macOS, mostrar a janela quando o Claude está minimizado, não quando outro aplicativo está na frente, e abrir apenas uma).
- `aa54891` e `b87bd67` (2026-11-06): o servidor se torna o hub de todas as conversas, e a janela lista todas elas.
- `42aab0c` (2026-11-07) "fix: open the floating window once when Edge hands it to a running instance" (abrir a janela flutuante uma só vez quando o Edge a entrega a uma instância já em execução).
- `e19331b` (2026-11-15) "feat: show sharper animated loops in the floating window" (mostrar laços animados mais nítidos na janela flutuante).
- `f2cc0f6` (2026-11-16) "fix: answer 400 to a request path that makes no URL instead of crashing the overlay server" (responder 400 a um caminho de requisição que não forma uma URL em vez de derrubar o servidor da janela). A sua mensagem explica que uma linha de requisição crua como `GET // HTTP/1.1` fazia `new URL()` lançar um erro dentro do handler assíncrono, o que encerrava o processo. Uma única requisição estranha podia parar o hub para todas as conversas.

O padrão: primeiro veio a janela, depois o seu comportamento em cada sistema, depois a sua segurança, e uma correção tardia encontrada enviando ao servidor uma requisição que nenhum navegador enviaria.

## Código de referência

Esta é uma resposta correta, escrita para este guia. Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

Um hub reduzido, escrito para este guia e adaptado de `overlay/server.cjs` e `hooks/register.tsx` do [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). O servidor é Node.js simples, não código de mod. Mostrar e esconder a janela fica de fora: essa parte depende do sistema, como mostram os vigias acima.

O servidor, `overlay/hub.cjs`:

```js
'use strict'
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const path = require('path')

const port = Number(process.env.PET_PORT || 47190)
const token = process.env.PET_TOKEN || ''
const PAGE_KEY = crypto.randomBytes(16).toString('hex')
const PAGE = fs
  .readFileSync(path.join(__dirname, 'page.html'), 'utf8')
  .replace('__PAGE_KEY__', PAGE_KEY)
const HOSTS = new Set([`127.0.0.1:${port}`, `localhost:${port}`])

let state = null
const listeners = new Set()

const server = http.createServer((req, res) => {
  const send = (status, type, body) => {
    res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
    res.end(body)
  }
  let url
  try {
    url = new URL(req.url, `http://127.0.0.1:${port}`)
  } catch {
    return send(400, 'text/plain', 'bad request')
  }
  if (!HOSTS.has(String(req.headers.host || '').toLowerCase()))
    return send(403, 'text/plain', 'forbidden')
  const isMod = token !== '' && req.headers['x-pet-token'] === token
  const isPage = isMod || req.headers['x-pet-page'] === PAGE_KEY

  if (req.method === 'GET' && url.pathname === '/') return send(200, 'text/html', PAGE)
  if (req.method === 'GET' && url.pathname === '/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' })
    res.write(`data: ${JSON.stringify(state)}\n\n`)
    listeners.add(res)
    req.on('close', () => listeners.delete(res))
    return
  }
  if (req.method === 'POST' && url.pathname === '/dismiss') {
    if (!isPage) return send(403, 'text/plain', 'forbidden')
    return send(204, 'text/plain', '')
  }
  if (req.method === 'POST' && url.pathname === '/state') {
    if (!isMod) return send(403, 'text/plain', 'forbidden')
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 100_000) req.destroy()
    })
    req.on('end', () => {
      try {
        state = JSON.parse(body)
      } catch {
        return send(400, 'text/plain', 'bad json')
      }
      for (const l of listeners) l.write(`data: ${JSON.stringify(state)}\n\n`)
      send(204, 'text/plain', '')
    })
    return
  }
  send(404, 'text/plain', 'not found')
})

server.on('error', () => process.exit(0))
server.listen(port, '127.0.0.1')
```

A página lê a sua chave de `<meta name="pet-key" content="__PAGE_KEY__">`, escuta com `new EventSource('/events')`, define o texto com `textContent` e envia as suas ações com `fetch('/dismiss', { method: 'POST', headers: { 'x-pet-page': key } })`.

O lado do mod, em `hooks/register.tsx`, conferido com os tipos da 2.1.325 (`$.store`, `$.process.run`, `$.http.fetch`, `$.plugin.root`, `$.clock.every`). Ele inicia o hub no macOS ou no Linux da mesma forma que o `launch` da Narsil; no Windows, a Narsil usa o `Start-Process` do PowerShell em vez disso.

```tsx
import { read } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const HUB = 'http://127.0.0.1:47190'

async function hubToken($: EngineInterface): Promise<string> {
  const saved = await $.store.get('hubToken').catch(() => undefined)
  if (typeof saved === 'string' && saved) return saved
  const token = crypto.randomUUID()
  await $.store.set('hubToken', token)
  return token
}

async function startHub($: EngineInterface): Promise<void> {
  const up = await $.http.fetch(`${HUB}/`).then(
    (r) => r.ok,
    () => false,
  )
  if (up) return
  await $.process.run(['/bin/sh', '-c', 'nohup node "$PET_HUB" </dev/null >/dev/null 2>&1 &'], {
    env: { PET_HUB: `${$.plugin.root}/overlay/hub.cjs`, PET_TOKEN: await hubToken($) },
  })
}

async function push($: EngineInterface): Promise<void> {
  await $.http
    .fetch(`${HUB}/state`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-pet-token': await hubToken($) },
      body: JSON.stringify(await read($, pet)),
    })
    .catch(() => undefined)
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await startHub($)
    $.clock.every(2000, () => void push($))
    return next(e)
  })
}
```

`pet` é o atom de estado do primeiro guia. O comando de shell é uma string fixa; o caminho do script viaja no ambiente, nunca dentro do comando, que é como a Narsil mantém o texto fora do que um shell interpretaria.

## Erros comuns e como testar

- **Escutar em todos os endereços.** `server.listen(port)` sem host escuta em todos os endereços do computador, inclusive na rede. Sempre passe `'127.0.0.1'`.
- **Colocar o token do mod na página.** O que uma página contém, qualquer pessoa que a carregue pode ler. Dê à página a sua própria chave, nova a cada execução, e guarde o token para o mod.
- **Confiar em `Host` como a única proteção.** Ela impede que um navegador seja enganado por DNS rebinding. Não impede um programa que escreve os seus próprios cabeçalhos, e é por isso que o endereço de loopback importa.
- **Um handler assíncrono que lança um erro.** No Node, uma exceção dentro de um handler de requisição `async` vira uma rejeição não tratada que pode encerrar o processo. Envolva o parsing que pode lançar um erro, como `f2cc0f6` fez com `new URL()`.
- **Passar texto numa linha de comando.** Os scripts da Narsil pegam o seu texto do ambiente (`NARSIL_TEXT`, `NARSIL_TOKEN`), para que um título escrito pelo Claude nunca possa ser lido como parte de um comando.
- **Roubar o foco.** Uma janela que salta para a frente interrompe a digitação. No Windows, `watch.ps1` passa "não ativar" a `SetWindowPos`.
- **Esperar por um processo que nunca termina.** `$.process.run` lê toda a saída; um servidor iniciado sem desacoplar segura a chamada até o tempo limite dela. Inicie-o com `nohup … &` ou `Start-Process`.

Para testar, o narsil-pet executa `node tests/overlay-server.check.cjs`. As suas verificações incluem "the page is served with its key, and the key is not a placeholder" (a página é servida com a sua chave, e a chave não é um marcador), "another host name (a page rebound to this address) is refused everywhere" (outro nome de host, uma página redirecionada para este endereço, é recusado em todo lugar), "the page's actions need its key" (as ações da página precisam da sua chave), "the mod's state needs its token, as before" (o estado do mod precisa do seu token, como antes) e "a request path no URL can be made of is refused, and the server keeps answering" (um caminho de requisição do qual não se pode formar uma URL é recusado, e o servidor continua respondendo). O lado do mod é coberto em `tests/narsil.test.tsx` por "each state change is pushed to the floating window with its token and session" (cada mudança de estado é enviada à janela flutuante com o seu token e a sua sessão), "an older window server left running is closed and replaced by this version" (um servidor de janela mais antigo deixado rodando é fechado e substituído por esta versão) e "with the window off, the conversation still reaches the hub: started with no window, and pushed to" (com a janela desligada, a conversa ainda chega ao hub: iniciado sem janela, e recebendo os envios). O registro de tarefas observa que nenhum teste automatizado cobre o script da própria página nem a abertura de uma janela de navegador real.

## Para ir além

- `openWindow`, `checkWindowGone` e `isProfileRunning` em `overlay/server.cjs` lidam com o Edge entregando uma abertura a uma instância já em execução, o que de outra forma abriria uma segunda janela (`42aab0c`).
- `kill.ps1` e `running.ps1` encontram os processos do navegador pela sua pasta de perfil, para que o servidor feche apenas a sua própria janela.
- `HEARTBEAT_TIMEOUT_MS` (30 segundos) desliga o servidor quando nenhuma conversa bate; `ensureOverlay` em `hooks/register.tsx` o inicia de novo no máximo uma vez por minuto.
- A janela de dicas (`overlay/tip.ps1`, `overlay/tip.sh`, `overlay/tip.js`) abre acima da janela flutuante usando os limites que a página informa.
- A tabela "Sistemas compatibles" do README resume o que cada sistema recebe.
