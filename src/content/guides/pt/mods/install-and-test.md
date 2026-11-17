---
title: Instalar, recarregar, validar e testar
description: Carregue um mod a partir da sua pasta ou de um marketplace local, recarregue-o após uma edição e verifique-o com claude plugin validate, claude plugin test e tsc.
route: mods
order: 3
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: .claude-plugin/marketplace.json
  - repo: pet
    path: README.md
  - repo: check
    path: .claude-plugin/marketplace.json
  - repo: check
    path: tsconfig.json
  - repo: check
    path: tests/pane.test.tsx
  - repo: check
    path: README.md
---

## O que faz

Este guia pega o mod `greeter` de "Do que é feito um mod" e o executa em uma sessão, recarrega-o após uma mudança e o verifica de três formas: `claude plugin validate` para o que o motor vai ver, `claude plugin test` para o que os hooks fazem e `tsc` para os tipos.

## Como funciona por dentro

O Claude Code lê um mod de um de dois tipos de lugar, e isso decide como uma edição chega a uma sessão em execução:

| Como é carregado                                                                   | Como uma edição chega                                                                                                                              |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `claude --plugin-dir <folder>`, ou uma pasta indicada em `CLAUDE_CODE_PLUGIN_DIRS` | Em uma sessão interativa, a pasta é observada: salvar um arquivo recarrega o módulo de hooks.                                                      |
| Instalado de um marketplace que é uma pasta local, com um `source` relativo        | Rode `/reload-plugins`. A sessão relê a própria pasta, sem nova versão e sem reinstalar.                                                           |
| Instalado de um repositório git, do npm, de um arquivo compactado ou de uma URL    | A sessão executa a cópia feita na instalação. Uma edição só chega como nova versão, por meio de `claude plugin update` e depois `/reload-plugins`. |

Uma recarga executa `register` de novo em um ambiente novo. As variáveis do módulo e os temporizadores pendentes desaparecem; os valores em `$.state` e `$.store` permanecem.

## Passo a passo

### 1. Execute a partir da pasta

Para uma sessão:

```bash
claude --plugin-dir ./greeter
```

Repita a flag para carregar várias pastas. Onde não é possível passar uma flag (uma sessão que o app desktop ou um host do SDK inicia), defina `CLAUDE_CODE_PLUGIN_DIRS` com um ou mais caminhos absolutos (`~` é permitido), separados pelo separador de listas de caminhos da plataforma. Ela é lida do ambiente do processo ou do bloco `env` de `~/.claude/settings.json`, nunca das configurações de um projeto.

Em uma sessão interativa, a pasta é observada. Um salvamento recarrega o módulo assim que a pasta fica sem mudanças por um momento; os salvamentos feitos enquanto um turno está em andamento recarregam uma única vez, quando o turno termina. Rode com `claude --debug` durante o desenvolvimento: quando um hook é ignorado ou um módulo não carrega, a transcrição informa isso uma vez, e o log de depuração registra cada ocorrência.

### 2. Transforme a pasta em um marketplace local

Um marketplace é um arquivo, `.claude-plugin/marketplace.json`, ao lado de `plugin.json`. Sua única entrada aponta para a própria pasta:

```json
{
  "name": "greeter-dev",
  "owner": { "name": "Example Author" },
  "plugins": [{ "name": "greeter", "source": "./" }]
}
```

Adicione a pasta como marketplace e instale o mod a partir dela:

```bash
claude plugin marketplace add ./greeter
claude plugin install greeter@greeter-dev
```

No prompt de uma sessão de terminal, a linha de instalação também tem a forma `/plugin install <mod> --marketplace <source>`, em que a origem é um `<owner>/<repo>` do GitHub, uma URL git ou o caminho de uma pasta. `claude plugin list` mostra a pasta de onde um plugin é lido (`Read from:`).

Como o `source` da entrada é um caminho relativo, a sessão lê o mod dessa pasta, não de uma cópia. Depois de uma edição, rode:

```text
/reload-plugins
```

A recarga nomeia o plugin e a pasta quando a pasta mudou desde a última vez que a sessão a leu.

### 3. Valide

```bash
claude plugin validate ./greeter
```

Ele lê o arquivo do marketplace, o manifesto, o contrato de tipos e o código-fonte do módulo de hooks da mesma forma que o motor vai ler, e informa o que o módulo usa como hooks e chamadas e tudo o que o motor recusaria, antes que uma sessão o carregue. Para o `greeter`, a seção de hooks diz:

```text
❯ ./register.tsx hooks: session.start, tool.call
❯ ./register.tsx gating hook without .catch: tool.call
❯ ./register.tsx calls: $.state.get, $.state.set, $.ui.status, $.ui.toast
❯ ./register.tsx state writes: greeter.calls
❯ ./register.tsx state reads: greeter.calls
```

A mesma execução também lista as verificações que o diretório público de plugins aplica (um README de pelo menos 40 palavras, um arquivo `LICENSE` ou um `license` em `plugin.json`, um ícone). Elas importam para uma submissão, não para executar o mod.

O validate conhece o mod, não uma sessão: se um hook realmente rodou é algo que se verifica na sessão, com `claude --debug`.

### 4. Teste

`claude plugin test <folder>` executa os arquivos `*.test.ts` e `*.test.tsx` do plugin contra o próprio motor. Um teste importa `test` e `expect` (e `mock`) de `claude-code/testing` e recebe o `$` do motor e um `on` cujos hooks ficam abaixo do plugin, fazendo o papel do motor. Não há mais nada abaixo deles, então o teste responde ao que o plugin chama: uma chamada a `$` com `{ value }`, um evento com o seu próprio resultado.

Escreva `tests/greeter.test.tsx`:

```tsx
import { expect, test } from 'claude-code/testing'

test('greets on start and counts tool calls', async ($, on) => {
  const toasts: string[] = []
  const lines: (string | undefined)[] = []

  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.status', (_, e) => {
    lines.push(e.text)
    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.tool.call({ tool: 'Bash', command: 'pwd' })

  expect(toasts).toEqual(['Hello from greeter'])
  expect(lines.at(-1)).toBe('greeter: 2 tool calls')
})
```

Execute:

```bash
claude plugin test ./greeter
```

```text
(pass) greets on start and counts tool calls
 1 pass
 0 fail
```

Um teste de interface monta um componente por meio do plugin em uma superfície que ele nomeia (`$.ui.mount({ plugin, surface, component, props })`) e age sobre o desenho pela chave: `find`, `press`, `input`. Escreva o corpo uma vez e repita-o em um laço sobre as superfícies, para que o teste mostre que o mod não depende de uma delas. O exemplo `pane.test.tsx` da skill monta um `Pane` em `terminal`, `desktop`, `vscode` e `mobile` em um único laço.

### 5. Verifique os tipos

Quando o Claude Code carrega um mod de uma pasta em que ele está sendo escrito (uma pasta de `--plugin-dir` ou de `CLAUDE_CODE_PLUGIN_DIRS` que a sessão recarrega a quente), ele coloca as declarações da API ao lado, em `.claude-plugin/types/`, com um `tsconfig.json`. O `tsconfig.json` do próprio mod o estende:

```json
{
  "extends": "./.claude-plugin/types/tsconfig.json"
}
```

Depois:

```bash
npx tsc -p ./greeter
```

`.claude-plugin/types/` é gerado de novo a cada carregamento, então mantenha-o fora do git. Os dois mods do Narsil o listam no `.gitignore`.

Uma pasta que a sessão não recarrega a quente (a de um plugin instalado, ou uma de `--plugin-dir` com `claude -p`) nunca recebe esses arquivos. Verifique os tipos de um mod assim com o `tsconfig.json` impresso no cabeçalho de `claude-code.d.ts`, mantido fora da pasta do mod, com seu `include` apontando para uma cópia do arquivo de declarações e para `hooks`, `types` e `tests` do mod.

## Erros comuns e como testar

- **Editar uma cópia que a sessão não executa.** Um mod instalado de um repositório git executa a cópia instalada. Durante o desenvolvimento, instale de um marketplace de pasta local ou carregue a pasta com `--plugin-dir`.
- **Um hook de teste que não retorna nada.** Em `claude plugin test`, um hook que faz o papel do motor precisa responder. Uma chamada a `$` respondida com nada falha com "returned no result" e "nothing beneath the plugins answers ui.toast".
- **Testar uma única superfície.** Repita os testes de interface em um laço sobre as superfícies que você suporta; os apps móveis podem não desenhar `Input` ou `Select`.
- **Fazer commit de `.claude-plugin/types/`.** Ele pertence à versão que o gerou. Gere-o de novo, nunca o edite.
- **Esperar que o validate execute o código.** Ele lê o código-fonte. O comportamento é o que `claude plugin test` e uma sessão com `--debug` mostram.

## Para ir além

Os dois mods do Narsil incluem um arquivo de marketplace que lista o mod com `"source": "./"`: o `.claude-plugin/marketplace.json` do narsil-pet dá ao marketplace o nome `narsil`, e o do narsil-check, o nome `narsil-check`. Os READMEs instalam com duas linhas no prompt do Claude Code:

```text
/plugin marketplace add davshn/narsil-pet
/plugin install narsil-pet@narsil
```

e atualizam com `/plugin marketplace update` seguido de `/plugin update`. O README do narsil-check descreve o fluxo local deste guia: adicione a pasta da sua cópia com `claude plugin marketplace add`, e as mudanças chegam com `/reload-plugins`, sem reinstalar. Seu `tsconfig.json` é o `extends` de uma linha mostrado acima, e sua pasta `tests/` contém um `*.test.tsx` por funcionalidade; `tests/pane.test.tsx` monta o painel com uma constante `PANE` da mesma forma que o exemplo da skill.
