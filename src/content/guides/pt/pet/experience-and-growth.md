---
title: Experiência e crescimento
description: 'Como a Narsil ganha experiência com turnos terminados, testes que passam e subagentes que terminam, sobe de nível, cresce por cinco estágios e comemora, com a XP guardada entre sessões.'
route: pet
order: 13
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/xp.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/sprite.ts
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: hooks/phone.ts
  - repo: pet
    path: types/index.d.ts
  - repo: pet
    path: odd/tasks/animated-poses.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## O que faz

A Narsil cresce com o trabalho que acompanha. Cada turno terminado, cada execução de testes que passa e cada subagente que termina bem lhe dão pontos de experiência (XP). Com XP suficiente ela chega a um novo nível, e em alguns níveis cresce para um novo estágio da sua vida: de filhote a serpente marinha adulta.

Do seu lado, três coisas mostram isso:

- **Um rótulo de nível** ao lado do nome dela, na faixa e na janela flutuante: "⭐ Nivel 3 · 120/300 XP" ("Nível 3, 120 dos 300 XP de que este nível precisa").
- **Uma comemoração** quando ela sobe de nível: um brilho dourado, anéis, estrelas e uma faixa "NIVEL 3" sobre o desenho dela, e o comentário da faixa diz "¡He subido al nivel 3! ⭐" ("Subi para o nível 3!"). Um novo estágio é comemorado de outro jeito: um clarão, raios de luz, uma faixa "¡ETAPA 2!" ("ESTÁGIO 2!") e "¡He crecido!" ("Eu cresci!").
- **A aparência dela.** Cada um dos cinco estágios tem os seus próprios desenhos, e ela se move de forma diferente: o filhote salta leve e rápido, a serpente adulta se move devagar e pesada.

`/narsil nivel` ("nível") diz em que ponto ela está, o estágio e como ela ganha XP.

A XP é um único número para a máquina inteira. Ela sobrevive ao fechamento do Claude Code, e cada conversa aberta soma ao mesmo total. É um pequeno ciclo de recompensa sem efeito no trabalho do Claude: só muda a aparência da Narsil.

## Como funciona por dentro

### As regras: `hooks/xp.ts`

Toda a aritmética fica em `hooks/xp.ts`, como funções puras sobre números simples. O arquivo diz isso no seu primeiro comentário: "the hooks module owns the store and the events" (o módulo de hooks é o dono do store e dos eventos). Essa separação torna as regras fáceis de testar sem um motor.

Os ganhos são uma tabela, `XP_GAIN`:

| Motivo  | XP  | Quando                                               |
| ------- | --- | ---------------------------------------------------- |
| `turn`  | 10  | um turno da conversa principal responde              |
| `tests` | 5   | um comando de testes é executado sem erro            |
| `agent` | 3   | o próprio turno de um subagente termina com `answer` |

Os níveis ficam linearmente mais difíceis. `levelOf` começa no nível 1 e subtrai `level * 100` enquanto puder: o nível 1 precisa de 100 XP para chegar ao nível 2, o nível 2 precisa de mais 200, o nível 3 precisa de mais 300, e assim por diante. Ele retorna o nível, a XP reunida dentro deste nível (`into`) e a XP de que este nível precisa (`needed`), que é exatamente o que o rótulo imprime.

Os estágios são uma segunda tabela, `STAGE_FROM = [1, 5, 10, 20, 35]`: o primeiro nível de cada estágio. `stageOf(level)` conta quantos desses o nível já alcançou. Assim:

| Estágio     | Níveis       | XP total para chegar lá |
| ----------- | ------------ | ----------------------- |
| 1 (filhote) | 1 a 4        | 0                       |
| 2           | 5 a 9        | 1.000                   |
| 3           | 10 a 19      | 4.500                   |
| 4           | 20 a 34      | 19.000                  |
| 5           | 35 em diante | 59.500                  |

Os totais decorrem da regra: chegar ao nível L exige 100 × (1 + 2 + … + (L − 1)) XP. A 10 XP por turno, o filhote passa ao estágio 2 depois de cerca de cem turnos terminados, e o estágio 5 está muito longe. O README enuncia as mesmas regras em espanhol.

`xpOf` lê um valor guardado "from any version, or none" (de qualquer versão, ou de nenhuma): qualquer coisa que não seja um número finito positivo conta como 0, e uma fração é arredondada para baixo. Um store quebrado ou ausente, portanto, faz a Narsil recomeçar em vez de quebrar a faixa.

### De onde vem a XP

`gainXp($, reason)` em `hooks/register.tsx` é chamada de quatro lugares, em três eventos:

- **`turn.complete`**, conversa principal, quando o turno termina com `answer`. Dois ramos a chamam: o término normal ("He terminado", "Terminei") e um término que faz uma pergunta na caixa de próximo passo do aplicativo de desktop. Um turno que termina enquanto um trabalho em segundo plano ainda roda ainda não ganha XP: o turno que acorda a sessão quando esse trabalho informa o resultado é o que termina, e o que a ganha. Um turno que você interrompe (`aborted`) ou que falha não ganha nada.
- **`tool.call`**, quando o comando corresponde a `TEST_COMMAND` (em `hooks/words.ts`: `npm test`, `pnpm test`, `vitest`, `pytest`, `cargo test`, `claude plugin test` e outros) e o resultado não tem `isError`. Essa verificação não olha `e.agentId`, então os testes que passam de um subagente também contam.
- **`endAgent`**, chamada a partir de `turn.complete` quando `e.agentId` está definido e o motivo do subagente é `answer`.

O teste `passing tests and finished subagents earn experience; failures and stopped turns do not` (testes que passam e subagentes terminados ganham experiência; falhas e turnos interrompidos não) em `tests/narsil.test.tsx` fixa tudo isso.

### Por que ela fica em `$.store`, e por que é lida de novo

A Narsil guarda duas cópias da XP:

- **`$.store`**, sob a chave `xp`. Os tipos descrevem o store como "This plugin's own key-value store, kept between sessions and hot reloads" (o armazenamento chave-valor próprio deste plugin, mantido entre sessões e recargas a quente), um arquivo JSON próprio do plugin dentro do diretório de configuração do Claude Code. É isso que faz a XP sobreviver a uma sessão.
- **O atom `xp`** (`$.state`), que a faixa e a janela flutuante leem enquanto desenham, para que uma mudança as redesenhe.

Em `session.start`, a Narsil copia o valor guardado para o atom. Depois, cada ganho faz isto:

```tsx
const before = xpOf(await $.store.get(XP_KEY).catch(() => read($, xp)))
const after = before + XP_GAIN[reason]
await $.store.set(XP_KEY, after).catch(() => undefined)
await update($, xp, () => after)
```

O comentário acima dele dá o motivo de ler o store primeiro em vez de confiar no atom: "another open conversation may have added to it since" (outra conversa aberta pode ter somado a ele desde então). O store é compartilhado por todas as conversas do plugin, enquanto cada conversa tem o seu próprio atom. Somar ao atom sobrescreveria os ganhos que outra janela fez desde que esta começou. O teste `another conversation’s experience is added to, never overwritten` (a experiência de outra conversa é somada, nunca sobrescrita) põe o store em 50 pelas costas da conversa e espera 60 depois de um turno.

Ler de novo encolhe a janela em que ganhos se perdem; não é um lock. Duas conversas que ganham XP no mesmo instante ainda podem ler o mesmo `before`.

Se o store falhar, o ganho ainda chega ao atom (`.catch(() => read($, xp))` e `.catch(() => undefined)`), então a faixa continua contando nesta sessão.

### Comemorações: o atom `milestone`

Quando `after` cruza um nível, `gainXp` compara os estágios antes e depois e escreve o atom `milestone` (marco): `{ kind: 'level' | 'grew', level, stage, at }`. O seu tipo, `(Milestone & { at: number }) | null`, está declarado em `types/index.d.ts`. Ela também:

- escreve uma linha de log com `$.ui.log`: "🌊 Narsil ha crecido: nivel 5, etapa 2 de 5." ("A Narsil cresceu: nível 5, estágio 2 de 5.") ou "⭐ Narsil ha subido al nivel 3." ("A Narsil subiu para o nível 3.");
- substitui o comentário dela na faixa por meio de `setMood`, mantendo o humor e o detalhe atuais.

O desenho lê o marco. `sprite(mood, stage, milestone)` em `hooks/sprite.ts` acrescenta:

- para um nível, `behind` desenha um brilho radial dourado, e `celebration` desenha dois anéis que se expandem, sete estrelas e uma faixa `NIVEL <n>`;
- para um estágio, um clarão branco, cinco faíscas, doze raios de luz e uma faixa `¡ETAPA <n>!`, com o desenho envolto numa animação `evolve` que a escala da metade do tamanho até o seu novo eu.

Enquanto um marco aparece, o pequeno selo de estado perto da cabeça dela fica de fora, para que os dois não disputem o mesmo espaço.

O batimento (`beat`, a cada 2 segundos) limpa o marco depois que `MILESTONE_MS` passa: 6 segundos para um nível, 9 para um estágio. Um temporizador por comemoração teria sido mais simples de escrever, mas o batimento já existe, e um temporizador de `$.clock` se perde numa recarga do mod.

Na faixa, a comemoração só é desenhada quando a conversa que a Narsil mostra é esta (`isOwnTop`): quando outra conversa é mais importante, o desenho pertence a ela.

### O que o estágio muda

`stageOf(levelOf(xp).level)` é calculado em todo lugar onde um desenho é feito:

- **A arte.** `art` em `hooks/sprite.ts` escolhe a pose desenhada para aquele estágio e tema, recorrendo à pose base do estágio, e depois a um estágio anterior, quando uma falta. Os loops animados de todos os estágios vêm da tarefa registrada em `odd/tasks/animated-poses.md`; o segundo guia desta trilha trata do desenho.
- **O movimento.** `STAGE_MOTION` escala o quanto e a que velocidade ela se move: amplitude 1,15 e tempo 0,9 para o filhote, até 0,6 e 1,4 para o estágio 5.
- **Tudo o que fica fora da faixa.** A janela de dica recebe `NARSIL_STAGE`; os alertas no celular usam `phoneIcon(kind, stage)`, um PNG dela naquele estágio vindo do repositório; o tópico `-estado` envia o rótulo `xp` e a URL `art` (guia 15).

## Construa com o Claude

Peça ao Claude um sistema de experiência: pontos por turnos terminados, testes que passam e subagentes terminados, e depois níveis, estágios e uma comemoração curta. A única ideia que o Claude precisa acertar: o total fica em `$.store`, que todas as conversas compartilham, então cada ganho lê o store de novo antes de somar.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No meu mod do Claude Code `my-pet`, dê experiência ao pet. Ponha as regras num módulo puro `hooks/xp.ts`: 10 XP por turno terminado da conversa principal (`turn.complete` com `reason === 'answer'` e sem `agentId`), 5 quando um comando de testes (`npm test`, `pnpm test`, `vitest`, `pytest`) retornar sem `isError` em `tool.call`, 3 quando o `turn.complete` de um subagente terminar com `answer`. O nível 1 precisa de 100 XP, cada nível seguinte de 100 a mais que o anterior; os estágios começam nos níveis 1, 5, 10, 20 e 35. Guarde o total em `$.store` sob `xp` para que sobreviva às sessões, e antes de cada ganho leia o store de novo, já que outras conversas somam a ele. Espelhe-o num atom para desenhar. Num novo nível, escreva um atom `milestone` com a hora, mostre "Level N" na faixa `AbovePrompt` por 6 segundos (9 para um novo estágio) e registre-o com `$.ui.log`. Teste com `claude-code/testing`: um turno a 95 XP mostra o nível 2, e um store alterado pelas costas da conversa é somado, não sobrescrito.

### O que conferir na resposta do Claude

1. As regras ficam num módulo puro (`hooks/xp.ts`) com os números que você pediu: 10, 5 e 3 XP, cada nível com 100 XP a mais que o anterior, e estágios a partir dos níveis 1, 5, 10, 20 e 35.
2. Um ganho lê o store, soma, escreve o store e só então atualiza o atom. Ele nunca escreve o valor do atom de volta no store.
3. Só um turno que termina com `answer` ganha XP, e os testes só ganham sem `isError`; um turno interrompido não ganha nada.
4. Um valor guardado que não é um número positivo conta como 0 em vez de quebrar a faixa.
5. Um marco leva o seu horário, e a comemoração termina depois de 6 segundos para um nível e de 9 para um estágio.

Se uma verificação falhar, diga ao Claude o que você vê: "com duas conversas abertas, a XP que uma delas ganhou some depois que a outra termina um turno", ou "o aviso de nível nunca sai".

### Como a pessoa autora pediu

O pedido original de experiência e níveis não foi registrado. Os registros públicos de tarefas do projeto começam mais tarde.

Um pedido posterior toca nos estágios: em `odd/tasks/animated-poses.md`, L4 (2026-11-15), depois do primeiro loop animado, a pessoa autora respondeu:

> "si me agrada, vamos a cambiar todos"

Tradução para o português: sim, gostei, vamos mudar todos. O registro de tarefas o transforma em S6: todas as poses "at every stage 1-5, light and dark: 60 loops" (em todos os estágios de 1 a 5, claras e escuras: 60 loops).

#### Reconstrução a partir do histórico de commits

A partir de `git log -- hooks/xp.ts` e dos commits relacionados:

- `8913cdd` (2026-10-30) "feat: let Narsil earn experience and levels kept across sessions" (deixar a Narsil ganhar experiência e níveis mantidos entre sessões). XP, níveis e o store chegam juntos.
- `9bfa039` (2026-10-30) "feat: let Narsil grow through five stages as she levels up" (deixar a Narsil crescer por cinco estágios à medida que sobe de nível). No mesmo dia, os estágios.
- `7a964d1` (2026-10-30) "feat: draw Narsil as a hatchling at stage 1 and split the art per stage" (desenhar a Narsil como filhote no estágio 1 e dividir a arte por estágio), seguido em 2026-10-31 por um commit por estágio e tema (`6b96e08`, `e029cf0`, `ff02847`, `6a1ceb3`, `4055242`, `b7361a0`, `5ef599a`, `eed13b0`).
- `2cf7133` (2026-10-31) "feat: celebrate a new level and a new stage with their own animations" (comemorar um novo nível e um novo estágio com animações próprias). O atom `milestone` e as duas comemorações.
- `fcd68c7` (2026-10-31) "feat: move Narsil by her stage, with a shadow, splashes, a softer tremble and cheap glows" (mover a Narsil conforme o seu estágio, com uma sombra, respingos, um tremor mais suave e brilhos baratos). `STAGE_MOTION`.
- De 2026-11-15 a 2026-11-16, os loops animados de todos os estágios (`2f08c55` a `673fc9f`), a tarefa citada acima.

A ordem é reveladora: primeiro os números, depois os estágios que tornam os números visíveis, depois um desenho por estágio, depois as comemorações, depois o movimento. Cada passo torna a recompensa mais fácil de notar.

## Código de referência

Esta é uma resposta correta, escrita para este guia. Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

Escrito para este guia e conferido com os tipos da 2.1.325 (`$.store.get`, `$.store.set`, `$.clock.now`, `$.ui.log`, `session.start`, `tool.call`, `turn.complete`, `ui.render`). Foi adaptado de `hooks/xp.ts` e `hooks/register.tsx` do [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). Os atoms estão declarados em `types/index.d.ts`, como no primeiro guia: `xp: number` e `milestone: { kind: 'level' | 'grew'; level: number; at: number } | null`.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const GAIN = { turn: 10, tests: 5, agent: 3 } as const
const STAGE_FROM = [1, 5, 10, 20, 35]
const SHOWN_MS = { level: 6000, grew: 9000 } as const
const TESTS = /\b(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?test|vitest|jest|pytest)\b/

const xp = atom({ plugin: 'my-pet', key: 'xp' } as const, 0)
const milestone = atom({ plugin: 'my-pet', key: 'milestone' } as const, null)

function levelOf(total: number) {
  let level = 1
  let left = Math.max(0, Math.floor(total))
  while (left >= level * 100) {
    left -= level * 100
    level += 1
  }
  return { level, into: left, needed: level * 100 }
}
const stageOf = (level: number) => STAGE_FROM.filter((from) => level >= from).length || 1
const xpOf = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0

async function gain($: EngineInterface, reason: keyof typeof GAIN): Promise<void> {
  // Read the store again: another conversation may have added to it.
  const before = xpOf(await $.store.get('xp').catch(() => read($, xp)))
  const after = before + GAIN[reason]
  await $.store.set('xp', after).catch(() => undefined)
  await update($, xp, () => after)
  const was = levelOf(before).level
  const level = levelOf(after).level
  if (level === was) return
  const kind = stageOf(level) > stageOf(was) ? ('grew' as const) : ('level' as const)
  const at = await $.clock.now()
  await update($, milestone, () => ({ kind, level, at }))
  $.ui.log(kind === 'grew' ? `My pet has grown: level ${level}` : `My pet reached level ${level}`)
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    const stored = xpOf(await $.store.get('xp').catch(() => 0))
    await update($, xp, () => stored)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const command = (e as { command?: unknown }).command
    const result = await next(e)
    if (typeof command === 'string' && TESTS.test(command) && !result.isError)
      await gain($, 'tests')
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.reason === 'answer') await gain($, e.agentId === undefined ? 'turn' : 'agent')
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { level, into, needed } = levelOf(await read($, xp))
    const shown = await read($, milestone)
    const isFresh = shown !== null && (await $.clock.now()) - shown.at < SHOWN_MS[shown.kind]
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" gap={1} minWidth={0}>
        <Text dimColor>{`⭐ Level ${level} · ${into}/${needed} XP · stage ${stageOf(level)}`}</Text>
        {isFresh ? (
          <Text bold color="#F5B400">
            {shown.kind === 'grew' ? 'I have grown!' : 'Level up!'}
          </Text>
        ) : null}
      </Box>
    )
  })
}
```

Duas simplificações em relação à Narsil. A faixa confere a idade do marco quando desenha, então a comemoração sai no redesenho seguinte depois do seu tempo; a Narsil limpa o atom no seu batimento, que redesenha na hora certa. E esta versão conta todo turno de subagente que responde, enquanto a Narsil conta um subagente só uma vez, por meio do seu próprio registro de subagentes em execução.

## Erros comuns e como testar

- **Guardar a XP só num atom.** `$.state` sobrevive a uma recarga do mod, não a uma nova sessão. Tudo o que deve durar vai para `$.store`.
- **Gravar o valor do atom de volta no store.** Com duas conversas abertas, cada atom fica atrás dos ganhos da outra. Leia o store, some, grave.
- **Confiar num valor guardado.** Um store editado à mão, ou escrito por uma versão mais antiga, pode conter qualquer coisa. Valide-o (`xpOf`) e recorra a zero.
- **Recompensar a falha.** Conceda o turno só com `answer`, e os testes só sem `isError`; um turno interrompido não ganha nada.
- **Comemorar para sempre.** Um marco precisa de uma hora de fim e de algo que redesenhe quando ela passar.
- **Níveis que nunca chegam.** Confira a sua curva com números antes de publicá-la. Com a da Narsil, o estágio 5 precisa de 59.500 XP, o que são vários milhares de turnos.

Para testar, os testes em `tests/narsil.test.tsx` iniciam o mod com um store definido de antemão e o leem de volta. Vale a pena ler: "Narsil keeps her experience across sessions, and celebrates a new level" (a Narsil mantém a sua experiência entre sessões, e comemora um novo nível; 95 XP mais um turno mostram "⭐ Nivel 2 · 5/200 XP" e "¡He subido al nivel 2! ⭐"), "Narsil grows at levels 5, 10, 20 and 35, and says so" (a Narsil cresce nos níveis 5, 10, 20 e 35, e diz isso), "a new level plays its own celebration for a while, in the band and the window" (um novo nível toca a sua própria comemoração por um tempo, na faixa e na janela) e "levels need 100, 200, 300 XP more each, and odd stored values count as none" (os níveis precisam de 100, 200, 300 XP a mais cada um, e valores guardados estranhos contam como nenhum). "the celebrations stay within the Svg size limit at every stage" (as comemorações ficam dentro do limite de tamanho do Svg em todos os estágios) protege algo fácil de esquecer: uma comemoração se soma a um desenho que já tem o seu limite de tamanho.

## Para ir além

- `xpLabel` em `hooks/xp.ts` é o único lugar onde o rótulo é escrito, para que a faixa, a janela flutuante e o estado no celular digam a mesma coisa.
- `banner`, `behind` e `celebration` em `hooks/sprite.ts` desenham as comemorações como SVG sobre o desenho.
- `artUrl` em `hooks/phone.ts` monta o endereço do desenho dela em cada estágio para o celular, tal como o repositório o publica em `assets/`.
- O próximo guia, o modo discreto, mostra como a Narsil fica calada sem perder o que importa; uma comemoração é uma das coisas que continuam aparecendo, já que ela só é desenhada.
