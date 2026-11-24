---
title: O que é o Narsil Watch
description: 'O app para Wear OS que coloca os limites do Claude e as suas conversas abertas do Claude Code no seu pulso: um tile, uma complicação e um app, sem servidor e sem token do Claude.'
route: watch
order: 1
updated: 2026-11-24
sources:
  - repo: watch
    path: README.md
  - repo: watch
    path: app/src/main/AndroidManifest.xml
  - repo: watch
    path: app/build.gradle.kts
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/data/StatusRepository.kt
  - repo: pet
    path: hooks/phone.ts
  - repo: pet
    path: hooks/register.tsx
---

## O que faz

O Narsil Watch é um app para Wear OS. Ele coloca duas coisas no seu pulso: quanto dos limites de uso do Claude você já gastou e como estão as suas conversas abertas do Claude Code. Ele as mostra em três lugares:

| Superfície                   | Onde você a vê                                                         | O que mostra                                                                                                                                         |
| ---------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| O tile **Narsil · Claude**   | Deslizando para o lado a partir do mostrador                           | Dois anéis, o limite de 5 horas por fora e o semanal por dentro, a Narsil no meio, quantas conversas precisam de você e há quanto tempo é a leitura. |
| A complicação **Claude 5 h** | Em qualquer mostrador que aceite uma                                   | O limite de 5 horas, como um arco ou como um texto curto, por exemplo `62%`.                                                                         |
| O app, chamado **Narsil**    | Na lista de apps do relógio, ou com um toque no tile ou na complicação | Cada conversa aberta com o seu estado, os dois limites com a hora em que reiniciam, e o nível da Narsil.                                             |

O app fala espanhol, como a própria Narsil. Os estados que ele mostra são os dela: `TRABAJANDO` (trabalhando), `PARADA` (parada), `TE NECESITA` (precisa de você), `TERMINADA` (terminada) e `ERROR`.

Ele **não precisa de servidor** nem de **token do Claude**. Ele nunca fala com o Claude. Ele lê um pequeno estado que o mod Narsil no seu computador já publica para o seu celular, num tópico privado do [ntfy.sh](https://ntfy.sh). [Ler o estado da Narsil](/pt/watch/reading-the-state/) explica esse estado, e [Alertas no celular e no relógio](/pt/mods/pet/phone-and-watch/) explica como o mod o envia.

> **Experimental.** O relógio só sabe o que o mod publicou por último, e o mod só publica quando um turno termina (ou chega uma pergunta) enquanto você está longe do computador, dentro da margem diária gratuita do ntfy.sh. Na mesa, o relógio continua mostrando uma leitura antiga. Ele pede uma nova no máximo a cada 15 minutos, o ntfy.sh guarda uma mensagem só por um tempo, e o app é uma build de depuração que você mesmo instala por `adb`, versão `0.1.0`. Qualquer mudança no formato do estado do mod pode quebrá-lo.

O Narsil Watch é de código aberto sob a GPL v3 (ou qualquer versão posterior), em [github.com/davshn/narsil-watch](https://github.com/davshn/narsil-watch). Ele não é afiliado à Anthropic.

## Como funciona por dentro

### Um estado, três superfícies

O código é pequeno: dez arquivos Kotlin em `app/src/main/kotlin/tech/davshn/narsilwatch/`. O README resume as pastas, e vale a pena copiar a divisão:

- `domain/`: o estado tal como a Narsil o publica (`NarsilState.kt`) e como o relógio o põe em palavras e cores (`Display.kt`). Kotlin puro, sem Android.
- `data/`: a leitura do tópico do ntfy (`StatusRepository.kt`, `StatusParser.kt`), a abertura do selo (`Seal.kt`) e a guarda do último estado.
- `tile/`, `complication/`, `presentation/`: as três superfícies.
- `sync/`: a atualização a cada 15 minutos com o WorkManager, e os redesenhos.

As três superfícies nunca consultam a rede por conta própria enquanto desenham. Todas leem o mesmo último estado que o `StatusRepository` guarda no relógio, por meio de `cached()`. Só a atualização consulta o ntfy.sh, e quando ela tem algo novo, avisa o tile e a complicação para desenharem de novo. É por isso que o tile aparece na hora, mesmo offline: ele nunca espera por uma requisição.

O comentário no topo de `StatusRepository.kt` (GPL v3) diz isso numa linha:

```kotlin
// Where the watch keeps the topic, the key, and the last state it read, so
// the tile and the complication draw at once, offline too.
```

### O fluxo de dados

O README desenha o caminho inteiro numa linha:

```text
Claude Code ── Narsil mod ──► ntfy.sh/<topic>-estado ──► Narsil Watch (tile, complication, app)
```

Passo a passo:

1. **O Claude Code roda o mod Narsil** ([narsil-pet](https://github.com/davshn/narsil-pet)) no seu computador. Ele já conhece as suas conversas, os estados delas, o nível da Narsil e, desde a versão 3.10.0, os limites de 5 horas e semanal do Claude.
2. **O mod publica um estado JSON** em `https://ntfy.sh`, no tópico `<o seu tópico>-estado`. O seu tópico é o que o `/narsil movil` criou, um nome como `narsil-0000000000example0` (todo tópico deste caminho é um exemplo inventado).
3. **O ntfy.sh guarda a mensagem mais recente** por um tempo. Um comentário em `hooks/register.tsx` do narsil-pet diz que ele "keeps a message 12 h" (guarda uma mensagem por 12 h).
4. **O relógio pede ao ntfy.sh a mensagem mais recente** desse tópico, abre-a com a sua chave se ela estiver selada, e a guarda.
5. **O tile, a complicação e o app** desenham a partir do que ele guardou.

Nada vai no sentido contrário. A seção Security do README é clara: "the watch only reads the topic: it never publishes on it." (o relógio só lê o tópico: nunca publica nele.)

### Quando o mod publica, e o que isso significa para o frescor

Esta é a coisa mais importante para entender o relógio. Ele é uma janela para a última mensagem, não um feed ao vivo.

O `sendStatus` do mod, em `hooks/register.tsx`, roda quando um turno da conversa principal termina e quando chega uma pergunta, e o `/narsil movil prueba` ("teste") também envia um. A cada vez, `postToPhone` decide se ele de fato sai. Das suas primeiras linhas:

```ts
const { phoneTopic, isPhoneOn, phoneKey } = await read($, prefs)
if (!isPhoneOn || !phoneTopic || (!force && !(await isAway($)))) return false
const day = dayOf(await $.clock.now())
const count = countOf(await $.store.get(PHONE_KEY).catch(() => undefined), day)
if (count.sent >= PHONE_DAILY) return false
```

Esse trecho é de `hooks/register.tsx` do narsil-pet (GPL v3), sem a sua indentação. Em palavras, o estado só sai quando:

- **O `/narsil movil` está ligado** e existe um tópico.
- **Você está longe.** `isAway` lê de onde veio a sua última mensagem. Se veio pelo Remote Control (o seu celular ou a web), você está longe; se veio do terminal ou do app de desktop, você está na mesa.
- **A margem do dia não acabou.** `PHONE_DAILY` é 200. O comentário em `hooks/phone.ts`: "ntfy.sh takes 250 a day for free: Narsil stops short of it." (o ntfy.sh aceita 250 por dia de graça: a Narsil para antes disso.) O dia é o dia UTC, e os alertas e os estados dividem os mesmos 200.

Então, na prática:

- **Enquanto você trabalha pelo celular**, um novo estado sai ao fim de cada turno. O relógio o pega na sua próxima atualização.
- **Na mesa**, nada sai. O relógio fica com a última leitura que tinha. Isso é proposital: na mesa você vê a faixa e a janela flutuante, e enviar gastaria a margem diária à toa. O tile e o app mostram há quanto tempo é a leitura (`hace 2 h`, "há 2 horas"), para você nunca ser enganado.
- **Num dia movimentado longe da mesa**, os 200 podem acabar. Depois disso, nada novo chega até a meia-noite UTC.
- **Se nada foi publicado por mais de umas 12 horas**, o ntfy.sh pode não ter mais nada para entregar. O relógio continua mostrando o que guardou.

Os limites também envelhecem. Um número de 5 horas lido ao meio-dia não diz nada certo sobre as 17h. O app mostra quando cada limite reinicia ([guia 5](/pt/watch/app-and-refresh/)), e o rótulo de idade diz há quanto tempo é tudo aquilo.

### Por que os alertas não fazem parte do app

Você poderia esperar que um app de relógio vibrasse quando o Claude precisa de você. Este não vibra, de propósito. O README explica: "Alerts (a question, a finished turn, an error) are not part of this app: Narsil for Android or the ntfy app on your phone already mirror them to the watch." (Os alertas, uma pergunta, um turno terminado, um erro, não fazem parte deste app: o Narsil para Android ou o app ntfy no seu celular já os espelham no relógio.)

O Wear OS já mostra as notificações do celular no relógio. O mod já envia os seus alertas para o seu tópico do ntfy. Então os alertas chegam ao seu pulso pelo celular, com um destes:

- o [Narsil para Android](/pt/android/what-it-is/), que os transforma em notificações nativas e abre os selados com a sua chave, ou
- o app ntfy, assinado no seu tópico. O próprio texto de ajuda do mod diz que um relógio Wear OS "mostrará sus notificaciones si tienes activadas las de ntfy en la app del reloj" (mostrará as notificações se você tiver ativado as do ntfy no app do relógio).

Um segundo caminho de alertas a partir do app do relógio significaria duas vibrações para um evento, e uma segunda assinatura mantendo o rádio ocupado. O app do relógio faz a única coisa que o celular não consegue espelhar: um resumo de tudo de uma vez, para ler num relance.

### O que ele lê da rede

Pelo `AndroidManifest.xml`, o app pede só duas permissões, `INTERNET` e `ACCESS_NETWORK_STATE`. Ele se declara um app de relógio independente (`com.google.android.wearable.standalone` é `true`), então não precisa de um app acompanhante no celular. Ele define `android:allowBackup="false"`, então o tópico e a chave que ele guarda não são copiados para um backup.

Ele fala só com dois lugares, que a seção Security do README lista e o código confirma:

- **`https://ntfy.sh`**, para o estado.
- **`https://raw.githubusercontent.com/davshn/narsil-pet/`**, para os desenhos da Narsil. O `StatusRepository` recusa qualquer outro endereço para a imagem (o [guia 2](/pt/watch/reading-the-state/) explica por quê).

Nenhum token do Claude e nenhuma conta do Claude chegam ao relógio.

### Instalar pelo adb sem fio

Não há página em loja. Você compila o app no seu computador e o instala no relógio pelo Wi-Fi. Segundo o README, você precisa de:

- Um relógio com **Wear OS 3 ou posterior**, com as opções de desenvolvedor e a **depuração sem fio** ligadas.
- No computador, o **JDK 17 ou posterior** e o **Android SDK**, com `ANDROID_HOME` apontando para ele.

Pareie o relógio como explica a tela de Depuração sem fio dele e então, numa cópia do repositório:

```bash
adb connect 192.168.1.50:<port>
./gradlew :app:installDebug
```

O endereço aqui é um exemplo; use o IP e a porta que o seu relógio mostrar. `installDebug` compila a variante de depuração e a instala no aparelho conectado. Depois, adicione o tile **Narsil · Claude** no editor de tiles do relógio, e a complicação **Claude 5 h** no editor do mostrador.

Para atualizar, baixe a versão mais recente do repositório e rode o mesmo comando de novo. O README diz que as configurações são mantidas.

Na primeira vez que você abre o app, ele mostra **Configurar**: o seu tópico e, se você usar uma, a sua chave. Você pode digitá-los no relógio, ou enviá-los do computador com um comando `adb`. O [guia 5](/pt/watch/app-and-refresh/) mostra as duas formas. No Claude Code, `/narsil movil` mostra o seu tópico e `/narsil movil clave` cria a chave.

### O tópico e a chave: o que permitem e como trocá-los

Os dois são segredos, então convém ser preciso sobre eles:

- **Onde ficam guardados no relógio.** No armazenamento privado do app (as `SharedPreferences` do Android chamadas `narsil`, em `MODE_PRIVATE`), como diz o README. Não num backup, já que os backups estão desligados.
- **O que o tópico permite.** Qualquer pessoa que conheça o seu nome pode ler todas as mensagens nele, tanto os alertas quanto o `-estado`, e pode publicar nele. O próprio relógio só lê.
- **O que a chave permite.** Ela abre as mensagens seladas. Sem ela, quem lê o tópico vê ruído; com ela, o estado completo.
- **Como trocá-los.** `/narsil movil nuevo` ("novo") cria um novo tópico; o antigo não recebe mais nada. `/narsil movil clave` cria uma nova chave toda vez que você o executa, e a antiga deixa de abrir o que for enviado dali em diante. Depois de qualquer um dos dois, dê ao relógio o novo valor em **Configurar**.
- **Como removê-los do relógio.** Apague os campos em **Configurar**, ou desinstale o app.

O README acrescenta um aviso simples: "Without a key, anyone who knows your topic's name can read it. Use `/narsil movil clave` if that matters to you." (Sem chave, qualquer pessoa que conheça o nome do seu tópico pode lê-lo. Use `/narsil movil clave` se isso importar para você.)

### Sistemas suportados

Segundo o README e o `app/build.gradle.kts`:

| Sistema        | Suporte                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------- |
| Wear OS        | 3 ou posterior. A build define `minSdk = 30` ("Wear OS 3 and later") e `targetSdk = 36`. |
| Mod Narsil     | Uma versão que publique `limits` e `sessions` no seu estado: a 3.10.0 ou posterior.      |
| Tizen, watchOS | Não disponível. É um app Android.                                                        |

A build usa Java 17, Kotlin com Compose para o app, as bibliotecas Tiles e ProtoLayout do Wear para o tile, a biblioteca de fontes de dados de complicações e o WorkManager. As versões ficam em `gradle/libs.versions.toml`.

Um mod mais antigo ainda funciona, em parte. `NarsilState` dá a `limits` e `sessions` valores padrão vazios, então um estado de antes da 3.10.0 é lido sem eles: os anéis ficam vazios, e a lista diz `Sin conversaciones` (sem conversas).

### Por que é experimental

Todos os motivos vêm do código ou do README:

- **Ele depende de o mod publicar.** Sem mod, com o `/narsil movil` desligado ou com um mod mais antigo, o relógio tem pouco ou nada a mostrar.
- **As leituras só chegam enquanto você está longe.** Na mesa, o estado não muda.
- **A margem diária gratuita do ntfy.sh.** O mod para em 200 mensagens por dia, divididas com os alertas.
- **Uma atualização a cada 15 minutos.** O intervalo de repetição mais curto do WorkManager, como diz o comentário em `Refresh.kt`.
- **Um serviço público no meio.** O ntfy.sh guarda as mensagens por um tempo limitado e é um terceiro.
- **Instalação manual.** Ele é instalado como build de depuração por `adb`, versão `0.1.0`, sem loja e sem atualizações automáticas.
- **Os testes cobrem a lógica, não as telas.** Os testes unitários conferem o parser, os textos e o selo; nada testa o tile ou a complicação num aparelho.

## Construa com o Claude

Se você quiser o seu próprio app de relógio como este, peça primeiro o esqueleto ao Claude: um projeto Wear OS com um app, um serviço de tile e um serviço de complicação, todos lendo um único estado guardado. A única ideia que ele precisa acertar é que as superfícies leem uma cópia local e nunca esperam pela rede.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> Crie um app para Wear OS 3+ em Kotlin (`minSdk = 30`, Java 17) chamado `my-watch`, pacote `com.example.mywatch`. Ele lê um estado JSON da mensagem mais recente de um tópico do ntfy.sh, `https://ntfy.sh/<topic>-estado/json?poll=1&since=latest`, e nunca publica. Divida-o em `domain/` (o estado como uma data class `@Serializable` e funções puras de exibição), `data/` (um repositório que guarda o tópico e a última resposta bruta em `SharedPreferences` privadas, e um parser), `tile/` (um `TileService`), `complication/` (um `SuspendingComplicationDataSourceService` com `RANGED_VALUE` e `SHORT_TEXT`), `presentation/` (uma activity com Compose para Wear OS) e `sync/` (um job do WorkManager a cada 15 minutos que atualiza e pede ao tile e à complicação que se redesenhem). O tile e a complicação só leem o estado guardado. Marque o app como independente, desative os backups e peça só `INTERNET` e `ACCESS_NETWORK_STATE`. Acrescente testes JUnit para o parser e as funções de exibição, e um workflow do GitHub Actions que rode `./gradlew :app:testDebugUnitTest :app:assembleDebug`.

### O que conferir na resposta do Claude

1. O tile e a complicação leem o estado guardado. Nenhum dos dois faz uma requisição de rede enquanto desenha.
2. O manifesto declara o tile com `BIND_TILE_PROVIDER` e a complicação com `BIND_COMPLICATION_PROVIDER`, os seus `SUPPORTED_TYPES` e um `UPDATE_PERIOD_SECONDS`.
3. O app tem `com.google.android.wearable.standalone` definido como `true` e `allowBackup` como `false`.
4. Só `INTERNET` e `ACCESS_NETWORK_STATE` são pedidas.
5. O repositório guarda a última resposta boa e não a sobrescreve com uma vazia ou ilegível.
6. O tópico nunca aparece num log.

Se uma verificação falhar, diga ao Claude o que você vê: "o tile fica em branco por alguns segundos quando eu deslizo até ele", o que significa que ele está esperando pela rede.

### Como a pessoa autora pediu

Não existe registro de tarefas nem pedido registrado para este app. O que segue é uma reconstrução a partir do histórico de commits dos dois repositórios, não as palavras da pessoa autora:

- narsil-pet `6400a6f` (2026-11-23) "feat(phone): publish Claude limits and open conversations for the watch" (publicar os limites do Claude e as conversas abertas para o relógio). A sua mensagem: "The status topic now carries the 5-hour and weekly limits (percent, color, reset) and up to 8 open conversations, so a Wear OS app can show them." (O tópico de estado agora leva os limites de 5 horas e semanal, com percentual, cor e reinício, e até 8 conversas abertas, para que um app de Wear OS possa mostrá-los.)
- narsil-watch `b47ca7a` (2026-11-23) "feat: Narsil on Wear OS with Claude limits and open conversations" (a Narsil no Wear OS com os limites do Claude e as conversas abertas). O app inteiro num único commit. A sua mensagem: "A tile with the 5-hour and weekly limits as rings and Narsil in her current pose, a 5-hour complication, and an app listing every open conversation. It reads Narsil's state from its ntfy.sh status topic and opens it with the /narsil movil clave key when sealed." (Um tile com os limites de 5 horas e semanal como anéis e a Narsil na sua pose atual, uma complicação de 5 horas e um app que lista cada conversa aberta. Ele lê o estado da Narsil do seu tópico de estado no ntfy.sh e o abre com a chave do /narsil movil clave quando está selado.)
- narsil-pet `9437318` (2026-11-23) "chore(release): 3.10.0". A primeira versão cujo estado o relógio consegue ler por completo.
- narsil-watch `04390c8` (2026-11-24) "docs: align README with the Narsil family" (alinhar o README com a família Narsil). O README ganha a tabela de estados, as seções Security e Supported systems, e o Narsil para Android ao lado do app ntfy como forma de os alertas chegarem ao relógio; o primeiro README só citava o app ntfy.

A ordem conta a história: o lado do mod mudou primeiro, para que o estado levasse o que um relógio precisa, e depois o relógio foi construído para lê-lo. Nenhum dos lados precisou de servidor.

## Código de referência

Esta é uma resposta correta, escrita para este guia. Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

Um manifesto mínimo para um app com esta forma, escrito para este guia e adaptado de `app/src/main/AndroidManifest.xml` do [narsil-watch](https://github.com/davshn/narsil-watch) (GPL v3). Os nomes das classes pertencem ao pacote de exemplo `com.example.mywatch`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-feature android:name="android.hardware.type.watch" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:name=".MyWatchApplication"
        android:allowBackup="false"
        android:label="My watch"
        android:theme="@android:style/Theme.DeviceDefault">

        <meta-data
            android:name="com.google.android.wearable.standalone"
            android:value="true" />

        <activity
            android:name=".presentation.MainActivity"
            android:exported="true"
            android:taskAffinity="">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <service
            android:name=".tile.MyTileService"
            android:exported="true"
            android:label="My tile"
            android:permission="com.google.android.wearable.permission.BIND_TILE_PROVIDER">
            <intent-filter>
                <action android:name="androidx.wear.tiles.action.BIND_TILE_PROVIDER" />
            </intent-filter>
        </service>

        <service
            android:name=".complication.MyComplicationService"
            android:exported="true"
            android:label="My limit"
            android:permission="com.google.android.wearable.permission.BIND_COMPLICATION_PROVIDER">
            <intent-filter>
                <action android:name="android.support.wearable.complications.ACTION_COMPLICATION_UPDATE_REQUEST" />
            </intent-filter>
            <meta-data
                android:name="android.support.wearable.complications.SUPPORTED_TYPES"
                android:value="RANGED_VALUE,SHORT_TEXT" />
            <meta-data
                android:name="android.support.wearable.complications.UPDATE_PERIOD_SECONDS"
                android:value="900" />
        </service>
    </application>
</manifest>
```

Cada linha está ali por um motivo. O `uses-feature` restringe o app a relógios. As duas permissões são tudo o que uma leitura por HTTPS precisa. Os serviços do tile e da complicação são exportados, porque é o sistema que se liga a eles, e protegidos pelas permissões de vínculo, para que só o sistema possa fazê-lo. `900` segundos corresponde à atualização a cada 15 minutos.

E os comandos para compilar, testar e instalar, do README, com um endereço de exemplo:

```bash
./gradlew :app:testDebugUnitTest
./gradlew :app:assembleDebug
adb connect 192.168.1.50:<port>
./gradlew :app:installDebug
```

## Erros comuns e como testar

- **Esperar dados ao vivo na mesa.** O mod só publica enquanto você está longe. O rótulo de idade é a resposta honesta; leia-o antes dos números.
- **Desligar o `/narsil movil`.** Isso para os estados além dos alertas. O relógio fica com a sua última leitura, que vai envelhecendo.
- **Um mod antigo.** Antes da 3.10.0 não há `limits` nem `sessions`. Os anéis ficam vazios e a lista diz `Sin conversaciones`.
- **O tópico `-estado` no app de alertas.** Assine no app ntfy o seu tópico simples, não o `-estado`. O tópico de estado é dado, enviado com prioridade 1, e o comentário do mod diz que ele é "not followed by push" (não acompanhado por push).
- **Esperar alertas do app do relógio.** Eles vêm pelo celular. Confira primeiro se o app ntfy ou o Narsil para Android os mostram no celular.
- **Sem opções de desenvolvedor.** No relógio, as opções de desenvolvedor precisam estar ligadas para que a depuração sem fio apareça.

Para testar o caminho inteiro de ponta a ponta:

1. No Claude Code, execute `/narsil movil`, anote o tópico e digite-o no relógio em **Configurar**.
2. Execute `/narsil movil prueba`. Ele envia um alerta de teste e, quando esse sai, um estado, mesmo da mesa.
3. Abra o app no relógio. Ele se atualiza ao abrir. A idade deve dizer `ahora` (agora).
4. Deslize até o tile. Ele mostra a mesma leitura, com os anéis preenchidos se o mod já leu os limites do Claude.

### Onde o código e o README diferem

- O README diz que o relógio lê a mensagem mais recente "every 15 minutes, and whenever you open the app or the tile" (a cada 15 minutos, e sempre que você abre o app ou o tile). O app de fato se atualiza toda vez que abre. Já o tile só pede uma atualização quando a última verificação tem mais de 15 minutos, e desenha primeiro o estado guardado ([guia 3](/pt/watch/tile/)).
- O README diz que a Narsil publica o estado "when a turn ends while you are away" (quando um turno termina enquanto você está longe). O código do mod também o publica a cada pergunta, e com o `/narsil movil prueba`, que sai mesmo da mesa.
- O próprio README do narsil-pet ainda lista cinco campos para o `-estado`. O seu código envia sete desde a 3.10.0, incluindo `limits` e `sessions` ([guia 2](/pt/watch/reading-the-state/)).

## Para ir além

- Leia o código-fonte em [github.com/davshn/narsil-watch](https://github.com/davshn/narsil-watch).
- [Alertas no celular e no relógio](/pt/mods/pet/phone-and-watch/) cobre o lado do mod: o tópico, a contagem diária e a chave.
- O [Narsil para Android](/pt/android/what-it-is/) é o app de celular que espelha os alertas no relógio.
- O próximo deste caminho: [Ler o estado da Narsil](/pt/watch/reading-the-state/), como o relógio busca, abre e guarda o estado.
- Depois, [o tile](/pt/watch/tile/), [a complicação](/pt/watch/complication/) e [o app e a sua atualização](/pt/watch/app-and-refresh/).
