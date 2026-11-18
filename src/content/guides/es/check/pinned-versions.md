---
title: Versiones fijadas a propósito
description: 'Cómo Narsil Check lee un comentario como "# pinned: 3.7 breaks auth" en un manifest y deja esa biblioteca fuera del botón de actualizar, con el comentario como motivo.'
route: check
order: 10
updated: 2026-11-17
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

## Qué hace

A veces una versión es antigua a propósito. Una biblioteca rompió algo en su siguiente versión, un plugin solo admite esta, o el equipo acordó esperar a una migración. Quien lo decidió suele dejar un comentario junto a la versión, y la siguiente persona que mira el manifest lo lee.

Una herramienta que sube versiones también debería leerlo. En Narsil Check, un comentario que dice que la versión se mantiene a propósito manda esa biblioteca a **Bloqueada**, y el propio comentario es el motivo bajo la fila:

```toml
[versions]
# Fijar 2.4.20 hasta confirmar soporte de SKIE para 2.4.21
kotlin = "2.4.20"
ktor = "3.6.1" # pinned: 3.7 breaks auth
```

Este ejemplo es del README. En el panel, la fila de ktor recibe:

```text
Fijada a propósito: «pinned: 3.7 breaks auth»
```

El comentario `pinned: 3.7 breaks auth` significa "fijada: 3.7 rompe la autenticación". El botón **Actualizar las N** nunca toma una biblioteca bloqueada, así que la decisión escrita en el manifest se mantiene hasta que alguien quite el comentario.

## Cómo funciona por dentro

### Las palabras: `HOLD`

El encargo de esta ruta sitúa la detección en `hooks/words.ts`; en el código vive en `hooks/adapter.ts`, junto al contrato que cumple cada ecosistema. Es una expresión regular:

```ts
const HOLD =
  /\b(pin(ned)?|hold|keep|freeze|frozen|do ?n[o']t (upgrade|update|bump)|fij(ar|ad[oa]|o)|congelad[oa]|no (actualizar|subir))\b/i
```

Está citada de [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). En inglés reconoce pin, pinned, hold, keep, freeze, frozen, "do not" o "don't" seguidos de upgrade, update o bump; y en español, fijar, fijado, fijada, fijo, congelado o congelada, "no actualizar" y "no subir". No distingue mayúsculas, y `\b` la limita a palabras completas, así que "keeper" o "pinch" no cuentan.

El README enumera la mayoría de estas palabras, pero no todas: "frozen", "fijo", "no subir" y las formas con "update" y "bump" solo están en el código.

### Qué comentario cuenta: `commentOf` y `holdNote`

`commentOf` encuentra el comentario que lleva una línea: después de `#`, `//` o `<!--` (precedidos de un espacio o al principio de la línea), quitando un `-->` de cierre. Esos tres cubren todos los manifests que lee el mod que admiten comentarios: TOML (`Cargo.toml`, `pyproject.toml`, el catálogo de versiones de Gradle), `requirements.txt`, `pubspec.yaml`, el `Gemfile`, `go.mod`, los scripts de Gradle, `Package.swift` y el XML de `pom.xml` y de los archivos `.csproj`.

Después, `holdNote(files, keys, spec)` busca, en cada archivo que leyó el adaptador, la línea que escribe esta dependencia:

1. La línea debe contener la versión tal como está escrita (`spec`) y mencionar una de las `keys` como nombre completo. Las claves son el nombre de la dependencia, su nombre visible y, para una fila del catálogo de versiones, su clave de versión (`kotlin` en `versions.kotlin`).
2. Cuenta el comentario de esa línea.
3. La línea de arriba cuenta solo cuando es un comentario por sí sola. Un comentario al final de la línea de arriba pertenece a otra declaración.

Cada regla está ahí por un motivo que fijan los tests. "Another library's line with the same version is not this one's" (la línea de otra biblioteca con la misma versión no es la de esta): `other = "2.4.20" # keep` no retiene kotlin. Un comentario sin palabra de retención, como `# the DI library`, "is only a comment" (es solo un comentario). Y la misma comprobación funciona para un `// do not upgrade: needs JDK 21` de Gradle y un `# hold until the 8.0 migration` de un Gemfile.

### Dónde se une al análisis

`scanGeneric` en `hooks/register.tsx`, el análisis por el que pasan todos los ecosistemas salvo npm, la llama para cada actualización después de que responda el registro:

```ts
const hold = holdNote(files, [u.name, u.display ?? '', ref ?? ''], u.spec)
u.conflicts = [
  ...(hold ? [`Fijada a propósito: «${hold}»`] : []),
  ...(adapter.conflictsOf?.(u, deps, files) ?? []),
  ...(young.get(u) ?? []),
]
if (u.conflicts.length > 0) u.group = 'blocked'
```

Citado de [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later), con otro formato. El motivo de retención va primero, antes de lo que el ecosistema sabe que rompe y de la espera de 24 horas de la guía anterior. Cualquier motivo hace que la actualización sea `blocked`, así que un patch fijado queda tan bloqueado como una versión mayor fijada.

Después, el panel lo dibuja como cualquier fila bloqueada: los motivos unidos por `·` en rojo bajo la biblioteca. Una pulsación en la fila copia el salto con sus motivos, listo para pegar en una issue.

### Por qué npm queda fuera

`package.json` es JSON, y JSON no tiene comentarios. `scanNpm` nunca llama a `holdNote`, y el README lo dice: la comprobación se hace "en cualquier ecosistema cuyo manifest admite comentarios (todos menos npm, cuyo `package.json` no los tiene)".

Lo que npm sí tiene es una idea distinta con un nombre parecido. Las "versiones fijadas en el árbol" (la guía anterior) son versiones exactas que exige otro paquete instalado, leídas de `package-lock.json`, no una decisión de una persona. Escribir una versión exacta en `package.json` (`"1.2.0"` en lugar de `"^1.2.0"`) tampoco se lee como retención: el botón de actualizar la sigue subiendo, pasándole la versión nueva al gestor de paquetes sin prefijo (`rangeFor` en `hooks/npm.ts`, ver la guía 12).

Una línea del README puede confundir aquí. Su lista de detalles dice "Expo, peerDependencies y versiones fijadas se revisan solo en npm". En esa línea, "versiones fijadas" significa los pins del árbol de npm, no los comentarios de esta guía, que se comprueban en todas partes salvo en npm.

### Fijadas por sintaxis, no por un comentario

Dos ecosistemas tienen su propia forma de decir "esta versión exacta", y el mod también lo trata como una decisión:

- **SwiftPM.** Un requisito escrito con `exact:` en `Package.swift`, o `exactVersion` en un proyecto de Xcode, activa `isExact` en la dependencia. El `conflictsOf` del adaptador de SwiftPM da entonces "Fijada a la versión exacta 1.2.0: revisa por qué antes de subirla". La razón del README: "suele ser una decisión a propósito".
- **Gradle.** Una biblioteca que un `gradle.lockfile` retiene en otra versión se bloquea, porque una compilación con bloqueo de dependencias la rechaza hasta que el lock se regenere con `--write-locks`.

### Por qué un comentario y no un archivo de ajustes

Ni el código ni los commits recogen por qué la retención vive en los comentarios del manifest y no en una lista propia del mod. Leyendo el diseño: el comentario ya es donde la gente escribe esas decisiones, viaja con el repositorio a todo el equipo y lleva su motivo, que es justo lo que la fila bloqueada necesita mostrar. Una lista guardada por el mod viviría en una sola máquina y no diría nada sobre el porqué. Ese razonamiento es una interpretación, no una decisión registrada.

## Cómo se le pidió a la IA

La petición original de esta funcionalidad no quedó registrada: ningún registro de tareas público de narsil-check la cubre. Lo que sigue es una reconstrucción.

### Reconstrucción a partir del historial de commits

A partir de `git log -S holdNote` y `git log -S lockConflicts` en narsil-check:

- `4ea9be0` (2026-11-04) "feat: block upgrades kept on purpose and Kotlin past its compiler plugins" (bloquear las actualizaciones retenidas a propósito y Kotlin por delante de sus plugins del compilador). Toda la funcionalidad en un commit. Su mensaje: "A comment with a hold word (pin, hold, keep, freeze, do not upgrade, fijar, congelado, no actualizar) on a version's line, or alone on the line above, blocks that upgrade with the comment as its reason." (Un comentario con una palabra de retención (pin, hold, keep, freeze, do not upgrade, fijar, congelado, no actualizar) en la línea de una versión, o solo en la línea de arriba, bloquea esa actualización con el comentario como motivo.) También renombró el grupo de "Bloqueada por otras dependencias" a simplemente **Bloqueada**, "since a dependency is no longer its only reason" (ya que una dependencia ya no es su único motivo). El mensaje nombra el caso en que se comprobó: una plantilla de Kotlin Multiplatform donde el patch de Kotlin queda ahora bloqueado por sus plugins del compilador.
- `7125ffd` (2026-11-09) "fix: stop the upgrade button from breaking builds it cannot check" (evitar que el botón de actualizar rompa compilaciones que no puede comprobar). Añade los dos pins por sintaxis: una biblioteca de Gradle que retiene un `gradle.lockfile`, y "a Swift package pinned to an exact version. Neither counts as trivial any more." (un paquete de Swift fijado a una versión exacta. Ninguno de los dos cuenta ya como trivial.)

El commit empareja la comprobación de comentarios con la regla de los plugins del compilador de Kotlin, y el archivo de tests que cubre ambas es `tests/holds.test.tsx`. Las dos comparten una idea: algunas actualizaciones parecen triviales por el número y no lo son, y el motivo tiene que mostrarse en palabras.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil Check.

> En mi mod de Claude Code `my-panel`, que enumera dependencias desactualizadas de `Cargo.toml` y `pyproject.toml`, bloquea cualquier dependencia cuya versión se mantenga a propósito con un comentario. Escribe una función pura `holdNote(files, keys, spec)`: para cada línea que contenga la versión `spec` y mencione una de las `keys` como nombre completo, lee el comentario después de `#`, `//` o `<!--` en esa línea, o en la línea de arriba solo cuando esa línea sea un comentario por sí sola, y devuélvelo cuando contenga una palabra de retención (pin, pinned, hold, keep, freeze, "do not upgrade", y en español fijar, fijado, congelado, "no actualizar"), reconociendo palabras completas y sin distinguir mayúsculas. Pon una dependencia retenida en el grupo `blocked` con el motivo "Fijada a propósito: «comentario»", y déjala fuera del botón "Actualizar todas". Sáltate `package.json`, que no tiene comentarios. Prueba que un comentario al final de la línea de arriba no cuenta, que la línea de otra dependencia con la misma versión no cuenta y que un comentario sin palabra de retención no bloquea.

## El código mínimo

Esta es una versión reducida de la idea, escrita para esta guía. Es TypeScript sin la API del mod, adaptado de `hooks/adapter.ts` en [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later).

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

Pasa solo los archivos del ecosistema que se analiza. La comprobación de `mentions` evita que `kotlin` coincida con `kotlinx-coroutines`, porque un punto o un guion junto al nombre significa que forma parte de uno más largo.

## Errores comunes y cómo probarlo

Estos salen del código y los tests de Narsil Check:

- **Contar un comentario al final de la línea de arriba.** En `a = "1.0" # keep` seguido de `b = "1.0"`, el comentario es de `a`. Solo un comentario solo en su línea habla por la siguiente.
- **Buscar solo la versión.** Dos bibliotecas pueden compartir la misma cadena de versión. La línea también debe nombrar la dependencia.
- **Reconocer parte de un nombre.** `kotlin` dentro de `kotlinx` es otra biblioteca; el nombre debe ir solo.
- **Palabras demasiado amplias.** `keep` también reconoce un comentario como "keep in sync with the server" (mantener sincronizado con el servidor), que bloquearía esa biblioteca. Eso se deduce de la expresión regular; si tus proyectos usan comentarios así, acota la lista.
- **Buscar comentarios en JSON.** No los hay; no inventes una convención que el archivo no puede llevar, o documéntala claramente si lo haces.
- **Ocultar el motivo.** El comentario es lo más útil que se puede mostrar: es la propia explicación de la persona.

Para probarlo, `claude plugin test .` ejecuta `tests/holds.test.tsx`. "a comment with a hold word on the version line, or the line above, keeps it" (un comentario con una palabra de retención en la línea de la versión, o en la de arriba, la retiene) llama a `holdNote` con líneas de TOML, Gradle y Gemfile, incluidos los casos que no deben contar. "a version kept by a comment is blocked with that comment" (una versión retenida por un comentario se bloquea con ese comentario) recorre todo el panel con `$.ui.mount`: encuentra el texto "Fijada a propósito: «keep: 1.11.1 breaks the iOS test runner»" y comprueba que no se dibuja ningún botón **Actualizar**.

## Para ir más lejos

- Una retención podría llevar un final: "pin until 2027-01" (fijar hasta 2027-01) podría dejar de bloquear después de esa fecha. Narsil Check no lo hace; el comentario retiene hasta que alguien lo quita.
- npm podría tener una convención propia, como una clave bajo un campo personalizado en `package.json`. El mod no tiene ninguna, y el README dice claramente que npm no se comprueba.
- La siguiente guía lee con Haiku las notas de versión de un salto mayor, que a menudo es como alguien encuentra el motivo para escribir un comentario de retención.
