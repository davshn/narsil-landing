import type { TranslationShape } from '../index'

export const it: TranslationShape = {
  meta: {
    siteName: 'Narsil Workshop',
    title: 'Narsil Workshop — crea le tue mod di Claude Code e un bot ESP32-S3',
    description:
      'Guide gratuite, passo dopo passo, per creare una mod con una mascotte di stato come Narsil, un pannello di revisione come Narsil Check e un bot ESP32-S3 che mostra le tue pull request di GitHub.',
  },
  common: {
    skipToContent: 'Vai al contenuto',
    toggleTheme: 'Cambia tema',
    language: 'Lingua',
    mainNavigation: 'Navigazione principale',
  },
  nav: {
    routes: 'Percorsi di apprendimento',
    support: 'Sostieni il progetto',
  },
  footer: {
    description: 'Guide gratuite per creare da zero mod di Claude Code e un bot ESP32-S3.',
    donate: 'Offrimi un caffè',
    trademark:
      'Claude e Claude Code sono marchi di Anthropic, PBC. Questo progetto non è affiliato né approvato da Anthropic.',
    privacy: 'Questo sito non ha analitiche e non ti chiede mai token o chiavi.',
  },
  home: {
    headline: 'Crea le tue mod di Claude Code, passo dopo passo',
    subheadline:
      'Scopri come funzionano dentro Narsil e Narsil Check, ricostruisci ogni funzionalità da zero e finisci con un bot ESP32-S3 che mostra le tue pull request.',
    cta: 'Vedi i percorsi',
    secondaryCta: 'Offrimi un caffè',
    aboutTitle: "Che cos'è Narsil?",
    about: [
      'Narsil è una mod di Claude Code: una piccola mascotte che vive sopra il prompt e ti dice a colpo d’occhio se Claude sta lavorando, ha bisogno di te, ha finito o si è bloccato. Narsil Check è la sua sorella, un pannello laterale che controlla il tuo branch, la CI, le dipendenze e le vulnerabilità.',
      'Qui non ti limiterai a installarle. Ogni guida spiega quali hook ascolta una funzionalità, quale stato conserva e cosa disegna, e poi costruisce una versione minima che funziona, con i suoi test.',
    ],
    routesTitle: 'Tre percorsi di apprendimento',
    routesSubtitle: 'Le guide sono in arrivo. Ogni percorso parte dalle basi di una mod.',
    routes: [
      {
        title: 'La tua mascotte di stato',
        description:
          'Crea una mod come Narsil: stati sopra il prompt, animazioni, tutte le conversazioni in un solo posto, una finestra mobile, voce, orologi del contesto e della cache, e avvisi sul telefono.',
        icon: 'lucide:sparkles',
      },
      {
        title: 'Il tuo pannello di revisione',
        description:
          'Crea una mod come Narsil Check: un pannello laterale con i passi della CI, il branch indietro rispetto al remoto, aggiornamenti raggruppati per rischio, vulnerabilità da OSV.dev e strumenti per Claude.',
        icon: 'lucide:list-checks',
      },
      {
        title: 'Un bot ESP32-S3',
        description:
          'Costruisci un piccolo dispositivo con schermo che mostra le pull request che ti aspettano su GitHub e lo stato di Narsil, ricevuto tramite un topic privato di ntfy.',
        icon: 'lucide:cpu',
      },
    ],
    coffeeTitle: 'Gratis, e lo resterà',
    coffeeText:
      'Niente pubblicità, niente registrazione e nessun prezzo. Se una guida ti aiuta, puoi offrirmi un caffè per scrivere la prossima.',
    coffeeCta: 'Offrimi un caffè',
  },
  support: {
    title: 'Sostieni Narsil Workshop',
    description:
      'Narsil Workshop è gratuito e non avrà mai pubblicità né un prezzo. Se ti aiuta, puoi offrirmi un caffè per scrivere altre guide.',
    lines: [
      'Grazie per leggere Narsil Workshop. Ogni guida è gratuita e lo resterà: niente pubblicità, niente registrazione e nessun costo, mai.',
      'Se una guida ti ha aiutato a creare la tua mod o il tuo bot, puoi offrirmi un caffè. È un pagamento unico dell’importo che preferisci, ed è del tutto facoltativo.',
      'Ogni caffè diventa nuove guide, esempi e strumenti per chi vuole capire ed estendere Claude Code.',
    ],
    donate: 'Offrimi un caffè',
    unavailable: 'Le donazioni non sono ancora aperte.',
    reposTitle: 'Il codice sorgente',
    repos: {
      pet: 'Narsil, la mod con la mascotte di stato',
      check: 'Narsil Check, la mod con il pannello di revisione',
      site: 'Narsil Workshop, questo sito',
    },
    developer: {
      text: 'Creo e mantengo Narsil e questo laboratorio in autonomia.',
      link: 'Vedi il mio profilo da sviluppatore',
    },
  },
}
