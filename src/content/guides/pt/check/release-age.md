---
title: A espera de 24 horas
description: 'Por que o Narsil Check nunca sobe uma versão publicada há menos de um dia, onde cada registro diz quando uma versão saiu e o que acontece quando ninguém sabe dizer.'
route: check
order: 10
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/npm.ts
  - repo: check
    path: hooks/adapter.ts
  - repo: check
    path: hooks/pypi.ts
  - repo: check
    path: hooks/cargo.ts
  - repo: check
    path: hooks/golang.ts
  - repo: check
    path: hooks/pub.ts
  - repo: check
    path: hooks/nuget.ts
  - repo: check
    path: hooks/rubygems.ts
  - repo: check
    path: hooks/maven.ts
  - repo: check
    path: hooks/swiftpm.ts
  - repo: check
    path: hooks/actions.ts
  - repo: check
    path: hooks/wrapper.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/release-age.test.tsx
  - repo: check
    path: tests/released.ts
  - repo: check
    path: odd/tasks/release-age-all-ecosystems.md
---

## O que faz

Uma versão publicada há uma hora não teve tempo de ser testada por ninguém. Se ela estiver quebrada, ou se tiver sido enviada a partir de uma conta de mantenedor comprometida, quem percebe primeiro são as pessoas que a instalaram primeiro. Registros e mantenedores retiram, sim, versões ruins, mas só depois que alguém percebe, e isso leva tempo.

O Narsil Check dá esse tempo a cada versão. Em todos os ecossistemas que ele lê, uma versão publicada há menos de 24 horas não sobe: ela cai no grupo **Bloqueada**, com o motivo abaixo da linha, em vermelho:

```text
Publicada hace 3 h: Narsil Check espera 24 h antes de subirla
```

Isso é "Publicada há 3 h: o Narsil Check espera 24 h antes de subi-la". O README dá o mesmo motivo com as suas próprias palavras: uma versão "que todavía nadie ha probado o que puede venir de una cuenta comprometida" ("que ninguém testou ainda ou que pode vir de uma conta comprometida") não entra no projeto sozinha.

Nada mais muda para você. A linha continua mostrando o salto, o botão **Actualizar las N** ("Atualizar as N") a deixa de fora, e a próxima varredura depois que o dia tiver passado a devolve ao seu grupo normal.

## Como funciona por dentro

A espera tem quatro partes: onde cada registro guarda a data, o que conta como prova quando não há data, como a regra própria de um projeto pnpm é lida e como a própria instalação é segurada pelo mesmo dia.

### De onde vem a data

Cada adaptador indica o endereço onde o seu registro responde "quando esta versão foi publicada" e como ler a data da resposta. São dois campos opcionais do contrato em `hooks/adapter.ts`:

- `releasedUrls(name, version)`: os endereços a tentar, em ordem.
- `releasedOf(text, headers)`: a data que uma resposta dá, a partir do corpo ou dos cabeçalhos em minúsculas.

O que cada adaptador lê, conforme o código:

| Ecossistema    | Onde está a data                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------- |
| npm e Expo     | o mapa `time` do packument; quando ele não chega, `pnpm view <name> time --json` ou o do npm    |
| PyPI           | `/pypi/<name>/<version>/json`: o `upload_time_iso_8601` mais antigo entre os arquivos da versão |
| Go             | o `/@v/<version>.info` do proxy: `Time`                                                         |
| Cargo          | crates.io `/api/v1/crates/<name>/<version>`: `version.created_at`                               |
| Pub            | pub.dev `/api/packages/<name>/versions/<version>`: `published`                                  |
| NuGet          | o registration do SemVer 1, depois o do SemVer 2: `published`                                   |
| RubyGems       | `/api/v2/rubygems/<name>/versions/<version>.json`: `created_at`                                 |
| Maven, Gradle  | o POM da versão, no seu próprio repositório e no Gradle Plugin Portal: `Last-Modified`          |
| SwiftPM        | a release do GitHub para a tag (`<tag>` ou `v<tag>`): `published_at`                            |
| GitHub Actions | o mesmo que o SwiftPM, pelo repositório da action                                               |
| Gradle wrapper | `services.gradle.org/versions/current`: `buildTime`                                             |

Duas escolhas dessa tabela valem a pena entender.

**O PyPI lê o arquivo mais antigo.** Uma versão pode receber mais arquivos depois (um wheel para uma nova plataforma). O comentário diz por que o primeiro é o que conta: "The earliest file of the release: when it became installable." (o arquivo mais antigo da versão: quando ela passou a ser instalável).

**O SwiftPM lê a release, não o commit.** A primeira versão lia a data do commit da tag. O verificador independente registrado no registro de tarefas apontou que uma data de committer "can be forged" (pode ser falsificada), e a correção passou para o `published_at` da release do GitHub, que o próprio GitHub define. O README o declara: "Es una fecha que pone GitHub, no la del commit, que el autor podría falsificar" ("É uma data que o GitHub define, não a do commit, que o autor poderia falsificar").

O npm é a exceção ao contrato: a sua busca de datas fica em `hooks/register.tsx` (`npmTimes`), porque o host não devolve um packument muito grande. O comentário cita os do astro e do tailwindcss, "~10 MB". Quando o packument não chega ou não tem a versão, o mod pergunta ao gerenciador de pacotes no lugar.

### Perguntar uma vez, guardar para sempre

`releasedAt` em `hooks/register.tsx` consulta esses endereços com `$.http.fetch` e guarda a resposta em `$.store` sob `published:<ecosystem>:<name>@<version>` (a chave do npm não tem a parte do ecossistema). Uma data de publicação nunca muda, então ela não tem temporizador, ao contrário do cache de seis horas das versões mais novas.

Só uma data válida é guardada. `dateOf` aceita uma string que `Date.parse` consiga ler e nada mais, então uma página de erro ou um campo vazio nunca é armazenado como data, e a próxima varredura pergunta de novo.

### Quando ninguém sabe dizer

Algumas versões não têm data legível: uma tag Swift sem release no GitHub, um pacote fora do GitHub, um registro que não responde. A regra que a pessoa autora definiu (citada abaixo) é que nada sobe sem prova de que esperou. Uma primeira versão dessa regra bloqueava essas versões para sempre, o que levantou a pergunta óbvia.

A resposta é `firstSeen`. Na primeira vez que o mod encontra uma versão sem data, ele grava o horário atual sob `seen:<ecosystem>:<name>@<version>`. Uma versão não pode ser mais nova do que o momento em que foi vista pela primeira vez, então 24 horas depois disso ela está publicada há pelo menos um dia. Enquanto isso, a linha diz:

```text
No pude leer cuándo se publicó y la vi por primera vez hace 3 h: Narsil Check espera 24 h antes de subirla
```

Isso é "Não consegui ler quando foi publicada e a vi pela primeira vez há 3 h: o Narsil Check espera 24 h antes de subi-la". Um horário guardado posterior ao momento atual é ignorado e substituído, então um relógio que voltou atrás não segura uma versão por mais tempo.

### A própria regra: `ageConflict`

`ageConflict` em `hooks/npm.ts` transforma uma data, o horário atual e uma espera em minutos num motivo ou em nada. É uma função pura, então os testes podem chamá-la com qualquer relógio. `RELEASE_AGE` é de 1440 minutos, "a day, as pnpm 11's minimumReleaseAge by default" (um dia, como o minimumReleaseAge do pnpm 11 por padrão), nas palavras do código.

`youngConflicts` a executa para cada atualização, oito de cada vez, antes de os grupos serem decididos. Os seus motivos se juntam aos outros motivos de bloqueio dos guias anteriores, e qualquer motivo manda a atualização para **Bloqueada**, seja qual for o seu salto.

### As versões do Expo também esperam

Uma atualização do Expo não é uma versão, mas um intervalo que `npx expo install --fix` resolve. `expoAgeConflict` pega a versão estável mais nova nos tempos do npm que atende ao intervalo do SDK e confere essa. Enquanto ela for nova demais, o motivo a nomeia, por exemplo "El SDK de Expo pide 17.0.8 (npx expo install --fix). Publicada hace 1 h: …" ("O Expo SDK pede 17.0.8").

### O `minimumReleaseAge` do pnpm

O pnpm tem a sua própria configuração para isso, `minimumReleaseAge`, em minutos. O comentário do código diz o que ele supõe sobre ela: "pnpm 11 and later wait one day unless pnpm-workspace.yaml or .npmrc says otherwise; pnpm 10 waited for nothing." (o pnpm 11 e posteriores esperam um dia, a menos que pnpm-workspace.yaml ou .npmrc digam outra coisa; o pnpm 10 não esperava nada).

`releaseAgeOf` em `hooks/npm.ts` a lê nesta ordem: `minimumReleaseAge:` em `pnpm-workspace.yaml`, depois `minimum-release-age` em `.npmrc`, depois a major do pnpm fixada em `packageManager` (abaixo de 11 dá 0); senão, 1440. `releaseMinutes` em `hooks/register.tsx` faz isso só quando `pnpm-lock.yaml` existe, e lê os arquivos como `HEAD` os guarda, com `git show HEAD:<path>`. O README explica por quê: o CI instala a partir do commit, e uma versão que o painel subisse cedo demais faria o `pnpm install --frozen-lockfile` do CI falhar.

Duas regras decorrem das palavras da pessoa autora:

- **A espera mais longa vence.** Um projeto pnpm com 2880 minutos espera dois dias, com o motivo "pnpm espera 48 h para instalarla (minimumReleaseAge)" ("o pnpm espera 48 h para instalá-la"). Um valor mais curto nunca reduz o dia.
- **Sem exceções.** `minimumReleaseAgeExclude` nunca é lido. O comentário é curto: "the wait has no exceptions here." (aqui a espera não tem exceções).

### Segurar a instalação também

Bloquear a linha só cobre a biblioteca que você sobe. As dependências dela podem puxar algo publicado há cinco minutos. Onde o gerenciador de pacotes pode recusar isso, o botão pede que ele recuse, por meio de `releaseAgeEnv`:

- O **pnpm** roda com `PNPM_CONFIG_MINIMUM_RELEASE_AGE` definido como a espera, `PNPM_CONFIG_MINIMUM_RELEASE_AGE_STRICT=true` e uma lista de exclusão vazia, de modo que uma dependência nova demais faz a instalação falhar em vez de ser gravada como exceção.
- O **npm** roda com `npm_config_before` um dia para trás, de modo que todo intervalo resolve para versões publicadas antes disso.

Quando um dos dois recusa, `ageRefusal` reconhece a mensagem da ferramenta e o painel o diz ("Bloqueada por minimumReleaseAge…", "Bloqueada por la espera de 24 h…", ou seja, "Bloqueada pelo minimumReleaseAge…", "Bloqueada pela espera de 24 h…"), sem nada atualizado. O README é honesto sobre o resto: yarn, bun e todos os outros ecossistemas não têm uma chave assim, então lá a espera se aplica à biblioteca que sobe, não ao que ela traz.

## Construa com o Claude

Peça ao Claude que bloqueie qualquer atualização cuja nova versão foi publicada há menos de 24 horas. A única ideia que ele precisa acertar é o que conta como prova de idade: uma data válida do registro, ou o momento em que o mod viu a versão pela primeira vez, e nunca nada.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No meu mod do Claude Code `my-panel`, bloqueie qualquer atualização cuja nova versão tenha sido publicada há menos de 24 horas. Escreva uma função pura `ageReason(published, now, minutes, seen)` que devolva um motivo em palavras ou `undefined`: com uma data válida, bloqueie enquanto ela for mais nova que `minutes`; sem data, use `seen` (quando o mod viu a versão pela primeira vez) como prova, e bloqueie quando não houver nenhum dos dois. Para o PyPI, leia a data de `https://pypi.org/pypi/<name>/<version>/json` como o `upload_time_iso_8601` mais antigo em `urls`, com `$.http.fetch`. Guarde uma data válida em `$.store` sob `published:pypi:<name>@<version>` para sempre e nunca armazene nada que não seja uma data. Guarde o horário da primeira vez em que a versão foi vista sob `seen:pypi:<name>@<version>`. Coloque uma atualização bloqueada num grupo `blocked` com o motivo abaixo da sua linha, e deixe-a fora do botão "Atualizar tudo". Teste a função com um `now` fixo: uma hora de idade, dois dias de idade, sem data e sem `seen`, sem data e com `seen` de um dia atrás.

### O que conferir na resposta do Claude

1. Com uma data válida, a atualização fica bloqueada enquanto a versão for mais nova que a espera, e o motivo abaixo da linha diz isso em palavras.
2. Sem data, o momento em que a versão foi vista pela primeira vez é a prova. Sem nenhum dos dois, a atualização fica bloqueada: "sem data" nunca significa "velha o suficiente".
3. Só um valor que é lido como data é guardado sob `published:…`, então uma página de erro nunca é guardada. O momento em que a versão foi vista pela primeira vez é guardado sob `seen:…`.
4. No PyPI, a data é o `upload_time_iso_8601` mais antigo dos arquivos da versão, quando ela passou a poder ser instalada.
5. Uma atualização bloqueada fica no grupo bloqueado, o botão "Atualizar tudo" a deixa de fora, e os testes usam um `now` fixo para os quatro casos que o prompt nomeia.

Se uma verificação falhar, diga ao Claude o que você vê: "uma versão sem data legível está bloqueada há três dias".

### Como a pessoa autora pediu

Este recurso está registrado com as palavras da pessoa autora, no registro de tarefas público do narsil-check, `odd/tasks/release-age-all-ecosystems.md`. O guia anterior cita as mesmas entradas para os grupos; aqui elas são lidas pelo que dizem sobre a espera.

#### Registrado: do pnpm para todos os ecossistemas

Antes desta tarefa já havia um bloqueio para o `minimumReleaseAge` do pnpm, e a pessoa autora tinha definido a sua regra ao corrigi-lo. O registro de tarefas a guarda como S4, com as palavras da pessoa autora:

> "siempre que haya minimumReleaseAge se bloquee la actualizacion automatica y se marque el bloqueo, sin excepcion alguna"

Tradução para o português: "sempre que houver um minimumReleaseAge, que a atualização automática seja bloqueada e o bloqueio seja marcado, sem exceção alguma." Essa frase é a origem de dois comportamentos do código: uma lista de exclusão nunca conta, e uma data que não pode ser lida também bloqueia.

A entrada de log L1 (2026-11-06) registra o pedido que a estendeu. A pessoa autora perguntou se o problema do Expo também acontecia com KMP ou outras linguagens e então escolheu:

> "El primero me interesa, deberíamos implementar algo similar para los otros lenguajes, es más seguro"

Tradução para o português: "O primeiro me interessa; deveríamos implementar algo parecido para as outras linguagens, é mais seguro." Perguntada sobre quanto tempo esperar, a resposta foi "24 horas está perfecto" ("24 horas está perfeito").

#### O que o agente fez com isso

O resto do log são as próprias notas do agente, não as palavras da pessoa autora. A entrada L2 registra como a data de cada registro foi encontrada: uma sondagem por registro, com um pacote real, antes de qualquer código. A entrada L3 registra a verificação da instalação com o npm: com `npm_config_before` um dia para trás, o npm recusou uma versão do tailwindcss publicada havia uma hora e resolveu o intervalo para a anterior. A entrada L6 registra as constatações do verificador independente, entre elas a de que uma data de committer do SwiftPM "can be forged" (pode ser falsificada).

#### Registrado: a correção sobre as datas ausentes

No mesmo dia, a pessoa autora percebeu o custo de "uma data ilegível bloqueia". L7 cita a pergunta:

> "que pasa si una version siempre trae fecha ilegible? nunca la vamos a actualizar?"

Tradução para o português: "o que acontece se uma versão sempre vem com data ilegível? nunca vamos atualizá-la?" O log registra a proposta do agente (esperar 24 horas a partir de quando o mod viu a versão pela primeira vez, guardar só datas válidas, ler a data da release do SwiftPM em vez da do commit) e a resposta da pessoa autora, "si hazlo asi" ("sim, faça assim"). O design é do agente; a pergunta e a aprovação são da pessoa autora.

#### Reconstrução a partir do histórico de commits

A partir de `git log -S releasedUrls` e `git log -S ageConflict` no narsil-check:

- `690c1bb` (2026-11-06) "feat: block upgrades pnpm would refuse under minimumReleaseAge" (bloquear atualizações que o pnpm recusaria sob minimumReleaseAge). A sua mensagem diz que as entradas de `minimumReleaseAgeExclude` "are honored" (são respeitadas).
- `54ac6aa` (2026-11-06) "fix: block every upgrade under pnpm's minimumReleaseAge, with no exceptions" (bloquear toda atualização sob o minimumReleaseAge do pnpm, sem exceções). A lista de exclusão passa a ser ignorada, uma data ilegível bloqueia, e as datas recorrem ao `pnpm view` porque packuments grandes "never reached the hooks module" (nunca chegavam ao módulo de hooks).
- `1492ca5` (2026-11-06) "feat: hold every ecosystem's upgrades for 24 hours after release" (segurar as atualizações de todos os ecossistemas por 24 horas depois da publicação). Todo adaptador recebe `releasedUrls`; o SwiftPM ainda lê o commit da tag.
- `ca13b3c` (2026-11-06) "feat: hold Expo SDK-pinned versions for 24 hours too" (segurar também por 24 horas as versões fixadas pelo Expo SDK).
- `8c5f2a3` (2026-11-06) "feat: install npm and pnpm upgrades under the 24-hour wait through the whole tree" (instalar as atualizações de npm e pnpm sob a espera de 24 horas em toda a árvore).
- `54cd243` (2026-11-06) "feat: let a version with no readable date go up a day after it was first seen" (deixar uma versão sem data legível subir um dia depois de ter sido vista pela primeira vez). A correção de L7, com o SwiftPM passando para a data da release.
- `40e5723` (2026-11-06) "fix: date Go +incompatible versions at the base path and keep Compose rules to its own line" (datar as versões +incompatible do Go no caminho base e manter as regras do Compose na sua própria linha). Uma constatação do verificador.
- `7048580` (2026-11-09) "feat: check the Gradle wrapper and GitHub Actions for upgrades" (verificar atualizações do Gradle wrapper e das GitHub Actions). Os dois novos adaptadores já vêm com as suas datas.

O padrão: a regra estrita veio primeiro e estava certa, e a única correção a manteve estrita sem deixá-la travada.

## Código de referência

Esta é uma resposta correta, escrita para este guia. Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

Esta é uma versão reduzida da ideia, escrita para este guia e conferida com os tipos do Claude Code 2.1.325 (`$.http.fetch`, `$.store.get`, `$.store.set`). Foi adaptada de `hooks/npm.ts` e `hooks/register.tsx` do [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Ela trata só o PyPI; outro registro é mais uma URL e mais um leitor.

```ts
import type { EngineInterface } from 'claude-code'

export const WAIT_MINUTES = 24 * 60

const dateOf = (text: unknown) =>
  typeof text === 'string' && !Number.isNaN(Date.parse(text)) ? text : undefined

// Why a version must wait, or undefined when it is old enough.
export function ageReason(
  published: string | undefined,
  now: number,
  minutes: number,
  seen?: number,
): string | undefined {
  const from = published ? Date.parse(published) : seen
  if (from === undefined || Number.isNaN(from))
    return `No publication date: waiting ${minutes / 60} h`
  const age = Math.floor((now - from) / 60_000)
  if (age >= minutes) return undefined
  const ago = age >= 60 ? `${Math.floor(age / 60)} h` : `${age} min`
  return published ? `Published ${ago} ago` : `No date; first seen ${ago} ago`
}

async function releasedAt($: EngineInterface, name: string, version: string) {
  const key = `published:pypi:${name}@${version}`
  const cached = dateOf(await $.store.get(key))
  if (cached) return cached
  const res = await $.http
    .fetch(`https://pypi.org/pypi/${encodeURIComponent(name)}/${encodeURIComponent(version)}/json`)
    .catch(() => undefined)
  let published: string | undefined
  try {
    const files = res?.ok
      ? ((JSON.parse(res.text) as { urls?: { upload_time_iso_8601?: unknown }[] }).urls ?? [])
      : []
    published = dateOf(
      files
        .map((f) => f.upload_time_iso_8601)
        .filter((t): t is string => typeof t === 'string')
        .sort()[0],
    )
  } catch {
    published = undefined
  }
  if (published) await $.store.set(key, published)
  return published
}

async function firstSeen($: EngineInterface, name: string, version: string, now: number) {
  const key = `seen:pypi:${name}@${version}`
  const seen = await $.store.get(key)
  if (typeof seen === 'number' && seen <= now) return seen
  await $.store.set(key, now)
  return now
}

export async function waitReason($: EngineInterface, name: string, version: string) {
  const now = Date.now()
  const published = await releasedAt($, name, version)
  const seen = published ? undefined : await firstSeen($, name, version, now)
  return ageReason(published, now, WAIT_MINUTES, seen)
}
```

Tradução do comentário para o português: por que uma versão deve esperar, ou undefined quando ela já é antiga o bastante.

Chame `waitReason` para cada atualização durante a varredura e trate um motivo devolvido como qualquer outro motivo de bloqueio. Observe que, com o recurso da primeira vez em que a versão foi vista, o caso "nenhum dos dois" de `ageReason` só acontece se o armazenamento não puder ser gravado.

## Erros comuns e como testar

Estes vêm do código, do registro de tarefas e dos commits do Narsil Check:

- **Deixar passar uma data desconhecida.** "Sem data" nunca deve significar "antiga o bastante". A primeira versão do Narsil Check para o pnpm deixava passar pacotes grandes porque as datas deles nunca chegavam.
- **Bloquear para sempre uma data desconhecida.** O erro oposto, que L7 detectou. Um horário da primeira vez em que a versão foi vista transforma "desconhecida" em "pelo menos desta idade".
- **Fazer cache de algo que não é data.** Uma página de erro guardada como data seria lida de volta em toda varredura. Guarde só o que é interpretado como data.
- **Confiar numa data que quem publica escreve.** Uma data de commit pode ser definida por quem fez o commit. Prefira uma data que o registro ou o host define.
- **Ler o horário do arquivo mais recente.** No PyPI, a versão passou a ser instalável com o seu primeiro arquivo.
- **Deixar uma configuração mais curta do projeto reduzir a espera.** Use a mais longa entre a sua própria regra e a do projeto.
- **Ler a cópia de trabalho quando o CI lê o commit.** A configuração do pnpm é lida em `HEAD` por esse motivo.

Para testar, `claude plugin test .` executa `tests/release-age.test.tsx`: "each registry says where and when a version was published" (cada registro diz onde e quando uma versão foi publicada) chama o `releasedUrls` e o `releasedOf` de cada adaptador com o formato de uma resposta real; "a version whose date cannot be read waits a day from when the mod first saw it" (uma versão cuja data não pode ser lida espera um dia a partir de quando o mod a viu pela primeira vez) e "the mod's own wait says so, in every ecosystem" (a própria espera do mod o diz, em todos os ecossistemas) chamam `ageConflict` com um relógio fixo. `tests/released.ts` responde à URL de data de cada registro com uma data de um ano atrás por padrão, para que os outros testes não sejam bloqueados por acidente, e com uma data recente para as URLs que um teste nomeia. O comportamento do pnpm e do npm está em `tests/upgrade.test.tsx`, por exemplo "npm installs with before set a day back, so a range resolves only to versions a day old, its dependencies included" (o npm instala com before definido um dia para trás, de modo que um intervalo só resolve para versões com um dia de idade, incluindo as suas dependências).

## Para ir além

- A tabela do README não lista o Gradle wrapper (o `buildTime` de `services.gradle.org`) nem as GitHub Actions (a release, como o SwiftPM): os dois vieram depois, em `7048580`, e só o código mostra de onde vêm as datas deles.
- O registro de tarefas lista avisos que o verificador deixou em aberto, como o limite do GitHub de 60 requisições por hora sem autenticação para as datas do SwiftPM. Uma versão cuja data não pode ser lida por esse motivo recorre à primeira vez em que foi vista.
- Vinte e quatro horas são uma constante, `RELEASE_AGE`. Um mod para uma equipe com uma política mais rígida poderia aumentá-la, e a regra do pnpm mostra como respeitar uma configuração mais longa do projeto sem deixar passar uma mais curta.
