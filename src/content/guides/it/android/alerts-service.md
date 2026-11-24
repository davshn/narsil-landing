---
title: Avvisi da un servizio in primo piano
description: 'Come AlertService tiene aperta una connessione con ntfy.sh, recupera con since gli avvisi persi, e come Alert e Notifier trasformano ogni messaggio in una notifica sul canale giusto.'
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

## Cosa fa

Mentre scrivi a Claude Code tramite Remote Control, la mod di Narsil pubblica sul tuo topic di ntfy.sh quando una conversazione finisce, ha bisogno di te o fallisce. L'app mostra ognuno di questi avvisi come notifica, con Narsil al suo stadio attuale e nella posa dell'avviso:

| Avviso                  | Come arriva                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Una domanda o un errore | Sul canale **Te necesita** (ha bisogno di te): compare sopra ciò che stai facendo e vibra con un suo schema lungo. |
| Un turno finito         | Sul canale **Terminó** (ha finito): una vibrazione breve, e compare in silenzio nell'area delle notifiche.         |

- **Un tocco** apre Claude Code dentro l'app. Fino ad allora, ogni avviso resta nell'area delle notifiche.
- **I link dell'avviso** compaiono come pulsanti, due al massimo. Quelli di `claude.ai` si aprono nell'app, qualsiasi altro nel tuo browser. La mod ne invia uno, `Abrir Claude` (apri Claude).
- **L'app può essere chiusa.** Una connessione con ntfy.sh resta aperta in un servizio in primo piano, con una sua notifica silenziosa: "Narsil escucha tus avisos" (Narsil ascolta i tuoi avvisi), e sotto `Topic <il tuo topic> · toca para cambiarlo` (tocca per cambiarlo). Un tocco su di essa apre le impostazioni.
- **Dopo un riavvio** del telefono, o un aggiornamento dell'app, il servizio riparte da solo.
- **Gli avvisi persi arrivano tardi, non mai.** Se il telefono era spento o senza rete, gli avvisi inviati nel frattempo arrivano quando torna, finché ntfy.sh li conserva (12 ore, dice il codice).

Non ti serve più l'app ntfy.

> **Sperimentale.** L'app nel suo insieme si basa sulla struttura della pagina di `claude.ai` e sulle sue richieste interne, che un aggiornamento di Claude può rompere. Questa parte non tocca `claude.ai`, ma ha punti fragili suoi: dipende dal servizio pubblico gratuito di ntfy.sh e dal fatto che Android lasci a un'app una connessione aperta tutto il giorno. Alcuni produttori di telefoni chiudono comunque le app in background, e allora gli avvisi arrivano in ritardo o si fermano finché non apri l'app.

## Come funziona dentro

### Il percorso di un avviso

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

Ogni passo è un piccolo file con un solo compito. `NtfyStream` conosce ntfy.sh, `Alert` conosce le regole e non ha codice Android (così `AlertTest.kt` lo testa sul computer), e `Notifier` conosce le notifiche di Android.

### Un servizio in primo piano, e perché `specialUse`

Android ferma il lavoro in background che non riesce a vedere. Per tenere aperta una connessione per ore, un'app deve eseguire un **servizio in primo piano**: un servizio che mostra una notifica per tutto il tempo in cui gira, così sai sempre che c'è. Da Android 14, ogni servizio in primo piano dichiara anche un tipo che dice a cosa serve.

Il tipo ovvio, `dataSync`, non va bene: la decisione nel log dei task registra che "Android 15 caps `dataSync` at 6 h a day" (Android 15 limita `dataSync` a 6 ore al giorno). L'app dichiara invece `specialUse`, con il motivo che Android chiede nel manifest:

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

Questo estratto è da `AndroidManifest.xml` in narsil-android (MIT). La stessa decisione spiega cosa l'app non usa: "no Firebase, no ntfy app needed" (niente Firebase, non serve l'app ntfy). I servizi push come Firebase Cloud Messaging hanno bisogno di un server che invii loro i messaggi; qui l'unico server è ntfy.sh, e l'app lo ascolta direttamente.

Il servizio stesso è breve. Da `AlertService.kt` (MIT):

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

- **Niente topic, niente servizio.** Si ferma da solo e chiede di non essere riavviato.
- **Prima la notifica silenziosa.** `startForeground` va chiamato poco dopo l'avvio del servizio, altrimenti Android lo ferma. Il tipo entra solo su Android 14 (`UPSIDE_DOWN_CAKE`) e successivi, dove i tipi esistono.
- **Uno stream per topic.** Il servizio può essere avviato molte volte: all'apertura dell'app, da **Guardar y recibir avisos** nelle impostazioni, e dopo un riavvio. Se il topic è lo stesso e uno stream sta girando, non cambia niente. Se hai salvato un nuovo topic, il vecchio stream si ferma e ne parte uno nuovo.
- **`START_STICKY`** chiede ad Android di avviare di nuovo il servizio se mai deve chiuderlo.

La notifica silenziosa vive su un suo canale, **Conexión** (connessione), con l'importanza più bassa e senza badge, così sta in fondo all'area delle notifiche senza suono. Il suo testo include il tuo topic, cosa che conviene sapere se altri vedono il tuo schermo.

### `NtfyStream`: una connessione, tenuta aperta

ntfy.sh può inviare un topic come stream JSON: una risposta HTTP che non finisce mai, con un oggetto JSON per riga ([ntfy: subscribe API](https://docs.ntfy.sh/subscribe/api/)). Ogni riga di messaggio ha `"event": "message"`; ntfy.sh invia anche righe `open` e `keepalive`. `NtfyStream` legge quello stream su un thread tutto suo. La parte di lettura, da `NtfyStream.kt` (MIT):

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

I numeri hanno i loro motivi. Il commento della classe dice "ntfy.sh sends a keepalive every 45 s, so a read that waits 90 s found a dead connection" (ntfy.sh invia un keepalive ogni 45 s, quindi una lettura che aspetta 90 s ha trovato una connessione morta): un telefono che ha cambiato rete può tenere un socket che non consegnerà mai più niente, e il timeout di lettura di 90 secondi è il modo in cui l'app se ne accorge. Una riga che non è JSON viene saltata. Un messaggio che non si riesce a mostrare viene scritto nel log e non ferma lo stream. E dopo ogni messaggio, `since` si sposta sul suo id.

Intorno a `read()`, `follow()` lo tiene in moto:

- **Quando lo stream finisce normalmente** (l'ha chiuso ntfy.sh o un proxy), aspetta un secondo e legge di nuovo, da `since`.
- **Quando fallisce** (niente rete, un timeout, una risposta diversa da 200), aspetta un secondo, poi due, quattro e così via, fino a un minuto, e torna a un secondo dopo una lettura andata a buon fine.
- **`stop()`** azzera un flag, chiude la connessione aperta e interrompe il thread, così finisce subito anche nel mezzo di un'attesa.

Il thread è un thread daemon, quindi non tiene mai in vita da solo il processo dell'app; lo fa il servizio in primo piano.

### Recuperare con `since`

ntfy.sh conserva per un po' i messaggi di un topic (12 ore, dice il commento in `AlertService.kt`), e il suo parametro `since` chiede quelli successivi a un dato id di messaggio ([ntfy: subscribe API](https://docs.ntfy.sh/subscribe/api/)). L'app lo usa per riprendere da dove si era fermata:

1. Dopo ogni avviso che mostra, `AlertService.take` salva l'id del messaggio come `lastAlertId` nelle impostazioni.
2. Quando il servizio parte, dopo un riavvio per esempio, apre lo stream con `since=<lastAlertId>`.
3. ntfy.sh invia prima ciò che ha conservato dopo quell'id, poi continua in diretta.

Così un avviso inviato mentre il telefono era spento arriva quando si riaccende. Dal codice seguono tre limiti:

- **La prima volta non c'è niente da cui riprendere.** Senza un id salvato, `since` è `null` e lo stream parte "da adesso in poi". Gli avvisi inviati prima del tuo primo non vengono recuperati.
- **Un nuovo topic riparte da zero.** Salvare un topic diverso toglie `lastAlertId` (lo fa il setter), così non ti ritrovi un id che appartiene a un altro topic.
- **Dopo 12 ore, non ci sono più** su ntfy.sh, e quindi nemmeno nell'app.

Nel tag della notifica c'è una sicurezza silenziosa. Se Android chiude l'app tra il momento in cui mostra un avviso e quello in cui ne salva l'id, l'avviso arriva di nuovo all'avvio successivo, ma con lo stesso id di messaggio, e quindi lo stesso tag, così si sostituisce da solo invece di comparire due volte.

### `Alert.kt`: le regole

`Alert.of` trasforma un messaggio, già aperto se era sigillato, in ciò che mostra una notifica. Da `Alert.kt` (MIT):

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

| Regola    | Cosa fa il codice                                                                                                                                                     |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Urgente   | Priorità ntfy 4 o 5. La mod invia 4 per una domanda o un errore, 3 per un turno finito.                                                                               |
| Tag       | Un turno finito con un tag `conv-…` riceve `done-conv-…`, così il successivo di quella conversazione lo sostituisce. Qualsiasi altra cosa, il proprio id.             |
| Pulsanti  | Solo le azioni `view` di ntfy con un indirizzo, al massimo due, con l'etichetta `Abrir` (apri) quando non ne hanno una.                                               |
| Tocco     | L'indirizzo `click` del messaggio solo se è `claude.ai`; altrimenti `https://claude.ai/code`.                                                                         |
| Immagine  | Solo un `icon` che inizia con `https://raw.githubusercontent.com/davshn/narsil-pet/main/assets/`.                                                                     |
| Titolo    | Il titolo del messaggio, o `Narsil`.                                                                                                                                  |
| Sigillato | Quando la chiave non è riuscita ad aprirlo: "🔒 Aviso cifrado: pon la clave en los ajustes de la app." (avviso cifrato: metti la chiave nelle impostazioni dell'app). |

La regola dell'immagine ha un motivo in un commento: "Without a key anyone who knows the topic can publish on it: a picture only comes from Narsil's own assets." (senza una chiave chiunque conosca il topic può pubblicarci: un'immagine arriva solo dagli asset di Narsil.) Lo stesso vale per il tocco. Gli indirizzi dei pulsanti non vengono controllati oltre al fatto che ci siano: uno che non è `claude.ai` si apre in qualunque app lo gestisca, dopo che lo tocchi.

### Cosa invia la mod

Le regole qui sopra corrispondono a ciò che pubblica la mod. Da `hooks/phone.ts` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later):

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

`PRIORITY` vale 3 per `done` e 4 per `question` ed `error`. `TAGS` contiene un tag emoji per tipo (`white_check_mark`, `raising_hand`, `warning`). `phoneIcon` costruisce l'indirizzo dell'immagine dallo stadio di Narsil e dalla posa dell'avviso: le immagini della piccola appena nata stanno alla radice di `assets/`, ogni stadio successivo in una cartella `etapaN/`, e la posa è `terminado`, `necesita` o `error`, sempre nella variante scura (`-oscuro.png`). `OPEN_CLAUDE` è l'unico pulsante, `Abrir Claude`, verso `https://claude.ai/code`. Il corpo può finire con l'elenco delle conversazioni aperte e, al 200° messaggio del giorno, con `(último aviso de hoy: mañana sigo)` (ultimo avviso di oggi: domani continuo). [Avvisi sul telefono e sull'orologio](/it/mods/pet/phone-and-watch/) spiega quando invia la mod.

Nota cosa la mod non invia: un tag `conv-` o un indirizzo `click`. Quindi, con la mod di oggi, ogni turno finito è una notifica a sé, e ogni tocco apre `claude.ai/code`, dove Remote Control elenca le tue conversazioni.

### `Notifier.kt`: i canali e la notifica

Da Android 8, ogni notifica appartiene a un canale, e la persona decide per ogni canale se suona, vibra o compare. L'app ne crea tre. Da `Notifier.kt` (MIT):

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

`IMPORTANCE_HIGH` è ciò che fa comparire un avviso sopra ciò che stai facendo. I due schemi di vibrazione sono il "modo suo" in cui vibra ciascuno: `NEEDS_BUZZ` è `0, 300, 120, 300, 120, 600` (tre impulsi, l'ultimo lungo), `DONE_BUZZ` è `0, 200`. Una volta che un canale esiste, Android ti lascia cambiarne il suono e la vibrazione nelle impostazioni delle notifiche dell'app, e i valori dell'app sono solo il punto di partenza.

`show` costruisce ogni notifica:

- Esce subito se le notifiche dell'app sono disattivate (il commento: "the person may have turned notifications off", la persona può aver disattivato le notifiche).
- Titolo e corpo così come arrivano, con `BigTextStyle` così un corpo lungo si può espandere. Categoria `REMINDER` per quelle urgenti, `STATUS` per le altre, e `setAutoCancel(true)`, così un tocco la chiude.
- **Il tocco e i pulsanti** sono `PendingIntent` costruiti da `open`: un indirizzo di `claude.ai` diventa un intent esplicito verso `MainActivity`, qualsiasi altro un `ACTION_VIEW` per l'app che lo gestisce. Sono immutabili (`FLAG_IMMUTABLE`), così nessun'altra app può cambiare dove portano.
- **L'immagine** viene scaricata dall'indirizzo `icon` con timeout di connessione e di lettura di 5 secondi, e diventa l'icona grande. Se non arriva in tempo, la notifica parte senza. Questo gira sul thread dello stream, che può permettersi di aspettare.
- `manager.notify(alert.tag, 0, ...)`: il tag decide la sostituzione. Lo stesso tag sostituisce la notifica precedente; un tag nuovo ne aggiunge una.

Niente in `show` imposta un timeout o rende una notifica permanente, quindi ogni avviso, urgente o no, resta nell'area delle notifiche finché non lo tocchi (`setAutoCancel`) o lo scorri via. Ciò che distingue quelli urgenti è che il loro canale li fa comparire sopra ciò che stai facendo e vibrare con lo schema lungo.

### Il tocco, di nuovo nell'app

Quando tocchi un avviso, Android invia l'intent esplicito a `MainActivity` con l'indirizzo. L'activity è `singleTask`, quindi se è già aperta riceve l'indirizzo in `onNewIntent` e lo carica; altrimenti `onCreate` lo carica al posto della pagina predefinita. In entrambi i casi `claudeIn` accetta solo indirizzi di `claude.ai` ([guida 2](/it/android/webview-host/)).

### `BootReceiver`: dopo un riavvio o un aggiornamento

Un riavvio chiude tutti i servizi. L'app ascolta due broadcast, `BOOT_COMPLETED` e `MY_PACKAGE_REPLACED`, e con ciascuno chiama `AlertService.start`, che avvia il servizio solo se c'è un topic salvato. Il secondo scatta dopo che esegui di nuovo `./gradlew installDebug`, così un aggiornamento non ti lascia senza avvisi. Il primo ha bisogno del permesso `RECEIVE_BOOT_COMPLETED`, che il manifest chiede.

### La batteria: Doze e i telefoni aggressivi

La modalità Doze di Android taglia l'accesso alla rete alle app mentre il telefono dorme, e le sveglia solo in brevi finestre. Un servizio in primo piano aiuta, ma la connessione può comunque essere tagliata. La soluzione è un'esenzione dalle ottimizzazioni della batteria, che puoi concedere solo tu.

Lo fa il secondo pulsante della schermata delle impostazioni. Finché l'app non è esente (`PowerManager.isIgnoringBatteryOptimizations` dice di no), **Permitir en segundo plano** è attivo; un tocco apre la finestra di Android stessa (`ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`) per questa app. Una volta concessa, il pulsante diventa **Ya funciona en segundo plano** e si disattiva. Il codice zittisce l'avviso di lint `BatteryLife` per questa chiamata, che avverte che Google Play consente quella richiesta solo per alcuni tipi di app; questa app si installa dal codice sorgente.

Alcuni produttori di telefoni vanno oltre e chiudono da soli le app in background. Il README nomina Infinix, Xiaomi e Huawei. I test del log dei task sono girati su un Infinix X6730B con Android 15. Se gli avvisi smettono di arrivare, controlla **Permitir en segundo plano**, poi le impostazioni della batteria o di avvio delle app del telefono stesso per Narsil.

## Costruiscila con Claude

Chiedi a Claude il servizio e le regole separatamente: una funzione Kotlin pura che da un messaggio di ntfy ricavi ciò che mostra una notifica, testata sul computer, e un servizio in primo piano che segua un topic e le passi ogni messaggio. L'unica idea che deve fare bene è la ripresa: lo stream deve partire dall'ultimo messaggio mostrato, e il tocco e l'immagine li ricevono solo indirizzi che non possono fare danni.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nella mia app Android (Kotlin, `minSdk 29`, `targetSdk 36`), aggiungi un servizio in primo piano di tipo `specialUse` (con `PROPERTY_SPECIAL_USE_FGS_SUBTYPE` nel manifest) che segua `https://ntfy.sh/<topic>/json` su un thread daemon con `HttpURLConnection`, un timeout di connessione di 15 s e di lettura di 90 s, un oggetto JSON per riga, tenendo solo `event == "message"`. Riprendi con `?since=<id>` dall'ultimo messaggio mostrato, salvato in `SharedPreferences` dopo ognuno, e cancellato quando cambia il topic. Riconnettiti dopo un secondo quando lo stream finisce, e con un'attesa che raddoppia fino a 60 s dopo un errore. Metti le regole in una funzione pura `Alert.of(JSONObject)`: priorità 4 o più va su un canale ad alta importanza, un tag `conv-` su un avviso non urgente diventa il tag di sostituzione, al massimo due azioni `view` diventano pulsanti, il tocco apre l'indirizzo `click` solo quando è `https://claude.ai`, e un'icona grande viene accettata solo da un prefisso di URL fisso. Avvia di nuovo il servizio su `BOOT_COMPLETED` e `MY_PACKAGE_REPLACED`. Aggiungi un pulsante che chieda l'esenzione dall'ottimizzazione della batteria. Testa `Alert.of` con JUnit.

### Cosa controllare nella risposta di Claude

1. `startForeground` viene chiamato all'inizio di `onStartCommand`, con il tipo `specialUse` solo su Android 14 e successivi.
2. Lo stream riprende da un id salvato, e salvare un nuovo topic cancella quell'id.
3. Un timeout di lettura più lungo del keepalive di 45 secondi di ntfy.sh rileva una connessione morta.
4. Dopo gli errori l'attesa si allunga ogni volta, fino a un limite, e una lettura andata a buon fine azzera l'attesa.
5. L'indirizzo del tocco e l'immagine sono limitati; i pulsanti sono al massimo due.
6. Ogni notifica viene pubblicata con un tag, così un messaggio ripetuto sostituisce sé stesso.
7. I `PendingIntent` sono `FLAG_IMMUTABLE`.
8. Le regole non hanno codice Android, e i loro test girano con `./gradlew testDebugUnitTest`.

Se un controllo fallisce, di' a Claude cosa vedi: "dopo che il telefono è rimasto spento per un'ora, gli avvisi di quell'ora non sono mai arrivati".

### Come l'ha chiesta l'autore

Il primo messaggio del proprietario, registrato in `odd/tasks/android-app.md` come L1, chiedeva "una app movil completa, que reciba las notificaciones" (un'app mobile completa, che riceva le notifiche). Il resto delle regole di questa guida è dell'agente, registrato nella specifica e nel log, non parole del proprietario. La specifica S5 dice che gli avvisi "keep the PWA's rules" (mantengono le regole della PWA, la web app precedente): "sealed messages opened with the key (`narsil1:`), priority >= 4 stays until touched and buzzes its own way, a "done" replaces the previous one of its `conv-` tag, ntfy "view" actions as buttons, a tap opens Claude Code inside the app." (messaggi sigillati aperti con la chiave, `narsil1:`; priorità >= 4 resta finché non la tocchi e vibra a modo suo; un "done" sostituisce il precedente con il suo stesso tag `conv-`; le azioni "view" di ntfy come pulsanti; un tocco apre Claude Code dentro l'app.) La decisione sul tipo di servizio è citata sopra.

Il log registra due controlli sul telefono. Con un topic usa e getta: "two done alerts of conv-a left one notification (tag done-conv-a, importance 3) and a priority 4 one its own (importance 4); accents arrive intact; a tap opened MainActivity on claude.ai/code." (due avvisi done di conv-a hanno lasciato una sola notifica, tag done-conv-a, importanza 3, e uno di priorità 4 una sua, importanza 4; gli accenti arrivano intatti; un tocco ha aperto MainActivity su claude.ai/code.) E con il topic e la chiave reali, il 2026-11-24 alle 00:44: "The alert showed as an app notification on the urgent channel (importance 4)" (l'avviso è comparso come notifica dell'app sul canale urgente, importanza 4).

I commit (il nome di un progetto in un oggetto è sostituito da una descrizione tra parentesi quadre):

- `3bcea35` (2026-11-24) "feat: build the script that hosts [l'estensione precedente] in a WebView, and what alerts and states keep" (costruisce lo script che ospita l'estensione precedente in una WebView, e ciò che conservano avvisi e stati). `Alert.kt` e i suoi test.
- `53c55c1` (2026-11-24) "feat: host claude.ai with [l'estensione precedente] in a WebView, and show Narsil's alerts from a foreground service" (ospita claude.ai con l'estensione precedente in una WebView, e mostra gli avvisi di Narsil da un servizio in primo piano). Il suo messaggio: "alerts follow <topic> from the last one shown, also after a reboot." (gli avvisi seguono <topic> dall'ultimo mostrato, anche dopo un riavvio.)
- `9e514dd` (2026-11-24) "feat: open the settings from Narsil in the band and from the service's notification" (apre le impostazioni da Narsil nella banda e dalla notifica del servizio).
- `a275382` (2026-11-24) "docs: log the alerts and the band verified with the real topic and key" (registra gli avvisi e la banda verificati con il topic e la chiave reali).

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida (MIT). Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

Due test JUnit per `Alert.of` con messaggi nella forma di quelli della mod, con id e testo inventati. Mettili accanto a `AlertTest.kt`:

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

Il secondo test documenta il comportamento di oggi con la mod: niente tag `conv-`, quindi niente sostituzione. Per vedere la sostituzione stessa, pubblica due avvisi con un tag `conv-` su un topic inventato che hai messo nelle impostazioni ([ntfy: publishing](https://docs.ntfy.sh/publish/)):

```bash
curl -H "Tags: white_check_mark,conv-demo" -d "Primera" https://ntfy.sh/narsil-0000000000example0
curl -H "Tags: white_check_mark,conv-demo" -d "Segunda" https://ntfy.sh/narsil-0000000000example0
curl -H "Priority: 4" -H "Actions: view, Abrir Claude, https://claude.ai/code" -d "¿Sigo?" https://ntfy.sh/narsil-0000000000example0
```

Dovresti vedere una notifica **Terminó** che dice "Segunda", e una **Te necesita** che compare sopra lo schermo, vibra tre volte e ha un pulsante `Abrir Claude`.

## Errori comuni e come testarlo

- **Un servizio `dataSync`.** Su Android 15 viene fermato dopo sei ore al giorno. Dichiara il tipo adatto, con il suo motivo.
- **Far partire lo stream da adesso a ogni riavvio.** Gli avvisi inviati mentre il telefono era spento vanno persi. Riprendi dall'ultimo id.
- **Nessun timeout di lettura.** Una connessione morta con un cambio di rete aspetta per sempre. Scegline uno più lungo del keepalive.
- **Riprovare subito, all'infinito.** Senza un'attesa che cresce, un telefono senza rete gira a vuoto. Limitala a un minuto.
- **Fidarsi del topic.** Senza una chiave, chiunque ne conosca il nome può pubblicare un avviso. Limita il tocco, l'immagine e il numero di pulsanti.
- **Pubblicare senza un tag.** Usa come tag l'id del messaggio stesso, così un messaggio consegnato due volte sostituisce sé stesso.
- **Saltare l'esenzione dalla batteria.** Gli avvisi arrivano a raffiche quando il telefono si sveglia, con minuti di ritardo.
- **Aspettarsi la sostituzione con la mod di oggi.** La mod non invia nessun tag `conv-`, quindi i turni finiti si accumulano.

Per testare le regole, esegui `./gradlew testDebugUnitTest`: `AlertTest.kt` controlla che una domanda o un errore siano urgenti, che un done con un tag `conv-` sostituisca e uno senza no, il testo sigillato, il titolo predefinito, il limite di due pulsanti, la regola di `click` (un indirizzo su un altro sito ripiega su `claude.ai/code`) e la regola dell'immagine. Per testare il servizio, pubblica su un topic inventato come sopra, poi attiva la modalità aereo, pubblica due volte e disattivala: entrambi dovrebbero arrivare entro un minuto. `adb logcat -s NarsilNtfy` mostra gli errori dello stream e le sue attese ("ntfy.sh stream failed, again in 4 s", lo stream di ntfy.sh è fallito, di nuovo tra 4 s).

### Dove il codice e il README differiscono

- Il README dice che ogni turno finito "takes the place of the previous one of the same conversation" (prende il posto del precedente della stessa conversazione). L'app li sostituisce davvero quando un messaggio porta un tag `conv-`, come ha mostrato il test del log dei task con `conv-a`, ma `phoneMessage` di narsil-pet oggi non invia nessun tag del genere, solo `white_check_mark`, `raising_hand` o `warning`. Con la mod reale, ogni turno finito è una notifica a sé.
- Il README dice che gli avvisi persi mentre il telefono era spento arrivano "once it is back, as ntfy.sh keeps them for 12 hours" (quando torna, dato che ntfy.sh li conserva per 12 ore). È vero una volta che l'app ha mostrato almeno un avviso del topic. Prima di allora, e subito dopo un cambio di topic, non c'è un id salvato e lo stream parte dal momento in cui si connette.
- Il README dice che una domanda o un errore "stays until you touch it" (resta finché non lo tocchi), come se un turno finito no. Nel codice, nessuna notifica è permanente o a tempo: entrambi i tipi restano finché non li tocchi o li scorri via, e il canale urgente aggiunge la comparsa sopra lo schermo e la vibrazione lunga.
- Il commento della classe di `NtfyStream.kt` dice che segue lo stream "as the band's lib/stream.js follows it" (come lo segue lib/stream.js della banda). In questo repository non c'è nessun `lib/stream.js`; il commento si riferisce all'estensione precedente.

## Per andare oltre

- La [guida 7](/it/android/encryption-and-settings/) apre `Seal.unseal`, il primo passo di `take`, e spiega la schermata delle impostazioni e i suoi pulsanti.
- La [guida 3](/it/android/conversation-band/) riusa `NtfyStream` per `<topic>-estado`, da `since=12h`.
- Dal lato della mod, [Avvisi sul telefono e sull'orologio](/it/mods/pet/phone-and-watch/) spiega quando invia la mod, il limite giornaliero di 200 e il topic.
- [Narsil Watch](/it/watch/what-it-is/) mostra lo stato di Narsil su un orologio Wear OS, dallo stesso topic `-estado`.
- Il codice sorgente è su [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
