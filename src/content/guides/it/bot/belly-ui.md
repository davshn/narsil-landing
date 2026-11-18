---
title: Lo schermo della pancia con LVGL
description: 'Lo schermo di Narsil sulla pancia da 4,3 pollici: una striscia di stato, i suoi avvisi e le tue pull request, impostazioni salvate in NVS, e perché ogni chiamata prende il lock del display.'
route: bot
order: 9
updated: 2026-11-18
---

## Cosa fa

Di serie, Xiaozhi riempie lo schermo della pancia con la propria interfaccia: una barra di stato, una faccia emoji e il testo della conversazione. Questa guida la sostituisce con lo schermo di Narsil. In piedi sulla scrivania, lo schermo da 4,3 pollici mostra, dall'alto in basso:

- **Una striscia di stato**: l'ora, il livello di Narsil dal suo ultimo stato e quanti avvisi non hai ancora letto.
- **Gli avvisi di Narsil**, i più recenti in alto, ognuno con un bordo colorato per il suo tipo: verde quando Claude ha finito, giallo quando ha bisogno di te, rosso in caso di errore. Toccane uno e si attenua: è letto.
- **Le tue pull request**: quelle aperte che aspettano la tua revisione, come le trova la guida 8.
- **Una schermata delle impostazioni**, aperta con una pressione lunga sulla striscia, dove il topic ntfy e il token di GitHub si scrivono una volta e vengono salvati sulla scheda.

È qui che arrivano le guide 7 e 8. Chiamavano quattro funzioni, `ShowAlert`, `ShowStatus`, `ShowPullRequest` e `ShowGithubError`, e le promettevano qui. Xiaozhi continua a fare il suo lavoro vocale sotto: la wake word, l'ascolto e la voce continuano a funzionare mentre lo schermo di Narsil è acceso.

## Come funziona dentro

### LVGL, la versione che fissa Xiaozhi

Xiaozhi disegna con [LVGL](https://lvgl.io), la libreria grafica open source per schermi piccoli. Il suo `main/idf_component.yml` fissa `lvgl/lvgl: ~9.5.0` ed `esp_lvgl_port: ~2.9.0`, quindi tutto qui è l'API di LVGL 9, documentata su [docs.lvgl.io](https://docs.lvgl.io/9.5/). Il codice LVGL 8 che si trova online usa spesso nomi più vecchi (`lv_scr_act`, `lv_btn_create`); in LVGL 9 sono `lv_screen_active` e `lv_button_create`.

Un'interfaccia LVGL è un albero di oggetti. Uno **screen** è la radice, creato con `lv_obj_create(nullptr)` e mostrato con `lv_screen_load`. Dentro vanno i widget: una **label** mostra testo, una **list** (`lv_list_create`) è una colonna scorrevole dove `lv_list_add_button` aggiunge una riga toccabile e `lv_list_add_text` una semplice, una **text area** riceve testo digitato, e una **keyboard** scrive in una text area. Il layout viene da flex, la stessa idea del flexbox di CSS: `lv_obj_set_flex_flow(screen, LV_FLEX_FLOW_COLUMN)` impila i figli, e `lv_obj_set_flex_grow` divide l'altezza libera tra loro.

### La dimensione dello schermo

Il `config.h` della scheda in Xiaozhi imposta lo schermo da 4,3 pollici a `DISPLAY_WIDTH (480)` e `DISPLAY_HEIGHT (800)`: uno schermo verticale, largo 480 pixel. Quindi il layout è una sola colonna: una striscia corta in alto, poi gli avvisi con la maggior parte dell'altezza, poi le pull request. Le larghezze usano `lv_pct(100)`, così lo stesso codice si adatta alle altre dimensioni della famiglia di schede.

### Dove entra il nuovo schermo

La classe della scheda in `esp32-p4-wifi6-touch-lcd.cc` crea il suo display con `new MipiLcdDisplay(...)`, e l'`Application` di Xiaozhi chiama `display->SetupUI()` una volta all'avvio. `SetupUI` è virtuale (`main/display/display.h`), quindi il bot aggiunge una piccola classe, `NarsilDisplay`, che eredita da `MipiLcdDisplay` e la sovrascrive:

1. Chiama la `SetupUI` originale, così Xiaozhi costruisce la propria interfaccia come al solito.
2. Costruisce lo schermo di Narsil come **secondo** screen LVGL, con lo stesso font.
3. Carica quello screen quando il Wi-Fi è attivo.

Lo schermo di Xiaozhi non viene mai eliminato. Continua a ricevere il suo stato, le emozioni e il testo della chat, che finiscono semplicemente su uno screen che non viene mostrato. Per questo niente in Xiaozhi si rompe, e per questo il primo avvio funziona ancora: mentre la pancia è nella configurazione del Wi-Fi, il suo schermo resta visibile con le istruzioni dell'hotspot della guida 3, e lo schermo di Narsil prende il posto solo quando il Wi-Fi è connesso, nello stesso momento in cui parte `StartNtfy()`.

L'unica modifica al codice di Xiaozhi è nel file della scheda: `new MipiLcdDisplay(` diventa `new NarsilDisplay(`, con gli stessi argomenti. Il `main/CMakeLists.txt` di Xiaozhi compila ogni file `.cc` nella cartella della scheda (`file(GLOB BOARD_SOURCES ...)`), quindi il nuovo file va accanto al file della scheda e non richiede modifiche alla build.

### Il font

La `SetupUI` di Xiaozhi imposta il font del testo del suo tema sullo screen attivo, un font integrato che corrisponde alla lingua scelta al momento della build (`--language es-ES` nella guida 3). Il nuovo schermo lo rilegge con `lv_obj_get_style_text_font(lv_screen_active(), 0)` e lo imposta su se stesso. Così gli accenti e la "ñ" degli avvisi in spagnolo di Narsil si disegnano correttamente. Le emoji no: l'etichetta del livello di narsil-pet inizia con una stella, e lo schermo la salta.

### Il lock del display: la regola che conta di più

LVGL non è thread-safe. I suoi oggetti possono essere toccati da un solo task alla volta, e il task che li disegna, eseguito da `esp_lvgl_port`, li tocca di continuo. Lo stream ntfy della guida 7 e il polling di GitHub della guida 8 girano nei loro task FreeRTOS, quindi una loro chiamata che crea una riga mentre LVGL sta disegnando può corrompere la memoria e mandare in crash la scheda, a caso e di rado, che è il tipo di bug peggiore da trovare.

Xiaozhi risolve questo con un lock e una piccola classe guardia, entrambi in `main/display/display.h`. `LcdDisplay::Lock` chiama `lvgl_port_lock`, e `DisplayLockGuard` prende il lock nel suo costruttore e lo restituisce nel suo distruttore:

```cpp
DisplayLockGuard lock(Board::GetInstance().GetDisplay());
if (!lock) return;
// ... LVGL calls ...
```

La guardia aspetta fino a 30 secondi e scrive nel log "Failed to lock display" se non riesce a ottenere il lock; `if (!lock)` salta allora il disegno. I metodi di display di Xiaozhi usano la stessa guardia. Quindi ognuna delle quattro funzioni la prende prima della sua prima chiamata `lv_`, e la tiene solo per il disegno: l'analisi del JSON e l'invio alla testa avvengono fuori.

Le callback degli eventi (un tocco, un tasto) sono diverse: LVGL le esegue dentro il proprio task, con il lock già preso. Chiamano direttamente le funzioni `lv_`. Prendere la guardia anche lì funzionerebbe comunque, perché `esp_lvgl_port` crea il suo lock come mutex ricorsivo (`xSemaphoreCreateRecursiveMutex`), ma non serve.

### Avvisi, letti e non letti

`ShowAlert` aggiunge una riga con `lv_list_add_button`, la sposta in cima con `lv_obj_move_to_index(row, 0)` e disegna un bordo sinistro di 6 pixel nel colore dell'avviso. Il colore viene dal tag dell'avviso (guida 7) e riusa i colori di stato di narsil-pet da `hooks/sprite.ts`: `#22B573` per finito, `#F5B400` per in attesa e `#F0435A` per errore. Quando arriva una riga con testo sigillato (inizia con `narsil1:`, guida 7), la riga dice "(sealed)" invece di mostrare rumore; il tipo e il colore vengono comunque dal tag.

Ogni riga è non letta finché non viene toccata. Gli user data della riga (`lv_obj_set_user_data`) la segnano; una callback `LV_EVENT_CLICKED` toglie il segno, attenua la riga con `lv_obj_set_style_text_opa` e abbassa il conteggio dei non letti sulla striscia. La lista tiene gli ultimi 20 avvisi: quando ne arriva un 21°, la riga più vecchia, `lv_obj_get_child(alerts, -1)`, viene eliminata.

La riga mostra l'ora in cui l'avviso è arrivato sulla pancia. Xiaozhi imposta l'orologio dalla risposta del server al controllo OTA, e `main/ota.cc` aggiunge il `timezone_offset` del server prima di chiamare `settimeofday`. L'orologio contiene già l'ora locale, quindi lo schermo la formatta con `gmtime_r`, che non aggiunge un fuso orario suo.

### La striscia di stato e la testa

`ShowStatus` riceve il JSON `-estado` (guida 7). Legge `xp`, l'etichetta del livello di Narsil, per la striscia, e `art`, l'URL del suo disegno, che porta il suo stadio e la sua posa. Passa `art` a `HeadSetPoseFromArt`, il lato della pancia del collegamento UART della guida 10, che lo trasforma in un messaggio per la testa. Uno stato più vecchio dell'ultimo mostrato (il suo `time` è minore) viene ignorato, così una riconnessione non riporta mai Narsil indietro nel tempo. Uno stato sigillato non è JSON, quindi `cJSON_Parse` fallisce e la striscia e la testa tengono quello che avevano.

### Pull request

`ShowPullRequest` viene chiamata una volta per ogni risultato della ricerca, con `index` da 0. L'indice 0 inizia una nuova risposta, quindi prima svuota la lista con `lv_obj_clean`. La guida 8 non la chiama affatto quando la ricerca non restituisce elementi, quindi questa guida aggiunge `ClearPullRequests()`, che scrive "No reviews waiting"; una riga nel `PollPullRequests` della guida 8 la chiama quando `items` è vuoto. `ShowGithubError` sostituisce la lista con una riga che dice cosa fare: controllare il token su un `401`, aspettare su un `403` o `429`.

### La schermata delle impostazioni

Una pressione lunga sulla striscia (`LV_EVENT_LONG_PRESSED`, così un tocco di passaggio non la apre mai) carica la schermata delle impostazioni. Ha due text area di una riga, una per il topic ntfy e una per il token di GitHub, una tastiera e due pulsanti:

- La text area del token usa `lv_textarea_set_password_mode`, quindi ciò che scrivi si vede come puntini.
- Nessuno dei due campi viene riempito con il valore salvato: un segreto che non viene mai disegnato non può essere letto da sopra la tua spalla. Il placeholder dice "(saved)" quando la NVS ne contiene già uno.
- Un campo vuoto mantiene ciò che è salvato, così puoi cambiare il token senza riscrivere il topic.
- **Save and restart** scrive entrambi tramite la classe `Settings` di Xiaozhi, nel namespace `narsil` sotto le chiavi `ntfy_topic` e `gh_token`, le stesse che leggono le guide 7 e 8. `Settings` fa il commit nel suo distruttore (`nvs_commit`), quindi il salvataggio avviene nel suo blocco prima di `esp_restart()`. Il riavvio è il modo semplice per far leggere i nuovi valori ai task di ntfy e GitHub.

La guida 12 spiega cosa protegge la NVS e cosa no.

## Come è stata chiesta all’IA

Lo schermo della pancia è la prima cosa che chi ha creato Narsil ha descritto, prima di qualsiasi codice:

> va a ser la pantalla grande para una pantalla en la pansa que va a tener la informacion de las tareas que hace narsil

In italiano: "sarà lo schermo grande, per uno schermo nella pancia che avrà le informazioni sui compiti che fa Narsil".

Questo ha fissato a cosa serve lo schermo: il lavoro di Narsil, non un orologio o una dashboard generici. Gli avvisi della guida 7 e le pull request della guida 8 sono quelle informazioni, e questa guida è dove si incontrano.

Due cose sono state lasciate all'IA da scoprire, invece che a chi ha creato Narsil da decidere. La prima era come sostituire lo schermo di Xiaozhi senza rompere il suo lavoro vocale; l'IA ha letto `main/display/display.h`, `lcd_display.h` e il file della scheda, e ha scelto una sottoclasse che tiene vivo ma nascosto lo schermo di Xiaozhi, invece di eliminarlo o riscriverlo. La seconda era dove si scrivono i segreti. La specifica S6 diceva già che vivono nella NVS o nella configurazione locale, mai nel repository, quindi l'IA ha proposto una schermata delle impostazioni sulla pancia stessa, aperta con una pressione lunga sulla striscia perché un tocco di passaggio non la mostri mai.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è la conversazione usata per preparare il bot.

> Il mio fork di 78/xiaozhi-esp32 gira su una Waveshare ESP32-P4-WIFI6-Touch-LCD-4.3. Leggi `main/idf_component.yml` per la versione di LVGL, `main/display/display.h`, `main/display/lcd_display.h`, `main/settings.h` e il file della scheda in `main/boards/waveshare/esp32-p4-wifi6-touch-lcd/`. Poi scrivi una classe `NarsilDisplay` derivata da `MipiLcdDisplay` che mantenga la UI di Xiaozhi ma carichi un secondo screen LVGL tutto mio: una striscia di stato, una lista di avvisi dove un tocco segna una riga come letta, una lista di pull request e una schermata delle impostazioni che salvi due stringhe nella NVS tramite `Settings`. Ogni funzione chiamata da un altro task FreeRTOS deve prendere `DisplayLockGuard`. Usa solo l'API della versione di LVGL che hai trovato, e collega la documentazione di ogni widget.

## Il codice minimo

Due file accanto al file della scheda, in C++ come Xiaozhi (MIT, come gli esempi del sito). L'header:

```cpp
// narsil_display.h
#pragma once
#include "display/lcd_display.h"

class NarsilDisplay : public MipiLcdDisplay {
public:
    using MipiLcdDisplay::MipiLcdDisplay;
    void SetupUI() override;
};

void ShowNarsilScreen();
```

Lo schermo, `narsil_display.cc`:

```cpp
#include "narsil_display.h"

#include <cJSON.h>
#include <esp_system.h>
#include <cstdio>
#include <cstring>
#include <ctime>
#include <string>

#include "board.h"
#include "settings.h"

void HeadSetPoseFromArt(const char* art_url);

static lv_obj_t* main_screen;
static lv_obj_t* settings_screen;
static lv_obj_t* strip;
static lv_obj_t* alerts;
static lv_obj_t* pulls;
static lv_obj_t* topic_field;
static lv_obj_t* token_field;
static std::string level = "Narsil";
static int unread = 0;

static std::string Clock() {
    time_t now = time(nullptr);
    struct tm local;
    gmtime_r(&now, &local);
    char text[8];
    strftime(text, sizeof(text), "%H:%M", &local);
    return text;
}

static void UpdateStrip() {
    lv_label_set_text_fmt(strip, "%s   %s   %d unread", Clock().c_str(), level.c_str(), unread);
}

static lv_color_t TagColor(const char* tag) {
    if (strcmp(tag, "warning") == 0) return lv_color_hex(0xF0435A);
    if (strcmp(tag, "raising_hand") == 0) return lv_color_hex(0xF5B400);
    return lv_color_hex(0x22B573);
}

static void OnAlertTap(lv_event_t* e) {
    lv_obj_t* row = lv_event_get_target_obj(e);
    if (lv_obj_get_user_data(row) == nullptr) return;
    lv_obj_set_user_data(row, nullptr);
    lv_obj_set_style_text_opa(row, LV_OPA_50, 0);
    unread--;
    UpdateStrip();
}

void ShowAlert(const char* title, const char* text, const char* tag, long time) {
    (void)time;
    bool sealed = strncmp(text, "narsil1:", 8) == 0;
    std::string line = Clock() + "  " + title + "\n" + (sealed ? "(sealed)" : text);
    DisplayLockGuard lock(Board::GetInstance().GetDisplay());
    if (!lock) return;
    lv_obj_t* row = lv_list_add_button(alerts, nullptr, line.c_str());
    lv_obj_set_style_border_side(row, LV_BORDER_SIDE_LEFT, 0);
    lv_obj_set_style_border_width(row, 6, 0);
    lv_obj_set_style_border_color(row, TagColor(tag), 0);
    lv_obj_set_user_data(row, (void*)1);
    lv_obj_add_event_cb(row, OnAlertTap, LV_EVENT_CLICKED, nullptr);
    lv_obj_move_to_index(row, 0);
    unread++;
    if (lv_obj_get_child_count(alerts) > 20) {
        lv_obj_t* oldest = lv_obj_get_child(alerts, -1);
        if (lv_obj_get_user_data(oldest) != nullptr) unread--;
        lv_obj_delete(oldest);
    }
    UpdateStrip();
}

void ShowStatus(const char* state_json, long time) {
    static long last_time = 0;
    if (time < last_time) return;
    cJSON* root = cJSON_Parse(state_json);
    if (root == nullptr) return;
    last_time = time;
    const char* xp = cJSON_GetStringValue(cJSON_GetObjectItem(root, "xp"));
    const char* art = cJSON_GetStringValue(cJSON_GetObjectItem(root, "art"));
    if (art != nullptr) HeadSetPoseFromArt(art);
    if (xp != nullptr) {
        const char* space = strchr(xp, ' ');
        DisplayLockGuard lock(Board::GetInstance().GetDisplay());
        if (lock) {
            level = space ? space + 1 : xp;
            UpdateStrip();
        }
    }
    cJSON_Delete(root);
}

void ShowPullRequest(int index, const char* repo, int number, const char* title, const char* author) {
    char line[256];
    snprintf(line, sizeof(line), "%s #%d\n%s  @%s", repo, number, title ? title : "", author ? author : "");
    DisplayLockGuard lock(Board::GetInstance().GetDisplay());
    if (!lock) return;
    if (index == 0) lv_obj_clean(pulls);
    lv_list_add_button(pulls, nullptr, line);
}

void ClearPullRequests() {
    DisplayLockGuard lock(Board::GetInstance().GetDisplay());
    if (!lock) return;
    lv_obj_clean(pulls);
    lv_list_add_text(pulls, "No reviews waiting");
}

void ShowGithubError(int status) {
    const char* hint = status == 401 ? "check the token in settings"
                     : (status == 403 || status == 429) ? "rate limited, trying later"
                     : "no answer, trying later";
    char line[96];
    snprintf(line, sizeof(line), "GitHub %d: %s", status, hint);
    DisplayLockGuard lock(Board::GetInstance().GetDisplay());
    if (!lock) return;
    lv_obj_clean(pulls);
    lv_list_add_text(pulls, line);
}

static void OnSave(lv_event_t*) {
    {
        Settings settings("narsil", true);
        std::string topic = lv_textarea_get_text(topic_field);
        std::string token = lv_textarea_get_text(token_field);
        if (!topic.empty()) settings.SetString("ntfy_topic", topic);
        if (!token.empty()) settings.SetString("gh_token", token);
    }
    esp_restart();
}

static void OnOpenSettings(lv_event_t*) { lv_screen_load(settings_screen); }
static void OnBack(lv_event_t*) { lv_screen_load(main_screen); }
static void OnFocus(lv_event_t* e) {
    lv_keyboard_set_textarea((lv_obj_t*)lv_event_get_user_data(e), lv_event_get_target_obj(e));
}

static lv_obj_t* Field(lv_obj_t* parent, const char* name, const char* key) {
    Settings settings("narsil");
    std::string hint = std::string(name) + (settings.GetString(key).empty() ? "" : " (saved)");
    lv_obj_t* field = lv_textarea_create(parent);
    lv_textarea_set_one_line(field, true);
    lv_textarea_set_placeholder_text(field, hint.c_str());
    lv_obj_set_width(field, lv_pct(100));
    return field;
}

static lv_obj_t* Button(lv_obj_t* parent, const char* text, lv_event_cb_t cb) {
    lv_obj_t* button = lv_button_create(parent);
    lv_label_set_text(lv_label_create(button), text);
    lv_obj_add_event_cb(button, cb, LV_EVENT_CLICKED, nullptr);
    return button;
}

static lv_obj_t* Screen(const lv_font_t* font) {
    lv_obj_t* screen = lv_obj_create(nullptr);
    lv_obj_set_style_text_font(screen, font, 0);
    lv_obj_set_flex_flow(screen, LV_FLEX_FLOW_COLUMN);
    return screen;
}

void NarsilDisplay::SetupUI() {
    MipiLcdDisplay::SetupUI();
    DisplayLockGuard lock(this);
    const lv_font_t* font = lv_obj_get_style_text_font(lv_screen_active(), 0);

    main_screen = Screen(font);
    lv_obj_t* top = lv_button_create(main_screen);
    lv_obj_set_width(top, lv_pct(100));
    lv_obj_add_event_cb(top, OnOpenSettings, LV_EVENT_LONG_PRESSED, nullptr);
    strip = lv_label_create(top);
    alerts = lv_list_create(main_screen);
    lv_obj_set_width(alerts, lv_pct(100));
    lv_obj_set_flex_grow(alerts, 3);
    pulls = lv_list_create(main_screen);
    lv_obj_set_width(pulls, lv_pct(100));
    lv_obj_set_flex_grow(pulls, 2);
    UpdateStrip();

    settings_screen = Screen(font);
    topic_field = Field(settings_screen, "ntfy topic", "ntfy_topic");
    token_field = Field(settings_screen, "GitHub token", "gh_token");
    lv_textarea_set_password_mode(token_field, true);
    Button(settings_screen, "Save and restart", OnSave);
    Button(settings_screen, "Back", OnBack);
    lv_obj_t* keyboard = lv_keyboard_create(settings_screen);
    lv_keyboard_set_textarea(keyboard, topic_field);
    lv_obj_add_event_cb(topic_field, OnFocus, LV_EVENT_FOCUSED, keyboard);
    lv_obj_add_event_cb(token_field, OnFocus, LV_EVENT_FOCUSED, keyboard);
}

void ShowNarsilScreen() {
    DisplayLockGuard lock(Board::GetInstance().GetDisplay());
    if (lock) lv_screen_load(main_screen);
}
```

Chiama `ShowNarsilScreen()` dove viene chiamata `StartNtfy()`, quando il Wi-Fi è attivo. Nel `PollPullRequests` della guida 8, dopo `cJSON_GetObjectItem(root, "items")`, aggiungi `if (cJSON_GetArraySize(items) == 0) ClearPullRequests();`. L'orologio sulla striscia si aggiorna con ogni avviso e stato; un timer LVGL di un minuto (`lv_timer_create`) che chiama `UpdateStrip` lo tiene aggiornato tra l'uno e l'altro.

## Errori comuni e come testarlo

- **Chiamate LVGL senza il lock.** Funziona per ore e poi va in crash in una funzione di disegno. Ogni funzione chiamata dal task di ntfy o di GitHub prende `DisplayLockGuard` prima della sua prima chiamata `lv_`.
- **Codice LVGL 8.** `lv_scr_act`, `lv_btn_create` e `lv_obj_del` non esistono in LVGL 9. Usa i nomi della [documentazione di LVGL 9.5](https://docs.lvgl.io/9.5/).
- **Caricare lo schermo dentro `SetupUI`.** Le istruzioni di configurazione del Wi-Fi del primo avvio sono disegnate sullo schermo di Xiaozhi; carica quello di Narsil solo quando il Wi-Fi è attivo.
- **Accenti mancanti.** Se "ñ" o "á" si disegnano come quadratini, la lingua della build non ha un font latino. Compila con `--language es-ES` (guida 3).
- **Niente salvato.** `Settings` deve essere aperta con `read_write` impostato a `true`, altrimenti `SetString` scrive solo nel log "Namespace narsil is not open for writing".
- **Il token nel log.** Non stampare mai il valore della text area. I campi vengono svuotati dal riavvio.
- **Il file della scheda sbagliato.** Cambia solo `new MipiLcdDisplay(` in `new NarsilDisplay(` e aggiungi `#include "narsil_display.h"`. La guida 3 spiega perché la configurazione della scheda stessa resta com'è.

Per testare, compila e flasha la pancia (guide 2 e 3) e osserva il primo avvio: lo schermo di Xiaozhi mostra la configurazione del Wi-Fi, poi compare lo schermo di Narsil. Tieni premuta la striscia, scrivi un topic inventato come `narsil-0123456789abcdef0123` e un token di prova, salva: la pancia si riavvia e i placeholder dicono "(saved)". Poi scrivi allo stesso modo il tuo topic e il tuo token veri. Esegui `/narsil movil prueba` in Claude Code: compare in cima una riga con un bordo colorato, e il conteggio dei non letti sale; toccala e si attenua. Entro due minuti compaiono le pull request, oppure "No reviews waiting". Di' "Hi ESP" mentre lo schermo è acceso: Xiaozhi continua ad ascoltare e rispondere.

## Per andare oltre

- **Pagine invece di una colonna.** `lv_tabview_create` e `lv_tabview_add_tab` danno delle schede, per esempio una per gli avvisi e una per le pull request, con uno swipe tra loro.
- **Aprire una pull request.** Ogni risultato della ricerca ha `html_url`. Un tocco potrebbe mostrarlo come codice QR (LVGL ha `lv_qrcode` quando `LV_USE_QRCODE` è abilitato), da aprire sul telefono.
- **Cancellare dallo schermo.** Un pulsante "Forget" che chiama `Settings("narsil", true).EraseAll()` cancella il topic e il token; la guida 12 elenca quando lo vuoi.
- **Tema scuro.** Il nero e i colori tenui attirano meno l'attenzione su una scrivania di notte, e la testa è già nera per i motivi della [guida 11](/it/bot/holographic-head/).
- La posa che `ShowStatus` passa avanti viene trasformata in un messaggio UART nella [guida 10](/it/bot/uart-protocol/).
