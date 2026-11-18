---
title: L’expérience et la croissance
description: 'Comment Narsil gagne de l’expérience avec les tours terminés, les tests réussis et les sous-agents terminés, monte de niveau, traverse cinq étapes et fête cela, avec une XP gardée.'
route: pet
order: 13
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/xp.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/sprite.ts
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: hooks/phone.ts
  - repo: pet
    path: types/index.d.ts
  - repo: pet
    path: odd/tasks/animated-poses.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Ce que ça fait

Narsil grandit avec le travail qu’elle observe. Chaque tour terminé, chaque exécution de tests réussie et chaque sous-agent qui se termine bien lui donnent des points d’expérience (XP). Avec assez d’XP, elle atteint un nouveau niveau, et à certains niveaux elle passe à une nouvelle étape de sa vie : d’un nouveau-né à un serpent de mer adulte.

De votre côté, trois choses le montrent :

- **Un libellé de niveau** à côté de son nom, dans la bande et dans la fenêtre flottante : « ⭐ Nivel 3 · 120/300 XP » (« niveau 3, 120 des 300 XP dont ce niveau a besoin »).
- **Une célébration** quand elle monte de niveau : une lueur dorée, des anneaux, des étoiles et une bannière « NIVEL 3 » sur son image, et le commentaire de la bande dit « ¡He subido al nivel 3! ⭐ » (« j’ai atteint le niveau 3 ! »). Une nouvelle étape est fêtée autrement : un éclair, des rayons de lumière, une bannière « ¡ETAPA 2! » et « ¡He crecido! » (« j’ai grandi ! »).
- **Son apparence.** Chacune des cinq étapes a ses propres dessins, et elle bouge différemment : le nouveau-né rebondit, léger et vif, le serpent adulte se déplace lentement et lourdement.

`/narsil nivel` vous dit où elle en est, l’étape, et comment elle gagne de l’XP.

L’XP est un seul nombre pour toute la machine. Elle survit à la fermeture de Claude Code, et chaque conversation ouverte s’ajoute au même total. C’est une petite boucle de récompense sans aucun effet sur le travail de Claude : elle ne change que l’apparence de Narsil.

## Comment ça marche à l’intérieur

### Les règles : `hooks/xp.ts`

Toute l’arithmétique se trouve dans `hooks/xp.ts`, sous forme de fonctions pures sur de simples nombres. Le fichier le dit dans son premier commentaire : « the hooks module owns the store and the events » (le module de hooks possède le store et les événements). Cette séparation rend les règles faciles à tester sans moteur.

Les gains tiennent dans une table, `XP_GAIN` :

| Raison  | XP  | Quand                                                   |
| ------- | --- | ------------------------------------------------------- |
| `turn`  | 10  | un tour de la conversation principale répond            |
| `tests` | 5   | une commande de tests s’exécute sans erreur             |
| `agent` | 3   | le tour propre d’un sous-agent se termine avec `answer` |

Les niveaux deviennent plus difficiles de façon linéaire. `levelOf` commence au niveau 1 et soustrait `level * 100` tant qu’il le peut : le niveau 1 demande 100 XP pour atteindre le niveau 2, le niveau 2 en demande 200 de plus, le niveau 3 en demande 300 de plus, et ainsi de suite. Il renvoie le niveau, l’XP accumulée dans ce niveau (`into`) et l’XP dont ce niveau a besoin (`needed`), ce qui est exactement ce qu’affiche le libellé.

Les étapes sont une seconde table, `STAGE_FROM = [1, 5, 10, 20, 35]` : le premier niveau de chaque étape. `stageOf(level)` compte combien de ces niveaux ont été atteints. Ainsi :

| Étape          | Niveaux       | XP totale pour y arriver |
| -------------- | ------------- | ------------------------ |
| 1 (nouveau-né) | 1 à 4         | 0                        |
| 2              | 5 à 9         | 1 000                    |
| 3              | 10 à 19       | 4 500                    |
| 4              | 20 à 34       | 19 000                   |
| 5              | 35 et au-delà | 59 500                   |

Les totaux découlent de la règle : atteindre le niveau L demande 100 × (1 + 2 + … + (L − 1)) XP. À 10 XP par tour, le nouveau-né passe à l’étape 2 après une centaine de tours terminés environ, et l’étape 5 est encore loin. Le README énonce les mêmes règles en espagnol.

`xpOf` lit une valeur stockée « from any version, or none » (de n’importe quelle version, ou aucune) : tout ce qui n’est pas un nombre fini positif compte comme 0, et une fraction est arrondie à l’entier inférieur. Un store abîmé ou absent fait donc repartir Narsil de zéro au lieu de casser la bande.

### D’où vient l’XP

`gainXp($, reason)` dans `hooks/register.tsx` est appelé depuis quatre endroits, répartis sur trois événements :

- **`turn.complete`**, conversation principale, quand le tour se termine avec `answer`. Deux branches l’appellent : la fin normale (« He terminado ») et une fin qui pose une question dans la boîte d’étape suivante de l’application de bureau. Un tour qui se termine alors qu’un travail d’arrière-plan tourne encore ne gagne pas encore d’XP : c’est le tour qui réveille la session quand ce travail rend compte qui se termine, et qui la gagne. Un tour que vous arrêtez (`aborted`) ou qui échoue ne gagne rien.
- **`tool.call`**, quand la commande correspond à `TEST_COMMAND` (dans `hooks/words.ts` : `npm test`, `pnpm test`, `vitest`, `pytest`, `cargo test`, `claude plugin test` et d’autres) et que le résultat n’a pas de `isError`. Cette vérification ne regarde pas `e.agentId`, si bien que les tests réussis d’un sous-agent comptent aussi.
- **`endAgent`**, appelé depuis `turn.complete` quand `e.agentId` est défini et que la raison du sous-agent est `answer`.

Le test `passing tests and finished subagents earn experience; failures and stopped turns do not` dans `tests/narsil.test.tsx` fixe tout cela.

### Pourquoi elle vit dans `$.store`, et pourquoi elle est relue

Narsil garde deux copies de l’XP :

- **`$.store`**, sous la clé `xp`. Les types décrivent le store comme « This plugin's own key-value store, kept between sessions and hot reloads » (le store clé-valeur propre à ce plugin, conservé entre les sessions et les rechargements à chaud), un fichier JSON propre au plugin sous le répertoire de configuration de Claude Code. C’est ce qui permet à l’XP de survivre à une session.
- **L’atome `xp`** (`$.state`), que la bande et la fenêtre flottante lisent pendant qu’elles dessinent, si bien qu’un changement les redessine.

Au `session.start`, Narsil copie la valeur stockée dans l’atome. Ensuite, chaque gain fait ceci :

```tsx
const before = xpOf(await $.store.get(XP_KEY).catch(() => read($, xp)))
const after = before + XP_GAIN[reason]
await $.store.set(XP_KEY, after).catch(() => undefined)
await update($, xp, () => after)
```

Le commentaire au-dessus donne la raison de lire d’abord le store au lieu de se fier à l’atome : « another open conversation may have added to it since » (une autre conversation ouverte a pu y ajouter depuis). Le store est partagé par toutes les conversations du plugin, alors que chaque conversation a son propre atome. Ajouter à l’atome écraserait les gains qu’une autre fenêtre a faits depuis le démarrage de celle-ci. Le test `another conversation’s experience is added to, never overwritten` met le store à 50 dans le dos de la conversation et attend 60 après un tour.

Relire réduit la fenêtre pendant laquelle des gains peuvent se perdre ; ce n’est pas un verrou. Deux conversations qui gagnent de l’XP au même instant peuvent encore lire toutes les deux le même `before`.

Si le store échoue, le gain atteint quand même l’atome (`.catch(() => read($, xp))` et `.catch(() => undefined)`), si bien que la bande continue de compter pendant cette session.

### Les célébrations : l’atome `milestone`

Quand `after` franchit un niveau, `gainXp` compare les étapes avant et après et écrit l’atome `milestone` : `{ kind: 'level' | 'grew', level, stage, at }`. Son type, `(Milestone & { at: number }) | null`, est déclaré dans `types/index.d.ts`. Il fait aussi ceci :

- il écrit une ligne de journal avec `$.ui.log` : « 🌊 Narsil ha crecido: nivel 5, etapa 2 de 5. » ou « ⭐ Narsil ha subido al nivel 3. » ;
- il remplace son commentaire dans la bande via `setMood`, en gardant son humeur et son détail actuels.

Le dessin lit le jalon. `sprite(mood, stage, milestone)` dans `hooks/sprite.ts` ajoute :

- pour un niveau, `behind` dessine une lueur radiale dorée, et `celebration` dessine deux anneaux qui s’élargissent, sept étoiles et une bannière `NIVEL <n>` ;
- pour une étape, un éclair blanc, cinq étincelles, douze rayons de lumière et une bannière `¡ETAPA <n>!`, avec l’image enveloppée dans une animation `evolve` qui la fait passer de la moitié de sa taille à sa nouvelle forme.

Pendant qu’un jalon s’affiche, le petit badge d’état près de sa tête est omis, pour que les deux ne se disputent pas le même espace.

Le battement (`beat`, toutes les 2 secondes) efface le jalon une fois `MILESTONE_MS` écoulé : 6 secondes pour un niveau, 9 pour une étape. Un minuteur par célébration aurait été plus simple à écrire, mais le battement existe déjà, et un minuteur `$.clock` est perdu lors d’un rechargement du mod.

Dans la bande, la célébration n’est dessinée que lorsque la conversation que montre Narsil est celle-ci (`isOwnTop`) : quand une autre conversation est plus importante, l’image lui appartient.

### Ce que change l’étape

`stageOf(levelOf(xp).level)` est calculé partout où une image est produite :

- **Le dessin.** `art` dans `hooks/sprite.ts` choisit la pose dessinée pour cette étape et ce thème, en se rabattant sur la pose de base de l’étape, puis sur une étape antérieure, quand l’une manque. Les boucles animées de chaque étape viennent de la tâche consignée dans `odd/tasks/animated-poses.md` ; le deuxième guide de ce parcours traite du dessin.
- **Le mouvement.** `STAGE_MOTION` règle l’amplitude et la vitesse de ses mouvements : amplitude 1.15 et tempo 0.9 pour le nouveau-né, jusqu’à 0.6 et 1.4 pour l’étape 5.
- **Tout ce qui est hors de la bande.** La fenêtre du conseil reçoit `NARSIL_STAGE` ; les alertes du téléphone utilisent `phoneIcon(kind, stage)`, un PNG d’elle à cette étape tiré du dépôt ; le sujet `-estado` envoie le libellé `xp` et l’URL `art` (guide 15).

## Le construire avec Claude

Demandez à Claude un système d’expérience : des points pour les tours terminés, les tests réussis et les sous-agents terminés, puis des niveaux, des étapes et une courte célébration. L’idée que Claude doit bien saisir : le total vit dans `$.store`, que toutes les conversations partagent, donc chaque gain relit le store avant d’ajouter.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon mod Claude Code `my-pet`, donne de l’expérience à la mascotte. Mets les règles dans un module pur `hooks/xp.ts` : 10 XP par tour terminé de la conversation principale (`turn.complete` avec `reason === 'answer'` et sans `agentId`), 5 quand une commande de tests (`npm test`, `pnpm test`, `vitest`, `pytest`) revient sans `isError` dans `tool.call`, 3 quand le `turn.complete` d’un sous-agent se termine avec `answer`. Le niveau 1 demande 100 XP, chaque niveau suivant 100 de plus que le précédent ; les étapes commencent aux niveaux 1, 5, 10, 20 et 35. Garde le total dans `$.store` sous `xp` pour qu’il survive aux sessions, et avant chaque gain relis le store, puisque d’autres conversations y ajoutent. Reflète-le dans un atome pour le dessin. À un nouveau niveau, écris un atome `milestone` avec l’heure, affiche « Level N » dans la bande `AbovePrompt` pendant 6 secondes (9 pour une nouvelle étape) et journalise-le avec `$.ui.log`. Teste avec `claude-code/testing` : un tour à 95 XP affiche le niveau 2, et un store modifié dans le dos de la conversation est complété, pas écrasé.

### Ce qu’il faut vérifier dans la réponse de Claude

1. Les règles sont dans un module pur (`hooks/xp.ts`) avec les nombres demandés : 10, 5 et 3 XP, chaque niveau coûtant 100 XP de plus que le précédent, et des étapes à partir des niveaux 1, 5, 10, 20 et 35.
2. Un gain lit le store, ajoute, écrit le store, puis met à jour l’atome. Il ne réécrit jamais la valeur de l’atome dans le store.
3. Seul un tour qui se termine par `answer` rapporte de l’XP, et les tests n’en rapportent que sans `isError` ; un tour interrompu ne rapporte rien.
4. Une valeur stockée qui n’est pas un nombre positif compte comme 0 au lieu de casser la bande.
5. Un jalon porte son heure, et la célébration se termine au bout de 6 secondes pour un niveau et de 9 pour une étape.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « avec deux conversations ouvertes, l’XP gagnée par l’une disparaît quand l’autre termine un tour » ou « la bannière de niveau ne part jamais ».

### Comment l’auteur l’a demandé

La demande d’origine pour l’expérience et les niveaux n’a pas été consignée. Les journaux de tâches publics du projet commencent plus tard.

Une demande ultérieure touche aux étapes : dans `odd/tasks/animated-poses.md`, L4 (2026-11-15), après la première boucle animée, l’auteur ou l’autrice a répondu :

> "si me agrada, vamos a cambiar todos"

Traduction en français : oui, ça me plaît, changeons-les toutes. Le journal de tâches en fait S6 : chaque pose « at every stage 1-5, light and dark: 60 loops » (à chaque étape 1-5, clair et sombre : 60 boucles).

#### Reconstitution à partir de l’historique des commits

À partir de `git log -- hooks/xp.ts` et des commits liés :

- `8913cdd` (2026-10-30) « feat: let Narsil earn experience and levels kept across sessions » (permettre à Narsil de gagner de l’expérience et des niveaux conservés d’une session à l’autre). L’XP, les niveaux et le store arrivent ensemble.
- `9bfa039` (2026-10-30) « feat: let Narsil grow through five stages as she levels up » (permettre à Narsil de traverser cinq étapes à mesure qu’elle monte de niveau). Le même jour, les étapes.
- `7a964d1` (2026-10-30) « feat: draw Narsil as a hatchling at stage 1 and split the art per stage » (dessiner Narsil en nouveau-né à l’étape 1 et répartir les dessins par étape), suivi le 2026-10-31 d’un commit par étape et par thème (`6b96e08`, `e029cf0`, `ff02847`, `6a1ceb3`, `4055242`, `b7361a0`, `5ef599a`, `eed13b0`).
- `2cf7133` (2026-10-31) « feat: celebrate a new level and a new stage with their own animations » (fêter un nouveau niveau et une nouvelle étape avec leurs propres animations). L’atome `milestone` et les deux célébrations.
- `fcd68c7` (2026-10-31) « feat: move Narsil by her stage, with a shadow, splashes, a softer tremble and cheap glows » (faire bouger Narsil selon son étape, avec une ombre, des éclaboussures, un tremblement plus doux et des lueurs peu coûteuses). `STAGE_MOTION`.
- Du 2026-11-15 au 2026-11-16, les boucles animées de chaque étape (`2f08c55` à `673fc9f`), la tâche citée plus haut.

L’ordre est parlant : d’abord les nombres, puis les étapes qui rendent les nombres visibles, puis une image par étape, puis les célébrations, puis le mouvement. Chaque pas rend la récompense plus facile à remarquer.

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide. Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

Écrit pour ce guide et vérifié par rapport aux types 2.1.325 (`$.store.get`, `$.store.set`, `$.clock.now`, `$.ui.log`, `session.start`, `tool.call`, `turn.complete`, `ui.render`). Il est adapté de `hooks/xp.ts` et de `hooks/register.tsx` dans [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). Les atomes sont déclarés dans `types/index.d.ts` comme dans le premier guide : `xp: number` et `milestone: { kind: 'level' | 'grew'; level: number; at: number } | null`.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const GAIN = { turn: 10, tests: 5, agent: 3 } as const
const STAGE_FROM = [1, 5, 10, 20, 35]
const SHOWN_MS = { level: 6000, grew: 9000 } as const
const TESTS = /\b(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?test|vitest|jest|pytest)\b/

const xp = atom({ plugin: 'my-pet', key: 'xp' } as const, 0)
const milestone = atom({ plugin: 'my-pet', key: 'milestone' } as const, null)

function levelOf(total: number) {
  let level = 1
  let left = Math.max(0, Math.floor(total))
  while (left >= level * 100) {
    left -= level * 100
    level += 1
  }
  return { level, into: left, needed: level * 100 }
}
const stageOf = (level: number) => STAGE_FROM.filter((from) => level >= from).length || 1
const xpOf = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0

async function gain($: EngineInterface, reason: keyof typeof GAIN): Promise<void> {
  // Read the store again: another conversation may have added to it.
  const before = xpOf(await $.store.get('xp').catch(() => read($, xp)))
  const after = before + GAIN[reason]
  await $.store.set('xp', after).catch(() => undefined)
  await update($, xp, () => after)
  const was = levelOf(before).level
  const level = levelOf(after).level
  if (level === was) return
  const kind = stageOf(level) > stageOf(was) ? ('grew' as const) : ('level' as const)
  const at = await $.clock.now()
  await update($, milestone, () => ({ kind, level, at }))
  $.ui.log(kind === 'grew' ? `My pet has grown: level ${level}` : `My pet reached level ${level}`)
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    const stored = xpOf(await $.store.get('xp').catch(() => 0))
    await update($, xp, () => stored)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const command = (e as { command?: unknown }).command
    const result = await next(e)
    if (typeof command === 'string' && TESTS.test(command) && !result.isError)
      await gain($, 'tests')
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.reason === 'answer') await gain($, e.agentId === undefined ? 'turn' : 'agent')
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { level, into, needed } = levelOf(await read($, xp))
    const shown = await read($, milestone)
    const isFresh = shown !== null && (await $.clock.now()) - shown.at < SHOWN_MS[shown.kind]
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" gap={1} minWidth={0}>
        <Text dimColor>{`⭐ Level ${level} · ${into}/${needed} XP · stage ${stageOf(level)}`}</Text>
        {isFresh ? (
          <Text bold color="#F5B400">
            {shown.kind === 'grew' ? 'I have grown!' : 'Level up!'}
          </Text>
        ) : null}
      </Box>
    )
  })
}
```

Deux simplifications par rapport à Narsil. La bande vérifie l’âge du jalon au moment de dessiner, si bien que la célébration part au premier redessin qui suit son délai ; Narsil efface l’atome lors de son battement, qui redessine à l’heure. Et cette version compte chaque tour de sous-agent qui répond, alors que Narsil ne compte un sous-agent qu’une fois, grâce à son propre registre des sous-agents en cours.

## Erreurs fréquentes et comment tester

- **Garder l’XP seulement dans un atome.** `$.state` survit à un rechargement du mod, pas à une nouvelle session. Tout ce qui doit durer va dans `$.store`.
- **Réécrire la valeur de l’atome dans le store.** Avec deux conversations ouvertes, chaque atome est en retard sur les gains de l’autre. Lisez le store, ajoutez, écrivez.
- **Se fier à une valeur stockée.** Un store modifié à la main, ou écrit par une version plus ancienne, peut contenir n’importe quoi. Validez-la (`xpOf`) et revenez à zéro par défaut.
- **Récompenser l’échec.** N’accordez le tour que sur `answer`, et les tests que sans `isError` ; un tour interrompu ne gagne rien.
- **Célébrer pour toujours.** Un jalon a besoin d’une heure de fin et de quelque chose qui redessine quand elle est passée.
- **Des niveaux qui n’arrivent jamais.** Vérifiez votre courbe avec des chiffres avant de la publier. Avec celle de Narsil, l’étape 5 demande 59 500 XP, soit plusieurs milliers de tours.

Pour tester, les tests de `tests/narsil.test.tsx` démarrent le mod avec un store défini à l’avance et le relisent. À lire : « Narsil keeps her experience across sessions, and celebrates a new level » (Narsil garde son expérience d’une session à l’autre, et fête un nouveau niveau ; 95 XP plus un tour affichent « ⭐ Nivel 2 · 5/200 XP » et « ¡He subido al nivel 2! ⭐ »), « Narsil grows at levels 5, 10, 20 and 35, and says so » (Narsil grandit aux niveaux 5, 10, 20 et 35, et le dit), « a new level plays its own celebration for a while, in the band and the window » (un nouveau niveau joue sa propre célébration pendant un moment, dans la bande et la fenêtre) et « levels need 100, 200, 300 XP more each, and odd stored values count as none » (chaque niveau demande 100, 200, 300 XP de plus, et des valeurs stockées étranges comptent comme aucune). « the celebrations stay within the Svg size limit at every stage » (les célébrations restent dans la limite de taille de Svg à chaque étape) protège quelque chose de facile à oublier : une célébration s’ajoute à une image qui a déjà sa limite de taille.

## Pour aller plus loin

- `xpLabel` dans `hooks/xp.ts` est le seul endroit où le libellé est écrit, si bien que la bande, la fenêtre flottante et l’état du téléphone disent la même chose.
- `banner`, `behind` et `celebration` dans `hooks/sprite.ts` dessinent les célébrations en SVG par-dessus l’image.
- `artUrl` dans `hooks/phone.ts` construit l’adresse de son image à chaque étape pour le téléphone, telle que le dépôt la publie sous `assets/`.
- Le guide suivant, le mode discret, montre comment Narsil se tait sans perdre ce qui compte ; une célébration fait partie de ce qui s’affiche encore, puisqu’elle n’est que dessinée.
