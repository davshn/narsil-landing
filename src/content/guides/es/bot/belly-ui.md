---
title: La pantalla de la panza con LVGL
description: 'La pantalla propia de Narsil en la panza de 4,3 pulgadas: una franja de estado, sus avisos y tus pull requests, una pantalla de ajustes que guarda en la NVS, y el bloqueo de pantalla de Xiaozhi.'
route: bot
order: 9
updated: 2026-11-18
---

## Qué hace

De fábrica, Xiaozhi llena la pantalla de la panza con su propia interfaz: una barra de estado, una cara de emoji y el texto de la conversación. Esta guía la reemplaza por la pantalla de Narsil. De pie sobre el escritorio, la pantalla de 4,3 pulgadas muestra, de arriba abajo:

- **Una franja de estado**: la hora, el nivel de Narsil según su último estado, y cuántos avisos aún no has leído.
- **Los avisos de Narsil**, los más nuevos primero, cada uno con un borde de color según su tipo: verde cuando Claude terminó, amarillo cuando te necesita, rojo ante un error. Tócalo y se atenúa: está leído.
- **Tus pull requests**: los abiertos que esperan tu revisión, tal como los encuentra la guía 8.
- **Una pantalla de ajustes**, que se abre con una pulsación larga sobre la franja, donde el tema de ntfy y el token de GitHub se escriben una vez y se guardan en la placa.

Aquí es donde aterrizan las guías 7 y 8. Llamaban a cuatro funciones, `ShowAlert`, `ShowStatus`, `ShowPullRequest` y `ShowGithubError`, y las prometían para aquí. Xiaozhi sigue haciendo su trabajo de voz por debajo: la palabra de activación, la escucha y el habla siguen funcionando mientras la pantalla de Narsil está encendida.

## Cómo funciona por dentro

### LVGL, la versión que fija Xiaozhi

Xiaozhi dibuja con [LVGL](https://lvgl.io), la biblioteca gráfica de código abierto para pantallas pequeñas. Su `main/idf_component.yml` fija `lvgl/lvgl: ~9.5.0` y `esp_lvgl_port: ~2.9.0`, así que todo lo de aquí es la API de LVGL 9, documentada en [docs.lvgl.io](https://docs.lvgl.io/9.5/). El código de LVGL 8 que se encuentra en internet suele usar nombres antiguos (`lv_scr_act`, `lv_btn_create`); en LVGL 9 son `lv_screen_active` y `lv_button_create`.

Una interfaz de LVGL es un árbol de objetos. Una **pantalla** es la raíz, se crea con `lv_obj_create(nullptr)` y se muestra con `lv_screen_load`. Dentro van los widgets: una **etiqueta** muestra texto, una **lista** (`lv_list_create`) es una columna con desplazamiento donde `lv_list_add_button` añade una fila que se puede tocar y `lv_list_add_text` una simple, un **área de texto** recibe texto escrito, y un **teclado** escribe en un área de texto. La disposición viene de flex, la misma idea que el flexbox de CSS: `lv_obj_set_flex_flow(screen, LV_FLEX_FLOW_COLUMN)` apila los hijos, y `lv_obj_set_flex_grow` reparte la altura libre entre ellos.

### El tamaño de la pantalla

El `config.h` de la placa en Xiaozhi fija la pantalla de 4,3 pulgadas en `DISPLAY_WIDTH (480)` y `DISPLAY_HEIGHT (800)`: una pantalla vertical, de 480 píxeles de ancho. Así que la disposición es una columna: una franja corta arriba, después los avisos con la mayor parte de la altura, y después los pull requests. Los anchos usan `lv_pct(100)`, así que el mismo código encaja en los otros tamaños de la familia de placas.

### Dónde entra la nueva pantalla

La clase de la placa en `esp32-p4-wifi6-touch-lcd.cc` crea su pantalla con `new MipiLcdDisplay(...)`, y el `Application` de Xiaozhi llama a `display->SetupUI()` una vez al arrancar. `SetupUI` es virtual (`main/display/display.h`), así que el bot añade una clase pequeña, `NarsilDisplay`, que hereda de `MipiLcdDisplay` y lo sobrescribe:

1. Llama al `SetupUI` original, así que Xiaozhi construye su propia interfaz como siempre.
2. Construye la pantalla de Narsil como una **segunda** pantalla de LVGL, con la misma fuente.
3. Carga esa pantalla cuando el Wi-Fi está conectado.

La pantalla propia de Xiaozhi nunca se borra. Sigue recibiendo su estado, sus emociones y el texto del chat, que simplemente caen en una pantalla que no se muestra. Por eso no se rompe nada en Xiaozhi, y por eso el primer arranque sigue funcionando: mientras la panza está en la configuración del Wi-Fi, su propia pantalla sigue visible con las instrucciones del punto de acceso de la guía 3, y la pantalla de Narsil solo toma el control una vez que el Wi-Fi está conectado, en el mismo momento en que arranca `StartNtfy()`.

El único cambio en el código de Xiaozhi está en el archivo de la placa: `new MipiLcdDisplay(` pasa a ser `new NarsilDisplay(`, con los mismos argumentos. El `main/CMakeLists.txt` de Xiaozhi compila cada archivo `.cc` de la carpeta de la placa (`file(GLOB BOARD_SOURCES ...)`), así que el archivo nuevo va junto al archivo de la placa y no necesita ningún cambio en la compilación.

### La fuente

El `SetupUI` de Xiaozhi pone la fuente de texto de su tema en la pantalla activa, una fuente integrada que corresponde al idioma elegido al compilar (`--language es-ES` en la guía 3). La nueva pantalla la lee con `lv_obj_get_style_text_font(lv_screen_active(), 0)` y se la pone a sí misma. Así, los acentos y la "ñ" de los avisos en español de Narsil se dibujan bien. Los emoji no: la etiqueta de nivel de narsil-pet empieza con una estrella, y la pantalla la omite.

### El bloqueo de pantalla: la regla que más importa

LVGL no es seguro entre hilos. Sus objetos solo los puede tocar una tarea a la vez, y la tarea que los dibuja, que ejecuta `esp_lvgl_port`, los toca todo el tiempo. El stream de ntfy de la guía 7 y la consulta a GitHub de la guía 8 corren en sus propias tareas de FreeRTOS, así que una llamada desde ellas que crea una fila mientras LVGL está dibujando puede corromper la memoria y colgar la placa, al azar y pocas veces, que es el peor tipo de error para encontrar.

Xiaozhi lo resuelve con un bloqueo y una pequeña clase guardiana, ambos en `main/display/display.h`. `LcdDisplay::Lock` llama a `lvgl_port_lock`, y `DisplayLockGuard` toma el bloqueo en su constructor y lo devuelve en su destructor:

```cpp
DisplayLockGuard lock(Board::GetInstance().GetDisplay());
if (!lock) return;
// ... LVGL calls ...
```

El guardián espera hasta 30 segundos y escribe "Failed to lock display" en el log si no consigue el bloqueo; `if (!lock)` entonces se salta el dibujo. Los métodos de pantalla propios de Xiaozhi usan el mismo guardián. Así que cada una de las cuatro funciones lo toma antes de su primera llamada `lv_`, y lo mantiene solo durante el dibujo: analizar el JSON y enviar a la cabeza ocurren fuera.

Los callbacks de eventos (un toque, una tecla) son distintos: LVGL los ejecuta dentro de su propia tarea, con el bloqueo ya tomado. Llaman directamente a las funciones `lv_`. Tomar el guardián también ahí seguiría funcionando, porque `esp_lvgl_port` crea su bloqueo como un mutex recursivo (`xSemaphoreCreateRecursiveMutex`), pero no hace falta.

### Avisos, leídos y sin leer

`ShowAlert` añade una fila con `lv_list_add_button`, la mueve arriba del todo con `lv_obj_move_to_index(row, 0)`, y dibuja un borde izquierdo de 6 píxeles con el color del aviso. El color sale de la etiqueta del aviso (guía 7) y reutiliza los colores de estado propios de narsil-pet de `hooks/sprite.ts`: `#22B573` para terminado, `#F5B400` para en espera y `#F0435A` para error. Cuando llega una fila con texto sellado (empieza con `narsil1:`, guía 7), la fila dice "(sealed)" en lugar de ruido; el tipo y el color siguen saliendo de la etiqueta.

Cada fila está sin leer hasta que se toca. Los datos de usuario de la fila (`lv_obj_set_user_data`) la marcan; un callback de `LV_EVENT_CLICKED` borra la marca, atenúa la fila con `lv_obj_set_style_text_opa`, y baja la cuenta de no leídos en la franja. La lista guarda los últimos 20 avisos: cuando llega el número 21, se borra la fila más antigua, `lv_obj_get_child(alerts, -1)`.

La fila muestra la hora a la que el aviso llegó a la panza. Xiaozhi pone el reloj en hora con la respuesta del servidor a la comprobación OTA, y `main/ota.cc` suma el `timezone_offset` del servidor antes de llamar a `settimeofday`. El reloj ya tiene la hora local, así que la pantalla la formatea con `gmtime_r`, que no añade ninguna zona horaria propia.

### La franja de estado y la cabeza

`ShowStatus` recibe el JSON de `-estado` (guía 7). Lee `xp`, la etiqueta de nivel de Narsil, para la franja, y `art`, la URL de su dibujo, que lleva su etapa y su pose. Pasa `art` a `HeadSetPoseFromArt`, el lado de la panza del enlace UART de la guía 10, que lo convierte en un mensaje para la cabeza. Un estado más antiguo que el último mostrado (su `time` es menor) se ignora, así que una reconexión nunca hace retroceder a Narsil en el tiempo. Un estado sellado no es JSON, así que `cJSON_Parse` falla y la franja y la cabeza conservan lo que tenían.

### Pull requests

`ShowPullRequest` se llama una vez por resultado de búsqueda, con `index` desde 0. El índice 0 empieza una respuesta nueva, así que primero vacía la lista con `lv_obj_clean`. La guía 8 no la llama en absoluto cuando la búsqueda no devuelve elementos, así que esta guía añade `ClearPullRequests()`, que escribe "No reviews waiting"; una línea en el `PollPullRequests` de la guía 8 la llama cuando `items` está vacío. `ShowGithubError` reemplaza la lista por una línea que dice qué hacer: revisar el token ante un `401`, esperar ante un `403` o un `429`.

### La pantalla de ajustes

Una pulsación larga sobre la franja (`LV_EVENT_LONG_PRESSED`, así que un toque de paso nunca la abre) carga la pantalla de ajustes. Tiene dos áreas de texto de una línea, una para el tema de ntfy y otra para el token de GitHub, un teclado y dos botones:

- El área de texto del token usa `lv_textarea_set_password_mode`, así que lo que escribes aparece como puntos.
- Ningún campo se rellena con el valor guardado: un secreto que nunca se dibuja no se puede leer por encima de tu hombro. El texto de ejemplo dice "(saved)" cuando la NVS ya guarda uno.
- Un campo vacío conserva lo guardado, así que puedes cambiar el token sin volver a escribir el tema.
- **Save and restart** escribe los dos mediante la clase `Settings` de Xiaozhi, en el espacio de nombres `narsil` con las claves `ntfy_topic` y `gh_token`, las mismas que leen las guías 7 y 8. `Settings` confirma los cambios en su destructor (`nvs_commit`), así que el guardado ocurre en su propio bloque antes de `esp_restart()`. El reinicio es la forma sencilla de hacer que las tareas de ntfy y de GitHub lean los valores nuevos.

La guía 12 explica qué protege la NVS y qué no.

## Constrúyelo con Claude

Pídele a Claude una clase `NarsilDisplay` que conserve la interfaz de Xiaozhi y cargue una segunda pantalla de LVGL propia de Narsil. La idea que debe acertar es el bloqueo de pantalla: cada función llamada desde la tarea de ntfy o de GitHub toma `DisplayLockGuard` antes de su primera llamada `lv_`.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es la conversación con la que se construyó el bot.

> Mi fork de 78/xiaozhi-esp32 corre en una Waveshare ESP32-P4-WIFI6-Touch-LCD-4.3. Lee `main/idf_component.yml` para ver la versión de LVGL, `main/display/display.h`, `main/display/lcd_display.h`, `main/settings.h` y el archivo de la placa en `main/boards/waveshare/esp32-p4-wifi6-touch-lcd/`. Después escribe una clase `NarsilDisplay` derivada de `MipiLcdDisplay` que conserve la interfaz de Xiaozhi pero cargue una segunda pantalla de LVGL propia: una franja de estado, una lista de avisos donde un toque marca una fila como leída, una lista de pull requests, y una pantalla de ajustes que guarde dos cadenas en la NVS mediante `Settings`. Cada función llamada desde otra tarea de FreeRTOS debe tomar `DisplayLockGuard`. Usa solo la API de la versión de LVGL que encontraste, y enlaza la documentación de cada widget.

### Qué revisar en la respuesta de Claude

1. Usa los nombres de LVGL 9 de la versión que fija Xiaozhi (`~9.5.0`), como `lv_screen_active` y `lv_button_create`, nunca `lv_scr_act`, `lv_btn_create` ni `lv_obj_del`.
2. `ShowAlert`, `ShowStatus`, `ShowPullRequest` y `ShowGithubError` toman `DisplayLockGuard` y se saltan el dibujo cuando no pueden obtenerlo. Leer el JSON y enviar a la cabeza ocurren fuera del bloqueo.
3. `SetupUI` llama primero a la original y construye la pantalla de Narsil como una segunda pantalla. Esa pantalla se carga cuando el Wi-Fi está listo, no dentro de `SetupUI`, así que el primer arranque sigue mostrando la configuración del Wi-Fi.
4. El aviso más nuevo va arriba, la lista guarda los últimos 20, y un toque atenúa una fila y baja el contador de no leídos. Un estado cuyo `time` es anterior al último mostrado se ignora.
5. La pantalla de ajustes se abre con una pulsación larga, muestra el token como puntos, nunca rellena un campo con el valor guardado y nunca lo escribe en el log. Guarda mediante `Settings` abierto con `read_write` en `true`, en el espacio de nombres `narsil` bajo `ntfy_topic` y `gh_token`, nunca en el código.

Si una comprobación falla, dile a Claude lo que ves: "la placa funciona durante horas y luego se cae en una función de dibujo".

### Cómo lo pidió el autor

La pantalla de la panza es lo primero que describió quien creó Narsil, antes de cualquier código:

> va a ser la pantalla grande para una pantalla en la pansa que va a tener la informacion de las tareas que hace narsil

Eso fijó para qué sirve la pantalla: el trabajo de Narsil, no un reloj ni un panel general. Los avisos de la guía 7 y los pull requests de la guía 8 son esa información, y esta guía es donde se encuentran.

Dos cosas le tocaba a la IA averiguarlas, no a quien creó Narsil decidirlas. La primera era cómo reemplazar la pantalla de Xiaozhi sin romper su trabajo de voz; la IA leyó `main/display/display.h`, `lcd_display.h` y el archivo de la placa, y eligió una subclase que mantiene viva pero oculta la pantalla de Xiaozhi en lugar de borrarla o reescribirla. La segunda era dónde se escriben los secretos. La especificación S6 ya decía que viven en la NVS o en la configuración local, nunca en el repositorio, así que la IA propuso una pantalla de ajustes en la propia panza, que se abre con una pulsación larga sobre la franja para que un toque de paso nunca la muestre.

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Dos archivos junto al archivo de la placa, en C++ como Xiaozhi (MIT, como los ejemplos propios del sitio). La cabecera:

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

La pantalla, `narsil_display.cc`:

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

Llama a `ShowNarsilScreen()` donde se llama a `StartNtfy()`, una vez que el Wi-Fi está conectado. En el `PollPullRequests` de la guía 8, después de `cJSON_GetObjectItem(root, "items")`, añade `if (cJSON_GetArraySize(items) == 0) ClearPullRequests();`. El reloj de la franja se actualiza con cada aviso y cada estado; un temporizador de LVGL de un minuto (`lv_timer_create`) que llame a `UpdateStrip` lo mantiene al día entre ellos.

## Errores comunes y cómo probarlo

- **Llamadas a LVGL sin el bloqueo.** Funciona durante horas y después se cuelga en una función de dibujo. Cada función llamada desde la tarea de ntfy o de GitHub toma `DisplayLockGuard` antes de su primera llamada `lv_`.
- **Código de LVGL 8.** `lv_scr_act`, `lv_btn_create` y `lv_obj_del` no existen en LVGL 9. Usa los nombres de la [documentación de LVGL 9.5](https://docs.lvgl.io/9.5/).
- **Cargar la pantalla dentro de `SetupUI`.** Las instrucciones de configuración del Wi-Fi del primer arranque se dibujan en la pantalla de Xiaozhi; carga la de Narsil solo una vez que el Wi-Fi está conectado.
- **Faltan los acentos.** Si la "ñ" o la "á" se dibujan como cuadros, el idioma de la compilación no tiene fuente latina. Compila con `--language es-ES` (guía 3).
- **No se guarda nada.** `Settings` debe abrirse con `read_write` en `true`, o `SetString` solo escribe en el log "Namespace narsil is not open for writing".
- **El token en el log.** Nunca imprimas el valor del área de texto. El reinicio vacía los campos.
- **El archivo de placa equivocado.** Cambia solo `new MipiLcdDisplay(` por `new NarsilDisplay(` y añade `#include "narsil_display.h"`. La guía 3 explica por qué la configuración de la placa en sí se queda como está.

Para probarlo, compila y flashea la panza (guías 2 y 3) y observa el primer arranque: la pantalla de Xiaozhi muestra la configuración del Wi-Fi, y después aparece la pantalla de Narsil. Haz una pulsación larga sobre la franja, escribe un tema inventado como `narsil-0123456789abcdef0123` y un token de prueba, y guarda: la panza se reinicia y los textos de ejemplo dicen "(saved)". Después escribe tu tema y tu token reales de la misma forma. Ejecuta `/narsil movil prueba` en Claude Code: aparece una fila arriba con un borde de color, y la cuenta de no leídos sube; tócala y se atenúa. En menos de dos minutos aparecen los pull requests, o "No reviews waiting". Di "Hi ESP" con la pantalla encendida: Xiaozhi sigue escuchando y respondiendo.

## Para ir más lejos

- **Páginas en lugar de una columna.** `lv_tabview_create` y `lv_tabview_add_tab` dan pestañas, por ejemplo una para los avisos y otra para los pull requests, con un deslizamiento entre ellas.
- **Abrir un pull request.** Cada resultado de búsqueda tiene `html_url`. Un toque podría mostrarlo como código QR (LVGL tiene `lv_qrcode` cuando `LV_USE_QRCODE` está activado), para abrirlo en el teléfono.
- **Borrar desde la pantalla.** Un botón "Forget" que llame a `Settings("narsil", true).EraseAll()` borra el tema y el token; la guía 12 lista cuándo lo quieres.
- **Tema oscuro.** El negro y los colores tenues llaman menos la atención en un escritorio de noche, y la cabeza ya es negra por las razones de la [guía 11](/es/bot/holographic-head/).
- La pose que pasa `ShowStatus` se convierte en un mensaje UART en la [guía 10](/es/bot/uart-protocol/).
