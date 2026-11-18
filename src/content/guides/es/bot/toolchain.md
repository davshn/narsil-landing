---
title: Las herramientas
description: 'Qué versión de ESP-IDF necesita el bot y por qué, cómo compilar las dos placas en la imagen Docker de Espressif y cómo flashearlas desde Windows, donde Docker no llega a los puertos USB.'
route: bot
order: 2
updated: 2026-11-18
---

## Qué hace

Las dos placas se programan con ESP-IDF, el framework oficial de Espressif para los chips ESP32. Esta guía prepara un único conjunto de herramientas que compila la panza (ESP32-P4, Xiaozhi) y la cabeza (ESP32-S3, nuestro propio firmware), y explica cómo llega el firmware desde tu PC a cada placa.

En resumen:

- **Una sola versión de ESP-IDF para las dos placas:** la rama `release/v6.1`.
- **La compilación se hace en Docker**, en la imagen de Espressif `espressif/idf:release-v6.1`, así que en el PC no se instala nada más que Docker.
- **El flasheo se hace desde el propio Windows**, porque un contenedor Docker en Windows no ve los puertos serie USB.

Si prefieres un editor con botones, la extensión de ESP-IDF para VS Code hace el mismo trabajo de forma nativa, y esta guía también la trata.

## Cómo funciona por dentro

### Dos versiones documentadas, una elección

Las dos fuentes de la panza no coinciden en la versión:

- **Waveshare** recomienda ESP-IDF V5.3.1 o posterior para la ESP32-P4-WIFI6-Touch-LCD-4.3 en su [página de ESP-IDF](https://docs.waveshare.com/ESP32-P4-WIFI6-Touch-LCD-4.3/ESP-IDF/), y su recorrido paso a paso usa V5.5.2.
- **Xiaozhi** (78/xiaozhi-esp32) dice en su README que el proyecto ahora requiere ESP-IDF v6.0.1 o posterior, recomienda la rama `release/v6.1` y afirma que ESP-IDF 5.x ya no tiene soporte.

El bot sigue a Xiaozhi, porque Xiaozhi es el firmware que corre en la panza. Unas herramientas 5.x no pueden compilarlo en absoluto, mientras que a la placa le da igual: el propio paquete de soporte de placa de Waveshare declara `idf: '>=5.4'`, así que 6.x está dentro de su rango. El 5.3.1 de Waveshare es un mínimo para sus ejemplos, no un máximo.

Xiaozhi recomienda la rama, y no la etiqueta `v6.1`, por una razón concreta: su README enlaza la issue #2344, donde la etiqueta `v6.1` trae una biblioteca Wi-Fi del ESP32-C3 que no coincide con su propia cabecera. La propia CI de Xiaozhi compila cada placa en la imagen `espressif/idf:release-v6.1`, así que el bot usa exactamente esa imagen. Después de cambiar de revisión de ESP-IDF, el README pide ejecutar `idf.py fullclean` en el proyecto antes de volver a compilar.

La cabeza corre nuestro propio firmware pequeño, así que no tiene requisito de versión propio. Se compila con la misma imagen, lo que significa unas solas herramientas, unos solos hábitos y una sola caché.

### Compilar en Docker

Espressif publica ESP-IDF como imagen Docker, documentada en la [guía de la imagen Docker de IDF](https://docs.espressif.com/projects/esp-idf/en/latest/esp32p4/api-guides/tools/idf-docker-image.html). Sus etiquetas siguen tres patrones: `latest` sigue a `master`, `vX.Y` corresponde a una versión publicada y `release-vX.Y` sigue la rama de esa versión. El contenedor trae ESP-IDF, los compiladores y Python listos; tu carpeta del proyecto se monta dentro.

El comando documentado, desde la carpeta del proyecto, es:

```bash
docker run --rm -v $PWD:/project -w /project -u $UID -e HOME=/tmp espressif/idf idf.py build
```

- `--rm` elimina el contenedor cuando termina la compilación.
- `-v $PWD:/project` monta tu carpeta en `/project`, así que el resultado de la compilación queda en tu carpeta.
- `-w /project` empieza en esa carpeta.
- `-u $UID` (Linux y macOS) hace que los archivos generados sean tuyos y no de root.
- `-e HOME=/tmp` le da a `idf.py` un sitio donde guardar su caché.

La guía también documenta `-e IDF_GIT_SAFE_DIR='/project'` para el caso en que git informa de "dubious ownership" (propiedad dudosa) del repositorio montado, algo que pasa con facilidad en una unidad de Windows.

### Destinos: `esp32p4` y `esp32s3`

ESP-IDF compila para un chip cada vez, elegido con `idf.py set-target`. Los comandos de la [guía de inicio para Windows](https://docs.espressif.com/projects/esp-idf/en/v6.1/esp32p4/get-started/windows-start-project.html) de Espressif son:

```bash
idf.py set-target esp32p4
idf.py menuconfig
idf.py build
idf.py -p PORT flash
idf.py -p PORT monitor
```

La cabeza usa `idf.py set-target esp32s3`. La guía de placas personalizadas de Xiaozhi fija el destino "first time, or when switching targets" (la primera vez, o al cambiar de destino), no antes de cada compilación. Para salir del monitor, pulsa `Ctrl+]`.

Para la panza, Xiaozhi envuelve estos pasos en `scripts/build.py`, que lee el `config.json` de la placa, fija el destino y las opciones de la placa, compila y lo une todo en `build/merged-binary.bin`. La guía 3 lo usa.

### Por qué Docker no puede flashear en Windows

La guía de Docker de IDF lo dice claramente: los comandos que hablan con la placa, como `idf.py flash` e `idf.py monitor`, necesitan que el puerto serie se pase al contenedor. En Linux, la opción de dispositivos de Docker lo hace. En Windows la guía dice "currently, this is not possible with Docker for Windows" (por ahora, esto no es posible con Docker para Windows), y la misma limitación se aplica a Docker para Mac.

Así que el bot reparte el trabajo: Docker compila, Windows flashea. Hay dos formas de hacer la segunda mitad, las dos de la documentación de Espressif.

**Desde el anfitrión con esptool.** esptool es la herramienta de flasheo de Espressif. Un binario unido, como el `merged-binary.bin` de Xiaozhi, va en el desplazamiento `0x0`; la [página de comandos básicos](https://docs.espressif.com/projects/esptool/en/latest/esp32p4/esptool/basic-commands.html) de esptool muestra la forma `esptool --port COM4 write-flash 0x1000 my_app-0x01000.bin` y dice que un archivo unido se escribe con `write-flash 0x0`. También indica que `--chip` es opcional al escribir, porque esptool detecta el chip cuando se conecta. En Windows, esptool viene como ejecutable listo para usar en el ZIP de la versión de esptool; en Linux o macOS, `pip install esptool`.

**A través de un puente serie (RFC2217).** La solución de la guía de Docker de IDF: ejecutar `esp_rfc2217_server` en Windows para compartir el puerto COM por la red, y apuntar `idf.py` dentro del contenedor hacia él. `host.docker.internal` es el nombre que Docker da al anfitrión. Así `idf.py flash` sigue funcionando para cualquier proyecto, incluida la cabeza, que no tiene binario unido.

### Puertos USB y drivers en Windows

En Windows, los puertos serie se llaman `COM` seguido de un número. La [guía de conexión serie](https://docs.espressif.com/projects/esp-idf/en/v6.1/esp32p4/get-started/establish-serial-connection.html) de Espressif da la forma más sencilla de encontrar el correcto: abre el Administrador de dispositivos, desconecta la placa, vuelve a conectarla, y el puerto que desaparece y vuelve es el tuyo. También dice que los drivers USB a serie suelen venir con el sistema operativo y se instalan solos.

Para cada placa:

- **La panza** se flashea por su puerto Type-C marcado "USB to UART", que Waveshare describe como el puerto de alimentación, programación y depuración. La página de ESP-IDF de Waveshare recomienda instalar los drivers con el ESP-IDF Installation Manager (EIM).
- **La cabeza** tiene un chip USB a serie CH343P (WCH), indicado en la página de producto de Waveshare.

Si una placa no entra sola en modo de descarga, o para su primer flasheo, la guía de Espressif da la forma manual: mantén pulsado BOOT, pulsa RESET una vez, suelta BOOT.

### La alternativa: VS Code

La [página de primeros pasos](https://docs.espressif.com/projects/esp-idf/en/v6.1/esp32p4/get-started/index.html) de Espressif recomienda dos vías de instalación: el ESP-IDF Installation Manager (EIM) y un IDE, ya sea Espressif-IDE o VS Code con la extensión de ESP-IDF. La página de ESP-IDF de Waveshare recorre EIM más la extensión de VS Code en Windows: instala ESP-IDF con EIM (en una ruta sin espacios) y después la extensión, que desde la versión 2.0 detecta la instalación por sí sola. La barra inferior tiene entonces botones para elegir el puerto COM, fijar el destino (`esp32p4`), compilar, flashear y abrir el monitor.

Una instalación nativa flashea directamente, sin puente. El coste es una instalación grande en el PC, y tienes que instalar la misma rama `release/v6.1` que pide Xiaozhi, no la versión que EIM ofrezca primero.

## Cómo se le pidió a la IA

La cuestión de las herramientas vino de una decisión anterior. Cuando la IA preguntó qué debía correr en la panza para darle voz a Narsil, quien creó Narsil respondió:

> yo pensaba hacerlo con Xiaozhi

La IA leyó entonces el README de Xiaozhi, encontró su requisito, ESP-IDF 6.0.1 o posterior, y lo puso junto al 5.3.1 documentado por Waveshare. Registró la diferencia como un riesgo en el documento de tareas, junto con el plan de compilar en la imagen Docker de Espressif y dejar el flasheo y las comprobaciones en pantalla a la persona que tiene las placas. La regla que aplicó es la de esta guía: el firmware que corre decide la versión, y la documentación de la placa solo fija un mínimo.

La segunda decisión que da forma a las herramientas es dónde vive el código. Ante la pregunta por el hogar del firmware, quien creó Narsil eligió:

> repo propio como fork

Después, ante la pregunta de si debía ser público o privado desde el principio, la respuesta fue "1", la primera opción ofrecida: público desde el principio. Por eso las dos placas se compilan desde un único repositorio, `davshn/narsil-bot`, y por eso las herramientas tienen que manejar dos destinos en un mismo árbol.

### Un prompt que puedes usar

El siguiente prompt se escribió para esta guía como sugerencia. No es la conversación con la que se prepararon las herramientas del bot.

> Compilo firmware para ESP32 en Windows con Docker y no quiero ESP-IDF instalado de forma nativa. Mi proyecto es un fork de 78/xiaozhi-esp32 para una placa ESP32-P4, más una pequeña aplicación ESP-IDF para un ESP32-S3 en una subcarpeta. Lee el README y el workflow de CI de Xiaozhi y la guía de la imagen Docker de IDF de Espressif, y después dime: qué etiqueta de `espressif/idf` usar y por qué, el comando `docker run` exacto para compilar cada destino desde PowerShell, y cómo flashear y monitorizar cada placa desde Windows sabiendo que Docker no puede pasar los puertos serie USB. Cita la documentación de cada versión y cada comando.

## El código mínimo

Compilar la panza, desde la raíz del fork en PowerShell (`${PWD}` es la carpeta actual de PowerShell; la opción `-u $UID` es para Linux y macOS y aquí se omite):

```powershell
docker run --rm -v ${PWD}:/project -w /project -e HOME=/tmp -e IDF_GIT_SAFE_DIR=/project `
  espressif/idf:release-v6.1 `
  python scripts/build.py waveshare/esp32-p4-wifi6-touch-lcd --name esp32-p4-wifi6-touch-lcd-4.3 --language es-ES
```

La guía 3 explica la carpeta de la placa, el `--name` y el idioma. Compilar la cabeza, desde su carpeta:

```powershell
docker run --rm -v ${PWD}:/project -w /project/head -e HOME=/tmp -e IDF_GIT_SAFE_DIR=/project `
  espressif/idf:release-v6.1 `
  sh -c "idf.py set-target esp32s3 && idf.py build"
```

Flashear la panza desde Windows con esptool, con un nombre de puerto inventado:

```powershell
esptool --port COM5 write-flash 0x0 build/merged-binary.bin
```

Flashear la cabeza a través del puente serie. En una terminal, comparte el puerto:

```powershell
esp_rfc2217_server -v -p 4000 COM6
```

En otra, flashea desde el contenedor:

```powershell
docker run --rm -v ${PWD}:/project -w /project/head -e HOME=/tmp -e IDF_GIT_SAFE_DIR=/project `
  espressif/idf:release-v6.1 `
  idf.py --port "rfc2217://host.docker.internal:4000?ign_set_control" flash
```

Para el monitor, el mismo `--port` funciona con `idf.py monitor`; añade `-it` a `docker run` para que el contenedor tenga una terminal en la que dibujar.

## Errores comunes y cómo probarlo

- **Compilar Xiaozhi con ESP-IDF 5.x.** El README de Xiaozhi deja claro que 5.x ya no tiene soporte. Si seguiste la página de instalación de Waveshare e instalaste 5.5.2, la panza no compilará; usa `release-v6.1`.
- **Mezclar carpetas de compilación tras un cambio de versión.** El README de Xiaozhi pide `idf.py fullclean` después de cambiar de revisión de ESP-IDF. Una carpeta `build` antigua de otra versión da errores que parecen no tener relación.
- **Probar `--device` en Windows.** Solo funciona en Linux. En Windows, flashea desde el anfitrión o a través de `esp_rfc2217_server`.
- **"dubious ownership" de git dentro del contenedor.** Pasa `-e IDF_GIT_SAFE_DIR=/project`, como documenta la guía de Docker de IDF.
- **No aparece ningún puerto COM.** Desconecta y vuelve a conectar mirando el Administrador de dispositivos. Si no cambia nada, prueba otro cable: un cable USB solo de carga no tiene líneas de datos.
- **El puerto equivocado en la panza.** Flashea por el puerto Type-C marcado "USB to UART", no por el USB OTG.
- **La placa no responde a esptool.** Mantén pulsado BOOT, pulsa RESET, suelta BOOT y vuelve a flashear.

Para probar las herramientas antes de Xiaozhi, compila el ejemplo `hello_world` de ESP-IDF para cada destino en el contenedor, flashéalo y busca su salida en el monitor. Si las dos placas imprimen, las herramientas, los drivers y los cables están bien.

## Para ir más lejos

- `docker run` con `-it` y sin comando abre una shell en el contenedor, donde puedes ejecutar `idf.py menuconfig` y los demás comandos de forma interactiva, como muestra la guía de Docker de IDF.
- Fija la imagen por digest en lugar de por etiqueta si quieres que cada compilación del bot use exactamente el mismo commit de ESP-IDF; `release-v6.1` se mueve a medida que se mueve la rama.
- `scripts/build.py --list-boards` de Xiaozhi imprime cada placa y variante que conoce, lo que es una forma rápida de comprobar el nombre de una placa antes de una compilación larga.
- La referencia completa de comandos de ESP-IDF está en la documentación de Espressif para cada chip; cambia el chip en la URL (`esp32p4`, `esp32s3`) para ver sus propias páginas.
