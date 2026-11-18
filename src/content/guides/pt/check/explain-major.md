---
title: Explicar uma versão major com o Haiku
description: 'Como o Narsil Check pergunta ao Haiku o quanto uma major é difícil para este projeto, a partir das notas de versão e das linhas que importam a biblioteca, e como impede o modelo de inventar.'
route: check
order: 11
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/explain.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/words.ts
  - repo: check
    path: hooks/adapter.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/upgrade.test.tsx
  - repo: check
    path: odd/tasks/ecosystems-wave-2.md
---

## O que faz

Uma versão major diz "algo pode quebrar". Ela não diz se quebra para você. O React 19 removeu várias APIs antigas; se o seu projeto nunca as usou, a atualização é pequena. Para saber, você abriria as notas de versão, depois procuraria no seu código cada lugar que importa a biblioteca, e compararia.

O Narsil Check faz essa comparação para cada biblioteca do grupo **Versión mayor: revisar cambios** ("Versão major: revisar as mudanças"). Abaixo de cada linha, enquanto trabalha, uma linha esmaecida diz `Analizando con Haiku…` ("Analisando com o Haiku…"). Depois ela mostra uma dificuldade e uma ou duas frases:

```text
react 18.2.0 → 19.2.0
  Dificultad media: React 19 quita propTypes; tus 2 imports no los usan, pero revisa las refs de texto.
```

Isso diz "Dificuldade média: o React 19 remove propTypes; os seus 2 imports não os usam, mas revise as refs de texto." O exemplo é o que os testes usam. A linha fica verde para `baja` (baixa), amarela para `media` (média) e vermelha para `alta` (alta).

Um clique na linha copia o salto com a sua dificuldade e o seu motivo, pronto para colar numa issue ou num prompt. O motivo é pedido uma vez por salto e guardado, então ele está lá de novo na próxima sessão sem custo.

## Como funciona por dentro

`hooks/explain.ts` contém as partes simples (quais versões quebram, o prompt, a leitura da resposta). `hooks/register.tsx` faz as buscas, roda `git grep` e chama o modelo. Essa divisão permite que os testes confiram o prompt e a interpretação como funções puras.

### Quando roda

Quando uma varredura termina, `scanProject` mostra a lista na hora e inicia `explainMajors` sem esperar por ela. Só as atualizações do grupo `review` são lidas: uma major que algo bloqueia está em **Bloqueada** e mostra os seus motivos de bloqueio no lugar. Duas são lidas de cada vez (`EXPLAIN_CONCURRENCY`), então uma lista de vinte majors não dispara vinte chamadas ao modelo juntas. Uma linha já concluída ou em andamento é pulada.

### A primeira entrada: as notas de versão das versões que quebram

`breakingVersions(current, latest)` nomeia as versões que quebram entre as duas, da mais nova para a mais antiga e no máximo três: o `x.0.0` de cada nova major (de 16 para 19: `19.0.0`, `18.0.0`, `17.0.0`) ou, abaixo de 1.0.0, o `0.y.0` de cada nova minor. As notas das versões de patch intermediárias ficam de fora de propósito: as mudanças que quebram compatibilidade são anunciadas na versão que quebra.

`releaseNotes` então encontra o repositório da biblioteca no GitHub. Para o npm, ele lê o campo `repository` do `node_modules/<name>/package.json` instalado; senão, o da resposta do registro; os outros ecossistemas o fornecem pelo seu adaptador (`repoUrlOf`, `infoUrl` ou `repoUrlFor`). Para cada versão que quebra, ele tenta três nomes de tag na API de releases do GitHub, já que os pacotes usam tags de formas diferentes: `v19.0.0`, `@scope/name@19.0.0` para um monorepo ou o simples `19.0.0`.

As notas de cada versão são cortadas em 6.000 caracteres, e o total de todas em 12.000 (`NOTES_PER_RELEASE`, `NOTES_TOTAL`), com `[…]` onde algo foi cortado. O comentário diz por que o limite por versão existe: "so a long upgrade guide still leaves room" (para que um guia de atualização longo ainda deixe espaço) para as outras versões.

Quando nenhuma versão tem notas e o pacote é do npm, o mod lê o `CHANGELOG.md` do pacote no unpkg e fica só com o que está acima do título da versão instalada: o que mudou desde então. O unpkg serve só pacotes npm, então os outros ecossistemas não têm alternativa.

### A segunda entrada: como o projeto a usa

`usageOf` executa:

```text
git --no-pager grep -n -I -E <pattern> -- . :!node_modules
```

O padrão vem do `importPattern` do adaptador. Para o npm, ele reconhece `from 'name'`, `from 'name/sub'`, `require('name')` e `import('name')`; o Python reconhece linhas `import` e `from` com o nome do módulo (`yaml` para o PyYAML); cada ecossistema tem o seu. O resultado é o número de arquivos e no máximo 40 linhas de no máximo 200 caracteres, cada uma como `path:line:text`.

Usa-se `git grep`, e não um percurso pelos arquivos, porque ele busca só arquivos rastreados, pula binários com `-I` e é rápido num repositório grande.

### O prompt exato

O prompt de sistema é `SYSTEM` em `hooks/explain.ts`, citado como está no [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Ele não mudou desde o primeiro commit.

```text
You assess how hard a major dependency upgrade is for one specific project.
You get the release notes of the breaking versions and the lines where the project imports the library.
Answer in Spanish, in exactly this form:
DIFICULTAD: baja|media|alta
RAZÓN: one or two sentences, at most 280 characters, naming the concrete breaking change that affects the imports shown, or saying none of them is touched.
Base the answer only on what you are given. Never invent APIs, versions or changes.
If the release notes are missing, say so in the reason and judge only from how much the project uses the library.
```

Tradução para o português: "Você avalia o quanto uma atualização major de dependência é difícil para um projeto específico. Você recebe as notas de versão das versões que quebram compatibilidade e as linhas em que o projeto importa a biblioteca. Responda em espanhol, exatamente nesta forma: DIFICULTAD: baja|media|alta; RAZÓN: uma ou duas frases, no máximo 280 caracteres, nomeando a mudança concreta que quebra compatibilidade e afeta os imports mostrados, ou dizendo que nenhum deles é afetado. Baseie a resposta só no que você recebe. Nunca invente APIs, versões ou mudanças. Se as notas de versão estiverem ausentes, diga isso no motivo e julgue só pelo quanto o projeto usa a biblioteca."

Ele é escrito em inglês, com os rótulos da resposta em espanhol porque o painel fala espanhol: `DIFICULTAD: baja|media|alta` é "DIFICULDADE: baixa|média|alta", e `RAZÓN` é "MOTIVO".

A mensagem do usuário é montada por `prompt(u, notes, usage)`, também em `hooks/explain.ts`:

```text
Library: react
Upgrade: 18.2.0 -> 19.2.0

The project imports it in 2 files:
src/App.tsx:1:import { useState } from 'react'
src/main.tsx:2:import React from 'react'

Release notes of the breaking versions:
## v19.0.0
…
```

Tradução para o português dos rótulos: "Biblioteca", "Atualização", "O projeto a importa em 2 arquivos" e "Notas de versão das versões que quebram compatibilidade".

Sem imports encontrados, as linhas são substituídas por "(no imports found: it may be used through config or a CLI)" (nenhum import encontrado: pode ser usada por configuração ou por uma CLI). Sem notas, a última parte diz "(none found)" (nenhuma encontrada).

### Como ele impede o modelo de inventar

Um modelo a quem se pergunta "o quanto o React 19 é difícil?" vai responder com o que lembra, o que pode estar errado ou ser mais antigo que a versão. Quatro escolhas do design trabalham contra isso:

- **Ele recebe as evidências.** As notas e as linhas de import estão na mensagem; o modelo não precisa lembrar de nenhuma das duas.
- **Ele é instruído a usar só isso.** "Base the answer only on what you are given. Never invent APIs, versions or changes." (baseie a resposta só no que você recebe; nunca invente APIs, versões ou mudanças).
- **Ele tem uma saída honesta.** Sem notas, ele deve dizer isso e julgar pelo quanto o projeto usa a biblioteca, em vez de preencher a lacuna.
- **A resposta tem uma forma fixa.** `parseReason` aceita uma resposta só quando ela tem tanto `DIFICULTAD:` com uma das três palavras quanto `RAZÓN:` com texto. Qualquer outra coisa é descartada, e a linha diz "Haiku no dio una razón; revisa las notas de la versión." ("O Haiku não deu um motivo; revise as notas da versão"). O motivo é cortado em 400 caracteres, então uma resposta descontrolada não consegue encher o painel.

Nada disso prova que o motivo está certo; torna-o verificável. O painel mostra o que o Haiku concluiu e nomeia a mudança que quebra compatibilidade, então você pode abrir as mesmas notas de versão e conferir.

### Chamar o Haiku: `$.model.complete`

```ts
const reply = await $.model.complete({
  model: 'haiku',
  system: SYSTEM,
  prompt: prompt(u, notes, usage),
  maxTokens: 400,
  timeoutMs: EXPLAIN_MS,
})
const reason = reply.isAnswered ? parseReason(reply.text) : undefined
```

Citado de `hooks/register.tsx` do [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later), com outra formatação. `EXPLAIN_MS` é de 60 segundos.

Os tipos da 2.1.325 descrevem `$.model.complete` como "one text completion through the session's own API client" (uma conclusão de texto pelo próprio cliente de API da sessão), com "No tools, no history, no system prompt beyond the CLI's identity block and `request.system`" (sem ferramentas, sem histórico, sem prompt de sistema além do bloco de identidade da CLI e de `request.system`). Então o Haiku vê só esta mensagem, nada da sua conversa. `model` aceita um alias como `haiku`, "resolved and allowlist-checked like a `--model` value" (resolvido e conferido contra a lista de permitidos como um valor de `--model`). O resultado nunca é rejeitado pelo que o provedor fez: ele diz `isAnswered` ou dá um `reason` (`api-error`, `empty-reply`, `aborted`), e o mod trata todos eles como "sem motivo". Uma exceção durante a etapa inteira mostra "No pude analizar esta actualización." ("Não consegui analisar esta atualização.").

Uma boa resposta é gravada em `$.store` sob `why:<name>@<current>-><latest>` e guardada para sempre: as notas de uma versão publicada não mudam. Uma resposta que falhou não é guardada, então a próxima varredura tenta de novo.

### Custo

Os tipos dizem que uma requisição respondida "counts toward the session's cost total, `/cost` and the cost and token metrics" (conta para o custo total da sessão, para `/cost` e para as métricas de custo e de tokens), e que "Nothing caps it per call" (nada a limita por chamada). O mod a limita por conta própria: no máximo 400 tokens de saída e uma entrada de no máximo 12.000 caracteres de notas mais 40 linhas curtas. Cada salto é pedido uma única vez, para sempre, naquela máquina. Uma longa lista de majors custa uma vez; as próximas sessões leem o armazenamento.

### Privacidade

O que sai da sua máquina, e para onde:

- **Para o provedor do modelo** (pelo próprio cliente da sessão): o nome da biblioteca, as duas versões e até 40 linhas de import do seu código com os caminhos dos arquivos. Não o resto dos seus arquivos.
- **Para a API do GitHub e o unpkg**: o nome do pacote e as versões, para buscar notas públicas. O README menciona o limite do GitHub sem autenticação, 60 requisições por hora; quando ele se esgota, a análise usa o `CHANGELOG.md` ou diz que não encontrou notas.

As linhas de import costumam ser inofensivas, mas são o seu código. Um mod que lê majors de pacotes privados deve ter isso em mente.

### O README e o código

O README diz "Si no hay release, se usa el `CHANGELOG.md` del paquete" ("Se não houver release, usa-se o `CHANGELOG.md` do pacote"), sem limitação. No código, essa alternativa é só para o npm, porque passa pelo unpkg.

## Construa com o Claude

Peça ao Claude que envie ao Haiku as notas de versão de uma atualização major e as linhas de import do projeto, e que mostre quão difícil é o salto. A única ideia que ele precisa acertar é que o Haiku responde só a partir das evidências que recebe, numa forma fixa que o mod consegue conferir.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No meu mod do Claude Code `my-panel`, abaixo de cada biblioteca npm com uma atualização major, mostre o quanto o salto é difícil para este projeto. Para cada uma, encontre o seu repositório no GitHub a partir do campo `repository` de `node_modules/<name>/package.json`, busque com `$.http.fetch` as notas de versão do `x.0.0` de cada nova major (no máximo três, tags `v<version>`, `<name>@<version>` ou `<version>`) e corte-as em 12.000 caracteres. Encontre as linhas de import com `$.process.run(['git', '--no-pager', 'grep', '-n', '-I', '-E', pattern, '--', '.', ':!node_modules'])`, no máximo 40. Chame `$.model.complete` com `model: 'haiku'`, `maxTokens: 400`, um `timeoutMs` de 60 segundos e um prompt de sistema que peça exatamente `DIFFICULTY: low|medium|high` e `REASON:` em no máximo 280 caracteres, baseado só no que recebe, sem nunca inventar APIs, e dizendo isso quando as notas estiverem ausentes. Aceite a resposta só se as duas linhas puderem ser interpretadas. Guarde-a em `$.store` sob `why:<name>@<from>-><to>` para sempre. Mostre "Analisando…" enquanto roda. Teste com `on('model.complete', ...)` que o prompt contém as notas e uma linha de import, e que uma resposta sem a forma mostra uma linha alternativa.

### O que conferir na resposta do Claude

1. A mensagem enviada a `$.model.complete` contém as notas de versão das versões que quebram e as linhas de import, cortadas nos seus limites: 12.000 caracteres de notas e no máximo 40 linhas.
2. O prompt de sistema diz ao modelo que baseie a resposta só no que recebe, que nunca invente APIs e que diga isso quando as notas faltarem.
3. Uma resposta só é aceita quando a linha de dificuldade e a linha de motivo são lidas. Qualquer outra coisa mostra uma linha alternativa e não é guardada.
4. Um motivo válido é guardado em `$.store` sob uma chave com o nome e as duas versões, então o mesmo salto nunca é perguntado de novo. Um que falhou é perguntado de novo na próxima varredura.
5. A varredura não espera pelos motivos: a lista aparece na hora, com "Analisando…" abaixo de cada major até o seu motivo chegar.

Se uma verificação falhar, diga ao Claude o que você vê: "o Haiku cita uma API que o meu projeto nunca importa, e o prompt não tem nenhuma linha de import".

### Como a pessoa autora pediu

O pedido original deste recurso não foi registrado: ele já está no primeiro commit, e nenhum registro de tarefas público cobre a sua criação. Um registro de tarefas posterior registra como ele foi levado aos outros ecossistemas, com as palavras do agente.

#### Registrado num registro de tarefas

`odd/tasks/ecosystems-wave-2.md` lista, como spec S5, o que tinha que continuar funcionando quando o segundo grupo de ecossistemas foi adicionado. Esta é a spec do agente, não as palavras da pessoa autora:

> "Haiku's reason for a major upgrade works for every ecosystem: release notes from the repository each registry records, and the project's imports found with git grep."

Tradução para o português: "O motivo do Haiku para uma atualização major funciona em todos os ecossistemas: notas de versão do repositório que cada registro anota, e os imports do projeto encontrados com git grep."

O S3 do mesmo arquivo lista "Haiku reasons" (os motivos do Haiku) entre os comportamentos que tinham que ficar inalterados.

#### Reconstrução a partir do histórico de commits

A partir de `git log -- hooks/explain.ts` e `git log -S SYSTEM` no narsil-check:

- `1bf736a` (2026-11-04) "feat: add upgrade panel for npm and Expo projects" (adicionar um painel de atualizações para projetos npm e Expo). A sua mensagem descreve "majors with Haiku's reading of the release notes against the project's imports" (majors com a leitura do Haiku das notas de versão contra os imports do projeto). `SYSTEM`, `prompt`, `parseReason`, `breakingVersions` e o cache `why:` já estão todos aqui, como estão agora.
- `a95eb07` (2026-11-04) "refactor: read dependencies through an adapter per ecosystem" (ler as dependências por meio de um adaptador por ecossistema). Cada adaptador recebe o seu próprio `importPattern` e `repoUrlOf`, que é como o motivo chega aos outros ecossistemas.
- `c50e830` (2026-11-04) "feat: find manifests anywhere in the tree and read four-part versions" (encontrar manifests em qualquer lugar da árvore e ler versões de quatro partes). A sua mensagem: "infoUrl gives release notes a version's own record" (infoUrl dá às notas de versão o registro próprio de uma versão), para registros cuja resposta de latest não nomeia nenhum repositório.
- `b3ad055` (2026-11-06) "feat: fold upgrade and vulnerability groups, copy a row on click, …" (recolher os grupos de atualizações e de vulnerabilidades, copiar uma linha com um clique, …). Um clique numa linha a copia com o motivo do Haiku, substituindo os botões de cópia.

O próprio prompt nunca mudou. O que cresceu foi a origem das notas e do uso.

## Código de referência

Esta é uma resposta correta, escrita para este guia. Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

Esta é uma versão reduzida da ideia, escrita para este guia e conferida com os tipos do Claude Code 2.1.325 (`$.model.complete`, `$.store.get`, `$.store.set`). Foi adaptada de `hooks/explain.ts` e `hooks/register.tsx` do [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). As notas e as linhas de import são passadas como parâmetros; como buscá-las está mostrado acima.

```ts
import type { EngineInterface } from 'claude-code'

export type Reason = { difficulty: 'low' | 'medium' | 'high'; text: string }

const SYSTEM = [
  'You assess how hard a major dependency upgrade is for one specific project.',
  'You get the release notes of the breaking versions and the lines where the project imports the library.',
  'Answer in exactly this form:',
  'DIFFICULTY: low|medium|high',
  'REASON: one or two sentences, at most 280 characters.',
  'Base the answer only on what you are given. Never invent APIs, versions or changes.',
  'If the release notes are missing, say so and judge only from how much the project uses the library.',
].join('\n')

export function parseReason(text: string): Reason | undefined {
  const difficulty = /DIFFICULTY:\s*(low|medium|high)/i.exec(text)?.[1]?.toLowerCase()
  const reason = /REASON:\s*([\s\S]+)/i.exec(text)?.[1]?.trim()
  if (!difficulty || !reason) return undefined
  return {
    difficulty: difficulty as Reason['difficulty'],
    text: reason.replace(/\s+/g, ' ').slice(0, 400),
  }
}

export async function explain(
  $: EngineInterface,
  u: { name: string; current: string; latest: string },
  notes: string,
  lines: string[],
): Promise<Reason | undefined> {
  const key = `why:${u.name}@${u.current}->${u.latest}`
  const stored = (await $.store.get(key)) as Reason | undefined
  if (stored) return stored
  const prompt = [
    `Library: ${u.name}`,
    `Upgrade: ${u.current} -> ${u.latest}`,
    '',
    'Import lines:',
    lines.length > 0 ? lines.join('\n') : '(no imports found)',
    '',
    'Release notes of the breaking versions:',
    notes.trim() || '(none found)',
  ].join('\n')
  const reply = await $.model.complete({
    model: 'haiku',
    system: SYSTEM,
    prompt,
    maxTokens: 400,
    timeoutMs: 60_000,
  })
  const reason = reply.isAnswered ? parseReason(reply.text) : undefined
  if (reason) await $.store.set(key, reason)
  return reason
}
```

Rode `explain` a partir de uma varredura que nenhum hook aguarda, guarde cada resultado num atom por chave, com um estado `loading` primeiro, e desenhe a linha abaixo da linha da biblioteca a partir desse atom. Um resultado `undefined` é a sua linha alternativa, e ele não é guardado.

## Erros comuns e como testar

Estes vêm do código e dos testes do Narsil Check:

- **Perguntar sem evidências.** Um modelo com só um nome e duas versões responde de memória. Envie as notas e o uso.
- **Nenhuma forma de dizer "não sei".** Sem a regra das notas ausentes, o modelo preenche a lacuna. Dê a ele a resposta honesta.
- **Confiar em texto livre.** Interprete uma forma fixa e descarte o que não corresponde; corte o tamanho.
- **Perguntar de novo a cada sessão.** As notas de uma versão não mudam; guarde o motivo para sempre e não guarde as falhas.
- **Aguardá-lo na varredura.** A lista deve aparecer na hora; os motivos chegam depois.
- **Disparar todas as chamadas de uma vez.** Limite a concorrência; duas bastam para um painel lateral.
- **Enviar demais.** Limite as notas e as linhas. Isso limita o custo e o quanto do seu código sai da máquina.

Para testar, `claude plugin test .` executa `tests/upgrade.test.tsx`, que responde ao modelo com `on('model.complete', ...)`, então nenhuma requisição real é feita. "each major shows the reason Haiku gives from the release notes and the imports, and a press on it copies it" (cada major mostra o motivo que o Haiku dá a partir das notas de versão e dos imports, e um clique nele o copia) confere que o prompt contém o corpo da release, uma linha de import e "in 2 files" (em 2 arquivos), depois encontra a linha "Dificultad media: …" e o texto copiado. "a major read before is not asked again" (uma major lida antes não é perguntada de novo) coloca primeiro um motivo no armazenamento e conta as chamadas ao modelo. "Haiku's answer is read as a difficulty and a reason" (a resposta do Haiku é lida como uma dificuldade e um motivo) e "a changelog is cut where the installed version begins" (um changelog é cortado onde a versão instalada começa) testam as funções puras.

## Para ir além

- O motivo tem como chave o nome e as versões, não o ecossistema. Dois ecossistemas com um pacote de mesmo nome e o mesmo salto o compartilhariam; adicionar o ecossistema à chave os separaria.
- O motivo não muda quando o seu código muda. Se você começar a usar uma API que a próxima major remove, o motivo guardado não vai saber. Uma chave que inclua um hash das linhas de import perguntaria de novo quando elas mudassem.
- O próximo guia é a outra ponta da lista: as atualizações que não pedem leitura nenhuma, e o botão que as sobe.
