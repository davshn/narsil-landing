---
title: Explicar una versión mayor con Haiku
description: 'Cómo Narsil Check pregunta a Haiku lo difícil que es una versión mayor para el proyecto, con las notas de versión y las líneas que importan la biblioteca, y cómo evita que invente.'
route: check
order: 11
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/explain.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/words.ts
  - repo: check
    path: hooks/adapter.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/upgrade.test.tsx
  - repo: check
    path: odd/tasks/ecosystems-wave-2.md
---

## Qué hace

Una versión mayor dice "algo puede romperse". No dice si se rompe para ti. React 19 quitó varias API antiguas; si tu proyecto nunca las usó, la actualización es pequeña. Para saberlo, abrirías las notas de versión, buscarías en tu código cada sitio que importa la biblioteca y compararías.

Narsil Check hace esa comparación para cada biblioteca del grupo **Versión mayor: revisar cambios**. Bajo cada fila, mientras trabaja, una línea atenuada dice `Analizando con Haiku…`. Después muestra una dificultad y una o dos frases:

```text
react 18.2.0 → 19.2.0
  Dificultad media: React 19 quita propTypes; tus 2 imports no los usan, pero revisa las refs de texto.
```

El ejemplo es el que usan los tests. La línea es verde para `baja`, amarilla para `media` y roja para `alta`.

Una pulsación en la fila copia el salto con su dificultad y su motivo, listo para pegar en una issue o en un prompt. El motivo se pide una vez por salto y se guarda, así que en la siguiente sesión vuelve a estar ahí sin coste.

## Cómo funciona por dentro

`hooks/explain.ts` contiene las partes simples (qué versiones rompen, el prompt, la lectura de la respuesta). `hooks/register.tsx` descarga, ejecuta `git grep` y llama al modelo. Esa separación permite que los tests comprueben el prompt y la lectura como funciones puras.

### Cuándo se ejecuta

Cuando termina un análisis, `scanProject` muestra la lista enseguida y arranca `explainMajors` sin esperarlo. Solo se leen las actualizaciones del grupo `review`: una versión mayor que algo bloquea está en **Bloqueada** y muestra en su lugar sus motivos de bloqueo. Se leen dos a la vez (`EXPLAIN_CONCURRENCY`), así que una lista de veinte versiones mayores no lanza veinte llamadas al modelo juntas. Una fila ya hecha o en curso se salta.

### La primera entrada: las notas de las versiones que rompen

`breakingVersions(current, latest)` nombra las versiones que rompen entre las dos, de la más reciente a la más antigua y como mucho tres: el `x.0.0` de cada versión mayor nueva (de 16 a 19: `19.0.0`, `18.0.0`, `17.0.0`), o por debajo de 1.0.0 el `0.y.0` de cada minor nuevo. Las notas de los patches intermedios se dejan fuera a propósito: los cambios incompatibles se anuncian en la versión que rompe.

Después, `releaseNotes` encuentra el repositorio de GitHub de la biblioteca. Para npm lee el campo `repository` del `node_modules/<name>/package.json` instalado, y si no, de la respuesta del registro; los demás ecosistemas lo dan a través de su adaptador (`repoUrlOf`, `infoUrl` o `repoUrlFor`). Para cada versión que rompe prueba tres nombres de etiqueta en la API de releases de GitHub, porque cada paquete etiqueta de una forma: `v19.0.0`, `@scope/name@19.0.0` para un monorepo, o el simple `19.0.0`.

Las notas de cada versión se recortan a 6.000 caracteres y todas juntas a 12.000 (`NOTES_PER_RELEASE`, `NOTES_TOTAL`), con `[…]` donde se cortó algo. El comentario dice por qué existe el límite por versión: "so a long upgrade guide still leaves room" (para que una guía de actualización larga siga dejando sitio) a las demás versiones.

Cuando ninguna versión tiene notas y el paquete es de npm, el mod lee el `CHANGELOG.md` del paquete desde unpkg y se queda solo con lo que está por encima del encabezado de la versión instalada: lo que cambió desde entonces. unpkg solo sirve paquetes de npm, así que los demás ecosistemas no tienen esa alternativa.

### La segunda entrada: cómo lo usa el proyecto

`usageOf` ejecuta:

```text
git --no-pager grep -n -I -E <pattern> -- . :!node_modules
```

El patrón sale del `importPattern` del adaptador. Para npm reconoce `from 'name'`, `from 'name/sub'`, `require('name')` e `import('name')`; Python reconoce las líneas `import` y `from` con el nombre del módulo (`yaml` para PyYAML); cada ecosistema tiene el suyo. El resultado es el número de archivos y como mucho 40 líneas de como mucho 200 caracteres, cada una como `path:line:text`.

Se usa `git grep` y no un recorrido de archivos porque solo busca en los archivos con seguimiento, se salta los binarios con `-I` y es rápido en un repositorio grande.

### El prompt exacto

El prompt de sistema es `SYSTEM` en `hooks/explain.ts`, citado tal cual está en [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). No ha cambiado desde el primer commit.

```text
You assess how hard a major dependency upgrade is for one specific project.
You get the release notes of the breaking versions and the lines where the project imports the library.
Answer in Spanish, in exactly this form:
DIFICULTAD: baja|media|alta
RAZÓN: one or two sentences, at most 280 characters, naming the concrete breaking change that affects the imports shown, or saying none of them is touched.
Base the answer only on what you are given. Never invent APIs, versions or changes.
If the release notes are missing, say so in the reason and judge only from how much the project uses the library.
```

En español: "Evalúas lo difícil que es una actualización mayor de una dependencia para un proyecto concreto. Recibes las notas de versión de las versiones que rompen y las líneas donde el proyecto importa la biblioteca. Responde en español, exactamente con esta forma: DIFICULTAD: baja|media|alta. RAZÓN: una o dos frases, como mucho 280 caracteres, que nombren el cambio incompatible concreto que afecta a los imports mostrados, o que digan que ninguno se ve afectado. Basa la respuesta solo en lo que se te da. Nunca inventes API, versiones ni cambios. Si faltan las notas de versión, dilo en la razón y juzga solo por cuánto usa el proyecto la biblioteca."

Está escrito en inglés, con las etiquetas de la respuesta, `DIFICULTAD: baja|media|alta` y `RAZÓN`, en español porque el panel habla español.

El mensaje de usuario lo construye `prompt(u, notes, usage)`, también en `hooks/explain.ts`:

```text
Library: react
Upgrade: 18.2.0 -> 19.2.0

The project imports it in 2 files:
src/App.tsx:1:import { useState } from 'react'
src/main.tsx:2:import React from 'react'

Release notes of the breaking versions:
## v19.0.0
…
```

Sus rótulos significan "Biblioteca", "Actualización", "El proyecto la importa en 2 archivos" y "Notas de versión de las versiones que rompen". Si no se encuentran imports, las líneas se sustituyen por "(no imports found: it may be used through config or a CLI)" (no se encontraron imports: puede usarse a través de la configuración o de una CLI). Si no hay notas, la última parte dice "(none found)" (no se encontró ninguna).

### Cómo evita que el modelo invente

Un modelo al que se le pregunta "¿qué tan difícil es React 19?" responderá con lo que recuerda, que puede estar mal o ser anterior a la versión. Cuatro decisiones del diseño van contra eso:

- **Se le da la evidencia.** Las notas y las líneas de import están en el mensaje; el modelo no tiene que recordar ninguna de las dos.
- **Se le dice que use solo eso.** "Base the answer only on what you are given. Never invent APIs, versions or changes." (Basa la respuesta solo en lo que se te da. Nunca inventes API, versiones ni cambios.)
- **Tiene una salida honesta.** Sin notas, debe decirlo y juzgar por cuánto usa el proyecto la biblioteca, en lugar de rellenar el hueco.
- **La respuesta tiene una forma fija.** `parseReason` acepta una respuesta solo cuando tiene a la vez `DIFICULTAD:` con una de las tres palabras y `RAZÓN:` con texto. Cualquier otra cosa se descarta, y la fila dice "Haiku no dio una razón; revisa las notas de la versión.". La razón se recorta a 400 caracteres, así que una respuesta desbocada no puede llenar el panel.

Nada de esto demuestra que la razón sea correcta; la hace comprobable. El panel muestra lo que concluyó Haiku y nombra el cambio incompatible, así que puedes abrir las mismas notas de versión y comprobarlo.

### Llamar a Haiku: `$.model.complete`

```ts
const reply = await $.model.complete({
  model: 'haiku',
  system: SYSTEM,
  prompt: prompt(u, notes, usage),
  maxTokens: 400,
  timeoutMs: EXPLAIN_MS,
})
const reason = reply.isAnswered ? parseReason(reply.text) : undefined
```

Citado de `hooks/register.tsx` en [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later), con otro formato. `EXPLAIN_MS` vale 60 segundos.

Los tipos de 2.1.325 describen `$.model.complete` como "one text completion through the session's own API client" (una compleción de texto a través del propio cliente de API de la sesión), con "No tools, no history, no system prompt beyond the CLI's identity block and `request.system`" (sin herramientas, sin historial, sin prompt de sistema más allá del bloque de identidad de la CLI y `request.system`). Así que Haiku solo ve este mensaje, nada de tu conversación. `model` acepta un alias como `haiku`, "resolved and allowlist-checked like a `--model` value" (resuelto y comprobado contra la lista permitida como un valor de `--model`). El resultado nunca se rechaza por lo que hizo el proveedor: dice `isAnswered`, o da un `reason` (`api-error`, `empty-reply`, `aborted`), y el mod trata todos ellos como "sin razón". Una excepción durante todo el paso muestra "No pude analizar esta actualización.".

Una buena respuesta se escribe en `$.store` bajo `why:<name>@<current>-><latest>` y se guarda para siempre: las notas de una versión publicada no cambian. Una fallida no se guarda, así que el siguiente análisis lo vuelve a intentar.

### Coste

Los tipos dicen que una petición respondida "counts toward the session's cost total, `/cost` and the cost and token metrics" (cuenta para el coste total de la sesión, `/cost` y las métricas de coste y tokens), y que "Nothing caps it per call" (nada lo limita por llamada). El mod lo limita por su cuenta: como mucho 400 tokens de salida, y una entrada de como mucho 12.000 caracteres de notas más 40 líneas cortas. Cada salto se pregunta una vez, para siempre, en esa máquina. Una lista larga de versiones mayores cuesta una vez; las siguientes sesiones leen el almacén.

### Privacidad

Qué sale de tu máquina, y hacia dónde:

- **Al proveedor del modelo** (a través del propio cliente de la sesión): el nombre de la biblioteca, las dos versiones y hasta 40 líneas de import de tu código con sus rutas de archivo. No el resto de tus archivos.
- **A la API de GitHub y a unpkg**: el nombre del paquete y las versiones, para descargar notas públicas. El README menciona el límite sin autenticar de GitHub, 60 peticiones por hora; cuando se agota, el análisis usa el `CHANGELOG.md` o dice que no encontró notas.

Las líneas de import suelen ser inofensivas, pero son tu código. Un mod que lea versiones mayores de paquetes privados debería tenerlo en cuenta.

### README y código

El README dice "Si no hay release, se usa el `CHANGELOG.md` del paquete", sin límite. En el código, esa alternativa es solo para npm, porque pasa por unpkg.

## Cómo se le pidió a la IA

La petición original de esta funcionalidad no quedó registrada: ya está en el primer commit, y ningún registro de tareas público cubre su creación. Un registro de tareas posterior recoge cómo se llevó a los demás ecosistemas, con las palabras del agente.

### Registrado en un registro de tareas

`odd/tasks/ecosystems-wave-2.md` enumera, como spec S5, lo que tenía que seguir funcionando cuando se añadió el segundo grupo de ecosistemas. Esta es la spec del agente, no las palabras de quien creó Narsil Check:

> "Haiku's reason for a major upgrade works for every ecosystem: release notes from the repository each registry records, and the project's imports found with git grep."

En español: la razón de Haiku para una actualización mayor funciona en todos los ecosistemas: notas de versión del repositorio que registra cada registro, y los imports del proyecto encontrados con git grep.

El S3 del mismo archivo enumera "Haiku reasons" (las razones de Haiku) entre los comportamientos que debían quedar sin cambios.

### Reconstrucción a partir del historial de commits

A partir de `git log -- hooks/explain.ts` y `git log -S SYSTEM` en narsil-check:

- `1bf736a` (2026-11-04) "feat: add upgrade panel for npm and Expo projects" (añadir un panel de actualizaciones para proyectos npm y Expo). Su mensaje describe "majors with Haiku's reading of the release notes against the project's imports" (las versiones mayores con la lectura de Haiku de las notas de versión frente a los imports del proyecto). `SYSTEM`, `prompt`, `parseReason`, `breakingVersions` y la caché `why:` ya están aquí, tal como están ahora.
- `a95eb07` (2026-11-04) "refactor: read dependencies through an adapter per ecosystem" (leer las dependencias a través de un adaptador por ecosistema). Cada adaptador recibe su propio `importPattern` y `repoUrlOf`, que es como la razón llega a otros ecosistemas.
- `c50e830` (2026-11-04) "feat: find manifests anywhere in the tree and read four-part versions" (encontrar manifests en cualquier parte del árbol y leer versiones de cuatro partes). Su mensaje: "infoUrl gives release notes a version's own record" (infoUrl da a las notas de versión el registro propio de una versión), para los registros cuya respuesta de la última versión no nombra ningún repositorio.
- `b3ad055` (2026-11-06) "feat: fold upgrade and vulnerability groups, copy a row on click, …" (plegar los grupos de actualizaciones y vulnerabilidades, copiar una fila al hacer clic, …). Una pulsación en una fila la copia con la razón de Haiku, en lugar de los botones de copia.

El prompt en sí nunca cambió. Lo que creció fue de dónde salen las notas y el uso.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil Check.

> En mi mod de Claude Code `my-panel`, bajo cada biblioteca de npm con una actualización mayor, muestra lo difícil que es el salto para este proyecto. Para cada una, encuentra su repositorio de GitHub a partir del campo `repository` de `node_modules/<name>/package.json`, descarga con `$.http.fetch` las notas de versión del `x.0.0` de cada versión mayor nueva (como mucho tres, etiquetas `v<version>`, `<name>@<version>` o `<version>`) y recórtalas a 12.000 caracteres. Encuentra las líneas de import con `$.process.run(['git', '--no-pager', 'grep', '-n', '-I', '-E', pattern, '--', '.', ':!node_modules'])`, como mucho 40. Llama a `$.model.complete` con `model: 'haiku'`, `maxTokens: 400`, un `timeoutMs` de 60 segundos y un prompt de sistema que pida exactamente `DIFFICULTY: low|medium|high` y `REASON:` en como mucho 280 caracteres, basado solo en lo que se le da, sin inventar nunca API, y diciéndolo cuando falten las notas. Acepta la respuesta solo si se pueden leer las dos líneas. Guárdala en caché en `$.store` bajo `why:<name>@<from>-><to>` para siempre. Muestra "Analizando…" mientras se ejecuta. Prueba con `on('model.complete', ...)` que el prompt contiene las notas y una línea de import, y que una respuesta sin la forma muestra una línea alternativa.

## El código mínimo

Esta es una versión reducida de la idea, escrita para esta guía y comprobada con los tipos de Claude Code 2.1.325 (`$.model.complete`, `$.store.get`, `$.store.set`). Está adaptada de `hooks/explain.ts` y `hooks/register.tsx` en [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Las notas y las líneas de import se pasan como entrada; cómo descargarlas se muestra arriba.

```ts
import type { EngineInterface } from 'claude-code'

export type Reason = { difficulty: 'low' | 'medium' | 'high'; text: string }

const SYSTEM = [
  'You assess how hard a major dependency upgrade is for one specific project.',
  'You get the release notes of the breaking versions and the lines where the project imports the library.',
  'Answer in exactly this form:',
  'DIFFICULTY: low|medium|high',
  'REASON: one or two sentences, at most 280 characters.',
  'Base the answer only on what you are given. Never invent APIs, versions or changes.',
  'If the release notes are missing, say so and judge only from how much the project uses the library.',
].join('\n')

export function parseReason(text: string): Reason | undefined {
  const difficulty = /DIFFICULTY:\s*(low|medium|high)/i.exec(text)?.[1]?.toLowerCase()
  const reason = /REASON:\s*([\s\S]+)/i.exec(text)?.[1]?.trim()
  if (!difficulty || !reason) return undefined
  return {
    difficulty: difficulty as Reason['difficulty'],
    text: reason.replace(/\s+/g, ' ').slice(0, 400),
  }
}

export async function explain(
  $: EngineInterface,
  u: { name: string; current: string; latest: string },
  notes: string,
  lines: string[],
): Promise<Reason | undefined> {
  const key = `why:${u.name}@${u.current}->${u.latest}`
  const stored = (await $.store.get(key)) as Reason | undefined
  if (stored) return stored
  const prompt = [
    `Library: ${u.name}`,
    `Upgrade: ${u.current} -> ${u.latest}`,
    '',
    'Import lines:',
    lines.length > 0 ? lines.join('\n') : '(no imports found)',
    '',
    'Release notes of the breaking versions:',
    notes.trim() || '(none found)',
  ].join('\n')
  const reply = await $.model.complete({
    model: 'haiku',
    system: SYSTEM,
    prompt,
    maxTokens: 400,
    timeoutMs: 60_000,
  })
  const reason = reply.isAnswered ? parseReason(reply.text) : undefined
  if (reason) await $.store.set(key, reason)
  return reason
}
```

Ejecuta `explain` desde un análisis que ningún hook espere con await, guarda cada resultado en un atom por clave con un estado `loading` primero, y dibuja la línea bajo la fila a partir de ese atom. Un resultado `undefined` es tu línea alternativa, y no se guarda.

## Errores comunes y cómo probarlo

Estos salen del código y los tests de Narsil Check:

- **Preguntar sin evidencia.** Un modelo con solo un nombre y dos versiones responde de memoria. Envía las notas y el uso.
- **No dejar decir "no lo sé".** Sin la regla de las notas que faltan, el modelo rellena el hueco. Dale la respuesta honesta.
- **Confiar en el texto libre.** Lee una forma fija y descarta lo que no encaje; recorta la longitud.
- **Preguntar de nuevo en cada sesión.** Las notas de una versión no cambian; guarda la razón en caché para siempre, y no guardes los fallos.
- **Esperarlo con await en el análisis.** La lista debe mostrarse enseguida; las razones llegan después.
- **Lanzar todas las llamadas a la vez.** Limita la concurrencia; dos bastan para un panel lateral.
- **Enviar demasiado.** Limita las notas y las líneas. Acota el coste y cuánto de tu código sale de la máquina.

Para probarlo, `claude plugin test .` ejecuta `tests/upgrade.test.tsx`, que responde al modelo con `on('model.complete', ...)`, así que no se hace ninguna petición real. "each major shows the reason Haiku gives from the release notes and the imports, and a press on it copies it" (cada versión mayor muestra la razón que da Haiku a partir de las notas de versión y los imports, y una pulsación la copia) comprueba que el prompt contiene el cuerpo de la release, una línea de import e "in 2 files" (en 2 archivos), y después encuentra la línea "Dificultad media: …" y el texto copiado. "a major read before is not asked again" (una versión mayor leída antes no se vuelve a preguntar) pone primero una razón en el almacén y cuenta las llamadas al modelo. "Haiku's answer is read as a difficulty and a reason" (la respuesta de Haiku se lee como una dificultad y una razón) y "a changelog is cut where the installed version begins" (un changelog se corta donde empieza la versión instalada) prueban las funciones puras.

## Para ir más lejos

- La razón tiene como clave el nombre y las versiones, no el ecosistema. Dos ecosistemas con un paquete del mismo nombre y el mismo salto la compartirían; añadir el ecosistema a la clave los separaría.
- La razón no cambia cuando cambia tu código. Si empiezas a usar una API que la siguiente versión mayor quita, la razón guardada no lo sabrá. Una clave que incluya un hash de las líneas de import volvería a preguntar cuando cambien.
- La siguiente guía es el otro extremo de la lista: las actualizaciones que no necesitan lectura alguna, y el botón que las sube.
