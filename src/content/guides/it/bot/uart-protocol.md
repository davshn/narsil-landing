---
title: Il protocollo UART tra pancia e testa
description: 'Un piccolo protocollo a righe con versione e checksum: la pancia invia la posa e lo stato vocale di Narsil, la testa saluta soltanto, ed entrambe reggono un riavvio o un filo staccato.'
route: bot
order: 10
updated: 2026-11-18
---

## Cosa fa

La pancia sa cosa sta facendo Narsil; la testa si limita a disegnarla. Tra loro corrono i tre fili della guida 1, e questa guida decide cosa viaggia su di essi: brevi righe di testo come

```text
$N1,P,trabajando,3*3A
```

che significa "protocollo versione 1: mostra la posa `trabajando` (al lavoro) allo stadio 3". La pancia invia una riga quando la posa di Narsil cambia, quando Xiaozhi inizia o smette di ascoltare o di parlare, e comunque ogni cinque secondi. La testa controlla ogni riga, disegna ciò che dice e rimanda una riga solo quando si avvia, per chiedere lo stato attuale.

Questo è l'intero protocollo: due messaggi in giù, uno in su. Basta perché la testa non custodisce né uno stato che valga la pena conservare né segreti, come ha deciso la guida 1.

## Come funziona dentro

### Perché righe di testo

Una UART trasporta byte, senza alcuna idea di dove un messaggio inizi o finisca. Il protocollo deve aggiungerlo, e ci sono due modi comuni: frame binari con un byte di inizio e una lunghezza, oppure righe di testo che finiscono con `\n`. Il bot usa righe di testo:

- **Puoi leggerle.** Il monitor seriale o un adattatore USB-seriale mostra i messaggi così come sono, e puoi scriverne uno a mano per testare la testa.
- **Un byte perso costa una riga.** Dopo qualsiasi spazzatura, il `$` successivo inizia un nuovo messaggio, e il `\n` successivo lo chiude. Niente deve risincronizzarsi.
- **I messaggi sono minuscoli.** Una posa e uno stadio stanno in circa 20 byte. A 115200 baud una riga richiede meno di 2 millisecondi.

### La forma di una riga

```text
$N1,<type>,<fields>*<checksum>\n
```

| Parte        | Significato                                                                     |
| ------------ | ------------------------------------------------------------------------------- |
| `$`          | Inizio di un messaggio. Tutto ciò che viene prima è ignorato.                   |
| `N1`         | Protocollo Narsil, versione 1. Una testa che non conosce la versione lo ignora. |
| `<type>`     | Una lettera: `P` (posa), `V` (voce), `H` (saluto).                              |
| `<fields>`   | Valori separati da virgole, a seconda del tipo.                                 |
| `*`          | Fine del corpo.                                                                 |
| `<checksum>` | Due cifre esadecimali maiuscole: lo XOR di ogni byte tra `$` e `*`.             |
| `\n`         | Fine della riga. Una riga più lunga di 64 byte viene scartata.                  |

È la stessa forma che usano i ricevitori GPS per le loro frasi NMEA, per gli stessi motivi: leggibile, breve e autoverificante. Il checksum XOR è un byte, calcolato facendo lo XOR dei caratteri uno dopo l'altro. Non rileva ogni errore, ma rileva quelli soliti su un filo corto, come un bit invertito o un byte perso a metà riga, e non costa niente calcolarlo.

Il campo della versione è ciò che permette al protocollo di cambiare in futuro. Se la versione 2 aggiunge un campo, una testa con il firmware vecchio ignora le righe `N2` invece di disegnare qualcosa di sbagliato, e la pancia può inviare entrambe mentre le due schede vengono aggiornate una alla volta.

### I messaggi

| Riga                    | Direzione      | Significato                                                                                            |
| ----------------------- | -------------- | ------------------------------------------------------------------------------------------------------ |
| `$N1,P,<pose>,<stage>*` | pancia → testa | La posa di Narsil: `parada`, `trabajando`, `necesita`, `terminado` o `error`; il suo stadio, da 1 a 5. |
| `$N1,V,<voice>*`        | pancia → testa | Lo stato vocale di Xiaozhi: `idle`, `listening` o `speaking`.                                          |
| `$N1,H*1B`              | testa → pancia | Saluto: la testa si è appena avviata e non ha niente da disegnare.                                     |

Alcune righe reali, con i loro checksum:

```text
$N1,P,parada,1*35
$N1,P,necesita,2*33
$N1,V,listening*40
$N1,V,idle*2D
$N1,H*1B
```

I nomi delle pose sono quelli di narsil-pet, tenuti in spagnolo perché corrispondano uno a uno ai file della sua arte. Vengono dalla tabella `POSE` nel suo `hooks/sprite.ts`, una posa per stato: `working` è `trabajando`, `idle` è `parada`, `waiting` è `necesita`, `done` è `terminado` ed `error` è `error`.

### Da dove viene la posa

La pancia non inventa la posa di Narsil: gliela dice il PC, nel messaggio `-estado` della guida 7. Quel JSON non ha un campo "pose" suo; ha `art`, l'URL del suo disegno, costruito da `artUrl` in `hooks/phone.ts` di narsil-pet:

```ts
export function artUrl(pose: string, stage: number): string {
  return `${ART_URL}/${stage > 1 ? `etapa${stage}/` : ''}${pose}-oscuro.png`
}
```

(Citato da [davshn/narsil-pet](https://github.com/davshn/narsil-pet), GPL-3.0-or-later.) `sendStatus` in `hooks/register.tsx` la chiama con la posa della conversazione più importante e lo stadio di Narsil, da 1 (la piccola appena uscita dall'uovo) a 5 (`STAGE_FROM` in `hooks/xp.ts`). Quindi l'URL porta entrambi i valori:

| `art` finisce con                      | Posa         | Stadio |
| -------------------------------------- | ------------ | ------ |
| `/assets/parada-oscuro.png`            | `parada`     | 1      |
| `/assets/etapa3/trabajando-oscuro.png` | `trabajando` | 3      |
| `/assets/etapa5/error-oscuro.png`      | `error`      | 5      |

`HeadSetPoseFromArt`, la funzione che chiama `ShowStatus` della guida 9, prende come posa il nome del file tra l'ultimo `/` e `-oscuro.png`, e come stadio il numero dopo `/etapa` (1 quando non c'è). Controlla la posa rispetto ai cinque nomi prima di tenerla, così un formato di URL cambiato non può mai inviare alla testa qualcosa che non sa disegnare.

La testa disegna la stessa arte che mostrano la banda di Narsil e gli avvisi sul telefono, ed è per questo che i nomi restano come li scrive narsil-pet.

### Lo stato vocale

La pancia sa anche qualcosa che il PC non sa: se Xiaozhi sta ascoltando o parlando in questo momento. `Application::GetInstance().GetDeviceState()` in Xiaozhi restituisce lo stato attuale della sua macchina a stati (`main/device_state.h`): `kDeviceStateListening` e `kDeviceStateSpeaking` diventano `listening` e `speaking`, e ogni altro stato è `idle`. Il task del collegamento della pancia lo controlla dieci volte al secondo e invia una riga `V` quando cambia, così la testa può mostrare che Narsil sta ascoltando mentre le parli.

### Riconnessioni, riavvii e fili staccati

Il collegamento non ha una connessione da stabilire né niente da confermare. Tre regole tengono allineati i due lati:

1. **La pancia si ripete.** Ogni cinque secondi invia le righe `P` e `V` attuali, cambiate o no. Una testa che ha perso una riga, o il cui filo è stato staccato e riattaccato, torna corretta entro cinque secondi.
2. **La testa saluta.** Quando la testa si avvia, invia `$N1,H*1B` una volta. La pancia risponde subito con `P` e `V`, così una testa riavviata non aspetta la ripetizione successiva.
3. **La testa nota il silenzio.** Se per 15 secondi non arriva nessuna riga valida, la pancia è spenta o il filo è staccato. La testa tiene l'ultima posa sullo schermo e abbassa la retroilluminazione (guida 11), invece di bloccarsi a piena luminosità.

Quando la pancia si avvia, parte da `parada` allo stadio 1 e lo invia subito; il primo messaggio `-estado` da ntfy (lo stream chiede `since=10m`, guida 7) lo corregge.

### Perché la testa non invia nient'altro

La testa ha un'IMU a sei assi e potrebbe segnalare tocchi o il fatto di essere sollevata, e il filo TX c'è per questo. Il bot si limita al saluto per un motivo: tutto ciò che la testa invia è qualcosa che la pancia deve validare, gestire e mantenere compatibile tra le versioni. Con un solo messaggio in su, la testa non può chiedere niente alla pancia, non può causare una richiesta di rete e non può raggiungere un segreto. La regola della guida 1, "la pancia possiede ogni connessione e ogni segreto", è più facile da mantenere quando l'altra direzione è quasi vuota.

### La UART su ogni scheda

Entrambi i lati usano il [driver UART](https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/api-reference/peripherals/uart.html) di ESP-IDF con le impostazioni della guida 1: `UART_NUM_1`, 115200 baud, 8 bit di dati, nessuna parità, 1 bit di stop, nessun controllo di flusso, su una massa comune.

| Scheda            | TX     | RX     |
| ----------------- | ------ | ------ |
| Pancia (ESP32-P4) | GPIO4  | GPIO5  |
| Testa (ESP32-S3)  | GPIO14 | GPIO13 |

Le chiamate sono quelle dell'esempio `uart_echo` di ESP-IDF: `uart_driver_install` con un buffer di ricezione, `uart_param_config`, `uart_set_pin`, poi `uart_write_bytes` per inviare e `uart_read_bytes` con un timeout per ricevere. Sulla testa, `uart_read_bytes` con un timeout di 200 ms è anche l'orologio del suo ciclo principale: torna prima quando arrivano byte e altrimenti lascia alla testa il tempo di controllare il silenzio.

## Come è stata chiesta all’IA

Il collegamento stesso è venuto da una delle prime risposte di chi ha creato Narsil. Alla domanda se la testa si sarebbe collegata alla rete da sola o avrebbe ricevuto i suoi dati dalla pancia, chi ha creato Narsil ha detto:

> Por cable desde la panza

In italiano: "Via cavo dalla pancia".

E il compito della testa era stato fissato fin dall'inizio:

> la cabeza va a ser una apntalla holografica que solo sea la cara de narsil

In italiano: "la testa sarà uno schermo olografico che sia solo la faccia di Narsil".

Insieme, queste due risposte sono la portata del protocollo: un filo, e solo ciò che serve alla faccia. Il formato non è stato una decisione di chi ha creato Narsil. L'IA ha confrontato i frame binari con le righe di testo, e ha scelto righe di testo con una versione e un checksum perché si possono leggere e scrivere a mano durante i test. Ricavare la posa dall'URL di `art`, invece di aggiungere un nuovo campo sul PC, è venuto dalla lettura di `artUrl` e `sendStatus` di narsil-pet: l'informazione c'era già, quindi sul lato del PC non doveva cambiare niente.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è la conversazione usata per preparare il bot.

> Due schede ESP32 condividono una UART (UART_NUM_1, 115200 baud, massa comune). Il corpo invia alla testa solo una posa e uno stato vocale; la testa li disegna e deve reggere riavvii e fili staccati. Progetta un protocollo testuale a righe con un campo di versione e un checksum XOR di un byte, elenca ogni messaggio con un esempio e il suo checksum, e scrivi entrambi i lati in ESP-IDF 6 con `uart_driver_install`, `uart_param_config`, `uart_set_pin`, `uart_write_bytes` e `uart_read_bytes`. Il corpo ripete il suo stato ogni 5 s; la testa invia un saluto all'avvio e nient'altro. Spiega come testo ogni lato da un PC con un adattatore USB-seriale.

## Il codice minimo

Il lato della pancia, in C++ accanto al codice di Xiaozhi (MIT, come gli esempi del sito). `head_link_init` della guida 1 configura la porta; questo aggiunge i messaggi e il task del collegamento:

```cpp
#include <driver/uart.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <mutex>
#include <string>

#include "application.h"

#define HEAD_UART UART_NUM_1

static const char* const kPoses[] = {"parada", "trabajando", "necesita", "terminado", "error"};
static std::mutex state_lock;
static std::string pose = "parada";
static int stage = 1;
static bool resend = true;

static void SendLine(const char* body) {
    uint8_t sum = 0;
    for (const char* c = body; *c; c++) sum ^= (uint8_t)*c;
    char line[72];
    int len = snprintf(line, sizeof(line), "$%s*%02X\n", body, sum);
    uart_write_bytes(HEAD_UART, line, len);
}

void HeadSetPoseFromArt(const char* art) {
    const char* file = strrchr(art, '/');
    const char* end = file ? strstr(file, "-oscuro.png") : nullptr;
    if (end == nullptr) return;
    std::string name(file + 1, end);
    const char* etapa = strstr(art, "/etapa");
    int new_stage = etapa ? atoi(etapa + 6) : 1;
    if (new_stage < 1 || new_stage > 5) return;
    for (const char* known : kPoses) {
        if (name == known) {
            std::lock_guard<std::mutex> guard(state_lock);
            pose = name;
            stage = new_stage;
            resend = true;
            return;
        }
    }
}

static const char* Voice() {
    switch (Application::GetInstance().GetDeviceState()) {
        case kDeviceStateListening: return "listening";
        case kDeviceStateSpeaking: return "speaking";
        default: return "idle";
    }
}

static void HeadLinkTask(void*) {
    const char* last_voice = "";
    TickType_t last_sent = 0;
    std::string rx;
    while (true) {
        uint8_t byte;
        while (uart_read_bytes(HEAD_UART, &byte, 1, 0) == 1) {
            if (byte != '\n') { if (rx.size() < 64) rx += (char)byte; continue; }
            if (rx == "$N1,H*1B") resend = true;
            rx.clear();
        }
        const char* voice = Voice();
        bool due = xTaskGetTickCount() - last_sent > pdMS_TO_TICKS(5000);
        if (resend || due || voice != last_voice) {
            char body[48];
            {
                std::lock_guard<std::mutex> guard(state_lock);
                snprintf(body, sizeof(body), "N1,P,%s,%d", pose.c_str(), stage);
                resend = false;
            }
            SendLine(body);
            snprintf(body, sizeof(body), "N1,V,%s", voice);
            SendLine(body);
            last_voice = voice;
            last_sent = xTaskGetTickCount();
        }
        vTaskDelay(pdMS_TO_TICKS(100));
    }
}

void StartHeadLink() {
    xTaskCreate(HeadLinkTask, "head_link", 4096, nullptr, 2, nullptr);
}
```

Chiama `head_link_init()` e poi `StartHeadLink()` una volta all'avvio; il collegamento non ha bisogno del Wi-Fi.

Il lato della testa, in C (MIT). Legge una riga alla volta e riempie una piccola struct di stato che disegna la guida 11:

```c
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "driver/uart.h"
#include "freertos/FreeRTOS.h"

#define BELLY_UART    UART_NUM_1
#define BELLY_UART_TX 14
#define BELLY_UART_RX 13

typedef struct {
    char pose[16];
    int stage;
    char voice[12];
} head_state_t;

void head_link_init(void)
{
    const uart_config_t config = {
        .baud_rate = 115200,
        .data_bits = UART_DATA_8_BITS,
        .parity = UART_PARITY_DISABLE,
        .stop_bits = UART_STOP_BITS_1,
        .flow_ctrl = UART_HW_FLOWCTRL_DISABLE,
        .source_clk = UART_SCLK_DEFAULT,
    };
    ESP_ERROR_CHECK(uart_driver_install(BELLY_UART, 1024, 0, 0, NULL, 0));
    ESP_ERROR_CHECK(uart_param_config(BELLY_UART, &config));
    ESP_ERROR_CHECK(uart_set_pin(BELLY_UART, BELLY_UART_TX, BELLY_UART_RX,
                                 UART_PIN_NO_CHANGE, UART_PIN_NO_CHANGE));
    uart_write_bytes(BELLY_UART, "$N1,H*1B\n", 9);
}

static bool frame_ok(char *line)
{
    char *star = strrchr(line, '*');
    if (line[0] != '$' || star == NULL || strlen(star) != 3) return false;
    unsigned sum = 0;
    for (char *c = line + 1; c < star; c++) sum ^= (unsigned char)*c;
    unsigned got = strtoul(star + 1, NULL, 16);
    *star = '\0';
    return got == sum;
}

static bool apply(char *body, head_state_t *state)
{
    char *save;
    char *version = strtok_r(body, ",", &save);
    char *type = strtok_r(NULL, ",", &save);
    if (version == NULL || type == NULL || strcmp(version, "N1") != 0) return false;
    if (strcmp(type, "P") == 0) {
        char *pose = strtok_r(NULL, ",", &save);
        char *stage = strtok_r(NULL, ",", &save);
        if (pose == NULL || stage == NULL || strlen(pose) >= sizeof(state->pose)) return false;
        int n = atoi(stage);
        if (n < 1 || n > 5) return false;
        strcpy(state->pose, pose);
        state->stage = n;
        return true;
    }
    if (strcmp(type, "V") == 0) {
        char *voice = strtok_r(NULL, ",", &save);
        if (voice == NULL || strlen(voice) >= sizeof(state->voice)) return false;
        strcpy(state->voice, voice);
        return true;
    }
    return false;
}

bool head_link_poll(head_state_t *state, int timeout_ms)
{
    static char line[65];
    static size_t len = 0;
    uint8_t byte;
    while (uart_read_bytes(BELLY_UART, &byte, 1, pdMS_TO_TICKS(timeout_ms)) == 1) {
        if (byte == '$') len = 0;
        if (byte != '\n') {
            if (len < sizeof(line) - 1) line[len++] = (char)byte;
            continue;
        }
        line[len] = '\0';
        len = 0;
        return frame_ok(line) && apply(line + 1, state);
    }
    return false;
}
```

`head_link_poll` restituisce `true` per ogni riga valida, dopo aver aggiornato `state`, e `false` dopo `timeout_ms` senza niente di valido. Un `$` in mezzo alla spazzatura fa ripartire la riga, così la testa riprende da sola il messaggio buono successivo.

## Errori comuni e come testarlo

- **Un checksum calcolato includendo il `$`.** Lo XOR copre solo i byte tra `$` e `*`. `$N1,H*1B` è il riferimento: se il tuo codice ottiene un altro valore, ne include troppo.
- **Esadecimale minuscolo.** `%02X` scrive `1B`; lo `strtoul` della testa accetta entrambi i casi, ma uno strumento che confronta stringhe potrebbe non farlo.
- **`\r\n` da un terminale.** Molti terminali inviano un ritorno a capo prima del newline. Lo `strlen(star) != 3` della testa allora fallisce; imposta il terminale perché invii solo `LF`.
- **La console della pancia sul collegamento.** Se i messaggi di avvio compaiono sul lato della testa, il collegamento è su UART0. Deve essere `UART_NUM_1` su GPIO4 e GPIO5 (guida 1).
- **Una posa per cui la testa non ha arte.** La pancia accetta solo i cinque nomi di posa di narsil-pet e gli stadi da 1 a 5, e la testa li controlla di nuovo.
- **Entrambe le schede in silenzio dopo un riavvio della pancia.** La pancia invia subito quando si avvia, poi ogni cinque secondi; se la testa resta attenuata, scambia i fili dei dati (TX va su RX).

Per testare ogni lato senza l'altro, usa un adattatore USB-seriale a 3,3 V e un terminale sul PC. pyserial arriva con esptool, quindi `miniterm` c'è già:

```powershell
python -m serial.tools.miniterm --eol LF COM7 115200
```

- **Solo la pancia.** Collega l'RX dell'adattatore al GPIO4 della pancia e il suo GND al GND della pancia. Ogni cinque secondi compaiono una riga `P` e una `V`. Di' "Hi ESP" e compare subito una riga `$N1,V,listening*40`. Esegui `/narsil movil prueba`, o finisci un turno in Claude Code, e la riga `P` cambia con la posa di Narsil.
- **Solo la testa.** Collega il TX dell'adattatore al GPIO13 della testa e GND a GND, e il suo RX al GPIO14. Resetta la testa: arriva `$N1,H*1B`. Scrivi `$N1,P,necesita,2*33` e premi Invio: la testa disegna Narsil in attesa allo stadio 2. Scrivi la stessa riga con un checksum sbagliato, `*34`: non cambia niente.

Usa solo adattatori a 3,3 V. Un adattatore a 5 V può danneggiare i pin dell'ESP32.

## Per andare oltre

- **Luminosità dalla pancia.** Un tipo di messaggio come `B,<percent>` permetterebbe alla pancia di attenuare la testa di notte. Aggiungilo come nuovo tipo nella versione 1: le teste vecchie ignorano i tipi che non conoscono, perché `apply` restituisce `false` per loro.
- **Tocchi dalla testa.** Il QMI8658 può rilevare un tocco. Una riga `T` dalla testa alla pancia potrebbe segnare come letto l'avviso più recente sullo schermo della pancia della [guida 9](/it/bot/belly-ui/). Limitala agli eventi, mai alle richieste.
- **Un CRC.** Per cavi più lunghi o più dati, un CRC-16 sostituisce il byte XOR con quattro cifre esadecimali, sotto una nuova versione, `N2`.
- Il disegno della testa, l'immagine specchiata e lo sfondo nero sono la [guida 11](/it/bot/holographic-head/).
