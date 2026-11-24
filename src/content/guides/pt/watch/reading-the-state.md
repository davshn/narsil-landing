---
title: Ler o estado da Narsil
description: 'O que o mod publica agora em <topic>-estado, limites e conversas incluídos, e como o relógio busca a última mensagem no ntfy.sh, abre o seu selo com a sua chave e a guarda.'
route: watch
order: 2
updated: 2026-11-24
sources:
  - repo: pet
    path: hooks/phone.ts
  - repo: pet
    path: hooks/seal.ts
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/domain/NarsilState.kt
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/data/StatusParser.kt
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/data/StatusRepository.kt
  - repo: watch
    path: app/src/main/kotlin/tech/davshn/narsilwatch/data/Seal.kt
  - repo: watch
    path: app/src/test/kotlin/tech/davshn/narsilwatch/data/SealTest.kt
---

## O que faz

Tudo o que o relógio mostra vem de uma pequena mensagem JSON. O mod Narsil a escreve no seu computador e a publica no ntfy.sh, no tópico `<o seu tópico>-estado`. O relógio lê a mais recente, abre-a se estiver selada, e a guarda para que o tile, a complicação e o app possam desenhar a partir dela a qualquer momento.

Este guia acompanha essa mensagem de uma ponta à outra: o que o mod põe nela desde o narsil-pet 3.10.0, as classes Kotlin em que ela é lida (`NarsilState.kt`), a requisição e o que é guardado (`StatusRepository.kt`), a interpretação (`StatusParser.kt`) e o selo (`Seal.kt`), incluindo o que acontece com uma chave errada ou com uma mensagem não selada.

> **Experimental.** O relógio só consegue ler o que o mod publicou por último, e o mod só publica enquanto você está longe do computador, dentro da margem diária gratuita do ntfy.sh. O ntfy.sh guarda uma mensagem por um tempo limitado, então um longo período de silêncio deixa o relógio com a sua própria última cópia. E o formato do estado é um acordo privado entre dois projetos: uma mudança no mod pode quebrar a leitura.

Os exemplos usam só valores inventados: o tópico `narsil-0000000000example0` e chaves falsas.

## Como funciona por dentro

### O lado do mod: o que o `-estado` leva agora

`sendStatus` em `hooks/register.tsx` do narsil-pet monta o estado, e `phoneStatus` em `hooks/phone.ts` o embrulha para o ntfy.sh: `{ topic: "<topic>-estado", message: JSON.stringify(state), priority: 1 }`. O estado em si é um objeto JSON com sete campos desde o commit `6400a6f`, "feat(phone): publish Claude limits and open conversations for the watch" (publicar os limites do Claude e as conversas abertas para o relógio), lançado como 3.10.0:

| Campo          | O que é                                                                             | O relógio o usa?        |
| -------------- | ----------------------------------------------------------------------------------- | ----------------------- |
| `xp`           | O rótulo de nível da Narsil, como `⭐ Nivel 3 · 120/300 XP` (nível 3).              | Sim, no app.            |
| `art`          | A URL do desenho dela, no estágio dela, na pose da conversa aberta mais importante. | Sim, tile e app.        |
| `at`           | Quando foi enviado, em segundos Unix.                                               | Sim, o rótulo de idade. |
| `cacheMinutes` | Quanto dura o cache do prompt; ausente quando nenhuma conversa tem um.              | Lido, não mostrado.     |
| `usage`        | Uma linha, `ntfy`, com a contagem do ntfy.sh das mensagens de hoje da sua rede.     | Não, ignorado.          |
| `limits`       | Os limites de 5 horas e semanal do Claude: percentual, cor e reinício.              | Sim, em todo lugar.     |
| `sessions`     | Até 8 conversas abertas, a mais importante primeiro: título, estado e rótulo.       | Sim, tile e app.        |

Os dois campos novos são montados por duas funções puras no fim de `hooks/phone.ts`. Estes trechos são do narsil-pet (GPL v3); o formatador deste site quebrou as suas linhas longas e acrescentou vírgulas finais e parênteses, e nada mais difere do arquivo:

```ts
// One Claude limit as the watch draws it: its arc, its color and when it
// resets, in seconds since the epoch (null when Claude did not say).
export type WatchLimit = {
  key: 'fiveHour' | 'week'
  label: string
  percent: number
  color: string
  resetsAt: number | null
}

type Meter = { percent: number; resetsAt?: string }

// The 5-hour and weekly limits; the context is each conversation's own.
export function watchLimits(u: { fiveHour: Meter | null; week: Meter | null }): WatchLimit[] {
  const row = (key: WatchLimit['key'], label: string, m: Meter | null): WatchLimit[] => {
    if (!m) return []
    const at = m.resetsAt ? Date.parse(m.resetsAt) : NaN
    return [
      {
        key,
        label,
        percent: m.percent,
        color: levelColor(m.percent),
        resetsAt: Number.isNaN(at) ? null : Math.floor(at / 1000),
      },
    ]
  }
  return [...row('fiveHour', '5 horas', u.fiveHour), ...row('week', 'Semana', u.week)]
}
```

E logo abaixo, as conversas:

```ts
export type WatchSession = { title: string; status: string; label: string }

// The open conversations, most important first, as few and as short as an
// ntfy message (4 KB, more once sealed) holds with room to spare.
export const WATCH_SESSIONS = 8
const WATCH_TITLE = 40

export function watchSessions(list: readonly WatchSession[]): WatchSession[] {
  return list.slice(0, WATCH_SESSIONS).map((s) => {
    const title = s.title || 'conversación'
    return {
      title: title.length > WATCH_TITLE ? `${title.slice(0, WATCH_TITLE - 1)}…` : title,
      status: s.status,
      label: s.label,
    }
  })
}
```

O que observar:

- **`limits` tem zero, uma ou duas linhas**, `fiveHour` com o rótulo `5 horas` e `week` com o rótulo `Semana` (semana). Um limite que o Claude Code não informou fica de fora, em vez de ser enviado como zero, e `resetsAt` vem em segundos, ou `null` quando o Claude não disse. Os valores vêm do `usage` do mod, que `usageOf` em `hooks/usage.ts` preenche a partir dos limites de uso da sessão do tipo `five_hour` e `seven_day`, os mesmos que a linha de status do Claude Code lê.
- **A cor é decidida no computador.** `levelColor` em `hooks/usage.ts` devolve `#F0435A` (vermelho) a partir de 85 %, `#F5B400` (amarelo) a partir de 60 % e `#22B573` (verde) abaixo disso. O relógio pinta o que lhe dizem, então o computador e o relógio nunca discordam.
- **`sessions` é a lista ordenada do mod.** `fleetOf` em `hooks/fleet.ts` ordena por `RANK`, "An error first, then what needs you, what works, what finished" (primeiro um erro, depois o que precisa de você, o que trabalha, o que terminou): `error`, `waiting`, `working`, `done`, `idle`. Entre iguais, a que mudou mais recentemente vem primeiro.
- **No máximo 8 sessões, títulos de no máximo 40 caracteres.** O comentário dá o motivo: uma mensagem do ntfy é limitada a 4 KB, e a selagem a torna mais longa. Um título vazio vira `conversación` (conversa).
- **`status` é a palavra da máquina e `label` a palavra da tela**, de `STATUS_LABEL` em `hooks/words.ts`: `working` é `TRABAJANDO`, `idle` é `PARADA`, `waiting` é `TE NECESITA`, `done` é `TERMINADA`, `error` é `ERROR`. O relógio colore pelo `status` e escreve o `label`.

Um estado tal como o relógio o recebe, escrito para este guia com valores inventados:

```json
{
  "xp": "⭐ Nivel 3 · 40/300 XP",
  "art": "https://raw.githubusercontent.com/davshn/narsil-pet/main/assets/etapa3/error-oscuro.png",
  "at": 1763900000,
  "cacheMinutes": 5,
  "usage": [],
  "limits": [
    {
      "key": "fiveHour",
      "label": "5 horas",
      "percent": 62.4,
      "color": "#F5B400",
      "resetsAt": 1763918000
    },
    { "key": "week", "label": "Semana", "percent": 90, "color": "#F0435A", "resetsAt": null }
  ],
  "sessions": [
    { "title": "web", "status": "error", "label": "ERROR" },
    { "title": "landing", "status": "waiting", "label": "TE NECESITA" }
  ]
}
```

É o mesmo formato que o `StatusParserTest.kt` usa.

### NarsilState.kt: o contrato no relógio

O relógio declara o mesmo formato em Kotlin. O arquivo inteiro, de `domain/NarsilState.kt` do narsil-watch (GPL v3), sem as linhas de package e de import:

```kotlin
// What Narsil publishes on its ntfy status topic, as hooks/register.tsx
// (sendStatus) builds it. Fields the PC adds later are ignored; fields it
// does not send yet default to empty.
@Serializable
data class NarsilState(
    val xp: String? = null,
    val art: String? = null,
    // seconds since the epoch
    val at: Long = 0,
    val cacheMinutes: Int? = null,
    val limits: List<Limit> = emptyList(),
    val sessions: List<Session> = emptyList(),
)

// One Claude limit: the 5-hour window or the week.
@Serializable
data class Limit(
    val key: String,
    val label: String,
    val percent: Double,
    val color: String,
    // seconds since the epoch, null when Claude did not say
    val resetsAt: Long? = null,
)

// One open conversation, most important first.
@Serializable
data class Session(
    val title: String,
    val status: String,
    val label: String,
)
```

O primeiro comentário é a regra de design, e ela funciona nos dois sentidos:

- **Os campos que o computador acrescentar depois são ignorados.** O parser é construído com `Json { ignoreUnknownKeys = true }`. É por isso que `usage` não causa erro: ele não está declarado, então é pulado. Um campo futuro será pulado do mesmo jeito.
- **Os campos que o computador ainda não envia ficam vazios por padrão.** Um estado de antes da 3.10.0 não tem `limits` nem `sessions`, e o teste "reads a state from before the watch fields, with no limits or sessions" (lê um estado de antes dos campos do relógio, sem limits nem sessions) confere que ele ainda é lido, com as duas listas vazias.

Dentro de um `Limit` ou de uma `Session`, porém, só `resetsAt` tem um valor padrão. Um limite sem a sua `key`, ou uma sessão sem o seu `label`, faz a decodificação inteira falhar, e o parser trata a mensagem como se não houvesse estado nenhum.

### StatusRepository.kt: a requisição

`refresh()`, o único lugar que pede o estado ao ntfy.sh, roda em `Dispatchers.IO`, fora da thread principal. A sua linha de requisição:

```kotlin
val url = "$NTFY/${URLEncoder.encode(statusTopic, "UTF-8")}/json?poll=1&since=latest"
```

Peça por peça:

- **`$NTFY`** é `https://ntfy.sh`.
- **`statusTopic`** é `topic.removeSuffix(STATUS_SUFFIX) + STATUS_SUFFIX`, com `STATUS_SUFFIX` igual a `-estado`. Assim, o relógio funciona se você digitar `narsil-0000000000example0` ou, por engano, `narsil-0000000000example0-estado`: ele nunca acaba pedindo `-estado-estado`. O tópico é codificado para URL antes de entrar no caminho.
- **`/json`** pede ao ntfy.sh o seu fluxo JSON: um objeto JSON por linha, cada um com um campo `event`.
- **`poll=1`** pede o que o ntfy.sh guardou e então fecha a conexão, em vez de mantê-la aberta esperando novas mensagens. Um relógio não deveria manter uma conexão aberta.
- **`since=latest`** pede só a mensagem mais recente. O relógio não precisa de nada mais antigo: cada estado substitui o anterior.

O auxiliar `get(url, limit)` abre uma `HttpURLConnection` com um tempo limite de conexão de 10 segundos e um tempo limite de leitura de 10 segundos (`TIMEOUT = 10_000`). Ele devolve `null` a menos que a resposta seja HTTP 200. Ele lê no máximo `limit + 1` bytes, e devolve `null` se houver mais de `limit`: 64 KB para o estado (`MAX_STATE`), 256 KB para a imagem (`MAX_ART`). Um tópico que alguém encheu de lixo não consegue fazer o relógio ler megabytes.

### O que ele guarda, e quando

O repositório guarda cinco coisas no arquivo privado de `SharedPreferences` `narsil`, mais um arquivo:

| Chave ou arquivo | O que contém                                                                   |
| ---------------- | ------------------------------------------------------------------------------ |
| `topic`          | O seu tópico, sem espaços nas pontas.                                          |
| `key`            | A sua chave, sem espaços nas pontas, ou vazia.                                 |
| `raw`            | A resposta bruta do ntfy da última leitura boa.                                |
| `checkedAt`      | Quando o relógio recebeu por último uma resposta do ntfy.sh, em milissegundos. |
| `art.png`        | O último desenho da Narsil, na pasta de arquivos privados do app.              |
| `artUrl`         | A URL de onde veio esse desenho.                                               |

O resto de `refresh()` decide o que guardar. De `data/StatusRepository.kt` do narsil-watch (GPL v3):

```kotlin
val lines = try {
    get(url, MAX_STATE)?.toString(Charsets.UTF_8)
} catch (_: IOException) {
    null
} ?: return@withContext cached()?.let { StatusResult.Ok(it) } ?: StatusResult.Empty
val result = StatusParser.parse(lines, key.ifEmpty { null })
prefs.edit().putLong(CHECKED_AT, System.currentTimeMillis()).apply()
if (result is StatusResult.Ok) {
    prefs.edit().putString(RAW, lines).apply()
    result.state.art?.let { fetchArt(it) }
}
result
```

Então:

- **Sem rede, um tempo limite esgotado, um erro HTTP ou uma resposta grande demais:** nada muda, `checkedAt` incluído. O resultado é o estado guardado, se houver. Estar offline não é um erro que o relógio mostre.
- **Uma resposta que se lê como estado:** as linhas brutas substituem `raw`, `checkedAt` avança, e a imagem é baixada se a sua URL mudou.
- **Uma resposta vazia, com ruído ou selada com outra chave:** `checkedAt` avança, mas `raw` é mantido. Uma mensagem ruim nunca apaga uma leitura boa.

Um detalhe é fácil de deixar passar. O repositório guarda a resposta **bruta**, não o estado decodificado, e `cached()` a interpreta de novo toda vez, com a chave tal como ela está agora:

```kotlin
fun cached(): NarsilState? = (StatusParser.parse(prefs.getString(RAW, "").orEmpty(), key.ifEmpty { null }) as? StatusResult.Ok)?.state
```

Isso mantém um único caminho de código para a leitura, e significa que a cópia guardada de um estado selado continua selada no armazenamento do relógio. O preço: troque a chave, e uma cópia selada guardada de antes deixa de abrir.

### StatusParser.kt: das linhas do ntfy a um estado

`parse` devolve um de três resultados:

```kotlin
sealed interface StatusResult {
    data class Ok(val state: NarsilState) : StatusResult

    // the topic holds no state yet, or only noise
    data object Empty : StatusResult

    // sealed, and the watch has no key or the wrong one
    data object NeedsKey : StatusResult
}
```

Essas linhas e o próximo trecho são de `data/StatusParser.kt` do narsil-watch (GPL v3). O trabalho:

```kotlin
val message = ntfyLines.lineSequence()
    .filter { it.isNotBlank() }
    .mapNotNull { line -> objectOf(line) }
    .filter { it["event"]?.jsonPrimitive?.content == "message" }
    .lastOrNull()
    ?.get("message")?.jsonPrimitive?.content
    ?: return StatusResult.Empty
val body = if (message.startsWith(Seal.PREFIX)) {
    val inside = key?.let { Seal.unseal(it, message) } ?: return StatusResult.NeedsKey
    // what goes inside the seal is { message } (sealedPayload)
    objectOf(inside)?.get("message")?.jsonPrimitive?.content ?: return StatusResult.Empty
} else {
    message
}
```

Passo a passo:

1. **Cada linha é um evento do ntfy.** As linhas que não são objetos JSON são puladas. Só contam os eventos do tipo `message`; o ntfy pode enviar outros.
2. **A última mensagem vence.** Com `since=latest` normalmente há uma só, mas pegar a última deixa o parser correto para qualquer resposta.
3. **O seu campo `message` é o texto do mod**, o estado como string JSON.
4. **Se ele começa com `narsil1:`, está selado.** Sem chave, ou se a chave não o abre, o resultado é `NeedsKey`.
5. **Dentro do selo há outro envelope.** O mod sela `sealedPayload(m)`, que para uma mensagem sem título é `{"message": "..."}`. Então o parser lê esse `message` interno, que é o estado.
6. **O estado é decodificado em `NarsilState`.** Uma `SerializationException` ou uma `IllegalArgumentException` dá `Empty`.

### Seal.kt: abrir o selo com a mesma chave

`/narsil movil clave` faz o mod selar tudo o que envia. [Alertas no celular e no relógio](/pt/mods/pet/phone-and-watch/) explica o esquema do lado do mod; aqui está a metade do relógio. `Seal.kt` implementa só `unseal`, já que o relógio nunca sela nada.

O comentário no topo dele enuncia o formato, de `data/Seal.kt` do narsil-watch (GPL v3):

```kotlin
// Opens what Narsil seals with /narsil movil clave (hooks/seal.ts):
// HMAC-SHA256 in counter mode as the keystream, then a second HMAC over the
// nonce and the ciphertext (encrypt-then-MAC). "narsil1:" + base64url of
// nonce (16) | ciphertext | tag (32).
```

`unseal(key, sealed)` faz exatamente o que o `unseal` do narsil-pet faz, na mesma ordem:

1. **O prefixo.** Sem `narsil1:`, ele devolve `null`.
2. **Os bytes.** O resto é decodificado de base64url. Menos de 48 bytes (16 de nonce mais 32 de tag) devolve `null`.
3. **A chave.** A sua chave, 43 caracteres base64url, é decodificada nos seus 32 bytes.
4. **Primeiro a tag.** `macKey = HMAC(key, "mac")`, depois `HMAC(macKey, nonce ‖ ciphertext)`, comparado com os últimos 32 bytes. Se for diferente, ele devolve `null` sem decifrar nada.
5. **Só então o texto.** `encKey = HMAC(key, "enc")`. O bloco `i` do fluxo de chave é `HMAC(encKey, nonce ‖ i)`, com `i` em 4 bytes, big-endian. Cada bloco dá 32 bytes, combinados por XOR com o texto cifrado. O resultado é lido como UTF-8.

Os dois lados diferem no como, não no quê:

| Passo          | narsil-pet `hooks/seal.ts`                                                                                                                   | narsil-watch `Seal.kt`                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| HMAC-SHA256    | Feito à mão sobre `crypto.subtle.digest`, porque "The hooks module's crypto has SHA-256 alone" (o crypto do módulo de hooks só tem SHA-256). | `javax.crypto.Mac` com `HmacSHA256`.                                          |
| Base64url      | Os seus próprios `toBase64Url` e `fromBase64Url`, sobre `btoa` e `atob`.                                                                     | `java.util.Base64.getUrlDecoder()`.                                           |
| Comparar a tag | `tag.some((b, i) => b !== given[i])`.                                                                                                        | `MessageDigest.isEqual`, que leva o mesmo tempo quaisquer que sejam os bytes. |
| Erros          | Qualquer exceção dá `null`.                                                                                                                  | Uma `IllegalArgumentException` dá `null`.                                     |

O teste que prova que eles concordam é o `SealTest.kt`. O seu comentário: "The vector comes from Narsil's own hooks/seal.ts, with a fixed nonce (100..115), so the watch opens exactly what the PC seals." (O vetor vem do próprio hooks/seal.ts da Narsil, com um nonce fixo, 100..115, para que o relógio abra exatamente o que o PC sela.) A chave são os bytes de 0 a 31, `AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8`; o texto simples é um pequeno `{"message": ...}` com um `xp` e uma sessão. Os 16 bytes de nonce de 100 a 115 são as letras `defghijklmnopqrs`, e é por isso que o texto selado começa com `narsil1:ZGVmZ2hpamtsbW5vcHFyc`, o base64url delas.

Para este guia, o vetor também foi conferido no sentido contrário: rodar o `seal()` do narsil-pet, de `hooks/seal.ts`, com essa chave, esse texto e esse nonce dá exatamente a string de `SealTest.kt`.

### O que acontece com uma chave errada, sem chave, ou com uma mensagem não selada

Isso é preciso no código, então aqui vai caso a caso:

| A mensagem no tópico            | A chave no relógio | `Seal.unseal`             | `StatusParser.parse`         |
| ------------------------------- | ------------------ | ------------------------- | ---------------------------- |
| Selada                          | A certa            | O texto interno           | `Ok`                         |
| Selada                          | Nenhuma            | Não é chamado             | `NeedsKey`                   |
| Selada                          | Outra chave válida | `null`: a tag não confere | `NeedsKey`                   |
| Selada, com um caractere mudado | A certa            | `null`: a tag não confere | `NeedsKey`                   |
| Não selada                      | Nenhuma            | Não é chamado             | `Ok`, lida como JSON simples |
| Não selada                      | Qualquer chave     | Não é chamado             | `Ok`, lida como JSON simples |
| Não selada, e não é um estado   | Qualquer           | Não é chamado             | `Empty`                      |

`SealTest.kt` cobre a coluna `Seal`: "opens what Narsil seals" (abre o que a Narsil sela), "another key opens nothing" (outra chave não abre nada), "a tampered message opens nothing" (uma mensagem adulterada não abre nada) e "what is not sealed opens nothing" (o que não está selado não abre nada), que confere que `unseal(key, "no sellado")` (não selado) e `unseal("not base64!", sealed)` dão os dois `null`. `StatusParserTest.kt` cobre a última coluna em "a sealed state needs the key" (um estado selado precisa da chave).

Daí decorrem duas consequências.

**Uma chave errada também esconde o estado guardado.** Depois de um `NeedsKey`, `raw` não é tocado, mas `cached()` o interpreta de novo com a chave errada. Se a cópia guardada estava selada, ela também deixa de abrir: o tile diz `configúrame` (configure-me), a complicação não mostra dados, e o app mostra a sua nota `El estado va sellado: falta la clave o no es la de /narsil movil clave.` (O estado está selado: falta a chave ou ela não é a do /narsil movil clave.) Coloque de volta a chave certa e tudo volta, a partir do mesmo `raw`.

**Uma chave não faz o relógio recusar mensagens simples.** O parser só chama `unseal` para um texto que começa com `narsil1:`. Um estado simples é lido tendo você uma chave ou não. Isso mantém o relógio funcionando depois de `/narsil movil clave off`, mas também significa que qualquer pessoa que conheça o seu tópico pode publicar um estado simples, e o relógio o mostrará. A chave protege o que você lê dos outros; ela não prova quem escreveu o que você lê.

### A imagem: só do narsil-pet

Quando uma leitura é boa, o repositório baixa o desenho citado em `art`. De `StatusRepository.kt` (GPL v3):

```kotlin
// Narsil's art, only from the repository that publishes it: whoever knows
// an unsealed topic could write to it.
private fun fetchArt(url: String) {
    if (!url.startsWith(ART_ORIGIN) || url == prefs.getString(ART_URL, null)) return
```

`ART_ORIGIN` é `https://raw.githubusercontent.com/davshn/narsil-pet/`. O comentário é o motivo: um estado simples forjado poderia citar qualquer URL, e esta verificação impede o relógio de baixá-la. Ela também pula o download quando a URL é a que já está no disco, então a mesma pose é baixada uma só vez. A imagem só é gravada em `art.png` se tiver 256 KB ou menos.

### Os segredos, em palavras simples

- **O tópico** fica guardado nas preferências privadas do app, e só viaja no caminho da requisição ao ntfy.sh. Ele permite a qualquer pessoa ler as suas mensagens e publicar no tópico. Troque-o com `/narsil movil nuevo`, e depois digite o novo no relógio.
- **A chave** fica guardada ao lado dele e nunca é enviada a lugar nenhum. Ela abre as mensagens seladas. `/narsil movil clave` cria uma nova a cada vez; a antiga deixa de abrir as mensagens novas.
- **As próprias palavras do mod ainda citam receptores mais antigos.** O comentário de `hooks/seal.ts` cita "the PC, the Firefox extension and the phone app" (o PC, a extensão do Firefox e o app de celular), e a resposta de `/narsil movil clave` manda colar a chave em "la extensión de Firefox" (a extensão do Firefox). O relógio abre o mesmo selo; cole a mesma chave em **Configurar**.

## Construa com o Claude

Peça ao Claude só a camada de dados, sem nenhuma tela: as classes de estado, o parser, o selo e o repositório, com testes. A única ideia que ele precisa acertar é que uma resposta ruim nunca substitui uma leitura boa.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No meu app para Wear OS `my-watch` (Kotlin, kotlinx.serialization), escreva a camada de dados para o estado da Narsil no ntfy. `domain/NarsilState.kt`: classes `@Serializable` para `{ xp, art, at, cacheMinutes, limits: [{ key, label, percent, color, resetsAt }], sessions: [{ title, status, label }] }`, todo campo de nível superior com um padrão vazio. `data/Seal.kt`: `unseal(key, sealed): String?` para o formato de `hooks/seal.ts` do narsil-pet (prefixo `narsil1:`, base64url de nonce 16 + ciphertext + tag 32; `macKey = HMAC(key,"mac")`, `encKey = HMAC(key,"enc")`, bloco i do fluxo de chave = `HMAC(encKey, nonce ‖ i as 4 bytes big-endian)`, conferir a tag com `MessageDigest.isEqual` antes de decifrar). `data/StatusParser.kt`: interpretar as linhas JSON do ntfy, ficar com o último `event == "message"`, abri-lo se estiver selado (o JSON interno é `{ message }`) e devolver `Ok`, `Empty` ou `NeedsKey`. `data/StatusRepository.kt`: GET `https://ntfy.sh/<topic>-estado/json?poll=1&since=latest` com tempos limite de 10 s e um teto de 64 KB; guardar as linhas brutas só quando elas se interpretam como `Ok`; num erro de rede, devolver o estado guardado. Testes JUnit, incluindo um vetor conhecido selado por `hooks/seal.ts` com um nonce fixo.

### O que conferir na resposta do Claude

1. A requisição usa `poll=1&since=latest`, codifica o tópico e acrescenta `-estado` sem duplicá-lo.
2. A resposta tem um teto de tamanho, e só um HTTP 200 é lido.
3. A resposta bruta só é guardada quando se interpreta como estado. Um erro de rede, um tópico vazio ou uma chave errada nunca a sobrescrevem.
4. `unseal` confere a tag antes de decifrar, e a compara com `MessageDigest.isEqual`.
5. Os campos desconhecidos são ignorados (`ignoreUnknownKeys = true`), e um estado sem `limits` ou `sessions` ainda é lido.
6. Há um teste com um vetor produzido pelo próprio `seal.ts` do mod, não só uma ida e volta do lado do relógio. Uma ida e volta só prova que o relógio concorda consigo mesmo.

Se uma verificação falhar, diga ao Claude o que você vê: "depois de um erro de rede o tile ficou em branco", o que aponta para o caminho de erro sobrescrevendo o estado guardado.

### Como a pessoa autora pediu

Não existe pedido registrado para esta parte. Esta é uma reconstrução a partir do histórico de commits:

- narsil-pet `5a9ee10` (2026-11-01) "feat: seal phone messages with /narsil movil clave, send reset times and an Abrir Claude button" (selar as mensagens do celular com /narsil movil clave, enviar os horários de reinício e um botão Abrir Claude). O selo nasce do lado do mod.
- narsil-pet `6400a6f` (2026-11-23) "feat(phone): publish Claude limits and open conversations for the watch" (publicar os limites do Claude e as conversas abertas para o relógio). Chegam `watchLimits` e `watchSessions`, com o teste "the watch gets the 5-hour and weekly limits with their color and reset, and at most 8 conversations" (o relógio recebe os limites de 5 horas e semanal com a sua cor e o seu reinício, e no máximo 8 conversas). A sua mensagem: "The status topic now carries the 5-hour and weekly limits (percent, color, reset) and up to 8 open conversations, so a Wear OS app can show them." (O tópico de estado agora leva os limites de 5 horas e semanal, com percentual, cor e reinício, e até 8 conversas abertas, para que um app de Wear OS possa mostrá-los.)
- narsil-watch `b47ca7a` (2026-11-23) "feat: Narsil on Wear OS with Claude limits and open conversations" (a Narsil no Wear OS com os limites do Claude e as conversas abertas). A camada de dados e os seus testes chegam com o resto do app. A sua mensagem termina: "It reads Narsil's state from its ntfy.sh status topic and opens it with the /narsil movil clave key when sealed." (Ele lê o estado da Narsil do seu tópico de estado no ntfy.sh e o abre com a chave do /narsil movil clave quando está selado.)

## Código de referência

Esta é uma resposta correta, escrita para este guia. Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

Um leitor reduzido, escrito para este guia e adaptado de `StatusParser.kt`, `StatusRepository.kt` e `Seal.kt` do [narsil-watch](https://github.com/davshn/narsil-watch) (GPL v3). Ele usa só as chamadas de Java e de kotlinx.serialization que esses arquivos usam. Ele deixa de fora a imagem e a cópia guardada:

```kotlin
package com.example.mywatch.data

import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.security.MessageDigest
import java.util.Base64
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

object StateReader {
    private const val PREFIX = "narsil1:"
    private const val NONCE = 16
    private const val BLOCK = 32
    private const val MAX = 64 * 1024
    private val json = Json { ignoreUnknownKeys = true }

    fun fetch(topic: String): String? {
        val name = topic.removeSuffix("-estado") + "-estado"
        val url = "https://ntfy.sh/${URLEncoder.encode(name, "UTF-8")}/json?poll=1&since=latest"
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 10_000
        conn.readTimeout = 10_000
        return try {
            if (conn.responseCode != HttpURLConnection.HTTP_OK) return null
            val bytes = conn.inputStream.use { input ->
                val out = ByteArrayOutputStream()
                val buf = ByteArray(8192)
                while (out.size() <= MAX) {
                    val read = input.read(buf)
                    if (read < 0) break
                    out.write(buf, 0, read)
                }
                out.toByteArray()
            }
            if (bytes.size > MAX) null else bytes.toString(Charsets.UTF_8)
        } finally {
            conn.disconnect()
        }
    }

    fun stateText(lines: String, key: String?): String? {
        val message = lines.lineSequence()
            .mapNotNull { line ->
                try {
                    json.parseToJsonElement(line).jsonObject
                } catch (_: SerializationException) {
                    null
                } catch (_: IllegalArgumentException) {
                    null
                }
            }
            .filter { it["event"]?.jsonPrimitive?.content == "message" }
            .lastOrNull()
            ?.get("message")?.jsonPrimitive?.content ?: return null
        if (!message.startsWith(PREFIX)) return message
        val inside = key?.let { unseal(it, message) } ?: return null
        return json.parseToJsonElement(inside).jsonObject["message"]?.jsonPrimitive?.content
    }

    fun unseal(key: String, sealed: String): String? {
        if (!sealed.startsWith(PREFIX)) return null
        return try {
            val bytes = Base64.getUrlDecoder().decode(sealed.removePrefix(PREFIX))
            if (bytes.size < NONCE + BLOCK) return null
            val k = Base64.getUrlDecoder().decode(key)
            val body = bytes.copyOfRange(0, bytes.size - BLOCK)
            val tag = hmac(hmac(k, "mac".toByteArray()), body)
            if (!MessageDigest.isEqual(tag, bytes.copyOfRange(bytes.size - BLOCK, bytes.size))) return null
            val encKey = hmac(k, "enc".toByteArray())
            val nonce = bytes.copyOfRange(0, NONCE)
            val cipher = bytes.copyOfRange(NONCE, bytes.size - BLOCK)
            val out = ByteArray(cipher.size)
            for (i in cipher.indices) {
                val block = i / BLOCK
                val counter = byteArrayOf((block ushr 24).toByte(), (block ushr 16).toByte(), (block ushr 8).toByte(), block.toByte())
                out[i] = (cipher[i].toInt() xor hmac(encKey, nonce + counter)[i % BLOCK].toInt()).toByte()
            }
            String(out, Charsets.UTF_8)
        } catch (_: IllegalArgumentException) {
            null
        }
    }

    private fun hmac(key: ByteArray, data: ByteArray): ByteArray {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(key, "HmacSHA256"))
        return mac.doFinal(data)
    }
}
```

Duas simplificações que convém conhecer. O laço de leitura para um pouco depois de 64 KB, e não em 64 KB mais um byte, o que basta para recusar uma resposta grande demais; o `readNBytesCompat` do repositório real para exatamente. E esta versão calcula de novo o bloco do fluxo de chave para cada byte, por brevidade, 32 vezes o trabalho; o `xorStream` real calcula cada bloco uma só vez. `stateText` devolve `null` tanto para "sem estado" quanto para "precisa da chave"; o parser real os mantém separados, porque o app diz qual dos dois é.

## Erros comuns e como testar

- **Manter a conexão aberta.** Sem `poll=1`, o endpoint `/json` do ntfy continua transmitindo. Num relógio, isso drena a bateria, e é um job de atualização que nunca termina.
- **Sobrescrever a leitura boa.** Salvar toda resposta significa que uma consulta vazia, depois que o ntfy.sh esqueceu a mensagem, deixa o tile em branco.
- **Esquecer o envelope interno.** O texto selado se abre em `{"message": "..."}`, não no próprio estado.
- **Supor que ter uma chave significa "só selados".** Um estado simples continua sendo lido. Trate um estado simples como possivelmente forjado quando houver uma chave, se isso importar para você.
- **Um decodificador estrito.** Sem `ignoreUnknownKeys`, o campo não declarado `usage` faz todo estado falhar.

Para rodar os testes, a partir do repositório:

```bash
./gradlew :app:testDebugUnitTest
```

`StatusParserTest.kt` tem quatro testes: "reads the state as the PC sends it in the clear" (lê o estado tal como o PC o envia às claras), "reads a state from before the watch fields, with no limits or sessions" (lê um estado de antes dos campos do relógio, sem limits nem sessions), "a sealed state needs the key" (um estado selado precisa da chave) e "an empty topic or noise is no state yet" (um tópico vazio ou ruído ainda não é estado). `SealTest.kt` tem os quatro listados acima.

Para conferir com o tópico real a partir do seu computador, você pode fazer ao ntfy.sh a mesma pergunta que o relógio faz. Isto foi escrito para este guia, com o tópico de exemplo:

```bash
curl -s "https://ntfy.sh/narsil-0000000000example0-estado/json?poll=1&since=latest"
```

Use o seu próprio tópico só no seu próprio terminal, nunca num terminal compartilhado nem numa captura de tela.

### Onde o código e o README diferem

- O README do narsil-pet ainda documenta cinco campos para o `-estado` (`xp`, `art`, `at`, `cacheMinutes`, `usage`). Desde a 3.10.0 o seu código envia sete; `limits` e `sessions` faltam nessa tabela. O teste do narsil-pet "as a turn ends from the phone, the extension gets only what it reads on the status topic, silently" (quando um turno termina a partir do celular, a extensão recebe só o que lê no tópico de estado, em silêncio) lista os sete.
- O README do narsil-pet diz que o estado sai "At the end of each turn" (ao fim de cada turno). O código também o envia a cada pergunta, e só enquanto você está longe.
- O README do relógio diz que a chave permite ao relógio abrir o estado "just as the computer sealed it" (tal como o computador o selou). É verdade, e o código acrescenta uma coisa que o README não diz: com uma chave definida, uma mensagem simples continua sendo aceita.

## Para ir além

- Leia `data/` do [narsil-watch](https://github.com/davshn/narsil-watch) no GitHub.
- O lado do mod do tópico, da contagem diária e do selo: [Alertas no celular e no relógio](/pt/mods/pet/phone-and-watch/).
- Faça o parser recusar mensagens simples quando houver uma chave definida, para que um estado forjado seja ignorado. Pense no que acontece então logo depois de `/narsil movil clave off`.
- Volte a [O que é o Narsil Watch](/pt/watch/what-it-is/) para ver o quadro completo.
- A seguir: [O tile](/pt/watch/tile/), os dois anéis e a Narsil no meio.
