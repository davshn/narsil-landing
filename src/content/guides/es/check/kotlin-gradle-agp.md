---
title: Kotlin, Gradle y AGP (avanzado)
description: 'Por qué una build de Kotlin o Android no puede subir una herramienta sola, y cómo Narsil Check frena Kotlin ante sus plugins del compilador y comprueba los mínimos entre Gradle, AGP, Kotlin y Compose.'
route: check
order: 17
updated: 2026-11-18
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

## Qué hace

En la mayoría de los ecosistemas una biblioteca es una biblioteca: la subes, y si su propia API no cambió, el proyecto sigue compilando. Una build de Android o de Kotlin Multiplatform (KMP) es distinta. Sus herramientas van por capas, y cada capa está hecha para un rango de la de debajo.

En palabras sencillas, las capas son estas:

- **Gradle** es la herramienta de build. El proyecto fija su versión en el wrapper de Gradle, el pequeño archivo `gradle/wrapper/gradle-wrapper.properties` que dice qué Gradle descargar.
- **El Android Gradle Plugin (AGP)** enseña a Gradle a compilar apps de Android. Cada AGP necesita como mínimo un Gradle concreto.
- **Kotlin** es el lenguaje, y su plugin de Gradle necesita como mínimo un AGP concreto y un Gradle concreto.
- **Los plugins del compilador** (KSP, SKIE y otros) se ejecutan dentro del compilador de Kotlin. Cada versión está hecha para versiones concretas de Kotlin, así que tienen que moverse con Kotlin.
- **Compose Multiplatform** es el framework de UI, y cada versión necesita como mínimo un Kotlin concreto y, desde la 1.7, como mínimo un AGP concreto.

Así que un patch de Kotlin, que parece trivial, puede detener la build porque un plugin del compilador todavía no lo soporta. Un minor de AGP puede fallar porque el Gradle del wrapper es demasiado antiguo. Nada de esto se ve en los números de versión. Es el mismo tipo de problema que los módulos de Expo atados a un SDK, que describió la guía 7.

Narsil Check conoce estos vínculos. Una actualización que rompería alguno va a **Bloqueada**, sea cual sea su salto, con el motivo en palabras. Dos ejemplos del README:

```text
SKIE 0.10.16 es un plugin del compilador de Kotlin: confirma que soporta Kotlin 2.4.21
AGP 8.13.0 necesita Gradle 8.13 o más; el wrapper usa 8.11.1
```

El propio wrapper de Gradle también aparece como algo que subir, igual que las GitHub Actions que fijan tus workflows, porque una CI también es parte de la build.

## Cómo funciona por dentro

Todo esto está en el adaptador de Maven, que lee proyectos de Gradle y de Maven (guía 6). Su `conflictsOf` une tres comprobaciones: `kotlinConflicts` (los plugins del compilador, en `hooks/maven.ts`), `kmpConflicts` (los mínimos cruzados, en `hooks/kmp.ts`) y `lockConflicts` (los bloqueos de dependencias de Gradle). Cada una devuelve frases; cualquier frase bloquea la actualización. Las tres son funciones puras sobre las dependencias analizadas y los archivos del proyecto, así que los tests les pasan una lista y un wrapper y leen las frases.

### Plugins del compilador que deben moverse con Kotlin

`COMPILER_PLUGINS` en `hooks/maven.ts` enumera siete: SKIE, KSP, Mokkery, Realm, Metro, kotlinx-rpc y Anvil. Cada uno se encuentra por sus coordenadas (`co.touchlab.skie`, `com.google.devtools.ksp`, …) o por su clave en el catálogo de versiones. La clave del catálogo importa: el ejemplo del comentario es un módulo `build-logic` que lee `libs.versions.mokkery` directamente, así que ninguna coordenada de los archivos de build nombra Mokkery, y aun así el proyecto lo usa.

Cuando Kotlin sube y el proyecto declara alguno de ellos, la actualización se bloquea:

- **KSP se comprueba con exactitud.** Una versión de KSP1 lleva el Kotlin para el que se hizo, como en `2.4.20-1.0.30`. Si ese prefijo no es el Kotlin nuevo, el motivo es "hace falta un KSP para 2.4.21". Una versión de KSP2 sin Kotlin dentro, como `2.3.0`, funciona con cualquiera y no bloquea.
- **Para los demás se pide confirmación.** Sus versiones no dicen nada de Kotlin, así que el mod no puede comprobarlos. Bloquea y te pide que confirmes el soporte.

Lo que cuenta como Kotlin es `org.jetbrains.kotlin` y sus plugins, nunca `kotlinx` (coroutines y serialization suben por su cuenta).

Falta un plugin de la lista a propósito: el compilador de Compose. Se publica como `org.jetbrains.kotlin.plugin.compose`, así que forma parte del propio Kotlin, con la versión de Kotlin. El registro de tareas explica la decisión: "Compose compiler lockstep with Kotlin left out: separate rows would block each other; catalogs share the kotlin version ref." (se deja fuera el avance conjunto del compilador de Compose con Kotlin: filas separadas se bloquearían entre sí; los catálogos comparten la referencia de versión kotlin). En un catálogo los dos leen la misma versión `kotlin`, así que son una sola fila y suben juntos.

### Los mínimos cruzados, de la propia documentación de las herramientas

`hooks/kmp.ts` contiene cuatro tablas, cada una con la dirección de la que se copió y la fecha en la que estaba al día. El comentario lo dice claramente: "the tables come from the tools' own documentation, quoted below" (las tablas salen de la propia documentación de las herramientas, citada abajo). El registro de tareas recoge por qué están escritas en el código: los metadatos de módulo de Gradle publicados "states none of these" (no indican ninguno de estos).

**De AGP a su Gradle mínimo**, de la página de versiones de AGP de Google, "as of AGP 9.5.0" (a fecha de AGP 9.5.0):

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

En el código la tabla sigue con 7.0 a 7.4.

**De Kotlin al AGP y al Gradle mínimos de su plugin de Gradle**, de la página de Gradle de kotlinlang.org, "as of 2.4.21" (a fecha de 2.4.21). Cada fila se aplica a partir de esa versión de Kotlin:

| Kotlin desde | AGP mínimo | Gradle mínimo |
| ------------ | ---------- | ------------- |
| 2.4.0        | 8.5.2      | 7.6.3         |
| 2.3.0        | 8.2.2      | 7.6.3         |
| 2.1.0        | 7.3.1      | 7.6.3         |
| 2.0.0        | 7.1.3      | 6.8.3         |

**De Compose Multiplatform a su Kotlin y su AGP mínimos**, de las notas de migración del CHANGELOG de JetBrains y de la página de compatibilidad. El Kotlin es el de la plataforma más exigente, iOS y web. 1.12 no indica ningún mínimo nuevo, así que mantiene los de 1.11:

| Compose Multiplatform | Kotlin mínimo | AGP mínimo |
| --------------------- | ------------- | ---------- |
| 1.6                   | 2.0.0         |            |
| 1.7                   | 2.0.0         | 8.1.0      |
| 1.8                   | 2.1.0         | 8.1.0      |
| 1.9                   | 2.1.0         | 8.1.0      |
| 1.10                  | 2.2.0         | 8.1.0      |
| 1.11                  | 2.3.0         | 8.1.0      |
| 1.12                  | 2.3.0         | 8.1.0      |

**KSP desde 2.3.12 necesita AGP 8.12.0**, de las versiones publicadas de KSP.

### Cómo leen el proyecto las comprobaciones

`kmpConflicts` necesita tres datos:

- **El Gradle que ejecuta el wrapper**, que lee `gradleVersionOf` de la línea `distributionUrl`, `…/gradle-9.6.0-bin.zip`. Mira el wrapper de la raíz y `android/gradle/wrapper/…`, donde lo guarda un proyecto de React Native.
- **El AGP y el Kotlin en uso**: la versión más alta que escribe cualquier declaración de esa herramienta.
- **Qué sube**, y a qué versión.

Después, para la actualización en cuestión:

- **AGP**: se busca el minor de la versión nueva. Si el Gradle del wrapper está por debajo de su mínimo, se bloquea. Si no hay wrapper que leer, también se bloquea: "no encontré gradle/wrapper/gradle-wrapper.properties para confirmarlo".
- **Pasar de 8.x a AGP 9**: AGP 9 integra Kotlin, y el código añade dos reglas de la guía de migración de Google. Un módulo que combina `org.jetbrains.kotlin.multiplatform` con `com.android.library` o `com.android.application` debe pasar a `com.android.kotlin.multiplatform.library`, y kapt no funciona (pasa a KSP, o usa `com.android.legacy-kapt`). Estas reglas solo se activan al cruzar. Un proyecto que ya está en 9 ya las resolvió; el registro de tareas recoge que un test las detectó activándose de nuevo en un proyecto así.
- **Kotlin**: la primera fila cuyo "desde" alcanza el Kotlin nuevo da el AGP y el Gradle mínimos.
- **Compose Multiplatform**: solo cuenta su propia línea, el plugin de Gradle y los grupos `runtime`, `foundation`, `ui`, `animation`, `material`, `components` y `desktop`. `org.jetbrains.compose.hot-reload` y `material3.adaptive` tienen su propia numeración de versiones y aquí no son Compose Multiplatform.
- **KSP**: desde 2.3.12, el AGP debe ser 8.12.0 o posterior.

### Solo mínimos, y "más allá de la tabla" significa "confirma"

Dos decisiones dan forma a lo que el mod rechaza.

**Los máximos no se comprueban.** JetBrains publica el AGP y el Gradle más altos con los que se prueba cada Kotlin, pero pasar de ellos no es un fallo. El comentario del código: "The maximums are what is fully supported, not a failure, so they are not checked." (los máximos son lo que tiene soporte completo, no un fallo, así que no se comprueban). El README añade que la propia Google combina versiones que los superan. Bloquear por los máximos frenaría builds que funcionan.

**Una versión más nueva que la tabla bloquea.** AGP 9.6, o Compose Multiplatform 1.13, no están en las tablas. En lugar de adivinar, el mod bloquea con "es más nuevo que la tabla de Google que conozco (hasta 9.5): confirma qué Gradle necesita". Una tabla copiada de la documentación envejece; la lectura segura de una fila desconocida es "pregunta".

### El wrapper como dependencia propia

`hooks/wrapper.ts` convierte el wrapper de la raíz en un ecosistema propio, `gradle-wrapper`. Su última versión sale del servicio de versiones de Gradle, `https://services.gradle.org/versions/current`, que también da la hora de compilación que se usa para la espera de 24 horas (guía 9). La subida reescribe solo la versión en `distributionUrl`; no hay nada que instalar, porque el wrapper descarga la distribución nueva en su siguiente ejecución.

Del código salen dos límites. Un wrapper con `distributionSha256Sum` se bloquea, porque la suma de comprobación pertenece a una distribución y el mod no puede conocer la siguiente; el motivo da el comando `./gradlew wrapper --gradle-version … --gradle-distribution-sha256-sum <sum>`. Y el wrapper de `android/` no se sube: lo eligen React Native y Flutter.

Esto cierra un círculo con la regla de AGP. Cuando AGP se bloquea porque el Gradle del wrapper es demasiado antiguo, el propio wrapper aparece como una actualización trivial. Según el código, subirlo primero y volver a analizar permite que AGP pase su comprobación.

### GitHub Actions en el mismo commit

El commit que añadió el wrapper también añadió `hooks/actions.ts`, un adaptador para las líneas `uses:` de `.github/workflows/*.yml` y `.github/actions/*/action.yml`. Una CI de Android fija así sus pasos de configuración, de modo que envejecen como cualquier dependencia.

Lee una action fijada a una etiqueta completa (`@v6.1.0`) o a un commit con su versión en un comentario (`@<commit> # v6.1.0`). Una etiqueta móvil como `@v6` ya sigue a su versión mayor y se deja fuera. Las últimas versiones salen de las etiquetas de git de la action con `git ls-remote`, y solo se conservan las versiones completas. Para un commit fijado, la subida resuelve primero el commit de la etiqueta nueva, siguiendo las etiquetas anotadas (`^{}`), y si no puede leer uno, no se escribe ningún workflow. El README añade una nota práctica: subir cambios a `.github/workflows` por HTTPS necesita un token con el permiso `workflow`.

### README y código

El README, en su sección sobre estas herramientas, dice "El wrapper solo se lee: nunca entra en el commit del PR". Eso se escribió con `1637e94`, cuando el wrapper solo era contexto para el adaptador de Maven, y sigue siendo cierto para ese adaptador (un test lo comprueba). Desde `7048580` el wrapper también es un ecosistema propio cuyo manifest es `gradle-wrapper.properties`. Según `checkPending` (guía 13), un wrapper subido difiere de `HEAD` y se enumeraría e incluiría en el commit con el resto. Ningún test cubre ese caso en un sentido ni en otro.

## Constrúyelo con Claude

Pídele a Claude un módulo puro que bloquee una actualización de Gradle que el resto de la build no puede aceptar, con el motivo en una frase. La única idea que debe entender bien es que las comprobaciones son mínimos sacados de tablas publicadas, y que una versión que las tablas no conocen bloquea con «confirma» en vez de pasar.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil Check.

> En mi mod de Claude Code `my-panel`, que enumera actualizaciones de Gradle a partir de `gradle/libs.versions.toml`, bloquea las que el resto de la build no puede asumir, con el motivo como una frase. Lee el Gradle del wrapper a partir del `distributionUrl` de `gradle/wrapper/gradle-wrapper.properties`. Mantén tres tablas en un módulo puro, cada una con la URL de la documentación de la que sale y la versión hasta la que está al día: minor de AGP a Gradle mínimo (las notas de versión de AGP de Google), Kotlin a AGP y Gradle mínimos (la página de configuración de Gradle de kotlinlang.org) y minor de Compose Multiplatform a Kotlin y AGP mínimos (su CHANGELOG). Comprueba solo mínimos. Una versión de AGP o de Compose más nueva que su tabla, o AGP sin wrapper, bloquea con "confirma". Cuando Kotlin suba y el proyecto declare KSP, bloquea si el prefijo `x.y.z-` de KSP no es el Kotlin nuevo; para SKIE, bloquea y pide confirmación. Escribe un test por regla con una lista de dependencias y un texto de wrapper, incluida una versión más allá de la tabla.

### Qué revisar en la respuesta de Claude

1. Cada tabla está junto a la URL de la documentación de la que sale y la versión hasta la que está al día.
2. Solo se comprueban mínimos: un AGP que necesita un Gradle más nuevo que el del wrapper bloquea, pero pasar de un máximo publicado no.
3. Una versión de AGP o de Compose Multiplatform más nueva que su tabla, y AGP sin un wrapper que leer, bloquean con una frase que te pide confirmar.
4. Cuando sube Kotlin, KSP solo bloquea si su prefijo `x.y.z-` no es el Kotlin nuevo, y SKIE bloquea y te pide confirmar que lo soporta.
5. Hay un test por regla, alimentado con una lista de dependencias y un texto del wrapper, y uno de ellos usa una versión que va más allá de la tabla.

Si una comprobación falla, dile a Claude lo que ves: "AGP 8.13.0 aparece como una actualización normal mientras mi wrapper sigue usando Gradle 8.11.1".

### Cómo lo pidió el autor

Esta quedó registrada en parte. La regla de los plugins del compilador es anterior a los registros de tareas públicos; los mínimos cruzados tienen las palabras de quien creó Narsil Check.

#### Registrado: "antes de subir corrijamos KMP"

`odd/tasks/release-age-all-ecosystems.md` en narsil-check recoge, en su spec S5, lo que dijo quien creó Narsil Check al saber que Compose Multiplatform y AGP no estaban cubiertos:

> "antes de subir corrijamos KMP. Compose Multiplatform y el Android Gradle Plugin etc, ademas cuando termines lanza el verificador independiente con todo esto"

La spec S6 vuelve a citar la segunda mitad, "lanza el verificador independiente con todo esto", como requisito propio: una comprobación independiente de toda la funcionalidad antes de subir.

#### Registrado en el registro de tareas: cómo se encontró y se construyó

Estas son notas del agente, no palabras de quien creó Narsil Check. La entrada de registro L4 recoge el hueco que llevó a la petición: "Compose Multiplatform and the Android Gradle Plugin are coupled to Kotlin and Gradle versions like Expo modules to the SDK, and no rule here knows them" (Compose Multiplatform y el Android Gradle Plugin están acoplados a versiones de Kotlin y Gradle como los módulos de Expo al SDK, y ninguna regla de aquí los conoce). L5 (2026-11-06) recoge la investigación: la tabla de AGP "matched row by row" (coincidió fila por fila) con la página de Google, los mínimos de Kotlin de kotlinlang.org, que Compose Multiplatform "has no official per-version table" (no tiene una tabla oficial por versión), así que sus mínimos salen de su CHANGELOG, y la decisión de dejar fuera el compilador de Compose.

L6 recoge lo que encontró el verificador independiente: dos bloqueos sobre toda la funcionalidad, uno de ellos en estas reglas. `isCompose` atrapaba `org.jetbrains.compose.hot-reload` y `material3.adaptive`, "which version on their own" (que tienen su propia numeración de versiones). Los dos se corrigieron en un solo lote de correcciones.

#### Reconstrucción a partir del historial de commits

A partir de `git log -- hooks/kmp.ts hooks/wrapper.ts hooks/actions.ts` y `git log -S COMPILER_PLUGINS` en narsil-check:

- `4ea9be0` (2026-11-04) "feat: block upgrades kept on purpose and Kotlin past its compiler plugins" (bloquear las actualizaciones fijadas a propósito y Kotlin más allá de sus plugins del compilador). Los siete plugins, encontrados por coordenada o por clave del catálogo, con KSP comprobado con exactitud. Su mensaje nombra la comprobación sobre la que se hizo: en una plantilla KMP, "Kotlin 2.4.20 -> 2.4.21 is now blocked by SKIE and Mokkery" (Kotlin 2.4.20 -> 2.4.21 ahora queda bloqueado por SKIE y Mokkery).
- `1637e94` (2026-11-06) "feat: block Android and KMP upgrades the rest of the build cannot take" (bloquear las actualizaciones de Android y KMP que el resto de la build no puede asumir). Las cuatro tablas. Su mensaje: "Tables quote Google's and JetBrains' documentation; a version past them waits to be confirmed. The Gradle wrapper is read as context and never committed." (las tablas citan la documentación de Google y de JetBrains; una versión que las supera espera a que se confirme. El wrapper de Gradle se lee como contexto y nunca entra en un commit).
- `40e5723` (2026-11-06) "fix: date Go +incompatible versions at the base path and keep Compose rules to its own line" (fechar las versiones +incompatible de Go en la ruta base y limitar las reglas de Compose a su propia línea). Los dos bloqueos del verificador.
- `7048580` (2026-11-09) "feat: check the Gradle wrapper and GitHub Actions for upgrades" (buscar actualizaciones del wrapper de Gradle y de GitHub Actions). El wrapper como ecosistema propio, bloqueado cuando tiene suma de comprobación, y el adaptador de actions.

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Esta es una versión reducida de la idea, escrita para esta guía. Es TypeScript simple sin API de mod; se conecta al `conflictsOf` de un adaptador como en la guía 6. Está adaptada de `hooks/kmp.ts` y de `kotlinConflicts` en `hooks/maven.ts` en [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Las tablas se recortan a unas pocas filas; los valores son los de `hooks/kmp.ts`.

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

`conflicts('com.android.tools.build:gradle', '8.13.0', deps, '8.11.1')` devuelve la frase sobre Gradle 8.13. Cualquier frase mueve la fila a tu grupo de bloqueadas.

## Errores comunes y cómo probarlo

Estos salen del código, los tests y el registro de tareas de Narsil Check:

- **Tratar un patch de Kotlin como trivial.** Con un plugin del compilador en la build no lo es. Comprueba los plugins en cada salto de Kotlin.
- **Pasar por alto un plugin que solo se lee a través del catálogo.** Un módulo `build-logic` puede no nombrar ninguna coordenada. Mira también las claves del catálogo.
- **Comprobar los máximos.** Son "fully supported" (con soporte completo), no límites. Bloquear por ellos frena builds que funcionan.
- **Adivinar más allá de la tabla.** Una versión desconocida debería preguntar, no pasar.
- **Activar las reglas de migración de AGP 9 en cada subida de AGP 9.** Pertenecen al paso desde 8.x; un test detectó exactamente eso.
- **Reconocer un grupo de forma demasiado amplia.** `org.jetbrains.compose.*` incluye artefactos con sus propias versiones. Nombra los grupos de la línea principal.
- **Tablas sin fuente.** Escribe la URL y la versión "as of" (a fecha de) junto a cada una, para que la siguiente persona sepa dónde comprobarla.
- **Reescribir un wrapper con suma de comprobación.** La suma cambia con la distribución. Bloquea y da el comando.

Para probarlo, `claude plugin test .` ejecuta `tests/kmp.test.tsx`: "the Android Gradle Plugin cannot go past what the Gradle wrapper runs" (el Android Gradle Plugin no puede ir más allá de lo que ejecuta el wrapper de Gradle), "AGP 9 refuses KMP modules on com.android.library and kapt" (AGP 9 rechaza los módulos KMP sobre com.android.library y kapt), "Kotlin cannot go past the AGP and Gradle its Gradle plugin supports at least" (Kotlin no puede ir más allá del AGP y el Gradle mínimos que soporta su plugin de Gradle), "Compose Multiplatform cannot go past the Kotlin and AGP it needs" (Compose Multiplatform no puede ir más allá del Kotlin y el AGP que necesita), "KSP from 2.3.12 needs AGP 8.12" (KSP desde 2.3.12 necesita AGP 8.12), "artifacts under org.jetbrains.compose on their own version line are not Compose Multiplatform" (los artefactos bajo org.jetbrains.compose con su propia línea de versiones no son Compose Multiplatform) y "a wrapper under android/, as a React Native project keeps it, gives the Gradle version too" (un wrapper bajo android/, como lo guarda un proyecto de React Native, también da la versión de Gradle). `tests/wrapper.test.tsx` tiene "a wrapper that checks a checksum is blocked with the reason, since the sum changes too" (un wrapper que comprueba una suma de comprobación se bloquea con el motivo, porque la suma también cambia) y "the vulnerabilities check never asks OSV about the wrapper, which it does not know" (la comprobación de vulnerabilidades nunca pregunta a OSV por el wrapper, que no conoce); `tests/actions.test.tsx` tiene "a new tag whose commit cannot be read leaves every workflow as it was and says which" (una etiqueta nueva cuyo commit no se puede leer deja cada workflow como estaba y dice cuál).

## Para ir más lejos

- Las tablas envejecerán. Un pequeño script que descargue las páginas de Google y de JetBrains y las compare con las tablas diría cuándo actualizarlas.
- Detectar la referencia `kotlin` compartida del catálogo de versiones permitiría al panel decir "sube Kotlin y el compilador de Compose juntos" en lugar de dejarlo implícito.
- El wrapper de android/ de un proyecto de React Native podría recibir una línea informativa, sin botón.

Esta es la última guía de la ruta "Tu propio panel de revisión". Su índice enumera las diecisiete guías, del panel lateral a estas herramientas de build, por si quieres volver a cualquier funcionalidad. Para la base sobre la que se apoya cada guía, las guías de "Fundamentos de mods" cubren de qué está hecho un mod, el objeto `$`, cómo instalar, recargar, validar y probar un mod, las superficies en las que se ejecuta y qué significa la GPL v3 de Narsil cuando reutilizas su código.
