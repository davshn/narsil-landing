---
title: Vos pull requests GitHub
description: 'Le ventre liste les pull requests ouvertes qui attendent votre revue : la recherche GitHub en REST, un token fine-grained en lecture seule, un sondage dans les limites, et sa révocation.'
route: bot
order: 8
updated: 2026-11-18
---

## Ce que ça fait

À côté des alertes de Narsil, le ventre affiche une courte liste : les pull requests ouvertes sur GitHub qui attendent votre revue. Chaque ligne indique le dépôt, le numéro, le titre et qui l’a ouverte, et la liste se rafraîchit toutes les deux minutes environ. Quand quelqu’un vous demande une revue, elle apparaît sur le ventre sans ouvrir de navigateur.

Le ventre obtient la liste lui-même, directement depuis l’API REST de GitHub, avec un token qui ne peut que lire. Le PC, le serveur vocal et Claude n’interviennent pas : si le PC est éteint, la liste continue de se mettre à jour.

## Comment ça marche à l’intérieur

### Une seule recherche suffit

L’[API de recherche](https://docs.github.com/en/rest/search/search) de GitHub répond à « quelles pull requests ouvertes veulent ma revue » en une seule requête :

```text
GET https://api.github.com/search/issues?q=is:pr+is:open+review-requested:@me&per_page=10
```

`GET /search/issues` cherche dans les issues et les pull requests de tous les dépôts que le token peut voir. Les qualificatifs affinent la recherche : `is:pr` ne garde que les pull requests, `is:open` écarte celles qui sont fermées ou fusionnées, et `review-requested:@me` garde celles où vous êtes un relecteur demandé ; `@me` désigne le propriétaire du token. `per_page` plafonne la réponse (le maximum est 100 ; le ventre en affiche 10).

La réponse est du JSON avec `total_count` et un tableau `items`. Pour chaque élément, le ventre lit `title`, `number`, `html_url`, `repository_url` (dont les deux dernières parties sont le propriétaire et le dépôt), `user.login`, `updated_at` et `draft`.

Une seconde recherche avec `author:@me` au lieu de `review-requested:@me` liste vos propres pull requests ouvertes ; le ventre peut alterner entre les deux.

### Les en-têtes

La documentation REST de GitHub utilise les trois mêmes en-têtes sur chaque requête :

| En-tête                | Valeur                        | Pourquoi                                                   |
| ---------------------- | ----------------------------- | ---------------------------------------------------------- |
| `Authorization`        | `Bearer <token>`              | Qui demande, et donc ce que signifie `@me`                 |
| `Accept`               | `application/vnd.github+json` | Le format JSON que recommande la documentation             |
| `X-GitHub-Api-Version` | `2026-03-10`                  | La version de REST ; sans lui, GitHub suppose `2022-11-28` |

La [page des versions de l’API](https://docs.github.com/en/rest/about-the-rest-api/api-versions) liste `2026-03-10` et `2022-11-28` comme versions prises en charge, et indique qu’une requête sans l’en-tête reçoit `2022-11-28`. GitHub demande aussi un `User-Agent` ; le ventre envoie `narsil-bot`.

### Le token : lecture seule, accès minimal

Le ventre utilise un [personal access token fine-grained](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens), pas un token classique. Un token fine-grained est limité aux dépôts que vous choisissez et aux permissions que vous cochez, et il peut expirer de lui-même.

La page de GitHub des [endpoints disponibles pour les tokens fine-grained](https://docs.github.com/en/rest/authentication/endpoints-available-for-fine-grained-personal-access-tokens) inclut `GET /search/issues`, et la [page des permissions](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens) ne lui attribue aucune permission propre. C’est la documentation de recherche qui explique la règle : vous devez « have access to the repositories in your search queries » (avoir accès aux dépôts de vos requêtes de recherche). Le token voit donc :

- **Les dépôts publics, toujours.** La page de GitHub note que « Tokens always include read-only access to all public repositories on GitHub. » (les tokens incluent toujours un accès en lecture seule à tous les dépôts publics de GitHub).
- **Les dépôts privés, seulement ceux que vous ajoutez** sous **Repository access**, avec **Pull requests: Read-only** comme seule permission. C’est la permission que GitHub indique pour lire les pull requests (`GET /repos/{owner}/{repo}/pulls`), et elle permet à la recherche de voir les dépôts privés que vous avez choisis.

Si tous les dépôts que vous relisez sont publics, le token n’a besoin d’aucune permission : choisissez **Public repositories** sous **Repository access** et ne cochez rien. Dans les deux cas, le token ne peut ni écrire, ni fusionner, ni commenter, ni lire le code des dépôts privés.

Le **Resource owner** compte aussi. Un token dont vous êtes le propriétaire voit vos dépôts ; pour voir les dépôts privés d’une organisation, l’organisation doit être le resource owner, et ses propriétaires peuvent avoir à approuver le token.

### Comment le créer, le faire expirer et le révoquer

D’après la page de GitHub sur la gestion des tokens :

1. **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**, ou directement [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens).
2. Donnez-lui un nom qui dit où il vit, comme `narsil-bot belly`.
3. Sous **Expiration**, choisissez une date. La valeur par défaut est de 30 jours. Une durée de vie plus courte signifie qu’un token qui fuit cesse de fonctionner plus tôt ; quand il expire, la liste du ventre affiche une erreur jusqu’à ce que vous en saisissiez un nouveau.
4. Choisissez le **Resource owner**, le **Repository access** et l’unique permission ci-dessus, puis **Generate token**. GitHub n’affiche le token qu’une fois ; il commence par `github_pat_`.

Pour le révoquer, ouvrez la même page et cliquez sur **Delete** à côté du token. Les requêtes du ventre échouent dès lors, ce qui est exactement ce que vous voulez si la carte est perdue ou si le token fuit.

### Le sondage, et rester dans les limites

Les endpoints de recherche ont leur propre limite de débit : 30 requêtes par minute pour un utilisateur authentifié. Le ventre interroge toutes les deux minutes, une petite fraction de cette limite, et une requête à la fois, ce que demandent les [bonnes pratiques](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api) de GitHub pour éviter les limites de débit secondaires. La même page demande de « Poll only as often as you need to, on a fixed schedule » (ne sonder qu’aussi souvent que nécessaire, à intervalle fixe), et d’attendre au moins le nombre de secondes indiqué dans un en-tête `x-poll-interval` quand la réponse en contient un.

Elle explique aussi les requêtes conditionnelles. Quand une réponse porte un en-tête `etag`, le ventre le garde et le renvoie comme `If-None-Match` la fois suivante. Si rien n’a changé, GitHub répond `304 Not Modified` sans corps, et « Making a conditional request does not count against your primary rate limit if a `304` response is returned. » (une requête conditionnelle ne compte pas dans votre limite de débit principale si une réponse `304` est renvoyée). Le ventre garde la liste qu’il a déjà.

Sur `403` ou `429`, le ventre attend le temps indiqué dans `retry-after` (ou `x-ratelimit-reset`) avant de réessayer. Sur `401`, le token est faux, expiré ou supprimé, et l’écran le signale.

### Sur le ventre

La requête utilise [`esp_http_client`](https://docs.espressif.com/projects/esp-idf/en/stable/esp32p4/api-reference/protocols/esp_http_client.html) d’ESP-IDF avec le bundle de certificats (`crt_bundle_attach = esp_crt_bundle_attach`), comme le flux ntfy du guide 7. Cette fois la réponse est courte, elle utilise donc `esp_http_client_perform`, recueille le corps dans l’événement `HTTP_EVENT_ON_DATA`, attrape l’`etag` dans `HTTP_EVENT_ON_HEADER` (où `evt->header_key` et `evt->header_value` contiennent chaque en-tête de réponse), et lit le statut avec `esp_http_client_get_status_code` après le retour de `perform`.

Le token vit dans la NVS, dans l’espace de noms `narsil` de la classe `Settings` de Xiaozhi, sous la clé `gh_token`, saisi une seule fois sur l’écran de réglages du ventre (guide 9). Il n’est jamais compilé dans le firmware ni écrit dans le journal.

## Comment on l’a demandé à l’IA

Les pull requests sont venues avec la raison d’être du bot : un écran dans le ventre qui montre ce qui a besoin de vous, à côté des tâches de Narsil. L’endroit où se fait le travail réseau a été réglé par la réponse de l’auteur ou de l’autrice au sujet de la tête :

> Por cable desde la panza

Traduction en français : par câble depuis le ventre.

Le ventre appelle donc GitHub lui-même. La spec S6 a ensuite fixé la règle pour chaque secret, le token GitHub compris : il vit dans la NVS ou dans une configuration locale, jamais dans le dépôt.

Le reste revenait à l’IA, qui devait le vérifier, et non à l’auteur ou à l’autrice, qui n’avait pas à le décider : quel endpoint liste les pull requests qui ont besoin de vous, si un token fine-grained peut l’appeler, et quelle est la permission minimale qui fonctionne. L’IA a lu la documentation de recherche de GitHub et ses pages d’endpoints et de permissions pour les tokens fine-grained, et a choisi la recherche avec une permission **Pull requests** en lecture seule, uniquement là où des dépôts privés l’exigent.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas la conversation qui a servi à construire le bot.

> Sur un ESP32-P4 avec ESP-IDF 6, je veux afficher les pull requests GitHub ouvertes qui demandent ma revue. Vérifie dans la documentation REST de GitHub si `GET /search/issues` fonctionne avec un personal access token fine-grained et quelle permission il demande, la `X-GitHub-Api-Version` actuelle, la limite de débit de la recherche et le fonctionnement des requêtes conditionnelles avec `If-None-Match`. Écris ensuite une fonction qui l’appelle avec `esp_http_client` et le bundle de certificats, lit le token dans la NVS, garde l’ETag, gère 304, 401, 403 et 429, et analyse `items` avec cJSON. Dis-moi comment créer le token avec l’accès minimal et comment le révoquer.

## Le code minimal

Une fonction pour le ventre, en C++ à côté du code de Xiaozhi (MIT, comme les exemples propres au site). `ShowPullRequest` et `ShowGithubError` sont les fonctions de l’écran du guide 9 ; une tâche appelle `PollPullRequests()` toutes les deux minutes :

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

`repository_url` ressemble à `https://api.github.com/repos/octo-org/example-repo`, si bien que le texte après `/repos/` est le `owner/repo` qu’affiche la ligne. Le plafond de 64 Ko sur le corps est un garde-fou : dix résultats de recherche y tiennent largement.

Un token de test sur le PC, pour les vérifications ci-dessous, est inventé ici : `github_pat_EXAMPLE_not_a_real_token`.

## Erreurs fréquentes et comment tester

- **Un token classique avec le scope `repo`.** Il fonctionne, et il peut écrire dans tous vos dépôts. Utilisez un token fine-grained avec un accès en lecture seule.
- **Une liste vide avec des dépôts privés.** Le token ne voit que les dépôts privés que vous avez ajoutés sous **Repository access**, avec **Pull requests: Read-only**.
- **`401 Unauthorized`.** Le token est mal saisi, expiré ou supprimé. Créez-en un nouveau et saisissez-le à nouveau sur le ventre.
- **`403` après de nombreuses requêtes.** Trop de recherches en une minute, ou des requêtes envoyées en parallèle. Une requête toutes les deux minutes, une à la fois.
- **Des espaces dans la requête.** L’URL ne doit pas contenir d’espaces bruts ; les qualificatifs sont joints par `+`.
- **Pas de HTTPS.** Sans le bundle de certificats, la négociation TLS avec `api.github.com` échoue. Gardez `crt_bundle_attach`, et `CONFIG_MBEDTLS_CERTIFICATE_BUNDLE` activé dans menuconfig.
- **Le token dans une ligne de journal.** N’affichez jamais l’en-tête `Authorization` ni la valeur de la NVS, même pendant le débogage.

Pour tester d’abord depuis le PC, avec votre token à la place de l’exemple :

```powershell
curl.exe -s -H "Authorization: Bearer github_pat_EXAMPLE_not_a_real_token" -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2026-03-10" "https://api.github.com/search/issues?q=is:pr+is:open+review-requested:@me&per_page=10"
```

Une réponse JSON avec `total_count` signifie que le token fonctionne. Ajoutez `-i` pour voir l’en-tête `etag`, puis répétez avec `-H "If-None-Match: <cet etag>"` pour obtenir un `304`. Sur le ventre, demandez à quelqu’un (ou à un second compte) de solliciter votre revue sur une pull request de test : dans les deux minutes, elle apparaît à l’écran. Supprimez le token sur GitHub et le sondage suivant affiche l’erreur `401`.

## Pour aller plus loin

- **Plus de listes.** `author:@me` affiche vos propres pull requests ouvertes ; ajouter `draft:false` masque les brouillons. Chaque liste est une recherche de plus, alors gardez le total bien en dessous de 30 par minute.
- **Vérifications et revues.** Les endpoints des pulls (`GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews`, par exemple) donnent l’état de revue de chaque pull request ; ils demandent eux aussi **Pull requests: Read-only**.
- **Les notifications au lieu de la recherche.** L’API de notifications de GitHub répond à « que m’est-il arrivé », mais GitHub ne la liste pas parmi les endpoints des tokens fine-grained : elle demanderait donc un token classique.
- **La rotation.** Avec un token de 30 jours, mettez un rappel dans votre agenda. Le ventre peut afficher la date d’expiration si vous la saisissez avec le token.
- Le guide 9 dessine les deux listes, alertes et pull requests, sur l’écran du ventre, dans le [parcours du bot](/fr/bot/).
