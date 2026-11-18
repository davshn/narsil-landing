---
title: O que é a Narsil no Claude
description: 'A extensão de navegador que leva a Narsil ao claude.ai no Android: o que mostra, por que é experimental, em que navegadores roda, suas opções e como é feita.'
route: claude
order: 1
updated: 2026-11-18
---

## O que faz

Narsil no Claude ("Narsil en Claude" no seu próprio nome) é uma extensão de navegador para Firefox e Vivaldi no Android. Ela leva a Narsil para dentro do `claude.ai`, para que você veja como estão as suas conversas sem sair da página onde fala com o Claude. Ela acrescenta quatro coisas:

- **Uma faixa acima da caixa de mensagem**, em toda conversa do `claude.ai/code`: a Narsil na pose do estado da conversa, o próprio estado (`TRABAJANDO`, `TE NECESITA`, `TERMINADA` ou `EN REPOSO`), o contexto usado, a contagem regressiva do cache e a última coisa que o Claude disse. O [guia 2](/pt/mods/claude/conversation-band/) trata dela.
- **Um bloco no menu lateral**, abaixo de Pesquisar: o nível e a experiência da Narsil, os limites de uso de 5 horas e da semana, e a contagem do ntfy do dia. O [guia 3](/pt/mods/claude/sidebar/) trata dele.
- **As cores da Narsil** na página inteira, claras de dia e escuras à noite, da paleta de mar noturno da [Narsil Skin](https://github.com/davshn/narsil-skin). O [guia 4](/pt/mods/claude/colors-and-icon/) trata delas.
- **O ícone da Narsil**, quando você adiciona o `claude.ai` à tela inicial com a extensão ativa. Também no [guia 4](/pt/mods/claude/colors-and-icon/).

A extensão funciona por cima do app web real do Claude. Nada é substituído: você continua lendo a conversa inteira, aprovando permissões e respondendo às perguntas do Claude como sempre. A extensão só acrescenta o que desenha ao redor delas.

> **Experimental.** A extensão depende da estrutura da página do `claude.ai` e de endereços internos que a própria página usa, não de uma API pública. Uma atualização do Claude pode quebrá-la a qualquer momento. Quando isso acontece, a faixa ou o bloco simplesmente deixam de aparecer; eles não cobrem nada. Ela só lê: nunca escreve na sua conta nem envia as suas conversas para lugar nenhum, embora a extensão carregue os desenhos da Narsil do GitHub e leia o tópico de estado dela no ntfy.sh. O código dela não é público, então este caminho explica como ela é feita e dá pequenos exemplos para você fazer os seus.

A extensão faz parte da família Narsil. O nível e a contagem do ntfy vêm do [Narsil for Claude Code](https://github.com/davshn/narsil-pet), o mod no seu computador; todo o resto funciona sem ele.

## Como funciona por dentro

### Por que uma extensão, e por que no Android

O Claude Code no seu computador já mostra a Narsil na sua faixa e na janela flutuante. Quando você conduz uma conversa pelo celular com o Remote Control, está no `claude.ai/code` num navegador de celular, e a Narsil fica fora de vista. O app do Claude para Android não pode ser estendido, mas uma página num navegador pode: uma extensão de navegador roda os seus próprios scripts dentro da página que você abre.

Por isso a extensão é a única forma de pôr a Narsil na mesma tela que a conversa, e é o motivo de ela suportar só dois navegadores de celular:

| Navegador              | Faixa e bloco        | Cores       | Ícone         |
| ---------------------- | -------------------- | ----------- | ------------- |
| Vivaldi para Android   | Sim                  | Sim         | Não testado   |
| Firefox para Android   | Sim                  | Sim         | Sim           |
| Firefox no computador  | Não testado          | Não testado | Não é preciso |
| Chrome para Android    | Não aceita extensões | Não         | Não           |
| O app nativo do Claude | Não                  | Não         | Não           |

Ela precisa do **Firefox 142 ou posterior** ou do **Vivaldi 8.2 ou posterior**. O mínimo do Firefox vem do manifesto (`strict_min_version` definido como `142.0`, tanto para o Firefox quanto para o Firefox para Android); o do Vivaldi, do README, que diz que o Vivaldi no Android carrega extensões do Chrome a partir de uma pasta desde a 8.2.

### As partes da extensão

A extensão é JavaScript puro, sem etapa de build e sem bibliotecas. A sua pasta contém:

- **`manifest.json`**, a descrição da qual toda extensão de navegador parte ([MDN: manifest.json](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json)). É um arquivo Manifest V2 para o Firefox. Ele pede só duas permissões: `storage`, para as opções, e `https://ntfy.sh/*`, para ler o estado do mod. Ele também declara `data_collection_permissions` como `none`, a forma do Firefox de uma extensão dizer que não coleta dados.
- **Dois grupos de content scripts**, ambos para `https://claude.ai/*` ([MDN: content_scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_scripts)). O primeiro roda em `document_start`, antes de a página desenhar, com as cores (`skin.css`, `mode.js`) e o ícone (`app-icon.js`). O segundo roda em `document_idle`, depois que a página carregou, com a faixa e o bloco (`content.js` e `band.css`).
- **Um script de fundo**, `background.js`. É a única parte que fala com o ntfy.sh. No Firefox é uma página de fundo; no pacote Chromium para o Vivaldi, um service worker carrega os mesmos arquivos.
- **A página de opções**, `options.html` e `options.js`, onde você escreve o seu tópico e a sua chave.
- **Pequenos módulos em `lib/`**, cada um carregado onde é necessário: `live.js` (o que a faixa e os limites fazem com os dados do `claude.ai`), `state.js` (o que é guardado e mostrado do estado do mod), `seal.js` (abrir mensagens seladas), `stream.js` (acompanhar o fluxo do ntfy.sh), `watch.js` (o único observador da página), `mode.js` (que modo cada hora recebe), `manifest.js` (o ícone da tela inicial), `restore.js` (devolver estilos e scripts no Vivaldi) e `browser.js` (permite que o código diga `browser` também no Chromium).

A divisão segue uma regra: **a página não vê nada secreto**. Os content scripts rodam dentro do `claude.ai` e desenham; o script de fundo guarda o tópico e a chave, lê o ntfy.sh e envia à página só o estado que ele já abriu. O código diz isso com todas as letras: o tópico e a chave "never reach the page" (nunca chegam à página).

### As opções: o seu tópico e a sua chave

A página de opções tem dois campos e um botão Salvar:

- **Tópico**, o que o `/narsil movil` lhe dá no Claude Code ([Alertas no celular e no relógio](/pt/mods/pet/phone-and-watch/) explica como o mod o cria). A página aceita só letras, números, `-` e `_`, até 64 caracteres, e recusa qualquer outra coisa.
- **Chave**, só se você criou uma com `/narsil movil clave`. É um campo de senha.

Os dois são salvos com `storage.local` ([MDN: storage.local](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/local)), o armazenamento próprio da extensão no celular. Eles nunca entram no pacote que é assinado, e nunca na página. Quando qualquer um deles muda, o script de fundo percebe (`storage.onChanged`) e volta a ler com os novos valores.

Se o bloco no menu lateral mostrar `Toca y escribe tu topic` ("toque e escreva o seu tópico") ou `🔒 Toca y pon la clave` ("toque e informe a chave"), um toque nele abre a página de opções.

### O que ela precisa do mod, e o que funciona sem ele

| Parte                              | Precisa do narsil-pet? | De onde vem                          |
| ---------------------------------- | ---------------------- | ------------------------------------ |
| A faixa acima da caixa de mensagem | Não                    | O próprio `claude.ai`                |
| Os limites de 5 horas e da semana  | Não                    | O próprio `claude.ai`                |
| As cores e o ícone                 | Não                    | A extensão                           |
| O nível e a experiência da Narsil  | Sim                    | O tópico de estado do mod no ntfy.sh |
| A contagem do ntfy do dia          | Sim                    | O tópico de estado do mod no ntfy.sh |
| O estágio da Narsil nos desenhos   | Sim                    | O desenho que o estado do mod indica |

Para as linhas que precisam do mod, o `/narsil movil` deve estar ligado. Sem ele, o bloco no menu lateral mostra só os limites, e a faixa mostra o ícone da própria extensão onde estaria o desenho da Narsil no estágio dela.

### O que passa pela rede

A extensão só lê. Cada requisição que ela faz, segundo o seu código:

- **Ao `claude.ai`**, com a sua sessão, como a própria página faz: a lista das suas conversas ativas e pausadas, os últimos eventos da que você tem aberta e o uso da sua conta. Só requisições `GET`. Nada é escrito na sua conta.
- **Ao ntfy.sh**, a partir do script de fundo: ele lê o tópico de estado do mod (o seu tópico com `-estado` no final). Ler um tópico exige o nome dele no endereço, então o ntfy.sh vê o tópico e a rede do seu celular. Nada é publicado.
- **Ao GitHub**, para os desenhos da Narsil: a faixa e o bloco mostram a arte dela do repositório narsil-pet, então o celular baixa essas imagens. O nome do arquivo diz a pose e o estágio dela, como a pose de trabalho ou a de espera.
- **O ícone da tela inicial** aponta para os ícones do aplicativo web de celular da pessoa autora, que o navegador só baixa quando você adiciona o `claude.ai` à tela inicial.

Nenhuma delas envia o que a página mostra (as suas conversas, o seu uso, o seu tópico ou a sua chave) para outro lugar.

### Como instalá-la

O código não é público, então estes são os passos que a pessoa autora segue, e os passos que valem para uma extensão que você mesmo construir. O [guia 5](/pt/mods/claude/android-packaging/) explica o empacotamento em detalhe.

**No Vivaldi**, a extensão é carregada de uma pasta no celular, sem assinatura:

1. Monte o pacote Chromium (Manifest V3) a partir da extensão do Firefox e copie-o para a pasta `Download` do celular por USB.
2. No Vivaldi, abra `vivaldi://extensions` e ligue o **Modo de desenvolvedor**.
3. Toque em **Carregar sem compactação**, escolha a pasta e depois **Usar esta pasta** e **Permitir**.
4. Abra as opções da extensão e escreva o seu tópico, e a chave se você tiver uma.
5. Abra o `claude.ai` e recarregue-o.

**No Firefox**, uma extensão precisa ser assinada pela Mozilla. A assinatura é _não listada_: ela não publica a extensão na loja de complementos.

1. Crie credenciais de API em [addons.mozilla.org](https://addons.mozilla.org/developers/addon/api/key/) e assine a extensão com o `web-ext sign --channel=unlisted` da Mozilla ([Extension Workshop: web-ext command reference](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#web-ext-sign)). O resultado é um arquivo `.xpi`.
2. Copie o `.xpi` para o celular.
3. No Firefox, abra **Configurações → Sobre o Firefox** e toque no logotipo cinco vezes para mostrar o menu oculto.
4. De volta às **Configurações**, use a opção de instalar uma extensão a partir de um arquivo.
5. Abra as configurações da extensão e escreva o seu tópico, e a chave se você tiver uma.

### Como desinstalá-la

No Firefox, abra o menu, vá a **Extensões**, escolha **Narsil en Claude** e remova-a. No Vivaldi, remova-a em `vivaldi://extensions`. O Claude volta às suas próprias cores. O ícone da tela inicial fica até você instalar o app de novo, porque o navegador o fixa no momento da instalação.

Para parar o nível e a contagem sem remover nada, apague o tópico nas opções. Para que o mod pare de enviar o estado de vez, execute `/narsil movil off` no seu computador.

## Como foi pedido à IA

### Registrado: sobre este caminho, não sobre a extensão

Os pedidos da própria extensão à IA não foram registrados. O que está registrado é como a pessoa autora pediu que ela aparecesse neste site. Na fase 2 do registro de tarefas do site:

> "tambien quiero agregar la informacion de narsil-claude ponla como experimental, aunque he hecho muchas pruebas y fujnciona bastante bien"

Tradução para o português: também quero acrescentar a informação sobre o narsil-claude; marque-o como experimental, embora eu tenha feito muitos testes e ele funcione muito bem.

E para este caminho, em 2026-11-18:

> "hay otra cosa, no metimos la guia de narsul claude en celular, pusimos que era experimental pero que explicariamos como hacerlo, falta esa guia, el repositorio es narsil-claude"

Tradução para o português: tem mais uma coisa, não incluímos o guia do narsil claude no celular; dissemos que era experimental, mas que explicaríamos como fazê-lo; falta esse guia; o repositório é narsil-claude. A pessoa autora pediu uma "Ruta corta", um caminho curto, que é este.

### Reconstrução a partir do histórico de commits

O resto é reconstruído a partir do histórico de commits da extensão; os próprios pedidos não foram guardados. O primeiro dia construiu a maior parte:

- `c200e8a` (2026-11-09) "feat: show Narsil's state in claude.ai's sidebar on Firefox for Android" (mostrar o estado da Narsil no menu lateral do claude.ai no Firefox para Android). A sua mensagem explica o objetivo: "so the state is on the same screen as Claude" (para que o estado fique na mesma tela que o Claude), lendo o ntfy.sh a partir da página de fundo, com o tópico e a chave no armazenamento da extensão.
- `0d65509` (2026-11-09) "feat: wear Narsil's colors on claude.ai, light by day and dark by night" (vestir o claude.ai com as cores da Narsil, claras de dia e escuras à noite).
- `40be528` (2026-11-09) "build: sign the extension as unlisted with Mozilla" (assinar a extensão como não listada com a Mozilla).
- `083c03d` (2026-11-09) "feat: give claude.ai Narsil's icon when it is installed from Firefox" (dar ao claude.ai o ícone da Narsil quando ele é instalado a partir do Firefox).
- `19677ac` (2026-11-09) "feat: show each conversation's state, context and cache above the prompt" (mostrar o estado, o contexto e o cache de cada conversa acima do prompt).
- `00adbb9` (2026-11-09) "feat: show only Narsil's level, the limits and ntfy's count in the sidebar" (mostrar no menu lateral só o nível da Narsil, os limites e a contagem do ntfy).
- `11dadb3` (2026-11-10) "feat: run the extension in Vivaldi for Android as a Chromium package" (rodar a extensão no Vivaldi para Android como um pacote Chromium).

A ordem mostra um design que se estreitou: começou como um único painel no menu lateral alimentado pelo ntfy.sh e terminou dividido em dois, com o ntfy.sh usado só para o que a página não consegue saber.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> Construa uma extensão do Firefox (Manifest V2, JavaScript puro, sem etapa de build) para o Firefox para Android que acrescente uma pequena faixa de estado a `https://claude.ai/*`. Use dois grupos de content scripts: um em `document_start` para os estilos, um em `document_idle` que desenha a faixa. Acrescente uma página de opções (`options_ui`) com um campo "topic", validado como `[-_A-Za-z0-9]{1,64}`, salvo com `browser.storage.local`. Só o script de fundo pode ler o tópico e falar com `https://ntfy.sh`; o content script recebe o estado por `runtime.connect` e nunca vê o tópico. Não peça nenhuma permissão além de `storage` e `https://ntfy.sh/*`. Insira cada trecho de texto com `textContent`, nunca como HTML. Use só APIs documentadas no MDN e liste cada uma que você usou com a sua página no MDN.

## O código mínimo

Um esqueleto com a mesma forma, escrito para este guia (MIT). É uma extensão Manifest V2 para o Firefox com um content script, um script de fundo e uma página de opções; os [guias 2](/pt/mods/claude/conversation-band/) e [3](/pt/mods/claude/sidebar/) os preenchem.

`manifest.json`:

```json
{
  "manifest_version": 2,
  "name": "My band on claude.ai",
  "version": "0.1.0",
  "browser_specific_settings": {
    "gecko": {
      "id": "my-band@example.com",
      "strict_min_version": "142.0",
      "data_collection_permissions": { "required": ["none"] }
    }
  },
  "permissions": ["storage", "https://ntfy.sh/*"],
  "background": { "scripts": ["background.js"] },
  "content_scripts": [
    {
      "matches": ["https://claude.ai/*"],
      "js": ["band.js"],
      "css": ["band.css"],
      "run_at": "document_idle"
    }
  ],
  "options_ui": { "page": "options.html", "open_in_tab": true }
}
```

O `options.html` contém um formulário com um campo `topic`, um botão de envio e um parágrafo `status`, e carrega o `options.js`:

```js
const form = document.getElementById('form')
const input = document.getElementById('topic')
const status = document.getElementById('status')

browser.storage.local.get('topic').then(({ topic }) => {
  input.value = topic ?? ''
})

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const topic = input.value.trim()
  if (!/^[-_A-Za-z0-9]{1,64}$/.test(topic)) {
    status.textContent = 'Only letters, numbers, - and _.'
    return
  }
  await browser.storage.local.set({ topic })
  status.textContent = 'Saved.'
})
```

Teste-o com um tópico inventado como `narsil-0123456789abcdef0123`. As APIs estão no MDN: [`storage.local`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/local), [`options_ui`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/options_ui) e [`browser_specific_settings`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings).

## Erros comuns e como testar

- **Esperá-la no app do Claude.** O app nativo não aceita extensões, nem o Chrome para Android. Use o Firefox ou o Vivaldi, no `claude.ai` no navegador.
- **Uma extensão sem assinatura no Firefox.** O Firefox de versão estável só instala extensões assinadas. Cada nova assinatura também precisa de uma nova `version` no manifesto.
- **O tópico no pacote.** Nunca o escreva no código: o pacote vai para a Mozilla para ser assinado. Guarde-o em `storage.local`.
- **Um tópico com espaços ou uma barra.** A página de opções o recusa. Copie o tópico exatamente como o `/narsil movil` o mostrou.
- **Nada depois de instalar.** Recarregue o `claude.ai`, como diz o último passo da instalação, para que a página carregue com os scripts da extensão.
- **Uma faixa e nenhum nível.** O nível precisa do mod no seu computador com o `/narsil movil` ligado, e ele se atualiza quando o mod envia um estado (guia 3).

Para testar o esqueleto primeiro num computador, carregue-o como complemento temporário em `about:debugging` ([Extension Workshop: test and debug](https://extensionworkshop.com/documentation/develop/debugging/)), abra as opções a partir de `about:addons`, salve um tópico inventado e leia-o de volta com `browser.storage.local.get('topic')` no console da extensão. Para um celular, `web-ext run --target=firefox-android` a roda num aparelho conectado por USB ([web-ext run](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#web-ext-run)).

## Para ir além

- Leia o [guia 2](/pt/mods/claude/conversation-band/) para a faixa, que não precisa de nada do computador.
- Leia [Contexto e limites](/pt/mods/pet/context-and-limits/) e [O relógio do cache](/pt/mods/pet/cache-clock/) para ver como a Narsil mostra os mesmos números dentro do Claude Code.
- A [Narsil Skin](https://github.com/davshn/narsil-skin) é o tema público de onde vêm as cores da extensão.
