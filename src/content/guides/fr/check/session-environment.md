---
title: L’environnement de la session
description: 'Comment Narsil Check affiche le dépôt, le dossier, la branche, Remote Control et Auto-fix, lus depuis git et les serveurs de l’application de bureau, et pourquoi il les interroge si peu.'
route: check
order: 2
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/session.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/session.test.tsx
---

## Ce que ça fait

La première section du panneau, **Entorno** (« environnement »), montre ce que montre la barre de session de l’application de bureau, pour que vous puissiez masquer cette barre et ne garder qu’un seul panneau. Elle a une ligne par information, et la plupart des lignes font quelque chose quand vous cliquez dessus :

| Ligne                               | Ce qu’elle montre                                                                                             | Au clic                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Repositorio** (dépôt)             | L’adresse web du dépôt distant `origin`, comme `github.com/acme/shop`.                                        | L’ouvre dans le navigateur.                                                 |
| **Carpeta** (dossier)               | Le dossier de travail de la session.                                                                          | Ouvre le sélecteur de dossier et déplace la session vers le dossier choisi. |
| **Rama** (branche)                  | La branche git actuelle.                                                                                      | Ouvre un onglet de terminal dans le dossier de travail.                     |
| `worktree …`                        | Le worktree de la session, quand elle en a un.                                                                | Rien.                                                                       |
| **Control remoto** (Remote Control) | Un interrupteur : `●━━ desactivado` en gris, `━━● activado` en vert.                                          | L’active ou le désactive.                                                   |
| **Auto-fix**                        | Le même interrupteur pour la pull request ouverte de la session, ou `sin PR abierto` (« aucune PR ouverte »). | L’active ou le désactive.                                                   |

Avec une pull request ouverte, un repli **CI** apparaît entre les deux interrupteurs ; le quatrième guide de ce parcours en parle.

Quand quelque chose ne peut pas être lu, la section le dit en rouge sous sa ligne, par exemple « No pude leer o cambiar el control remoto: … » (« je n’ai pas pu lire ou modifier le Remote Control : … »), au lieu de rester vide.

## Comment ça marche à l’intérieur

### D’où vient chaque information

Le README dit que la section est lue depuis les propres serveurs MCP de l’application de bureau. Le code est plus précis, et la différence compte sur les autres surfaces : trois informations viennent du moteur et de git, le reste des serveurs de l’application. Tout se passe dans `loadSession`, dans `hooks/register.tsx`.

| Information              | Source                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| Dossier                  | `$.session.cwd()`                                                                                 |
| Branche                  | `$.process.run(['git', 'branch', '--show-current'])`                                              |
| Dépôt                    | `$.process.run(['git', 'remote', 'get-url', 'origin'])`, transformé en adresse web par `webUrlOf` |
| Remote Control, worktree | `$.mcp.call('ccd_session_mgmt', 'get_session', { session_id: 'self' })`                           |
| Pull request, Auto-fix   | `$.mcp.call('ccd_pr', 'get_status', { session_id: 'self' })`                                      |
| Connecteurs              | `$.mcp.call('ccd_connectors', 'session_connectors_status')` (guide suivant)                       |

Les noms de serveurs et d’outils sont des constantes en haut de `hooks/session.ts` (`SESSIONS_SERVER`, `SESSION_TOOL`, `PR_SERVER`, `PR_TOOL` et les autres), si bien que le module de hooks ne les écrit jamais deux fois.

`webUrlOf` accepte les dépôts distants SSH (`git@github.com:acme/shop.git`, `ssh://git@host:22/acme/shop`) et HTTPS, avec ou sans utilisateur ou `.git`, et renvoie `https://host/owner/repo`. Tout le reste, dont un chemin local, ne donne aucun lien, et la ligne dit « sin repositorio remoto » (« aucun dépôt distant »).

### `$.mcp.call`, tel que le code l’utilise

Les types 2.1.325 décrivent `$.mcp.call(server, tool, args)` comme un appel à un outil « on one of the engine's connected MCP servers with the engine's own connection and credentials » (sur l’un des serveurs MCP connectés du moteur, avec la connexion et les identifiants du moteur lui-même). Il est positionnel (serveur, outil, arguments), et non le nom `mcp__server__tool` que voit un hook `tool.call`. Il résout le résultat tel que MCP le renvoie : des blocs `content`, `isError`, et `structuredContent` quand l’outil déclare un schéma de sortie.

Narsil Check lit chaque réponse de la même façon :

```tsx
const result = await $.mcp.call(SESSIONS_SERVER, SESSION_TOOL, { session_id: 'self' })
const read = result.isError
  ? undefined
  : parseSession(result.structuredContent ?? jsonOf(result.content))
where = read ?? { remote: 'unknown', remoteError: textOf(result.content) || 'respuesta sin sesión' }
```

Il préfère `structuredContent` et se rabat sur le JSON contenu dans les blocs de texte (`jsonOf` dans `hooks/session.ts`). Chaque appel est dans son propre `try`, et un échec devient un champ d’erreur de cette partie seulement (`remoteError`, `fixError`, `connectorsError`) : un serveur qui ne répond pas ne vide pas toute la section.

Les analyseurs sont défensifs à dessein. `parseSession` prend `remoteControlState` quand il vaut `on`, `off`, `connecting` ou `unavailable`, et se rabat sinon sur le booléen `remoteControlActive`. `parsePr` ne signale Auto-fix que pour une pull request liée et `open`, parce que seule celle-ci peut être basculée et que l’interrupteur a besoin de son url ; il garde aussi le dépôt de la pull request et sa branche de tête pour le repli du CI.

### Pourquoi il interroge si peu

La section pourrait simplement interroger les serveurs toutes les quelques secondes. Elle ne le fait pas, et le code et les commits donnent deux raisons.

**Chaque appel est visible par tous les autres mods.** Un commentaire dans `hooks/register.tsx` dit « each call to them reaches every other mod as a tool call » (chaque appel qui leur est adressé atteint tous les autres mods comme un appel d’outil). Les types le confirment à leur manière : l’appel du plugin est « seen by the hooks above it » (vu par les hooks situés au-dessus de lui). Le commit `55fe118` consigne la conséquence : « seven retries tripped Narsil's loop alert » (sept nouvelles tentatives ont déclenché l’alerte de boucle de Narsil). Un mod qui observe les appels d’outils voit les appels du panneau à côté du travail de Claude lui-même ; Narsil ignore aujourd’hui les appels qui ne sont pas ceux de Claude (`isClaudesCall`, traité dans le premier guide du parcours 1), et le commentaire à cet endroit cite comme exemple narsil-check qui lit sa session au démarrage.

**Un appel trop précoce peut déclencher une demande d’autorisation.** Le commentaire au-dessus de `SESSION_DELAY_MS` dit que les serveurs de l’application se connectent après le début de la session, et que « a call that comes while the app has not yet confirmed which server serves the tool makes the app ask the person for permission, whatever the permission mode » (un appel qui arrive alors que l’application n’a pas encore confirmé quel serveur fournit l’outil fait demander à l’application une autorisation à la personne, quel que soit le mode d’autorisation). Le commit `4770a49` « fix: ask the app's session servers once, ten seconds after start » (interroger une seule fois les serveurs de session de l’application, dix secondes après le démarrage) est ce correctif.

Ici, le code et les types ne disent pas la même chose. Les types 2.1.325 disent de `$.mcp.call` : « No permission prompt: the plugin's call, seen by the hooks above it, is the grant. » (aucune demande d’autorisation : l’appel du plugin, vu par les hooks situés au-dessus de lui, vaut autorisation). Le README et le commit décrivent une demande que l’application de bureau a affichée malgré tout. Considérez les types comme le contrat du moteur et le commit comme ce que l’auteur ou l’autrice a observé dans l’application de bureau, et concevez pour le cas le plus strict.

Le calendrier est donc le suivant :

1. **Au début de la session**, `loadSessionAtStart` attend dix secondes avec `$.clock.sleep(SESSION_DELAY_MS)` et lit une fois. Il s’exécute avec `void`, si bien que le début de session n’est pas retenu. D’ici là, la section dit « Leyendo la sesión… » (« lecture de la session… »).
2. **Si cette lecture échoue**, elle est refaite quand votre premier tour commence, « when the servers are surely confirmed » (quand les serveurs sont sûrement confirmés), sans nouvelles tentatives rapides entre les deux. La première lecture est faite avec `isFinal: false` : une lecture échouée n’écrit rien, si bien que la section continue d’indiquer qu’elle lit au lieu d’afficher une erreur que la nouvelle tentative pourrait faire disparaître.
3. **À la fin de chaque tour principal**, le dossier, la branche et le dépôt sont relus depuis git. Les serveurs ne sont réinterrogés que si le tour a utilisé un outil qui change leur réponse (`SESSION_TOOLS` : les outils `mcp__ccd_session_mgmt__`, `mcp__ccd_connectors__`, `mcp__ccd_directory__` et `mcp__ccd_pr__`, `EnterWorktree`, `ExitWorktree`, ou une commande shell avec `gh pr` ou `git push`), ou si la dernière lecture a échoué.
4. **Après un tour qui a ouvert ou poussé une pull request**, l’application peut ne la lier qu’après la fin du tour. `retryPr` réinterroge `ccd_pr` seul après des attentes de 5, 10 et 15 secondes (5, 15 et 30 secondes après le tour, comme le dit le README), s’arrête dès que la pull request apparaît, et s’arrête quand la session se termine, `/clear` compris.
5. **Quand vous ouvrez le repli Entorno ou Conectores**, et après avoir basculé un interrupteur, tout est relu.

La forme de ce calendrier est l’essentiel : les lectures bon marché (git, le dossier) ont lieu souvent, les lectures que les autres mods peuvent voir n’ont lieu que lorsque quelque chose a pu changer.

### Les interrupteurs

Les deux interrupteurs appellent les serveurs de l’application pour modifier quelque chose, puis relisent :

- **Remote Control** : `$.mcp.call('ccd_session_mgmt', 'set_remote_control', { session_id: 'self', enabled })`. La réponse peut être du JSON ou des mots, si bien que `parseRemote` cherche l’état dans les deux.
- **Auto-fix** : `$.mcp.call('ccd_pr', 'set_monitor', { auto_fix: enabled, address_comments: enabled, url })`. Un commentaire dit que `address_comments` doit être égal à `auto_fix` du côté de l’application. Le README dit que l’application peut d’abord vous demander une autorisation.

Pendant qu’un interrupteur change, `isSwitching` (ou `isFixSwitching`) dessine le curseur au milieu et en jaune (`━●━`, « cambiando… », « changement en cours… »), et le bouton n’est pas dessiné, si bien qu’un second appui ne peut pas entrer en concurrence avec le premier. `switchGlyph` et `fixGlyph` dans `hooks/session.ts` dessinent les deux interrupteurs avec la même fonction.

Les clics sur le dossier et la branche utilisent deux autres serveurs de l’application : `ccd_directory` (`request_directory` ouvre le sélecteur natif, `change_directory` déplace la session) et `terminal` (`open_terminal_tab`, nommé d’après la branche).

### Sur les surfaces sans ces serveurs

Le terminal, VS Code et les autres surfaces n’ont pas les serveurs de l’application de bureau. Là, chaque `$.mcp.call` échoue, et le code transforme chaque échec en erreur de sa partie.

Ce que vous voyez découle du calendrier ci-dessus. La lecture à dix secondes échoue et n’écrit rien, si bien que la section continue de dire « Leyendo la sesión… ». Quand votre premier tour commence, la lecture est refaite comme définitive : le dépôt, le dossier et la branche s’affichent (ils viennent de git et du moteur), et les lignes Remote Control et Auto-fix disent en rouge qu’elles n’ont pas pu être lues. Le test « a server the mod cannot reach says why once the first turn has tried it too » (un serveur que le mod ne peut pas joindre dit pourquoi une fois que le premier tour a aussi essayé) vérifie exactement cela : deux lectures en tout, chacune interrogeant chaque serveur une fois, puis les lignes d’erreur.

Le tableau des surfaces du README dit qu’Entorno ne fonctionne pas en dehors de l’application de bureau et que « la sección dice por qué no pudo leerlos » (« la section dit pourquoi elle n’a pas pu les lire »). Le code est un peu plus clément que cela : les lignes de git s’affichent quand même. Les clics sur le dossier et la branche ont besoin des serveurs de l’application, si bien qu’en dehors du bureau ils répondent par un toast qui dit qu’ils n’ont pas pu.

## Le construire avec Claude

Demandez à Claude une section d’environnement lue depuis git et depuis les serveurs de l’application de bureau. L’idée que Claude doit bien saisir : à quelle fréquence, rare, interroger ces serveurs ; chaque appel est vu par les autres mods, et un appel trop tôt peut déclencher une demande d’autorisation.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon mod Claude Code `my-panel`, ajoute une section « Environment » au panneau. Lis le dossier avec `$.session.cwd()`, la branche avec `$.process.run(['git', 'branch', '--show-current'])` et le dépôt distant avec `git remote get-url origin`, transformé en lien https pour les dépôts distants SSH et HTTPS. Lis le Remote Control depuis l’application de bureau avec `$.mcp.call('ccd_session_mgmt', 'get_session', { session_id: 'self' })`, en préférant `structuredContent` et en te rabattant sur le JSON du contenu textuel. Chaque appel aux serveurs de l’application est vu par les autres mods, et un appel trop précoce peut déclencher une demande d’autorisation, donc lis une fois, dix secondes après `session.start` avec `$.clock.sleep`, sans l’attendre dans le hook ; si cela échoue, affiche « Reading… » et réessaie une fois au premier `turn.start` principal. Après chaque tour principal, ne relis que git. Garde l’erreur de chaque partie séparément et affiche-la en rouge. Teste avec `mock.clock` qu’aucun serveur n’est appelé avant dix secondes et qu’il ne l’est qu’une fois ensuite.

### Ce qu’il faut vérifier dans la réponse de Claude

1. Aucun appel aux serveurs de l’application n’a lieu dans les dix premières secondes après `session.start`, et la lecture différée s’exécute avec `void`, si bien que le hook rend la main tout de suite.
2. Si cette première lecture échoue, elle n’écrit rien, la section dit qu’elle est en train de lire, et elle réessaie une seule fois au premier `turn.start` principal, sans boucle de nouvelles tentatives.
3. Après chaque tour principal, seul git est relu (dossier, branche et dépôt distant), pas les serveurs de l’application.
4. Chaque réponse est lue d’abord dans `structuredContent` et, en repli, dans le JSON des blocs de texte, et chaque partie garde sa propre erreur, affichée en rouge.
5. Le dépôt distant devient un lien https pour les dépôts distants SSH comme HTTPS, et tout le reste ne donne aucun lien.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « hors de l’application de bureau, la section affiche “Reading…” indéfiniment et la branche ne s’affiche jamais ».

### Comment l’auteur l’a demandé

La demande d’origine pour cette section n’a pas été consignée. Aucun des journaux de tâches publics de narsil-check (`odd/tasks/*.md`) ne la couvre ; ils portent sur les écosystèmes, l’ancienneté des versions et les vulnérabilités.

#### Reconstitution à partir de l’historique des commits

À partir de `git log -- hooks/session.ts`, avec les commits liés de `hooks/register.tsx` :

- `be8eac0` (2026-11-05) « feat: show the session bar's environment, connectors and Remote Control in the pane » (afficher dans le panneau l’environnement, les connecteurs et le Remote Control de la barre de session). Son message donne le motif : la section est « read from the desktop app's own MCP servers, so the app's session bar can be hidden » (lue depuis les propres serveurs MCP de l’application de bureau, pour que la barre de session de l’application puisse être masquée).
- `2bd1919` (2026-11-05) « feat: repository link, Remote Control switch in Entorno and /mcp from connectors » (lien vers le dépôt, interrupteur Remote Control dans Entorno et /mcp depuis les connecteurs). Entorno perd une ligne Local/Nube (« local/nuage ») et gagne le lien vers le dépôt.
- `c07f5e9` (2026-11-05) « feat: Entorno starts open, other sections fold until they have something » (Entorno commence ouverte, les autres sections restent repliées jusqu’à avoir quelque chose).
- `d8c664e` (2026-11-05) « fix: retry the first session read until the app's servers answer » (retenter la première lecture de la session jusqu’à ce que les serveurs de l’application répondent). La première réponse aux serveurs pas encore connectés : retenter pendant environ une minute.
- `55fe118` (2026-11-06) « fix: ask the app's session servers less often » (interroger moins souvent les serveurs de session de l’application). Au plus quatre lectures au démarrage, et des serveurs interrogés après un tour seulement si nécessaire, parce que les nouvelles tentatives « tripped Narsil's loop alert » (déclenchaient l’alerte de boucle de Narsil).
- `4770a49` (2026-11-06) « fix: ask the app's session servers once, ten seconds after start » (interroger une seule fois les serveurs de session de l’application, dix secondes après le démarrage). Les nouvelles tentatives sont remplacées par une seule lecture différée, à cause de la demande d’autorisation.
- `7d91264` (2026-11-07) « feat: add an Auto-fix switch to Entorno for the session's open pull request » (ajouter à Entorno un interrupteur Auto-fix pour la pull request ouverte de la session).
- `90c40f9` (2026-11-07) « fix: read the session's pull request again when the app binds it after the turn ends » (relire la pull request de la session quand l’application la lie après la fin du tour).
- `f091e0b` (2026-11-07) « fix: retry only the pull request read and stop the retries when the session ends » (ne retenter que la lecture de la pull request et arrêter les nouvelles tentatives quand la session se termine). Son message : chaque nouvelle tentative réinterrogeait les connecteurs et la session, « three calls that reach every other mod » (trois appels qui atteignent tous les autres mods).

Le schéma mérite d’être remarqué : trois correctifs d’affilée (`d8c664e`, `55fe118`, `4770a49`) ont chacun interrogé moins les serveurs. La première version insistait davantage quand les serveurs n’étaient pas prêts ; la dernière attend, interroge une fois, et ne réinterroge que pour une raison.

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide. Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

Voici une version réduite de l’idée, écrite pour ce guide et vérifiée par rapport aux types de Claude Code 2.1.325. Elle est adaptée de `hooks/register.tsx` et de `hooks/session.ts` dans [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later).

Le type de l’état, dans `types/index.d.ts` :

```ts
export type Env = { isLoaded: boolean; cwd: string; branch: string; remote: string; error?: string }

declare module 'claude-code' {
  interface PluginState {
    'my-panel': { env: Env }
  }
}
```

Le module de hooks, `hooks/register.tsx` :

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import type { Env } from '../types'

const PANE = 'my-panel'
const env = atom(
  { plugin: 'my-panel', key: 'env' } as const,
  { isLoaded: false, cwd: '', branch: '', remote: '' } as Env,
)

const git = ($: EngineInterface, argv: string[]) =>
  $.process
    .run(argv, { timeoutMs: 15_000 })
    .then((r) => (r.exitCode === 0 ? r.stdout.trim() : ''))
    .catch(() => '')

// One read; `isFinal: false` writes nothing when the app's server fails.
async function load($: EngineInterface, isFinal: boolean): Promise<boolean> {
  const cwd = await $.session.cwd().catch(() => '')
  const branch = await git($, ['git', 'branch', '--show-current'])
  let remote = 'unknown'
  let error: string | undefined
  try {
    const result = await $.mcp.call('ccd_session_mgmt', 'get_session', { session_id: 'self' })
    const value = (result.structuredContent ?? {}) as { remoteControlState?: unknown }
    if (result.isError || typeof value.remoteControlState !== 'string') error = 'no answer'
    else remote = value.remoteControlState
  } catch (err) {
    error = err instanceof Error ? err.message : String(err)
  }
  if (!error || isFinal)
    await update($, env, () => ({ isLoaded: true, cwd, branch, remote, error }))
  return !error
}

let isRetryPending = false

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    void $.clock
      .sleep(10_000)
      .then(async () => {
        isRetryPending = !(await load($, false))
      })
      .catch(() => undefined)
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined && isRetryPending) {
      isRetryPending = false
      void load($, true).catch(() => undefined)
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const view = await read($, env)
    if (!view.isLoaded) return <Text dimColor>Reading the session…</Text>
    return (
      <Box flexDirection="column">
        <Text>{`Folder ${view.cwd || '?'}`}</Text>
        <Text>{`Branch ${view.branch || 'no git'}`}</Text>
        <Text>{`Remote Control ${view.remote}`}</Text>
        {view.error && (
          <Text color="#F0435A">{`Could not read Remote Control: ${view.error}`}</Text>
        )}
      </Box>
    )
  })
}
```

Le panneau est ouvert comme dans le premier guide. Trois détails portent la conception. La lecture différée s’exécute avec `void`, si bien que `session.start` revient aussitôt. Une première lecture échouée n’écrit rien, si bien que la section dit qu’elle lit plutôt que d’afficher une erreur que la tentative suivante pourrait faire disparaître. Et la nouvelle tentative attend un vrai événement, le premier tour, au lieu d’une boucle de minuteur que les autres mods verraient comme des appels d’outils répétés.

## Erreurs fréquentes et comment tester

Elles viennent du code et des commits de Narsil Check :

- **Appeler les serveurs de l’application dès `session.start`.** Ils ne sont peut-être pas encore connectés, et l’auteur ou l’autrice a vu l’application de bureau demander une autorisation même avec les autorisations contournées (`4770a49`). Attendez, puis interrogez une fois.
- **Retenter en boucle.** Chaque appel est vu par les autres mods comme un appel d’outil ; les nouvelles tentatives de Narsil Check ont déclenché l’alerte de boucle de Narsil (`55fe118`).
- **Attendre la lecture lente dans le hook.** `$.clock.sleep` consomme le budget du hook lui-même, comme le disent les types. Lancez-la avec `void` et laissez le hook revenir.
- **Ne lire que `content`.** Préférez `structuredContent` quand l’outil en déclare un, et n’analysez les blocs de texte qu’en solution de repli.
- **Une seule erreur pour tout.** Gardez une erreur par partie, pour qu’un serveur absent ne masque pas la branche que vous pouvez lire depuis git.
- **Supposer que chaque surface a les serveurs du bureau.** Sur le terminal, les appels échouent ; concevez la section pour qu’elle montre ce que git peut dire et qu’elle explique pourquoi le reste manque.
- **Lire les serveurs après chaque tour.** Narsil Check ne les réinterroge que si le tour a utilisé un outil qui change leur réponse (`SESSION_TOOLS`) ou si la dernière lecture a échoué.

Pour tester, `tests/session.test.tsx` dans narsil-check répond aux serveurs de l’application avec un hook `on('mcp.call', ...)`, à git avec `on('process.run', ...)` et au dossier avec `on('session.cwd', ...)`, et fait avancer le temps avec `mock.clock(on)` et `clock.advance`. Parmi les tests à copier par leur nom : « the app's servers are first asked ten seconds after the session starts, once; a failed read is tried again as the first turn starts » (les serveurs de l’application sont interrogés pour la première fois dix secondes après le début de la session, une seule fois ; une lecture échouée est retentée quand le premier tour commence), « a turn that touched no session tool reads only git again, not the app's servers » (un tour qui n’a touché aucun outil de session ne relit que git, pas les serveurs de l’application) et « a server the mod cannot reach says why once the first turn has tried it too » (un serveur que le mod ne peut pas joindre dit pourquoi une fois que le premier tour a aussi essayé). Utilisez des valeurs synthétiques dans vos fixtures, comme un dépôt distant `git@github.com:acme/shop.git`.

## Pour aller plus loin

La section complète de narsil-check ajoute :

- Le repli **CI** de la pull request de la session, lu avec `gh` (le quatrième guide).
- La section **Conectores**, lue depuis les mêmes serveurs dans le même `loadSession` (le guide suivant).
- `pathOf` dans `hooks/session.ts`, qui trouve le dossier renvoyé par le sélecteur, sous forme de champ `path` ou comme premier chemin absolu dans ses mots.
- Cette même section est ce qui vous permet de masquer la propre barre de session de l’application de bureau : tout ce qu’elle montrait est ici, avec les mêmes clics.
