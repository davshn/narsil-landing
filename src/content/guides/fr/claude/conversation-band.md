---
title: La bande au-dessus de la zone de saisie
description: 'La bande que Narsil dans Claude dessine au-dessus de la zone de saisie de claude.ai : sa pose, l’état, le contexte, le cache et le dernier événement, lus dans les données de la page.'
route: claude
order: 2
updated: 2026-11-18
---

## Ce que ça fait

Quand vous ouvrez une conversation sur `claude.ai/code`, une bande apparaît juste au-dessus de la zone où vous écrivez. De gauche à droite et de haut en bas, elle affiche :

- **Narsil**, à son étape actuelle et dans la pose de l’état de la conversation.
- **L’état**, sous forme de pastille colorée : `TRABAJANDO` (au travail, bleu), `TE NECESITA` (a besoin de vous, ambre), `TERMINADA` (terminée, vert) ou `EN REPOSO` (au repos, gris). Le bord gauche de la bande prend la même couleur.
- **Le contexte**, comme `Contexto 42 %` : la part de sa fenêtre que la conversation a utilisée, en vert, ambre ou rouge.
- **Le cache**, comme `🧊 38 min` : les minutes restantes avant que le cache du prompt n’expire, jusqu’à ce qu’il devienne `🧊 fría` (« froid »).
- **Le dernier événement** : la dernière chose que Claude a dite, ou `Usando Bash` (« utilise Bash ») quand Claude ne fait qu’exécuter un outil, avec depuis combien de temps, comme `hace 3 min`.

Le texte tient sur deux lignes. Un toucher l’ouvre en entier et un autre le referme. La bande pousse la conversation vers le haut au lieu de la recouvrir, et elle se rafraîchit toutes les 10 secondes tant que l’écran est visible.

> **Expérimentale.** La bande lit les mêmes données que la page `claude.ai` charge pour elle-même, depuis des adresses internes qui ne sont pas une API publique, et trouve la zone de saisie par la structure de la page. Une mise à jour de Claude peut la casser ; quand cela arrive, la bande cesse simplement de s’afficher. Elle ne fait que lire : elle n’écrit jamais dans votre compte et n’envoie vos conversations nulle part, mais l’extension charge les dessins de Narsil depuis GitHub et lit son sujet d’état sur ntfy.sh.

Tout ce que montre la bande vient de `claude.ai` lui-même, donc elle n’a besoin d’aucun message de votre ordinateur. Seuls deux détails dépendent du [mod narsil-pet](https://github.com/davshn/narsil-pet) : l’étape de Narsil sur l’image, et la durée du cache.

## Comment ça marche à l’intérieur

La bande est dessinée par le content script `extension/content.js`. Ce qu’elle tire des données vit dans `extension/lib/live.js`, un module sans code DOM, ce qui permet de tester les règles à part.

### D’où viennent les données : les requêtes propres de la page

La bande ne lit pas la conversation à l’écran. Elle pose à `claude.ai` les mêmes questions que la page, avec votre session, et lit les réponses en JSON. Deux requêtes partent ensemble :

- **La liste de vos conversations**, actives et en pause, jusqu’à 50 (`/v1/code/sessions` sur `claude.ai`). La bande prend celle que vous avez ouverte, trouvée par l’identifiant dans l’adresse de la page (`/code/session_…`). L’adresse et la liste peuvent nommer la même conversation avec des préfixes différents, donc les identifiants sont comparés sans eux.
- **Les 60 derniers événements de cette conversation**, les plus récents d’abord (`/v1/code/sessions/<id>/events`).

Ce sont des adresses internes de `claude.ai`. Le code le dit juste au-dessus : « These addresses are not a public API and may change. » (ces adresses ne sont pas une API publique et peuvent changer). Elles sont la principale raison pour laquelle l’extension est expérimentale.

Pour envoyer les requêtes « comme la page elle-même, avec sa session », le content script utilise `content.fetch` de Firefox quand il existe. MDN explique que dans Firefox, avec Manifest V2, `content.fetch()` fait des « requests that behave as if they were sent by the content itself » (requêtes qui se comportent comme si elles étaient envoyées par le contenu lui-même) ; dans Manifest V3, il n’est pas disponible, et le `fetch` propre d’un content script s’exécute déjà dans le contexte de la page ([MDN : Content scripts, XHR and Fetch](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts#xhr_and_fetch)). L’extension Firefox utilise donc `content.fetch` et le paquet Chromium pour Vivaldi se rabat sur `fetch`. Les deux envoient vos cookies (`credentials: 'include'`), donc `claude.ai` répond comme il répond à la page. Ce ne sont que des requêtes `GET`, et les réponses restent dans la page.

### De quoi est faite chaque valeur

`liveOf` dans `lib/live.js` transforme la conversation et ses événements en ce que montre la bande :

| Valeur            | Construite à partir de                                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| État              | Le `status_bucket` de la conversation : `working`, `blocked` ou `completed` ; toute autre valeur donne `EN REPOSO`.                |
| Contexte          | `context_usage` dans les métadonnées de la conversation : les tokens utilisés sur le maximum de la fenêtre, arrondis au pour cent. |
| Dernier événement | Le message de Claude le plus récent qui a du texte ; s’il n’a qu’un appel d’outil, `Usando` et le nom de l’outil.                  |
| Quand             | L’heure de ce message, sous la forme `ahora mismo`, `hace 5 min`, `hace 2 h` ou `hace 1 d`.                                        |
| Cache             | Ce même message de Claude le plus récent, plus la durée du cache (voir plus bas).                                                  |

Deux règles gardent le dernier événement utile. La réflexion seule ne dit rien, donc un message sans texte ni outil est ignoré. Et seuls les messages de Claude comptent : la conversation a beaucoup d’autres types d’événements.

Le contexte et le cache partagent une même coloration : vert sous 60 %, ambre à partir de 60 %, rouge à partir de 85 %, les mêmes seuils que les limites du menu latéral. Pour le cache, le pourcentage est la part de son temps qui s’est écoulée.

### L’image de Narsil : la pose vient de la page, l’étape du mod

La pose suit l’état : au travail, qui a besoin de vous, terminée, ou debout au repos. Son étape n’est pas une chose que `claude.ai` connaît. Elle vient du mod : l’état que narsil-pet envoie par ntfy.sh porte l’adresse de son image, et son étape est le dossier dans cette adresse ([L’expérience et la croissance](/fr/mods/pet/experience-and-growth/) explique les étapes). La bande en garde l’étape, y met la pose de cette conversation, et choisit la variante claire ou sombre selon la page.

Les images ne sont acceptées que depuis les ressources propres de narsil-pet sur GitHub. Quand il n’y a pas d’état du mod, ou qu’une image ne se charge pas, la bande montre à la place l’icône propre de l’extension, et une image qui a échoué n’est pas redemandée.

### Pourquoi le cache est une estimation

`claude.ai` ne dit pas quand le cache d’une conversation expire, donc la bande l’estime : **l’heure du dernier message de Claude plus la durée d’un cache**.

- **À partir du dernier message de Claude**, pas du dernier événement de la conversation. Le commit qui a ajouté la bande explique pourquoi : « as any event moves the session's own time » (car tout événement fait avancer l’heure propre de la session). Le code ajoute qu’ouvrir la page crée quelques événements à elle, ce qui remettrait le compte à rebours à zéro chaque fois que vous regardez.
- **Sa durée** est l’affaire du mod : narsil-pet envoie `cacheMinutes` dans son état ([L’horloge du cache](/fr/mods/pet/cache-clock/) explique comment il choisit entre 60 et 5 minutes). Sans cette valeur, la bande suppose 60 minutes.

Le compte à rebours peut donc être décalé : le cache part en réalité de la requête, pas du message, et sans le mod un cache de 5 minutes s’affiche comme 60. Lisez `🧊 38 min` comme « environ 38 minutes ».

### Toutes les 10 secondes, seulement pendant que vous regardez

La bande demande de nouvelles données toutes les 10 secondes, et pas du tout pendant que la page est cachée (écran éteint, une autre application ou un autre onglet devant). Quand la page redevient visible, elle demande aussitôt, grâce à l’événement [`visibilitychange`](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event). Entre les requêtes, elle se redessine toutes les 15 secondes, pour que le compte à rebours et le temps « hace » continuent d’avancer. Si une requête échoue, ce qu’elle savait en dernier reste jusqu’à la suivante.

### Dans le flux de la page, pour ne rien recouvrir

La bande n’est pas une couche flottante. C’est un élément normal inséré juste avant la zone de saisie, comme son frère précédent. La zone de saisie est trouvée par un attribut que la page lui donne. Comme la bande fait partie de la mise en page propre de la page, la conversation au-dessus se termine simplement un peu plus haut ; rien n’est caché derrière elle.

Le texte est limité à deux lignes avec CSS ([`line-clamp`](https://developer.mozilla.org/en-US/docs/Web/CSS/line-clamp)). Un toucher bascule une classe qui retire la limite et laisse le texte défiler dans une boîte d’au plus 40 % de la hauteur de l’écran. Tout le texte est inséré avec `textContent`, jamais en HTML.

### Suivre la page quand elle change

`claude.ai` est une application monopage : ouvrir une autre conversation change l’adresse et le contenu sans charger de nouvelle page, et la page reconstruit parfois la zone de saisie. La bande ne peut donc pas être placée une fois pour toutes.

`extension/lib/watch.js` contient l’unique [`MutationObserver`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) de l’extension, qui surveille tout le document. Pendant que Claude écrit, la page change de nombreuses fois par image, donc l’observateur n’exécute pas ses callbacks à chaque changement : il les planifie une fois par image avec [`requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame). À chaque passage, la bande vérifie deux choses :

- **Est-elle toujours juste au-dessus de la zone de saisie ?** Sinon, elle y retourne.
- **Est-ce toujours la même conversation ?** La bande compare l’identifiant dans l’adresse avec celui qu’elle a demandé en dernier. Quand il change, les anciennes données sont abandonnées, la bande disparaît, et de nouvelles données sont demandées aussitôt.

La bande n’écrit une valeur que quand elle a changé, puisque chacune de ses écritures est un changement de plus pour l’observateur. Et l’observateur s’arrête, avec tout ce qui l’utilisait, dès que l’extension est supprimée ou rechargée, pour qu’une copie orpheline ne continue pas à dessiner.

## Comment on l’a demandé à l’IA

Aucune demande pour la bande n’a été consignée. Les mots de l’auteur ou de l’autrice consignés pour ce parcours portent sur le site (le [guide 1](/fr/mods/claude/what-it-is/) les cite). Ce qui suit est reconstitué à partir de l’historique des commits de l’extension :

- `c200e8a` (2026-11-09) « feat: show Narsil's state in claude.ai's sidebar on Firefox for Android » (afficher l’état de Narsil dans le menu latéral de claude.ai sur Firefox pour Android). La première version montrait les conversations dans un panneau du menu latéral, alimenté par le mod via ntfy.sh.
- `19677ac` (2026-11-09) « feat: show each conversation's state, context and cache above the prompt » (afficher l’état, le contexte et le cache de chaque conversation au-dessus du prompt). La bande voit le jour. Son message la décrit comme « read from the same addresses claude.ai uses, so it needs no message from the PC » (lue depuis les mêmes adresses qu’utilise claude.ai, si bien qu’elle n’a besoin d’aucun message du PC), et explique la règle du cache citée plus haut.
- `00adbb9` (2026-11-09) « feat: show only Narsil's level, the limits and ntfy's count in the sidebar » (n’afficher dans le menu latéral que le niveau de Narsil, les limites et le décompte de ntfy). Le panneau et ses alertes ont été retirés, « as each conversation's strip covers them » (puisque la bande de chaque conversation s’en charge).
- `ce7d17e` (2026-11-11) « perf: lighten the styles and the page observers so claude.ai switches conversations faster » (alléger les styles et les observateurs de la page pour que claude.ai change de conversation plus vite). L’observateur unique, limité à un passage par image.
- `1d9db3d` (2026-11-11) « fix: load the page observer with the band and stop when the extension goes away » (charger l’observateur de la page avec la bande et s’arrêter quand l’extension disparaît).

L’historique montre un passage des données envoyées par l’ordinateur aux données que la page avait déjà : la bande fonctionne dès que vous ouvrez une conversation, même avec l’ordinateur éteint.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon extension Firefox pour `https://claude.ai/*`, ajoute un content script qui dessine une bande d’état juste avant la zone de saisie de la page, comme son frère précédent, pour qu’elle pousse la conversation vers le haut au lieu de la recouvrir. Trouve l’identifiant de la conversation dans `location.pathname`. Toutes les 10 secondes, et seulement tant que `document.hidden` est faux, lis les données de la conversation avec la session propre de la page (`content.fetch` quand il existe, sinon `fetch`, avec `credentials: 'include'`), en `GET` uniquement. Affiche l’état, le pourcentage de contexte, le dernier texte écrit par Claude et depuis combien de temps, et un compte à rebours du cache estimé à partir de l’heure du dernier message de Claude plus 60 minutes. Utilise un seul `MutationObserver` sur le document, limité avec `requestAnimationFrame`, pour remettre la bande en place quand la page se reconstruit et la réinitialiser quand la conversation change. N’écris le texte qu’avec `textContent`. Limite le texte à deux lignes et laisse un toucher le déplier. Garde les règles dans un module sans code DOM, et teste-les avec `node --test`.

## Le code minimal

Un petit content script de la même forme, écrit pour ce guide (MIT). `readConversation` représente ce qui lit vos données ; ici, il renvoie l’heure du dernier message de Claude, en secondes. Le reste est la mécanique de la bande : la placer, suivre la page, rafraîchir tant qu’elle est visible et estimer le cache.

```js
const BOX = '[data-cds=ChatComposer]'
const CACHE_MINUTES = 60
const band = document.createElement('div')
band.id = 'my-band'
const text = document.createElement('span')
band.append(text)
band.addEventListener('click', () => band.classList.toggle('open'))

let lastSaidAt = null

function cacheLabel(saidAt, now) {
  const left = Math.ceil((saidAt + CACHE_MINUTES * 60 - now) / 60)
  return left > 0 ? `🧊 ${left} min` : '🧊 cold'
}

function draw() {
  const box = document.querySelector(BOX)
  if (!box || lastSaidAt === null) {
    band.remove()
    return
  }
  const label = cacheLabel(lastSaidAt, Date.now() / 1000)
  if (text.textContent !== label) text.textContent = label
  if (box.previousElementSibling !== band) box.before(band)
}

async function refresh() {
  if (document.hidden) return
  try {
    lastSaidAt = await readConversation(location.pathname)
  } catch {
    return
  }
  draw()
}

let queued = false
new MutationObserver(() => {
  if (queued) return
  queued = true
  requestAnimationFrame(() => {
    queued = false
    draw()
  })
}).observe(document.documentElement, { childList: true, subtree: true })

document.addEventListener('visibilitychange', refresh)
setInterval(refresh, 10_000)
refresh()
```

Le CSS pour les deux lignes et le toucher :

```css
#my-band span {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

#my-band.open span {
  display: block;
  max-height: 40dvh;
  overflow-y: auto;
}
```

`BOX` est l’attribut que `claude.ai` donne aujourd’hui à sa zone de saisie ; si Claude le renomme, c’est cette ligne qui casse. Comparer `box.previousElementSibling` avant d’appeler [`before()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/before) compte : déplacer la bande à chaque image serait un changement en soi, et l’observateur se réveillerait de nouveau.

## Erreurs fréquentes et comment tester

- **Un observateur par fonctionnalité.** Plusieurs observateurs sur une page qui change de nombreuses fois par image finissent par peser. Utilisez-en un seul, et exécutez son travail au plus une fois par image.
- **Écrire à chaque passage.** Modifier `textContent` ou déplacer la bande quand rien n’a changé redéclenche l’observateur. Comparez d’abord.
- **Une bande flottante.** Une bande en `position: fixed` recouvre les dernières lignes de la conversation et les boutons que Claude y affiche. Insérez-la dans le flux de la page.
- **Des requêtes pendant que la page est cachée.** Un téléphone écran éteint continuerait de demander toutes les 10 secondes. Vérifiez `document.hidden` et écoutez `visibilitychange`.
- **Le cache à partir du dernier événement.** Ouvrir la page crée des événements, donc compter à partir du dernier remet le compte à rebours à zéro chaque fois que vous regardez. Comptez à partir du dernier message de Claude.
- **Le texte en HTML.** Les messages de Claude peuvent contenir n’importe quoi. Utilisez `textContent`, jamais `innerHTML`.
- **Ne pas réinitialiser sur une nouvelle conversation.** Sans comparer l’identifiant dans l’adresse, la bande montre les données de la conversation précédente pendant jusqu’à 10 secondes.

Pour tester les règles, gardez-les dans un module sans DOM, comme le fait `lib/live.js`, et donnez-leur des événements inventés : une liste dont le message de Claude le plus récent n’a qu’un appel d’outil doit donner `Usando` et le nom de l’outil, et un message vieux de 61 minutes doit donner le cache froid. Pour tester la bande elle-même, ouvrez une conversation, passez à une autre et revenez, faites pivoter le téléphone, et éteignez puis rallumez l’écran : la bande doit rester au-dessus de la zone de saisie, changer avec la conversation, et se mettre à jour dans les 10 secondes après le retour de l’écran.

## Pour aller plus loin

- Le [guide 3](/fr/mods/claude/sidebar/) présente le bloc du menu latéral, qui ajoute ce que la page ne peut pas savoir.
- Dans Claude Code, Narsil montre les mêmes états avec ses propres règles : voir [L’horloge du cache](/fr/mods/pet/cache-clock/) et [Le contexte et les limites](/fr/mods/pet/context-and-limits/).
- La bande pourrait vous prévenir quand le cache est sur le point de refroidir. Il lui faudrait la vraie durée du cache, et c’est pourquoi l’extension la prend au mod quand elle le peut.
