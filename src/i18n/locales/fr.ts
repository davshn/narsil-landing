import { frDiagrams } from '../diagrams/fr'

import type { TranslationShape } from '../index'

export const fr: TranslationShape = {
  meta: {
    siteName: 'Narsil Workshop',
    title: 'Narsil Workshop — créez des mods Claude Code et un bot Narsil avec Claude',
    description:
      'Des guides gratuits, pas à pas, pour créer des mods Claude Code avec Claude : une mascotte d’état comme Narsil, un panneau de revue comme Narsil Check et un bot Narsil. Apprenez quoi demander, pourquoi ça marche et comment vérifier le résultat.',
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
    tools: 'Outils',
    support: 'Soutenir le projet',
  },
  footer: {
    description:
      'Des guides gratuits pour créer des mods Claude Code et un bot Narsil avec Claude, et pour comprendre ce que vous avez construit.',
    donate: 'Offrez-moi un café',
    support: 'Gratuit, sans publicité et sans inscription.',
    trademark:
      'Claude et Claude Code sont des marques d’Anthropic, PBC. Ce projet n’est ni affilié à Anthropic ni approuvé par Anthropic.',
    privacy:
      'Ce site n’a aucune analyse d’audience et ne vous demande jamais de jetons ni de clés.',
    license:
      'Code du site et des exemples : MIT. Texte des guides : CC BY-SA 4.0. Code cité de Narsil et Narsil Check : GPL-3.0-or-later.',
  },
  home: {
    headline: 'Créez vos propres mods Claude Code avec Claude, pas à pas',
    subheadline:
      'Découvrez comment fonctionnent Narsil et Narsil Check, demandez à Claude de construire chaque fonctionnalité avec vous et comprenez chaque pièce qu’il écrit. Terminez avec un bot Narsil qui parle avec Claude et affiche vos pull requests.',
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
          text: 'Un panneau latéral avec une carte en direct du travail de Claude, l’environnement de la session, les étapes de la CI, les mises à jour de dépendances classées par risque, les vulnérabilités et les tâches en attente.',
          alt: 'Le panneau Narsil Check : une carte en direct du travail de Claude avec bébé Narsil au centre, environnement et CI, trois mises à jour de dépendances, une vulnérabilité et deux tâches en attente',
        },
        {
          title: 'Narsil dans Claude, sur votre téléphone',
          text: 'Une extension expérimentale qui amène Narsil dans claude.ai sur Android : dans le menu latéral, son niveau, vos limites d’utilisation et les messages ntfy du jour ; au-dessus de la zone de saisie, l’état de la conversation ouverte. Son code n’est pas public, mais les guides expliquent comment elle est construite.',
          alt: 'Le menu latéral de claude.ai sur un téléphone Android avec le bloc de Narsil : le niveau, les limites de 5 heures et hebdomadaires, et les messages ntfy du jour. Les données personnelles sont floutées.',
          detailAlt:
            'Une conversation claude.ai sur un téléphone Android : au-dessus de la zone de saisie, la bande de Narsil affiche l’état TRABAJANDO (au travail), le contexte à 80 %, le cache à 60 min et le dernier événement, Usando Bash (utilise Bash). La conversation est floutée.',
        },
      ],
      note: 'La fenêtre flottante utilise des données d’exemple, et la capture du téléphone est réelle, avec les données personnelles floutées. Le panneau Narsil Check est recréé à partir de son code source, car il ne s’affiche que dans Claude Code. Les illustrations de Narsil viennent de davshn/narsil-pet (GPL v3).',
    },
    aboutTitle: 'Qu’est-ce que Narsil ?',
    about: [
      'Narsil est un mod Claude Code : une petite mascotte qui vit au-dessus du prompt et vous indique d’un coup d’œil si Claude travaille, a besoin de vous, a terminé ou est bloqué. Narsil Check est son frère, un panneau latéral qui montre en direct le travail de Claude et vérifie votre branche, la CI, les dépendances et les vulnérabilités.',
      'Ici, vous ne vous contenterez pas de les installer : vous construirez vos propres versions avec Claude. Chaque guide explique une fonctionnalité avec des mots simples, vous donne un prompt pour la demander à Claude et vous montre comment vérifier que ce que Claude a construit est correct. Le code est là pour être lu et comparé, pas copié.',
    ],
    repoCta: 'Voir {repo} sur GitHub',
    routesTitle: 'Quatre parcours',
    routes: [
      {
        title: 'Votre propre mascotte d’état',
        description:
          'Créez un mod comme Narsil avec Claude : des états au-dessus du prompt, des animations, toutes les conversations au même endroit, une fenêtre flottante, la voix, des horloges de contexte et de cache, et des alertes sur votre téléphone.',
      },
      {
        title: 'Votre propre panneau de revue',
        description:
          'Créez un mod comme Narsil Check avec Claude : un panneau latéral avec une carte en direct du travail de Claude, les étapes de la CI, une branche en retard sur la distante, des mises à jour classées par risque, les vulnérabilités d’OSV.dev et des outils pour Claude.',
      },
      {
        title: 'Un bot Narsil',
        description:
          'Donnez un corps à Narsil : un écran tactile ESP32-P4 dans le ventre avec vos tâches et vos pull requests, une tête holographique ESP32-S3 avec son visage, et une voix grâce à Xiaozhi et Claude sur votre propre serveur.',
      },
      {
        title: 'Narsil dans Claude, sur votre téléphone',
        description:
          'Expérimental : découvrez comment est faite l’extension de navigateur qui amène Narsil dans claude.ai sur Android, avec la bande de la conversation, le menu latéral avec vos limites et les messages ntfy, les couleurs et les paquets Android.',
      },
    ],
    guide: {
      hello:
        'Salut ! Je suis Narsil. Je vis au-dessus de votre prompt et je vous dis ce que fait Claude. Aujourd’hui, c’est vous qui me construisez.',
      statusDetail: 'modifie src/hooks.ts',
      startText:
        'Les trois fichiers d’un mod, ses hooks et l’objet $ : la base de chaque prompt qui suit.',
      routes:
        'Commencez par les fondamentaux. Ensuite, choisissez où nous allons : les parcours se suivent dans n’importe quel ordre.',
      showcase: 'Tout cela, vous le construisez vous-même, avec Claude, un guide à la fois.',
    },
    extension: {
      badge: 'Expérimental',
      title: 'Narsil dans Claude, l’extension de navigateur',
      text: 'Narsil vit aussi dans claude.ai sur votre téléphone : une extension pour Firefox et Vivaldi sur Android affiche au-dessus de la zone de saisie l’état, le contexte, le cache et le dernier événement de la conversation ouverte, et dans le menu latéral le niveau de Narsil, vos limites d’utilisation et les messages ntfy.sh du jour. Elle habille aussi Claude aux couleurs de Narsil.',
      note: 'Elle est expérimentale : elle est bien testée, mais elle s’appuie sur la structure de la page claude.ai et non sur une API publique, donc une mise à jour de Claude peut la casser. Elle ne fait que lire : elle n’écrit jamais dans votre compte et n’envoie vos conversations nulle part, mais elle charge les dessins de Narsil depuis GitHub et lit son topic d’état sur ntfy.sh. Son code n’est pas public, mais les guides expliquent comment elle est construite.',
      cta: 'Comment elle est faite',
    },
  },
  mods: {
    title: 'Bases des mods',
    description:
      'Les idées qu’il vous faut avant de créer un mod Claude Code avec Claude : de quoi est fait un mod, l’objet $, comment installer et tester un mod, où il s’exécute et ce que la licence GPL v3 de Narsil implique pour votre code.',
    intro: [
      'Avant de demander à Claude de construire un mod, il est utile de connaître les pièces que partagent tous les mods : trois petits fichiers, une fonction qui enregistre des hooks (des fonctions qui s’exécutent quand quelque chose se produit dans Claude Code) et l’objet $, qui atteint tout ce qui se trouve hors du mod. Avec ces idées, vous pouvez écrire des prompts clairs et vérifier ce que Claude vous donne.',
      'Lisez ces guides dans l’ordre. Chacun explique une idée, vous donne un prompt pour l’essayer avec Claude, parcourt le code que Claude devrait produire et se termine par un moyen de vérifier que ça fonctionne.',
    ],
    listTitle: 'Les guides',
    startCta: 'Commencer le premier guide',
    stages: frDiagrams.stages.mods,
  },
  pet: {
    title: 'Votre propre mascotte d’état',
    description:
      'Créez un mod comme Narsil avec Claude, fonctionnalité par fonctionnalité : ce que fait chacune, comment elle marche, le prompt pour la demander à Claude et le code à lire et à comparer avec ce que Claude a écrit.',
    intro: [
      'Narsil a été construit en parlant avec Claude Code, et vous pouvez construire votre propre mascotte de la même façon. Chaque guide explique une fonctionnalité : ce qu’elle apporte à qui l’utilise, l’idée qui la porte et le prompt qui amène Claude à la construire.',
      'Quand la demande d’origine a été conservée, le guide la cite mot pour mot, pour que vous voyiez comment l’auteur a parlé à Claude. Le code qui suit est une référence : lisez-le pour comprendre le résultat et pour vérifier ce que Claude a écrit pour vous.',
    ],
    listTitle: 'Les guides',
    startCta: 'Commencer le premier guide',
    stages: frDiagrams.stages.pet,
  },
  check: {
    title: 'Votre propre panneau de revue',
    description:
      'Créez un mod comme Narsil Check avec Claude, fonctionnalité par fonctionnalité : ce que fait chacune, comment elle marche, le prompt pour la demander à Claude et le code à lire et à comparer avec ce que Claude a écrit.',
    intro: [
      'Narsil Check est un panneau latéral qui vérifie votre session avant de livrer : une carte en direct du travail de Claude, environnement, connecteurs, CI, branche en retard sur la distante, mises à jour classées par risque, vulnérabilités et une liste de tâches que Claude peut utiliser. Chaque guide explique une fonctionnalité, les choix qui la portent et le prompt qui amène Claude à la construire.',
      'Quand la demande d’origine a été conservée, le guide la cite mot pour mot, pour que vous voyiez comment l’auteur a parlé à Claude. Le code qui suit est une référence : lisez-le pour comprendre le résultat et pour vérifier ce que Claude a écrit pour vous.',
    ],
    listTitle: 'Les guides',
    startCta: 'Commencer le premier guide',
    stages: frDiagrams.stages.check,
  },
  bot: {
    title: 'Un bot Narsil',
    description:
      'Donnez un corps à Narsil : un écran tactile ESP32-P4 dans le ventre, une tête holographique ESP32-S3 et une voix grâce à Xiaozhi et Claude sur votre serveur. Ce que fait chaque partie, comment elle marche et comment la construire avec Claude.',
    intro: [
      'Le bot a deux cartes reliées par quatre fils. Le ventre, un ESP32-P4 avec un écran tactile de 4,3 pouces, fait tourner Xiaozhi : il écoute, parle avec Claude par votre serveur et affiche vos tâches et vos pull requests. La tête, un ESP32-S3 avec un écran de 1,3 pouce dans un cube prisme, ne dessine que le visage de Narsil et reçoit son état du ventre par UART.',
      'Lisez les guides dans l’ordre. Chacun explique ce que fait la partie et comment elle marche, montre la conversation avec Claude où les choix ont été pris, puis le code, pour que vous puissiez comprendre et vérifier ce que Claude construit pour vous.',
    ],
    listTitle: 'Les guides',
    startCta: 'Commencer le premier guide',
    stages: frDiagrams.stages.bot,
  },
  claude: {
    title: 'Narsil dans Claude',
    description:
      'Comment est faite l’extension expérimentale qui amène Narsil dans claude.ai sur Android : la bande de la conversation, le menu latéral, les couleurs et les paquets Android.',
    intro: [
      'Narsil dans Claude est une extension pour Firefox et Vivaldi sur Android qui affiche Narsil dans la vraie application web claude.ai. Chaque guide explique une de ses parties : ce qu’elle fait, comment elle marche et comment demander à Claude de la construire.',
      'Elle est expérimentale : elle dépend de la structure de la page claude.ai, pas d’une API publique, donc une mise à jour de Claude peut la casser. Son code n’est pas public, donc le code de référence de ces guides est écrit pour les guides.',
    ],
    listTitle: 'Les guides',
    startCta: 'Commencer le premier guide',
    stages: frDiagrams.stages.claude,
  },
  botMap: frDiagrams.botMap,
  guide: {
    breadcrumbLabel: 'Fil d’Ariane',
    stepOf: 'Guide {current} sur {total}',
    updated: 'Mis à jour',
    verifiedWith: 'Vérifié avec Claude Code {version}',
    sourcesTitle: 'Pour aller plus loin : comment le fait le vrai mod',
    sourcesIntro:
      'Ces fichiers font partie des mods originaux, publiés sous GPL v3. Lisez-les pour voir comment le vrai mod résout le même problème. Le code cité sur cette page en provient et conserve cette licence.',
    pathNavLabel: 'Guides de ce parcours',
    tocTitle: 'Sur cette page',
    pagerLabel: 'Guide précédent et suivant',
    previous: 'Précédent',
    next: 'Suivant',
    backToPath: 'Tous les guides de ce parcours',
    summaryTitle: 'Dans ce parcours',
    guideCount: '{count} guides',
    readingMinutes: 'Environ {value} min de lecture',
    readingHours: 'Environ {value} h de lecture',
    guideMinutes: '{value} min',
    stagesTitle: 'Le parcours en un coup d’œil',
    stageGuide: 'Guide {number} : {title}',
    coffeeTitle: 'Ce guide vous a aidé ?',
    coffeeText:
      'Tous les guides sont gratuits. Si celui-ci vous a fait gagner du temps, vous pouvez m’offrir un café.',
    coffeeCta: 'Offrez-moi un café',
  },
  tools: {
    title: 'Outils',
    description:
      'De petits outils qui tournent dans le navigateur et aident à comprendre les guides : essayez les règles de Narsil et Narsil Check avec vos propres valeurs avant de demander à Claude de les construire.',
    intro:
      'Chaque outil exécute une règle des mods pour que vous l’essayiez avec vos propres valeurs. Une fois la règle comprise, vous pouvez la décrire clairement à Claude et vérifier que ce qu’il construit se comporte de la même façon.',
    privacy:
      'Tout tourne dans votre navigateur. Rien de ce que vous tapez ne quitte cette page ni n’entre dans un lien.',
    open: 'Ouvrir l’outil',
    semver: {
      title: 'Classeur semver',
      description:
        'Tapez une version installée et une plus récente pour voir dans quel groupe Narsil Check range la mise à jour, avec la règle sous 1.0.0.',
      intro:
        'Narsil Check compare la version que vous avez avec la dernière et range la mise à jour selon l’écart entre les deux. Cet outil exécute la même règle.',
      guideText: 'Comment Narsil Check classe les mises à jour',
      installedLabel: 'Version installée',
      candidateLabel: 'Nouvelle version',
      resultLabel: 'Groupe',
      groups: {
        review: 'Version majeure : examiner les changements',
        bump: 'Montée de version seule',
      },
      bumps: {
        patch: 'correctif',
        minor: 'mineur',
        major: 'majeur',
      },
      summary: 'De {from} à {to} : un saut {bump}.',
      belowOne:
        'Sous 1.0.0 un saut mineur compte comme majeur, et sous 0.1.0 un correctif aussi, comme npm lit les plages avec ^.',
      current: '{to} n’est pas plus récente que {from} : il n’y a rien à mettre à jour.',
      invalidInstalled: 'La version installée n’est pas une version que Narsil Check sait lire.',
      invalidCandidate: 'La nouvelle version n’est pas une version que Narsil Check sait lire.',
    },
    xp: {
      title: 'Calculateur d’XP',
      description:
        'Comptez les tours terminés, les tests qui passent et les sous-agents terminés pour voir l’XP, le niveau et le stade de Narsil, et la distance au suivant.',
      intro:
        'Narsil gagne 10 XP par tour terminé, 5 par exécution de tests qui passe et 3 par sous-agent qui termine. Chaque niveau demande 100 XP de plus que le précédent, et cinq stades changent son apparence.',
      guideText: 'Comment Narsil gagne de l’expérience et grandit',
      turnsLabel: 'Tours terminés',
      testsLabel: 'Tests qui passent',
      agentsLabel: 'Sous-agents terminés',
      resultLabel: 'Où en est Narsil',
      total: '{xp} XP au total.',
      level: 'Niveau {level} · {into}/{needed} XP',
      stage: 'Stade {stage} sur {stages}.',
      nextStage:
        'Le stade {stage} commence au niveau {level} : encore {xp} XP, environ {turns} tours terminés de plus.',
      grown: 'Narsil a fini de grandir : le stade 5 est le dernier.',
    },
    priority: {
      title: 'Simulateur de priorité',
      description:
        'Choisissez l’état de quelques conversations pour voir celle que montre Narsil et dans quel ordre la bande les liste, quatre par page.',
      intro:
        'Narsil montre la conversation la plus importante : d’abord une erreur, puis une qui a besoin de vous, puis une au travail, puis une terminée. En cas d’égalité, le changement le plus récent l’emporte. La bande liste d’abord cette conversation, quel que soit son état.',
      guideText: 'Comment Narsil suit toutes les conversations',
      statuses: {
        error: 'Erreur',
        waiting: 'A besoin de vous',
        working: 'Au travail',
        done: 'Terminé',
        idle: 'À l’arrêt',
      },
      own: 'Cette conversation',
      other: 'Conversation {n}',
      statusLabel: 'État',
      minutesLabel: 'Minutes depuis son dernier changement',
      add: 'Ajouter une conversation',
      remove: 'Retirer {name}',
      wearsLabel: 'Narsil montre',
      wears: '{name} : {status}',
      rowsLabel: 'Lignes de la bande',
      page: 'Page {page}',
    },
    context: {
      title: 'Estimateur de remplissage du contexte',
      description:
        'Saisissez deux relevés de la barre de contexte et les minutes entre eux pour voir quand la fenêtre se remplit, comme Narsil l’estime.',
      intro:
        'Narsil prolonge en ligne droite jusqu’à 100 % le rythme des 15 dernières minutes. Il lui faut au moins une minute de relevés, elle n’affiche rien tant que le remplissage ne monte pas et masque les estimations au-delà de deux heures.',
      guideText: 'Comment Narsil affiche le contexte et les limites',
      earlierLabel: 'Remplissage avant (%)',
      nowLabel: 'Remplissage maintenant (%)',
      minutesLabel: 'Minutes entre les relevés',
      resultLabel: 'Estimation',
      estimate: 'Plein dans environ {minutes} min.',
      far: 'Plus de deux heures : Narsil n’affiche pas une estimation aussi lointaine.',
      full: 'La fenêtre de contexte est pleine.',
      old: 'Narsil n’utilise que les relevés des 15 dernières minutes : pas d’estimation.',
      short: 'Les relevés ont moins d’une minute d’écart : pas encore d’estimation.',
      flat: 'Le remplissage ne monte pas : pas d’estimation.',
    },
    cache: {
      title: 'Horloge du cache',
      description:
        'Choisissez abonnement ou clé d’API et les minutes depuis la dernière requête pour voir ce qu’il reste du cache de prompt, comme Narsil le compte.',
      intro:
        'Le cache de prompt dure 60 minutes avec un abonnement et 5 minutes avec une clé d’API, à partir du début de la dernière requête. Une fois froid, le message suivant est facturé en entier. Vous pouvez aussi fixer la durée à la main, comme le fait /narsil cache.',
      guideText: 'Comment Narsil décompte le cache de prompt',
      accountLabel: 'Comment vous utilisez Claude Code',
      accounts: {
        plan: 'Abonnement',
        api: 'Clé d’API',
        custom: 'À la main',
      },
      customLabel: 'Durée du cache (minutes)',
      elapsedLabel: 'Minutes depuis le début de la dernière requête',
      resultLabel: 'Cache de prompt',
      lasts: 'Le cache dure {minutes} min.',
      warm: 'Cache : il reste {left} min',
      cold: 'Cache froid : le prochain message est facturé en entier',
    },
    botConfig: {
      title: 'Configuration du serveur du bot',
      description:
        'Préparez le data/.config.yaml du serveur du bot de bureau de Narsil avec les guides 4 à 6 : adresse, fuseau, modèle Claude et voix, sans vraie clé.',
      intro:
        'Le serveur du bot sur votre PC lit data/.config.yaml. Cet outil écrit le fichier que construisent les guides 4, 5 et 6 : l’adresse du serveur sur votre réseau, la reconnaissance vocale, Claude comme cerveau, et la personnalité et la voix de Narsil.',
      guideText: 'Claude comme cerveau du bot',
      hostLabel: 'Adresse de votre PC sur le réseau local',
      timezoneLabel: 'Décalage horaire (heures)',
      modelLabel: 'Modèle',
      models: {
        'claude-opus-5-5': 'Claude Opus 5.5',
        'claude-haiku-5-5': 'Claude Haiku 5.5',
      },
      effortLabel: 'Effort',
      efforts: {
        low: 'Faible',
        medium: 'Moyen',
        high: 'Élevé',
      },
      maxTokensLabel: 'Tokens maximum par réponse',
      voiceLabel: 'Voix Edge',
      resultLabel: 'data/.config.yaml',
      invalid: {
        host: 'Utilisez une adresse IPv4 privée de votre réseau, comme 192.168.1.50 : le serveur n’écoute que sur votre réseau.',
        timezone: 'Utilisez un nombre entier d’heures entre -12 et 14.',
        model: 'Choisissez l’un des modèles.',
        effort: 'Choisissez l’un des niveaux d’effort.',
        maxTokens: 'Utilisez un nombre entier de 1 à 128000.',
        voice: 'Utilisez un nom de voix Edge, comme es-MX-DaliaNeural.',
      },
      copy: 'Copier le fichier',
      copied: 'Copié',
      keyNote:
        'La seule clé du fichier est un espace réservé pour la reconnaissance vocale : remplacez-la dans votre propre copie sur votre PC. La clé Anthropic ne va jamais dans ce fichier ; le serveur la lit dans ANTHROPIC_API_KEY.',
    },
  },
  support: {
    title: 'Soutenir Narsil Workshop',
    description:
      'Narsil Workshop est gratuit et n’aura jamais de publicité ni de prix. S’il vous aide, vous pouvez m’offrir un café pour écrire d’autres guides.',
    lines: [
      'Merci de lire Narsil Workshop. Chaque guide est gratuit et le restera : pas de publicité, pas d’inscription et aucun coût, jamais.',
      'Si un guide vous a aidé à créer votre propre mod ou votre bot avec Claude, vous pouvez m’offrir un café. C’est un paiement unique du montant de votre choix, et il est entièrement facultatif.',
      'Chaque café sert à écrire d’autres guides, prompts et outils pour celles et ceux qui veulent construire avec Claude Code et comprendre ce qu’ils construisent.',
    ],
    donate: 'Offrez-moi un café',
    unavailable: 'Les dons ne sont pas encore ouverts.',
    flow: {
      title: 'Où va votre café',
      steps: [
        'Un café',
        'Du temps pour écrire et maintenir les guides',
        'Des guides gratuits pour tous',
      ],
      promises: [
        'Sans publicité',
        'Sans inscription',
        'Sans analytics, ne demande jamais vos jetons',
      ],
    },
    about: {
      title: 'À propos du développeur',
      name: 'Hernán David Figueroa',
      photoAlt: 'Photo de Hernán David Figueroa',
      bio: 'Développeur full-stack avec plus de 8 ans d’expérience, spécialisé dans les paiements sécurisés. Je travaille sur des terminaux de paiement et des fonctions de paiement pour Android et iOS dans le secteur de la fintech. J’ai créé Narsil et cet atelier pour que chacun puisse comprendre et étendre Claude Code. Je vis à Bogotá.',
    },
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
