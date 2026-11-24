---
title: Alertas a partir de um serviço em primeiro plano
description: 'Como o AlertService mantém uma conexão aberta com o ntfy.sh, recupera os alertas perdidos com since, e como Alert e Notifier transformam cada mensagem numa notificação no canal certo.'
route: android
order: 6
updated: 2026-11-24
sources:
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/AlertService.kt
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/NtfyStream.kt
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/Alert.kt
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/Notifier.kt
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/BootReceiver.kt
  - repo: android
    path: app/src/test/java/io/github/davshn/narsil/AlertTest.kt
  - repo: pet
    path: hooks/phone.ts
---

## O que faz

Enquanto você escreve para o Claude Code pelo Remote Control, o mod Narsil publica no seu tópico do ntfy.sh quando uma conversa termina, precisa de você ou falha. O app mostra cada um desses alertas como uma notificação, com a Narsil no estágio atual dela e na pose do alerta:

| Alerta                  | Como chega                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Uma pergunta ou um erro | No canal **Te necesita** (precisa de você): aparece por cima do que você está fazendo e vibra num padrão longo próprio. |
| Um turno terminado      | No canal **Terminó** (terminou): uma vibração curta, e ele aparece discretamente na área de notificações.               |

- **Um toque** abre o Claude Code dentro do app. Até lá, todo alerta fica na área de notificações.
- **Os links do alerta** aparecem como botões, dois no máximo. Os do `claude.ai` abrem no app, qualquer outro no seu navegador. O mod envia um, `Abrir Claude` (abrir o Claude).
- **O app pode ficar fechado.** Uma conexão com o ntfy.sh fica aberta num serviço em primeiro plano, com uma notificação discreta própria: "Narsil escucha tus avisos" (a Narsil escuta os seus alertas) e, abaixo, `Topic <your topic> · toca para cambiarlo` (toque para mudá-lo). Um toque nela abre as configurações.
- **Depois de reiniciar** o celular, ou de uma atualização do app, o serviço volta a funcionar sozinho.
- **Os alertas perdidos chegam tarde, mas chegam.** Se o celular estava desligado ou sem rede, os alertas enviados nesse meio-tempo chegam quando ele volta, desde que o ntfy.sh ainda os guarde (12 horas, diz o código).

Você não precisa mais do app ntfy.

> **Experimental.** O app como um todo depende da estrutura da página do `claude.ai` e das suas requisições internas, que uma atualização do Claude pode quebrar. Esta parte não toca no `claude.ai`, mas tem pontos frágeis próprios: ela depende do serviço público gratuito do ntfy.sh e de o Android deixar um app manter uma conexão aberta o dia inteiro. Alguns fabricantes de celular fecham os apps em segundo plano mesmo assim, e então os alertas chegam atrasados ou param até você abrir o app.

## Como funciona por dentro

### O caminho de um alerta

```text
Narsil mod on the computer
  └─ POST https://ntfy.sh  (your topic)
       └─ NtfyStream: GET https://ntfy.sh/<topic>/json?since=<last id>
            └─ AlertService.take
                 ├─ Seal.unseal      (opens it with the key, if sealed)
                 ├─ Alert.of         (the rules: channel, tag, buttons, picture, tap)
                 ├─ Notifier.show    (the notification)
                 └─ settings.lastAlertId = its id
```

Cada passo é um arquivo pequeno com uma única função. `NtfyStream` conhece o ntfy.sh, `Alert` conhece as regras e não tem código Android (então `AlertTest.kt` o testa no computador), e `Notifier` conhece as notificações do Android.

### Um serviço em primeiro plano, e por que `specialUse`

O Android para o trabalho em segundo plano que ele não consegue ver. Para manter uma conexão aberta por horas, um app precisa rodar um **serviço em primeiro plano**: um serviço que mostra uma notificação enquanto roda, para que você sempre saiba que ele está lá. Desde o Android 14, cada serviço em primeiro plano também declara um tipo que diz para que ele serve.

O tipo óbvio, `dataSync`, não serve: a decisão no registro de tarefas registra que "Android 15 caps `dataSync` at 6 h a day" (o Android 15 limita o `dataSync` a 6 h por dia). Em vez disso, o app declara `specialUse`, com o motivo que o Android pede no manifesto:

<!-- prettier-ignore -->
```xml
        <service
            android:name=".AlertService"
            android:exported="false"
            android:foregroundServiceType="specialUse">
            <property
                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
                android:value="Keeps a connection to ntfy.sh open to show the alerts of Claude Code as they come" />
        </service>
```

Esse trecho é de `AndroidManifest.xml` no narsil-android (MIT). A mesma decisão explica o que o app não usa: "no Firebase, no ntfy app needed" (sem Firebase, sem precisar do app ntfy). Serviços de push como o Firebase Cloud Messaging precisam de um servidor que envie para eles; aqui o único servidor é o ntfy.sh, e o app o escuta diretamente.

O serviço em si é curto. De `AlertService.kt` (MIT):

```kotlin
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val settings = Settings(this)
        val wanted = settings.topic
        if (wanted == null) {
            stopSelf()
            return START_NOT_STICKY
        }
        Notifier.createChannels(this)
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0
        ServiceCompat.startForeground(this, Notifier.SERVICE_ID, Notifier.serviceNotification(this, wanted), type)
        if (wanted != topic || stream == null) {
            stream?.stop()
            topic = wanted
            stream = NtfyStream(NtfyStream.topicUrl(wanted), settings.lastAlertId, ::take).also { it.start() }
        }
        return START_STICKY
    }
```

- **Sem tópico, sem serviço.** Ele para sozinho e pede para não ser reiniciado.
- **Primeiro a notificação discreta.** `startForeground` precisa ser chamado logo depois de o serviço começar, senão o Android o para. O tipo só entra no Android 14 (`UPSIDE_DOWN_CAKE`) e posteriores, onde os tipos existem.
- **Um fluxo por tópico.** O serviço pode ser iniciado muitas vezes: na abertura do app, em **Guardar y recibir avisos** nas configurações e depois de reiniciar o celular. Se o tópico é o mesmo e um fluxo está rodando, nada muda. Se você salvou um tópico novo, o fluxo antigo para e um novo começa.
- **`START_STICKY`** pede ao Android que inicie o serviço de novo se algum dia precisar matá-lo.

A notificação discreta vive no seu próprio canal, **Conexión** (conexão), na menor importância, sem badge, então ela fica no fim da área de notificações, sem som. O texto dela inclui o seu tópico, o que vale saber se outras pessoas veem a sua tela.

### `NtfyStream`: uma conexão, mantida aberta

O ntfy.sh pode enviar um tópico como um fluxo JSON: uma resposta HTTP que nunca termina, com um objeto JSON por linha ([ntfy: subscribe API](https://docs.ntfy.sh/subscribe/api/)). Cada linha de mensagem tem `"event": "message"`; o ntfy.sh também envia linhas `open` e `keepalive`. `NtfyStream` lê esse fluxo numa thread própria. A parte da leitura, de `NtfyStream.kt` (MIT):

```kotlin
    private fun read() {
        val from = since
        val url = URL(if (from != null) "$topicUrl?since=${URLEncoder.encode(from, "UTF-8")}" else topicUrl)
        val c = url.openConnection() as HttpURLConnection
        connection = c
        try {
            c.connectTimeout = 15_000
            c.readTimeout = 90_000
            c.useCaches = false
            if (c.responseCode != 200) throw IOException("ntfy.sh answered ${c.responseCode}")
            c.inputStream.bufferedReader().useLines { lines ->
                for (line in lines) {
                    if (!isRunning) return
                    val raw = try {
                        JSONObject(line)
                    } catch (_: Exception) {
                        continue
                    }
                    if (raw.optString("event") != "message") continue
                    try {
                        onMessage(raw)
                    } catch (e: Exception) {
                        Log.w(TAG, "a message could not be taken: ${e.message}")
                    }
                    raw.optString("id").takeIf { it.isNotEmpty() }?.let { since = it }
                }
            }
        } finally {
            c.disconnect()
            connection = null
        }
    }
```

Os números têm motivo. O comentário da classe diz "ntfy.sh sends a keepalive every 45 s, so a read that waits 90 s found a dead connection" (o ntfy.sh envia um keepalive a cada 45 s, então uma leitura que espera 90 s encontrou uma conexão morta): um celular que trocou de rede pode manter um socket que nunca mais vai entregar nada, e o timeout de leitura de 90 segundos é como o app percebe. Uma linha que não é JSON é pulada. Uma mensagem que falha ao ser mostrada é registrada no log e não para o fluxo. E, depois de cada mensagem, `since` passa para o id dela.

Em volta de `read()`, `follow()` o mantém andando:

- **Quando o fluxo termina normalmente** (o ntfy.sh ou um proxy o fechou), ele espera um segundo e lê de novo, a partir de `since`.
- **Quando ele falha** (sem rede, um timeout, uma resposta diferente de 200), ele espera um segundo, depois dois, quatro e assim por diante, até um minuto, e volta a um segundo depois de uma leitura que funcionou.
- **`stop()`** desliga uma flag, desconecta a conexão aberta e interrompe a thread, para que ela termine na hora, mesmo no meio de uma espera.

A thread é uma thread daemon, então ela nunca mantém o processo do app vivo sozinha; quem faz isso é o serviço em primeiro plano.

### Recuperar o atraso com `since`

O ntfy.sh guarda as mensagens de um tópico por um tempo (12 horas, diz o comentário em `AlertService.kt`), e o seu parâmetro `since` pede as que vieram depois de um id de mensagem ([ntfy: subscribe API](https://docs.ntfy.sh/subscribe/api/)). O app o usa para retomar de onde parou:

1. Depois de cada alerta que mostra, `AlertService.take` salva o id da mensagem como `lastAlertId` nas configurações.
2. Quando o serviço começa, depois de reiniciar o celular, por exemplo, ele abre o fluxo com `since=<lastAlertId>`.
3. O ntfy.sh primeiro envia o que guardou depois desse id, depois segue ao vivo.

Assim, um alerta enviado enquanto o celular estava desligado chega quando ele volta. Três limites decorrem do código:

- **Na primeira vez, não há de onde retomar.** Sem id salvo, `since` é `null` e o fluxo começa "de agora em diante". Os alertas enviados antes do seu primeiro não são buscados.
- **Um tópico novo começa do zero.** Salvar um tópico diferente remove `lastAlertId` (o setter faz isso), para que você não fique com um id que pertence a outro tópico.
- **Passadas 12 horas, eles somem** do ntfy.sh, e portanto do app.

Há uma segurança discreta na tag da notificação. Se o Android matar o app entre mostrar um alerta e salvar o seu id, o alerta chega de novo no próximo início, mas com o mesmo id de mensagem, e portanto a mesma tag, então ele substitui a si mesmo em vez de aparecer duas vezes.

### `Alert.kt`: as regras

`Alert.of` transforma uma mensagem, já aberta se estava selada, no que uma notificação mostra. De `Alert.kt` (MIT):

```kotlin
        fun of(m: JSONObject): Alert {
            val isUrgent = m.optInt("priority", 3) >= 4
            val tags = m.optJSONArray("tags")
            val conversation = (0 until (tags?.length() ?: 0)).map { tags!!.optString(it) }.firstOrNull { it.startsWith("conv-") }
            val id = m.optString("id").ifEmpty { m.optLong("time").toString() }
            val actions = m.optJSONArray("actions")
            val views = (0 until (actions?.length() ?: 0)).mapNotNull { actions!!.optJSONObject(it) }
                .filter { it.optString("action") == "view" && it.optString("url").isNotEmpty() }
                .take(2)
                .map { View(it.optString("label").ifEmpty { "Abrir" }, it.optString("url")) }
            val click = m.optString("click").takeIf { Links.isClaude(it) }
            return Alert(
                title = m.optString("title").ifEmpty { "Narsil" },
                body = if (m.optBoolean("sealed")) SEALED else m.optString("message"),
                isUrgent = isUrgent,
                tag = if (!isUrgent && conversation != null) "done-$conversation" else id,
                views = views,
                icon = m.optString("icon").takeIf { it.startsWith(ART) },
                opens = click ?: Links.CLAUDE_CODE,
            )
        }
```

| Regra   | O que o código faz                                                                                                                                                 |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Urgente | Prioridade do ntfy 4 ou 5. O mod envia 4 para uma pergunta ou um erro, 3 para um turno terminado.                                                                  |
| Tag     | Um turno terminado com uma tag `conv-…` recebe `done-conv-…`, para que o próximo dessa conversa o substitua. Qualquer outro, o seu próprio id.                     |
| Botões  | Só ações `view` do ntfy com endereço, no máximo duas, com o rótulo `Abrir` (abrir) quando não têm rótulo.                                                          |
| Toque   | O endereço `click` da mensagem só se for do `claude.ai`; senão, `https://claude.ai/code`.                                                                          |
| Desenho | Só um `icon` que comece com `https://raw.githubusercontent.com/davshn/narsil-pet/main/assets/`.                                                                    |
| Título  | O título da mensagem, ou `Narsil`.                                                                                                                                 |
| Selada  | Quando a chave não conseguiu abri-la: "🔒 Aviso cifrado: pon la clave en los ajustes de la app." (alerta criptografado: coloque a chave nas configurações do app). |

A regra do desenho tem um motivo num comentário: "Without a key anyone who knows the topic can publish on it: a picture only comes from Narsil's own assets." (Sem chave, qualquer pessoa que conheça o tópico pode publicar nele: um desenho só vem dos próprios assets da Narsil.) O mesmo vale para o toque. Os endereços dos botões não são conferidos além de estarem presentes: um que não seja do `claude.ai` abre em qualquer app que o trate, depois que você toca nele.

### O que o mod envia

As regras acima correspondem ao que o mod publica. De `hooks/phone.ts` no [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later):

<!-- prettier-ignore -->
```ts
export function phoneMessage(topic: string, kind: PhoneKind, title: string, text: string, where: string, stage: number, isLast: boolean, fleet = '') {
  const body = fleet ? `${text}\n\n${fleet}` : text
  return {
    topic,
    title: where ? `Narsil · ${title} · ${where}` : `Narsil · ${title}`,
    message: isLast ? `${body}\n(último aviso de hoy: mañana sigo)` : body,
    priority: PRIORITY[kind],
    tags: [TAGS[kind]],
    icon: phoneIcon(kind, stage),
    actions: [OPEN_CLAUDE],
  }
}
```

`PRIORITY` é 3 para `done` e 4 para `question` e `error`. `TAGS` guarda uma tag de emoji por tipo (`white_check_mark`, `raising_hand`, `warning`). `phoneIcon` monta o endereço do desenho a partir do estágio da Narsil e da pose do alerta: os desenhos da filhote ficam na raiz de `assets/`, cada estágio posterior numa pasta `etapaN/`, e a pose é `terminado`, `necesita` ou `error`, sempre na variante escura (`-oscuro.png`). `OPEN_CLAUDE` é o único botão, `Abrir Claude`, para `https://claude.ai/code`. O corpo pode terminar com a lista das conversas abertas e, na 200ª mensagem do dia, com `(último aviso de hoy: mañana sigo)` (último alerta de hoje: amanhã eu continuo). [Alertas no celular e no relógio](/pt/mods/pet/phone-and-watch/) trata de quando o mod envia.

Repare no que o mod não envia: uma tag `conv-` ou um endereço `click`. Então, com o mod de hoje, cada turno terminado é a sua própria notificação, e cada toque abre `claude.ai/code`, onde o Remote Control lista as suas conversas.

### `Notifier.kt`: os canais e a notificação

Desde o Android 8, toda notificação pertence a um canal, e a pessoa decide por canal se ele toca, vibra ou aparece. O app cria três. De `Notifier.kt` (MIT):

```kotlin
    fun createChannels(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannels(
            listOf(
                NotificationChannel(NEEDS, "Te necesita", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Una pregunta o un error de Claude"
                    enableVibration(true)
                    vibrationPattern = NEEDS_BUZZ
                },
                NotificationChannel(DONE, "Terminó", NotificationManager.IMPORTANCE_DEFAULT).apply {
                    description = "Claude terminó un turno"
                    enableVibration(true)
                    vibrationPattern = DONE_BUZZ
                },
                NotificationChannel(SERVICE, "Conexión", NotificationManager.IMPORTANCE_MIN).apply {
                    description = "La conexión con ntfy.sh que trae los avisos"
                    setShowBadge(false)
                },
            ),
        )
    }
```

`IMPORTANCE_HIGH` é o que faz um alerta aparecer por cima do que você está fazendo. Os dois padrões de vibração são o "jeito próprio" de cada um vibrar: `NEEDS_BUZZ` é `0, 300, 120, 300, 120, 600` (três pulsos, o último longo), `DONE_BUZZ` é `0, 200`. Depois que um canal existe, o Android deixa você mudar o seu som e a sua vibração nas configurações de notificação do app, e os valores do app são só o ponto de partida.

`show` monta cada notificação:

- Ele retorna na hora se as notificações estão desligadas para o app (o comentário: "the person may have turned notifications off", a pessoa pode ter desligado as notificações).
- O título e o corpo como vieram, com `BigTextStyle`, para que um corpo longo possa ser expandido. A categoria `REMINDER` para os urgentes, `STATUS` para o resto, e `setAutoCancel(true)`, para que um toque a dispense.
- **O toque e os botões** são `PendingIntent`s montados por `open`: um endereço do `claude.ai` vira um intent explícito para a `MainActivity`, qualquer outro um `ACTION_VIEW` para o app que o tratar. Eles são imutáveis (`FLAG_IMMUTABLE`), então nenhum outro app consegue mudar para onde eles levam.
- **O desenho** é baixado do endereço `icon` com timeouts de conexão e de leitura de 5 segundos, e vira o ícone grande. Se não chegar a tempo, a notificação vai sem ele. Isso roda na thread do fluxo, que pode se dar ao luxo de esperar.
- `manager.notify(alert.tag, 0, ...)`: a tag decide a substituição. A mesma tag substitui a notificação anterior; uma tag nova acrescenta uma.

Nada em `show` define um timeout ou torna uma notificação permanente, então todo alerta, urgente ou não, fica na área de notificações até você tocar nele (`setAutoCancel`) ou deslizá-lo para fora. O que distingue os urgentes é que o canal deles os faz aparecer por cima do que você está fazendo e vibrar no padrão longo.

### O toque, de volta ao app

Quando você toca num alerta, o Android envia o intent explícito à `MainActivity` com o endereço. A activity é `singleTask`, então, se ela já está aberta, recebe o endereço em `onNewIntent` e o carrega; senão, `onCreate` o carrega em vez da página padrão. Nos dois casos, `claudeIn` só aceita endereços do `claude.ai` ([guia 2](/pt/android/webview-host/)).

### `BootReceiver`: depois de reiniciar ou de uma atualização

Reiniciar o celular mata todo serviço. O app escuta dois broadcasts, `BOOT_COMPLETED` e `MY_PACKAGE_REPLACED`, e em qualquer um deles chama `AlertService.start`, que só inicia o serviço se houver um tópico salvo. O segundo dispara depois que você executa `./gradlew installDebug` de novo, então uma atualização não deixa você sem alertas. O primeiro precisa da permissão `RECEIVE_BOOT_COMPLETED`, que o manifesto pede.

### A bateria: o Doze e os celulares agressivos

O modo Doze do Android corta o acesso à rede dos apps enquanto o celular dorme, e só os acorda em janelas curtas. Um serviço em primeiro plano ajuda, mas a conexão ainda pode ser cortada. A solução é uma isenção das otimizações de bateria, que só você pode conceder.

O segundo botão da tela de configurações faz isso. Enquanto o app não está isento (`PowerManager.isIgnoringBatteryOptimizations` diz que não), **Permitir en segundo plano** fica ativo; um toque abre a própria caixa de diálogo do Android (`ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`) para este app. Depois de concedida, o botão vira **Ya funciona en segundo plano** e fica cinza. O código silencia o aviso de lint `BatteryLife` para essa chamada, que avisa que o Google Play só permite esse pedido para alguns tipos de app; este app é instalado a partir do código-fonte.

Alguns fabricantes de celular vão além e fecham os apps em segundo plano por conta própria. O README cita Infinix, Xiaomi e Huawei. Os testes do registro de tarefas rodaram num Infinix X6730B com Android 15. Se os alertas pararem de chegar, confira **Permitir en segundo plano** e depois as configurações de bateria ou de inicialização de apps do próprio celular para o Narsil.

## Construa com o Claude

Peça ao Claude o serviço e as regras separadamente: uma função Kotlin pura que vá de uma mensagem do ntfy ao que uma notificação mostra, testada no computador, e um serviço em primeiro plano que acompanhe um tópico e entregue cada mensagem a ela. A única ideia que ele precisa acertar é a retomada: o fluxo precisa começar a partir da última mensagem mostrada, e só endereços que não podem causar dano recebem o toque e o desenho.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No meu app Android (Kotlin, `minSdk 29`, `targetSdk 36`), acrescente um serviço em primeiro plano do tipo `specialUse` (com `PROPERTY_SPECIAL_USE_FGS_SUBTYPE` no manifesto) que acompanhe `https://ntfy.sh/<topic>/json` numa thread daemon com `HttpURLConnection`, um timeout de conexão de 15 s e de leitura de 90 s, um objeto JSON por linha, mantendo só `event == "message"`. Retome com `?since=<id>` a partir da última mensagem mostrada, salva em `SharedPreferences` depois de cada uma e apagada quando o tópico muda. Reconecte depois de um segundo quando o fluxo terminar, e com uma espera que dobra até 60 s depois de uma falha. Coloque as regras num `Alert.of(JSONObject)` puro: prioridade 4 ou mais vai para um canal de alta importância, uma tag `conv-` num alerta não urgente vira a tag de substituição, no máximo duas ações `view` viram botões, o toque abre o endereço `click` só quando ele é `https://claude.ai`, e um ícone grande só é aceito a partir de um prefixo de URL fixo. Inicie o serviço de novo em `BOOT_COMPLETED` e `MY_PACKAGE_REPLACED`. Acrescente um botão que peça a isenção da otimização de bateria. Teste `Alert.of` com JUnit.

### O que conferir na resposta do Claude

1. `startForeground` é chamado no início de `onStartCommand`, com o tipo `specialUse` só no Android 14 e posteriores.
2. O fluxo retoma a partir de um id salvo, e salvar um tópico novo apaga esse id.
3. Um timeout de leitura mais longo que o keepalive de 45 segundos do ntfy.sh detecta uma conexão morta.
4. As falhas esperam mais a cada vez, até um teto, e uma leitura que funciona zera a espera.
5. O endereço do toque e o desenho são restritos; os botões têm teto de dois.
6. Cada notificação é publicada com uma tag, então uma mensagem repetida substitui a si mesma.
7. Os `PendingIntent`s são `FLAG_IMMUTABLE`.
8. As regras não têm código Android, e os testes delas rodam com `./gradlew testDebugUnitTest`.

Se uma verificação falhar, diga ao Claude o que você vê: "depois que o celular ficou desligado por uma hora, os alertas dessa hora nunca chegaram".

### Como a pessoa autora pediu

A primeira mensagem da pessoa autora, registrada em `odd/tasks/android-app.md` como L1, pedia "una app movil completa, que reciba las notificaciones" (um app de celular completo, que receba as notificações). O resto das regras deste guia é do agente, registrado na especificação e no log, e não são palavras da pessoa autora. A especificação S5 diz que os alertas "keep the PWA's rules" (mantêm as regras da PWA, o aplicativo web anterior): "sealed messages opened with the key (`narsil1:`), priority >= 4 stays until touched and buzzes its own way, a "done" replaces the previous one of its `conv-` tag, ntfy "view" actions as buttons, a tap opens Claude Code inside the app." (mensagens seladas abertas com a chave, `narsil1:`; prioridade >= 4 fica até ser tocada e vibra do seu próprio jeito; um "done" substitui o anterior da sua tag `conv-`; ações "view" do ntfy como botões; um toque abre o Claude Code dentro do app.) A decisão sobre o tipo de serviço está citada acima.

O log registra duas verificações no celular. Com um tópico descartável: "two done alerts of conv-a left one notification (tag done-conv-a, importance 3) and a priority 4 one its own (importance 4); accents arrive intact; a tap opened MainActivity on claude.ai/code." (dois alertas done de conv-a deixaram uma notificação, tag done-conv-a, importância 3, e um de prioridade 4 deixou a sua, importância 4; os acentos chegam intactos; um toque abriu a MainActivity em claude.ai/code.) E com o tópico e a chave reais, em 2026-11-24 às 00:44: "The alert showed as an app notification on the urgent channel (importance 4)" (o alerta apareceu como uma notificação do app no canal urgente, importância 4).

Os commits (um nome de projeto num assunto é substituído por uma descrição entre colchetes):

- `3bcea35` (2026-11-24) "feat: build the script that hosts [the earlier extension] in a WebView, and what alerts and states keep" (montar o script que hospeda a [extensão anterior] numa WebView, e o que os alertas e os estados guardam). O `Alert.kt` e os seus testes.
- `53c55c1` (2026-11-24) "feat: host claude.ai with [the earlier extension] in a WebView, and show Narsil's alerts from a foreground service" (hospedar o claude.ai com a [extensão anterior] numa WebView, e mostrar os alertas da Narsil a partir de um serviço em primeiro plano). A sua mensagem: "alerts follow <topic> from the last one shown, also after a reboot." (os alertas acompanham <topic> a partir do último mostrado, também depois de reiniciar.)
- `9e514dd` (2026-11-24) "feat: open the settings from Narsil in the band and from the service's notification" (abrir as configurações a partir da Narsil na faixa e da notificação do serviço).
- `a275382` (2026-11-24) "docs: log the alerts and the band verified with the real topic and key" (registrar os alertas e a faixa conferidos com o tópico e a chave reais).

## Código de referência

Esta é uma resposta correta, escrita para este guia (MIT). Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

Dois testes JUnit para `Alert.of` com mensagens no formato das do próprio mod, com ids e textos inventados. Coloque-os ao lado de `AlertTest.kt`:

```kotlin
package io.github.davshn.narsil

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ModAlertTest {
    private val openClaude = JSONObject()
        .put("action", "view")
        .put("label", "Abrir Claude")
        .put("url", "https://claude.ai/code")

    @Test
    fun aQuestionFromTheModIsUrgentAndKeepsItsButton() {
        val m = JSONObject()
            .put("id", "example1")
            .put("title", "Narsil · Te necesito · web")
            .put("message", "¿Sigo con la migración?")
            .put("priority", 4)
            .put("tags", JSONArray().put("raising_hand"))
            .put("icon", "https://raw.githubusercontent.com/davshn/narsil-pet/main/assets/etapa3/necesita-oscuro.png")
            .put("actions", JSONArray().put(openClaude))
        val alert = Alert.of(m)
        assertTrue(alert.isUrgent)
        assertEquals("example1", alert.tag)
        assertEquals(listOf("Abrir Claude"), alert.views.map { it.label })
        assertEquals("https://claude.ai/code", alert.opens)
        assertNotNull(alert.icon)
    }

    @Test
    fun twoDonesWithoutAConversationTagDoNotReplaceEachOther() {
        fun done(id: String) = JSONObject()
            .put("id", id)
            .put("message", "He terminado")
            .put("priority", 3)
            .put("tags", JSONArray().put("white_check_mark"))
        assertNotEquals(Alert.of(done("example2")).tag, Alert.of(done("example3")).tag)
    }
}
```

O segundo teste documenta o comportamento de hoje com o mod: sem tag `conv-`, sem substituição. Para ver a própria substituição, publique dois alertas com uma tag `conv-` num tópico inventado que você colocou nas configurações ([ntfy: publishing](https://docs.ntfy.sh/publish/)):

```bash
curl -H "Tags: white_check_mark,conv-demo" -d "Primera" https://ntfy.sh/narsil-0000000000example0
curl -H "Tags: white_check_mark,conv-demo" -d "Segunda" https://ntfy.sh/narsil-0000000000example0
curl -H "Priority: 4" -H "Actions: view, Abrir Claude, https://claude.ai/code" -d "¿Sigo?" https://ntfy.sh/narsil-0000000000example0
```

Você deve ver uma notificação **Terminó** dizendo "Segunda" e uma **Te necesita** que aparece por cima, vibra três vezes e tem um botão `Abrir Claude`.

## Erros comuns e como testar

- **Um serviço `dataSync`.** No Android 15, ele é parado depois de seis horas por dia. Declare o tipo que serve, com o seu motivo.
- **Começar o fluxo de agora a cada reinício.** Os alertas enviados enquanto o celular estava desligado se perdem. Retome a partir do último id.
- **Sem timeout de leitura.** Uma conexão que morreu numa troca de rede espera para sempre. Escolha um mais longo que o keepalive.
- **Tentar de novo na hora, para sempre.** Sem uma espera crescente, um celular sem rede fica girando. Limite-a a um minuto.
- **Confiar no tópico.** Sem chave, qualquer pessoa com o nome dele pode publicar um alerta. Restrinja o toque, o desenho e o número de botões.
- **Publicar sem tag.** Use o próprio id da mensagem como tag, para que uma mensagem entregue duas vezes substitua a si mesma.
- **Pular a isenção de bateria.** Os alertas chegam em rajadas quando o celular acorda, minutos atrasados.
- **Esperar a substituição com o mod de hoje.** O mod não envia tag `conv-`, então os turnos terminados se empilham.

Para testar as regras, execute `./gradlew testDebugUnitTest`: `AlertTest.kt` confere que uma pergunta ou um erro é urgente, que um done com tag `conv-` substitui e um sem ela não, o texto selado, o título padrão, o teto de dois botões, a regra do `click` (um endereço em outro site recai em `claude.ai/code`) e a regra do desenho. Para testar o serviço, publique num tópico inventado como acima, depois ligue o modo avião, publique duas vezes e desligue-o: os dois devem chegar em até um minuto. `adb logcat -s NarsilNtfy` mostra as falhas do fluxo e as suas esperas ("ntfy.sh stream failed, again in 4 s", o fluxo do ntfy.sh falhou, de novo em 4 s).

### Onde o código e o README diferem

- O README diz que cada turno terminado "takes the place of the previous one of the same conversation" (toma o lugar do anterior da mesma conversa). O app de fato os substitui quando uma mensagem leva uma tag `conv-`, como mostrou o teste do registro de tarefas com `conv-a`, mas o `phoneMessage` do narsil-pet não envia essa tag hoje, só `white_check_mark`, `raising_hand` ou `warning`. Com o mod real, cada turno terminado é a sua própria notificação.
- O README diz que os alertas perdidos enquanto o celular estava desligado chegam "once it is back, as ntfy.sh keeps them for 12 hours" (quando ele volta, já que o ntfy.sh os guarda por 12 horas). Isso vale depois que o app mostrou pelo menos um alerta do tópico. Antes disso, e logo depois de uma troca de tópico, não há id salvo e o fluxo começa no momento em que se conecta.
- O README diz que uma pergunta ou um erro "stays until you touch it" (fica até você tocar nele), como se um turno terminado não ficasse. No código, nenhuma notificação é permanente nem tem prazo: os dois tipos ficam até você tocar neles ou deslizá-los para fora, e o canal urgente acrescenta o aparecimento por cima e a vibração longa.
- O comentário da classe em `NtfyStream.kt` diz que ela acompanha o fluxo "as the band's lib/stream.js follows it" (como o lib/stream.js da faixa o acompanha). Não há `lib/stream.js` neste repositório; o comentário se refere à extensão anterior.

## Para ir além

- O [guia 7](/pt/android/encryption-and-settings/) abre o `Seal.unseal`, o primeiro passo de `take`, e explica a tela de configurações e os seus botões.
- O [guia 3](/pt/android/conversation-band/) reutiliza o `NtfyStream` para `<topic>-estado`, a partir de `since=12h`.
- Do lado do mod, [Alertas no celular e no relógio](/pt/mods/pet/phone-and-watch/) explica quando o mod envia, o limite diário de 200 e o tópico.
- O [Narsil Watch](/pt/watch/what-it-is/) mostra o estado da Narsil num relógio Wear OS, a partir do mesmo tópico `-estado`.
- O código-fonte está em [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
