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
    mods: 'Mod fundamentals',
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
    fundamentalsCta: 'Start with the fundamentals',
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
    extension: {
      badge: 'Experimental',
      title: 'Narsil in Claude, the browser extension',
      text: 'Narsil also lives inside claude.ai on your phone: an extension for Firefox and Vivaldi on Android shows above the message box the state, context, cache, and last event of the open conversation, and in the side menu the Narsil level, your usage limits, and the ntfy.sh messages of the day. It also dresses Claude in the Narsil colors.',
      note: 'It is experimental: it is well tested, but it relies on the structure of the claude.ai page, not on a public API, so a Claude update can break it. It only reads, and it never sends your data anywhere.',
    },
  },
  mods: {
    title: 'Mod fundamentals',
    description:
      'What a Claude Code mod is made of, the $ object, how to install and test a mod, where it runs, and what the GPL v3 license of Narsil means for your code.',
    intro: [
      'Before you rebuild Narsil or Narsil Check, you need the pieces every mod shares: three small files, one function that registers hooks, and the $ object that reaches everything outside the module.',
      'Read these guides in order. Each one ends with a way to check that what you built works.',
    ],
    listTitle: 'The guides',
    startCta: 'Start the first guide',
  },
  guide: {
    breadcrumbLabel: 'Breadcrumb',
    stepOf: 'Guide {current} of {total}',
    updated: 'Updated',
    verifiedWith: 'Checked against Claude Code {version}',
    sourcesTitle: 'Going further: how the real mod does it',
    sourcesIntro:
      'These files are part of the original mods, published under the GPL v3. Code quoted on this page comes from them and keeps that license.',
    pathNavLabel: 'Guides in this path',
    previous: 'Previous',
    next: 'Next',
    backToPath: 'All guides in this path',
    coffeeTitle: 'Did this guide help?',
    coffeeText: 'Every guide is free. If this one saved you time, you can buy me a coffee.',
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
    },
    developer: {
      text: 'I build and maintain Narsil and this workshop on my own.',
      link: 'See my developer profile',
    },
  },
}
