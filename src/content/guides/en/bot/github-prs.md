---
title: Your GitHub pull requests
description: 'The belly lists the open pull requests waiting for your review: GitHub search over REST, a read-only fine-grained token with the least access, polling within rate limits, and how to revoke it.'
route: bot
order: 8
updated: 2026-11-18
---

## What it does

Next to Narsil's alerts, the belly shows a short list: the open pull requests on GitHub that are waiting for your review. Each row has the repository, the number, the title and who opened it, and the list refreshes every couple of minutes. When someone asks you for a review, it appears on the belly without opening a browser.

The belly gets the list itself, straight from GitHub's REST API, with a token that can only read. The PC, the voice server and Claude are not involved: if the PC is off, the list keeps updating.

## How it works inside

### One search does it

GitHub's [search API](https://docs.github.com/en/rest/search/search) answers "which open pull requests want my review" in one request:

```text
GET https://api.github.com/search/issues?q=is:pr+is:open+review-requested:@me&per_page=10
```

`GET /search/issues` searches issues and pull requests across every repository the token can see. The qualifiers narrow it: `is:pr` keeps only pull requests, `is:open` drops closed and merged ones, and `review-requested:@me` keeps those where you are a requested reviewer; `@me` means the token's owner. `per_page` caps the answer (the maximum is 100; the belly shows 10).

The answer is JSON with `total_count` and an `items` array. For each item the belly reads `title`, `number`, `html_url`, `repository_url` (whose last two parts are the owner and the repository), `user.login`, `updated_at` and `draft`.

A second search with `author:@me` instead of `review-requested:@me` lists your own open pull requests; the belly can alternate between the two.

### The headers

GitHub's REST docs use the same three headers on every request:

| Header                 | Value                         | Why                                                       |
| ---------------------- | ----------------------------- | --------------------------------------------------------- |
| `Authorization`        | `Bearer <token>`              | Who is asking, and so what `@me` means                    |
| `Accept`               | `application/vnd.github+json` | The JSON format the docs recommend                        |
| `X-GitHub-Api-Version` | `2026-03-10`                  | The REST version; without it, GitHub assumes `2022-11-28` |

The [API versions page](https://docs.github.com/en/rest/about-the-rest-api/api-versions) lists `2026-03-10` and `2022-11-28` as the supported versions, and says a request without the header gets `2022-11-28`. GitHub also wants a `User-Agent`; the belly sends `narsil-bot`.

### The token: read-only, least access

The belly uses a [fine-grained personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens), not a classic one. A fine-grained token is limited to the repositories you pick and to the permissions you tick, and it can expire on its own.

GitHub's page of [endpoints available for fine-grained tokens](https://docs.github.com/en/rest/authentication/endpoints-available-for-fine-grained-personal-access-tokens) includes `GET /search/issues`, and the [permissions page](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens) lists no permission of its own for it. The search docs explain the rule instead: you must "have access to the repositories in your search queries". So the token sees:

- **Public repositories, always.** GitHub's page notes that "Tokens always include read-only access to all public repositories on GitHub."
- **Private repositories, only the ones you add** under **Repository access**, with **Pull requests: Read-only** as the only permission. That is the permission GitHub lists for reading pull requests (`GET /repos/{owner}/{repo}/pulls`), and it lets the search see the private ones you chose.

If every repository you review is public, the token needs no permission at all: choose **Public repositories** under **Repository access** and tick nothing. Either way the token cannot write, merge, comment or read code in private repositories.

**Resource owner** matters too. A token owned by you sees your repositories; to see an organization's private ones, the organization must be the resource owner, and its owners may have to approve the token.

### How to create, expire and revoke it

From GitHub's page on managing tokens:

1. **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**, or go straight to [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens).
2. Give it a name that says where it lives, such as `narsil-bot belly`.
3. Under **Expiration**, pick a date. The default is 30 days. A shorter life means a leaked token stops working sooner; when it expires, the belly's list shows an error until you put a new one in.
4. Choose the **Resource owner**, the **Repository access** and the single permission above, then **Generate token**. GitHub shows the token once; it starts with `github_pat_`.

To revoke it, open the same page and click **Delete** next to the token. The belly's requests fail from then on, which is exactly what you want if the board is lost or the token leaks.

### Polling, and staying inside the limits

The search endpoints have their own rate limit: 30 requests per minute for an authenticated user. The belly asks every two minutes, a small fraction of that, and one request at a time, which GitHub's [best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api) ask for to avoid secondary rate limits. The same page asks you to "Poll only as often as you need to, on a fixed schedule", and to wait at least the seconds in an `x-poll-interval` header when one comes back.

It also explains conditional requests. When a response carries an `etag` header, the belly keeps it and sends it back as `If-None-Match` next time. If nothing changed, GitHub answers `304 Not Modified` with no body, and "Making a conditional request does not count against your primary rate limit if a `304` response is returned." The belly keeps the list it already has.

On `403` or `429`, the belly waits for the time in `retry-after` (or `x-ratelimit-reset`) before trying again. On `401`, the token is wrong, expired or deleted, and the screen says so.

### On the belly

The request uses ESP-IDF's [`esp_http_client`](https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/api-reference/protocols/esp_http_client.html) with the certificate bundle (`crt_bundle_attach = esp_crt_bundle_attach`), like the ntfy stream in guide 7. This time the answer is short, so it uses `esp_http_client_perform`, collects the body in the `HTTP_EVENT_ON_DATA` event, catches the `etag` in `HTTP_EVENT_ON_HEADER` (where `evt->header_key` and `evt->header_value` hold each response header), and reads the status with `esp_http_client_get_status_code` after `perform` returns.

The token lives in NVS, in Xiaozhi's `Settings` namespace `narsil` under the key `gh_token`, typed once on the belly's settings screen ([guide 9](/en/bot/belly-ui/)). It is never compiled into the firmware or written to the log.

## Build it with Claude

Ask Claude for a function on the belly that asks GitHub's search API for the open pull requests that request your review, and shows them on the screen. The one idea it must get right is that the token can only read, with the least access, and lives in NVS on the belly, never in the code or the log.

### A prompt you can use

The following prompt was written for this guide as a suggestion. It is not the conversation used to build the bot.

> On an ESP32-P4 with ESP-IDF 6, I want to show the open GitHub pull requests that request my review. Check in GitHub's REST docs whether `GET /search/issues` works with a fine-grained personal access token and which permission it needs, the current `X-GitHub-Api-Version`, the search rate limit and how conditional requests with `If-None-Match` work. Then write a function that calls it with `esp_http_client` and the certificate bundle, reads the token from NVS, keeps the ETag, handles 304, 401, 403 and 429, and parses `items` with cJSON. Tell me how to create the token with the least access and how to revoke it.

### What to check in Claude's answer

1. It makes one request, `GET /search/issues` with `is:pr+is:open+review-requested:@me`, and sends the `Authorization`, `Accept`, `X-GitHub-Api-Version` (`2026-03-10`) and `User-Agent` headers.
2. The token is a fine-grained personal access token with an expiry date: no permission at all for public repositories, or **Pull requests: Read-only** only for the private ones you add. Claude also tells you how to revoke it: **Delete** next to the token on GitHub's token page.
3. The token is read from NVS (namespace `narsil`, key `gh_token`) and sent only in the `Authorization` header. It is never compiled into the firmware or printed to the log, not even the header.
4. It asks every two minutes, one request at a time. It keeps the `etag`, sends it back as `If-None-Match`, and keeps the list it has on a `304`.
5. It shows `401` on the screen as a wrong, expired or deleted token, and on `403` or `429` it waits for `retry-after` (or `x-ratelimit-reset`) before trying again. HTTPS uses the certificate bundle.

If a check fails, tell Claude what you see: "the list is empty, but I have a review request on a private repository".

### How the author asked for it

The pull requests came with the bot's purpose: a belly screen that shows what needs you, next to Narsil's tasks. Where the network work happens was settled by the author's answer about the head:

> Por cable desde la panza

In English: "by cable, from the belly".

So the belly calls GitHub itself. Spec S6 then set the rule for every secret, the GitHub token included: it lives in NVS or local configuration, never in the repository.

The rest was the AI's job to look up, not the author's to decide: which endpoint lists the pull requests that need you, whether a fine-grained token can call it, and which permission is the least that works. The AI read GitHub's search docs and its pages of endpoints and permissions for fine-grained tokens, and chose search with a read-only **Pull requests** permission only where private repositories need it.

## Reference code

This is one correct answer, written for this guide. Read it to understand how the pieces fit together and to compare it with what Claude wrote for you: Claude may choose other names or another order and still be right.

A function for the belly, in C++ next to Xiaozhi's code (MIT, like the site's own examples). `ShowPullRequest` and `ShowGithubError` are the screen's functions from [guide 9](/en/bot/belly-ui/); a task calls `PollPullRequests()` every two minutes:

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

`repository_url` looks like `https://api.github.com/repos/octo-org/example-repo`, so the text after `/repos/` is the `owner/repo` the row shows. The 64 KB cap on the body is a guard: ten search results fit well under it.

A test token on the PC, for the checks below, is made-up here: `github_pat_EXAMPLE_not_a_real_token`.

## Common mistakes and how to test it

- **A classic token with the `repo` scope.** It works, and it can write to every repository you have. Use a fine-grained token with read-only access.
- **An empty list with private repositories.** The token only sees the private repositories you added under **Repository access**, with **Pull requests: Read-only**.
- **`401 Unauthorized`.** The token is mistyped, expired or deleted. Make a new one and type it again on the belly.
- **`403` after many requests.** Too many searches in a minute, or requests sent in parallel. One request every two minutes, one at a time.
- **Spaces in the query.** The URL must not contain raw spaces; the qualifiers are joined with `+`.
- **No HTTPS.** Without the certificate bundle, the TLS handshake with `api.github.com` fails. Keep `crt_bundle_attach`, and `CONFIG_MBEDTLS_CERTIFICATE_BUNDLE` enabled in menuconfig.
- **The token in a log line.** Never print the `Authorization` header or the NVS value, even while debugging.

To test from the PC first, with your token in place of the example:

```powershell
curl.exe -s -H "Authorization: Bearer github_pat_EXAMPLE_not_a_real_token" -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2026-03-10" "https://api.github.com/search/issues?q=is:pr+is:open+review-requested:@me&per_page=10"
```

A JSON answer with `total_count` means the token works. Add `-i` to see the `etag` header, then repeat with `-H "If-None-Match: <that etag>"` to get a `304`. On the belly, ask someone (or a second account) to request your review on a test pull request: within two minutes it appears on the screen. Delete the token on GitHub and the next poll shows the `401` error.

## Going further

- **More lists.** `author:@me` shows your own open pull requests; adding `draft:false` hides drafts. Each list is one more search, so keep the total well under 30 a minute.
- **Checks and reviews.** The pulls endpoints (`GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews`, for example) give the review state of each pull request; they also need **Pull requests: Read-only**.
- **Notifications instead of search.** GitHub's notifications API answers "what happened to me", but GitHub does not list it among the endpoints for fine-grained tokens, so it would need a classic token.
- **Rotation.** With a 30-day token, put a reminder in your calendar. The belly can show the expiry date if you type it with the token.
- [Guide 9](/en/bot/belly-ui/) draws both lists, alerts and pull requests, on the belly screen.
