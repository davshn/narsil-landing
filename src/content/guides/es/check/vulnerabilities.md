---
title: Vulnerabilidades con OSV.dev
description: 'Cómo Narsil Check consulta a OSV.dev por cada paquete instalado en una sola petición por lotes, clasifica cada aviso por su propia valoración o su vector CVSS y cuenta una vez los avisos gemelos.'
route: check
order: 15
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

## Qué hace

Cada ecosistema tiene su propia herramienta de auditoría: `npm audit`, `pip-audit`, `cargo-audit`, `govulncheck`. Un proyecto con un front end web, un servicio en Python y una app con Gradle necesitaría tres de ellas instaladas, cada una con su propia salida. Narsil Check pregunta a un solo sitio por todas.

Bajo **Actualizaciones** hay una sección **Vulnerabilidades**. Después de cada análisis lee los paquetes instalados del proyecto y pregunta a [OSV.dev](https://osv.dev), la base de datos abierta que reúne los avisos de GitHub, PyPI, Go, crates.io, RubyGems y otros. Mientras trabaja, la sección dice `Buscando vulnerabilidades en OSV.dev…`. Después:

```text
● ▾ Vulnerabilidades · 3
  3 vulnerabilidades en 2 de 412 paquetes · 1 alta · 2 moderadas
  ● ▾ Alta (1)
    left-pad-ish 1.0.2 · indirecta · GHSA-xxxx-xxxx-xxxx
      Prototype pollution in parse()
      Se corrige en 1.0.3
```

El paquete y el identificador de arriba son ilustrativos. Los hallazgos se agrupan por gravedad, **Crítica**, **Alta**, **Moderada**, **Baja** y **Sin clasificar**, y cada grupo se pliega por su cuenta. Cada hallazgo muestra el paquete y la versión, `indirecta` cuando no lo declaras tú, el identificador del aviso, un resumen de una línea y la primera versión que lo corrige, o `Sin versión que la corrija`.

El punto de la sección es rojo para crítica o alta, amarillo para moderada, gris cuando solo quedan hallazgos bajos o sin clasificar, y verde cuando no se encontró nada. La sección se abre sola la primera vez que encuentra algo. Una pulsación en un hallazgo lo copia, con su gravedad, su corrección y su enlace a OSV, listo para pegar en una issue.

La lista de actualizaciones también usa el resultado. Una actualización cuya versión nueva corrige algo lo dice en su fila, `· corrige 2 vulnerabilidades`, y va la primera de su grupo.

## Cómo funciona por dentro

`hooks/osv.ts` es puro: el cuerpo de la petición, la lectura de las respuestas, la gravedad, la versión que corrige, la fusión de gemelos y el texto que se copia. `hooks/register.tsx` reúne los paquetes, descarga, guarda en caché y dibuja. Como en el resto del mod, los tests comprueban las partes difíciles sin red.

### Por qué paquetes se pregunta

`auditedPackages` pregunta al adaptador de cada ecosistema detectado. Donde el adaptador puede leer un lockfile (`treeOf`), da el árbol instalado completo: lo que declaras y lo que traen tus dependencias. El README los enumera: `package-lock.json`, `Cargo.lock`, `uv.lock` o `poetry.lock`, `Gemfile.lock`, `pubspec.lock`, `Package.resolved` y las líneas `require` de `go.mod`, incluidas las indirectas. Donde no hay árbol que leer, como en Maven y NuGet, se usan las dependencias declaradas con su versión instalada o base.

El árbol completo importa. La mayoría de los avisos caen en paquetes que nadie declaró. Un paquete que no es de los tuyos recibe la marca `indirecta`, para que sepas que hará falta actualizar otra cosa.

El wrapper de Gradle se deja fuera: OSV no tiene ecosistema para él, y el comentario del código dice por qué importa: "one unknown name fails the whole batch" (un solo nombre desconocido hace fallar todo el lote).

### Una sola petición por lotes

El endpoint de lotes de OSV, `https://api.osv.dev/v1/querybatch`, acepta muchas preguntas en un solo POST. `batchBody` lo construye:

```json
{
  "queries": [
    { "package": { "name": "left-pad-ish", "ecosystem": "npm" }, "version": "1.0.2" },
    { "package": { "name": "pyyaml", "ecosystem": "PyPI" }, "version": "6.0.1" }
  ]
}
```

Cada ecosistema va con el nombre que usa OSV (`OSV_ECOSYSTEM`): `npm`, `PyPI`, `Go`, `crates.io`, `Pub`, `Maven`, `NuGet`, `RubyGems`, `SwiftURL`, `GitHub Actions`. Un paquete de Swift se nombra por su URL sin el esquema, como `github.com/acme/shop-kit`.

El lote se envía en trozos de 500 (`BATCH_SIZE`); el comentario señala que OSV acepta como mucho 1.000 por lote. Así que "una sola petición" significa una petición para la mayoría de los proyectos, unas pocas para un árbol muy grande, y nunca una petición por paquete.

El lote responde, en el mismo orden que las preguntas, solo el `id` de cada aviso y su fecha `modified`. El registro de tareas lo anotó mientras se probaba: "the batch returns ids only, details come from /v1/vulns/{id}" (el lote devuelve solo ids; los detalles vienen de /v1/vulns/{id}). Así que, para cada paquete con resultados, el mod descarga `https://api.osv.dev/v1/vulns/<id>`, ocho paquetes a la vez (`OSV_CONCURRENCY`).

### La caché de avisos

Los detalles se guardan en `$.store` bajo `osv:<id>`, con la fecha `modified` que dio el lote. La siguiente auditoría vuelve a descargar un detalle solo si OSV dice que cambió. Solo se guardan los campos que lee el panel (identificador, alias, resumen, la primera línea de los detalles, los campos de gravedad y los rangos afectados); el comentario dice por qué: "the full record can hold pages of details" (el registro completo puede contener páginas de detalles).

### Gravedad: primero la palabra del aviso, después CVSS

`severityOf` busca primero una valoración que el aviso exprese con palabras: `database_specific.severity`, y después el mismo campo o `ecosystem_specific.severity` de cada paquete afectado. Los avisos de GitHub llevan `CRITICAL`, `HIGH`, `MODERATE` o `LOW`. `medium` se lee como moderada.

Solo cuando no hay esa palabra calcula una puntuación a partir del vector CVSS del aviso, una cadena como `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H` que describe cómo funciona un ataque: por la red o en local, con qué dificultad, qué privilegios necesita, si una persona usuaria tiene que actuar y cuánto cuesta en confidencialidad, integridad y disponibilidad.

`cvss3Score` no toma una puntuación de ningún sitio: calcula la puntuación base a partir del vector con los pesos y las fórmulas de la especificación CVSS v3.1 de FIRST, incluida su regla de redondeo y las fórmulas distintas cuando cambia el alcance (`S:C`). Después, `severityOfScore` la asigna a las bandas de CVSS: 9,0 o más crítica, 7,0 alta, 4,0 moderada, por encima de 0 baja. El vector de arriba puntúa 9,8, crítica.

Del código se siguen dos límites:

- Solo se leen vectores `CVSS:3.0/` y `CVSS:3.1/`. Un vector `CVSS:4.0/` se salta, y un aviso que solo tiene ese y ninguna palabra queda en **Sin clasificar**.
- Un vector 3.0 se puntúa con las fórmulas de 3.1. Las dos versiones difieren sobre todo en el paso de redondeo, así que en casos raros una puntuación puede diferir en una décima.

¿Por qué primero la palabra? El registro de tareas expone la suposición: "severity comes from the advisory's own rating … and, failing that, from its CVSS v3 vector's base score" (la gravedad sale de la propia valoración del aviso … y, si falta, de la puntuación base de su vector CVSS v3). La valoración de GitHub es la que muestra `npm audit`, así que las dos herramientas coinciden donde se solapan.

### La versión que lo corrige

Un aviso enumera los rangos afectados como eventos: `introduced`, `fixed` y otros. `fixedFor` reúne cada versión `fixed` de este paquete (comparando los nombres como lo hace el ecosistema: PyPI ignora mayúsculas y minúsculas y trata igual `-`, `_` y `.`; NuGet ignora mayúsculas y minúsculas), se queda con las que están por encima de la versión instalada y toma la más baja. Esa es la actualización más pequeña que lo cierra.

### Gemelos: GHSA y PYSEC

El mismo problema de Python suele existir dos veces en OSV: una como aviso de GitHub (`GHSA-…`) y otra en la base de datos de PyPA (`PYSEC-…`), y cada uno enumera al otro en sus `aliases`. Contar los dos duplicaría el número.

`mergeVulns` ordena los avisos de un paquete con GHSA primero y después los recorre. Un aviso cuyo id o alias coincide con el id o los alias de uno ya guardado es un gemelo: se descarta, pero completa lo que le falta al guardado, la gravedad si estaba sin clasificar y la versión que corrige si no había ninguna. El comentario dice por qué gana GHSA: "the GHSA kept for its rating" (se conserva el GHSA por su valoración).

Por eso también el README señala que lo que se cuenta son avisos, no paquetes. `npm audit` cuenta además cada paquete que solo depende de uno vulnerable; aquí no se repiten.

### Qué se envía a OSV.dev, en palabras sencillas

Salen de tu máquina dos tipos de petición, ambas a través de `$.http.fetch`, que los tipos de 2.1.325 describen como una descarga "through the host (never the plugin's own network)" (a través del host, nunca por la red propia del plugin):

- **El lote**, un POST a `api.osv.dev/v1/querybatch` con, para cada paquete, su nombre, su ecosistema y su versión. Ese es todo el cuerpo.
- **Los detalles**, un GET a `api.osv.dev/v1/vulns/<id>` por cada aviso que nombró el lote y que la caché no tiene.

No se envía contenido de archivos, ni rutas, ni el nombre del repositorio, ni código. Pero una lista de nombres y versiones no es nada:

- Describe tu stack, hasta los paquetes transitivos y sus versiones exactas.
- Los nombres pueden ser privados. Un paquete interno de npm `@acme/billing-core`, un módulo de Go `git.acme.example/shop/api` o un paquete de Swift `github.com/acme/private-kit` revela un nombre que quizá no publiques. OSV no lo conocerá, pero el nombre ya salió de la máquina.
- Como en cualquier petición web, OSV ve la dirección desde la que llega.

Para la mayoría de los proyectos es un intercambio aceptable a cambio de una fuente gratuita de avisos. Para un proyecto cuyos propios nombres de dependencias son confidenciales, un mod podría saltarse los nombres que coincidan con un scope privado, o dejar que la persona desactive la auditoría.

### Cuándo se ejecuta

`runAudit` se ejecuta después de cada análisis, en segundo plano para que la lista se muestre primero, y con su propio botón **Consultar de nuevo**, con **Reintentar** después de un error y con `/narsil-check vulns`. Se ejecuta una auditoría a la vez. Un error HTTP del lote muestra `No pude consultar OSV.dev: OSV respondió <status>`.

### README, registro de tareas y código

El README y el registro de tareas dicen "nueve ecosistemas". El código pregunta por diez nombres, todos los adaptadores menos el wrapper de Gradle. El commit que añadió la auditoría (`912478b`) dice "Each severity copies its own list" (cada gravedad copia su propia lista); eso se sustituyó en `b3ad055` por copiar un hallazgo por pulsación, que es lo que hace ahora el código.

## Constrúyelo con Claude

Pídele a Claude una sección que envíe los paquetes instalados a OSV.dev y agrupe lo que vuelve por gravedad. La única idea que debe entender bien es que el trabajo se hace en unas pocas peticiones por lotes, y que la gravedad y la versión que corrige salen de cada aviso.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil Check.

> En mi mod de Claude Code `my-panel`, añade una sección de Vulnerabilidades para proyectos npm. Lee cada paquete instalado y su versión de `package-lock.json` (sus entradas `packages`), marca como indirectos los que no están en `package.json` y envíalos a `https://api.osv.dev/v1/querybatch` con `$.http.fetch`, como `{ queries: [{ package: { name, ecosystem: "npm" }, version }] }`, en trozos de 500. Para cada id que devuelva el lote, descarga `/v1/vulns/<id>` y guárdalo en caché en `$.store` bajo `osv:<id>` con su fecha `modified`, y vuelve a descargarlo solo cuando esta cambie. Clasifica cada aviso primero por `database_specific.severity`; si falta, calcula la puntuación base CVSS v3.1 a partir de su vector y usa las bandas 9, 7, 4. Fusiona los avisos que son alias entre sí y conserva el GHSA. Muestra la versión `fixed` más baja por encima de la instalada. Agrupa por gravedad, la peor primero. Prueba la función CVSS con algunos vectores conocidos y sus puntuaciones publicadas, y el lote con un `http.fetch` simulado.

### Qué revisar en la respuesta de Claude

1. Los paquetes salen del lockfile, todo el árbol instalado, y los que no declaras se marcan como indirectos.
2. Se envían a `https://api.osv.dev/v1/querybatch` en trozos de 500, nunca con una petición por paquete.
3. Cada detalle se descarga de `/v1/vulns/<id>` y se guarda en caché en `$.store` bajo `osv:<id>` con su fecha `modified`, y se vuelve a descargar solo cuando esa fecha cambia.
4. La gravedad es primero la palabra del propio aviso. Solo si no la hay se calcula la puntuación base CVSS v3 y se asigna a las bandas 9, 7 y 4.
5. Los avisos que son alias entre sí (GHSA y PYSEC) cuentan una vez, conservando el GHSA, y la corrección que se muestra es la versión `fixed` más baja por encima de la instalada.

Si una comprobación falla, dile a Claude lo que ves: "el mismo problema de Python aparece dos veces, una con un id GHSA y otra con un id PYSEC".

### Cómo lo pidió el autor

Esta sí quedó registrada. `odd/tasks/vulnerabilities.md` en narsil-check cita las palabras de quien creó Narsil Check en su spec S1 y en su entrada de registro L1 (2026-11-05). La guía 1 de esta ruta cita los mismos dos mensajes para el diseño del panel; aquí importan por el origen de los datos.

#### Registrado: la petición

S1 cita el primer mensaje:

> "podemos checkear vulnerabilidades de la misma forma? es decir crear un sub menu de vulnerabilidades que haga pnpm audit o similar?"

Quien creó Narsil Check pidió "pnpm audit o similar". El registro de tareas recoge que el agente propuso otra cosa, y que quien creó Narsil Check lo aceptó con "si". Con las palabras del agente en la misma spec: "OSV.dev instead of each ecosystem's audit tool; the full tree from the lockfile where one is read, direct dependencies elsewhere" (OSV.dev en lugar de la herramienta de auditoría de cada ecosistema; el árbol completo del lockfile donde se lee uno, las dependencias directas en los demás casos). Esa es la decisión que explica esta guía: una base de datos en lugar de nueve herramientas, la mayoría de las cuales no estaban instaladas en la máquina.

#### Registrado en el registro de tareas: la suposición y las pruebas

Estas son notas del agente, no palabras de quien creó Narsil Check. La suposición de la spec:

> "Assumption: severity comes from the advisory's own rating (GitHub's CRITICAL, HIGH, MODERATE, LOW) and, failing that, from its CVSS v3 vector's base score; a finding with neither is "sin clasificar". Advisories that are the same issue under two ids (GHSA and PYSEC) count once."

En español: suposición: la gravedad sale de la propia valoración del aviso (CRITICAL, HIGH, MODERATE, LOW de GitHub) y, si falta, de la puntuación base de su vector CVSS v3; un hallazgo sin ninguna de las dos es "sin clasificar". Los avisos que son el mismo problema con dos ids (GHSA y PYSEC) cuentan una vez.

La entrada de registro L2 recoge las pruebas que dieron forma al código: un solo lote respondió a la vez npm, PyPI, Go, Maven, NuGet y crates.io; el lote devuelve solo ids; los paquetes de Swift son `SwiftURL` con nombre `github.com/owner/repo`; y en la máquina solo npm y pnpm tenían herramientas de auditoría, "no pip-audit, cargo-audit or govulncheck" (ni pip-audit, ni cargo-audit, ni govulncheck). L3 recoge que en un proyecto real OSV encontró los mismos avisos que informa `npm audit`, que `npm audit` reparte entre más paquetes "because it also names the packages that only depend on them" (porque también nombra los paquetes que solo dependen de ellos).

#### Reconstrucción a partir del historial de commits

A partir de `git log -- hooks/osv.ts` en narsil-check:

- `912478b` (2026-11-04) "feat: check known vulnerabilities with OSV.dev in a collapsible section" (comprobar las vulnerabilidades conocidas con OSV.dev en una sección plegable). Toda la funcionalidad en un solo commit: el lote, la puntuación CVSS, la fusión, la versión que corrige y las marcas en las actualizaciones.
- `b3ad055` (2026-11-06) "feat: fold upgrade and vulnerability groups, copy a row on click, …" (plegar los grupos de actualizaciones y vulnerabilidades, copiar una fila al hacer clic, …). Los grupos de gravedad se pliegan por su cuenta; una pulsación copia un hallazgo.
- `7048580` (2026-11-09) "feat: check the Gradle wrapper and GitHub Actions for upgrades" (buscar actualizaciones del wrapper de Gradle y de GitHub Actions). Su mensaje, sobre el wrapper: "OSV is not asked about it" (no se pregunta a OSV por él).

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Esta es una versión reducida de la idea, escrita para esta guía y comprobada con los tipos de Claude Code 2.1.325 (`$.http.fetch`). Está adaptada de `hooks/osv.ts` y de `auditProject` en `hooks/register.tsx` en [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Deja fuera el cálculo CVSS y la caché.

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

Ejecútala después de tu análisis sin esperarla con await en un hook, guarda su resultado en un atom con un estado `scanning` primero, y dibuja un grupo plegable por gravedad a partir de ese atom.

## Errores comunes y cómo probarlo

Estos salen del código y los tests de Narsil Check:

- **Una petición por paquete.** Un lockfile tiene cientos de paquetes. Agrúpalos en lotes.
- **Un nombre de ecosistema desconocido en el lote.** Hace fallar todo el lote. Deja fuera lo que OSV no conoce.
- **Solo los paquetes declarados.** La mayoría de los avisos están en los transitivos. Lee el lockfile donde lo haya.
- **Confiar en una puntuación guardada.** Los avisos a menudo solo llevan un vector. Calcula la puntuación, y prueba la función con puntuaciones publicadas.
- **Contar dos veces a los gemelos.** GHSA y PYSEC son alias entre sí. Fusiónalos por sus alias.
- **"Se corrige en" como el primer evento `fixed`.** Un aviso puede tener varios rangos. Toma la corrección más baja por encima de lo instalado.
- **Descargar cada detalle cada vez.** Guarda en caché por id y `modified`.
- **Olvidar lo que revela la petición.** Los nombres de paquetes pueden ser privados. Di qué se envía.

Para probarlo, `claude plugin test .` ejecuta `tests/vulns.test.tsx`. "a CVSS v3 vector's base score is FIRST's" (la puntuación base de un vector CVSS v3 es la de FIRST) comprueba la fórmula, "severity is the advisory's own rating, else its CVSS score's band" (la gravedad es la propia valoración del aviso y, si no, la banda de su puntuación CVSS) el orden, "the fixing version is the lowest fixed event past the installed one" (la versión que corrige es el evento fixed más bajo por encima del instalado) la corrección, y "one issue under a GHSA and a PYSEC id counts once, the GHSA kept" (un problema con un id GHSA y otro PYSEC cuenta una vez, y se conserva el GHSA) la fusión. "OSV's batch is asked by each ecosystem's name and answered in order" (al lote de OSV se le pregunta por el nombre de cada ecosistema y responde en orden) comprueba el cuerpo. Con `on('http.fetch', ...)` respondiendo por OSV, "the vulnerabilities section lists findings in folding severity groups, copies one on a press, and marks the upgrade that fixes them" (la sección de vulnerabilidades enumera los hallazgos en grupos de gravedad plegables, copia uno con una pulsación y marca la actualización que los corrige) maneja el panel, y "an advisory read before is not fetched again while OSV says it has not changed" (un aviso leído antes no se vuelve a descargar mientras OSV diga que no ha cambiado) cuenta las peticiones de detalles.

## Para ir más lejos

- Puntúa también los vectores `CVSS:4.0/`. Su fórmula es distinta y más larga; un test con puntuaciones publicadas es imprescindible.
- Deja que la persona excluya del lote los scopes privados, o que desactive la auditoría para un proyecto.
- OSV también tiene un endpoint `/v1/query` que devuelve los avisos completos de un paquete. Para un puñado de paquetes ahorra la segunda ronda de peticiones.
- La siguiente guía cambia de tema: una lista de pendientes por proyecto, fuera de git.
