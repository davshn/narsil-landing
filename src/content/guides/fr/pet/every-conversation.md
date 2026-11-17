---
title: Toutes les conversations au même endroit
description: 'Comment Narsil rassemble l’état de chaque conversation ouverte dans un hub local, les classe en commençant par l’erreur, les pagine par quatre et oublie les silencieuses au bout d’une heure.'
route: pet
order: 3
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/fleet.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: overlay/server.cjs
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
  - repo: pet
    path: tests/overlay-server.check.cjs
---

## Ce que ça fait

Si vous gardez plusieurs conversations Claude Code ouvertes, chacune a sa propre bande. Narsil fait en sorte que chaque bande les affiche toutes.

Il n’y a qu’une Narsil pour toutes vos conversations. Son dessin et sa phrase montrent la plus importante, dans cet ordre : d’abord une `ERROR`, puis ce qui est en `TE NECESITA` (a besoin de vous), puis ce qui est en `TRABAJANDO` (au travail), et enfin ce qui est `TERMINADA` (terminé). Quand cette conversation n’est pas celle que vous regardez, la phrase commence par son nom, par exemple « web: Me he detenido por un error » (« web : je me suis arrêtée sur une erreur »). Une conversation bloquée sur une question dans une autre fenêtre apparaît donc dans celle où vous êtes en train d’écrire.

Sous elle, la bande liste chaque conversation, une ligne par conversation : son état, son nom et sa propre barre de contexte avec un pourcentage. La conversation en cours est toujours la première, et sa barre est bleue pour que vous la trouviez. Les lignes s’affichent par quatre, avec des boutons ◂ et ▸ pour tourner la page (« Conversaciones 1/2 »).

Appuyer sur le nom d’une conversation l’ouvre sous une ligne : ses tâches, ses sous-agents et, à partir de son pourcentage, ce qui remplit son contexte. Le guide suivant traite des tâches et des sous-agents.

Une conversation que vous n’avez pas ouverte depuis un moment reste dans la liste avec son dernier état pendant une heure, même si l’application de bureau l’a mise en veille. Au bout d’une heure sans nouvelles, elle quitte la liste, et c’est aussi ainsi que disparaissent les conversations supprimées. Si vous la rouvrez, elle revient aussitôt.

## Comment ça marche à l’intérieur

### Le problème : chaque conversation est seule

Un mod s’exécute une fois par conversation. Narsil dans une conversation ne peut pas voir les atomes de Narsil dans une autre. Pour afficher toutes les conversations, quelque chose d’extérieur doit recueillir les états et renvoyer la liste.

Narsil disposait déjà d’un tel élément : le petit serveur local derrière sa fenêtre flottante. Le README dit que chaque conversation envoie son état à « un pequeño servidor local (el de la ventana flotante) » (un petit serveur local, celui de la fenêtre flottante), qui démarre avec la première conversation même lorsque la fenêtre est désactivée. Ce serveur est le hub.

### Le hub : un script Node

`overlay/server.cjs` est un simple script Node.js, pas du code de mod. Il utilise le module `http` de Node, conserve une entrée par conversation dans une `Map` appelée `sessions`, et appelle `server.listen(port, '127.0.0.1', ...)`, si bien qu’il n’écoute que sur l’adresse de bouclage locale. Le port est `47190`, sauf si `NARSIL_PORT` en indique un autre.

Il répond notamment à :

- **`POST /state`** : une conversation signale son état. L’entrée est enregistrée avec l’heure de son arrivée (`at`) et l’heure du dernier changement de quoi que ce soit d’affiché (`changedAt`). Les battements qui ne changent rien ne sont pas transmis à la page de la fenêtre flottante.
- **`GET /sessions`** : la liste de toutes les conversations actives, la plus importante en premier, sans les dessins (chaque mod dessine sa propre Narsil).

Les deux nécessitent le jeton du mod dans l’en-tête `x-narsil-token`. Le jeton est un UUID aléatoire que le mod conserve dans `$.store` (`overlayToken` dans `hooks/register.tsx`) et transmet au serveur dans la variable d’environnement `NARSIL_TOKEN` lorsqu’il le démarre. Le serveur vérifie aussi l’en-tête `Host` et refuse tout nom autre que `127.0.0.1` et `localhost`. Le guide sur la fenêtre flottante traite ces protections en détail.

Deux minuteurs gardent la liste fiable :

- `SESSION_FORGET_MS = 60 * 60_000` : `forgetSilent` retire une conversation une heure après son dernier battement.
- `HEARTBEAT_TIMEOUT_MS = 30_000` : quand aucune conversation n’a battu depuis 30 secondes, le serveur s’arrête de lui-même. La conversation suivante le redémarre.

### Le côté du mod : un battement

Dans `session.start`, Narsil démarre le hub peu après le début de la session (`$.clock.after(10, () => startOverlay($))`), puis bat toutes les deux secondes (`$.clock.every(2000, () => beat($))`). `startOverlay` envoie d’abord un ping au serveur ; si un serveur d’une version plus ancienne répond (il dit autre chose que `narsil 4`), elle l’arrête et en démarre un nouveau. Sous Windows, elle lance `node` avec `overlay/server.cjs` au moyen de `Start-Process` de PowerShell ; sous macOS, elle exécute `overlay/start.sh`.

Chaque `beat` effectue, parmi d’autres tâches d’entretien :

1. `pushOverlay` : `POST /state` avec l’état de cette conversation, construit par `shownState` (identifiant, titre, humeur, état, phrase, contexte, tâches, pastilles de sous-agents et plus encore). Le dessin n’est joint que lorsqu’il a changé ; un serveur qui n’en a aucun répond `need-svg`.
2. `readSessions` : `GET /sessions`, nettoyé champ par champ et écrit dans l’atome `sessions` uniquement lorsqu’il diffère de ce qui s’y trouve déjà.

Chaque changement d’humeur appelle aussi immédiatement `pushOverlay`, par l’intermédiaire de `setMood`, afin que le hub n’attende pas le battement suivant.

L’identifiant de la conversation provient de la variable d’environnement `CLAUDE_CODE_HOST_SESSION_ID`, lue dans `session.start`. `ownId` ne l’accepte que s’il ressemble à `local_` suivi de lettres, de chiffres et de tirets, et utilise sinon `local_unknown`. Le lien `claude://code/continue` de l’application de bureau ouvre une conversation par cet identifiant, et c’est ainsi que fonctionne le bouton « ouvrir » de la fenêtre flottante.

### Le classement : `hooks/fleet.ts`

La logique de la liste se trouve dans un fichier séparé de fonctions pures, `hooks/fleet.ts`, sans événements et sans `$`. Cela la rend facile à tester et à partager entre la bande et la fenêtre.

- `RANK` donne à chaque état sa place : `error` 0, `waiting` 1, `working` 2, `done` 3, `idle` 4. Le serveur utilise le même ordre (`PRIORITY` dans `overlay/server.cjs`).
- `fleetOf(hub, own)` prend la liste du hub, remplace l’entrée de cette conversation par une entrée fraîche (la copie du hub peut avoir jusqu’à un battement de retard), et trie par rang, puis par changement le plus récent. La première entrée est celle que Narsil arbore.
- `ownFirst(list, ownId)` place cette conversation en tête des lignes, quel que soit son état, afin que vous la trouviez toujours au même endroit.
- `pageOf(list, page)` découpe la liste en pages de `FLEET_PAGE = 4` et maintient le numéro de page dans les limites quand des conversations arrivent ou partent.
- `fit(text, cells)` coupe ou complète un titre à `TITLE_CELLS` (26) caractères, afin que chaque barre de contexte commence dans la même colonne.
- `openOf` et `toggleOpen` décident de la conversation ouverte. `open: null` signifie « celle-ci, par défaut » ; une chaîne vide signifie « aucune ».

Ce que la bande affiche ouvert, la page sur laquelle elle se trouve et l’affichage ou non de la répartition du contexte se trouvent dans un autre atome, `view` (`fleetView` dans `hooks/register.tsx`), si bien qu’un appui sur ◂ ou sur un nom n’est qu’un `update` de cet atome.

### Pourquoi chaque décision a été prise

- **L’erreur avant « a besoin de vous », avant « au travail », avant « terminé ».** La demande de l’auteur ou de l’autrice les classe ainsi (voir plus bas) : le dessin est d’abord un avertissement, donc ce qui a échoué ou vous attend passe avant ce qui est simplement occupé.
- **Sa propre conversation en premier dans les lignes, mais pas dans le dessin.** Le dessin répond à « où ai-je besoin d’intervenir ? » ; les lignes répondent à « où est celle-ci ? ». Garder les deux permet à la phrase de passer à une autre conversation pendant que la liste reste stable.
- **Des pages plutôt qu’un défilement.** La spécification S3 du journal de tâches dit « The band cannot scroll (Box overflow is only visible/hidden): it pages instead. » (la bande ne peut pas défiler, le dépassement d’une Box n’étant que visible ou masqué : elle pagine à la place). Les types 2.1.325 décrivent désormais la bande `AbovePrompt` faisant défiler un arbre plus haut que son `maxRows` ; Narsil pagine toujours, et la fenêtre flottante, qui est une page web, défile.
- **Une heure, ni 30 secondes ni pour toujours.** L’historique des commits montre que l’expiration a été ajustée deux fois. `2ce3acb` (2026-11-07) « fix: keep sleeping conversations listed in the hub » (garder les conversations en veille dans la liste du hub) explique que l’application de bureau met en veille le moteur d’une conversation que vous n’avez pas ouverte depuis un moment, si bien que ses battements s’arrêtent et que le hub la retirait au bout de 30 secondes. Le correctif conservait chaque conversation aussi longtemps que le serveur tournait. Puis `570961d` (2026-11-10) « fix: forget conversations silent for an hour in the hub » (oublier dans le hub les conversations silencieuses depuis une heure) indique que les conversations supprimées s’accumulaient, et retient une heure : assez longtemps pour une conversation en veille, assez court pour qu’une conversation supprimée disparaisse.
- **La copie de vous-même dans le hub est remplacée.** `fleetOf` et `ownEntry` utilisent l’état frais de cette conversation, en ne conservant le `changedAt` du hub que tant que l’état reste le même, afin que votre propre ligne n’ait jamais un battement de retard.

## Comment on l’a demandé à l’IA

Cette fonctionnalité a un journal de tâches public : `odd/tasks/fleet-view.md` dans narsil-pet, entrées L1 à L13. Il cite mot pour mot les demandes de l’auteur ou de l’autrice.

La demande d’origine, L1, datée du 2026-11-06 :

> "quiero hacerlo en los dos y tambien en la ventana externa, el diseno lo pensamos luego, quisiera poder mostrar todas las sesiones en curso y sus estados, la imagen de narsil solo mostraria lo mas importante error->te necesita-> trabajando--> termine, y las notificaciones se enviarian al celular cuando se pida algo desde el celular como ahora y haya cambios, es decir alguna tarea pase de trabajando a terminado, o de trabajando a error, etc, (eliminariamos la alerta de bucle, no la he sentido tan util) las notificaciones del celular cuando se envien llevarian la info de todas las sesiones funcionando en ese momento, algo asi es mi idea, como lo hacemos? los consejos seguirian funcionando como ahora en cada ventana"

Traduction en français : l’auteur ou l’autrice veut cela aux deux endroits (la bande et le bureau) et aussi dans la fenêtre flottante externe, la conception étant laissée pour plus tard. Il s’agit d’afficher chaque session en cours et son état ; l’image de Narsil ne montrerait que la plus importante, dans l’ordre erreur, a besoin de vous, au travail, terminé. Les notifications sur le téléphone partiraient, comme maintenant, lorsqu’une demande viendrait du téléphone et que quelque chose changerait (une conversation passant de « au travail » à « terminé », ou de « au travail » à « erreur ») ; l’alerte de boucle serait supprimée, parce qu’elle n’avait pas semblé si utile ; et chaque notification sur le téléphone porterait toutes les sessions en cours à ce moment-là. La demande se termine en demandant comment s’y prendre, et précise que les conseils devraient continuer à fonctionner comme avant dans chaque fenêtre.

Les corrections qui ont suivi, et ce qu’elles ont changé :

- **L2** (extrait) : « deberiamos ver en la ventana principal tanto en la banda como la ventana externa el estado de todas las conversaciones, con scroll si son muchas, [...] donde ponemos las barras de cada conversacion con su porcentaje de avance y con sus estados? al hacer click en el titulo de conversacion deberiamos poder ver sus sub agentes/ tareas y sus respectivos estados ». Traduction en français : la bande comme la fenêtre externe devraient afficher l’état de chaque conversation, avec un défilement quand il y en a beaucoup ; l’auteur ou l’autrice demande où placer la barre de chaque conversation ; et cliquer sur le titre d’une conversation devrait montrer ses sous-agents et ses tâches avec leurs états. La même entrée supprime la section finale « conversations ouvertes » et la section sur l’argent, et conserve le cache. Cela a produit les lignes, les titres cliquables et le détail de la conversation ouverte ; comme la bande ne pouvait pas défiler, le défilement est devenu une pagination.
- **L3** : « entonces otro cambio, me parece bien lo que me dices del contexto, entonces la barra de contexto general tambien se iria por que no existe un contexto general y se reemplazaria por las barras de contexto de cada conversacion, el avance entonces no existe cuando entre a una de esas conversaciones estaria de nuevo su contexto, sus tareas con su estado (no es necesario barra de avance) y sus sub agentes, al clickear aca su contexto veria como se lleno su propio contexto y ya ». Traduction en français : l’auteur ou l’autrice est d’accord avec la remarque sur le contexte, donc la barre de contexte générale disparaît, puisqu’il n’existe pas de contexte général ; chaque conversation a sa propre barre à la place. Ouvrir une conversation montre son contexte, ses tâches avec leurs états (pas besoin de barre de progression) et ses sous-agents, et cliquer sur son contexte montre comment ce contexte s’est rempli. Cela a supprimé la barre de contexte générale et placé une barre dans chaque ligne.
- **L4** consigne la conception convenue : Narsil et la phrase de la conversation qui compte en haut, les limites du compte une seule fois, la liste des conversations, une ligne qui s’ouvre sur son contexte, ses tâches et ses sous-agents, et « The band pages 4 rows at a time. » (la bande pagine 4 lignes à la fois).
- **L6 à L11** consignent chaque tâche comme terminée, avec sa preuve. L6 décrit le hub : le serveur démarre désormais avec chaque conversation, qu’il y ait une fenêtre ou non, et `GET /sessions` (jeton uniquement) liste toutes les conversations actives, « error first, then waiting, working, done, idle » (l’erreur d’abord, puis l’attente, le travail, terminé, l’arrêt).
- **L12** et **L13** signalent et corrigent un bogue des états de tâches, traité dans le guide suivant.

L’expiration d’une heure ne faisait pas partie du journal ; elle est venue après, dans les deux commits décrits plus haut.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Mon mod Claude Code `my-pet` affiche l’état d’une conversation dans la bande `AbovePrompt`. Fais-lui afficher toutes les conversations ouvertes. Écris un petit hub Node.js (`hub.cjs`) qui n’écoute que sur 127.0.0.1, accepte `POST /state` et sert `GET /sessions`, tous deux protégés par un jeton aléatoire que le mod conserve dans `$.store`, et oublie une conversation une heure après son dernier signalement. Dans le mod, signale l’état de cette conversation toutes les deux secondes avec `$.clock.every` et `$.http.fetch`, relis la liste dans un atome, et garde le classement et la pagination sous forme de fonctions pures dans `hooks/fleet.ts` : l’erreur, puis l’attente, puis le travail, puis terminé, puis l’arrêt, le changement le plus récent en premier, quatre lignes par page. Dessine l’état de la conversation la plus importante en haut et les lignes en dessous, cette conversation en premier. Ajoute des tests pour le classement, la pagination et l’expiration.

## Le code minimal

Écrit pour ce guide. Le classement et la pagination sont adaptés de `hooks/fleet.ts`, et l’expiration et l’ordre du hub de `overlay/server.cjs`, tous deux dans [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later).

La partie pure, `hooks/fleet.ts` :

```ts
import type { Entry, Status } from '../types' // Entry: { sessionId: string; status: Status; headline: string; changedAt: number }

export const PAGE = 4
const RANK: Record<Status, number> = { error: 0, waiting: 1, working: 2, done: 3, idle: 4 }

export function ranked(hub: readonly Entry[], own: Entry): Entry[] {
  return [own, ...hub.filter((s) => s.sessionId !== own.sessionId)].sort(
    (a, b) => RANK[a.status] - RANK[b.status] || b.changedAt - a.changedAt,
  )
}

export function pageOf(list: readonly Entry[], page: number) {
  const pages = Math.max(1, Math.ceil(list.length / PAGE))
  const at = Math.min(Math.max(0, page), pages - 1)
  return { rows: list.slice(at * PAGE, (at + 1) * PAGE), page: at, pages }
}
```

Le battement du mod, dans `hooks/register.tsx` (l’atome `fleet` contient la liste du hub et est déclaré dans `types/index.d.ts` ; `ownEntry` construit l’entrée de cette conversation à partir de votre atome d’état) :

```ts
const HUB = 'http://127.0.0.1:47191'

async function token($: EngineInterface): Promise<string> {
  const saved = await $.store.get('hubToken')
  if (typeof saved === 'string' && saved) return saved
  const fresh = crypto.randomUUID()
  await $.store.set('hubToken', fresh)
  return fresh
}

async function beat($: EngineInterface): Promise<void> {
  const headers = { 'content-type': 'application/json', 'x-my-pet-token': await token($) }
  try {
    await $.http.fetch(`${HUB}/state`, {
      method: 'POST',
      headers,
      body: JSON.stringify(await ownEntry($)),
    })
    const { ok, text } = await $.http.fetch(`${HUB}/sessions`, { headers })
    if (ok) await update($, fleet, () => JSON.parse(text))
  } catch {
    // the hub is out of reach: keep the last list
  }
}

// in register:
on('session.start', async ($, e, next) => {
  $.clock.every(2000, () => beat($))
  return next(e)
})
```

Pour l’identifiant dans `ownEntry`, `$.session.id()` renvoie l’identifiant de la session (le nom du fichier de transcription). Narsil utilise plutôt `CLAUDE_CODE_HOST_SESSION_ID`, parce qu’elle a besoin de l’identifiant `local_` de l’application de bureau pour ouvrir la conversation depuis un lien.

Le hub, `overlay/hub.cjs`, est du simple Node.js, pas de l’API de mod. Le mod le démarre avec `$.process.run`, en transmettant le jeton sous le nom `MY_PET_TOKEN` dans `env` ; la fonction `startOverlay` de Narsil montre comment le lancer de manière détachée sous Windows et macOS.

```js
'use strict'
const http = require('http')
const token = process.env.MY_PET_TOKEN || ''
const RANK = { error: 0, waiting: 1, working: 2, done: 3, idle: 4 }
const FORGET_MS = 60 * 60_000
const sessions = new Map()

http
  .createServer((req, res) => {
    if (!token || req.headers['x-my-pet-token'] !== token) return res.writeHead(403).end()
    if (req.method === 'GET' && req.url === '/sessions') {
      const now = Date.now()
      for (const [id, s] of sessions) if (now - s.at > FORGET_MS) sessions.delete(id)
      const list = [...sessions.values()].sort(
        (a, b) => (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9) || b.changedAt - a.changedAt,
      )
      return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(list))
    }
    if (req.method !== 'POST' || req.url !== '/state') return res.writeHead(404).end()
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 100_000) req.destroy()
    })
    req.on('end', () => {
      try {
        const s = JSON.parse(body)
        const before = sessions.get(String(s.sessionId))
        const changedAt = before && before.status === s.status ? before.changedAt : Date.now()
        sessions.set(String(s.sessionId), { ...s, at: Date.now(), changedAt })
        res.writeHead(204).end()
      } catch {
        res.writeHead(400).end()
      }
    })
  })
  .listen(47191, '127.0.0.1')
```

Cette ébauche laisse de côté ce qu’ajoute le vrai serveur : la vérification de `Host`, l’arrêt quand toutes les conversations sont silencieuses, et la fenêtre flottante. N’élargissez pas `'127.0.0.1'` à toutes les interfaces ; le guide ultérieur sur la fenêtre flottante explique pourquoi chaque protection est là.

## Erreurs fréquentes et comment tester

- **Retirer les conversations en veille.** L’application de bureau arrête le moteur d’une conversation que vous n’avez pas ouverte depuis un moment, si bien que ses battements s’arrêtent alors qu’elle existe toujours. Un délai court vide votre liste (`2ce3acb`).
- **Ne jamais oublier.** Conserver chaque conversation aussi longtemps que le hub tourne remplit la liste de conversations supprimées (`570961d`). Faites expirer selon le temps écoulé depuis le dernier battement, et laissez le premier nouveau battement la remettre dans la liste.
- **Afficher votre propre conversation avec un battement de retard.** La copie du hub peut avoir jusqu’à un battement de retard. Fusionnez votre entrée fraîche avant le classement, comme le fait `fleetOf`.
- **Une page qui n’existe plus.** Quand des conversations partent, la page enregistrée peut pointer au-delà de la fin. Bornez-la, comme le fait `pageOf`.
- **Réécrire l’atome à chaque battement.** Chaque `update` redessine la bande. Narsil compare la nouvelle liste à l’ancienne et n’écrit qu’en cas de différence.
- **Lever une erreur quand le hub est arrêté.** Un `$.http.fetch` qui échoue ne doit pas casser le mod. Narsil l’intercepte, conserve la dernière liste et tente de redémarrer le hub au plus une fois par minute (`ensureOverlay`).
- **Un ancien hub qui répond à un nouveau mod.** Le serveur survit aux mises à jour du mod. Le `/ping` de Narsil répond par une chaîne de protocole (`narsil 4`), et le mod remplace un serveur qui en répond une autre.
- **Plusieurs terminaux sans identifiant d’hôte.** `ownId` se replie sur `local_unknown` quand `CLAUDE_CODE_HOST_SESSION_ID` est absent ou ne correspond pas, et le serveur fait de même, si bien que ces conversations partagent une seule entrée.

Pour tester le mod, `claude plugin test .` exécute `tests/narsil.test.tsx`, qui alimente un hub fictif au moyen d’un `$.http.fetch` simulé. Regardez « the band lists every open conversation with its state and context, and Narsil wears the most important » (la bande liste chaque conversation ouverte avec son état et son contexte, et Narsil arbore la plus importante) et « the band pages through many conversations, four at a time » (la bande pagine de nombreuses conversations, quatre à la fois), qui appuie sur le bouton `page-next` et vérifie « Conversaciones 2/2 ». Pour tester le serveur, `node tests/overlay-server.check.cjs` démarre le vrai script et vérifie notamment « every conversation is served to the mods alone, the most important first, without drawings » (chaque conversation est servie aux seuls mods, la plus importante en premier, sans dessins) et « a conversation that stops beating stays listed for an hour, then goes until it beats again » (une conversation qui cesse de battre reste dans la liste pendant une heure, puis disparaît jusqu’à ce qu’elle batte à nouveau), qui avance `Date.now` de 59 puis de 61 minutes.

## Pour aller plus loin

- `hooks/fleet.ts` contient aussi `countOfStates`, que `/narsil estado` utilise pour dire combien de conversations se trouvent dans chaque état.
- Le hook `ui.render` sur `AbovePrompt` dans `hooks/register.tsx` dessine les lignes : une colonne d’état à largeur fixe, le titre sous forme de `Button` qui appelle `toggleOpen`, `textBar` pour le contexte, le pourcentage sous forme de bouton pour la conversation ouverte, et l’horloge du cache. Tant que des étapes suivantes sont proposées, chaque ligne commence fermée pour que les étapes s’affichent ; ouvrir une ligne masque les étapes, et elles reviennent dès que toutes les lignes sont de nouveau fermées.
- `shownState` est l’entrée complète que signale chaque conversation ; `readSessions` montre comment valider champ par champ ce qui revient du hub.
- `overlay/server.cjs` diffuse aussi la liste à la fenêtre flottante par des événements envoyés par le serveur (`GET /events`), ouvre la fenêtre quand un événement vous attend, et sert sa page. Le guide sur la fenêtre flottante en traite.
- Les alertes sur le téléphone utilisent la même liste : `fleetNow` et `fleetText` terminent chaque alerte par toutes les conversations ouvertes et leur état.
