---
title: Les vulnérabilités avec OSV.dev
description: 'Comment Narsil Check interroge OSV.dev sur chaque paquet installé en une requête groupée, classe chaque avis par sa propre note ou son vecteur CVSS, et compte une seule fois les avis jumeaux.'
route: check
order: 14
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/osv.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/words.ts
  - repo: check
    path: hooks/adapter.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/vulns.test.tsx
  - repo: check
    path: odd/tasks/vulnerabilities.md
---

## Ce que ça fait

Chaque écosystème a son propre outil d’audit : `npm audit`, `pip-audit`, `cargo-audit`, `govulncheck`. Un projet avec un front web, un service Python et une application Gradle en demanderait trois installés, chacun avec sa propre sortie. Narsil Check pose la question à un seul endroit pour tous.

Sous **Actualizaciones**, il y a une section **Vulnerabilidades**. Après chaque analyse, elle lit les paquets installés du projet et interroge [OSV.dev](https://osv.dev), la base ouverte qui réunit les avis de GitHub, PyPI, Go, crates.io, RubyGems et d’autres. Pendant qu’elle travaille, la section dit `Buscando vulnerabilidades en OSV.dev…` (« recherche de vulnérabilités dans OSV.dev… »). Ensuite :

```text
● ▾ Vulnerabilidades · 3
  3 vulnerabilidades en 2 de 412 paquetes · 1 alta · 2 moderadas
  ● ▾ Alta (1)
    left-pad-ish 1.0.2 · indirecta · GHSA-xxxx-xxxx-xxxx
      Prototype pollution in parse()
      Se corrige en 1.0.3
```

Le paquet et l’identifiant ci-dessus sont des illustrations. La ligne de résumé signifie « 3 vulnérabilités dans 2 paquets sur 412 · 1 élevée · 2 modérées ». Les résultats sont groupés par sévérité, **Crítica**, **Alta**, **Moderada**, **Baja** et **Sin clasificar** (« non classée »), chaque groupe se repliant seul. Chaque résultat montre le paquet et sa version, `indirecta` quand vous ne le déclarez pas vous-même, l’identifiant de l’avis, un résumé d’une ligne, et la première version qui le corrige, ou `Sin versión que la corrija` (« aucune version ne la corrige »).

Le point de la section est rouge pour une sévérité critique ou élevée, jaune pour une modérée, gris quand il ne reste que des résultats faibles ou non classés, et vert quand rien n’a été trouvé. La section s’ouvre d’elle-même la première fois qu’elle trouve quelque chose. Un appui sur un résultat le copie, avec sa sévérité, sa correction et son lien OSV, prêt à coller dans une issue.

La liste des mises à jour utilise aussi le résultat. Une mise à jour dont la nouvelle version corrige quelque chose le dit dans sa ligne, `· corrige 2 vulnerabilidades` (« corrige 2 vulnérabilités »), et passe en tête de son groupe.

## Comment ça marche à l’intérieur

`hooks/osv.ts` est pur : le corps de la requête, la lecture des réponses, la sévérité, la version qui corrige, la fusion des jumeaux et le texte à copier. `hooks/register.tsx` collecte les paquets, récupère les données, les met en cache et dessine. Comme dans le reste du mod, les tests vérifient les parties difficiles sans réseau.

### Sur quels paquets porte la question

`auditedPackages` interroge l’adaptateur de chaque écosystème détecté. Là où l’adaptateur sait lire un lockfile (`treeOf`), il donne tout l’arbre installé : ce que vous déclarez et ce que vos dépendances tirent avec elles. Le README les liste : `package-lock.json`, `Cargo.lock`, `uv.lock` ou `poetry.lock`, `Gemfile.lock`, `pubspec.lock`, `Package.resolved`, et les lignes `require` de `go.mod`, indirectes comprises. Là où il n’y a pas d’arbre à lire, comme pour Maven et NuGet, ce sont les dépendances déclarées qui sont utilisées, avec leur version installée ou de base.

L’arbre complet compte. La plupart des avis tombent sur des paquets que personne n’a déclarés. Un paquet qui n’est pas l’un des vôtres reçoit la marque `indirecta`, pour que vous sachiez qu’il faudra mettre à jour autre chose.

Le wrapper Gradle est laissé de côté : OSV n’a pas d’écosystème pour lui, et le commentaire du code dit pourquoi c’est important, « one unknown name fails the whole batch » (un seul nom inconnu fait échouer tout le lot).

### Une seule requête groupée

Le point d’accès groupé d’OSV, `https://api.osv.dev/v1/querybatch`, accepte de nombreuses questions en un seul POST. `batchBody` le construit :

```json
{
  "queries": [
    { "package": { "name": "left-pad-ish", "ecosystem": "npm" }, "version": "1.0.2" },
    { "package": { "name": "pyyaml", "ecosystem": "PyPI" }, "version": "6.0.1" }
  ]
}
```

Chaque écosystème porte le nom qu’utilise OSV (`OSV_ECOSYSTEM`) : `npm`, `PyPI`, `Go`, `crates.io`, `Pub`, `Maven`, `NuGet`, `RubyGems`, `SwiftURL`, `GitHub Actions`. Un paquet Swift est nommé par son URL sans le schéma, comme `github.com/acme/shop-kit`.

Le lot est envoyé par tranches de 500 (`BATCH_SIZE`) ; le commentaire note qu’OSV accepte au plus 1 000 questions par lot. « Une seule requête » signifie donc une requête pour la plupart des projets, quelques-unes pour un très grand arbre, et jamais une requête par paquet.

Le lot répond, dans le même ordre que les questions, seulement l’`id` de chaque avis et sa date `modified`. Le journal de tâches l’a consigné pendant les essais : « the batch returns ids only, details come from /v1/vulns/{id} » (le lot ne renvoie que des ids, les détails viennent de /v1/vulns/{id}). Pour chaque paquet qui a des résultats, le mod récupère donc `https://api.osv.dev/v1/vulns/<id>`, huit paquets à la fois (`OSV_CONCURRENCY`).

### Le cache des avis

Les détails sont gardés dans `$.store` sous `osv:<id>`, avec la date `modified` qu’a donnée le lot. L’audit suivant ne récupère de nouveau un détail que si OSV dit qu’il a changé. Seuls les champs que lit le panneau sont gardés (identifiant, alias, résumé, première ligne des détails, champs de sévérité et plages affectées) ; le commentaire dit pourquoi, « the full record can hold pages of details » (la fiche complète peut contenir des pages de détails).

### La sévérité : d’abord le mot de l’avis, puis CVSS

`severityOf` cherche d’abord une note que l’avis donne en toutes lettres : `database_specific.severity`, puis le même champ ou `ecosystem_specific.severity` de chaque paquet affecté. Les avis de GitHub portent `CRITICAL`, `HIGH`, `MODERATE` ou `LOW`. `medium` est lu comme modéré.

Ce n’est qu’en l’absence d’un tel mot qu’il calcule un score à partir du vecteur CVSS de l’avis, une chaîne comme `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H` qui décrit le fonctionnement d’une attaque : par le réseau ou en local, avec quelle difficulté, quels privilèges elle demande, si un utilisateur doit agir, et ce qu’elle coûte en confidentialité, intégrité et disponibilité.

`cvss3Score` ne prend un score nulle part : il calcule le score de base à partir du vecteur avec les poids et les formules de la spécification CVSS v3.1 de FIRST, y compris sa règle d’arrondi et les formules différentes quand la portée change (`S:C`). Ensuite, `severityOfScore` le place dans les tranches de CVSS : 9,0 et plus critique, 7,0 élevée, 4,0 modérée, au-dessus de 0 faible. Le vecteur ci-dessus obtient 9,8, critique.

Deux limites découlent du code :

- Seuls les vecteurs `CVSS:3.0/` et `CVSS:3.1/` sont lus. Un vecteur `CVSS:4.0/` est ignoré, et un avis qui n’a que celui-là et aucun mot est **Sin clasificar**.
- Un vecteur 3.0 est noté avec les formules de 3.1. Les deux versions diffèrent surtout par l’étape d’arrondi, si bien qu’un score peut différer d’un dixième dans de rares cas.

Pourquoi d’abord le mot ? Le journal de tâches énonce l’hypothèse : « severity comes from the advisory's own rating … and, failing that, from its CVSS v3 vector's base score » (la sévérité vient de la note propre de l’avis … et, à défaut, du score de base de son vecteur CVSS v3). La note de GitHub est celle qu’affiche `npm audit`, si bien que les deux outils sont d’accord là où ils se recoupent.

### La version qui corrige

Un avis liste les plages affectées sous forme d’événements : `introduced`, `fixed`, et d’autres. `fixedFor` réunit toutes les versions `fixed` de ce paquet (en comparant les noms comme le fait l’écosystème : PyPI ignore la casse et traite `-`, `_` et `.` de la même façon, NuGet ignore la casse), garde celles qui sont au-dessus de la version installée, et prend la plus basse. C’est la plus petite mise à jour qui la corrige.

### Les jumeaux : GHSA et PYSEC

Le même problème Python existe souvent deux fois dans OSV : une fois comme avis GitHub (`GHSA-…`) et une fois dans la base de PyPA (`PYSEC-…`), chacun listant l’autre dans ses `aliases`. Compter les deux doublerait le nombre.

`mergeVulns` trie les avis d’un paquet avec GHSA en premier, puis les parcourt. Un avis dont l’id ou les alias rencontrent l’id ou les alias d’un avis déjà gardé est un jumeau : il est écarté, mais il complète ce qui manque à celui qui est gardé, la sévérité si celle-ci n’était pas classée et la version qui corrige s’il n’y en avait pas. Le commentaire dit pourquoi GHSA l’emporte : « the GHSA kept for its rating » (le GHSA gardé pour sa note).

C’est aussi pourquoi le README note que le compte porte sur les avis, pas sur les paquets. `npm audit` compte en plus chaque paquet qui ne fait que dépendre d’un paquet vulnérable ; ici, ils ne sont pas répétés.

### Ce qui est envoyé à OSV.dev, en termes simples

Deux sortes de requêtes quittent votre machine, toutes deux via `$.http.fetch`, que les types 2.1.325 décrivent comme une récupération « through the host (never the plugin's own network) » (via l’hôte, jamais par le propre réseau du plugin) :

- **Le lot**, un POST vers `api.osv.dev/v1/querybatch` avec, pour chaque paquet, son nom, son écosystème et sa version. C’est tout le corps.
- **Les détails**, un GET vers `api.osv.dev/v1/vulns/<id>` pour chaque avis que le lot a nommé et que le cache ne contient pas.

Aucun contenu de fichier, aucun chemin, aucun nom de dépôt et aucun code n’est envoyé. Mais une liste de noms et de versions n’est pas rien :

- Elle décrit votre stack, jusqu’aux paquets transitifs et à leurs versions exactes.
- Les noms peuvent être privés. Un paquet npm interne `@acme/billing-core`, un module Go `git.acme.example/shop/api` ou un paquet Swift `github.com/acme/private-kit` révèle un nom que vous ne publieriez peut-être pas. OSV ne le connaîtra pas, mais le nom a quitté la machine.
- Comme pour toute requête web, OSV voit l’adresse d’où elle vient.

Pour la plupart des projets, c’est un échange acceptable contre une source gratuite et unique d’avis. Pour un projet dont les noms de dépendances sont eux-mêmes confidentiels, un mod pourrait ignorer les noms qui correspondent à un scope privé, ou laisser la personne désactiver l’audit.

### Quand il s’exécute

`runAudit` s’exécute après chaque analyse, en arrière-plan pour que la liste s’affiche d’abord, ainsi que sur son propre bouton **Consultar de nuevo** (« vérifier de nouveau »), sur **Reintentar** (« réessayer ») après une erreur, et avec `/narsil-check vulns`. Un seul audit s’exécute à la fois. Une erreur HTTP du lot affiche `No pude consultar OSV.dev: OSV respondió <status>` (« je n’ai pas pu interroger OSV.dev : OSV a répondu <status> »).

### Le README, le journal de tâches et le code

Le README et le journal de tâches disent « nueve ecosistemas » (« neuf écosystèmes »). Le code interroge dix noms, chaque adaptateur sauf le wrapper Gradle. Le commit qui a ajouté l’audit (`912478b`) dit « Each severity copies its own list » (chaque sévérité copie sa propre liste) ; cela a été remplacé dans `b3ad055` par la copie d’un résultat par appui, ce que fait le code aujourd’hui.

## Le construire avec Claude

Demandez à Claude une section qui envoie les paquets installés à OSV.dev et regroupe par sévérité ce qui revient. L’idée que Claude doit bien saisir : le travail se fait en quelques requêtes groupées, et la sévérité comme la version qui corrige viennent de chaque avis lui-même.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas le prompt de l’auteur ou de l’autrice.

> Dans mon mod Claude Code `my-panel`, ajoute une section Vulnérabilités pour les projets npm. Lis chaque paquet installé et sa version depuis `package-lock.json` (ses entrées `packages`), marque comme indirects ceux qui ne sont pas dans `package.json`, et envoie-les à `https://api.osv.dev/v1/querybatch` avec `$.http.fetch`, sous la forme `{ queries: [{ package: { name, ecosystem: "npm" }, version }] }`, par tranches de 500. Pour chaque id que renvoie le lot, récupère `/v1/vulns/<id>` et mets-le en cache dans `$.store` sous `osv:<id>` avec sa date `modified`, en ne le récupérant de nouveau que quand celle-ci change. Classe chaque avis d’abord d’après `database_specific.severity` ; s’il est absent, calcule le score de base CVSS v3.1 à partir de son vecteur et utilise les tranches 9, 7, 4. Fusionne les avis qui sont des alias l’un de l’autre, en gardant celui de GHSA. Affiche la plus basse version `fixed` au-dessus de celle qui est installée. Groupe par sévérité, la pire d’abord. Teste la fonction CVSS sur quelques vecteurs connus et leurs scores publiés, et le lot avec un `http.fetch` simulé.

### Ce qu’il faut vérifier dans la réponse de Claude

1. Les paquets viennent du lockfile, c’est-à-dire de tout l’arbre installé, et ceux que vous ne déclarez pas sont marqués comme indirects.
2. Ils partent vers `https://api.osv.dev/v1/querybatch` par tranches de 500, jamais une requête par paquet.
3. Chaque détail est récupéré depuis `/v1/vulns/<id>` et mis en cache dans `$.store` sous `osv:<id>` avec sa date `modified`, et n’est récupéré de nouveau que quand cette date change.
4. La sévérité est d’abord le mot de l’avis lui-même. Seulement en son absence, le score de base CVSS v3 est calculé et rapporté aux seuils 9, 7 et 4.
5. Les avis qui sont des alias les uns des autres (GHSA et PYSEC) comptent une seule fois, en gardant celui de GHSA, et la correction affichée est la plus basse version `fixed` au-dessus de celle qui est installée.

Si une vérification échoue, décrivez à Claude ce que vous voyez : « le même problème Python apparaît deux fois, une fois avec un identifiant GHSA et une fois avec un identifiant PYSEC ».

### Comment l’auteur l’a demandé

Celle-ci est consignée. `odd/tasks/vulnerabilities.md` dans narsil-check cite les mots de l’auteur ou de l’autrice dans sa spec S1 et dans son entrée de journal L1 (2026-11-05). Le guide 1 de ce parcours cite les deux mêmes messages pour la conception du panneau ; ici, ils comptent pour l’origine des données.

#### Consigné : la demande

S1 cite le premier message :

> "podemos checkear vulnerabilidades de la misma forma? es decir crear un sub menu de vulnerabilidades que haga pnpm audit o similar?"

Traduction en français : peut-on vérifier les vulnérabilités de la même façon, c’est-à-dire créer un sous-menu de vulnérabilités qui lance pnpm audit ou quelque chose de similaire ?

L’auteur ou l’autrice a demandé « pnpm audit o similar » (pnpm audit ou quelque chose de similaire). Le journal de tâches consigne que l’agent a proposé autre chose, et que l’auteur ou l’autrice l’a accepté avec « si » (« oui »). Avec les mots de l’agent, dans la même spec : « OSV.dev instead of each ecosystem's audit tool; the full tree from the lockfile where one is read, direct dependencies elsewhere » (OSV.dev au lieu de l’outil d’audit de chaque écosystème ; l’arbre complet depuis le lockfile là où il y en a un à lire, les dépendances directes ailleurs). C’est la décision qu’explique ce guide : une seule base au lieu de neuf outils, dont la plupart n’étaient pas installés sur la machine.

#### Consigné dans le journal de tâches : l’hypothèse et les essais

Ce sont les notes de l’agent, pas les mots de l’auteur ou de l’autrice. L’hypothèse de la spec :

> "Assumption: severity comes from the advisory's own rating (GitHub's CRITICAL, HIGH, MODERATE, LOW) and, failing that, from its CVSS v3 vector's base score; a finding with neither is "sin clasificar". Advisories that are the same issue under two ids (GHSA and PYSEC) count once."

Traduction en français : « Hypothèse : la sévérité vient de la note propre de l’avis (CRITICAL, HIGH, MODERATE, LOW de GitHub) et, à défaut, du score de base de son vecteur CVSS v3 ; un résultat qui n’a ni l’un ni l’autre est "sin clasificar" (non classé). Les avis qui sont le même problème sous deux ids (GHSA et PYSEC) comptent une seule fois. »

L’entrée de journal L2 consigne les essais qui ont façonné le code : un seul lot a répondu à la fois pour npm, PyPI, Go, Maven, NuGet et crates.io ; le lot ne renvoie que des ids ; les paquets Swift sont `SwiftURL` nommés `github.com/owner/repo` ; et sur la machine, seuls npm et pnpm avaient des outils d’audit, « no pip-audit, cargo-audit or govulncheck » (pas de pip-audit, cargo-audit ni govulncheck). L3 consigne que sur un vrai projet, OSV a trouvé les mêmes avis que signale `npm audit`, que `npm audit` répartit sur davantage de paquets « because it also names the packages that only depend on them » (parce qu’il nomme aussi les paquets qui ne font que dépendre d’eux).

#### Reconstitution à partir de l’historique des commits

À partir de `git log -- hooks/osv.ts` dans narsil-check :

- `912478b` (2026-11-04) « feat: check known vulnerabilities with OSV.dev in a collapsible section » (vérifier les vulnérabilités connues avec OSV.dev dans une section repliable). Toute la fonctionnalité en un seul commit : le lot, le score CVSS, la fusion, la version qui corrige et les marques sur les mises à jour.
- `b3ad055` (2026-11-06) « feat: fold upgrade and vulnerability groups, copy a row on click, … » (replier les groupes de mises à jour et de vulnérabilités, copier une ligne au clic, …). Les groupes de sévérité se replient seuls ; un appui copie un résultat.
- `7048580` (2026-11-09) « feat: check the Gradle wrapper and GitHub Actions for upgrades » (vérifier les mises à jour du wrapper Gradle et des GitHub Actions). Son message, à propos du wrapper : « OSV is not asked about it » (OSV n’est pas interrogé à son sujet).

## Code de référence

Ce code est une réponse correcte, écrite pour ce guide. Lisez-le pour comprendre comment les pièces s’assemblent et pour le comparer avec ce que Claude a écrit pour vous : Claude peut choisir d’autres noms ou un autre ordre et avoir quand même raison.

Voici une version réduite de l’idée, écrite pour ce guide et vérifiée par rapport aux types de Claude Code 2.1.325 (`$.http.fetch`). Elle est adaptée de `hooks/osv.ts` et de `auditProject` dans `hooks/register.tsx` dans [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Elle laisse de côté le calcul CVSS et le cache.

```ts
import type { EngineInterface } from 'claude-code'

type Pkg = { name: string; version: string; ecosystem: 'npm' | 'PyPI' }
type Severity = 'critical' | 'high' | 'moderate' | 'low' | 'unknown'
type Vuln = { id: string; aliases: string[]; severity: Severity }

const OSV = 'https://api.osv.dev/v1'

function severityOf(advisory: { database_specific?: { severity?: unknown } }): Severity {
  const word = String(advisory.database_specific?.severity ?? '').toLowerCase()
  if (word === 'critical' || word === 'high' || word === 'low') return word
  if (word === 'moderate' || word === 'medium') return 'moderate'
  return 'unknown' // the real mod computes the CVSS v3 score here
}

// Twins alias each other: keep one, the GHSA first.
function merge(vulns: Vuln[]): Vuln[] {
  const out: Vuln[] = []
  const ghsaFirst = [...vulns].sort(
    (a, b) => Number(b.id.startsWith('GHSA-')) - Number(a.id.startsWith('GHSA-')),
  )
  for (const v of ghsaFirst) {
    const names = new Set([v.id, ...v.aliases])
    const twin = out.find((o) => names.has(o.id) || o.aliases.some((a) => names.has(a)))
    if (!twin) out.push(v)
    else if (twin.severity === 'unknown') twin.severity = v.severity
  }
  return out
}

export async function audit($: EngineInterface, packages: Pkg[]): Promise<Map<Pkg, Vuln[]>> {
  const found = new Map<Pkg, Vuln[]>()
  for (let i = 0; i < packages.length; i += 500) {
    const slice = packages.slice(i, i + 500)
    const res = await $.http.fetch(`${OSV}/querybatch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        queries: slice.map((p) => ({
          package: { name: p.name, ecosystem: p.ecosystem },
          version: p.version,
        })),
      }),
    })
    if (!res.ok) throw new Error(`OSV answered ${res.status}`)
    const results = (JSON.parse(res.text).results ?? []) as { vulns?: { id: string }[] }[]
    for (const [j, r] of results.entries()) {
      const vulns: Vuln[] = []
      for (const { id } of r.vulns ?? []) {
        const detail = await $.http.fetch(`${OSV}/vulns/${encodeURIComponent(id)}`)
        if (!detail.ok) continue
        const a = JSON.parse(detail.text)
        vulns.push({
          id,
          aliases: Array.isArray(a.aliases) ? a.aliases : [],
          severity: severityOf(a),
        })
      }
      if (vulns.length > 0) found.set(slice[j] as Pkg, merge(vulns))
    }
  }
  return found
}
```

Exécutez-la après votre analyse sans l’attendre dans un hook, gardez son résultat dans un atome avec d’abord un état `scanning`, et dessinez un repli par sévérité à partir de cet atome.

## Erreurs fréquentes et comment tester

Elles viennent du code et des tests de Narsil Check :

- **Une requête par paquet.** Un lockfile contient des centaines de paquets. Groupez-les.
- **Un seul nom d’écosystème inconnu dans le lot.** Il fait échouer tout le lot. Laissez de côté ce qu’OSV ne connaît pas.
- **Seulement les paquets déclarés.** La plupart des avis portent sur des paquets transitifs. Lisez le lockfile là où il y en a un.
- **Faire confiance à un score stocké.** Les avis ne portent souvent qu’un vecteur. Calculez le score, et testez la fonction sur des scores publiés.
- **Compter les jumeaux deux fois.** GHSA et PYSEC sont des alias l’un de l’autre. Fusionnez par alias.
- **« Corrigé dans » comme premier événement `fixed`.** Un avis peut avoir plusieurs plages. Prenez la plus basse correction au-dessus de ce qui est installé.
- **Récupérer chaque détail à chaque fois.** Mettez en cache par id et par `modified`.
- **Oublier ce que révèle la requête.** Les noms de paquets peuvent être privés. Dites ce qui est envoyé.

Pour tester, `claude plugin test .` exécute `tests/vulns.test.tsx`. « a CVSS v3 vector's base score is FIRST's » (le score de base d’un vecteur CVSS v3 est celui de FIRST) vérifie la formule, « severity is the advisory's own rating, else its CVSS score's band » (la sévérité est la note propre de l’avis, sinon la tranche de son score CVSS) l’ordre, « the fixing version is the lowest fixed event past the installed one » (la version qui corrige est le plus bas événement fixed après celle qui est installée) la correction, et « one issue under a GHSA and a PYSEC id counts once, the GHSA kept » (un problème sous un id GHSA et un id PYSEC compte une fois, le GHSA étant gardé) la fusion. « OSV's batch is asked by each ecosystem's name and answered in order » (le lot d’OSV est interrogé avec le nom de chaque écosystème et répond dans l’ordre) vérifie le corps. Avec `on('http.fetch', ...)` qui répond à la place d’OSV, « the vulnerabilities section lists findings in folding severity groups, copies one on a press, and marks the upgrade that fixes them » (la section des vulnérabilités liste les résultats en groupes de sévérité repliables, en copie un à l’appui, et marque la mise à jour qui les corrige) pilote le panneau, et « an advisory read before is not fetched again while OSV says it has not changed » (un avis déjà lu n’est pas récupéré de nouveau tant qu’OSV dit qu’il n’a pas changé) compte les requêtes de détails.

## Pour aller plus loin

- Noter aussi les vecteurs `CVSS:4.0/`. Sa formule est différente et plus longue ; un test sur des scores publiés est indispensable.
- Laisser la personne exclure des scopes privés du lot, ou désactiver l’audit pour un projet.
- OSV a aussi un point d’accès `/v1/query` qui renvoie les avis complets pour un paquet. Pour une poignée de paquets, il évite la seconde série de requêtes.
- Le guide suivant change de sujet : une liste de choses à faire tenue par projet, hors de git.
