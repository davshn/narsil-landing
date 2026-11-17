---
title: 'Reutilizar código de Narsil: la GPL v3'
description: Los dos mods de Narsil tienen licencia GPL-3.0-or-later. Qué significa eso cuando estudias, cambias o compartes código tomado de ellos.
route: mods
order: 5
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: LICENSE
  - repo: pet
    path: .claude-plugin/plugin.json
  - repo: pet
    path: README.md
  - repo: check
    path: LICENSE
  - repo: check
    path: .claude-plugin/plugin.json
  - repo: check
    path: README.md
---

## Qué hace

narsil-pet y narsil-check son de código abierto, y las guías de este sitio citan y adaptan su código. Esta guía explica, en términos sencillos, qué te permite hacer su licencia con ese código y qué te pide cuando lo pasas a otras personas.

Esto no es asesoramiento legal. Resume el texto de la licencia que acompaña a los dos mods. Para una decisión importante, lee la licencia completa y consulta a un abogado.

## Cómo funciona por dentro

Los dos mods tienen la misma licencia:

- `plugin.json` define `"license": "GPL-3.0-or-later"`.
- El archivo `LICENSE` del repositorio es el texto completo de la GNU General Public License, versión 3.
- El README dice que el mod puede redistribuirse y modificarse bajo la GPL v3 o, a tu elección, cualquier versión posterior publicada por la Free Software Foundation.

La licencia distingue dos situaciones:

| Situación                                                                                  | Qué dice la GPL v3                                                                                                                     |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Usas o cambias el código sin dar copias a nadie                                            | Puedes hacerlo, ejecutarlo y cambiarlo sin condiciones, siempre que tu licencia siga vigente (sección 2).                              |
| Lo transmites: das copias a otras personas o las pones a su disposición, con o sin cambios | Se aplican condiciones (secciones 4 a 6). Interactuar con un programa a través de una red sin transferir una copia no es transmitirlo. |

Cuando transmites el código, las condiciones principales son:

- **Código fuente sin cambios (sección 4):** conserva intactos los avisos de copyright y de licencia, conserva los avisos de que no hay garantía y entrega a quienes lo reciben una copia de la licencia.
- **Código fuente modificado (sección 5):** la obra debe llevar "prominent notices stating that you modified it" (avisos bien visibles de que la modificaste), con una fecha pertinente; debe indicar que se publica bajo esta licencia, y debes licenciar la obra entera, como un todo, bajo la GPL v3 a cualquiera que reciba una copia.
- **Otras formas (sección 6):** transmitir la obra en una forma que no sea código fuente exige transmitir también su código fuente correspondiente.

Un mod se distribuye como sus archivos de código fuente, así que en la práctica compartir un mod hecho con código de Narsil significa compartir ese código fuente bajo la GPL v3.

## Paso a paso

### 1. Decide si lo vas a compartir

Si el mod se queda en tu máquina, las condiciones para transmitirlo no se aplican. En cuanto publicas un repositorio, envías un archivo `.plugin` o le pasas la carpeta a alguien, sí se aplican.

### 2. Conserva la licencia

Incluye el texto de la GPL v3 como archivo `LICENSE` e indica la licencia en tu manifiesto:

```json
{
  "name": "my-band",
  "version": "0.1.0",
  "description": "A status band adapted from narsil-pet",
  "license": "GPL-3.0-or-later"
}
```

Mantén "or later" solo si conservas la opción que da el original. No sustituyas la licencia por otra más permisiva en las partes que vienen de Narsil.

### 3. Indica qué tomaste y qué cambiaste

Nombra el origen y el cambio cerca del código. Una cabecera como esta cubre la atribución, el enlace al repositorio y el aviso de modificación:

```ts
// Adapted from narsil-pet (https://github.com/davshn/narsil-pet), hooks/register.tsx.
// Changed 2026-11-17: renamed the band and removed the floating window.
// Licensed under the GNU General Public License, version 3 or later.
```

Conserva los avisos que ya hubiera en los archivos que copiaste.

### 4. Pon el código fuente a disposición

Publica el código fuente completo del mod que compartes, no solo los archivos que tomaste de Narsil. La licencia se aplica a la obra entera.

## Errores comunes y cómo probarlo

- **Publicar sin archivo de licencia.** `claude plugin validate` informa de `LICENSE_MISSING` entre las comprobaciones del directorio de plugins cuando no hay archivo `LICENSE` ni `license` en `plugin.json`. Ejecútalo antes de compartir.
- **Cambiar la licencia del código copiado.** El código tomado de Narsil no puede compartirse bajo MIT, Apache ni una licencia propietaria.
- **Quitar la atribución.** Eliminar el enlace al repositorio original o el aviso de que cambiaste el código va en contra de las condiciones sobre avisos.
- **Compartir solo parte del código fuente.** Quienes lo reciben deben poder obtener el código fuente del mod completo.

Antes de compartir, comprueba que tu carpeta tiene el texto de la licencia, que `plugin.json` nombra la licencia y que cada archivo adaptado indica de dónde viene y qué cambió.

## Para ir más lejos

Lee el archivo `LICENSE` de cualquiera de los dos repositorios para ver el texto completo; las secciones 2, 4, 5 y 6 son las que se resumen aquí. La sección de licencia al final de cada README da el resumen breve del propio proyecto: puedes usar, estudiar, cambiar y compartir el mod, y una versión modificada que distribuyas también debe publicarse como código abierto bajo la misma licencia, sin garantía. Las guías de este sitio siguen la misma práctica: cada fragmento adaptado de Narsil nombra su repositorio y su archivo, y cada guía lista esos archivos entre sus fuentes.

Si un mod que escribes desde cero, después de leer el código de Narsil, cuenta como una obra basada en él es una cuestión legal que esta guía no responde.
