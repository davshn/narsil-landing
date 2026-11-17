---
title: Avisos en el móvil y el reloj
description: 'Cómo /narsil movil envía lo que te necesita a un tema privado de ntfy.sh cuando escribes desde fuera: límite diario, tema de estado silencioso, una clave opcional que sella el contenido y Web Push.'
route: pet
order: 15
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/phone.ts
  - repo: pet
    path: hooks/seal.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: odd/tasks/fleet-view.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Qué hace

Cuando trabajas lejos del ordenador, manejando Claude Code mediante Remote Control desde el móvil o la web, la banda y la ventana flotante quedan fuera de tu vista. `/narsil movil` envía entonces lo que te necesita a tu móvil: una conversación terminó, te necesita o falló. Un reloj que refleja las notificaciones del móvil también las muestra; el README de Narsil menciona Wear OS.

Los avisos viajan a través de [ntfy.sh](https://ntfy.sh), un servicio público de notificaciones. El comando crea un tema con un nombre aleatorio, como `narsil-0000000000example0` (todos los nombres de tema de esta guía son ejemplos inventados). Instalas la app de ntfy, te suscribes a ese tema y los avisos llegan como notificaciones con el dibujo de Narsil en su etapa, en la pose del aviso, y un botón que abre la app de Claude.

Narsil solo envía mientras tu último mensaje, en cualquier conversación, haya llegado desde Remote Control. En cuanto vuelves a escribir en el escritorio, en cualquiera de ellas, se detiene. Así, el móvil solo sabe de ella cuando de verdad estás fuera.

> **Advertencia: cualquiera que conozca el nombre del tema puede leerlo, y puede publicar en él.** Los temas de ntfy.sh, tal como los usa Narsil, no tienen contraseña: el nombre es lo único que los mantiene privados. No lo compartas, no lo pegues en capturas de pantalla y ejecuta `/narsil movil nuevo` para pasar a uno nuevo si se filtra. Usa la clave (`/narsil movil clave`) si tu receptor la admite: con ella, el título y el texto de cada aviso se convierten en "Narsil" y en texto ilegible para cualquiera que no tenga la clave, aunque el tipo de aviso, su hora y la etapa de Narsil se siguen viendo.

Los comandos:

| Comando                   | Lo que hace                                                              |
| ------------------------- | ------------------------------------------------------------------------ |
| `/narsil movil` o `on`    | Activa los avisos (creando el tema la primera vez) y dice cómo seguirlo. |
| `/narsil movil off`       | Los desactiva; `on` los vuelve a activar con el mismo tema.              |
| `/narsil movil nuevo`     | Crea un tema nuevo; el antiguo ya no recibe nada más.                    |
| `/narsil movil prueba`    | Envía un aviso de prueba, incluso desde el escritorio.                   |
| `/narsil movil clave`     | Crea una clave y sella todo lo que se envíe a partir de ahora.           |
| `/narsil movil clave off` | Deja de sellar.                                                          |

## Cómo funciona por dentro

`hooks/phone.ts` guarda las partes simples (el tema, el mensaje, la cuenta) como funciones puras; `hooks/seal.ts` guarda el sellado; `hooks/register.tsx` envía y cuenta.

### El tema: `narsil-` y 20 caracteres hexadecimales

`newTopic(crypto.randomUUID())` en `hooks/phone.ts` toma un UUID aleatorio, se queda solo con sus caracteres hexadecimales, los pasa a minúsculas y conserva los 20 primeros: `narsil-` seguido de 20 caracteres de `0-9a-f`. El comentario que tiene encima resume todo el modelo de seguridad del tema: "A topic nobody guesses: whoever knows its name can read it." (un tema que nadie adivina: quien conoce su nombre puede leerlo).

El tema se guarda en las preferencias (`phoneTopic` en `prefs`, guardado con `$.store`), así que todas las conversaciones usan el mismo. `/narsil movil nuevo` lo sustituye por uno nuevo.

De él cuelgan dos temas más, por nombre:

- `<topic>-estado`: un estado silencioso para la extensión de Firefox (abajo).
- `<topic>-push`: donde una app web del móvil deja su suscripción Web Push (abajo).

### Cuándo se envía un aviso: dónde escribiste por última vez

La regla viene de la petición de quien creó Narsil en el registro de tareas (citada abajo): avisar al móvil cuando pediste desde el móvil. Ningún evento le dice a un mod que Remote Control está activo, así que Narsil mira de dónde vienen tus mensajes.

Los tipos de 2.1.325 dan a `prompt.submit` y a `command.run` un `origin`, un `PromptOrigin`. Dos de sus tipos importan aquí: `composer`, "The user's own gesture at the terminal" (el propio gesto de la persona en el terminal), y `bridge`, "The user's message through the Remote Control bridge (a phone or web client)" (el mensaje de la persona a través del puente de Remote Control, un cliente de móvil o web). `noteOrigin` en `hooks/register.tsx`, llamado desde los dos hooks, registra el último:

- `bridge` significa fuera; `composer` significa en el escritorio; cualquier otro tipo no cambia nada.
- Se escribe en `$.store` bajo `remoteOrigin`, no solo en una variable del módulo. El almacén lo comparten todas las conversaciones del plugin, así que una conversación que empezaste en el escritorio también avisa mientras escribes desde el móvil en otra, y ninguna lo hace en cuanto escribes en el escritorio en cualquier sitio.

`isAway` lo vuelve a leer, y recurre a la variable del módulo cuando el almacén falla.

### Lo que lleva un aviso

Todos los avisos pasan por `announce` (guía 6), que termina llamando a `sendToPhone`. `phoneMessage` en `hooks/phone.ts` construye el JSON que acepta ntfy.sh:

- `topic`: tu tema.
- `title`: "Narsil · He terminado · api", con el nombre de la conversación al final.
- `message`: el texto y después, cuando hay más de una conversación abierta, una lista como "Conversaciones:" seguida de "● web · ERROR" y "● api · TRABAJANDO". El texto del móvil para un turno terminado es más largo que el del escritorio, porque un móvil tiene sitio para más parte de la respuesta de Claude.
- `priority`: 3 para un final, 4 para una pregunta o un error.
- `tags`: `white_check_mark`, `raising_hand` o `warning`, que la app de ntfy muestra como un emoji.
- `icon`: su dibujo como PNG en su etapa y en la pose del aviso, desde el repositorio en GitHub, que el móvil descarga por su cuenta.
- `actions`: un botón "Abrir Claude" a `https://claude.ai/code`. El comentario explica que nada en un móvil enlaza con la conversación en sí, así que el botón abre la app de Claude, donde Remote Control la lista.

`postToPhone` lo envía con `$.http.fetch` como un `POST` a `https://ntfy.sh` con un cuerpo JSON. El modo discreto se aplica como en todas partes: un final no se envía, una pregunta o un error sí.

### El límite diario: 200

`PHONE_DAILY` es 200. El comentario del código: "ntfy.sh takes 250 a day for free: Narsil stops short of it." (ntfy.sh acepta 250 al día gratis: Narsil se queda por debajo). El README dice lo mismo.

La cuenta vive en `$.store` bajo `phone`, como `{ day, sent }`, compartida por todas las conversaciones. `day` viene de `dayOf`, la fecha UTC ("2026-10-31"), así que la cuenta vuelve a empezar a medianoche UTC, no a medianoche local. Una cuenta guardada de otro día, o un valor extraño, cuenta como cero.

Antes de cada mensaje, `postToPhone` comprueba la cuenta y se detiene en 200. El mensaje número 200, cuando es un aviso, termina con "(último aviso de hoy: mañana sigo)". Un mensaje que no se consigue enviar no se cuenta. Los mensajes del tema `-estado` cuentan dentro de los mismos 200.

### El tema `-estado` y sus campos

Tras cada turno de la conversación principal, y con cada pregunta, `sendStatus` publica un pequeño estado en `<topic>-estado`, con las mismas reglas que los avisos (avisos activados, tú fuera, la cuenta diaria). `/narsil movil prueba` también envía uno. Va con `priority: 1`, y el comentario del código dice que este tema "not followed by push, so its messages never show as notifications" (no se sigue por push, así que sus mensajes nunca se muestran como notificaciones).

El README dice que lo lee la extensión de Firefox de quien creó Narsil (`narsil-claude`), "because they are data only the PC knows" (porque son datos que solo conoce el PC). El mensaje es un texto JSON con estos campos:

| Campo          | Qué es                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------- |
| `xp`           | La etiqueta de nivel de Narsil, "⭐ Nivel 3 · 120/300 XP" (guía 13).                              |
| `art`          | La URL de su dibujo, en su etapa, en la pose de la conversación abierta más importante.           |
| `at`           | Cuándo se envió, en segundos Unix.                                                                |
| `cacheMinutes` | Cuánto dura la caché del prompt, de la primera conversación abierta que tenga una; ausente si no. |
| `usage`        | Una fila, `ntfy`, con la propia cuenta de ntfy.sh de los mensajes de hoy desde tu red, o vacía.   |

Para `usage`, Narsil pide `GET https://ntfy.sh/v1/account` y construye la fila con `ntfyRow`: `{ key: 'ntfy', label: 'ntfy hoy', percent, color, note, resetsAt }`, contando el mensaje que está a punto de salir. El comentario explica por qué esta cuenta difiere de la de Narsil: ntfy.sh cuenta por dirección IP, "in a day of its own that starts at an hour hashed from the IP, not at midnight" (en un día propio que empieza a una hora calculada con un hash de la IP, no a medianoche).

### La clave opcional, y cómo se sella el contenido

`/narsil movil clave` crea una clave con `newKey()`: 32 bytes aleatorios de `crypto.getRandomValues`, escritos en base64url (43 caracteres). Se guarda en las preferencias (`phoneKey`) y se muestra en la respuesta del comando, para que puedas pegarla en las opciones del receptor. A partir de entonces, todo lo que Narsil publica en ntfy.sh, tanto los avisos como `-estado`, va sellado.

Lo que va sellado y lo que no, según `sealedMessage` y `sealedPayload` en `hooks/phone.ts`:

- **Sellado:** el título y el texto, juntos como JSON dentro de `message`.
- **En claro:** el tema, `title` sustituido solo por "Narsil", la prioridad, las etiquetas, la URL del icono y el botón.

Así que un aviso sellado sigue mostrando que hubo un aviso, cuándo, su tipo (por la prioridad, la etiqueta y la pose en el nombre del archivo del icono) y la etapa de Narsil (por la carpeta del icono). El nombre de la conversación, la respuesta de Claude y la lista de conversaciones van dentro.

El esquema, exactamente como lo implementa `hooks/seal.ts`. El comentario del archivo explica por qué se construye a mano: "The hooks module's crypto has SHA-256 alone" (el crypto del módulo de hooks solo tiene SHA-256). Los tipos de 2.1.325 coinciden: el `crypto.subtle` del módulo de hooks declara `digest` y nada más. Así que:

1. **HMAC-SHA256 a partir de `digest`.** `hmac(key, data)` es la construcción de manual sobre SHA-256: la clave rellenada hasta 64 bytes (con un hash previo si es más larga), y después `SHA-256((key ⊕ 0x5c) ‖ SHA-256((key ⊕ 0x36) ‖ data))`.
2. **Dos claves a partir de una.** A partir de la clave de 32 bytes, `encKey = HMAC(key, "enc")` y `macKey = HMAC(key, "mac")`.
3. **Un nonce nuevo.** 16 bytes aleatorios para cada mensaje.
4. **El flujo de clave.** El bloque `i` es `HMAC(encKey, nonce ‖ i)`, con `i` en 4 bytes, big-endian; cada bloque da 32 bytes, combinados con XOR con el texto UTF-8. El comentario lo llama modo contador (CTR).
5. **La etiqueta.** `HMAC(macKey, nonce ‖ ciphertext)`, 32 bytes, sobre los bytes cifrados (el comentario lo llama "encrypt-then-MAC", cifrar y después MAC).
6. **El texto enviado.** `narsil1:` seguido del base64url de `nonce ‖ ciphertext ‖ tag`.

`unseal` lo invierte: comprueba el prefijo `narsil1:` y una longitud mínima, vuelve a calcular la etiqueta y la compara byte a byte, y solo entonces descifra. Una clave equivocada, un byte cambiado o un texto sin sellar dan `null`. El test "what the mod seals, it opens; with another key, or tampered, it does not" (lo que el mod sella, lo abre; con otra clave, o manipulado, no) comprueba esos tres casos. El comentario dice que los receptores lo abren con el HMAC de WebCrypto, "which gives the same bytes" (que da los mismos bytes); esos receptores son proyectos aparte, no están en este repositorio.

Esta guía describe lo que hace el código y no afirma nada más allá. Si lo adaptas, revísalo como revisarías cualquier criptografía construida a mano.

La app de ntfy no puede abrir mensajes sellados: muestra el ruido. Narsil lo dice cuando activas la clave, y `/narsil movil clave off` vuelve al texto en claro. Ejecutar `/narsil movil clave` otra vez crea una clave nueva.

### Web Push: mantener suscrita una app web del móvil

Además de la app de ntfy, los avisos pueden llegar a una app web propia mediante Web Push; el README menciona [narsil-pwa](https://github.com/davshn/narsil-pwa), de quien creó Narsil. ntfy.sh puede entregar un tema por Web Push a una suscripción del navegador, pero, como dice el comentario del código, "ntfy.sh drops a subscription whose delivery failed once" (ntfy.sh descarta una suscripción cuya entrega falló una vez). La app podría volver a registrarse cuando la abres, pero entonces los avisos esperarían a que la abrieras.

Así que el mod la vuelve a registrar antes de cada aviso (`renewPush`, llamado solo para los avisos, no para `-estado`):

1. La app deja su suscripción, `{ endpoint, auth, p256dh }`, en `<topic>-push`, sellada con la clave cuando la hay.
2. `latestPush` lee el último mensaje de ahí, `GET https://ntfy.sh/<topic>-push/json?poll=1&since=latest`. Con clave, lo abre con `unseal`; sin ella, lo lee tal cual.
3. `pushSubscriptionOf` acepta solo un endpoint `https` de como mucho 1000 caracteres y dos claves base64url cortas; todo lo demás se ignora.
4. Una válida se guarda en `$.store` bajo `phonePush`. Cuando ntfy.sh ha olvidado el mensaje (el comentario dice que guarda un mensaje 12 horas), se usa la guardada.
5. Se publica en `https://ntfy.sh/v1/webpush` con `topics: [your topic]`.

Registrar no publica nada, así que no cuenta dentro de los 200. Cualquier fallo se descarta en silencio, y el aviso sale como habría salido.

Del código se siguen dos notas de privacidad. La suscripción en sí va a ntfy.sh en claro, como necesita Web Push. Y sin clave, cualquiera que conozca el tema puede dejar una suscripción en `<topic>-push`, y el mod la registrará para tu tema; con clave, el mod solo acepta una suscripción que se abra con ella.

### El modelo de privacidad, en palabras sencillas

- **ntfy.sh ve todo lo que no va sellado**, y la hora y la red de cada mensaje. Es un servicio de terceros: lee sus condiciones antes de enviar nada allí.
- **El nombre del tema es la contraseña.** Quien lo tiene puede leer todos los mensajes y publicar mensajes falsos. Un nombre aleatorio lo hace difícil de adivinar, no secreto una vez compartido.
- **Sin clave**, quien lea el tema ve los nombres de las conversaciones, el texto de cada aviso (parte de la respuesta de Claude) y la lista de conversaciones abiertas.
- **Con clave**, quien lea el tema ve que hubo un aviso, su tipo, su hora y la etapa de Narsil, pero no el texto. Un mensaje falsificado no se abre con la clave, y un receptor que comprueba la etiqueta puede rechazarlo.
- **La clave vive en dos sitios**: en el almacén del plugin, un archivo JSON bajo el directorio de configuración de Claude Code, y en la respuesta de `/narsil movil clave`, que forma parte de la conversación. Las respuestas a los comandos de Narsil no fijan `isTextDisplayOnly`, y los tipos de 2.1.325 dicen que, salvo los plugins incluidos con Claude Code, "Any other plugin's text stays in requests" (el texto de cualquier otro plugin se queda en las peticiones), así que el modelo también lo lee. Trata la conversación como si contuviera la clave.
- **El envío se detiene en el escritorio.** No sale nada mientras tu último mensaje haya llegado desde el terminal o la app de escritorio, salvo la prueba.

## Cómo se le pidió a la IA

### Registrado: avisa al móvil cuando escribo desde el móvil

La regla del móvil tal como funciona hoy se pidió en el registro de tareas de la vista de conversaciones, `odd/tasks/fleet-view.md`. L1 (2026-11-06), la petición original, incluye:

> "las notificaciones se enviarian al celular cuando se pida algo desde el celular como ahora y haya cambios, es decir alguna tarea pase de trabajando a terminado, o de trabajando a error, etc, [...] las notificaciones del celular cuando se envien llevarian la info de todas las sesiones funcionando en ese momento"

En L2, respondiendo a si una conversación empezada en el escritorio también debía avisar mientras quien creó Narsil escribe desde el móvil en otra:

> "si claro me avisas al movil"

El registro de tareas recoge el resultado en L9 (T4 hecha): "Where you last wrote (phone or desk), in any conversation, is kept in the store (`remoteOrigin`), so every conversation alerts the phone on its changes (done, waiting, error) while your last message came from the phone, and none does once you write at the desk anywhere. Each alert ends with "Conversaciones:" and one line per open conversation" (dónde escribiste por última vez, móvil o escritorio, en cualquier conversación, se guarda en el almacén, `remoteOrigin`, así que todas las conversaciones avisan al móvil de sus cambios, terminado, esperando, error, mientras tu último mensaje haya llegado desde el móvil, y ninguna lo hace en cuanto escribes en el escritorio en cualquier sitio. Cada aviso termina con "Conversaciones:" y una línea por conversación abierta). Eso es lo que hacen hoy `noteOrigin`, `isAway` y `fleetText`.

L9 también describe un estado `-estado` más completo, con una lista `sessions` y los campos de la conversación más importante. Ese estado se recortó después: `544ef89` (2026-11-09) "feat: send only what the Firefox extension reads through ntfy" (enviar solo lo que la extensión de Firefox lee a través de ntfy) dejó los cinco campos de arriba. El código y el README coinciden en los cinco.

### Reconstrucción a partir del historial de commits

Los pasos anteriores no quedaron registrados. A partir de `git log -- hooks/phone.ts hooks/seal.ts` y los commits relacionados:

- `d91997f` (2026-10-31) "feat: send what needs you to your phone and watch through ntfy, with Narsil's picture" (enviar lo que te necesita a tu móvil y tu reloj mediante ntfy, con el dibujo de Narsil). El tema, los avisos, el icono y el límite de 200 llegan juntos.
- `c27a9e4` (2026-10-31) "feat: send phone alerts only while you write through Remote Control" (enviar avisos al móvil solo mientras escribes mediante Remote Control). La regla de dónde escribiste por última vez.
- `4f8abaa` (2026-11-01) "feat: send the state the band shows to a status topic for your own phone app" (enviar el estado que muestra la banda a un tema de estado para tu propia app del móvil). El tema `-estado`.
- `5a9ee10` (2026-11-01) "feat: seal phone messages with /narsil movil clave, send reset times and an Abrir Claude button" (sellar los mensajes del móvil con /narsil movil clave, enviar las horas de reinicio y un botón Abrir Claude). Nace `hooks/seal.ts`.
- `644e59f` (2026-11-01) "fix: send the state to the phone with each question, so the app shows Narsil waiting" (enviar el estado al móvil con cada pregunta, para que la app muestre a Narsil esperando).
- `7498be5` (2026-11-02) "feat: register the phone app's push subscription again before each alert, so alerts keep coming after ntfy.sh drops it" (volver a registrar la suscripción push de la app del móvil antes de cada aviso, para que los avisos sigan llegando después de que ntfy.sh la descarte).
- `3a1f31c` (2026-11-06) "feat: alert the phone for every conversation and list them all" (avisar al móvil por cada conversación y listarlas todas). La petición citada arriba.
- `544ef89` (2026-11-09) "feat: send only what the Firefox extension reads through ntfy" (enviar solo lo que la extensión de Firefox lee a través de ntfy). Su mensaje: "The phone web app is gone" (la app web del móvil ya no está), y la renovación de Web Push se fue con ella.
- `5fe48c9` (2026-11-10) "feat: register the phone app's push subscription again before each alert" (volver a registrar la suscripción push de la app del móvil antes de cada aviso). Su mensaje: "The phone web app is back as the alert receiver, in Chrome" (la app web del móvil vuelve como receptor de avisos, en Chrome), y la renovación regresó, ahora con la alternativa de las 12 horas.

El historial muestra una funcionalidad moldeada por sus receptores: cada vez que cambiaba la app del otro lado, el lado del mod cambiaba con ella.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil.

> En mi mod de Claude Code `my-pet`, añade avisos al móvil mediante ntfy.sh. `/my-pet phone` crea un tema `my-pet-` más 20 caracteres hexadecimales de `crypto.randomUUID()`, lo guarda en `$.store` y responde cómo suscribirse en la app de ntfy, advirtiendo de que cualquiera que conozca el tema puede leerlo. Registra dónde escribió la persona por última vez: en `prompt.submit` y `command.run`, `e.origin.kind === 'bridge'` significa fuera y `'composer'` significa en el escritorio; guárdalo en `$.store` para que todas las conversaciones lo compartan. Cuando termine un turno de la conversación principal, y solo mientras la persona esté fuera, publica `{ topic, title, message, priority }` como JSON en `https://ntfy.sh` con `$.http.fetch`. Cuenta los mensajes por día UTC en `$.store` y detente en 200. No pongas nunca el tema en los registros. Prueba con `claude-code/testing`, respondiendo tú a `http.fetch`: no se envía nada desde el escritorio, se envía un aviso desde el puente, y el mensaje 201 del día no se envía.

## El código mínimo

Escrito para esta guía y comprobado con los tipos de 2.1.325 (`$.store.get`, `$.store.set`, `$.http.fetch`, `$.clock.now`, `$.command.register`, `command.run`, `prompt.submit`, `turn.complete`, `crypto.randomUUID`). Está adaptado de `hooks/phone.ts` y `hooks/register.tsx` en [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). Envía texto en claro; para el sellado, lee `hooks/seal.ts`.

```tsx
import type { EngineInterface, Register } from 'claude-code'

const NTFY = 'https://ntfy.sh'
const DAILY = 200

async function isAway($: EngineInterface): Promise<boolean> {
  return (await $.store.get('away').catch(() => false)) === true
}

async function noteOrigin($: EngineInterface, kind: string): Promise<void> {
  if (kind === 'bridge' || kind === 'composer')
    await $.store.set('away', kind === 'bridge').catch(() => undefined)
}

async function sendToPhone($: EngineInterface, title: string, message: string): Promise<void> {
  const topic = await $.store.get('topic').catch(() => undefined)
  if (typeof topic !== 'string' || !(await isAway($))) return
  const day = new Date(await $.clock.now()).toISOString().slice(0, 10)
  const saved = (await $.store.get('sent').catch(() => undefined)) as
    { day?: string; sent?: number } | undefined
  const sent = saved?.day === day && typeof saved.sent === 'number' ? saved.sent : 0
  if (sent >= DAILY) return
  try {
    const { ok } = await $.http.fetch(NTFY, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic, title, message, priority: 3 }),
    })
    if (ok) await $.store.set('sent', { day, sent: sent + 1 })
  } catch {
    // offline: the alert is lost, and nothing else breaks
  }
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'my-pet', description: 'My pet: phone' })
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await noteOrigin($, e.origin.kind)
    return next(e)
  })

  on('command.run', { command: 'my-pet' }, async ($, e) => {
    await noteOrigin($, e.origin.kind)
    if (e.args.trim() !== 'phone') return { text: 'Usage: /my-pet phone' }
    let topic = await $.store.get('topic').catch(() => undefined)
    if (typeof topic !== 'string') {
      topic = `my-pet-${crypto
        .randomUUID()
        .replace(/[^0-9a-f]/gi, '')
        .toLowerCase()
        .slice(0, 20)}`
      await $.store.set('topic', topic)
    }
    return {
      text: `Subscribe to ${topic} on ntfy.sh in the ntfy app. Anyone who knows this name can read it: do not share it.`,
    }
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined && e.reason === 'answer')
      await sendToPhone($, 'My pet · Done', e.answer.slice(0, 300))
    return result
  })
}
```

La respuesta del comando muestra el tema una vez, a propósito, para que la persona pueda suscribirse; recuerda que esa respuesta se queda en la conversación. Narsil hace lo mismo.

## Errores comunes y cómo probarlo

- **Un tema adivinable.** Un tema con tu nombre o el de tu proyecto lo puede leer cualquiera que lo pruebe. Usa un nombre aleatorio.
- **Escribir el tema o la clave en los registros.** Los dos son secretos. Mantenlos fuera de `$.ui.log`, de las capturas de pantalla, de las issues y de los datos de prueba que publiques.
- **Avisar en el escritorio.** Sin la regla del origen, el móvil vibra mientras sigues delante de la pantalla. Remote Control no es un evento; la señal es el origen del último mensaje.
- **Guardar el origen solo en una variable del módulo.** Cada conversación decidiría entonces por su cuenta, y una conversación empezada en el escritorio nunca avisaría mientras escribes desde el móvil en otra.
- **Sin límite diario.** Un bucle de turnos que fallan puede agotar un plan gratuito en minutos. Cuenta antes de enviar, por día, entre conversaciones.
- **Creer que "cifrado" significa "invisible".** El sellado de Narsil oculta el título y el texto, no el hecho, la hora, el tipo y el icono de un aviso.
- **Criptografía construida a mano sin tests.** Sellar, abrir, clave equivocada y un byte invertido son el mínimo, como hace el test de Narsil.

Para probarlo, `tests/narsil.test.tsx` responde a `http.fetch` por su cuenta, así que nada llega a ntfy.sh. Vale la pena leer: "the phone gets nothing until /narsil movil is turned on" (el móvil no recibe nada hasta que se activa /narsil movil), "/narsil movil makes a private topic, says how to follow it, and sends what needs you there" (/narsil movil crea un tema privado, dice cómo seguirlo y envía allí lo que te necesita), "the phone gets alerts only while you write through Remote Control, never at the desk" (el móvil recibe avisos solo mientras escribes mediante Remote Control, nunca en el escritorio), "while you write from the phone in another conversation this one alerts too, and a message at the desk anywhere stops it" (mientras escribes desde el móvil en otra conversación, esta también avisa, y un mensaje en el escritorio en cualquier sitio lo detiene), "the phone gets at most 200 a day, says which is the last, and starts again the next day" (el móvil recibe como mucho 200 al día, dice cuál es el último y vuelve a empezar al día siguiente), "/narsil movil clave seals what goes to ntfy.sh; clave off sends it in the clear again" (/narsil movil clave sella lo que va a ntfy.sh; clave off lo vuelve a enviar en claro), "as a turn ends from the phone, the extension gets only what it reads on the status topic, silently" (cuando termina un turno desde el móvil, la extensión recibe solo lo que lee en el tema de estado, en silencio) y "the state the extension reads does not register the subscription; only alerts do" (el estado que lee la extensión no registra la suscripción; solo lo hacen los avisos).

### Dónde difieren el código y el README

- El README dice que la clave solo la tienen "tu PC y la extensión". El comentario de `hooks/seal.ts` dice "the PC, the Firefox extension and the phone app" (el PC, la extensión de Firefox y la app del móvil), y la sección de Web Push del README sella la suscripción de la app con la clave. El código hace lo que dice el comentario.
- El README dice que el estado `-estado` sale "Al terminar cada turno". El código también lo envía con cada pregunta, y con la prueba.

## Para ir más lejos

- `fleetText` en `hooks/phone.ts` construye la lista de conversaciones bajo cada aviso.
- `ntfyRow` convierte la respuesta de la cuenta de ntfy.sh en el mismo tipo de fila de uso que la banda dibuja para los límites de la cuenta (guía 7).
- `summary` en `hooks/words.ts` corta la respuesta de Claude para el aviso, con más sitio para el móvil (`PHONE_ROOM`).
- La siguiente guía, el resumen de la sesión, es otra cosa que Narsil cuenta y guarda en `$.store`.
