---
title: 'Gli avvisi di Narsil da ntfy'
description: 'Come la pancia segue lo stesso topic ntfy degli avvisi di Narsil sul telefono: come narsil-pet costruisce il topic e i messaggi, cosa nasconde la chiave e uno stream JSON su ESP-IDF.'
route: bot
order: 7
updated: 2026-11-18
---

## Cosa fa

[Narsil per Claude Code](https://github.com/davshn/narsil-pet) avvisa già il tuo telefono quando una conversazione ha bisogno di te: `/narsil movil` invia ogni avviso a un topic privato su [ntfy.sh](https://ntfy.sh), e l'app ntfy lo mostra come notifica. La pancia si iscrive allo stesso topic. Quando Claude finisce, ha una domanda o si ferma per un errore, l'avviso compare anche sullo schermo della pancia, con lo stato di Narsil accanto.

Sul lato del PC non cambia niente: narsil-pet continua a pubblicare come fa per il telefono, e la pancia è un lettore in più del topic. Legge due topic:

- **Il topic degli avvisi**, `narsil-` seguito da 20 caratteri esadecimali: un messaggio per avviso (finito, domanda, errore).
- **Il topic dello stato**, lo stesso nome con `-estado` alla fine: un piccolo stato JSON inviato alla fine di ogni turno, mai mostrato come notifica.

## Come funziona dentro

### Come narsil-pet costruisce il topic

Il nome del topic viene creato in `hooks/phone.ts`. Il seguente estratto è citato da [davshn/narsil-pet](https://github.com/davshn/narsil-pet), con licenza GPL-3.0-or-later:

```ts
// A topic nobody guesses: whoever knows its name can read it.
export function newTopic(uuid: string): string {
  return `narsil-${uuid
    .replace(/[^0-9a-f]/gi, '')
    .toLowerCase()
    .slice(0, 20)}`
}
```

Prende un UUID casuale, ne tiene le cifre esadecimali in minuscolo e usa le prime 20: un esempio inventato è `narsil-0123456789abcdef0123`. Il topic dello stato viene dallo stesso file:

```ts
export function statusTopic(topic: string): string {
  return `${topic}-estado`
}
```

Sul ntfy.sh pubblico il nome è l'unica protezione. La [documentazione di configurazione di ntfy](https://docs.ntfy.sh/config/) dice che il server è aperto per impostazione predefinita, e che "everyone can read and write to any topic (this is how ntfy.sh is configured)" (chiunque può leggere e scrivere su qualsiasi topic; ntfy.sh è configurato così). Il commento sopra `newTopic` dice lo stesso in meno parole. Tratta il topic come una password: non va nel repository del firmware, e `/narsil movil nuevo` ne crea uno nuovo se trapela.

### Cosa porta un avviso

`phoneMessage` in `hooks/phone.ts` costruisce il JSON che narsil-pet pubblica su ntfy.sh. In breve:

- `title`: `Narsil · <title> · <conversation>`, con il nome della conversazione da cui arriva l'avviso.
- `message`: il testo dell'avviso, poi l'elenco delle conversazioni aperte e dei loro stati e, sull'ultimo avviso del giorno, una nota che dice che è l'ultimo (narsil-pet ne invia al massimo 200 al giorno, sotto i 250 gratuiti di ntfy.sh).
- `priority`: 3 per `done`, 4 per `question` ed `error`.
- `tags`: un tag che nomina il tipo: `white_check_mark` (finito), `raising_hand` (domanda) o `warning` (errore).
- `icon`: il disegno di Narsil al suo stadio attuale, nella posa dell'avviso.

Quindi la pancia può riconoscere il tipo di avviso solo dal tag, e conosce l'ora dal campo `time` di ntfy.

### Cosa porta lo stato

Il messaggio `-estado` è un oggetto JSON dentro il campo `message` del messaggio ntfy, inviato con priorità 1. Il README di narsil-pet ne documenta i campi: `xp` (il livello e l'esperienza di Narsil), `art` (l'URL del suo disegno al suo stadio, nella posa della conversazione più importante), `at` (quando è stato inviato, in secondi Unix), `cacheMinutes` (quanto dura una cache, quando ce n'è una) e `usage` (il conteggio ntfy del giorno). La pancia mostra `xp` con l'ora del messaggio data da ntfy, e legge la posa e lo stadio da `art` per passarli alla testa ([guide 10](/it/bot/uart-protocol/) e [11](/it/bot/holographic-head/)).

### Cosa nasconde la chiave, e cosa no

`/narsil movil clave` sigilla ciò che invia narsil-pet, con una chiave che hanno solo i tuoi dispositivi (`hooks/seal.ts`, HMAC-SHA256 in modalità contatore con un tag encrypt-then-MAC). Conviene essere precisi su cosa copre. Questo è `sealedMessage` da `hooks/phone.ts`, citato da [davshn/narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later):

```ts
export function sealedMessage<M extends { title?: string; message: string }>(
  m: M,
  sealed: string,
): M {
  return { ...m, ...(m.title ? { title: 'Narsil' } : {}), message: sealed }
}
```

Cambiano solo `title` e `message`: il titolo diventa "Narsil", e il testo diventa una stringa sigillata che inizia con `narsil1:`. Tutto il resto viene copiato così com'era. Con una chiave, chi conosce il topic vede comunque:

- il **tipo** di avviso, da `tags` e `priority`;
- **quando** è stato inviato, dal `time` di ntfy;
- lo **stadio** e la posa di Narsil, dall'URL di `icon`.

Il messaggio di stato non ha titolo, quindi il suo intero JSON è sigillato e si vede solo la sua priorità.

Sulla pancia questo significa due modalità. Senza chiave, mostra tutto. Con una chiave, mostra il tipo, l'ora e lo stadio, e "Narsil" come titolo; leggere il testo richiede la chiave sulla pancia, cosa che trovi in "Per andare oltre".

### L'iscrizione dalla pancia

L'[API di iscrizione](https://docs.ntfy.sh/subscribe/api/) di ntfy ha uno stream JSON: una lunga `GET` a `https://ntfy.sh/<topic>/json` che non finisce mai, e che "returns a JSON stream, with one JSON message object per line" (restituisce uno stream JSON, con un oggetto messaggio JSON per riga). Più topic stanno in una sola connessione, separati da virgole, quindi la pancia apre un solo stream per entrambi:

```text
https://ntfy.sh/narsil-0123456789abcdef0123,narsil-0123456789abcdef0123-estado/json
```

Ogni riga è un evento. Il campo `event` dice quale: `open` quando lo stream inizia, `keepalive` di tanto in tanto perché la connessione non sembri morta, e `message` per quello vero. Un evento `message` ha `id`, `time`, `topic`, `title`, `message`, `tags` e `priority`, tra gli altri.

Su ESP-IDF lo stream si legge con [`esp_http_client`](https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/api-reference/protocols/esp_http_client.html) nel suo ordine di streaming: `esp_http_client_open`, `esp_http_client_fetch_headers`, poi `esp_http_client_read` in un ciclo, tagliando i byte in righe a ogni `\n`. HTTPS usa il [bundle di certificati](https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/api-reference/protocols/esp_crt_bundle.html) di ESP-IDF (`crt_bundle_attach = esp_crt_bundle_attach`), quindi nessun certificato viene incollato nel codice. Ogni riga viene analizzata con cJSON, che Xiaozhi usa già per il suo protocollo.

### Non perdere avvisi a una riconnessione

Il Wi-Fi cade, e le connessioni lunghe si interrompono. ntfy conserva i messaggi per un po' (il `cache-duration` del server è di 12 ore per impostazione predefinita), e il parametro `since=` chiede ciò che ti sei perso: una durata come `10m`, un orario Unix o un ID di messaggio. La pancia ricorda l'`id` dell'ultimo messaggio che ha mostrato e si riconnette con `since=<quell'id>`, così riceve esattamente gli avvisi inviati mentre era via e nessuno due volte. A un avvio da zero non ha un ID e chiede `since=10m`.

### Dove vive il topic

Il topic è salvato nella NVS della pancia, tramite la classe `Settings` di Xiaozhi (`main/settings.h`), nel namespace `narsil` sotto la chiave `ntfy_topic`. Lo scrivi una volta nella schermata delle impostazioni della pancia, che costruisce la [guida 9](/it/bot/belly-ui/); non compare mai nel codice sorgente. La [guida 12](/it/bot/secrets-privacy/) spiega perché la NVS non è cifrata per impostazione predefinita e cosa significa per un dispositivo sulla tua scrivania.

## Come è stata chiesta all’IA

Il compito della pancia era nella prima descrizione del bot fatta da chi ha creato Narsil:

> va a ser la pantalla grande para una pantalla en la pansa que va a tener la informacion de las tareas que hace narsil

In italiano: "sarà lo schermo grande, per uno schermo nella pancia che avrà le informazioni sui compiti che fa Narsil".

Narsil pubblica già quei compiti su ntfy per il telefono, quindi l'IA ha proposto di leggere quello stesso topic invece di inventare un nuovo canale dal PC. Poi ha chiesto se la testa si sarebbe collegata alla rete da sola o avrebbe ricevuto tutto dalla pancia, e chi ha creato Narsil ha risposto:

> Por cable desde la panza

In italiano: "Via cavo dalla pancia".

Così la pancia è l'unica scheda in rete per gli avvisi: si iscrive a ntfy, e la testa riceve solo posa e stato via cavo ([guida 10](/it/bot/uart-protocol/)). Come riconnettersi, e cosa mostrare quando è impostata una chiave, non sono stati chiesti; l'IA li ha presi dalla documentazione di ntfy e da `sealedMessage` di narsil-pet.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è la conversazione usata per preparare il bot.

> Il mio ESP32-P4 esegue Xiaozhi (ESP-IDF 6). Aggiungi un task FreeRTOS che si iscriva a due topic di ntfy.sh in un solo stream JSON (`https://ntfy.sh/<a>,<b>/json`), lo legga con `esp_http_client_open`, `esp_http_client_fetch_headers` ed `esp_http_client_read`, lo divida in righe, analizzi ognuna con cJSON e passi gli eventi `message` a una callback. Usa il bundle di certificati, leggi il topic dalla NVS con la classe `Settings` di Xiaozhi, conserva l'ID dell'ultimo messaggio e riconnettiti con `since=` dopo un errore. Cita la documentazione di ntfy per il formato dello stream e il parametro `since`.

## Il codice minimo

Un task per la pancia, in C++ accanto al codice di Xiaozhi (MIT, come gli esempi del sito). `ShowAlert` e `ShowStatus` sono le funzioni dello schermo della [guida 9](/it/bot/belly-ui/):

```cpp
#include <cJSON.h>
#include <esp_crt_bundle.h>
#include <esp_http_client.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <string>

#include "settings.h"

void ShowAlert(const char* title, const char* text, const char* tag, long time);
void ShowStatus(const char* state_json, long time);

static std::string last_id;

static void HandleLine(const std::string& line, const std::string& status_topic) {
    cJSON* root = cJSON_Parse(line.c_str());
    if (root == nullptr) return;
    const char* event = cJSON_GetStringValue(cJSON_GetObjectItem(root, "event"));
    if (event != nullptr && std::string(event) == "message") {
        const char* id = cJSON_GetStringValue(cJSON_GetObjectItem(root, "id"));
        const char* topic = cJSON_GetStringValue(cJSON_GetObjectItem(root, "topic"));
        const char* title = cJSON_GetStringValue(cJSON_GetObjectItem(root, "title"));
        const char* text = cJSON_GetStringValue(cJSON_GetObjectItem(root, "message"));
        cJSON* tags = cJSON_GetObjectItem(root, "tags");
        const char* tag = cJSON_GetStringValue(cJSON_GetArrayItem(tags, 0));
        long time = (long)cJSON_GetNumberValue(cJSON_GetObjectItem(root, "time"));
        if (id != nullptr) last_id = id;
        if (topic != nullptr && status_topic == topic) {
            ShowStatus(text ? text : "", time);
        } else {
            ShowAlert(title ? title : "Narsil", text ? text : "", tag ? tag : "", time);
        }
    }
    cJSON_Delete(root);
}

static void NtfyTask(void*) {
    Settings settings("narsil");
    std::string topic = settings.GetString("ntfy_topic");
    if (topic.empty()) vTaskDelete(nullptr);
    std::string status_topic = topic + "-estado";

    while (true) {
        std::string url = "https://ntfy.sh/" + topic + "," + status_topic + "/json?since=" +
                          (last_id.empty() ? "10m" : last_id);
        esp_http_client_config_t config = {};
        config.url = url.c_str();
        config.crt_bundle_attach = esp_crt_bundle_attach;
        config.timeout_ms = 120000;
        esp_http_client_handle_t client = esp_http_client_init(&config);

        if (esp_http_client_open(client, 0) == ESP_OK && esp_http_client_fetch_headers(client) >= 0) {
            std::string line;
            char buffer[512];
            int read;
            while ((read = esp_http_client_read(client, buffer, sizeof(buffer))) > 0) {
                for (int i = 0; i < read; i++) {
                    if (buffer[i] != '\n') { line += buffer[i]; continue; }
                    HandleLine(line, status_topic);
                    line.clear();
                }
            }
        }
        esp_http_client_close(client);
        esp_http_client_cleanup(client);
        vTaskDelay(pdMS_TO_TICKS(5000));
    }
}

void StartNtfy() {
    xTaskCreate(NtfyTask, "ntfy", 8192, nullptr, 3, nullptr);
}
```

Chiama `StartNtfy()` quando il Wi-Fi è attivo. `ShowAlert` riceve il tag, così lo schermo può scegliere la posa e il colore giusti anche quando il testo è sigillato. Il timeout di lettura di due minuti è ben superiore all'intervallo tra gli eventi keepalive di ntfy, quindi un topic silenzioso non conta come una connessione morta.

## Errori comuni e come testarlo

- **Uno stream che finisce dopo le prime righe.** `poll=1` restituisce la cache e chiude; l'URL del bot non deve includerlo.
- **L'intera cache a ogni riconnessione.** Senza `since=`, una riconnessione non porta niente di vecchio; con `since=all`, riporta tutto di nuovo. Usa l'ultimo `id`.
- **Un topic con una lettera maiuscola o un errore di battitura.** ntfy lo tratta come un topic diverso e vuoto. Copialo da `/narsil movil`, che stampa il nome.
- **Testo sigillato sullo schermo.** Un messaggio che inizia con `narsil1:` è stato sigillato da `/narsil movil clave`. Mostra "Narsil" e il tipo dal tag, oppure aggiungi la chiave (Per andare oltre).
- **Nessun avviso mentre sei al PC.** narsil-pet invia solo mentre il tuo ultimo messaggio è arrivato da Remote Control (il suo README spiega perché). `/narsil movil prueba` invia un avviso di prova da qualsiasi posto.
- **Il topic nel repository.** Va nella NVS tramite la schermata delle impostazioni, mai in un file sorgente o in un valore predefinito.

Per testare senza la pancia, segui lo stream da un terminale sul PC con l'esempio della documentazione di ntfy, usando il tuo topic:

```powershell
curl.exe -s "https://ntfy.sh/narsil-0123456789abcdef0123/json"
```

Esegui `/narsil movil prueba` in Claude Code: compare una riga `message`. Poi fai lo stesso con la pancia accesa: l'avviso si vede sul suo schermo, e il monitor seriale (guida 2) mostra la connessione a ntfy.sh. Spegni il Wi-Fi del router per un minuto, invia un'altra prova, riaccendilo: la pancia si riconnette con `since=` e mostra l'avviso che si era persa.

## Per andare oltre

- **Leggere gli avvisi sigillati.** `hooks/seal.ts` deriva due chiavi dalla tua con HMAC-SHA256 (`enc` e `mac`), fa lo XOR del testo con un keystream HMAC in blocchi da 32 byte e verifica un tag sul nonce e sul testo cifrato. mbedTLS, parte di ESP-IDF, ha HMAC-SHA256; portare `unseal` permette alla pancia di leggere il testo mentre il topic mostra rumore.
- **Un server ntfy tuo.** ntfy può girare in casa con controllo degli accessi, così il topic non è pubblico. narsil-pet pubblica su `https://ntfy.sh`, quindi entrambi i lati dovrebbero cambiare.
- **Lo stato per la testa.** Il messaggio `-estado` è ciò che guida la posa di Narsil sulla testa; la [guida 10](/it/bot/uart-protocol/) lo invia tramite la UART.
- La guida 8 aggiunge l'altra lista che mostra la pancia: le pull request che hanno bisogno di te. Lo schermo stesso è la [guida 9](/it/bot/belly-ui/).
