---
title: Le bloc du menu latéral
description: 'Le bloc sous la recherche du menu latéral de Claude : niveau de Narsil et décompte ntfy tirés de l’état du mod, limites de 5 heures et hebdomadaire de claude.ai chaque minute, et l’avis du cadenas.'
route: android
order: 4
updated: 2026-11-24
sources:
  - repo: android
    path: app/src/main/assets/page/content.js
  - repo: android
    path: app/src/main/assets/page/lib/state.js
  - repo: android
    path: app/src/main/assets/page/lib/live.js
  - repo: android
    path: app/src/main/assets/host.js
  - repo: android
    path: app/src/main/java/io/github/davshn/narsil/StateModel.kt
  - repo: pet
    path: hooks/phone.ts
  - repo: pet
    path: hooks/register.tsx
---

## Ce que ça fait

Ouvrez le menu latéral de Claude dans l’application et, juste sous la recherche, Narsil ajoute un bloc avec trois types de données :

| Quoi                                                                                      | D’où ça vient                       |
| ----------------------------------------------------------------------------------------- | ----------------------------------- |
| **Narsil**, son image, son niveau et son expérience, avec une barre                       | Le mod Narsil, via ntfy.sh          |
| **`5 horas`** et **`Semana`** (5 heures et semaine) : vos deux limites d’utilisation      | `claude.ai` lui-même, chaque minute |
| **`ntfy hoy`** (ntfy aujourd’hui) : les messages ntfy.sh du jour et leur réinitialisation | Le mod Narsil, via ntfy.sh          |

Chaque limite affiche un pourcentage, une barre en vert, ambre ou rouge, et le moment où elle se réinitialise, comme `reinicia en 2 h 05 min` (se réinitialise dans 2 h 05 min). Le niveau se lit comme `Narsil ⭐ Nivel 28` avec `30/2800 XP` à côté.

Le bloc parle aussi quand quelque chose manque. Sans sujet dans les réglages, il dit `Toca y escribe tu topic` (touchez et écrivez votre sujet). Quand l’état du mod est chiffré et que l’application ne peut pas l’ouvrir, il dit `🔒 Toca y pon la clave` (touchez et saisissez la clé). Un toucher sur l’un ou l’autre de ces avis, ou sur Narsil elle-même, ouvre les réglages de l’application.

> **Expérimental.** Le bloc trouve sa place grâce à la structure du menu latéral de Claude, et lit vos limites depuis une adresse interne de la page `claude.ai`, pas depuis une API publique. Une mise à jour de Claude peut casser l’un ou l’autre ; quand cela arrive, le bloc cesse de s’afficher ou perd ses limites, et Claude continue de fonctionner. Il ne fait que lire.

ntfy.sh ne sert qu’à ce que la page ne peut pas savoir. Le niveau et le décompte changent quand le mod envoie un état, c’est-à-dire quand vous écrivez à Claude Code par Remote Control. Quand le décompte a plus d’une heure, le bloc le signale.

## Comment ça marche à l’intérieur

Le bloc est dessiné par `assets/page/content.js`, comme la bande du [guide 3](/fr/android/conversation-band/), et les deux partagent l’observateur de la page de `lib/watch.js`. Les limites sont lues par `content.js` lui-même, depuis la page, avec des règles dans `lib/live.js`. Le niveau et le décompte arrivent du code Kotlin de l’application par le canal du [guide 2](/fr/android/webview-host/), et `lib/state.js` les met en forme.

### Trouver la recherche dans n’importe quelle langue

Le bloc n’est pas trouvé par le mot « Search », qui change avec la langue de la page. Il est trouvé par l’endroit où se trouve la recherche. Depuis `content.js` dans narsil-android (MIT) :

<!-- prettier-ignore -->
```js
  // Under the search, found by where it sits and so in any language: on a phone
  // the sidebar is a sheet with the search in its header; on a wider screen
  // it is the only direct button of the list's first block. The page mounts
  // the sidebar late and again at times: she goes back under it.
  const PHONE_SEARCH = '.df-phone-sheet-header'
  const WIDE_SEARCH = '.dframe-nav-scroll > .shrink-0 > button'
  function place() {
    const search = document.querySelector(PHONE_SEARCH) || document.querySelector(WIDE_SEARCH)
    if (search && search.nextElementSibling !== band) search.after(band)
    drawEvent()
  }

  self.narsilWatch(place)
```

`place` s’exécute à chaque changement que voit l’observateur de la page, au plus une fois par image. Si le bloc n’est pas juste après la recherche, il y va. Les deux sélecteurs sont des noms de classes du balisage actuel de `claude.ai`, et ce sont les lignes les plus fragiles de ce guide : une refonte du menu latéral suffit à perdre le bloc.

### Les limites, depuis `claude.ai` chaque minute

Les limites de 5 heures et hebdomadaire sont celles de votre compte, et `claude.ai` les connaît déjà. Le bloc les lit de la même façon que la bande lit une conversation, avec la session de la page et une requête `GET`. Depuis `lib/live.js` (MIT) :

<!-- prettier-ignore -->
```js
  // The account the page has open is in its cookie.
  function usageUrl(cookie) {
    const org = /(?:^|; )lastActiveOrg=([0-9a-f-]{36})(?:;|$)/.exec(cookie || '')?.[1]
    return org ? `${ORIGIN}/api/organizations/${org}/usage` : null
  }

  function limitOf(label, window, now) {
    if (typeof window?.utilization !== 'number') return null
    const note = window.resets_at ? self.narsilState.resetLabel(Date.parse(window.resets_at) / 1000, now) : ''
    return { label, percent: Math.round(window.utilization), color: self.narsilState.levelColor(window.utilization), note }
  }

  const limitsOf = (usage, now) => [limitOf('5 horas', usage?.five_hour, now), limitOf('Semana', usage?.seven_day, now)].filter(Boolean)
```

1. **Quel compte.** L’identifiant de l’organisation que la page a ouverte se trouve dans le cookie `lastActiveOrg`, un UUID de 36 caractères. Le script le lit depuis `document.cookie` et ne le garde nulle part.
2. **L’utilisation.** Il demande `claude.ai/api/organizations/<id>/usage`, une adresse interne de la page.
3. **Deux fenêtres.** De la réponse, il prend `five_hour` et `seven_day` : `utilization`, déjà en pourcentage, et `resets_at`, une date. Une fenêtre sans `utilization` numérique est laissée de côté.

La réinitialisation est formulée par `resetLabel` dans `lib/state.js` : `reinicia en 45 min`, `reinicia en 2 h 05 min` ou `reinicia en 3 d 4 h`, et `ya se reinició` (déjà réinitialisée) une fois l’heure passée. Les couleurs suivent les seuils partagés de `levelColor` : vert sous 60 %, ambre à partir de 60 %, rouge à partir de 85 %.

`pollUsage` demande une fois au chargement de la page, puis toutes les 60 secondes, et jamais pendant que la page est cachée. Quand la page redevient visible, il demande aussitôt. Si la requête échoue, les dernières limites restent.

### Le niveau et le décompte, depuis le mod via ntfy.sh

Votre niveau et le décompte de ntfy.sh vivent sur votre ordinateur, dans le mod. Le mod les envoie dans son sujet d’état silencieux, votre sujet avec `-estado` (état) à la fin. L’application le suit en Kotlin pendant que la page affiche la bande, garde l’état le plus récent et l’envoie à la page (le [guide 3](/fr/android/conversation-band/) parcourt `StateFeed` et `StateModel`). La page ne voit jamais le sujet.

L’état porte plus de champs que le bloc n’en utilise. `sendStatus` dans `hooks/register.tsx` de narsil-pet le construit avec `xp`, `art`, `at`, `cacheMinutes`, `limits`, `sessions` et `usage`. Le bloc en lit trois, plus `at` :

- **`xp`**, un libellé comme `⭐ Nivel 28 · 30/2800 XP`, écrit par `xpLabel` du mod. `levelOf` dans `lib/state.js` le découpe en nom, en points dans le niveau et en points nécessaires, pour la barre.
- **`art`**, l’adresse de l’image de Narsil à son étape. Elle n’est acceptée que si elle commence par le dossier des assets de narsil-pet sur GitHub. En mode clair, le bloc remplace `-oscuro.png` par `-claro.png`, puisque le mod envoie la variante sombre.
- **`usage`**, une ligne avec la clé `ntfy`, construite par `ntfyRow` du mod dans `hooks/phone.ts` : `{ key: 'ntfy', label: 'ntfy hoy', percent, color, note, resetsAt }`, où `note` se lit comme `24/250 mensajes` (24/250 messages).
- **`at`**, le moment où le mod l’a envoyé, en secondes. Il décide quel état est le plus récent, et quel âge a le décompte.

`limits` et `sessions` sont pour [Narsil Watch](/fr/watch/what-it-is/), qui n’a pas de page `claude.ai` à interroger ; l’application, elle, prend ses limites dans la page. Les deux analyseurs, depuis `lib/state.js` (MIT) :

<!-- prettier-ignore -->
```js
  // "⭐ Nivel 4 · 350/400 XP": the name, and how far into the level.
  function levelOf(xp) {
    const m = /^(.*?)\s*·\s*(\d+)\/(\d+)\s*XP/.exec(xp || '')
    if (!m) return null
    const [into, needed] = [Number(m[2]), Number(m[3])]
    return { name: `Narsil ${m[1]}`, into, needed, percent: Math.round((into / needed) * 100) }
  }

  function ntfyOf(s, now) {
    const row = Array.isArray(s.usage) ? s.usage.find((r) => r.key === 'ntfy') : null
    if (!row) return null
    const isStale = Boolean(s.at) && now - s.at > STALE_SECONDS
    const note = [row.note, row.resetsAt ? resetLabel(row.resetsAt, now) : '', isStale ? `dato de ${ago(s.at, now)}` : ''].filter(Boolean).join(' · ')
    return { label: row.label, percent: Math.round(row.percent), color: row.color, note }
  }
```

Un libellé de niveau qui ne correspond pas au motif donne `null`, et la tête du bloc, image comprise, reste cachée. C’est aussi ce que vous voyez tant que le mod n’a encore jamais envoyé d’état.

### Pourquoi le décompte doit venir de l’ordinateur

ntfy.sh compte les messages par adresse IP. Le mod demande `https://ntfy.sh/v1/account` depuis le réseau de votre ordinateur, pour savoir combien de messages ce réseau a envoyés aujourd’hui, et met la réponse dans son état, en comptant le message sur le point de partir. Si le téléphone demandait, ntfy.sh répondrait au sujet du réseau du téléphone, qui n’envoie rien. Comme l’explique le commentaire de narsil-pet, cette journée commence aussi « at an hour hashed from the IP, not at midnight » (à une heure tirée d’un hachage de l’IP, pas à minuit), ce qui explique pourquoi la ligne affiche sa propre heure de réinitialisation.

### « Plus d’une heure »

Le mod n’envoie un état que pendant que vous écrivez à distance, et se limite à 200 messages par jour. Quand vous revenez au bureau, le dernier état reste, et vieillit. Donc, quand un état a plus d’une heure (`STALE_SECONDS = 3600`), la ligne `ntfy hoy` ajoute une note comme `dato de hace 3 h` (donnée d’il y a 3 h). Le niveau ne reçoit pas de note de ce genre : il change lentement, et un niveau vieux d’une heure reste votre niveau.

### Comment le bloc est dessiné

`renderBand` dans `content.js` construit le bloc à partir du dernier message que l’application a envoyé et des dernières limites. Depuis `content.js` (MIT) :

<!-- prettier-ignore -->
```js
  function renderBand() {
    const now = Date.now() / 1000
    const view = latest?.type === 'model' ? N.viewOf(latest.model, now) : null
    const notes = { sealed: '🔒 Toca y pon la clave' }
    const message = latest?.type === 'no-topic' ? 'Toca y escribe tu topic' : notes[view?.kind]
    notice.hidden = !message
    setText(notice, message || '')
    const level = view?.level
    head.hidden = !level
    if (level) {
      setPet(L.themedArt(view.art, document.documentElement.dataset.mode === 'light'))
      setText(levelName, level.name)
      setText(levelXp, `${level.into}/${level.needed} XP`)
      levelFill.style.width = `${Math.min(100, level.percent)}%`
    }
    meters.replaceChildren(...[...L.limitsOf(limits, now), ...(view?.ntfy ? [view.ntfy] : [])].map(meter))
  }
```

Les jauges sont reconstruites à chaque fois avec `replaceChildren`, à partir d’éléments créés avec `createElement` et remplis avec `textContent`. La tête est mise à jour sur place avec `setText`, qui n’écrit que quand le texte a changé. Cela s’exécute quand un message arrive de l’application, quand de nouvelles limites arrivent, et toutes les 15 secondes pendant que la page est visible, pour que les heures de réinitialisation continuent d’avancer.

### Les avis et les touchers

`viewOf` dans `lib/state.js` choisit l’avis d’après le modèle que l’application a envoyé :

| Le modèle                                             | `viewOf` donne  | Le bloc affiche                               |
| ----------------------------------------------------- | --------------- | --------------------------------------------- |
| `{ type: 'no-topic' }` venant de l’application        | (pas de modèle) | `Toca y escribe tu topic`                     |
| Pas d’état, et le dernier message ne s’est pas ouvert | `sealed`        | `🔒 Toca y pon la clave`                      |
| Pas d’état, rien de scellé                            | `empty`         | Seulement les limites                         |
| Un état                                               | `state`         | Narsil, son niveau, les limites et `ntfy hoy` |

Lisez ensemble la deuxième et la quatrième ligne, car elles cachent un détail : l’avis du cadenas ne s’affiche que quand le modèle n’a **aucun état**. `StateModel.receive` marque le modèle `isSealed` quand un message ne s’ouvre pas, mais garde l’état qu’il avait ; et `viewOf` affiche un état dès qu’il y en a un. Donc, si Narsil était déjà affichée et qu’un nouveau message arrive scellé avec une clé que l’application n’a pas, le bloc continue d’afficher l’ancien niveau, sans cadenas. Vous voyez le cadenas sur une nouvelle installation, ou après avoir changé de sujet.

Deux touchers ouvrent les réglages, par deux chemins :

- **L’avis** est un `<button>`. Son gestionnaire de clic envoie `{ type: 'settings' }` sur le port de la bande ; `host.js` l’enveloppe en `{ kind: 'port', message }`, et `MainActivity` ouvre `SettingsActivity` quand le type intérieur est `settings`.
- **L’image ou le niveau de Narsil.** `host.js` écoute les clics sur tout le document, pendant la phase de capture, et envoie `{ kind: 'settings' }` quand la cible est à l’intérieur de `#narsil-band .narsil-head`. Le commit `9e514dd` explique pourquoi les deux existent : « The launcher shortcut is not shown by every launcher, and the band's notice only shows without a topic. » (tous les lanceurs n’affichent pas le raccourci, et l’avis de la bande ne s’affiche que sans sujet).

### Ce que pourrait faire une personne qui lit votre sujet

Sans clé, quiconque connaît votre sujet peut aussi publier sur `<topic>-estado`. Rien de ce qui en vient n’est donc pris pour du balisage : chaque valeur entre avec `textContent`, et une image n’est affichée que si son adresse commence par le dossier des assets propres de narsil-pet. Le commentaire du code dans `lib/state.js` le dit : « its text only ever goes in as text, and an image only comes from Narsil's own assets. » (son texte n’entre jamais que comme texte, et une image ne vient que des assets propres de Narsil). Un faux état pourrait afficher un mauvais niveau ou un mauvais décompte. Il ne peut pas ajouter un lien, un script ou une image venue d’ailleurs. Il pourrait aussi porter un `at` très loin dans le futur : chaque vrai état perdrait alors face à lui et, comme l’application enregistre le modèle par sujet, le fait que ntfy.sh oublie le message après 12 heures n’aiderait pas. Changer de sujet repart d’un modèle vide, tout comme effacer les données de l’application. Le [guide 7](/fr/android/encryption-and-settings/) explique comment la clé réduit ce risque, et jusqu’où.

## Le construire avec Claude

Demandez à Claude un bloc après le bouton de recherche du menu latéral, alimenté de deux côtés : la requête d’utilisation propre de la page, et l’état que l’application envoie. La seule idée qu’il doit bien saisir, c’est que la page ne détient jamais le sujet, et que rien de ce qui vient de ntfy.sh n’est digne de confiance.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans le script de page que ma WebView Android exécute sur `https://claude.ai`, ajoute un bloc juste après le bouton de recherche du menu latéral, trouvé par sa position (`.df-phone-sheet-header`, sinon `.dframe-nav-scroll > .shrink-0 > button`) et non par son texte, et remets-le en place chaque fois que l’observateur de la page voit qu’il a bougé. Toutes les 60 secondes pendant que la page est visible, lis l’identifiant de l’organisation dans le cookie `lastActiveOrg` et fais un `GET /api/organizations/<id>/usage` avec `credentials: 'include'` ; affiche `five_hour` et `seven_day` comme `5 horas` et `Semana`, avec le pourcentage, une barre colorée (vert, ambre à partir de 60, rouge à partir de 85) et l’heure de réinitialisation. À partir du message que l’application envoie, affiche le libellé `xp` découpé en niveau et en points, une image seulement depuis `https://raw.githubusercontent.com/davshn/narsil-pet/main/assets/`, et la ligne `usage` de clé `ntfy`, avec « dato de hace N h » quand `at` a plus d’une heure. Affiche un avis qu’on peut toucher quand l’application dit qu’il n’y a pas de sujet. Utilise uniquement `textContent`. Garde l’analyse dans un module sans DOM et teste-la.

### Ce qu’il faut vérifier dans la réponse de Claude

1. La recherche est trouvée par sa position, pas par son texte.
2. L’identifiant de l’organisation est lu dans le cookie à chaque fois et n’est gardé nulle part.
3. Les limites sont demandées toutes les 60 secondes, jamais tant que `document.hidden` est vrai, et aussitôt quand la page se montre de nouveau.
4. Le libellé du niveau est analysé avec un motif, et un libellé qui ne correspond pas cache la tête au lieu d’afficher n’importe quoi.
5. Une adresse d’image doit commencer par l’unique préfixe fixe.
6. Tout entre avec `textContent` ou sous forme d’éléments créés, jamais en HTML.
7. Le sujet n’apparaît jamais dans le script de page.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « avec Claude en espagnol, le bloc n’apparaît pas ».

### Comment l’auteur l’a demandé

Les mots de l’auteur ou de l’autrice consignés pour cette application demandent l’apparence et la bande de l’extension dans une vue web (L1 : « que dentro en un web view muestre la web de claude y modifique sus estilos como lo hace esta extension », que dans une vue web elle affiche le site de Claude et en modifie les styles comme le fait cette extension), donc le bloc est venu sans changement. Une demande plus tardive n’est consignée que par son commit :

- `9e514dd` (2026-11-24) « feat: open the settings from Narsil in the band and from the service's notification » (ouvrir les réglages depuis Narsil dans la bande et depuis la notification du service). Son message est cité plus haut.

Le journal de tâches consigne la vérification sur le vrai téléphone, avec le vrai sujet et la vraie clé, le 2026-11-24 à 00:44 : « the band showed Narsil Nivel 28, 30/2800 XP, ntfy's count and her etapa4 art. Settings open from Narsil in the band and from the service's notification. » (le bloc a affiché Narsil Nivel 28, 30/2800 XP, le décompte de ntfy et son dessin etapa4. Les réglages s’ouvrent depuis Narsil dans le bloc et depuis la notification du service).

Le reste est reconstitué à partir de l’historique des commits (un nom de projet dans un sujet de commit est remplacé par une description entre crochets) :

- `3bcea35` (2026-11-24) « feat: build the script that hosts [the earlier extension] in a WebView, and what alerts and states keep » (construire le script qui héberge [l’ancienne extension] dans une WebView, et ce que gardent les alertes et les états).
- `53c55c1` (2026-11-24) « feat: host claude.ai with [the earlier extension] in a WebView, and show Narsil's alerts from a foreground service » (héberger claude.ai avec [l’ancienne extension] dans une WebView, et afficher les alertes de Narsil depuis un service de premier plan).
- `ca01cc7` (2026-11-24) « docs: log the band verified with a signed-in session » (consigner la bande vérifiée avec une session connectée).
- `a275382` (2026-11-24) « docs: log the alerts and the band verified with the real topic and key » (consigner les alertes et la bande vérifiées avec le vrai sujet et la vraie clé).

Côté mod, le commit `6400a6f` (2026-11-23) de narsil-pet, « feat(phone): publish Claude limits and open conversations for the watch » (publier les limites de Claude et les conversations ouvertes pour la montre), a ajouté les champs `limits` et `sessions` que le bloc laisse à la montre.

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide (MIT). Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

Les limites sous forme de module pur, sur le modèle de `lib/live.js`, avec un test. Enregistrez-le sous le nom `limits.js`.

```js
const colorOf = (percent) => (percent >= 85 ? '#F0435A' : percent >= 60 ? '#F5B400' : '#22B573')

export function usageUrl(cookie) {
  const org = /(?:^|; )lastActiveOrg=([0-9a-f-]{36})(?:;|$)/.exec(cookie || '')?.[1]
  return org ? `https://claude.ai/api/organizations/${org}/usage` : null
}

export function resetNote(resetsAt, now) {
  const left = Math.max(0, Math.round((resetsAt - now) / 60))
  if (left === 0) return 'ya se reinició'
  if (left < 60) return `reinicia en ${left} min`
  return `reinicia en ${Math.floor(left / 60)} h ${String(left % 60).padStart(2, '0')} min`
}

export function limitsOf(usage, now) {
  const rows = [
    ['5 horas', usage?.five_hour],
    ['Semana', usage?.seven_day],
  ]
  return rows
    .filter(([, window]) => typeof window?.utilization === 'number')
    .map(([label, window]) => ({
      label,
      percent: Math.round(window.utilization),
      color: colorOf(window.utilization),
      note: window.resets_at ? resetNote(Date.parse(window.resets_at) / 1000, now) : '',
    }))
}
```

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { limitsOf, usageUrl } from './limits.js'

test('the organization comes from the cookie, or there is no request', () => {
  const org = '00000000-0000-4000-8000-000000000000'
  assert.equal(
    usageUrl(`theme=dark; lastActiveOrg=${org}`),
    `https://claude.ai/api/organizations/${org}/usage`,
  )
  assert.equal(usageUrl('theme=dark'), null)
})

test('a window without a number is left out', () => {
  const now = Date.parse('2026-11-24T10:00:00Z') / 1000
  const usage = {
    five_hour: { utilization: 72.4, resets_at: '2026-11-24T12:05:00Z' },
    seven_day: null,
  }
  assert.deepEqual(limitsOf(usage, now), [
    { label: '5 horas', percent: 72, color: '#F5B400', note: 'reinicia en 2 h 05 min' },
  ])
})
```

Le vrai `minutesLabel` formule aussi les jours (`3 d 4 h`), dont la limite hebdomadaire a besoin ; celui-ci s’arrête aux heures pour rester court.

## Erreurs fréquentes et comment tester

- **Trouver la recherche par son texte.** Le libellé change avec la langue de la page. Trouvez-la par sa position.
- **Placer le bloc une seule fois.** La page monte le menu latéral tard, et le remonte parfois. Remettez le bloc en place à chaque passage de l’observateur.
- **Demander les limites pendant que la page est cachée.** Un téléphone dans une poche demanderait toutes les minutes pour rien.
- **Garder l’identifiant de l’organisation.** Il est dans le cookie quand vous en avez besoin ; il n’y a aucune raison de le stocker.
- **Demander le décompte à ntfy.sh depuis le téléphone.** La réponse porte sur le réseau du téléphone. Le décompte doit venir de l’ordinateur.
- **Un décompte qui ne bouge jamais.** Le mod n’envoie son état que pendant que vous écrivez par Remote Control. Au bureau, le bloc garde le dernier et indique son âge.
- **Attendre le cadenas après un changement de clé.** Si un état était déjà affiché, un message que la clé ne peut pas ouvrir le laisse en place. Levez le doute en envoyant `/narsil movil prueba` après avoir réglé la clé : un nouvel état qui s’ouvre remplace l’ancien.

Pour tester l’analyse sur l’ordinateur, lancez le module ci-dessus avec `node --test`, et lisez `levelOf`, `ntfyOf` et `viewOf` dans `lib/state.js` avec un état inventé. Sur le téléphone, mettez un sujet inventé comme `narsil-0000000000example0` dans les réglages, puis publiez depuis l’ordinateur un état sur son sujet `-estado` ([ntfy : publier](https://docs.ntfy.sh/publish/)) :

```bash
curl -d '{"xp":"⭐ Nivel 2 · 40/200 XP","at":1700000000,"usage":[{"key":"ntfy","label":"ntfy hoy","percent":10,"color":"#22B573","note":"25/250 mensajes"}]}' https://ntfy.sh/narsil-0000000000example0-estado
```

Ouvrez le menu latéral : en une seconde, il devrait afficher `Narsil ⭐ Nivel 2` avec `40/200 XP`, et une ligne `ntfy hoy` à 10 % avec `25/250 mensajes` et une note `dato de hace …`, puisque ce `at` est passé depuis longtemps. Les limites devraient être là aussi, venues de `claude.ai`. Touchez Narsil : les réglages devraient s’ouvrir. Remettez votre vrai sujet quand vous avez terminé.

### Là où le code et le README diffèrent

- Le README dit que si la clé n’est pas celle qui a scellé les messages, la bande dit « 🔒 Toca y pon la clave ». Le code ne l’affiche que quand l’application n’a encore aucun état pour le sujet ; avec un état antérieur gardé, le bloc continue de l’afficher, comme expliqué plus haut.
- Le README place le toucher des réglages sur « The band in Claude's side menu » (la bande dans le menu latéral de Claude). Dans le code, cet élément est bien `#narsil-band` ; la bande au-dessus de la zone de message est `#narsil-event`, et un toucher sur elle ne fait que déplier son texte.

## Pour aller plus loin

- Le [guide 5](/fr/android/colors-and-mode/) habille toute la page aux couleurs de Narsil, et le bloc avec elle.
- Le [guide 7](/fr/android/encryption-and-settings/) explique le cadenas, la clé et les réglages que le bloc ouvre.
- Côté mod, [Les alertes sur votre téléphone et votre montre](/fr/mods/pet/phone-and-watch/) décrit les champs de `-estado`, la limite quotidienne de 200 et `ntfyRow`.
- [Narsil Watch](/fr/watch/what-it-is/) lit le même état, y compris les champs `limits` et `sessions` que le bloc laisse de côté.
- Le code source est sur [github.com/davshn/narsil-android](https://github.com/davshn/narsil-android).
