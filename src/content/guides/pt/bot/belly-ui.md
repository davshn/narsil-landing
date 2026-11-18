---
title: A tela da barriga com LVGL
description: 'A tela própria da Narsil na barriga de 4,3 polegadas: uma faixa de estado, os alertas dela e os seus pull requests, uma tela de configurações que salva na NVS e o lock da tela do Xiaozhi.'
route: bot
order: 9
updated: 2026-11-18
---

## O que faz

De fábrica, o Xiaozhi preenche a tela da barriga com a sua própria interface: uma barra de estado, um rosto de emoji e o texto da conversa. Este guia a substitui pela tela da Narsil. De pé sobre a mesa, a tela de 4,3 polegadas mostra, de cima para baixo:

- **Uma faixa de estado**: a hora, o nível da Narsil segundo o seu último estado e quantos alertas você ainda não leu.
- **Os alertas da Narsil**, os mais novos primeiro, cada um com uma borda colorida conforme o tipo: verde quando o Claude terminou, amarela quando ele precisa de você, vermelha num erro. Toque num deles e ele escurece: está lido.
- **Os seus pull requests**: os abertos que esperam a sua revisão, como o guia 8 os encontra.
- **Uma tela de configurações**, aberta com um toque longo na faixa, onde o tópico do ntfy e o token do GitHub são digitados uma vez e salvos na placa.

É aqui que os guias 7 e 8 chegam. Eles chamavam quatro funções, `ShowAlert`, `ShowStatus`, `ShowPullRequest` e `ShowGithubError`, e as prometiam aqui. O Xiaozhi continua fazendo o seu trabalho de voz por baixo: a palavra de ativação, a escuta e a fala continuam funcionando enquanto a tela da Narsil está ligada.

## Como funciona por dentro

### LVGL, a versão que o Xiaozhi fixa

O Xiaozhi desenha com o [LVGL](https://lvgl.io), a biblioteca gráfica de código aberto para telas pequenas. O seu `main/idf_component.yml` fixa `lvgl/lvgl: ~9.5.0` e `esp_lvgl_port: ~2.9.0`, então tudo aqui é a API do LVGL 9, documentada em [docs.lvgl.io](https://docs.lvgl.io/9.5/). O código de LVGL 8 encontrado na internet costuma usar nomes mais antigos (`lv_scr_act`, `lv_btn_create`); no LVGL 9 eles são `lv_screen_active` e `lv_button_create`.

Uma interface LVGL é uma árvore de objetos. Uma **screen** (tela) é a raiz, criada com `lv_obj_create(nullptr)` e mostrada com `lv_screen_load`. Dentro dela vão os widgets: um **label** mostra texto, uma **list** (`lv_list_create`) é uma coluna com rolagem em que `lv_list_add_button` acrescenta uma linha tocável e `lv_list_add_text` uma simples, uma **text area** recebe texto digitado, e um **keyboard** digita numa text area. O layout vem do flex, a mesma ideia do flexbox do CSS: `lv_obj_set_flex_flow(screen, LV_FLEX_FLOW_COLUMN)` empilha os filhos, e `lv_obj_set_flex_grow` reparte a altura livre entre eles.

### O tamanho da tela

O `config.h` da placa no Xiaozhi define a tela de 4,3 polegadas como `DISPLAY_WIDTH (480)` e `DISPLAY_HEIGHT (800)`: uma tela em retrato, com 480 pixels de largura. Por isso o layout é uma coluna só: uma faixa curta em cima, depois os alertas com a maior parte da altura, depois os pull requests. As larguras usam `lv_pct(100)`, então o mesmo código serve para os outros tamanhos da família de placas.

### Onde entra a nova tela

A classe da placa em `esp32-p4-wifi6-touch-lcd.cc` cria a sua tela com `new MipiLcdDisplay(...)`, e o `Application` do Xiaozhi chama `display->SetupUI()` uma vez no início. `SetupUI` é virtual (`main/display/display.h`), então o bot acrescenta uma pequena classe, `NarsilDisplay`, que herda de `MipiLcdDisplay` e a sobrescreve:

1. Ela chama o `SetupUI` original, para que o Xiaozhi monte a sua própria interface como de costume.
2. Ela monta a tela da Narsil como uma **segunda** tela LVGL, com a mesma fonte.
3. Ela carrega essa tela quando o Wi-Fi está conectado.

A tela do próprio Xiaozhi nunca é apagada. Ela continua recebendo o seu estado, as emoções e o texto do chat, que simplesmente caem numa tela que não é mostrada. É por isso que nada no Xiaozhi quebra, e por isso a primeira inicialização ainda funciona: enquanto a barriga está na configuração do Wi-Fi, a tela dela continua visível com as instruções do ponto de acesso do guia 3, e a tela da Narsil só assume quando o Wi-Fi está conectado, no mesmo momento em que o `StartNtfy()` começa.

A única mudança no código do Xiaozhi fica no arquivo da placa: `new MipiLcdDisplay(` vira `new NarsilDisplay(`, com os mesmos argumentos. O `main/CMakeLists.txt` do Xiaozhi compila todos os arquivos `.cc` da pasta da placa (`file(GLOB BOARD_SOURCES ...)`), então o novo arquivo vai ao lado do arquivo da placa e não precisa de nenhuma mudança na compilação.

### A fonte

O `SetupUI` do Xiaozhi define a fonte de texto do seu tema na tela ativa, uma fonte embutida que corresponde ao idioma escolhido na compilação (`--language es-ES` no guia 3). A nova tela a lê de volta com `lv_obj_get_style_text_font(lv_screen_active(), 0)` e a define em si mesma. Assim, os acentos e o "ñ" dos alertas em espanhol da Narsil são desenhados corretamente. Os emoji não: o rótulo de nível do narsil-pet começa com uma estrela, e a tela a pula.

### O lock da tela: a regra que mais importa

O LVGL não é thread-safe. Os seus objetos só podem ser tocados por uma tarefa de cada vez, e a tarefa que os desenha, executada pelo `esp_lvgl_port`, os toca o tempo todo. O stream do ntfy do guia 7 e a consulta ao GitHub do guia 8 rodam nas suas próprias tarefas do FreeRTOS, então uma chamada vinda delas que cria uma linha enquanto o LVGL está desenhando pode corromper a memória e travar a placa, ao acaso e raramente, que é o pior tipo de bug para encontrar.

O Xiaozhi resolve isso com um lock e uma pequena classe de guarda, ambos em `main/display/display.h`. `LcdDisplay::Lock` chama `lvgl_port_lock`, e `DisplayLockGuard` pega o lock no seu construtor e o devolve no seu destrutor:

```cpp
DisplayLockGuard lock(Board::GetInstance().GetDisplay());
if (!lock) return;
// ... LVGL calls ...
```

A guarda espera até 30 segundos e registra "Failed to lock display" (falha ao travar a tela) se não conseguir o lock; então `if (!lock)` pula o desenho. Os próprios métodos de tela do Xiaozhi usam a mesma guarda. Por isso, cada uma das quatro funções a pega antes da sua primeira chamada `lv_`, e a segura só durante o desenho: analisar o JSON e enviar para a cabeça acontecem fora dela.

Os callbacks de evento (um toque, uma tecla) são diferentes: o LVGL os executa dentro da sua própria tarefa, com o lock já pego. Eles chamam as funções `lv_` diretamente. Pegar a guarda ali também ainda funcionaria, porque o `esp_lvgl_port` cria o seu lock como um mutex recursivo (`xSemaphoreCreateRecursiveMutex`), mas não é necessário.

### Alertas, lidos e não lidos

`ShowAlert` acrescenta uma linha com `lv_list_add_button`, a move para o topo com `lv_obj_move_to_index(row, 0)` e desenha uma borda esquerda de 6 pixels na cor do alerta. A cor vem da tag do alerta (guia 7) e reutiliza as próprias cores de estado do narsil-pet, de `hooks/sprite.ts`: `#22B573` para pronto, `#F5B400` para esperando e `#F0435A` para erro. Quando uma linha chega com texto selado (ele começa com `narsil1:`, guia 7), a linha diz "(sealed)" (selado) em vez de ruído; o tipo e a cor continuam vindo da tag.

Cada linha fica não lida até ser tocada. Os dados de usuário da linha (`lv_obj_set_user_data`) a marcam; um callback de `LV_EVENT_CLICKED` limpa a marca, escurece a linha com `lv_obj_set_style_text_opa` e diminui a contagem de não lidos na faixa. A lista guarda os últimos 20 alertas: quando chega o 21.º, a linha mais antiga, `lv_obj_get_child(alerts, -1)`, é apagada.

A linha mostra a hora em que o alerta chegou à barriga. O Xiaozhi acerta o relógio pela resposta do servidor à verificação de OTA, e o `main/ota.cc` soma o `timezone_offset` do servidor antes de chamar `settimeofday`. O relógio já guarda a hora local, então a tela a formata com `gmtime_r`, que não soma nenhum fuso horário próprio.

### A faixa de estado e a cabeça

`ShowStatus` recebe o JSON do `-estado` (guia 7). Ele lê `xp`, o rótulo de nível da Narsil, para a faixa, e `art`, a URL do desenho dela, que traz o seu estágio e a sua pose. Ele passa `art` para `HeadSetPoseFromArt`, o lado da barriga do link UART do guia 10, que o transforma numa mensagem para a cabeça. Um estado mais antigo que o último mostrado (o seu `time` é menor) é ignorado, então uma reconexão nunca faz a Narsil voltar no tempo. Um estado selado não é JSON, então `cJSON_Parse` falha e a faixa e a cabeça mantêm o que tinham.

### Pull requests

`ShowPullRequest` é chamada uma vez por resultado da busca, com `index` a partir de 0. O índice 0 começa uma nova resposta, então ele primeiro limpa a lista com `lv_obj_clean`. O guia 8 nem a chama quando a busca não devolve itens, então este guia acrescenta `ClearPullRequests()`, que escreve "No reviews waiting" (nenhuma revisão esperando); uma linha no `PollPullRequests` do guia 8 a chama quando `items` está vazio. `ShowGithubError` substitui a lista por uma linha que diz o que fazer: conferir o token num `401`, esperar num `403` ou `429`.

### A tela de configurações

Um toque longo na faixa (`LV_EVENT_LONG_PRESSED`, para que um toque de passagem nunca a abra) carrega a tela de configurações. Ela tem duas text areas de uma linha, uma para o tópico do ntfy e outra para o token do GitHub, um teclado e dois botões:

- A text area do token usa `lv_textarea_set_password_mode`, então o que você digita aparece como pontos.
- Nenhum campo é preenchido com o valor salvo: um segredo que nunca é desenhado não pode ser lido por cima do seu ombro. O texto de exemplo diz "(saved)" (salvo) quando a NVS já guarda um.
- Um campo vazio mantém o que está salvo, então você pode trocar o token sem digitar o tópico de novo.
- **Save and restart** (salvar e reiniciar) grava os dois pela classe `Settings` do Xiaozhi, no namespace `narsil`, sob as chaves `ntfy_topic` e `gh_token`, as mesmas que os guias 7 e 8 leem. `Settings` confirma a gravação no seu destrutor (`nvs_commit`), então o salvamento acontece num bloco próprio antes do `esp_restart()`. A reinicialização é a forma simples de fazer as tarefas do ntfy e do GitHub lerem os novos valores.

O guia 12 explica o que a NVS protege e o que não protege.

## Construa com o Claude

Peça ao Claude uma classe `NarsilDisplay` que mantenha a interface do Xiaozhi e carregue uma segunda tela LVGL própria da Narsil. A única ideia que ele precisa acertar é o lock da tela: toda função chamada a partir da tarefa do ntfy ou do GitHub pega o `DisplayLockGuard` antes da sua primeira chamada `lv_`.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é a conversa usada para construir o bot.

> O meu fork do 78/xiaozhi-esp32 roda numa Waveshare ESP32-P4-WIFI6-Touch-LCD-4.3. Leia o `main/idf_component.yml` para saber a versão do LVGL, o `main/display/display.h`, o `main/display/lcd_display.h`, o `main/settings.h` e o arquivo da placa em `main/boards/waveshare/esp32-p4-wifi6-touch-lcd/`. Depois escreva uma classe `NarsilDisplay` derivada de `MipiLcdDisplay` que mantenha a interface do Xiaozhi, mas carregue uma segunda tela LVGL minha: uma faixa de estado, uma lista de alertas em que um toque marca uma linha como lida, uma lista de pull requests e uma tela de configurações que salve duas strings na NVS por meio de `Settings`. Toda função chamada de outra tarefa do FreeRTOS deve pegar o `DisplayLockGuard`. Use só a API da versão do LVGL que você encontrou, e coloque o link da documentação de cada widget.

### O que conferir na resposta do Claude

1. Usa os nomes do LVGL 9 da versão que o Xiaozhi fixa (`~9.5.0`), como `lv_screen_active` e `lv_button_create`, nunca `lv_scr_act`, `lv_btn_create` ou `lv_obj_del`.
2. `ShowAlert`, `ShowStatus`, `ShowPullRequest` e `ShowGithubError` pegam o `DisplayLockGuard` e pulam o desenho quando não conseguem obtê-lo. A leitura do JSON e o envio para a cabeça acontecem fora do lock.
3. `SetupUI` chama primeiro a original e monta a tela da Narsil como uma segunda tela. Essa tela é carregada quando o Wi-Fi está ativo, não dentro de `SetupUI`, então a primeira inicialização ainda mostra a configuração do Wi-Fi.
4. O alerta mais novo fica no topo, a lista guarda os últimos 20, e um toque escurece uma linha e diminui a contagem de não lidos. Um estado cujo `time` é mais antigo que o último mostrado é ignorado.
5. A tela de configurações abre com um toque longo, mostra o token como pontos, nunca preenche um campo com o valor salvo e nunca o registra no log. Ela salva por meio de `Settings` aberto com `read_write` definido como `true`, no namespace `narsil` sob `ntfy_topic` e `gh_token`, nunca no código.

Se uma verificação falhar, diga ao Claude o que você vê: "a placa funciona por horas e depois trava numa função de desenho".

### Como a pessoa autora pediu

A tela da barriga é a primeira coisa que a pessoa autora descreveu, antes de qualquer código:

> va a ser la pantalla grande para una pantalla en la pansa que va a tener la informacion de las tareas que hace narsil

Tradução para o português: "vai ser a tela grande, para uma tela na barriga que vai ter a informação das tarefas que a Narsil faz".

Isso definiu para que serve a tela: o trabalho da Narsil, não um relógio ou painel genérico. Os alertas do guia 7 e os pull requests do guia 8 são essa informação, e este guia é onde eles se encontram.

Duas coisas ficaram para a IA descobrir, em vez de para a pessoa autora decidir. A primeira foi como substituir a tela do Xiaozhi sem quebrar o seu trabalho de voz; a IA leu `main/display/display.h`, `lcd_display.h` e o arquivo da placa, e escolheu uma subclasse que mantém a tela do Xiaozhi viva, mas escondida, em vez de apagá-la ou reescrevê-la. A segunda foi onde os segredos são digitados. A especificação S6 já dizia que eles vivem na NVS ou na configuração local, nunca no repositório, então a IA propôs uma tela de configurações na própria barriga, aberta com um toque longo na faixa, para que um toque de passagem nunca a mostre.

## Código de referência

Esta é uma resposta correta, escrita para este guia. Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

Dois arquivos ao lado do arquivo da placa, em C++ como o Xiaozhi (MIT, como os próprios exemplos do site). O cabeçalho:

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

A tela, `narsil_display.cc`:

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

Chame `ShowNarsilScreen()` onde o `StartNtfy()` é chamado, quando o Wi-Fi estiver conectado. No `PollPullRequests` do guia 8, depois de `cJSON_GetObjectItem(root, "items")`, acrescente `if (cJSON_GetArraySize(items) == 0) ClearPullRequests();`. O relógio da faixa se atualiza a cada alerta e estado; um timer do LVGL de um minuto (`lv_timer_create`) que chame `UpdateStrip` o mantém em dia entre eles.

## Erros comuns e como testar

- **Chamadas ao LVGL sem o lock.** Funciona por horas e depois trava numa função de desenho. Toda função chamada da tarefa do ntfy ou do GitHub pega o `DisplayLockGuard` antes da sua primeira chamada `lv_`.
- **Código de LVGL 8.** `lv_scr_act`, `lv_btn_create` e `lv_obj_del` não existem no LVGL 9. Use os nomes da [documentação do LVGL 9.5](https://docs.lvgl.io/9.5/).
- **Carregar a tela dentro do `SetupUI`.** As instruções de configuração do Wi-Fi da primeira inicialização são desenhadas na tela do Xiaozhi; carregue a da Narsil só quando o Wi-Fi estiver conectado.
- **Acentos faltando.** Se o "ñ" ou o "á" aparecem como caixas, o idioma da compilação não tem fonte latina. Compile com `--language es-ES` (guia 3).
- **Nada salvo.** `Settings` deve ser aberta com `read_write` definido como `true`, ou o `SetString` só registra "Namespace narsil is not open for writing" (o namespace narsil não está aberto para escrita).
- **O token no log.** Nunca imprima o valor da text area. Os campos são limpos pela reinicialização.
- **O arquivo de placa errado.** Mude só `new MipiLcdDisplay(` para `new NarsilDisplay(` e acrescente `#include "narsil_display.h"`. O guia 3 explica por que a configuração da placa em si fica como está.

Para testar, compile e grave a barriga (guias 2 e 3) e acompanhe a primeira inicialização: a tela do Xiaozhi mostra a configuração do Wi-Fi, depois aparece a tela da Narsil. Faça um toque longo na faixa, digite um tópico inventado como `narsil-0123456789abcdef0123` e um token de teste, salve: a barriga reinicia e os textos de exemplo dizem "(saved)". Depois digite o seu tópico e o seu token reais da mesma forma. Rode `/narsil movil prueba` no Claude Code: aparece uma linha no topo com uma borda colorida, e a contagem de não lidos sobe; toque nela e ela escurece. Em até dois minutos aparecem os pull requests, ou "No reviews waiting". Diga "Hi ESP" com a tela ligada: o Xiaozhi ainda escuta e responde.

## Para ir além

- **Páginas em vez de uma coluna.** `lv_tabview_create` e `lv_tabview_add_tab` dão abas, por exemplo uma para os alertas e outra para os pull requests, com um deslize entre elas.
- **Abrir um pull request.** Cada resultado da busca tem `html_url`. Um toque poderia mostrá-lo como um código QR (o LVGL tem `lv_qrcode` quando `LV_USE_QRCODE` está ativado), para abrir no celular.
- **Apagar pela tela.** Um botão "Forget" (esquecer) que chame `Settings("narsil", true).EraseAll()` apaga o tópico e o token; o guia 12 lista quando você vai querer isso.
- **Tema escuro.** Preto e cores apagadas chamam menos atenção numa mesa à noite, e a cabeça já é preta pelos motivos do [guia 11](/pt/bot/holographic-head/).
- A pose que o `ShowStatus` repassa vira uma mensagem UART no [guia 10](/pt/bot/uart-protocol/).
