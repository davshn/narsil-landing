---
title: Do que é feito um mod
description: Os três arquivos de um mod do Claude Code, a função register e seus hooks, e o menor mod que mostra algo na tela.
route: mods
order: 1
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: .claude-plugin/plugin.json
  - repo: pet
    path: hooks/hooks.json
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: types/index.d.ts
---

## O que faz

Um mod é um plugin do Claude Code feito de hooks de função: TypeScript que roda dentro do Claude Code e muda o que ele mostra ou como ele se comporta. Ao final deste guia, você vai saber de quais arquivos um mod precisa e o que a função `register` faz, e terá um mod que mostra um toast quando uma sessão começa e mantém uma contagem de chamadas de ferramentas na sua linha de status.

A API de mods está em acesso antecipado e muda entre versões. Tudo aqui foi verificado com o Claude Code 2.1.325 e seu arquivo de declarações, `claude-code.d.ts`. Quando a sua versão for mais nova, esse arquivo é a referência.

## Como funciona por dentro

Um mod é uma pasta com três arquivos que você escreve à mão:

| Arquivo                      | O que contém                                                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `.claude-plugin/plugin.json` | O manifesto: `name`, `version`, `description` e, opcionalmente, `license`, `repository` e `types`.                |
| `hooks/hooks.json`           | Uma linha que nomeia o módulo de hooks: `{ "modules": ["./register.tsx"] }`. O caminho é relativo a `hooks.json`. |
| `hooks/register.tsx`         | O módulo de hooks. Ele exporta `register`.                                                                        |

O módulo de hooks é um módulo ES com extensão `.ts`, `.tsx`, `.js` ou outro sufixo de script. Ele roda em um ambiente próprio, sem DOM e sem Node. Tudo o que está fora do módulo (a tela, os arquivos, a rede, o relógio) é acessado pelo objeto `$` que todo hook recebe. Outros arquivos do plugin são importados com declarações `import` comuns; um módulo que usa `import()` dinâmico não carrega.

`register(on, options)` é chamada quando o módulo carrega. `on(event, matcher?, hook)` adiciona um hook a um evento. `options` contém os valores dos campos `userConfig` que o manifesto declarar.

Todo hook tem a forma `($, e, next)`:

- `$` é a interface do motor: exibição, armazenamento, estado, relógio, rede, processos, arquivos, sessão, modelo, ferramentas, comandos e o restante.
- `e` é a entrada do evento como um valor simples. Para `tool.call`, é a chamada da ferramenta, com o tipo restrito por ferramenta.
- `next(e)` passa o evento adiante para os outros plugins e depois para o comportamento do próprio Claude Code, e resolve com o resultado do evento.

Um hook que retorna sem chamar `next` responde ele mesmo ao evento. Um hook que chama `next({ ...e, ... })` muda o que o restante da cadeia vê, dentro do que esse evento permite. A maioria dos hooks que só observam termina com `return next(e)`.

O arquivo opcional `types/index.d.ts` é o contrato de tipos do mod. Ele declara a forma dos valores que o mod guarda em `$.state` (e, para um mod que adiciona um substantivo a `$`, esse substantivo). O `plugin.json` o nomeia em `"types"`, e `claude plugin validate` confere as leituras e escritas de estado do mod com base nele.

## Passo a passo

### 1. O manifesto

Crie uma pasta chamada `greeter` e escreva `.claude-plugin/plugin.json`:

```json
{
  "name": "greeter",
  "version": "0.1.0",
  "description": "Says hello when a session starts and counts tool calls"
}
```

O `name` é como o Claude Code, seu log de depuração e as suas chaves de estado se referem ao mod.

### 2. O arquivo de hooks

Escreva `hooks/hooks.json`:

```json
{ "modules": ["./register.tsx"] }
```

### 3. Um hook que mostra algo

Escreva `hooks/register.tsx` com um hook em `session.start`:

```tsx
import type { Register } from 'claude-code'

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    $.ui.toast('Hello from greeter')
    return next(e)
  })
}
```

`Register` vem do módulo `claude-code`. A importação é só de tipos: em tempo de execução, ela é vazia. `$.ui.toast(text)` mostra uma pequena caixa sob o nome do plugin por alguns segundos (4000 ms por padrão). Em seguida, o hook chama `next(e)` para que a sessão comece normalmente.

### 4. Uma linha de status que conta chamadas de ferramentas

Adicione um segundo hook. `tool.call` roda a cada chamada de ferramenta, e `$.ui.status(text)` fixa uma linha para este plugin sob o prompt até que a próxima chamada a substitua:

```tsx
import type { Register } from 'claude-code'

export const register: Register = (on) => {
  let count = 0

  on('session.start', async ($, e, next) => {
    $.ui.toast('Hello from greeter')
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    count += 1
    $.ui.status(`greeter: ${count} tool calls`)
    return next(e)
  })
}
```

Isso funciona, mas `count` é uma variável do módulo. Salvar o arquivo recarrega o módulo em um ambiente novo, então a contagem recomeça do zero.

### 5. Um contrato de tipos e um estado que sobrevive a uma recarga

`$.state` guarda valores nomeados para a sessão, e eles sobrevivem a uma recarga a quente do módulo. Declare o valor em `types/index.d.ts`:

```ts
declare module 'claude-code' {
  interface PluginState {
    greeter: { calls: number }
  }
}
```

Nomeie o arquivo no manifesto:

```json
{
  "name": "greeter",
  "version": "0.1.0",
  "description": "Says hello when a session starts and counts tool calls",
  "types": "./types/index.d.ts"
}
```

Depois, use os auxiliares de estado `atom` e `update` de `claude-code`:

```tsx
import { atom, update } from 'claude-code'
import type { Register } from 'claude-code'

const calls = atom({ plugin: 'greeter', key: 'calls' } as const, 0)

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    $.ui.toast('Hello from greeter')
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const count = await update($, calls, (n) => n + 1)
    $.ui.status(`greeter: ${count} tool calls`)
    return next(e)
  })
}
```

`plugin` e `key` precisam ser literais de string, de acordo com o contrato. `update` lê o valor, aplica a função e grava o resultado, tentando de novo se outra escrita chegar antes, e resolve com o novo valor.

O mod finalizado:

```text
greeter/
  .claude-plugin/plugin.json
  hooks/hooks.json
  hooks/register.tsx
  types/index.d.ts
```

O guia "Instalar, recarregar, validar e testar" mostra como carregá-lo em uma sessão.

## Erros comuns e como testar

- **Esquecer o `next`.** Um hook que nunca chama `next(e)` responde sozinho ao evento. Em `session.start` ou `tool.call`, isso muda mais do que você pretendia. Retorne `next(e)`, a menos que responder seja o objetivo.
- **Registrar o mesmo hook duas vezes.** Um registro repetido lança um erro, e um laço que executa um `on(...)` duas vezes passa pelo validate, mas é recusado ao carregar.
- **Usar APIs do Node ou do DOM.** Não existe `require`, nem módulo `fs`, nem `window`. Use `$.fs`, `$.http`, `$.process` e o restante de `$`.
- **Um hook que lança um erro.** Ele é ignorado e a cadeia continua sem ele. Rode com `claude --debug` durante o desenvolvimento: o log de depuração diz por que um hook foi ignorado.

Rode `claude plugin validate` na pasta cedo e com frequência. Ele lê o manifesto, o contrato e o módulo de hooks da mesma forma que o Claude Code vai ler. Para o `greeter` finalizado, ele informa, entre outras linhas:

```text
❯ types ./types/index.d.ts declares state: greeter.calls
❯ ./register.tsx hooks: session.start, tool.call
❯ ./register.tsx gating hook without .catch: tool.call
❯ ./register.tsx calls: $.state.get, $.state.set, $.ui.status, $.ui.toast
```

A linha `gating hook without .catch` é um fato, não uma falha: `tool.call` é um evento cuja resposta pode recusar o que foi pedido, e um hook ali que falha é ignorado. Só um hook que protege (um que pode recusar uma chamada) precisa de um tratador `.catch`.

## Para ir além

O narsil-pet segue a mesma estrutura. Seu `.claude-plugin/plugin.json` define `"license": "GPL-3.0-or-later"`, `repository` e `"types": "./types/index.d.ts"`. Seu `hooks/hooks.json` é a mesma linha única mostrada acima. Seu `hooks/register.tsx` exporta `register` e registra um hook por evento, começando por `session.start`, que registra o comando `/narsil`, restaura as preferências a partir de `$.store` e inicia seus temporizadores antes de retornar `next(e)`. Seu `types/index.d.ts` exporta os tipos do mod (`Mood`, `Pet`, `Prefs` e outros) e declara cada chave de `$.state` em `PluginState['narsil-pet']`.
