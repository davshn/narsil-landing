---
title: Vulnerabilidades com o OSV.dev
description: 'Como o Narsil Check pergunta ao OSV.dev sobre cada pacote instalado numa só consulta em lote, classifica cada alerta pela sua própria nota ou pelo vetor CVSS e conta os alertas gêmeos uma vez.'
route: check
order: 14
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/osv.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/words.ts
  - repo: check
    path: hooks/adapter.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/vulns.test.tsx
  - repo: check
    path: odd/tasks/vulnerabilities.md
---

## O que faz

Cada ecossistema tem a sua própria ferramenta de auditoria: `npm audit`, `pip-audit`, `cargo-audit`, `govulncheck`. Um projeto com um front-end web, um serviço Python e um app Gradle precisaria de três delas instaladas, cada uma com a sua saída. O Narsil Check pergunta a um só lugar por todas elas.

Abaixo de **Actualizaciones** há uma seção **Vulnerabilidades**. Depois de cada varredura, ela lê os pacotes instalados do projeto e pergunta ao [OSV.dev](https://osv.dev), o banco de dados aberto que reúne os alertas do GitHub, do PyPI, do Go, do crates.io, do RubyGems e de outros. Enquanto trabalha, a seção diz `Buscando vulnerabilidades en OSV.dev…` ("Buscando vulnerabilidades no OSV.dev…"). Depois:

```text
● ▾ Vulnerabilidades · 3
  3 vulnerabilidades en 2 de 412 paquetes · 1 alta · 2 moderadas
  ● ▾ Alta (1)
    left-pad-ish 1.0.2 · indirecta · GHSA-xxxx-xxxx-xxxx
      Prototype pollution in parse()
      Se corrige en 1.0.3
```

O pacote e o identificador acima são ilustrativos. A linha de resumo diz "3 vulnerabilidades em 2 de 412 pacotes · 1 alta · 2 moderadas". Os achados são agrupados por severidade, **Crítica**, **Alta**, **Moderada**, **Baja** e **Sin clasificar** ("sem classificação"), e cada grupo se recolhe por conta própria. Cada achado mostra o pacote e a versão, `indirecta` (indireta) quando você mesmo não o declara, o identificador do alerta, um resumo de uma linha e a primeira versão que o corrige, ou `Sin versión que la corrija` ("Nenhuma versão a corrige").

O ponto da seção fica vermelho para crítica ou alta, amarelo para moderada, cinza quando só restam achados baixos ou sem classificação, e verde quando nada foi encontrado. A seção se abre sozinha na primeira vez que encontra algo. Um clique num achado o copia, com a sua severidade, a correção e o link do OSV, pronto para colar numa issue.

A lista de atualizações também usa o resultado. Uma atualização cuja nova versão corrige algo diz isso na sua linha, `· corrige 2 vulnerabilidades` ("corrige 2 vulnerabilidades"), e vai primeiro no seu grupo.

## Como funciona por dentro

`hooks/osv.ts` é puro: o corpo da requisição, a leitura das respostas, a severidade, a versão que corrige, a fusão dos gêmeos e o texto de cópia. `hooks/register.tsx` reúne os pacotes, faz as buscas, guarda em cache e desenha. Como no resto do mod, os testes conferem as partes difíceis sem rede.

### Sobre quais pacotes se pergunta

`auditedPackages` pergunta ao adaptador de cada ecossistema detectado. Onde o adaptador consegue ler um lockfile (`treeOf`), ele entrega a árvore instalada inteira: o que você declara e o que as suas dependências trazem. O README as lista: `package-lock.json`, `Cargo.lock`, `uv.lock` ou `poetry.lock`, `Gemfile.lock`, `pubspec.lock`, `Package.resolved` e as linhas `require` do `go.mod`, incluindo as indiretas. Onde não há árvore para ler, como no Maven e no NuGet, usam-se as dependências declaradas com a sua versão instalada ou base.

A árvore completa importa. A maioria dos alertas cai em pacotes que ninguém declarou. Um pacote que não é um dos seus recebe a marca `indirecta`, para que você saiba que vai ser preciso atualizar outra coisa.

O wrapper do Gradle fica de fora: o OSV não tem ecossistema para ele, e o comentário do código diz por que isso importa, "one unknown name fails the whole batch" (um único nome desconhecido faz o lote inteiro falhar).

### Uma consulta em lote

O endpoint de lote do OSV, `https://api.osv.dev/v1/querybatch`, recebe muitas perguntas num só POST. `batchBody` o monta:

```json
{
  "queries": [
    { "package": { "name": "left-pad-ish", "ecosystem": "npm" }, "version": "1.0.2" },
    { "package": { "name": "pyyaml", "ecosystem": "PyPI" }, "version": "6.0.1" }
  ]
}
```

Cada ecossistema vai com o nome que o OSV usa (`OSV_ECOSYSTEM`): `npm`, `PyPI`, `Go`, `crates.io`, `Pub`, `Maven`, `NuGet`, `RubyGems`, `SwiftURL`, `GitHub Actions`. Um pacote Swift é nomeado pela sua URL sem o esquema, como `github.com/acme/shop-kit`.

O lote é enviado em fatias de 500 (`BATCH_SIZE`); o comentário observa que o OSV aceita no máximo 1.000 por lote. Então "uma consulta" significa uma requisição para a maioria dos projetos, algumas para uma árvore muito grande, e nunca uma requisição por pacote.

O lote responde, na mesma ordem das perguntas, só o `id` de cada alerta e a sua data `modified`. O registro de tarefas anotou isso durante as sondagens: "the batch returns ids only, details come from /v1/vulns/{id}" (o lote retorna só ids; os detalhes vêm de /v1/vulns/{id}). Então, para cada pacote com resultados, o mod busca `https://api.osv.dev/v1/vulns/<id>`, oito pacotes de cada vez (`OSV_CONCURRENCY`).

### O cache de alertas

Os detalhes são guardados em `$.store` sob `osv:<id>`, com a data `modified` que o lote deu. A próxima auditoria busca um detalhe de novo só se o OSV disser que ele mudou. Só os campos que o painel lê são guardados (identificador, aliases, resumo, a primeira linha dos detalhes, os campos de severidade e os intervalos afetados); o comentário diz por quê, "the full record can hold pages of details" (o registro completo pode ter páginas de detalhes).

### Severidade: primeiro a palavra do alerta, depois o CVSS

`severityOf` procura primeiro uma classificação que o alerta declara em palavras: `database_specific.severity`, depois o mesmo campo ou `ecosystem_specific.severity` de cada pacote afetado. Os alertas do GitHub trazem `CRITICAL`, `HIGH`, `MODERATE` ou `LOW`. `medium` é lido como moderada.

Só quando não há essa palavra ele calcula uma nota a partir do vetor CVSS do alerta, uma string como `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H` que descreve como um ataque funciona: pela rede ou localmente, com que dificuldade, que privilégios exige, se um usuário precisa agir, e quanto custa em confidencialidade, integridade e disponibilidade.

`cvss3Score` não tira uma nota de lugar nenhum: ele calcula a nota base a partir do vetor com os pesos e as fórmulas da especificação CVSS v3.1 do FIRST, incluindo a sua regra de arredondamento e as fórmulas diferentes quando o escopo muda (`S:C`). Depois, `severityOfScore` a encaixa nas faixas do CVSS: 9.0 ou mais é crítica, 7.0 alta, 4.0 moderada, acima de 0 baixa. O vetor acima tem nota 9.8, crítica.

Dois limites decorrem do código:

- Só vetores `CVSS:3.0/` e `CVSS:3.1/` são lidos. Um vetor `CVSS:4.0/` é pulado, e um alerta que só tem esse e nenhuma palavra fica em **Sin clasificar**.
- Um vetor 3.0 recebe nota com as fórmulas da 3.1. As duas versões diferem principalmente na etapa de arredondamento, então uma nota pode diferir em um décimo em casos raros.

Por que a palavra primeiro? O registro de tarefas declara a suposição: "severity comes from the advisory's own rating … and, failing that, from its CVSS v3 vector's base score" (a severidade vem da própria classificação do alerta … e, na falta dela, da nota base do seu vetor CVSS v3). A classificação do GitHub é o que o `npm audit` mostra, então as duas ferramentas concordam onde se sobrepõem.

### A versão que o corrige

Um alerta lista os intervalos afetados como eventos: `introduced`, `fixed` e outros. `fixedFor` reúne todas as versões `fixed` deste pacote (comparando os nomes como o ecossistema faz: o PyPI ignora maiúsculas e trata `-`, `_` e `.` como iguais, o NuGet ignora maiúsculas), fica com as que estão acima da versão instalada e pega a menor. Essa é a menor atualização que o fecha.

### Gêmeos: GHSA e PYSEC

O mesmo problema de Python muitas vezes existe duas vezes no OSV: uma como alerta do GitHub (`GHSA-…`) e outra no banco de dados da PyPA (`PYSEC-…`), cada um listando o outro nos seus `aliases`. Contar os dois dobraria o número.

`mergeVulns` ordena os alertas de um pacote com os GHSA primeiro e depois os percorre. Um alerta cujo id ou aliases coincidem com o id ou os aliases de um já mantido é um gêmeo: ele é descartado, mas preenche o que falta ao mantido, a severidade se ela estava sem classificação e a versão que corrige se não havia nenhuma. O comentário diz por que o GHSA vence: "the GHSA kept for its rating" (o GHSA é mantido pela sua classificação).

É também por isso que o README observa que a contagem é de alertas, não de pacotes. O `npm audit` também conta cada pacote que só depende de um vulnerável; aqui eles não se repetem.

### O que é enviado ao OSV.dev, em palavras simples

Dois tipos de requisição saem da sua máquina, ambos por `$.http.fetch`, que os tipos da 2.1.325 descrevem como uma busca "through the host (never the plugin's own network)" (pelo host, nunca pela rede do próprio plugin):

- **O lote**, um POST para `api.osv.dev/v1/querybatch` com, para cada pacote, o seu nome, o seu ecossistema e a sua versão. Esse é o corpo inteiro.
- **Os detalhes**, um GET para `api.osv.dev/v1/vulns/<id>` para cada alerta que o lote nomeou e que o cache não tem.

Nenhum conteúdo de arquivo, nenhum caminho, nenhum nome de repositório e nenhum código é enviado. Mas uma lista de nomes e versões não é nada:

- Ela descreve a sua stack, até os pacotes transitivos e as suas versões exatas.
- Os nomes podem ser privados. Um pacote npm interno `@acme/billing-core`, um módulo Go `git.acme.example/shop/api` ou um pacote Swift `github.com/acme/private-kit` revela um nome que você talvez não publique. O OSV não vai conhecê-lo, mas o nome saiu da máquina.
- Como em qualquer requisição web, o OSV vê o endereço de onde ela vem.

Para a maioria dos projetos, essa é uma troca aceitável por uma fonte gratuita de alertas. Para um projeto cujos próprios nomes de dependências são confidenciais, um mod poderia pular os nomes que correspondem a um escopo privado, ou deixar a pessoa desligar a auditoria.

### Quando roda

`runAudit` roda depois de cada varredura, em segundo plano para que a lista apareça primeiro, e também no seu próprio botão **Consultar de nuevo** ("Consultar de novo"), em **Reintentar** ("Tentar de novo") depois de um erro, e com `/narsil-check vulns`. Roda uma auditoria de cada vez. Um erro HTTP do lote mostra `No pude consultar OSV.dev: OSV respondió <status>` ("Não consegui consultar o OSV.dev").

### O README, o registro de tarefas e o código

O README e o registro de tarefas dizem "nueve ecosistemas" ("nove ecossistemas"). O código pergunta sobre dez nomes, todos os adaptadores menos o wrapper do Gradle. O commit que adicionou a auditoria (`912478b`) diz "Each severity copies its own list" (cada severidade copia a sua própria lista); isso foi substituído em `b3ad055` pela cópia de um achado por clique, que é o que o código faz agora.

## Construa com o Claude

Peça ao Claude uma seção que envie os pacotes instalados ao OSV.dev e agrupe o que volta por severidade. A única ideia que ele precisa acertar é que o trabalho acontece em poucas requisições em lote, e que a severidade e a versão que corrige vêm de cada alerta.

### Um prompt que você pode usar

O prompt a seguir foi escrito para este guia como sugestão. Não é o prompt da pessoa autora.

> No meu mod do Claude Code `my-panel`, adicione uma seção de Vulnerabilidades para projetos npm. Leia cada pacote instalado e a sua versão do `package-lock.json` (as suas entradas `packages`), marque como indiretos os que não estão no `package.json` e envie-os para `https://api.osv.dev/v1/querybatch` com `$.http.fetch`, como `{ queries: [{ package: { name, ecosystem: "npm" }, version }] }`, em fatias de 500. Para cada id que o lote retornar, busque `/v1/vulns/<id>` e guarde-o em cache em `$.store` sob `osv:<id>` com a sua data `modified`, buscando de novo só quando ela mudar. Classifique cada alerta primeiro por `database_specific.severity`; se não houver, calcule a nota base CVSS v3.1 a partir do seu vetor e use as faixas 9, 7, 4. Funda os alertas que são aliases uns dos outros, mantendo o GHSA. Mostre a menor versão `fixed` acima da instalada. Agrupe por severidade, da pior para a melhor. Teste a função CVSS contra alguns vetores conhecidos e as suas notas publicadas, e o lote com um `http.fetch` simulado.

### O que conferir na resposta do Claude

1. Os pacotes vêm do lockfile, a árvore instalada inteira, e os que você não declara são marcados como indiretos.
2. Eles vão para `https://api.osv.dev/v1/querybatch` em fatias de 500, nunca uma requisição por pacote.
3. Cada detalhe é buscado em `/v1/vulns/<id>` e guardado em cache em `$.store` sob `osv:<id>` com a sua data `modified`, e buscado de novo só quando essa data muda.
4. A severidade é primeiro a palavra do próprio alerta. Só sem ela a nota base CVSS v3 é calculada e mapeada para as faixas 9, 7 e 4.
5. Alertas que são aliases uns dos outros (GHSA e PYSEC) contam uma vez, mantendo o GHSA, e a correção mostrada é a menor versão `fixed` acima da instalada.

Se uma verificação falhar, diga ao Claude o que você vê: "o mesmo problema do Python aparece duas vezes, uma com um id GHSA e outra com um id PYSEC".

### Como a pessoa autora pediu

Este foi registrado. `odd/tasks/vulnerabilities.md` no narsil-check cita as palavras da pessoa autora na sua spec S1 e na sua entrada de log L1 (2026-11-05). O guia 1 desta trilha cita as mesmas duas mensagens para o design do painel; aqui elas importam pela origem dos dados.

#### Registrado: o pedido

O S1 cita a primeira mensagem:

> "podemos checkear vulnerabilidades de la misma forma? es decir crear un sub menu de vulnerabilidades que haga pnpm audit o similar?"

Tradução para o português: podemos checar vulnerabilidades da mesma forma, ou seja, criar um submenu de vulnerabilidades que rode pnpm audit ou algo parecido?

A pessoa autora pediu "pnpm audit ou algo parecido". O registro de tarefas anota que o agente propôs outra coisa, e a pessoa autora aceitou com "si" ("sim"). Nas palavras do agente na mesma spec: "OSV.dev instead of each ecosystem's audit tool; the full tree from the lockfile where one is read, direct dependencies elsewhere" (o OSV.dev em vez da ferramenta de auditoria de cada ecossistema; a árvore completa do lockfile onde um é lido, as dependências diretas nos outros casos). Essa é a decisão que este guia explica: um banco de dados em vez de nove ferramentas, a maioria das quais não estava instalada na máquina.

#### Registrado no registro de tarefas: a suposição e as sondagens

Estas são as notas do agente, não as palavras da pessoa autora. A suposição da spec:

> "Assumption: severity comes from the advisory's own rating (GitHub's CRITICAL, HIGH, MODERATE, LOW) and, failing that, from its CVSS v3 vector's base score; a finding with neither is "sin clasificar". Advisories that are the same issue under two ids (GHSA and PYSEC) count once."

Tradução para o português: "Suposição: a severidade vem da própria classificação do alerta (CRITICAL, HIGH, MODERATE, LOW do GitHub) e, na falta dela, da nota base do seu vetor CVSS v3; um achado sem nenhuma das duas fica "sin clasificar" (sem classificação). Alertas que são o mesmo problema sob dois ids (GHSA e PYSEC) contam uma vez."

A entrada de log L2 registra as sondagens que deram forma ao código: um lote respondeu npm, PyPI, Go, Maven, NuGet e crates.io juntos; o lote retorna só ids; os pacotes Swift são `SwiftURL` com nome `github.com/owner/repo`; e na máquina só o npm e o pnpm tinham ferramentas de auditoria, "no pip-audit, cargo-audit or govulncheck" (sem pip-audit, cargo-audit nem govulncheck). A L3 registra que num projeto real o OSV encontrou os mesmos alertas que o `npm audit` informa, que o `npm audit` espalha por mais pacotes "because it also names the packages that only depend on them" (porque também nomeia os pacotes que só dependem deles).

#### Reconstrução a partir do histórico de commits

A partir de `git log -- hooks/osv.ts` no narsil-check:

- `912478b` (2026-11-04) "feat: check known vulnerabilities with OSV.dev in a collapsible section" (verificar vulnerabilidades conhecidas com o OSV.dev numa seção recolhível). O recurso inteiro num commit: o lote, a nota CVSS, a fusão, a versão que corrige e as marcas nas atualizações.
- `b3ad055` (2026-11-06) "feat: fold upgrade and vulnerability groups, copy a row on click, …" (recolher os grupos de atualizações e de vulnerabilidades, copiar uma linha com um clique, …). Os grupos de severidade se recolhem por conta própria; um clique copia um achado.
- `7048580` (2026-11-09) "feat: check the Gradle wrapper and GitHub Actions for upgrades" (verificar atualizações do wrapper do Gradle e das GitHub Actions). A sua mensagem diz, sobre o wrapper: "OSV is not asked about it" (não se pergunta ao OSV sobre ele).

## Código de referência

Esta é uma resposta correta, escrita para este guia. Leia-a para entender como as peças se encaixam e para compará-la com o que o Claude escreveu para você: o Claude pode escolher outros nomes ou outra ordem e ainda assim estar certo.

Esta é uma versão reduzida da ideia, escrita para este guia e conferida com os tipos do Claude Code 2.1.325 (`$.http.fetch`). Foi adaptada de `hooks/osv.ts` e de `auditProject` em `hooks/register.tsx` do [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Ela deixa de fora o cálculo do CVSS e o cache.

```ts
import type { EngineInterface } from 'claude-code'

type Pkg = { name: string; version: string; ecosystem: 'npm' | 'PyPI' }
type Severity = 'critical' | 'high' | 'moderate' | 'low' | 'unknown'
type Vuln = { id: string; aliases: string[]; severity: Severity }

const OSV = 'https://api.osv.dev/v1'

function severityOf(advisory: { database_specific?: { severity?: unknown } }): Severity {
  const word = String(advisory.database_specific?.severity ?? '').toLowerCase()
  if (word === 'critical' || word === 'high' || word === 'low') return word
  if (word === 'moderate' || word === 'medium') return 'moderate'
  return 'unknown' // the real mod computes the CVSS v3 score here
}

// Twins alias each other: keep one, the GHSA first.
function merge(vulns: Vuln[]): Vuln[] {
  const out: Vuln[] = []
  const ghsaFirst = [...vulns].sort(
    (a, b) => Number(b.id.startsWith('GHSA-')) - Number(a.id.startsWith('GHSA-')),
  )
  for (const v of ghsaFirst) {
    const names = new Set([v.id, ...v.aliases])
    const twin = out.find((o) => names.has(o.id) || o.aliases.some((a) => names.has(a)))
    if (!twin) out.push(v)
    else if (twin.severity === 'unknown') twin.severity = v.severity
  }
  return out
}

export async function audit($: EngineInterface, packages: Pkg[]): Promise<Map<Pkg, Vuln[]>> {
  const found = new Map<Pkg, Vuln[]>()
  for (let i = 0; i < packages.length; i += 500) {
    const slice = packages.slice(i, i + 500)
    const res = await $.http.fetch(`${OSV}/querybatch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        queries: slice.map((p) => ({
          package: { name: p.name, ecosystem: p.ecosystem },
          version: p.version,
        })),
      }),
    })
    if (!res.ok) throw new Error(`OSV answered ${res.status}`)
    const results = (JSON.parse(res.text).results ?? []) as { vulns?: { id: string }[] }[]
    for (const [j, r] of results.entries()) {
      const vulns: Vuln[] = []
      for (const { id } of r.vulns ?? []) {
        const detail = await $.http.fetch(`${OSV}/vulns/${encodeURIComponent(id)}`)
        if (!detail.ok) continue
        const a = JSON.parse(detail.text)
        vulns.push({
          id,
          aliases: Array.isArray(a.aliases) ? a.aliases : [],
          severity: severityOf(a),
        })
      }
      if (vulns.length > 0) found.set(slice[j] as Pkg, merge(vulns))
    }
  }
  return found
}
```

Rode-a depois da sua varredura sem aguardá-la num hook, guarde o resultado num atom com um estado `scanning` primeiro e desenhe uma seção recolhível por severidade a partir desse atom.

## Erros comuns e como testar

Estes vêm do código e dos testes do Narsil Check:

- **Uma requisição por pacote.** Um lockfile tem centenas de pacotes. Agrupe-os em lote.
- **Um nome de ecossistema desconhecido no lote.** Ele faz o lote inteiro falhar. Deixe de fora o que o OSV não conhece.
- **Só os pacotes declarados.** A maioria dos alertas está nos transitivos. Leia o lockfile onde houver um.
- **Confiar numa nota guardada.** Os alertas muitas vezes trazem só um vetor. Calcule a nota e teste a função contra notas publicadas.
- **Contar os gêmeos duas vezes.** GHSA e PYSEC são aliases um do outro. Funda pelos aliases.
- **"Corrigido em" como o primeiro evento `fixed`.** Um alerta pode ter vários intervalos. Pegue a menor correção acima do que está instalado.
- **Buscar todos os detalhes toda vez.** Guarde em cache por id e `modified`.
- **Esquecer o que a requisição revela.** Os nomes de pacotes podem ser privados. Diga o que é enviado.

Para testar, `claude plugin test .` executa `tests/vulns.test.tsx`. "a CVSS v3 vector's base score is FIRST's" (a nota base de um vetor CVSS v3 é a do FIRST) confere a fórmula, "severity is the advisory's own rating, else its CVSS score's band" (a severidade é a própria classificação do alerta, senão a faixa da sua nota CVSS) a ordem, "the fixing version is the lowest fixed event past the installed one" (a versão que corrige é o menor evento fixed depois da instalada) a correção, e "one issue under a GHSA and a PYSEC id counts once, the GHSA kept" (um problema sob um id GHSA e um PYSEC conta uma vez, mantendo o GHSA) a fusão. "OSV's batch is asked by each ecosystem's name and answered in order" (o lote do OSV é perguntado pelo nome de cada ecossistema e respondido em ordem) confere o corpo. Com `on('http.fetch', ...)` respondendo pelo OSV, "the vulnerabilities section lists findings in folding severity groups, copies one on a press, and marks the upgrade that fixes them" (a seção de vulnerabilidades lista os achados em grupos de severidade recolhíveis, copia um com um clique e marca a atualização que os corrige) conduz o painel, e "an advisory read before is not fetched again while OSV says it has not changed" (um alerta lido antes não é buscado de novo enquanto o OSV disser que ele não mudou) conta as requisições de detalhes.

## Para ir além

- Calcule também a nota de vetores `CVSS:4.0/`. A sua fórmula é diferente e mais longa; um teste contra notas publicadas é essencial.
- Deixe a pessoa excluir escopos privados do lote, ou desligar a auditoria para um projeto.
- O OSV também tem um endpoint `/v1/query` que retorna os alertas completos de um pacote. Para um punhado de pacotes, ele poupa a segunda rodada de requisições.
- O próximo guia muda de assunto: uma lista de pendências mantida por projeto, fora do git.
