---
title: Le tue pull request di GitHub
description: 'La pancia elenca le pull request aperte in attesa della tua review: la ricerca di GitHub via REST, un token fine-grained di sola lettura con il minimo accesso, il polling nei limiti e come revocarlo.'
route: bot
order: 8
updated: 2026-11-18
---

## Cosa fa

Accanto agli avvisi di Narsil, la pancia mostra una breve lista: le pull request aperte su GitHub che aspettano la tua review. Ogni riga ha il repository, il numero, il titolo e chi l'ha aperta, e la lista si aggiorna ogni paio di minuti. Quando qualcuno ti chiede una review, compare sulla pancia senza aprire un browser.

La pancia ottiene la lista da sola, direttamente dalla REST API di GitHub, con un token che può solo leggere. Il PC, il server vocale e Claude non sono coinvolti: se il PC è spento, la lista continua ad aggiornarsi.

## Come funziona dentro

### Basta una ricerca

L'[API di ricerca](https://docs.github.com/en/rest/search/search) di GitHub risponde a "quali pull request aperte vogliono la mia review" con una sola richiesta:

```text
GET https://api.github.com/search/issues?q=is:pr+is:open+review-requested:@me&per_page=10
```

`GET /search/issues` cerca issue e pull request in tutti i repository che il token può vedere. I qualificatori la restringono: `is:pr` tiene solo le pull request, `is:open` scarta quelle chiuse e unite, e `review-requested:@me` tiene quelle in cui sei tra i revisori richiesti; `@me` indica il proprietario del token. `per_page` limita la risposta (il massimo è 100; la pancia ne mostra 10).

La risposta è un JSON con `total_count` e un array `items`. Per ogni elemento la pancia legge `title`, `number`, `html_url`, `repository_url` (le cui ultime due parti sono il proprietario e il repository), `user.login`, `updated_at` e `draft`.

Una seconda ricerca con `author:@me` al posto di `review-requested:@me` elenca le tue pull request aperte; la pancia può alternare le due.

### Gli header

La documentazione REST di GitHub usa gli stessi tre header in ogni richiesta:

| Header                 | Valore                        | Perché                                                      |
| ---------------------- | ----------------------------- | ----------------------------------------------------------- |
| `Authorization`        | `Bearer <token>`              | Chi sta chiedendo, e quindi cosa significa `@me`            |
| `Accept`               | `application/vnd.github+json` | Il formato JSON che raccomanda la documentazione            |
| `X-GitHub-Api-Version` | `2026-03-10`                  | La versione REST; senza di essa, GitHub assume `2022-11-28` |

La [pagina delle versioni dell'API](https://docs.github.com/en/rest/about-the-rest-api/api-versions) elenca `2026-03-10` e `2022-11-28` come versioni supportate, e dice che una richiesta senza l'header riceve `2022-11-28`. GitHub vuole anche uno `User-Agent`; la pancia invia `narsil-bot`.

### Il token: sola lettura, accesso minimo

La pancia usa un [fine-grained personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens), non uno classico. Un token fine-grained è limitato ai repository che scegli e ai permessi che spunti, e può scadere da solo.

La pagina di GitHub degli [endpoint disponibili per i token fine-grained](https://docs.github.com/en/rest/authentication/endpoints-available-for-fine-grained-personal-access-tokens) include `GET /search/issues`, e la [pagina dei permessi](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens) non elenca alcun permesso specifico per esso. La documentazione della ricerca spiega invece la regola: devi "have access to the repositories in your search queries" (avere accesso ai repository nelle tue query di ricerca). Quindi il token vede:

- **I repository pubblici, sempre.** La pagina di GitHub nota che "Tokens always include read-only access to all public repositories on GitHub." (I token includono sempre l'accesso in sola lettura a tutti i repository pubblici su GitHub.)
- **I repository privati, solo quelli che aggiungi** sotto **Repository access**, con **Pull requests: Read-only** come unico permesso. È il permesso che GitHub elenca per leggere le pull request (`GET /repos/{owner}/{repo}/pulls`), e permette alla ricerca di vedere quelli privati che hai scelto.

Se tutti i repository di cui fai review sono pubblici, il token non ha bisogno di alcun permesso: scegli **Public repositories** sotto **Repository access** e non spuntare niente. In entrambi i casi il token non può scrivere, unire, commentare né leggere codice nei repository privati.

Anche il **Resource owner** conta. Un token di tua proprietà vede i tuoi repository; per vedere quelli privati di un'organizzazione, l'organizzazione deve essere il resource owner, e i suoi proprietari potrebbero dover approvare il token.

### Come crearlo, farlo scadere e revocarlo

Dalla pagina di GitHub sulla gestione dei token:

1. **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**, oppure vai direttamente su [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens).
2. Dagli un nome che dica dove vive, come `narsil-bot belly`.
3. Sotto **Expiration**, scegli una data. Il valore predefinito è 30 giorni. Una vita più breve significa che un token trapelato smette di funzionare prima; quando scade, la lista della pancia mostra un errore finché non ne inserisci uno nuovo.
4. Scegli il **Resource owner**, il **Repository access** e l'unico permesso indicato sopra, poi **Generate token**. GitHub mostra il token una sola volta; inizia con `github_pat_`.

Per revocarlo, apri la stessa pagina e fai clic su **Delete** accanto al token. Da quel momento le richieste della pancia falliscono, che è esattamente ciò che vuoi se la scheda va persa o il token trapela.

### Il polling, restando nei limiti

Gli endpoint di ricerca hanno un proprio limite di frequenza: 30 richieste al minuto per un utente autenticato. La pancia chiede ogni due minuti, una piccola frazione di quel limite, e una richiesta alla volta, come chiedono le [best practice](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api) di GitHub per evitare i limiti secondari. La stessa pagina chiede di "Poll only as often as you need to, on a fixed schedule" (fare polling solo quanto serve, a intervalli fissi), e di attendere almeno i secondi indicati in un header `x-poll-interval` quando ne arriva uno.

Spiega anche le richieste condizionali. Quando una risposta porta un header `etag`, la pancia lo conserva e lo rimanda come `If-None-Match` la volta successiva. Se non è cambiato niente, GitHub risponde `304 Not Modified` senza corpo, e "Making a conditional request does not count against your primary rate limit if a `304` response is returned." (una richiesta condizionale non conta per il limite di frequenza primario se viene restituita una risposta `304`). La pancia mantiene la lista che ha già.

Su `403` o `429`, la pancia attende il tempo indicato in `retry-after` (o `x-ratelimit-reset`) prima di riprovare. Su `401`, il token è sbagliato, scaduto o eliminato, e lo schermo lo dice.

### Sulla pancia

La richiesta usa [`esp_http_client`](https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/api-reference/protocols/esp_http_client.html) di ESP-IDF con il bundle di certificati (`crt_bundle_attach = esp_crt_bundle_attach`), come lo stream di ntfy della guida 7. Questa volta la risposta è breve, quindi usa `esp_http_client_perform`, raccoglie il corpo nell'evento `HTTP_EVENT_ON_DATA`, cattura l'`etag` in `HTTP_EVENT_ON_HEADER` (dove `evt->header_key` ed `evt->header_value` contengono ogni header della risposta) e legge lo stato con `esp_http_client_get_status_code` dopo che `perform` è tornata.

Il token vive nella NVS, nel namespace `narsil` di `Settings` di Xiaozhi sotto la chiave `gh_token`, scritto una volta nella schermata delle impostazioni della pancia ([guida 9](/it/bot/belly-ui/)). Non viene mai compilato nel firmware né scritto nel log.

## Costruiscila con Claude

Chiedi a Claude una funzione sulla pancia che chieda all'API di ricerca di GitHub le pull request aperte che richiedono la tua revisione, e le mostri sullo schermo. L'unica idea che deve fare bene è che il token può solo leggere, con l'accesso minimo, e vive nella NVS sulla pancia, mai nel codice né nel log.

### Un prompt che puoi usare

Il prompt seguente è stato scritto per questa guida come suggerimento. Non è la conversazione usata per preparare il bot.

> Su un ESP32-P4 con ESP-IDF 6, voglio mostrare le pull request aperte di GitHub che richiedono la mia review. Verifica nella documentazione REST di GitHub se `GET /search/issues` funziona con un fine-grained personal access token e quale permesso richiede, l'attuale `X-GitHub-Api-Version`, il limite di frequenza della ricerca e come funzionano le richieste condizionali con `If-None-Match`. Poi scrivi una funzione che la chiami con `esp_http_client` e il bundle di certificati, legga il token dalla NVS, conservi l'ETag, gestisca 304, 401, 403 e 429 e analizzi `items` con cJSON. Dimmi come creare il token con l'accesso minimo e come revocarlo.

### Cosa controllare nella risposta di Claude

1. Fa una sola richiesta, `GET /search/issues` con `is:pr+is:open+review-requested:@me`, e invia gli header `Authorization`, `Accept`, `X-GitHub-Api-Version` (`2026-03-10`) e `User-Agent`.
2. Il token è un fine-grained personal access token con una data di scadenza: nessun permesso per i repository pubblici, oppure solo **Pull requests: Read-only** per i repository privati che aggiungi. Claude ti spiega anche come revocarlo: **Delete** accanto al token nella pagina dei token di GitHub.
3. Il token viene letto dalla NVS (namespace `narsil`, chiave `gh_token`) e inviato solo nell'header `Authorization`. Non viene mai compilato nel firmware né stampato nel log, nemmeno l'header.
4. Chiede ogni due minuti, una richiesta alla volta. Conserva l'`etag`, lo rimanda come `If-None-Match` e tiene la lista che ha in caso di `304`.
5. Mostra `401` sullo schermo come token sbagliato, scaduto o eliminato, e con `403` o `429` aspetta `retry-after` (o `x-ratelimit-reset`) prima di riprovare. L'HTTPS usa il bundle di certificati.

Se un controllo fallisce, di' a Claude cosa vedi: "la lista è vuota, ma ho una richiesta di revisione su un repository privato".

### Come l'ha chiesta l'autore

Le pull request sono arrivate con lo scopo del bot: uno schermo nella pancia che mostra ciò che ha bisogno di te, accanto ai compiti di Narsil. Dove avviene il lavoro di rete l'ha deciso la risposta di chi ha creato Narsil sulla testa:

> Por cable desde la panza

In italiano: "Via cavo dalla pancia".

Quindi la pancia chiama GitHub da sola. La specifica S6 ha poi fissato la regola per ogni segreto, token di GitHub compreso: vive nella NVS o nella configurazione locale, mai nel repository.

Il resto toccava all'IA verificarlo, non a chi ha creato Narsil deciderlo: quale endpoint elenca le pull request che hanno bisogno di te, se un token fine-grained può chiamarlo e qual è il permesso minimo che funziona. L'IA ha letto la documentazione della ricerca di GitHub e le sue pagine di endpoint e permessi per i token fine-grained, e ha scelto la ricerca con un permesso **Pull requests** di sola lettura solo dove i repository privati lo richiedono.

## Codice di riferimento

Questa è una risposta corretta, scritta per questa guida. Leggila per capire come si incastrano i pezzi e per confrontarla con ciò che Claude ha scritto per te: Claude può scegliere altri nomi o un altro ordine ed essere comunque nel giusto.

Una funzione per la pancia, in C++ accanto al codice di Xiaozhi (MIT, come gli esempi del sito). `ShowPullRequest` e `ShowGithubError` sono le funzioni dello schermo della [guida 9](/it/bot/belly-ui/); un task chiama `PollPullRequests()` ogni due minuti:

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

`repository_url` ha la forma `https://api.github.com/repos/octo-org/example-repo`, quindi il testo dopo `/repos/` è l'`owner/repo` che mostra la riga. Il limite di 64 KB sul corpo è una protezione: dieci risultati di ricerca ci stanno ampiamente.

Un token di prova sul PC, per i controlli qui sotto, è inventato: `github_pat_EXAMPLE_not_a_real_token`.

## Errori comuni e come testarlo

- **Un token classico con lo scope `repo`.** Funziona, e può scrivere in tutti i tuoi repository. Usa un token fine-grained con accesso in sola lettura.
- **Una lista vuota con repository privati.** Il token vede solo i repository privati che hai aggiunto sotto **Repository access**, con **Pull requests: Read-only**.
- **`401 Unauthorized`.** Il token è scritto male, scaduto o eliminato. Creane uno nuovo e scrivilo di nuovo sulla pancia.
- **`403` dopo molte richieste.** Troppe ricerche in un minuto, o richieste inviate in parallelo. Una richiesta ogni due minuti, una alla volta.
- **Spazi nella query.** L'URL non deve contenere spazi grezzi; i qualificatori sono uniti con `+`.
- **Niente HTTPS.** Senza il bundle di certificati, l'handshake TLS con `api.github.com` fallisce. Mantieni `crt_bundle_attach`, e `CONFIG_MBEDTLS_CERTIFICATE_BUNDLE` attivo in menuconfig.
- **Il token in una riga di log.** Non stampare mai l'header `Authorization` o il valore in NVS, nemmeno durante il debug.

Per testare prima dal PC, con il tuo token al posto dell'esempio:

```powershell
curl.exe -s -H "Authorization: Bearer github_pat_EXAMPLE_not_a_real_token" -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2026-03-10" "https://api.github.com/search/issues?q=is:pr+is:open+review-requested:@me&per_page=10"
```

Una risposta JSON con `total_count` significa che il token funziona. Aggiungi `-i` per vedere l'header `etag`, poi ripeti con `-H "If-None-Match: <quell'etag>"` per ottenere un `304`. Sulla pancia, chiedi a qualcuno (o a un secondo account) di richiedere la tua review su una pull request di prova: entro due minuti compare sullo schermo. Elimina il token su GitHub e il polling successivo mostra l'errore `401`.

## Per andare oltre

- **Più liste.** `author:@me` mostra le tue pull request aperte; aggiungere `draft:false` nasconde le bozze. Ogni lista è una ricerca in più, quindi tieni il totale ben sotto le 30 al minuto.
- **Check e review.** Gli endpoint delle pull (`GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews`, per esempio) danno lo stato di review di ogni pull request; anche loro richiedono **Pull requests: Read-only**.
- **Notifiche invece della ricerca.** L'API delle notifiche di GitHub risponde a "cosa mi è successo", ma GitHub non la elenca tra gli endpoint per i token fine-grained, quindi richiederebbe un token classico.
- **Rotazione.** Con un token da 30 giorni, metti un promemoria nel calendario. La pancia può mostrare la data di scadenza se la scrivi insieme al token.
- La [guida 9](/it/bot/belly-ui/) disegna entrambe le liste, avvisi e pull request, sullo schermo della pancia.
