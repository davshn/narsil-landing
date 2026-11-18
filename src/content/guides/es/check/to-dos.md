---
title: Pendientes
description: 'Cómo Narsil Check guarda una lista de pendientes por proyecto en un archivo JSON sin seguimiento, la mantiene fuera de git y nunca sobrescribe una lista dañada sin hacer una copia.'
route: check
order: 15
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/todos.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: README.md
  - repo: check
    path: tests/todos.test.tsx
---

## Qué hace

Mientras trabajas en una cosa se te ocurren otras tres: un README que revisar, una actualización que probar más tarde, un test que añadir. Acaban en algún sitio fuera del proyecto, o se pierden. Narsil Check da a cada proyecto su propia lista corta, en el panel, al final.

La sección es **Pendientes**:

```text
● ▾ Pendientes · 2
  ○ ▾ Raise TypeScript to the next major
       Check moduleResolution first
  ○ Review the README
  [ Nueva tarea (nombre: contenido) ]  Agregar
```

- **Añadir**: escribe en el campo y pulsa Enter. Lo que va después de los primeros dos puntos es el contenido: `Raise TypeScript: check moduleResolution first`. Sin dos puntos, la tarea solo tiene nombre.
- **Leer**: una pulsación en un nombre muestra u oculta su contenido. Una tarea sin contenido no se despliega.
- **Terminar**: una pulsación en `○` quita la tarea. No se guarda un historial de tareas terminadas.

El punto es amarillo mientras algo espera y gris cuando la lista está vacía. La sección se abre al empezar una sesión cuando la lista tiene algo, y se queda plegada cuando está vacía. En el teléfono no hay campo de texto (la app móvil no dibuja ninguno); allí la lista se lee, las tareas se terminan con `○` y las nuevas se añaden a través de Claude, como muestra la siguiente guía.

La lista pertenece al proyecto, no a la sesión ni a los ajustes de la máquina. Es un archivo dentro del proyecto, y nunca llega a un commit.

## Cómo funciona por dentro

`hooks/todos.ts` contiene las partes simples: dónde vive el archivo, cómo se lee y se escribe, cómo se divide una entrada en sus dos puntos, y la línea del archivo de exclusión de git. `hooks/register.tsx` lee y escribe el archivo y dibuja la sección.

### Dónde vive la lista

El archivo es `.atl/narsil-check/pendientes.json`, bajo la raíz del proyecto. La raíz es el nivel superior de git (`git rev-parse --show-toplevel`) o, si no, la carpeta de la sesión. Usar el nivel superior de git significa que se encuentra la misma lista desde cualquier subcarpeta en la que abras la sesión.

El formato es un JSON pequeño:

```json
{
  "version": 1,
  "tasks": [
    { "id": "mh3k2a1b4c9z", "name": "Review the README" },
    { "id": "mh3k2f9x0q1w", "name": "Raise TypeScript", "content": "Check moduleResolution first" }
  ]
}
```

El campo `version` se escribe pero todavía no se lee; deja sitio para cambiar el formato más adelante. Cada `id` es la hora en base 36 más cuatro caracteres aleatorios, así que dos tareas con el mismo nombre siguen siendo distintas y Claude puede nombrar una con exactitud. Los ids de arriba son inventados.

¿Por qué un archivo y no `$.store`? El almacén pertenece al mod en esa máquina. Un archivo en el proyecto es del proyecto: puedes abrirlo, editarlo a mano, hacer una copia de seguridad, y se mueve con la carpeta. Y permite que un proyecto escriba en la lista de otro proyecto, algo que usa la siguiente guía.

### Mantenerla fuera de git

La lista es personal; un pull request nunca debería llevarla. Añadirla a `.gitignore` cambiaría un archivo con seguimiento y pondría ese cambio delante de todo el mundo. Así que el mod usa en su lugar el archivo de exclusión local de git, que funciona como `.gitignore` pero nunca entra en un commit.

`excludeTodos` pregunta a git dónde está ese archivo, con `git rev-parse --git-path info/exclude`, en lugar de suponer `.git/info/exclude`. En un worktree enlazado `.git` es un archivo, no una carpeta, y git responde con el sitio correcto. Después, `withExclude` añade la línea `/.atl/narsil-check/` a menos que el archivo ya la tenga (o `.atl/narsil-check` o `.atl/narsil-check/`), y conserva un salto de línea final.

Esto se ejecuta en cada cambio, y se puede repetir sin riesgo: la línea se añade una vez. El README dice "La primera vez", que es lo que ves, porque las ejecuciones posteriores no cambian nada.

También es una cuestión secundaria. Si no se puede escribir el archivo de exclusión, el error se descarta y la tarea se guarda igualmente. El README lo dice: "Si ese archivo no se puede escribir, la tarea se guarda igual." Una carpeta que no es un repositorio de git no tiene nada de lo que excluir, y el paso se salta.

### Escrituras seguras: un cambio a la vez, sobre el archivo tal como está ahora

La lista puede cambiar desde tres sitios: el campo del panel, el botón `○` y las herramientas de Claude. Claude puede estar añadiendo una tarea mientras tú terminas otra. Y otra sesión sobre el mismo proyecto puede haber escrito el archivo desde que esta lo leyó.

`changeTodos` lo resuelve con dos reglas:

1. **Un cambio a la vez dentro de la sesión.** Cada cambio se encadena a una única promesa, `todoChain`. Un cambio espera a que termine el anterior, así que dos escrituras nunca se entrelazan.
2. **Leer justo antes de escribir.** Cada cambio vuelve a leer el archivo, aplica su edición (añadir una, quitar una) a lo que hay ahora y vuelve a escribir la lista entera. Se conserva una tarea que otra sesión guardó hace un minuto.

La cadena sobrevive a un cambio fallido: continúa desde `run.catch(() => undefined)`, así que un error no bloquea todos los guardados posteriores.

Lo que esto no protege, y el README es honesto al respecto: dos sesiones del mismo proyecto escribiendo en el mismo instante. En ese caso la última escritura puede sobrescribir la otra. Las escrituras tampoco son atómicas: `$.fs.write` sustituye todo el contenido del archivo, como dicen los tipos ("the whole new content", todo el contenido nuevo); no hay archivo temporal ni renombrado. Para una lista personal corta, es un límite razonable.

### Un archivo dañado nunca se lee como vacío

Imagina que editas el archivo a mano y dejas una coma al final. Un lector descuidado vería JSON no válido, lo trataría como una lista vacía, y el siguiente cambio escribiría una lista nueva encima de tus tareas.

`parseTodoFile` distingue los casos. Un archivo vacío o inexistente es una lista vacía. Un archivo que no es JSON da `{ error: 'no es JSON válido' }`, y uno sin un array `tasks` da `{ error: 'no tiene la lista "tasks"' }`. Las entradas sin nombre se descartan; el resto se conserva.

Con un error pasan dos cosas:

- **Al leer**, el panel muestra el error en rojo, `.atl/narsil-check/pendientes.json no se puede leer (…). No lo toco: …`, y pide que lo arregles, o que añadas una tarea para que se guarde una copia del archivo antes de empezar una lista nueva. No se escribe nada.
- **En el siguiente cambio**, primero se copia el texto dañado al lado como `pendientes.danado-<moment>.json` (`danado`, por "dañado"), con el nombre de la hora ISO en la que `:` y `.` se sustituyen, como `pendientes.danado-2026-11-17T09-30-00-000Z.json`. Después empieza una lista nueva con el cambio, y el panel muestra una nota amarilla que dice dónde está la copia.

Esto salió de un bug. El commit de la corrección, `8dc7904`, lo describe: "A list file that is not valid JSON was read as empty and overwritten by the next change." (un archivo de lista que no era JSON válido se leía como vacío y el siguiente cambio lo sobrescribía).

La copia está dentro de la misma carpeta excluida, así que tampoco llega a git.

### Cuándo se lee

`loadTodos` se ejecuta al empezar la sesión, y otra vez cada vez que despliegas la sección, así que un cambio hecho por otra sesión o a mano aparece cuando miras. Cada cambio actualiza directamente el atom del panel con la lista que acaba de escribir, pero solo cuando el cambio era en la lista de este proyecto: una tarea escrita en la lista de otro proyecto no sustituye lo que muestra este panel.

## Cómo se le pidió a la IA

La petición original de esta funcionalidad no quedó registrada. Ningún registro de tareas público de narsil-check cubre la lista de pendientes. Lo que sigue es una reconstrucción.

### Reconstrucción a partir del historial de commits

A partir de `git log -- hooks/todos.ts` en narsil-check:

- `5439638` (2026-11-05) "feat: Pendientes, a per-project task list Claude can read and finish" (Pendientes, una lista de tareas por proyecto que Claude puede leer y terminar). Su mensaje describe todo el diseño de una vez: tareas "in .atl/narsil-check/pendientes.json, kept out of git through .git/info/exclude" (en .atl/narsil-check/pendientes.json, fuera de git a través de .git/info/exclude), el campo que añade "nombre: contenido", y "every change rereads the file, so edits during a turn or from another session are kept" (cada cambio vuelve a leer el archivo, así que se conservan las ediciones hechas durante un turno o desde otra sesión). Las herramientas de Claude y el comando de plantilla llegan en el mismo commit.
- `8dc7904` (2026-11-05) "fix: keep a damaged Pendientes list and never let side steps block a save" (conservar una lista de Pendientes dañada y no dejar nunca que los pasos secundarios bloqueen un guardado). El mismo día. Su mensaje enumera las correcciones: el archivo dañado se "reported in the pane and to Claude, left untouched, and copied aside" (informa en el panel y a Claude, se deja intacto y se copia aparte) antes de una lista nueva; "A git exclude file that cannot be written no longer stops the save" (un archivo de exclusión de git que no se puede escribir ya no detiene el guardado); el panel móvil "decides by surface whether to draw the field" (decide por superficie si dibuja el campo); "and the README no longer promises safety for two sessions writing at once" (y el README ya no promete seguridad para dos sesiones que escriben a la vez).

El segundo commit es el más instructivo. La primera versión funcionaba en el camino feliz. La corrección es una lista de lo que puede ir mal alrededor de un archivo: puede estar roto, un paso secundario puede fallar, una superficie puede no tener un elemento, y una promesa del README puede ser demasiado fuerte.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil Check.

> En mi mod de Claude Code `my-panel`, añade una sección de pendientes guardada por proyecto en `.atl/my-panel/todos.json` bajo el nivel superior de git (`git rev-parse --show-toplevel`, y si no la carpeta de la sesión), como `{ "version": 1, "tasks": [{ "id", "name", "content"? }] }`. Dibuja cada tarea con un botón `○` que la quite, un nombre que muestre u oculte su contenido, y un `Input` que añada `name: content`, dividido en los primeros dos puntos; omite el `Input` en la superficie móvil. Mantén la carpeta fuera de git añadiendo `/.atl/my-panel/` al archivo que nombra `git rev-parse --git-path info/exclude`, una sola vez, y no dejes nunca que ese paso detenga un guardado. Pasa cada cambio por una única cadena de promesas, y vuelve a leer el archivo antes de cada escritura. Si el archivo no es JSON válido o no tiene un array `tasks`, no lo trates nunca como vacío: muestra un error y, en el siguiente cambio, cópialo a `todos.damaged-<ISO time>.json` antes de empezar una lista nueva. Prueba un archivo dañado, un archivo de exclusión que no se puede escribir y un cambio hecho por otro escritor entre dos de los tuyos.

## El código mínimo

Esta es una versión reducida de la idea, escrita para esta guía y comprobada con los tipos de Claude Code 2.1.325 (`$.fs.exists`, `$.fs.read`, `$.fs.write`, `$.process.run`). Está adaptada de `hooks/todos.ts` y de `changeTodos` en `hooks/register.tsx` en [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Recibe la raíz del proyecto ya resuelta y deja fuera el dibujo.

```ts
import type { EngineInterface } from 'claude-code'

export type Task = { id: string; name: string; content?: string }

const DIR = '.atl/my-panel'
const FILE = `${DIR}/todos.json`

// A missing or empty file is an empty list; anything else unreadable is an error.
export function parseFile(text: string | undefined): { tasks: Task[] } | { error: string } {
  if (!text?.trim()) return { tasks: [] }
  try {
    const tasks = (JSON.parse(text) as { tasks?: unknown })?.tasks
    if (!Array.isArray(tasks)) return { error: 'no "tasks" list' }
    return {
      tasks: tasks.filter((t): t is Task => typeof t?.name === 'string' && t.name.trim() !== ''),
    }
  } catch {
    return { error: 'not valid JSON' }
  }
}

async function exclude($: EngineInterface, root: string): Promise<void> {
  const ran = await $.process.run(['git', 'rev-parse', '--git-path', 'info/exclude'], { cwd: root })
  if (ran.exitCode !== 0) return
  const rel = ran.stdout.trim().replace(/\\/g, '/')
  const path = /^([A-Za-z]:)?\//.test(rel) ? rel : `${root}/${rel}`
  const text = (await $.fs.exists(path)) ? await $.fs.read(path) : ''
  if (text.split(/\r?\n/).some((l) => l.trim() === `/${DIR}/`)) return
  await $.fs.write(path, `${text}${text === '' || text.endsWith('\n') ? '' : '\n'}/${DIR}/\n`)
}

let chain: Promise<unknown> = Promise.resolve()

export function change(
  $: EngineInterface,
  root: string,
  edit: (tasks: Task[]) => Task[],
): Promise<string | undefined> {
  const run = chain.then(async () => {
    const path = `${root}/${FILE}`
    const text = (await $.fs.exists(path)) ? await $.fs.read(path) : undefined
    const file = parseFile(text)
    let notice: string | undefined
    if ('error' in file) {
      const copy = `${DIR}/todos.damaged-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      await $.fs.write(`${root}/${copy}`, text ?? '')
      notice = `The list was damaged (${file.error}); a copy is in ${copy}.`
    }
    const tasks = edit('error' in file ? [] : file.tasks)
    await exclude($, root).catch(() => undefined)
    await $.fs.write(path, `${JSON.stringify({ version: 1, tasks }, null, 2)}\n`)
    return notice
  })
  chain = run.catch(() => undefined)
  return run
}
```

Añade una tarea con `change($, root, tasks => [...tasks, task])` y termina una con `change($, root, tasks => tasks.filter(t => t.id !== id))`, y después escribe la lista nueva en tu atom para que el panel se vuelva a dibujar.

## Errores comunes y cómo probarlo

Estos salen del código y los tests de Narsil Check:

- **Leer un archivo roto como vacío.** El siguiente guardado destruye las tareas. Distingue "vacío" de "ilegible", y copia antes de sustituir.
- **Escribir desde la memoria.** Una lista guardada en el estado del panel y escrita de vuelta pierde lo que añadió otro escritor. Lee el archivo justo antes de cada escritura.
- **Dos escrituras a la vez.** El campo y la herramienta de Claude pueden dispararse juntos. Encadénalos.
- **Editar `.gitignore`.** Es un archivo compartido y con seguimiento. Usa el archivo de exclusión local.
- **Suponer que `.git` es una carpeta.** En un worktree no lo es. Pide la ruta a git.
- **Dejar que un paso secundario bloquee el principal.** La línea de exclusión está bien tenerla; lo importante es el guardado.
- **Dibujar un elemento que la superficie no tiene.** Comprueba que `Input` existe, y decide por superficie.

Para probarlo, `claude plugin test .` ejecuta `tests/todos.test.tsx`. "the list file is read leniently and an entry splits at its first colon" (el archivo de la lista se lee con tolerancia y una entrada se divide en sus primeros dos puntos) y "the exclude line is added once, and a template is found by its folder name" (la línea de exclusión se añade una vez, y una plantilla se encuentra por el nombre de su carpeta) prueban las partes puras. "Pendientes starts folded when empty; a task added in the field is saved, kept out of git, and shown" (Pendientes empieza plegada cuando está vacía; una tarea añadida en el campo se guarda, se mantiene fuera de git y se muestra) maneja el campo y comprueba el archivo y la línea de exclusión. "a damaged list is left as it is and said so; the next change keeps a copy of it before starting a new list" (una lista dañada se deja como está y se avisa; el siguiente cambio guarda una copia antes de empezar una lista nueva), "a git exclude file that cannot be written does not stop the task from being saved" (un archivo de exclusión de git que no se puede escribir no impide que se guarde la tarea) y "the mobile app has no text field: an empty list says so, and tasks still finish with ○" (la app móvil no tiene campo de texto: una lista vacía lo dice, y las tareas se siguen terminando con ○) cubren las correcciones de `8dc7904`.

## Para ir más lejos

- Escribe a través de un archivo temporal y un renombrado si tu lista se convierte en algo más valioso.
- Conserva las tareas terminadas con una fecha en lugar de quitarlas, y muestra las últimas plegadas.
- Un archivo de bloqueo junto a la lista cerraría el hueco de dos sesiones escribiendo en el mismo instante, a costa de gestionar un bloqueo abandonado.
- La siguiente guía da a Claude sus propias herramientas sobre esta lista: enumerar, añadir y terminar tareas, y escribir en la lista de otro proyecto.
