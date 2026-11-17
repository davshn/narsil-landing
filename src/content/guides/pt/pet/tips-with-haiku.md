---
title: Dicas com o Haiku
description: 'Como a Narsil pede ao Haiku uma dica curta sobre o trabalho em andamento: o contexto que envia, o prompt exato, com que frequência fala, o modo profundo e a janela da dica.'
route: pet
order: 11
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/advice.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: overlay/tip.ps1
  - repo: pet
    path: overlay/tip.sh
  - repo: pet
    path: overlay/tip.js
  - repo: pet
    path: docs/plan-advice.md
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## O que faz

De vez em quando, a Narsil lhe dá uma dica sobre aquilo em que você está trabalhando: duas ou três frases, em espanhol, sobre algo concreto que acabou de acontecer. Ela a pede a um modelo pequeno, o Haiku, com um resumo curto do trabalho.

Há três momentos automáticos e dois sob demanda:

- **Um turno terminou.** A dica lê o que o turno mudou e comenta uma decisão de design: por que foi feito daquele jeito, qual era a alternativa, o que cada uma ganha ou perde. Conselhos rotineiros ("execute os testes", "confira o push") são descartados de propósito.
- **Uma ferramenta falhou várias vezes.** A mesma ferramenta duas vezes num turno, ou três falhas de qualquer tipo. A dica é sobre depuração.
- **Um turno está rodando há mais de 3 minutos**, o que é conferido a cada chamada de ferramenta. A dica é sobre ritmo, ou sobre dividir a tarefa.
- **`/narsil consejo`** ("dica") pede uma agora, como a dica de fim de turno.
- **`/narsil consejo profundo`** ("dica profunda") pede ao próprio modelo da sessão, sobre a conversa inteira.

As dicas automáticas são espaçadas: no máximo uma a cada 30 minutos por padrão (`/narsil consejos cada <min>` muda isso), o dobro quando o mesmo tipo vem duas vezes seguidas, e no máximo 20 por dia. Uma dica que você pede nunca é retida. `/narsil consejos off` desliga as automáticas, `/narsil consejos voz` lê em voz alta as dicas de fim de turno, e o modo discreto (`/narsil discreto`) as desliga junto com a voz.

No Windows e no macOS, cada dica abre inteira numa pequena janela própria, com a imagem da Narsil, que não toma o foco e se fecha sozinha depois de 3 minutos. Em outros sistemas, ela aparece na faixa, abaixo do título, em até três linhas curtas com um "×" para dispensá-la, e na janela flutuante.

Uma dica nunca deixa o Claude mais lento: ela é pedida depois do fato, enquanto você lê a resposta.

## Como funciona por dentro

### O que a Narsil lembra: `seen`

`hooks/advice.ts` guarda as partes que são valores simples (contexto, prompt, análise da resposta); `hooks/register.tsx` cuida das chamadas. O que a Narsil viu do trabalho é uma variável de módulo, `seen`, preenchida pelos hooks dos guias anteriores:

- `prompt.submit`: a sua última mensagem, os seus primeiros 400 caracteres (não as mensagens que o próprio motor acrescenta, `e.isMeta`).
- `tool.call`: as últimas 15 chamadas, cada uma com a sua ferramenta e o detalhe curto da faixa (o nome de um arquivo, a primeira linha de um comando); os arquivos editados ou escritos neste turno, com quantas vezes; e as últimas 5 falhas, com os primeiros 200 caracteres do erro.
- `turn.complete`: a duração do turno e a resposta final do Claude.
- Logo antes de pedir, `git`: o que o turno mudou (abaixo).

As variáveis de módulo se perdem num recarregamento do mod, e não tem problema: o próximo turno as preenche de novo. O plano diz o mesmo: "losing it on reload is harmless" (perdê-lo num recarregamento é inofensivo).

### O que mudou: o diff

Para a dica de fim de turno e para a que você pede, `readDiff` executa `git diff HEAD --stat --patch --unified=2` por meio de `$.process.run`, com um tempo limite de 5 segundos. Se o turno já fez commit de tudo e não há diff pendente, ele lê o último commit no lugar (`git show HEAD`). Fora de um repositório, ou sem git, ele fica vazio e a dica segue sem ele. Uma dica de depuração ou de ritmo nem lê o diff: não precisa dele.

A primeira versão das dicas não tinha diff: ele chegou em `d1e6d40`, junto com a regra contra conferências rotineiras. Com o diff, o modelo consegue nomear a função que mudou em vez de adivinhar a partir da lista de chamadas de ferramentas.

### O contexto que o modelo lê

`describe(seen, kind)` transforma tudo isso em linhas de texto, com o motivo primeiro. Um exemplo sintético de um contexto de fim de turno, encurtado:

```text
Motivo: El turno acaba de terminar. Comenta una decisión de diseño de lo que se hizo: …
Último mensaje de la persona: añade reintentos a net.ts
Archivos editados en este turno: net.ts (2 veces), net.test.ts
Últimas herramientas usadas:
- Read: net.ts
- Edit: net.ts
- Bash: pnpm test
Duración del turno: 4 min
Respuesta final: Añadí retry() con tres intentos … Falta decidir el tiempo entre intentos.
Cambios (git):
 net.ts | 14 ++++++++++++--
 …
```

Os rótulos estão em espanhol porque o modelo precisa responder em espanhol: a última mensagem, os arquivos editados, as falhas recentes, as últimas ferramentas, a duração, a resposta final e as mudanças. Cada parte tem o seu próprio limite: 1.500 caracteres da resposta, mantidos pelas duas pontas (`ends`), já que uma resposta diz primeiro o que fez e por último o que falta; 3.000 caracteres do diff, cortados por linhas; 6.000 para o contexto inteiro. Depois, `sanitize` passa por ele (abaixo).

### O prompt exato

O prompt de sistema é `SYSTEM` em `hooks/advice.ts`, citado aqui como está no [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). `ASKED_TIP` é 300.

```ts
export const SYSTEM = [
  'Eres Narsil, una vieja serpiente marina sabia que acompaña a quien programa.',
  'Das UN consejo sabio y concreto sobre el trabajo en curso, el que daría alguien con experiencia que revisa el trabajo.',
  'Reglas:',
  `- Escribe en español, en dos o tres frases, como mucho ${ASKED_TIP} caracteres.`,
  '- Sigue el motivo que se te da. Cuando trate del diseño, nombra la decisión concreta (una función, un archivo, un enfoque),',
  '  la alternativa y por qué una u otra; el diff de los cambios te dice qué se hizo.',
  '- Menciona algo concreto del contexto; nada de motivación genérica ni datos inventados.',
  '- Puedes usar como mucho una metáfora del mar.',
  '- Habla como Narsil, en femenino; no nombres a ningún asistente ni a "Claude".',
  '- El femenino es solo para ti: a la persona háblale de tú con lenguaje neutro, sin suponer su género',
  '  (nada de "juntas", "juntos", "listo" o "lista"; di "contigo", "cuando quieras").',
  '- No repitas ninguno de los consejos anteriores.',
  '- Si no hay nada útil que decir, responde exactamente SKIP.',
  'Responde solo con el consejo (o SKIP), sin comillas ni prefijos.',
].join('\n')
```

Tradução para o português: você é a Narsil, uma velha serpente marinha sábia que acompanha quem programa. Você dá UMA dica sábia e concreta sobre o trabalho em andamento, a que daria alguém com experiência que revisa o trabalho. Regras: escreva em espanhol, em duas ou três frases, no máximo 300 caracteres. Siga o motivo que lhe é dado; quando tratar do design, nomeie a decisão concreta (uma função, um arquivo, uma abordagem), a alternativa e por que uma ou outra; o diff das mudanças lhe diz o que foi feito. Mencione algo concreto do contexto; nada de motivação genérica nem dados inventados. Você pode usar no máximo uma metáfora do mar. Fale como Narsil, no feminino; não nomeie nenhum assistente nem "Claude". O feminino é só para você: fale com a pessoa de forma informal, com linguagem neutra, sem supor o seu gênero (os exemplos são palavras do espanhol que marcam gênero, "juntas", "juntos", "listo", "lista", e alternativas neutras, "contigo", "cuando quieras"). Não repita nenhuma das dicas anteriores. Se não houver nada útil a dizer, responda exatamente SKIP. Responda só com a dica (ou SKIP), sem aspas nem prefixos.

A mensagem da pessoa usuária é montada por `prompt(context, recent)`: "Contexto del trabajo:" ("contexto do trabalho"), o contexto, depois "Consejos anteriores (no los repitas):" ("dicas anteriores, não as repita") com as últimas cinco dicas, e "Tu consejo:" ("a sua dica:") para fechar.

O motivo que abre o contexto muda com o tipo (`REASON` em `hooks/advice.ts`):

- **Fim de turno:** "El turno acaba de terminar." ("o turno acaba de terminar") seguido da instrução de design: comentar uma decisão de design do que foi feito, por que, que alternativa havia e o que cada uma ganha ou perde, ou como melhorar essa funcionalidade. Depois, "Nada de comprobaciones rutinarias (ejecutar los tests, revisar el push o el commit, mirar si el error ya no sale)." ("nada de conferências rotineiras: executar os testes, revisar o push ou o commit, ver se o erro já não aparece").
- **Falhas:** "Una herramienta ha fallado varias veces: da un consejo para depurarlo." ("uma ferramenta falhou várias vezes: dê uma dica para depurá-la").
- **Turno longo:** "El turno lleva mucho tiempo: da un consejo de ritmo o de dividir la tarea." ("o turno já está rodando há muito tempo: dê uma dica de ritmo ou de dividir a tarefa").

Três escolhas de design neste prompt valem ser copiadas. `SKIP` permite que o modelo fique calado, e o silêncio é melhor que uma dica inútil. As dicas anteriores na mensagem impedem que o mesmo conselho volte a cada turno. E a proibição de conferências rotineiras existe porque, sem ela, a dica mais barata é sempre "execute os testes".

### Chamar o Haiku: `$.model.complete`

`askTip` a envia:

```tsx
const reply = await $.model.complete({
  model: 'haiku',
  system: SYSTEM,
  prompt: prompt(describe(seen, kind), recentTips),
  effort: 'medium',
  maxTokens: 2000,
  timeoutMs: 30_000,
})
return reply.isAnswered ? parse(reply.text) : null
```

Os tipos da 2.1.325 descrevem `$.model.complete` como uma conclusão de texto única pelo próprio cliente de API da sessão: "No tools, no history, no system prompt beyond the CLI's identity block and `request.system`" (sem ferramentas, sem histórico, sem prompt de sistema além do bloco de identidade da CLI e de `request.system`). Assim, o Haiku vê apenas o que a Narsil envia, nada da conversa em si. O resultado diz se ele respondeu (`isAnswered`); se não, um `reason` (`api-error`, `empty-reply`, `aborted`). A Narsil trata qualquer um deles, e qualquer exceção, como "sem dica".

`parse` limpa a resposta: tira as aspas ao redor e um prefixo "consejo:", transforma qualquer "Claude" em "Narsil", não devolve nada para `SKIP` ou uma resposta vazia, e corta uma dica descontrolada que passe de 450 caracteres na sua última frase completa. O prompt pede 300; a margem existe porque o modelo muitas vezes escreve um pouco mais, e essas aparecem inteiras.

### O modo profundo: `$.model.fork`

`/narsil consejo profundo` faz outra coisa. Ele chama `$.model.fork({ prompt: forkPrompt(recentTips) })`, em que `forkPrompt` é o mesmo `SYSTEM` seguido de "Mira esta conversación hasta aquí y da tu consejo sobre ella." ("olhe esta conversa até aqui e dê a sua dica sobre ela").

Os tipos descrevem um fork como uma conclusão única sem ferramentas "over the session's OWN transcript as the main thread last sent it" (sobre a PRÓPRIA transcrição da sessão, tal como a linha principal a enviou por último): o modelo, o prompt de sistema, as ferramentas e as mensagens da linha principal, com este prompt depois deles e todas as ferramentas negadas. O modelo vê tudo, e é essa a ideia. Quando ainda não há conversa, o motivo do resultado é `nothing-to-fork`, e a Narsil responde que ainda não há nada para olhar.

### Quando ela pode falar: `mayTip`

Cada gatilho automático chama `tipLater($, kind)`, e cada tipo é tentado no máximo uma vez por turno. `mayTip` então decide:

1. Dicas desligadas, ou o modo discreto: não.
2. Já foram 20 hoje: não. O dia é contado como `Math.floor(now / 86_400_000)`, então ele vira à meia-noite UTC, não à meia-noite local.
3. Menos que o intervalo desde a última dica automática: não. O intervalo é `adviceEveryMinutes` (30 por padrão), dobrado quando este tipo é o mesmo que o anterior.
4. Caso contrário, sim, e a dica conta, mesmo que o modelo depois responda `SKIP`.

`tipLater` nunca é aguardado: `void autoTip($, kind).catch(() => undefined)`. O hook que o disparou retorna de imediato, então um modelo lento nunca segura o turno. O plano pedia isso, e também pedia não usar temporizadores de `$.clock`, já que um recarregamento do mod os cancela.

### Onde a dica aparece

`showTip` faz o mesmo para toda dica:

1. Guarda o texto entre as cinco últimas, para o próximo prompt.
2. No Windows e no macOS, abre a janela da dica. Se isso funcionou, a faixa e a janela flutuante deixam a dica de fora: ela já está na tela, inteira.
3. Caso contrário, a faixa a desenha com `tipLines`, quebrada em no máximo três linhas (60 caracteres no desktop, a largura da faixa no terminal), com um botão "×". Ela sai da faixa depois de 3 minutos; a janela flutuante a mantém por 15, já que essa janela costuma ser olhada mais tarde.
4. Escreve uma linha de log, "💡" e a dica, com `$.ui.log`.

A janela da dica não é código do mod: `launch` inicia um script com `$.process.run`, destacado, por meio de `powershell.exe` no Windows e de `/bin/sh` no macOS. No Windows, `overlay/tip.ps1` monta uma pequena janela de Windows Forms que aparece sem tomar o foco, fica por cima, abre acima da janela flutuante quando ela está na tela (senão, num canto da tela em que o Claude está), fecha depois de `NARSIL_SECONDS` (180) e fecha qualquer dica mais antiga. No macOS, `overlay/tip.sh` executa `overlay/tip.js` com `osascript` (JavaScript for Automation): um painel flutuante que nunca se ativa, posicionado acima da janela flutuante (ele pergunta ao servidor local onde ela está) ou no canto da tela em que o mouse está. As duas têm um botão que volta à conversa por meio de um link `claude://`, que elas conferem contra um padrão estrito antes de abri-lo.

Um detalhe em `tip.sh` importa para quem o copiar: "The tip and the rest travel in the environment, never inside the script, so nothing in them runs." (a dica e o resto viajam no ambiente, nunca dentro do script, então nada neles é executado). A dica é um texto escrito por um modelo. Colá-la numa linha de comando permitiria que uma aspa perdida a transformasse em código.

A sugestão de `/compact` do guia 7 e o resumo da sessão do guia 10 também passam por `showTip`, embora nenhum modelo os escreva.

### Custo

Cada dica é uma requisição ao modelo na conta da pessoa. Os tipos dizem que um `$.model.complete` respondido "counts toward the session's cost total" (conta para o custo total da sessão), visível em `/cost` com o `query_source` `plugin_model_complete`, e "Nothing caps it per call" (nada o limita por chamada). O limite é da própria Narsil: uma a cada 30 minutos e 20 por dia, o que limita as dicas automáticas a, no máximo, vinte chamadas pequenas ao Haiku por dia. As dicas que você pede não contam para esse limite. Os próximos passos do próximo guia acrescentam no máximo mais uma chamada por turno terminado.

O modo profundo é de outra natureza. Ele executa o modelo principal sobre a transcrição inteira. Os tipos explicam que a transcrição é servida a partir do cache do prompt enquanto ele está quente, e "billed afresh once the entry lapsed" (cobrada de novo quando a entrada expirou): o relógio do cache do guia 8 diz em qual caso você está. É por isso que ele só roda quando você pede.

### Privacidade

O contexto vai para o mesmo provedor que a sessão já usa, pelo próprio cliente da sessão. Ainda assim, é o seu código: a sua última mensagem, nomes de arquivos, texto de erros, a resposta do Claude e até 3.000 caracteres do diff.

`sanitize` passa pelo contexto inteiro antes de ele ser enviado. Ele substitui por "[oculto]" qualquer `name=value` ou `name: value` cujo nome contenha key, token, secret ou password, e qualquer sequência de 32 ou mais caracteres em base64 ou hexadecimal. É uma heurística: um segredo em outro formato passa. Se um repositório não puder ser resumido para nenhum modelo além da conversa principal, desligue as dicas e os próximos passos (`/narsil consejos off`, `/narsil pasos off`).

### Plano e código

`docs/plan-advice.md` diz "Status: implemented" (estado: implementado), e a maior parte está. Alguns números mudaram depois, e o que roda é o código:

| Plano                                                               | Código hoje                                                               |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| no máximo 160 caracteres, uma ou duas frases                        | 300, duas ou três frases (`69647da`, `d1e6d40`)                           |
| `effort: 'low'`, `maxTokens` ~120, `timeoutMs` ~8000                | `medium`, 2000, 30.000 (`d1e6d40`)                                        |
| contexto limitado a ~2.000 caracteres, os 400 primeiros da resposta | 6.000, resposta de 1.500 pelas duas pontas, mais o diff (`d1e6d40`)       |
| uma dica automática a cada 10 minutos                               | a cada 30 (`1216dc4`)                                                     |
| uma linha na faixa, cortada no fim                                  | até três linhas (`c564ab5`), ou uma janela própria (`c98adac`, `a95e96a`) |
| dica de fim de turno: o que conferir ou fazer em seguida            | uma decisão de design, sem conferências rotineiras (`d1e6d40`)            |

O padrão de limpeza do plano também é mais estreito que o do código.

## Como foi pedido à IA

As dicas são a única funcionalidade da Narsil planejada num documento público antes de o código ser escrito: `docs/plan-advice.md`, adicionado em `dd7027a` (2026-10-30) "docs: plan tips about the work in progress" (planejar dicas sobre o trabalho em andamento). É um plano, não as palavras da pessoa autora; o pedido que levou a ele não foi registrado.

### O que o plano diz

O objetivo do plano:

> "Narsil, the mod's sea-serpent mascot, occasionally offers a short, wise, concrete tip about the work in progress: what Claude just did, the error it hit, the change it made."

Tradução para o português: a Narsil, a mascote serpente marinha do mod, oferece de vez em quando uma dica curta, sábia e concreta sobre o trabalho em andamento: o que o Claude acabou de fazer, o erro que encontrou, a mudança que fez.

E a sua escolha entre as duas formas de pedir a um modelo, depois de uma tabela que as compara:

> "Recommendation: automatic tips through `complete` with `haiku`; the transcript-aware `fork` only when the person asks for it."

Tradução para o português: recomendação: dicas automáticas por meio de `complete` com `haiku`; o `fork`, que conhece a transcrição, só quando a pessoa pedir.

Essa recomendação é o que o código faz hoje.

### Registrado: as dicas ficam como estão

Quando a pessoa autora redesenhou a faixa para todas as conversas, o pedido em `odd/tasks/fleet-view.md`, L1 (2026-11-06), terminava com:

> "los consejos seguirian funcionando como ahora en cada ventana"

Tradução para o português: as dicas continuariam funcionando como agora em cada janela. O registro de tarefas o anota como S10, "Tips unchanged" (dicas sem mudanças), e o design combinado em L4 põe "the tip and next steps of this window below" (a dica e os próximos passos desta janela abaixo) da lista.

### Reconstrução a partir do histórico de commits

A partir de `git log -- hooks/advice.ts docs/plan-advice.md overlay/tip.js overlay/tip.ps1 overlay/tip.sh`, com os commits relacionados em `hooks/register.tsx`:

- `dd7027a` (2026-10-30) "docs: plan tips about the work in progress" (planejar dicas sobre o trabalho em andamento).
- `467a64b` (2026-10-30) "feat(advice): give short, concrete tips about the work in progress" (dar dicas curtas e concretas sobre o trabalho em andamento). A primeira versão, seguindo o plano.
- `e379f0e` (2026-10-30) "feat(advice): keep the tip in the floating window for 15 minutes" (manter a dica na janela flutuante por 15 minutos).
- `c564ab5` (2026-10-30) "fix(band): break long tips into short lines" (quebrar as dicas longas em linhas curtas).
- `71383d6` (2026-10-30) "fix(texts): agree state counts in number and keep advice gender-neutral toward the person" (fazer as contagens de estado concordarem em número e manter as dicas neutras em gênero em relação à pessoa). A regra do prompt sobre o feminino ser só da Narsil.
- `c98adac` (2026-10-31) "feat: open tips whole in their own window on Windows and give the band more room" (abrir as dicas inteiras numa janela própria no Windows e dar mais espaço à faixa), depois `a95e96a` (2026-10-31) "feat: open tips whole in their own window on macOS too" (abrir as dicas inteiras numa janela própria também no macOS).
- `69647da` (2026-11-01) "fix: show tips whole up to 320 characters, cutting a runaway one at its last sentence" (mostrar as dicas inteiras até 320 caracteres, cortando uma descontrolada na sua última frase).
- `d1e6d40` (2026-11-04) "feat: make tips weigh design choices from the diff and next steps say what the project lacks" (fazer as dicas pesarem escolhas de design a partir do diff e os próximos passos dizerem o que falta ao projeto). A maior correção: a sua mensagem diz que a dica de fim de turno "now reads the uncommitted diff (or the last commit) and comments on a design decision, an alternative and its tradeoff, instead of routine checks" (agora lê o diff sem commit, ou o último commit, e comenta uma decisão de design, uma alternativa e a sua troca, em vez de conferências rotineiras), com o Haiku em esforço médio e limites mais longos.
- `1216dc4` (2026-11-04) "feat: space automatic tips to one every 30 minutes by default" (espaçar as dicas automáticas para uma a cada 30 minutos por padrão). As preferências guardadas que ainda tinham o antigo padrão de 10 passam para 30 uma vez.

O padrão: um plano, uma primeira versão fiel, e depois correções a cada vez que as dicas se mostraram curtas demais, frequentes demais ou genéricas demais.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No meu mod do Claude Code `my-pet`, dê uma dica curta sobre o trabalho quando um turno terminar. Mantenha um contexto pequeno em variáveis de módulo: o último prompt de `prompt.submit`, as últimas 15 chamadas de ferramentas e os arquivos editados de `tool.call`, e a resposta final de `turn.complete`. Quando um turno da conversa principal terminar com `reason === 'answer'`, sem aguardar, leia `git diff HEAD --stat --patch` com `$.process.run` (tempo limite de 5 s), monte um contexto de no máximo 6.000 caracteres, remova tudo o que pareça um segredo, e chame `$.model.complete` com `model: 'haiku'`, um prompt de sistema que peça uma dica concreta de no máximo 300 caracteres sobre uma decisão de design no diff, sem conferências rotineiras, e a resposta exata `SKIP` quando não houver nada útil. Passe as últimas cinco dicas e peça para não repeti-las. Permita no máximo uma dica a cada 30 minutos e 20 por dia. Mostre a dica na faixa `AbovePrompt` com um botão "×" por 3 minutos. Teste com `on('model.complete', ...)` simulando o modelo: o prompt contém o nome do arquivo editado, `SKIP` não mostra nada, e um valor `API_KEY=` nunca chega ao prompt.

## O código mínimo

Escrito para este guia e conferido com os tipos da 2.1.325 (`$.model.complete`, `$.process.run`, `$.clock.now`, `$.ui.log`, `prompt.submit`, `turn.complete`, `ui.render`). Foi adaptado de `hooks/advice.ts` e `hooks/register.tsx` do [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). O atom `tip` está declarado em `types/index.d.ts`, como no primeiro guia, com o tipo `{ text: string; at: number } | null`.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const tip = atom({ plugin: 'my-pet', key: 'tip' } as const, null)
const SYSTEM = [
  'You give ONE concrete tip, at most 300 characters, about the work in progress.',
  'Comment on one design decision visible in the diff: the alternative and its tradeoff.',
  'No routine checks (running the tests, checking the push). Nothing invented.',
  'If there is nothing useful to say, answer exactly SKIP.',
].join('\n')
const EVERY_MS = 30 * 60_000
const SHOWN_MS = 3 * 60_000

let lastPrompt = ''
let lastTipAt: number | null = null
const recent: string[] = []

const sanitize = (text: string) =>
  text
    .replace(
      /[^\s"'`]*(key|token|secret|password)[^\s"'`]*\s*[:=]\s*("[^"]*"|'[^']*'|\S+)/gi,
      '[hidden]',
    )
    .replace(/[A-Za-z0-9+/_-]{32,}={0,2}/g, '[hidden]')

async function diff($: EngineInterface): Promise<string> {
  try {
    const r = await $.process.run(['git', '--no-pager', 'diff', 'HEAD', '--stat', '--patch'], {
      timeoutMs: 5000,
    })
    return r.exitCode === 0 ? r.stdout.slice(0, 3000) : ''
  } catch {
    return ''
  }
}

async function autoTip($: EngineInterface, answer: string): Promise<void> {
  const now = await $.clock.now()
  if (lastTipAt !== null && now - lastTipAt < EVERY_MS) return
  lastTipAt = now
  const context = sanitize(
    `Last message: ${lastPrompt}\nFinal answer: ${answer.slice(0, 1500)}\nChanges:\n${await diff($)}`,
  ).slice(0, 6000)
  const before = recent.length
    ? `\n\nEarlier tips (do not repeat):\n${recent.map((t) => `- ${t}`).join('\n')}`
    : ''
  const reply = await $.model.complete({
    model: 'haiku',
    system: SYSTEM,
    prompt: `Context:\n${context}${before}\n\nYour tip:`,
    effort: 'medium',
    timeoutMs: 30_000,
  })
  if (!reply.isAnswered) return
  const text = reply.text.trim()
  if (!text || /^skip\b/i.test(text)) return
  recent.push(text)
  if (recent.length > 5) recent.shift()
  await update($, tip, () => ({ text, at: now }))
  $.ui.log(`💡 ${text}`)
}

export const register: Register = (on) => {
  on('prompt.submit', async ($, e, next) => {
    if (!e.isMeta) lastPrompt = e.text.slice(0, 400)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    // Never awaited: the tip must not slow the turn.
    if (e.agentId === undefined && e.reason === 'answer')
      void autoTip($, e.answer).catch(() => undefined)
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const shown = await read($, tip)
    if (!shown || (await $.clock.now()) - shown.at > SHOWN_MS) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" gap={1} minWidth={0}>
        <Text wrap="truncate-end">{`💡 ${shown.text}`}</Text>
        <Button key="tip-dismiss" label="×" onPress={() => update($, tip, () => null)} />
      </Box>
    )
  })
}
```

Tradução do comentário para o português: nunca é aguardado, a dica não pode deixar o turno mais lento.

A faixa aqui confere a idade da dica quando desenha. A Narsil, em vez disso, marca a dica como esmaecida no seu batimento, para que a faixa se redesenhe quando os três minutos terminam, e não só no próximo render.

## Erros comuns e como testar

- **Aguardar o modelo no hook.** Um hook `turn.complete` que aguarda uma conclusão segura o fim do turno pelo tempo que o modelo levar. Inicie-a e retorne.
- **Nenhuma forma de ficar calado.** Sem `SKIP`, o modelo sempre encontra algo a dizer, e a maior parte é enchimento.
- **Enviar a conversa a um modelo barato por acidente.** `$.model.complete` envia apenas o que você coloca nele. Decida campo por campo o que sai, limite cada um, e limpe o conjunto.
- **Executar o texto do modelo como código.** As janelas de dica recebem o texto pelo ambiente, nunca dentro de um script ou de uma linha de comando.
- **Nenhum limite de frequência.** Cada dica é uma requisição cobrada. Ponha um intervalo mínimo e um limite diário no mod; nada no motor acrescenta um.
- **Confiar no plano mais do que no código.** Se você copiar de `docs/plan-advice.md`, confira os números com `hooks/advice.ts`: vários mudaram.

Para testar, `claude plugin test .` executa `tests/narsil.test.tsx`, que responde ao modelo com `on('model.complete', ...)` e `on('model.fork', ...)`, para que nenhuma requisição real seja feita. Testes que vale a pena ler: "a finished turn's tip weighs a design choice of the turn, from its diff, with Haiku at medium effort" (a dica de um turno terminado pesa uma escolha de design do turno, a partir do seu diff, com o Haiku em esforço médio), "SKIP or an empty reply shows nothing" (SKIP ou uma resposta vazia não mostram nada), "with the default, a second tip waits 30 minutes" (com o padrão, uma segunda dica espera 30 minutos), "two failures of the same tool give one debugging tip" (duas falhas da mesma ferramenta dão uma dica de depuração), "/narsil consejo profundo asks over the conversation itself" (/narsil consejo profundo pergunta sobre a própria conversa), "a secret never reaches the prompt sent to the model" (um segredo nunca chega ao prompt enviado ao modelo) e "a failed, timed-out or rejected model call shows nothing and breaks nothing" (uma chamada ao modelo que falhou, esgotou o tempo ou foi rejeitada não mostra nada e não quebra nada). As janelas de dica têm os seus: "on Windows a tip opens whole in its own window, and leaves the band and the floating window free" (no Windows, uma dica abre inteira numa janela própria, e deixa a faixa e a janela flutuante livres) e "on macOS a tip opens whole in its own window too, through tip.sh, detached" (no macOS, uma dica também abre inteira numa janela própria, por meio de tip.sh, destacada).

## Para ir além

- `adviceCommand` em `hooks/register.tsx` trata todos os comandos `/narsil consejo…`; `setAdvice` guarda as preferências com `$.store`.
- A migração do padrão guardado de 10 para 30 minutos (`ADVICE_MIGRATED_KEY`) muda um 10 antigo uma vez e mantém um 10 escolhido depois.
- `lines` em `hooks/advice.ts` quebra uma dica em linhas e corta uma palavra mais longa que uma linha, como um caminho ou uma URL.
- O próximo guia reaproveita o mesmo contexto, o mesmo `describe` e a mesma chamada ao modelo para propor próximos passos.
