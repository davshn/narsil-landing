---
title: Kotlin, Gradle e AGP (avançado)
description: 'Por que um build Kotlin ou Android não sobe uma ferramenta sozinha, e como o Narsil Check bloqueia o Kotlin além dos plugins do compilador e confere os mínimos entre Gradle, AGP, Kotlin e Compose.'
route: check
order: 17
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/kmp.ts
  - repo: check
    path: hooks/maven.ts
  - repo: check
    path: hooks/wrapper.ts
  - repo: check
    path: hooks/actions.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/kmp.test.tsx
  - repo: check
    path: tests/wrapper.test.tsx
  - repo: check
    path: tests/actions.test.tsx
  - repo: check
    path: odd/tasks/release-age-all-ecosystems.md
---

## O que faz

Na maioria dos ecossistemas, uma biblioteca é uma biblioteca: você a sobe e, se a própria API dela não mudou, o projeto continua compilando. Um build Android ou Kotlin Multiplatform (KMP) é diferente. As suas ferramentas são em camadas, e cada camada é feita para um intervalo da camada de baixo.

Em palavras simples, as camadas são estas:

- **O Gradle** é a ferramenta de build. O projeto fixa a sua versão no wrapper do Gradle, o pequeno arquivo `gradle/wrapper/gradle-wrapper.properties` que diz qual Gradle baixar.
- **O Android Gradle Plugin (AGP)** ensina o Gradle a compilar apps Android. Cada AGP precisa de pelo menos um certo Gradle.
- **O Kotlin** é a linguagem, e o seu plugin do Gradle precisa de pelo menos um certo AGP e um certo Gradle.
- **Os plugins do compilador** (KSP, SKIE e outros) rodam dentro do compilador do Kotlin. Cada versão é feita para versões específicas do Kotlin, então eles têm que se mover junto com o Kotlin.
- **O Compose Multiplatform** é o framework de UI, e cada versão precisa de pelo menos um certo Kotlin e, a partir da 1.7, de pelo menos um certo AGP.

Então um patch do Kotlin, que parece trivial, pode parar o build porque um plugin do compilador ainda não o suporta. Uma minor do AGP pode falhar porque o Gradle do wrapper é antigo demais. Nada disso aparece nos números de versão. É o mesmo tipo de problema dos módulos do Expo amarrados a um SDK, que o guia 7 descreveu.

O Narsil Check conhece esses vínculos. Uma atualização que quebraria um deles vai para **Bloqueada**, qualquer que seja o salto, com o motivo em palavras. Dois exemplos do README:

```text
SKIE 0.10.16 es un plugin del compilador de Kotlin: confirma que soporta Kotlin 2.4.21
AGP 8.13.0 necesita Gradle 8.13 o más; el wrapper usa 8.11.1
```

Eles dizem "O SKIE 0.10.16 é um plugin do compilador do Kotlin: confirme que ele suporta o Kotlin 2.4.21" e "O AGP 8.13.0 precisa do Gradle 8.13 ou mais recente; o wrapper usa o 8.11.1".

O próprio wrapper do Gradle também é listado como algo a subir, assim como as GitHub Actions que os seus workflows fixam, já que uma CI também faz parte do build.

## Como funciona por dentro

Tudo isso está no adaptador Maven, que lê projetos Gradle e Maven (guia 6). O seu `conflictsOf` reúne três verificações: `kotlinConflicts` (plugins do compilador, em `hooks/maven.ts`), `kmpConflicts` (os mínimos cruzados, em `hooks/kmp.ts`) e `lockConflicts` (os locks de dependências do Gradle). Cada uma retorna frases; qualquer frase bloqueia a atualização. As três são funções puras sobre as dependências interpretadas e os arquivos do projeto, então os testes lhes passam uma lista e um wrapper e leem as frases.

### Plugins do compilador que têm que se mover com o Kotlin

`COMPILER_PLUGINS` em `hooks/maven.ts` lista sete: SKIE, KSP, Mokkery, Realm, Metro, kotlinx-rpc e Anvil. Cada um é encontrado pelas suas coordenadas (`co.touchlab.skie`, `com.google.devtools.ksp`, …) ou pela sua chave no catálogo de versões. A chave do catálogo importa: o exemplo do comentário é um módulo `build-logic` que lê `libs.versions.mokkery` diretamente, então nenhuma coordenada nos arquivos de build nomeia o Mokkery, e mesmo assim o projeto o usa.

Quando o Kotlin sobe e o projeto declara algum deles, a atualização é bloqueada:

- **O KSP é conferido com exatidão.** Uma versão do KSP1 traz o Kotlin para o qual foi feita, como em `2.4.20-1.0.30`. Se esse prefixo não for o novo Kotlin, o motivo é "hace falta un KSP para 2.4.21" ("é preciso um KSP para o 2.4.21"). Uma versão do KSP2 sem Kotlin nela, como `2.3.0`, funciona com qualquer um e não bloqueia.
- **Os outros precisam ser confirmados.** As versões deles não dizem nada sobre o Kotlin, então o mod não consegue conferi-las. Ele bloqueia e pede que você confirme o suporte.

O que conta como Kotlin é `org.jetbrains.kotlin` e os seus plugins, nunca `kotlinx` (coroutines e serialization sobem por conta própria).

Um plugin falta na lista de propósito: o compilador do Compose. Ele é publicado como `org.jetbrains.kotlin.plugin.compose`, então faz parte do próprio Kotlin, com a versão do Kotlin. O registro de tarefas explica a escolha: "Compose compiler lockstep with Kotlin left out: separate rows would block each other; catalogs share the kotlin version ref." (o compilador do Compose em sincronia com o Kotlin ficou de fora: linhas separadas se bloqueariam mutuamente; os catálogos compartilham a referência de versão kotlin). Num catálogo, os dois leem a mesma versão `kotlin`, então são uma só linha e sobem juntos.

### Os mínimos cruzados, da própria documentação das ferramentas

`hooks/kmp.ts` contém quatro tabelas, cada uma com o endereço de onde foi copiada e a data em que estava atual. O comentário diz isso claramente: "the tables come from the tools' own documentation, quoted below" (as tabelas vêm da própria documentação das ferramentas, citada abaixo). O registro de tarefas anota por que elas estão fixas no código: os metadados de módulo do Gradle publicados "states none of these" (não declaram nada disso).

**AGP para o seu Gradle mínimo**, da página de versões do AGP do Google, "as of AGP 9.5.0" (até o AGP 9.5.0):

| AGP  | Gradle mínimo |
| ---- | ------------- |
| 9.5  | 9.6.0         |
| 9.4  | 9.6.0         |
| 9.3  | 9.5.0         |
| 9.2  | 9.4.1         |
| 9.1  | 9.3.1         |
| 9.0  | 9.1.0         |
| 8.13 | 8.13          |
| 8.12 | 8.13          |
| 8.11 | 8.13          |
| 8.10 | 8.11.1        |
| 8.9  | 8.11.1        |
| 8.8  | 8.10.2        |
| 8.7  | 8.9           |
| 8.6  | 8.7           |
| 8.5  | 8.7           |
| 8.4  | 8.6           |
| 8.3  | 8.4           |
| 8.2  | 8.2           |
| 8.1  | 8.0           |
| 8.0  | 8.0           |

A tabela continua de 7.0 a 7.4 no código.

**Kotlin para o AGP e o Gradle mínimos do seu plugin do Gradle**, da página do Gradle do kotlinlang.org, "as of 2.4.21" (até o 2.4.21). Cada linha vale a partir daquela versão do Kotlin:

| Kotlin a partir de | AGP mínimo | Gradle mínimo |
| ------------------ | ---------- | ------------- |
| 2.4.0              | 8.5.2      | 7.6.3         |
| 2.3.0              | 8.2.2      | 7.6.3         |
| 2.1.0              | 7.3.1      | 7.6.3         |
| 2.0.0              | 7.1.3      | 6.8.3         |

**Compose Multiplatform para o seu Kotlin e o seu AGP mínimos**, das notas de migração do CHANGELOG da JetBrains e da página de compatibilidade. O Kotlin é o da plataforma mais exigente, iOS e web. A 1.12 não declara nenhum mínimo novo, então mantém os da 1.11:

| Compose Multiplatform | Kotlin mínimo | AGP mínimo |
| --------------------- | ------------- | ---------- |
| 1.6                   | 2.0.0         |            |
| 1.7                   | 2.0.0         | 8.1.0      |
| 1.8                   | 2.1.0         | 8.1.0      |
| 1.9                   | 2.1.0         | 8.1.0      |
| 1.10                  | 2.2.0         | 8.1.0      |
| 1.11                  | 2.3.0         | 8.1.0      |
| 1.12                  | 2.3.0         | 8.1.0      |

**O KSP a partir do 2.3.12 precisa do AGP 8.12.0**, das versões do KSP.

### Como as verificações leem o projeto

`kmpConflicts` precisa de três fatos:

- **O Gradle que o wrapper roda**, lido por `gradleVersionOf` da linha `distributionUrl`, `…/gradle-9.6.0-bin.zip`. Ele olha o wrapper da raiz e `android/gradle/wrapper/…`, onde um projeto React Native o guarda.
- **O AGP e o Kotlin em uso**: a versão mais alta que qualquer declaração daquela ferramenta escreve.
- **O que está subindo**, e para qual versão.

Depois, para a atualização em questão:

- **AGP**: a minor da nova versão é consultada. Se o Gradle do wrapper estiver abaixo do seu mínimo, bloqueada. Se não houver wrapper para ler, também bloqueada: "no encontré gradle/wrapper/gradle-wrapper.properties para confirmarlo" ("não encontrei … para confirmar").
- **Passar do AGP 8.x para o 9**: o AGP 9 traz o Kotlin embutido, e o código adiciona duas regras do guia de migração do Google. Um módulo que combina `org.jetbrains.kotlin.multiplatform` com `com.android.library` ou `com.android.application` tem que passar para `com.android.kotlin.multiplatform.library`, e o kapt não funciona (passe para o KSP, ou use `com.android.legacy-kapt`). Essas regras disparam só na passagem. Um projeto que já está no 9 já lidou com elas; o registro de tarefas anota que um teste as pegou disparando de novo num projeto assim.
- **Kotlin**: a primeira linha cujo "a partir de" o novo Kotlin alcança dá o AGP e o Gradle mínimos.
- **Compose Multiplatform**: só a sua própria linha conta, o plugin do Gradle e os grupos `runtime`, `foundation`, `ui`, `animation`, `material`, `components` e `desktop`. `org.jetbrains.compose.hot-reload` e `material3.adaptive` têm versões próprias e aqui não são Compose Multiplatform.
- **KSP**: a partir do 2.3.12, o AGP tem que ser 8.12.0 ou mais recente.

### Só mínimos, e "além da tabela" significa "confirme"

Duas decisões dão forma ao que o mod recusa.

**Os máximos não são conferidos.** A JetBrains publica o AGP e o Gradle mais altos com que cada Kotlin é testado, mas passar deles não é uma falha. O comentário do código: "The maximums are what is fully supported, not a failure, so they are not checked." (os máximos são o que tem suporte completo, não uma falha, então não são conferidos). O README acrescenta que o próprio Google combina versões além deles. Bloquear pelos máximos seguraria builds que funcionam.

**Uma versão mais nova que a tabela bloqueia.** O AGP 9.6, ou o Compose Multiplatform 1.13, não está nas tabelas. Em vez de adivinhar, o mod bloqueia com "es más nuevo que la tabla de Google que conozco (hasta 9.5): confirma qué Gradle necesita" ("é mais novo que a tabela do Google que eu conheço (até o 9.5): confirme de qual Gradle ele precisa"). Uma tabela copiada da documentação envelhece; a leitura segura de uma linha desconhecida é "pergunte".

### O wrapper como dependência própria

`hooks/wrapper.ts` faz do wrapper da raiz um ecossistema próprio, `gradle-wrapper`. A sua versão mais recente vem do serviço de versões do Gradle, `https://services.gradle.org/versions/current`, que também dá o horário de build usado para a espera de 24 horas (guia 9). A atualização reescreve só a versão em `distributionUrl`; não há nada para instalar, já que o wrapper baixa a nova distribuição na próxima execução.

Dois limites vêm do código. Um wrapper com `distributionSha256Sum` é bloqueado, já que o checksum pertence a uma distribuição e o mod não tem como conhecer o da próxima; o motivo traz o comando `./gradlew wrapper --gradle-version … --gradle-distribution-sha256-sum <sum>`. E o wrapper em `android/` não é subido: o React Native e o Flutter o escolhem.

Isso fecha um ciclo com a regra do AGP. Quando o AGP é bloqueado porque o Gradle do wrapper é antigo demais, o próprio wrapper aparece como uma atualização trivial. Lendo o código, subi-lo primeiro e varrer de novo deixa o AGP passar na sua verificação.

### As GitHub Actions no mesmo commit

O commit que adicionou o wrapper também adicionou `hooks/actions.ts`, um adaptador para as linhas `uses:` de `.github/workflows/*.yml` e `.github/actions/*/action.yml`. Uma CI Android fixa as suas etapas de configuração assim, então elas envelhecem como qualquer dependência.

Ele lê uma action fixada numa tag inteira (`@v6.1.0`) ou num commit com a sua versão num comentário (`@<commit> # v6.1.0`). Uma tag móvel como `@v6` já acompanha a sua major e fica de fora. As versões mais recentes vêm das tags git da action com `git ls-remote`, ficando só com as versões inteiras. Para uma fixação por commit, a atualização primeiro resolve o commit da nova tag, seguindo as tags anotadas (`^{}`), e se não conseguir ler um, nenhum workflow é escrito. O README acrescenta uma nota prática: enviar mudanças em `.github/workflows` por HTTPS exige um token com a permissão `workflow`.

### O README e o código

O README, na sua seção sobre essas ferramentas, diz "El wrapper solo se lee: nunca entra en el commit del PR" ("O wrapper só é lido: ele nunca entra no commit do PR"). Isso foi escrito com `1637e94`, quando o wrapper era só contexto para o adaptador Maven, e ainda é verdade para esse adaptador (um teste confere isso). Desde `7048580`, o wrapper também é um ecossistema próprio cujo manifest é `gradle-wrapper.properties`. Lendo `checkPending` (guia 13), um wrapper subido difere do `HEAD` e seria listado e entraria no commit com o resto. Nenhum teste cobre esse caso, em nenhum sentido.

## Como foi pedido à IA

Este foi registrado em parte. A regra dos plugins do compilador é anterior aos registros de tarefas públicos; os mínimos cruzados têm as palavras da pessoa autora.

### Registrado: "antes de subir corrijamos KMP"

`odd/tasks/release-age-all-ecosystems.md` no narsil-check registra, na sua spec S5, o que a pessoa autora disse depois de saber que o Compose Multiplatform e o AGP não estavam cobertos:

> "antes de subir corrijamos KMP. Compose Multiplatform y el Android Gradle Plugin etc, ademas cuando termines lanza el verificador independiente con todo esto"

Tradução para o português: antes de enviar, vamos corrigir o KMP. O Compose Multiplatform e o Android Gradle Plugin etc.; e além disso, quando você terminar, lance o verificador independente com tudo isso.

A spec S6 cita de novo a segunda metade, "lanza el verificador independiente con todo esto", como um requisito próprio: uma verificação independente do recurso inteiro antes de enviar.

### Registrado no registro de tarefas: como foi descoberto e construído

Estas são as notas do agente, não as palavras da pessoa autora. A entrada de log L4 registra a lacuna que levou ao pedido: "Compose Multiplatform and the Android Gradle Plugin are coupled to Kotlin and Gradle versions like Expo modules to the SDK, and no rule here knows them" (o Compose Multiplatform e o Android Gradle Plugin estão acoplados a versões do Kotlin e do Gradle como os módulos do Expo ao SDK, e nenhuma regra aqui os conhece). A L5 (2026-11-06) registra a pesquisa: a tabela do AGP "matched row by row" (conferida linha por linha) contra a página do Google, os mínimos do Kotlin do kotlinlang.org, que o Compose Multiplatform "has no official per-version table" (não tem uma tabela oficial por versão), então os seus mínimos vêm do seu CHANGELOG, e a decisão de deixar o compilador do Compose de fora.

A L6 registra o que o verificador independente encontrou: dois bloqueios sobre o recurso inteiro, um deles nestas regras. `isCompose` pegava `org.jetbrains.compose.hot-reload` e `material3.adaptive`, "which version on their own" (que têm versões próprias). Os dois foram corrigidos num único lote de correções.

### Reconstrução a partir do histórico de commits

A partir de `git log -- hooks/kmp.ts hooks/wrapper.ts hooks/actions.ts` e `git log -S COMPILER_PLUGINS` no narsil-check:

- `4ea9be0` (2026-11-04) "feat: block upgrades kept on purpose and Kotlin past its compiler plugins" (bloquear atualizações mantidas de propósito e o Kotlin além dos seus plugins do compilador). Os sete plugins, encontrados por coordenada ou por chave do catálogo, com o KSP conferido com exatidão. A sua mensagem nomeia a verificação em que foi feito: num modelo KMP, "Kotlin 2.4.20 -> 2.4.21 is now blocked by SKIE and Mokkery" (Kotlin 2.4.20 -> 2.4.21 agora é bloqueado pelo SKIE e pelo Mokkery).
- `1637e94` (2026-11-06) "feat: block Android and KMP upgrades the rest of the build cannot take" (bloquear as atualizações de Android e KMP que o resto do build não aguenta). As quatro tabelas. A sua mensagem: "Tables quote Google's and JetBrains' documentation; a version past them waits to be confirmed. The Gradle wrapper is read as context and never committed." (as tabelas citam a documentação do Google e da JetBrains; uma versão além delas espera para ser confirmada; o wrapper do Gradle é lido como contexto e nunca entra num commit).
- `40e5723` (2026-11-06) "fix: date Go +incompatible versions at the base path and keep Compose rules to its own line" (datar as versões +incompatible do Go pelo caminho base e limitar as regras do Compose à sua própria linha). Os dois bloqueios do verificador.
- `7048580` (2026-11-09) "feat: check the Gradle wrapper and GitHub Actions for upgrades" (verificar atualizações do wrapper do Gradle e das GitHub Actions). O wrapper como ecossistema próprio, bloqueado com um checksum, e o adaptador das actions.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No meu mod do Claude Code `my-panel`, que lista atualizações do Gradle a partir de `gradle/libs.versions.toml`, bloqueie as que o resto do build não aguenta, com o motivo numa frase. Leia o Gradle do wrapper a partir do `distributionUrl` em `gradle/wrapper/gradle-wrapper.properties`. Mantenha três tabelas num único módulo puro, cada uma com a URL da documentação de onde vem e a versão até a qual está atualizada: minor do AGP para o Gradle mínimo (notas de versão do AGP do Google), Kotlin para o AGP e o Gradle mínimos (página de configuração do Gradle do kotlinlang.org) e minor do Compose Multiplatform para o Kotlin e o AGP mínimos (o seu CHANGELOG). Confira só os mínimos. Uma versão do AGP ou do Compose mais nova que a sua tabela, ou o AGP sem wrapper, bloqueia com "confirme". Quando o Kotlin subir e o projeto declarar o KSP, bloqueie se o prefixo `x.y.z-` do KSP não for o novo Kotlin; para o SKIE, bloqueie e peça confirmação. Escreva um teste por regra com uma lista de dependências e um texto de wrapper, incluindo uma versão além da tabela.

## O código mínimo

Esta é uma versão reduzida da ideia, escrita para este guia. É TypeScript simples, sem API de mod; ela se encaixa no `conflictsOf` de um adaptador, como no guia 6. Foi adaptada de `hooks/kmp.ts` e de `kotlinConflicts` em `hooks/maven.ts` do [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). As tabelas foram reduzidas a poucas linhas; os valores são os de `hooks/kmp.ts`.

```ts
type Dep = { name: string; version: string }

// AGP minor -> minimum Gradle (a few rows of Google's table).
const AGP_GRADLE: Record<string, string> = {
  '9.0': '9.1.0',
  '8.13': '8.13',
  '8.12': '8.13',
  '8.11': '8.13',
  '8.10': '8.11.1',
}
// Kotlin from -> minimum AGP and Gradle (kotlinlang.org).
const KOTLIN_MIN = [
  { from: '2.4.0', agp: '8.5.2', gradle: '7.6.3' },
  { from: '2.3.0', agp: '8.2.2', gradle: '7.6.3' },
]

const parts = (v: string) =>
  v
    .split(/[.-]/)
    .slice(0, 3)
    .map((n) => Number.parseInt(n, 10) || 0)
const below = (a: string, b: string) => {
  const [x, y] = [parts(a), parts(b)]
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0)
  return false
}

export function gradleOf(wrapper: string): string | undefined {
  return /distributionUrl\s*=.*gradle-(\d+(?:\.\d+){0,2})-(?:bin|all)\.zip/.exec(wrapper)?.[1]
}

const AGP = 'com.android.tools.build:gradle'
const isKotlin = (name: string) => /^org\.jetbrains\.kotlin[.:]/.test(name)
const isKsp = (name: string) => /^com\.google\.devtools\.ksp[.:]/.test(name)

export function conflicts(
  name: string,
  target: string,
  deps: Dep[],
  gradle: string | undefined,
): string[] {
  const out: string[] = []
  const agp = deps.find((d) => d.name === AGP)?.version

  if (name === AGP) {
    const needs = AGP_GRADLE[/^(\d+\.\d+)/.exec(target)?.[1] ?? '']
    if (!needs) out.push(`AGP ${target} is newer than the table: confirm which Gradle it needs`)
    else if (!gradle) out.push(`AGP ${target} needs Gradle ${needs}; no wrapper to confirm it`)
    else if (below(gradle, needs))
      out.push(`AGP ${target} needs Gradle ${needs} or later; the wrapper uses ${gradle}`)
  }

  if (isKotlin(name)) {
    const needs = KOTLIN_MIN.find((k) => !below(target, k.from))
    if (needs && agp && below(agp, needs.agp))
      out.push(`Kotlin ${target} needs AGP ${needs.agp} or later; the project uses ${agp}`)
    if (needs && gradle && below(gradle, needs.gradle))
      out.push(`Kotlin ${target} needs Gradle ${needs.gradle} or later`)
    for (const d of deps.filter((d) => isKsp(d.name))) {
      const builtFor = /^(\d+\.\d+\.\d+)-/.exec(d.version)?.[1]
      if (builtFor && builtFor !== target)
        out.push(`KSP ${d.version} is built for Kotlin ${builtFor}: a KSP for ${target} is needed`)
    }
  }
  return out
}
```

`conflicts('com.android.tools.build:gradle', '8.13.0', deps, '8.11.1')` retorna a frase sobre o Gradle 8.13. Qualquer frase move a linha para o seu grupo de bloqueadas.

## Erros comuns e como testar

Estes vêm do código, dos testes e do registro de tarefas do Narsil Check:

- **Tratar um patch do Kotlin como trivial.** Com um plugin do compilador no build, ele não é. Confira os plugins em todo salto do Kotlin.
- **Deixar passar um plugin lido só pelo catálogo.** Um módulo `build-logic` pode não nomear nenhuma coordenada. Olhe também as chaves do catálogo.
- **Conferir os máximos.** Eles são "fully supported" (suporte completo), não limites. Bloquear por eles segura builds que funcionam.
- **Adivinhar além da tabela.** Uma versão desconhecida deve perguntar, não passar.
- **Disparar as regras de migração do AGP 9 em toda atualização do AGP 9.** Elas pertencem à passagem a partir do 8.x; um teste pegou exatamente isso.
- **Associar um grupo de forma ampla demais.** `org.jetbrains.compose.*` inclui artefatos com versões próprias. Nomeie os grupos da linha principal.
- **Tabelas sem fonte.** Escreva a URL e a versão "as of" (até a qual vale) ao lado de cada uma, para que a próxima pessoa saiba onde conferir.
- **Reescrever um wrapper com checksum.** A soma muda com a distribuição. Bloqueie e dê o comando.

Para testar, `claude plugin test .` executa `tests/kmp.test.tsx`: "the Android Gradle Plugin cannot go past what the Gradle wrapper runs" (o Android Gradle Plugin não pode ir além do que o wrapper do Gradle roda), "AGP 9 refuses KMP modules on com.android.library and kapt" (o AGP 9 recusa módulos KMP com com.android.library e kapt), "Kotlin cannot go past the AGP and Gradle its Gradle plugin supports at least" (o Kotlin não pode ir além do AGP e do Gradle mínimos que o seu plugin do Gradle suporta), "Compose Multiplatform cannot go past the Kotlin and AGP it needs" (o Compose Multiplatform não pode ir além do Kotlin e do AGP de que precisa), "KSP from 2.3.12 needs AGP 8.12" (o KSP a partir do 2.3.12 precisa do AGP 8.12), "artifacts under org.jetbrains.compose on their own version line are not Compose Multiplatform" (artefatos sob org.jetbrains.compose com linha de versão própria não são Compose Multiplatform) e "a wrapper under android/, as a React Native project keeps it, gives the Gradle version too" (um wrapper em android/, como um projeto React Native o guarda, também dá a versão do Gradle). `tests/wrapper.test.tsx` tem "a wrapper that checks a checksum is blocked with the reason, since the sum changes too" (um wrapper que confere um checksum é bloqueado com o motivo, já que a soma também muda) e "the vulnerabilities check never asks OSV about the wrapper, which it does not know" (a verificação de vulnerabilidades nunca pergunta ao OSV sobre o wrapper, que ele não conhece); `tests/actions.test.tsx` tem "a new tag whose commit cannot be read leaves every workflow as it was and says which" (uma tag nova cujo commit não pode ser lido deixa todos os workflows como estavam e diz qual).

## Para ir além

- As tabelas vão envelhecer. Um pequeno script que busque as páginas do Google e da JetBrains e as compare com as tabelas diria quando atualizá-las.
- Detectar a referência `kotlin` compartilhada do catálogo de versões deixaria o painel dizer "suba o Kotlin e o compilador do Compose juntos" em vez de deixar isso implícito.
- O wrapper em android/ de um projeto React Native poderia ganhar uma linha informativa, sem botão.

Este é o último guia da trilha "Seu próprio painel de revisão". O seu índice lista os dezessete guias, do painel lateral a estas ferramentas de build, se você quiser voltar a qualquer recurso. Para a base sobre a qual todo guia se apoia, os guias de "Fundamentos de mods" cobrem do que um mod é feito, o objeto `$`, como instalar, recarregar, validar e testar um mod, as superfícies em que ele roda e o que a GPL v3 do Narsil significa quando você reutiliza o seu código.
