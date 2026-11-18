---
title: Versões fixadas de propósito
description: 'Como o Narsil Check lê um comentário como "# pinned: 3.7 breaks auth" num manifest e deixa essa biblioteca fora do botão de atualização, com o comentário como motivo.'
route: check
order: 11
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/adapter.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/swiftpm.ts
  - repo: check
    path: hooks/npm.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/holds.test.tsx
---

## O que faz

Às vezes uma versão é antiga de propósito. Uma biblioteca quebrou algo na versão seguinte, um plugin só aceita esta, ou a equipe combinou esperar por uma migração. Quem tomou a decisão costuma deixar um comentário ao lado da versão, e a próxima pessoa que olha o manifest o lê.

Uma ferramenta que sobe versões também deveria lê-lo. No Narsil Check, um comentário que diz que a versão é mantida de propósito manda essa biblioteca para **Bloqueada**, e o próprio comentário é o motivo abaixo da linha:

```toml
[versions]
# Fijar 2.4.20 hasta confirmar soporte de SKIE para 2.4.21
kotlin = "2.4.20"
ktor = "3.6.1" # pinned: 3.7 breaks auth
```

Este exemplo vem do README. O primeiro comentário diz "Fixar 2.4.20 até confirmar o suporte do SKIE para 2.4.21", e o segundo, "pinned: 3.7 breaks auth" ("fixada: a 3.7 quebra a autenticação"). No painel, a linha do ktor recebe:

```text
Fijada a propósito: «pinned: 3.7 breaks auth»
```

Isso é "Fixada de propósito", seguido do comentário. O botão **Actualizar las N** ("Atualizar as N") nunca pega uma biblioteca bloqueada, então a decisão escrita no manifest vale até que alguém remova o comentário.

## Como funciona por dentro

### As palavras: `HOLD`

O briefing de tarefas desta trilha coloca a detecção em `hooks/words.ts`; no código, ela fica em `hooks/adapter.ts`, ao lado do contrato que todo ecossistema cumpre. É uma única expressão regular:

```ts
const HOLD =
  /\b(pin(ned)?|hold|keep|freeze|frozen|do ?n[o']t (upgrade|update|bump)|fij(ar|ad[oa]|o)|congelad[oa]|no (actualizar|subir))\b/i
```

Ela é citada do [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Em inglês, ela reconhece pin, pinned ("fixar", "fixada"), hold, keep ("segurar", "manter"), freeze, frozen ("congelar", "congelada"), "do not" ou "don't" seguidos de upgrade, update ou bump ("não atualizar", "não subir"); e, em espanhol, fijar, fijado, fijada, fijo ("fixar", "fixado"), congelado ou congelada e "no actualizar" e "no subir" ("não atualizar", "não subir"). Ela ignora maiúsculas e minúsculas, e `\b` a limita a palavras inteiras, então "keeper" ou "pinch" não contam.

O README lista a maioria dessas palavras, mas não todas: "frozen", "fijo", "no subir" e as formas com "update" e "bump" estão só no código.

### Qual comentário conta: `commentOf` e `holdNote`

`commentOf` encontra o comentário que uma linha carrega: depois de `#`, `//` ou `<!--` (precedidos de um espaço ou no início da linha), com um `-->` de fechamento descartado. Esses três cobrem todos os manifests que o mod lê e que admitem comentários: TOML (`Cargo.toml`, `pyproject.toml`, o version catalog do Gradle), `requirements.txt`, `pubspec.yaml`, o `Gemfile`, `go.mod`, os scripts do Gradle, `Package.swift` e o XML de `pom.xml` e dos arquivos `.csproj`.

`holdNote(files, keys, spec)` então procura, em cada arquivo que o adaptador leu, a linha que declara esta dependência:

1. A linha deve conter a versão como foi escrita (`spec`) e mencionar uma das `keys` como nome inteiro. As chaves são o nome da dependência, o seu nome de exibição e, para uma linha de version catalog, a sua chave de versão (`kotlin` em `versions.kotlin`).
2. O comentário dessa linha conta.
3. A linha de cima só conta quando é um comentário sozinho. Um comentário no fim da linha de cima pertence a outra declaração.

Cada regra existe por um motivo que os testes fixam. "Another library's line with the same version is not this one's" (a linha de outra biblioteca com a mesma versão não é a desta): `other = "2.4.20" # keep` não segura o kotlin. Um comentário sem palavra de retenção, como `# the DI library`, "is only a comment" (é só um comentário). E a mesma verificação funciona para um `// do not upgrade: needs JDK 21` do Gradle e para um `# hold until the 8.0 migration` do Gemfile.

### Onde entra na varredura

`scanGeneric` em `hooks/register.tsx`, a varredura pela qual passam todos os ecossistemas exceto o npm, a chama para cada atualização depois que o registro responde:

```ts
const hold = holdNote(files, [u.name, u.display ?? '', ref ?? ''], u.spec)
u.conflicts = [
  ...(hold ? [`Fijada a propósito: «${hold}»`] : []),
  ...(adapter.conflictsOf?.(u, deps, files) ?? []),
  ...(young.get(u) ?? []),
]
if (u.conflicts.length > 0) u.group = 'blocked'
```

Citado do [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later), com outra formatação. O motivo da retenção vem primeiro, antes do que o ecossistema sabe que quebra e da espera de 24 horas do guia anterior. Qualquer motivo torna a atualização `blocked`, então um patch fixado fica tão bloqueado quanto uma major fixada.

O painel então a desenha como qualquer linha bloqueada: os motivos unidos por `·`, em vermelho, abaixo da biblioteca. Um clique na linha copia o salto com os seus motivos, pronto para colar numa issue.

### Por que o npm fica de fora

`package.json` é JSON, e JSON não tem comentários. `scanNpm` nunca chama `holdNote`, e o README o diz: a verificação roda "en cualquier ecosistema cuyo manifest admite comentarios (todos menos npm, cuyo `package.json` no los tiene)" ("em qualquer ecossistema cujo manifest admite comentários: todos menos o npm, cujo `package.json` não os tem").

O que o npm tem é uma ideia diferente com um nome parecido. As "versões fixadas na árvore" (o guia anterior) são versões exatas que outro pacote instalado exige, lidas de `package-lock.json`, não uma decisão de uma pessoa. Escrever uma versão exata em `package.json` (`"1.2.0"` em vez de `"^1.2.0"`) também não é lido como retenção: o botão de atualização a sobe mesmo assim, passando a nova versão ao gerenciador de pacotes sem prefixo (`rangeFor` em `hooks/npm.ts`, veja o guia 12).

Uma linha do README pode confundir aqui. A sua lista de detalhes diz "Expo, peerDependencies y versiones fijadas se revisan solo en npm" ("Expo, peerDependencies e versões fixadas são verificados só no npm"). Nessa linha, "versões fixadas" significa os pins na árvore do npm, não os comentários deste guia, que são verificados em todo lugar exceto no npm.

### Fixada pela sintaxe, não por um comentário

Dois ecossistemas têm a sua própria forma de dizer "esta versão exata", e o mod também a trata como uma decisão:

- **SwiftPM.** Um requisito escrito com `exact:` em `Package.swift`, ou `exactVersion` num projeto Xcode, define `isExact` na dependência. O `conflictsOf` do adaptador SwiftPM então dá "Fijada a la versión exacta 1.2.0: revisa por qué antes de subirla" ("Fixada na versão exata 1.2.0: verifique por que antes de subi-la"). O motivo do README: "suele ser una decisión a propósito" ("costuma ser uma decisão de propósito").
- **Gradle.** Uma biblioteca que um `gradle.lockfile` segura em outra versão é bloqueada, porque um build com locking a recusa até que o lock seja regenerado com `--write-locks`.

### Por que um comentário, e não um arquivo de configuração

O código e os commits não registram por que a retenção fica nos comentários do manifest e não numa lista própria do mod. Lendo o design: o comentário já é onde as pessoas escrevem esse tipo de decisão, ele viaja com o repositório para todos da equipe e carrega o seu motivo, que é exatamente o que a linha bloqueada precisa mostrar. Uma lista guardada pelo mod ficaria numa única máquina e não diria nada sobre o porquê. Esse raciocínio é uma interpretação, não uma decisão registrada.

## Construa com o Claude

Peça ao Claude uma função pura que encontre um comentário de retenção ao lado da versão de uma dependência e bloqueie essa atualização com o comentário como motivo. A única ideia que ele precisa acertar é qual comentário pertence a qual dependência.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No meu mod do Claude Code `my-panel`, que lista dependências desatualizadas de `Cargo.toml` e `pyproject.toml`, bloqueie qualquer dependência cuja versão seja mantida de propósito por um comentário. Escreva uma função pura `holdNote(files, keys, spec)`: para cada linha que contém a versão `spec` e menciona uma das `keys` como nome inteiro, leia o comentário depois de `#`, `//` ou `<!--` nessa linha, ou na linha de cima só quando essa linha for um comentário sozinho, e devolva-o quando ele contiver uma palavra de retenção (pin, pinned, hold, keep, freeze, "do not upgrade" e as espanholas fijar, fijado, congelado, "no actualizar"), reconhecendo palavras inteiras e ignorando maiúsculas e minúsculas. Coloque uma dependência retida no grupo `blocked` com o motivo "Fixada de propósito: «comentário»", e deixe-a fora do botão "Atualizar tudo". Pule `package.json`, que não tem comentários. Teste que um comentário no fim da linha de cima não conta, que a linha de outra dependência com a mesma versão não conta e que um comentário sem palavra de retenção não bloqueia.

### O que conferir na resposta do Claude

1. A linha precisa conter a versão como está escrita e nomear a dependência como nome inteiro, então outra biblioteca com a mesma versão, ou `kotlin` dentro de `kotlinx`, não conta.
2. Um comentário na linha de cima só conta quando essa linha é um comentário sozinho. Um comentário no fim da linha de cima pertence a outra declaração.
3. As palavras de retenção são reconhecidas como palavras inteiras, ignorando maiúsculas e minúsculas, e um comentário sem palavra de retenção, como `# the DI library`, não bloqueia.
4. Uma dependência retida vai para o grupo bloqueado com o comentário como motivo, e o botão "Atualizar tudo" nunca a pega.
5. `package.json` é pulado, já que JSON não tem comentários.

Se uma verificação falhar, diga ao Claude o que você vê: "o Kotlin está bloqueado por um comentário "pin" escrito na linha do kotlinx-coroutines".

### Como a pessoa autora pediu

O pedido original deste recurso não foi registrado: nenhum registro de tarefas público do narsil-check o cobre. O que segue é uma reconstrução.

#### Reconstrução a partir do histórico de commits

A partir de `git log -S holdNote` e `git log -S lockConflicts` no narsil-check:

- `4ea9be0` (2026-11-04) "feat: block upgrades kept on purpose and Kotlin past its compiler plugins" (bloquear atualizações seguradas de propósito e o Kotlin além dos seus plugins de compilador). O recurso inteiro num commit. A sua mensagem: "A comment with a hold word (pin, hold, keep, freeze, do not upgrade, fijar, congelado, no actualizar) on a version's line, or alone on the line above, blocks that upgrade with the comment as its reason." (um comentário com uma palavra de retenção na linha de uma versão, ou sozinho na linha de cima, bloqueia essa atualização com o comentário como motivo). Ele também renomeou o grupo de "Bloqueada por otras dependencias" ("Bloqueada por outras dependências") para simplesmente **Bloqueada**, "since a dependency is no longer its only reason" (já que uma dependência não é mais o seu único motivo). A mensagem cita o caso em que foi verificado: um template de Kotlin Multiplatform em que o patch do Kotlin agora é bloqueado pelos seus plugins de compilador.
- `7125ffd` (2026-11-09) "fix: stop the upgrade button from breaking builds it cannot check" (impedir que o botão de atualização quebre builds que ele não consegue verificar). Ele adiciona os dois pins pela sintaxe: uma biblioteca do Gradle que um `gradle.lockfile` segura e "a Swift package pinned to an exact version. Neither counts as trivial any more." (um pacote Swift fixado numa versão exata. Nenhum dos dois conta mais como trivial).

O commit junta a verificação de comentários com a regra dos plugins de compilador do Kotlin, e o arquivo de testes que cobre as duas é `tests/holds.test.tsx`. As duas compartilham uma ideia: algumas atualizações parecem triviais pelo número e não são, e o motivo deve ser mostrado em palavras.

## Código de referência

Esta é uma resposta correta, escrita para este guia. Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

Esta é uma versão reduzida da ideia, escrita para este guia. É TypeScript puro, sem API de mod, adaptado de `hooks/adapter.ts` do [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later).

```ts
const HOLD =
  /\b(pin(ned)?|hold|keep|freeze|frozen|do ?n[o']t (upgrade|update|bump)|fij(ar|ad[oa]|o)|congelad[oa]|no (actualizar|subir))\b/i

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function commentOf(line: string): string | undefined {
  const m = /(?:^|\s)(?:#|\/\/|<!--)\s*(.*?)\s*(?:-->)?\s*$/.exec(line)
  return m?.[1]
}

function mentions(line: string, key: string): boolean {
  return new RegExp(`(^|[^\\w.-])${escape(key)}([^\\w.-]|$)`).test(line)
}

// The comment that holds a dependency, from the files of its manifests.
export function holdNote(
  files: Record<string, string>,
  keys: string[],
  spec: string,
): string | undefined {
  for (const text of Object.values(files)) {
    const lines = text.split(/\r?\n/)
    for (let n = 0; n < lines.length; n++) {
      const line = lines[n] ?? ''
      if (!line.includes(spec) || !keys.some((k) => k && mentions(line, k))) continue
      const above = lines[n - 1] ?? ''
      for (const candidate of [line, /^\s*(#|\/\/|<!--)/.test(above) ? above : '']) {
        const comment = commentOf(candidate)
        if (comment && HOLD.test(comment)) return comment
      }
    }
  }
  return undefined
}

// In the scan, after the registry answered:
// const hold = holdNote(files, [dep.name], dep.spec)
// if (hold) { upgrade.conflicts.push(`Pinned on purpose: «${hold}»`); upgrade.group = 'blocked' }
```

Tradução dos comentários para o português: o comentário que segura uma dependência, a partir dos arquivos dos seus manifests; e, na varredura, depois que o registro respondeu.

Passe só os arquivos do ecossistema que está sendo varrido. A verificação `mentions` impede que `kotlin` corresponda a `kotlinx-coroutines`, porque um ponto ou um hífen ao lado do nome indica que ele faz parte de um nome mais longo.

## Erros comuns e como testar

Estes vêm do código e dos testes do Narsil Check:

- **Contar um comentário no fim da linha de cima.** Em `a = "1.0" # keep` seguido de `b = "1.0"`, o comentário é de `a`. Só um comentário sozinho na sua linha fala pela linha seguinte.
- **Reconhecer só a versão.** Duas bibliotecas podem compartilhar a mesma string de versão. A linha também deve nomear a dependência.
- **Reconhecer parte de um nome.** `kotlin` dentro de `kotlinx` é outra biblioteca; o nome deve estar sozinho.
- **Palavras amplas demais.** `keep` também reconhece um comentário como "keep in sync with the server" ("manter em sincronia com o servidor"), o que bloquearia essa biblioteca. Isso decorre da regex; se os seus projetos usam comentários assim, restrinja a lista.
- **Procurar comentários em JSON.** Não há nenhum; não invente uma convenção que o arquivo não consegue carregar, ou documente-a com clareza se o fizer.
- **Esconder o motivo.** O comentário é a coisa mais útil a mostrar: é a própria explicação da pessoa.

Para testar, `claude plugin test .` executa `tests/holds.test.tsx`. "a comment with a hold word on the version line, or the line above, keeps it" (um comentário com uma palavra de retenção na linha da versão, ou na linha de cima, a segura) chama `holdNote` com linhas de TOML, Gradle e Gemfile, incluindo os casos que não devem contar. "a version kept by a comment is blocked with that comment" (uma versão segurada por um comentário é bloqueada com esse comentário) passa pelo painel inteiro com `$.ui.mount`: ele encontra o texto "Fijada a propósito: «keep: 1.11.1 breaks the iOS test runner»" e confere que nenhum botão **Actualizar** é desenhado.

## Para ir além

- Uma retenção poderia ter um fim: "pin until 2027-01" ("fixar até 2027-01") poderia deixar de bloquear depois dessa data. O Narsil Check não faz isso; o comentário segura até que alguém o remova.
- O npm poderia ganhar uma convenção própria, como uma chave sob um campo personalizado em `package.json`. O mod não tem nenhuma, e o README diz claramente que o npm não é verificado.
- O próximo guia lê com o Haiku as notas de versão de um salto de major, que muitas vezes é como alguém encontra, para começar, o motivo para escrever um comentário de retenção.
