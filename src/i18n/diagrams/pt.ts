import type { DiagramCopy } from '../index'

export const ptDiagrams: DiagramCopy = {
  stages: {
    mods: [
      { title: 'Os arquivos', text: 'Três arquivos pequenos e a função que registra os hooks.' },
      { title: 'O objeto $', text: 'Como o mod chega à tela, ao armazenamento e à rede.' },
      { title: 'Rodar e testar', text: 'Instalar, recarregar, validar e testar.' },
      { title: 'Onde aparece', text: 'O terminal, o app desktop, o VS Code e o celular.' },
      {
        title: 'Reutilizar com cuidado',
        text: 'O que a GPL v3 significa quando você copia código do Narsil.',
      },
    ],
    pet: [
      { title: 'Dar um corpo', text: 'Seus estados e o desenho de cada um.' },
      { title: 'Acompanhar o trabalho', text: 'Cada conversa, tarefa e subagente.' },
      { title: 'Janela e voz', text: 'Uma janela flutuante, uma voz e alertas.' },
      { title: 'Olhar o relógio', text: 'O contexto, os limites e o cache do prompt.' },
      { title: 'Reagir a você', text: 'Comandos, permissões e dicas do Haiku.' },
      { title: 'Deixar crescer', text: 'Próximos passos, experiência e modo silencioso.' },
      {
        title: 'Além da sessão',
        text: 'Alertas no celular e no relógio, um resumo e seus próprios comandos.',
      },
    ],
    check: [
      { title: 'Painel e mapa', text: 'O painel lateral e um mapa ao vivo do trabalho do Claude.' },
      { title: 'Ler a sessão', text: 'O ambiente, os conectores, o CI e a branch.' },
      { title: 'Achar as atualizações', text: 'Um adaptador por ecossistema, ordenado por risco.' },
      { title: 'Agir', text: 'Explicar uma major, atualizar as triviais e abrir o PR.' },
      { title: 'Vigiar', text: 'Vulnerabilidades, tarefas e ferramentas para o Claude.' },
      { title: 'Ir além', text: 'Kotlin, Gradle e AGP.' },
    ],
    bot: [
      { title: 'Planejar o bot', text: 'As peças, como se conectam e as ferramentas.' },
      { title: 'Acordar a barriga', text: 'O Xiaozhi rodando no ESP32-P4.' },
      { title: 'Dar uma mente', text: 'Seu próprio servidor, o Claude e a voz do Narsil.' },
      { title: 'Trazer dados', text: 'Os alertas do Narsil e seus pull requests.' },
      { title: 'Desenhar a barriga', text: 'A tela touch com LVGL.' },
      { title: 'Somar a cabeça', text: 'O link UART e o rosto holográfico.' },
      { title: 'Proteger', text: 'Cada segredo, onde ele fica e como revogá-lo.' },
    ],
    android: [
      { title: 'O que é', text: 'Um app que junta o claude.ai e os avisos da Narsil.' },
      {
        title: 'Hospedar o Claude',
        text: 'Uma WebView, os scripts da página e para onde vai cada link.',
      },
      { title: 'Dentro da página', text: 'A faixa e o menu lateral com seus limites.' },
      { title: 'A aparência', text: 'As cores da Narsil, claras de dia e escuras à noite.' },
      { title: 'Avisos', text: 'Notificações nativas vindas do ntfy, seladas com sua chave.' },
    ],
    watch: [
      { title: 'O que é', text: 'Seus limites e conversas em um relógio Wear OS.' },
      { title: 'Ler o estado', text: 'O tópico do ntfy do mod, lido e aberto.' },
      { title: 'No mostrador', text: 'Um tile com dois anéis e uma complicação.' },
      { title: 'O app', text: 'Cada conversa, a configuração e a atualização a cada 15 minutos.' },
    ],
  },
  botMap: {
    title: 'Como o bot se encaixa',
    text: 'A barriga cuida de toda conexão e de todo segredo, e a cabeça só desenha. Cada peça leva aos guias que a constroem.',
    parts: {
      head: { title: 'A cabeça', text: 'ESP32-S3 sob um cubo prisma. Desenha o rosto do Narsil.' },
      belly: {
        title: 'A barriga',
        text: 'Tela touch ESP32-P4 com Xiaozhi. Cuida do Wi-Fi e de todo segredo.',
      },
      feeds: { title: 'ntfy e GitHub', text: 'Os alertas do Narsil e seus pull requests abertos.' },
      server: { title: 'Seu servidor', text: 'xiaozhi-esp32-server no Docker no seu PC.' },
      claude: { title: 'Claude', text: 'Escreve as respostas do Narsil.' },
    },
    links: {
      uart: 'UART, três fios',
      lan: 'WebSocket na sua rede',
      https: 'HTTPS',
    },
  },
}
