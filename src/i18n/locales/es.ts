import type { TranslationShape } from '../index'

export const es: TranslationShape = {
  meta: {
    siteName: 'Narsil Workshop',
    title: 'Narsil Workshop — crea tus propios mods de Claude Code y un bot de Narsil',
    description:
      'Guías gratuitas, paso a paso, para crear un mod de mascota de estado como Narsil, un panel de revisión como Narsil Check y un bot de Narsil que habla con Claude y muestra tus pull requests de GitHub.',
  },
  common: {
    skipToContent: 'Ir al contenido',
    toggleTheme: 'Cambiar tema',
    language: 'Idioma',
    mainNavigation: 'Navegación principal',
  },
  nav: {
    mods: 'Fundamentos de mods',
    routes: 'Rutas de aprendizaje',
    tools: 'Herramientas',
    support: 'Apoya el proyecto',
  },
  footer: {
    description: 'Guías gratuitas para crear desde cero mods de Claude Code y un bot de Narsil.',
    donate: 'Invítame un café',
    trademark:
      'Claude y Claude Code son marcas de Anthropic, PBC. Este proyecto no está afiliado ni respaldado por Anthropic.',
    privacy: 'Este sitio no tiene analítica y nunca te pide tokens ni claves.',
    license:
      'Código del sitio y de los ejemplos: MIT. Texto de las guías: CC BY-SA 4.0. Código citado de Narsil y Narsil Check: GPL-3.0-or-later.',
  },
  home: {
    headline: 'Crea tus propios mods de Claude Code, paso a paso',
    subheadline:
      'Aprende cómo funcionan Narsil y Narsil Check por dentro, reconstruye cada funcionalidad desde cero y termina con un bot de Narsil que habla con Claude y muestra tus pull requests.',
    cta: 'Ver las rutas',
    fundamentalsCta: 'Empieza por los fundamentos',
    heroAlt: 'Narsil, un pequeño dragón marino, saludando',
    states: {
      title: 'Lo que Narsil te dice de un vistazo',
      subtitle:
        'Cada estado tiene su propia pose y su color, así sabes qué está haciendo Claude sin leer la terminal.',
      items: [
        { label: 'Trabajando', text: 'Claude está leyendo, editando o ejecutando comandos.' },
        { label: 'Te necesita', text: 'Claude hizo una pregunta o espera un permiso.' },
        { label: 'Terminada', text: 'El turno terminó. Es momento de revisar qué cambió.' },
        { label: 'Error', text: 'Una herramienta falló o el turno se detuvo con un error.' },
      ],
    },
    showcase: {
      title: 'Cómo se ve',
      subtitle:
        'La misma información te acompaña en todas partes: sobre el prompt, en una ventana flotante, en un panel lateral y en tu celular.',
      items: [
        {
          title: 'La ventana flotante',
          text: 'Narsil, tus límites de uso y cada conversación abierta con su contexto, tareas, caché y próximos pasos, en una ventana pequeña que queda siempre encima.',
          alt: 'La ventana flotante de Narsil: una conversación trabajando con sus tareas, las barras de uso y otras dos conversaciones abiertas',
        },
        {
          title: 'El panel de Narsil Check',
          text: 'Un panel lateral con el entorno de la sesión, los pasos del CI, las actualizaciones de librerías agrupadas por riesgo, las vulnerabilidades y las tareas pendientes.',
          alt: 'El panel de Narsil Check: entorno y CI, tres actualizaciones de librerías, una vulnerabilidad y dos tareas pendientes',
        },
        {
          title: 'Narsil en Claude, en tu celular',
          text: 'Una extensión experimental que lleva a Narsil dentro de claude.ai en Android: en el menú lateral, su nivel, tus límites de uso y los mensajes de ntfy del día; sobre la caja de texto, el estado de la conversación abierta. Su código no es público, pero las guías explican cómo se hace.',
          alt: 'El menú lateral de claude.ai en un celular Android con el bloque de Narsil: el nivel, los límites de 5 horas y de la semana, y los mensajes de ntfy del día. Los datos personales están difuminados.',
          detailAlt:
            'Una conversación de claude.ai en un celular Android: sobre la caja de texto, la franja de Narsil muestra el estado TRABAJANDO, el contexto al 80 %, la caché a 60 min y el último evento, Usando Bash. La conversación está difuminada.',
        },
      ],
      note: 'La ventana flotante usa datos de ejemplo, y la captura del celular es real, con los datos personales difuminados. El panel de Narsil Check está recreado a partir de su código, porque solo se dibuja dentro de Claude Code. El arte de Narsil viene de davshn/narsil-pet (GPL v3).',
    },
    aboutTitle: '¿Qué es Narsil?',
    about: [
      'Narsil es un mod de Claude Code: una pequeña mascota que vive encima del prompt y te dice de un vistazo si Claude está trabajando, te necesita, ha terminado o se ha atascado. Narsil Check es su hermano, un panel lateral que revisa tu rama, la CI, las dependencias y las vulnerabilidades.',
      'Aquí no solo los vas a instalar. Cada guía explica qué hooks escucha una funcionalidad, qué estado guarda y qué dibuja, y luego construye una versión mínima que funciona, con sus tests.',
    ],
    routesTitle: 'Tres rutas de aprendizaje',
    routesSubtitle:
      'Elige una ruta y sigue sus guías en orden. Si nunca hiciste un mod, empieza por los fundamentos de mods.',
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
        title: 'Un bot de Narsil',
        description:
          'Dale un cuerpo a Narsil: una pantalla táctil ESP32-P4 en la panza con tus tareas y tus pull requests, una cabeza holográfica ESP32-S3 con su cara, y voz con Xiaozhi y Claude en tu propio servidor.',
        icon: 'lucide:cpu',
      },
    ],
    coffeeTitle: 'Gratis, y seguirá siéndolo',
    coffeeText:
      'Sin anuncios, sin registro y sin precio. Si una guía te ayuda, puedes invitarme un café para escribir la siguiente.',
    coffeeCta: 'Invítame un café',
    extension: {
      badge: 'Experimental',
      title: 'Narsil en Claude, la extensión del navegador',
      text: 'Narsil también vive dentro de claude.ai en tu móvil: una extensión para Firefox y Vivaldi en Android muestra encima de la caja de texto el estado, el contexto, la caché y el último evento de la conversación abierta, y en el menú lateral el nivel de Narsil, tus límites de uso y los mensajes de ntfy.sh del día. Además viste Claude con los colores de Narsil.',
      note: 'Es experimental: está muy probada, pero se apoya en la estructura de la página de claude.ai y no en una API pública, así que una actualización de Claude puede romperla. Solo lee y nunca envía tus datos a ningún sitio. Su código no es público, pero las guías explican cómo se hace.',
    },
  },
  mods: {
    title: 'Fundamentos de mods',
    description:
      'De qué está hecho un mod de Claude Code, el objeto $, cómo instalar y probar un mod, dónde se ejecuta y qué implica para tu código la licencia GPL v3 de Narsil.',
    intro: [
      'Antes de reconstruir Narsil o Narsil Check necesitas las piezas que comparten todos los mods: tres archivos pequeños, una función que registra hooks y el objeto $, que llega a todo lo que está fuera del módulo.',
      'Lee estas guías en orden. Cada una termina con una forma de comprobar que lo que has construido funciona.',
    ],
    listTitle: 'Las guías',
    startCta: 'Empieza la primera guía',
  },
  pet: {
    title: 'Tu propia mascota de estado',
    description:
      'Crea un mod como Narsil, funcionalidad a funcionalidad: qué hace cada una, cómo funciona por dentro, cómo se le pidió a la IA y el código mínimo para hacerla tuya.',
    intro: [
      'Narsil se construyó hablando con Claude Code. Cada guía de esta ruta explica una de sus funcionalidades: qué hace por quien la usa, los hooks y el estado que hay detrás, las decisiones de diseño y la petición con la que empezó.',
      'Cuando la petición original quedó registrada, la guía la cita palabra por palabra. Cuando no, la guía lo dice y la reconstruye a partir del historial de commits.',
    ],
    listTitle: 'Las guías',
    startCta: 'Empieza la primera guía',
  },
  check: {
    title: 'Tu propio panel de revisión',
    description:
      'Crea un mod como Narsil Check, funcionalidad a funcionalidad: qué hace cada una, cómo funciona por dentro, cómo se le pidió a la IA y el código mínimo para hacerla tuya.',
    intro: [
      'Narsil Check es un panel lateral que revisa tu sesión antes de entregar: el entorno, los conectores, la CI, la rama detrás de la remota, las actualizaciones agrupadas por riesgo, las vulnerabilidades y una lista de pendientes que Claude puede usar. Cada guía explica una de sus funcionalidades, las decisiones de diseño que hay detrás y la petición con la que empezó.',
      'Cuando la petición original quedó registrada, la guía la cita palabra por palabra. Cuando no, la guía lo dice y la reconstruye a partir del historial de commits.',
    ],
    listTitle: 'Las guías',
    startCta: 'Empieza la primera guía',
  },
  bot: {
    title: 'Un bot de Narsil',
    description:
      'Dale un cuerpo a Narsil: una pantalla táctil ESP32-P4 en la panza, una cabeza holográfica ESP32-S3 y voz con Xiaozhi y Claude en tu propio servidor. Qué hace cada parte, cómo funciona y cómo se le pidió a la IA.',
    intro: [
      'El bot tiene dos placas unidas por cuatro cables. La panza, un ESP32-P4 con pantalla táctil de 4,3 pulgadas, corre Xiaozhi: escucha, habla con Claude a través de tu servidor y muestra tus tareas y tus pull requests. La cabeza, un ESP32-S3 con pantalla de 1,3 pulgadas dentro de un cubo prisma, solo dibuja la cara de Narsil, y recibe su estado de la panza por UART.',
      'Lee las guías en orden. Cada una explica qué hace la parte, cómo funciona, las decisiones que hay detrás y la conversación en la que se tomaron, y después el código.',
    ],
    listTitle: 'Las guías',
    startCta: 'Empieza la primera guía',
  },
  guide: {
    breadcrumbLabel: 'Ruta de navegación',
    stepOf: 'Guía {current} de {total}',
    updated: 'Actualizada',
    verifiedWith: 'Comprobada con Claude Code {version}',
    sourcesTitle: 'Para ir más lejos: cómo lo hace el mod real',
    sourcesIntro:
      'Estos archivos forman parte de los mods originales, publicados bajo la GPL v3. El código citado en esta página sale de ellos y conserva esa licencia.',
    pathNavLabel: 'Guías de esta ruta',
    tocTitle: 'En esta página',
    pagerLabel: 'Guía anterior y siguiente',
    previous: 'Anterior',
    next: 'Siguiente',
    backToPath: 'Todas las guías de esta ruta',
    summaryTitle: 'En esta ruta',
    guideCount: '{count} guías',
    readingMinutes: 'Unos {value} min de lectura',
    readingHours: 'Unas {value} h de lectura',
    guideMinutes: '{value} min',
    coffeeTitle: '¿Te ha servido esta guía?',
    coffeeText:
      'Todas las guías son gratuitas. Si esta te ha ahorrado tiempo, puedes invitarme un café.',
    coffeeCta: 'Invítame un café',
  },
  tools: {
    title: 'Herramientas',
    description:
      'Herramientas pequeñas que corren en tu navegador y te ayudan a entender las guías: prueba las reglas de Narsil y Narsil Check con tus propios valores.',
    intro:
      'Cada herramienta ejecuta una regla de los mods para que la pruebes con tus propios valores, junto a la guía que la explica.',
    privacy:
      'Todo corre en tu navegador. Nada de lo que escribas sale de esta página ni entra en un enlace.',
    open: 'Abrir la herramienta',
    semver: {
      title: 'Clasificador de semver',
      description:
        'Escribe una versión instalada y una más nueva para ver en qué grupo pone Narsil Check la actualización, con la regla de debajo de 1.0.0.',
      intro:
        'Narsil Check compara la versión que tienes con la última y ordena la actualización según cuánto se separan. Esta herramienta ejecuta la misma regla.',
      guideText: 'Cómo clasifica Narsil Check las actualizaciones',
      installedLabel: 'Versión instalada',
      candidateLabel: 'Versión nueva',
      resultLabel: 'Grupo',
      groups: {
        review: 'Versión mayor: revisar cambios',
        bump: 'Solo subir la versión',
      },
      bumps: {
        patch: 'parche',
        minor: 'menor',
        major: 'mayor',
      },
      summary: 'De {from} a {to}: un salto {bump}.',
      belowOne:
        'Debajo de 1.0.0 un salto menor cuenta como mayor, y debajo de 0.1.0 también un parche, como lee npm los rangos con ^.',
      current: '{to} no es más nueva que {from}, así que no hay nada que actualizar.',
      invalidInstalled: 'La versión instalada no es una versión que Narsil Check pueda leer.',
      invalidCandidate: 'La versión nueva no es una versión que Narsil Check pueda leer.',
    },
    xp: {
      title: 'Calculadora de XP',
      description:
        'Cuenta turnos terminados, pruebas que pasan y subagentes terminados para ver la XP, el nivel y la etapa de Narsil, y cuánto falta para la siguiente.',
      intro:
        'Narsil gana 10 XP por cada turno terminado, 5 por cada ejecución de pruebas que pasa y 3 por cada subagente que termina. Cada nivel pide 100 XP más que el anterior, y cinco etapas cambian su aspecto.',
      guideText: 'Cómo gana experiencia y crece Narsil',
      turnsLabel: 'Turnos terminados',
      testsLabel: 'Pruebas que pasan',
      agentsLabel: 'Subagentes terminados',
      resultLabel: 'Dónde está Narsil',
      total: '{xp} XP en total.',
      level: 'Nivel {level} · {into}/{needed} XP',
      stage: 'Etapa {stage} de {stages}.',
      nextStage:
        'La etapa {stage} empieza en el nivel {level}: faltan {xp} XP, unos {turns} turnos terminados más.',
      grown: 'Narsil ya creció del todo: la etapa 5 es la última.',
    },
    priority: {
      title: 'Simulador de prioridad',
      description:
        'Elige el estado de algunas conversaciones para ver cuál muestra Narsil y en qué orden las lista la banda, de cuatro en cuatro.',
      intro:
        'Narsil muestra la conversación más importante: primero un error, después una que te necesita, después una que trabaja y después una terminada. En un empate gana el cambio más reciente. La banda lista primero esta conversación, sea cual sea su estado.',
      guideText: 'Cómo sigue Narsil todas las conversaciones',
      statuses: {
        error: 'Error',
        waiting: 'Te necesita',
        working: 'Trabajando',
        done: 'Terminada',
        idle: 'En reposo',
      },
      own: 'Esta conversación',
      other: 'Conversación {n}',
      statusLabel: 'Estado',
      minutesLabel: 'Minutos desde su último cambio',
      add: 'Agregar una conversación',
      remove: 'Quitar {name}',
      wearsLabel: 'Narsil muestra',
      wears: '{name}: {status}',
      rowsLabel: 'Filas de la banda',
      page: 'Página {page}',
    },
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
    flow: {
      title: 'A dónde va tu café',
      steps: ['Un café', 'Tiempo para escribir y mantener guías', 'Guías gratis para todos'],
      promises: ['Sin anuncios', 'Sin registro', 'Sin analítica, nunca te pide tokens'],
    },
    about: {
      title: 'Sobre el desarrollador',
      name: 'Hernán David Figueroa',
      photoAlt: 'Foto de Hernán David Figueroa',
      bio: 'Desarrollador fullstack con más de 8 años de experiencia, especializado en fintech y pagos seguros. Trabajo en terminales POS y funciones de pago para Android e iOS en una pasarela de pagos colombiana. Creé Narsil y este taller para que cualquiera pueda entender y ampliar Claude Code. Vivo en Bogotá.',
    },
    reposTitle: 'El código fuente',
    repos: {
      pet: 'Narsil, el mod de mascota de estado',
      check: 'Narsil Check, el mod de panel de revisión',
    },
    developer: {
      text: 'Creo y mantengo Narsil y este taller por mi cuenta.',
      link: 'Ver mi perfil de desarrollador',
    },
  },
}
