---
title: A cabeça holográfica
description: 'A ESP32-S3-LCD-1.3 sob o seu cubo prisma: por que a imagem é espelhada, por que o preto é transparente, desenhar a Narsil por pose a partir da UART, a luz de fundo e como conferir o alinhamento.'
route: bot
order: 11
updated: 2026-11-18
---

## O que faz

A cabeça é a parte que as pessoas notam primeiro. Dentro de um pequeno cubo de vidro no alto do bot, a Narsil flutua no ar: o desenho dela, na pose que a barriga envia, sem nada em volta. Quando ela está trabalhando, está trabalhando; quando o Claude precisa de você, ela está esperando por você; quando você diz "Hi ESP", um pequeno ponto azul embaixo dela mostra que ela está escutando.

É uma tela de 1,3 polegada e um prisma. Este guia explica por que o truque funciona, o que o firmware precisa fazer para ele (espelhar a imagem, manter o fundo preto), como desenha cada pose que chega pela UART do guia 10 e como conferir que a imagem está do lado certo.

## Como funciona por dentro

### A placa

A cabeça é a ESP32-S3-LCD-1.3-C do guia 1: um ESP32-S3R8 com 8 MB de PSRAM e 16 MB de flash, e uma tela IPS de 1,3 polegada com 240 × 240 pixels, controlada por um controlador ST7789 via SPI. A SpotPear vende a versão com o cubo como o [3D transparent prism display](https://spotpear.com/wiki/ESP32-S3-1.3-inch-LCD-ST7789-240x240-3D-Display-Transparent-Screen-Refractive-Prism-Mini-TV.html) (tela de prisma transparente 3D), e a Waveshare documenta a placa na sua [wiki](https://www.waveshare.com/wiki/ESP32-S3-LCD-1.3).

Os pinos da tela vêm do esquema da Waveshare, `ESP32S3_1.3inch.pdf`, com link nas duas páginas:

| Sinal                 | GPIO |
| --------------------- | ---- |
| Clock do SPI (CLK)    | 40   |
| Dados do SPI (MOSI)   | 41   |
| Seleção de chip (CS)  | 39   |
| Dados/comando (DC)    | 38   |
| Reset (RES)           | 42   |
| Luz de fundo (BL_PWM) | 20   |

Nenhum deles colide com a UART do guia 10 (GPIO13 e GPIO14), a IMU (GPIO45 a GPIO48) ou o cartão TF (GPIO16, GPIO17, GPIO18 e GPIO21, segundo o mesmo esquema). O pino da luz de fundo aciona os LEDs da tela por meio de um transistor, então um sinal PWM nele define o brilho.

### Por que o rosto flutua

O truque é antigo: chama-se fantasma de Pepper, em referência a uma ilusão de palco do século XIX em que um ator escondido abaixo do palco aparecia como um fantasma refletido numa grande lâmina de vidro. Aqui, o vidro é o cubo. A tela fica deitada embaixo dele, e uma face diagonal dentro do cubo reflete a tela na sua direção, enquanto você ainda vê através do vidro a mesa atrás dele. O seu olho toma o reflexo por um objeto de pé dentro do cubo.

Daí vêm duas consequências, e as duas estão no firmware.

### O preto é transparente

Um reflexo só acrescenta luz. Um pixel claro reflete claro, e um pixel preto não reflete nada, então através do vidro você vê o que estiver atrás do cubo. Nesta tela, **o preto é transparente**: um fundo preto é o que faz a Narsil flutuar sem nenhum retângulo em volta. Qualquer outra cor de fundo, mesmo um cinza escuro, mostra as bordas da tela como um quadrado fraco e brilhante.

Por isso, a cabeça limpa cada quadro com preto puro (RGB565 `0x0000`) e desenha só a Narsil sobre ele. A arte dela no narsil-pet vem em duas versões por pose, `-claro` para fundos claros e `-oscuro` para fundos escuros; a cabeça usa `-oscuro`, feita para um fundo escuro, os mesmos arquivos que a URL de `art` do guia 10 nomeia. Os PNGs têm bordas transparentes, e eles são achatados sobre o preto quando são convertidos, então os seus contornos suaves se misturam ao preto em vez de formar um halo.

### A imagem é espelhada

Um espelho inverte a imagem num eixo: segure uma página de texto diante de um espelho e ela fica ao contrário. O cubo é um espelho, então uma imagem desenhada normalmente na tela aparece invertida dentro do cubo. A Narsil olha para o lado errado, e qualquer texto fica ilegível. O firmware desenha a imagem já espelhada, para que o reflexo a desinverta.

A Waveshare distribui as suas demos em duas compilações por esse motivo: a página da SpotPear lista "AstronautClock-NoPrism and AstronautClock-Prism", e diz que a segunda é adequada para a versão com prisma.

O driver de LCD do ESP-IDF faz a inversão no controlador da tela, sem custo para o processador. Da [referência da API de LCD](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/lcd/index.html):

```c
esp_err_t esp_lcd_panel_mirror(esp_lcd_panel_handle_t panel, bool mirror_x, bool mirror_y);
```

"Mirror the LCD panel on specific axis." (Espelha o painel LCD num eixo específico.) No driver ST7789 do ESP-IDF (`esp_lcd_panel_st7789.c`), a chamada só muda bits do registrador `MADCTL` do controlador, que define a ordem em que o controlador escreve os pixels na sua memória. O quadro que o firmware envia continua o mesmo; a tela o mostra invertido.

Qual eixo depende de como a tela fica sob o prisma, então a cabeça começa com `mirror_x` ativado e a verificação de alinhamento abaixo diz se está certo. A tela de inicialização da cabeça existe para essa verificação: um quadrado vermelho no seu canto superior esquerdo por três segundos.

### A arte da Narsil no firmware

A cabeça não tem rede nem sistema de arquivos de onde buscar imagens, então a arte vai no próprio firmware:

1. Cada um dos arquivos `-oscuro.png` do narsil-pet para as cinco poses (`parada`, `trabajando`, `necesita`, `terminado`, `error`) nos cinco estágios é convertido com o conversor de imagens do LVGL, `scripts/LVGLImage.py` no [repositório do LVGL](https://github.com/lvgl/lvgl). As opções são `--ofmt BIN` (um arquivo binário), `--cf RGB565_SWAPPED` (cor de 16 bits com os seus dois bytes na ordem que o ST7789 espera pelo SPI) e `--background 0x000000` (a cor com que as bordas transparentes se misturam, num formato sem alfa).
2. Os 25 arquivos são juntados num só, `faces.bin`, numa ordem fixa: estágio 1 a 5, e as cinco poses na ordem acima dentro de cada estágio.
3. O sistema de compilação do ESP-IDF o embute: `EMBED_FILES faces.bin` em `idf_component_register` coloca o arquivo na flash e fornece dois símbolos, `_binary_faces_bin_start` e `_binary_faces_bin_end`, como a sua [documentação do sistema de compilação](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-guides/build-system.html) descreve.

Cada arquivo convertido começa com o cabeçalho de imagem de 12 bytes do LVGL 9 (`lv_image_header_t` em `src/draw/lv_image_dsc.h`): um byte mágico, o formato de cor, flags, e depois a largura, a altura e o stride como números de 16 bits little-endian nos bytes 4, 6 e 8. A cabeça percorre o `faces.bin` lendo cada cabeçalho e pulando `12 + stride × height` bytes até a próxima imagem, então não precisa de tabela de índice. Os desenhos da Narsil têm 150 pixels de altura e de 79 a 106 de largura; 25 deles ocupam menos de 800 KB, uma pequena parte dos 16 MB de flash da cabeça.

A arte é do narsil-pet, licenciada sob GPL-3.0-or-later, e o `faces.bin` é feito a partir dela, então ele mantém essa licença e um link para o [davshn/narsil-pet](https://github.com/davshn/narsil-pet) nas notas da pasta `head/`. O código próprio da cabeça é MIT, como os exemplos do site.

### Desenhar um quadro

A cabeça mantém um quadro de 240 × 240 em memória com capacidade de DMA (`heap_caps_malloc` com `MALLOC_CAP_DMA`), 115.200 bytes. Para desenhar, ela preenche o quadro de preto, copia a imagem da Narsil para o meio linha por linha, acrescenta o ponto de voz e envia o quadro inteiro com `esp_lcd_panel_draw_bitmap`.

Essa chamada retorna antes de a transferência terminar: o driver de SPI envia os bytes em segundo plano, com DMA, direto do buffer do quadro. Mudar o buffer antes de a transferência terminar enviaria uma mistura de dois quadros, então a cabeça registra `on_color_trans_done`, um callback que o driver chama quando a transferência termina, e que libera um semáforo do FreeRTOS. A função de desenho espera nesse semáforo antes de retornar, então o próximo quadro nunca sobrescreve um que ainda está a caminho.

A cabeça só redesenha quando a pose, o estágio ou o estado de voz mudam. Entre as mudanças, a tela mantém o último quadro por conta própria, e o processador espera na UART.

### O ponto de voz

A mensagem `V` do guia 10 diz se o Xiaozhi está escutando ou falando. A cabeça a mostra como um pequeno ponto embaixo da Narsil: azul (`#3B8BFF`, a cor do narsil-pet para trabalhando) enquanto escuta, verde (`#22B573`, a cor dele para pronto) enquanto fala, e nada quando ociosa. Um ponto, e não um segundo desenho, porque a arte não tem uma pose de "escutando" e o ponto pode ser visto do outro lado da sala.

### A luz de fundo

Os LEDs da tela estão no GPIO20, por meio de um transistor. A cabeça aciona o pino com o periférico PWM [LEDC](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/ledc.html) do ESP-IDF a 5 kHz com resolução de 10 bits, então o ciclo de trabalho, de 0 a 1023, é o brilho. Ela fica no brilho máximo enquanto chegam linhas, e cai para 20% depois de 15 segundos de silêncio (guia 10): a barriga está desligada ou o fio está solto, e uma Narsil com pouco brilho diz isso sem apagar. A luz de fundo fica desligada até o primeiro quadro ser desenhado, então a tela nunca mostra a memória aleatória do controlador na inicialização.

## Construa com o Claude

Peça ao Claude o firmware da cabeça: um app ESP-IDF que desenhe a pose da Narsil, recebida pela UART, na tela ST7789 sob o cubo prisma. A única ideia que ele precisa acertar é que o cubo é um espelho: a imagem precisa ser desenhada espelhada, e tudo o que não é a Narsil precisa ser preto puro, porque o preto é o que parece transparente.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é a conversa usada para construir o bot.

> Tenho uma Waveshare ESP32-S3-LCD-1.3 (ST7789, 240×240, SPI) sob um cubo prisma de fantasma de Pepper. Leia a wiki e o esquema da Waveshare para os pinos do LCD e da luz de fundo, e a documentação do `esp_lcd` do ESP-IDF 6. Escreva um app ESP-IDF que inicialize o ST7789 com `esp_lcd_new_panel_st7789`, espelhe a imagem com `esp_lcd_panel_mirror`, mantenha o fundo preto puro, defina a luz de fundo com o LEDC e desenhe uma de 25 imagens RGB565 embutidas, escolhida por uma pose e um estágio recebidos pela UART. Espere pelo `on_color_trans_done` antes de reutilizar o buffer do quadro. Explique por que a imagem precisa ser espelhada e por que o preto parece transparente, e como confiro o alinhamento.

### O que conferir na resposta do Claude

1. A imagem é espelhada no controlador da tela com `esp_lcd_panel_mirror`, começando com `mirror_x` ativado, e a tela de inicialização mostra um quadrado vermelho no canto superior esquerdo por três segundos para você conferir o eixo.
2. Todo quadro é limpo para preto puro (`0x0000`), e a arte é convertida com `--background 0x000000` e `--cf RGB565_SWAPPED`, não com `RGB565` simples.
3. Os pinos batem com o esquema da Waveshare: CLK no GPIO40, MOSI no GPIO41, CS no GPIO39, DC no GPIO38, reset no GPIO42 e a luz de fundo no GPIO20. Nenhum deles é o GPIO13 ou o GPIO14, a UART do guia 10.
4. Depois de `esp_lcd_panel_draw_bitmap`, o código espera `on_color_trans_done` liberar o seu semáforo antes de tocar no buffer do quadro de novo.
5. A cabeça só redesenha quando a pose, a etapa ou o estado de voz mudam. A luz de fundo fica apagada até o primeiro quadro e cai para 20% depois de 15 segundos sem uma linha da barriga.

Se uma verificação falhar, diga ao Claude o que você vê: "a Narsil olha para o lado errado, e o quadrado vermelho está no canto superior direito do cubo".

### Como a pessoa autora pediu

O trabalho da cabeça estava na primeira descrição do bot feita pela pessoa autora:

> la cabeza va a ser una apntalla holografica que solo sea la cara de narsil

Tradução para o português: "a cabeça vai ser uma tela holográfica que seja só o rosto da Narsil".

"Só o rosto da Narsil" é o briefing de design inteiro: nada de relógio, texto ou menus na cabeça. A IA leu a página da SpotPear, que vende a placa com o seu prisma, e a wiki e o esquema da Waveshare, que dão o controlador e os pinos da tela. As duas regras do holograma, a imagem espelhada e o fundo preto, vieram de como o prisma funciona e do fato de a Waveshare distribuir demos "Prism" separadas; não eram escolhas para a pessoa autora fazer.

O que desenhar foi proposta da IA: a Narsil já tem arte pintada para cada estado e estágio no narsil-pet, as mesmas imagens que os alertas do celular usam, então a cabeça mostra essas em vez de um novo desenho. Como a cabeça fica sabendo a pose foi resolvido antes, pela resposta da pessoa autora "Por cable desde la panza" ("por cabo, a partir da barriga"), que o guia 10 transformou no protocolo.

## Código de referência

Esta é uma resposta correta, escrita para este guia. Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

Primeiro, a arte. A partir de uma pasta com um clone do narsil-pet e do LVGL (para o `LVGLImage.py`, que precisa de `pip install pypng lz4`), no PowerShell:

```powershell
$poses = 'parada', 'trabajando', 'necesita', 'terminado', 'error'
$files = @()
foreach ($stage in 1..5) {
  $folder = if ($stage -gt 1) { "narsil-pet/assets/etapa$stage" } else { 'narsil-pet/assets' }
  foreach ($pose in $poses) {
    python lvgl/scripts/LVGLImage.py --ofmt BIN --cf RGB565_SWAPPED --background 0x000000 `
      -o faces --name "s${stage}_$pose" "$folder/$pose-oscuro.png"
    $files += "faces/s${stage}_$pose.bin"
  }
}
python -c "import sys; open('narsil-bot/head/main/faces.bin','wb').write(b''.join(open(f,'rb').read() for f in sys.argv[1:]))" $files
```

O `main/CMakeLists.txt` da cabeça:

```cmake
idf_component_register(SRCS "main.c" "head_link.c"
                       INCLUDE_DIRS "."
                       EMBED_FILES "faces.bin")
```

O `head_link.c` é o lado da cabeça do guia 10. O `main.c`, em C (MIT):

```c
#include <stdbool.h>
#include <string.h>
#include "driver/ledc.h"
#include "driver/spi_master.h"
#include "esp_heap_caps.h"
#include "esp_lcd_panel_io.h"
#include "esp_lcd_panel_ops.h"
#include "esp_lcd_panel_vendor.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

#define LCD_HOST SPI2_HOST
#define PIN_CLK  40
#define PIN_MOSI 41
#define PIN_CS   39
#define PIN_DC   38
#define PIN_RST  42
#define PIN_BL   20
#define SIZE     240

typedef struct {
    char pose[16];
    int stage;
    char voice[12];
} head_state_t;

void head_link_init(void);
bool head_link_poll(head_state_t *state, int timeout_ms);

extern const uint8_t faces_start[] asm("_binary_faces_bin_start");
extern const uint8_t faces_end[] asm("_binary_faces_bin_end");

static const char *const POSES[] = {"parada", "trabajando", "necesita", "terminado", "error"};
static esp_lcd_panel_handle_t panel;
static SemaphoreHandle_t sent;
static uint16_t *frame;

static bool on_sent(esp_lcd_panel_io_handle_t io, esp_lcd_panel_io_event_data_t *data, void *ctx)
{
    BaseType_t woken = pdFALSE;
    xSemaphoreGiveFromISR(sent, &woken);
    return woken == pdTRUE;
}

static uint16_t color(uint32_t rgb)
{
    uint16_t c = ((rgb >> 8) & 0xF800) | ((rgb >> 5) & 0x07E0) | ((rgb >> 3) & 0x001F);
    return (uint16_t)((c >> 8) | (c << 8));
}

static void backlight(int percent)
{
    ledc_set_duty(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0, 1023 * percent / 100);
    ledc_update_duty(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0);
}

static void face_init(void)
{
    ledc_timer_config_t timer = {
        .speed_mode = LEDC_LOW_SPEED_MODE, .duty_resolution = LEDC_TIMER_10_BIT,
        .timer_num = LEDC_TIMER_0, .freq_hz = 5000, .clk_cfg = LEDC_AUTO_CLK,
    };
    ESP_ERROR_CHECK(ledc_timer_config(&timer));
    ledc_channel_config_t channel = {
        .gpio_num = PIN_BL, .speed_mode = LEDC_LOW_SPEED_MODE,
        .channel = LEDC_CHANNEL_0, .timer_sel = LEDC_TIMER_0, .duty = 0,
    };
    ESP_ERROR_CHECK(ledc_channel_config(&channel));

    spi_bus_config_t bus = {
        .sclk_io_num = PIN_CLK, .mosi_io_num = PIN_MOSI, .miso_io_num = -1,
        .quadwp_io_num = -1, .quadhd_io_num = -1, .max_transfer_sz = SIZE * SIZE * 2,
    };
    ESP_ERROR_CHECK(spi_bus_initialize(LCD_HOST, &bus, SPI_DMA_CH_AUTO));
    sent = xSemaphoreCreateBinary();
    esp_lcd_panel_io_handle_t io;
    esp_lcd_panel_io_spi_config_t io_config = {
        .dc_gpio_num = PIN_DC, .cs_gpio_num = PIN_CS, .pclk_hz = 20 * 1000 * 1000,
        .lcd_cmd_bits = 8, .lcd_param_bits = 8, .spi_mode = 0, .trans_queue_depth = 10,
        .on_color_trans_done = on_sent,
    };
    ESP_ERROR_CHECK(esp_lcd_new_panel_io_spi((esp_lcd_spi_bus_handle_t)LCD_HOST, &io_config, &io));
    esp_lcd_panel_dev_config_t panel_config = {
        .reset_gpio_num = PIN_RST, .rgb_ele_order = LCD_RGB_ELEMENT_ORDER_RGB, .bits_per_pixel = 16,
    };
    ESP_ERROR_CHECK(esp_lcd_new_panel_st7789(io, &panel_config, &panel));
    ESP_ERROR_CHECK(esp_lcd_panel_reset(panel));
    ESP_ERROR_CHECK(esp_lcd_panel_init(panel));
    ESP_ERROR_CHECK(esp_lcd_panel_invert_color(panel, true));
    ESP_ERROR_CHECK(esp_lcd_panel_mirror(panel, true, false));
    ESP_ERROR_CHECK(esp_lcd_panel_disp_on_off(panel, true));
    frame = heap_caps_malloc(SIZE * SIZE * 2, MALLOC_CAP_DMA);
}

static const uint8_t *find_face(const head_state_t *s, int *w, int *h, int *stride)
{
    int pose = -1;
    for (int i = 0; i < 5; i++) {
        if (strcmp(s->pose, POSES[i]) == 0) pose = i;
    }
    if (pose < 0) return NULL;
    int index = (s->stage - 1) * 5 + pose;
    const uint8_t *p = faces_start;
    for (int i = 0; p + 12 <= faces_end; i++) {
        *w = p[4] | p[5] << 8;
        *h = p[6] | p[7] << 8;
        *stride = p[8] | p[9] << 8;
        if (i == index) return p + 12;
        p += 12 + *stride * *h;
    }
    return NULL;
}

static void draw(const head_state_t *s, bool test)
{
    memset(frame, 0, SIZE * SIZE * 2);
    int w, h, stride;
    const uint8_t *pixels = find_face(s, &w, &h, &stride);
    if (pixels != NULL && w <= SIZE && h <= SIZE) {
        int x0 = (SIZE - w) / 2, y0 = (SIZE - h) / 2 - 10;
        for (int y = 0; y < h; y++) {
            memcpy(&frame[(y0 + y) * SIZE + x0], pixels + y * stride, w * 2);
        }
    }
    uint32_t dot = strcmp(s->voice, "listening") == 0 ? 0x3B8BFF
                 : strcmp(s->voice, "speaking") == 0  ? 0x22B573 : 0;
    for (int dy = -6; dot && dy <= 6; dy++) {
        for (int dx = -6; dx <= 6; dx++) {
            if (dx * dx + dy * dy <= 36) frame[(222 + dy) * SIZE + 120 + dx] = color(dot);
        }
    }
    for (int y = 8; test && y < 28; y++) {
        for (int x = 8; x < 28; x++) frame[y * SIZE + x] = color(0xFF0000);
    }
    esp_lcd_panel_draw_bitmap(panel, 0, 0, SIZE, SIZE, frame);
    xSemaphoreTake(sent, portMAX_DELAY);
}

static bool same(const head_state_t *a, const head_state_t *b)
{
    return strcmp(a->pose, b->pose) == 0 && a->stage == b->stage && strcmp(a->voice, b->voice) == 0;
}

void app_main(void)
{
    head_state_t state = {"parada", 1, "idle"};
    face_init();
    draw(&state, true);
    backlight(100);
    vTaskDelay(pdMS_TO_TICKS(3000));
    draw(&state, false);
    head_state_t shown = state;
    head_link_init();

    int64_t last_line = esp_timer_get_time();
    bool dim = false;
    while (true) {
        if (head_link_poll(&state, 200)) {
            last_line = esp_timer_get_time();
            if (dim) { backlight(100); dim = false; }
            if (!same(&state, &shown)) { draw(&state, false); shown = state; }
        } else if (!dim && esp_timer_get_time() - last_line > 15 * 1000 * 1000) {
            backlight(20);
            dim = true;
        }
    }
}
```

Compile e grave a partir da pasta `head/` com os comandos do guia 2 (`idf.py set-target esp32s3`, `idf.py build`, depois `idf.py flash` pela ponte serial).

## Erros comuns e como testar

- **Um quadrado visível em volta da Narsil.** O fundo não é preto puro. Confira se o quadro é limpo com zeros e se a arte foi convertida com `--background 0x000000`.
- **A Narsil olha para o lado errado, ou o quadrado vermelho está no canto errado.** O eixo do espelhamento está errado; veja a verificação de alinhamento abaixo.
- **A imagem se deslocou depois de espelhar o outro eixo, com uma faixa de ruído.** A memória do ST7789 é de 240 × 320, mais alta que esta tela. Quando o eixo espelhado é o de 320 pixels, a janela visível se move; `esp_lcd_panel_set_gap(panel, 0, 80)` a traz de volta.
- **Uma imagem em negativo.** O preto aparece branco e as cores estão invertidas: mude `esp_lcd_panel_invert_color` para `false`. Muitos painéis IPS ST7789 precisam de `true`.
- **Vermelho e azul trocados.** Use `LCD_RGB_ELEMENT_ORDER_BGR` em `panel_config`.
- **Cores salpicadas.** A arte foi convertida com `--cf RGB565` em vez de `RGB565_SWAPPED`, então os dois bytes de cada pixel estão na ordem errada para o link SPI.
- **Um quadro rasgado ou misturado.** O buffer do quadro foi mudado enquanto a transferência anterior ainda estava em andamento. Mantenha o `xSemaphoreTake` depois do `esp_lcd_panel_draw_bitmap`.
- **A tela continua escura.** O pino da luz de fundo é a entrada do transistor, então nível alto a liga; se a sua continua escura em 100%, confira o GPIO20 no esquema da revisão da sua placa.

Para conferir o alinhamento, coloque o cubo sobre a tela e olhe para ele de frente, na altura dos seus olhos, como o bot vai ficar na mesa:

1. Ligue a cabeça sozinha. Por três segundos, a Narsil fica de pé no meio com um quadrado vermelho ao lado dela.
2. O quadrado vermelho deve aparecer no canto **superior esquerdo** como você o vê no cubo. Se estiver no superior direito, a imagem não está espelhada (ou está espelhada duas vezes): inverta `mirror_x`. Se estiver no inferior esquerdo, o eixo errado está espelhado: use `esp_lcd_panel_mirror(panel, false, true)` e o gap acima.
3. A Narsil deve ficar de pé e centralizada no cubo. Se estiver baixa ou alta, mude o `- 10` em `y0`, que a sobe um pouco para deixar espaço para o ponto de voz.
4. Olhe para o cubo de lado: você deve ver a mesa através dele, sem nenhuma borda brilhante. Um brilho significa que algo na tela não é preto.

Depois conecte a barriga. Em até cinco segundos, a cabeça mostra a pose real da Narsil; diga "Hi ESP" e o ponto azul aparece. Desconecte o fio de dados: depois de 15 segundos a cabeça perde brilho, e reconectá-lo traz o brilho máximo na próxima linha.

## Para ir além

- **Animação.** O narsil-pet também tem loops animados para algumas poses (`hooks/art/animated.ts`, `assets/anim`). Dois ou três quadros por pose, desenhados em sequência com a mesma função `draw`, fariam ela se mexer; a flash tem espaço para muitas outras imagens.
- **LVGL na cabeça.** Para texto ou efeitos, o LVGL também pode rodar na cabeça, por meio do `esp_lvgl_port`, com o mesmo painel espelhado por baixo.
- **A IMU.** A QMI8658 consegue perceber quando alguém dá um toque no bot. O "Para ir além" do guia 10 descreve como a cabeça enviaria isso de volta sem quebrar a regra de que ela não pede nada à barriga.
- **Brilho à noite.** Menos brilho costuma ser melhor num quarto escuro: o reflexo fica mais fácil de ver e o preto mais transparente. Uma mensagem de brilho vinda da barriga é o próximo passo depois do [guia 10](/pt/bot/uart-protocol/).
- O que o bot guarda, e o que sai da sua rede, é o [guia 12](/pt/bot/secrets-privacy/).
