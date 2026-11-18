import type { TranslationShape } from '../index'

export const en: TranslationShape = {
  meta: {
    siteName: 'Narsil Workshop',
    title: 'Narsil Workshop — build your own Claude Code mods and a Narsil desk bot',
    description:
      'Free, step-by-step guides to build a status pet mod like Narsil, a review panel mod like Narsil Check, and a Narsil desk bot that talks with Claude and shows your GitHub pull requests.',
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
    description: 'Free guides to build Claude Code mods and a Narsil desk bot from scratch.',
    donate: 'Buy me a coffee',
    trademark:
      'Claude and Claude Code are trademarks of Anthropic, PBC. This project is not affiliated with or endorsed by Anthropic.',
    privacy: 'This site has no analytics and never asks for your tokens or keys.',
    license:
      'Site code and example code: MIT. Guide text: CC BY-SA 4.0. Code quoted from Narsil and Narsil Check: GPL-3.0-or-later.',
  },
  home: {
    headline: 'Build your own Claude Code mods, step by step',
    subheadline:
      'Learn how Narsil and Narsil Check work inside, rebuild each feature from scratch, and finish with a Narsil desk bot that talks with Claude and shows your pull requests.',
    cta: 'See the learning paths',
    fundamentalsCta: 'Start with the fundamentals',
    heroAlt: 'Narsil, a small sea dragon, waving hello',
    states: {
      title: 'What Narsil tells you at a glance',
      subtitle:
        'Each state has its own pose and color, so you know what Claude is doing without reading the terminal.',
      items: [
        { label: 'Working', text: 'Claude is reading, editing, or running commands.' },
        { label: 'Needs you', text: 'Claude asked a question or is waiting for a permission.' },
        { label: 'Done', text: 'The turn ended. Time to review what changed.' },
        { label: 'Error', text: 'A tool failed or the turn stopped with an error.' },
      ],
    },
    showcase: {
      title: 'How it looks',
      subtitle:
        'The same information follows you everywhere: above the prompt, in a floating window, in a side panel, and on your phone.',
      items: [
        {
          title: 'The floating window',
          text: 'Narsil, your usage limits, and every open conversation with its context, tasks, cache, and next steps, in a small window that stays on top.',
          alt: 'The Narsil floating window: a conversation at work with its tasks, the usage bars, and two more open conversations',
        },
        {
          title: 'The Narsil Check panel',
          text: 'A side panel with the session environment, CI steps, dependency updates grouped by risk, vulnerabilities, and pending tasks.',
          alt: 'The Narsil Check panel: environment and CI, three dependency updates, one vulnerability, and two pending tasks',
        },
        {
          title: 'Narsil in Claude, on your phone',
          text: 'An experimental extension that brings Narsil into claude.ai on Android: in the side menu, its level, your usage limits, and the ntfy messages of the day; above the message box, the state of the open conversation. Its code is not public, but the guides explain how it is built.',
          alt: 'The claude.ai side menu on an Android phone with the Narsil block: the level, the 5-hour and weekly limits, and the ntfy messages of the day. Personal details are blurred.',
          detailAlt:
            'A conversation on claude.ai on an Android phone: above the message box, the Narsil band shows the state TRABAJANDO (working), the context at 80 %, the cache at 60 min, and the last event, Usando Bash (using Bash). The conversation is blurred.',
        },
      ],
      note: 'The floating window uses example data, and the phone capture is real, with personal details blurred. The Narsil Check panel is recreated from its source code, because it only renders inside Claude Code. Narsil art comes from davshn/narsil-pet (GPL v3).',
    },
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
        title: 'A Narsil desk bot',
        description:
          'Give Narsil a body: an ESP32-P4 touch screen in the belly with your tasks and pull requests, a holographic ESP32-S3 head with her face, and a voice through Xiaozhi and Claude on your own server.',
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
      note: 'It is experimental: it is well tested, but it relies on the structure of the claude.ai page, not on a public API, so a Claude update can break it. It only reads, and it never sends your data anywhere. Its code is not public, but the guides explain how it is built.',
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
  pet: {
    title: 'Your own status pet',
    description:
      'Build a mod like Narsil, feature by feature: what each one does, how it works inside, how it was asked of the AI, and the minimal code to make it yours.',
    intro: [
      'Narsil was built by talking to Claude Code. Each guide in this path explains one of its features: what it does for the person using it, the hooks and state behind it, the design decisions, and the request that started it.',
      'Where the original request was recorded, the guide quotes it word for word. Where it was not, the guide says so and reconstructs it from the commit history.',
    ],
    listTitle: 'The guides',
    startCta: 'Start the first guide',
  },
  check: {
    title: 'Your own review panel',
    description:
      'Build a mod like Narsil Check, feature by feature: what each one does, how it works inside, how it was asked of the AI, and the minimal code to make it yours.',
    intro: [
      'Narsil Check is a side panel that reviews your session before you ship: environment, connectors, CI, a branch behind its remote, dependency updates grouped by risk, vulnerabilities, and a to-do list Claude can use. Each guide explains one of its features, the design decisions behind it, and the request that started it.',
      'Where the original request was recorded, the guide quotes it word for word. Where it was not, the guide says so and reconstructs it from the commit history.',
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
    flow: {
      title: 'Where your coffee goes',
      steps: ['One coffee', 'Time to write and maintain guides', 'Free guides for everyone'],
      promises: ['No ads', 'No sign-up', 'No analytics, never asks for your tokens'],
    },
    about: {
      title: 'About the developer',
      name: 'Hernán David Figueroa',
      bio: 'Full-stack developer with more than 8 years of experience, specialized in fintech and secure payments. I work on POS terminals and payment features for Android and iOS at a Colombian payment gateway. I built Narsil and this workshop so anyone can understand and extend Claude Code. I live in Bogotá.',
    },
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
