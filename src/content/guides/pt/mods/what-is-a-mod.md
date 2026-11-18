---
title: Do que é feito um mod
description: Os três arquivos de um mod do Claude Code, a função register e seus hooks, e o menor mod que mostra algo na tela.
route: mods
order: 1
updated: 2026-11-18
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

Um mod é um plugin do Claude Code feito de hooks. Um hook é uma função que o Claude Code chama quando algo acontece: uma sessão começa, o Claude chama uma ferramenta, um turno termina. Os mods são escritos em TypeScript e mudam o que o Claude Code mostra ou como ele se comporta.

Neste guia, você vai pedir ao Claude que construa um pequeno mod chamado `greeter`. Ele mostra uma mensagem curta (um toast) quando uma sessão começa e conta as chamadas de ferramentas na sua linha de status. No caminho, você vai aprender de quais arquivos todo mod precisa e o que a função `register` faz, para saber se o que o Claude escreveu está certo.

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

## Construa com o Claude

Você não precisa digitar esses arquivos. O Claude Code inclui uma skill para escrever mods, `plugin-authoring`, que conhece os tipos reais da API de mods. Peça ao Claude que a use e descreva o que você quer em palavras simples: o nome do mod, o que ele faz e quando.

> Usando a skill plugin-authoring, crie um mod do Claude Code chamado `greeter` em uma pasta nova. Quando uma sessão começar, ele mostra um toast que diz "Hello from greeter". Ele conta cada chamada de ferramenta e mostra a contagem na sua linha de status, por exemplo "greeter: 3 tool calls". Guarde a contagem em `$.state` com um `atom` declarado em `types/index.d.ts`, para que ela sobreviva a uma recarga do módulo. Quando terminar, rode `claude plugin validate` na pasta e me mostre o que ele informa.

Por que este prompt funciona:

- **Ele nomeia a skill**, então o Claude confere cada chamada com a API real em vez de adivinhar.
- **Ele descreve um comportamento que você pode ver** (o toast e a linha de status), então você consegue saber quando funciona.
- **Ele diz onde a contagem fica.** Sem essa linha, uma primeira resposta comum guarda a contagem em uma variável simples que volta a zero toda vez que você salva o arquivo. O passo 4 abaixo mostra por quê.
- **Ele pede uma prova.** A saída do validate lista os hooks e as chamadas que o mod realmente faz.

Quando o Claude responder, confira quatro coisas antes de seguir:

1. A pasta tem os quatro arquivos da tabela acima: `plugin.json`, `hooks.json`, `register.tsx` e `types/index.d.ts`.
2. Todo hook termina com `return next(e)`.
3. A contagem usa `atom` e `update`, não uma variável declarada com `let`.
4. `claude plugin validate` lista `hooks: session.start, tool.call`.

Se algo não estiver certo, diga ao Claude o que você vê, não só como corrigir: "a contagem volta a 0 toda vez que eu salvo `register.tsx`". Descrever o sintoma permite que o Claude encontre a causa, e você aprende a ler o mod do jeito que ele lê.

## Entenda o código, passo a passo

É assim que uma boa resposta fica, construída uma parte de cada vez. Leia para entender o que cada linha faz e para comparar com o que o Claude escreveu. O Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

### 1. O manifesto

O mod fica em uma pasta chamada `greeter`. O manifesto dele é `.claude-plugin/plugin.json`:

```json
{
  "name": "greeter",
  "version": "0.1.0",
  "description": "Says hello when a session starts and counts tool calls"
}
```

O `name` é como o Claude Code, seu log de depuração e as suas chaves de estado se referem ao mod.

### 2. O arquivo de hooks

`hooks/hooks.json` diz ao Claude Code qual arquivo contém os hooks:

```json
{ "modules": ["./register.tsx"] }
```

### 3. Um hook que mostra algo

`hooks/register.tsx` começa com um hook em `session.start`:

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

Um segundo hook conta as chamadas. `tool.call` roda a cada chamada de ferramenta, e `$.ui.status(text)` fixa uma linha para este plugin sob o prompt até que a próxima chamada a substitua:

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

Esta é uma primeira resposta comum, e um bom exemplo de por que conferir: funciona até você salvar o arquivo. `count` é uma variável do módulo, e salvar recarrega o módulo em um ambiente novo, então a contagem recomeça do 0.

### 5. Um contrato de tipos e um estado que sobrevive a uma recarga

A correção é `$.state`, que guarda valores nomeados para a sessão e os mantém quando o módulo recarrega. O valor é declarado em `types/index.d.ts`:

```ts
declare module 'claude-code' {
  interface PluginState {
    greeter: { calls: number }
  }
}
```

O manifesto nomeia esse arquivo:

```json
{
  "name": "greeter",
  "version": "0.1.0",
  "description": "Says hello when a session starts and counts tool calls",
  "types": "./types/index.d.ts"
}
```

E o hook usa os auxiliares de estado `atom` e `update` de `claude-code`:

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

O próximo guia, "Instalar, recarregar, validar e testar", mostra como carregá-lo em uma sessão e testá-lo.

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
