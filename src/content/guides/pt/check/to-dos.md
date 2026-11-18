---
title: Pendências
description: 'Como o Narsil Check mantém uma lista de pendências por projeto num arquivo JSON não rastreado, a deixa fora do git e nunca sobrescreve uma lista danificada sem uma cópia.'
route: check
order: 15
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/todos.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: README.md
  - repo: check
    path: tests/todos.test.tsx
---

## O que faz

Enquanto você trabalha numa coisa, pensa em outras três: um README para revisar, uma atualização para tentar depois, um teste para adicionar. Elas vão para algum lugar fora do projeto, ou se perdem. O Narsil Check dá a cada projeto a sua própria lista curta, no painel, embaixo.

A seção é **Pendientes** ("Pendências"):

```text
● ▾ Pendientes · 2
  ○ ▾ Raise TypeScript to the next major
       Check moduleResolution first
  ○ Review the README
  [ Nueva tarea (nombre: contenido) ]  Agregar
```

- **Adicionar**: digite no campo e pressione Enter. O que vem depois dos primeiros dois-pontos é o conteúdo: `Raise TypeScript: check moduleResolution first`. Sem dois-pontos, a tarefa tem só um nome.
- **Ler**: um clique num nome mostra ou esconde o seu conteúdo. Uma tarefa sem conteúdo não se expande.
- **Concluir**: um clique em `○` remove a tarefa. Nenhum histórico de tarefas concluídas é mantido.

O ponto fica amarelo enquanto algo espera e cinza quando a lista está vazia. A seção se abre no início de uma sessão quando a lista tem algo, e fica recolhida quando está vazia. No celular não há campo de texto (o app móvel não desenha nenhum); ali a lista é lida, as tarefas são concluídas com `○` e as novas são adicionadas pelo Claude, como mostra o próximo guia.

A lista pertence ao projeto, não à sessão nem às configurações da máquina. Ela é um arquivo dentro do projeto, e nunca chega a um commit.

## Como funciona por dentro

`hooks/todos.ts` contém as partes simples: onde o arquivo fica, como ele é lido e escrito, como uma entrada se divide nos seus dois-pontos e a linha para o arquivo de exclusão do git. `hooks/register.tsx` lê e escreve o arquivo e desenha a seção.

### Onde a lista fica

O arquivo é `.atl/narsil-check/pendientes.json`, abaixo da raiz do projeto. A raiz é o nível superior do git (`git rev-parse --show-toplevel`), senão a pasta da sessão. Usar o nível superior do git significa que a mesma lista é encontrada a partir de qualquer subpasta em que você abra a sessão.

O formato é um JSON pequeno:

```json
{
  "version": 1,
  "tasks": [
    { "id": "mh3k2a1b4c9z", "name": "Review the README" },
    { "id": "mh3k2f9x0q1w", "name": "Raise TypeScript", "content": "Check moduleResolution first" }
  ]
}
```

O campo `version` é escrito mas ainda não é lido; ele deixa espaço para mudar o formato depois. Cada `id` é a hora em base 36 mais quatro caracteres aleatórios, então duas tarefas com o mesmo nome continuam distintas e o Claude pode nomear uma com exatidão. Os ids acima são inventados.

Por que um arquivo e não `$.store`? O armazenamento pertence ao mod naquela máquina. Um arquivo no projeto é do projeto: você pode abri-lo, editá-lo à mão, fazer backup dele, e ele se move com a pasta. E ele permite que um projeto escreva na lista de outro projeto, o que o próximo guia usa.

### Mantê-la fora do git

A lista é pessoal; um pull request nunca deveria levá-la. Adicioná-la ao `.gitignore` mudaria um arquivo rastreado e poria essa mudança diante de todos. Então o mod usa no lugar o arquivo de exclusão local do git, que funciona como o `.gitignore` mas nunca entra num commit.

`excludeTodos` pergunta ao git onde esse arquivo está, com `git rev-parse --git-path info/exclude`, em vez de supor `.git/info/exclude`. Numa worktree vinculada, `.git` é um arquivo, não uma pasta, e o git responde com o lugar certo. Depois, `withExclude` adiciona a linha `/.atl/narsil-check/` a menos que o arquivo já a tenha (ou `.atl/narsil-check` ou `.atl/narsil-check/`), mantendo uma quebra de linha final.

Isso roda a cada mudança, e é seguro repetir: a linha é adicionada uma vez. O README diz "La primera vez" ("Na primeira vez"), que é o que você vê, já que as execuções seguintes não mudam nada.

É também uma questão secundária. Se o arquivo de exclusão não puder ser escrito, o erro é engolido e a tarefa é salva mesmo assim. O README diz isso: "Si ese archivo no se puede escribir, la tarea se guarda igual." Uma pasta que não é um repositório git não tem do que excluir, e a etapa é pulada.

### Escritas seguras: uma mudança de cada vez, sobre o arquivo como ele está agora

A lista pode mudar a partir de três lugares: o campo no painel, o botão `○` e as ferramentas do Claude. O Claude pode estar adicionando uma tarefa enquanto você conclui outra. E outra sessão no mesmo projeto pode ter escrito o arquivo desde que esta o leu.

`changeTodos` trata isso com duas regras:

1. **Uma mudança de cada vez dentro da sessão.** Cada mudança é encadeada numa única promise, `todoChain`. Uma mudança espera a anterior terminar, então duas escritas nunca se intercalam.
2. **Ler logo antes de escrever.** Cada mudança lê o arquivo de novo, aplica a sua edição (adicionar uma, remover uma) ao que está lá agora e escreve a lista inteira de volta. Uma tarefa que outra sessão salvou um minuto atrás é mantida.

A cadeia sobrevive a uma mudança que falhou: ela continua a partir de `run.catch(() => undefined)`, então um erro não bloqueia todos os salvamentos seguintes.

O que isso não protege, e o README é honesto a respeito: duas sessões do mesmo projeto escrevendo no mesmo instante. Nesse caso, a última escrita pode sobrescrever a outra. As escritas também não são atômicas: `$.fs.write` substitui o conteúdo inteiro do arquivo, como dizem os tipos ("the whole new content", o novo conteúdo inteiro); não há arquivo temporário e renomeação. Para uma lista pessoal curta, esse é um limite razoável.

### Um arquivo danificado nunca é lido como vazio

Suponha que você edite o arquivo à mão e deixe uma vírgula sobrando no final. Um leitor descuidado veria um JSON inválido, o trataria como uma lista vazia, e a próxima mudança escreveria uma lista nova por cima das suas tarefas.

`parseTodoFile` distingue os casos. Um arquivo vazio ou ausente é uma lista vazia. Um arquivo que não é JSON dá `{ error: 'no es JSON válido' }` ("não é um JSON válido"), e um sem um array `tasks` dá `{ error: 'no tiene la lista "tasks"' }` ("não tem a lista "tasks""). As entradas sem nome são descartadas; o resto é mantido.

Com um erro, duas coisas acontecem:

- **Na leitura**, o painel mostra o erro em vermelho, `.atl/narsil-check/pendientes.json no se puede leer (…). No lo toco: …`, que diz "não pode ser lido (…). Não mexo nele: corrija-o, ou adicione uma tarefa e eu guardo uma cópia do arquivo antes de começar uma lista nova". Nada é escrito.
- **Na próxima mudança**, o texto danificado é primeiro copiado ao lado como `pendientes.danado-<moment>.json` (`danado` é "danificado"), nomeado pela hora ISO com `:` e `.` substituídos, como `pendientes.danado-2026-11-17T09-30-00-000Z.json`. Depois uma lista nova começa com a mudança, e o painel mostra uma nota amarela dizendo onde está a cópia.

Isso veio de um bug. O commit da correção, `8dc7904`, o descreve: "A list file that is not valid JSON was read as empty and overwritten by the next change." (um arquivo de lista que não era JSON válido era lido como vazio e sobrescrito pela próxima mudança).

A cópia fica dentro da mesma pasta excluída, então ela também não chega ao git.

### Quando ela é lida

`loadTodos` roda no início da sessão, e de novo cada vez que você expande a seção, então uma mudança feita por outra sessão ou à mão aparece quando você olha. Cada mudança atualiza o atom do painel diretamente com a lista que acabou de escrever, mas só quando a mudança foi na lista deste projeto: uma tarefa escrita na lista de outro projeto não substitui o que este painel mostra.

## Como foi pedido à IA

O pedido original deste recurso não foi registrado. Nenhum registro de tarefas público no narsil-check cobre a lista de pendências. O que segue é uma reconstrução.

### Reconstrução a partir do histórico de commits

A partir de `git log -- hooks/todos.ts` no narsil-check:

- `5439638` (2026-11-05) "feat: Pendientes, a per-project task list Claude can read and finish" (Pendientes, uma lista de tarefas por projeto que o Claude pode ler e concluir). A sua mensagem descreve o design inteiro de uma vez: as tarefas "in .atl/narsil-check/pendientes.json, kept out of git through .git/info/exclude" (em .atl/narsil-check/pendientes.json, mantidas fora do git por meio de .git/info/exclude), o campo que adiciona "nombre: contenido" ("nome: conteúdo") e "every change rereads the file, so edits during a turn or from another session are kept" (cada mudança relê o arquivo, então as edições durante um turno ou de outra sessão são mantidas). As ferramentas do Claude e o comando de modelo chegam no mesmo commit.
- `8dc7904` (2026-11-05) "fix: keep a damaged Pendientes list and never let side steps block a save" (manter uma lista Pendientes danificada e nunca deixar que etapas secundárias bloqueiem um salvamento). No mesmo dia. A sua mensagem lista as correções: o arquivo danificado é "reported in the pane and to Claude, left untouched, and copied aside" (informado no painel e ao Claude, deixado intacto e copiado à parte) antes de uma lista nova; "A git exclude file that cannot be written no longer stops the save" (um arquivo de exclusão do git que não pode ser escrito não impede mais o salvamento); o painel móvel "decides by surface whether to draw the field" (decide pela superfície se desenha o campo); "and the README no longer promises safety for two sessions writing at once" (e o README não promete mais segurança para duas sessões escrevendo ao mesmo tempo).

O segundo commit é o mais instrutivo. A primeira versão funcionava no caminho feliz. A correção é uma lista do que pode dar errado em torno de um arquivo: ele pode estar quebrado, uma etapa secundária pode falhar, uma superfície pode não ter um elemento, e uma promessa no README pode ser forte demais.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No meu mod do Claude Code `my-panel`, adicione uma seção de pendências mantida por projeto em `.atl/my-panel/todos.json` abaixo do nível superior do git (`git rev-parse --show-toplevel`, senão a pasta da sessão), como `{ "version": 1, "tasks": [{ "id", "name", "content"? }] }`. Desenhe cada tarefa com um botão `○` que a remove, um nome que alterna o seu conteúdo e um `Input` que adiciona `name: content`, dividido nos primeiros dois-pontos; omita o `Input` na superfície móvel. Mantenha a pasta fora do git adicionando `/.atl/my-panel/` ao arquivo que `git rev-parse --git-path info/exclude` nomeia, uma vez, e nunca deixe essa etapa impedir um salvamento. Passe cada mudança por uma única cadeia de promises, e releia o arquivo antes de cada escrita. Se o arquivo não for um JSON válido ou não tiver um array `tasks`, nunca o trate como vazio: mostre um erro e, na próxima mudança, copie-o para `todos.damaged-<ISO time>.json` antes de começar uma lista nova. Teste um arquivo danificado, um arquivo de exclusão que não pode ser escrito e uma mudança feita por outro escritor entre duas das suas.

## O código mínimo

Esta é uma versão reduzida da ideia, escrita para este guia e conferida com os tipos do Claude Code 2.1.325 (`$.fs.exists`, `$.fs.read`, `$.fs.write`, `$.process.run`). Foi adaptada de `hooks/todos.ts` e de `changeTodos` em `hooks/register.tsx` do [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Ela recebe a raiz do projeto já pronta e deixa o desenho de fora.

```ts
import type { EngineInterface } from 'claude-code'

export type Task = { id: string; name: string; content?: string }

const DIR = '.atl/my-panel'
const FILE = `${DIR}/todos.json`

// A missing or empty file is an empty list; anything else unreadable is an error.
export function parseFile(text: string | undefined): { tasks: Task[] } | { error: string } {
  if (!text?.trim()) return { tasks: [] }
  try {
    const tasks = (JSON.parse(text) as { tasks?: unknown })?.tasks
    if (!Array.isArray(tasks)) return { error: 'no "tasks" list' }
    return {
      tasks: tasks.filter((t): t is Task => typeof t?.name === 'string' && t.name.trim() !== ''),
    }
  } catch {
    return { error: 'not valid JSON' }
  }
}

async function exclude($: EngineInterface, root: string): Promise<void> {
  const ran = await $.process.run(['git', 'rev-parse', '--git-path', 'info/exclude'], { cwd: root })
  if (ran.exitCode !== 0) return
  const rel = ran.stdout.trim().replace(/\\/g, '/')
  const path = /^([A-Za-z]:)?\//.test(rel) ? rel : `${root}/${rel}`
  const text = (await $.fs.exists(path)) ? await $.fs.read(path) : ''
  if (text.split(/\r?\n/).some((l) => l.trim() === `/${DIR}/`)) return
  await $.fs.write(path, `${text}${text === '' || text.endsWith('\n') ? '' : '\n'}/${DIR}/\n`)
}

let chain: Promise<unknown> = Promise.resolve()

export function change(
  $: EngineInterface,
  root: string,
  edit: (tasks: Task[]) => Task[],
): Promise<string | undefined> {
  const run = chain.then(async () => {
    const path = `${root}/${FILE}`
    const text = (await $.fs.exists(path)) ? await $.fs.read(path) : undefined
    const file = parseFile(text)
    let notice: string | undefined
    if ('error' in file) {
      const copy = `${DIR}/todos.damaged-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      await $.fs.write(`${root}/${copy}`, text ?? '')
      notice = `The list was damaged (${file.error}); a copy is in ${copy}.`
    }
    const tasks = edit('error' in file ? [] : file.tasks)
    await exclude($, root).catch(() => undefined)
    await $.fs.write(path, `${JSON.stringify({ version: 1, tasks }, null, 2)}\n`)
    return notice
  })
  chain = run.catch(() => undefined)
  return run
}
```

Adicione uma tarefa com `change($, root, tasks => [...tasks, task])` e conclua uma com `change($, root, tasks => tasks.filter(t => t.id !== id))`, depois escreva a lista nova no seu atom para que o painel se redesenhe.

## Erros comuns e como testar

Estes vêm do código e dos testes do Narsil Check:

- **Ler um arquivo quebrado como vazio.** O próximo salvamento destrói as tarefas. Distinga "vazio" de "ilegível", e copie antes de substituir.
- **Escrever de memória.** Uma lista mantida no estado do painel e escrita de volta perde o que outro escritor adicionou. Leia o arquivo logo antes de cada escrita.
- **Duas escritas ao mesmo tempo.** O campo e a ferramenta do Claude podem disparar juntos. Encadeie-os.
- **Editar o `.gitignore`.** Ele é um arquivo compartilhado e rastreado. Use o arquivo de exclusão local.
- **Supor que `.git` é uma pasta.** Numa worktree não é. Peça o caminho ao git.
- **Deixar uma etapa secundária bloquear a principal.** A linha de exclusão é desejável; o salvamento é o objetivo.
- **Desenhar um elemento que a superfície não tem.** Confira se `Input` existe, e decida pela superfície.

Para testar, `claude plugin test .` executa `tests/todos.test.tsx`. "the list file is read leniently and an entry splits at its first colon" (o arquivo da lista é lido com tolerância e uma entrada se divide nos primeiros dois-pontos) e "the exclude line is added once, and a template is found by its folder name" (a linha de exclusão é adicionada uma vez, e um modelo é encontrado pelo nome da sua pasta) testam as partes puras. "Pendientes starts folded when empty; a task added in the field is saved, kept out of git, and shown" (Pendientes começa recolhida quando vazia; uma tarefa adicionada no campo é salva, mantida fora do git e mostrada) conduz o campo e confere o arquivo e a linha de exclusão. "a damaged list is left as it is and said so; the next change keeps a copy of it before starting a new list" (uma lista danificada é deixada como está e isso é dito; a próxima mudança guarda uma cópia dela antes de começar uma lista nova), "a git exclude file that cannot be written does not stop the task from being saved" (um arquivo de exclusão do git que não pode ser escrito não impede que a tarefa seja salva) e "the mobile app has no text field: an empty list says so, and tasks still finish with ○" (o app móvel não tem campo de texto: uma lista vazia diz isso, e as tarefas ainda são concluídas com ○) cobrem as correções de `8dc7904`.

## Para ir além

- Escreva por meio de um arquivo temporário e uma renomeação se a sua lista virar algo mais valioso.
- Guarde as tarefas concluídas com uma data em vez de removê-las, e mostre as últimas recolhidas.
- Um arquivo de lock ao lado da lista fecharia a brecha de duas sessões escrevendo no mesmo instante, ao custo de lidar com um lock abandonado.
- O próximo guia dá ao Claude as suas próprias ferramentas sobre esta lista: listar, adicionar e concluir tarefas, e escrever na lista de outro projeto.
