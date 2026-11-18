---
title: Voz e alertas
description: 'Como a Narsil escolhe uma frase aleatória para cada momento, a diz em voz alta com as vozes do próprio Windows ou macOS e avisa você pela janela flutuante ou por uma notificação do sistema.'
route: pet
order: 6
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: overlay/speak.ps1
  - repo: pet
    path: overlay/speak.sh
  - repo: pet
    path: overlay/toast.ps1
  - repo: pet
    path: overlay/toast.sh
  - repo: pet
    path: docs/plan-advice.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## O que faz

A Narsil fala, em espanhol, nos momentos que importam:

| Momento                                        | Um exemplo do que ela diz                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| Você envia um prompt e o trabalho começa       | "Estoy en eso." ("Estou nisso.")                                         |
| Um turno termina                               | "Listo, ya quedó." ("Pronto, ficou feito.")                              |
| Uma pergunta, uma permissão ou um plano espera | "Te necesito un momento." ("Preciso de você um momento.")                |
| Um turno para por causa de um erro             | "Tuve un tropiezo y me detuve." ("Tropecei e parei.")                    |
| Algo está esperando há cinco minutos           | "Sigo aquí, esperándote." ("Continuo aqui, esperando você.")             |
| Um subagente em segundo plano termina ou para  | "Un ayudante terminó su encargo." ("Um ajudante terminou a sua tarefa.") |

Cada momento tem entre quatro e dez frases, e ela escolhe uma aleatoriamente a cada vez, para não se repetir. Ela fala de si mesma na primeira pessoa e nunca pelo nome.

Junto com a voz vem um alerta escrito com um título e um texto, como "He terminado" ("Terminei") sobre um breve resumo da resposta do Claude. Onde ele aparece depende de uma configuração:

- **Com a janela flutuante ligada** (o padrão), o alerta aparece na janela, que surge para mostrá-lo. Nenhuma notificação do sistema é enviada além disso.
- **Com a janela flutuante desligada**, o alerta chega como uma notificação. No Windows, clicar nela abre aquela conversa.

Três comandos a ajustam. `/narsil silencio` e `/narsil voz` desligam e ligam a voz. `/narsil discreto` (modo discreto) a mantém em silêncio, descarta os alertas de "turno terminado" e ainda avisa você, sem falar, quando algo precisa de você ou falha; `/narsil normal` desfaz isso. `/narsil prueba` toca um alerta de teste com a sua voz, para que você ouça qual voz o seu sistema escolheu.

## Como funciona por dentro

### As frases: `hooks/words.ts`

As palavras ficam no seu próprio arquivo, separadas dos hooks. `VOICE` é um objeto com uma lista por momento: `start`, `done`, `error`, `question`, `stillWaiting`, `agentDone` e `agentStopped`. `say(moment)` retorna uma frase dessa lista, escolhida com `Math.random()`.

O comentário acima de `VOICE` define as regras de estilo: espanhol latino-americano neutro, o pretérito simples, nenhuma palavra usada só na Espanha, a voz de uma assistente calma e calorosa, "composed, a little playful, never servile" (serena, um pouco brincalhona, nunca servil), falando de si mesma na primeira pessoa. Essas regras são testadas, como descrito abaixo, então uma frase nova que as quebre faz o build falhar.

Manter as palavras separadas tem uma razão prática: permite que os testes leiam todas as frases sem executar uma sessão, e que alguém mude a voz dela sem tocar na lógica dos eventos.

### Uma função decide para onde vai um alerta: `announce`

Todo alerta passa por `announce` em `hooks/register.tsx`. Ela recebe um tipo (`done`, `question` ou `error`), um título, um texto e a frase a dizer. Em ordem, ela:

1. Lê as preferências. No modo discreto, um alerta `done` para aqui, a menos que seja forçado (o de teste é).
2. Começa a falar, a menos que esteja sem som ou em modo discreto. Ela não espera a voz antes de continuar.
3. Com a janela flutuante ligada, envia o alerta ao hub como `POST /event`. Se o hub estiver fora do ar, `ensureOverlay` o inicia (no máximo uma vez por minuto) e o alerta é enviado de novo.
4. Com a janela desligada, chama `notify`.
5. Envia o alerta ao celular, quando os alertas no celular estão ligados com `/narsil movil`.
6. Espera a voz terminar.

Quem chama passa a frase do momento: `say('done')` quando um turno termina com uma resposta, `say('question')` quando um turno termina numa pergunta, `say('error')` quando falha, `say('stillWaiting')` para o lembrete de cinco minutos. O início do trabalho é a exceção: em `turn.start`, um prompt que você digitou (não uma continuação) chama `speak` diretamente com `say('start')`, sem alerta escrito.

### A voz: primeiro os scripts do mod, depois o motor

`speak` tenta primeiro o script da própria Narsil e recorre à voz do motor:

```tsx
async function speak($: EngineInterface, text: string): Promise<void> {
  // The mod's own script first, so a Spanish voice is chosen when one is installed.
  if (await launch($, 'speak', { NARSIL_TEXT: text })) return
  void $.audio.speak(text).catch(() => undefined)
}
```

O comentário do código diz, em inglês: primeiro o script do próprio mod, para que uma voz em espanhol seja escolhida quando houver uma instalada. `$.audio.speak` fala com o sintetizador da plataforma e, por padrão, com a sua voz padrão. Num computador configurado em inglês, isso é uma voz inglesa lendo espanhol. Os scripts da Narsil procuram primeiro uma voz em espanhol pelo nome.

**No Windows, `overlay/speak.ps1`** tenta três coisas, em ordem:

1. Uma voz em espanhol do motor de fala clássico (`System.Speech`), preferindo as vozes "Natural" (o comentário do arquivo menciona um adaptador que expõe ali vozes do Narrador, como a Dalia) e as latino-americanas antes das da Espanha.
2. Uma voz em espanhol do motor de fala mais novo do Windows (`Windows.Media.SpeechSynthesis`, as vozes instaladas pelas Configurações do Windows), latino-americanas primeiro. Ele escreve a fala num fluxo e a reproduz.
3. A voz padrão do motor clássico.

**No macOS, `overlay/speak.sh`** lista as vozes com `say -v '?'` e escolhe primeiro a Paulina (mexicana), depois outra voz latino-americana, depois a Mónica, depois qualquer voz em espanhol e, caso contrário, a padrão do sistema, e executa `say`.

Em qualquer outro sistema, `launch` retorna false e `$.audio.speak` fala com o sintetizador da própria plataforma, que os tipos da 2.1.325 descrevem como "`say` on macOS" (`say` no macOS).

### Notificações: primeiro o motor, depois os scripts

`notify` faz o caminho inverso: pergunta primeiro ao motor.

```tsx
try {
  if ((await $.ui.notify(text, { title })).isSent) return
} catch {
  // no notification channel: the mod's own script below
}
await launch($, 'toast', {
  NARSIL_TITLE: title,
  NARSIL_TEXT: text,
  NARSIL_LINK: conversationLink(),
})
```

`$.ui.notify` retorna `{ isSent: true, … }` quando um canal a aceitou, ou `{ isSent: false, reason }` caso contrário. O `try` está ali, como diz o comentário do código (sem canal de notificação: o script do próprio mod, abaixo), porque onde o host não tem notify nenhum a chamada lança um erro antes de retornar uma promise. Só quando o motor não a enviou a Narsil usa os seus scripts. (O README chama o resultado de "notificación del sistema", uma notificação do sistema; no código, o canal do próprio motor vem primeiro e os scripts do sistema depois.)

- **`overlay/toast.ps1`** monta uma notificação toast do Windows com o título sobre o texto, ambos escapados para XML. Quando `NARSIL_LINK` contém um link de conversa, ele faz o toast abrir esse link ao clicar. Ele confere o link com o mesmo padrão que o hub usa, `claude://code/continue?session=local_…&source=desktop_action`, antes de usá-lo.
- **`overlay/toast.sh`** chama `osascript` com `display notification`. O título e o texto são passados como argumentos ao script, nunca escritos dentro dele, "so nothing in them runs" (para que nada neles seja executado), como diz o seu comentário.

### Executar os scripts: `launch`

Tanto a voz quanto a notificação passam por `launch`, que inicia um script como um processo próprio e retorna na hora. Ela usa `$.process.run`, que executa um comando pelo seu vetor de argumentos, sem shell, e espera que ele termine:

- **No macOS**, ela executa `/bin/sh -c 'nohup /bin/sh "$NARSIL_SCRIPT" </dev/null >/dev/null 2>&1 &'`. O shell inicia o script em segundo plano e sai, então `$.process.run` retorna imediatamente.
- **No Windows**, ela executa o PowerShell com `Start-Process -WindowStyle Hidden`, que inicia outro PowerShell oculto sobre o script e retorna.

O sistema é detectado uma vez, por `platformOf`: a variável de ambiente `OS` (`Windows_NT`), caso contrário `uname -s` (`Darwin` para o macOS).

Duas decisões de design ficam visíveis aqui:

- **Desacoplado, para que a fala sobreviva ao hook.** Uma frase falada pode levar segundos. Um processo desacoplado continua falando depois que o hook retorna, depois do turno e depois de uma recarga do mod, à qual, como observa o comentário acima de `launch`, um temporizador de `$.clock` não sobreviveria.
- **Texto no ambiente, nunca no comando.** O caminho do script, o texto e o título viajam como variáveis de ambiente (`NARSIL_SCRIPT`, `NARSIL_TEXT`, `NARSIL_TITLE`, `NARSIL_LINK`). A linha de comando em si é uma string fixa. O comentário no topo de `speak.ps1` diz por quê: "nothing Claude wrote can be interpreted as code" (nada que o Claude escreveu pode ser interpretado como código). Uma resposta que contenha aspas, ponto e vírgula ou `$(…)` é apenas falada ou exibida.

### O que o código não usa

A Narsil não toca clipes de som: não há nenhuma chamada a `$.audio.play` em `hooks/register.tsx`. A única chamada a `$.audio` é o recurso `$.audio.speak` acima.

## Construa com o Claude

Peça ao Claude algumas frases por momento e um hook que, quando um turno termina, diga uma em voz alta e envie um alerta escrito. A única ideia que o Claude precisa acertar é que a voz nunca segura o hook: a fala pode levar segundos, então ela é iniciada, a sua rejeição é capturada, e ela não é aguardada.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No meu mod do Claude Code `my-pet`, fale quando um turno terminar. Mantenha as frases em `hooks/words.ts` como uma lista por momento (`done`, `question`, `error`), com pelo menos quatro frases cada uma, e uma `say(moment)` que escolha uma aleatoriamente. Em `turn.complete`, apenas para a conversa principal, escolha o momento a partir de `e.reason` e chame `$.audio.speak`, sem esperar por ela para que o hook retorne na hora, e capture a sua rejeição. Depois envie uma notificação com `$.ui.notify(text, { title })` e confira `isSent`. Adicione um teste de que cada momento tem pelo menos quatro frases distintas e de que 200 chamadas de `say` dão mais de uma frase. Confira cada chamada com os tipos do plugin-authoring.

### O que conferir na resposta do Claude

1. As frases ficam em `hooks/words.ts`, separadas dos hooks, com pelo menos quatro por momento e uma `say(moment)` que escolhe uma aleatoriamente.
2. `$.audio.speak` é chamada com `void … .catch(...)`, sem ser aguardada.
3. `$.ui.notify` fica dentro de um `try`, porque lança um erro onde o host não tem canal de notificação, e o seu `isSent` diz se algum canal recebeu o alerta.
4. Só a conversa principal fala: o hook retorna antecipadamente quando `e.agentId` está definido.
5. Se o Claude rodar um script para a voz, o texto viaja no ambiente ou como um argumento separado, nunca dentro de uma string de shell.

Se uma verificação falhar, diga ao Claude o que você vê: "todo turno termina alguns segundos atrasado, o tempo que a frase leva para ser dita".

### Como a pessoa autora pediu

O pedido original da voz e das notificações não foi registrado. Elas chegam no primeiro commit do overlay, antes de começarem os registros públicos de tarefas. A única nota de design registrada está em `docs/plan-advice.md`, o plano das dicas da Narsil: "**Voice**: off by default (`/narsil consejos voz` turns it on)" (voz: desligada por padrão, `/narsil consejos voz` a liga). Isso é um plano, não as palavras da pessoa autora, e trata das dicas, não destes alertas.

#### Reconstrução a partir do histórico de commits

A partir de `git log -- overlay/speak.ps1 overlay/speak.sh overlay/toast.ps1 overlay/toast.sh hooks/words.ts hooks/register.tsx` no narsil-pet:

- `6f8f938` (2026-10-30) "feat(overlay): add floating window, Spanish voice and Windows toasts" (adicionar janela flutuante, voz em espanhol e toasts do Windows). `speak.ps1` e `toast.ps1` chegam com a janela flutuante.
- `088508e` (2026-10-30) "fix(notify): fall back to the system script when the host has no notify" (recorrer ao script do sistema quando o host não tem notify). O `try` em volta de `$.ui.notify` e os scripts como segunda opção.
- `52af072` (2026-10-30) "feat(mac): speak and notify on macOS with say and osascript" (falar e notificar no macOS com say e osascript). `speak.sh` e `toast.sh`.
- `a2b5970` (2026-10-30) "fix(overlay): start the window again for an event instead of a notification" (iniciar a janela de novo para um evento em vez de uma notificação). Com a janela ligada, um alerta vai para a janela mesmo quando ela precisa ser iniciada de novo.
- `f7a494e` (2026-10-30) "feat: warn about loops, insist on waiting permissions and sum the session up" (avisar sobre laços, insistir nas permissões que esperam e resumir a sessão). O lembrete depois de uma espera.
- `c73bc13` e `36256f9` (2026-10-31): a Narsil fala de si mesma na primeira pessoa, na faixa, na janela e nos alertas.
- `17ffb30` (2026-10-31) "feat: add a quiet mode that only speaks up when Narsil needs you" (adicionar um modo discreto que só se manifesta quando a Narsil precisa de você).
- `665bd4e` (2026-11-06) "feat: speak when work starts and vary every spoken phrase" (falar quando o trabalho começa e variar cada frase falada). As frases de `start`, e várias frases para cada momento.
- `44f4372` (2026-11-07) "feat: speak natural neutral Latin American Spanish with more phrases" (falar um espanhol latino-americano neutro e natural, com mais frases). A ordem de vozes que prefere as vozes latino-americanas naturais, e as regras de estilo.

A ordem conta a história: primeiro uma voz e uma notificação que funcionavam, depois cada sistema, depois o conforto da pessoa (primeira pessoa, um modo discreto, menos repetição, uma voz mais natural).

## Código de referência

Esta é uma resposta correta, escrita para este guia. Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

Escrito para este guia e conferido com os tipos da 2.1.325 (`$.audio.speak`, `$.ui.notify`, `turn.complete`). Ele usa apenas a voz e as notificações do motor. Os scripts da própria Narsil, que escolhem uma voz em espanhol, estão descritos acima; o código foi adaptado de `hooks/words.ts` e `hooks/register.tsx` do [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later).

As frases, `hooks/words.ts`:

```ts
export const VOICE = {
  done: ['Done.', 'All finished here.', 'Finished. Have a look when you can.', 'That is done.'],
  question: [
    'I need you for a moment.',
    'I have a question for you.',
    'Your call, please.',
    'Can you help me with something?',
  ],
  error: [
    'Something went wrong and I stopped.',
    'I hit an error.',
    'I stopped to avoid making it worse.',
    'Let us look at this together.',
  ],
} as const satisfies Record<string, readonly string[]>

export type Moment = keyof typeof VOICE

export function say(moment: Moment): string {
  const options: readonly string[] = VOICE[moment]
  return options[Math.floor(Math.random() * options.length)] ?? options[0]
}
```

O hook, em `hooks/register.tsx`:

```tsx
import type { Register } from 'claude-code'
import { say, type Moment } from './words'

export const register: Register = (on) => {
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    const moment: Moment = e.reason === 'answer' ? 'done' : 'error'
    const phrase = say(moment)
    // Not awaited: the utterance may take seconds.
    void $.audio.speak(phrase).catch(() => undefined)
    try {
      await $.ui.notify(phrase, { title: 'my-pet' })
    } catch {
      // no notification channel here
    }
    return result
  })
}
```

A Narsil não envia a lugar nenhum os turnos `aborted` (você pressionou parar): ela define o estado como parado, sem alerta. Uma versão mais completa também conferiria `e.reason === 'aborted'` e ficaria em silêncio.

## Erros comuns e como testar

- **Esperar pela voz no hook.** `$.audio.speak` se resolve quando a fala termina. Esperada num hook, ela segura o evento por segundos. Inicie-a e capture a sua rejeição, como faz a Narsil.
- **Colocar o texto na linha de comando.** Se você executa um script com uma frase montada a partir da resposta do Claude, passe-a no ambiente ou como um argumento separado, nunca dentro de uma string de shell. `toast.sh` e `speak.ps1` mostram o padrão.
- **Supor que uma voz existe.** `$.audio.speak` rejeita quando não há sintetizador ou a voz não está instalada. Os scripts da Narsil recorrem passo a passo à voz padrão.
- **Dois alertas para um evento.** A Narsil envia um alerta à janela ou ao sistema, nunca aos dois, e o README diz o mesmo.
- **Notificar enquanto a pessoa está olhando.** Com a janela flutuante ligada, o hub descarta um evento que chega enquanto o Claude está na frente, a menos que seja forçado. A voz continua falando.
- **Repetir uma frase.** A mesma frase a cada turno vira ruído rapidamente; várias frases por momento resolvem isso a quase nenhum custo.

Para testar, `claude plugin test .` executa `tests/narsil.test.tsx`. "each moment Narsil speaks has several phrases, so she does not always say the same" (cada momento em que a Narsil fala tem várias frases, para que ela não diga sempre o mesmo) confere pelo menos quatro frases distintas por momento e chama `say('start')` 200 vezes. "what Narsil says is neutral Latin American Spanish: no Spain-only words, the simple past" (o que a Narsil diz é espanhol latino-americano neutro: nenhuma palavra só da Espanha, o pretérito simples) impõe as regras de estilo com duas expressões regulares e confere que nenhuma frase contém o nome dela. "on macOS Narsil speaks and notifies with its own scripts, detached, never PowerShell" (no macOS a Narsil fala e notifica com os seus próprios scripts, desacoplados, nunca com PowerShell) executa `/narsil prueba` com um macOS simulado e confere o comando `nohup` exato e o `NARSIL_TEXT` e o `NARSIL_TITLE` que ele passa. "on Windows Narsil still speaks and starts the window through PowerShell" (no Windows a Narsil continua falando e iniciando a janela por meio do PowerShell) cobre o outro lado, e "with the window on but down, an event starts it again and shows there, never as a notification" (com a janela ligada mas fora do ar, um evento a inicia de novo e aparece ali, nunca como notificação) cobre a escolha de `announce`. Para ouvir o resultado no seu próprio computador, execute `/narsil prueba`.

## Para ir além

- `nudgeText` em `hooks/watch.ts` monta o texto do lembrete de cinco minutos, e `NUDGE_AFTER_MS` define a espera.
- `summary` em `hooks/words.ts` corta a resposta do Claude no texto curto do alerta "He terminado", com uma versão mais longa para o celular.
- `/narsil consejos voz` deixa a Narsil falar também as suas dicas de fim de turno; isso fica desligado por padrão, como planejou `docs/plan-advice.md`.
- A tabela "Sistemas compatibles" do README lista a voz e as notificações de cada sistema.
