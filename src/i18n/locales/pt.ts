import type { TranslationShape } from '../index'

export const pt: TranslationShape = {
  meta: {
    siteName: 'Narsil Workshop',
    title: 'Narsil Workshop — crie seus próprios mods do Claude Code e um bot do Narsil',
    description:
      'Guias gratuitos, passo a passo, para criar um mod de mascote de status como o Narsil, um painel de revisão como o Narsil Check e um bot do Narsil que conversa com o Claude e mostra seus pull requests do GitHub.',
  },
  common: {
    skipToContent: 'Pular para o conteúdo',
    toggleTheme: 'Alternar tema',
    language: 'Idioma',
    mainNavigation: 'Navegação principal',
  },
  nav: {
    mods: 'Fundamentos de mods',
    routes: 'Trilhas de aprendizado',
    tools: 'Ferramentas',
    support: 'Apoie o projeto',
  },
  footer: {
    description: 'Guias gratuitos para criar do zero mods do Claude Code e um bot do Narsil.',
    donate: 'Me pague um café',
    trademark:
      'Claude e Claude Code são marcas da Anthropic, PBC. Este projeto não é afiliado nem endossado pela Anthropic.',
    privacy: 'Este site não tem analytics e nunca pede seus tokens ou chaves.',
    license:
      'Código do site e dos exemplos: MIT. Texto dos guias: CC BY-SA 4.0. Código citado do Narsil e do Narsil Check: GPL-3.0-or-later.',
  },
  home: {
    headline: 'Crie seus próprios mods do Claude Code, passo a passo',
    subheadline:
      'Aprenda como o Narsil e o Narsil Check funcionam por dentro, reconstrua cada funcionalidade do zero e termine com um bot do Narsil que conversa com o Claude e mostra seus pull requests.',
    cta: 'Ver as trilhas',
    fundamentalsCta: 'Comece pelos fundamentos',
    heroAlt: 'Narsil, um pequeno dragão marinho, acenando',
    states: {
      title: 'O que o Narsil mostra num relance',
      subtitle:
        'Cada estado tem sua própria pose e cor, então você sabe o que o Claude está fazendo sem ler o terminal.',
      items: [
        { label: 'Trabalhando', text: 'O Claude está lendo, editando ou executando comandos.' },
        {
          label: 'Precisa de você',
          text: 'O Claude fez uma pergunta ou está esperando uma permissão.',
        },
        { label: 'Concluído', text: 'O turno terminou. Hora de revisar o que mudou.' },
        { label: 'Erro', text: 'Uma ferramenta falhou ou o turno parou com um erro.' },
      ],
    },
    showcase: {
      title: 'Como fica',
      subtitle:
        'A mesma informação acompanha você em todo lugar: acima do prompt, numa janela flutuante, num painel lateral e no celular.',
      items: [
        {
          title: 'A janela flutuante',
          text: 'O Narsil, seus limites de uso e cada conversa aberta com contexto, tarefas, cache e próximos passos, numa janela pequena que fica sempre por cima.',
          alt: 'A janela flutuante do Narsil: uma conversa trabalhando com suas tarefas, as barras de uso e outras duas conversas abertas',
        },
        {
          title: 'O painel do Narsil Check',
          text: 'Um painel lateral com o ambiente da sessão, os passos do CI, as atualizações de bibliotecas agrupadas por risco, as vulnerabilidades e as tarefas pendentes.',
          alt: 'O painel do Narsil Check: ambiente e CI, três atualizações de bibliotecas, uma vulnerabilidade e duas tarefas pendentes',
        },
        {
          title: 'Narsil no Claude, no celular',
          text: 'Uma extensão experimental que leva o Narsil para dentro do claude.ai no Android: no menu lateral, o nível dele, seus limites de uso e as mensagens do ntfy do dia; acima da caixa de texto, o estado da conversa aberta. O código dela não é público, mas os guias explicam como ela é feita.',
          alt: 'O menu lateral do claude.ai num celular Android com o bloco do Narsil: o nível, os limites de 5 horas e da semana, e as mensagens do ntfy do dia. Os dados pessoais estão desfocados.',
          detailAlt:
            'Uma conversa do claude.ai num celular Android: acima da caixa de texto, a faixa do Narsil mostra o estado TRABAJANDO (trabalhando), o contexto em 80 %, o cache em 60 min e o último evento, Usando Bash (usando o Bash). A conversa está desfocada.',
        },
      ],
      note: 'A janela flutuante usa dados de exemplo, e a captura do celular é real, com os dados pessoais desfocados. O painel do Narsil Check foi recriado a partir do código-fonte, porque ele só é desenhado dentro do Claude Code. As ilustrações do Narsil vêm de davshn/narsil-pet (GPL v3).',
    },
    aboutTitle: 'O que é o Narsil?',
    about: [
      'O Narsil é um mod do Claude Code: um pequeno mascote que fica acima do prompt e mostra num relance se o Claude está trabalhando, precisa de você, terminou ou travou. O Narsil Check é o irmão dele, um painel lateral que revisa sua branch, a CI, as dependências e as vulnerabilidades.',
      'Aqui você não vai só instalá-los. Cada guia explica quais hooks uma funcionalidade escuta, que estado ela guarda e o que desenha, e depois constrói uma versão mínima que funciona, com seus testes.',
    ],
    routesTitle: 'Três trilhas de aprendizado',
    routesSubtitle:
      'Escolha uma trilha e siga os guias em ordem. Se você nunca fez um mod, comece pelos fundamentos de mods.',
    routes: [
      {
        title: 'Seu próprio mascote de status',
        description:
          'Crie um mod como o Narsil: estados acima do prompt, animações, todas as conversas em um só lugar, uma janela flutuante, voz, relógios de contexto e de cache, e avisos no celular.',
        icon: 'lucide:sparkles',
      },
      {
        title: 'Seu próprio painel de revisão',
        description:
          'Crie um mod como o Narsil Check: um painel lateral com as etapas da CI, a branch atrás da remota, atualizações agrupadas por risco, vulnerabilidades do OSV.dev e ferramentas para o Claude.',
        icon: 'lucide:list-checks',
      },
      {
        title: 'Um bot do Narsil',
        description:
          'Dê um corpo ao Narsil: uma tela touch ESP32-P4 na barriga com suas tarefas e seus pull requests, uma cabeça holográfica ESP32-S3 com o rosto do Narsil, e voz com o Xiaozhi e o Claude no seu próprio servidor.',
        icon: 'lucide:cpu',
      },
    ],
    coffeeTitle: 'Grátis, e vai continuar assim',
    coffeeText:
      'Sem anúncios, sem cadastro e sem preço. Se um guia ajudar você, pode me pagar um café para escrever o próximo.',
    coffeeCta: 'Me pague um café',
    extension: {
      badge: 'Experimental',
      title: 'Narsil no Claude, a extensão do navegador',
      text: 'O Narsil também vive dentro do claude.ai no seu celular: uma extensão para Firefox e Vivaldi no Android mostra acima da caixa de texto o status, o contexto, o cache e o último evento da conversa aberta, e no menu lateral o nível do Narsil, seus limites de uso e as mensagens do ntfy.sh do dia. Ela também veste o Claude com as cores do Narsil.',
      note: 'É experimental: foi bem testada, mas depende da estrutura da página do claude.ai e não de uma API pública, então uma atualização do Claude pode quebrá-la. Ela só lê e nunca envia seus dados para lugar nenhum. O código dela não é público, mas os guias explicam como ela é feita.',
    },
  },
  mods: {
    title: 'Fundamentos de mods',
    description:
      'Do que é feito um mod do Claude Code, o objeto $, como instalar e testar um mod, onde ele roda e o que a licença GPL v3 do Narsil significa para o seu código.',
    intro: [
      'Antes de reconstruir o Narsil ou o Narsil Check, você precisa das peças que todo mod compartilha: três arquivos pequenos, uma função que registra hooks e o objeto $, que alcança tudo o que está fora do módulo.',
      'Leia estes guias em ordem. Cada um termina com uma forma de conferir que o que você construiu funciona.',
    ],
    listTitle: 'Os guias',
    startCta: 'Comece o primeiro guia',
  },
  pet: {
    title: 'Seu próprio mascote de status',
    description:
      'Crie um mod como o Narsil, funcionalidade por funcionalidade: o que cada uma faz, como funciona por dentro, como foi pedida à IA e o código mínimo para torná-la sua.',
    intro: [
      'O Narsil foi construído conversando com o Claude Code. Cada guia desta trilha explica uma de suas funcionalidades: o que ela faz por quem a usa, os hooks e o estado por trás dela, as decisões de design e o pedido que deu início a ela.',
      'Quando o pedido original ficou registrado, o guia o cita palavra por palavra. Quando não, o guia avisa e o reconstrói a partir do histórico de commits.',
    ],
    listTitle: 'Os guias',
    startCta: 'Comece o primeiro guia',
  },
  check: {
    title: 'Seu próprio painel de revisão',
    description:
      'Crie um mod como o Narsil Check, funcionalidade por funcionalidade: o que cada uma faz, como funciona por dentro, como foi pedida à IA e o código mínimo para torná-la sua.',
    intro: [
      'O Narsil Check é um painel lateral que revisa sua sessão antes de entregar: ambiente, conectores, CI, branch atrás da remota, atualizações agrupadas por risco, vulnerabilidades e uma lista de pendências que o Claude pode usar. Cada guia explica uma de suas funcionalidades, as decisões de design por trás dela e o pedido que deu início a ela.',
      'Quando o pedido original ficou registrado, o guia o cita palavra por palavra. Quando não, o guia avisa e o reconstrói a partir do histórico de commits.',
    ],
    listTitle: 'Os guias',
    startCta: 'Comece o primeiro guia',
  },
  bot: {
    title: 'Um bot do Narsil',
    description:
      'Dê um corpo ao Narsil: uma tela touch ESP32-P4 na barriga, uma cabeça holográfica ESP32-S3 e voz com o Xiaozhi e o Claude no seu servidor. O que cada parte faz, como funciona e como foi pedida à IA.',
    intro: [
      'O bot tem duas placas ligadas por quatro fios. A barriga, um ESP32-P4 com tela touch de 4,3 polegadas, roda o Xiaozhi: escuta, conversa com o Claude pelo seu servidor e mostra suas tarefas e seus pull requests. A cabeça, um ESP32-S3 com tela de 1,3 polegada dentro de um cubo prisma, só desenha o rosto do Narsil e recebe o estado da barriga por UART.',
      'Leia os guias em ordem. Cada um explica o que a parte faz, como funciona, as decisões por trás e a conversa em que foram tomadas, e depois o código.',
    ],
    listTitle: 'Os guias',
    startCta: 'Comece o primeiro guia',
  },
  guide: {
    breadcrumbLabel: 'Trilha de navegação',
    stepOf: 'Guia {current} de {total}',
    updated: 'Atualizado',
    verifiedWith: 'Conferido com o Claude Code {version}',
    sourcesTitle: 'Para ir além: como o mod real faz',
    sourcesIntro:
      'Estes arquivos fazem parte dos mods originais, publicados sob a GPL v3. O código citado nesta página vem deles e mantém essa licença.',
    pathNavLabel: 'Guias desta trilha',
    tocTitle: 'Nesta página',
    pagerLabel: 'Guia anterior e próximo',
    previous: 'Anterior',
    next: 'Próximo',
    backToPath: 'Todos os guias desta trilha',
    summaryTitle: 'Nesta trilha',
    guideCount: '{count} guias',
    readingMinutes: 'Cerca de {value} min de leitura',
    readingHours: 'Cerca de {value} h de leitura',
    guideMinutes: '{value} min',
    coffeeTitle: 'Este guia ajudou?',
    coffeeText:
      'Todos os guias são gratuitos. Se este poupou seu tempo, você pode me pagar um café.',
    coffeeCta: 'Me pague um café',
  },
  tools: {
    title: 'Ferramentas',
    description:
      'Pequenas ferramentas que rodam no navegador e ajudam a entender os guias: teste as regras do Narsil e do Narsil Check com os seus próprios valores.',
    intro:
      'Cada ferramenta executa uma regra dos mods para você testar com os seus próprios valores, ao lado do guia que a explica.',
    privacy:
      'Tudo roda no seu navegador. Nada do que você digita sai desta página nem entra em um link.',
    open: 'Abrir a ferramenta',
    semver: {
      title: 'Classificador de semver',
      description:
        'Digite uma versão instalada e uma mais nova para ver em qual grupo o Narsil Check coloca a atualização, com a regra abaixo de 1.0.0.',
      intro:
        'O Narsil Check compara a versão que você tem com a mais recente e ordena a atualização pela distância entre elas. Esta ferramenta executa a mesma regra.',
      guideText: 'Como o Narsil Check classifica as atualizações',
      installedLabel: 'Versão instalada',
      candidateLabel: 'Versão nova',
      resultLabel: 'Grupo',
      groups: {
        review: 'Versão major: revisar as mudanças',
        bump: 'Só subir a versão',
      },
      bumps: {
        patch: 'patch',
        minor: 'minor',
        major: 'major',
      },
      summary: 'De {from} para {to}: um salto {bump}.',
      belowOne:
        'Abaixo de 1.0.0 uma minor conta como major, e abaixo de 0.1.0 um patch também, como o npm lê os intervalos com ^.',
      current: '{to} não é mais nova que {from}, então não há nada para atualizar.',
      invalidInstalled: 'A versão instalada não é uma versão que o Narsil Check consegue ler.',
      invalidCandidate: 'A versão nova não é uma versão que o Narsil Check consegue ler.',
    },
    xp: {
      title: 'Calculadora de XP',
      description:
        'Conte turnos terminados, testes que passam e subagentes terminados para ver o XP, o nível e o estágio da Narsil, e quanto falta para o próximo.',
      intro:
        'A Narsil ganha 10 XP por turno terminado, 5 por execução de testes que passa e 3 por subagente que termina. Cada nível pede 100 XP a mais que o anterior, e cinco estágios mudam a aparência dela.',
      guideText: 'Como a Narsil ganha experiência e cresce',
      turnsLabel: 'Turnos terminados',
      testsLabel: 'Testes que passam',
      agentsLabel: 'Subagentes terminados',
      resultLabel: 'Onde a Narsil está',
      total: '{xp} XP no total.',
      level: 'Nível {level} · {into}/{needed} XP',
      stage: 'Estágio {stage} de {stages}.',
      nextStage:
        'O estágio {stage} começa no nível {level}: faltam {xp} XP, cerca de {turns} turnos terminados a mais.',
      grown: 'A Narsil já cresceu por completo: o estágio 5 é o último.',
    },
    priority: {
      title: 'Simulador de prioridade',
      description:
        'Escolha o estado de algumas conversas para ver qual a Narsil mostra e em que ordem a faixa as lista, quatro por página.',
      intro:
        'A Narsil mostra a conversa mais importante: primeiro um erro, depois uma que precisa de você, depois uma trabalhando, depois uma terminada. Em um empate vence a mudança mais recente. A faixa lista primeiro esta conversa, seja qual for o estado.',
      guideText: 'Como a Narsil acompanha todas as conversas',
      statuses: {
        error: 'Erro',
        waiting: 'Precisa de você',
        working: 'Trabalhando',
        done: 'Terminada',
        idle: 'Parada',
      },
      own: 'Esta conversa',
      other: 'Conversa {n}',
      statusLabel: 'Estado',
      minutesLabel: 'Minutos desde a última mudança',
      add: 'Adicionar uma conversa',
      remove: 'Remover {name}',
      wearsLabel: 'A Narsil mostra',
      wears: '{name}: {status}',
      rowsLabel: 'Linhas da faixa',
      page: 'Página {page}',
    },
    context: {
      title: 'Estimador de preenchimento do contexto',
      description:
        'Informe duas leituras da barra de contexto e os minutos entre elas para ver quando a janela enche, do jeito que a Narsil estima.',
      intro:
        'A Narsil projeta em linha reta até 100 % o ritmo dos últimos 15 minutos. Ela precisa de pelo menos um minuto de leituras, não mostra nada enquanto o preenchimento não cresce e esconde estimativas acima de duas horas.',
      guideText: 'Como a Narsil mostra o contexto e os limites',
      earlierLabel: 'Preenchimento antes (%)',
      nowLabel: 'Preenchimento agora (%)',
      minutesLabel: 'Minutos entre as leituras',
      resultLabel: 'Estimativa',
      estimate: 'Cheio em cerca de {minutes} min.',
      far: 'Faltam mais de duas horas: a Narsil não mostra uma estimativa tão distante.',
      full: 'A janela de contexto está cheia.',
      old: 'A Narsil só usa leituras dos últimos 15 minutos, então não há estimativa.',
      short: 'As leituras têm menos de um minuto de distância, então ainda não há estimativa.',
      flat: 'O preenchimento não cresce, então não há estimativa.',
    },
    cache: {
      title: 'Relógio do cache',
      description:
        'Escolha assinatura ou chave de API e os minutos desde a última requisição para ver quanto cache de prompt resta, como a Narsil conta.',
      intro:
        'O cache de prompt dura 60 minutos em um plano de assinatura e 5 minutos com uma chave de API, contados a partir do início da última requisição. Quando esfria, a próxima mensagem é cobrada por inteiro. Você também pode definir a duração à mão, como faz o /narsil cache.',
      guideText: 'Como a Narsil faz a contagem do cache de prompt',
      accountLabel: 'Como você usa o Claude Code',
      accounts: {
        plan: 'Plano de assinatura',
        api: 'Chave de API',
        custom: 'À mão',
      },
      customLabel: 'Duração do cache (minutos)',
      elapsedLabel: 'Minutos desde o início da última requisição',
      resultLabel: 'Cache de prompt',
      lasts: 'O cache dura {minutes} min.',
      warm: 'Cache: restam {left} min',
      cold: 'Cache frio: a próxima mensagem é cobrada por inteiro',
    },
  },
  support: {
    title: 'Apoie o Narsil Workshop',
    description:
      'O Narsil Workshop é gratuito e nunca terá anúncios nem preço. Se ele ajudar você, pode me pagar um café para escrever mais guias.',
    lines: [
      'Obrigado por ler o Narsil Workshop. Todos os guias são gratuitos e vão continuar assim: sem anúncios, sem cadastro e sem custo, nunca.',
      'Se um guia ajudou você a criar seu próprio mod ou seu bot, pode me pagar um café. É um pagamento único do valor que você quiser, e é totalmente opcional.',
      'Cada café vira mais guias, exemplos e ferramentas para quem quer entender e estender o Claude Code.',
    ],
    donate: 'Me pague um café',
    unavailable: 'As doações ainda não estão abertas.',
    flow: {
      title: 'Para onde vai o seu café',
      steps: ['Um café', 'Tempo para escrever e manter guias', 'Guias grátis para todos'],
      promises: ['Sem anúncios', 'Sem cadastro', 'Sem analytics, nunca pede seus tokens'],
    },
    about: {
      title: 'Sobre o desenvolvedor',
      name: 'Hernán David Figueroa',
      photoAlt: 'Foto de Hernán David Figueroa',
      bio: 'Desenvolvedor full-stack com mais de 8 anos de experiência, especializado em fintech e pagamentos seguros. Trabalho com terminais POS e recursos de pagamento para Android e iOS em um gateway de pagamentos colombiano. Criei o Narsil e este workshop para que qualquer pessoa possa entender e ampliar o Claude Code. Moro em Bogotá.',
    },
    reposTitle: 'O código-fonte',
    repos: {
      pet: 'Narsil, o mod de mascote de status',
      check: 'Narsil Check, o mod de painel de revisão',
    },
    developer: {
      text: 'Eu crio e mantenho o Narsil e este workshop por conta própria.',
      link: 'Ver meu perfil de desenvolvedor',
    },
  },
}
