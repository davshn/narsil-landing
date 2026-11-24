---
title: A complicação
description: 'Como a complicação Claude 5 h põe o limite de 5 horas em qualquer mostrador, como um arco colorido (RANGED_VALUE) ou um texto curto, e como a sua fonte de dados é avisada para se atualizar.'
route: watch
order: 4
updated: 2026-11-24
sources:
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/complication/LimitComplicationService.kt
  - repo: watch
    path: app/src/main/AndroidManifest.xml
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/sync/Refresh.kt
  - repo: watch
    path: app/src/main/res/values/strings.xml
  - repo: pet
    path: hooks/usage.ts
---

## O que faz

Uma complicação é a pequena informação que um mostrador exibe além da hora: a data, a bateria, o clima. O Narsil Watch oferece uma, chamada **Claude 5 h**. Ela põe o limite de 5 horas do Claude em qualquer mostrador que tenha um espaço livre para ela, para que você veja quanto já foi gasto toda vez que olha as horas.

Ela vem em duas formas, e é o mostrador que escolhe qual:

- **Um arco**, o tipo `RANGED_VALUE`: um anel ou uma barra preenchida de 0 a 100 %, com `62%` como texto e `5h` como título. A sua cor vai de verde a amarelo e a vermelho conforme o limite se enche.
- **Um texto curto**, o tipo `SHORT_TEXT`: só `62%` com o título `5h`, no estilo que o mostrador usar.

Um toque nela abre o app. Antes de o relógio ter lido um estado com limites, ela não mostra nada: o visual de "sem dados" do mostrador.

Para adicioná-la, abra o editor do mostrador no relógio, escolha um espaço de complicação e selecione **Claude 5 h** na lista do app Narsil.

> **Experimental.** A complicação mostra o número de 5 horas do último estado que o relógio guardou, e não traz idade nenhuma. O mod só publica esse estado enquanto você trabalha longe do computador, dentro da margem diária gratuita do ntfy.sh, e o relógio o pede no máximo a cada 15 minutos. Um número de ontem parece igual a um número de agora; abra o app ou o tile para ver há quanto tempo ele é.

## Como funciona por dentro

Tudo está em `complication/LimitComplicationService.kt`, 65 linhas. É uma fonte de dados: o mostrador lhe pede dados, e ela responde a partir do estado guardado no relógio.

### Uma fonte de dados que o sistema consulta

No Wear OS, um mostrador não chama o seu app. Quem chama é o sistema, em nome do mostrador, por meio de um serviço que o seu app declara. O manifesto declara este:

```xml
<service
    android:name=".complication.LimitComplicationService"
    android:exported="true"
    android:icon="@mipmap/ic_launcher"
    android:label="@string/complication_label"
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
```

Esse trecho é de `app/src/main/AndroidManifest.xml` do narsil-watch (GPL v3). Cada parte tem uma função:

- **`BIND_COMPLICATION_PROVIDER`**: só o sistema pode se ligar ao serviço. Ele é exportado para que o sistema o alcance, e protegido para que nada mais o faça.
- **`ACTION_COMPLICATION_UPDATE_REQUEST`**: a ação que o sistema usa para pedir dados.
- **`SUPPORTED_TYPES`**: as duas formas que ele oferece, `RANGED_VALUE` e `SHORT_TEXT`. O editor do mostrador só mostra a complicação para os espaços que aceitam uma delas.
- **`UPDATE_PERIOD_SECONDS`**: 900 segundos, 15 minutos, o mesmo ritmo da atualização.
- **O rótulo**, `@string/complication_label`, é `Claude 5 h` em `res/values/strings.xml`. É o nome na lista do editor.

### Responder a partir do estado guardado

O serviço estende `SuspendingComplicationDataSourceService`, da biblioteca de fontes de dados de complicações, então a sua resposta é uma função `suspend` do Kotlin. De `LimitComplicationService.kt` do narsil-watch (GPL v3):

```kotlin
// Claude's 5-hour limit on the watch face: an arc that turns yellow at 60 %
// and red at 85 %, as Narsil colors it.
class LimitComplicationService : SuspendingComplicationDataSourceService() {
    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
        val limit = StatusRepository(this).cached()?.limits?.find { it.key == "fiveHour" }
            ?: return NoDataComplicationData()
        return data(request.complicationType, limit)
    }

    override fun getPreviewData(type: ComplicationType): ComplicationData? =
        data(type, Limit("fiveHour", "5 horas", 62.0, "#F5B400"))
```

Duas coisas a observar:

- **Sem rede.** `onComplicationRequest` lê `cached()`, o estado guardado pelo `StatusRepository` ([guia 2](/pt/watch/reading-the-state/)). Como o tile, a complicação nunca espera pelo ntfy.sh. O sistema pode perguntar com frequência, e a resposta é sempre imediata.
- **Sem limite, sem dados.** Sem estado guardado, ou com um estado que não tem a linha `fiveHour` (um mod mais antigo, ou o Claude Code ainda não a informou), a resposta é `NoDataComplicationData()`. O mostrador então exibe o seu visual vazio em vez de um falso 0 %.

`getPreviewData` é o que o editor do mostrador desenha enquanto você escolhe uma complicação: um limite inventado de 62 %, com o rótulo `5 horas`, em amarelo. É um exemplo fixo, para que o editor mostre algo com sentido mesmo antes da primeira leitura.

### RANGED_VALUE ou SHORT_TEXT

`data(type, limit)` monta a resposta para o tipo que o mostrador pediu. Primeiro as partes comuns:

```kotlin
val percent = limit.percent.coerceIn(0.0, 100.0).toFloat()
val value = PlainComplicationText.Builder("${percent.toInt()}%").build()
val title = PlainComplicationText.Builder("5h").build()
val description = PlainComplicationText.Builder("Claude, límite de 5 horas: ${percent.toInt()} %").build()
```

- **O percentual é limitado a 0–100** e convertido num `Float`, o tipo que o valor de intervalo aceita.
- **`value`** é o texto `62%`, um número inteiro.
- **`title`** é `5h`, curto o bastante para os menores espaços.
- **`description`** é a descrição de conteúdo, o que um leitor de tela diz: `Claude, límite de 5 horas: 62 %` (Claude, limite de 5 horas: 62 %). Os dois builders exigem uma. É a versão acessível da complicação.

Um toque leva ao app por meio de um `PendingIntent` para a `MainActivity`, com `FLAG_IMMUTABLE` (ninguém pode mudar o intent) e `FLAG_UPDATE_CURRENT`.

Depois, as duas formas:

```kotlin
return when (type) {
    ComplicationType.RANGED_VALUE ->
        RangedValueComplicationData.Builder(percent, 0f, 100f, description)
            .setText(value)
            .setTitle(title)
            // seven equal steps (the most a ramp takes): green to 57 %,
            // yellow to 86 %, red after, close to Narsil's 60 / 85
            .setColorRamp(ColorRamp(intArrayOf(GREEN, GREEN, GREEN, GREEN, YELLOW, YELLOW, RED), false))
            .setTapAction(tap)
            .build()
    ComplicationType.SHORT_TEXT ->
        ShortTextComplicationData.Builder(value, description)
            .setTitle(title)
            .setTapAction(tap)
            .build()
    else -> null
}
```

Os dois trechos são de `LimitComplicationService.kt` (GPL v3).

**`RANGED_VALUE`** recebe um valor, um mínimo e um máximo: `percent`, `0f`, `100f`. O mostrador desenha o arco ou a barra por conta própria, no seu próprio estilo. O que o app acrescenta é uma **rampa de cores**, as cores que a parte preenchida deve assumir conforme o valor cresce.

**`SHORT_TEXT`** recebe só o texto e a descrição, com o título. Sem cor: é o mostrador que decide a aparência do texto.

**Qualquer outro tipo** recebe `null`. O manifesto só oferece estes dois, então o sistema nunca deveria pedir outro, e `null` é a resposta honesta se pedir.

### Por que a rampa fica perto de 60 e 85, e não exatamente neles

O tile pinta cada limite com a cor que o computador enviou ([guia 3](/pt/watch/tile/)). A complicação não pode: um valor de intervalo não tem um campo de "cor deste valor". Ele recebe uma rampa, uma lista de cores espalhadas pelo intervalo, e o mostrador escolhe a cor para o valor.

O comentário do código explica a sua escolha. Com `interpolated` definido como `false`, a rampa é dividida em degraus iguais, um por cor; sete é "the most a ramp takes" (o máximo que uma rampa aceita). Com sete degraus sobre 0–100, cada um cobre uns 14,3 %. Quatro verdes, dois amarelos e um vermelho dão:

| Faixa do limite de 5 horas | Cor      | Hex          |
| -------------------------- | -------- | ------------ |
| 0 % a uns 57 %             | Verde    | `0xFF22B573` |
| Uns 57 % a uns 86 %        | Amarelo  | `0xFFF5B400` |
| Uns 86 % a 100 %           | Vermelho | `0xFFF0435A` |

A regra da própria Narsil, `levelColor` em `hooks/usage.ts` do narsil-pet, passa a amarelo em 60 % e a vermelho em 85 %. Então, entre 57 % e 60 %, a complicação já está amarela enquanto o tile ainda está verde; e em exatamente 85 %, o tile está vermelho enquanto a complicação ainda está amarela. Três pontos no máximo, nas bordas. As três cores em si são os mesmos valores hexadecimais de `levelColor`, então a complicação se parece com o resto da Narsil.

O comentário da classe, "an arc that turns yellow at 60 % and red at 85 %" (um arco que fica amarelo em 60 % e vermelho em 85 %), descreve a intenção; o comentário da rampa ao lado descreve o que o código faz.

### Como a complicação é avisada para se atualizar

O sistema pede novos dados a uma fonte de dados de duas maneiras, e este app usa as duas.

1. **Num horário.** `UPDATE_PERIOD_SECONDS` é 900 no manifesto, então o sistema pode perguntar a cada 15 minutos. Isso é um pedido ao serviço, que responde a partir do estado guardado.
2. **Sob demanda.** Quando o app tem algo novo, ele pede ao sistema que chame o serviço de novo. Isso é `Refresh.redraw` em `sync/Refresh.kt` (GPL v3):

```kotlin
fun redraw(context: Context) {
    TileService.getUpdater(context).requestUpdate(NarsilTileService::class.java)
    ComplicationDataSourceUpdateRequester
        .create(context, ComponentName(context, LimitComplicationService::class.java))
        .requestUpdateAll()
}
```

`ComplicationDataSourceUpdateRequester.create(...)` identifica esta fonte de dados pelo seu componente, e `requestUpdateAll()` pede ao sistema que solicite dados novos para cada espaço onde ela aparece, em todo mostrador. A mesma função pede ao tile que se redesenhe.

`redraw` é chamada ao fim de cada atualização em segundo plano, pelo `RefreshWorker`, e depois de cada atualização no app ([guia 5](/pt/watch/app-and-refresh/)). Então a ordem é sempre: buscar o estado, guardá-lo, e depois avisar as superfícies. Quando o sistema chama `onComplicationRequest`, o novo estado já está em `cached()`.

O horário sozinho bastaria para manter o número andando a cada 15 minutos. O pedido sob demanda é o que faz ele mudar na hora depois que você toca em **Actualizar** (atualizar) no app.

## Construa com o Claude

Peça ao Claude uma fonte de dados de complicação para um percentual. As ideias que ele precisa acertar são que ela responde a partir de dados guardados, que oferece tanto um valor de intervalo quanto um texto curto, e que "sem dados" é uma resposta de verdade.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No meu app para Wear OS `my-watch`, acrescente uma fonte de dados de complicação `LimitComplicationService` que estenda `SuspendingComplicationDataSourceService`. Em `onComplicationRequest`, leia o limite de 5 horas do meu `StatusRepository.cached()` (um `Limit` com `key` `fiveHour` e `percent`), e devolva `NoDataComplicationData()` quando não houver nenhum. Suporte `RANGED_VALUE` (valor limitado a 0–100, mínimo 0, máximo 100, texto como `62%`, título `5h`, uma `ColorRamp` não interpolada de sete cores: quatro verdes `0xFF22B573`, duas amarelas `0xFFF5B400`, uma vermelha `0xFFF0435A`) e `SHORT_TEXT` (o mesmo texto e título); devolva `null` para os outros tipos. Dê às duas uma descrição de conteúdo, e uma ação de toque que abra a `MainActivity` com um `PendingIntent` imutável. Forneça `getPreviewData` com um exemplo de 62 %. Declare-a no manifesto com `BIND_COMPLICATION_PROVIDER`, `SUPPORTED_TYPES` `RANGED_VALUE,SHORT_TEXT` e `UPDATE_PERIOD_SECONDS` 900, e depois de cada atualização chame `ComplicationDataSourceUpdateRequester.create(...).requestUpdateAll()`.

### O que conferir na resposta do Claude

1. `onComplicationRequest` lê o estado guardado e não faz nenhuma requisição de rede.
2. Sem limite, ela devolve `NoDataComplicationData()`, não um 0 %.
3. O valor é limitado a 0–100 antes de virar o valor de intervalo.
4. Cada forma tem uma descrição de conteúdo, o texto de um leitor de tela.
5. O `PendingIntent` é `FLAG_IMMUTABLE`.
6. Os `SUPPORTED_TYPES` do manifesto listam exatamente os tipos que o código monta.
7. Algo chama `requestUpdateAll()` depois que os novos dados são guardados, não antes.

Se uma verificação falhar, diga ao Claude o que você vê: "a complicação diz 0 % logo depois que eu instalo o app", o que significa que "sem dados" está sendo respondido como zero.

### Como a pessoa autora pediu

Não existe pedido registrado para a complicação. Esta é uma reconstrução a partir do histórico de commits:

- narsil-watch `b47ca7a` (2026-11-23) "feat: Narsil on Wear OS with Claude limits and open conversations" (a Narsil no Wear OS com os limites do Claude e as conversas abertas). A complicação chega com o resto do app. A sua mensagem a cita numa única expressão: "a 5-hour complication" (uma complicação de 5 horas).
- narsil-watch `04390c8` (2026-11-24) "docs: align README with the Narsil family" (alinhar o README com a família Narsil). O README a descreve: "The **Claude 5 h** complication shows the 5-hour limit on any watch face, as an arc (`RANGED_VALUE`) or as a short text." (A complicação **Claude 5 h** mostra o limite de 5 horas em qualquer mostrador, como um arco, `RANGED_VALUE`, ou como um texto curto.)

Só o limite de 5 horas ganhou uma complicação. O código não diz por quê; o comentário da classe a chama de "Claude's 5-hour limit on the watch face" (o limite de 5 horas do Claude no mostrador), e é o limite que muda mais rápido. O limite semanal está no tile e no app.

## Código de referência

Esta é uma resposta correta, escrita para este guia. Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

Uma complicação para o limite semanal, escrita para este guia e adaptada de `LimitComplicationService.kt` do [narsil-watch](https://github.com/davshn/narsil-watch) (GPL v3). Ela usa as mesmas chamadas de biblioteca, supõe o `StatusRepository` e o `Limit` do repositório, e oferece só o texto curto:

```kotlin
package com.example.mywatch.complication

import android.app.PendingIntent
import android.content.Intent
import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.NoDataComplicationData
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService
import com.example.mywatch.data.StatusRepository
import com.example.mywatch.domain.Limit
import com.example.mywatch.presentation.MainActivity

class WeekComplicationService : SuspendingComplicationDataSourceService() {
    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
        val limit = StatusRepository(this).cached()?.limits?.find { it.key == "week" }
            ?: return NoDataComplicationData()
        return data(request.complicationType, limit)
    }

    override fun getPreviewData(type: ComplicationType): ComplicationData? =
        data(type, Limit("week", "Semana", 40.0, "#22B573"))

    private fun data(type: ComplicationType, limit: Limit): ComplicationData? {
        if (type != ComplicationType.SHORT_TEXT) return null
        val percent = limit.percent.coerceIn(0.0, 100.0).toInt()
        val tap = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        return ShortTextComplicationData.Builder(
            PlainComplicationText.Builder("$percent%").build(),
            PlainComplicationText.Builder("Claude, límite semanal: $percent %").build(),
        )
            .setTitle(PlainComplicationText.Builder("sem").build())
            .setTapAction(tap)
            .build()
    }
}
```

Declare-a no manifesto como a real, com `SUPPORTED_TYPES` definido só como `SHORT_TEXT`, e acrescente-a a `Refresh.redraw` com o seu próprio `ComplicationDataSourceUpdateRequester`.

## Erros comuns e como testar

- **Buscar dados em `onComplicationRequest`.** O sistema a chama quando quiser. Responda a partir do estado guardado.
- **Zero para "sem dados".** Um falso 0 % parece muita margem. `NoDataComplicationData()` é a resposta verdadeira.
- **Tipos descompassados.** Se o manifesto oferece um tipo para o qual o código devolve `null`, o espaço fica vazio.
- **Uma rampa com cores demais.** O comentário do código diz que sete é o máximo que uma rampa aceita.
- **Esperar os limiares exatos.** Com sete degraus iguais, a rampa muda em uns 57 % e 86 %, não em 60 % e 85 %.
- **Sem descrição de conteúdo.** Os builders exigem uma, e um leitor de tela depende dela.
- **Atualizar antes de guardar.** Chame `requestUpdateAll()` depois que o novo estado estiver guardado, senão o sistema lê o antigo.
- **Ler o número como se fosse ao vivo.** Ele não tem idade. Quando isso importar, abra o tile ou o app.

A complicação não tem teste automatizado; os testes unitários cobrem o estado que ela lê ([guia 2](/pt/watch/reading-the-state/)). No relógio:

1. Adicione **Claude 5 h** a um espaço que aceite um valor de intervalo. A prévia do editor mostra 62 % em amarelo.
2. Antes de qualquer leitura, o espaço parece vazio.
3. Execute `/narsil movil prueba` no Claude Code, depois abra o app e toque em **Actualizar**. O espaço deve mudar na hora para o seu número real de 5 horas.
4. Experimente um espaço que só aceite texto curto: o mesmo número, sem o arco.

### Onde o código e o README diferem

- O comentário da classe diz que o arco "turns yellow at 60 % and red at 85 %" (fica amarelo em 60 % e vermelho em 85 %). A rampa que ele monta muda em uns 57 % e 86 %, como diz o comentário ao lado da rampa.
- O README diz que a complicação mostra o limite "as an arc (`RANGED_VALUE`) or as a short text" (como um arco, `RANGED_VALUE`, ou como um texto curto). Quem escolhe qual é o mostrador, pelo tipo que o seu espaço aceita.

## Para ir além

- Leia `complication/LimitComplicationService.kt` do [narsil-watch](https://github.com/davshn/narsil-watch).
- Um `RANGED_VALUE` com `interpolated` definido como `true` mistura as cores suavemente em vez de em degraus. Você trocaria os limiares nítidos por um gradiente; experimente os dois no seu mostrador.
- O estado traz `resetsAt` para o limite de 5 horas. Uma complicação poderia mostrar "reinicia en 2 h" (reinicia em 2 h) em vez do percentual, com `resetLabel` de `Display.kt`.
- Volte para [o tile](/pt/watch/tile/), ou para como o estado é lido: [Ler o estado da Narsil](/pt/watch/reading-the-state/).
- A seguir: [O app e a atualização](/pt/watch/app-and-refresh/), a lista de conversas, a configuração e o job de 15 minutos.
