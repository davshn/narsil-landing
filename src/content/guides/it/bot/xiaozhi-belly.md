---
title: Xiaozhi nella pancia
description: "Cos'è Xiaozhi, come gira sulla scheda Waveshare ESP32-P4, come si punta la pancia al tuo server invece che a xiaozhi.me e cosa succede al primo avvio."
route: bot
order: 3
updated: 2026-11-18
---

## Cosa fa

Xiaozhi ([78/xiaozhi-esp32](https://github.com/78/xiaozhi-esp32), MIT) è un firmware open source che trasforma una scheda ESP32 in un assistente vocale. È ciò che dà alla pancia le orecchie e la voce: ascolta una wake word, invia in streaming a un server ciò che dici e riproduce la risposta.

Dal suo README, le parti che usa il bot:

- **Una pipeline vocale.** L'audio viene compresso con Opus e inviato in streaming a un server, che esegue il riconoscimento vocale, un modello linguistico e la sintesi vocale, e rimanda in streaming la risposta parlata.
- **Due trasporti**: [WebSocket](https://github.com/78/xiaozhi-esp32/blob/main/docs/websocket.md), oppure [MQTT più UDP](https://github.com/78/xiaozhi-esp32/blob/main/docs/mqtt-udp.md). Il bot usa WebSocket.
- **Wake word offline** con ESP-SR di Espressif, così la scheda inizia lo streaming solo dopo aver sentito la sua wake word.
- **MCP lato dispositivo**: il firmware espone dei "tool" (il README cita il controllo di altoparlante, LED, servo e GPIO) che il modello linguistico sul server può scoprire e chiamare.
- **Provisioning del Wi-Fi** tramite un hotspot o BluFi, così nessuna password del Wi-Fi viene compilata nel firmware.
- **Un livello di visualizzazione** per schermi LCD, con espressioni e testo della chat.

Xiaozhi supporta la pancia del bot così com'è. Per impostazione predefinita parla con il servizio ufficiale su xiaozhi.me; il bot parla invece con un server sul tuo PC (guida 4).

## Come funziona dentro

### La cartella della scheda

Ogni scheda supportata da Xiaozhi ha una cartella sotto `main/boards/`. Quella della pancia è `main/boards/waveshare/esp32-p4-wifi6-touch-lcd/`, condivisa da tutta la famiglia ESP32-P4-WIFI6-Touch-LCD (4B, 4.3, 5, 7B, 3.4C, 4C, 7, 8 e 10.1 pollici). Contiene:

- `esp32-p4-wifi6-touch-lcd.cc`: la classe della scheda, `WaveshareEsp32p4`, costruita sul `WifiBoard` di Xiaozhi. Avvia lo schermo, il pannello touch GT911 e il codec audio.
- `config.h`: i pin e le dimensioni. Per la scheda da 4,3 pollici imposta uno schermo 480 × 800 su 2 lane MIPI DSI a 500 Mbps, audio a 24.000 Hz in ingresso e in uscita, ES8311 ed ES7210 su I2C (GPIO7 e GPIO8), I2S da GPIO9 a GPIO13 e il pulsante BOOT su GPIO35.
- `config.json`: le varianti di build che conosce `scripts/build.py`.
- `README.md`: quale opzione di menu seleziona ogni dimensione.

### Due varianti per la stessa scheda

`config.json` elenca due build per la scheda da 4,3 pollici, e scegliere quella giusta conta:

| Variante                        | Opzioni aggiuntive                                                     | Per                                          |
| ------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------- |
| `esp32-p4-wifi6-touch-lcd-4.3`  | `CONFIG_ESP32P4_SELECTS_REV_LESS_V3=y`, `CONFIG_ESP32P4_REV_MIN_100=y` | Silicio ESP32-P4 precedente alla revisione 3 |
| `esp32-p4x-wifi6-touch-lcd-4.3` | nessuna delle due                                                      | Silicio ESP32-P4 di revisione 3.x            |

Entrambe impostano `CONFIG_BOARD_TYPE_WAVESHARE_ESP32_P4_WIFI6_TOUCH_LCD_4_3=y`, la cancellazione dell'eco lato dispositivo (`CONFIG_USE_DEVICE_AEC=y`) e le opzioni della fotocamera OV5647 per la versione che ne ha una. Il README di Xiaozhi nota che ESP32-P4 Rev1 e Rev3 sono entrambi supportati su IDF 6, e il README del supporto di scheda di Waveshare descrive la stessa divisione ("pre-v3 silicon", silicio precedente alla v3, e "rev3.x or newer", rev3.x o successiva). esptool stampa il chip e la sua revisione quando si collega alla scheda, quindi controlla la tua prima della prima build.

### Come la pancia trova il suo server

L'indirizzo del server non è compilato nel codice vocale. A ogni avvio, Xiaozhi chiede le sue impostazioni a un **endpoint OTA**, come descrive il suo [documento OTA](https://github.com/78/xiaozhi-esp32/blob/main/docs/ota.md):

1. La scheda invia una `POST` all'URL OTA con la sua identità (indirizzo MAC, un UUID `Client-Id` conservato in NVS, nome della scheda, versione del firmware) e le sue capacità.
2. Il server risponde con un JSON: un oggetto `websocket` (`url` e `token`) o un oggetto `mqtt`, l'ora del server, un aggiornamento firmware facoltativo e un codice `activation` facoltativo.
3. La scheda salva le impostazioni di connessione in NVS e apre il canale vocale quando le serve.

La regola del documento per scegliere l'URL OTA: il firmware "uses a valid saved `wifi.ota_url`, otherwise `CONFIG_OTA_URL`" (usa un `wifi.ota_url` salvato e valido, altrimenti `CONFIG_OTA_URL`). In `main/ota.cc`:

```cpp
std::string Ota::GetCheckVersionUrl() {
    Settings settings("wifi", false);
    std::string url = settings.GetString("ota_url");
    if (!wifi_config::IsValidOtaUrl(url)) {
        ESP_LOGW(TAG, "Ignoring invalid saved OTA URL; using the default");
        url.clear();
    }
    if (url.empty()) {
        url = CONFIG_OTA_URL;
    }
    return url;
}
```

`CONFIG_OTA_URL` viene da `main/Kconfig.projbuild`, sotto il menu `Xiaozhi Assistant`, come "Default OTA URL", con il valore predefinito `https://api.tenclass.net/xiaozhi/ota/` (il servizio ufficiale). Quindi ci sono due modi per puntare la pancia al tuo server:

- **Salvare l'URL sul dispositivo** (ciò che fa il bot). La pagina di configurazione del Wi-Fi ha una scheda Advanced con un campo OTA URL; ciò che scrivi lì viene salvato in NVS come `wifi/ota_url`.
- **Cambiare il valore predefinito nella build**, tramite `idf.py menuconfig` o modificando `Kconfig.projbuild`, come fa la guida al firmware di xinnan-tech.

Il bot lo salva sul dispositivo per una regola fissata per tutto il progetto: i segreti, e con loro l'indirizzo del server, vivono in NVS o nella configurazione locale, mai nel repository. Un URL salvato sul dispositivo non arriva mai a git, e spostare il server su un altro PC non richiede una nuova build.

### Primo avvio e provisioning del Wi-Fi

Il Wi-Fi viene dal componente [esp-wifi-connect](https://github.com/78/esp-wifi-connect) di Xiaozhi. Il suo README dice che prima prova le reti salvate in flash e, se non riesce, avvia un access point e un server web su `http://192.168.4.1`. Il `WifiBoard` di Xiaozhi lo configura con il prefisso `Xiaozhi`, quindi l'hotspot si chiama `Xiaozhi-` seguito da quattro cifre esadecimali dell'indirizzo MAC della scheda, e attiva il campo OTA della scheda Advanced (`show_ota_config = true`).

Il componente valida l'URL OTA prima di salvarlo: un valore vuoto significa "usa il valore predefinito del firmware", e qualsiasi altro valore deve essere un URL HTTP o HTTPS assoluto di al massimo 255 byte ASCII, con un host.

Una volta connessa, la pancia chiama l'endpoint OTA del tuo server. Con il servizio ufficiale, la risposta include un codice di attivazione da inserire nella console di xiaozhi.me. Il tuo server nella sua modalità minima rimanda l'indirizzo WebSocket e nessun codice di attivazione (guida 4), quindi non c'è niente da associare e la pancia passa subito allo stato di attesa.

### Una conversazione, passo per passo

Dal documento WebSocket di Xiaozhi:

1. **Idle → Connecting.** La wake word o il pulsante BOOT aprono il canale audio: la pancia si collega all'URL WebSocket, con gli header `Authorization`, `Protocol-Version`, `Device-Id` e `Client-Id`, e invia un messaggio `"type": "hello"` con i suoi parametri audio.
2. **Connecting → Listening.** Il server risponde con il suo `hello` e un ID di sessione, la pancia invia `listen` con `"state": "start"`, e l'audio del microfono sale come Opus in frame binari.
3. **Il server lavora.** Rimanda `stt` con il testo che ha sentito, `llm` con un'emozione per la faccia e messaggi `tts`: `start`, poi `sentence_start` con il testo di ogni frase, poi `stop`.
4. **Listening → Speaking → Idle.** Con `tts` `start` la pancia smette di inviare audio e riproduce ciò che arriva; con `stop` torna ad ascoltare se l'auto-continue è attivo, altrimenti torna in attesa.

Quell'emozione `llm` sarà utile più avanti: è la prima cosa che la pancia può inoltrare alla testa come posa.

### MCP lato dispositivo

Xiaozhi registra i tool sul dispositivo tramite il singleton `McpServer`, con `AddTool(name, description, properties, callback)`. Il server invia `initialize`, poi `tools/list`, poi `tools/call` su JSON-RPC 2.0, come spiega il suo [documento sull'uso di MCP](https://github.com/78/xiaozhi-esp32/blob/main/docs/mcp-usage.md). È così che il cervello di Narsil potrà agire sul bot, non solo parlare attraverso di esso; le guide successive aggiungono i tool propri del bot.

## Come è stata chiesta all’IA

La voce non era nel primo design. Una volta che le due schede avevano i loro ruoli, l'IA ha chiesto come dovesse parlare Narsil, e chi ha creato Narsil aveva già una risposta:

> yo pensaba hacerlo con Xiaozhi

In italiano: "pensavo di farlo con Xiaozhi".

L'IA ha letto il README di Xiaozhi per verificare cosa porta e cosa richiede: licenza MIT, l'ESP32-P4 tra le sue piattaforme di chip ed ESP-IDF 6.0.1 o successiva (guida 2). Questo ha fatto di Xiaozhi la base del firmware della pancia, e del repository un suo fork.

Poi è arrivata la questione di dove si elabora la voce. Xiaozhi si collega a xiaozhi.me per impostazione predefinita, e l'IA ha chiesto se usare quel servizio o un server proprio. La risposta:

> servidor propio

In italiano: "server proprio".

Quella risposta è il motivo per cui questa guida dedica tempo all'URL OTA: è l'unica impostazione che sposta la pancia dal servizio ufficiale al tuo. La guida 4 costruisce il server.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è la conversazione usata per costruire il bot.

> Ho un fork di 78/xiaozhi-esp32 e una Waveshare ESP32-P4-WIFI6-Touch-LCD-4.3. Leggi la cartella della scheda `main/boards/waveshare/esp32-p4-wifi6-touch-lcd/`, `main/Kconfig.projbuild`, `main/ota.cc` e `docs/ota.md`, poi spiegami: quale variante di build va bene per la mia scheda e come capisco la revisione del mio chip, il comando `scripts/build.py` esatto e ogni modo in cui il firmware decide quale URL OTA usare. Voglio tenere l'indirizzo del mio server fuori dal repository, quindi consigliami l'opzione che lo salva sul dispositivo, e dimmi cosa vedrò al primo avvio.

## Il codice minimo

La pancia non ha bisogno di codice nuovo per questa guida: è Xiaozhi così com'è, compilato per la scheda giusta. Dalla radice del fork, in PowerShell, con l'immagine Docker della guida 2:

```powershell
docker run --rm -v ${PWD}:/project -w /project -e HOME=/tmp -e IDF_GIT_SAFE_DIR=/project `
  espressif/idf:release-v6.1 `
  python scripts/build.py waveshare/esp32-p4-wifi6-touch-lcd --name esp32-p4-wifi6-touch-lcd-4.3 --language es-ES
```

- `waveshare/esp32-p4-wifi6-touch-lcd` è la cartella della scheda sotto `main/boards/`.
- `--name` sceglie la variante. Senza, `build.py` la chiede in modo interattivo, e in un container senza terminale si ferma con "Multiple variants found in non-interactive mode; select one with --name." (trovate più varianti in modalità non interattiva; selezionane una con --name). Usa `esp32-p4x-wifi6-touch-lcd-4.3` per il silicio di revisione 3.
- `--language es-ES` rende in spagnolo l'interfaccia e i messaggi vocali, la lingua di Narsil; il valore predefinito è `en-US`. Senza `--wake-word`, `build.py` sceglie "Hi ESP" per ogni lingua tranne `zh-CN` e `zh-TW`.

Il risultato è `build/merged-binary.bin`. Flashalo da Windows (guida 2):

```powershell
esptool --port COM5 write-flash 0x0 build/merged-binary.bin
```

Poi, al primo avvio:

1. Sul telefono, collegati alla rete Wi-Fi `Xiaozhi-` seguita da quattro caratteri.
2. Apri `http://192.168.4.1`.
3. Nella scheda **Advanced**, inserisci l'URL OTA del tuo server, composto dall'indirizzo LAN del tuo PC e dalla porta 8003 (guida 4), per esempio `http://192.168.1.50:8003/xiaozhi/ota/`. Salva.
4. Scegli la tua rete Wi-Fi, inserisci la sua password e salva.

Se compili con `idf.py` invece che con `build.py`, la stessa scheda si seleziona in `idf.py menuconfig` sotto `Xiaozhi Assistant`, opzione "Waveshare ESP32-P4 Wi-Fi 6 Touch LCD 4.3".

## Errori comuni e come testarlo

- **La variante sbagliata per il tuo silicio.** Le due build da 4,3 pollici differiscono solo per la revisione del chip a cui sono destinate. Controlla la revisione che stampa esptool e scegli il `--name` corrispondente.
- **`127.0.0.1` o `localhost` come URL OTA.** Sulla pancia, significano la pancia stessa. Usa l'indirizzo del PC sulla tua rete.
- **Un URL che il portale rifiuta.** Deve essere assoluto (`http://` compreso), avere un host e restare sotto i 255 byte ASCII. Mantieni il percorso esattamente `/xiaozhi/ota/`, con la barra finale, come lo stampa il server.
- **`https://` verso un server HTTP semplice.** Il server minimo della guida 4 parla HTTP semplice sulla 8003.
- **Un URL non valido salvato in precedenza.** Il firmware lo ignora e torna a `CONFIG_OTA_URL`, che è il servizio ufficiale. Il monitor mostra "Ignoring invalid saved OTA URL; using the default" (URL OTA salvato non valido ignorato; uso il valore predefinito).
- **L'hotspot ricompare dopo un nuovo flashing completo.** Il documento WebSocket di Xiaozhi dice che il `Client-Id` si azzera quando si cancella la NVS o si riflasha il firmware completo; se sono sparite anche le impostazioni salvate, inserisci di nuovo il Wi-Fi e l'URL OTA.
- **La scheda si collega ma non risponde mai.** Il firewall del PC potrebbe bloccare le porte 8000 e 8003, oppure il server potrebbe essere spento. La pancia continua a ritentare il controllo OTA: dieci tentativi, a partire da dieci secondi e raddoppiando.

Per testare, apri il monitor (guida 2) durante il primo avvio. Dovresti vedere la connessione al Wi-Fi, la richiesta OTA al tuo URL e, una volta che il server è attivo, nessun passaggio di attivazione. Poi di' la wake word, "Hi ESP": la pancia passa all'ascolto, e il log del server (guida 4) mostra la connessione e il testo che ha sentito.

## Per andare oltre

- Il [documento OTA](https://github.com/78/xiaozhi-esp32/blob/main/docs/ota.md) di Xiaozhi descrive come un server può anche offrire aggiornamenti del firmware; il server di xinnan-tech può servirli dalla sua cartella `data/bin`, così la pancia può aggiornarsi via Wi-Fi.
- `scripts/build.py --list-wake-words` elenca i modelli di wake word del componente ESP-SR corrente, e `--wake-word` ne sceglie uno.
- La [guida alle schede personalizzate](https://github.com/78/xiaozhi-esp32/blob/main/docs/custom-board.md) avverte di non sovrascrivere mai la configurazione di una scheda esistente per una personalizzata, perché l'OTA può sostituire il tuo firmware con quello originale di quella scheda. Tienilo presente ogni volta che aggiungi codice tuo alla pancia.
- Xiaozhi può anche mostrare espressioni sul proprio schermo; la guida 9 sostituisce lo schermo della pancia con l'interfaccia di Narsil.
