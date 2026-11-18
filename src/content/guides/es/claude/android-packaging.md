---
title: Un código fuente, dos paquetes para Android
description: 'Cómo Narsil en Claude sale de un código fuente en dos paquetes: un .xpi firmado no listado para Firefox para Android, y una carpeta Manifest V3 para Vivaldi que repone sus estilos al recargarse.'
route: claude
order: 5
updated: 2026-11-18
---

## Qué hace

Narsil en Claude se escribe una sola vez, en una carpeta, y llega al móvil en dos formas:

| Navegador            | Paquete                                       | Cómo llega al móvil                                                 |
| -------------------- | --------------------------------------------- | ------------------------------------------------------------------- |
| Firefox para Android | La carpeta tal cual, Manifest V2              | Firmado por Mozilla como `.xpi` no listado, instalado desde archivo |
| Vivaldi para Android | Una copia con un Manifest V3 derivado de ella | Copiada al móvil por USB, cargada descomprimida, sin firma          |

Necesita **Firefox 142 o posterior** o **Vivaldi 8.2 o posterior**, como dice el README. Chrome para Android no admite extensiones, así que Vivaldi es el navegador Chromium que la ejecuta.

El paquete de Vivaldi también hace algo que el de Firefox no necesita: cuando Vivaldi recarga la extensión, o Android cierra Vivaldi y este se vuelve a abrir, la página puede perder los estilos o los scripts de la extensión. El paquete Chromium lo nota, y los vuelve a poner sin recargar la página.

> **Experimental.** La extensión se apoya en la estructura de la página de `claude.ai`, no en una API pública, así que una actualización de Claude puede romperla. Cargar una extensión descomprimida en Vivaldi en Android es una función para desarrolladores, y los navegadores pueden cambiar cómo funciona. La extensión solo lee `claude.ai`: nunca escribe en tu cuenta ni envía tus conversaciones a ningún sitio, aunque carga los dibujos de Narsil desde GitHub y lee su tema de estado en ntfy.sh. Firmar para Firefox requiere credenciales de API propias en addons.mozilla.org; esta guía solo muestra marcadores para ellas.

## Cómo funciona por dentro

### El código fuente: una extensión de Firefox

La carpeta `extension/` es una extensión de Firefox completa: JavaScript sin más, sin paso de compilación, sin bibliotecas. Su `manifest.json` es **Manifest V2**, con una página de fondo (`"persistent": true`) que carga `background.js` y sus módulos ([MDN: background](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background)).

Firefox lee una clave que ningún otro navegador necesita, `browser_specific_settings` ([MDN: browser_specific_settings](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings)):

- **`gecko.id`**, el id de la extensión, con forma de dirección de correo. Cada nueva versión firmada conserva el mismo id, así que Firefox la trata como la misma extensión.
- **`gecko.strict_min_version`** y **`gecko_android.strict_min_version`**, los dos `142.0`. Un Firefox más antiguo no instala la extensión. La primera versión pedía la 121; el commit `40be528` subió las dos a 142 cuando añadió la siguiente clave. Su mensaje no dice por qué.
- **`gecko.data_collection_permissions`**, con `required` en `none`: la extensión declara que no recoge ni transmite datos. MDN dice que esta clave es obligatoria para las extensiones nuevas enviadas a addons.mozilla.org desde el 3 de noviembre de 2025.

### Firefox: firmar como no listada

Firefox para Android instala solo extensiones firmadas por Mozilla. Firmar no significa publicar: el canal **unlisted** (no listado) firma la extensión "for self-distribution" (para distribución propia), en palabras de la referencia de `web-ext`, y nunca aparece en la tienda de complementos ([Extension Workshop: web-ext sign](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#web-ext-sign)).

La firma la hace la propia herramienta `web-ext` de Mozilla, ejecutada como `web-ext sign --channel=unlisted`. Dos archivos le dicen qué hacer:

- **`web-ext-config.mjs`**, en la raíz, que `web-ext` encuentra por sí sola ([Extension Workshop: getting started with web-ext](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/)). Fija dos opciones: la carpeta de origen es `./extension` y la carpeta de artefactos es `./dist`. Así que solo se empaqueta la carpeta de la extensión, nunca las pruebas ni los scripts, y el `.xpi` firmado termina en `dist/`, que git ignora.
- **`scripts/sign.ps1`**, que ejecuta `npm run sign`. El commit `40be528` (2026-11-09) "build: sign the extension as unlisted with Mozilla" (firmar la extensión como no listada con Mozilla) explica su propósito: "asks for the API credentials and keeps them only in its own process" (pide las credenciales de API y las guarda solo en su propio proceso).

Las credenciales son el **JWT issuer** (emisor JWT) y el **JWT secret** (secreto JWT) que generas en [addons.mozilla.org](https://addons.mozilla.org/developers/addon/api/key/). `web-ext` los lee de `--api-key` y `--api-secret`, o de las variables de entorno `WEB_EXT_API_KEY` y `WEB_EXT_API_SECRET`. El script pide los dos al ejecutarse, el secreto como entrada oculta, los pone en esas dos variables solo para su propio proceso, ejecuta `web-ext` y los quita al terminar, aunque la firma falle. Nunca van a un archivo, al historial de la shell ni al repositorio.

Mozilla firma cada versión una sola vez, así que cada firma nueva necesita un `version` nuevo en `manifest.json`.

### Firefox: instalar el archivo firmado

El `.xpi` es un zip firmado de la carpeta de la extensión. Para instalarlo, cópialo al móvil y usa el menú oculto de Firefox: **Configuración → Acerca de Firefox**, toca el logo cinco veces, vuelve a **Configuración** y usa la opción de instalar una extensión desde un archivo. La [guía 1](/es/mods/claude/what-it-is/) enumera los pasos.

Mientras desarrollas hay un camino más rápido que no necesita firma: `npm run phone` ejecuta `web-ext run --target=firefox-android` con el móvil conectado por USB. Firefox carga la carpeta como una extensión temporal y la recarga con cada cambio, mientras el comando siga en marcha ([Extension Workshop: web-ext run](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#web-ext-run)). `npm run lint` ejecuta `web-ext lint`, que revisa el manifiesto y el código en busca de problemas antes de firmar.

### Vivaldi: el paquete Chromium

Vivaldi es un navegador Chromium, y desde la versión 8.2 su versión para Android carga extensiones de Chrome desde una carpeta del móvil, sin tienda y sin firma. El commit `11dadb3` (2026-11-10) "feat: run the extension in Vivaldi for Android as a Chromium package" (ejecutar la extensión en Vivaldi para Android como paquete Chromium) añadió el segundo paquete.

No es una segunda copia del código. `scripts/chromium.mjs` copia `extension/` a `dist/chromium` y escribe dos archivos en la copia:

1. **Un `manifest.json` Manifest V3**, derivado del de Firefox.
2. **`background-worker.js`**, un service worker de una línea que carga, con `importScripts()`, los mismos scripts de fondo que carga la página de fondo de Firefox.

El manifiesto derivado cambia lo que exige Manifest V3 ([Chrome: migrate to Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate)):

| Firefox, Manifest V2                                      | Vivaldi, Manifest V3                                                                  |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `manifest_version: 2`                                     | `manifest_version: 3`                                                                 |
| `browser_specific_settings`                               | Eliminada: es propia de Firefox                                                       |
| Una página de fondo con `scripts`                         | `background.service_worker`, el worker de una línea                                   |
| Direcciones dentro de `permissions` (`https://ntfy.sh/*`) | Movidas a `host_permissions`, con `https://claude.ai/*` añadida                       |
| `storage`                                                 | `storage` y `scripting`                                                               |
| `web_accessible_resources` como lista de archivos         | Una lista de objetos, cada uno con sus `resources` y las páginas que pueden cargarlos |
| Los scripts de contenido tal cual                         | Los mismos, con `lib/browser.js` cargado primero en cada grupo                        |

Todo lo demás, los scripts de contenido, la página de opciones, los iconos, pasa sin cambios.

### Un código para dos APIs

Firefox llama a la API de extensiones `browser`; Chromium la llama `chrome`. En Manifest V3 las dos responden con promesas, así que el código solo necesita un nombre. `lib/browser.js`, que existe solo para cargarse primero en el paquete Chromium, hace que `browser` sea `chrome`. El resto del código dice `browser` en todas partes.

El script de fondo necesitó un cambio real. Un service worker no tiene `EventSource`, así que el script de fondo sigue el flujo de ntfy.sh con `fetch` y un lector de flujo en su lugar, en los dos navegadores. Y Chromium detiene un service worker inactivo tras 30 segundos ([Chrome: the extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)), así que el bloque del menú lateral le envía una palabra cada 25 segundos mientras se muestra. La [guía 3](/es/mods/claude/sidebar/) cubre las dos cosas.

### Vivaldi: cargarla desde `Download/narsil-chromium`

`npm run phone:chromium` construye el paquete y, con `--push`, lo copia al móvil con `adb` de Android: borra `Download/narsil-chromium` en el móvil y sube ahí la carpeta nueva. Con más de un dispositivo conectado, la variable de entorno `ANDROID_SERIAL` elige uno. El móvil necesita tener activada la depuración por USB.

Después, en Vivaldi:

1. Abre `vivaldi://extensions` y activa el **Modo de desarrollador**.
2. Toca **Cargar descomprimida**, ve a **Download → narsil-chromium**, toca **Usar esta carpeta** y después **Permitir**.
3. Abre las opciones de la extensión y escribe tu tema, y la clave si tienes una.
4. Abre `claude.ai` y recárgala.

La carpeta se queda en el móvil: Vivaldi carga la extensión desde ella cada vez.

### Cuando Vivaldi recarga la extensión

Aquí es donde más se diferencian los dos navegadores. Cuando la extensión desaparece con `claude.ai` abierta, porque Vivaldi la recarga o la actualiza o Android la descarga, Chromium quita sus estilos de la página y nunca vuelve a poner sus scripts. Mientras tanto, el script de contenido viejo seguía en la página, sin su extensión, colocando la franja sin sus estilos. Firefox vuelve a poner todo por sí solo.

Tres arreglos, a lo largo de una semana, hacen que el paquete Chromium se recomponga por sí mismo.

**1. Los scripts viejos se detienen** (`1d9db3d`, 2026-11-11, y `6b24ccb`, 2026-11-17). El observador de la página que comparten todos los scripts de contenido, en `lib/watch.js`, comprueba en cada ejecución si su extensión todavía existe: una vez que ha desaparecido, `browser.runtime.id` está vacío o lanza un error. Entonces el observador se detiene, y cada script que lo usaba se detiene con él: temporizadores borrados, franja quitada. Una copia más nueva de los scripts también detiene a la vieja, disparando un evento en el documento de la página, lo único que comparten dos copias. `1d9db3d` también carga `lib/watch.js` en los dos grupos de scripts de contenido, ya que Vivaldi a veces ejecutaba solo el segundo grupo, y la franja pedía un observador que todavía no existía.

**2. El script de fondo vuelve a poner los scripts** (`6b24ccb`). Cada vez que arranca el script de fondo, `lib/restore.js` pregunta a cada pestaña abierta de `claude.ai` si sus scripts todavía responden. El script de contenido responde a un mensaje propio con `true`. Una pestaña que no responde recibe otra vez los grupos de scripts de contenido del manifiesto, en orden, cada hoja de estilos con `scripting.insertCSS` y cada grupo de scripts con `scripting.executeScript` ([Chrome: chrome.scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting)). Eso necesita el permiso `scripting` y acceso de host a las páginas, por eso el manifiesto Chromium añade los dos. Una pestaña a la que no puede llegar, descartada o todavía cargando, los recibe de todos modos en su próxima carga.

**3. La página pide lo que le falta** (`a1e01b6` y `8e31a1d`, 2026-11-18). Después de que Android cierre Vivaldi y este se vuelva a abrir, Vivaldi puede ejecutar los scripts de contenido sin las hojas de estilos, o saltarse todo el primer grupo. Los scripts que se ejecutaron siguen respondiendo, así que el paso 2 se salta la pestaña. Por eso la página se revisa a sí misma: cada hoja de estilos fija una marca en `:root`, y la franja comprueba las marcas y si el primer grupo dejó su función de modo en la página (la [guía 4](/es/mods/claude/colors-and-icon/) describe las dos cosas). Lo que falta, se lo pide al script de fondo. El script de fondo acepta solo hojas de estilos y números de grupo de su propio manifiesto, nunca un archivo cualquiera, y los inserta solo en esa pestaña y ese marco.

En Firefox nada de esto se ejecuta: su manifiesto no pide el permiso `scripting`, así que `browser.scripting` no existe ahí, y el código de restauración termina enseguida.

### Actualizar y desinstalar

**En Firefox**, cambia `version` en `manifest.json`, vuelve a firmar e instala el nuevo `.xpi` de la misma forma. El manifiesto no declara ninguna dirección de actualización, así que Firefox no busca versiones nuevas por sí solo. **En Vivaldi**, vuelve a ejecutar `npm run phone:chromium` y toca **Actualizar** en `vivaldi://extensions`, como dice el README.

Para desinstalarla de Firefox, abre el menú, ve a **Extensiones**, elige **Narsil en Claude** y quítala. En Vivaldi, quítala desde `vivaldi://extensions`; después se puede borrar la carpeta `Download/narsil-chromium`. En los dos, el tema y la clave del almacenamiento de la extensión se van con ella, y Claude vuelve a sus propios colores. El icono de la pantalla de inicio se queda (la [guía 4](/es/mods/claude/colors-and-icon/) explica por qué).

Si ya no firmas nada, revoca las credenciales de API en la misma página de addons.mozilla.org donde las creaste.

## Constrúyelo con Claude

Pídele a Claude un script de Node que derive un paquete Manifest V3 para Vivaldi a partir de tu extensión de Firefox, y un paso de restauración en el script de fondo. La idea que debe acertar es que hay una sola fuente: el paquete Chromium es una copia con un manifiesto derivado, no una segunda versión del código.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil.

> Mi extensión de Firefox vive en `extension/` con un `manifest.json` Manifest V2. Escribe un script de Node, sin dependencias, que copie la carpeta a `dist/chromium` y escriba ahí un `manifest.json` Manifest V3: quita `browser_specific_settings`, mueve los patrones de URL de `permissions` a `host_permissions` y añádeles los `matches` de los scripts de contenido, añade el permiso `scripting`, convierte los scripts de fondo en un service worker de una línea que llame a `importScripts()` con ellos, pon primero en cada grupo de scripts de contenido un archivo que haga `self.browser = self.chrome`, y convierte `web_accessible_resources` a la forma de objetos de V3. Exporta la conversión del manifiesto como una función y pruébala con `node --test`. Después, en el script de fondo, al arrancar, envía a cada pestaña que coincida un ping con `tabs.sendMessage`; donde nada responda, vuelve a insertar el CSS y el JS de los scripts de contenido del manifiesto con `scripting.insertCSS` y `scripting.executeScript`. Usa solo APIs documentadas en MDN y developer.chrome.com.

### Qué revisar en la respuesta de Claude

1. El manifiesto derivado quita `browser_specific_settings`, mueve los patrones de URL de `permissions` a `host_permissions`, les añade los `matches` de los scripts de contenido y añade `scripting`.
2. El script de fondo pasa a ser un service worker de una línea que carga los mismos scripts de fondo con `importScripts()`, y un archivo que hace `self.browser = self.chrome` va primero en cada grupo de scripts de contenido.
3. La restauración envía a cada pestaña que coincida un ping con `tabs.sendMessage` y vuelve a insertar el CSS y el JS solo donde nada responde, y solo archivos del propio manifiesto de la extensión.
4. La conversión del manifiesto se exporta como una función y se prueba con `node --test` sobre un pequeño objeto Manifest V2.
5. Si también le pides a Claude la firma, el canal es `unlisted`, y las credenciales de AMO se escriben al firmar, nunca en el repositorio ni en una línea de comandos.

Si una comprobación falla, dile a Claude lo que ves: "después de tocar Actualizar en Vivaldi, la franja vuelve sin sus colores".

### Cómo lo pidió el autor

No quedó registrada ninguna petición sobre el empaquetado. Las palabras de quien creó Narsil registradas para esta ruta tratan del sitio (la [guía 1](/es/mods/claude/what-it-is/) las cita). Lo siguiente se reconstruye a partir del historial de commits de la extensión:

- `40be528` (2026-11-09) "build: sign the extension as unlisted with Mozilla" (firmar la extensión como no listada con Mozilla). El mismo día que la primera versión, para que se pudiera instalar en Firefox para Android.
- `11dadb3` (2026-11-10) "feat: run the extension in Vivaldi for Android as a Chromium package" (ejecutar la extensión en Vivaldi para Android como paquete Chromium). Su mensaje describe el Manifest V3 derivado, el service worker que carga los mismos scripts de fondo, `lib/browser.js` y el paso de `EventSource` a `fetch`; y dice "The Firefox manifest stays V2" (el manifiesto de Firefox se queda en V2).
- `1d9db3d` (2026-11-11) "fix: load the page observer with the band and stop when the extension goes away" (cargar el observador de la página con la franja y detenerse cuando la extensión desaparece).
- `6b24ccb` (2026-11-17) "fix: restore the styles and the band when Vivaldi brings the extension back" (restaurar los estilos y la franja cuando Vivaldi trae de vuelta la extensión).
- `a1e01b6` (2026-11-18) "fix: ask for the styles when Vivaldi loads the band without them" (pedir los estilos cuando Vivaldi carga la franja sin ellos).
- `8e31a1d` (2026-11-18) "fix: run the light and dark switch again when Vivaldi skips it" (volver a ejecutar el cambio entre claro y oscuro cuando Vivaldi se lo salta).

El segundo navegador tardó un día en añadirse y una semana en asentarse: cada arreglo después de `11dadb3` responde a una forma en que Vivaldi en Android cargaba la extensión solo en parte, descubierta al usarla.

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Tres piezas, escritas para esta guía (MIT): la conversión, la restauración al arrancar y la firma.

`build-chromium.mjs`, que se ejecuta con `node build-chromium.mjs`:

```js
import fs from 'node:fs'

const source = JSON.parse(fs.readFileSync('extension/manifest.json', 'utf8'))
const isAddress = (permission) => permission.includes('://')
const pages = source.content_scripts.flatMap((group) => group.matches)

const target = {
  manifest_version: 3,
  name: source.name,
  version: source.version,
  icons: source.icons,
  options_ui: source.options_ui,
  permissions: [...source.permissions.filter((p) => !isAddress(p)), 'scripting'],
  host_permissions: [...new Set([...source.permissions.filter(isAddress), ...pages])],
  background: { service_worker: 'worker.js' },
  content_scripts: source.content_scripts.map((group) => ({
    ...group,
    js: ['shim.js', ...(group.js ?? [])],
  })),
}

fs.rmSync('dist/chromium', { recursive: true, force: true })
fs.cpSync('extension', 'dist/chromium', { recursive: true })
fs.writeFileSync('dist/chromium/manifest.json', JSON.stringify(target, null, 2))
fs.writeFileSync('dist/chromium/shim.js', 'self.browser = self.chrome\n')
const scripts = ['shim.js', ...source.background.scripts].map((file) => `'${file}'`)
fs.writeFileSync('dist/chromium/worker.js', `importScripts(${scripts.join(', ')})\n`)
```

Al final del script de fondo, la restauración al arrancar:

```js
async function restoreOpenPages() {
  if (!browser.scripting) return
  const groups = browser.runtime.getManifest().content_scripts ?? []
  const tabs = await browser.tabs.query({ url: groups.flatMap((group) => group.matches) })
  for (const tab of tabs) {
    const alive = await browser.tabs.sendMessage(tab.id, 'ping').catch(() => false)
    if (alive === true) continue
    const target = { tabId: tab.id }
    for (const group of groups) {
      if (group.css) await browser.scripting.insertCSS({ target, files: group.css }).catch(() => {})
      if (group.js)
        await browser.scripting.executeScript({ target, files: group.js }).catch(() => {})
    }
  }
}

restoreOpenPages()
```

Y en un script de contenido, la respuesta:

```js
browser.runtime.onMessage.addListener((message, _sender, reply) => {
  if (message === 'ping') reply(true)
})
```

Para la firma, un `web-ext-config.mjs` en la raíz:

```js
export default {
  sourceDir: './extension',
  artifactsDir: './dist',
}
```

Después, en una shell de tu ordenador, con `dist/` en tu `.gitignore`:

```sh
read -r -p 'JWT issuer: ' WEB_EXT_API_KEY
read -r -s -p 'JWT secret: ' WEB_EXT_API_SECRET
export WEB_EXT_API_KEY WEB_EXT_API_SECRET
npx web-ext sign --channel=unlisted
unset WEB_EXT_API_KEY WEB_EXT_API_SECRET
```

El emisor se parece a `user:00000000:000` y el secreto a `EXAMPLE-not-a-real-secret`; esos dos son marcadores, nunca valores reales. Escribirlos en una pregunta del terminal los mantiene fuera del historial de la shell, cosa que no haría una línea de comandos con los valores dentro. Si prefieres guardarlos en un archivo, guárdalo fuera del repositorio o en un archivo ignorado por git en tu ordenador, nunca en un commit.

## Errores comunes y cómo probarlo

- **Poner las credenciales de AMO en el repositorio.** Cualquiera que tenga el emisor y el secreto puede firmar con tu cuenta. Escríbelos al firmar, o guárdalos en un archivo ignorado por git. Si alguna llega a un commit, revócalas enseguida en [addons.mozilla.org](https://addons.mozilla.org/developers/addon/api/key/) y genera otras nuevas; quitar el commit no basta.
- **Firmar sin cambiar la versión.** Mozilla firma cada versión una sola vez. Cambia `version` primero.
- **Elegir el canal `listed`.** Eso envía la extensión a la tienda pública. Para tu propio móvil, usa `unlisted`.
- **Olvidar `gecko.id`.** Para una extensión Manifest V2 sin él, `web-ext` genera un id y lo guarda en `.web-extension-id`; si pierdes ese archivo, la siguiente firma es otra extensión. Fija el id en el manifiesto.
- **Mantener una página de fondo en Manifest V3.** Chromium quiere un service worker, que no tiene DOM ni `EventSource`.
- **Dejar los patrones de URL en `permissions`.** En Manifest V3 van en `host_permissions`.
- **Esperar que Chromium vuelva a poner los scripts.** Cuando la extensión se recarga, las páginas abiertas pierden sus estilos y no reciben scripts nuevos. Pregunta a cada pestaña, y vuelve a inyectar donde nada responda.
- **Scripts viejos que siguen en marcha.** Un script de contenido que se queda sin su extensión sigue ejecutándose. Comprueba `browser.runtime.id`, y detente cuando haya desaparecido.
- **Inyectar lo que una página pida.** El mensaje de una página no es de confianza. Inyecta solo archivos de tu propio manifiesto.

Para probar el paquete de Firefox antes de firmar, ejecuta `web-ext lint` y `web-ext run --target=firefox-android` con el móvil conectado. Para probar la conversión, expórtala como una función y comprueba un pequeño objeto Manifest V2: sus patrones de URL deberían terminar en `host_permissions`, `scripting` debería añadirse, y cada grupo de scripts de contenido debería empezar con el shim. Para probar la restauración, carga el paquete Chromium en Vivaldi, abre `claude.ai`, toca **Actualizar** en `vivaldi://extensions` y vuelve a la pestaña sin recargarla: los colores y la franja deberían volver en un momento.

## Para ir más lejos

- La [guía 1](/es/mods/claude/what-it-is/) enumera las partes de la extensión y lo que cada una lee por la red.
- El paquete de Firefox podría actualizarse solo: un `update_url` en `browser_specific_settings` que apunte a un archivo propio permite a Firefox encontrar nuevas versiones firmadas ([Extension Workshop: updating your extension](https://extensionworkshop.com/documentation/manage/updating-your-extension/)).
- El mismo paquete Chromium podría cargarse en Chrome en un ordenador, como extensión descomprimida, para probar la franja en una pantalla más ancha.
