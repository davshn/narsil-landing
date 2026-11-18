---
title: Votre propre serveur
description: 'Faire tourner xiaozhi-esp32-server de xinnan-tech en mode minimal avec Docker sur votre PC, sur le réseau local uniquement : sa configuration, ses ports, et comment le ventre le trouve.'
route: bot
order: 4
updated: 2026-11-18
---

## Ce que ça fait

Xiaozhi, sur le ventre, ne comprend pas la parole et ne réfléchit pas. Il enregistre, compresse et joue. L’écoute, la réflexion et la parole ont lieu sur un serveur : par défaut le serveur officiel xiaozhi.me, et dans ce bot, un serveur sur votre propre PC.

Ce serveur est [xinnan-tech/xiaozhi-esp32-server](https://github.com/xinnan-tech/xiaozhi-esp32-server), le serveur Python que le README de Xiaozhi cite en premier pour un déploiement sur un ordinateur personnel. Pour chaque conversation, il :

1. Reçoit l’audio du ventre par WebSocket.
2. Détecte où vous commencez et arrêtez de parler (détection d’activité vocale).
3. Transforme votre parole en texte (reconnaissance vocale, ASR).
4. Envoie le texte à un modèle de langage (LLM). Dans ce bot, Claude, à partir du guide 5.
5. Transforme la réponse en parole (synthèse, TTS) et la renvoie en continu.

Il répond aussi à la requête OTA du ventre, et c’est ainsi que le ventre apprend où se trouve le WebSocket (guide 3).

Le bot le fait tourner dans le **mode minimal** du projet, que le README anglais appelle « Simplified Installation » (installation simplifiée) : un seul agent, des données stockées dans des fichiers de configuration, pas de base de données et pas de console web. Il tourne dans Docker sur le PC sur lequel vous travaillez, et il n’est joignable que depuis votre réseau local.

## Comment ça marche à l’intérieur

### Pourquoi seulement sur votre réseau local

Le README du projet est direct sur sa maturité. Sa traduction anglaise indique que le projet « has not passed network security assessment » (n’a pas passé d’évaluation de sécurité réseau), vous demande de ne pas l’utiliser en production, et demande des mesures de protection si vous le déployez sur un réseau public pour apprendre. Le chinois original dit la même chose : « 未通过网络安全测评 ».

Le bot retient la lecture prudente : le serveur n’est jamais exposé à Internet. Aucun port n’est redirigé sur le routeur, et seuls les appareils de votre réseau peuvent le joindre. La configuration par défaut va dans le sens de cet usage : l’authentification est désactivée (`server.auth.enabled: false`), ce qui est acceptable sur un réseau domestique et ne l’est pas sur Internet.

### Les modules : ce que chaque étape utilise

`main/xiaozhi-server/config.yaml` choisit un fournisseur par étape sous `selected_module`. Les valeurs par défaut :

| Étape                 | Clé      | Par défaut      | Notes de `config.yaml`                              |
| --------------------- | -------- | --------------- | --------------------------------------------------- |
| Activité vocale       | `VAD`    | `SileroVAD`     | Modèle local                                        |
| Reconnaissance vocale | `ASR`    | `FunASR`        | Local, hors ligne, modèle SenseVoiceSmall           |
| Modèle de langage     | `LLM`    | `ChatGLMLLM`    | Demande une clé ; le guide 5 le remplace par Claude |
| Modèle de vision      | `VLLM`   | `ChatGLMVLLM`   | Non utilisé par le bot                              |
| Synthèse vocale       | `TTS`    | `EdgeTTS`       | Voix `zh-CN-XiaoxiaoNeural` par défaut              |
| Mémoire               | `Memory` | `nomem`         | Aucune mémoire d’une conversation à l’autre         |
| Intention             | `Intent` | `function_call` | Le modèle appelle directement les outils            |

Chaque nom renvoie à un bloc du même nom plus bas dans le fichier (`ASR.FunASR`, `TTS.EdgeTTS` et ainsi de suite) avec les réglages de ce fournisseur.

### `config.yaml` et `data/.config.yaml`

Les commentaires en haut de `config.yaml` donnent la règle : créez `data/.config.yaml` et mettez-y vos modifications, pas dans `config.yaml`. Le serveur lit d’abord `data/.config.yaml` et prend dans `config.yaml` tout ce qui manque. Le guide de déploiement appelle cela la méthode la plus concise, et le commentaire ajoute pourquoi c’est important : vos clés restent hors du fichier propre au projet.

Pour le bot, cela signifie que `data/.config.yaml` ne contient que ce qui diffère des valeurs par défaut : l’adresse WebSocket, le fuseau horaire, les fournisseurs choisis, et leurs clés. Il vit sur votre PC, en dehors de tout dépôt.

### Les ports

Le `docker-compose.yml` du projet publie deux ports :

| Port | Réglage            | Ce qu’il sert                                                             |
| ---- | ------------------ | ------------------------------------------------------------------------- |
| 8000 | `server.port`      | Le WebSocket auquel parle le ventre, sur `/xiaozhi/v1/`                   |
| 8003 | `server.http_port` | HTTP : l’interface OTA simple sur `/xiaozhi/ota/`, et l’analyse de vision |

Le serveur écoute sur `0.0.0.0` (`server.ip`), c’est-à-dire sur toutes les interfaces réseau du conteneur. Docker publie ces ports sur le PC.

### Comment le ventre le trouve

Deux adresses comptent, toutes deux construites à partir de l’adresse de votre PC sur le réseau local (ici l’adresse inventée `192.168.1.50`) :

- **URL OTA :** `http://192.168.1.50:8003/xiaozhi/ota/`. Vous la saisissez une seule fois sur le ventre, dans l’onglet Advanced du portail Wi-Fi (guide 3).
- **URL WebSocket :** `ws://192.168.1.50:8000/xiaozhi/v1/`. Le serveur l’envoie au ventre dans sa réponse OTA.

La seconde demande de l’attention avec Docker. Le serveur ne construit lui-même l’adresse WebSocket que tant que `server.websocket` contient encore l’espace réservé de `config.yaml` (`ws://你的ip或者域名:端口号/xiaozhi/v1/`, « votre IP ou domaine : port »). Dans un conteneur, l’adresse qu’il voit est celle du conteneur, pas celle de votre PC. Le [guide de déploiement](https://github.com/xinnan-tech/xiaozhi-esp32-server/blob/main/docs/Deployment.md) avertit qu’avec Docker les adresses du journal de démarrage ne sont pas les vraies, et que la bonne méthode est d’utiliser l’adresse LAN du PC. Le bot définit donc `server.websocket` explicitement, et le gestionnaire OTA envoie alors exactement cette valeur. Comme aucun `mqtt_gateway` n’est configuré, il envoie un objet `websocket`, et c’est ce qui sélectionne WebSocket sur le ventre.

Un autre réglage va avec : `server.timezone_offset`, le fuseau horaire que la réponse OTA communique au ventre. La valeur par défaut `+8` est l’heure de la Chine ; définissez la vôtre.

### Local ou API : choisir la reconnaissance et la synthèse vocales

Chaque étape peut tourner sur votre PC ou appeler une API dans le cloud. `config.yaml` documente les deux types :

| Type  | Reconnaissance vocale (ASR)                                  | Synthèse vocale (TTS)                                                                                      |
| ----- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Local | `FunASR` (par défaut), `SherpaASR`, `VoskASR` (hors ligne)   | `FishSpeech`, `PaddleSpeechTTS`, `IndexStreamTTS`, `GPT_SOVITS_V2` (chacun demande son propre déploiement) |
| API   | `OpenaiASR`, `GroqASR`, `AliyunASR`, `DoubaoASR` et d’autres | `OpenAITTS`, `AliyunTTS`, `DoubaoTTS` et d’autres                                                          |

Les compromis :

- **Le local garde votre voix chez vous et ne coûte rien à l’usage**, mais il utilise la mémoire et le processeur de votre PC. Le README note que faire tourner `FunASR` en local prend plus de mémoire, et qu’utiliser des API pour tout limite la consommation de ressources.
- **La langue compte.** Narsil parle espagnol. Le commentaire du bloc `FunASR` liste les étiquettes de langue que SenseVoice prend en charge : zh, en, ja, ko et yue ; pour l’espagnol, le bot utilise donc un autre outil de reconnaissance. `OpenaiASR` (modèle `gpt-4o-mini-transcribe` par défaut) et `GroqASR` (`whisper-large-v3-turbo`) sont des API multilingues ; `VoskASR` fonctionne hors ligne et prend en charge plusieurs langues avec un modèle téléchargé.
- **Une API envoie votre audio hors de votre réseau** et demande une clé. Le [guide 12](/fr/bot/secrets-privacy/) liste ce qui quitte le réseau et pourquoi.

Le bot utilise `OpenaiASR` pour la reconnaissance et garde `EdgeTTS` pour la synthèse, qui ne demande aucune clé dans `config.yaml`. La voix de Narsil elle-même, et le réglage `voice`, relèvent du guide 6.

### Sans le serveur, seule la voix s’arrête

Le serveur fait un seul travail : la voix. Le ventre se connecte à ntfy et à GitHub par lui-même (guides 7 et 8), et la tête dessine ce que le ventre lui envoie. Si votre PC est éteint, ou si Docker est arrêté, les alertes de Narsil, vos pull requests et son visage continuent de fonctionner. Seul le mot d’activation ne mène nulle part jusqu’au retour du serveur.

## Comment on l’a demandé à l’IA

La décision de faire tourner un serveur a été prise dans le guide 3 : l’auteur ou l’autrice a choisi « servidor propio », un serveur à soi, plutôt que xiaozhi.me. L’IA a alors proposé ce serveur en mode minimal, avec Docker, sur le réseau local uniquement, et a redemandé avant de continuer. L’auteur ou l’autrice a confirmé :

> vamos con el propio de una

Traduction en français : allons-y avec le nôtre, tout de suite.

La question suivante portait sur l’endroit où il tournerait : sur le PC, ou sur une autre machine de la maison. La réponse :

> en el pc, igual la idea es usarlo para trabajar con claude

Traduction en français : sur le PC ; de toute façon, l’idée est de l’utiliser pour travailler avec Claude.

Cette seconde réponse explique deux choses dans ce guide. Le serveur tourne dans Docker sur le PC sur lequel l’auteur ou l’autrice travaille déjà, si bien que rien de nouveau ne doit rester allumé. Et Claude est le cerveau : la décision suivante, consignée comme spec S5, a retenu l’option « 1 », un fournisseur Anthropic natif écrit en Python avec le SDK Anthropic plutôt qu’un point de terminaison compatible OpenAI. Le guide 5 le construit.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas la conversation qui a servi à configurer le bot.

> Je veux faire tourner xinnan-tech/xiaozhi-esp32-server dans son mode minimal avec Docker sur mon PC Windows, joignable uniquement depuis mon réseau local, pour un appareil Xiaozhi. Lis le README du projet, `docs/Deployment.md`, `main/xiaozhi-server/config.yaml` et `docker-compose.yml`, puis donne-moi : l’arborescence des dossiers, un `data/.config.yaml` qui ne remplace que ce dont j’ai besoin (adresse WebSocket avec mon IP LAN, fuseau horaire, un outil de reconnaissance vocale qui comprend l’espagnol), les commandes pour le démarrer et lire ses journaux, et l’URL OTA que je dois donner à l’appareil. Cite l’avertissement de sécurité du projet et dis-moi quels ports il ouvre.

## Le code minimal

Le dossier sur le PC, d’après le guide de déploiement :

```text
xiaozhi-server
├─ docker-compose.yml
├─ data
│  └─ .config.yaml
└─ models
   └─ SenseVoiceSmall
      └─ model.pt
```

`docker-compose.yml` est le fichier propre au projet, téléchargé depuis `main/xiaozhi-server/`. Le fichier compose monte `models/SenseVoiceSmall/model.pt` dans le conteneur, si bien que le guide de déploiement vous fait télécharger ce modèle (depuis ModelScope ou Baidu) même si le bot reconnaît la parole via une API.

`data/.config.yaml`, avec une adresse et une clé inventées :

```yaml
server:
  websocket: ws://192.168.1.50:8000/xiaozhi/v1/
  timezone_offset: -5

selected_module:
  ASR: OpenaiASR
  TTS: EdgeTTS

ASR:
  OpenaiASR:
    api_key: sk-EXAMPLE-not-a-real-key
```

Seul `api_key` est défini sous `OpenaiASR` ; le reste de ce bloc (`type`, `base_url`, `model_name`) vient de `config.yaml`. Utilisez le décalage de votre propre fuseau horaire. La section `LLM` arrive dans le guide 5 ; d’ici là, le serveur sélectionne toujours le `ChatGLMLLM` par défaut, qui, d’après le guide de déploiement, a besoin de sa clé pour démarrer.

Démarrez-le depuis le dossier `xiaozhi-server` et suivez son journal :

```powershell
docker compose up -d
docker logs -f xiaozhi-esp32-server
```

L’image est `ghcr.nju.edu.cn/xinnan-tech/xiaozhi-esp32-server:server_latest`, le conteneur s’appelle `xiaozhi-esp32-server`, et `restart: always` le relance après un redémarrage de Docker.

## Erreurs fréquentes et comment tester

- **Modifier `config.yaml` au lieu de `data/.config.yaml`.** Vos modifications se mélangent au fichier du projet et se perdent au téléchargement suivant. Mettez-les dans `data/.config.yaml`.
- **Se fier aux adresses du journal Docker.** Ce sont celles du conteneur. Utilisez l’adresse LAN de votre PC dans `server.websocket` et dans l’URL OTA du ventre.
- **Rediriger le 8000 ou le 8003 sur le routeur.** Le projet n’a pas fait l’objet d’une évaluation de sécurité et l’authentification est désactivée par défaut. Gardez-le sur votre réseau.
- **Le pare-feu du PC.** Si le ventre ne peut pas joindre le serveur alors que le navigateur du PC lui-même le peut, autorisez les connexions entrantes sur le 8000 et le 8003 depuis votre réseau privé.
- **Une adresse de PC qui change.** Si votre routeur donne une nouvelle adresse au PC, l’URL OTA du ventre et `server.websocket` deviennent toutes deux obsolètes. Une réservation DHCP sur le routeur garde l’adresse fixe.
- **Mettre à jour en écrasant `.config.yaml`.** Les étapes de mise à jour du guide de déploiement disent de le sauvegarder et de recopier vos clés une à une dans le nouveau, parce qu’un nouveau `config.yaml` peut apporter de nouveaux réglages.

Pour tester, ouvrez l’URL OTA dans un navigateur sur le PC, par exemple `http://192.168.1.50:8003/xiaozhi/ota/`. Le guide du firmware de xinnan-tech indique qu’un serveur qui fonctionne répond « OTA接口运行正常 » (« l’interface OTA fonctionne normalement ») suivi de l’adresse WebSocket qu’il envoie aux appareils. Si cette adresse montre votre IP LAN et le port 8000, le ventre la trouvera. Dites ensuite le mot d’activation et observez `docker logs -f xiaozhi-esp32-server` : vous devriez voir le ventre se connecter et le texte qu’il a entendu.

## Pour aller plus loin

- L’installation complète avec modules ajoute une base de données, plusieurs utilisateurs et agents, et une console web. Le bot n’en a pas besoin, et son adresse OTA est différente (le guide du firmware utilise le port 8002 pour elle).
- Le serveur peut servir des mises à jour de firmware pour le ventre depuis son dossier `data/bin`, ce que décrit le guide de mise à jour OTA du projet (`docs/ota-upgrade-guide.md`).
- `server.auth` peut exiger un token, avec `allowed_devices` qui liste les adresses MAC dispensées de la vérification. C’est une couche utile même sur un réseau domestique.
- La plupart des blocs de fournisseur de `config.yaml` portent des commentaires, en chinois, sur l’endroit où obtenir la clé et, pour certains, sur son coût ; lisez celui que vous choisissez avant de vous engager.
- Le guide 5 ajoute le `LLM` qui fait réfléchir Narsil avec Claude, et le guide 6 lui donne une voix et une personnalité.
