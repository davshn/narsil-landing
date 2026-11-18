---
title: The belly screen with LVGL
description: "Narsil's own screen on the 4.3-inch belly: a status strip, her alerts and your pull requests, a settings screen that saves to NVS, and why every call takes Xiaozhi's display lock."
route: bot
order: 9
updated: 2026-11-18
---

## What it does

Out of the box, Xiaozhi fills the belly's screen with its own interface: a status bar, an emoji face and the text of the conversation. This guide replaces it with Narsil's screen. Standing upright on the desk, the 4.3-inch screen shows, from top to bottom:

- **A status strip**: the time, Narsil's level from her last status, and how many alerts you have not read yet.
- **Narsil's alerts**, newest first, each with a colored edge for its kind: green when Claude is done, yellow when it needs you, red on an error. Tap one and it dims: it is read.
- **Your pull requests**: the open ones that wait for your review, as guide 8 finds them.
- **A settings screen**, opened with a long press on the strip, where the ntfy topic and the GitHub token are typed once and saved on the board.

This is where guides 7 and 8 land. They called four functions, `ShowAlert`, `ShowStatus`, `ShowPullRequest` and `ShowGithubError`, and promised them here. Xiaozhi keeps doing its voice work underneath: the wake word, listening and speaking all keep working while Narsil's screen is on.

## How it works inside

### LVGL, the version Xiaozhi pins

Xiaozhi draws with [LVGL](https://lvgl.io), the open-source graphics library for small screens. Its `main/idf_component.yml` pins `lvgl/lvgl: ~9.5.0` and `esp_lvgl_port: ~2.9.0`, so everything here is the LVGL 9 API, documented at [docs.lvgl.io](https://docs.lvgl.io/9.5/). LVGL 8 code found online often uses older names (`lv_scr_act`, `lv_btn_create`); in LVGL 9 they are `lv_screen_active` and `lv_button_create`.

An LVGL interface is a tree of objects. A **screen** is the root, created with `lv_obj_create(nullptr)` and shown with `lv_screen_load`. Inside it go widgets: a **label** shows text, a **list** (`lv_list_create`) is a scrolling column where `lv_list_add_button` adds a tappable row and `lv_list_add_text` a plain one, a **text area** takes typed text, and a **keyboard** types into a text area. Layout comes from flex, the same idea as CSS flexbox: `lv_obj_set_flex_flow(screen, LV_FLEX_FLOW_COLUMN)` stacks the children, and `lv_obj_set_flex_grow` shares the free height between them.

### The screen size

The board's `config.h` in Xiaozhi sets the 4.3-inch screen to `DISPLAY_WIDTH (480)` and `DISPLAY_HEIGHT (800)`: a portrait screen, 480 pixels wide. So the layout is one column: a short strip on top, then the alerts with most of the height, then the pull requests. Widths use `lv_pct(100)`, so the same code fits the other sizes of the board family.

### Where the new screen comes in

The board class in `esp32-p4-wifi6-touch-lcd.cc` creates its display with `new MipiLcdDisplay(...)`, and Xiaozhi's `Application` calls `display->SetupUI()` once at start. `SetupUI` is virtual (`main/display/display.h`), so the bot adds a small class, `NarsilDisplay`, that inherits from `MipiLcdDisplay` and overrides it:

1. It calls the original `SetupUI`, so Xiaozhi builds its own interface as usual.
2. It builds Narsil's screen as a **second** LVGL screen, with the same font.
3. It loads that screen when Wi-Fi is up.

Xiaozhi's own screen is never deleted. It keeps receiving its status, emotions and chat text, which simply land on a screen that is not shown. That is why nothing in Xiaozhi breaks, and why the first boot still works: while the belly is in Wi-Fi setup, its own screen stays visible with the hotspot instructions of guide 3, and Narsil's screen only takes over once Wi-Fi is connected, at the same moment `StartNtfy()` starts.

The one change to Xiaozhi's code is in the board file: `new MipiLcdDisplay(` becomes `new NarsilDisplay(`, with the same arguments. Xiaozhi's `main/CMakeLists.txt` compiles every `.cc` file in the board's folder (`file(GLOB BOARD_SOURCES ...)`), so the new file goes next to the board file and needs no build change.

### The font

Xiaozhi's `SetupUI` sets its theme's text font on the active screen, a built-in font that matches the language chosen at build time (`--language es-ES` in guide 3). The new screen reads it back with `lv_obj_get_style_text_font(lv_screen_active(), 0)` and sets it on itself. So accents and the "ñ" of Narsil's Spanish alerts draw correctly. Emoji do not: narsil-pet's level label starts with a star, and the screen skips it.

### The display lock: the rule that matters most

LVGL is not thread-safe. Its objects can only be touched by one task at a time, and the task that draws them, run by `esp_lvgl_port`, touches them all the time. The ntfy stream of guide 7 and the GitHub poll of guide 8 run in their own FreeRTOS tasks, so a call from them that creates a row while LVGL is drawing can corrupt memory and crash the board, at random and rarely, which is the worst kind of bug to find.

Xiaozhi solves this with a lock and a small guard class, both in `main/display/display.h`. `LcdDisplay::Lock` calls `lvgl_port_lock`, and `DisplayLockGuard` takes the lock in its constructor and gives it back in its destructor:

```cpp
DisplayLockGuard lock(Board::GetInstance().GetDisplay());
if (!lock) return;
// ... LVGL calls ...
```

The guard waits up to 30 seconds and logs "Failed to lock display" if it cannot get the lock; `if (!lock)` then skips the drawing. Xiaozhi's own display methods use the same guard. So every one of the four functions takes it before its first `lv_` call, and holds it only for the drawing: parsing JSON and sending to the head happen outside.

Event callbacks (a tap, a key) are different: LVGL runs them inside its own task, with the lock already held. They call `lv_` functions directly. Taking the guard there too would still work, because `esp_lvgl_port` creates its lock as a recursive mutex (`xSemaphoreCreateRecursiveMutex`), but it is not needed.

### Alerts, read and unread

`ShowAlert` adds a row with `lv_list_add_button`, moves it to the top with `lv_obj_move_to_index(row, 0)`, and draws a 6-pixel left border in the alert's color. The color comes from the alert's tag (guide 7) and reuses narsil-pet's own state colors from `hooks/sprite.ts`: `#22B573` for done, `#F5B400` for waiting and `#F0435A` for error. When a row arrives with sealed text (it starts with `narsil1:`, guide 7), the row says "(sealed)" instead of noise; the kind and the color still come from the tag.

Each row is unread until tapped. The row's user data (`lv_obj_set_user_data`) marks it; an `LV_EVENT_CLICKED` callback clears the mark, dims the row with `lv_obj_set_style_text_opa`, and lowers the unread count on the strip. The list keeps the last 20 alerts: when a 21st arrives, the oldest row, `lv_obj_get_child(alerts, -1)`, is deleted.

The row shows the time the alert arrived on the belly. Xiaozhi sets the clock from the server's answer to the OTA check, and `main/ota.cc` adds the server's `timezone_offset` before calling `settimeofday`. The clock already holds local time, so the screen formats it with `gmtime_r`, which adds no time zone of its own.

### The status strip and the head

`ShowStatus` receives the `-estado` JSON (guide 7). It reads `xp`, Narsil's level label, for the strip, and `art`, the URL of her drawing, which carries her stage and her pose. It passes `art` to `HeadSetPoseFromArt`, the belly's side of the UART link in guide 10, which turns it into a message for the head. A status older than the last one shown (its `time` is smaller) is ignored, so a reconnect never moves Narsil back in time. A sealed status is not JSON, so `cJSON_Parse` fails and the strip and the head keep what they had.

### Pull requests

`ShowPullRequest` is called once per search result, with `index` from 0. Index 0 starts a new answer, so it clears the list with `lv_obj_clean` first. Guide 8 does not call it at all when the search returns no items, so this guide adds `ClearPullRequests()`, which writes "No reviews waiting"; one line in guide 8's `PollPullRequests` calls it when `items` is empty. `ShowGithubError` replaces the list with one line that says what to do: check the token on a `401`, wait on a `403` or `429`.

### The settings screen

A long press on the strip (`LV_EVENT_LONG_PRESSED`, so a passing tap never opens it) loads the settings screen. It has two one-line text areas, one for the ntfy topic and one for the GitHub token, a keyboard, and two buttons:

- The token's text area uses `lv_textarea_set_password_mode`, so what you type shows as dots.
- Neither field is filled with the saved value: a secret that is never drawn cannot be read over your shoulder. The placeholder says "(saved)" when NVS already holds one.
- An empty field keeps what is saved, so you can change the token without typing the topic again.
- **Save and restart** writes both through Xiaozhi's `Settings` class, in the namespace `narsil` under the keys `ntfy_topic` and `gh_token`, the same ones guides 7 and 8 read. `Settings` commits in its destructor (`nvs_commit`), so the save happens in its own block before `esp_restart()`. The restart is the simple way to make the ntfy and GitHub tasks read the new values.

Guide 12 explains what NVS protects and what it does not.

## How it was asked of the AI

The belly screen is the first thing the author described, before any code:

> va a ser la pantalla grande para una pantalla en la pansa que va a tener la informacion de las tareas que hace narsil

In English: "it's going to be the big screen, for a screen in the belly that will have the information about the tasks Narsil does".

That set what the screen is for: Narsil's work, not a general clock or dashboard. The alerts of guide 7 and the pull requests of guide 8 are that information, and this guide is where they meet.

Two things were left to the AI to find out rather than to the author to decide. The first was how to replace Xiaozhi's screen without breaking its voice work; the AI read `main/display/display.h`, `lcd_display.h` and the board file, and chose a subclass that keeps Xiaozhi's screen alive but hidden over deleting or rewriting it. The second was where the secrets are typed. Spec S6 already said they live in NVS or local configuration, never in the repository, so the AI proposed a settings screen on the belly itself, opened with a long press on the strip so that a passing tap never shows it.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the conversation used to build the bot.

> My fork of 78/xiaozhi-esp32 runs on a Waveshare ESP32-P4-WIFI6-Touch-LCD-4.3. Read `main/idf_component.yml` for the LVGL version, `main/display/display.h`, `main/display/lcd_display.h`, `main/settings.h` and the board file in `main/boards/waveshare/esp32-p4-wifi6-touch-lcd/`. Then write a `NarsilDisplay` class derived from `MipiLcdDisplay` that keeps Xiaozhi's UI but loads a second LVGL screen of my own: a status strip, a list of alerts where a tap marks a row as read, a list of pull requests, and a settings screen that saves two strings to NVS through `Settings`. Every function called from another FreeRTOS task must take `DisplayLockGuard`. Use only the API of the LVGL version you found, and link the docs for each widget.

## The minimal code

Two files next to the board file, in C++ like Xiaozhi (MIT, like the site's own examples). The header:

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

The screen, `narsil_display.cc`:

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

Call `ShowNarsilScreen()` where `StartNtfy()` is called, once Wi-Fi is up. In guide 8's `PollPullRequests`, after `cJSON_GetObjectItem(root, "items")`, add `if (cJSON_GetArraySize(items) == 0) ClearPullRequests();`. The clock on the strip refreshes with each alert and status; a one-minute LVGL timer (`lv_timer_create`) calling `UpdateStrip` keeps it current between them.

## Common mistakes and how to test it

- **LVGL calls without the lock.** It works for hours and then crashes in a draw function. Every function called from the ntfy or GitHub task takes `DisplayLockGuard` before its first `lv_` call.
- **LVGL 8 code.** `lv_scr_act`, `lv_btn_create` and `lv_obj_del` do not exist in LVGL 9. Use the names from the [LVGL 9.5 docs](https://docs.lvgl.io/9.5/).
- **Loading the screen inside `SetupUI`.** The Wi-Fi setup instructions of the first boot are drawn on Xiaozhi's screen; load Narsil's only once Wi-Fi is up.
- **Missing accents.** If "ñ" or "á" draw as boxes, the build language has no Latin font. Build with `--language es-ES` (guide 3).
- **Nothing saved.** `Settings` must be opened with `read_write` set to `true`, or `SetString` only logs "Namespace narsil is not open for writing".
- **The token in the log.** Never print the text area's value. The fields are cleared by the restart.
- **The wrong board file.** Change only `new MipiLcdDisplay(` to `new NarsilDisplay(` and add `#include "narsil_display.h"`. Guide 3 explains why the board's configuration itself stays as it is.

To test, build and flash the belly (guides 2 and 3) and watch the first boot: Xiaozhi's screen shows the Wi-Fi setup, then Narsil's screen appears. Long-press the strip, type a made-up topic such as `narsil-0123456789abcdef0123` and a test token, save: the belly restarts and the placeholders say "(saved)". Then type your real topic and token the same way. Run `/narsil movil prueba` in Claude Code: a row appears at the top with a colored edge, and the unread count goes up; tap it and it dims. Within two minutes the pull requests show, or "No reviews waiting". Say "Hi ESP" while the screen is on: Xiaozhi still listens and answers.

## Going further

- **Pages instead of one column.** `lv_tabview_create` and `lv_tabview_add_tab` give tabs, for example one for alerts and one for pull requests, with a swipe between them.
- **Open a pull request.** Each search result has `html_url`. A tap could show it as a QR code (LVGL has `lv_qrcode` when `LV_USE_QRCODE` is enabled), to open on the phone.
- **Erase from the screen.** A "Forget" button calling `Settings("narsil", true).EraseAll()` wipes the topic and the token; guide 12 lists when you want that.
- **Dark theme.** Black and dim colors draw less attention on a desk at night, and the head is already black for the reasons in [guide 11](/en/bot/holographic-head/).
- The pose that `ShowStatus` passes on is turned into a UART message in [guide 10](/en/bot/uart-protocol/).
