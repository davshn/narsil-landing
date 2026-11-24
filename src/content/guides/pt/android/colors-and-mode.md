---
title: As cores da Narsil, de dia e de noite
description: 'Como o skin.css veste o claude.ai com a paleta de mar noturno da Narsil Skin, como o mode.js escolhe claro ou escuro pela hora, diga o Claude o que disser, e como as barras acompanham sem clarão.'
route: android
order: 5
updated: 2026-11-24
sources:
  - repo: android
    path: app/src/main/assets/page/skin.css
  - repo: android
    path: app/src/main/assets/page/mode.js
  - repo: android
    path: app/src/main/assets/page/lib/mode.js
  - repo: android
    path: app/src/main/assets/page/lib/watch.js
  - repo: android
    path: app/src/main/assets/host.js
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/MainActivity.kt
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/PageScript.kt
---

## O que faz

Dentro do app, o Claude veste as cores da Narsil: a paleta de mar noturno da [Narsil Skin](https://github.com/davshn/narsil-skin), os temas de cores da pessoa autora para o app de desktop do Claude. Fundos, textos, bordas, blocos de código e o brilho enquanto o Claude trabalha, tudo muda:

- **De noite**, das 18:00 às 5:59, um fundo azul-marinho profundo (`#0f1a2c`), texto azul-claro e um destaque azul vivo.
- **De dia**, das 6:00 às 17:59, um fundo azul-mar claro (`#c9e7f1`), texto azul-escuro e um destaque verde-azulado.
- **A faísca laranja** que o Claude mostra enquanto trabalha fica roxa.
- **Todo o texto fica em negrito**, como o tema manda.

Quem decide é a hora, no relógio do próprio celular, seja qual for a aparência que você escolheu no Claude: o app não lê a sua configuração e não a muda. A barra de status e a barra de navegação acompanham, com o mesmo fundo atrás delas e ícones escuros ou claros para combinar. E as cores entram logo no início de cada página, então as do próprio Claude nunca piscam antes.

> **Experimental.** A skin substitui as próprias variáveis de design do `claude.ai` e estiliza algumas das suas partes por nomes de classe e atributos da marcação atual da página. Nada disso é uma API pública. Uma atualização do Claude pode renomeá-los; quando isso acontece, algumas partes da página voltam às cores do Claude ou, raramente, uma parte fica difícil de ler até a skin ser atualizada. O próprio Claude continua funcionando.

## Como funciona por dentro

Três arquivos fazem o trabalho, e uma configuração em Kotlin o completa:

| Arquivo                    | Função                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| `assets/page/skin.css`     | A paleta, como valores para as variáveis de design do Claude, e algumas regras próprias. |
| `assets/page/lib/mode.js`  | Que modo cada hora veste: uma regra, compartilhada pelos scripts de página.              |
| `assets/page/mode.js`      | Define o modo claro ou escuro da página pela hora, e o mantém definido.                  |
| `MainActivity.paintBars()` | Pinta o fundo atrás das barras do sistema e escolhe a cor dos seus ícones.               |

### Pintar com as próprias variáveis da página

Um app web moderno não escreve as cores em cada regra. Ele as define uma vez, como propriedades personalizadas de CSS, e cada componente as lê. O `claude.ai` faz isso com uma família de variáveis cujos nomes começam com `--cds-` (fundo da página, superfícies, texto, bordas, destaques), mais uma família mais antiga de valores `--bg-*`, `--text-*` e `--accent-*` escritos como trios HSL.

Isso torna a skin pequena. Em vez de reestilizar centenas de componentes, `skin.css` dá novos valores a essas variáveis, e a página se repinta sozinha. O início da metade escura, de `skin.css` no narsil-android (MIT):

<!-- prettier-ignore -->
```css
/* Each .cds-root the app mounts declares these again for itself, so setting
   them on html alone lasts only until it has mounted. */
html[data-mode="dark"],
html[data-mode="dark"] .cds-root:not([data-mode="light"]),
html[data-mode="dark"] #static-composer,
.cds-root[data-mode="dark"],
.cds-dark-scope {
  --cds-page-bg: #0f1a2c !important;
  --cds-surface-0: #0b1422 !important;
  --cds-surface-1: #0f1a2c !important;
  --cds-surface-2: #16243b !important;
  --cds-surface-3: #1a2a44 !important;
  --cds-surface-panel: #16243b !important;
  --cds-surface-popover: #22344f !important;
  --cds-text-primary: #dce6fa !important;
  --cds-text-secondary: color-mix(in srgb, #dce6fa 68%, transparent) !important;
```

Três detalhes nessas poucas linhas explicam o arquivo inteiro:

- **Os seletores se repetem.** Como diz o comentário, cada `.cds-root` que a página monta declara as variáveis de novo para si, e uma declaração mais próxima vence a que está em `html`. Então a skin as define em cada lugar em que a página as define: `html`, cada `.cds-root`, o composer estático e os escopos escuros.
- **`!important` em todo lugar.** Senão, as próprias declarações da página venceriam quando fossem tão específicas quanto as da skin. Uma declaração importante vence uma normal, seja qual for a ordem.
- **Tons a partir de uma só cor.** O texto secundário e o apagado são o texto principal misturado com transparência (`color-mix(in srgb, #dce6fa 68%, transparent)`), então todo tom fica no mesmo matiz.

Os principais valores da paleta, lado a lado:

| Variável              | Noite (`dark`)        | Dia (`light`)        |
| --------------------- | --------------------- | -------------------- |
| `--cds-page-bg`       | `#0f1a2c`             | `#c9e7f1`            |
| `--cds-surface-0`     | `#0b1422`             | `#b7deed`            |
| `--cds-surface-2`     | `#16243b`             | `#d6eef5`            |
| `--cds-text-primary`  | `#dce6fa`             | `#0f2f47`            |
| `--cds-text-accent`   | `#5aaeff`             | `#1f83a8`            |
| `--cds-border-strong` | 26 % de um azul-claro | 26 % da cor do texto |

### O que as variáveis não alcançam

Algumas partes da página não tiram as suas cores dessas variáveis, e `skin.css` as estiliza uma a uma:

- **O menu lateral**, pintado com `--cds-surface-0`.
- **Os blocos de código nos diffs**, que vivem numa shadow root, onde as regras de fora não chegam. As propriedades personalizadas passam para dentro, e uma regra no shadow host vence a do próprio componente, então a skin define `--diffs-light-bg`, `--diffs-dark-bg` e as suas cores de texto em `diffs-container`.
- **Os blocos de código do chat no modo claro.** Eles colorem os seus tokens inline com a paleta escura da página mesmo quando o modo claro é forçado, então tokens claros ficariam sobre um fundo claro. A skin os encontra pela cor base inline e os gira com `filter: invert(1) hue-rotate(180deg) saturate(1.3)`: inverter troca claro por escuro, e girar o matiz em meia volta devolve a cada token o seu matiz.
- **A seleção**, a borda da caixa de mensagem (mais forte quando ela tem o foco) e **a faísca**: `[data-cds="Spark"]` e `[data-cds="WorkingMark"]` recebem `filter: hue-rotate(262deg) saturate(1.3)`, que deixa roxo o laranja do Claude.
- **O texto em negrito**: `body, body *` recebem `font-weight: 700 !important`. O comentário explica por que é uma regra simples e não um `:not()` que poupe as próprias partes da Narsil: um `:not()` de descendentes "would walk every element's ancestors on each recalculation" (percorreria os ancestrais de cada elemento a cada recálculo). Em vez disso, `band.css` restaura os pesos da faixa com um `!important` próprio.

Os comentários também se preocupam com a velocidade. Duas variáveis que a página herda são definidas "Only where the page declares them" (só onde a página as declara), porque, em cada elemento, "they would make each one carry its own copy and slow every style recalculation" (fariam cada um carregar a sua própria cópia e deixariam todo recálculo de estilo mais lento). Num celular, enquanto o Claude transmite uma resposta e a página muda muitas vezes por segundo, isso importa.

No final, `skin.css` define `--narsil-css-skin: 1` em `:root`. Isso não muda nada visível: é uma marca que os scripts da faixa leem para saber que a folha de estilo chegou à página (o [guia 3](/pt/android/conversation-band/) explica o que eles fazem quando ela falta).

### Como os estilos chegam à página

`skin.css` e `band.css` são juntados por `PageScript.kt` num único texto JavaScript, `NARSIL_CSS`, e `host.js` o transforma numa folha de estilo construída:

<!-- prettier-ignore -->
```js
const sheet = new CSSStyleSheet()
sheet.replaceSync(NARSIL_CSS)

// The page sets adoptedStyleSheets of its own at times: the sheet goes back on each change the watch sees.
function adopt() {
  if (!document.adoptedStyleSheets.includes(sheet)) document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
}
adopt()
```

Esse trecho é de `host.js` no narsil-android (MIT). Uma folha construída não é um elemento na página, então as mudanças na marcação da página não conseguem removê-la, e o comentário do arquivo observa que a Content Security Policy da página não a governa, enquanto um `<style>` acrescentado por um script poderia ser recusado. A página pode substituir a sua própria lista de folhas adotadas, então `PageScript` registra `adopt` no observador da página: depois de qualquer mudança, a folha da Narsil volta.

### Claro de dia, escuro de noite

A regra da hora é uma linha, em `lib/mode.js` (MIT):

<!-- prettier-ignore -->
```js
// Which mode claude.ai wears at each hour, as narsil-skin's auto theme does.

self.narsilMode = (() => {
  const isDay = (hour) => hour >= 6 && hour < 18
  const modeOfHour = (hour) => (isDay(hour) ? 'light' : 'dark')
  return { modeOfHour }
})()
```

Ela espelha o tema automático da Narsil Skin no desktop, então o celular e o computador mudam ao mesmo tempo.

O `claude.ai` marca o seu modo com um atributo `data-mode`: `light`, `dark` ou `system`, no elemento `<html>` e em alguns dos seus componentes. Esse atributo é o que a sua configuração de aparência escreve, e o que os seletores da skin leem. Então `mode.js` não briga com os estilos da página; ele simplesmente escreve o atributo. O arquivo inteiro, de `mode.js` (MIT):

<!-- prettier-ignore -->
```js
// Light by day and dark by night, whatever claude.ai's own setting says: its
// data-mode attribute, on every element that carries one, as the page sets it
// again whenever it mounts one. Not every data-mode: data-mode=code means
// something else.

(() => {
  const MODES = '[data-mode=light],[data-mode=dark],[data-mode=system]'
  const CHECK_MS = 60_000
  function apply() {
    const mode = self.narsilMode.modeOfHour(new Date().getHours())
    for (const element of document.querySelectorAll(MODES)) if (element.dataset.mode !== mode) element.dataset.mode = mode
  }

  self.narsilWatch(apply)

  // The hour turns with no change on the page; a hidden page runs no frames.
  const timer = setInterval(apply, CHECK_MS)
  const onVisibility = () => apply()
  document.addEventListener('visibilitychange', onVisibility)
  self.narsilWatch.onStop(() => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisibility)
  })
  apply()
})()
```

Cada parte tem um motivo:

- **Só três valores.** `data-mode=code` existe na página e "means something else" (significa outra coisa), então o seletor nomeia `light`, `dark` e `system` e deixa o resto em paz.
- **Todo elemento que tenha um**, não só o `<html>`. A página monta componentes com o seu próprio `data-mode`, e o define de novo quando os monta.
- **A cada mudança da página**, por `self.narsilWatch(apply)`. O observador da página de `lib/watch.js` também observa atributos, com `attributeFilter: ['data-mode', 'href']`, então a página redefinindo `data-mode` já é uma mudança que o acorda.
- **A cada 60 segundos**, porque a hora vira sem que nada mude na página.
- **Em `visibilitychange`**, porque, como diz o comentário, "a hidden page runs no frames" (uma página oculta não roda quadros): os callbacks do observador esperam um quadro, e os timers ficam mais lentos numa página oculta. Quando a tela volta depois de uma noite no seu bolso, o modo certo está lá na hora, e não até um minuto depois.
- **Só quando é diferente.** Escrever o atributo é uma mudança que o observador vê, então `apply` só escreve quando o valor difere. Senão, cada escrita acordaria o observador, que escreveria de novo.

O app nunca toca na sua configuração do Claude. `mode.js` só reescreve o atributo na página que está na sua frente. No seu computador, ou no próprio app do Claude, a sua configuração está como você a deixou.

### Antes da primeira pintura

O README promete que "The colors go on from the very start of each page, so Claude's own never flash first." (As cores entram desde o início de cada página, então as do próprio Claude nunca piscam antes.) Três coisas tornam isso verdade:

1. **O script roda no início do documento.** `addDocumentStartJavaScript` o roda antes de qualquer script do próprio `claude.ai` ([guia 2](/pt/android/webview-host/)). A essa altura a folha de estilo já foi adotada, então as suas regras estão esperando a marcação da página.
2. **O modo vai no primeiro grupo.** `PageScript` roda `lib/watch.js`, `lib/mode.js` e `mode.js` na hora, e não depois que o documento foi analisado, que é quando rodam os scripts da faixa.
3. **O observador trabalha antes da pintura.** Ele roda os seus callbacks com `requestAnimationFrame`, e um navegador roda esses callbacks logo antes de pintar o quadro. Então, quando a página define `data-mode` com o seu próprio valor, `mode.js` já escreveu de volta o da Narsil antes de esse quadro chegar à tela.

O registro de tarefas registra a verificação num celular real, pelas DevTools: "both style marks and the night ground rgb(15, 26, 44)" (as duas marcas de estilo e o fundo noturno rgb(15, 26, 44)), que é `#0f1a2c`.

### As barras do sistema

A página fica entre as barras do sistema (o [guia 2](/pt/android/webview-host/) explica o preenchimento), então o que aparece atrás delas é o próprio quadro da activity. A `MainActivity` o pinta com o fundo da página e escolhe a cor dos ícones. De `MainActivity.kt` (MIT):

```kotlin
    // Behind the system bars, the page's own ground, light by day and dark by night as the band's mode.js sets it.
    private fun paintBars() {
        val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        val isDay = hour in 6..17
        frame.setBackgroundColor(Color.parseColor(if (isDay) "#c9e7f1" else "#0f1a2c"))
        WindowCompat.getInsetsController(window, frame).apply {
            isAppearanceLightStatusBars = isDay
            isAppearanceLightNavigationBars = isDay
        }
    }
```

`hour in 6..17` é a mesma regra de `lib/mode.js`, escrita em Kotlin: das 6:00 às 17:59. As duas cores são o `--cds-page-bg` de cada modo. `isAppearanceLightStatusBars = true` pede ícones escuros, de que um fundo claro precisa; de noite eles ficam claros.

A regra vive duas vezes, uma em JavaScript e outra em Kotlin, porque a página e a activity não conseguem compartilhar código com facilidade. Os valores precisam mudar juntos, o que vale um teste seu (veja o código de referência).

`paintBars` roda em `onResume`, cada vez que o app vem para a frente. Ele não roda num timer, como faz `mode.js`.

## Construa com o Claude

Peça ao Claude uma skin em duas partes: uma folha de estilo que dê novos valores às próprias variáveis de design da página sob `html[data-mode=…]`, e um pequeno script que defina esse atributo pela hora e o mantenha definido. A única ideia que ele precisa acertar é que a skin segue o próprio mecanismo da página em vez de brigar com ele: ela escreve variáveis e o atributo de modo, e deixa a página se repintar sozinha.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> O meu app Android roda um script no início do documento em `https://claude.ai` e adota uma folha de estilo construída. Escreva a folha de estilo: sob `html[data-mode="dark"]`, cada `.cds-root` sem `data-mode="light"` e `.cds-root[data-mode="dark"]`, dê a `--cds-page-bg`, de `--cds-surface-0` a `-3`, `--cds-text-primary` e `--cds-text-accent` da página uma paleta azul-marinho com `!important`, e uma paleta azul-mar clara para `light`. Depois escreva um script que, em todo elemento com `data-mode` igual a `light`, `dark` ou `system` (nunca `code`), escreva `light` das 6:00 às 17:59 e `dark` no resto, pela hora local do celular. Rode-o na hora, a cada mudança que um único `MutationObserver` (limitado com `requestAnimationFrame`, observando também o atributo `data-mode`) veja, a cada 60 segundos e em `visibilitychange`; escreva só quando o valor for diferente. Em Kotlin, em `onResume`, pinte o quadro atrás das barras do sistema com o mesmo fundo e defina ícones de barra claros ou escuros pelas mesmas horas. Teste a regra da hora nas duas linguagens.

### O que conferir na resposta do Claude

1. As variáveis são definidas em cada elemento em que a página as declara, não só em `html`.
2. O script de modo deixa `data-mode=code` em paz.
3. Ele só escreve o atributo quando o valor difere, para que o observador não entre em loop.
4. O observador observa o atributo `data-mode`, então a página redefinindo-o é capturada.
5. Há um timer para a hora e um listener de `visibilitychange` para a volta da tela.
6. A regra em Kotlin e a regra em JavaScript concordam às 5, às 6, às 17 e às 18 horas.
7. Nada muda a configuração do Claude da pessoa; só o atributo na página.

Se uma verificação falhar, diga ao Claude o que você vê: "às 18:00 a página escurece, mas a barra de status continua clara".

### Como a pessoa autora pediu

As palavras da pessoa autora estão registradas em `odd/tasks/android-app.md`. A L1 pedia uma web view que "modifique sus estilos como lo hace esta extension" (mude os seus estilos como esta extensão faz), e a L3: "recuerda que los estilos que va a inyectar seran los de la extension […]" (lembre que os estilos que ele vai injetar serão os da extensão; o nome do projeto anterior foi omitido aqui). Então as cores não foram desenhadas de novo para o app: `skin.css`, `mode.js` e `lib/mode.js` vieram da extensão anterior como estavam, e o trabalho do app foi colocá-los na página cedo o bastante.

O resto é reconstruído a partir do histórico de commits (um nome de projeto num assunto é substituído por uma descrição entre colchetes):

- `3bcea35` (2026-11-24) "feat: build the script that hosts [the earlier extension] in a WebView, and what alerts and states keep" (montar o script que hospeda a [extensão anterior] numa WebView, e o que os alertas e os estados guardam). A sua mensagem: "the styles go on as a constructed style sheet." (os estilos entram como uma folha de estilo construída.)
- `53c55c1` (2026-11-24) "feat: host claude.ai with [the earlier extension] in a WebView, and show Narsil's alerts from a foreground service" (hospedar o claude.ai com a [extensão anterior] numa WebView, e mostrar os alertas da Narsil a partir de um serviço em primeiro plano). `paintBars` chega com a `MainActivity`.
- `5ad4577` (2026-11-24) "refactor: make the band's scripts the app's own, and stop naming the projects it replaces" (tornar os scripts da faixa do próprio app, e parar de nomear os projetos que ele substitui).

## Código de referência

Esta é uma resposta correta, escrita para este guia (MIT). Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

A regra da hora e as cores das barras num único objeto Kotlin, para que a activity e o seu teste as compartilhem:

```kotlin
package io.github.davshn.narsil

object DayNight {
    const val DAY_GROUND = "#c9e7f1"
    const val NIGHT_GROUND = "#0f1a2c"

    fun isDay(hour: Int): Boolean = hour in 6..17

    fun groundOf(hour: Int): String = if (isDay(hour)) DAY_GROUND else NIGHT_GROUND
}
```

```kotlin
package io.github.davshn.narsil

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DayNightTest {
    @Test
    fun theDayRunsFromSixToFiveFiftyNine() {
        assertFalse(DayNight.isDay(5))
        assertTrue(DayNight.isDay(6))
        assertTrue(DayNight.isDay(17))
        assertFalse(DayNight.isDay(18))
    }

    @Test
    fun theGroundIsThePagesOwn() {
        assertEquals("#c9e7f1", DayNight.groundOf(12))
        assertEquals("#0f1a2c", DayNight.groundOf(23))
    }
}
```

E a menor skin possível para uma variável, para ver o mecanismo sozinho. Coloque-a numa folha construída e defina `data-mode` à mão nas DevTools para ver a página acompanhar:

```css
html[data-mode='dark'],
html[data-mode='dark'] .cds-root:not([data-mode='light']),
.cds-root[data-mode='dark'] {
  --cds-page-bg: #0f1a2c !important;
}

html[data-mode='light'],
html[data-mode='light'] .cds-root:not([data-mode='dark']),
.cds-root[data-mode='light'] {
  --cds-page-bg: #c9e7f1 !important;
}
```

## Erros comuns e como testar

- **Variáveis só em `html`.** O primeiro componente que monta declara as suas, e a página volta às cores do Claude aos pedaços. Defina-as onde quer que a página as defina.
- **Um elemento `<style>` vindo do script.** A Content Security Policy de uma página pode recusá-lo. Uma folha de estilo construída, como a que o app usa, ou a própria folha de estilo de uma extensão, é o caminho.
- **Reescrever todo `data-mode`.** `data-mode=code` significa outra coisa nesta página; sobrescrevê-lo quebra essa parte.
- **Escrever o atributo a cada execução.** O observador acorda com a própria escrita e nunca descansa. Compare antes.
- **Sem timer.** A página não muda às 18:00, então sem um timer o modo espera o seu próximo toque.
- **Negrito em todo lugar, inclusive na faixa da Narsil.** `body *` alcança a faixa. Devolva às suas próprias partes os seus pesos.
- **Blocos de código ilegíveis no modo claro.** As cores inline ignoram as variáveis. Procure-as, como `skin.css` faz com o seu filtro.
- **Esperar que a configuração de aparência do Claude importe.** No app, a hora vence. É o design, não um bug.

Para testar, abra a página a partir de `chrome://inspect` num build de debug e execute, no console: `document.documentElement.dataset.mode` (`light` ou `dark` conforme a hora), `getComputedStyle(document.documentElement).getPropertyValue('--narsil-css-skin')` (`1`) e `getComputedStyle(document.documentElement).getPropertyValue('--cds-page-bg')` (`#0f1a2c` de noite, `#c9e7f1` de dia). Depois digite `document.documentElement.dataset.mode = 'system'`: em um quadro, ele deve voltar a mostrar o modo da hora. Para experimentar a outra metade do dia, ajuste o relógio do celular à mão nas configurações de data e hora do Android e volte ao app: a página muda em `visibilitychange`, as barras em `onResume`.

### Onde o código e o README diferem

- O README diz que as barras do sistema acompanham a mudança das cores pela hora. A página acompanha em até um minuto; as barras só acompanham quando o app volta para a frente, já que `paintBars` roda em `onResume` e em nenhum outro lugar. Com o app aberto na passagem das 6:00 ou das 18:00, as barras mantêm o fundo antigo até você sair e voltar.

## Para ir além

- O [guia 3](/pt/android/conversation-band/) mostra o observador da página que o modo compartilha com a faixa, e as marcas de estilo que a faixa confere.
- O [guia 2](/pt/android/webview-host/) explica os scripts de início de documento e a ordem que `PageScript` monta.
- A [Narsil Skin](https://github.com/davshn/narsil-skin) tem o tema completo para o app de desktop, com os seus papéis de parede, que o app deixa de fora: o comentário no topo de `skin.css` diz que ele não pega "none of that theme's wallpaper, waves or stars" (nenhum papel de parede, onda ou estrela desse tema).
- O código-fonte está em [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
