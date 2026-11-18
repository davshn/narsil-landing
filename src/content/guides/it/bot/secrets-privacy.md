---
title: Segreti e privacy
description: 'Ogni segreto che il bot custodisce e dove vive, cosa proteggono la NVS e la cifratura della flash, cosa esce dalla tua rete e verso chi, e come cancellare il bot e revocare ogni credenziale.'
route: bot
order: 12
updated: 2026-11-18
---

## Cosa fa

Il bot è un microfono sulla tua scrivania con dentro il tuo token di GitHub, quindi merita una guida che metta l'intero quadro in un solo posto. Questa risponde a tre domande:

- **Quali segreti custodisce il bot, e dove?** Sette, su due macchine, e nessuno nel repository.
- **Cosa esce dalla tua rete?** La tua voce va a un'azienda, le tue parole a un'altra, le risposte di Narsil a una terza, e due servizi vedono la pancia connettersi.
- **Come riprendi tutto indietro?** Come cancellare la pancia, e come revocare ogni credenziale alla sua fonte.

Qui non c'è codice nuovo. Raccoglie ciò che le guide da 3 a 11 hanno impostato, e aggiunge le opzioni che offre ESP-IDF per proteggere ciò che è salvato sulla scheda.

## Come funziona dentro

### I segreti, e dove vive ciascuno

| Segreto                        | Vive in                                                         | Impostato da                           | Dà accesso a                              |
| ------------------------------ | --------------------------------------------------------------- | -------------------------------------- | ----------------------------------------- |
| Nome e password del Wi-Fi      | NVS della pancia, namespace `wifi`, chiavi `ssid` e `password`  | Portale Wi-Fi (guida 3)                | La tua rete di casa                       |
| URL OTA (indirizzo del server) | NVS della pancia, `wifi/ota_url`                                | Portale Wi-Fi, scheda Advanced         | Dove la pancia invia la tua voce          |
| URL e token WebSocket          | NVS della pancia, namespace `websocket`, chiavi `url` e `token` | La risposta OTA del tuo server         | Parlare con il tuo server                 |
| Topic ntfy                     | NVS della pancia, namespace `narsil`, chiave `ntfy_topic`       | Schermata delle impostazioni (guida 9) | Leggere (e scrivere) gli avvisi di Narsil |
| Token di GitHub                | NVS della pancia, namespace `narsil`, chiave `gh_token`         | Schermata delle impostazioni (guida 9) | Leggere le pull request che puoi vedere   |
| Chiave API di Anthropic        | Il tuo PC: `ANTHROPIC_API_KEY` o `data/.config.yaml`            | Tu (guida 5)                           | Spendere sul tuo account Anthropic        |
| Chiave API di OpenAI           | Il tuo PC: `data/.config.yaml`, blocco `OpenaiASR`              | Tu (guida 4)                           | Spendere sul tuo account OpenAI           |

I namespace vengono dal codice: `ssid_manager.cc` di esp-wifi-connect apre `"wifi"` e legge `ssid`, `password` e le loro copie numerate (fino a dieci reti); `main/ota.cc` di Xiaozhi salva le impostazioni WebSocket con `Settings settings("websocket", true)`; le guide da 7 a 9 usano `narsil`.

In quella tabella vale la pena notare tre cose:

- **Le due chiavi API, quelle che costano denaro, non toccano mai il bot.** La pancia parla solo con il tuo server sulla LAN; le chiavi le custodisce il server. Un bot rubato non può far salire una bolletta di Anthropic o di OpenAI.
- **La testa non custodisce niente.** Il suo firmware ha l'arte di Narsil e il codice UART. Chiunque può leggerne la flash e non imparare niente (la guida 10 spiega perché è stata tenuta così).
- **Il repository non contiene niente.** Nessun topic, token, chiave o indirizzo compare in `davshn/narsil-bot`. Il firmware è pubblico, ed è per questo.

### Perché la NVS, e cosa protegge la NVS

La NVS (non-volatile storage) è l'archivio chiave-valore di ESP-IDF in una partizione della flash; la classe `Settings` di Xiaozhi (`main/settings.h`) è un sottile involucro sopra di essa. Per la pancia la partizione si chiama `nvs` nelle tabelle delle partizioni di Xiaozhi (`partitions/v2/32m.csv` le dà 840 KB).

Per impostazione predefinita, la NVS **non è cifrata**. `CONFIG_NVS_ENCRYPTION` di ESP-IDF è attiva per impostazione predefinita solo quando la cifratura della flash è abilitata, e Xiaozhi non la abilita. Quindi chiunque abbia la scheda in mano e un cavo USB può leggere la flash con esptool e trovarci dentro la password del Wi-Fi, il topic e il token in chiaro. Per un bot che sta sulla tua scrivania, è un rischio accettabile per la maggior parte delle persone, purché tu lo sappia e sappia come revocare le cose (più sotto). Se il bot viaggia, sta in un ufficio o esce dalle tue mani, esistono le opzioni che seguono.

### La cifratura della NVS sull'ESP32-P4

La [pagina sulla cifratura della NVS](https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/api-reference/storage/nvs_encryption.html) di ESP-IDF descrive due schemi per questo chip. Entrambi usano XTS-AES, e l'aiuto di Kconfig dice che cifra "the complete NVS data, except the page headers" (tutti i dati della NVS, tranne gli header delle pagine).

| Schema                             | Dove vivono le chiavi                                                                    | Richiede la cifratura della flash | Costo                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------- |
| Basato sulla cifratura della flash | Una partizione `nvs_keys` (data, sottotipo `nvs_keys`, segnata `encrypted`, almeno 4 KB) | Sì                                | Tutto ciò che costa la cifratura della flash (sezione successiva)   |
| Basato sulla periferica HMAC       | Derivate a runtime da una chiave HMAC in eFuse; mai salvate nella flash                  | No                                | Brucia per sempre un blocco di chiavi eFuse, con lo scopo `HMAC_UP` |

Le opzioni sono `CONFIG_NVS_ENCRYPTION`, e `CONFIG_NVS_SEC_KEY_PROTECTION_SCHEME` per scegliere tra `CONFIG_NVS_SEC_KEY_PROTECT_USING_FLASH_ENC` e `CONFIG_NVS_SEC_KEY_PROTECT_USING_HMAC`. Per HMAC, `CONFIG_NVS_SEC_HMAC_EFUSE_KEY_ID` deve indicare il blocco eFuse (da 0 a 5; il valore predefinito, -1, non compila). Con la cifratura attiva, `nvs_flash_init()` configura la partizione predefinita cifrata e ne genera le chiavi, quindi il codice di Xiaozhi non cambia.

Lo schema HMAC è il più leggero: la pagina dice che abilita "secure storage on ESP32-P4 without enabling flash encryption" (un archivio sicuro sull'ESP32-P4 senza abilitare la cifratura della flash). Protegge da chi legge il chip della flash. Da solo, non impedisce a chi può flashare un nuovo firmware sulla scheda di eseguire codice che usa la stessa chiave eFuse; a questo serve il secure boot.

### La cifratura della flash, e i suoi compromessi

La [cifratura della flash](https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/security/flash-encryption.html) cifra il firmware e i dati nella flash, così che "physical readout of flash will not be sufficient to recover most flash contents" (la lettura fisica della flash non basterà a recuperare la maggior parte del suo contenuto). Si attiva con `CONFIG_SECURE_FLASH_ENC_ENABLED` ed esiste in due modalità:

- **La modalità Development** (quella predefinita) ti lascia ancora flashare un nuovo firmware in chiaro via USB; il bootloader lo cifra. Si può disattivare di nuovo, ma solo una volta per chip.
- **La modalità Release** impedisce al bootloader USB le operazioni di cifratura della flash; il nuovo firmware arriva solo via OTA. Scegliere Release in menuconfig non brucia da solo gli eFuse; lo fa `esp_flash_encryption_set_release_mode()`.

La stessa pagina è chiara sui suoi limiti: la cifratura della flash "alone may not prevent an attacker from modifying the firmware of the device" (da sola potrebbe non impedire a un attaccante di modificare il firmware del dispositivo), non nasconde la disposizione della flash e raccomanda il secure boot insieme a essa. E cambia il modo di lavorare: un'immagine in chiaro flashata per errore su una scheda cifrata la manda in soft-brick, in un ciclo di riavvii. Per un bot amatoriale che viene riflashato ogni sera, è un costo reale.

Il bot non ne usa nessuna delle due. Tiene fuori dalla scheda i segreti che contano di più (le chiavi API), usa un token di GitHub di sola lettura e con scadenza, e tratta il contenuto della scheda come revocabile. Cifrare la NVS con HMAC è il passo da fare se la scheda lascia la tua scrivania.

### Cosa esce dalla tua rete

| Cosa                                           | Va a                            | Perché                                        |
| ---------------------------------------------- | ------------------------------- | --------------------------------------------- |
| La tua voce, come audio                        | OpenAI (`api.openai.com`)       | `OpenaiASR` la trasforma in testo (guida 4)   |
| Ciò che hai detto, come testo, e la cronologia | Anthropic (`api.anthropic.com`) | Claude scrive la risposta di Narsil (guida 5) |
| Le risposte di Narsil, come testo              | Microsoft                       | `EdgeTTS` le trasforma in voce (guida 6)      |
| Un'iscrizione ai tuoi topic ntfy               | ntfy.sh                         | Gli avvisi di Narsil (guida 7)                |
| Il tuo token di GitHub e una query di ricerca  | GitHub (`api.github.com`)       | Le tue pull request (guida 8)                 |

Conviene essere precisi sulla voce. La wake word viene riconosciuta sulla pancia stessa, con ESP-SR, quindi niente viene trasmesso prima che tu dica "Hi ESP". Dopo, la pancia trasmette ciò che sentono i microfoni al tuo server, sulla LAN. Il server non tiene quell'audio in casa: con `OpenaiASR`, ogni cosa che dici viene inviata **come audio** all'endpoint di trascrizione di OpenAI (`base_url: https://api.openai.com/v1/audio/transcriptions` in `config.yaml`), e il testo torna indietro. La guida 4 elenca l'alternativa offline: `VoskASR`, che gira sul PC con un modello scaricato, tiene l'audio sulla tua rete, a un certo costo in precisione.

Ogni provider tratta quei dati secondo i propri termini per l'uso dell'API; leggi [quelli di Anthropic](https://www.anthropic.com/legal/commercial-terms) e quelli di OpenAI prima di decidere. EdgeTTS non richiede un account, il che significa anche che nessun tuo accordo copre ciò che riceve.

ntfy.sh vede l'indirizzo IP della pancia e il nome dei topic che segue. Senza chiave, vede anche il testo di ogni avviso; con `/narsil movil clave`, vede solo il tipo, l'ora e lo stadio (guida 7). GitHub vede il token, la query e la risposta, tramite HTTPS.

### Cosa resta sulla tua rete

- L'audio tra la pancia e il tuo server, tramite WebSocket sulla LAN. È `ws://` in chiaro, non TLS, quindi è privato quanto lo è la tua rete: tieni il bot sul Wi-Fi di casa, non su uno condiviso.
- La UART tra pancia e testa, tre fili dentro il bot.
- Il controllo OTA, che va all'indirizzo del tuo server. Qui conta un dettaglio: se l'URL OTA salvato non è valido, Xiaozhi ripiega su `CONFIG_OTA_URL`, il servizio ufficiale su `api.tenclass.net` (guida 3). Il monitor dice "Ignoring invalid saved OTA URL; using the default" quando succede; se lo vedi, correggi l'URL.

### Cancellare il bot

Tre livelli, dal più leggero al completo:

- **Solo i segreti di Narsil.** Un pulsante "Forget" nella schermata delle impostazioni della guida 9 che chiama `Settings("narsil", true).EraseAll()` cancella il topic e il token, e nient'altro.
- **Tutto sulla pancia.** Da Windows, con la pancia sulla sua porta USB (guida 2):

  ```powershell
  esptool --port COM5 erase-flash
  ```

  Questo cancella l'intera flash: firmware, NVS, password del Wi-Fi, indirizzo del server, topic e token. Poi flasha di nuovo il firmware (guida 3); la pancia si avvia allora nella configurazione del Wi-Fi come una nuova. L'equivalente da ESP-IDF è `idf.py erase-flash`.

- **La testa.** Non custodisce segreti, quindi non c'è niente da cancellare. Lo stesso `erase-flash` sulla sua porta rimuove il firmware se regali la scheda.

### Revocare ogni credenziale

Cancellare la scheda protegge la scheda. Revocare la credenziale protegge te anche quando la scheda non c'è più. Se il bot viene perso o rubato, o la flash è stata letta, fai tutte queste cose, iniziando dal token:

| Credenziale        | Come revocarla                                                                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Token di GitHub    | [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens), **Delete** accanto al token (guida 8).        |
| Topic ntfy         | `/narsil movil nuevo` in Claude Code crea un nuovo topic; quello vecchio smette di ricevere. Scrivi quello nuovo sulla pancia.                  |
| Password del Wi-Fi | Cambiala sul router. Ogni dispositivo ha bisogno di quella nuova, ed è per questo che viene dopo le altre.                                      |
| Chiave Anthropic   | Eliminala nella [Claude Console](https://platform.claude.com/settings/keys) (guida 5). Non è mai stata sul bot; ruotala se era coinvolto il PC. |
| Chiave OpenAI      | Eliminala nella pagina delle chiavi API di OpenAI. Stessa regola: vive sul PC.                                                                  |

## Come è stata chiesta all’IA

La regola dietro questa guida è venuta dalla decisione su dove vive il firmware. L'IA ha chiesto se il codice del bot dovesse andare in un repository suo, e chi ha creato Narsil ha risposto:

> repo propio como fork

In italiano: "repository proprio, come fork".

Poi l'IA ha chiesto se quel repository sarebbe stato pubblico fin dall'inizio o privato, e chi ha creato Narsil ha scelto la prima opzione:

> 1

Un repository pubblico cambia tutto per i segreti: qualsiasi cosa venga committata viene pubblicata. Così l'IA ha fissato la regola scritta come specifica S6, per cui il token di GitHub, il topic ntfy, la chiave e l'indirizzo del server vivono nella NVS o nella configurazione locale, mai nel repository, e ogni guida da allora l'ha seguita.

Dove viene elaborata la voce era stato deciso prima, con la stessa conseguenza per le chiavi API:

> servidor propio

In italiano: "server proprio". E dove gira:

> en el pc, igual la idea es usarlo para trabajar con claude

In italiano: "sul PC; tanto l'idea è usarlo per lavorare con Claude".

Ecco perché le chiavi a pagamento restano sul PC. Quale riconoscitore usare è stata una scelta dell'IA, dalla documentazione del server; ha scelto `OpenaiASR` perché il riconoscitore offline predefinito non supporta lo spagnolo, e questa guida è dove quella scelta viene spiegata come audio che esce dalla rete.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è la conversazione usata per preparare il bot.

> Il mio bot da scrivania è un ESP32-P4 che esegue un fork di 78/xiaozhi-esp32 e parla con xinnan-tech/xiaozhi-esp32-server sul mio PC con OpenaiASR, un provider Claude ed EdgeTTS, più ntfy.sh e la REST API di GitHub dalla scheda. Elenca ogni segreto che custodisce e dove (leggi `main/settings.h`, `main/ota.cc` e `ssid_manager.cc` di esp-wifi-connect per i namespace della NVS), tutto ciò che esce dalla mia rete e verso chi, e cosa resta sulla LAN. Poi spiega gli schemi di cifratura della NVS di ESP-IDF 6 per l'ESP32-P4 e la cifratura della flash, citando la loro documentazione, con i compromessi per un dispositivo amatoriale che riflasho spesso. Concludi con come cancellare la scheda e revocare ogni credenziale.

## Il codice minimo

Il bot non ha bisogno di codice nuovo per questa guida. L'unico pezzo opzionale è il pulsante "Forget", aggiunto alla schermata delle impostazioni della guida 9 accanto a "Back":

```cpp
static void OnForget(lv_event_t*) {
    {
        Settings settings("narsil", true);
        settings.EraseAll();
    }
    esp_restart();
}
```

```cpp
Button(settings_screen, "Forget topic and token", OnForget);
```

`EraseAll` fa parte della classe `Settings` di Xiaozhi; cancella ogni chiave nel namespace `narsil`, e il distruttore ne fa il commit prima del riavvio.

Se scegli di cifrare la NVS con lo schema HMAC, la modifica è di configurazione, non di codice. In `idf.py menuconfig`, abilita `CONFIG_NVS_ENCRYPTION`, scegli `CONFIG_NVS_SEC_KEY_PROTECT_USING_HMAC` e imposta `CONFIG_NVS_SEC_HMAC_EFUSE_KEY_ID` su un blocco eFuse libero. Leggi prima la pagina sulla cifratura della NVS: il blocco eFuse viene usato per sempre, e la NVS scritta prima della modifica non è leggibile dopo, quindi cancella la flash e configura di nuovo il bot.

## Errori comuni e come testarlo

- **Un segreto in un commit.** Prima di ogni push sul repository pubblico, cerca nel diff `github_pat_`, `narsil-`, `sk-ant-` e il tuo indirizzo LAN. Un token vero in un file di test è una fuga; usa valori inventati come `github_pat_EXAMPLE_not_a_real_token`.
- **Segreti nel log.** Non stampare mai il token, il topic o la password del Wi-Fi, nemmeno durante il debug: un log del monitor incollato in una issue li pubblica.
- **`sdkconfig` con le tue impostazioni.** Se metti l'indirizzo del server in `CONFIG_OTA_URL` invece che nel portale, finisce in `sdkconfig`, e da lì in un commit. La guida 3 lo salva sul dispositivo per questo motivo.
- **Revocare una sola cosa.** Un bot perso contiene il token, il topic e la password del Wi-Fi. Revocali tutti e tre.

Per testare cosa contiene la scheda, rileggi la sua NVS e guarda. Con la pancia su COM5, `esptool --port COM5 read-flash 0 ALL belly.bin` copia la flash in un file; cerca il tuo topic nel file. Con la NVS non cifrata è lì in chiaro; con lo schema HMAC no. Elimina `belly.bin` dopo: contiene i tuoi segreti.

Per testare cosa esce dalla rete, guarda il log del tuo server (guida 4) mentre parli: il testo riconosciuto compare dopo ogni frase, che è il momento in cui l'audio è andato a OpenAI. Spegni internet sul PC e parla di nuovo: la pancia si connette ancora al server sulla LAN, ma il riconoscimento fallisce, il che mostra che l'audio non aveva nessun posto locale dove andare.

## Per andare oltre

- **Riconoscimento offline.** `VoskASR` nel server tiene la tua voce sulla tua rete; controlla il suo modello per lo spagnolo e confronta la precisione con `OpenaiASR`.
- **Un server ntfy tuo.** Eseguire ntfy in casa con controllo degli accessi toglie il topic da internet pubblico. narsil-pet pubblica su `https://ntfy.sh`, quindi entrambi i lati cambierebbero (guida 7).
- Di nuovo all'inizio del percorso: le parti e i collegamenti sono nella [guida 1](/it/bot/the-bot/).
