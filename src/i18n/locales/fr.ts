import type { TranslationShape } from '../index'

export const fr: TranslationShape = {
  meta: {
    siteName: 'Narsil Workshop',
    title: 'Narsil Workshop — créez vos propres mods Claude Code et un bot ESP32-S3',
    description:
      'Des guides gratuits, pas à pas, pour créer un mod de mascotte d’état comme Narsil, un panneau de revue comme Narsil Check et un bot ESP32-S3 qui affiche vos pull requests GitHub.',
  },
  common: {
    skipToContent: 'Aller au contenu',
    toggleTheme: 'Changer de thème',
    language: 'Langue',
    mainNavigation: 'Navigation principale',
  },
  nav: {
    mods: 'Bases des mods',
    routes: 'Parcours',
    support: 'Soutenir le projet',
  },
  footer: {
    description: 'Des guides gratuits pour créer de zéro des mods Claude Code et un bot ESP32-S3.',
    donate: 'Offrez-moi un café',
    trademark:
      'Claude et Claude Code sont des marques d’Anthropic, PBC. Ce projet n’est ni affilié à Anthropic ni approuvé par Anthropic.',
    privacy:
      'Ce site n’a aucune analyse d’audience et ne vous demande jamais de jetons ni de clés.',
  },
  home: {
    headline: 'Créez vos propres mods Claude Code, pas à pas',
    subheadline:
      'Découvrez comment Narsil et Narsil Check fonctionnent de l’intérieur, reconstruisez chaque fonctionnalité de zéro et terminez avec un bot ESP32-S3 qui affiche vos pull requests.',
    cta: 'Voir les parcours',
    fundamentalsCta: 'Commencer par les bases',
    heroAlt: 'Narsil, un petit dragon des mers, qui dit bonjour',
    states: {
      title: 'Ce que Narsil vous dit en un coup d’œil',
      subtitle:
        'Chaque état a sa propre pose et sa couleur : vous savez ce que fait Claude sans lire le terminal.',
      items: [
        { label: 'Au travail', text: 'Claude lit, modifie ou exécute des commandes.' },
        { label: 'Vous attend', text: 'Claude a posé une question ou attend une autorisation.' },
        { label: 'Terminé', text: 'Le tour est fini. C’est le moment de relire ce qui a changé.' },
        { label: 'Erreur', text: 'Un outil a échoué ou le tour s’est arrêté sur une erreur.' },
      ],
    },
    showcase: {
      title: 'À quoi ça ressemble',
      subtitle:
        'Les mêmes informations vous suivent partout : au-dessus du prompt, dans une fenêtre flottante, dans un panneau latéral et sur votre téléphone.',
      items: [
        {
          title: 'La fenêtre flottante',
          text: 'Narsil, vos limites d’utilisation et chaque conversation ouverte avec son contexte, ses tâches, son cache et ses prochaines étapes, dans une petite fenêtre toujours au premier plan.',
          alt: 'La fenêtre flottante de Narsil : une conversation au travail avec ses tâches, les barres d’utilisation et deux autres conversations ouvertes',
        },
        {
          title: 'Le panneau Narsil Check',
          text: 'Un panneau latéral avec l’environnement de la session, les étapes de la CI, les mises à jour de dépendances classées par risque, les vulnérabilités et les tâches en attente.',
          alt: 'Le panneau Narsil Check : environnement et CI, trois mises à jour de dépendances, une vulnérabilité et deux tâches en attente',
        },
        {
          title: 'Narsil dans Claude, sur votre téléphone',
          text: 'Une extension expérimentale qui amène Narsil dans claude.ai sur Android : dans le menu latéral, son niveau, vos limites d’utilisation et les messages ntfy du jour ; au-dessus de la zone de saisie, l’état de la conversation ouverte. Son code n’est pas public, mais les guides expliquent comment elle est construite.',
          alt: 'Le menu latéral de claude.ai sur un téléphone Android avec le bloc de Narsil : le niveau, les limites de 5 heures et hebdomadaires, et les messages ntfy du jour. Les données personnelles sont floutées.',
        },
      ],
      note: 'La fenêtre flottante utilise des données d’exemple, et la capture du téléphone est réelle, avec les données personnelles floutées. Le panneau Narsil Check est recréé à partir de son code source, car il ne s’affiche que dans Claude Code. Les illustrations de Narsil viennent de davshn/narsil-pet (GPL v3).',
    },
    aboutTitle: 'Qu’est-ce que Narsil ?',
    about: [
      'Narsil est un mod Claude Code : une petite mascotte qui vit au-dessus du prompt et vous indique d’un coup d’œil si Claude travaille, a besoin de vous, a terminé ou est bloqué. Narsil Check est son frère, un panneau latéral qui vérifie votre branche, la CI, les dépendances et les vulnérabilités.',
      'Ici, vous ne vous contenterez pas de les installer. Chaque guide explique quels hooks une fonctionnalité écoute, quel état elle conserve et ce qu’elle dessine, puis construit une version minimale qui fonctionne, avec ses tests.',
    ],
    routesTitle: 'Trois parcours',
    routesSubtitle: 'Les guides arrivent bientôt. Chaque parcours commence par les bases d’un mod.',
    routes: [
      {
        title: 'Votre propre mascotte d’état',
        description:
          'Créez un mod comme Narsil : des états au-dessus du prompt, des animations, toutes les conversations au même endroit, une fenêtre flottante, la voix, des horloges de contexte et de cache, et des alertes sur votre téléphone.',
        icon: 'lucide:sparkles',
      },
      {
        title: 'Votre propre panneau de revue',
        description:
          'Créez un mod comme Narsil Check : un panneau latéral avec les étapes de la CI, une branche en retard sur la distante, des mises à jour classées par risque, les vulnérabilités d’OSV.dev et des outils pour Claude.',
        icon: 'lucide:list-checks',
      },
      {
        title: 'Un bot ESP32-S3',
        description:
          'Construisez un petit appareil avec écran qui affiche les pull requests qui vous attendent sur GitHub et l’état de Narsil, reçu par un sujet ntfy privé.',
        icon: 'lucide:cpu',
      },
    ],
    coffeeTitle: 'Gratuit, et ça le restera',
    coffeeText:
      'Pas de publicité, pas d’inscription et pas de prix. Si un guide vous aide, vous pouvez m’offrir un café pour écrire le suivant.',
    coffeeCta: 'Offrez-moi un café',
    extension: {
      badge: 'Expérimental',
      title: 'Narsil dans Claude, l’extension de navigateur',
      text: 'Narsil vit aussi dans claude.ai sur votre téléphone : une extension pour Firefox et Vivaldi sur Android affiche au-dessus de la zone de saisie l’état, le contexte, le cache et le dernier événement de la conversation ouverte, et dans le menu latéral le niveau de Narsil, vos limites d’utilisation et les messages ntfy.sh du jour. Elle habille aussi Claude aux couleurs de Narsil.',
      note: 'Elle est expérimentale : elle est bien testée, mais elle s’appuie sur la structure de la page claude.ai et non sur une API publique, donc une mise à jour de Claude peut la casser. Elle ne fait que lire et n’envoie jamais vos données nulle part. Son code n’est pas public, mais les guides expliquent comment elle est construite.',
    },
  },
  mods: {
    title: 'Bases des mods',
    description:
      'De quoi est fait un mod Claude Code, l’objet $, comment installer et tester un mod, où il s’exécute et ce que la licence GPL v3 de Narsil implique pour votre code.',
    intro: [
      'Avant de reconstruire Narsil ou Narsil Check, il vous faut les pièces que partagent tous les mods : trois petits fichiers, une fonction qui enregistre des hooks et l’objet $, qui atteint tout ce qui se trouve hors du module.',
      'Lisez ces guides dans l’ordre. Chacun se termine par un moyen de vérifier que ce que vous avez construit fonctionne.',
    ],
    listTitle: 'Les guides',
    startCta: 'Commencer le premier guide',
  },
  pet: {
    title: 'Votre propre mascotte d’état',
    description:
      'Créez un mod comme Narsil, fonctionnalité par fonctionnalité : ce que fait chacune, comment elle marche, comment elle a été demandée à l’IA et le code minimal pour la faire vôtre.',
    intro: [
      'Narsil a été construit en parlant avec Claude Code. Chaque guide de ce parcours explique l’une de ses fonctionnalités : ce qu’elle apporte à qui l’utilise, les hooks et l’état qui la portent, les choix de conception et la demande qui l’a lancée.',
      'Quand la demande d’origine a été conservée, le guide la cite mot pour mot. Sinon, le guide le dit et la reconstitue à partir de l’historique des commits.',
    ],
    listTitle: 'Les guides',
    startCta: 'Commencer le premier guide',
  },
  check: {
    title: 'Votre propre panneau de revue',
    description:
      'Créez un mod comme Narsil Check, fonctionnalité par fonctionnalité : ce que fait chacune, comment elle marche, comment elle a été demandée à l’IA et le code minimal pour la faire vôtre.',
    intro: [
      'Narsil Check est un panneau latéral qui vérifie votre session avant de livrer : environnement, connecteurs, CI, branche en retard sur la distante, mises à jour classées par risque, vulnérabilités et une liste de tâches que Claude peut utiliser. Chaque guide explique l’une de ses fonctionnalités, les choix de conception et la demande qui l’a lancée.',
      'Quand la demande d’origine a été conservée, le guide la cite mot pour mot. Sinon, le guide le dit et la reconstitue à partir de l’historique des commits.',
    ],
    listTitle: 'Les guides',
    startCta: 'Commencer le premier guide',
  },
  guide: {
    breadcrumbLabel: 'Fil d’Ariane',
    stepOf: 'Guide {current} sur {total}',
    updated: 'Mis à jour',
    verifiedWith: 'Vérifié avec Claude Code {version}',
    sourcesTitle: 'Pour aller plus loin : comment le fait le vrai mod',
    sourcesIntro:
      'Ces fichiers font partie des mods originaux, publiés sous GPL v3. Le code cité sur cette page en provient et conserve cette licence.',
    pathNavLabel: 'Guides de ce parcours',
    previous: 'Précédent',
    next: 'Suivant',
    backToPath: 'Tous les guides de ce parcours',
    coffeeTitle: 'Ce guide vous a aidé ?',
    coffeeText:
      'Tous les guides sont gratuits. Si celui-ci vous a fait gagner du temps, vous pouvez m’offrir un café.',
    coffeeCta: 'Offrez-moi un café',
  },
  support: {
    title: 'Soutenir Narsil Workshop',
    description:
      'Narsil Workshop est gratuit et n’aura jamais de publicité ni de prix. S’il vous aide, vous pouvez m’offrir un café pour écrire d’autres guides.',
    lines: [
      'Merci de lire Narsil Workshop. Chaque guide est gratuit et le restera : pas de publicité, pas d’inscription et aucun coût, jamais.',
      'Si un guide vous a aidé à créer votre propre mod ou votre bot, vous pouvez m’offrir un café. C’est un paiement unique du montant de votre choix, et il est entièrement facultatif.',
      'Chaque café sert à écrire d’autres guides, exemples et outils pour celles et ceux qui veulent comprendre et étendre Claude Code.',
    ],
    donate: 'Offrez-moi un café',
    unavailable: 'Les dons ne sont pas encore ouverts.',
    reposTitle: 'Le code source',
    repos: {
      pet: 'Narsil, le mod de mascotte d’état',
      check: 'Narsil Check, le mod de panneau de revue',
    },
    developer: {
      text: 'Je crée et maintiens Narsil et cet atelier de manière indépendante.',
      link: 'Voir mon profil de développeur',
    },
  },
}
