import type { TranslationShape } from '../index'

export const es: TranslationShape = {
  meta: {
    siteName: 'Narsil Workshop',
    title: 'Narsil Workshop — crea tus propios mods de Claude Code y un bot ESP32-S3',
    description:
      'Guías gratuitas, paso a paso, para crear un mod de mascota de estado como Narsil, un panel de revisión como Narsil Check y un bot ESP32-S3 que muestra tus pull requests de GitHub.',
  },
  common: {
    skipToContent: 'Ir al contenido',
    toggleTheme: 'Cambiar tema',
    language: 'Idioma',
    mainNavigation: 'Navegación principal',
  },
  nav: {
    routes: 'Rutas de aprendizaje',
    support: 'Apoya el proyecto',
  },
  footer: {
    description: 'Guías gratuitas para crear desde cero mods de Claude Code y un bot ESP32-S3.',
    donate: 'Invítame un café',
    trademark:
      'Claude y Claude Code son marcas de Anthropic, PBC. Este proyecto no está afiliado ni respaldado por Anthropic.',
    privacy: 'Este sitio no tiene analítica y nunca te pide tokens ni claves.',
  },
  home: {
    headline: 'Crea tus propios mods de Claude Code, paso a paso',
    subheadline:
      'Aprende cómo funcionan Narsil y Narsil Check por dentro, reconstruye cada funcionalidad desde cero y termina con un bot ESP32-S3 que muestra tus pull requests.',
    cta: 'Ver las rutas',
    secondaryCta: 'Invítame un café',
    aboutTitle: '¿Qué es Narsil?',
    about: [
      'Narsil es un mod de Claude Code: una pequeña mascota que vive encima del prompt y te dice de un vistazo si Claude está trabajando, te necesita, ha terminado o se ha atascado. Narsil Check es su hermano, un panel lateral que revisa tu rama, la CI, las dependencias y las vulnerabilidades.',
      'Aquí no solo los vas a instalar. Cada guía explica qué hooks escucha una funcionalidad, qué estado guarda y qué dibuja, y luego construye una versión mínima que funciona, con sus tests.',
    ],
    routesTitle: 'Tres rutas de aprendizaje',
    routesSubtitle: 'Las guías están en camino. Cada ruta empieza por los fundamentos de un mod.',
    routes: [
      {
        title: 'Tu propia mascota de estado',
        description:
          'Crea un mod como Narsil: estados encima del prompt, animaciones, todas las conversaciones en un sitio, una ventana flotante, voz, relojes de contexto y de caché, y avisos en el móvil.',
        icon: 'lucide:sparkles',
      },
      {
        title: 'Tu propio panel de revisión',
        description:
          'Crea un mod como Narsil Check: un panel lateral con los pasos de la CI, la rama detrás de la remota, actualizaciones agrupadas por riesgo, vulnerabilidades de OSV.dev y herramientas para Claude.',
        icon: 'lucide:list-checks',
      },
      {
        title: 'Un bot ESP32-S3',
        description:
          'Construye un pequeño dispositivo con pantalla que muestra los pull requests que te esperan en GitHub y el estado de Narsil, recibido por un tema privado de ntfy.',
        icon: 'lucide:cpu',
      },
    ],
    coffeeTitle: 'Gratis, y seguirá siéndolo',
    coffeeText:
      'Sin anuncios, sin registro y sin precio. Si una guía te ayuda, puedes invitarme un café para escribir la siguiente.',
    coffeeCta: 'Invítame un café',
  },
  support: {
    title: 'Apoya Narsil Workshop',
    description:
      'Narsil Workshop es gratuito y nunca tendrá anuncios ni precio. Si te ayuda, puedes invitarme un café para escribir más guías.',
    lines: [
      'Gracias por leer Narsil Workshop. Todas las guías son gratuitas y lo seguirán siendo: sin anuncios, sin registro y sin coste, nunca.',
      'Si una guía te ayudó a crear tu propio mod o tu bot, puedes invitarme un café. Es un pago único de la cantidad que quieras, y es totalmente opcional.',
      'Cada café se convierte en más guías, ejemplos y herramientas para quienes quieren entender y ampliar Claude Code.',
    ],
    donate: 'Invítame un café',
    unavailable: 'Las donaciones aún no están abiertas.',
    reposTitle: 'El código fuente',
    repos: {
      pet: 'Narsil, el mod de mascota de estado',
      check: 'Narsil Check, el mod de panel de revisión',
      site: 'Narsil Workshop, este sitio',
    },
    developer: {
      text: 'Creo y mantengo Narsil y este taller por mi cuenta.',
      link: 'Ver mi perfil de desarrollador',
    },
  },
}
