---
title: O que é o Narsil para Android
description: 'Um app experimental para Android que hospeda o claude.ai numa WebView com as cores, a faixa e o bloco do menu lateral da Narsil, e transforma os alertas do mod vindos do ntfy.sh em notificações.'
route: android
order: 1
updated: 2026-11-24
sources:
  - repo: android
    path: README.md
  - repo: android
    path: odd/tasks/android-app.md
  - repo: android
    path: app/src/main/AndroidManifest.xml
  - repo: android
    path: app/build.gradle.kts
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/Links.kt
  - repo: pet
    path: hooks/register.tsx
---

## O que faz

O Narsil para Android é um app de celular que junta duas coisas num só lugar: o app web do Claude, o `claude.ai`, e os alertas que o [mod Narsil](/pt/mods/pet/phone-and-watch/) envia ao seu celular. Você o abre como qualquer app. Dentro, vê o `claude.ai` de verdade, com a sua conta conectada, então pode aprovar permissões, responder perguntas, enviar arquivos e ler conversas inteiras como sempre. Por cima dele, a Narsil acrescenta os seus próprios toques:

- **As cores da Narsil.** O Claude veste a paleta de mar noturno da Narsil Skin, clara das 6:00 às 17:59 e escura no resto do dia, seja qual for a aparência que você escolheu no Claude ([guia 5](/pt/android/colors-and-mode/)).
- **A faixa.** Logo acima da caixa onde você escreve, uma faixa mostra a conversa aberta: a Narsil na pose do estado, o estado (`TRABAJANDO` (trabalhando), `TE NECESITA` (precisa de você), `TERMINADA` (terminada) ou `EN REPOSO` (em repouso)), o contexto usado, a contagem regressiva do cache e a última coisa que o Claude disse ([guia 3](/pt/android/conversation-band/)).
- **O bloco do menu lateral.** Abaixo da pesquisa no menu lateral do Claude: o nível e a experiência da Narsil, os seus limites de 5 horas e semanal, e a contagem do ntfy.sh do dia ([guia 4](/pt/android/sidebar/)).
- **Alertas.** Quando uma conversa termina, precisa de você ou falha, chega uma notificação, mesmo com o app fechado e depois de reiniciar o celular ([guia 6](/pt/android/alerts-service/)).
- **Criptografia.** Com uma chave de `/narsil movil clave`, o app abre o que o mod selou ([guia 7](/pt/android/encryption-and-settings/)).
- **Entrar uma vez só.** A sessão é mantida até o Claude encerrá-la ou você apagar os dados do app.
- **Arquivos e voz.** O botão **+** do Claude abre o seletor de arquivos do celular, e o microfone funciona para ditado.

> **Experimental.** O app depende da estrutura da página do `claude.ai` e das requisições internas dela, não de uma API pública. A faixa encontra a caixa de mensagem e o menu lateral pela marcação da página, as cores substituem as próprias variáveis de design da página, e os limites e os dados da conversa vêm de endereços que a página usa para si mesma. Uma atualização do Claude pode quebrar qualquer uma dessas partes; quando isso acontece, aquela parte deixa de aparecer, e o próprio Claude continua funcionando. Também é um projeto pessoal, instalado a partir do código-fonte com um build de debug.

O app é de código aberto sob a licença MIT e não tem vínculo com a Anthropic. A interface dele e as palavras da Narsil estão em espanhol; este caminho mantém os rótulos como aparecem, com o significado em português entre parênteses.

## Como funciona por dentro

### Por que um app com uma WebView

Não dá para acrescentar nada ao app nativo do Claude: ele roda o seu próprio código e não oferece nenhum jeito de carregar o seu. Num computador, o jeito comum de mudar uma página web é uma extensão de navegador, mas o Chrome para Android não aceita extensões. A extensão de navegador anterior que desenhava a Narsil no `claude.ai` precisava, por isso, de um navegador que aceitasse, o que é mais um app para instalar e manter conectado.

Uma WebView resolve os dois problemas. Ela é o motor web embutido do Android, o mesmo Chromium que move o Chrome, encaixado na janela de um app. O app dono da WebView decide o que roda nela: aqui, ele carrega o `claude.ai`, roda os scripts e os estilos da Narsil no início de cada página e responde a eles a partir do Kotlin. A primeira mensagem da pessoa autora, registrada no registro de tarefas, pedia exatamente isso: um app de celular completo que receba as notificações e, dentro de uma web view, mostre a web do Claude e mude os seus estilos como a extensão fazia.

Os scripts que desenham a faixa, o bloco e as cores são as mesmas ideias que a extensão tinha, e boa parte do código deles é a mesma: eles ainda falam com um objeto `browser`, como fazem os scripts de extensão. O app lhes dá um, escrito em `host.js`, e responde a cada chamada de forma nativa. O [guia 2](/pt/android/webview-host/) explica esse hospedeiro.

### As peças

Todo o código do app está num único módulo Gradle, `app`, com o pacote `io.github.davshn.narsil`:

| Arquivo                                                       | O que faz                                                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `MainActivity.kt`                                             | A WebView: configurações, cookies, arquivos, microfone, popups e para onde vai cada link.         |
| `PageScript.kt` e `assets/host.js`                            | Monta o único script que roda no início de cada página do `claude.ai`, e o "navegador" da página. |
| `assets/page/`                                                | As cores da Narsil (`skin.css`, `mode.js`) e a faixa (`content.js`, `band.css`, `lib/`).          |
| `StateFeed.kt` e `StateModel.kt`                              | Acompanham `<seu tópico>-estado` para a faixa e guardam o estado mais novo.                       |
| `AlertService.kt`, `NtfyStream.kt`, `Alert.kt`, `Notifier.kt` | Acompanham o seu tópico em segundo plano e transformam cada mensagem numa notificação.            |
| `BootReceiver.kt`                                             | Liga os alertas de novo depois de reiniciar o celular ou de uma atualização.                      |
| `Seal.kt`                                                     | Abre o que o mod selou com `/narsil movil clave`.                                                 |
| `Settings.kt` e `SettingsActivity.kt`                         | O tópico, a chave e o que o app lembra, no armazenamento privado.                                 |
| `Links.kt`                                                    | Quais endereços ficam no app.                                                                     |

Não há servidor próprio, nem Firebase, nem analytics: o módulo depende de três bibliotecas AndroidX (`core-ktx`, `webkit` e `activity`), e do JUnit e do `org.json` para os testes.

### O que ele precisa do mod Narsil

O app lê dois tópicos no [ntfy.sh](https://ntfy.sh), ambos criados pelo mod Narsil no Claude Code no seu computador:

- **O seu tópico**, como `narsil-0000000000example0`, onde o mod publica um alerta quando uma conversa termina, precisa de você ou falha.
- **`<seu tópico>-estado`** ("estado"), onde o mod publica um estado silencioso quando um turno termina e a cada pergunta: o nível da Narsil, o desenho dela no estágio dela, quanto dura um cache e a contagem do ntfy.sh das mensagens do dia.

O mod só envia os dois enquanto você escreve ao Claude pelo Remote Control, ou seja, do celular ou da web. Assim que você volta a escrever na mesa, ele para. Ele também se limita a 200 mensagens por dia, abaixo da cota gratuita do ntfy.sh. [Alertas no celular e no relógio](/pt/mods/pet/phone-and-watch/) explica o lado do mod por completo.

Sem o mod, o app continua funcionando como o Claude nas cores da Narsil, e a faixa continua mostrando o estado, o contexto, o cache e o último evento de cada conversa, e o bloco os seus limites: isso vem do próprio `claude.ai`. O que você perde é o que só o seu computador sabe: os alertas, o nível da Narsil, o estágio dela nos desenhos (o ícone do próprio app fica no lugar), a contagem do ntfy.sh e a duração real do cache (a faixa assume 60 minutos).

### Sistemas suportados

| O quê                  | Necessário                                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| Android                | 10 ou posterior (`minSdk = 29`); feito para o Android 16 (`targetSdk = 36`)                   |
| Android System WebView | Uma que consiga rodar scripts no início de uma página e falar com o app; qualquer uma recente |
| Login                  | O e-mail da sua conta do Claude; os botões do Google e da Apple não funcionam aqui            |
| iPhone                 | Não disponível                                                                                |
| Para compilá-lo        | Um computador com JDK 17 ou posterior e o Android SDK (`ANDROID_HOME`); o Gradle vem junto    |

A verificação da WebView está no código. A `MainActivity` pergunta ao `WebViewFeature` por dois recursos, `WEB_MESSAGE_LISTENER` e `DOCUMENT_START_SCRIPT`. Se faltar algum, ela registra no log "This WebView cannot run the band: update Android System WebView" (esta WebView não consegue rodar a faixa: atualize o Android System WebView) e carrega o Claude sem a Narsil. A solução é atualizar o Android System WebView pelo Google Play.

### Instalação

Não há página na loja: você compila o app a partir do repositório e o instala por USB.

1. No celular, ligue as opções de desenvolvedor e a **depuração USB**, e conecte-o ao computador.
2. No computador, clone o [narsil-android](https://github.com/davshn/narsil-android) e, na pasta dele, execute:

```bash
./gradlew installDebug
```

O Gradle se baixa sozinho (o wrapper está fixado no Gradle 9.9.2), compila um APK de debug e o instala. Para atualizar depois, faça pull do repositório e execute o mesmo comando de novo: o Android substitui o app no lugar e mantém os dados dele, então a sessão e as configurações ficam.

Um build de debug tem uma propriedade que você deve conhecer: a página dele pode ser inspecionada a partir de um computador em `chrome://inspect`, como explica o [guia 2](/pt/android/webview-host/). Isso é útil para aprender e para consertar coisas, e também é um motivo para manter a depuração USB desligada quando você não precisa dela.

### Entrar: com o seu e-mail

Abra o **Narsil** e entre **com o seu e-mail**: o da sua conta do Claude, mesmo que você tenha criado a conta com o Google. O Claude lhe envia um código ou um link, e você entra.

Os botões de login do Google e da Apple não funcionam dentro da WebView de um app. Os dois provedores se recusam a rodar ali, e abri-los no navegador do celular não ajudaria: como diz `Links.kt`, "in the phone's browser they would sign the browser in, not the app" (no navegador do celular, eles conectariam o navegador, não o app). Então, quando a página tenta ir para `accounts.google.com` ou `appleid.apple.com`, o app não vai a lugar nenhum e mostra no lugar uma mensagem:

> "Google y Apple no dejan iniciar sesión dentro de una app como esta. Escribe tu correo (el mismo de tu cuenta) y entra con el código o el enlace que te llega."

(O Google e a Apple não deixam entrar dentro de um app como este. Escreva o seu e-mail, o mesmo da sua conta, e entre com o código ou o link que chegar.)

Isso veio de uma falha real. Antes do commit `38cb33c`, o botão do Google abria um popup que a WebView descartava, e o login simplesmente travava.

Se o link de login chegar por e-mail, ele abre no seu navegador por padrão. Para que os links do `claude.ai` abram no app, vá em **Configurações → Apps → Narsil → Abrir por padrão → Adicionar link** do Android e ligue o `claude.ai`. O manifesto explica por que isso é manual: o Android "cannot verify a domain that is not ours" (não consegue verificar um domínio que não é nosso).

### Primeira configuração

1. No Claude Code no seu computador, execute `/narsil movil`. Ele liga os alertas e responde com o seu tópico.
2. Se quiser os alertas criptografados, execute também `/narsil movil clave` ("chave"). Ele responde com uma chave nova.
3. No app, abra as configurações: toque na Narsil no bloco do menu lateral (ou no aviso `Toca y escribe tu topic` (toque e escreva o seu tópico)), ou mantenha pressionado o ícone do app e escolha **Ajustes** (configurações).
4. Escreva o tópico e, se você criou uma, a chave, e toque em **Guardar y recibir avisos** (salvar e receber alertas). Permita as notificações quando o Android perguntar.
5. Toque em **Permitir en segundo plano** (permitir em segundo plano). Sem isso, o Android corta a conexão enquanto o celular dorme e os alertas chegam atrasados. Depois de permitido, o botão passa a dizer **Ya funciona en segundo plano** (já funciona em segundo plano).

De volta ao Claude, a faixa mostra a Narsil assim que o mod tiver enviado um estado. Para conferir a cadeia inteira de uma vez, execute `/narsil movil prueba` ("teste") no computador: ele envia um alerta de teste e um estado, de onde quer que você esteja escrevendo.

As respostas do próprio mod foram escritas antes de este app existir. `/narsil movil` ainda diz para instalar o app ntfy, e `/narsil movil clave` para colocar a chave em "las opciones de la extensión de Firefox" (as opções da extensão do Firefox). Com este app, você não precisa de nenhum dos dois: a chave vai nas configurações do app.

### O modelo de privacidade

O app fala com quatro lugares, cada um por um motivo:

| Quem                           | Fala com                                  | Por quê                                                                                         |
| ------------------------------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| A WebView                      | `claude.ai` e `challenges.cloudflare.com` | O próprio Claude, e a verificação da Cloudflare que pode vir antes dele. Nada mais abre dentro. |
| Os scripts da faixa, na página | `claude.ai`                               | As mesmas requisições `GET` que a página faz, com a sua sessão: conversas e limites.            |
| A página e as notificações     | `raw.githubusercontent.com`               | Os desenhos da Narsil, só da própria pasta `assets/` do narsil-pet.                             |
| O código Kotlin do app         | `ntfy.sh`                                 | O seu tópico para os alertas, e `<seu tópico>-estado` para a faixa.                             |

Três regras decorrem do código:

- **O tópico e a chave nunca chegam à página.** Eles vivem no armazenamento privado do app, e só o Kotlin lê o ntfy.sh. A página recebe o estado já aberto, nada mais. `host.js` diz isso com todas as letras: "the topic and the key never reach the page" (o tópico e a chave nunca chegam à página).
- **O ntfy.sh é um serviço público.** Sem chave, qualquer pessoa que conheça o seu tópico pode lê-lo e publicar nele, e o ntfy.sh vê tudo. Com chave, ela vê que uma mensagem passou e alguns detalhes, não o texto dela. O [guia 7](/pt/android/encryption-and-settings/) percorre o que fica oculto e o que não fica.
- **Nada do ntfy.sh é tratado como marcação.** Tudo entra na página e nas notificações como texto, e um desenho só é aceito da própria pasta da Narsil.

O app também define `android:allowBackup="false"`, então os dados dele, a sessão inclusive, não vão para os backups do Android.

## Construa com o Claude

Peça ao Claude primeiro o esqueleto: um projeto Gradle com uma activity que mostre o `claude.ai` numa WebView, decida para onde vai cada link e tenha uma tela de configurações para um tópico. A única ideia que ele precisa acertar é a fronteira: o `claude.ai`, e nada mais, abre dentro do app, e os segredos ficam no Kotlin, nunca na página.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> Crie um app Android em Kotlin (Gradle Kotlin DSL, `minSdk 29`, JDK 17, sem Compose) cuja activity principal mostre `https://claude.ai/code` numa WebView em tela cheia com JavaScript e DOM storage ligados. Mantenha só `https://claude.ai` e `https://challenges.cloudflare.com` dentro da WebView; abra qualquer outro endereço `https` no navegador do celular com `ACTION_VIEW`. Quando a página for para `accounts.google.com` ou `appleid.apple.com`, não abra nada e mostre um toast dizendo para entrar com um e-mail. Trate os popups em `onCreateWindow` com uma WebView descartável que só lê o endereço que ela quer. Grave os cookies com flush em `onPause`. Acrescente uma activity de configurações com um campo de tópico validado como `^[-_A-Za-z0-9]{1,64}$`, salvo em `SharedPreferences` privadas, e um atalho do launcher para ela. Coloque as regras de links num objeto Kotlin puro com testes JUnit, incluindo `http://claude.ai`, `https://claude.ai.evil.example/` e um texto que não seja uma URL.

### O que conferir na resposta do Claude

1. Os hosts são comparados exatamente depois de analisar o endereço, e só para `https`: `https://claude.ai.evil.example/` e `http://claude.ai` não podem contar como Claude.
2. Os endereços de login do Google e da Apple não abrem nada; eles mostram uma mensagem.
3. Os popups não abrem uma segunda janela visível: o primeiro endereço deles vai para onde qualquer link vai.
4. `CookieManager.getInstance().flush()` é chamado em `onPause`, para que a sessão sobreviva ao Android matar o app.
5. O tópico é validado antes de ser salvo, e nada secreto é escrito na página nem no código.

Se uma verificação falhar, diga ao Claude o que você vê: "o botão do Google não faz nada e a tela fica branca".

### Como a pessoa autora pediu

Este está registrado. O registro de tarefas do narsil-android, `odd/tasks/android-app.md`, cita as mensagens da pessoa autora nas entradas L1 a L3 do seu log.

A ideia, em 2026-11-23 (L1):

> "se me ocurrio crear una app movil completa, que reciba las notificaciones y que dentro en un web view muestre la web de claude y modifique sus estilos como lo hace esta extension, eso es viable?"

Em português: me ocorreu criar um app de celular completo, que receba as notificações e que, dentro de uma web view, mostre a web do Claude e mude os seus estilos como esta extensão faz; isso é viável?

O escopo, em 2026-11-24 (L2):

> "seria para reemplazar la pwa, la friccion que me dices para iniciar sesion seria igual solo una vez, no? ... (igual seria para mi uso personal)"

Em português: seria para substituir a PWA (o aplicativo web anterior para os alertas); o atrito que você menciona para entrar seria só uma vez de qualquer jeito, não? (De qualquer jeito, seria para o meu uso pessoal.) E na mesma entrada: "hazlo en un proyecto nuevo y probemos a ver que tal, el repositorio seria publico, te dejo conectado el celular para que la instales" (faça num projeto novo e vamos testar para ver como fica; o repositório seria público; deixo o celular conectado para você instalá-lo).

Da L3: "no olvides ir haciendo commits al repositorio a medida que vas trabajando el repo se va a llamar narsil-android" (não se esqueça de ir fazendo commits no repositório enquanto trabalha; o repo vai se chamar narsil-android).

A especificação transforma isso em regras: S3 "login once and the session stays (cookies flushed to disk)" (entrar uma vez e a sessão fica, com os cookies gravados em disco), e S4 "the repository is public and named `narsil-android`: no topic or key in the code; they are typed in the app's settings" (o repositório é público e se chama `narsil-android`: nenhum tópico nem chave no código; eles são digitados nas configurações do app). A última entrada do log, a L4, registra a decisão da pessoa autora de aposentar a extensão e o aplicativo web anteriores em favor deste app ("[…] los voy a deprecar en favor de esta app", vou descontinuá-los em favor deste app), e é por isso que os scripts da faixa passaram a ser do próprio app.

Os commits, todos em 2026-11-24, mostram a ordem da construção (um nome de projeto num assunto é substituído aqui por uma descrição entre colchetes):

- `9051a31` "feat: open what the mod seals, as [the earlier extension]'s seal.js does" (abrir o que o mod sela, como faz o seal.js da [extensão anterior])
- `3bcea35` "feat: build the script that hosts [the earlier extension] in a WebView, and what alerts and states keep" (montar o script que hospeda a [extensão anterior] numa WebView, e o que os alertas e os estados guardam)
- `53c55c1` "feat: host claude.ai with [the earlier extension] in a WebView, and show Narsil's alerts from a foreground service" (hospedar o claude.ai com a [extensão anterior] numa WebView, e mostrar os alertas da Narsil a partir de um serviço em primeiro plano)
- `bfa379a` "fix: present the WebView as Chrome, and let a debug build's page be inspected" (apresentar a WebView como Chrome, e deixar inspecionar a página de um build de debug)
- `38cb33c` "fix: say to sign in with an email when Google's or Apple's sign-in is asked for, instead of hanging" (dizer para entrar com um e-mail quando o login do Google ou da Apple for pedido, em vez de travar)
- `9e514dd` "feat: open the settings from Narsil in the band and from the service's notification" (abrir as configurações a partir da Narsil na faixa e da notificação do serviço)
- `5ad4577` "refactor: make the band's scripts the app's own, and stop naming the projects it replaces" (tornar os scripts da faixa do próprio app, e parar de nomear os projetos que ele substitui)

## Código de referência

Este é o `Links.kt` inteiro, de `app/src/main/java/io/github/davshn/narsil/` no [narsil-android](https://github.com/davshn/narsil-android) (MIT). Ele é curto, e toda navegação no app passa por ele: os links da WebView, os seus popups, os endereços que um alerta leva e os endereços que o Android entrega ao app.

```kotlin
package io.github.davshn.narsil

import java.net.URI

// Which addresses the app opens itself: claude.ai, and the Cloudflare check it may put before it. Everything else
// goes to the phone's browser, Google's sign-in among it, which refuses to run inside a WebView.
object Links {
    const val CLAUDE_CODE = "https://claude.ai/code"
    private val IN_APP = setOf("claude.ai", "challenges.cloudflare.com")

    private fun hostOf(url: String): String? = try {
        URI(url).takeIf { it.scheme == "https" }?.host?.lowercase()
    } catch (_: Exception) {
        null
    }

    fun isClaude(url: String?): Boolean = url != null && hostOf(url) == "claude.ai"

    fun isInApp(url: String?): Boolean = url != null && hostOf(url) in IN_APP

    // Google's and Apple's sign-ins, which refuse to run inside an app's WebView: in the phone's browser they would
    // sign the browser in, not the app, so the app says to sign in with an email instead.
    private val OUTSIDE_SIGN_IN = setOf("accounts.google.com", "appleid.apple.com")

    fun isOutsideSignIn(url: String?): Boolean = url != null && hostOf(url) in OUTSIDE_SIGN_IN
}
```

Três detalhes o tornam seguro. `hostOf` devolve `null` a menos que o esquema seja `https`, então um endereço `http` nunca é o Claude. Ele compara o host analisado exatamente, então `claude.ai.evil.example` não é `claude.ai`. E um texto que não pode ser analisado lança uma exceção dentro de `URI`, que o `try` transforma em `null`. `LinksTest.kt` confere os três.

Um pequeno teste seu, escrito para este guia (MIT), no mesmo estilo dos do app:

```kotlin
package io.github.davshn.narsil

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MyLinksTest {
    @Test
    fun onlyClaudeAndTheCheckStayInside() {
        assertTrue(Links.isInApp("https://claude.ai/code/session_example"))
        assertTrue(Links.isInApp("https://CHALLENGES.cloudflare.com/x"))
        assertFalse(Links.isInApp("https://sub.claude.ai/"))
        assertFalse(Links.isInApp("claude.ai/code"))
    }
}
```

A segunda asserção passa porque `hostOf` passa o host para minúsculas. A última vale porque um endereço sem esquema não tem esquema `https`, então não tem host para o app.

## Erros comuns e como testar

- **Tocar em Continuar com o Google.** Isso não funciona aqui. Use o e-mail da sua conta, mesmo que você a tenha criado com o Google.
- **Sem permissão de segundo plano.** Sem **Permitir en segundo plano**, os alertas podem chegar com muitos minutos de atraso enquanto o celular dorme. Alguns celulares (o README cita Infinix, Xiaomi e Huawei) também precisam que a sua própria economia de bateria deixe o Narsil rodar.
- **Esperar alertas na mesa.** O mod não envia nada enquanto a sua última mensagem veio do terminal ou do app de desktop. Escreva ao Claude pelo Remote Control, ou use `/narsil movil prueba`.
- **Um tópico copiado com um espaço ou um erro de digitação.** As configurações recusam qualquer coisa além de letras, números, `-` e `_` com "Ese topic no es válido" (esse tópico não é válido). Um tópico válido mas errado simplesmente fica em silêncio: compare-o com a resposta de `/narsil movil`.
- **Instalar a partir de um segundo computador.** Um build de debug é assinado com a chave de debug do próprio computador, e o Android recusa uma atualização assinada com outra chave. Desinstalar para contornar isso apaga a sessão e as configurações.
- **Um Android System WebView antigo.** O Claude carrega, mas sem as cores nem a faixa. Atualize-o pelo Google Play.

Para testar a lógica do app, execute os testes de JVM dele no computador:

```bash
./gradlew testDebugUnitTest
```

Eles cobrem as regras de links, o script que carrega a faixa, as regras dos alertas, o estado que a faixa guarda e a criptografia contra uma mensagem selada do jeito que o mod sela. Para testar a cadeia inteira sem tocar no seu tópico real, coloque um inventado, como `narsil-0000000000example0`, nas configurações e publique nele a partir do computador ([ntfy: publishing](https://docs.ntfy.sh/publish/)):

```bash
curl -H "Title: Narsil prueba" -d "Hola desde el ordenador" https://ntfy.sh/narsil-0000000000example0
```

Uma notificação deve chegar em um ou dois segundos. Depois, escreva de novo o seu tópico real.

### Onde o código e o README diferem

- O README não indica nenhum jeito de parar os alertas no app, e o código não tem nenhum: `AlertService.stop` existe, mas nada o chama, e as configurações recusam um tópico vazio. Para pará-los, execute `/narsil movil off` no computador, ou desligue as notificações do app nas configurações do Android.
- O README diz que você não precisa mais do app ntfy. Isso vale para o app; a resposta de `/narsil movil` do mod ainda diz para instalá-lo (veja Primeira configuração).

## Para ir além

- O [guia 2](/pt/android/webview-host/) abre o hospedeiro da WebView: como os scripts são montados e como a página fala com o app.
- O [guia 6](/pt/android/alerts-service/) acompanha um alerta do ntfy.sh até a área de notificações.
- O [guia 7](/pt/android/encryption-and-settings/) explica a chave, as configurações e o que quem lê o seu tópico ainda consegue ver.
- O lado do mod está em [Alertas no celular e no relógio](/pt/mods/pet/phone-and-watch/). O mesmo estado `-estado` também alimenta o [Narsil Watch](/pt/watch/what-it-is/).
- O código-fonte está em [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
