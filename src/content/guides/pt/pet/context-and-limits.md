---
title: Contexto e limites
description: 'Como a Narsil desenha a barra de contexto de cada conversa, estima quando ela enche no ritmo dos últimos 15 minutos, sugere /compact uma vez e mostra os limites de 5 horas e semanal.'
route: pet
order: 7
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/usage.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## O que faz

Dois tipos de limite decidem por quanto tempo você pode continuar trabalhando com o Claude, e a Narsil mostra os dois.

**A janela de contexto** é o quanto da conversa o modelo consegue reter de uma vez. Quando ela enche, o Claude Code precisa compactar a conversa, resumindo o que veio antes, e detalhes podem se perder. Cada conversa tem a sua própria janela, então cada linha da faixa da Narsil tem a sua própria barra e porcentagem:

```text
● TRABAJANDO   ▾ web                     ██████░░░░ 62 %
```

A barra da sua própria conversa é azul, para se destacar; as outras são verdes, âmbar acima de 60 % e vermelhas acima de 85 %. Pressionar a porcentagem da conversa aberta mostra os seus tokens, quando ela vai encher e o que a preenche:

- "120k / 200k · lleno en ~20 min" ("cheio em cerca de 20 minutos").
- Uma barra por parte, como `/context` a divide: mensagens, o prompt de sistema, ferramentas MCP, arquivos de memória, a reserva de compactação e o espaço livre, cada uma com os seus tokens.

Quando o contexto passa de 70 % e vai encher em até 20 minutos, ou assim que passa de 85 %, a Narsil sugere uma vez: "El contexto va al 72 % y se llenará en ~13 min: es buen momento para /compact." ("O contexto está em 72 % e vai encher em cerca de 13 minutos: é um bom momento para /compact.")

**Os limites da conta** são a janela de 5 horas e a janela semanal de um plano de assinatura. Eles são os mesmos para todas as conversas, então aparecem uma vez, no topo, com o tempo até cada um recomeçar:

```text
5 horas  ███░░░░░░░ 31 %  reinicia en 2 h 05 min
Semana   █░░░░░░░░░ 12 %  reinicia en 3 d 4 h
```

Com uma chave de API não existem essas janelas, e a Narsil não mostra nenhuma.

## Como funciona por dentro

### De onde vêm os números

A Narsil não conta tokens por conta própria. Ela lê os números que o Claude Code já tem, os mesmos que a sua linha de status mostra, de dois lugares da API de mods:

- **`$.session.usage()`**, chamado uma vez em `session.start`. Ele retorna `context` (a janela ao vivo: `window` em tokens, e `tokens` e `percent` assim que uma resposta os informar) e `rateLimits`, uma entrada por janela, cada uma com um `kind` (`five_hour`, `seven_day`), um `percentUsed` e um carimbo de tempo opcional `resetsAt`.
- **O evento `session.measure`**, que, nas palavras dos tipos da 2.1.325, "fires when the engine measures the session and a unit moved: after each main-thread turn, and when a rate-limit window moves a whole point" (dispara quando o motor mede a sessão e uma unidade mudou: depois de cada turno da thread principal, e quando uma janela de limite de uso avança um ponto inteiro). Ele leva os mesmos `context` e `rateLimits`.

Ambos passam por uma função pura, `usageOf` em `hooks/usage.ts`, que os transforma no formato próprio da Narsil: `context` (`percent`, `tokens`, `window`), `fiveHour` e `week`. Uma janela sem leitura é `null`. Os tipos dizem que `rateLimits` fica "empty off a subscription" (vazio fora de uma assinatura), e é por isso que nenhum limite aparece com uma chave de API.

Depois, `setUsage` em `hooks/register.tsx` guarda o resultado no atom `usage` (só quando mudou), registra a leitura do contexto para a estimativa, atualiza o detalhamento e envia o estado ao hub, para que as outras conversas e a janela flutuante vejam a barra desta.

A escolha de design é receber os números, não consultá-los periodicamente. O motor dispara `session.measure` exatamente quando um número mudou, então a Narsil nunca pede números que não podem ter mudado.

### A estimativa: o ritmo dos últimos 15 minutos

"Cheio em cerca de 20 minutos" é um palpite em linha reta a partir das leituras recentes. Cada vez que o contexto é medido, `trackContext` acrescenta uma amostra, `{ at, percent }`, a uma lista de no máximo 30. Depois, `minutesToFull` em `hooks/usage.ts` faz a conta:

1. Manter só as amostras dos últimos 15 minutos (`BURN_WINDOW_MS`).
2. Pegar a primeira e a última. Se elas abrangem menos de um minuto, ou se o contexto não cresceu, não há estimativa.
3. O ritmo é o crescimento dividido pelos minutos entre elas.
4. A resposta é o espaço restante dividido pelo ritmo, arredondado.

Por exemplo: 50 % no minuto 0 e 60 % no minuto 5 dá 2 % por minuto, e os 40 % restantes levam 20 minutos.

Cada escolha tem uma razão:

- **Quinze minutos, não a conversa inteira.** O trabalho vem em rajadas. Um longo trecho calmo seguido de uma leitura pesada de arquivos deve dar uma estimativa próxima, não uma média que esconde a rajada.
- **Nenhuma estimativa para menos de um minuto ou para um contexto que não cresce.** Duas leituras com segundos de diferença, ou um contexto que encolheu, dão um ritmo que não significa nada.
- **Esquecer as amostras quando o contexto encolhe.** Uma queda significa que `/compact` ou `/clear` foi executado. O ritmo antigo pertence a uma conversa que não existe mais, então a lista recomeça.
- **Esconder estimativas acima de duas horas.** `MAX_ESTIMATE_MINUTES` é 120; um palpite tão à frente é impreciso demais para valer a pena mostrar, como diz o comentário.

### A sugestão de `/compact`, uma vez

`trackContext` também decide a sugestão, com quatro constantes:

- `NUDGE_AT = 70`: nunca abaixo de 70 %.
- `NUDGE_WITHIN_MINUTES = 20`: a partir de 70 %, só se a estimativa disser que enche em até 20 minutos.
- `NUDGE_ALWAYS_AT = 85`: a partir de 85 %, sempre, com ou sem estimativa.
- `NUDGE_RESET_BELOW = 50`: quando o contexto cai abaixo de 50 %, um novo enchimento pode receber uma nova sugestão.

Uma flag, `isCompactNudged`, faz com que ela aconteça uma vez por enchimento. A sugestão é uma das dicas da Narsil (`showTip` com o tipo `context`), então aparece onde as dicas dela aparecem, e é pulada quando as dicas estão desligadas (`/narsil consejos off`). O raciocínio é o mesmo de todo alerta da Narsil: um aviso que se repete a cada turno logo passa a ser ignorado.

### O detalhamento, estimado localmente

O que preenche o contexto vem de `$.session.usage({ breakdown: 'summary' })`. Os tipos descrevem os dois modos: `full` "sends one token-count request per tool and memory file, as /context does; `summary` estimates locally and sends none" (`full` envia uma requisição de contagem de tokens por ferramenta e por arquivo de memória, como faz /context; `summary` estima localmente e não envia nenhuma). A Narsil usa `summary` e o atualiza sempre que uma medição muda os números, para que o detalhamento possa ser aberto na hora, até para outra conversa, cujo detalhamento viaja pelo hub.

`contextDetailOf` em `hooks/usage.ts` mantém as partes que valem a pena mostrar: descarta os esquemas de ferramentas carregados sob demanda (`deferred`, fora da janela) e as linhas vazias, ordena o que está em uso por tamanho, depois a reserva de compactação, depois o espaço livre, e dá uma cor a cada uma.

### Desenhar as barras

As peças em `hooks/usage.ts` são pequenas e puras:

- `levelColor(percent)`: verde `#22B573`, âmbar `#F5B400` a partir de 60 %, vermelho `#F0435A` a partir de 85 %.
- `textBar(percent)`: dez células de `█` e `░`, para as linhas da faixa.
- `minutesLabel` e `resetIn`: "13 min", "2 h 05 min", "3 d 4 h".
- `usageRows`: as linhas a desenhar, cada uma com a sua nota: os tokens e a estimativa para o contexto, "reinicia en …" (reinicia em …) para os limites.
- `usageSvg`: as mesmas linhas como um pequeno SVG, usado no desktop, onde cada barra cresce a partir do vazio quando é desenhada e o texto segue o tema claro ou escuro.

### Por que uma barra por conversa

O contexto pertence a uma conversa, não a você. Um único número de "contexto" para várias conversas faria a média de coisas que não podem ser somadas numa média. Por isso a barra geral foi removida e cada linha ganhou a sua, como registra a próxima seção. Os limites da conta são o caso oposto: pertencem à conta, então aparecem uma vez.

## Construa com o Claude

Peça ao Claude que mostre na faixa o preenchimento da janela de contexto e os limites da conta, com uma estimativa de quando o contexto enche. A única ideia que o Claude precisa acertar: o Claude Code já tem os números, então o mod os lê de `$.session.usage()` e `session.measure` e nunca conta tokens nem consulta com um temporizador.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No meu mod do Claude Code `my-pet`, mostre o preenchimento da janela de contexto e os limites de 5 horas e semanal da conta na faixa `AbovePrompt`. Leia-os uma vez com `$.session.usage()` em `session.start` e depois a cada evento `session.measure`, e guarde-os num atom. Escreva a lógica como funções puras em `hooks/usage.ts`: uma que converta `context` e `rateLimits` (`five_hour`, `seven_day`) no meu próprio formato, uma barra de texto de dez células, uma cor que fica âmbar em 60 % e vermelha em 85 %, e `minutesToFull(samples, now)`, que estima quando o contexto enche a partir das leituras dos últimos 15 minutos e retorna null com menos de um minuto de leituras ou sem crescimento. Sugira `/compact` uma vez por enchimento quando o contexto passar de 70 % e encher em até 20 minutos, ou passar de 85 %. Adicione testes para cada função e confira cada API com os tipos do plugin-authoring.

### O que conferir na resposta do Claude

1. Os números são lidos uma vez em `session.start` e depois a cada evento `session.measure`, sem um temporizador que pergunte de novo e de novo.
2. Sem janelas de limite de uso (uma chave de API), nenhuma barra de limite aparece, em vez de barras em 0 %.
3. `minutesToFull` usa só as leituras dos últimos 15 minutos e retorna null com menos de um minuto de leituras ou sem crescimento, e as leituras são apagadas quando o contexto encolhe.
4. A sugestão de `/compact` vem uma vez por enchimento: a partir de 70 % quando o contexto enche em até 20 minutos, a partir de 85 % sempre, atrás de uma flag que só volta quando o contexto cai (a Narsil usa 50 %).
5. As barras ficam âmbar em 60 % e vermelhas em 85 %.

Se uma verificação falhar, diga ao Claude o que você vê: "a sugestão de /compact voltou em 71, 72 e 73 %", ou "depois de /compact a estimativa ainda diz que o contexto está quase cheio".

### Como a pessoa autora pediu

#### Registrado: uma barra por conversa

As barras por conversa foram pedidas em `odd/tasks/fleet-view.md` no narsil-pet, na mesma conversa que produziu a visão de frota (L1 tem a data 2026-11-06; as entradas posteriores não têm data). L3 (trecho):

> "la barra de contexto general tambien se iria por que no existe un contexto general y se reemplazaria por las barras de contexto de cada conversacion"

Tradução para o português: a barra de contexto geral também sairia, porque não existe um contexto geral, e seria substituída pela barra de contexto de cada conversa. A spec S5 do registro acrescenta: "The account limits (5 hours, week) stay, shown once." (os limites da conta, 5 horas e semana, ficam, mostrados uma vez).

O detalhamento foi pedido em L2 (trecho):

> "el detalle de como se llena el contexto deberia aparecer cuando se de click en la palabra contexto."

Tradução para o português: o detalhe de como o contexto se preenche deveria aparecer quando se clica na palavra "contexto". L7 o registra como feito na faixa. Um dia depois, `250d2c6` (2026-11-07) "feat: open the context from its percent and let next steps stand alone" (abrir o contexto pela sua porcentagem e deixar os próximos passos sozinhos) moveu o controle da faixa da palavra para a porcentagem, que é onde o README e o código o colocam hoje. Na janela flutuante, a palavra "Contexto" ainda o abre.

#### Reconstrução a partir do histórico de commits

As barras, a estimativa e a sugestão vieram antes desse registro, e os seus pedidos não foram registrados. A partir de `git log -- hooks/usage.ts hooks/register.tsx`:

- `630c0d8` (2026-10-30) "feat(usage): add context, 5-hour and weekly usage bars" (adicionar barras de uso de contexto, de 5 horas e semanal). A primeira versão: uma barra de contexto e os dois limites.
- `c885292` (2026-10-30) "feat: estimate when the context fills, react to tests and dangerous commands, show subagents" (estimar quando o contexto enche, reagir a testes e a comandos perigosos, mostrar subagentes). A estimativa de 15 minutos e a sugestão de `/compact`.
- `2bcc97c` (2026-11-05) "feat: open the context breakdown from the usage bars and calm loop, steps and permission alerts" (abrir o detalhamento do contexto a partir das barras de uso e acalmar os alertas de laço, de passos e de permissão). O detalhamento.
- `49f0fd9` (2026-11-06) "feat: list every open conversation in the band" (listar todas as conversas abertas na faixa). A barra passa para a linha de cada conversa, como L3 pediu.
- `d654e3b` (2026-11-06) "feat: list this conversation first with a blue context bar" (listar esta conversa primeiro, com uma barra de contexto azul).
- `250d2c6` (2026-11-07), acima.

## Código de referência

Esta é uma resposta correta, escrita para este guia. Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

Escrito para este guia e conferido com os tipos da 2.1.325 (`$.session.usage`, `session.measure`, `SessionContextUsage`, `SessionRateLimit`, `$.clock.now`, `$.ui.toast`). Foi adaptado de `hooks/usage.ts` e `hooks/register.tsx` do [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). O atom `usage` está declarado em `types/index.d.ts`, como no primeiro guia.

A parte pura, `hooks/usage.ts`:

```ts
import type { SessionContextUsage, SessionRateLimit } from 'claude-code'

export type Meter = { percent: number; resetsAt?: string }
export type Usage = { context: number | null; fiveHour: Meter | null; week: Meter | null }
export type Sample = { at: number; percent: number }

export function usageOf(m: {
  context: SessionContextUsage
  rateLimits: readonly SessionRateLimit[]
}): Usage {
  const meter = (kind: string): Meter | null => {
    const r = m.rateLimits.find((x) => x.kind === kind)
    return r ? { percent: r.percentUsed, resetsAt: r.resetsAt } : null
  }
  return {
    context: m.context.percent ?? null,
    fiveHour: meter('five_hour'),
    week: meter('seven_day'),
  }
}

export const levelColor = (p: number) => (p >= 85 ? '#F0435A' : p >= 60 ? '#F5B400' : '#22B573')

export function textBar(percent: number, cells = 10): string {
  const full = Math.max(0, Math.min(cells, Math.round((percent / 100) * cells)))
  return '█'.repeat(full) + '░'.repeat(cells - full)
}

const WINDOW_MS = 15 * 60_000

export function minutesToFull(samples: readonly Sample[], now: number): number | null {
  const recent = samples.filter((s) => now - s.at <= WINDOW_MS)
  const first = recent[0]
  const last = recent.at(-1)
  if (!first || !last) return null
  const minutes = (last.at - first.at) / 60_000
  if (minutes < 1 || last.percent <= first.percent) return null
  const perMinute = (last.percent - first.percent) / minutes
  return Math.max(0, Math.round((100 - last.percent) / perMinute))
}
```

Os hooks, em `hooks/register.tsx`:

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import { levelColor, minutesToFull, textBar, usageOf } from './usage'
import type { Sample, Usage } from './usage'

const usage = atom({ plugin: 'my-pet', key: 'usage' } as const, {
  context: null,
  fiveHour: null,
  week: null,
})
let samples: Sample[] = []
let isNudged = false

async function track($: EngineInterface, next: Usage): Promise<void> {
  await update($, usage, () => next)
  const percent = next.context
  if (percent === null) return
  const now = await $.clock.now()
  const last = samples.at(-1)
  if (last && percent < last.percent) samples = []
  if (percent < 50) isNudged = false
  samples = [...samples, { at: now, percent }].slice(-30)
  const toFull = minutesToFull(samples, now)
  const isNear = toFull !== null && toFull <= 20
  if (isNudged || percent < 70 || !(isNear || percent >= 85)) return
  isNudged = true
  $.ui.toast(`Context at ${Math.round(percent)} %: a good moment for /compact.`)
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    const spent = await $.session.usage().catch(() => undefined)
    if (spent) await track($, usageOf(spent))
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await track($, usageOf(e))
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const u = await read($, usage)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column" minWidth={0}>
        {u.context !== null ? (
          <Text
            color={levelColor(u.context)}
          >{`Context ${textBar(u.context)} ${Math.round(u.context)} %`}</Text>
        ) : null}
        {u.fiveHour ? (
          <Text>{`5 hours ${textBar(u.fiveHour.percent)} ${Math.round(u.fiveHour.percent)} %`}</Text>
        ) : null}
        {u.week ? (
          <Text>{`Week ${textBar(u.week.percent)} ${Math.round(u.week.percent)} %`}</Text>
        ) : null}
      </Box>
    )
  })
}
```

A Narsil mostra a sugestão como uma das suas dicas; uma versão mínima pode usar `$.ui.toast`, como aqui.

## Erros comuns e como testar

- **Consultar os números periodicamente.** Um temporizador que chama `$.session.usage()` a cada poucos segundos faz um trabalho que `session.measure` já faz por você, no momento em que um número muda.
- **Supor que os limites existem.** Fora de uma assinatura, `rateLimits` vem vazio. Nesse caso não desenhe nada, em vez de uma barra em 0 %.
- **Um contexto ainda sem porcentagem.** Antes da primeira resposta, `percent` e `tokens` podem estar ausentes. A Narsil trata um `percent` ausente como "sem leitura".
- **Manter o ritmo antigo depois de `/compact`.** Se as amostras não forem apagadas quando o contexto encolhe, a estimativa mistura duas conversas e diz bobagens.
- **Uma sugestão a cada turno.** Sem uma flag que só se reinicia quando o contexto cai, o mesmo conselho de `/compact` volta em 71, 72 e 73 %.
- **Pedir o detalhamento `full` a cada medição.** `full` envia requisições de contagem de tokens; `summary` é local e gratuito.

Para testar, `claude plugin test .` executa `tests/narsil.test.tsx`. "the context bar tells when it will fill, and Narsil suggests /compact once when it is near" (a barra de contexto diz quando vai encher, e a Narsil sugere /compact uma vez quando está perto) mede 50 % e, cinco minutos depois, 60 %, e então confere o texto "120k / 200k · lleno en ~20 min"; depois mede 72 % no minuto 10 e 74 % no minuto 11 e confere que saiu exatamente uma sugestão, "El contexto va al 72 % y se llenará en ~13 min: es buen momento para /compact.". "a context that is not growing shows no estimate and no nudge" (um contexto que não cresce não mostra estimativa nem sugestão) cobre um contexto que encolhe. "the band shows the 5-hour window and the week once, and the context in its conversation" (a faixa mostra a janela de 5 horas e a semana uma vez, e o contexto na sua conversa), "off a plan, no limits show, and the context is read when the session starts" (fora de um plano, nenhum limite aparece, e o contexto é lido quando a sessão começa) e "a press on the open conversation percent shows what fills the context, and another goes back to the bars" (pressionar a porcentagem da conversa aberta mostra o que preenche o contexto, e pressionar de novo volta às barras) cobrem o resto. As funções em `hooks/usage.ts` recebem valores simples, então também podem ser testadas diretamente com uma lista de amostras e um `now` fixo.

## Para ir além

- `contextDetailOf`, `contextDetailRows` e `contextDetailSvg` em `hooks/usage.ts` transformam o detalhamento de `/context` em barras.
- `usageSummary` e `contextDetailSummary` dão uma frase para os lugares que não conseguem desenhar barras.
- `toggleContextDetail` em `hooks/register.tsx` lê de novo o detalhamento desta conversa quando você o abre, e mostra um toast se não conseguir.
- `shownState` envia ao hub o `context` (a sua porcentagem e nota) e o `contextDetail` de cada conversa, que é como a faixa de outra conversa e a janela flutuante desenham uma barra que não mediram.
