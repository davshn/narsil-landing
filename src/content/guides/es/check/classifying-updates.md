---
title: Clasificar las actualizaciones
description: 'Cómo Narsil Check reparte cada biblioteca desactualizada entre Bloqueada, Versión mayor, Solo subir la versión o Fuera del SDK de Expo, y por qué guarda seis horas las respuestas.'
route: check
order: 7
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/semver.ts
  - repo: check
    path: hooks/npm.ts
  - repo: check
    path: hooks/words.ts
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/upgrade.test.tsx
  - repo: check
    path: odd/tasks/release-age-all-ecosystems.md
---

## Qué hace

Una lista de cincuenta bibliotecas desactualizadas no sirve de mucho por sí sola. Lo que quieres saber es cuáles puedes subir ya sin pensarlo, cuáles hay que leer y cuáles no deberías tocar todavía. La sección **Actualizaciones** lo responde poniendo cada biblioteca desactualizada en uno de cuatro grupos, dibujados en este orden:

| Grupo (etiqueta en el panel)     | Pista bajo la cabecera                          | Color    |
| -------------------------------- | ----------------------------------------------- | -------- |
| `Fuera del SDK de Expo`          | `npx expo install --fix`                        | azul     |
| `Bloqueada`                      | `no se puede subir sola: el motivo está debajo` | rojo     |
| `Versión mayor: revisar cambios` | `pueden romper la API`                          | amarillo |
| `Solo subir la versión`          | `parche o menor`                                | verde    |

Las etiquetas y las pistas vienen de `GROUPS` en `hooks/words.ts`.

Cada grupo tiene una cabecera que lo pliega, como `▾ Bloqueada (2)`, y el panel recuerda cuáles cerraste. Debajo de cada fila hay una segunda línea donde importa: en **Bloqueada**, todo lo que la bloquea, en rojo; en **Versión mayor**, la lectura de Haiku sobre lo difícil que es el salto. Solo **Solo subir la versión** tiene un botón, **Actualizar las N**, y nunca toma una biblioteca de otro grupo.

Las bibliotecas que están al día no aparecen. La línea bajo la cabecera de la sección cuenta el resto, en el orden de los grupos:

```text
6 para actualizar de 31 · 2 bloqueadas · 2 mayores · 2 triviales
```

Sin nada que hacer dice `Todo al día · 31 librerías revisadas`.

El punto de color de la sección dice el grupo más urgente presente: rojo si hay algo bloqueado, si no amarillo para una versión mayor, si no azul para Expo, si no verde.

## Cómo funciona por dentro

### El tipo: cuatro grupos y una lista de motivos

`types/index.d.ts` define el grupo como una unión, `'bump' | 'review' | 'expo' | 'blocked'`, y cada `Upgrade` lleva uno, con su `bump` (`'patch' | 'minor' | 'major'`) y `conflicts: string[]`. Los comentarios de `Group` todavía dicen que `blocked` es solo para una dependencia peer; el código y el README le dan ahora más motivos (más abajo).

El diseño separa dos preguntas. `bump` es cuánto se separan las versiones, un hecho. `group` es lo que debería hacer la persona, una decisión que puede cambiar a medida que se sabe más. Un patch puede ser `blocked`; una versión mayor es `review` salvo que algo la bloquee.

### Paso 1: de qué tamaño es el salto

Todos los ecosistemas empiezan igual, con `bumpOf(installed, latest)` de `hooks/semver.ts`:

```ts
export function bumpOf(from: Version, to: Version): Bump {
  if (compare(to, from) <= 0) return 'none'
  if (to.major !== from.major) return 'major'
  if (to.minor !== from.minor) return from.major === 0 ? 'major' : 'minor'
  if (to.patch !== from.patch) return from.major === 0 && from.minor === 0 ? 'major' : 'patch'
  return 'patch'
}
```

Está citado de [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). `none` significa al día (o que la última versión del registro es más antigua que la que tienes), y la biblioteca queda fuera. Si no, `major` va a `review`, y `patch` o `minor` a `bump`.

### Versiones por debajo de 1.0.0

Las dos líneas del medio llevan la regla que expone el comentario: "Below 1.0.0 a minor is a breaking change (0.3 -> 0.4) and below 0.1.0 so is a patch, as npm's caret ranges treat them." (Por debajo de 1.0.0 un minor es un cambio incompatible (0.3 -> 0.4), y por debajo de 0.1.0 también lo es un patch, como los tratan los rangos con circunflejo de npm.)

Esto sigue la propia convención del versionado semántico de que 0.x es inestable, y el `^` de npm lo lee igual: `^0.3.2` acepta `0.3.9` pero no `0.4.0`, y `^0.0.3` no acepta nada salvo `0.0.3`. Si el panel llamara minor al paso de 0.3 a 0.4, el botón de actualización subiría a través de un cambio que quien publica el paquete marcó como incompatible. Los tests fijan los tres casos: `0.3.1 → 0.4.0` es major, `0.3.1 → 0.3.2` es un patch, `0.0.3 → 0.0.4` es major.

El README solo expone la primera mitad: "un salto de minor por debajo de 1.0.0". La regla del patch por debajo de 0.1.0 está en el código y en los tests, no en el README.

`bumpOf` es compartida, así que la regla se aplica a todos los ecosistemas, incluidos aquellos cuyas propias herramientas leen 0.x de otra forma.

### Paso 2: npm y el SDK de Expo

Una app de Expo fija los módulos nativos con los que se construye cada SDK, en `bundledNativeModules.json`. Instalar uno más nuevo de lo que permite esa tabla rompe la compilación nativa, así que en un proyecto Expo "the table wins over npm" (la tabla gana a npm). `upgradeOf` en `hooks/npm.ts` lo comprueba antes que nada:

- **La versión instalada está fuera del rango del SDK**: la actualización va a `expo`, con el rango del SDK como destino. Ese es el grupo **Fuera del SDK de Expo**, y su pista es la orden que lo arregla.
- **La versión instalada está dentro del rango, y npm tiene una más nueva**: la respuesta es `'held'`, no una actualización. Se cuenta, no se lista, y una nota dice que esas bibliotecas "tienen versión nueva en npm, pero el SDK de Expo la fija: se suben con el SDK".

La tabla sale de `node_modules/expo/bundledNativeModules.json` cuando está instalado, y si no, de `https://unpkg.com/expo@<version>/bundledNativeModules.json` para la versión de Expo instalada. El propio paquete `expo` nunca se juzga con su propia tabla.

### Paso 3: cualquier cosa que la bloquee

Por último, cualquier actualización que tenga un motivo para no subir sola pasa a `blocked`, sea cual sea su salto. Los motivos se guardan como palabras en `conflicts`, y esas palabras son lo que el panel imprime bajo la fila.

Para npm (`scanNpm`), los motivos son las dependencias peer y los pins de la siguiente guía, más la espera de 24 horas. Para cualquier otro ecosistema (`scanGeneric`):

- **Un comentario que retiene la versión a propósito**, encontrado por `holdNote`: `Fijada a propósito: «…»`, con el propio comentario.
- **Lo que el ecosistema sabe que rompe**, del `conflictsOf` del adaptador: Kotlin y sus plugins del compilador, el Android Gradle Plugin y el wrapper de Gradle, un paquete de Swift fijado a una versión exacta.
- **La espera de 24 horas**: una versión publicada hace menos de un día, como `Publicada hace 3 h: Narsil Check espera 24 h antes de subirla`.

La espera cubre también el grupo de Expo: la versión a la que resuelve el rango del SDK se retiene el mismo día, y una actualización de Expo que todavía espera pasa a `blocked` con la orden en su motivo.

El orden importa por una razón: `blocked` se decide al final, así que anula todo lo demás. Un patch trivial que un plugin rechaza no es trivial.

### Dónde se dibuja

El hook `ui.render` dibuja `GROUPS` en orden, filtrando `state.upgrades` por `u.group`; dentro de un grupo, una actualización que corrige vulnerabilidades conocidas va primero. La segunda línea de una fila bloqueada es `u.conflicts.join(' · ')` en rojo. `sortUpgrades` ordena la lista por grupo, después las dependencies antes que las devDependencies, y después por nombre.

### La caché de seis horas

Consultar cada registro por cada biblioteca en cada inicio de sesión sería lento y pondría una carga real sobre registros públicos para respuestas que rara vez cambian. `latestIn` en `hooks/register.tsx` guarda cada respuesta:

```ts
// A registry answer is reused for this long, across sessions and projects.
const CACHE_MS = 6 * 60 * 60 * 1000
```

```ts
const key = `${adapter.id}:${name}`
const cached = (await $.store.get(key)) as Cached | undefined
if (!isFresh && cached && Date.now() - cached.at < CACHE_MS) return cached.version
```

Ambos están citados de [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Después de una consulta, la respuesta se vuelve a escribir con `$.store.set(key, { version, at: Date.now() })`.

**Dónde se guarda.** `$.store` es, en palabras de los tipos de 2.1.325, "This plugin's own key-value store, kept between sessions and hot reloads" (el almacén clave-valor propio de este plugin, conservado entre sesiones y recargas en caliente), "A JSON file of the plugin's own under the user's Claude Code configuration directory" (un archivo JSON propio del plugin bajo el directorio de configuración de Claude Code del usuario). Por eso el comentario dice "across sessions and projects" (entre sesiones y proyectos): la clave es el ecosistema y el nombre del paquete (`npm:react`), no el proyecto, así que un segundo proyecto que usa react reutiliza la respuesta. Los tipos también dicen que `set` rechaza "a store over 4 MiB of JSON text in all" (un almacén de más de 4 MiB de texto JSON en total), un límite que comparten todas las claves del mod.

**Cuándo se salta.** `isFresh` lo activan **Revisar de nuevo**, `/narsil-check upgrade`, el botón de actualización, el botón de pull request y un pull de rama correcto. Un análisis fresco vuelve a consultar cada registro y escribe las respuestas nuevas. El análisis del inicio de sesión no es fresco, así que usa lo que tiene menos de seis horas. El README dice lo mismo: "Cada respuesta se guarda 6 horas, y el botón **Revisar de nuevo** fuerza una consulta nueva".

**Por qué seis horas.** Ni el código, ni el README, ni los commits dan una razón para el número; `CACHE_MS` vale seis horas desde el primer commit, `1bf736a`. Leyendo el equilibrio: una caché más corta consultaría cada registro en casi cada inicio de sesión, y una más larga ocultaría una versión durante la mayor parte de una jornada de trabajo. Seis horas es menos que la espera de 24 horas, así que una versión que la caché oculta durante un rato no habría podido subir de todos modos en ese tiempo. Ese razonamiento es una interpretación, no una decisión registrada.

**Qué se guarda para siempre.** Algunas respuestas nunca cambian una vez publicada una versión, así que el mod las guarda sin temporizador: las dependencias peer de una versión (`peers:<name>@<version>`), su fecha de publicación (`published:…`, solo cuando es una fecha válida) y la lectura de Haiku sobre una versión mayor (`why:…`).

## Cómo se le pidió a la IA

La petición original de los cuatro grupos no quedó registrada: ya están en el primer commit, y ningún registro de tareas público los cubre. Los motivos de **Bloqueada** crecieron después, y uno de ellos está registrado con las palabras de quien creó Narsil Check.

### Registrado: la espera de 24 horas en todos los ecosistemas

`odd/tasks/release-age-all-ecosystems.md`, entrada de registro L1 (2026-11-06), cita a quien creó Narsil Check. El primer mensaje preguntaba por frameworks distintos de Expo:

> "Y el cuánto a expo, pasa igual con frameworks como kmp o alguno de los otros lenguajes? Tenemos que pensar en ellos?"

Después:

> "El primero me interesa, deberíamos implementar algo similar para los otros lenguajes, es más seguro"

Y después: "24 horas está perfecto".

El S4 del mismo registro cita una regla anterior de quien creó Narsil Check, conservada de una corrección previa:

> "siempre que haya minimumReleaseAge se bloquee la actualizacion automatica y se marque el bloqueo, sin excepcion alguna"

Por eso ninguna lista de exclusión cuenta en ningún sitio, y por eso una fecha que no se puede leer también bloquea.

Una corrección llegó el mismo día. L7 cita la pregunta de quien creó Narsil Check:

> "que pasa si una version siempre trae fecha ilegible? nunca la vamos a actualizar?"

El registro de tareas recoge la propuesta aceptada ("si hazlo asi"): una versión así espera 24 horas desde que el mod la vio por primera vez. Esa alternativa y el resto del diseño son la propuesta del agente, escrita en el registro; las palabras de quien creó Narsil Check son la pregunta y el "si".

### Reconstrucción a partir del historial de commits

A partir de `git log -- hooks/semver.ts hooks/words.ts` y de `git log -S` sobre las etiquetas de los grupos, en narsil-check:

- `1bf736a` (2026-11-04) "feat: add upgrade panel for npm and Expo projects" (añadir un panel de actualizaciones para proyectos npm y Expo). Su mensaje: el panel "lists the project's outdated libraries by how hard each upgrade is" (enumera las bibliotecas desactualizadas del proyecto según lo difícil que es cada actualización). Los cuatro grupos, `bumpOf` con la regla de 0.x y `CACHE_MS` ya están aquí. El grupo bloqueado se llamaba entonces `Bloqueada por otras dependencias`, con colores simples de terminal (rojo, magenta, amarillo, verde).
- `4ea9be0` (2026-11-04) "feat: block upgrades kept on purpose and Kotlin past its compiler plugins" (bloquear las actualizaciones retenidas a propósito y Kotlin por delante de sus plugins del compilador). Su mensaje: "The blocked group is now just Bloqueada, since a dependency is no longer its only reason." (El grupo bloqueado ahora es solo Bloqueada, ya que una dependencia ya no es su único motivo.)
- `690c1bb` (2026-11-06) "feat: block upgrades pnpm would refuse under minimumReleaseAge" (bloquear las actualizaciones que pnpm rechazaría con minimumReleaseAge), y después `54ac6aa` (2026-11-06) "fix: block every upgrade under pnpm's minimumReleaseAge, with no exceptions" (bloquear toda actualización con el minimumReleaseAge de pnpm, sin excepciones).
- `1492ca5` (2026-11-06) "feat: hold every ecosystem's upgrades for 24 hours after release" (retener las actualizaciones de cada ecosistema durante 24 horas después de su publicación), y `ca13b3c` (2026-11-06) "feat: hold Expo SDK-pinned versions for 24 hours too" (retener también 24 horas las versiones fijadas por el SDK de Expo).
- `54cd243` (2026-11-06) "feat: let a version with no readable date go up a day after it was first seen" (dejar que una versión sin fecha legible suba un día después de verla por primera vez). La corrección de L7.

El patrón: los grupos fueron correctos desde el principio, y lo que cambió fue el significado de **Bloqueada**, de "otra dependencia la rechaza" a "cualquier cosa que sepamos que hace inseguro subirla sola".

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil Check.

> En mi mod de Claude Code `my-panel`, tengo una lista de bibliotecas de npm desactualizadas, cada una con su versión instalada y la más reciente. Repártelas en grupos: `blocked` (una lista de motivos en palabras no está vacía), `review` (un salto de versión mayor), `bump` (un patch o un minor). Escribe `bumpOf(from, to)` como función pura: none, patch, minor o major, donde por debajo de 1.0.0 un minor cuenta como major y por debajo de 0.1.0 también un patch, como los leen los rangos con circunflejo de npm. Decide `blocked` al final para que anule a los demás. Dibuja los grupos en el orden blocked, review, bump, cada uno con una cabecera plegable `▾ Label (N)` y una línea de pista, y los motivos bajo una fila bloqueada en rojo. Solo el grupo bump tiene un botón "Actualizar todas". Guarda en caché cada respuesta del registro en `$.store` bajo `npm:<name>` con la hora, reutilízala durante seis horas y sáltate la caché cuando la persona pulse "Revisar de nuevo". Prueba `bumpOf` con casos 0.x y la caché con `mock.clock`.

## El código mínimo

Esta es una versión reducida de la idea, escrita para esta guía y comprobada con los tipos de Claude Code 2.1.325. Está adaptada de `hooks/semver.ts`, `hooks/npm.ts` y `hooks/register.tsx` en [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Deja fuera Expo y los propios motivos; `reasons` es lo que hayan encontrado tus comprobaciones.

```ts
import type { EngineInterface } from 'claude-code'

type V = { major: number; minor: number; patch: number }
export type Group = 'blocked' | 'review' | 'bump'

export function parse(text: string): V | undefined {
  const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(text.trim())
  return m ? { major: +m[1], minor: +(m[2] ?? 0), patch: +(m[3] ?? 0) } : undefined
}

export function bumpOf(from: V, to: V): 'none' | 'patch' | 'minor' | 'major' {
  const d = to.major - from.major || to.minor - from.minor || to.patch - from.patch
  if (d <= 0) return 'none'
  if (to.major !== from.major) return 'major'
  if (to.minor !== from.minor) return from.major === 0 ? 'major' : 'minor'
  return from.major === 0 && from.minor === 0 ? 'major' : 'patch'
}

export function groupOf(from: V, to: V, reasons: string[]): Group | undefined {
  const bump = bumpOf(from, to)
  if (bump === 'none') return undefined
  if (reasons.length > 0) return 'blocked'
  return bump === 'major' ? 'review' : 'bump'
}

const CACHE_MS = 6 * 60 * 60 * 1000
type Cached = { version: string; at: number }

export async function latest(
  $: EngineInterface,
  name: string,
  isFresh: boolean,
): Promise<string | undefined> {
  const key = `npm:${name}`
  const cached = (await $.store.get(key)) as Cached | undefined
  if (!isFresh && cached && Date.now() - cached.at < CACHE_MS) return cached.version
  const res = await $.http.fetch(`https://registry.npmjs.org/${name.replace('/', '%2F')}/latest`, {
    headers: { accept: 'application/json' },
  })
  const version = res.ok ? (JSON.parse(res.text) as { version?: string }).version : undefined
  if (version) await $.store.set(key, { version, at: Date.now() } satisfies Cached)
  return version
}
```

Llama a `latest` para cada dependencia declarada desde un análisis que ningún hook espere con await, después a `groupOf` con la versión instalada y los motivos que hayan encontrado tus comprobaciones, y guarda la lista en un atom. En el panel, dibuja un bloque plegable por grupo en el orden de `Group`, y el botón **Actualizar todas** solo bajo `bump`. El `parse` reducido ignora las versiones preliminares y las cuartas partes, que `hooks/semver.ts` sí maneja.

## Errores comunes y cómo probarlo

Estos salen del código y los commits de Narsil Check:

- **Mezclar el salto con la decisión.** Mantén `bump` (un hecho) y `group` (qué hacer) separados, para que de un patch bloqueado se siga sabiendo que es un patch.
- **Decidir blocked primero.** Una regla posterior que asigne `review` o `bump` lo desharía. El análisis de npm de Narsil Check incluso repite el bucle hasta que ningún grupo cambia, porque bloquear una actualización puede bloquear a otra relacionada.
- **Leer 0.x como 1.x.** `0.3 → 0.4` es incompatible. También lo es `0.0.3 → 0.0.4`.
- **Una fila bloqueada sin motivo.** El grupo dice "el motivo está debajo"; una línea vacía rompe esa promesa. Guarda los motivos como palabras.
- **Un botón que se lo lleva todo.** Solo debe tomar el grupo `bump`; el test "a blocked upgrade shows what blocks it and the button leaves it out" (una actualización bloqueada muestra lo que la bloquea y el botón la deja fuera) lo comprueba.
- **Guardar la caché por proyecto.** La versión más reciente de un paquete es la misma en todos los proyectos. Usa como clave el ecosistema y el nombre.
- **Guardar con temporizador lo que nunca cambia.** Los peers y las fechas de publicación de una versión publicada se pueden guardar para siempre; las versiones más recientes no.
- **Guardar basura en la caché.** Para la espera de 24 horas solo se guarda una fecha válida, así que "the next scan asks again" (el siguiente análisis vuelve a preguntar).

Para probarlo, `tests/upgrade.test.tsx` tiene "the jump between two versions" (el salto entre dos versiones, con los casos 0.x), "each dependency lands in its group" (cada dependencia cae en su grupo), "the Expo SDK table wins over npm for the modules it pins" (la tabla del SDK de Expo gana a npm para los módulos que fija) y "the summary counts each group" (el resumen cuenta cada grupo). Los tests del panel usan `$.ui.mount` y `ui.press`: "a press on a library copies it, with no copy buttons, and each group folds on its own" (una pulsación en una biblioteca la copia, sin botones de copia, y cada grupo se pliega por su cuenta). Los tests de la antigüedad de las versiones, como "a version younger than minimumReleaseAge says how long it still waits" (una versión más reciente que minimumReleaseAge dice cuánto le queda por esperar) y "a version whose date nobody can read goes up a day after the mod first saw it, and an answer that is not a date is never kept" (una versión cuya fecha nadie puede leer sube un día después de que el mod la viera por primera vez, y una respuesta que no es una fecha nunca se guarda), cubren los motivos de bloqueo con el tiempo.

## Para ir más lejos

- La siguiente guía explica los motivos de bloqueo propios de npm: los peers de la versión nueva, los peers de lo que está instalado y los pins exactos en el árbol de dependencias.
- La línea de Haiku bajo cada versión mayor se pide una vez por salto y se guarda para siempre, así que su coste no se repite.
- La constante de seis horas es una línea. Un mod con menos bibliotecas podría bajarla; uno usado en muchos proyectos grandes podría subirla.
