---
title: Desenho e animações
description: 'Como a Narsil é desenhada: uma pose por estado, arte clara e escura num só SVG, loops animados feitos a partir de vídeos de IA e o limite de 131072 caracteres da faixa.'
route: pet
order: 2
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/sprite.ts
  - repo: pet
    path: hooks/art.ts
  - repo: pet
    path: tools/build-art.ps1
  - repo: pet
    path: tools/anim-sources.ps1
  - repo: pet
    path: tools/encode-anim.ps1
  - repo: pet
    path: tools/build-animated.ps1
  - repo: pet
    path: odd/tasks/animated-poses.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## O que faz

Fora do terminal, a faixa acima do prompt mostra a Narsil, uma serpente marinha chibi, numa pose que corresponde ao estado da conversa. Ela cumprimenta uma conversa nova, cochila enquanto a conversa espera por você, trabalha enquanto o Claude trabalha, se inclina para a frente quando precisa de você, comemora quando o turno termina e parece preocupada diante de um erro.

Cada pose é desenhada duas vezes, uma para fundo claro e outra para fundo escuro, e a faixa escolhe a certa de acordo com o esquema de cores do seu sistema. Cada pose também é um loop animado curto: ela realmente se move, respira, pisca e balança, em vez de ser uma imagem parada com efeitos ao redor.

A Narsil também cresce. À medida que ganha experiência, ela passa por cinco estágios, de filhote a adulta, e cada estágio tem o seu próprio conjunto de poses. Subidas de nível e novos estágios ganham a sua própria comemoração sobre a imagem.

No terminal não há imagem. A faixa desenha em vez disso um pequeno rosto de texto para cada humor, como `~(-ᴗ-)~ z` enquanto ela dorme.

O desenho é a parte que as pessoas notam primeiro, e ele cumpre uma função real: a pose e o brilho colorido ao redor dela dizem o estado antes que você leia uma palavra.

## Como funciona por dentro

### De onde vêm as imagens

A arte é feita de imagens pintadas, não de formas vetoriais. Elas ficam como arquivos de imagem em `assets/raw/<pose>-<claro|oscuro>.png` para o filhote e em `assets/raw/etapa2` a `assets/raw/etapa5` para os estágios seguintes (`claro` é claro, `oscuro` é escuro). As poses têm os nomes dos estados: `hola`, `parada`, `trabajando`, `necesita`, `terminado` e `error`, além de uma pose `base` usada como reserva.

Um mod não consegue ler arquivos de imagem na hora de desenhar, então as imagens são transformadas em código. `tools/build-art.ps1`, um script do Windows PowerShell, remove o fundo liso de cada imagem (branco ou transparente, avançando a partir das bordas), recorta a imagem até o personagem, redimensiona para 150 pixels de altura e escreve `hooks/art.ts` e os arquivos em `hooks/art/` com cada imagem embutida como dados. Os comentários dele dizem que também remove "any fake 'transparency' checkerboard an image generator painted" (qualquer falso quadriculado de "transparência" que um gerador de imagens tenha pintado) e uma linha clara de moldura que "an image generator drew" (um gerador de imagens desenhou); o repositório não registra qual ferramenta de imagem foi usada.

O próprio `hooks/art.ts` é curto e gerado: ele importa um módulo por estágio e tema e expõe `ART`, indexado por estágio, depois por tema, depois por pose. Sua primeira linha diz "do not edit by hand" (não editar à mão).

### Escolher uma imagem

`art` em `hooks/sprite.ts` escolhe a imagem para um humor, um tema e um estágio:

1. A pose desejada é `hola` para o cumprimento e, nos outros casos, a pose do estado do humor (`POSE`).
2. Se existir um loop animado para esse estágio, tema e pose (`ANIMATED`), ele tem prioridade.
3. Caso contrário, procura a imagem parada, recorrendo à pose `base` do estágio, depois aos estágios anteriores e depois ao outro tema.

Essa cadeia de reservas é o motivo pelo qual a arte pôde ser acrescentada estágio por estágio: um estágio ainda não desenhado mostrava mesmo assim algo sensato.

### Um SVG, dois temas

`sprite` retorna um único documento SVG que contém os dois temas. A imagem clara fica num grupo com a classe `th-claro`, a escura em `th-oscuro`, e uma regra CSS dentro do SVG mostra uma ou a outra:

```css
.th-oscuro {
  display: none;
}
@media (prefers-color-scheme: dark) {
  .th-claro {
    display: none;
  }
  .th-oscuro {
    display: inline;
  }
}
```

O mod nunca precisa saber o tema. A superfície que desenha o SVG aplica o esquema de cores de quem está vendo, então o mesmo desenho fica correto num desktop claro e num celular escuro ao mesmo tempo.

### Fazer uma imagem parada se mover

Antes de existirem os loops animados, toda a vida vinha de CSS dentro do SVG, e esse código ainda é usado para qualquer pose sem loop. O comentário no topo de `hooks/sprite.ts` lista as camadas:

- A imagem inteira nada, oscila, salta ou treme com transformações CSS, num ritmo definido pelo estágio dela (`STAGE_MOTION`, `motion`), com uma sombra e respingos acompanhando.
- O corpo dela é cortado transversalmente em nove faixas que apenas se tocam (`cuts`, `bands`), e cada faixa balança com um pequeno atraso, de modo que uma onda corre da cabeça até a cauda. Do pescoço para cima ela é uma única faixa, para que nenhum corte atravesse o rosto.
- Ao redor dela: uma aura pulsante na cor do estado (`aura`), bolhas, anéis na água, confete quando ela termina e objetos para cada humor.
- `@media (prefers-reduced-motion: reduce)` desliga todas as animações.

O histórico de commits explica a regra das "faixas que apenas se tocam". Uma abordagem anterior colocava uma segunda cópia deformada da imagem sobre a primeira, e correções como `9f9cc75` "fix: draw Narsil as one sharp picture so no part of her shows twice" (desenhar a Narsil como uma única imagem nítida para que nenhuma parte dela apareça duas vezes) e `6ac340e` "fix: draw Narsil's head once instead of a turning copy over the body" (desenhar a cabeça da Narsil uma vez em vez de uma cópia girando sobre o corpo) eliminaram o aspecto duplicado.

### Os loops animados

Cada pose agora também tem um loop animado de verdade: uma imagem WebP animada feita a partir de um vídeo curto gerado por IA, embutida como dados em `hooks/art/anim/` e reunida por `hooks/art/animated.ts`. Quando `art` encontra um loop, `picture` o desenha inteiro e pula o corte em faixas, porque o loop já se move por conta própria. A aura, o emblema e os efeitos continuam ao redor dele.

### O limite de tamanho

Tudo o que foi descrito acima precisa caber numa única string. O `source` do elemento `Svg` é, nas palavras dos tipos da 2.1.325, "The SVG document, `<svg ...>...</svg>`, at most 131072 characters." (o documento SVG, com no máximo 131072 caracteres). Os dois temas dividem esse orçamento, porque ambos estão no mesmo desenho.

Esse limite moldou os loops:

- `tools/encode-anim.ps1` busca a melhor qualidade que mantenha um loop dentro de 38 KB (`-TargetKB 38`).
- `tools/build-animated.ps1` recusa qualquer loop acima de 40 KB (`$MAX_BYTES`). Embutidos como dados em base64, dois loops de 40 KB ocupam cerca de 109.000 caracteres, o que deixa espaço para o resto do desenho.
- Um teste em `tests/narsil.test.tsx` comprova isso: "two loops of the largest size tools/build-animated.ps1 lets in, one per theme, still fit the band at every stage and celebration" (dois loops do maior tamanho que tools/build-animated.ps1 aceita, um por tema, ainda cabem na faixa em todos os estágios e comemorações).
- `tools/build-animated.ps1` escreve um módulo por estágio e tema porque, como diz o seu comentário, "the engine reads no file over 1 MiB" (o motor não lê nenhum arquivo acima de 1 MiB).

A janela flutuante não tem esse limite, então ela mostra uma cópia mais nítida de cada loop. `pictureDefs` marca um loop com `data-loop="<name>"`, e a página da janela o troca por uma versão de 200 pixels que o servidor local serve a partir de `assets/anim-hq`.

### Custo na hora de desenhar

Um desenho completo é grande (o código diz "some 100 KB", cerca de 100 KB), e a faixa e a janela pedem o mesmo desenho repetidas vezes. `sprite` guarda os últimos oito desenhos num `Map` cuja chave é o humor, o estágio e o marco, e `pushOverlay` em `hooks/register.tsx` envia o SVG à janela só quando ele mudou (commit `19106d1` "perf: reuse Narsil's drawing and send it to the window only when it changes", reaproveitar o desenho da Narsil e enviá-lo à janela só quando ele muda).

## Como foi pedido à IA

Esta história tem duas partes. A arte parada e o seu movimento em CSS vieram primeiro, e os pedidos correspondentes não foram registrados. Os loops animados têm um registro público de tarefas, `odd/tasks/animated-poses.md` no narsil-pet, que cita os pedidos da pessoa autora palavra por palavra.

### Reconstrução a partir do histórico de commits (arte parada)

A partir de `git log -- hooks/sprite.ts hooks/art.ts tools/build-art.ps1`:

- `d48c95c` (2026-10-30) "feat(art): add painted art for each state and its build tool" (adicionar arte pintada para cada estado e a sua ferramenta de geração), depois `d31a6ba` "feat(sprite): draw Narsil from the art with layered animations" (desenhar a Narsil a partir da arte com animações em camadas).
- `9bfa039` (2026-10-30) "feat: let Narsil grow through five stages as she levels up" (deixar a Narsil crescer por cinco estágios à medida que sobe de nível) e `7a964d1` "feat: draw Narsil as a hatchling at stage 1 and split the art per stage" (desenhar a Narsil como filhote no estágio 1 e dividir a arte por estágio).
- Em 2026-10-31, um commit por estágio e tema, como `ff02847` "feat: draw stage 3 dark art" (desenhar a arte escura do estágio 3) e `eed13b0` "feat: draw stage 5 light art" (desenhar a arte clara do estágio 5).
- `9f9cc75` e `6ac340e` (2026-10-31), as correções da imagem duplicada descritas acima.
- `e79c512` (2026-11-09) "feat: make Narsil's body undulate and her rest less mechanical" (fazer o corpo da Narsil ondular e o seu descanso parecer menos mecânico). A mensagem descreve as faixas que "only meet" (apenas se tocam) e diz que, em repouso, ela "only starts to snore after a minute" (só começa a roncar depois de um minuto).

### O pedido registrado para os loops animados

A primeira entrada do registro, L1, datada de 2026-11-15:

> "quiero cambiar las imagenes de narsil, por unas realmente animadas, donde tenga movimiento la serpiente, esto es posible? podriamos usar mi suscripcion de gemini plis para generar las animaciones, estoi haria que el mod consumiera demasiados recursos?"

Tradução para o português: a pessoa autora quer substituir as imagens da Narsil por outras realmente animadas, em que a serpente se mova, pergunta se isso é possível, sugere usar a sua assinatura do Gemini para gerar as animações e pergunta se isso faria o mod consumir recursos demais.

As specs do mesmo arquivo citam as correções que vieram depois, e cada uma mudou o resultado:

- Spec S2: "dile que no necesitas sonido, la oido sonar y chapoteando el agua y no es necesario" (tradução: diga a ele que não é preciso som; a pessoa autora ouviu o vídeo fazer barulho e espirrar água, e isso não é necessário). O prompt do vídeo agora pede silêncio, e o codificador descarta qualquer faixa de áudio.
- Spec S3: "me gustaria que tuviera el color original, y sobretodo que se viera en la banda de chat" (tradução: a pessoa autora quer as cores originais e, sobretudo, que a animação apareça na faixa do chat). Isso fez do limite de 131072 caracteres a principal restrição.
- Spec S4: "la version idle que es la dormida parpadea, lo que es curioso" (tradução: a versão idle, a que dorme, pisca, o que é curioso). Cada loop agora é gerado a partir da imagem da sua própria pose, e o prompt da pose adormecida diz que os olhos dela ficam fechados.
- Spec S5: "no podemos directamente generarla con menos tamano para ahorrar limite? se ve algomas delgado y algo pixelado" (tradução: não dá para gerar o vídeo menor para economizar espaço? ela parece mais magra e um pouco pixelada). A resposta do registro: o tamanho de saída do vídeo não muda o custo; o que muda é um movimento sutil e as configurações do codificador.
- L4 (2026-11-15): "si me agrada, vamos a cambiar todos" (tradução: sim, gostei, vamos trocar todos). Isso virou 60 loops: seis poses, cinco estágios, dois temas.
- L6 (2026-11-15): "en ventana externa podemos poner el video sin recortar? para que se vea mas nitido?" (tradução: na janela externa, podemos mostrar o vídeo sem recorte, para que fique mais nítido?). Isso gerou as cópias nítidas em `assets/anim-hq`.

O registro também anota como os vídeos foram feitos. No começo, os vídeos vinham do Veo no aplicativo Gemini, e a cota acabou depois de dois vídeos (L4). Em L8 (2026-11-16), a pessoa autora pediu ao Claude que fizesse os vídeos no navegador da pessoa autora e que parasse quando chegasse o limite do Veo. Em L9 (2026-11-16), perguntou "antes de continuar, no es posible avanzar en los videos usando flow?" (tradução: antes de continuar, não é possível avançar nos vídeos usando o Flow?). O Flow tinha os seus próprios créditos, e o seu modo Frames, com a imagem dela como primeiro e último quadro, produzia um loop fechado. Em L10 (2026-11-16), a pessoa autora pediu mais qualidade ou mais movimento e depois disse "prioriza la nitidez y luego mas movimiento" (tradução: priorize a nitidez e depois mais movimento). O resultado, como L10 registra: os 60 loops feitos no Flow, com 3 segundos em 360p, com prompts pedindo movimento claro do corpo, da cabeça e das nadadeiras enquanto a água fica calma, porque a água agitada custava a nitidez do loop da faixa.

### O prompt dado ao modelo de vídeo

O prompt que foi para o modelo de vídeo também está registrado, porque um script o escreve. `tools/anim-sources.ps1` prepara, para cada loop que falta, a imagem dela sobre verde puro (`#00FF00`) e um arquivo de texto com o prompt gerado por `Get-Prompt`. O prompt começa assim:

> "Create a SILENT video from this image: no audio at all, no music, no sound effects, no water sounds. Animate this exact character as a seamless loop of ..."

Tradução: "Crie um vídeo SILENCIOSO a partir desta imagem: nenhum áudio, nenhuma música, nenhum efeito sonoro, nenhum som de água. Anime exatamente este personagem como um loop contínuo de ..."

Em seguida, ele pede água calma, um personagem idêntico, uma câmera fixa, o mesmo fundo verde liso e um último quadro igual ao primeiro. A parte do meio vem de uma tabela de movimentos por pose; para a pose adormecida, ela diz que os olhos dela "stay CLOSED the whole time" (ficam FECHADOS o tempo todo), que é a spec S4 transformada em instrução.

Depois, `tools/encode-anim.ps1` remove o verde por chroma key (`colorkey=0x00FF00`), descarta o áudio, recorta até ela e faz uma busca binária sobre a qualidade do WebP para ficar abaixo do tamanho-alvo. `tools/build-animated.ps1`, que ele chama, embute o resultado.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é um dos prompts registrados no narsil-pet.

> No meu mod do Claude Code, adicione uma função `petSvg(status)` que retorne um único documento SVG para o elemento `Svg` da faixa `AbovePrompt`. Ele deve conter uma versão clara e uma escura do meu personagem (data URLs vindas de `hooks/art.ts`), mostrar a certa com uma media query `prefers-color-scheme` dentro do SVG e dar a cada status uma pequena animação CSS (oscilar enquanto trabalha, respiração lenta quando parado, um tremor curto em caso de erro). Desligue as animações com `prefers-reduced-motion`. Lance um erro se o documento tiver mais de 131072 caracteres e adicione um teste mostrando que todos os status, nos dois temas, cabem. No terminal, desenhe um rosto de texto em vez disso, já que o terminal não tem `Svg`.

## O código mínimo

Uma versão reduzida, escrita para este guia e conferida com os tipos da 2.1.325. A estrutura (dois temas num SVG, a verificação de tamanho, o rosto de terminal) foi adaptada de `hooks/sprite.ts` e `hooks/register.tsx` do [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). Os desenhos da Narsil também são GPL v3: se você usá-los, mantenha a atribuição e um link para o repositório.

```ts
// hooks/drawing.ts
const MAX_SVG = 131072 // the Svg element's limit for `source`

export function petSvg(lightSrc: string, darkSrc: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 120" width="150" height="120">` +
    `<style>.dark{display:none}` +
    `@media (prefers-color-scheme: dark){.light{display:none}.dark{display:inline}}` +
    `.bob{transform-box:fill-box;transform-origin:50% 100%;animation:bob 2s ease-in-out infinite}` +
    `@keyframes bob{50%{transform:translateY(-3px)}}` +
    `@media (prefers-reduced-motion: reduce){*{animation:none!important}}</style>` +
    `<g class="bob">` +
    `<image class="light" href="${lightSrc}" x="25" y="4" width="100" height="112"/>` +
    `<image class="dark" href="${darkSrc}" x="25" y="4" width="100" height="112"/>` +
    `</g></svg>`
  if (svg.length > MAX_SVG)
    throw new Error(`the drawing has ${svg.length} characters; the band takes ${MAX_SVG}`)
  return svg
}
```

Para desenhá-lo, com a reserva para o terminal:

```tsx
on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
  if (e.props.hasSurvey) return next(e)
  if (e.surface === 'terminal') {
    const { Text } = $.ui.resolve(e)
    return <Text>~(•ᴗ•)~ working</Text>
  }
  const { Svg } = $.ui.resolve(e)
  return <Svg source={petSvg(LIGHT, DARK)} alt="My pet: working" width={132} height={118} />
})
```

`LIGHT` e `DARK` representam as suas próprias imagens embutidas, por exemplo strings `data:image/png;base64,...` geradas por um script de build, do mesmo jeito que `tools/build-art.ps1` escreve `hooks/art.ts`. Restringir por `e.surface` primeiro é importante: a tabela de elementos do terminal não tem `Svg`.

## Erros comuns e como testar

- **Passar do limite sem perceber.** Um desenho acima de 131072 caracteres não é desenhado. Dados em base64 crescem um terço, então uma imagem de 40 KB custa cerca de 54.600 caracteres, e dois temas dobram isso. Confira o comprimento no código e num teste, como a Narsil faz com "every state is drawn from the art, light and dark, within the Svg size limit" (todo estado é desenhado a partir da arte, clara e escura, dentro do limite de tamanho do Svg).
- **Escolher o tema no mod.** O mod não consegue ver o esquema de cores de quem está vendo, e várias superfícies podem desenhar ao mesmo tempo. Coloque os dois temas no SVG e deixe o CSS escolher.
- **Animar uma cópia sobre a imagem.** Uma duplicata deformada aparece como imagem dupla. As correções da Narsil (`9f9cc75`, `6ac340e`) passaram para faixas de borda dura que apenas se tocam.
- **Animar uma pose até ela virar outra pose.** A spec S4 do registro anota a pose adormecida piscando. Gere cada loop a partir da sua própria pose e diga no prompt o que não pode mudar.
- **Som e fundos agitados em vídeo de IA.** Peça silêncio e descarte o áudio mesmo assim (spec S2). Água calma mantém o loop nítido num tamanho pequeno (L10). Faça o loop se fechar sobre si mesmo: o modo Frames do Flow, com o mesmo primeiro e último quadro, fez isso (L9).
- **Bordas suaves que custam caro demais.** O L2 do registro anota que uma borda alfa suave e desfocada custava cerca de 45 KB; os loops da faixa usam uma borda dura reduzida em um pixel, o que também remove a franja verde. As cópias nítidas da janela usam a borda suave.
- **Arquivos que o motor não carrega.** Módulos acima de 1 MiB são recusados, então divida a arte embutida em vários arquivos (um por estágio e tema, na Narsil).
- **Redesenhar a cada batimento.** Guarde os desenhos em cache e envie-os só quando mudarem.

Para testar, `claude plugin test .` executa os testes de desenho da Narsil em `tests/narsil.test.tsx`, entre eles "Narsil moves visibly in every state" (a Narsil se move visivelmente em todos os estados) e "a pose with an animated loop shows the loop, whole and within the Svg size limit, and its still picture elsewhere" (uma pose com loop animado mostra o loop, inteiro e dentro do limite de tamanho do Svg, e a sua imagem parada nos outros lugares). `node tests/overlay-drawing.check.cjs` confere o desenho da janela flutuante. O repositório da Narsil também tem `tools/preview.mjs`, adicionado como "chore: add a local preview page for every animation" (adicionar uma página local de pré-visualização para cada animação) (`75e1525`), para ver todas as poses de uma vez.

## Para ir além

- `draw` em `hooks/sprite.ts` monta o documento inteiro: a água, a camada de marco atrás, a sombra, as imagens dos dois temas, bolhas, gotas e uma comemoração ou os objetos do humor.
- `LAYOUT` guarda, para cada pose, onde fica a cabeça dela, para que o emblema e os anéis caiam sobre ela; `place` redimensiona cada imagem para caber na caixa de 150 por 120.
- `props` adiciona os pequenos objetos de cada humor, e `ASLEEP_AFTER_S` espera um minuto antes de ela começar a roncar.
- `celebration`, `behind` e `grows` desenham um novo nível e um novo estágio sobre o estado dela.
- `FACE` é o rosto de texto do terminal para cada um dos doze humores.
- `tools/anim-sources.ps1`, `tools/encode-anim.ps1` e `tools/build-animated.ps1` formam o pipeline dos loops; a seção "Desarrollo" do README lista os passos exatos e as configurações do Flow, e `tools/ffmpeg.ps1` localiza o ffmpeg.
- `overlay/server.cjs` serve os loops nítidos em `GET /anim/<loop>.webp` para a janela flutuante, assunto de um guia posterior.
