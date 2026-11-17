---
title: Dibujo y animaciones
description: 'Cómo se dibuja Narsil: una pose por estado, arte claro y oscuro en un solo SVG, bucles animados hechos con vídeos de IA y el límite de 131072 caracteres de la banda.'
route: pet
order: 2
updated: 2026-11-17
verifiedWith: 2.1.325
sources:
  - repo: pet
    path: hooks/sprite.ts
  - repo: pet
    path: hooks/art.ts
  - repo: pet
    path: tools/build-art.ps1
  - repo: pet
    path: tools/anim-sources.ps1
  - repo: pet
    path: tools/encode-anim.ps1
  - repo: pet
    path: tools/build-animated.ps1
  - repo: pet
    path: odd/tasks/animated-poses.md
  - repo: pet
    path: README.md
  - repo: pet
    path: tests/narsil.test.tsx
---

## Qué hace

Fuera de la terminal, la banda sobre el prompt muestra a Narsil, una serpiente marina chibi, en una pose que corresponde al estado de la conversación. Saluda a una conversación nueva, dormita mientras espera por ti, trabaja mientras Claude trabaja, se asoma cuando te necesita, celebra cuando el turno termina y pone cara de preocupación ante un error.

Cada pose está dibujada dos veces, una para fondo claro y otra para fondo oscuro, y la banda elige la adecuada según el esquema de color de tu sistema. Cada pose es además un bucle animado corto: Narsil se mueve de verdad, respira, parpadea y se balancea, en lugar de ser una imagen fija con efectos alrededor.

Narsil también crece. A medida que gana experiencia pasa por cinco etapas, de cría recién salida del huevo a adulta, y cada etapa tiene su propio juego de poses. Las subidas de nivel y las etapas nuevas tienen su propia celebración sobre la imagen.

En la terminal no hay imagen. La banda dibuja en su lugar una pequeña cara de texto para cada ánimo, como `~(-ᴗ-)~ z` mientras duerme.

El dibujo es lo primero que nota la gente, y hace un trabajo real: la pose y el brillo de color a su alrededor dicen el estado antes de que leas una palabra.

## Cómo funciona por dentro

### De dónde salen las imágenes

El arte son imágenes pintadas, no formas vectoriales. Están como archivos de imagen en `assets/raw/<pose>-<claro|oscuro>.png` para la cría y en `assets/raw/etapa2` a `assets/raw/etapa5` para las etapas posteriores (`claro` es el tema claro y `oscuro`, el oscuro). Las poses se llaman como los estados: `hola`, `parada`, `trabajando`, `necesita`, `terminado` y `error`, más una pose `base` que sirve de respaldo.

Un mod no puede leer archivos de imagen en el momento de dibujar, así que las imágenes se convierten en código. `tools/build-art.ps1`, un script de Windows PowerShell, quita el fondo liso de cada imagen (blanco o transparente, avanzando desde los bordes), la recorta al personaje, la escala a 150 píxeles de alto y escribe `hooks/art.ts` y los archivos de `hooks/art/` con cada imagen incrustada como datos. Sus comentarios dicen que también quita "any fake 'transparency' checkerboard an image generator painted" (cualquier falso tablero de "transparencia" que haya pintado un generador de imágenes) y una línea de marco clara que "an image generator drew" (dibujó un generador de imágenes); el repositorio no registra qué herramienta de imágenes se usó.

El propio `hooks/art.ts` es corto y generado: importa un módulo por etapa y tema y expone `ART`, indexado por etapa, después por tema y después por pose. Su primera línea dice "do not edit by hand" (no editar a mano).

### Elegir una imagen

`art` en `hooks/sprite.ts` elige la imagen para un ánimo, un tema y una etapa:

1. La pose buscada es `hola` para el saludo y, en otro caso, la pose del estado del ánimo (`POSE`).
2. Si existe un bucle animado para esa etapa, ese tema y esa pose (`ANIMATED`), gana el bucle.
3. Si no, busca la imagen fija, y recurre a la pose `base` de la etapa, después a etapas anteriores y después al otro tema.

Esa cadena de respaldos es la razón por la que el arte pudo añadirse etapa por etapa: una etapa que aún no estaba dibujada seguía mostrando algo razonable.

### Un SVG, dos temas

`sprite` devuelve un único documento SVG que contiene los dos temas. La imagen clara está en un grupo con la clase `th-claro`, la oscura en `th-oscuro`, y una regla CSS dentro del SVG muestra una u otra:

```css
.th-oscuro {
  display: none;
}
@media (prefers-color-scheme: dark) {
  .th-claro {
    display: none;
  }
  .th-oscuro {
    display: inline;
  }
}
```

El mod nunca necesita conocer el tema. La superficie que dibuja el SVG aplica el esquema de color de quien mira, así que el mismo dibujo se ve bien a la vez en un escritorio claro y en un teléfono oscuro.

### Hacer que una imagen fija se mueva

Antes de que existieran los bucles animados, toda la vida venía de CSS dentro del SVG, y ese código se sigue usando para cualquier pose sin bucle. El comentario al principio de `hooks/sprite.ts` enumera las capas:

- La imagen entera nada, se mece, salta o tiembla con transformaciones CSS, a un ritmo que fija su etapa (`STAGE_MOTION`, `motion`), con una sombra y salpicaduras acompasadas.
- Su cuerpo está cortado de lado a lado en nueve franjas que solo se tocan (`cuts`, `bands`), y cada franja se balancea con un pequeño retraso, de modo que una onda recorre el cuerpo de la cabeza a la cola. Del cuello hacia arriba es una sola franja, así que ningún corte cruza su cara.
- A su alrededor: un aura pulsante del color del estado (`aura`), burbujas, ondas en el agua, confeti cuando termina y accesorios para cada ánimo.
- `@media (prefers-reduced-motion: reduce)` desactiva todas las animaciones.

El historial de commits explica la regla de las "franjas que solo se tocan". Un enfoque anterior superponía una segunda copia deformada de la imagen sobre la primera, y correcciones como `9f9cc75` "fix: draw Narsil as one sharp picture so no part of her shows twice" (dibujar a Narsil como una sola imagen nítida para que ninguna parte se vea dos veces) y `6ac340e` "fix: draw Narsil's head once instead of a turning copy over the body" (dibujar la cabeza de Narsil una sola vez en lugar de una copia que gira sobre el cuerpo) eliminaron el aspecto duplicado.

### Los bucles animados

Ahora cada pose tiene además un bucle animado real: una imagen WebP animada hecha a partir de un vídeo corto generado con IA, incrustada como datos en `hooks/art/anim/` y reunida por `hooks/art/animated.ts`. Cuando `art` encuentra un bucle, `picture` lo dibuja entero y se salta el corte en franjas, porque el bucle ya se mueve por sí mismo. El aura, la insignia y los efectos siguen rodeándolo.

### El límite de tamaño

Todo lo anterior tiene que caber en una sola cadena. El `source` del elemento `Svg` es, en palabras de los tipos de 2.1.325, "The SVG document, `<svg ...>...</svg>`, at most 131072 characters." (el documento SVG, de 131072 caracteres como máximo). Los dos temas comparten ese presupuesto, porque los dos están en el mismo dibujo.

Ese límite dio forma a los bucles:

- `tools/encode-anim.ps1` busca la mejor calidad que mantenga un bucle dentro de 38 KB (`-TargetKB 38`).
- `tools/build-animated.ps1` rechaza cualquier bucle de más de 40 KB (`$MAX_BYTES`). Incrustados como datos base64, dos bucles de 40 KB ocupan unos 109.000 caracteres, lo que deja sitio para el resto del dibujo.
- Un test de `tests/narsil.test.tsx` lo demuestra: "two loops of the largest size tools/build-animated.ps1 lets in, one per theme, still fit the band at every stage and celebration" (dos bucles del mayor tamaño que admite tools/build-animated.ps1, uno por tema, siguen cabiendo en la banda en todas las etapas y celebraciones).
- `tools/build-animated.ps1` escribe un módulo por etapa y tema porque, como dice su comentario, "the engine reads no file over 1 MiB" (el motor no lee ningún archivo de más de 1 MiB).

La ventana flotante no tiene ese límite, así que muestra una copia más nítida de cada bucle. `pictureDefs` marca un bucle con `data-loop="<name>"`, y la página de la ventana lo sustituye por una versión de 200 píxeles que el servidor local sirve desde `assets/anim-hq`.

### El coste al dibujar

Un dibujo completo es grande (el código dice "some 100 KB", unos 100 KB), y la banda y la ventana piden el mismo una y otra vez. `sprite` guarda los ocho últimos dibujos en un `Map` cuya clave es el ánimo, la etapa y el hito, y `pushOverlay` en `hooks/register.tsx` envía el SVG a la ventana solo cuando cambió (commit `19106d1` "perf: reuse Narsil's drawing and send it to the window only when it changes", reutilizar el dibujo de Narsil y enviarlo a la ventana solo cuando cambia).

## Cómo se le pidió a la IA

Esta historia tiene dos partes. El arte fijo y su movimiento CSS llegaron primero, y sus peticiones no quedaron registradas. Los bucles animados tienen un registro de tareas público, `odd/tasks/animated-poses.md` en narsil-pet, que cita palabra por palabra las peticiones de quien creó Narsil.

### Reconstrucción a partir del historial de commits (arte fijo)

A partir de `git log -- hooks/sprite.ts hooks/art.ts tools/build-art.ps1`:

- `d48c95c` (2026-10-30) "feat(art): add painted art for each state and its build tool" (añadir arte pintado para cada estado y su herramienta de construcción), después `d31a6ba` "feat(sprite): draw Narsil from the art with layered animations" (dibujar a Narsil a partir del arte con animaciones en capas).
- `9bfa039` (2026-10-30) "feat: let Narsil grow through five stages as she levels up" (que Narsil crezca a lo largo de cinco etapas al subir de nivel) y `7a964d1` "feat: draw Narsil as a hatchling at stage 1 and split the art per stage" (dibujar a Narsil como cría en la etapa 1 y dividir el arte por etapa).
- El 2026-10-31, un commit por etapa y tema, como `ff02847` "feat: draw stage 3 dark art" (dibujar el arte oscuro de la etapa 3) y `eed13b0` "feat: draw stage 5 light art" (dibujar el arte claro de la etapa 5).
- `9f9cc75` y `6ac340e` (2026-10-31), las correcciones de la imagen duplicada descritas arriba.
- `e79c512` (2026-11-09) "feat: make Narsil's body undulate and her rest less mechanical" (hacer que el cuerpo de Narsil ondule y que su reposo sea menos mecánico). Su mensaje describe las franjas que "only meet" (solo se tocan) y dice que en reposo "only starts to snore after a minute" (solo empieza a roncar pasado un minuto).

### La petición registrada de los bucles animados

La primera entrada del registro, L1, con fecha 2026-11-15:

> "quiero cambiar las imagenes de narsil, por unas realmente animadas, donde tenga movimiento la serpiente, esto es posible? podriamos usar mi suscripcion de gemini plis para generar las animaciones, estoi haria que el mod consumiera demasiados recursos?"

Las especificaciones del mismo archivo citan las correcciones que siguieron, y cada una cambió el resultado:

- Especificación S2: "dile que no necesitas sonido, la oido sonar y chapoteando el agua y no es necesario". El prompt del vídeo ahora pide silencio, y el codificador elimina cualquier pista de audio.
- Especificación S3: "me gustaria que tuviera el color original, y sobretodo que se viera en la banda de chat". Esto convirtió el límite de 131072 caracteres en la restricción principal.
- Especificación S4: "la version idle que es la dormida parpadea, lo que es curioso". Ahora cada bucle se genera a partir de la imagen de su propia pose, y el prompt de la pose dormida dice que sus ojos permanecen cerrados.
- Especificación S5: "no podemos directamente generarla con menos tamano para ahorrar limite? se ve algomas delgado y algo pixelado". La respuesta del registro: el tamaño de salida del vídeo no cambia el coste; lo cambian un movimiento sutil y los ajustes del codificador.
- L4 (2026-11-15): "si me agrada, vamos a cambiar todos". Eso se convirtió en 60 bucles: seis poses, cinco etapas, dos temas.
- L6 (2026-11-15): "en ventana externa podemos poner el video sin recortar? para que se vea mas nitido?". De aquí salieron las copias nítidas de `assets/anim-hq`.

El registro también recoge cómo se hicieron los vídeos. Al principio salían de Veo en la app de Gemini, y la cuota se agotó tras dos vídeos (L4). En L8 (2026-11-16), el autor o la autora pidió a Claude que hiciera los vídeos en su navegador y que se detuviera cuando llegara el límite de Veo. En L9 (2026-11-16) preguntó "antes de continuar, no es posible avanzar en los videos usando flow?". Flow tenía sus propios créditos, y su modo Frames, con la imagen de Narsil como primer y último fotograma, daba un bucle cerrado. En L10 (2026-11-16) pidió mejor calidad o más movimiento y después dijo "prioriza la nitidez y luego mas movimiento". El resultado, según registra L10: los 60 bucles hechos en Flow, de 3 segundos a 360p, con prompts que piden un movimiento claro del cuerpo, la cabeza y las aletas mientras el agua permanece en calma, porque el agua agitada le costaba nitidez al bucle de la banda.

### El prompt que recibió el modelo de vídeo

El prompt que se envió al modelo de vídeo también está registrado, porque lo escribe un script. `tools/anim-sources.ps1` prepara, para cada bucle que falta, su imagen sobre verde puro (`#00FF00`) y un archivo de texto con el prompt de `Get-Prompt`. El prompt empieza así:

> "Create a SILENT video from this image: no audio at all, no music, no sound effects, no water sounds. Animate this exact character as a seamless loop of ..."

Es decir: crea un vídeo SILENCIOSO a partir de esta imagen, sin ningún audio, sin música, sin efectos de sonido ni sonidos de agua, y anima a este personaje exacto como un bucle sin cortes de... Después pide agua en calma, un personaje idéntico, una cámara fija, el mismo fondo verde liso y un último fotograma que coincida con el primero. La parte central sale de una tabla de movimientos por pose; para la pose dormida dice que sus ojos "stay CLOSED the whole time" (permanecen CERRADOS todo el tiempo), que es la especificación S4 convertida en instrucción.

Luego `tools/encode-anim.ps1` elimina el verde por croma (`colorkey=0x00FF00`), quita el audio, recorta al personaje y hace una búsqueda binaria sobre la calidad WebP para quedar por debajo del tamaño objetivo. `tools/build-animated.ps1`, al que llama, incrusta el resultado.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es uno de los prompts registrados en narsil-pet.

> En mi mod de Claude Code, añade una función `petSvg(status)` que devuelva un documento SVG para el elemento `Svg` de la banda `AbovePrompt`. Debe contener una versión clara y otra oscura de mi personaje (URL de datos de `hooks/art.ts`), mostrar la adecuada con una media query `prefers-color-scheme` dentro del SVG y dar a cada estado una pequeña animación CSS (mecerse mientras trabaja, respirar despacio en reposo, una breve sacudida ante un error). Desactiva las animaciones con `prefers-reduced-motion`. Lanza un error si el documento supera los 131072 caracteres y añade un test que compruebe que todos los estados, en los dos temas, caben. En la terminal, dibuja una cara de texto en su lugar, ya que la terminal no tiene `Svg`.

## El código mínimo

Una versión reducida, escrita para esta guía y comprobada con los tipos de 2.1.325. La estructura (dos temas en un SVG, la comprobación de tamaño, la cara de terminal) está adaptada de `hooks/sprite.ts` y `hooks/register.tsx` de [narsil-pet](https://github.com/davshn/narsil-pet) (GPL-3.0-or-later). Los dibujos de Narsil también son GPL v3: si los usas, conserva la atribución y un enlace al repositorio.

```ts
// hooks/drawing.ts
const MAX_SVG = 131072 // the Svg element's limit for `source`

export function petSvg(lightSrc: string, darkSrc: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 120" width="150" height="120">` +
    `<style>.dark{display:none}` +
    `@media (prefers-color-scheme: dark){.light{display:none}.dark{display:inline}}` +
    `.bob{transform-box:fill-box;transform-origin:50% 100%;animation:bob 2s ease-in-out infinite}` +
    `@keyframes bob{50%{transform:translateY(-3px)}}` +
    `@media (prefers-reduced-motion: reduce){*{animation:none!important}}</style>` +
    `<g class="bob">` +
    `<image class="light" href="${lightSrc}" x="25" y="4" width="100" height="112"/>` +
    `<image class="dark" href="${darkSrc}" x="25" y="4" width="100" height="112"/>` +
    `</g></svg>`
  if (svg.length > MAX_SVG)
    throw new Error(`the drawing has ${svg.length} characters; the band takes ${MAX_SVG}`)
  return svg
}
```

Para dibujarlo, con el respaldo de terminal:

```tsx
on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
  if (e.props.hasSurvey) return next(e)
  if (e.surface === 'terminal') {
    const { Text } = $.ui.resolve(e)
    return <Text>~(•ᴗ•)~ working</Text>
  }
  const { Svg } = $.ui.resolve(e)
  return <Svg source={petSvg(LIGHT, DARK)} alt="My pet: working" width={132} height={118} />
})
```

`LIGHT` y `DARK` representan tus propias imágenes incrustadas, por ejemplo cadenas `data:image/png;base64,...` generadas por un script de construcción del mismo modo que `tools/build-art.ps1` escribe `hooks/art.ts`. Acotar primero por `e.surface` importa: la tabla de elementos de la terminal no tiene `Svg`.

## Errores comunes y cómo probarlo

- **Pasarse del límite sin darse cuenta.** Un dibujo de más de 131072 caracteres no se dibuja. Los datos base64 crecen un tercio, así que una imagen de 40 KB cuesta unos 54.600 caracteres, y dos temas lo duplican. Comprueba la longitud en el código y en un test, como hace Narsil con "every state is drawn from the art, light and dark, within the Svg size limit" (cada estado se dibuja a partir del arte, claro y oscuro, dentro del límite de tamaño de Svg).
- **Elegir el tema en el mod.** El mod no puede ver el esquema de color de quien mira, y varias superficies pueden dibujar a la vez. Pon los dos temas en el SVG y deja que el CSS elija.
- **Animar una copia sobre la imagen.** Un duplicado deformado se transparenta como imagen doble. Las correcciones de Narsil (`9f9cc75`, `6ac340e`) pasaron a franjas de borde duro que solo se tocan.
- **Animar una pose hacia otra pose.** La especificación S4 del registro recoge que la pose dormida parpadeaba. Genera cada bucle a partir de su propia pose y di en el prompt lo que no debe cambiar.
- **Sonido y fondos agitados en el vídeo de IA.** Pide silencio y elimina el audio de todos modos (especificación S2). El agua en calma mantiene nítido el bucle a tamaño pequeño (L10). Haz que el bucle se cierre sobre sí mismo: el modo Frames de Flow, con el mismo primer y último fotograma, lo consiguió (L9).
- **Bordes suaves que cuestan demasiado.** L2 del registro recoge que un borde alfa suave y difuminado costaba unos 45 KB; los bucles de la banda usan un borde duro reducido un píxel, lo que además elimina el halo verde. Las copias nítidas de la ventana usan el borde suave.
- **Archivos que el motor no carga.** Los módulos de más de 1 MiB se rechazan, así que reparte el arte incrustado entre varios archivos (uno por etapa y tema en Narsil).
- **Volver a dibujar en cada latido.** Guarda los dibujos en caché y envíalos solo cuando cambien.

Para probarlo, `claude plugin test .` ejecuta los tests de dibujo de Narsil en `tests/narsil.test.tsx`, entre ellos "Narsil moves visibly in every state" (Narsil se mueve de forma visible en todos los estados) y "a pose with an animated loop shows the loop, whole and within the Svg size limit, and its still picture elsewhere" (una pose con bucle animado muestra el bucle, entero y dentro del límite de tamaño de Svg, y su imagen fija en los demás sitios). `node tests/overlay-drawing.check.cjs` comprueba el dibujo de la ventana flotante. El repositorio de Narsil tiene también `tools/preview.mjs`, añadido como "chore: add a local preview page for every animation" (añadir una página local de vista previa para cada animación) (`75e1525`), para ver todas las poses a la vez.

## Para ir más lejos

- `draw` en `hooks/sprite.ts` monta el documento completo: el agua, la capa de hitos al fondo, la sombra, las imágenes de los dos temas, las burbujas, las gotas y, o bien una celebración, o bien los accesorios del ánimo.
- `LAYOUT` guarda, para cada pose, dónde está su cabeza, para que la insignia y las ondas caigan sobre ella; `place` escala cada imagen a la caja de 150 por 120.
- `props` añade los pequeños objetos de cada ánimo, y `ASLEEP_AFTER_S` espera un minuto antes de que empiece a roncar.
- `celebration`, `behind` y `grows` dibujan un nivel nuevo y una etapa nueva sobre su estado.
- `FACE` es la cara de texto de la terminal para cada uno de los doce ánimos.
- `tools/anim-sources.ps1`, `tools/encode-anim.ps1` y `tools/build-animated.ps1` forman la cadena de los bucles; la sección "Desarrollo" del README enumera los pasos exactos y los ajustes de Flow, y `tools/ffmpeg.ps1` localiza ffmpeg.
- `overlay/server.cjs` sirve los bucles nítidos en `GET /anim/<loop>.webp` para la ventana flotante, como se explica en una guía posterior.
