---
title: Avvisi sul telefono e sull'orologio
description: 'Come /narsil movil invia ciò che ha bisogno di te a un topic privato di ntfy.sh se scrivi da fuori: limite giornaliero, topic di stato silenzioso, chiave opzionale che sigilla il contenuto e Web Push.'
route: pet
order: 15
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/phone.ts
  - repo: pet
    path: hooks/seal.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Cosa fa

Quando lavori lontano dal computer, guidando Claude Code tramite Remote Control dal telefono o dal web, la fascia e la finestra mobile sono fuori dalla tua vista. `/narsil movil` ("cellulare") invia invece al tuo telefono ciò che ha bisogno di te: una conversazione che ha finito, ha bisogno di te o è fallita. Anche un orologio che rispecchia le notifiche del telefono le mostra; il README di Narsil nomina Wear OS.

Gli avvisi viaggiano tramite [ntfy.sh](https://ntfy.sh), un servizio di notifiche pubblico. Il comando crea un topic con un nome casuale, come `narsil-0000000000example0` (ogni nome di topic in questa guida è un esempio inventato). Installi l'app ntfy, ti iscrivi a quel topic, e gli avvisi arrivano come notifiche con l'immagine di Narsil al suo stadio, nella posa dell'avviso, e un pulsante che apre l'app Claude.

Narsil invia solo mentre il tuo ultimo messaggio, in qualsiasi conversazione, è arrivato da Remote Control. Nel momento in cui scrivi di nuovo dalla scrivania, in una qualsiasi di esse, si ferma. Così il telefono la sente solo quando sei davvero altrove.

> **Attenzione: chiunque conosca il nome del topic può leggerlo, e può pubblicarci.** I topic di ntfy.sh, così come li usa Narsil, non hanno password: il nome è l'unica cosa che li mantiene privati. Non condividerlo, non incollarlo negli screenshot, ed esegui `/narsil movil nuevo` per passare a uno nuovo se trapela. Usa la chiave (`/narsil movil clave`) se il tuo ricevitore la supporta: con essa, il titolo e il testo di ogni avviso diventano "Narsil" e un testo illeggibile per chiunque non abbia la chiave, anche se il tipo di avviso, la sua ora e lo stadio di Narsil restano visibili.

I comandi:

| Comando                   | Cosa fa                                                                   |
| ------------------------- | ------------------------------------------------------------------------- |
| `/narsil movil` o `on`    | Attiva gli avvisi (creando il topic la prima volta) e dice come seguirlo. |
| `/narsil movil off`       | Li disattiva; `on` li riattiva con lo stesso topic.                       |
| `/narsil movil nuevo`     | Crea un nuovo topic; quello vecchio non riceve più niente.                |
| `/narsil movil prueba`    | Invia un avviso di prova, anche dalla scrivania.                          |
| `/narsil movil clave`     | Crea una chiave e sigilla tutto ciò che viene inviato da quel momento.    |
| `/narsil movil clave off` | Smette di sigillare.                                                      |

## Come funziona dentro

`hooks/phone.ts` contiene le parti semplici (il topic, il messaggio, il conteggio) come funzioni pure; `hooks/seal.ts` contiene la sigillatura; `hooks/register.tsx` invia e conta.

### Il topic: `narsil-` e 20 caratteri esadecimali

`newTopic(crypto.randomUUID())` in `hooks/phone.ts` prende un UUID casuale, tiene solo i suoi caratteri esadecimali, li mette in minuscolo e tiene i primi 20: `narsil-` seguito da 20 caratteri tra `0-9a-f`. Il commento sopra enuncia l'intero modello di sicurezza del topic: "A topic nobody guesses: whoever knows its name can read it." (un topic che nessuno indovina: chi conosce il suo nome può leggerlo.)

Il topic viene salvato nelle preferenze (`phoneTopic` in `prefs`, salvato con `$.store`), così ogni conversazione usa lo stesso. `/narsil movil nuevo` lo sostituisce con uno nuovo.

Da esso dipendono, per nome, altri due topic:

- `<topic>-estado` ("stato"): uno stato silenzioso per l'estensione di Firefox (vedi sotto).
- `<topic>-push`: dove una web app per telefono lascia la sua iscrizione Web Push (vedi sotto).

### Quando parte un avviso: dove hai scritto per ultimo

La regola viene dalla richiesta dell'autore nel log dei task (citata sotto): avvisa il telefono quando hai chiesto dal telefono. Nessun evento dice a una mod che Remote Control è attivo, quindi Narsil guarda da dove arrivano i tuoi messaggi.

I tipi della 2.1.325 danno a `prompt.submit` e `command.run` un `origin`, un `PromptOrigin`. Due dei suoi tipi contano qui: `composer`, "The user's own gesture at the terminal" (il gesto dell'utente stesso al terminale), e `bridge`, "The user's message through the Remote Control bridge (a phone or web client)" (il messaggio dell'utente tramite il bridge di Remote Control, un client telefono o web). `noteOrigin` in `hooks/register.tsx`, chiamata da entrambi gli hook, registra l'ultimo:

- `bridge` significa lontano; `composer` significa alla scrivania; qualsiasi altro tipo non cambia niente.
- Viene scritto in `$.store` sotto `remoteOrigin`, non solo in una variabile di modulo. Lo store è condiviso da tutte le conversazioni del plugin, quindi anche una conversazione che hai iniziato alla scrivania avvisa mentre scrivi dal telefono in un'altra, e nessuna lo fa più una volta che scrivi alla scrivania in una qualsiasi.

`isAway` lo rilegge, ripiegando sulla variabile di modulo quando lo store fallisce.

### Cosa porta un avviso

Ogni avviso passa per `announce` (guida 6), che finisce chiamando `sendToPhone`. `phoneMessage` in `hooks/phone.ts` costruisce il JSON che ntfy.sh accetta:

- `topic`: il tuo topic.
- `title`: "Narsil · He terminado · api" ("Narsil · Ho finito · api"), con il nome della conversazione per ultimo.
- `message`: il testo, poi, quando è aperta più di una conversazione, un elenco come "Conversaciones:" ("conversazioni:") seguito da "● web · ERROR" e "● api · TRABAJANDO" ("● api · AL LAVORO"). Il testo del telefono per un turno finito è più lungo di quello del desktop, dato che un telefono ha spazio per una parte maggiore della risposta di Claude.
- `priority`: 3 per una fine, 4 per una domanda o un errore.
- `tags`: `white_check_mark`, `raising_hand` o `warning`, che l'app ntfy mostra come un'emoji.
- `icon`: la sua immagine come PNG al suo stadio e nella posa dell'avviso, dal repository su GitHub, che il telefono scarica da sé.
- `actions`: un pulsante "Abrir Claude" ("apri Claude") verso `https://claude.ai/code`. Il commento spiega che niente su un telefono porta alla conversazione stessa, quindi il pulsante apre l'app Claude, dove Remote Control la elenca.

`postToPhone` lo invia con `$.http.fetch` come `POST` a `https://ntfy.sh` con un corpo JSON. La modalità discreta si applica come ovunque: una fine non viene inviata, una domanda o un errore sì.

### Il limite giornaliero: 200

`PHONE_DAILY` vale 200. Il commento del codice: "ntfy.sh takes 250 a day for free: Narsil stops short of it." (ntfy.sh ne accetta 250 al giorno gratis: Narsil si ferma prima.) Il README dice lo stesso.

Il conteggio vive in `$.store` sotto `phone`, come `{ day, sent }`, condiviso da tutte le conversazioni. `day` viene da `dayOf`, la data UTC ("2026-10-31"), quindi il conteggio riparte a mezzanotte UTC, non a mezzanotte locale. Un conteggio salvato di un altro giorno, o un valore strano, conta come zero.

Prima di ogni messaggio, `postToPhone` controlla il conteggio e si ferma a 200. Il 200° messaggio, quando è un avviso, finisce con "(último aviso de hoy: mañana sigo)" ("ultimo avviso di oggi: domani continuo"). Un messaggio che non riesce a partire non viene contato. I messaggi sul topic `-estado` contano sugli stessi 200.

### Il topic `-estado` e i suoi campi

Dopo ogni turno della conversazione principale, e con ogni domanda, `sendStatus` pubblica un piccolo stato su `<topic>-estado`, con le stesse regole degli avvisi (avvisi attivi, tu altrove, il conteggio giornaliero). Anche `/narsil movil prueba` ne invia uno. Parte con `priority: 1`, e il commento del codice dice che questo topic è "not followed by push, so its messages never show as notifications" (non seguito tramite push, quindi i suoi messaggi non compaiono mai come notifiche).

Il README dice che lo legge l'estensione di Firefox dell'autore (`narsil-claude`), "because they are data only the PC knows" (perché sono dati che conosce solo il PC). Il messaggio è un testo JSON con questi campi:

| Campo          | Cos'è                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| `xp`           | L'etichetta di livello di Narsil, "⭐ Nivel 3 · 120/300 XP" (guida 13).                              |
| `art`          | L'URL della sua immagine, al suo stadio, nella posa della conversazione aperta più importante.       |
| `at`           | Quando è stato inviato, in secondi Unix.                                                             |
| `cacheMinutes` | Quanto dura la cache del prompt, dalla prima conversazione aperta che ne ha una; assente altrimenti. |
| `usage`        | Una riga, `ntfy`, con il conteggio proprio di ntfy.sh dei messaggi di oggi dalla tua rete, o vuota.  |

Per `usage`, Narsil chiede `GET https://ntfy.sh/v1/account` e costruisce la riga con `ntfyRow`: `{ key: 'ntfy', label: 'ntfy hoy', percent, color, note, resetsAt }`, contando il messaggio che sta per partire. Il commento spiega perché questo conteggio differisce da quello di Narsil: ntfy.sh conta per indirizzo IP, "in a day of its own that starts at an hour hashed from the IP, not at midnight" (in un giorno tutto suo che inizia a un'ora ricavata dall'hash dell'IP, non a mezzanotte).

### La chiave opzionale, e come viene sigillato il contenuto

`/narsil movil clave` ("chiave") crea una chiave con `newKey()`: 32 byte casuali da `crypto.getRandomValues`, scritti in base64url (43 caratteri). Viene salvata nelle preferenze (`phoneKey`) e mostrata nella risposta del comando, così puoi incollarla nelle opzioni del ricevitore. Da quel momento, tutto ciò che Narsil pubblica su ntfy.sh, avvisi e `-estado` allo stesso modo, viene sigillato.

Cosa viene sigillato e cosa no, da `sealedMessage` e `sealedPayload` in `hooks/phone.ts`:

- **Sigillati:** il titolo e il testo, insieme come JSON dentro `message`.
- **In chiaro:** il topic, `title` sostituito solo da "Narsil", la priorità, i tag, l'URL dell'icona e il pulsante.

Quindi un avviso sigillato mostra comunque che un avviso c'è stato, quando, il suo tipo (tramite la priorità, il tag e la posa nel nome del file dell'icona) e lo stadio di Narsil (tramite la cartella dell'icona). Il nome della conversazione, la risposta di Claude e l'elenco delle conversazioni sono dentro.

Lo schema, esattamente come lo implementa `hooks/seal.ts`. Il commento del file spiega perché è costruito a mano: "The hooks module's crypto has SHA-256 alone" (il crypto del modulo degli hook ha solo SHA-256). I tipi della 2.1.325 concordano: il `crypto.subtle` del modulo degli hook dichiara `digest` e nient'altro. Quindi:

1. **HMAC-SHA256 da `digest`.** `hmac(key, data)` è la costruzione da manuale su SHA-256: la chiave riempita fino a 64 byte (prima sottoposta ad hash se più lunga), poi `SHA-256((key ⊕ 0x5c) ‖ SHA-256((key ⊕ 0x36) ‖ data))`.
2. **Due chiavi da una.** Dalla chiave di 32 byte, `encKey = HMAC(key, "enc")` e `macKey = HMAC(key, "mac")`.
3. **Un nonce nuovo.** 16 byte casuali per ogni messaggio.
4. **Il keystream.** Il blocco `i` è `HMAC(encKey, nonce ‖ i)`, con `i` su 4 byte, big-endian; ogni blocco dà 32 byte, messi in XOR con il testo UTF-8. Il commento la chiama modalità contatore (CTR).
5. **Il tag.** `HMAC(macKey, nonce ‖ ciphertext)`, 32 byte, sui byte cifrati (il commento la chiama "encrypt-then-MAC").
6. **Il testo inviato.** `narsil1:` seguito dal base64url di `nonce ‖ ciphertext ‖ tag`.

`unseal` lo inverte: controlla il prefisso `narsil1:` e una lunghezza minima, ricalcola il tag e lo confronta byte per byte, e solo allora decifra. Una chiave sbagliata, un byte modificato o un testo non sigillato danno `null`. Il test "what the mod seals, it opens; with another key, or tampered, it does not" (ciò che la mod sigilla, lo apre; con un'altra chiave, o manomesso, no) verifica questi tre casi. Il commento dice che i ricevitori lo aprono con l'HMAC di WebCrypto, "which gives the same bytes" (che dà gli stessi byte); quei ricevitori sono progetti separati, non in questo repository.

Questa guida descrive ciò che fa il codice e non afferma niente oltre. Se lo adatti, rivedilo come faresti con qualsiasi crittografia costruita a mano.

L'app ntfy non può aprire i messaggi sigillati: mostra il rumore. Narsil lo dice quando attivi la chiave, e `/narsil movil clave off` torna al testo in chiaro. Eseguire di nuovo `/narsil movil clave` crea una nuova chiave.

### Web Push: tenere iscritta una web app per telefono

Oltre all'app ntfy, gli avvisi possono arrivare a una tua web app tramite Web Push; il README nomina [narsil-pwa](https://github.com/davshn/narsil-pwa) dell'autore. ntfy.sh può consegnare un topic tramite Web Push all'iscrizione di un browser, ma, come dice il commento del codice, "ntfy.sh drops a subscription whose delivery failed once" (ntfy.sh scarta un'iscrizione la cui consegna è fallita una volta). L'app potrebbe registrarsi di nuovo quando la apri, ma allora gli avvisi aspetterebbero che tu la apra.

Così la mod la registra di nuovo prima di ogni avviso (`renewPush`, chiamata solo per gli avvisi, non per `-estado`):

1. L'app lascia la sua iscrizione, `{ endpoint, auth, p256dh }`, su `<topic>-push`, sigillata con la chiave quando ce n'è una.
2. `latestPush` legge l'ultimo messaggio lì, `GET https://ntfy.sh/<topic>-push/json?poll=1&since=latest`. Con una chiave, lo apre con `unseal`; senza, lo legge così com'è.
3. `pushSubscriptionOf` accetta solo un endpoint `https` di al massimo 1.000 caratteri e due chiavi base64url corte; tutto il resto viene ignorato.
4. Una valida viene conservata in `$.store` sotto `phonePush`. Quando ntfy.sh ha dimenticato il messaggio (il commento dice che conserva un messaggio 12 ore), si usa quella conservata.
5. Viene pubblicata su `https://ntfy.sh/v1/webpush` con `topics: [your topic]`.

Registrare non pubblica niente, quindi non conta sui 200. Qualsiasi fallimento viene ignorato, e l'avviso parte come sarebbe partito.

Dal codice seguono due note sulla privacy. L'iscrizione stessa va a ntfy.sh in chiaro, come richiede Web Push. E senza una chiave, chiunque conosca il topic può lasciare un'iscrizione su `<topic>-push`, e la mod la registrerà per il tuo topic; con una chiave, la mod accetta solo un'iscrizione che si apre con essa.

### Il modello di privacy in parole semplici

- **ntfy.sh vede tutto ciò che non è sigillato**, e l'ora e la rete di ogni messaggio. È un servizio di terzi: leggi le sue condizioni prima di inviarci qualsiasi cosa.
- **Il nome del topic è la password.** Chi lo ha può leggere ogni messaggio e pubblicarne di falsi. Un nome casuale lo rende difficile da indovinare, non segreto una volta condiviso.
- **Senza una chiave**, chi legge il topic vede i nomi delle conversazioni, il testo di ogni avviso (parte della risposta di Claude) e l'elenco delle conversazioni aperte.
- **Con una chiave**, chi legge vede che un avviso c'è stato, il suo tipo, la sua ora e lo stadio di Narsil, ma non il testo. Un messaggio falsificato non si apre con la chiave, e un ricevitore che controlla il tag può rifiutarlo.
- **La chiave vive in due posti**: nello store del plugin, un file JSON sotto la directory di configurazione di Claude Code, e nella risposta di `/narsil movil clave`, che fa parte della conversazione. Le risposte ai comandi di Narsil non impostano `isTextDisplayOnly`, e i tipi della 2.1.325 dicono che, a parte i plugin inclusi in Claude Code, "Any other plugin's text stays in requests" (il testo di qualsiasi altro plugin resta nelle richieste), quindi anche il modello la legge. Considera che la conversazione contenga la chiave.
- **L'invio si ferma alla scrivania.** Niente parte mentre il tuo ultimo messaggio è arrivato dal terminale o dall'app desktop, tranne la prova.

## Come è stata chiesta all’IA

### Registrato: avvisa il telefono quando scrivo dal telefono

La regola del telefono, così come funziona oggi, è stata chiesta nel log dei task della vista delle conversazioni, `odd/tasks/fleet-view.md`. L1 (2026-11-06), la richiesta originale, include:

> "las notificaciones se enviarian al celular cuando se pida algo desde el celular como ahora y haya cambios, es decir alguna tarea pase de trabajando a terminado, o de trabajando a error, etc, [...] las notificaciones del celular cuando se envien llevarian la info de todas las sesiones funcionando en ese momento"

In italiano: le notifiche verrebbero inviate al cellulare quando si chiede qualcosa dal cellulare, come adesso, e ci sono cambiamenti, cioè qualche task passa da al lavoro a finito, o da al lavoro a errore, ecc.; le notifiche del cellulare, quando vengono inviate, porterebbero le informazioni di tutte le sessioni in funzione in quel momento.

In L2, rispondendo alla domanda se anche una conversazione iniziata alla scrivania debba avvisare mentre l'autore scrive dal telefono in un'altra:

> "si claro me avisas al movil"

In italiano: sì, certo, mi avvisi sul cellulare.

Il log dei task registra il risultato in L9 (T4 completato): "Where you last wrote (phone or desk), in any conversation, is kept in the store (`remoteOrigin`), so every conversation alerts the phone on its changes (done, waiting, error) while your last message came from the phone, and none does once you write at the desk anywhere. Each alert ends with "Conversaciones:" and one line per open conversation" (dove hai scritto per ultimo, telefono o scrivania, in qualsiasi conversazione, viene conservato nello store, `remoteOrigin`, così ogni conversazione avvisa il telefono dei suoi cambiamenti, finito, in attesa, errore, mentre il tuo ultimo messaggio è arrivato dal telefono, e nessuna lo fa più una volta che scrivi alla scrivania in una qualsiasi. Ogni avviso finisce con "Conversaciones:" e una riga per ogni conversazione aperta). È ciò che fanno oggi `noteOrigin`, `isAway` e `fleetText`.

L9 descrive anche uno stato `-estado` più ricco, con un elenco `sessions` e i campi della conversazione più importante. Quello stato è stato poi ridotto: `544ef89` (2026-11-09) "feat: send only what the Firefox extension reads through ntfy" (invia tramite ntfy solo ciò che legge l'estensione di Firefox) ha lasciato i cinque campi visti sopra. Il codice e il README concordano sui cinque.

### Ricostruzione dalla cronologia dei commit

I passi precedenti non sono stati registrati. Da `git log -- hooks/phone.ts hooks/seal.ts` e dai commit collegati:

- `d91997f` (2026-10-31) "feat: send what needs you to your phone and watch through ntfy, with Narsil's picture" (invia ciò che ha bisogno di te al telefono e all'orologio tramite ntfy, con l'immagine di Narsil). Il topic, gli avvisi, l'icona e il limite di 200 arrivano insieme.
- `c27a9e4` (2026-10-31) "feat: send phone alerts only while you write through Remote Control" (invia avvisi al telefono solo mentre scrivi tramite Remote Control). La regola di dove hai scritto per ultimo.
- `4f8abaa` (2026-11-01) "feat: send the state the band shows to a status topic for your own phone app" (invia lo stato che mostra la fascia a un topic di stato per la tua app del telefono). Il topic `-estado`.
- `5a9ee10` (2026-11-01) "feat: seal phone messages with /narsil movil clave, send reset times and an Abrir Claude button" (sigilla i messaggi al telefono con /narsil movil clave, invia gli orari di azzeramento e un pulsante Abrir Claude). Nasce `hooks/seal.ts`.
- `644e59f` (2026-11-01) "fix: send the state to the phone with each question, so the app shows Narsil waiting" (invia lo stato al telefono con ogni domanda, così l'app mostra Narsil in attesa).
- `7498be5` (2026-11-02) "feat: register the phone app's push subscription again before each alert, so alerts keep coming after ntfy.sh drops it" (registra di nuovo l'iscrizione push dell'app del telefono prima di ogni avviso, così gli avvisi continuano ad arrivare dopo che ntfy.sh la scarta).
- `3a1f31c` (2026-11-06) "feat: alert the phone for every conversation and list them all" (avvisa il telefono per ogni conversazione e le elenca tutte). La richiesta citata sopra.
- `544ef89` (2026-11-09) "feat: send only what the Firefox extension reads through ntfy" (invia tramite ntfy solo ciò che legge l'estensione di Firefox). Il suo messaggio: "The phone web app is gone" (la web app per telefono non c'è più), e il rinnovo Web Push se n'è andato con lei.
- `5fe48c9` (2026-11-10) "feat: register the phone app's push subscription again before each alert" (registra di nuovo l'iscrizione push dell'app del telefono prima di ogni avviso). Il suo messaggio: "The phone web app is back as the alert receiver, in Chrome" (la web app per telefono torna come ricevitore degli avvisi, in Chrome), e il rinnovo è tornato, ora con il ripiego delle 12 ore.

La cronologia mostra una funzionalità modellata dai suoi ricevitori: ogni volta che l'app dall'altra parte cambiava, il lato della mod cambiava con lei.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è il prompt dell'autore.

> Nella mia mod di Claude Code `my-pet`, aggiungi avvisi sul telefono tramite ntfy.sh. `/my-pet phone` crea un topic `my-pet-` più 20 caratteri esadecimali da `crypto.randomUUID()`, lo salva in `$.store`, e risponde come iscriversi nell'app ntfy, avvertendo che chiunque conosca il topic può leggerlo. Registra dove la persona ha scritto per ultimo: in `prompt.submit` e `command.run`, `e.origin.kind === 'bridge'` significa lontano e `'composer'` significa alla scrivania; tienilo in `$.store` così ogni conversazione lo condivide. Quando un turno della conversazione principale finisce, e solo mentre la persona è lontana, pubblica `{ topic, title, message, priority }` come JSON su `https://ntfy.sh` con `$.http.fetch`. Conta i messaggi per giorno UTC in `$.store` e fermati a 200. Non mettere mai il topic nei log. Testa con `claude-code/testing`, rispondendo tu stesso a `http.fetch`: niente viene inviato dalla scrivania, un avviso viene inviato dal bridge, e il 201° del giorno no.

## Il codice minimo

Scritto per questa guida e verificato con i tipi della 2.1.325 (`$.store.get`, `$.store.set`, `$.http.fetch`, `$.clock.now`, `$.command.register`, `command.run`, `prompt.submit`, `turn.complete`, `crypto.randomUUID`). È adattato da `hooks/phone.ts` e `hooks/register.tsx` in [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). Invia testo in chiaro; per la sigillatura, leggi `hooks/seal.ts`.

```tsx
import type { EngineInterface, Register } from 'claude-code'

const NTFY = 'https://ntfy.sh'
const DAILY = 200

async function isAway($: EngineInterface): Promise<boolean> {
  return (await $.store.get('away').catch(() => false)) === true
}

async function noteOrigin($: EngineInterface, kind: string): Promise<void> {
  if (kind === 'bridge' || kind === 'composer')
    await $.store.set('away', kind === 'bridge').catch(() => undefined)
}

async function sendToPhone($: EngineInterface, title: string, message: string): Promise<void> {
  const topic = await $.store.get('topic').catch(() => undefined)
  if (typeof topic !== 'string' || !(await isAway($))) return
  const day = new Date(await $.clock.now()).toISOString().slice(0, 10)
  const saved = (await $.store.get('sent').catch(() => undefined)) as
    { day?: string; sent?: number } | undefined
  const sent = saved?.day === day && typeof saved.sent === 'number' ? saved.sent : 0
  if (sent >= DAILY) return
  try {
    const { ok } = await $.http.fetch(NTFY, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic, title, message, priority: 3 }),
    })
    if (ok) await $.store.set('sent', { day, sent: sent + 1 })
  } catch {
    // offline: the alert is lost, and nothing else breaks
  }
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'my-pet', description: 'My pet: phone' })
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await noteOrigin($, e.origin.kind)
    return next(e)
  })

  on('command.run', { command: 'my-pet' }, async ($, e) => {
    await noteOrigin($, e.origin.kind)
    if (e.args.trim() !== 'phone') return { text: 'Usage: /my-pet phone' }
    let topic = await $.store.get('topic').catch(() => undefined)
    if (typeof topic !== 'string') {
      topic = `my-pet-${crypto
        .randomUUID()
        .replace(/[^0-9a-f]/gi, '')
        .toLowerCase()
        .slice(0, 20)}`
      await $.store.set('topic', topic)
    }
    return {
      text: `Subscribe to ${topic} on ntfy.sh in the ntfy app. Anyone who knows this name can read it: do not share it.`,
    }
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined && e.reason === 'answer')
      await sendToPhone($, 'My pet · Done', e.answer.slice(0, 300))
    return result
  })
}
```

La risposta del comando mostra il topic una volta, di proposito, così la persona può iscriversi; ricorda che questa risposta resta nella conversazione. Narsil fa lo stesso.

## Errori comuni e come testarlo

- **Un topic indovinabile.** Un topic che porta il tuo nome o quello del tuo progetto può essere letto da chiunque lo provi. Usa un nome casuale.
- **Scrivere nei log il topic o la chiave.** Sono entrambi segreti. Tienili fuori da `$.ui.log`, dagli screenshot, dalle issue e dalle fixture di test che pubblichi.
- **Avvisare alla scrivania.** Senza la regola dell'origine, il telefono vibra mentre stai davanti allo schermo. Remote Control non è un evento; l'origine dell'ultimo messaggio è il segnale.
- **Tenere l'origine solo in una variabile di modulo.** Ogni conversazione deciderebbe allora da sola, e una conversazione iniziata alla scrivania non avviserebbe mai mentre scrivi dal telefono in un'altra.
- **Nessun limite giornaliero.** Un ciclo di turni che falliscono può esaurire un piano gratuito in pochi minuti. Conta prima di inviare, per giorno, su tutte le conversazioni.
- **Credere che "cifrato" significhi "invisibile".** La sigillatura di Narsil nasconde il titolo e il testo, non il fatto, l'ora, il tipo e l'icona di un avviso.
- **Crittografia costruita a mano senza test.** Sigillare, aprire, chiave sbagliata e un byte invertito sono il minimo, come fa il test di Narsil.

Per testare, `tests/narsil.test.tsx` risponde da sé a `http.fetch`, così niente arriva a ntfy.sh. Da leggere: "the phone gets nothing until /narsil movil is turned on" (il telefono non riceve niente finché /narsil movil non viene attivato), "/narsil movil makes a private topic, says how to follow it, and sends what needs you there" (/narsil movil crea un topic privato, dice come seguirlo, e ci invia ciò che ha bisogno di te), "the phone gets alerts only while you write through Remote Control, never at the desk" (il telefono riceve avvisi solo mentre scrivi tramite Remote Control, mai alla scrivania), "while you write from the phone in another conversation this one alerts too, and a message at the desk anywhere stops it" (mentre scrivi dal telefono in un'altra conversazione anche questa avvisa, e un messaggio alla scrivania in qualsiasi punto lo ferma), "the phone gets at most 200 a day, says which is the last, and starts again the next day" (il telefono ne riceve al massimo 200 al giorno, dice qual è l'ultimo, e ricomincia il giorno dopo), "/narsil movil clave seals what goes to ntfy.sh; clave off sends it in the clear again" (/narsil movil clave sigilla ciò che va a ntfy.sh; clave off lo invia di nuovo in chiaro), "as a turn ends from the phone, the extension gets only what it reads on the status topic, silently" (quando un turno finisce dal telefono, l'estensione riceve solo ciò che legge sul topic di stato, in silenzio) e "the state the extension reads does not register the subscription; only alerts do" (lo stato che legge l'estensione non registra l'iscrizione; lo fanno solo gli avvisi).

### Dove il codice e il README differiscono

- Il README dice che la chiave la tengono solo "tu PC y la extensión" (il tuo PC e l'estensione). Il commento in `hooks/seal.ts` dice "the PC, the Firefox extension and the phone app" (il PC, l'estensione di Firefox e l'app del telefono), e la sezione Web Push del README sigilla l'iscrizione dell'app con la chiave. Il codice fa ciò che dice il commento.
- Il README dice che lo stato `-estado` parte "Al terminar cada turno" (alla fine di ogni turno). Il codice lo invia anche con ogni domanda, e con la prova.

## Per andare oltre

- `fleetText` in `hooks/phone.ts` costruisce l'elenco delle conversazioni sotto ogni avviso.
- `ntfyRow` trasforma la risposta dell'account di ntfy.sh nello stesso tipo di riga d'uso che la fascia disegna per i limiti dell'account (guida 7).
- `summary` in `hooks/words.ts` taglia la risposta di Claude per l'avviso, con più spazio per il telefono (`PHONE_ROOM`).
- La guida successiva, il riassunto della sessione, è un'altra cosa che Narsil conta e conserva in `$.store`.
