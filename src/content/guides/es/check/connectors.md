---
title: Conectores
description: 'Cómo Narsil Check enumera los servidores MCP de la sesión con su estado y cuántas herramientas tiene cada uno, consultados una vez al propio servidor de conectores de la app de escritorio.'
route: check
order: 3
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/session.ts
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: tests/session.test.tsx
---

## Qué hace

La sección **Conectores** enumera los servidores MCP de la sesión, la misma lista que muestra la barra de sesión de la app de escritorio. Responde a dos preguntas rápidas: qué servidores puede usar Claude ahora mismo, y cuál te necesita.

La cabecera dice `▸ Conectores · 2`, donde el número cuenta los servidores conectados. Desplegada, muestra:

- **Primero los servidores conectados**, cada uno con un punto verde y cuántas herramientas ofrece, como `notes-server · 19 herramientas`.
- **Después el resto**, cada uno con un punto amarillo y su estado tal como lo informa la app, como `Mail · needs_auth`.

Cuando no hay nada conectado dice "No hay conectores conectados.". Cuando la lista no se puede leer, dice por qué en rojo: "No pude leer los conectores: …".

El punto de la sección lo resume: verde cuando todos los servidores están activos, amarillo cuando uno necesita iniciar sesión o falló, rojo cuando la lista no se pudo leer, gris antes de la primera lectura.

Cada sesión empieza con esta sección plegada; el inicio de sesión la deja así (`isConnectorsOpen` a `false`) sin importar cómo la dejaste.

## Cómo funciona por dentro

### De dónde sale la lista

La lista es una llamada al propio servidor de conectores de la app de escritorio, hecha en `loadSession` en `hooks/register.tsx`, junto a las lecturas de sesión de la guía anterior:

```tsx
const result = await $.mcp.call(CONNECTORS_SERVER, CONNECTORS_TOOL)
const list = result.isError
  ? undefined
  : parseConnectors(result.structuredContent ?? jsonOf(result.content))
connectors = list
  ? { connectors: list }
  : { connectors: [], connectorsError: textOf(result.content) || 'respuesta sin conectores' }
```

`CONNECTORS_SERVER` es `'ccd_connectors'` y `CONNECTORS_TOOL` es `'session_connectors_status'`, ambos en `hooks/session.ts`. La llamada no lleva argumentos. Como con todo `$.mcp.call` (ver la guía anterior), la respuesta se lee de `structuredContent` cuando lo hay y del JSON de los bloques de texto en otro caso, y un fallo se captura y se guarda como `connectorsError`.

`parseConnectors` convierte la respuesta en el tipo propio del mod, `Connector` en `types/index.d.ts`: `{ name, status, tools? }`. Lee un array `servers`; descarta cualquier entrada sin un `name` de tipo cadena; guarda `status` como texto, o `'unknown'` cuando falta; y guarda `tool_count` como `tools` solo cuando es un número. Si no hay ningún array `servers`, devuelve `undefined`, que quien llama convierte en un error en lugar de una lista vacía.

Esa distinción es deliberada: "no hay servidores conectados" y "no pude leer los servidores" son respuestas distintas, y la sección las muestra de forma distinta.

### Qué muestra, y qué no

La sección muestra el nombre, el estado y el número de herramientas de cada servidor. No enumera los nombres de las herramientas. El README describe lo mismo: los servidores conectados "con cuántas herramientas tiene cada uno", y después los demás con su estado.

Los campos que lee (`servers`, `name`, `status`, `tool_count`) son la respuesta del servidor de la app de escritorio, no parte de la API de mods, así que los tipos de 2.1.325 no los documentan. El fixture de `tests/session.test.tsx` muestra la forma con la que trabajó quien creó Narsil Check, con un campo `kind` que el mod ignora. El analizador acepta lo que no conoce: un estado distinto de `connected` se muestra tal como llegó, y el punto amarillo de una fila solo significa "no conectado".

Las palabras son funciones puras en `hooks/session.ts`, así que se pueden probar por separado:

- `connected(view)` filtra los servidores cuyo estado es `connected`.
- `connectorsLabel(isOpen, view)` dibuja la cabecera, con el recuento solo cuando es mayor que cero.
- `connectorLine(c)` dibuja una fila: el nombre, después el número de herramientas para un servidor conectado, y si no el estado.
- `toolsLabel(n)` dice `1 herramienta` o `N herramientas`.
- `connectorsColor(view)` elige el punto, comprobando primero el error, después si la lista se leyó, y después si algún servidor está en `needs_auth` o `failed`.

### Cuándo se vuelve a leer

Los conectores se leen en el mismo `loadSession` que el resto de la sesión, así que siguen el mismo calendario cuidadoso: una vez diez segundos después de que empiece la sesión, otra vez en el primer turno si aquello falló, y después de un turno solo cuando el turno usó una herramienta que cambia la respuesta de los servidores. Para los conectores eso significa cualquier herramienta `mcp__ccd_connectors__`, que forma parte de `SESSION_TOOLS`. Abrir el pliegue vuelve a leerlo todo, así que desplegar la sección es la forma de refrescarla a mano.

La razón es la misma que para el entorno: todos los demás mods ven cada llamada a los servidores de la app como una llamada a herramienta, y una temprana puede hacer que la app de escritorio pida permiso.

### Por qué un servidor del escritorio, y no el motor

Los tipos de 2.1.325 dan al mod dos llamadas en `$.mcp`: `call`, para llamar a una herramienta de un servidor conectado, y `connect`, para traer a la sesión un servidor retenido. Ninguna de las dos enumera los servidores con sus estados. La app de escritorio tiene una herramienta que sí lo hace, así que Narsil Check se lo pregunta a ella.

El coste es la superficie. Fuera de la app de escritorio no hay `ccd_connectors`, la llamada falla, y la sección lo dice. La tabla de superficies del README lo indica: Conectores funciona en la app de escritorio, y en otros sitios "la sección dice por qué no pudo leerlos".

### Para qué sirve la sección

Los commits muestran que el propósito de la sección cambió una vez. En `2bd1919` un clic en cualquier fila de conector abría `/mcp`, la propia lista de servidores del motor. Un commit después, `c07f5e9` volvió a dejar las filas sin acción, y su mensaje dice por qué: "/mcp from a mod only prints a summary in the desktop app" (/mcp desde un mod solo imprime un resumen en la app de escritorio). Así que la sección sirve para leer de un vistazo, y el sitio para iniciar sesión o arreglar un servidor sigue siendo el de la propia app.

## Constrúyelo con Claude

Pídele a Claude una sección que liste los servidores MCP de la sesión y su estado. La única idea que debe entender bien es que «no hay servidores conectados» y «no pude leer los servidores» son respuestas distintas, y la sección las muestra de forma distinta.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil Check.

> En mi mod de Claude Code `my-panel`, añade al panel una sección "Connectors". En la app de escritorio, lee los servidores MCP de la sesión una vez con `$.mcp.call('ccd_connectors', 'session_connectors_status')`, prefiriendo `structuredContent` y recurriendo al JSON del contenido de texto. Analiza un array `servers` en `{ name, status, tools }` a partir de `name`, `status` y `tool_count`, descartando las entradas sin nombre, y trata un array ausente como un error, no como una lista vacía. Muestra primero los servidores conectados con un punto verde y su número de herramientas, y después los demás con un punto amarillo y su estado. Colorea el punto de la sección en rojo cuando la lectura falló, gris antes de ella, amarillo cuando un servidor está en `needs_auth` o `failed`, y verde en otro caso. Vuelve a leer solo cuando se abra el pliegue. Prueba el analizador y los colores como funciones puras.

### Qué revisar en la respuesta de Claude

1. La lista sale de una sola llamada `$.mcp.call('ccd_connectors', 'session_connectors_status')`, leída primero de `structuredContent` y, si no, del JSON del contenido de texto.
2. El parser descarta las entradas sin un `name` de tipo texto, conserva un `status` desconocido como texto y devuelve `undefined`, no una lista vacía, cuando no hay un array `servers`.
3. El punto de la sección es rojo cuando la lectura falló, gris antes de la primera lectura, amarillo cuando un servidor está en `needs_auth` o `failed`, y verde en cualquier otro caso.
4. Los servidores conectados van primero con un punto verde y su número de herramientas, y después los demás con un punto amarillo y su estado.
5. La lista no se lee con un temporizador. Abrir el pliegue la vuelve a leer.

Si una comprobación falla, dile a Claude lo que ves: "fuera de la app de escritorio la sección dice que no hay conectores conectados, en vez de decir por qué no pudo leerlos".

### Cómo lo pidió el autor

La petición original de la sección de conectores no quedó registrada. Ninguno de los registros de tareas públicos de narsil-check (`odd/tasks/*.md`) trata de ella.

#### Reconstrucción a partir del historial de commits

A partir de `git log -- hooks/session.ts`, con los commits relacionados de `hooks/register.tsx`:

- `be8eac0` (2026-11-05) "feat: show the session bar's environment, connectors and Remote Control in the pane" (mostrar en el panel el entorno, los conectores y Remote Control de la barra de sesión). Los conectores llegan junto con el entorno, como parte de sustituir la barra de sesión de la app.
- `2bd1919` (2026-11-05) "feat: repository link, Remote Control switch in Entorno and /mcp from connectors" (enlace al repositorio, interruptor de Remote Control en Entorno y /mcp desde los conectores). Su mensaje: "Any connector row opens /mcp." (Cualquier fila de conector abre /mcp.)
- `c07f5e9` (2026-11-05) "feat: Entorno starts open, other sections fold until they have something" (Entorno empieza abierta, las demás secciones se pliegan hasta que tienen algo). Conectores empieza plegada, y las filas vuelven a no tener acción.
- `55fe118` (2026-11-06) y `4770a49` (2026-11-06), las dos correcciones que hicieron más escasa cada lectura de los servidores de la app, tratadas en la guía anterior. Se aplican a los conectores porque se leen en la misma llamada.

El patrón: una funcionalidad añadida con el resto de la barra de sesión, un clic que resultó no ayudar en la app de escritorio y se quitó, y la regla de preguntar poco, heredada del entorno.

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Esta es una versión reducida de la idea, escrita para esta guía y comprobada con los tipos de Claude Code 2.1.325. Está adaptada de `hooks/session.ts` y `hooks/register.tsx` en [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later).

La parte pura, `hooks/connectors.ts`:

```ts
export type Connector = { name: string; status: string; tools?: number }

export function parseConnectors(value: unknown): Connector[] | undefined {
  const servers = (value as { servers?: unknown } | undefined)?.servers
  if (!Array.isArray(servers)) return undefined
  return servers
    .filter(
      (s): s is Record<string, unknown> =>
        typeof s === 'object' && s !== null && typeof s.name === 'string',
    )
    .map((s) => ({
      name: s.name as string,
      status: typeof s.status === 'string' ? s.status : 'unknown',
      ...(typeof s.tool_count === 'number' ? { tools: s.tool_count } : {}),
    }))
}

export function connectorLine(c: Connector): string {
  if (c.status !== 'connected') return `${c.name} · ${c.status}`
  return c.tools === undefined ? c.name : `${c.name} · ${c.tools} tools`
}
```

La llamada, en `hooks/register.tsx`, que devuelve la lista o el motivo por el que no se pudo leer:

```tsx
import type { EngineInterface } from 'claude-code'
import { parseConnectors, type Connector } from './connectors'

async function readConnectors($: EngineInterface): Promise<{ list: Connector[]; error?: string }> {
  try {
    const result = await $.mcp.call('ccd_connectors', 'session_connectors_status')
    const list = result.isError ? undefined : parseConnectors(result.structuredContent)
    return list ? { list } : { list: [], error: 'no list in the answer' }
  } catch (err) {
    return { list: [], error: err instanceof Error ? err.message : String(err) }
  }
}
```

Guarda el resultado en un atom y dibújalo en el hook `ui.render` del panel como en la primera guía: primero las filas conectadas, después el resto, cada una con `connectorLine`. Esta versión mínima solo lee `structuredContent`; Narsil Check también analiza el JSON de los bloques de texto (`jsonOf` en `hooks/session.ts`), por si el servidor responde solo con texto.

## Errores comunes y cómo probarlo

Estos salen del código y los commits de Narsil Check:

- **Tratar una lectura fallida como "no hay servidores".** Devuelve `undefined` desde el analizador cuando la forma es incorrecta, y muestra el error. "No hay conectores" es una respuesta real que solo debe salir de una lista real.
- **Fiarse de la forma de la respuesta de la app.** Estos campos son de la app de escritorio, no de la API de mods. Comprueba el tipo de cada campo, como hace `parseConnectors`, y muestra un estado desconocido como texto.
- **Refrescar con un temporizador.** Cada llamada es una llamada a herramienta que ven otros mods. Lee en eventos: el inicio, un turno que tocó los conectores, la apertura del pliegue.
- **Enlazar las filas a `/mcp`.** Narsil Check lo probó y lo quitó (`c07f5e9`): desde un mod, en la app de escritorio, solo imprime un resumen.
- **Esperarla en todas las superficies.** `ccd_connectors` es de la app de escritorio; en otros sitios la sección solo puede decir por qué está vacía.

Para probarlo, los analizadores y las etiquetas son puros: `tests/session.test.tsx` los comprueba directamente en "the session section reads the app servers and names what it found" (la sección de sesión lee los servidores de la app y nombra lo que encontró). Para la sección en sí, responde al servidor con un hook como `on('mcp.call', (_, e) => e.server === 'ccd_connectors' ? { value: { content: [{ type: 'text', text: JSON.stringify({ servers: [...] }) }], isError: false } } : ...)`, monta el panel, pulsa `section-connectors` y busca las filas. Usa nombres de servidor sintéticos en los fixtures, como `notes-server` y `Mail`.

## Para ir más lejos

- La sección va junto con el entorno de la guía anterior: los dos se leen en un solo `loadSession`, así que un solo calendario rige cada llamada a los servidores de la app.
- Los tipos ofrecen otra fuente que funciona en todas las superficies: `$.tool.list()` devuelve las herramientas que el modelo puede llamar ahora, cada una con `name`, `description` y `mcp: true` para la herramienta de un servidor MCP. Agrupar los nombres `mcp__server__tool` por servidor da los servidores conectados y sus herramientas, por nombre. No dice qué servidores esperan un inicio de sesión o fallaron, que es para lo que sirven aquí las filas amarillas. Es una disyuntiva real, y narsil-check eligió el servidor del escritorio.
- `$.mcp.connect(server)` puede traer un servidor que la sesión retuvo, que es el paso siguiente a ver un servidor que no está conectado. Narsil Check no lo usa.
