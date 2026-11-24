import type { DiagramCopy } from '../index'

export const enDiagrams: DiagramCopy = {
  stages: {
    mods: [
      { title: 'The files', text: 'Three small files and the function that registers hooks.' },
      { title: 'The $ object', text: 'How the mod reaches the screen, storage, and the network.' },
      { title: 'Run and test', text: 'Install it, reload it, validate it, and test it.' },
      { title: 'Where it shows', text: 'The terminal, the desktop app, VS Code, and mobile.' },
      { title: 'Reuse with care', text: 'What the GPL v3 means when you copy Narsil code.' },
    ],
    pet: [
      { title: 'Give it a body', text: 'Its states and the art for each one.' },
      { title: 'Follow the work', text: 'Every conversation, task, and subagent.' },
      { title: 'Window and voice', text: 'A floating window, a voice, and alerts.' },
      { title: 'Watch the clock', text: 'Context, limits, and the prompt cache.' },
      { title: 'React to you', text: 'Commands, permissions, and tips from Haiku.' },
      { title: 'Let it grow', text: 'Next steps, experience, and quiet mode.' },
      {
        title: 'Beyond the session',
        text: 'Phone and watch alerts, a summary, and your own commands.',
      },
    ],
    check: [
      { title: 'Panel and map', text: 'The side panel and a live map of Claude’s work.' },
      { title: 'Read the session', text: 'Environment, connectors, CI, and the branch.' },
      { title: 'Find the updates', text: 'One adapter per ecosystem, sorted by risk.' },
      { title: 'Act on them', text: 'Explain a major, update the trivial ones, open the PR.' },
      { title: 'Keep watch', text: 'Vulnerabilities, to-dos, and tools for Claude.' },
      { title: 'Go further', text: 'Kotlin, Gradle, and AGP.' },
    ],
    bot: [
      { title: 'Plan the bot', text: 'The parts, how they connect, and the toolchain.' },
      { title: 'Wake the belly', text: 'Xiaozhi running on the ESP32-P4.' },
      { title: 'Give it a mind', text: 'Your own server, Claude, and Narsil’s voice.' },
      { title: 'Bring in data', text: 'Narsil’s alerts and your pull requests.' },
      { title: 'Draw the belly', text: 'The touch screen with LVGL.' },
      { title: 'Add the head', text: 'The UART link and the holographic face.' },
      { title: 'Lock it down', text: 'Every secret, where it lives, and how to revoke it.' },
    ],
    android: [
      { title: 'What it is', text: 'An app that brings claude.ai and Narsil’s alerts together.' },
      { title: 'Host Claude', text: 'A WebView, the page scripts, and where each link goes.' },
      { title: 'Inside the page', text: 'The band and the side menu with your limits.' },
      { title: 'The look', text: 'Narsil’s colors, light by day and dark by night.' },
      { title: 'Alerts', text: 'Native notifications from ntfy, sealed with your key.' },
    ],
    watch: [
      { title: 'What it is', text: 'Your limits and conversations on a Wear OS watch.' },
      { title: 'Read the state', text: 'The mod’s ntfy topic, parsed and unsealed.' },
      { title: 'On the watch face', text: 'A tile with two rings and a complication.' },
      { title: 'The app', text: 'Every conversation, the setup, and the 15-minute refresh.' },
    ],
  },
  botMap: {
    title: 'How the bot fits together',
    text: 'The belly owns every connection and every secret, and the head only draws. Each part links to the guides that build it.',
    parts: {
      head: { title: 'The head', text: 'ESP32-S3 under a prism cube. Draws Narsil’s face.' },
      belly: {
        title: 'The belly',
        text: 'ESP32-P4 touch screen running Xiaozhi. Owns the Wi-Fi and every secret.',
      },
      feeds: { title: 'ntfy and GitHub', text: 'Narsil’s alerts and your open pull requests.' },
      server: { title: 'Your server', text: 'xiaozhi-esp32-server in Docker on your PC.' },
      claude: { title: 'Claude', text: 'Writes Narsil’s answers.' },
    },
    links: {
      uart: 'UART, three wires',
      lan: 'WebSocket on your network',
      https: 'HTTPS',
    },
  },
}
