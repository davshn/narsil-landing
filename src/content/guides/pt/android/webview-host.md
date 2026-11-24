---
title: O hospedeiro da WebView
description: 'Como a MainActivity hospeda o claude.ai: configurações da WebView, a sessão mantida, arquivos e microfone, para onde vão os links, e como PageScript e host.js rodam a Narsil no início de cada página.'
route: android
order: 2
updated: 2026-11-24
sources:
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/MainActivity.kt
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/PageScript.kt
  - repo: android
    path: app/src/main/assets/host.js
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/Links.kt
  - repo: android
    path: app/src/test/java/io/github/davshn/narsil/PageScriptTest.kt
  - repo: android
    path: app/src/main/AndroidManifest.xml
---

## O que faz

O hospedeiro é tudo o que o app faz para que o `claude.ai` rode dentro dele com a Narsil por cima. Ele vive quase todo num único arquivo, `MainActivity.kt`, com dois ajudantes: `PageScript.kt`, que monta o script que roda no início de cada página, e `assets/host.js`, a parte desse script que faz o papel de navegador para os scripts de página da Narsil.

Por fora, você só percebe os resultados:

- O Claude abre em `claude.ai/code`, em tela cheia, entre as barras do sistema e acima do teclado.
- Você entra uma vez, e a sessão sobrevive ao Android fechar o app.
- O botão **+** abre o seletor de arquivos do celular, e o ditado pode usar o microfone.
- O `claude.ai` fica no app. Qualquer outro link abre no seu navegador, e os logins do Google e da Apple mostram uma mensagem no lugar.
- O botão de voltar volta no Claude e, a partir da primeira página do Claude, manda o app para o segundo plano.
- As cores e a faixa da Narsil estão em toda página do `claude.ai` desde o primeiríssimo instante.

> **Experimental.** O hospedeiro roda os scripts da Narsil dentro de uma página que ele não controla. Eles dependem da estrutura do `claude.ai` e das requisições internas dele, não de uma API pública, então uma atualização do Claude pode quebrá-los. O hospedeiro é feito para que, quando isso acontecer, o próprio Claude continue funcionando: cada script roda por conta própria, e um erro num deles é registrado no log e deixa os outros rodando.

## Como funciona por dentro

### As configurações da WebView

`onCreate` monta a WebView em código, dentro de um `FrameLayout`, e define o que o `claude.ai` precisa. Este trecho é de `MainActivity.kt` no narsil-android (MIT):

```kotlin
        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            // A page's popups (Google's sign-in button opens one) reach onCreateWindow, which decides where they go.
            setSupportMultipleWindows(true)
            javaScriptCanOpenWindowsAutomatically = true
        }
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(web, true)
        }
```

JavaScript e DOM storage vêm desligados por padrão numa WebView, e o `claude.ai` é um app JavaScript que guarda estado no armazenamento, então os dois são ligados. A mídia pode tocar sem um toque. Os popups são permitidos, mas só para que o app possa capturá-los (abaixo). Os cookies são aceitos, os de terceiros também; o código não diz qual página precisa deles.

Mais duas linhas importam para a tela. O Android 15 desenha os apps de ponta a ponta, sob a barra de status, a barra de navegação e o teclado. A activity chama `enableEdgeToEdge()` e depois aplica ao seu quadro um preenchimento do tamanho das barras do sistema e do teclado (`WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime()`), para que a página fique entre eles. O manifesto também lista cada mudança de configuração que o app trata sozinho (`orientation|screenSize|...|uiMode|density`), então girar o celular não reconstrói a activity nem recarrega o Claude.

### Entrar uma vez: gravar o cookie

A sua sessão com o `claude.ai` é um cookie. O `CookieManager` da WebView guarda os cookies na memória e os escreve em disco quando decide. Se o Android matar o app antes disso, a sessão se perde e você entra de novo. Por isso, o próprio app os escreve cada vez que vai para o segundo plano:

```kotlin
    // The session's cookie reaches the disk now, not when Android gets to it: a killed app keeps its sign-in.
    override fun onPause() {
        CookieManager.getInstance().flush()
        web.onPause()
        super.onPause()
    }
```

`onPause` roda sempre que o app deixa de estar na frente: você troca de app, bloqueia o celular ou abre as configurações. Esse é o último momento em que o app tem certeza de rodar antes que o Android possa fechá-lo. A especificação S3 pedia exatamente isso: "login once and the session stays (cookies flushed to disk)" (entrar uma vez e a sessão fica, com os cookies gravados em disco).

### Para onde vai cada link

Toda navegação que a página pede chega a `shouldOverrideUrlLoading`, que pergunta a `Links.isInApp` (o [guia 1](/pt/android/what-it-is/) cita o `Links.kt` inteiro). Devolver `false` deixa a WebView carregá-la; devolver `true` a impede, e `goOut` decide o que acontece no lugar:

- **Os logins do Google e da Apple** (`accounts.google.com`, `appleid.apple.com`): nada abre, e um toast longo diz para entrar com um e-mail.
- **Qualquer outra coisa**: o `ACTION_VIEW` do Android com a categoria `BROWSABLE`, que abre o seu navegador ou o app que trata o endereço. Se nenhum trata, o app registra no log "Nothing opens" (nada abre) e o endereço.

Os popups precisam de um caminho próprio. O botão do Google abre um, e uma WebView sem janela para dar a ele o descarta, e é por isso que o login travava. Agora `onCreateWindow` entrega à página uma WebView descartável que nunca aparece. O único trabalho dela é ouvir o primeiro endereço que o popup quer: um endereço do `claude.ai` carrega na WebView principal, qualquer outro vai para `goOut`, e a descartável é destruída. Nas palavras do código, "The popup's opener sees it closed." (Quem abriu o popup o vê fechado.)

Os endereços também vêm de fora: o toque num alerta, ou um link do `claude.ai` que o Android entrega ao app. Os dois chegam como um `Intent`, na abertura ou em `onNewIntent`, já que a activity é `singleTask` e só existe uma cópia dela. `claudeIn(intent)` só mantém o endereço quando `Links.isClaude` o aceita, então outro app não consegue fazer este carregar uma página que não seja o Claude.

### Arquivos e o microfone

Quando a página pede um arquivo, a WebView chama `onShowFileChooser`. O app abre o seletor de documentos do Android (`ActivityResultContracts.OpenMultipleDocuments`) com os tipos que a página aceita, ou `*/*` quando ela não indica nenhum, e devolve à página os endereços escolhidos. Um pedido que ainda está esperando é respondido antes com `null`, para que a página nunca espere por um seletor que já sumiu.

O microfone é o único dispositivo que a página pode usar:

```kotlin
        // The microphone, for dictating to Claude; nothing else the page may ask for.
        override fun onPermissionRequest(request: PermissionRequest) {
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE !in request.resources || !Links.isClaude(request.origin.toString())) {
                request.deny()
                return
            }
            if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                request.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
            } else {
                microphone = request
                askMicrophone.launch(Manifest.permission.RECORD_AUDIO)
            }
        }
```

Duas permissões estão em jogo. A página pede à WebView, e a WebView pede ao app (`onPermissionRequest`). O próprio app precisa do `RECORD_AUDIO` do Android, que você concede uma vez, na primeira vez. Um pedido de qualquer origem que não seja `https://claude.ai`, ou de qualquer coisa que não seja áudio, é negado, e mesmo um pedido de áudio e vídeo só recebe o áudio.

### Como o app se apresenta

Toda requisição que uma WebView envia leva o seu user agent, um texto que nomeia o motor e, no Android, o marca como WebView com `; wv`. Alguns logins e verificações contra bots recusam WebViews por essa marca.

O histórico mostra que a pessoa autora tentou os dois caminhos. O commit `bfa379a` "fix: present the WebView as Chrome, and let a debug build's page be inspected" (apresentar a WebView como Chrome, e deixar inspecionar a página de um build de debug) tirou `; wv` e `Version/4.0` do user agent, com o comentário "As Chrome on Android" (como o Chrome no Android). Sete minutos depois, o `38cb33c` o desfez: "The user agent is the WebView's own again: the app does not pass itself off as Chrome to get past a sign-in's check." (O user agent volta a ser o da própria WebView: o app não se faz passar pelo Chrome para driblar a verificação de um login.) Hoje o código não toca em `userAgentString`, e a seção de segurança do README diz: "The app pretends nothing: Claude, Google, and Cloudflare see it as the Android app it is." (O app não finge nada: o Claude, o Google e a Cloudflare o veem como o app Android que ele é.) É também por isso que o login do Google não é forçado a funcionar: a resposta honesta é a mensagem do e-mail.

### Olhar por dentro: inspeção de debug e logcat

A página de uma WebView só pode ser inspecionada a partir das DevTools de um Chrome de computador se o app permitir. O app permite apenas para builds de debug:

```kotlin
        // A debug build's page can be inspected from a computer, at chrome://inspect.
        if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) WebView.setWebContentsDebuggingEnabled(true)
```

`./gradlew installDebug` instala um build de debug, então, com o celular conectado por USB, `chrome://inspect` no computador lista a página. As evidências do registro de tarefas foram reunidas assim: "through DevTools the page has narsilHostLoaded, a live narsilWatch, both style marks and the night ground rgb(15, 26, 44)" (pelas DevTools, a página tem narsilHostLoaded, um narsilWatch ativo, as duas marcas de estilo e o fundo noturno rgb(15, 26, 44)). Lembre-se do que isso significa: quem tiver o seu celular desbloqueado num computador com a depuração USB permitida pode ver a sua página do Claude.

O console da página também chega ao log do Android: `onConsoleMessage` escreve cada mensagem no logcat com a tag `NarsilWeb`, com o nível, o arquivo e a linha. `adb logcat -s NarsilWeb` as mostra, inclusive os erros `narsil: <file>` descritos abaixo.

### PageScript: um só script, em ordem

Os scripts da faixa foram escritos como content scripts de extensão, que um navegador roda em grupos e numa ordem fixa. Uma WebView não tem nada disso: ela recebe um script por registro. Então `PageScript.build` costura tudo num único script, na ordem que os scripts esperam. De `PageScript.kt` no narsil-android (MIT):

```kotlin
object PageScript {
    private val STYLES = listOf("page/skin.css", "page/band.css")
    private val AT_START = listOf("page/lib/watch.js", "page/lib/mode.js", "page/mode.js")
    private val AT_IDLE = listOf("page/lib/restore.js", "page/lib/state.js", "page/lib/live.js", "page/content.js")

    fun build(read: (String) -> String): String {
        val css = STYLES.joinToString("\n") { read(it) }
        fun run(path: String) = "run(${jsString(path)}, function () {\n${read(path)}\n})\n"
        return buildString {
            append("(() => {\n")
            append("if (window.top !== window || self.narsilHostLoaded || !self.narsilHost) return\n")
            append("self.narsilHostLoaded = true\n")
            append("const run = (name, code) => { try { code() } catch (error) { console.error('narsil: ' + name, error) } }\n")
            append("const NARSIL_CSS = ${jsString(css)}\n")
            append(read("host.js")).append('\n')
            AT_START.forEach { append(run(it)) }
            append("self.narsilWatch(adopt)\n")
            append("const idle = () => {\n")
            AT_IDLE.forEach { append(run(it)) }
            append("}\n")
            append("if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', idle, { once: true })\n")
            append("else idle()\n")
            append("})()\n")
        }
    }
```

Leia-o de cima para baixo, como a página o executa:

1. **Uma guarda.** Sai na hora num frame que não seja a janela de topo, se o script já rodou neste documento, ou se o canal do app (`narsilHost`) estiver faltando.
2. **`run`**, um invólucro que captura qualquer erro, o registra como `narsil: <file>` e segue em frente. Cada arquivo roda dentro da sua própria função, então um arquivo quebrado não consegue parar o resto.
3. **`NARSIL_CSS`**, as duas folhas de estilo juntas como um único texto JavaScript.
4. **`host.js`**, que monta a folha de estilo, a coloca na página e define `browser` (abaixo).
5. **O primeiro grupo, na hora**: o observador da página (`lib/watch.js`) e o modo claro ou escuro (`lib/mode.js`, `mode.js`). Eles precisam agir antes de a página pintar, o que o [guia 5](/pt/android/colors-and-mode/) explica.
6. **`self.narsilWatch(adopt)`**: a cada mudança que o observador vê, recoloca a folha de estilo se a página a tiver removido.
7. **O segundo grupo, depois que o documento foi analisado**: os scripts da faixa. Se o documento ainda está carregando, eles esperam `DOMContentLoaded`, perto de quando o grupo `document_idle` de uma extensão rodaria: a marcação da página já está lá para ser encontrada.

`jsString` transforma um arquivo num literal de texto JavaScript escapando barras invertidas, aspas, quebras de linha e os dois caracteres U+2028 e U+2029, que o JavaScript mais antigo tratava como quebras de linha dentro de textos. `read` é uma função passada de fora, para que os testes possam montar o script a partir de arquivos falsos. `PageScriptTest.kt` confere que cada arquivo está presente e em ordem, que o segundo grupo espera o documento, que os dois estilos entram como um único texto entre aspas e que a guarda está lá.

### No início do documento, só no `claude.ai`, só no frame de topo

`MainActivity.host()` registra o script e o canal. De `MainActivity.kt` (MIT):

```kotlin
    private fun host() {
        val origins = setOf(ORIGIN)
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) ||
            !WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)
        ) {
            Log.w(TAG, "This WebView cannot run the band: update Android System WebView")
            return
        }
        WebViewCompat.addWebMessageListener(web, "narsilHost", origins) { _, message, origin, isMainFrame, proxy ->
            if (!isMainFrame || origin.toString() != ORIGIN) return@addWebMessageListener
            val m = try {
                JSONObject(message.data ?: return@addWebMessageListener)
            } catch (_: Exception) {
                return@addWebMessageListener
            }
            when (m.optString("kind")) {
                "connect" -> {
                    reply = proxy
                    feed.start()
                }
                "disconnect" -> if (reply === proxy) {
                    reply = null
                    feed.stop()
                }
                "port" -> if (m.optJSONObject("message")?.optString("type") == "settings") openSettings()
                "settings" -> openSettings()
            }
        }
        val script = PageScript.build { path -> assets.open(path).bufferedReader().use { it.readText() } }
        WebViewCompat.addDocumentStartJavaScript(web, script, origins)
    }
```

As duas chamadas vêm do `androidx.webkit` e recebem a mesma regra de origem, `https://claude.ai`:

- **`addDocumentStartJavaScript`** roda o script em todo documento correspondente antes de qualquer script da própria página, e é isso que deixa as cores vencerem desde o primeiro quadro.
- **`addWebMessageListener`** coloca um objeto chamado `narsilHost` nos frames correspondentes. A página chama `narsilHost.postMessage(text)`; o app recebe o texto, a origem, se veio do frame principal e um proxy de resposta para responder.

As verificações vêm em camadas. A própria WebView não dá nem o script nem o `narsilHost` a nenhuma outra origem. A guarda do script sai de qualquer frame que não seja a janela de topo. E o listener descarta uma mensagem que não venha do frame principal de `https://claude.ai`, ou que não seja JSON. O README resume: "The band's scripts and the channel to the app run only on `https://claude.ai`, in the page itself and not in its frames." (Os scripts da faixa e o canal para o app só rodam em `https://claude.ai`, na própria página e não nos seus frames.)

Quando uma nova página começa a carregar (`onPageStarted`), o app esquece o seu proxy de resposta e para o feed de estado, já que a página antiga se foi.

### Servir os arquivos da Narsil a partir de `claude.ai/__narsil__/`

A faixa mostra o ícone do próprio app quando não tem um desenho da Narsil. Uma página não consegue carregar um arquivo dos assets do app diretamente, e a Content Security Policy do `claude.ai` limita de onde as imagens podem vir. O app usa o `WebViewAssetLoader` para responder às requisições para `https://claude.ai/__narsil__/` a partir dos seus próprios assets:

```kotlin
        private val files = WebViewAssetLoader.Builder()
            .setDomain("claude.ai")
            .addPathHandler("/__narsil__/", WebViewAssetLoader.AssetsPathHandler(this@MainActivity))
            .build()
```

A requisição nunca chega à rede: `shouldInterceptRequest` a responde com o asset. Para a página, o arquivo vem da sua própria origem, "where the page's own policy lets them load" (onde a própria política da página os deixa carregar), como diz o comentário da classe. Todo o resto sob o `claude.ai` passa intocado.

### `host.js`: um navegador para os scripts de página

Os scripts de página da Narsil foram escritos para uma extensão. Eles chamam `browser.runtime.getURL`, abrem uma porta com `browser.runtime.connect`, enviam `browser.runtime.sendMessage` e conferem `browser.runtime.id` para saber se a sua extensão ainda está viva. `host.js` lhes dá um objeto `browser` com exatamente essas partes, e responde a cada uma:

| Os scripts chamam              | `host.js` responde                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `runtime.id`                   | Sempre `'narsil-android'`, para que os scripts nunca se achem órfãos.                                                     |
| `runtime.getURL(path)`         | `https://claude.ai/__narsil__/page/` mais o caminho.                                                                      |
| `runtime.getManifest()`        | Só o que os scripts leem dele: um grupo cujos estilos são `skin.css` e `band.css`.                                        |
| `runtime.connect({ name })`    | Uma porta. Ela envia `connect` ao app; as mensagens do app chegam no seu `onMessage`; `postMessage` envia `port`.         |
| `runtime.sendMessage(message)` | Para `narsil-missing` (os scripts perceberam que os estilos sumiram), recoloca a folha de estilo. Sempre responde `true`. |
| `runtime.onMessage`            | Uma lista de listeners que o app nunca chama; os scripts se registram nela, e nada mais acontece.                         |

Os estilos entram como uma folha de estilo construída: `host.js` cria uma `CSSStyleSheet`, a preenche com `replaceSync(NARSIL_CSS)` e a acrescenta a `document.adoptedStyleSheets`. O comentário do arquivo dá o motivo: folhas de estilo construídas são aquelas "which the page's CSP does not govern" (que a CSP da página não governa), enquanto um elemento `<style>` acrescentado por um script poderia ser recusado. A página às vezes substitui as suas próprias folhas adotadas, então `adopt()` confere e recoloca a da Narsil a cada mudança que o observador vê.

`host.js` acrescenta uma coisa de que uma extensão não precisava. O app não tem menu de navegador de onde chegar às configurações, então um toque em qualquer ponto do desenho ou do nível da Narsil no bloco do menu lateral (`#narsil-band .narsil-head`) envia `{ kind: 'settings' }`. Ele escuta na fase de captura, para que o toque seja visto antes de a página poder detê-lo.

### O canal, mensagem por mensagem

Todas as mensagens são texto JSON.

| Direção      | Mensagem                    | O que acontece                                                                          |
| ------------ | --------------------------- | --------------------------------------------------------------------------------------- |
| Página → app | `{ kind: 'connect', name }` | O app guarda este proxy de resposta e começa a acompanhar `<topic>-estado`.             |
| Página → app | `{ kind: 'disconnect' }`    | Se for o proxy atual, o app para de acompanhar.                                         |
| Página → app | `{ kind: 'port', message }` | Só `message.type === 'settings'` faz alguma coisa: abre as configurações.               |
| Página → app | `{ kind: 'settings' }`      | Abre as configurações.                                                                  |
| App → página | `{ type: 'model', model }`  | O estado mais novo que a faixa deve mostrar ([guia 3](/pt/android/conversation-band/)). |
| App → página | `{ type: 'no-topic' }`      | Ainda não há tópico: o bloco pede que você toque e escreva um.                          |

A faixa também envia `{ type: 'awake' }` pela sua porta a cada 25 segundos, um hábito da extensão, onde isso mantinha acordado um worker de fundo adormecido. O app o ignora.

### A ponte como fronteira de segurança

Um canal entre uma página web e código nativo é uma porta, e a pergunta é sempre o que pode passar por ela. Aqui, muito pouco:

- **Para dentro do app, a página pode fazer três coisas**: pedir para começar a acompanhar o estado, pedir para parar e abrir a tela de configurações. Qualquer outra mensagem é ignorada. Nenhuma mensagem leva uma URL para abrir, um arquivo para ler ou um valor para guardar.
- **Para fora do app, a página só recebe o estado aberto**: o JSON que o mod enviou ao `-estado`, depois de decifrado. O tópico e a chave ficam no Kotlin. Eles fazem parte do endereço e da decifragem que o próprio app faz, e nunca são enviados.
- **Qualquer script no frame principal do `claude.ai` pode usar o `narsilHost`**, inclusive o próprio código do `claude.ai`, já que ele divide a página com os scripts da Narsil. O pior que ele pode fazer é ler o mesmo estado que a faixa mostra e abrir as configurações.

A direção oposta também importa. O que chega do ntfy.sh pode ter sido escrito por qualquer pessoa que conheça o seu tópico, então os scripts de página o tratam como não confiável: o texto entra com `textContent`, e um desenho só da própria pasta da Narsil no GitHub.

## Construa com o Claude

Peça ao Claude primeiro um hospedeiro mínimo: uma WebView que rode um script no início do documento numa única origem, com um canal de mensagens pelo qual o script possa falar. Depois faça-o crescer. A única ideia que ele precisa acertar é que o script e o canal só existem em `https://claude.ai`, só no frame de topo, e que o app confere isso de novo a cada mensagem.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No meu app Android (Kotlin, `androidx.webkit` 1.18), a activity principal mostra `https://claude.ai/code` numa WebView. Se o `WebViewFeature` suportar `WEB_MESSAGE_LISTENER` e `DOCUMENT_START_SCRIPT`, registre um web message listener chamado `myHost` e um script de início de documento, os dois só para a regra de origem `https://claude.ai`. Monte o script num objeto Kotlin puro a partir de arquivos de assets: uma guarda que retorna a menos que `window.top === window`, `self.myHost` exista e ele ainda não tenha rodado; cada arquivo envolvido no seu próprio `try/catch` que registra o nome do arquivo; o CSS junto num único literal de texto escapado. No listener, descarte tudo o que não venha do frame principal de `https://claude.ai` ou não seja JSON, e só aja sobre uma lista fixa de valores de `kind`. Sirva `https://claude.ai/__mine__/` a partir dos assets com o `WebViewAssetLoader`. Nunca envie nenhuma configuração à página. Acrescente testes JUnit para a ordem e o escape do montador de script.

### O que conferir na resposta do Claude

1. Tanto `addWebMessageListener` quanto `addDocumentStartJavaScript` recebem o mesmo conjunto estreito de origens, não `"*"`.
2. O listener confere `isMainFrame` e a própria origem, mesmo que a regra de origem já filtre.
3. A primeira linha do script retorna em iframes e numa segunda execução.
4. Cada arquivo roda no seu próprio `try/catch`, então um erro não para os outros.
5. O escape dos textos trata `\`, `"`, `\n`, `\r`, U+2028 e U+2029, e um teste prova isso.
6. Há uma verificação de recursos com uma linha de log clara, e o Claude ainda carrega quando ela falha.

Se uma verificação falhar, diga ao Claude o que você vê: "o script roda duas vezes dentro do frame da Cloudflare".

### Como a pessoa autora pediu

As palavras da pessoa autora estão registradas no registro de tarefas, `odd/tasks/android-app.md`. A primeira, L1, pedia uma web view que "muestre la web de claude y modifique sus estilos como lo hace esta extension" (mostre a web do Claude e mude os seus estilos como esta extensão faz). A L3 acrescentou: "recuerda que los estilos que va a inyectar seran los de la extension […]" (lembre que os estilos que ele vai injetar serão os da extensão; o nome do projeto anterior foi omitido aqui). A especificação S2 do agente transforma isso no design deste guia: "the extension's content scripts and CSS run unchanged inside the WebView, with a `browser` shim the app answers natively." (os content scripts e o CSS da extensão rodam sem mudanças dentro da WebView, com um `browser` substituto que o app responde de forma nativa.)

O resto é reconstruído a partir do histórico de commits (um nome de projeto num assunto é substituído por uma descrição entre colchetes):

- `3bcea35` (2026-11-24) "feat: build the script that hosts [the earlier extension] in a WebView, and what alerts and states keep" (montar o script que hospeda a [extensão anterior] numa WebView, e o que os alertas e os estados guardam). A sua mensagem: "host.js answers the extension's browser calls; the styles go on as a constructed style sheet." (o host.js responde às chamadas de browser da extensão; os estilos entram como uma folha de estilo construída.)
- `53c55c1` (2026-11-24) "feat: host claude.ai with [the earlier extension] in a WebView, and show Narsil's alerts from a foreground service" (hospedar o claude.ai com a [extensão anterior] numa WebView, e mostrar os alertas da Narsil a partir de um serviço em primeiro plano). Nasce a `MainActivity`.
- `bfa379a` (2026-11-24) "fix: present the WebView as Chrome, and let a debug build's page be inspected" (apresentar a WebView como Chrome, e deixar inspecionar a página de um build de debug).
- `38cb33c` (2026-11-24) "fix: say to sign in with an email when Google's or Apple's sign-in is asked for, instead of hanging" (dizer para entrar com um e-mail quando o login do Google ou da Apple for pedido, em vez de travar). Os popups e o user agent honesto.
- `9e514dd` (2026-11-24) "feat: open the settings from Narsil in the band and from the service's notification" (abrir as configurações a partir da Narsil na faixa e da notificação do serviço). A sua mensagem: "The launcher shortcut is not shown by every launcher, and the band's notice only shows without a topic." (Nem todo launcher mostra o atalho, e o aviso da faixa só aparece sem tópico.)
- `5ad4577` (2026-11-24) "refactor: make the band's scripts the app's own, and stop naming the projects it replaces" (tornar os scripts da faixa do próprio app, e parar de nomear os projetos que ele substitui). `assets/extension` virou `assets/page` e `ExtensionScript` virou `PageScript`, seguindo a L4 da pessoa autora.

## Código de referência

Esta é uma resposta correta, escrita para este guia (MIT). Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

Um hospedeiro mínimo com a mesma forma da `MainActivity`: uma origem, um script de início de documento, um canal e uma regra de links. Ele reutiliza o `Links` do app.

```kotlin
package io.github.davshn.narsil

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

class TinyHostActivity : ComponentActivity() {
    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val web = WebView(this)
        setContentView(web)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        val origins = setOf("https://claude.ai")
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) &&
            WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)
        ) {
            WebViewCompat.addWebMessageListener(web, "myHost", origins) { _, message, origin, isMainFrame, reply ->
                if (!isMainFrame || origin.toString() != "https://claude.ai") return@addWebMessageListener
                if (message.data == "hello") reply.postMessage("hi from the app")
            }
            WebViewCompat.addDocumentStartJavaScript(web, SCRIPT, origins)
        }
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (Links.isInApp(request.url.toString())) return false
                startActivity(Intent(Intent.ACTION_VIEW, request.url).addCategory(Intent.CATEGORY_BROWSABLE))
                return true
            }
        }
        web.loadUrl(Links.CLAUDE_CODE)
    }

    override fun onPause() {
        CookieManager.getInstance().flush()
        super.onPause()
    }

    private companion object {
        const val SCRIPT = """
            if (window.top === window && self.myHost && !self.myHostLoaded) {
              self.myHostLoaded = true
              myHost.addEventListener('message', (event) => {
                document.documentElement.dataset.myHost = event.data
              })
              myHost.postMessage('hello')
            }
        """
    }
}
```

Declare a activity no manifesto como a do launcher, depois abra a página em `chrome://inspect` (com `WebView.setWebContentsDebuggingEnabled(true)` num build de debug) e olhe o elemento `<html>`: ele deve trazer `data-my-host="hi from the app"`. Carregue qualquer outro site na mesma WebView e `self.myHost` será `undefined` ali. `startActivity` lança `ActivityNotFoundException` quando nenhum app consegue abrir um endereço; o `goOut` real a captura, e o seu deveria capturar também antes de você publicá-lo.

## Erros comuns e como testar

- **`"*"` como regra de origem.** O canal e o script chegariam a toda página e a todo frame que a WebView carregasse, anúncios e páginas de login inclusive. Nomeie a única origem.
- **Confiar só na regra de origem.** Frames da mesma origem também recebem o objeto. Confira `isMainFrame` no listener.
- **Um único `try` em volta de tudo.** Um único erro, digamos na faixa depois de uma atualização do Claude, também derrubaria as cores. Envolva cada arquivo.
- **Esquecer o `flush()`.** A sessão funciona até o Android matar o app em segundo plano, e então você entra de novo.
- **Popups ignorados.** Com `setSupportMultipleWindows(false)`, um botão de login que abre um popup não faz absolutamente nada. Capture-o em `onCreateWindow`.
- **Falsificar o user agent.** Isso pode passar por uma verificação hoje e falhar amanhã, e esconde o que o app é. O app desistiu disso no `38cb33c`.
- **Enviar uma configuração à página.** Qualquer script na página poderia então lê-la. Mantenha o tópico e a chave do lado do Kotlin.
- **Conceder todo pedido de permissão.** Conceda só o microfone, e só ao `claude.ai`.

Para testar no celular, instale um build de debug, abra `chrome://inspect` no computador e, no console da página, confira `self.narsilHostLoaded` (deve ser `true`), `typeof narsilHost` (`object`) e `document.adoptedStyleSheets.length` (pelo menos um). Num iframe da página, `self.narsilHostLoaded` deve ser `undefined`. Depois, `adb logcat -s NarsilWeb` mostra o console da página; uma linha que começa com `narsil:` nomeia um script que lançou um erro.

Para testar o montador de script sem um celular, execute `./gradlew testDebugUnitTest`: o `PageScriptTest` monta o script a partir de arquivos falsos e confere a ordem, o grupo que espera, as aspas e a guarda.

### Onde o código e o README diferem

- O README diz "A debug build's page can be inspected from a computer at `chrome://inspect`; its console goes to logcat with the `NarsilWeb` tag." (A página de um build de debug pode ser inspecionada a partir de um computador em `chrome://inspect`; o seu console vai para o logcat com a tag `NarsilWeb`.) No código, a inspeção está limitada aos builds de debug; o console não: `onConsoleMessage` escreve no logcat em qualquer build. Como a única instalação documentada é a `installDebug`, a diferença só aparece se você mesmo compilar um release.

## Para ir além

- O [guia 3](/pt/android/conversation-band/) acompanha o estado desde o canal do app até a faixa acima da caixa de mensagem.
- O [guia 5](/pt/android/colors-and-mode/) explica por que o primeiro grupo de scripts roda na hora e como as cores evitam um clarão.
- O [guia 7](/pt/android/encryption-and-settings/) trata das configurações que a ponte abre, e de por que o tópico e a chave ficam fora da página.
- Do lado do mod, [Alertas no celular e no relógio](/pt/mods/pet/phone-and-watch/) descreve o estado `-estado` que o canal leva.
- O código-fonte está em [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
