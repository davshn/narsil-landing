---
title: O painel lateral
description: 'Como o Narsil Check desenha um painel ao lado do chat com seções recolhíveis, um ponto colorido por seção, o estado recolhido que ele lembra e linhas que você copia com um clique.'
route: check
order: 1
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/words.ts
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: hooks/explain.ts
  - repo: check
    path: hooks/osv.ts
  - repo: check
    path: tests/pane.test.tsx
  - repo: check
    path: odd/tasks/vulnerabilities.md
  - repo: check
    path: odd/tasks/ecosystems-wave-2.md
---

## O que faz

O Narsil Check é um painel que fica ao lado do chat, com o título **● Narsil Check**. Ele é o companheiro da Narsil, a mascote de estado do primeiro percurso, e fala com as cores dela. Onde a Narsil responde "preciso fazer alguma coisa agora?", o painel responde "como vai este projeto?".

O painel é uma coluna de seções, uma por verificação: **Mapa mental** (um mapa ao vivo do trabalho do Claude, o próximo guia), **Entorno** (o ambiente da sessão), **Conectores** (conectores), **Actualizaciones** (atualizações), **Vulnerabilidades** (vulnerabilidades) e **Pendientes** (uma lista de tarefas por projeto). Os rótulos estão em espanhol, como na Narsil.

Cada seção tem um cabeçalho com três partes:

- **Um ponto colorido** que diz a coisa mais urgente dentro da seção, para que você possa ler o painel recolhido.
- **Uma seta**: `▾` quando a seção está aberta, `▸` quando está recolhida. Um clique no cabeçalho recolhe ou abre a seção.
- **Um nome e uma contagem**, como `▾ Actualizaciones · 3` ou `▸ Vulnerabilidades · 2`.

Dentro de **Actualizaciones** e **Vulnerabilidades**, cada grupo (atualizações bloqueadas, versões major, alertas críticos e assim por diante) também se recolhe pelo seu próprio cabeçalho, e o painel lembra quais você fechou. Um clique numa biblioteca ou num alerta a copia para a área de transferência, com uma mensagem curta que diz se deu certo.

O valor está em ter um único lugar para olhar. O README diz que, com o painel aberto, você pode ocultar a barra de sessão do próprio app de desktop e manter um único painel.

## Como funciona por dentro

### Um painel é algo que você abre e depois desenha

Um mod não ganha um painel declarando-o. Ele pede um com `$.ui.open` e depois desenha o conteúdo do painel num hook `ui.render` para o componente `Pane`. São dois passos separados, e os dois estão em `hooks/register.tsx`.

A abertura acontece no hook `session.start`:

```tsx
// Opens on every session: it stands in for the app's session bar.
await $.ui.open({ id: PANE, title: TITLE }).catch(() => undefined)
```

Tradução do comentário para o português: abre em toda sessão, porque faz as vezes da barra de sessão do app.

`PANE` é `'narsil-check'` e `TITLE` é `'Narsil Check'`, os dois em `hooks/words.ts`. O id dá nome ao painel; abrir um id que já está aberto só muda o seu título, segundo os tipos da 2.1.325.

O desenho é um hook filtrado por esse id:

```tsx
on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
  const { Box, Text, Button, Link } = $.ui.resolve(e)
  // ...reads the atoms and returns the tree
})
```

Tradução do comentário para o português: lê os atoms e devolve a árvore.

`$.ui.resolve(e)` dá os elementos que esta superfície consegue desenhar. O hook confere o que recebeu: `Svg` só existe fora do terminal (por isso o mapa do trabalho, com a Narsil bebê no centro, só é desenhado ali), e o app de celular não recebe `Input` (por isso, ali, as tarefas são adicionadas pedindo ao Claude). Ele também lê `e.surface` para decidir se tinge os cabeçalhos dos grupos: o terminal mantém as bordas e não desenha tons.

### O que `isPlaced` significa

`$.ui.open` resolve um resultado, `UiOpenResult` nos tipos. `{ isPlaced: true }` significa que o painel está aberto e desenhado, e o primeiro `ui.render` para `{ component: "Pane", requestId: id }` vem em seguida. `{ isPlaced: false, reason }` significa que o painel está aberto, mas ainda não foi desenhado.

Os tipos dão a regra: um painel aberto em resposta à pessoa (um comando, um prompt, um clique) é posicionado em qualquer largura. Um painel que o mod abre por conta própria espera sem ser desenhado abaixo de 144 colunas de terminal, ou 110 depois que a pessoa já pediu aquele id. Um painel que outro plugin detém é recusado, e a chamada é rejeitada.

O Narsil Check abre o seu painel por conta própria a cada início de sessão, então, num terminal estreito, ele pode esperar sem ser desenhado. O código não lê `isPlaced`; ele só captura a rejeição, para que um painel recusado não quebre o início da sessão. Os testes respondem ao evento `ui.open` com `{ value: { isPlaced: true } }`, como se ele sempre fosse desenhado. Quando a pessoa digita `/narsil-check upgrade` ou `/narsil-check vulns`, o comando chama `$.ui.open` de novo e, como essa abertura responde à pessoa, ele é posicionado em qualquer largura. O README descreve `/narsil-check upgrade` como a forma de abrir o painel de novo depois de fechá-lo.

### As cores do ponto

As cores são uma tabela, `PALETTE` em `hooks/words.ts`, com os mesmos valores dos estados da Narsil. O seu comentário dá o significado: "blue for what is running or informs, gray for what rests, yellow for what waits on you, green for what is done, red for what failed or blocks" (azul para o que está rodando ou informa, cinza para o que descansa, amarelo para o que espera por você, verde para o que está feito, vermelho para o que falhou ou bloqueia).

| Cor      | Valor     | Significado no código                              |
| -------- | --------- | -------------------------------------------------- |
| Vermelho | `#F0435A` | Algo falhou ou bloqueia.                           |
| Amarelo  | `#F5B400` | Algo espera por você.                              |
| Verde    | `#22B573` | Feito, atualizado, nada a fazer.                   |
| Azul     | `#3B8BFF` | Informação, ou algo rodando.                       |
| Cinza    | `#8A90A6` | Em repouso: ainda não lido, ou não merece atenção. |

Cada seção escolhe o seu ponto com uma pequena função pura que confere primeiro o caso mais urgente:

- **Actualizaciones**, `sectionColor`: vermelho se a varredura falhou ou se alguma atualização está bloqueada, amarelo se uma versão major precisa de revisão, azul se uma versão está fora do Expo SDK, verde nos demais casos, cinza enquanto a varredura não terminou.
- **Vulnerabilidades**, `vulnsColor`: vermelho para uma verificação que falhou, cinza antes de ela terminar, verde para nenhuma, e nos demais casos a cor da pior severidade (`SEVERITY_COLOR`: vermelho para crítica e alta, amarelo para moderada, cinza para baixa ou sem classificação).
- **Conectores**, `connectorsColor` em `hooks/session.ts`: vermelho quando não puderam ser lidos, cinza antes de carregar, amarelo quando um precisa de login ou falhou, verde quando todos estão ativos.
- **Entorno**: azul depois que a sessão é lida, cinza antes.

Desde o commit `6291eaf`, a mesma cor também desenha a borda arredondada da seção (`borderStyle: 'round'`, `borderColor`) e, em superfícies que não são o terminal, o cabeçalho de um grupo é tingido com a sua cor em alfa baixo (`${tone}1F`), o que, segundo o comentário, funciona tanto em painéis claros quanto escuros.

A razão de ter uma função por seção, em vez de uma cor guardada ao lado dos dados, é que a cor nunca pode discordar do conteúdo: ela é calculada a partir dele a cada desenho.

### Recolhimentos: um atom por recolhimento, ou uma lista de chaves fechadas

Cada recolhimento é estado, guardado num atom (`atom` de `claude-code`). Há duas formas:

- **Uma seção** tem o seu próprio atom booleano: `isEnvOpen`, `isConnectorsOpen`, `isUpgradeOpen`, `isVulnsOpen`, `isTodosOpen`, `isCiOpen`. O `Button` do cabeçalho o inverte com `update($, isUpgradeOpen, value => !value)`.
- **Um grupo dentro de uma seção** vai para uma única lista, `closedGroups`, com as chaves recolhidas (como `upgrade-blocked` ou `vulns-high`). `toggleGroup` adiciona a chave se ela falta e a remove se ela está lá. Todo grupo começa aberto, porque uma lista vazia significa que nada está fechado.

O hook de render lê esses atoms com `read`, e uma leitura durante um desenho o inscreve: quando um clique chama `update`, o painel se desenha de novo sem nenhuma chamada extra.

### O que ele lembra, e onde

É aqui que o código, os seus comentários e os tipos pedem uma leitura cuidadosa.

A cada `session.start`, o hook põe as seções em valores fixos: Mapa mental e Entorno abertas, Conectores, Actualizaciones e Vulnerabilidades recolhidas, e Pendientes aberta só quando tem tarefas. Actualizaciones e Vulnerabilidades se abrem sozinhas quando encontram algo. O commit que introduziu isso, `c07f5e9`, diz "Fold state is no longer kept across sessions." (o estado recolhido não é mais mantido entre sessões).

Os grupos (`closedGroups`) e o recolhimento de CI (`isCiOpen`) não são redefinidos no início da sessão. Os comentários do código dizem que eles mantêm como você os deixou "across sessions" (entre sessões), e o README diz que o painel "recuerda cuáles cerraste" ("lembra quais você fechou").

Todos eles são atoms, e os atoms passam por `$.state`. Os tipos da 2.1.325 descrevem `$.state` como "Named values held by the host for the session" (valores nomeados mantidos pelo host durante a sessão) que sobrevivem a uma recarga a quente do código do plugin, e acrescentam "Persist through `$.store`." (persista por meio de `$.store`). Um comentário em `hooks/register.tsx` observa que um `/clear` mantém o módulo carregado sob uma nova sessão, que é um caso em que um atom sobrevive a uma sessão. Se você precisa que um recolhimento sobreviva a um reinício do Claude Code, os tipos apontam para `$.store`, não para um atom.

Os atoms são criados com uma opção `shape` (`{ shape: 'closed-1' }`). Os tipos a explicam: o valor é guardado sob essa etiqueta, e uma versão mais nova do código que nomeia outra etiqueta encontra o valor ausente. O comentário acima dos atoms diz para trocar a etiqueta "when its type's fields change" (quando os campos do seu tipo mudam), para que um valor antigo guardado nunca chegue a um código que espera campos novos.

### Copiar para a área de transferência

Cada linha de biblioteca e cada linha de alerta é um `Button` `plain`. O seu clique chama `copyRow`:

```tsx
async function copyRow($: EngineInterface, text: string, surface: Surface): Promise<void> {
  const copied = await $.ui.copy({ text, surface })
  $.ui.toast(copied.isCopied ? 'Copiado al portapapeles.' : `No pude copiar: ${copied.reason}`)
}
```

Tradução das mensagens para o português: "Copiado al portapapeles." (copiado para a área de transferência) e "No pude copiar:" (não consegui copiar).

A superfície vem do clique: `onPress={press => copyRow($, copy, press.surface)}`. Esse detalhe importa. Os tipos dizem que `$.ui.copy` coloca o texto "on the clipboard of a surface the session draws on" (na área de transferência de uma superfície em que a sessão desenha), e que um hook de clique passa `e.surface` para dizer qual; se for omitida, é a primeira superfície da sessão. Uma pessoa que clica no app de desktop quer o texto na área de transferência do desktop, não num terminal ligado à mesma sessão.

O resultado diz se funcionou: `{ isCopied: true }`, ou `{ isCopied: false, reason }` com um motivo de um conjunto fechado (`no-surface`, `no-clipboard`, `refused`). O toast informa os dois casos, então uma cópia que falhou nunca parece uma que funcionou.

O que é copiado é mais que o rótulo da linha. Duas funções puras montam o texto: `upgradeCopyText` em `hooks/explain.ts` (uma atualização com o seu salto e o que a bloqueia, ou o motivo dado pelo Haiku) e `vulnCopyText` em `hooks/osv.ts` (um alerta com a sua severidade, a correção e o link para o OSV).

### Por que as palavras ficam em `hooks/words.ts`

Como na Narsil, o módulo de hooks decide o que aconteceu e `hooks/words.ts` decide como isso é dito: a paleta, os rótulos e as dicas dos grupos (`GROUPS`), os rótulos dos cabeçalhos (`sectionLabel`, `vulnsLabel`, `groupLabel`) e as cores. São funções puras, e por isso `tests/pane.test.tsx` pode conferi-las sem montar nada, como em "the section is colored by what most needs you, and its toggle names it" (a seção é colorida pelo que mais precisa de você, e o seu botão de recolher a nomeia).

## Construa com o Claude

Peça ao Claude um painel lateral com seções que se recolhem e linhas que copiam. A única ideia que ele precisa acertar é que o painel é aberto uma vez e depois desenhado por um hook filtrado pelo seu próprio id, com cada recolhimento guardado num atom que o desenho lê.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> Crie um mod do Claude Code chamado `my-panel` com um painel lateral. Em `session.start`, chame `$.ui.open({ id: 'my-panel', title: 'My panel' })` e capture uma rejeição. Desenhe-o em `ui.render` para `{ component: 'Pane', requestId: 'my-panel' }` com `$.ui.resolve(e)`. Mostre duas seções, cada uma numa caixa com borda arredondada na sua cor, e um cabeçalho com um ponto colorido (vermelho para falha, amarelo para esperando por mim, verde para feito, azul para informação, cinza antes de carregar) e um `Button` `plain` com o rótulo `▾ Name` ou `▸ Name` que a recolhe. Guarde as chaves das seções recolhidas num único atom declarado em `types/index.d.ts`. Faça de cada linha um `Button` `plain` que copia o seu texto com `$.ui.copy({ text, surface: press.surface })` e mostra um toast dizendo se `isCopied` foi true. Confira cada API com os tipos do plugin-authoring e adicione um teste com `claude-code/testing` de que um clique num cabeçalho oculta as suas linhas.

### O que conferir na resposta do Claude

1. `session.start` chama `$.ui.open` com o id e o título do painel, e captura uma rejeição, então um painel que outro plugin ocupa não quebra o início da sessão.
2. O hook `ui.render` é filtrado por `{ component: 'Pane', requestId }` com o próprio id do painel, e obtém os seus elementos de `$.ui.resolve(e)`.
3. O ponto de cada seção vem de uma pequena função que confere primeiro o caso mais urgente. Ele é calculado a partir do conteúdo a cada desenho, não guardado ao lado dos dados.
4. Um clique num cabeçalho muda um atom com `update`, e o painel é desenhado de novo sem chamada extra, porque o desenho lê esse atom.
5. Um clique numa linha chama `$.ui.copy` com `press.surface`, e o toast informa os dois casos: `isCopied` verdadeiro ou falso.

Se uma verificação falhar, diga ao Claude o que você vê: "eu clico no cabeçalho de uma seção e as linhas dela continuam na tela".

### Como a pessoa autora pediu

O pedido original do painel não foi registrado. Dois registros de tarefas públicos do narsil-check citam as palavras da pessoa autora sobre partes dele.

#### Registrado: copiar, e uma seção recolhível

`odd/tasks/vulnerabilities.md` registra, na sua entrada de log L1 (2026-11-05), as duas mensagens que deram início à seção de vulnerabilidades. S1 cita a primeira:

> "podemos checkear vulnerabilidades de la misma forma? es decir crear un sub menu de vulnerabilidades que haga pnpm audit o similar?"

Tradução para o português: podemos verificar vulnerabilidades da mesma forma, ou seja, criar um submenu de vulnerabilidades que execute pnpm audit ou algo parecido?

O registro de tarefas anota então a proposta que a pessoa autora aceitou com "si" ("sim"): entre outras coisas, "a collapsible section "▾ Vulnerabilidades · N" under Actualizaciones, its dot red for critical or high, yellow for moderate, green for none" (uma seção recolhível "▾ Vulnerabilidades · N" abaixo de Actualizaciones, com o ponto vermelho para crítica ou alta, amarelo para moderada, verde para nenhuma). Esse design é a proposta do agente, escrita no registro de tarefas; as palavras da pessoa autora são a pergunta e o "si".

S2 cita a segunda mensagem:

> "solo agregar que me gustaria la opcion de copiar las vulnerabilidades por criticidad al porta papeles, como esta en el upgrade"

Tradução para o português: só acrescentar que eu gostaria da opção de copiar as vulnerabilidades por criticidade para a área de transferência, como está na seção de atualizações.

#### Registrado: quando o painel deveria abrir

`odd/tasks/ecosystems-wave-2.md` (o seu log começa em 2026-11-04) lista em S3 o comportamento que tinha de permanecer, incluindo uma regra anterior citada com as palavras da pessoa autora:

> "el panel solo deberia abrirse automaticamente cuando haya versiones por actualizar, ya de resto que deba abrirse con /upgrades"

Tradução para o português: o painel só deveria abrir automaticamente quando houver versões para atualizar; nos demais casos, deveria ser aberto com /upgrades.

Essa regra não durou. `/upgrades` virou `/narsil-check upgrade` em `684837f` e, desde `be8eac0`, o painel abre em toda sessão, porque assumiu a função da barra de sessão do app (veja abaixo).

#### Reconstrução a partir do histórico de commits

A partir de `git log -- hooks/register.tsx hooks/words.ts` no narsil-check:

- `1bf736a` (2026-11-04) "feat: add upgrade panel for npm and Expo projects" (adicionar um painel de atualizações para projetos npm e Expo). O painel começa como uma lista de atualizações.
- `684837f` (2026-11-04) "feat!: rename to narsil-check, with /narsil-check upgrade and Narsil's look" (renomear para narsil-check, com /narsil-check upgrade e a aparência da Narsil). A sua mensagem: o painel usa a paleta e os cabeçalhos da Narsil ("a colored dot and a bold name", um ponto colorido e um nome em negrito), e a seção de atualizações se recolhe pelo seu cabeçalho.
- `912478b` (2026-11-04) "feat: check known vulnerabilities with OSV.dev in a collapsible section" (verificar vulnerabilidades conhecidas com o OSV.dev numa seção recolhível).
- `be8eac0` (2026-11-05) "feat: show the session bar's environment, connectors and Remote Control in the pane" (mostrar no painel o ambiente, os conectores e o Remote Control da barra de sessão). A sua mensagem: "The pane opens on every session" (o painel abre em toda sessão).
- `c07f5e9` (2026-11-05) "feat: Entorno starts open, other sections fold until they have something" (Entorno começa aberta, as outras seções ficam recolhidas até terem algo). Os recolhimentos iniciais fixos.
- `b3ad055` (2026-11-06) "feat: fold upgrade and vulnerability groups, copy a row on click, show baby Narsil and pull the branch" (recolher os grupos de atualizações e de vulnerabilidades, copiar uma linha com um clique, mostrar a Narsil bebê e fazer pull do branch). A sua mensagem: cada grupo "folds on its own header and stays as left" (se recolhe pelo seu próprio cabeçalho e fica como foi deixado), e "A press on a library or an advisory copies it, replacing the per-group copy buttons" (um clique numa biblioteca ou num alerta a copia, substituindo os botões de cópia por grupo).
- `d5b08c3` (2026-11-06) "feat: center the pane's title and baby Narsil" (centralizar o título do painel e a Narsil bebê). Mais tarde, a Narsil bebê saiu do topo do painel e foi para o centro do mapa do trabalho (o próximo guia).
- `6291eaf` (2026-11-06) "feat: give the pane a health bar, state-colored panels and tinted group heads" (dar ao painel uma barra de saúde, painéis coloridos pelo estado e cabeçalhos de grupo tingidos).

O padrão: primeiro uma lista de atualizações, depois a aparência da Narsil, depois uma seção por verificação, sempre com o mesmo cabeçalho (ponto, seta, nome, contagem), e a cópia passando de um botão por grupo para um clique na própria linha.

## Código de referência

Esta é uma resposta correta, escrita para este guia. Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

Esta é uma versão reduzida da ideia, escrita para este guia e conferida com os tipos do Claude Code 2.1.325. Foi adaptada de `hooks/register.tsx` e `hooks/words.ts` do [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later); as cores são a sua `PALETTE`, e as linhas são sintéticas.

O tipo do estado, em `types/index.d.ts`:

```ts
declare module 'claude-code' {
  interface PluginState {
    'my-panel': { closed: string[] }
  }
}
export {}
```

O módulo de hooks, `hooks/register.tsx`:

```tsx
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const PANE = 'my-panel'
const COLOR = { error: '#F0435A', waiting: '#F5B400', done: '#22B573', info: '#3B8BFF' } as const

const SECTIONS = [
  {
    key: 'checks',
    title: 'Checks',
    color: COLOR.waiting,
    rows: ['lint · 2 warnings', 'build · ok'],
  },
  { key: 'notes', title: 'Notes', color: COLOR.info, rows: ['Release acme/shop on Friday'] },
]

const closed = atom({ plugin: 'my-panel', key: 'closed' } as const, [] as string[])

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.ui.open({ id: PANE, title: 'My panel' }).catch(() => undefined)
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const shut = new Set(await read($, closed))
    const toggle = (key: string) =>
      update($, closed, (keys) =>
        keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key],
      )
    const copy = async (text: string, surface: Parameters<typeof $.ui.copy>[0]['surface']) => {
      const copied = await $.ui.copy({ text, surface })
      $.ui.toast(copied.isCopied ? 'Copied.' : `Could not copy: ${copied.reason}`)
    }

    return (
      <Box flexDirection="column">
        {SECTIONS.map((s) => (
          <Box
            key={s.key}
            flexDirection="column"
            borderStyle="round"
            borderColor={s.color}
            paddingX={1}
            marginTop={1}
          >
            <Box flexDirection="row" gap={1}>
              <Text bold color={s.color}>
                ●
              </Text>
              <Button
                key={`section-${s.key}`}
                plain
                label={`${shut.has(s.key) ? '▸' : '▾'} ${s.title}`}
                onPress={() => toggle(s.key)}
              />
            </Box>
            {!shut.has(s.key) &&
              s.rows.map((row, i) => (
                <Button
                  key={`row-${s.key}-${i}`}
                  plain
                  label={row}
                  onPress={(press) => copy(row, press.surface)}
                />
              ))}
          </Box>
        ))}
      </Box>
    )
  })
}
```

Três detalhes sustentam o design. O painel é aberto uma vez e desenhado por um hook filtrado pelo seu próprio `requestId`, então ele nunca desenha o painel de outro plugin. O recolhimento vive num atom que o hook de render lê, então um clique só precisa fazer `update` dele. E a cópia recebe a `surface` do clique, então o texto vai parar onde a pessoa clicou.

## Erros comuns e como testar

Estes vêm do código e dos commits do Narsil Check:

- **Supor que o painel está desenhado porque `open` resolveu.** Num terminal estreito, uma abertura não pedida resolve `{ isPlaced: false, reason }` e espera. Se algo depende de o painel estar visível, leia `isPlaced`; um comando que a pessoa digita o abre em qualquer largura.
- **Deixar uma abertura recusada quebrar o início.** Outro plugin pode deter o id, e a chamada é rejeitada. O Narsil Check termina a chamada com `.catch(() => undefined)`.
- **Copiar para a superfície errada.** Omitir `surface` copia para a primeira superfície da sessão. Passe `press.surface` a partir do botão.
- **Confiar cegamente em `isCopied` num terminal.** Os tipos observam que o OSC 52 não dá retorno: um terminal que o descarta, sem nenhuma ferramenta de área de transferência na máquina, ainda lê true.
- **Guardar um valor cujos campos mudaram sob a mesma etiqueta.** Mude o `shape` do atom quando o seu tipo mudar, como diz o comentário acima dos atoms do Narsil Check.
- **Esperar que um atom sobreviva a um reinício.** Os tipos mantêm `$.state` durante a sessão e apontam para `$.store` para persistência.
- **Desenhar tons no terminal.** O Narsil Check só tinge os cabeçalhos de grupo quando `e.surface !== 'terminal'`; o terminal mantém só as bordas.

Para testar, `claude plugin test .` executa os arquivos `*.test.tsx` do mod. `tests/pane.test.tsx` no narsil-check é um bom modelo: ele responde a `ui.open` com `{ value: { isPlaced: true } }`, monta o painel com `$.ui.mount({ plugin, component: 'Pane', requestId, props, surface })`, clica nos cabeçalhos pela chave (`ui.press({ key: 'section-upgrade' })`) e procura textos com `find`. Testes que vale a pena copiar pelo nome incluem "the section is colored by what most needs you, and its toggle names it" (a seção é colorida pelo que mais precisa de você, e o seu botão de recolher a nomeia), "the work map is the first section, open, with baby Narsil at its core; the terminal draws neither" (o mapa do trabalho é a primeira seção, aberta, com a Narsil bebê no centro; o terminal não desenha nenhum dos dois) e "each section is a panel bordered in the color of its state; the desktop tints group heads and counts, the terminal keeps borders alone" (cada seção é um painel com borda na cor do seu estado; o desktop tinge os cabeçalhos de grupo e as contagens, o terminal mantém só as bordas).

## Para ir além

O painel completo do narsil-check acrescenta muita coisa em torno da mesma estrutura:

- Uma barra de saúde abaixo do título (`healthOf` e `healthSvg` em `hooks/words.ts`) que divide o estado do projeto em partes, uma por cor.
- O mapa do trabalho (o próximo guia): um SVG animado com a Narsil bebê no centro, repintado por uma media query `prefers-color-scheme` dentro do SVG, para que ele acompanhe o tema do app sem nenhuma palavra do motor.
- As seções da sessão (o terceiro e o quarto guias) e o recolhimento de CI do seu pull request (o quinto).
- **Actualizar rama** (atualizar branch) no fim, um `git pull -r` que o próprio mod executa, e um aviso grande no topo quando o branch está atrás do seu remoto.
- O comando `/narsil-check` com `upgrade`, `vulns` e `template "…"`, registrado em `session.start` com `$.command.register`.
