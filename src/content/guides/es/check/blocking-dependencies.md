---
title: Dependencias que se bloquean entre sí
description: 'Cómo Narsil Check encuentra actualizaciones de npm que no pueden subir solas: peers que pide la versión nueva, peers que piden los paquetes instalados y pins exactos en el árbol.'
route: check
order: 8
updated: 2026-11-18
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

## Qué hace

Algunas actualizaciones parecen triviales y no lo son. Pasar de eslint 9.39 a 10 es una versión mayor sobre la que podrías leer y aceptarla, pero si uno de tus plugins de ESLint instalados solo acepta eslint 9, la instalación fallará o dejará un proyecto que no pasa el lint. Un patch puede ser peor: subir un paquete que otro paquete fija a una versión exacta deja dos copias instaladas, y algunas herramientas se rompen cuando se cargan dos veces.

Narsil Check lo comprueba antes de ofrecer nada. En un proyecto npm, una actualización que rechaza una de estas comprobaciones va al grupo **Bloqueada**, sea cual sea el tamaño de su salto, con el motivo escrito debajo en rojo. El botón de actualización, **Actualizar las N**, nunca la incluye.

Los motivos son frases, construidas a partir de los datos, en el español del panel:

| Motivo en el panel                                                                     | Qué significa                                                                |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `eslint-plugin-astro 3.2.1 necesita eslint >=10.0.0 (tienes 9.39.5)`                   | La versión nueva necesita un peer que tienes en otra versión.                |
| `eslint-config-love exige eslint ^9.35.0`                                              | Un paquete instalado pide este en un rango del que la versión nueva se sale. |
| `typescript-eslint 8.71.0 fija @typescript-eslint/parser 8.71.0: quedarían dos copias` | Un paquete del árbol fija la versión antigua: quedarían dos copias.          |

Estos ejemplos son los del propio README y los de los tests, con paquetes públicos conocidos.

Cuando una actualización tiene varios motivos, se unen con `·` en la misma línea. Una pulsación en la fila copia la biblioteca con su salto y lo que la bloquea, para que puedas pegarlo en una conversación y preguntar cómo desenredarlo.

Estas comprobaciones solo existen para npm. La sección del README empieza con "Solo en npm", y los demás ecosistemas bloquean por sus propios motivos (la guía anterior los enumera).

## Cómo funciona por dentro

### Tres comprobaciones, en las dos direcciones

La pregunta de diseño era: ¿qué hace que una versión no pueda subir sola? La respuesta en `hooks/npm.ts` son tres relaciones, leídas de los datos y nunca adivinadas por un modelo:

1. **Lo que pide la versión nueva.** Sus `peerDependencies`, comparadas con lo que el proyecto tiene instalado.
2. **Lo que piden los paquetes instalados.** Las `peerDependencies` de cada paquete instalado sobre este, comparadas con la versión nueva.
3. **Lo que fija el árbol.** Cualquier paquete del lockfile que dependa de este en una versión exacta que no es la nueva.

Las dos primeras son las dos direcciones de la misma relación, y hacen falta ambas: un plugin que pasa a exigir eslint 10 lo detecta la primera, y un eslint 10 que tu configuración antigua rechaza lo detecta la segunda.

### De dónde salen los datos

Para la primera comprobación, el manifiesto de la versión nueva se consulta en `https://registry.npmjs.org/<name>/<version>` (`versionUrl`). `targetPeers` en `hooks/register.tsx` guarda la respuesta en `$.store` bajo `peers:<name>@<version>` sin caducidad, porque, como dice su comentario, "A version never changes once published, so its answer is kept for good." (Una versión nunca cambia una vez publicada, así que su respuesta se guarda para siempre.)

Para la segunda, el manifiesto instalado de cada dependencia declarada se lee de `node_modules/<name>/package.json`. Cuando no hay `node_modules` (un repositorio recién clonado o creado a partir de una plantilla), `lockedPackage` lee la misma información de `package-lock.json`, o de `pnpm-lock.yaml` mediante `pnpmLocked`. Esa alternativa llegó en `24dfeb1`, después de que un proyecto todavía sin instalar "showed no 'exige' blocks, so eslint and typescript upgrades its plugins refuse looked safe" (no mostraba bloqueos 'exige', así que las actualizaciones de eslint y typescript que sus plugins rechazan parecían seguras).

Un detalle que el README no explicita: la segunda comprobación lee los peers de las dependencias **declaradas** del proyecto, las de `package.json`, porque `scanNpm` llena `installedMap` a partir de esa lista. Los rangos de peers propios de un paquete transitivo no se comparan. La tercera comprobación es la que llega a todo el árbol.

Para la tercera, `pinConflicts` lee el mapa `packages` de `package-lock.json`, que en las versiones 2 y 3 del lockfile enumera cada paquete instalado por su ruta, incluidos los anidados. El README expone la consecuencia: "Esta comprobación usa `package-lock.json`, así que con yarn, pnpm o bun no se hace".

### La comprobación de peers

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

Está citado de [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). En él se ven tres decisiones:

- **Un peer que no tienes no es un conflicto.** `have` es `undefined` y no se añade nada. El comentario: "A peer the project does not have is npm's to add, not a conflict." (Un peer que el proyecto no tiene le toca añadirlo a npm, no es un conflicto.)
- **Los rangos se leen como los lee npm.** `satisfies` de `hooks/semver.ts` maneja `||`, rangos con guion, `^`, `~`, versiones parciales y `*`, así que se entiende un rango de peer como `^8.57.0 || ^9.0.0 || ^10.0.0`. Un comparador que no sabe leer cuenta como cumplido, "so an unknown range never raises a false alarm" (así que un rango desconocido nunca da una falsa alarma).
- **El motivo nombra los dos lados.** La primera forma dice qué necesita la versión nueva y qué tienes; la segunda dice quién la rechaza y qué acepta. Cualquiera de las dos basta para decidir qué subir primero.

`installedFromManifest` también registra qué peers marca `peerDependenciesMeta` como opcionales, pero `peerConflicts` no lee esa lista: un peer opcional que el proyecto tiene instalado, en una versión fuera del rango, bloquea como cualquier otro.

### La comprobación de pins

Dos copias de un paquete suelen ser inofensivas. No lo son para un plugin que se registra a sí mismo, ni para un singleton. El comentario del código da el ejemplo del "Cannot redefine plugin" (no se puede redefinir el plugin) de ESLint, y el README el caso: `typescript-eslint` 8.71.0 fija `@typescript-eslint/parser` 8.71.0, así que subir solo el parser a 8.72.1 hace que ESLint cargue el plugin dos veces.

`pinConflicts` mira cada paquete del lockfile, a cualquier profundidad, y lee sus `dependencies` y `optionalDependencies` sobre el paquete que se sube. Solo informa cuando se cumple todo esto:

- el rango es un pin exacto (`isExactPin`: `8.71.0` o `=8.71.0`, nada más);
- la versión nueva no lo cumple;
- el propietario no forma parte de una familia que sube junta (más abajo).

Un rango que no es exacto, como `^8.53.0`, se deja en paz: "a nested copy there is usually harmless" (una copia anidada ahí suele ser inofensiva). Esa elección mantiene la comprobación silenciosa; un pin es una declaración deliberada de quien publica el paquete, un rango no.

### Familias que se mueven juntas

Algunas familias publican todos sus miembros con la misma versión y se fijan entre sí a ella: `typescript-eslint` con su parser y su plugin, `@tailwindcss/*` con `tailwindcss`. Subirlas una a una siempre parecería bloqueado. Subirlas juntas está bien, porque todos los pins pasan a la versión nueva a la vez.

Así que `pinConflicts` recibe un `batch`: las actualizaciones triviales que el botón instalaría juntas, por nombre y versión nueva. Un pin no cuenta cuando su propietario sube en el lote a la misma versión. También sigue las cadenas: el ejemplo del comentario es `@tailwindcss/vite`, que fija `@tailwindcss/node`, que fija `tailwindcss`. Los paquetes fijados al unísono por un paquete arrastrado también se arrastran, repitiendo hasta que no se añade nada nuevo.

### Decidir, y volver a decidir

El lote depende de qué actualizaciones son triviales, y cuáles son triviales depende de los pins. `scanNpm` lo resuelve con un bucle:

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

Está citado de [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). El comentario que tiene encima: "a blocked one leaves the batch, which can block a sibling it carried" (una bloqueada sale del lote, lo que puede bloquear a otra que arrastraba). El bucle termina cuando una pasada no cambia ningún grupo. `young` guarda los motivos de la espera de 24 horas, así que caen en la misma lista. Las actualizaciones del grupo de Expo se saltan la comprobación de peers (`peers` no tiene entrada para ellas, así que el bucle también las salta); pasan por `npx expo install --fix` en su lugar.

### Con qué compara

Las comprobaciones comparan con lo que está instalado ahora. El README es honesto sobre el límite: "si subes varias juntas, puede que el bloqueo se resuelva entre ellas". Solo la comprobación de pins conoce el lote; un conflicto de peers entre dos actualizaciones que subirían ambas se sigue mostrando. Ese es el lado seguro: el panel puede detenerte cuando podrías haber seguido, pero no deja pasar una actualización que rompe.

## Constrúyelo con Claude

Pídele a Claude comprobaciones que te avisen cuando una actualización de npm no puede subir sola, antes de que se ofrezca. La única idea que debe entender bien es que cuentan las dos direcciones: lo que pide la versión nueva y lo que piden tus paquetes instalados.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil Check.

> En mi mod de Claude Code `my-panel`, antes de marcar una actualización de npm como segura, comprueba si puede subir sola. Escribe funciones puras en `hooks/npm.ts`. `peerConflicts(name, target, installed)`: para cada entrada de `peerDependencies` de la versión nueva, si el proyecto tiene ese peer instalado en una versión fuera del rango, di "<name> <version> needs <peer> <range> (you have <version>)"; para cada paquete instalado cuyas `peerDependencies` nombren este paquete con un rango del que se sale la versión nueva, di "<other> requires <name> <range>". Un peer que el proyecto no tiene no es un conflicto. `pinConflicts(name, target, lock)`: para cada paquete de `packages` de `package-lock.json` que dependa de este en una versión exacta (`1.2.3` o `=1.2.3`) que no es la nueva, di "<owner> <version> pins <name> <range>: two copies would remain". Lee los rangos de versión con un `satisfies` que maneje `||`, `^`, `~` y rangos con guion y que trate como cumplido lo que no sabe leer. En el módulo de hooks, consulta el manifiesto de la versión nueva en `https://registry.npmjs.org/<name>/<version>` con `$.http.fetch` y guárdalo en `$.store` para siempre. Pon cualquier actualización con un motivo en un grupo "blocked" e imprime los motivos debajo. Prueba con manifiestos y lockfiles sintéticos.

### Qué revisar en la respuesta de Claude

1. `peerConflicts` compara las dos direcciones: los `peerDependencies` de la versión nueva con lo que tienes instalado, y los `peerDependencies` de cada paquete instalado sobre este paquete con la versión nueva.
2. Un peer que el proyecto no tiene no es un conflicto, así que no se informa nada sobre él.
3. `pinConflicts` informa solo de las fijaciones exactas (`1.2.3` o `=1.2.3`) que la versión nueva no cumple. Un rango como `^8.53.0` se deja en paz.
4. `satisfies` lee rangos con `||`, `^`, `~` y guion, y trata un rango que no puede leer como cumplido, así que `^8.57.0 || ^9.0.0 || ^10.0.0` no bloquea todos los plugins.
5. Cualquier actualización con un motivo va al grupo de bloqueadas con sus motivos impresos debajo, y el manifiesto de la versión nueva se descarga de `https://registry.npmjs.org/<name>/<version>` una sola vez y se guarda en `$.store` para siempre.

Si una comprobación falla, dile a Claude lo que ves: "eslint 10 aparece como una actualización segura, pero mi configuración de ESLint solo acepta eslint 9".

### Cómo lo pidió el autor

La petición original de estas comprobaciones no quedó registrada. Ya están en el primer commit, y ningún registro de tareas público las cubre.

#### Registrado en un registro de tareas, no con las palabras de quien creó Narsil Check

`odd/tasks/ecosystems-wave-2.md` recoge una decisión sobre ellas cuando llegaron los demás ecosistemas. Es una suposición escrita en el registro de tareas por el agente, no las palabras de quien creó Narsil Check:

> "Assumption: peer dependency and exact-pin checks stay npm-only; Go majors are new module paths (`/v2`), so a Go major is found by probing `<module>/vN/@latest`."

(Suposición: las comprobaciones de dependencias peer y de pins exactos se quedan solo en npm; las versiones mayores de Go son rutas de módulo nuevas (`/v2`), así que una versión mayor de Go se encuentra probando `<module>/vN/@latest`.)

Por eso la sección del README sigue empezando con "Solo en npm".

#### Reconstrucción a partir del historial de commits

A partir de `git log -- hooks/npm.ts` y de `git log -S` sobre `peerConflicts`, `pinConflicts` y `lockedPackage` en narsil-check:

- `1bf736a` (2026-11-04) "feat: add upgrade panel for npm and Expo projects" (añadir un panel de actualizaciones para proyectos npm y Expo). Su mensaje nombra "upgrades blocked by peer dependencies or exact pins in the lockfile" (actualizaciones bloqueadas por dependencias peer o por pins exactos en el lockfile). `peerConflicts`, `pinConflicts` y el lote al unísono ya están en este primer commit.
- `a95eb07` (2026-11-04) "refactor: read dependencies through an adapter per ecosystem" (leer las dependencias mediante un adaptador por ecosistema). npm "keeps what only npm has (Expo, node_modules, peer and pin checks)" (conserva lo que solo tiene npm: Expo, node_modules y las comprobaciones de peers y de pins).
- `4ea9be0` (2026-11-04) "feat: block upgrades kept on purpose and Kotlin past its compiler plugins" (bloquear las actualizaciones retenidas a propósito y Kotlin por delante de sus plugins del compilador). La etiqueta del grupo cambia de `Bloqueada por otras dependencias` a `Bloqueada`, "since a dependency is no longer its only reason" (ya que una dependencia ya no es su único motivo).
- `24dfeb1` (2026-11-07) "fix: read peer dependencies from the lockfile when node_modules is missing" (leer las dependencias peer del lockfile cuando falta node_modules). Su mensaje describe el error que no se habría notado: un proyecto todavía sin instalar no mostraba bloqueos, así que las actualizaciones rechazadas "looked safe" (parecían seguras).

El patrón: las comprobaciones se diseñaron completas desde el principio, y la única corrección trató de dónde salen los datos, no de la regla.

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Esta es una versión reducida de la idea, escrita para esta guía y comprobada con los tipos de Claude Code 2.1.325. Está adaptada de `hooks/npm.ts` y `hooks/register.tsx` en [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Solo maneja rangos con circunflejo, tilde, exactos y `>=`, y deja fuera las familias que se mueven juntas.

La parte pura, `hooks/peers.ts`:

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

La parte del módulo de hooks, que consulta una sola vez los peers de la versión nueva:

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

Construye `installed` a partir del `node_modules/<name>/package.json` de cada dependencia declarada, leído con `$.fs.read`, como `{ version, peers: peerDependencies ?? {} }`. Para cada actualización, une `peerConflicts` y `pinConflicts` (con `package-lock.json` interpretado como `lock`); cualquier motivo la bloquea, y los motivos son su segunda línea en el panel.

## Errores comunes y cómo probarlo

Estos salen del código, el README y los commits de Narsil Check:

- **Comprobar una sola dirección.** Los peers de la versión nueva y los peers de los paquetes instalados son preguntas distintas; eslint 10 con una configuración antigua falla la segunda, un plugin nuevo con un eslint antiguo falla la primera.
- **Tratar un peer que falta como un conflicto.** npm lo añade. Solo bloquea un peer que tienes en una versión equivocada.
- **Leer solo `node_modules`.** Un clon recién hecho no lo tiene, y entonces nada se bloquea. Ese es el error que corrigió `24dfeb1` leyendo los lockfiles.
- **Marcar cada copia anidada.** La mayoría son inofensivas. Informa solo de los pins exactos.
- **Bloquear una familia que se mueve junta.** Los pins dentro de una familia que sube a la misma versión están bien; sin el lote, `typescript-eslint` o `@tailwindcss/*` parecerían bloqueados para siempre.
- **Decidir una sola vez.** Bloquear una actualización la saca del lote y puede bloquear a otra relacionada; repite el bucle hasta que ningún grupo cambie.
- **Un analizador de rangos demasiado estricto.** Si falla con `^8.57.0 || ^9.0.0 || ^10.0.0`, todos los plugins parecen incompatibles. Trata como cumplido lo que no sabes leer.
- **Consultar el manifiesto de la misma versión en cada análisis.** Una versión publicada nunca cambia; guarda sus peers para siempre.

Para probarlo, `tests/upgrade.test.tsx` construye un conjunto instalado con peers sintéticos y comprueba las frases exactas: "typescript 7 is blocked by the packages that ask for an older one" (typescript 7 queda bloqueado por los paquetes que piden uno más antiguo), "eslint 10 is blocked by the configs and plugins that stop at 9" (eslint 10 queda bloqueado por las configuraciones y plugins que se quedan en 9), "eslint-plugin-astro 3 is blocked by the eslint it needs" (eslint-plugin-astro 3 queda bloqueado por el eslint que necesita) y "an upgrade every peer accepts has no conflicts" (una actualización que aceptan todos los peers no tiene conflictos). "peer ranges as packages write them" (rangos de peers tal como los escriben los paquetes) fija `satisfies` sobre formas de rango reales. Para los pins: "only a range naming one version is an exact pin" (solo un rango que nombra una versión es un pin exacto), "a package in the tree that pins the old version leaves two copies" (un paquete del árbol que fija la versión antigua deja dos copias) y "a family that goes up together carries its pins, through its own members too" (una familia que sube junta arrastra sus pins, también a través de sus propios miembros). A través del panel: "a blocked upgrade shows what blocks it and the button leaves it out" (una actualización bloqueada muestra lo que la bloquea y el botón la deja fuera), "the button leaves out an upgrade a package in the tree pins" (el botón deja fuera una actualización que fija un paquete del árbol), "without node_modules, the lockfiles say what a package asks for" (sin node_modules, los lockfiles dicen lo que pide un paquete) y "a pnpm project with no node_modules still blocks an upgrade its installed plugins refuse" (un proyecto pnpm sin node_modules sigue bloqueando una actualización que rechazan sus plugins instalados).

## Para ir más lejos

- La comprobación de pins necesita `package-lock.json`. Leer de la misma forma los paquetes anidados de `pnpm-lock.yaml` la extendería a los proyectos pnpm, que según el README hoy no están cubiertos.
- La comprobación de peers también podría aprender del lote, para que dos actualizaciones que solo entran en conflicto con las versiones antiguas de la otra se ofrezcan juntas.
- Copiar una fila bloqueada le da a Claude los dos lados del conflicto en una línea: un buen comienzo para preguntar qué paquete subir primero.
