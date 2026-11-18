---
title: Instalar, recargar, validar y probar
description: Carga un mod desde su carpeta o desde un marketplace local, recárgalo tras una edición y compruébalo con claude plugin validate, claude plugin test y tsc.
route: mods
order: 3
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: .claude-plugin/marketplace.json
  - repo: pet
    path: README.md
  - repo: check
    path: .claude-plugin/marketplace.json
  - repo: check
    path: tsconfig.json
  - repo: check
    path: tests/pane.test.tsx
  - repo: check
    path: README.md
---

## Qué hace

Construir un mod con Claude es un ciclo: Claude escribe, tú cargas el mod, lo compruebas y le cuentas a Claude lo que viste. Esta guía cubre la parte de cargar y comprobar de ese ciclo para el mod `greeter` de "De qué está hecho un mod".

Aprenderás a ejecutar un mod en una sesión, cómo llega una edición a una sesión en marcha y tres comprobaciones: `claude plugin validate` para lo que verá el motor, `claude plugin test` para lo que hacen los hooks y `tsc` para los tipos.

## Cómo funciona por dentro

Claude Code lee un mod desde uno de dos tipos de lugar, y eso decide cómo llega una edición a una sesión en marcha:

| Cómo se carga                                                                       | Cómo llega una edición                                                                                                                                |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `claude --plugin-dir <folder>`, o una carpeta indicada en `CLAUDE_CODE_PLUGIN_DIRS` | En una sesión interactiva la carpeta se vigila: guardar un archivo recarga el módulo de hooks.                                                        |
| Instalado desde un marketplace que es una carpeta local, con un `source` relativo   | Ejecuta `/reload-plugins`. La sesión vuelve a leer la propia carpeta, sin versión nueva y sin reinstalar.                                             |
| Instalado desde un repositorio git, npm, un archivo comprimido o una URL            | La sesión ejecuta la copia hecha al instalar. Una edición solo llega como versión nueva, mediante `claude plugin update` y después `/reload-plugins`. |

Una recarga vuelve a ejecutar `register` en un entorno nuevo. Las variables del módulo y los temporizadores pendientes desaparecen; los valores de `$.state` y `$.store` se mantienen.

## Constrúyelo con Claude

Claude puede hacer por ti la mayor parte de este trabajo: escribir el archivo del marketplace, escribir una prueba, configurar la comprobación de tipos y ejecutar las tres comprobaciones. Lo que necesitas saber es qué demuestra cada comprobación, para poder leer su salida. Primero carga el mod desde su carpeta (el paso 1 de abajo), para que Claude Code escriba los archivos de tipos que necesita la comprobación de tipos. Después pide:

> En la carpeta de mi mod de Claude Code `greeter`, usando la skill plugin-authoring: añade un `.claude-plugin/marketplace.json` que liste el mod con `"source": "./"`; añade un `tsconfig.json` que extienda `./.claude-plugin/types/tsconfig.json`, y añade `.claude-plugin/types/` a `.gitignore`; escribe `tests/greeter.test.tsx` con `claude-code/testing` que inicie una sesión, haga dos llamadas a herramientas y compruebe el toast y la barra de estado. Después ejecuta `claude plugin validate`, `claude plugin test` y `npx tsc` sobre la carpeta y muéstrame cada salida.

Después lee tú las tres salidas:

- **validate** debería listar los hooks y las llamadas que esperas. Lee el código fuente; no lo ejecuta.
- **test** debería decir `1 pass` y `0 fail`. Si una prueba falla con "returned no result", a un hook de la prueba que hace las veces del motor le falta una respuesta.
- **tsc** no debería imprimir nada. Cada línea que imprime es un error de tipos, con su archivo y su línea.

Dos cosas quedan en tus manos, porque ocurren en tu propia sesión, no en los archivos de Claude: cargar el mod (con `--plugin-dir` o un marketplace local) y ejecutar `/reload-plugins` después de una edición. Los pasos de abajo explican ambas.

## Qué hace cada paso

Claude puede ejecutar estos comandos por ti, pero conviene que sepas qué hace cada uno y qué significa su salida. Aquí están en el orden en que los usarías.

### 1. Ejecútalo desde su carpeta

Para una sesión:

```bash
claude --plugin-dir ./greeter
```

Repite la opción para cargar varias carpetas. Donde no se puede pasar una opción (una sesión que inicia la aplicación de escritorio o un host del SDK), define `CLAUDE_CODE_PLUGIN_DIRS` con una o más rutas absolutas (se permite `~`), separadas por el separador de listas de rutas de la plataforma. Se lee del entorno del proceso o del bloque `env` de `~/.claude/settings.json`, nunca de los ajustes de un proyecto.

En una sesión interactiva la carpeta se vigila. Un guardado recarga el módulo cuando la carpeta lleva un momento sin cambios; los guardados hechos mientras se ejecuta un turno recargan una sola vez, cuando el turno termina. Ejecuta `claude --debug` mientras desarrollas: cuando se omite un hook o un módulo no se carga, la transcripción lo dice una vez, y el registro de depuración recoge cada vez que ocurre.

### 2. Convierte la carpeta en un marketplace local

Un marketplace es un archivo, `.claude-plugin/marketplace.json`, junto a `plugin.json`. Su única entrada apunta a la propia carpeta:

```json
{
  "name": "greeter-dev",
  "owner": { "name": "Example Author" },
  "plugins": [{ "name": "greeter", "source": "./" }]
}
```

Añade la carpeta como marketplace e instala el mod desde ella:

```bash
claude plugin marketplace add ./greeter
claude plugin install greeter@greeter-dev
```

En el prompt de una sesión de terminal, la instalación también tiene la forma `/plugin install <mod> --marketplace <source>`, donde el origen es un `<owner>/<repo>` de GitHub, una URL de git o la ruta de una carpeta. `claude plugin list` muestra la carpeta desde la que se lee un plugin (`Read from:`).

Como el `source` de la entrada es una ruta relativa, la sesión lee el mod desde esa carpeta, no desde una copia. Después de una edición, ejecuta:

```text
/reload-plugins
```

La recarga nombra el plugin y la carpeta cuando la carpeta cambió desde la última vez que la sesión la leyó.

### 3. Valida

```bash
claude plugin validate ./greeter
```

Lee el archivo del marketplace, el manifiesto, el contrato de tipos y el código fuente del módulo de hooks como lo hará el motor, e informa de lo que el módulo engancha y llama, y de todo lo que el motor rechazaría, antes de que una sesión lo cargue. Para `greeter`, la sección de hooks dice:

```text
❯ ./register.tsx hooks: session.start, tool.call
❯ ./register.tsx gating hook without .catch: tool.call
❯ ./register.tsx calls: $.state.get, $.state.set, $.ui.status, $.ui.toast
❯ ./register.tsx state writes: greeter.calls
❯ ./register.tsx state reads: greeter.calls
```

La misma ejecución lista también las comprobaciones que aplica el directorio público de plugins (un README de al menos 40 palabras, un archivo `LICENSE` o un `license` en `plugin.json`, un icono). Importan para enviar el plugin al directorio, no para ejecutar el mod.

La validación conoce el mod, no una sesión: si un hook llegó a ejecutarse se comprueba en la sesión, con `claude --debug`.

### 4. Prueba

`claude plugin test <folder>` ejecuta los archivos `*.test.ts` y `*.test.tsx` del plugin contra el propio motor. Una prueba importa `test` y `expect` (y `mock`) de `claude-code/testing` y recibe el `$` del motor y un `on` cuyos hooks quedan por debajo del plugin, en el lugar del motor. No hay nada más debajo de ellos, así que la prueba responde a lo que llama el plugin: una llamada a `$` con `{ value }`, un evento con su propio resultado.

Escribe `tests/greeter.test.tsx`:

```tsx
import { expect, test } from 'claude-code/testing'

test('greets on start and counts tool calls', async ($, on) => {
  const toasts: string[] = []
  const lines: (string | undefined)[] = []

  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.status', (_, e) => {
    lines.push(e.text)
    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.tool.call({ tool: 'Bash', command: 'pwd' })

  expect(toasts).toEqual(['Hello from greeter'])
  expect(lines.at(-1)).toBe('greeter: 2 tool calls')
})
```

Ejecútala:

```bash
claude plugin test ./greeter
```

```text
(pass) greets on start and counts tool calls
 1 pass
 0 fail
```

Una prueba de interfaz monta un componente a través del plugin en una superficie que ella misma nombra (`$.ui.mount({ plugin, surface, component, props })`) y actúa sobre el dibujo por clave: `find`, `press`, `input`. Escribe el cuerpo una vez y recórrelo en un bucle sobre las superficies, para que la prueba demuestre que el mod no depende de una de ellas. El ejemplo `pane.test.tsx` de la skill monta un `Pane` en `terminal`, `desktop`, `vscode` y `mobile` en un solo bucle.

### 5. Comprueba los tipos

Cuando Claude Code carga un mod desde una carpeta en la que se está escribiendo (una carpeta de `--plugin-dir` o de `CLAUDE_CODE_PLUGIN_DIRS` que la sesión recarga en caliente), coloca a su lado las declaraciones de la API en `.claude-plugin/types/`, con un `tsconfig.json`. El `tsconfig.json` del propio mod lo extiende:

```json
{
  "extends": "./.claude-plugin/types/tsconfig.json"
}
```

Después:

```bash
npx tsc -p ./greeter
```

`.claude-plugin/types/` se regenera en cada carga, así que déjalo fuera de git. Los dos mods de Narsil lo incluyen en `.gitignore`.

Una carpeta que la sesión no recarga en caliente (la de un plugin instalado, o un `--plugin-dir` con `claude -p`) nunca recibe esos archivos. Comprueba los tipos de un mod así con el `tsconfig.json` que aparece en la cabecera de `claude-code.d.ts`, guardado fuera de la carpeta del mod, con su `include` apuntando a una copia del archivo de declaraciones y a las carpetas `hooks`, `types` y `tests` del mod.

## Errores comunes y cómo probarlo

- **Editar una copia que la sesión no ejecuta.** Un mod instalado desde un repositorio git ejecuta la copia instalada. Mientras desarrollas, instálalo desde un marketplace de carpeta local o carga la carpeta con `--plugin-dir`.
- **Un hook de prueba que no devuelve nada.** En `claude plugin test`, un hook que hace las veces del motor tiene que responder. Una llamada a `$` respondida con nada falla con "returned no result" y "nothing beneath the plugins answers ui.toast".
- **Probar una sola superficie.** Recorre en bucle las superficies que admites en las pruebas de interfaz; las aplicaciones móviles pueden no dibujar `Input` ni `Select`.
- **Subir `.claude-plugin/types/` al repositorio.** Pertenece a la versión que lo escribió. Regenéralo, nunca lo edites.
- **Esperar que la validación ejecute el código.** Lee el código fuente. El comportamiento es lo que muestran `claude plugin test` y una sesión con `--debug`.

## Para ir más lejos

Los dos mods de Narsil incluyen un archivo de marketplace que lista el mod con `"source": "./"`: el `.claude-plugin/marketplace.json` de narsil-pet llama al marketplace `narsil`, y el de narsil-check lo llama `narsil-check`. Sus README instalan con dos líneas en el prompt de Claude Code:

```text
/plugin marketplace add davshn/narsil-pet
/plugin install narsil-pet@narsil
```

y actualizan con `/plugin marketplace update` seguido de `/plugin update`. El README de narsil-check describe el flujo local de esta guía: añade la carpeta de tu copia con `claude plugin marketplace add`, y los cambios llegan con `/reload-plugins`, sin reinstalar. Su `tsconfig.json` es el `extends` de una línea de arriba, y su carpeta `tests/` contiene un `*.test.tsx` por funcionalidad; `tests/pane.test.tsx` monta el panel con una constante `PANE` igual que el ejemplo de la skill.
