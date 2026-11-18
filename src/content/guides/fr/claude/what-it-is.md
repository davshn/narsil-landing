---
title: Ce qu’est Narsil dans Claude
description: 'L’extension de navigateur qui amène Narsil dans claude.ai sur Android : ce qu’elle affiche, pourquoi elle est expérimentale, les navigateurs, ses options et sa construction.'
route: claude
order: 1
updated: 2026-11-18
---

## Ce que ça fait

Narsil dans Claude (« Narsil en Claude » de son propre nom) est une extension de navigateur pour Firefox et Vivaldi sur Android. Elle amène Narsil dans `claude.ai`, pour que vous voyiez où en sont vos conversations sans quitter la page où vous parlez à Claude. Elle ajoute quatre choses :

- **Une bande au-dessus de la zone de saisie**, dans chaque conversation sur `claude.ai/code` : Narsil dans la pose de l’état de la conversation, l’état lui-même (`TRABAJANDO`, `TE NECESITA`, `TERMINADA` ou `EN REPOSO`), le contexte utilisé, le compte à rebours du cache et la dernière chose que Claude a dite. Le [guide 2](/fr/mods/claude/conversation-band/) la présente.
- **Un bloc dans le menu latéral**, sous Search : le niveau et l’expérience de Narsil, les limites d’utilisation de 5 heures et hebdomadaire, et le décompte ntfy du jour. Le [guide 3](/fr/mods/claude/sidebar/) le présente.
- **Les couleurs de Narsil** sur toute la page, claires le jour et sombres la nuit, d’après la palette mer de nuit de [Narsil Skin](https://github.com/davshn/narsil-skin). Le [guide 4](/fr/mods/claude/colors-and-icon/) les présente.
- **L’icône de Narsil**, quand vous ajoutez `claude.ai` à l’écran d’accueil avec l’extension active. Également dans le [guide 4](/fr/mods/claude/colors-and-icon/).

L’extension fonctionne par-dessus la vraie application web de Claude. Rien n’est remplacé : vous lisez toujours toute la conversation, vous approuvez les autorisations et répondez aux questions de Claude comme d’habitude. L’extension ne fait qu’ajouter ce qu’elle dessine autour.

> **Expérimentale.** L’extension s’appuie sur la structure de la page `claude.ai` et sur des adresses internes que la page elle-même utilise, pas sur une API publique. Une mise à jour de Claude peut la casser à tout moment. Quand cela arrive, la bande ou le bloc cessent simplement de s’afficher ; ils ne cachent rien. Elle ne fait que lire : elle n’écrit jamais dans votre compte et n’envoie vos conversations nulle part, mais l’extension charge les dessins de Narsil depuis GitHub et lit son sujet d’état sur ntfy.sh. Son code n’est pas public, donc ce parcours explique comment elle est construite et donne de petits exemples à vous.

L’extension fait partie de la famille Narsil. Le niveau et le décompte ntfy viennent de [Narsil pour Claude Code](https://github.com/davshn/narsil-pet), le mod sur votre ordinateur ; tout le reste fonctionne sans lui.

## Comment ça marche à l’intérieur

### Pourquoi une extension, et pourquoi sur Android

Claude Code sur votre ordinateur montre déjà Narsil dans sa bande et sa fenêtre flottante. Quand vous pilotez une conversation depuis le téléphone par Remote Control, vous êtes sur `claude.ai/code` dans un navigateur mobile, et Narsil est hors de vue. L’application Claude pour Android ne peut pas être étendue, mais une page dans un navigateur le peut : une extension de navigateur exécute ses propres scripts dans la page que vous ouvrez.

L’extension est donc le seul moyen de mettre Narsil sur le même écran que la conversation, et c’est pourquoi elle ne prend en charge que deux navigateurs mobiles :

| Navigateur                  | Bande et bloc              | Couleurs  | Icône     |
| --------------------------- | -------------------------- | --------- | --------- |
| Vivaldi pour Android        | Oui                        | Oui       | Non testé |
| Firefox pour Android        | Oui                        | Oui       | Oui       |
| Firefox sur ordinateur      | Non testé                  | Non testé | Inutile   |
| Chrome pour Android         | N’accepte pas d’extensions | Non       | Non       |
| L’application Claude native | Non                        | Non       | Non       |

Elle demande **Firefox 142 ou plus récent** ou **Vivaldi 8.2 ou plus récent**. Le minimum de Firefox vient du manifeste (`strict_min_version` réglé sur `142.0`, pour Firefox et Firefox pour Android) ; celui de Vivaldi vient du README, qui dit que Vivaldi sur Android charge des extensions Chrome depuis un dossier depuis la 8.2.

### Les parties de l’extension

L’extension est en JavaScript simple, sans étape de build ni bibliothèques. Son dossier contient :

- **`manifest.json`**, la description dont part toute extension de navigateur ([MDN : manifest.json](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json)). C’est un fichier Manifest V2 pour Firefox. Il ne demande que deux autorisations : `storage`, pour les options, et `https://ntfy.sh/*`, pour lire l’état du mod. Il déclare aussi `data_collection_permissions` à `none`, la façon dont Firefox permet à une extension de dire qu’elle ne collecte aucune donnée.
- **Deux groupes de content scripts**, qui correspondent tous deux à `https://claude.ai/*` ([MDN : content_scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_scripts)). Le premier s’exécute à `document_start`, avant que la page ne se dessine, avec les couleurs (`skin.css`, `mode.js`) et l’icône (`app-icon.js`). Le second s’exécute à `document_idle`, une fois la page chargée, avec la bande et le bloc (`content.js` et `band.css`).
- **Un script d’arrière-plan**, `background.js`. C’est la seule partie qui parle à ntfy.sh. Dans Firefox, c’est une page d’arrière-plan ; dans le paquet Chromium pour Vivaldi, un service worker charge les mêmes fichiers.
- **La page d’options**, `options.html` et `options.js`, où vous écrivez votre sujet et votre clé.
- **De petits modules dans `lib/`**, chacun chargé là où il sert : `live.js` (ce que la bande et les limites tirent des données de `claude.ai`), `state.js` (ce qui est gardé et affiché de l’état du mod), `seal.js` (l’ouverture des messages scellés), `stream.js` (le suivi du flux de ntfy.sh), `watch.js` (l’unique observateur de la page), `mode.js` (quel mode reçoit chaque heure), `manifest.js` (l’icône de l’écran d’accueil), `restore.js` (la remise en place des styles et des scripts dans Vivaldi) et `browser.js` (qui permet au code d’écrire `browser` aussi dans Chromium).

Le découpage suit une règle : **la page ne voit rien de secret**. Les content scripts s’exécutent dans `claude.ai` et dessinent ; le script d’arrière-plan détient le sujet et la clé, lit ntfy.sh, et n’envoie à la page que l’état qu’il a déjà ouvert. Le code le dit clairement : le sujet et la clé « never reach the page » (n’atteignent jamais la page).

### Les options : votre sujet et votre clé

La page d’options a deux champs et un bouton Save :

- **Topic** (le sujet), celui que `/narsil movil` vous donne dans Claude Code ([Les alertes sur votre téléphone et votre montre](/fr/mods/pet/phone-and-watch/) explique comment le mod le crée). La page n’accepte que des lettres, des chiffres, `-` et `_`, jusqu’à 64 caractères, et refuse tout le reste.
- **Key** (la clé), seulement si vous en avez créé une avec `/narsil movil clave`. C’est un champ de mot de passe.

Les deux sont enregistrés avec `storage.local` ([MDN : storage.local](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/local)), le stockage propre de l’extension sur le téléphone. Ils ne vont jamais dans le paquet qui est signé, ni dans la page. Quand l’un d’eux change, le script d’arrière-plan le remarque (`storage.onChanged`) et recommence à lire avec les nouvelles valeurs.

Si le bloc du menu latéral affiche `Toca y escribe tu topic` (« touchez et écrivez votre sujet ») ou `🔒 Toca y pon la clave` (« touchez et saisissez la clé »), toucher le bloc ouvre la page d’options.

### Ce qu’elle demande au mod, et ce qui fonctionne sans lui

| Partie                                  | Demande narsil-pet ? | D’où elle vient                    |
| --------------------------------------- | -------------------- | ---------------------------------- |
| La bande au-dessus de la zone de saisie | Non                  | `claude.ai` lui-même               |
| Les limites de 5 heures et hebdomadaire | Non                  | `claude.ai` lui-même               |
| Les couleurs et l’icône                 | Non                  | L’extension                        |
| Le niveau et l’expérience de Narsil     | Oui                  | Le sujet d’état du mod sur ntfy.sh |
| Le décompte ntfy du jour                | Oui                  | Le sujet d’état du mod sur ntfy.sh |
| L’étape de Narsil dans les images       | Oui                  | L’image que nomme l’état du mod    |

Pour les lignes qui demandent le mod, `/narsil movil` doit être activé. Sans lui, le bloc du menu latéral n’affiche que les limites, et la bande montre l’icône propre de l’extension là où serait l’image de Narsil à son étape.

### Ce qui passe par le réseau

L’extension ne fait que lire. Chaque requête qu’elle fait, d’après son code :

- **Vers `claude.ai`**, avec votre session, comme le fait la page elle-même : la liste de vos conversations actives et en pause, les derniers événements de celle que vous avez ouverte, et l’utilisation de votre compte. Seulement des requêtes `GET`. Rien n’est écrit dans votre compte.
- **Vers ntfy.sh**, depuis le script d’arrière-plan : il lit le sujet d’état du mod (votre sujet avec `-estado` à la fin). Lire un sujet demande son nom dans l’adresse, donc ntfy.sh voit le sujet et le réseau de votre téléphone. Rien n’est publié.
- **Vers GitHub**, pour les images de Narsil : la bande et le bloc montrent ses dessins depuis le dépôt narsil-pet, donc le téléphone télécharge ces images. Le nom du fichier dit sa pose et son étape, comme la pose au travail ou la pose en attente.
- **L’icône de l’écran d’accueil** pointe vers les icônes de l’application web pour téléphone de l’auteur ou de l’autrice, que le navigateur ne télécharge que quand vous ajoutez `claude.ai` à l’écran d’accueil.

Aucune de ces requêtes n’envoie ce que montre la page (vos conversations, votre utilisation, votre sujet ou votre clé) ailleurs.

### L’installer

Le code n’est pas public, donc voici les étapes que suit l’auteur ou l’autrice, et celles qui s’appliquent à une extension que vous construisez vous-même. Le [guide 5](/fr/mods/claude/android-packaging/) explique l’empaquetage en détail.

**Dans Vivaldi**, l’extension se charge depuis un dossier sur le téléphone, sans signature :

1. Construisez le paquet Chromium (Manifest V3) à partir de l’extension Firefox et copiez-le dans le dossier `Download` du téléphone par USB.
2. Dans Vivaldi, ouvrez `vivaldi://extensions` et activez **Developer mode**.
3. Touchez **Load unpacked**, choisissez le dossier, puis **Use this folder** et **Allow**.
4. Ouvrez les options de l’extension et écrivez votre sujet, et la clé si vous en avez une.
5. Ouvrez `claude.ai` et rechargez la page.

**Dans Firefox**, une extension doit être signée par Mozilla. La signature est _unlisted_ (non listée) : elle ne publie pas l’extension sur la boutique de modules.

1. Créez des identifiants d’API sur [addons.mozilla.org](https://addons.mozilla.org/developers/addon/api/key/) et signez l’extension avec `web-ext sign --channel=unlisted` de Mozilla ([Extension Workshop : référence des commandes web-ext](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#web-ext-sign)). Le résultat est un fichier `.xpi`.
2. Copiez le `.xpi` sur le téléphone.
3. Dans Firefox, ouvrez **Settings → About Firefox** et touchez le logo cinq fois pour afficher le menu caché.
4. De retour dans **Settings**, utilisez l’option pour installer une extension depuis un fichier.
5. Ouvrez les paramètres de l’extension et écrivez votre sujet, et la clé si vous en avez une.

### La désinstaller

Dans Firefox, ouvrez le menu, allez dans **Extensions**, choisissez **Narsil en Claude** et supprimez-la. Dans Vivaldi, supprimez-la depuis `vivaldi://extensions`. Claude retrouve ses propres couleurs. L’icône de l’écran d’accueil reste jusqu’à ce que vous installiez de nouveau l’application, car le navigateur la fixe au moment de l’installation.

Pour arrêter le niveau et le décompte sans rien supprimer, videz le sujet dans les options. Pour que le mod n’envoie plus du tout l’état, lancez `/narsil movil off` sur votre ordinateur.

## Le construire avec Claude

Demandez à Claude le squelette d’une extension Firefox pour `claude.ai` : un manifeste, un content script, un script d’arrière-plan et une page d’options. L’idée que Claude doit bien saisir : la page ne voit rien de secret ; seul le script d’arrière-plan garde le sujet et parle à ntfy.sh.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Construis une extension Firefox (Manifest V2, JavaScript simple, sans étape de build) pour Firefox pour Android qui ajoute une petite bande d’état à `https://claude.ai/*`. Utilise deux groupes de content scripts : un à `document_start` pour les styles, un à `document_idle` qui dessine la bande. Ajoute une page d’options (`options_ui`) avec un champ « topic », validé par `[-_A-Za-z0-9]{1,64}`, enregistré avec `browser.storage.local`. Seul le script d’arrière-plan peut lire le sujet et parler à `https://ntfy.sh` ; le content script reçoit l’état par `runtime.connect` et ne voit jamais le sujet. Ne demande aucune autorisation au-delà de `storage` et `https://ntfy.sh/*`. Insère chaque morceau de texte avec `textContent`, jamais en HTML. N’utilise que des API documentées sur MDN, et liste chacune de celles que tu as utilisées avec sa page MDN.

### Ce qu’il faut vérifier dans la réponse de Claude

1. Le manifeste ne demande que deux autorisations, `storage` et `https://ntfy.sh/*`, et déclare `data_collection_permissions` à `none`.
2. Les content scripts correspondent à `https://claude.ai/*`, avec les styles à `document_start` et la bande à `document_idle`.
3. Seul le script d’arrière-plan lit le sujet et parle à ntfy.sh. Le content script reçoit l’état par `runtime.connect` et ne voit jamais le sujet.
4. La page d’options n’accepte que des lettres, des chiffres, `-` et `_`, jusqu’à 64 caractères, et enregistre le sujet avec `storage.local`, jamais dans le code de l’extension.
5. Chaque morceau de texte est inséré avec `textContent`, jamais en HTML, et chaque API utilisée par Claude est accompagnée de sa page MDN.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « le content script lit le sujet dans `storage.local` et interroge ntfy.sh lui-même ».

### Comment l’auteur l’a demandé

#### Consigné : à propos de ce parcours, pas de l’extension

Les demandes faites à l’IA pour l’extension elle-même n’ont pas été consignées. Ce qui l’est, c’est la façon dont l’auteur ou l’autrice a demandé qu’elle apparaisse sur ce site. Dans la phase 2 du journal de tâches du site :

> "tambien quiero agregar la informacion de narsil-claude ponla como experimental, aunque he hecho muchas pruebas y fujnciona bastante bien"

Traduction en français : je veux aussi ajouter les informations sur narsil-claude ; présente-la comme expérimentale, même si je l’ai beaucoup testée et qu’elle marche plutôt bien.

Et pour ce parcours, le 2026-11-18 :

> "hay otra cosa, no metimos la guia de narsul claude en celular, pusimos que era experimental pero que explicariamos como hacerlo, falta esa guia, el repositorio es narsil-claude"

Traduction en français : il y a autre chose, nous n’avons pas mis le guide de narsil claude sur le téléphone ; nous avons dit qu’elle était expérimentale mais que nous expliquerions comment la faire ; ce guide manque ; le dépôt est narsil-claude. L’auteur ou l’autrice a demandé une « Ruta corta », un parcours court, qui est celui-ci.

#### Reconstitution à partir de l’historique des commits

Le reste est reconstitué à partir de l’historique des commits de l’extension ; les demandes elles-mêmes n’ont pas été gardées. Le premier jour en a construit l’essentiel :

- `c200e8a` (2026-11-09) « feat: show Narsil's state in claude.ai's sidebar on Firefox for Android » (afficher l’état de Narsil dans le menu latéral de claude.ai sur Firefox pour Android). Son message explique le but : « so the state is on the same screen as Claude » (pour que l’état soit sur le même écran que Claude), en lisant ntfy.sh depuis la page d’arrière-plan, avec le sujet et la clé dans le stockage de l’extension.
- `0d65509` (2026-11-09) « feat: wear Narsil's colors on claude.ai, light by day and dark by night » (habiller claude.ai aux couleurs de Narsil, claires le jour et sombres la nuit).
- `40be528` (2026-11-09) « build: sign the extension as unlisted with Mozilla » (signer l’extension comme non listée auprès de Mozilla).
- `083c03d` (2026-11-09) « feat: give claude.ai Narsil's icon when it is installed from Firefox » (donner à claude.ai l’icône de Narsil quand il est installé depuis Firefox).
- `19677ac` (2026-11-09) « feat: show each conversation's state, context and cache above the prompt » (afficher l’état, le contexte et le cache de chaque conversation au-dessus du prompt).
- `00adbb9` (2026-11-09) « feat: show only Narsil's level, the limits and ntfy's count in the sidebar » (n’afficher dans le menu latéral que le niveau de Narsil, les limites et le décompte de ntfy).
- `11dadb3` (2026-11-10) « feat: run the extension in Vivaldi for Android as a Chromium package » (faire tourner l’extension dans Vivaldi pour Android sous forme de paquet Chromium).

L’ordre montre une conception qui s’est resserrée : elle a commencé comme un seul panneau dans le menu latéral alimenté par ntfy.sh, et a fini coupée en deux, ntfy.sh ne servant qu’à ce que la page ne peut pas savoir.

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide. Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

Un squelette de la même forme, écrit pour ce guide (MIT). C’est une extension Manifest V2 pour Firefox avec un content script, un script d’arrière-plan et une page d’options ; les [guides 2](/fr/mods/claude/conversation-band/) et [3](/fr/mods/claude/sidebar/) les remplissent.

`manifest.json` :

```json
{
  "manifest_version": 2,
  "name": "My band on claude.ai",
  "version": "0.1.0",
  "browser_specific_settings": {
    "gecko": {
      "id": "my-band@example.com",
      "strict_min_version": "142.0",
      "data_collection_permissions": { "required": ["none"] }
    }
  },
  "permissions": ["storage", "https://ntfy.sh/*"],
  "background": { "scripts": ["background.js"] },
  "content_scripts": [
    {
      "matches": ["https://claude.ai/*"],
      "js": ["band.js"],
      "css": ["band.css"],
      "run_at": "document_idle"
    }
  ],
  "options_ui": { "page": "options.html", "open_in_tab": true }
}
```

`options.html` contient un formulaire avec un champ `topic`, un bouton d’envoi et un paragraphe `status`, et charge `options.js` :

```js
const form = document.getElementById('form')
const input = document.getElementById('topic')
const status = document.getElementById('status')

browser.storage.local.get('topic').then(({ topic }) => {
  input.value = topic ?? ''
})

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const topic = input.value.trim()
  if (!/^[-_A-Za-z0-9]{1,64}$/.test(topic)) {
    status.textContent = 'Only letters, numbers, - and _.'
    return
  }
  await browser.storage.local.set({ topic })
  status.textContent = 'Saved.'
})
```

Essayez-le avec un sujet inventé comme `narsil-0123456789abcdef0123`. Les API sont sur MDN : [`storage.local`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/local), [`options_ui`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/options_ui) et [`browser_specific_settings`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings).

## Erreurs fréquentes et comment tester

- **L’attendre dans l’application Claude.** L’application native n’accepte pas d’extensions, Chrome pour Android non plus. Utilisez Firefox ou Vivaldi, sur `claude.ai` dans le navigateur.
- **Une extension non signée dans Firefox.** La version stable de Firefox n’installe que des extensions signées. Chaque nouvelle signature demande aussi une nouvelle `version` dans le manifeste.
- **Le sujet dans le paquet.** Ne l’écrivez jamais dans le code : le paquet part chez Mozilla pour être signé. Gardez-le dans `storage.local`.
- **Un sujet avec des espaces ou une barre oblique.** La page d’options le refuse. Copiez le sujet exactement comme `/narsil movil` l’a affiché.
- **Rien après l’installation.** Rechargez `claude.ai`, comme le dit la dernière étape de l’installation, pour que la page se charge avec les scripts de l’extension.
- **Une bande et pas de niveau.** Le niveau demande le mod sur votre ordinateur avec `/narsil movil` activé, et il se met à jour quand le mod envoie un état (guide 3).

Pour tester d’abord le squelette sur un ordinateur, chargez-le comme module temporaire dans `about:debugging` ([Extension Workshop : tester et déboguer](https://extensionworkshop.com/documentation/develop/debugging/)), ouvrez les options depuis `about:addons`, enregistrez un sujet inventé, et relisez-le avec `browser.storage.local.get('topic')` dans la console de l’extension. Pour un téléphone, `web-ext run --target=firefox-android` l’exécute sur un appareil connecté par USB ([web-ext run](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#web-ext-run)).

## Pour aller plus loin

- Lisez le [guide 2](/fr/mods/claude/conversation-band/) pour la bande, qui n’a besoin de rien venant de l’ordinateur.
- Lisez [Le contexte et les limites](/fr/mods/pet/context-and-limits/) et [L’horloge du cache](/fr/mods/pet/cache-clock/) pour voir comment Narsil affiche les mêmes chiffres dans Claude Code.
- [Narsil Skin](https://github.com/davshn/narsil-skin) est le thème public dont viennent les couleurs de l’extension.
