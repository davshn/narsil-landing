---
title: Dessin et animations
description: 'Comment Narsil est dessinée : une pose par état, art clair et sombre dans un seul SVG, boucles animées tirées de vidéos d’IA et la limite de 131072 caractères de la bande.'
route: pet
order: 2
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/sprite.ts
  - repo: pet
    path: hooks/art.ts
  - repo: pet
    path: tools/build-art.ps1
  - repo: pet
    path: tools/anim-sources.ps1
  - repo: pet
    path: tools/encode-anim.ps1
  - repo: pet
    path: tools/build-animated.ps1
  - repo: pet
    path: odd/tasks/animated-poses.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Ce que ça fait

En dehors du terminal, la bande au-dessus du prompt montre Narsil, un serpent de mer chibi, dans une pose qui correspond à l’état de la conversation. Elle salue une nouvelle conversation, somnole pendant qu’elle vous attend, travaille pendant que Claude travaille, se penche vers vous quand elle a besoin de vous, fête la fin du tour et a l’air inquiète en cas d’erreur.

Chaque pose est dessinée deux fois, une fois pour un fond clair et une fois pour un fond sombre, et la bande choisit la bonne selon le jeu de couleurs de votre système. Chaque pose est aussi une courte boucle animée : elle bouge vraiment, respire, cligne des yeux et ondule, au lieu d’être une image fixe entourée d’effets.

Narsil grandit aussi. À mesure qu’elle gagne de l’expérience, elle passe par cinq stades, du nouveau-né à l’adulte, et chaque stade a son propre jeu de poses. Les montées de niveau et les nouveaux stades ont leur propre célébration par-dessus l’image.

Dans le terminal, il n’y a pas d’image. La bande dessine à la place un petit visage en texte pour chaque humeur, comme `~(-ᴗ-)~ z` pendant qu’elle dort.

Le dessin est la partie que l’on remarque en premier, et il fait un vrai travail : la pose et le halo coloré qui l’entoure indiquent l’état avant que vous ne lisiez le moindre mot.

## Comment ça marche à l’intérieur

### D’où viennent les images

L’art est fait d’images peintes, pas de formes vectorielles. Elles se trouvent sous forme de fichiers image dans `assets/raw/<pose>-<claro|oscuro>.png` pour le nouveau-né, et dans `assets/raw/etapa2` à `assets/raw/etapa5` pour les stades suivants (`claro` signifie clair, `oscuro` sombre). Les poses portent le nom des états : `hola`, `parada`, `trabajando`, `necesita`, `terminado` et `error`, plus une pose `base` utilisée en repli.

Un mod ne peut pas lire de fichiers image au moment du dessin, les images sont donc transformées en code. `tools/build-art.ps1`, un script Windows PowerShell, retire le fond uni de chaque image (blanc ou transparent, en progressant depuis les bords), la recadre sur le personnage, la met à l’échelle à 150 pixels de haut, et écrit `hooks/art.ts` ainsi que les fichiers sous `hooks/art/`, chaque image y étant intégrée sous forme de données. Ses commentaires disent qu’il retire aussi « any fake 'transparency' checkerboard an image generator painted » (tout faux damier de « transparence » qu’un générateur d’images aurait peint) et une ligne de cadre claire qu’« an image generator drew » (un générateur d’images a dessinée) ; le dépôt ne consigne pas quel outil d’images a été utilisé.

`hooks/art.ts` lui-même est court et généré : il importe un module par stade et par thème et expose `ART`, indexé par stade, puis par thème, puis par pose. Sa première ligne dit « do not edit by hand » (ne pas modifier à la main).

### Choisir une image

`art` dans `hooks/sprite.ts` choisit l’image pour une humeur, un thème et un stade :

1. La pose voulue est `hola` pour la salutation, et sinon la pose de l’état de l’humeur (`POSE`).
2. Si une boucle animée existe pour ce stade, ce thème et cette pose (`ANIMATED`), elle l’emporte.
3. Sinon, elle cherche l’image fixe, en se repliant sur la pose `base` du stade, puis sur les stades précédents, puis sur l’autre thème.

Cette chaîne de repli est la raison pour laquelle l’art a pu être ajouté stade par stade : un stade qui n’était pas encore dessiné affichait tout de même quelque chose de sensé.

### Un SVG, deux thèmes

`sprite` renvoie un seul document SVG qui contient les deux thèmes. L’image claire se trouve dans un groupe de classe `th-claro`, l’image sombre dans `th-oscuro`, et une règle CSS à l’intérieur du SVG affiche l’une ou l’autre :

```css
.th-oscuro {
  display: none;
}
@media (prefers-color-scheme: dark) {
  .th-claro {
    display: none;
  }
  .th-oscuro {
    display: inline;
  }
}
```

Le mod n’a jamais besoin de connaître le thème. La surface qui dessine le SVG applique le jeu de couleurs de la personne qui regarde, si bien que le même dessin est correct en même temps sur un bureau clair et sur un téléphone sombre.

### Faire bouger une image fixe

Avant l’existence des boucles animées, toute la vie venait du CSS à l’intérieur du SVG, et ce code est toujours utilisé pour toute pose sans boucle. Le commentaire en tête de `hooks/sprite.ts` énumère les couches :

- L’image entière nage, se balance, bondit ou tremble au moyen de transformations CSS, à un rythme fixé par son stade (`STAGE_MOTION`, `motion`), avec une ombre et des éclaboussures synchronisées.
- Son corps est découpé en travers en neuf bandes qui ne font que se toucher (`cuts`, `bands`), et chaque bande ondule avec un léger décalage, de sorte qu’une vague parcourt le corps de la tête à la queue. Du cou vers le haut, elle forme une seule bande, si bien qu’aucune découpe ne traverse son visage.
- Autour d’elle : une aura pulsante dans la couleur de l’état (`aura`), des bulles, des ronds dans l’eau, des confettis quand elle a terminé, et des accessoires pour chaque humeur.
- `@media (prefers-reduced-motion: reduce)` désactive toutes les animations.

L’historique des commits explique la règle des « bandes qui ne font que se toucher ». Une approche antérieure superposait à l’image une seconde copie déformée, et des correctifs comme `9f9cc75` « fix: draw Narsil as one sharp picture so no part of her shows twice » (dessiner Narsil comme une seule image nette pour qu’aucune partie d’elle n’apparaisse deux fois) et `6ac340e` « fix: draw Narsil's head once instead of a turning copy over the body » (dessiner la tête de Narsil une seule fois au lieu d’une copie qui tourne par-dessus le corps) ont supprimé cet effet de dédoublement.

### Les boucles animées

Chaque pose possède désormais aussi une vraie boucle animée : une image WebP animée tirée d’une courte vidéo générée par IA, intégrée sous forme de données dans `hooks/art/anim/` et rassemblée par `hooks/art/animated.ts`. Quand `art` trouve une boucle, `picture` la dessine entière et saute le découpage en bandes, parce que la boucle bouge déjà d’elle-même. L’aura, le badge et les effets l’entourent toujours.

### La limite de taille

Tout ce qui précède doit tenir dans une seule chaîne. La `source` de l’élément `Svg` est, selon les termes des types 2.1.325, « The SVG document, `<svg ...>...</svg>`, at most 131072 characters. » (le document SVG, `<svg ...>...</svg>`, d’au plus 131072 caractères). Les deux thèmes partagent ce budget, parce qu’ils se trouvent dans le même dessin.

Cette limite a façonné les boucles :

- `tools/encode-anim.ps1` cherche la meilleure qualité qui maintient une boucle sous 38 Ko (`-TargetKB 38`).
- `tools/build-animated.ps1` refuse toute boucle de plus de 40 Ko (`$MAX_BYTES`). Intégrées en données base64, deux boucles de 40 Ko occupent environ 109 000 caractères, ce qui laisse de la place pour le reste du dessin.
- Un test de `tests/narsil.test.tsx` le prouve : « two loops of the largest size tools/build-animated.ps1 lets in, one per theme, still fit the band at every stage and celebration » (deux boucles de la plus grande taille que tools/build-animated.ps1 accepte, une par thème, tiennent encore dans la bande à chaque stade et à chaque célébration).
- `tools/build-animated.ps1` écrit un module par stade et par thème parce que, comme le dit son commentaire, « the engine reads no file over 1 MiB » (le moteur ne lit aucun fichier de plus de 1 Mio).

La fenêtre flottante n’a pas cette limite, elle affiche donc une copie plus nette de chaque boucle. `pictureDefs` marque une boucle avec `data-loop="<name>"`, et la page de la fenêtre la remplace par une version de 200 pixels que le serveur local sert depuis `assets/anim-hq`.

### Le coût au moment du dessin

Un dessin complet est volumineux (le code parle de « some 100 KB », environ 100 Ko), et la bande comme la fenêtre redemandent sans cesse le même. `sprite` conserve les huit derniers dessins dans une `Map` dont la clé combine humeur, stade et jalon, et `pushOverlay` dans `hooks/register.tsx` n’envoie le SVG à la fenêtre que lorsqu’il a changé (commit `19106d1` « perf: reuse Narsil's drawing and send it to the window only when it changes », réutiliser le dessin de Narsil et ne l’envoyer à la fenêtre que lorsqu’il change).

## Comment on l’a demandé à l’IA

Cette histoire comporte deux parties. L’art fixe et son mouvement CSS sont venus en premier, et leurs demandes n’ont pas été conservées. Les boucles animées ont un journal de tâches public, `odd/tasks/animated-poses.md` dans narsil-pet, qui cite mot pour mot les demandes de l’auteur ou de l’autrice.

### Reconstitution à partir de l’historique des commits (art fixe)

D’après `git log -- hooks/sprite.ts hooks/art.ts tools/build-art.ps1` :

- `d48c95c` (2026-10-30) « feat(art): add painted art for each state and its build tool » (ajouter un art peint pour chaque état et son outil de construction), puis `d31a6ba` « feat(sprite): draw Narsil from the art with layered animations » (dessiner Narsil à partir de l’art avec des animations en couches).
- `9bfa039` (2026-10-30) « feat: let Narsil grow through five stages as she levels up » (laisser Narsil grandir en cinq stades à mesure qu’elle monte de niveau) et `7a964d1` « feat: draw Narsil as a hatchling at stage 1 and split the art per stage » (dessiner Narsil en nouveau-né au stade 1 et répartir l’art par stade).
- Le 2026-10-31, un commit par stade et par thème, comme `ff02847` « feat: draw stage 3 dark art » (dessiner l’art sombre du stade 3) et `eed13b0` « feat: draw stage 5 light art » (dessiner l’art clair du stade 5).
- `9f9cc75` et `6ac340e` (2026-10-31), les correctifs de l’image dédoublée décrits plus haut.
- `e79c512` (2026-11-09) « feat: make Narsil's body undulate and her rest less mechanical » (faire onduler le corps de Narsil et rendre son repos moins mécanique). Son message décrit les bandes qui « only meet » (ne font que se toucher) et indique qu’au repos elle « only starts to snore after a minute » (ne commence à ronfler qu’au bout d’une minute).

### La demande consignée pour les boucles animées

La première entrée du journal, L1, datée du 2026-11-15 :

> "quiero cambiar las imagenes de narsil, por unas realmente animadas, donde tenga movimiento la serpiente, esto es posible? podriamos usar mi suscripcion de gemini plis para generar las animaciones, estoi haria que el mod consumiera demasiados recursos?"

Traduction en français : l’auteur ou l’autrice veut remplacer les images de Narsil par des images réellement animées où le serpent bouge, demande si c’est possible, propose d’utiliser son abonnement Gemini pour générer les animations, et demande si cela ferait consommer trop de ressources au mod.

Les spécifications du même fichier citent les corrections qui ont suivi, et chacune a modifié le résultat :

- Spécification S2 : « dile que no necesitas sonido, la oido sonar y chapoteando el agua y no es necesario » (traduction : dis-lui qu’il n’y a pas besoin de son ; l’auteur ou l’autrice l’a entendue faire du bruit et éclabousser l’eau, et ce n’est pas nécessaire). Le prompt de la vidéo demande désormais le silence, et l’encodeur supprime toute piste audio.
- Spécification S3 : « me gustaria que tuviera el color original, y sobretodo que se viera en la banda de chat » (traduction : l’auteur ou l’autrice souhaite les couleurs d’origine et, surtout, la voir dans la bande du chat). Cela a fait de la limite de 131072 caractères la contrainte principale.
- Spécification S4 : « la version idle que es la dormida parpadea, lo que es curioso » (traduction : la version à l’arrêt, celle où elle dort, cligne des yeux, ce qui est curieux). Chaque boucle est désormais générée à partir de l’image de sa propre pose, et le prompt de la pose endormie précise que ses yeux restent fermés.
- Spécification S5 : « no podemos directamente generarla con menos tamano para ahorrar limite? se ve algomas delgado y algo pixelado » (traduction : ne pourrait-on pas générer directement la vidéo plus petite pour économiser de la place ? elle paraît plus mince et un peu pixélisée). La réponse du journal : la taille de sortie de la vidéo ne change pas le coût ; un mouvement subtil et les réglages de l’encodeur, si.
- L4 (2026-11-15) : « si me agrada, vamos a cambiar todos » (traduction : oui, ça me plaît, changeons-les toutes). Cela a donné 60 boucles : six poses, cinq stades, deux thèmes.
- L6 (2026-11-15) : « en ventana externa podemos poner el video sin recortar? para que se vea mas nitido? » (traduction : dans la fenêtre externe, peut-on mettre la vidéo sans la recadrer, pour qu’elle soit plus nette ?). Cela a produit les copies nettes de `assets/anim-hq`.

Le journal consigne aussi la façon dont les vidéos ont été faites. Au début, les vidéos venaient de Veo dans l’application Gemini, et le quota s’est épuisé après deux vidéos (L4). En L8 (2026-11-16), l’auteur ou l’autrice a demandé à Claude de faire les vidéos dans son navigateur et de s’arrêter dès que la limite de Veo serait atteinte. En L9 (2026-11-16), l’auteur ou l’autrice a demandé « antes de continuar, no es posible avanzar en los videos usando flow? » (traduction : avant de continuer, n’est-il pas possible d’avancer sur les vidéos avec Flow ?). Flow disposait de ses propres crédits, et son mode Frames, avec son image comme première et dernière image, donnait une boucle fermée. En L10 (2026-11-16), l’auteur ou l’autrice a demandé une meilleure qualité ou davantage de mouvement, puis a dit « prioriza la nitidez y luego mas movimiento » (traduction : donne la priorité à la netteté, puis à davantage de mouvement). Le résultat, tel que L10 le consigne : les 60 boucles faites dans Flow, 3 secondes en 360p, avec des prompts demandant un mouvement net de son corps, de sa tête et de ses nageoires pendant que l’eau reste calme, parce qu’une eau agitée faisait perdre sa netteté à la boucle de la bande.

### Le prompt donné au modèle vidéo

Le prompt envoyé au modèle vidéo est lui aussi consigné, parce qu’un script l’écrit. `tools/anim-sources.ps1` prépare, pour chaque boucle manquante, son image sur un vert pur (`#00FF00`) et un fichier texte contenant le prompt issu de `Get-Prompt`. Le prompt commence ainsi :

> "Create a SILENT video from this image: no audio at all, no music, no sound effects, no water sounds. Animate this exact character as a seamless loop of ..."

Traduction en français : « Crée une vidéo SILENCIEUSE à partir de cette image : aucun audio, pas de musique, pas d’effets sonores, pas de bruits d’eau. Anime ce personnage exact sous la forme d’une boucle sans raccord de ... »

Il demande ensuite une eau calme, un personnage identique, une caméra fixe, le même fond vert uni, et une dernière image identique à la première. La partie centrale provient d’une table de mouvements par pose ; pour la pose endormie, elle dit que ses yeux « stay CLOSED the whole time » (restent FERMÉS tout du long), ce qui est la spécification S4 transformée en instruction.

Ensuite, `tools/encode-anim.ps1` détoure le vert (`colorkey=0x00FF00`), supprime l’audio, recadre sur elle, et effectue une recherche dichotomique sur la qualité WebP pour passer sous la taille visée. `tools/build-animated.ps1`, qu’il appelle, intègre le résultat.

### Un prompt à utiliser

Le prompt suivant a été écrit pour ce guide à titre de suggestion. Ce n’est pas l’un des prompts consignés dans narsil-pet.

> Dans mon mod Claude Code, ajoute une fonction `petSvg(status)` qui renvoie un seul document SVG pour l’élément `Svg` de la bande `AbovePrompt`. Il contient une version claire et une version sombre de mon personnage (des URL de données issues de `hooks/art.ts`), affiche la bonne au moyen d’une requête média `prefers-color-scheme` à l’intérieur du SVG, et donne à chaque statut une petite animation CSS (un balancement pendant le travail, une respiration lente à l’arrêt, une brève secousse en cas d’erreur). Désactive les animations sous `prefers-reduced-motion`. Lève une erreur si le document dépasse 131072 caractères, et ajoute un test qui vérifie que chaque statut, dans les deux thèmes, tient dans cette limite. Dans le terminal, dessine plutôt un visage en texte, puisque le terminal n’a pas de `Svg`.

## Le code minimal

Une version réduite, écrite pour ce guide et vérifiée avec les types 2.1.325. La structure (deux thèmes dans un seul SVG, la vérification de taille, le visage du terminal) est adaptée de `hooks/sprite.ts` et `hooks/register.tsx` dans [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). Les dessins de Narsil sont eux aussi sous GPL v3 : si vous les utilisez, conservez l’attribution et un lien vers le dépôt.

```ts
// hooks/drawing.ts
const MAX_SVG = 131072 // the Svg element's limit for `source`

export function petSvg(lightSrc: string, darkSrc: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 120" width="150" height="120">` +
    `<style>.dark{display:none}` +
    `@media (prefers-color-scheme: dark){.light{display:none}.dark{display:inline}}` +
    `.bob{transform-box:fill-box;transform-origin:50% 100%;animation:bob 2s ease-in-out infinite}` +
    `@keyframes bob{50%{transform:translateY(-3px)}}` +
    `@media (prefers-reduced-motion: reduce){*{animation:none!important}}</style>` +
    `<g class="bob">` +
    `<image class="light" href="${lightSrc}" x="25" y="4" width="100" height="112"/>` +
    `<image class="dark" href="${darkSrc}" x="25" y="4" width="100" height="112"/>` +
    `</g></svg>`
  if (svg.length > MAX_SVG)
    throw new Error(`the drawing has ${svg.length} characters; the band takes ${MAX_SVG}`)
  return svg
}
```

Le dessin, avec le repli pour le terminal :

```tsx
on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
  if (e.props.hasSurvey) return next(e)
  if (e.surface === 'terminal') {
    const { Text } = $.ui.resolve(e)
    return <Text>~(•ᴗ•)~ working</Text>
  }
  const { Svg } = $.ui.resolve(e)
  return <Svg source={petSvg(LIGHT, DARK)} alt="My pet: working" width={132} height={118} />
})
```

`LIGHT` et `DARK` représentent vos propres images intégrées, par exemple des chaînes `data:image/png;base64,...` générées par un script de construction, à la manière dont `tools/build-art.ps1` écrit `hooks/art.ts`. Restreindre d’abord sur `e.surface` est important : la table d’éléments du terminal n’a pas de `Svg`.

## Erreurs fréquentes et comment tester

- **Dépasser la limite sans s’en rendre compte.** Un dessin de plus de 131072 caractères n’est pas dessiné. Les données base64 grossissent d’un tiers, si bien qu’une image de 40 Ko coûte environ 54 600 caractères, et deux thèmes doublent ce chiffre. Vérifiez la longueur dans le code et dans un test, comme le fait Narsil avec « every state is drawn from the art, light and dark, within the Svg size limit » (chaque état est dessiné à partir de l’art, clair et sombre, dans la limite de taille du Svg).
- **Choisir le thème dans le mod.** Le mod ne peut pas voir le jeu de couleurs de la personne qui regarde, et plusieurs surfaces peuvent dessiner en même temps. Placez les deux thèmes dans le SVG et laissez le CSS choisir.
- **Animer une copie par-dessus l’image.** Un double déformé transparaît sous la forme d’une image dédoublée. Les correctifs de Narsil (`9f9cc75`, `6ac340e`) sont passés à des bandes aux bords nets qui ne font que se toucher.
- **Animer une pose en une autre pose.** La spécification S4 du journal consigne que la pose endormie clignait des yeux. Générez chaque boucle à partir de sa propre pose et dites dans le prompt ce qui ne doit pas changer.
- **Le son et les arrière-plans agités dans la vidéo d’IA.** Demandez le silence et supprimez quand même l’audio (spécification S2). Une eau calme garde la boucle nette à petite taille (L10). Faites en sorte que la boucle se referme sur elle-même : le mode Frames de Flow, avec la même première et la même dernière image, y parvenait (L9).
- **Des bords adoucis qui coûtent trop cher.** L’entrée L2 du journal consigne qu’un bord alpha doux et flou coûtait environ 45 Ko ; les boucles de la bande utilisent un bord net réduit d’un pixel, ce qui supprime aussi la frange verte. Les copies nettes de la fenêtre utilisent le bord doux.
- **Des fichiers que le moteur ne charge pas.** Les modules de plus de 1 Mio sont refusés ; répartissez donc l’art intégré sur plusieurs fichiers (un par stade et par thème dans Narsil).
- **Redessiner à chaque battement.** Mettez les dessins en cache et ne les envoyez que lorsqu’ils changent.

Pour tester, `claude plugin test .` exécute les tests de dessin de Narsil dans `tests/narsil.test.tsx`, parmi lesquels « Narsil moves visibly in every state » (Narsil bouge visiblement dans chaque état) et « a pose with an animated loop shows the loop, whole and within the Svg size limit, and its still picture elsewhere » (une pose dotée d’une boucle animée affiche la boucle, entière et dans la limite de taille du Svg, et son image fixe ailleurs). `node tests/overlay-drawing.check.cjs` vérifie le dessin de la fenêtre flottante. Le dépôt de Narsil contient aussi `tools/preview.mjs`, ajouté par « chore: add a local preview page for every animation » (ajouter une page d’aperçu locale pour chaque animation, `75e1525`), pour regarder toutes les poses à la fois.

## Pour aller plus loin

- `draw` dans `hooks/sprite.ts` assemble le document entier : l’eau, la couche de jalon à l’arrière, l’ombre, les images des deux thèmes, les bulles, les gouttes, et soit une célébration, soit les accessoires de l’humeur.
- `LAYOUT` indique, pour chaque pose, où se trouve sa tête, afin que le badge et les ronds tombent dessus ; `place` met chaque image à l’échelle dans le cadre de 150 par 120.
- `props` ajoute les petits objets de chaque humeur, et `ASLEEP_AFTER_S` attend une minute avant qu’elle ne commence à ronfler.
- `celebration`, `behind` et `grows` dessinent un nouveau niveau et un nouveau stade par-dessus son état.
- `FACE` est le visage en texte du terminal pour chacune des douze humeurs.
- `tools/anim-sources.ps1`, `tools/encode-anim.ps1` et `tools/build-animated.ps1` forment la chaîne de production des boucles ; la section « Desarrollo » du README énumère les étapes exactes et les réglages de Flow, et `tools/ffmpeg.ps1` localise ffmpeg.
- `overlay/server.cjs` sert les boucles nettes à `GET /anim/<loop>.webp` pour la fenêtre flottante, traité dans un guide ultérieur.
