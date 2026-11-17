---
title: 'Reutilizar o código do Narsil: a GPL v3'
description: Os dois mods do Narsil são licenciados como GPL-3.0-or-later. O que isso significa quando você estuda, modifica ou compartilha código tirado deles.
route: mods
order: 5
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: LICENSE
  - repo: pet
    path: .claude-plugin/plugin.json
  - repo: pet
    path: README.md
  - repo: check
    path: LICENSE
  - repo: check
    path: .claude-plugin/plugin.json
  - repo: check
    path: README.md
---

## O que faz

O narsil-pet e o narsil-check são de código aberto, e os guias deste site citam e adaptam o código deles. Este guia explica, em termos simples, o que a licença deles permite que você faça com esse código e o que ela exige de você quando você o repassa.

Isto não é aconselhamento jurídico. É um resumo do texto da licença que acompanha os dois mods. Para uma decisão importante, leia a licença completa e consulte um advogado.

## Como funciona por dentro

Os dois mods têm a mesma licença:

- O `plugin.json` define `"license": "GPL-3.0-or-later"`.
- O arquivo `LICENSE` do repositório é o texto completo da GNU General Public License, versão 3.
- O README diz que o mod pode ser redistribuído e modificado nos termos da GPL v3 ou, a seu critério, de qualquer versão posterior publicada pela Free Software Foundation.

A licença separa duas situações:

| Situação                                                                                         | O que a GPL v3 diz                                                                                                     |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Você usa ou modifica o código sem dar cópias a ninguém                                           | Você pode criar, executar e modificar o código sem condições, desde que a sua licença continue em vigor (seção 2).     |
| Você o transmite (conveying): dá cópias ou as disponibiliza a outras pessoas, modificadas ou não | Aplicam-se condições (seções 4 a 6). Interagir com um programa por uma rede sem transferir uma cópia não é transmitir. |

Quando você transmite o código, as principais condições são:

- **Código-fonte sem alterações (seção 4):** mantenha intactos os avisos de direitos autorais e de licença, mantenha os avisos de que não há garantia e entregue aos destinatários uma cópia da licença.
- **Código-fonte modificado (seção 5):** a obra precisa trazer "prominent notices stating that you modified it" (avisos visíveis de que você a modificou), com uma data pertinente; precisa dizer que é distribuída sob esta licença; e você precisa licenciar a obra inteira, como um todo, sob a GPL v3 para qualquer pessoa que receba uma cópia.
- **Outras formas (seção 6):** transmitir a obra em uma forma que não seja código-fonte exige transmitir também o código-fonte correspondente.

Um mod é distribuído como seus arquivos de código-fonte, então, na prática, compartilhar um mod criado a partir do código do Narsil significa compartilhar esse código-fonte sob a GPL v3.

## Passo a passo

### 1. Decida se você vai compartilhar

Se o mod ficar na sua máquina, as condições para transmitir não se aplicam. A partir do momento em que você publica um repositório, envia um arquivo `.plugin` ou entrega a pasta a alguém, elas se aplicam.

### 2. Mantenha a licença

Inclua o texto da GPL v3 como um arquivo `LICENSE` e defina a licença no seu manifesto:

```json
{
  "name": "my-band",
  "version": "0.1.0",
  "description": "A status band adapted from narsil-pet",
  "license": "GPL-3.0-or-later"
}
```

Mantenha o "or later" somente se você mantiver a opção que o original oferece. Não substitua a licença por uma mais permissiva nas partes que vêm do Narsil.

### 3. Indique o que você pegou e o que você mudou

Informe a origem e a mudança perto do código. Um cabeçalho como este cobre a atribuição, o link para o repositório e o aviso de modificação:

```ts
// Adapted from narsil-pet (https://github.com/davshn/narsil-pet), hooks/register.tsx.
// Changed 2026-11-17: renamed the band and removed the floating window.
// Licensed under the GNU General Public License, version 3 or later.
```

Mantenha todos os avisos que já estavam nos arquivos que você copiou.

### 4. Disponibilize o código-fonte

Publique o código-fonte completo do mod que você compartilha, não só os arquivos que você tirou do Narsil. A licença se aplica à obra inteira.

## Erros comuns e como testar

- **Distribuir sem um arquivo de licença.** `claude plugin validate` informa `LICENSE_MISSING` entre as verificações do diretório de plugins quando não há um arquivo `LICENSE` nem um `license` em `plugin.json`. Rode-o antes de compartilhar.
- **Mudar a licença do código copiado.** O código tirado do Narsil não pode ser compartilhado sob MIT, Apache ou uma licença proprietária.
- **Remover a atribuição.** Remover o link para o repositório original ou o aviso de que você modificou o código vai contra as condições sobre avisos.
- **Compartilhar só parte do código-fonte.** Os destinatários precisam poder obter o código-fonte do mod inteiro.

Antes de compartilhar, verifique se a sua pasta tem o texto da licença, se o `plugin.json` nomeia a licença e se cada arquivo adaptado diz de onde veio e o que mudou.

## Para ir além

Leia o arquivo `LICENSE` de qualquer um dos dois repositórios para ver o texto completo; as seções 2, 4, 5 e 6 são as resumidas aqui. A seção de licença no final de cada README traz o resumo do próprio projeto: você pode usar, estudar, modificar e compartilhar o mod, e uma versão modificada que você distribua também precisa ser publicada como código aberto sob a mesma licença, sem garantia. Os guias deste site seguem a mesma prática: cada trecho adaptado do Narsil nomeia seu repositório e seu arquivo, e cada guia lista esses arquivos em suas fontes.

Se um mod que você escreve do zero, depois de ler o código do Narsil, conta como uma obra baseada nele é uma questão jurídica que este guia não responde.
