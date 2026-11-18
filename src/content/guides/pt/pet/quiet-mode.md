---
title: Modo discreto
description: 'Como /narsil discreto silencia a Narsil sem perder os alertas que importam: o que para, o que ainda passa, e por que a linha é traçada em "ela precisa de você".'
route: pet
order: 14
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: types/index.d.ts
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## O que faz

A Narsil fala muito, de propósito: ela fala quando o trabalho começa e termina, alerta quando um turno acaba, dá dicas, propõe próximos passos e resume a sessão. Num dia de reuniões, ou simplesmente num escritório compartilhado, isso é demais.

`/narsil discreto` ("discreto") reduz tudo isso de uma vez. Ela para de falar, para de alertar quando um turno termina e para de oferecer dicas e próximos passos por conta própria. Ela ainda alerta você, sem voz, quando precisa de você ou quando algo falhou, e a faixa continua mostrando o que ela está fazendo. `/narsil normal` traz tudo de volta como estava.

A Narsil tem três formas de dar um passo atrás, e ajuda distingui-las:

| Comando            | O que muda                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `/narsil silencio` | Só a voz. Todo alerta, dica e passo continua chegando, por escrito.                             |
| `/narsil ocultar`  | Só a faixa. A voz e os alertas continuam.                                                       |
| `/narsil discreto` | Voz desligada, alertas de fim de turno desligados, extras automáticos desligados; o resto fica. |

Cada um tem o seu oposto: `voz`, `mostrar` e `normal`. São interruptores independentes, então `/narsil normal` desliga o modo discreto sem religar uma voz silenciada.

## Como funciona por dentro

### Uma preferência: `isQuiet`

O modo discreto é um único booleano, `isQuiet`, no atom `prefs` de `hooks/register.tsx` (o seu tipo, `Prefs`, está em `types/index.d.ts`). O handler do comando `/narsil` o escreve por meio de uma pequena tabela:

```tsx
const change: Record<string, Partial<Prefs>> = {
  ocultar: { isHidden: true },
  mostrar: { isHidden: false },
  silencio: { isMuted: true },
  voz: { isMuted: false },
  discreto: { isQuiet: true },
  normal: { isQuiet: false },
}
```

O patch é mesclado no atom e o objeto `prefs` inteiro é salvo com `$.store.set('prefs', …)`, então o modo dura entre sessões até você mudá-lo. Em `session.start`, as preferências guardadas são mescladas sobre os padrões, o que também cobre valores guardados mais antigos que ainda não têm o campo.

Não há um caminho de código "discreto" próprio. Em vez disso, cada lugar que faz barulho lê `isQuiet` e decide por si. Isso mantém a regra ao lado daquilo que ela governa, e significa que um novo tipo de barulho precisa aderir explicitamente ao modo discreto.

### A linha que ele traça: "precisa de você" passa

Todo alerta passa por `announce` (o guia 6 o cobre por completo). As suas primeiras linhas são onde o modo discreto vive:

```tsx
const { isMuted, isFloating, isQuiet } = await read($, prefs)
// Quiet: no voice, and only what needs you (a question, an error) is told.
if (isQuiet && kind === 'done' && !force) return
const spoken = isMuted || isQuiet ? Promise.resolve() : speak($, voice)
```

Um alerta tem um de três tipos: `done`, `question` ou `error`. No modo discreto:

- um alerta `done` retorna antes de qualquer coisa acontecer: nem janela flutuante, nem notificação do sistema, nem celular, nem voz;
- um `question` ou um `error` segue como de costume para a janela flutuante (ou uma notificação do sistema quando a janela está desligada) e para o celular, só que sem a voz.

O motivo dessa linha está no comentário e no README: o que para é o que você pode perder com segurança. Um turno terminado ainda estará terminado quando você olhar. Uma pergunta ou uma permissão bloqueia o trabalho até você responder, e um erro significa que o trabalho parou. Silenciá-los transformaria um modo discreto num modo quebrado.

A flag `force` deixa dois chamadores passarem mesmo assim. `/narsil prueba` ("teste"), o alerta de teste, é forçado, para que você possa conferir os seus alertas mesmo no modo discreto. O lembrete de cinco minutos para uma permissão ou pergunta deixada esperando também é forçado, embora, como `question`, passaria de qualquer forma.

### O que cada tipo de alerta faz no modo discreto

Percorrendo os chamadores de `announce`:

| Momento                                                | Tipo       | Modo discreto               |
| ------------------------------------------------------ | ---------- | --------------------------- |
| Um turno termina ("He terminado", "Terminei")          | `done`     | barrado                     |
| Um subagente em segundo plano termina bem              | `done`     | barrado                     |
| Um subagente em segundo plano para ou falha            | `error`    | mostrado, sem voz           |
| Um turno falha ("Me he detenido", "Parei")             | `error`    | mostrado, sem voz           |
| Uma pergunta, um plano ou uma permissão                | `question` | mostrado, sem voz           |
| Um turno termina perguntando na caixa de próximo passo | `question` | mostrado, sem voz           |
| Ainda esperando depois de 5 minutos                    | `question` | mostrado, sem voz           |
| `/narsil prueba`                                       | `done`     | mostrado (forçado), sem voz |

### Os outros barulhos

Fora de `announce`, mais quatro lugares leem `isQuiet`:

- **A voz no início do trabalho.** Em `turn.start`, um prompt que você digitou faz com que ela diga uma frase de início, a menos que `isMuted` ou `isQuiet`.
- **Dicas automáticas.** `mayTip` retorna false quando `isQuiet`, antes de contar qualquer coisa. Uma dica que você pede com `/narsil consejo` não é automática e continua respondendo.
- **Próximos passos.** `offerSteps` retorna na hora quando `isQuiet`.
- **O resumo da sessão ociosa.** `tickWatch` mostra o resumo depois de 30 minutos de calma só quando `isQuiet` é false. `/narsil resumen` continua respondendo.

### O que o modo discreto não toca

Ler o código também diz o que fica, e vale a pena saber:

- **A faixa e o conteúdo da janela flutuante.** Estados, manchetes, comentários, a lista de conversas, o relógio do cache e a comemoração de uma subida de nível são desenhados como antes. O modo discreto trata de interrupções, não de informação.
- **A sugestão de `/compact`** do guia 7. Ela é conferida com `isAdviceOn`, não com `isQuiet`, então ainda pode aparecer no modo discreto. `/narsil consejos off` a interrompe.
- **O aviso sobre comandos perigosos** do guia 9: é um comentário na faixa e uma linha de log, não um alerta.
- **O estado silencioso enviado ao tópico `-estado` do celular** (guia 15). Ele nunca gera uma notificação e, enquanto os alertas no celular estão ligados e você escreve de longe, é enviado depois de cada turno, qualquer que seja o modo.

Quando o modo está ligado, o comando `/narsil` sozinho acrescenta uma linha ao seu relatório: "Modo discreto activado: sin voz, sin avisos de fin de turno ni consejos o pasos automáticos." ("Modo discreto ativado: sem voz, sem alertas de fim de turno nem dicas ou passos automáticos.")

## Construa com o Claude

Peça ao Claude uma única preferência salva que abaixe todo barulho que o mod faz. A única ideia que ele precisa acertar é onde fica a linha: um turno terminado pode esperar, mas uma pergunta ou um erro continuam passando, sem a voz.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> O meu mod do Claude Code `my-pet` fala, alerta no fim de cada turno e mostra dicas. Acrescente um modo discreto: `/my-pet quiet` e `/my-pet normal` definem um booleano `isQuiet` nas preferências, salvo com `$.store.set` e carregado em `session.start`. Na função que envia todo alerta, que recebe um tipo (`done`, `question`, `error`), retorne antecipadamente para `done` quando estiver discreto, a menos que o alerta seja um teste forçado, e nunca fale quando estiver discreto; perguntas e erros continuam aparecendo. Pule também as dicas automáticas quando estiver discreto, mas mantenha as dicas que a pessoa pedir. Deixe a faixa como está. Acrescente testes com `claude-code/testing`: no modo discreto, um turno terminado não gera notificação nem voz, e uma chamada `AskUserQuestion` ainda notifica.

### O que conferir na resposta do Claude

1. `/my-pet quiet` e `/my-pet normal` mudam só `isQuiet`, e a preferência é salva com `$.store.set` e carregada em `session.start`, então dura entre sessões.
2. Na função que envia todo alerta, um alerta `done` retorna antecipadamente no modo discreto, a menos que seja o teste forçado, e uma `question` ou um `error` continuam aparecendo.
3. A voz é pulada no modo discreto para todo tipo de alerta.
4. As dicas automáticas são puladas no modo discreto, mas uma dica que a pessoa pede continua sendo respondida.
5. A faixa é desenhada como antes: o modo discreto para as interrupções, não a informação.

Se uma verificação falhar, diga ao Claude o que você vê: "no modo discreto um diálogo de permissão fica esperando e nada me avisa".

### Como a pessoa autora pediu

O pedido original do modo discreto não foi registrado. Os registros públicos de tarefas do projeto não o cobrem.

#### Reconstrução a partir do histórico de commits

A partir de `git log -S isQuiet -- hooks/register.tsx` no narsil-pet:

- `17ffb30` (2026-10-31) "feat: add a quiet mode that only speaks up when Narsil needs you" (acrescentar um modo discreto que só se manifesta quando a Narsil precisa de você). Um único commit acrescenta o modo inteiro: o campo `isQuiet`, o retorno antecipado em `announce`, as verificações nas dicas, nos próximos passos e no resumo ocioso, as palavras `discreto` e `normal`, a linha no relatório do comando sozinho, uma seção do README e um teste. O seu assunto é o design numa frase.
- `665bd4e` (2026-11-06) "feat: speak when work starts and vary every spoken phrase" (falar quando o trabalho começa e variar cada frase falada). A voz de início do trabalho é nova aqui, e lê `isQuiet` desde o primeiro dia. Este é o padrão em ação: um novo barulho adere ao modo discreto quando é acrescentado.

O modo chegou no fim da primeira semana, depois que a voz, os alertas, as dicas e os próximos passos já existiam. Essa ordem se encaixa num caminho comum: um mod ganha funcionalidades uma de cada vez, e só quando elas se acumulam ele precisa de um único interruptor para reduzi-las.

## Código de referência

Esta é uma resposta correta, escrita para este guia. Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

Escrito para este guia e conferido com os tipos da 2.1.325 (`$.store.get`, `$.store.set`, `$.command.register`, `command.run`, `$.ui.notify`, `session.start`, `turn.complete`, `tool.call`). Foi adaptado de `hooks/register.tsx` do [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). O atom `prefs` está declarado em `types/index.d.ts` como `{ isQuiet: boolean }`. A função vazia `speak` é onde vai a sua própria voz, como a do guia 6.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

type Kind = 'done' | 'question' | 'error'
const prefs = atom({ plugin: 'my-pet', key: 'prefs' } as const, { isQuiet: false })

async function speak($: EngineInterface, text: string): Promise<void> {
  // your own voice goes here (guide 6)
}

async function announce(
  $: EngineInterface,
  kind: Kind,
  title: string,
  text: string,
  force = false,
) {
  const { isQuiet } = await read($, prefs)
  // What you can safely miss stays quiet; what blocks the work never does.
  if (isQuiet && kind === 'done' && !force) return
  const spoken = isQuiet ? Promise.resolve() : speak($, text)
  try {
    await $.ui.notify(text, { title })
  } catch {
    // no notification channel on this surface
  }
  await spoken
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'my-pet', description: 'My pet: quiet | normal | test' })
    const saved = await $.store.get('prefs').catch(() => undefined)
    if (saved && typeof saved === 'object') await update($, prefs, (p) => ({ ...p, ...saved }))
    return next(e)
  })

  on('command.run', { command: 'my-pet' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'test') {
      await announce($, 'done', 'Test', 'This is how I will tell you.', true)
      return { text: 'My pet: test alert sent.' }
    }
    if (arg !== 'quiet' && arg !== 'normal') return { text: 'Usage: /my-pet quiet | normal | test' }
    const saved = await update($, prefs, (p) => ({ ...p, isQuiet: arg === 'quiet' }))
    await $.store.set('prefs', saved).catch(() => undefined)
    return {
      text: saved.isQuiet
        ? 'My pet: quiet. I only tell you when I need you.'
        : 'My pet: back to normal.',
    }
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId === undefined && e.tool === 'AskUserQuestion')
      await announce($, 'question', 'I need you', 'I have a question for you.')
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    if (e.reason === 'answer') await announce($, 'done', 'Done', 'I have finished.')
    else if (e.reason !== 'aborted')
      await announce($, 'error', 'I stopped', 'The turn ended with an error.')
    return result
  })
}
```

`update` retorna o novo valor, então o comando salva exatamente o que escreveu. O `try` em volta de `$.ui.notify` segue um comentário no `notify` da Narsil: onde o host não tem nenhum notify, "the call throws before it returns a promise" (a chamada lança uma exceção antes de retornar uma promise), então um `.catch` não a capturaria.

## Erros comuns e como testar

- **Silenciar tudo.** Um modo discreto que também barra perguntas e erros deixa o Claude esperando uma permissão que ninguém vê. Decida por tipo de alerta, conforme perdê-lo bloqueie ou não o trabalho.
- **Uma flag num só lugar.** Se só a função de alerta lê a flag, todo barulho acrescentado depois a ignora. A Narsil lê `isQuiet` em cada lugar que faz barulho, e acrescenta a verificação quando acrescenta o barulho.
- **Deixar o modo discreto barrar o teste.** Sem `force`, `/narsil prueba` não faria nada no modo discreto, e a pessoa pensaria que os alertas estão quebrados.
- **Acoplar interruptores.** `normal` deve desfazer só `discreto`. Se também religasse a voz, uma pessoa que tivesse silenciado a Narsil antes voltaria a ouvi-la.
- **Esquecer de persistir.** Uma preferência guardada só num atom some na próxima sessão.

Para testar, `tests/narsil.test.tsx` tem dois testes para isso. "/narsil discreto keeps her quiet, and /narsil normal brings everything back" (/narsil discreto a mantém calada, e /narsil normal traz tudo de volta) roda num macOS simulado sem a janela flutuante, registra os scripts iniciados para a voz e as notificações, termina um turno e deixa passar onze minutos: nada é falado, nenhuma notificação começa, nenhum modelo é consultado; depois, uma chamada `AskUserQuestion` gera exatamente uma notificação com o título "Narsil · Te necesito" ("Narsil · Preciso de você"). "in quiet mode the phone gets only what needs you" (no modo discreto, o celular recebe só o que precisa de você) confere a mesma regra no celular: depois de um turno terminado e de uma pergunta, só a pergunta é publicada.

## Para ir além

- `announce` em `hooks/register.tsx` é a única função a ler para saber para onde vai cada alerta; o guia de voz e alertas a percorre.
- O comando `/narsil` sozinho imprime todas as preferências de uma vez, incluindo esta. O último guia da trilha, sobre comandos, mostra como ele é construído.
- O próximo guia envia os mesmos alertas ao seu celular e ao seu relógio, sob a mesma regra do modo discreto.
