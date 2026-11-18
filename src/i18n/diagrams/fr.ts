import type { DiagramCopy } from '../index'

export const frDiagrams: DiagramCopy = {
  stages: {
    mods: [
      {
        title: 'Les fichiers',
        text: 'Trois petits fichiers et la fonction qui enregistre les hooks.',
      },
      { title: 'L’objet $', text: 'Comment le mod atteint l’écran, le stockage et le réseau.' },
      { title: 'Lancer et tester', text: 'L’installer, le recharger, le valider et le tester.' },
      { title: 'Où il s’affiche', text: 'Le terminal, l’app de bureau, VS Code et le mobile.' },
      {
        title: 'Réutiliser avec soin',
        text: 'Ce que la GPL v3 implique quand vous copiez du code de Narsil.',
      },
    ],
    pet: [
      { title: 'Lui donner un corps', text: 'Ses états et le dessin de chacun.' },
      { title: 'Suivre le travail', text: 'Chaque conversation, tâche et sous-agent.' },
      { title: 'Fenêtre et voix', text: 'Une fenêtre flottante, une voix et des alertes.' },
      { title: 'Surveiller l’horloge', text: 'Le contexte, les limites et le cache du prompt.' },
      { title: 'Réagir à vous', text: 'Commandes, permissions et conseils de Haiku.' },
      { title: 'Le faire grandir', text: 'Prochaines étapes, expérience et mode silencieux.' },
      {
        title: 'Au-delà de la session',
        text: 'Alertes sur le téléphone et la montre, un résumé et vos propres commandes.',
      },
    ],
    check: [
      {
        title: 'Panneau et carte',
        text: 'Le panneau latéral et une carte en direct du travail de Claude.',
      },
      { title: 'Lire la session', text: 'L’environnement, les connecteurs, la CI et la branche.' },
      { title: 'Trouver les mises à jour', text: 'Un adaptateur par écosystème, trié par risque.' },
      {
        title: 'Agir',
        text: 'Expliquer une majeure, mettre à jour les triviales et ouvrir la PR.',
      },
      { title: 'Veiller', text: 'Vulnérabilités, tâches et outils pour Claude.' },
      { title: 'Aller plus loin', text: 'Kotlin, Gradle et AGP.' },
    ],
    bot: [
      { title: 'Concevoir le bot', text: 'Les pièces, leurs liaisons et les outils.' },
      { title: 'Réveiller le ventre', text: 'Xiaozhi sur l’ESP32-P4.' },
      { title: 'Lui donner un esprit', text: 'Votre propre serveur, Claude et la voix de Narsil.' },
      { title: 'Faire entrer les données', text: 'Les alertes de Narsil et vos pull requests.' },
      { title: 'Dessiner le ventre', text: 'L’écran tactile avec LVGL.' },
      { title: 'Ajouter la tête', text: 'La liaison UART et le visage holographique.' },
      { title: 'Le protéger', text: 'Chaque secret, où il vit et comment le révoquer.' },
    ],
    claude: [
      { title: 'Ce que c’est', text: 'Une extension qui amène Narsil dans claude.ai sur Android.' },
      { title: 'Le bandeau', text: 'L’état de Narsil au-dessus de la zone de message.' },
      { title: 'Le menu latéral', text: 'Votre niveau Narsil, vos limites et les messages ntfy.' },
      { title: 'L’apparence', text: 'Les couleurs et l’icône de Narsil.' },
      { title: 'La publier', text: 'Une source, deux paquets Android.' },
    ],
  },
  botMap: {
    title: 'Comment le bot s’assemble',
    text: 'Le ventre détient chaque connexion et chaque secret, et la tête ne fait que dessiner. Chaque pièce renvoie aux guides qui la construisent.',
    parts: {
      head: {
        title: 'La tête',
        text: 'ESP32-S3 sous un cube prisme. Dessine le visage de Narsil.',
      },
      belly: {
        title: 'Le ventre',
        text: 'Écran tactile ESP32-P4 avec Xiaozhi. Détient le Wi-Fi et chaque secret.',
      },
      feeds: {
        title: 'ntfy et GitHub',
        text: 'Les alertes de Narsil et vos pull requests ouvertes.',
      },
      server: { title: 'Votre serveur', text: 'xiaozhi-esp32-server dans Docker sur votre PC.' },
      claude: { title: 'Claude', text: 'Écrit les réponses de Narsil.' },
    },
    links: {
      uart: 'UART, trois fils',
      lan: 'WebSocket sur votre réseau',
      https: 'HTTPS',
    },
  },
}
