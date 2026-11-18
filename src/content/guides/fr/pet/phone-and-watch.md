---
title: Les alertes sur votre téléphone et votre montre
description: 'Comment /narsil movil envoie ce qui a besoin de vous à un sujet ntfy.sh privé quand vous écrivez à distance : limite quotidienne, sujet d’état silencieux, clé de scellement, Web Push.'
route: pet
order: 15
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/phone.ts
  - repo: pet
    path: hooks/seal.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Ce que ça fait

Quand vous travaillez loin de l’ordinateur, en pilotant Claude Code par Remote Control depuis votre téléphone ou le web, la bande et la fenêtre flottante sont hors de vue. `/narsil movil` (« mobile ») envoie plutôt ce qui a besoin de vous à votre téléphone : une conversation s’est terminée, a besoin de vous, ou a échoué. Une montre qui reflète les notifications du téléphone les affiche aussi ; le README de Narsil cite Wear OS.

Les alertes passent par [ntfy.sh](https://ntfy.sh), un service de notifications public. La commande crée un sujet au nom aléatoire, comme `narsil-0000000000example0` (chaque nom de sujet de ce guide est un exemple inventé). Vous installez l’application ntfy, vous vous abonnez à ce sujet, et les alertes arrivent sous forme de notifications avec l’image de Narsil à son étape, dans la pose de l’alerte, et un bouton qui ouvre l’application Claude.

Narsil n’envoie que tant que votre dernier message, dans n’importe quelle conversation, est venu de Remote Control. Dès que vous écrivez de nouveau au bureau, dans l’une d’elles, elle s’arrête. Ainsi, le téléphone n’a de ses nouvelles que lorsque vous êtes vraiment absent ou absente.

> **Avertissement : quiconque connaît le nom du sujet peut le lire, et peut y publier.** Les sujets ntfy.sh, tels que Narsil les utilise, n’ont pas de mot de passe : le nom est la seule chose qui les garde privés. Ne le partagez pas, ne le collez pas dans des captures d’écran, et lancez `/narsil movil nuevo` pour passer à un nouveau sujet s’il fuit. Utilisez la clé (`/narsil movil clave`) si votre récepteur la prend en charge : avec elle, le titre et le texte de chaque alerte deviennent « Narsil » et un texte illisible pour quiconque n’a pas la clé, bien que le type d’alerte, son heure et l’étape de Narsil restent visibles.

Les commandes :

| Commande                  | Ce qu’elle fait                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------- |
| `/narsil movil` ou `on`   | Active les alertes (en créant le sujet la première fois) et indique comment le suivre. |
| `/narsil movil off`       | Les désactive ; `on` les réactive avec le même sujet.                                  |
| `/narsil movil nuevo`     | Crée un nouveau sujet ; l’ancien ne reçoit plus rien.                                  |
| `/narsil movil prueba`    | Envoie une alerte de test, même depuis le bureau.                                      |
| `/narsil movil clave`     | Crée une clé et scelle tout ce qui est envoyé à partir de maintenant.                  |
| `/narsil movil clave off` | Arrête le scellement.                                                                  |

## Comment ça marche à l’intérieur

`hooks/phone.ts` contient les parties simples (le sujet, le message, le décompte) sous forme de fonctions pures ; `hooks/seal.ts` contient le scellement ; `hooks/register.tsx` envoie et compte.

### Le sujet : `narsil-` et 20 caractères hexadécimaux

`newTopic(crypto.randomUUID())` dans `hooks/phone.ts` prend un UUID aléatoire, n’en garde que les caractères hexadécimaux, les met en minuscules et garde les 20 premiers : `narsil-` suivi de 20 caractères de `0-9a-f`. Le commentaire au-dessus énonce tout le modèle de sécurité du sujet : « A topic nobody guesses: whoever knows its name can read it. » (un sujet que personne ne devine : quiconque connaît son nom peut le lire).

Le sujet est enregistré dans les préférences (`phoneTopic` dans `prefs`, stocké avec `$.store`), si bien que chaque conversation utilise le même. `/narsil movil nuevo` le remplace par un nouveau.

Deux autres sujets en dépendent, par leur nom :

- `<topic>-estado` (« état ») : un état silencieux pour l’extension Firefox (voir plus bas).
- `<topic>-push` : là où une application web pour téléphone dépose son abonnement Web Push (voir plus bas).

### Quand une alerte est envoyée : là où vous avez écrit en dernier

La règle vient de la demande de l’auteur ou de l’autrice dans le journal de tâches (citée plus bas) : alerter le téléphone quand vous avez demandé depuis le téléphone. Aucun événement ne dit à un mod que Remote Control est actif, alors Narsil regarde d’où viennent vos messages.

Les types 2.1.325 donnent à `prompt.submit` et à `command.run` une `origin`, un `PromptOrigin`. Deux de ses types comptent ici : `composer`, « The user's own gesture at the terminal » (le geste propre de l’utilisateur au terminal), et `bridge`, « The user's message through the Remote Control bridge (a phone or web client) » (le message de l’utilisateur via le pont Remote Control, un client téléphone ou web). `noteOrigin` dans `hooks/register.tsx`, appelé depuis les deux hooks, enregistre le dernier :

- `bridge` signifie à distance ; `composer` signifie au bureau ; tout autre type ne change rien.
- Il est écrit dans `$.store` sous `remoteOrigin`, pas seulement dans une variable de module. Le store est partagé par toutes les conversations du plugin, si bien qu’une conversation que vous avez commencée au bureau alerte aussi pendant que vous écrivez depuis le téléphone dans une autre, et qu’aucune n’alerte plus dès que vous écrivez au bureau, où que ce soit.

`isAway` le relit, en se rabattant sur la variable de module quand le store échoue.

### Ce que contient une alerte

Chaque alerte passe par `announce` (guide 6), qui se termine en appelant `sendToPhone`. `phoneMessage` dans `hooks/phone.ts` construit le JSON qu’accepte ntfy.sh :

- `topic` : votre sujet.
- `title` : « Narsil · He terminado · api », avec le nom de la conversation en dernier.
- `message` : le texte, puis, quand plus d’une conversation est ouverte, une liste comme « Conversaciones: » suivie de « ● web · ERROR » et « ● api · TRABAJANDO ». Le texte du téléphone pour un tour terminé est plus long que celui du bureau, puisqu’un téléphone a de la place pour une plus grande partie de la réponse de Claude.
- `priority` : 3 pour une fin, 4 pour une question ou une erreur.
- `tags` : `white_check_mark`, `raising_hand` ou `warning`, que l’application ntfy affiche sous forme d’emoji.
- `icon` : son image en PNG à son étape et dans la pose de l’alerte, depuis le dépôt sur GitHub, que le téléphone télécharge lui-même.
- `actions` : un bouton « Abrir Claude » (« ouvrir Claude ») vers `https://claude.ai/code`. Le commentaire explique que rien sur un téléphone ne pointe vers la conversation elle-même, si bien que le bouton ouvre l’application Claude, où Remote Control la liste.

`postToPhone` l’envoie avec `$.http.fetch` sous forme de `POST` vers `https://ntfy.sh` avec un corps JSON. Le mode discret s’applique comme partout : une fin n’est pas envoyée, une question ou une erreur l’est.

### La limite quotidienne : 200

`PHONE_DAILY` vaut 200. Le commentaire du code : « ntfy.sh takes 250 a day for free: Narsil stops short of it. » (ntfy.sh en accepte 250 par jour gratuitement : Narsil s’arrête avant). Le README dit la même chose.

Le décompte vit dans `$.store` sous `phone`, sous la forme `{ day, sent }`, partagé par toutes les conversations. `day` vient de `dayOf`, la date UTC (« 2026-10-31 »), si bien que le décompte repart à minuit UTC, et non à minuit heure locale. Un décompte stocké d’un autre jour, ou une valeur étrange, compte comme zéro.

Avant chaque message, `postToPhone` vérifie le décompte et s’arrête à 200. Le 200e message, quand c’est une alerte, se termine par « (último aviso de hoy: mañana sigo) » (« dernière alerte du jour : je continue demain »). Un message dont l’envoi échoue n’est pas compté. Les messages du sujet `-estado` comptent dans les mêmes 200.

### Le sujet `-estado` et ses champs

Après chaque tour de la conversation principale, et avec chaque question, `sendStatus` publie un petit état sur `<topic>-estado`, selon les mêmes règles que les alertes (alertes activées, vous à distance, le décompte quotidien). `/narsil movil prueba` en envoie un aussi. Il part avec `priority: 1`, et le commentaire du code dit que ce sujet n’est « not followed by push, so its messages never show as notifications » (pas suivi par push, si bien que ses messages ne s’affichent jamais comme notifications).

Le README dit qu’il est lu par l’extension Firefox de l’auteur ou de l’autrice (`narsil-claude`), « because they are data only the PC knows » (parce que ce sont des données que seul le PC connaît). Le message est un texte JSON avec ces champs :

| Champ          | Ce que c’est                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| `xp`           | Le libellé de niveau de Narsil, « ⭐ Nivel 3 · 120/300 XP » (guide 13).                                 |
| `art`          | L’URL de son image, à son étape, dans la pose de la conversation ouverte la plus importante.            |
| `at`           | Le moment de l’envoi, en secondes Unix.                                                                 |
| `cacheMinutes` | La durée du cache du prompt, d’après la première conversation ouverte qui en a un ; absent sinon.       |
| `usage`        | Une ligne, `ntfy`, avec le décompte propre à ntfy.sh des messages du jour depuis votre réseau, ou vide. |

Pour `usage`, Narsil demande `GET https://ntfy.sh/v1/account` et construit la ligne avec `ntfyRow` : `{ key: 'ntfy', label: 'ntfy hoy', percent, color, note, resetsAt }`, en comptant le message sur le point de partir. Le commentaire explique pourquoi ce décompte diffère de celui de Narsil : ntfy.sh compte par adresse IP, « in a day of its own that starts at an hour hashed from the IP, not at midnight » (dans une journée à lui qui commence à une heure calculée par hachage de l’IP, et non à minuit).

### La clé facultative, et comment le contenu est scellé

`/narsil movil clave` (« clé ») crée une clé avec `newKey()` : 32 octets aléatoires de `crypto.getRandomValues`, écrits en base64url (43 caractères). Elle est enregistrée dans les préférences (`phoneKey`) et affichée dans la réponse de la commande, pour que vous puissiez la coller dans les options du récepteur. À partir de là, tout ce que Narsil publie sur ntfy.sh, alertes et `-estado` confondus, est scellé.

Ce qui est scellé et ce qui ne l’est pas, d’après `sealedMessage` et `sealedPayload` dans `hooks/phone.ts` :

- **Scellé :** le titre et le texte, ensemble sous forme de JSON dans `message`.
- **En clair :** le sujet, `title` remplacé par simplement « Narsil », la priorité, les tags, l’URL de l’icône et le bouton.

Une alerte scellée montre donc toujours qu’une alerte a eu lieu, quand, son type (par la priorité, le tag et la pose dans le nom de fichier de l’icône) et l’étape de Narsil (par le dossier de l’icône). Le nom de la conversation, la réponse de Claude et la liste des conversations sont à l’intérieur.

Le schéma, exactement tel que `hooks/seal.ts` l’implémente. Le commentaire du fichier explique pourquoi il est construit à la main : « The hooks module's crypto has SHA-256 alone » (la crypto du module de hooks n’a que SHA-256). Les types 2.1.325 le confirment : le `crypto.subtle` du module de hooks déclare `digest` et rien d’autre. Donc :

1. **HMAC-SHA256 à partir de `digest`.** `hmac(key, data)` est la construction classique sur SHA-256 : la clé complétée à 64 octets (hachée d’abord si elle est plus longue), puis `SHA-256((key ⊕ 0x5c) ‖ SHA-256((key ⊕ 0x36) ‖ data))`.
2. **Deux clés à partir d’une.** À partir de la clé de 32 octets, `encKey = HMAC(key, "enc")` et `macKey = HMAC(key, "mac")`.
3. **Un nonce neuf.** 16 octets aléatoires pour chaque message.
4. **Le flux de clé.** Le bloc `i` est `HMAC(encKey, nonce ‖ i)`, avec `i` sur 4 octets, gros-boutiste ; chaque bloc donne 32 octets, combinés par XOR avec le texte UTF-8. Le commentaire appelle cela le mode compteur (CTR).
5. **Le tag.** `HMAC(macKey, nonce ‖ ciphertext)`, 32 octets, sur les octets chiffrés (le commentaire l’appelle « encrypt-then-MAC », chiffrer puis authentifier).
6. **Le texte envoyé.** `narsil1:` suivi du base64url de `nonce ‖ ciphertext ‖ tag`.

`unseal` fait l’inverse : il vérifie le préfixe `narsil1:` et une longueur minimale, recalcule le tag et le compare octet par octet, et seulement ensuite déchiffre. Une mauvaise clé, un octet modifié ou un texte non scellé donnent `null`. Le test « what the mod seals, it opens; with another key, or tampered, it does not » (ce que le mod scelle, il l’ouvre ; avec une autre clé, ou altéré, non) vérifie ces trois cas. Le commentaire dit que les récepteurs l’ouvrent avec le HMAC de WebCrypto, « which gives the same bytes » (qui donne les mêmes octets) ; ces récepteurs sont des projets séparés, absents de ce dépôt.

Ce guide décrit ce que fait le code et n’affirme rien au-delà. Si vous l’adaptez, relisez-le comme vous le feriez pour toute cryptographie construite à la main.

L’application ntfy ne peut pas ouvrir les messages scellés : elle affiche le bruit. Narsil le dit quand vous activez la clé, et `/narsil movil clave off` revient au texte en clair. Lancer de nouveau `/narsil movil clave` crée une nouvelle clé.

### Web Push : garder abonnée une application web pour téléphone

En plus de l’application ntfy, les alertes peuvent atteindre une application web à vous via Web Push ; le README cite [narsil-pwa](https://github.com/davshn/narsil-pwa), de l’auteur ou de l’autrice. ntfy.sh peut livrer un sujet par Web Push à un abonnement de navigateur, mais, comme le dit le commentaire du code, « ntfy.sh drops a subscription whose delivery failed once » (ntfy.sh abandonne un abonnement dont la livraison a échoué une fois). L’application pourrait se réinscrire quand vous l’ouvrez, mais les alertes attendraient alors que vous l’ouvriez.

Le mod l’inscrit donc de nouveau avant chaque alerte (`renewPush`, appelé seulement pour les alertes, pas pour `-estado`) :

1. L’application dépose son abonnement, `{ endpoint, auth, p256dh }`, sur `<topic>-push`, scellé avec la clé quand il y en a une.
2. `latestPush` lit le dernier message qui s’y trouve, `GET https://ntfy.sh/<topic>-push/json?poll=1&since=latest`. Avec une clé, il l’ouvre avec `unseal` ; sans clé, il le lit tel quel.
3. `pushSubscriptionOf` n’accepte qu’un endpoint `https` de 1 000 caractères au plus et deux courtes clés base64url ; tout le reste est ignoré.
4. Un abonnement valide est gardé dans `$.store` sous `phonePush`. Quand ntfy.sh a oublié le message (le commentaire dit qu’il garde un message 12 heures), celui qui a été gardé est utilisé.
5. Il est publié sur `https://ntfy.sh/v1/webpush` avec `topics: [your topic]`.

L’inscription ne publie rien, si bien qu’elle ne compte pas dans les 200. Tout échec est avalé, et l’alerte part comme elle l’aurait fait.

Deux remarques de confidentialité découlent du code. L’abonnement lui-même part chez ntfy.sh en clair, comme Web Push l’exige. Et sans clé, quiconque connaît le sujet peut déposer un abonnement sur `<topic>-push`, et le mod l’inscrira pour votre sujet ; avec une clé, le mod ne prend qu’un abonnement qui s’ouvre avec elle.

### Le modèle de confidentialité en termes simples

- **ntfy.sh voit tout ce qui n’est pas scellé**, ainsi que l’heure et le réseau de chaque message. C’est un service tiers : lisez ses conditions avant d’y envoyer quoi que ce soit.
- **Le nom du sujet est le mot de passe.** Quiconque l’a peut lire chaque message et en publier de faux. Un nom aléatoire le rend difficile à deviner, pas secret une fois partagé.
- **Sans clé**, un lecteur ou une lectrice du sujet voit les noms des conversations, le texte de chaque alerte (une partie de la réponse de Claude) et la liste des conversations ouvertes.
- **Avec une clé**, un lecteur ou une lectrice voit qu’une alerte a eu lieu, son type, son heure et l’étape de Narsil, mais pas le texte. Un message falsifié ne s’ouvre pas avec la clé, ce qui permet à un récepteur qui vérifie le tag de le rejeter.
- **La clé vit à deux endroits** : dans le store du plugin, un fichier JSON sous le répertoire de configuration de Claude Code, et dans la réponse de `/narsil movil clave`, qui fait partie de la conversation. Les réponses des commandes de Narsil ne définissent pas `isTextDisplayOnly`, et les types 2.1.325 disent que, hormis les plugins livrés avec Claude Code, « Any other plugin's text stays in requests » (le texte de tout autre plugin reste dans les requêtes), si bien que le modèle la lit aussi. Considérez que la conversation contient la clé.
- **L’envoi s’arrête au bureau.** Rien ne part tant que votre dernier message est venu du terminal ou de l’application de bureau, sauf le test.

## Le construire avec Claude

Demandez à Claude d’envoyer sur votre téléphone, par ntfy.sh, ce qui a besoin de vous, uniquement quand vous êtes absent. L’idée que Claude doit bien saisir : l’absence n’est pas un événement ; elle se lit dans l’origine de votre dernier message, `bridge` pour Remote Control et `composer` pour le poste de travail.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon mod Claude Code `my-pet`, ajoute des alertes sur le téléphone via ntfy.sh. `/my-pet phone` crée un sujet `my-pet-` plus 20 caractères hexadécimaux tirés de `crypto.randomUUID()`, l’enregistre dans `$.store`, et répond comment s’abonner dans l’application ntfy, en avertissant que quiconque connaît le sujet peut le lire. Enregistre l’endroit où la personne a écrit en dernier : dans `prompt.submit` et `command.run`, `e.origin.kind === 'bridge'` signifie à distance et `'composer'` signifie au bureau ; garde-le dans `$.store` pour que toutes les conversations le partagent. Quand un tour de la conversation principale se termine, et seulement à distance, publie `{ topic, title, message, priority }` en JSON sur `https://ntfy.sh` avec `$.http.fetch`. Compte les messages par jour UTC dans `$.store` et arrête-toi à 200. Ne mets jamais le sujet dans les journaux. Teste avec `claude-code/testing`, en répondant toi-même à `http.fetch` : rien n’est envoyé au bureau, une alerte est envoyée depuis le pont, et la 201e du jour ne l’est pas.

### Ce qu’il faut vérifier dans la réponse de Claude

1. Le sujet est `my-pet-` suivi de 20 caractères hexadécimaux tirés de `crypto.randomUUID()`, jamais un nom qu’on pourrait deviner, et il n’apparaît jamais dans un journal.
2. `prompt.submit` comme `command.run` enregistrent l’origine, et elle est gardée dans `$.store`, si bien que toutes les conversations la partagent.
3. Rien n’est publié tant que le dernier message vient du poste de travail.
4. Les messages sont comptés par jour UTC dans `$.store`, le compte est vérifié avant chaque message, et l’envoi s’arrête à 200.
5. La réponse de la commande prévient que toute personne qui connaît le sujet peut le lire.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « mon téléphone vibre pendant que je tape au poste de travail ».

### Comment l’auteur l’a demandé

#### Consigné : alerter le téléphone quand j’écris depuis le téléphone

La règle du téléphone telle qu’elle fonctionne aujourd’hui a été demandée dans le journal de tâches de la vue de flotte, `odd/tasks/fleet-view.md`. L1 (2026-11-06), la demande d’origine, comprend :

> "las notificaciones se enviarian al celular cuando se pida algo desde el celular como ahora y haya cambios, es decir alguna tarea pase de trabajando a terminado, o de trabajando a error, etc, [...] las notificaciones del celular cuando se envien llevarian la info de todas las sesiones funcionando en ese momento"

Traduction en français : les notifications seraient envoyées au téléphone quand on demande quelque chose depuis le téléphone, comme maintenant, et qu’il y a des changements, c’est-à-dire qu’une tâche passe de en cours à terminée, ou de en cours à erreur, etc. ; les notifications du téléphone, quand elles sont envoyées, porteraient les informations de toutes les sessions en cours à ce moment-là.

Dans L2, en réponse à la question de savoir si une conversation commencée au bureau devait alerter aussi pendant que l’auteur ou l’autrice écrit depuis le téléphone dans une autre :

> "si claro me avisas al movil"

Traduction en français : oui, bien sûr, tu me préviens sur le téléphone.

Le journal de tâches consigne le résultat dans L9 (T4 terminée) : « Where you last wrote (phone or desk), in any conversation, is kept in the store (`remoteOrigin`), so every conversation alerts the phone on its changes (done, waiting, error) while your last message came from the phone, and none does once you write at the desk anywhere. Each alert ends with "Conversaciones:" and one line per open conversation » (l’endroit où vous avez écrit en dernier, téléphone ou bureau, dans n’importe quelle conversation, est gardé dans le store, `remoteOrigin`, si bien que chaque conversation alerte le téléphone de ses changements, terminé, en attente, erreur, tant que votre dernier message est venu du téléphone, et qu’aucune ne le fait plus dès que vous écrivez au bureau, où que ce soit. Chaque alerte se termine par "Conversaciones:" et une ligne par conversation ouverte). C’est ce que font aujourd’hui `noteOrigin`, `isAway` et `fleetText`.

L9 décrit aussi un état `-estado` plus riche, avec une liste `sessions` et les champs de la conversation la plus importante. Cet état a été réduit plus tard : `544ef89` (2026-11-09) « feat: send only what the Firefox extension reads through ntfy » (n’envoyer par ntfy que ce que lit l’extension Firefox) a laissé les cinq champs ci-dessus. Le code et le README s’accordent sur les cinq.

#### Reconstitution à partir de l’historique des commits

Les étapes antérieures n’ont pas été consignées. À partir de `git log -- hooks/phone.ts hooks/seal.ts` et des commits liés :

- `d91997f` (2026-10-31) « feat: send what needs you to your phone and watch through ntfy, with Narsil's picture » (envoyer ce qui a besoin de vous à votre téléphone et à votre montre via ntfy, avec l’image de Narsil). Le sujet, les alertes, l’icône et la limite de 200 arrivent ensemble.
- `c27a9e4` (2026-10-31) « feat: send phone alerts only while you write through Remote Control » (n’envoyer les alertes au téléphone que pendant que vous écrivez via Remote Control). La règle de l’endroit où vous avez écrit en dernier.
- `4f8abaa` (2026-11-01) « feat: send the state the band shows to a status topic for your own phone app » (envoyer l’état que montre la bande à un sujet d’état pour votre propre application de téléphone). Le sujet `-estado`.
- `5a9ee10` (2026-11-01) « feat: seal phone messages with /narsil movil clave, send reset times and an Abrir Claude button » (sceller les messages du téléphone avec /narsil movil clave, envoyer les heures de réinitialisation et un bouton Abrir Claude). `hooks/seal.ts` voit le jour.
- `644e59f` (2026-11-01) « fix: send the state to the phone with each question, so the app shows Narsil waiting » (envoyer l’état au téléphone avec chaque question, pour que l’application montre Narsil en attente).
- `7498be5` (2026-11-02) « feat: register the phone app's push subscription again before each alert, so alerts keep coming after ntfy.sh drops it » (réinscrire l’abonnement push de l’application du téléphone avant chaque alerte, pour que les alertes continuent d’arriver après que ntfy.sh l’a abandonné).
- `3a1f31c` (2026-11-06) « feat: alert the phone for every conversation and list them all » (alerter le téléphone pour chaque conversation et les lister toutes). La demande citée plus haut.
- `544ef89` (2026-11-09) « feat: send only what the Firefox extension reads through ntfy » (n’envoyer par ntfy que ce que lit l’extension Firefox). Son message : « The phone web app is gone » (l’application web du téléphone a disparu), et le renouvellement Web Push est parti avec elle.
- `5fe48c9` (2026-11-10) « feat: register the phone app's push subscription again before each alert » (réinscrire l’abonnement push de l’application du téléphone avant chaque alerte). Son message : « The phone web app is back as the alert receiver, in Chrome » (l’application web du téléphone revient comme récepteur des alertes, dans Chrome), et le renouvellement est revenu, désormais avec le repli de 12 heures.

L’historique montre une fonctionnalité façonnée par ses récepteurs : chaque fois que l’application de l’autre côté a changé, le côté du mod a changé avec elle.

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide. Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

Écrit pour ce guide et vérifié par rapport aux types 2.1.325 (`$.store.get`, `$.store.set`, `$.http.fetch`, `$.clock.now`, `$.command.register`, `command.run`, `prompt.submit`, `turn.complete`, `crypto.randomUUID`). Il est adapté de `hooks/phone.ts` et de `hooks/register.tsx` dans [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). Il envoie du texte en clair ; pour le scellement, lisez `hooks/seal.ts`.

```tsx
import type { EngineInterface, Register } from 'claude-code'

const NTFY = 'https://ntfy.sh'
const DAILY = 200

async function isAway($: EngineInterface): Promise<boolean> {
  return (await $.store.get('away').catch(() => false)) === true
}

async function noteOrigin($: EngineInterface, kind: string): Promise<void> {
  if (kind === 'bridge' || kind === 'composer')
    await $.store.set('away', kind === 'bridge').catch(() => undefined)
}

async function sendToPhone($: EngineInterface, title: string, message: string): Promise<void> {
  const topic = await $.store.get('topic').catch(() => undefined)
  if (typeof topic !== 'string' || !(await isAway($))) return
  const day = new Date(await $.clock.now()).toISOString().slice(0, 10)
  const saved = (await $.store.get('sent').catch(() => undefined)) as
    { day?: string; sent?: number } | undefined
  const sent = saved?.day === day && typeof saved.sent === 'number' ? saved.sent : 0
  if (sent >= DAILY) return
  try {
    const { ok } = await $.http.fetch(NTFY, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic, title, message, priority: 3 }),
    })
    if (ok) await $.store.set('sent', { day, sent: sent + 1 })
  } catch {
    // offline: the alert is lost, and nothing else breaks
  }
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'my-pet', description: 'My pet: phone' })
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await noteOrigin($, e.origin.kind)
    return next(e)
  })

  on('command.run', { command: 'my-pet' }, async ($, e) => {
    await noteOrigin($, e.origin.kind)
    if (e.args.trim() !== 'phone') return { text: 'Usage: /my-pet phone' }
    let topic = await $.store.get('topic').catch(() => undefined)
    if (typeof topic !== 'string') {
      topic = `my-pet-${crypto
        .randomUUID()
        .replace(/[^0-9a-f]/gi, '')
        .toLowerCase()
        .slice(0, 20)}`
      await $.store.set('topic', topic)
    }
    return {
      text: `Subscribe to ${topic} on ntfy.sh in the ntfy app. Anyone who knows this name can read it: do not share it.`,
    }
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined && e.reason === 'answer')
      await sendToPhone($, 'My pet · Done', e.answer.slice(0, 300))
    return result
  })
}
```

La réponse de la commande montre le sujet une fois, à dessein, pour que la personne puisse s’abonner ; n’oubliez pas que cette réponse reste dans la conversation. Narsil fait de même.

## Erreurs fréquentes et comment tester

- **Un sujet devinable.** Un sujet qui porte votre nom ou celui de votre projet peut être lu par quiconque l’essaie. Utilisez un nom aléatoire.
- **Journaliser le sujet ou la clé.** Les deux sont des secrets. Gardez-les hors de `$.ui.log`, des captures d’écran, des issues et des fixtures de test que vous publiez.
- **Alerter au bureau.** Sans la règle de l’origine, le téléphone vibre pendant que vous êtes assis ou assise devant l’écran. Remote Control n’est pas un événement ; l’origine du dernier message est le signal.
- **Garder l’origine seulement dans une variable de module.** Chaque conversation déciderait alors seule, et une conversation commencée au bureau n’alerterait jamais pendant que vous écrivez depuis le téléphone dans une autre.
- **Aucun plafond quotidien.** Une boucle de tours qui échouent peut épuiser une offre gratuite en quelques minutes. Comptez avant d’envoyer, par jour, à travers les conversations.
- **Croire que « chiffré » veut dire « invisible ».** Le scellement de Narsil cache le titre et le texte, pas le fait, l’heure, le type et l’icône d’une alerte.
- **De la cryptographie construite à la main sans tests.** Sceller, ouvrir, une mauvaise clé et un octet inversé sont le minimum, comme le fait le test de Narsil.

Pour tester, `tests/narsil.test.tsx` répond lui-même à `http.fetch`, si bien que rien n’atteint ntfy.sh. À lire : « the phone gets nothing until /narsil movil is turned on » (le téléphone ne reçoit rien tant que /narsil movil n’est pas activé), « /narsil movil makes a private topic, says how to follow it, and sends what needs you there » (/narsil movil crée un sujet privé, dit comment le suivre, et y envoie ce qui a besoin de vous), « the phone gets alerts only while you write through Remote Control, never at the desk » (le téléphone ne reçoit des alertes que pendant que vous écrivez via Remote Control, jamais au bureau), « while you write from the phone in another conversation this one alerts too, and a message at the desk anywhere stops it » (pendant que vous écrivez depuis le téléphone dans une autre conversation, celle-ci alerte aussi, et un message au bureau, où que ce soit, l’arrête), « the phone gets at most 200 a day, says which is the last, and starts again the next day » (le téléphone en reçoit au plus 200 par jour, dit laquelle est la dernière, et recommence le lendemain), « /narsil movil clave seals what goes to ntfy.sh; clave off sends it in the clear again » (/narsil movil clave scelle ce qui part vers ntfy.sh ; clave off l’envoie de nouveau en clair), « as a turn ends from the phone, the extension gets only what it reads on the status topic, silently » (quand un tour se termine depuis le téléphone, l’extension ne reçoit que ce qu’elle lit sur le sujet d’état, en silence) et « the state the extension reads does not register the subscription; only alerts do » (l’état que lit l’extension n’inscrit pas l’abonnement ; seules les alertes le font).

### Là où le code et le README diffèrent

- Le README dit que la clé n’est détenue que par « tu PC y la extensión » (votre PC et l’extension). Le commentaire de `hooks/seal.ts` dit « the PC, the Firefox extension and the phone app » (le PC, l’extension Firefox et l’application du téléphone), et la section Web Push du README scelle l’abonnement de l’application avec la clé. Le code fait ce que dit le commentaire.
- Le README dit que l’état `-estado` part « Al terminar cada turno » (à la fin de chaque tour). Le code l’envoie aussi avec chaque question, et avec le test.

## Pour aller plus loin

- `fleetText` dans `hooks/phone.ts` construit la liste des conversations sous chaque alerte.
- `ntfyRow` transforme la réponse de compte de ntfy.sh en une ligne d’utilisation du même genre que celles que la bande dessine pour les limites du compte (guide 7).
- `summary` dans `hooks/words.ts` coupe la réponse de Claude pour l’alerte, avec plus de place pour le téléphone (`PHONE_ROOM`).
- Le guide suivant, le résumé de session, est une autre chose que Narsil compte et garde dans `$.store`.
