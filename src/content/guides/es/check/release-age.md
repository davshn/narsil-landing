---
title: La espera de 24 horas
description: 'Por qué Narsil Check nunca sube una versión publicada hace menos de un día, dónde dice cada registro cuándo salió una versión y qué pasa cuando nadie lo sabe.'
route: check
order: 9
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/npm.ts
  - repo: check
    path: hooks/adapter.ts
  - repo: check
    path: hooks/pypi.ts
  - repo: check
    path: hooks/cargo.ts
  - repo: check
    path: hooks/golang.ts
  - repo: check
    path: hooks/pub.ts
  - repo: check
    path: hooks/nuget.ts
  - repo: check
    path: hooks/rubygems.ts
  - repo: check
    path: hooks/maven.ts
  - repo: check
    path: hooks/swiftpm.ts
  - repo: check
    path: hooks/actions.ts
  - repo: check
    path: hooks/wrapper.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/release-age.test.tsx
  - repo: check
    path: tests/released.ts
  - repo: check
    path: odd/tasks/release-age-all-ecosystems.md
---

## Qué hace

Una versión publicada hace una hora no ha tenido tiempo de que nadie la pruebe. Si está rota, o si se subió desde una cuenta de mantenimiento comprometida, quienes lo notan primero son quienes la instalaron primero. Los registros y quienes mantienen los paquetes sí retiran las versiones malas, pero solo después de que alguien lo note, y eso lleva tiempo.

Narsil Check le da ese tiempo a cada versión. En cada ecosistema que lee, una versión publicada hace menos de 24 horas no sube: cae en el grupo **Bloqueada**, con el motivo bajo la fila en rojo:

```text
Publicada hace 3 h: Narsil Check espera 24 h antes de subirla
```

El README da la misma razón con sus propias palabras: una versión "que todavía nadie ha probado o que puede venir de una cuenta comprometida" no entra en el proyecto por sí sola.

Para ti no cambia nada más. La fila sigue mostrando el salto, el botón **Actualizar las N** la deja fuera, y el siguiente análisis después de pasado el día la devuelve a su grupo normal.

## Cómo funciona por dentro

La espera tiene cuatro partes: dónde guarda cada registro la fecha, qué cuenta como prueba cuando no hay fecha, cómo se lee la regla propia de un proyecto pnpm y cómo la propia instalación se sujeta al mismo día.

### De dónde sale la fecha

Cada adaptador nombra la dirección donde su registro responde "cuándo se publicó esta versión", y cómo leer la fecha de la respuesta. Son dos campos opcionales del contrato en `hooks/adapter.ts`:

- `releasedUrls(name, version)`: las direcciones que probar, en orden.
- `releasedOf(text, headers)`: la fecha que da una respuesta, de su cuerpo o de sus cabeceras en minúsculas.

Lo que lee cada adaptador, según el código:

| Ecosistema     | Dónde está la fecha                                                                          |
| -------------- | -------------------------------------------------------------------------------------------- |
| npm y Expo     | el mapa `time` del packument; cuando no llega, `pnpm view <name> time --json` o el de npm    |
| PyPI           | `/pypi/<name>/<version>/json`: el `upload_time_iso_8601` más antiguo de los archivos         |
| Go             | el `/@v/<version>.info` del proxy: `Time`                                                    |
| Cargo          | `/api/v1/crates/<name>/<version>` de crates.io: `version.created_at`                         |
| Pub            | `/api/packages/<name>/versions/<version>` de pub.dev: `published`                            |
| NuGet          | el registro de SemVer 1, después el de SemVer 2: `published`                                 |
| RubyGems       | `/api/v2/rubygems/<name>/versions/<version>.json`: `created_at`                              |
| Maven, Gradle  | el POM de la versión, en su propio repositorio y en el Gradle Plugin Portal: `Last-Modified` |
| SwiftPM        | la release de GitHub para la etiqueta (`<tag>` o `v<tag>`): `published_at`                   |
| GitHub Actions | lo mismo que SwiftPM, a través del repositorio de la acción                                  |
| Gradle wrapper | `services.gradle.org/versions/current`: `buildTime`                                          |

Dos decisiones de esa tabla merecen entenderse.

**PyPI lee el archivo más antiguo.** Una versión puede recibir más archivos después (un wheel para una plataforma nueva). El comentario dice por qué cuenta el primero: "The earliest file of the release: when it became installable." (El archivo más antiguo de la versión: cuando pasó a ser instalable.)

**SwiftPM lee la release, no el commit.** La primera versión leía la fecha del commit de la etiqueta. El verificador independiente registrado en el registro de tareas señaló que la fecha de quien hace el commit "can be forged" (se puede falsificar), y la corrección pasó al `published_at` de la release de GitHub, que pone el propio GitHub. El README lo dice: "Es una fecha que pone GitHub, no la del commit, que el autor podría falsificar".

npm es la excepción al contrato: su búsqueda de fechas vive en `hooks/register.tsx` (`npmTimes`), porque el host no devuelve un packument muy grande. El comentario nombra los de astro y tailwindcss, "~10 MB". Cuando el packument no llega o no tiene la versión, el mod se lo pregunta al gestor de paquetes.

### Preguntar una vez, guardarlo para siempre

`releasedAt` en `hooks/register.tsx` consulta esas direcciones con `$.http.fetch` y guarda la respuesta en `$.store` bajo `published:<ecosystem>:<name>@<version>` (la clave de npm no tiene la parte del ecosistema). Una fecha de publicación nunca cambia, así que no tiene temporizador, a diferencia de la caché de seis horas de las versiones más recientes.

Solo se guarda una fecha válida. `dateOf` acepta una cadena que `Date.parse` lea y nada más, así que una página de error o un campo vacío nunca se guarda como fecha, y el siguiente análisis vuelve a preguntar.

### Cuando nadie lo sabe

Algunas versiones no tienen una fecha legible: una etiqueta de Swift sin release de GitHub, un paquete fuera de GitHub, un registro que no responde. La regla que puso quien creó Narsil Check (citada más abajo) es que nada sube sin prueba de que esperó. Una primera versión de esa regla bloqueaba esas versiones para siempre, lo que planteó la pregunta obvia.

La respuesta es `firstSeen`. La primera vez que el mod encuentra una versión sin fecha, escribe la hora actual bajo `seen:<ecosystem>:<name>@<version>`. Una versión no puede ser más reciente que el momento en que se vio por primera vez, así que 24 horas después lleva publicada al menos un día. Mientras tanto, la fila dice:

```text
No pude leer cuándo se publicó y la vi por primera vez hace 3 h: Narsil Check espera 24 h antes de subirla
```

Una hora guardada posterior a la actual se ignora y se reemplaza, así que un reloj que saltó hacia atrás no retiene una versión durante más tiempo.

### La regla en sí: `ageConflict`

`ageConflict` en `hooks/npm.ts` convierte una fecha, la hora actual y una espera en minutos en un motivo o en nada. Es una función pura, así que los tests pueden llamarla con cualquier reloj. `RELEASE_AGE` vale 1440 minutos, "a day, as pnpm 11's minimumReleaseAge by default" (un día, como el minimumReleaseAge de pnpm 11 por defecto), en palabras del código.

`youngConflicts` la ejecuta para cada actualización, de ocho en ocho, antes de decidir los grupos. Sus motivos se suman a los demás motivos de bloqueo de las guías anteriores, y cualquier motivo manda la actualización a **Bloqueada**, sea cual sea su salto.

### Las versiones de Expo también esperan

Una actualización de Expo no es una versión sino un rango que resuelve `npx expo install --fix`. `expoAgeConflict` toma la versión estable más reciente de las fechas de npm que cumple el rango del SDK, y comprueba esa. Mientras es demasiado reciente, el motivo la nombra, por ejemplo "El SDK de Expo pide 17.0.8 (npx expo install --fix). Publicada hace 1 h: …".

### El `minimumReleaseAge` de pnpm

pnpm tiene su propio ajuste para esto, `minimumReleaseAge`, en minutos. El comentario del código dice qué supone sobre él: "pnpm 11 and later wait one day unless pnpm-workspace.yaml or .npmrc says otherwise; pnpm 10 waited for nothing." (pnpm 11 y posteriores esperan un día salvo que pnpm-workspace.yaml o .npmrc digan otra cosa; pnpm 10 no esperaba nada.)

`releaseAgeOf` en `hooks/npm.ts` lo lee en este orden: `minimumReleaseAge:` en `pnpm-workspace.yaml`, después `minimum-release-age` en `.npmrc`, después la versión mayor de pnpm fijada en `packageManager` (por debajo de 11 da 0), y si no, 1440. `releaseMinutes` en `hooks/register.tsx` hace esto solo cuando existe `pnpm-lock.yaml`, y lee los archivos tal como los tiene `HEAD`, con `git show HEAD:<path>`. El README explica por qué: el CI instala desde el commit, y una versión que el panel subiera antes de tiempo haría fallar el `pnpm install --frozen-lockfile` del CI.

De las palabras de quien creó Narsil Check salen dos reglas:

- **Gana la espera más larga.** Un proyecto pnpm con 2880 minutos espera dos días, con el motivo "pnpm espera 48 h para instalarla (minimumReleaseAge)". Un valor más corto nunca baja el día.
- **Sin excepciones.** `minimumReleaseAgeExclude` nunca se lee. El comentario es breve: "the wait has no exceptions here." (la espera no tiene excepciones aquí).

### Retener también la instalación

Bloquear la fila solo cubre la biblioteca que subes. Sus propias dependencias pueden traer algo publicado hace cinco minutos. Donde el gestor de paquetes puede rechazarlo, el botón se lo pide, a través de `releaseAgeEnv`:

- **pnpm** se ejecuta con `PNPM_CONFIG_MINIMUM_RELEASE_AGE` igual a la espera, `PNPM_CONFIG_MINIMUM_RELEASE_AGE_STRICT=true` y una lista de exclusiones vacía, así que una dependencia reciente hace fallar la instalación en lugar de escribirse como excepción.
- **npm** se ejecuta con `npm_config_before` un día atrás, así que cada rango resuelve a versiones publicadas antes de ese momento.

Cuando cualquiera de los dos lo rechaza, `ageRefusal` reconoce el mensaje de la herramienta y el panel lo dice ("Bloqueada por minimumReleaseAge…", "Bloqueada por la espera de 24 h…"), sin actualizar nada. El README es honesto sobre el resto: yarn, bun y cualquier otro ecosistema no tienen un interruptor así, de modo que allí la espera se aplica a la biblioteca que sube, no a lo que trae.

## Constrúyelo con Claude

Pídele a Claude que bloquee cualquier actualización cuya versión nueva se haya publicado hace menos de 24 horas. La única idea que debe entender bien es qué cuenta como prueba de antigüedad: una fecha válida del registro, o la hora en que el mod vio la versión por primera vez, y nunca nada.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil Check.

> En mi mod de Claude Code `my-panel`, bloquea cualquier actualización cuya versión nueva se haya publicado hace menos de 24 horas. Escribe una función pura `ageReason(published, now, minutes, seen)` que devuelva un motivo en palabras o `undefined`: con una fecha válida, bloquea mientras sea más reciente que `minutes`; sin ella, usa `seen` (cuando el mod vio la versión por primera vez) como prueba, y bloquea cuando no hay ninguna de las dos. Para PyPI, lee la fecha de `https://pypi.org/pypi/<name>/<version>/json` como el `upload_time_iso_8601` más antiguo de `urls`, con `$.http.fetch`. Guarda una fecha válida en `$.store` bajo `published:pypi:<name>@<version>` para siempre y nunca guardes nada que no sea una fecha. Guarda la hora en que se vio por primera vez bajo `seen:pypi:<name>@<version>`. Pon una actualización bloqueada en un grupo `blocked` con el motivo bajo su fila, y déjala fuera del botón "Actualizar todas". Prueba la función con un `now` fijo: una hora de antigüedad, dos días de antigüedad, sin fecha y sin `seen`, sin fecha y con `seen` de hace un día.

### Qué revisar en la respuesta de Claude

1. Con una fecha válida, la actualización queda bloqueada mientras la versión sea más reciente que la espera, y el motivo bajo la fila lo dice en palabras.
2. Sin fecha, la hora en que se vio por primera vez es la prueba. Sin ninguna de las dos, la actualización queda bloqueada: «sin fecha» nunca significa «suficientemente antigua».
3. Solo un valor que se puede leer como fecha se guarda bajo `published:…`, así que nunca se guarda una página de error. La hora en que se vio por primera vez se guarda bajo `seen:…`.
4. Para PyPI, la fecha es el `upload_time_iso_8601` más antiguo de los archivos de la versión, cuando pasó a poder instalarse.
5. Una actualización bloqueada está en el grupo de bloqueadas, el botón "Actualizar todas" la deja fuera, y los tests usan un `now` fijo para los cuatro casos que nombra el prompt.

Si una comprobación falla, dile a Claude lo que ves: "una versión sin fecha legible lleva tres días bloqueada".

### Cómo lo pidió el autor

Esta funcionalidad está registrada con las palabras de quien creó Narsil Check, en el registro de tareas público de narsil-check `odd/tasks/release-age-all-ecosystems.md`. La guía anterior cita las mismas entradas para los grupos; aquí se leen por lo que dicen sobre la espera.

#### Registrado: de pnpm a todos los ecosistemas

Antes de esta tarea ya había un bloqueo para el `minimumReleaseAge` de pnpm, y quien creó Narsil Check había fijado su regla al corregirlo. El registro de tareas la conserva como S4, con sus palabras:

> "siempre que haya minimumReleaseAge se bloquee la actualizacion automatica y se marque el bloqueo, sin excepcion alguna"

Esa frase es el origen de dos comportamientos del código: una lista de exclusiones nunca cuenta, y una fecha que no se puede leer también bloquea.

La entrada de registro L1 (2026-11-06) recoge la petición que lo extendió. Quien creó Narsil Check preguntó si el problema de Expo también pasaba con KMP u otros lenguajes, y después eligió:

> "El primero me interesa, deberíamos implementar algo similar para los otros lenguajes, es más seguro"

Ante la pregunta de cuánto esperar, la respuesta fue "24 horas está perfecto".

#### Lo que hizo el agente con ello

El resto del registro son las notas del propio agente, no las palabras de quien creó Narsil Check. La entrada L2 recoge cómo se encontró la fecha de cada registro: una prueba por registro, con un paquete real, antes de escribir código. La entrada L3 recoge la comprobación de la instalación de npm: con `npm_config_before` un día atrás, npm rechazó una versión de tailwindcss de hacía una hora y resolvió el rango a la anterior. La entrada L6 recoge los hallazgos del verificador independiente, entre ellos que la fecha de quien hace el commit en SwiftPM "can be forged" (se puede falsificar).

#### Registrado: la corrección sobre las fechas que faltan

El mismo día, quien creó Narsil Check notó el coste de "una fecha ilegible bloquea". L7 cita la pregunta:

> "que pasa si una version siempre trae fecha ilegible? nunca la vamos a actualizar?"

El registro recoge la propuesta del agente (esperar 24 horas desde que el mod vio la versión por primera vez, guardar solo fechas válidas, leer la fecha de la release de SwiftPM en lugar de la del commit) y la respuesta de quien creó Narsil Check, "si hazlo asi". El diseño es del agente; la pregunta y la aprobación son de quien creó Narsil Check.

#### Reconstrucción a partir del historial de commits

A partir de `git log -S releasedUrls` y `git log -S ageConflict` en narsil-check:

- `690c1bb` (2026-11-06) "feat: block upgrades pnpm would refuse under minimumReleaseAge" (bloquear las actualizaciones que pnpm rechazaría con minimumReleaseAge). Su mensaje dice que las entradas de `minimumReleaseAgeExclude` "are honored" (se respetan).
- `54ac6aa` (2026-11-06) "fix: block every upgrade under pnpm's minimumReleaseAge, with no exceptions" (bloquear toda actualización con el minimumReleaseAge de pnpm, sin excepciones). La lista de exclusiones pasa a ignorarse, una fecha ilegible bloquea, y las fechas recurren a `pnpm view` porque los packuments grandes "never reached the hooks module" (nunca llegaban al módulo de hooks).
- `1492ca5` (2026-11-06) "feat: hold every ecosystem's upgrades for 24 hours after release" (retener las actualizaciones de cada ecosistema durante 24 horas después de su publicación). Cada adaptador recibe `releasedUrls`; SwiftPM sigue leyendo el commit de la etiqueta.
- `ca13b3c` (2026-11-06) "feat: hold Expo SDK-pinned versions for 24 hours too" (retener también 24 horas las versiones fijadas por el SDK de Expo).
- `8c5f2a3` (2026-11-06) "feat: install npm and pnpm upgrades under the 24-hour wait through the whole tree" (instalar las actualizaciones de npm y pnpm bajo la espera de 24 horas en todo el árbol).
- `54cd243` (2026-11-06) "feat: let a version with no readable date go up a day after it was first seen" (dejar que una versión sin fecha legible suba un día después de verla por primera vez). La corrección de L7, con SwiftPM pasado a la fecha de la release.
- `40e5723` (2026-11-06) "fix: date Go +incompatible versions at the base path and keep Compose rules to its own line" (fechar las versiones +incompatible de Go en la ruta base y mantener las reglas de Compose en su propia línea). Un hallazgo del verificador.
- `7048580` (2026-11-09) "feat: check the Gradle wrapper and GitHub Actions for upgrades" (revisar actualizaciones del Gradle wrapper y de GitHub Actions). Los dos adaptadores nuevos llegan con sus fechas.

El patrón: la regla estricta llegó primero y era correcta, y la única corrección la mantuvo estricta sin que se quedara atascada.

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Esta es una versión reducida de la idea, escrita para esta guía y comprobada con los tipos de Claude Code 2.1.325 (`$.http.fetch`, `$.store.get`, `$.store.set`). Está adaptada de `hooks/npm.ts` y `hooks/register.tsx` en [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Solo maneja PyPI; otro registro es una URL más y un lector más.

```ts
import type { EngineInterface } from 'claude-code'

export const WAIT_MINUTES = 24 * 60

const dateOf = (text: unknown) =>
  typeof text === 'string' && !Number.isNaN(Date.parse(text)) ? text : undefined

// Why a version must wait, or undefined when it is old enough.
export function ageReason(
  published: string | undefined,
  now: number,
  minutes: number,
  seen?: number,
): string | undefined {
  const from = published ? Date.parse(published) : seen
  if (from === undefined || Number.isNaN(from))
    return `No publication date: waiting ${minutes / 60} h`
  const age = Math.floor((now - from) / 60_000)
  if (age >= minutes) return undefined
  const ago = age >= 60 ? `${Math.floor(age / 60)} h` : `${age} min`
  return published ? `Published ${ago} ago` : `No date; first seen ${ago} ago`
}

async function releasedAt($: EngineInterface, name: string, version: string) {
  const key = `published:pypi:${name}@${version}`
  const cached = dateOf(await $.store.get(key))
  if (cached) return cached
  const res = await $.http
    .fetch(`https://pypi.org/pypi/${encodeURIComponent(name)}/${encodeURIComponent(version)}/json`)
    .catch(() => undefined)
  let published: string | undefined
  try {
    const files = res?.ok
      ? ((JSON.parse(res.text) as { urls?: { upload_time_iso_8601?: unknown }[] }).urls ?? [])
      : []
    published = dateOf(
      files
        .map((f) => f.upload_time_iso_8601)
        .filter((t): t is string => typeof t === 'string')
        .sort()[0],
    )
  } catch {
    published = undefined
  }
  if (published) await $.store.set(key, published)
  return published
}

async function firstSeen($: EngineInterface, name: string, version: string, now: number) {
  const key = `seen:pypi:${name}@${version}`
  const seen = await $.store.get(key)
  if (typeof seen === 'number' && seen <= now) return seen
  await $.store.set(key, now)
  return now
}

export async function waitReason($: EngineInterface, name: string, version: string) {
  const now = Date.now()
  const published = await releasedAt($, name, version)
  const seen = published ? undefined : await firstSeen($, name, version, now)
  return ageReason(published, now, WAIT_MINUTES, seen)
}
```

Llama a `waitReason` para cada actualización durante el análisis, y trata un motivo devuelto como cualquier otro motivo de bloqueo. Ten en cuenta que, con la alternativa de la primera vez vista, el caso de "ninguna de las dos" de `ageReason` solo ocurre si no se puede escribir en el almacén.

## Errores comunes y cómo probarlo

Estos salen del código, el registro de tareas y los commits de Narsil Check:

- **Dejar pasar una fecha desconocida.** "Sin fecha" nunca debe significar "suficientemente antigua". La primera versión de pnpm de Narsil Check dejaba pasar paquetes grandes porque sus fechas nunca llegaban.
- **Bloquear para siempre una fecha desconocida.** El error contrario, el que detectó L7. Una hora de primera vez vista convierte "desconocida" en "al menos así de antigua".
- **Guardar en caché algo que no es una fecha.** Una página de error guardada como fecha se volvería a leer en cada análisis. Guarda solo lo que se interpreta como fecha.
- **Confiar en una fecha que escribe quien publica.** La fecha de un commit la puede poner quien hizo el commit. Prefiere una fecha que ponga el registro o el host.
- **Leer la hora del archivo más reciente.** En PyPI, la versión pasó a ser instalable con su primer archivo.
- **Dejar que un ajuste más corto del proyecto baje la espera.** Toma la más larga entre tu propia regla y la del proyecto.
- **Leer la copia de trabajo cuando el CI lee el commit.** Por eso el ajuste de pnpm se lee en `HEAD`.

Para probarlo, `claude plugin test .` ejecuta `tests/release-age.test.tsx`: "each registry says where and when a version was published" (cada registro dice dónde y cuándo se publicó una versión) llama a `releasedUrls` y `releasedOf` de cada adaptador con la forma de una respuesta real; "a version whose date cannot be read waits a day from when the mod first saw it" (una versión cuya fecha no se puede leer espera un día desde que el mod la vio por primera vez) y "the mod's own wait says so, in every ecosystem" (la propia espera del mod lo dice, en cada ecosistema) llaman a `ageConflict` con un reloj fijo. `tests/released.ts` responde a la URL de fecha de cada registro con una fecha de hace un año por defecto, para que los demás tests no queden bloqueados por accidente, y con una fecha reciente para las URL que nombra un test. El comportamiento de pnpm y npm está en `tests/upgrade.test.tsx`, por ejemplo "npm installs with before set a day back, so a range resolves only to versions a day old, its dependencies included" (npm instala con before un día atrás, así que un rango solo resuelve a versiones de un día de antigüedad, incluidas sus dependencias).

## Para ir más lejos

- La tabla del README no incluye el Gradle wrapper (el `buildTime` de `services.gradle.org`) ni GitHub Actions (la release, como SwiftPM): los dos llegaron después, en `7048580`, y solo el código muestra de dónde salen sus fechas.
- El registro de tareas enumera advertencias que el verificador dejó abiertas, como el límite sin autenticar de GitHub de 60 peticiones por hora para las fechas de SwiftPM. Una versión cuya fecha no se puede leer por ese motivo recurre a la primera vez vista.
- Veinticuatro horas es una constante, `RELEASE_AGE`. Un mod para un equipo con una política más estricta podría subirla, y la regla de pnpm muestra cómo respetar un ajuste más largo del proyecto sin dejar pasar uno más corto.
