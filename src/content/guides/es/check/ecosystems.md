---
title: Un adaptador por ecosistema
description: 'Cómo Narsil Check lee once ecosistemas de paquetes con un contrato pequeño: cada adaptador lee su manifiesto, consulta su registro y dice cómo subir una versión.'
route: check
order: 6
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/adapter.ts
  - repo: check
    path: hooks/ecosystems.ts
  - repo: check
    path: hooks/npm.ts
  - repo: check
    path: hooks/semver.ts
  - repo: check
    path: hooks/toml.ts
  - repo: check
    path: hooks/pypi.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/contract.test.tsx
  - repo: check
    path: tests/pypi.test.tsx
  - repo: check
    path: odd/tasks/ecosystems-wave-2.md
  - repo: check
    path: odd/tasks/ecosystems-wave-3.md
  - repo: check
    path: odd/tasks/ecosystems-wave-4.md
---

## Qué hace

La sección **Actualizaciones** enumera las bibliotecas del proyecto que tienen una versión más nueva, sea cual sea el lenguaje en que está escrito el proyecto. Un repositorio con un front end web y un servicio en Python recibe una sola lista, en la que cada fila nombra su ecosistema al final cuando hay más de uno:

```text
zod 3.22.4 → 3.25.1 · npm
requests 2.31.0 → 2.32.3 · PyPI
```

Para la persona, nada cambia de un lenguaje a otro: los mismos grupos, la misma copia con un clic, el mismo botón que sube las triviales. Detrás de esa igualdad hay un adaptador por ecosistema, y esta guía trata de ese diseño.

Los ecosistemas que lee el mod, tal como aparecen en `ADAPTERS` en `hooks/ecosystems.ts`, en ese orden:

| Adaptador        | Lenguajes             | Lee                                                             | Consulta                               |
| ---------------- | --------------------- | --------------------------------------------------------------- | -------------------------------------- |
| `npm`            | JavaScript, TS (Expo) | `package.json`, `package-lock.json`, `pnpm-lock.yaml`           | registry.npmjs.org                     |
| `pypi`           | Python                | `pyproject.toml`, `requirements.txt`, `uv.lock`/`poetry.lock`   | pypi.org                               |
| `go`             | Go                    | `go.mod`                                                        | proxy.golang.org                       |
| `cargo`          | Rust                  | `Cargo.toml`, `Cargo.lock`                                      | crates.io                              |
| `pub`            | Dart, Flutter         | `pubspec.yaml`, `pubspec.lock`                                  | pub.dev                                |
| `maven`          | Kotlin, Java          | `gradle/libs.versions.toml`, `build.gradle(.kts)`, `pom.xml`    | Maven Central, Google Maven, Plugin P. |
| `gradle-wrapper` | El propio Gradle      | `gradle/wrapper/gradle-wrapper.properties`                      | services.gradle.org                    |
| `nuget`          | C#, F#, VB            | `*.csproj`, `*.fsproj`, `*.vbproj`, `Directory.Packages.props`  | api.nuget.org                          |
| `rubygems`       | Ruby                  | `Gemfile`, `Gemfile.lock`                                       | rubygems.org                           |
| `swiftpm`        | Swift                 | `Package.swift`, `project.pbxproj` de Xcode, `Package.resolved` | las etiquetas git de cada paquete      |
| `actions`        | GitHub Actions        | las líneas `uses:` de `.github/workflows` y `.github/actions`   | las etiquetas git de cada acción       |

Son once adaptadores. La tabla **Ecosistemas** del README tiene las mismas once filas. Su sección de vulnerabilidades habla de "los nueve ecosistemas", y lo mismo hace el registro de tareas de la antigüedad de las versiones ("all nine ecosystems", los nueve ecosistemas): ambos cuentan los ecosistemas de paquetes de aquel momento, antes de que llegaran en `7048580` los adaptadores del wrapper de Gradle y de GitHub Actions.

## Cómo funciona por dentro

### La idea: adaptadores puros, un solo motor

`hooks/adapter.ts` empieza con la regla sobre la que descansa todo el diseño:

> An adapter is pure: the hooks module reads the files it names, fetches the addresses it gives and runs the commands it builds.

(Un adaptador es puro: el módulo de hooks lee los archivos que nombra, consulta las direcciones que da y ejecuta las órdenes que construye.)

Un adaptador nunca llama a `$`. Es un objeto de valores simples y funciones simples: nombres de archivo, constructores de URL, analizadores, constructores de órdenes. El módulo de hooks (`hooks/register.tsx`) es el único sitio que toca el disco, la red o un proceso. Así que hay un motor y muchas descripciones, y cada descripción se puede probar con fixtures de texto y sin ninguna cadena de herramientas.

Ese último punto no era teórico. El registro de tareas de la oleada 2 recoge: "No Python, Cargo or Dart toolchain and no project of those ecosystems on this machine: adapters are checked with fixtures and against the live registries only." (Ni cadena de herramientas de Python, Cargo o Dart ni ningún proyecto de esos ecosistemas en esta máquina: los adaptadores se comprueban solo con fixtures y contra los registros reales.) Un diseño en el que el adaptador ejecutara `cargo` por su cuenta no se habría podido construir en esa máquina.

### Las tres preguntas que responde cada adaptador

El tipo `Adapter` tiene muchos campos, la mayoría opcionales. Los obligatorios responden a tres preguntas.

**1. ¿Qué declara el proyecto, y qué está instalado?**

- `manifests`: los archivos cuya presencia dice que el proyecto usa este ecosistema, en la raíz (`package.json`). `globs` añade manifiestos en cualquier parte del árbol (`**/*.csproj`).
- `lockfiles`: dónde se registran las versiones instaladas.
- `parse(files)`: convierte el texto de esos archivos en una lista de `Dep`, cada uno `{ name, spec, isDev, installed? }`. `spec` es el rango o la versión que escribe el manifiesto (`^18.2.0`, `>=2.31,<3`), `installed` lo que registra un lockfile.

**2. ¿Cuál es la versión publicada más reciente?**

- `latestUrl(name)`: dónde responde el registro, con `headers` que enviar.
- `latestOf(text)`: lee la versión de esa respuesta.

**3. ¿Cómo sube una versión?**

- `installArgv(present, upgrades, files)`: las órdenes que suben las actualizaciones triviales (`npm install …`, `uv lock`, `cargo update -p …`).
- `rewrite(files, upgrades, pins)`, opcional: los archivos que se escriben antes de esas órdenes, para los ecosistemas cuya herramienta no edita el manifiesto por sí misma.
- `managerOf(present)`: el nombre de la herramienta, para la nota del botón.

Todo lo demás es una extensión que necesitó una función posterior, y cada una es una frase en los comentarios del tipo: `releasedUrls` y `releasedOf` para la espera de 24 horas, `repoUrlOf` e `importPattern` para la lectura de una versión mayor por parte de Haiku, `treeOf` para la comprobación de vulnerabilidades, `conflictsOf` para un ecosistema que sabe qué rompe una actualización (Kotlin y sus plugins del compilador). Tres campos existen porque un ecosistema no encajaba:

- `latestCommand` (SwiftPM, GitHub Actions): no hay registro, así que la etiqueta más reciente sale de `git ls-remote --tags --refs` sobre el propio repositorio del paquete.
- `nextMajor` (Go): en Go, una versión mayor a partir de v2 es una ruta de módulo nueva (`/v2`), así que el "latest" del registro nunca sale de la versión mayor actual. El motor pregunta por cada versión mayor siguiente hasta que falta una.
- `alternateUrl` (Maven): un plugin de Gradle publicado como biblioteca está en el Plugin Portal, no en Maven Central, así que un fallo en el primer registro consulta el segundo.

### El registro de ecosistemas

`hooks/ecosystems.ts` es corto. Define el adaptador de npm y los reúne a todos:

```ts
export const ADAPTERS: Adapter[] = [
  NPM,
  PYPI,
  GO,
  CARGO,
  PUB,
  MAVEN,
  GRADLE_WRAPPER,
  NUGET,
  RUBYGEMS,
  SWIFTPM,
  ACTIONS,
]

export function adapterOf(id: Ecosystem): Adapter {
  return ADAPTERS.find((a) => a.id === id) ?? NPM
}
```

Está citado de [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). La unión `Ecosystem` en `types/index.d.ts` enumera los mismos once ids, así que una fila de actualización lleva su ecosistema y el motor vuelve a encontrar su adaptador con `adapterOf`.

La detección es "cada adaptador cuyo manifiesto está presente". `presentOf` en `hooks/register.tsx` comprueba cada manifiesto, lockfile y archivo de contexto con `$.fs.exists`, y para los globs ejecuta `git ls-files --cached --others --exclude-standard`, que enumera lo que git sigue o seguiría y así deja fuera la salida de compilación. Fuera de un repositorio git solo cuentan los manifiestos de la raíz.

### Qué hace el motor con un adaptador

Para cualquier ecosistema que no sea npm, `scanGeneric` es todo el bucle:

1. Lee los archivos presentes con `$.fs.read` (un archivo demasiado grande o ilegible se salta: "the adapter does without it", el adaptador se las arregla sin él).
2. `adapter.parse(files)` da las dependencias declaradas.
3. Para cada una, la versión instalada es `installed`, y si no, la versión desde la que está escrito el rango (`baseOf`).
4. `latestIn` consulta el registro: `$.http.fetch(adapter.latestUrl(name), { headers })`, o `$.process.run(adapter.latestCommand(name))`, y lo lee con `adapter.latestOf`. La respuesta se guarda en `$.store` durante seis horas (la siguiente guía explica la caché).
5. `bumpOf(installed, latest)` de `hooks/semver.ts` dice patch, minor o major, y la actualización cae en su grupo.

El botón de actualización responde a la tercera pregunta: para cada ecosistema con actualizaciones triviales escribe lo que devuelve `rewrite` y después ejecuta cada orden de `installArgv`. Si la herramienta no está en la máquina (`xcodebuild` fuera de un Mac), los archivos reescritos se restauran, "raised manifests would go out with a stale lockfile, so they go back" (los manifiestos subidos saldrían con un lockfile desactualizado, así que se restauran), y los demás ecosistemas suben igualmente.

### npm, el adaptador de referencia

npm fue el primer ecosistema, el único en el primer commit. Cuando llegaron los adaptadores, en `a95eb07`, "npm becomes the first adapter and keeps what only npm has (Expo, node_modules, peer and pin checks)" (npm pasa a ser el primer adaptador y conserva lo que solo tiene npm: Expo, node_modules y las comprobaciones de peers y de pins). Así que npm tiene un adaptador como los demás, que se usa para la detección, el botón, las notas de versión y el árbol de vulnerabilidades, y también un análisis propio, `scanNpm`, para lo que el bucle genérico no conoce.

Sus piezas viven en `hooks/npm.ts` y se montan en `hooks/ecosystems.ts`:

- `parseManifest` lee `dependencies` y `devDependencies`, y gana el primero cuando un nombre está en los dos.
- `lockedVersion` lee `packages["node_modules/<name>"].version` de `package-lock.json` (v2 y v3).
- `latestUrl` consulta `https://registry.npmjs.org/<name>/latest`, "a small document, unlike the package's full record" (un documento pequeño, a diferencia del registro completo del paquete). Un nombre con ámbito conserva su `@` y escapa su barra: `@types%2Fnode`.
- `managerOf` elige npm, pnpm, yarn o bun según el lockfile presente, y gana el primero que se encuentra en `LOCKFILES`.
- `installArgv` construye una orden para las dependencias y otra para las devDependencies, "so each package stays in its own section" (para que cada paquete se quede en su propia sección), y `rangeFor` conserva el prefijo del rango: `^1.2.0` pasa a `^1.4.0`, un pin exacto sigue siendo exacto.

npm no tiene `rewrite`: `npm install name@^1.4.0` escribe `package.json` por sí mismo.

### Versiones: una sola aritmética para todos

`hooks/semver.ts` lo comparten todos los adaptadores. Su `Version` es `{ major, minor, patch, pre, rest? }`. `rest` guarda una cuarta parte y las siguientes, porque RubyGems y NuGet las usan (Rails `8.1.4.1`); llegó con la oleada de Maven en `c50e830`. El patrón también acepta un calificador de Maven después de un punto (`5.6.15.Final`) y una `v` inicial.

Exporta cuatro cosas de las que depende el resto del mod:

- `compare`: major, minor, patch, después las partes extra, y una versión preliminar antes de su versión final.
- `bumpOf`: el tipo de salto, con la regla para las versiones por debajo de 1.0.0 (siguiente guía).
- `baseOf`: la versión desde la que está escrito un rango, `undefined` para lo que no nombra ninguna (`workspace:*`, una URL de git, `latest`).
- `satisfies`: si una versión cumple un rango al estilo de npm, con `||`, rangos con guion, `^`, `~`, versiones parciales y `*`. Su comentario expone una decisión de diseño que vale la pena copiar: "A comparator it cannot read is taken as met, so an unknown range never raises a false alarm." (Un comparador que no sabe leer se da por cumplido, así que un rango desconocido nunca da una falsa alarma.)

### Un pequeño lector de TOML

Cargo, Python y el catálogo de versiones de Gradle escriben TOML. `hooks/toml.ts` es "a small TOML reader" (un pequeño lector de TOML): tablas, arrays de tablas, claves con puntos y entre comillas, los tipos de cadena, números, booleanos, fechas como texto, arrays y tablas en línea. Lanza una excepción ante una entrada mal formada, y quienes lo llaman la capturan (un `uv.lock` ilegible hace que las versiones salgan de los requisitos).

¿Por qué escribir uno? El mod no tiene un `package.json` propio: sus hooks solo importan `claude-code` y sus propios archivos. Cada analizador que necesita, TOML, YAML para `pnpm-lock.yaml` (leído línea a línea en `pnpmLocked`), versiones y rangos, vive en el repositorio. La cabecera del lector enumera archivos de Cargo y de Python; `hooks/maven.ts` también lo importa, para `libs.versions.toml`.

## Constrúyelo con Claude

Pídele a Claude que convierta tu lista de bibliotecas desactualizadas en un solo motor con un adaptador puro por ecosistema. La única idea que debe entender bien es que un adaptador nunca llama a `$`: nombra archivos, construye direcciones y comandos y analiza texto, mientras que el módulo de hooks hace toda la lectura, las descargas y las ejecuciones.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil Check.

> En mi mod de Claude Code `my-panel`, enumero las dependencias de npm desactualizadas. Refactorízalo para que cada ecosistema de paquetes sea un objeto adaptador puro en su propio archivo bajo `hooks/`, sin llamadas a `$`: `id`, `label`, `manifests` (nombres de archivo), `lockfiles`, `parse(files: Record<string, string>)` que devuelva `{ name, spec, isDev, installed? }[]`, `latestUrl(name)`, `latestOf(text)` e `installArgv(present, upgrades)`. Mantén toda la E/S en `hooks/register.tsx`: comprueba qué manifiestos existen con `$.fs.exists`, léelos con `$.fs.read`, consulta `latestUrl` con `$.http.fetch` y ejecuta `installArgv` con `$.process.run`. Haz de npm el primer adaptador sin ningún cambio de comportamiento, demostrado por los tests existentes. Después añade un adaptador de PyPI para `requirements.txt` contra `https://pypi.org/pypi/<name>/json` (`info.version`). Prueba cada adaptador como funciones puras con fixtures de texto y una respuesta sintética del registro.

### Qué revisar en la respuesta de Claude

1. Ningún adaptador llama a `$`. `$.fs.exists`, `$.fs.read`, `$.http.fetch` y `$.process.run` aparecen solo en `hooks/register.tsx`.
2. Cada adaptador tiene `manifests`, `lockfiles`, `parse`, `latestUrl`, `latestOf` e `installArgv`. Un campo que solo necesita un ecosistema es opcional.
3. npm pasa a ser el primer adaptador sin ningún cambio de comportamiento, y los tests que ya existían siguen pasando.
4. Un nombre de npm con scope conserva su `@` y escapa su barra en la URL (`@types%2Fnode`).
5. Cada adaptador se prueba como funciones puras con fixtures de texto y una respuesta de registro sintética, sin instalar la cadena de herramientas de ningún ecosistema.

Si una comprobación falla, dile a Claude lo que ves: "los tests de PyPI fallan en una máquina sin Python, porque el adaptador ejecuta un comando por su cuenta".

### Cómo lo pidió el autor

Los adaptadores se construyeron en tres oleadas el 2026-11-04, cada una con un registro de tareas público en narsil-check. Los registros de tareas recogen las palabras de quien creó Narsil Check, y también el plan que siguieron las oleadas; a continuación se mantienen separados.

#### Registrado: oleada 2

`odd/tasks/ecosystems-wave-2.md`, entrada de registro L1 (2026-11-04), cita a quien creó Narsil Check:

> "camos con la oleada 2", y después "espera primero sube a github - main y luego sigue con la oleada 2".

"camos" es una errata de "vamos".

S1 recoge el plan que siguió la oleada, bajo "The user's request, as wave 2 was planned in this conversation" (la petición del usuario, tal como se planificó la oleada 2 en esta conversación):

> "2. **PyPI, Go, Cargo y Pub.** Tienen registros con APIs JSON sencillas."

El registro no dice quién escribió esa línea del plan. El mismo S1 añade, con las palabras propias del registro de tareas, que "Each ecosystem's adapter follows the shared contract: `detect`, `parse`, `latest`, `importPattern` (the planned contract), plus an install command for the bump group." (El adaptador de cada ecosistema sigue el contrato compartido: `detect`, `parse`, `latest`, `importPattern` (el contrato planificado), más una orden de instalación para el grupo de subida.) El contrato que se publicó llamó a esos pasos `manifests`, `parse`, `latestUrl`/`latestOf` e `installArgv`. Su suposición declarada: "peer dependency and exact-pin checks stay npm-only" (las comprobaciones de dependencias peer y de pins exactos se quedan solo en npm).

#### Registrado: oleada 3

`odd/tasks/ecosystems-wave-3.md`, L1 (2026-11-04), cita a quien creó Narsil Check: "dale a la oleada 3". Su S1 recoge el plan:

> "3. **Maven (Kotlin/Java), NuGet y RubyGems.** Gradle es lo más difícil de leer, porque `build.gradle.kts` es código. Leería el catálogo de versiones con exactitud y los `build.gradle.kts` lo mejor posible."

La primera persona ("Leería") parece una propuesta que quien creó Narsil Check aceptó después con "dale a la oleada 3"; el registro no dice más.

Ese plan es la razón de que el README diga que una versión de Gradle guardada en una variable "es código y queda fuera".

#### Registrado: oleada 4

`odd/tasks/ecosystems-wave-4.md`, L1 (2026-11-04), cita a quien creó Narsil Check: "dale a la oleada 4". Su S1 recoge el plan:

> "4. **SwiftPM.** Lo dejo para el final porque depende de la API de GitHub, que tiene límite de peticiones."

Aquí el plan cambió por el camino. La suposición del registro de tareas: "tags are read with `git ls-remote --tags --refs <url>` instead of the GitHub API, which has no request limit and works for any git host" (las etiquetas se leen con `git ls-remote --tags --refs <url>` en lugar de con la API de GitHub, lo que no tiene límite de peticiones y funciona con cualquier servidor git). Ahí es donde el contrato obtuvo `latestCommand`, en `8444155` "feat: let an adapter answer its latest version with a command" (permitir que un adaptador responda su versión más reciente con una orden).

#### Reconstrucción a partir del historial de commits

La oleada 1, solo npm, no tiene registro de tareas, así que su petición no quedó registrada. A partir de `git log -- hooks/adapter.ts hooks/ecosystems.ts hooks/toml.ts hooks/semver.ts`:

- `1bf736a` (2026-11-04) "feat: add upgrade panel for npm and Expo projects" (añadir un panel de actualizaciones para proyectos npm y Expo). Llegan `semver.ts` y `npm.ts`; todavía no hay adaptadores.
- `a95eb07` (2026-11-04) "refactor: read dependencies through an adapter per ecosystem" (leer las dependencias mediante un adaptador por ecosistema). El contrato, con npm como primer adaptador "with no change in behaviour" (sin ningún cambio de comportamiento), como dice el registro de la oleada 2 para T1.
- `bbe6519`, `8ae479e`, `90f8502`, `503ba95` (2026-11-04): Cargo (con `toml.ts`), PyPI, Go y Pub, un commit cada uno.
- `c50e830` (2026-11-04) "feat: find manifests anywhere in the tree and read four-part versions" (encontrar manifiestos en cualquier parte del árbol y leer versiones de cuatro partes): el contrato añade `globs` y `Version.rest` antes de Maven, NuGet y RubyGems (`4f9b8ea`, `1362623`, `06bcc49`).
- `8444155` y `83c0029` (2026-11-04): `latestCommand`, y después SwiftPM.
- `1492ca5` (2026-11-06) "feat: hold every ecosystem's upgrades for 24 hours after release" (retener las actualizaciones de cada ecosistema durante 24 horas después de su publicación): `releasedUrls` y `releasedOf` en todos los adaptadores.
- `7048580` (2026-11-09) "feat: check the Gradle wrapper and GitHub Actions for upgrades" (buscar actualizaciones del wrapper de Gradle y de GitHub Actions): los adaptadores décimo y undécimo.

El patrón: primero convertir el ecosistema existente en un adaptador sin cambiar su comportamiento, después añadir un ecosistema por commit, y hacer crecer el contrato con un campo opcional cada vez que un ecosistema no encaja.

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Esta es una versión reducida de la idea, escrita para esta guía y comprobada con los tipos de Claude Code 2.1.325. Está adaptada de `hooks/adapter.ts`, `hooks/npm.ts` y `hooks/register.tsx` en [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Lee las versiones solo del manifiesto, sin lockfile.

El contrato y el adaptador de npm, `hooks/adapter.ts`:

```ts
export type Dep = { name: string; spec: string; isDev: boolean }
export type Files = Record<string, string>

export type Adapter = {
  id: string
  manifests: string[]
  parse: (files: Files) => Dep[]
  latestUrl: (name: string) => string
  latestOf: (text: string) => string | undefined
  installArgv: (upgrades: { name: string; latest: string; isDev: boolean }[]) => string[][]
}

export const NPM: Adapter = {
  id: 'npm',
  manifests: ['package.json'],
  parse: (files) => {
    const json = JSON.parse(files['package.json'] ?? '{}') as Record<string, Record<string, string>>
    return (['dependencies', 'devDependencies'] as const).flatMap((field) =>
      Object.entries(json[field] ?? {}).map(([name, spec]) => ({
        name,
        spec,
        isDev: field === 'devDependencies',
      })),
    )
  },
  latestUrl: (name) => `https://registry.npmjs.org/${name.replace('/', '%2F')}/latest`,
  latestOf: (text) => (JSON.parse(text) as { version?: string }).version,
  installArgv: (upgrades) =>
    [false, true]
      .map((isDev) =>
        upgrades.filter((u) => u.isDev === isDev).map((u) => `${u.name}@^${u.latest}`),
      )
      .flatMap((names, i) =>
        names.length ? [['npm', 'install', ...(i ? ['--save-dev'] : []), ...names]] : [],
      ),
}

export const ADAPTERS: Adapter[] = [NPM]
```

El motor, en `hooks/register.tsx`:

```tsx
import type { EngineInterface } from 'claude-code'
import { ADAPTERS } from './adapter'
import type { Adapter } from './adapter'

const major = (v: string) => Number(/\d+/.exec(v)?.[0] ?? 0)
const clean = (spec: string) => /\d+(\.\d+){0,2}/.exec(spec)?.[0]

export async function scan($: EngineInterface) {
  const rows: { ecosystem: string; name: string; from: string; to: string; isMajor: boolean }[] = []
  for (const adapter of ADAPTERS) {
    const files: Record<string, string> = {}
    for (const path of adapter.manifests)
      if (await $.fs.exists(path)) files[path] = await $.fs.read(path)
    if (Object.keys(files).length === 0) continue
    for (const dep of adapter.parse(files)) {
      const from = clean(dep.spec)
      if (!from) continue
      const res = await $.http.fetch(adapter.latestUrl(dep.name), {
        headers: { accept: 'application/json' },
      })
      const to = res.ok ? adapter.latestOf(res.text) : undefined
      if (to && to !== from)
        rows.push({
          ecosystem: adapter.id,
          name: dep.name,
          from,
          to,
          isMajor: major(to) !== major(from),
        })
    }
  }
  return rows
}
```

Llama a `scan` desde una función que ningún hook espere con await, guarda las filas en un atom y dibújalas en el panel. El motor reducido trata cualquier versión distinta como más nueva y cualquier cambio de la versión mayor como major; Narsil Check compara con `compare` y `bumpOf` de `hooks/semver.ts`, lee la versión instalada del lockfile, consulta hasta ocho bibliotecas a la vez y guarda las respuestas en caché.

### Ejercicio: añadir PyPI

Añade un segundo adaptador, `PYPI`, a `ADAPTERS` sin tocar `scan`. Necesita:

- `manifests: ['requirements.txt']`.
- `parse`: una dependencia por línea, saltando comentarios y líneas de opciones (`-r`, `--index-url`), el nombre antes del primer operador (`==`, `>=`, `~=`) y el resto como `spec`.
- `latestUrl`: `https://pypi.org/pypi/<name>/json`.
- `latestOf`: `info.version` de ese JSON.
- `installArgv`: `[]` cuando no hay lockfile, ya que reescribir `requirements.txt` es toda la actualización (eso es también lo que hace Narsil Check: "con solo `requirements.txt` no hay lockfile, así que el botón reescribe los pins y no instala nada"). Tu contrato necesita entonces un `rewrite`.

Cuando funcione, compáralo con la respuesta de referencia, `hooks/pypi.ts` en narsil-check. Muestra lo que añade un adaptador real: la normalización de nombres de PEP 503 (`Foo_Bar` y `foo-bar` son un mismo paquete), extras y marcadores de PEP 508 (`Django[argon2]~=4.2 ; python_version > '3.8'`), `pyproject.toml` leído con `parseToml`, versiones instaladas a partir de `uv.lock` o `poetry.lock`, un `rewrite` que sube solo la primera versión y conserva un límite superior (`>=2.31,<3` pasa a `>=2.34.2,<3`), y una tabla de nombres de importación para Haiku (`pyyaml` se importa como `yaml`).

## Errores comunes y cómo probarlo

Estos salen del código y los registros de tareas de Narsil Check:

- **Dejar que el adaptador haga E/S.** Entonces no se puede probar sin las herramientas del ecosistema. Mantenlo puro, y deja que el motor lea, consulte y ejecute.
- **Un adaptador que sabe demasiado.** La lógica de Expo, peers y pins de npm se quedó en el análisis propio de npm. Un campo que solo necesita un ecosistema es opcional, nunca obligatorio para todos.
- **Nombres con ámbito y especiales.** El `@scope/name` de npm debe escapar su barra en la URL. PyPI compara los nombres normalizados. Las versiones mayores de Go son otras rutas.
- **Fiarse de "latest".** El `<release>` de Maven puede ser una versión preliminar (el registro de la oleada 3 encontró `2.12.0-alpha05`), así que el máximo estable sale de la lista completa.
- **Registros con reglas propias.** crates.io rechaza una petición sin User-Agent, como dice un comentario en `hooks/cargo.ts`, así que su adaptador envía uno en `headers`.
- **Reescribir más que la versión.** Un `rewrite` que vuelve a formatear un manifiesto produce un diff ruidoso. Las reescrituras de Narsil Check cambian la versión y dejan "every other byte as it was" (todos los demás bytes como estaban).
- **Un test que simula todos los procesos.** El registro de la oleada 3 recoge "A test mock that simulated the npm install on every process call broke once the scan began calling git ls-files" (un mock de test que simulaba el npm install en cada llamada a un proceso se rompió en cuanto el análisis empezó a llamar a git ls-files). Responde solo a las órdenes de las que trata el test.

Para probarlo, `tests/contract.test.tsx` comprueba las piezas compartidas: "a version may have a fourth part, and it counts" (una versión puede tener una cuarta parte, y cuenta), "a glob matches at any depth with \*\*/ and within one directory with \*" (un glob coincide a cualquier profundidad con \*\*/ y dentro de un directorio con \*), "the manifests are the root ones and the globbed ones, never a lockfile" (los manifiestos son los de la raíz y los encontrados por glob, nunca un lockfile). Cada ecosistema tiene su propio archivo; `tests/pypi.test.tsx` tiene "a PEP 508 requirement is a name and its specifier, without extras or markers" (un requisito de PEP 508 es un nombre y su especificador, sin extras ni marcadores), "raising a requirement keeps its operators and upper bound, and every other byte" (subir un requisito conserva sus operadores y su límite superior, y todos los demás bytes), "PyPI's answer gives the latest release and the GitHub repository" (la respuesta de PyPI da la versión más reciente y el repositorio de GitHub) y, a través del panel, "a uv project lists its packages and the button raises pyproject.toml and runs uv lock" (un proyecto uv enumera sus paquetes y el botón sube pyproject.toml y ejecuta uv lock) y "a project with two ecosystems names each library's" (un proyecto con dos ecosistemas nombra el de cada biblioteca).

## Para ir más lejos

- La siguiente guía sigue una actualización desde `bumpOf` hasta su grupo, y explica la caché de seis horas que usa `latestIn`.
- Los campos opcionales de los adaptadores son un mapa de las funciones posteriores del mod: lee `releasedUrls` para la espera de 24 horas, `treeOf` para las vulnerabilidades, `conflictsOf` para Kotlin Multiplatform.
- Un ecosistema sin registro no es un callejón sin salida: `latestCommand` deja que responda una orden de git, como hacen SwiftPM y GitHub Actions.
