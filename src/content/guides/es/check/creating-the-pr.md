---
title: Crear el PR
description: 'Cómo Narsil Check convierte los manifests actualizados en un commit, una rama chore/upgrade-deps y un pull request abierto con gh, y después te devuelve a la rama principal.'
route: check
order: 14
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/git.ts
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
    path: odd/tasks/ecosystems-wave-4.md
---

## Qué hace

Después de instalar las actualizaciones triviales, los manifests del disco ya no coinciden con el último commit. El trabajo que queda es siempre el mismo: una rama, un commit con solo los archivos de dependencias, un push, un pull request con una descripción legible, y volver a donde estabas. Narsil Check hace esos pasos con una pulsación.

Cuando los rangos de dependencias de un manifest difieren de `HEAD`, el panel muestra una línea como esta:

```text
Sin commit: 2 librerías actualizadas en package.json
```

Debajo hay un botón, y su texto depende de la rama en la que estés:

- En la rama principal: **Crear rama, commit y PR**.
- En cualquier otra rama: **Commit y push a &lt;rama&gt;**. Hace commit y push a esa rama, y nada más. El pull request lo gestionas tú.

En la rama principal el botón hace cuatro cosas. Crea `chore/upgrade-deps-2026-11-17` (la fecha del día), hace allí el commit de los manifests y los lockfiles, abre un pull request contra la rama principal con `gh` y vuelve a la rama principal. El panel dice entonces `PR creado desde la rama chore/upgrade-deps-2026-11-17. Volviste a main.` y un toast lleva la dirección del PR.

No importa quién cambió el manifest. Se detectan tanto una actualización hecha por el panel como una que escribiste a mano, porque la comparación es con `HEAD`, no con la memoria propia del panel.

## Cómo funciona por dentro

Los textos y las decisiones pequeñas están en `hooks/git.ts`, como funciones puras: el nombre de la rama, el título y el cuerpo del commit, el cuerpo del PR, qué rama cuenta como la principal y cómo encontrar la dirección del PR en la salida de `gh`. Los pasos que ejecutan git y gh están en `hooks/register.tsx`, en `checkPending` y `publish`. Esa separación es la misma que en el resto del mod: los tests comprueban los textos sin ejecutar nada.

### Encontrar lo que contendría un PR

`checkPending` se ejecuta después de cada análisis. Para cada ecosistema que usa el proyecto, y para cada uno de sus manifests, lee la versión del último commit con `git --no-pager show HEAD:<manifest>` y la versión del disco, analiza las dos con el adaptador del ecosistema y compara los rangos de dependencias (`specChanges` en `hooks/adapter.ts`).

Analizar los dos lados con el adaptador, en lugar de comparar el texto, es una decisión deliberada. Un cambio en `scripts` de `package.json` no es un cambio de dependencias y no aparece como tal. Un rango que pasó de `^3.22.0` a `^3.25.1` sí. También sobrevive a un reinicio: el estado pendiente se vuelve a calcular a partir de git, no se guarda en ningún sitio.

Para cada ecosistema con cambios, los archivos candidatos son sus manifests cambiados más sus lockfiles, en la raíz y dondequiera que el árbol los tenga. Después, `git status --porcelain -- <those files>` deja solo los que git indica como modificados. Un lockfile que la instalación no tocó se queda fuera.

### Cuál es la rama principal

`isMainBranch` pregunta a `git symbolic-ref --short refs/remotes/origin/HEAD`, que imprime algo como `origin/main`. Cuando origin no nombra ninguna rama por defecto, cuentan `main` o `master`. Un repositorio cuya rama por defecto es `develop` se trata correctamente siempre que `origin/HEAD` esté configurado.

### Los pasos en la rama principal

`publish` ejecuta cada comando a través de un pequeño helper `step` que pone el estado del panel con el nombre del paso (el panel muestra `Creando la rama…`) y lanza una excepción con ese nombre si el comando falla. En orden:

1. `git branch --show-current`. Una respuesta vacía significa un `HEAD` separado, y el panel se detiene con "cambia a una rama antes de subir los cambios".
2. `git rev-parse --verify --quiet refs/heads/chore/upgrade-deps-<day>`. Si esa rama ya existe, `branchName` añade la hora y el minuto: `chore/upgrade-deps-2026-11-17-1432`.
3. `git switch -c <branch>`.
4. `git add -- <files>`, después `git commit -m <title> -m <body> -- <files>`.
5. `git push -u origin <branch>`.
6. `gh pr create --base <main> --head <branch> --title <title> --body <body>`.
7. `git switch <main>`, y después se vuelven a leer la sesión y la lista de bibliotecas.

El título del commit es `chore(deps): upgrade 2 dependencies` (o `1 dependency`), y el cuerpo enumera cada cambio como `- zod: 3.22.0 -> 3.25.1`. El cuerpo del PR tiene un `## Summary` con el gestor usado y una tabla de paquete, versión de origen y versión de destino, y después un `## Test plan` con dos casillas sin marcar: ejecutar la batería de tests y compilar el proyecto. Las casillas están ahí porque una actualización trivial sigue necesitando que una persona ejecute los tests.

`prUrlOf` toma la última línea de la salida de gh que tenga la forma `https://…/pull/<number>`, porque gh puede imprimir otras líneas antes.

### Por qué hace el commit con una lista de rutas

El commit es `git commit ... -- <files>`, con los archivos nombrados después de `--`. Con rutas, git hace el commit de esos archivos tal como están en el disco y de nada más, aunque tuvieras otros archivos en el stage. Tu trabajo en curso se queda fuera del PR. El README lo dice claramente: "El resto de tus cambios sin commit no se incluye".

Los demás cambios sin commit viajan contigo: `git switch -c` los lleva a la rama nueva y `git switch <main>` los trae de vuelta, porque ninguno está en el commit y los únicos archivos que difieren entre las dos ramas son los que se acaban de incluir en el commit.

### Por qué vuelve a la rama principal

La vuelta a la rama principal se añadió más tarde (`2b91c7d`). Quedarse en la rama de actualización hacía que la gente trabajara sin querer encima de una rama de PR. De vuelta en la rama principal hay un detalle que el README explica: los manifests vuelven a tener las versiones antiguas, mientras que `node_modules` (o su equivalente) puede seguir teniendo las nuevas. Por eso el panel vuelve a analizar, y el README sugiere reinstalar si sigues trabajando allí.

Si git rechaza el cambio de rama, el panel no intenta forzarlo. Se queda en la rama nueva y dice por qué: `PR creado desde la rama …. No pude volver a main: <git's error>`.

### Qué pasa cuando algo falla

- **Un paso falla antes de que exista el PR.** El error nombra el paso: `No pude crear el PR. Subiendo la rama: fatal: no remote`. Según el código, los pasos que ya se ejecutaron no se deshacen: si falla el push, estás en la rama nueva con el commit hecho en local.
- **gh no tiene la sesión iniciada.** `gh pr create` termina con un error y el panel muestra su final, después de `Creando el PR:`. Para entonces la rama ya se subió.
- **gh no está instalado.** Cuando un comando no puede ni arrancar, `runCommand` lo intenta una vez más como `<name>.cmd` (la forma que instala Windows) y después se rinde. Según el código, ese fallo es un rechazo y no un código de salida, así que llega al panel sin el nombre del paso.
- **Los dos nombres de rama están ocupados.** Solo se comprueba el nombre del día. Si el nombre con la hora también existe (dos ejecuciones en el mismo minuto), `git switch -c` falla y el panel dice `Creando la rama: …`. Una rama con ese nombre que solo existe en el remoto no se comprueba; en ese caso fallaría el push.
- **Dos pulsaciones.** Una pulsación mientras la tarea está en `running` no hace nada.

### Los hooks de commit no se ejecutan

Los tipos de 2.1.325 dicen de `$.process.run`: "Git runs with repo hooks off" (git se ejecuta con los hooks del repositorio desactivados). El README coincide: los hooks como husky no se ejecutan en estos commits. Un equipo que depende de un hook de commit para pasar el linter o firmar verá llegar estos commits sin él.

### README y código

El comentario sobre `publish` todavía dice "A commit of package.json and its lockfile alone" (un commit solo de package.json y su lockfile), de cuando el mod solo conocía npm. El código hace el commit de los manifests y los lockfiles de cada ecosistema con cambios, como dice el README.

## Constrúyelo con Claude

Pídele a Claude un botón que convierta los cambios de dependencias que hay en disco en un commit y, en la rama por defecto, en un pull request. La única idea que debe entender bien es que el commit contiene solo los archivos de dependencias: se nombran después de `--`, así que el resto de tu trabajo en curso queda fuera.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil Check.

> En mi mod de Claude Code `my-panel`, añade un botón que convierta los cambios de dependencias de `package.json` en un pull request. Primero compara los rangos de dependencias de `git show HEAD:package.json` con el archivo del disco y enumera los que cambiaron; muestra el botón solo cuando haya alguno. Al pulsarlo, con `$.process.run` y sin shell: detente con un mensaje claro si el HEAD está separado; si la rama actual no es la rama por defecto (según `git symbolic-ref --short refs/remotes/origin/HEAD`, y si no `main` o `master`), haz commit y push a ella y detente ahí. En la rama por defecto, crea `chore/upgrade-deps-YYYY-MM-DD` (añade `-HHMM` si esa rama existe), ejecuta `git add -- package.json package-lock.json`, `git commit -m "chore(deps): upgrade N dependencies" -m <list> -- package.json package-lock.json`, `git push -u origin <branch>` y `gh pr create --base <default> --head <branch> --title … --body …` con una tabla de cambios y un plan de pruebas. Después vuelve con `git switch` y dilo; si el cambio de rama falla, quédate y muestra el error de git. Nombra el paso que falla en cada error. Ignora una segunda pulsación mientras se ejecuta. Pruébalo respondiendo a `process.run` en los tests y comprobando el argv exacto de cada comando, en orden.

### Qué revisar en la respuesta de Claude

1. Los cambios pendientes salen de comparar los rangos de dependencias de `git show HEAD:package.json` con el archivo en disco, así que un cambio en `scripts` no ofrece un PR.
2. La rama por defecto sale de `git symbolic-ref --short refs/remotes/origin/HEAD`, y `main` o `master` solo se usan cuando origin no nombra ninguna. En cualquier otra rama, el botón hace commit y push ahí, y se detiene.
3. El commit nombra sus archivos, como en `git commit -m … -m … -- package.json package-lock.json`, nunca con `git commit -a` ni con un `git commit` sin más.
4. Después de `gh pr create`, el botón ejecuta `git switch` para volver a la rama por defecto. Si el cambio de rama falla, se queda en la rama nueva y muestra el error de git.
5. Cada error nombra el paso que falló, y una segunda pulsación mientras se ejecuta el trabajo no hace nada.

Si una comprobación falla, dile a Claude lo que ves: "el PR incluye un archivo que todavía estaba editando, no solo package.json y su lockfile".

### Cómo lo pidió el autor

La petición original de esta funcionalidad no quedó registrada. El botón ya está en el primer commit, y ningún registro de tareas público cubre su creación. Un registro de tareas posterior lo menciona, con las palabras del agente.

#### Registrado en un registro de tareas

`odd/tasks/ecosystems-wave-4.md`, que añade los paquetes de Swift, enumera como spec S2 lo que tenía que seguir funcionando. Esta es la spec del agente, no las palabras de quien creó Narsil Check:

> "Everything the earlier waves built keeps working for SwiftPM: grouping, the bump button, Haiku reasons, copy buttons, the commit/push/PR button and the auto-open rule."

En español: todo lo que construyeron las oleadas anteriores sigue funcionando para SwiftPM: la agrupación, el botón de actualizar, las razones de Haiku, los botones de copia, el botón de commit/push/PR y la regla de apertura automática.

#### Reconstrucción a partir del historial de commits

A partir de `git log -- hooks/git.ts` y `git log -S` sobre `hooks/register.tsx` en narsil-check:

- `1bf736a` (2026-11-04) "feat: add upgrade panel for npm and Expo projects" (añadir un panel de actualizaciones para proyectos npm y Expo). Su mensaje termina con "Pending upgrades become a commit and push, or a branch and PR from the default branch." (las actualizaciones pendientes se convierten en un commit y un push, o en una rama y un PR desde la rama por defecto). El nombre de rama `chore/upgrade-deps-…`, el commit limitado a rutas y `gh pr create` ya están aquí.
- `a95eb07` (2026-11-04) "refactor: read dependencies through an adapter per ecosystem" (leer las dependencias a través de un adaptador por ecosistema). Los cambios pendientes se leen por adaptador, comparando cada manifest con `HEAD`, así que el botón funciona para cada ecosistema añadido después.
- `2b91c7d` (2026-11-13) "feat: return to the default branch after the PR and warn when the branch is behind" (volver a la rama por defecto después del PR y avisar cuando la rama va por detrás). Su mensaje: "After opening the upgrade PR the pane switches back to the base branch and rescans; a refused switch keeps the new branch and says why." (después de abrir el PR de actualización, el panel vuelve a la rama base y analiza de nuevo; un cambio de rama rechazado mantiene la rama nueva y dice por qué).

El diseño no cambió mucho. Lo que cambió fue dónde acabas después.

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Esta es una versión reducida de la idea, escrita para esta guía y comprobada con los tipos de Claude Code 2.1.325 (`$.process.run`, `$.ui.toast`). Está adaptada de `hooks/git.ts` y de `publish` en `hooks/register.tsx` en [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later). Solo trata la rama por defecto, y recibe los archivos y los cambios ya encontrados.

```ts
import type { EngineInterface } from 'claude-code'

type Change = { name: string; from: string; to: string }

const pad = (n: number) => String(n).padStart(2, '0')

export function branchName(ms: number, taken: boolean): string {
  const d = new Date(ms)
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return `chore/upgrade-deps-${day}${taken ? `-${pad(d.getHours())}${pad(d.getMinutes())}` : ''}`
}

async function step($: EngineInterface, label: string, argv: string[]): Promise<string> {
  const ran = await $.process.run(argv, { timeoutMs: 60_000 })
  if (ran.exitCode !== 0) throw new Error(`${label}: ${(ran.stderr || ran.stdout).trim()}`)
  return ran.stdout
}

export async function openUpgradePr(
  $: EngineInterface,
  base: string,
  files: string[],
  changes: Change[],
): Promise<string> {
  const title = `chore(deps): upgrade ${changes.length} ${changes.length === 1 ? 'dependency' : 'dependencies'}`
  const body = changes.map((c) => `- ${c.name}: ${c.from} -> ${c.to}`).join('\n')
  const now = Date.now()
  const taken = await $.process.run([
    'git',
    'rev-parse',
    '--verify',
    '--quiet',
    `refs/heads/${branchName(now, false)}`,
  ])
  const branch = branchName(now, taken.exitCode === 0)

  await step($, 'Creating the branch', ['git', 'switch', '-c', branch])
  await step($, 'Staging', ['git', 'add', '--', ...files])
  await step($, 'Committing', ['git', 'commit', '-m', title, '-m', body, '--', ...files])
  await step($, 'Pushing', ['git', 'push', '-u', 'origin', branch])
  const out = await step($, 'Opening the PR', [
    'gh',
    'pr',
    'create',
    '--base',
    base,
    '--head',
    branch,
    '--title',
    title,
    '--body',
    body,
  ])
  const url =
    out
      .split(/\r?\n/)
      .filter((l) => /^https:\/\/\S+\/pull\/\d+$/.test(l.trim()))
      .pop() ?? out.trim()

  const back = await $.process.run(['git', 'switch', base])
  $.ui.toast(
    back.exitCode === 0
      ? `PR opened: ${url}. Back on ${base}.`
      : `PR opened: ${url}. Still on ${branch}.`,
  )
  return url
}
```

Llámala desde el `onPress` de un botón, guarda un estado `running` en un atom para que una segunda pulsación no haga nada, y muestra el mensaje del error, que ya nombra el paso, cuando lance una excepción.

## Errores comunes y cómo probarlo

Estos salen del código y los tests de Narsil Check:

- **`git commit -a` o un `git commit` sin más.** Cualquiera de los dos puede llevarse archivos que nunca quisiste incluir. Nombra los archivos después de `--`.
- **Comparar texto en lugar de rangos.** Un cambio de espacios o un script nuevo ofrecerían un PR. Analiza los dos lados con el mismo lector.
- **Suponer que la rama por defecto es `main`.** Pregunta primero a `origin/HEAD`.
- **Quedarse en la rama de actualización.** El siguiente cambio acaba en el PR sin querer. Vuelve, y dilo cuando no puedas.
- **Dejar el panel desactualizado después de cambiar de rama.** Los manifests cambiaron por debajo. Analiza de nuevo.
- **Errores sin paso.** "exit code 128" (código de salida 128) no ayuda a nadie. Nombra el paso.
- **Contar con los hooks de commit.** Están desactivados para `$.process.run`; no supongas que un hook pasa el linter en estos commits.

El commit en sí toma el archivo entero tal como está en el disco. Si editaste a mano otra cosa en `package.json`, como un script, esa edición también entra en el PR. Revisa el diff antes de pulsar.

Para probarlo, `claude plugin test .` ejecuta `tests/upgrade.test.tsx`, que responde por sí mismo a cada `process.run` y registra el argv. "the PR button makes a branch, commits package.json and the lock, pushes and opens a PR" (el botón de PR crea una rama, hace commit de package.json y del lock, hace push y abre un PR) comprueba el orden de los comandos, el `git add -- package.json package-lock.json` exacto, el título del commit y el `gh pr create --base main --head <branch>`, y que `git switch main` llega después de gh. "on a work branch the button commits and pushes to it, with no new branch or PR" (en una rama de trabajo el botón hace commit y push a ella, sin rama ni PR nuevos), "a PR that is made but cannot go back to the default branch says so and stays on the new branch" (un PR que se crea pero no puede volver a la rama por defecto lo dice y se queda en la rama nueva) y "a failed push says which step failed" (un push fallido dice qué paso falló) cubren los demás caminos. "the branch is named by day, and by time when the day is taken" (la rama se nombra por día, y por hora cuando el día está ocupado) y "the PR address is the URL gh prints" (la dirección del PR es la URL que imprime gh) prueban las funciones puras.

## Para ir más lejos

- El cuerpo del PR podría llevar las vulnerabilidades que corrige cada actualización, que el panel ya conoce (la siguiente guía).
- `gh pr create` acepta `--label` y `--reviewer`. Un ajuste de equipo para eso es un añadido pequeño.
- No se comprueba si existe una rama remota con el mismo nombre. Un `git ls-remote --heads origin <branch>` antes del push lo detectaría.
- La siguiente guía deja las actualizaciones para pasar a la seguridad: las vulnerabilidades conocidas de los paquetes que tienes instalados.
