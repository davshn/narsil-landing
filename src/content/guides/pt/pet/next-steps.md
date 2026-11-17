---
title: Próximos passos
description: 'Como a Narsil propõe até três próximos passos 15 minutos depois de um turno, a partir dos commits, das mudanças sem commit e das tarefas pendentes, e põe no prompt o que você escolher.'
route: pet
order: 12
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/advice.ts
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## O que faz

Você termina um turno, lê a resposta e se afasta. Quando volta, a pergunta costuma ser a mesma: e agora?

Quinze minutos depois de um turno terminar, se você não escreveu nada desde então, a Narsil propõe até três próximos passos. Na faixa, eles aparecem abaixo de uma linha própria:

```text
➜ ¿Y ahora? Elige uno y te lo dejo en el prompt:
[ Añade reintentos con backoff a net.ts ]  [ Documenta el modo oscuro en el README ]
```

"E agora? Escolha um e eu o deixo no prompt." (O terminal mostra apenas "➜ ¿Y ahora?".) Cada passo é um botão, e cada um é um pedido escrito no imperativo, pronto para ser enviado como está. O exemplo do README é "Añade reintentos con backoff a net.ts" ("adicione novas tentativas com backoff a net.ts").

Apertar um passo não o envia. Ele põe o texto na caixa do prompt como rascunho, para que você o leia, mude e envie você mesmo. Os outros passos somem.

O README diz que os passos respondem a duas perguntas: "¿cómo seguimos con el proyecto?" e "¿qué nos falta por hacer?" ("como seguimos com o projeto?" e "o que nos falta fazer?"). Para respondê-las, a Narsil lê os últimos commits, os arquivos sem commit e, se o projeto os tiver, as tarefas pendentes em `odd/tasks/*.md`.

A janela flutuante também mostra os passos. `/narsil pasos off` ("passos desligados") os desliga, e o modo discreto os deixa de fora.

## Como funciona por dentro

### Quinze minutos a partir do fim do turno

Os próximos passos não têm um temporizador próprio. Eles vão de carona no relógio do cache do guia 8: quando um turno da conversa principal termina, `startCache` grava o atom `cache` com `at`, o momento em que o turno terminou. A cada batimento de dois segundos, `tickCache` faz a contagem regressiva do cache e também confere:

```tsx
if (now - c.at >= STEPS_AFTER_MS) void offerSteps($, c.at).catch(() => undefined)
```

`STEPS_AFTER_MS` é 15 minutos. "Se você não escreveu nada" não precisa de estado extra: um novo prompt inicia um turno, `turn.start` apaga tanto o relógio do cache quanto os passos em oferta, e não sobra nenhum `at` a partir do qual contar.

Os passos contam a partir do fim do turno, `at`, não do início da sua última requisição, como faz o cache. O guia do relógio do cache explica a diferença: o cache diz respeito à API, e os passos dizem respeito à sua ausência. Um teste fixa isso: "next steps still wait from the end of the turn, however long its last request took" (os próximos passos continuam esperando a partir do fim do turno, por mais que a sua última requisição tenha demorado).

No início, a espera era de 3 minutos. O commit `2bcc97c` a levou para 15 num commit intitulado "calm loop, steps and permission alerts" (acalmar os alertas de laço, de passos e de permissão), o mesmo que levou o lembrete de permissão do guia 10 de 2 para 5 minutos.

### Uma vez por turno terminado

`offerSteps` pergunta no máximo uma vez por turno. Ele retorna antes quando:

- já perguntou para este `at` (`stepsAskedFor`), ou os passos deste `at` estão sendo exibidos;
- o turno parou com trabalho em segundo plano ainda rodando (guia 1): o trabalho não acabou, então não é o momento de perguntar o que vem depois;
- os passos estão desligados, ou o modo discreto está ligado.

Ele marca o turno como perguntado antes de conferir as preferências. Ligar os passos depois não traz passos para um turno que já passou; eles vêm com o próximo.

### O que o modelo lê

Os passos reaproveitam o contexto das dicas do guia 11: o mesmo `seen`, o mesmo `describe`, o mesmo `sanitize`, com o motivo "Propón cómo seguir con el proyecto: qué falta por hacer, qué mejorar o qué funcionalidad viene después." ("proponha como seguir com o projeto: o que falta fazer, o que melhorar ou que funcionalidade vem depois").

Duas partes são lidas logo antes de perguntar. `readDiff` dá o que o turno mudou, como para a dica de fim de turno. `readProject` dá onde o projeto está, três partes com `git` e o sistema de arquivos:

- `git log --oneline --no-decorate -10`: os últimos dez commits.
- `git status --short`: os arquivos sem commit.
- Até cinco arquivos `.md` em `odd/tasks`, listados com `$.fs.list` e lidos com `$.fs.read`. Um caminho relativo fica sob o diretório de trabalho da sessão, como dizem os tipos da 2.1.325.

De cada arquivo de tarefas, `pendingTasks` mantém apenas o que está inacabado: linhas `- [ ]` sem marcar, e linhas sob um título `## Tasks` que digam pending, pendiente, todo ou in progress. Os itens marcados e tudo o que está sob um título `Log` ficam de fora. O formato é o que os próprios arquivos de tarefas da pessoa autora usam; um projeto sem esses arquivos ainda recebe os seus commits e o seu status.

A parte do projeto é limitada a 2.000 caracteres e o diff a 3.000, dentro do mesmo contexto de 6.000 caracteres. Só os passos leem o projeto; uma dica nunca o faz.

### O prompt exato

`STEPS_SYSTEM` em `hooks/advice.ts`, citado como está no [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). `MAX_STEPS` é 3, `MAX_STEP` é 90, e `NO_ROUTINE` é a mesma proibição de conferências rotineiras que as dicas usam.

```ts
export const STEPS_SYSTEM = [
  'Eres Narsil, una vieja serpiente marina sabia que acompaña a quien programa.',
  'El turno terminó hace unos minutos: propón los próximos pasos que la persona podría pedir ahora.',
  'Responden a "¿cómo seguimos con el proyecto?" y "¿qué nos falta por hacer?": la siguiente tarea pendiente,',
  'una funcionalidad que completa lo que se hizo, o una mejora de diseño que vale la pena.',
  'Reglas:',
  `- Entre uno y ${MAX_STEPS} pasos, uno por línea, en español, como mucho ${MAX_STEP} caracteres cada uno.`,
  '- Cada paso es una petición en imperativo que se le puede enviar tal cual (por ejemplo: "Añade reintentos con backoff a net.ts").',
  `- ${NO_ROUTINE}`,
  '- Concretos y sacados del contexto: las tareas pendientes, los commits recientes, los archivos sin commit; nada inventado.',
  '- Usa lenguaje neutro, sin suponer el género de la persona; no nombres a ningún asistente ni a "Claude".',
  '- Si no hay nada útil que proponer, responde exactamente SKIP.',
  'Responde solo con los pasos (o SKIP), sin comillas ni introducción.',
].join('\n')
```

Tradução para o português: você é a Narsil, uma velha serpente marinha sábia que acompanha quem programa. O turno terminou há alguns minutos: proponha os próximos passos que a pessoa poderia pedir agora. Eles respondem a "como seguimos com o projeto?" e "o que nos falta fazer?": a próxima tarefa pendente, uma funcionalidade que completa o que foi feito, ou uma melhoria de design que vale a pena. Regras: entre um e 3 passos, um por linha, em espanhol, no máximo 90 caracteres cada um. Cada passo é um pedido no imperativo que pode ser enviado como está (por exemplo: "adicione novas tentativas com backoff a net.ts"). Nada de conferências rotineiras (executar os testes, revisar o push ou o commit, ver se o erro já não aparece). Concretos e tirados do contexto: as tarefas pendentes, os commits recentes, os arquivos sem commit; nada inventado. Use linguagem neutra, sem supor o gênero da pessoa; não nomeie nenhum assistente nem "Claude". Se não houver nada útil a propor, responda exatamente SKIP. Responda só com os passos (ou SKIP), sem aspas nem introdução.

A mensagem da pessoa usuária é `stepsPrompt(context)`: "Contexto del trabajo:" ("contexto do trabalho"), o contexto, e "Próximos pasos:" ("próximos passos:") para fechar. A chamada é a mesma das dicas: `$.model.complete` com `model: 'haiku'`, `effort: 'medium'`, `maxTokens: 2000` e `timeoutMs: 30_000`.

Pedir imperativos que "possam ser enviados como estão" é a decisão de design que faz o clique funcionar: um passo já é um prompt, então preencher a caixa com ele não exige reescrever nada.

### Ler a resposta

`parseSteps` transforma a resposta numa lista: nada para `SKIP`; caso contrário, um passo por linha, sem marcadores, números ou aspas, com qualquer "Claude" transformado em "Narsil", no máximo três, cada um cortado em 90 caracteres com "…".

Depois, uma última conferência: se o atom `cache` já não tiver o mesmo `at`, um novo turno começou enquanto o modelo respondia, e os passos estão desatualizados. Eles são descartados.

Caso contrário, eles são gravados no atom `steps` com o seu `at`, registrados com `$.ui.log` ("➜ Narsil propone: …", "a Narsil propõe"), e enviados à janela flutuante. Qualquer falha (git, os arquivos, o modelo) termina num `catch`: desta vez, sem passos.

### Preencher o prompt ao clicar

Cada passo é desenhado como um `Button` cujo `onPress` chama `pickStep`:

```tsx
async function pickStep($: EngineInterface, step: string): Promise<void> {
  await $.prompt.fill({ text: step })
  await update($, steps, () => null)
  await pushOverlay($)
}
```

Os tipos da 2.1.325 descrevem `$.prompt.fill` como colocar `input.text` "in the prompt box as the draft" (na caixa do prompt como rascunho), segundo `mode`: `replace` por padrão, `append` depois do rascunho, `insert` no cursor. Duas consequências decorrem do código:

- Sem `mode`, um passo substitui qualquer rascunho que você tivesse na caixa.
- Os tipos dizem que o resultado é `isFilled: false` "under a dialog or headless" (sob uma caixa de diálogo ou sem interface). A Narsil não lê o resultado: ela apaga os passos de qualquer forma. O README descreve apenas o caso normal.

Por que preencher em vez de enviar? Um passo vem de um modelo pequeno que lê um resumo. Enviá-lo iniciaria um turno que você não escolheu, na sua conta. Preencher a caixa mantém você como quem decide, e permite que você edite o passo antes.

### Os passos ficam sozinhos na faixa

Quando os passos chegam, `offerSteps` também fecha todas as conversas abertas na lista da faixa (guia 3), para que os passos sejam vistos sozinhos. O comentário no render da faixa explica a regra: "Next steps on offer close every conversation until you open one: then they hide, and come back once you close them all." (os próximos passos em oferta fecham todas as conversas até que você abra uma: então eles se escondem, e voltam quando você fecha todas). Isso veio em `250d2c6`, "let next steps stand alone" (deixar os próximos passos sozinhos).

## Como foi pedido à IA

O pedido original dos próximos passos não foi registrado. Eles chegaram em 2026-10-30, no mesmo commit que o relógio do cache, antes dos registros públicos de tarefas. `docs/plan-advice.md`, o plano das dicas, não os menciona.

### Registrado: onde ficam

O design combinado para a faixa com todas as conversas, `odd/tasks/fleet-view.md` no narsil-pet, L4, os posiciona: "the tip and next steps of this window below" (a dica e os próximos passos desta janela abaixo) da lista. L4 é o design tal como foi combinado, anotado no registro, não as próprias palavras da pessoa autora.

### Reconstrução a partir do histórico de commits

A partir de `git log -- hooks/register.tsx hooks/advice.ts`:

- `0993bd7` (2026-10-30) "feat: show a prompt-cache clock and offer next steps after a turn" (mostrar um relógio do cache do prompt e oferecer próximos passos depois de um turno). Os passos e o relógio chegam juntos, ambos iniciados pelo fim de um turno.
- `d1e6d40` (2026-11-04) "feat: make tips weigh design choices from the diff and next steps say what the project lacks" (fazer as dicas pesarem escolhas de design a partir do diff e os próximos passos dizerem o que falta ao projeto). A sua mensagem: "Next steps read recent commits, git status and pending odd/tasks items to answer how the project goes on." (os próximos passos leem os commits recentes, o git status e os itens pendentes de odd/tasks para responder como o projeto segue). `readProject`, `pendingTasks` e as duas perguntas do prompt vêm daqui.
- `2bcc97c` (2026-11-05) "feat: open the context breakdown from the usage bars and calm loop, steps and permission alerts" (abrir o detalhamento do contexto a partir das barras de uso e acalmar os alertas de laço, de passos e de permissão). A sua mensagem: "next steps wait 15 minutes" (os próximos passos esperam 15 minutos; antes esperavam 3).
- `250d2c6` (2026-11-07) "feat: open the context from its percent and let next steps stand alone" (abrir o contexto a partir da sua porcentagem e deixar os próximos passos sozinhos).
- `c3e4464` (2026-11-09) "fix: count the prompt cache from the start of its last request" (contar o cache do prompt a partir do início da sua última requisição). O cache passou para o início da requisição; os passos continuaram contando a partir do fim do turno.

As correções seguem uma direção: de passos que vinham cedo demais e diziam pouco demais, para passos que esperam uma pausa de verdade e leem o próprio plano do projeto.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No meu mod do Claude Code `my-pet`, proponha próximos passos depois de uma pausa tranquila. Em `turn.complete`, para a conversa principal, registre num atom quando o turno terminou; apague-o, e qualquer passo em oferta, em `turn.start`. Num batimento `$.clock.every(2000, ...)`, quando 15 minutos tiverem passado desde esse momento e apenas uma vez por turno, leia `git log --oneline -10` e `git status --short` com `$.process.run` e as linhas `- [ ]` sem marcar de `odd/tasks/*.md` com `$.fs.list` e `$.fs.read`. Chame `$.model.complete` com `model: 'haiku'` e um prompt de sistema que peça de um a três pedidos no imperativo, de no máximo 90 caracteres cada um, que possam ser enviados como estão, tirados desse contexto, ou exatamente `SKIP`. Descarte a resposta se um novo turno tiver começado nesse meio-tempo. Mostre cada passo como um `Button` na faixa `AbovePrompt`; ao apertar, chame `$.prompt.fill({ text })` e apague os passos apenas quando `isFilled` for true. Teste com um relógio simulado e `on('model.complete', ...)`: nada aos 14 minutos, passos aos 15, e o passo apertado chegando a um hook `prompt.fill`.

## O código mínimo

Escrito para este guia e conferido com os tipos da 2.1.325 (`$.model.complete`, `$.process.run`, `$.fs.list`, `$.fs.read`, `$.prompt.fill` e o seu `isFilled`, `$.clock.every`, `turn.start`, `turn.complete`, `ui.render`). Foi adaptado de `hooks/advice.ts` e `hooks/register.tsx` do [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). O atom `ended` (`number | null`) e o atom `steps` (`{ at: number; items: string[] } | null`) estão declarados em `types/index.d.ts`, como no primeiro guia.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const ended = atom({ plugin: 'my-pet', key: 'ended' } as const, null)
const steps = atom({ plugin: 'my-pet', key: 'steps' } as const, null)
const AFTER_MS = 15 * 60_000
const SYSTEM = [
  'Propose one to three next steps for this project, one per line, at most 90 characters each.',
  'Each one is an imperative request that can be sent as it is.',
  'Take them from the context (pending tasks, recent commits, uncommitted files); nothing invented.',
  'No routine checks. If there is nothing useful, answer exactly SKIP.',
].join('\n')
let askedFor: number | null = null

async function git($: EngineInterface, args: string[]): Promise<string> {
  try {
    const r = await $.process.run(['git', '--no-pager', ...args], { timeoutMs: 5000 })
    return r.exitCode === 0 ? r.stdout.trim() : ''
  } catch {
    return ''
  }
}

async function pending($: EngineInterface): Promise<string[]> {
  try {
    const files = (await $.fs.list('odd/tasks')).filter(
      (f) => f.kind === 'file' && f.name.endsWith('.md'),
    )
    const out: string[] = []
    for (const f of files.slice(0, 5)) {
      const text = await $.fs.read(`odd/tasks/${f.name}`)
      if (typeof text !== 'string') continue
      for (const line of text.split('\n')) {
        const m = /^\s*[-*]\s+\[ \]\s+(.*)$/.exec(line)
        if (m) out.push(m[1]!)
      }
    }
    return out
  } catch {
    return []
  }
}

async function offer($: EngineInterface, at: number): Promise<void> {
  if (askedFor === at) return
  askedFor = at
  const context = [
    `Recent commits:\n${await git($, ['log', '--oneline', '--no-decorate', '-10'])}`,
    `Uncommitted:\n${await git($, ['status', '--short'])}`,
    `Pending tasks:\n${(await pending($)).map((t) => `- ${t}`).join('\n')}`,
  ]
    .join('\n')
    .slice(0, 2000)
  const reply = await $.model.complete({
    model: 'haiku',
    system: SYSTEM,
    prompt: `Context:\n${context}\n\nNext steps:`,
    effort: 'medium',
    timeoutMs: 30_000,
  })
  if (!reply.isAnswered || /^\s*skip\b/i.test(reply.text)) return
  const items = reply.text
    .split('\n')
    .map((l) => l.trim().replace(/^([-*•]|\d+[.)])\s*/, ''))
    .filter(Boolean)
    .slice(0, 3)
    .map((s) => (s.length > 90 ? `${s.slice(0, 89)}…` : s))
  // A turn that started meanwhile makes them stale.
  if (items.length === 0 || (await read($, ended)) !== at) return
  await update($, steps, () => ({ at, items }))
}

async function beat($: EngineInterface): Promise<void> {
  const at = await read($, ended)
  if (at !== null && (await $.clock.now()) - at >= AFTER_MS)
    void offer($, at).catch(() => undefined)
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    $.clock.every(2000, () => void beat($))
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      await update($, ended, () => null)
      await update($, steps, () => null)
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined && e.reason === 'answer') {
      const now = await $.clock.now()
      await update($, ended, () => now)
    }
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const offered = (await read($, steps))?.items ?? []
    if (offered.length === 0) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    const pick = (step: string) => async () => {
      const { isFilled } = await $.prompt.fill({ text: step })
      if (isFilled) await update($, steps, () => null)
    }
    return (
      <Box flexDirection="row" gap={1} flexWrap="wrap" minWidth={0}>
        <Text dimColor>➜ And now?</Text>
        {offered.map((step, i) => (
          <Button key={`step-${i}`} label={step} onPress={pick(step)} />
        ))}
      </Box>
    )
  })
}
```

Tradução do comentário para o português: um turno que começou nesse meio-tempo os torna desatualizados.

Diferentemente da Narsil, esta versão mantém os passos quando a caixa não pôde ser preenchida, para que um clique sob uma caixa de diálogo possa ser repetido.

## Erros comuns e como testar

- **Passos para um turno que já não é o último.** O modelo leva segundos; um novo prompt pode chegar nesse meio-tempo. Compare de novo o momento do turno depois da resposta, como faz `offerSteps`.
- **Perguntar a cada batimento.** A conferência roda a cada dois segundos. Sem uma marca por turno (`stepsAskedFor`), cada batida depois do décimo quinto minuto perguntaria de novo ao modelo.
- **Enviar em vez de preencher.** Um passo proposto por um modelo pequeno deve chegar à caixa, não ao modelo. Deixe a pessoa apertar Enter.
- **Substituir um rascunho sem querer.** `$.prompt.fill` substitui o rascunho por padrão. Se você quiser mantê-lo, passe `mode: 'append'` ou `mode: 'insert'`.
- **Ler o arquivo de tarefas inteiro.** As tarefas concluídas e o registro só acrescentam ruído e tamanho. Mantenha as linhas inacabadas, como faz `pendingTasks`.
- **Contar a partir da última requisição.** Os passos dizem respeito a uma pausa no seu trabalho; conte a partir do fim do turno.

Para testar, `claude plugin test .` executa `tests/narsil.test.tsx` com um relógio simulado, o modelo respondido por `on('model.complete', ...)` e a caixa do prompt por `on('prompt.fill', ...)`. "a few minutes after a turn Narsil offers next steps, and one click puts it in the prompt" (alguns minutos depois de um turno a Narsil oferece próximos passos, e um clique o põe no prompt) não encontra passos aos 14 minutos, encontra três aos 15, confere que eles fecham as conversas e se escondem quando uma é aberta, aperta o segundo e espera exatamente o seu texto na caixa, e confere que se pergunta uma vez por turno. "a new turn before the minutes pass, or /narsil pasos off, offers no next steps" (um novo turno antes de passarem os minutos, ou /narsil pasos off, não oferece próximos passos) e "the next steps ask how the project goes on, from its log, its status and its pending tasks" (os próximos passos perguntam como o projeto segue, a partir do seu log, do seu status e das suas tarefas pendentes) cobrem o resto; o último confere que uma tarefa marcada e o registro nunca chegam ao prompt.

## Para ir além

- `stepsCommand` em `hooks/register.tsx` trata `/narsil pasos on` e `off`, ao lado de `/narsil cache`.
- `shownState` envia os passos ao hub, para que a janela flutuante os mostre com a conversa; o estado do celular os deixa de fora para as outras conversas.
- `pendingTasks` em `hooks/advice.ts` também lê tarefas numa tabela sob `## Tasks`, pelas palavras pending, pendiente, todo ou in progress, então um registro de tarefas escrito como tabela também funciona.
- Com as dicas do guia 11 e este guia, toda chamada ao modelo que a Narsil faz passa por `$.model.complete` com o Haiku, exceto a dica profunda, que faz um fork da sessão.
