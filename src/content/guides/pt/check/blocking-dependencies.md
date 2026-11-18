---
title: Dependências que se bloqueiam
description: 'Como o Narsil Check encontra atualizações npm que não podem subir sozinhas: peers que a nova versão pede, peers que os pacotes instalados pedem e pins exatos na árvore.'
route: check
order: 8
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/npm.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/semver.ts
  - repo: check
    path: hooks/words.ts
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/upgrade.test.tsx
  - repo: check
    path: odd/tasks/ecosystems-wave-2.md
---

## O que faz

Algumas atualizações parecem triviais e não são. Passar o eslint de 9.39 para 10 é uma major sobre a qual você poderia ler e aceitar, mas, se um dos seus plugins do ESLint instalados só aceita o eslint 9, a instalação vai falhar ou deixar um projeto que não passa pelo lint. Um patch pode ser pior: subir um pacote que outro pacote fixa numa única versão exata deixa duas cópias dele instaladas, e algumas ferramentas quebram quando são carregadas duas vezes.

O Narsil Check confere isso antes de oferecer qualquer coisa. Num projeto npm, uma atualização que uma dessas verificações recusa vai para o grupo **Bloqueada**, seja qual for o tamanho do seu salto, com o motivo escrito abaixo dela em vermelho. O botão de atualização, **Actualizar las N**, nunca a inclui.

Os motivos são frases, montadas a partir dos dados, no espanhol do painel:

| Motivo no painel                                                                       | Em português                                                           |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `eslint-plugin-astro 3.2.1 necesita eslint >=10.0.0 (tienes 9.39.5)`                   | A nova versão precisa de um peer que você tem em outra versão.         |
| `eslint-config-love exige eslint ^9.35.0`                                              | Um pacote instalado pede este num intervalo do qual a nova versão sai. |
| `typescript-eslint 8.71.0 fija @typescript-eslint/parser 8.71.0: quedarían dos copias` | Um pacote na árvore fixa a versão antiga: ficariam duas cópias.        |

"necesita" é "precisa de", "tienes" é "você tem", "exige" é "exige", e "fija … quedarían dos copias" é "fixa …, ficariam duas cópias". Esses exemplos são os do próprio README e dos testes, com pacotes públicos conhecidos.

Quando uma atualização tem vários motivos, eles são unidos com `·` na mesma linha. Um clique na linha copia a biblioteca com o seu salto e o que a bloqueia, para que você possa colá-la numa conversa e perguntar como desatar o nó.

Essas verificações existem só para o npm. A seção do README começa com "Solo en npm" ("só no npm"), e os outros ecossistemas bloqueiam pelos seus próprios motivos (o guia anterior os lista).

## Como funciona por dentro

### Três verificações, nas duas direções

A pergunta de design era: o que torna uma versão incapaz de subir sozinha? A resposta em `hooks/npm.ts` são três relações, lidas a partir dos dados e nunca adivinhadas por um modelo:

1. **O que a nova versão pede.** As suas `peerDependencies`, comparadas com o que o projeto tem instalado.
2. **O que os pacotes instalados pedem.** As `peerDependencies` de cada pacote instalado sobre este, comparadas com a nova versão.
3. **O que a árvore fixa.** Qualquer pacote no lockfile que depende deste numa única versão exata que não é a nova.

As duas primeiras são as duas direções da mesma relação, e as duas são necessárias: um plugin que passa a exigir o eslint 10 é pego pela primeira, e um eslint 10 que a sua configuração antiga recusa é pego pela segunda.

### De onde vêm os dados

Para a primeira verificação, o manifesto da nova versão é buscado em `https://registry.npmjs.org/<name>/<version>` (`versionUrl`). `targetPeers` em `hooks/register.tsx` guarda a resposta em `$.store` sob `peers:<name>@<version>` sem expiração porque, como diz o seu comentário, "A version never changes once published, so its answer is kept for good." (uma versão nunca muda depois de publicada, então a sua resposta é guardada para sempre).

Para a segunda, o manifesto instalado de cada dependência declarada é lido de `node_modules/<name>/package.json`. Quando não há `node_modules` (um repositório recém-clonado ou criado a partir de um template), `lockedPackage` lê a mesma informação de `package-lock.json`, ou de `pnpm-lock.yaml` por meio de `pnpmLocked`. Esse fallback chegou em `24dfeb1`, depois que um projeto ainda não instalado "showed no 'exige' blocks, so eslint and typescript upgrades its plugins refuse looked safe" (não mostrava nenhum bloqueio de "exige", então as atualizações de eslint e typescript que os seus plugins recusam pareciam seguras).

Um detalhe que o README não deixa explícito: a segunda verificação lê os peers das dependências **declaradas** do projeto, as que estão no `package.json`, porque `scanNpm` preenche `installedMap` a partir dessa lista. Os intervalos de peers próprios de um pacote transitivo não são comparados. A terceira verificação é a que alcança a árvore inteira.

Para a terceira, `pinConflicts` lê o mapa `packages` do `package-lock.json`, que nas versões 2 e 3 do lockfile lista cada pacote instalado pelo caminho, incluindo os aninhados. O README declara a consequência: "Esta comprobación usa `package-lock.json`, así que con yarn, pnpm o bun no se hace" ("Esta verificação usa `package-lock.json`, então com yarn, pnpm ou bun ela não é feita").

### A verificação de peers

```ts
export function peerConflicts(
  name: string,
  target: Installed,
  installed: Map<string, Installed>,
): string[] {
  const conflicts: string[] = []
  for (const [peer, range] of Object.entries(target.peers)) {
    const have = installed.get(peer)
    if (have && !satisfies(have.version, range))
      conflicts.push(
        `${name} ${show(target.version)} necesita ${peer} ${range} (tienes ${show(have.version)})`,
      )
  }
  for (const [other, have] of installed) {
    if (other === name) continue
    const range = have.peers[name]
    if (range && !satisfies(target.version, range))
      conflicts.push(`${other} exige ${name} ${range}`)
  }
  return conflicts
}
```

Ele é citado do [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Três decisões ficam visíveis nele:

- **Um peer que você não tem não é um conflito.** `have` é `undefined` e nada é adicionado. O comentário: "A peer the project does not have is npm's to add, not a conflict." (um peer que o projeto não tem cabe ao npm adicionar, não é um conflito).
- **Os intervalos são lidos como o npm os lê.** `satisfies` de `hooks/semver.ts` trata `||`, intervalos com hífen, `^`, `~`, versões parciais e `*`, então um intervalo de peer como `^8.57.0 || ^9.0.0 || ^10.0.0` é entendido. Um comparador que ele não consegue ler conta como atendido, "so an unknown range never raises a false alarm" (então um intervalo desconhecido nunca dispara um falso alarme).
- **O motivo nomeia os dois lados.** A primeira forma diz do que a nova versão precisa e o que você tem; a segunda diz quem recusa e o que aceita. Qualquer uma basta para decidir o que subir primeiro.

`installedFromManifest` também registra quais peers o `peerDependenciesMeta` marca como opcionais, mas `peerConflicts` não lê essa lista: um peer opcional que o projeto tem instalado, numa versão fora do intervalo, bloqueia como qualquer outro.

### A verificação de pins

Duas cópias de um pacote costumam ser inofensivas. Não são para um plugin que se registra, ou para um singleton. O comentário do código dá o exemplo do "Cannot redefine plugin" (não é possível redefinir o plugin) do ESLint, e o README dá o caso: `typescript-eslint` 8.71.0 fixa `@typescript-eslint/parser` 8.71.0, então subir só o parser para 8.72.1 faz o ESLint carregar o plugin duas vezes.

`pinConflicts` olha cada pacote no lockfile, em qualquer profundidade, e lê as suas `dependencies` e `optionalDependencies` sobre o pacote que está sendo subido. Ele só informa quando todas estas condições valem:

- o intervalo é um pin exato (`isExactPin`: `8.71.0` ou `=8.71.0`, nada mais);
- a nova versão não o atende;
- o dono não faz parte de uma família que sobe junto (abaixo).

Um intervalo que não é exato, como `^8.53.0`, é deixado de lado: "a nested copy there is usually harmless" (uma cópia aninhada ali costuma ser inofensiva). Essa escolha mantém a verificação silenciosa; um pin é uma declaração deliberada da pessoa autora do pacote, um intervalo não é.

### Famílias que se movem juntas

Algumas famílias publicam todos os membros na mesma versão e se fixam mutuamente nela: `typescript-eslint` com o seu parser e o seu plugin, `@tailwindcss/*` com `tailwindcss`. Subi-los um a um sempre pareceria bloqueado. Subi-los juntos não tem problema, porque todo pin passa para a nova versão de uma vez.

Por isso `pinConflicts` recebe um `batch`: as atualizações triviais que o botão instalaria juntas, por nome e nova versão. Um pin não conta quando o seu dono sobe no batch para a mesma versão. Ele também segue cadeias: o exemplo do comentário é `@tailwindcss/vite`, que fixa `@tailwindcss/node`, que fixa `tailwindcss`. Os pacotes fixados em sincronia por um pacote levado junto também são levados, repetindo até que nada novo seja adicionado.

### Decidir, e depois decidir de novo

O batch depende de quais atualizações são triviais, e quais são triviais depende dos pins. `scanNpm` resolve isso com um laço:

```ts
for (let changed = true; changed;) {
  changed = false
  const batch = new Map(
    upgrades.filter((u) => u.group === 'bump').map((u) => [u.name, u.latest] as const),
  )
  for (const u of upgrades) {
    const own = peers.get(u)
    const version = parseVersion(u.latest)
    if (own === undefined || !version) continue
    u.conflicts = [...own, ...(young.get(u) ?? []), ...pinConflicts(u.name, version, lock, batch)]
    const group = u.conflicts.length > 0 ? 'blocked' : u.bump === 'major' ? 'review' : 'bump'
    if (group !== u.group) {
      u.group = group
      changed = true
    }
  }
}
```

Ele é citado do [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). O comentário acima dele: "a blocked one leaves the batch, which can block a sibling it carried" (uma bloqueada sai do batch, o que pode bloquear uma irmã que ela levava junto). O laço termina quando uma passada não muda nenhum grupo. `young` guarda os motivos da espera de 24 horas, para que eles caiam na mesma lista. As atualizações do grupo do Expo pulam a verificação de peers (`peers` não tem entrada para elas, então o laço também as pula); elas passam por `npx expo install --fix` no lugar.

### Com o que ele compara

As verificações comparam com o que está instalado agora. O README é honesto sobre o limite: "si subes varias juntas, puede que el bloqueo se resuelva entre ellas" ("se você sobe várias juntas, pode ser que o bloqueio se resolva entre elas"). Só a verificação de pins conhece o batch; um conflito de peers entre duas atualizações que subiriam juntas ainda é mostrado. Esse é o lado seguro: o painel pode parar você quando você poderia ter seguido, mas não deixa passar uma atualização que quebra.

## Como foi pedido à IA

O pedido original dessas verificações não foi registrado. Elas já estão no primeiro commit, e nenhum registro de tarefas público as cobre.

### Registrado num registro de tarefas, não com as palavras da pessoa autora

`odd/tasks/ecosystems-wave-2.md` anota uma decisão sobre elas quando os outros ecossistemas chegaram. É uma suposição escrita pelo agente no registro de tarefas, não as palavras da pessoa autora:

> "Assumption: peer dependency and exact-pin checks stay npm-only; Go majors are new module paths (`/v2`), so a Go major is found by probing `<module>/vN/@latest`."

Tradução para o português: "Suposição: as verificações de dependências peer e de pins exatos ficam só no npm; as majors do Go são novos caminhos de módulo (`/v2`), então uma major do Go é encontrada sondando `<module>/vN/@latest`."

É por isso que a seção do README ainda começa com "Solo en npm".

### Reconstrução a partir do histórico de commits

A partir de `git log -- hooks/npm.ts` e de `git log -S` sobre `peerConflicts`, `pinConflicts` e `lockedPackage` no narsil-check:

- `1bf736a` (2026-11-04) "feat: add upgrade panel for npm and Expo projects" (adicionar um painel de atualizações para projetos npm e Expo). A sua mensagem nomeia "upgrades blocked by peer dependencies or exact pins in the lockfile" (atualizações bloqueadas por dependências peer ou por pins exatos no lockfile). `peerConflicts`, `pinConflicts` e o batch em sincronia estão todos neste primeiro commit.
- `a95eb07` (2026-11-04) "refactor: read dependencies through an adapter per ecosystem" (ler as dependências por meio de um adaptador por ecossistema). O npm "keeps what only npm has (Expo, node_modules, peer and pin checks)" (mantém o que só o npm tem: Expo, node_modules, verificações de peers e de pins).
- `4ea9be0` (2026-11-04) "feat: block upgrades kept on purpose and Kotlin past its compiler plugins" (bloquear atualizações seguradas de propósito e o Kotlin além dos seus plugins de compilador). O rótulo do grupo muda de `Bloqueada por otras dependencias` ("Bloqueada por outras dependências") para `Bloqueada`, "since a dependency is no longer its only reason" (já que uma dependência não é mais o seu único motivo).
- `24dfeb1` (2026-11-07) "fix: read peer dependencies from the lockfile when node_modules is missing" (ler as dependências peer do lockfile quando falta o node_modules). A sua mensagem descreve o bug que quem lê não teria notado: um projeto ainda não instalado não mostrava nenhum bloqueio, então as atualizações recusadas "looked safe" (pareciam seguras).

O padrão: as verificações foram projetadas inteiras desde o início, e a única correção foi sobre de onde vêm os dados, não sobre a regra.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No meu mod do Claude Code `my-panel`, antes de marcar uma atualização npm como segura, confira se ela pode subir sozinha. Escreva funções puras em `hooks/npm.ts`. `peerConflicts(name, target, installed)`: para cada entrada de `peerDependencies` da nova versão, se o projeto tem esse peer instalado numa versão fora do intervalo, diga "<name> <version> precisa de <peer> <range> (você tem <version>)"; para cada pacote instalado cujas `peerDependencies` nomeiam este pacote com um intervalo do qual a nova versão sai, diga "<other> exige <name> <range>". Um peer que o projeto não tem não é um conflito. `pinConflicts(name, target, lock)`: para cada pacote em `packages` do `package-lock.json` que depende deste numa versão exata (`1.2.3` ou `=1.2.3`) que a nova não é, diga "<owner> <version> fixa <name> <range>: ficariam duas cópias". Leia os intervalos de versão com um `satisfies` que trate `||`, `^`, `~` e intervalos com hífen e considere atendido o que não consegue ler. No módulo de hooks, busque o manifesto da nova versão em `https://registry.npmjs.org/<name>/<version>` com `$.http.fetch` e guarde-o em `$.store` para sempre. Coloque toda atualização com um motivo num grupo "bloqueada" e imprima os motivos abaixo dela. Teste com manifestos e lockfiles sintéticos.

## O código mínimo

Esta é uma versão reduzida da ideia, escrita para este guia e conferida com os tipos do Claude Code 2.1.325. Foi adaptada de `hooks/npm.ts` e `hooks/register.tsx` do [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Ela trata só intervalos com circunflexo, til, exatos e `>=`, e deixa de fora as famílias que se movem juntas.

A parte pura, `hooks/peers.ts`:

```ts
type V = [number, number, number]
const parse = (t: string): V | undefined => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(t.trim())
  return m ? [+m[1], +m[2], +m[3]] : undefined
}
const cmp = (a: V, b: V) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]

// Enough of npm's ranges for the example: ^, ~, >=, exact, joined by ||.
export function satisfies(version: string, range: string): boolean {
  const v = parse(version)
  if (!v) return true
  return range.split('||').some((part) => {
    const m = /^\s*(\^|~|>=|=)?\s*v?(\d+\.\d+\.\d+)\s*$/.exec(part)
    const b = m && parse(m[2])
    if (!m || !b) return true // a range it cannot read never raises a false alarm
    const atLeast = cmp(v, b) >= 0
    if (m[1] === '>=') return atLeast
    if (m[1] === '~') return atLeast && v[0] === b[0] && v[1] === b[1]
    if (m[1] === '^') return atLeast && (b[0] > 0 ? v[0] === b[0] : v[0] === 0 && v[1] === b[1])
    return cmp(v, b) === 0
  })
}

export type Pkg = { version: string; peers: Record<string, string> }

export function peerConflicts(name: string, target: Pkg, installed: Map<string, Pkg>): string[] {
  const out: string[] = []
  for (const [peer, range] of Object.entries(target.peers)) {
    const have = installed.get(peer)
    if (have && !satisfies(have.version, range))
      out.push(`${name} ${target.version} needs ${peer} ${range} (you have ${have.version})`)
  }
  for (const [other, pkg] of installed) {
    const range = other === name ? undefined : pkg.peers[name]
    if (range && !satisfies(target.version, range)) out.push(`${other} requires ${name} ${range}`)
  }
  return out
}

type Lock = {
  packages?: Record<string, { version?: string; dependencies?: Record<string, string> }>
}

export function pinConflicts(name: string, target: string, lock: Lock): string[] {
  const out: string[] = []
  for (const [path, entry] of Object.entries(lock.packages ?? {})) {
    const owner = path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length)
    const range = entry.dependencies?.[name]
    if (!path.includes('node_modules/') || owner === name || !range) continue
    if (/^=?\d+\.\d+\.\d+$/.test(range.trim()) && !satisfies(target, range))
      out.push(`${owner} ${entry.version ?? ''} pins ${name} ${range}: two copies would remain`)
  }
  return out
}
```

Tradução dos comentários para o português: o suficiente dos intervalos do npm para o exemplo: ^, ~, >=, exato, unidos por ||; e um intervalo que ele não consegue ler nunca dispara um falso alarme.

A parte do módulo de hooks, que busca os peers da nova versão uma única vez:

```ts
import type { EngineInterface } from 'claude-code'
import type { Pkg } from './peers'

export async function targetPeers(
  $: EngineInterface,
  name: string,
  version: string,
): Promise<Pkg | undefined> {
  const key = `peers:${name}@${version}`
  const kept = (await $.store.get(key)) as Pkg | undefined
  if (kept) return kept
  const res = await $.http.fetch(
    `https://registry.npmjs.org/${name.replace('/', '%2F')}/${version}`,
    { headers: { accept: 'application/json' } },
  )
  if (!res.ok) return undefined
  const manifest = JSON.parse(res.text) as { peerDependencies?: Record<string, string> }
  const pkg = { version, peers: manifest.peerDependencies ?? {} }
  await $.store.set(key, pkg)
  return pkg
}
```

Monte `installed` a partir do `node_modules/<name>/package.json` de cada dependência declarada, lido com `$.fs.read`, como `{ version, peers: peerDependencies ?? {} }`. Para cada atualização, junte `peerConflicts` e `pinConflicts` (com o `package-lock.json` interpretado como `lock`); qualquer motivo a torna bloqueada, e os motivos são a sua segunda linha no painel.

## Erros comuns e como testar

Estes vêm do código, do README e dos commits do Narsil Check:

- **Conferir só uma direção.** Os peers da nova versão e os peers dos pacotes instalados são perguntas diferentes; o eslint 10 com uma configuração antiga falha na segunda, um plugin novo com um eslint antigo falha na primeira.
- **Tratar um peer ausente como conflito.** O npm o adiciona. Só um peer que você tem numa versão errada bloqueia.
- **Ler só o `node_modules`.** Um clone recém-feito não tem, e então nada bloqueia. Esse é o bug que `24dfeb1` corrigiu lendo os lockfiles.
- **Marcar toda cópia aninhada.** A maioria é inofensiva. Informe só os pins exatos.
- **Bloquear uma família que se move junta.** Os pins dentro de uma família subida para a mesma versão não têm problema; sem o batch, `typescript-eslint` ou `@tailwindcss/*` pareceriam bloqueados para sempre.
- **Decidir uma única vez.** Bloquear uma atualização a tira do batch e pode bloquear uma irmã; repita o laço até que nenhum grupo mude.
- **Um parser de intervalos rigoroso demais.** Se ele falha em `^8.57.0 || ^9.0.0 || ^10.0.0`, todo plugin parece incompatível. Trate o que você não consegue ler como atendido.
- **Buscar o manifesto da mesma versão a cada varredura.** Uma versão publicada nunca muda; guarde os seus peers para sempre.

Para testar, `tests/upgrade.test.tsx` monta um conjunto instalado com peers sintéticos e confere as frases exatamente: "typescript 7 is blocked by the packages that ask for an older one" (o typescript 7 é bloqueado pelos pacotes que pedem um mais antigo), "eslint 10 is blocked by the configs and plugins that stop at 9" (o eslint 10 é bloqueado pelas configurações e plugins que param no 9), "eslint-plugin-astro 3 is blocked by the eslint it needs" (o eslint-plugin-astro 3 é bloqueado pelo eslint de que precisa) e "an upgrade every peer accepts has no conflicts" (uma atualização que todo peer aceita não tem conflitos). "peer ranges as packages write them" (intervalos de peers como os pacotes os escrevem) fixa `satisfies` em formatos de intervalo do mundo real. Para os pins: "only a range naming one version is an exact pin" (só um intervalo que nomeia uma versão é um pin exato), "a package in the tree that pins the old version leaves two copies" (um pacote na árvore que fixa a versão antiga deixa duas cópias) e "a family that goes up together carries its pins, through its own members too" (uma família que sobe junta leva os seus pins, também através dos seus próprios membros). Pelo painel: "a blocked upgrade shows what blocks it and the button leaves it out" (uma atualização bloqueada mostra o que a bloqueia, e o botão a deixa de fora), "the button leaves out an upgrade a package in the tree pins" (o botão deixa de fora uma atualização que um pacote na árvore fixa), "without node_modules, the lockfiles say what a package asks for" (sem node_modules, os lockfiles dizem o que um pacote pede) e "a pnpm project with no node_modules still blocks an upgrade its installed plugins refuse" (um projeto pnpm sem node_modules ainda bloqueia uma atualização que os seus plugins instalados recusam).

## Para ir além

- A verificação de pins precisa do `package-lock.json`. Ler da mesma forma os pacotes aninhados do `pnpm-lock.yaml` a estenderia aos projetos pnpm, que o README diz que hoje não são cobertos.
- A verificação de peers também poderia aprender sobre o batch, para que duas atualizações que só conflitam com as versões antigas uma da outra sejam oferecidas juntas.
- Copiar uma linha bloqueada dá ao Claude os dois lados do conflito numa linha: um bom começo para perguntar qual pacote subir primeiro.
