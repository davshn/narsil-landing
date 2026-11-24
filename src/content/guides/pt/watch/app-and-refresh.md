---
title: O app e a atualização
description: 'O app do relógio com cada conversa, os dois limites e o nível da Narsil; configurar o tópico e a chave no relógio ou do computador; a atualização de 15 minutos com WorkManager, os redesenhos e a CI.'
route: watch
order: 5
updated: 2026-11-24
sources:
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/presentation/MainActivity.kt
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/sync/Refresh.kt
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/NarsilApplication.kt
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/domain/Display.kt
  - repo: watch
    path: .github/workflows/ci.yml
  - repo: watch
    path: app/src/test/kotlin/tech/davshn/narsilwatch/domain/DisplayTest.kt
  - repo: watch
    path: README.md
---

## O que faz

O tile e a complicação são para um relance. O app, chamado **Narsil** na lista de apps do relógio, é para quando você quer o quadro completo. Ele é uma única lista rolável:

1. **A Narsil no topo**, na pose da sua conversa mais importante, com o nome e o nível dela, como `⭐ Nivel 3 · 40/300 XP` (nível 3, 40 de 300 pontos de experiência).
2. **Uma nota**, só quando algo está errado: ainda não há estado, ou há um estado selado que o relógio não consegue abrir.
3. **`Límites de Claude`** (limites do Claude): uma linha por limite, `5 horas` e `Semana` (semana), cada um com o seu percentual, uma barra colorida e quando reinicia, como `reinicia en 2 h 05 min` (reinicia em 2 h 05 min).
4. **`Conversaciones`** (conversas): cada conversa aberta que o mod enviou, a mais importante primeiro, cada uma com um ponto colorido, o seu título e o seu estado, como `TE NECESITA` (precisa de você). Sem nenhuma, o cabeçalho diz `Sin conversaciones` (sem conversas).
5. **A idade da leitura**, como `hace 12 min` (há 12 minutos).
6. **Dois botões**: `Actualizar` (atualizar), que diz `Leyendo…` (lendo) enquanto trabalha, e `Configurar`.

Por trás das telas, um job em segundo plano pede ao ntfy.sh um novo estado a cada 15 minutos e redesenha o tile e a complicação. Este guia cobre os dois, e a CI e os testes do projeto.

> **Experimental.** O app só mostra o que o mod publicou por último, e o mod só publica enquanto você trabalha longe do computador, dentro da margem diária gratuita do ntfy.sh. A atualização em segundo plano roda no máximo a cada 15 minutos, o intervalo mais curto do WorkManager. O app é instalado como build de depuração por `adb`, e o tópico e a chave são configurados à mão.

## Como funciona por dentro

### Uma activity, escrita com Compose para Wear OS

`presentation/MainActivity.kt` contém o app inteiro: uma `ComponentActivity` e um punhado de funções composable. Ele usa Compose para Wear OS com Material 3: `AppScaffold`, `ScreenScaffold` e uma `ScalingLazyColumn`, a lista que encolhe e esmaece os itens perto das bordas da tela redonda.

As cores são um `ColorScheme` do Material 3 construído a partir da `Palette` de `domain/Display.kt`: o fundo azul-escuro, o texto claro, o cinza apagado, a trilha e o destaque violeta. Assim, o app, o tile e a complicação compartilham um único conjunto de cores.

`onCreate` faz três coisas, nesta ordem:

```kotlin
override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val repo = StatusRepository(this)
    setupFrom(intent, repo)
    setContent {
        MaterialTheme(colorScheme = NarsilColors) {
            AppScaffold { NarsilScreen(repo) }
        }
    }
}
```

Esse trecho e os outros desta seção são de `MainActivity.kt` do narsil-watch (GPL v3). `setupFrom` lê um tópico e uma chave enviados do computador, se houver (abaixo). Depois a tela é desenhada.

### Primeiro a configuração, ou a lista

`NarsilScreen` guarda o seu estado em alguns valores `remember`: se a configuração está aparecendo, o estado guardado, a imagem, a nota atual e se uma atualização está em andamento. A primeira linha decide o que você vê:

```kotlin
var isSetup by remember { mutableStateOf(!repo.isConfigured) }
```

`isConfigured` é verdadeiro assim que um tópico é salvo. Então, na primeira vez que você abre o app, ele mostra **Configurar**, e em todas as vezes seguintes mostra a lista.

Um `LaunchedEffect(isSetup)` roda `refresh()` toda vez que a lista aparece: quando você abre o app, e logo depois que você salva a configuração. Essa é a "atualização ao abrir". Ela chama o repositório diretamente, no escopo de corrotinas da tela:

```kotlin
fun refresh() {
    isLoading = true
    scope.launch {
        val result = repo.refresh()
        problem = when (result) {
            is StatusResult.Ok -> null
            StatusResult.NeedsKey -> "El estado va sellado: falta la clave o no es la de /narsil movil clave."
            StatusResult.Empty -> "Aún no hay estado: Narsil lo publica cuando escribes lejos del PC."
        }
        state = repo.cached()
        art = repo.art()
        isLoading = false
        Refresh.redraw(repo.appContext)
    }
}
```

O que cada resultado significa na tela:

- **`Ok`**: nenhuma nota.
- **`NeedsKey`**: `El estado va sellado: falta la clave o no es la de /narsil movil clave.` (O estado está selado: falta a chave ou ela não é a do /narsil movil clave.)
- **`Empty`**: `Aún no hay estado: Narsil lo publica cuando escribes lejos del PC.` (Ainda não há estado: a Narsil o publica quando você escreve longe do PC.)

Depois de qualquer resultado, a tela recarrega o estado guardado e a imagem, e chama `Refresh.redraw`, para que o tile e a complicação alcancem o que o app acabou de ler. O [guia 2](/pt/watch/reading-the-state/) explica por que um erro de rede dá `Ok` com o estado guardado: estar offline não é um erro que o app mostre.

`Empty` pode aparecer acima de um estado. Se o ntfy.sh não guarda mais nenhuma mensagem (um comentário no narsil-pet diz que ele "keeps a message 12 h", guarda uma mensagem por 12 h), a consulta volta vazia, mas o relógio ainda tem a sua cópia guardada. Você vê as duas coisas: o estado antigo, e a nota de que não há nada novo.

### Os limites, com "reinicia en"

`LimitRow` desenha um limite: o rótulo à esquerda, o percentual à direita na cor do limite (`62 %`), uma barra de 6 dp com a parte usada nessa cor sobre a trilha, e, abaixo, quando ele reinicia. A cor é `parseColor(limit.color)`, a cor que o computador enviou ([guia 3](/pt/watch/tile/)).

O texto do reinício é `resetLabel` de `domain/Display.kt` (GPL v3):

```kotlin
fun resetLabel(resetsAt: Long?, nowSeconds: Long): String {
    if (resetsAt == null) return ""
    if (resetsAt <= nowSeconds) return "reiniciado"
    val minutes = (resetsAt - nowSeconds) / 60
    return when {
        minutes < 60 -> "reinicia en $minutes min"
        minutes < 24 * 60 -> "reinicia en ${minutes / 60} h ${(minutes % 60).toString().padStart(2, '0')} min"
        else -> "reinicia en ${minutes / (24 * 60)} d ${(minutes % (24 * 60)) / 60} h"
    }
}
```

- **Sem hora de reinício** (`null`, o Claude não disse): nenhuma linha. A linha do limite a esconde quando o texto está vazio.
- **Dentro da hora**: `reinicia en 45 min`.
- **Dentro do dia**: `reinicia en 2 h 05 min`, com os minutos completados a dois dígitos.
- **Mais adiante**: `reinicia en 3 d 4 h`, a forma que um limite semanal costuma ter.
- **Já passou**: `reiniciado`.

Esse último caso é a linha mais útil do app. O percentual acima dela vem do último estado, que pode ter horas. Se a hora do reinício já passou, a janela recomeçou, e o percentual mostrado já não é verdadeiro. `reiniciado` avisa isso. O teste "says when a limit resets" (diz quando um limite reinicia) em `DisplayTest.kt` confere os cinco casos.

### As conversas, com os seus estados

`SessionRow` desenha uma conversa como uma linha arredondada: um ponto de 8 dp na cor do estado, o título numa linha (cortado com reticências se for longo), e o rótulo do estado abaixo, na mesma cor, em negrito. As cores são `statusColor` de `Display.kt`: azul para `TRABAJANDO` (trabalhando), cinza para `PARADA` (parada), amarelo para `TE NECESITA` (precisa de você), verde para `TERMINADA` (terminada) e vermelho para `ERROR`.

As linhas vêm na ordem em que o mod as enviou, que é a ordenação do mod: primeiro os erros, depois o que precisa de você, o que trabalha, o que terminou e o que está parado ([guia 2](/pt/watch/reading-the-state/)). No máximo 8, com títulos de no máximo 40 caracteres, tal como `watchSessions` em `hooks/phone.ts` do narsil-pet os corta. O app não acrescenta nenhuma ordem própria, então sempre concorda com a faixa no seu computador.

### O nível da Narsil

`NarsilHeader` mostra a imagem (48 por 80 dp), o nome **Narsil** em negrito e o texto `xp` do estado. A imagem é a que o repositório baixou do GitHub do narsil-pet, decodificada com `BitmapFactory`; se ainda não houver nenhuma, ou se ela não decodificar, o desenho `narsil_preview` incluído no app. O texto `xp` é escrito pelo mod, então o nível, a experiência e as estrelas são exatamente os do computador.

### Configurar: a configuração no relógio

`SetupScreen` tem dois campos e um botão:

- **`El tema de /narsil movil`** (o tópico do /narsil movil), com a dica `narsil-…`.
- **`La clave, si usas /narsil movil clave`** (a chave, se você usa /narsil movil clave), com a dica `opcional`.
- **`Guardar`** (salvar), ativado só quando o tópico não está em branco.

Os campos são `BasicTextField`s do Compose, de uma linha cada, preenchidos com o que já está salvo. `Guardar` armazena os dois por meio do repositório, que remove os espaços das pontas, e volta à lista, que se atualiza. Para remover a chave, esvazie o campo e salve.

A configuração não confere mais nada. Um tópico com um erro de digitação é salvo sem problema, e a lista então diz `Aún no hay estado`. Um engano, porém, é perdoado: o repositório só acrescenta `-estado` se o tópico ainda não terminar com ele ([guia 2](/pt/watch/reading-the-state/)), então colar o tópico de estado por engano ainda funciona.

Digitar uma chave de 43 caracteres num teclado de relógio é lento. É por isso que existe uma segunda forma.

### Configurar o tópico e a chave a partir do computador

`setupFrom` lê dois extras do intent que iniciou a activity:

```kotlin
// Setup from the PC, without typing on the watch:
// adb shell am start -n tech.davshn.narsilwatch/.presentation.MainActivity --es topic narsil-... --es key ...
private fun setupFrom(intent: Intent?, repo: StatusRepository) {
    val topic = intent?.getStringExtra("topic") ?: return
    repo.topic = topic
    intent.getStringExtra("key")?.let { repo.key = it }
    Refresh.now(this)
}
```

Então, com o relógio conectado pelo `adb` sem fio ([guia 1](/pt/watch/what-it-is/)), você pode enviar os dois num único comando. Com valores inventados:

```bash
adb shell am start -n tech.davshn.narsilwatch/.presentation.MainActivity --es topic narsil-0000000000example0 --es key example-key-not-real
```

`am start -n` inicia a activity indicada, e cada `--es name value` acrescenta um extra de string. O que o código faz com eles:

- **Sem o extra `topic`, nada acontece.** A função retorna na hora, então uma abertura normal pela lista de apps não muda nada.
- **`topic` sem `key`** salva o tópico e deixa a chave salva como estava.
- **`--es key ""`** salva uma chave vazia, o que a remove.
- **Depois, `Refresh.now`** enfileira uma atualização em segundo plano, e o tile e a complicação se redesenham quando ela termina.

Como `setupFrom` só roda em `onCreate`, e a activity não trata novos intents, feche o app no relógio antes de enviar o comando. Senão, o Android pode trazer o app aberto para a frente sem ler os extras.

Duas observações sobre os segredos:

- **Onde eles vão parar.** No relógio, nas preferências privadas do app ([guia 2](/pt/watch/reading-the-state/)). No computador, o comando, chave incluída, fica no histórico do seu shell. Apague essa linha se outras pessoas usam a máquina.
- **O que eles permitem e como trocá-los.** O tópico permite a qualquer pessoa ler e publicar no seu tópico do ntfy; a chave abre as mensagens seladas. `/narsil movil nuevo` cria um novo tópico, e `/narsil movil clave` uma nova chave; envie os novos com o mesmo comando.

A activity é exportada, como toda activity de inicialização precisa ser, para que o sistema possa iniciá-la. O mesmo vale para qualquer app no relógio: qualquer coisa que possa iniciar activities pode iniciar esta com um extra `topic`.

### A atualização: sync/Refresh.kt

Três funções e um worker. De `sync/Refresh.kt` do narsil-watch (GPL v3):

```kotlin
// Every 15 minutes (WorkManager's shortest), the watch asks ntfy.sh for the
// state and redraws the tile and the complication.
class RefreshWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        StatusRepository(applicationContext).refresh()
        Refresh.redraw(applicationContext)
        return Result.success()
    }
}

object Refresh {
    private const val PERIODIC = "narsil-refresh"
    private const val NOW = "narsil-refresh-now"

    private val online = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

    fun schedule(context: Context) {
        val work = PeriodicWorkRequestBuilder<RefreshWorker>(15, TimeUnit.MINUTES).setConstraints(online).build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP, work)
    }

    fun now(context: Context) {
        val work = OneTimeWorkRequestBuilder<RefreshWorker>().setConstraints(online).build()
        WorkManager.getInstance(context).enqueueUniqueWork(NOW, ExistingWorkPolicy.KEEP, work)
    }
```

Lendo-o:

- **`RefreshWorker`** busca o estado ([guia 2](/pt/watch/reading-the-state/)), depois pede ao tile e à complicação que se redesenhem (o [guia 4](/pt/watch/complication/) mostra `redraw`). Ele é um `CoroutineWorker`, então `refresh()`, uma função `suspend`, roda dentro dele com naturalidade.
- **Ele sempre informa sucesso.** Uma busca que falhou não é repetida com o backoff do WorkManager; o próximo período simplesmente tenta de novo. O repositório já guarda o último estado bom, então não há nada a recuperar.
- **`online`**: os dois tipos de trabalho esperam uma conexão de rede. Offline, o WorkManager segura o job até o relógio estar conectado, em vez de rodá-lo para falhar.
- **`schedule`**: um job periódico a cada 15 minutos, a repetição mais curta que o WorkManager permite. Ele é único pelo nome, `narsil-refresh`, com a política `KEEP`: se já houver um agendado, o novo pedido é descartado. Então chamar `schedule` a cada início nunca empilha jobs nem reinicia o temporizador.
- **`now`**: uma atualização o quanto antes, única como `narsil-refresh-now`, também com `KEEP`. Muitas chamadas seguidas, como deslizar até o tile várias vezes, enfileiram só uma.

### NarsilApplication: onde o agendamento começa

O arquivo inteiro, sem o package e os imports, de `NarsilApplication.kt` (GPL v3):

```kotlin
class NarsilApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        Refresh.schedule(this)
    }
}
```

O manifesto o indica como a classe da aplicação (`android:name=".NarsilApplication"`). `Application.onCreate` roda toda vez que o processo do app começa, por qualquer motivo: abrir o app, o sistema se ligando ao tile, ou pedindo dados à complicação. Então o job periódico é agendado assim que qualquer parte do app roda, e, por causa do `KEEP`, agendado uma só vez.

### O que roda quando

Juntando as peças:

| Momento                                                          | O que acontece                                                                            |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Qualquer parte do app começa                                     | `NarsilApplication` agenda o job de 15 minutos, uma vez.                                  |
| A cada 15 minutos, com rede                                      | `RefreshWorker` busca, guarda e redesenha o tile e a complicação.                         |
| Você abre o app (com tópico definido)                            | A tela busca diretamente, mostra o resultado e redesenha os dois.                         |
| Você toca em `Actualizar`                                        | O mesmo que abrir.                                                                        |
| Você salva em `Configurar`                                       | A lista aparece e busca.                                                                  |
| Você envia o tópico com `adb shell am start`                     | `Refresh.now` enfileira uma atualização; a tela também busca quando aparece.              |
| O tile é desenhado e a última verificação tem mais de 15 minutos | `Refresh.now` enfileira uma atualização; enquanto isso, o tile desenha o estado guardado. |
| O horário de 900 segundos da complicação, do sistema             | A complicação responde a partir do estado guardado, sem buscar.                           |

Todo caminho termina do mesmo jeito: buscar, guardar, depois redesenhar. E nenhuma superfície espera pela rede para desenhar.

### A CI e os testes unitários

`.github/workflows/ci.yml` roda a cada push para `main` e a cada pull request. Um job, em `ubuntu-latest`:

1. `actions/checkout@v4`.
2. `actions/setup-java@v4` com Temurin, Java 17.
3. `gradle/actions/setup-gradle@v4`.
4. `./gradlew :app:testDebugUnitTest :app:assembleDebug --console=plain`.

Então toda mudança precisa passar nos testes unitários e compilar um APK de depuração. Não há etapa de lint, nem build de release, nem teste em aparelho. O wrapper do Gradle fixa o Gradle 9.9.2 com um `distributionSha256Sum`, para que o Gradle baixado seja conferido antes de rodar, e `gradle.properties` liga o cache de build e o cache de configuração.

Os testes unitários são JUnit 4 simples, na JVM do computador, sem aparelho Android. Três arquivos, treze testes:

- **`domain/DisplayTest.kt`** (5): "counts the conversations that need you" (conta as conversas que precisam de você), "says how old the state is" (diz a idade do estado), "says when a limit resets" (diz quando um limite reinicia), "colors a status as Narsil does" (colore um estado como a Narsil faz), "reads a level color, and falls back to dim on noise" (lê uma cor de nível e recorre ao apagado diante de ruído).
- **`data/StatusParserTest.kt`** (4): ler um estado simples, ler um estado antigo sem `limits` nem `sessions`, um estado selado que precisa da chave, e um tópico vazio ou com ruído.
- **`data/SealTest.kt`** (4): abrir um vetor selado pelo próprio `seal.ts` do narsil-pet, recusar outra chave, recusar uma mensagem adulterada, recusar o que não está selado.

Eles podem rodar sem aparelho porque a lógica foi mantida fora das classes do Android: `Display.kt`, `NarsilState.kt`, `StatusParser.kt` e `Seal.kt` usam só Kotlin, kotlinx.serialization e a biblioteca padrão do Java. As telas, o tile, a complicação e a atualização não são testados automaticamente.

## Construa com o Claude

Peça ao Claude a lista do app, a sua configuração e a atualização em segundo plano juntas, já que elas compartilham o repositório. As ideias que ele precisa acertar são que toda atualização termina redesenhando as outras superfícies, e que o agendamento é idempotente.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No meu app para Wear OS `my-watch` (Compose para Wear OS, Material 3), escreva `presentation/MainActivity.kt`: se nenhum tópico estiver salvo, mostre uma tela de configuração com um campo de tópico, um campo de chave opcional e um botão Salvar ativado só com um tópico; senão, uma `ScalingLazyColumn` com a imagem e o nível, os limites (rótulo, percentual na cor do limite, uma barra e uma linha de reinício vinda de uma função pura `resetLabel(resetsAt, now)` que diz "reiniciado" quando já passou), as sessões na ordem recebida (um ponto na cor do status, título, rótulo), a idade, e os botões Atualizar e Configurar. Atualize quando a lista aparecer e com o botão, mostre uma nota para "ainda sem estado" e "precisa da chave", e depois redesenhe o tile e a complicação. Em `onCreate`, leia os extras de string opcionais `topic` e `key` para que `adb shell am start ... --es topic ... --es key ...` os configure, e depois enfileire uma atualização. Escreva `sync/Refresh.kt`: um `CoroutineWorker` que atualiza e redesenha; `schedule` como trabalho periódico único a cada 15 minutos com `KEEP` e uma restrição de rede conectada; `now` como trabalho único de execução única com `KEEP`; `redraw` usando `TileService.getUpdater` e `ComplicationDataSourceUpdateRequester.requestUpdateAll()`. Chame `schedule` a partir de uma subclasse de `Application`. Testes JUnit para `resetLabel`, e um workflow de CI que rode `./gradlew :app:testDebugUnitTest :app:assembleDebug`.

### O que conferir na resposta do Claude

1. A tela de configuração só aparece quando nenhum tópico está salvo, e a lista se atualiza quando aparece.
2. Cada atualização, no app e no worker, termina com um redesenho do tile e da complicação.
3. O trabalho periódico é único pelo nome, com `KEEP`, e exige uma rede conectada.
4. A atualização de execução única também é única, então chamadas repetidas enfileiram um só job.
5. `resetLabel` devolve "reiniciado" para um reinício que já passou e nada para um que falta, e tem um teste para cada caso.
6. Os extras do intent são opcionais: uma abertura normal não muda nada, e a falta do extra `key` mantém a chave salva.
7. Nada registra o tópico ou a chave em log.

Se uma verificação falhar, diga ao Claude o que você vê: "depois que eu toco em Actualizar o app mostra o novo estado, mas o tile continua mostrando o antigo", o que significa que falta o redesenho na atualização do app.

### Como a pessoa autora pediu

Não existe pedido registrado para o app nem para a atualização. Esta é uma reconstrução a partir do histórico de commits:

- narsil-watch `b47ca7a` (2026-11-23) "feat: Narsil on Wear OS with Claude limits and open conversations" (a Narsil no Wear OS com os limites do Claude e as conversas abertas). O app, a atualização, a classe da aplicação, o workflow de CI e os testes chegam todos neste único commit. A sua mensagem termina a lista de superfícies com "an app listing every open conversation" (um app que lista cada conversa aberta).
- narsil-watch `04390c8` (2026-11-24) "docs: align README with the Narsil family" (alinhar o README com a família Narsil). O primeiro README já tinha as duas formas de definir o tópico e a chave, em "Set up". Este commit a renomeia para "Settings", acrescenta uma seção Security que diz onde o tópico e a chave são guardados, e a linha sobre atualizar: "pull the latest version of this repository and run the same command again: the settings are kept." (baixe a versão mais recente deste repositório e rode o mesmo comando de novo: as configurações são mantidas.)

O comentário acima de `setupFrom` guarda no próprio código o motivo do caminho por `adb`: "Setup from the PC, without typing on the watch" (configuração a partir do PC, sem digitar no relógio).

## Código de referência

Esta é uma resposta correta, escrita para este guia. Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

A atualização e o seu início, escritos para este guia e adaptados de `sync/Refresh.kt` e `NarsilApplication.kt` do [narsil-watch](https://github.com/davshn/narsil-watch) (GPL v3). Eles usam as mesmas chamadas de WorkManager, Tiles e complicações, e supõem o seu próprio `StatusRepository`, o seu serviço de tile e o seu serviço de complicação:

```kotlin
package com.example.mywatch.sync

import android.app.Application
import android.content.ComponentName
import android.content.Context
import androidx.wear.tiles.TileService
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceUpdateRequester
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit
import com.example.mywatch.complication.MyComplicationService
import com.example.mywatch.data.StatusRepository
import com.example.mywatch.tile.MyTileService

class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        StatusRepository(applicationContext).refresh()
        Sync.redraw(applicationContext)
        return Result.success()
    }
}

object Sync {
    private val online = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

    fun schedule(context: Context) {
        val work = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES).setConstraints(online).build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork("my-sync", ExistingPeriodicWorkPolicy.KEEP, work)
    }

    fun now(context: Context) {
        val work = OneTimeWorkRequestBuilder<SyncWorker>().setConstraints(online).build()
        WorkManager.getInstance(context).enqueueUniqueWork("my-sync-now", ExistingWorkPolicy.KEEP, work)
    }

    fun redraw(context: Context) {
        TileService.getUpdater(context).requestUpdate(MyTileService::class.java)
        ComplicationDataSourceUpdateRequester
            .create(context, ComponentName(context, MyComplicationService::class.java))
            .requestUpdateAll()
    }
}

class MyWatchApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        Sync.schedule(this)
    }
}
```

Indique a classe da aplicação no `<application android:name=...>` do manifesto, como o [guia 1](/pt/watch/what-it-is/) mostra. Na sua activity, leia os extras de configuração antes de desenhar, também escrito para este guia:

```kotlin
private fun setupFrom(intent: Intent?, repo: StatusRepository) {
    val topic = intent?.getStringExtra("topic") ?: return
    repo.topic = topic
    intent.getStringExtra("key")?.let { repo.key = it }
    Sync.now(this)
}
```

## Erros comuns e como testar

- **Atualizar sem redesenhar.** O app mostra o novo estado e o tile fica com o antigo. Termine toda atualização com `redraw`.
- **Agendar com `REPLACE`.** Cada início de processo cancelaria o job agendado e enfileiraria um novo. `KEEP` deixa o agendamento existente em paz, então iniciar com frequência não muda nada.
- **Pedir menos de 15 minutos.** O trabalho periódico do WorkManager não se repete mais rápido, como diz o comentário do código.
- **Sem restrição de rede.** O job roda offline só para falhar, e a próxima chance fica a 15 minutos de distância.
- **Enviar o comando `adb` a um app aberto.** Os extras só são lidos em `onCreate`. Feche o app antes.
- **Confiar no percentual depois de um reinício.** Se a linha diz `reiniciado`, o percentual acima dela é de antes do reinício.
- **Uma chave real num terminal compartilhado.** Ela fica no histórico do shell. Use a tela de configuração, ou apague essa linha.
- **Lógica dentro de composables.** Os textos e as cores em `Display.kt` são testados na JVM; dentro de um composable, só poderiam ser testados num aparelho.

Para rodar as mesmas verificações da CI, a partir do repositório:

```bash
./gradlew :app:testDebugUnitTest :app:assembleDebug
```

No relógio:

1. Abra o app sem tópico: ele mostra `Configurar`.
2. Envie o tópico do computador com o comando `adb shell am start` acima, usando o seu próprio tópico num terminal privado. Abra o app: a lista aparece e se atualiza.
3. Execute `/narsil movil prueba` no Claude Code e toque em `Actualizar`. A idade diz `ahora`, e o tile e a complicação mudam na hora.
4. Defina uma chave errada em `Configurar`. Com um estado selado, a nota diz que o estado está selado. Coloque a chave certa de volta e ele abre de novo.
5. Para ver o job periódico, conecte o relógio e espere: a idade no tile se renova depois da próxima atualização, se o mod tiver publicado desde então.

### Onde o código e o README diferem

- O README diz que o relógio lê o estado "every 15 minutes, and whenever you open the app or the tile" (a cada 15 minutos, e sempre que você abre o app ou o tile). Abrir o app sempre atualiza. O tile só enfileira uma atualização quando a última verificação tem mais de 15 minutos.
- A seção Settings do README mostra `--es topic narsil-... --es key ...` juntos. O código trata a chave como opcional: deixe `--es key` de fora e a chave salva fica; passe-a vazia e a chave é removida. O README não diz isso.
- A seção Development do README lista os comandos de teste e de build, mas não a CI. O workflow roda exatamente essas duas tarefas.

## Para ir além

- Leia `presentation/`, `sync/` e `.github/workflows/ci.yml` do [narsil-watch](https://github.com/davshn/narsil-watch).
- Trate também `onNewIntent`, para que a configuração por `adb` funcione com o app aberto.
- Valide o tópico na tela de configuração. Os tópicos do mod são `narsil-` seguido de 20 caracteres hexadecimais, como `newTopic` em `hooks/phone.ts` do narsil-pet os cria.
- Acrescente um teste para os extras de configuração com um repositório falso, ou mova-os para uma função pura que devolva o que salvar.
- O lado do mod do tópico e da chave: [Alertas no celular e no relógio](/pt/mods/pet/phone-and-watch/). O caminho inteiro desde o início: [O que é o Narsil Watch](/pt/watch/what-it-is/), [Ler o estado da Narsil](/pt/watch/reading-the-state/), [O tile](/pt/watch/tile/) e [A complicação](/pt/watch/complication/).
