---
title: Os estados num relance
description: 'Como a Narsil transforma os eventos da sessão em cinco estados, uma frase sobre o passo atual e um comentário curto, desenhados na faixa acima do prompt.'
route: pet
order: 1
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: hooks/sprite.ts
  - repo: pet
    path: types/index.d.ts
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## O que faz

A Narsil vive na faixa logo acima do prompt. Um olhar para ela responde à pergunta que você mais faz enquanto o Claude trabalha: preciso fazer alguma coisa agora?

A faixa mostra três coisas:

- **Um estado**, em maiúsculas e com a sua própria cor. A Narsil fala espanhol, então os rótulos estão em espanhol:

  | Rótulo        | Significado                | Quando aparece                                                            |
  | ------------- | -------------------------- | ------------------------------------------------------------------------- |
  | `TRABAJANDO`  | Trabalhando                | O Claude está pensando, lendo, buscando, editando ou executando comandos. |
  | `PARADA`      | Parada, esperando por você | A conversa está esperando a sua próxima mensagem.                         |
  | `TE NECESITA` | Precisa de você            | Uma pergunta, um plano para aprovar ou uma permissão para decidir.        |
  | `TERMINADA`   | Terminada                  | O Claude terminou a resposta.                                             |
  | `ERROR`       | Erro                       | O turno parou porque algo falhou.                                         |

- **Uma frase que diz exatamente o que o Claude está fazendo**, como "Estoy editando: register.tsx" ("Estou editando: register.tsx") ou "Te necesito: tengo una pregunta para ti" ("Preciso de você: tenho uma pergunta para você").
- **O comentário da própria Narsil** sob essa frase, escolhido ao acaso entre algumas falas para cada momento, como "Tecleando con mis aletas." ("Digitando com as minhas nadadeiras.") enquanto um arquivo é editado.

Fora do terminal, a faixa também desenha a própria Narsil, numa pose para cada estado (o próximo guia trata do desenho). No terminal, ela desenha em vez disso um pequeno rosto de texto, como `~(•ᴗ•)~ 💻`.

O valor está em você não precisar ler a transcrição para saber em que pé as coisas estão. Um `TE NECESITA` amarelo é motivo para voltar; um `TRABAJANDO` azul é motivo para continuar fazendo outra coisa.

## Como funciona por dentro

O estado não é algo que o Claude Code entregue a um mod. A Narsil o constrói ela mesma a partir dos eventos da sessão, guarda-o em um único valor e desenha esse valor.

### Um valor, duas camadas: humor e estado

O mod guarda um único valor de estado, o atom `pet` em `hooks/register.tsx`, com três campos: `mood`, `detail` e `line`. Seu tipo, `Pet`, está declarado em `types/index.d.ts`.

`mood` (o humor) é mais detalhado que os cinco estados. Há doze humores: `greeting`, `idle`, `thinking`, `talking`, `reading`, `searching`, `writing`, `running`, `asking`, `scared`, `celebrating` e `failed`. Os cinco estados são derivados do humor por `statusOf` em `hooks/sprite.ts`:

- `greeting` e `idle` são parada (`PARADA`).
- `asking` é espera (`TE NECESITA`).
- `celebrating` é terminada (`TERMINADA`).
- `failed` é erro (`ERROR`).
- Todos os outros humores são trabalho (`TRABAJANDO`), incluindo `scared`.

O motivo das duas camadas é que o estado responde "preciso agir?", e cinco respostas bastam para isso; o humor responde "o que exatamente está acontecendo?", e é ele que define a frase, o comentário e a pose. Guardar só o humor e derivar o estado significa que os dois nunca podem discordar.

O humor `scared` é um bom exemplo de por que a divisão importa. Quando uma chamada de ferramenta falha no meio de um turno, a Narsil parece assustada e a frase diz "Ha fallado un paso (Bash); sigo trabajando" ("Um passo falhou (Bash); continuo trabalhando"). O estado continua `TRABAJANDO`, porque o Claude ainda está trabalhando e nada é pedido a você. Só um turno que termina em falha vira `ERROR`.

### Os eventos que a Narsil escuta

Toda mudança de humor passa por uma única função, `setMood` em `hooks/register.tsx`, que grava o atom `pet` e envia o novo estado para a janela flutuante. Os hooks que a chamam:

- **`session.start`**: uma conversa nova começa como `greeting`, que conta como parada.
- **`turn.start`**: o seu prompt inicia um turno; o humor vira `thinking`. O hook só age quando `e.agentId` é undefined, para que o turno de um subagente não reinicie a conversa principal.
- **`turn.step`**: a saída do modelo chega em pedaços. Um pedaço `thinking` mantém o humor em `thinking`; o primeiro pedaço `text` do laço principal o troca para `talking` ("Estoy escribiendo la respuesta", "Estou escrevendo a resposta"). Esse hook é um gerador assíncrono: ele repassa com `yield` cada pedaço que recebe, para que o fluxo chegue à tela sem alterações.
- **`tool.call`**: o evento mais informativo. O nome da ferramenta escolhe o humor por meio de `MOOD_BY_TOOL` em `hooks/words.ts` (`Read` é leitura, `Grep` e `WebSearch` são busca, `Edit` e `Write` são escrita, `Bash` e `PowerShell` são execução), e `describeCall` transforma a entrada da chamada no breve detalhe depois dos dois-pontos: o nome base do arquivo para uma ferramenta de arquivo, o padrão para uma busca, a primeira linha de um comando. `AskUserQuestion` e `ExitPlanMode` são tratados à parte (`ASKING_TOOLS`): eles definem `asking`, porque a própria ferramenta é o momento em que o Claude para e espera.
- **`classic.PermissionRequest`**: um diálogo de permissão que você precisa responder. O hook chama `next(e)` primeiro e só define `asking` quando nenhum hook de configuração já decidiu e o modo não é `bypassPermissions`.
- **`turn.complete`**: o turno termina, e `e.reason` decide o estado. `answer` vira `celebrating` com o tempo que levou ("He terminado (en 2 min)", "Terminei (em 2 min)"), `aborted` volta para `idle` com "lo has detenido tú" ("foi você que parou") e qualquer outro motivo vira `failed`.

### Por que cada decisão foi tomada

Os comentários em `hooks/register.tsx` dão os motivos, e vale a pena lê-los como notas de design:

- **As permissões usam `classic.PermissionRequest`, não `tool.check`.** O comentário explica que o `ask` de `tool.check` chega antes de o modo de permissão resolver a chamada, de modo que, com "bypass permissions", uma regra ou o classificador automático, a Narsil daria um alarme falso (nas palavras do comentário, "cry wolf", gritar "lobo"). O motor só emite `PermissionRequest` quando está prestes a mostrar o diálogo a você.
- **Um turno encerrado nem sempre está "terminado".** No hook `classic.Stop`, a Narsil conta as tarefas em segundo plano ainda em execução (`e.background_tasks`). Se houver alguma, `turn.complete` a mostra ainda em `running`, esperando por elas, em vez de anunciar um fim que não é real.
- **Uma pergunta na caixa de próximo passo do aplicativo de desktop é uma pergunta.** Quando um turno termina com a ferramenta `mcp__ccd_turn__wrap_up` do aplicativo de desktop trazendo um `ask`, o hook `tool.call` guarda esse texto (`turnAsk`), e `turn.complete` mostra `asking` com ele em vez de `celebrating`.
- **Só as chamadas do próprio Claude a movem.** `tool.call` começa com `isClaudesCall(next.origin)` (em `hooks/watch.ts`): a chamada de outro mod, como o narsil-check lendo a sessão ao começar, não é trabalho do Claude.
- **As palavras ficam em um único arquivo.** `hooks/words.ts` guarda todos os rótulos (`STATUS_LABEL`), o construtor de frases (`headline`), os comentários (`LINES` e `pick`) e a tabela de ferramentas. O módulo de hooks decide o que aconteceu; `words.ts` decide como isso é dito. Isso mantém os rótulos idênticos em todos os lugares onde aparecem: a faixa, a janela flutuante, o celular e `/narsil estado`.
- **A Narsil fala em primeira pessoa.** As frases são escritas como a Narsil falando ("Estoy leyendo", "Estou lendo"), uma escolha registrada no histórico de commits (veja abaixo).

### O que a faixa desenha

O hook `ui.render` para `{ component: 'AbovePrompt' }` lê o estado e retorna uma árvore de elementos `Box`, `Text`, `Button` e `Svg` obtidos de `$.ui.resolve(e)`. Ele cede o lugar a uma pesquisa (`e.props.hasSurvey`) e a `/narsil ocultar`.

No terminal, desenha uma linha: o rosto de texto de `FACE`, o rótulo em negrito na sua cor e a frase. Nas outras superfícies, desenha a imagem por meio de `Svg` com 132 por 118 pixels e, ao lado, uma coluna com `● LABEL · Narsil · level`, a frase em negrito e o comentário esmaecido. As cores vêm de `STATUS_COLOR` em `hooks/sprite.ts`: azul `#3B8BFF` para trabalhando, cinza para parada, amarelo `#F5B400` para precisa de você, verde para terminada e vermelho para erro.

Todo texto que pode crescer é desenhado com `wrap="truncate-end"` dentro de uma caixa com `minWidth={0}`, para que um nome de arquivo longo seja cortado dentro da faixa em vez de alargá-la.

A faixa que você vê hoje desenha a mais importante de todas as suas conversas abertas, não só a atual; o terceiro guia desta trilha explica essa parte. Quando a conversa mostrada é outra, a frase começa com o nome dessa conversa, e o comentário fica de fora.

## Como foi pedido à IA

O pedido original dos estados não foi registrado. Os registros públicos de tarefas do projeto (`odd/tasks/fleet-view.md` e `odd/tasks/animated-poses.md`) começam depois, e nenhum deles trata da primeira faixa.

### Reconstrução a partir do histórico de commits

A partir de `git log -- hooks/register.tsx hooks/words.ts` no narsil-pet:

- `b1187f3` (2026-10-30) "feat: show Narsil above the prompt with clear states and /narsil" (mostrar a Narsil acima do prompt com estados claros e /narsil). A faixa, os seus estados e o comando `/narsil` chegam juntos no primeiro commit do módulo de hooks.
- `8e29583` (2026-10-30) "fix(band): keep long text from widening the desktop band" (impedir que um texto longo alargue a faixa no desktop). A regra de `minWidth={0}` e truncamento descrita acima vem daqui.
- `2027f06` (2026-10-30) "fix(alerts): only alert when a permission dialog needs your answer" (só alertar quando um diálogo de permissão precisa da sua resposta). A mudança para `classic.PermissionRequest`, explicada no comentário do código citado acima.
- `0cfc369` (2026-10-31) "refactor: move Narsil's wording and labels out of the hooks module" (tirar os textos e rótulos da Narsil do módulo de hooks). Foi aqui que nasceu `hooks/words.ts`.
- `c73bc13` (2026-10-31) "feat: let Narsil speak of herself in the first person" (deixar a Narsil falar de si mesma em primeira pessoa), seguido de `36256f9` "feat: let the band, window and alerts speak in Narsil's first person" (deixar a faixa, a janela e os alertas falarem na primeira pessoa da Narsil).
- `2532e7c` (2026-11-02) "feat: alert as a question when a turn ends asking in the desktop app's next-step box" (alertar como pergunta quando um turno termina perguntando na caixa de próximo passo do aplicativo de desktop).
- `519dd73` (2026-11-06) "fix: wait for background work before announcing a turn finished" (esperar o trabalho em segundo plano antes de anunciar que um turno terminou). A mensagem diz que um turno que para com shells, monitores ou subagentes em segundo plano ainda em execução agora mostra a Narsil esperando por eles.

O padrão fica claro mesmo sem os prompts: uma primeira versão que mapeava eventos para estados e, depois, uma série de correções a cada vez que um estado mentia (um alarme falso, um fim falso, uma pergunta perdida).

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt usado para construir a Narsil.

> Crie um mod do Claude Code chamado `my-pet` que mostre o estado da conversa na faixa acima do prompt (`ui.render` em `AbovePrompt`). Guarde um único valor de estado em um atom, com um status (trabalhando, parado, esperando, terminado, erro) e uma frase de uma linha. Defina-o a partir de `turn.start` (trabalhando), `tool.call` (trabalhando, com a ferramenta e o nome base do arquivo na frase; esperando para `AskUserQuestion` e `ExitPlanMode`) e `turn.complete` (terminado em `answer`, parado em `aborted`, erro nos outros casos). Ignore os eventos que tenham `agentId` definido. Desenhe o rótulo em negrito na sua cor e a frase depois dele, truncada para nunca alargar a faixa. Confira cada API com os tipos do plugin-authoring, declare o atom em `types/index.d.ts` e adicione um teste com `claude-code/testing` mostrando que uma chamada a `Read` exibe o nome do arquivo.

## O código mínimo

Esta é uma versão reduzida da ideia, escrita para este guia e conferida com os tipos do Claude Code 2.1.325. Ela foi adaptada de `hooks/register.tsx`, `hooks/words.ts` e `hooks/sprite.ts` do [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later); as cores são as de `STATUS_COLOR` da Narsil.

O tipo do estado, em `types/index.d.ts` (nomeado por `"types"` em `plugin.json`):

```ts
export type Status = 'working' | 'idle' | 'waiting' | 'done' | 'error'
export type Pet = { status: Status; headline: string }

declare module 'claude-code' {
  interface PluginState {
    'my-pet': { pet: Pet }
  }
}
```

O módulo de hooks, `hooks/register.tsx`:

```tsx
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'
import type { Status } from '../types'

const LABEL: Record<Status, string> = {
  working: 'WORKING',
  idle: 'IDLE',
  waiting: 'NEEDS YOU',
  done: 'DONE',
  error: 'ERROR',
}
const COLOR: Record<Status, string> = {
  working: '#3B8BFF',
  idle: '#8A90A6',
  waiting: '#F5B400',
  done: '#22B573',
  error: '#F0435A',
}
const VERB: Record<string, string> = {
  Read: 'reading',
  Grep: 'searching',
  Edit: 'editing',
  Write: 'editing',
  Bash: 'running',
}

const pet = atom({ plugin: 'my-pet', key: 'pet' } as const, {
  status: 'idle',
  headline: 'Waiting for your message',
})

export const register: Register = (on) => {
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined)
      await update($, pet, () => ({ status: 'working', headline: 'Thinking' }))
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId === undefined) {
      const input = e as unknown as Record<string, unknown>
      const file = typeof input.file_path === 'string' ? input.file_path.split(/[\\/]/).pop() : ''
      const isAsking = e.tool === 'AskUserQuestion' || e.tool === 'ExitPlanMode'
      await update($, pet, () =>
        isAsking
          ? { status: 'waiting', headline: 'I have a question for you' }
          : {
              status: 'working',
              headline: `I am ${VERB[e.tool] ?? 'working'}${file ? `: ${file}` : ''}`,
            },
      )
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    const status: Status =
      e.reason === 'answer' ? 'done' : e.reason === 'aborted' ? 'idle' : 'error'
    await update($, pet, () => ({
      status,
      headline: status === 'error' ? 'I stopped on an error' : 'Done',
    }))
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const s = await read($, pet)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" gap={1} minWidth={0}>
        <Text bold color={COLOR[s.status]}>{`● ${LABEL[s.status]}`}</Text>
        <Text wrap="truncate-end">{s.headline}</Text>
      </Box>
    )
  })
}
```

Três detalhes sustentam o design. Cada hook que só observa termina chamando `next(e)`, para que o comportamento do próprio Claude Code continue. `turn.complete` aguarda `next(e)` primeiro e reage ao turno já resolvido. E o hook de renderização lê o atom com `read`, o que inscreve o desenho: cada `update` redesenha a faixa.

## Erros comuns e como testar

Estes vêm do código e das correções da Narsil:

- **Reagir aos subagentes como se fossem a conversa principal.** Os subagentes também emitem `turn.start`, `tool.call` e `turn.complete`, com `e.agentId` definido. A Narsil confere `e.agentId === undefined` antes de mexer no estado principal.
- **Alarmes que o modo de permissão já resolveu.** Detectar "precisa de você" a partir de `tool.check` dispara com bypass permissions. A correção da Narsil (`2027f06`) escuta `classic.PermissionRequest` e ainda o ignora quando um hook de configuração respondeu (`result.decision`) ou o modo é `bypassPermissions`.
- **Um "terminado" que não terminou.** Um turno pode acabar enquanto o trabalho em segundo plano continua. A Narsil lê `background_tasks` em `classic.Stop` antes de decidir (`519dd73`).
- **Texto que alarga a faixa.** No desktop, uma frase longa empurra o layout para fora. Use `minWidth={0}` na coluna e `wrap="truncate-end"` no texto (`8e29583`).
- **Engolir o fluxo.** Um hook `turn.step` é um gerador: se ele não fizer `yield` de cada pedaço vindo de `next(e)`, a resposta deixa de chegar à tela.
- **Ignorar as pesquisas.** Quando `e.props.hasSurvey` é verdadeiro, a faixa pertence à pesquisa; retorne `next(e)`.

Para testar, `claude plugin test .` executa os arquivos `*.test.tsx` do mod. O `tests/narsil.test.tsx` da Narsil é um bom modelo: ele inicia uma sessão com `$.session.start`, chama ferramentas com `$.tool.call`, monta a faixa com `$.ui.mount` e procura textos com `find`. Testes que vale copiar, pelo nome, incluem "a new conversation shows as stopped and ready, on every surface" (uma conversa nova aparece como parada e pronta, em todas as superfícies), "a permission dialog you must answer pops up as a question" (um diálogo de permissão que você precisa responder aparece como pergunta) e "an ask the mode settles by itself (bypass permissions) raises no alarm" (um pedido que o modo resolve sozinho, com bypass permissions, não dispara alarme). O registro de tarefas da Narsil anota que, no shell da pessoa autora, `claude plugin test .` precisou de `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` (`odd/tasks/fleet-view.md`, L6). Execute também `claude plugin validate .claude-plugin/plugin.json`: ele confere as leituras e escritas do seu atom com base em `types/index.d.ts`.

Uma observação sobre as superfícies: o README da Narsil diz que a faixa funciona no terminal, no aplicativo de desktop, no VS Code e no aplicativo móvel. Os tipos da 2.1.325 documentam `AbovePrompt` como "Raised on the terminal, desktop and mobile surfaces only" (emitido apenas nas superfícies de terminal, desktop e celular). Teste nas superfícies que importam para você em vez de confiar em qualquer uma das duas afirmações.

## Para ir além

A versão completa no narsil-pet acrescenta bastante em torno do mesmo núcleo:

- `setMood` em `hooks/register.tsx` é o ponto de entrada único para toda mudança, e também envia o estado ao hub local (`pushOverlay`).
- `headline` e `LINES` em `hooks/words.ts` guardam a frase de cada um dos doze humores e três comentários para cada um; `describeCall` monta o detalhe para arquivos, padrões, consultas, URLs, comandos e subagentes.
- O hook `tool.call` também reconhece comandos de teste (`TEST_COMMAND`) para comemorar testes que passam, e avisa sobre comandos que não podem ser desfeitos (`dangerOf`), sem bloqueá-los.
- `startWaiting` e `stopWaiting` insistem uma vez quando uma permissão ou uma pergunta fica esperando por cinco minutos.
- `announce` fala e notifica nos momentos-chave (início, fim, pergunta, erro), e `sendStatus` envia o estado ao celular.
- `FACE` em `hooks/sprite.ts` é o rosto de terminal de cada humor; `sprite` desenha a imagem completa, assunto do próximo guia.
