---
title: Criptografia e configurações
description: 'Como o Seal.kt abre o que o mod selou com /narsil movil clave, byte a byte como o hooks/seal.ts sela, o que o app guarda e onde, como trocar a chave e o tópico, e o modelo de ameaças.'
route: android
order: 7
updated: 2026-11-24
sources:
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/Seal.kt
  - repo: android
    path: app/src/test/java/io/github/davshn/narsil/SealTest.kt
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/Settings.kt
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/SettingsActivity.kt
  - repo: android
    path: app/src/main/res/xml/shortcuts.xml
  - repo: pet
    path: hooks/seal.ts
  - repo: pet
    path: hooks/phone.ts
  - repo: pet
    path: hooks/register.tsx
---

## O que faz

O seu tópico do ntfy.sh é público num sentido: qualquer pessoa que conheça o nome dele pode lê-lo. `/narsil movil clave` (chave), no mod Narsil, resolve a parte da leitura. Ele cria uma chave e, daí em diante, o mod sela tudo o que publica, tanto os alertas quanto os estados. Quem lê o tópico vê "Narsil" e um texto ilegível que começa com `narsil1:`. Você digita a mesma chave nas configurações do app, e o app abre cada mensagem antes de mostrá-la.

Quando a chave está errada ou faltando:

- **Um alerta** diz "🔒 Aviso cifrado: pon la clave en los ajustes de la app." (alerta criptografado: coloque a chave nas configurações do app).
- **O bloco do menu lateral** diz "🔒 Toca y pon la clave" (toque e informe a chave), se não tiver um estado anterior para mostrar.

A tela de configurações guarda duas coisas, o tópico e a chave, e só as mantém no celular. Ela abre a partir de três lugares: um toque na Narsil (ou num aviso) no bloco do menu lateral, um toque na notificação discreta "Narsil escucha tus avisos", e um toque longo no ícone do app, depois **Ajustes** (configurações), onde o launcher mostra atalhos.

> **Experimental.** O app depende da estrutura da página do `claude.ai` e das suas requisições internas, não de uma API pública, então uma atualização do Claude pode quebrar a faixa e as cores. A criptografia descrita aqui é um esquema feito à mão para a Narsil, não um formato de biblioteca revisado. Ela é conferida contra a saída do próprio mod, mas ninguém a auditou; trate-a como proteção contra leitores casuais do seu tópico, e leia o modelo de ameaças no final.

## Como funciona por dentro

### O que o mod sela, e o que não sela

O mod decide o que vai dentro. De `hooks/phone.ts` no [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later):

<!-- prettier-ignore -->
```ts
export function sealedMessage<M extends { title?: string; message: string }>(m: M, sealed: string): M {
  return { ...m, ...(m.title ? { title: 'Narsil' } : {}), message: sealed }
}

// What goes inside the seal.
export function sealedPayload(m: { title?: string; message: string }): string {
  return JSON.stringify(m.title ? { title: m.title, message: m.message } : { message: m.message })
}
```

Num alerta, o título e o texto vão dentro, como JSON, e o título de fora vira só `Narsil`. Todo o resto da mensagem continua legível: a prioridade, as tags, o endereço do desenho e o botão. Num estado do `-estado`, que não tem título, o estado JSON inteiro vai dentro.

### O formato: `narsil1:` e três partes

Uma mensagem selada é o prefixo `narsil1:` seguido de um único texto base64url, que se decodifica em três partes em sequência:

| Parte         | Tamanho          | O que é                                                                |
| ------------- | ---------------- | ---------------------------------------------------------------------- |
| Nonce         | 16 bytes         | Aleatório para cada mensagem, para que o mesmo texto nunca sele igual. |
| Texto cifrado | O mesmo do texto | O texto em UTF-8, combinado por XOR com um fluxo de chave.             |
| Tag           | 32 bytes         | Prova de que o nonce e o texto cifrado foram feitos com esta chave.    |

A própria chave são 32 bytes aleatórios, mostrados pelo mod em base64url (43 caracteres). O esquema usa uma única primitiva, HMAC-SHA256, para tudo. O comentário do mod explica por quê: "The hooks module's crypto has SHA-256 alone" (o crypto do módulo de hooks só tem SHA-256), então o HMAC é construído à mão sobre ele. [Alertas no celular e no relógio](/pt/mods/pet/phone-and-watch/) percorre o lado da selagem passo a passo.

### `Seal.kt`: abrir

De `Seal.kt` no narsil-android (MIT):

```kotlin
    // The text inside, or IllegalArgumentException when the key is not the one that sealed it.
    fun open(key: String, text: String): String {
        val bytes = bytesOf(text.removePrefix(PREFIX))
        val shared = bytesOf(key)
        require(bytes.size >= NONCE + TAG && shared.isNotEmpty()) { WRONG_KEY }
        val encKey = hmac(shared, "enc".toByteArray())
        val macKey = hmac(shared, "mac".toByteArray())
        val body = bytes.copyOfRange(0, bytes.size - TAG)
        val given = bytes.copyOfRange(bytes.size - TAG, bytes.size)
        require(MessageDigest.isEqual(hmac(macKey, body), given)) { WRONG_KEY }
        val nonce = body.copyOfRange(0, NONCE)
        val cipher = body.copyOfRange(NONCE, body.size)
        val plain = ByteArray(cipher.size)
        var block = 0
        while (block * 32 < cipher.size) {
            val stream = hmac(encKey, ByteBuffer.allocate(NONCE + 4).put(nonce).putInt(block).array())
            for (j in 0 until 32) {
                val i = block * 32 + j
                if (i >= cipher.size) break
                plain[i] = (cipher[i].toInt() xor stream[j].toInt()).toByte()
            }
            block++
        }
        return String(plain, Charsets.UTF_8)
    }
```

Em ordem:

1. **Decodificar** a mensagem e a chave de base64. `bytesOf` aceita o alfabeto padrão e o seguro para URL, com ou sem preenchimento, e dá um array vazio para qualquer coisa que não seja base64.
2. **Recusar o que não pode estar certo**: uma mensagem mais curta que um nonce mais uma tag, ou uma chave vazia. Os dois lançam uma exceção com a mensagem "La clave no es la de este aviso" (a chave não é a deste alerta).
3. **Derivar duas chaves** da sua: `encKey = HMAC(key, "enc")` para o fluxo de chave e `macKey = HMAC(key, "mac")` para a tag. Usar a mesma chave para os dois trabalhos é um erro clássico; derivar duas o evita.
4. **Conferir a tag primeiro.** Calcular `HMAC(macKey, nonce ‖ ciphertext)` e compará-lo com a tag recebida. Diferente significa outra chave ou um byte alterado, e o código para ali, antes de decifrar qualquer coisa. Essa ordem se chama encrypt-then-MAC (cifrar e depois autenticar).
5. **Decifrar** 32 bytes de cada vez. O bloco `i` do fluxo de chave é `HMAC(encKey, nonce ‖ i)`, com `i` em quatro bytes, big-endian (a ordem padrão do `ByteBuffer`). Combiná-lo por XOR com o texto cifrado. Isso é o modo contador (CTR), com HMAC no lugar de uma cifra de bloco.

A comparação usa `MessageDigest.isEqual`, que leva o mesmo tempo seja qual for o número de bytes que coincidem, então o tempo que ela leva não revela nada sobre a tag certa.

### Byte a byte com `hooks/seal.ts`

O comentário da classe diz que o app abre o que o mod sela "byte for byte as it seals it" (byte a byte como ele o sela). Lado a lado com o `hooks/seal.ts` do narsil-pet:

| Passo             | Mod (`hooks/seal.ts`)                                   | App (`Seal.kt`)                                 |
| ----------------- | ------------------------------------------------------- | ----------------------------------------------- |
| Prefixo           | `narsil1:`                                              | `narsil1:`                                      |
| HMAC              | Construído à mão sobre SHA-256 (`crypto.subtle.digest`) | `javax.crypto.Mac` com `HmacSHA256`             |
| Duas chaves       | `hmac(k, 'enc')`, `hmac(k, 'mac')`                      | `hmac(shared, "enc")`, `hmac(shared, "mac")`    |
| Contador          | `DataView.setUint32(0, i)`: 4 bytes, big-endian         | `ByteBuffer.putInt(block)`: 4 bytes, big-endian |
| Tag sobre         | `nonce ‖ ciphertext`                                    | `nonce ‖ ciphertext`                            |
| Comparação da tag | `tag.some((b, i) => b !== given[i])`                    | `MessageDigest.isEqual`                         |
| Base64            | Seguro para URL, sem preenchimento                      | Qualquer alfabeto, preenchimento opcional       |
| Curta demais      | Devolve `null`                                          | Lança uma exceção                               |
| Chave vazia       | Não é conferida                                         | Lança uma exceção                               |
| Chave errada      | Devolve `null`                                          | Lança `IllegalArgumentException`                |

Um HMAC feito à mão e um de biblioteca dão os mesmos bytes quando os dois seguem a construção padrão, o que o comentário do mod afirma para o WebCrypto: ele "gives the same bytes" (dá os mesmos bytes). A prova aqui é o teste. `SealTest.kt` traz uma chave e uma mensagem selada cujo comentário diz "The vector was sealed by a JavaScript port of the mod's hooks/seal.ts" (o vetor foi selado por um port em JavaScript do hooks/seal.ts do mod); o commit `9051a31` diz que o vetor veio do próprio código da extensão anterior. O texto dentro é longo de propósito, "texto largo para cruzar varios bloques de 32 bytes" (texto longo para atravessar vários blocos de 32 bytes), e tem acentos e um `✓`, então o contador e o UTF-8 são postos à prova. Os testes conferem que o vetor abre exatamente nesse texto, que outra chave lança a exceção com a mensagem em espanhol, quais textos contam como selados e os três casos de `unseal` abaixo.

### `unseal`: o que realmente acontece com cada mensagem

`Seal.open` é usado por meio de `unseal`, que recebe uma mensagem do ntfy e devolve uma com o título e o texto de volta no lugar. De `Seal.kt` (MIT):

```kotlin
    // An ntfy message with its title and text back in place: unchanged when not sealed; with `sealed: true` and no
    // text when the key cannot open it.
    fun unseal(key: String?, m: JSONObject): JSONObject {
        if (!isSealed(m.optString("message"))) return m
        val out = JSONObject(m.toString())
        try {
            val inside = JSONObject(open(key.orEmpty(), m.getString("message")))
            if (inside.has("title")) out.put("title", inside.get("title"))
            out.put("message", inside.optString("message"))
        } catch (_: Exception) {
            out.put("message", "").put("sealed", true)
        }
        return out
    }
```

Leia com atenção, porque nem todos os casos são o que você poderia esperar:

| A mensagem                 | A chave no app           | Um alerta mostra                             | A faixa                                           |
| -------------------------- | ------------------------ | -------------------------------------------- | ------------------------------------------------- |
| Não selada                 | Nenhuma                  | O seu título e o seu texto                   | Aceita o estado                                   |
| Não selada                 | Qualquer chave           | O seu título e o seu texto, **sem mudanças** | Aceita o estado                                   |
| Selada                     | A certa                  | O título e o texto de dentro                 | Aceita o estado                                   |
| Selada                     | Errada, vazia ou nenhuma | O título `Narsil`, o texto 🔒                | Marca `isSealed`; mantém qualquer estado anterior |
| Selada, com um byte mudado | A certa                  | O título `Narsil`, o texto 🔒                | Marca `isSealed`; mantém qualquer estado anterior |

Três fatos decorrem disso:

- **Uma chave errada falha fechada.** Nenhum texto parcial, nenhum lixo: a mensagem é marcada como `sealed: true` e o seu texto esvaziado. Qualquer erro lá dentro, uma tag ruim, uma falha de decodificação ou um conteúdo interno que não seja JSON, termina do mesmo jeito.
- **Uma mensagem não selada passa, com chave ou sem.** `unseal` a devolve sem mudanças se ela não começar com `narsil1:`. O app não exige a selagem depois que você define uma chave. Isso é cômodo depois de `/narsil movil clave off`, mas também significa que a chave não impede alguém que conheça o seu tópico de publicar um alerta simples ou um estado simples que o app vai mostrar.
- **O cadeado da faixa é mais discreto que o do alerta.** Como explica o [guia 4](/pt/android/sidebar/), o `StateModel` mantém o seu estado anterior quando uma mensagem não abre, e o bloco mostra um estado sempre que tem um. O aviso do cadeado só aparece quando não há nada para mostrar.

### `Settings.kt`: o que o app guarda, e onde

De `Settings.kt` (MIT):

```kotlin
// What the app keeps on the phone: the topic and the key typed in its settings (never in its code, as the repository
// is public), the last alert it showed, so a restart goes on from it, and the band's last state, per topic.
class Settings(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("narsil", Context.MODE_PRIVATE)

    var topic: String?
        get() = prefs.getString(TOPIC, null)?.takeIf { isTopic(it) }
        set(value) = prefs.edit().putString(TOPIC, value).remove(LAST_ALERT).apply()

    var key: String?
        get() = prefs.getString(KEY, null)?.takeIf { it.isNotBlank() }
        set(value) = prefs.edit().putString(KEY, value).apply()

    var lastAlertId: String?
        get() = prefs.getString(LAST_ALERT, null)
        set(value) = prefs.edit().putString(LAST_ALERT, value).apply()
```

Quatro valores, no arquivo `SharedPreferences` do Android chamado `narsil`:

| Chave         | O que guarda                                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------------------------- |
| `topic`       | O seu tópico. Só é lido de volta se ainda corresponder a `^[-_A-Za-z0-9]{1,64}$`.                                 |
| `key`         | A sua chave, como você a digitou. Uma em branco é lida como nenhuma chave.                                        |
| `lastAlertId` | O id do último alerta mostrado, para retomar ([guia 6](/pt/android/alerts-service/)). Apagado com um tópico novo. |
| `band`        | O último estado da faixa, com o tópico a que pertence; ignorado para qualquer outro tópico.                       |

`MODE_PRIVATE` coloca o arquivo na própria pasta de dados do app, que o sandbox do Android fecha para os outros apps. Os valores estão em texto simples dentro dele: o app não os criptografa com o Keystore do Android. O `android:allowBackup="false"` do manifesto os mantém fora dos backups do Android. A especificação S4 explica por que eles são digitados e não embutidos: "the repository is public and named `narsil-android`: no topic or key in the code; they are typed in the app's settings." (o repositório é público e se chama `narsil-android`: nenhum tópico nem chave no código; eles são digitados nas configurações do app.)

### `SettingsActivity.kt`: a tela

A tela é um layout Android simples: um texto de introdução, um campo **Topic**, um campo **Clave (opcional)** (chave, opcional), o botão **Guardar y recibir avisos**, uma linha de status e o botão de segundo plano do [guia 6](/pt/android/alerts-service/). Algumas escolhas merecem atenção:

- **O campo da chave é um campo de senha** (`inputType="textPassword"`), então mostra pontinhos, e os dois campos definem `importantForAutofill="no"`, para que nenhum gerenciador de senhas ofereça salvá-los.
- **Salvar valida o tópico primeiro.** Um tópico com qualquer coisa além de letras, números, `-` e `_` recebe "Ese topic no es válido: solo letras, números, - y _." (esse tópico não é válido: só letras, números, - e _), e nada é salvo.
- **Os dois valores são aparados**, então um espaço copiado junto não faz mal.
- **O tópico só é escrito se mudou**, então salvar o mesmo tópico mantém `lastAlertId` e os alertas retomam de onde estavam.
- **Salvar com o campo da chave vazio** remove a chave: o getter lê um valor em branco como nenhum.
- Depois ele inicia o serviço de alertas, diz "Guardado. Los avisos llegan a este teléfono; vuelve a Claude para ver la banda." (salvo; os alertas chegam a este celular; volte ao Claude para ver a faixa) e pede a permissão de notificações se o Android precisar.

A activity é `exported` no manifesto, o que deixa o atalho do launcher abri-la. `res/xml/shortcuts.xml` declara esse único atalho estático, com o rótulo curto **Ajustes** e o rótulo longo **Ajustes de Narsil**, apontando para `io.github.davshn.narsil.SettingsActivity`. Ser exportada também significa que outro app poderia abrir a tela, mas ele não ganha nada com isso: a tela só mostra campos, e eles não guardam nada que esse app possa ler.

### Trocar a chave e o tópico

Cada comando roda no Claude Code no seu computador; cada mudança vai depois para as configurações do app.

| Você quer                                 | No computador             | No app                                                                                                                       |
| ----------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Começar a criptografar, ou uma chave nova | `/narsil movil clave`     | Cole a chave nova e salve. Até você fazer isso, os alertas mostram o texto 🔒.                                               |
| Parar de criptografar                     | `/narsil movil clave off` | Nada é obrigatório, já que as mensagens simples passam; apague o campo da chave para deixar tudo em ordem.                   |
| Um tópico novo                            | `/narsil movil nuevo`     | Cole o tópico novo e salve. Os alertas recomeçam nele, e a faixa começa de um estado vazio.                                  |
| Parar os alertas                          | `/narsil movil off`       | Nada a fazer; o app não tem um botão de desligar próprio.                                                                    |
| Apagar tudo no celular                    |                           | Em **Configurações → Apps → Narsil → Armazenamento** do Android, limpe-o: a sessão, o tópico, a chave e o estado vão embora. |

As respostas do mod confirmam cada passo. Para um tópico novo: "Narsil: tema nuevo, el anterior ya no recibe nada." (tópico novo; o anterior não recebe mais nada). Para uma chave nova, ele mostra a chave e acrescenta "/narsil movil clave crea otra clave" (cria outra chave). Essa resposta ainda diz para colocar a chave nas opções da extensão do Firefox; no Android, ela vai nas configurações deste app.

Cada `/narsil movil clave` cria uma chave **nova**, e nenhum comando mostra a atual de novo. No computador, a chave também vive nas preferências do mod e na resposta do comando, que faz parte da sua conversa com o Claude. [Alertas no celular e no relógio](/pt/mods/pet/phone-and-watch/) trata desse lado.

### O modelo de ameaças em palavras simples

Quem poderia ver ou fazer o quê, segundo o código:

- **O ntfy.sh** vê cada mensagem, o endereço do celular quando ele se conecta e o seu tópico em cada requisição. Sem chave, ele vê todo o texto. É um serviço de terceiros.
- **Qualquer pessoa que conheça o seu tópico, sem chave do seu lado,** lê cada alerta e cada estado: os nomes das conversas, parte das respostas do Claude, o seu nível.
- **A mesma pessoa, com chave do seu lado,** vê que uma mensagem passou e quando, a sua prioridade (então, se o Claude precisa de você), as suas tags, o endereço do desenho (então, o estágio da Narsil e a pose do alerta), o botão e o título `Narsil`. Não o texto.
- **Forjar uma mensagem selada** sem a chave falha na verificação da tag, e o app mostra o texto 🔒.
- **Forjar uma mensagem simples** funciona, com chave ou sem, como mostrado acima. O que ela pode fazer é limitado pelo app: o texto entra como texto, um desenho só da própria pasta da Narsil, um toque só para o `claude.ai`. Os seus dois botões, porém, podem levar qualquer endereço, que abre em outro app se você tocar nele. Um estado simples forjado pode mostrar um nível errado, e um `at` muito no futuro impediria os estados reais de substituí-lo até você mudar o tópico ou apagar os dados do app.
- **A página** nunca recebe o tópico nem a chave; só o estado aberto ([guia 2](/pt/android/webview-host/)).
- **Alguém com o seu celular desbloqueado** pode abrir as configurações e ler o tópico (o campo da chave é mascarado, não escondido de uma pessoa determinada), e a notificação discreta mostra o tópico na área de notificações.
- **Um computador com a depuração USB permitida no seu celular** pode fazer mais com um build de debug, que é o que `./gradlew installDebug` instala. O Android o deixa ler os arquivos privados de um app depurável (com `adb shell run-as`), a chave entre eles, e inspecionar a página do Claude a partir de `chrome://inspect`. Desligue a depuração USB quando não a estiver usando.

Nada disso protege a sua conta do Claude em si: ela é o seu cookie de sessão, guardado pela WebView na mesma pasta privada, e tão segura quanto o celular.

## Construa com o Claude

Peça ao Claude que porte para Kotlin o lado de abertura do esquema do mod, e que o prove com um vetor feito pelo próprio código do mod. A única ideia que ele precisa acertar é a ordem: conferir a tag primeiro, com uma comparação de tempo constante, e só então decifrar; e uma falha de qualquer tipo precisa dar um único resultado claro de "não dá para abrir", nunca texto parcial.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> Porte a metade `unseal` deste esquema em TypeScript para um `object` Kotlin sem dependências de Android (cole abaixo o `hooks/seal.ts` do narsil-pet). Use `javax.crypto.Mac` com `HmacSHA256`, `ByteBuffer` para o contador de 4 bytes big-endian e `MessageDigest.isEqual` para a tag. Decodifique base64url com ou sem preenchimento, e trate qualquer coisa que não decodifique, tenha menos de 48 bytes ou tenha uma chave vazia como chave errada. Confira a tag antes de decifrar. Acrescente uma função que receba uma mensagem do ntfy como `JSONObject` e, se o seu `message` começar com `narsil1:`, substitua `title` e `message` pelos de dentro, ou esvazie `message` e defina `sealed: true` quando não conseguir abri-la. Escreva testes JUnit com um vetor que eu vou produzir rodando o `seal` em TypeScript com um nonce fixo, mais uma chave errada, uma chave nula, uma chave vazia e uma mensagem simples.

### O que conferir na resposta do Claude

1. A tag é calculada sobre o nonce e o texto cifrado, e comparada antes de qualquer decifragem.
2. A comparação é `MessageDigest.isEqual`, não `contentEquals` nem um loop que para cedo.
3. O contador tem quatro bytes, big-endian, começando em 0.
4. Duas chaves são derivadas com HMAC de `"enc"` e `"mac"`; a chave compartilhada nunca é usada diretamente.
5. Toda falha termina num único resultado, `sealed: true` com uma mensagem vazia.
6. Um teste usa um vetor selado pelo código em TypeScript, e não só uma ida e volta pelo próprio código Kotlin: uma ida e volta passa mesmo quando as duas metades compartilham o mesmo erro.

Se uma verificação falhar, diga ao Claude o que você vê: "o vetor do mod abre em lixo depois dos primeiros 32 caracteres", o que aponta para o contador.

### Como a pessoa autora pediu

As palavras da pessoa autora registradas em `odd/tasks/android-app.md` definem o quadro deste guia. A L2 (2026-11-24) diz "el repositorio seria publico" (o repositório seria público), que a especificação S4 transforma na regra citada acima: nenhum tópico nem chave no código. A especificação S5, do agente, lista "sealed messages opened with the key (`narsil1:`)" (mensagens seladas abertas com a chave, `narsil1:`) entre as regras que os alertas mantêm. A T1 registra a primeira tarefa: "Gradle project and `Seal` port, tested against vectors from [the earlier extension]'s seal.js" (projeto Gradle e port do `Seal`, testado contra vetores do seal.js da [extensão anterior]; o nome dela foi omitido aqui).

O log registra a verificação com o tópico e a chave reais, em 2026-11-24 às 00:44: "the mod's alert and state, sealed with the new key, opened in the app." (o alerta e o estado do mod, selados com a chave nova, abriram no app.)

Os commits (um nome de projeto num assunto é substituído por uma descrição entre colchetes):

- `9051a31` (2026-11-24) "feat: open what the mod seals, as [the earlier extension]'s seal.js does" (abrir o que o mod sela, como faz o seal.js da [extensão anterior]). A sua mensagem: "Gradle project for the Android app, with the sealing port tested against a vector sealed by the extension's own code." (projeto Gradle para o app Android, com o port da selagem testado contra um vetor selado pelo próprio código da extensão.)
- `53c55c1` (2026-11-24) "feat: host claude.ai with [the earlier extension] in a WebView, and show Narsil's alerts from a foreground service" (hospedar o claude.ai com a [extensão anterior] numa WebView, e mostrar os alertas da Narsil a partir de um serviço em primeiro plano). A sua mensagem: "Settings keep the topic and key on the phone." (as configurações guardam o tópico e a chave no celular.)
- `9e514dd` (2026-11-24) "feat: open the settings from Narsil in the band and from the service's notification" (abrir as configurações a partir da Narsil na faixa e da notificação do serviço).
- `a275382` (2026-11-24) "docs: log the alerts and the band verified with the real topic and key" (registrar os alertas e a faixa conferidos com o tópico e a chave reais).

## Código de referência

Esta é uma resposta correta, escrita para este guia (MIT). Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

Um selador só para testes em Kotlin, seguindo o `hooks/seal.ts`, e dois testes contra o `Seal` do app. Ele usa a chave claramente falsa `example-key-not-real`, que se decodifica em base64url como 15 bytes; o HMAC aceita uma chave de qualquer tamanho. Lembre-se do aviso na última verificação acima: estes testes pegam um byte adulterado e um contador quebrado do lado Kotlin, mas não substituem o vetor do próprio código do mod que o `SealTest.kt` usa.

```kotlin
package io.github.davshn.narsil

import java.nio.ByteBuffer
import java.util.Base64
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class SealRoundTripTest {
    private val key = "example-key-not-real"

    private fun hmac(key: ByteArray, data: ByteArray): ByteArray =
        Mac.getInstance("HmacSHA256").run {
            init(SecretKeySpec(key, "HmacSHA256"))
            doFinal(data)
        }

    private fun seal(text: String, nonce: ByteArray): String {
        val shared = Base64.getUrlDecoder().decode(key)
        val encKey = hmac(shared, "enc".toByteArray())
        val macKey = hmac(shared, "mac".toByteArray())
        val plain = text.toByteArray(Charsets.UTF_8)
        val cipher = ByteArray(plain.size)
        var block = 0
        while (block * 32 < plain.size) {
            val stream = hmac(encKey, ByteBuffer.allocate(20).put(nonce).putInt(block).array())
            for (j in 0 until 32) {
                val i = block * 32 + j
                if (i < plain.size) cipher[i] = (plain[i].toInt() xor stream[j].toInt()).toByte()
            }
            block++
        }
        val tag = hmac(macKey, nonce + cipher)
        return "narsil1:" + Base64.getUrlEncoder().withoutPadding().encodeToString(nonce + cipher + tag)
    }

    @Test
    fun aLongTextOpensAcrossBlocks() {
        val text = "{\"title\":\"Narsil\",\"message\":\"" + "ñ".repeat(40) + "\"}"
        assertEquals(text, Seal.open(key, seal(text, ByteArray(16) { 7 })))
    }

    @Test
    fun oneChangedByteIsRefused() {
        val sealed = seal("{\"message\":\"hola\"}", ByteArray(16))
        val bytes = Base64.getUrlDecoder().decode(sealed.removePrefix("narsil1:"))
        bytes[20] = (bytes[20].toInt() xor 1).toByte()
        val changed = "narsil1:" + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
        assertThrows(IllegalArgumentException::class.java) { Seal.open(key, changed) }
    }
}
```

`"ñ".repeat(40)` são 80 bytes em UTF-8, então, com o JSON em volta, o texto ocupa quatro blocos de 32. O byte 20 fica no texto cifrado, logo depois do nonce de 16 bytes. Os nonces fixos são só para o teste; o mod sorteia um novo e aleatório para cada mensagem, e o mesmo deve fazer qualquer coisa que você construa e que sele.

## Erros comuns e como testar

- **Decifrar antes de conferir a tag.** Uma mensagem alterada produziria lixo que você poderia mostrar. Confira primeiro, depois decifre.
- **Comparar tags com um loop que para cedo.** Ele revela, pelo seu tempo, quantos bytes coincidiram. Use uma comparação de tempo constante.
- **Um contador na ordem de bytes errada.** Os primeiros 32 bytes abrem, o resto é lixo. Quatro bytes, big-endian.
- **Testar só idas e voltas.** Selar e abrir no mesmo código concordam mesmo quando os dois estão errados. Teste contra um vetor do outro lado.
- **Esperar que a chave bloqueie as mensagens simples.** Ela não bloqueia, neste app. Se você construir o seu, decida se um receptor com chave deve recusar as mensagens não seladas.
- **Esquecer de colar a chave nova.** Cada `/narsil movil clave` cria uma nova. Os alertas mostram o texto 🔒 até você colá-la.
- **Compartilhar uma captura de tela das configurações ou da área de notificações.** O tópico está nas duas.
- **Guardar a chave no repositório.** O repositório do app é público de propósito; tópicos e chaves pertencem às configurações.

Para testar, execute `./gradlew testDebugUnitTest`: o `SealTest.kt` abre o vetor do mod, recusa outra chave, distingue texto selado de simples, recoloca o título e o texto, deixa as mensagens simples em paz e marca o que uma chave errada, nula ou vazia não consegue abrir. No celular, com um tópico inventado nas configurações e o campo da chave definido como `example-key-not-real`, publique a partir do computador um alerta que parece selado mas não é:

```bash
curl -H "Title: Narsil" -d "narsil1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" https://ntfy.sh/narsil-0000000000example0
```

A notificação deve dizer "🔒 Aviso cifrado: pon la clave en los ajustes de la app.", já que a tag dela não pode coincidir. Depois publique `-d "Hola"` no mesmo tópico: ele aparece como está, com chave ou sem.

### Onde o código e o README diferem

- O README diz que, com a chave, "Anyone reading the topic only sees "Narsil" and unreadable text." (quem lê o tópico só vê "Narsil" e um texto ilegível). O `sealedMessage` do mod mantém às claras a prioridade, as tags, o endereço do desenho e o botão, então quem lê também vê o tipo de alerta e o estágio da Narsil.
- O README diz que, se a chave não for a que selou um estado, a faixa mostra "🔒 Toca y pon la clave". O bloco só faz isso quando não tem um estado anterior para o tópico, como explicado acima.
- O README não menciona que as mensagens não seladas são aceitas enquanto há uma chave definida. O código as aceita.

## Para ir além

- O [guia 6](/pt/android/alerts-service/) mostra onde o `unseal` fica no caminho de um alerta, e o botão de segundo plano das configurações.
- O [guia 4](/pt/android/sidebar/) mostra o aviso do cadeado no bloco do menu lateral, e por que ele pode ficar oculto.
- Do lado do mod, [Alertas no celular e no relógio](/pt/mods/pet/phone-and-watch/) explica a selagem passo a passo e onde a chave vive no seu computador.
- O [Narsil Watch](/pt/watch/what-it-is/) lê o mesmo tópico `-estado`.
- O código-fonte está em [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
