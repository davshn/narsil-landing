---
title: Seus próprios /comandos
description: 'Como /narsil é registrado como um único comando de barra com muitos subcomandos, como as suas palavras são despachadas, como o comando sozinho serve de ajuda e como testá-lo.'
route: pet
order: 17
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: docs/plan-advice.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## O que faz

Cada funcionalidade desta trilha tem um interruptor ou uma pergunta, e todos vivem sob um único comando de barra: `/narsil`. Você digita `/narsil` e uma palavra, e a Narsil responde na transcrição. Digitado sozinho, `/narsil` diz como ela está configurada e lista todas as palavras que aceita.

As palavras, tal como o código as despacha (a Narsil fala espanhol, então as palavras são em espanhol):

| Comando                                                             | O que faz                                                                                       |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `/narsil`                                                           | Mostra as configurações atuais e a linha de uso.                                                |
| `/narsil estado`                                                    | Diz o que ela está fazendo, quantas conversas estão abertas e em quais superfícies ela desenha. |
| `/narsil ocultar` · `mostrar`                                       | Oculta ou mostra a faixa.                                                                       |
| `/narsil silencio` · `voz`                                          | Desliga ou liga a voz.                                                                          |
| `/narsil discreto` · `normal`                                       | Liga ou desliga o modo discreto (guia 14).                                                      |
| `/narsil flotante`                                                  | Liga ou desliga a janela flutuante (guia 5).                                                    |
| `/narsil prueba`                                                    | Envia um alerta de teste, com voz.                                                              |
| `/narsil consejo` · `consejo profundo`                              | Pede uma dica agora, ou uma sobre a conversa inteira (guia 11).                                 |
| `/narsil consejos on` · `off` · `cada <min>` · `voz`                | Dicas automáticas ligadas ou desligadas, o seu espaçamento, faladas ou não.                     |
| `/narsil pasos on` · `off`                                          | Próximos passos ligados ou desligados (guia 12).                                                |
| `/narsil cache` · `cache <min>` · `cache auto`                      | Diz, define ou deduz quanto dura o cache do prompt (guia 8).                                    |
| `/narsil resumen`                                                   | O resumo da sessão (guia 16).                                                                   |
| `/narsil nivel`                                                     | Nível, estágio e como ela ganha XP (guia 13).                                                   |
| `/narsil movil` · `on` · `off` · `nuevo` · `prueba` · `clave [off]` | Alertas no celular (guia 15).                                                                   |

A tabela "Comandos" do README lista as mesmas palavras, e elas concordam com o código.

Um comando em vez de quinze mantém o autocompletar limpo: você digita `/nar`, e tudo o que a Narsil sabe fazer fica atrás de um único nome.

## Como funciona por dentro

### Registrar: `$.command.register`

Um mod declara um comando de barra em tempo de execução. A Narsil faz isso logo no início de `session.start`:

```tsx
await $.command.register({
  name: 'narsil',
  description:
    'Narsil, tu mascota: estado | ocultar | mostrar | silencio | voz | discreto | normal | flotante | prueba | consejo [profundo] | consejos on|off|cada <min>|voz | pasos on|off | cache [auto|<min>] | resumen | nivel | movil [on|off|nuevo|prueba|clave [off]]',
})
```

Os tipos da 2.1.325 descrevem `$.command.register` como "Declares the slash command `/<name>` for this session, listed in the typeahead from the next keystroke on" (declara o comando de barra `/<name>` para esta sessão, listado no autocompletar a partir da próxima tecla). Três pontos dessa frase moldam o design:

- **"for this session" (para esta sessão).** O registro não sobrevive à sessão, e é por isso que acontece em cada `session.start`.
- **A especificação.** `CommandSpec` tem `name` (letras, dígitos, `_` e `-`, até 64), `description` ("The one line the typeahead and `/help` show for it", a única linha que o autocompletar e `/help` mostram para ele), um `argumentHint` opcional ("The hint drawn dim after the name", a dica desenhada esmaecida depois do nome) e um `immediate` opcional. "Registering a name again replaces it; a built-in's name is refused." (registrar um nome de novo o substitui; o nome de um comando embutido é recusado.)
- **Servi-lo.** "Serve it with a `command.run` hook on `{ command: "<name>" }` that returns `{ text }`" (sirva-o com um hook `command.run` em `{ command: "<name>" }` que retorne `{ text }`).

A Narsil põe a lista de palavras em `description`, para que o autocompletar e `/help` mostrem todas (a descrição começa com "Narsil, tu mascota", "Narsil, a sua mascote"). Ela não usa `argumentHint`; uma dica curta como `[estado | resumen | …]` seria a alternativa, ao custo de mostrar menos.

Ela também não define `immediate`. Sem ele, dizem os tipos, um comando digitado enquanto um turno está em andamento espera "for the turn to end" (o turno terminar). `/narsil discreto` digitado no meio de um turno, portanto, tem efeito depois do turno. Com `immediate`, o hook "must not assume the turn's state" (não deve presumir o estado do turno), o que é pedir muito de um handler que lê e escreve tanto desse estado.

### Servir: um único hook `command.run`

O hook é registrado com um filtro, então só roda para `/narsil`:

```tsx
on('command.run', { command: 'narsil' }, async ($, e) => {
  await noteOrigin($, e.origin)
  const arg = e.args.trim().toLowerCase().replace(/\s+/g, ' ')
  // …
})
```

Ele nunca chama `next`. Os tipos explicam o que isso significa: "A hook's own answer without `next` runs no command: its `text` is shown as the command's output" (a resposta própria de um hook sem `next` não executa nenhum comando: o seu `text` é mostrado como a saída do comando). Como nada mais implementa `/narsil`, não há nada para repassar.

Três coisas acontecem antes de qualquer palavra ser lida:

- **`noteOrigin($, e.origin)`.** O `origin` de um comando diz de onde ele veio, como o de `prompt.submit`. Executar `/narsil` a partir do celular conta como escrever de longe (guia 15).
- **Normalizar as palavras.** `e.args` é "Everything after the name, as typed" (tudo o que vem depois do nome, tal como digitado). A Narsil remove os espaços das pontas, passa para minúsculas e junta sequências de espaços, então `/narsil  Consejos   OFF` funciona.
- **Acentos.** O grupo do celular aceita `movil` e `móvil`, e o padrão do cache, `/^cach[eé](?: (auto|\d{1,3}))?$/`, aceita `cache` e `caché`. As pessoas digitam as duas formas.

### Despachar: grupos que respondem "não é comigo"

O corpo é uma cadeia. Os três grupos maiores vivem cada um ao lado da sua funcionalidade, como funções que retornam o texto da resposta, ou `undefined` para as palavras que não são suas:

```tsx
const advice = await adviceCommand($, arg)
if (advice !== undefined) return { text: advice }
const stepped = await stepsCommand($, arg)
if (stepped !== undefined) return { text: stepped }
const phoned = await phoneCommand($, arg)
if (phoned !== undefined) return { text: phoned }
```

- `adviceCommand` aceita `consejo`, `consejo profundo` e `consejos …`.
- `stepsCommand` aceita `pasos on|off` e `cache [auto|<min>]`.
- `phoneCommand` aceita `movil …`.

Um grupo que reconhece a sua primeira palavra, mas não o resto, responde com a sua própria linha de uso em vez de `undefined`: `/narsil consejo raro` recebe "Uso: /narsil consejo [profundo] | consejos on | off | cada <min> | voz", e `/narsil movil raro` recebe "Uso: /narsil movil [on | off | nuevo | prueba | clave [off]]". A pessoa vê as palavras que cabem no que ela tentava fazer, não a lista inteira.

Depois, o handler principal trata o resto ele mesmo: `resumen` e `nivel` respondem na hora; `prueba`, `estado` e `flotante` têm cada um o seu ramo; e seis palavras de ligar e desligar compartilham uma tabela, `change`, que associa cada palavra a um patch das preferências (`ocultar` a `{ isHidden: true }`, `discreto` a `{ isQuiet: true }`, e assim por diante). Uma palavra conhecida é mesclada no atom `prefs` e salva com `$.store.set('prefs', …)`, então toda configuração sobrevive à sessão.

O design mantém as palavras de cada funcionalidade junto à funcionalidade. Acrescentar um grupo de comandos a uma funcionalidade significa uma função na sua própria seção e uma linha na cadeia.

### O comando sozinho é a ajuda

Tudo o que a cadeia não reconhece, incluindo o `/narsil` vazio, cai no fim, onde `patch` é undefined. Esse ramo lê as preferências e as imprime: se a faixa está visível, a voz ligada, a janela flutuante ligada; as dicas e o seu espaçamento; os próximos passos e quanto dura o cache; uma linha para o modo discreto quando ele está ligado. A última linha é a linha de uso, a mesma lista de palavras da descrição.

Assim, não há uma palavra `ayuda` ("ajuda") separada: um erro de digitação e um `/narsil` simples respondem ambos com o estado e as palavras. Isso coincide com o README, cuja primeira linha diz que `/narsil` "Muestra la configuración actual y la ayuda" ("mostra a configuração atual e a ajuda").

A lista de palavras vive em três lugares: a descrição, a linha de uso e o README. O plano das dicas, `docs/plan-advice.md`, diz isso claramente quando acrescenta as palavras `consejo`: "Update the command description and the usage text of `/narsil`." (atualizar a descrição do comando e o texto de uso de `/narsil`.) Manter os três em sintonia é uma tarefa manual na Narsil.

### O que é a resposta

Cada ramo retorna `{ text }`, um `CommandRunResult`. Dois dos seus campos valem a pena conhecer, embora a Narsil não os use. `context` é "What the model reads after the command's output and the person never sees" (o que o modelo lê depois da saída do comando e a pessoa nunca vê). `isTextDisplayOnly` mantém o texto fora das requisições do modelo, mas os tipos dizem que ele só é respeitado quando todo plugin que intercepta o comando vem incluído no Claude Code: "Any other plugin's text stays in requests" (o texto de qualquer outro plugin permanece nas requisições). Assim, tudo o que `/narsil` responde, incluindo a chave do celular do guia 15, faz parte do que o modelo lê.

## Construa com o Claude

Peça ao Claude um único comando de barra com subcomandos, registrado quando a sessão começa e servido por um único hook. A única ideia que o Claude precisa acertar é o despacho: cada funcionalidade responde às suas próprias palavras e retorna `undefined` para o resto, e o que sobrar imprime as configurações e a linha de uso.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> Dê ao meu mod do Claude Code `my-pet` um único comando de barra, `/my-pet`, com subcomandos. Em `session.start`, chame `$.command.register` com o nome e uma descrição que liste todos os subcomandos. Sirva-o com um único hook `command.run` filtrado por `{ command: 'my-pet' }` que retorne `{ text }` sem chamar `next`. Normalize `e.args` (remover espaços das pontas, minúsculas, espaços simples). Dê a cada funcionalidade a sua própria função, que retorne a resposta para as suas palavras, a sua própria linha de uso para uma primeira palavra conhecida com um resto desconhecido, ou `undefined` para as palavras que não são suas, e encadeie-as. Associe as palavras simples de ligar e desligar a um patch de um atom `prefs` salvo com `$.store.set`. Para um argumento vazio ou desconhecido, imprima as configurações atuais e a linha de uso. Mantenha a descrição, a linha de uso e o README em sintonia. Teste com `claude-code/testing`, chamando `$.command.run({ command: 'my-pet', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } })`, que cada palavra responde e que uma palavra desconhecida imprime a linha de uso.

### O que conferir na resposta do Claude

1. `$.command.register` roda em `session.start`, em toda sessão, porque um registro só dura a sessão.
2. O hook `command.run` é filtrado pelo nome do comando, retorna `{ text }` e nunca chama `next`.
3. `e.args` tem as pontas aparadas, é passado para minúsculas e tem as sequências de espaços reduzidas antes de qualquer palavra ser comparada.
4. A função de cada funcionalidade retorna a sua resposta, a sua própria linha de uso para uma primeira palavra conhecida com um resto desconhecido, ou `undefined`; um argumento vazio ou desconhecido imprime as configurações e a linha de uso.
5. A descrição e a linha de uso listam as mesmas palavras, de preferência a partir de uma única constante.

Se uma verificação falhar, diga ao Claude o que você vê: "`/my-pet  Tips OFF`, com espaços a mais e maiúsculas, responde com a linha de uso em vez de desligar as dicas".

### Como a pessoa autora pediu

O pedido original de `/narsil` não foi registrado. O que está registrado é um passo de um plano: em `docs/plan-advice.md`, entre os comandos que as dicas acrescentam, o plano diz:

> "Update the command description and the usage text of `/narsil`."

Tradução para o português: atualizar a descrição do comando e o texto de uso de `/narsil`. Essa é a redação do plano, não o pedido da pessoa autora.

#### Reconstrução a partir do histórico de commits

A partir de `git log -G "Narsil, tu mascota" -- hooks/register.tsx`, que encontra cada commit que mudou a descrição registrada:

- `b1187f3` (2026-10-30) "feat: show Narsil above the prompt with clear states and /narsil" (mostrar a Narsil acima do prompt com estados claros e /narsil). O comando nasce com a faixa, e a sua primeira descrição diz "Narsil, tu mascota: estado | ocultar | mostrar | silencio | voz | flotante | prueba".
- `467a64b` (2026-10-30) "feat(advice): give short, concrete tips about the work in progress" (dar dicas curtas e concretas sobre o trabalho em andamento). As palavras `consejo`.
- `0993bd7` (2026-10-30) "feat: show a prompt-cache clock and offer next steps after a turn" (mostrar um relógio do cache do prompt e oferecer próximos passos depois de um turno). `pasos` e `cache`.
- `f7a494e` (2026-10-30) "feat: warn about loops, insist on waiting permissions and sum the session up" (avisar sobre loops, insistir nas permissões que esperam e resumir a sessão). `resumen`.
- `8913cdd` (2026-10-30) "feat: let Narsil earn experience and levels kept across sessions" (deixar a Narsil ganhar experiência e níveis mantidos entre sessões). `nivel`.
- `17ffb30` (2026-10-31) "feat: add a quiet mode that only speaks up when Narsil needs you" (acrescentar um modo discreto que só se manifesta quando a Narsil precisa de você). `discreto` e `normal`.
- `d91997f` (2026-10-31) "feat: send what needs you to your phone and watch through ntfy, with Narsil's picture" (enviar o que precisa de você ao seu celular e relógio pelo ntfy, com o desenho da Narsil). `movil`.
- `5a9ee10` (2026-11-01) "feat: seal phone messages with /narsil movil clave, send reset times and an Abrir Claude button" (selar as mensagens do celular com /narsil movil clave, enviar os horários de reinício e um botão Abrir Claude). `clave`.

O comando cresceu uma palavra de cada vez, cada uma com a funcionalidade que controla, e cada commit tocou na descrição na mesma mudança. É o hábito que o plano pede.

## Código de referência

Esta é uma resposta correta, escrita para este guia. Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

Escrito para este guia e conferido com os tipos da 2.1.325 (`$.command.register`, `command.run`, `$.store.get`, `$.store.set`, `session.start`). Foi adaptado de `hooks/register.tsx` do [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). O atom `prefs` está declarado em `types/index.d.ts` como `{ isHidden: boolean; isMuted: boolean }`.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const WORDS = 'status | hide | show | mute | voice | tips on|off'
const prefs = atom({ plugin: 'my-pet', key: 'prefs' } as const, { isHidden: false, isMuted: false })

// One feature's words: its answer, its own usage line, or undefined when the words are not its own.
async function tipsCommand($: EngineInterface, arg: string): Promise<string | undefined> {
  if (arg === 'tips on' || arg === 'tips off')
    return `My pet: tips ${arg === 'tips on' ? 'on' : 'off'}.`
  if (arg.startsWith('tips')) return 'Usage: /my-pet tips on | off'
  return undefined
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    // Registered for this session only: every session registers it again.
    await $.command.register({ name: 'my-pet', description: `My pet: ${WORDS}` })
    const saved = await $.store.get('prefs').catch(() => undefined)
    if (saved && typeof saved === 'object') await update($, prefs, (p) => ({ ...p, ...saved }))
    return next(e)
  })

  on('command.run', { command: 'my-pet' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase().replace(/\s+/g, ' ')
    const tips = await tipsCommand($, arg)
    if (tips !== undefined) return { text: tips }

    const change: Record<string, { isHidden?: boolean; isMuted?: boolean }> = {
      hide: { isHidden: true },
      show: { isHidden: false },
      mute: { isMuted: true },
      voice: { isMuted: false },
    }
    const patch = arg === 'status' ? undefined : change[arg]
    if (!patch) {
      // The bare command, a typo and "status" all answer with the state and the words.
      const p = await read($, prefs)
      return {
        text: `My pet is ${p.isHidden ? 'hidden' : 'visible'}, with the voice ${p.isMuted ? 'off' : 'on'}.\nUsage: /my-pet ${WORDS}`,
      }
    }
    const saved = await update($, prefs, (p) => ({ ...p, ...patch }))
    await $.store.set('prefs', saved).catch(() => undefined)
    return { text: `My pet: done (${arg}).` }
  })
}
```

`WORDS` é escrito uma vez e usado tanto na descrição quanto na linha de uso, o que elimina um dos três lugares que a Narsil mantém em sintonia à mão. O README continua sendo seu para atualizar.

## Erros comuns e como testar

- **Registrar uma vez só.** Um registro dura a sessão. Registre em `session.start`, todas as vezes.
- **Um nome já ocupado.** "a built-in's name is refused" (o nome de um comando embutido é recusado). Escolha um nome que seja claramente do seu mod.
- **Chamar `next` a partir do seu próprio comando.** Não há nenhum comando atrás do seu para executar; responda com `{ text }`.
- **Correspondência exata com a entrada crua.** As pessoas digitam espaços a mais, maiúsculas e acentos. Normalize primeiro, e aceite as formas acentuadas que você espera.
- **Uma cadeia gigante de `if`.** Funciona, mas as palavras de cada funcionalidade acabam longe da funcionalidade. Deixe cada funcionalidade ser dona das suas palavras e retornar `undefined` para o resto.
- **Uma ajuda que se desatualiza.** A descrição, a linha de uso e o README devem dizer o mesmo. Monte as duas primeiras a partir de uma única constante, se puder.
- **Segredos nas respostas.** O texto de um comando permanece nas requisições do modelo. Imprima um segredo só quando a pessoa precisar copiá-lo, e diga isso.

Para testar, `claude plugin test .` executa `tests/narsil.test.tsx`, onde os comandos rodam por meio de `$.command.run({ command: 'narsil', args: 'nivel', ...TYPED })`. `TYPED` é `{ origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } }`: um comando digitado na mesa. `BY_PHONE` troca a origem por `{ kind: 'bridge' }` para executar um a partir do Remote Control. Testes que vale a pena ler pelo nome: "/narsil estado tells which surfaces asked to draw the band, and which never did" (/narsil estado diz quais superfícies pediram para desenhar a faixa, e quais nunca pediram), "/narsil discreto keeps her quiet, and /narsil normal brings everything back" (/narsil discreto a mantém calada, e /narsil normal traz tudo de volta), "/narsil consejos off stops automatic tips, and /narsil consejo still answers" (/narsil consejos off interrompe as dicas automáticas, e /narsil consejo continua respondendo) e "/narsil movil nuevo changes the topic, and /narsil movil prueba sends one" (/narsil movil nuevo muda o tópico, e /narsil movil prueba envia um).

### Onde o código e o README diferem

Eles concordam em todas as palavras. Um pequeno deslize está no código: a linha de uso do ramo final está escrita `'Uso:/narsil estado | …'`, sem o espaço depois dos dois-pontos que as linhas de uso dos subgrupos têm. Ele vem de `17ffb30`; antes dele, a linha dizia `'Uso: /narsil …'`.

## Para ir além

- `phoneCommand` em `hooks/register.tsx` é o mais claro dos grupos para copiar: separa a primeira palavra do resto, salva por meio de um pequeno auxiliar `save`, e termina com a sua própria linha de uso.
- `stepsCommand` mostra uma palavra com um número opcional, analisado com uma única expressão regular e limitado (`Math.min(1440, Math.max(1, …))`).
- `$.command.list()` retorna todos os comandos de barra que a pessoa pode executar, e `$.command.run` executa um como se tivesse sido digitado; ambos estão nos tipos da 2.1.325.

Este é o último guia da trilha "Seu próprio mascote de status". O seu índice lista os dezessete guias, dos estados num relance a estes comandos, se você quiser voltar a alguma funcionalidade. Para a base em que todos os guias se apoiam, os guias de "Fundamentos de mods" cobrem do que é feito um mod, o objeto `$`, como instalar, recarregar, validar e testar um mod, as superfícies em que ele roda e o que a GPL v3 da Narsil significa quando você reutiliza o seu código.
