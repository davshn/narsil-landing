---
title: El panel lateral
description: 'Cómo Narsil Check dibuja un panel junto al chat con secciones plegables, un punto de color por sección, pliegues que recuerda y filas que copias con un clic.'
route: check
order: 1
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: check
    path: hooks/register.tsx
  - repo: check
    path: hooks/words.ts
  - repo: check
    path: types/index.d.ts
  - repo: check
    path: README.md
  - repo: check
    path: hooks/explain.ts
  - repo: check
    path: hooks/osv.ts
  - repo: check
    path: tests/pane.test.tsx
  - repo: check
    path: odd/tasks/vulnerabilities.md
  - repo: check
    path: odd/tasks/ecosystems-wave-2.md
---

## Qué hace

Narsil Check es un panel que se sitúa junto al chat, con el título **● Narsil Check**. Es el compañero de Narsil, la mascota de estado de la primera ruta, y habla con sus colores. Donde Narsil responde "¿tengo que hacer algo ahora mismo?", el panel responde "¿cómo va este proyecto?".

El panel es una columna de secciones, una por comprobación: **Entorno** (el entorno de la sesión), **Conectores**, **Actualizaciones**, **Vulnerabilidades** y **Pendientes** (una lista de tareas por proyecto). Las etiquetas están en español, como en Narsil.

Cada sección tiene una cabecera con tres partes:

- **Un punto de color** que dice lo más urgente dentro de la sección, para que puedas leer el panel plegado.
- **Una flecha**: `▾` cuando la sección está abierta, `▸` cuando está plegada. Un clic en la cabecera la pliega o la despliega.
- **Un nombre y un recuento**, como `▾ Actualizaciones · 3` o `▸ Vulnerabilidades · 2`.

Dentro de **Actualizaciones** y **Vulnerabilidades**, cada grupo (actualizaciones bloqueadas, versiones mayores, avisos críticos, etc.) también se pliega desde su propia cabecera, y el panel recuerda cuáles cerraste. Un clic en una biblioteca o en un aviso lo copia al portapapeles, con un mensaje corto que dice si funcionó.

El valor está en tener un solo sitio donde mirar. El README dice que con el panel abierto puedes ocultar la barra de sesión propia de la app de escritorio y quedarte con un único panel.

## Cómo funciona por dentro

### Un panel es algo que abres y después dibujas

Un mod no obtiene un panel declarándolo. Lo pide con `$.ui.open` y después dibuja su contenido en un hook `ui.render` para el componente `Pane`. Son dos pasos separados, y los dos están en `hooks/register.tsx`.

La apertura ocurre en el hook `session.start`:

```tsx
// Opens on every session: it stands in for the app's session bar.
await $.ui.open({ id: PANE, title: TITLE }).catch(() => undefined)
```

`PANE` es `'narsil-check'` y `TITLE` es `'Narsil Check'`, ambos en `hooks/words.ts`. El id da nombre al panel; abrir un id que ya está abierto solo le cambia el título, según los tipos de 2.1.325.

El dibujo es un hook filtrado a ese id:

```tsx
on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
  const { Box, Text, Button, Link } = $.ui.resolve(e)
  // ...reads the atoms and returns the tree
})
```

`$.ui.resolve(e)` da los elementos que esta superficie puede dibujar. El hook comprueba lo que recibió: `Svg` solo existe fuera del terminal (así que la Narsil bebé solo se dibuja allí), y la app móvil no recibe `Input` (así que allí las tareas se añaden pidiéndoselo a Claude). También lee `e.surface` para decidir si tiñe las cabeceras de grupo: el terminal conserva los bordes y no dibuja tintes.

### Qué significa `isPlaced`

`$.ui.open` resuelve un resultado, `UiOpenResult` en los tipos. `{ isPlaced: true }` significa que el panel está abierto y dibujado, y a continuación llega el primer `ui.render` para `{ component: "Pane", requestId: id }`. `{ isPlaced: false, reason }` significa que el panel está abierto pero todavía no se ha dibujado.

Los tipos dan la regla: un panel abierto en respuesta a la persona (una orden, un prompt, una pulsación) se coloca con cualquier ancho. Un panel que el mod abre por su cuenta espera sin dibujar por debajo de 144 columnas de terminal, o de 110 una vez que la persona ha pedido ese id. Un panel que tiene otro plugin se rechaza, y la llamada se rechaza.

Narsil Check abre su panel por su cuenta en cada inicio de sesión, así que en un terminal estrecho puede quedarse esperando sin dibujar. El código no lee `isPlaced`; solo captura el rechazo para que un panel rechazado no rompa el inicio de sesión. Los tests responden al evento `ui.open` con `{ value: { isPlaced: true } }`, como si siempre se dibujara. Cuando la persona escribe `/narsil-check upgrade` o `/narsil-check vulns`, la orden vuelve a llamar a `$.ui.open`, y como esa apertura responde a la persona, se coloca con cualquier ancho. El README describe `/narsil-check upgrade` como la forma de volver a abrir el panel después de cerrarlo.

### Los colores del punto

Los colores son una sola tabla, `PALETTE` en `hooks/words.ts`, con los mismos valores que los estados de Narsil. Su comentario da el significado: "blue for what is running or informs, gray for what rests, yellow for what waits on you, green for what is done, red for what failed or blocks" (azul para lo que está en marcha o informa, gris para lo que descansa, amarillo para lo que te espera, verde para lo que está hecho, rojo para lo que falló o bloquea).

| Color    | Valor     | Significado en el código                                  |
| -------- | --------- | --------------------------------------------------------- |
| Rojo     | `#F0435A` | Algo falló o bloquea.                                     |
| Amarillo | `#F5B400` | Algo te espera.                                           |
| Verde    | `#22B573` | Hecho, al día, nada que hacer.                            |
| Azul     | `#3B8BFF` | Información, o algo en marcha.                            |
| Gris     | `#8A90A6` | En reposo: todavía sin leer, o sin necesidad de atención. |

Cada sección elige su punto con una pequeña función pura que comprueba primero el caso más urgente:

- **Actualizaciones**, `sectionColor`: rojo si el análisis falló o alguna actualización está bloqueada, amarillo si una versión mayor necesita revisión, azul si una versión está fuera del SDK de Expo, verde en otro caso, gris mientras el análisis no ha terminado.
- **Vulnerabilidades**, `vulnsColor`: rojo para una comprobación fallida, gris antes de que termine, verde si no hay ninguna, y en otro caso el color de la severidad más grave (`SEVERITY_COLOR`: rojo para crítica y alta, amarillo para moderada, gris para baja o sin clasificar).
- **Conectores**, `connectorsColor` en `hooks/session.ts`: rojo cuando no se pudieron leer, gris antes de cargar, amarillo cuando uno necesita iniciar sesión o falló, verde cuando todos están activos.
- **Entorno**: azul una vez leída la sesión, gris antes.

Desde el commit `6291eaf` el mismo color dibuja también el borde redondeado de la sección (`borderStyle: 'round'`, `borderColor`), y en superficies distintas del terminal la cabecera de un grupo se tiñe con su color a baja opacidad (`${tone}1F`), lo que según el comentario funciona igual en paneles claros y oscuros.

La razón de tener una función por sección, en lugar de un color guardado junto a los datos, es que el color nunca puede contradecir el contenido: se calcula a partir de él en cada dibujo.

### Pliegues: un atom por pliegue, o una lista de claves cerradas

Cada pliegue es estado, guardado en un atom (`atom` de `claude-code`). Hay dos formas:

- **Una sección** tiene su propio atom booleano: `isEnvOpen`, `isConnectorsOpen`, `isUpgradeOpen`, `isVulnsOpen`, `isTodosOpen`, `isCiOpen`. El `Button` de la cabecera lo invierte con `update($, isUpgradeOpen, value => !value)`.
- **Un grupo dentro de una sección** va en una sola lista, `closedGroups`, con las claves plegadas (como `upgrade-blocked` o `vulns-high`). `toggleGroup` añade la clave si falta y la quita si está. Todos los grupos empiezan abiertos, porque una lista vacía significa que no hay nada cerrado.

El hook de dibujo lee estos atoms con `read`, y una lectura durante un dibujo lo suscribe: cuando una pulsación llama a `update`, el panel se vuelve a dibujar sin ninguna llamada extra.

### Qué recuerda, y dónde

Aquí el código, sus comentarios y los tipos necesitan una lectura atenta.

En cada `session.start` el hook pone las secciones en valores fijos: Entorno abierta, Conectores, Actualizaciones y Vulnerabilidades plegadas, y Pendientes abierta solo cuando tiene tareas. Actualizaciones y Vulnerabilidades se despliegan solas cuando encuentran algo. El commit que lo introdujo, `c07f5e9`, dice "Fold state is no longer kept across sessions." (El estado de los pliegues ya no se conserva entre sesiones.)

Los grupos (`closedGroups`) y el pliegue de CI (`isCiOpen`) no se reinician al inicio de sesión. Los comentarios del código dicen que conservan cómo los dejaste "across sessions" (entre sesiones), y el README dice que el panel "recuerda cuáles cerraste".

Todos ellos son atoms, y los atoms pasan por `$.state`. Los tipos de 2.1.325 describen `$.state` como "Named values held by the host for the session" (valores con nombre que el anfitrión guarda durante la sesión) que sobreviven a una recarga en caliente del código del plugin, y añaden "Persist through `$.store`." (Persiste mediante `$.store`.) Un comentario en `hooks/register.tsx` señala que un `/clear` mantiene el módulo cargado bajo una sesión nueva, que es un caso en el que un atom sobrevive a una sesión. Si necesitas que un pliegue sobreviva a un reinicio de Claude Code, los tipos apuntan a `$.store`, no a un atom.

Los atoms se crean con una opción `shape` (`{ shape: 'closed-1' }`). Los tipos lo explican: el valor se guarda bajo esa etiqueta, y una versión más nueva del código que nombre otra etiqueta encuentra el valor ausente. El comentario sobre los atoms dice que hay que cambiar la etiqueta "when its type's fields change" (cuando cambian los campos de su tipo), para que un valor antiguo guardado nunca llegue a un código que espera campos nuevos.

### Copiar al portapapeles

Cada fila de biblioteca y cada fila de aviso es un `Button` `plain`. Su pulsación llama a `copyRow`:

```tsx
async function copyRow($: EngineInterface, text: string, surface: Surface): Promise<void> {
  const copied = await $.ui.copy({ text, surface })
  $.ui.toast(copied.isCopied ? 'Copiado al portapapeles.' : `No pude copiar: ${copied.reason}`)
}
```

La superficie viene de la pulsación: `onPress={press => copyRow($, copy, press.surface)}`. Ese detalle importa. Los tipos dicen que `$.ui.copy` pone el texto "on the clipboard of a surface the session draws on" (en el portapapeles de una superficie en la que dibuja la sesión), y que un hook de pulsación pasa `e.surface` para nombrar cuál; si se omite, es la primera superficie de la sesión. Una persona que hace clic en la app de escritorio quiere el texto en el portapapeles del escritorio, no en un terminal conectado a la misma sesión.

El resultado dice si funcionó: `{ isCopied: true }`, o `{ isCopied: false, reason }` con un motivo de un conjunto cerrado (`no-surface`, `no-clipboard`, `refused`). El toast informa de ambos casos, así que una copia fallida nunca parece una que funcionó.

Lo que se copia es más que la etiqueta de la fila. Dos funciones puras construyen el texto: `upgradeCopyText` en `hooks/explain.ts` (una actualización con su salto y lo que la bloquea o el motivo de Haiku) y `vulnCopyText` en `hooks/osv.ts` (un aviso con su severidad, la corrección y el enlace a OSV).

### Por qué las palabras viven en `hooks/words.ts`

Como en Narsil, el módulo de hooks decide qué pasó y `hooks/words.ts` decide cómo se dice: la paleta, las etiquetas y pistas de los grupos (`GROUPS`), las etiquetas de las cabeceras (`sectionLabel`, `vulnsLabel`, `groupLabel`) y los colores. Son funciones puras, y por eso `tests/pane.test.tsx` puede comprobarlas sin montar nada, como en "the section is colored by what most needs you, and its toggle names it" (la sección se colorea según lo que más te necesita, y su interruptor la nombra).

## Constrúyelo con Claude

Pídele a Claude un panel lateral con secciones que se pliegan y filas que se copian. La única idea que debe entender bien es que el panel se abre una vez y después lo dibuja un hook filtrado por su propio id, con cada pliegue guardado en un átomo que lee el dibujo.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil Check.

> Construye un mod de Claude Code llamado `my-panel` con un panel lateral. En `session.start`, llama a `$.ui.open({ id: 'my-panel', title: 'My panel' })` y captura un rechazo. Dibújalo en `ui.render` para `{ component: 'Pane', requestId: 'my-panel' }` con `$.ui.resolve(e)`. Muestra dos secciones, cada una en una caja con un borde redondeado de su color, y una cabecera con un punto de color (rojo para fallido, amarillo para lo que me espera, verde para hecho, azul para información, gris antes de cargar) y un `Button` `plain` con la etiqueta `▾ Name` o `▸ Name` que la pliegue. Guarda las claves de las secciones plegadas en un atom declarado en `types/index.d.ts`. Haz que cada fila sea un `Button` `plain` que copie su texto con `$.ui.copy({ text, surface: press.surface })` y muestre un toast que diga si `isCopied` fue true. Comprueba cada API con los tipos de plugin-authoring y añade un test con `claude-code/testing` que compruebe que una pulsación en una cabecera oculta sus filas.

### Qué revisar en la respuesta de Claude

1. `session.start` llama a `$.ui.open` con el id y el título del panel, y captura un rechazo, así que un panel que tiene otro plugin no rompe el inicio de la sesión.
2. El hook `ui.render` está filtrado por `{ component: 'Pane', requestId }` con el id propio del panel, y obtiene sus elementos de `$.ui.resolve(e)`.
3. El punto de cada sección sale de una pequeña función que comprueba primero el caso más urgente. Se calcula a partir del contenido en cada dibujo, no se guarda junto a los datos.
4. Una pulsación en una cabecera cambia un átomo con `update`, y el panel se vuelve a dibujar sin ninguna llamada extra, porque el dibujo lee ese átomo.
5. Una pulsación en una fila llama a `$.ui.copy` con `press.surface`, y el toast informa de los dos casos: `isCopied` verdadero o falso.

Si una comprobación falla, dile a Claude lo que ves: "pulso la cabecera de una sección y sus filas siguen en pantalla".

### Cómo lo pidió el autor

La petición original del panel no quedó registrada. Dos registros de tareas públicos de narsil-check citan las palabras de quien creó Narsil Check sobre partes de él.

#### Registrado: copiar, y una sección plegable

`odd/tasks/vulnerabilities.md` registra, en su entrada de registro L1 (2026-11-05), los dos mensajes que dieron origen a la sección de vulnerabilidades. S1 cita el primero:

> "podemos checkear vulnerabilidades de la misma forma? es decir crear un sub menu de vulnerabilidades que haga pnpm audit o similar?"

El registro de tareas recoge después la propuesta que quien creó Narsil Check aceptó con "si": entre otras cosas, "a collapsible section "▾ Vulnerabilidades · N" under Actualizaciones, its dot red for critical or high, yellow for moderate, green for none" (una sección plegable "▾ Vulnerabilidades · N" debajo de Actualizaciones, con su punto rojo para crítica o alta, amarillo para moderada, verde para ninguna). Ese diseño es la propuesta del agente, escrita en el registro de tareas; las palabras de quien creó Narsil Check son la pregunta y el "si".

S2 cita el segundo mensaje:

> "solo agregar que me gustaria la opcion de copiar las vulnerabilidades por criticidad al porta papeles, como esta en el upgrade"

#### Registrado: cuándo debe abrirse el panel

`odd/tasks/ecosystems-wave-2.md` (su registro empieza el 2026-11-04) enumera en S3 el comportamiento que debía mantenerse, incluida una regla anterior citada con las palabras de quien creó Narsil Check:

> "el panel solo deberia abrirse automaticamente cuando haya versiones por actualizar, ya de resto que deba abrirse con /upgrades"

Esa regla no duró. `/upgrades` pasó a ser `/narsil-check upgrade` en `684837f`, y desde `be8eac0` el panel se abre en cada sesión, porque asumió la función de la barra de sesión de la app (ver más abajo).

#### Reconstrucción a partir del historial de commits

A partir de `git log -- hooks/register.tsx hooks/words.ts` en narsil-check:

- `1bf736a` (2026-11-04) "feat: add upgrade panel for npm and Expo projects" (añadir un panel de actualizaciones para proyectos npm y Expo). El panel empieza como una lista de actualizaciones.
- `684837f` (2026-11-04) "feat!: rename to narsil-check, with /narsil-check upgrade and Narsil's look" (renombrar a narsil-check, con /narsil-check upgrade y el aspecto de Narsil). Su mensaje: el panel usa la paleta y las cabeceras de Narsil ("a colored dot and a bold name", un punto de color y un nombre en negrita), y la sección de actualizaciones se pliega desde su cabecera.
- `912478b` (2026-11-04) "feat: check known vulnerabilities with OSV.dev in a collapsible section" (comprobar vulnerabilidades conocidas con OSV.dev en una sección plegable).
- `be8eac0` (2026-11-05) "feat: show the session bar's environment, connectors and Remote Control in the pane" (mostrar en el panel el entorno, los conectores y Remote Control de la barra de sesión). Su mensaje: "The pane opens on every session" (el panel se abre en cada sesión).
- `c07f5e9` (2026-11-05) "feat: Entorno starts open, other sections fold until they have something" (Entorno empieza abierta, las demás secciones se pliegan hasta que tienen algo). Los pliegues iniciales fijos.
- `b3ad055` (2026-11-06) "feat: fold upgrade and vulnerability groups, copy a row on click, show baby Narsil and pull the branch" (plegar los grupos de actualizaciones y vulnerabilidades, copiar una fila con un clic, mostrar a la Narsil bebé y hacer pull de la rama). Su mensaje: cada grupo "folds on its own header and stays as left" (se pliega desde su propia cabecera y se queda como se dejó), y "A press on a library or an advisory copies it, replacing the per-group copy buttons" (una pulsación en una biblioteca o un aviso lo copia, en lugar de los botones de copia por grupo).
- `d5b08c3` (2026-11-06) "feat: center the pane's title and baby Narsil" (centrar el título del panel y a la Narsil bebé).
- `6291eaf` (2026-11-06) "feat: give the pane a health bar, state-colored panels and tinted group heads" (dar al panel una barra de salud, paneles coloreados por estado y cabeceras de grupo teñidas).

El patrón: primero una lista de actualizaciones, después el aspecto de Narsil, después una sección por comprobación, cada vez con la misma cabecera (punto, flecha, nombre, recuento), y la copia pasando de un botón por grupo a un clic en la propia fila.

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Esta es una versión reducida de la idea, escrita para esta guía y comprobada con los tipos de Claude Code 2.1.325. Está adaptada de `hooks/register.tsx` y `hooks/words.ts` en [narsil-check](https://github.com/davshn/narsil-check) (GPL-3.0-or-later); los colores son su `PALETTE`, y las filas son sintéticas.

El tipo del estado, en `types/index.d.ts`:

```ts
declare module 'claude-code' {
  interface PluginState {
    'my-panel': { closed: string[] }
  }
}
export {}
```

El módulo de hooks, `hooks/register.tsx`:

```tsx
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const PANE = 'my-panel'
const COLOR = { error: '#F0435A', waiting: '#F5B400', done: '#22B573', info: '#3B8BFF' } as const

const SECTIONS = [
  {
    key: 'checks',
    title: 'Checks',
    color: COLOR.waiting,
    rows: ['lint · 2 warnings', 'build · ok'],
  },
  { key: 'notes', title: 'Notes', color: COLOR.info, rows: ['Release acme/shop on Friday'] },
]

const closed = atom({ plugin: 'my-panel', key: 'closed' } as const, [] as string[])

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.ui.open({ id: PANE, title: 'My panel' }).catch(() => undefined)
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const shut = new Set(await read($, closed))
    const toggle = (key: string) =>
      update($, closed, (keys) =>
        keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key],
      )
    const copy = async (text: string, surface: Parameters<typeof $.ui.copy>[0]['surface']) => {
      const copied = await $.ui.copy({ text, surface })
      $.ui.toast(copied.isCopied ? 'Copied.' : `Could not copy: ${copied.reason}`)
    }

    return (
      <Box flexDirection="column">
        {SECTIONS.map((s) => (
          <Box
            key={s.key}
            flexDirection="column"
            borderStyle="round"
            borderColor={s.color}
            paddingX={1}
            marginTop={1}
          >
            <Box flexDirection="row" gap={1}>
              <Text bold color={s.color}>
                ●
              </Text>
              <Button
                key={`section-${s.key}`}
                plain
                label={`${shut.has(s.key) ? '▸' : '▾'} ${s.title}`}
                onPress={() => toggle(s.key)}
              />
            </Box>
            {!shut.has(s.key) &&
              s.rows.map((row, i) => (
                <Button
                  key={`row-${s.key}-${i}`}
                  plain
                  label={row}
                  onPress={(press) => copy(row, press.surface)}
                />
              ))}
          </Box>
        ))}
      </Box>
    )
  })
}
```

Tres detalles sostienen el diseño. El panel se abre una vez y lo dibuja un hook filtrado por su propio `requestId`, así que nunca dibuja el panel de otro plugin. El pliegue vive en un atom que lee el hook de dibujo, así que una pulsación solo tiene que hacer `update` sobre él. Y la copia toma la `surface` de la pulsación, así que el texto llega adonde la persona hizo clic.

## Errores comunes y cómo probarlo

Estos salen del código y los commits de Narsil Check:

- **Suponer que el panel está dibujado porque `open` se resolvió.** En un terminal estrecho, una apertura no pedida resuelve `{ isPlaced: false, reason }` y espera. Si algo depende de que el panel sea visible, lee `isPlaced`; una orden que escribe la persona lo abre con cualquier ancho.
- **Dejar que una apertura rechazada rompa el inicio.** Otro plugin puede tener el id y la llamada se rechaza. Narsil Check termina la llamada con `.catch(() => undefined)`.
- **Copiar a la superficie equivocada.** Omitir `surface` copia a la primera superficie de la sesión. Pasa `press.surface` desde el botón.
- **Fiarse a ciegas de `isCopied` en un terminal.** Los tipos señalan que OSC 52 no informa de vuelta: un terminal que lo descarta, sin herramienta de portapapeles en la máquina, sigue leyendo true.
- **Guardar un valor cuyos campos cambiaron bajo la misma etiqueta.** Cambia el `shape` del atom cuando cambie su tipo, como dice el comentario sobre los atoms de Narsil Check.
- **Esperar que un atom sobreviva a un reinicio.** Los tipos mantienen `$.state` durante la sesión y apuntan a `$.store` para la persistencia.
- **Dibujar tintes en el terminal.** Narsil Check tiñe las cabeceras de grupo solo cuando `e.surface !== 'terminal'`; el terminal conserva solo los bordes.

Para probarlo, `claude plugin test .` ejecuta los archivos `*.test.tsx` del mod. `tests/pane.test.tsx` en narsil-check es un buen modelo: responde a `ui.open` con `{ value: { isPlaced: true } }`, monta el panel con `$.ui.mount({ plugin, component: 'Pane', requestId, props, surface })`, pulsa cabeceras por clave (`ui.press({ key: 'section-upgrade' })`) y busca textos con `find`. Entre los tests que vale la pena copiar por su nombre están "the section is colored by what most needs you, and its toggle names it" (la sección se colorea según lo que más te necesita, y su interruptor la nombra), "baby Narsil stands under the title, light or dark as the app is; the terminal draws no picture" (la Narsil bebé está bajo el título, clara u oscura según la app; el terminal no dibuja ninguna imagen) y "each section is a panel bordered in the color of its state; the desktop tints group heads and counts, the terminal keeps borders alone" (cada sección es un panel con el borde del color de su estado; el escritorio tiñe las cabeceras de grupo y los recuentos, el terminal conserva solo los bordes).

## Para ir más lejos

El panel completo de narsil-check añade mucho alrededor del mismo marco:

- Una barra de salud bajo el título (`healthOf` y `healthSvg` en `hooks/words.ts`) que reparte el estado del proyecto en partes, una por color.
- La Narsil bebé dibujada como un único SVG que contiene una imagen clara y otra oscura, alternadas por una media query `prefers-color-scheme` dentro del SVG (`narsilSvg`), para que la imagen siga el tema de la app sin ninguna indicación del motor.
- Las secciones de sesión (las dos guías siguientes) y el pliegue de CI de tu pull request (la cuarta).
- **Actualizar rama** al final, un `git pull -r` que el propio mod ejecuta, y un aviso grande arriba cuando la rama va por detrás de su remoto.
- La orden `/narsil-check` con `upgrade`, `vulns` y `template "…"`, registrada en `session.start` con `$.command.register`.
