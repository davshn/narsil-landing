import type { TranslationShape } from '../index'

export const pt: TranslationShape = {
  meta: {
    siteName: 'Narsil Workshop',
    title: 'Narsil Workshop — crie seus próprios mods do Claude Code e um bot ESP32-S3',
    description:
      'Guias gratuitos, passo a passo, para criar um mod de mascote de status como o Narsil, um painel de revisão como o Narsil Check e um bot ESP32-S3 que mostra seus pull requests do GitHub.',
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
    description: 'Guias gratuitos para criar do zero mods do Claude Code e um bot ESP32-S3.',
    donate: 'Me pague um café',
    trademark:
      'Claude e Claude Code são marcas da Anthropic, PBC. Este projeto não é afiliado nem endossado pela Anthropic.',
    privacy: 'Este site não tem analytics e nunca pede seus tokens ou chaves.',
  },
  home: {
    headline: 'Crie seus próprios mods do Claude Code, passo a passo',
    subheadline:
      'Aprenda como o Narsil e o Narsil Check funcionam por dentro, reconstrua cada funcionalidade do zero e termine com um bot ESP32-S3 que mostra seus pull requests.',
    cta: 'Ver as trilhas',
    fundamentalsCta: 'Comece pelos fundamentos',
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
        title: 'Um bot ESP32-S3',
        description:
          'Monte um pequeno dispositivo com tela que mostra os pull requests esperando por você no GitHub e o status do Narsil, recebido por um tópico privado do ntfy.',
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
      note: 'É experimental: foi bem testada, mas depende da estrutura da página do claude.ai e não de uma API pública, então uma atualização do Claude pode quebrá-la. Ela só lê e nunca envia seus dados para lugar nenhum.',
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
