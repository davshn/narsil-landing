import type { TranslationShape } from '../index'

export const it: TranslationShape = {
  meta: {
    siteName: 'Narsil Workshop',
    title: 'Narsil Workshop — crea le tue mod di Claude Code e un bot di Narsil',
    description:
      'Guide gratuite, passo dopo passo, per creare una mod con una mascotte di stato come Narsil, un pannello di revisione come Narsil Check e un bot di Narsil che parla con Claude e mostra le tue pull request di GitHub.',
  },
  common: {
    skipToContent: 'Vai al contenuto',
    toggleTheme: 'Cambia tema',
    language: 'Lingua',
    mainNavigation: 'Navigazione principale',
  },
  nav: {
    mods: 'Basi delle mod',
    routes: 'Percorsi di apprendimento',
    tools: 'Strumenti',
    support: 'Sostieni il progetto',
  },
  footer: {
    description: 'Guide gratuite per creare da zero mod di Claude Code e un bot di Narsil.',
    donate: 'Offrimi un caffè',
    trademark:
      'Claude e Claude Code sono marchi di Anthropic, PBC. Questo progetto non è affiliato né approvato da Anthropic.',
    privacy: 'Questo sito non ha analitiche e non ti chiede mai token o chiavi.',
    license:
      'Codice del sito e degli esempi: MIT. Testo delle guide: CC BY-SA 4.0. Codice citato da Narsil e Narsil Check: GPL-3.0-or-later.',
  },
  home: {
    headline: 'Crea le tue mod di Claude Code, passo dopo passo',
    subheadline:
      'Scopri come funzionano dentro Narsil e Narsil Check, ricostruisci ogni funzionalità da zero e finisci con un bot di Narsil che parla con Claude e mostra le tue pull request.',
    cta: 'Vedi i percorsi',
    fundamentalsCta: 'Inizia dalle basi',
    heroAlt: 'Narsil, un piccolo drago marino, che saluta',
    states: {
      title: 'Cosa ti dice Narsil a colpo d’occhio',
      subtitle:
        'Ogni stato ha la sua posa e il suo colore, così sai cosa sta facendo Claude senza leggere il terminale.',
      items: [
        { label: 'Al lavoro', text: 'Claude sta leggendo, modificando o eseguendo comandi.' },
        { label: 'Ti aspetta', text: 'Claude ha fatto una domanda o aspetta un permesso.' },
        { label: 'Finito', text: 'Il turno è finito. È il momento di rivedere cosa è cambiato.' },
        {
          label: 'Errore',
          text: 'Uno strumento non ha funzionato o il turno si è fermato con un errore.',
        },
      ],
    },
    showcase: {
      title: 'Come appare',
      subtitle:
        'Le stesse informazioni ti seguono ovunque: sopra il prompt, in una finestra mobile, in un pannello laterale e sul telefono.',
      items: [
        {
          title: 'La finestra mobile',
          text: 'Narsil, i tuoi limiti di utilizzo e ogni conversazione aperta con contesto, attività, cache e prossimi passi, in una piccola finestra sempre in primo piano.',
          alt: 'La finestra mobile di Narsil: una conversazione al lavoro con le sue attività, le barre di utilizzo e altre due conversazioni aperte',
        },
        {
          title: 'Il pannello di Narsil Check',
          text: 'Un pannello laterale con l’ambiente della sessione, i passi della CI, gli aggiornamenti delle librerie raggruppati per rischio, le vulnerabilità e le attività in sospeso.',
          alt: 'Il pannello di Narsil Check: ambiente e CI, tre aggiornamenti di librerie, una vulnerabilità e due attività in sospeso',
        },
        {
          title: 'Narsil in Claude, sul telefono',
          text: 'Un’estensione sperimentale che porta Narsil dentro claude.ai su Android: nel menu laterale, il suo livello, i tuoi limiti di utilizzo e i messaggi ntfy del giorno; sopra la casella di testo, lo stato della conversazione aperta. Il suo codice non è pubblico, ma le guide spiegano come si costruisce.',
          alt: 'Il menu laterale di claude.ai su un telefono Android con il blocco di Narsil: il livello, i limiti di 5 ore e settimanali e i messaggi ntfy del giorno. I dati personali sono sfocati.',
          detailAlt:
            'Una conversazione di claude.ai su un telefono Android: sopra la casella di testo, la fascia di Narsil mostra lo stato TRABAJANDO (al lavoro), il contesto all’80 %, la cache a 60 min e l’ultimo evento, Usando Bash (sta usando Bash). La conversazione è sfocata.',
        },
      ],
      note: 'La finestra mobile usa dati di esempio, e la cattura del telefono è reale, con i dati personali sfocati. Il pannello di Narsil Check è ricreato dal suo codice sorgente, perché viene disegnato solo dentro Claude Code. Le illustrazioni di Narsil vengono da davshn/narsil-pet (GPL v3).',
    },
    aboutTitle: "Che cos'è Narsil?",
    about: [
      'Narsil è una mod di Claude Code: una piccola mascotte che vive sopra il prompt e ti dice a colpo d’occhio se Claude sta lavorando, ha bisogno di te, ha finito o si è bloccato. Narsil Check è la sua sorella, un pannello laterale che controlla il tuo branch, la CI, le dipendenze e le vulnerabilità.',
      'Qui non ti limiterai a installarle. Ogni guida spiega quali hook ascolta una funzionalità, quale stato conserva e cosa disegna, e poi costruisce una versione minima che funziona, con i suoi test.',
    ],
    routesTitle: 'Quattro percorsi di apprendimento',
    routesSubtitle:
      'Scegli un percorso e segui le sue guide in ordine. Se non hai mai creato una mod, inizia dalle basi delle mod.',
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
        title: 'Un bot di Narsil',
        description:
          'Dai un corpo a Narsil: uno schermo touch ESP32-P4 nella pancia con le tue attività e le tue pull request, una testa olografica ESP32-S3 con il suo volto, e la voce con Xiaozhi e Claude sul tuo server.',
        icon: 'lucide:cpu',
      },
      {
        title: 'Narsil in Claude, sul telefono',
        description:
          'Sperimentale: scopri come è fatta l’estensione del browser che porta Narsil su claude.ai in Android, con la banda della conversazione, il menu laterale con i tuoi limiti e i messaggi di ntfy, i colori e i pacchetti per Android.',
        icon: 'lucide:smartphone',
      },
    ],
    coffeeTitle: 'Gratis, e lo resterà',
    coffeeText:
      'Niente pubblicità, niente registrazione e nessun prezzo. Se una guida ti aiuta, puoi offrirmi un caffè per scrivere la prossima.',
    coffeeCta: 'Offrimi un caffè',
    extension: {
      badge: 'Sperimentale',
      title: 'Narsil in Claude, l’estensione del browser',
      text: 'Narsil vive anche dentro claude.ai sul tuo telefono: un’estensione per Firefox e Vivaldi su Android mostra sopra la casella di testo lo stato, il contesto, la cache e l’ultimo evento della conversazione aperta, e nel menu laterale il livello di Narsil, i tuoi limiti di utilizzo e i messaggi ntfy.sh del giorno. Inoltre veste Claude con i colori di Narsil.',
      note: 'È sperimentale: è molto collaudata, ma si basa sulla struttura della pagina di claude.ai e non su un’API pubblica, quindi un aggiornamento di Claude può romperla. Legge soltanto: non scrive mai nel tuo account né invia le tue conversazioni da nessuna parte, anche se carica i disegni di Narsil da GitHub e legge il suo topic di stato su ntfy.sh. Il suo codice non è pubblico, ma le guide spiegano come si costruisce.',
      cta: 'Come è fatta',
    },
  },
  mods: {
    title: 'Basi delle mod',
    description:
      'Di cosa è fatta una mod di Claude Code, l’oggetto $, come installare e testare una mod, dove funziona e cosa comporta per il tuo codice la licenza GPL v3 di Narsil.',
    intro: [
      'Prima di ricostruire Narsil o Narsil Check ti servono i pezzi che tutte le mod condividono: tre piccoli file, una funzione che registra gli hook e l’oggetto $, che raggiunge tutto ciò che sta fuori dal modulo.',
      'Leggi queste guide in ordine. Ognuna finisce con un modo per verificare che quello che hai costruito funziona.',
    ],
    listTitle: 'Le guide',
    startCta: 'Inizia la prima guida',
  },
  pet: {
    title: 'La tua mascotte di stato',
    description:
      'Crea una mod come Narsil, una funzionalità alla volta: cosa fa ognuna, come funziona dentro, come è stata chiesta all’IA e il codice minimo per renderla tua.',
    intro: [
      'Narsil è stata costruita parlando con Claude Code. Ogni guida di questo percorso spiega una sua funzionalità: cosa fa per chi la usa, gli hook e lo stato che ci sono dietro, le scelte di progetto e la richiesta da cui è partita.',
      'Quando la richiesta originale è stata registrata, la guida la cita parola per parola. Quando non lo è, la guida lo dice e la ricostruisce dalla cronologia dei commit.',
    ],
    listTitle: 'Le guide',
    startCta: 'Inizia la prima guida',
  },
  check: {
    title: 'Il tuo pannello di revisione',
    description:
      'Crea una mod come Narsil Check, una funzionalità alla volta: cosa fa ognuna, come funziona dentro, come è stata chiesta all’IA e il codice minimo per renderla tua.',
    intro: [
      'Narsil Check è un pannello laterale che controlla la tua sessione prima della consegna: ambiente, connettori, CI, branch indietro rispetto al remoto, aggiornamenti raggruppati per rischio, vulnerabilità e una lista di cose da fare che Claude può usare. Ogni guida spiega una sua funzionalità, le scelte di progetto e la richiesta da cui è partita.',
      'Quando la richiesta originale è stata registrata, la guida la cita parola per parola. Quando non lo è, la guida lo dice e la ricostruisce dalla cronologia dei commit.',
    ],
    listTitle: 'Le guide',
    startCta: 'Inizia la prima guida',
  },
  bot: {
    title: 'Un bot di Narsil',
    description:
      'Dai un corpo a Narsil: uno schermo touch ESP32-P4 nella pancia, una testa olografica ESP32-S3 e la voce con Xiaozhi e Claude sul tuo server. Cosa fa ogni parte, come funziona e come è stata chiesta all’IA.',
    intro: [
      'Il bot ha due schede unite da quattro fili. La pancia, un ESP32-P4 con schermo touch da 4,3 pollici, esegue Xiaozhi: ascolta, parla con Claude tramite il tuo server e mostra le tue attività e le tue pull request. La testa, un ESP32-S3 con schermo da 1,3 pollici dentro un cubo prisma, disegna solo il volto di Narsil e riceve il suo stato dalla pancia via UART.',
      'Leggi le guide in ordine. Ognuna spiega cosa fa la parte, come funziona, le scelte dietro e la conversazione in cui sono state prese, e poi il codice.',
    ],
    listTitle: 'Le guide',
    startCta: 'Inizia la prima guida',
  },
  claude: {
    title: 'Narsil in Claude',
    description:
      'Come è fatta l’estensione sperimentale che porta Narsil su claude.ai in Android: la banda della conversazione, il menu laterale, i colori e i pacchetti per Android.',
    intro: [
      'Narsil in Claude è un’estensione per Firefox e Vivaldi su Android che mostra Narsil dentro la vera web app di claude.ai. Ogni guida spiega una delle sue parti: cosa fa, come funziona dentro e come è stata chiesta all’IA.',
      'È sperimentale: dipende dalla struttura della pagina di claude.ai, non da un’API pubblica, quindi un aggiornamento di Claude può romperla. Il suo codice non è pubblico, quindi il codice minimo di queste guide è scritto per le guide.',
    ],
    listTitle: 'Le guide',
    startCta: 'Inizia dalla prima guida',
  },
  guide: {
    breadcrumbLabel: 'Percorso di navigazione',
    stepOf: 'Guida {current} di {total}',
    updated: 'Aggiornata',
    verifiedWith: 'Verificata con Claude Code {version}',
    sourcesTitle: 'Per andare oltre: come lo fa la mod vera',
    sourcesIntro:
      'Questi file fanno parte delle mod originali, pubblicate con licenza GPL v3. Il codice citato in questa pagina viene da lì e mantiene quella licenza.',
    pathNavLabel: 'Guide di questo percorso',
    tocTitle: 'In questa pagina',
    pagerLabel: 'Guida precedente e successiva',
    previous: 'Precedente',
    next: 'Successiva',
    backToPath: 'Tutte le guide di questo percorso',
    summaryTitle: 'In questo percorso',
    guideCount: '{count} guide',
    readingMinutes: 'Circa {value} min di lettura',
    readingHours: 'Circa {value} h di lettura',
    guideMinutes: '{value} min',
    coffeeTitle: 'Questa guida ti è stata utile?',
    coffeeText:
      'Tutte le guide sono gratuite. Se questa ti ha fatto risparmiare tempo, puoi offrirmi un caffè.',
    coffeeCta: 'Offrimi un caffè',
  },
  tools: {
    title: 'Strumenti',
    description:
      'Piccoli strumenti che funzionano nel browser e aiutano a capire le guide: prova le regole di Narsil e Narsil Check con i tuoi valori.',
    intro:
      'Ogni strumento esegue una regola dei mod, così puoi provarla con i tuoi valori, accanto alla guida che la spiega.',
    privacy:
      'Tutto funziona nel tuo browser. Niente di ciò che scrivi lascia questa pagina o finisce in un link.',
    open: 'Apri lo strumento',
    semver: {
      title: 'Classificatore semver',
      description:
        'Scrivi una versione installata e una più recente per vedere in quale gruppo Narsil Check mette l’aggiornamento, con la regola sotto la 1.0.0.',
      intro:
        'Narsil Check confronta la versione che hai con l’ultima e ordina l’aggiornamento in base a quanto sono distanti. Questo strumento esegue la stessa regola.',
      guideText: 'Come Narsil Check classifica gli aggiornamenti',
      installedLabel: 'Versione installata',
      candidateLabel: 'Nuova versione',
      resultLabel: 'Gruppo',
      groups: {
        review: 'Versione major: rivedi le modifiche',
        bump: 'Solo alzare la versione',
      },
      bumps: {
        patch: 'patch',
        minor: 'minor',
        major: 'major',
      },
      summary: 'Da {from} a {to}: un salto {bump}.',
      belowOne:
        'Sotto la 1.0.0 una minor conta come major, e sotto la 0.1.0 anche una patch, come npm legge gli intervalli con ^.',
      current: '{to} non è più recente di {from}, quindi non c’è niente da aggiornare.',
      invalidInstalled: 'La versione installata non è una versione che Narsil Check sa leggere.',
      invalidCandidate: 'La nuova versione non è una versione che Narsil Check sa leggere.',
    },
    xp: {
      title: 'Calcolatore di XP',
      description:
        'Conta i turni finiti, le esecuzioni di test che passano e i subagenti finiti per vedere XP, livello e stadio di Narsil, e quanto manca al prossimo.',
      intro:
        'Narsil guadagna 10 XP per ogni turno finito, 5 per ogni esecuzione di test che passa e 3 per ogni subagente che finisce. Ogni livello chiede 100 XP in più del precedente, e cinque stadi cambiano il suo aspetto.',
      guideText: 'Come Narsil guadagna esperienza e cresce',
      turnsLabel: 'Turni finiti',
      testsLabel: 'Test che passano',
      agentsLabel: 'Subagenti finiti',
      resultLabel: 'Dove si trova Narsil',
      total: '{xp} XP in totale.',
      level: 'Livello {level} · {into}/{needed} XP',
      stage: 'Stadio {stage} di {stages}.',
      nextStage:
        'Lo stadio {stage} comincia al livello {level}: mancano {xp} XP, circa {turns} turni finiti in più.',
      grown: 'Narsil è cresciuta del tutto: lo stadio 5 è l’ultimo.',
    },
    priority: {
      title: 'Simulatore di priorità',
      description:
        'Scegli lo stato di alcune conversazioni per vedere quale mostra Narsil e in che ordine la banda le elenca, quattro per pagina.',
      intro:
        'Narsil mostra la conversazione più importante: prima un errore, poi una che ha bisogno di te, poi una al lavoro, poi una finita. A parità vince il cambiamento più recente. La banda elenca per prima questa conversazione, qualunque sia il suo stato.',
      guideText: 'Come Narsil segue tutte le conversazioni',
      statuses: {
        error: 'Errore',
        waiting: 'Ha bisogno di te',
        working: 'Al lavoro',
        done: 'Finito',
        idle: 'Ferma',
      },
      own: 'Questa conversazione',
      other: 'Conversazione {n}',
      statusLabel: 'Stato',
      minutesLabel: 'Minuti dall’ultimo cambiamento',
      add: 'Aggiungi una conversazione',
      remove: 'Rimuovi {name}',
      wearsLabel: 'Narsil mostra',
      wears: '{name}: {status}',
      rowsLabel: 'Righe della banda',
      page: 'Pagina {page}',
    },
    context: {
      title: 'Stima del riempimento del contesto',
      description:
        'Inserisci due letture della barra del contesto e i minuti tra loro per vedere quando si riempie la finestra, come la stima Narsil.',
      intro:
        'Narsil proietta in linea retta fino al 100 % il ritmo degli ultimi 15 minuti. Le serve almeno un minuto di letture, non mostra nulla finché il riempimento non cresce e nasconde le stime oltre le due ore.',
      guideText: 'Come Narsil mostra il contesto e i limiti',
      earlierLabel: 'Riempimento prima (%)',
      nowLabel: 'Riempimento ora (%)',
      minutesLabel: 'Minuti tra le letture',
      resultLabel: 'Stima',
      estimate: 'Pieno tra circa {minutes} min.',
      far: 'Mancano più di due ore: Narsil non mostra una stima così lontana.',
      full: 'La finestra di contesto è piena.',
      old: 'Narsil usa solo le letture degli ultimi 15 minuti, quindi non c’è una stima.',
      short: 'Le letture distano meno di un minuto, quindi non c’è ancora una stima.',
      flat: 'Il riempimento non cresce, quindi non c’è una stima.',
    },
    cache: {
      title: 'Orologio della cache',
      description:
        'Scegli abbonamento o chiave API e i minuti dall’ultima richiesta per vedere quanta cache del prompt resta, come la conta Narsil.',
      intro:
        'La cache del prompt dura 60 minuti con un piano in abbonamento e 5 minuti con una chiave API, contati dall’inizio dell’ultima richiesta. Quando si raffredda, il messaggio successivo si paga per intero. Puoi anche fissarne la durata a mano, come fa /narsil cache.',
      guideText: 'Come Narsil conta la cache del prompt',
      accountLabel: 'Come usi Claude Code',
      accounts: {
        plan: 'Piano in abbonamento',
        api: 'Chiave API',
        custom: 'A mano',
      },
      customLabel: 'Durata della cache (minuti)',
      elapsedLabel: 'Minuti dall’inizio dell’ultima richiesta',
      resultLabel: 'Cache del prompt',
      lasts: 'La cache dura {minutes} min.',
      warm: 'Cache: restano {left} min',
      cold: 'Cache fredda: il prossimo messaggio si paga per intero',
    },
    botConfig: {
      title: 'Configurazione del server del bot',
      description:
        'Prepara il data/.config.yaml del server del bot da scrivania di Narsil con le guide 4–6: indirizzo, fuso orario, modello di Claude e voce, senza chiavi vere.',
      intro:
        'Il server del bot sul tuo PC legge data/.config.yaml. Questo strumento scrive il file che costruiscono le guide 4, 5 e 6: l’indirizzo del server nella tua rete, il riconoscimento vocale, Claude come cervello e la personalità e la voce di Narsil.',
      guideText: 'Claude come cervello del bot',
      hostLabel: 'Indirizzo del tuo PC nella rete locale',
      timezoneLabel: 'Differenza di fuso orario (ore)',
      modelLabel: 'Modello',
      models: {
        'claude-opus-5-5': 'Claude Opus 5.5',
        'claude-haiku-5-5': 'Claude Haiku 5.5',
      },
      effortLabel: 'Sforzo',
      efforts: {
        low: 'Basso',
        medium: 'Medio',
        high: 'Alto',
      },
      maxTokensLabel: 'Token massimi per risposta',
      voiceLabel: 'Voce di Edge',
      resultLabel: 'data/.config.yaml',
      invalid: {
        host: 'Usa un indirizzo IPv4 privato della tua rete, come 192.168.1.50: il server ascolta solo nella tua rete.',
        timezone: 'Usa un numero intero di ore tra -12 e 14.',
        model: 'Scegli uno dei modelli.',
        effort: 'Scegli uno dei livelli di sforzo.',
        maxTokens: 'Usa un numero intero da 1 a 128000.',
        voice: 'Usa un nome di voce di Edge, come es-MX-DaliaNeural.',
      },
      copy: 'Copia il file',
      copied: 'Copiato',
      keyNote:
        'L’unica chiave del file è un segnaposto per il riconoscimento vocale: sostituiscila nella tua copia sul PC. La chiave di Anthropic non va mai in questo file; il server la legge da ANTHROPIC_API_KEY.',
    },
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
    flow: {
      title: 'Dove va il tuo caffè',
      steps: ['Un caffè', 'Tempo per scrivere e mantenere le guide', 'Guide gratuite per tutti'],
      promises: [
        'Niente pubblicità',
        'Niente registrazione',
        'Niente analytics, non chiede mai i tuoi token',
      ],
    },
    about: {
      title: 'Lo sviluppatore',
      name: 'Hernán David Figueroa',
      photoAlt: 'Foto di Hernán David Figueroa',
      bio: 'Sviluppatore full-stack con più di 8 anni di esperienza, specializzato in fintech e pagamenti sicuri. Lavoro su terminali POS e funzionalità di pagamento per Android e iOS in un gateway di pagamento colombiano. Ho creato Narsil e questo workshop perché chiunque possa capire ed estendere Claude Code. Vivo a Bogotá.',
    },
    reposTitle: 'Il codice sorgente',
    repos: {
      pet: 'Narsil, la mod con la mascotte di stato',
      check: 'Narsil Check, la mod con il pannello di revisione',
    },
    developer: {
      text: 'Creo e mantengo Narsil e questo laboratorio in autonomia.',
      link: 'Vedi il mio profilo da sviluppatore',
    },
  },
}
