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
    secondaryCta: 'Offrez-moi un café',
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
      site: 'Narsil Workshop, ce site',
    },
    developer: {
      text: 'Je crée et maintiens Narsil et cet atelier de manière indépendante.',
      link: 'Voir mon profil de développeur',
    },
  },
}
