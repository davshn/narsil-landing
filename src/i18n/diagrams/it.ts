import type { DiagramCopy } from '../index'

export const itDiagrams: DiagramCopy = {
  stages: {
    mods: [
      { title: 'I file', text: 'Tre piccoli file e la funzione che registra gli hook.' },
      { title: 'L’oggetto $', text: 'Come la mod raggiunge lo schermo, lo storage e la rete.' },
      { title: 'Eseguire e testare', text: 'Installarla, ricaricarla, validarla e testarla.' },
      { title: 'Dove si vede', text: 'Il terminale, l’app desktop, VS Code e il mobile.' },
      { title: 'Riusare con cura', text: 'Cosa significa la GPL v3 quando copi codice di Narsil.' },
    ],
    pet: [
      { title: 'Dargli un corpo', text: 'I suoi stati e il disegno di ognuno.' },
      { title: 'Seguire il lavoro', text: 'Ogni conversazione, attività e subagente.' },
      { title: 'Finestra e voce', text: 'Una finestra flottante, una voce e gli avvisi.' },
      { title: 'Guardare l’orologio', text: 'Il contesto, i limiti e la cache del prompt.' },
      { title: 'Reagire a te', text: 'Comandi, permessi e consigli da Haiku.' },
      { title: 'Farlo crescere', text: 'Prossimi passi, esperienza e modalità silenziosa.' },
      {
        title: 'Oltre la sessione',
        text: 'Avvisi su telefono e orologio, un riepilogo e i tuoi comandi.',
      },
    ],
    check: [
      {
        title: 'Pannello e mappa',
        text: 'Il pannello laterale e una mappa dal vivo del lavoro di Claude.',
      },
      { title: 'Leggere la sessione', text: 'L’ambiente, i connettori, la CI e il branch.' },
      {
        title: 'Trovare gli aggiornamenti',
        text: 'Un adattatore per ecosistema, ordinato per rischio.',
      },
      { title: 'Agire', text: 'Spiegare una major, aggiornare le banali e aprire la PR.' },
      { title: 'Sorvegliare', text: 'Vulnerabilità, cose da fare e strumenti per Claude.' },
      { title: 'Andare oltre', text: 'Kotlin, Gradle e AGP.' },
    ],
    bot: [
      { title: 'Progettare il bot', text: 'I pezzi, come si collegano e gli strumenti.' },
      { title: 'Svegliare la pancia', text: 'Xiaozhi in funzione sull’ESP32-P4.' },
      { title: 'Dargli una mente', text: 'Il tuo server, Claude e la voce di Narsil.' },
      { title: 'Portare i dati', text: 'Gli avvisi di Narsil e le tue pull request.' },
      { title: 'Disegnare la pancia', text: 'Lo schermo touch con LVGL.' },
      { title: 'Aggiungere la testa', text: 'Il collegamento UART e il volto olografico.' },
      { title: 'Proteggerlo', text: 'Ogni segreto, dove vive e come revocarlo.' },
    ],
    claude: [
      { title: 'Cos’è', text: 'Un’estensione che porta Narsil in claude.ai su Android.' },
      { title: 'La banda', text: 'Lo stato di Narsil sopra la casella dei messaggi.' },
      {
        title: 'Il menu laterale',
        text: 'Il tuo livello Narsil, i tuoi limiti e i messaggi ntfy.',
      },
      { title: 'L’aspetto', text: 'I colori e l’icona di Narsil.' },
      { title: 'Pubblicarla', text: 'Un sorgente, due pacchetti Android.' },
    ],
  },
  botMap: {
    title: 'Come si compone il bot',
    text: 'La pancia gestisce ogni connessione e ogni segreto, e la testa disegna soltanto. Ogni parte rimanda alle guide che la costruiscono.',
    parts: {
      head: {
        title: 'La testa',
        text: 'ESP32-S3 sotto un cubo prisma. Disegna il volto di Narsil.',
      },
      belly: {
        title: 'La pancia',
        text: 'Schermo touch ESP32-P4 con Xiaozhi. Gestisce il Wi-Fi e ogni segreto.',
      },
      feeds: { title: 'ntfy e GitHub', text: 'Gli avvisi di Narsil e le tue pull request aperte.' },
      server: { title: 'Il tuo server', text: 'xiaozhi-esp32-server in Docker sul tuo PC.' },
      claude: { title: 'Claude', text: 'Scrive le risposte di Narsil.' },
    },
    links: {
      uart: 'UART, tre fili',
      lan: 'WebSocket sulla tua rete',
      https: 'HTTPS',
    },
  },
}
