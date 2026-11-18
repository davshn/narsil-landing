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
    tools: 'Tools',
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
    routesSubtitle:
      'Pick a path and follow its guides in order. If you have never built a mod, start with the mod fundamentals.',
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
      cta: 'How it is built',
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
  bot: {
    title: 'A Narsil desk bot',
    description:
      'Give Narsil a body: an ESP32-P4 touch screen in the belly, a holographic ESP32-S3 head, and a voice through Xiaozhi with Claude on your own server. What each part does, how it works, and how it was asked of the AI.',
    intro: [
      'The bot has two boards joined by four wires. The belly, an ESP32-P4 with a 4.3-inch touch screen, runs Xiaozhi: it listens, talks with Claude through your own server, and shows your tasks and pull requests. The head, an ESP32-S3 with a 1.3-inch screen inside a prism cube, only draws Narsil’s face, and it gets its state from the belly over UART.',
      'Read the guides in order. Each one explains what the part does, how it works, the decisions behind it and the conversation where they were taken, then the code.',
    ],
    listTitle: 'The guides',
    startCta: 'Start the first guide',
  },
  claude: {
    title: 'Narsil in Claude',
    description:
      'How the experimental extension that brings Narsil into claude.ai on Android is built: the conversation band, the side menu, the colors and the Android packages.',
    intro: [
      'Narsil in Claude is a browser extension for Firefox and Vivaldi on Android that shows Narsil inside the real claude.ai web app. Each guide explains one of its parts: what it does, how it works inside and how it was asked of the AI.',
      'It is experimental: it relies on the structure of the claude.ai page, not on a public API, so a Claude update can break it. Its code is not public, so the minimal code in these guides is written for the guides.',
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
    tocTitle: 'On this page',
    pagerLabel: 'Previous and next guide',
    previous: 'Previous',
    next: 'Next',
    backToPath: 'All guides in this path',
    summaryTitle: 'In this path',
    guideCount: '{count} guides',
    readingMinutes: 'About {value} min of reading',
    readingHours: 'About {value} h of reading',
    guideMinutes: '{value} min',
    coffeeTitle: 'Did this guide help?',
    coffeeText: 'Every guide is free. If this one saved you time, you can buy me a coffee.',
    coffeeCta: 'Buy me a coffee',
  },
  tools: {
    title: 'Tools',
    description:
      'Small in-browser tools that help you understand the guides: try the rules of Narsil and Narsil Check with your own values.',
    intro:
      'Each tool runs one rule from the mods so you can try it with your own values, next to the guide that explains it.',
    privacy:
      'Everything runs in your browser. Nothing you type leaves this page or goes into a link.',
    open: 'Open the tool',
    semver: {
      title: 'Semver classifier',
      description:
        'Type an installed version and a newer one to see the group Narsil Check puts the upgrade in, including the rule below 1.0.0.',
      intro:
        'Narsil Check compares the version you have with the latest one and sorts the upgrade by how far apart they are. This tool runs the same rule.',
      guideText: 'How Narsil Check classifies updates',
      installedLabel: 'Installed version',
      candidateLabel: 'New version',
      resultLabel: 'Group',
      groups: {
        review: 'Major version: review the changes',
        bump: 'Version bump only',
      },
      bumps: {
        patch: 'patch',
        minor: 'minor',
        major: 'major',
      },
      summary: 'From {from} to {to}: a {bump} jump.',
      belowOne:
        'Below 1.0.0 a minor counts as a major, and below 0.1.0 so does a patch, as npm reads caret ranges.',
      current: '{to} is not newer than {from}, so there is nothing to update.',
      invalidInstalled: 'The installed version is not a version Narsil Check can read.',
      invalidCandidate: 'The new version is not a version Narsil Check can read.',
    },
    xp: {
      title: 'XP calculator',
      description:
        'Count finished turns, passing test runs and finished subagents to see the XP, level and stage Narsil reaches, and how far the next stage is.',
      intro:
        'Narsil earns 10 XP for each finished turn, 5 for each test run that passes and 3 for each subagent that finishes. Each level needs 100 XP more than the one before, and five stages change her look.',
      guideText: 'How Narsil earns experience and grows',
      turnsLabel: 'Finished turns',
      testsLabel: 'Passing test runs',
      agentsLabel: 'Finished subagents',
      resultLabel: 'Where Narsil stands',
      total: '{xp} XP in total.',
      level: 'Level {level} · {into}/{needed} XP',
      stage: 'Stage {stage} of {stages}.',
      nextStage:
        'Stage {stage} starts at level {level}: {xp} XP more, about {turns} more finished turns.',
      grown: 'Narsil is fully grown: stage 5 is the last one.',
    },
    priority: {
      title: 'Priority simulator',
      description:
        'Set the state of a few conversations to see which one Narsil shows and in what order the band lists them, four to a page.',
      intro:
        'Narsil shows the most important conversation: an error first, then one that needs you, then one that is working, then one that is done. A tie goes to the most recent change. The band lists this conversation first, whatever its state.',
      guideText: 'How Narsil follows every conversation',
      statuses: {
        error: 'Error',
        waiting: 'Needs you',
        working: 'Working',
        done: 'Done',
        idle: 'Idle',
      },
      own: 'This conversation',
      other: 'Conversation {n}',
      statusLabel: 'State',
      minutesLabel: 'Minutes since its last change',
      add: 'Add a conversation',
      remove: 'Remove {name}',
      wearsLabel: 'Narsil shows',
      wears: '{name}: {status}',
      rowsLabel: 'Band rows',
      page: 'Page {page}',
    },
    context: {
      title: 'Context fill estimator',
      description:
        'Enter two readings of the context bar and the minutes between them to see when the window fills, the way Narsil estimates it.',
      intro:
        'Narsil projects the pace of the last 15 minutes in a straight line to 100 %. It needs at least a minute of readings, shows nothing while the fill is not growing, and hides estimates past two hours.',
      guideText: 'How Narsil shows the context and the limits',
      earlierLabel: 'Fill before (%)',
      nowLabel: 'Fill now (%)',
      minutesLabel: 'Minutes between the readings',
      resultLabel: 'Estimate',
      estimate: 'Full in about {minutes} min.',
      far: 'More than two hours away: Narsil does not show an estimate that far ahead.',
      full: 'The context window is full.',
      old: 'Narsil only uses readings from the last 15 minutes, so there is no estimate.',
      short: 'The readings are less than a minute apart, so there is no estimate yet.',
      flat: 'The fill is not growing, so there is no estimate.',
    },
    cache: {
      title: 'Cache clock',
      description:
        'Choose a subscription or an API key and the minutes since the last request to see how much prompt cache is left, as Narsil counts it.',
      intro:
        'The prompt cache lasts 60 minutes on a subscription plan and 5 minutes with an API key, counted from the start of the last request. Once it goes cold, the next message is charged in full. You can also set the length by hand, as /narsil cache does.',
      guideText: 'How Narsil counts down the prompt cache',
      accountLabel: 'How you use Claude Code',
      accounts: {
        plan: 'Subscription plan',
        api: 'API key',
        custom: 'Set by hand',
      },
      customLabel: 'Cache length (minutes)',
      elapsedLabel: 'Minutes since the last request started',
      resultLabel: 'Prompt cache',
      lasts: 'The cache lasts {minutes} min.',
      warm: 'Cache: {left} min left',
      cold: 'Cold cache: the next message is charged in full',
    },
    botConfig: {
      title: 'Bot server configuration',
      description:
        'Build the data/.config.yaml of the Narsil desk bot server from guides 4 to 6: address, time zone, Claude model and voice, with no real keys.',
      intro:
        'The desk bot server on your PC reads data/.config.yaml. This tool writes the file guides 4, 5 and 6 build: the server address on your network, speech recognition, Claude as the brain, and Narsil’s personality and voice.',
      guideText: 'Claude as the brain of the bot',
      hostLabel: 'Your PC address on the local network',
      timezoneLabel: 'Time zone offset (hours)',
      modelLabel: 'Model',
      models: {
        'claude-opus-5-5': 'Claude Opus 5.5',
        'claude-haiku-5-5': 'Claude Haiku 5.5',
      },
      effortLabel: 'Effort',
      efforts: {
        low: 'Low',
        medium: 'Medium',
        high: 'High',
      },
      maxTokensLabel: 'Max tokens per answer',
      voiceLabel: 'Edge voice',
      resultLabel: 'data/.config.yaml',
      invalid: {
        host: 'Use a private IPv4 address of your network, such as 192.168.1.50: the server only listens on your network.',
        timezone: 'Use a whole number of hours between -12 and 14.',
        model: 'Pick one of the models.',
        effort: 'Pick one of the effort levels.',
        maxTokens: 'Use a whole number from 1 to 128000.',
        voice: 'Use an Edge voice name, such as es-MX-DaliaNeural.',
      },
      copy: 'Copy the file',
      copied: 'Copied',
      keyNote:
        'The only key in the file is a placeholder for speech recognition: replace it in your own copy on your PC. The Anthropic key never goes in this file; the server reads it from ANTHROPIC_API_KEY.',
    },
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
      photoAlt: 'Photo of Hernán David Figueroa',
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
