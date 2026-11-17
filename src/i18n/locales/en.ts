import type { TranslationShape } from '../index'

export const en: TranslationShape = {
  meta: {
    siteName: 'Narsil Workshop',
    title: 'Narsil Workshop — build your own Claude Code mods and an ESP32-S3 desk bot',
    description:
      'Free, step-by-step guides to build a status pet mod like Narsil, a review panel mod like Narsil Check, and an ESP32-S3 bot that shows your GitHub pull requests.',
  },
  common: {
    skipToContent: 'Skip to content',
    toggleTheme: 'Toggle theme',
    language: 'Language',
    mainNavigation: 'Main navigation',
  },
  nav: {
    routes: 'Learning paths',
    support: 'Support the project',
  },
  footer: {
    description: 'Free guides to build Claude Code mods and an ESP32-S3 desk bot from scratch.',
    donate: 'Buy me a coffee',
    trademark:
      'Claude and Claude Code are trademarks of Anthropic, PBC. This project is not affiliated with or endorsed by Anthropic.',
    privacy: 'This site has no analytics and never asks for your tokens or keys.',
  },
  home: {
    headline: 'Build your own Claude Code mods, step by step',
    subheadline:
      'Learn how Narsil and Narsil Check work inside, rebuild each feature from scratch, and finish with an ESP32-S3 desk bot that shows your pull requests.',
    cta: 'See the learning paths',
    secondaryCta: 'Buy me a coffee',
    aboutTitle: 'What is Narsil?',
    about: [
      'Narsil is a Claude Code mod: a small pet that lives above the prompt and tells you, at a glance, whether Claude is working, waiting for you, done, or stuck. Narsil Check is its sibling, a side panel that reviews your branch, CI, dependencies, and vulnerabilities.',
      'Here you will not just install them. Each guide explains which hooks a feature listens to, what state it keeps, and what it draws, and then builds a minimal version that works, with its tests.',
    ],
    routesTitle: 'Three learning paths',
    routesSubtitle: 'The guides are on their way. Each path starts with the basics of a mod.',
    routes: [
      {
        title: 'Your own status pet',
        description:
          'Build a mod like Narsil: states above the prompt, animations, every conversation in one place, a floating window, voice, context and cache clocks, and alerts on your phone.',
        icon: 'lucide:sparkles',
      },
      {
        title: 'Your own review panel',
        description:
          'Build a mod like Narsil Check: a side panel with CI steps, a branch behind its remote, dependency updates grouped by risk, OSV.dev vulnerabilities, and tools for Claude.',
        icon: 'lucide:list-checks',
      },
      {
        title: 'An ESP32-S3 desk bot',
        description:
          'Build a small device with a screen that shows the pull requests waiting for you on GitHub and the Narsil status, received through a private ntfy topic.',
        icon: 'lucide:cpu',
      },
    ],
    coffeeTitle: 'Free, and it will stay free',
    coffeeText:
      'No ads, no sign-up, and no price. If a guide helps you, you can buy me a coffee to help write the next one.',
    coffeeCta: 'Buy me a coffee',
  },
  support: {
    title: 'Support Narsil Workshop',
    description:
      'Narsil Workshop is free and will never have ads or a price. If it helps you, you can buy me a coffee to help write more guides.',
    lines: [
      'Thank you for reading Narsil Workshop. Every guide here is free, and it will stay that way: no ads, no sign-up, and no cost, ever.',
      'If a guide helped you build your own mod or bot, you can buy me a coffee. It is a one-time payment of whatever amount you like, and it is completely optional.',
      'Each coffee goes into writing more guides, examples, and tools for people who want to understand and extend Claude Code.',
    ],
    donate: 'Buy me a coffee',
    unavailable: 'Donations are not open yet.',
    reposTitle: 'The source code',
    repos: {
      pet: 'Narsil, the status pet mod',
      check: 'Narsil Check, the review panel mod',
      site: 'Narsil Workshop, this site',
    },
    developer: {
      text: 'I build and maintain Narsil and this workshop on my own.',
      link: 'See my developer profile',
    },
  },
}
