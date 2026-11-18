---
title: Actualizar las triviales
description: 'Cómo el botón Actualizar las N sube a la vez cada patch y minor, conservando su operador de rango y su sección, y después ejecuta la herramienta de instalación de cada ecosistema.'
route: check
order: 13
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/adapter.ts
  - repo: check
    path: hooks/npm.ts
  - repo: check
    path: hooks/pypi.ts
  - repo: check
    path: hooks/cargo.ts
  - repo: check
    path: hooks/pub.ts
  - repo: check
    path: hooks/rubygems.ts
  - repo: check
    path: hooks/words.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/upgrade.test.tsx
  - repo: check
    path: odd/tasks/release-age-all-ecosystems.md
---

## Qué hace

La mayor parte de una lista de desactualizadas son patches y minors que nada bloquea. Subirlos uno a uno es tedioso, y es donde se cuelan los errores: un `^` perdido, una herramienta de desarrollo movida a `dependencies`, un lockfile sin refrescar. Narsil Check los hace de una sola pulsación.

Bajo el grupo **Solo subir la versión** hay un botón, **Actualizar las N**, o **Actualizar esta librería** cuando hay una sola. Mientras se ejecuta, el panel dice `Actualizando 6 librerías con npm…` y el botón desaparece. Cuando termina, un toast dice `Actualicé 6 librerías con npm.` y el panel añade un recordatorio:

```text
Actualicé 6 librerías. Ejecuta los tests antes de hacer commit.
```

Después se vuelve a analizar la lista, desde los registros, así que lo que ves es lo que ahora es cierto.

Cada biblioteca conserva la forma que tenía. El README da los ejemplos: `^3.22.0` pasa a `^3.25.1`, y `>=2.31,<3` pasa a `>=2.34.2,<3`. Una dependencia de desarrollo sigue siendo una dependencia de desarrollo.

### Qué significa "trivial" aquí

Solo sube el grupo `bump`: un salto de patch o minor (según la regla de 0.x de la guía 7) sin ningún motivo de bloqueo. Las versiones mayores, los módulos fijados por el SDK de Expo y todo lo que esté en **Bloqueada** nunca se tocan. El README tiene cuidado con la palabra: "'Trivial' solo significa que el salto no es mayor y que no choca con lo que el panel sabe: no garantiza que el proyecto compile." Por eso el último mensaje te pide que ejecutes los tests.

## Cómo funciona por dentro

### Un plan por ecosistema

`upgradeBumps` en `hooks/register.tsx` toma las filas `bump` del último análisis, las agrupa por ecosistema y ejecuta cada ecosistema con su propia herramienta. Una segunda pulsación mientras uno se ejecuta no hace nada: primero se comprueba el estado `running` de la tarea.

Para cada ecosistema los pasos son los mismos, y cada uno sale del contrato del adaptador en `hooks/adapter.ts`:

1. **Leer los archivos** que enumera el adaptador (los manifests y lockfiles que existen).
2. **Resolver los pins** cuando la reescritura necesita que un comando diga algo primero (`pinCommand`): las GitHub Actions fijadas a un commit necesitan el commit de la etiqueta nueva. Si no se puede leer uno, ese ecosistema se salta y sus archivos no se escriben.
3. **Reescribir** los manifests (`rewrite`), cuando el ecosistema lo reescribe el mod.
4. **Instalar** con los comandos que construye `installArgv`.

### npm: el gestor de paquetes escribe `package.json`

npm no tiene `rewrite`. El mod construye el comando de instalación y deja que el gestor de paquetes edite `package.json` y el lockfile. Qué gestor se usa lo decide el lockfile presente: `pnpm-lock.yaml`, `yarn.lock`, `bun.lock` o `bun.lockb`, y si no, npm.

El rango sale de `rangeFor` en `hooks/npm.ts`:

```ts
export function rangeFor(spec: string, latest: string): string {
  const prefix = /^(\^|~)/.exec(spec.trim())?.[1] ?? ''
  return `${prefix}${latest}`
}
```

Y la sección, de `installArgv`, que hace un comando para `dependencies` y otro para `devDependencies`:

```ts
for (const isDev of [false, true]) {
  const names = upgrades
    .filter((u) => u.isDev === isDev)
    .map((u) => `${u.name}@${rangeFor(u.spec, u.latest)}`)
  if (names.length > 0) argv.push([manager, ...add, ...(isDev ? [dev] : []), ...names])
}
```

Los dos están citados de [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). `add` es `install` para npm y `add` para los demás; `dev` es `--save-dev` para npm y `-D` para los demás. El test "dependencies and devDependencies install in their own sections" (dependencies y devDependencies se instalan en sus propias secciones) espera, para tres actualizaciones:

```text
npm install a@^1.1.0 c@^1.1.0
npm install --save-dev b@^1.1.0
```

Conviene conocer dos consecuencias de `rangeFor`. Solo se conservan `^` y `~`: cualquier otro prefijo, como `>=`, se descarta y la versión entra sola. Y para una versión sin prefijo, lo que acaba en `package.json` es decisión del propio gestor de paquetes; el código pasa la versión sola, y los tests comprueban el comando, no el archivo escrito. Si tu proyecto depende de versiones exactas, revisa el resultado o activa la opción propia del gestor para guardar versiones exactas.

### Los demás ecosistemas: reescribir la línea, conservar cada byte restante

Todos los demás ecosistemas reescriben su manifest por su cuenta, línea a línea, y solo cambian la versión. Cada adaptador tiene una pequeña función que cambia la primera versión de un requisito y conserva su operador; PyPI y Pub también conservan un límite superior:

| Ecosistema | Función        | Ejemplo de su comentario o sus tests             |
| ---------- | -------------- | ------------------------------------------------ |
| PyPI       | `pySpecFor`    | `>=2.31,<3` → `>=2.34.2,<3`                      |
| Cargo      | `cargoSpecFor` | conserva `^`, `~`, `=` o `>=`; descarta el resto |
| Pub        | `pubSpecFor`   | `>=1.0.0 <2.0.0` → `>=1.6.0 <2.0.0`              |
| RubyGems   | `gemSpecFor`   | conserva `~>`, `>=` y similares                  |

Como la línea se edita donde está, la sección nunca cambia: un crate bajo `[dev-dependencies]` se queda ahí, un paquete de Python en `requirements-dev.txt` se queda ahí. El `rewriteCargo` de Cargo incluso sigue la cabecera de tabla en la que está, así que solo toca líneas bajo `[dependencies]`, `[dev-dependencies]`, `[build-dependencies]` (y sus formas `target`) o la propia tabla `[dependencies.<name>]` de un crate. Sus comentarios describen el objetivo de la misma forma: "every other byte as it was" (cada byte restante como estaba).

¿Por qué reescribir en lugar de llamar al comando "add" de cada herramienta? El código no lo dice en un solo sitio, pero los comentarios muestran el razonamiento: una reescritura conserva el formato, los comentarios y el estilo de rango de la persona, y funciona igual esté o no instalada la herramienta. La herramienta se usa después solo para lo que solo ella puede hacer, el lockfile.

### Ejecutar la instalación después

Sí, el mod la ejecuta. El `installArgv` de cada adaptador dice qué, según la tabla del README y el código:

| Ecosistema                            | Después de la reescritura                                          |
| ------------------------------------- | ------------------------------------------------------------------ |
| npm                                   | `npm install` / `pnpm add` / `yarn add` / `bun add`, como arriba   |
| PyPI                                  | `uv lock` o `poetry lock`; con solo `requirements.txt`, nada       |
| Go                                    | `go get <module>@<version>` y `go mod tidy` (sin reescritura)      |
| Cargo                                 | `cargo update -p <crate>` para cada uno                            |
| Pub                                   | `flutter pub get` o `dart pub get`                                 |
| NuGet                                 | `dotnet restore`                                                   |
| RubyGems                              | `bundle update --conservative <gems>`                              |
| SwiftPM                               | `swift package update`, o `xcodebuild -resolvePackageDependencies` |
| Maven, Gradle wrapper, GitHub Actions | nada: la siguiente compilación o ejecución lo descarga             |

Con solo `requirements.txt`, el README lo dice: no hay lockfile, así que el botón reescribe los pins y "no instala nada"; la instalación la haces tú en tu propio entorno.

npm y pnpm se ejecutan bajo la espera de 24 horas de la guía 9, a través del entorno que construye `releaseAgeEnv` y del campo `env` de `$.process.run` (en los tipos, "Variables set over the host process's own environment", variables definidas sobre el propio entorno del proceso host). Una dependencia reciente en cualquier parte del árbol hace fallar la instalación en lugar de acabar en el lockfile.

### Cuando algo falla

Tres casos, cada uno tratado de forma distinta en `upgradeBumps`:

- **La herramienta no está en esta máquina** (`xcodebuild` fuera de un Mac, `cargo` sin instalar: la ejecución se rechaza con `ENOENT`). Los archivos reescritos de ese ecosistema se vuelven a escribir como estaban, para que un manifest subido nunca salga con un lockfile desfasado, y los demás continúan. El panel dice cuál se quedó, por ejemplo "Cargo quedó sin actualizar (2 librerías): no pude ejecutar cargo en este equipo y dejé sus archivos como estaban."
- **La herramienta se ejecuta y falla.** El panel muestra el comando, su código de salida y el final de su salida, o el propio mensaje de la espera cuando pnpm o npm rechazaron una versión reciente, y vuelve a analizar. Los ecosistemas posteriores no se intentan, y los archivos ya reescritos se quedan; `git diff` los muestra.
- **Cualquier otra cosa lanza una excepción.** "No pude ejecutar …" con el error.

## Constrúyelo con Claude

Pídele a Claude un solo botón que suba de una vez todas las actualizaciones seguras. La única idea que debe entender bien es qué significa «seguras» aquí: solo suben los saltos patch y minor que nada bloquea, cada rango conserva su prefijo y cada biblioteca se queda en su sección.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil Check.

> En mi mod de Claude Code `my-panel`, añade un botón "Actualizar todas" bajo las actualizaciones de npm que son un patch o un minor y no están bloqueadas. Elige el gestor de paquetes según el lockfile (pnpm, yarn, bun, y si no, npm). Conserva el prefijo de cada rango: `^1.2.0` con la última 1.4.0 pasa a `^1.4.0`, `~` sigue siendo `~`, sin prefijo sigue sin prefijo. Ejecuta un comando para `dependencies` y otro con `--save-dev` (o `-D`) para `devDependencies`, con `$.process.run` y un tiempo límite. Mientras se ejecuta, oculta el botón y muestra "Actualizando N bibliotecas con <manager>…"; una segunda pulsación no debe hacer nada. Con un código de salida distinto de cero, muestra el comando, su código de salida y las últimas líneas de stderr. Si sale bien, muestra un toast "Actualicé N bibliotecas" y di "Ejecuta los tests antes de hacer commit". Vuelve a analizar desde los registros en cualquier caso. Prueba que los comandos para tres actualizaciones, una de ellas de desarrollo, son exactamente dos, y que una actualización bloqueada o mayor nunca está en ellos.

### Qué revisar en la respuesta de Claude

1. Solo se instala el grupo `bump`. Las actualizaciones mayores y las bloqueadas nunca están en los comandos.
2. Cada rango conserva su prefijo `^` o `~`: `^3.22.0` pasa a `^3.25.1`.
3. Hay un comando para `dependencies` y otro con `--save-dev` (o `-D`) para `devDependencies`, y el gestor de paquetes se elige según el lockfile.
4. Mientras se ejecuta, el botón está oculto y una segunda pulsación no hace nada.
5. Un fallo muestra el comando, su código de salida y el final de su salida. Salga bien o mal, la lista se vuelve a analizar.

Si una comprobación falla, dile a Claude lo que ves: "después de pulsar el botón, una herramienta de desarrollo pasó a `dependencies`".

### Cómo lo pidió el autor

La petición original del botón no quedó registrada: está en el primer commit, y ningún registro de tareas público cubre su creación.

#### Registrado en un registro de tareas

El registro de tareas `odd/tasks/release-age-all-ecosystems.md` recoge, con las palabras del agente, cómo se comprobó el paso de instalación cuando la espera de 24 horas llegó hasta él. Su tarea T3 es "npm installs with `before` set to 24 hours ago" (npm instala con `before` fijado a hace 24 horas), y la entrada L3 anota que con `npm_config_before` un día atrás, npm rechazó una versión de tailwindcss de hacía una hora y resolvió su rango a la versión anterior. Es evidencia que reunió el agente, no una petición.

`odd/tasks/ecosystems-wave-2.md` enumera "the bump button" (el botón de bump) en S3, entre lo que tenía que seguir funcionando a medida que se añadían ecosistemas; también es la spec del agente.

#### Reconstrucción a partir del historial de commits

A partir de `git log -S rangeFor`, `git log -S upgradeBumps` y los commits de cada ecosistema en narsil-check:

- `1bf736a` (2026-11-04) "feat: add upgrade panel for npm and Expo projects" (añadir un panel de actualizaciones para proyectos npm y Expo). Su mensaje: "trivial bumps it installs in one press" (las subidas triviales las instala de una pulsación). `rangeFor`, el `installArgv` de dos secciones y `upgradeBumps` están aquí.
- `a95eb07` (2026-11-04) "refactor: read dependencies through an adapter per ecosystem" (leer las dependencias a través de un adaptador por ecosistema). Los demás ecosistemas "get a generic scan, install and pending check" (reciben un análisis, una instalación y una comprobación de pendientes genéricos).
- `bbe6519`, `8ae479e`, `503ba95`, `06bcc49` (2026-11-04): "list and upgrade" (enumerar y actualizar) crates de Rust, paquetes de Python, paquetes de Dart y Flutter, gems de Ruby. Cada uno trae su propia función de requisito y su reescritura.
- `8c5f2a3` (2026-11-06) "feat: install npm and pnpm upgrades under the 24-hour wait through the whole tree" (instalar las actualizaciones de npm y pnpm bajo la espera de 24 horas en todo el árbol).
- `7125ffd` (2026-11-09) "fix: stop the upgrade button from breaking builds it cannot check" (evitar que el botón de actualizar rompa compilaciones que no puede comprobar). Su mensaje: "Skip an ecosystem whose tool is not on the machine, such as xcodebuild outside a Mac, restoring its manifests so a raised version never goes out with a stale lockfile. The other ecosystems still go up." (Saltarse un ecosistema cuya herramienta no está en la máquina, como xcodebuild fuera de un Mac, restaurando sus manifests para que una versión subida nunca salga con un lockfile desfasado. Los demás ecosistemas siguen subiendo.) También sacó de lo "trivial" los pins del lockfile de Gradle y los pins exactos de Swift.

El patrón: el botón estaba desde el primer commit, y el trabajo posterior acotó lo que puede incluir "trivial" y lo que pasa cuando falta una herramienta.

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Esta es una versión reducida de la idea, escrita para esta guía y comprobada con los tipos de Claude Code 2.1.325 (`$.process.run`, `$.ui.toast`). Está adaptada de `hooks/npm.ts` y `hooks/register.tsx` en [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Solo npm; `rescan` es tu propio análisis.

```ts
import type { EngineInterface } from 'claude-code'

type Bump = { name: string; spec: string; latest: string; isDev: boolean }
type Manager = 'npm' | 'pnpm' | 'yarn' | 'bun'

export function rangeFor(spec: string, latest: string): string {
  const prefix = /^(\^|~)/.exec(spec.trim())?.[1] ?? ''
  return `${prefix}${latest}`
}

export function installArgv(manager: Manager, bumps: Bump[]): string[][] {
  const add = manager === 'npm' ? 'install' : 'add'
  const dev = manager === 'npm' ? '--save-dev' : '-D'
  const argv: string[][] = []
  for (const isDev of [false, true]) {
    const names = bumps
      .filter((b) => b.isDev === isDev)
      .map((b) => `${b.name}@${rangeFor(b.spec, b.latest)}`)
    if (names.length > 0) argv.push([manager, add, ...(isDev ? [dev] : []), ...names])
  }
  return argv
}

let isRunning = false

export async function upgradeAll(
  $: EngineInterface,
  manager: Manager,
  bumps: Bump[],
  rescan: () => Promise<void>,
): Promise<string | undefined> {
  if (isRunning || bumps.length === 0) return undefined
  isRunning = true
  try {
    for (const argv of installArgv(manager, bumps)) {
      const ran = await $.process.run(argv, { timeoutMs: 300_000 })
      if (ran.exitCode !== 0) {
        const tail = (ran.stderr || ran.stdout).trim().split('\n').slice(-5).join('\n')
        return `${argv.slice(0, 2).join(' ')} exited with ${ran.exitCode}:\n${tail}`
      }
    }
    $.ui.toast(`Updated ${bumps.length} libraries with ${manager}.`)
    return 'Run the tests before committing.'
  } finally {
    isRunning = false
    await rescan()
  }
}
```

Guarda el mensaje devuelto en un atom y dibújalo bajo el botón. Para un segundo ecosistema, añade antes de la instalación un paso de reescritura que sustituya solo la versión en la propia línea de la dependencia, y vuelve a escribir los archivos originales si resulta que falta la herramienta.

## Errores comunes y cómo probarlo

Estos salen del código, los tests y los commits de Narsil Check:

- **Perder el operador.** `^1.2.0` reescrito como `1.4.0` cambia lo que el proyecto acepta a partir de entonces. Conserva el prefijo.
- **Mover una dependencia de desarrollo.** Un solo comando de instalación para todo pone las herramientas de desarrollo en `dependencies` (o al revés). Separa por sección.
- **Subir más que el grupo seguro.** El botón debe tomar solo `bump`; "a blocked upgrade shows what blocks it and the button leaves it out" (una actualización bloqueada muestra lo que la bloquea y el botón la deja fuera) lo comprueba.
- **Un manifest sin su lockfile.** Subir `Cargo.toml` sin `cargo` para refrescar `Cargo.lock` deja los dos desacompasados. Restaura el manifest cuando falte la herramienta.
- **Reformatear el archivo.** Leer un archivo TOML o YAML y volver a escribirlo pierde los comentarios y el orden. Edita la única línea.
- **No volver a analizar.** Después de una instalación, la lista que muestras debe ser la nueva verdad, salga bien o mal.
- **Llamarlo seguro.** Un patch puede romper igualmente una compilación. Di "ejecuta los tests", como hace el panel.

Para probarlo, `claude plugin test .` ejecuta `tests/upgrade.test.tsx`: "an upgrade keeps the range prefix package.json wrote" (una actualización conserva el prefijo de rango que escribió package.json; `^3.22.0` → `^3.25.1`, `~5.4.0` → `~5.9.3`, `1.2.0` → `1.3.0`), "dependencies and devDependencies install in their own sections" (dependencies y devDependencies se instalan en sus propias secciones), "the button installs the trivial upgrades and scans again" (el botón instala las actualizaciones triviales y vuelve a analizar) y "a failed install says why and keeps the list" (una instalación fallida dice por qué y conserva la lista). El archivo de tests de cada uno de los demás ecosistemas comprueba su propia reescritura, por ejemplo los de PyPI y Cargo para el operador y el límite superior.

## Para ir más lejos

- Cuando los manifests difieren de `HEAD`, el panel ofrece hacer commit, push y abrir una pull request. Eso es una guía posterior de esta ruta.
- `rangeFor` solo conserva `^` y `~`. Extenderlo a `>=` o a los rangos con `x` es un cambio pequeño con un test por caso.
- Un equipo que quiera ejecutar los tests automáticamente podría encadenar un comando de tests después de la instalación; Narsil Check te lo deja a ti a propósito, con el recordatorio.
