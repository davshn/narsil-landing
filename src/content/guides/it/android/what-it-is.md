---
title: Cos'è Narsil per Android
description: "Un'app Android sperimentale che ospita claude.ai in una WebView con i colori, la banda e il blocco nel menu laterale di Narsil, e trasforma in notifiche gli avvisi della mod da ntfy.sh."
route: android
order: 1
updated: 2026-11-24
sources:
  - repo: android
    path: README.md
  - repo: android
    path: odd/tasks/android-app.md
  - repo: android
    path: app/src/main/AndroidManifest.xml
  - repo: android
    path: app/build.gradle.kts
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/Links.kt
  - repo: pet
    path: hooks/register.tsx
---

## Cosa fa

Narsil per Android è un'app per il telefono che mette due cose nello stesso posto: la web app di Claude, `claude.ai`, e gli avvisi che la [mod di Narsil](/it/mods/pet/phone-and-watch/) invia al tuo telefono. La apri come qualsiasi app. Dentro vedi il vero `claude.ai`, con l'accesso fatto con il tuo account, così approvi i permessi, rispondi alle domande, carichi file e leggi le conversazioni intere come sempre. Sopra, Narsil aggiunge i suoi tocchi:

- **I colori di Narsil.** Claude veste la tavolozza del mare notturno di Narsil Skin, chiara dalle 6:00 alle 17:59 e scura nel resto della giornata, qualunque aspetto tu abbia scelto in Claude ([guida 5](/it/android/colors-and-mode/)).
- **La banda.** Appena sopra la casella in cui scrivi, una striscia mostra la conversazione aperta: Narsil nella posa del suo stato, lo stato (`TRABAJANDO` (al lavoro), `TE NECESITA` (ha bisogno di te), `TERMINADA` (finita) o `EN REPOSO` (a riposo)), il contesto usato, il conto alla rovescia della cache e l'ultima cosa che ha detto Claude ([guida 3](/it/android/conversation-band/)).
- **Il blocco nel menu laterale.** Sotto la ricerca nel menu laterale di Claude: il livello e l'esperienza di Narsil, i tuoi limiti di 5 ore e settimanali, e il conteggio ntfy.sh del giorno ([guida 4](/it/android/sidebar/)).
- **Avvisi.** Quando una conversazione finisce, ha bisogno di te o fallisce, arriva una notifica, anche con l'app chiusa e dopo un riavvio ([guida 6](/it/android/alerts-service/)).
- **Cifratura.** Con una chiave di `/narsil movil clave`, l'app apre ciò che la mod ha sigillato ([guida 7](/it/android/encryption-and-settings/)).
- **Accedi una volta sola.** La sessione resta finché Claude non la chiude o finché non cancelli i dati dell'app.
- **File e voce.** Il pulsante **+** di Claude apre il selettore di file del telefono, e il microfono funziona per la dettatura.

> **Sperimentale.** L'app si basa sulla struttura della pagina di `claude.ai` e sulle sue richieste interne, non su un'API pubblica. La banda trova la casella dei messaggi e il menu laterale dal markup della pagina, i colori sostituiscono le variabili di design della pagina stessa, e i limiti e i dati delle conversazioni arrivano da indirizzi che la pagina usa per sé. Un aggiornamento di Claude può rompere uno qualsiasi di questi pezzi; quando succede, quella parte smette di comparire, e Claude continua a funzionare. È anche un progetto personale, che si installa dal codice sorgente con una build di debug.

L'app è open source con licenza MIT, e non è affiliata ad Anthropic. La sua interfaccia e le parole di Narsil sono in spagnolo; questo percorso lascia le etichette come appaiono, con il loro significato in italiano tra parentesi.

## Come funziona dentro

### Perché un'app con una WebView

All'app nativa di Claude non puoi aggiungere niente: esegue il proprio codice e non offre modo di caricare il tuo. Su un computer, il modo abituale di cambiare una pagina web è un'estensione del browser, ma Chrome su Android non accetta estensioni. L'estensione del browser precedente, che disegnava Narsil in `claude.ai`, aveva quindi bisogno di un browser che le accettasse, cioè un'app in più da installare e in cui restare con l'accesso fatto.

Una WebView risolve entrambi i problemi. È il motore web integrato di Android, lo stesso Chromium su cui gira Chrome, incorporato nella finestra di un'app. L'app che possiede la WebView decide cosa ci gira dentro: qui carica `claude.ai`, esegue gli script e gli stili di Narsil all'inizio di ogni pagina, e risponde loro da Kotlin. Il primo messaggio del proprietario, registrato nel log dei task, chiedeva proprio questo: un'app mobile completa che riceva le notifiche e che, dentro una web view, mostri la web di Claude e ne cambi gli stili come faceva l'estensione.

Gli script che disegnano la banda, il blocco e i colori sono le stesse idee che aveva l'estensione, e gran parte del loro codice è la stessa: parlano ancora con un oggetto `browser`, come fanno gli script delle estensioni. L'app gliene dà uno, scritto in `host.js`, e risponde a ogni chiamata in modo nativo. La [guida 2](/it/android/webview-host/) spiega questo host.

### I pezzi

Tutto il codice dell'app sta in un solo modulo Gradle, `app`, con il package `io.github.davshn.narsil`:

| File                                                          | Cosa fa                                                                                                   |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `MainActivity.kt`                                             | La WebView: impostazioni, cookie, file, microfono, popup, e dove va ogni link.                            |
| `PageScript.kt` e `assets/host.js`                            | Costruisce l'unico script che gira all'inizio di ogni pagina di `claude.ai`, e il "browser" della pagina. |
| `assets/page/`                                                | I colori di Narsil (`skin.css`, `mode.js`) e la banda (`content.js`, `band.css`, `lib/`).                 |
| `StateFeed.kt` e `StateModel.kt`                              | Seguono `<il tuo topic>-estado` per la banda, e tengono lo stato più recente.                             |
| `AlertService.kt`, `NtfyStream.kt`, `Alert.kt`, `Notifier.kt` | Seguono il tuo topic in background e trasformano ogni messaggio in una notifica.                          |
| `BootReceiver.kt`                                             | Fa ripartire gli avvisi dopo un riavvio o un aggiornamento.                                               |
| `Seal.kt`                                                     | Apre ciò che la mod ha sigillato con `/narsil movil clave`.                                               |
| `Settings.kt` e `SettingsActivity.kt`                         | Il topic, la chiave e ciò che l'app ricorda, nello spazio di archiviazione privato.                       |
| `Links.kt`                                                    | Quali indirizzi restano nell'app.                                                                         |

Non c'è un server proprio, né Firebase, né analytics: il modulo dipende da tre librerie AndroidX (`core-ktx`, `webkit` e `activity`), e da JUnit e `org.json` per i test.

### Cosa le serve dalla mod di Narsil

L'app legge due topic su [ntfy.sh](https://ntfy.sh), entrambi creati dalla mod di Narsil in Claude Code sul tuo computer:

- **Il tuo topic**, come `narsil-0000000000example0`, dove la mod pubblica un avviso quando una conversazione finisce, ha bisogno di te o fallisce.
- **`<il tuo topic>-estado`** ("stato"), dove la mod pubblica uno stato silenzioso quando un turno finisce e con ogni domanda: il livello di Narsil, la sua immagine al suo stadio, quanto dura una cache e il conteggio di ntfy.sh dei messaggi del giorno.

La mod li invia entrambi solo mentre scrivi a Claude tramite Remote Control, cioè dal telefono o dal web. Appena scrivi di nuovo dalla scrivania, si ferma. Si limita anche a 200 messaggi al giorno, sotto la quota gratuita di ntfy.sh. [Avvisi sul telefono e sull'orologio](/it/mods/pet/phone-and-watch/) spiega per intero la parte della mod.

Senza la mod, l'app funziona comunque come Claude con i colori di Narsil, e la banda mostra comunque lo stato, il contesto, la cache e l'ultimo evento di ogni conversazione, e il blocco i tuoi limiti: questi arrivano da `claude.ai` stesso. Quello che perdi è ciò che sa solo il tuo computer: gli avvisi, il livello di Narsil, il suo stadio nelle immagini (al suo posto c'è l'icona dell'app), il conteggio di ntfy.sh e la durata reale della cache (la banda presume 60 minuti).

### Sistemi supportati

| Cosa                   | Serve                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| Android                | 10 o successivo (`minSdk = 29`); costruita per Android 16 (`targetSdk = 36`)                           |
| Android System WebView | Una che sappia eseguire script all'inizio di una pagina e parlare con l'app; va bene qualsiasi recente |
| Accesso                | L'email del tuo account Claude; i pulsanti di Google e di Apple qui non funzionano                     |
| iPhone                 | Non disponibile                                                                                        |
| Per costruirla         | Un computer con JDK 17 o successivo e l'Android SDK (`ANDROID_HOME`); Gradle arriva da solo            |

Il controllo della WebView è nel codice. `MainActivity` chiede a `WebViewFeature` due funzionalità, `WEB_MESSAGE_LISTENER` e `DOCUMENT_START_SCRIPT`. Se ne manca una, scrive nel log "This WebView cannot run the band: update Android System WebView" (questa WebView non può eseguire la banda: aggiorna Android System WebView) e carica Claude senza Narsil. La soluzione è aggiornare Android System WebView da Google Play.

### Installazione

Non è sullo store: costruisci l'app dal suo repository e la installi via USB.

1. Sul telefono, attiva le opzioni sviluppatore e il **debug USB**, poi collegalo al computer.
2. Sul computer, clona [narsil-android](https://github.com/davshn/narsil-android) e, nella sua cartella, esegui:

```bash
./gradlew installDebug
```

Gradle si scarica da solo (il wrapper è fissato a Gradle 9.9.2), costruisce un APK di debug e lo installa. Per aggiornare in seguito, fai pull del repository ed esegui di nuovo lo stesso comando: Android sostituisce l'app al suo posto e ne conserva i dati, quindi la sessione e le impostazioni restano.

Una build di debug ha una proprietà che dovresti conoscere: la sua pagina si può ispezionare da un computer su `chrome://inspect`, come spiega la [guida 2](/it/android/webview-host/). È comodo per imparare e per sistemare le cose, ed è anche un motivo per tenere spento il debug USB quando non ti serve.

### Accedere: con la tua email

Apri **Narsil** e accedi **con la tua email**: quella del tuo account Claude, anche se hai creato l'account con Google. Claude ti manda un codice o un link, e sei dentro.

I pulsanti di accesso di Google e di Apple non funzionano dentro la WebView di un'app. Entrambi i fornitori si rifiutano di girare lì, e aprirli nel browser del telefono non aiuterebbe: come dice `Links.kt`, "in the phone's browser they would sign the browser in, not the app" (nel browser del telefono farebbero accedere il browser, non l'app). Così, quando la pagina prova ad andare su `accounts.google.com` o `appleid.apple.com`, l'app non va da nessuna parte e mostra invece un messaggio:

> "Google y Apple no dejan iniciar sesión dentro de una app como esta. Escribe tu correo (el mismo de tu cuenta) y entra con el código o el enlace que te llega."

(Google e Apple non permettono di accedere dentro un'app come questa. Scrivi la tua email, la stessa del tuo account, ed entra con il codice o il link che ti arriva.)

Questo è nato da un guasto reale. Prima del commit `38cb33c`, il pulsante di Google apriva un popup che la WebView scartava, e l'accesso restava semplicemente appeso.

Se il link di accesso arriva per email, si apre nel tuo browser per impostazione predefinita. Perché i link di `claude.ai` si aprano nell'app, vai in **Impostazioni → App → Narsil → Apri per impostazione predefinita → Aggiungi link** di Android e attiva `claude.ai`. Il manifest spiega perché è un passo manuale: Android "cannot verify a domain that is not ours" (non può verificare un dominio che non è nostro).

### Prima configurazione

1. In Claude Code sul tuo computer, esegui `/narsil movil`. Attiva gli avvisi e risponde con il tuo topic.
2. Se vuoi gli avvisi cifrati, esegui anche `/narsil movil clave` ("chiave"). Risponde con una nuova chiave.
3. Nell'app, apri le impostazioni: tocca Narsil nel blocco del menu laterale (o l'avviso `Toca y escribe tu topic` (tocca e scrivi il tuo topic)), oppure tieni premuta l'icona dell'app e scegli **Ajustes** (impostazioni).
4. Scrivi il topic e, se ne hai creata una, la chiave, e tocca **Guardar y recibir avisos** (salva e ricevi gli avvisi). Consenti le notifiche quando Android lo chiede.
5. Tocca **Permitir en segundo plano** (consenti in background). Senza, Android taglia la connessione mentre il telefono dorme e gli avvisi arrivano in ritardo. Una volta consentito, il pulsante dice **Ya funciona en segundo plano** (funziona già in background).

Tornata su Claude, la banda mostra Narsil appena la mod ha inviato uno stato. Per controllare tutta la catena in una volta, esegui `/narsil movil prueba` ("prova") sul computer: invia un avviso di prova e uno stato, da dovunque tu stia scrivendo.

Le risposte della mod sono state scritte prima che esistesse questa app. `/narsil movil` ti dice ancora di installare l'app ntfy, e `/narsil movil clave` di mettere la chiave in "las opciones de la extensión de Firefox" (le opzioni dell'estensione di Firefox). Con questa app non ti serve né l'una né l'altra cosa: la chiave va nelle impostazioni dell'app.

### Il modello di privacy

L'app parla con quattro posti, ognuno per un motivo:

| Chi                                  | Parla con                                 | Perché                                                                                        |
| ------------------------------------ | ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| La WebView                           | `claude.ai` e `challenges.cloudflare.com` | Claude stesso, e il controllo di Cloudflare che può venire prima. Nient'altro si apre dentro. |
| Gli script della banda, nella pagina | `claude.ai`                               | Le stesse richieste `GET` che fa la pagina, con la tua sessione: conversazioni e limiti.      |
| La pagina e le notifiche             | `raw.githubusercontent.com`               | Le immagini di Narsil, solo dalla cartella `assets/` di narsil-pet.                           |
| Il codice Kotlin dell'app            | `ntfy.sh`                                 | Il tuo topic per gli avvisi, e `<il tuo topic>-estado` per la banda.                          |

Dal codice seguono tre regole:

- **Il topic e la chiave non arrivano mai alla pagina.** Vivono nello spazio di archiviazione privato dell'app, e solo Kotlin legge ntfy.sh. La pagina riceve lo stato già aperto, niente di più. `host.js` lo dice chiaramente: "the topic and the key never reach the page" (il topic e la chiave non arrivano mai alla pagina).
- **ntfy.sh è un servizio pubblico.** Senza una chiave, chiunque conosca il tuo topic può leggerlo e pubblicarci, e ntfy.sh vede tutto. Con una chiave, vedono che è partito un messaggio e qualche dettaglio, non il suo testo. La [guida 7](/it/android/encryption-and-settings/) passa in rassegna cosa resta nascosto e cosa no.
- **Niente di ntfy.sh viene trattato come markup.** Entra nella pagina e nelle notifiche come testo, e un'immagine è accettata solo dalla cartella di Narsil.

L'app imposta anche `android:allowBackup="false"`, così i suoi dati, sessione compresa, non finiscono nei backup di Android.

## Costruiscila con Claude

Chiedi prima a Claude lo scheletro: un progetto Gradle con un'activity che mostra `claude.ai` in una WebView, decide dove va ogni link, e ha una schermata di impostazioni per un topic. L'unica idea che deve fare bene è il confine: dentro l'app si apre `claude.ai` e nient'altro, e i segreti restano in Kotlin, mai nella pagina.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Crea un'app Android in Kotlin (Gradle Kotlin DSL, `minSdk 29`, JDK 17, senza Compose) la cui activity principale mostri `https://claude.ai/code` in una WebView a schermo intero con JavaScript e DOM storage attivi. Tieni dentro la WebView solo `https://claude.ai` e `https://challenges.cloudflare.com`; apri qualsiasi altro indirizzo `https` nel browser del telefono con `ACTION_VIEW`. Quando la pagina va su `accounts.google.com` o `appleid.apple.com`, non aprire niente e mostra un toast che dica di accedere con un'email. Gestisci i popup in `onCreateWindow` con una WebView usa e getta che legga solo l'indirizzo che vuole aprire. Fai il flush dei cookie in `onPause`. Aggiungi un'activity di impostazioni con un campo topic validato come `^[-_A-Za-z0-9]{1,64}$`, salvato in `SharedPreferences` private, e una scorciatoia del launcher che la apra. Metti le regole dei link in un oggetto Kotlin puro con test JUnit, compresi `http://claude.ai`, `https://claude.ai.evil.example/` e una stringa che non è un URL.

### Cosa controllare nella risposta di Claude

1. Gli host vengono confrontati esattamente dopo aver analizzato l'indirizzo, e solo per `https`: `https://claude.ai.evil.example/` e `http://claude.ai` non devono contare come Claude.
2. Gli indirizzi di accesso di Google e di Apple non aprono niente; mostrano un messaggio.
3. I popup non aprono una seconda finestra visibile: il loro primo indirizzo va dove va qualsiasi link.
4. `CookieManager.getInstance().flush()` viene chiamato in `onPause`, così la sessione sopravvive quando Android chiude l'app.
5. Il topic viene validato prima di essere salvato, e niente di segreto viene scritto nella pagina o nel codice.

Se un controllo fallisce, di' a Claude cosa vedi: "il pulsante di Google non fa niente e lo schermo resta bianco".

### Come l'ha chiesta l'autore

Questa è registrata. Il log dei task di narsil-android, `odd/tasks/android-app.md`, cita i messaggi del proprietario nelle sue voci di log da L1 a L3.

L'idea, il 2026-11-23 (L1):

> "se me ocurrio crear una app movil completa, que reciba las notificaciones y que dentro en un web view muestre la web de claude y modifique sus estilos como lo hace esta extension, eso es viable?"

In italiano: mi è venuto in mente di creare un'app mobile completa, che riceva le notifiche e che dentro una web view mostri la web di Claude e ne modifichi gli stili come fa questa estensione; è fattibile?

L'ambito, il 2026-11-24 (L2):

> "seria para reemplazar la pwa, la friccion que me dices para iniciar sesion seria igual solo una vez, no? ... (igual seria para mi uso personal)"

In italiano: servirebbe a sostituire la PWA (la web app precedente per gli avvisi); l'attrito di cui mi parli per accedere ci sarebbe comunque una volta sola, no? (Sarebbe comunque per il mio uso personale.) E nella stessa voce: "hazlo en un proyecto nuevo y probemos a ver que tal, el repositorio seria publico, te dejo conectado el celular para que la instales" (fallo in un progetto nuovo e proviamo a vedere come va; il repository sarebbe pubblico; ti lascio collegato il cellulare così la installi).

Da L3: "no olvides ir haciendo commits al repositorio a medida que vas trabajando el repo se va a llamar narsil-android" (non dimenticare di fare commit nel repository man mano che lavori; il repo si chiamerà narsil-android).

La specifica trasforma tutto questo in regole: S3 "login once and the session stays (cookies flushed to disk)" (accesso una volta sola e la sessione resta, con i cookie scritti su disco), e S4 "the repository is public and named `narsil-android`: no topic or key in the code; they are typed in the app's settings" (il repository è pubblico e si chiama `narsil-android`: niente topic né chiave nel codice; si scrivono nelle impostazioni dell'app). L'ultima voce del log, L4, registra la decisione del proprietario di ritirare l'estensione e la web app precedenti in favore di questa app ("[…] los voy a deprecar en favor de esta app", li deprecherò in favore di questa app), ed è per questo che gli script della banda sono diventati dell'app.

I commit, tutti del 2026-11-24, mostrano l'ordine della costruzione (il nome di un progetto in un oggetto è sostituito qui da una descrizione tra parentesi quadre):

- `9051a31` "feat: open what the mod seals, as [l'estensione precedente]'s seal.js does" (apre ciò che la mod sigilla, come fa il seal.js dell'estensione precedente)
- `3bcea35` "feat: build the script that hosts [l'estensione precedente] in a WebView, and what alerts and states keep" (costruisce lo script che ospita l'estensione precedente in una WebView, e ciò che conservano avvisi e stati)
- `53c55c1` "feat: host claude.ai with [l'estensione precedente] in a WebView, and show Narsil's alerts from a foreground service" (ospita claude.ai con l'estensione precedente in una WebView, e mostra gli avvisi di Narsil da un servizio in primo piano)
- `bfa379a` "fix: present the WebView as Chrome, and let a debug build's page be inspected" (presenta la WebView come Chrome, e permette di ispezionare la pagina di una build di debug)
- `38cb33c` "fix: say to sign in with an email when Google's or Apple's sign-in is asked for, instead of hanging" (dice di accedere con un'email quando viene chiesto l'accesso di Google o di Apple, invece di restare appesa)
- `9e514dd` "feat: open the settings from Narsil in the band and from the service's notification" (apre le impostazioni da Narsil nella banda e dalla notifica del servizio)
- `5ad4577` "refactor: make the band's scripts the app's own, and stop naming the projects it replaces" (rende gli script della banda propri dell'app, e smette di nominare i progetti che sostituisce)

## Codice di riferimento

Questo è `Links.kt` per intero, da `app/src/main/java/io/github/davshn/narsil/` in [narsil-android](https://github.com/davshn/narsil-android) (MIT). È breve, e ogni navigazione dell'app passa da lì: i link della WebView, i suoi popup, gli indirizzi che porta un avviso, e gli indirizzi che Android passa all'app.

```kotlin
package io.github.davshn.narsil

import java.net.URI

// Which addresses the app opens itself: claude.ai, and the Cloudflare check it may put before it. Everything else
// goes to the phone's browser, Google's sign-in among it, which refuses to run inside a WebView.
object Links {
    const val CLAUDE_CODE = "https://claude.ai/code"
    private val IN_APP = setOf("claude.ai", "challenges.cloudflare.com")

    private fun hostOf(url: String): String? = try {
        URI(url).takeIf { it.scheme == "https" }?.host?.lowercase()
    } catch (_: Exception) {
        null
    }

    fun isClaude(url: String?): Boolean = url != null && hostOf(url) == "claude.ai"

    fun isInApp(url: String?): Boolean = url != null && hostOf(url) in IN_APP

    // Google's and Apple's sign-ins, which refuse to run inside an app's WebView: in the phone's browser they would
    // sign the browser in, not the app, so the app says to sign in with an email instead.
    private val OUTSIDE_SIGN_IN = setOf("accounts.google.com", "appleid.apple.com")

    fun isOutsideSignIn(url: String?): Boolean = url != null && hostOf(url) in OUTSIDE_SIGN_IN
}
```

Tre dettagli lo rendono sicuro. `hostOf` restituisce `null` a meno che lo schema sia `https`, quindi un indirizzo `http` non è mai Claude. Confronta esattamente l'host analizzato, quindi `claude.ai.evil.example` non è `claude.ai`. E una stringa che non si può analizzare lancia un'eccezione dentro `URI`, che il `try` trasforma in `null`. `LinksTest.kt` li controlla tutti e tre.

Un piccolo test tutto tuo, scritto per questa guida (MIT), nello stesso stile di quelli dell'app:

```kotlin
package io.github.davshn.narsil

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MyLinksTest {
    @Test
    fun onlyClaudeAndTheCheckStayInside() {
        assertTrue(Links.isInApp("https://claude.ai/code/session_example"))
        assertTrue(Links.isInApp("https://CHALLENGES.cloudflare.com/x"))
        assertFalse(Links.isInApp("https://sub.claude.ai/"))
        assertFalse(Links.isInApp("claude.ai/code"))
    }
}
```

La seconda asserzione passa perché `hostOf` mette l'host in minuscolo. L'ultima regge perché un indirizzo senza schema non ha lo schema `https`, quindi per l'app non ha un host.

## Errori comuni e come testarlo

- **Toccare Continua con Google.** Qui non può funzionare. Usa l'email del tuo account, anche se l'hai creato con Google.
- **Nessun permesso in background.** Senza **Permitir en segundo plano**, gli avvisi possono arrivare con molti minuti di ritardo mentre il telefono dorme. Alcuni telefoni (il README nomina Infinix, Xiaomi e Huawei) hanno anche bisogno che il loro risparmio batteria lasci girare Narsil.
- **Aspettarsi avvisi alla scrivania.** La mod non invia niente mentre il tuo ultimo messaggio è arrivato dal terminale o dall'app desktop. Scrivi a Claude tramite Remote Control, oppure usa `/narsil movil prueba`.
- **Un topic copiato con uno spazio o un errore di battitura.** Le impostazioni rifiutano tutto ciò che non sia lettere, numeri, `-` e `_` con "Ese topic no es válido" (quel topic non è valido). Un topic valido ma sbagliato resta semplicemente muto: confrontalo con la risposta di `/narsil movil`.
- **Installare da un secondo computer.** Una build di debug è firmata con la chiave di debug del computer stesso, e Android rifiuta un aggiornamento firmato con un'altra chiave. Disinstallare per aggirare il problema cancella la sessione e le impostazioni.
- **Un Android System WebView vecchio.** Claude si carica, ma senza i colori né la banda. Aggiornalo da Google Play.

Per testare la logica dell'app, esegui i suoi test JVM sul computer:

```bash
./gradlew testDebugUnitTest
```

Coprono le regole dei link, lo script che carica la banda, le regole degli avvisi, lo stato che conserva la banda, e la cifratura contro un messaggio sigillato come lo sigilla la mod. Per testare tutta la catena senza toccare il tuo topic reale, metti nelle impostazioni un topic inventato come `narsil-0000000000example0` e pubblicaci dal computer ([ntfy: publishing](https://docs.ntfy.sh/publish/)):

```bash
curl -H "Title: Narsil prueba" -d "Hola desde el ordenador" https://ntfy.sh/narsil-0000000000example0
```

Dovrebbe arrivare una notifica entro un secondo o due. Poi rimetti il tuo topic reale.

### Dove il codice e il README differiscono

- Il README non indica nessun modo per fermare gli avvisi nell'app, e il codice non ne ha: `AlertService.stop` esiste ma niente lo chiama, e le impostazioni rifiutano un topic vuoto. Per fermarli, esegui `/narsil movil off` sul computer, oppure disattiva le notifiche dell'app nelle impostazioni di Android.
- Il README dice che non ti serve più l'app ntfy. Per l'app è vero; la risposta di `/narsil movil` della mod ti dice ancora di installarla (vedi Prima configurazione).

## Per andare oltre

- La [guida 2](/it/android/webview-host/) apre l'host della WebView: come vengono messi insieme gli script e come la pagina parla con l'app.
- La [guida 6](/it/android/alerts-service/) segue un avviso da ntfy.sh fino all'area delle notifiche.
- La [guida 7](/it/android/encryption-and-settings/) spiega la chiave, le impostazioni, e cosa può ancora vedere chi legge il tuo topic.
- La parte della mod è in [Avvisi sul telefono e sull'orologio](/it/mods/pet/phone-and-watch/). Lo stesso stato `-estado` alimenta anche [Narsil Watch](/it/watch/what-it-is/).
- Il codice sorgente è su [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
