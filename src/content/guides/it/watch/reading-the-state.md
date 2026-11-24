---
title: Leggere lo stato di Narsil
description: "Cosa pubblica ora la mod su <topic>-estado, limiti e conversazioni compresi, e come l'orologio prende l'ultimo messaggio da ntfy.sh, ne apre il sigillo con la tua chiave e lo conserva."
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

## Cosa fa

Tutto ciò che l'orologio mostra viene da un piccolo messaggio JSON. La mod di Narsil lo scrive sul tuo computer e lo pubblica su ntfy.sh, sul topic `<il tuo topic>-estado`. L'orologio legge l'ultimo, lo apre se è sigillato e lo conserva, così il tile, la complicazione e l'app possono disegnare da lì in qualsiasi momento.

Questa guida segue quel messaggio da un capo all'altro: cosa ci mette la mod da narsil-pet 3.10.0, le classi Kotlin in cui viene letto (`NarsilState.kt`), la richiesta e ciò che viene conservato (`StatusRepository.kt`), il parsing (`StatusParser.kt`) e il sigillo (`Seal.kt`), compreso cosa succede con una chiave sbagliata o con un messaggio non sigillato.

> **Sperimentale.** L'orologio può leggere solo ciò che la mod ha pubblicato per ultimo, e la mod pubblica solo mentre sei lontano dal computer, entro la quota giornaliera gratuita di ntfy.sh. ntfy.sh conserva un messaggio per un tempo limitato, quindi un lungo periodo di silenzio lascia l'orologio con la sua ultima copia. E la forma dello stato è un accordo privato tra due progetti: un cambiamento nella mod può rompere la lettura.

Gli esempi usano solo valori inventati: il topic `narsil-0000000000example0` e chiavi finte.

## Come funziona dentro

### Il lato della mod: cosa porta ora `-estado`

`sendStatus` in `hooks/register.tsx` di narsil-pet costruisce lo stato e `phoneStatus` in `hooks/phone.ts` lo impacchetta per ntfy.sh: `{ topic: "<topic>-estado", message: JSON.stringify(state), priority: 1 }`. Lo stato vero e proprio è un oggetto JSON con sette campi dal commit `6400a6f`, "feat(phone): publish Claude limits and open conversations for the watch" (pubblica i limiti di Claude e le conversazioni aperte per l'orologio), rilasciato come 3.10.0:

| Campo          | Cos'è                                                                                       | Lo usa l'orologio?        |
| -------------- | ------------------------------------------------------------------------------------------- | ------------------------- |
| `xp`           | L'etichetta di livello di Narsil, come `⭐ Nivel 3 · 120/300 XP` (livello 3).               | Sì, nell'app.             |
| `art`          | L'URL del suo disegno, al suo stadio, nella posa della conversazione aperta più importante. | Sì, tile e app.           |
| `at`           | Quando è stato inviato, in secondi Unix.                                                    | Sì, l'etichetta dell'età. |
| `cacheMinutes` | Quanto dura la cache del prompt; assente quando nessuna conversazione ne ha una.            | Letto, non mostrato.      |
| `usage`        | Una riga, `ntfy`, con il conteggio di ntfy.sh dei messaggi di oggi dalla tua rete.          | No, ignorato.             |
| `limits`       | I limiti di 5 ore e settimanali di Claude: percentuale, colore e azzeramento.               | Sì, ovunque.              |
| `sessions`     | Fino a 8 conversazioni aperte, le più importanti per prime: titolo, stato ed etichetta.     | Sì, tile e app.           |

I due campi nuovi sono costruiti da due funzioni pure alla fine di `hooks/phone.ts`. Questi estratti vengono da narsil-pet (GPL v3); il formattatore di questo sito ha mandato a capo le righe lunghe e aggiunto virgole finali e parentesi, e per il resto sono identici al file:

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

E subito sotto, le conversazioni:

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

Cosa notare:

- **`limits` ha zero, una o due righe**, `fiveHour` con l'etichetta `5 horas` (5 ore) e `week` con l'etichetta `Semana` (settimana). Un limite che Claude Code non ha comunicato viene lasciato fuori, non inviato come zero, e `resetsAt` è in secondi, o `null` quando Claude non l'ha detto. I valori vengono da `usage` della mod, che `usageOf` in `hooks/usage.ts` riempie con i limiti di utilizzo della sessione di tipo `five_hour` e `seven_day`, gli stessi che legge la riga di stato di Claude Code.
- **Il colore si decide sul computer.** `levelColor` in `hooks/usage.ts` restituisce `#F0435A` (rosso) da 85 %, `#F5B400` (giallo) da 60 %, e `#22B573` (verde) sotto. L'orologio dipinge ciò che gli viene detto, così il computer e l'orologio non sono mai in disaccordo.
- **`sessions` è l'elenco ordinato della mod.** `fleetOf` in `hooks/fleet.ts` ordina per `RANK`, "An error first, then what needs you, what works, what finished" (prima un errore, poi ciò che ha bisogno di te, ciò che lavora, ciò che ha finito): `error`, `waiting`, `working`, `done`, `idle`. A parità, viene prima quella cambiata più di recente.
- **Al massimo 8 sessioni, titoli di al massimo 40 caratteri.** Il commento dà il motivo: un messaggio ntfy è limitato a 4 KB, e la sigillatura lo allunga. Un titolo vuoto diventa `conversación`.
- **`status` è la parola per la macchina e `label` quella per lo schermo**, da `STATUS_LABEL` in `hooks/words.ts`: `working` è `TRABAJANDO`, `idle` è `PARADA`, `waiting` è `TE NECESITA`, `done` è `TERMINADA`, `error` è `ERROR`. L'orologio colora in base a `status` e scrive `label`.

Uno stato come lo riceve l'orologio, scritto per questa guida con valori inventati:

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

È la stessa forma che usa `StatusParserTest.kt`.

### NarsilState.kt: il contratto sull'orologio

L'orologio dichiara la stessa forma in Kotlin. L'intero file, da `domain/NarsilState.kt` in narsil-watch (GPL v3), senza le righe di package e di import:

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

Il primo commento è la regola di progetto, e funziona in entrambe le direzioni:

- **I campi che il computer aggiungerà in futuro vengono ignorati.** Il parser è costruito con `Json { ignoreUnknownKeys = true }`. Per questo `usage` non causa errori: non è dichiarato, quindi viene saltato. Un campo futuro verrà saltato allo stesso modo.
- **I campi che il computer non invia ancora sono vuoti per impostazione predefinita.** Uno stato di prima della 3.10.0 non ha `limits` né `sessions`, e il test "reads a state from before the watch fields, with no limits or sessions" (legge uno stato di prima dei campi per l'orologio, senza limiti né sessioni) controlla che si legga comunque, con entrambi gli elenchi vuoti.

Dentro un `Limit` o una `Session`, però, solo `resetsAt` ha un valore predefinito. Un limite senza la sua `key`, o una sessione senza la sua `label`, fa fallire l'intera decodifica, e il parser tratta il messaggio come se non ci fosse nessuno stato.

### StatusRepository.kt: la richiesta

`refresh()`, l'unico punto che chiede lo stato a ntfy.sh, gira su `Dispatchers.IO`, fuori dal thread principale. La riga della sua richiesta:

```kotlin
val url = "$NTFY/${URLEncoder.encode(statusTopic, "UTF-8")}/json?poll=1&since=latest"
```

Pezzo per pezzo:

- **`$NTFY`** è `https://ntfy.sh`.
- **`statusTopic`** è `topic.removeSuffix(STATUS_SUFFIX) + STATUS_SUFFIX`, con `STATUS_SUFFIX` uguale a `-estado`. Così l'orologio funziona sia che tu inserisca `narsil-0000000000example0` sia, per errore, `narsil-0000000000example0-estado`: non finisce mai per chiedere `-estado-estado`. Il topic viene codificato per l'URL prima di entrare nel percorso.
- **`/json`** chiede a ntfy.sh il suo flusso JSON: un oggetto JSON per riga, ognuno con un campo `event`.
- **`poll=1`** chiede ciò che ntfy.sh ha conservato e poi chiude la connessione, invece di tenerla aperta in attesa di nuovi messaggi. Un orologio non dovrebbe tenere aperta una connessione.
- **`since=latest`** chiede solo il messaggio più recente. All'orologio non serve niente di più vecchio: ogni stato sostituisce il precedente.

L'helper `get(url, limit)` apre una `HttpURLConnection` con un timeout di connessione di 10 secondi e un timeout di lettura di 10 secondi (`TIMEOUT = 10_000`). Restituisce `null` a meno che la risposta non sia HTTP 200. Legge al massimo `limit + 1` byte, e restituisce `null` se ce n'erano più di `limit`: 64 KB per lo stato (`MAX_STATE`), 256 KB per l'immagine (`MAX_ART`). Un topic che qualcuno ha riempito di spazzatura non può far leggere all'orologio dei megabyte.

### Cosa conserva, e quando

Il repository conserva cinque cose nel file privato di `SharedPreferences` `narsil`, più un file:

| Chiave o file | Cosa contiene                                                                       |
| ------------- | ----------------------------------------------------------------------------------- |
| `topic`       | Il tuo topic, senza spazi ai lati.                                                  |
| `key`         | La tua chiave, senza spazi ai lati, o vuota.                                        |
| `raw`         | La risposta grezza di ntfy dell'ultima lettura buona.                               |
| `checkedAt`   | L'ultima volta che l'orologio ha ricevuto una risposta da ntfy.sh, in millisecondi. |
| `art.png`     | L'ultima immagine di Narsil, nella cartella dei file privati dell'app.              |
| `artUrl`      | L'URL da cui viene quell'immagine.                                                  |

Il resto di `refresh()` decide cosa conservare. Da `data/StatusRepository.kt` in narsil-watch (GPL v3):

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

Quindi:

- **Niente rete, un timeout, un errore HTTP o una risposta troppo grande:** non cambia niente, `checkedAt` compreso. Il risultato è lo stato conservato, se c'è. Essere offline non è un errore che l'orologio mostra.
- **Una risposta che si legge come uno stato:** le righe grezze sostituiscono `raw`, `checkedAt` avanza, e l'immagine viene scaricata se il suo URL è cambiato.
- **Una risposta vuota, rumore o sigillata con un'altra chiave:** `checkedAt` avanza, ma `raw` resta. Un messaggio sbagliato non cancella mai una lettura buona.

Un dettaglio è facile da perdere. Il repository conserva la risposta **grezza**, non lo stato decodificato, e `cached()` la rianalizza ogni volta, con la chiave così com'è in quel momento:

```kotlin
fun cached(): NarsilState? = (StatusParser.parse(prefs.getString(RAW, "").orEmpty(), key.ifEmpty { null }) as? StatusResult.Ok)?.state
```

Questo mantiene un solo percorso di codice per la lettura, e significa che la copia conservata di uno stato sigillato resta sigillata nella memoria dell'orologio. Il prezzo: cambia la chiave, e una copia sigillata conservata da prima non si apre più.

### StatusParser.kt: dalle righe di ntfy a uno stato

`parse` restituisce uno di tre risultati:

```kotlin
sealed interface StatusResult {
    data class Ok(val state: NarsilState) : StatusResult

    // the topic holds no state yet, or only noise
    data object Empty : StatusResult

    // sealed, and the watch has no key or the wrong one
    data object NeedsKey : StatusResult
}
```

Queste righe e l'estratto seguente vengono da `data/StatusParser.kt` in narsil-watch (GPL v3). Il lavoro:

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

Passo dopo passo:

1. **Ogni riga è un evento di ntfy.** Le righe che non sono oggetti JSON vengono saltate. Contano solo gli eventi di tipo `message`; ntfy può inviarne altri.
2. **Vince l'ultimo messaggio.** Con `since=latest` di solito ce n'è uno solo, ma prendere l'ultimo rende il parser corretto per qualsiasi risposta.
3. **Il suo campo `message` è il testo della mod**, lo stato come stringa JSON.
4. **Se inizia con `narsil1:`, è sigillato.** Senza una chiave, o se la chiave non lo apre, il risultato è `NeedsKey`.
5. **Dentro il sigillo c'è un'altra busta.** La mod sigilla `sealedPayload(m)`, che per un messaggio senza titolo è `{"message": "..."}`. Quindi il parser legge quel `message` interno, che è lo stato.
6. **Lo stato viene decodificato in `NarsilState`.** Una `SerializationException` o una `IllegalArgumentException` danno `Empty`.

### Seal.kt: aprire il sigillo con la stessa chiave

`/narsil movil clave` fa sigillare alla mod tutto ciò che invia. [Avvisi sul telefono e sull'orologio](/it/mods/pet/phone-and-watch/) spiega lo schema dal lato della mod; qui c'è la metà dell'orologio. `Seal.kt` implementa solo `unseal`, dato che l'orologio non sigilla mai niente.

Il commento in cima al file enuncia il formato, da `data/Seal.kt` in narsil-watch (GPL v3):

```kotlin
// Opens what Narsil seals with /narsil movil clave (hooks/seal.ts):
// HMAC-SHA256 in counter mode as the keystream, then a second HMAC over the
// nonce and the ciphertext (encrypt-then-MAC). "narsil1:" + base64url of
// nonce (16) | ciphertext | tag (32).
```

`unseal(key, sealed)` fa esattamente ciò che fa `unseal` di narsil-pet, nello stesso ordine:

1. **Il prefisso.** Senza `narsil1:` restituisce `null`.
2. **I byte.** Il resto viene decodificato da base64url. Meno di 48 byte (16 di nonce più 32 di tag) restituisce `null`.
3. **La chiave.** La tua chiave, 43 caratteri base64url, viene decodificata nei suoi 32 byte.
4. **Prima il tag.** `macKey = HMAC(key, "mac")`, poi `HMAC(macKey, nonce ‖ ciphertext)`, confrontato con gli ultimi 32 byte. Se è diverso, restituisce `null` senza decifrare niente.
5. **Solo allora il testo.** `encKey = HMAC(key, "enc")`. Il blocco `i` del keystream è `HMAC(encKey, nonce ‖ i)`, con `i` su 4 byte, big-endian. Ogni blocco dà 32 byte, messi in XOR con il testo cifrato. Il risultato viene letto come UTF-8.

I due lati differiscono nel come, non nel cosa:

| Passo             | narsil-pet `hooks/seal.ts`                                                                                                                          | narsil-watch `Seal.kt`                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| HMAC-SHA256       | Costruito a mano su `crypto.subtle.digest`, perché "The hooks module's crypto has SHA-256 alone" (il crypto del modulo degli hook ha solo SHA-256). | `javax.crypto.Mac` con `HmacSHA256`.                                         |
| Base64url         | I suoi `toBase64Url` e `fromBase64Url`, sopra `btoa` e `atob`.                                                                                      | `java.util.Base64.getUrlDecoder()`.                                          |
| Confronto del tag | `tag.some((b, i) => b !== given[i])`.                                                                                                               | `MessageDigest.isEqual`, che impiega lo stesso tempo qualunque siano i byte. |
| Errori            | Qualsiasi eccezione dà `null`.                                                                                                                      | Una `IllegalArgumentException` dà `null`.                                    |

Il test che dimostra che concordano è `SealTest.kt`. Il suo commento: "The vector comes from Narsil's own hooks/seal.ts, with a fixed nonce (100..115), so the watch opens exactly what the PC seals." (il vettore viene dallo stesso hooks/seal.ts di Narsil, con un nonce fisso, 100..115, così l'orologio apre esattamente ciò che sigilla il PC.) La chiave sono i byte da 0 a 31, `AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8`; il testo in chiaro è un piccolo `{"message": ...}` con un `xp` e una sessione. I 16 byte di nonce da 100 a 115 sono le lettere `defghijklmnopqrs`, ed è per questo che il testo sigillato inizia con `narsil1:ZGVmZ2hpamtsbW5vcHFyc`, il loro base64url.

Per questa guida, il vettore è stato verificato anche nell'altro senso: eseguendo `seal()` di narsil-pet da `hooks/seal.ts` con quella chiave, quel testo e quel nonce si ottiene esattamente la stringa di `SealTest.kt`.

### Cosa succede con una chiave sbagliata, senza chiave o con un messaggio non sigillato

Nel codice è preciso, quindi eccolo caso per caso:

| Il messaggio sul topic               | La chiave sull'orologio | `Seal.unseal`                  | `StatusParser.parse`           |
| ------------------------------------ | ----------------------- | ------------------------------ | ------------------------------ |
| Sigillato                            | Quella giusta           | Il testo interno               | `Ok`                           |
| Sigillato                            | Nessuna                 | Non chiamato                   | `NeedsKey`                     |
| Sigillato                            | Un'altra chiave valida  | `null`: il tag non corrisponde | `NeedsKey`                     |
| Sigillato, con un carattere cambiato | Quella giusta           | `null`: il tag non corrisponde | `NeedsKey`                     |
| Non sigillato                        | Nessuna                 | Non chiamato                   | `Ok`, letto come JSON semplice |
| Non sigillato                        | Qualsiasi chiave        | Non chiamato                   | `Ok`, letto come JSON semplice |
| Non sigillato, e non è uno stato     | Qualsiasi               | Non chiamato                   | `Empty`                        |

`SealTest.kt` copre la colonna `Seal`: "opens what Narsil seals" (apre ciò che sigilla Narsil), "another key opens nothing" (un'altra chiave non apre niente), "a tampered message opens nothing" (un messaggio manomesso non apre niente) e "what is not sealed opens nothing" (ciò che non è sigillato non apre niente), che controlla che `unseal(key, "no sellado")` (non sigillato) e `unseal("not base64!", sealed)` diano entrambi `null`. `StatusParserTest.kt` copre l'ultima colonna in "a sealed state needs the key" (uno stato sigillato ha bisogno della chiave).

Ne seguono due conseguenze.

**Una chiave sbagliata nasconde anche lo stato conservato.** Dopo un `NeedsKey`, `raw` non viene toccato, ma `cached()` lo rianalizza con la chiave sbagliata. Se la copia conservata era sigillata, non si apre più nemmeno lei: il tile dice `configúrame` (configurami), la complicazione non mostra dati, e l'app mostra la sua nota `El estado va sellado: falta la clave o no es la de /narsil movil clave.` (lo stato è sigillato: manca la chiave o non è quella di /narsil movil clave.) Rimetti la chiave giusta e torna tutto, dallo stesso `raw`.

**Una chiave non fa rifiutare all'orologio i messaggi in chiaro.** Il parser chiama `unseal` solo per un testo che inizia con `narsil1:`. Uno stato in chiaro viene letto che tu abbia una chiave o no. Questo fa funzionare l'orologio anche dopo `/narsil movil clave off`, ma significa anche che chiunque conosca il tuo topic può pubblicare uno stato in chiaro, e l'orologio lo mostrerà. La chiave protegge ciò che leggi dagli altri; non dimostra chi ha scritto ciò che leggi.

### L'immagine: solo da narsil-pet

Quando una lettura è buona, il repository scarica il disegno indicato in `art`. Da `StatusRepository.kt` (GPL v3):

```kotlin
// Narsil's art, only from the repository that publishes it: whoever knows
// an unsealed topic could write to it.
private fun fetchArt(url: String) {
    if (!url.startsWith(ART_ORIGIN) || url == prefs.getString(ART_URL, null)) return
```

`ART_ORIGIN` è `https://raw.githubusercontent.com/davshn/narsil-pet/`. Il commento ne dà il motivo (chi conosce un topic non sigillato potrebbe scriverci): uno stato in chiaro falsificato potrebbe indicare qualsiasi URL, e questo controllo impedisce all'orologio di scaricarlo. Salta anche il download quando l'URL è quello già su disco, così la stessa posa viene scaricata una volta sola. L'immagine viene scritta in `art.png` solo se pesa 256 KB o meno.

### I segreti, in parole semplici

- **Il topic** è salvato nelle preferenze private dell'app, e viaggia solo nel percorso della richiesta a ntfy.sh. Permette a chiunque di leggere i tuoi messaggi e di pubblicare sul topic. Cambialo con `/narsil movil nuevo`, poi inserisci quello nuovo sull'orologio.
- **La chiave** è salvata accanto e non viene mai inviata da nessuna parte. Apre i messaggi sigillati. `/narsil movil clave` ne crea una nuova ogni volta; quella vecchia smette di aprire i nuovi messaggi.
- **Le parole della mod nominano ancora ricevitori più vecchi.** Il commento di `hooks/seal.ts` nomina "the PC, the Firefox extension and the phone app" (il PC, l'estensione di Firefox e l'app del telefono), e la risposta di `/narsil movil clave` dice di incollare la chiave in "la extensión de Firefox" (l'estensione di Firefox). L'orologio apre lo stesso sigillo; incolla la stessa chiave sotto **Configurar** (configura).

## Costruiscila con Claude

Chiedi a Claude solo lo strato dei dati, senza nessuna schermata: le classi dello stato, il parser, il sigillo e il repository, con i test. L'unica idea che deve fare bene è che una risposta sbagliata non sostituisce mai una lettura buona.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nella mia app Wear OS `my-watch` (Kotlin, kotlinx.serialization), scrivi lo strato dei dati per lo stato ntfy di Narsil. `domain/NarsilState.kt`: classi `@Serializable` per `{ xp, art, at, cacheMinutes, limits: [{ key, label, percent, color, resetsAt }], sessions: [{ title, status, label }] }`, con ogni campo di primo livello che ha un valore predefinito vuoto. `data/Seal.kt`: `unseal(key, sealed): String?` per il formato di `hooks/seal.ts` di narsil-pet (prefisso `narsil1:`, base64url di nonce 16 + ciphertext + tag 32; `macKey = HMAC(key,"mac")`, `encKey = HMAC(key,"enc")`, blocco i del keystream = `HMAC(encKey, nonce ‖ i as 4 bytes big-endian)`, controlla il tag con `MessageDigest.isEqual` prima di decifrare). `data/StatusParser.kt`: analizza le righe JSON di ntfy, tieni l'ultimo `event == "message"`, aprilo se è sigillato (il JSON interno è `{ message }`), e restituisci `Ok`, `Empty` o `NeedsKey`. `data/StatusRepository.kt`: GET `https://ntfy.sh/<topic>-estado/json?poll=1&since=latest` con timeout di 10 s e un tetto di 64 KB; conserva le righe grezze solo quando si analizzano come `Ok`; su un errore di rete restituisci lo stato conservato. Test JUnit, compreso un vettore noto sigillato da `hooks/seal.ts` con un nonce fisso.

### Cosa controllare nella risposta di Claude

1. La richiesta usa `poll=1&since=latest`, codifica il topic e aggiunge `-estado` senza raddoppiarlo.
2. La risposta ha un limite di dimensione, e viene letta solo una risposta HTTP 200.
3. La risposta grezza viene conservata solo quando si analizza come uno stato. Un errore di rete, un topic vuoto o una chiave sbagliata non la sovrascrivono mai.
4. `unseal` controlla il tag prima di decifrare, e lo confronta con `MessageDigest.isEqual`.
5. I campi sconosciuti vengono ignorati (`ignoreUnknownKeys = true`), e uno stato senza `limits` o `sessions` si legge comunque.
6. C'è un test con un vettore prodotto dallo stesso `seal.ts` della mod, non solo un giro completo dal lato dell'orologio. Un giro completo dimostra solo che l'orologio è d'accordo con sé stesso.

Se un controllo fallisce, di' a Claude cosa vedi: "dopo un errore di rete il tile è diventato vuoto", che indica che il percorso dell'errore sovrascrive lo stato conservato.

### Come l'ha chiesta l'autore

Per questa parte non esiste una richiesta registrata. Questa è una ricostruzione dalla cronologia dei commit:

- narsil-pet `5a9ee10` (2026-11-01) "feat: seal phone messages with /narsil movil clave, send reset times and an Abrir Claude button" (sigilla i messaggi al telefono con /narsil movil clave, invia gli orari di azzeramento e un pulsante Abrir Claude). Il sigillo nasce dal lato della mod.
- narsil-pet `6400a6f` (2026-11-23) "feat(phone): publish Claude limits and open conversations for the watch" (pubblica i limiti di Claude e le conversazioni aperte per l'orologio). Arrivano `watchLimits` e `watchSessions`, con il test "the watch gets the 5-hour and weekly limits with their color and reset, and at most 8 conversations" (l'orologio riceve i limiti di 5 ore e settimanali con il loro colore e azzeramento, e al massimo 8 conversazioni). Il suo messaggio: "The status topic now carries the 5-hour and weekly limits (percent, color, reset) and up to 8 open conversations, so a Wear OS app can show them." (il topic di stato ora porta i limiti di 5 ore e settimanali, con percentuale, colore e azzeramento, e fino a 8 conversazioni aperte, così un'app Wear OS può mostrarli.)
- narsil-watch `b47ca7a` (2026-11-23) "feat: Narsil on Wear OS with Claude limits and open conversations" (Narsil su Wear OS con i limiti di Claude e le conversazioni aperte). Lo strato dei dati e i suoi test arrivano con il resto dell'app. Il suo messaggio finisce così: "It reads Narsil's state from its ntfy.sh status topic and opens it with the /narsil movil clave key when sealed." (legge lo stato di Narsil dal suo topic di stato su ntfy.sh e lo apre con la chiave di /narsil movil clave quando è sigillato.)

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida. Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

Un lettore ridotto, scritto per questa guida e adattato da `StatusParser.kt`, `StatusRepository.kt` e `Seal.kt` in [narsil-watch](https://github.com/davshn/narsil-watch) (GPL v3). Usa solo le chiamate Java e kotlinx.serialization che usano quei file. Lascia fuori l'immagine e la copia salvata:

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

Due semplificazioni da conoscere. Il ciclo di lettura si ferma un po' oltre i 64 KB invece che a 64 KB più un byte, il che basta per rifiutare una risposta troppo grande; `readNBytesCompat` del repository reale si ferma esattamente. E questa versione ricalcola il blocco del keystream per ogni byte, per brevità, 32 volte il lavoro necessario; `xorStream` reale calcola ogni blocco una volta sola. `stateText` restituisce `null` sia per "nessuno stato" sia per "serve la chiave"; il parser reale li tiene distinti, perché l'app ti dice quale dei due è.

## Errori comuni e come testarlo

- **Tenere aperta la connessione.** Senza `poll=1`, l'endpoint `/json` di ntfy continua a trasmettere. Su un orologio significa batteria consumata, e un job di aggiornamento che non finisce mai.
- **Sovrascrivere la lettura buona.** Salvare ogni risposta significa che un solo poll vuoto, dopo che ntfy.sh ha dimenticato il messaggio, svuota il tile.
- **Dimenticare la busta interna.** Il testo sigillato si apre in `{"message": "..."}`, non nello stato stesso.
- **Supporre che una chiave significhi "solo sigillati".** Uno stato in chiaro viene letto comunque. Quando c'è una chiave impostata, tratta uno stato in chiaro come possibilmente falsificato, se per te conta.
- **Un decoder rigido.** Senza `ignoreUnknownKeys`, il campo non dichiarato `usage` fa fallire ogni stato.

Per eseguire i test, dal repository:

```bash
./gradlew :app:testDebugUnitTest
```

`StatusParserTest.kt` ha quattro test: "reads the state as the PC sends it in the clear" (legge lo stato come il PC lo invia in chiaro), "reads a state from before the watch fields, with no limits or sessions" (legge uno stato di prima dei campi per l'orologio, senza limiti né sessioni), "a sealed state needs the key" (uno stato sigillato ha bisogno della chiave) e "an empty topic or noise is no state yet" (un topic vuoto o del rumore non sono ancora uno stato). `SealTest.kt` ha i quattro elencati sopra.

Per verificare con il topic reale dal tuo computer, puoi fare a ntfy.sh la stessa domanda che fa l'orologio. Questo è scritto per questa guida, con il topic di esempio:

```bash
curl -s "https://ntfy.sh/narsil-0000000000example0-estado/json?poll=1&since=latest"
```

Usa il tuo topic solo nel tuo terminale, mai in uno condiviso né in uno screenshot.

### Dove il codice e il README differiscono

- Il README di narsil-pet documenta ancora cinque campi per `-estado` (`xp`, `art`, `at`, `cacheMinutes`, `usage`). Dalla 3.10.0 il suo codice ne invia sette; `limits` e `sessions` mancano da quella tabella. Il test di narsil-pet "as a turn ends from the phone, the extension gets only what it reads on the status topic, silently" (quando un turno finisce dal telefono, l'estensione riceve solo ciò che legge sul topic di stato, in silenzio) li elenca tutti e sette.
- Il README di narsil-pet dice che lo stato parte "At the end of each turn" (alla fine di ogni turno). Il codice lo invia anche con ogni domanda, e solo mentre sei lontano.
- Il README dell'orologio dice che la chiave permette all'orologio di aprire lo stato "just as the computer sealed it" (esattamente come l'ha sigillato il computer). È vero, e il codice aggiunge una cosa che il README non dice: con una chiave impostata, un messaggio in chiaro viene comunque accettato.

## Per andare oltre

- Leggi `data/` in [narsil-watch](https://github.com/davshn/narsil-watch) su GitHub.
- Il lato della mod del topic, il conteggio giornaliero e il sigillo: [Avvisi sul telefono e sull'orologio](/it/mods/pet/phone-and-watch/).
- Fai in modo che il parser rifiuti i messaggi in chiaro quando c'è una chiave impostata, così uno stato falsificato viene ignorato. Pensa a cosa succede allora subito dopo `/narsil movil clave off`.
- Torna a [Cos'è Narsil Watch](/it/watch/what-it-is/) per il quadro completo.
- La prossima: [Il tile](/it/watch/tile/), i due anelli e Narsil al centro.
