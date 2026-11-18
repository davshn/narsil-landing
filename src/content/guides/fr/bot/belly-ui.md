---
title: L’écran du ventre avec LVGL
description: 'L’écran propre de Narsil sur le ventre de 4,3 pouces : un bandeau d’état, ses alertes et vos pull requests, des réglages en NVS, et pourquoi chaque appel prend le verrou d’affichage de Xiaozhi.'
route: bot
order: 9
updated: 2026-11-18
---

## Ce que ça fait

D’origine, Xiaozhi remplit l’écran du ventre avec sa propre interface : une barre d’état, un visage emoji et le texte de la conversation. Ce guide la remplace par l’écran de Narsil. Posé debout sur le bureau, l’écran de 4,3 pouces affiche, de haut en bas :

- **Un bandeau d’état** : l’heure, le niveau de Narsil d’après son dernier état, et le nombre d’alertes que vous n’avez pas encore lues.
- **Les alertes de Narsil**, les plus récentes d’abord, chacune avec un bord coloré selon son type : vert quand Claude a terminé, jaune quand il a besoin de vous, rouge sur une erreur. Appuyez sur l’une d’elles et elle s’estompe : elle est lue.
- **Vos pull requests** : celles qui sont ouvertes et attendent votre revue, telles que le guide 8 les trouve.
- **Un écran de réglages**, ouvert par un appui long sur le bandeau, où le topic ntfy et le token GitHub sont saisis une seule fois et enregistrés sur la carte.

C’est ici qu’aboutissent les guides 7 et 8. Ils appelaient quatre fonctions, `ShowAlert`, `ShowStatus`, `ShowPullRequest` et `ShowGithubError`, et les promettaient ici. Xiaozhi continue son travail vocal en dessous : le mot d’activation, l’écoute et la parole fonctionnent toujours pendant que l’écran de Narsil est affiché.

## Comment ça marche à l’intérieur

### LVGL, la version que fixe Xiaozhi

Xiaozhi dessine avec [LVGL](https://lvgl.io), la bibliothèque graphique open source pour petits écrans. Son `main/idf_component.yml` fixe `lvgl/lvgl: ~9.5.0` et `esp_lvgl_port: ~2.9.0` : tout ici utilise donc l’API de LVGL 9, documentée sur [docs.lvgl.io](https://docs.lvgl.io/9.5/). Le code LVGL 8 trouvé en ligne utilise souvent d’anciens noms (`lv_scr_act`, `lv_btn_create`) ; dans LVGL 9, ce sont `lv_screen_active` et `lv_button_create`.

Une interface LVGL est un arbre d’objets. Un **écran** en est la racine, créé avec `lv_obj_create(nullptr)` et affiché avec `lv_screen_load`. À l’intérieur se placent des widgets : un **label** affiche du texte, une **liste** (`lv_list_create`) est une colonne défilante où `lv_list_add_button` ajoute une ligne sur laquelle on peut appuyer et `lv_list_add_text` une ligne simple, une **zone de texte** reçoit le texte saisi, et un **clavier** écrit dans une zone de texte. La mise en page vient de flex, la même idée que le flexbox de CSS : `lv_obj_set_flex_flow(screen, LV_FLEX_FLOW_COLUMN)` empile les enfants, et `lv_obj_set_flex_grow` répartit entre eux la hauteur libre.

### La taille de l’écran

Le `config.h` de la carte dans Xiaozhi règle l’écran de 4,3 pouces sur `DISPLAY_WIDTH (480)` et `DISPLAY_HEIGHT (800)` : un écran en portrait, de 480 pixels de large. La mise en page tient donc en une colonne : un bandeau court en haut, puis les alertes avec la plus grande partie de la hauteur, puis les pull requests. Les largeurs utilisent `lv_pct(100)`, si bien que le même code s’adapte aux autres tailles de la famille de cartes.

### Où intervient le nouvel écran

La classe de la carte dans `esp32-p4-wifi6-touch-lcd.cc` crée son affichage avec `new MipiLcdDisplay(...)`, et l’`Application` de Xiaozhi appelle `display->SetupUI()` une fois au démarrage. `SetupUI` est virtuelle (`main/display/display.h`) ; le bot ajoute donc une petite classe, `NarsilDisplay`, qui hérite de `MipiLcdDisplay` et la redéfinit :

1. Elle appelle le `SetupUI` d’origine, pour que Xiaozhi construise sa propre interface comme d’habitude.
2. Elle construit l’écran de Narsil comme **second** écran LVGL, avec la même police.
3. Elle charge cet écran quand le Wi-Fi est connecté.

L’écran propre de Xiaozhi n’est jamais supprimé. Il continue de recevoir son état, ses émotions et le texte de la conversation, qui arrivent simplement sur un écran qui n’est pas affiché. C’est pourquoi rien ne casse dans Xiaozhi, et pourquoi le premier démarrage fonctionne toujours : tant que le ventre est en configuration Wi-Fi, son propre écran reste visible avec les instructions du point d’accès du guide 3, et l’écran de Narsil ne prend le relais qu’une fois le Wi-Fi connecté, au moment même où démarre `StartNtfy()`.

La seule modification du code de Xiaozhi se trouve dans le fichier de la carte : `new MipiLcdDisplay(` devient `new NarsilDisplay(`, avec les mêmes arguments. Le `main/CMakeLists.txt` de Xiaozhi compile chaque fichier `.cc` du dossier de la carte (`file(GLOB BOARD_SOURCES ...)`) ; le nouveau fichier se place donc à côté du fichier de la carte et ne demande aucune modification de la compilation.

### La police

Le `SetupUI` de Xiaozhi applique la police de texte de son thème à l’écran actif, une police intégrée qui correspond à la langue choisie à la compilation (`--language es-ES` dans le guide 3). Le nouvel écran la relit avec `lv_obj_get_style_text_font(lv_screen_active(), 0)` et se l’applique. Ainsi, les accents et le « ñ » des alertes en espagnol de Narsil s’affichent correctement. Les emoji, non : le label de niveau de narsil-pet commence par une étoile, et l’écran la saute.

### Le verrou d’affichage : la règle qui compte le plus

LVGL n’est pas thread-safe. Ses objets ne peuvent être touchés que par une tâche à la fois, et la tâche qui les dessine, gérée par `esp_lvgl_port`, les touche en permanence. Le flux ntfy du guide 7 et le sondage GitHub du guide 8 tournent dans leurs propres tâches FreeRTOS : un appel depuis l’une d’elles qui crée une ligne pendant que LVGL dessine peut corrompre la mémoire et faire planter la carte, au hasard et rarement, ce qui est le pire genre de bug à trouver.

Xiaozhi règle cela avec un verrou et une petite classe de garde, toutes deux dans `main/display/display.h`. `LcdDisplay::Lock` appelle `lvgl_port_lock`, et `DisplayLockGuard` prend le verrou dans son constructeur et le rend dans son destructeur :

```cpp
DisplayLockGuard lock(Board::GetInstance().GetDisplay());
if (!lock) return;
// ... LVGL calls ...
```

La garde attend jusqu’à 30 secondes et écrit « Failed to lock display » dans le journal si elle ne peut pas obtenir le verrou ; `if (!lock)` saute alors le dessin. Les méthodes d’affichage propres à Xiaozhi utilisent la même garde. Chacune des quatre fonctions la prend donc avant son premier appel `lv_`, et ne la garde que pour le dessin : l’analyse du JSON et l’envoi à la tête se font en dehors.

Les fonctions de rappel des événements (un appui, une touche) sont différentes : LVGL les exécute dans sa propre tâche, avec le verrou déjà pris. Elles appellent directement les fonctions `lv_`. Y prendre aussi la garde fonctionnerait encore, parce qu’`esp_lvgl_port` crée son verrou comme un mutex récursif (`xSemaphoreCreateRecursiveMutex`), mais ce n’est pas nécessaire.

### Les alertes, lues et non lues

`ShowAlert` ajoute une ligne avec `lv_list_add_button`, la place en haut avec `lv_obj_move_to_index(row, 0)`, et dessine une bordure gauche de 6 pixels dans la couleur de l’alerte. La couleur vient de l’étiquette de l’alerte (guide 7) et reprend les couleurs d’état propres à narsil-pet dans `hooks/sprite.ts` : `#22B573` pour terminé, `#F5B400` pour en attente et `#F0435A` pour erreur. Quand une ligne arrive avec un texte scellé (il commence par `narsil1:`, guide 7), la ligne indique « (sealed) » au lieu d’afficher du bruit ; le type et la couleur viennent toujours de l’étiquette.

Chaque ligne est non lue jusqu’à ce qu’on appuie dessus. Les données utilisateur de la ligne (`lv_obj_set_user_data`) la marquent ; une fonction de rappel `LV_EVENT_CLICKED` efface la marque, estompe la ligne avec `lv_obj_set_style_text_opa` et diminue le compte des non lues sur le bandeau. La liste garde les 20 dernières alertes : quand une 21e arrive, la ligne la plus ancienne, `lv_obj_get_child(alerts, -1)`, est supprimée.

La ligne affiche l’heure à laquelle l’alerte est arrivée sur le ventre. Xiaozhi règle l’horloge à partir de la réponse du serveur à la vérification OTA, et `main/ota.cc` ajoute le `timezone_offset` du serveur avant d’appeler `settimeofday`. L’horloge contient déjà l’heure locale ; l’écran la formate donc avec `gmtime_r`, qui n’ajoute aucun fuseau horaire de son côté.

### Le bandeau d’état et la tête

`ShowStatus` reçoit le JSON de `-estado` (guide 7). Il lit `xp`, le label de niveau de Narsil, pour le bandeau, et `art`, l’URL de son dessin, qui porte son stade et sa pose. Il passe `art` à `HeadSetPoseFromArt`, le côté ventre de la liaison UART du guide 10, qui le transforme en message pour la tête. Un état plus ancien que le dernier affiché (son `time` est plus petit) est ignoré, si bien qu’une reconnexion ne fait jamais reculer Narsil dans le temps. Un état scellé n’est pas du JSON : `cJSON_Parse` échoue donc, et le bandeau comme la tête gardent ce qu’ils avaient.

### Les pull requests

`ShowPullRequest` est appelée une fois par résultat de recherche, avec `index` à partir de 0. L’index 0 commence une nouvelle réponse : elle vide donc d’abord la liste avec `lv_obj_clean`. Le guide 8 ne l’appelle pas du tout quand la recherche ne renvoie aucun élément ; ce guide ajoute donc `ClearPullRequests()`, qui écrit « No reviews waiting » ; une ligne dans le `PollPullRequests` du guide 8 l’appelle quand `items` est vide. `ShowGithubError` remplace la liste par une ligne qui dit quoi faire : vérifier le token sur un `401`, attendre sur un `403` ou un `429`.

### L’écran de réglages

Un appui long sur le bandeau (`LV_EVENT_LONG_PRESSED`, pour qu’un appui en passant ne l’ouvre jamais) charge l’écran de réglages. Il contient deux zones de texte d’une ligne, l’une pour le topic ntfy et l’autre pour le token GitHub, un clavier et deux boutons :

- La zone de texte du token utilise `lv_textarea_set_password_mode`, si bien que ce que vous tapez s’affiche en points.
- Aucun champ n’est rempli avec la valeur enregistrée : un secret qui n’est jamais dessiné ne peut pas être lu par-dessus votre épaule. Le texte indicatif dit « (saved) » quand la NVS en contient déjà un.
- Un champ vide garde ce qui est enregistré : vous pouvez donc changer le token sans retaper le topic.
- **Save and restart** écrit les deux via la classe `Settings` de Xiaozhi, dans l’espace de noms `narsil` sous les clés `ntfy_topic` et `gh_token`, les mêmes que lisent les guides 7 et 8. `Settings` valide dans son destructeur (`nvs_commit`) ; l’enregistrement se fait donc dans son propre bloc avant `esp_restart()`. Le redémarrage est le moyen simple de faire lire les nouvelles valeurs aux tâches ntfy et GitHub.

Le guide 12 explique ce que protège la NVS et ce qu’elle ne protège pas.

## Comment on l’a demandé à l’IA

L’écran du ventre est la première chose que l’auteur ou l’autrice a décrite, avant tout code :

> va a ser la pantalla grande para una pantalla en la pansa que va a tener la informacion de las tareas que hace narsil

Traduction en français : ce sera le grand écran, pour un écran dans le ventre qui aura les informations sur les tâches que fait Narsil.

Cela a fixé à quoi sert l’écran : le travail de Narsil, pas une horloge ou un tableau de bord généraliste. Les alertes du guide 7 et les pull requests du guide 8 sont ces informations, et ce guide est l’endroit où elles se rejoignent.

Deux points revenaient à l’IA, qui devait les découvrir, et non à l’auteur ou à l’autrice, qui n’avait pas à les décider. Le premier était la façon de remplacer l’écran de Xiaozhi sans casser son travail vocal ; l’IA a lu `main/display/display.h`, `lcd_display.h` et le fichier de la carte, et a préféré une sous-classe qui garde l’écran de Xiaozhi vivant mais caché plutôt que de le supprimer ou de le réécrire. Le second était l’endroit où se saisissent les secrets. La spec S6 disait déjà qu’ils vivent dans la NVS ou dans une configuration locale, jamais dans le dépôt ; l’IA a donc proposé un écran de réglages sur le ventre lui-même, ouvert par un appui long sur le bandeau pour qu’un appui en passant ne l’affiche jamais.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas la conversation qui a servi à construire le bot.

> Mon fork de 78/xiaozhi-esp32 tourne sur une Waveshare ESP32-P4-WIFI6-Touch-LCD-4.3. Lis `main/idf_component.yml` pour la version de LVGL, `main/display/display.h`, `main/display/lcd_display.h`, `main/settings.h` et le fichier de la carte dans `main/boards/waveshare/esp32-p4-wifi6-touch-lcd/`. Écris ensuite une classe `NarsilDisplay` dérivée de `MipiLcdDisplay` qui garde l’interface de Xiaozhi mais charge un second écran LVGL à moi : un bandeau d’état, une liste d’alertes où un appui marque une ligne comme lue, une liste de pull requests, et un écran de réglages qui enregistre deux chaînes dans la NVS via `Settings`. Chaque fonction appelée depuis une autre tâche FreeRTOS doit prendre `DisplayLockGuard`. N’utilise que l’API de la version de LVGL que tu as trouvée, et donne le lien vers la documentation de chaque widget.

## Le code minimal

Deux fichiers à côté du fichier de la carte, en C++ comme Xiaozhi (MIT, comme les exemples propres au site). L’en-tête :

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

L’écran, `narsil_display.cc` :

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

Appelez `ShowNarsilScreen()` là où `StartNtfy()` est appelée, une fois le Wi-Fi connecté. Dans le `PollPullRequests` du guide 8, après `cJSON_GetObjectItem(root, "items")`, ajoutez `if (cJSON_GetArraySize(items) == 0) ClearPullRequests();`. L’horloge du bandeau se rafraîchit à chaque alerte et à chaque état ; un timer LVGL d’une minute (`lv_timer_create`) qui appelle `UpdateStrip` la tient à jour entre les deux.

## Erreurs fréquentes et comment tester

- **Des appels LVGL sans le verrou.** Ça fonctionne pendant des heures, puis ça plante dans une fonction de dessin. Chaque fonction appelée depuis la tâche ntfy ou GitHub prend `DisplayLockGuard` avant son premier appel `lv_`.
- **Du code LVGL 8.** `lv_scr_act`, `lv_btn_create` et `lv_obj_del` n’existent pas dans LVGL 9. Utilisez les noms de la [documentation de LVGL 9.5](https://docs.lvgl.io/9.5/).
- **Charger l’écran dans `SetupUI`.** Les instructions de configuration Wi-Fi du premier démarrage sont dessinées sur l’écran de Xiaozhi ; ne chargez celui de Narsil qu’une fois le Wi-Fi connecté.
- **Des accents manquants.** Si « ñ » ou « á » s’affichent comme des carrés, la langue de compilation n’a pas de police latine. Compilez avec `--language es-ES` (guide 3).
- **Rien n’est enregistré.** `Settings` doit être ouvert avec `read_write` à `true`, sinon `SetString` se contente d’écrire « Namespace narsil is not open for writing » dans le journal.
- **Le token dans le journal.** N’affichez jamais la valeur de la zone de texte. Les champs sont vidés par le redémarrage.
- **Le mauvais fichier de carte.** Changez seulement `new MipiLcdDisplay(` en `new NarsilDisplay(` et ajoutez `#include "narsil_display.h"`. Le guide 3 explique pourquoi la configuration de la carte elle-même reste telle quelle.

Pour tester, compilez et flashez le ventre (guides 2 et 3) et observez le premier démarrage : l’écran de Xiaozhi affiche la configuration Wi-Fi, puis l’écran de Narsil apparaît. Faites un appui long sur le bandeau, saisissez un topic inventé comme `narsil-0123456789abcdef0123` et un token de test, enregistrez : le ventre redémarre et les textes indicatifs disent « (saved) ». Saisissez ensuite votre vrai topic et votre vrai token de la même façon. Lancez `/narsil movil prueba` dans Claude Code : une ligne apparaît en haut avec un bord coloré, et le compte des non lues augmente ; appuyez dessus et elle s’estompe. Dans les deux minutes, les pull requests s’affichent, ou « No reviews waiting ». Dites « Hi ESP » pendant que l’écran est affiché : Xiaozhi écoute et répond toujours.

## Pour aller plus loin

- **Des pages au lieu d’une colonne.** `lv_tabview_create` et `lv_tabview_add_tab` donnent des onglets, par exemple un pour les alertes et un pour les pull requests, avec un balayage de l’un à l’autre.
- **Ouvrir une pull request.** Chaque résultat de recherche a un `html_url`. Un appui pourrait l’afficher sous forme de QR code (LVGL a `lv_qrcode` quand `LV_USE_QRCODE` est activé), à ouvrir sur le téléphone.
- **Effacer depuis l’écran.** Un bouton « Forget » qui appelle `Settings("narsil", true).EraseAll()` efface le topic et le token ; le guide 12 liste les cas où vous le voulez.
- **Thème sombre.** Le noir et les couleurs atténuées attirent moins l’attention sur un bureau la nuit, et la tête est déjà noire pour les raisons du [guide 11](/fr/bot/holographic-head/).
- La pose que transmet `ShowStatus` est transformée en message UART dans le [guide 10](/fr/bot/uart-protocol/).
