---
title: Les conseils avec Haiku
description: 'Comment Narsil demande à Haiku un court conseil sur le travail en cours : le contexte envoyé, le prompt exact, la fréquence de ses interventions, le mode approfondi et la fenêtre du conseil.'
route: pet
order: 11
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/advice.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: overlay/tip.ps1
  - repo: pet
    path: overlay/tip.sh
  - repo: pet
    path: overlay/tip.js
  - repo: pet
    path: docs/plan-advice.md
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Ce que ça fait

De temps en temps, Narsil vous donne un conseil sur ce sur quoi vous travaillez : deux ou trois phrases, en espagnol, sur quelque chose de concret qui vient de se passer. Elle le demande à un petit modèle, Haiku, avec un court résumé du travail.

Il y a trois moments automatiques et deux à la demande :

- **Un tour s’est terminé.** Le conseil lit ce que le tour a modifié et commente une décision de conception : pourquoi on l’a faite ainsi, quelle était l’alternative, ce que chacune fait gagner ou perdre. Les conseils de routine (« lance les tests », « vérifie le push ») sont exclus à dessein.
- **Un outil a échoué plusieurs fois.** Le même outil deux fois dans un tour, ou trois échecs de n’importe quel type. Le conseil porte sur le débogage.
- **Un tour dure depuis plus de 3 minutes**, ce qui est vérifié à chaque appel d’outil. Le conseil porte sur le rythme, ou sur le découpage de la tâche.
- **`/narsil consejo`** (« conseil ») en demande un tout de suite, comme le conseil de fin de tour.
- **`/narsil consejo profundo`** (« conseil approfondi ») le demande au modèle de la session lui-même, sur toute la conversation.

Les conseils automatiques sont espacés : au plus un toutes les 30 minutes par défaut (`/narsil consejos cada <min>` le modifie), le double quand le même type revient deux fois de suite, et au plus 20 par jour. Un conseil que vous demandez n’est jamais retenu. `/narsil consejos off` arrête les conseils automatiques, `/narsil consejos voz` lit à voix haute les conseils de fin de tour, et le mode discret (`/narsil discreto`) les arrête en même temps que la voix.

Sous Windows et macOS, chaque conseil s’ouvre en entier dans une petite fenêtre à lui, avec l’image de Narsil, qui ne prend pas le focus et se ferme d’elle-même au bout de 3 minutes. Ailleurs, il s’affiche dans la bande, sous le titre, sur trois lignes courtes au plus avec un « × » pour le fermer, ainsi que dans la fenêtre flottante.

Un conseil ne ralentit jamais Claude : il est demandé après coup, pendant que vous lisez la réponse.

## Comment ça marche à l’intérieur

### Ce dont Narsil se souvient : `seen`

`hooks/advice.ts` contient les parties qui sont de simples valeurs (contexte, prompt, analyse de la réponse) ; `hooks/register.tsx` gère les appels. Ce que Narsil a vu du travail tient dans une variable de module, `seen`, remplie par les hooks des guides précédents :

- `prompt.submit` : votre dernier message, ses 400 premiers caractères (pas les messages que le moteur ajoute lui-même, `e.isMeta`).
- `tool.call` : les 15 derniers appels, chacun avec son outil et le court détail de la bande (le nom d’un fichier, la première ligne d’une commande) ; les fichiers modifiés ou écrits pendant ce tour, avec le nombre de fois ; et les 5 derniers échecs, avec les 200 premiers caractères de l’erreur.
- `turn.complete` : la durée du tour et la réponse finale de Claude.
- Juste avant la demande, `git` : ce que le tour a modifié (voir plus bas).

Les variables de module sont perdues lors d’un rechargement du mod, et ce n’est pas grave : le tour suivant les remplit de nouveau. Le plan dit la même chose : « losing it on reload is harmless » (la perdre au rechargement est sans conséquence).

### Ce qui a changé : le diff

Pour le conseil de fin de tour et celui que vous demandez, `readDiff` exécute `git diff HEAD --stat --patch --unified=2` via `$.process.run`, avec un délai de 5 secondes. Si le tour a déjà tout commité et qu’il n’y a aucun diff en attente, il lit plutôt le dernier commit (`git show HEAD`). Hors d’un dépôt, ou sans git, il est vide et le conseil s’en passe. Un conseil de débogage ou de rythme ne lit pas du tout le diff : il n’en a pas l’utilité.

La première version des conseils n’avait pas de diff : il est arrivé dans `d1e6d40`, en même temps que la règle contre les vérifications de routine. Avec le diff, le modèle peut nommer la fonction qui a changé au lieu de la deviner à partir de la liste des appels d’outils.

### Le contexte que lit le modèle

`describe(seen, kind)` transforme tout cela en lignes de texte, avec le motif en premier. Un exemple synthétique de contexte de fin de tour, raccourci :

```text
Motivo: El turno acaba de terminar. Comenta una decisión de diseño de lo que se hizo: …
Último mensaje de la persona: añade reintentos a net.ts
Archivos editados en este turno: net.ts (2 veces), net.test.ts
Últimas herramientas usadas:
- Read: net.ts
- Edit: net.ts
- Bash: pnpm test
Duración del turno: 4 min
Respuesta final: Añadí retry() con tres intentos … Falta decidir el tiempo entre intentos.
Cambios (git):
 net.ts | 14 ++++++++++++--
 …
```

Les libellés sont en espagnol parce que le modèle doit répondre en espagnol : le dernier message, les fichiers modifiés, les échecs récents, les derniers outils, la durée, la réponse finale et les modifications. Chaque partie a sa propre limite : 1 500 caractères de la réponse, conservés par les deux bouts (`ends`), puisqu’une réponse dit d’abord ce qu’elle a fait et à la fin ce qui reste ; 3 000 caractères du diff, coupés par lignes ; 6 000 pour tout le contexte. Ensuite, `sanitize` passe sur l’ensemble (voir plus bas).

### Le prompt exact

Le prompt système est `SYSTEM` dans `hooks/advice.ts`, cité ici tel qu’il est dans [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). `ASKED_TIP` vaut 300.

```ts
export const SYSTEM = [
  'Eres Narsil, una vieja serpiente marina sabia que acompaña a quien programa.',
  'Das UN consejo sabio y concreto sobre el trabajo en curso, el que daría alguien con experiencia que revisa el trabajo.',
  'Reglas:',
  `- Escribe en español, en dos o tres frases, como mucho ${ASKED_TIP} caracteres.`,
  '- Sigue el motivo que se te da. Cuando trate del diseño, nombra la decisión concreta (una función, un archivo, un enfoque),',
  '  la alternativa y por qué una u otra; el diff de los cambios te dice qué se hizo.',
  '- Menciona algo concreto del contexto; nada de motivación genérica ni datos inventados.',
  '- Puedes usar como mucho una metáfora del mar.',
  '- Habla como Narsil, en femenino; no nombres a ningún asistente ni a "Claude".',
  '- El femenino es solo para ti: a la persona háblale de tú con lenguaje neutro, sin suponer su género',
  '  (nada de "juntas", "juntos", "listo" o "lista"; di "contigo", "cuando quieras").',
  '- No repitas ninguno de los consejos anteriores.',
  '- Si no hay nada útil que decir, responde exactamente SKIP.',
  'Responde solo con el consejo (o SKIP), sin comillas ni prefijos.',
].join('\n')
```

Traduction en français : tu es Narsil, un vieux serpent de mer sage qui accompagne les personnes qui programment. Tu donnes UN conseil sage et concret sur le travail en cours, celui que donnerait une personne expérimentée qui relit le travail. Règles : écris en espagnol, en deux ou trois phrases, 300 caractères au plus. Suis le motif qui t’est donné ; quand il porte sur la conception, nomme la décision concrète (une fonction, un fichier, une approche), l’alternative et pourquoi l’une ou l’autre ; le diff des modifications te dit ce qui a été fait. Mentionne quelque chose de concret tiré du contexte ; pas de motivation générique ni de données inventées. Tu peux utiliser au plus une métaphore marine. Parle comme Narsil, au féminin ; ne nomme aucun assistant ni « Claude ». Le féminin ne vaut que pour toi : adresse-toi à la personne en la tutoyant, dans un langage neutre, sans supposer son genre (les exemples sont des mots espagnols qui portent un genre, et des alternatives neutres). Ne répète aucun des conseils précédents. S’il n’y a rien d’utile à dire, réponds exactement SKIP. Réponds seulement avec le conseil (ou SKIP), sans guillemets ni préfixes.

Le message utilisateur est construit par `prompt(context, recent)` : « Contexto del trabajo: » (« contexte du travail »), le contexte, puis « Consejos anteriores (no los repitas): » (« conseils précédents, ne les répète pas ») avec les cinq derniers conseils, et « Tu consejo: » (« ton conseil : ») pour finir.

Le motif qui ouvre le contexte change selon le type (`REASON` dans `hooks/advice.ts`) :

- **Fin de tour :** « El turno acaba de terminar. » (« le tour vient de se terminer ») suivi de la consigne de conception : commenter une décision de conception de ce qui a été fait, pourquoi, quelle alternative existait et ce que chacune fait gagner ou perdre, ou comment améliorer cette fonctionnalité. Puis « Nada de comprobaciones rutinarias (ejecutar los tests, revisar el push o el commit, mirar si el error ya no sale). » (« pas de vérifications de routine : lancer les tests, vérifier le push ou le commit, regarder si l’erreur a disparu »).
- **Échecs :** « Una herramienta ha fallado varias veces: da un consejo para depurarlo. » (« un outil a échoué plusieurs fois : donne un conseil pour le déboguer »).
- **Tour long :** « El turno lleva mucho tiempo: da un consejo de ritmo o de dividir la tarea. » (« le tour dure depuis longtemps : donne un conseil sur le rythme ou sur le découpage de la tâche »).

Trois choix de conception de ce prompt méritent d’être copiés. `SKIP` permet au modèle de se taire, et le silence vaut mieux qu’un conseil inutile. Les conseils précédents inclus dans le message empêchent le même conseil de revenir à chaque tour. Et l’interdiction des vérifications de routine existe parce que, sans elle, le conseil le plus facile est toujours « lance les tests ».

### Appeler Haiku : `$.model.complete`

`askTip` l’envoie :

```tsx
const reply = await $.model.complete({
  model: 'haiku',
  system: SYSTEM,
  prompt: prompt(describe(seen, kind), recentTips),
  effort: 'medium',
  maxTokens: 2000,
  timeoutMs: 30_000,
})
return reply.isAnswered ? parse(reply.text) : null
```

Les types 2.1.325 décrivent `$.model.complete` comme une complétion de texte unique via le client d’API de la session elle-même : « No tools, no history, no system prompt beyond the CLI's identity block and `request.system` » (pas d’outils, pas d’historique, pas de prompt système au-delà du bloc d’identité de la CLI et de `request.system`). Haiku ne voit donc que ce que Narsil envoie, rien de la conversation elle-même. Le résultat indique s’il a répondu (`isAnswered`) ; sinon, une `reason` (`api-error`, `empty-reply`, `aborted`). Narsil traite chacun de ces cas, ainsi que toute exception, comme « pas de conseil ».

`parse` nettoie la réponse : il retire les guillemets autour et un préfixe « consejo: », transforme tout « Claude » en « Narsil », ne renvoie rien pour `SKIP` ou une réponse vide, et coupe un conseil qui s’emballe au-delà de 450 caractères à sa dernière phrase complète. Le prompt en demande 300 ; la marge existe parce que le modèle en écrit souvent quelques-uns de plus, et ceux-là s’affichent en entier.

### Le mode approfondi : `$.model.fork`

`/narsil consejo profundo` fait autre chose. Il appelle `$.model.fork({ prompt: forkPrompt(recentTips) })`, où `forkPrompt` est le même `SYSTEM` suivi de « Mira esta conversación hasta aquí y da tu consejo sobre ella. » (« regarde cette conversation jusqu’ici et donne ton conseil à son sujet »).

Les types décrivent un fork comme une complétion unique sans outils « over the session's OWN transcript as the main thread last sent it » (sur la PROPRE transcription de la session telle que le fil principal l’a envoyée en dernier) : le modèle, le prompt système, les outils et les messages du fil principal, avec ce prompt à la suite et chaque outil refusé. Le modèle voit tout, et c’est le but. Quand il n’y a pas encore de conversation, la raison du résultat est `nothing-to-fork`, et Narsil répond qu’il n’y a encore rien à regarder.

### Quand elle peut parler : `mayTip`

Chaque déclencheur automatique appelle `tipLater($, kind)`, et chaque type est tenté au plus une fois par tour. `mayTip` décide ensuite :

1. Conseils désactivés, ou mode discret : non.
2. Déjà 20 aujourd’hui : non. Le jour est compté comme `Math.floor(now / 86_400_000)`, si bien qu’il change à minuit UTC, et non à minuit heure locale.
3. Moins que l’intervalle depuis le dernier conseil automatique : non. L’intervalle est `adviceEveryMinutes` (30 par défaut), doublé quand ce type est le même que le précédent.
4. Sinon oui, et le conseil compte, même si le modèle répond ensuite `SKIP`.

`tipLater` n’est jamais attendu : `void autoTip($, kind).catch(() => undefined)`. Le hook qui l’a déclenché revient aussitôt, si bien qu’un modèle lent ne retient jamais le tour. Le plan le demandait, et demandait aussi de ne pas utiliser les minuteurs de `$.clock`, puisqu’un rechargement du mod les annule.

### Où s’affiche le conseil

`showTip` fait la même chose pour chaque conseil :

1. Il garde le texte parmi les cinq derniers, pour le prompt suivant.
2. Sous Windows et macOS, il ouvre la fenêtre du conseil. Si cela a fonctionné, la bande et la fenêtre flottante laissent le conseil de côté : il est déjà à l’écran, en entier.
3. Sinon, la bande le dessine avec `tipLines`, réparti sur trois lignes au plus (60 caractères sur le bureau, la largeur de la bande dans le terminal), avec un bouton « × ». Il quitte la bande au bout de 3 minutes ; la fenêtre flottante le garde 15 minutes, puisque cette fenêtre est souvent consultée plus tard.
4. Il écrit une ligne de journal, « 💡 » et le conseil, avec `$.ui.log`.

La fenêtre du conseil n’est pas du code de mod : `launch` lance un script avec `$.process.run`, détaché, via `powershell.exe` sous Windows et `/bin/sh` sous macOS. Sous Windows, `overlay/tip.ps1` construit une petite fenêtre Windows Forms qui s’affiche sans prendre le focus, reste au premier plan, s’ouvre au-dessus de la fenêtre flottante quand celle-ci est à l’écran (sinon dans un coin de l’écran où se trouve Claude), se ferme au bout de `NARSIL_SECONDS` (180) et ferme tout conseil plus ancien. Sous macOS, `overlay/tip.sh` exécute `overlay/tip.js` avec `osascript` (JavaScript for Automation) : un panneau flottant qui ne s’active jamais, placé au-dessus de la fenêtre flottante (il demande au serveur local où elle se trouve) ou dans le coin de l’écran où se trouve la souris. Les deux ont un bouton qui ramène à la conversation via un lien `claude://`, qu’ils vérifient contre un motif strict avant de l’ouvrir.

Un détail de `tip.sh` compte pour quiconque le copie : « The tip and the rest travel in the environment, never inside the script, so nothing in them runs. » (le conseil et le reste voyagent dans l’environnement, jamais à l’intérieur du script, si bien que rien de leur contenu ne s’exécute). Le conseil est un texte écrit par un modèle. Le coller dans une ligne de commande permettrait à un guillemet égaré de le transformer en code.

La suggestion de `/compact` du guide 7 et le résumé de session du guide 10 passent aussi par `showTip`, bien qu’aucun modèle ne les écrive.

### Le coût

Chaque conseil est une requête au modèle sur le compte de la personne. Les types disent qu’un `$.model.complete` ayant reçu une réponse « counts toward the session's cost total » (compte dans le coût total de la session), visible dans `/cost` avec la `query_source` `plugin_model_complete`, et « Nothing caps it per call » (rien ne le plafonne par appel). Le plafond est celui de Narsil : un toutes les 30 minutes et 20 par jour, ce qui limite les conseils automatiques à vingt petits appels à Haiku par jour au plus. Les conseils que vous demandez ne sont pas décomptés. Les étapes suivantes du guide suivant ajoutent au plus un appel de plus par tour terminé.

Le mode approfondi est d’une autre nature. Il exécute le modèle principal sur toute la transcription. Les types expliquent que la transcription est servie depuis le cache du prompt tant qu’il est chaud, et « billed afresh once the entry lapsed » (facturée à nouveau une fois l’entrée expirée) : l’horloge du cache du guide 8 vous dit dans quel cas vous êtes. C’est pourquoi il ne s’exécute que lorsque vous le demandez.

### La confidentialité

Le contexte part chez le même fournisseur que celui que la session utilise déjà, via le client de la session elle-même. Il s’agit tout de même de votre code : votre dernier message, des noms de fichiers, le texte des erreurs, la réponse de Claude et jusqu’à 3 000 caractères du diff.

`sanitize` passe sur tout le contexte avant son envoi. Il remplace par « [oculto] » (« masqué ») tout `name=value` ou `name: value` dont le nom contient key, token, secret ou password, et toute suite de 32 caractères base64 ou hexadécimaux ou plus. C’est une heuristique : un secret sous une autre forme passe. Si un dépôt ne doit être résumé à aucun modèle au-delà de la conversation principale, désactivez les conseils et les étapes suivantes (`/narsil consejos off`, `/narsil pasos off`).

### Le plan et le code

`docs/plan-advice.md` indique « Status: implemented » (état : implémenté), et c’est vrai pour l’essentiel. Certains chiffres ont changé plus tard, et c’est le code qui s’exécute :

| Plan                                                              | Code aujourd’hui                                                              |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 160 caractères au plus, une ou deux phrases                       | 300, deux ou trois phrases (`69647da`, `d1e6d40`)                             |
| `effort: 'low'`, `maxTokens` ~120, `timeoutMs` ~8000              | `medium`, 2000, 30 000 (`d1e6d40`)                                            |
| contexte plafonné à ~2 000 caractères, 400 premiers de la réponse | 6 000, réponse 1 500 par les deux bouts, plus le diff (`d1e6d40`)             |
| un conseil automatique toutes les 10 minutes                      | toutes les 30 (`1216dc4`)                                                     |
| une ligne dans la bande, coupée à la fin                          | jusqu’à trois lignes (`c564ab5`), ou une fenêtre à lui (`c98adac`, `a95e96a`) |
| conseil de fin de tour : quoi vérifier ou faire ensuite           | une décision de conception, pas de vérifications de routine (`d1e6d40`)       |

Le motif de nettoyage du plan est aussi plus étroit que celui du code.

## Le construire avec Claude

Demandez à Claude un court conseil d’un petit modèle à la fin d’un tour, construit à partir d’un contexte que vous choisissez champ par champ. L’idée que Claude doit bien saisir : le conseil arrive après coup ; le hook le lance sans l’attendre, et c’est le mod lui-même qui limite sa fréquence.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon mod Claude Code `my-pet`, donne un court conseil sur le travail quand un tour se termine. Garde un petit contexte dans des variables de module : le dernier prompt depuis `prompt.submit`, les 15 derniers appels d’outils et les fichiers modifiés depuis `tool.call`, et la réponse finale depuis `turn.complete`. Quand un tour de la conversation principale se termine avec `reason === 'answer'`, sans l’attendre, lis `git diff HEAD --stat --patch` avec `$.process.run` (délai de 5 s), construis un contexte de 6 000 caractères au plus, retire tout ce qui ressemble à un secret, et appelle `$.model.complete` avec `model: 'haiku'`, un prompt système qui demande un conseil concret de 300 caractères au plus sur une décision de conception visible dans le diff, pas de vérifications de routine, et la réponse exacte `SKIP` quand il n’y a rien d’utile. Transmets les cinq derniers conseils et demande de ne pas les répéter. Autorise au plus un conseil toutes les 30 minutes et 20 par jour. Affiche le conseil dans la bande `AbovePrompt` avec un bouton « × » pendant 3 minutes. Teste avec `on('model.complete', ...)` qui simule le modèle : le prompt contient le nom du fichier modifié, `SKIP` n’affiche rien, et une valeur `API_KEY=` n’atteint jamais le prompt.

### Ce qu’il faut vérifier dans la réponse de Claude

1. Le hook `turn.complete` lance le conseil avec `void … .catch(...)` et rend la main aussitôt ; il n’attend jamais `$.model.complete`.
2. Le prompt système autorise la réponse exacte `SKIP`, et un `SKIP` ou une réponse vide n’affiche rien.
3. Chaque partie du contexte a une limite (3 000 caractères de diff, 6 000 en tout), et le contexte entier est nettoyé avant l’envoi, si bien qu’une valeur `API_KEY=` n’atteint jamais le prompt.
4. Le mod vérifie son propre intervalle et son plafond quotidien (un conseil toutes les 30 minutes, 20 par jour) avant d’appeler le modèle. Rien dans le moteur n’en ajoute.
5. Les cinq derniers conseils vont dans le prompt, avec la consigne de ne pas les répéter.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « chaque tour se termine maintenant quelques secondes plus tard, et je ne peux pas écrire avant l’arrivée du conseil ».

### Comment l’auteur l’a demandé

Les conseils sont la seule fonctionnalité de Narsil planifiée dans un document public avant que le code ne soit écrit : `docs/plan-advice.md`, ajouté dans `dd7027a` (2026-10-30) « docs: plan tips about the work in progress » (planifier des conseils sur le travail en cours). C’est un plan, pas les mots de l’auteur ou de l’autrice ; la demande qui y a mené n’a pas été consignée.

#### Ce que dit le plan

L’objectif du plan :

> "Narsil, the mod's sea-serpent mascot, occasionally offers a short, wise, concrete tip about the work in progress: what Claude just did, the error it hit, the change it made."

Traduction en français : Narsil, la mascotte serpent de mer du mod, propose de temps en temps un conseil court, sage et concret sur le travail en cours : ce que Claude vient de faire, l’erreur rencontrée, la modification apportée.

Et son choix entre les deux façons d’interroger un modèle, après un tableau qui les compare :

> "Recommendation: automatic tips through `complete` with `haiku`; the transcript-aware `fork` only when the person asks for it."

Traduction en français : recommandation : des conseils automatiques via `complete` avec `haiku` ; le `fork`, qui connaît la transcription, seulement quand la personne le demande.

Cette recommandation est ce que fait le code aujourd’hui.

#### Consigné : les conseils restent comme ils sont

Quand l’auteur ou l’autrice a repensé la bande pour toutes les conversations, la demande dans `odd/tasks/fleet-view.md`, L1 (2026-11-06), se terminait par :

> "los consejos seguirian funcionando como ahora en cada ventana"

Traduction en français : les conseils continueraient à fonctionner comme maintenant dans chaque fenêtre. Le journal de tâches l’enregistre comme S10, « Tips unchanged » (conseils inchangés), et la conception convenue dans L4 place « the tip and next steps of this window below » (le conseil et les étapes suivantes de cette fenêtre en dessous) la liste.

#### Reconstitution à partir de l’historique des commits

À partir de `git log -- hooks/advice.ts docs/plan-advice.md overlay/tip.js overlay/tip.ps1 overlay/tip.sh`, avec les commits liés de `hooks/register.tsx` :

- `dd7027a` (2026-10-30) « docs: plan tips about the work in progress » (planifier des conseils sur le travail en cours).
- `467a64b` (2026-10-30) « feat(advice): give short, concrete tips about the work in progress » (donner des conseils courts et concrets sur le travail en cours). La première version, qui suit le plan.
- `e379f0e` (2026-10-30) « feat(advice): keep the tip in the floating window for 15 minutes » (garder le conseil dans la fenêtre flottante pendant 15 minutes).
- `c564ab5` (2026-10-30) « fix(band): break long tips into short lines » (couper les longs conseils en lignes courtes).
- `71383d6` (2026-10-30) « fix(texts): agree state counts in number and keep advice gender-neutral toward the person » (accorder en nombre les décomptes d’états et garder les conseils neutres en genre envers la personne). La règle du prompt selon laquelle le féminin ne vaut que pour Narsil.
- `c98adac` (2026-10-31) « feat: open tips whole in their own window on Windows and give the band more room » (ouvrir les conseils en entier dans leur propre fenêtre sous Windows et donner plus de place à la bande), puis `a95e96a` (2026-10-31) « feat: open tips whole in their own window on macOS too » (ouvrir aussi les conseils en entier dans leur propre fenêtre sous macOS).
- `69647da` (2026-11-01) « fix: show tips whole up to 320 characters, cutting a runaway one at its last sentence » (afficher les conseils en entier jusqu’à 320 caractères, en coupant un conseil qui s’emballe à sa dernière phrase).
- `d1e6d40` (2026-11-04) « feat: make tips weigh design choices from the diff and next steps say what the project lacks » (faire peser aux conseils des choix de conception à partir du diff et faire dire aux étapes suivantes ce qui manque au projet). La plus grande correction : son message dit que le conseil de fin de tour « now reads the uncommitted diff (or the last commit) and comments on a design decision, an alternative and its tradeoff, instead of routine checks » (lit désormais le diff non commité, ou le dernier commit, et commente une décision de conception, une alternative et son compromis, au lieu de vérifications de routine), avec Haiku à un effort moyen et des limites plus longues.
- `1216dc4` (2026-11-04) « feat: space automatic tips to one every 30 minutes by default » (espacer les conseils automatiques à un toutes les 30 minutes par défaut). Les préférences enregistrées qui gardaient encore l’ancienne valeur par défaut de 10 passent à 30 une seule fois.

Le schéma : un plan, une première version fidèle, puis des corrections chaque fois que les conseils se sont révélés trop courts, trop fréquents ou trop génériques.

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide. Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

Écrit pour ce guide et vérifié par rapport aux types 2.1.325 (`$.model.complete`, `$.process.run`, `$.clock.now`, `$.ui.log`, `prompt.submit`, `turn.complete`, `ui.render`). Il est adapté de `hooks/advice.ts` et de `hooks/register.tsx` dans [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). L’atome `tip` est déclaré dans `types/index.d.ts` comme dans le premier guide, avec le type `{ text: string; at: number } | null`.

```tsx
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const tip = atom({ plugin: 'my-pet', key: 'tip' } as const, null)
const SYSTEM = [
  'You give ONE concrete tip, at most 300 characters, about the work in progress.',
  'Comment on one design decision visible in the diff: the alternative and its tradeoff.',
  'No routine checks (running the tests, checking the push). Nothing invented.',
  'If there is nothing useful to say, answer exactly SKIP.',
].join('\n')
const EVERY_MS = 30 * 60_000
const SHOWN_MS = 3 * 60_000

let lastPrompt = ''
let lastTipAt: number | null = null
const recent: string[] = []

const sanitize = (text: string) =>
  text
    .replace(
      /[^\s"'`]*(key|token|secret|password)[^\s"'`]*\s*[:=]\s*("[^"]*"|'[^']*'|\S+)/gi,
      '[hidden]',
    )
    .replace(/[A-Za-z0-9+/_-]{32,}={0,2}/g, '[hidden]')

async function diff($: EngineInterface): Promise<string> {
  try {
    const r = await $.process.run(['git', '--no-pager', 'diff', 'HEAD', '--stat', '--patch'], {
      timeoutMs: 5000,
    })
    return r.exitCode === 0 ? r.stdout.slice(0, 3000) : ''
  } catch {
    return ''
  }
}

async function autoTip($: EngineInterface, answer: string): Promise<void> {
  const now = await $.clock.now()
  if (lastTipAt !== null && now - lastTipAt < EVERY_MS) return
  lastTipAt = now
  const context = sanitize(
    `Last message: ${lastPrompt}\nFinal answer: ${answer.slice(0, 1500)}\nChanges:\n${await diff($)}`,
  ).slice(0, 6000)
  const before = recent.length
    ? `\n\nEarlier tips (do not repeat):\n${recent.map((t) => `- ${t}`).join('\n')}`
    : ''
  const reply = await $.model.complete({
    model: 'haiku',
    system: SYSTEM,
    prompt: `Context:\n${context}${before}\n\nYour tip:`,
    effort: 'medium',
    timeoutMs: 30_000,
  })
  if (!reply.isAnswered) return
  const text = reply.text.trim()
  if (!text || /^skip\b/i.test(text)) return
  recent.push(text)
  if (recent.length > 5) recent.shift()
  await update($, tip, () => ({ text, at: now }))
  $.ui.log(`💡 ${text}`)
}

export const register: Register = (on) => {
  on('prompt.submit', async ($, e, next) => {
    if (!e.isMeta) lastPrompt = e.text.slice(0, 400)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    // Never awaited: the tip must not slow the turn.
    if (e.agentId === undefined && e.reason === 'answer')
      void autoTip($, e.answer).catch(() => undefined)
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const shown = await read($, tip)
    if (!shown || (await $.clock.now()) - shown.at > SHOWN_MS) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" gap={1} minWidth={0}>
        <Text wrap="truncate-end">{`💡 ${shown.text}`}</Text>
        <Button key="tip-dismiss" label="×" onPress={() => update($, tip, () => null)} />
      </Box>
    )
  })
}
```

Ici, la bande vérifie l’âge du conseil au moment de dessiner. Narsil marque plutôt le conseil comme estompé lors de son battement, si bien que la bande se redessine quand les trois minutes sont écoulées, et pas seulement au rendu suivant.

## Erreurs fréquentes et comment tester

- **Attendre le modèle dans le hook.** Un hook `turn.complete` qui attend une complétion retient la fin du tour aussi longtemps que le modèle met à répondre. Lancez-la et revenez.
- **Aucun moyen de se taire.** Sans `SKIP`, le modèle trouve toujours quelque chose à dire, et l’essentiel n’est que du remplissage.
- **Envoyer la conversation à un petit modèle par accident.** `$.model.complete` n’envoie que ce que vous y mettez. Décidez champ par champ de ce qui part, plafonnez chacun, et nettoyez l’ensemble.
- **Exécuter le texte du modèle comme du code.** Les fenêtres du conseil reçoivent le texte par l’environnement, jamais à l’intérieur d’un script ou d’une ligne de commande.
- **Aucun plafond de fréquence.** Chaque conseil est une requête facturée. Mettez un intervalle minimal et un plafond quotidien dans le mod ; rien dans le moteur n’en ajoute.
- **Se fier au plan plutôt qu’au code.** Si vous copiez depuis `docs/plan-advice.md`, vérifiez les chiffres par rapport à `hooks/advice.ts` : plusieurs ont changé.

Pour tester, `claude plugin test .` exécute `tests/narsil.test.tsx`, qui répond au modèle avec `on('model.complete', ...)` et `on('model.fork', ...)`, si bien qu’aucune vraie requête n’est faite. Tests à lire : « a finished turn's tip weighs a design choice of the turn, from its diff, with Haiku at medium effort » (le conseil d’un tour terminé pèse un choix de conception du tour, à partir de son diff, avec Haiku à un effort moyen), « SKIP or an empty reply shows nothing » (SKIP ou une réponse vide n’affiche rien), « with the default, a second tip waits 30 minutes » (avec la valeur par défaut, un second conseil attend 30 minutes), « two failures of the same tool give one debugging tip » (deux échecs du même outil donnent un conseil de débogage), « /narsil consejo profundo asks over the conversation itself » (/narsil consejo profundo interroge sur la conversation elle-même), « a secret never reaches the prompt sent to the model » (un secret n’atteint jamais le prompt envoyé au modèle) et « a failed, timed-out or rejected model call shows nothing and breaks nothing » (un appel au modèle échoué, expiré ou rejeté n’affiche rien et ne casse rien). Les fenêtres du conseil ont les leurs : « on Windows a tip opens whole in its own window, and leaves the band and the floating window free » (sous Windows, un conseil s’ouvre en entier dans sa propre fenêtre, et laisse libres la bande et la fenêtre flottante) et « on macOS a tip opens whole in its own window too, through tip.sh, detached » (sous macOS aussi, un conseil s’ouvre en entier dans sa propre fenêtre, via tip.sh, détaché).

## Pour aller plus loin

- `adviceCommand` dans `hooks/register.tsx` gère toutes les commandes `/narsil consejo…` ; `setAdvice` enregistre les préférences avec `$.store`.
- La migration de la valeur par défaut enregistrée de 10 à 30 minutes (`ADVICE_MIGRATED_KEY`) déplace une seule fois un ancien 10 et conserve un 10 choisi ensuite.
- `lines` dans `hooks/advice.ts` répartit un conseil en lignes et coupe un mot plus long qu’une ligne, comme un chemin ou une URL.
- Le guide suivant réutilise le même contexte, le même `describe` et le même appel au modèle pour proposer des étapes suivantes.
