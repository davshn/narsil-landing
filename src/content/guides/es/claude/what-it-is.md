---
title: Qué es Narsil en Claude
description: 'La extensión de navegador que lleva a Narsil a claude.ai en Android: qué muestra, por qué es experimental, en qué navegadores funciona, sus opciones y cómo está hecha.'
route: claude
order: 1
updated: 2026-11-18
---

## Qué hace

Narsil en Claude es una extensión de navegador para Firefox y Vivaldi en Android. Lleva a Narsil a `claude.ai`, para que veas cómo van tus conversaciones sin salir de la página donde hablas con Claude. Añade cuatro cosas:

- **Una franja sobre la caja de texto**, en cada conversación de `claude.ai/code`: Narsil en la pose del estado de la conversación, el propio estado (`TRABAJANDO`, `TE NECESITA`, `TERMINADA` o `EN REPOSO`), el contexto usado, la cuenta atrás de la caché y lo último que dijo Claude. La [guía 2](/es/mods/claude/conversation-band/) la explica.
- **Un bloque en el menú lateral**, debajo de Buscar: el nivel y la experiencia de Narsil, los límites de uso de 5 horas y de la semana, y la cuenta de ntfy del día. La [guía 3](/es/mods/claude/sidebar/) lo explica.
- **Los colores de Narsil** en toda la página, claros de día y oscuros de noche, con la paleta de mar nocturno de [Narsil Skin](https://github.com/davshn/narsil-skin). La [guía 4](/es/mods/claude/colors-and-icon/) los explica.
- **El icono de Narsil**, cuando añades `claude.ai` a la pantalla de inicio con la extensión activa. También en la [guía 4](/es/mods/claude/colors-and-icon/).

La extensión funciona sobre la app web real de Claude. No se sustituye nada: sigues leyendo la conversación completa, aprobando permisos y respondiendo a las preguntas de Claude como siempre. La extensión solo añade lo que dibuja a su alrededor.

> **Experimental.** La extensión se apoya en la estructura de la página de `claude.ai` y en direcciones internas que usa la propia página, no en una API pública. Una actualización de Claude puede romperla en cualquier momento. Cuando eso pasa, la franja o el bloque simplemente dejan de mostrarse; no tapan nada. Solo lee: nunca escribe en tu cuenta ni envía tus conversaciones a ningún sitio, aunque la extensión carga los dibujos de Narsil desde GitHub y lee su tema de estado en ntfy.sh. Su código no es público, así que esta ruta explica cómo está hecha y da pequeños ejemplos propios.

La extensión forma parte de la familia de Narsil. El nivel y la cuenta de ntfy vienen de [Narsil para Claude Code](https://github.com/davshn/narsil-pet), el mod de tu ordenador; todo lo demás funciona sin él.

## Cómo funciona por dentro

### Por qué una extensión, y por qué en Android

Claude Code en tu ordenador ya muestra a Narsil en su banda y en su ventana flotante. Cuando manejas una conversación desde el móvil mediante Remote Control, estás en `claude.ai/code` en un navegador móvil, y Narsil queda fuera de tu vista. La app de Claude para Android no se puede ampliar, pero una página en un navegador sí: una extensión de navegador ejecuta sus propios scripts dentro de la página que abres.

Así que la extensión es la única forma de poner a Narsil en la misma pantalla que la conversación, y la razón de que solo admita dos navegadores móviles:

| Navegador                | Franja y bloque       | Colores    | Icono         |
| ------------------------ | --------------------- | ---------- | ------------- |
| Vivaldi para Android     | Sí                    | Sí         | Sin probar    |
| Firefox para Android     | Sí                    | Sí         | Sí            |
| Firefox en el escritorio | Sin probar            | Sin probar | No hace falta |
| Chrome para Android      | No admite extensiones | No         | No            |
| La app nativa de Claude  | No                    | No         | No            |

Necesita **Firefox 142 o posterior** o **Vivaldi 8.2 o posterior**. El mínimo de Firefox viene del manifiesto (`strict_min_version` con el valor `142.0`, tanto para Firefox como para Firefox para Android); el de Vivaldi, del README, que dice que Vivaldi en Android carga extensiones de Chrome desde una carpeta desde la versión 8.2.

### Las partes de la extensión

La extensión es JavaScript sin más, sin paso de compilación y sin bibliotecas. Su carpeta contiene:

- **`manifest.json`**, la descripción de la que parte toda extensión de navegador ([MDN: manifest.json](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json)). Es un archivo Manifest V2 para Firefox. Pide solo dos permisos: `storage`, para las opciones, y `https://ntfy.sh/*`, para leer el estado del mod. También declara `data_collection_permissions` como `none`, la forma que tiene Firefox de que una extensión diga que no recoge datos.
- **Dos grupos de scripts de contenido**, los dos para `https://claude.ai/*` ([MDN: content_scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_scripts)). El primero se ejecuta en `document_start`, antes de que la página se dibuje, con los colores (`skin.css`, `mode.js`) y el icono (`app-icon.js`). El segundo se ejecuta en `document_idle`, cuando la página ya cargó, con la franja y el bloque (`content.js` y `band.css`).
- **Un script de fondo**, `background.js`. Es la única parte que habla con ntfy.sh. En Firefox es una página de fondo; en el paquete Chromium para Vivaldi, un service worker carga los mismos archivos.
- **La página de opciones**, `options.html` y `options.js`, donde escribes tu tema y tu clave.
- **Pequeños módulos en `lib/`**, cada uno cargado donde hace falta: `live.js` (lo que la franja y los límites sacan de los datos de `claude.ai`), `state.js` (lo que se guarda y se muestra del estado del mod), `seal.js` (abrir mensajes sellados), `stream.js` (seguir el flujo de ntfy.sh), `watch.js` (el único observador de la página), `mode.js` (qué modo toca a cada hora), `manifest.js` (el icono de la pantalla de inicio), `restore.js` (volver a poner estilos y scripts en Vivaldi) y `browser.js` (permite que el código diga `browser` también en Chromium).

La división sigue una regla: **la página no ve nada secreto**. Los scripts de contenido se ejecutan dentro de `claude.ai` y dibujan; el script de fondo guarda el tema y la clave, lee ntfy.sh y envía a la página solo el estado que ya abrió. El código lo dice claramente: el tema y la clave "never reach the page" (nunca llegan a la página).

### Las opciones: tu tema y tu clave

La página de opciones tiene dos campos y un botón de guardar:

- **Tema**, el que te da `/narsil movil` en Claude Code ([Avisos en el móvil y el reloj](/es/mods/pet/phone-and-watch/) explica cómo lo crea el mod). La página acepta solo letras, números, `-` y `_`, hasta 64 caracteres, y rechaza cualquier otra cosa.
- **Clave**, solo si creaste una con `/narsil movil clave`. Es un campo de contraseña.

Los dos se guardan con `storage.local` ([MDN: storage.local](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/local)), el almacenamiento propio de la extensión en el móvil. Nunca entran en el paquete que se firma, ni en la página. Cuando cambia cualquiera de los dos, el script de fondo lo nota (`storage.onChanged`) y vuelve a leer con los valores nuevos.

Si el bloque del menú lateral muestra `Toca y escribe tu topic` o `🔒 Toca y pon la clave`, un toque sobre él abre la página de opciones.

### Lo que necesita del mod, y lo que funciona sin él

| Parte                               | ¿Necesita narsil-pet? | De dónde viene                         |
| ----------------------------------- | --------------------- | -------------------------------------- |
| La franja sobre la caja de texto    | No                    | El propio `claude.ai`                  |
| Los límites de 5 horas y semanal    | No                    | El propio `claude.ai`                  |
| Los colores y el icono              | No                    | La extensión                           |
| El nivel y la experiencia de Narsil | Sí                    | El tema de estado del mod en ntfy.sh   |
| La cuenta de ntfy del día           | Sí                    | El tema de estado del mod en ntfy.sh   |
| La etapa de Narsil en los dibujos   | Sí                    | El dibujo que nombra el estado del mod |

Para las filas que necesitan el mod, `/narsil movil` tiene que estar activado. Sin él, el bloque del menú lateral muestra solo los límites, y la franja muestra el icono propio de la extensión donde iría el dibujo de Narsil en su etapa.

### Lo que pasa por la red

La extensión solo lee. Cada petición que hace, según su código:

- **A `claude.ai`**, con tu sesión, como hace la propia página: la lista de tus conversaciones activas y en pausa, los últimos eventos de la que tienes abierta y el uso de tu cuenta. Solo peticiones `GET`. No se escribe nada en tu cuenta.
- **A ntfy.sh**, desde el script de fondo: lee el tema de estado del mod (tu tema con `-estado` al final). Leer un tema requiere su nombre en la dirección, así que ntfy.sh ve el tema y la red de tu móvil. No se publica nada.
- **A GitHub**, para los dibujos de Narsil: la franja y el bloque muestran su arte desde el repositorio narsil-pet, así que el móvil descarga esas imágenes. El nombre del archivo dice su pose y su etapa, como la pose de trabajando o la de esperando.
- **El icono de la pantalla de inicio** apunta a los iconos de la app web del móvil de quien creó Narsil, que el navegador descarga solo cuando añades `claude.ai` a la pantalla de inicio.

Ninguna de estas peticiones envía lo que muestra la página (tus conversaciones, tu uso, tu tema o tu clave) a ningún otro sitio.

### Instalarla

El código no es público, así que estos son los pasos que sigue quien creó Narsil, y los que sirven para una extensión que construyas tú. La [guía 5](/es/mods/claude/android-packaging/) explica el empaquetado en detalle.

**En Vivaldi**, la extensión se carga desde una carpeta del móvil, sin firma:

1. Construye el paquete Chromium (Manifest V3) a partir de la extensión de Firefox y cópialo a la carpeta `Download` del móvil por USB.
2. En Vivaldi, abre `vivaldi://extensions` y activa el **Modo de desarrollador**.
3. Toca **Cargar descomprimida**, elige la carpeta y después **Usar esta carpeta** y **Permitir**.
4. Abre las opciones de la extensión y escribe tu tema, y la clave si tienes una.
5. Abre `claude.ai` y recárgala.

**En Firefox**, una extensión tiene que estar firmada por Mozilla. La firma es _unlisted_ (no listada): no publica la extensión en la tienda de complementos.

1. Crea credenciales de API en [addons.mozilla.org](https://addons.mozilla.org/developers/addon/api/key/) y firma la extensión con `web-ext sign --channel=unlisted` de Mozilla ([Extension Workshop: web-ext command reference](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#web-ext-sign)). El resultado es un archivo `.xpi`.
2. Copia el `.xpi` al móvil.
3. En Firefox, abre **Configuración → Acerca de Firefox** y toca el logo cinco veces para mostrar el menú oculto.
4. De vuelta en **Configuración**, usa la opción de instalar una extensión desde un archivo.
5. Abre la configuración de la extensión y escribe tu tema, y la clave si tienes una.

### Desinstalarla

En Firefox, abre el menú, ve a **Extensiones**, elige **Narsil en Claude** y quítala. En Vivaldi, quítala desde `vivaldi://extensions`. Claude vuelve a sus propios colores. El icono de la pantalla de inicio se queda hasta que vuelvas a instalar la app, porque el navegador lo fija en el momento de instalarla.

Para detener el nivel y la cuenta sin quitar nada, borra el tema en las opciones. Para que el mod deje de enviar el estado por completo, ejecuta `/narsil movil off` en tu ordenador.

## Constrúyelo con Claude

Pídele a Claude el esqueleto de una extensión de Firefox para `claude.ai`: un manifiesto, un script de contenido, un script de fondo y una página de opciones. La idea que debe acertar es que la página no ve nada secreto: solo el script de fondo guarda el tema y habla con ntfy.sh.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil.

> Construye una extensión de Firefox (Manifest V2, JavaScript sin más, sin paso de compilación) para Firefox para Android que añada una pequeña franja de estado a `https://claude.ai/*`. Usa dos grupos de scripts de contenido: uno en `document_start` para los estilos y otro en `document_idle` que dibuje la franja. Añade una página de opciones (`options_ui`) con un campo "topic", validado como `[-_A-Za-z0-9]{1,64}`, guardado con `browser.storage.local`. Solo el script de fondo puede leer el tema y hablar con `https://ntfy.sh`; el script de contenido recibe el estado por `runtime.connect` y nunca ve el tema. No pidas ningún permiso aparte de `storage` y `https://ntfy.sh/*`. Inserta cada texto con `textContent`, nunca como HTML. Usa solo APIs documentadas en MDN, y lista cada una que hayas usado con su página de MDN.

### Qué revisar en la respuesta de Claude

1. El manifiesto pide solo dos permisos, `storage` y `https://ntfy.sh/*`, y declara `data_collection_permissions` como `none`.
2. Los scripts de contenido coinciden con `https://claude.ai/*`, con los estilos en `document_start` y la franja en `document_idle`.
3. Solo el script de fondo lee el tema y habla con ntfy.sh. El script de contenido recibe el estado por `runtime.connect` y nunca ve el tema.
4. La página de opciones acepta solo letras, números, `-` y `_`, hasta 64 caracteres, y guarda el tema con `storage.local`, nunca en el código de la extensión.
5. Cada texto entra con `textContent`, nunca como HTML, y cada API que usó Claude viene con su página de MDN.

Si una comprobación falla, dile a Claude lo que ves: "el script de contenido lee el tema de `storage.local` y le pregunta a ntfy.sh por su cuenta".

### Cómo lo pidió el autor

#### Registrado: sobre esta ruta, no sobre la extensión

Las peticiones a la IA de la propia extensión no quedaron registradas. Lo que sí quedó registrado es cómo pidió quien creó Narsil que apareciera en este sitio. En la fase 2 del registro de tareas del sitio:

> "tambien quiero agregar la informacion de narsil-claude ponla como experimental, aunque he hecho muchas pruebas y fujnciona bastante bien"

Y para esta ruta, el 2026-11-18:

> "hay otra cosa, no metimos la guia de narsul claude en celular, pusimos que era experimental pero que explicariamos como hacerlo, falta esa guia, el repositorio es narsil-claude"

Quien creó Narsil pidió una "Ruta corta", que es esta.

#### Reconstrucción a partir del historial de commits

El resto se reconstruye a partir del historial de commits de la extensión; las peticiones en sí no se guardaron. El primer día construyó la mayor parte:

- `c200e8a` (2026-11-09) "feat: show Narsil's state in claude.ai's sidebar on Firefox for Android" (mostrar el estado de Narsil en el menú lateral de claude.ai en Firefox para Android). Su mensaje explica el objetivo: "so the state is on the same screen as Claude" (para que el estado esté en la misma pantalla que Claude), leyendo ntfy.sh desde la página de fondo, con el tema y la clave en el almacenamiento de la extensión.
- `0d65509` (2026-11-09) "feat: wear Narsil's colors on claude.ai, light by day and dark by night" (vestir claude.ai con los colores de Narsil, claros de día y oscuros de noche).
- `40be528` (2026-11-09) "build: sign the extension as unlisted with Mozilla" (firmar la extensión como no listada con Mozilla).
- `083c03d` (2026-11-09) "feat: give claude.ai Narsil's icon when it is installed from Firefox" (darle a claude.ai el icono de Narsil cuando se instala desde Firefox).
- `19677ac` (2026-11-09) "feat: show each conversation's state, context and cache above the prompt" (mostrar el estado, el contexto y la caché de cada conversación sobre la caja de texto).
- `00adbb9` (2026-11-09) "feat: show only Narsil's level, the limits and ntfy's count in the sidebar" (mostrar solo el nivel de Narsil, los límites y la cuenta de ntfy en el menú lateral).
- `11dadb3` (2026-11-10) "feat: run the extension in Vivaldi for Android as a Chromium package" (ejecutar la extensión en Vivaldi para Android como paquete Chromium).

El orden muestra un diseño que se fue acotando: empezó como un panel en el menú lateral alimentado por ntfy.sh y terminó dividido en dos, con ntfy.sh usado solo para lo que la página no puede saber.

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Un esqueleto con la misma forma, escrito para esta guía (MIT). Es una extensión Manifest V2 para Firefox con un script de contenido, un script de fondo y una página de opciones; las [guías 2](/es/mods/claude/conversation-band/) y [3](/es/mods/claude/sidebar/) los completan.

`manifest.json`:

```json
{
  "manifest_version": 2,
  "name": "My band on claude.ai",
  "version": "0.1.0",
  "browser_specific_settings": {
    "gecko": {
      "id": "my-band@example.com",
      "strict_min_version": "142.0",
      "data_collection_permissions": { "required": ["none"] }
    }
  },
  "permissions": ["storage", "https://ntfy.sh/*"],
  "background": { "scripts": ["background.js"] },
  "content_scripts": [
    {
      "matches": ["https://claude.ai/*"],
      "js": ["band.js"],
      "css": ["band.css"],
      "run_at": "document_idle"
    }
  ],
  "options_ui": { "page": "options.html", "open_in_tab": true }
}
```

`options.html` contiene un formulario con un campo `topic`, un botón de envío y un párrafo `status`, y carga `options.js`:

```js
const form = document.getElementById('form')
const input = document.getElementById('topic')
const status = document.getElementById('status')

browser.storage.local.get('topic').then(({ topic }) => {
  input.value = topic ?? ''
})

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const topic = input.value.trim()
  if (!/^[-_A-Za-z0-9]{1,64}$/.test(topic)) {
    status.textContent = 'Only letters, numbers, - and _.'
    return
  }
  await browser.storage.local.set({ topic })
  status.textContent = 'Saved.'
})
```

Pruébalo con un tema inventado como `narsil-0123456789abcdef0123`. Las APIs están en MDN: [`storage.local`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/local), [`options_ui`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/options_ui) y [`browser_specific_settings`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings).

## Errores comunes y cómo probarlo

- **Esperarla en la app de Claude.** La app nativa no admite extensiones, y Chrome para Android tampoco. Usa Firefox o Vivaldi, con `claude.ai` en el navegador.
- **Una extensión sin firmar en Firefox.** La versión estable de Firefox solo instala extensiones firmadas. Cada firma nueva necesita además una `version` nueva en el manifiesto.
- **El tema dentro del paquete.** No lo escribas nunca en el código: el paquete va a Mozilla para que lo firme. Guárdalo en `storage.local`.
- **Un tema con espacios o una barra.** La página de opciones lo rechaza. Copia el tema exactamente como lo mostró `/narsil movil`.
- **Nada después de instalarla.** Recarga `claude.ai`, como dice el último paso de la instalación, para que la página cargue con los scripts de la extensión.
- **Una franja y ningún nivel.** El nivel necesita el mod en tu ordenador con `/narsil movil` activado, y se actualiza cuando el mod envía un estado (guía 3).

Para probar el esqueleto primero en un escritorio, cárgalo como complemento temporal en `about:debugging` ([Extension Workshop: test and debug](https://extensionworkshop.com/documentation/develop/debugging/)), abre las opciones desde `about:addons`, guarda un tema inventado y vuelve a leerlo con `browser.storage.local.get('topic')` en la consola de la extensión. Para un móvil, `web-ext run --target=firefox-android` la ejecuta en un dispositivo conectado por USB ([web-ext run](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#web-ext-run)).

## Para ir más lejos

- Lee la [guía 2](/es/mods/claude/conversation-band/) para la franja, que no necesita nada del ordenador.
- Lee [Contexto y límites](/es/mods/pet/context-and-limits/) y [El reloj de la caché](/es/mods/pet/cache-clock/) para ver cómo muestra Narsil los mismos números dentro de Claude Code.
- [Narsil Skin](https://github.com/davshn/narsil-skin) es el tema de colores público del que salen los colores de la extensión.
