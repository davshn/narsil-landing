---
title: Tus pull requests de GitHub
description: 'La panza lista los pull requests abiertos que esperan tu revisión: búsqueda REST de GitHub, un token fine-grained de solo lectura con mínimo acceso, consultas dentro de los límites y cómo revocarlo.'
route: bot
order: 8
updated: 2026-11-18
---

## Qué hace

Junto a los avisos de Narsil, la panza muestra una lista corta: los pull requests abiertos en GitHub que esperan tu revisión. Cada fila tiene el repositorio, el número, el título y quién lo abrió, y la lista se actualiza cada par de minutos. Cuando alguien te pide una revisión, aparece en la panza sin abrir un navegador.

La panza obtiene la lista por su cuenta, directamente de la API REST de GitHub, con un token que solo puede leer. El PC, el servidor de voz y Claude no intervienen: si el PC está apagado, la lista se sigue actualizando.

## Cómo funciona por dentro

### Basta una búsqueda

La [API de búsqueda](https://docs.github.com/en/rest/search/search) de GitHub responde "qué pull requests abiertos quieren mi revisión" en una sola petición:

```text
GET https://api.github.com/search/issues?q=is:pr+is:open+review-requested:@me&per_page=10
```

`GET /search/issues` busca issues y pull requests en todos los repositorios que el token puede ver. Los calificadores la acotan: `is:pr` conserva solo los pull requests, `is:open` descarta los cerrados y los fusionados, y `review-requested:@me` conserva aquellos en los que se te pidió revisión; `@me` significa el dueño del token. `per_page` limita la respuesta (el máximo es 100; la panza muestra 10).

La respuesta es JSON con `total_count` y un arreglo `items`. De cada elemento la panza lee `title`, `number`, `html_url`, `repository_url` (cuyas dos últimas partes son el dueño y el repositorio), `user.login`, `updated_at` y `draft`.

Una segunda búsqueda con `author:@me` en lugar de `review-requested:@me` lista tus propios pull requests abiertos; la panza puede alternar entre las dos.

### Las cabeceras

La documentación REST de GitHub usa las mismas tres cabeceras en cada petición:

| Cabecera               | Valor                         | Por qué                                                 |
| ---------------------- | ----------------------------- | ------------------------------------------------------- |
| `Authorization`        | `Bearer <token>`              | Quién pregunta, y por lo tanto qué significa `@me`      |
| `Accept`               | `application/vnd.github+json` | El formato JSON que recomienda la documentación         |
| `X-GitHub-Api-Version` | `2026-03-10`                  | La versión de REST; sin ella, GitHub asume `2022-11-28` |

La [página de versiones de la API](https://docs.github.com/en/rest/about-the-rest-api/api-versions) lista `2026-03-10` y `2022-11-28` como las versiones soportadas, y dice que una petición sin la cabecera recibe `2022-11-28`. GitHub también quiere un `User-Agent`; la panza envía `narsil-bot`.

### El token: solo lectura, mínimo acceso

La panza usa un [fine-grained personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens), no uno clásico. Un token fine-grained está limitado a los repositorios que eliges y a los permisos que marcas, y puede caducar por sí solo.

La página de GitHub de [endpoints disponibles para tokens fine-grained](https://docs.github.com/en/rest/authentication/endpoints-available-for-fine-grained-personal-access-tokens) incluye `GET /search/issues`, y la [página de permisos](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens) no le asigna ningún permiso propio. La documentación de búsqueda explica la regla en su lugar: debes "have access to the repositories in your search queries" (tener acceso a los repositorios de tus consultas de búsqueda). Así que el token ve:

- **Los repositorios públicos, siempre.** La página de GitHub indica que "Tokens always include read-only access to all public repositories on GitHub." (los tokens siempre incluyen acceso de solo lectura a todos los repositorios públicos de GitHub).
- **Los repositorios privados, solo los que añadas** en **Repository access**, con **Pull requests: Read-only** como único permiso. Ese es el permiso que GitHub lista para leer pull requests (`GET /repos/{owner}/{repo}/pulls`), y permite que la búsqueda vea los privados que elegiste.

Si todos los repositorios que revisas son públicos, el token no necesita ningún permiso: elige **Public repositories** en **Repository access** y no marques nada. En cualquier caso, el token no puede escribir, fusionar, comentar ni leer código en repositorios privados.

**Resource owner** también importa. Un token cuyo dueño eres tú ve tus repositorios; para ver los privados de una organización, la organización debe ser el resource owner, y es posible que sus dueños tengan que aprobar el token.

### Cómo crearlo, hacer que caduque y revocarlo

Según la página de GitHub sobre la gestión de tokens:

1. **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**, o ve directamente a [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens).
2. Dale un nombre que diga dónde vive, como `narsil-bot belly`.
3. En **Expiration**, elige una fecha. El valor por defecto es 30 días. Una vida más corta significa que un token filtrado deja de funcionar antes; cuando caduca, la lista de la panza muestra un error hasta que pongas uno nuevo.
4. Elige el **Resource owner**, el **Repository access** y el único permiso de arriba, y después **Generate token**. GitHub muestra el token una sola vez; empieza con `github_pat_`.

Para revocarlo, abre la misma página y haz clic en **Delete** junto al token. Las peticiones de la panza fallan a partir de entonces, que es justo lo que quieres si se pierde la placa o se filtra el token.

### Consultas periódicas, dentro de los límites

Los endpoints de búsqueda tienen su propio límite de uso: 30 peticiones por minuto para un usuario autenticado. La panza pregunta cada dos minutos, una pequeña fracción de eso, y de una petición en una, como pide la página de [buenas prácticas](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api) de GitHub para evitar los límites secundarios. La misma página pide "Poll only as often as you need to, on a fixed schedule" (consultar solo tan seguido como haga falta, con un calendario fijo), y esperar al menos los segundos de una cabecera `x-poll-interval` cuando llega una.

También explica las peticiones condicionales. Cuando una respuesta trae una cabecera `etag`, la panza la guarda y la devuelve como `If-None-Match` la vez siguiente. Si nada cambió, GitHub responde `304 Not Modified` sin cuerpo, y "Making a conditional request does not count against your primary rate limit if a `304` response is returned." (una petición condicional no cuenta para tu límite principal si se devuelve una respuesta `304`). La panza conserva la lista que ya tiene.

Con `403` o `429`, la panza espera el tiempo de `retry-after` (o de `x-ratelimit-reset`) antes de volver a intentarlo. Con `401`, el token es incorrecto, caducó o se borró, y la pantalla lo dice.

### En la panza

La petición usa [`esp_http_client`](https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/api-reference/protocols/esp_http_client.html) de ESP-IDF con el paquete de certificados (`crt_bundle_attach = esp_crt_bundle_attach`), como el stream de ntfy de la guía 7. Esta vez la respuesta es corta, así que usa `esp_http_client_perform`, junta el cuerpo en el evento `HTTP_EVENT_ON_DATA`, captura el `etag` en `HTTP_EVENT_ON_HEADER` (donde `evt->header_key` y `evt->header_value` contienen cada cabecera de la respuesta), y lee el código de estado con `esp_http_client_get_status_code` cuando `perform` termina.

El token vive en la NVS, en el espacio de nombres `narsil` de `Settings` de Xiaozhi, con la clave `gh_token`, y se escribe una vez en la pantalla de ajustes de la panza (guía 9). Nunca se compila en el firmware ni se escribe en el log.

## Cómo se le pidió a la IA

Los pull requests llegaron con el propósito del bot: una pantalla en la panza que muestra lo que te necesita, junto a las tareas de Narsil. Dónde ocurre el trabajo de red quedó resuelto con la respuesta de quien creó Narsil sobre la cabeza:

> Por cable desde la panza

Así que la panza llama a GitHub por su cuenta. La especificación S6 fijó después la regla para todos los secretos, el token de GitHub incluido: vive en la NVS o en la configuración local, nunca en el repositorio.

El resto le tocaba a la IA averiguarlo, no a quien creó Narsil decidirlo: qué endpoint lista los pull requests que te necesitan, si un token fine-grained puede llamarlo y cuál es el permiso mínimo que funciona. La IA leyó la documentación de búsqueda de GitHub y sus páginas de endpoints y permisos para tokens fine-grained, y eligió la búsqueda con un permiso **Pull requests** de solo lectura únicamente donde los repositorios privados lo necesitan.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es la conversación con la que se construyó el bot.

> En un ESP32-P4 con ESP-IDF 6, quiero mostrar los pull requests abiertos de GitHub que piden mi revisión. Comprueba en la documentación REST de GitHub si `GET /search/issues` funciona con un fine-grained personal access token y qué permiso necesita, el `X-GitHub-Api-Version` actual, el límite de uso de la búsqueda y cómo funcionan las peticiones condicionales con `If-None-Match`. Después escribe una función que lo llame con `esp_http_client` y el paquete de certificados, lea el token de la NVS, guarde el ETag, maneje 304, 401, 403 y 429, y analice `items` con cJSON. Dime cómo crear el token con el mínimo acceso y cómo revocarlo.

## El código mínimo

Una función para la panza, en C++ junto al código de Xiaozhi (MIT, como los ejemplos propios del sitio). `ShowPullRequest` y `ShowGithubError` son las funciones de la pantalla de la guía 9; una tarea llama a `PollPullRequests()` cada dos minutos:

```cpp
#include <cJSON.h>
#include <esp_crt_bundle.h>
#include <esp_http_client.h>
#include <cstring>
#include <string>
#include <strings.h>

#include "settings.h"

void ShowPullRequest(int index, const char* repo, int number, const char* title, const char* author);
void ShowGithubError(int status);

static std::string body;
static std::string etag;

static esp_err_t OnEvent(esp_http_client_event_t* evt) {
    if (evt->event_id == HTTP_EVENT_ON_HEADER && strcasecmp(evt->header_key, "etag") == 0) {
        etag = evt->header_value;
    } else if (evt->event_id == HTTP_EVENT_ON_DATA && body.size() < 64 * 1024) {
        body.append((const char*)evt->data, evt->data_len);
    }
    return ESP_OK;
}

int PollPullRequests() {
    Settings settings("narsil");
    std::string token = settings.GetString("gh_token");
    if (token.empty()) return 0;

    esp_http_client_config_t config = {};
    config.url = "https://api.github.com/search/issues?q=is:pr+is:open+review-requested:@me&per_page=10";
    config.crt_bundle_attach = esp_crt_bundle_attach;
    config.event_handler = OnEvent;
    config.user_agent = "narsil-bot";
    esp_http_client_handle_t client = esp_http_client_init(&config);

    std::string auth = "Bearer " + token;
    esp_http_client_set_header(client, "Authorization", auth.c_str());
    esp_http_client_set_header(client, "Accept", "application/vnd.github+json");
    esp_http_client_set_header(client, "X-GitHub-Api-Version", "2026-03-10");
    std::string previous_etag = etag;
    if (!previous_etag.empty()) {
        esp_http_client_set_header(client, "If-None-Match", previous_etag.c_str());
    }

    body.clear();
    int status = 0;
    if (esp_http_client_perform(client) == ESP_OK) {
        status = esp_http_client_get_status_code(client);
    }
    esp_http_client_cleanup(client);

    if (status == 304) return status;
    if (status != 200) {
        etag = previous_etag;
        ShowGithubError(status);
        return status;
    }

    cJSON* root = cJSON_Parse(body.c_str());
    cJSON* items = cJSON_GetObjectItem(root, "items");
    for (int i = 0; i < cJSON_GetArraySize(items); i++) {
        cJSON* item = cJSON_GetArrayItem(items, i);
        const char* repo_url = cJSON_GetStringValue(cJSON_GetObjectItem(item, "repository_url"));
        const char* repo = repo_url ? strstr(repo_url, "/repos/") : nullptr;
        ShowPullRequest(i, repo ? repo + 7 : "",
                        (int)cJSON_GetNumberValue(cJSON_GetObjectItem(item, "number")),
                        cJSON_GetStringValue(cJSON_GetObjectItem(item, "title")),
                        cJSON_GetStringValue(cJSON_GetObjectItem(cJSON_GetObjectItem(item, "user"), "login")));
    }
    cJSON_Delete(root);
    return status;
}
```

`repository_url` tiene la forma `https://api.github.com/repos/octo-org/example-repo`, así que el texto que va después de `/repos/` es el `owner/repo` que muestra la fila. El límite de 64 KB para el cuerpo es una protección: diez resultados de búsqueda caben de sobra.

Un token de prueba en el PC, para las comprobaciones de abajo, es inventado aquí: `github_pat_EXAMPLE_not_a_real_token`.

## Errores comunes y cómo probarlo

- **Un token clásico con el scope `repo`.** Funciona, y puede escribir en todos los repositorios a los que tienes acceso. Usa un token fine-grained con acceso de solo lectura.
- **Una lista vacía con repositorios privados.** El token solo ve los repositorios privados que añadiste en **Repository access**, con **Pull requests: Read-only**.
- **`401 Unauthorized`.** El token está mal escrito, caducó o se borró. Crea uno nuevo y vuelve a escribirlo en la panza.
- **`403` después de muchas peticiones.** Demasiadas búsquedas en un minuto, o peticiones enviadas en paralelo. Una petición cada dos minutos, de una en una.
- **Espacios en la consulta.** La URL no debe contener espacios sin codificar; los calificadores se unen con `+`.
- **Sin HTTPS.** Sin el paquete de certificados, el handshake TLS con `api.github.com` falla. Mantén `crt_bundle_attach`, y `CONFIG_MBEDTLS_CERTIFICATE_BUNDLE` activado en menuconfig.
- **El token en una línea del log.** Nunca imprimas la cabecera `Authorization` ni el valor de la NVS, ni siquiera mientras depuras.

Para probarlo primero desde el PC, con tu token en lugar del de ejemplo:

```powershell
curl.exe -s -H "Authorization: Bearer github_pat_EXAMPLE_not_a_real_token" -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2026-03-10" "https://api.github.com/search/issues?q=is:pr+is:open+review-requested:@me&per_page=10"
```

Una respuesta JSON con `total_count` significa que el token funciona. Añade `-i` para ver la cabecera `etag`, y después repite con `-H "If-None-Match: <ese etag>"` para obtener un `304`. En la panza, pide a alguien (o a una segunda cuenta) que solicite tu revisión en un pull request de prueba: en menos de dos minutos aparece en la pantalla. Borra el token en GitHub y la siguiente consulta muestra el error `401`.

## Para ir más lejos

- **Más listas.** `author:@me` muestra tus propios pull requests abiertos; añadir `draft:false` oculta los borradores. Cada lista es una búsqueda más, así que mantén el total muy por debajo de 30 por minuto.
- **Checks y revisiones.** Los endpoints de pulls (`GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews`, por ejemplo) dan el estado de revisión de cada pull request; también necesitan **Pull requests: Read-only**.
- **Notificaciones en lugar de búsqueda.** La API de notificaciones de GitHub responde "qué me pasó a mí", pero GitHub no la lista entre los endpoints para tokens fine-grained, así que necesitaría un token clásico.
- **Rotación.** Con un token de 30 días, pon un recordatorio en tu calendario. La panza puede mostrar la fecha de caducidad si la escribes junto con el token.
- La guía 9 dibuja las dos listas, avisos y pull requests, en la pantalla de la panza, en la [ruta del bot](/es/bot/).
