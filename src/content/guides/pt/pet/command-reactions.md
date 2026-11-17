---
title: Reações aos comandos
description: 'Como a Narsil lê os comandos de shell que o Claude executa: comemora testes que passam, percebe os que falham e avisa sobre comandos sem volta atrás, sem nunca bloqueá-los.'
route: pet
order: 9
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/watch.ts
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## O que faz

Toda vez que o Claude executa um comando de shell (a ferramenta `Bash` ou `PowerShell`), a Narsil lê a linha de comando e reage a dois tipos de comando.

**Testes.** Quando o comando executa os testes de um projeto, a Narsil espera o resultado:

- Se tiver sucesso, ela comemora na faixa: "¡Los tests pasan! 🎉" ("os testes passam!"), e ganha 5 pontos de experiência.
- Se falhar, ela se assusta (a pose "scared" dos guias anteriores) e diz "Los tests fallan; vamos a ver por qué." ("os testes falham; vamos ver por quê").
- Na próxima vez que passarem depois de uma falha, ela diz "¡Recuperados! Los tests vuelven a pasar." ("recuperados! os testes voltam a passar").

O README lista os executores que ela reconhece: npm, pnpm, yarn, bun, vitest, jest, pytest, go, cargo, dotnet, maven, gradle e outros.

**Comandos que não podem ser desfeitos.** Antes que um comando desses seja executado, o comentário da faixa vira um aviso, "⚠️ Cuidado: … no tiene vuelta atrás." ("cuidado: … não tem volta atrás"), com o nome do tipo de comando no espaço vazio. Uma linha também vai para o log do terminal, com a primeira linha do comando. Depois, o comando segue normalmente. O README é claro quanto a isso: "Solo avisa: nunca bloquea nada." (só avisa, nunca bloqueia nada).

O que isso lhe dá: uma olhada na faixa diz se a última execução de testes passou, e um comando destrutivo ganha um segundo par de olhos enquanto a caixa de diálogo de permissão, se houver uma, ainda está na tela.

## Como funciona por dentro

### Um hook na frente de cada ferramenta: `tool.call`

As duas reações ficam no hook `tool.call` em `hooks/register.tsx`. Um hook `tool.call` envolve a chamada: o código antes de `next(e)` roda antes da ferramenta, e `await next(e)` devolve o resultado da ferramenta. É esse formato que permite à Narsil avisar antes do comando e reagir aos testes depois dele.

Primeiro, o hook descarta o que não é trabalho do Claude:

- Uma chamada que outro mod faz (com `$.tool.call` ou `$.mcp.call`) também dispara `tool.call`. `isClaudesCall` em `hooks/watch.ts` mantém apenas as chamadas cujo `next.origin.plugin` é `"engine"`. O comentário explica o bug que isso corrigiu: nenhum turno encerra uma chamada feita por outro mod, então ela deixava a Narsil "trabalhando" até o próximo prompt (`21df208`).
- Apenas `Bash` e `PowerShell` carregam uma linha de comando (`SHELL_TOOLS` em `hooks/words.ts`). Para qualquer outra ferramenta, o comando é a string vazia, e nenhuma das reações pode disparar.

Diferentemente do estado da faixa, esta parte não ignora os subagentes: um teste executado por um subagente também é comemorado.

### Reconhecer uma execução de testes

`TEST_COMMAND` em `hooks/words.ts` é uma única expressão regular sobre a linha de comando:

```ts
export const TEST_COMMAND =
  /\b(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?test|(?:go|cargo|dotnet|mvn|gradle|gradlew|deno|mix)\s+test|claude\s+plugin\s+test|python3?\s+-m\s+(?:pytest|unittest)|vitest|jest|pytest|mocha|phpunit|rspec)\b/
```

Ela procura em qualquer parte da linha, então um comando que primeiro muda de diretório e depois executa os testes também conta.

Se os testes passaram não é algo lido da saída deles. A Narsil olha apenas para `result.isError`, o veredito da própria ferramenta sobre a chamada. Analisar a saída de uma dúzia de executores, cada um com o seu próprio formato de resumo, quebraria a cada novo executor ou versão; a flag de erro da ferramenta é o mesmo sinal para todos eles, e é também aquele em que um job de CI confia. O preço é que a Narsil só sabe "passou" ou "falhou", não quantos.

Uma variável de módulo, `areTestsFailing`, lembra que a última execução falhou. Essa única flag é o que transforma o próximo sucesso em "recuperados" em vez de uma comemoração simples.

Uma falha também alimenta as dicas do guia 11: o texto do erro é guardado, e duas falhas da mesma ferramenta num turno pedem uma dica de depuração.

### Reconhecer um comando perigoso

`DANGEROUS_COMMANDS` em `hooks/words.ts` é uma lista de pares: o nome com que a Narsil avisa, e o padrão que o encontra. Um trecho, reduzido aos padrões:

```ts
const DANGEROUS_COMMANDS: readonly (readonly [name: string, pattern: RegExp])[] = [
  ['rm -rf', /\brm\s+(?:-[a-zA-Z]*(?:[rR]f|f[rR])[a-zA-Z]*|-[rR]\s+-f|-f\s+-[rR])\b/],
  ['git push --force', /\bgit\s+push\b[^|;&\n]*\s(?:--force(?!-with-lease)|-f)\b/],
  ['git reset --hard', /\bgit\s+reset\s+--hard\b/],
  ['Remove-Item -Recurse -Force', /\bRemove-Item\b(?=[^|;\n]*-Recurse\b)(?=[^|;\n]*-Force\b)/i],
  ['DROP', /\bdrop\s+(?:table|database|schema)\b/i],
  // ... also git clean -f, git branch -D, chmod -R 777, mkfs, dd onto a device
  // and 'descargar y ejecutar' (download and run): curl, wget or
  // Invoke-WebRequest piped into a shell
]
```

Tradução do comentário para o português: ... também git clean -f, git branch -D, chmod -R 777, mkfs, dd sobre um dispositivo e 'descargar y ejecutar' (baixar e executar): curl, wget ou Invoke-WebRequest encadeados num shell.

Alguns detalhes mostram o cuidado nos padrões:

- O push forçado exclui `--force-with-lease`, a variante que se recusa a sobrescrever trabalho que não viu.
- `[^|;&\n]*` mantém a flag dentro do mesmo comando: um `--force` depois de um pipe ou de um `;` pertence a outro comando.
- O padrão de `rm` aceita as flags juntas em qualquer ordem ou escritas separadas.
- O de PowerShell exige tanto `-Recurse` quanto `-Force`, em qualquer ordem, com lookaheads.

`dangerOf(command)` devolve o nome do primeiro padrão que corresponde, ou `null`.

### Por que avisa em vez de negar

Um hook `tool.call` poderia recusar a chamada: os tipos da 2.1.325 documentam `{ deny: reason }` como resposta, e o modelo então recebe o texto como um resultado de erro. A Narsil nunca faz isso. Nem o código nem o README dizem por que com todas as letras; o README só afirma que ela nunca bloqueia. As razões abaixo são a leitura que este guia faz do código e dos tipos:

- **Os padrões são palpites.** Apagar uma pasta de build de forma recursiva é rotina em muitos scripts. Um bloqueio a cada correspondência pararia trabalho legítimo, e o modelo procuraria outra forma de fazer a mesma coisa. Os padrões também deixam coisas passar (nomes longos de opções, um arquivo de script que contém o comando), então um bloqueio prometeria uma segurança que não consegue dar.
- **O Claude Code já tem a trava.** Os tipos descrevem `tool.check` como disparando "after the `tool.call` and PreToolUse hooks and before the mode settles an ask" (depois dos hooks `tool.call` e PreToolUse e antes de o modo resolver uma pergunta). As regras de permissão e a caixa de diálogo de permissão são onde um comando é parado; o aviso da Narsil chega antes dessa decisão, enquanto você ainda pode responder que não.
- **O hook de um mod é, de qualquer forma, uma guarda fraca.** Os tipos avisam que "a guard that fails is skipped and the tool runs" (uma guarda que falha é ignorada e a ferramenta é executada). Uma guarda de verdade exige um cuidado que a Narsil, como companheira, não precisa ter.

### O que ela mostra

As reações passam por `setMood`, o ponto de entrada único do primeiro guia: o humor continua sendo o da própria ferramenta ("running" para um shell, "scared" numa falha), e a linha de comentário leva o aviso ou a comemoração. A linha do log do terminal é escrita com `$.ui.log`, cortada na primeira linha do comando e em 120 caracteres. O aviso é definido antes de `next(e)`, então ele está na tela enquanto o comando espera permissão ou é executado.

## Como foi pedido à IA

O pedido original destas reações não foi registrado. Elas chegaram em 2026-10-30, antes dos registros públicos de tarefas do projeto (`odd/tasks/fleet-view.md` começa em 2026-11-06 e não as menciona).

### Reconstrução a partir do histórico de commits

A partir de `git log -- hooks/register.tsx hooks/words.ts hooks/watch.ts` no narsil-pet:

- `c885292` (2026-10-30) "feat: estimate when the context fills, react to tests and dangerous commands, show subagents" (estimar quando o contexto se enche, reagir a testes e a comandos perigosos, mostrar os subagentes). O padrão de testes, a lista de comandos perigosos e a flag de "recuperados" chegam juntos neste commit, dentro do hook `tool.call`.
- `8913cdd` (2026-10-30) "feat: let Narsil earn experience and levels kept across sessions" (deixar a Narsil ganhar experiência e níveis mantidos entre sessões). Os testes que passam começam a render experiência.
- `0cfc369` (2026-10-31) "refactor: move Narsil's wording and labels out of the hooks module" (tirar os textos e rótulos da Narsil do módulo de hooks). Os padrões vão para `hooks/words.ts`, onde estão hoje.
- `21df208` (2026-11-06) "fix: ignore tool calls other mods make, so Narsil no longer sticks at working" (ignorar as chamadas de ferramentas que outros mods fazem, para que a Narsil não fique mais presa em trabalhando). O filtro `isClaudesCall` descrito acima.

Os próprios padrões não mudaram desde que foram escritos: `git log -S` os encontra apenas no primeiro commit e na mudança de lugar.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No meu mod do Claude Code `my-pet`, adicione um hook `tool.call` que reaja a comandos de shell. Ignore as chamadas cujo `next.origin.plugin` não seja `"engine"`, e as ferramentas que não sejam `Bash` e `PowerShell`. Antes de chamar `next(e)`, compare `e.command` com uma lista de expressões regulares com nome para comandos que não podem ser desfeitos (apagar à força de forma recursiva, push forçado mas não `--force-with-lease`, reset hard, apagar uma tabela); quando houver correspondência, escreva um aviso com o nome num atom exibido na faixa `AbovePrompt` e registre-o com `$.ui.log`, e nunca devolva `{ deny }`. Depois de `next(e)`, se o comando corresponder a um padrão de executor de testes, mostre "Tests pass" quando `result.isError` for false e "Tests fail" quando for true, e "Recovered" quando passarem depois de uma falha. Adicione testes com `claude-code/testing` em que a ferramenta seja respondida por um hook, para que nada seja executado de verdade.

## O código mínimo

Escrito para este guia e conferido com os tipos da 2.1.325 (`tool.call`, `next.origin`, `$.ui.log`, `ui.render`). Foi adaptado de `hooks/register.tsx` e `hooks/words.ts` do [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). O atom `line` está declarado em `types/index.d.ts`, como no primeiro guia, com o tipo `string`.

```tsx
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const line = atom({ plugin: 'my-pet', key: 'line' } as const, '')

const TEST =
  /\b(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?test|vitest|jest|pytest|cargo\s+test|go\s+test)\b/
const DANGER: readonly (readonly [string, RegExp])[] = [
  ['rm -rf', /\brm\s+(?:-[a-zA-Z]*(?:[rR]f|f[rR])[a-zA-Z]*|-[rR]\s+-f|-f\s+-[rR])\b/],
  ['git push --force', /\bgit\s+push\b[^|;&\n]*\s(?:--force(?!-with-lease)|-f)\b/],
  ['git reset --hard', /\bgit\s+reset\s+--hard\b/],
]
let testsFailing = false

export const register: Register = (on) => {
  on('tool.call', async ($, e, next) => {
    if (next.origin.plugin !== 'engine') return next(e)
    if (e.tool !== 'Bash' && e.tool !== 'PowerShell') return next(e)
    const command = e.command

    const danger = DANGER.find(([, pattern]) => pattern.test(command))?.[0]
    if (danger) {
      $.ui.log(`⚠️ my-pet: ${danger} cannot be undone: ${command.split('\n')[0]!.slice(0, 120)}`)
      await update($, line, () => `⚠️ Careful: ${danger} cannot be undone.`)
    }

    // Warn only: the call always goes on to the engine.
    const result = await next(e)

    if (TEST.test(command)) {
      const text = result.isError
        ? 'The tests fail; let us see why.'
        : testsFailing
          ? 'Recovered! The tests pass again.'
          : 'The tests pass! 🎉'
      testsFailing = !!result.isError
      await update($, line, () => text)
    }
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const text = await read($, line)
    if (!text) return next(e)
    const { Text } = $.ui.resolve(e)
    return <Text wrap="truncate-end">{text}</Text>
  })
}
```

Tradução do comentário para o português: só avisa; a chamada sempre segue até o motor.

## Erros comuns e como testar

- **Reagir às chamadas de outros mods.** O `$.tool.call` de outro mod também dispara `tool.call`, e nenhum turno o encerra. Confira `next.origin.plugin === 'engine'` (`21df208`).
- **Avisar depois do fato.** Um aviso definido depois de `await next(e)` chega quando o comando já foi executado. Defina-o antes.
- **Transformar o aviso num bloqueio.** Devolver `{ deny }` a partir de uma correspondência de padrão para trabalho legítimo e convida o modelo a encontrar um jeito de contorná-lo. Deixe a decisão para o sistema de permissões.
- **Confiar demais na flag de erro.** Um comando que esconde o seu próprio status de saída (encadear a execução de testes em outro programa com um pipe, ou terminá-la com uma alternativa que sempre tem sucesso) é lido como aprovado. A Narsil não consegue perceber, e a sua cópia também não.
- **Testar com comandos destrutivos de verdade.** Nunca os execute para ver o aviso. Num teste, responda à ferramenta a partir de um hook para que nada seja executado.

Para testar, `claude plugin test .` executa `tests/narsil.test.tsx`. "a dangerous command is flagged before it runs, and an ordinary one is not" (um comando perigoso é sinalizado antes de ser executado, e um comum não) responde a cada `tool.call` a partir de um hook com `{ result: {} }`, para que nenhum comando chegue a um shell, e lê a linha de comentário enviada à janela flutuante no momento em que cada chamada chega. Ele espera os quatro avisos para quatro comandos destrutivos, e nenhum aviso para um push comum. "tests that pass are cheered, and failing ones are noticed until they pass again" (os testes que passam são comemorados, e os que falham são notados até voltarem a passar) cobre a comemoração, a falha e a recuperação.

## Para ir além

- `describeCall` em `hooks/words.ts` monta o detalhe da faixa para cada ferramenta (o nome de um arquivo, a primeira linha de um comando); as reações reaproveitam o mesmo detalhe.
- `gainXp($, 'tests')` soma os 5 pontos; `hooks/xp.ts` guarda as quantidades e os níveis.
- As falhas que este hook registra (`seen.failures`) fazem parte do que as dicas do guia 11 enviam ao modelo.
- `DANGEROUS_COMMANDS` é fácil de estender: um nome e um padrão por linha. Mantenha cada padrão dentro de um único comando com `[^|;&\n]`, como fazem os existentes.
