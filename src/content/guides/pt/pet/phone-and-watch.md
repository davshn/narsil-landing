---
title: Alertas no celular e no relógio
description: 'Como /narsil movil envia o que precisa de você a um tópico privado do ntfy.sh quando escreve de longe, com limite diário, tópico de estado silencioso, chave opcional que sela o conteúdo e Web Push.'
route: pet
order: 15
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/phone.ts
  - repo: pet
    path: hooks/seal.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## O que faz

Quando você trabalha longe do computador, conduzindo o Claude Code pelo Remote Control a partir do celular ou da web, a faixa e a janela flutuante ficam fora de vista. `/narsil movil` ("celular") envia ao seu celular, em vez disso, o que precisa de você: uma conversa terminou, precisa de você ou falhou. Um relógio que espelha as notificações do celular também as mostra; o README da Narsil cita o Wear OS.

Os alertas viajam pelo [ntfy.sh](https://ntfy.sh), um serviço público de notificações. O comando cria um tópico com um nome aleatório, como `narsil-0000000000example0` (todo nome de tópico neste guia é um exemplo inventado). Você instala o aplicativo ntfy, assina esse tópico, e os alertas chegam como notificações com o desenho da Narsil no estágio dela, na pose do alerta, e um botão que abre o aplicativo do Claude.

A Narsil só envia enquanto a sua última mensagem, em qualquer conversa, veio do Remote Control. No momento em que você volta a escrever na mesa, em qualquer uma delas, ela para. Assim, o celular só tem notícias dela quando você está de fato longe.

> **Aviso: qualquer pessoa que conheça o nome do tópico pode lê-lo, e pode publicar nele.** Os tópicos do ntfy.sh, do jeito que a Narsil os usa, não têm senha: o nome é a única coisa que os mantém privados. Não o compartilhe, não o cole em capturas de tela, e execute `/narsil movil nuevo` para passar a um novo se ele vazar. Use a chave (`/narsil movil clave`) se o seu receptor a suportar: com ela, o título e o texto de cada alerta viram "Narsil" e um texto ilegível para qualquer pessoa sem a chave, embora o tipo de alerta, a sua hora e o estágio da Narsil continuem visíveis.

Os comandos:

| Comando                   | O que faz                                                                   |
| ------------------------- | --------------------------------------------------------------------------- |
| `/narsil movil` ou `on`   | Liga os alertas (criando o tópico na primeira vez) e diz como acompanhá-lo. |
| `/narsil movil off`       | Desliga-os; `on` os liga de novo com o mesmo tópico.                        |
| `/narsil movil nuevo`     | Cria um novo tópico; o antigo não recebe mais nada.                         |
| `/narsil movil prueba`    | Envia um alerta de teste, mesmo da mesa.                                    |
| `/narsil movil clave`     | Cria uma chave e sela tudo o que for enviado daqui em diante.               |
| `/narsil movil clave off` | Para de selar.                                                              |

## Como funciona por dentro

`hooks/phone.ts` contém as partes simples (o tópico, a mensagem, a contagem) como funções puras; `hooks/seal.ts` contém a selagem; `hooks/register.tsx` envia e conta.

### O tópico: `narsil-` e 20 caracteres hexadecimais

`newTopic(crypto.randomUUID())` em `hooks/phone.ts` pega um UUID aleatório, mantém só os seus caracteres hexadecimais, passa-os para minúsculas e mantém os 20 primeiros: `narsil-` seguido de 20 caracteres de `0-9a-f`. O comentário acima dela enuncia todo o modelo de segurança do tópico: "A topic nobody guesses: whoever knows its name can read it." (Um tópico que ninguém adivinha: quem conhece o seu nome pode lê-lo.)

O tópico é salvo nas preferências (`phoneTopic` em `prefs`, guardado com `$.store`), então todas as conversas usam o mesmo. `/narsil movil nuevo` o substitui por um novo.

Mais dois tópicos dependem dele, pelo nome:

- `<topic>-estado` ("estado"): um estado silencioso para a extensão do Firefox (abaixo).
- `<topic>-push`: onde um aplicativo web de celular deixa a sua assinatura de Web Push (abaixo).

### Quando um alerta é enviado: onde você escreveu por último

A regra vem do pedido da pessoa autora no registro de tarefas (citado abaixo): alertar o celular quando você pediu do celular. Nenhum evento diz a um mod que o Remote Control está ligado, então a Narsil olha de onde vêm as suas mensagens.

Os tipos da 2.1.325 dão a `prompt.submit` e a `command.run` um `origin`, um `PromptOrigin`. Dois dos seus tipos importam aqui: `composer`, "The user's own gesture at the terminal" (o próprio gesto do usuário no terminal), e `bridge`, "The user's message through the Remote Control bridge (a phone or web client)" (a mensagem do usuário pela ponte do Remote Control, um cliente de celular ou web). `noteOrigin` em `hooks/register.tsx`, chamada a partir dos dois hooks, registra o último:

- `bridge` significa longe; `composer` significa na mesa; qualquer outro tipo não muda nada.
- Ele é escrito em `$.store` sob `remoteOrigin`, não só numa variável de módulo. O store é compartilhado por todas as conversas do plugin, então uma conversa que você começou na mesa também alerta enquanto você escreve do celular em outra, e nenhuma alerta depois que você escreve na mesa em qualquer lugar.

`isAway` o lê de volta, recorrendo à variável de módulo quando o store falha.

### O que um alerta leva

Todo alerta passa por `announce` (guia 6), que termina chamando `sendToPhone`. `phoneMessage` em `hooks/phone.ts` monta o JSON que o ntfy.sh recebe:

- `topic`: o seu tópico.
- `title`: "Narsil · He terminado · api" ("Narsil · Terminei · api"), com o nome da conversa por último.
- `message`: o texto e depois, quando há mais de uma conversa aberta, uma lista como "Conversaciones:" ("Conversas:") seguida de "● web · ERROR" e "● api · TRABAJANDO" ("● api · TRABALHANDO"). O texto do celular para um turno terminado é mais longo que o do desktop, já que um celular tem espaço para mais da resposta do Claude.
- `priority`: 3 para um término, 4 para uma pergunta ou um erro.
- `tags`: `white_check_mark`, `raising_hand` ou `warning`, que o aplicativo ntfy mostra como um emoji.
- `icon`: o desenho dela como PNG no estágio dela e na pose do alerta, vindo do repositório no GitHub, que o próprio celular baixa.
- `actions`: um botão "Abrir Claude" para `https://claude.ai/code`. O comentário explica que nada num celular leva à própria conversa, então o botão abre o aplicativo do Claude, onde o Remote Control a lista.

`postToPhone` o envia com `$.http.fetch` como um `POST` para `https://ntfy.sh` com um corpo JSON. O modo discreto se aplica como em todo lugar: um término não é enviado, uma pergunta ou um erro é.

### O limite diário: 200

`PHONE_DAILY` é 200. O comentário do código: "ntfy.sh takes 250 a day for free: Narsil stops short of it." (o ntfy.sh aceita 250 por dia de graça: a Narsil para antes disso.) O README diz o mesmo.

A contagem fica em `$.store` sob `phone`, como `{ day, sent }`, compartilhada por todas as conversas. `day` vem de `dayOf`, a data UTC ("2026-10-31"), então a contagem recomeça à meia-noite UTC, não à meia-noite local. Uma contagem guardada de outro dia, ou um valor estranho, conta como zero.

Antes de cada mensagem, `postToPhone` confere a contagem e para em 200. A 200ª mensagem, quando é um alerta, termina com "(último aviso de hoy: mañana sigo)" ("último alerta de hoje: amanhã eu continuo"). Uma mensagem que falha ao ser enviada não é contada. As mensagens do tópico `-estado` contam para os mesmos 200.

### O tópico `-estado` e os seus campos

Depois de cada turno da conversa principal, e a cada pergunta, `sendStatus` publica um pequeno estado em `<topic>-estado`, sob as mesmas regras dos alertas (alertas ligados, você longe, a contagem diária). `/narsil movil prueba` também envia um. Ele vai com `priority: 1`, e o comentário do código diz que este tópico é "not followed by push, so its messages never show as notifications" (não acompanhado por push, então as suas mensagens nunca aparecem como notificações).

O README diz que ele é lido pela extensão do Firefox da pessoa autora (`narsil-claude`), "because they are data only the PC knows" (porque são dados que só o PC conhece). A mensagem é um texto JSON com estes campos:

| Campo          | O que é                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------- |
| `xp`           | O rótulo de nível da Narsil, "⭐ Nivel 3 · 120/300 XP" (guia 13).                                 |
| `art`          | A URL do desenho dela, no estágio dela, na pose da conversa aberta mais importante.               |
| `at`           | Quando foi enviado, em segundos Unix.                                                             |
| `cacheMinutes` | Quanto dura o cache do prompt, da primeira conversa aberta que tiver um; ausente caso contrário.  |
| `usage`        | Uma linha, `ntfy`, com a contagem do próprio ntfy.sh das mensagens de hoje da sua rede, ou vazia. |

Para `usage`, a Narsil pede `GET https://ntfy.sh/v1/account` e monta a linha com `ntfyRow`: `{ key: 'ntfy', label: 'ntfy hoy', percent, color, note, resetsAt }`, contando a mensagem prestes a sair. O comentário explica por que essa contagem difere da própria contagem da Narsil: o ntfy.sh conta por endereço IP, "in a day of its own that starts at an hour hashed from the IP, not at midnight" (num dia próprio que começa numa hora derivada de um hash do IP, não à meia-noite).

### A chave opcional, e como o conteúdo é selado

`/narsil movil clave` ("chave") cria uma chave com `newKey()`: 32 bytes aleatórios de `crypto.getRandomValues`, escritos em base64url (43 caracteres). Ela é salva nas preferências (`phoneKey`) e mostrada na resposta do comando, para que você possa colá-la nas opções do receptor. Daí em diante, tudo o que a Narsil publica no ntfy.sh, tanto os alertas quanto o `-estado`, é selado.

O que é selado e o que não é, segundo `sealedMessage` e `sealedPayload` em `hooks/phone.ts`:

- **Selados:** o título e o texto, juntos como JSON dentro de `message`.
- **Às claras:** o tópico, `title` substituído apenas por "Narsil", a prioridade, as tags, a URL do ícone e o botão.

Assim, um alerta selado ainda mostra que um alerta aconteceu, quando, o seu tipo (pela prioridade, pela tag e pela pose no nome do arquivo do ícone) e o estágio da Narsil (pela pasta do ícone). O nome da conversa, a resposta do Claude e a lista de conversas ficam dentro.

O esquema, exatamente como `hooks/seal.ts` o implementa. O comentário do arquivo explica por que ele é construído à mão: "The hooks module's crypto has SHA-256 alone" (o crypto do módulo de hooks só tem SHA-256). Os tipos da 2.1.325 concordam: o `crypto.subtle` do módulo de hooks declara `digest` e nada mais. Então:

1. **HMAC-SHA256 a partir de `digest`.** `hmac(key, data)` é a construção clássica sobre SHA-256: a chave preenchida até 64 bytes (passada antes pelo hash se for mais longa), depois `SHA-256((key ⊕ 0x5c) ‖ SHA-256((key ⊕ 0x36) ‖ data))`.
2. **Duas chaves a partir de uma.** A partir da chave de 32 bytes, `encKey = HMAC(key, "enc")` e `macKey = HMAC(key, "mac")`.
3. **Um nonce novo.** 16 bytes aleatórios para cada mensagem.
4. **O fluxo de chave.** O bloco `i` é `HMAC(encKey, nonce ‖ i)`, com `i` em 4 bytes, big-endian; cada bloco dá 32 bytes, combinados por XOR com o texto em UTF-8. O comentário chama isso de modo contador (CTR).
5. **A tag.** `HMAC(macKey, nonce ‖ ciphertext)`, 32 bytes, sobre os bytes cifrados (o comentário chama isso de "encrypt-then-MAC", cifrar e depois autenticar).
6. **O texto enviado.** `narsil1:` seguido do base64url de `nonce ‖ ciphertext ‖ tag`.

`unseal` faz o caminho inverso: confere o prefixo `narsil1:` e um comprimento mínimo, recalcula a tag e a compara byte a byte, e só então decifra. Uma chave errada, um byte alterado ou um texto não selado dão `null`. O teste "what the mod seals, it opens; with another key, or tampered, it does not" (o que o mod sela, ele abre; com outra chave, ou adulterado, não abre) confere esses três casos. O comentário diz que os receptores o abrem com o HMAC do WebCrypto, "which gives the same bytes" (que dá os mesmos bytes); esses receptores são projetos separados, fora deste repositório.

Este guia descreve o que o código faz e não afirma nada além disso. Se você o adaptar, revise-o como revisaria qualquer criptografia feita à mão.

O aplicativo ntfy não consegue abrir mensagens seladas: ele mostra o ruído. A Narsil avisa isso quando você liga a chave, e `/narsil movil clave off` volta ao texto simples. Executar `/narsil movil clave` de novo cria uma nova chave.

### Web Push: manter um aplicativo web de celular assinado

Além do aplicativo ntfy, os alertas podem chegar a um aplicativo web seu por Web Push; o README cita o [narsil-pwa](https://github.com/davshn/narsil-pwa) da pessoa autora. O ntfy.sh pode entregar um tópico por Web Push a uma assinatura de navegador, mas, como diz o comentário do código, "ntfy.sh drops a subscription whose delivery failed once" (o ntfy.sh descarta uma assinatura cuja entrega falhou uma vez). O aplicativo poderia se registrar de novo quando você o abrisse, mas então os alertas esperariam você abri-lo.

Por isso, o mod a registra de novo antes de cada alerta (`renewPush`, chamada só para alertas, não para o `-estado`):

1. O aplicativo deixa a sua assinatura, `{ endpoint, auth, p256dh }`, em `<topic>-push`, selada com a chave quando há uma.
2. `latestPush` lê a última mensagem ali, `GET https://ntfy.sh/<topic>-push/json?poll=1&since=latest`. Com uma chave, ela a abre com `unseal`; sem chave, a lê como está.
3. `pushSubscriptionOf` aceita só um endpoint `https` de no máximo 1.000 caracteres e duas chaves base64url curtas; qualquer outra coisa é ignorada.
4. Uma assinatura válida é guardada em `$.store` sob `phonePush`. Quando o ntfy.sh já esqueceu a mensagem (o comentário diz que ele guarda uma mensagem por 12 horas), a guardada é usada.
5. Ela é publicada em `https://ntfy.sh/v1/webpush` com `topics: [your topic]`.

Registrar não publica nada, então não conta para os 200. Qualquer falha é engolida, e o alerta segue como seguiria.

Duas observações de privacidade decorrem do código. A própria assinatura vai ao ntfy.sh às claras, como o Web Push exige. E, sem chave, qualquer pessoa que conheça o tópico pode deixar uma assinatura em `<topic>-push`, e o mod a registrará para o seu tópico; com chave, o mod só aceita uma assinatura que se abra com ela.

### O modelo de privacidade em palavras simples

- **O ntfy.sh vê tudo o que não está selado**, e a hora e a rede de cada mensagem. É um serviço de terceiros: leia os seus termos antes de enviar qualquer coisa para lá.
- **O nome do tópico é a senha.** Quem o tem pode ler todas as mensagens e publicar mensagens falsas. Um nome aleatório o torna difícil de adivinhar, não secreto depois de compartilhado.
- **Sem chave**, quem lê o tópico vê os nomes das conversas, o texto de cada alerta (parte da resposta do Claude) e a lista de conversas abertas.
- **Com chave**, quem lê vê que um alerta aconteceu, o seu tipo, a sua hora e o estágio da Narsil, mas não o texto. Uma mensagem forjada não se abre com a chave, o que permite a um receptor que confere a tag rejeitá-la.
- **A chave vive em dois lugares**: no store do plugin, um arquivo JSON dentro do diretório de configuração do Claude Code, e na resposta de `/narsil movil clave`, que faz parte da conversa. As respostas dos comandos da Narsil não definem `isTextDisplayOnly`, e os tipos da 2.1.325 dizem que, fora os plugins incluídos no Claude Code, "Any other plugin's text stays in requests" (o texto de qualquer outro plugin permanece nas requisições), então o modelo também a lê. Trate a conversa como algo que contém a chave.
- **O envio para na mesa.** Nada sai enquanto a sua última mensagem veio do terminal ou do aplicativo de desktop, exceto o teste.

## Construa com o Claude

Peça ao Claude que envie ao seu celular, pelo ntfy.sh, o que precisa de você, só enquanto você estiver longe. A única ideia que ele precisa acertar é que estar longe não é um evento: é lido de onde veio a sua última mensagem, `bridge` para o Remote Control e `composer` para a mesa.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No meu mod do Claude Code `my-pet`, acrescente alertas no celular pelo ntfy.sh. `/my-pet phone` cria um tópico `my-pet-` mais 20 caracteres hexadecimais de `crypto.randomUUID()`, salva-o em `$.store` e responde como assiná-lo no aplicativo ntfy, avisando que qualquer pessoa que conheça o tópico pode lê-lo. Registre onde a pessoa escreveu por último: em `prompt.submit` e `command.run`, `e.origin.kind === 'bridge'` significa longe e `'composer'` significa na mesa; guarde isso em `$.store` para que todas as conversas o compartilhem. Quando um turno da conversa principal terminar, e só enquanto a pessoa estiver longe, publique `{ topic, title, message, priority }` como JSON em `https://ntfy.sh` com `$.http.fetch`. Conte as mensagens por dia UTC em `$.store` e pare em 200. Nunca ponha o tópico em logs. Teste com `claude-code/testing`, respondendo você mesmo a `http.fetch`: nada é enviado da mesa, um alerta é enviado pela ponte, e a 201ª do dia não é.

### O que conferir na resposta do Claude

1. O tópico é `my-pet-` seguido de 20 caracteres hexadecimais de `crypto.randomUUID()`, nunca um nome que alguém possa adivinhar, e ele nunca aparece num log.
2. Tanto `prompt.submit` quanto `command.run` registram a origem, e ela é guardada em `$.store`, então todas as conversas a compartilham.
3. Nada é publicado enquanto a última mensagem veio da mesa.
4. As mensagens são contadas por dia UTC em `$.store`, a contagem é conferida antes de cada mensagem, e o envio para em 200.
5. A resposta do comando avisa que qualquer pessoa que conheça o tópico pode lê-lo.

Se uma verificação falhar, diga ao Claude o que você vê: "meu celular vibra enquanto eu estou digitando na mesa".

### Como a pessoa autora pediu

#### Registrado: alertar o celular quando eu escrevo do celular

A regra do celular, tal como funciona hoje, foi pedida no registro de tarefas da visão de frota, `odd/tasks/fleet-view.md`. L1 (2026-11-06), o pedido original, inclui:

> "las notificaciones se enviarian al celular cuando se pida algo desde el celular como ahora y haya cambios, es decir alguna tarea pase de trabajando a terminado, o de trabajando a error, etc, [...] las notificaciones del celular cuando se envien llevarian la info de todas las sesiones funcionando en ese momento"

Tradução para o português: as notificações seriam enviadas ao celular quando algo for pedido a partir do celular, como agora, e houver mudanças, ou seja, alguma tarefa passar de trabalhando para terminado, ou de trabalhando para erro, etc.; as notificações do celular, quando enviadas, levariam a informação de todas as sessões em funcionamento naquele momento.

Em L2, respondendo se uma conversa iniciada na mesa também deveria alertar enquanto a pessoa autora escreve do celular em outra:

> "si claro me avisas al movil"

Tradução para o português: sim, claro, você me avisa no celular.

O registro de tarefas anota o resultado em L9 (T4 concluída): "Where you last wrote (phone or desk), in any conversation, is kept in the store (`remoteOrigin`), so every conversation alerts the phone on its changes (done, waiting, error) while your last message came from the phone, and none does once you write at the desk anywhere. Each alert ends with "Conversaciones:" and one line per open conversation" (onde você escreveu por último, celular ou mesa, em qualquer conversa, é guardado no store, `remoteOrigin`, para que toda conversa alerte o celular sobre as suas mudanças, terminado, esperando, erro, enquanto a sua última mensagem veio do celular, e nenhuma o faça depois que você escrever na mesa em qualquer lugar; cada alerta termina com "Conversaciones:" e uma linha por conversa aberta). É isso que `noteOrigin`, `isAway` e `fleetText` fazem hoje.

L9 também descreve um estado `-estado` mais rico, com uma lista `sessions` e os campos da conversa mais importante. Esse estado foi reduzido depois: `544ef89` (2026-11-09) "feat: send only what the Firefox extension reads through ntfy" (enviar pelo ntfy só o que a extensão do Firefox lê) deixou os cinco campos acima. O código e o README concordam nos cinco.

#### Reconstrução a partir do histórico de commits

Os passos anteriores não foram registrados. A partir de `git log -- hooks/phone.ts hooks/seal.ts` e dos commits relacionados:

- `d91997f` (2026-10-31) "feat: send what needs you to your phone and watch through ntfy, with Narsil's picture" (enviar o que precisa de você ao seu celular e relógio pelo ntfy, com o desenho da Narsil). O tópico, os alertas, o ícone e o limite de 200 chegam juntos.
- `c27a9e4` (2026-10-31) "feat: send phone alerts only while you write through Remote Control" (enviar alertas ao celular só enquanto você escreve pelo Remote Control). A regra de onde você escreveu por último.
- `4f8abaa` (2026-11-01) "feat: send the state the band shows to a status topic for your own phone app" (enviar o estado que a faixa mostra a um tópico de estado para o seu próprio aplicativo de celular). O tópico `-estado`.
- `5a9ee10` (2026-11-01) "feat: seal phone messages with /narsil movil clave, send reset times and an Abrir Claude button" (selar as mensagens do celular com /narsil movil clave, enviar os horários de reinício e um botão Abrir Claude). Nasce `hooks/seal.ts`.
- `644e59f` (2026-11-01) "fix: send the state to the phone with each question, so the app shows Narsil waiting" (enviar o estado ao celular a cada pergunta, para que o aplicativo mostre a Narsil esperando).
- `7498be5` (2026-11-02) "feat: register the phone app's push subscription again before each alert, so alerts keep coming after ntfy.sh drops it" (registrar de novo a assinatura push do aplicativo de celular antes de cada alerta, para que os alertas continuem chegando depois que o ntfy.sh a descartar).
- `3a1f31c` (2026-11-06) "feat: alert the phone for every conversation and list them all" (alertar o celular para todas as conversas e listar todas). O pedido citado acima.
- `544ef89` (2026-11-09) "feat: send only what the Firefox extension reads through ntfy" (enviar pelo ntfy só o que a extensão do Firefox lê). A sua mensagem: "The phone web app is gone" (o aplicativo web de celular deixou de existir), e a renovação do Web Push foi junto.
- `5fe48c9` (2026-11-10) "feat: register the phone app's push subscription again before each alert" (registrar de novo a assinatura push do aplicativo de celular antes de cada alerta). A sua mensagem: "The phone web app is back as the alert receiver, in Chrome" (o aplicativo web de celular está de volta como receptor dos alertas, no Chrome), e a renovação voltou, agora com o recurso de reserva de 12 horas.

O histórico mostra uma funcionalidade moldada pelos seus receptores: a cada vez que o aplicativo do outro lado mudou, o lado do mod mudou com ele.

## Código de referência

Esta é uma resposta correta, escrita para este guia. Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

Escrito para este guia e conferido com os tipos da 2.1.325 (`$.store.get`, `$.store.set`, `$.http.fetch`, `$.clock.now`, `$.command.register`, `command.run`, `prompt.submit`, `turn.complete`, `crypto.randomUUID`). Foi adaptado de `hooks/phone.ts` e `hooks/register.tsx` do [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). Ele envia texto simples; para a selagem, leia `hooks/seal.ts`.

```tsx
import type { EngineInterface, Register } from 'claude-code'

const NTFY = 'https://ntfy.sh'
const DAILY = 200

async function isAway($: EngineInterface): Promise<boolean> {
  return (await $.store.get('away').catch(() => false)) === true
}

async function noteOrigin($: EngineInterface, kind: string): Promise<void> {
  if (kind === 'bridge' || kind === 'composer')
    await $.store.set('away', kind === 'bridge').catch(() => undefined)
}

async function sendToPhone($: EngineInterface, title: string, message: string): Promise<void> {
  const topic = await $.store.get('topic').catch(() => undefined)
  if (typeof topic !== 'string' || !(await isAway($))) return
  const day = new Date(await $.clock.now()).toISOString().slice(0, 10)
  const saved = (await $.store.get('sent').catch(() => undefined)) as
    { day?: string; sent?: number } | undefined
  const sent = saved?.day === day && typeof saved.sent === 'number' ? saved.sent : 0
  if (sent >= DAILY) return
  try {
    const { ok } = await $.http.fetch(NTFY, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic, title, message, priority: 3 }),
    })
    if (ok) await $.store.set('sent', { day, sent: sent + 1 })
  } catch {
    // offline: the alert is lost, and nothing else breaks
  }
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'my-pet', description: 'My pet: phone' })
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await noteOrigin($, e.origin.kind)
    return next(e)
  })

  on('command.run', { command: 'my-pet' }, async ($, e) => {
    await noteOrigin($, e.origin.kind)
    if (e.args.trim() !== 'phone') return { text: 'Usage: /my-pet phone' }
    let topic = await $.store.get('topic').catch(() => undefined)
    if (typeof topic !== 'string') {
      topic = `my-pet-${crypto
        .randomUUID()
        .replace(/[^0-9a-f]/gi, '')
        .toLowerCase()
        .slice(0, 20)}`
      await $.store.set('topic', topic)
    }
    return {
      text: `Subscribe to ${topic} on ntfy.sh in the ntfy app. Anyone who knows this name can read it: do not share it.`,
    }
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined && e.reason === 'answer')
      await sendToPhone($, 'My pet · Done', e.answer.slice(0, 300))
    return result
  })
}
```

A resposta do comando mostra o tópico uma vez, de propósito, para que a pessoa possa assiná-lo; lembre que essa resposta fica na conversa. A Narsil faz o mesmo.

## Erros comuns e como testar

- **Um tópico adivinhável.** Um tópico com o seu nome ou o do seu projeto pode ser lido por qualquer pessoa que o tente. Use um nome aleatório.
- **Registrar o tópico ou a chave em logs.** Ambos são segredos. Mantenha-os fora de `$.ui.log`, de capturas de tela, de issues e dos fixtures de teste que você publica.
- **Alertar na mesa.** Sem a regra da origem, o celular vibra enquanto você está sentado diante da tela. O Remote Control não é um evento; a origem da última mensagem é o sinal.
- **Guardar a origem só numa variável de módulo.** Cada conversa decidiria então sozinha, e uma conversa iniciada na mesa nunca alertaria enquanto você escreve do celular em outra.
- **Nenhum teto diário.** Um ciclo de turnos que falham pode esgotar um plano gratuito em minutos. Conte antes de enviar, por dia, entre as conversas.
- **Achar que "cifrado" quer dizer "invisível".** A selagem da Narsil esconde o título e o texto, não o fato, a hora, o tipo e o ícone de um alerta.
- **Criptografia feita à mão sem testes.** Selar, abrir, chave errada e um byte invertido são o mínimo, como faz o teste da Narsil.

Para testar, `tests/narsil.test.tsx` responde ele mesmo a `http.fetch`, então nada chega ao ntfy.sh. Vale a pena ler: "the phone gets nothing until /narsil movil is turned on" (o celular não recebe nada até /narsil movil ser ligado), "/narsil movil makes a private topic, says how to follow it, and sends what needs you there" (/narsil movil cria um tópico privado, diz como acompanhá-lo e envia para lá o que precisa de você), "the phone gets alerts only while you write through Remote Control, never at the desk" (o celular recebe alertas só enquanto você escreve pelo Remote Control, nunca na mesa), "while you write from the phone in another conversation this one alerts too, and a message at the desk anywhere stops it" (enquanto você escreve do celular em outra conversa, esta também alerta, e uma mensagem na mesa em qualquer lugar a interrompe), "the phone gets at most 200 a day, says which is the last, and starts again the next day" (o celular recebe no máximo 200 por dia, diz qual é a última e recomeça no dia seguinte), "/narsil movil clave seals what goes to ntfy.sh; clave off sends it in the clear again" (/narsil movil clave sela o que vai ao ntfy.sh; clave off volta a enviá-lo às claras), "as a turn ends from the phone, the extension gets only what it reads on the status topic, silently" (quando um turno termina a partir do celular, a extensão recebe só o que lê no tópico de estado, em silêncio) e "the state the extension reads does not register the subscription; only alerts do" (o estado que a extensão lê não registra a assinatura; só os alertas registram).

### Onde o código e o README diferem

- O README diz que a chave fica só com "tu PC y la extensión" ("o seu PC e a extensão"). O comentário em `hooks/seal.ts` diz "the PC, the Firefox extension and the phone app" (o PC, a extensão do Firefox e o aplicativo de celular), e a seção de Web Push do README sela a assinatura do aplicativo com a chave. O código faz o que o comentário diz.
- O README diz que o estado `-estado` é enviado "Al terminar cada turno" ("ao terminar cada turno"). O código também o envia a cada pergunta, e com o teste.

## Para ir além

- `fleetText` em `hooks/phone.ts` monta a lista de conversas abaixo de cada alerta.
- `ntfyRow` transforma a resposta da conta do ntfy.sh no mesmo tipo de linha de uso que a faixa desenha para os limites da conta (guia 7).
- `summary` em `hooks/words.ts` corta a resposta do Claude para o alerta, com mais espaço para o celular (`PHONE_ROOM`).
- O próximo guia, o resumo da sessão, é outra coisa que a Narsil conta e guarda em `$.store`.
