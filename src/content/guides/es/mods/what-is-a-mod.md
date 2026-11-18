---
title: De qué está hecho un mod
description: Los tres archivos de un mod de Claude Code, la función register y sus hooks, y el mod más pequeño que muestra algo en pantalla.
route: mods
order: 1
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: .claude-plugin/plugin.json
  - repo: pet
    path: hooks/hooks.json
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: types/index.d.ts
---

## Qué hace

Un mod es un plugin de Claude Code hecho de hooks. Un hook es una función que Claude Code llama cuando pasa algo: empieza una sesión, Claude llama a una herramienta, termina un turno. Los mods se escriben en TypeScript y cambian lo que muestra Claude Code o cómo se comporta.

En esta guía le pedirás a Claude que construya un mod pequeño llamado `greeter`. Muestra un mensaje breve (un toast) cuando empieza una sesión y cuenta las llamadas a herramientas en su barra de estado. Por el camino aprenderás qué archivos necesita todo mod y qué hace la función `register`, para que puedas saber si lo que escribió Claude es correcto.

La API de mods está en acceso anticipado y cambia entre versiones. Todo lo que aparece aquí se comprobó con Claude Code 2.1.325 y su archivo de declaraciones, `claude-code.d.ts`. Si tu versión es más reciente, ese archivo es la referencia.

## Cómo funciona por dentro

Un mod es una carpeta con tres archivos que escribes a mano:

| Archivo                      | Qué contiene                                                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `.claude-plugin/plugin.json` | El manifiesto: `name`, `version`, `description` y, de forma opcional, `license`, `repository` y `types`.          |
| `hooks/hooks.json`           | Una línea que nombra el módulo de hooks: `{ "modules": ["./register.tsx"] }`. La ruta es relativa a `hooks.json`. |
| `hooks/register.tsx`         | El módulo de hooks. Exporta `register`.                                                                           |

El módulo de hooks es un módulo ES con extensión `.ts`, `.tsx`, `.js` u otro sufijo de script. Se ejecuta en un entorno propio, sin DOM y sin Node. Todo lo que está fuera del módulo (la pantalla, los archivos, la red, el reloj) se alcanza a través del objeto `$` que recibe cada hook. Los demás archivos del plugin se importan con declaraciones `import` normales; un módulo que usa `import()` dinámico no se carga.

`register(on, options)` se llama cuando se carga el módulo. `on(event, matcher?, hook)` añade un hook a un evento. `options` contiene los valores de los campos `userConfig` que declare el manifiesto.

Todos los hooks tienen la forma `($, e, next)`:

- `$` es la interfaz del motor: pantalla, almacén, estado, reloj, red, procesos, archivos, sesión, modelo, herramientas, comandos y el resto.
- `e` es la entrada del evento como un valor simple. Para `tool.call` es la llamada a la herramienta, con su tipo acotado según cada herramienta.
- `next(e)` pasa el evento a los demás plugins y después al comportamiento propio de Claude Code, y se resuelve con el resultado del evento.

Un hook que termina sin llamar a `next` responde el evento por sí mismo. Un hook que llama a `next({ ...e, ... })` cambia lo que ve el resto de la cadena, dentro de lo que ese evento permite. La mayoría de los hooks que solo observan terminan con `return next(e)`.

El archivo opcional `types/index.d.ts` es el contrato de tipos del mod. Declara la forma de los valores que el mod guarda en `$.state` (y, en un mod que añade un sustantivo a `$`, ese sustantivo). `plugin.json` lo nombra en `"types"`, y `claude plugin validate` comprueba con él las lecturas y escrituras de estado del mod.

## Constrúyelo con Claude

No necesitas escribir estos archivos tú. Claude Code incluye una skill para escribir mods, `plugin-authoring`, que conoce los tipos reales de la API de mods. Pídele a Claude que la use y describe lo que quieres con palabras sencillas: el nombre del mod, qué hace y cuándo.

> Usando la skill plugin-authoring, crea un mod de Claude Code llamado `greeter` en una carpeta nueva. Cuando empieza una sesión, muestra un toast que dice "Hello from greeter". Cuenta cada llamada a una herramienta y muestra la cuenta en su barra de estado, por ejemplo "greeter: 3 tool calls". Guarda la cuenta en `$.state` con un `atom` declarado en `types/index.d.ts`, para que sobreviva a una recarga del módulo. Cuando termines, ejecuta `claude plugin validate` sobre la carpeta y muéstrame lo que informa.

Por qué funciona este prompt:

- **Nombra la skill**, así que Claude comprueba cada llamada con la API real en lugar de adivinar.
- **Describe un comportamiento que puedes ver** (el toast y la barra de estado), así que sabrás cuándo funciona.
- **Dice dónde vive la cuenta.** Sin esa línea, una primera respuesta habitual guarda la cuenta en una variable normal que vuelve a cero cada vez que guardas el archivo. El paso 4 de abajo explica por qué.
- **Pide una prueba.** La salida de validate lista los hooks y las llamadas que el mod hace de verdad.

Cuando Claude responda, comprueba cuatro cosas antes de seguir:

1. La carpeta tiene los cuatro archivos de la tabla de arriba: `plugin.json`, `hooks.json`, `register.tsx` y `types/index.d.ts`.
2. Cada hook termina con `return next(e)`.
3. La cuenta usa `atom` y `update`, no una variable declarada con `let`.
4. `claude plugin validate` lista `hooks: session.start, tool.call`.

Si algo no cuadra, cuéntale a Claude lo que ves, no solo cómo arreglarlo: "la cuenta vuelve a 0 cada vez que guardo `register.tsx`". Describir el síntoma permite a Claude encontrar la causa, y tú aprendes a leer el mod como lo lee él.

## Entiende el código, paso a paso

Así es una buena respuesta, construida pieza a pieza. Léela para entender qué hace cada línea y para compararla con lo que escribió Claude. Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

### 1. El manifiesto

El mod vive en una carpeta llamada `greeter`. Su manifiesto es `.claude-plugin/plugin.json`:

```json
{
  "name": "greeter",
  "version": "0.1.0",
  "description": "Says hello when a session starts and counts tool calls"
}
```

El `name` es el nombre con el que Claude Code, su registro de depuración y tus claves de estado se refieren al mod.

### 2. El archivo de hooks

`hooks/hooks.json` le dice a Claude Code qué archivo contiene los hooks:

```json
{ "modules": ["./register.tsx"] }
```

### 3. Un hook que muestra algo

`hooks/register.tsx` empieza con un hook en `session.start`:

```tsx
import type { Register } from 'claude-code'

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    $.ui.toast('Hello from greeter')
    return next(e)
  })
}
```

`Register` viene del módulo `claude-code`. La importación es solo de tipos: en tiempo de ejecución está vacía. `$.ui.toast(text)` muestra un recuadro pequeño bajo el nombre del plugin durante unos segundos (4000 ms por defecto). Después, el hook llama a `next(e)` para que la sesión empiece como siempre.

### 4. Una barra de estado que cuenta las llamadas a herramientas

Un segundo hook cuenta las llamadas. `tool.call` se ejecuta en cada llamada a una herramienta, y `$.ui.status(text)` fija una línea para este plugin bajo el prompt hasta que la siguiente llamada la sustituye:

```tsx
import type { Register } from 'claude-code'

export const register: Register = (on) => {
  let count = 0

  on('session.start', async ($, e, next) => {
    $.ui.toast('Hello from greeter')
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    count += 1
    $.ui.status(`greeter: ${count} tool calls`)
    return next(e)
  })
}
```

Esta es una primera respuesta habitual, y un buen ejemplo de por qué conviene comprobar: funciona hasta que guardas el archivo. `count` es una variable del módulo, y al guardar, el módulo se recarga en un entorno nuevo, así que la cuenta vuelve a empezar en 0.

### 5. Un contrato de tipos y un estado que sobrevive a una recarga

La solución es `$.state`, que guarda valores con nombre durante la sesión y los conserva cuando el módulo se recarga. El valor se declara en `types/index.d.ts`:

```ts
declare module 'claude-code' {
  interface PluginState {
    greeter: { calls: number }
  }
}
```

El manifiesto nombra ese archivo:

```json
{
  "name": "greeter",
  "version": "0.1.0",
  "description": "Says hello when a session starts and counts tool calls",
  "types": "./types/index.d.ts"
}
```

Y el hook usa las funciones auxiliares de estado `atom` y `update` de `claude-code`:

```tsx
import { atom, update } from 'claude-code'
import type { Register } from 'claude-code'

const calls = atom({ plugin: 'greeter', key: 'calls' } as const, 0)

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    $.ui.toast('Hello from greeter')
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const count = await update($, calls, (n) => n + 1)
    $.ui.status(`greeter: ${count} tool calls`)
    return next(e)
  })
}
```

`plugin` y `key` deben ser literales de cadena que coincidan con el contrato. `update` lee el valor, aplica la función y lo vuelve a escribir, reintentando si otra escritura llegó antes, y se resuelve con el nuevo valor.

El mod terminado:

```text
greeter/
  .claude-plugin/plugin.json
  hooks/hooks.json
  hooks/register.tsx
  types/index.d.ts
```

La siguiente guía, "Instalar, recargar, validar y probar", muestra cómo cargarlo en una sesión y probarlo.

## Errores comunes y cómo probarlo

- **Olvidar `next`.** Un hook que nunca llama a `next(e)` responde el evento en solitario. En `session.start` o `tool.call` eso cambia más de lo que pretendías. Devuelve `next(e)` salvo que responder sea justo lo que buscas.
- **Registrar el mismo hook dos veces.** Un registro repetido lanza un error, y un bucle que ejecuta dos veces un mismo `on(...)` pasa la validación pero se rechaza al cargar.
- **Usar API de Node o del DOM.** No hay `require`, ni módulo `fs`, ni `window`. Usa `$.fs`, `$.http`, `$.process` y el resto de `$`.
- **Un hook que lanza un error.** Se omite y la cadena sigue sin él. Ejecuta `claude --debug` mientras desarrollas: el registro de depuración indica por qué se omitió un hook.

Ejecuta `claude plugin validate` sobre la carpeta pronto y a menudo. Lee el manifiesto, el contrato y el módulo de hooks como lo hará Claude Code. Para el `greeter` terminado informa, entre otras, de estas líneas:

```text
❯ types ./types/index.d.ts declares state: greeter.calls
❯ ./register.tsx hooks: session.start, tool.call
❯ ./register.tsx gating hook without .catch: tool.call
❯ ./register.tsx calls: $.state.get, $.state.set, $.ui.status, $.ui.toast
```

La línea `gating hook without .catch` es un dato, no un fallo: `tool.call` es un evento cuya respuesta puede rechazar lo que se pidió, y un hook ahí que falla se omite. Solo un hook que actúa de guarda (uno que puede rechazar una llamada) necesita un manejador `.catch`.

## Para ir más lejos

narsil-pet sigue la misma estructura. Su `.claude-plugin/plugin.json` define `"license": "GPL-3.0-or-later"`, `repository` y `"types": "./types/index.d.ts"`. Su `hooks/hooks.json` es la misma línea que arriba. Su `hooks/register.tsx` exporta `register` y registra un hook por evento, empezando por `session.start`, que registra el comando `/narsil`, restaura las preferencias desde `$.store` y arranca sus temporizadores antes de devolver `next(e)`. Su `types/index.d.ts` exporta los tipos del mod (`Mood`, `Pet`, `Prefs` y otros) y declara cada clave de `$.state` en `PluginState['narsil-pet']`.
