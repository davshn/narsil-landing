---
title: Conectores
description: 'Como o Narsil Check lista os servidores MCP da sessão com o seu estado e quantas ferramentas cada um tem, pedidos uma vez ao próprio servidor de conectores do app de desktop.'
route: check
order: 3
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/session.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/session.test.tsx
---

## O que faz

A seção **Conectores** ("conectores") lista os servidores MCP da sessão, a mesma lista que a barra de sessão do app de desktop mostra. Ela responde a duas perguntas rápidas: quais servidores o Claude pode usar agora, e qual deles precisa de você.

O cabeçalho mostra `▸ Conectores · 2`, em que o número conta os servidores conectados. Aberta, ela mostra:

- **Primeiro os servidores conectados**, cada um com um ponto verde e quantas ferramentas oferece, como `notes-server · 19 herramientas` ("19 ferramentas").
- **Depois o resto**, cada um com um ponto amarelo e o seu estado como o app o informa, como `Mail · needs_auth`.

Quando nada está conectado, ela diz "No hay conectores conectados." ("nenhum conector está conectado"). Quando a lista não pode ser lida, ela diz por que em vermelho: "No pude leer los conectores: …" ("não consegui ler os conectores: …").

O ponto da seção resume tudo: verde quando todos os servidores estão ativos, amarelo quando um precisa de login ou falhou, vermelho quando a lista não pôde ser lida, cinza antes da primeira leitura.

Toda sessão começa com esta seção recolhida; o início da sessão a deixa assim (`isConnectorsOpen` como `false`), não importa como você a deixou.

## Como funciona por dentro

### De onde vem a lista

A lista é uma única chamada ao próprio servidor de conectores do app de desktop, feita em `loadSession` em `hooks/register.tsx`, ao lado das leituras da sessão do guia anterior:

```tsx
const result = await $.mcp.call(CONNECTORS_SERVER, CONNECTORS_TOOL)
const list = result.isError
  ? undefined
  : parseConnectors(result.structuredContent ?? jsonOf(result.content))
connectors = list
  ? { connectors: list }
  : { connectors: [], connectorsError: textOf(result.content) || 'respuesta sin conectores' }
```

Tradução da mensagem para o português: "respuesta sin conectores" (resposta sem conectores).

`CONNECTORS_SERVER` é `'ccd_connectors'` e `CONNECTORS_TOOL` é `'session_connectors_status'`, os dois em `hooks/session.ts`. A chamada não recebe argumentos. Como em todo `$.mcp.call` (veja o guia anterior), a resposta é lida de `structuredContent` quando existe e, caso contrário, do JSON nos blocos de texto, e uma falha é capturada e guardada como `connectorsError`.

`parseConnectors` transforma a resposta no tipo próprio do mod, `Connector` em `types/index.d.ts`: `{ name, status, tools? }`. Ele lê um array `servers`; descarta qualquer entrada sem um `name` de texto; mantém `status` como texto, ou `'unknown'` quando ele falta; e mantém `tool_count` como `tools` só quando é um número. Se não houver nenhum array `servers`, ele devolve `undefined`, que quem o chama transforma num erro em vez de numa lista vazia.

Essa distinção é deliberada: "nenhum servidor está conectado" e "não consegui ler os servidores" são respostas diferentes, e a seção as mostra de formas diferentes.

### O que ela mostra, e o que não mostra

A seção mostra o nome, o estado e a contagem de ferramentas de cada servidor. Ela não lista os nomes das ferramentas. O README descreve o mesmo: os servidores conectados "con cuántas herramientas tiene cada uno" ("com quantas ferramentas cada um tem"), depois os outros com o seu estado.

Os campos que ela lê (`servers`, `name`, `status`, `tool_count`) são a resposta do servidor do app de desktop, não fazem parte da API do mod, então os tipos da 2.1.325 não os documentam. A fixture em `tests/session.test.tsx` mostra o formato com que a pessoa autora trabalhou, com um campo `kind` que o mod ignora. O parser aceita o que não conhece: um estado diferente de `connected` aparece como veio, e o ponto amarelo de uma linha significa apenas "não conectado".

As palavras são funções puras em `hooks/session.ts`, então podem ser testadas isoladamente:

- `connected(view)` filtra os servidores cujo estado é `connected`.
- `connectorsLabel(isOpen, view)` desenha o cabeçalho, com a contagem só quando ela é maior que zero.
- `connectorLine(c)` desenha uma linha: o nome, depois a contagem de ferramentas para um servidor conectado ou, caso contrário, o estado.
- `toolsLabel(n)` diz `1 herramienta` ou `N herramientas`.
- `connectorsColor(view)` escolhe o ponto, conferindo primeiro o erro, depois se a lista foi lida, depois se algum servidor está `needs_auth` ou `failed`.

### Quando ela é lida de novo

Os conectores são lidos no mesmo `loadSession` que o resto da sessão, então seguem o mesmo calendário cuidadoso: uma vez dez segundos depois do início da sessão, mais uma vez no primeiro turno se aquela falhou, e depois de um turno só quando o turno usou uma ferramenta que muda a resposta dos servidores. Para os conectores, isso significa qualquer ferramenta `mcp__ccd_connectors__`, que faz parte de `SESSION_TOOLS`. Abrir o recolhimento lê tudo de novo, então abrir a seção é a forma de atualizá-la manualmente.

O motivo é o mesmo do ambiente: cada chamada aos servidores do app é vista por todos os outros mods como uma chamada de ferramenta, e uma chamada cedo demais pode fazer o app de desktop pedir permissão.

### Por que um servidor do desktop, e não o motor

Os tipos da 2.1.325 dão ao mod duas chamadas em `$.mcp`: `call`, para chamar uma ferramenta de um servidor conectado, e `connect`, para trazer para a sessão um servidor retido. Nenhuma das duas lista os servidores com os seus estados. O app de desktop tem uma ferramenta que faz isso, então o Narsil Check pergunta a ela.

O custo é a superfície. Fora do app de desktop não existe `ccd_connectors`, a chamada falha, e a seção diz isso. A tabela de superfícies do README o afirma: Conectores funciona no app de desktop e, em outros lugares, "la sección dice por qué no pudo leerlos" ("a seção diz por que não conseguiu lê-los").

### Para que serve a seção

Os commits mostram que o propósito da seção mudou uma vez. Em `2bd1919`, um clique em qualquer linha de conector abria `/mcp`, a própria lista de servidores do motor. Um commit depois, `c07f5e9` voltou a deixar as linhas simples, e a sua mensagem diz por quê: "/mcp from a mod only prints a summary in the desktop app" (/mcp a partir de um mod só imprime um resumo no app de desktop). Então a seção serve para ler de relance, e o lugar para fazer login ou consertar um servidor continua sendo o do próprio app.

## Como foi pedido à IA

O pedido original da seção de conectores não foi registrado. Nenhum dos registros de tarefas públicos do narsil-check (`odd/tasks/*.md`) trata dela.

### Reconstrução a partir do histórico de commits

A partir de `git log -- hooks/session.ts`, com os commits relacionados em `hooks/register.tsx`:

- `be8eac0` (2026-11-05) "feat: show the session bar's environment, connectors and Remote Control in the pane" (mostrar no painel o ambiente, os conectores e o Remote Control da barra de sessão). Os conectores chegam junto com o ambiente, como parte da substituição da barra de sessão do app.
- `2bd1919` (2026-11-05) "feat: repository link, Remote Control switch in Entorno and /mcp from connectors" (link do repositório, interruptor de Remote Control em Entorno e /mcp a partir dos conectores). A sua mensagem: "Any connector row opens /mcp." (qualquer linha de conector abre /mcp).
- `c07f5e9` (2026-11-05) "feat: Entorno starts open, other sections fold until they have something" (Entorno começa aberta, as outras seções ficam recolhidas até terem algo). Conectores começa recolhida, e as linhas voltam a ser simples.
- `55fe118` (2026-11-06) e `4770a49` (2026-11-06), as duas correções que tornaram mais raras todas as leituras dos servidores do app, tratadas no guia anterior. Elas se aplicam aos conectores porque eles são lidos na mesma chamada.

O padrão: uma funcionalidade adicionada com o resto da barra de sessão, um clique que se mostrou inútil no app de desktop e foi removido, e a regra de consultar pouco, herdada do ambiente.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No meu mod do Claude Code `my-panel`, adicione ao painel uma seção "Connectors". No app de desktop, leia os servidores MCP da sessão uma vez com `$.mcp.call('ccd_connectors', 'session_connectors_status')`, preferindo `structuredContent` e recorrendo ao JSON no conteúdo de texto. Interprete um array `servers` como `{ name, status, tools }` a partir de `name`, `status` e `tool_count`, descartando as entradas sem nome, e trate um array ausente como um erro, não como uma lista vazia. Mostre primeiro os servidores conectados com um ponto verde e a sua contagem de ferramentas, depois os outros com um ponto amarelo e o seu estado. Pinte o ponto da seção de vermelho quando a leitura falhou, de cinza antes dela, de amarelo quando um servidor está `needs_auth` ou `failed`, e de verde nos demais casos. Leia de novo só quando o recolhimento for aberto. Teste o parser e as cores como funções puras.

## O código mínimo

Esta é uma versão reduzida da ideia, escrita para este guia e conferida com os tipos do Claude Code 2.1.325. Foi adaptada de `hooks/session.ts` e `hooks/register.tsx` do [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later).

A parte pura, `hooks/connectors.ts`:

```ts
export type Connector = { name: string; status: string; tools?: number }

export function parseConnectors(value: unknown): Connector[] | undefined {
  const servers = (value as { servers?: unknown } | undefined)?.servers
  if (!Array.isArray(servers)) return undefined
  return servers
    .filter(
      (s): s is Record<string, unknown> =>
        typeof s === 'object' && s !== null && typeof s.name === 'string',
    )
    .map((s) => ({
      name: s.name as string,
      status: typeof s.status === 'string' ? s.status : 'unknown',
      ...(typeof s.tool_count === 'number' ? { tools: s.tool_count } : {}),
    }))
}

export function connectorLine(c: Connector): string {
  if (c.status !== 'connected') return `${c.name} · ${c.status}`
  return c.tools === undefined ? c.name : `${c.name} · ${c.tools} tools`
}
```

A chamada, em `hooks/register.tsx`, que devolve a lista ou o motivo pelo qual ela não pôde ser lida:

```tsx
import type { EngineInterface } from 'claude-code'
import { parseConnectors, type Connector } from './connectors'

async function readConnectors($: EngineInterface): Promise<{ list: Connector[]; error?: string }> {
  try {
    const result = await $.mcp.call('ccd_connectors', 'session_connectors_status')
    const list = result.isError ? undefined : parseConnectors(result.structuredContent)
    return list ? { list } : { list: [], error: 'no list in the answer' }
  } catch (err) {
    return { list: [], error: err instanceof Error ? err.message : String(err) }
  }
}
```

Guarde o resultado num atom e desenhe-o no hook `ui.render` do painel como no primeiro guia: primeiro as linhas conectadas, depois o resto, cada uma com `connectorLine`. Esta versão mínima lê só `structuredContent`; o Narsil Check também interpreta o JSON nos blocos de texto (`jsonOf` em `hooks/session.ts`), caso o servidor responda só com texto.

## Erros comuns e como testar

Estes vêm do código e dos commits do Narsil Check:

- **Tratar uma leitura que falhou como "nenhum servidor".** Devolva `undefined` do parser quando o formato estiver errado, e mostre o erro. "Nenhum conector" é uma resposta real que só deve vir de uma lista real.
- **Confiar no formato da resposta do app.** Esses campos são do app de desktop, não da API do mod. Confira o tipo de cada campo, como `parseConnectors` faz, e mostre um estado desconhecido como texto.
- **Atualizar com um timer.** Cada chamada é uma chamada de ferramenta que outros mods veem. Leia a partir de eventos: o início, um turno que tocou nos conectores, a abertura do recolhimento.
- **Ligar as linhas a `/mcp`.** O Narsil Check tentou isso e removeu (`c07f5e9`): a partir de um mod, no app de desktop, isso só imprime um resumo.
- **Esperar que funcione em toda superfície.** `ccd_connectors` é do app de desktop; em outros lugares, a seção só pode dizer por que está vazia.

Para testar, os parsers e os rótulos são puros: `tests/session.test.tsx` os confere diretamente em "the session section reads the app servers and names what it found" (a seção da sessão lê os servidores do app e nomeia o que encontrou). Para a seção em si, responda ao servidor com um hook como `on('mcp.call', (_, e) => e.server === 'ccd_connectors' ? { value: { content: [{ type: 'text', text: JSON.stringify({ servers: [...] }) }], isError: false } } : ...)`, monte o painel, clique em `section-connectors` e procure as linhas. Use nomes de servidores sintéticos nas fixtures, como `notes-server` e `Mail`.

## Para ir além

- A seção faz par com o ambiente do guia anterior: os dois são lidos num único `loadSession`, então um único calendário governa todas as chamadas aos servidores do app.
- Os tipos oferecem outra fonte que funciona em toda superfície: `$.tool.list()` devolve as ferramentas que o modelo pode chamar agora, cada uma com `name`, `description` e `mcp: true` para a ferramenta de um servidor MCP. Agrupar os nomes `mcp__server__tool` por servidor dá os servidores conectados e as suas ferramentas, por nome. Isso não diz quais servidores esperam um login ou falharam, que é para isso que servem as linhas amarelas aqui. É uma troca real, e o narsil-check escolheu o servidor do desktop.
- `$.mcp.connect(server)` pode trazer um servidor que a sessão reteve, que é o passo seguinte a ver um servidor que não está conectado. O Narsil Check não o usa.
