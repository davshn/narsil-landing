---
title: Cifratura e impostazioni
description: "Come Seal.kt apre ciò che la mod ha sigillato con /narsil movil clave, byte per byte come lo sigilla hooks/seal.ts, cosa conserva l'app e dove, come ruotare chiave e topic, e il modello delle minacce."
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

## Cosa fa

Il tuo topic di ntfy.sh è pubblico in un certo senso: chiunque ne conosca il nome può leggerlo. `/narsil movil clave` ("chiave") nella mod di Narsil sistema la parte della lettura. Crea una chiave, e da quel momento la mod sigilla tutto ciò che pubblica, avvisi e stati allo stesso modo. Chi legge il topic vede "Narsil" e un testo illeggibile che inizia con `narsil1:`. Tu scrivi la stessa chiave nelle impostazioni dell'app, e l'app apre ogni messaggio prima di mostrarlo.

Quando la chiave è sbagliata o manca:

- **Un avviso** dice "🔒 Aviso cifrado: pon la clave en los ajustes de la app." (avviso cifrato: metti la chiave nelle impostazioni dell'app).
- **Il blocco nel menu laterale** dice "🔒 Toca y pon la clave" (tocca e inserisci la chiave), se non ha uno stato precedente da mostrare.

La schermata delle impostazioni contiene due cose, il topic e la chiave, e le conserva solo sul telefono. Si apre da tre posti: un tocco su Narsil (o su un avviso) nel blocco del menu laterale, un tocco sulla notifica silenziosa "Narsil escucha tus avisos", e una pressione prolungata sull'icona dell'app, poi **Ajustes** (impostazioni), dove il launcher mostra le scorciatoie.

> **Sperimentale.** L'app si basa sulla struttura della pagina di `claude.ai` e sulle sue richieste interne, non su un'API pubblica, quindi un aggiornamento di Claude può rompere la banda e i colori. La cifratura descritta qui è uno schema costruito a mano per Narsil, non un formato di libreria revisionato. È verificata contro l'output della mod stessa, ma nessuno l'ha sottoposta a un audit; considerala una protezione dai lettori occasionali del tuo topic, e leggi il modello delle minacce alla fine.

## Come funziona dentro

### Cosa sigilla la mod, e cosa no

La mod decide cosa va dentro. Da `hooks/phone.ts` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later):

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

Per un avviso, il titolo e il testo vanno dentro, come JSON, e il titolo fuori diventa solo `Narsil`. Tutto il resto del messaggio resta leggibile: la priorità, i tag, l'indirizzo dell'immagine e il pulsante. Per uno stato su `-estado`, che non ha titolo, va dentro l'intero stato JSON.

### Il formato: `narsil1:` e tre parti

Un messaggio sigillato è il prefisso `narsil1:` seguito da una stringa base64url, che decodificata dà tre parti una dopo l'altra:

| Parte         | Dimensione      | Cos'è                                                                                 |
| ------------- | --------------- | ------------------------------------------------------------------------------------- |
| Nonce         | 16 byte         | Casuale per ogni messaggio, così lo stesso testo non si sigilla mai allo stesso modo. |
| Testo cifrato | Uguale al testo | Il testo UTF-8, in XOR con un keystream.                                              |
| Tag           | 32 byte         | La prova che il nonce e il testo cifrato sono stati fatti con questa chiave.          |

La chiave stessa è di 32 byte casuali, mostrati dalla mod in base64url (43 caratteri). Lo schema usa una sola primitiva, HMAC-SHA256, per tutto. Il commento della mod spiega perché: "The hooks module's crypto has SHA-256 alone" (il crypto del modulo degli hook ha solo SHA-256), quindi HMAC è costruito a mano su di essa. [Avvisi sul telefono e sull'orologio](/it/mods/pet/phone-and-watch/) ripercorre passo per passo il lato della sigillatura.

### `Seal.kt`: aprirlo

Da `Seal.kt` in narsil-android (MIT):

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

In ordine:

1. **Decodifica** il messaggio e la chiave da base64. `bytesOf` accetta l'alfabeto standard e quello sicuro per gli URL, con o senza padding, e dà un array vuoto per tutto ciò che non è base64.
2. **Rifiuta ciò che non può essere giusto**: un messaggio più corto di un nonce più un tag, o una chiave vuota. Entrambi lanciano un'eccezione con il messaggio "La clave no es la de este aviso" (la chiave non è quella di questo avviso).
3. **Deriva due chiavi** dalla tua: `encKey = HMAC(key, "enc")` per il keystream e `macKey = HMAC(key, "mac")` per il tag. Usare la stessa chiave per entrambi i compiti è un errore classico; derivarne due lo evita.
4. **Controlla prima il tag.** Calcola `HMAC(macKey, nonce ‖ ciphertext)` e lo confronta con il tag ricevuto. Se è diverso significa un'altra chiave o un byte cambiato, e il codice si ferma lì, prima di decifrare qualsiasi cosa. Quest'ordine si chiama encrypt-then-MAC.
5. **Decifra** 32 byte alla volta. Il blocco `i` del keystream è `HMAC(encKey, nonce ‖ i)`, con `i` su quattro byte, big-endian (l'ordine predefinito di `ByteBuffer`). Lo mette in XOR con il testo cifrato. È la modalità a contatore (CTR), con HMAC al posto di un cifrario a blocchi.

Il confronto usa `MessageDigest.isEqual`, che impiega lo stesso tempo qualunque sia il numero di byte che coincidono, così il tempo che ci mette non rivela niente sul tag giusto.

### Byte per byte con `hooks/seal.ts`

Il commento della classe dice che l'app apre ciò che la mod sigilla "byte for byte as it seals it" (byte per byte come lo sigilla). A confronto con `hooks/seal.ts` di narsil-pet:

| Passo             | Mod (`hooks/seal.ts`)                                | App (`Seal.kt`)                                |
| ----------------- | ---------------------------------------------------- | ---------------------------------------------- |
| Prefisso          | `narsil1:`                                           | `narsil1:`                                     |
| HMAC              | Costruito a mano da SHA-256 (`crypto.subtle.digest`) | `javax.crypto.Mac` con `HmacSHA256`            |
| Due chiavi        | `hmac(k, 'enc')`, `hmac(k, 'mac')`                   | `hmac(shared, "enc")`, `hmac(shared, "mac")`   |
| Contatore         | `DataView.setUint32(0, i)`: 4 byte, big-endian       | `ByteBuffer.putInt(block)`: 4 byte, big-endian |
| Tag su            | `nonce ‖ ciphertext`                                 | `nonce ‖ ciphertext`                           |
| Confronto del tag | `tag.some((b, i) => b !== given[i])`                 | `MessageDigest.isEqual`                        |
| Base64            | Sicuro per gli URL, senza padding                    | Entrambi gli alfabeti, padding facoltativo     |
| Troppo corto      | Restituisce `null`                                   | Lancia un'eccezione                            |
| Chiave vuota      | Non controllata                                      | Lancia un'eccezione                            |
| Chiave sbagliata  | Restituisce `null`                                   | Lancia `IllegalArgumentException`              |

Un HMAC costruito a mano e uno di libreria danno gli stessi byte quando entrambi seguono la costruzione standard, cosa che il commento della mod afferma per WebCrypto: "gives the same bytes" (dà gli stessi byte). La prova qui è il test. `SealTest.kt` porta una chiave e un messaggio sigillato il cui commento dice "The vector was sealed by a JavaScript port of the mod's hooks/seal.ts" (il vettore è stato sigillato da un porting JavaScript di hooks/seal.ts della mod) (il commit `9051a31` dice che il vettore veniva dal codice dell'estensione precedente). Il testo dentro è lungo di proposito, "texto largo para cruzar varios bloques de 32 bytes" (testo lungo per attraversare diversi blocchi da 32 byte), e ha accenti e un `✓`, così vengono messi alla prova sia il contatore sia l'UTF-8. I test controllano che il vettore si apra esattamente in quel testo, che un'altra chiave lanci un'eccezione con il messaggio in spagnolo, quali testi contano come sigillati, e i tre casi di `unseal` qui sotto.

### `unseal`: cosa succede davvero con ogni messaggio

`Seal.open` si usa attraverso `unseal`, che prende un messaggio di ntfy e ne restituisce uno con il titolo e il testo rimessi al loro posto. Da `Seal.kt` (MIT):

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

Leggilo con attenzione, perché i casi non sono tutti quelli che potresti aspettarti:

| Il messaggio                | La chiave nell'app         | Un avviso mostra                            | La banda                                             |
| --------------------------- | -------------------------- | ------------------------------------------- | ---------------------------------------------------- |
| Non sigillato               | Nessuna                    | Il suo titolo e il suo testo                | Prende lo stato                                      |
| Non sigillato               | Qualsiasi chiave           | Il suo titolo e il suo testo, **invariati** | Prende lo stato                                      |
| Sigillato                   | Quella giusta              | Il titolo e il testo di dentro              | Prende lo stato                                      |
| Sigillato                   | Sbagliata, vuota o nessuna | Titolo `Narsil`, il testo 🔒                | Segna `isSealed`; tiene l'eventuale stato precedente |
| Sigillato, un byte cambiato | Quella giusta              | Titolo `Narsil`, il testo 🔒                | Segna `isSealed`; tiene l'eventuale stato precedente |

Ne seguono tre fatti:

- **Una chiave sbagliata fallisce in modo chiuso.** Niente testo parziale, niente spazzatura: il messaggio viene segnato `sealed: true` e il suo testo svuotato. Qualsiasi errore dentro, un tag sbagliato, un errore di decodifica, o un contenuto che non è JSON, finisce allo stesso modo.
- **Un messaggio non sigillato passa, con o senza chiave.** `unseal` lo restituisce invariato se non inizia con `narsil1:`. Una volta impostata una chiave, l'app non pretende la sigillatura. È comodo dopo `/narsil movil clave off`, ma significa anche che la chiave non impedisce a chi conosce il tuo topic di pubblicare un avviso in chiaro o uno stato in chiaro che l'app mostrerà.
- **Il lucchetto della banda è più discreto di quello dell'avviso.** Come spiega la [guida 4](/it/android/sidebar/), `StateModel` tiene il suo stato precedente quando un messaggio non si apre, e il blocco mostra uno stato ogni volta che ne ha uno. L'avviso del lucchetto compare solo quando non c'è niente da mostrare.

### `Settings.kt`: cosa conserva l'app, e dove

Da `Settings.kt` (MIT):

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

Quattro valori, nel file `SharedPreferences` di Android chiamato `narsil`:

| Chiave        | Cosa contiene                                                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `topic`       | Il tuo topic. Viene riletto solo se corrisponde ancora a `^[-_A-Za-z0-9]{1,64}$`.                                          |
| `key`         | La tua chiave, come l'hai scritta. Una vuota si legge come nessuna chiave.                                                 |
| `lastAlertId` | L'id dell'ultimo avviso mostrato, per riprendere ([guida 6](/it/android/alerts-service/)). Si cancella con un nuovo topic. |
| `band`        | L'ultimo stato della banda, con il topic a cui appartiene; ignorato per qualsiasi altro topic.                             |

`MODE_PRIVATE` mette il file nella cartella dei dati dell'app stessa, che la sandbox di Android chiude alle altre app. Dentro, i valori sono testo in chiaro: l'app non li cifra con il Keystore di Android. `android:allowBackup="false"` nel manifest li tiene fuori dai backup di Android. La specifica S4 spiega perché si scrivono e non sono integrati: "the repository is public and named `narsil-android`: no topic or key in the code; they are typed in the app's settings." (il repository è pubblico e si chiama `narsil-android`: niente topic né chiave nel codice; si scrivono nelle impostazioni dell'app.)

### `SettingsActivity.kt`: la schermata

La schermata è un layout Android semplice: un testo introduttivo, un campo **Topic**, un campo **Clave (opcional)** (chiave, facoltativa), il pulsante **Guardar y recibir avisos**, una riga di stato, e il pulsante per il background della [guida 6](/it/android/alerts-service/). Vale la pena notare alcune scelte:

- **Il campo della chiave è un campo password** (`inputType="textPassword"`), quindi mostra dei puntini, ed entrambi i campi impostano `importantForAutofill="no"`, così nessun gestore di password si offre di salvarli.
- **Il salvataggio valida prima il topic.** Un topic con qualcosa che non siano lettere, numeri, `-` e `_` riceve "Ese topic no es válido: solo letras, números, - y _." (quel topic non è valido: solo lettere, numeri, - e _), e non viene salvato niente.
- **Entrambi i valori vengono ripuliti dagli spazi**, così uno spazio copiato insieme non fa danni.
- **Il topic viene scritto solo se è cambiato**, così salvare lo stesso topic conserva `lastAlertId` e gli avvisi riprendono da dove erano.
- **Salvare con il campo della chiave vuoto** toglie la chiave: il getter legge un valore vuoto come nessuna chiave.
- Poi avvia il servizio degli avvisi, dice "Guardado. Los avisos llegan a este teléfono; vuelve a Claude para ver la banda." (salvato; gli avvisi arrivano su questo telefono; torna a Claude per vedere la banda), e chiede il permesso per le notifiche se Android ne ha bisogno.

L'activity è `exported` nel manifest, il che permette alla scorciatoia del launcher di aprirla. `res/xml/shortcuts.xml` dichiara quell'unica scorciatoia statica, con l'etichetta breve **Ajustes** e quella lunga **Ajustes de Narsil**, che punta a `io.github.davshn.narsil.SettingsActivity`. Essere esportata significa anche che un'altra app potrebbe aprire la schermata, ma non ci guadagna niente: la schermata mostra solo dei campi, e non contengono niente che quell'app possa leggere.

### Ruotare la chiave e il topic

Ogni comando gira in Claude Code sul tuo computer; ogni cambiamento va poi nelle impostazioni dell'app.

| Vuoi                                   | Sul computer              | Nell'app                                                                                                                                    |
| -------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Iniziare a cifrare, o una nuova chiave | `/narsil movil clave`     | Incolla la nuova chiave e salva. Finché non lo fai, gli avvisi mostrano il testo 🔒.                                                        |
| Smettere di cifrare                    | `/narsil movil clave off` | Non serve niente, dato che i messaggi in chiaro passano; svuota il campo della chiave per fare ordine.                                      |
| Un nuovo topic                         | `/narsil movil nuevo`     | Incolla il nuovo topic e salva. Gli avvisi ripartono su di esso, e la banda parte da uno stato vuoto.                                       |
| Fermare gli avvisi                     | `/narsil movil off`       | Niente da fare; l'app non ha un interruttore suo.                                                                                           |
| Cancellare tutto sul telefono          |                           | In **Impostazioni → App → Narsil → Spazio di archiviazione** di Android, cancellalo: vanno via la sessione, il topic, la chiave e lo stato. |

Le risposte della mod confermano ogni passo. Per un nuovo topic: "Narsil: tema nuevo, el anterior ya no recibe nada." (nuovo topic, quello precedente non riceve più niente). Per una nuova chiave, mostra la chiave e aggiunge "/narsil movil clave crea otra clave" (crea un'altra chiave). Quella risposta dice ancora di mettere la chiave nelle opzioni dell'estensione di Firefox; su Android, va nelle impostazioni di questa app.

Ogni `/narsil movil clave` crea una chiave **nuova**, e nessun comando mostra di nuovo quella attuale. Sul computer, la chiave vive anche nelle preferenze della mod e nella risposta del comando, che fa parte della tua conversazione con Claude. [Avvisi sul telefono e sull'orologio](/it/mods/pet/phone-and-watch/) parla di quel lato.

### Il modello delle minacce in parole semplici

Chi potrebbe vedere o fare cosa, dal codice:

- **ntfy.sh** vede ogni messaggio, l'indirizzo del telefono quando si connette, e il tuo topic in ogni richiesta. Senza una chiave vede tutto il testo. È un servizio di terze parti.
- **Chiunque conosca il tuo topic, senza una chiave dalla tua parte,** legge ogni avviso e ogni stato: nomi delle conversazioni, parte delle risposte di Claude, il tuo livello.
- **La stessa persona, con una chiave dalla tua parte,** vede che è partito un messaggio e quando, la sua priorità (quindi se Claude ha bisogno di te), i suoi tag, l'indirizzo dell'immagine (quindi lo stadio di Narsil e la posa dell'avviso), il pulsante e il titolo `Narsil`. Non il testo.
- **Falsificare un messaggio sigillato** senza la chiave non supera il controllo del tag, e l'app mostra il testo 🔒.
- **Falsificare un messaggio in chiaro** funziona, con o senza chiave, come mostrato sopra. Ciò che può fare è limitato dall'app: il testo entra come testo, un'immagine solo dalla cartella di Narsil, un tocco solo verso `claude.ai`. I suoi due pulsanti, invece, possono portare qualsiasi indirizzo, che si apre in un'altra app se lo tocchi. Uno stato in chiaro falsificato può mostrare un livello sbagliato, e un `at` molto avanti nel futuro impedirebbe agli stati reali di sostituirlo finché non cambi il topic o cancelli i dati dell'app.
- **La pagina** non riceve mai il topic né la chiave; solo lo stato già aperto ([guida 2](/it/android/webview-host/)).
- **Qualcuno con il tuo telefono sbloccato** può aprire le impostazioni e leggere il topic (il campo della chiave è mascherato, non nascosto a una persona determinata), e la notifica silenziosa mostra il topic nell'area delle notifiche.
- **Un computer con il debug USB consentito sul tuo telefono** può fare di più con una build di debug, che è ciò che installa `./gradlew installDebug`. Android gli permette di leggere i file privati di un'app debuggabile (con `adb shell run-as`), la chiave tra questi, e di ispezionare la pagina di Claude da `chrome://inspect`. Spegni il debug USB quando non lo usi.

Niente di tutto questo protegge il tuo account Claude in sé: quello è il cookie della tua sessione, conservato dalla WebView nella stessa cartella privata, e sicuro quanto il telefono.

## Costruiscila con Claude

Chiedi a Claude di portare in Kotlin il lato dell'apertura dello schema della mod, e di dimostrarlo con un vettore prodotto dal codice della mod stessa. L'unica idea che deve fare bene è l'ordine: prima controllare il tag, con un confronto a tempo costante, e solo dopo decifrare; e un errore di qualsiasi tipo deve dare un unico risultato chiaro di "non si apre", mai un testo parziale.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Porta la metà `unseal` di questo schema TypeScript in un `object` Kotlin senza dipendenze Android (qui sotto incollo `hooks/seal.ts` di narsil-pet). Usa `javax.crypto.Mac` con `HmacSHA256`, `ByteBuffer` per il contatore di 4 byte big-endian, e `MessageDigest.isEqual` per il tag. Decodifica base64url con o senza padding, e tratta come chiave sbagliata tutto ciò che non si decodifica, è più corto di 48 byte o ha una chiave vuota. Controlla il tag prima di decifrare. Aggiungi una funzione che prenda un messaggio di ntfy come `JSONObject` e, se il suo `message` inizia con `narsil1:`, sostituisca `title` e `message` con quelli di dentro, oppure svuoti `message` e imposti `sealed: true` quando non riesce ad aprirlo. Scrivi test JUnit con un vettore che produrrò eseguendo il `seal` TypeScript con un nonce fisso, più una chiave sbagliata, una chiave null, una chiave vuota e un messaggio in chiaro.

### Cosa controllare nella risposta di Claude

1. Il tag viene calcolato sul nonce e sul testo cifrato, e confrontato prima di qualsiasi decifratura.
2. Il confronto è `MessageDigest.isEqual`, non `contentEquals` né un ciclo che si ferma presto.
3. Il contatore è di quattro byte, big-endian, e parte da 0.
4. Due chiavi vengono derivate con HMAC di `"enc"` e `"mac"`; la chiave condivisa non viene mai usata direttamente.
5. Ogni errore finisce in un unico risultato, `sealed: true` con un messaggio vuoto.
6. Un test usa un vettore sigillato dal codice TypeScript, non solo un test di andata e ritorno attraverso il codice Kotlin stesso: un test di andata e ritorno passa anche quando entrambe le metà condividono lo stesso errore.

Se un controllo fallisce, di' a Claude cosa vedi: "il vettore della mod si apre in spazzatura dopo i primi 32 caratteri", il che indica il contatore.

### Come l'ha chiesta l'autore

Le parole del proprietario registrate in `odd/tasks/android-app.md` danno la cornice di questa guida. L2 (2026-11-24) dice "el repositorio seria publico" (il repository sarebbe pubblico), che la specifica S4 trasforma nella regola citata sopra: niente topic né chiave nel codice. La specifica S5, dell'agente, elenca "sealed messages opened with the key (`narsil1:`)" (messaggi sigillati aperti con la chiave, `narsil1:`) tra le regole che gli avvisi mantengono. T1 registra il primo task: "Gradle project and `Seal` port, tested against vectors from [l'estensione precedente]'s seal.js" (progetto Gradle e porting di `Seal`, testato contro vettori del seal.js dell'estensione precedente; il suo nome qui è omesso).

Il log registra il controllo con il topic e la chiave reali, il 2026-11-24 alle 00:44: "the mod's alert and state, sealed with the new key, opened in the app." (l'avviso e lo stato della mod, sigillati con la nuova chiave, si sono aperti nell'app.)

I commit (il nome di un progetto in un oggetto è sostituito da una descrizione tra parentesi quadre):

- `9051a31` (2026-11-24) "feat: open what the mod seals, as [l'estensione precedente]'s seal.js does" (apre ciò che la mod sigilla, come fa il seal.js dell'estensione precedente). Il suo messaggio: "Gradle project for the Android app, with the sealing port tested against a vector sealed by the extension's own code." (progetto Gradle per l'app Android, con il porting della sigillatura testato contro un vettore sigillato dal codice dell'estensione stessa.)
- `53c55c1` (2026-11-24) "feat: host claude.ai with [l'estensione precedente] in a WebView, and show Narsil's alerts from a foreground service" (ospita claude.ai con l'estensione precedente in una WebView, e mostra gli avvisi di Narsil da un servizio in primo piano). Il suo messaggio: "Settings keep the topic and key on the phone." (le impostazioni tengono il topic e la chiave sul telefono.)
- `9e514dd` (2026-11-24) "feat: open the settings from Narsil in the band and from the service's notification" (apre le impostazioni da Narsil nella banda e dalla notifica del servizio).
- `a275382` (2026-11-24) "docs: log the alerts and the band verified with the real topic and key" (registra gli avvisi e la banda verificati con il topic e la chiave reali).

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida (MIT). Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

Un sigillatore solo per i test in Kotlin, che segue `hooks/seal.ts`, e due test contro il `Seal` dell'app. Usa la chiave chiaramente falsa `example-key-not-real`, che decodificata come base64url dà 15 byte; HMAC accetta una chiave di qualsiasi lunghezza. Ricorda l'avvertenza dell'ultimo controllo qui sopra: questi test colgono un byte manomesso e un contatore rotto dal lato Kotlin, ma non sostituiscono il vettore del codice della mod stessa che usa `SealTest.kt`.

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

`"ñ".repeat(40)` occupa 80 byte in UTF-8, quindi con il JSON intorno il testo si estende su quattro blocchi da 32. Il byte 20 sta nel testo cifrato, subito dopo il nonce di 16 byte. I nonce fissi servono solo per il test; la mod ne estrae uno casuale nuovo per ogni messaggio, e così deve fare qualsiasi cosa sigilli che costruisci tu.

## Errori comuni e come testarlo

- **Decifrare prima di controllare il tag.** Un messaggio modificato produrrebbe spazzatura che potresti mostrare. Controlla prima, poi decifra.
- **Confrontare i tag con un ciclo che si ferma presto.** Rivela, con i suoi tempi, quanti byte coincidevano. Usa un confronto a tempo costante.
- **Un contatore nell'ordine di byte sbagliato.** I primi 32 byte si aprono, il resto è spazzatura. Quattro byte, big-endian.
- **Testare solo andate e ritorni.** Sigillare e aprire nello stesso codice vanno d'accordo anche quando sono sbagliati entrambi. Testa contro un vettore dell'altro lato.
- **Aspettarsi che la chiave blocchi i messaggi in chiaro.** In questa app non lo fa. Se ne costruisci una tua, decidi se un ricevitore con una chiave debba rifiutare i messaggi non sigillati.
- **Dimenticare di incollare la nuova chiave.** Ogni `/narsil movil clave` ne crea una nuova. Gli avvisi mostrano il testo 🔒 finché non la incolli.
- **Condividere uno screenshot delle impostazioni o dell'area delle notifiche.** Il topic è in entrambi.
- **Tenere la chiave nel repository.** Il repository dell'app è pubblico di proposito; topic e chiavi vanno nelle impostazioni.

Per testarlo, esegui `./gradlew testDebugUnitTest`: `SealTest.kt` apre il vettore della mod, rifiuta un'altra chiave, distingue il testo sigillato da quello in chiaro, rimette a posto il titolo e il testo, lascia stare i messaggi in chiaro, e segna ciò che una chiave sbagliata, null o vuota non riesce ad aprire. Sul telefono, con un topic inventato nelle impostazioni e il campo della chiave impostato a `example-key-not-real`, pubblica dal computer un avviso che sembra sigillato ma non lo è:

```bash
curl -H "Title: Narsil" -d "narsil1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" https://ntfy.sh/narsil-0000000000example0
```

La notifica dovrebbe dire "🔒 Aviso cifrado: pon la clave en los ajustes de la app.", dato che il suo tag non può coincidere. Poi pubblica `-d "Hola"` sullo stesso topic: compare così com'è, con o senza chiave.

### Dove il codice e il README differiscono

- Il README dice che con la chiave "Anyone reading the topic only sees "Narsil" and unreadable text." (chiunque legga il topic vede solo "Narsil" e un testo illeggibile.) `sealedMessage` della mod lascia in chiaro la priorità, i tag, l'indirizzo dell'immagine e il pulsante, quindi chi legge vede anche il tipo di avviso e lo stadio di Narsil.
- Il README dice che se la chiave non è quella che ha sigillato uno stato, la banda mostra "🔒 Toca y pon la clave". Il blocco lo fa solo quando non ha uno stato precedente per il topic, come spiegato sopra.
- Il README non dice che i messaggi non sigillati vengono accettati mentre è impostata una chiave. Il codice li accetta.

## Per andare oltre

- La [guida 6](/it/android/alerts-service/) mostra dove sta `unseal` nel percorso di un avviso, e il pulsante per il background delle impostazioni.
- La [guida 4](/it/android/sidebar/) mostra l'avviso del lucchetto nel blocco del menu laterale, e perché può restare nascosto.
- Dal lato della mod, [Avvisi sul telefono e sull'orologio](/it/mods/pet/phone-and-watch/) spiega la sigillatura passo per passo e dove vive la chiave sul tuo computer.
- [Narsil Watch](/it/watch/what-it-is/) legge lo stesso topic `-estado`.
- Il codice sorgente è su [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
