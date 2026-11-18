---
title: Um adaptador por ecossistema
description: 'Como o Narsil Check lê onze ecossistemas de pacotes por um contrato pequeno: cada adaptador lê o seu manifesto, consulta o seu registro e diz como subir uma versão.'
route: check
order: 7
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/adapter.ts
  - repo: check
    path: hooks/ecosystems.ts
  - repo: check
    path: hooks/npm.ts
  - repo: check
    path: hooks/semver.ts
  - repo: check
    path: hooks/toml.ts
  - repo: check
    path: hooks/pypi.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/contract.test.tsx
  - repo: check
    path: tests/pypi.test.tsx
  - repo: check
    path: odd/tasks/ecosystems-wave-2.md
  - repo: check
    path: odd/tasks/ecosystems-wave-3.md
  - repo: check
    path: odd/tasks/ecosystems-wave-4.md
---

## O que faz

A seção **Actualizaciones** lista as bibliotecas do projeto que têm uma versão mais nova, seja qual for a linguagem em que o projeto está escrito. Um repositório com um front-end web e um serviço em Python recebe uma única lista, e cada linha nomeia o seu ecossistema no fim quando há mais de um:

```text
zod 3.22.4 → 3.25.1 · npm
requests 2.31.0 → 2.32.3 · PyPI
```

Para a pessoa, nada muda de uma linguagem para outra: os mesmos grupos, a mesma cópia com um clique, o mesmo botão que sobe as atualizações triviais. Por trás dessa uniformidade há um adaptador por ecossistema, e este guia trata desse design.

Os ecossistemas que o mod lê, como listados em `ADAPTERS` em `hooks/ecosystems.ts`, nesta ordem:

| Adaptador        | Linguagens            | Lê                                                                | Consulta                               |
| ---------------- | --------------------- | ----------------------------------------------------------------- | -------------------------------------- |
| `npm`            | JavaScript, TS (Expo) | `package.json`, `package-lock.json`, `pnpm-lock.yaml`             | registry.npmjs.org                     |
| `pypi`           | Python                | `pyproject.toml`, `requirements.txt`, `uv.lock`/`poetry.lock`     | pypi.org                               |
| `go`             | Go                    | `go.mod`                                                          | proxy.golang.org                       |
| `cargo`          | Rust                  | `Cargo.toml`, `Cargo.lock`                                        | crates.io                              |
| `pub`            | Dart, Flutter         | `pubspec.yaml`, `pubspec.lock`                                    | pub.dev                                |
| `maven`          | Kotlin, Java          | `gradle/libs.versions.toml`, `build.gradle(.kts)`, `pom.xml`      | Maven Central, Google Maven, Plugin P. |
| `gradle-wrapper` | O próprio Gradle      | `gradle/wrapper/gradle-wrapper.properties`                        | services.gradle.org                    |
| `nuget`          | C#, F#, VB            | `*.csproj`, `*.fsproj`, `*.vbproj`, `Directory.Packages.props`    | api.nuget.org                          |
| `rubygems`       | Ruby                  | `Gemfile`, `Gemfile.lock`                                         | rubygems.org                           |
| `swiftpm`        | Swift                 | `Package.swift`, o `project.pbxproj` do Xcode, `Package.resolved` | as tags git de cada pacote             |
| `actions`        | GitHub Actions        | as linhas `uses:` de `.github/workflows` e `.github/actions`      | as tags git de cada action             |

São onze adaptadores. A tabela **Ecosistemas** do README tem as mesmas onze linhas. A sua seção de vulnerabilidades fala de "los nueve ecosistemas" ("os nove ecossistemas"), e o registro de tarefas da idade de publicação também ("all nine ecosystems", todos os nove ecossistemas): os dois contam os ecossistemas de pacotes da época, antes que os adaptadores do Gradle wrapper e do GitHub Actions chegassem em `7048580`.

## Como funciona por dentro

### A ideia: adaptadores puros, um motor

`hooks/adapter.ts` começa com a regra sobre a qual todo o design se apoia:

> An adapter is pure: the hooks module reads the files it names, fetches the addresses it gives and runs the commands it builds.

Tradução para o português: um adaptador é puro: o módulo de hooks lê os arquivos que ele nomeia, busca os endereços que ele dá e executa os comandos que ele monta.

Um adaptador nunca chama `$`. Ele é um objeto de valores simples e funções simples: nomes de arquivos, montadores de URL, parsers, montadores de comandos. O módulo de hooks (`hooks/register.tsx`) é o único lugar que toca o disco, a rede ou um processo. Assim há um motor e muitas descrições, e cada descrição pode ser testada com fixtures de texto e nenhuma toolchain.

Esse último ponto não era teórico. O registro de tarefas da onda 2 anota: "No Python, Cargo or Dart toolchain and no project of those ecosystems on this machine: adapters are checked with fixtures and against the live registries only." (nenhuma toolchain de Python, Cargo ou Dart e nenhum projeto desses ecossistemas nesta máquina: os adaptadores são conferidos só com fixtures e contra os registros reais). Um design em que o adaptador executasse o `cargo` por conta própria não poderia ter sido construído naquela máquina.

### As três perguntas que todo adaptador responde

O tipo `Adapter` tem muitos campos, a maioria opcional. Os obrigatórios respondem a três perguntas.

**1. O que o projeto declara, e o que está instalado?**

- `manifests`: os arquivos cuja presença diz que o projeto usa este ecossistema, na raiz (`package.json`). `globs` acrescenta manifestos em qualquer lugar da árvore (`**/*.csproj`).
- `lockfiles`: onde as versões instaladas ficam registradas.
- `parse(files)`: transforma o texto desses arquivos numa lista de `Dep`, cada um `{ name, spec, isDev, installed? }`. `spec` é o intervalo ou a versão que o manifesto escreve (`^18.2.0`, `>=2.31,<3`), `installed` o que um lockfile registra.

**2. Qual é a versão mais nova?**

- `latestUrl(name)`: onde o registro responde, com os `headers` a enviar.
- `latestOf(text)`: lê a versão nessa resposta.

**3. Como uma versão sobe?**

- `installArgv(present, upgrades, files)`: os comandos que sobem as atualizações triviais (`npm install …`, `uv lock`, `cargo update -p …`).
- `rewrite(files, upgrades, pins)`, opcional: os arquivos escritos antes desses comandos, para ecossistemas cuja ferramenta não edita o próprio manifesto.
- `managerOf(present)`: o nome da ferramenta, para a nota do botão.

Todo o resto é uma extensão de que uma funcionalidade posterior precisou, e cada uma é uma frase nos comentários do tipo: `releasedUrls` e `releasedOf` para a espera de 24 horas, `repoUrlOf` e `importPattern` para a leitura que o Haiku faz de uma major, `treeOf` para a verificação de vulnerabilidades, `conflictsOf` para um ecossistema que sabe o que uma atualização quebra (o Kotlin e os seus plugins de compilador). Três campos existem porque um ecossistema não cabia:

- `latestCommand` (SwiftPM, GitHub Actions): não há registro, então a tag mais nova vem de `git ls-remote --tags --refs` no próprio repositório do pacote.
- `nextMajor` (Go): uma major do Go a partir da v2 é um novo caminho de módulo (`/v2`), então o "latest" do registro nunca sai da major atual. O motor pede cada major seguinte até que uma falte.
- `alternateUrl` (Maven): um plugin do Gradle publicado como biblioteca está no Plugin Portal, não no Maven Central, então uma falha no primeiro registro consulta o segundo.

### O registro de ecossistemas

`hooks/ecosystems.ts` é curto. Ele define o adaptador do npm e reúne todos:

```ts
export const ADAPTERS: Adapter[] = [
  NPM,
  PYPI,
  GO,
  CARGO,
  PUB,
  MAVEN,
  GRADLE_WRAPPER,
  NUGET,
  RUBYGEMS,
  SWIFTPM,
  ACTIONS,
]

export function adapterOf(id: Ecosystem): Adapter {
  return ADAPTERS.find((a) => a.id === id) ?? NPM
}
```

Ele é citado do [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). A união `Ecosystem` em `types/index.d.ts` lista os mesmos onze ids, então uma linha de atualização carrega o seu ecossistema e o motor reencontra o seu adaptador com `adapterOf`.

A detecção é "cada adaptador cujo manifesto está lá". `presentOf` em `hooks/register.tsx` confere cada manifesto, lockfile e arquivo de contexto com `$.fs.exists` e, para os globs, executa `git ls-files --cached --others --exclude-standard`, que lista o que o git rastreia ou rastrearia e, assim, deixa de fora a saída de build. Fora de um repositório git, só os manifestos da raiz contam.

### O que o motor faz com um adaptador

Para qualquer ecossistema que não seja o npm, `scanGeneric` é o laço inteiro:

1. Ler os arquivos presentes com `$.fs.read` (um arquivo grande demais ou ilegível é pulado: "the adapter does without it", o adaptador se vira sem ele).
2. `adapter.parse(files)` dá as dependências declaradas.
3. Para cada uma, a versão instalada é `installed`; senão, a versão a partir da qual o intervalo é escrito (`baseOf`).
4. `latestIn` consulta o registro: `$.http.fetch(adapter.latestUrl(name), { headers })`, ou `$.process.run(adapter.latestCommand(name))`, e lê a resposta com `adapter.latestOf`. A resposta é guardada em `$.store` por seis horas (o próximo guia explica o cache).
5. `bumpOf(installed, latest)` de `hooks/semver.ts` diz patch, minor ou major, e a atualização cai no seu grupo.

O botão de atualização faz a terceira pergunta: para cada ecossistema com atualizações triviais, ele escreve o que `rewrite` devolve e depois executa cada comando de `installArgv`. Se a ferramenta não está na máquina (`xcodebuild` fora de um Mac), os arquivos reescritos são restaurados, "raised manifests would go out with a stale lockfile, so they go back" (manifestos com versões subidas sairiam com um lockfile desatualizado, então eles voltam), e os outros ecossistemas ainda sobem.

### npm, o adaptador de referência

O npm foi o primeiro ecossistema, o único no primeiro commit. Quando os adaptadores chegaram, em `a95eb07`, "npm becomes the first adapter and keeps what only npm has (Expo, node_modules, peer and pin checks)" (o npm se torna o primeiro adaptador e mantém o que só o npm tem: Expo, node_modules, verificações de peers e de pins). Assim, o npm tem um adaptador como os outros, usado para a detecção, o botão, as notas de versão e a árvore de vulnerabilidades, e também uma varredura própria, `scanNpm`, para o que o laço genérico não sabe.

As suas peças ficam em `hooks/npm.ts` e são montadas em `hooks/ecosystems.ts`:

- `parseManifest` lê `dependencies` e `devDependencies`, e a primeira vence quando um nome está nas duas.
- `lockedVersion` lê `packages["node_modules/<name>"].version` de `package-lock.json` (v2 e v3).
- `latestUrl` consulta `https://registry.npmjs.org/<name>/latest`, "a small document, unlike the package's full record" (um documento pequeno, ao contrário do registro completo do pacote). Um nome com escopo mantém o seu `@` e escapa a sua barra: `@types%2Fnode`.
- `managerOf` escolhe npm, pnpm, yarn ou bun pelo lockfile presente, e o primeiro encontrado em `LOCKFILES` vence.
- `installArgv` monta um comando para as dependencies e um para as devDependencies, "so each package stays in its own section" (para que cada pacote fique na sua própria seção), e `rangeFor` mantém o prefixo do intervalo: `^1.2.0` vira `^1.4.0`, e um pin exato continua exato.

O npm não tem `rewrite`: `npm install name@^1.4.0` escreve o `package.json` por conta própria.

### Versões: uma aritmética para todos

`hooks/semver.ts` é compartilhado por todos os adaptadores. O seu `Version` é `{ major, minor, patch, pre, rest? }`. `rest` guarda uma quarta parte em diante, porque o RubyGems e o NuGet as usam (Rails `8.1.4.1`); ele chegou com a onda do Maven em `c50e830`. O padrão também aceita um qualificador do Maven depois de um ponto (`5.6.15.Final`) e um `v` inicial.

Ele exporta quatro coisas das quais o resto do mod depende:

- `compare`: major, minor, patch, depois as partes extras, e uma prerelease antes da sua versão final.
- `bumpOf`: o tipo de salto, com a regra para versões abaixo de 1.0.0 (próximo guia).
- `baseOf`: a versão a partir da qual um intervalo é escrito, `undefined` para o que não nomeia nenhuma (`workspace:*`, uma URL git, `latest`).
- `satisfies`: se uma versão atende a um intervalo no estilo do npm, com `||`, intervalos com hífen, `^`, `~`, versões parciais e `*`. O seu comentário declara uma escolha de design que vale copiar: "A comparator it cannot read is taken as met, so an unknown range never raises a false alarm." (um comparador que ele não consegue ler é tomado como atendido, então um intervalo desconhecido nunca dispara um falso alarme).

### Um pequeno leitor de TOML

O Cargo, o Python e o catálogo de versões do Gradle escrevem TOML. `hooks/toml.ts` é "a small TOML reader" (um pequeno leitor de TOML): tabelas, arrays de tabelas, chaves com pontos e entre aspas, os tipos de string, números, booleanos, datas como texto, arrays e tabelas inline. Ele lança um erro com uma entrada malformada, e quem o chama o captura (um `uv.lock` ilegível faz as versões virem dos requirements).

Por que escrever um? O mod não tem um `package.json` próprio: os seus hooks só importam `claude-code` e os seus próprios arquivos. Todo parser de que ele precisa, TOML, YAML para o `pnpm-lock.yaml` (lido linha a linha em `pnpmLocked`), versões e intervalos, fica no repositório. O cabeçalho do leitor lista arquivos do Cargo e do Python; `hooks/maven.ts` também o importa, para o `libs.versions.toml`.

## Construa com o Claude

Peça ao Claude que transforme a sua lista de bibliotecas desatualizadas num único motor com um adaptador puro por ecossistema. A única ideia que ele precisa acertar é que um adaptador nunca chama `$`: ele nomeia arquivos, monta endereços e comandos e analisa texto, enquanto o módulo de hooks faz toda a leitura, as buscas e as execuções.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No meu mod do Claude Code `my-panel`, eu listo as dependências npm desatualizadas. Refatore-o para que cada ecossistema de pacotes seja um objeto adaptador puro no seu próprio arquivo em `hooks/`, sem chamadas a `$`: `id`, `label`, `manifests` (nomes de arquivos), `lockfiles`, `parse(files: Record<string, string>)` devolvendo `{ name, spec, isDev, installed? }[]`, `latestUrl(name)`, `latestOf(text)` e `installArgv(present, upgrades)`. Mantenha toda a I/O em `hooks/register.tsx`: confira quais manifestos existem com `$.fs.exists`, leia-os com `$.fs.read`, busque `latestUrl` com `$.http.fetch` e execute `installArgv` com `$.process.run`. Faça do npm o primeiro adaptador sem mudança de comportamento, comprovado pelos testes existentes. Depois adicione um adaptador do PyPI para `requirements.txt` contra `https://pypi.org/pypi/<name>/json` (`info.version`). Teste cada adaptador como funções puras com fixtures de texto e uma resposta de registro sintética.

### O que conferir na resposta do Claude

1. Nenhum adaptador chama `$`. `$.fs.exists`, `$.fs.read`, `$.http.fetch` e `$.process.run` aparecem só em `hooks/register.tsx`.
2. Cada adaptador tem `manifests`, `lockfiles`, `parse`, `latestUrl`, `latestOf` e `installArgv`. Um campo de que só um ecossistema precisa é opcional.
3. O npm vira o primeiro adaptador sem mudança de comportamento, e os testes existentes continuam passando.
4. Um nome npm com escopo mantém o seu `@` e escapa a barra na URL (`@types%2Fnode`).
5. Cada adaptador é testado como funções puras com fixtures de texto e uma resposta sintética do registro, sem nenhuma ferramenta do ecossistema instalada.

Se uma verificação falhar, diga ao Claude o que você vê: "os testes do PyPI falham numa máquina sem Python, porque o adaptador roda um comando ele mesmo".

### Como a pessoa autora pediu

Os adaptadores foram construídos em três ondas em 2026-11-04, cada uma com um registro de tarefas público no narsil-check. Os registros de tarefas anotam as palavras da pessoa autora e também o plano que as ondas seguiram; os dois são mantidos separados abaixo.

#### Registrado: onda 2

`odd/tasks/ecosystems-wave-2.md`, entrada de log L1 (2026-11-04), cita a pessoa autora:

> "camos con la oleada 2", e depois "espera primero sube a github - main y luego sigue con la oleada 2".

Tradução para o português: "vamos com a onda 2" ("camos" é um erro de digitação de "vamos"), e depois "espera, primeiro sobe para o GitHub, main, e depois continua com a onda 2".

S1 anota o plano que a onda seguiu, sob "The user's request, as wave 2 was planned in this conversation" (o pedido do usuário, como a onda 2 foi planejada nesta conversa):

> "2. **PyPI, Go, Cargo y Pub.** Tienen registros con APIs JSON sencillas."

Tradução para o português: "2. PyPI, Go, Cargo e Pub. Eles têm registros com APIs JSON simples." O log não diz quem escreveu essa linha do plano. O mesmo S1 acrescenta, com as palavras do próprio registro de tarefas, que "Each ecosystem's adapter follows the shared contract: `detect`, `parse`, `latest`, `importPattern` (the planned contract), plus an install command for the bump group." (o adaptador de cada ecossistema segue o contrato compartilhado: `detect`, `parse`, `latest`, `importPattern`, o contrato planejado, mais um comando de instalação para o grupo de subida de versão). O contrato que foi entregue chamou esses passos de `manifests`, `parse`, `latestUrl`/`latestOf` e `installArgv`. A sua suposição declarada: "peer dependency and exact-pin checks stay npm-only" (as verificações de dependências peer e de pins exatos ficam só no npm).

#### Registrado: onda 3

`odd/tasks/ecosystems-wave-3.md`, L1 (2026-11-04), cita a pessoa autora: "dale a la oleada 3" ("manda ver na onda 3"). O seu S1 anota o plano:

> "3. **Maven (Kotlin/Java), NuGet y RubyGems.** Gradle es lo más difícil de leer, porque `build.gradle.kts` es código. Leería el catálogo de versiones con exactitud y los `build.gradle.kts` lo mejor posible."

Tradução para o português: "3. Maven (Kotlin/Java), NuGet e RubyGems. O Gradle é o mais difícil de ler, porque `build.gradle.kts` é código. Eu leria o catálogo de versões com exatidão e os arquivos `build.gradle.kts` da melhor forma possível." A primeira pessoa ("Leería", "eu leria") soa como uma proposta que a pessoa autora depois aceitou com "dale a la oleada 3"; o log não diz mais nada.

Esse plano é o motivo pelo qual o README diz que uma versão do Gradle guardada numa variável "es código y queda fuera" ("é código e fica de fora").

#### Registrado: onda 4

`odd/tasks/ecosystems-wave-4.md`, L1 (2026-11-04), cita a pessoa autora: "dale a la oleada 4" ("manda ver na onda 4"). O seu S1 anota o plano:

> "4. **SwiftPM.** Lo dejo para el final porque depende de la API de GitHub, que tiene límite de peticiones."

Tradução para o português: "4. SwiftPM. Deixo para o final porque depende da API do GitHub, que tem limite de requisições."

Aqui o plano mudou pelo caminho. A suposição do registro de tarefas: "tags are read with `git ls-remote --tags --refs <url>` instead of the GitHub API, which has no request limit and works for any git host" (as tags são lidas com `git ls-remote --tags --refs <url>` em vez da API do GitHub, o que não tem limite de requisições e funciona com qualquer host git). Foi aí que o contrato ganhou `latestCommand`, em `8444155` "feat: let an adapter answer its latest version with a command" (permitir que um adaptador responda a sua versão mais nova com um comando).

#### Reconstrução a partir do histórico de commits

A onda 1, só o npm, não tem registro de tarefas, então o seu pedido não foi registrado. A partir de `git log -- hooks/adapter.ts hooks/ecosystems.ts hooks/toml.ts hooks/semver.ts`:

- `1bf736a` (2026-11-04) "feat: add upgrade panel for npm and Expo projects" (adicionar um painel de atualizações para projetos npm e Expo). `semver.ts` e `npm.ts` chegam; ainda não há adaptadores.
- `a95eb07` (2026-11-04) "refactor: read dependencies through an adapter per ecosystem" (ler as dependências por meio de um adaptador por ecossistema). O contrato, com o npm como primeiro adaptador "with no change in behaviour" (sem mudança de comportamento), como o log da onda 2 diz para T1.
- `bbe6519`, `8ae479e`, `90f8502`, `503ba95` (2026-11-04): Cargo (com `toml.ts`), PyPI, Go e Pub, um commit cada.
- `c50e830` (2026-11-04) "feat: find manifests anywhere in the tree and read four-part versions" (encontrar manifestos em qualquer lugar da árvore e ler versões de quatro partes): o contrato ganha `globs` e `Version.rest` antes de Maven, NuGet e RubyGems (`4f9b8ea`, `1362623`, `06bcc49`).
- `8444155` e `83c0029` (2026-11-04): `latestCommand`, depois o SwiftPM.
- `1492ca5` (2026-11-06) "feat: hold every ecosystem's upgrades for 24 hours after release" (segurar as atualizações de todos os ecossistemas por 24 horas depois da publicação): `releasedUrls` e `releasedOf` em todos os adaptadores.
- `7048580` (2026-11-09) "feat: check the Gradle wrapper and GitHub Actions for upgrades" (verificar atualizações do Gradle wrapper e do GitHub Actions): o décimo e o décimo primeiro adaptadores.

O padrão: primeiro transformar o ecossistema existente num adaptador sem mudar o seu comportamento, depois adicionar um ecossistema por commit, e fazer o contrato crescer um campo opcional a cada vez que um ecossistema não cabe.

## Código de referência

Esta é uma resposta correta, escrita para este guia. Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

Esta é uma versão reduzida da ideia, escrita para este guia e conferida com os tipos do Claude Code 2.1.325. Foi adaptada de `hooks/adapter.ts`, `hooks/npm.ts` e `hooks/register.tsx` do [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Ela lê as versões só do manifesto, sem lockfile.

O contrato e o adaptador do npm, `hooks/adapter.ts`:

```ts
export type Dep = { name: string; spec: string; isDev: boolean }
export type Files = Record<string, string>

export type Adapter = {
  id: string
  manifests: string[]
  parse: (files: Files) => Dep[]
  latestUrl: (name: string) => string
  latestOf: (text: string) => string | undefined
  installArgv: (upgrades: { name: string; latest: string; isDev: boolean }[]) => string[][]
}

export const NPM: Adapter = {
  id: 'npm',
  manifests: ['package.json'],
  parse: (files) => {
    const json = JSON.parse(files['package.json'] ?? '{}') as Record<string, Record<string, string>>
    return (['dependencies', 'devDependencies'] as const).flatMap((field) =>
      Object.entries(json[field] ?? {}).map(([name, spec]) => ({
        name,
        spec,
        isDev: field === 'devDependencies',
      })),
    )
  },
  latestUrl: (name) => `https://registry.npmjs.org/${name.replace('/', '%2F')}/latest`,
  latestOf: (text) => (JSON.parse(text) as { version?: string }).version,
  installArgv: (upgrades) =>
    [false, true]
      .map((isDev) =>
        upgrades.filter((u) => u.isDev === isDev).map((u) => `${u.name}@^${u.latest}`),
      )
      .flatMap((names, i) =>
        names.length ? [['npm', 'install', ...(i ? ['--save-dev'] : []), ...names]] : [],
      ),
}

export const ADAPTERS: Adapter[] = [NPM]
```

O motor, em `hooks/register.tsx`:

```tsx
import type { EngineInterface } from 'claude-code'
import { ADAPTERS } from './adapter'
import type { Adapter } from './adapter'

const major = (v: string) => Number(/\d+/.exec(v)?.[0] ?? 0)
const clean = (spec: string) => /\d+(\.\d+){0,2}/.exec(spec)?.[0]

export async function scan($: EngineInterface) {
  const rows: { ecosystem: string; name: string; from: string; to: string; isMajor: boolean }[] = []
  for (const adapter of ADAPTERS) {
    const files: Record<string, string> = {}
    for (const path of adapter.manifests)
      if (await $.fs.exists(path)) files[path] = await $.fs.read(path)
    if (Object.keys(files).length === 0) continue
    for (const dep of adapter.parse(files)) {
      const from = clean(dep.spec)
      if (!from) continue
      const res = await $.http.fetch(adapter.latestUrl(dep.name), {
        headers: { accept: 'application/json' },
      })
      const to = res.ok ? adapter.latestOf(res.text) : undefined
      if (to && to !== from)
        rows.push({
          ecosystem: adapter.id,
          name: dep.name,
          from,
          to,
          isMajor: major(to) !== major(from),
        })
    }
  }
  return rows
}
```

Chame `scan` a partir de uma função que nenhum hook aguarda, guarde as linhas num atom e desenhe-as no painel. O motor reduzido trata qualquer versão diferente como mais nova e qualquer mudança de major como major; o Narsil Check compara com `compare` e `bumpOf` de `hooks/semver.ts`, lê a versão instalada do lockfile, consulta até oito bibliotecas ao mesmo tempo e guarda as respostas em cache.

### Exercício: adicione o PyPI

Adicione um segundo adaptador, `PYPI`, a `ADAPTERS` sem tocar em `scan`. Ele precisa de:

- `manifests: ['requirements.txt']`.
- `parse`: uma dependência por linha, pulando comentários e linhas de opção (`-r`, `--index-url`), o nome antes do primeiro operador (`==`, `>=`, `~=`) e o resto como `spec`.
- `latestUrl`: `https://pypi.org/pypi/<name>/json`.
- `latestOf`: `info.version` desse JSON.
- `installArgv`: `[]` quando não há lockfile, já que reescrever `requirements.txt` é toda a atualização (é o que o Narsil Check também faz: "con solo `requirements.txt` no hay lockfile, así que el botón reescribe los pins y no instala nada", "só com `requirements.txt` não há lockfile, então o botão reescreve os pins e não instala nada"). O seu contrato então precisa de um `rewrite`.

Quando funcionar, compare com a resposta de referência, `hooks/pypi.ts` no narsil-check. Ela mostra o que um adaptador real acrescenta: a normalização de nomes da PEP 503 (`Foo_Bar` e `foo-bar` são um só pacote), extras e marcadores da PEP 508 (`Django[argon2]~=4.2 ; python_version > '3.8'`), `pyproject.toml` lido com `parseToml`, versões instaladas a partir de `uv.lock` ou `poetry.lock`, um `rewrite` que sobe só a primeira versão e mantém um limite superior (`>=2.31,<3` vira `>=2.34.2,<3`), e uma tabela de nomes de import para o Haiku (`pyyaml` é importado como `yaml`).

## Erros comuns e como testar

Estes vêm do código e dos registros de tarefas do Narsil Check:

- **Deixar o adaptador fazer I/O.** Assim ele não pode ser testado sem as ferramentas do ecossistema. Mantenha-o puro e deixe o motor ler, buscar e executar.
- **Um adaptador que sabe demais.** A lógica de Expo, peers e pins do npm ficou na varredura própria do npm. Um campo de que só um ecossistema precisa é opcional, nunca exigido de todos.
- **Nomes com escopo e nomes especiais.** O `@scope/name` do npm precisa escapar a sua barra na URL. O PyPI compara nomes normalizados. As majors do Go são outros caminhos.
- **Confiar no "latest".** O `<release>` do Maven pode ser uma prerelease (o log da onda 3 encontrou `2.12.0-alpha05`), então o máximo estável vem da lista completa.
- **Registros com regras próprias.** O crates.io recusa uma requisição sem User-Agent, como diz um comentário em `hooks/cargo.ts`, então o seu adaptador envia um em `headers`.
- **Reescrever mais que a versão.** Um `rewrite` que reformata um manifesto gera um diff ruidoso. Os rewrites do Narsil Check mudam a versão e deixam "every other byte as it was" (todos os outros bytes como estavam).
- **Um teste que simula todo processo.** O log da onda 3 anota "A test mock that simulated the npm install on every process call broke once the scan began calling git ls-files" (um mock de teste que simulava o npm install em toda chamada de processo quebrou quando a varredura começou a chamar git ls-files). Responda só aos comandos de que o teste trata.

Para testar, `tests/contract.test.tsx` confere as peças compartilhadas: "a version may have a fourth part, and it counts" (uma versão pode ter uma quarta parte, e ela conta), "a glob matches at any depth with \*\*/ and within one directory with \*" (um glob casa em qualquer profundidade com \*\*/ e dentro de um diretório com \*), "the manifests are the root ones and the globbed ones, never a lockfile" (os manifestos são os da raiz e os encontrados por glob, nunca um lockfile). Cada ecossistema tem o seu próprio arquivo; `tests/pypi.test.tsx` tem "a PEP 508 requirement is a name and its specifier, without extras or markers" (um requirement da PEP 508 é um nome e o seu especificador, sem extras nem marcadores), "raising a requirement keeps its operators and upper bound, and every other byte" (subir um requirement mantém os seus operadores e o limite superior, e todos os outros bytes), "PyPI's answer gives the latest release and the GitHub repository" (a resposta do PyPI dá a versão mais nova e o repositório no GitHub) e, pelo painel, "a uv project lists its packages and the button raises pyproject.toml and runs uv lock" (um projeto uv lista os seus pacotes e o botão sobe o pyproject.toml e executa uv lock) e "a project with two ecosystems names each library's" (um projeto com dois ecossistemas nomeia o de cada biblioteca).

## Para ir além

- O próximo guia acompanha uma atualização desde `bumpOf` até o seu grupo e explica o cache de seis horas que `latestIn` usa.
- Os campos opcionais dos adaptadores são um mapa das funcionalidades posteriores do mod: leia `releasedUrls` para a espera de 24 horas, `treeOf` para as vulnerabilidades, `conflictsOf` para o Kotlin Multiplatform.
- Um ecossistema sem registro não é um beco sem saída: `latestCommand` deixa um comando git responder, como fazem o SwiftPM e o GitHub Actions.
