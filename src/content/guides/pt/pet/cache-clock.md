---
title: O relógio do cache
description: 'Como a Narsil conta o tempo do cache do prompt desde o início da última requisição, 60 minutos numa assinatura e 5 com chave de API, e por que o próximo turno custa mais quando esfria.'
route: pet
order: 8
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: hooks/usage.ts
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## O que faz

Quando um turno termina e o Claude espera por você, a Narsil mostra um pequeno relógio na linha da conversa:

```text
🧊 Caché: 42 min
```

Ele faz a contagem regressiva, minuto a minuto, de quanto tempo se espera que dure o cache do prompt desta conversa. Quando chega a zero, ele avisa: na faixa, "🧊 Caché fría" ("cache frio"), e na janela flutuante e no hub, a frase completa "🧊 Caché fría: el próximo mensaje se cobra completo" ("cache frio: a próxima mensagem é cobrada por inteiro"). Quando você envia o próximo prompt, o relógio some, já que o Claude está trabalhando de novo, e um novo começa quando esse turno termina.

Por que isso importa para você: cada mensagem que você envia faz o Claude ler a conversa inteira de novo. O cache do prompt guarda a parte já enviada, então uma resposta dentro do tempo de vida dele a reaproveita. Como diz o README, a mensagem fica então mais barata; quando o cache expira, a próxima mensagem é cobrada por inteiro, e a conversa precisa ser escrita no cache de novo. Os tipos da 2.1.325 descrevem essa reescrita, em outro contexto, como "waited for, the longer the conversation the longer" (algo que se espera, e quanto mais longa a conversa, mais longa a espera). Assim, o relógio responde a uma pergunta prática: se você voltar a esta conversa agora, ela ainda está quente?

O relógio supõe 60 minutos num plano de assinatura e 5 minutos com uma chave de API. `/narsil cache` diz quanto tempo ele está contando; `/narsil cache 30` o define manualmente, e `/narsil cache auto` volta a decidir a partir da sua conta.

A linha de cada conversa mostra o seu próprio relógio, para que você veja quais conversas ainda estão quentes antes de retomar uma delas.

## Como funciona por dentro

### Não é um temporizador: um valor e um batimento

O relógio é um atom, `cache`, em `hooks/register.tsx`. Ele guarda quatro números:

- `at`: quando o turno terminou.
- `requestAt`: quando começou a última requisição ao modelo do turno.
- `minutes`: quanto tempo o cache dura.
- `left`: os minutos inteiros restantes, como exibidos.

Nada faz a contagem regressiva sozinho. A cada batimento de dois segundos, `tickCache` recalcula `left` com `cacheLeft` de `hooks/words.ts`:

```ts
export function cacheLeft(at: number, minutes: number, now: number): number {
  return Math.max(0, Math.ceil((at + minutes * 60_000 - now) / 60_000))
}
```

Ele só grava o atom quando o número de minutos mudou, então a faixa se redesenha uma vez por minuto, não a cada dois segundos. Arredondar para cima significa que "1 min" fica até o último segundo passar, e zero significa que o cache realmente acabou.

### Quando começa e quando para

Três eventos o movem:

- **`turn.step`** dispara quando o motor está prestes a enviar uma requisição ao modelo. Para a conversa principal (`e.agentId === undefined`), a Narsil registra o horário em `lastRequestAt`. As requisições de um subagente ficam de fora: como diz o comentário, as requisições de um subagente têm um cache próprio.
- **`turn.complete`** para a conversa principal chama `startCache`, que grava o atom com `at` definido como agora e `requestAt` definido como `lastRequestAt`.
- **`turn.start`** apaga o atom: enquanto o Claude trabalha, não há relógio.

### Por que a partir do início da última requisição

O relógio conta a partir de quando a última requisição começou, não de quando o turno terminou. O auxiliar `cacheStart` diz por quê no seu comentário: "the API counts it from the start of the request that last read or wrote it" (a API o conta a partir do início da requisição que o leu ou escreveu por último). Uma resposta longa que levou três minutos para ser escrita já gastou três dos minutos do cache quando o turno termina.

Isso foi uma correção, `c3e4464`, e o teste que a fixa se lê como a explicação: com um cache de cinco minutos e três minutos gastos enquanto o modelo respondia, a faixa mostra "🧊 Caché: 2 min" no fim do turno, não cinco.

Os próximos passos que a Narsil oferece depois de um turno tranquilo continuam contando a partir do fim do turno (`at`): eles dizem respeito à sua ausência, não ao cache.

### Decidir entre 60 e 5 minutos

Quanto tempo o cache dura não é algo que o mod consiga ler. O comentário acima das constantes diz isso:

```tsx
// How long the prompt cache lasts, in minutes: on a plan Claude Code keeps it
// an hour, with an API key five minutes. The API does not say which: a
// person who knows better sets it with /narsil cache.
const PLAN_CACHE_MINUTES = 60
const API_CACHE_MINUTES = 5
```

Tradução do comentário para o português: quanto tempo dura o cache do prompt, em minutos; num plano o Claude Code o mantém por uma hora, com uma chave de API por cinco minutos. A API não diz qual dos dois vale: uma pessoa que saiba melhor o define com /narsil cache.

Assim, `cacheMinutes` decide em dois passos:

1. Se você definiu um número com `/narsil cache <min>`, esse número.
2. Caso contrário, se a conta tem janelas de limite de uso. Se o atom `usage` (do guia anterior) contém uma leitura de 5 horas ou semanal, é uma assinatura e o cache recebe 60 minutos; se não, é uma chave de API e o cache recebe 5.

O segundo passo se apoia no que os tipos da 2.1.325 dizem sobre `rateLimits`: "empty off a subscription" (vazio fora de uma assinatura). A decisão é tomada quando o turno termina, a partir do que o atom `usage` contiver naquele momento.

Os números 60 e 5 são uma suposição do mod, declarada no seu código e no README, não um número que o Claude Code informa. A configuração manual existe porque a pessoa autora sabia que a suposição podia estar errada para a configuração de alguém. Uma nova configuração também recalcula o relógio que já está rodando.

### O que ele desenha, e onde

O texto vem de `cacheLabel` em `hooks/words.ts`: "🧊 Caché: N min" enquanto está quente, a frase do cache frio em zero. `cacheShort` corta a frase do cache frio para "🧊 Caché fría" nas linhas da faixa, que têm pouco espaço; a janela flutuante mostra o rótulo completo quando você abre uma conversa.

Cada conversa também envia ao hub `cacheEndsAt`, o momento em que o seu cache acaba, em segundos, e `cacheMinutes`. Com eles, as outras conversas, a janela flutuante e o celular conseguem fazer a contagem regressiva de um relógio que não iniciaram.

O README diz que o relógio é verde enquanto está fresco e vermelho quando está prestes a expirar, e `hooks/words.ts` tem uma `cacheColor` para isso, baseada em quanto da vida do cache já foi gasto. No código atual, `hooks/register.tsx` importa `cacheColor`, mas nunca a chama: a faixa desenha o relógio como texto atenuado, e a janela flutuante como uma nota simples. Se você construir o seu, a cor é um acréscimo de uma linha, mostrado abaixo.

## Como foi pedido à IA

O pedido original do relógio do cache não foi registrado. Ele chegou em 2026-10-30, antes dos registros públicos de tarefas.

### Registrado: o cache fica

A única menção registrada está em `odd/tasks/fleet-view.md` no narsil-pet, L2 (trecho), quando a pessoa autora estava removendo seções da faixa para abrir espaço para a lista de conversas:

> "la del cache la mantenemos, la del dinero tambien podriamos eliminarla"

Tradução para o português: a do cache nós mantemos; a do dinheiro também poderíamos remover. A contagem de gastos saiu; o relógio do cache ficou, e o design combinado em L4 o pôs na linha de cada conversa: "the list of conversations (state, title, context bar, cache clock)" (a lista de conversas: estado, título, barra de contexto, relógio do cache).

### Reconstrução a partir do histórico de commits

A partir de `git log -- hooks/register.tsx hooks/words.ts`, os commits que mexeram no relógio:

- `0993bd7` (2026-10-30) "feat: show a prompt-cache clock and offer next steps after a turn" (mostrar um relógio do cache do prompt e oferecer próximos passos depois de um turno). O relógio e os próximos passos chegam juntos, ambos iniciados pelo fim de um turno.
- `0cfc369` (2026-10-31) "refactor: move Narsil's wording and labels out of the hooks module" (tirar os textos e rótulos da Narsil do módulo de hooks). Os rótulos vão para `hooks/words.ts`.
- `4f8abaa` (2026-11-01) "feat: send the state the band shows to a status topic for your own phone app" (enviar o estado que a faixa mostra a um tópico de status para o seu próprio aplicativo de celular). O cache viaja até o celular.
- `49f0fd9` (2026-11-06) "feat: list every open conversation in the band" (listar todas as conversas abertas na faixa). O relógio passa para cada linha.
- `0072d87` (2026-11-07) "fix: make room for the cache in each band row" (abrir espaço para o cache em cada linha da faixa).
- `c3e4464` (2026-11-09) "fix: count the prompt cache from the start of its last request" (contar o cache do prompt a partir do início da sua última requisição). A correção descrita acima: antes dela, o relógio começava quando o turno terminava, e exagerava o que restava depois de uma resposta longa.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No meu mod do Claude Code `my-pet`, mostre uma contagem regressiva do cache do prompt na faixa `AbovePrompt` enquanto o Claude espera por mim. Em `turn.step`, apenas para a conversa principal (`e.agentId === undefined`), registre o horário com `$.clock.now()` antes da requisição e repasse o fluxo com `return yield* next(e)`. Em `turn.complete`, para a conversa principal, inicie um relógio num atom a partir desse horário da requisição; apague-o em `turn.start`. Dure 60 minutos quando `$.session.usage()` informar janelas de limite de uso e 5 minutos quando não informar nenhuma, e deixe que um comando `/pet cache <min>` o substitua. A cada poucos segundos, com `$.clock.every`, recalcule os minutos inteiros restantes, arredondados para cima, e grave o atom só quando o número mudar. Mostre "Cache: N min" e, em zero, "Cache cold: the next message is billed in full". Adicione um teste com um relógio simulado de que uma resposta de três minutos deixa dois minutos de um cache de cinco minutos.

## O código mínimo

Escrito para este guia e conferido com os tipos da 2.1.325 (`turn.step`, `turn.start`, `turn.complete`, `$.clock.now`, `$.clock.every`, `$.session.usage`). Foi adaptado de `hooks/register.tsx` e `hooks/words.ts` do [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). O atom `cache` está declarado em `types/index.d.ts`, como no primeiro guia, com o tipo `{ requestAt: number; minutes: number; left: number } | null`.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const cache = atom({ plugin: 'my-pet', key: 'cache' } as const, null)
let lastRequestAt: number | null = null

const minutesLeft = (from: number, minutes: number, now: number) =>
  Math.max(0, Math.ceil((from + minutes * 60_000 - now) / 60_000))

async function cacheMinutes($: EngineInterface): Promise<number> {
  const usage = await $.session.usage().catch(() => undefined)
  return usage && usage.rateLimits.length > 0 ? 60 : 5
}

async function tick($: EngineInterface): Promise<void> {
  const c = await read($, cache)
  if (!c) return
  const left = minutesLeft(c.requestAt, c.minutes, await $.clock.now())
  if (left !== c.left) await update($, cache, (k) => (k ? { ...k, left } : k))
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    $.clock.every(5000, () => void tick($))
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) lastRequestAt = await $.clock.now()
    return yield* next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) await update($, cache, () => null)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    const now = await $.clock.now()
    const requestAt = lastRequestAt ?? now
    const minutes = await cacheMinutes($)
    await update($, cache, () => ({
      requestAt,
      minutes,
      left: minutesLeft(requestAt, minutes, now),
    }))
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const c = await read($, cache)
    if (!c) return next(e)
    const { Text } = $.ui.resolve(e)
    const spent = 100 - (c.left / c.minutes) * 100
    const color = spent >= 85 ? '#F0435A' : spent >= 60 ? '#F5B400' : '#22B573'
    return c.left > 0 ? (
      <Text color={color}>{`🧊 Cache: ${c.left} min`}</Text>
    ) : (
      <Text color={color}>🧊 Cache cold: the next message is billed in full</Text>
    )
  })
}
```

Esta versão consulta `$.session.usage()` no fim de cada turno. A Narsil lê os mesmos números do seu atom `usage`, mantido atualizado por `session.measure` (guia anterior), o que poupa a chamada.

## Erros comuns e como testar

- **Contar a partir do fim do turno.** A vida do cache começa com a requisição. Depois de uma resposta longa, um relógio iniciado no fim mostra minutos que já se foram (`c3e4464`).
- **Deixar os subagentes moverem o relógio.** As requisições de um subagente também disparam `turn.step`, com `e.agentId` definido, e elas têm o seu próprio cache. A Narsil registra apenas as da conversa principal.
- **Um relógio enquanto o Claude trabalha.** Cada nova requisição escreve o cache de novo, então uma contagem regressiva durante um turno não significa nada. Apague-o em `turn.start`.
- **Redesenhar a cada batida.** Recalcule com frequência, grave só quando o minuto mudar.
- **Tratar 60 e 5 como fatos.** Eles são a suposição do mod sobre como o Claude Code e a API configuram o cache. Dê à pessoa uma forma de substituí-los.
- **Engolir o fluxo em `turn.step`.** O hook é um gerador: repasse cada pedaço (`return yield* next(e)` ou um `for await` que entregue cada um), ou a resposta deixa de chegar à tela.

Para testar, `claude plugin test .` executa `tests/narsil.test.tsx` com um relógio simulado. "after a turn the band counts down the prompt cache, and says when it has gone cold" (depois de um turno a faixa faz a contagem regressiva do cache do prompt, e avisa quando ele esfriou) confere "🧊 Caché: 5 min" fora de um plano, depois "🧊 Caché: 2 min", depois "🧊 Caché fría" na faixa enquanto o hub recebe a frase completa, e que um novo turno remove o relógio. "the cache counts from the start of the last request, not from the end of the turn" (o cache conta a partir do início da última requisição, não do fim do turno) confere "🧊 Caché: 2 min" depois de uma resposta de três minutos e o `cacheEndsAt` exato enviado ao hub. "a request of a subagent does not move the cache clock of the conversation" (uma requisição de um subagente não move o relógio do cache da conversa) e "on a plan the cache lasts an hour, and /narsil cache sets it by hand" (num plano o cache dura uma hora, e /narsil cache o define manualmente) cobrem o resto.

## Para ir além

- `stepsCommand` em `hooks/register.tsx` trata `/narsil cache`, `/narsil cache auto` e `/narsil cache <min>`, e também aceita `caché` com o seu acento.
- `offerSteps` usa o mesmo momento de fim de turno, `at`, para oferecer próximos passos 15 minutos depois de um turno (`STEPS_AFTER_MS`).
- `shownState` envia `cache`, `cacheEndsAt` e `cacheMinutes` ao hub para a janela flutuante, as outras conversas e o celular.
- `cacheColor` em `hooks/words.ts` está pronta para um relógio colorido, usando os mesmos limiares de `levelColor` das barras de uso em `hooks/usage.ts`.
