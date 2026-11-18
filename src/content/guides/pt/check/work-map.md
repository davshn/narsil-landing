---
title: O mapa do trabalho
description: 'Como o Narsil Check desenha um mapa animado e ao vivo do que o Claude está fazendo, com a Narsil bebê no centro, sem nunca fazer uma ferramenta esperar nem mostrar o que você escreveu.'
route: check
order: 2
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/map/hooks.ts
  - repo: check
    path: hooks/map/board.ts
  - repo: check
    path: hooks/map/classify.ts
  - repo: check
    path: hooks/map/draw.ts
  - repo: check
    path: hooks/map/stations.ts
  - repo: check
    path: hooks/map/words.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: tests/map-pane.test.tsx
  - repo: check
    path: odd/tasks/work-map.md
---

## O que faz

A primeira seção do painel é **Mapa mental**: uma imagem ao vivo do que o Claude está fazendo na sessão. A Narsil bebê fica no centro, na versão clara ou escura conforme o tema do app. Em volta há dez estações, uma por tipo de trabalho:

| Estação       | Em português | O que chega ali                                           |
| ------------- | ------------ | --------------------------------------------------------- |
| **Tú**        | Você         | As suas mensagens, e cada resposta pronta                 |
| **Modelo**    | Modelo       | Cada passo do modelo, e uma troca de modelo               |
| **Memoria**   | Memória      | Arquivos da pasta de memória do próprio Claude Code       |
| **Archivos**  | Arquivos     | Read, Write, Edit, Grep, Glob e os comandos de arquivos   |
| **Terminal**  | Terminal     | Comandos de shell, PowerShell e monitores                 |
| **Red**       | Rede         | Downloads e buscas na web, e comandos que vão para a rede |
| **Navegador** | Navegador    | As ferramentas do navegador                               |
| **Agentes**   | Agentes      | Subagentes, workflows e trabalho em segundo plano         |
| **Skills**    | Skills       | Skills, comandos de barra e buscas de ferramentas         |
| **Hooks**     | Hooks        | Hooks de configuração que recusam, perguntam ou demoram   |

Cada chamada de ferramenta sai da Narsil como um pulso em direção à sua estação. A estação acende enquanto trabalha e mostra quantas vezes foi usada. Além disso, o mapa mostra:

- **Raios** que engrossam com o uso, e **uma rota** que une as últimas estações visitadas e some com o tempo.
- **Dois ponteiros** em volta de uma estação cuja chamada está demorando.
- **Um ponto vermelho** numa estação depois de um erro ou de uma recusa de um hook, até a sua próxima mensagem.
- **Um anel** em volta da Narsil que enche com o contexto em uso: âmbar em 70% e vermelho em 90%. Embaixo, o modelo e a porcentagem.
- **Os subagentes** que ainda estão trabalhando, girando em volta de **Agentes**.
- **Uma tarefa em segundo plano** (um comando, um monitor ou um agente lançado à parte) que fica acesa até avisar que terminou. Se não avisar em uma hora, é fechada no fim de um turno.

O ponto da seção é azul enquanto algo trabalha, vermelho se algo falhou e verde em repouso. No terminal, que não desenha SVG, a seção não aparece.

O mapa vem do [lot-map](https://github.com/alexeyw/lot-map), de Aleksei Volodin (licença MIT), adaptado às cores da Narsil. O Narsil Check dá o crédito no seu README e guarda o aviso de copyright e de permissão do lot-map em `hooks/map/LICENSE-lot-map.txt`.

## Como funciona por dentro

O mapa fica em `hooks/map/`, em quatro partes: `classify.ts` decide para qual estação vai uma chamada, `board.ts` guarda o que aconteceu, `hooks.ts` escuta os eventos e `draw.ts` transforma o quadro num SVG. `hooks/register.tsx` adiciona a seção ao painel.

### Cada chamada vai para uma estação, só pelo nome

`classify(tool, input, setup)` lê o nome da ferramenta e a sua entrada, e devolve uma estação e um rótulo. A maioria das ferramentas é um caso direto: `Read`, `Write` e `Edit` vão para **Archivos**, `WebFetch` para **Red**, `Agent` para **Agentes**, `Skill` para **Skills**. Um arquivo dentro de `.claude/projects/<projeto>/memory/` vai para **Memoria**.

Os comandos de shell dão mais trabalho, porque a ferramenta é sempre `Bash`, mas o trabalho não. `classifyShell` lê a primeira palavra do comando, enxerga através dos invólucros (`sudo`, `env`, `timeout`, `nohup` e parecidos executam outro comando, e é esse que conta), e então decide: `cat`, `grep` ou `mv` trabalham com arquivos, `curl`, `ssh` ou `gh` vão para a rede, e alguns programas só vão para a rede com certos subcomandos (`git push` sim, `git status` não; `npm install` sim, `npm test` não).

O rótulo é o que o mapa mostra ao lado da estação, e só carrega nomes:

- de um arquivo, as duas últimas partes do caminho (`src/app.ts`),
- de uma página web, só o host, nunca o caminho, a consulta ou um login (`hostOf` lê `user:pa/ss@host` como `host`),
- de um comando, a sua `description`, ou senão o seu nome,
- de uma busca na web, as palavras `búsqueda web`, nunca a consulta.

`clean` também tira de cada rótulo os caracteres de controle e as marcas de direção, para que um nome de arquivo não possa mover o cursor nem inverter o texto. Um teste tem o nome dessa regra: "labels never carry what was written, searched or a password" ("os rótulos nunca carregam o que foi escrito, buscado ou uma senha").

### O quadro: um atom, e uma cópia para desenhar

O que o mapa mostra é um `MapBoard` (em `types/index.d.ts`): uma lista de entradas, uma contagem por estação, o modelo e o passo, a porcentagem de contexto, as falhas por estação e os subagentes que ainda estão trabalhando. Cada entrada tem uma estação, um rótulo, um início e um fim, e um estado: `run`, `ok`, `err` ou `block`.

O quadro é um atom da sessão, `board`, escrito por quatro funções pequenas de `board.ts`: `begin` abre uma entrada, `finish` a fecha, `background` a mantém aberta com o id de uma tarefa, e `settle` a fecha quando essa tarefa avisa. O quadro guarda as 80 entradas mais novas, mais até 16 tarefas em segundo plano mais antigas que ainda estão rodando.

O painel não lê `board`. Ele lê `mapView`, uma cópia feita no máximo a cada 400 ms:

```ts
async function redraw($: EngineInterface): Promise<void> {
  if (isRedrawPending) return
  isRedrawPending = true
  try {
    await $.clock.sleep(REDRAW_MS)
  } catch {
    // No clock: copy now.
  } finally {
    isRedrawPending = false
  }
  const current = await read($, board)
  await update($, shown, () => current)
}
```

Por quê? Cada redesenho manda o SVG inteiro para o app, com as duas imagens da Narsil. Uma rajada de vinte chamadas seriam vinte redesenhos. Com a cópia, a primeira escrita inicia uma espera de 400 ms, o resto da rajada só muda `board`, e uma única cópia no fim desenha todas. O teste "a burst of calls is one redraw of the map, made once the wait is over" confere isso.

### O mapa nunca faz uma ferramenta esperar

Essa é a regra em que a revisão insistiu. O mapa escuta `tool.call`, que envolve cada ferramenta. Se ele esperasse as próprias escritas antes de chamar `next(e)`, cada ferramenta esperaria o mapa. Por isso a entrada é escrita junto com a chamada, não antes:

```ts
export async function mapToolCall($, e, next) {
  const started = quietly(async () => {
    const seen = classify(e.tool, e, SETUP)
    return begin($, { ...seen, from: e.agentId === undefined ? 'core' : 'agents' })
  })
  const close = (how) => {
    void started.then(how).catch(() => undefined)
  }
  try {
    const ran = await next(e)
    // ...refused, failed, sent to the background, or ok
    close((id) => finish($, id, ran.isError === true ? 'err' : 'ok'))
    return ran
  } catch (failure) {
    close((id) => finish($, id, 'err'))
    throw failure
  }
}
```

`next(e)` começa na hora. A entrada é fechada quando a chamada e a escrita terminaram, e esse fechamento também não é esperado. `quietly` envolve cada escrita: o que der errado no mapa devolve `undefined` e nunca chega à ferramenta, ao turno nem à conversa. Cada hook repassa o seu evento sem mudanças, então o mapa nunca altera uma entrada, um resultado ou uma decisão de permissão.

O mesmo vale para `classic.PreToolUse`: a decisão dos hooks de configuração é devolvida assim que é tomada, e o mapa escreve a sua entrada depois. Uma verificação que levou menos de 400 ms não é desenhada.

### Três eventos compartilhados com o resto do painel

O motor recusa um segundo `on()` do mesmo evento sem filtro num mesmo módulo. O Narsil Check já escutava `turn.start`, `tool.call` e `turn.complete`. Então o mapa exporta esses três como funções, `mapTurnStart`, `mapToolCall` e `mapTurnComplete`, e `register.tsx` chama cada uma no lugar de `next(e)`:

```tsx
on('tool.call', async ($, e, next) => {
  // ...what the pane already tracked
  return mapToolCall($, e, next)
})
```

Todos os outros eventos de que o mapa precisa (`turn.step`, `classic.PreToolUse`, `prompt.submit`, `skill.prompt`, `session.compact` e os hooks de configuração que adicionam contexto) são registrados em `registerMap(on)`, que `register` chama primeiro.

### Falhas, turnos e tarefas em segundo plano

- Uma **mensagem nova** sua apaga as falhas: os pontos vermelhos falam do caminho até a última resposta.
- Um **turno interrompido** cai em **Tú** e não é culpa de nada. Ele também fecha as chamadas que nunca avisaram, para que não fiquem pulsando pelo resto da sessão.
- Uma chamada cuja resposta inicia **trabalho em segundo plano** (`backgroundTaskId`, ou um agente com `status: 'async_launched'`) fica aberta com o id dessa tarefa. `taskNotice` lê o aviso da tarefa só pelo id e pelo estado, nunca pelo resumo ou pela saída, e `settle` fecha a entrada.
- Um **subagente** entra na lista `agents` com a primeira chamada e sai quando chega o seu próprio `turn.complete`.

### O desenho: um SVG, com a Narsil bebê no centro

`drawMap(board, now, narsil)` devolve uma string de SVG. A animação é SMIL dentro do SVG (`<animate>` com inícios relativos a `now`), então o desenho se move entre redesenhos sem ajuda do mod. Ele é desenhado com a paleta escura, e uma regra `prefers-color-scheme: light` dentro do SVG repinta cada cor, então o mapa segue o tema do app sozinho, como fazia a imagem da Narsil.

O elemento `Svg` aceita no máximo 131072 caracteres, e as duas imagens da Narsil ocupam uns 88 KB disso. `drawMap` mede o tamanho: se as imagens levassem o desenho além do limite, ele desenha o mapa de novo com `NARSIL` escrito no centro. O mapa sempre aparece. O teste "the map at its fullest, with baby Narsil, stays within what Svg accepts" desenha o quadro mais cheio possível.

Para quem não pode vê-lo, `describeMap` dá o texto `alt`: a seção, o que está rodando e o contexto, por exemplo `Mapa mental. Archivos: src/app.ts · contexto 13%`.

No painel, a seção só é desenhada quando a superfície tem `Svg` e não é o terminal. Ela abre no início de cada sessão, e `resetMap()` esquece as recusas e o último modelo da sessão anterior.

## Construa com o Claude

Peça ao Claude um mapa do trabalho da sessão como seção do painel. As duas ideias que ele precisa acertar são que o mapa nunca faz uma ferramenta esperar, e que mostra nomes, nunca conteúdo.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No meu mod do Claude Code `my-panel`, adicione uma primeira seção, `Map`, que desenhe o que o Claude faz nesta sessão como um único SVG: um núcleo no centro e estações em volta (você, modelo, memória, arquivos, shell, rede, navegador, agentes, skills, hooks). Classifique cada `tool.call` numa estação com um rótulo que só carregue nomes: as duas últimas partes do caminho de um arquivo, o host de uma URL, a descrição de um comando. Guarde o quadro num atom da sessão (entradas com estação, rótulo, início, fim e estado `run`, `ok`, `err` ou `block`, uma contagem por estação, falhas por estação) e faça o painel ler uma cópia feita no máximo a cada 400 ms. A ferramenta nunca deve esperar o mapa: comece `next(e)` na hora, escreva a entrada junto e envolva cada escrita para que uma falha nunca chegue à ferramenta. Anime com SMIL dentro do SVG, siga o tema do app com uma regra `prefers-color-scheme`, mantenha o SVG abaixo de 131072 caracteres e deixe a seção de fora no terminal. Teste que uma chamada não espera o quadro, que uma rajada de chamadas é um único redesenho e que nenhum rótulo carrega uma consulta, um caminho com mais de duas partes ou uma senha.

### O que conferir na resposta do Claude

1. `next(e)` é chamado antes de esperar a escrita do mapa, e nenhuma escrita do mapa é esperada no caminho da ferramenta.
2. Cada escrita do mapa está envolvida para engolir os erros, e cada hook devolve o resultado do seu evento sem mudanças.
3. Os rótulos são nomes: duas partes de caminho, um host, uma descrição. Não aparecem consultas de busca, caminhos de páginas nem o texto dos comandos.
4. O painel lê uma cópia limitada do quadro, não o próprio quadro.
5. O tamanho do SVG é comparado com o limite de `Svg`, com uma alternativa menor.
6. A seção não aparece onde falta `Svg` ou quando a superfície é o terminal.

Se uma verificação falhar, diga ao Claude o que você vê: "com o mapa ligado, uma leitura lenta de arquivo deixou todas as chamadas mais lentas" ou "o mapa mostrou a minha busca inteira ao lado de Red".

### Como a pessoa autora pediu

O registro da tarefa, `odd/tasks/work-map.md` no narsil-check, cita os pedidos palavra por palavra. Eles foram feitos em espanhol; a tradução vem depois de cada um.

Primeiro, a pessoa autora mostrou o lot-map ao Claude:

> "mira este mod, quisiera traer la funcionalidad aca, como lo ves? https://github.com/alexeyw/lot-map"

("Olha este mod, eu queria trazer a funcionalidade para cá, o que você acha?") O Claude propôs partes que a Narsil já tinha, e o pedido ficou mais estreito:

> "lo que propones traer ya lo tengo en narsilPet, me interesa traer es el mapa animado"

("O que você propõe trazer eu já tenho no narsilPet; o que me interessa trazer é o mapa animado.") Depois, o plano foi aceito e a seção ganhou o seu lugar:

> "sí, avanza con ese plan, la seccion mapa va a ir de primeras, quita la imagen de narsil bebe y ponlo ahi, ya que es la misma imagen que ira creo que sera un buen reemplazo"

("Sim, siga com esse plano. A seção mapa vai primeiro; tire a imagem da Narsil bebê e coloque-a lá, já que é a mesma imagem que vai ficar ali, acho que vai ser uma boa substituição.")

Uma revisão da primeira versão deixou cinco avisos: o painel redesenhava o SVG inteiro a cada escrita, a ferramenta esperava o mapa, um caminho morto para o movimento reduzido, caminhos de falha e de tarefa sem teste, e entradas em segundo plano que nunca expiravam. A resposta foi "Sí, corrígelos" ("Sim, corrija-os"). Os commits do branch da funcionalidade mostram a ordem:

- `bcae0da` "feat(map): classify Claude's work into the work map's stations".
- `e8b29dd` "feat(map): add the animated work map as the pane's first section".
- `4ee05ed` "fix(map): keep the work map off the tool's path and its redraws bounded".
- `1c6677c` "feat(map): larger, higher-contrast work map named Mapa mental".

O commit da correção, `4ee05ed`, é o que mais ensina. A primeira versão funcionava e os testes passavam. A revisão perguntou quanto o mapa custa para o resto da sessão, e a resposta foi uma cópia limitada e uma ferramenta que nunca espera.

Depois de testar a versão 1.12.0, veio o pedido de um mapa mais fácil de ler:

> "las esferas deberian ser mas grandes al igual que el texto, o tener mas contraste ya que no se ve claramente lo que dice, narsil bebe tambien podria ser algo mas grande"

("As esferas deveriam ser maiores, assim como o texto, ou ter mais contraste, porque não dá para ver claramente o que está escrito; a Narsil bebê também poderia ser um pouco maior.") E depois: "y al mapa ponle mapa mental" ("e chame o mapa de mapa mental"). Isso é o `1c6677c`: estações, nomes e contagens maiores, cores dos rótulos com mais contraste em cada tema, uma Narsil bebê maior sobre um azul suave, e a seção renomeada para **Mapa mental**.

## Código de referência

Esta é uma resposta correta, escrita para este guia. Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

É uma versão reduzida de `hooks/map/board.ts` e `hooks/map/hooks.ts` do [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later), que adaptam o [lot-map](https://github.com/alexeyw/lot-map) (MIT, Copyright © 2026 Aleksei Volodin). Foi conferida com os tipos do Claude Code 2.1.325 (`atom`, `read`, `update`, `$.clock.now`, `$.clock.sleep`, o hook `tool.call`). Mantém uma única regra de estação e deixa de fora o desenho, as falhas e as tarefas em segundo plano.

```ts
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

type Status = 'run' | 'ok' | 'err' | 'block'
type Entry = {
  id: string
  station: string
  label: string
  startedAt: number
  endedAt?: number
  status: Status
}
type Board = { entries: Entry[]; counts: Record<string, number> }

const EMPTY: Board = { entries: [], counts: {} }
const board = atom({ plugin: 'my-panel', key: 'board' } as const, EMPTY, { shape: 'board-1' })
const shown = atom({ plugin: 'my-panel', key: 'mapView' } as const, EMPTY, { shape: 'board-1' })

async function quietly<T>(work: () => Promise<T>): Promise<T | undefined> {
  try {
    return await work()
  } catch {
    return undefined
  }
}

let isRedrawPending = false
async function redraw($: EngineInterface): Promise<void> {
  if (isRedrawPending) return
  isRedrawPending = true
  try {
    await $.clock.sleep(400)
  } catch {
    // No clock: copy now.
  } finally {
    isRedrawPending = false
  }
  const current = await read($, board)
  await update($, shown, () => current)
}

async function write($: EngineInterface, by: (b: Board) => Board): Promise<void> {
  await update($, board, by)
  void redraw($).catch(() => undefined)
}

const lastTwo = (path: string): string =>
  path.replace(/\\/g, '/').split('/').filter(Boolean).slice(-2).join('/')

function classify(
  tool: string,
  input: Record<string, unknown>,
): { station: string; label: string } {
  const path = typeof input.file_path === 'string' ? input.file_path : ''
  if (tool === 'Read' || tool === 'Write' || tool === 'Edit')
    return { station: 'files', label: lastTwo(path) || tool }
  if (tool === 'WebSearch') return { station: 'web', label: 'web search' }
  return { station: 'model', label: tool }
}

export const register: Register = (on) => {
  on('tool.call', async ($, e, next) => {
    const started = quietly(async () => {
      const now = await $.clock.now()
      const entry: Entry = {
        id: `${now}-${Math.random()}`,
        ...classify(e.tool, e as Record<string, unknown>),
        startedAt: now,
        status: 'run',
      }
      await write($, (b) => ({
        entries: [...b.entries, entry].slice(-80),
        counts: { ...b.counts, [entry.station]: (b.counts[entry.station] ?? 0) + 1 },
      }))
      return entry.id
    })
    const close = (status: Status): void => {
      void started
        .then((id) =>
          quietly(async () => {
            const now = await $.clock.now()
            await write($, (b) => ({
              ...b,
              entries: b.entries.map((x) => (x.id === id ? { ...x, status, endedAt: now } : x)),
            }))
          }),
        )
        .catch(() => undefined)
    }
    try {
      const ran = await next(e)
      close(ran.deny !== undefined ? 'block' : ran.isError === true ? 'err' : 'ok')
      return ran
    } catch (failure) {
      close('err')
      throw failure
    }
  })
}
```

O painel lê `shown` com `read($, shown)` e o desenha com `Svg` só quando a superfície tem um e não é o terminal.

## Erros comuns e como testar

Eles vêm do código do Narsil Check, da sua revisão e dos seus testes:

- **Esperar o mapa antes da ferramenta.** Cada chamada fica mais lenta. Comece `next(e)` primeiro e escreva junto.
- **Deixar um erro do mapa escapar.** Uma escrita que falhou faria a ferramenta falhar. Envolva cada escrita.
- **Redesenhar a cada escrita.** Uma rajada de chamadas vira uma rajada de SVGs grandes. Limite uma cópia.
- **Mostrar conteúdo.** Uma busca, o caminho de uma URL ou uma linha de comando podem ter segredos. Mostre só nomes e limpe os caracteres de controle.
- **Chamadas que nunca fecham.** Um turno interrompido ou um aviso perdido deixam uma entrada pulsando para sempre. Feche-as no fim do turno e faça as tarefas em segundo plano antigas expirarem.
- **Registrar um evento duas vezes num módulo.** O motor recusa. Chame a função do mapa a partir do hook que já existe.
- **Esquecer o limite de `Svg`.** Imagens embutidas pesam. Meça, e tenha uma alternativa.

Para testar, `claude plugin test .` roda os testes do mod. `tests/map.test.tsx` cobre as partes puras: "every kind of call lands on its station", "a command behind a wrapper or inside another is the command it runs" e "labels never carry what was written, searched or a password". `tests/map-pane.test.tsx` conduz os hooks: "a tool never waits on the map", "a burst of calls is one redraw of the map, made once the wait is over", "a refused call turns the map red with a dot on its station, and the next message clears it" e "a background task that never reports back is closed at the end of a turn once it is an hour old". Em `tests/pane.test.tsx`, "the work map is the first section, open, with baby Narsil at its core; the terminal draws neither" confere o lugar da seção.

## Para ir além

- Deixe cada pessoa nomear os próprios servidores ou comandos de memória: `hooks/map/stations.ts` mantém a configuração do lot-map, com todas as listas vazias.
- Traga a lista de linhas do lot-map, uma lista em texto das últimas ações, para o terminal, onde o SVG não é desenhado.
- Adicione um zoom ou um filtro por estação, que o lot-map tem e esta adaptação deixou de fora.
