---
title: Claude comme cerveau
description: 'Un fournisseur Anthropic natif en Python pour xiaozhi-esp32-server : comment le serveur appelle un modèle de langage, l’API Messages en streaming, le cache de prompt, le coût par tour et la clé.'
route: bot
order: 5
updated: 2026-11-18
---

## Ce que ça fait

Le serveur du guide 4 entend votre voix et la transforme en texte, mais il ne réfléchit pas. À chaque tour, il confie la conversation à un modèle de langage (LLM) et prononce ce qui en sort. Dans ce bot, ce modèle est Claude.

Ce guide ajoute un nouveau fournisseur LLM à [xinnan-tech/xiaozhi-esp32-server](https://github.com/xinnan-tech/xiaozhi-esp32-server) : un seul fichier Python qui reçoit la conversation du serveur, l’envoie à l’[API Messages de Claude](https://platform.claude.com/docs/en/api/overview) avec le [SDK Python `anthropic`](https://github.com/anthropics/anthropic-sdk-python) officiel, et renvoie la réponse en continu, mot par mot, si bien que le ventre commence à parler avant que Claude ait fini d’écrire.

Seul du texte part chez Anthropic : ce que la reconnaissance vocale a compris, le prompt système et les tours précédents. Votre audio, jamais ; il reste entre le ventre et le PC (et l’outil de reconnaissance vocale choisi au guide 4).

## Comment ça marche à l’intérieur

### Comment le serveur charge un modèle de langage

Le serveur choisit son modèle dans `selected_module.LLM`, qui nomme un bloc sous `LLM:` dans la configuration. `core/utils/modules_initialize.py` lit le `type` de ce bloc (ou le nom du bloc, s’il n’a pas de `type`) et passe le bloc entier à `core/utils/llm.py`, dont la fonction `create_instance` cherche un fichier à l’emplacement :

```text
core/providers/llm/<type>/<type>.py
```

puis construit la classe `LLMProvider` qu’elle y trouve, avec le bloc pour seul argument. Le fournisseur Gemini, `core/providers/llm/gemini/gemini.py`, est un bon modèle à lire : un dossier, un fichier, une classe.

Ainsi, `type: claude` signifie un fichier `core/providers/llm/claude/claude.py`. Le dossier s’appelle `claude`, pas `anthropic`, pour ne jamais être confondu avec le paquet du SDK qu’il importe.

### L’interface qu’implémente un fournisseur

Chaque fournisseur étend `LLMProviderBase` de `core/providers/llm/base.py`. Son contrat est réduit :

- `response(self, session_id, dialogue)` est abstraite et doit être un **générateur** : elle produit (`yield`) des morceaux de texte à mesure qu’ils arrivent. Le serveur les transmet à la synthèse vocale phrase par phrase.
- `response_with_functions(self, session_id, dialogue, functions=None)` est la version avec appel d’outils. La classe de base l’implémente déjà en appelant `response` et en produisant des paires `(token, None)`, si bien qu’un fournisseur sans outils l’obtient gratuitement.
- `response_no_stream` construit un dialogue de deux messages et assemble ce que produit `response` ; elle n’attend rien de vous.

`dialogue` est une liste de dictionnaires au format de chat habituel, `{"role": ..., "content": ...}`. `core/utils/dialogue.py` la construit : d’abord un message `system` (le prompt système rendu), puis les tours `user` et `assistant` de la conversation. Avec l’appel d’outils activé, des messages `tool` et des `tool_calls` peuvent aussi apparaître.

`core/connection.py` n’appelle `response_with_functions` que lorsque le module d’intention est `function_call` ; sinon, il appelle `response`. Le bot définit `Intent: nointent`, si bien que le fournisseur n’a besoin que de `response`, et Claude ne fait que parler. Les outils sont dans « Pour aller plus loin ».

### Du dialogue du serveur à l’API Messages

L’API Messages veut le prompt système à part, dans un paramètre `system`, et une liste `messages` de tours `user` et `assistant` qui commence par un tour `user`. Le fournisseur convertit :

1. Les messages système quittent la liste et deviennent le paramètre `system`.
2. Les tours de l’utilisateur et de l’assistant restent, sous forme de texte.
3. Tout ce qui précède le premier tour de l’utilisateur (une salutation de l’assistant, par exemple) est écarté, car le premier message doit être celui de l’utilisateur.

Il ouvre ensuite un flux avec `client.messages.stream(...)` et produit le contenu de son `text_stream`, qui donne le texte de la réponse à mesure qu’il est généré, exactement ce que veut l’interface de générateur du serveur. Les [helpers de streaming](https://github.com/anthropics/anthropic-sdk-python/blob/main/helpers.md) du SDK Python documentent les deux.

### Pourquoi l’API native et pas celle compatible OpenAI

Le serveur a déjà un fournisseur `openai`, et Anthropic propose une [couche de compatibilité avec le SDK OpenAI](https://platform.claude.com/docs/en/cli-sdks-libraries/libraries/openai-sdk) ; diriger le fournisseur existant vers Claude fonctionnerait donc. La page d’Anthropic elle-même explique pourquoi le bot ne le fait pas : elle indique que la couche « is primarily intended to test and compare model capabilities, and is not considered a long-term or production-ready solution for most use cases » (est surtout destinée à tester et comparer les capacités des modèles, et n’est pas considérée comme une solution durable ou prête pour la production dans la plupart des cas). La même page liste ce qui lui manque, et la première pièce manquante compte ici : le cache de prompt « is not supported » (n’est pas pris en charge) par cette voie. Le SDK natif a le cache, des erreurs typées et l’ensemble complet des paramètres.

### Le modèle, et ce que coûte un tour

Le fournisseur lit le modèle dans la configuration. L’exemple utilise `claude-opus-5-5`, Claude Opus 5.5. Pour un assistant vocal, `claude-haiku-5-5`, Claude Haiku 5.5, est le choix le moins cher et le plus rapide ; les deux prennent le même code. Les prix de la [page de tarifs](https://platform.claude.com/docs/en/about-claude/pricing) d’Anthropic, par million de tokens, au jour de ce guide :

| Modèle           | Entrée | Écriture en cache 5 minutes | Lecture du cache | Sortie |
| ---------------- | ------ | --------------------------- | ---------------- | ------ |
| Claude Opus 5.5  | $4     | $5                          | $0.20            | $20    |
| Claude Haiku 5.5 | $0.10  | $0.125                      | $0.01            | $0.50  |

La ligne de Haiku vaut pour des prompts jusqu’à 100 000 tokens, ce qu’une conversation vocale n’atteint jamais.

Un tour vocal approximatif : le prompt système du serveur fait quelques milliers de caractères (son modèle `agent-base-prompt.txt` plus le caractère de Narsil du guide 6), environ 2 000 tokens ; vous dites une phrase, environ 20 tokens ; Narsil répond en deux phrases courtes, environ 60 tokens de texte. Sur Opus 5.5, cela fait environ $0.008 d’entrée sans cache, environ $0.0004 avec, plus environ $0.0012 de sortie. Sur Haiku 5.5, le tour entier coûte une petite fraction de centime. Deux choses font grossir la facture : l’historique, renvoyé à chaque tour, et la réflexion. Sur Claude Opus 5.5, la réflexion est toujours active et facturée comme sortie ; le fournisseur règle `output_config.effort` sur `low` pour qu’une réponse vocale ne réfléchisse pas longtemps. Consultez la page de tarifs actuelle avant de vous fier à ces chiffres.

### Le cache de prompt

Le [cache de prompt](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) permet à l’API de réutiliser le début d’une requête qu’elle a vue récemment. Vous marquez un bloc avec `cache_control: {"type": "ephemeral"}` ; tout ce qui précède cette marque est conservé cinq minutes, renouvelées gratuitement à chaque utilisation. Une écriture en cache coûte 1,25 fois le prix d’entrée ; une lecture coûte 0,05 fois sur Opus 5.5 et 0,1 fois sur Haiku 5.5. Le préfixe doit faire au moins 512 tokens sur les deux modèles, sinon il n’est pas mis en cache, sans avertissement.

Le piège : le cache fonctionne par correspondance de préfixe ; changez un caractère et tout ce qui suit est nouveau. Le modèle du serveur se termine par une section `<context>` qui contient des données en temps réel, et `core/utils/dialogue.py` remplace `{{current_time}}` par l’heure au format `HH:MM` à chaque tour. Le fournisseur coupe donc le prompt système à `<context>` : la partie stable vient en premier, avec la marque de cache, et la partie contexte vient après, hors cache. La partie stable dépasse largement 512 tokens.

### La clé d’API

Le SDK lit la clé dans la variable d’environnement `ANTHROPIC_API_KEY` quand le fournisseur n’en passe aucune. Le fournisseur accepte aussi `api_key` dans son bloc de configuration, qui vit dans `data/.config.yaml` sur votre PC (guide 4). Dans les deux cas, la clé reste sur le PC et n’entre jamais dans un dépôt.

Pour en obtenir une :

1. Ouvrez la [Claude Console](https://platform.claude.com/) et allez dans **API keys** ([platform.claude.com/settings/keys](https://platform.claude.com/settings/keys)). Créez une clé avec un nom qui dit où elle vit, par exemple `narsil-bot-pc`. La Console ne l’affiche qu’une fois.
2. Fixez une limite mensuelle dans [Spend limits](https://platform.claude.com/settings/spend-limits) (`platform.claude.com/settings/spend-limits`) : à côté de **Monthly spend limit**, cliquez sur **Adjust limit** ou **Set limit**. D’après la [page des limites de débit](https://platform.claude.com/docs/en/api/rate-limits), une fois votre propre limite atteinte, l’API répond HTTP 400 jusqu’au mois suivant ou jusqu’à ce que vous la releviez ; une boucle qui s’emballe coûte donc au plus ce montant.
3. Pour la révoquer, supprimez la clé sur la même page **API keys**. Les requêtes qui l’utilisent cessent de fonctionner aussitôt ; créez-en une nouvelle et mettez à jour le PC.

## Le construire avec Claude

Demandez à Claude un nouveau fournisseur de modèle de langage pour xiaozhi-esp32-server : un seul fichier Python qui appelle l’API Messages de Claude via le SDK officiel `anthropic`. L’idée que Claude doit bien saisir : le fournisseur est un générateur ; il produit le texte au fur et à mesure que Claude l’écrit, si bien que le ventre commence à parler avant que la réponse soit terminée.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas la conversation qui a servi à construire le bot.

> Je fais tourner xinnan-tech/xiaozhi-esp32-server dans Docker. Écris-lui un nouveau fournisseur LLM qui appelle Claude via le SDK Python officiel `anthropic`, et non via le point de terminaison compatible OpenAI. Lis d’abord `core/providers/llm/base.py`, `core/providers/llm/gemini/gemini.py`, `core/utils/llm.py` et `core/utils/dialogue.py` pour comprendre l’interface et le format du dialogue. Convertis les messages système en paramètre `system`, diffuse en continu avec `messages.stream` et produis le contenu de `text_stream`, lis le modèle, `max_tokens` et la clé d’API dans le bloc de configuration du fournisseur, et mets en cache la partie stable du prompt système avec `cache_control`. Montre-moi l’entrée de `.config.yaml` et comment ajouter le fichier et le SDK au conteneur Docker.

### Ce qu’il faut vérifier dans la réponse de Claude

1. Le fichier est `core/providers/llm/claude/claude.py`, sa classe est `LLMProvider` et étend `LLMProviderBase`, et le bloc de configuration indique `type: claude`, si bien que `create_instance` le trouve.
2. `response` ouvre `client.messages.stream(...)` et produit (`yield`) le texte de `text_stream`. Il utilise le SDK natif, pas le point d’accès compatible OpenAI, qui n’a pas de cache de prompt.
3. Les messages système deviennent le paramètre `system`, et tout ce qui précède le premier tour de l’utilisateur est abandonné, si bien que `messages` commence toujours par un tour `user`.
4. Le prompt système est coupé à `<context>` : la partie stable porte `cache_control: {"type": "ephemeral"}`, et la partie avec l’heure vient après, hors cache.
5. La clé d’API vient de la variable d’environnement `ANTHROPIC_API_KEY` ou de `api_key` dans `data/.config.yaml` sur votre PC. Elle n’apparaît jamais dans le code ni dans un dépôt, et la réponse vous rappelle de fixer une limite de dépense mensuelle dans la Console.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « `usage.cache_read_input_tokens` vaut zéro à chaque tour ».

### Comment l’auteur l’a demandé

Ce guide découle d’une seule décision. Au guide 4, l’auteur ou l’autrice a placé le serveur sur le PC, avec une raison :

> en el pc, igual la idea es usarlo para trabajar con claude

Traduction en français : sur le PC ; de toute façon, l’idée est de l’utiliser pour travailler avec Claude.

L’IA a ensuite demandé comment le serveur devait joindre Claude. Elle a proposé deux options : (1) un fournisseur Anthropic natif écrit en Python avec le SDK Anthropic, ou (2) le fournisseur existant du serveur de type OpenAI dirigé vers le point de terminaison compatible OpenAI d’Anthropic, sans nouveau code. Elle a cité la page de compatibilité d’Anthropic et sa remarque selon laquelle ce point de terminaison est destiné aux tests et aux comparaisons. La réponse :

> 1

Cette réponse est la spec S5 : un fournisseur natif. Le modèle, le niveau d’effort et la découpe du cache n’ont pas fait l’objet de questions ; l’IA les a tirés de la documentation d’Anthropic et du modèle propre au serveur, et ce sont des réglages que vous pouvez changer.

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide. Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

Le fournisseur, `providers/claude/claude.py` dans votre dossier `xiaozhi-server` sur le PC (MIT, comme les exemples propres au site) :

```python
import anthropic

from core.providers.llm.base import LLMProviderBase

CONTEXT_MARK = "<context>"


def to_messages_api(dialogue):
    system_text = "\n".join(m["content"] for m in dialogue if m["role"] == "system")
    stable, mark, context = system_text.partition(CONTEXT_MARK)
    system = [{"type": "text", "text": stable, "cache_control": {"type": "ephemeral"}}]
    if mark:
        system.append({"type": "text", "text": mark + context})

    messages = []
    for m in dialogue:
        content = str(m.get("content") or "")
        if m["role"] not in ("user", "assistant") or not content:
            continue
        if not messages and m["role"] != "user":
            continue
        messages.append({"role": m["role"], "content": content})
    return system, messages


class LLMProvider(LLMProviderBase):
    def __init__(self, config):
        self.model_name = config.get("model_name", "claude-opus-5-5")
        self.max_tokens = int(config.get("max_tokens", 4096))
        self.effort = config.get("effort", "low")
        self.client = anthropic.Anthropic(api_key=config.get("api_key") or None)

    def response(self, session_id, dialogue, **kwargs):
        system, messages = to_messages_api(dialogue)
        with self.client.messages.stream(
            model=self.model_name,
            max_tokens=self.max_tokens,
            system=system,
            messages=messages,
            output_config={"effort": self.effort},
        ) as stream:
            yield from stream.text_stream
            if stream.get_final_message().stop_reason == "refusal":
                yield "Prefiero no responder a eso."
```

La dernière ligne est ce que dit Narsil, en espagnol (« je préfère ne pas répondre à cela »), quand Claude décline une demande.

Son bloc dans `data/.config.yaml`, à côté de ce que le guide 4 y a mis :

```yaml
selected_module:
  LLM: ClaudeLLM
  Intent: nointent

LLM:
  ClaudeLLM:
    type: claude
    model_name: claude-opus-5-5
    max_tokens: 4096
    effort: low
```

Pour Haiku, remplacez `model_name` par `claude-haiku-5-5`. `max_tokens` est un plafond, pas une cible : la longueur des réponses de Narsil est fixée par son prompt (guide 6).

L’image du serveur n’inclut ni le SDK ni le nouveau fichier. Un petit `Dockerfile` à côté de `docker-compose.yml` ajoute le SDK par-dessus l’image du projet :

```dockerfile
FROM ghcr.nju.edu.cn/xinnan-tech/xiaozhi-esp32-server:server_latest
RUN pip install anthropic
```

Et un `docker-compose.override.yml`, que Docker Compose fusionne de lui-même avec le fichier du projet, construit cette image, monte le fournisseur là où `create_instance` le cherche, et transmet la clé depuis votre shell :

```yaml
services:
  xiaozhi-esp32-server:
    build: .
    image: xiaozhi-esp32-server-claude
    environment:
      - ANTHROPIC_API_KEY
    volumes:
      - ./providers/claude/claude.py:/opt/xiaozhi-esp32-server/core/providers/llm/claude/claude.py
```

Puis, dans PowerShell, avec une clé inventée :

```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-EXAMPLE-not-a-real-key"
docker compose up -d --build
docker logs -f xiaozhi-esp32-server
```

## Erreurs fréquentes et comment tester

- **Un `type` qui ne correspond pas au dossier.** `type: claude` exige `core/providers/llm/claude/claude.py` dans le conteneur. Le serveur répond `不支持的LLM类型` (« type de LLM non pris en charge ») quand le chemin est faux ; vérifiez la ligne du volume.
- **`ModuleNotFoundError: anthropic`.** Le conteneur fait encore tourner l’image du projet. Reconstruisez avec `docker compose up -d --build`.
- **Le premier message n’est pas celui de l’utilisateur.** L’API rejette une liste `messages` qui commence par `assistant` ; la conversion écarte tout ce qui précède le premier tour de l’utilisateur.
- **Un `max_tokens` trop bas.** La réflexion compte dedans ; avec quelques centaines de tokens, une réponse peut s’arrêter à mi-chemin. Gardez plutôt les réponses courtes par le prompt.
- **Un cache qui ne sert jamais.** Tout ce qui change avant la marque de cache le casse. Lisez `usage.cache_read_input_tokens` dans le message final : zéro à chaque tour signifie que la partie stable change, par exemple parce qu’un modèle personnalisé a placé l’heure au-dessus de `<context>`.
- **La clé dans le dépôt.** Gardez-la dans l’environnement ou dans `data/.config.yaml`, tous deux en dehors de tout dépôt. Si une clé fuit, supprimez-la aussitôt dans la Console.

Pour tester, démarrez le serveur et suivez son journal. Il affiche `初始化组件: llm成功 ClaudeLLM` (« composant initialisé : llm réussi ») quand le fournisseur se charge. Réveillez ensuite le ventre et posez une question courte : le journal montre le texte reconnu, et la réponse commence à être jouée pendant que Claude écrit encore. Sur la page [Usage](https://platform.claude.com/usage) de la Console, les requêtes apparaissent en quelques minutes, avec leurs tokens en cache et hors cache.

## Pour aller plus loin

- **Les outils.** Avec `Intent: function_call`, le serveur passe ses plugins (météo, musique, l’intention de sortie) à `response_with_functions`. L’implémenter signifie convertir la liste de fonctions de style OpenAI du serveur au format `tools` de Claude et produire la forme d’appel de fonction du serveur, comme le fait le fournisseur Gemini.
- **Les solutions de repli en cas de refus.** Sur Claude Opus 5.5, la bêta `server-side-fallback-2026-07-01` permet à l’API de relancer une requête refusée sur un autre modèle au sein du même appel (`fallbacks: "default"` sur `client.beta.messages`).
- **L’effort.** `low` garde les réponses rapides. Essayez `medium` pour les questions qui demandent plus de réflexion, et mesurez le délai avant de le garder.
- **Les messages système en cours de conversation.** Pour changer les instructions de Narsil pendant une conversation sans toucher au prompt système en cache, l’API accepte un rôle `system` dans `messages` sur les modèles actuels.
- Le guide 6 écrit le caractère qui va dans ce prompt système, et la voix espagnole qui le prononce.
