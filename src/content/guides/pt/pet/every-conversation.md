---
title: Todas as conversas num só lugar
description: 'Como a Narsil reúne o estado de cada conversa aberta num hub local, ordena com o erro primeiro, pagina de quatro em quatro e esquece as silenciosas depois de uma hora.'
route: pet
order: 3
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/fleet.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: overlay/server.cjs
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
  - repo: pet
    path: tests/overlay-server.check.cjs
---

## O que faz

Se você mantém várias conversas do Claude Code abertas, cada uma tem a sua própria faixa. A Narsil faz cada faixa mostrar todas elas.

Há uma só Narsil para todas as suas conversas. O desenho e a frase dela mostram a mais importante, nesta ordem: primeiro um `ERROR`, depois o que estiver em `TE NECESITA` (precisa de você), depois o que estiver em `TRABAJANDO` (trabalhando) e, por último, o que estiver em `TERMINADA` (terminada). Quando essa conversa não é a que você está olhando, a frase começa com o nome dela, por exemplo "web: Me he detenido por un error" ("web: Parei por causa de um erro"). Assim, uma conversa presa numa pergunta em outra janela aparece naquela em que você está digitando.

Abaixo dela, a faixa lista todas as conversas, uma linha cada: o estado, o nome e a sua própria barra de contexto com uma porcentagem. A conversa atual vem sempre primeiro, e a barra dela é azul para que você a encontre. As linhas aparecem de quatro em quatro, com botões ◂ e ▸ para virar a página ("Conversaciones 1/2").

Pressionar o nome de uma conversa a abre sob uma linha: as suas tarefas, os seus subagentes e, a partir da porcentagem, o que preenche o seu contexto. O próximo guia trata das tarefas e dos subagentes.

Uma conversa que você não abre há algum tempo fica na lista com o seu último estado por uma hora, mesmo que o aplicativo de desktop a tenha posto para dormir. Depois de uma hora sem notícias, ela sai da lista, e é assim também que as conversas apagadas desaparecem. Se você abri-la de novo, ela volta na hora.

## Como funciona por dentro

### O problema: cada conversa está sozinha

Um mod é executado uma vez por conversa. A Narsil de uma conversa não consegue ver os atoms da Narsil de outra. Para mostrar todas as conversas, algo fora delas precisa reunir os estados e devolver a lista.

A Narsil já tinha algo assim: o pequeno servidor local por trás da sua janela flutuante. O README diz que cada conversa envia o seu estado a "un pequeño servidor local (el de la ventana flotante)" (um pequeno servidor local, o da janela flutuante), que inicia com a primeira conversa mesmo quando a janela está desligada. Esse servidor é o hub.

### O hub: um script Node

`overlay/server.cjs` é um script Node.js simples, não código de mod. Ele usa o módulo `http` do Node, guarda uma entrada por conversa num `Map` chamado `sessions` e chama `server.listen(port, '127.0.0.1', ...)`, de modo que escuta apenas no endereço de loopback local. A porta é `47190`, a menos que `NARSIL_PORT` diga outra coisa.

Ele responde, entre outras, a:

- **`POST /state`**: uma conversa informa o seu estado. A entrada é guardada com o horário em que chegou (`at`) e o horário em que algo exibido mudou pela última vez (`changedAt`). Batimentos que não mudam nada não são repassados à página da janela flutuante.
- **`GET /sessions`**: a lista de todas as conversas vivas, da mais importante para a menos importante, sem os desenhos (cada mod desenha a sua própria Narsil).

Ambos exigem o token do mod no cabeçalho `x-narsil-token`. O token é um UUID aleatório que o mod guarda em `$.store` (`overlayToken` em `hooks/register.tsx`) e passa ao servidor na variável de ambiente `NARSIL_TOKEN` quando o inicia. O servidor também confere o cabeçalho `Host` e recusa qualquer nome que não seja `127.0.0.1` ou `localhost`. O guia sobre a janela flutuante trata dessas proteções em detalhe.

Dois temporizadores mantêm a lista honesta:

- `SESSION_FORGET_MS = 60 * 60_000`: `forgetSilent` remove uma conversa uma hora depois do seu último batimento.
- `HEARTBEAT_TIMEOUT_MS = 30_000`: quando nenhuma conversa bate por 30 segundos, o servidor se desliga sozinho. A próxima conversa o inicia de novo.

### O lado do mod: um batimento

Em `session.start`, a Narsil inicia o hub pouco depois do começo da sessão (`$.clock.after(10, () => startOverlay($))`) e depois bate a cada dois segundos (`$.clock.every(2000, () => beat($))`). `startOverlay` primeiro faz um ping no servidor; se responder um servidor de versão mais antiga (que diz algo diferente de `narsil 4`), ela o para e inicia um novo. No Windows, ela lança `node` com `overlay/server.cjs` por meio do `Start-Process` do PowerShell; no macOS, executa `overlay/start.sh`.

Cada `beat` faz, entre outras tarefas de manutenção:

1. `pushOverlay`: `POST /state` com o estado desta conversa, montado por `shownState` (id, título, humor, status, frase, contexto, tarefas, chips de subagentes e mais). O desenho vai junto só quando mudou; um servidor que não tem nenhum responde `need-svg`.
2. `readSessions`: `GET /sessions`, limpo campo por campo e gravado no atom `sessions` só quando difere do que já está lá.

Cada mudança de humor também chama `pushOverlay` na hora, por meio de `setMood`, para que o hub não espere o próximo batimento.

O id da conversa vem da variável de ambiente `CLAUDE_CODE_HOST_SESSION_ID`, lida em `session.start`. `ownId` só o aceita quando ele tem a forma `local_` seguido de letras, dígitos e hífens; caso contrário, usa `local_unknown`. O link `claude://code/continue` do aplicativo de desktop abre uma conversa por esse id, e é assim que funciona o botão "abrir" da janela flutuante.

### A ordenação: `hooks/fleet.ts`

A lógica da lista fica num arquivo separado de funções puras, `hooks/fleet.ts`, sem eventos e sem `$`. Isso facilita testá-la e compartilhá-la com a faixa e a janela.

- `RANK` dá a cada estado o seu lugar: `error` 0, `waiting` 1, `working` 2, `done` 3, `idle` 4. O servidor usa a mesma ordem (`PRIORITY` em `overlay/server.cjs`).
- `fleetOf(hub, own)` pega a lista do hub, substitui a entrada desta conversa por uma nova (a cópia do hub pode estar até um batimento atrasada) e ordena por posição e depois pela mudança mais recente. A primeira entrada é a que a Narsil veste.
- `ownFirst(list, ownId)` move esta conversa para a frente nas linhas, qualquer que seja o estado dela, para que você sempre a encontre no mesmo lugar.
- `pageOf(list, page)` divide a lista em páginas de `FLEET_PAGE = 4` e mantém o número da página dentro do intervalo quando conversas entram e saem.
- `fit(text, cells)` corta ou completa um título até `TITLE_CELLS` (26) caracteres, para que todas as barras de contexto comecem na mesma coluna.
- `openOf` e `toggleOpen` decidem qual conversa está aberta. `open: null` significa "esta, por padrão"; uma string vazia significa "nenhuma".

O que a faixa mostra aberto, em que página está e se o detalhamento do contexto está visível ficam em outro atom, `view` (`fleetView` em `hooks/register.tsx`), de modo que pressionar ◂ ou um nome é apenas um `update` desse atom.

### Por que cada decisão foi tomada

- **Erro antes de precisa de você, antes de trabalhando, antes de terminada.** O pedido da pessoa autora os ordena assim (veja abaixo): o desenho é antes de tudo um aviso, então o que falhou ou espera por você vem antes do que está só ocupado.
- **A própria conversa primeiro nas linhas, mas não no desenho.** O desenho responde "onde precisam de mim?"; as linhas respondem "onde está esta?". Manter as duas coisas permite que a frase salte para outra conversa enquanto a lista fica estável.
- **Páginas em vez de rolagem.** A spec S3 do registro de tarefas diz "The band cannot scroll (Box overflow is only visible/hidden): it pages instead." (a faixa não pode rolar, porque o overflow de Box é apenas visível ou oculto, então ela pagina). Os tipos da 2.1.325 agora descrevem a faixa `AbovePrompt` rolando uma árvore mais alta que o seu `maxRows`; a Narsil continua paginando, e a janela flutuante, que é uma página web, rola.
- **Uma hora, não 30 segundos nem para sempre.** O histórico de commits mostra a expiração sendo ajustada duas vezes. `2ce3acb` (2026-11-07) "fix: keep sleeping conversations listed in the hub" (manter as conversas adormecidas listadas no hub) explica que o aplicativo de desktop põe para dormir o motor de uma conversa que você não abre há algum tempo, então os batimentos dela param e o hub a removia depois de 30 segundos. A correção mantinha cada conversa enquanto o servidor estivesse rodando. Depois, `570961d` (2026-11-10) "fix: forget conversations silent for an hour in the hub" (esquecer no hub as conversas silenciosas há uma hora) diz que as apagadas se acumulavam, e fixou uma hora: tempo suficiente para uma adormecida, curto o bastante para que uma apagada vá embora.
- **A cópia que o hub tem da sua própria conversa é substituída.** `fleetOf` e `ownEntry` usam o estado novo desta conversa, mantendo o `changedAt` do hub apenas enquanto o status se mantém, para que a sua própria linha nunca fique um batimento atrasada.

## Como foi pedido à IA

Esta funcionalidade tem um registro público de tarefas: `odd/tasks/fleet-view.md` no narsil-pet, entradas L1 a L13. Ele cita os pedidos da pessoa autora palavra por palavra.

O pedido original, L1, datado de 2026-11-06:

> "quiero hacerlo en los dos y tambien en la ventana externa, el diseno lo pensamos luego, quisiera poder mostrar todas las sesiones en curso y sus estados, la imagen de narsil solo mostraria lo mas importante error->te necesita-> trabajando--> termine, y las notificaciones se enviarian al celular cuando se pida algo desde el celular como ahora y haya cambios, es decir alguna tarea pase de trabajando a terminado, o de trabajando a error, etc, (eliminariamos la alerta de bucle, no la he sentido tan util) las notificaciones del celular cuando se envien llevarian la info de todas las sesiones funcionando en ese momento, algo asi es mi idea, como lo hacemos? los consejos seguirian funcionando como ahora en cada ventana"

Tradução para o português: a pessoa autora quer isso nos dois lugares (a faixa e o desktop) e também na janela flutuante externa, deixando o design para depois. Quer mostrar todas as sessões em andamento e os seus estados; a imagem da Narsil mostraria só a mais importante, na ordem erro, precisa de você, trabalhando, terminada. As notificações no celular seriam enviadas, como agora, quando um pedido viesse do celular e algo mudasse (uma conversa passando de trabalhando para terminada, ou de trabalhando para erro); o alerta de laço seria removido porque não tinha parecido tão útil; e cada notificação no celular levaria todas as sessões em execução naquele momento. A pessoa autora termina perguntando como fazer isso e diz que as dicas deveriam continuar funcionando como antes em cada janela.

As correções que vieram depois, e o que elas mudaram:

- **L2** (trecho): "deberiamos ver en la ventana principal tanto en la banda como la ventana externa el estado de todas las conversaciones, con scroll si son muchas, [...] donde ponemos las barras de cada conversacion con su porcentaje de avance y con sus estados? al hacer click en el titulo de conversacion deberiamos poder ver sus sub agentes/ tareas y sus respectivos estados". Tradução: tanto a faixa quanto a janela externa deveriam mostrar o estado de todas as conversas, com rolagem quando forem muitas; a pessoa autora pergunta onde deveria ficar a barra de cada conversa; e clicar no título de uma conversa deveria mostrar os seus subagentes e tarefas com os seus estados. A mesma entrada remove a seção final de "conversas abertas" e a seção de dinheiro, e mantém o cache. Isso produziu as linhas, os títulos clicáveis e o detalhe da conversa aberta; como a faixa não podia rolar, a rolagem virou paginação.
- **L3**: "entonces otro cambio, me parece bien lo que me dices del contexto, entonces la barra de contexto general tambien se iria por que no existe un contexto general y se reemplazaria por las barras de contexto de cada conversacion, el avance entonces no existe cuando entre a una de esas conversaciones estaria de nuevo su contexto, sus tareas con su estado (no es necesario barra de avance) y sus sub agentes, al clickear aca su contexto veria como se lleno su propio contexto y ya". Tradução: a pessoa autora concorda com o ponto sobre o contexto, então a barra de contexto geral também sai, porque não existe um contexto geral; cada conversa passa a ter a sua própria barra. Abrir uma conversa mostra o seu contexto, as suas tarefas com os seus estados (sem necessidade de barra de progresso) e os seus subagentes, e clicar no contexto dela mostra como esse contexto foi preenchido. Isso removeu a barra de contexto geral e pôs uma barra em cada linha.
- **L4** registra o design combinado: a Narsil e a frase da conversa que importa no topo, os limites da conta uma vez, a lista de conversas, uma linha que se abre para o seu contexto, tarefas e subagentes, e "The band pages 4 rows at a time." (a faixa pagina 4 linhas por vez).
- **L6 a L11** registram cada tarefa como concluída, com a sua evidência. L6 descreve o hub: o servidor agora inicia com todas as conversas, com janela ou sem janela, e `GET /sessions` (apenas com token) lista todas as conversas vivas, "error first, then waiting, working, done, idle" (erro primeiro, depois esperando, trabalhando, terminada, parada).
- **L12** e **L13** relatam e corrigem um bug com os estados das tarefas, tratado no próximo guia.

A expiração de uma hora não fazia parte do registro; ela veio depois, nos dois commits descritos acima.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> Meu mod do Claude Code `my-pet` mostra o estado de uma conversa na faixa `AbovePrompt`. Faça-o mostrar todas as conversas abertas. Escreva um pequeno hub em Node.js (`hub.cjs`) que escute apenas em 127.0.0.1, receba `POST /state` e sirva `GET /sessions`, ambos protegidos por um token aleatório que o mod guarda em `$.store`, e que esqueça uma conversa uma hora depois do seu último relato. No mod, informe o estado desta conversa a cada dois segundos com `$.clock.every` e `$.http.fetch`, leia a lista de volta para um atom e mantenha a ordenação e a paginação como funções puras em `hooks/fleet.ts`: erro, depois esperando, depois trabalhando, depois terminada, depois parada, com a mudança mais recente primeiro, quatro linhas por página. Desenhe o estado da conversa mais importante no topo e as linhas abaixo, com esta conversa primeiro. Adicione testes para a ordenação, a paginação e a expiração.

## O código mínimo

Escrito para este guia. A ordenação e a paginação foram adaptadas de `hooks/fleet.ts`, e a expiração e a ordem do hub de `overlay/server.cjs`, ambos do [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later).

A parte pura, `hooks/fleet.ts`:

```ts
import type { Entry, Status } from '../types' // Entry: { sessionId: string; status: Status; headline: string; changedAt: number }

export const PAGE = 4
const RANK: Record<Status, number> = { error: 0, waiting: 1, working: 2, done: 3, idle: 4 }

export function ranked(hub: readonly Entry[], own: Entry): Entry[] {
  return [own, ...hub.filter((s) => s.sessionId !== own.sessionId)].sort(
    (a, b) => RANK[a.status] - RANK[b.status] || b.changedAt - a.changedAt,
  )
}

export function pageOf(list: readonly Entry[], page: number) {
  const pages = Math.max(1, Math.ceil(list.length / PAGE))
  const at = Math.min(Math.max(0, page), pages - 1)
  return { rows: list.slice(at * PAGE, (at + 1) * PAGE), page: at, pages }
}
```

O batimento do mod, em `hooks/register.tsx` (o atom `fleet` guarda a lista do hub e está declarado em `types/index.d.ts`; `ownEntry` monta a entrada desta conversa a partir do seu atom de estado):

```ts
const HUB = 'http://127.0.0.1:47191'

async function token($: EngineInterface): Promise<string> {
  const saved = await $.store.get('hubToken')
  if (typeof saved === 'string' && saved) return saved
  const fresh = crypto.randomUUID()
  await $.store.set('hubToken', fresh)
  return fresh
}

async function beat($: EngineInterface): Promise<void> {
  const headers = { 'content-type': 'application/json', 'x-my-pet-token': await token($) }
  try {
    await $.http.fetch(`${HUB}/state`, {
      method: 'POST',
      headers,
      body: JSON.stringify(await ownEntry($)),
    })
    const { ok, text } = await $.http.fetch(`${HUB}/sessions`, { headers })
    if (ok) await update($, fleet, () => JSON.parse(text))
  } catch {
    // the hub is out of reach: keep the last list
  }
}

// in register:
on('session.start', async ($, e, next) => {
  $.clock.every(2000, () => beat($))
  return next(e)
})
```

Para o id em `ownEntry`, `$.session.id()` retorna o id da sessão (o nome do arquivo de transcrição). A Narsil usa `CLAUDE_CODE_HOST_SESSION_ID` em vez disso porque precisa do id `local_` do aplicativo de desktop para abrir a conversa a partir de um link.

O hub, `overlay/hub.cjs`, é Node.js simples, não API de mod. O mod o inicia com `$.process.run`, passando o token como `MY_PET_TOKEN` em `env`; o `startOverlay` da Narsil mostra como lançá-lo desacoplado no Windows e no macOS.

```js
'use strict'
const http = require('http')
const token = process.env.MY_PET_TOKEN || ''
const RANK = { error: 0, waiting: 1, working: 2, done: 3, idle: 4 }
const FORGET_MS = 60 * 60_000
const sessions = new Map()

http
  .createServer((req, res) => {
    if (!token || req.headers['x-my-pet-token'] !== token) return res.writeHead(403).end()
    if (req.method === 'GET' && req.url === '/sessions') {
      const now = Date.now()
      for (const [id, s] of sessions) if (now - s.at > FORGET_MS) sessions.delete(id)
      const list = [...sessions.values()].sort(
        (a, b) => (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9) || b.changedAt - a.changedAt,
      )
      return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(list))
    }
    if (req.method !== 'POST' || req.url !== '/state') return res.writeHead(404).end()
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 100_000) req.destroy()
    })
    req.on('end', () => {
      try {
        const s = JSON.parse(body)
        const before = sessions.get(String(s.sessionId))
        const changedAt = before && before.status === s.status ? before.changedAt : Date.now()
        sessions.set(String(s.sessionId), { ...s, at: Date.now(), changedAt })
        res.writeHead(204).end()
      } catch {
        res.writeHead(400).end()
      }
    })
  })
  .listen(47191, '127.0.0.1')
```

Este esboço deixa de fora o que o servidor real acrescenta: a verificação de `Host`, o desligamento quando todas as conversas ficam em silêncio e a janela flutuante. Não amplie `'127.0.0.1'` para todas as interfaces; o guia posterior sobre a janela flutuante explica por que cada proteção está ali.

## Erros comuns e como testar

- **Descartar conversas adormecidas.** O aplicativo de desktop para o motor de uma conversa que você não abre há algum tempo, então os batimentos dela param, embora ela ainda exista. Um tempo limite curto esvazia a sua lista (`2ce3acb`).
- **Nunca esquecer.** Manter todas as conversas enquanto o hub estiver rodando enche a lista de conversas apagadas (`570961d`). Faça a expiração pelo tempo desde o último batimento e deixe que o primeiro batimento novo volte a listá-la.
- **Mostrar a sua própria conversa um batimento atrasada.** A cópia do hub está atrasada em até um batimento. Junte a sua entrada nova antes de ordenar, como faz `fleetOf`.
- **Uma página que não existe mais.** Quando conversas saem, a página guardada pode apontar para além do fim. Limite-a ao intervalo, como faz `pageOf`.
- **Regravar o atom a cada batimento.** Cada `update` redesenha a faixa. A Narsil compara a lista nova com a antiga e só grava quando há diferença.
- **Lançar um erro quando o hub está fora do ar.** Um `$.http.fetch` que falha não pode quebrar o mod. A Narsil captura o erro, mantém a última lista e tenta iniciar o hub de novo no máximo uma vez por minuto (`ensureOverlay`).
- **Um hub antigo respondendo por um mod novo.** O servidor sobrevive às atualizações do mod. O `/ping` da Narsil responde com uma string de protocolo (`narsil 4`), e o mod substitui um servidor que responda outra.
- **Vários terminais sem id de host.** `ownId` recorre a `local_unknown` quando `CLAUDE_CODE_HOST_SESSION_ID` está ausente ou não corresponde ao formato, e o servidor faz o mesmo, então essas conversas compartilham uma única entrada.

Para testar o mod, `claude plugin test .` executa `tests/narsil.test.tsx`, que alimenta um hub inventado por meio de um `$.http.fetch` simulado. Veja "the band lists every open conversation with its state and context, and Narsil wears the most important" (a faixa lista todas as conversas abertas com o seu estado e contexto, e a Narsil veste a mais importante) e "the band pages through many conversations, four at a time" (a faixa pagina por muitas conversas, de quatro em quatro), que pressiona o botão `page-next` e confere "Conversaciones 2/2". Para testar o servidor, `node tests/overlay-server.check.cjs` inicia o script real e confere, entre outros, "every conversation is served to the mods alone, the most important first, without drawings" (todas as conversas são servidas apenas aos mods, a mais importante primeiro, sem desenhos) e "a conversation that stops beating stays listed for an hour, then goes until it beats again" (uma conversa que para de bater continua listada por uma hora e depois sai até bater de novo), que avança `Date.now` em 59 e em 61 minutos.

## Para ir além

- `hooks/fleet.ts` também tem `countOfStates`, que `/narsil estado` usa para dizer quantas conversas estão em cada estado.
- O hook `ui.render` em `AbovePrompt` em `hooks/register.tsx` desenha as linhas: uma coluna de estado de largura fixa, o título como um `Button` que chama `toggleOpen`, `textBar` para o contexto, a porcentagem como botão para a conversa aberta e o relógio do cache. Enquanto há próximos passos oferecidos, todas as linhas começam fechadas para que os passos apareçam; ao abrir uma linha, os passos se escondem, e voltam quando você fecha todas de novo.
- `shownState` é a entrada completa que cada conversa informa; `readSessions` mostra como validar campo por campo o que volta do hub.
- `overlay/server.cjs` também transmite a lista à janela flutuante por server-sent events (`GET /events`), abre a janela quando um evento espera por você e serve a página dela. O guia da janela flutuante trata disso.
- Os alertas no celular usam a mesma lista: `fleetNow` e `fleetText` terminam cada alerta com todas as conversas abertas e os seus estados.
