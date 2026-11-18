---
title: Resumo da sessão
description: 'Como a Narsil conta o que uma conversa fez (turnos, arquivos, comandos, falhas, subagentes) e continua contando quando o Claude Code reinicia, para /narsil resumen e um resumo depois de uma pausa.'
route: pet
order: 16
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/watch.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: types/index.d.ts
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## O que faz

`/narsil resumen` ("resumo") responde a uma pergunta difícil de responder a partir da transcrição: o que esta conversa realmente fez até agora? Ele imprime uma linha:

```text
📋 Sesión de 1 h 5 min: 4 turnos (12 min de trabajo) · 3 archivos editados (a.ts, b.ts, c.ts) · 7 comandos, 1 fallo · 2 subagentes · contexto 40 %
```

Tradução para o português: uma sessão de 1 h 5 min, 4 turnos (12 minutos de trabalho), 3 arquivos editados, 7 comandos com 1 falha, 2 subagentes, o contexto 40 % cheio. O exemplo é o do comentário acima de `summaryText` em `hooks/watch.ts`.

A Narsil também o mostra por conta própria quando uma conversa fica quieta por 30 minutos depois de um turno: um momento natural para olhar para trás, por exemplo depois de um intervalo. Ele aparece onde aparecem as dicas dela (guia 11): numa pequena janela própria no Windows e no macOS, na faixa nos outros casos.

Se você fechar o Claude Code e mais tarde retomar a conversa, o resumo continua somando de onde estava. A Narsil guarda as contagens das 20 conversas mais recentes.

## Como funciona por dentro

### O que é contado: o tipo `Stats`

As contagens são um único valor, o atom `stats` em `hooks/register.tsx`, do tipo `Stats` declarado em `types/index.d.ts`:

| Campo       | O que conta                                    | Onde é somado                               |
| ----------- | ---------------------------------------------- | ------------------------------------------- |
| `startedAt` | quando as contagens da conversa começaram      | na primeira vez, em `session.start`         |
| `turns`     | turnos terminados da conversa principal        | `turn.complete`, qualquer motivo            |
| `workedMs`  | o tempo que esses turnos levaram               | `turn.complete`, a partir de `e.durationMs` |
| `files`     | os nomes dos arquivos editados, até 200        | `tool.call` de uma ferramenta de escrita    |
| `moreFiles` | arquivos além dos 200 primeiros, só contados   | o mesmo                                     |
| `commands`  | comandos de shell executados                   | `tool.call` de `Bash` ou `PowerShell`       |
| `failures`  | chamadas de ferramentas que retornaram um erro | depois de `next(e)` em `tool.call`          |
| `agents`    | subagentes iniciados                           | `agent.spawn`                               |

Toda mudança passa por uma função, `bumpStats($, change)`, que aplica uma mudança pura ao atom (partindo de `emptyStats(now)` se ainda não houver nenhum) e o salva. Os auxiliares em `hooks/watch.ts` mantêm as regras simples: `emptyStats`, `addFile`, `summaryText`, `statsOf`.

Alguns detalhes decidem o que os números significam:

- **As ferramentas de escrita** são `Edit`, `MultiEdit`, `Write` e `NotebookEdit` (`WRITING_TOOLS` em `hooks/words.ts`). O arquivo é o detalhe curto que a faixa mostra, o nome base do arquivo, e `addFile` acrescenta um nome só uma vez. Assim, o resumo conta nomes distintos: dois arquivos `index.ts` em pastas diferentes contam como um.
- **O trabalho dos subagentes também conta.** O hook `tool.call` soma arquivos, comandos e falhas qualquer que seja o `e.agentId`, enquanto `turns` conta só os turnos da conversa principal, já que o `turn.complete` de um subagente retorna antes daquela linha.
- **Só as chamadas do Claude contam.** O hook começa com `isClaudesCall(next.origin)`: uma chamada feita por outro mod não faz parte do trabalho da sessão (guia 1).
- **Um teste que falha é uma falha.** `failures` conta qualquer resultado de ferramenta com `isError`, incluindo uma execução de testes que falha.
- **O contexto** não é guardado: `summarize` lê a porcentagem atual do atom `usage` do guia 7, e a deixa de fora quando não há nenhuma.

`summaryText(stats, now, contextPercent)` escreve a linha. Ela cita no máximo três arquivos e acrescenta "…" depois deles quando há mais, escreve "ningún archivo editado" ("nenhum arquivo editado") quando não há nenhum, deixa os subagentes de fora quando não houve nenhum, e trata o plural de cada contagem. A duração é `now - startedAt`, escrita em minutos ou em horas e minutos.

### Por que duas camadas de persistência

A Narsil guarda as contagens em dois lugares, e cada um cobre um tipo diferente de reinício:

- **`$.state`, o atom.** Os tipos o descrevem como "plain data that survives a hot reload of the plugin's code" (dados simples que sobrevivem a uma recarga a quente do código do plugin). Uma recarga do mod, que acontece depois de qualquer turno que o edite, mantém as contagens sem fazer nada.
- **`$.store`, uma chave por conversa.** O store é "kept between sessions and hot reloads" (mantido entre sessões e recargas a quente). `loadStats` pede `$.session.id()`, que os tipos descrevem como "the session's id (the transcript file's name)" (o id da sessão, o nome do arquivo da transcrição), e usa a chave `stats:<id>`. `saveStats` escreve ali o valor inteiro depois de cada mudança.

Em `session.start`, `loadStats` preenche o atom a partir do store só quando o atom está vazio. Uma recarga mantém o atom e pula o store; um reinício do Claude Code com a mesma conversa tem um atom vazio e o lê de volta. O comentário naquele ponto resume: "The stats survive a reload of the mod, and Claude Code restarting with this conversation: only a new conversation starts them." (as estatísticas sobrevivem a uma recarga do mod, e ao Claude Code reiniciando com esta conversa: só uma nova conversa as começa.)

A chave é por conversa de propósito. A XP do guia 13 é um único número para a máquina, ao qual todas somam; um resumo trata de uma conversa, então cada uma tem o seu.

Se `$.session.id()` falhar, a chave fica vazia e nada é guardado: as contagens então duram só enquanto durar o atom.

Uma consequência decorre de guardar `startedAt`: a duração conta a partir de quando as contagens da conversa começaram, então o tempo com o Claude Code fechado está incluído. Uma conversa retomada na manhã seguinte diz que durou a noite toda.

### Guardar só 20

Uma chave por conversa cresce sem fim, então `saveStats` faz uma limpeza uma vez por carga do módulo (`isStatsPruned`). Ela lista as chaves do store, fica com as que começam com `stats:` exceto a sua própria, e apaga as mais antigas até restarem 19, de modo que restem 20 com a sua. O código depende da ordem: "Oldest first: the store lists its keys in the order they were set." (as mais antigas primeiro: o store lista as suas chaves na ordem em que foram definidas.) Os tipos dizem que `$.store.keys()` "Returns every key set, in insertion order." (retorna todas as chaves definidas, em ordem de inserção.) Qualquer falha ao listar ou apagar deixa todas as chaves no lugar.

`statsOf` valida o que lê: cada contagem deve ser um número finito e `files` um array de strings, ou o valor guardado é ignorado e a conversa recomeça. O comentário o chama de "A stored value from any version, or none" (um valor guardado de qualquer versão, ou de nenhuma).

### O resumo depois de uma pausa

O batimento (`beat`, a cada 2 segundos) chama `tickWatch`, que mostra o resumo quando tudo isto vale:

- um turno terminou: o relógio do cache do guia 8 tem um início, `c.at`, que o fim de cada turno define;
- nada continua rodando em segundo plano (`backgroundAtStop === 0`);
- 30 minutos (`IDLE_SUMMARY_MS`) se passaram desde `c.at`;
- a pausa deste turno ainda não foi resumida (`summarizedFor !== c.at`);
- a conversa tem pelo menos um turno;
- o modo discreto está desligado (guia 14).

Então ela chama `showTip($, await summarize($), 'summary')`. Reaproveitar a exibição da dica significa que o resumo ganha de graça a janela de dica, as três linhas da faixa e a janela flutuante. `summarizedFor` faz com que isso aconteça uma vez por pausa: um novo turno define um novo `c.at`, e a pausa seguinte pode ser resumida de novo.

## Construa com o Claude

Peça ao Claude um comando que resuma a conversa a partir de contagens que o mod mantém ao longo da sessão. A única ideia que ele precisa acertar é onde as contagens ficam: num atom, para que recarregar o mod as mantenha, e em `$.store` sob uma chave por conversa, para que reiniciar o Claude Code também as mantenha.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No meu mod do Claude Code `my-pet`, acrescente `/my-pet summary`. Mantenha um atom `stats` com `startedAt`, `turns`, `workedMs`, `files` (nomes base distintos, no máximo 200), `commands`, `failures` e `agents`. Conte os turnos e a sua `durationMs` em `turn.complete` da conversa principal; os arquivos editados a partir das chamadas `Edit` e `Write` em `tool.call`; as chamadas `Bash` como comandos; qualquer resultado com `isError` como uma falha; os subagentes em `agent.spawn`. Mude o atom só por meio de uma função que também o salve em `$.store` sob `stats:` mais `$.session.id()`. Em `session.start`, carregue-o do store só se o atom estiver vazio, e valide o que ler. Mantenha só as últimas 20 chaves desse tipo. O comando imprime uma linha como "Session of 12 min: 3 turns · 2 files edited (a.ts, b.ts) · 4 commands, 1 failure". Teste com `claude-code/testing`: um valor guardado sob a chave da sessão é continuado, e uma 25ª chave antiga é apagada.

### O que conferir na resposta do Claude

1. Toda contagem fica num único atom, nunca numa variável de módulo, e só muda por meio de uma função que também a salva.
2. A chave do store é `stats:` seguido de `$.session.id()`, então cada conversa tem as suas próprias contagens.
3. Em `session.start` o store só é lido quando o atom está vazio, e o que é lido é conferido campo por campo antes de ser usado.
4. Os turnos são contados só para a conversa principal em `turn.complete`, e um arquivo editado é contado uma vez por nome base.
5. Só as 20 chaves `stats:` mais recentes são mantidas.

Se uma verificação falhar, diga ao Claude o que você vê: "depois que eu reinicio o Claude Code e retomo esta conversa, o resumo diz 0 turnos".

### Como a pessoa autora pediu

O pedido original do resumo da sessão não foi registrado.

Um pedido registrado toca no módulo em que o resumo nasceu. `hooks/watch.ts` começou com um alerta de loop, um lembrete para permissões que esperam e o resumo. Em `odd/tasks/fleet-view.md`, L1 (2026-11-06), a pessoa autora pediu:

> "eliminariamos la alerta de bucle, no la he sentido tan util"

Tradução para o português: eliminaríamos o alerta de loop, não o achei tão útil. O registro de tarefas o anota como S9, e `21e7288` o removeu. O resumo e o lembrete ficaram.

#### Reconstrução a partir do histórico de commits

A partir de `git log -- hooks/watch.ts` no narsil-pet:

- `f7a494e` (2026-10-30) "feat: warn about loops, insist on waiting permissions and sum the session up" (avisar sobre loops, insistir nas permissões que esperam e resumir a sessão). O resumo, o lembrete e o alerta de loop chegam juntos.
- `21ffc2e` (2026-10-31) "fix: keep a conversation's session summary when Claude Code restarts" (manter o resumo da sessão de uma conversa quando o Claude Code reinicia). As chaves `stats:<id>`, `statsOf` e o limite de 20 (`KEEP_STATS`) vêm daqui. A primeira versão vivia só na sessão.
- `36256f9` (2026-10-31) "feat: let the band, window and alerts speak in Narsil's first person" (deixar a faixa, a janela e os alertas falarem na primeira pessoa da Narsil).
- `2bcc97c` (2026-11-05) "feat: open the context breakdown from the usage bars and calm loop, steps and permission alerts" (abrir o detalhamento do contexto a partir das barras de uso e acalmar os alertas de loop, de passos e de permissões).
- `519dd73` (2026-11-06) "fix: wait for background work before announcing a turn finished" (esperar o trabalho em segundo plano antes de anunciar que um turno terminou). A condição `backgroundAtStop === 0` do resumo de pausa chega com ele.
- `21df208` (2026-11-06) "fix: ignore tool calls other mods make, so Narsil no longer sticks at working" (ignorar as chamadas de ferramentas que outros mods fazem, para que a Narsil não fique mais presa em trabalhando). A sua mensagem cita chamadas de outro mod sendo contadas como trabalho do Claude; `isClaudesCall` também as mantém fora das contagens.
- `21e7288` (2026-11-06) "refactor: drop the loop alert, the spending count and the open-conversations line" (remover o alerta de loop, a contagem de gastos e a linha de conversas abertas).

A primeira correção é a instrutiva: um resumo que se perde quando o Claude Code reinicia relata uma fração do trabalho, o que é pior do que nenhum.

## Código de referência

Esta é uma resposta correta, escrita para este guia. Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

Escrito para este guia e conferido com os tipos da 2.1.325 (`$.session.id`, `$.store.get`, `$.store.set`, `$.clock.now`, `$.command.register`, `command.run`, `session.start`, `tool.call`, `turn.complete`, `agent.spawn`). Foi adaptado de `hooks/watch.ts` e `hooks/register.tsx` do [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). O atom `stats` está declarado em `types/index.d.ts` como `Stats | null`, com o tipo abaixo. A limpeza para 20 fica de fora; veja `saveStats`.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import type { Stats } from '../types'
// type Stats = { startedAt: number; turns: number; workedMs: number;
//   files: string[]; commands: number; failures: number; agents: number }

const stats = atom({ plugin: 'my-pet', key: 'stats' } as const, null)
let key = ''

const empty = (startedAt: number): Stats => ({
  startedAt,
  turns: 0,
  workedMs: 0,
  files: [],
  commands: 0,
  failures: 0,
  agents: 0,
})
const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path

async function bump($: EngineInterface, change: (s: Stats) => Stats): Promise<void> {
  const now = await $.clock.now()
  const next = await update($, stats, (s) => change(s ?? empty(now)))
  if (key) await $.store.set(key, next).catch(() => undefined)
}

function summary(s: Stats, now: number): string {
  const minutes = Math.round((now - s.startedAt) / 60_000)
  const files = s.files.length
    ? ` (${s.files.slice(0, 3).join(', ')}${s.files.length > 3 ? '…' : ''})`
    : ''
  return `Session of ${minutes} min: ${s.turns} turns · ${s.files.length} files edited${files} · ${s.commands} commands, ${s.failures} failures · ${s.agents} subagents`
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'my-pet', description: 'My pet: summary' })
    key = `stats:${await $.session.id().catch(() => '')}`
    if (key === 'stats:') key = ''
    // A reload keeps the atom; a restart reads the store back.
    if (key && !(await read($, stats))) {
      const kept = await $.store.get(key).catch(() => undefined)
      if (kept && typeof kept === 'object' && typeof (kept as Stats).turns === 'number')
        await update($, stats, (s) => s ?? (kept as Stats))
    }
    if (!(await read($, stats))) await bump($, (s) => s)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const path = (e as { file_path?: unknown }).file_path
    if ((e.tool === 'Edit' || e.tool === 'Write') && typeof path === 'string') {
      const name = baseName(path)
      await bump($, (s) =>
        s.files.includes(name) || s.files.length >= 200 ? s : { ...s, files: [...s.files, name] },
      )
    }
    if (e.tool === 'Bash') await bump($, (s) => ({ ...s, commands: s.commands + 1 }))
    const result = await next(e)
    if (result.isError) await bump($, (s) => ({ ...s, failures: s.failures + 1 }))
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined)
      await bump($, (s) => ({ ...s, turns: s.turns + 1, workedMs: s.workedMs + e.durationMs }))
    return result
  })

  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    await bump($, (s) => ({ ...s, agents: s.agents + 1 }))
    return result
  })

  on('command.run', { command: 'my-pet' }, async ($, e) => {
    if (e.args.trim() !== 'summary') return { text: 'Usage: /my-pet summary' }
    const now = await $.clock.now()
    return { text: summary((await read($, stats)) ?? empty(now), now) }
  })
}
```

`update` resolve com o valor que escreveu, então `bump` salva exatamente o que o atom contém. A verificação do valor guardado aqui é um esboço; o `statsOf` da Narsil confere cada campo.

## Erros comuns e como testar

- **Contar em variáveis de módulo.** Uma recarga do mod acontece depois de qualquer turno que o edite, e uma variável de módulo recomeça. Guarde as contagens num atom.
- **Uma única chave do store para todas as conversas.** Então o resumo de cada conversa é o de todas. Use `$.session.id()` na chave.
- **Carregar o store por cima de um atom vivo.** Depois de uma recarga, o atom é o valor mais novo; o store pode estar uma mudança atrás. Carregue só quando o atom estiver vazio.
- **Um store que cresce para sempre.** Uma chave por conversa precisa de um limite e de uma limpeza.
- **Confiar no que está guardado.** Uma versão mais antiga pode ter guardado outro formato. Valide campo por campo, e recomece quando não encaixar.
- **Resumir no momento errado.** Uma pausa enquanto um trabalho em segundo plano roda não é uma pausa. A Narsil espera que ele termine, e resume cada pausa só uma vez.

Para testar, `tests/narsil.test.tsx` tem quatro testes. "/narsil resumen sums the session up, and so does a 30-minute pause after a turn" (/narsil resumen resume a sessão, e uma pausa de 30 minutos depois de um turno também) confere a linha exata ("Narsil: 📋 Sesión de 0 min: 2 turnos (1 min 24 s de trabajo) · 2 archivos editados (a.ts, b.ts) · 1 comando, 0 fallos.") e depois avança o relógio simulado. "a conversation taken up again keeps counting its session, kept across restarts" (uma conversa retomada continua contando a sua sessão, mantida entre reinícios) responde a `session.id` com um id fixo, põe contagens anteriores no store sob `stats:` e esse id, e confere que o turno seguinte soma a elas. "only the last 20 conversations keep their counts, and an odd stored value is ignored" (só as últimas 20 conversas mantêm as suas contagens, e um valor guardado estranho é ignorado) começa com 25 chaves antigas e um valor inválido. "the summary names three files at most, and counts subagents and context" (o resumo cita no máximo três arquivos, e conta subagentes e contexto) testa `summaryText` sozinha.

## Para ir além

- `nudgeText` e `NUDGE_AFTER_MS` em `hooks/watch.ts`, vizinhos do resumo, conduzem o lembrete de cinco minutos do guia 10.
- `took` em `hooks/agents.ts` escreve as durações ("1 min 24 s") para o resumo e para os subagentes.
- O próximo e último guia da trilha mostra como o próprio `/narsil` é registrado e como as suas palavras, `resumen` entre elas, são despachadas.
