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
    routesSubtitle: 'Os guias estão a caminho. Cada trilha começa pelos fundamentos de um mod.',
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
  guide: {
    breadcrumbLabel: 'Trilha de navegação',
    stepOf: 'Guia {current} de {total}',
    updated: 'Atualizado',
    verifiedWith: 'Conferido com o Claude Code {version}',
    sourcesTitle: 'Para ir além: como o mod real faz',
    sourcesIntro:
      'Estes arquivos fazem parte dos mods originais, publicados sob a GPL v3. O código citado nesta página vem deles e mantém essa licença.',
    pathNavLabel: 'Guias desta trilha',
    previous: 'Anterior',
    next: 'Próximo',
    backToPath: 'Todos os guias desta trilha',
    coffeeTitle: 'Este guia ajudou?',
    coffeeText:
      'Todos os guias são gratuitos. Se este poupou seu tempo, você pode me pagar um café.',
    coffeeCta: 'Me pague um café',
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
