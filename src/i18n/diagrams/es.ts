import type { DiagramCopy } from '../index'

export const esDiagrams: DiagramCopy = {
  stages: {
    mods: [
      {
        title: 'Los archivos',
        text: 'Tres archivos pequeños y la función que registra los hooks.',
      },
      {
        title: 'El objeto $',
        text: 'Cómo el mod llega a la pantalla, al almacenamiento y a la red.',
      },
      { title: 'Ejecutar y probar', text: 'Instalarlo, recargarlo, validarlo y probarlo.' },
      { title: 'Dónde se ve', text: 'La terminal, la app de escritorio, VS Code y el móvil.' },
      {
        title: 'Reutilizar con cuidado',
        text: 'Qué implica la GPL v3 cuando copias código de Narsil.',
      },
    ],
    pet: [
      { title: 'Darle cuerpo', text: 'Sus estados y el dibujo de cada uno.' },
      { title: 'Seguir el trabajo', text: 'Cada conversación, tarea y subagente.' },
      { title: 'Ventana y voz', text: 'Una ventana flotante, una voz y alertas.' },
      { title: 'Mirar el reloj', text: 'El contexto, los límites y la caché del prompt.' },
      { title: 'Reaccionar a ti', text: 'Comandos, permisos y consejos de Haiku.' },
      { title: 'Dejarlo crecer', text: 'Próximos pasos, experiencia y modo silencioso.' },
      {
        title: 'Más allá de la sesión',
        text: 'Alertas en el teléfono y el reloj, un resumen y tus propios comandos.',
      },
    ],
    check: [
      { title: 'Panel y mapa', text: 'El panel lateral y un mapa en vivo del trabajo de Claude.' },
      { title: 'Leer la sesión', text: 'El entorno, los conectores, el CI y la rama.' },
      {
        title: 'Encontrar actualizaciones',
        text: 'Un adaptador por ecosistema, ordenado por riesgo.',
      },
      { title: 'Actuar', text: 'Explicar una major, actualizar las triviales y abrir el PR.' },
      { title: 'Vigilar', text: 'Vulnerabilidades, tareas pendientes y herramientas para Claude.' },
      { title: 'Ir más lejos', text: 'Kotlin, Gradle y AGP.' },
    ],
    bot: [
      { title: 'Planear el bot', text: 'Las piezas, cómo se conectan y las herramientas.' },
      { title: 'Despertar la barriga', text: 'Xiaozhi funcionando en el ESP32-P4.' },
      { title: 'Darle una mente', text: 'Tu propio servidor, Claude y la voz de Narsil.' },
      { title: 'Traer datos', text: 'Las alertas de Narsil y tus pull requests.' },
      { title: 'Dibujar la barriga', text: 'La pantalla táctil con LVGL.' },
      { title: 'Sumar la cabeza', text: 'El enlace UART y la cara holográfica.' },
      { title: 'Protegerlo', text: 'Cada secreto, dónde vive y cómo revocarlo.' },
    ],
    claude: [
      { title: 'Qué es', text: 'Una extensión que lleva a Narsil a claude.ai en Android.' },
      { title: 'La banda', text: 'El estado de Narsil sobre la caja de mensajes.' },
      { title: 'El menú lateral', text: 'Tu nivel de Narsil, tus límites y los mensajes de ntfy.' },
      { title: 'El aspecto', text: 'Los colores y el icono de Narsil.' },
      { title: 'Publicarla', text: 'Una fuente, dos paquetes de Android.' },
    ],
  },
  botMap: {
    title: 'Cómo encaja el bot',
    text: 'La barriga tiene todas las conexiones y todos los secretos, y la cabeza solo dibuja. Cada pieza enlaza a las guías que la construyen.',
    parts: {
      head: { title: 'La cabeza', text: 'ESP32-S3 bajo un cubo prisma. Dibuja la cara de Narsil.' },
      belly: {
        title: 'La barriga',
        text: 'Pantalla táctil ESP32-P4 con Xiaozhi. Tiene el Wi-Fi y todos los secretos.',
      },
      feeds: {
        title: 'ntfy y GitHub',
        text: 'Las alertas de Narsil y tus pull requests abiertos.',
      },
      server: { title: 'Tu servidor', text: 'xiaozhi-esp32-server en Docker en tu PC.' },
      claude: { title: 'Claude', text: 'Escribe las respuestas de Narsil.' },
    },
    links: {
      uart: 'UART, tres cables',
      lan: 'WebSocket en tu red',
      https: 'HTTPS',
    },
  },
}
