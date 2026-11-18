---
title: Le bloc du menu latéral
description: 'Le bloc sous Search dans le menu latéral de claude.ai : le niveau de Narsil et le décompte ntfy du jour, venus du mod via ntfy.sh, et les limites de 5 heures et hebdomadaire de claude.ai.'
route: claude
order: 3
updated: 2026-11-18
---

## Ce que ça fait

Ouvrez le menu latéral sur `claude.ai` et, juste sous **Search**, Narsil dans Claude ajoute un bloc avec trois types de données :

| Quoi                                                                    | D’où ça vient                       |
| ----------------------------------------------------------------------- | ----------------------------------- |
| **Narsil**, son niveau et son expérience, avec une barre                | Le mod narsil-pet, via ntfy.sh      |
| **`5 horas`** et **`Semana`** : les limites de 5 heures et hebdomadaire | `claude.ai` lui-même, chaque minute |
| **`ntfy hoy`** : les messages ntfy.sh du jour et leur réinitialisation  | Le mod narsil-pet, via ntfy.sh      |

Chaque limite affiche un pourcentage, une barre en vert, ambre ou rouge, et le moment où elle se réinitialise, comme `reinicia en 2 h 05 min` (« se réinitialise dans 2 h 05 min »). Le niveau se lit comme `Narsil ⭐ Nivel 4` avec `350/400 XP` à côté.

ntfy.sh ne sert qu’à ce que la page ne peut pas savoir. Le niveau et le décompte changent quand le mod envoie un état, c’est-à-dire quand vous écrivez à Claude Code par Remote Control. Quand le décompte a plus d’une heure, le bloc le signale.

> **Expérimental.** Le bloc trouve sa place par la structure du menu latéral de `claude.ai`, et lit les limites depuis une adresse interne de la page, pas depuis une API publique. Une mise à jour de Claude peut le casser ; quand cela arrive, le bloc cesse de s’afficher. Il ne fait que lire, et n’envoie jamais vos données nulle part.

## Comment ça marche à l’intérieur

Le bloc est dessiné par `extension/content.js`, comme la bande du [guide 2](/fr/mods/claude/conversation-band/). Les limites sont lues par le content script lui-même, depuis la page. Le niveau et le décompte sont lus par le script d’arrière-plan, `extension/background.js`, avec l’aide de `lib/stream.js` et `lib/seal.js`, puis gardés et mis en forme par `lib/state.js`.

### Trouver Search dans n’importe quelle langue

Le bloc n’est pas trouvé par le mot « Search », qui change avec la langue de la page. Il est trouvé par l’endroit où se trouve Search : sur un téléphone, le menu latéral est un panneau avec Search dans son en-tête ; sur un écran plus large, Search est le seul bouton direct du premier groupe du menu. Le bloc est inséré juste après.

La page monte le menu latéral tard, et le remonte parfois, donc le bloc est remis en place par le même observateur de la page que celui qu’utilise la bande : à chaque passage, s’il n’est pas juste après Search, il y va.

### Les limites, depuis `claude.ai` chaque minute

Les limites de 5 heures et hebdomadaire sont celles de votre compte, et `claude.ai` les connaît déjà. Le content script les lit de la même façon que la bande lit une conversation, avec la session de la page et une requête `GET` :

1. **Quel compte.** L’identifiant de l’organisation que la page a ouverte se trouve dans l’un des cookies de la page, `lastActiveOrg`. Le content script le lit depuis `document.cookie` et ne le stocke jamais.
2. **L’utilisation.** Il demande à `claude.ai` l’utilisation de cette organisation, une adresse interne de la page.
3. **Deux fenêtres.** De la réponse, il prend la fenêtre de 5 heures et la fenêtre de 7 jours : la part utilisée, en pourcentage, et le moment où chacune se réinitialise.

Il demande une fois au chargement de la page, puis toutes les 60 secondes, et jamais pendant que la page est cachée. Quand la page redevient visible, il demande aussitôt.

### Le niveau et le décompte, depuis le mod via ntfy.sh

Votre niveau et le décompte de ntfy.sh vivent sur votre ordinateur, dans le mod. narsil-pet les envoie dans son sujet d’état silencieux : votre sujet avec `-estado` (« état ») à la fin, publié après chaque tour pendant que vous écrivez à distance ([Les alertes sur votre téléphone et votre montre](/fr/mods/pet/phone-and-watch/) décrit le sujet et ses cinq champs). Son README dit que ce sujet est lu par cette extension « because they are data only the PC knows » (parce que ce sont des données que seul le PC connaît).

Le bloc utilise trois des cinq champs :

- **`xp`**, un libellé comme `⭐ Nivel 4 · 350/400 XP` ([L’expérience et la croissance](/fr/mods/pet/experience-and-growth/) explique les niveaux). `lib/state.js` le découpe en nom, en points dans le niveau et en points nécessaires, pour la barre.
- **`art`**, l’adresse de l’image de Narsil à son étape. Elle n’est acceptée que si elle pointe vers les ressources propres de narsil-pet.
- **`usage`**, une ligne nommée `ntfy` avec son libellé, son pourcentage, sa couleur, sa note et son heure de réinitialisation.

Le quatrième champ, `at`, est le moment où le mod l’a envoyé. Les données les plus récentes l’emportent toujours : un message plus ancien que celui déjà affiché est ignoré.

### Pourquoi c’est le script d’arrière-plan qui lit ntfy.sh, et non la page

Les content scripts s’exécutent dans `claude.ai`, sous la Content Security Policy de la page. C’est donc `background.js` qui lit. La description du code lui-même : de là, « claude.ai's Content-Security-Policy does not apply, and the topic and the key never reach the page. » (la Content-Security-Policy de claude.ai ne s’applique pas, et le sujet et la clé n’atteignent jamais la page).

Les deux côtés se parlent par un port ([MDN : runtime.connect](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/connect)) :

1. Quand une page `claude.ai` affiche le bloc, son content script ouvre un port nommé `narsil-band`. L’arrière-plan n’accepte que les ports de sa propre extension.
2. Avec le premier port, l’arrière-plan commence à lire ; quand le dernier est parti, il s’arrête. Une page cachée ferme son port, donc rien n’est lu pendant que vous ne regardez pas.
3. Chaque fois que l’état change, l’arrière-plan envoie l’état ouvert à chaque port. Il n’envoie jamais le sujet ni la clé.

### D’abord interroger, puis suivre le flux

ntfy.sh peut envoyer un sujet sous forme de flux JSON, « one JSON message object per line » (un objet message JSON par ligne), et son option `poll=1` termine la connexion une fois les messages en cache lus ([ntfy : subscribe API](https://docs.ntfy.sh/subscribe/api/)). L’arrière-plan utilise les deux, seulement sur le sujet `-estado` :

1. **Interroger les 12 dernières heures** : `https://ntfy.sh/<topic>-estado/json?poll=1&since=12h`. Cela apporte tout de suite l’état le plus récent.
2. **Suivre le flux** à partir de l’identifiant du dernier message reçu, pour que rien ne soit lu deux fois ni manqué.

Le flux est lu avec `fetch` et un lecteur de flux, ligne par ligne, pas avec `EventSource`. La raison se trouve dans `lib/stream.js` : le paquet Chromium exécute l’arrière-plan comme un service worker, « which has no EventSource » (qui n’a pas d’EventSource). Quand le flux se termine, il recommence à partir du dernier message reçu ; quand il échoue, il attend une seconde, puis deux fois plus longtemps à chaque fois, jusqu’à une minute.

Dans Chromium, le service worker est arrêté après 30 secondes sans activité ([Chrome : le cycle de vie du service worker d’extension](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)), et le flux avec lui. Donc, tant que le bloc est affiché, le content script envoie un mot sur son port toutes les 25 secondes pour le garder éveillé.

Le dernier état est aussi enregistré dans `storage.local`, avec le sujet auquel il appartient, pour qu’une page ouverte plus tard l’affiche tout de suite. Le commentaire du code explique pourquoi cela suffit : « what it brought is kept, as ntfy.sh keeps it for 12 h » (ce qu’il a apporté est gardé, comme ntfy.sh le garde 12 h).

### Les messages scellés et la clé

Si vous avez activé `/narsil movil clave` sur votre ordinateur, le mod scelle ce qu’il publie : l’état arrive sous forme d’un texte qui commence par `narsil1:`, illisible sans la clé. `lib/seal.js` l’ouvre avec la clé des options, en suivant le schéma qu’utilise `hooks/seal.ts` de narsil-pet ([le guide du téléphone](/fr/mods/pet/phone-and-watch/) le décrit pas à pas) :

1. Deux clés sont dérivées de la vôtre : HMAC-SHA256 de `enc` et de `mac`.
2. Le texte après `narsil1:` est décodé du base64url en un nonce de 16 octets, le texte chiffré et un tag de 32 octets.
3. Le tag est recalculé sur le nonce et le texte chiffré, et comparé à celui reçu. S’ils diffèrent, le message n’est pas ouvert.
4. Ce n’est qu’ensuite que le texte est déchiffré, 32 octets à la fois, avec comme flux de clé HMAC-SHA256 du nonce et d’un compteur de bloc.

Le mod construit HMAC à la main parce que son module de hooks n’a que SHA-256. L’extension n’en a pas besoin : la WebCrypto du navigateur a HMAC intégré ([MDN : SubtleCrypto.sign](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/sign)), et le commentaire de narsil-pet dit que le HMAC de WebCrypto « gives the same bytes » (donne les mêmes octets).

Quand un message scellé ne s’ouvre pas, parce qu’il n’y a pas de clé ou que ce n’est pas la bonne, le bloc affiche `🔒 Toca y pon la clave` (« touchez et saisissez la clé »), et un toucher ouvre les options. Un message qui n’est pas scellé est lu tel quel, avec ou sans clé.

### Ce que pourraient faire les lecteurs du sujet, et comment le bloc se défend

Sans clé, quiconque connaît votre sujet peut aussi y publier. Ce qui arrive de ntfy.sh n’est donc jamais traité comme du balisage de confiance : chaque valeur entre dans le bloc avec `textContent`, et une image n’est affichée que si son adresse commence par le dossier des ressources propres de narsil-pet. Un faux état pourrait afficher un mauvais niveau ou un mauvais décompte, mais il ne peut pas ajouter un lien, un script ou une image venue d’ailleurs.

### « Plus d’une heure », et pourquoi le décompte vient du PC

Le mod n’envoie un état que pendant que vous écrivez à distance. Quand vous revenez au bureau, le dernier état reste, et vieillit. Donc, quand un état a plus d’une heure, la ligne `ntfy hoy` ajoute une note comme `dato de hace 3 h` (« donnée d’il y a 3 h »). Le niveau ne reçoit pas de note de ce genre.

Le décompte lui-même doit venir de l’ordinateur, parce que ntfy.sh compte les messages par adresse IP. Le mod demande à ntfy.sh, depuis le réseau de l’ordinateur, combien de messages ce réseau a envoyés aujourd’hui, et met la réponse dans son état. Si le téléphone demandait, ntfy.sh répondrait au sujet du réseau du téléphone, qui n’envoie rien. Comme l’explique le guide du téléphone, cette journée commence aussi à une heure propre à ntfy.sh, et non à minuit, ce qui explique pourquoi la ligne affiche sa propre heure de réinitialisation.

## Comment on l’a demandé à l’IA

Aucune demande pour le bloc n’a été consignée. Les mots de l’auteur ou de l’autrice consignés pour ce parcours portent sur le site (le [guide 1](/fr/mods/claude/what-it-is/) les cite). Ce qui suit est reconstitué à partir de l’historique des commits de l’extension :

- `c200e8a` (2026-11-09) « feat: show Narsil's state in claude.ai's sidebar on Firefox for Android » (afficher l’état de Narsil dans le menu latéral de claude.ai sur Firefox pour Android). La première version : « A row under the search, with a panel for the conversations, limits, cache and alerts » (une ligne sous la recherche, avec un panneau pour les conversations, les limites, le cache et les alertes), lisant ntfy.sh « from the background page, live while the page shows it » (depuis la page d’arrière-plan, en direct tant que la page l’affiche).
- `00adbb9` (2026-11-09) « feat: show only Narsil's level, the limits and ntfy's count in the sidebar » (n’afficher dans le menu latéral que le niveau de Narsil, les limites et le décompte de ntfy). Les limites sont passées à `claude.ai` lui-même : « ntfy.sh is only read for what the page cannot know: her level and its own count, so the extension no longer follows the alerts topic. » (ntfy.sh n’est lu que pour ce que la page ne peut pas savoir : son niveau et son propre décompte, si bien que l’extension ne suit plus le sujet des alertes).
- `11dadb3` (2026-11-10) « feat: run the extension in Vivaldi for Android as a Chromium package » (faire tourner l’extension dans Vivaldi pour Android sous forme de paquet Chromium). Le flux est passé d’`EventSource` à `fetch`, avec l’attente croissante après un échec et le mot toutes les 25 secondes.

Du côté du mod, `544ef89` de narsil-pet (2026-11-09) « feat: send only what the Firefox extension reads through ntfy » (n’envoyer par ntfy que ce que lit l’extension Firefox) a réduit son état aux cinq champs ci-dessus, le même jour.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon extension pour `https://claude.ai/*`, ajoute un bloc juste après le bouton Search du menu latéral, trouvé par sa position, pas par son texte. Le content script ouvre un port `runtime.connect` vers l’arrière-plan tant que la page est visible et le ferme quand elle est cachée. L’arrière-plan lit le sujet dans `storage.local`, interroge `https://ntfy.sh/<topic>-estado/json?poll=1&since=12h`, puis suit le même flux JSON avec `fetch` et un lecteur de flux à partir de l’identifiant du dernier message, en réessayant avec une attente qui double jusqu’à 60 s. Il envoie à chaque port le dernier état analysé, jamais le sujet. Dans le bloc, affiche le champ `xp` comme texte avec `textContent`, n’accepte une URL d’image que depuis un préfixe fixe, et ajoute « donnée d’il y a N h » quand le `at` de l’état a plus d’une heure. Teste l’analyse et le flux avec `node --test`, en passant un faux `fetch`.

## Le code minimal

Les deux moitiés, écrites pour ce guide (MIT). L’arrière-plan suit le sujet d’état et envoie ce qu’il lit au bloc ; le content script l’affiche. Essayez-le avec un sujet inventé comme `narsil-0123456789abcdef0123`, sur un sujet à vous.

`background.js` :

```js
const ports = new Set()
let controller = null
let latest = null

async function follow(topic, signal) {
  let since = null
  let wait = 1000
  while (!signal.aborted) {
    try {
      const query = since ? `?since=${encodeURIComponent(since)}` : '?since=12h'
      const response = await fetch(`https://ntfy.sh/${topic}-estado/json${query}`, { signal })
      if (!response.ok || !response.body) throw new Error(`ntfy.sh ${response.status}`)
      wait = 1000
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
      let rest = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        const lines = (rest + value).split('\n')
        rest = lines.pop()
        for (const line of lines.filter(Boolean)) {
          const message = JSON.parse(line)
          if (message.event !== 'message') continue
          since = message.id
          latest = JSON.parse(message.message)
          ports.forEach((port) => port.postMessage(latest))
        }
      }
    } catch {
      if (signal.aborted) return
      await new Promise((resolve) => setTimeout(resolve, wait))
      wait = Math.min(wait * 2, 60_000)
    }
  }
}

browser.runtime.onConnect.addListener(async (port) => {
  if (port.sender?.id !== browser.runtime.id) return
  ports.add(port)
  port.onDisconnect.addListener(() => {
    ports.delete(port)
    if (ports.size === 0) controller?.abort()
  })
  if (latest) port.postMessage(latest)
  if (ports.size > 1) return
  const { topic } = await browser.storage.local.get('topic')
  if (!/^[-_A-Za-z0-9]{1,64}$/.test(topic ?? '')) return
  controller = new AbortController()
  follow(topic, controller.signal)
})
```

Dans le content script :

```js
const level = document.createElement('div')
const port = browser.runtime.connect({ name: 'my-block' })
port.onMessage.addListener((status) => {
  const hours = Math.floor((Date.now() / 1000 - (status.at ?? 0)) / 3600)
  level.textContent =
    hours >= 1 ? `${status.xp} · data from ${hours} h ago` : String(status.xp ?? '')
})
```

`TextDecoderStream` et le lecteur de flux sont standard ([MDN : Using readable streams](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams)), et ils fonctionnent dans un service worker Chromium, où `EventSource` ne fonctionne pas. Un message qui n’est pas du JSON valide lève une erreur dans la boucle et le flux redémarre juste après lui, ce qui suffit pour un exemple ; l’extension, elle, ignore ces lignes.

## Erreurs fréquentes et comment tester

- **Lire ntfy.sh depuis la page.** Le content script aurait besoin du sujet, et tout ce qui s’exécute d’autre sur la page aussi. Gardez le sujet dans l’arrière-plan.
- **Trouver Search par son texte.** Le libellé change avec la langue de la page. Trouvez-le par sa position.
- **`EventSource` dans Chromium.** Le service worker n’en a pas ; utilisez `fetch` et lisez le corps.
- **Un flux qui ne redémarre jamais.** ntfy.sh, le réseau ou le téléphone finiront par le fermer. Redémarrez à partir de l’identifiant du dernier message, et attendez plus longtemps après chaque échec.
- **Un service worker endormi.** Chromium arrête un service worker inactif après 30 secondes, et le flux s’arrête avec lui. Gardez-le éveillé tant que le bloc est affiché, et laissez-le dormir quand rien ne l’est.
- **Faire confiance au sujet.** Sans clé, quiconque a le nom peut publier. N’affichez que du texte, et des images d’une seule adresse fixe.
- **Demander le décompte à ntfy.sh depuis le téléphone.** La réponse porte sur le réseau du téléphone. Le décompte doit venir de l’ordinateur.
- **Un décompte qui ne bouge jamais.** Le mod n’envoie son état que pendant que vous écrivez par Remote Control. Au bureau, le bloc garde le dernier et indique son âge.

Pour tester, publiez un état inventé sur votre propre sujet de test depuis un ordinateur : `curl -d '{"xp":"⭐ Nivel 2 · 40/200 XP","at":1700000000}' https://ntfy.sh/narsil-0123456789abcdef0123-estado` ([ntfy : publishing](https://docs.ntfy.sh/publish/)), avec un sujet que vous avez inventé. Le bloc doit afficher le niveau en une seconde, et la note d’âge, puisque ce `at` est passé depuis longtemps. Coupez ensuite le réseau une minute et rétablissez-le : le flux doit reprendre, et un état publié pendant la coupure doit arriver.

## Pour aller plus loin

- Le [guide 4](/fr/mods/claude/colors-and-icon/) habille toute la page aux couleurs de Narsil, et donne son icône à l’application de l’écran d’accueil.
- Le [guide 5](/fr/mods/claude/android-packaging/) explique le paquet Chromium, et pourquoi son arrière-plan a besoin du mot toutes les 25 secondes.
- Les limites pourraient vous prévenir avant que vous ne les atteigniez, comme le fait Narsil dans Claude Code : voir [Le contexte et les limites](/fr/mods/pet/context-and-limits/).
