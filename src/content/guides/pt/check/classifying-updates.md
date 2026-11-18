---
title: Classificar as atualizações
description: 'Como o Narsil Check separa cada biblioteca desatualizada em Bloqueada, Versão major, Só subir a versão ou Fora do Expo SDK, e por que guarda as respostas dos registros por seis horas.'
route: check
order: 7
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/semver.ts
  - repo: check
    path: hooks/npm.ts
  - repo: check
    path: hooks/words.ts
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/upgrade.test.tsx
  - repo: check
    path: odd/tasks/release-age-all-ecosystems.md
---

## O que faz

Uma lista de cinquenta bibliotecas desatualizadas não é útil por si só. O que você quer saber é quais pode subir agora sem pensar, quais pedem leitura e quais ainda não deve tocar. A seção **Actualizaciones** responde a isso colocando cada biblioteca desatualizada num de quatro grupos, desenhados nesta ordem:

| Grupo (rótulo no painel)         | Em português                      | Dica abaixo do cabeçalho                        | Cor      |
| -------------------------------- | --------------------------------- | ----------------------------------------------- | -------- |
| `Fuera del SDK de Expo`          | Fora do Expo SDK                  | `npx expo install --fix`                        | azul     |
| `Bloqueada`                      | Bloqueada                         | `no se puede subir sola: el motivo está debajo` | vermelho |
| `Versión mayor: revisar cambios` | Versão major: revisar as mudanças | `pueden romper la API`                          | amarelo  |
| `Solo subir la versión`          | Só subir a versão                 | `parche o menor`                                | verde    |

As dicas significam "não pode subir sozinha: o motivo está abaixo", "podem quebrar a API" e "patch ou minor". Os rótulos e as dicas vêm de `GROUPS` em `hooks/words.ts`.

Cada grupo tem um cabeçalho que o recolhe, como `▾ Bloqueada (2)`, e o painel lembra quais você fechou. Abaixo de cada linha há uma segunda linha onde isso importa: em **Bloqueada**, tudo o que a bloqueia, em vermelho; em **Versión mayor**, a leitura do Haiku sobre o quanto o salto é difícil. Só **Solo subir la versión** tem um botão, **Actualizar las N** ("Atualizar as N"), e ele nunca pega uma biblioteca de outro grupo.

As bibliotecas que estão em dia não aparecem. A linha abaixo do cabeçalho da seção conta o resto, na ordem dos grupos:

```text
6 para actualizar de 31 · 2 bloqueadas · 2 mayores · 2 triviales
```

Isso é "6 para atualizar de 31 · 2 bloqueadas · 2 major · 2 triviais". Sem nada a fazer, ela diz `Todo al día · 31 librerías revisadas` ("Tudo em dia · 31 bibliotecas revisadas").

O ponto colorido da seção diz qual é o grupo mais urgente presente: vermelho se algo está bloqueado; senão, amarelo para uma major; senão, azul para o Expo; senão, verde.

## Como funciona por dentro

### O tipo: quatro grupos e uma lista de motivos

`types/index.d.ts` define o grupo como uma união, `'bump' | 'review' | 'expo' | 'blocked'`, e cada `Upgrade` carrega um, com o seu `bump` (`'patch' | 'minor' | 'major'`) e `conflicts: string[]`. Os comentários em `Group` ainda dizem que `blocked` é só para uma dependência peer; o código e o README agora lhe dão mais motivos (abaixo).

O design separa duas perguntas. `bump` é a distância entre as versões, um fato. `group` é o que a pessoa deve fazer, uma decisão que pode mudar à medida que se sabe mais. Um patch pode ser `blocked`; uma major é `review`, a menos que algo a bloqueie.

### Passo 1: qual é o tamanho do salto

Todo ecossistema começa da mesma forma, com `bumpOf(installed, latest)` de `hooks/semver.ts`:

```ts
export function bumpOf(from: Version, to: Version): Bump {
  if (compare(to, from) <= 0) return 'none'
  if (to.major !== from.major) return 'major'
  if (to.minor !== from.minor) return from.major === 0 ? 'major' : 'minor'
  if (to.patch !== from.patch) return from.major === 0 && from.minor === 0 ? 'major' : 'patch'
  return 'patch'
}
```

Ele é citado do [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). `none` significa em dia (ou que o latest do registro é mais antigo que o que você tem), e a biblioteca fica de fora. Nos demais casos, `major` vai para `review` e `patch` ou `minor` para `bump`.

### Versões abaixo de 1.0.0

As duas linhas do meio carregam a regra que o comentário declara: "Below 1.0.0 a minor is a breaking change (0.3 -> 0.4) and below 0.1.0 so is a patch, as npm's caret ranges treat them." (abaixo de 1.0.0, uma minor é uma mudança que quebra compatibilidade, 0.3 -> 0.4, e abaixo de 0.1.0 um patch também é, como os intervalos com circunflexo do npm os tratam).

Isso segue a própria convenção do versionamento semântico de que 0.x é instável, e o `^` do npm a lê da mesma forma: `^0.3.2` aceita `0.3.9`, mas não `0.4.0`, e `^0.0.3` não aceita nada além de `0.0.3`. Se o painel chamasse de minor a passagem de 0.3 para 0.4, o botão de atualização subiria por cima de uma mudança que a própria pessoa autora do pacote marcou como incompatível. Os testes fixam os três casos: `0.3.1 → 0.4.0` é major, `0.3.1 → 0.3.2` é um patch, `0.0.3 → 0.0.4` é major.

O README declara só a primeira metade: "un salto de minor por debajo de 1.0.0" ("um salto de minor abaixo de 1.0.0"). A regra do patch abaixo de 0.1.0 está no código e nos testes, não no README.

`bumpOf` é compartilhado, então a regra vale para todo ecossistema, inclusive aqueles cujas próprias ferramentas leem 0.x de outra forma.

### Passo 2: o npm e o Expo SDK

Um app Expo fixa os módulos nativos contra os quais cada SDK é construído, em `bundledNativeModules.json`. Instalar um mais novo do que essa tabela permite quebra o build nativo, então num projeto Expo "the table wins over npm" (a tabela vence o npm). `upgradeOf` em `hooks/npm.ts` a confere antes de qualquer outra coisa:

- **A versão instalada está fora do intervalo do SDK**: a atualização vai para `expo`, com o intervalo do SDK como alvo. Esse é o grupo **Fuera del SDK de Expo**, e a sua dica é o comando que o corrige.
- **A versão instalada está dentro do intervalo, e o npm tem uma mais nova**: a resposta é `'held'`, não uma atualização. Ela é contada, não listada, e uma nota diz que essas bibliotecas "tienen versión nueva en npm, pero el SDK de Expo la fija: se suben con el SDK" ("têm versão nova no npm, mas o Expo SDK a fixa: elas sobem com o SDK").

A tabela vem de `node_modules/expo/bundledNativeModules.json` quando instalado; senão, de `https://unpkg.com/expo@<version>/bundledNativeModules.json` para a versão do Expo instalada. O próprio pacote `expo` nunca é julgado pela sua própria tabela.

### Passo 3: qualquer coisa que a bloqueie

Por último, qualquer atualização que tenha um motivo para não subir sozinha passa para `blocked`, seja qual for o seu salto. Os motivos são guardados como palavras em `conflicts`, e essas palavras são o que o painel imprime abaixo da linha.

Para o npm (`scanNpm`), os motivos são as dependências peer e os pins do próximo guia, mais a espera de 24 horas. Para todos os outros ecossistemas (`scanGeneric`):

- **Um comentário que segura a versão de propósito**, encontrado por `holdNote`: `Fijada a propósito: «…»` ("Fixada de propósito"), com o próprio comentário.
- **O que o ecossistema sabe que quebra**, a partir do `conflictsOf` do adaptador: o Kotlin e os seus plugins de compilador, o Android Gradle Plugin e o Gradle wrapper, um pacote Swift fixado numa única versão exata.
- **A espera de 24 horas**: uma versão publicada há menos de um dia, como `Publicada hace 3 h: Narsil Check espera 24 h antes de subirla` ("Publicada há 3 h: o Narsil Check espera 24 h antes de subi-la").

A espera também cobre o grupo do Expo: a versão para a qual o intervalo do SDK resolve é segurada pelo mesmo dia, e uma atualização do Expo que ainda espera passa para `blocked` com o comando no seu motivo.

A ordem importa por um motivo: `blocked` é decidido por último, então ele se sobrepõe a tudo. Um patch trivial que um plugin recusa não é trivial.

### Onde é desenhado

O hook `ui.render` desenha `GROUPS` em ordem, filtrando `state.upgrades` por `u.group`; dentro de um grupo, uma atualização que corrige vulnerabilidades conhecidas vem primeiro. A segunda linha de uma linha bloqueada é `u.conflicts.join(' · ')` em vermelho. `sortUpgrades` ordena a lista por grupo, depois as dependencies antes das devDependencies, depois por nome.

### O cache de seis horas

Consultar todos os registros para todas as bibliotecas a cada início de sessão seria lento e colocaria uma carga real sobre registros públicos para respostas que raramente mudam. `latestIn` em `hooks/register.tsx` guarda cada resposta:

```ts
// A registry answer is reused for this long, across sessions and projects.
const CACHE_MS = 6 * 60 * 60 * 1000
```

Tradução do comentário para o português: uma resposta do registro é reutilizada por este tempo, entre sessões e projetos.

```ts
const key = `${adapter.id}:${name}`
const cached = (await $.store.get(key)) as Cached | undefined
if (!isFresh && cached && Date.now() - cached.at < CACHE_MS) return cached.version
```

Os dois são citados do [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Depois de uma busca, a resposta é gravada de volta com `$.store.set(key, { version, at: Date.now() })`.

**Onde é guardado.** `$.store` é, nas palavras dos tipos da 2.1.325, "This plugin's own key-value store, kept between sessions and hot reloads" (o armazenamento de chave e valor do próprio plugin, mantido entre sessões e recargas a quente), "A JSON file of the plugin's own under the user's Claude Code configuration directory" (um arquivo JSON do próprio plugin no diretório de configuração do Claude Code do usuário). É por isso que o comentário diz "across sessions and projects" (entre sessões e projetos): a chave é o ecossistema e o nome do pacote (`npm:react`), não o projeto, então um segundo projeto que usa react reutiliza a resposta. Os tipos também dizem que `set` rejeita "a store over 4 MiB of JSON text in all" (um armazenamento com mais de 4 MiB de texto JSON no total), um limite que todas as chaves do mod compartilham.

**Quando é pulado.** `isFresh` é ativado por **Revisar de nuevo** ("Revisar de novo"), por `/narsil-check upgrade`, depois do botão de atualização, depois do botão de pull request e depois de um pull bem-sucedido do branch. Uma varredura nova consulta todos os registros de novo e grava as respostas novas. A varredura no início da sessão não é nova, então ela usa o que tem menos de seis horas. O README diz o mesmo: "Cada respuesta se guarda 6 horas, y el botón **Revisar de nuevo** fuerza una consulta nueva" ("Cada resposta é guardada por 6 horas, e o botão **Revisar de nuevo** força uma consulta nova").

**Por que seis horas.** Nem o código, nem o README, nem os commits dão um motivo para o número; `CACHE_MS` é de seis horas desde o primeiro commit, `1bf736a`. Lendo o equilíbrio: um cache mais curto consultaria todos os registros em quase todo início de sessão, e um mais longo esconderia uma versão durante a maior parte de um dia de trabalho. Seis horas é menos que a espera de 24 horas, então uma versão que o cache esconde por um tempo não poderia ter subido de qualquer forma nesse período. Esse raciocínio é uma interpretação, não uma decisão registrada.

**O que é guardado para sempre no lugar.** Algumas respostas nunca mudam depois que uma versão é publicada, então o mod as guarda sem temporizador: as dependências peer de uma versão (`peers:<name>@<version>`), a sua data de publicação (`published:…`, só quando é uma data válida) e a leitura do Haiku sobre uma major (`why:…`).

## Construa com o Claude

Peça ao Claude que separe cada biblioteca desatualizada num grupo que diga o que você deve fazer com ela. A única ideia que ele precisa acertar é que o salto e a decisão são coisas separadas: `bump` diz a distância entre as versões, `group` diz o que fazer, e `blocked` é decidido por último.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No meu mod do Claude Code `my-panel`, tenho uma lista de bibliotecas npm desatualizadas, cada uma com a sua versão instalada e a mais nova. Separe-as em grupos: `blocked` (uma lista de motivos em palavras não está vazia), `review` (um salto de major), `bump` (um patch ou minor). Escreva `bumpOf(from, to)` como uma função pura: none, patch, minor ou major, em que abaixo de 1.0.0 uma minor conta como major e abaixo de 0.1.0 um patch também, como os intervalos com circunflexo do npm os leem. Decida `blocked` por último, para que ele se sobreponha aos outros. Desenhe os grupos na ordem blocked, review, bump, cada um com um cabeçalho recolhível `▾ Label (N)` e uma linha de dica, e os motivos abaixo de uma linha bloqueada em vermelho. Só o grupo bump recebe um botão "Atualizar tudo". Guarde cada resposta do registro em `$.store` sob `npm:<name>` com o horário, reutilize-a por seis horas e pule o cache quando a pessoa clicar em "Revisar de novo". Teste `bumpOf` com casos de 0.x e o cache com `mock.clock`.

### O que conferir na resposta do Claude

1. `bumpOf` é uma função pura que devolve none, patch, minor ou major, e uma biblioteca com none fica fora da lista.
2. Abaixo de 1.0.0 uma minor conta como major (`0.3.1 → 0.4.0`), e abaixo de 0.1.0 um patch também (`0.0.3 → 0.0.4`).
3. `blocked` é decidido por último, então uma atualização com qualquer motivo fica bloqueada seja qual for o seu salto, e os seus motivos são impressos abaixo dela em vermelho.
4. Só o grupo `bump` tem o botão "Atualizar tudo", e ele nunca pega uma biblioteca de outro grupo.
5. Cada resposta do registro é guardada em `$.store` sob `npm:<name>` com o horário, reutilizada por seis horas e pulada quando você clica em "Revisar de novo".

Se uma verificação falhar, diga ao Claude o que você vê: "um patch que um plugin recusa ainda aparece no grupo bump, e o botão o instalaria".

### Como a pessoa autora pediu

O pedido original dos quatro grupos não foi registrado: eles já estão no primeiro commit, e nenhum registro de tarefas público os cobre. Os motivos de **Bloqueada** cresceram depois, e um deles está registrado com as palavras da pessoa autora.

#### Registrado: a espera de 24 horas em todos os ecossistemas

`odd/tasks/release-age-all-ecosystems.md`, entrada de log L1 (2026-11-06), cita a pessoa autora. A primeira mensagem perguntava sobre frameworks além do Expo:

> "Y el cuánto a expo, pasa igual con frameworks como kmp o alguno de los otros lenguajes? Tenemos que pensar en ellos?"

Tradução para o português: "E quanto ao Expo, acontece o mesmo com frameworks como KMP ou alguma das outras linguagens? Temos que pensar neles?" Depois:

> "El primero me interesa, deberíamos implementar algo similar para los otros lenguajes, es más seguro"

Tradução para o português: "O primeiro me interessa; deveríamos implementar algo parecido para as outras linguagens, é mais seguro." E depois: "24 horas está perfecto" ("24 horas está perfeito").

O S4 do mesmo log cita uma regra anterior da pessoa autora, mantida de uma correção anterior:

> "siempre que haya minimumReleaseAge se bloquee la actualizacion automatica y se marque el bloqueo, sin excepcion alguna"

Tradução para o português: "sempre que houver um minimumReleaseAge, que a atualização automática seja bloqueada e o bloqueio seja marcado, sem exceção alguma." É por isso que nenhuma lista de exclusão conta em lugar nenhum, e por isso uma data que não pode ser lida também bloqueia.

Uma correção veio no mesmo dia. L7 cita a pergunta da pessoa autora:

> "que pasa si una version siempre trae fecha ilegible? nunca la vamos a actualizar?"

Tradução para o português: "o que acontece se uma versão sempre vem com data ilegível? nunca vamos atualizá-la?" O registro de tarefas anota a proposta aceita ("si hazlo asi", "sim, faça assim"): uma versão assim espera 24 horas a partir de quando o mod a viu pela primeira vez. Esse fallback e o resto do design são a proposta do agente, escrita no log; as palavras da pessoa autora são a pergunta e o "si".

#### Reconstrução a partir do histórico de commits

A partir de `git log -- hooks/semver.ts hooks/words.ts` e de `git log -S` sobre os rótulos dos grupos, no narsil-check:

- `1bf736a` (2026-11-04) "feat: add upgrade panel for npm and Expo projects" (adicionar um painel de atualizações para projetos npm e Expo). A sua mensagem: o painel "lists the project's outdated libraries by how hard each upgrade is" (lista as bibliotecas desatualizadas do projeto pelo quanto cada atualização é difícil). Os quatro grupos, `bumpOf` com a regra de 0.x e `CACHE_MS` já estão todos aqui. O grupo bloqueado tinha então o rótulo `Bloqueada por otras dependencias` ("Bloqueada por outras dependências"), com cores simples de terminal (vermelho, magenta, amarelo, verde).
- `4ea9be0` (2026-11-04) "feat: block upgrades kept on purpose and Kotlin past its compiler plugins" (bloquear atualizações seguradas de propósito e o Kotlin além dos seus plugins de compilador). A sua mensagem: "The blocked group is now just Bloqueada, since a dependency is no longer its only reason." (o grupo bloqueado agora é só Bloqueada, já que uma dependência não é mais o seu único motivo).
- `690c1bb` (2026-11-06) "feat: block upgrades pnpm would refuse under minimumReleaseAge" (bloquear atualizações que o pnpm recusaria sob minimumReleaseAge), depois `54ac6aa` (2026-11-06) "fix: block every upgrade under pnpm's minimumReleaseAge, with no exceptions" (bloquear toda atualização sob o minimumReleaseAge do pnpm, sem exceções).
- `1492ca5` (2026-11-06) "feat: hold every ecosystem's upgrades for 24 hours after release" (segurar as atualizações de todos os ecossistemas por 24 horas depois da publicação), e `ca13b3c` (2026-11-06) "feat: hold Expo SDK-pinned versions for 24 hours too" (segurar também por 24 horas as versões fixadas pelo Expo SDK).
- `54cd243` (2026-11-06) "feat: let a version with no readable date go up a day after it was first seen" (deixar uma versão sem data legível subir um dia depois de ter sido vista pela primeira vez). A correção de L7.

O padrão: os grupos estavam certos desde o início, e o que mudou foi o significado de **Bloqueada**, de "outra dependência a recusa" para "qualquer coisa que sabemos que torna inseguro subi-la sozinha".

## Código de referência

Esta é uma resposta correta, escrita para este guia. Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

Esta é uma versão reduzida da ideia, escrita para este guia e conferida com os tipos do Claude Code 2.1.325. Foi adaptada de `hooks/semver.ts`, `hooks/npm.ts` e `hooks/register.tsx` do [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Ela deixa de fora o Expo e os próprios motivos; `reasons` é o que as suas verificações encontraram.

```ts
import type { EngineInterface } from 'claude-code'

type V = { major: number; minor: number; patch: number }
export type Group = 'blocked' | 'review' | 'bump'

export function parse(text: string): V | undefined {
  const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(text.trim())
  return m ? { major: +m[1], minor: +(m[2] ?? 0), patch: +(m[3] ?? 0) } : undefined
}

export function bumpOf(from: V, to: V): 'none' | 'patch' | 'minor' | 'major' {
  const d = to.major - from.major || to.minor - from.minor || to.patch - from.patch
  if (d <= 0) return 'none'
  if (to.major !== from.major) return 'major'
  if (to.minor !== from.minor) return from.major === 0 ? 'major' : 'minor'
  return from.major === 0 && from.minor === 0 ? 'major' : 'patch'
}

export function groupOf(from: V, to: V, reasons: string[]): Group | undefined {
  const bump = bumpOf(from, to)
  if (bump === 'none') return undefined
  if (reasons.length > 0) return 'blocked'
  return bump === 'major' ? 'review' : 'bump'
}

const CACHE_MS = 6 * 60 * 60 * 1000
type Cached = { version: string; at: number }

export async function latest(
  $: EngineInterface,
  name: string,
  isFresh: boolean,
): Promise<string | undefined> {
  const key = `npm:${name}`
  const cached = (await $.store.get(key)) as Cached | undefined
  if (!isFresh && cached && Date.now() - cached.at < CACHE_MS) return cached.version
  const res = await $.http.fetch(`https://registry.npmjs.org/${name.replace('/', '%2F')}/latest`, {
    headers: { accept: 'application/json' },
  })
  const version = res.ok ? (JSON.parse(res.text) as { version?: string }).version : undefined
  if (version) await $.store.set(key, { version, at: Date.now() } satisfies Cached)
  return version
}
```

Chame `latest` para cada dependência declarada a partir de uma varredura que nenhum hook aguarda, depois `groupOf` com a versão instalada e os motivos que as suas verificações encontraram, e guarde a lista num atom. No painel, desenhe um bloco recolhível por grupo na ordem de `Group`, e o botão **Atualizar tudo** só abaixo de `bump`. O `parse` reduzido ignora prereleases e quartas partes, que `hooks/semver.ts` trata.

## Erros comuns e como testar

Estes vêm do código e dos commits do Narsil Check:

- **Misturar o salto com a decisão.** Mantenha `bump` (um fato) e `group` (o que fazer) separados, para que se continue sabendo que um patch bloqueado é um patch.
- **Decidir blocked primeiro.** Uma regra posterior que define `review` ou `bump` o desfaria. A varredura de npm do Narsil Check chega a repetir o laço até que nenhum grupo mude, porque bloquear uma atualização pode bloquear uma irmã.
- **Ler 0.x como 1.x.** `0.3 → 0.4` quebra compatibilidade. `0.0.3 → 0.0.4` também.
- **Uma linha bloqueada sem motivo.** O grupo diz "o motivo está abaixo"; uma linha vazia quebra essa promessa. Guarde os motivos como palavras.
- **Um botão que pega tudo.** Ele deve pegar só o grupo `bump`; o teste "a blocked upgrade shows what blocks it and the button leaves it out" (uma atualização bloqueada mostra o que a bloqueia, e o botão a deixa de fora) confere isso.
- **Fazer cache por projeto.** A versão mais nova de um pacote é a mesma em todo projeto. Use como chave o ecossistema e o nome.
- **Fazer cache com temporizador do que nunca muda.** Os peers e as datas de publicação de uma versão publicada podem ser guardados para sempre; as versões mais novas, não.
- **Fazer cache de lixo.** Só uma data válida é guardada para a espera de 24 horas, de modo que "the next scan asks again" (a próxima varredura pergunta de novo).

Para testar, `tests/upgrade.test.tsx` tem "the jump between two versions" (o salto entre duas versões, com os casos de 0.x), "each dependency lands in its group" (cada dependência cai no seu grupo), "the Expo SDK table wins over npm for the modules it pins" (a tabela do Expo SDK vence o npm para os módulos que ela fixa) e "the summary counts each group" (o resumo conta cada grupo). Os testes do painel usam `$.ui.mount` e `ui.press`: "a press on a library copies it, with no copy buttons, and each group folds on its own" (um clique numa biblioteca a copia, sem botões de cópia, e cada grupo se recolhe por conta própria). Os testes da idade de publicação, como "a version younger than minimumReleaseAge says how long it still waits" (uma versão mais nova que o minimumReleaseAge diz quanto tempo ainda espera) e "a version whose date nobody can read goes up a day after the mod first saw it, and an answer that is not a date is never kept" (uma versão cuja data ninguém consegue ler sobe um dia depois de o mod a ter visto pela primeira vez, e uma resposta que não é uma data nunca é guardada), cobrem os motivos de bloqueio com o tempo.

## Para ir além

- O próximo guia explica os motivos de bloqueio próprios do npm: os peers da nova versão, os peers do que está instalado e os pins exatos na árvore de dependências.
- A linha do Haiku abaixo de cada major é pedida uma vez por salto e guardada para sempre, então o seu custo não se repete.
- A constante de seis horas é uma linha. Um mod com menos bibliotecas poderia reduzi-la; um usado em muitos projetos grandes poderia aumentá-la.
