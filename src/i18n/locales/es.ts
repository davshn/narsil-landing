import { esDiagrams } from '../diagrams/es'

import type { TranslationShape } from '../index'

export const es: TranslationShape = {
  meta: {
    siteName: 'Narsil Workshop',
    title: 'Narsil Workshop — crea mods de Claude Code y un bot de Narsil con Claude',
    description:
      'Guías gratuitas, paso a paso, para crear mods de Claude Code con Claude: una mascota de estado como Narsil, un panel de revisión como Narsil Check y un bot de Narsil. Aprende qué pedir, por qué funciona y cómo comprobar el resultado.',
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
    description:
      'Guías gratuitas para crear mods de Claude Code y un bot de Narsil con Claude, y para entender lo que construiste.',
    donate: 'Invítame un café',
    support: 'Gratis, sin anuncios y sin registro.',
    trademark:
      'Claude y Claude Code son marcas de Anthropic, PBC. Este proyecto no está afiliado ni respaldado por Anthropic.',
    privacy: 'Este sitio no tiene analítica y nunca te pide tokens ni claves.',
    license:
      'Código del sitio y de los ejemplos: MIT. Texto de las guías: CC BY-SA 4.0. Código citado de Narsil y Narsil Check: GPL-3.0-or-later.',
  },
  home: {
    headline: 'Crea tus propios mods de Claude Code con Claude, paso a paso',
    subheadline:
      'Aprende cómo funcionan Narsil y Narsil Check, pídele a Claude que construya contigo cada funcionalidad y entiende cada pieza que escribe. Termina con un bot de Narsil que habla con Claude y muestra tus pull requests.',
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
          text: 'Un panel lateral con un mapa en vivo del trabajo de Claude, el entorno de la sesión, los pasos del CI, las actualizaciones de librerías agrupadas por riesgo, las vulnerabilidades y las tareas pendientes.',
          alt: 'El panel de Narsil Check: un mapa en vivo del trabajo de Claude con Narsil bebé en el centro, entorno y CI, tres actualizaciones de librerías, una vulnerabilidad y dos tareas pendientes',
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
      'Narsil es un mod de Claude Code: una pequeña mascota que vive encima del prompt y te dice de un vistazo si Claude está trabajando, te necesita, ha terminado o se ha atascado. Narsil Check es su hermano, un panel lateral que muestra en vivo el trabajo de Claude y revisa tu rama, la CI, las dependencias y las vulnerabilidades.',
      'Aquí no solo los vas a instalar: vas a construir tus propias versiones junto con Claude. Cada guía explica una funcionalidad con palabras sencillas, te da un prompt para pedírsela a Claude y te muestra cómo comprobar que lo que construyó Claude es correcto. El código está para leerlo y compararlo, no para copiarlo.',
    ],
    repoCta: 'Ver {repo} en GitHub',
    routesTitle: 'Cuatro rutas de aprendizaje',
    routes: [
      {
        title: 'Tu propia mascota de estado',
        description:
          'Crea con Claude un mod como Narsil: estados encima del prompt, animaciones, todas las conversaciones en un sitio, una ventana flotante, voz, relojes de contexto y de caché, y avisos en el móvil.',
      },
      {
        title: 'Tu propio panel de revisión',
        description:
          'Crea con Claude un mod como Narsil Check: un panel lateral con un mapa en vivo del trabajo de Claude, los pasos de la CI, la rama detrás de la remota, actualizaciones agrupadas por riesgo, vulnerabilidades de OSV.dev y herramientas para Claude.',
      },
      {
        title: 'Un bot de Narsil',
        description:
          'Dale un cuerpo a Narsil: una pantalla táctil ESP32-P4 en la panza con tus tareas y tus pull requests, una cabeza holográfica ESP32-S3 con su cara, y voz con Xiaozhi y Claude en tu propio servidor.',
      },
      {
        title: 'Narsil en Claude, en tu celular',
        description:
          'Experimental: mira cómo está hecha la extensión de navegador que lleva a Narsil a claude.ai en Android, con la franja de la conversación, el menú lateral con tus límites y los mensajes de ntfy, los colores y los paquetes para Android.',
      },
    ],
    guide: {
      hello:
        '¡Hola! Soy Narsil. Vivo encima de tu prompt y te digo qué está haciendo Claude. Hoy me construyes tú.',
      statusDetail: 'editando src/hooks.ts',
      startText:
        'Los tres archivos de un mod, sus hooks y el objeto $: la base de cada prompt que viene después.',
      routes:
        'Empieza por los fundamentos. Después elige a dónde vamos: las rutas se pueden hacer en cualquier orden.',
      showcase: 'Todo esto lo construyes tú, con Claude, una guía a la vez.',
    },
    extension: {
      badge: 'Experimental',
      title: 'Narsil en Claude, la extensión del navegador',
      text: 'Narsil también vive dentro de claude.ai en tu móvil: una extensión para Firefox y Vivaldi en Android muestra encima de la caja de texto el estado, el contexto, la caché y el último evento de la conversación abierta, y en el menú lateral el nivel de Narsil, tus límites de uso y los mensajes de ntfy.sh del día. Además viste Claude con los colores de Narsil.',
      note: 'Es experimental: está muy probada, pero se apoya en la estructura de la página de claude.ai y no en una API pública, así que una actualización de Claude puede romperla. Solo lee: nunca escribe en tu cuenta ni envía tus conversaciones a ningún sitio, aunque carga los dibujos de Narsil desde GitHub y lee su tema de estado en ntfy.sh. Su código no es público, pero las guías explican cómo se hace.',
      cta: 'Cómo está hecha',
    },
  },
  mods: {
    title: 'Fundamentos de mods',
    description:
      'Las ideas que necesitas antes de crear un mod de Claude Code con Claude: de qué está hecho un mod, el objeto $, cómo instalar y probar un mod, dónde se ejecuta y qué implica para tu código la licencia GPL v3 de Narsil.',
    intro: [
      'Antes de pedirle a Claude que construya un mod, conviene conocer las piezas que comparten todos los mods: tres archivos pequeños, una función que registra hooks (funciones que se ejecutan cuando pasa algo en Claude Code) y el objeto $, que llega a todo lo que está fuera del mod. Con estas ideas puedes escribir prompts claros y comprobar lo que te entrega Claude.',
      'Lee estas guías en orden. Cada una explica una idea, te da un prompt para probarla con Claude, recorre el código que Claude debería producir y termina con una forma de comprobar que funciona.',
    ],
    listTitle: 'Las guías',
    startCta: 'Empieza la primera guía',
    stages: esDiagrams.stages.mods,
  },
  pet: {
    title: 'Tu propia mascota de estado',
    description:
      'Crea con Claude un mod como Narsil, funcionalidad a funcionalidad: qué hace cada una, cómo funciona, el prompt para pedírsela a Claude y el código para leer y comparar con lo que escribió Claude.',
    intro: [
      'Narsil se construyó hablando con Claude Code, y tú puedes construir tu propia mascota de la misma forma. Cada guía explica una funcionalidad: qué hace por quien la usa, la idea que hay detrás y el prompt con el que Claude la construye.',
      'Cuando la petición original quedó registrada, la guía la cita palabra por palabra, para que veas cómo habló el autor con Claude. El código que sigue es una referencia: léelo para entender el resultado y para comprobar lo que Claude escribió para ti.',
    ],
    listTitle: 'Las guías',
    startCta: 'Empieza la primera guía',
    stages: esDiagrams.stages.pet,
  },
  check: {
    title: 'Tu propio panel de revisión',
    description:
      'Crea con Claude un mod como Narsil Check, funcionalidad a funcionalidad: qué hace cada una, cómo funciona, el prompt para pedírsela a Claude y el código para leer y comparar con lo que escribió Claude.',
    intro: [
      'Narsil Check es un panel lateral que revisa tu sesión antes de entregar: un mapa en vivo del trabajo de Claude, el entorno, los conectores, la CI, la rama detrás de la remota, las actualizaciones agrupadas por riesgo, las vulnerabilidades y una lista de pendientes que Claude puede usar. Cada guía explica una funcionalidad, las decisiones que hay detrás y el prompt con el que Claude la construye.',
      'Cuando la petición original quedó registrada, la guía la cita palabra por palabra, para que veas cómo habló el autor con Claude. El código que sigue es una referencia: léelo para entender el resultado y para comprobar lo que Claude escribió para ti.',
    ],
    listTitle: 'Las guías',
    startCta: 'Empieza la primera guía',
    stages: esDiagrams.stages.check,
  },
  bot: {
    title: 'Un bot de Narsil',
    description:
      'Dale un cuerpo a Narsil: una pantalla táctil ESP32-P4 en la panza, una cabeza holográfica ESP32-S3 y voz con Xiaozhi y Claude en tu propio servidor. Qué hace cada parte, cómo funciona y cómo construirla con Claude.',
    intro: [
      'El bot tiene dos placas unidas por cuatro cables. La panza, un ESP32-P4 con pantalla táctil de 4,3 pulgadas, corre Xiaozhi: escucha, habla con Claude a través de tu servidor y muestra tus tareas y tus pull requests. La cabeza, un ESP32-S3 con pantalla de 1,3 pulgadas dentro de un cubo prisma, solo dibuja la cara de Narsil, y recibe su estado de la panza por UART.',
      'Lee las guías en orden. Cada una explica qué hace la parte y cómo funciona, muestra la conversación con Claude en la que se tomaron las decisiones y después el código, para que entiendas y compruebes lo que Claude construye para ti.',
    ],
    listTitle: 'Las guías',
    startCta: 'Empieza la primera guía',
    stages: esDiagrams.stages.bot,
  },
  claude: {
    title: 'Narsil en Claude',
    description:
      'Cómo está hecha la extensión experimental que lleva a Narsil a claude.ai en Android: la franja de la conversación, el menú lateral, los colores y los paquetes para Android.',
    intro: [
      'Narsil en Claude es una extensión para Firefox y Vivaldi en Android que muestra a Narsil dentro de la app web real de claude.ai. Cada guía explica una de sus partes: qué hace, cómo funciona y cómo pedirle a Claude que la construya.',
      'Es experimental: depende de la estructura de la página de claude.ai, no de una API pública, así que una actualización de Claude puede romperla. Su código no es público, así que el código de referencia de estas guías está escrito para las guías.',
    ],
    listTitle: 'Las guías',
    startCta: 'Empezar la primera guía',
    stages: esDiagrams.stages.claude,
  },
  botMap: esDiagrams.botMap,
  guide: {
    breadcrumbLabel: 'Ruta de navegación',
    stepOf: 'Guía {current} de {total}',
    updated: 'Actualizada',
    verifiedWith: 'Comprobada con Claude Code {version}',
    sourcesTitle: 'Para ir más lejos: cómo lo hace el mod real',
    sourcesIntro:
      'Estos archivos forman parte de los mods originales, publicados bajo la GPL v3. Léelos para ver cómo resuelve el mod real el mismo problema. El código citado en esta página sale de ellos y conserva esa licencia.',
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
    stagesTitle: 'La ruta de un vistazo',
    stageGuide: 'Guía {number}: {title}',
    coffeeTitle: '¿Te ha servido esta guía?',
    coffeeText:
      'Todas las guías son gratuitas. Si esta te ha ahorrado tiempo, puedes invitarme un café.',
    coffeeCta: 'Invítame un café',
  },
  tools: {
    title: 'Herramientas',
    description:
      'Herramientas pequeñas que corren en tu navegador y te ayudan a entender las guías: prueba las reglas de Narsil y Narsil Check con tus propios valores antes de pedirle a Claude que las construya.',
    intro:
      'Cada herramienta ejecuta una regla de los mods para que la pruebes con tus propios valores. Cuando entiendas la regla, podrás describírsela con claridad a Claude y comprobar que lo que construya se comporta igual.',
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
    context: {
      title: 'Estimador de llenado de contexto',
      description:
        'Escribe dos lecturas de la barra de contexto y los minutos entre ellas para ver cuándo se llena la ventana, como lo estima Narsil.',
      intro:
        'Narsil proyecta en línea recta hasta el 100 % el ritmo de los últimos 15 minutos. Necesita al menos un minuto de lecturas, no muestra nada mientras el llenado no crece y oculta las estimaciones de más de dos horas.',
      guideText: 'Cómo muestra Narsil el contexto y los límites',
      earlierLabel: 'Llenado antes (%)',
      nowLabel: 'Llenado ahora (%)',
      minutesLabel: 'Minutos entre las lecturas',
      resultLabel: 'Estimación',
      estimate: 'Lleno en unos {minutes} min.',
      far: 'Faltan más de dos horas: Narsil no muestra una estimación tan lejana.',
      full: 'La ventana de contexto está llena.',
      old: 'Narsil solo usa lecturas de los últimos 15 minutos, así que no hay estimación.',
      short: 'Las lecturas están a menos de un minuto, así que todavía no hay estimación.',
      flat: 'El llenado no crece, así que no hay estimación.',
    },
    cache: {
      title: 'Reloj de caché',
      description:
        'Elige suscripción o clave de API y los minutos desde la última petición para ver cuánta caché de prompt queda, como la cuenta Narsil.',
      intro:
        'La caché de prompt dura 60 minutos con un plan de suscripción y 5 minutos con una clave de API, contados desde el inicio de la última petición. Cuando se enfría, el siguiente mensaje se cobra completo. También puedes fijar la duración a mano, como hace /narsil cache.',
      guideText: 'Cómo cuenta Narsil la caché de prompt',
      accountLabel: 'Cómo usas Claude Code',
      accounts: {
        plan: 'Plan de suscripción',
        api: 'Clave de API',
        custom: 'A mano',
      },
      customLabel: 'Duración de la caché (minutos)',
      elapsedLabel: 'Minutos desde el inicio de la última petición',
      resultLabel: 'Caché de prompt',
      lasts: 'La caché dura {minutes} min.',
      warm: 'Caché: quedan {left} min',
      cold: 'Caché fría: el próximo mensaje se cobra completo',
    },
    botConfig: {
      title: 'Configuración del servidor del bot',
      description:
        'Arma el data/.config.yaml del servidor del bot de escritorio de Narsil con las guías 4 a 6: dirección, zona horaria, modelo de Claude y voz, sin claves reales.',
      intro:
        'El servidor del bot en tu PC lee data/.config.yaml. Esta herramienta escribe el archivo que arman las guías 4, 5 y 6: la dirección del servidor en tu red, el reconocimiento de voz, Claude como cerebro y la personalidad y la voz de Narsil.',
      guideText: 'Claude como cerebro del bot',
      hostLabel: 'Dirección de tu PC en la red local',
      timezoneLabel: 'Diferencia horaria (horas)',
      modelLabel: 'Modelo',
      models: {
        'claude-opus-5-5': 'Claude Opus 5.5',
        'claude-haiku-5-5': 'Claude Haiku 5.5',
      },
      effortLabel: 'Esfuerzo',
      efforts: {
        low: 'Bajo',
        medium: 'Medio',
        high: 'Alto',
      },
      maxTokensLabel: 'Máximo de tokens por respuesta',
      voiceLabel: 'Voz de Edge',
      resultLabel: 'data/.config.yaml',
      invalid: {
        host: 'Usa una dirección IPv4 privada de tu red, como 192.168.1.50: el servidor solo escucha en tu red.',
        timezone: 'Usa un número entero de horas entre -12 y 14.',
        model: 'Elige uno de los modelos.',
        effort: 'Elige uno de los niveles de esfuerzo.',
        maxTokens: 'Usa un número entero de 1 a 128000.',
        voice: 'Usa un nombre de voz de Edge, como es-MX-DaliaNeural.',
      },
      copy: 'Copiar el archivo',
      copied: 'Copiado',
      keyNote:
        'La única clave del archivo es un marcador para el reconocimiento de voz: cámbiala en tu propia copia en tu PC. La clave de Anthropic nunca va en este archivo; el servidor la lee de ANTHROPIC_API_KEY.',
    },
  },
  support: {
    title: 'Apoya Narsil Workshop',
    description:
      'Narsil Workshop es gratuito y nunca tendrá anuncios ni precio. Si te ayuda, puedes invitarme un café para escribir más guías.',
    lines: [
      'Gracias por leer Narsil Workshop. Todas las guías son gratuitas y lo seguirán siendo: sin anuncios, sin registro y sin coste, nunca.',
      'Si una guía te ayudó a crear tu propio mod o tu bot con Claude, puedes invitarme un café. Es un pago único de la cantidad que quieras, y es totalmente opcional.',
      'Cada café se convierte en más guías, prompts y herramientas para quienes quieren construir con Claude Code y entender lo que construyen.',
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
      bio: 'Desarrollador fullstack con más de 8 años de experiencia, especializado en pagos seguros. Trabajo en terminales POS y funciones de pago para Android e iOS en el sector fintech. Creé Narsil y este taller para que cualquiera pueda entender y ampliar Claude Code. Vivo en Bogotá.',
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
