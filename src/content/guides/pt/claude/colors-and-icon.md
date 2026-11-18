---
title: As cores e o ícone da Narsil
description: 'Como a Narsil no Claude veste o claude.ai com as cores de mar noturno do Narsil Skin, claro de dia e escuro à noite pelo relógio do celular, e dá ao app da tela inicial o ícone dela.'
route: claude
order: 4
updated: 2026-11-18
---

## O que faz

Com a extensão ativa, a página inteira do `claude.ai` veste a paleta de mar noturno do [Narsil Skin](https://github.com/davshn/narsil-skin): azuis profundos à noite, azuis-claros de mar de dia. Ela muda:

- **As cores da página**: fundos, painéis, texto, bordas, destaques e o menu lateral.
- **Os blocos de código**, tanto no chat quanto nos diffs de código, para que combinem com o resto.
- **Alguns detalhes**: a caixa de mensagem ganha uma borda fina que assume a cor de destaque quando você escreve, o texto que você seleciona assume a cor de destaque, todo o texto fica em negrito como no tema, e a faísca laranja que aparece enquanto o Claude trabalha fica roxa.

Fica claro das 6:00 às 17:59 e escuro das 18:00 às 5:59, pelo relógio do celular, seja qual for a aparência que você escolheu nas próprias configurações do Claude.

E quando você adiciona o `claude.ai` à tela inicial com a extensão ativa, o app recebe o ícone da Narsil em vez do do Claude.

> **Experimental.** As cores funcionam sobrescrevendo as variáveis de design que a página do `claude.ai` declara para si mesma, e o modo reescrevendo um atributo da página. Nenhum dos dois é uma API pública, então uma atualização do Claude pode renomeá-los e a página volta às cores do próprio Claude, sem nada quebrado. A extensão só muda a aparência da página no seu celular: ela não escreve nada na sua conta. Para mostrar o ícone da tela inicial, o navegador o baixa do endereço do aplicativo web de celular da Narsil, `narsil-pwa.vercel.app`, só quando você instala o app.

## Como funciona por dentro

As cores e o ícone são o primeiro grupo de content scripts do manifesto, o que roda em `document_start`, antes de a página desenhar qualquer coisa ([MDN: content_scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_scripts)). Ele tem uma folha de estilos, `skin.css`, e quatro scripts pequenos: `lib/watch.js` (o observador da página que o [guia 2](/pt/mods/claude/conversation-band/) descreve), `lib/mode.js` e `mode.js` (a hora), e `lib/manifest.js` e `app-icon.js` (o ícone).

Rodar tão cedo importa: uma folha de estilos que chegasse depois de a página desenhar mostraria as cores do próprio Claude por um instante antes. O comentário do código diz isso com todas as letras: as cores da própria página "never flash first" (nunca piscam primeiro).

### Só as variáveis da página, não um design novo

A página do `claude.ai` não fixa as suas cores no código. Ela as declara como propriedades personalizadas de CSS, como `--cds-page-bg` para o fundo da página e `--cds-text-primary` para o texto principal, e cada parte da página as lê ([MDN: Using CSS custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)). Ela tem dois conjuntos, um para cada modo, escolhidos por um atributo `data-mode`.

Por isso o `skin.css` não reestiliza botões, menus e painéis um por um. Ele dá novos valores a essas mesmas variáveis, um bloco para `data-mode="dark"` e um para `data-mode="light"`, cada um marcado com `!important` para que ganhe das declarações da própria página. O bloco escuro é feito com os azuis noturnos do tema, como `#0f1a2c` para a página; o bloco claro, com os seus azuis-claros de mar, como `#c9e7f1`. O texto secundário e o atenuado são o texto principal misturado com transparência (`color-mix()`), para que mantenham o mesmo matiz.

Há um porém que os comentários da folha de estilos explicam: a página não declara as variáveis só no `<html>`. Cada parte que ela monta com a sua própria raiz as declara de novo para si, então uma regra só no `<html>` dura apenas até essa parte aparecer. As regras cobrem essas raízes também.

Algumas coisas não usam as variáveis e ganham regras próprias: o fundo do menu lateral, os diffs de código e os blocos de código do chat.

### Por que só cores e estilos, sem fundo animado

O Narsil Skin no desktop pode desenhar um papel de parede animado atrás do Claude. A extensão não traz nada disso. O comentário no topo do `skin.css` diz que ela pega "only the page's own design variables and a few parts" (só as próprias variáveis de design da página e algumas partes), e nada do papel de parede, das ondas ou das estrelas do tema; o README diz o mesmo: só as cores e os estilos do tema, sem fundos animados.

Nenhum dos dois diz por quê. Um motivo provável é o próprio celular: uma camada animada atrás de uma página que já se redesenha muitas vezes por segundo enquanto o Claude escreve custaria bateria e quadros, e o trabalho posterior da extensão (abaixo) foi todo para deixar a página mais leve. Mudar variáveis quase não custa nada, porque a página já as lê.

### Os blocos de código no modo claro

Os blocos de código do chat foram um caso à parte. Os seus tokens são coloridos inline, em cada `<pre>`, com a paleta escura da página, mesmo quando o modo claro é forçado. No modo claro, tokens pálidos sobre um fundo pálido mal podiam ser lidos.

O commit `127ca62` (2026-11-13) "style: darken code block tokens in light mode" (escurecer os tokens dos blocos de código no modo claro) resolve isso com um filtro, não com uma nova paleta. Ele seleciona só os blocos de código do modo claro cuja cor base inline é a da paleta escura, os inverte e gira o matiz meia volta ([MDN: filter](https://developer.mozilla.org/en-US/docs/Web/CSS/filter)). Inverter transforma o pálido em escuro; girar o matiz 180 graus devolve cada cor ao seu próprio matiz, então uma palavra-chave azul-clara vira um azul mais escuro, não um laranja. Um pouco de saturação extra evita que pareçam desbotados.

Os diffs de código funcionam de outro jeito: eles vivem dentro de uma shadow root, que as regras da página não alcançam. Mas as propriedades personalizadas passam para dentro de uma shadow root, e uma regra no elemento que a hospeda ganha das próprias regras da shadow root, então o `skin.css` define as variáveis de fundo e de texto do diff nesse host.

### Claro de dia, escuro à noite, pelo relógio do celular

A regra está em `lib/mode.js`: uma hora de 6 até 17 é dia e recebe `light`; qualquer outra hora recebe `dark`. O comentário dele diz que segue as mesmas horas do tema automático do Narsil Skin.

O `mode.js` a aplica. Ele procura cada elemento cujo `data-mode` é `light`, `dark` ou `system` e o define com o modo da hora atual. Não todo `data-mode`: a página também usa `data-mode="code"` para outra coisa, e esse fica como está. Ele só escreve quando o valor é diferente, para que o observador da página não seja acordado à toa.

Como a configuração de aparência do próprio Claude funciona pelo mesmo atributo, o modo da extensão ganha dela: seja o que for que você escolheu, a próxima execução devolve o modo da hora.

Ele roda de novo:

- **Quando a página muda**, pelo único observador da página, que também escuta mudanças no próprio `data-mode`. Quando a página monta uma nova parte com o seu próprio `data-mode`, ou o devolve à sua configuração do Claude, ele é corrigido em um quadro.
- **A cada minuto**, porque a hora pode virar às 6:00 ou às 18:00 sem nenhuma mudança na página.
- **Quando a página volta a ficar visível**, já que uma página oculta não roda quadros e o celular pode ter dormido durante a mudança.

### Conversas mais rápidas

Em 2026-11-11, o commit `ce7d17e` "perf: lighten the styles and the page observers so claude.ai switches conversations faster" (aliviar os estilos e os observadores da página para que o claude.ai troque de conversa mais rápido) descobriu que as próprias cores estavam deixando a página lenta. A sua mensagem cita três mudanças:

1. **Duas variáveis de cor atenuada** eram definidas em todos os elementos. Uma propriedade personalizada definida em todos os elementos faz cada um carregar a sua própria cópia, e cada recálculo de estilos paga por isso. Agora elas são definidas só nos elementos onde a própria página as declara, e herdadas a partir dali.
2. **A regra do negrito** excluía as partes da própria Narsil com um `:not()` de descendentes, o que faz o navegador percorrer os ancestrais de cada elemento a cada recálculo. Ela virou uma regra simples para todo o texto, e a própria folha de estilos da faixa devolve os seus pesos.
3. **Um observador** para todos os content scripts, executado no máximo uma vez por quadro, em vez de um por script.

### Quando o Vivaldi pula as cores ou o modo

O Vivaldi para Android trouxe dois problemas próprios, explicados no [guia 5](/pt/mods/claude/android-packaging/): depois que o Android fecha o Vivaldi e ele abre de novo, ele pode carregar a faixa sem as suas folhas de estilos, ou pular o grupo `document_start` inteiro, de modo que o `mode.js` nunca roda e a página mantém o modo do próprio Claude.

As correções deixam a página perceber o que falta e pedir:

- **`a1e01b6`** (2026-11-18): cada folha de estilos termina definindo uma marca própria no `:root`, uma propriedade personalizada como `--narsil-css-skin: 1`. Quando a faixa começa, ela lê as marcas com `getComputedStyle`; uma folha de estilos cuja marca está vazia não chegou.
- **`8e31a1d`** (2026-11-18): a faixa também confere se o `lib/mode.js` deixou a sua função na página. Se não, o primeiro grupo não rodou.

Nos dois casos a faixa pede ao script de fundo as peças que faltam, e o script de fundo devolve só as folhas de estilos e os grupos do próprio manifesto, os estilos primeiro.

### O ícone da tela inicial

Quando você adiciona uma página à tela inicial, o navegador lê o manifesto de aplicativo web dela, o arquivo que a página indica num `<link rel="manifest">` ([MDN: Web application manifest](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest)). O seu membro `icons` diz quais imagens o app recebe ([MDN: icons](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons)).

Por isso a extensão não mexe na tela inicial. Ela muda qual manifesto a página oferece:

1. **O `lib/manifest.js` monta um manifesto** que é o Claude como ele é: o nome `Claude`, exibição standalone, início e escopo em `https://claude.ai/`, o azul de mar noturno como cor de fundo e de tema, e dois ícones, de 192 e 512 pixels.
2. **Ele o transforma num endereço** próprio: uma URL `data:` com o tipo `application/manifest+json` e o JSON codificado nela. Nada é baixado para o manifesto em si.
3. **O `app-icon.js` aponta o link da página para ele**: ele encontra o `<link rel="manifest">` e substitui o seu `href`, se já não for esse. O observador da página escuta mudanças no `href`, então, se a página devolver o próprio manifesto, a próxima execução o troca de novo.

Os ícones não estão dentro da extensão. Um manifesto `data:` não tem endereço próprio contra o qual resolver um caminho de ícone relativo, então os ícones precisam de endereços completos, e eles apontam para onde o aplicativo web de celular da Narsil já os serve: `https://narsil-pwa.vercel.app`. O navegador só os baixa quando você instala o app.

### Por que o ícone fica fixo na instalação

O navegador copia o ícone quando cria o app da tela inicial; ele não pergunta de novo à página cada vez que você o abre. A mensagem do commit `083c03d` diz isso: "The icon is set at install, so an app already installed has to be installed again." (O ícone é definido na instalação, então um app já instalado precisa ser instalado de novo.)

Isso tem duas consequências que o README explicita:

- **Se você já tinha o `claude.ai` na tela inicial**, remova-o e adicione-o de novo com a extensão ativa.
- **Se você remover a extensão**, o app mantém o ícone da Narsil. Não há nada rodando para trocá-lo de volta; ele fica até você instalar o app de novo.

O ícone foi testado no Firefox para Android, onde a extensão o adiciona a partir do menu com **Instalar** ou **Adicionar à tela inicial**. No Vivaldi ele não foi testado.

## Como foi pedido à IA

Nenhum pedido para as cores ou para o ícone foi registrado. As palavras da pessoa autora registradas para este caminho são sobre o site (o [guia 1](/pt/mods/claude/what-it-is/) as cita). O que segue é reconstruído a partir do histórico de commits da extensão:

- `0d65509` (2026-11-09) "feat: wear Narsil's colors on claude.ai, light by day and dark by night" (vestir o claude.ai com as cores da Narsil, claras de dia e escuras à noite). A sua mensagem descreve a abordagem: ele sobrescreve as próprias variáveis de design da página com a paleta de mar noturno, "without its wallpaper" (sem o seu papel de parede), e segue as mesmas horas do modo automático do tema.
- `083c03d` (2026-11-09) "feat: give claude.ai Narsil's icon when it is installed from Firefox" (dar ao claude.ai o ícone da Narsil quando ele é instalado a partir do Firefox). Ele oferece ao Firefox um manifesto com os ícones dela no lugar do da própria página.
- `ce7d17e` (2026-11-11) "perf: lighten the styles and the page observers so claude.ai switches conversations faster" (aliviar os estilos e os observadores da página para que o claude.ai troque de conversa mais rápido).
- `127ca62` (2026-11-13) "style: darken code block tokens in light mode" (escurecer os tokens dos blocos de código no modo claro).
- `a1e01b6` (2026-11-18) "fix: ask for the styles when Vivaldi loads the band without them" (pedir os estilos quando o Vivaldi carrega a faixa sem eles).
- `8e31a1d` (2026-11-18) "fix: run the light and dark switch again when Vivaldi skips it" (rodar de novo a troca entre claro e escuro quando o Vivaldi a pula).

O histórico se lê como um primeiro dia que acertou a aparência, seguido de trabalho sobre o que a aparência custava: velocidade numa página longa, legibilidade num canto, e o hábito do Vivaldi de carregar só parte da extensão.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> Na minha extensão do Firefox para `https://claude.ai/*`, acrescente um grupo de content scripts em `document_start` com uma folha de estilos e dois scripts. A folha de estilos sobrescreve só as próprias propriedades personalizadas de CSS da página, um bloco para `[data-mode="dark"]` e um para `[data-mode="light"]`, com `!important`; sem fundos, imagens nem animações. O primeiro script define cada elemento cujo `data-mode` é `light`, `dark` ou `system` como `light` das 6:00 às 17:59 no horário local e `dark` no resto, escrevendo só quando o valor for diferente; ele roda a partir de um único `MutationObserver` limitado com `requestAnimationFrame`, a cada 60 segundos e no `visibilitychange`. O segundo script substitui o `href` do `<link rel="manifest">` da página por uma URL `data:application/manifest+json` com um manifesto que tem URLs absolutas de ícones em `https://example.com`. Mantenha a regra da hora num módulo próprio e teste-a com `node --test`.

## O código mínimo

As mesmas três peças, escritas para este guia (MIT). Os nomes das variáveis são os que a página do `claude.ai` declara hoje; as cores são duas da paleta de mar noturno; o endereço do ícone é um marcador para o seu.

`skin.css`:

```css
html[data-mode='dark'],
[data-mode='dark'] {
  --cds-page-bg: #0f1a2c !important;
  --cds-text-primary: #dce6fa !important;
}

html[data-mode='light'],
[data-mode='light'] {
  --cds-page-bg: #c9e7f1 !important;
  --cds-text-primary: #0f2f47 !important;
}
```

`mode.js`:

```js
const modeAt = (hour) => (hour >= 6 && hour < 18 ? 'light' : 'dark')
const themed = '[data-mode="light"],[data-mode="dark"],[data-mode="system"]'

function applyMode() {
  const mode = modeAt(new Date().getHours())
  document.querySelectorAll(themed).forEach((element) => {
    if (element.dataset.mode !== mode) element.dataset.mode = mode
  })
}

const icons = [192, 512].map((size) => ({
  src: `https://example.com/icons/icon-${size}.png`,
  sizes: `${size}x${size}`,
  type: 'image/png',
}))
const manifest = { name: 'Claude', display: 'standalone', start_url: 'https://claude.ai/', icons }
const manifestUrl = `data:application/manifest+json,${encodeURIComponent(JSON.stringify(manifest))}`

function applyIcon() {
  const link = document.querySelector('link[rel~="manifest"]')
  if (link && link.getAttribute('href') !== manifestUrl) link.setAttribute('href', manifestUrl)
}

let queued = false
new MutationObserver(() => {
  if (queued) return
  queued = true
  requestAnimationFrame(() => {
    queued = false
    applyMode()
    applyIcon()
  })
}).observe(document.documentElement, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ['data-mode', 'href'],
})

setInterval(applyMode, 60_000)
document.addEventListener('visibilitychange', applyMode)
applyMode()
applyIcon()
```

No manifesto, os dois vão numa única entrada de content script com `"run_at": "document_start"` e `"matches": ["https://claude.ai/*"]`. Em `document_start` a página ainda não tem body, e é por isso que tudo espera o observador ([MDN: MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)): o observador dispara enquanto a página se monta, e cada execução corrige o que já apareceu. O `attributeFilter` limita as mudanças de atributo às duas que interessam ao script.

## Erros comuns e como testar

- **Carregar as cores em `document_idle`.** A página desenha primeiro com as cores do Claude e depois muda. Carregue a folha de estilos em `document_start`.
- **Estilizar as partes em vez das variáveis.** Cada botão e cada painel precisa da sua própria regra, e cada atualização do Claude quebra algumas. Sobrescreva as variáveis que a página já lê.
- **Definir as variáveis só no `<html>`.** Partes da página as declaram de novo nas suas próprias raízes. Cubra essas raízes também, e confira que um painel recém-aberto mantém as cores.
- **Definir uma propriedade personalizada em todos os elementos.** Funciona, e deixa lento cada recálculo de estilos. Defina-a onde a página a declara e deixe-a ser herdada.
- **Reescrever todo `data-mode`.** A página usa `data-mode="code"` para outra coisa. Selecione só `light`, `dark` e `system`.
- **Escrever quando nada mudou.** Cada escrita acorda o observador, que escreve de novo. Compare primeiro.
- **Esperar a página mudar às 18:00.** Ela pode não mudar. Confira a hora com um temporizador, e quando a página voltar a ficar visível.
- **Um caminho de ícone relativo num manifesto `data:`.** Ele não tem contra o que ser resolvido. Use endereços completos.
- **Esperar que o ícone mude num app já instalado.** Ele foi fixado na instalação. Remova o app e adicione-o de novo.

Para testar a regra da hora, mantenha-a num módulo sem DOM e confira os limites: 5, 6, 17 e 18 devem dar `dark`, `light`, `light` e `dark`. Para testar a página, mude a hora do celular para 17:59 e espere dar 18:00, ou defina a hora à mão na regra enquanto desenvolve: a página deve trocar em até um minuto sem recarregar. Depois mude a configuração de aparência do próprio Claude: a página deve voltar na hora ao modo da hora. Para o ícone, abra o `claude.ai` com a extensão ativa, adicione-o à tela inicial e confira que o novo app mostra o seu ícone; remova a extensão e confira que ele continua.

## Para ir além

- O [guia 5](/pt/mods/claude/android-packaging/) explica por que o Vivaldi às vezes carrega a extensão em pedaços, e como o script de fundo devolve os estilos.
- O [Narsil Skin](https://github.com/davshn/narsil-skin) tem o tema completo de mar noturno para o desktop, papel de parede incluído, e outros temas cujas variáveis poderiam ser levadas do mesmo jeito.
- As horas poderiam seguir o nascer e o pôr do sol em vez de 6:00 e 18:00 fixos. A regra vive numa função pequena, então só essa função mudaria.
