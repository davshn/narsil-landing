---
title: Atualizar as triviais
description: 'Como o botão Actualizar las N sobe todos os patches e minors de uma vez, mantendo o operador de intervalo e a seção de cada um, e depois roda a ferramenta de instalação de cada ecossistema.'
route: check
order: 12
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/adapter.ts
  - repo: check
    path: hooks/npm.ts
  - repo: check
    path: hooks/pypi.ts
  - repo: check
    path: hooks/cargo.ts
  - repo: check
    path: hooks/pub.ts
  - repo: check
    path: hooks/rubygems.ts
  - repo: check
    path: hooks/words.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/upgrade.test.tsx
  - repo: check
    path: odd/tasks/release-age-all-ecosystems.md
---

## O que faz

A maior parte de uma lista de desatualizadas são patches e minors que nada bloqueia. Subi-los um por um é tedioso, e é aí que os erros aparecem: um `^` perdido, uma ferramenta de desenvolvimento movida para `dependencies`, um lockfile não atualizado. O Narsil Check os faz com um clique.

Abaixo do grupo **Solo subir la versión** ("Só subir a versão") há um botão, **Actualizar las N** ("Atualizar as N"), ou **Actualizar esta librería** ("Atualizar esta biblioteca") quando há só uma. Enquanto ele roda, o painel diz `Actualizando 6 librerías con npm…` ("Atualizando 6 bibliotecas com o npm…") e o botão some. Quando termina, um toast diz `Actualicé 6 librerías con npm.` ("Atualizei 6 bibliotecas com o npm.") e o painel acrescenta um lembrete:

```text
Actualicé 6 librerías. Ejecuta los tests antes de hacer commit.
```

Isso é "Atualizei 6 bibliotecas. Rode os testes antes de fazer commit." Depois a lista é varrida de novo, a partir dos registros, então o que você vê é o que agora é verdade.

Cada biblioteca mantém a forma que tinha. O README dá os exemplos: `^3.22.0` vira `^3.25.1`, e `>=2.31,<3` vira `>=2.34.2,<3`. Uma dependência de desenvolvimento continua sendo uma dependência de desenvolvimento.

### O que "trivial" significa aqui

Só o grupo `bump` sobe: um salto de patch ou minor (pela regra de 0.x do guia 7) sem motivo de bloqueio. As majors, os módulos fixados pelo SDK do Expo e qualquer coisa em **Bloqueada** nunca são tocados. O README é cuidadoso com a palavra: "'Trivial' solo significa que el salto no es mayor y que no choca con lo que el panel sabe: no garantiza que el proyecto compile." Tradução para o português: "'Trivial' só significa que o salto não é major e que não entra em conflito com o que o painel sabe: não garante que o projeto compile." É por isso que a última mensagem pede que você rode os testes.

## Como funciona por dentro

### Um plano por ecossistema

`upgradeBumps` em `hooks/register.tsx` pega as linhas `bump` da última varredura, agrupa-as por ecossistema e roda cada ecossistema com a sua própria ferramenta. Um segundo clique enquanto um está rodando não faz nada: o estado `running` do trabalho é conferido primeiro.

Para cada ecossistema os passos são os mesmos, e cada um vem do contrato de adaptador em `hooks/adapter.ts`:

1. **Ler os arquivos** que o adaptador lista (manifests e lockfiles que existem).
2. **Resolver os pins** quando a reescrita precisa que um comando diga algo antes (`pinCommand`): as GitHub Actions fixadas num commit precisam do commit da nova tag. Se um deles não puder ser lido, esse ecossistema é pulado e os seus arquivos não são gravados.
3. **Reescrever** os manifests (`rewrite`), quando o ecossistema é reescrito pelo mod.
4. **Instalar** com os comandos que `installArgv` monta.

### npm: o gerenciador de pacotes grava o `package.json`

O npm não tem `rewrite`. O mod monta o comando de instalação e deixa o gerenciador de pacotes editar o `package.json` e o lockfile. Qual gerenciador é decidido pelo lockfile presente: `pnpm-lock.yaml`, `yarn.lock`, `bun.lock` ou `bun.lockb`; senão, o npm.

O intervalo vem de `rangeFor` em `hooks/npm.ts`:

```ts
export function rangeFor(spec: string, latest: string): string {
  const prefix = /^(\^|~)/.exec(spec.trim())?.[1] ?? ''
  return `${prefix}${latest}`
}
```

E a seção vem de `installArgv`, que faz um comando para `dependencies` e outro para `devDependencies`:

```ts
for (const isDev of [false, true]) {
  const names = upgrades
    .filter((u) => u.isDev === isDev)
    .map((u) => `${u.name}@${rangeFor(u.spec, u.latest)}`)
  if (names.length > 0) argv.push([manager, ...add, ...(isDev ? [dev] : []), ...names])
}
```

Os dois são citados do [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). `add` é `install` para o npm e `add` para os outros; `dev` é `--save-dev` para o npm e `-D` para os outros. O teste "dependencies and devDependencies install in their own sections" (dependencies e devDependencies são instaladas nas suas próprias seções) espera, para três atualizações:

```text
npm install a@^1.1.0 c@^1.1.0
npm install --save-dev b@^1.1.0
```

Duas consequências de `rangeFor` valem a pena conhecer. Só `^` e `~` são mantidos: qualquer outro prefixo, como `>=`, é descartado e a versão entra sem prefixo. E, para uma versão sem prefixo, o que acaba em `package.json` é decisão do próprio gerenciador de pacotes; o código passa a versão sem prefixo, e os testes conferem o comando, não o arquivo gravado. Se o seu projeto depende de versões exatas, confira o resultado ou configure a opção do próprio gerenciador para salvar versões exatas.

### Os outros ecossistemas: reescrever a linha, manter todos os outros bytes

Todos os outros ecossistemas reescrevem o próprio manifest, linha por linha, e mudam só a versão. Cada adaptador tem uma pequena função que troca a primeira versão de um requisito e mantém o seu operador; o PyPI e o Pub também mantêm um limite superior:

| Ecossistema | Função         | Exemplo do seu comentário ou dos testes        |
| ----------- | -------------- | ---------------------------------------------- |
| PyPI        | `pySpecFor`    | `>=2.31,<3` → `>=2.34.2,<3`                    |
| Cargo       | `cargoSpecFor` | mantém `^`, `~`, `=` ou `>=`; descarta o resto |
| Pub         | `pubSpecFor`   | `>=1.0.0 <2.0.0` → `>=1.6.0 <2.0.0`            |
| RubyGems    | `gemSpecFor`   | mantém `~>`, `>=` e similares                  |

Como a linha é editada onde está, a seção nunca muda: um crate sob `[dev-dependencies]` fica lá, um pacote Python em `requirements-dev.txt` fica lá. O `rewriteCargo` do Cargo chega a acompanhar o cabeçalho de tabela em que está, de modo que só toca linhas sob `[dependencies]`, `[dev-dependencies]`, `[build-dependencies]` (e as suas formas com `target`) ou na tabela própria de um crate, `[dependencies.<name>]`. Os comentários deles descrevem o objetivo da mesma forma: "every other byte as it was" (todos os outros bytes como estavam).

Por que reescrever em vez de chamar o comando "add" de cada ferramenta? O código não o diz num único lugar, mas os comentários mostram o raciocínio: uma reescrita mantém a formatação, os comentários e o estilo de intervalo da pessoa, e funciona da mesma forma estando a ferramenta instalada ou não. A ferramenta então só é usada para o que só ela pode fazer: o lockfile.

### Rodar a instalação depois

Sim, o mod a roda. O `installArgv` de cada adaptador diz o quê, a partir da tabela do README e do código:

| Ecossistema                           | Depois da reescrita                                                 |
| ------------------------------------- | ------------------------------------------------------------------- |
| npm                                   | `npm install` / `pnpm add` / `yarn add` / `bun add`, como acima     |
| PyPI                                  | `uv lock` ou `poetry lock`; só com `requirements.txt`, nada         |
| Go                                    | `go get <module>@<version>` e `go mod tidy` (sem reescrita)         |
| Cargo                                 | `cargo update -p <crate>` para cada um                              |
| Pub                                   | `flutter pub get` ou `dart pub get`                                 |
| NuGet                                 | `dotnet restore`                                                    |
| RubyGems                              | `bundle update --conservative <gems>`                               |
| SwiftPM                               | `swift package update`, ou `xcodebuild -resolvePackageDependencies` |
| Maven, Gradle wrapper, GitHub Actions | nada: o próximo build ou execução faz o download                    |

Só com `requirements.txt`, o README o diz: não há lockfile, então o botão reescreve os pins e "no instala nada" ("não instala nada"); você instala no seu próprio ambiente.

O npm e o pnpm rodam sob a espera de 24 horas do guia 9, por meio do ambiente que `releaseAgeEnv` monta e do campo `env` de `$.process.run` (nos tipos, "Variables set over the host process's own environment", ou seja, variáveis definidas por cima do próprio ambiente do processo host). Uma dependência nova demais em qualquer lugar da árvore faz a instalação falhar em vez de cair no lockfile.

### Quando algo falha

Três casos, cada um tratado de forma diferente em `upgradeBumps`:

- **A ferramenta não está nesta máquina** (`xcodebuild` fora de um Mac, `cargo` não instalado: a execução é rejeitada com `ENOENT`). Os arquivos reescritos desse ecossistema são gravados de volta como estavam, de modo que um manifest com versão subida nunca sai com um lockfile desatualizado, e os outros continuam. O painel diz qual ficou, por exemplo "Cargo quedó sin actualizar (2 librerías): no pude ejecutar cargo en este equipo y dejé sus archivos como estaban." ("O Cargo ficou sem atualizar (2 bibliotecas): não consegui executar o cargo nesta máquina e deixei os seus arquivos como estavam.")
- **A ferramenta roda e falha.** O painel mostra o comando, o seu código de saída e o fim da sua saída, ou a própria mensagem da espera quando o pnpm ou o npm recusou uma versão nova demais, e varre de novo. Os ecossistemas seguintes não são tentados, e os arquivos já reescritos ficam; `git diff` os mostra.
- **Qualquer outra coisa lança um erro.** "No pude ejecutar …" ("Não consegui executar …") com o erro.

## Construa com o Claude

Peça ao Claude um único botão que suba todas as atualizações seguras de uma vez. A única ideia que ele precisa acertar é o que "seguro" significa aqui: só saltos de patch e minor que nada bloqueia sobem, cada intervalo mantém o seu prefixo, e cada biblioteca continua na sua seção.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No meu mod do Claude Code `my-panel`, adicione um botão "Atualizar tudo" abaixo das atualizações npm que são um patch ou minor e não estão bloqueadas. Escolha o gerenciador de pacotes pelo lockfile (pnpm, yarn, bun; senão, npm). Mantenha o prefixo de cada intervalo: `^1.2.0` com latest 1.4.0 vira `^1.4.0`, `~` continua `~`, sem prefixo continua sem. Rode um comando para `dependencies` e outro com `--save-dev` (ou `-D`) para `devDependencies`, com `$.process.run` e um timeout. Enquanto roda, esconda o botão e mostre "Atualizando N bibliotecas com <manager>…"; um segundo clique não deve fazer nada. Com uma saída diferente de zero, mostre o comando, o seu código de saída e as últimas linhas do stderr. Em caso de sucesso, mostre um toast "N bibliotecas atualizadas" e diga "Rode os testes antes de fazer commit". Varra de novo a partir dos registros em qualquer caso. Teste que os comandos para três atualizações, uma delas de desenvolvimento, são exatamente dois, e que uma atualização bloqueada ou major nunca está neles.

### O que conferir na resposta do Claude

1. Só o grupo `bump` é instalado. Majors e atualizações bloqueadas nunca estão nos comandos.
2. Cada intervalo mantém o seu prefixo `^` ou `~`: `^3.22.0` vira `^3.25.1`.
3. Há um comando para `dependencies` e outro com `--save-dev` (ou `-D`) para `devDependencies`, e o gerenciador de pacotes é escolhido pelo lockfile.
4. Enquanto roda, o botão fica oculto e um segundo clique não faz nada.
5. Uma falha mostra o comando, o seu código de saída e o fim da sua saída. Com sucesso ou falha, a lista é varrida de novo.

Se uma verificação falhar, diga ao Claude o que você vê: "depois que cliquei no botão, uma ferramenta de desenvolvimento foi parar em `dependencies`".

### Como a pessoa autora pediu

O pedido original do botão não foi registrado: ele está no primeiro commit, e nenhum registro de tarefas público cobre a sua criação.

#### Registrado num registro de tarefas

O registro de tarefas `odd/tasks/release-age-all-ecosystems.md` registra, com as palavras do agente, como o passo de instalação foi verificado quando a espera de 24 horas chegou até ele. A sua tarefa T3 é "npm installs with `before` set to 24 hours ago" (o npm instala com `before` definido como 24 horas atrás), e a entrada L3 anota que, com `npm_config_before` um dia para trás, o npm recusou uma versão do tailwindcss publicada havia uma hora e resolveu o seu intervalo para a versão anterior. Essa é uma evidência que o agente reuniu, não um pedido.

`odd/tasks/ecosystems-wave-2.md` lista "the bump button" (o botão de bump) no S3, entre o que tinha que continuar funcionando à medida que novos ecossistemas eram adicionados; essa também é a spec do agente.

#### Reconstrução a partir do histórico de commits

A partir de `git log -S rangeFor`, `git log -S upgradeBumps` e dos commits por ecossistema no narsil-check:

- `1bf736a` (2026-11-04) "feat: add upgrade panel for npm and Expo projects" (adicionar um painel de atualizações para projetos npm e Expo). A sua mensagem: "trivial bumps it installs in one press" (atualizações triviais que ele instala com um clique). `rangeFor`, o `installArgv` de duas seções e `upgradeBumps` estão aqui.
- `a95eb07` (2026-11-04) "refactor: read dependencies through an adapter per ecosystem" (ler as dependências por meio de um adaptador por ecossistema). Os outros ecossistemas "get a generic scan, install and pending check" (recebem uma varredura, uma instalação e uma verificação de pendências genéricas).
- `bbe6519`, `8ae479e`, `503ba95`, `06bcc49` (2026-11-04): "list and upgrade" (listar e atualizar) crates Rust, pacotes Python, pacotes Dart e Flutter, gems Ruby. Cada um traz a sua própria função de spec e a sua reescrita.
- `8c5f2a3` (2026-11-06) "feat: install npm and pnpm upgrades under the 24-hour wait through the whole tree" (instalar as atualizações de npm e pnpm sob a espera de 24 horas em toda a árvore).
- `7125ffd` (2026-11-09) "fix: stop the upgrade button from breaking builds it cannot check" (impedir que o botão de atualização quebre builds que ele não consegue verificar). A sua mensagem: "Skip an ecosystem whose tool is not on the machine, such as xcodebuild outside a Mac, restoring its manifests so a raised version never goes out with a stale lockfile. The other ecosystems still go up." (pular um ecossistema cuja ferramenta não está na máquina, como o xcodebuild fora de um Mac, restaurando os seus manifests para que uma versão subida nunca saia com um lockfile desatualizado; os outros ecossistemas continuam subindo). Ele também tirou de "trivial" os pins de lockfile do Gradle e os pins exatos do Swift.

O padrão: o botão estava lá desde o primeiro commit, e o trabalho posterior restringiu o que "trivial" pode incluir e o que acontece quando falta uma ferramenta.

## Código de referência

Esta é uma resposta correta, escrita para este guia. Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

Esta é uma versão reduzida da ideia, escrita para este guia e conferida com os tipos do Claude Code 2.1.325 (`$.process.run`, `$.ui.toast`). Foi adaptada de `hooks/npm.ts` e `hooks/register.tsx` do [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Só npm; `rescan` é a sua própria varredura.

```ts
import type { EngineInterface } from 'claude-code'

type Bump = { name: string; spec: string; latest: string; isDev: boolean }
type Manager = 'npm' | 'pnpm' | 'yarn' | 'bun'

export function rangeFor(spec: string, latest: string): string {
  const prefix = /^(\^|~)/.exec(spec.trim())?.[1] ?? ''
  return `${prefix}${latest}`
}

export function installArgv(manager: Manager, bumps: Bump[]): string[][] {
  const add = manager === 'npm' ? 'install' : 'add'
  const dev = manager === 'npm' ? '--save-dev' : '-D'
  const argv: string[][] = []
  for (const isDev of [false, true]) {
    const names = bumps
      .filter((b) => b.isDev === isDev)
      .map((b) => `${b.name}@${rangeFor(b.spec, b.latest)}`)
    if (names.length > 0) argv.push([manager, add, ...(isDev ? [dev] : []), ...names])
  }
  return argv
}

let isRunning = false

export async function upgradeAll(
  $: EngineInterface,
  manager: Manager,
  bumps: Bump[],
  rescan: () => Promise<void>,
): Promise<string | undefined> {
  if (isRunning || bumps.length === 0) return undefined
  isRunning = true
  try {
    for (const argv of installArgv(manager, bumps)) {
      const ran = await $.process.run(argv, { timeoutMs: 300_000 })
      if (ran.exitCode !== 0) {
        const tail = (ran.stderr || ran.stdout).trim().split('\n').slice(-5).join('\n')
        return `${argv.slice(0, 2).join(' ')} exited with ${ran.exitCode}:\n${tail}`
      }
    }
    $.ui.toast(`Updated ${bumps.length} libraries with ${manager}.`)
    return 'Run the tests before committing.'
  } finally {
    isRunning = false
    await rescan()
  }
}
```

Guarde a mensagem devolvida num atom e desenhe-a abaixo do botão. Para um segundo ecossistema, adicione antes da instalação um passo de reescrita que substitua só a versão na própria linha da dependência, e grave de volta os arquivos originais se a ferramenta não estiver disponível.

## Erros comuns e como testar

Estes vêm do código, dos testes e dos commits do Narsil Check:

- **Perder o operador.** `^1.2.0` gravado de volta como `1.4.0` muda o que o projeto aceita dali em diante. Mantenha o prefixo.
- **Mover uma dependência de desenvolvimento.** Um único comando de instalação para tudo coloca ferramentas de desenvolvimento em `dependencies` (ou o contrário). Separe por seção.
- **Subir mais do que o grupo seguro.** O botão deve pegar só `bump`; "a blocked upgrade shows what blocks it and the button leaves it out" (uma atualização bloqueada mostra o que a bloqueia, e o botão a deixa de fora) confere isso.
- **Um manifest sem o seu lockfile.** Subir `Cargo.toml` sem `cargo` para atualizar o `Cargo.lock` deixa os dois dessincronizados. Restaure o manifest quando a ferramenta não estiver disponível.
- **Reformatar o arquivo.** Interpretar um arquivo TOML ou YAML e gravá-lo de volta perde os comentários e a ordem. Edite a única linha.
- **Não varrer de novo.** Depois de uma instalação, a lista que você mostra deve ser a nova verdade, com sucesso ou com falha.
- **Chamá-la de segura.** Um patch ainda pode quebrar um build. Diga "rode os testes", como o painel faz.

Para testar, `claude plugin test .` executa `tests/upgrade.test.tsx`: "an upgrade keeps the range prefix package.json wrote" (uma atualização mantém o prefixo de intervalo que o package.json tinha: `^3.22.0` → `^3.25.1`, `~5.4.0` → `~5.9.3`, `1.2.0` → `1.3.0`), "dependencies and devDependencies install in their own sections" (dependencies e devDependencies são instaladas nas suas próprias seções), "the button installs the trivial upgrades and scans again" (o botão instala as atualizações triviais e varre de novo) e "a failed install says why and keeps the list" (uma instalação que falha diz por que e mantém a lista). O arquivo de testes de cada um dos outros ecossistemas confere a sua própria reescrita, por exemplo os do PyPI e do Cargo para o operador e o limite superior.

## Para ir além

- Quando os manifests diferem de `HEAD`, o painel oferece fazer commit deles, fazer push e abrir um pull request. Esse é um guia posterior desta trilha.
- `rangeFor` mantém só `^` e `~`. Estendê-lo para `>=` ou para intervalos com `x` é uma mudança pequena, com um teste por caso.
- Uma equipe que queira que os testes rodem automaticamente poderia encadear um comando de teste depois da instalação; o Narsil Check deixa isso para você de propósito, com o lembrete.
