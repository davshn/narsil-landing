---
title: O conjunto de ferramentas
description: 'Qual versão do ESP-IDF o bot precisa e por quê, como compilar as duas placas na imagem Docker da Espressif e gravá-las a partir do Windows, onde o Docker não alcança as portas USB.'
route: bot
order: 2
updated: 2026-11-18
---

## O que faz

As duas placas são programadas com o ESP-IDF, o framework oficial da Espressif para os chips ESP32. Este guia monta um único conjunto de ferramentas que compila a barriga (ESP32-P4, Xiaozhi) e a cabeça (ESP32-S3, o nosso próprio firmware), e explica como o firmware vai do seu PC para cada placa.

A versão curta:

- **Uma versão do ESP-IDF para as duas placas:** o branch `release/v6.1`.
- **A compilação acontece no Docker**, na imagem `espressif/idf:release-v6.1` da Espressif, de modo que nada além do Docker é instalado no PC.
- **A gravação acontece no próprio Windows**, porque um contêiner Docker no Windows não enxerga as portas seriais USB.

Se você prefere um editor com botões, a extensão ESP-IDF para o VS Code faz o mesmo trabalho de forma nativa, e este guia também trata dela.

## Como funciona por dentro

### Duas versões documentadas, uma escolha

As duas fontes para a barriga discordam sobre a versão:

- **A Waveshare** recomenda o ESP-IDF V5.3.1 ou posterior para a ESP32-P4-WIFI6-Touch-LCD-4.3 na sua [página de ESP-IDF](https://docs.waveshare.com/ESP32-P4-WIFI6-Touch-LCD-4.3/ESP-IDF/), e o seu passo a passo usa a V5.5.2.
- **O Xiaozhi** (78/xiaozhi-esp32) diz no seu README que o projeto agora exige o ESP-IDF v6.0.1 ou posterior, recomenda o branch `release/v6.1` e afirma que o ESP-IDF 5.x não é mais suportado.

O bot segue o Xiaozhi, porque o Xiaozhi é o firmware que roda na barriga. Um conjunto de ferramentas 5.x não consegue compilá-lo de jeito nenhum, enquanto a placa em si não se importa: o próprio pacote de suporte de placa da Waveshare declara `idf: '>=5.4'`, então a 6.x está dentro da sua faixa. A 5.3.1 da Waveshare é um piso para os seus exemplos, não um teto.

O Xiaozhi recomenda o branch, e não a tag `v6.1`, por um motivo concreto: o seu README aponta para a issue #2344, em que a tag `v6.1` traz uma biblioteca de Wi-Fi do ESP32-C3 que não corresponde ao seu próprio cabeçalho. A própria CI do Xiaozhi compila cada placa na imagem `espressif/idf:release-v6.1`, então o bot usa exatamente essa imagem. Depois de trocar de revisão do ESP-IDF, o README pede `idf.py fullclean` no projeto antes de compilar de novo.

A cabeça roda o nosso próprio firmware pequeno, então não tem exigência de versão própria. Ela é compilada com a mesma imagem, o que significa um conjunto de ferramentas, um conjunto de hábitos e um cache.

### Compilar no Docker

A Espressif publica o ESP-IDF como uma imagem Docker, documentada no [guia IDF Docker Image](https://docs.espressif.com/projects/esp-idf/en/latest/esp32p4/api-guides/tools/idf-docker-image.html). As suas tags seguem três padrões: `latest` acompanha o `master`, `vX.Y` corresponde a uma versão e `release-vX.Y` acompanha o branch dessa versão. O contêiner tem o ESP-IDF, os compiladores e o Python prontos; a pasta do seu projeto é montada dentro dele.

O comando documentado, a partir da pasta do projeto, é:

```bash
docker run --rm -v $PWD:/project -w /project -u $UID -e HOME=/tmp espressif/idf idf.py build
```

- `--rm` remove o contêiner quando a compilação termina.
- `-v $PWD:/project` monta a sua pasta em `/project`, de modo que o resultado da compilação cai na sua pasta.
- `-w /project` começa nessa pasta.
- `-u $UID` (Linux e macOS) mantém os arquivos de saída como seus, e não do root.
- `-e HOME=/tmp` dá ao `idf.py` um lugar para guardar o seu cache.

O guia também documenta `-e IDF_GIT_SAFE_DIR='/project'` para o caso em que o git informa "dubious ownership" (propriedade duvidosa) do repositório montado, o que acontece com facilidade num disco do Windows.

### Alvos: `esp32p4` e `esp32s3`

O ESP-IDF compila para um chip de cada vez, escolhido com `idf.py set-target`. Os comandos do [guia de início para Windows](https://docs.espressif.com/projects/esp-idf/en/v6.1/esp32p4/get-started/windows-start-project.html) da Espressif são:

```bash
idf.py set-target esp32p4
idf.py menuconfig
idf.py build
idf.py -p PORT flash
idf.py -p PORT monitor
```

A cabeça usa `idf.py set-target esp32s3`. O guia de placa personalizada do Xiaozhi define o alvo "first time, or when switching targets" (na primeira vez, ou ao trocar de alvo), não antes de cada compilação. Para sair do monitor, pressione `Ctrl+]`.

Para a barriga, o Xiaozhi reúne esses passos em `scripts/build.py`, que lê o `config.json` da placa, define o alvo e as opções da placa, compila e junta tudo em `build/merged-binary.bin`. O guia 3 o usa.

### Por que o Docker não consegue gravar no Windows

O guia IDF Docker diz isso com clareza: os comandos que conversam com a placa, como `idf.py flash` e `idf.py monitor`, precisam que a porta serial seja passada para o contêiner. No Linux, a opção de dispositivo do Docker faz isso. No Windows, o guia diz "currently, this is not possible with Docker for Windows" (atualmente, isso não é possível com o Docker for Windows), e a mesma limitação vale para o Docker for Mac.

Por isso o bot divide o trabalho: o Docker compila, o Windows grava. Há duas formas de fazer a segunda metade, ambas da documentação da Espressif.

**A partir do host com o esptool.** O esptool é a ferramenta de gravação da Espressif. Um binário mesclado, como o `merged-binary.bin` do Xiaozhi, vai no offset `0x0`; a [página de comandos básicos](https://docs.espressif.com/projects/esptool/en/latest/esp32p4/esptool/basic-commands.html) do esptool mostra a forma `esptool --port COM4 write-flash 0x1000 my_app-0x01000.bin` e diz que um arquivo mesclado é gravado com `write-flash 0x0`. Ela também observa que `--chip` é opcional ao gravar, porque o esptool detecta o chip quando se conecta. No Windows, o esptool vem como um executável pronto no ZIP da versão do esptool; no Linux ou no macOS, `pip install esptool`.

**Por uma ponte serial (RFC2217).** A solução alternativa do guia IDF Docker: rodar o `esp_rfc2217_server` no Windows para compartilhar a porta COM pela rede, e apontar o `idf.py` dentro do contêiner para ela. `host.docker.internal` é o nome que o Docker dá ao host. Isso mantém o `idf.py flash` funcionando para qualquer projeto, inclusive a cabeça, que não tem binário mesclado.

### Portas USB e drivers no Windows

No Windows, as portas seriais se chamam `COM` seguido de um número. O [guia de conexão serial](https://docs.espressif.com/projects/esp-idf/en/v6.1/esp32p4/get-started/establish-serial-connection.html) da Espressif dá a forma mais simples de encontrar a certa: abra o Gerenciador de Dispositivos, desconecte a placa, conecte-a de novo, e a porta que desaparece e volta é a sua. Ele também diz que os drivers USB-serial normalmente vêm com o sistema operacional e se instalam sozinhos.

Para cada placa:

- **A barriga** é gravada pela sua porta Type-C marcada "USB to UART", que a Waveshare descreve como a porta de alimentação, programação e depuração. A página de ESP-IDF da Waveshare recomenda instalar os drivers pelo ESP-IDF Installation Manager (EIM).
- **A cabeça** tem um chip USB-serial CH343P (WCH), listado na página de produto da Waveshare.

Se uma placa não entrar sozinha no modo de download, ou na sua primeira gravação, o guia da Espressif dá a forma manual: segure BOOT, pressione RESET uma vez, solte BOOT.

### A alternativa: VS Code

A [página Get Started](https://docs.espressif.com/projects/esp-idf/en/v6.1/esp32p4/get-started/index.html) da Espressif recomenda dois caminhos de instalação: o ESP-IDF Installation Manager (EIM) e uma IDE, seja o Espressif-IDE ou o VS Code com a extensão ESP-IDF. A página de ESP-IDF da Waveshare percorre o EIM mais a extensão do VS Code no Windows: instale o ESP-IDF com o EIM (num caminho sem espaços) e depois a extensão, que a partir da versão 2.0 detecta a instalação sozinha. A barra de ferramentas inferior passa então a ter botões para escolher a porta COM, definir o alvo (`esp32p4`), compilar, gravar e abrir o monitor.

Uma instalação nativa grava diretamente, sem ponte. O custo é uma instalação grande no PC, e você precisa instalar o mesmo branch `release/v6.1` que o Xiaozhi pede, e não a versão que o EIM oferecer primeiro.

## Como foi pedido à IA

A questão do conjunto de ferramentas veio de uma decisão anterior. Quando a IA perguntou o que a barriga deveria rodar para dar uma voz à Narsil, a pessoa autora respondeu:

> yo pensaba hacerlo con Xiaozhi

Tradução para o português: "eu pensava em fazer com o Xiaozhi".

A IA então leu o README do Xiaozhi, encontrou a sua exigência, ESP-IDF 6.0.1 ou posterior, e a colocou ao lado da 5.3.1 documentada pela Waveshare. Ela registrou a diferença como um risco no documento de tarefas, junto com o plano de compilar na imagem Docker da Espressif e deixar a gravação e as conferências na tela para a pessoa que tem as placas. A regra que aplicou é a deste guia: o firmware que roda decide a versão, e a documentação da placa só define um mínimo.

A segunda decisão que molda o conjunto de ferramentas é onde o código vive. Perguntada sobre a casa do firmware, a pessoa autora escolheu:

> repo propio como fork

Tradução para o português: "repositório próprio, como fork".

Depois, perguntada se ele deveria ser público ou privado desde o início, a pessoa autora respondeu "1", a primeira opção oferecida: público desde o início. É por isso que as duas placas são compiladas a partir de um único repositório, `davshn/narsil-bot`, e por isso o conjunto de ferramentas precisa lidar com dois alvos numa única árvore.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é a conversa usada para configurar o bot.

> Eu compilo firmware de ESP32 no Windows com Docker e não quero o ESP-IDF instalado de forma nativa. O meu projeto é um fork de 78/xiaozhi-esp32 para uma placa ESP32-P4, mais um pequeno app ESP-IDF para um ESP32-S3 numa subpasta. Leia o README e o workflow de CI do Xiaozhi e o guia IDF Docker Image da Espressif, e depois me diga: qual tag de `espressif/idf` usar e por quê, o comando `docker run` exato para compilar cada alvo a partir do PowerShell, e como gravar e monitorar cada placa a partir do Windows, dado que o Docker não consegue repassar portas seriais USB. Cite a documentação para cada versão e comando.

## O código mínimo

Compilar a barriga, a partir da raiz do fork no PowerShell (`${PWD}` é a pasta atual do PowerShell; a flag `-u $UID` é para Linux e macOS e fica de fora aqui):

```powershell
docker run --rm -v ${PWD}:/project -w /project -e HOME=/tmp -e IDF_GIT_SAFE_DIR=/project `
  espressif/idf:release-v6.1 `
  python scripts/build.py waveshare/esp32-p4-wifi6-touch-lcd --name esp32-p4-wifi6-touch-lcd-4.3 --language es-ES
```

O guia 3 explica a pasta da placa, o `--name` e o idioma. Compilar a cabeça, a partir da sua pasta:

```powershell
docker run --rm -v ${PWD}:/project -w /project/head -e HOME=/tmp -e IDF_GIT_SAFE_DIR=/project `
  espressif/idf:release-v6.1 `
  sh -c "idf.py set-target esp32s3 && idf.py build"
```

Gravar a barriga a partir do Windows com o esptool, usando um nome de porta inventado:

```powershell
esptool --port COM5 write-flash 0x0 build/merged-binary.bin
```

Gravar a cabeça pela ponte serial. Num terminal, compartilhe a porta:

```powershell
esp_rfc2217_server -v -p 4000 COM6
```

Em outro, grave a partir do contêiner:

```powershell
docker run --rm -v ${PWD}:/project -w /project/head -e HOME=/tmp -e IDF_GIT_SAFE_DIR=/project `
  espressif/idf:release-v6.1 `
  idf.py --port "rfc2217://host.docker.internal:4000?ign_set_control" flash
```

Para o monitor, o mesmo `--port` funciona com `idf.py monitor`; acrescente `-it` ao `docker run` para que o contêiner tenha um terminal onde desenhar.

## Erros comuns e como testar

- **Compilar o Xiaozhi com o ESP-IDF 5.x.** O README do Xiaozhi é explícito: a 5.x não é mais suportada. Se você seguiu a página de configuração da Waveshare e instalou a 5.5.2, a barriga não vai compilar; use `release-v6.1`.
- **Misturar pastas de compilação depois de uma troca de versão.** O README do Xiaozhi pede `idf.py fullclean` depois de trocar de revisão do ESP-IDF. Uma pasta `build` antiga de outra versão dá erros que parecem não ter relação.
- **Tentar `--device` no Windows.** Funciona só no Linux. No Windows, grave a partir do host ou pelo `esp_rfc2217_server`.
- **"dubious ownership" (propriedade duvidosa) do git dentro do contêiner.** Passe `-e IDF_GIT_SAFE_DIR=/project`, como o guia IDF Docker documenta.
- **Nenhuma porta COM aparece.** Desconecte e conecte de novo olhando o Gerenciador de Dispositivos. Se nada mudar, tente outro cabo: um cabo USB só de carga não tem linhas de dados.
- **A porta errada na barriga.** Grave pela porta Type-C marcada "USB to UART", não pela USB OTG.
- **A placa não responde ao esptool.** Segure BOOT, pressione RESET, solte BOOT e grave de novo.

Para testar o conjunto de ferramentas antes do Xiaozhi, compile o exemplo `hello_world` do ESP-IDF para cada alvo no contêiner, grave-o e procure a sua saída no monitor. Se as duas placas imprimirem, o conjunto de ferramentas, os drivers e os cabos estão todos certos.

## Para ir além

- `docker run` com `-it` e sem comando abre um shell no contêiner, onde você pode rodar `idf.py menuconfig` e os outros comandos de forma interativa, como o guia IDF Docker mostra.
- Fixe a imagem por digest em vez de por tag se quiser que cada compilação do bot use exatamente o mesmo commit do ESP-IDF; `release-v6.1` se move conforme o branch se move.
- O `scripts/build.py --list-boards` do Xiaozhi imprime cada placa e variante que ele conhece, o que é uma forma rápida de conferir o nome de uma placa antes de uma compilação longa.
- A referência completa de comandos do ESP-IDF fica na documentação da Espressif para cada chip; troque o chip na URL (`esp32p4`, `esp32s3`) para ver as páginas dele.
