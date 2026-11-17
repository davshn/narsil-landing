---
title: La fenêtre flottante
description: 'Comment Narsil affiche une fenêtre au premier plan si Claude est réduit ou si quelque chose vous attend, et pourquoi son serveur local n’écoute que sur 127.0.0.1, avec clé de page et jeton du mod.'
route: pet
order: 5
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: overlay/server.cjs
  - repo: pet
    path: overlay/overlay.html
  - repo: pet
    path: overlay/watch.ps1
  - repo: pet
    path: overlay/mac-claude.js
  - repo: pet
    path: overlay/start.sh
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: odd/tasks/animated-poses.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/overlay-server.check.cjs
---

## Ce que ça fait

La bande au-dessus du prompt n’aide que tant que vous regardez Claude. Dès que vous le réduisez pour lire une page ou répondre à un message, un tour terminé ou une question passe inaperçu.

La fenêtre flottante comble ce manque. C’est une petite fenêtre de 330 sur 450 pixels qui :

- **Apparaît quand Claude est réduit** (ou fermé), et **se masque d’elle-même** quand vous revenez à Claude.
- **Apparaît quand quelque chose vous attend**, même si Claude est seulement derrière une autre application : une question, une autorisation, une erreur ou un tour terminé.
- **Reste au premier plan** des autres fenêtres sous Windows, dans le coin de l’écran où se trouve Claude, sans prendre le focus du clavier à ce que vous êtes en train de faire.
- Affiche Narsil avec la conversation la plus importante (ou celle dont l’alerte attend), les limites du compte et chaque conversation ouverte dans une liste qui défile. Appuyer sur une conversation ouvre son contexte, ses tâches, ses sous-agents, son cache et ses étapes suivantes, avec un bouton qui fait passer cette conversation au premier plan dans l’application de bureau.

Une alerte « terminé » part d’elle-même au bout de 20 secondes ; une question ou une erreur reste jusqu’à ce que vous regardiez Claude ou que vous la fermiez. Si vous fermez la fenêtre, l’alerte suivante la fait revenir, mais pas avant une minute après sa fermeture. `/narsil flotante` active ou désactive la fenêtre, et `/narsil prueba` envoie une alerte de test qui s’affiche même pendant que vous regardez Claude.

Sous macOS, la fenêtre se comporte un peu différemment, comme l’explique le README : elle est ouverte et fermée au lieu d’être masquée (masquer la fenêtre d’une autre application nécessiterait l’autorisation d’accessibilité), elle s’ouvre derrière l’application en cours d’utilisation, et elle ne reste pas au premier plan. Le navigateur se souvient de l’endroit où vous l’avez placée. Sur les autres systèmes, il n’y a pas de fenêtre ; la bande, la voix et les notifications de Claude Code restent.

## Comment ça marche à l’intérieur

Quatre éléments, chacun avec une seule tâche :

| Élément                                     | Ce que c’est                                | Sa tâche                                                                                 |
| ------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Le mod (`hooks/register.tsx`)               | Du code de mod, un par conversation         | Démarre le hub, signale l’état de cette conversation, envoie les alertes                 |
| Le hub (`overlay/server.cjs`)               | Un simple script Node.js                    | Conserve l’état de chaque conversation, sert la page, décide quand la fenêtre s’affiche  |
| La page (`overlay/overlay.html`)            | Une page web dans une fenêtre de navigateur | Dessine Narsil et la liste, renvoie vos appuis                                           |
| Le gardien (`watch.ps1` ou `mac-claude.js`) | Un script système                           | Surveille la fenêtre de Claude et affiche, masque ou positionne la fenêtre du navigateur |

Le hub est le même serveur que le guide précédent appelle le hub : il recueille l’état de chaque conversation. Ce guide examine son autre moitié, la fenêtre.

### Démarrer le hub et la fenêtre

Dans `session.start`, le mod appelle `startOverlay` un instant après le début de la session. Il envoie un ping à `http://127.0.0.1:47190/ping` avec `$.http.fetch` ; si le serveur répond `narsil 4`, il tourne déjà. Si une version plus ancienne répond, le mod l’arrête d’abord, puisqu’un serveur survit aux mises à jour du mod.

Sinon, il en démarre un, en transmettant trois valeurs dans l’environnement : `NARSIL_TOKEN` (le jeton du mod, voir plus bas), `NARSIL_PORT` (`47190`) et `NARSIL_WINDOW` (`1` quand la fenêtre flottante est activée, `0` quand elle est désactivée). Le processus est démarré de manière détachée, si bien qu’il survit au hook qui l’a démarré :

- **Sous Windows**, au moyen de `$.process.run` qui exécute PowerShell, lequel trouve Node et Microsoft Edge et appelle `Start-Process` sur `node overlay/server.cjs`. Le chemin d’Edge va dans `NARSIL_EDGE`.
- **Sous macOS**, au moyen de `$.process.run` qui exécute `overlay/start.sh`, lequel cherche Chrome, Edge ou Brave et Node aux emplacements habituels, puis démarre le serveur avec `nohup ... &`.

Sans navigateur, le serveur tourne quand même et sert les conversations ; il n’y a simplement pas de fenêtre.

Quand la fenêtre est souhaitée, le serveur ouvre le navigateur en mode application, sans barre d’adresse ni onglets : `--app=http://127.0.0.1:47190/`, son propre dossier de profil (`--user-data-dir`, sous `%LOCALAPPDATA%\narsil-overlay` sous Windows) et `--window-size=330,450`. Il transmet aussi `--disable-background-timer-throttling` et deux options semblables, parce que la fenêtre est masquée la plupart du temps et doit pourtant se mettre à jour immédiatement quand elle s’affiche.

### Le gardien : Claude est-il réduit ?

Une page web ne peut pas voir les autres fenêtres, et Node non plus sans aide. Un petit script système surveille donc la fenêtre de Claude et demande au hub quoi faire.

Sous Windows, `overlay/watch.ps1` tourne en boucle toutes les 400 ms. Il trouve la fenêtre du processus `claude` intitulée `Claude`, et la fenêtre d’Edge intitulée `Narsil`, au moyen de quelques appels à `user32.dll`. Il classe Claude ainsi :

- `min` : réduit ou non visible.
- `fg` : la fenêtre au premier plan.
- `bg` : visible mais derrière une autre application.
- `gone` : aucune fenêtre de Claude.

Il appelle ensuite `GET /tick?claude=<state>&window=<0|1>` avec le jeton du mod, et exécute chaque ligne de la réponse : `show` place la fenêtre en bas à droite de l’écran où Claude a été vu pour la dernière fois, à 16 pixels du bord, avec `SetWindowPos` et les indicateurs « topmost » (au premier plan) et « do not activate » (ne pas activer) ; `hide` la masque ; `open <link>` fait passer Claude au premier plan et ouvre un lien de conversation. Après cinq appels échoués d’affilée (le serveur a disparu), il se termine.

Sous macOS, `overlay/mac-claude.js` est un script JavaScript for Automation exécuté avec `osascript -l JavaScript`. Toutes les 700 ms, il lit la liste des fenêtres de Core Graphics et affiche `fg`, `bg` ou `none`. Le commentaire du fichier explique ce choix : la liste des fenêtres nomme l’application de chaque fenêtre sans aucune autorisation, alors que les titres des fenêtres en nécessiteraient une. Ici, la logique du gardien se trouve dans le serveur lui-même (`keepMac`) : `none` devient `min`, ou `gone` quand `pgrep -x Claude` ne trouve aucun processus.

### Décider quand afficher

La décision tient en une fonction, `tick`, dans `overlay/server.cjs` :

- La fenêtre doit s’afficher quand Claude est `min` ou `gone`, ou quand un événement attend.
- Un événement est effacé quand vous regardez Claude (`fg`), et un événement `done` au bout de 20 secondes (`DONE_EVENT_MS`).
- `show` ou `hide` n’est envoyé que lorsque l’état souhaité change, si bien qu’une fenêtre que vous avez déplacée reste là où vous l’avez mise.

Les événements viennent du mod par `POST /event`, avec un type `done`, `question` ou `error`. Le serveur ignore un événement qui arrive pendant que vous regardez Claude, sauf s’il est forcé (le test `/narsil prueba` et le rappel « toujours en attente » des cinq minutes). Si vous avez fermé la fenêtre, un événement ne la rouvre qu’après `REOPEN_AFTER_CLOSE_MS`, soit 60 secondes.

### Événements envoyés par le serveur : comment la page reste à jour

La page ne demande pas de mises à jour au serveur chaque seconde. Elle ouvre une seule connexion longue avec `new EventSource('/events')`. Le serveur répond avec le type de contenu `text/event-stream`, écrit immédiatement l’instantané actuel et garde la connexion ouverte. Chaque changement ultérieur est écrit sur chaque connexion ouverte sous la forme d’une ligne `data: <json>` suivie d’une ligne vide (`broadcast`).

C’est le format des événements envoyés par le serveur (server-sent events) : un flux à sens unique du serveur vers la page, sur du simple HTTP. Il convient bien à la fenêtre. Le navigateur se reconnecte de lui-même si la connexion tombe, et le serveur n’envoie que lorsque quelque chose d’affiché a changé : un battement qui ne change rien n’est pas diffusé.

L’instantané contient chaque conversation active et l’événement en attente. La page écrit le texte avec `textContent`, jamais sous forme de HTML, et dessine le SVG de Narsil comme une image à partir d’une URL `Blob`, une manière d’afficher une image dans laquelle les scripts contenus dans le SVG ne s’exécutent pas.

Les actions propres à la page sont de petites requêtes `POST` : `/open` (faire passer une conversation au premier plan, par l’intermédiaire du gardien), `/dismiss` (effacer l’événement) et `/bounds` (l’emplacement de la fenêtre à l’écran, utilisé sous macOS pour placer la fenêtre des conseils au-dessus d’elle).

### Sécurité : qui peut parler au hub

Le hub tourne sur votre ordinateur et sait ce que fait chaque conversation. Il est construit pour que trois choses seulement puissent l’utiliser : le mod, le gardien et sa propre page. Quatre protections s’en chargent, toutes dans `overlay/server.cjs`.

**1. Il n’écoute que sur l’adresse de bouclage.** Les dernières lignes du fichier sont :

```js
server.listen(port, '127.0.0.1', () => {
  if (isWindowWanted) openWindow()
})
```

`127.0.0.1` est l’adresse qu’un ordinateur utilise pour se parler à lui-même. Un serveur lié à cette adresse n’accepte de connexions que des programmes de la même machine. Un autre ordinateur de votre réseau Wi-Fi ou de votre réseau de bureau ne peut pas du tout ouvrir de connexion vers lui, quoi qu’il envoie.

**2. Le jeton du mod.** Le mod crée un jeton aléatoire avec `crypto.randomUUID()` la première fois et le conserve dans `$.store` sous `overlayToken` (`overlayToken` dans `hooks/register.tsx`), si bien que chaque conversation utilise le même. Il n’atteint le serveur que par la variable d’environnement `NARSIL_TOKEN` quand le mod le démarre, et le serveur le transmet à `watch.ps1` de la même façon. Chaque requête du mod ou du gardien le porte dans l’en-tête `x-narsil-token`. Le serveur le compare (`isTrusted`) et refuse avec `403` quand il est absent ou erroné ; un jeton vide ne correspond jamais.

**3. La clé de la page.** On ne peut pas donner le jeton du mod à la page : tout ce qui se trouve dans une page web est visible par quiconque charge cette page. Le serveur crée donc un second secret pour la page : `PAGE_KEY`, 16 octets aléatoires issus de `crypto.randomBytes` de Node, nouveaux à chaque démarrage du serveur. Il écrit la clé dans la page à l’endroit où `overlay.html` contient l’espace réservé `__NARSIL_KEY__` (une balise `<meta name="narsil-key">`), et la page la renvoie dans l’en-tête `x-narsil-page` avec chacune de ses actions. Le commentaire du serveur en donne la raison : une page d’un autre site ne peut pas lire celle-ci, donc elle ne peut pas apprendre la clé.

**4. La vérification de `Host`.** Avant toute autre chose, le serveur refuse avec `403` toute requête dont l’en-tête `Host` n’est pas `127.0.0.1:47190` ou `localhost:47190`. Cela arrête le DNS rebinding, une attaque dans laquelle un site web fait pointer son propre nom vers `127.0.0.1`. Le navigateur envoie alors les requêtes de ce site web à votre serveur local, mais sous le nom du site web dans `Host`, et le serveur les refuse.

Ce dont chaque route a besoin :

| Route                                                    | A besoin de                              |
| -------------------------------------------------------- | ---------------------------------------- |
| `GET /ping`, `/`, `/icon.png`, `/favicon.ico`, `/anim/…` | Seulement du bon `Host`                  |
| `GET /events` (le flux), `GET /window` (les limites)     | Seulement du bon `Host`                  |
| `POST /open`, `/dismiss`, `/bounds`                      | De la clé de la page, ou du jeton du mod |
| `GET /sessions`, `GET /tick`                             | Du jeton du mod                          |
| `POST /state`, `/event`, `/window`, `/quit`              | Du jeton du mod                          |

Deux détails de plus : les liens sont vérifiés deux fois avant que quoi que ce soit ne les ouvre, par le serveur (`LINK`, `conversationLink`) puis par `watch.ps1`, et tous deux n’acceptent que `claude://code/continue?session=local_…&source=desktop_action`. Et les corps de requête de plus d’un million de caractères sont coupés (`readBody`).

### Le modèle de menace en termes simples

De qui le serveur vous protège-t-il ?

- **D’un site web que vous visitez.** Votre navigateur enverra des requêtes vers `127.0.0.1` depuis n’importe quelle page. Mais la page ne peut pas lire les réponses d’une autre origine (le serveur n’envoie aucun en-tête qui le permette), donc elle ne peut lire ni le flux ni la clé. Elle ne connaît ni la clé ni le jeton, donc chaque action et chaque écriture la refusent. Et un nom redirigé par rebinding échoue à la vérification de `Host`.
- **D’un autre ordinateur du réseau.** Il ne peut pas se connecter, parce que le serveur n’écoute que sur `127.0.0.1`.
- **Des programmes de votre propre ordinateur.** Ceux-là ne sont pas tenus à l’écart. N’importe quel programme local peut lire `/events`, et il peut lire la clé de la page en chargeant `/`, exactement comme le fait la fenêtre. Le jeton protège d’eux les routes du mod, mais un programme qui tourne déjà sous votre compte peut lire bien plus que ce que contient ce serveur. La conception vous protège du web et du réseau, pas des logiciels que vous exécutez déjà.

### Pourquoi il ne doit jamais être exposé au réseau

L’adresse de bouclage est la protection sur laquelle reposent les trois autres. La clé de la page et la vérification de `Host` fonctionnent parce que seules les règles d’un navigateur se tiennent entre un inconnu et le serveur, et qu’un navigateur suit ces règles. Un programme sur un autre ordinateur ne les suit pas :

- Il pourrait écrire n’importe quel en-tête `Host`, si bien que la vérification de `Host` ne l’arrêterait pas.
- Il pourrait charger `/` et lire la clé de la page dans la page, puis utiliser les actions de la page : ouvrir des conversations sur votre bureau et effacer vos alertes.
- Il pourrait lire `/events` librement. Ce flux contient le titre, la phrase, les tâches, les sous-agents, le contexte, le conseil et les étapes suivantes de chaque conversation, ainsi que les textes des alertes, qui comprennent un résumé de la dernière réponse de Claude.

Les noms des dossiers du projet, les listes de tâches et des morceaux des réponses de Claude sont exactement ce que vous ne voudriez pas voir lu par la personne qui partage le Wi-Fi de votre café. Le jeton protégerait toujours `/state` et `/sessions`, mais le flux à lui seul livre l’essentiel du même contenu. La règle est donc simple : le hub écoute sur `127.0.0.1` et nulle part ailleurs.

## Comment on l’a demandé à l’IA

La demande d’origine de la fenêtre flottante n’a pas été consignée. Elle arrive dans le commit `6f8f938` (2026-10-30) « feat(overlay): add floating window, Spanish voice and Windows toasts » (ajouter la fenêtre flottante, la voix en espagnol et les notifications toast de Windows), en même temps que la voix et les notifications du guide suivant, avant l’existence de tout journal de tâches public.

### Demandes ultérieures, consignées dans les journaux de tâches

La fenêtre a été remaniée par la vue de toutes les conversations, dont le journal est `odd/tasks/fleet-view.md` dans narsil-pet. L1 (2026-11-06) commence par :

> "quiero hacerlo en los dos y tambien en la ventana externa, el diseno lo pensamos luego"

Traduction en français : l’auteur ou l’autrice veut cela aux deux endroits, et aussi dans la fenêtre externe, la conception étant laissée pour plus tard. Le guide précédent cite cette entrée en entier.

L2 (extrait) demande la liste :

> "deberiamos ver en la ventana principal tanto en la banda como la ventana externa el estado de todas las conversaciones, con scroll si son muchas"

Traduction en français : la bande comme la fenêtre externe devraient afficher l’état de chaque conversation, avec un défilement quand il y en a beaucoup. C’est pourquoi la fenêtre défile alors que la bande pagine. L6 consigne le changement du serveur qui a suivi : il démarre désormais avec chaque conversation, qu’il y ait une fenêtre ou non, « Closing the window no longer quits the server; an event reopens a wanted window after 60 s. » (fermer la fenêtre n’arrête plus le serveur ; un événement rouvre une fenêtre souhaitée après 60 s). L8 consigne la nouvelle mise en page de la page, vérifiée dans le navigateur en 330×450 avec quatre conversations fictives, et note : « No automated test covers the page's own script. » (aucun test automatisé ne couvre le script propre à la page).

Les boucles nettes viennent de `odd/tasks/animated-poses.md`, L6 (2026-11-15) :

> "en ventana externa podemos poner el video sin recortar? para que se vea mas nitido?"

Traduction en français : peut-on afficher la vidéo sans la recadrer dans la fenêtre externe, pour qu’elle soit plus nette ? Le journal consigne l’approbation, « Sí, hazla » (« Oui, fais-la »), et sa spécification S7 dit que la fenêtre n’a pas de limite de taille, si bien que le serveur local sert une copie plus nette de chaque boucle. C’est la route `/anim/`.

### Reconstitution à partir de l’historique des commits

Le reste, à partir de `git log -- overlay/server.cjs overlay/overlay.html overlay/watch.ps1 overlay/mac-claude.js overlay/start.sh` :

- `6f8f938` (2026-10-30) « feat(overlay): add floating window, Spanish voice and Windows toasts » (ajouter la fenêtre flottante, la voix en espagnol et les notifications toast de Windows). Le serveur, déjà sur `127.0.0.1` et avec le jeton du mod sur ses routes d’écriture, la page, `watch.ps1` et `kill.ps1`.
- `a2b5970` (2026-10-30) « fix(overlay): start the window again for an event instead of a notification » (redémarrer la fenêtre pour un événement plutôt que pour une notification).
- `c8bf365` (2026-10-30) « feat(mac): open the floating window on macOS in a Chromium browser » (ouvrir la fenêtre flottante sous macOS dans un navigateur Chromium).
- `9bb60c8` (2026-10-30) « fix(overlay): show the floating window on the screen Claude is on » (afficher la fenêtre flottante sur l’écran où se trouve Claude).
- `42f7efd` (2026-10-31) « fix: let only the floating window's own page and the mod drive its server » (ne laisser que la page propre à la fenêtre flottante et le mod piloter son serveur). Ce commit a ajouté la clé de la page et la vérification de `Host`. Avant lui, les actions de la page ne demandaient aucune clé et il n’y avait aucune vérification de `Host`, si bien qu’une page de n’importe quel site web que vous visitiez pouvait leur envoyer une simple requête et, par exemple, effacer vos alertes. Il a aussi ajouté les vérifications de sécurité dans `tests/overlay-server.check.cjs`.
- `3031ef2` (2026-11-01) « fix(overlay): on macOS show the window when Claude is minimized, not when another app is in front, and open only one » (sous macOS, afficher la fenêtre quand Claude est réduit, pas quand une autre application est devant, et n’en ouvrir qu’une).
- `aa54891` et `b87bd67` (2026-11-06) : le serveur devient le hub de chaque conversation, et la fenêtre les liste toutes.
- `42aab0c` (2026-11-07) « fix: open the floating window once when Edge hands it to a running instance » (n’ouvrir la fenêtre flottante qu’une fois quand Edge la confie à une instance déjà lancée).
- `e19331b` (2026-11-15) « feat: show sharper animated loops in the floating window » (afficher des boucles animées plus nettes dans la fenêtre flottante).
- `f2cc0f6` (2026-11-16) « fix: answer 400 to a request path that makes no URL instead of crashing the overlay server » (répondre 400 à un chemin de requête dont on ne peut faire aucune URL au lieu de faire planter le serveur de la fenêtre). Son message explique qu’une ligne de requête brute comme `GET // HTTP/1.1` faisait lever une exception à `new URL()` dans le gestionnaire asynchrone, ce qui terminait le processus. Une seule requête bizarre pouvait arrêter le hub pour toutes les conversations.

Le schéma : la fenêtre d’abord, puis son comportement sur chaque système, puis sa sécurité, et un correctif tardif trouvé en envoyant au serveur une requête qu’aucun navigateur n’enverrait.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Mon mod Claude Code `my-pet` affiche l’état de Claude dans la bande. Ajoute une fenêtre flottante pour quand Claude est réduit. Écris un serveur Node.js, `overlay/hub.cjs`, qui n’écoute que sur 127.0.0.1, refuse tout en-tête `Host` autre que `127.0.0.1:<port>` et `localhost:<port>`, sert une seule page HTML dans laquelle est écrite une clé aléatoire, diffuse l’état à cette page par des événements envoyés par le serveur sur `/events`, et n’accepte `POST /state` qu’avec un jeton que le mod crée avec `crypto.randomUUID()`, conserve dans `$.store` et transmet dans une variable d’environnement quand il démarre le serveur de manière détachée avec `$.process.run`. Les actions propres à la page doivent porter sa clé. N’écoute jamais sur aucune autre adresse. Ajoute un test Node qui vérifie qu’un mauvais `Host`, un jeton absent et une clé absente sont chacun refusés avec 403, et qu’une ligne de requête comme `GET // HTTP/1.1` ne fait pas planter le serveur.

## Le code minimal

Un hub réduit, écrit pour ce guide et adapté de `overlay/server.cjs` et de `hooks/register.tsx` dans [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). Le serveur est du simple Node.js, pas du code de mod. L’affichage et le masquage de la fenêtre sont laissés de côté : cette partie dépend du système, comme le montrent les gardiens ci-dessus.

Le serveur, `overlay/hub.cjs` :

```js
'use strict'
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const path = require('path')

const port = Number(process.env.PET_PORT || 47190)
const token = process.env.PET_TOKEN || ''
const PAGE_KEY = crypto.randomBytes(16).toString('hex')
const PAGE = fs
  .readFileSync(path.join(__dirname, 'page.html'), 'utf8')
  .replace('__PAGE_KEY__', PAGE_KEY)
const HOSTS = new Set([`127.0.0.1:${port}`, `localhost:${port}`])

let state = null
const listeners = new Set()

const server = http.createServer((req, res) => {
  const send = (status, type, body) => {
    res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
    res.end(body)
  }
  let url
  try {
    url = new URL(req.url, `http://127.0.0.1:${port}`)
  } catch {
    return send(400, 'text/plain', 'bad request')
  }
  if (!HOSTS.has(String(req.headers.host || '').toLowerCase()))
    return send(403, 'text/plain', 'forbidden')
  const isMod = token !== '' && req.headers['x-pet-token'] === token
  const isPage = isMod || req.headers['x-pet-page'] === PAGE_KEY

  if (req.method === 'GET' && url.pathname === '/') return send(200, 'text/html', PAGE)
  if (req.method === 'GET' && url.pathname === '/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' })
    res.write(`data: ${JSON.stringify(state)}\n\n`)
    listeners.add(res)
    req.on('close', () => listeners.delete(res))
    return
  }
  if (req.method === 'POST' && url.pathname === '/dismiss') {
    if (!isPage) return send(403, 'text/plain', 'forbidden')
    return send(204, 'text/plain', '')
  }
  if (req.method === 'POST' && url.pathname === '/state') {
    if (!isMod) return send(403, 'text/plain', 'forbidden')
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 100_000) req.destroy()
    })
    req.on('end', () => {
      try {
        state = JSON.parse(body)
      } catch {
        return send(400, 'text/plain', 'bad json')
      }
      for (const l of listeners) l.write(`data: ${JSON.stringify(state)}\n\n`)
      send(204, 'text/plain', '')
    })
    return
  }
  send(404, 'text/plain', 'not found')
})

server.on('error', () => process.exit(0))
server.listen(port, '127.0.0.1')
```

La page lit sa clé dans `<meta name="pet-key" content="__PAGE_KEY__">`, écoute avec `new EventSource('/events')`, écrit le texte avec `textContent` et envoie ses actions avec `fetch('/dismiss', { method: 'POST', headers: { 'x-pet-page': key } })`.

Le côté du mod, dans `hooks/register.tsx`, vérifié par rapport aux types 2.1.325 (`$.store`, `$.process.run`, `$.http.fetch`, `$.plugin.root`, `$.clock.every`). Il démarre le hub sous macOS ou Linux de la même manière que le `launch` de Narsil ; sous Windows, Narsil utilise plutôt `Start-Process` de PowerShell.

```tsx
import { read } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const HUB = 'http://127.0.0.1:47190'

async function hubToken($: EngineInterface): Promise<string> {
  const saved = await $.store.get('hubToken').catch(() => undefined)
  if (typeof saved === 'string' && saved) return saved
  const token = crypto.randomUUID()
  await $.store.set('hubToken', token)
  return token
}

async function startHub($: EngineInterface): Promise<void> {
  const up = await $.http.fetch(`${HUB}/`).then(
    (r) => r.ok,
    () => false,
  )
  if (up) return
  await $.process.run(['/bin/sh', '-c', 'nohup node "$PET_HUB" </dev/null >/dev/null 2>&1 &'], {
    env: { PET_HUB: `${$.plugin.root}/overlay/hub.cjs`, PET_TOKEN: await hubToken($) },
  })
}

async function push($: EngineInterface): Promise<void> {
  await $.http
    .fetch(`${HUB}/state`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-pet-token': await hubToken($) },
      body: JSON.stringify(await read($, pet)),
    })
    .catch(() => undefined)
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await startHub($)
    $.clock.every(2000, () => void push($))
    return next(e)
  })
}
```

`pet` est l’atome d’état du premier guide. La commande shell est une chaîne fixe ; le chemin du script voyage dans l’environnement, jamais dans la commande, et c’est ainsi que Narsil garde le texte hors de ce qu’un shell interpréterait.

## Erreurs fréquentes et comment tester

- **Écouter sur toutes les adresses.** `server.listen(port)` sans hôte écoute sur toutes les adresses de l’ordinateur, réseau compris. Transmettez toujours `'127.0.0.1'`.
- **Mettre le jeton du mod dans la page.** Tout ce que contient une page peut être lu par quiconque la charge. Donnez à la page sa propre clé, nouvelle à chaque exécution, et gardez le jeton pour le mod.
- **Se fier à `Host` comme seule protection.** Cette vérification empêche de tromper un navigateur par DNS rebinding. Elle n’arrête pas un programme qui écrit ses propres en-têtes, et c’est pourquoi l’adresse de bouclage compte.
- **Un gestionnaire asynchrone qui lève une exception.** Dans Node, une exception à l’intérieur d’un gestionnaire de requête `async` devient un rejet non géré qui peut terminer le processus. Entourez l’analyse qui peut lever une exception, comme l’a fait `f2cc0f6` avec `new URL()`.
- **Transmettre du texte dans une ligne de commande.** Les scripts de Narsil prennent leur texte dans l’environnement (`NARSIL_TEXT`, `NARSIL_TOKEN`), si bien qu’un titre écrit par Claude ne peut jamais être lu comme une partie d’une commande.
- **Voler le focus.** Une fenêtre qui saute au premier plan interrompt la saisie. Sous Windows, `watch.ps1` transmet « do not activate » (ne pas activer) à `SetWindowPos`.
- **Attendre un processus qui ne se termine jamais.** `$.process.run` lit toute la sortie ; un serveur démarré sans être détaché bloque l’appel jusqu’à son délai d’expiration. Démarrez-le avec `nohup … &` ou `Start-Process`.

Pour tester, narsil-pet exécute `node tests/overlay-server.check.cjs`. Ses vérifications comprennent « the page is served with its key, and the key is not a placeholder » (la page est servie avec sa clé, et la clé n’est pas un espace réservé), « another host name (a page rebound to this address) is refused everywhere » (un autre nom d’hôte, une page redirigée vers cette adresse par rebinding, est refusé partout), « the page's actions need its key » (les actions de la page nécessitent sa clé), « the mod's state needs its token, as before » (l’état du mod nécessite son jeton, comme avant) et « a request path no URL can be made of is refused, and the server keeps answering » (un chemin de requête dont on ne peut faire aucune URL est refusé, et le serveur continue de répondre). Le côté du mod est couvert dans `tests/narsil.test.tsx` par « each state change is pushed to the floating window with its token and session » (chaque changement d’état est envoyé à la fenêtre flottante avec son jeton et sa session), « an older window server left running is closed and replaced by this version » (un ancien serveur de fenêtre resté en marche est fermé et remplacé par cette version) et « with the window off, the conversation still reaches the hub: started with no window, and pushed to » (avec la fenêtre désactivée, la conversation atteint quand même le hub : démarré sans fenêtre, et alimenté). Le journal de tâches note qu’aucun test automatisé ne couvre le script propre à la page ni l’ouverture d’une vraie fenêtre de navigateur.

## Pour aller plus loin

- `openWindow`, `checkWindowGone` et `isProfileRunning` dans `overlay/server.cjs` gèrent le cas où Edge confie un lancement à une instance déjà en cours, ce qui ouvrirait sinon une seconde fenêtre (`42aab0c`).
- `kill.ps1` et `running.ps1` trouvent les processus du navigateur grâce à son dossier de profil, si bien que le serveur ne ferme que sa propre fenêtre.
- `HEARTBEAT_TIMEOUT_MS` (30 secondes) arrête le serveur quand aucune conversation ne bat ; `ensureOverlay` dans `hooks/register.tsx` le redémarre au plus une fois par minute.
- La fenêtre des conseils (`overlay/tip.ps1`, `overlay/tip.sh`, `overlay/tip.js`) s’ouvre au-dessus de la fenêtre flottante à l’aide des limites que signale la page.
- Le tableau « Sistemas compatibles » (systèmes compatibles) du README résume ce que reçoit chaque système.
