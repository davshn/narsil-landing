---
title: O bloco no menu lateral
description: 'O bloco abaixo da pesquisa no menu lateral do Claude: o nível da Narsil e a contagem do ntfy vindos do estado do mod, os limites de 5 horas e semanal do claude.ai a cada minuto, e o aviso do cadeado.'
route: android
order: 4
updated: 2026-11-24
sources:
  - repo: android
    path: app/src/main/assets/page/content.js
  - repo: android
    path: app/src/main/assets/page/lib/state.js
  - repo: android
    path: app/src/main/assets/page/lib/live.js
  - repo: android
    path: app/src/main/assets/host.js
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/StateModel.kt
  - repo: pet
    path: hooks/phone.ts
  - repo: pet
    path: hooks/register.tsx
---

## O que faz

Abra o menu lateral do Claude no app e, logo abaixo da pesquisa, a Narsil acrescenta um bloco com três tipos de dados:

| O quê                                                                          | De onde vem                          |
| ------------------------------------------------------------------------------ | ------------------------------------ |
| **A Narsil**, o desenho dela, o nível dela e a experiência dela, com uma barra | O mod Narsil, pelo ntfy.sh           |
| **`5 horas`** e **`Semana`** (5 horas e semana): os seus dois limites de uso   | O próprio `claude.ai`, a cada minuto |
| **`ntfy hoy`** (ntfy hoje): as mensagens do ntfy.sh do dia e o seu reinício    | O mod Narsil, pelo ntfy.sh           |

Cada limite mostra um percentual, uma barra em verde, âmbar ou vermelho, e quando ele reinicia, como `reinicia en 2 h 05 min` (reinicia em 2 h 05 min). O nível aparece como `Narsil ⭐ Nivel 28` com `30/2800 XP` ao lado.

O bloco também fala quando falta alguma coisa. Sem tópico nas configurações, ele diz `Toca y escribe tu topic` (toque e escreva o seu tópico). Quando o estado do mod está criptografado e o app não consegue abri-lo, ele diz `🔒 Toca y pon la clave` (toque e informe a chave). Um toque em qualquer um dos avisos, ou na própria Narsil, abre as configurações do app.

> **Experimental.** O bloco encontra o seu lugar pela estrutura do menu lateral do Claude e lê os seus limites de um endereço interno da página do `claude.ai`, não de uma API pública. Uma atualização do Claude pode quebrar qualquer um dos dois; quando isso acontece, o bloco deixa de aparecer ou perde os seus limites, e o Claude continua funcionando. Ele só lê.

O ntfy.sh é usado só para o que a página não consegue saber. O nível e a contagem mudam quando o mod envia um estado, o que acontece quando você escreve para o Claude Code pelo Remote Control. Quando a contagem tem mais de uma hora, o bloco avisa.

## Como funciona por dentro

O bloco é desenhado por `assets/page/content.js`, como a faixa do [guia 3](/pt/android/conversation-band/), e os dois compartilham o observador da página de `lib/watch.js`. Os limites são lidos pelo próprio `content.js`, a partir da página, com regras em `lib/live.js`. O nível e a contagem chegam do código Kotlin do app pelo canal do [guia 2](/pt/android/webview-host/), e `lib/state.js` lhes dá forma.

### Encontrar a pesquisa em qualquer idioma

O bloco não é encontrado pela palavra "Pesquisar", que muda com o idioma da página. Ele é encontrado pelo lugar onde a pesquisa fica. De `content.js` no narsil-android (MIT):

<!-- prettier-ignore -->
```js
  // Under the search, found by where it sits and so in any language: on a phone
  // the sidebar is a sheet with the search in its header; on a wider screen
  // it is the only direct button of the list's first block. The page mounts
  // the sidebar late and again at times: she goes back under it.
  const PHONE_SEARCH = '.df-phone-sheet-header'
  const WIDE_SEARCH = '.dframe-nav-scroll > .shrink-0 > button'
  function place() {
    const search = document.querySelector(PHONE_SEARCH) || document.querySelector(WIDE_SEARCH)
    if (search && search.nextElementSibling !== band) search.after(band)
    drawEvent()
  }

  self.narsilWatch(place)
```

`place` roda a cada mudança que o observador da página vê, no máximo uma vez por quadro. Se o bloco não estiver logo depois da pesquisa, ele vai para lá. Os dois seletores são nomes de classe da marcação atual do `claude.ai`, e são as linhas mais frágeis deste guia: basta um redesenho do menu lateral para perder o bloco.

### Os limites, do `claude.ai` a cada minuto

Os limites de 5 horas e semanal são da sua conta, e o `claude.ai` já os conhece. O bloco os lê do mesmo jeito que a faixa lê uma conversa, com a sessão da página e uma requisição `GET`. De `lib/live.js` (MIT):

<!-- prettier-ignore -->
```js
  // The account the page has open is in its cookie.
  function usageUrl(cookie) {
    const org = /(?:^|; )lastActiveOrg=([0-9a-f-]{36})(?:;|$)/.exec(cookie || '')?.[1]
    return org ? `${ORIGIN}/api/organizations/${org}/usage` : null
  }

  function limitOf(label, window, now) {
    if (typeof window?.utilization !== 'number') return null
    const note = window.resets_at ? self.narsilState.resetLabel(Date.parse(window.resets_at) / 1000, now) : ''
    return { label, percent: Math.round(window.utilization), color: self.narsilState.levelColor(window.utilization), note }
  }

  const limitsOf = (usage, now) => [limitOf('5 horas', usage?.five_hour, now), limitOf('Semana', usage?.seven_day, now)].filter(Boolean)
```

1. **Qual conta.** O id da organização que a página tem aberta está no cookie `lastActiveOrg`, um UUID de 36 caracteres. O script o lê de `document.cookie` e não o guarda em lugar nenhum.
2. **O uso.** Ele pede `claude.ai/api/organizations/<id>/usage`, um endereço interno da página.
3. **Duas janelas.** Da resposta ele pega `five_hour` e `seven_day`: `utilization`, já em percentual, e `resets_at`, uma data. Uma janela sem `utilization` numérico fica de fora.

O reinício é redigido por `resetLabel` em `lib/state.js`: `reinicia en 45 min`, `reinicia en 2 h 05 min` ou `reinicia en 3 d 4 h`, e `ya se reinició` (já reiniciou) depois que a hora passou. As cores são os limiares compartilhados de `levelColor`: verde abaixo de 60 %, âmbar a partir de 60 %, vermelho a partir de 85 %.

`pollUsage` pergunta uma vez quando a página carrega, depois a cada 60 segundos, e nunca enquanto a página está oculta. Quando a página volta a ficar visível, ele pergunta na hora. Se a requisição falhar, os últimos limites ficam.

### O nível e a contagem, do mod pelo ntfy.sh

O seu nível e a contagem do ntfy.sh vivem no seu computador, no mod. O mod os envia no seu tópico de estado silencioso, o seu tópico com `-estado` (estado) no final. O app o acompanha em Kotlin enquanto a página mostra a faixa, guarda o estado mais novo e o envia à página (o [guia 3](/pt/android/conversation-band/) percorre o `StateFeed` e o `StateModel`). A página nunca vê o tópico.

O estado leva mais campos do que o bloco usa. `sendStatus` em `hooks/register.tsx` do narsil-pet o monta com `xp`, `art`, `at`, `cacheMinutes`, `limits`, `sessions` e `usage`. O bloco lê três deles, e o `at`:

- **`xp`**, um rótulo como `⭐ Nivel 28 · 30/2800 XP`, escrito pelo `xpLabel` do mod. `levelOf` em `lib/state.js` o divide no nome, nos pontos dentro do nível e nos pontos que ele precisa, para a barra.
- **`art`**, o endereço do desenho da Narsil no estágio dela. Ele só é aceito quando começa pela pasta de assets do narsil-pet no GitHub. No modo claro, o bloco troca `-oscuro.png` por `-claro.png`, já que o mod envia a variante escura.
- **`usage`**, uma linha com a chave `ntfy`, montada pelo `ntfyRow` do mod em `hooks/phone.ts`: `{ key: 'ntfy', label: 'ntfy hoy', percent, color, note, resetsAt }`, onde `note` aparece como `24/250 mensajes` (24/250 mensagens).
- **`at`**, quando o mod o enviou, em segundos. Ele decide qual estado é o mais novo e qual a idade da contagem.

`limits` e `sessions` são para o [Narsil Watch](/pt/watch/what-it-is/), que não tem página do `claude.ai` a quem perguntar; o app pega os seus limites da página. Os dois analisadores, de `lib/state.js` (MIT):

<!-- prettier-ignore -->
```js
  // "⭐ Nivel 4 · 350/400 XP": the name, and how far into the level.
  function levelOf(xp) {
    const m = /^(.*?)\s*·\s*(\d+)\/(\d+)\s*XP/.exec(xp || '')
    if (!m) return null
    const [into, needed] = [Number(m[2]), Number(m[3])]
    return { name: `Narsil ${m[1]}`, into, needed, percent: Math.round((into / needed) * 100) }
  }

  function ntfyOf(s, now) {
    const row = Array.isArray(s.usage) ? s.usage.find((r) => r.key === 'ntfy') : null
    if (!row) return null
    const isStale = Boolean(s.at) && now - s.at > STALE_SECONDS
    const note = [row.note, row.resetsAt ? resetLabel(row.resetsAt, now) : '', isStale ? `dato de ${ago(s.at, now)}` : ''].filter(Boolean).join(' · ')
    return { label: row.label, percent: Math.round(row.percent), color: row.color, note }
  }
```

Um rótulo de nível que não corresponde ao padrão dá `null`, e o topo do bloco, com desenho e tudo, fica oculto. É também o que você vê antes de o mod ter enviado algum estado.

### Por que a contagem tem de vir do computador

O ntfy.sh conta as mensagens por endereço IP. O mod pergunta a `https://ntfy.sh/v1/account`, a partir da rede do seu computador, quantas mensagens essa rede enviou hoje, e põe a resposta no seu estado, contando a mensagem prestes a sair. Se o celular perguntasse, o ntfy.sh responderia sobre a rede do celular, que não envia nada. Como explica o comentário do narsil-pet, esse dia também começa "at an hour hashed from the IP, not at midnight" (numa hora derivada de um hash do IP, não à meia-noite), e é por isso que a linha mostra a sua própria hora de reinício.

### "Mais de uma hora"

O mod só envia um estado enquanto você escreve de longe, e se limita a 200 mensagens por dia. Quando você volta para a mesa, o último estado fica, e envelhece. Então, quando um estado tem mais de uma hora (`STALE_SECONDS = 3600`), a linha `ntfy hoy` acrescenta uma nota como `dato de hace 3 h` (dado de 3 h atrás). O nível não recebe essa nota: ele muda devagar, e um nível de uma hora atrás ainda é o seu nível.

### Como o bloco é desenhado

`renderBand` em `content.js` monta o bloco a partir da última mensagem que o app enviou e dos últimos limites. De `content.js` (MIT):

<!-- prettier-ignore -->
```js
  function renderBand() {
    const now = Date.now() / 1000
    const view = latest?.type === 'model' ? N.viewOf(latest.model, now) : null
    const notes = { sealed: '🔒 Toca y pon la clave' }
    const message = latest?.type === 'no-topic' ? 'Toca y escribe tu topic' : notes[view?.kind]
    notice.hidden = !message
    setText(notice, message || '')
    const level = view?.level
    head.hidden = !level
    if (level) {
      setPet(L.themedArt(view.art, document.documentElement.dataset.mode === 'light'))
      setText(levelName, level.name)
      setText(levelXp, `${level.into}/${level.needed} XP`)
      levelFill.style.width = `${Math.min(100, level.percent)}%`
    }
    meters.replaceChildren(...[...L.limitsOf(limits, now), ...(view?.ntfy ? [view.ntfy] : [])].map(meter))
  }
```

Os medidores são reconstruídos a cada vez com `replaceChildren`, a partir de elementos criados com `createElement` e preenchidos com `textContent`. O topo é atualizado no lugar com `setText`, que só escreve quando o texto mudou. Ele roda quando chega uma mensagem do app, quando chegam novos limites e a cada 15 segundos enquanto a página está visível, para que as horas de reinício continuem andando.

### Os avisos e os toques

`viewOf` em `lib/state.js` decide o aviso a partir do modelo que o app enviou:

| O modelo                                  | `viewOf` dá  | O bloco mostra                                  |
| ----------------------------------------- | ------------ | ----------------------------------------------- |
| `{ type: 'no-topic' }` vindo do app       | (sem modelo) | `Toca y escribe tu topic`                       |
| Sem estado, e a última mensagem não abriu | `sealed`     | `🔒 Toca y pon la clave`                        |
| Sem estado, nada selado                   | `empty`      | Só os limites                                   |
| Um estado                                 | `state`      | A Narsil, o nível dela, os limites e `ntfy hoy` |

Leia a segunda e a quarta linhas juntas, porque elas escondem um detalhe: o aviso do cadeado só aparece quando o modelo **não tem estado nenhum**. `StateModel.receive` marca o modelo como `isSealed` quando uma mensagem não abre, mas mantém o estado que tinha; e `viewOf` mostra um estado sempre que há um. Então, se a Narsil já estava aparecendo e chega uma mensagem nova selada com uma chave que o app não tem, o bloco continua mostrando o nível antigo, sem cadeado. Você vê o cadeado numa instalação nova, ou depois de mudar o tópico.

Dois toques abrem as configurações, por dois caminhos:

- **O aviso** é um `<button>`. O seu handler de clique envia `{ type: 'settings' }` pela porta da faixa; `host.js` o embrulha como `{ kind: 'port', message }`, e a `MainActivity` abre a `SettingsActivity` quando o tipo de dentro é `settings`.
- **O desenho ou o nível da Narsil.** `host.js` escuta cliques no documento inteiro, na fase de captura, e envia `{ kind: 'settings' }` quando o alvo está dentro de `#narsil-band .narsil-head`. O commit `9e514dd` explica por que os dois existem: "The launcher shortcut is not shown by every launcher, and the band's notice only shows without a topic." (Nem todo launcher mostra o atalho, e o aviso da faixa só aparece sem tópico.)

### O que quem lê o seu tópico poderia fazer

Sem chave, qualquer pessoa que conheça o seu tópico também pode publicar em `<topic>-estado`. Por isso nada dele é tratado como marcação: cada valor entra com `textContent`, e um desenho só é mostrado quando o seu endereço começa pela própria pasta de assets do narsil-pet. O comentário do código em `lib/state.js` diz isso: "its text only ever goes in as text, and an image only comes from Narsil's own assets." (o seu texto só entra como texto, e uma imagem só vem dos próprios assets da Narsil.) Um estado forjado poderia mostrar um nível ou uma contagem errados. Ele não consegue acrescentar um link, um script ou um desenho de outro lugar. Ele também poderia levar um `at` muito no futuro: todo estado real perderia para ele então e, como o app salva o modelo por tópico, o ntfy.sh esquecer a mensagem depois de 12 horas não ajudaria. Mudar o tópico começa de um modelo vazio, e apagar os dados do app também. O [guia 7](/pt/android/encryption-and-settings/) explica como a chave estreita isso, e até onde.

## Construa com o Claude

Peça ao Claude um bloco depois do botão de pesquisa do menu lateral, alimentado por dois lados: a própria requisição de uso da página e o estado que o app envia. A única ideia que ele precisa acertar é que a página nunca guarda o tópico, e que nada do ntfy.sh é confiável.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No script de página que a minha WebView Android roda em `https://claude.ai`, acrescente um bloco logo depois do botão de pesquisa do menu lateral, encontrado pela sua posição (`.df-phone-sheet-header`, senão `.dframe-nav-scroll > .shrink-0 > button`), não pelo seu texto, e recoloque-o sempre que o observador da página o vir fora do lugar. A cada 60 segundos enquanto a página estiver visível, leia o id da organização do cookie `lastActiveOrg` e faça `GET /api/organizations/<id>/usage` com `credentials: 'include'`; mostre `five_hour` e `seven_day` como `5 horas` e `Semana`, com o percentual, uma barra colorida (verde, âmbar a partir de 60, vermelho a partir de 85) e a hora do reinício. A partir da mensagem que o app envia, mostre o rótulo `xp` dividido em nível e pontos, um desenho só de `https://raw.githubusercontent.com/davshn/narsil-pet/main/assets/`, e a linha de `usage` com a chave `ntfy`, com "dato de hace N h" quando `at` tiver mais de uma hora. Mostre um aviso tocável quando o app disser que não há tópico. Use só `textContent`. Mantenha a análise num módulo sem DOM e teste-a.

### O que conferir na resposta do Claude

1. A pesquisa é encontrada pela sua posição, não pelo seu texto.
2. O id da organização é lido do cookie a cada vez e não é guardado em lugar nenhum.
3. Os limites são pedidos a cada 60 segundos, nunca enquanto `document.hidden` é verdadeiro, e na hora quando a página volta a aparecer.
4. O rótulo de nível é analisado com um padrão, e um rótulo que não corresponde esconde o topo em vez de mostrar lixo.
5. Um endereço de desenho precisa começar pelo único prefixo fixo.
6. Tudo entra com `textContent` ou como elementos criados, nunca como HTML.
7. O tópico nunca aparece no script de página.

Se uma verificação falhar, diga ao Claude o que você vê: "com o Claude em espanhol, o bloco não aparece".

### Como a pessoa autora pediu

As palavras da pessoa autora registradas para este app pedem o visual e a faixa da extensão numa web view (L1: "que dentro en un web view muestre la web de claude y modifique sus estilos como lo hace esta extension", que dentro de uma web view mostre a web do Claude e mude os seus estilos como esta extensão faz), então o bloco veio junto sem mudanças. Um pedido posterior está registrado só pelo seu commit:

- `9e514dd` (2026-11-24) "feat: open the settings from Narsil in the band and from the service's notification" (abrir as configurações a partir da Narsil na faixa e da notificação do serviço). A sua mensagem está citada acima.

O registro de tarefas registra a verificação no celular real, com o tópico e a chave reais, em 2026-11-24 às 00:44: "the band showed Narsil Nivel 28, 30/2800 XP, ntfy's count and her etapa4 art. Settings open from Narsil in the band and from the service's notification." (o bloco mostrou Narsil Nivel 28, 30/2800 XP, a contagem do ntfy e o desenho dela da etapa4. As configurações abrem a partir da Narsil no bloco e da notificação do serviço.)

O resto é reconstruído a partir do histórico de commits (um nome de projeto num assunto é substituído por uma descrição entre colchetes):

- `3bcea35` (2026-11-24) "feat: build the script that hosts [the earlier extension] in a WebView, and what alerts and states keep" (montar o script que hospeda a [extensão anterior] numa WebView, e o que os alertas e os estados guardam).
- `53c55c1` (2026-11-24) "feat: host claude.ai with [the earlier extension] in a WebView, and show Narsil's alerts from a foreground service" (hospedar o claude.ai com a [extensão anterior] numa WebView, e mostrar os alertas da Narsil a partir de um serviço em primeiro plano).
- `ca01cc7` (2026-11-24) "docs: log the band verified with a signed-in session" (registrar a faixa conferida com uma sessão iniciada).
- `a275382` (2026-11-24) "docs: log the alerts and the band verified with the real topic and key" (registrar os alertas e a faixa conferidos com o tópico e a chave reais).

Do lado do mod, o `6400a6f` (2026-11-23) do narsil-pet, "feat(phone): publish Claude limits and open conversations for the watch" (publicar os limites do Claude e as conversas abertas para o relógio), acrescentou os campos `limits` e `sessions` que o bloco deixa para o relógio.

## Código de referência

Esta é uma resposta correta, escrita para este guia (MIT). Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

Os limites como um módulo puro, com a forma de `lib/live.js`, com um teste. Salve-o como `limits.js`.

```js
const colorOf = (percent) => (percent >= 85 ? '#F0435A' : percent >= 60 ? '#F5B400' : '#22B573')

export function usageUrl(cookie) {
  const org = /(?:^|; )lastActiveOrg=([0-9a-f-]{36})(?:;|$)/.exec(cookie || '')?.[1]
  return org ? `https://claude.ai/api/organizations/${org}/usage` : null
}

export function resetNote(resetsAt, now) {
  const left = Math.max(0, Math.round((resetsAt - now) / 60))
  if (left === 0) return 'ya se reinició'
  if (left < 60) return `reinicia en ${left} min`
  return `reinicia en ${Math.floor(left / 60)} h ${String(left % 60).padStart(2, '0')} min`
}

export function limitsOf(usage, now) {
  const rows = [
    ['5 horas', usage?.five_hour],
    ['Semana', usage?.seven_day],
  ]
  return rows
    .filter(([, window]) => typeof window?.utilization === 'number')
    .map(([label, window]) => ({
      label,
      percent: Math.round(window.utilization),
      color: colorOf(window.utilization),
      note: window.resets_at ? resetNote(Date.parse(window.resets_at) / 1000, now) : '',
    }))
}
```

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { limitsOf, usageUrl } from './limits.js'

test('the organization comes from the cookie, or there is no request', () => {
  const org = '00000000-0000-4000-8000-000000000000'
  assert.equal(
    usageUrl(`theme=dark; lastActiveOrg=${org}`),
    `https://claude.ai/api/organizations/${org}/usage`,
  )
  assert.equal(usageUrl('theme=dark'), null)
})

test('a window without a number is left out', () => {
  const now = Date.parse('2026-11-24T10:00:00Z') / 1000
  const usage = {
    five_hour: { utilization: 72.4, resets_at: '2026-11-24T12:05:00Z' },
    seven_day: null,
  }
  assert.deepEqual(limitsOf(usage, now), [
    { label: '5 horas', percent: 72, color: '#F5B400', note: 'reinicia en 2 h 05 min' },
  ])
})
```

O `minutesLabel` real também redige dias (`3 d 4 h`), de que o limite semanal precisa; este para nas horas para ficar curto.

## Erros comuns e como testar

- **Encontrar a pesquisa pelo seu texto.** O rótulo muda com o idioma da página. Encontre-a pela sua posição.
- **Posicionar o bloco uma vez só.** A página monta o menu lateral tarde, e de novo às vezes. Recoloque o bloco a cada execução do observador.
- **Pedir os limites enquanto está oculta.** Um celular no bolso perguntaria a cada minuto à toa.
- **Guardar o id da organização.** Ele está no cookie quando você precisa dele; não há motivo para guardá-lo.
- **Pedir a contagem ao ntfy.sh a partir do celular.** A resposta é sobre a rede do celular. A contagem tem de vir do computador.
- **Uma contagem que nunca se mexe.** O mod só envia o seu estado enquanto você escreve pelo Remote Control. Na mesa, o bloco mantém o último e marca a idade dele.
- **Esperar o cadeado depois de trocar a chave.** Se um estado já estava aparecendo, uma mensagem que a chave não consegue abrir o deixa lá. Tire a dúvida enviando `/narsil movil prueba` depois de definir a chave: um estado novo que abre substitui o antigo.

Para testar a análise no computador, rode o módulo acima com `node --test`, e leia `levelOf`, `ntfyOf` e `viewOf` em `lib/state.js` com um estado inventado. No celular, coloque um tópico inventado, como `narsil-0000000000example0`, nas configurações e depois publique um estado no seu tópico `-estado` a partir do computador ([ntfy: publishing](https://docs.ntfy.sh/publish/)):

```bash
curl -d '{"xp":"⭐ Nivel 2 · 40/200 XP","at":1700000000,"usage":[{"key":"ntfy","label":"ntfy hoy","percent":10,"color":"#22B573","note":"25/250 mensajes"}]}' https://ntfy.sh/narsil-0000000000example0-estado
```

Abra o menu lateral: em um segundo, ele deve mostrar `Narsil ⭐ Nivel 2` com `40/200 XP`, e uma linha `ntfy hoy` em 10 % com `25/250 mensajes` e uma nota `dato de hace …`, já que esse `at` ficou muito para trás. Os limites também devem estar lá, vindos do `claude.ai`. Toque na Narsil: as configurações devem abrir. Coloque o seu tópico real de volta quando terminar.

### Onde o código e o README diferem

- O README diz que, se a chave não for a que selou as mensagens, a faixa diz "🔒 Toca y pon la clave". O código só o mostra quando o app ainda não tem estado para o tópico; com um estado anterior guardado, o bloco continua mostrando-o, como explicado acima.
- O README coloca o toque das configurações em "The band in Claude's side menu" (a faixa no menu lateral do Claude). No código, esse elemento é de fato `#narsil-band`; a faixa acima da caixa de mensagem é `#narsil-event`, e um toque ali só expande o seu texto.

## Para ir além

- O [guia 5](/pt/android/colors-and-mode/) veste a página inteira com as cores da Narsil, e o bloco junto.
- O [guia 7](/pt/android/encryption-and-settings/) explica o cadeado, a chave e as configurações que o bloco abre.
- Do lado do mod, [Alertas no celular e no relógio](/pt/mods/pet/phone-and-watch/) descreve os campos do `-estado`, o limite diário de 200 e o `ntfyRow`.
- O [Narsil Watch](/pt/watch/what-it-is/) lê o mesmo estado, inclusive os campos `limits` e `sessions` que o bloco deixa de lado.
- O código-fonte está em [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
