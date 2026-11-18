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
          title: 'Sul telefono',
          text: 'Una web app installabile che riceve gli avvisi di Narsil tramite ntfy e mostra l’ultima cosa mostrata dal PC.',
          alt: 'L’app di Narsil sul telefono: lo stato attuale, il livello, i limiti di utilizzo, la cache e i prossimi passi',
        },
      ],
      note: 'Sono le interfacce reali con dati di esempio. Il pannello di Narsil Check è ricreato dal suo codice sorgente, perché viene disegnato solo dentro Claude Code. Le illustrazioni di Narsil vengono da davshn/narsil-pet (GPL v3).',
    },
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
        title: 'Un bot di Narsil',
        description:
          'Dai un corpo a Narsil: uno schermo touch ESP32-P4 nella pancia con le tue attività e le tue pull request, una testa olografica ESP32-S3 con il suo volto, e la voce con Xiaozhi e Claude sul tuo server.',
        icon: 'lucide:cpu',
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
      note: 'È sperimentale: è molto collaudata, ma si basa sulla struttura della pagina di claude.ai e non su un’API pubblica, quindi un aggiornamento di Claude può romperla. Legge soltanto e non invia mai i tuoi dati da nessuna parte.',
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
  guide: {
    breadcrumbLabel: 'Percorso di navigazione',
    stepOf: 'Guida {current} di {total}',
    updated: 'Aggiornata',
    verifiedWith: 'Verificata con Claude Code {version}',
    sourcesTitle: 'Per andare oltre: come lo fa la mod vera',
    sourcesIntro:
      'Questi file fanno parte delle mod originali, pubblicate con licenza GPL v3. Il codice citato in questa pagina viene da lì e mantiene quella licenza.',
    pathNavLabel: 'Guide di questo percorso',
    previous: 'Precedente',
    next: 'Successiva',
    backToPath: 'Tutte le guide di questo percorso',
    coffeeTitle: 'Questa guida ti è stata utile?',
    coffeeText:
      'Tutte le guide sono gratuite. Se questa ti ha fatto risparmiare tempo, puoi offrirmi un caffè.',
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
    },
    developer: {
      text: 'Creo e mantengo Narsil e questo laboratorio in autonomia.',
      link: 'Vedi il mio profilo da sviluppatore',
    },
  },
}
