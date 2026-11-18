---
title: Criar o PR
description: 'Como o Narsil Check transforma manifests atualizados num commit, num branch chore/upgrade-deps e num pull request aberto com o gh, e depois leva você de volta ao branch principal.'
route: check
order: 14
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/git.ts
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
    path: odd/tasks/ecosystems-wave-4.md
---

## O que faz

Depois que as atualizações triviais são instaladas, os manifests no disco não correspondem mais ao último commit. O trabalho que resta é sempre o mesmo: um branch, um commit só com os arquivos de dependências, um push, um pull request com uma descrição legível, e voltar para onde você estava. O Narsil Check faz essas etapas com um clique.

Quando os intervalos de dependências de um manifest diferem do `HEAD`, o painel mostra uma linha como:

```text
Sin commit: 2 librerías actualizadas en package.json
```

Isso diz "Sem commit: 2 bibliotecas atualizadas em package.json". Abaixo dela há um botão, e o seu rótulo depende do branch em que você está:

- No branch principal: **Crear rama, commit y PR** ("Criar branch, commit e PR").
- Em qualquer outro branch: **Commit y push a &lt;rama&gt;** ("Commit e push para &lt;branch&gt;"). Ele faz o commit e o push para esse branch, e nada mais. O pull request fica por sua conta.

No branch principal, o botão faz quatro coisas. Ele cria `chore/upgrade-deps-2026-11-17` (a data do dia), faz ali o commit dos manifests e dos lockfiles, abre um pull request contra o branch principal com o `gh` e volta para o branch principal. O painel então diz `PR creado desde la rama chore/upgrade-deps-2026-11-17. Volviste a main.` ("PR criado a partir do branch …. Você voltou para main.") e um toast traz o endereço do PR.

Não importa quem mudou o manifest. Uma atualização feita pelo painel e uma que você digitou à mão são ambas detectadas, porque a comparação é com o `HEAD`, não com a memória do próprio painel.

## Como funciona por dentro

Os textos e as pequenas decisões ficam em `hooks/git.ts`, como funções puras: o nome do branch, o título e o corpo do commit, o corpo do PR, qual branch conta como o principal e como encontrar o endereço do PR na saída do `gh`. As etapas que rodam git e gh estão em `hooks/register.tsx`, em `checkPending` e `publish`. Essa divisão é a mesma do resto do mod: os testes conferem os textos sem rodar nada.

### Encontrar o que um PR conteria

`checkPending` roda depois de cada varredura. Para cada ecossistema que o projeto usa, e para cada um dos seus manifests, ele lê a versão do último commit com `git --no-pager show HEAD:<manifest>` e a versão no disco, interpreta as duas com o adaptador do ecossistema e compara os intervalos de dependências (`specChanges` em `hooks/adapter.ts`).

Interpretar os dois lados com o adaptador, em vez de comparar o texto, é uma escolha deliberada. Uma mudança em `scripts` no `package.json` não é uma mudança de dependência e não aparece como tal. Um intervalo que foi de `^3.22.0` para `^3.25.1` aparece. Isso também sobrevive a um reinício: o estado pendente é recalculado a partir do git, não guardado em lugar nenhum.

Para cada ecossistema com mudanças, os arquivos candidatos são os seus manifests alterados mais os seus lockfiles, na raiz e onde quer que a árvore os tenha. Depois, `git status --porcelain -- <those files>` fica só com os que o git informa como modificados. Um lockfile que a instalação não tocou fica de fora.

### Qual branch é o principal

`isMainBranch` pergunta `git symbolic-ref --short refs/remotes/origin/HEAD`, que imprime algo como `origin/main`. Quando o origin não nomeia nenhum padrão, `main` ou `master` contam. Um repositório cujo padrão é `develop` é tratado corretamente desde que `origin/HEAD` esteja definido.

### As etapas no branch principal

`publish` roda cada comando por meio de um pequeno helper `step`, que define o estado do painel com o nome da etapa (o painel mostra `Creando la rama…`, "Criando o branch…") e lança um erro com esse nome se o comando falhar. Em ordem:

1. `git branch --show-current`. Uma resposta vazia significa um `HEAD` destacado, e o painel para com "cambia a una rama antes de subir los cambios" ("mude para um branch antes de enviar as mudanças").
2. `git rev-parse --verify --quiet refs/heads/chore/upgrade-deps-<day>`. Se esse branch já existir, `branchName` adiciona a hora e o minuto: `chore/upgrade-deps-2026-11-17-1432`.
3. `git switch -c <branch>`.
4. `git add -- <files>`, depois `git commit -m <title> -m <body> -- <files>`.
5. `git push -u origin <branch>`.
6. `gh pr create --base <main> --head <branch> --title <title> --body <body>`.
7. `git switch <main>`, depois a sessão e a lista de bibliotecas são lidas de novo.

O título do commit é `chore(deps): upgrade 2 dependencies` (ou `1 dependency`), e o corpo lista cada mudança como `- zod: 3.22.0 -> 3.25.1`. O corpo do PR tem um `## Summary` com o gerenciador usado e uma tabela de pacote, de e para, depois um `## Test plan` com duas caixas desmarcadas: rodar a suíte de testes e fazer o build do projeto. As caixas estão ali porque uma atualização trivial ainda precisa de uma pessoa para rodar os testes.

`prUrlOf` pega a última linha da saída do gh que se parece com `https://…/pull/<number>`, já que o gh pode imprimir outras linhas antes dela.

### Por que o commit leva uma lista de caminhos

O commit é `git commit ... -- <files>`, com os arquivos nomeados depois de `--`. Com caminhos informados, o git faz o commit desses arquivos como estão no disco e de nada mais, mesmo que você tivesse outros arquivos no stage. O seu trabalho em andamento fica fora do PR. O README diz isso claramente: "El resto de tus cambios sin commit no se incluye" ("O resto das suas mudanças sem commit não é incluído").

As outras mudanças sem commit viajam com você: `git switch -c` as leva para o novo branch e `git switch <main>` as traz de volta, porque nenhuma delas está no commit e os únicos arquivos que diferem entre os dois branches são os que acabaram de entrar no commit.

### Por que ele volta para o branch principal

A volta para o branch principal foi adicionada depois (`2b91c7d`). Ficar no branch da atualização fazia as pessoas trabalharem por acidente em cima de um branch de PR. De volta ao branch principal há um detalhe que o README explica: os manifests têm de novo as versões antigas, enquanto `node_modules` (ou o seu equivalente) pode ainda ter as novas. Então o painel varre de novo, e o README sugere reinstalar se você continuar trabalhando ali.

Se o git recusar a troca, o painel não tenta forçá-la. Ele fica no novo branch e diz por quê: `PR creado desde la rama …. No pude volver a main: <git's error>` ("Não consegui voltar para main").

### O que acontece quando algo falha

- **Uma etapa falha antes de o PR existir.** O erro nomeia a etapa: `No pude crear el PR. Subiendo la rama: fatal: no remote` ("Não consegui criar o PR. Enviando o branch: …"). Lendo o código, as etapas que já rodaram não são desfeitas: se o push falhar, você fica no novo branch com o commit feito localmente.
- **O gh não está autenticado.** `gh pr create` termina com um erro e o painel mostra o final dele, depois de `Creando el PR:`. O branch já foi enviado a essa altura.
- **O gh não está instalado.** Quando um comando não consegue nem iniciar, `runCommand` tenta mais uma vez como `<name>.cmd` (a forma que o Windows instala) e então desiste. Lendo o código, essa falha é uma rejeição e não um código de saída, então ela chega ao painel sem o nome da etapa.
- **Os dois nomes de branch estão ocupados.** Só o nome do dia é conferido. Se o nome com a hora também existir (duas execuções no mesmo minuto), `git switch -c` falha e o painel diz `Creando la rama: …`. Um branch com esse nome que existe só no remoto não é conferido; nesse caso o push falharia.
- **Dois cliques.** Um clique enquanto o trabalho está `running` não faz nada.

### Os hooks de commit não rodam

Os tipos da 2.1.325 dizem sobre `$.process.run`: "Git runs with repo hooks off" (o git roda com os hooks do repositório desligados). O README concorda: hooks como o husky não rodam nesses commits. Uma equipe que depende de um hook de commit para fazer lint ou assinar vai ver esses commits chegarem sem ele.

### O README e o código

O comentário acima de `publish` ainda diz "A commit of package.json and its lockfile alone" (um commit só do package.json e do seu lockfile), da época em que o mod conhecia só o npm. O código faz o commit dos manifests e dos lockfiles de todos os ecossistemas com mudanças, como diz o README.

## Construa com o Claude

Peça ao Claude um botão que transforme as mudanças de dependências no disco num commit e, no branch principal, num pull request. A única ideia que ele precisa acertar é que o commit leva só os arquivos de dependências: eles são nomeados depois de `--`, então o seu outro trabalho em andamento fica de fora.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No meu mod do Claude Code `my-panel`, adicione um botão que transforma as mudanças de dependências do `package.json` num pull request. Primeiro compare os intervalos de dependências de `git show HEAD:package.json` com o arquivo no disco e liste os que mudaram; mostre o botão só quando houver algum. No clique, com `$.process.run` e sem shell: pare com uma mensagem clara num HEAD destacado; se o branch atual não for o padrão (de `git symbolic-ref --short refs/remotes/origin/HEAD`, senão `main` ou `master`), faça o commit e o push para ele e pare ali. No branch padrão, crie `chore/upgrade-deps-YYYY-MM-DD` (adicione `-HHMM` se esse branch existir), rode `git add -- package.json package-lock.json`, `git commit -m "chore(deps): upgrade N dependencies" -m <list> -- package.json package-lock.json`, `git push -u origin <branch>` e `gh pr create --base <default> --head <branch> --title … --body …` com uma tabela de mudanças e um plano de testes. Depois volte com `git switch` e diga isso; se a troca falhar, fique e mostre o erro do git. Nomeie a etapa que falhou em todo erro. Ignore um segundo clique enquanto roda. Teste respondendo `process.run` nos testes e conferindo o argv exato de cada comando, em ordem.

### O que conferir na resposta do Claude

1. As mudanças pendentes vêm de comparar os intervalos de dependências de `git show HEAD:package.json` com o arquivo no disco, então uma mudança em `scripts` não oferece um PR.
2. O branch principal vem de `git symbolic-ref --short refs/remotes/origin/HEAD`, com `main` ou `master` só quando o origin não indica nenhum. Em qualquer outro branch, o botão faz commit e push ali, e para.
3. O commit nomeia os seus arquivos, como em `git commit -m … -m … -- package.json package-lock.json`, nunca com `git commit -a` nem com um `git commit` sem nada.
4. Depois de `gh pr create`, o botão roda `git switch` de volta para o branch principal. Quando a troca falha, ele fica no branch novo e mostra o erro do git.
5. Cada erro nomeia a etapa que falhou, e um segundo clique enquanto o trabalho roda não faz nada.

Se uma verificação falhar, diga ao Claude o que você vê: "o PR inclui um arquivo que eu ainda estava editando, não só o package.json e o seu lockfile".

### Como a pessoa autora pediu

O pedido original deste recurso não foi registrado. O botão já está no primeiro commit, e nenhum registro de tarefas público cobre a sua criação. Um registro de tarefas posterior o menciona, com as palavras do agente.

#### Registrado num registro de tarefas

`odd/tasks/ecosystems-wave-4.md`, que adiciona os pacotes Swift, lista como spec S2 o que tinha que continuar funcionando. Esta é a spec do agente, não as palavras da pessoa autora:

> "Everything the earlier waves built keeps working for SwiftPM: grouping, the bump button, Haiku reasons, copy buttons, the commit/push/PR button and the auto-open rule."

Tradução para o português: "Tudo o que as ondas anteriores construíram continua funcionando para o SwiftPM: o agrupamento, o botão de atualização, os motivos do Haiku, os botões de cópia, o botão de commit/push/PR e a regra de abertura automática."

#### Reconstrução a partir do histórico de commits

A partir de `git log -- hooks/git.ts` e `git log -S` sobre `hooks/register.tsx` no narsil-check:

- `1bf736a` (2026-11-04) "feat: add upgrade panel for npm and Expo projects" (adicionar um painel de atualizações para projetos npm e Expo). A sua mensagem termina com "Pending upgrades become a commit and push, or a branch and PR from the default branch." (as atualizações pendentes viram um commit e um push, ou um branch e um PR a partir do branch padrão). O nome de branch `chore/upgrade-deps-…`, o commit limitado a caminhos e `gh pr create` já estão aqui.
- `a95eb07` (2026-11-04) "refactor: read dependencies through an adapter per ecosystem" (ler as dependências por meio de um adaptador por ecossistema). As mudanças pendentes são lidas por adaptador, comparando cada manifest com o `HEAD`, então o botão funciona para todos os ecossistemas adicionados depois.
- `2b91c7d` (2026-11-13) "feat: return to the default branch after the PR and warn when the branch is behind" (voltar ao branch padrão depois do PR e avisar quando o branch está atrás). A sua mensagem: "After opening the upgrade PR the pane switches back to the base branch and rescans; a refused switch keeps the new branch and says why." (depois de abrir o PR de atualização, o painel volta para o branch base e varre de novo; uma troca recusada mantém o novo branch e diz por quê).

O design não mudou muito. O que mudou foi onde você termina depois.

## Código de referência

Esta é uma resposta correta, escrita para este guia. Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

Esta é uma versão reduzida da ideia, escrita para este guia e conferida com os tipos do Claude Code 2.1.325 (`$.process.run`, `$.ui.toast`). Foi adaptada de `hooks/git.ts` e de `publish` em `hooks/register.tsx` do [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Ela trata só o branch padrão e recebe os arquivos e as mudanças já encontrados.

```ts
import type { EngineInterface } from 'claude-code'

type Change = { name: string; from: string; to: string }

const pad = (n: number) => String(n).padStart(2, '0')

export function branchName(ms: number, taken: boolean): string {
  const d = new Date(ms)
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return `chore/upgrade-deps-${day}${taken ? `-${pad(d.getHours())}${pad(d.getMinutes())}` : ''}`
}

async function step($: EngineInterface, label: string, argv: string[]): Promise<string> {
  const ran = await $.process.run(argv, { timeoutMs: 60_000 })
  if (ran.exitCode !== 0) throw new Error(`${label}: ${(ran.stderr || ran.stdout).trim()}`)
  return ran.stdout
}

export async function openUpgradePr(
  $: EngineInterface,
  base: string,
  files: string[],
  changes: Change[],
): Promise<string> {
  const title = `chore(deps): upgrade ${changes.length} ${changes.length === 1 ? 'dependency' : 'dependencies'}`
  const body = changes.map((c) => `- ${c.name}: ${c.from} -> ${c.to}`).join('\n')
  const now = Date.now()
  const taken = await $.process.run([
    'git',
    'rev-parse',
    '--verify',
    '--quiet',
    `refs/heads/${branchName(now, false)}`,
  ])
  const branch = branchName(now, taken.exitCode === 0)

  await step($, 'Creating the branch', ['git', 'switch', '-c', branch])
  await step($, 'Staging', ['git', 'add', '--', ...files])
  await step($, 'Committing', ['git', 'commit', '-m', title, '-m', body, '--', ...files])
  await step($, 'Pushing', ['git', 'push', '-u', 'origin', branch])
  const out = await step($, 'Opening the PR', [
    'gh',
    'pr',
    'create',
    '--base',
    base,
    '--head',
    branch,
    '--title',
    title,
    '--body',
    body,
  ])
  const url =
    out
      .split(/\r?\n/)
      .filter((l) => /^https:\/\/\S+\/pull\/\d+$/.test(l.trim()))
      .pop() ?? out.trim()

  const back = await $.process.run(['git', 'switch', base])
  $.ui.toast(
    back.exitCode === 0
      ? `PR opened: ${url}. Back on ${base}.`
      : `PR opened: ${url}. Still on ${branch}.`,
  )
  return url
}
```

Chame-a a partir do `onPress` de um botão, mantenha um estado `running` num atom para que um segundo clique não faça nada e mostre a mensagem do erro, que já nomeia a etapa, quando ela lançar um erro.

## Erros comuns e como testar

Estes vêm do código e dos testes do Narsil Check:

- **`git commit -a` ou um `git commit` simples.** Qualquer um dos dois pode levar arquivos que você nunca quis incluir. Nomeie os arquivos depois de `--`.
- **Comparar texto em vez de intervalos.** Uma mudança de espaços ou um script novo ofereceriam um PR. Interprete os dois lados com o mesmo leitor.
- **Supor que o branch padrão é `main`.** Pergunte primeiro ao `origin/HEAD`.
- **Ficar no branch da atualização.** A próxima mudança cai no PR por acidente. Volte, e diga isso quando não conseguir.
- **Deixar o painel desatualizado depois da troca.** Os manifests mudaram por baixo dele. Varra de novo.
- **Erros sem etapa.** "exit code 128" não ajuda ninguém. Nomeie a etapa.
- **Contar com os hooks de commit.** Eles estão desligados para `$.process.run`; não suponha que um hook faz lint desses commits.

O commit em si leva o arquivo inteiro como está no disco. Se você editou outra coisa à mão no `package.json`, como um script, essa edição também vai para o PR. Confira o diff antes de clicar.

Para testar, `claude plugin test .` executa `tests/upgrade.test.tsx`, que responde ele mesmo a cada `process.run` e registra o argv. "the PR button makes a branch, commits package.json and the lock, pushes and opens a PR" (o botão de PR cria um branch, faz o commit do package.json e do lock, faz o push e abre um PR) confere a ordem dos comandos, o `git add -- package.json package-lock.json` exato, o título do commit e o `gh pr create --base main --head <branch>`, e que `git switch main` vem depois do gh. "on a work branch the button commits and pushes to it, with no new branch or PR" (num branch de trabalho, o botão faz o commit e o push para ele, sem branch nem PR novos), "a PR that is made but cannot go back to the default branch says so and stays on the new branch" (um PR que é criado mas não consegue voltar ao branch padrão diz isso e fica no novo branch) e "a failed push says which step failed" (um push que falhou diz qual etapa falhou) cobrem os outros caminhos. "the branch is named by day, and by time when the day is taken" (o branch recebe o nome do dia, e da hora quando o do dia está ocupado) e "the PR address is the URL gh prints" (o endereço do PR é a URL que o gh imprime) testam as funções puras.

## Para ir além

- O corpo do PR poderia trazer as vulnerabilidades que cada atualização corrige, que o painel já conhece (o próximo guia).
- `gh pr create` aceita `--label` e `--reviewer`. Uma configuração de equipe para eles é uma adição pequena.
- Um branch remoto com o mesmo nome não é conferido. `git ls-remote --heads origin <branch>` antes do push o detectaria.
- O próximo guia deixa as atualizações para tratar de segurança: as vulnerabilidades conhecidas dos pacotes que você tem instalados.
