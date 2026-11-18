---
title: Il bot e le sue parti
description: 'Le due schede del bot da scrivania Narsil, cosa fa ciascuna, la distinta dei materiali, il collegamento UART a tre fili tra pancia e testa e come vi scorrono i dati.'
route: bot
order: 1
updated: 2026-11-18
---

## Cosa fa

Il bot da scrivania Narsil è Narsil con un corpo. Sta sulla scrivania accanto al tuo computer e fa tre lavori:

- **Parla.** Tu gli parli e Narsil risponde con una voce. La risposta arriva da Claude, attraverso un piccolo server che gira sul tuo PC.
- **Mostra cosa sta facendo Narsil.** Uno schermo touch da 4,3 pollici nella pancia mostra gli avvisi di Narsil e le tue pull request aperte su GitHub.
- **Ha una faccia.** La testa è un piccolo schermo dentro un cubo prismatico di vetro che mostra solo la faccia di Narsil, così sembra un ologramma che fluttua sopra il corpo.

Il bot è composto da due schede unite da tre fili. La pancia è il cervello e fa tutto ciò che tocca la rete. La testa si limita a disegnare. Questa prima guida descrive le parti e come si incastrano; il resto del percorso costruisce ogni pezzo.

## Come funziona dentro

### La pancia: Waveshare ESP32-P4-WIFI6-Touch-LCD-4.3

La pancia è la [Waveshare ESP32-P4-WIFI6-Touch-LCD-4.3](https://docs.waveshare.com/ESP32-P4-WIFI6-Touch-LCD-4.3). Dalla pagina di Waveshare, le parti che contano per il bot sono:

| Parte           | Cos'è                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------ |
| Chip principale | ESP32-P4 (ESP32-P4NRW32X sul modulo): RISC-V dual-core più un core a basso consumo               |
| Memoria         | 32 MB di PSRAM impilata nel package del chip, 32 MB di flash NOR                                 |
| Schermo         | IPS da 4,3 pollici, 480 × 800, touch capacitivo, su un'interfaccia MIPI DSI a 2 lane             |
| Wireless        | Un modulo ESP32-C6-MINI-1 integrato per Wi-Fi 6 e Bluetooth 5 (LE), collegato al P4 tramite SDIO |
| Audio           | Codec audio ES8311, ES7210 per la cancellazione dell'eco, un array di due microfoni              |
| Altoparlante    | Un connettore GH1.25 a 2 pin; Waveshare consiglia un altoparlante da 8 Ω 2 W                     |
| USB             | Una porta Type-C "USB to UART" per alimentazione, flashing e debug; una porta Type-C USB OTG 2.0 |
| Espansione      | Un header a 40 pin da 2,54 mm con I2C, GPIO, 3V3, 5V e GND                                       |

L'ESP32-P4 non ha una radio propria. Ogni byte che va in rete passa per l'ESP32-C6 accanto, tramite SDIO. Per il firmware questo è invisibile: il supporto di Xiaozhi per questa scheda (guida 3) imposta già il C6 come coprocessore Wi-Fi (`CONFIG_SLAVE_IDF_TARGET_ESP32C6=y` nei suoi valori predefiniti per ESP32-P4).

Il controller touch della scheda è un GT911, ed è quello che pilotano sia il codice di scheda di Xiaozhi sia il board support package di Waveshare (`waveshare/esp32_p4_wifi6_touch_lcd_4_3` nel registro dei componenti di Espressif).

### La testa: ESP32-S3-LCD-1.3-C

La testa è la ESP32-S3-LCD-1.3-C, la versione della ESP32-S3-LCD-1.3 di Waveshare che arriva con un case di plastica e un cubo prismatico. SpotPear la vende come [display 3D con prisma trasparente](https://spotpear.com/wiki/ESP32-S3-1.3-inch-LCD-ST7789-240x240-3D-Display-Transparent-Screen-Refractive-Prism-Mini-TV.html), e Waveshare documenta la scheda base nella sua [pagina prodotto](https://www.waveshare.com/esp32-s3-lcd-1.3.htm):

| Parte           | Cos'è                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------ |
| Chip principale | ESP32-S3R8, Xtensa LX7 dual-core fino a 240 MHz                                                  |
| Memoria         | 512 KB di SRAM, 8 MB di PSRAM, 16 MB di flash                                                    |
| Schermo         | IPS da 1,3 pollici, 240 × 240, 262K colori, driver ST7789V2 su SPI                               |
| Movimento       | IMU a sei assi QMI8658 (accelerometro e giroscopio), sul retro                                   |
| USB             | Type-C tramite un chip USB-seriale CH343P                                                        |
| Alimentazione   | Regolatore da 3,3 V ME6217C33M5G (800 mA massimo), caricatore PL4054, connettore batteria MX1.25 |
| Altro           | Slot per scheda TF, un header GPIO da 2,54 mm                                                    |
| Prisma          | Un cubo di vetro che poggia sullo schermo e ne riflette l'immagine                               |

Il prisma è il motivo per cui la faccia sembra fluttuare: lo schermo sta in orizzontale e la faccia interna del cubo lo riflette verso di te. Un riflesso è un'immagine speculare, quindi la testa disegna la sua faccia specchiata; se ne occupa la [guida 11](/it/bot/holographic-head/).

L'ESP32-S3 ha il suo Wi-Fi, e la testa non lo usa. È una decisione, spiegata qui sotto.

### Perché la pancia fa tutta la parte di rete

I dati di Narsil vivono su internet: gli avvisi arrivano tramite ntfy, le pull request arrivano dall'API REST di GitHub e la voce va al tuo server. Tutti e tre hanno bisogno di Wi-Fi, credenziali e logica di ritentativo. Se si collegassero entrambe le schede, entrambe avrebbero bisogno della password del Wi-Fi, del token di GitHub e del topic di ntfy, e potrebbero non essere d'accordo su cosa sta facendo Narsil.

Così la pancia possiede ogni connessione e ogni segreto, e decide lo stato di Narsil. La testa riceve solo cosa disegnare: una posa e uno stato, tramite un cavo seriale. Non custodisce segreti e, se si riavvia, aspetta semplicemente il messaggio successivo. La [guida 10](/it/bot/uart-protocol/) definisce quel protocollo.

### Il collegamento UART

Le due schede comunicano via UART, il semplice collegamento seriale che ha ogni ESP32, usando cavi Dupont femmina-femmina tra i loro header:

| Filo   | Pancia (ESP32-P4) | Testa (ESP32-S3) |
| ------ | ----------------- | ---------------- |
| Dati → | GPIO4 (TX)        | GPIO13 (RX)      |
| Dati ← | GPIO5 (RX)        | GPIO14 (TX)      |
| Massa  | GND               | GND              |

Il TX di un lato va all'RX dell'altro: ogni scheda parla sul suo pin TX e ascolta sul suo pin RX, quindi i fili si incrociano.

Perché questi pin:

- **Sulla pancia**, GPIO4 e GPIO5 sono sull'header a 40 pin e non sono usati da niente di ciò che Xiaozhi configura per questa scheda. Il suo `config.h` prende da GPIO9 a GPIO13 per l'audio I2S, GPIO7 e GPIO8 per l'I2C, GPIO53 per l'amplificatore dell'altoparlante, GPIO26 e GPIO27 per lo schermo e GPIO35 per il pulsante BOOT. Il supporto di scheda di Waveshare aggiunge da GPIO39 a GPIO44 per la scheda TF. Anche GPIO37 e GPIO38 dell'header restano liberi: ESP-IDF li elenca come TX e RX predefiniti di UART0 sull'ESP32-P4, la porta del log di avvio.
- **Sulla testa**, GPIO13 e GPIO14 sono pin dell'header uno accanto all'altro nello schema di Waveshare (`ESP32S3_1.3inch.pdf`, linkato dalla wiki di SpotPear). Lo schermo, l'IMU e la scheda TF usano altri pin, e GPIO43 e GPIO44 portano U0TXD e U0RXD al CH343P, la porta seriale USB della testa.

Controlla le etichette stampate sulle tue schede prima di collegare qualsiasi cosa: la disposizione degli header cambia tra una revisione e l'altra.

**Alimentazione: un cavo USB per scheda, massa condivisa, 3V3 non condiviso.** Ogni scheda riceve il suo cavo USB-C. La pancia si alimenta dalla sua porta "USB to UART", e la testa regola i propri 3,3 V con il suo ME6217C33M5G. Unire i due pin 3V3 legherebbe tra loro due regolatori separati, ognuno dei quali cercherebbe di mantenere la linea, e il pin 3V3 dell'header della pancia non è mai stato pensato per alimentare una seconda scheda. Il filo di massa è quello che conta: un segnale UART è una tensione misurata rispetto alla massa, quindi entrambe le schede hanno bisogno della stessa massa. Entrambi i chip usano logica a 3,3 V, quindi non serve un traslatore di livello.

### Il flusso dei dati

| Da              | A                           | Tramite                      | Cosa                                                            |
| --------------- | --------------------------- | ---------------------------- | --------------------------------------------------------------- |
| Microfoni       | Pancia (ES7210, Xiaozhi)    | I2S                          | La tua voce                                                     |
| Pancia          | Il tuo server (sul tuo PC)  | WebSocket, LAN               | Audio Opus in salita; audio Opus e testo di ritorno             |
| Il tuo server   | Claude                      | HTTPS, Anthropic SDK         | Ciò che hai detto, come testo; la risposta di Narsil di ritorno |
| Pancia          | Altoparlante (ES8311)       | I2S                          | La voce di Narsil                                               |
| ntfy            | Pancia                      | HTTPS                        | Gli avvisi di Narsil dal tuo computer                           |
| GitHub REST API | Pancia                      | HTTPS, token di sola lettura | Le tue pull request aperte                                      |
| Pancia          | Schermo della pancia (LVGL) | MIPI DSI                     | Avvisi e pull request                                           |
| Pancia          | Testa                       | UART, 3 fili                 | Posa e stato                                                    |
| Testa           | Prisma                      | Schermo ST7789               | La faccia di Narsil, specchiata                                 |

Il percorso della voce è l'unico che ha bisogno del tuo PC. Avvisi, pull request e faccia continuano a funzionare quando il server è spento.

### La distinta dei materiali

- 1 × Waveshare ESP32-P4-WIFI6-Touch-LCD-4.3 (la pancia).
- 1 × ESP32-S3-LCD-1.3-C, con il suo case e il cubo prismatico (la testa).
- Cavi Dupont femmina-femmina (se ne usano tre).
- 1 × altoparlante con spina GH1.25 a 2 pin, da 8 Ω 2 W come consiglia Waveshare. I microfoni sono già sulla pancia.
- 2 × cavi dati USB-C, uno per scheda.
- Un PC sulla stessa rete, con Docker, per il server vocale (guida 4).

Il firmware di entrambe le schede vive in un unico repository pubblico, `davshn/narsil-bot`: un fork di 78/xiaozhi-esp32 per la pancia, con il firmware della testa nella sua cartella `head/`.

## Come è stata chiesta all’IA

Il design è partito da un carrello della spesa. Il 2026-11-17 chi ha creato Narsil ha condiviso uno screenshot di un carrello di AliExpress con le due schede e un pacco di cavi Dupont, e ha descritto l'idea:

> va a ser la pantalla grande para una pantalla en la pansa que va a tener la informacion de las tareas que hace narsil y la cabeza va a ser una apntalla holografica que solo sea la cara de narsil

In italiano: "sarà lo schermo grande, per uno schermo nella pancia che avrà le informazioni sui compiti che fa Narsil, e la testa sarà uno schermo olografico che sia solo la faccia di Narsil".

Questo ha fissato i ruoli delle due schede prima di qualsiasi codice: il P4 con lo schermo grande è la pancia, l'S3 con il prisma è la faccia.

La domanda successiva dell'IA è stata come la testa avrebbe ottenuto i suoi dati: collegandosi alla rete da sola o ricevendoli dalla pancia. Chi ha creato Narsil ha risposto:

> Por cable desde la panza

In italiano: "Via cavo dalla pancia".

Quella risposta è la regola di "Perché la pancia fa tutta la parte di rete" qui sopra: una scheda possiede la rete e i segreti, l'altra si limita a disegnare. L'IA ha fatto le sue domande una alla volta, con le pagine di Waveshare e SpotPear come fonti, e ha registrato ogni risposta nel documento dei task del progetto come specifica numerata.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è la conversazione usata per progettare il bot.

> Voglio costruire un bot da scrivania con due schede ESP32: una Waveshare ESP32-P4-WIFI6-Touch-LCD-4.3 come corpo e una ESP32-S3-LCD-1.3-C (ST7789 240×240 sotto un cubo prismatico) come testa. Il corpo deve fare tutta la parte di rete e la testa deve solo disegnare una faccia che riceve via UART. Leggi le pagine e gli schemi ufficiali di Waveshare e SpotPear, poi proponi: il ruolo di ogni scheda, quali pin liberi dell'header usare per la UART su ciascun lato (evitando i pin che il supporto di scheda o la console di avvio usano già), come alimentare entrambe le schede e una distinta dei materiali. Cita la pagina da cui viene ogni pin, e fammi una domanda alla volta quando qualcosa è una vera scelta.

## Il codice minimo

Il cablaggio diventa codice in un solo punto su ogni scheda: la configurazione della UART. Questo è il lato della pancia, scritto per questa guida con il driver UART di ESP-IDF (`driver/uart.h`, le stesse chiamate dell'esempio `uart_echo` di ESP-IDF). Il lato della testa è uguale, con i suoi pin.

```c
#include "driver/uart.h"

#define HEAD_UART      UART_NUM_1
#define HEAD_UART_TX   4
#define HEAD_UART_RX   5
#define HEAD_UART_BAUD 115200

void head_link_init(void)
{
    const uart_config_t config = {
        .baud_rate = HEAD_UART_BAUD,
        .data_bits = UART_DATA_8_BITS,
        .parity = UART_PARITY_DISABLE,
        .stop_bits = UART_STOP_BITS_1,
        .flow_ctrl = UART_HW_FLOWCTRL_DISABLE,
        .source_clk = UART_SCLK_DEFAULT,
    };
    ESP_ERROR_CHECK(uart_driver_install(HEAD_UART, 1024, 0, 0, NULL, 0));
    ESP_ERROR_CHECK(uart_param_config(HEAD_UART, &config));
    ESP_ERROR_CHECK(uart_set_pin(HEAD_UART, HEAD_UART_TX, HEAD_UART_RX,
                                 UART_PIN_NO_CHANGE, UART_PIN_NO_CHANGE));
}
```

Un dettaglio è facile da perdere. Sull'ESP32-P4, i pin predefiniti di ESP-IDF per UART1 sono GPIO10 e GPIO11, e su questa scheda quei pin portano l'audio (word select e data in dell'I2S). `uart_set_pin` instrada invece UART1 su GPIO4 e GPIO5 attraverso la matrice GPIO, così i pin predefiniti non vengono mai toccati. Inviare è poi una sola chiamata, `uart_write_bytes(HEAD_UART, data, len)`; cosa va in `data` è la [guida 10](/it/bot/uart-protocol/).

## Errori comuni e come testarlo

- **TX su TX.** Se non arriva niente, scambia i due fili dati. Ogni TX va all'RX dell'altra scheda.
- **Nessun filo di massa.** Senza una massa comune il segnale non ha riferimento, e la testa legge spazzatura o niente.
- **Unire i pin 3V3.** Ogni scheda è alimentata dal suo cavo USB; lascia 3V3 scollegato.
- **Usare i pin della console.** GPIO37 e GPIO38 sulla pancia, e GPIO43 e GPIO44 sulla testa, sono UART0, collegati alla porta seriale USB di ogni scheda. I messaggi lì si mescolano con il log di avvio.
- **Cavi femmina su un header senza pin.** I cavi Dupont femmina-femmina hanno bisogno di pin maschi su entrambe le schede. Controlla che gli header delle tue schede abbiano i pin prima di pianificare il cablaggio.
- **Un cavo USB solo di ricarica.** Se Windows non mostra una nuova porta COM quando colleghi una scheda, prova un altro cavo (guida 2).

Per testare il collegamento prima che esista qualsiasi protocollo, flasha entrambe le schede con l'esempio `uart_echo` di ESP-IDF impostato su questi pin, oppure invia una riga dalla pancia e registra ciò che legge la testa con `uart_read_bytes`. Se il testo arriva intatto a 115200 baud, il cablaggio è giusto.

## Per andare oltre

- Lo schermo touch della pancia può fare di più che mostrare: un tocco può segnare un avviso come letto, cosa che la [guida 9](/it/bot/belly-ui/) costruisce con LVGL.
- Il QMI8658 della testa può capire quando qualcuno solleva il bot o lo tocca. La testa potrebbe rimandarlo indietro sul suo filo TX, ed è per questo che il collegamento ha due fili dati e non uno.
- Entrambe le schede hanno connettori per la batteria (MX1.25 sulla testa, un connettore per batteria al litio da 3,7 V sulla pancia). Il bot di questo percorso funziona via USB, il che mantiene semplice il progetto dell'alimentazione.
- La [pagina ESP-IDF di Waveshare per la pancia](https://docs.waveshare.com/ESP32-P4-WIFI6-Touch-LCD-4.3/ESP-IDF/) elenca progetti di esempio (strumenti I2C, Wi-Fi station, codec I2S, LVGL) utili per verificare ogni parte della scheda da sola.
