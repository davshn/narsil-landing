---
title: Reacciones a los comandos
description: 'Cómo Narsil lee los comandos de shell que ejecuta Claude: celebra los tests que pasan, nota los que fallan y avisa de los comandos sin vuelta atrás sin bloquearlos nunca.'
route: pet
order: 9
updated: 2026-11-18
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/words.ts
  - repo: pet
    path: hooks/register.tsx
  - repo: pet
    path: hooks/watch.ts
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Qué hace

Cada vez que Claude ejecuta un comando de shell (la herramienta `Bash` o `PowerShell`), Narsil lee la línea de comandos y reacciona a dos tipos de comando.

**Tests.** Cuando el comando ejecuta los tests de un proyecto, Narsil espera el resultado:

- Si sale bien, lo celebra en la banda: "¡Los tests pasan! 🎉", y gana 5 puntos de experiencia.
- Si falla, se sobresalta (la pose "asustada" de las guías anteriores) y dice "Los tests fallan; vamos a ver por qué."
- La siguiente vez que pasan tras un fallo, dice "¡Recuperados! Los tests vuelven a pasar."

El README enumera los ejecutores que reconoce: npm, pnpm, yarn, bun, vitest, jest, pytest, go, cargo, dotnet, maven, gradle y más.

**Comandos que no se pueden deshacer.** Antes de que se ejecute un comando así, el comentario de la banda se convierte en un aviso, "⚠️ Cuidado: … no tiene vuelta atrás.", con el nombre del tipo de comando en el hueco. También va una línea al registro del terminal, con la primera línea del comando. Después, el comando sigue adelante como siempre. El README lo dice sin rodeos: "Solo avisa: nunca bloquea nada."

Lo que te da: un vistazo a la banda te dice si la última ejecución de tests pasó, y un comando destructivo recibe un segundo par de ojos mientras el diálogo de permiso, si lo hay, sigue en pantalla.

## Cómo funciona por dentro

### Un hook delante de cada herramienta: `tool.call`

Las dos reacciones viven en el hook `tool.call` de `hooks/register.tsx`. Un hook `tool.call` envuelve la llamada: el código antes de `next(e)` se ejecuta antes de la herramienta, y `await next(e)` devuelve el resultado de la herramienta. Esa forma es lo que permite a Narsil avisar antes del comando y reaccionar a los tests después.

El hook descarta primero lo que no es trabajo de Claude:

- Una llamada que hace otro mod (con `$.tool.call` o `$.mcp.call`) también lanza `tool.call`. `isClaudesCall` en `hooks/watch.ts` se queda solo con las llamadas cuyo `next.origin.plugin` es `"engine"`. El comentario explica el error que corrigió: ningún turno termina una llamada hecha por otro mod, así que dejaba a Narsil "trabajando" hasta el siguiente prompt (`21df208`).
- Solo `Bash` y `PowerShell` llevan una línea de comandos (`SHELL_TOOLS` en `hooks/words.ts`). Para cualquier otra herramienta, el comando es la cadena vacía, y ninguna de las dos reacciones puede dispararse.

A diferencia del estado de la banda, esta parte no se salta a los subagentes: un test ejecutado por un subagente también se celebra.

### Reconocer una ejecución de tests

`TEST_COMMAND` en `hooks/words.ts` es una sola expresión regular sobre la línea de comandos:

```ts
export const TEST_COMMAND =
  /\b(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?test|(?:go|cargo|dotnet|mvn|gradle|gradlew|deno|mix)\s+test|claude\s+plugin\s+test|python3?\s+-m\s+(?:pytest|unittest)|vitest|jest|pytest|mocha|phpunit|rspec)\b/
```

Busca en cualquier parte de la línea, así que un comando que primero cambia de directorio y después ejecuta los tests también cuenta.

Si los tests pasaron no se lee de su salida. Narsil solo mira `result.isError`, el veredicto de la propia herramienta sobre la llamada. Analizar la salida de una docena de ejecutores, cada uno con su propio formato de resumen, se rompería con cada ejecutor o versión nuevos; el indicador de error de la herramienta es la misma señal para todos, y es también en la que se apoya un trabajo de CI. El precio es que Narsil solo sabe "pasaron" o "fallaron", no cuántos.

Una variable del módulo, `areTestsFailing`, recuerda que la última ejecución falló. Ese único indicador es lo que convierte el siguiente éxito en "recuperados" en lugar de una celebración normal.

Un fallo también alimenta los consejos de la guía 11: se guarda el texto del error, y dos fallos de la misma herramienta en un turno piden un consejo de depuración.

### Reconocer un comando peligroso

`DANGEROUS_COMMANDS` en `hooks/words.ts` es una lista de pares: el nombre con el que avisa Narsil y el patrón que lo encuentra. Un extracto, reducido a los patrones:

```ts
const DANGEROUS_COMMANDS: readonly (readonly [name: string, pattern: RegExp])[] = [
  ['rm -rf', /\brm\s+(?:-[a-zA-Z]*(?:[rR]f|f[rR])[a-zA-Z]*|-[rR]\s+-f|-f\s+-[rR])\b/],
  ['git push --force', /\bgit\s+push\b[^|;&\n]*\s(?:--force(?!-with-lease)|-f)\b/],
  ['git reset --hard', /\bgit\s+reset\s+--hard\b/],
  ['Remove-Item -Recurse -Force', /\bRemove-Item\b(?=[^|;\n]*-Recurse\b)(?=[^|;\n]*-Force\b)/i],
  ['DROP', /\bdrop\s+(?:table|database|schema)\b/i],
  // ... also git clean -f, git branch -D, chmod -R 777, mkfs, dd onto a device
  // and 'descargar y ejecutar' (download and run): curl, wget or
  // Invoke-WebRequest piped into a shell
]
```

(El comentario del extracto: además git clean -f, git branch -D, chmod -R 777, mkfs, dd sobre un dispositivo y 'descargar y ejecutar': curl, wget o Invoke-WebRequest encadenados a una shell.)

Algunos detalles muestran el cuidado de los patrones:

- El push forzado excluye `--force-with-lease`, la variante que se niega a sobrescribir trabajo que no ha visto.
- `[^|;&\n]*` mantiene la opción dentro del mismo comando: un `--force` después de una tubería o de un `;` pertenece a otro comando.
- El patrón de `rm` acepta las opciones juntas en cualquier orden o escritas por separado.
- El de PowerShell necesita tanto `-Recurse` como `-Force`, en cualquier orden, con lookaheads.

`dangerOf(command)` devuelve el nombre del primer patrón que coincide, o `null`.

### Por qué avisa en lugar de denegar

Un hook `tool.call` podría rechazar la llamada: los tipos de 2.1.325 documentan `{ deny: reason }` como respuesta, y entonces el modelo recibe el texto como un resultado de error. Narsil nunca lo hace. Ni el código ni el README dicen por qué con esas palabras; el README solo afirma que nunca bloquea. Las razones de abajo son la lectura que hace esta guía del código y de los tipos:

- **Los patrones son conjeturas.** Borrar una carpeta de compilación de forma recursiva es rutina en muchos scripts. Un bloqueo en cada coincidencia frenaría trabajo legítimo, y el modelo buscaría otra forma de hacer lo mismo. Los patrones además se pierden cosas (nombres largos de opciones, un archivo de script que contiene el comando), así que un bloqueo prometería una seguridad que no puede dar.
- **Claude Code ya tiene el candado.** Los tipos describen que `tool.check` se dispara "after the `tool.call` and PreToolUse hooks and before the mode settles an ask" (después de los hooks `tool.call` y PreToolUse y antes de que el modo resuelva una pregunta). Las reglas de permisos y el diálogo de permiso son donde se detiene un comando; el aviso de Narsil llega antes de esa decisión, mientras todavía puedes responder que no.
- **El hook de un mod es una protección débil de todos modos.** Los tipos advierten que "a guard that fails is skipped and the tool runs" (una protección que falla se omite y la herramienta se ejecuta). Una protección real necesita un cuidado que Narsil, como compañera, no tiene por qué asumir.

### Qué muestra

Las reacciones pasan por `setMood`, el único punto de entrada de la primera guía: el ánimo sigue siendo el de la herramienta ("ejecutando" para una shell, "asustada" ante un fallo), y la línea de comentario lleva el aviso o la celebración. La línea del registro del terminal se escribe con `$.ui.log`, recortada a la primera línea del comando y a 120 caracteres. El aviso se fija antes de `next(e)`, así que está en pantalla mientras el comando espera permiso o se ejecuta.

## Constrúyelo con Claude

Pídele a Claude un hook `tool.call` que lea los comandos de shell, avise antes de los comandos que no se pueden deshacer y reaccione a los resultados de los tests. La idea que Claude debe acertar: el hook avisa, y nunca bloquea.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es el prompt de quien creó Narsil.

> En mi mod de Claude Code `my-pet`, añade un hook `tool.call` que reaccione a los comandos de shell. Sáltate las llamadas cuyo `next.origin.plugin` no sea `"engine"`, y las herramientas que no sean `Bash` ni `PowerShell`. Antes de llamar a `next(e)`, compara `e.command` con una lista de expresiones regulares con nombre para comandos que no se pueden deshacer (borrado recursivo forzado, push forzado pero no `--force-with-lease`, reset duro, borrar una tabla); si hay coincidencia, escribe un aviso con el nombre en un átomo que se muestre en la banda `AbovePrompt` y regístralo con `$.ui.log`, y nunca devuelvas `{ deny }`. Después de `next(e)`, si el comando coincide con un patrón de ejecutor de tests, muestra "Tests pass" cuando `result.isError` sea falso y "Tests fail" cuando sea verdadero, y "Recovered" cuando pasen tras un fallo. Añade tests con `claude-code/testing` en los que un hook responda a la herramienta, para que nada se ejecute de verdad.

### Qué revisar en la respuesta de Claude

1. El hook se salta las llamadas cuyo `next.origin.plugin` no es `"engine"`, y todas las herramientas que no son `Bash` ni `PowerShell`.
2. El aviso se escribe antes de `next(e)`, así que está en pantalla mientras el comando espera permiso o se ejecuta.
3. Ningún camino del hook devuelve `{ deny }`.
4. El éxito o el fallo se lee de `result.isError`, no de la salida de los tests, y una marca recuerda un fallo para que el siguiente éxito diga "Recovered".
5. Los tests responden a la herramienta desde un hook, así que ningún comando destructivo se ejecuta de verdad.

Si una comprobación falla, dile a Claude lo que ves: "el aviso aparece solo después de que el comando haya terminado", o "la mascota se queda en trabajando después de que otro mod llame a una herramienta".

### Cómo lo pidió el autor

La petición original de estas reacciones no quedó registrada. Llegaron el 2026-10-30, antes de los registros de tareas públicos del proyecto (`odd/tasks/fleet-view.md` empieza el 2026-11-06 y no las menciona).

#### Reconstrucción a partir del historial de commits

A partir de `git log -- hooks/register.tsx hooks/words.ts hooks/watch.ts` en narsil-pet:

- `c885292` (2026-10-30) "feat: estimate when the context fills, react to tests and dangerous commands, show subagents" (estimar cuándo se llena el contexto, reaccionar a los tests y a los comandos peligrosos, mostrar los subagentes). El patrón de tests, la lista de comandos peligrosos y el indicador de "recuperados" llegan juntos en este commit, dentro del hook `tool.call`.
- `8913cdd` (2026-10-30) "feat: let Narsil earn experience and levels kept across sessions" (dejar que Narsil gane experiencia y niveles que se conservan entre sesiones). Los tests que pasan empiezan a dar experiencia.
- `0cfc369` (2026-10-31) "refactor: move Narsil's wording and labels out of the hooks module" (sacar los textos y las etiquetas de Narsil del módulo de hooks). Los patrones pasan a `hooks/words.ts`, donde están hoy.
- `21df208` (2026-11-06) "fix: ignore tool calls other mods make, so Narsil no longer sticks at working" (ignorar las llamadas a herramientas que hacen otros mods, para que Narsil ya no se quede atascada en trabajando). El filtro `isClaudesCall` de arriba.

Los patrones en sí no han cambiado desde que se escribieron: `git log -S` solo los encuentra en el primer commit y en el traslado.

## Código de referencia

Esta es una respuesta correcta, escrita para esta guía. Léela para entender cómo encajan las piezas y para compararla con lo que Claude escribió para ti: Claude puede elegir otros nombres u otro orden y aun así estar en lo cierto.

Escrito para esta guía y comprobado con los tipos de 2.1.325 (`tool.call`, `next.origin`, `$.ui.log`, `ui.render`). Está adaptado de `hooks/register.tsx` y `hooks/words.ts` en [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). El átomo `line` se declara en `types/index.d.ts` como en la primera guía, con el tipo `string`.

```tsx
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const line = atom({ plugin: 'my-pet', key: 'line' } as const, '')

const TEST =
  /\b(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?test|vitest|jest|pytest|cargo\s+test|go\s+test)\b/
const DANGER: readonly (readonly [string, RegExp])[] = [
  ['rm -rf', /\brm\s+(?:-[a-zA-Z]*(?:[rR]f|f[rR])[a-zA-Z]*|-[rR]\s+-f|-f\s+-[rR])\b/],
  ['git push --force', /\bgit\s+push\b[^|;&\n]*\s(?:--force(?!-with-lease)|-f)\b/],
  ['git reset --hard', /\bgit\s+reset\s+--hard\b/],
]
let testsFailing = false

export const register: Register = (on) => {
  on('tool.call', async ($, e, next) => {
    if (next.origin.plugin !== 'engine') return next(e)
    if (e.tool !== 'Bash' && e.tool !== 'PowerShell') return next(e)
    const command = e.command

    const danger = DANGER.find(([, pattern]) => pattern.test(command))?.[0]
    if (danger) {
      $.ui.log(`⚠️ my-pet: ${danger} cannot be undone: ${command.split('\n')[0]!.slice(0, 120)}`)
      await update($, line, () => `⚠️ Careful: ${danger} cannot be undone.`)
    }

    // Warn only: the call always goes on to the engine.
    const result = await next(e)

    if (TEST.test(command)) {
      const text = result.isError
        ? 'The tests fail; let us see why.'
        : testsFailing
          ? 'Recovered! The tests pass again.'
          : 'The tests pass! 🎉'
      testsFailing = !!result.isError
      await update($, line, () => text)
    }
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const text = await read($, line)
    if (!text) return next(e)
    const { Text } = $.ui.resolve(e)
    return <Text wrap="truncate-end">{text}</Text>
  })
}
```

## Errores comunes y cómo probarlo

- **Reaccionar a las llamadas de otros mods.** El `$.tool.call` de otro mod también lanza `tool.call`, y ningún turno lo termina. Comprueba `next.origin.plugin === 'engine'` (`21df208`).
- **Avisar cuando ya es tarde.** Un aviso fijado después de `await next(e)` llega cuando el comando ya se ha ejecutado. Fíjalo antes.
- **Convertir el aviso en un bloqueo.** Devolver `{ deny }` ante una coincidencia de patrón frena trabajo legítimo e invita al modelo a buscar una forma de esquivarlo. Deja la decisión al sistema de permisos.
- **Fiarse demasiado del indicador de error.** Un comando que oculta su propio código de salida (encadenar la ejecución de tests a otro programa, o terminarla con una alternativa que siempre sale bien) se lee como un éxito. Narsil no puede saberlo, y tu copia tampoco.
- **Probar con comandos destructivos reales.** Nunca los ejecutes para ver el aviso. En un test, responde a la herramienta desde un hook para que nada se ejecute.

Para probarlo, `claude plugin test .` ejecuta `tests/narsil.test.tsx`. "a dangerous command is flagged before it runs, and an ordinary one is not" (un comando peligroso se señala antes de ejecutarse, y uno corriente no) responde a cada `tool.call` desde un hook con `{ result: {} }`, para que ningún comando llegue a una shell, y lee la línea de comentario enviada a la ventana flotante en el momento en que llega cada llamada. Espera los cuatro avisos para cuatro comandos destructivos, y ningún aviso para un push corriente. "tests that pass are cheered, and failing ones are noticed until they pass again" (los tests que pasan se celebran, y los que fallan se notan hasta que vuelven a pasar) cubre la celebración, el fallo y la recuperación.

## Para ir más lejos

- `describeCall` en `hooks/words.ts` construye el detalle de la banda para cada herramienta (el nombre de un archivo, la primera línea de un comando); las reacciones reutilizan ese mismo detalle.
- `gainXp($, 'tests')` suma los 5 puntos; `hooks/xp.ts` guarda las cantidades y los niveles.
- Los fallos que registra este hook (`seen.failures`) forman parte de lo que los consejos de la guía 11 envían al modelo.
- `DANGEROUS_COMMANDS` es fácil de ampliar: un nombre y un patrón por línea. Mantén cada patrón dentro de un solo comando con `[^|;&\n]`, como hacen los que ya existen.
