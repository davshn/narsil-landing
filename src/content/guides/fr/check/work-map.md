---
title: La carte du travail
description: 'Comment Narsil Check dessine une carte animée et en direct de ce que fait Claude, avec bébé Narsil au centre, sans jamais faire attendre un outil ni montrer ce que vous avez écrit.'
route: check
order: 2
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/map/hooks.ts
  - repo: check
    path: hooks/map/board.ts
  - repo: check
    path: hooks/map/classify.ts
  - repo: check
    path: hooks/map/draw.ts
  - repo: check
    path: hooks/map/stations.ts
  - repo: check
    path: hooks/map/words.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: tests/map-pane.test.tsx
  - repo: check
    path: odd/tasks/work-map.md
---

## Ce que ça fait

La première section du panneau est **Mapa mental** (« Carte mentale ») : une image en direct de ce que Claude est en train de faire dans la session. Bébé Narsil se tient au centre, dans sa version claire ou sombre selon le thème de l’app. Autour, dix stations, une par type de travail :

| Station       | En français | Ce qui y arrive                                                     |
| ------------- | ----------- | ------------------------------------------------------------------- |
| **Tú**        | Vous        | Vos messages, et chaque réponse prête                               |
| **Modelo**    | Modèle      | Chaque étape du modèle, et un changement de modèle                  |
| **Memoria**   | Mémoire     | Les fichiers du dossier de mémoire de Claude Code                   |
| **Archivos**  | Fichiers    | Read, Write, Edit, Grep, Glob et les commandes de fichiers          |
| **Terminal**  | Terminal    | Commandes shell, PowerShell et moniteurs                            |
| **Red**       | Réseau      | Téléchargements et recherches web, et commandes qui vont en ligne   |
| **Navegador** | Navigateur  | Les outils du navigateur                                            |
| **Agentes**   | Agents      | Sous-agents, workflows et travail en arrière-plan                   |
| **Skills**    | Skills      | Skills, commandes slash et recherches d’outils                      |
| **Hooks**     | Hooks       | Hooks de configuration qui refusent, demandent ou prennent du temps |

Chaque appel d’outil part de Narsil comme une impulsion vers sa station. La station s’allume pendant qu’elle travaille et affiche combien de fois elle a servi. Autour de cela, la carte montre :

- **Des rayons** qui s’épaississent avec l’usage, et **un trajet** qui relie les dernières stations visitées et s’estompe avec le temps.
- **Deux aiguilles** autour d’une station dont l’appel dure longtemps.
- **Un point rouge** sur une station après une erreur ou un refus d’un hook, jusqu’à votre message suivant.
- **Un anneau** autour de Narsil qui se remplit avec le contexte utilisé : ambre à 70 % et rouge à 90 %. En dessous, le modèle et le pourcentage.
- **Les sous-agents** encore au travail, qui tournent autour d’**Agentes**.
- **Une tâche en arrière-plan** (une commande, un moniteur ou un agent lancé à part) qui reste allumée jusqu’à ce qu’elle signale sa fin. Si elle ne l’a pas signalé au bout d’une heure, elle est fermée à la fin d’un tour.

Le point de la section est bleu quand quelque chose travaille, rouge si quelque chose a échoué et vert au repos. Dans le terminal, qui ne dessine pas de SVG, la section n’apparaît pas.

La carte vient de [lot-map](https://github.com/alexeyw/lot-map), d’Aleksei Volodin (licence MIT), adaptée aux couleurs de Narsil. Narsil Check le crédite dans son README et garde l’avis de copyright et de permission de lot-map dans `hooks/map/LICENSE-lot-map.txt`.

## Comment ça marche à l’intérieur

La carte vit dans `hooks/map/`, en quatre parties : `classify.ts` décide vers quelle station va un appel, `board.ts` garde ce qui s’est passé, `hooks.ts` écoute les événements et `draw.ts` transforme le tableau en un SVG. `hooks/register.tsx` ajoute la section au panneau.

### Chaque appel va vers une station, par son nom seulement

`classify(tool, input, setup)` lit le nom de l’outil et son entrée, et renvoie une station et une étiquette. La plupart des outils sont un cas direct : `Read`, `Write` et `Edit` vont vers **Archivos**, `WebFetch` vers **Red**, `Agent` vers **Agentes**, `Skill` vers **Skills**. Un fichier sous `.claude/projects/<projet>/memory/` va vers **Memoria**.

Les commandes shell demandent plus de travail, car l’outil est toujours `Bash` mais le travail ne l’est pas. `classifyShell` lit le premier mot de la commande, voit à travers les enveloppes (`sudo`, `env`, `timeout`, `nohup` et consorts lancent une autre commande, et c’est elle qui compte), puis décide : `cat`, `grep` ou `mv` travaillent sur des fichiers, `curl`, `ssh` ou `gh` vont sur le réseau, et certains programmes n’y vont qu’avec certaines sous-commandes (`git push` oui, `git status` non ; `npm install` oui, `npm test` non).

L’étiquette est ce que la carte affiche à côté de la station, et elle ne porte que des noms :

- d’un fichier, les deux dernières parties de son chemin (`src/app.ts`),
- d’une page web, l’hôte seul, jamais le chemin, la requête ni un identifiant (`hostOf` lit `user:pa/ss@host` comme `host`),
- d’une commande, sa `description`, sinon son nom,
- d’une recherche web, les mots `búsqueda web`, jamais la requête.

`clean` retire aussi de chaque étiquette les caractères de contrôle et les marques de direction, pour qu’un nom de fichier ne puisse ni déplacer le curseur ni inverser le texte. Un test porte le nom de cette règle : « labels never carry what was written, searched or a password » (« les étiquettes ne portent jamais ce qui a été écrit, cherché, ni un mot de passe »).

### Le tableau : un atom, et une copie pour dessiner

Ce que la carte affiche est un `MapBoard` (dans `types/index.d.ts`) : une liste d’entrées, un compte par station, le modèle et l’étape, le pourcentage de contexte, les erreurs par station et les sous-agents encore au travail. Chaque entrée a une station, une étiquette, un début et une fin, et un état : `run`, `ok`, `err` ou `block`.

Le tableau est un atom de la session, `board`, écrit par quatre petites fonctions de `board.ts` : `begin` ouvre une entrée, `finish` la ferme, `background` la garde ouverte sous l’id d’une tâche, et `settle` la ferme quand cette tâche se signale. Le tableau garde les 80 entrées les plus récentes, plus jusqu’à 16 tâches en arrière-plan plus anciennes encore en cours.

Le panneau ne lit pas `board`. Il lit `mapView`, une copie faite au plus toutes les 400 ms :

```ts
async function redraw($: EngineInterface): Promise<void> {
  if (isRedrawPending) return
  isRedrawPending = true
  try {
    await $.clock.sleep(REDRAW_MS)
  } catch {
    // No clock: copy now.
  } finally {
    isRedrawPending = false
  }
  const current = await read($, board)
  await update($, shown, () => current)
}
```

Pourquoi ? Chaque redessin envoie le SVG entier à l’app, avec les deux images de Narsil. Une rafale de vingt appels ferait vingt redessins. Avec la copie, la première écriture lance une attente de 400 ms, le reste de la rafale ne change que `board`, et une seule copie à la fin les dessine tous. Le test « a burst of calls is one redraw of the map, made once the wait is over » le vérifie.

### La carte ne fait jamais attendre un outil

C’est la règle sur laquelle la revue a insisté. La carte écoute `tool.call`, qui enveloppe chaque outil. Si elle attendait ses propres écritures avant d’appeler `next(e)`, chaque outil attendrait la carte. L’entrée est donc écrite à côté de l’appel, pas avant :

```ts
export async function mapToolCall($, e, next) {
  const started = quietly(async () => {
    const seen = classify(e.tool, e, SETUP)
    return begin($, { ...seen, from: e.agentId === undefined ? 'core' : 'agents' })
  })
  const close = (how) => {
    void started.then(how).catch(() => undefined)
  }
  try {
    const ran = await next(e)
    // ...refused, failed, sent to the background, or ok
    close((id) => finish($, id, ran.isError === true ? 'err' : 'ok'))
    return ran
  } catch (failure) {
    close((id) => finish($, id, 'err'))
    throw failure
  }
}
```

`next(e)` démarre tout de suite. L’entrée est fermée quand l’appel et l’écriture sont terminés, et cette fermeture n’est pas attendue non plus. `quietly` enveloppe chaque écriture : tout ce qui échoue sur la carte renvoie `undefined` et n’atteint jamais l’outil, le tour ni la conversation. Chaque hook transmet son événement sans le changer, donc la carte ne modifie jamais une entrée, un résultat ni une décision de permission.

Il en va de même pour `classic.PreToolUse` : la décision des hooks de configuration est renvoyée dès qu’elle est prise, et la carte écrit son entrée après. Une vérification de moins de 400 ms n’est pas dessinée.

### Trois événements partagés avec le reste du panneau

Le moteur refuse un second `on()` du même événement sans filtre dans un même module. Narsil Check écoutait déjà `turn.start`, `tool.call` et `turn.complete`. La carte exporte donc ces trois-là comme des fonctions, `mapTurnStart`, `mapToolCall` et `mapTurnComplete`, et `register.tsx` appelle chacune à la place de `next(e)` :

```tsx
on('tool.call', async ($, e, next) => {
  // ...what the pane already tracked
  return mapToolCall($, e, next)
})
```

Tous les autres événements dont la carte a besoin (`turn.step`, `classic.PreToolUse`, `prompt.submit`, `skill.prompt`, `session.compact`, et les hooks de configuration qui ajoutent du contexte) s’enregistrent dans `registerMap(on)`, que `register` appelle en premier.

### Erreurs, tours et tâches en arrière-plan

- Un **nouveau message** de votre part efface les erreurs : les points rouges concernent le chemin vers la dernière réponse.
- Un **tour interrompu** arrive sur **Tú** et n’est la faute de rien. Il ferme aussi les appels qui ne se sont jamais signalés, pour qu’ils ne battent pas le reste de la session.
- Un appel dont la réponse lance un **travail en arrière-plan** (`backgroundTaskId`, ou un agent avec `status: 'async_launched'`) reste ouvert sous l’id de cette tâche. `taskNotice` lit la notification de la tâche pour son id et son état uniquement, jamais son résumé ni sa sortie, et `settle` ferme l’entrée.
- Un **sous-agent** rejoint la liste `agents` avec son premier appel et la quitte quand arrive son propre `turn.complete`.

### Le dessin : un SVG, avec bébé Narsil au centre

`drawMap(board, now, narsil)` renvoie une chaîne SVG. Son animation est du SMIL dans le SVG (`<animate>` avec des débuts relatifs à `now`), donc le dessin bouge entre deux redessins sans aide du mod. Il est dessiné avec la palette sombre, et une règle `prefers-color-scheme: light` dans le SVG repeint chaque couleur : la carte suit le thème de l’app toute seule, comme le faisait l’image de Narsil.

L’élément `Svg` accepte au plus 131072 caractères, et les deux images de Narsil en prennent environ 88 Ko. `drawMap` mesure la longueur : si les images faisaient dépasser la limite, il redessine la carte avec `NARSIL` écrit au centre. La carte s’affiche toujours. Le test « the map at its fullest, with baby Narsil, stays within what Svg accepts » dessine le tableau le plus plein possible.

Pour qui ne peut pas la voir, `describeMap` fournit le texte `alt` : la section, ce qui tourne et le contexte, par exemple `Mapa mental. Archivos: src/app.ts · contexto 13%`.

Dans le panneau, la section n’est dessinée que si la surface a `Svg` et n’est pas le terminal. Elle s’ouvre au début de chaque session, et `resetMap()` oublie les refus et le dernier modèle de la session précédente.

## Le construire avec Claude

Demandez à Claude une carte du travail de la session sous forme de section du panneau. Les deux idées qu’il doit réussir sont que la carte ne fait jamais attendre un outil, et qu’elle montre des noms, jamais du contenu.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon mod Claude Code `my-panel`, ajoute une première section, `Map`, qui dessine ce que Claude fait dans cette session sous la forme d’un seul SVG : un noyau au centre et des stations autour (toi, modèle, mémoire, fichiers, shell, réseau, navigateur, agents, skills, hooks). Classe chaque `tool.call` dans une station avec une étiquette qui ne porte que des noms : les deux dernières parties du chemin d’un fichier, l’hôte d’une URL, la description d’une commande. Garde le tableau dans un atom de la session (des entrées avec station, étiquette, début, fin et état `run`, `ok`, `err` ou `block`, un compte par station, des erreurs par station) et fais lire au panneau une copie faite au plus toutes les 400 ms. L’outil ne doit jamais attendre la carte : lance `next(e)` tout de suite, écris l’entrée à côté et enveloppe chaque écriture pour qu’une erreur n’atteigne jamais l’outil. Anime avec du SMIL dans le SVG, suis le thème de l’app avec une règle `prefers-color-scheme`, garde le SVG sous 131072 caractères et laisse la section de côté dans le terminal. Teste qu’un appel n’attend pas le tableau, qu’une rafale d’appels donne un seul redessin et qu’aucune étiquette ne contient une requête, un chemin de plus de deux parties ou un mot de passe.

### Ce qu’il faut vérifier dans la réponse de Claude

1. `next(e)` est appelé avant d’attendre l’écriture de la carte, et aucune écriture de la carte n’est attendue sur le chemin de l’outil.
2. Chaque écriture de la carte est enveloppée pour avaler les erreurs, et chaque hook renvoie le résultat de son événement sans le changer.
3. Les étiquettes sont des noms : deux parties de chemin, un hôte, une description. Pas de requêtes de recherche, de chemins de pages ni de texte de commande.
4. Le panneau lit une copie limitée du tableau, pas le tableau lui-même.
5. La longueur du SVG est comparée à la limite de `Svg`, avec une solution de repli plus petite.
6. La section n’apparaît pas là où `Svg` manque ou quand la surface est le terminal.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « avec la carte active, une lecture de fichier lente a ralenti tous les appels » ou « la carte a affiché ma recherche entière à côté de Red ».

### Comment l’auteur l’a demandé

Le journal de la tâche, `odd/tasks/work-map.md` dans narsil-check, cite les demandes mot pour mot. Elles étaient en espagnol ; une traduction suit chacune.

L’auteur a d’abord montré lot-map à Claude :

> "mira este mod, quisiera traer la funcionalidad aca, como lo ves? https://github.com/alexeyw/lot-map"

(« Regarde ce mod, j’aimerais apporter sa fonctionnalité ici, qu’en penses-tu ? ») Claude a proposé des parties que Narsil avait déjà, et l’auteur a resserré :

> "lo que propones traer ya lo tengo en narsilPet, me interesa traer es el mapa animado"

(« Ce que tu proposes d’apporter, je l’ai déjà dans narsilPet ; ce qui m’intéresse, c’est la carte animée. ») Puis le plan a été accepté, avec la place de la section :

> "sí, avanza con ese plan, la seccion mapa va a ir de primeras, quita la imagen de narsil bebe y ponlo ahi, ya que es la misma imagen que ira creo que sera un buen reemplazo"

(« Oui, avance avec ce plan. La section carte passe en premier ; retire l’image de bébé Narsil et mets-la là, puisque c’est la même image qui ira là, je pense que ce sera un bon remplacement. »)

Une revue de la première version a laissé cinq avertissements : le panneau redessinait le SVG entier à chaque écriture, l’outil attendait la carte, un chemin mort pour le mouvement réduit, des chemins d’erreur et de tâche non testés, et des entrées en arrière-plan qui n’expiraient jamais. La réponse de l’auteur a été « Sí, corrígelos » (« Oui, corrige-les »). Les commits de la branche de la fonctionnalité montrent l’ordre :

- `bcae0da` "feat(map): classify Claude's work into the work map's stations".
- `e8b29dd` "feat(map): add the animated work map as the pane's first section".
- `4ee05ed` "fix(map): keep the work map off the tool's path and its redraws bounded".
- `1c6677c` "feat(map): larger, higher-contrast work map named Mapa mental".

Le commit de correction, `4ee05ed`, est le plus instructif. La première version fonctionnait et ses tests passaient. La revue a demandé ce que la carte coûte au reste de la session, et la réponse a été une copie limitée et un outil qui n’attend jamais.

Après avoir essayé la version 1.12.0, l’auteur a demandé une carte plus lisible :

> "las esferas deberian ser mas grandes al igual que el texto, o tener mas contraste ya que no se ve claramente lo que dice, narsil bebe tambien podria ser algo mas grande"

(« Les sphères devraient être plus grandes, tout comme le texte, ou avoir plus de contraste, car on ne voit pas clairement ce qui est écrit ; bébé Narsil pourrait aussi être un peu plus grande. ») Puis : "y al mapa ponle mapa mental" (« et appelle la carte carte mentale »). C’est `1c6677c` : des stations, des noms et des comptes plus grands, des couleurs d’étiquettes plus contrastées dans chaque thème, une bébé Narsil plus grande sur un bleu doux, et la section renommée **Mapa mental**.

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide. Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

C’est une version réduite de `hooks/map/board.ts` et `hooks/map/hooks.ts` dans [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later), qui adaptent [lot-map](https://github.com/alexeyw/lot-map) (MIT, Copyright © 2026 Aleksei Volodin). Elle est vérifiée avec les types de Claude Code 2.1.325 (`atom`, `read`, `update`, `$.clock.now`, `$.clock.sleep`, le hook `tool.call`). Elle garde une seule règle de station et laisse de côté le dessin, les erreurs et les tâches en arrière-plan.

```ts
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

type Status = 'run' | 'ok' | 'err' | 'block'
type Entry = {
  id: string
  station: string
  label: string
  startedAt: number
  endedAt?: number
  status: Status
}
type Board = { entries: Entry[]; counts: Record<string, number> }

const EMPTY: Board = { entries: [], counts: {} }
const board = atom({ plugin: 'my-panel', key: 'board' } as const, EMPTY, { shape: 'board-1' })
const shown = atom({ plugin: 'my-panel', key: 'mapView' } as const, EMPTY, { shape: 'board-1' })

async function quietly<T>(work: () => Promise<T>): Promise<T | undefined> {
  try {
    return await work()
  } catch {
    return undefined
  }
}

let isRedrawPending = false
async function redraw($: EngineInterface): Promise<void> {
  if (isRedrawPending) return
  isRedrawPending = true
  try {
    await $.clock.sleep(400)
  } catch {
    // No clock: copy now.
  } finally {
    isRedrawPending = false
  }
  const current = await read($, board)
  await update($, shown, () => current)
}

async function write($: EngineInterface, by: (b: Board) => Board): Promise<void> {
  await update($, board, by)
  void redraw($).catch(() => undefined)
}

const lastTwo = (path: string): string =>
  path.replace(/\\/g, '/').split('/').filter(Boolean).slice(-2).join('/')

function classify(
  tool: string,
  input: Record<string, unknown>,
): { station: string; label: string } {
  const path = typeof input.file_path === 'string' ? input.file_path : ''
  if (tool === 'Read' || tool === 'Write' || tool === 'Edit')
    return { station: 'files', label: lastTwo(path) || tool }
  if (tool === 'WebSearch') return { station: 'web', label: 'web search' }
  return { station: 'model', label: tool }
}

export const register: Register = (on) => {
  on('tool.call', async ($, e, next) => {
    const started = quietly(async () => {
      const now = await $.clock.now()
      const entry: Entry = {
        id: `${now}-${Math.random()}`,
        ...classify(e.tool, e as Record<string, unknown>),
        startedAt: now,
        status: 'run',
      }
      await write($, (b) => ({
        entries: [...b.entries, entry].slice(-80),
        counts: { ...b.counts, [entry.station]: (b.counts[entry.station] ?? 0) + 1 },
      }))
      return entry.id
    })
    const close = (status: Status): void => {
      void started
        .then((id) =>
          quietly(async () => {
            const now = await $.clock.now()
            await write($, (b) => ({
              ...b,
              entries: b.entries.map((x) => (x.id === id ? { ...x, status, endedAt: now } : x)),
            }))
          }),
        )
        .catch(() => undefined)
    }
    try {
      const ran = await next(e)
      close(ran.deny !== undefined ? 'block' : ran.isError === true ? 'err' : 'ok')
      return ran
    } catch (failure) {
      close('err')
      throw failure
    }
  })
}
```

Le panneau lit `shown` avec `read($, shown)` et le dessine avec `Svg` seulement quand la surface en a un et n’est pas le terminal.

## Erreurs fréquentes et comment tester

Elles viennent du code de Narsil Check, de sa revue et de ses tests :

- **Attendre la carte avant l’outil.** Chaque appel ralentit. Lancez `next(e)` d’abord et écrivez à côté.
- **Laisser s’échapper une erreur de la carte.** Une écriture ratée ferait échouer l’outil. Enveloppez chaque écriture.
- **Redessiner à chaque écriture.** Une rafale d’appels devient une rafale de gros SVG. Limitez une copie.
- **Montrer du contenu.** Une recherche, le chemin d’une URL ou une ligne de commande peuvent contenir des secrets. Gardez les noms seulement, et nettoyez les caractères de contrôle.
- **Des appels qui ne se ferment jamais.** Un tour interrompu ou une notification perdue laissent une entrée qui bat pour toujours. Fermez-les à la fin du tour, et faites expirer les vieilles tâches en arrière-plan.
- **Enregistrer un événement deux fois dans un module.** Le moteur le refuse. Appelez la fonction de la carte depuis le hook existant.
- **Oublier la limite de `Svg`.** Les images intégrées pèsent lourd. Mesurez, et prévoyez un repli.

Pour tester, `claude plugin test .` lance les tests du mod. `tests/map.test.tsx` couvre les parties pures : « every kind of call lands on its station », « a command behind a wrapper or inside another is the command it runs » et « labels never carry what was written, searched or a password ». `tests/map-pane.test.tsx` pilote les hooks : « a tool never waits on the map », « a burst of calls is one redraw of the map, made once the wait is over », « a refused call turns the map red with a dot on its station, and the next message clears it » et « a background task that never reports back is closed at the end of a turn once it is an hour old ». Dans `tests/pane.test.tsx`, « the work map is the first section, open, with baby Narsil at its core; the terminal draws neither » vérifie la place de la section.

## Pour aller plus loin

- Laissez chacun nommer ses propres serveurs ou commandes de mémoire : `hooks/map/stations.ts` garde la configuration de lot-map, avec toutes les listes vides.
- Portez le fil de lignes de lot-map, une liste texte des dernières actions, pour le terminal, où le SVG n’est pas dessiné.
- Ajoutez un zoom ou un filtre par station, que lot-map possède et que cette adaptation a laissé de côté.
