---
title: La personnalité et la voix de Narsil
description: 'Qui est Narsil quand elle parle : son caractère dans le prompt du serveur, des réponses courtes en espagnol pour la voix, une voix Edge espagnole et les phrases chinoises du serveur traduites.'
route: bot
order: 6
updated: 2026-11-18
---

## Ce que ça fait

Après le guide 5, Claude répond par le ventre, mais avec le caractère par défaut du serveur : le `prompt` d’exemple du projet décrit une fille bavarde de Taïwan, en chinois, et la voix par défaut est une voix chinoise. Ce guide donne au bot le caractère propre à Narsil, le même que dans [Narsil for Claude Code](https://github.com/davshn/narsil-pet), et une voix espagnole pour le dire.

Quatre réglages de `data/.config.yaml` font le travail :

- `prompt` : qui est Narsil et comment elle parle.
- `TTS.EdgeTTS.voice` : la voix qui prononce ses réponses.
- `TTS.EdgeTTS.language` : la langue dans laquelle chaque réponse est écrite.
- `system_error_response`, `end_prompt` et `exit_commands` : les phrases et commandes fixes du serveur, en chinois par défaut.

## Comment ça marche à l’intérieur

### Où va le caractère

Le serveur n’envoie pas `prompt` au modèle tel quel. `core/utils/prompt_manager.py` lit un modèle, `agent-base-prompt.txt` par défaut (le réglage `prompt_template`), et construit le prompt système à partir de lui. Le modèle, en anglais, commence par des règles générales pour un assistant vocal, puis place votre `prompt` dans une section `<identity>`, où il remplace `{{base_prompt}}`. D’autres espaces réservés remplissent la date, le lieu, la météo et, à la fin, une section `<context>` avec l’heure actuelle (le guide 5 explique pourquoi cette section reste hors du cache).

`prompt` n’a donc qu’à dire qui est Narsil. Le modèle demande déjà le reste : aller droit au but, tolérer les erreurs de reconnaissance vocale, ne pas enchaîner les questions.

### Qui est Narsil

Le caractère de Narsil vient du dépôt narsil-pet (GPL-3.0-or-later), et le bot le garde pour que la Narsil du bureau et celle qui se trouve au-dessus de votre prompt soient la même. D’après son README et `hooks/words.ts` :

- C’est un serpent de mer chibi. Son nom vient de l’épée reforgée du _Seigneur des Anneaux_, et le README dit qu’elle est là « para cortar bugs » (« pour trancher les bugs »).
- Sa voix est décrite dans un commentaire de `hooks/words.ts` : un espagnol latino-américain neutre, « a calm, warm assistant who works beside you: composed, a little playful, never servile » (une assistante calme et chaleureuse qui travaille à vos côtés : posée, un peu joueuse, jamais servile). Elle parle d’elle-même à la première personne, jamais par son nom.
- Ses apartés empruntent à la mer : elle flotte, plonge dans une idée, trouve des choses « como una perla » (« comme une perle »).
- Elle grandit en cinq stades avec l’expérience qu’elle gagne, et elle rapporte ce que fait Claude en phrases simples : au travail, en attente de vous, terminé, ou arrêté par une erreur.

Le `prompt` du bot transforme ces points en instructions. Il est écrit en anglais, comme le modèle qui l’entoure ; la langue des réponses est fixée à part.

### Court, pour l’oreille

Une réponse vocale s’entend une seule fois, à la vitesse de la parole. Les phrases parlées de Narsil dans narsil-pet tiennent en une ou deux phrases courtes, comme « Listo, ya quedó. » (« C’est bon, c’est terminé. »). Le prompt demande la même chose : deux phrases au plus sauf si vous en demandez davantage, pas de listes, pas de Markdown, pas de code lu à voix haute, et des nombres dits comme une personne les dirait. Les règles propres au modèle, comme sa liste d’emojis autorisés, restent telles quelles.

### La langue de chaque réponse

Le modèle a une règle stricte : chaque réponse est écrite en `{{language}}`, quelle que soit la langue dans laquelle vous parlez. Le gestionnaire de prompt la remplit à partir du réglage `language` du bloc TTS sélectionné, et se rabat sur `中文` (chinois) quand il manque. C’est pourquoi le bot définit `language` sous `TTS.EdgeTTS`, avec `Spanish`, le mot que le modèle anglais lit le mieux.

### La voix

`EdgeTTS` utilise le service de synthèse vocale en ligne de Microsoft Edge via le paquet Python `edge-tts` ; le fournisseur du serveur (`core/providers/tts/edge.py`) passe la `voice` configurée directement à `edge_tts.Communicate`. La valeur par défaut est `zh-CN-XiaoxiaoNeural`.

Narsil parle un espagnol latino-américain neutre ; le bot utilise donc `es-MX-DaliaNeural`, une voix féminine pour l’espagnol (Mexique) dans la [liste des voix de synthèse](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts) de Microsoft. Edge en propose un sous-ensemble ; `edge-tts --list-voices`, tiré du [README d’edge-tts](https://github.com/rany2/edge-tts), affiche les voix qu’il peut réellement utiliser, alors vérifiez votre choix là. `es-CO-SalomeNeural` et `es-US-PalomaNeural` sont d’autres voix féminines latino-américaines de la liste de Microsoft.

EdgeTTS ne demande aucune clé, mais c’est un service en ligne : les réponses de Narsil, sous forme de texte, partent chez Microsoft pour être prononcées. Le [guide 12](/fr/bot/secrets-privacy/) liste ce qui quitte votre réseau.

### Les phrases propres au serveur

Quelques phrases ne viennent pas de Claude, et elles sont en chinois dans `config.yaml` :

| Réglage                 | Ce que c’est                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| `system_error_response` | Ce que dit le serveur quand quelque chose échoue (« 主人，小智现在有点忙… », « Maître, Xiaozhi est occupé… ») |
| `end_prompt.prompt`     | L’instruction pour l’au revoir à la fin d’une conversation                                                    |
| `exit_commands`         | Les mots qui ferment la conversation : `退出` (« quitter ») et `关闭` (« fermer »)                            |

Le bot remplace les trois. La phrase d’erreur est prononcée telle qu’elle est écrite, elle est donc en espagnol ; l’au revoir est une instruction au modèle, il peut donc rester en anglais.

### Le mot d’activation

Le mot d’activation est guetté sur le ventre, pas sur le serveur. Le `scripts/build.py` de Xiaozhi choisit « Hi ESP » pour une compilation en espagnol (guide 3), et le bot le garde. Le `Kconfig.projbuild` de Xiaozhi propose aussi un mot d’activation personnalisé sur l’ESP32-P4 (`USE_CUSTOM_WAKE_WORD`, avec la phrase dans `CUSTOM_WAKE_WORD`), via le modèle MultiNet d’ESP-SR ; son texte d’aide demande du pinyin pour les phrases chinoises. « Pour aller plus loin » en dit plus.

## Comment on l’a demandé à l’IA

Le caractère n’a jamais été une question, parce qu’il était réglé dès le premier message. L’auteur ou l’autrice a décrit la tête comme le visage de Narsil :

> la cabeza va a ser una apntalla holografica que solo sea la cara de narsil

Traduction en français : la tête sera un écran holographique qui ne soit que le visage de Narsil.

Et quand l’IA a demandé comment Narsil devait parler, la réponse a été Xiaozhi :

> yo pensaba hacerlo con Xiaozhi

Traduction en français : je pensais le faire avec Xiaozhi.

Un visage qui est celui de Narsil demande une voix qui soit la sienne aussi. L’IA n’a pas écrit de nouveau caractère : elle a lu le README de narsil-pet et `hooks/words.ts`, et a gardé ce qu’ils disent d’elle. Le nom de la voix, la valeur de `language` et la phrase d’erreur en espagnol n’ont pas fait l’objet de questions ; ce sont des choix de l’IA tirés de la liste de voix de Microsoft et du modèle du serveur, et vous pouvez changer chacun d’eux.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas la conversation qui a servi à construire le bot.

> Mon appareil Xiaozhi parle via xinnan-tech/xiaozhi-esp32-server avec Claude comme LLM. Lis le `agent-base-prompt.txt` du serveur et `core/utils/prompt_manager.py` pour voir où va le réglage `prompt` et comment `{{language}}` est rempli. Écris ensuite un `prompt` pour mon personnage, un serpent de mer calme et chaleureux qui répond en deux phrases courtes au plus pour la voix, et les lignes de `data/.config.yaml` qui définissent des réponses en espagnol, une voix EdgeTTS en espagnol latino-américain que liste `edge-tts --list-voices`, et des versions espagnoles de `system_error_response` et `exit_commands`.

## Le code minimal

Les lignes que `data/.config.yaml` ajoute aux guides 4 et 5 :

```yaml
prompt: |
  You are Narsil, a small chibi sea serpent who lives on the author's desk.
  Your name comes from the reforged sword in The Lord of the Rings: you are
  here to cut bugs. You are calm, warm and composed, a little playful, never
  servile. You speak of yourself in the first person and never say your own
  name. Now and then you borrow an image from the sea, without overdoing it.
  You answer for a voice: at most two short sentences unless asked for more,
  no lists, no Markdown, no code read aloud. Speak neutral Latin American
  Spanish, with the simple past.

system_error_response: 'Tuve un tropiezo y no pude responder. Probemos de nuevo en un momento.'

end_prompt:
  enable: true
  prompt: |
    Say a short, warm goodbye in one sentence, as Narsil would.

exit_commands:
  - 'salir'
  - 'adiós'

TTS:
  EdgeTTS:
    voice: es-MX-DaliaNeural
    language: Spanish
```

La phrase d’erreur dit « j’ai trébuché et je n’ai pas pu répondre. Réessayons dans un moment », dans le même registre que les phrases d’erreur de narsil-pet. Seuls `voice` et `language` sont définis sous `EdgeTTS` ; `type` et `output_dir` viennent de `config.yaml`.

Redémarrez le serveur pour qu’il relise le fichier :

```powershell
docker compose restart
```

## Erreurs fréquentes et comment tester

- **Des réponses en chinois.** `language` manque ou se trouve sous un bloc TTS qui n’est pas sélectionné. Il doit se trouver sous le bloc nommé dans `selected_module.TTS`.
- **Des réponses longues.** Claude suit le prompt ; si Narsil parle trop, rendez la règle de longueur plus concrète (« une ou deux phrases ») plutôt que de baisser `max_tokens`, ce qui coupe les réponses en pleine phrase.
- **Une voix qui n’existe pas dans Edge.** Une voix de la liste de Microsoft qu’Edge ne propose pas échoue au moment de la synthèse. Vérifiez-la avec `edge-tts --list-voices`.
- **Un texte espagnol, une voix chinoise.** `voice` contient encore la valeur par défaut. La voix et la langue sont deux réglages distincts.
- **Le nom du personnage prononcé à voix haute.** La Narsil de narsil-pet ne dit jamais son propre nom ; si le bot le dit, précisez-le explicitement dans le prompt.
- **Du Markdown lu à voix haute.** Les astérisques et les dièses deviennent du bruit à l’oral. Le prompt les interdit ; s’ils apparaissent encore, ajoutez un exemple de bonne réponse.

Pour tester, redémarrez le serveur, réveillez le ventre et demandez « ¿quién eres? » (« qui es-tu ? »). Narsil devrait répondre en espagnol, en une ou deux phrases, avec la nouvelle voix, et sans dire son nom. Demandez ensuite quelque chose de long, comme le fonctionnement d’une recette : la réponse devrait rester courte et proposer d’en dire plus. Dites « salir » pour vérifier que la conversation se ferme.

## Pour aller plus loin

- **Votre propre modèle.** `prompt_template` peut pointer vers un fichier à vous, par exemple dans `data/`, si vous voulez retirer des règles qui ne conviennent pas à Narsil (la reconnaissance du locuteur du modèle ou sa section de sécurité). Gardez la section `<context>` en dernier pour que la découpe du cache du guide 5 fonctionne toujours.
- **Un mot d’activation personnalisé.** Avec `USE_CUSTOM_WAKE_WORD`, le ventre peut guetter une phrase de votre choix. Vérifiez dans la documentation d’ESP-SR quelles langues ses modèles MultiNet prennent en charge avant de choisir « Narsil ».
- **D’autres voix.** `private_voice`, s’il est défini, remplace `voice` dans le fournisseur EdgeTTS. Les fournisseurs TTS locaux (guide 4) gardent la voix sur votre PC.
- **Son stade.** La Narsil de narsil-pet grandit en cinq stades. Le ventre reçoit son état depuis ntfy (guide 7), et le serveur pourrait l’ajouter au prompt via le `dynamic_context` du modèle, pour que la Narsil du bureau parle selon le stade où elle en est.
- Le guide 7 montre les alertes de Narsil sur l’écran du ventre.
