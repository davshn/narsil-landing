---
title: Um código-fonte, dois pacotes para Android
description: 'Como a Narsil no Claude entrega um código-fonte em dois pacotes: um .xpi não listado e assinado para o Firefox para Android, e uma pasta Manifest V3 para o Vivaldi que repõe os estilos ao recarregar.'
route: claude
order: 5
updated: 2026-11-18
---

## O que faz

A Narsil no Claude é escrita uma vez, numa pasta, e chega ao celular em duas formas:

| Navegador            | Pacote                                         | Como chega ao celular                                                     |
| -------------------- | ---------------------------------------------- | ------------------------------------------------------------------------- |
| Firefox para Android | A pasta como ela é, Manifest V2                | Assinada pela Mozilla como um `.xpi` não listado, instalada de um arquivo |
| Vivaldi para Android | Uma cópia com um Manifest V3 derivado do outro | Copiada para o celular por USB, carregada sem compactação, sem assinatura |

Ela precisa do **Firefox 142 ou posterior** ou do **Vivaldi 8.2 ou posterior**, como diz o README. O Chrome para Android não aceita extensões, então o Vivaldi é o navegador Chromium que a roda.

O pacote do Vivaldi também faz algo de que o do Firefox não precisa: quando o Vivaldi recarrega a extensão, ou o Android fecha o Vivaldi e ele abre de novo, a página pode perder os estilos ou os scripts da extensão. O pacote Chromium percebe e os devolve sem recarregar a página.

> **Experimental.** A extensão depende da estrutura da página do `claude.ai`, não de uma API pública, então uma atualização do Claude pode quebrá-la. Carregar uma extensão sem compactação no Vivaldi para Android é um recurso para desenvolvedores, e os navegadores podem mudar como ele funciona. A extensão só lê o `claude.ai`: ela nunca escreve na sua conta nem envia as suas conversas para lugar nenhum, embora carregue os desenhos da Narsil do GitHub e leia o tópico de estado dela no ntfy.sh. Assinar para o Firefox exige credenciais de API suas em addons.mozilla.org; este guia mostra só marcadores para elas.

## Como funciona por dentro

### O código-fonte: uma extensão do Firefox

A pasta `extension/` é uma extensão do Firefox completa: JavaScript puro, sem etapa de build, sem bibliotecas. O seu `manifest.json` é **Manifest V2**, com uma página de fundo (`"persistent": true`) que carrega o `background.js` e os seus módulos ([MDN: background](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background)).

O Firefox lê uma chave de que nenhum outro navegador precisa, `browser_specific_settings` ([MDN: browser_specific_settings](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings)):

- **`gecko.id`**, o id da extensão, no formato de um endereço de e-mail. Cada nova versão assinada mantém o mesmo id, então o Firefox a trata como a mesma extensão.
- **`gecko.strict_min_version`** e **`gecko_android.strict_min_version`**, ambos `142.0`. Um Firefox mais antigo que isso não instala a extensão. A primeira versão pedia a 121; o commit `40be528` subiu as duas para 142 quando acrescentou a chave seguinte. A sua mensagem não diz por quê.
- **`gecko.data_collection_permissions`**, com `required` definido como `none`: a extensão declara que não coleta nem transmite dados. O MDN diz que essa chave é obrigatória para novas extensões enviadas ao addons.mozilla.org a partir de 3 de novembro de 2025.

### Firefox: assinar como não listada

O Firefox para Android só instala extensões assinadas pela Mozilla. Assinar não significa publicar: o canal **não listado** assina a extensão "for self-distribution" (para distribuição própria), nas palavras da referência do `web-ext`, e ela nunca aparece na loja de complementos ([Extension Workshop: web-ext sign](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#web-ext-sign)).

A assinatura é feita pela ferramenta da própria Mozilla, o `web-ext`, executado como `web-ext sign --channel=unlisted`. Dois arquivos dizem a ele o que fazer:

- **`web-ext-config.mjs`**, na raiz, que o `web-ext` encontra sozinho ([Extension Workshop: getting started with web-ext](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/)). Ele define duas opções: a pasta de origem é `./extension` e a pasta de artefatos é `./dist`. Assim só a pasta da extensão é empacotada, nunca os testes nem os scripts, e o `.xpi` assinado vai para `dist/`, que o git ignora.
- **`scripts/sign.ps1`**, que o `npm run sign` executa. O commit `40be528` (2026-11-09) "build: sign the extension as unlisted with Mozilla" (assinar a extensão como não listada com a Mozilla) explica o seu propósito: ele "asks for the API credentials and keeps them only in its own process" (pede as credenciais de API e as mantém só no seu próprio processo).

As credenciais são o **JWT issuer** e o **JWT secret** que você gera em [addons.mozilla.org](https://addons.mozilla.org/developers/addon/api/key/). O `web-ext` os lê de `--api-key` e `--api-secret`, ou das variáveis de ambiente `WEB_EXT_API_KEY` e `WEB_EXT_API_SECRET`. O script pede os dois quando roda, o secret como entrada oculta, os coloca nessas duas variáveis só para o seu próprio processo, executa o `web-ext` e os remove quando termina, mesmo que a assinatura falhe. Eles nunca vão para um arquivo, para o histórico do shell nem para o repositório.

A Mozilla assina cada versão uma única vez, então cada nova assinatura precisa de uma nova `version` no `manifest.json`.

### Firefox: instalar o arquivo assinado

O `.xpi` é um zip assinado da pasta da extensão. Para instalá-lo, copie-o para o celular e use o menu oculto do Firefox: **Configurações → Sobre o Firefox**, toque no logotipo cinco vezes, depois volte às **Configurações** e use a opção de instalar uma extensão a partir de um arquivo. O [guia 1](/pt/mods/claude/what-it-is/) lista os passos.

Durante o desenvolvimento há um caminho mais rápido que não precisa de assinatura: o `npm run phone` executa `web-ext run --target=firefox-android` com o celular conectado por USB. O Firefox carrega a pasta como uma extensão temporária e a recarrega a cada mudança, enquanto o comando estiver rodando ([Extension Workshop: web-ext run](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#web-ext-run)). O `npm run lint` executa o `web-ext lint`, que verifica problemas no manifesto e no código antes de você assinar.

### Vivaldi: o pacote Chromium

O Vivaldi é um navegador Chromium, e desde a versão 8.2 a sua versão para Android carrega extensões do Chrome a partir de uma pasta no celular, sem loja e sem assinatura. O commit `11dadb3` (2026-11-10) "feat: run the extension in Vivaldi for Android as a Chromium package" (rodar a extensão no Vivaldi para Android como um pacote Chromium) acrescentou o segundo pacote.

Não é uma segunda cópia do código. O `scripts/chromium.mjs` copia `extension/` para `dist/chromium` e escreve dois arquivos na cópia:

1. **Um `manifest.json` Manifest V3**, derivado do do Firefox.
2. **`background-worker.js`**, um service worker de uma linha que carrega, com `importScripts()`, os mesmos scripts de fundo que a página de fundo do Firefox carrega.

O manifesto derivado muda o que o Manifest V3 exige ([Chrome: migrate to Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate)):

| Firefox, Manifest V2                                    | Vivaldi, Manifest V3                                                                     |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `manifest_version: 2`                                   | `manifest_version: 3`                                                                    |
| `browser_specific_settings`                             | Removida: é do próprio Firefox                                                           |
| Uma página de fundo com `scripts`                       | `background.service_worker`, o worker de uma linha                                       |
| Endereços dentro de `permissions` (`https://ntfy.sh/*`) | Movidos para `host_permissions`, com `https://claude.ai/*` acrescentado                  |
| `storage`                                               | `storage` e `scripting`                                                                  |
| `web_accessible_resources` como uma lista de arquivos   | Uma lista de objetos, cada um com os seus `resources` e as páginas que podem carregá-los |
| Content scripts como são                                | Os mesmos, com `lib/browser.js` carregado primeiro em cada grupo                         |

Todo o resto, os content scripts, a página de opções, os ícones, passa sem mudanças.

### Um código para duas APIs

O Firefox chama a API de extensões de `browser`; o Chromium a chama de `chrome`. No Manifest V3 as duas respondem com promises, então o código só precisa de um nome. O `lib/browser.js`, que existe só para ser carregado primeiro no pacote Chromium, define `browser` como `chrome`. O resto do código diz `browser` em todo lugar.

O script de fundo precisou de uma mudança real. Um service worker não tem `EventSource`, então o script de fundo acompanha o fluxo do ntfy.sh com `fetch` e um leitor de stream, nos dois navegadores. E o Chromium para um service worker ocioso depois de 30 segundos ([Chrome: the extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)), então o bloco no menu lateral envia a ele uma palavra a cada 25 segundos enquanto está à mostra. O [guia 3](/pt/mods/claude/sidebar/) trata dos dois.

### Vivaldi: carregá-la de `Download/narsil-chromium`

O `npm run phone:chromium` monta o pacote e, com `--push`, o copia para o celular com o `adb` do Android: ele apaga `Download/narsil-chromium` no celular e envia a nova pasta para lá. Com mais de um dispositivo conectado, a variável de ambiente `ANDROID_SERIAL` escolhe um. O celular precisa da depuração USB ligada.

Depois, no Vivaldi:

1. Abra `vivaldi://extensions` e ligue o **Modo de desenvolvedor**.
2. Toque em **Carregar sem compactação**, vá a **Download → narsil-chromium**, toque em **Usar esta pasta** e depois em **Permitir**.
3. Abra as opções da extensão e escreva o seu tópico, e a chave se você tiver uma.
4. Abra o `claude.ai` e recarregue-o.

A pasta fica no celular: o Vivaldi carrega a extensão a partir dela todas as vezes.

### Quando o Vivaldi recarrega a extensão

É aqui que os dois navegadores mais diferem. Quando a extensão some com o `claude.ai` aberto, porque o Vivaldi a recarrega ou atualiza ou porque o Android a descarrega, o Chromium tira os estilos dela da página e nunca devolve os seus scripts. Enquanto isso, o content script antigo continuava na página, sem a sua extensão, colocando a faixa sem os seus estilos. O Firefox devolve tudo sozinho.

Três correções, ao longo de uma semana, fazem o pacote Chromium se remontar sozinho.

**1. Os scripts antigos param** (`1d9db3d`, 2026-11-11, e `6b24ccb`, 2026-11-17). O observador da página que todos os content scripts compartilham, em `lib/watch.js`, confere a cada execução se a sua extensão ainda existe: quando ela some, `browser.runtime.id` fica vazio ou lança um erro. Então o observador para, e cada script que o usava para com ele: temporizadores limpos, faixa removida. Uma cópia mais nova dos scripts também para a antiga, disparando um evento no document da página, a única coisa que duas cópias compartilham. O `1d9db3d` também carrega o `lib/watch.js` nos dois grupos de content scripts, já que o Vivaldi às vezes rodava só o segundo grupo, e a faixa pedia um observador que ainda não existia.

**2. O script de fundo devolve os scripts** (`6b24ccb`). Cada vez que o script de fundo começa, o `lib/restore.js` pergunta a cada aba aberta do `claude.ai` se os seus scripts ainda respondem. O content script responde a uma mensagem própria com `true`. Uma aba que não responde recebe de novo os grupos de content scripts do manifesto, em ordem, cada folha de estilos com `scripting.insertCSS` e cada grupo de scripts com `scripting.executeScript` ([Chrome: chrome.scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting)). Isso precisa da permissão `scripting` e de acesso de host às páginas, e é por isso que o manifesto Chromium acrescenta as duas. Uma aba que ele não alcança, descartada ou ainda carregando, os recebe de qualquer jeito no seu próximo carregamento.

**3. A página pede o que lhe falta** (`a1e01b6` e `8e31a1d`, 2026-11-18). Depois que o Android fecha o Vivaldi e ele abre de novo, o Vivaldi pode rodar os content scripts sem as folhas de estilos, ou pular o primeiro grupo inteiro. Os scripts que rodaram ainda respondem, então o passo 2 pula a aba. Por isso a página confere a si mesma: cada folha de estilos define uma marca no `:root`, e a faixa confere as marcas e se o primeiro grupo deixou a sua função de modo na página (o [guia 4](/pt/mods/claude/colors-and-icon/) descreve as duas coisas). O que falta, ela pede ao script de fundo. O script de fundo só aceita folhas de estilos e números de grupo do seu próprio manifesto, nunca um arquivo qualquer, e os insere só naquela aba e naquele frame.

No Firefox nada disso roda: o seu manifesto não pede a permissão `scripting`, então `browser.scripting` não existe ali, e o código de restauração retorna na hora.

### Atualizar e desinstalar

**No Firefox**, mude a `version` no `manifest.json`, assine de novo e instale o novo `.xpi` do mesmo jeito. O manifesto não declara um endereço de atualização, então o Firefox não procura novas versões sozinho. **No Vivaldi**, execute `npm run phone:chromium` de novo e toque em **Atualizar** em `vivaldi://extensions`, como diz o README.

Para desinstalar do Firefox, abra o menu, vá a **Extensões**, escolha **Narsil en Claude** e remova-a. No Vivaldi, remova-a em `vivaldi://extensions`; a pasta `Download/narsil-chromium` pode então ser apagada. Nos dois, o tópico e a chave no armazenamento da extensão vão junto, e o Claude volta às suas próprias cores. O ícone da tela inicial fica (o [guia 4](/pt/mods/claude/colors-and-icon/) explica por quê).

Se você não assina mais nada, revogue as credenciais de API na mesma página do addons.mozilla.org onde as criou.

## Construa com o Claude

Peça ao Claude um script Node que derive um pacote Manifest V3 para o Vivaldi a partir da sua extensão do Firefox, e uma etapa de restauração no script de fundo. A única ideia que ele precisa acertar é que existe uma só fonte: o pacote Chromium é uma cópia com um manifesto derivado, não uma segunda versão do código.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> A minha extensão do Firefox fica em `extension/` com um `manifest.json` Manifest V2. Escreva um script Node, sem dependências, que copie a pasta para `dist/chromium` e escreva ali um `manifest.json` Manifest V3: remova `browser_specific_settings`, mova os padrões de URL de `permissions` para `host_permissions` e acrescente a eles os `matches` dos content scripts, acrescente a permissão `scripting`, transforme os scripts de fundo num service worker de uma linha que chame `importScripts()` com eles, coloque um arquivo que define `self.browser = self.chrome` primeiro em cada grupo de content scripts e converta `web_accessible_resources` para a forma de objetos do V3. Exporte a conversão do manifesto como uma função e teste-a com `node --test`. Depois, no script de fundo, ao iniciar, envie um ping a cada aba correspondente com `tabs.sendMessage`; onde nada responder, insira de novo o CSS e o JS dos content scripts do manifesto com `scripting.insertCSS` e `scripting.executeScript`. Use só APIs documentadas no MDN e em developer.chrome.com.

### O que conferir na resposta do Claude

1. O manifesto derivado remove `browser_specific_settings`, move os padrões de URL de `permissions` para `host_permissions`, acrescenta a eles os `matches` dos content scripts e acrescenta `scripting`.
2. O script de fundo vira um service worker de uma linha que carrega os mesmos scripts de fundo com `importScripts()`, e um arquivo que define `self.browser = self.chrome` vem primeiro em cada grupo de content scripts.
3. A restauração envia um ping a cada aba correspondente com `tabs.sendMessage` e insere de novo o CSS e o JS só onde nada responde, e só arquivos do próprio manifesto da extensão.
4. A conversão do manifesto é exportada como uma função e testada com `node --test` em um pequeno objeto Manifest V2.
5. Se você também pedir a assinatura ao Claude, o canal é `unlisted`, e as credenciais do AMO são digitadas na hora de assinar, nunca escritas no repositório nem em uma linha de comando.

Se uma verificação falhar, diga ao Claude o que você vê: "depois que eu toco em Atualizar no Vivaldi, a faixa volta sem as suas cores".

### Como a pessoa autora pediu

Nenhum pedido para o empacotamento foi registrado. As palavras da pessoa autora registradas para este caminho são sobre o site (o [guia 1](/pt/mods/claude/what-it-is/) as cita). O que segue é reconstruído a partir do histórico de commits da extensão:

- `40be528` (2026-11-09) "build: sign the extension as unlisted with Mozilla" (assinar a extensão como não listada com a Mozilla). No mesmo dia da primeira versão, para que ela pudesse ser instalada no Firefox para Android.
- `11dadb3` (2026-11-10) "feat: run the extension in Vivaldi for Android as a Chromium package" (rodar a extensão no Vivaldi para Android como um pacote Chromium). A sua mensagem descreve o Manifest V3 derivado, o service worker que carrega os mesmos scripts de fundo, o `lib/browser.js` e a troca de `EventSource` por `fetch`; e diz "The Firefox manifest stays V2" (o manifesto do Firefox continua V2).
- `1d9db3d` (2026-11-11) "fix: load the page observer with the band and stop when the extension goes away" (carregar o observador da página com a faixa e parar quando a extensão some).
- `6b24ccb` (2026-11-17) "fix: restore the styles and the band when Vivaldi brings the extension back" (restaurar os estilos e a faixa quando o Vivaldi traz a extensão de volta).
- `a1e01b6` (2026-11-18) "fix: ask for the styles when Vivaldi loads the band without them" (pedir os estilos quando o Vivaldi carrega a faixa sem eles).
- `8e31a1d` (2026-11-18) "fix: run the light and dark switch again when Vivaldi skips it" (rodar de novo a troca entre claro e escuro quando o Vivaldi a pula).

O segundo navegador levou um dia para ser acrescentado e uma semana para se assentar: cada correção depois do `11dadb3` responde a um jeito como o Vivaldi para Android carregava a extensão só em parte, descoberto ao usá-la.

## Código de referência

Esta é uma resposta correta, escrita para este guia. Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

Três peças, escritas para este guia (MIT): a conversão, a restauração ao iniciar e a assinatura.

`build-chromium.mjs`, executado com `node build-chromium.mjs`:

```js
import fs from 'node:fs'

const source = JSON.parse(fs.readFileSync('extension/manifest.json', 'utf8'))
const isAddress = (permission) => permission.includes('://')
const pages = source.content_scripts.flatMap((group) => group.matches)

const target = {
  manifest_version: 3,
  name: source.name,
  version: source.version,
  icons: source.icons,
  options_ui: source.options_ui,
  permissions: [...source.permissions.filter((p) => !isAddress(p)), 'scripting'],
  host_permissions: [...new Set([...source.permissions.filter(isAddress), ...pages])],
  background: { service_worker: 'worker.js' },
  content_scripts: source.content_scripts.map((group) => ({
    ...group,
    js: ['shim.js', ...(group.js ?? [])],
  })),
}

fs.rmSync('dist/chromium', { recursive: true, force: true })
fs.cpSync('extension', 'dist/chromium', { recursive: true })
fs.writeFileSync('dist/chromium/manifest.json', JSON.stringify(target, null, 2))
fs.writeFileSync('dist/chromium/shim.js', 'self.browser = self.chrome\n')
const scripts = ['shim.js', ...source.background.scripts].map((file) => `'${file}'`)
fs.writeFileSync('dist/chromium/worker.js', `importScripts(${scripts.join(', ')})\n`)
```

No fim do script de fundo, a restauração ao iniciar:

```js
async function restoreOpenPages() {
  if (!browser.scripting) return
  const groups = browser.runtime.getManifest().content_scripts ?? []
  const tabs = await browser.tabs.query({ url: groups.flatMap((group) => group.matches) })
  for (const tab of tabs) {
    const alive = await browser.tabs.sendMessage(tab.id, 'ping').catch(() => false)
    if (alive === true) continue
    const target = { tabId: tab.id }
    for (const group of groups) {
      if (group.css) await browser.scripting.insertCSS({ target, files: group.css }).catch(() => {})
      if (group.js)
        await browser.scripting.executeScript({ target, files: group.js }).catch(() => {})
    }
  }
}

restoreOpenPages()
```

E num content script, a resposta:

```js
browser.runtime.onMessage.addListener((message, _sender, reply) => {
  if (message === 'ping') reply(true)
})
```

Para a assinatura, um `web-ext-config.mjs` na raiz:

```js
export default {
  sourceDir: './extension',
  artifactsDir: './dist',
}
```

Depois, num shell no seu computador, com `dist/` no seu `.gitignore`:

```sh
read -r -p 'JWT issuer: ' WEB_EXT_API_KEY
read -r -s -p 'JWT secret: ' WEB_EXT_API_SECRET
export WEB_EXT_API_KEY WEB_EXT_API_SECRET
npx web-ext sign --channel=unlisted
unset WEB_EXT_API_KEY WEB_EXT_API_SECRET
```

O issuer tem a forma de `user:00000000:000` e o secret a de `EXAMPLE-not-a-real-secret`; esses dois são marcadores, nunca valores reais. Digitá-los num prompt os mantém fora do histórico do shell, o que uma linha de comando com os valores nela não faria. Se você preferir guardá-los num arquivo, mantenha-o fora do repositório ou num arquivo ignorado pelo git no seu computador, nunca num commit.

## Erros comuns e como testar

- **Colocar as credenciais do AMO no repositório.** Qualquer pessoa com o issuer e o secret pode assinar com a sua conta. Digite-os ao assinar, ou guarde-os num arquivo ignorado pelo git. Se algum dia um deles chegar a um commit, revogue-os na hora em [addons.mozilla.org](https://addons.mozilla.org/developers/addon/api/key/) e gere novos; remover o commit não basta.
- **Assinar sem mudar a versão.** A Mozilla assina cada versão uma única vez. Mude a `version` primeiro.
- **Escolher o canal `listed`.** Isso envia a extensão para a loja pública. Para o seu próprio celular, use `unlisted`.
- **Esquecer o `gecko.id`.** Para uma extensão Manifest V2 sem ele, o `web-ext` gera um id e o salva em `.web-extension-id`; perca esse arquivo e a próxima assinatura é uma extensão diferente. Defina o id no manifesto.
- **Manter uma página de fundo no Manifest V3.** O Chromium quer um service worker, que não tem DOM nem `EventSource`.
- **Deixar padrões de URL em `permissions`.** No Manifest V3 eles ficam em `host_permissions`.
- **Esperar que o Chromium devolva os scripts.** Quando a extensão recarrega, as páginas abertas perdem os seus estilos e não recebem scripts novos. Pergunte a cada aba, e injete de novo onde nada responder.
- **Scripts antigos que continuam rodando.** Um content script que ficou sem a sua extensão continua rodando. Confira o `browser.runtime.id`, e pare quando ele sumir.
- **Injetar o que uma página pedir.** A mensagem de uma página não é confiável. Injete só arquivos do seu próprio manifesto.

Para testar o pacote do Firefox antes de assinar, execute `web-ext lint` e `web-ext run --target=firefox-android` com o celular conectado. Para testar a conversão, exporte-a como uma função e confira um objeto Manifest V2 pequeno: os seus padrões de URL devem terminar em `host_permissions`, `scripting` deve ser acrescentado, e cada grupo de content scripts deve começar com o shim. Para testar a restauração, carregue o pacote Chromium no Vivaldi, abra o `claude.ai`, depois toque em **Atualizar** em `vivaldi://extensions` e volte à aba sem recarregá-la: as cores e a faixa devem voltar em um instante.

## Para ir além

- O [guia 1](/pt/mods/claude/what-it-is/) lista as partes da extensão e o que cada uma lê pela rede.
- O pacote do Firefox poderia se atualizar sozinho: um `update_url` em `browser_specific_settings` que aponte para um arquivo seu deixa o Firefox encontrar novas versões assinadas ([Extension Workshop: updating your extension](https://extensionworkshop.com/documentation/manage/updating-your-extension/)).
- O mesmo pacote Chromium poderia ser carregado no Chrome num computador, como uma extensão sem compactação, para testar a faixa numa tela mais larga.
