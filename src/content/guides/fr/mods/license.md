---
title: 'Réutiliser le code de Narsil : la GPL v3'
description: Les deux mods Narsil sont sous licence GPL-3.0-or-later. Ce que cela implique quand vous étudiez, modifiez ou partagez du code qui en est tiré.
route: mods
order: 5
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: LICENSE
  - repo: pet
    path: .claude-plugin/plugin.json
  - repo: pet
    path: README.md
  - repo: check
    path: LICENSE
  - repo: check
    path: .claude-plugin/plugin.json
  - repo: check
    path: README.md
---

## Ce que ça fait

narsil-pet et narsil-check sont open source, et les guides de ce site citent et adaptent leur code. Ce guide explique, en termes simples, ce que leur licence vous permet de faire de ce code et ce qu’elle exige de vous quand vous le transmettez.

Ceci n’est pas un conseil juridique. Ce guide résume le texte de licence fourni avec les deux mods. Pour une décision importante, lisez la licence complète et consultez un ou une juriste.

## Comment ça marche à l’intérieur

Les deux mods portent la même licence :

- `plugin.json` définit `"license": "GPL-3.0-or-later"`.
- Le fichier `LICENSE` du dépôt contient le texte intégral de la GNU General Public License, version 3.
- Le README indique que le mod peut être redistribué et modifié selon les termes de la GPL v3 ou, à votre choix, de toute version ultérieure publiée par la Free Software Foundation.

La licence distingue deux situations :

| Situation                                                                                              | Ce que dit la GPL v3                                                                                                                                |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vous utilisez ou modifiez le code sans en donner de copie à qui que ce soit                            | Vous pouvez le créer, l’exécuter et le modifier sans conditions, tant que votre licence reste en vigueur (section 2).                               |
| Vous le transmettez (« convey ») : vous en donnez ou mettez à disposition des copies, modifiées ou non | Des conditions s’appliquent (sections 4 à 6). Interagir avec un programme via un réseau sans transférer de copie ne constitue pas une transmission. |

Quand vous transmettez le code, les principales conditions sont les suivantes :

- **Code source non modifié (section 4) :** conservez intactes les mentions de droit d’auteur et de licence, conservez les mentions indiquant l’absence de garantie, et remettez aux destinataires une copie de la licence.
- **Code source modifié (section 5) :** l’œuvre doit porter « prominent notices stating that you modified it », c’est-à-dire des mentions bien visibles indiquant que vous l’avez modifiée, accompagnées d’une date pertinente ; elle doit indiquer qu’elle est publiée sous cette licence ; et vous devez placer l’œuvre entière, dans son ensemble, sous la GPL v3 pour toute personne qui en reçoit une copie.
- **Autres formes (section 6) :** transmettre l’œuvre sous une forme autre que le code source oblige à transmettre aussi le code source correspondant.

Un mod est distribué sous forme de fichiers source : en pratique, partager un mod construit à partir du code de Narsil revient donc à partager ce code source sous la GPL v3.

## Pas à pas

### 1. Décider si vous allez le partager

Si le mod reste sur votre machine, les conditions liées à la transmission ne s’appliquent pas. Dès que vous publiez un dépôt, envoyez un fichier `.plugin` ou remettez le dossier à quelqu’un, elles s’appliquent.

### 2. Conserver la licence

Fournissez le texte de la GPL v3 dans un fichier `LICENSE` et indiquez la licence dans votre manifeste :

```json
{
  "name": "my-band",
  "version": "0.1.0",
  "description": "A status band adapted from narsil-pet",
  "license": "GPL-3.0-or-later"
}
```

Ne conservez « or later » (ou toute version ultérieure) que si vous conservez l’option que donne l’original. Ne remplacez pas la licence par une licence plus permissive pour les parties qui proviennent de Narsil.

### 3. Indiquer ce que vous avez repris et ce que vous avez modifié

Nommez la source et la modification à proximité du code. Un en-tête comme celui-ci couvre l’attribution, le lien vers le dépôt et la mention de modification :

```ts
// Adapted from narsil-pet (https://github.com/davshn/narsil-pet), hooks/register.tsx.
// Changed 2026-11-17: renamed the band and removed the floating window.
// Licensed under the GNU General Public License, version 3 or later.
```

Conservez toutes les mentions qui figuraient déjà dans les fichiers que vous avez copiés.

### 4. Rendre le code source disponible

Publiez le code source complet du mod que vous partagez, et pas seulement les fichiers repris de Narsil. La licence s’applique à l’œuvre entière.

## Erreurs fréquentes et comment tester

- **Partager sans fichier de licence.** `claude plugin validate` signale `LICENSE_MISSING` parmi les vérifications de l’annuaire de plugins quand il n’y a ni fichier `LICENSE` ni `license` dans `plugin.json`. Lancez-la avant de partager.
- **Changer la licence d’un code copié.** Le code repris de Narsil ne peut pas être partagé sous licence MIT, Apache ou propriétaire.
- **Supprimer l’attribution.** Retirer le lien vers le dépôt d’origine ou la mention indiquant que vous avez modifié le code va à l’encontre des conditions relatives aux mentions.
- **Ne partager qu’une partie du code source.** Les destinataires doivent pouvoir obtenir le code source du mod entier.

Avant de partager, vérifiez que votre dossier contient le texte de la licence, que `plugin.json` nomme la licence, et que chaque fichier adapté indique d’où il provient et ce qui a changé.

## Pour aller plus loin

Lisez le fichier `LICENSE` de l’un ou l’autre dépôt pour le texte intégral ; les sections 2, 4, 5 et 6 sont celles résumées ici. La section consacrée à la licence, à la fin de chaque README, en donne le résumé propre au projet : vous pouvez utiliser, étudier, modifier et partager le mod, et une version modifiée que vous distribuez doit elle aussi être publiée en open source sous la même licence, sans garantie. Les guides de ce site suivent la même pratique : chaque extrait adapté de Narsil nomme son dépôt et son fichier, et chaque guide liste ces fichiers dans ses sources.

Savoir si un mod que vous écrivez de zéro, après avoir lu le code de Narsil, constitue une œuvre fondée sur celui-ci est une question juridique à laquelle ce guide ne répond pas.
