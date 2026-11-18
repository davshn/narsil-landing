---
title: 'Superficies: terminal, escritorio, VS Code y móvil'
description: Dónde dibuja un mod, qué elementos tiene cada superficie y cómo escribir un hook de dibujo que funcione en la terminal, la aplicación de escritorio, VS Code y la aplicación móvil.
route: mods
order: 4
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: README.md
  - repo: pet
    path: hooks/register.tsx
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: README.md
---

## Qué hace

Un mismo mod puede dibujar en la terminal, en la aplicación de escritorio de Claude, en VS Code y en la aplicación móvil de Claude. Cada uno de estos lugares es una superficie, y cada superficie tiene su propio conjunto de elementos (cajas, texto, botones, campos).

Esta guía explica cómo sabe un mod en qué superficie dibuja, qué ofrece cada superficie y cómo pedirle a Claude un diseño que funcione en todas.

## Cómo funciona por dentro

Un mod dibuja enganchándose a `ui.render` para un componente. El hook recibe una instancia del componente en `e`:

- `e.component`: qué sitio se dibuja (`AbovePrompt`, `Pane`, `ToolUse` y otros).
- `e.surface`: dónde se dibuja: `terminal`, `desktop`, `mobile` o `vscode`.
- `e.props`: las props propias del sitio, como datos simples.
- `e.viewport`: cuando la superficie ya ha medido, el tamaño en el que dibuja, en celdas de caracteres.

Una sesión puede dibujar en varias superficies a la vez, por ejemplo una terminal y dos teléfonos. `$.session.surfaces()` lista todas las superficies en las que dibuja la sesión, con la terminal primero. Un hook de dibujo no necesita esa lista: se le llama una vez por superficie y lee `e.surface` cada vez.

Los elementos no son globales. `$.ui.resolve(e)` devuelve la tabla de la superficie en la que se dibuja `e`, y el hook extrae de ella sus etiquetas JSX por desestructuración. Acotar `e.surface` acota el tipo de la tabla.

| Superficie | Elementos                                                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `terminal` | `Box`, `Text`, `Button`, `Input`, `Select`, `Link`, `Code`, `Markdown`, `Progress`, más `Client`, `Raster` e `Image`. Sin `Svg`. |
| `desktop`  | Los nueve elementos compartidos, más `Svg` y `Client`.                                                                           |
| `vscode`   | La tabla del escritorio sin `Client`.                                                                                            |
| `mobile`   | Los nueve elementos compartidos, más `Svg`. Sin `Client`.                                                                        |

En el móvil, una aplicación recibe un `Input` o un `Select` solo si declaró que los dibuja, y un `Box` vacío en caso contrario; con `Progress` ocurre lo mismo, que recurre a su `Box` y su `Text`. Un hook no puede saber cuál recibió la aplicación.

Dónde se dibuja cada sitio, según el archivo de declaraciones:

| Sitio                                            | Se lanza en                       | Notas                                                                                                                                                                                             |
| ------------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AbovePrompt` (la banda encima del prompt)       | solo terminal, escritorio y móvil | Una fila por plugin. La persona puede contraerla o enfocarla.                                                                                                                                     |
| `Pane` (abierto con `$.ui.open`)                 | todas las superficies conectadas  | Acoplado en la disposición a pantalla completa de la terminal; si no, encima del prompt. En la aplicación de escritorio también puede ser un `widget` pequeño, que se lee en `e.props.placement`. |
| `ToolUse` (la fila de una llamada a herramienta) | todas las superficies conectadas  | En el móvil, un árbol que conserva la fila suele dibujarse como una línea discreta debajo de ella; un `borderStyle` o un `backgroundColor` en el `Box` que la contiene pide una tarjeta.          |

Dos salidas no pasan por `ui.render`. `$.ui.status(text)` fija una línea para el plugin bajo el prompt. `$.ui.toast(text)` flota sobre la esquina superior derecha de la transcripción y, donde la transcripción se imprime en el historial de desplazamiento, es una línea en la barra de notificaciones. El archivo de declaraciones no detalla, superficie por superficie, dónde aparecen estas dos salidas.

## Constrúyelo con Claude

La trampa de las superficies es que un mod puede verse bien en la superficie donde lo pruebas y romperse en otra. Por eso el prompt pide a Claude que consulte la tabla de elementos antes de usar un elemento, y que pruebe todas las superficies:

> Usando la skill plugin-authoring, añade a mi mod de Claude Code `greeter` una banda encima del prompt: un hook `ui.render` en `AbovePrompt` que muestre la cuenta de llamadas a herramientas y la superficie donde se dibuja, y que devuelva `next(e)` cuando `e.props.hasSurvey` sea true. Toma los elementos de `$.ui.resolve(e)`. Después dibuja un `Pane` con el id de solicitud `notes` que muestre un campo de texto solo donde la superficie tenga `Input` y no sea el móvil, y la línea "Ask Claude to add a note." en todas las demás. Escribe una prueba con `claude-code/testing` que monte el panel en `terminal`, `desktop`, `vscode` y `mobile` en un solo bucle.

Cuando Claude responda, comprueba:

1. Los elementos vienen de `$.ui.resolve(e)`. Ninguno se importa ni se da por supuesto.
2. Cada elemento que no está en las cuatro tablas (`Input`, `Svg`, `Raster`, `Image`, `Client`) se comprueba antes de usarlo, con una alternativa.
3. La prueba recorre las cuatro superficies.
4. Ningún hook de dibujo llama a `$.state.set`.

Aunque solo uses la terminal, ese bucle de prueba es la forma de saber si el mod funciona en la aplicación de escritorio y en un teléfono.

## Entiende el código, paso a paso

Así es una buena respuesta. Léela para entender por qué está cada comprobación y para compararla con lo que escribió Claude.

### 1. Una banda que lee su superficie

```tsx
import { atom, read } from 'claude-code'
import type { Register } from 'claude-code'

const calls = atom({ plugin: 'greeter', key: 'calls' } as const, 0)

export const register: Register = (on) => {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const count = await read($, calls)
    const where = e.surface === 'terminal' ? 'in the terminal' : `on ${e.surface}`

    return (
      <Box>
        <Text dimColor>
          {count} tool calls {where}
        </Text>
      </Box>
    )
  })
}
```

`Box` y `Text` están en todas las tablas, así que este árbol se dibuja allí donde se lance la banda. El hook cede el sitio a una encuesta (`e.props.hasSurvey`) devolviendo `next(e)`.

### 2. Usa un elemento solo donde la superficie lo tiene

Cuando un árbol necesita un elemento que falta en algunas superficies, comprueba la tabla en lugar de darlo por hecho. Esto está adaptado del hook de `Pane` en el `hooks/register.tsx` de narsil-check, que muestra un SVG solo donde hay `Svg` y un campo de texto en todas partes salvo en el móvil:

```tsx
on('ui.render', { component: 'Pane', requestId: 'notes' }, async ($, e) => {
  const elements = $.ui.resolve(e)
  const { Box, Text } = elements
  const Input = e.surface !== 'mobile' && 'Input' in elements ? elements.Input : undefined

  return (
    <Box flexDirection="column">
      <Text bold>Notes</Text>
      {Input ? (
        <Input key="new" label="New note" onSubmit={() => undefined} />
      ) : (
        <Text dimColor>Ask Claude to add a note.</Text>
      )}
    </Box>
  )
})
```

La misma comprobación con `'Svg' in elements` mantiene la terminal, que no tiene `Svg`, en una alternativa de texto.

### 3. Ajusta el tamaño al espacio que tienes

Un hook de `Pane` o de `AbovePrompt` ajusta su árbol a `e.props.bodyColumns`, el recuadro en el que dibuja. Es más estrecho que el viewport mientras un panel está acoplado junto a la transcripción. Un cambio de ancho vuelve a ejecutar todos los sitios enganchados, así que un árbol dimensionado a partir de `bodyColumns` sigue siendo correcto.

### 4. Pruébalo en todas las superficies

`claude plugin test` monta un componente en una superficie que la prueba nombra, nunca en una supuesta. Recorre el mismo cuerpo en un bucle sobre las superficies:

```tsx
for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
  const ui = await $.ui.mount({ ...PANE, surface })
  expect(await ui.find({ type: 'Text', text: /Notes/ })).toBeDefined()
  await ui.unmount()
}
```

`PANE` contiene `plugin`, `component`, `requestId` y `props`, como en el ejemplo `pane.test.tsx` de la skill.

## Errores comunes y cómo probarlo

- **Dar por hecha la tabla de una superficie.** `Svg` no está en la tabla de la terminal, y `Raster` e `Image` solo están en la de la terminal. Comprueba la tabla (`'Svg' in elements`) o acota `e.surface`, y los tipos te dirán qué elementos puedes usar.
- **Un árbol que no pasa la validación.** Un elemento que la superficie no tiene, una prop que no acepta o un hijo donde no corresponde hace fallar el hook. Se omite solo ese hook, y las partes de los demás plugins se siguen dibujando. El registro de depuración, y la transcripción mientras se recarga en caliente una carpeta de plugin, indican el motivo.
- **Contar con `Input` en el móvil.** Una aplicación móvil que no lo dibuja no muestra nada en su lugar. Ofrece otra vía, como pedírselo a Claude mediante una herramienta registrada.
- **Esperar la banda en todas partes.** En esta versión, el archivo de declaraciones lanza `AbovePrompt` solo en las superficies de terminal, escritorio y móvil. Un `Pane` se lanza en todas las superficies conectadas.
- **Una sola superficie en las pruebas.** Una prueba que solo monta `terminal` no demuestra nada sobre las demás. Recorre las cuatro en un bucle.

## Para ir más lejos

El README de narsil-pet dice que su banda, sus animaciones, sus consejos y sus barras de uso funcionan allí donde Claude Code los dibuja, y enumera la terminal, la aplicación de escritorio, VS Code y la aplicación móvil. Su voz, sus notificaciones y su ventana flotante se ejecutan en el ordenador donde corre la sesión, así que dependen de ese sistema y no de la superficie. Su hook `ui.render` sobre `AbovePrompt` en `hooks/register.tsx` registra qué superficies pidieron la banda, y `surfaceReport` combina ese dato con `$.session.surfaces()`.

El README de narsil-check tiene una tabla por superficie: las secciones de actualizaciones, vulnerabilidades y tareas pendientes funcionan en todas las superficies, la aplicación móvil no tiene un campo para escribir tareas (se añaden pidiéndoselo a Claude), y las secciones de entorno, conectores y control remoto solo aparecen en la aplicación de escritorio, porque se leen de los propios servidores MCP de la aplicación de escritorio. En `hooks/register.tsx`, el hook de `Pane` obtiene `Svg` e `Input` de la tabla como en el paso 2.
