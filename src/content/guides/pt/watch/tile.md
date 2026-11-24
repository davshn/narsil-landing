---
title: O tile
description: 'Como o tile Narsil · Claude desenha os limites de 5 horas e semanal como dois anéis nas cores da Narsil, com a Narsil na pose da sua conversa mais importante e a idade da leitura.'
route: watch
order: 3
updated: 2026-11-24
sources:
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/tile/NarsilTileService.kt
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/domain/Display.kt
  - repo: watch
    path: app/src/test/kotlin/tech/davshn/narsilwatch/domain/DisplayTest.kt
  - repo: pet
    path: hooks/phone.ts
  - repo: pet
    path: hooks/fleet.ts
  - repo: pet
    path: hooks/usage.ts
---

## O que faz

Deslize para o lado a partir do mostrador e você chega ao tile **Narsil · Claude**. Num relance, ele responde a três perguntas: quanto dos limites do Claude já foi gasto, se alguma conversa está esperando por você, e há quanto tempo é essa informação.

De fora para dentro:

- **O anel externo** é o limite de 5 horas. A parte usada é desenhada na sua cor, começando no topo e seguindo no sentido horário; o resto é uma trilha escura.
- **O anel interno**, mais fino, é o limite semanal, desenhado do mesmo jeito.
- **A Narsil no meio**, no estágio atual dela, na pose da sua conversa mais importante: trabalhando, esperando por você, terminada, parada ou com falha.
- **Quatro linhas curtas abaixo dela**, por exemplo:

```text
5 h 62%
sem 90%
1 te necesita
hace 12 min
```

As duas primeiras são os limites ("sem" de "semana"), cada uma na sua cor. A terceira é sobre as suas conversas: `1 te necesita` (1 precisa de você), `2 te necesitan` (2 precisam de você), ou, quando nenhuma está esperando, o estado da primeira em minúsculas, como `trabajando` (trabalhando). Sem conversas, ela diz `sin conversaciones` (sem conversas). A última linha é a idade da leitura: `ahora` (agora), `hace 12 min` (há 12 minutos), `hace 3 h`, `hace 2 d`.

Antes de o relógio ter qualquer estado, os limites dizem `5 h –` e `sem –`, os anéis ficam vazios, e a última linha diz `configúrame` (configure-me). Um toque em qualquer lugar do tile abre o app.

> **Experimental.** O tile desenha o último estado que o relógio guardou, e esse estado só é tão recente quanto a última publicação do mod: o mod só publica enquanto você trabalha longe do computador, dentro da margem diária gratuita do ntfy.sh. O tile pede uma nova leitura no máximo a cada 15 minutos. Leia a linha da idade antes dos números.

## Como funciona por dentro

Tudo vive em `tile/NarsilTileService.kt`, com os textos e as cores em `domain/Display.kt`. A pose e as cores são decididas pelo mod no seu computador; o tile só as desenha.

### Um TileService que responde com um layout

Um tile do Wear OS não é uma tela que você programa com Compose. É um serviço, `TileService`, ao qual o sistema pede uma descrição do layout, construída com a biblioteca ProtoLayout. O sistema a desenha e chama o serviço de novo quando quer uma nova. O manifesto o declara com a permissão e a ação `BIND_TILE_PROVIDER`, o rótulo `@string/tile_label` ("Narsil · Claude") e uma imagem de prévia, `@drawable/narsil_preview`.

O serviço responde a dois pedidos: o tile (o seu layout) e os seus recursos (as imagens que ele cita). Os dois devolvem um `ListenableFuture`, e o código os escreve como corrotinas Kotlin com `SuspendToFutureAdapter.launchFuture`. De `NarsilTileService.kt` do narsil-watch (GPL v3):

```kotlin
override fun onTileRequest(requestParams: RequestBuilders.TileRequest): ListenableFuture<TileBuilders.Tile> =
    SuspendToFutureAdapter.launchFuture {
        if (System.currentTimeMillis() - repo.checkedAt > STALE_MS) Refresh.now(this@NarsilTileService)
        val state = repo.cached()
        TileBuilders.Tile.Builder()
            .setResourcesVersion(resourcesVersion())
            .setFreshnessIntervalMillis(STALE_MS)
            .setTileTimeline(TimelineBuilders.Timeline.fromLayoutElement(layout(state)))
            .build()
    }
```

### Quando ele pede uma nova leitura

Essa primeira linha importa. `STALE_MS` é 15 minutos. Se o relógio não tem notícias do ntfy.sh há mais tempo que isso, o tile chama `Refresh.now`, que enfileira uma atualização em segundo plano com o WorkManager. Ele **não** espera por ela. Ele desenha na hora a partir de `repo.cached()`, o estado guardado no relógio.

Quando a atualização em segundo plano termina, ela pede ao sistema que redesenhe o tile ([guia 5](/pt/watch/app-and-refresh/)). O sistema chama `onTileRequest` de novo; a essa altura `checkedAt` está recente, então nenhuma segunda atualização é enfileirada, e o tile desenha o novo estado. Duas passadas, e o tile nunca mostra um indicador de carregamento.

`setFreshnessIntervalMillis(STALE_MS)` também diz ao sistema que vale a pena pedir o layout de novo depois de 15 minutos, para que a linha da idade avance mesmo quando nada mais acontece.

### Dois anéis

Cada anel é um `Arc` do ProtoLayout com dois `ArcLine`s: a parte usada e a trilha. De `NarsilTileService.kt` (GPL v3):

```kotlin
// A full ring: the used part in the limit's color, the rest as track.
private fun ring(limit: Limit?, thickness: Float): LayoutElement {
    val used = ((limit?.percent ?: 0.0).coerceIn(0.0, 100.0) * 3.6).toFloat()
    val arc = LayoutElementBuilders.Arc.Builder()
        .setAnchorAngle(degrees(0f))
        .setAnchorType(LayoutElementBuilders.ARC_ANCHOR_START)
    if (used > 0f) arc.addContent(arcLine(used, thickness, limit?.let { parseColor(it.color) } ?: Palette.DIM))
    if (used < 360f) arc.addContent(arcLine(360f - used, thickness, Palette.TRACK))
    return arc.build()
}
```

Lendo-o:

- **Do percentual aos graus.** Um círculo completo tem 360 graus, então 1 % são 3,6. Antes, o percentual é limitado a 0–100, para que um valor estranho nunca desenhe mais de uma volta.
- **Onde ele começa.** A âncora é 0 grau, o topo da tela, e `ARC_ANCHOR_START` significa que o arco começa ali e corre no sentido horário.
- **Duas peças, nunca uma vazia.** Em 0 % só há trilha; em 100 %, só cor.
- **Sem limite, sem cor.** Sem leitura, `percent` conta como 0, então o anel inteiro é trilha.

O layout põe os anéis um dentro do outro. O `Box` externo preenche o tile, tem o fundo escuro `Palette.BG` e contém o anel de 5 horas, com 7 dp de espessura (`RING`). Dentro dele, um segundo `Box` com um padding de `RING + GAP` (7 + 3 dp) contém o anel semanal, com 5 dp de espessura (`RING_INNER`), e a coluna do meio. O padding é o que mantém o anel interno 3 dp para dentro do externo em qualquer tamanho de tela.

### As cores: decididas no computador, lidas no relógio

O README diz que os anéis são "colored as Narsil colors them: green, yellow from 60 %, and red from 85 %" (coloridos como a Narsil os colore: verde, amarelo a partir de 60 % e vermelho a partir de 85 %). Vale a pena saber onde essa regra vive, porque ela não está no relógio.

O mod decide a cor de cada limite quando publica o estado. `levelColor` em `hooks/usage.ts` do narsil-pet (GPL v3):

```ts
export function levelColor(percent: number): string {
  return percent >= 85 ? '#F0435A' : percent >= 60 ? '#F5B400' : '#22B573'
}
```

`watchLimits` em `hooks/phone.ts` põe o resultado no campo `color` de cada limite ([guia 2](/pt/watch/reading-the-state/)). O relógio só transforma esse texto numa cor, com `parseColor` em `domain/Display.kt` (GPL v3):

```kotlin
// A #RRGGBB color as the PC sends it; dim for anything else.
fun parseColor(hex: String): Int {
    val digits = hex.removePrefix("#")
    if (digits.length != 6) return Palette.DIM
    val rgb = digits.toLongOrNull(16) ?: return Palette.DIM
    return (0xFF000000L or rgb).toInt()
}
```

Então um limite de 62 % é amarelo no relógio porque é amarelo no computador. Se o mod algum dia mudar os seus limiares, o relógio acompanha sem atualização. Uma cor que não tenha seis dígitos hexadecimais vira `Palette.DIM`, um cinza apagado, em vez de um erro; o teste "reads a level color, and falls back to dim on noise" (lê uma cor de nível e recorre ao apagado diante de ruído) confere `#22B573` e a palavra `rojo` (vermelho).

`Display.kt` contém as cores que o próprio relógio decide. O comentário no seu topo: "How the watch says things, in Narsil's words and colors (overlay.html, dark theme). Pure functions, so the tile, the complication and the app read the same." (Como o relógio diz as coisas, nas palavras e cores da Narsil, overlay.html, tema escuro. Funções puras, para que o tile, a complicação e o app leiam o mesmo.) A sua `Palette` tem o fundo `0xFF16182A`, o texto `0xFFECEBF3`, o cinza apagado `0xFF9A98AD`, a trilha `0xFF2A2D45` e o destaque `0xFF7C6CF0`. A sua `statusColor` dá a cada estado de conversa a cor que a Narsil usa para ele: `working` azul `0xFF3B8BFF`, `idle` cinza `0xFF8A90A6`, `waiting` amarelo `0xFFF5B400`, `done` verde `0xFF22B573` e `error` vermelho `0xFFF0435A`. Um estado desconhecido recorre ao cinza de `idle`.

### A Narsil no meio: o desenho

A coluna do meio começa com uma `Image` de 40 dp de largura e 66 dp de altura, que cita um recurso, `ART_ID` (`"narsil"`). A imagem em si vem de `onTileResourcesRequest`:

- **Se o relógio já baixou um desenho**, `repo.art()` devolve os seus bytes, e eles entram como um recurso de imagem inline.
- **Se ainda não**, o tile usa o desenho que vem com o app, `R.drawable.narsil_preview`.

O desenho vem do repositório [narsil-pet](https://github.com/davshn/narsil-pet) no GitHub. O `StatusRepository` baixa a URL do campo `art` do estado, só se ela começar com `https://raw.githubusercontent.com/davshn/narsil-pet/`, e a guarda como `art.png` ([guia 2](/pt/watch/reading-the-state/)). O README dá o crédito: "Narsil's art is © its author and comes from the narsil-pet repository." (A arte da Narsil é © da sua pessoa autora e vem do repositório narsil-pet.)

O sistema faz cache dos recursos por uma string de versão, então o tile precisa mudar a versão sempre que a imagem muda. `resourcesVersion()` é o hash dos bytes da imagem, ou `"preview"` quando não há nenhuma:

```kotlin
private fun resourcesVersion(): String = repo.art()?.contentHashCode()?.toString() ?: "preview"
```

Nova pose, novos bytes, nova versão, e o sistema pede os recursos de novo. Mesma pose, mesma versão, e nada é recarregado.

### Qual pose: a conversa mais importante

O tile não escolhe a pose. O mod escolhe, e a nomeia na URL. Em `sendStatus` (`hooks/register.tsx` do narsil-pet):

```ts
art: artUrl(POSE[list[0]!.status], stageOf(levelOf(earned).level)),
```

Três peças decidem essa URL:

1. **A lista é ordenada.** `list` vem de `fleetOf` em `hooks/fleet.ts`, que ordena cada conversa aberta por `RANK`, com o comentário "An error first, then what needs you, what works, what finished" (primeiro um erro, depois o que precisa de você, o que trabalha, o que terminou): `error` 0, `waiting` 1, `working` 2, `done` 3, `idle` 4. Entre duas do mesmo nível, a que mudou mais recentemente vai primeiro. Então `list[0]` é a conversa mais importante: qualquer erro vence uma pergunta, qualquer pergunta vence um trabalho em andamento.
2. **A pose é a do estado.** `POSE` em `hooks/sprite.ts` nomeia as imagens: `trabajando`, `parada`, `necesita`, `terminado`, `error`.
3. **O estágio é o crescimento da Narsil.** `stageOf` em `hooks/xp.ts` dá o estágio 1 a 5 a partir do nível dela, começando nos níveis 1, 5, 10, 20 e 35.

`artUrl` em `hooks/phone.ts` os junta: a base `https://raw.githubusercontent.com/davshn/narsil-pet/main/assets`, depois `etapa<stage>/` para os estágios 2 a 5 ("etapa" é "estágio"), depois `<pose>-oscuro.png`. O relógio sempre recebe o desenho escuro (`oscuro`), que combina com o fundo escuro do tile. Uma conversa que falhou, no estágio 3, é `.../assets/etapa3/error-oscuro.png`.

### As quatro linhas de texto

Abaixo do desenho, quatro elementos `Text`, cada um de uma linha (`setMaxLines(1)`):

```kotlin
.addContent(text(limitLine(fiveHour, "5 h"), 13f, fiveHour?.let { parseColor(it.color) } ?: Palette.DIM, bold = true))
.addContent(text(limitLine(week, "sem"), 11f, week?.let { parseColor(it.color) } ?: Palette.DIM))
.addContent(text(fleetLine(state), 11f, fleetColor(state)))
.addContent(text(state?.let { ageLabel(it.at, System.currentTimeMillis() / 1000) } ?: "configúrame", 9f, Palette.DIM))
```

Essas linhas são de `NarsilTileService.kt` (GPL v3). Os tamanhos dão a hierarquia: o número de 5 horas com 13 sp e em negrito, porque é o que muda mais rápido e acaba primeiro; a semana e as conversas com 11 sp; a idade com 9 sp, em cinza.

- **`limitLine`** escreve `5 h 62%`, com o percentual cortado para um número inteiro (`toInt()`), ou `5 h –` sem limite.
- **`fleetLine`** conta as conversas que precisam de você com `needsYou` de `Display.kt`, que é `sessions.count { it.status == "waiting" }`. Uma dá `1 te necesita`, várias dão `2 te necesitan`. Sem nenhuma esperando, ela mostra o rótulo da primeira conversa em minúsculas; sem conversas, `sin conversaciones`.
- **`fleetColor`** colore essa linha com a cor do estado da primeira conversa, então uma linha vermelha significa que a conversa mais importante falhou.
- **`ageLabel`** mede a partir de `at`, o momento em que o computador enviou o estado, não o momento em que o relógio o leu. Essa é a idade honesta: um estado lido há um minuto mas enviado há três horas diz `hace 3 h`.

`ageLabel`, de `Display.kt` (GPL v3):

```kotlin
// How old the state is: the PC publishes only while you are away.
fun ageLabel(at: Long, nowSeconds: Long): String {
    val minutes = (nowSeconds - at).coerceAtLeast(0) / 60
    return when {
        minutes < 1 -> "ahora"
        minutes < 60 -> "hace $minutes min"
        minutes < 24 * 60 -> "hace ${minutes / 60} h"
        else -> "hace ${minutes / (24 * 60)} d"
    }
}
```

`coerceAtLeast(0)` protege contra um relógio um pouco atrasado em relação ao computador: um estado "do futuro" diz `ahora`, não uma idade negativa.

### Um toque abre o app

O `Box` externo tem um `Clickable` cuja ação é um `LaunchAction` para a `MainActivity`, no próprio pacote do app. O tile inteiro é um único alvo grande, o que combina com uma tela redonda pequena.

## Construa com o Claude

Peça ao Claude um tile que desenhe limites como anéis a partir de um estado guardado. As ideias que ele precisa acertar são que o tile nunca espera pela rede, e que a cor vem do estado e não de limiares no relógio.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No meu app para Wear OS `my-watch`, acrescente um `TileService` com ProtoLayout. Ele lê o estado guardado do meu `StatusRepository.cached()` (um `NarsilState` com `limits` de `key` `fiveHour` e `week`, cada um com `percent` e uma `color` `#RRGGBB`, e `sessions` com `status` e `label`). Desenhe o limite de 5 horas como um anel externo de 7 dp de espessura e a semana como um anel interno de 5 dp de espessura, 3 dp para dentro dele; cada anel é um `Arc` ancorado em 0 grau com `ARC_ANCHOR_START`, a parte usada com `percent × 3.6` graus na cor do limite e o resto numa cor de trilha. No meio, um recurso de imagem com a imagem guardada, recorrendo a um drawable incluído no app, com a versão dos recursos definida como um hash dos bytes da imagem. Abaixo, `5 h 62%`, `sem 90%`, quantas sessões têm status `waiting`, e a idade a partir do campo `at` do estado. Se a última verificação tiver mais de 15 minutos, enfileire uma atualização em segundo plano sem esperar por ela. Um toque abre a `MainActivity`. Ponha os textos e a interpretação das cores em funções puras com testes JUnit.

### O que conferir na resposta do Claude

1. `onTileRequest` desenha a partir do estado guardado e nunca espera por uma chamada de rede.
2. Os graus do anel são o percentual, limitado a 0–100, vezes 3,6, e nenhum `ArcLine` é acrescentado com comprimento 0.
3. A cor vem do campo `color` do limite, por meio de um parser que recorre a uma cor neutra, e não de limiares fixos no código do tile.
4. A versão dos recursos muda quando a imagem muda.
5. A idade é medida a partir do `at` do estado, não de quando o relógio o leu.
6. Sem estado, o tile ainda desenha: anéis vazios, traços e uma dica para configurá-lo.

Se uma verificação falhar, diga ao Claude o que você vê: "o tile mostra a pose antiga mesmo depois que o app mostra a nova", o que aponta para uma versão dos recursos que não muda.

### Como a pessoa autora pediu

Não existe pedido registrado para o tile. Esta é uma reconstrução a partir do histórico de commits:

- narsil-pet `6400a6f` (2026-11-23) "feat(phone): publish Claude limits and open conversations for the watch" (publicar os limites do Claude e as conversas abertas para o relógio). Ele acrescenta `limits`, com a `color` de cada limite vinda de `levelColor`, e `sessions` ordenadas por importância, que é o que permite ao tile tirar as duas coisas do estado.
- narsil-watch `b47ca7a` (2026-11-23) "feat: Narsil on Wear OS with Claude limits and open conversations" (a Narsil no Wear OS com os limites do Claude e as conversas abertas). A sua mensagem começa pelo tile: "A tile with the 5-hour and weekly limits as rings and Narsil in her current pose" (um tile com os limites de 5 horas e semanal como anéis e a Narsil na sua pose atual).

O próprio comentário do arquivo é o enunciado mais curto do design: "The tile: the 5-hour limit as the outer ring, the week as the inner one, Narsil in the middle in her current pose, and who needs you." (O tile: o limite de 5 horas como o anel externo, a semana como o interno, a Narsil no meio na sua pose atual, e quem precisa de você.)

## Código de referência

Esta é uma resposta correta, escrita para este guia. Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

Um tile reduzido, com um anel e uma linha, escrito para este guia e adaptado de `NarsilTileService.kt` do [narsil-watch](https://github.com/davshn/narsil-watch) (GPL v3). Ele usa as mesmas chamadas de ProtoLayout e de Tiles que esse arquivo, e supõe o `StatusRepository`, o `Limit`, a `Palette` e o `parseColor` das pastas `data/` e `domain/` do repositório:

```kotlin
package com.example.mywatch.tile

import androidx.concurrent.futures.SuspendToFutureAdapter
import androidx.wear.protolayout.ColorBuilders.argb
import androidx.wear.protolayout.DimensionBuilders.degrees
import androidx.wear.protolayout.DimensionBuilders.dp
import androidx.wear.protolayout.DimensionBuilders.expand
import androidx.wear.protolayout.DimensionBuilders.sp
import androidx.wear.protolayout.LayoutElementBuilders
import androidx.wear.protolayout.LayoutElementBuilders.LayoutElement
import androidx.wear.protolayout.ModifiersBuilders
import androidx.wear.protolayout.ResourceBuilders
import androidx.wear.protolayout.TimelineBuilders
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import com.example.mywatch.data.StatusRepository
import com.example.mywatch.domain.Limit
import com.example.mywatch.domain.Palette
import com.example.mywatch.domain.parseColor
import com.google.common.util.concurrent.ListenableFuture

class LimitTileService : TileService() {
    private val repo by lazy { StatusRepository(this) }

    override fun onTileRequest(requestParams: RequestBuilders.TileRequest): ListenableFuture<TileBuilders.Tile> =
        SuspendToFutureAdapter.launchFuture {
            val fiveHour = repo.cached()?.limits?.find { it.key == "fiveHour" }
            TileBuilders.Tile.Builder()
                .setResourcesVersion("1")
                .setFreshnessIntervalMillis(15 * 60_000L)
                .setTileTimeline(TimelineBuilders.Timeline.fromLayoutElement(layout(fiveHour)))
                .build()
        }

    override fun onTileResourcesRequest(requestParams: RequestBuilders.ResourcesRequest): ListenableFuture<ResourceBuilders.Resources> =
        SuspendToFutureAdapter.launchFuture {
            ResourceBuilders.Resources.Builder().setVersion(requestParams.version).build()
        }

    private fun layout(limit: Limit?): LayoutElement {
        val color = limit?.let { parseColor(it.color) } ?: Palette.DIM
        val used = ((limit?.percent ?: 0.0).coerceIn(0.0, 100.0) * 3.6).toFloat()
        val arc = LayoutElementBuilders.Arc.Builder()
            .setAnchorAngle(degrees(0f))
            .setAnchorType(LayoutElementBuilders.ARC_ANCHOR_START)
        if (used > 0f) arc.addContent(arcLine(used, color))
        if (used < 360f) arc.addContent(arcLine(360f - used, Palette.TRACK))
        val label = LayoutElementBuilders.Text.Builder()
            .setText(limit?.let { "5 h ${it.percent.toInt()}%" } ?: "5 h –")
            .setMaxLines(1)
            .setFontStyle(LayoutElementBuilders.FontStyle.Builder().setSize(sp(13f)).setColor(argb(color)).build())
            .build()
        return LayoutElementBuilders.Box.Builder()
            .setWidth(expand())
            .setHeight(expand())
            .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
            .setVerticalAlignment(LayoutElementBuilders.VERTICAL_ALIGN_CENTER)
            .setModifiers(
                ModifiersBuilders.Modifiers.Builder()
                    .setBackground(ModifiersBuilders.Background.Builder().setColor(argb(Palette.BG)).build())
                    .build(),
            )
            .addContent(arc.build())
            .addContent(label)
            .build()
    }

    private fun arcLine(length: Float, color: Int) =
        LayoutElementBuilders.ArcLine.Builder()
            .setLength(degrees(length))
            .setThickness(dp(7f))
            .setColor(argb(color))
            .build()
}
```

Ele não tem imagem, então os seus recursos são vazios e a versão nunca muda. Para acrescentar a Narsil, siga o arquivo real: uma `Image` com um id de recurso no layout, os bytes em `onTileResourcesRequest`, e uma versão que seja o hash desses bytes. Declare o serviço no manifesto como o [guia 1](/pt/watch/what-it-is/) mostra.

## Erros comuns e como testar

- **Esperar pela rede em `onTileRequest`.** O sistema espera uma resposta rápida. Desenhe a partir do estado guardado e atualize em segundo plano.
- **Atualizar a cada pedido do tile.** Cada deslizada custaria uma requisição. A verificação de 15 minutos a limita a uma por janela.
- **Uma versão de recursos fixa.** A imagem nunca se atualiza, porque o sistema fica com a que está em cache.
- **Fixar 60 e 85 no código do relógio.** Funciona até o mod mudar a sua regra. Pinte a cor que o estado traz.
- **Um arco de comprimento zero.** Acrescente a parte usada só quando ela passar de 0 grau, e a trilha só abaixo de 360.
- **Medir a idade a partir da leitura.** A idade que importa é desde que o computador o enviou.
- **Esquecer o estado vazio.** Antes da primeira leitura, o tile ainda precisa desenhar e dizer para você configurá-lo.

Para testar a lógica sem um relógio, rode os testes unitários:

```bash
./gradlew :app:testDebugUnitTest
```

`DisplayTest.kt` cobre o que o tile escreve e pinta: "counts the conversations that need you" (conta as conversas que precisam de você; duas `waiting` entre quatro), "says how old the state is" (diz a idade do estado; `ahora`, `hace 12 min`, `hace 3 h`, `hace 2 d`), "colors a status as Narsil does" (colore um estado como a Narsil faz) e "reads a level color, and falls back to dim on noise" (lê uma cor de nível e recorre ao apagado diante de ruído). O layout em si não tem teste automatizado.

No relógio: instale o app, adicione o tile e execute `/narsil movil prueba` no Claude Code. Abra o app uma vez para que ele se atualize, e então deslize até o tile. Ele deve mostrar a nova idade, e a pose da sua conversa mais importante.

### Onde o código e o README diferem

- O README diz que o relógio lê o estado "whenever you open the app or the tile" (sempre que você abre o app ou o tile). O tile só pede quando a última verificação tem mais de 15 minutos, e desenha o estado guardado antes de o novo chegar.
- Um comentário em `NarsilTileService.kt` diz "the art Narsil publishes is 91 x 150" (a arte que a Narsil publica tem 91 x 150), e declara a imagem inline com esses tamanhos (`ART_W`, `ART_H`). Os desenhos escuros em `assets/` do narsil-pet hoje têm todos 150 pixels de altura, mas entre 91 e 106 pixels de largura, conforme a pose e o estágio. O `narsil_preview.png` incluído no app tem 91 x 150. O tile mostra a imagem numa caixa fixa de 40 x 66 dp de qualquer jeito.
- O README diz que a Narsil fica "above how many conversations need you" (acima de quantas conversas precisam de você). Quando nenhuma precisa de você, a linha mostra no lugar o estado da primeira conversa, o que o README não menciona.

## Para ir além

- Leia `tile/NarsilTileService.kt` do [narsil-watch](https://github.com/davshn/narsil-watch).
- O anel poderia marcar onde o limite reinicia: o estado traz `resetsAt` para cada limite, e o tile ainda não o usa.
- Como a contagem de conversas que precisam de você sai de no máximo 8 sessões, um computador com muitas conversas com falha poderia empurrar uma que está esperando para fora da lista. A ordenação põe os erros primeiro, então isso exigiria nove conversas ou mais.
- Como o estado chega ao relógio: [Ler o estado da Narsil](/pt/watch/reading-the-state/). O lado do mod: [Alertas no celular e no relógio](/pt/mods/pet/phone-and-watch/).
- A seguir: [A complicação](/pt/watch/complication/), o limite de 5 horas em qualquer mostrador.
