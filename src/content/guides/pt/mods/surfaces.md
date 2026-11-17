---
title: 'Superfícies: terminal, desktop, VS Code e app móvel'
description: Onde um mod desenha, quais elementos cada superfície tem e como escrever um único hook de desenho que funcione no terminal, no app desktop, no VS Code e no app móvel.
route: mods
order: 4
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: README.md
  - repo: pet
    path: hooks/register.tsx
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: README.md
---

## O que faz

O mesmo mod pode desenhar no terminal, no app desktop do Claude, no VS Code e no app móvel do Claude. Cada um deles é uma superfície, e cada um tem seu próprio conjunto de elementos. Este guia explica como um hook de desenho descobre em qual superfície desenha, o que cada superfície oferece e como escrever uma única árvore que funcione em todas.

## Como funciona por dentro

Um mod desenha registrando um hook em `ui.render` para um componente. O hook recebe uma instância de componente em `e`:

- `e.component`: qual local é desenhado (`AbovePrompt`, `Pane`, `ToolUse` e outros).
- `e.surface`: onde é desenhado: `terminal`, `desktop`, `mobile` ou `vscode`.
- `e.props`: as props do próprio local, como dados simples.
- `e.viewport`: quando a superfície já mediu, o tamanho em que desenha, em células de caractere.

Uma sessão pode desenhar em várias superfícies ao mesmo tempo, por exemplo um terminal e dois celulares. `$.session.surfaces()` lista todas as superfícies em que a sessão desenha, com o terminal primeiro. Um hook de desenho não precisa dessa lista: ele é chamado uma vez por superfície e lê `e.surface` a cada vez.

Os elementos não são globais. `$.ui.resolve(e)` retorna a tabela da superfície em que `e` é desenhado, e o hook extrai dela suas tags JSX por desestruturação. Restringir `e.surface` restringe o tipo da tabela.

| Superfície | Elementos                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `terminal` | `Box`, `Text`, `Button`, `Input`, `Select`, `Link`, `Code`, `Markdown`, `Progress`, além de `Client`, `Raster` e `Image`. Sem `Svg`. |
| `desktop`  | Os nove elementos compartilhados, além de `Svg` e `Client`.                                                                          |
| `vscode`   | A tabela do desktop sem `Client`.                                                                                                    |
| `mobile`   | Os nove elementos compartilhados, além de `Svg`. Sem `Client`.                                                                       |

No celular, um app recebe um `Input` ou um `Select` somente se tiver declarado que os desenha, e um `Box` vazio caso contrário; o mesmo vale para `Progress`, que recai em seu `Box` e seu `Text`. Um hook não tem como saber o que o app recebeu.

Onde cada local é desenhado, conforme o arquivo de declarações informa:

| Local                                            | Emitido em                          | Observações                                                                                                                                                                      |
| ------------------------------------------------ | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AbovePrompt` (a faixa acima do prompt)          | somente terminal, desktop e celular | Uma linha por plugin. A pessoa pode recolhê-la ou focá-la.                                                                                                                       |
| `Pane` (aberto com `$.ui.open`)                  | todas as superfícies conectadas     | Encaixado no layout de tela cheia do terminal; caso contrário, acima do prompt. No app desktop, também pode ser um pequeno `widget`, lido de `e.props.placement`.                |
| `ToolUse` (a linha de uma chamada de ferramenta) | todas as superfícies conectadas     | No celular, uma árvore que mantém a linha costuma ser desenhada como uma linha discreta abaixo dela; um `borderStyle` ou `backgroundColor` no `Box` que a contém pede um cartão. |

Duas saídas não passam por `ui.render`. `$.ui.status(text)` fixa uma linha para o plugin sob o prompt. `$.ui.toast(text)` flutua sobre o canto superior direito da transcrição e, onde a transcrição é impressa no histórico de rolagem, é uma linha na barra de notificações. O arquivo de declarações não lista, superfície por superfície, onde essas duas aparecem.

## Passo a passo

### 1. Uma faixa que lê sua superfície

```tsx
import { atom, read } from 'claude-code'
import type { Register } from 'claude-code'

const calls = atom({ plugin: 'greeter', key: 'calls' } as const, 0)

export const register: Register = (on) => {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const count = await read($, calls)
    const where = e.surface === 'terminal' ? 'in the terminal' : `on ${e.surface}`

    return (
      <Box>
        <Text dimColor>
          {count} tool calls {where}
        </Text>
      </Box>
    )
  })
}
```

`Box` e `Text` estão em todas as tabelas, então esta árvore é desenhada onde quer que a faixa seja emitida. O hook cede a vez a uma pesquisa (`e.props.hasSurvey`) retornando `next(e)`.

### 2. Use um elemento só onde a superfície o tem

Quando uma árvore precisa de um elemento que algumas superfícies não têm, verifique a tabela em vez de presumir. Este exemplo foi adaptado do hook `Pane` no `hooks/register.tsx` do narsil-check, que mostra um SVG somente onde há `Svg` e um campo de texto em todas as superfícies, exceto no celular:

```tsx
on('ui.render', { component: 'Pane', requestId: 'notes' }, async ($, e) => {
  const elements = $.ui.resolve(e)
  const { Box, Text } = elements
  const Input = e.surface !== 'mobile' && 'Input' in elements ? elements.Input : undefined

  return (
    <Box flexDirection="column">
      <Text bold>Notes</Text>
      {Input ? (
        <Input key="new" label="New note" onSubmit={() => undefined} />
      ) : (
        <Text dimColor>Ask Claude to add a note.</Text>
      )}
    </Box>
  )
})
```

A mesma verificação com `'Svg' in elements` mantém o terminal, que não tem `Svg`, em uma alternativa de texto.

### 3. Ajuste o tamanho ao espaço que você recebe

Um hook de `Pane` ou de `AbovePrompt` dimensiona sua árvore por `e.props.bodyColumns`, a caixa em que desenha. Ela é mais estreita que o viewport enquanto um painel está encaixado ao lado da transcrição. Uma mudança de largura executa de novo todos os locais com hooks, então uma árvore dimensionada a partir de `bodyColumns` continua correta.

### 4. Teste em todas as superfícies

`claude plugin test` monta um componente em uma superfície que o teste nomeia, nunca em uma presumida. Repita o mesmo corpo em um laço sobre as superfícies:

```tsx
for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
  const ui = await $.ui.mount({ ...PANE, surface })
  expect(await ui.find({ type: 'Text', text: /Notes/ })).toBeDefined()
  await ui.unmount()
}
```

`PANE` contém `plugin`, `component`, `requestId` e `props`, como no exemplo `pane.test.tsx` da skill.

## Erros comuns e como testar

- **Presumir a tabela de uma superfície.** `Svg` não está na tabela do terminal, e `Raster` e `Image` estão apenas na do terminal. Verifique a tabela (`'Svg' in elements`) ou restrinja `e.surface`, e os tipos dizem quais elementos você pode usar.
- **Uma árvore que não valida.** Um elemento que a superfície não tem, uma prop que ela não aceita ou um filho onde não cabe nenhum faz o hook falhar. Só ele é ignorado, e as partes dos outros plugins continuam sendo desenhadas. O log de depuração e, enquanto a pasta de um plugin recarrega a quente, a transcrição informam o motivo.
- **Depender de `Input` no celular.** Um app móvel que não o desenha não mostra nada no lugar. Ofereça outro caminho, como pedir ao Claude por meio de uma ferramenta registrada.
- **Esperar a faixa em todo lugar.** Nesta versão, o arquivo de declarações emite `AbovePrompt` somente nas superfícies terminal, desktop e celular. Um `Pane` é emitido em todas as superfícies conectadas.
- **Uma única superfície nos testes.** Um teste que monta só em `terminal` não prova nada sobre as outras. Repita em um laço sobre as quatro.

## Para ir além

O README do narsil-pet diz que sua faixa, suas animações, suas dicas e suas barras de uso funcionam onde quer que o Claude Code as desenhe, e lista o terminal, o app desktop, o VS Code e o app móvel. Sua voz, suas notificações e sua janela flutuante rodam no computador em que a sessão roda, então dependem desse sistema, e não da superfície. Seu hook `ui.render` em `AbovePrompt`, em `hooks/register.tsx`, registra quais superfícies pediram a faixa, e `surfaceReport` combina isso com `$.session.surfaces()`.

O README do narsil-check tem uma tabela por superfície: as seções de atualizações, vulnerabilidades e tarefas pendentes funcionam em todas as superfícies, o app móvel não tem campo para digitar tarefas (elas são adicionadas pedindo ao Claude), e as seções de ambiente, conectores e controle remoto só aparecem no app desktop, porque são lidas dos próprios servidores MCP do app desktop. Em `hooks/register.tsx`, o hook `Pane` obtém `Svg` e `Input` da tabela, como no passo 2.
