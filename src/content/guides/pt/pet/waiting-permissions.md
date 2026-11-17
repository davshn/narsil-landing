---
title: Permissões que esperam
description: 'Como a Narsil insiste uma vez quando uma permissão, uma pergunta ou um plano espera por você há cinco minutos, e por que ela confere num batimento em vez de criar um temporizador.'
route: pet
order: 10
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/watch.ts
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: overlay/server.cjs
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## O que faz

O Claude costuma parar no meio de um turno para lhe perguntar algo: permissão para executar uma ferramenta, uma pergunta ou um plano para aprovar. A Narsil avisa você nesse momento, como mostram os guias anteriores (o estado "TE NECESITA", a voz, a janela flutuante).

Mas esse primeiro alerta é fácil de perder. Você estava em outra janela, ou o viu e pretendia voltar. Cinco minutos depois, se a mesma coisa ainda estiver esperando, a Narsil insiste uma vez:

```text
Sigo esperándote
Sigo esperándote desde hace 5 min: pido permiso para usar Bash.
```

"Continuo esperando por você, já há 5 minutos: estou pedindo permissão para usar Bash." A segunda metade diz o que está esperando, então uma pergunta aparece como "tengo una pregunta para ti" ("tenho uma pergunta para você") e um plano como "tengo un plan para que lo apruebes" ("tenho um plano para você aprovar").

A insistência sai como um alerta de pergunta: na janela flutuante, em voz alta com uma das frases de `stillWaiting` ("Sigo aquí, esperándote.", "continuo aqui, esperando por você"), e no celular segundo as regras do guia de voz e alertas. O README acrescenta o detalhe que a distingue do primeiro alerta: ela aparece "aunque estés mirando Claude", mesmo enquanto você está olhando para o Claude.

Isso acontece uma vez por espera. Se você ainda assim não responder, a Narsil não continua insistindo.

## Como funciona por dentro

### Uma espera é uma variável de módulo

O que espera fica guardado numa variável em `hooks/register.tsx`:

```tsx
let waiting: { since: number; what: string; isNudged: boolean } | null = null
```

`startWaiting($, what)` a preenche com o horário atual de `$.clock.now()`; `stopWaiting()` a volta para `null`. Uma variável de módulo basta: a espera pertence a esta conversa, e ninguém mais a lê.

### O que inicia uma espera

Três lugares chamam `startWaiting`, os mesmos três que disparam o primeiro alerta:

- **`classic.PermissionRequest`**, uma caixa de diálogo de permissão. O primeiro guia explica por que a Narsil escuta aqui e não em `tool.check`: o motor só o dispara quando está prestes a mostrar a caixa de diálogo a você. Mesmo assim, o hook o ignora quando um hook das configurações já respondeu (`result.decision` está definido) ou o modo é `bypassPermissions`.
- **`tool.call` para `AskUserQuestion` ou `ExitPlanMode`**, uma pergunta ou um plano. Aqui a espera envolve a própria chamada: `startWaiting` antes de `next(e)`, e `stopWaiting()` num `finally`, para que ela termine quando a ferramenta retornar, seja como for que retorne.
- **`turn.complete` com uma pergunta na caixa de próximo passo do aplicativo de desktop**, um turno que terminou perguntando algo a você.

### O que a encerra

Nenhum temporizador é criado, então não há nada para cancelar. Uma espera termina quando `waiting` volta a ser `null`, e todo sinal de que você respondeu faz isso:

- `classic.PostToolUse` e `classic.PostToolUseFailure`: a ferramenta foi executada, então você a permitiu.
- `classic.PermissionDenied`: você disse que não. O comentário sobre esses três hooks: "A permission answered, either way: nothing waits any more." (uma permissão respondida, num sentido ou no outro: nada espera mais).
- Qualquer outro `tool.call`: outro passo começou, então o que esperava foi respondido.
- `turn.start` e `turn.complete`: um novo turno, ou o fim deste.

### Sem temporizador: o batimento confere

A Narsil já tem um batimento: `$.clock.every(2000, ...)` iniciado em `session.start`, que também faz a contagem regressiva do cache (guia 8). A cada batida, `tickWatch` faz uma única pergunta:

```tsx
if (waiting && !waiting.isNudged && now - waiting.since >= NUDGE_AFTER_MS) {
  waiting.isNudged = true
  const text = nudgeText(waiting.what, now - waiting.since)
  void announce($, 'question', 'Sigo esperándote', text, say('stillWaiting'), true).catch(
    () => undefined,
  )
}
```

Os tipos da 2.1.325 oferecem um temporizador de disparo único, `$.clock.after`, e uma versão poderia iniciar um em cada `startWaiting` e cancelá-lo em cada `stopWaiting`. A Narsil não faz isso, e o seu código diz por que em outro lugar: um comentário em `turn.complete` observa que um recarregamento do mod, que acontece depois de qualquer turno que o editou, cancela os temporizadores de `$.clock`. Com o batimento, a conferência é uma comparação de dois números, e nenhum dos lugares que encerram uma espera precisa se lembrar de um temporizador.

O batimento também não faz a espera sobreviver a um recarregamento: `waiting` é uma variável de módulo e volta a começar vazia. A diferença está em como ela falha. Uma espera perdida significa um lembrete a menos, nunca um lembrete de algo que você já respondeu.

### Por que uma vez, e por que cinco minutos

`isNudged` faz com que seja uma vez só. Um lembrete a cada cinco minutos transformaria a Narsil no tipo de alarme que as pessoas desligam, e o primeiro alerta mais um lembrete já cobrem o caso habitual de uma notificação perdida.

Cinco minutos é `NUDGE_AFTER_MS` em `hooks/watch.ts`. No início eram dois minutos; o commit que o aumentou, `2bcc97c`, tem como título "calm loop, steps and permission alerts" (acalmar os alertas de laço, de passos e de permissão). O mesmo commit levou os próximos passos de 3 para 15 minutos: a pessoa autora estava espaçando tudo o que a Narsil diz sem que lhe peçam.

`nudgeText` monta a frase; `took` de `hooks/agents.ts` escreve o tempo ("5 min").

### Por que aparece mesmo enquanto você olha

O último argumento de `announce`, `true`, é `force`. A janela flutuante do guia 5 normalmente só aparece quando o Claude não está na frente. Um evento forçado aparece de qualquer forma: `overlay/server.cjs` mostra o evento quando o Claude não está em primeiro plano ou o evento é forçado, e um evento forçado também reabre uma janela que você fechou há menos de um minuto.

Nem o código nem o README dizem por quê; a leitura deste guia é que, se cinco minutos se passaram e a coisa ainda espera, o primeiro alerta não funcionou, e o fato de o Claude estar na frente não significa que você o viu.

`announce` respeita as escolhas da própria pessoa: silenciado ou discreto significa sem voz, e a janela flutuante desativada significa uma notificação do sistema no lugar dela. O modo discreto (`/narsil discreto`) silencia apenas os anúncios de fim de turno, então um lembrete de que algo precisa de você ainda chega, sem a voz.

## Como foi pedido à IA

O pedido original do lembrete não foi registrado. Ele chegou em 2026-10-30, antes dos registros públicos de tarefas.

### Registrado: o alerta de laço que saiu

O lembrete nasceu no mesmo commit que um alerta de laço, que avisava quando o Claude continuava falhando ou editando os mesmos arquivos. O primeiro pedido da pessoa autora em `odd/tasks/fleet-view.md` no narsil-pet, L1 (2026-11-06, trecho), removeu esse alerta:

> "(eliminariamos la alerta de bucle, no la he sentido tan util)"

Tradução para o português: removeríamos o alerta de laço, não o achei tão útil. O registro de tarefas o transforma em S9, "Loop alert removed" (alerta de laço removido), e o commit `21e7288` o elimina. O lembrete para uma permissão que espera ficou.

### Reconstrução a partir do histórico de commits

A partir de `git log -- hooks/register.tsx hooks/watch.ts`:

- `2027f06` (2026-10-30) "fix(alerts): only alert when a permission dialog needs your answer" (alertar só quando uma caixa de diálogo de permissão precisa da sua resposta). A mudança para `classic.PermissionRequest`, que também decide o que inicia uma espera.
- `f7a494e` (2026-10-30) "feat: warn about loops, insist on waiting permissions and sum the session up" (avisar sobre laços, insistir nas permissões que esperam e resumir a sessão). O lembrete, com uma espera de dois minutos.
- `2532e7c` (2026-11-02) "feat: alert as a question when a turn ends asking in the desktop app's next-step box" (alertar como pergunta quando um turno termina perguntando na caixa de próximo passo do aplicativo de desktop). Hoje essa pergunta também é uma espera.
- `2bcc97c` (2026-11-05) "feat: open the context breakdown from the usage bars and calm loop, steps and permission alerts" (abrir o detalhamento do contexto a partir das barras de uso e acalmar os alertas de laço, de passos e de permissão). A sua mensagem: "a waiting permission is insisted on after 5 minutes" (insiste-se numa permissão que espera depois de 5 minutos).
- `21e7288` (2026-11-06) "refactor: drop the loop alert, the spending count and the open-conversations line" (eliminar o alerta de laço, a contagem de gastos e a linha de conversas abertas).

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No meu mod do Claude Code `my-pet`, me lembre uma vez quando uma permissão esperar demais. Mantenha uma variável de módulo `waiting` com `since`, `what` e `isNudged`. Inicie-a em `classic.PermissionRequest` depois de `next(e)`, a menos que `result.decision` esteja definido ou `e.permission_mode` seja `bypassPermissions`. Apague-a em `classic.PostToolUse`, `classic.PostToolUseFailure`, `classic.PermissionDenied`, qualquer outro `tool.call`, `turn.start` e `turn.complete`. Não use `$.clock.after`: em `session.start`, inicie um único batimento `$.clock.every(2000, ...)` que, quando cinco minutos tiverem passado e `isNudged` for false, o defina e envie uma notificação com `$.ui.notify`. Adicione um teste com um relógio simulado: nada aos 4 minutos e 50 segundos, exatamente um lembrete depois de 15 minutos, e nenhum quando a permissão foi respondida depois de um minuto.

## O código mínimo

Escrito para este guia e conferido com os tipos da 2.1.325 (`classic.PermissionRequest` e o seu `decision`, `classic.PostToolUse`, `classic.PostToolUseFailure`, `classic.PermissionDenied`, `$.clock.every`, `$.clock.now`, `$.ui.notify`). Foi adaptado de `hooks/register.tsx` e `hooks/watch.ts` do [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later).

```tsx
import type { EngineInterface, Register } from 'claude-code'

const NUDGE_AFTER_MS = 5 * 60_000
let waiting: { since: number; what: string; isNudged: boolean } | null = null

async function startWaiting($: EngineInterface, what: string): Promise<void> {
  waiting = { since: await $.clock.now(), what, isNudged: false }
}

function stopWaiting(): void {
  waiting = null
}

async function beat($: EngineInterface): Promise<void> {
  if (!waiting || waiting.isNudged) return
  const waited = (await $.clock.now()) - waiting.since
  if (waited < NUDGE_AFTER_MS) return
  waiting.isNudged = true
  const minutes = Math.round(waited / 60_000)
  void $.ui
    .notify(`Still waiting for you after ${minutes} min: ${waiting.what}`, { title: 'my-pet' })
    .catch(() => undefined)
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    $.clock.every(2000, () => void beat($))
    return next(e)
  })

  on('classic.PermissionRequest', async ($, e, next) => {
    const result = await next(e)
    const isDecided = result.decision !== undefined || e.permission_mode === 'bypassPermissions'
    if (!isDecided) await startWaiting($, `permission to use ${e.tool_name}.`)
    return result
  })

  // Answered, either way: nothing waits any more.
  on('classic.PostToolUse', async ($, e, next) => {
    stopWaiting()
    return next(e)
  })
  on('classic.PostToolUseFailure', async ($, e, next) => {
    stopWaiting()
    return next(e)
  })
  on('classic.PermissionDenied', async ($, e, next) => {
    stopWaiting()
    return next(e)
  })
  // A subagent's turns are not this conversation's: they leave the wait alone.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) stopWaiting()
    return next(e)
  })
  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) stopWaiting()
    return next(e)
  })
}
```

Tradução dos comentários para o português: respondida, num sentido ou no outro, nada espera mais; os turnos de um subagente não são desta conversa, então não mexem na espera.

A Narsil também apaga a espera no seu hook `tool.call`, onde o início de outro passo significa que a espera foi respondida, e ali inicia uma para `AskUserQuestion` e `ExitPlanMode`. O primeiro guia mostra uma versão desse hook.

## Erros comuns e como testar

- **Iniciar uma espera para pedidos que ninguém vê.** Com permissões ignoradas (bypass), ou quando um hook das configurações responde, nenhuma caixa de diálogo aparece. Confira `result.decision` e `e.permission_mode` depois de `next(e)`.
- **Esquecer uma saída.** Uma espera que nunca é apagada lembra você de algo que respondeu há muito tempo. Liste todos os caminhos: permitida, com falha, negada, outro passo, um novo turno.
- **Insistir para sempre.** Sem a flag `isNudged`, o batimento lembra você a cada dois segundos depois do quinto minuto.
- **Confiar num temporizador através de um recarregamento.** Os temporizadores de `$.clock` morrem com um recarregamento do mod. Um batimento que compara horários é mais fácil de entender.
- **Bloquear o batimento.** O lembrete é enviado com `void … .catch(...)`: uma notificação lenta não pode segurar a batida que também conta o cache.

Para testar, `claude plugin test .` executa `tests/narsil.test.tsx` com um relógio simulado. "a permission left waiting five minutes is insisted on once, even while you look" (insiste-se uma vez numa permissão deixada esperando cinco minutos, mesmo enquanto você olha) dispara um `classic.PermissionRequest`, não encontra nenhum lembrete aos 4 minutos e 50 segundos, depois exatamente um após mais dez minutos, do tipo `question`, com `force` definido e o texto "Sigo esperándote desde hace 5 min: pido permiso para usar Bash.". "a permission or question answered in time is not insisted on" (não se insiste numa permissão ou pergunta respondida a tempo) responde depois de um minuto e não espera nenhum.

## Para ir além

- `tickWatch` em `hooks/register.tsx` também resume a sessão depois de 30 minutos tranquilos (`IDLE_SUMMARY_MS` e `summaryText` em `hooks/watch.ts`), exibido como uma dica.
- `announceQuestion` dispara o primeiro alerta para os mesmos três casos, e `setMood($, 'asking', ...)` põe a faixa em "TE NECESITA".
- O hub do guia 3 classifica uma conversa que espera acima de uma que trabalha, então o lembrete e a lista concordam sobre o que importa.
