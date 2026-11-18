---
title: Une source, deux paquets Android
description: 'Comment Narsil dans Claude livre une seule source en deux paquets : un .xpi signé non listé pour Firefox pour Android, et un dossier Manifest V3 pour Vivaldi qui remet ses styles au rechargement.'
route: claude
order: 5
updated: 2026-11-18
---

## Ce que ça fait

Narsil dans Claude est écrite une seule fois, dans un seul dossier, et arrive sur le téléphone sous deux formes :

| Navigateur           | Paquet                                      | Comment il arrive sur le téléphone                                   |
| -------------------- | ------------------------------------------- | -------------------------------------------------------------------- |
| Firefox pour Android | Le dossier tel quel, Manifest V2            | Signé par Mozilla comme `.xpi` non listé, installé depuis un fichier |
| Vivaldi pour Android | Une copie avec un Manifest V3 qui en dérive | Copié sur le téléphone par USB, chargé non empaqueté, non signé      |

Elle demande **Firefox 142 ou ultérieur** ou **Vivaldi 8.2 ou ultérieur**, comme le dit le README. Chrome pour Android n’accepte aucune extension, donc Vivaldi est le navigateur Chromium qui la fait tourner.

Le paquet Vivaldi fait aussi une chose dont le paquet Firefox n’a pas besoin : quand Vivaldi recharge l’extension, ou qu’Android ferme Vivaldi et qu’il se rouvre, la page peut perdre les styles ou les scripts de l’extension. Le paquet Chromium le remarque, et les remet sans recharger la page.

> **Expérimental.** L’extension s’appuie sur la structure de la page `claude.ai`, pas sur une API publique, donc une mise à jour de Claude peut la casser. Charger une extension non empaquetée dans Vivaldi sur Android est une fonction pour développeurs, et les navigateurs peuvent changer son fonctionnement. L’extension ne fait que lire `claude.ai` : elle n’écrit jamais dans votre compte et n’envoie vos conversations nulle part, mais elle charge les dessins de Narsil depuis GitHub et lit son sujet d’état sur ntfy.sh. La signature pour Firefox demande vos propres identifiants d’API sur addons.mozilla.org ; ce guide n’en montre que des valeurs fictives.

## Comment ça marche à l’intérieur

### La source : une extension Firefox

Le dossier `extension/` est une extension Firefox complète : du JavaScript simple, sans étape de build, sans bibliothèques. Son `manifest.json` est en **Manifest V2**, avec une page d’arrière-plan (`"persistent": true`) qui charge `background.js` et ses modules ([MDN : background](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background)).

Firefox lit une clé dont aucun autre navigateur n’a besoin, `browser_specific_settings` ([MDN : browser_specific_settings](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings)) :

- **`gecko.id`**, l’identifiant de l’extension, sous la forme d’une adresse e-mail. Chaque nouvelle version signée garde le même identifiant, donc Firefox la traite comme la même extension.
- **`gecko.strict_min_version`** et **`gecko_android.strict_min_version`**, tous deux à `142.0`. Un Firefox plus ancien n’installe pas l’extension. La première version demandait 121 ; le commit `40be528` a porté les deux à 142 quand il a ajouté la clé suivante. Son message ne dit pas pourquoi.
- **`gecko.data_collection_permissions`**, avec `required` à `none` : l’extension déclare qu’elle ne collecte et ne transmet aucune donnée. MDN indique que cette clé est obligatoire pour les nouvelles extensions soumises à addons.mozilla.org à partir du 3 novembre 2025.

### Firefox : signer en non listé

Firefox pour Android n’installe que des extensions signées par Mozilla. Signer ne veut pas dire publier : le canal **unlisted** (non listé) signe l’extension « for self-distribution » (pour l’autodistribution), selon les mots de la référence de `web-ext`, et elle n’apparaît jamais sur la boutique de modules ([Extension Workshop : web-ext sign](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#web-ext-sign)).

La signature se fait avec l’outil `web-ext` de Mozilla, lancé comme `web-ext sign --channel=unlisted`. Deux fichiers lui disent quoi faire :

- **`web-ext-config.mjs`**, à la racine, que `web-ext` trouve tout seul ([Extension Workshop : premiers pas avec web-ext](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/)). Il fixe deux options : le dossier source est `./extension` et le dossier des artefacts est `./dist`. Seul le dossier de l’extension est donc empaqueté, jamais les tests ni les scripts, et le `.xpi` signé arrive dans `dist/`, que git ignore.
- **`scripts/sign.ps1`**, que lance `npm run sign`. Le commit `40be528` (2026-11-09) « build: sign the extension as unlisted with Mozilla » (signer l’extension comme non listée auprès de Mozilla) explique son rôle : il « asks for the API credentials and keeps them only in its own process » (demande les identifiants d’API et ne les garde que dans son propre processus).

Les identifiants sont le **JWT issuer** (émetteur JWT) et le **JWT secret** (secret JWT) que vous générez sur [addons.mozilla.org](https://addons.mozilla.org/developers/addon/api/key/). `web-ext` les lit depuis `--api-key` et `--api-secret`, ou depuis les variables d’environnement `WEB_EXT_API_KEY` et `WEB_EXT_API_SECRET`. Le script demande les deux quand il s’exécute, le secret en saisie masquée, les place dans ces deux variables pour son seul processus, lance `web-ext`, et les supprime à la fin, même si la signature échoue. Ils ne vont jamais dans un fichier, dans l’historique du shell ni dans le dépôt.

Mozilla signe chaque version une seule fois, donc chaque nouvelle signature demande une nouvelle `version` dans `manifest.json`.

### Firefox : installer le fichier signé

Le `.xpi` est un zip signé du dossier de l’extension. Pour l’installer, copiez-le sur le téléphone et utilisez le menu caché de Firefox : **Settings → About Firefox**, touchez le logo cinq fois, puis revenez dans **Settings** et utilisez l’option pour installer une extension depuis un fichier. Le [guide 1](/fr/mods/claude/what-it-is/) liste les étapes.

Pendant le développement, il existe un chemin plus rapide qui ne demande aucune signature : `npm run phone` lance `web-ext run --target=firefox-android` avec le téléphone branché en USB. Firefox charge le dossier comme extension temporaire et la recharge à chaque changement, tant que la commande tourne ([Extension Workshop : web-ext run](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#web-ext-run)). `npm run lint` lance `web-ext lint`, qui vérifie le manifeste et le code avant que vous ne signiez.

### Vivaldi : le paquet Chromium

Vivaldi est un navigateur Chromium, et depuis la version 8.2 sa version Android charge des extensions Chrome depuis un dossier du téléphone, sans boutique ni signature. Le commit `11dadb3` (2026-11-10) « feat: run the extension in Vivaldi for Android as a Chromium package » (faire tourner l’extension dans Vivaldi pour Android sous forme de paquet Chromium) a ajouté le second paquet.

Ce n’est pas une seconde copie du code. `scripts/chromium.mjs` copie `extension/` dans `dist/chromium` et écrit deux fichiers dans la copie :

1. **Un `manifest.json` en Manifest V3**, dérivé de celui de Firefox.
2. **`background-worker.js`**, un service worker d’une ligne qui charge, avec `importScripts()`, les mêmes scripts d’arrière-plan que la page d’arrière-plan de Firefox.

Le manifeste dérivé change ce qu’exige Manifest V3 ([Chrome : migrer vers Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate)) :

| Firefox, Manifest V2                                       | Vivaldi, Manifest V3                                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `manifest_version: 2`                                      | `manifest_version: 3`                                                                |
| `browser_specific_settings`                                | Supprimé : propre à Firefox                                                          |
| Une page d’arrière-plan avec `scripts`                     | `background.service_worker`, le worker d’une ligne                                   |
| Des adresses dans `permissions` (`https://ntfy.sh/*`)      | Déplacées vers `host_permissions`, avec `https://claude.ai/*` en plus                |
| `storage`                                                  | `storage` et `scripting`                                                             |
| `web_accessible_resources` sous forme de liste de fichiers | Une liste d’objets, chacun avec ses `resources` et les pages qui peuvent les charger |
| Les content scripts tels quels                             | Les mêmes, avec `lib/browser.js` chargé en premier dans chaque groupe                |

Tout le reste, les content scripts, la page d’options, les icônes, passe sans changement.

### Un seul code pour deux API

Firefox appelle l’API d’extension `browser` ; Chromium l’appelle `chrome`. En Manifest V3, les deux répondent avec des promesses, donc le code n’a besoin que d’un nom. `lib/browser.js`, qui n’existe que pour être chargé en premier dans le paquet Chromium, fait de `browser` un alias de `chrome`. Le reste du code dit `browser` partout.

L’arrière-plan a demandé un vrai changement. Un service worker n’a pas d’`EventSource`, donc l’arrière-plan suit le flux de ntfy.sh avec `fetch` et un lecteur de flux à la place, dans les deux navigateurs. Et Chromium arrête un service worker inactif après 30 secondes ([Chrome : le cycle de vie du service worker d’extension](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)), donc le bloc du menu latéral lui envoie un mot toutes les 25 secondes tant qu’il est affiché. Le [guide 3](/fr/mods/claude/sidebar/) couvre les deux.

### Vivaldi : le charger depuis `Download/narsil-chromium`

`npm run phone:chromium` construit le paquet et, avec `--push`, le copie sur le téléphone avec `adb` d’Android : il supprime `Download/narsil-chromium` sur le téléphone et y pousse le nouveau dossier. Avec plus d’un appareil branché, la variable d’environnement `ANDROID_SERIAL` en choisit un. Le téléphone doit avoir le débogage USB activé.

Ensuite, dans Vivaldi :

1. Ouvrez `vivaldi://extensions` et activez **Developer mode**.
2. Touchez **Load unpacked**, allez dans **Download → narsil-chromium**, touchez **Use this folder**, puis **Allow**.
3. Ouvrez les options de l’extension et écrivez votre sujet, et la clé si vous en avez une.
4. Ouvrez `claude.ai` et rechargez-le.

Le dossier reste sur le téléphone : Vivaldi y charge l’extension à chaque fois.

### Quand Vivaldi recharge l’extension

C’est là que les deux navigateurs diffèrent le plus. Quand l’extension disparaît alors que `claude.ai` est ouvert, parce que Vivaldi la recharge ou la met à jour ou qu’Android la décharge, Chromium retire ses styles de la page et ne remet jamais ses scripts. Pendant ce temps, l’ancien content script restait sur la page, sans son extension, et plaçait la bande sans ses styles. Firefox remet tout de lui-même.

Trois corrections, en une semaine, permettent au paquet Chromium de se remettre en place.

**1. Les anciens scripts s’arrêtent** (`1d9db3d`, 2026-11-11, et `6b24ccb`, 2026-11-17). L’observateur de la page que partagent tous les content scripts, dans `lib/watch.js`, vérifie à chaque passage si son extension existe toujours : une fois qu’elle a disparu, `browser.runtime.id` est vide ou lève une erreur. L’observateur s’arrête alors, et chaque script qui l’utilisait s’arrête avec lui : minuteurs effacés, bande retirée. Une copie plus récente des scripts arrête aussi l’ancienne, en déclenchant un événement sur le document de la page, la seule chose que deux copies partagent. `1d9db3d` charge aussi `lib/watch.js` dans les deux groupes de content scripts, puisque Vivaldi n’exécutait parfois que le second groupe, et que la bande demandait un observateur qui n’existait pas encore.

**2. L’arrière-plan remet les scripts** (`6b24ccb`). Chaque fois que l’arrière-plan démarre, `lib/restore.js` demande à chaque onglet `claude.ai` ouvert si ses scripts répondent encore. Le content script répond à un message qui lui est propre par `true`. Un onglet qui ne répond pas reçoit de nouveau les groupes de content scripts du manifeste, dans l’ordre, chaque feuille de style avec `scripting.insertCSS` et chaque groupe de scripts avec `scripting.executeScript` ([Chrome : chrome.scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting)). Cela demande l’autorisation `scripting` et l’accès aux pages de l’hôte, ce qui explique pourquoi le manifeste Chromium ajoute les deux. Un onglet qu’il ne peut pas atteindre, supprimé de la mémoire ou encore en chargement, les reçoit de toute façon à son prochain chargement.

**3. La page demande ce qui lui manque** (`a1e01b6` et `8e31a1d`, 2026-11-18). Après qu’Android a fermé Vivaldi et qu’il s’est rouvert, Vivaldi peut exécuter les content scripts sans les feuilles de style, ou sauter tout le premier groupe. Les scripts qui se sont exécutés répondent encore, donc l’étape 2 saute l’onglet. La page se vérifie donc elle-même : chaque feuille de style pose une marque sur `:root`, et la bande vérifie les marques et si le premier groupe a laissé sa fonction de mode sur la page (le [guide 4](/fr/mods/claude/colors-and-icon/) décrit les deux). Ce qui manque, elle le demande à l’arrière-plan. L’arrière-plan n’accepte que des feuilles de style et des numéros de groupe de son propre manifeste, jamais un fichier arbitraire, et ne les insère que dans cet onglet et ce cadre.

Dans Firefox, rien de tout cela ne s’exécute : son manifeste ne demande pas l’autorisation `scripting`, donc `browser.scripting` n’y existe pas, et le code de restauration rend la main aussitôt.

### Mettre à jour et désinstaller

**Dans Firefox**, changez `version` dans `manifest.json`, signez de nouveau, et installez le nouveau `.xpi` de la même façon. Le manifeste ne déclare aucune adresse de mise à jour, donc Firefox ne cherche pas de nouvelles versions de lui-même. **Dans Vivaldi**, relancez `npm run phone:chromium` et touchez **Update** dans `vivaldi://extensions`, comme le dit le README.

Pour désinstaller depuis Firefox, ouvrez le menu, allez dans **Extensions**, choisissez **Narsil en Claude** et supprimez-la. Depuis Vivaldi, supprimez-la dans `vivaldi://extensions` ; le dossier `Download/narsil-chromium` peut ensuite être effacé. Dans les deux cas, le sujet et la clé enregistrés dans le stockage de l’extension partent avec elle, et Claude retrouve ses propres couleurs. L’icône de l’écran d’accueil reste (le [guide 4](/fr/mods/claude/colors-and-icon/) explique pourquoi).

Si vous ne signez plus rien, révoquez les identifiants d’API sur la même page d’addons.mozilla.org où vous les avez créés.

## Le construire avec Claude

Demandez à Claude un script Node qui dérive un paquet Manifest V3 pour Vivaldi à partir de votre extension Firefox, et une étape de restauration dans l’arrière-plan. L’idée que Claude doit bien saisir : il n’y a qu’une seule source ; le paquet Chromium est une copie avec un manifeste dérivé, et non une seconde version du code.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Mon extension Firefox vit dans `extension/` avec un `manifest.json` en Manifest V2. Écris un script Node, sans dépendances, qui copie le dossier dans `dist/chromium` et y écrit un `manifest.json` en Manifest V3 : retire `browser_specific_settings`, déplace les motifs d’URL de `permissions` vers `host_permissions` et ajoute-leur les `matches` des content scripts, ajoute l’autorisation `scripting`, transforme les scripts d’arrière-plan en un service worker d’une ligne qui appelle `importScripts()` avec eux, place un fichier qui fait `self.browser = self.chrome` en premier dans chaque groupe de content scripts, et convertis `web_accessible_resources` à la forme objet de V3. Exporte la conversion du manifeste comme fonction et teste-la avec `node --test`. Ensuite, dans l’arrière-plan, au démarrage, envoie un ping à chaque onglet correspondant avec `tabs.sendMessage` ; là où rien ne répond, insère de nouveau le CSS et le JS des content scripts du manifeste avec `scripting.insertCSS` et `scripting.executeScript`. N’utilise que des API documentées sur MDN et developer.chrome.com.

### Ce qu’il faut vérifier dans la réponse de Claude

1. Le manifeste dérivé retire `browser_specific_settings`, déplace les motifs d’URL de `permissions` vers `host_permissions`, leur ajoute les `matches` des content scripts, et ajoute `scripting`.
2. L’arrière-plan devient un service worker d’une ligne qui charge les mêmes scripts d’arrière-plan avec `importScripts()`, et un fichier qui fait `self.browser = self.chrome` vient en premier dans chaque groupe de content scripts.
3. La restauration envoie un ping à chaque onglet correspondant avec `tabs.sendMessage` et n’insère de nouveau le CSS et le JS que là où rien ne répond, et uniquement des fichiers du manifeste de l’extension elle-même.
4. La conversion du manifeste est exportée comme fonction et testée avec `node --test` sur un petit objet Manifest V2.
5. Si vous demandez aussi la signature à Claude, le canal est `unlisted`, et les identifiants AMO sont saisis au moment de signer, jamais écrits dans le dépôt ni dans une ligne de commande.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « après avoir touché Update dans Vivaldi, la bande revient sans ses couleurs ».

### Comment l’auteur l’a demandé

Aucune demande pour l’empaquetage n’a été consignée. Les mots de l’auteur ou de l’autrice consignés pour ce parcours portent sur le site (le [guide 1](/fr/mods/claude/what-it-is/) les cite). Ce qui suit est reconstitué à partir de l’historique des commits de l’extension :

- `40be528` (2026-11-09) « build: sign the extension as unlisted with Mozilla » (signer l’extension comme non listée auprès de Mozilla). Le même jour que la première version, pour qu’elle puisse tout simplement s’installer dans Firefox pour Android.
- `11dadb3` (2026-11-10) « feat: run the extension in Vivaldi for Android as a Chromium package » (faire tourner l’extension dans Vivaldi pour Android sous forme de paquet Chromium). Son message décrit le Manifest V3 dérivé, le service worker qui charge les mêmes scripts d’arrière-plan, `lib/browser.js`, et le passage d’`EventSource` à `fetch` ; et il dit « The Firefox manifest stays V2 » (le manifeste Firefox reste en V2).
- `1d9db3d` (2026-11-11) « fix: load the page observer with the band and stop when the extension goes away » (charger l’observateur de la page avec la bande et s’arrêter quand l’extension disparaît).
- `6b24ccb` (2026-11-17) « fix: restore the styles and the band when Vivaldi brings the extension back » (rétablir les styles et la bande quand Vivaldi ramène l’extension).
- `a1e01b6` (2026-11-18) « fix: ask for the styles when Vivaldi loads the band without them » (demander les styles quand Vivaldi charge la bande sans eux).
- `8e31a1d` (2026-11-18) « fix: run the light and dark switch again when Vivaldi skips it » (relancer le passage clair-sombre quand Vivaldi le saute).

Le second navigateur a pris un jour à ajouter et une semaine à stabiliser : chaque correction après `11dadb3` répond à une façon dont Vivaldi sur Android ne chargeait l’extension qu’en partie, découverte à l’usage.

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide. Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

Trois morceaux, écrits pour ce guide (MIT) : la conversion, la restauration au démarrage et la signature.

`build-chromium.mjs`, lancé avec `node build-chromium.mjs` :

```js
import fs from 'node:fs'

const source = JSON.parse(fs.readFileSync('extension/manifest.json', 'utf8'))
const isAddress = (permission) => permission.includes('://')
const pages = source.content_scripts.flatMap((group) => group.matches)

const target = {
  manifest_version: 3,
  name: source.name,
  version: source.version,
  icons: source.icons,
  options_ui: source.options_ui,
  permissions: [...source.permissions.filter((p) => !isAddress(p)), 'scripting'],
  host_permissions: [...new Set([...source.permissions.filter(isAddress), ...pages])],
  background: { service_worker: 'worker.js' },
  content_scripts: source.content_scripts.map((group) => ({
    ...group,
    js: ['shim.js', ...(group.js ?? [])],
  })),
}

fs.rmSync('dist/chromium', { recursive: true, force: true })
fs.cpSync('extension', 'dist/chromium', { recursive: true })
fs.writeFileSync('dist/chromium/manifest.json', JSON.stringify(target, null, 2))
fs.writeFileSync('dist/chromium/shim.js', 'self.browser = self.chrome\n')
const scripts = ['shim.js', ...source.background.scripts].map((file) => `'${file}'`)
fs.writeFileSync('dist/chromium/worker.js', `importScripts(${scripts.join(', ')})\n`)
```

À la fin du script d’arrière-plan, la restauration au démarrage :

```js
async function restoreOpenPages() {
  if (!browser.scripting) return
  const groups = browser.runtime.getManifest().content_scripts ?? []
  const tabs = await browser.tabs.query({ url: groups.flatMap((group) => group.matches) })
  for (const tab of tabs) {
    const alive = await browser.tabs.sendMessage(tab.id, 'ping').catch(() => false)
    if (alive === true) continue
    const target = { tabId: tab.id }
    for (const group of groups) {
      if (group.css) await browser.scripting.insertCSS({ target, files: group.css }).catch(() => {})
      if (group.js)
        await browser.scripting.executeScript({ target, files: group.js }).catch(() => {})
    }
  }
}

restoreOpenPages()
```

Et dans un content script, la réponse :

```js
browser.runtime.onMessage.addListener((message, _sender, reply) => {
  if (message === 'ping') reply(true)
})
```

Pour la signature, un `web-ext-config.mjs` à la racine :

```js
export default {
  sourceDir: './extension',
  artifactsDir: './dist',
}
```

Ensuite, dans un shell sur votre ordinateur, avec `dist/` dans votre `.gitignore` :

```sh
read -r -p 'JWT issuer: ' WEB_EXT_API_KEY
read -r -s -p 'JWT secret: ' WEB_EXT_API_SECRET
export WEB_EXT_API_KEY WEB_EXT_API_SECRET
npx web-ext sign --channel=unlisted
unset WEB_EXT_API_KEY WEB_EXT_API_SECRET
```

L’émetteur ressemble à `user:00000000:000` et le secret à `EXAMPLE-not-a-real-secret` ; ces deux-là sont des valeurs fictives, jamais de vraies valeurs. Les saisir à une invite les garde hors de l’historique du shell, ce que ne ferait pas une ligne de commande qui contiendrait les valeurs. Si vous préférez les garder dans un fichier, gardez-le hors du dépôt ou dans un fichier ignoré par git sur votre ordinateur, jamais dans un commit.

## Erreurs fréquentes et comment tester

- **Mettre les identifiants AMO dans le dépôt.** Quiconque a l’émetteur et le secret peut signer sous votre compte. Saisissez-les au moment de signer, ou gardez-les dans un fichier ignoré par git. Si l’un d’eux arrive un jour dans un commit, révoquez-les aussitôt sur [addons.mozilla.org](https://addons.mozilla.org/developers/addon/api/key/) et générez-en de nouveaux ; supprimer le commit ne suffit pas.
- **Signer sans changer la version.** Mozilla signe chaque version une seule fois. Changez d’abord `version`.
- **Choisir le canal `listed`.** Cela soumet l’extension à la boutique publique. Pour votre propre téléphone, utilisez `unlisted`.
- **Oublier `gecko.id`.** Pour une extension Manifest V2 qui n’en a pas, `web-ext` génère un identifiant et l’enregistre dans `.web-extension-id` ; perdez ce fichier et la signature suivante est une autre extension. Fixez l’identifiant dans le manifeste.
- **Garder une page d’arrière-plan en Manifest V3.** Chromium veut un service worker, qui n’a ni DOM ni `EventSource`.
- **Laisser des motifs d’URL dans `permissions`.** En Manifest V3, ils vont dans `host_permissions`.
- **S’attendre à ce que Chromium remette les scripts.** Quand l’extension se recharge, les pages ouvertes perdent leurs styles et ne reçoivent pas de nouveaux scripts. Interrogez chaque onglet, et injectez de nouveau là où rien ne répond.
- **D’anciens scripts qui continuent de tourner.** Un content script resté sans son extension s’exécute encore. Vérifiez `browser.runtime.id`, et arrêtez-vous quand il a disparu.
- **Injecter tout ce qu’une page demande.** Le message d’une page n’est pas digne de confiance. N’injectez que des fichiers de votre propre manifeste.

Pour tester le paquet Firefox avant de signer, lancez `web-ext lint` et `web-ext run --target=firefox-android` avec le téléphone branché. Pour tester la conversion, exportez-la comme fonction et vérifiez un petit objet Manifest V2 : ses motifs d’URL doivent finir dans `host_permissions`, `scripting` doit être ajouté, et chaque groupe de content scripts doit commencer par le shim. Pour tester la restauration, chargez le paquet Chromium dans Vivaldi, ouvrez `claude.ai`, puis touchez **Update** dans `vivaldi://extensions` et revenez à l’onglet sans le recharger : les couleurs et la bande doivent revenir en un instant.

## Pour aller plus loin

- Le [guide 1](/fr/mods/claude/what-it-is/) liste les parties de l’extension et ce que chacune lit sur le réseau.
- Le paquet Firefox pourrait se mettre à jour tout seul : une `update_url` dans `browser_specific_settings` qui pointe vers un fichier à vous permet à Firefox de trouver les nouvelles versions signées ([Extension Workshop : mettre à jour votre extension](https://extensionworkshop.com/documentation/manage/updating-your-extension/)).
- Le même paquet Chromium pourrait se charger dans Chrome sur un ordinateur, comme extension non empaquetée, pour tester la bande sur un écran plus large.
